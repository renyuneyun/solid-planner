import { ref } from 'vue'
import { getIndexedDBStorage } from '@/storage/local/indexeddb-storage'
import { TaskClass, Status } from '@/models/TaskClass'

/**
 * Composable for managing tasks with IndexedDB local storage
 * Provides offline-capable task storage
 */
export function useIndexedDBStorage() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const localStore = getIndexedDBStorage()

  /**
   * Load all tasks from IndexedDB and convert to TaskClass
   */
  async function loadLocal(): Promise<TaskClass[]> {
    isLoading.value = true
    error.value = null

    try {
      const dbTasks = await localStore.getAllTasks()

      // Convert database format to TaskClass instances
      return dbTasks.map(dbTask => {
        const task = new TaskClass({
          id: extractIdFromUrl(dbTask.url),
          name: dbTask.title,
          description: dbTask.description,
          addedDate: dbTask.dateCreated
            ? new Date(dbTask.dateCreated)
            : new Date(),
          startDate: dbTask.startDate ? new Date(dbTask.startDate) : undefined,
          endDate: dbTask.endDate ? new Date(dbTask.endDate) : undefined,
          status: dbTask.status as Status | undefined,
        })
        task.fullId = dbTask.url
        if (dbTask.subTaskUrls) {
          task.childIds = dbTask.subTaskUrls
        }
        if (dbTask.parentTaskUrl) {
          task.parentId = dbTask.parentTaskUrl
        }
        return task
      })
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to load local tasks'
      console.error('Failed to load from IndexedDB:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Extract task ID from URL
   */
  function extractIdFromUrl(url: string): string {
    // Handle both full URLs and simple IDs
    if (url.startsWith('task-')) {
      return url.substring(5) // Remove 'task-' prefix
    }
    const parts = url.split('/')
    return parts[parts.length - 1]
  }

  /**
   * Save a task to IndexedDB
   */
  async function saveLocal(task: TaskClass): Promise<void> {
    error.value = null

    try {
      await localStore.saveTask({
        url: task.fullId || `task-${task.id}`,
        title: task.name,
        description: task.description,
        dateCreated: task.addedDate,
        startDate: task.startDate,
        endDate: task.endDate,
        status: task.status,
        subTaskUrls: task.childIds,
        parentTaskUrl: task.parentId,
      })
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to save local task'
      console.error('Failed to save to IndexedDB:', err)
      throw err
    }
  }

  /**
   * Save multiple tasks to IndexedDB
   */
  async function saveLocalBatch(tasks: TaskClass[]): Promise<void> {
    error.value = null

    try {
      for (const task of tasks) {
        await localStore.saveTask({
          url: task.fullId || `task-${task.id}`,
          title: task.name,
          description: task.description,
          dateCreated: task.addedDate,
          startDate: task.startDate,
          endDate: task.endDate,
          status: task.status,
          subTaskUrls: task.childIds,
          parentTaskUrl: task.parentId,
        })
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to save local tasks'
      console.error('Failed to save batch to IndexedDB:', err)
      throw err
    }
  }

  /**
   * Delete a task from IndexedDB
   */
  async function deleteLocal(taskId: string): Promise<void> {
    error.value = null

    try {
      await localStore.deleteTask(taskId)
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to delete local task'
      console.error('Failed to delete from IndexedDB:', err)
      throw err
    }
  }

  return {
    // State
    isLoading,
    error,

    // Methods
    loadLocal,
    saveLocal,
    saveLocalBatch,
    deleteLocal,
  }
}
