import { computed, ref } from 'vue'

// TODO(sync): Postponed state is currently local-only (localStorage).
// In the future this could be synced to the Solid Pod as a field on the task.
const STORAGE_KEY = 'solid-planner:postponed'

// Default postpone duration: 8 hours. Will be made user-configurable later.
const POSTPONE_DURATION_MS = 8 * 60 * 60 * 1000

function loadPostponed(): Map<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as Record<string, number>
    const now = Date.now()
    const result = new Map<string, number>()
    for (const [id, expiry] of Object.entries(parsed)) {
      if (expiry > now) {
        result.set(id, expiry)
      }
    }
    return result
  } catch {
    return new Map()
  }
}

function savePostponed(map: Map<string, number>): void {
  const obj: Record<string, number> = {}
  for (const [id, expiry] of map.entries()) {
    obj[id] = expiry
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
}

export function usePostponedTasks() {
  const postponedMap = ref<Map<string, number>>(loadPostponed())

  const postponedIds = computed(() => new Set(postponedMap.value.keys()))

  function postpone(taskId: string): void {
    const next = new Map(postponedMap.value)
    next.set(taskId, Date.now() + POSTPONE_DURATION_MS)
    postponedMap.value = next
    savePostponed(next)
  }

  function restore(taskId: string): void {
    const next = new Map(postponedMap.value)
    next.delete(taskId)
    postponedMap.value = next
    savePostponed(next)
  }

  return { postponedIds, postpone, restore }
}
