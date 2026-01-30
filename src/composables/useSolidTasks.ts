import { ref, watch, computed } from 'vue'
import { useSessionStore } from 'solid-helper-vue'
import { useTaskStore } from '@/stores/tasks'
import { createSolidTaskService, SolidTaskService } from '@/utils/solid-service'
import { TaskClass } from '@/types/task'
import { findStorage } from '@renyuneyun/solid-helper'

/**
 * Composable for managing tasks with Solid Pod integration
 * Handles authentication, loading, and saving tasks
 */
export function useSolidTasks() {
  const sessionStore = useSessionStore()
  const taskStore = useTaskStore()

  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const solidService = ref<SolidTaskService | null>(null)

  const isAuthenticated = computed(() => !!sessionStore.webid)
  const hasService = computed(() => !!solidService.value)

  /**
   * Initialize the Solid service when user logs in
   */
  async function initializeService() {
    if (!sessionStore.webid || !sessionStore.session?.fetch) {
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
    }
  }

  /**
   * Load tasks from the Solid Pod
   */
  async function loadFromPod() {
    if (!solidService.value) {
      error.value = 'Not connected to Solid Pod'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const taskClasses = await solidService.value.loadTasksAsTaskClasses()
      taskStore.loadTaskClasses(taskClasses)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load tasks'
      console.error('Failed to load tasks:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Save all tasks to the Solid Pod
   */
  async function saveToPod() {
    if (!solidService.value) {
      error.value = 'Not connected to Solid Pod'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      // Get all root TaskClass objects
      const taskClasses = taskStore.rootTasks

      // Save to Pod
      await solidService.value.saveTaskClasses(taskClasses)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save tasks'
      console.error('Failed to save tasks:', err)
      throw err // Re-throw so caller can handle
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Add a new TaskClass and save to Pod (incremental)
   */
  async function addTaskAndSave(taskClass: TaskClass) {
    if (!solidService.value) {
      error.value = 'Not connected to Solid Pod'
      return
    }

    taskStore.addTaskClass(taskClass)

    try {
      await solidService.value.saveTaskClass(taskClass)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save task'
      console.error('Failed to save task:', err)
      throw err
    }
  }

  /**
   * Update a TaskClass and save to Pod (incremental)
   */
  async function updateTaskAndSave(taskClass: TaskClass) {
    if (!solidService.value) {
      error.value = 'Not connected to Solid Pod'
      return
    }

    taskStore.updateTaskClass(taskClass)

    try {
      await solidService.value.saveTaskClass(taskClass)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update task'
      console.error('Failed to update task:', err)
      throw err
    }
  }

  /**
   * Remove a TaskClass and delete from Pod (incremental)
   */
  async function removeTaskAndSave(taskClass: TaskClass) {
    if (!solidService.value) {
      error.value = 'Not connected to Solid Pod'
      return
    }

    taskStore.removeTaskClass(taskClass)

    try {
      if (taskClass.fullId) {
        await solidService.value.deleteTask(taskClass.fullId)
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
    async newWebId => {
      if (newWebId) {
        await initializeService()
        await loadFromPod()
      } else {
        // User logged out - clear service and tasks
        solidService.value = null
        taskStore.clearTasks()
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
    loadFromPod,
    saveToPod,
    addTaskAndSave,
    updateTaskAndSave,
    removeTaskAndSave,
  }
}
