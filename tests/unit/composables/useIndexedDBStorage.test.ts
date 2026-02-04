import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useIndexedDBStorage } from '@/composables/useIndexedDBStorage'
import { TaskClass, Status } from '@/models/TaskClass'
import { createMockTasks } from '../../mocks/task.mock'

const createIndexedDBStorageMock = () => ({
  getAllTasks: vi.fn().mockResolvedValue([]),
  getTask: vi.fn(),
  saveTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  init: vi.fn().mockResolvedValue(undefined),
})

let indexedDBMock = createIndexedDBStorageMock()

vi.mock('@/storage/local/indexeddb-storage', () => ({
  getIndexedDBStorage: vi.fn(() => indexedDBMock),
}))

describe('useIndexedDBStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    indexedDBMock = createIndexedDBStorageMock()
  })

  it('loads tasks from IndexedDB', async () => {
    const indexedDBTasks = [
      {
        url: 'task-1',
        title: 'Task 1',
        description: 'Description 1',
        dateCreated: '2024-01-01T00:00:00Z',
        startDate: undefined,
        endDate: undefined,
        status: undefined,
        subTaskUrls: [],
        parentTaskUrl: undefined,
        lastModified: '2024-01-01T00:00:00Z',
        syncStatus: 'synced' as const,
      },
    ]

    indexedDBMock.getAllTasks.mockResolvedValue(indexedDBTasks)

    const storage = useIndexedDBStorage()
    const tasks = await storage.loadLocal()

    expect(tasks).toHaveLength(1)
    expect(tasks[0].name).toBe('Task 1')
    expect(tasks[0].fullId).toBe('task-1')
  })

  it('saves a task to IndexedDB', async () => {
    const storage = useIndexedDBStorage()

    const task = new TaskClass({
      id: 'task-1',
      name: 'Test Task',
      addedDate: new Date('2024-01-01'),
      status: Status.IN_PROGRESS,
    })
    task.fullId = 'https://storage.example/tasks/task-1'

    await storage.saveLocal(task)

    expect(indexedDBMock.saveTask).toHaveBeenCalledWith({
      url: 'https://storage.example/tasks/task-1',
      title: 'Test Task',
      description: undefined,
      dateCreated: new Date('2024-01-01'),
      startDate: undefined,
      endDate: undefined,
      status: Status.IN_PROGRESS,
      subTaskUrls: [],
      parentTaskUrl: undefined,
    })
  })

  it('saves multiple tasks to IndexedDB', async () => {
    const storage = useIndexedDBStorage()

    const tasks = [
      new TaskClass({
        id: 'task-1',
        name: 'Task 1',
        addedDate: new Date(),
      }),
      new TaskClass({
        id: 'task-2',
        name: 'Task 2',
        addedDate: new Date(),
      }),
    ]

    await storage.saveLocalBatch(tasks)

    expect(indexedDBMock.saveTask).toHaveBeenCalledTimes(2)
  })

  it('deletes a task from IndexedDB', async () => {
    const storage = useIndexedDBStorage()

    await storage.deleteLocal('task-1')

    expect(indexedDBMock.deleteTask).toHaveBeenCalledWith('task-1')
  })

  it('handles errors when loading', async () => {
    indexedDBMock.getAllTasks.mockRejectedValue(
      new Error('Database error'),
    )

    const storage = useIndexedDBStorage()

    await expect(storage.loadLocal()).rejects.toThrow('Database error')
    expect(storage.error.value).toBe('Database error')
  })

  it('handles errors when saving', async () => {
    indexedDBMock.saveTask.mockRejectedValue(
      new Error('Save failed'),
    )

    const storage = useIndexedDBStorage()

    const task = new TaskClass({
      id: 'task-1',
      name: 'Test Task',
      addedDate: new Date(),
    })

    await expect(storage.saveLocal(task)).rejects.toThrow('Save failed')
    expect(storage.error.value).toBe('Save failed')
  })

  it('converts IndexedDB results with parent/child relationships', async () => {
    const indexedDBTasks = [
      {
        url: 'task-1',
        title: 'Parent Task',
        dateCreated: '2024-01-01T00:00:00Z',
        description: undefined,
        startDate: undefined,
        endDate: undefined,
        status: undefined,
        subTaskUrls: ['task-2'],
        parentTaskUrl: undefined,
        lastModified: '2024-01-01T00:00:00Z',
        syncStatus: 'synced' as const,
      },
      {
        url: 'task-2',
        title: 'Child Task',
        dateCreated: '2024-01-01T00:00:00Z',
        description: undefined,
        startDate: undefined,
        endDate: undefined,
        status: undefined,
        subTaskUrls: [],
        parentTaskUrl: 'task-1',
        lastModified: '2024-01-01T00:00:00Z',
        syncStatus: 'synced' as const,
      },
    ]

    indexedDBMock.getAllTasks.mockResolvedValue(indexedDBTasks)

    const storage = useIndexedDBStorage()
    const tasks = await storage.loadLocal()

    expect(tasks).toHaveLength(2)
    expect(tasks[0].childIds).toContain('task-2')
    expect(tasks[1].parentId).toBe('task-1')
  })
})
