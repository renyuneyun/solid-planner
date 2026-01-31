import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setupPinia } from '../../helpers/pinia'
import { useTaskStore } from '@/stores/tasks'
import { TaskGraph } from '@/models/TaskGraph'
import { Status } from '@/models/TaskClass'
import {
  createMockTask,
  createMockTaskHierarchy,
  createMockTasks,
} from '../../mocks/task.mock'

describe('useTaskStore', () => {
  beforeEach(() => {
    setupPinia()
  })

  describe('initial state', () => {
    it('should initialize with empty task map and graph', () => {
      const store = useTaskStore()

      expect(store.taskMap.size).toBe(0)
      expect(store.tasks).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('loadTaskClasses', () => {
    it('should load tasks and rebuild graph', () => {
      const store = useTaskStore()
      const { parent, child1, child2 } = createMockTaskHierarchy()
      const tasks = [parent, child1, child2]
      const graph = TaskGraph.fromTasks(tasks)

      store.loadTaskClasses(tasks, graph)

      expect(store.taskMap.size).toBe(3)
      expect(store.tasks).toHaveLength(3)
      expect(store.graph.getParentId('child-1')).toBe('parent-1')
    })

    it('should replace existing tasks', () => {
      const store = useTaskStore()
      const oldTasks = createMockTasks(2)
      const oldGraph = TaskGraph.fromTasks(oldTasks)
      store.loadTaskClasses(oldTasks, oldGraph)

      const newTasks = createMockTasks(3)
      const newGraph = TaskGraph.fromTasks(newTasks)
      store.loadTaskClasses(newTasks, newGraph)

      expect(store.taskMap.size).toBe(3)
      expect(store.tasks.map(t => t.id)).toEqual(newTasks.map(t => t.id))
    })

    it('should set graph reference on all tasks', () => {
      const store = useTaskStore()
      const tasks = createMockTasks(2)
      const graph = TaskGraph.fromTasks(tasks)

      store.loadTaskClasses(tasks, graph)

      for (const task of store.tasks) {
        // Verify that graph operations work (indicating graph is set)
        task.addChildId('test-child')
        expect(store.graph.getChildrenIds(task.id)).toContain('test-child')
      }
    })
  })

  describe('addTaskClass', () => {
    it('should add new task as root', () => {
      const store = useTaskStore()
      const task = createMockTask()

      store.addTaskClass(task)

      expect(store.taskMap.has(task.id)).toBe(true)
      expect(store.graph.getParentId(task.id)).toBeUndefined()
      expect(store.rootTasks).toContainEqual(task)
    })

    it('should set graph reference on task', () => {
      const store = useTaskStore()
      const task = createMockTask()

      store.addTaskClass(task)

      task.addChildId('test-child')
      expect(store.graph.getChildrenIds(task.id)).toContain('test-child')
    })
  })

  describe('addSubTask', () => {
    it('should add task as child of parent', () => {
      const store = useTaskStore()
      const parent = createMockTask({ id: 'parent' })
      const child = createMockTask({ id: 'child' })

      store.addTaskClass(parent)
      store.addSubTask('parent', child)

      expect(store.taskMap.has('child')).toBe(true)
      expect(child.getParentId()).toBe('parent')
      expect(parent.getChildrenIds()).toContain('child')
      expect(store.graph.getParentId('child')).toBe('parent')
    })

    it('should warn if parent not found', () => {
      const store = useTaskStore()
      const child = createMockTask({ id: 'child' })
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      store.addSubTask('non-existent', child)

      expect(warnSpy).toHaveBeenCalledWith('Parent task non-existent not found')
      expect(store.taskMap.has('child')).toBe(false)

      warnSpy.mockRestore()
    })
  })

  describe('removeTaskClass', () => {
    it('should remove task and all descendants', () => {
      const store = useTaskStore()
      const { parent, child1, child2, grandchild } = createMockTaskHierarchy()
      const graph = TaskGraph.fromTasks([parent, child1, child2, grandchild])
      store.loadTaskClasses([parent, child1, child2, grandchild], graph)

      store.removeTaskClass('child-1')

      expect(store.taskMap.has('child-1')).toBe(false)
      expect(store.taskMap.has('grandchild-1')).toBe(false)
      expect(store.taskMap.has('parent-1')).toBe(true)
      expect(store.taskMap.has('child-2')).toBe(true)
      expect(parent.getChildrenIds()).not.toContain('child-1')
    })

    it('should handle removing root task', () => {
      const store = useTaskStore()
      const { parent, child1, child2 } = createMockTaskHierarchy()
      const graph = TaskGraph.fromTasks([parent, child1, child2])
      store.loadTaskClasses([parent, child1, child2], graph)

      store.removeTaskClass('parent-1')

      expect(store.taskMap.size).toBe(0)
    })

    it('should handle removing non-existent task', () => {
      const store = useTaskStore()
      store.removeTaskClass('non-existent')
      // Should not throw
    })
  })

  describe('updateTaskClass', () => {
    it('should update existing task', () => {
      const store = useTaskStore()
      const task = createMockTask({ name: 'Original' })
      store.addTaskClass(task)

      task.name = 'Updated'
      store.updateTaskClass(task)

      const updated = store.taskMap.get(task.id)
      expect(updated?.name).toBe('Updated')
    })
  })

  describe('moveTask', () => {
    it('should move task to new parent', () => {
      const store = useTaskStore()
      const parent1 = createMockTask({ id: 'parent-1' })
      const parent2 = createMockTask({ id: 'parent-2' })
      const child = createMockTask({ id: 'child' })

      store.addTaskClass(parent1)
      store.addTaskClass(parent2)
      store.addSubTask('parent-1', child)

      store.moveTask('child', 'parent-2')

      expect(child.getParentId()).toBe('parent-2')
      expect(parent1.getChildrenIds()).not.toContain('child')
      expect(parent2.getChildrenIds()).toContain('child')
    })

    it('should move task to root (undefined parent)', () => {
      const store = useTaskStore()
      const parent = createMockTask({ id: 'parent' })
      const child = createMockTask({ id: 'child' })

      store.addTaskClass(parent)
      store.addSubTask('parent', child)

      store.moveTask('child', undefined)

      expect(child.getParentId()).toBeUndefined()
      expect(parent.getChildrenIds()).not.toContain('child')
      expect(store.rootTasks).toContainEqual(child)
    })

    it('should not change anything if already in correct position', () => {
      const store = useTaskStore()
      const parent = createMockTask({ id: 'parent' })
      const child = createMockTask({ id: 'child' })

      store.addTaskClass(parent)
      store.addSubTask('parent', child)

      const initialChildIds = [...parent.getChildrenIds()]
      store.moveTask('child', 'parent')

      expect(parent.getChildrenIds()).toEqual(initialChildIds)
    })

    it('should warn if task not found', () => {
      const store = useTaskStore()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      store.moveTask('non-existent', 'parent')

      expect(warnSpy).toHaveBeenCalledWith('Task non-existent not found')

      warnSpy.mockRestore()
    })
  })

  describe('clearTasks', () => {
    it('should clear all tasks and graph', () => {
      const store = useTaskStore()
      const tasks = createMockTasks(5)
      const graph = TaskGraph.fromTasks(tasks)
      store.loadTaskClasses(tasks, graph)

      store.clearTasks()

      expect(store.taskMap.size).toBe(0)
      expect(store.tasks).toEqual([])
      expect(store.graph.getRootIds()).toEqual([])
    })
  })

  describe('getters', () => {
    describe('tasks', () => {
      it('should return all tasks as array', () => {
        const store = useTaskStore()
        const tasks = createMockTasks(3)
        const graph = TaskGraph.fromTasks(tasks)
        store.loadTaskClasses(tasks, graph)

        expect(store.tasks).toHaveLength(3)
        expect(store.tasks.map(t => t.id)).toEqual(tasks.map(t => t.id))
      })
    })

    describe('rootTasks', () => {
      it('should return only root tasks', () => {
        const store = useTaskStore()
        const { parent, child1, child2 } = createMockTaskHierarchy()
        const root2 = createMockTask({ id: 'root-2' })
        const graph = TaskGraph.fromTasks([parent, child1, child2, root2])
        store.loadTaskClasses([parent, child1, child2, root2], graph)

        const roots = store.rootTasks

        expect(roots).toHaveLength(2)
        expect(roots.map(t => t.id)).toContain('parent-1')
        expect(roots.map(t => t.id)).toContain('root-2')
        expect(roots.map(t => t.id)).not.toContain('child-1')
        expect(roots.map(t => t.id)).not.toContain('child-2')
      })
    })

    describe('sortedTasks', () => {
      it('should sort tasks by endDate', () => {
        const store = useTaskStore()
        const task1 = createMockTask({
          id: 'task-1',
          endDate: new Date('2024-01-15'),
        })
        const task2 = createMockTask({
          id: 'task-2',
          endDate: new Date('2024-01-10'),
        })
        const task3 = createMockTask({
          id: 'task-3',
          endDate: new Date('2024-01-20'),
        })
        const graph = TaskGraph.fromTasks([task1, task2, task3])
        store.loadTaskClasses([task1, task2, task3], graph)

        const sorted = store.sortedTasks

        expect(sorted[0].id).toBe('task-2') // Jan 10
        expect(sorted[1].id).toBe('task-1') // Jan 15
        expect(sorted[2].id).toBe('task-3') // Jan 20
      })

      it('should handle tasks without endDate', () => {
        const store = useTaskStore()
        const task1 = createMockTask({
          id: 'task-1',
          endDate: new Date('2024-01-15'),
        })
        const task2 = createMockTask({ id: 'task-2', endDate: undefined })
        const graph = TaskGraph.fromTasks([task1, task2])
        store.loadTaskClasses([task1, task2], graph)

        const sorted = store.sortedTasks

        // Should not throw, and both tasks should be present
        expect(sorted).toHaveLength(2)
      })
    })

    describe('overdueTasks', () => {
      it('should return incomplete tasks past their endDate', () => {
        const store = useTaskStore()
        const overdueTask = createMockTask({
          id: 'overdue',
          endDate: new Date('2020-01-01'),
          status: Status.IN_PROGRESS,
        })
        const futureTask = createMockTask({
          id: 'future',
          endDate: new Date('2030-01-01'),
          status: Status.IN_PROGRESS,
        })
        const completedTask = createMockTask({
          id: 'completed',
          endDate: new Date('2020-01-01'),
          status: Status.COMPLETED,
        })
        const graph = TaskGraph.fromTasks([
          overdueTask,
          futureTask,
          completedTask,
        ])
        store.loadTaskClasses([overdueTask, futureTask, completedTask], graph)

        const overdue = store.overdueTasks

        expect(overdue).toHaveLength(1)
        expect(overdue[0].id).toBe('overdue')
      })

      it('should not include ignored tasks', () => {
        const store = useTaskStore()
        const ignoredTask = createMockTask({
          id: 'ignored',
          endDate: new Date('2020-01-01'),
          status: Status.IGNORED,
        })
        const graph = TaskGraph.fromTasks([ignoredTask])
        store.loadTaskClasses([ignoredTask], graph)

        const overdue = store.overdueTasks

        expect(overdue).toHaveLength(0)
      })

      it('should not include tasks without endDate', () => {
        const store = useTaskStore()
        const task = createMockTask({
          id: 'no-date',
          endDate: undefined,
          status: Status.IN_PROGRESS,
        })
        const graph = TaskGraph.fromTasks([task])
        store.loadTaskClasses([task], graph)

        const overdue = store.overdueTasks

        expect(overdue).toHaveLength(0)
      })
    })
  })
})
