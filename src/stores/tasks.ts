import { defineStore } from 'pinia'
import { Task } from '@/ldo/task.typings'
import { Status, TaskClass, createTaskClassMapFromLdoTasks } from '@/types/task'
import dummyTaskUrl from '@/data/mock-tasks.ttl?url'
import { parseRdf } from 'ldo'
import { URL_EX, NS_SP } from '@/constants/ns'
import { TaskShapeType } from '@/ldo/task.shapeTypes'
import dataFactory from '@rdfjs/data-model'
import { RDF } from '@inrupt/vocab-common-rdf'

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
    async fetchTasks(containerUri?: string) {
      // Implementation with typed Solid client
      const response = await fetch(dummyTaskUrl)
      const text = await response.text()
      console.log(`Got tasks Turtle: ${text}`)

      const ldoDataset = await parseRdf(text, {
        baseIRI: URL_EX,
      })

      const tasks = ldoDataset
        .usingType(TaskShapeType)
        .matchSubject(RDF.type, NS_SP('Task'))

      console.log(`Got ldoTasks: ${JSON.stringify(tasks, null, 2)}`)

      tasks.forEach(task => {
        this.ldoTasks.set(task['@id']!, task)
      })
    },
    /**
     * TODO: Implement
     * @param task
     */
    async addTask(task: Task) {
      this.ldoTasks.set(task['@id']!, task)
    },
    /**
     * TODO: Implement
     * @param task
     */
    async removeTask(task: Task) {
      this.ldoTasks.delete(task['@id']!)
    },
    /**
     * TODO: Implement
     * @param task
     */
    async updateTask(task: Task) {
      this.ldoTasks.set(task['@id']!, task)
    },
  },
})
