import { Task } from '@/ldo/task.typings'
import { endOfWeek } from '@/utils/datetime'

interface TaskClassContent {
  id: string
  name: string
  description?: string
  addedDate: Date
  startDate?: Date
  endDate?: Date
  status?: 'in-progress' | 'completed' | 'ignored'
  subTasks?: TaskClass[]
  parent?: TaskClass
}

export class TaskClass {
  readonly id: string
  name: string
  description?: string
  addedDate: Date
  startDate?: Date
  endDate?: Date
  status?: 'in-progress' | 'completed' | 'ignored'
  subTasks: TaskClass[]
  parent?: TaskClass
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
    this.subTasks = subTasks ?? [] // TODO: Consider how to add parent here
    this.parent = parent
  }

  static fromLdoTask(ldoTask: Task): TaskClass {
    const task = new TaskClass({
      id: ldoTask['@id'] ?? '',
      name: ldoTask.title,
      description: ldoTask.description,
      addedDate: new Date(ldoTask.dateCreated ?? ''),
      startDate: ldoTask.startDate ? new Date(ldoTask.startDate) : undefined,
      endDate: ldoTask.endDate ? new Date(ldoTask.endDate) : undefined,
      status: ldoTask.status?.['@id'] as
        | 'in-progress'
        | 'completed'
        | 'ignored'
        | undefined,
      subTasks:
        ldoTask.subTask?.map(subTask => TaskClass.fromLdoTask(subTask)) ?? [],
    })
    task.subTasks.forEach(subTask => (subTask.parent = task))
    task.ldoObj = ldoTask
    return task
  }

  get effectiveStartDate() {
    return this.startDate ?? this.addedDate
  }

  get effectiveEndDate() {
    return this.endDate ?? endOfWeek(this.addedDate)
  }

  get completed() {
    return this.status === 'completed'
  }

  set completed(value: boolean) {
    this.status = value ? 'completed' : 'in-progress'
  }
}
