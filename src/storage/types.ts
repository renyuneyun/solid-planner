import type { TaskClass } from '@/models/TaskClass'
import type { TaskGraph } from '@/models/TaskGraph'

/**
 * Storage adapter interface for task persistence
 * Implementations can use Soukai+Solid, local storage, IndexedDB, etc.
 */
export interface TaskStorageAdapter {
  /**
   * Load all tasks from storage
   * Returns TaskClass instances and a TaskGraph with relationships
   */
  loadTasks(): Promise<{
    taskClasses: TaskClass[]
    graph: TaskGraph
  }>

  /**
   * Save a single task (incremental save)
   */
  saveTask(task: TaskClass): Promise<void>

  /**
   * Save multiple tasks (bulk save)
   */
  saveTasks(tasks: TaskClass[]): Promise<void>

  /**
   * Delete a task and its descendants
   */
  deleteTask(taskId: string): Promise<void>

  /**
   * Get the storage location/URL (if applicable)
   */
  getStorageLocation?(): string
}
