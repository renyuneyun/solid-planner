import { parseRdf } from 'ldo'
import { RDF } from '@inrupt/vocab-common-rdf'
import { URL_EX, NS_SP } from '@/constants/ns'
import { TaskShapeType } from '@/ldo/task.shapeTypes'
import { Task } from '@/ldo/task.typings'
import { withTrailingSlash } from './url'

const TASK_RESOURCE_NAME = 'tasks.ttl'

export async function fetchTasks(podRootUri: string, authFetch: typeof fetch): Promise<Task[]> {
  const taskResourceUrl = `${withTrailingSlash(podRootUri)}planner/${TASK_RESOURCE_NAME}`
  const response = await authFetch(taskResourceUrl)
  const text = await response.text()
  console.log(`Got tasks Turtle: ${text}`)

  const ldoDataset = await parseRdf(text, {
    baseIRI: URL_EX,
  })

  const tasks = ldoDataset
    .usingType(TaskShapeType)
    .matchSubject(RDF.type, NS_SP('Task'))

  console.log(`Got ldoTasks: ${JSON.stringify(tasks, null, 2)}`)

  return tasks;
}
