import { ref, computed, watch, onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { TaskClass } from '@/models/TaskClass'
import { useIndexedDBStorage } from './useIndexedDBStorage'
import { useSolidStorage } from './useSolidStorage'
import { getIndexedDBStorage } from '@/storage/local/indexeddb-storage'
import { getSyncService } from '@/storage/sync/sync-service'
import type { SyncStatus } from '@/storage/sync/sync-service'

const AUTO_SYNC_INTERVAL = 1000 * 60 * 10; // 10 minutes

/**
 * Composable for managing tasks with local-first architecture
 * Orchestrates between IndexedDB local storage and Solid Pod remote storage
 * Provides automatic syncing when authenticated, offline support when not
 */
export function useLocalFirstTasks() {
  const taskStore = useTaskStore()

  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const syncStatus = ref<SyncStatus>('idle')

  // Track if this is initial load vs logout
  const isInitialLoad = ref(true)

  // Initialize storage services
  const localStorage = useIndexedDBStorage()
  const solidStorage = useSolidStorage()

  // Create sync service (using raw IndexedDB storage for sync internals)
  const localStore = getIndexedDBStorage()
  const syncService = getSyncService(localStore)

  const isAuthenticated = computed(() => solidStorage.isAuthenticated.value)
  const isOnline = computed(() => syncStatus.value !== 'offline')

  // Track in-flight local saves so the sync reload doesn't wipe optimistic updates
  let pendingLocalSaves = 0

  // Subscribe to sync status changes; reload store from local after every successful sync
  const unsubscribeStatusChange = syncService.onStatusChange(async status => {
    syncStatus.value = status
    if (status === 'idle' && solidStorage.getService() && pendingLocalSaves === 0) {
      try {
        const updatedTasks = await syncService.loadLocal()
        if (updatedTasks.length > 0) {
          const { graph } = taskStore.convertTasksToGraph(updatedTasks)
          taskStore.loadTaskClasses(updatedTasks, graph)
        }
      } catch (err) {
        console.error('Failed to reload tasks after sync:', err)
      }
    }
  })
  onUnmounted(() => unsubscribeStatusChange())

  // Watch for Solid service initialization and update sync service
  watch(
    () => solidStorage.getService(),
    async newService => {
      syncService.setRemoteService(newService)
      if (newService) {
        // Start auto-sync every AUTO_SYNC_INTERVAL when authenticated
        syncService.startAutoSync(AUTO_SYNC_INTERVAL)
        // Trigger an immediate sync now that the service is ready.
        // loadTasks() may have already run (before the service was available),
        // so we explicitly sync and reload the store here.
        await syncService.sync().catch(err => {
          console.error('Initial sync after login failed:', err)
        })
      } else {
        syncService.stopAutoSync()
      }
    },
    { immediate: true },
  )

  /**
   * Load tasks from local storage.
   * Syncing is handled separately by the service watcher and auto-sync;
   * the onStatusChange callback reloads the store after each sync completes.
   */
  async function loadTasks() {
    isLoading.value = true
    error.value = null

    try {
      const localTasks = await syncService.loadLocal()
      if (localTasks.length > 0) {
        const { graph } = taskStore.convertTasksToGraph(localTasks)
        taskStore.loadTaskClasses(localTasks, graph)
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
  async function saveTasks() {
    isLoading.value = true
    error.value = null

    try {
      // Save to local storage first (instant)
      const allTasks = Array.from(taskStore.taskMap.values())
      for (const task of allTasks) {
        await syncService.saveLocal(task)
      }

      // Then sync to remote in background
      if (solidStorage.getService()) {
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
  async function addTask(taskClass: TaskClass) {
    // Optimistic update: show in UI immediately
    taskStore.addTaskClass(taskClass)

    pendingLocalSaves++
    try {
      await syncService.saveLocal(taskClass)

      // Sync to remote in background
      if (solidStorage.getService()) {
        syncService.sync().catch(err => {
          console.error('Background sync failed:', err)
        })
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save task'
      console.error('Failed to save task:', err)
      throw err
    } finally {
      pendingLocalSaves--
    }
  }

  /**
   * Update a TaskClass (local-first, then sync)
   */
  async function updateTask(taskClass: TaskClass) {
    // Optimistic update: show in UI immediately
    taskStore.updateTaskClass(taskClass)

    pendingLocalSaves++
    try {
      await syncService.saveLocal(taskClass)

      // Then sync to remote in background
      if (solidStorage.getService()) {
        syncService.sync().catch(err => {
          console.error('Background sync failed:', err)
        })
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update task'
      console.error('Failed to update task:', err)
      throw err
    } finally {
      pendingLocalSaves--
    }
  }

  /**
   * Remove a TaskClass (local-first, then sync)
   */
  async function removeTask(taskOrId: TaskClass | string) {
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

  /**
   * Manually trigger a sync operation
   */
  async function manualSync() {
    return syncService.sync()
  }

  // Initialize on first use
  // Initialize on first use
  watch(
    isAuthenticated,
    async newAuth => {
      if (newAuth) {
        // User logged in - load tasks with sync
        await loadTasks()
        isInitialLoad.value = false
      } else if (isInitialLoad.value) {
        // Initial load without auth - load from local only
        await loadTasks()
        isInitialLoad.value = false
      }
      // Note: We don't clear tasks on logout - this is a local-first app
      // Local tasks remain accessible, only remote sync stops
    },
    { immediate: true },
  )

  return {
    // State
    isLoading,
    error,
    isAuthenticated,
    isOnline,
    syncStatus,

    // Methods
    loadTasks,
    saveTasks,
    addTask,
    updateTask,
    removeTask,
    manualSync,

    // Storage composables (for advanced use)
    localStorage,
    solidStorage,
  }
}
