import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'

/**
 * IndexedDB schema for local task storage
 */
interface TaskDB extends DBSchema {
  tasks: {
    key: string // task URL
    value: {
      url: string
      title: string
      description?: string
      priority?: number
      dateCreated?: string // ISO string
      startDate?: string // ISO string
      endDate?: string // ISO string
      status?: string
      subTaskUrls?: string[]
      parentTaskUrl?: string
      lastModified: string // ISO string for sync
      syncStatus: 'synced' | 'pending' | 'conflict'
    }
    indexes: {
      'by-lastModified': string
      'by-syncStatus': string
    }
  }
  metadata: {
    key: string
    value: {
      key: string
      value: string | number | boolean
    }
  }
}

/**
 * Local storage service using IndexedDB for offline-first task management
 */
export class IndexedDBTaskStorage {
  private db: IDBPDatabase<TaskDB> | null = null
  private readonly dbName = 'solid-planner'
  private readonly version = 1

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.db) return

    this.db = await openDB<TaskDB>(this.dbName, this.version, {
      upgrade(db) {
        // Create tasks store
        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'url' })
          taskStore.createIndex('by-lastModified', 'lastModified')
          taskStore.createIndex('by-syncStatus', 'syncStatus')
        }

        // Create metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' })
        }
      },
    })
  }

  /**
   * Save task to local storage
   * Accepts dates as either Date objects or ISO strings for flexibility
   */
  async saveTask(task: {
    url: string
    title: string
    description?: string
    priority?: number
    dateCreated?: Date | string
    startDate?: Date | string
    endDate?: Date | string
    status?: string
    subTaskUrls?: string[]
    parentTaskUrl?: string
  }): Promise<void> {
    if (!this.db) await this.init()

    // Helper to convert Date | string to ISO string
    const toISOString = (date?: Date | string): string | undefined => {
      if (!date) return undefined
      if (typeof date === 'string') return date
      return date.toISOString()
    }

    const taskData = {
      url: task.url,
      title: task.title,
      description: task.description,
      priority: task.priority,
      dateCreated: toISOString(task.dateCreated),
      startDate: toISOString(task.startDate),
      endDate: toISOString(task.endDate),
      status: task.status,
      subTaskUrls: task.subTaskUrls,
      parentTaskUrl: task.parentTaskUrl,
      lastModified: new Date().toISOString(),
      syncStatus: 'pending' as const,
    }

    await this.db!.put('tasks', taskData)
  }

  /**
   * Get task from local storage
   */
  async getTask(url: string) {
    if (!this.db) await this.init()
    return await this.db!.get('tasks', url)
  }

  /**
   * Get all tasks from local storage
   */
  async getAllTasks() {
    if (!this.db) await this.init()
    return await this.db!.getAll('tasks')
  }

  /**
   * Get tasks pending sync
   */
  async getPendingTasks() {
    if (!this.db) await this.init()
    const index = this.db!.transaction('tasks').store.index('by-syncStatus')
    return await index.getAll('pending')
  }

  /**
   * Mark task as synced
   */
  async markAsSynced(url: string): Promise<void> {
    if (!this.db) await this.init()

    const task = await this.db!.get('tasks', url)
    if (task) {
      task.syncStatus = 'synced'
      await this.db!.put('tasks', task)
    }
  }

  /**
   * Mark task as conflict
   */
  async markAsConflict(url: string): Promise<void> {
    if (!this.db) await this.init()

    const task = await this.db!.get('tasks', url)
    if (task) {
      task.syncStatus = 'conflict'
      await this.db!.put('tasks', task)
    }
  }

  /**
   * Delete task from local storage
   */
  async deleteTask(url: string): Promise<void> {
    if (!this.db) await this.init()
    await this.db!.delete('tasks', url)
  }

  /**
   * Clear all tasks (for testing or reset)
   */
  async clearAllTasks(): Promise<void> {
    if (!this.db) await this.init()
    await this.db!.clear('tasks')
  }

  /**
   * Get metadata value
   */
  async getMetadata(
    key: string,
  ): Promise<string | number | boolean | undefined> {
    if (!this.db) await this.init()
    const result = await this.db!.get('metadata', key)
    return result?.value
  }

  /**
   * Set metadata value
   */
  async setMetadata(
    key: string,
    value: string | number | boolean,
  ): Promise<void> {
    if (!this.db) await this.init()
    await this.db!.put('metadata', { key, value })
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTime(): Promise<Date | null> {
    const timestamp = await this.getMetadata('lastSyncTime')
    return timestamp ? new Date(timestamp as string) : null
  }

  /**
   * Set last sync timestamp
   */
  async setLastSyncTime(date: Date): Promise<void> {
    await this.setMetadata('lastSyncTime', date.toISOString())
  }
}

/**
 * Create a singleton instance of IndexedDB storage
 */
let instance: IndexedDBTaskStorage | null = null

export function getIndexedDBStorage(): IndexedDBTaskStorage {
  if (!instance) {
    instance = new IndexedDBTaskStorage()
  }
  return instance
}
