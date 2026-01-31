import { vi } from 'vitest'
import { SolidModel } from 'soukai-solid'

/**
 * Mock implementation of Soukai's SolidModel for testing
 * This allows testing without actual Solid Pod connections
 */
// @ts-expect-error - Mock implementation doesn't perfectly match Soukai generics
export class MockSolidModel extends SolidModel {
  static mockStorage = new Map<string, Record<string, unknown>>()

  static async create(attributes: Record<string, unknown>) {
    const id = attributes.url || `https://mock.pod/tasks/${Date.now()}`
    const instance = new this(attributes)
    instance.url = id as string
    MockSolidModel.mockStorage.set(id as string, { ...attributes, url: id })
    return instance
  }

  static async all() {
    return Array.from(MockSolidModel.mockStorage.values()).map(data => {
      const instance = new this(data)
      instance.url = data.url as string
      return instance
    })
  }

  static async find(url: string) {
    const data = MockSolidModel.mockStorage.get(url)
    if (!data) return null
    const instance = new this(data)
    instance.url = url
    return instance
  }

  async save(): Promise<this> {
    const data = this.getAttributes()
    ;(this.constructor as typeof MockSolidModel).mockStorage.set(
      this.url!,
      data,
    )
    return this
  }

  async delete(): Promise<this> {
    if (this.url) {
      ;(this.constructor as typeof MockSolidModel).mockStorage.delete(this.url)
    }
    return this
  }

  static clearMockStorage(): void {
    this.mockStorage.clear()
  }
}

/**
 * Mock Soukai bootSolidModels function
 */
export const mockBootSolidModels = vi.fn()

/**
 * Mock Soukai engine
 */
export const mockSoukaiEngine = {
  setEngine: vi.fn(),
  requireEngine: vi.fn(),
}
