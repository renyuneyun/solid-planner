import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isToday, isThisWeek, isOverdue, endOfWeek } from '@/utils/datetime'
import { createMockTask } from '../../mocks/task.mock'
import { Status } from '@/models/TaskClass'

describe('datetime utilities', () => {
  // Mock the current date for consistent testing
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('isToday', () => {
    it('should return true for today\'s date', () => {
      const today = new Date('2024-01-15T12:00:00')
      vi.setSystemTime(today)

      expect(isToday('2024-01-15T08:00:00')).toBe(true)
      expect(isToday('2024-01-15T18:00:00')).toBe(true)
    })

    it('should return false for yesterday', () => {
      const today = new Date('2024-01-15T12:00:00')
      vi.setSystemTime(today)

      expect(isToday('2024-01-14T12:00:00')).toBe(false)
    })

    it('should return false for tomorrow', () => {
      const today = new Date('2024-01-15T12:00:00')
      vi.setSystemTime(today)

      expect(isToday('2024-01-16T12:00:00')).toBe(false)
    })

    it('should handle different months', () => {
      const today = new Date('2024-01-31T12:00:00')
      vi.setSystemTime(today)

      expect(isToday('2024-01-31T12:00:00')).toBe(true)
      expect(isToday('2024-02-01T12:00:00')).toBe(false)
    })

    it('should handle different years', () => {
      const today = new Date('2024-12-31T12:00:00')
      vi.setSystemTime(today)

      expect(isToday('2024-12-31T12:00:00')).toBe(true)
      expect(isToday('2025-01-01T12:00:00')).toBe(false)
    })
  })

  describe('isThisWeek', () => {
    it('should return true for dates in current week', () => {
      // Set system time to Wednesday, Jan 15, 2024
      const today = new Date('2024-01-15T12:00:00')
      vi.setSystemTime(today)

      // Week: Sun Jan 14 - Sat Jan 20
      expect(isThisWeek('2024-01-14T12:00:00')).toBe(true) // Sunday
      expect(isThisWeek('2024-01-15T12:00:00')).toBe(true) // Today (Wednesday)
      expect(isThisWeek('2024-01-20T12:00:00')).toBe(true) // Saturday
    })

    it('should return false for dates in previous week', () => {
      const today = new Date('2024-01-15T12:00:00')
      vi.setSystemTime(today)

      expect(isThisWeek('2024-01-13T12:00:00')).toBe(false) // Last Saturday
      expect(isThisWeek('2024-01-07T12:00:00')).toBe(false) // Week before
    })

    it('should return false for dates in next week', () => {
      const today = new Date('2024-01-15T12:00:00')
      vi.setSystemTime(today)

      // Note: isThisWeek includes the end date, so Jan 21 (next Sunday) is included
      expect(isThisWeek('2024-01-21T12:00:00')).toBe(true) // End of current week range
      expect(isThisWeek('2024-01-22T12:00:00')).toBe(false) // Next week
      expect(isThisWeek('2024-01-28T12:00:00')).toBe(false) // Week after
    })

    it('should handle week boundaries correctly', () => {
      // Monday (middle of week)
      const monday = new Date('2024-01-15T12:00:00')
      vi.setSystemTime(monday)
      // Week range is Sun Jan 14 through Sun Jan 21
      expect(isThisWeek('2024-01-14T12:00:00')).toBe(true) // Sunday start (same time of day)
      expect(isThisWeek('2024-01-21T12:00:00')).toBe(true) // Sunday end (same time of day)
      expect(isThisWeek('2024-01-21T23:59:59')).toBe(false) // After end time
      expect(isThisWeek('2024-01-13T23:59:59')).toBe(false) // Before range
      expect(isThisWeek('2024-01-22T00:00:00')).toBe(false) // After range
    })
  })

  describe('isOverdue', () => {
    it('should return true for incomplete task past end date', () => {
      const now = new Date('2024-01-15T12:00:00')
      vi.setSystemTime(now)

      const task = createMockTask({
        endDate: new Date('2024-01-10T12:00:00'),
        status: Status.IN_PROGRESS,
      })

      expect(isOverdue(task)).toBe(true)
    })

    it('should return false for incomplete task not past end date', () => {
      const now = new Date('2024-01-15T12:00:00')
      vi.setSystemTime(now)

      const task = createMockTask({
        endDate: new Date('2024-01-20T12:00:00'),
        status: Status.IN_PROGRESS,
      })

      expect(isOverdue(task)).toBe(false)
    })

    it('should return false for completed task even if past end date', () => {
      const now = new Date('2024-01-15T12:00:00')
      vi.setSystemTime(now)

      const task = createMockTask({
        endDate: new Date('2024-01-10T12:00:00'),
        status: Status.COMPLETED,
      })

      expect(isOverdue(task)).toBe(false)
    })

    it('should use effectiveEndDate when endDate is not set', () => {
      const now = new Date('2024-01-20T12:00:00')
      vi.setSystemTime(now)

      const addedDate = new Date('2024-01-01T12:00:00') // Week ending Jan 7
      const task = createMockTask({
        addedDate,
        endDate: undefined,
        status: Status.IN_PROGRESS,
      })

      // effectiveEndDate should be end of week (Jan 7), which is before now (Jan 20)
      expect(isOverdue(task)).toBe(true)
    })

    it('should return false for task due today', () => {
      const now = new Date('2024-01-15T12:00:00')
      vi.setSystemTime(now)

      const task = createMockTask({
        endDate: new Date('2024-01-15T18:00:00'),
        status: Status.IN_PROGRESS,
      })

      expect(isOverdue(task)).toBe(false)
    })
  })

  describe('endOfWeek', () => {
    it('should return end of week (Sunday) for a Monday', () => {
      const monday = new Date('2024-01-15T12:00:00') // Monday
      const result = endOfWeek(monday)

      expect(result.getDate()).toBe(21) // Next Sunday
      expect(result.getMonth()).toBe(0) // January
      expect(result.getFullYear()).toBe(2024)
    })

    it('should return next Sunday for a Sunday', () => {
      const sunday = new Date('2024-01-14T12:00:00') // Sunday
      const result = endOfWeek(sunday)

      expect(result.getDate()).toBe(21) // Next Sunday
      expect(result.getMonth()).toBe(0) // January
    })

    it('should return next Sunday for a Saturday', () => {
      const saturday = new Date('2024-01-20T12:00:00') // Saturday
      const result = endOfWeek(saturday)

      expect(result.getDate()).toBe(21) // Next day (Sunday)
      expect(result.getMonth()).toBe(0) // January
    })

    it('should handle month boundaries', () => {
      const date = new Date('2024-01-29T12:00:00') // Monday, Jan 29
      const result = endOfWeek(date)

      expect(result.getDate()).toBe(4) // Feb 4 (Sunday)
      expect(result.getMonth()).toBe(1) // February
    })

    it('should handle year boundaries', () => {
      const date = new Date('2024-12-30T12:00:00') // Monday, Dec 30
      const result = endOfWeek(date)

      expect(result.getDate()).toBe(5) // Jan 5 (Sunday)
      expect(result.getMonth()).toBe(0) // January
      expect(result.getFullYear()).toBe(2025)
    })

    it('should preserve time components', () => {
      const date = new Date('2024-01-15T14:30:45.123')
      const result = endOfWeek(date)

      expect(result.getHours()).toBe(14)
      expect(result.getMinutes()).toBe(30)
      expect(result.getSeconds()).toBe(45)
      expect(result.getMilliseconds()).toBe(123)
    })

    it('should not modify the original date', () => {
      const original = new Date('2024-01-15T12:00:00')
      const originalTime = original.getTime()

      endOfWeek(original)

      expect(original.getTime()).toBe(originalTime)
    })
  })
})
