import { describe, it, expect } from 'vitest'
import { TaskClass, Status } from '@/models/TaskClass'
import { createMockTask } from '../../mocks/task.mock'

describe('TaskClass', () => {
  describe('constructor', () => {
    it('should create a task with required fields', () => {
      const addedDate = new Date('2024-01-01')
      const task = new TaskClass({
        id: 'test-1',
        name: 'Test Task',
        addedDate,
      })

      expect(task.id).toBe('test-1')
      expect(task.name).toBe('Test Task')
      expect(task.addedDate).toBe(addedDate)
      expect(task.childIds).toEqual([])
      expect(task.parentId).toBeUndefined()
    })

    it('should create a task with all optional fields', () => {
      const addedDate = new Date('2024-01-01')
      const startDate = new Date('2024-01-02')
      const endDate = new Date('2024-01-10')

      const task = new TaskClass({
        id: 'test-2',
        name: 'Complete Task',
        description: 'Task description',
        addedDate,
        startDate,
        endDate,
        status: Status.COMPLETED,
        parentId: 'parent-1',
        childIds: ['child-1', 'child-2'],
      })

      expect(task.description).toBe('Task description')
      expect(task.startDate).toBe(startDate)
      expect(task.endDate).toBe(endDate)
      expect(task.status).toBe(Status.COMPLETED)
      expect(task.parentId).toBe('parent-1')
      expect(task.childIds).toEqual(['child-1', 'child-2'])
    })
  })

  describe('status and completion', () => {
    it('should identify completed tasks', () => {
      const completedTask = createMockTask({
        status: Status.COMPLETED,
      })
      expect(completedTask.completed).toBe(true)
    })

    it('should identify incomplete tasks', () => {
      const incompleteTask = createMockTask({
        status: Status.IN_PROGRESS,
      })
      expect(incompleteTask.completed).toBe(false)
    })

    it('should set task as completed via setter', () => {
      const task = createMockTask({
        status: Status.IN_PROGRESS,
      })
      task.completed = true
      expect(task.status).toBe(Status.COMPLETED)
    })

    it('should set task as incomplete via setter', () => {
      const task = createMockTask({
        status: Status.COMPLETED,
      })
      task.completed = false
      expect(task.status).toBe(Status.IN_PROGRESS)
    })
  })

  describe('effective dates', () => {
    it('should use startDate as effectiveStartDate when provided', () => {
      const addedDate = new Date('2024-01-01')
      const startDate = new Date('2024-01-05')
      const task = createMockTask({ addedDate, startDate })

      expect(task.effectiveStartDate).toBe(startDate)
    })

    it('should use addedDate as effectiveStartDate when startDate is not provided', () => {
      const addedDate = new Date('2024-01-01')
      const task = createMockTask({ addedDate, startDate: undefined })

      expect(task.effectiveStartDate).toBe(addedDate)
    })

    it('should use endDate as effectiveEndDate when provided', () => {
      const endDate = new Date('2024-01-10')
      const task = createMockTask({ endDate })

      expect(task.effectiveEndDate).toBe(endDate)
    })

    it('should calculate effectiveEndDate as end of week when endDate is not provided', () => {
      const addedDate = new Date('2024-01-01') // Monday
      const task = createMockTask({ addedDate, endDate: undefined })

      const expected = new Date('2024-01-07') // Sunday
      expected.setHours(
        addedDate.getHours(),
        addedDate.getMinutes(),
        addedDate.getSeconds(),
        addedDate.getMilliseconds(),
      )

      expect(task.effectiveEndDate.toDateString()).toBe(expected.toDateString())
    })
  })

  describe('parent-child relationships', () => {
    it('should get parent ID', () => {
      const task = createMockTask({ parentId: 'parent-1' })
      expect(task.getParentId()).toBe('parent-1')
    })

    it('should return undefined for root task parent ID', () => {
      const task = createMockTask({ parentId: undefined })
      expect(task.getParentId()).toBeUndefined()
    })

    it('should get children IDs', () => {
      const task = createMockTask({ childIds: ['child-1', 'child-2'] })
      const childIds = task.getChildrenIds()

      expect(childIds).toEqual(['child-1', 'child-2'])
      // Ensure returned array is a copy
      childIds.push('child-3')
      expect(task.childIds).toEqual(['child-1', 'child-2'])
    })

    it('should set parent ID', () => {
      const task = createMockTask()
      task.setParentId('new-parent')

      expect(task.parentId).toBe('new-parent')
      expect(task.getParentId()).toBe('new-parent')
    })

    it('should add child ID', () => {
      const task = createMockTask({ childIds: [] })
      task.addChildId('child-1')
      task.addChildId('child-2')

      expect(task.childIds).toEqual(['child-1', 'child-2'])
    })

    it('should not add duplicate child ID', () => {
      const task = createMockTask({ childIds: ['child-1'] })
      task.addChildId('child-1')

      expect(task.childIds).toEqual(['child-1'])
    })

    it('should remove child ID', () => {
      const task = createMockTask({
        childIds: ['child-1', 'child-2', 'child-3'],
      })
      task.removeChildId('child-2')

      expect(task.childIds).toEqual(['child-1', 'child-3'])
    })

    it('should handle removing non-existent child ID', () => {
      const task = createMockTask({ childIds: ['child-1'] })
      task.removeChildId('child-2')

      expect(task.childIds).toEqual(['child-1'])
    })
  })

  describe('graph integration', () => {
    it('should update graph when setting parent', () => {
      const mockGraph = {
        setParent: expect.any(Function),
      }
      const task = createMockTask()
      task.setGraph(mockGraph)

      mockGraph.setParent = (taskId: string, parentId: string | undefined) => {
        expect(taskId).toBe(task.id)
        expect(parentId).toBe('parent-1')
      }

      task.setParentId('parent-1')
    })

    it('should update graph when adding child', () => {
      const mockGraph = {
        addChild: expect.any(Function),
      }
      const task = createMockTask()
      task.setGraph(mockGraph)

      mockGraph.addChild = (parentId: string, childId: string) => {
        expect(parentId).toBe(task.id)
        expect(childId).toBe('child-1')
      }

      task.addChildId('child-1')
    })

    it('should update graph when removing child', () => {
      const mockGraph = {
        removeChild: expect.any(Function),
      }
      const task = createMockTask({ childIds: ['child-1'] })
      task.setGraph(mockGraph)

      mockGraph.removeChild = (parentId: string, childId: string) => {
        expect(parentId).toBe(task.id)
        expect(childId).toBe('child-1')
      }

      task.removeChildId('child-1')
    })
  })

  describe('fullId property', () => {
    it('should store and retrieve fullId', () => {
      const task = createMockTask()
      task.fullId = 'https://pod.example.com/tasks#task-123'

      expect(task.fullId).toBe('https://pod.example.com/tasks#task-123')
    })
  })
})
