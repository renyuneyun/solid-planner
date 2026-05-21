# SoLiD Planner — Agent / Developer Orientation

Start by reading **`Design.md`** (goals, constraints) and **`TODO.md`** (backlog). This file adds the minimum context needed to work effectively.

## Detailed docs

- [`docs/architecture.md`](docs/architecture.md) — data model, storage layers, composable stack, auth, task IDs
- [`docs/sync.md`](docs/sync.md) — 4-phase sync algorithm, conflict resolution, multi-device scenarios
- [`docs/priority.md`](docs/priority.md) — priority scoring formula, weekly filtering, Focus Now categorization
- [`docs/rdf-vocab.md`](docs/rdf-vocab.md) — RDF predicates, Solid Pod storage location
- [`docs/api.md`](docs/api.md) — quick reference for store, graph, composable, and common patterns

## Tech stack

Vue 3 + TypeScript, Pinia, PrimeVue 4, Tailwind CSS 4, Vite 5, Vitest, Soukai + soukai-solid (RDF ORM), IndexedDB via `idb`.

## Keeping docs in sync

When making source code changes that affect architecture, data model, storage behaviour, sync logic, priority algorithm, or RDF vocabulary, update the relevant file(s) in `docs/` in the same commit/change. `CLAUDE.md` itself only needs updating if the key rules or doc pointers change.

## Key rules

1. **Views use `useLocalFirstTasks()` only** — never call `IndexedDBTaskStorage` or `SolidTaskService` directly from a view. All persistence flows through this composable.
2. **Source of truth for task relationships** is `TaskClass.parentId` and `TaskClass.childIds`. `TaskGraph` is a derived cache; mutate relationships only through `TaskClass` setters or Pinia store actions (`moveTask`, `addSubTask`).
3. **Optimistic updates** — `addTask` / `updateTask` update the Pinia store before saving to IndexedDB.
4. Tests live under `tests/unit/` mirroring `src/` paths; mocks under `tests/mocks/`.
5. Composition API only. No comments unless the *why* is non-obvious.

## Commands

```sh
npm run dev            # dev server
npm run build          # production build (GitHub Pages, base=/solid-planner/)
VITE_BASE_PATH=/ npm run build   # root-path build (Vercel)
npm run test           # run all tests
npm run type-check     # TypeScript only
npm run lint           # ESLint with auto-fix
```
