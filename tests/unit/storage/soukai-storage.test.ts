import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@/tests/mocks/soukai-modules.mock'
import { MockTask } from '../../mocks/task-model.mock'
import { SolidTaskService } from '@/storage/soukai/soukai-storage'
import Task from '@/storage/soukai/Task.model'
import { Status, TaskClass } from '@/models/TaskClass'

describe('SolidTaskService', () => {
  const authFetch = vi.fn()
  const podRoot = 'https://mock.pod/'
  const containerUrl = 'https://mock.pod/planner/tasks/'

  const MockTaskModel = Task as unknown as typeof Task & {
    records: Map<string, Record<string, unknown>>
    allResponse: unknown
    clear: () => void
  }

  beforeEach(() => {
    MockTaskModel.clear()
    vi.clearAllMocks()
  })

  it('should build the task container URL', () => {
    const service = new SolidTaskService(podRoot, authFetch)
    expect(service.getTaskContainerUrl()).toBe(containerUrl)
  })

  it('should fetch tasks from container', async () => {
    const service = new SolidTaskService(podRoot, authFetch)
    const taskA = new MockTask({
      url: `${containerUrl}task-a`,
      title: 'A',
    })
    const taskB = new MockTask({
      url: `${containerUrl}task-b`,
      title: 'B',
    })

    MockTaskModel.allResponse = [taskA, taskB]

    const tasks = await service.fetchTasks()

    expect(tasks).toHaveLength(2)
    expect(tasks[0].title).toBe('A')
    expect(tasks[1].title).toBe('B')
  })

  it('should return empty array when fetch fails', async () => {
    const service = new SolidTaskService(podRoot, authFetch)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fromSpy = vi
      .spyOn(MockTaskModel as unknown as { from: () => unknown }, 'from')
      .mockImplementation(() => {
        throw new Error('fetch failed')
      })

    const tasks = await service.fetchTasks()

    expect(tasks).toEqual([])
    expect(fromSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('should convert Soukai tasks into TaskClass instances with graph', () => {
    const service = new SolidTaskService(podRoot, authFetch)

    const parentUrl = `${containerUrl}parent-1`
    const child1Url = `${containerUrl}child-1`
    const child2Url = `${containerUrl}child-2`

    const parent = new MockTask({
      url: parentUrl,
      title: 'Parent',
      description: 'Parent task',
      dateCreated: new Date('2024-01-01'),
      status: Status.IN_PROGRESS,
      subTaskUrls: ['child-1', 'child-2'],
    })

    const child1 = new MockTask({
      url: child1Url,
      title: 'Child 1',
      parentTaskUrl: 'parent-1',
    })

    const child2 = new MockTask({
      url: child2Url,
      title: 'Child 2',
      parentTaskUrl: 'parent-1',
    })

    const { taskClasses, graph } = service.convertToTaskClasses([
      parent as unknown as Task,
      child1 as unknown as Task,
      child2 as unknown as Task,
    ])

    expect(taskClasses).toHaveLength(3)

    const parentClass = taskClasses.find(t => t.id === 'parent-1')
    const child1Class = taskClasses.find(t => t.id === 'child-1')

    expect(parentClass?.childIds).toEqual(['child-1', 'child-2'])
    expect(child1Class?.parentId).toBe('parent-1')
    expect(graph.getChildrenIds('parent-1')).toEqual(['child-1', 'child-2'])
  })

  it('should save a new TaskClass and set fullId', async () => {
    const service = new SolidTaskService(podRoot, authFetch)

    const taskClass = new TaskClass({
      id: 'new-task',
      name: 'New Task',
      addedDate: new Date('2024-02-01'),
      status: Status.IN_PROGRESS,
    })

    await service.saveTaskClass(taskClass)

    expect(taskClass.fullId).toBeDefined()
    expect(MockTaskModel.records.size).toBe(1)
  })

  it('should update an existing TaskClass', async () => {
    const service = new SolidTaskService(podRoot, authFetch)
    const existingUrl = `${containerUrl}existing-1`

    MockTaskModel.records.set(existingUrl, {
      url: existingUrl,
      title: 'Old',
      status: Status.IN_PROGRESS,
    })

    const taskClass = new TaskClass({
      id: 'existing-1',
      name: 'Updated',
      addedDate: new Date('2024-02-02'),
      status: Status.COMPLETED,
    })
    taskClass.fullId = existingUrl

    await service.saveTaskClass(taskClass)

    const stored = MockTaskModel.records.get(existingUrl) as Record<
      string,
      unknown
    >
    expect(stored.title).toBe('Updated')
    expect(stored.status).toBe(Status.COMPLETED)
  })

  it('should delete a task and its descendants', async () => {
    const service = new SolidTaskService(podRoot, authFetch)

    const parentUrl = `${containerUrl}parent-1`
    const childUrl = `${containerUrl}child-1`

    MockTaskModel.records.set(parentUrl, {
      url: parentUrl,
      title: 'Parent',
      subTaskUrls: ['child-1'],
    })
    MockTaskModel.records.set(childUrl, {
      url: childUrl,
      title: 'Child',
    })

    await service.deleteTask(parentUrl)

    expect(MockTaskModel.records.size).toBe(0)
  })
})
