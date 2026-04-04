# SoLiD Planner

[![Vercel](https://img.shields.io/badge/Deployment-Vercel-black?logo=vercel)](https://solid-planner.vercel.app/)
[![GitHub Pages](https://img.shields.io/badge/Deployment-GitHub%20Pages-black?logo=github)](https://renyuneyun.github.io/solid-planner/)
[![GitHub](https://img.shields.io/badge/GitHub-repo-blue?logo=github)](https://github.com/renyuneyun/solid-planner)

SoLiD Planner is a weekly planning app that stores your data in your own [Solid Pod](https://solidproject.org/).

Rather than listing every task at once, it focuses on what matters this week — automatically estimating priorities so you don't have to manually assign them. Tasks can have subtasks and dependencies, and leftovers from previous weeks are carried forward gracefully.

Data is stored as RDF and synced to your Solid Pod, with a local IndexedDB cache for fast, offline-capable access.

## Features

- **Weekly planning view** — see only the tasks relevant to this week, sorted by estimated priority
- **Automatic priority calculation** — no need to manually rank tasks; the app estimates urgency from deadlines and context
- **Subtasks and dependencies** — model complex work with proper hierarchy and ordering
- **Local-first with Solid sync** — changes are saved instantly to IndexedDB, then synced to your Solid Pod in the background
- **Tombstone-based deletion** — canceled tasks are soft-deleted for traceability

## Tech Stack

- **Framework:** Vue 3, Vue Router, Pinia — TypeScript throughout
- **UI:** PrimeVue 4, Tailwind CSS 4
- **Data / Solid:** Soukai + soukai-solid (RDF ORM), @inrupt/solid-client
- **Build:** Vite 5
- **Tests:** Vitest

## Getting Started

```sh
npm install
npm run dev       # start dev server with HMR
```

### Building

The default base path is `/solid-planner/` (set in `vite.config.ts` for GitHub Pages). Override it with `VITE_BASE_PATH` when deploying to a root path (e.g. Vercel):

```sh
npm run build                              # production build (GitHub Pages, base = /solid-planner/)
VITE_BASE_PATH=/ npm run build            # production build at root path (Vercel)

# Debug build with source maps, then preview locally at root:
npm run build:debug && VITE_BASE_PATH=/ npm run preview
```

### Testing

```sh
npm run test           # run all tests once
npm run test:watch     # watch mode
npm run test:coverage  # with coverage report
npm run test:ui        # Vitest UI dashboard
```

### Code Quality

```sh
npm run lint           # ESLint with auto-fix
npm run format         # Prettier
npm run type-check     # TypeScript check only (no emit)
```

## Project Docs

- [`Design.md`](Design.md) — architecture, goals, and future plans
- [`TODO.md`](TODO.md) — current backlog and roadmap
