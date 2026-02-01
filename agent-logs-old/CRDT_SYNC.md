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

The sync service implements a **three-way merge** algorithm that compares:

1. **Local state** (current IndexedDB contents)
2. **Remote state** (current Solid Pod contents)
3. **Sync status** (was task synced before? has it changed locally?)

This ensures proper handling of multi-device scenarios, including tasks created, modified, or deleted on other devices.

#### Four-Phase Sync Algorithm

**PHASE 1: Push Local Changes**

For each local task:

- **New tasks** (`temp:` URLs): Create in remote, track URL mapping
- **Modified tasks** (syncStatus = 'pending'): Merge with remote using conflict resolution
- **Synced tasks missing remotely**: Respect remote deletion
  - If `syncStatus = 'synced'`: Task was deleted on another device → delete locally
  - If `syncStatus = 'pending'`: Task has local changes but was deleted remotely → delete locally (respecting remote deletion)

**PHASE 2: Update Temporary URLs**

For newly created tasks:

- Replace `temp:` URLs with real Solid Pod URLs
- Update local storage with new URLs
- Mark as synced

**PHASE 3: Pull Remote Changes**

For each remote task:

- **New remote tasks**: Add to local storage
- **Synced tasks**: Check timestamps, update local if remote is newer
- **Pending local tasks**: Skip (already handled in Phase 1)
- **Renamed tasks**: Skip (already handled in Phase 2)

**PHASE 4: Mark as Synced**

- Mark all local tasks (except temp: tasks) as synced
- Record sync timestamp

### Conflict Resolution

The sync service uses **last-write-wins** conflict resolution based on timestamps:

- **Local timestamp**: `lastModified` field in IndexedDB
- **Remote timestamp**: `updatedAt` field (automatically maintained by Soukai)

#### Multi-Device Scenarios

**Scenario 1: Task Modified on Two Devices**

Device A and Device B both modify the same task offline:

1. Both devices have `syncStatus = 'pending'`
2. Device A syncs first → updates remote with timestamp T1
3. Device B syncs next → compares timestamps
   - If B's `lastModified` > T1: B's changes win
   - If B's `lastModified` < T1: A's changes preserved
4. Device A syncs again → sees newer remote timestamp, pulls B's changes

**Scenario 2: Task Deleted on Another Device**

Device A deletes a task while Device B is offline:

1. Device A deletes task → removed from Solid Pod
2. Device B's local copy has `syncStatus = 'synced'` (no local changes)
3. Device B syncs → Phase 1 detects task missing remotely
4. Because `syncStatus = 'synced'`, Device B **respects the deletion** and removes task locally

**Scenario 3: Task Deleted Remotely but Modified Locally**

Device A deletes a task, Device B modifies it offline:

1. Device B has local changes: `syncStatus = 'pending'`
2. Device B syncs → detects task missing remotely in Phase 1
3. **Remote deletion wins**: Device B deletes the task locally
   - Rationale: Remote deletion is an explicit user action on another device
   - Alternative would be to recreate remotely, but this could restore unwanted tasks

**Scenario 4: New Task Created on Another Device**

1. Device A creates and syncs a task
2. Device B syncs → Phase 3 detects new remote task
3. Device B adds task to local storage and marks as synced

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

## Sync Status Tracking

### Why Sync Status Matters

The `syncStatus` field is crucial for proper three-way merge:

- **'synced'**: Task matches remote state (or remote when last synced)

  - Safe to replace with remote updates
  - If missing remotely, respect the deletion

- **'pending'**: Task has local changes not yet synced
  - Must push to remote in Phase 1
  - Takes precedence over remote until synced
  - If missing remotely, still respect deletion (explicit remote action)

Without sync status, we can't distinguish:

- **Local modification** vs **remote modification**
- **Never synced** vs **synced then modified**
- **Should push** vs **should pull**

### State Transitions

```
New task created locally:
  [No entry] → syncStatus = 'pending', url = 'temp:...'

First sync:
  syncStatus = 'pending' → create remote → url updated → syncStatus = 'synced'

Local modification:
  syncStatus = 'synced' → user edits → syncStatus = 'pending'

Remote modification (during sync):
  syncStatus = 'synced' + remote timestamp newer → update local → syncStatus = 'synced'

Remote deletion (during sync):
  syncStatus = 'synced' + missing remotely → delete local
  syncStatus = 'pending' + missing remotely → delete local (respect deletion)
```

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
    lastModified: string // For conflict resolution
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

## Implementation Notes

### Why Three-Way Merge?

Initially, the sync implementation treated new tasks and modified tasks differently, which led to issues:

- Duplicate tasks when creating offline
- Lost deletions from other devices
- Unclear handling of concurrent modifications

The **three-way merge** approach treats all tasks uniformly:

- Compare current local state, current remote state, and sync status
- Sync status tells us if local changes exist (pending) or task matches remote (synced)
- This handles all edge cases consistently

### Why Respect Remote Deletions?

When a task is deleted on one device and synced, other devices should respect that deletion even if they have pending local changes. Rationale:

1. **User Intent**: Deletion is an explicit user action on another device
2. **Avoid Task Resurrection**: Automatically recreating deleted tasks is surprising and unwanted
3. **Consistency**: All devices should converge to the same state

Alternative approaches (recreate deleted tasks) would require:

- Conflict UI asking user to choose
- Operation logs to distinguish "never synced" from "deleted remotely"
- More complex merge strategies

For this application, respecting deletions provides the best user experience.

### Why Date | string Union Types?

The `saveTask` method accepts both `Date` objects and ISO strings:

```typescript
dateCreated?: Date | string
```

This flexibility enables:

- **From Application**: Pass `Date` objects from TaskClass instances
- **From IndexedDB**: Spread ISO strings directly without conversion
- **Simplifies Phase 2**: `{ ...localTask, url: newUrl }` works without manual field mapping

Internally, dates are normalized to ISO strings for IndexedDB storage.

## Future Improvements

### Completed ✅

- ✅ Three-way merge with proper multi-device support
- ✅ Respect remote deletions (tombstone-like behavior)
- ✅ Last-write-wins conflict resolution
- ✅ Local-first operations with instant UI updates
- ✅ Sync status tracking and display
- ✅ Comprehensive test coverage

### Planned

1. **True CRDT Implementation**: Use Soukai's synchronize() for field-level merging

   - Current: Whole-task last-write-wins
   - Future: Per-field merging (e.g., title from Device A, description from Device B)

2. **Operation Log**: Track individual field changes for better conflict resolution

   - Record what changed, when, and on which device
   - Enable more sophisticated merge strategies

3. **User-Controlled Conflict Resolution**: For critical conflicts, ask user

   - When both devices modify the same field
   - When a deleted task has local modifications
   - Show diff UI and let user choose

4. **Selective Sync**: Allow users to choose which tasks to sync

   - Exclude completed tasks
   - Sync only specific projects
   - Manual sync control per task

5. **Sync History**: Show sync log for debugging

   - What was synced when
   - Which device made changes
   - Conflict resolution history

6. **Optimistic Conflict Detection**: Warn before syncing

   - Detect potential conflicts before sync
   - Show preview of what will change
   - Allow user to cancel or proceed

7. **Performance Optimization**:
   - Incremental sync (only changed tasks)
   - Batch operations for large task lists
   - Background sync worker

## Testing

To test the sync functionality:

1. **Offline Mode**:

   - Create tasks while offline
   - Go online and observe auto-sync
   - Verify temp: URLs are replaced with real URLs

2. **Conflict Resolution**:

   - Modify same task on two devices
   - Sync both devices sequentially
   - Verify last-write-wins behavior (newer timestamp wins)
   - Sync first device again, verify it gets the winner's changes

3. **Remote Deletion**:

   - Device A: Delete a task and sync
   - Device B: Offline, do NOT modify the task
   - Device B: Go online and sync
   - Verify task is deleted on Device B (respecting remote deletion)

4. **Remote Deletion with Local Changes**:

   - Device A: Delete a task and sync
   - Device B: Offline, modify the same task
   - Device B: Go online and sync
   - Verify task is deleted on Device B (remote deletion wins)

5. **Multi-Device Create**:

   - Device A: Create task "Task A" and sync
   - Device B: Offline, create task "Task B"
   - Device B: Go online and sync
   - Verify both devices have both tasks

6. **Network Interruption**:
   - Start a save operation
   - Disconnect network
   - Verify task saved locally with pending status
   - Reconnect and verify it syncs automatically

## Performance Considerations

- IndexedDB operations are asynchronous and non-blocking
- Auto-sync runs in background (doesn't block UI)
- Large task lists may take longer to sync initially
- Consider implementing pagination for very large datasets

## References

- [Soukai Local-First Guide](https://soukai.js.org/guide/advanced/local-first.html)
- [CRDT Wikipedia](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type)
- [Local-First Software](https://www.inkandswitch.com/local-first/)
