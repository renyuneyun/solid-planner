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
