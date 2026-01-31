import { describe, it, expect, beforeEach } from 'vitest'
import { TaskGraph } from '@/models/TaskGraph'
import { createMockTask, createMockTaskHierarchy } from '../../mocks/task.mock'

describe('TaskGraph', () => {
  let graph: TaskGraph

  beforeEach(() => {
    graph = new TaskGraph()
  })

  describe('fromTasks static method', () => {
    it('should build graph from task array', () => {
      const { parent, child1, child2, grandchild } = createMockTaskHierarchy()
      const tasks = [parent, child1, child2, grandchild]

      const graph = TaskGraph.fromTasks(tasks)

      expect(graph.getParentId('child-1')).toBe('parent-1')
      expect(graph.getParentId('child-2')).toBe('parent-1')
      expect(graph.getParentId('grandchild-1')).toBe('child-1')
      expect(graph.getChildrenIds('parent-1')).toEqual(['child-1', 'child-2'])
      expect(graph.getChildrenIds('child-1')).toEqual(['grandchild-1'])
    })

    it('should handle tasks without relationships', () => {
      const task1 = createMockTask({ id: 'task-1' })
      const task2 = createMockTask({ id: 'task-2' })

      const graph = TaskGraph.fromTasks([task1, task2])

      expect(graph.getParentId('task-1')).toBeUndefined()
      expect(graph.getParentId('task-2')).toBeUndefined()
      expect(graph.getChildrenIds('task-1')).toEqual([])
      expect(graph.getChildrenIds('task-2')).toEqual([])
    })
  })

  describe('rebuildFromTasks', () => {
    it('should rebuild graph from tasks', () => {
      const { parent, child1, child2 } = createMockTaskHierarchy()
      graph.rebuildFromTasks([parent, child1, child2])

      expect(graph.getParentId('child-1')).toBe('parent-1')
      expect(graph.getChildrenIds('parent-1')).toEqual(['child-1', 'child-2'])
    })

    it('should clear existing graph state', () => {
      // Setup initial state
      graph.setParent('task-1', 'old-parent')

      // Rebuild with new tasks
      const task = createMockTask({ id: 'task-2' })
      graph.rebuildFromTasks([task])

      // Old task should no longer exist
      expect(graph.getParentId('task-1')).toBeUndefined()
    })
  })

  describe('getParentId and getChildrenIds', () => {
    it('should get parent ID', () => {
      graph.setParent('child', 'parent')
      expect(graph.getParentId('child')).toBe('parent')
    })

    it('should return undefined for root task', () => {
      expect(graph.getParentId('root')).toBeUndefined()
    })

    it('should get children IDs', () => {
      graph.addChild('parent', 'child-1')
      graph.addChild('parent', 'child-2')

      expect(graph.getChildrenIds('parent')).toEqual(['child-1', 'child-2'])
    })

    it('should return empty array for childless task', () => {
      expect(graph.getChildrenIds('leaf')).toEqual([])
    })
  })

  describe('setParent', () => {
    it('should set parent relationship', () => {
      graph.setParent('child', 'parent')

      expect(graph.getParentId('child')).toBe('parent')
      expect(graph.getChildrenIds('parent')).toContain('child')
    })

    it('should update parent when changed', () => {
      graph.setParent('child', 'old-parent')
      graph.setParent('child', 'new-parent')

      expect(graph.getParentId('child')).toBe('new-parent')
      expect(graph.getChildrenIds('old-parent')).not.toContain('child')
      expect(graph.getChildrenIds('new-parent')).toContain('child')
    })

    it('should handle setting parent to undefined (make root)', () => {
      graph.setParent('child', 'parent')
      graph.setParent('child', undefined)

      expect(graph.getParentId('child')).toBeUndefined()
      expect(graph.getChildrenIds('parent')).not.toContain('child')
    })

    it('should not add duplicate child to parent', () => {
      graph.setParent('child', 'parent')
      graph.setParent('child', 'parent') // Set again

      expect(graph.getChildrenIds('parent')).toEqual(['child'])
    })
  })

  describe('addChild', () => {
    it('should add child relationship', () => {
      graph.addChild('parent', 'child')

      expect(graph.getParentId('child')).toBe('parent')
      expect(graph.getChildrenIds('parent')).toContain('child')
    })

    it('should move child from old parent to new parent', () => {
      graph.addChild('old-parent', 'child')
      graph.addChild('new-parent', 'child')

      expect(graph.getParentId('child')).toBe('new-parent')
      expect(graph.getChildrenIds('old-parent')).not.toContain('child')
      expect(graph.getChildrenIds('new-parent')).toContain('child')
    })

    it('should not add duplicate child', () => {
      graph.addChild('parent', 'child')
      graph.addChild('parent', 'child')

      expect(graph.getChildrenIds('parent')).toEqual(['child'])
    })
  })

  describe('removeChild', () => {
    it('should remove child relationship', () => {
      graph.addChild('parent', 'child')
      graph.removeChild('parent', 'child')

      expect(graph.getChildrenIds('parent')).not.toContain('child')
      expect(graph.getParentId('child')).toBeUndefined()
    })

    it('should handle removing non-existent child', () => {
      graph.removeChild('parent', 'non-existent')
      // Should not throw
      expect(graph.getChildrenIds('parent')).toEqual([])
    })

    it('should only clear parent if it matches', () => {
      graph.addChild('parent-1', 'child')
      graph.removeChild('parent-2', 'child') // Different parent

      expect(graph.getParentId('child')).toBe('parent-1')
    })
  })

  describe('removeTaskAndDescendants', () => {
    it('should remove task and all its descendants', () => {
      const { parent, child1, child2, grandchild } = createMockTaskHierarchy()
      graph.rebuildFromTasks([parent, child1, child2, grandchild])

      const removed = graph.removeTaskAndDescendants('child-1')

      expect(removed).toContain('child-1')
      expect(removed).toContain('grandchild-1')
      expect(graph.getParentId('child-1')).toBeUndefined()
      expect(graph.getParentId('grandchild-1')).toBeUndefined()
      expect(graph.getChildrenIds('parent-1')).not.toContain('child-1')
    })

    it('should remove only the task if it has no descendants', () => {
      graph.setParent('leaf', 'parent')
      const removed = graph.removeTaskAndDescendants('leaf')

      expect(removed).toEqual(['leaf'])
      expect(graph.getChildrenIds('parent')).not.toContain('leaf')
    })

    it('should handle removing non-existent task', () => {
      const removed = graph.removeTaskAndDescendants('non-existent')
      expect(removed).toEqual(['non-existent'])
    })
  })

  describe('getRootIds', () => {
    it('should return all root task IDs', () => {
      graph.setParent('child-1', 'root-1')
      graph.setParent('child-2', 'root-1')
      graph.setParent('child-3', 'root-2')
      graph.setParent('root-1', undefined)
      graph.setParent('root-2', undefined)
      graph.setParent('root-3', undefined)

      const roots = graph.getRootIds()

      expect(roots).toContain('root-1')
      expect(roots).toContain('root-2')
      expect(roots).toContain('root-3')
      expect(roots).not.toContain('child-1')
      expect(roots).not.toContain('child-2')
      expect(roots).not.toContain('child-3')
    })

    it('should return empty array when no tasks exist', () => {
      expect(graph.getRootIds()).toEqual([])
    })
  })

  describe('getAllDescendantIds', () => {
    it('should get all descendants including the task itself', () => {
      const { parent, child1, child2, grandchild } = createMockTaskHierarchy()
      graph.rebuildFromTasks([parent, child1, child2, grandchild])

      const descendants = graph.getAllDescendantIds('parent-1')

      expect(descendants).toContain('parent-1')
      expect(descendants).toContain('child-1')
      expect(descendants).toContain('child-2')
      expect(descendants).toContain('grandchild-1')
    })

    it('should return only task itself if it has no children', () => {
      graph.setParent('leaf', undefined)
      const descendants = graph.getAllDescendantIds('leaf')

      expect(descendants).toEqual(['leaf'])
    })
  })

  describe('isAncestor', () => {
    it('should return true for direct parent', () => {
      graph.setParent('child', 'parent')
      expect(graph.isAncestor('parent', 'child')).toBe(true)
    })

    it('should return true for indirect ancestor', () => {
      const { parent, child1, grandchild } = createMockTaskHierarchy()
      graph.rebuildFromTasks([parent, child1, grandchild])

      expect(graph.isAncestor('parent-1', 'grandchild-1')).toBe(true)
    })

    it('should return false for non-ancestor', () => {
      graph.setParent('child-1', 'parent')
      graph.setParent('child-2', undefined)

      expect(graph.isAncestor('child-2', 'child-1')).toBe(false)
    })

    it('should return false for same task', () => {
      graph.setParent('task', undefined)
      expect(graph.isAncestor('task', 'task')).toBe(false)
    })
  })

  describe('clear', () => {
    it('should clear all relationships', () => {
      graph.setParent('child', 'parent')
      graph.clear()

      expect(graph.getParentId('child')).toBeUndefined()
      expect(graph.getChildrenIds('parent')).toEqual([])
      expect(graph.getRootIds()).toEqual([])
    })
  })

  describe('getState', () => {
    it('should return complete state for debugging', () => {
      graph.setParent('child-1', 'parent')
      graph.setParent('child-2', 'parent')

      const state = graph.getState()

      expect(state.parentMap).toEqual({
        'child-1': 'parent',
        'child-2': 'parent',
      })
      expect(state.childrenMap).toEqual({
        parent: ['child-1', 'child-2'],
      })
    })
  })
})
