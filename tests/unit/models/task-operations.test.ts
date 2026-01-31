import { describe, it, expect, beforeEach } from 'vitest'
import { setupPinia } from '../../helpers/pinia'
import {
  getChildTasks,
  getParentTask,
  getAllDescendantTasks,
  getAncestorTaskIds,
  isAncestor,
  buildTaskHierarchy,
  type TaskWithChildren,
} from '@/models/task-operations'
import { useTaskStore } from '@/stores/tasks'
import { createMockTask, createMockTaskHierarchy } from '../../mocks/task.mock'
import { TaskGraph } from '@/models/TaskGraph'

describe('task-operations', () => {
  beforeEach(() => {
    setupPinia()
  })

  describe('getChildTasks', () => {
    it('should get child tasks', () => {
      const store = useTaskStore()
      const { parent, child1, child2 } = createMockTaskHierarchy()
      const graph = TaskGraph.fromTasks([parent, child1, child2])
      store.loadTaskClasses([parent, child1, child2], graph)

      const children = getChildTasks('parent-1', store)

      expect(children).toHaveLength(2)
      expect(children.map(t => t.id)).toContain('child-1')
      expect(children.map(t => t.id)).toContain('child-2')
    })

    it('should return empty array for task with no children', () => {
      const store = useTaskStore()
      const task = createMockTask({ id: 'leaf' })
      const graph = TaskGraph.fromTasks([task])
      store.loadTaskClasses([task], graph)

      const children = getChildTasks('leaf', store)

      expect(children).toEqual([])
    })

    it('should return empty array for non-existent task', () => {
      const store = useTaskStore()
      const children = getChildTasks('non-existent', store)

      expect(children).toEqual([])
    })

    it('should filter out non-existent child IDs', () => {
      const store = useTaskStore()
      const parent = createMockTask({
        id: 'parent',
        childIds: ['child-1', 'non-existent', 'child-2'],
      })
      const child1 = createMockTask({ id: 'child-1', parentId: 'parent' })
      const child2 = createMockTask({ id: 'child-2', parentId: 'parent' })
      const graph = TaskGraph.fromTasks([parent, child1, child2])
      store.loadTaskClasses([parent, child1, child2], graph)

      const children = getChildTasks('parent', store)

      expect(children).toHaveLength(2)
      expect(children.map(t => t.id)).not.toContain('non-existent')
    })
  })

  describe('getParentTask', () => {
    it('should get parent task', () => {
      const store = useTaskStore()
      const { parent, child1 } = createMockTaskHierarchy()
      const graph = TaskGraph.fromTasks([parent, child1])
      store.loadTaskClasses([parent, child1], graph)

      const parentTask = getParentTask('child-1', store)

      expect(parentTask).toBeDefined()
      expect(parentTask?.id).toBe('parent-1')
    })

    it('should return undefined for root task', () => {
      const store = useTaskStore()
      const task = createMockTask({ id: 'root' })
      const graph = TaskGraph.fromTasks([task])
      store.loadTaskClasses([task], graph)

      const parentTask = getParentTask('root', store)

      expect(parentTask).toBeUndefined()
    })

    it('should return undefined for non-existent task', () => {
      const store = useTaskStore()
      const parentTask = getParentTask('non-existent', store)

      expect(parentTask).toBeUndefined()
    })

    it('should return undefined if parent does not exist in store', () => {
      const store = useTaskStore()
      const child = createMockTask({ id: 'child', parentId: 'missing-parent' })
      const graph = TaskGraph.fromTasks([child])
      store.loadTaskClasses([child], graph)

      const parentTask = getParentTask('child', store)

      expect(parentTask).toBeUndefined()
    })
  })

  describe('getAllDescendantTasks', () => {
    it('should get all descendant tasks recursively', () => {
      const store = useTaskStore()
      const { parent, child1, child2, grandchild } = createMockTaskHierarchy()
      const graph = TaskGraph.fromTasks([parent, child1, child2, grandchild])
      store.loadTaskClasses([parent, child1, child2, grandchild], graph)

      const descendants = getAllDescendantTasks('parent-1', store)

      expect(descendants).toHaveLength(3) // child1, child2, grandchild
      expect(descendants.map(t => t.id)).toContain('child-1')
      expect(descendants.map(t => t.id)).toContain('child-2')
      expect(descendants.map(t => t.id)).toContain('grandchild-1')
    })

    it('should return empty array for task with no children', () => {
      const store = useTaskStore()
      const task = createMockTask({ id: 'leaf' })
      const graph = TaskGraph.fromTasks([task])
      store.loadTaskClasses([task], graph)

      const descendants = getAllDescendantTasks('leaf', store)

      expect(descendants).toEqual([])
    })

    it('should return empty array for non-existent task', () => {
      const store = useTaskStore()
      const descendants = getAllDescendantTasks('non-existent', store)

      expect(descendants).toEqual([])
    })
  })

  describe('getAncestorTaskIds', () => {
    it('should get all ancestor IDs', () => {
      const store = useTaskStore()
      const { parent, child1, grandchild } = createMockTaskHierarchy()
      const graph = TaskGraph.fromTasks([parent, child1, grandchild])
      store.loadTaskClasses([parent, child1, grandchild], graph)

      const ancestors = getAncestorTaskIds('grandchild-1', store)

      expect(ancestors).toEqual(['child-1', 'parent-1'])
    })

    it('should return empty array for root task', () => {
      const store = useTaskStore()
      const task = createMockTask({ id: 'root' })
      const graph = TaskGraph.fromTasks([task])
      store.loadTaskClasses([task], graph)

      const ancestors = getAncestorTaskIds('root', store)

      expect(ancestors).toEqual([])
    })

    it('should return empty array for non-existent task', () => {
      const store = useTaskStore()
      const ancestors = getAncestorTaskIds('non-existent', store)

      expect(ancestors).toEqual([])
    })
  })

  describe('isAncestor', () => {
    it('should return true for direct parent', () => {
      const store = useTaskStore()
      const { parent, child1 } = createMockTaskHierarchy()
      const graph = TaskGraph.fromTasks([parent, child1])
      store.loadTaskClasses([parent, child1], graph)

      expect(isAncestor('parent-1', 'child-1', store)).toBe(true)
    })

    it('should return true for indirect ancestor', () => {
      const store = useTaskStore()
      const { parent, child1, grandchild } = createMockTaskHierarchy()
      const graph = TaskGraph.fromTasks([parent, child1, grandchild])
      store.loadTaskClasses([parent, child1, grandchild], graph)

      expect(isAncestor('parent-1', 'grandchild-1', store)).toBe(true)
    })

    it('should return false for non-ancestor', () => {
      const store = useTaskStore()
      const task1 = createMockTask({ id: 'task-1' })
      const task2 = createMockTask({ id: 'task-2' })
      const graph = TaskGraph.fromTasks([task1, task2])
      store.loadTaskClasses([task1, task2], graph)

      expect(isAncestor('task-1', 'task-2', store)).toBe(false)
    })
  })

  describe('buildTaskHierarchy', () => {
    it('should build hierarchical structure with subTasks', () => {
      const store = useTaskStore()
      const { parent, child1, child2, grandchild } = createMockTaskHierarchy()
      const graph = TaskGraph.fromTasks([parent, child1, child2, grandchild])
      store.loadTaskClasses([parent, child1, child2, grandchild], graph)

      const hierarchy = buildTaskHierarchy(['parent-1'], store)

      expect(hierarchy).toHaveLength(1)
      expect(hierarchy[0].id).toBe('parent-1')
      expect(hierarchy[0].subTasks).toHaveLength(2)
      expect(hierarchy[0].subTasks.map(t => t.id)).toContain('child-1')
      expect(hierarchy[0].subTasks.map(t => t.id)).toContain('child-2')

      const child1Hierarchy = hierarchy[0].subTasks.find(
        t => t.id === 'child-1',
      ) as TaskWithChildren
      expect(child1Hierarchy?.subTasks).toHaveLength(1)
      expect(child1Hierarchy?.subTasks[0].id).toBe('grandchild-1')
    })

    it('should handle tasks with no children', () => {
      const store = useTaskStore()
      const task = createMockTask({ id: 'leaf' })
      const graph = TaskGraph.fromTasks([task])
      store.loadTaskClasses([task], graph)

      const hierarchy = buildTaskHierarchy(['leaf'], store)

      expect(hierarchy).toHaveLength(1)
      expect(hierarchy[0].id).toBe('leaf')
      expect(hierarchy[0].subTasks).toEqual([])
    })

    it('should filter out non-existent tasks', () => {
      const store = useTaskStore()
      const task = createMockTask({ id: 'exists' })
      const graph = TaskGraph.fromTasks([task])
      store.loadTaskClasses([task], graph)

      const hierarchy = buildTaskHierarchy(['exists', 'non-existent'], store)

      expect(hierarchy).toHaveLength(1)
      expect(hierarchy[0].id).toBe('exists')
    })

    it('should build hierarchy for multiple root tasks', () => {
      const store = useTaskStore()
      const task1 = createMockTask({ id: 'root-1' })
      const task2 = createMockTask({ id: 'root-2' })
      const graph = TaskGraph.fromTasks([task1, task2])
      store.loadTaskClasses([task1, task2], graph)

      const hierarchy = buildTaskHierarchy(['root-1', 'root-2'], store)

      expect(hierarchy).toHaveLength(2)
      expect(hierarchy.map(t => t.id)).toContain('root-1')
      expect(hierarchy.map(t => t.id)).toContain('root-2')
    })
  })
})
