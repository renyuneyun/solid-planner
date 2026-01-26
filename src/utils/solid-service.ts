import { createSolidLdoDataset } from "@ldo/connected-solid";
import { RDF } from '@inrupt/vocab-common-rdf';
import { TaskShapeType } from '@/ldo/task.shapeTypes';
import { Task } from '@/ldo/task.typings';
import { TaskClass } from '@/types/task';
import { withTrailingSlash } from './url';

const TASK_RESOURCE_NAME = 'tasks.ttl';

/**
 * Service for reading and writing tasks to/from a Solid Pod
 */
export class SolidTaskService {
  private ldoDataset = createSolidLdoDataset();
  private taskResourceUrl: string;

  constructor(podRootUri: string, authFetch: typeof fetch) {
    this.taskResourceUrl = `${withTrailingSlash(podRootUri)}planner/${TASK_RESOURCE_NAME}`;
    this.ldoDataset.setContext("solid", { fetch: authFetch });
  }

  /**
   * Fetch all tasks from the Solid Pod
   */
  async fetchTasks(): Promise<Task[]> {
    const resource = this.ldoDataset.getResource(this.taskResourceUrl);
    const readResult = await resource.read();

    if (readResult.isError) {
      // Resource doesn't exist yet or other error - return empty array
      console.warn(`Could not read tasks: ${readResult.type}`);
      return [];
    }

    // Check if resource is absent (404)
    if (readResult.type === 'absentReadSuccess') {
      return [];
    }

    // Match by the schema.org Action type declared in the shape context
    const tasksSet = this.ldoDataset
      .usingType(TaskShapeType)
      .matchSubject(RDF.type, 'https://schema.org/Action');

    return Array.from(tasksSet) as Task[];
  }

  /**
   * Save all tasks to the Solid Pod (replaces existing data)
   * @param tasks Array of Task objects to save
   */
  async saveTasks(tasks: Task[]): Promise<void> {
    const resource = this.ldoDataset.getResource(this.taskResourceUrl);

    // Ensure resource is loaded
    await resource.readIfUnfetched();

    // Start a transaction to update the dataset
    const transaction = this.ldoDataset.startTransaction();

    // Write all tasks
    tasks.forEach((task) => {
      const ldoTask = transaction
        .usingType(TaskShapeType)
        .write(this.taskResourceUrl)
        .fromSubject(task['@id']!);

      // Update all properties
      Object.assign(ldoTask, task);
    });

    // Commit the transaction to the remote Pod
    const result = await transaction.commitToRemote();

    if (result.isError) {
      throw new Error(`Failed to save tasks: ${result.type}`);
    }
  }

  /**
   * Save all TaskClass objects to the Solid Pod
   * Converts TaskClass objects to LDO Task format before saving
   * @param taskClasses Array of TaskClass objects to save
   */
  async saveTaskClasses(taskClasses: TaskClass[]): Promise<void> {
    // Flatten all tasks (root + all subtasks recursively)
    const flattenedTasks: Task[] = []
    
    const flattenTask = (tc: TaskClass) => {
      flattenedTasks.push(tc.toLdoTask(this.taskResourceUrl))
      for (const subTask of tc.subTasks) {
        flattenTask(subTask)
      }
    }
    
    for (const task of taskClasses) {
      flattenTask(task)
    }
    
    await this.saveTasks(flattenedTasks);
  }

  /**
   * Add or update a single task
   * @param task The task to add or update
   */
  async upsertTask(task: Task): Promise<void> {
    const resource = this.ldoDataset.getResource(this.taskResourceUrl);

    // Ensure resource exists
    await resource.readIfUnfetched();

    const transaction = this.ldoDataset.startTransaction();

    const ldoTask = transaction
      .usingType(TaskShapeType)
      .write(this.taskResourceUrl)
      .fromSubject(task['@id']!);

    // Update all properties
    Object.assign(ldoTask, task);

    const result = await transaction.commitToRemote();

    if (result.isError) {
      throw new Error(`Failed to upsert task: ${result.type}`);
    }
  }

  /**
   * Add or update a single TaskClass object
   * @param taskClass The TaskClass to add or update
   */
  async upsertTaskClass(taskClass: TaskClass): Promise<void> {
    const ldoTask = taskClass.toLdoTask(this.taskResourceUrl);
    await this.upsertTask(ldoTask);
  }

  /**
   * Delete a task by ID
   * Note: This is a simplified implementation. For proper deletion,
   * you may want to reload all tasks, filter out the deleted one, and save the rest.
   * @param taskId The ID of the task to delete
   */
  async deleteTask(taskId: string): Promise<void> {
    // Read all tasks
    const tasks = await this.fetchTasks();
    
    // Filter out the task to delete (recursively remove from subtasks too)
    const filterTask = (task: Task): Task | null => {
      if (task['@id'] === taskId) {
        return null;
      }
      if (task.subTask) {
        task.subTask = task.subTask.map(filterTask).filter(t => t !== null) as Task[];
      }
      return task;
    };

    const filteredTasks = tasks.map(filterTask).filter(t => t !== null) as Task[];
    
    // Save the filtered list
    await this.saveTasks(filteredTasks);
  }

  /**
   * Create the tasks resource if it doesn't exist
   */
  async ensureResourceExists(): Promise<void> {
    const resource = this.ldoDataset.getResource(this.taskResourceUrl);
    const readResult = await resource.read();

    if (readResult.type === 'absentReadSuccess') {
      // Initialize with empty task list
      await this.saveTasks([]);
    }
  }
}

/**
 * Create a SolidTaskService instance
 * @param podRootUri Root URI of the Solid Pod
 * @param authFetch Authenticated fetch function
 */
export function createSolidTaskService(
  podRootUri: string,
  authFetch: typeof fetch,
): SolidTaskService {
  return new SolidTaskService(podRootUri, authFetch);
}
