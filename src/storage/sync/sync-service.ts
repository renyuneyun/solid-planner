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
 * Sync service for CRDT-like synchronization between local and remote storage
 * Implements a last-write-wins strategy with vector clocks/timestamps
 */
export class SyncService {
  private syncStatus: SyncStatus = 'idle'
  private lastError: Error | null = null
  private syncInterval: number | null = null
  private listeners: Set<(status: SyncStatus) => void> = new Set()

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(
    private localStore: IndexedDBTaskStorage,
    private remoteService: RemoteTaskService | null,
    private conflictResolution: ConflictResolution = 'last-write-wins',
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
      // Step 1: Get pending local changes
      const pendingTasks = await this.localStore.getPendingTasks()

      // Step 2: Push local changes to remote
      for (const localTask of pendingTasks) {
        try {
          await this.pushToRemote(localTask)
          await this.localStore.markAsSynced(localTask.url)
        } catch {
          console.error('Failed to push task:', localTask.url)
          // Continue with other tasks
        }
      }

      // Step 3: Pull remote changes
      await this.pullFromRemote()

      // Step 4: Update last sync time
      await this.localStore.setLastSyncTime(new Date())

      this.updateStatus('idle')
    } catch (err) {
      this.lastError = err instanceof Error ? err : new Error(String(err))
      this.updateStatus('error')
      throw err
    }
  }

  /**
   * Push local task to remote storage
   */
  private async pushToRemote(localTask: {
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
  }): Promise<void> {
    if (!this.remoteService) return

    const isNewTask = localTask.url.startsWith('temp:')
    
    // For existing tasks (real URLs), try to find and update remotely
    if (!isNewTask) {
      let remoteTask: Task | null = null
      try {
        remoteTask = await Task.find(localTask.url)
      } catch (error) {
        console.warn(`Could not find remote task ${localTask.url}:`, error)
        // Task might have been deleted remotely, or there's a network issue
        // We'll treat it as not found and potentially recreate it
      }

      if (remoteTask) {
        // Task exists remotely - update it
        await this.resolveConflict(localTask, remoteTask)
        return
      }
      
      // If we can't find a task with a real URL, it might have been deleted remotely
      // Log a warning but don't create duplicate - we'll keep the local version only
      console.warn(`Task ${localTask.url} not found remotely - keeping local version only`)
      return
    }

    // Create new remote task (only for temp: URLs)
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

    await newTask.save(this.remoteService.getTaskContainerUrl())

    // Update local task with the real URL from Pod
    await this.localStore.deleteTask(localTask.url)
    await this.localStore.saveTask({
      url: newTask.url!,
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      dateCreated: newTask.dateCreated,
      startDate: newTask.startDate,
      endDate: newTask.endDate,
      status: newTask.status,
      subTaskUrls: newTask.subTaskUrls,
      parentTaskUrl: newTask.parentTaskUrl,
    })
  }

  /**
   * Pull changes from remote storage
   */
  private async pullFromRemote(): Promise<void> {
    if (!this.remoteService) return

    const remoteTasks = await this.remoteService.fetchTasks()

    for (const remoteTask of remoteTasks) {
      const localTask = await this.localStore.getTask(remoteTask.url!)

      if (!localTask) {
        // New remote task - save locally
        await this.localStore.saveTask({
          url: remoteTask.url!,
          title: remoteTask.title,
          description: remoteTask.description,
          priority: remoteTask.priority,
          dateCreated: remoteTask.dateCreated,
          startDate: remoteTask.startDate,
          endDate: remoteTask.endDate,
          status: remoteTask.status,
          subTaskUrls: remoteTask.subTaskUrls,
          parentTaskUrl: remoteTask.parentTaskUrl,
        })
        await this.localStore.markAsSynced(remoteTask.url!)
      } else if (localTask.syncStatus === 'synced') {
        // Update local with remote (no local changes)
        await this.localStore.saveTask({
          url: remoteTask.url!,
          title: remoteTask.title,
          description: remoteTask.description,
          priority: remoteTask.priority,
          dateCreated: remoteTask.dateCreated,
          startDate: remoteTask.startDate,
          endDate: remoteTask.endDate,
          status: remoteTask.status,
          subTaskUrls: remoteTask.subTaskUrls,
          parentTaskUrl: remoteTask.parentTaskUrl,
        })
        await this.localStore.markAsSynced(remoteTask.url!)
      }
      // If localTask.syncStatus === 'pending', we already pushed changes
    }
  }

  /**
   * Resolve conflict between local and remote versions
   */
  private async resolveConflict(
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
    remoteTask: Task,
  ): Promise<void> {
    switch (this.conflictResolution) {
      case 'last-write-wins':
        // Compare timestamps and use the most recent
        const localTime = new Date(localTask.lastModified).getTime()
        const remoteTime = remoteTask.updatedAt?.getTime() || remoteTask.createdAt?.getTime() || 0

        if (localTime > remoteTime) {
          // Local wins - update remote
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
          // Remote wins - update local
          await this.localStore.saveTask({
            url: remoteTask.url!,
            title: remoteTask.title,
            description: remoteTask.description,
            priority: remoteTask.priority,
            dateCreated: remoteTask.dateCreated,
            startDate: remoteTask.startDate,
            endDate: remoteTask.endDate,
            status: remoteTask.status,
            subTaskUrls: remoteTask.subTaskUrls,
            parentTaskUrl: remoteTask.parentTaskUrl,
          })
        }
        break

      case 'local-wins':
        // Always prefer local
        remoteTask.title = localTask.title
        remoteTask.description = localTask.description
        await remoteTask.save()
        break

      case 'remote-wins':
        // Always prefer remote
        await this.localStore.saveTask({
          url: remoteTask.url!,
          title: remoteTask.title,
          description: remoteTask.description,
          priority: remoteTask.priority,
          dateCreated: remoteTask.dateCreated,
          startDate: remoteTask.startDate,
          endDate: remoteTask.endDate,
          status: remoteTask.status,
          subTaskUrls: remoteTask.subTaskUrls,
          parentTaskUrl: remoteTask.parentTaskUrl,
        })
        break
    }
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
        // Mark for deletion on next sync?
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
