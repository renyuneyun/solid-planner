import { endOfWeek } from '@/utils/datetime'

interface TaskClassContent {
  id: string
  name: string
  description?: string
  addedDate: Date
  startDate?: Date
  endDate?: Date
  status?: Status
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

/**
 * TaskClass represents a task's core data properties.
 * Parent-child relationships are managed by TaskGraph, not stored directly in this class.
 * This keeps tasks as pure data without circular references.
 */
export class TaskClass implements TaskClassContent {
  readonly id: string
  fullId?: string // Full @id for RDF/Solid Pod (e.g., https://...#uuid)
  name: string
  description?: string
  addedDate: Date
  startDate?: Date
  endDate?: Date
  status?: Status

  // Relationships stored directly as IDs (source of truth)
  parentId?: string
  childIds: string[] = []

  /**
   * Reference to the TaskGraph that maintains cached indices for performance.
   * The graph is derived from parentId/childIds and kept in sync.
   * Private - use the store methods or adapter functions to query relationships.
   */
  private graph?: any // Use 'any' for Pinia compatibility

  constructor({
    id,
    name,
    description,
    addedDate,
    startDate,
    endDate,
    status,
    parentId,
    childIds,
  }: TaskClassContent & { parentId?: string; childIds?: string[] }) {
    this.id = id
    this.name = name
    this.description = description
    this.addedDate = addedDate
    this.startDate = startDate
    this.endDate = endDate
    this.status = status
    this.parentId = parentId
    this.childIds = childIds ? [...childIds] : []
  }

  /**
   * Set the graph reference for this task (called by the store during initialization)
   */
  setGraph(graph: any): void {
    this.graph = graph
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

  /**
   * Get the ID of the parent task, or undefined if this is a root task.
   * Use store methods like `moveTask()` to modify relationships.
   */
  getParentId(): string | undefined {
    return this.parentId
  }

  /**
   * Get the IDs of all child tasks.
   * Use store methods like `addSubTask()` or `moveTask()` to modify relationships.
   */
  getChildrenIds(): string[] {
    return [...this.childIds]
  }

  /**
   * Set the parent ID (internal - keeps graph in sync if present)
   */
  setParentId(parentId: string | undefined): void {
    this.parentId = parentId
    if (this.graph) {
      this.graph.setParent(this.id, parentId)
    }
  }

  /**
   * Add a child ID (internal - keeps graph in sync if present)
   */
  addChildId(childId: string): void {
    if (!this.childIds.includes(childId)) {
      this.childIds.push(childId)
      if (this.graph) {
        this.graph.addChild(this.id, childId)
      }
    }
  }

  /**
   * Remove a child ID (internal - keeps graph in sync if present)
   */
  removeChildId(childId: string): void {
    const index = this.childIds.indexOf(childId)
    if (index !== -1) {
      this.childIds.splice(index, 1)
      if (this.graph) {
        this.graph.removeChild(this.id, childId)
      }
    }
  }
}
