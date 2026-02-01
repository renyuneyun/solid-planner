# CRDT-based Sync Implementation

## Overview

Solid Planner now implements a CRDT-like (Conflict-free Replicated Data Type) synchronization mechanism between local IndexedDB storage and remote Solid Pod storage. This provides a local-first experience where the UI remains responsive even with slow or no network connection.

## Architecture

### Components

1. **IndexedDB Storage** (`src/storage/local/indexeddb-storage.ts`)
   - Local persistent storage using browser's IndexedDB
   - Stores tasks with sync metadata (lastModified, syncStatus)
   - Tracks pending changes that need to be synced

2. **Sync Service** (`src/storage/sync/sync-service.ts`)
   - Orchestrates synchronization between local and remote storage
   - Implements last-write-wins conflict resolution
   - Provides auto-sync at configurable intervals

3. **Soukai Integration** (`src/storage/soukai/Task.model.ts`)
   - Enabled Soukai's built-in history tracking (`history = true`)
   - Enabled tombstone mechanism for deleted tasks (`tombstone = true`)
   - Uses Soukai's automatic `updatedAt` field for conflict resolution

## How It Works

### Local-First Operations

All operations (create, update, delete) follow this pattern:

1. **Immediate Local Save**: Changes are saved to IndexedDB instantly
2. **UI Update**: The UI updates immediately based on local data
3. **Background Sync**: Changes are synced to Solid Pod in the background

This ensures the app feels fast and responsive, even offline.

### Sync Process

The sync service performs bidirectional synchronization:

#### Push (Local → Remote)
1. Get all tasks marked as 'pending' in local storage
2. For each pending task:
   - Check if task exists remotely
   - If exists: Apply conflict resolution
   - If not: Create new remote task
3. Mark successfully synced tasks as 'synced'

#### Pull (Remote → Local)
1. Fetch all tasks from Solid Pod
2. For each remote task:
   - Check if exists locally
   - If not: Add to local storage
   - If exists and local is 'synced': Update local with remote
   - If exists and local is 'pending': Skip (already pushed)

### Conflict Resolution

Three strategies are available (configurable):

1. **last-write-wins** (default): Compare timestamps, use most recent
2. **local-wins**: Always prefer local changes
3. **remote-wins**: Always prefer remote changes

The `updatedAt` field (automatically maintained by Soukai) is used for timestamp comparison.

### Auto-Sync

When authenticated, auto-sync runs every 60 seconds (configurable):
```typescript
syncService.startAutoSync(60000) // 60 seconds
```

Users can also trigger manual sync via the sync button in the UI.

## Soukai CRDT Features

Soukai provides built-in CRDT support through:

### History Tracking
```typescript
static history = true
```
- Records all operations on a model
- Creates operation records for each change
- Enables synchronization between divergent instances

### Tombstones
```typescript
static tombstone = true
```
- Keeps markers for deleted documents
- Prevents re-creation during sync
- Can be disabled if needed

### Synchronization
Soukai's `synchronize()` method can merge divergent model instances:
```typescript
await SolidModel.synchronize(original, divergent)
```

While we're not using this directly yet, it's available for more sophisticated merge strategies in the future.

## Usage

### In Components

```vue
<script setup>
import { useSolidTasks } from '@/composables/useSolidTasks'

const {
  isOnline,
  syncStatus,
  addTaskAndSave,
  updateTaskAndSave,
  removeTaskAndSave,
  manualSync,
} = useSolidTasks()

// Operations are automatically local-first
await addTaskAndSave(newTask)
await updateTaskAndSave(existingTask)
await removeTaskAndSave(taskId)

// Manual sync if needed
await manualSync()
</script>
```

### Sync Status

The `syncStatus` reactive value indicates the current state:
- `'idle'`: All changes synced
- `'syncing'`: Currently synchronizing
- `'error'`: Sync error occurred
- `'offline'`: No remote service available

## Database Schema

### IndexedDB Schema

```typescript
interface TaskDB {
  tasks: {
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
    lastModified: string        // For conflict resolution
    syncStatus: 'synced' | 'pending' | 'conflict'
  }
  metadata: {
    key: string
    value: string | number | boolean
  }
}
```

### RDF Schema (Solid Pod)

Tasks are stored as RDF using schema.org vocabulary:
- `schema:Action` - Task type
- `schema:name` - Title
- `schema:description` - Description
- `schema:priority` - Priority
- `schema:dateCreated` - Creation date
- `schema:startTime` - Start date
- `schema:endTime` - End date
- `schema:actionStatus` - Status
- `schema:hasPart` - Subtasks
- `schema:partOf` - Parent task

Soukai also automatically manages:
- `createdAt` - Timestamp when task was created
- `updatedAt` - Timestamp when task was last modified (used for CRDT conflict resolution)

## Future Improvements

1. **True CRDT Implementation**: Use Soukai's synchronize() for field-level merging
2. **Operation Log**: Track individual field changes for better conflict resolution
3. **Optimistic Conflict Detection**: Show warnings before syncing conflicting changes
4. **Selective Sync**: Allow users to choose which tasks to sync
5. **Offline Indicator**: More prominent offline mode indicators
6. **Sync History**: Show sync log for debugging

## Testing

To test the sync functionality:

1. **Offline Mode**: 
   - Create tasks while offline
   - Go online and observe auto-sync
   
2. **Conflict Resolution**:
   - Modify same task on two devices
   - Sync and verify last-write-wins behavior

3. **Network Interruption**:
   - Start a save operation
   - Disconnect network
   - Verify task saved locally and syncs when reconnected

## Performance Considerations

- IndexedDB operations are asynchronous and non-blocking
- Auto-sync runs in background (doesn't block UI)
- Large task lists may take longer to sync initially
- Consider implementing pagination for very large datasets

## References

- [Soukai Local-First Guide](https://soukai.js.org/guide/advanced/local-first.html)
- [CRDT Wikipedia](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type)
- [Local-First Software](https://www.inkandswitch.com/local-first/)
