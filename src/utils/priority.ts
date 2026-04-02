import type { TaskClass } from '@/models/TaskClass'

/**
 * Interface for graph operations needed by priority calculations
 * This allows using both TaskGraph and Pinia reactive graph objects
 */
export interface GraphLike {
  getChildrenIds: (taskId: string) => string[]
  getParentId: (taskId: string) => string | undefined
}

/**
 * Calculate the soft deadline for a task (end of Friday of the week when task was created)
 */
export function calculateSoftDeadline(task: TaskClass): Date {
  if (task.endDate) {
    return task.endDate
  }

  // Calculate end of Friday (day 5) of the week when task was created
  const createdDate = new Date(task.addedDate)
  const dayOfWeek = createdDate.getDay() // 0 = Sunday, 5 = Friday, 6 = Saturday

  let daysUntilFriday = 5 - dayOfWeek

  // If the task is added on Saturday (6) or Sunday (0), move to next Friday
  if (dayOfWeek === 6) {
    daysUntilFriday = 6 // Saturday to next Friday
  } else if (dayOfWeek === 0) {
    daysUntilFriday = 5 // Sunday to next Friday
  }

  const fridayDate = new Date(createdDate)
  fridayDate.setDate(createdDate.getDate() + daysUntilFriday)

  // Set to end of day (23:59:59)
  fridayDate.setHours(23, 59, 59, 999)

  return fridayDate
}

/**
 * Get days until deadline (negative if overdue)
 */
export function getDaysUntilDeadline(task: TaskClass): number {
  const deadline = task.endDate || calculateSoftDeadline(task)
  const now = new Date()
  const diffTime = deadline.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Check if task is overdue
 */
export function isOverdue(task: TaskClass): boolean {
  if (task.completed) return false
  const deadline = task.endDate || calculateSoftDeadline(task)
  return deadline < new Date()
}

/**
 * Calculate priority score for a task
 * Higher score = higher priority
 *
 * Factors:
 * - Overdue: +1000 points
 * - Days until deadline: score decreases as deadline approaches
 * - Blocking other tasks: +200 points (has children that depend on it)
 * - Subtask completion: small boost based on progress
 */
export function calculatePriorityScore(
  task: TaskClass,
  graph: GraphLike,
  allTasks: Map<string, TaskClass>,
): number {
  // Skip completed or ignored tasks
  if (task.completed || task.status === 'Ignored') {
    return -1000
  }

  let score = 0

  // 1. Overdue tasks get massive priority boost
  if (isOverdue(task)) {
    score += 1000
    // Additional points for how overdue it is
    const daysOverdue = Math.abs(getDaysUntilDeadline(task))
    score += daysOverdue * 50
  }

  // 2. Urgency based on days until deadline
  const daysUntil = getDaysUntilDeadline(task)
  if (daysUntil >= 0) {
    // Score decreases as deadline approaches (0-7 days = 350-0, 7-30 days = 350-50, etc.)
    if (daysUntil <= 7) {
      score += 350 - daysUntil * 50
    } else if (daysUntil <= 30) {
      score += 50 - (daysUntil - 7) * 2
    }
  }

  // 3. Blocking tasks (tasks with children) get priority boost
  const children = graph.getChildrenIds(task.id)
  if (children && children.length > 0) {
    // Check if any children are not completed
    const hasActiveChildren = children.some((childId: string) => {
      const child = allTasks.get(childId)
      return child && !child.completed && child.status !== 'Ignored'
    })
    if (hasActiveChildren) {
      score += 200
    }
  }

  // 4. Tasks with high subtask completion get a small boost (momentum)
  if (children && children.length > 0) {
    const completedChildren = children.filter((childId: string) => {
      const child = allTasks.get(childId)
      return child && child.completed
    }).length
    const completionRatio = completedChildren / children.length
    score += completionRatio * 50
  }

  // 5. Tasks that should start soon
  if (task.startDate) {
    const now = new Date()
    const daysUntilStart = Math.ceil(
      (task.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    )
    if (daysUntilStart <= 0) {
      // Already should have started
      score += 100
    } else if (daysUntilStart <= 3) {
      // Should start soon
      score += 50
    }
  }

  return score
}

/**
 * Get tasks relevant to the current week
 * Includes: overdue tasks, tasks starting this week, tasks ending this week
 */
export function getWeeklyRelevantTasks(
  tasks: TaskClass[],
  referenceDate: Date = new Date(),
): TaskClass[] {
  const startOfWeek = getStartOfWeek(referenceDate)
  const endOfWeek = getEndOfWeek(referenceDate)

  return tasks.filter(task => {
    // Skip ignored tasks
    if (task.status === 'Ignored') {
      return false
    }

    // Include completed tasks only if they were completed this week
    if (task.completed) {
      return false // For now, don't show completed tasks
    }

    // Include overdue tasks
    if (isOverdue(task)) {
      return true
    }

    // Include tasks starting this week
    if (task.startDate) {
      const startDate = new Date(task.startDate)
      if (startDate >= startOfWeek && startDate <= endOfWeek) {
        return true
      }
    }

    // Include tasks ending this week
    const deadline = task.endDate || calculateSoftDeadline(task)
    if (deadline >= startOfWeek && deadline <= endOfWeek) {
      return true
    }

    return false
  })
}

/**
 * Get start of week (Sunday)
 */
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  const startOfWeek = new Date(d.setDate(diff))
  startOfWeek.setHours(0, 0, 0, 0)
  return startOfWeek
}

/**
 * Get end of week (Saturday)
 */
export function getEndOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + 6
  const endOfWeek = new Date(d.setDate(diff))
  endOfWeek.setHours(23, 59, 59, 999)
  return endOfWeek
}

/**
 * Categorize tasks into focus groups
 */
export interface TasksByFocus {
  focusNow: TaskClass[] // High priority tasks to focus on immediately
  thisWeek: TaskClass[] // Other tasks for the week
}

/**
 * Group parent and child tasks together when both are prioritized
 * Returns task IDs to hide (because they'll be shown as part of parent group)
 */
export function getTasksToHideInGroup(
  tasks: TaskClass[],
  graph: GraphLike,
): Set<string> {
  const tasksToHide = new Set<string>()
  const taskIds = new Set(tasks.map(t => t.id))

  for (const task of tasks) {
    // If this task has a parent and the parent is also in the list, hide this task
    const parentId = graph.getParentId(task.id)
    if (parentId && taskIds.has(parentId)) {
      tasksToHide.add(task.id)
    }
  }

  return tasksToHide
}

export function categorizeTasksByFocus(
  tasks: TaskClass[],
  graph: GraphLike,
  allTasks: Map<string, TaskClass>,
): TasksByFocus {
  // Calculate priority scores
  const tasksWithScores = tasks.map(task => ({
    task,
    score: calculatePriorityScore(task, graph, allTasks),
  }))

  // Sort by priority score (descending)
  tasksWithScores.sort((a, b) => b.score - a.score)

  // Separate into focus groups
  const focusNow: TaskClass[] = []
  const thisWeek: TaskClass[] = []

  // Focus Now: Top priority tasks and all overdue tasks
  // Use a threshold: tasks with score > 500 or overdue
  const FOCUS_THRESHOLD = 500
  const MAX_FOCUS_TASKS = 5 // Don't overwhelm the user

  for (const { task, score } of tasksWithScores) {
    if (score < 0) continue // Skip completed/ignored

    if (
      isOverdue(task) ||
      (score >= FOCUS_THRESHOLD && focusNow.length < MAX_FOCUS_TASKS)
    ) {
      focusNow.push(task)
    } else {
      thisWeek.push(task)
    }
  }

  return { focusNow, thisWeek }
}

/**
 * Get upcoming tasks for specified number of weeks ahead
 * Excludes current week and ignored/completed tasks
 */
export function getUpcomingTasksByWeek(
  tasks: TaskClass[],
  weeksAhead: number = 4,
  referenceDate: Date = new Date(),
): { week: number; tasks: TaskClass[] }[] {
  const result: { week: number; tasks: TaskClass[] }[] = []

  for (let weekNum = 1; weekNum <= weeksAhead; weekNum++) {
    const weekStart = getStartOfWeek(referenceDate)
    const weekStartForWeek = new Date(weekStart)
    weekStartForWeek.setDate(weekStartForWeek.getDate() + weekNum * 7)

    const weekEnd = new Date(weekStartForWeek)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const weekTasks = tasks.filter(task => {
      // Skip ignored and completed tasks
      if (task.status === 'Ignored' || task.completed) {
        return false
      }

      // Check if task falls in this week
      const deadline = task.endDate || calculateSoftDeadline(task)
      if (deadline >= weekStartForWeek && deadline <= weekEnd) {
        return true
      }

      // Check if task starts in this week
      if (task.startDate) {
        const startDate = new Date(task.startDate)
        if (startDate >= weekStartForWeek && startDate <= weekEnd) {
          return true
        }
      }

      return false
    })

    if (weekTasks.length > 0) {
      result.push({
        week: weekNum,
        tasks: weekTasks,
      })
    }
  }

  return result
}

/**
 * Get the date range for a specific week
 */
export function getWeekDateRange(
  weekNum: number,
  referenceDate: Date = new Date(),
): { start: Date; end: Date } {
  const weekStart = getStartOfWeek(referenceDate)
  const start = new Date(weekStart)
  start.setDate(start.getDate() + weekNum * 7)

  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

/**
 * Get a human-readable label for a week number
 */
export function getWeekLabel(weekNum: number): string {
  if (weekNum === 0) return 'This Week'
  if (weekNum === 1) return 'Next Week'
  return `Week ${weekNum}`
}

/**
 * Get parent task IDs for display context
 * When showing an urgent child task, we should also show its parent
 */
export function getParentChainIds(taskId: string, graph: GraphLike): string[] {
  const chain: string[] = []
  let currentId: string | undefined = taskId

  while (currentId) {
    const parent: string | undefined = graph.getParentId(currentId)
    if (parent) {
      chain.push(parent)
      currentId = parent
    } else {
      break
    }
  }

  return chain
}
