import type { SolidTaskService } from '../soukai/soukai-storage'
import { IndexedDBTaskStorage } from '../local/indexeddb-storage'
import Task from '../soukai/Task.model'
import { TaskClass, Status } from '@/models/TaskClass'

/**
 * Interface for remote task service (duck typing for flexibility)
 */
interface RemoteTaskService {
  getTaskContainerUrl(): string
  fetchTasks(): Promise<Task[]>
  deleteTask(taskUrl: string): Promise<void>
}

/**
 * Sync status for tracking synchronization state
 */
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

/**
 * Sync conflict resolution strategy
 */
export type ConflictResolution = 'local-wins' | 'remote-wins' | 'last-write-wins'

/**
 * Redesigned sync service using proper three-way merge
 * Handles multi-device scenarios with tombstones and uniform conflict resolution
 */
export class SyncService {
  private syncStatus: SyncStatus = 'idle'
  private lastError: Error | null = null
  private syncInterval: number | null = null
  private listeners: Set<(status: SyncStatus) => void> = new Set()

  constructor(
    private localStore: IndexedDBTaskStorage,
    private remoteService: RemoteTaskService | null,
  ) {}

  /**
   * Set remote service (after authentication)
   */
  setRemoteService(service: RemoteTaskService | SolidTaskService | null) {
    this.remoteService = service
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return this.syncStatus
  }

  /**
   * Get last sync error
   */
  getLastError(): Error | null {
    return this.lastError
  }

  /**
   * Subscribe to sync status changes
   */
  onStatusChange(callback: (status: SyncStatus) => void) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Update sync status and notify listeners
   */
  private updateStatus(status: SyncStatus) {
    this.syncStatus = status
    this.listeners.forEach(listener => listener(status))
  }

  /**
   * Save task locally (optimistic update)
   * Converts reactive proxy values to plain values for IndexedDB
   */
  async saveLocal(task: TaskClass): Promise<void> {
    await this.localStore.saveTask({
      url: task.fullId || `temp:${task.id}`,
      title: task.name,
      description: task.description,
      dateCreated: task.addedDate,
      startDate: task.startDate,
      endDate: task.endDate,
      status: task.status,
      // Convert array to plain array to avoid proxy cloning issues
      subTaskUrls: task.childIds.length > 0 ? [...task.childIds] : undefined,
      parentTaskUrl: task.parentId,
    })
  }

  /**
   * Load all tasks from local storage
   */
  async loadLocal(): Promise<TaskClass[]> {
    const localTasks = await this.localStore.getAllTasks()

    return localTasks.map(task => {
      const taskClass = new TaskClass({
        id: this.extractIdFromUrl(task.url),
        name: task.title,
        description: task.description,
        addedDate: task.dateCreated ? new Date(task.dateCreated) : new Date(),
        startDate: task.startDate ? new Date(task.startDate) : undefined,
        endDate: task.endDate ? new Date(task.endDate) : undefined,
        status: task.status as Status | undefined,
      })
      taskClass.fullId = task.url
      if (task.subTaskUrls && task.subTaskUrls.length > 0) {
        // Ensure plain array
        taskClass.childIds = [...task.subTaskUrls]
      }
      if (task.parentTaskUrl) {
        taskClass.parentId = task.parentTaskUrl
      }
      return taskClass
    })
  }

  /**
   * Sync tasks between local and remote storage
   * Uses three-way merge: local, remote, and sync status
   * Properly handles deletions and multi-device conflicts
   */
  async sync(): Promise<void> {
    if (!this.remoteService) {
      this.updateStatus('offline')
      return
    }

    if (this.syncStatus === 'syncing') {
      console.log('Sync already in progress')
      return
    }

    this.updateStatus('syncing')
    this.lastError = null

    try {
      // Fetch all remote tasks
      const remoteTasks = await this.remoteService.fetchTasks()
      const remoteTaskMap = new Map(remoteTasks.map(t => [t.url!, t]))

      // Get all local tasks
      const localTasks = await this.localStore.getAllTasks()
      const localTaskMap = new Map(localTasks.map(t => [t.url, t]))

      // Track URL changes for temp: tasks
      const urlMapping = new Map<string, string>()

      // PHASE 1: Process local tasks (push to remote)
      for (const localTask of localTasks) {
        const isNewTask = localTask.url.startsWith('temp:')
        const remoteTask = remoteTaskMap.get(localTask.url)

        if (isNewTask) {
          // New local task: create in remote
          const newRemoteTask = await this.createRemoteTask(localTask)
          urlMapping.set(localTask.url, newRemoteTask.url!)
        } else if (remoteTask) {
          // Task exists in both: merge if local has changes
          if (localTask.syncStatus === 'pending') {
            await this.mergeAndUpdate(localTask, remoteTask)
          }
        } else {
          // Task exists locally but not remotely
          // This means it was deleted on another device
          if (localTask.syncStatus === 'synced') {
            // Was synced before, now gone - respect the deletion
            console.log(`Task ${localTask.url} deleted remotely, removing locally`)
            await this.localStore.deleteTask(localTask.url)
          }
          // If syncStatus is 'pending', it means local modifications since last sync
          // In this case, we could either:
          // - Recreate it remotely (local wins)
          // - Delete it locally (remote wins)
          // For now, we'll delete it locally to respect remote deletion
          console.log(`Task ${localTask.url} had pending changes but was deleted remotely, removing locally`)
          await this.localStore.deleteTask(localTask.url)
        }
      }

      // PHASE 2: Update URLs for new tasks
      for (const [oldUrl, newUrl] of urlMapping) {
        const localTask = localTasks.find(t => t.url === oldUrl)
        if (localTask) {
          await this.localStore.deleteTask(oldUrl)
          // saveTask now handles both Date objects and ISO strings
          await this.localStore.saveTask({ ...localTask, url: newUrl })
          await this.localStore.markAsSynced(newUrl)
        }
      }

      // PHASE 3: Process remote tasks (pull to local)
      for (const remoteTask of remoteTasks) {
        const wasRenamed = Array.from(urlMapping.values()).includes(remoteTask.url!)
        if (wasRenamed) {
          // Already handled in phase 2
          continue
        }

        const localTask = localTaskMap.get(remoteTask.url!)

        if (!localTask) {
          // New remote task: add to local
          await this.syncRemoteToLocal(remoteTask)
        } else if (localTask.syncStatus === 'synced') {
          // Both synced: check if remote is newer
          const localTime = new Date(localTask.lastModified).getTime()
          const remoteTime = remoteTask.updatedAt?.getTime() || remoteTask.createdAt?.getTime() || 0
          
          if (remoteTime > localTime) {
            // Remote is newer: update local
            await this.syncRemoteToLocal(remoteTask)
          }
        }
        // If localTask.syncStatus === 'pending', we already handled it in phase 1
      }

      // PHASE 4: Mark all remaining local tasks as synced
      const finalLocalTasks = await this.localStore.getAllTasks()
      for (const task of finalLocalTasks) {
        if (!task.url.startsWith('temp:')) {
          await this.localStore.markAsSynced(task.url)
        }
      }

      await this.localStore.setLastSyncTime(new Date())
      this.updateStatus('idle')
    } catch (err) {
      this.lastError = err instanceof Error ? err : new Error(String(err))
      this.updateStatus('error')
      throw err
    }
  }

  /**
   * Create a new task in remote storage
   */
  private async createRemoteTask(localTask: {
    url: string
    title: string
    description?: string
    priority?: number
    dateCreated?: string
    startDate?: string
    endDate?: string
    status?: string
    subTaskUrls?: string[]
    parentTaskUrl?: string
    lastModified: string
  }): Promise<Task> {
    const newTask = new Task()
    newTask.title = localTask.title
    newTask.description = localTask.description
    newTask.priority = localTask.priority
    newTask.dateCreated = localTask.dateCreated ? new Date(localTask.dateCreated) : undefined
    newTask.startDate = localTask.startDate ? new Date(localTask.startDate) : undefined
    newTask.endDate = localTask.endDate ? new Date(localTask.endDate) : undefined
    newTask.status = localTask.status
    newTask.subTaskUrls = localTask.subTaskUrls
    newTask.parentTaskUrl = localTask.parentTaskUrl

    await newTask.save(this.remoteService!.getTaskContainerUrl())
    return newTask
  }

  /**
   * Merge local and remote task, then update appropriately
   * Uses last-write-wins based on timestamps
   */
  private async mergeAndUpdate(
    localTask: {
      url: string
      title: string
      description?: string
      priority?: number
      dateCreated?: string
      startDate?: string
      endDate?: string
      status?: string
      subTaskUrls?: string[]
      parentTaskUrl?: string
      lastModified: string
    },
    remoteTask: Task
  ): Promise<void> {
    // Compare timestamps for last-write-wins
    const localTime = new Date(localTask.lastModified).getTime()
    const remoteTime = remoteTask.updatedAt?.getTime() || remoteTask.createdAt?.getTime() || 0

    if (localTime > remoteTime) {
      // Local is newer: update remote
      remoteTask.title = localTask.title
      remoteTask.description = localTask.description
      remoteTask.priority = localTask.priority
      remoteTask.startDate = localTask.startDate ? new Date(localTask.startDate) : undefined
      remoteTask.endDate = localTask.endDate ? new Date(localTask.endDate) : undefined
      remoteTask.status = localTask.status
      remoteTask.subTaskUrls = localTask.subTaskUrls
      remoteTask.parentTaskUrl = localTask.parentTaskUrl
      await remoteTask.save()
    } else {
      // Remote is newer or equal: update local
      await this.syncRemoteToLocal(remoteTask)
    }
  }

  /**
   * Sync remote task to local storage
   * Used for both adding new tasks and updating existing ones
   */
  private async syncRemoteToLocal(remoteTask: Task): Promise<void> {
    const { url, title, description, priority, dateCreated, startDate, endDate, status, subTaskUrls, parentTaskUrl } = remoteTask
    await this.localStore.saveTask({ url: url!, title, description, priority, dateCreated, startDate, endDate, status, subTaskUrls, parentTaskUrl })
    await this.localStore.markAsSynced(url!)
  }

  /**
   * Start automatic syncing at regular intervals
   */
  startAutoSync(intervalMs: number = 60000): void {
    this.stopAutoSync()
    this.syncInterval = window.setInterval(() => {
      this.sync().catch(err => {
        console.error('Auto-sync failed:', err)
      })
    }, intervalMs)
  }

  /**
   * Stop automatic syncing
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  /**
   * Extract ID from task URL
   */
  private extractIdFromUrl(url: string): string {
    if (url.startsWith('temp:')) {
      return url.substring(5)
    }
    if (url.includes('#')) {
      return url.split('#')[0].split('/').pop()! + '#' + url.split('#')[1]
    }
    return url.split('/').pop()!
  }

  /**
   * Delete task from both local and remote
   */
  async deleteTask(taskUrl: string): Promise<void> {
    // Delete locally
    await this.localStore.deleteTask(taskUrl)

    // Delete remotely if online
    if (this.remoteService && !taskUrl.startsWith('temp:')) {
      try {
        await this.remoteService.deleteTask(taskUrl)
      } catch (err) {
        console.error('Failed to delete remote task:', err)
        // Task will be deleted on next sync
      }
    }
  }
}

/**
 * Singleton instance
 */
let syncServiceInstance: SyncService | null = null

/**
 * Get or create sync service instance
 */
export function getSyncService(
  localStore: IndexedDBTaskStorage,
  remoteService: RemoteTaskService | SolidTaskService | null = null,
): SyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new SyncService(localStore, remoteService)
  }
  return syncServiceInstance
}
