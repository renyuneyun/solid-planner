# Development Workflow

How-to detail behind the directives in [`AGENTS.md`](../AGENTS.md): worktrees, git conventions,
building and deploying, testing, and browser checks.

## Worktrees

Keep feature work isolated from the primary checkout:

```sh
# from the repo root
git worktree add .worktrees/<name> -b <branch>
cd .worktrees/<name>
npm install
```

- Worktrees live under `.worktrees/`, which is excluded from git via `.git/info/exclude`. Don't
  commit them and don't add them to `.gitignore`.
- Name the directory after the branch for clarity.
- When done and merged, remove it: `git worktree remove .worktrees/<name>`; list them with
  `git worktree list`.
- If you drive an OpenCode session, move it into the worktree so edits land there.

## Git conventions

- `master` is the integration branch. Do topic-branch work (`feat/...`, `fix/...`, etc.) in a
  worktree, then merge to `master`. Pushing the `deploy` branch triggers the GitHub Pages
  workflow.
- Commit messages: `type: subject` in the repo's existing style — `feat`, `fix`, `docs`, `chore`,
  `refactor`, `style`, `test` (scoped forms like `fix(feat): ...` exist too). Imperative,
  concise subject.
- One logical change per commit. Squash WIP/fixup commits before merging; don't commit every
  planning or exploration step.

## Build and deploy

Scripts (from `package.json`):

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build (type-check + `build-only`) |
| `npm run build:debug` | Root-path build with source maps |
| `npm run build:ghpages` | GitHub Pages build (generates ClientID, base `/solid-planner/`) |
| `npm run build:vercel` | Vercel build (generates ClientID, root base `/`) |
| `npm run preview` | Serve a built `dist/` locally |
| `npm run build-only` | `vite build` without type-check |

- Base path: GitHub Pages uses `/solid-planner/`; root deployments (Vercel) set
  `VITE_BASE_PATH=/`.
- Verify a static build locally, then open the preview URL and confirm the app loads (with
  routing/asset paths correct for the chosen base):

  ```sh
  npm run build:debug && VITE_BASE_PATH=/ npm run preview
  ```

- Deployment: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) runs
  `build:ghpages` and publishes `dist/` to Pages on push to `deploy`. Vercel uses
  `build:vercel`.

## Tests and code quality

- [Vitest](https://vitest.dev/). Tests live under `tests/unit/`, mirroring `src/` paths; mocks
  under `tests/mocks/`; helpers under `tests/helpers/`.
- `npm run test` (once), `npm run test:watch`, `npm run test:coverage`, `npm run test:ui`.
  `vitest.config.ts` excludes `**/.worktrees/**`, so running from the primary checkout does not
  pick up the tests of the worktrees kept underneath it.
- `npm run type-check` (vue-tsc), `npm run lint` (ESLint, auto-fix), `npm run format` (Prettier).
- Composition API only; no comments unless the *why* is non-obvious.

## Browser checks

Use the **playwright** / **playwright-proxy** MCP servers when you need a browser. Point them at
the dev server (`npm run dev`, typically `http://localhost:5173/solid-planner/`) or a `preview`
build. Do not install or launch a browser, Playwright, or CDP yourself.

## Environment

- Node 20 (CI uses 20), npm.
- TypeScript type-checking via `vue-tsc` (see `tsconfig.*.json`).