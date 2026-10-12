import { bootSolidModels, SolidEngine } from 'soukai-solid'
import { setEngine } from 'soukai'
import { Parser } from 'n3'
import Task from './Task.model'
import { findStaleSingleValuedTriples } from './recover-metadata'
import { TaskClass, Status } from '@/models/TaskClass'
import { TaskGraph } from '@/models/TaskGraph'
import { withTrailingSlash } from '@/utils/url'

const TASK_CONTAINER_NAME = 'planner/tasks/'
const LDP_CONTAINS = 'http://www.w3.org/ns/ldp#contains'

/**
 * Service for reading and writing tasks to/from a Solid Pod using Soukai
 */
export class SolidTaskService {
  private taskContainerUrl: string
  private engine: SolidEngine
  private authFetch: typeof fetch

  constructor(podRootUri: string, authFetch: typeof fetch) {
    this.authFetch = authFetch
    this.taskContainerUrl = `${withTrailingSlash(podRootUri)}${TASK_CONTAINER_NAME}`

    // Initialize Soukai with authenticated fetch
    this.engine = new SolidEngine(authFetch)
    setEngine(this.engine)

    // Boot Solid models
    bootSolidModels()
  }

  /**
   * Get the task container URL
   */
  getTaskContainerUrl(): string {
    return this.taskContainerUrl
  }

  /**
   * Fetch all tasks from the Solid Pod.
   *
   * A real fetch/parse error is rethrown (never swallowed as an empty result),
   * because an empty result would make the sync service treat every local task
   * as deleted remotely and wipe local storage. The only case that yields an
   * empty array is a missing (404) task container.
   *
   * If loading fails because a document's metadata is malformed (e.g. duplicate
   * `crdt:updatedAt` from a concurrent update), the affected documents are
   * repaired in place and loading is retried document by document.
   */
  async fetchTasks(): Promise<Task[]> {
    try {
      const tasks = await Task.from(this.taskContainerUrl).all()
      return tasks as Task[]
    } catch {
      if (await this.isContainerMissing()) {
        return []
      }

      return this.loadAllDocumentsWithRepair()
    }
  }

  /**
   * Read the task container listing directly so a single malformed document
   * does not fail the whole fetch (the JSON-LD helper reads every document).
   */
  private async listTaskDocumentUrls(): Promise<string[]> {
    const response = await this.authFetch(this.taskContainerUrl, {
      headers: { Accept: 'text/turtle' },
    })

    if (response.status === 404) return []
    if (!response.ok) {
      throw new Error(`Failed to list task documents (HTTP ${response.status})`)
    }

    const turtle = await response.text()
    const quads = new Parser({ baseIRI: this.taskContainerUrl }).parse(turtle)

    return quads
      .filter(
        quad =>
          quad.predicate.value === LDP_CONTAINS &&
          quad.object.termType === 'NamedNode',
      )
      .map(quad => quad.object.value)
  }

  private async isContainerMissing(): Promise<boolean> {
    try {
      const response = await this.authFetch(this.taskContainerUrl, {
        headers: { Accept: 'text/turtle' },
      })

      return response.status === 404
    } catch {
      return false
    }
  }

  private async loadAllDocumentsWithRepair(): Promise<Task[]> {
    const urls = await this.listTaskDocumentUrls()
    const tasks: Task[] = []

    for (const url of urls) {
      let task: Task | null

      try {
        task = await Task.find(url)
      } catch {
        await this.repairDocument(url)
        task = await Task.find(url)
      }

      if (task) tasks.push(task)
    }

    if (urls.length > 0 && tasks.length === 0) {
      throw new Error('Task documents were found but none could be loaded')
    }

    return tasks
  }

  /**
   * Remove duplicate values of single-valued predicates (such as
   * `crdt:updatedAt`) from a document, using a targeted `DELETE DATA` PATCH so
   * triples unrelated to this application are left untouched.
   */
  private async repairDocument(url: string): Promise<void> {
    const response = await this.authFetch(url, {
      headers: { Accept: 'text/turtle' },
    })

    if (!response.ok) {
      throw new Error(
        `Failed to read task document ${url} (HTTP ${response.status})`,
      )
    }

    const turtle = await response.text()
    const quads = new Parser({ baseIRI: url }).parse(turtle)
    const stale = findStaleSingleValuedTriples(quads)

    if (stale.length === 0) {
      throw new Error(
        `Task document ${url} failed to parse but no stale triples were found`,
      )
    }

    const patch = await this.authFetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/sparql-update' },
      body: `DELETE DATA {\n${stale.join('\n')}\n}`,
    })

    if (!patch.ok) {
      throw new Error(
        `Failed to repair task document ${url} (HTTP ${patch.status})`,
      )
    }
  }

  /**
   * Delete a task by URL (recursively deletes subtasks)
   */
  async deleteTask(taskUrl: string): Promise<void> {
    try {
      const task = await Task.find(taskUrl)
      if (task) {
        // First, recursively delete all subtasks
        if (task.subTaskUrls && task.subTaskUrls.length > 0) {
          for (const subTaskUrl of task.subTaskUrls) {
            const absoluteUrl = this.toAbsoluteUrl(subTaskUrl)
            await this.deleteTask(absoluteUrl)
          }
        }
        // Then delete the task itself
        await task.delete()
      }
    } catch (err) {
      console.error('Error deleting task:', err)
      throw err
    }
  }

  /**
   * Convert Soukai Task models to TaskClass objects with a TaskGraph
   * Returns { taskClasses, graph } where taskClasses are root tasks and graph manages relationships
   */
  async loadTasksAsTaskClasses(): Promise<{
    taskClasses: TaskClass[]
    graph: TaskGraph
  }> {
    const tasks = await this.fetchTasks()
    return this.convertToTaskClasses(tasks)
  }

  /**
   * Convert Soukai Task models to TaskClass objects
   * Returns { taskClasses, graph } where taskClasses includes ALL tasks (root and children)
   */
  convertToTaskClasses(tasks: Task[]): {
    taskClasses: TaskClass[]
    graph: TaskGraph
  } {
    const taskMap = new Map<string, TaskClass>()
    const taskByUrl = new Map<string, Task>()

    // First pass: create TaskClass objects
    for (const task of tasks) {
      const taskUrl = task.url!
      taskByUrl.set(taskUrl, task)

      const taskClass = new TaskClass({
        id: this.extractIdFromUrl(taskUrl),
        name: task.title || '',
        description: task.description,
        addedDate: task.dateCreated || new Date(),
        startDate: task.startDate,
        endDate: task.endDate,
        status: task.status as Status | undefined,
      })

      taskClass.fullId = taskUrl
      taskMap.set(taskUrl, taskClass)
    }

    // Second pass: establish parent-child relationships in TaskClass properties
    for (const task of tasks) {
      const taskUrl = task.url!
      const taskClass = taskMap.get(taskUrl)!

      // Handle subtasks - store IDs in TaskClass.childIds
      if (task.subTaskUrls && task.subTaskUrls.length > 0) {
        for (const subTaskUrl of task.subTaskUrls) {
          // Convert relative URLs to absolute for lookup
          const absoluteUrl = this.toAbsoluteUrl(subTaskUrl)
          const subTaskClass = taskMap.get(absoluteUrl)
          if (subTaskClass) {
            taskClass.childIds.push(subTaskClass.id)
            subTaskClass.parentId = taskClass.id
          }
        }
      }
    }

    // Build graph from TaskClass data
    const graph = TaskGraph.fromTasks(Array.from(taskMap.values()))

    // Set graph reference for all tasks
    for (const taskClass of taskMap.values()) {
      taskClass.setGraph(graph)
    }

    // Return ALL tasks - store will organize them by relationships
    const allTasks = Array.from(taskMap.values())

    return { taskClasses: allTasks, graph }
  }

  /**
   * Save a single TaskClass to the Pod (incremental save)
   */
  async saveTaskClass(taskClass: TaskClass): Promise<void> {
    let task: Task

    if (taskClass.fullId) {
      // Existing task - fetch and update
      const existing = await Task.find(taskClass.fullId)
      if (existing) {
        task = existing
        this.updateTaskFromTaskClass(task, taskClass)
        await task.save()
      } else {
        // URL exists but task not found, create new
        task = this.convertToSoukaiTask(taskClass)
        await task.save(this.taskContainerUrl)
        taskClass.fullId = task.url
      }
    } else {
      // New task - create
      task = this.convertToSoukaiTask(taskClass)
      await task.save(this.taskContainerUrl)
      taskClass.fullId = task.url
    }
  }

  /**
   * Save TaskClass objects to the Pod (bulk save for initial load)
   * Saves all tasks - the store will have already collected all descendants
   */
  async saveTaskClasses(taskClasses: TaskClass[]): Promise<void> {
    // Save all provided tasks sequentially
    for (const taskClass of taskClasses) {
      await this.saveTaskClass(taskClass)
    }
  }

  /**
   * Update an existing Task model from TaskClass data
   */
  private updateTaskFromTaskClass(task: Task, taskClass: TaskClass): void {
    task.title = taskClass.name
    task.description = taskClass.description
    task.dateCreated = taskClass.addedDate
    task.startDate = taskClass.startDate
    task.endDate = taskClass.endDate
    task.status = taskClass.status

    // Set subtask IDs (Soukai will handle URL conversion)
    if (taskClass.childIds.length > 0) {
      task.subTaskUrls = taskClass.childIds
    } else {
      task.subTaskUrls = undefined
    }

    // Set parent task ID (Soukai will handle URL conversion)
    if (taskClass.parentId) {
      task.parentTaskUrl = taskClass.parentId
    } else {
      task.parentTaskUrl = undefined
    }
  }

  /**
   * Convert TaskClass to Soukai Task model
   */
  private convertToSoukaiTask(taskClass: TaskClass): Task {
    const task = new Task()

    // Set URL if available
    if (taskClass.fullId) {
      task.url = taskClass.fullId
    }

    task.title = taskClass.name
    task.description = taskClass.description
    task.dateCreated = taskClass.addedDate
    task.startDate = taskClass.startDate
    task.endDate = taskClass.endDate
    task.status = taskClass.status

    // Set subtask IDs (Soukai will handle URL conversion)
    if (taskClass.childIds.length > 0) {
      task.subTaskUrls = taskClass.childIds
    } else {
      task.subTaskUrls = undefined
    }

    // Set parent task ID (Soukai will handle URL conversion)
    if (taskClass.parentId) {
      task.parentTaskUrl = taskClass.parentId
    }

    return task
  }

  /**
   * Extract ID from task URL
   */
  private extractIdFromUrl(url: string): string {
    if (url.includes('#')) {
      return url.split('#')[0].split('/').pop()! + '#' + url.split('#')[1]
    }
    return url.split('/').pop()!
  }

  /**
   * Convert absolute URL to relative if in same container
   */
  private toRelativeUrl(absoluteUrl: string): string {
    if (absoluteUrl.startsWith(this.taskContainerUrl)) {
      // Return just the filename
      return absoluteUrl.substring(this.taskContainerUrl.length)
    }
    return absoluteUrl
  }

  /**
   * Convert relative URL to absolute using container URL
   */
  private toAbsoluteUrl(relativeUrl: string): string {
    if (
      relativeUrl.startsWith('http://') ||
      relativeUrl.startsWith('https://')
    ) {
      return relativeUrl
    }
    return this.taskContainerUrl + relativeUrl
  }
}

/**
 * Create a SolidTaskService instance
 * @param podRootUri Root URI of the Solid Pod
 * @param authFetch Authenticated fetch function
 */
export function createSolidTaskService(
  podRootUri: string,
  authFetch: typeof fetch,
): SolidTaskService {
  return new SolidTaskService(podRootUri, authFetch)
}
