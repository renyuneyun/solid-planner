import { defineStore } from 'pinia'
import { Task } from '@/ldo/task.typings'
import { Status, TaskClass, createTaskClassMapFromLdoTasks } from '@/types/task'
import dataFactory from '@rdfjs/data-model'

const { namedNode } = dataFactory

function existsOrCompare(v1: any, v2: any, fn: (v1: any, v2: any) => number) {
  if (v1 && v2 === undefined) return 1
  if (v1 === undefined && v2) return -1
  if (v1 === undefined && v2 === undefined) return undefined
  return fn(v1, v2)
}

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    ldoTasks: new Map<string, Task>(),
    cachedTaskClassMap: new Map<string, TaskClass>(),
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
      // If the number of tasks changed, rebuild the cache
      if (state.cachedTaskClassMap.size !== state.ldoTasks.size) {
        state.cachedTaskClassMap.clear()
        const taskObjMap = createTaskClassMapFromLdoTasks(state.ldoTasks)

        taskObjMap.forEach((task, key) => {
          state.cachedTaskClassMap.set(key, task)
        })
      }
      return [...state.cachedTaskClassMap.values()]
    },
    rootTasks(state): TaskClass[] {
      const ret = this.tasks.filter(task => task.parent === undefined)
      return ret
    },
  },
  actions: {
    /**
     * Load tasks from an array (replaces current tasks)
     */
    loadTasks(tasks: Task[]) {
      this.ldoTasks.clear()
      this.cachedTaskClassMap.clear()
      tasks.forEach(task => {
        const taskId = task['@id']
        if (!taskId) {
          console.warn('Task missing @id, skipping:', task)
          return
        }
        try {
          // Create a plain object copy to avoid proxy/reactivity issues
          const plainTask = JSON.parse(JSON.stringify(task)) as Task
          this.ldoTasks.set(taskId, plainTask)
        } catch (err) {
          console.error('Error loading task:', taskId, err)
          console.error('Problematic task:', task)
        }
      })
    },
    /**
     * Add a new task to local state
     * Note: Call saveToPod() separately to persist to Solid Pod
     */
    async addTask(task: Task) {
      this.cachedTaskClassMap.clear()
      this.ldoTasks.set(task['@id']!, task)
    },
    /**
     * Remove a task from local state
     * Note: Call saveToPod() separately to persist to Solid Pod
     */
    async removeTask(task: Task) {
      this.cachedTaskClassMap.clear()
      this.ldoTasks.delete(task['@id']!)
    },
    /**
     * Update a task in local state
     * Note: Call saveToPod() separately to persist to Solid Pod
     */
    async updateTask(task: Task) {
      this.cachedTaskClassMap.clear()
      this.ldoTasks.set(task['@id']!, task)
    },
    /**
     * Clear all tasks from local state
     */
    clearTasks() {
      this.ldoTasks.clear()
      this.cachedTaskClassMap.clear()
    },
    /**
     * Convert all TaskClass objects to LDO Task format
     * This is useful before saving to Pod
     */
    getTasksAsLdoArray(): Task[] {
      return Array.from(this.ldoTasks.values())
    },
    /**
     * Rebuild all parent-child relationships from ldoTasks
     * Call this after making modifications to ensure consistency
     */
    rebuildRelationships() {
      const taskObjMap = createTaskClassMapFromLdoTasks(this.ldoTasks)
      taskObjMap.forEach(task => {
        task.fillRefsFromMap(taskObjMap)
      })
      // Clear cache to force re-creation from updated ldoTasks
      this.cachedTaskClassMap.clear()
      // Force reactivity by reassigning
      this.ldoTasks = new Map(this.ldoTasks)
    },
  },
})
