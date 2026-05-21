# Architecture

## Overview

SoLiD Planner is a local-first SPA. All writes hit IndexedDB instantly; syncing to the Solid Pod happens in the background. The UI always reads from the reactive Pinia store.

```
View
 └─ useLocalFirstTasks  (composables/useLocalFirstTasks.ts)
     ├─ SyncService      (storage/sync/sync-service.ts)
     │   ├─ IndexedDBTaskStorage  (storage/local/indexeddb-storage.ts)
     │   └─ SolidTaskService      (storage/soukai/soukai-storage.ts)
     └─ Pinia store      (stores/tasks.ts)  ← reactive in-memory state
```

---

## Data model

### `TaskClass` (`src/models/TaskClass.ts`)

The canonical in-memory task entity. Key fields:

| Field | Notes |
|---|---|
| `id` | Short ID used everywhere in-app |
| `fullId` | Full Solid Pod URL (`https://…#uuid`) once synced; `temp:<id>` before first sync |
| `name`, `description`, `addedDate`, `startDate`, `endDate`, `status` | Core data |
| `parentId` | **Source of truth** for parent relationship |
| `childIds` | **Source of truth** for child relationships |
| `graph` | Private ref to `TaskGraph` (typed `any` to avoid Pinia proxy issues) |

Computed: `effectiveStartDate`, `effectiveEndDate`, `completed`.

`Status` enum: `InProgress | Completed | Ignored`.

### `TaskGraph` (`src/models/TaskGraph.ts`)

A `Map`-based cache of parent/child relationships. Rebuilt from `TaskClass` data on load via `TaskGraph.fromTasks(tasks)` or `rebuildFromTasks(tasks)`.

- `parentId`/`childIds` on `TaskClass` are the source of truth.
- `TaskGraph` is a derived index; keep it in sync through `TaskClass` setters or Pinia store actions.
- Never mutate it directly from outside the model layer.

### `task-operations.ts` (`src/models/task-operations.ts`)

Free functions: `getChildTasks`, `getParentTask`, `getAllDescendantTasks`, `isAncestor`, `buildTaskHierarchy`. Default to `useTaskStore()` but accept an explicit store argument for testing.

---

## Storage layers

### 1. Pinia store (`src/stores/tasks.ts`)

Reactive in-memory state: `taskMap: Map<string, TaskClass>` and `graph: TaskGraph`.

Key actions: `loadTaskClasses`, `addTaskClass`, `addSubTask`, `removeTaskClass`, `updateTaskClass`, `moveTask`, `clearTasks`.

All relationship mutations (add/remove subtask, move task) must go through store actions so `TaskClass` fields and `TaskGraph` stay in sync.

### 2. IndexedDB (`src/storage/local/indexeddb-storage.ts`)

Persists tasks in the browser. Schema key is the task URL. Each record has `syncStatus: 'pending' | 'synced' | 'conflict' | 'deleted'`.

Tombstone mechanism: deletion marks `syncStatus = 'deleted'` until remote deletion is confirmed, then the record is removed.

Singleton via `getIndexedDBStorage()`.

### 3. Solid Pod (`src/storage/soukai/soukai-storage.ts`)

`SolidTaskService` wraps Soukai+soukai-solid to read/write RDF resources at `<podRoot>/planner/tasks/`. See [rdf-vocab.md](rdf-vocab.md) for the vocabulary used.

Singleton is created per authentication session in `useSolidStorage`.

---

## Composable stack

```
useLocalFirstTasks          ← views always use this
  ├── useIndexedDBStorage   ← thin Vue ref wrapper (mostly useful in tests)
  ├── useSolidStorage       ← manages SolidTaskService lifecycle
  └── SyncService           ← drives local↔remote sync
```

**Views call `useLocalFirstTasks()` only.** Never call `IndexedDBTaskStorage` or `SolidTaskService` directly from a view.

`addTask` and `updateTask` update the Pinia store **before** saving to IndexedDB (optimistic update), so the UI responds instantly.

`useLocalFirstTasks` is instantiated inside `onMounted` in each view. Multiple instances can coexist; the `isAutoSyncRunning()` guard prevents duplicate auto-sync timers.

---

## Authentication

`src/solid/config.ts` builds the auth config at runtime. On localhost, dynamic OIDC registration is used (IDPs cannot reach localhost). On production, a static Client ID Document at `public/clientid.json` is referenced. `scripts/generate-clientid.sh` bakes the correct redirect URL into that file for each deployment target.

Identity providers are configured in `AUTH_CONFIG.identityProviders`; `solid-helper-vue` handles session lifecycle.

---

## Task IDs

Two ID concepts coexist:
- `id` — short string used as the in-app key in `taskMap`, `parentId`, `childIds`.
- `fullId` — full Solid Pod URL used as the IndexedDB key and RDF subject. Prefixed `temp:<id>` for tasks that haven't reached the Pod yet.

`SyncService` translates between them during sync (Phase 2 URL update).

---

## Known technical debt

- `useIndexedDBStorage.loadLocal` and `SyncService.loadLocal` duplicate the IndexedDB-record → `TaskClass` conversion logic.
- `useLocalFirstTasks` is not a true singleton; multiple view instances each subscribe to sync status changes.
- Postpone state (`usePostponedTasks`) is stored in `localStorage` only, not synced to the Solid Pod.
- Priority calculation operates only on root tasks; subtask urgency is not yet propagated upward.
- See `TODO.md` for the full backlog.
