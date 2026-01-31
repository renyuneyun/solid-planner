import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import '@/tests/mocks/solid-session.mock'
import { setupPinia } from '../../helpers/pinia'
import { useSolidTasks } from '@/composables/useSolidTasks'
import { useTaskStore } from '@/stores/tasks'
import { TaskGraph } from '@/models/TaskGraph'
import { TaskClass, Status } from '@/models/TaskClass'
import { createMockTasks } from '../../mocks/task.mock'
import { createSolidTaskService } from '@/storage/soukai/soukai-storage'
import { findStorage } from '@renyuneyun/solid-helper'
import { sessionState } from '../../mocks/solid-session.mock'

const flushPromises = async () => {
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('useSolidTasks integration', () => {
  const createSolidTaskServiceMock =
    createSolidTaskService as unknown as ReturnType<typeof vi.fn>
  const findStorageMock = findStorage as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    setupPinia()
    sessionState.webid = null
    sessionState.session = null
    vi.clearAllMocks()
  })

  it('initializes service and loads tasks when authenticated', async () => {
    sessionState.webid = 'https://user.example/profile#me'
    sessionState.session = { fetch: vi.fn() as unknown as typeof fetch }

    const tasks = createMockTasks(2)
    const graph = TaskGraph.fromTasks(tasks)

    const serviceMock = {
      loadTasksAsTaskClasses: vi.fn().mockResolvedValue({
        taskClasses: tasks,
        graph,
      }),
      saveTaskClasses: vi.fn(),
      saveTaskClass: vi.fn(),
      deleteTask: vi.fn(),
    }

    findStorageMock.mockResolvedValue('https://storage.example/')
    createSolidTaskServiceMock.mockReturnValue(serviceMock)

    useSolidTasks()

    await nextTick()
    await flushPromises()

    const store = useTaskStore()

    expect(findStorageMock).toHaveBeenCalledWith(
      'https://user.example/profile#me',
    )
    expect(createSolidTaskServiceMock).toHaveBeenCalledWith(
      'https://storage.example/',
      sessionState.session.fetch,
    )
    expect(store.tasks).toHaveLength(2)
  })

  it('adds a task and saves it through the service', async () => {
    sessionState.webid = 'https://user.example/profile#me'
    sessionState.session = { fetch: vi.fn() as unknown as typeof fetch }

    const serviceMock = {
      loadTasksAsTaskClasses: vi.fn().mockResolvedValue({
        taskClasses: [],
        graph: new TaskGraph(),
      }),
      saveTaskClasses: vi.fn(),
      saveTaskClass: vi.fn(),
      deleteTask: vi.fn(),
    }

    findStorageMock.mockResolvedValue('https://storage.example/')
    createSolidTaskServiceMock.mockReturnValue(serviceMock)

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
    expect(serviceMock.saveTaskClass).toHaveBeenCalledWith(newTask)
  })

  it('removes a task and deletes it from the service', async () => {
    sessionState.webid = 'https://user.example/profile#me'
    sessionState.session = { fetch: vi.fn() as unknown as typeof fetch }

    const serviceMock = {
      loadTasksAsTaskClasses: vi.fn().mockResolvedValue({
        taskClasses: [],
        graph: new TaskGraph(),
      }),
      saveTaskClasses: vi.fn(),
      saveTaskClass: vi.fn(),
      deleteTask: vi.fn(),
    }

    findStorageMock.mockResolvedValue('https://storage.example/')
    createSolidTaskServiceMock.mockReturnValue(serviceMock)

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

    expect(store.taskMap.has('task-2')).toBe(false)
    expect(serviceMock.deleteTask).toHaveBeenCalledWith(task.fullId)
  })

  it('clears tasks on logout', async () => {
    sessionState.webid = 'https://user.example/profile#me'
    sessionState.session = { fetch: vi.fn() as unknown as typeof fetch }

    const tasks = createMockTasks(1)
    const graph = TaskGraph.fromTasks(tasks)

    const serviceMock = {
      loadTasksAsTaskClasses: vi.fn().mockResolvedValue({
        taskClasses: tasks,
        graph,
      }),
      saveTaskClasses: vi.fn(),
      saveTaskClass: vi.fn(),
      deleteTask: vi.fn(),
    }

    findStorageMock.mockResolvedValue('https://storage.example/')
    createSolidTaskServiceMock.mockReturnValue(serviceMock)

    useSolidTasks()

    await nextTick()
    await flushPromises()

    const store = useTaskStore()
    expect(store.tasks).toHaveLength(1)

    sessionState.webid = null
    sessionState.session = null

    await nextTick()

    expect(store.tasks).toHaveLength(0)
  })
})
