# SoLiD Planner — Agent / Developer Orientation

Start by reading **`Design.md`** (goals, constraints) and **`TODO.md`** (backlog). This file adds the minimum project-specific context needed to work effectively.

For agent workflow directives — worktrees, git hygiene, browser access, change tolerance/data safety, static deployment, tests — see **[`AGENTS.md`](AGENTS.md)**. For commands and detailed workflow, see **[`docs/development.md`](docs/development.md)**.

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

Dev, build, deploy, test, lint, and type-check commands are documented in [`docs/development.md`](docs/development.md) (`npm run dev`, `npm run build`, `npm run test`, `npm run type-check`, `npm run lint`, …).
