import type { TaskClass } from './TaskClass'

/**
 * Task Graph - provides cached indices for efficient task relationship lookups
 * The graph is derived from TaskClass.parentId and TaskClass.childIds properties.
 * It maintains O(1) lookups while the source of truth remains in TaskClass instances.
 *
 * This provides:
 * - Efficient parent/child lookups
 * - Root task identification
 * - Ancestor/descendant queries
 * - Proper reactivity for Vue
 */

export class TaskGraph {
  /**
   * Map of task ID to parent task ID (cached from TaskClass.parentId)
   * undefined means this is a root task
   */
  private parentMap = new Map<string, string | undefined>()

  /**
   * Map of task ID to array of child task IDs (cached from TaskClass.childIds)
   */
  private childrenMap = new Map<string, string[]>()

  /**
   * Build or rebuild the graph from TaskClass instances
   */
  static fromTasks(tasks: TaskClass[]): TaskGraph {
    const graph = new TaskGraph()
    graph.rebuildFromTasks(tasks)
    return graph
  }

  /**
   * Rebuild indices from TaskClass data (source of truth)
   */
  rebuildFromTasks(tasks: TaskClass[]): void {
    this.clear()
    for (const task of tasks) {
      this.parentMap.set(task.id, task.parentId)
      if (task.childIds.length > 0) {
        this.childrenMap.set(task.id, [...task.childIds])
      }
    }
  }

  /**
   * Get the parent ID of a task
   */
  getParentId(taskId: string): string | undefined {
    return this.parentMap.get(taskId)
  }

  /**
   * Get all child IDs of a task
   */
  getChildrenIds(taskId: string): string[] {
    return this.childrenMap.get(taskId) || []
  }

  /**
   * Set the parent of a task
   * Also updates the parent's children list
   */
  setParent(taskId: string, parentId: string | undefined): void {
    const oldParentId = this.parentMap.get(taskId)

    // Remove from old parent's children list
    if (oldParentId !== undefined) {
      const oldChildren = this.childrenMap.get(oldParentId)
      if (oldChildren) {
        const index = oldChildren.indexOf(taskId)
        if (index !== -1) {
          oldChildren.splice(index, 1)
        }
      }
    }

    // Set new parent
    this.parentMap.set(taskId, parentId)

    // Add to new parent's children list
    if (parentId !== undefined) {
      if (!this.childrenMap.has(parentId)) {
        this.childrenMap.set(parentId, [])
      }
      const children = this.childrenMap.get(parentId)!
      if (!children.includes(taskId)) {
        children.push(taskId)
      }
    }
  }

  /**
   * Add a child to a task
   */
  addChild(parentId: string, childId: string): void {
    // First, remove child from its current parent
    const oldParentId = this.parentMap.get(childId)
    if (oldParentId && oldParentId !== parentId) {
      const oldChildren = this.childrenMap.get(oldParentId)
      if (oldChildren) {
        const index = oldChildren.indexOf(childId)
        if (index !== -1) {
          oldChildren.splice(index, 1)
        }
      }
    }

    // Set the child's parent
    this.parentMap.set(childId, parentId)

    // Add to parent's children list
    if (!this.childrenMap.has(parentId)) {
      this.childrenMap.set(parentId, [])
    }
    const children = this.childrenMap.get(parentId)!
    if (!children.includes(childId)) {
      children.push(childId)
    }
  }

  /**
   * Remove a child from a task
   */
  removeChild(parentId: string, childId: string): void {
    const children = this.childrenMap.get(parentId)
    if (children) {
      const index = children.indexOf(childId)
      if (index !== -1) {
        children.splice(index, 1)
      }
    }

    if (this.parentMap.get(childId) === parentId) {
      this.parentMap.set(childId, undefined)
    }
  }

  /**
   * Remove a task and all its descendants from the graph
   */
  removeTaskAndDescendants(taskId: string): string[] {
    const removed: string[] = []

    // Recursively remove all children
    const children = this.childrenMap.get(taskId)
    if (children) {
      for (const childId of [...children]) {
        removed.push(...this.removeTaskAndDescendants(childId))
      }
    }

    // Remove from parent's children
    const parentId = this.parentMap.get(taskId)
    if (parentId !== undefined) {
      this.removeChild(parentId, taskId)
    }

    // Remove the task itself
    this.parentMap.delete(taskId)
    this.childrenMap.delete(taskId)
    removed.push(taskId)

    return removed
  }

  /**
   * Get all root task IDs (tasks without parents)
   */
  getRootIds(): string[] {
    const roots: string[] = []
    for (const [taskId, parentId] of this.parentMap.entries()) {
      if (parentId === undefined) {
        roots.push(taskId)
      }
    }
    return roots
  }

  /**
   * Get all descendants of a task (including the task itself)
   */
  getAllDescendantIds(taskId: string): string[] {
    const descendants: string[] = [taskId]
    const children = this.childrenMap.get(taskId)
    if (children) {
      for (const childId of children) {
        descendants.push(...this.getAllDescendantIds(childId))
      }
    }
    return descendants
  }

  /**
   * Check if task A is an ancestor of task B
   */
  isAncestor(ancestorId: string, taskId: string): boolean {
    let current = this.parentMap.get(taskId)
    while (current !== undefined) {
      if (current === ancestorId) {
        return true
      }
      current = this.parentMap.get(current)
    }
    return false
  }

  /**
   * Clear all relationships
   */
  clear(): void {
    this.parentMap.clear()
    this.childrenMap.clear()
  }

  /**
   * Get the complete state for serialization/debugging
   */
  getState() {
    return {
      parentMap: Object.fromEntries(this.parentMap),
      childrenMap: Object.fromEntries(this.childrenMap),
    }
  }
}
