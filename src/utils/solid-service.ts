import { bootSolidModels, SolidEngine } from 'soukai-solid'
import { setEngine } from 'soukai'
import Task from '@/models/Task'
import { TaskClass, Status } from '@/types/task'
import { withTrailingSlash } from './url'

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
   * Convert Soukai Task models to TaskClass objects
   */
  async loadTasksAsTaskClasses(): Promise<TaskClass[]> {
    const tasks = await this.fetchTasks()
    return this.convertToTaskClasses(tasks)
  }

  /**
   * Convert Soukai Task models to TaskClass objects
   */
  convertToTaskClasses(tasks: Task[]): TaskClass[] {
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

    // Second pass: establish parent-child relationships
    for (const task of tasks) {
      const taskUrl = task.url!
      const taskClass = taskMap.get(taskUrl)!

      // Handle subtasks
      if (task.subTaskUrls && task.subTaskUrls.length > 0) {
        for (const subTaskUrl of task.subTaskUrls) {
          // Convert relative URLs to absolute for lookup
          const absoluteUrl = this.toAbsoluteUrl(subTaskUrl)
          const subTaskClass = taskMap.get(absoluteUrl)
          if (subTaskClass) {
            taskClass.addSubTask(subTaskClass)
          }
        }
      }
    }

    // Return only root tasks (tasks without parents)
    return Array.from(taskMap.values()).filter(task => !task.parent)
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
   */
  async saveTaskClasses(taskClasses: TaskClass[]): Promise<void> {
    // Collect all tasks (root + subtasks)
    const allTasks: TaskClass[] = []
    const visited = new Set<string>()

    const collectTasks = (tc: TaskClass) => {
      if (visited.has(tc.id)) return
      visited.add(tc.id)
      allTasks.push(tc)

      for (const subTask of tc.subTasks) {
        collectTasks(subTask)
      }
    }

    for (const task of taskClasses) {
      collectTasks(task)
    }

    // Save tasks sequentially
    for (const taskClass of allTasks) {
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

    // Set subtask URLs (as relative paths)
    if (taskClass.subTasks.length > 0) {
      task.subTaskUrls = taskClass.subTasks
        .map(sub => sub.fullId)
        .filter((url): url is string => !!url)
        .map(url => this.toRelativeUrl(url))
    } else {
      task.subTaskUrls = undefined
    }

    // Set parent task URL if exists (as relative path)
    if (taskClass.parent?.fullId) {
      task.parentTaskUrl = this.toRelativeUrl(taskClass.parent.fullId)
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

    // Set subtask URLs (as relative paths)
    if (taskClass.subTasks.length > 0) {
      task.subTaskUrls = taskClass.subTasks
        .map(sub => sub.fullId)
        .filter((url): url is string => !!url)
        .map(url => this.toRelativeUrl(url))
    }

    // Set parent task URL if exists (as relative path)
    if (taskClass.parent?.fullId) {
      task.parentTaskUrl = this.toRelativeUrl(taskClass.parent.fullId)
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
