import { describe, it, expect, beforeEach, vi } from 'vitest'
import '../../mocks/soukai-modules.mock'
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

  const response = (body: string, status = 200) =>
    ({
      status,
      ok: status >= 200 && status < 300,
      text: async () => body,
    }) as unknown as Response

  beforeEach(() => {
    MockTaskModel.clear()
    vi.clearAllMocks()
    vi.restoreAllMocks()
    authFetch.mockReset()
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

  it('rethrows (does not swallow) a server error while fetching tasks', async () => {
    const service = new SolidTaskService(podRoot, authFetch)
    vi.spyOn(MockTaskModel, 'from').mockReturnValue({
      all: async () => {
        throw new Error('fetch failed')
      },
    } as never)
    authFetch.mockResolvedValue(response('<html>server error</html>', 500))

    await expect(service.fetchTasks()).rejects.toThrow()
  })

  it('returns an empty array only when the task container does not exist', async () => {
    const service = new SolidTaskService(podRoot, authFetch)
    vi.spyOn(MockTaskModel, 'from').mockReturnValue({
      all: async () => {
        throw new Error('not found')
      },
    } as never)
    authFetch.mockResolvedValue(response('not found', 404))

    const tasks = await service.fetchTasks()

    expect(tasks).toEqual([])
  })

  it('repairs a document with duplicate crdt:updatedAt and returns the task', async () => {
    const service = new SolidTaskService(podRoot, authFetch)
    const taskUrl = `${containerUrl}task-broken`
    const containerTurtle = [
      `@prefix ldp: <http://www.w3.org/ns/ldp#> .`,
      `<${containerUrl}> ldp:contains <task-broken> .`,
    ].join('\n')
    const corruptTurtle = [
      '@prefix crdt: <https://vocab.noeldemartin.com/crdt/> .',
      '@prefix schema: <https://schema.org/> .',
      '<#it> a schema:Action ; schema:name "Broken" .',
      '<#it-metadata> a crdt:Metadata ;',
      '  crdt:resource <#it> ;',
      '  crdt:updatedAt "2026-04-16T06:33:11.793Z"^^<http://www.w3.org/2001/XMLSchema#dateTime>,',
      '                   "2026-04-16T06:33:17.604Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .',
    ].join('\n')

    let repaired = false
    let patchBody = ''
    authFetch.mockImplementation(async (url, init) => {
      if (init?.method === 'PATCH') {
        patchBody = String(init.body)
        repaired = true
        return response('', 204)
      }
      if (String(url) === taskUrl) return response(corruptTurtle)
      if (String(url) === containerUrl) return response(containerTurtle)
      return response('not found', 404)
    })

    vi.spyOn(MockTaskModel, 'from').mockReturnValue({
      all: async () => {
        throw new Error('Invalid Date value')
      },
    } as never)
    vi.spyOn(MockTaskModel, 'find').mockImplementation((async (url: string) => {
      if (url === taskUrl && !repaired) throw new Error('Invalid Date value')
      return new MockTask({ url: taskUrl, title: 'Broken' })
    }) as never)

    const tasks = await service.fetchTasks()

    expect(repaired).toBe(true)
    expect(patchBody).toContain('DELETE DATA')
    expect(patchBody).toContain('06:33:11.793Z')
    expect(patchBody).not.toContain('06:33:17.604Z')
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('Broken')
  })

  it('throws when the container lists documents but none load as tasks', async () => {
    const service = new SolidTaskService(podRoot, authFetch)
    const containerTurtle = `<${containerUrl}> <http://www.w3.org/ns/ldp#contains> <doc-broken> .`

    vi.spyOn(MockTaskModel, 'from').mockReturnValue({
      all: async () => {
        throw new Error('Invalid Date value')
      },
    } as never)
    vi.spyOn(MockTaskModel, 'find').mockImplementation(
      (async () => null) as never,
    )
    authFetch.mockImplementation(async url => {
      if (String(url) === containerUrl) return response(containerTurtle)
      return response('not found', 404)
    })

    await expect(service.fetchTasks()).rejects.toThrow('none could be loaded')
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
