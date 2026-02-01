import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IndexedDBTaskStorage } from '@/storage/local/indexeddb-storage'

describe('IndexedDBTaskStorage', () => {
  let storage: IndexedDBTaskStorage
  type MockDb = {
    put: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
    getAll: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
  let mockDb: MockDb

  beforeEach(async () => {
    // Create a fresh instance for each test
    storage = new IndexedDBTaskStorage()

    // Mock the database
    mockDb = {
      put: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      delete: vi.fn(),
    }

    // Initialize with mock db
    ;(storage as unknown as { db: MockDb }).db = mockDb
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('saveTask with Date/string union types', () => {
    it('should accept Date objects and convert to ISO strings', async () => {
      const testDate = new Date('2026-01-15T10:00:00.000Z')

      await storage.saveTask({
        url: 'https://example.com/task1',
        title: 'Test Task',
        dateCreated: testDate,
        startDate: testDate,
        endDate: testDate,
      })

      expect(mockDb.put).toHaveBeenCalledWith(
        'tasks',
        expect.objectContaining({
          url: 'https://example.com/task1',
          title: 'Test Task',
          dateCreated: '2026-01-15T10:00:00.000Z',
          startDate: '2026-01-15T10:00:00.000Z',
          endDate: '2026-01-15T10:00:00.000Z',
          syncStatus: 'pending',
        }),
      )
    })

    it('should accept ISO string dates and preserve them', async () => {
      const isoString = '2026-01-15T10:00:00.000Z'

      await storage.saveTask({
        url: 'https://example.com/task2',
        title: 'Test Task 2',
        dateCreated: isoString,
        startDate: isoString,
        endDate: isoString,
      })

      expect(mockDb.put).toHaveBeenCalledWith(
        'tasks',
        expect.objectContaining({
          url: 'https://example.com/task2',
          title: 'Test Task 2',
          dateCreated: isoString,
          startDate: isoString,
          endDate: isoString,
          syncStatus: 'pending',
        }),
      )
    })

    it('should handle mixed Date objects and ISO strings', async () => {
      const dateObj = new Date('2026-01-15T10:00:00.000Z')
      const isoString = '2026-01-20T15:30:00.000Z'

      await storage.saveTask({
        url: 'https://example.com/task3',
        title: 'Mixed Dates',
        dateCreated: dateObj,
        startDate: isoString,
        endDate: dateObj,
      })

      expect(mockDb.put).toHaveBeenCalledWith(
        'tasks',
        expect.objectContaining({
          dateCreated: '2026-01-15T10:00:00.000Z',
          startDate: '2026-01-20T15:30:00.000Z',
          endDate: '2026-01-15T10:00:00.000Z',
        }),
      )
    })

    it('should handle undefined dates', async () => {
      await storage.saveTask({
        url: 'https://example.com/task4',
        title: 'No Dates',
        dateCreated: undefined,
        startDate: undefined,
        endDate: undefined,
      })

      expect(mockDb.put).toHaveBeenCalledWith(
        'tasks',
        expect.objectContaining({
          url: 'https://example.com/task4',
          title: 'No Dates',
          dateCreated: undefined,
          startDate: undefined,
          endDate: undefined,
        }),
      )
    })

    it('should add lastModified and syncStatus to saved tasks', async () => {
      const beforeSave = Date.now()

      await storage.saveTask({
        url: 'https://example.com/task5',
        title: 'Status Test',
      })

      const afterSave = Date.now()
      const savedData = mockDb.put.mock.calls[0][1]

      expect(savedData.syncStatus).toBe('pending')
      expect(savedData.lastModified).toBeDefined()

      const lastModifiedTime = new Date(savedData.lastModified).getTime()
      expect(lastModifiedTime).toBeGreaterThanOrEqual(beforeSave)
      expect(lastModifiedTime).toBeLessThanOrEqual(afterSave)
    })

    it('should handle all task properties correctly', async () => {
      await storage.saveTask({
        url: 'https://example.com/task6',
        title: 'Complete Task',
        description: 'Full description',
        priority: 5,
        dateCreated: new Date('2026-01-01T00:00:00.000Z'),
        startDate: '2026-01-15T10:00:00.000Z',
        endDate: new Date('2026-01-31T23:59:59.999Z'),
        status: 'in-progress',
        subTaskUrls: [
          'https://example.com/subtask1',
          'https://example.com/subtask2',
        ],
        parentTaskUrl: 'https://example.com/parent',
      })

      expect(mockDb.put).toHaveBeenCalledWith(
        'tasks',
        expect.objectContaining({
          url: 'https://example.com/task6',
          title: 'Complete Task',
          description: 'Full description',
          priority: 5,
          dateCreated: '2026-01-01T00:00:00.000Z',
          startDate: '2026-01-15T10:00:00.000Z',
          endDate: '2026-01-31T23:59:59.999Z',
          status: 'in-progress',
          subTaskUrls: [
            'https://example.com/subtask1',
            'https://example.com/subtask2',
          ],
          parentTaskUrl: 'https://example.com/parent',
          syncStatus: 'pending',
        }),
      )
    })
  })

  describe('markAsSynced', () => {
    it('should update syncStatus to synced', async () => {
      const existingTask = {
        url: 'https://example.com/task1',
        title: 'Task',
        lastModified: new Date().toISOString(),
        syncStatus: 'pending' as const,
      }

      mockDb.get = vi.fn().mockResolvedValue(existingTask)

      await storage.markAsSynced('https://example.com/task1')

      expect(mockDb.put).toHaveBeenCalledWith(
        'tasks',
        expect.objectContaining({
          url: 'https://example.com/task1',
          syncStatus: 'synced',
        }),
      )
    })

    it('should do nothing if task does not exist', async () => {
      mockDb.get = vi.fn().mockResolvedValue(undefined)

      await storage.markAsSynced('https://example.com/nonexistent')

      expect(mockDb.put).not.toHaveBeenCalled()
    })
  })

  describe('getAllTasks', () => {
    it('should return all tasks from database', async () => {
      const tasks = [
        {
          url: 'task1',
          title: 'Task 1',
          lastModified: '2026-01-01',
          syncStatus: 'synced' as const,
        },
        {
          url: 'task2',
          title: 'Task 2',
          lastModified: '2026-01-02',
          syncStatus: 'pending' as const,
        },
      ]

      mockDb.getAll = vi.fn().mockResolvedValue(tasks)

      const result = await storage.getAllTasks()

      expect(result).toEqual(tasks)
      expect(mockDb.getAll).toHaveBeenCalledWith('tasks')
    })

    it('should return empty array if database is empty', async () => {
      mockDb.getAll = vi.fn().mockResolvedValue([])

      const result = await storage.getAllTasks()

      expect(result).toEqual([])
    })
  })

  describe('deleteTask', () => {
    it('should delete task by URL', async () => {
      await storage.deleteTask('https://example.com/task1')

      expect(mockDb.delete).toHaveBeenCalledWith(
        'tasks',
        'https://example.com/task1',
      )
    })
  })
})
