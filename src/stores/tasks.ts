import { defineStore } from 'pinia'
import { Status, TaskClass } from '@/models/TaskClass'
import { TaskGraph } from '@/models/TaskGraph'

function existsOrCompare(v1: any, v2: any, fn: (v1: any, v2: any) => number) {
  if (v1 && v2 === undefined) return 1
  if (v1 === undefined && v2) return -1
  if (v1 === undefined && v2 === undefined) return undefined
  return fn(v1, v2)
}

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    taskMap: new Map<string, TaskClass>(),
    graph: new TaskGraph(), // Initialize empty graph immediately
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
      return [...state.taskMap.values()]
    },
    rootTasks(state): TaskClass[] {
      const rootIds = state.graph.getRootIds()
      return rootIds
        .map(id => state.taskMap.get(id))
        .filter((task): task is TaskClass => !!task)
    },
  },
  actions: {
    /**
     * Load TaskClass objects with their relationship graph
     * Replaces current tasks and graph
     */
    loadTaskClasses(taskClasses: TaskClass[], graph: TaskGraph) {
      this.taskMap.clear()

      // Add all tasks to map first
      for (const task of taskClasses) {
        this.taskMap.set(task.id, task)
      }

      // Rebuild graph from task data (parentId/childIds are source of truth)
      this.graph = graph
      this.graph.rebuildFromTasks(taskClasses)

      // Set graph reference for all tasks (for optional syncing)
      for (const task of this.taskMap.values()) {
        task.setGraph(this.graph)
      }
    },

    /**
     * Recursively add task and all descendants to the map
     */
    addTaskToMapRecursive(task: TaskClass) {
      if (!this.taskMap.has(task.id)) {
        this.taskMap.set(task.id, task)
      }
    },

    /**
     * Add a new TaskClass to the store (not as a child of anything yet)
     */
    addTaskClass(taskClass: TaskClass) {
      taskClass.setGraph(this.graph)
      this.taskMap.set(taskClass.id, taskClass)
      // Ensure it's registered as a root task in the graph
      this.graph.setParent(taskClass.id, undefined)
    },

    /**
     * Add a task as a child of another task
     */
    addSubTask(parentId: string, childTask: TaskClass) {
      const parent = this.taskMap.get(parentId)
      if (!parent) {
        console.warn(`Parent task ${parentId} not found`)
        return
      }

      childTask.setGraph(this.graph)
      this.taskMap.set(childTask.id, childTask)

      // Update TaskClass relationships (source of truth)
      childTask.setParentId(parentId)
      parent.addChildId(childTask.id)
    },

    /**
     * Remove a task and all its descendants
     */
    removeTaskClass(taskId: string) {
      const task = this.taskMap.get(taskId)
      if (!task) return

      // Get all descendants before removal
      const descendantIds = this.graph.getAllDescendantIds(taskId)

      // Remove from parent's childIds
      if (task.parentId) {
        const parent = this.taskMap.get(task.parentId)
        if (parent) {
          parent.removeChildId(taskId)
        }
      }

      // Remove all descendants from map
      for (const id of descendantIds) {
        this.taskMap.delete(id)
      }

      // Clean up graph
      this.graph.removeTaskAndDescendants(taskId)
    },

    /**
     * Update a TaskClass in the store
     */
    updateTaskClass(taskClass: TaskClass) {
      this.taskMap.set(taskClass.id, taskClass)
    },

    /**
     * Move a task under a new parent
     */
    moveTask(taskId: string, newParentId: string | undefined) {
      const task = this.taskMap.get(taskId)
      if (!task) {
        console.warn(`Task ${taskId} not found`)
        return
      }

      const oldParentId = task.parentId

      if (oldParentId === newParentId) {
        return // Already in the right place
      }

      // Remove from old parent's childIds
      if (oldParentId !== undefined) {
        const oldParent = this.taskMap.get(oldParentId)
        if (oldParent) {
          oldParent.removeChildId(taskId)
        }
      }

      // Update task's parentId
      task.setParentId(newParentId)

      // Add to new parent's childIds
      if (newParentId !== undefined) {
        const newParent = this.taskMap.get(newParentId)
        if (newParent) {
          newParent.addChildId(taskId)
        }
      }
    },

    /**
     * Clear all tasks from the store
     */
    clearTasks() {
      this.taskMap.clear()
      this.graph.clear()
    },
  },
})
