import { vi } from 'vitest'

export interface RecordedEngine {
  authFetch: unknown
  config: Record<string, unknown>
}

/**
 * Every `SolidEngine` the production `SolidTaskService` constructs is recorded
 * here so tests can assert how the engine was configured (e.g. fetch
 * concurrency) without pulling in the real Soukai engine.
 */
export const recordedEngines: RecordedEngine[] = []

vi.mock('soukai', () => ({
  setEngine: vi.fn(),
}))

vi.mock('soukai-solid', () => ({
  bootSolidModels: vi.fn(),
  SolidEngine: class {
    constructor(
      public authFetch: typeof fetch,
      config: Record<string, unknown> = {},
    ) {
      void authFetch
      recordedEngines.push({ authFetch, config })
    }
  },
}))