import { TaskClass } from '@/types/task'

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
  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()))
  const endOfWeek = new Date(
    today.setDate(today.getDate() - today.getDay() + 7),
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
