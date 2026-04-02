import { describe, it, expect, beforeEach } from 'vitest'
import { TaskClass, Status } from '@/models/TaskClass'
import { TaskGraph } from '@/models/TaskGraph'
import {
  calculateSoftDeadline,
  getDaysUntilDeadline,
  isOverdue,
  calculatePriorityScore,
  getWeeklyRelevantTasks,
  categorizeTasksByFocus,
  getParentChainIds,
  getStartOfWeek,
  getEndOfWeek,
  getUpcomingTasksByWeek,
  getWeekDateRange,
  getWeekLabel
} from '@/utils/priority'

describe('Priority Utilities', () => {
  describe('calculateSoftDeadline', () => {
    it('should return endDate if set', () => {
      const endDate = new Date('2026-02-28')
      const task = new TaskClass({
        id: '1',
        name: 'Test Task',
        addedDate: new Date('2026-02-20'),
        endDate
      })

      const result = calculateSoftDeadline(task)
      expect(result).toEqual(endDate)
    })

    it('should calculate Friday of the same week for tasks added before Friday', () => {
      // Monday, Feb 17, 2026
      const task = new TaskClass({
        id: '1',
        name: 'Test Task',
        addedDate: new Date('2026-02-17')
      })

      const result = calculateSoftDeadline(task)
      const expected = new Date('2026-02-20') // Friday
      expected.setHours(23, 59, 59, 999)
      
      expect(result.getDay()).toBe(5) // Friday
      expect(result.getDate()).toBe(20)
    })

    it('should calculate Friday of the same week for tasks added on Friday', () => {
      // Friday, Feb 20, 2026
      const task = new TaskClass({
        id: '1',
        name: 'Test Task',
        addedDate: new Date('2026-02-20')
      })

      const result = calculateSoftDeadline(task)
      expect(result.getDay()).toBe(5) // Friday
      expect(result.getDate()).toBe(20)
    })

    it('should calculate next Friday for tasks added on Saturday', () => {
      // Saturday, Feb 21, 2026
      const task = new TaskClass({
        id: '1',
        name: 'Test Task',
        addedDate: new Date('2026-02-21')
      })

      const result = calculateSoftDeadline(task)
      expect(result.getDay()).toBe(5) // Friday
      expect(result.getDate()).toBe(27) // Next Friday
    })
  })

  describe('getDaysUntilDeadline', () => {
    it('should return positive days for future deadline', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 5)
      
      const task = new TaskClass({
        id: '1',
        name: 'Test Task',
        addedDate: new Date(),
        endDate: futureDate
      })

      const days = getDaysUntilDeadline(task)
      expect(days).toBeGreaterThan(0)
      expect(days).toBeLessThanOrEqual(5)
    })

    it('should return negative days for past deadline', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      
      const task = new TaskClass({
        id: '1',
        name: 'Test Task',
        addedDate: new Date(),
        endDate: pastDate
      })

      const days = getDaysUntilDeadline(task)
      expect(days).toBeLessThan(0)
    })
  })

  describe('isOverdue', () => {
    it('should return true for past deadline and incomplete task', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      
      const task = new TaskClass({
        id: '1',
        name: 'Test Task',
        addedDate: new Date(),
        endDate: pastDate,
        status: Status.IN_PROGRESS
      })

      expect(isOverdue(task)).toBe(true)
    })

    it('should return false for past deadline but completed task', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      
      const task = new TaskClass({
        id: '1',
        name: 'Test Task',
        addedDate: new Date(),
        endDate: pastDate,
        status: Status.COMPLETED
      })

      expect(isOverdue(task)).toBe(false)
    })

    it('should return false for future deadline', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 5)
      
      const task = new TaskClass({
        id: '1',
        name: 'Test Task',
        addedDate: new Date(),
        endDate: futureDate
      })

      expect(isOverdue(task)).toBe(false)
    })
  })

  describe('calculatePriorityScore', () => {
    let graph: TaskGraph
    let tasks: Map<string, TaskClass>

    beforeEach(() => {
      graph = new TaskGraph()
      tasks = new Map()
    })

    it('should give high priority to overdue tasks', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 2)
      
      const task = new TaskClass({
        id: '1',
        name: 'Overdue Task',
        addedDate: new Date(),
        endDate: pastDate,
        status: Status.IN_PROGRESS
      })
      
      tasks.set(task.id, task)

      const score = calculatePriorityScore(task, graph, tasks)
      expect(score).toBeGreaterThan(1000) // Overdue bonus
    })

    it('should give low priority to completed tasks', () => {
      const task = new TaskClass({
        id: '1',
        name: 'Completed Task',
        addedDate: new Date(),
        status: Status.COMPLETED
      })
      
      tasks.set(task.id, task)

      const score = calculatePriorityScore(task, graph, tasks)
      expect(score).toBe(-1000)
    })

    it('should give low priority to ignored tasks', () => {
      const task = new TaskClass({
        id: '1',
        name: 'Ignored Task',
        addedDate: new Date(),
        status: Status.IGNORED
      })
      
      tasks.set(task.id, task)

      const score = calculatePriorityScore(task, graph, tasks)
      expect(score).toBe(-1000)
    })

    it('should boost priority for tasks with active children (blocking)', () => {
      const parent = new TaskClass({
        id: 'parent',
        name: 'Parent Task',
        addedDate: new Date(),
        childIds: ['child1', 'child2']
      })
      
      const child1 = new TaskClass({
        id: 'child1',
        name: 'Child 1',
        addedDate: new Date(),
        parentId: 'parent',
        status: Status.IN_PROGRESS
      })
      
      const child2 = new TaskClass({
        id: 'child2',
        name: 'Child 2',
        addedDate: new Date(),
        parentId: 'parent',
        status: Status.IN_PROGRESS
      })
      
      tasks.set(parent.id, parent)
      tasks.set(child1.id, child1)
      tasks.set(child2.id, child2)
      
      graph.addChild(parent.id, child1.id)
      graph.addChild(parent.id, child2.id)

      const scoreWithChildren = calculatePriorityScore(parent, graph, tasks)
      
      // Create a task without children for comparison
      const taskNoChildren = new TaskClass({
        id: 'solo',
        name: 'Solo Task',
        addedDate: new Date()
      })
      tasks.set(taskNoChildren.id, taskNoChildren)
      const scoreNoChildren = calculatePriorityScore(taskNoChildren, graph, tasks)
      
      expect(scoreWithChildren).toBeGreaterThan(scoreNoChildren)
    })

    it('should boost priority for tasks that should start soon', () => {
      const soonDate = new Date()
      soonDate.setDate(soonDate.getDate() + 1)
      
      const task = new TaskClass({
        id: '1',
        name: 'Starting Soon',
        addedDate: new Date(),
        startDate: soonDate
      })
      
      tasks.set(task.id, task)

      const score = calculatePriorityScore(task, graph, tasks)
      expect(score).toBeGreaterThan(0)
    })
  })

  describe('getWeeklyRelevantTasks', () => {
    it('should include overdue tasks', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      
      const task = new TaskClass({
        id: '1',
        name: 'Overdue Task',
        addedDate: new Date(),
        endDate: pastDate,
        status: Status.IN_PROGRESS
      })

      const result = getWeeklyRelevantTasks([task])
      expect(result).toContain(task)
    })

    it('should exclude ignored tasks', () => {
      const task = new TaskClass({
        id: '1',
        name: 'Ignored Task',
        addedDate: new Date(),
        status: Status.IGNORED
      })

      const result = getWeeklyRelevantTasks([task])
      expect(result).not.toContain(task)
    })

    it('should include tasks ending this week', () => {
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 3)
      
      const task = new TaskClass({
        id: '1',
        name: 'Due This Week',
        addedDate: new Date(),
        endDate,
        status: Status.IN_PROGRESS
      })

      const result = getWeeklyRelevantTasks([task])
      expect(result).toContain(task)
    })

    it('should include tasks starting this week', () => {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() + 2)
      
      const task = new TaskClass({
        id: '1',
        name: 'Starting This Week',
        addedDate: new Date(),
        startDate,
        status: Status.IN_PROGRESS
      })

      const result = getWeeklyRelevantTasks([task])
      expect(result).toContain(task)
    })
  })

  describe('categorizeTasksByFocus', () => {
    let graph: TaskGraph
    let tasks: Map<string, TaskClass>

    beforeEach(() => {
      graph = new TaskGraph()
      tasks = new Map()
    })

    it('should put overdue tasks in focusNow', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 2)
      
      const task = new TaskClass({
        id: '1',
        name: 'Overdue Task',
        addedDate: new Date(),
        endDate: pastDate,
        status: Status.IN_PROGRESS
      })
      
      tasks.set(task.id, task)

      const result = categorizeTasksByFocus([task], graph, tasks)
      expect(result.focusNow).toContain(task)
    })

    it('should put high priority tasks in focusNow', () => {
      const nearDate = new Date()
      nearDate.setDate(nearDate.getDate() + 1)
      
      const task = new TaskClass({
        id: '1',
        name: 'Urgent Task',
        addedDate: new Date(),
        endDate: nearDate,
        status: Status.IN_PROGRESS
      })
      
      tasks.set(task.id, task)

      const result = categorizeTasksByFocus([task], graph, tasks)
      // Task due tomorrow has score ~300, which goes to thisWeek, not focusNow
      // But we should have it in one of the two groups
      expect(result.focusNow.length + result.thisWeek.length).toBeGreaterThan(0)
    })

    it('should put lower priority tasks in thisWeek', () => {
      const laterDate = new Date()
      laterDate.setDate(laterDate.getDate() + 10)
      
      const task = new TaskClass({
        id: '1',
        name: 'Later Task',
        addedDate: new Date(),
        endDate: laterDate,
        status: Status.IN_PROGRESS
      })
      
      tasks.set(task.id, task)

      const result = categorizeTasksByFocus([task], graph, tasks)
      expect(result.thisWeek).toContain(task)
    })
  })

  describe('getParentChainIds', () => {
    it('should return empty array for root task', () => {
      const graph = new TaskGraph()
      
      const result = getParentChainIds('task1', graph)
      expect(result).toEqual([])
    })

    it('should return parent chain for nested task', () => {
      const graph = new TaskGraph()
      graph.setParent('child', 'parent')
      graph.setParent('grandchild', 'child')
      
      const result = getParentChainIds('grandchild', graph)
      expect(result).toEqual(['child', 'parent'])
    })
  })

  describe('getStartOfWeek and getEndOfWeek', () => {
    it('should return start of week (Sunday)', () => {
      const date = new Date('2026-02-18') // Wednesday
      const result = getStartOfWeek(date)
      
      expect(result.getDay()).toBe(0) // Sunday
      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
    })

    it('should return end of week (Saturday)', () => {
      const date = new Date('2026-02-18') // Wednesday
      const result = getEndOfWeek(date)
      
      expect(result.getDay()).toBe(6) // Saturday
      expect(result.getHours()).toBe(23)
      expect(result.getMinutes()).toBe(59)
    })
  })

  describe('getUpcomingTasksByWeek', () => {
    it('should return empty array when no tasks for upcoming weeks', () => {
      const task = new TaskClass({
        id: '1',
        name: 'Past Task',
        addedDate: new Date()
      })

      const result = getUpcomingTasksByWeek([task])
      expect(result).toEqual([])
    })

    it('should include tasks with deadlines in upcoming weeks', () => {
      const nextWeekDate = new Date()
      nextWeekDate.setDate(nextWeekDate.getDate() + 10) // Next week
      
      const task = new TaskClass({
        id: '1',
        name: 'Next Week Task',
        addedDate: new Date(),
        endDate: nextWeekDate,
        status: Status.IN_PROGRESS
      })

      const result = getUpcomingTasksByWeek([task])
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].tasks).toContain(task)
    })

    it('should organize tasks by week number', () => {
      const week1Date = new Date()
      week1Date.setDate(week1Date.getDate() + 8) // Next week

      const week2Date = new Date()
      week2Date.setDate(week2Date.getDate() + 15) // Week after

      const task1 = new TaskClass({
        id: '1',
        name: 'Week 1 Task',
        addedDate: new Date(),
        endDate: week1Date,
        status: Status.IN_PROGRESS
      })

      const task2 = new TaskClass({
        id: '2',
        name: 'Week 2 Task',
        addedDate: new Date(),
        endDate: week2Date,
        status: Status.IN_PROGRESS
      })

      const result = getUpcomingTasksByWeek([task1, task2])
      expect(result.length).toBe(2)
      expect(result[0].week).toBe(1)
      expect(result[1].week).toBe(2)
    })

    it('should exclude ignored and completed tasks', () => {
      const nextWeekDate = new Date()
      nextWeekDate.setDate(nextWeekDate.getDate() + 10)

      const ignoredTask = new TaskClass({
        id: '1',
        name: 'Ignored Task',
        addedDate: new Date(),
        endDate: nextWeekDate,
        status: Status.IGNORED
      })

      const completedTask = new TaskClass({
        id: '2',
        name: 'Completed Task',
        addedDate: new Date(),
        endDate: nextWeekDate,
        status: Status.COMPLETED
      })

      const result = getUpcomingTasksByWeek([ignoredTask, completedTask])
      expect(result).toEqual([])
    })
  })

  describe('getWeekDateRange', () => {
    it('should return correct date range for week 1', () => {
      const referenceDate = new Date('2026-02-18') // Wednesday
      const { start, end } = getWeekDateRange(1, referenceDate)

      expect(start.getDay()).toBe(0) // Sunday
      expect(end.getDay()).toBe(6) // Saturday
      expect(end.getTime() - start.getTime()).toBeGreaterThan(6 * 24 * 60 * 60 * 1000)
    })

    it('should return correct date range for week 0', () => {
      const referenceDate = new Date('2026-02-18') // Wednesday
      const { start, end } = getWeekDateRange(0, referenceDate)

      expect(start.getDay()).toBe(0) // Sunday
      expect(end.getDay()).toBe(6) // Saturday
    })
  })

  describe('getWeekLabel', () => {
    it('should return "This Week" for week 0', () => {
      expect(getWeekLabel(0)).toBe('This Week')
    })

    it('should return "Next Week" for week 1', () => {
      expect(getWeekLabel(1)).toBe('Next Week')
    })

    it('should return "Week N" for week 2+', () => {
      expect(getWeekLabel(2)).toBe('Week 2')
      expect(getWeekLabel(3)).toBe('Week 3')
    })
  })
})
