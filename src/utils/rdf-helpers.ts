import {
  buildThing,
  createSolidDataset,
  setThing,
  saveSolidDatasetAt,
} from '@inrupt/solid-client'
import { Task } from '@/ldo/task.typings'

export async function saveTask(
  task: Task,
  containerUri: string,
): Promise<void> {
  const dataset = await getSolidDataset(containerUri)

  const taskThing = buildThing({ url: `${containerUri}#${task.id}` })
    .addStringNoLocale('http://schema.org/name', task.name)
    .addStringNoLocale(
      'https://your-ontology.org/priority',
      task.priority.toString(),
    )
    .addDate('http://schema.org/startDate', task.startDate)
    .addDate('http://schema.org/endDate', task.endDate)
    .addStringNoLocale('https://your-ontology.org/status', task.status)
    .build()

  const updatedDataset = setThing(dataset, taskThing)
  await saveSolidDatasetAt(containerUri, updatedDataset)
}
