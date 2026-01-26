import { Task } from '@/ldo/task.typings'
import { endOfWeek } from '@/utils/datetime'

interface TaskClassContent {
  id: string
  name: string
  description?: string
  addedDate: Date
  startDate?: Date
  endDate?: Date
  status?: Status
  subTasks?: TaskClass[]
  parent?: TaskClass
}

export enum Priority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
}

export enum Status {
  IN_PROGRESS = 'InProgress',
  COMPLETED = 'Completed',
  IGNORED = 'Ignored',
}

export class TaskClass implements TaskClassContent {
  readonly id: string
  fullId?: string // Full @id for RDF (e.g., https://...#uuid)
  name: string
  description?: string
  addedDate: Date
  startDate?: Date
  endDate?: Date
  status?: Status
  subTasks: TaskClass[] = []
  parent?: TaskClass = undefined
  ldoObj?: Task

  constructor({
    id,
    name,
    description,
    addedDate,
    startDate,
    endDate,
    status,
    subTasks,
    parent,
  }: TaskClassContent) {
    this.id = id
    this.name = name
    this.description = description
    this.addedDate = addedDate
    this.startDate = startDate
    this.endDate = endDate
    this.status = status
    this.subTasks = []

    if (subTasks) {
      for (const task of subTasks) {
        this.addSubTask(task)
      }
    }

    this.parent = parent
  }

  /**
   * Create a TaskClass object from an LDO Task object.
   * This method will not set the parent and subtask references. It needs to be done by `fillRefsFromMap`.
   *
   * @param ldoTask The LDO Task object to convert.
   * @returns A TaskClass object.
   */
  static basicFromLdoTask(ldoTask: Task): TaskClass {
    const rawId = ldoTask['@id'] ?? ''
    const shortId = rawId.includes('#') ? rawId.split('#').pop()! : rawId

    const task = new TaskClass({
      id: shortId,
      name: ldoTask.title,
      description: ldoTask.description,
      addedDate: new Date(ldoTask.dateCreated ?? ''),
      startDate: ldoTask.startDate ? new Date(ldoTask.startDate) : undefined,
      endDate: ldoTask.endDate ? new Date(ldoTask.endDate) : undefined,
      status: ldoTask.status?.['@id'] as Status,
    })

    task.ldoObj = ldoTask
    task.fullId = rawId // Store the full @id so toLdoTask() can use it
    return task
  }

  fillRefsFromMap(taskObjMap: Map<string, TaskClass>): void {
    if (!this.ldoObj || !this.ldoObj.subTask) {
      return
    }

    // Normalize subTask into an array; LDO can deliver an object map when @container is absent
    const subRefs = Array.isArray(this.ldoObj.subTask)
      ? this.ldoObj.subTask
      : (Object.values(this.ldoObj.subTask ?? {}).filter(Boolean) as Task[])

    for (const ldoSub of subRefs) {
      const subTaskId = ldoSub['@id']
      const subTask = taskObjMap.get(subTaskId!)
      if (subTask) {
        this.addSubTask(subTask)
      }
    }
  }

  /**
   * Convert this TaskClass object to an LDO Task object.
   * This allows writing the task back to the Solid Pod.
   *
   * @param baseUri The base URI for generating task IDs (e.g., the resource URI)
   * @returns An LDO Task object ready to be written to the Pod
   */
  toLdoTask(baseUri?: string): Task {
    // Use fullId if available (preserves original @id), otherwise construct from baseUri or use local id
    let taskId: string
    if (this.fullId) {
      taskId = this.fullId
    } else if (baseUri) {
      const localId = this.id.includes('#')
        ? this.id.split('#').pop()!
        : this.id
      taskId = `${baseUri}#${localId}`
    } else {
      taskId = this.id
    }

    // Convert subtasks to references only (just @id) to avoid blank nodes
    const subTaskReferences = this.subTasks.map(sub => {
      // Use fullId if available, otherwise construct from baseUri or use local id
      let subTaskId: string
      if (sub.fullId) {
        subTaskId = sub.fullId
      } else if (baseUri) {
        const subLocalId = sub.id.includes('#')
          ? sub.id.split('#').pop()!
          : sub.id
        subTaskId = `${baseUri}#${subLocalId}`
      } else {
        subTaskId = sub.id
      }
      return { '@id': subTaskId } as Task
    })

    const ldoTask: Task = {
      '@id': taskId,
      type: { '@id': 'Action' },
      title: this.name,
      description: this.description,
      dateCreated: this.addedDate.toISOString().split('T')[0],
      startDate: this.startDate?.toISOString().split('T')[0],
      endDate: this.endDate?.toISOString().split('T')[0],
      status: this.status ? { '@id': this.status } : undefined,
      subTask: subTaskReferences.length > 0 ? subTaskReferences : undefined,
    }

    return ldoTask
  }

  get effectiveStartDate() {
    return this.startDate ?? this.addedDate
  }

  get effectiveEndDate() {
    return this.endDate ?? endOfWeek(this.addedDate)
  }

  get completed() {
    return this.status === 'Completed'
  }

  set completed(value: boolean) {
    this.status = value ? Status.COMPLETED : Status.IN_PROGRESS
  }

  /// Don't use this getter, it is not reactive and will not update the UI.
  // get subTasks(): TaskClass[] {
  //   return [...this.subTasks]
  // }

  /**
   * Add the subtask to the current task.
   * If the subtask is already a child of the current task, this method does nothing.
   * If the subtask already has a parent, it will be removed from the old parent.
   * @param task The subtask to add.
   */
  addSubTask(task: TaskClass): void {
    if (this.subTasks.some(t => t.id === task.id)) return

    if (task.parent) {
      task.parent.removeSubTask(task)
    }
    this.subTasks.push(task)
    task.parent = this
  }

  /**
   * Remove the subtask from the current task.
   * If the subtask is not a child of the current task, this method does nothing.
   * @param task The subtask to remove.
   * @returns void
   */
  removeSubTask(task: TaskClass): void {
    const index = this.subTasks.findIndex(t => t.id === task.id)
    if (index !== -1) {
      this.subTasks.splice(index, 1)
      task.parent = undefined
    }
  }

  /**
   * Clear all subtasks of the current task.
   * This will also remove the parent reference from each subtask.
   */
  clearSubTasks(): void {
    for (const task of this.subTasks) {
      task.parent = undefined
    }
    this.subTasks = []
  }
}

export function createTaskClassMapFromLdoTasks(
  ldoTasks: Map<string, Task>,
): Map<string, TaskClass> {
  const taskObjMap = new Map<string, TaskClass>()
  ldoTasks.forEach((ldoTask, id) => {
    const task = TaskClass.basicFromLdoTask(ldoTask)
    taskObjMap.set(id, task)
  })
  taskObjMap.forEach(task => {
    task.fillRefsFromMap(taskObjMap)
  })
  return taskObjMap
}
