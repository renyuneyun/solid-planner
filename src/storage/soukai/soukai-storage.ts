import { bootSolidModels, SolidEngine } from 'soukai-solid'
import { setEngine } from 'soukai'
import Task from './Task.model'
import { TaskClass, Status } from '@/models/TaskClass'
import { TaskGraph } from '@/models/TaskGraph'
import { withTrailingSlash } from '@/utils/url'

const TASK_CONTAINER_NAME = 'planner/tasks/'

/**
 * Service for reading and writing tasks to/from a Solid Pod using Soukai
 */
export class SolidTaskService {
  private taskContainerUrl: string
  private engine: SolidEngine

  constructor(podRootUri: string, authFetch: typeof fetch) {
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
   * Fetch all tasks from the Solid Pod
   */
  async fetchTasks(): Promise<Task[]> {
    try {
      // Fetch all tasks from the container
      const tasks = await Task.from(this.taskContainerUrl).all()
      return tasks as Task[]
    } catch (err) {
      console.error('Error fetching tasks:', err)
      // If container doesn't exist, return empty array
      return []
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
  async saveTaskClass(
    taskClass: TaskClass,
    taskMap?: Map<string, TaskClass>,
  ): Promise<void> {
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
