/**
 * Task Graph Adapter - provides convenience methods for working with tasks
 * These functions simplify access to task relationships stored in TaskClass
 */

import { TaskClass } from '@/types/task'
import { useTaskStore } from '@/stores/tasks'

export interface TaskWithChildren extends TaskClass {
  subTasks: TaskClass[]
}

/**
 * Get a task's children as TaskClass objects
 * Reads directly from task.childIds, no graph lookup needed
 */
export function getChildTasks(taskId: string, store = useTaskStore()): TaskClass[] {
  const task = store.taskMap.get(taskId)
  if (!task) return []
  
  return task.childIds
    .map(id => store.taskMap.get(id))
    .filter((task): task is TaskClass => !!task)
}

/**
 * Get a task's parent as a TaskClass object
 * Reads directly from task.parentId
 */
export function getParentTask(taskId: string, store = useTaskStore()): TaskClass | undefined {
  const task = store.taskMap.get(taskId)
  if (!task || !task.parentId) return undefined
  return store.taskMap.get(task.parentId)
}

/**
 * Recursively get all descendant tasks of a given task
 */
export function getAllDescendantTasks(taskId: string, store = useTaskStore()): TaskClass[] {
  const descendants: TaskClass[] = []
  const task = store.taskMap.get(taskId)
  if (!task) return descendants

  for (const childId of task.childIds) {
    const childTask = store.taskMap.get(childId)
    if (childTask) {
      descendants.push(childTask)
      descendants.push(...getAllDescendantTasks(childId, store))
    }
  }

  return descendants
}

/**
 * Get all ancestor task IDs of a given task (from immediate parent to root)
 */
export function getAncestorTaskIds(taskId: string, store = useTaskStore()): string[] {
  const ancestors: string[] = []
  let task = store.taskMap.get(taskId)
  while (task && task.parentId) {
    ancestors.push(task.parentId)
    task = store.taskMap.get(task.parentId)
  }
  return ancestors
}

/**
 * Check if one task is an ancestor of another
 */
export function isAncestor(ancestorId: string, taskId: string, store = useTaskStore()): boolean {
  return store.graph.isAncestor(ancestorId, taskId)
}

/**
 * Convert a flat task list into a hierarchical structure for rendering
 * Useful for components that expect nested subTasks
 */
export function buildTaskHierarchy(
  taskIds: string[],
  store = useTaskStore(),
): TaskWithChildren[] {
  const results: TaskWithChildren[] = []
  
  for (const id of taskIds) {
    const task = store.taskMap.get(id)
    if (task) {
      results.push(buildTaskHierarchyForTask(task, store))
    }
  }
  
  return results
}

/**
 * Recursively build task hierarchy for a single task
 */
function buildTaskHierarchyForTask(task: TaskClass, store = useTaskStore()): TaskWithChildren {
  const taskWithChildren = Object.assign(Object.create(Object.getPrototypeOf(task)), task) as TaskWithChildren
  taskWithChildren.subTasks = getChildTasks(task.id, store).map(child =>
    buildTaskHierarchyForTask(child, store),
  )
  return taskWithChildren
}
