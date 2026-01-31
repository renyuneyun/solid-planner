import { vi } from 'vitest'

vi.mock('soukai', () => ({
  setEngine: vi.fn(),
}))

vi.mock('soukai-solid', () => ({
  bootSolidModels: vi.fn(),
  SolidEngine: class {
    constructor(public authFetch: typeof fetch) {
      void authFetch
    }
  },
}))
