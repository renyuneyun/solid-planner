import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import '../../mocks/solid-session.mock'
import { setupPinia } from '../../helpers/pinia'
import { useSolidTasks } from '@/composables/useSolidTasks'
import { useTaskStore } from '@/stores/tasks'
import { TaskGraph } from '@/models/TaskGraph'
import { TaskClass, Status } from '@/models/TaskClass'
import { createMockTasks } from '../../mocks/task.mock'
import { createSolidTaskService } from '@/storage/soukai/soukai-storage'
import { findStorage } from '@renyuneyun/solid-helper'
import { sessionState } from '../../mocks/solid-session.mock'

const createSyncServiceMock = () => ({
  loadLocal: vi.fn().mockResolvedValue([]),
  saveLocal: vi.fn(),
  sync: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn(),
  onStatusChange: vi.fn().mockImplementation(() => () => {}),
  setRemoteService: vi.fn(),
  startAutoSync: vi.fn(),
  stopAutoSync: vi.fn(),
})

let syncServiceMock = createSyncServiceMock()

const taskStoreMock = {
  taskMap: new Map<string, TaskClass>(),
  graph: new TaskGraph(),
  loadTaskClasses: vi.fn((tasks: TaskClass[], graph: TaskGraph) => {
    taskStoreMock.taskMap = new Map(tasks.map(task => [task.id, task]))
    taskStoreMock.graph = graph
  }),
  addTaskClass: vi.fn((task: TaskClass) => {
    taskStoreMock.taskMap.set(task.id, task)
  }),
  removeTaskClass: vi.fn((taskId: string) => {
    taskStoreMock.taskMap.delete(taskId)
  }),
  updateTaskClass: vi.fn((task: TaskClass) => {
    taskStoreMock.taskMap.set(task.id, task)
  }),
  convertTasksToGraph: vi.fn((tasks: TaskClass[]) => {
    const graph = TaskGraph.fromTasks(tasks)
    return { taskClasses: tasks, graph }
  }),
  get tasks() {
    return [...taskStoreMock.taskMap.values()]
  },
}

const resetTaskStoreMock = () => {
  taskStoreMock.taskMap = new Map()
  taskStoreMock.graph = new TaskGraph()
}

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => taskStoreMock,
}))

vi.mock('@/storage/local/indexeddb-storage', () => ({
  getIndexedDBStorage: vi.fn(() => ({})),
}))

vi.mock('@/storage/sync/sync-service', () => ({
  getSyncService: vi.fn(() => syncServiceMock),
}))

const flushPromises = async () => {
  await new Promise(resolve => setTimeout(resolve, 0))
}

const authenticateSession = () => {
  sessionState.webid = 'https://user.example/profile#me'
  sessionState.session = { fetch: vi.fn() as unknown as typeof fetch }
}

const createServiceMock = (tasks: TaskClass[] = []) => ({
  loadTasksAsTaskClasses: vi.fn().mockResolvedValue({
    taskClasses: tasks,
    graph: TaskGraph.fromTasks(tasks),
  }),
  saveTaskClasses: vi.fn(),
  saveTaskClass: vi.fn(),
  deleteTask: vi.fn(),
})

describe('useSolidTasks integration', () => {
  const createSolidTaskServiceMock =
    createSolidTaskService as unknown as ReturnType<typeof vi.fn>
  const findStorageMock = findStorage as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    setupPinia()
    sessionState.webid = null
    sessionState.session = null
    vi.clearAllMocks()
    syncServiceMock = createSyncServiceMock()
    resetTaskStoreMock()
  })

  it('initializes service and loads tasks when authenticated', async () => {
    authenticateSession()

    const tasks = createMockTasks(2)
    const serviceMock = createServiceMock(tasks)

    findStorageMock.mockResolvedValue('https://storage.example/')
    createSolidTaskServiceMock.mockReturnValue(serviceMock)

    syncServiceMock.loadLocal.mockResolvedValue(tasks)

    useSolidTasks()

    await nextTick()
    await flushPromises()

    const store = useTaskStore()

    expect(findStorageMock).toHaveBeenCalledWith(
      'https://user.example/profile#me',
    )
    expect(createSolidTaskServiceMock).toHaveBeenCalledWith(
      'https://storage.example/',
      sessionState.session!.fetch,
    )
    expect(syncServiceMock.setRemoteService).toHaveBeenCalledWith(serviceMock)
    expect(syncServiceMock.loadLocal).toHaveBeenCalled()
    expect(store.tasks).toHaveLength(2)
  })

  it('adds a task and saves it through the service', async () => {
    authenticateSession()

    const serviceMock = createServiceMock()

    findStorageMock.mockResolvedValue('https://storage.example/')
    createSolidTaskServiceMock.mockReturnValue(serviceMock)

    syncServiceMock.loadLocal.mockResolvedValue([])

    const solidTasks = useSolidTasks()

    await nextTick()
    await flushPromises()

    const newTask = new TaskClass({
      id: 'task-1',
      name: 'Task 1',
      addedDate: new Date('2024-01-01'),
      status: Status.IN_PROGRESS,
    })

    await solidTasks.addTaskAndSave(newTask)

    const store = useTaskStore()
    expect(store.taskMap.has('task-1')).toBe(true)
    expect(syncServiceMock.saveLocal).toHaveBeenCalledWith(newTask)
    expect(syncServiceMock.sync).toHaveBeenCalled()
  })

  it('removes a task and deletes it from the service', async () => {
    authenticateSession()

    const serviceMock = createServiceMock()

    findStorageMock.mockResolvedValue('https://storage.example/')
    createSolidTaskServiceMock.mockReturnValue(serviceMock)

    syncServiceMock.loadLocal.mockResolvedValue([])

    const solidTasks = useSolidTasks()

    await nextTick()
    await flushPromises()

    const store = useTaskStore()
    const task = new TaskClass({
      id: 'task-2',
      name: 'Task 2',
      addedDate: new Date('2024-01-02'),
      status: Status.IN_PROGRESS,
    })
    task.fullId = 'https://storage.example/planner/tasks/task-2'

    store.addTaskClass(task)

    await solidTasks.removeTaskAndSave(task)

    expect(taskStoreMock.removeTaskClass).toHaveBeenCalledWith('task-2')
    expect(syncServiceMock.deleteTask).toHaveBeenCalledWith(task.fullId)
  })

  it('clears tasks on logout', async () => {
    authenticateSession()

    const tasks = createMockTasks(1)
    const serviceMock = createServiceMock(tasks)

    findStorageMock.mockResolvedValue('https://storage.example/')
    createSolidTaskServiceMock.mockReturnValue(serviceMock)

    syncServiceMock.loadLocal.mockResolvedValue(tasks)

    useSolidTasks()

    await nextTick()
    await flushPromises()

    const store = useTaskStore()
    const initialCount = store.tasks.length
    expect(initialCount).toBeGreaterThan(0)

    sessionState.webid = null
    sessionState.session = null

    await nextTick()

    expect(store.tasks).toHaveLength(initialCount)
  })
})
