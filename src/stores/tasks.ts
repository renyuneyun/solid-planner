import { defineStore } from 'pinia'
import { Status, TaskClass } from '@/types/task'

function existsOrCompare(v1: any, v2: any, fn: (v1: any, v2: any) => number) {
  if (v1 && v2 === undefined) return 1
  if (v1 === undefined && v2) return -1
  if (v1 === undefined && v2 === undefined) return undefined
  return fn(v1, v2)
}

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    taskClassMap: new Map<string, TaskClass>(),
    loading: false,
    error: null as string | null,
  }),
  getters: {
    sortedTasks(state): TaskClass[] {
      return [...this.tasks].sort(
        (a, b) =>
          existsOrCompare(
            a.endDate,
            b.endDate,
            (v1, v2) => v1.getTime() - v2.getTime(),
          ) ?? 0,
      )
    },
    overdueTasks(): TaskClass[] {
      return this.tasks.filter(task =>
        task.endDate
          ? new Date(task.endDate) < new Date() &&
            task.status !== Status.COMPLETED &&
            task.status !== Status.IGNORED
          : false,
      )
    },
    tasks(state): TaskClass[] {
      return [...state.taskClassMap.values()]
    },
    rootTasks(state): TaskClass[] {
      const ret = this.tasks.filter(task => task.parent === undefined)
      return ret
    },
  },
  actions: {
    /**
     * Load TaskClass objects (replaces current tasks)
     */
    loadTaskClasses(taskClasses: TaskClass[]) {
      this.taskClassMap.clear()

      // Collect all tasks (root + subtasks) recursively
      const visited = new Set<string>()

      const collectTasks = (tc: TaskClass) => {
        if (visited.has(tc.id)) return
        visited.add(tc.id)
        this.taskClassMap.set(tc.id, tc)

        for (const subTask of tc.subTasks) {
          collectTasks(subTask)
        }
      }

      for (const task of taskClasses) {
        collectTasks(task)
      }
    },

    /**
     * Add a new TaskClass to local state
     * Note: Call saveToPod() separately to persist to Solid Pod
     */
    addTaskClass(taskClass: TaskClass) {
      this.taskClassMap.set(taskClass.id, taskClass)
    },

    /**
     * Remove a TaskClass from local state
     * Note: Call saveToPod() separately to persist to Solid Pod
     */
    removeTaskClass(taskClass: TaskClass) {
      this.taskClassMap.delete(taskClass.id)

      // Also remove all subtasks recursively
      const removeSubtasks = (tc: TaskClass) => {
        for (const subTask of tc.subTasks) {
          this.taskClassMap.delete(subTask.id)
          removeSubtasks(subTask)
        }
      }
      removeSubtasks(taskClass)
    },

    /**
     * Update a TaskClass in local state (it's already reactive, so just trigger update)
     * Note: Call saveToPod() separately to persist to Solid Pod
     */
    updateTaskClass(taskClass: TaskClass) {
      // TaskClass is already reactive, just ensure it's in the map
      this.taskClassMap.set(taskClass.id, taskClass)
    },

    /**
     * Clear all tasks from local state
     */
    clearTasks() {
      this.taskClassMap.clear()
    },
  },
})
