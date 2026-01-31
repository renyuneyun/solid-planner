import { vi } from 'vitest'

export type TaskData = {
  url?: string
  title?: string
  description?: string
  dateCreated?: Date
  startDate?: Date
  endDate?: Date
  status?: string
  subTaskUrls?: string[]
  parentTaskUrl?: string
}

export class MockTask {
  url?: string
  title?: string
  description?: string
  dateCreated?: Date
  startDate?: Date
  endDate?: Date
  status?: string
  subTaskUrls?: string[]
  parentTaskUrl?: string

  static records = new Map<string, TaskData>()
  static allResponse: MockTask[] | null = null

  static from(containerUrl: string) {
    void containerUrl
    return {
      all: async () =>
        MockTask.allResponse ??
        Array.from(MockTask.records.values()).map(data => new MockTask(data)),
    }
  }

  static async find(url: string) {
    const data = MockTask.records.get(url)
    if (!data) return null
    return new MockTask({ ...data, url })
  }

  constructor(data: TaskData = {}) {
    Object.assign(this, data)
  }

  async save(containerUrl?: string) {
    if (!this.url) {
      const baseUrl = containerUrl ?? 'https://mock.pod/tasks/'
      this.url = `${baseUrl}${Date.now()}`
    }
    MockTask.records.set(this.url, { ...this })
    return this
  }

  async delete() {
    if (this.url) {
      MockTask.records.delete(this.url)
    }
    return this
  }

  static clear() {
    MockTask.records.clear()
    MockTask.allResponse = null
  }
}

vi.mock('@/storage/soukai/Task.model', () => ({
  default: MockTask,
}))
