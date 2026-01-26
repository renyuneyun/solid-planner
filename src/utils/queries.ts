
import { createSolidLdoDataset } from "@ldo/connected-solid";
import { RDF } from '@inrupt/vocab-common-rdf';
import { NS_SP } from '@/constants/ns';
import { TaskShapeType } from '@/ldo/task.shapeTypes';
import { Task } from '@/ldo/task.typings';
import { withTrailingSlash } from './url';

const TASK_RESOURCE_NAME = 'tasks.ttl';

export async function fetchTasks(podRootUri: string, authFetch: typeof fetch): Promise<Task[]> {
  const taskResourceUrl = `${withTrailingSlash(podRootUri)}planner/${TASK_RESOURCE_NAME}`;

  // Create a SolidLdoDataset and set the authenticated fetch
  const ldoDataset = createSolidLdoDataset();
  ldoDataset.setContext("solid", { fetch: authFetch });

  // Get the resource for the tasks file and read it
  const resource = ldoDataset.getResource(taskResourceUrl);
  const readResult = await resource.read();
  
  if (readResult.isError) {
    throw new Error(`Failed to read tasks resource: ${readResult.type}`);
  }

  // Use the dataset to get tasks using the shape type
  const tasksSet = ldoDataset
    .usingType(TaskShapeType)
    .matchSubject(RDF.type, NS_SP('Task'));

  // Convert LdSet to array with proper typing
  const tasks = Array.from(tasksSet) as Task[];

  console.log(`Got ldoTasks: ${JSON.stringify(tasks, null, 2)}`);

  return tasks;
}
