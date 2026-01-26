import { createSolidLdoDataset } from '@ldo/connected-solid'
import { RDF } from '@inrupt/vocab-common-rdf'
import { TaskShapeType } from '@/ldo/task.shapeTypes'
import { Task } from '@/ldo/task.typings'
import { TaskClass } from '@/types/task'
import { withTrailingSlash } from './url'

const TASK_RESOURCE_NAME = 'tasks.ttl'

/**
 * Service for reading and writing tasks to/from a Solid Pod
 */
export class SolidTaskService {
  private ldoDataset = createSolidLdoDataset()
  private taskResourceUrl: string

  constructor(podRootUri: string, authFetch: typeof fetch) {
    this.taskResourceUrl = `${withTrailingSlash(podRootUri)}planner/${TASK_RESOURCE_NAME}`
    this.ldoDataset.setContext('solid', { fetch: authFetch })
  }

  /**
   * Get the task resource URL (base URI for task IDs)
   */
  getTaskResourceUrl(): string {
    return this.taskResourceUrl
  }

  /**
   * Fetch all tasks from the Solid Pod
   */
  async fetchTasks(): Promise<Task[]> {
    const resource = this.ldoDataset.getResource(this.taskResourceUrl)
    const readResult = await resource.read()

    if (readResult.isError) {
      // Resource doesn't exist yet or other error - return empty array
      return []
    }

    // Check if resource is absent (404)
    if (readResult.type === 'absentReadSuccess') {
      console.log('Task resource not found (404) - returning empty array')
      return []
    }

    try {
      // Query for all subjects with rdf:type schema:org/Action
      // The matchSubject() should return an LdSet of matching tasks
      const tasksSet = this.ldoDataset
        .usingType(TaskShapeType)
        .matchSubject(RDF.type, 'https://schema.org/Action')

      // Convert the LdSet to an array
      const tasksArray: Task[] = []
      for (const task of tasksSet) {
        try {
          // Safely access task properties
          const taskObj = task as Task
          tasksArray.push(taskObj)
        } catch (taskErr) {
          // Continue with other tasks
        }
      }

      return tasksArray
    } catch (err) {
      throw err
    }
  }

  /**
   * Save all tasks to the Solid Pod (replaces existing data)
   * @param tasks Array of Task objects to save
   */
  async saveTasks(tasks: Task[]): Promise<void> {
    const resource = this.ldoDataset.getResource(this.taskResourceUrl)

    // Ensure resource is loaded
    await resource.readIfUnfetched()

    // Start a fresh transaction - writing will overwrite existing data for the same subjects
    const transaction = this.ldoDataset.startTransaction()

    // Write all tasks fresh
    tasks.forEach(task => {
      const ldoTask = transaction
        .usingType(TaskShapeType)
        .write(resource.uri)
        .fromSubject(task['@id']!)

      // Set properties individually for proper RDF handling
      // Only set defined values to avoid invalid RDF structures
      ldoTask.type = { '@id': 'Action' }
      ldoTask.title = task.title

      if (task.description !== undefined) {
        ldoTask.description = task.description
      }
      if (task.priority !== undefined) {
        ldoTask.priority = task.priority
      }
      if (task.dateCreated !== undefined) {
        ldoTask.dateCreated = task.dateCreated
      }
      if (task.startDate !== undefined) {
        ldoTask.startDate = task.startDate
      }
      if (task.endDate !== undefined) {
        ldoTask.endDate = task.endDate
      }
      if (task.status !== undefined) {
        ldoTask.status = task.status
      }

      if (task.subTask && task.subTask.length > 0) {
        ldoTask.subTask = []
        for (const subTaskRef of task.subTask) {
          ldoTask.subTask.push(subTaskRef)
        }
      }
    })

    // Commit the transaction to the remote Pod
    const result = await transaction.commitToRemote()

    if (result.isError) {
      console.error('Failed to commit transaction:', result)
      console.error('Error type:', result.type)
      // Try to extract more details from the error
      if (result.type === 'aggregateError' && (result as any).errors) {
        console.error('Aggregate errors:', (result as any).errors)
      }
      throw new Error(`Failed to save tasks: ${result.type}`)
    }
  }

  /**
   * Save all TaskClass objects to the Solid Pod
   * Converts TaskClass objects to LDO Task format before saving
   * Note: Only root tasks are saved; subtasks are referenced via subTask properties
   * @param taskClasses Array of TaskClass objects to save (should be root tasks only)
   */
  async saveTaskClasses(taskClasses: TaskClass[]): Promise<void> {
    // Convert all tasks (root + all subtasks) to LDO format
    // We need to save ALL tasks (both root and nested) but only as individual task objects
    const allTasks: Task[] = []
    const seenIds = new Set<string>()

    const collectAllTasks = (tc: TaskClass) => {
      if (seenIds.has(tc.id)) return
      seenIds.add(tc.id)

      const ldoTask = tc.toLdoTask(this.taskResourceUrl)
      allTasks.push(ldoTask)

      for (const subTask of tc.subTasks) {
        collectAllTasks(subTask)
      }
    }

    for (const task of taskClasses) {
      collectAllTasks(task)
    }

    await this.saveTasks(allTasks)
  }

  /**
   * Add or update a single task
   * @param task The task to add or update
   */
  async upsertTask(task: Task): Promise<void> {
    const resource = this.ldoDataset.getResource(this.taskResourceUrl)

    // Ensure resource exists
    await resource.readIfUnfetched()

    const transaction = this.ldoDataset.startTransaction()

    const ldoTask = transaction
      .usingType(TaskShapeType)
      .write(resource.uri)
      .fromSubject(task['@id']!)

    // Set properties individually for proper RDF handling
    // Only set defined values to avoid invalid RDF structures
    ldoTask.type = { '@id': 'Action' }
    ldoTask.title = task.title

    if (task.description !== undefined) {
      ldoTask.description = task.description
    }
    if (task.priority !== undefined) {
      ldoTask.priority = task.priority
    }
    if (task.dateCreated !== undefined) {
      ldoTask.dateCreated = task.dateCreated
    }
    if (task.startDate !== undefined) {
      ldoTask.startDate = task.startDate
    }
    if (task.endDate !== undefined) {
      ldoTask.endDate = task.endDate
    }
    if (task.status !== undefined) {
      ldoTask.status = task.status
    }

    // Set subtasks through LDO's property interface
    if (task.subTask && task.subTask.length > 0) {
      ldoTask.subTask = task.subTask
    }

    const result = await transaction.commitToRemote()

    if (result.isError) {
      throw new Error(`Failed to upsert task: ${result.type}`)
    }
  }

  /**
   * Add or update a single TaskClass object
   * @param taskClass The TaskClass to add or update
   */
  async upsertTaskClass(taskClass: TaskClass): Promise<void> {
    const ldoTask = taskClass.toLdoTask(this.taskResourceUrl)
    await this.upsertTask(ldoTask)
  }

  /**
   * Delete a task by ID
   * Note: This is a simplified implementation. For proper deletion,
   * you may want to reload all tasks, filter out the deleted one, and save the rest.
   * @param taskId The ID of the task to delete
   */
  async deleteTask(taskId: string): Promise<void> {
    // Read all tasks
    const tasks = await this.fetchTasks()

    // Filter out the task to delete (recursively remove from subtasks too)
    const filterTask = (task: Task): Task | null => {
      if (task['@id'] === taskId) {
        return null
      }
      if (task.subTask) {
        task.subTask = task.subTask
          .map(filterTask)
          .filter(t => t !== null) as Task[]
      }
      return task
    }

    const filteredTasks = tasks
      .map(filterTask)
      .filter(t => t !== null) as Task[]

    // Save the filtered list
    await this.saveTasks(filteredTasks)
  }

  /**
   * Create the tasks resource if it doesn't exist
   */
  async ensureResourceExists(): Promise<void> {
    const resource = this.ldoDataset.getResource(this.taskResourceUrl)
    const readResult = await resource.read()

    if (readResult.type === 'absentReadSuccess') {
      // Initialize with empty task list
      await this.saveTasks([])
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
  return new SolidTaskService(podRootUri, authFetch)
}
