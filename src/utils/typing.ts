export function isTask(object: unknown): object is Task {
  return (
    typeof object === 'object' &&
    object !== null &&
    'priority' in object &&
    'endDate' in object
  )
}
