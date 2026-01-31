import { TaskClass } from '@/models/TaskClass'

export function isToday(dateStr: string) {
  const date = new Date(dateStr)
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

export function isThisWeek(dateStr: string) {
  const date = new Date(dateStr)
  const today = new Date()
  const startOfWeekBase = new Date(today)
  const endOfWeekBase = new Date(today)

  const startOfWeek = new Date(
    startOfWeekBase.setDate(startOfWeekBase.getDate() - startOfWeekBase.getDay()),
  )
  const endOfWeek = new Date(
    endOfWeekBase.setDate(endOfWeekBase.getDate() - endOfWeekBase.getDay() + 7),
  )
  return date >= startOfWeek && date <= endOfWeek
}

export function isOverdue(task: TaskClass) {
  return task.effectiveEndDate < new Date() && !task.completed
}

export function endOfWeek(date: Date) {
  const day = new Date(date)
  return new Date(day.setDate(day.getDate() - day.getDay() + 7))
}
