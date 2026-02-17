import { ref, computed, watch, onMounted } from 'vue'
import { useSessionStore } from 'solid-helper-vue'
import {
  createSolidTaskService,
  type SolidTaskService,
} from '@/storage/soukai/soukai-storage'
import type { TaskClass } from '@/models/TaskClass'
import { findStorage } from '@renyuneyun/solid-helper'

/**
 * Composable for managing tasks with Solid Pod storage
 * Handles authentication and remote storage operations
 */
export function useSolidStorage() {
  let sessionStore: ReturnType<typeof useSessionStore> | null = null

  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const solidService = ref<SolidTaskService | null>(null)

  const isAuthenticated = computed(() => !!sessionStore?.webid)
  const hasService = computed(() => !!solidService.value)

  /**
   * Initialize the Solid service when user logs in
   */
  async function initializeService() {
    if (!sessionStore?.webid || !sessionStore?.session?.fetch) {
      solidService.value = null
      return
    }

    try {
      const storageUrl = await findStorage(sessionStore.webid)
      if (!storageUrl) {
        throw new Error('Could not find storage for WebID')
      }

      solidService.value = createSolidTaskService(
        storageUrl,
        sessionStore.session.fetch,
      )
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to initialize service'
      console.error('Failed to initialize Solid service:', err)
      throw err
    }
  }

  /**
   * Load all tasks from Solid Pod
   */
  async function loadRemote(): Promise<TaskClass[]> {
    if (!solidService.value) {
      throw new Error('Solid service not initialized')
    }

    isLoading.value = true
    error.value = null

    try {
      const { taskClasses } = await solidService.value.loadTasksAsTaskClasses()
      return taskClasses
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to load remote tasks'
      console.error('Failed to load from Solid Pod:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Save a task to Solid Pod
   */
  async function saveRemote(task: TaskClass): Promise<void> {
    if (!solidService.value) {
      throw new Error('Solid service not initialized')
    }

    error.value = null

    try {
      await solidService.value.saveTaskClass(task)
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to save remote task'
      console.error('Failed to save to Solid Pod:', err)
      throw err
    }
  }

  /**
   * Save multiple tasks to Solid Pod
   */
  async function saveRemoteBatch(tasks: TaskClass[]): Promise<void> {
    if (!solidService.value) {
      throw new Error('Solid service not initialized')
    }

    error.value = null

    try {
      await solidService.value.saveTaskClasses(tasks)
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to save remote tasks'
      console.error('Failed to save batch to Solid Pod:', err)
      throw err
    }
  }

  /**
   * Delete a task from Solid Pod
   */
  async function deleteRemote(taskId: string): Promise<void> {
    if (!solidService.value) {
      throw new Error('Solid service not initialized')
    }

    error.value = null

    try {
      await solidService.value.deleteTask(taskId)
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to delete remote task'
      console.error('Failed to delete from Solid Pod:', err)
      throw err
    }
  }

  /**
   * Get the Solid service instance
   * Used by sync service for direct access
   */
  function getService() {
    return solidService.value
  }

  // Initialize store on mount
  onMounted(() => {
    sessionStore = useSessionStore()
  })

  // Watch for authentication changes and initialize service
  watch(
    () => sessionStore?.webid,
    async newWebId => {
      if (newWebId) {
        await initializeService()
      } else {
        solidService.value = null
      }
    },
    { immediate: true },
  )

  return {
    // State
    isLoading,
    error,
    isAuthenticated,
    hasService,

    // Methods
    initializeService,
    loadRemote,
    saveRemote,
    saveRemoteBatch,
    deleteRemote,
    getService,
  }
}
