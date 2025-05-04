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
  name: string
  description?: string
  addedDate: Date
  startDate?: Date
  endDate?: Date
  status?: Status
  subTasks: TaskClass[] = []
  _parent?: TaskClass = undefined
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

    this._parent = parent
  }

  /**
   * Create a TaskClass object from an LDO Task object.
   * This method will not set the parent and subtask references. It needs to be done by `fillRefsFromMap`.
   *
   * @param ldoTask The LDO Task object to convert.
   * @returns A TaskClass object.
   */
  static basicFromLdoTask(ldoTask: Task): TaskClass {
    const task = new TaskClass({
      id: ldoTask['@id'] ?? '',
      name: ldoTask.title,
      description: ldoTask.description,
      addedDate: new Date(ldoTask.dateCreated ?? ''),
      startDate: ldoTask.startDate ? new Date(ldoTask.startDate) : undefined,
      endDate: ldoTask.endDate ? new Date(ldoTask.endDate) : undefined,
      status: ldoTask.status?.['@id'] as Status,
    })

    task.ldoObj = ldoTask
    return task
  }

  fillRefsFromMap(taskObjMap: Map<string, TaskClass>): void {
    for (const ldoSub of this.ldoObj!.subTask ?? []) {
      const subTask = taskObjMap.get(ldoSub['@id']!)
      if (subTask) {
        this.addSubTask(subTask)
      }
    }
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
    console.log(`Added subtask ${task.name} to task ${this.name}`)
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

  get parent(): TaskClass | undefined {
    console.log(`Getting parent of task ${this.name}: ${this._parent?.name}`)
    return this._parent
  }

  /**
   * Set the parent task for the current task.
   * It will handle subtask references automatically.
   */
  set parent(newParent: TaskClass | undefined) {
    if (this._parent === newParent) return

    if (this._parent) {
      this._parent.removeSubTask(this)
    }

    if (newParent) {
      newParent.addSubTask(this)
    } else {
      // Note: Do not set the parent reference here to avoid infinite recursion. Only set it in the addSubTask method, or here if undefined.
      this._parent = undefined
    }
  }
}

export function createTaskClassMapFromLdoTasks(
  ldoTasks: Map<string, Task>,
): Map<string, TaskClass> {
  const taskObjMap = new Map<string, TaskClass>()
  ldoTasks.forEach((ldoTask, id) => {
    console.log(`Creating task ${ldoTask.title} with id ${id} from LDO task`)
    const task = TaskClass.basicFromLdoTask(ldoTask)
    taskObjMap.set(id, task)
    console.log(`Created task ${task.name} with id ${id} from LDO task`)
  })
  taskObjMap.forEach((task, id) => {
    console.log(
      `Filling refs for task ${task.name} with id ${id}. Children: ${task.ldoObj!.subTask?.length}`,
    )
    task.fillRefsFromMap(taskObjMap)
    console.log(`Filled refs for task ${task.name} with id ${id}`)
  })
  return taskObjMap
}
