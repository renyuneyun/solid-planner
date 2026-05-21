# Sync Service

`src/storage/sync/sync-service.ts`

## What it does

Bidirectional merge between IndexedDB (local) and the Solid Pod (remote). Runs on login, on a 10-minute auto-sync timer, and on demand via `manualSync()`.

## 4-phase algorithm

### Phase 1a — Push deletions

For each local tombstone (`syncStatus = 'deleted'`):
- If the task has a real URL (not `temp:`), attempt to delete it from the remote.
- On success (or if it was temp-only), remove the local record entirely.
- On failure, keep the tombstone so the next sync retries.

### Phase 1b — Push active local tasks

For each non-deleted local task:
- **New task** (`temp:` URL): create in remote, record the old→new URL mapping.
- **Exists in both, local is pending**: merge via `mergeAndUpdate` (see conflict resolution below).
- **Exists locally but not remotely**:
  - `syncStatus = 'synced'` → was deleted on another device; remove locally.
  - `syncStatus = 'pending'` → conflict; apply the configured strategy (default `local-wins` recreates the task remotely).

### Phase 2 — Update URLs for new tasks

Replace `temp:` local records with the canonical Pod URL from the mapping built in Phase 1b, then mark them as `synced`.

### Phase 3 — Pull remote tasks

For each remote task not already handled in Phase 2:
- **Not in local**: add to local and mark `synced`.
- **Both `synced`**: if remote `updatedAt` is newer, overwrite local.
- **Local `pending`**: already handled in Phase 1b; skip.

### Phase 4 — Mark all synced

Set `syncStatus = 'synced'` for all remaining non-temp local tasks.

## Conflict resolution strategies

Configured at `SyncService` construction time (default: **`local-wins`**):

| Strategy | Behaviour |
|---|---|
| `local-wins` | Always push local to remote |
| `remote-wins` | Always pull remote to local |
| `last-write-wins` | Compare `lastModified` (local) vs `updatedAt` (remote); apply the newer |

## `syncStatus` state machine

```
New task created locally:
  [no entry] → syncStatus='pending', url='temp:<id>'

First sync (local-wins):
  pending + temp: URL → create remote → URL updated → syncStatus='synced'

Local modification:
  synced → user edits → syncStatus='pending'

Remote modification (during sync, both sides synced):
  synced + remote timestamp newer → update local → syncStatus='synced'

Remote deletion, no local changes:
  synced + missing remotely → delete local record

Remote deletion, local changes pending:
  pending + missing remotely + local-wins → recreate remotely → syncStatus='synced'
  pending + missing remotely + remote-wins → delete local record

Task deleted locally:
  any → syncStatus='deleted' (tombstone)
  next sync: tombstone → attempt remote delete → on success, delete local record
```

## Multi-device scenarios

**Scenario 1: Modified on two devices**

Device A and B both modify the same task offline:
1. Both have `syncStatus='pending'`.
2. Device A syncs first → pushes its version to remote (timestamp T1).
3. Device B syncs → Phase 1b: task exists in both, B is pending → `mergeAndUpdate`.
   - `local-wins`: B's version overwrites remote.
   - `last-write-wins`: whichever `lastModified` is later wins.
4. Device A syncs again → Phase 3: remote is now newer → pulls B's version.

**Scenario 2: Deleted on another device, no local changes**

1. Device A deletes task and syncs → task gone from Pod.
2. Device B has `syncStatus='synced'` (no local changes).
3. Device B syncs → Phase 1b: task is synced + missing remotely → delete locally.

**Scenario 3: Deleted on another device, local changes pending**

1. Device A deletes task and syncs.
2. Device B modified the task offline (`syncStatus='pending'`).
3. Device B syncs → Phase 1b: task is pending + missing remotely.
   - `local-wins` (default): task is recreated on the remote.
   - `remote-wins`: task is deleted locally.

**Scenario 4: New task on another device**

1. Device A creates and syncs a task.
2. Device B syncs → Phase 3: new remote task → save locally and mark synced.

## Singleton

`getSyncService(localStore)` returns a module-level singleton. The remote service is injected via `setRemoteService(service)` when authentication changes.

## Auto-sync

`startAutoSync(intervalMs)` / `stopAutoSync()` manage a `setInterval` timer. `useLocalFirstTasks` calls these when the Solid service appears/disappears. The interval is 10 minutes (`AUTO_SYNC_INTERVAL` in `useLocalFirstTasks.ts`). The `isAutoSyncRunning()` check prevents duplicate timers when multiple view instances exist.
