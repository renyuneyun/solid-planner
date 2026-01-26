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
        sessionStore.session.fetch
      )

      // Ensure the resource exists before any read/write
      await solidService.value.ensureResourceExists()
      console.log('Solid service initialized:', storageUrl)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize service'
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
      const tasks = await solidService.value.fetchTasks()
      taskStore.loadTasks(tasks)
      console.log(`Loaded ${tasks.length} tasks from Pod`)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load tasks'
      console.error('Failed to load tasks:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Save all tasks to the Solid Pod
   * Converts TaskClass objects to LDO format before saving
   */
  async function saveToPod() {
    if (!solidService.value) {
      error.value = 'Not connected to Solid Pod'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      // Ensure the resource exists before writing
      await solidService.value.ensureResourceExists()

      // Get all root TaskClass objects
      const taskClasses = taskStore.rootTasks

      // Save to Pod
      await solidService.value.saveTaskClasses(taskClasses)
      console.log(`Saved ${taskClasses.length} tasks to Pod`)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save tasks'
      console.error('Failed to save tasks:', err)
      throw err // Re-throw so caller can handle
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Add a new TaskClass and save to Pod
   */
  async function addTaskAndSave(taskClass: TaskClass) {
    const ldoTask = taskClass.toLdoTask()
    await taskStore.addTask(ldoTask)
    await saveToPod()
  }

  /**
   * Update a TaskClass and save to Pod
   */
  async function updateTaskAndSave(taskClass: TaskClass) {
    const ldoTask = taskClass.toLdoTask()
    await taskStore.updateTask(ldoTask)
    await saveToPod()
  }

  /**
   * Remove a TaskClass and save to Pod
   */
  async function removeTaskAndSave(taskClass: TaskClass) {
    const ldoTask = taskClass.toLdoTask()
    await taskStore.removeTask(ldoTask)
    await saveToPod()
  }

  /**
   * Ensure the tasks resource exists on the Pod
   */
  async function ensureResourceExists() {
    if (!solidService.value) {
      error.value = 'Not connected to Solid Pod'
      return
    }

    try {
      await solidService.value.ensureResourceExists()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to ensure resource exists'
      console.error('Failed to ensure resource exists:', err)
    }
  }

  // Watch for authentication changes
  watch(
    () => sessionStore.webid,
    async (newWebId) => {
      if (newWebId) {
        await initializeService()
        await loadFromPod()
      } else {
        // User logged out - clear service and tasks
        solidService.value = null
        taskStore.clearTasks()
      }
    },
    { immediate: true }
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
    ensureResourceExists,
  }
}
