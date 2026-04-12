import { ref, watch, type Ref } from 'vue'

/**
 * Returns a stable snapshot of a reactive value that is updated asynchronously.
 * Because the watcher is queued (not sync), the snapshot still holds the
 * pre-mutation value during synchronous event handlers triggered by reactive changes.
 *
 * Useful for capturing "where was this item before the mutation" — e.g. which
 * section a task was in before its status changed.
 *
 * Example:
 *   const taskGroupSnapshot = useStableSnapshot(() => {
 *     const map = new Map<string, 'focusNow' | 'thisWeek'>()
 *     for (const t of focusNowTasks.value) map.set(t.id, 'focusNow')
 *     for (const t of thisWeekTasks.value) map.set(t.id, 'thisWeek')
 *     return map
 *   })
 *   // In a sync event handler: taskGroupSnapshot.value.get(task.id) is still pre-mutation
 */
export function useStableSnapshot<T>(source: () => T): Ref<T> {
  const snapshot = ref(source()) as Ref<T>
  watch(source, newVal => {
    snapshot.value = newVal
  })
  return snapshot
}
