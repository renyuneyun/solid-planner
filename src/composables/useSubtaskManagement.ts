import { computed, type Ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { TaskClass } from '@/models/TaskClass'
import { getAllDescendantTasks } from '@/models/task-operations'

/**
 * Minimal interface for task operations needed by subtask management
 */
interface TaskOperations {
  // eslint-disable-next-line no-unused-vars
  updateTask: (task: TaskClass) => Promise<void>
}

/**
 * Composable for managing subtasks within a parent task
 * Handles adding and removing subtasks, with automatic persistence
 */
export function useSubtaskManagement(
  selectedTask: Ref<TaskClass | null>,
  taskOperations?: Ref<TaskOperations | null>,
) {
  const store = useTaskStore()

  /**
   * Calculate available task list for adding as subtasks
   * Excludes the current task and all its descendants to prevent circular dependencies
   */
  const availableTasksForSubtask = computed(() => {
    if (!selectedTask.value) return []

    // Get all descendant task IDs under current task (including current task)
    const excludeIds = new Set<string>([selectedTask.value.id])

    // Add all descendants
    const descendants = getAllDescendantTasks(selectedTask.value.id, store)
    for (const desc of descendants) {
      excludeIds.add(desc.id)
    }

    // Get all tasks and filter out excluded ones
    return store.tasks.filter(task => !excludeIds.has(task.id))
  })

  /**
   * Add a task as a subtask to the currently selected task
   */
  async function addSubtask(subtaskId: string) {
    if (!selectedTask.value) return

    // Find the task to add as subtask
    const taskToAdd = store.taskMap.get(subtaskId)
    if (!taskToAdd) return

    // Move task to be a child of selected task (use store action to ensure consistency)
    store.moveTask(subtaskId, selectedTask.value.id)

    // Save both parent and child (incremental)
    if (taskOperations?.value) {
      try {
        await taskOperations.value.updateTask(selectedTask.value)
        await taskOperations.value.updateTask(taskToAdd)
      } catch (error) {
        console.error('Failed to save subtask relationship:', error)
      }
    }
  }

  /**
   * Remove a subtask from the currently selected parent task
   */
  async function removeSubtask(subtaskId: string) {
    if (!selectedTask.value) return

    const subtask = store.taskMap.get(subtaskId)
    if (!subtask) return

    // Remove the subtask from the currently selected task (parent)
    store.moveTask(subtaskId, undefined)

    // Save both parent and child (incremental)
    if (taskOperations?.value) {
      try {
        await taskOperations.value.updateTask(selectedTask.value)
        await taskOperations.value.updateTask(subtask)
      } catch (error) {
        console.error('Failed to save subtask removal:', error)
      }
    }
  }

  return {
    availableTasksForSubtask,
    addSubtask,
    removeSubtask,
  }
}
