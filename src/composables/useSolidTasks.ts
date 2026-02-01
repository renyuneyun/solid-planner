import { ref, watch, computed } from 'vue'
import { useSessionStore } from 'solid-helper-vue'
import { useTaskStore } from '@/stores/tasks'
import {
  createSolidTaskService,
  SolidTaskService,
} from '@/storage/soukai/soukai-storage'
import { TaskClass } from '@/models/TaskClass'
import { findStorage } from '@renyuneyun/solid-helper'
import { getIndexedDBStorage } from '@/storage/local/indexeddb-storage'
import { getSyncService } from '@/storage/sync/sync-service'
import type { SyncStatus } from '@/storage/sync/sync-service'

/**
 * Composable for managing tasks with Solid Pod integration
 * Handles authentication, loading, and saving tasks with local-first sync
 */
export function useSolidTasks() {
  const sessionStore = useSessionStore()
  const taskStore = useTaskStore()

  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const solidService = ref<SolidTaskService | null>(null)
  const syncStatus = ref<SyncStatus>('idle')

  // Initialize storage services
  const localStore = getIndexedDBStorage()
  const syncService = getSyncService(localStore)

  const isAuthenticated = computed(() => !!sessionStore.webid)
  const hasService = computed(() => !!solidService.value)
  const isOnline = computed(() => syncStatus.value !== 'offline')

  // Track if this is initial load vs logout
  const isInitialLoad = ref(true)

  // Subscribe to sync status changes
  syncService.onStatusChange(status => {
    syncStatus.value = status
  })

  /**
   * Initialize the Solid service when user logs in
   */
  async function initializeService() {
    if (!sessionStore.webid || !sessionStore.session?.fetch) {
      solidService.value = null
      syncService.setRemoteService(null)
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
      syncService.setRemoteService(solidService.value)

      // Start auto-sync every minute when authenticated
      syncService.startAutoSync(60000)
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to initialize service'
      console.error('Failed to initialize Solid service:', err)
    }
  }

  /**
   * Load tasks from local storage first, then sync with remote
   * This provides instant UI updates while syncing in the background
   * Works both online and offline
   */
  async function loadFromPod() {
    isLoading.value = true
    error.value = null

    try {
      // First, load from local storage (instant, works offline)
      const localTasks = await syncService.loadLocal()
      if (localTasks.length > 0) {
        const { graph } = taskStore.convertTasksToGraph(localTasks)
        taskStore.loadTaskClasses(localTasks, graph)
      }

      // Then sync with remote in background (if authenticated)
      if (solidService.value) {
        // Wait for sync to complete
        await syncService.sync().catch(err => {
          console.error('Background sync failed:', err)
          error.value = err instanceof Error ? err.message : 'Sync failed'
        })

        // Reload from local storage after sync
        const updatedTasks = await syncService.loadLocal()
        if (updatedTasks.length > 0) {
          const { graph } = taskStore.convertTasksToGraph(updatedTasks)
          taskStore.loadTaskClasses(updatedTasks, graph)
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load tasks'
      console.error('Failed to load tasks:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Save all tasks (local-first, then sync)
   */
  async function saveToPod() {
    isLoading.value = true
    error.value = null

    try {
      // Save to local storage first (instant)
      const allTasks = Array.from(taskStore.taskMap.values())
      for (const task of allTasks) {
        await syncService.saveLocal(task)
      }

      // Then sync to remote in background
      if (solidService.value) {
        syncService.sync().catch(err => {
          console.error('Background sync failed:', err)
          error.value = err instanceof Error ? err.message : 'Sync failed'
        })
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save tasks'
      console.error('Failed to save tasks:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Add a new TaskClass (local-first, then sync)
   */
  async function addTaskAndSave(taskClass: TaskClass) {
    // Add to store
    taskStore.addTaskClass(taskClass)

    try {
      // Save to local storage first (instant)
      await syncService.saveLocal(taskClass)

      // Then sync to remote in background
      if (solidService.value) {
        syncService.sync().catch(err => {
          console.error('Background sync failed:', err)
        })
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save task'
      console.error('Failed to save task:', err)
      throw err
    }
  }

  /**
   * Update a TaskClass (local-first, then sync)
   */
  async function updateTaskAndSave(taskClass: TaskClass) {
    // Update in store
    taskStore.updateTaskClass(taskClass)

    try {
      // Save to local storage first (instant)
      await syncService.saveLocal(taskClass)

      // Then sync to remote in background
      if (solidService.value) {
        syncService.sync().catch(err => {
          console.error('Background sync failed:', err)
        })
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update task'
      console.error('Failed to update task:', err)
      throw err
    }
  }

  /**
   * Remove a TaskClass (local-first, then sync)
   */
  async function removeTaskAndSave(taskOrId: TaskClass | string) {
    const taskId = typeof taskOrId === 'string' ? taskOrId : taskOrId.id
    const task =
      typeof taskOrId === 'string' ? taskStore.taskMap.get(taskOrId) : taskOrId

    if (!task) {
      error.value = `Task ${taskId} not found`
      return
    }

    // Remove from store
    taskStore.removeTaskClass(taskId)

    try {
      // Delete from local and remote
      if (task.fullId) {
        await syncService.deleteTask(task.fullId)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete task'
      console.error('Failed to delete task:', err)
      throw err
    }
  }

  // Watch for authentication changes
  watch(
    () => sessionStore.webid,
    async (newWebId, oldWebId) => {
      if (newWebId) {
        // User logged in
        await initializeService()
        await loadFromPod()
        isInitialLoad.value = false
      } else {
        // User logged out or initial load without auth
        solidService.value = null
        syncService.setRemoteService(null)
        syncService.stopAutoSync()

        if (isInitialLoad.value) {
          // Initial load - load from local storage
          await loadFromPod()
          isInitialLoad.value = false
        }
        // Note: We don't clear tasks on logout - this is a local-first app
        // Local tasks remain accessible, only remote sync stops
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
    isOnline,
    syncStatus,

    // Methods
    initializeService,
    loadFromPod,
    saveToPod,
    addTaskAndSave,
    updateTaskAndSave,
    removeTaskAndSave,

    // Sync methods
    manualSync: () => syncService.sync(),
  }
}
