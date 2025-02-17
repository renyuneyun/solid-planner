import {
  getSolidDataset,
  getThingAll,
  getStringNoLocale,
  Thing,
} from '@inrupt/solid-client'
import { Task, TaskThing } from '@/types/task'

export async function fetchTasks(containerUri: string): Promise<Task[]> {
  try {
    const dataset = await getSolidDataset(containerUri)
    const things = getThingAll(dataset)

    return things.filter(isTaskThing).map(thing => parseTaskFromThing(thing))
  } catch (error) {
    throw new Error(
      `Failed to fetch tasks: ${error instanceof Error ? error.message : error}`,
    )
  }
}

function parseTaskFromThing(thing: TaskThing): Task {
  return {
    id: thing.url.split('#').pop() || '',
    name: getStringNoLocale(thing, 'http://schema.org/name') || 'Untitled Task',
    priority: parseInt(
      getStringNoLocale(thing, 'https://your-ontology.org/priority') || '0',
    ),
    startDate: new Date(
      getStringNoLocale(thing, 'http://schema.org/startDate') || Date.now(),
    ),
    endDate: new Date(
      getStringNoLocale(thing, 'http://schema.org/endDate') || Date.now(),
    ),
    status:
      (getStringNoLocale(
        thing,
        'https://your-ontology.org/status',
      ) as Task['status']) || 'not-started',
    persisted: true,
  }
}
