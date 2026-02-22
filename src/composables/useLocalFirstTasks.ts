import { ref, computed, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { TaskClass } from '@/models/TaskClass'
import { useIndexedDBStorage } from './useIndexedDBStorage'
import { getIndexedDBStorage } from '@/storage/local/indexeddb-storage'
import { getSyncService } from '@/storage/sync/sync-service'
import type { SyncStatus } from '@/storage/sync/sync-service'

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

  // FIXME: Monkey-patch to circumvent solid storage initialization issues in some environments
  // Error example:
  ///  Uncaught TypeError: undefined is not a non-null object
  ///  requireContainerHandlerType ContainerHandlerType.js:3
  ///  requireEntryHandlerContainer EntryHandlerContainer.js:8
  ///  requireUtil Util.js:7
  ///  <anonymous> EntryHandlerPredicate.js:6
  ///  ContainerHandlerType.js:3:29
  // This can happen in static sites (e.g. vite build), when using this file (which imports `useSolidStorage.ts`, which in turn imports `solid-helper-vue`) at the top level; while using `useSolidStorage.ts` directly (i.e. not through this file's second-order wrapping) won't cause this issue.
  // By deferring the import and initialization of `useSolidStorage` until it's actually needed (e.g. when the component using this composable is mounted), we can avoid triggering the problematic code during module load, allowing the app to function in local-first mode even though the issue exists. This is a temporary workaround until we can fix the underlying issues, maybe with solid-client or maybe with solid-helper-vue. After fixing, we can remove this and directly import useSolidStorage at the top, and initialize it directly in this composable.

  // Defer loading useSolidStorage to avoid initializing on module load
  const solidStorageRef = ref<any>(null)

  const initSolidStoragePromise = (async () => {
    try {
      const { useSolidStorage } = await import('./useSolidStorage')
      const ss = useSolidStorage()
      solidStorageRef.value = ss
      return ss
    } catch (err) {
      // Solid Pod integration failed - app will continue in local-first mode
      // This is expected if solid-client library has initialization issues
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          'Solid storage not available, using local-only mode:',
          err,
        )
      }
      // Set a fallback mock version
      const mock = {
        isAuthenticated: { value: false },
        getService: () => null,
      }
      solidStorageRef.value = mock
      return mock
    }
  })()

  // Create sync service (using raw IndexedDB storage for sync internals)
  const localStore = getIndexedDBStorage()
  const syncService = getSyncService(localStore)

  const isAuthenticated = computed(() => {
    const ss = solidStorageRef.value
    if (!ss) return false
    return ss.isAuthenticated.value
  })
  const isOnline = computed(() => syncStatus.value !== 'offline')

  // Subscribe to sync status changes
  syncService.onStatusChange(status => {
    syncStatus.value = status
  })

  // Watch for Solid service initialization and update sync service (once loaded)
  initSolidStoragePromise.then(ss => {
    if (ss) {
      watch(
        () => ss.getService(),
        newService => {
          syncService.setRemoteService(newService)
          if (newService) {
            // Start auto-sync every minute when authenticated
            syncService.startAutoSync(60000)
          } else {
            syncService.stopAutoSync()
          }
        },
        { immediate: true },
      )
    }
  })

  /**
   * Load tasks from local storage first, then sync with remote
   * This provides instant UI updates while syncing in the background
   * Works both online and offline
   */
  async function loadTasks() {
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
      const ss = solidStorageRef.value
      if (ss && ss.getService()) {
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
      const ss = solidStorageRef.value
      if (ss && ss.getService()) {
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
    // Add to store
    taskStore.addTaskClass(taskClass)

    try {
      // Save to local storage first (instant)
      await syncService.saveLocal(taskClass)

      // Then sync to remote in background
      const ss = solidStorageRef.value
      if (ss && ss.getService()) {
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
  async function updateTask(taskClass: TaskClass) {
    // Update in store
    taskStore.updateTaskClass(taskClass)

    try {
      // Save to local storage first (instant)
      await syncService.saveLocal(taskClass)

      // Then sync to remote in background
      const ss = solidStorageRef.value
      if (ss && ss.getService()) {
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
    solidStorage: solidStorageRef,
  }
}
