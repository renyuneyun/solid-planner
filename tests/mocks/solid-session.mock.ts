import { vi } from 'vitest'
import { reactive } from 'vue'

export const sessionState = reactive({
  webid: null as string | null,
  session: null as null | { fetch: typeof fetch },
})

vi.mock('solid-helper-vue', () => ({
  useSessionStore: () => sessionState,
}))

vi.mock('@renyuneyun/solid-helper', () => ({
  findStorage: vi.fn(),
}))

vi.mock('@/storage/soukai/soukai-storage', () => ({
  createSolidTaskService: vi.fn(),
  SolidTaskService: class {},
}))
