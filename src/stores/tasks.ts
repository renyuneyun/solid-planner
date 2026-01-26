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
      const taskObjMap = createTaskClassMapFromLdoTasks(state.ldoTasks)
      return [...taskObjMap.values()]
    },
    rootTasks(state): TaskClass[] {
      const ret = Array.from(this.tasks.values()).filter(
        task => task.parent === undefined,
      )
      console.log(
        `Got 0th layer tasks: ${JSON.stringify(
          ret.map(task => {
            return [task.name, task.status]
          }),
          null,
          2,
        )}`,
      )
      return ret
    },
  },
  actions: {
    /**
     * Load tasks from an array (replaces current tasks)
     */
    loadTasks(tasks: Task[]) {
      this.ldoTasks.clear()
      tasks.forEach(task => {
        this.ldoTasks.set(task['@id']!, task)
      })
    },
    /**
     * Add a new task to local state
     * Note: Call saveToPod() separately to persist to Solid Pod
     */
    async addTask(task: Task) {
      this.ldoTasks.set(task['@id']!, task)
    },
    /**
     * Remove a task from local state
     * Note: Call saveToPod() separately to persist to Solid Pod
     */
    async removeTask(task: Task) {
      this.ldoTasks.delete(task['@id']!)
    },
    /**
     * Update a task in local state
     * Note: Call saveToPod() separately to persist to Solid Pod
     */
    async updateTask(task: Task) {
      this.ldoTasks.set(task['@id']!, task)
    },
    /**
     * Clear all tasks from local state
     */
    clearTasks() {
      this.ldoTasks.clear()
    },
    /**
     * Convert all TaskClass objects to LDO Task format
     * This is useful before saving to Pod
     */
    getTasksAsLdoArray(): Task[] {
      return Array.from(this.ldoTasks.values())
    },
  },
})
