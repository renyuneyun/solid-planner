import { computed } from 'vue'
import { useLocalFirstTasks } from './useLocalFirstTasks'
import type { TaskClass } from '@/models/TaskClass'

/**
 * Compatibility wrapper for useSolidTasks
 * @deprecated Use useLocalFirstTasks instead for better interface clarity
 * 
 * This composable maintains backward compatibility while delegating
 * to the new useLocalFirstTasks interface. It provides the same API
 * but is now just a thin wrapper.
 */
export function useSolidTasks() {
  const localFirst = useLocalFirstTasks()

  // Map new interface to old names for compatibility
  const hasService = computed(() => localFirst.solidStorage.hasService.value)

  return {
    // State (mapped from useLocalFirstTasks)
    isLoading: localFirst.isLoading,
    error: localFirst.error,
    isAuthenticated: localFirst.isAuthenticated,
    hasService,
    isOnline: localFirst.isOnline,
    syncStatus: localFirst.syncStatus,

    // Methods (mapped with old names)
    initializeService: () => localFirst.solidStorage.initializeService(),
    loadFromPod: localFirst.loadTasks,
    saveToPod: localFirst.saveTasks,
    addTaskAndSave: (task: TaskClass) => localFirst.addTask(task),
    updateTaskAndSave: (task: TaskClass) => localFirst.updateTask(task),
    removeTaskAndSave: (taskOrId: TaskClass | string) => localFirst.removeTask(taskOrId),

    // Sync methods
    manualSync: localFirst.manualSync,
  }
}
