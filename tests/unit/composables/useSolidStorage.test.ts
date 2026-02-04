import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import '../../mocks/solid-session.mock'
import { setupPinia } from '../../helpers/pinia'
import { useSolidStorage } from '@/composables/useSolidStorage'
import { TaskClass, Status } from '@/models/TaskClass'
import { createMockTasks } from '../../mocks/task.mock'
import { createSolidTaskService } from '@/storage/soukai/soukai-storage'
import { findStorage } from '@renyuneyun/solid-helper'
import { sessionState } from '../../mocks/solid-session.mock'

const createServiceMock = (tasks: TaskClass[] = []) => ({
  loadTasksAsTaskClasses: vi.fn().mockResolvedValue({
    taskClasses: tasks,
    graph: {},
  }),
  saveTaskClasses: vi.fn(),
  saveTaskClass: vi.fn(),
  deleteTask: vi.fn(),
})

const authenticateSession = () => {
  sessionState.webid = 'https://user.example/profile#me'
  sessionState.session = { fetch: vi.fn() as unknown as typeof fetch }
}

describe('useSolidStorage', () => {
  const createSolidTaskServiceMock =
    createSolidTaskService as unknown as ReturnType<typeof vi.fn>
  const findStorageMock = findStorage as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    setupPinia()
    sessionState.webid = null
    sessionState.session = null
    vi.clearAllMocks()
  })

  it('initializes service when authenticated', async () => {
    authenticateSession()

    const serviceMock = createServiceMock()
    findStorageMock.mockResolvedValue('https://storage.example/')
    createSolidTaskServiceMock.mockReturnValue(serviceMock)

    const solidStorage = useSolidStorage()

    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(solidStorage.isAuthenticated.value).toBe(true)
    expect(solidStorage.hasService.value).toBe(true)
    expect(solidStorage.getService()).toEqual(serviceMock)
  })

  it('loads tasks from Solid Pod', async () => {
    authenticateSession()

    const tasks = createMockTasks(2)
    const serviceMock = createServiceMock(tasks)
    findStorageMock.mockResolvedValue('https://storage.example/')
    createSolidTaskServiceMock.mockReturnValue(serviceMock)

    const solidStorage = useSolidStorage()

    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 10))

    const loadedTasks = await solidStorage.loadRemote()

    expect(loadedTasks).toHaveLength(2)
    expect(serviceMock.loadTasksAsTaskClasses).toHaveBeenCalled()
  })

  it('saves a task to Solid Pod', async () => {
    authenticateSession()

    const serviceMock = createServiceMock()
    findStorageMock.mockResolvedValue('https://storage.example/')
    createSolidTaskServiceMock.mockReturnValue(serviceMock)

    const solidStorage = useSolidStorage()

    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 10))

    const task = new TaskClass({
      id: 'task-1',
      name: 'Test Task',
      addedDate: new Date(),
    })

    await solidStorage.saveRemote(task)

    expect(serviceMock.saveTaskClass).toHaveBeenCalledWith(task)
  })

  it('saves multiple tasks to Solid Pod', async () => {
    authenticateSession()

    const serviceMock = createServiceMock()
    findStorageMock.mockResolvedValue('https://storage.example/')
    createSolidTaskServiceMock.mockReturnValue(serviceMock)

    const solidStorage = useSolidStorage()

    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 10))

    const tasks = createMockTasks(2)

    await solidStorage.saveRemoteBatch(tasks)

    expect(serviceMock.saveTaskClasses).toHaveBeenCalledWith(tasks)
  })

  it('deletes a task from Solid Pod', async () => {
    authenticateSession()

    const serviceMock = createServiceMock()
    findStorageMock.mockResolvedValue('https://storage.example/')
    createSolidTaskServiceMock.mockReturnValue(serviceMock)

    const solidStorage = useSolidStorage()

    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 10))

    await solidStorage.deleteRemote('task-1')

    expect(serviceMock.deleteTask).toHaveBeenCalledWith('task-1')
  })

  it('clears service on logout', async () => {
    authenticateSession()

    const serviceMock = createServiceMock()
    findStorageMock.mockResolvedValue('https://storage.example/')
    createSolidTaskServiceMock.mockReturnValue(serviceMock)

    const solidStorage = useSolidStorage()

    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(solidStorage.hasService.value).toBe(true)

    sessionState.webid = null
    sessionState.session = null

    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(solidStorage.isAuthenticated.value).toBe(false)
    expect(solidStorage.hasService.value).toBe(false)
  })

  it('throws error when trying to load without service', async () => {
    const solidStorage = useSolidStorage()

    await expect(solidStorage.loadRemote()).rejects.toThrow(
      'Solid service not initialized',
    )
  })

  it('throws error when trying to save without service', async () => {
    const solidStorage = useSolidStorage()

    const task = new TaskClass({
      id: 'task-1',
      name: 'Test Task',
      addedDate: new Date(),
    })

    await expect(solidStorage.saveRemote(task)).rejects.toThrow(
      'Solid service not initialized',
    )
  })
})
