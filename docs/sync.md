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
  - `syncStatus = 'pending'` → conflict; apply the configured strategy.

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

Configured at `SyncService` construction time (default: `local-wins`):

| Strategy | Behaviour |
|---|---|
| `local-wins` | Always push local to remote |
| `remote-wins` | Always pull remote to local |
| `last-write-wins` | Compare `lastModified` (local) vs `updatedAt` (remote); apply the newer |

## Singleton

`getSyncService(localStore)` returns a module-level singleton. The remote service is injected via `setRemoteService(service)` when authentication changes.

## Auto-sync

`startAutoSync(intervalMs)` / `stopAutoSync()` manage a `setInterval` timer. `useLocalFirstTasks` calls these when the Solid service appears/disappears. The `isAutoSyncRunning()` check prevents duplicate timers when multiple view instances exist.
