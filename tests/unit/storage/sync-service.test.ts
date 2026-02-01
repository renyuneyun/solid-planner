import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SyncService } from '@/storage/sync/sync-service'
import type { IndexedDBTaskStorage } from '@/storage/local/indexeddb-storage'
import Task from '@/storage/soukai/Task.model'
import { TaskClass, Status } from '@/models/TaskClass'

// Mock IndexedDB storage
vi.mock('@/storage/local/indexeddb-storage', () => ({
  IndexedDBTaskStorage: vi.fn().mockImplementation(() => ({
    saveTask: vi.fn(),
    getAllTasks: vi.fn().mockResolvedValue([]),
    deleteTask: vi.fn(),
    markAsSynced: vi.fn(),
    setLastSyncTime: vi.fn(),
  })),
}))

// Mock Soukai Task model
vi.mock('@/storage/soukai/Task.model', () => ({
  default: vi.fn().mockImplementation(() => ({
    save: vi.fn(),
    url: undefined,
    title: '',
    description: undefined,
    priority: undefined,
    dateCreated: undefined,
    startDate: undefined,
    endDate: undefined,
    status: undefined,
    subTaskUrls: undefined,
    parentTaskUrl: undefined,
    createdAt: undefined,
    updatedAt: undefined,
  })),
}))

describe('SyncService', () => {
  type MockLocalStore = {
    saveTask: ReturnType<typeof vi.fn>
    getAllTasks: ReturnType<typeof vi.fn>
    deleteTask: ReturnType<typeof vi.fn>
    markAsSynced: ReturnType<typeof vi.fn>
    setLastSyncTime: ReturnType<typeof vi.fn>
  }

  type MockRemoteService = {
    getTaskContainerUrl: ReturnType<typeof vi.fn>
    fetchTasks: ReturnType<typeof vi.fn>
    deleteTask: ReturnType<typeof vi.fn>
  }

  let syncService: SyncService
  let mockLocalStore: MockLocalStore
  let mockRemoteService: MockRemoteService

  beforeEach(() => {
    mockLocalStore = {
      saveTask: vi.fn(),
      getAllTasks: vi.fn().mockResolvedValue([]),
      deleteTask: vi.fn(),
      markAsSynced: vi.fn(),
      setLastSyncTime: vi.fn(),
    }

    mockRemoteService = {
      getTaskContainerUrl: vi
        .fn()
        .mockReturnValue('https://pod.example/tasks/'),
      fetchTasks: vi.fn().mockResolvedValue([]),
      deleteTask: vi.fn(),
    }

    syncService = new SyncService(
      mockLocalStore as unknown as IndexedDBTaskStorage,
      mockRemoteService,
    )
  })

  describe('saveLocal with Date/string handling', () => {
    it('should save TaskClass with Date objects to storage', async () => {
      const task = new TaskClass({
        id: 'test-1',
        name: 'Test Task',
        description: 'Test description',
        addedDate: new Date('2026-01-15T10:00:00.000Z'),
        startDate: new Date('2026-01-20T09:00:00.000Z'),
        endDate: new Date('2026-01-25T17:00:00.000Z'),
        status: Status.IN_PROGRESS,
      })
      task.fullId = 'https://example.com/task1'

      await syncService.saveLocal(task)

      expect(mockLocalStore.saveTask).toHaveBeenCalledWith({
        url: 'https://example.com/task1',
        title: 'Test Task',
        description: 'Test description',
        dateCreated: task.addedDate,
        startDate: task.startDate,
        endDate: task.endDate,
        status: Status.IN_PROGRESS,
        subTaskUrls: undefined,
        parentTaskUrl: undefined,
      })
    })

    it('should use temp: URL for tasks without fullId', async () => {
      const task = new TaskClass({
        id: 'temp-123',
        name: 'New Task',
        addedDate: new Date('2026-01-15T10:00:00.000Z'),
      })

      await syncService.saveLocal(task)

      expect(mockLocalStore.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'temp:temp-123',
          title: 'New Task',
        }),
      )
    })

    it('should convert childIds array to plain array', async () => {
      const task = new TaskClass({
        id: 'parent-1',
        name: 'Parent Task',
        addedDate: new Date('2026-01-15T10:00:00.000Z'),
      })
      task.fullId = 'https://example.com/parent'
      task.childIds = [
        'https://example.com/child1',
        'https://example.com/child2',
      ]

      await syncService.saveLocal(task)

      expect(mockLocalStore.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          subTaskUrls: [
            'https://example.com/child1',
            'https://example.com/child2',
          ],
        }),
      )
    })

    it('should handle empty childIds', async () => {
      const task = new TaskClass({
        id: 'task-1',
        name: 'Solo Task',
        addedDate: new Date('2026-01-15T10:00:00.000Z'),
      })
      task.fullId = 'https://example.com/solo'

      await syncService.saveLocal(task)

      expect(mockLocalStore.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          subTaskUrls: undefined,
        }),
      )
    })

    it('should include parentTaskUrl if set', async () => {
      const task = new TaskClass({
        id: 'child-1',
        name: 'Child Task',
        addedDate: new Date('2026-01-15T10:00:00.000Z'),
      })
      task.fullId = 'https://example.com/child'
      task.parentId = 'https://example.com/parent'

      await syncService.saveLocal(task)

      expect(mockLocalStore.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          parentTaskUrl: 'https://example.com/parent',
        }),
      )
    })
  })

  describe('sync - Phase 2: URL mapping with spread', () => {
    it('should update temp: URLs to real URLs after creating in remote', async () => {
      const localTask = {
        url: 'temp:123',
        title: 'New Task',
        description: 'Created offline',
        dateCreated: '2026-01-15T10:00:00.000Z', // ISO string from IndexedDB
        startDate: '2026-01-20T09:00:00.000Z',
        endDate: undefined,
        status: 'pending',
        subTaskUrls: undefined,
        parentTaskUrl: undefined,
        lastModified: '2026-01-15T10:05:00.000Z',
        syncStatus: 'pending' as const,
      }

      mockLocalStore.getAllTasks.mockResolvedValue([localTask])

      // Mock remote task creation
      const mockRemoteTask = new Task()
      mockRemoteTask.url = 'https://pod.example/tasks/real-id-123'
      mockRemoteTask.title = 'New Task'
      mockRemoteTask.save = vi.fn().mockImplementation(() => {
        mockRemoteTask.url = 'https://pod.example/tasks/real-id-123'
        return Promise.resolve()
      })

      vi.mocked(Task).mockReturnValue(mockRemoteTask)

      await syncService.sync()

      // Should delete old temp: URL
      expect(mockLocalStore.deleteTask).toHaveBeenCalledWith('temp:123')

      // Should save with new URL, spreading the task data (ISO strings should work)
      expect(mockLocalStore.saveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://pod.example/tasks/real-id-123',
          title: 'New Task',
          description: 'Created offline',
          dateCreated: '2026-01-15T10:00:00.000Z', // Should accept ISO string
          startDate: '2026-01-20T09:00:00.000Z',
        }),
      )

      // Should mark as synced
      expect(mockLocalStore.markAsSynced).toHaveBeenCalledWith(
        'https://pod.example/tasks/real-id-123',
      )
    })

    it('should handle multiple temp tasks being updated', async () => {
      const localTasks = [
        {
          url: 'temp:abc',
          title: 'Task A',
          dateCreated: '2026-01-15T10:00:00.000Z',
          lastModified: '2026-01-15T10:05:00.000Z',
          syncStatus: 'pending' as const,
        },
        {
          url: 'temp:def',
          title: 'Task B',
          dateCreated: '2026-01-15T11:00:00.000Z',
          lastModified: '2026-01-15T11:05:00.000Z',
          syncStatus: 'pending' as const,
        },
      ]

      mockLocalStore.getAllTasks.mockResolvedValue(localTasks)

      let callCount = 0
      const TaskConstructor = vi.mocked(Task)
      TaskConstructor.mockImplementation(() => {
        const mockTask = {
          url: `https://pod.example/tasks/real-${callCount++}`,
          title: '',
          save: vi.fn().mockResolvedValue(undefined),
        } as unknown as Task
        return mockTask
      })

      await syncService.sync()

      expect(mockLocalStore.deleteTask).toHaveBeenCalledWith('temp:abc')
      expect(mockLocalStore.deleteTask).toHaveBeenCalledWith('temp:def')
      expect(mockLocalStore.saveTask).toHaveBeenCalledTimes(2)
    })
  })

  describe('sync - Phase 3: pull remote tasks', () => {
    it('should add remote tasks to local storage with dates preserved', async () => {
      const remoteTask = new Task()
      remoteTask.url = 'https://example.com/remote-task'
      remoteTask.title = 'Remote Task'
      remoteTask.description = 'From server'
      remoteTask.priority = 3
      remoteTask.dateCreated = new Date('2026-01-10T08:00:00.000Z')
      remoteTask.startDate = new Date('2026-01-15T09:00:00.000Z')
      remoteTask.endDate = new Date('2026-01-20T17:00:00.000Z')
      remoteTask.status = 'active'
      remoteTask.subTaskUrls = ['https://example.com/sub1']
      remoteTask.parentTaskUrl = 'https://example.com/parent'

      mockRemoteService.fetchTasks.mockResolvedValue([remoteTask])
      mockLocalStore.getAllTasks.mockResolvedValue([])

      await syncService.sync()

      expect(mockLocalStore.saveTask).toHaveBeenCalledWith({
        url: 'https://example.com/remote-task',
        title: 'Remote Task',
        description: 'From server',
        priority: 3,
        dateCreated: remoteTask.dateCreated,
        startDate: remoteTask.startDate,
        endDate: remoteTask.endDate,
        status: 'active',
        subTaskUrls: ['https://example.com/sub1'],
        parentTaskUrl: 'https://example.com/parent',
      })
      expect(mockLocalStore.markAsSynced).toHaveBeenCalledWith(
        'https://example.com/remote-task',
      )
    })
  })

  describe('loadLocal with Date conversion', () => {
    it('should convert ISO strings from IndexedDB to Date objects', async () => {
      const storedTasks = [
        {
          url: 'https://example.com/task1',
          title: 'Stored Task',
          description: 'From IndexedDB',
          dateCreated: '2026-01-15T10:00:00.000Z', // ISO string
          startDate: '2026-01-20T09:00:00.000Z',
          endDate: '2026-01-25T17:00:00.000Z',
          status: 'active',
          subTaskUrls: ['https://example.com/sub1'],
          parentTaskUrl: 'https://example.com/parent',
          lastModified: '2026-01-15T10:05:00.000Z',
          syncStatus: 'synced' as const,
        },
      ]

      mockLocalStore.getAllTasks.mockResolvedValue(storedTasks)

      const tasks = await syncService.loadLocal()

      expect(tasks).toHaveLength(1)
      const task = tasks[0]

      // Should be TaskClass instances with Date objects
      expect(task).toBeInstanceOf(TaskClass)
      expect(task.name).toBe('Stored Task')
      expect(task.description).toBe('From IndexedDB')
      expect(task.addedDate).toBeInstanceOf(Date)
      expect(task.addedDate?.toISOString()).toBe('2026-01-15T10:00:00.000Z')
      expect(task.startDate).toBeInstanceOf(Date)
      expect(task.startDate?.toISOString()).toBe('2026-01-20T09:00:00.000Z')
      expect(task.endDate).toBeInstanceOf(Date)
      expect(task.fullId).toBe('https://example.com/task1')
      expect(task.childIds).toEqual(['https://example.com/sub1'])
      expect(task.parentId).toBe('https://example.com/parent')
    })

    it('should handle tasks without dates', async () => {
      const storedTasks = [
        {
          url: 'https://example.com/task2',
          title: 'No Dates',
          dateCreated: undefined,
          startDate: undefined,
          endDate: undefined,
          lastModified: '2026-01-15T10:00:00.000Z',
          syncStatus: 'synced' as const,
        },
      ]

      mockLocalStore.getAllTasks.mockResolvedValue(storedTasks)

      const tasks = await syncService.loadLocal()

      expect(tasks).toHaveLength(1)
      const task = tasks[0]

      expect(task.name).toBe('No Dates')
      expect(task.addedDate).toBeInstanceOf(Date) // Default to current date
      expect(task.startDate).toBeUndefined()
      expect(task.endDate).toBeUndefined()
    })

    it('should convert plain array childIds', async () => {
      const storedTasks = [
        {
          url: 'https://example.com/parent',
          title: 'Parent',
          subTaskUrls: ['child1', 'child2', 'child3'],
          lastModified: '2026-01-15T10:00:00.000Z',
          syncStatus: 'synced' as const,
        },
      ]

      mockLocalStore.getAllTasks.mockResolvedValue(storedTasks)

      const tasks = await syncService.loadLocal()

      expect(tasks[0].childIds).toEqual(['child1', 'child2', 'child3'])
      // Should be a plain array, not a proxy
      expect(Array.isArray(tasks[0].childIds)).toBe(true)
    })
  })

  describe('sync status management', () => {
    it('should update status to syncing during sync', async () => {
      const statusChanges: string[] = []
      syncService.onStatusChange(status => statusChanges.push(status))

      const syncPromise = syncService.sync()

      expect(syncService.getStatus()).toBe('syncing')

      await syncPromise

      expect(statusChanges).toContain('syncing')
      expect(statusChanges).toContain('idle')
    })

    it('should update status to offline when no remote service', async () => {
      syncService.setRemoteService(null)

      await syncService.sync()

      expect(syncService.getStatus()).toBe('offline')
    })

    it('should update status to error on sync failure', async () => {
      mockRemoteService.fetchTasks.mockRejectedValue(new Error('Network error'))

      await expect(syncService.sync()).rejects.toThrow('Network error')

      expect(syncService.getStatus()).toBe('error')
      expect(syncService.getLastError()?.message).toBe('Network error')
    })
  })
})
