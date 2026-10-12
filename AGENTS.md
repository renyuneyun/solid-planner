# AGENTS.md — Instructions for AI Coding Agents

Canonical, tool-agnostic instructions for any AI coding agent working on **SoLiD Planner**.
Read this before making changes. It is a small project in real (if early) production use, so
follow it and ask when unsure.

Start with the project context:

- [`Design.md`](Design.md) — core goals and constraints. Follow it; if you believe a design
  choice is wrong, say so **before** deviating.
- [`TODO.md`](TODO.md) — backlog/roadmap. It may be stale; on conflict prefer the code and
  `Design.md`.
- [`CLAUDE.md`](CLAUDE.md) — project-specific orientation: stack, key rules, doc index.
- [`docs/`](docs/) — detailed architecture, sync, priority, RDF vocabulary, API reference.

For the how-to behind these directives (commands, conventions), see
[`docs/development.md`](docs/development.md).

## Directives

### Work in an isolated worktree

Do feature work in a separate git worktree kept under this repo at `.worktrees/<name>`
(already excluded via `.git/info/exclude`). Leave the primary checkout on `master` for reading
and quick checks. Commands are in [`docs/development.md`](docs/development.md).

Exception: changes that apply repo-wide rather than to a specific feature — e.g. these agent /
developer docs — are fine to make directly on the `master` checkout.

### Keep git history sensible and clear

Commit one logical change at a time, with `type: subject` messages in the existing style
(`feat` / `fix` / `docs` / `chore` / `refactor` / `style` / `test`). Don't over-commit —
while planning or exploring, don't commit every step; squash WIP before merging. Never commit
build output (`dist/` is ignored).

### Use the Playwright MCP servers for browsers

When you need a browser — manual checks, screenshots, driving the app — use the provided
**playwright** or **playwright-proxy** MCP servers. Do not start Playwright, a browser, or CDP
yourself.

### Early stage, but real use — change boldly, protect data

The project is early, but it is already used in production by the maintainer and a few friends.
You may make drastic changes (code structure, libraries, UI) when they are necessary, clearly
helpful, or the user asks for them. Prefer keeping or safely **migrating existing data**, and
**ask for approval** before any change that risks data loss or a messy migration.

### Stay deployable as static pages

The app ships as static pages (GitHub Pages and Vercel). Keep it that way, and verify the static
build when a change could affect it — see [`docs/development.md`](docs/development.md).

### Add tests where sensible

Eventually most aspects should have appropriate tests. Add or update Vitest tests under `tests/`
(mirroring `src/`) whenever it is sensible for the change.

### Keep docs in sync

When a change affects architecture, data model, storage, sync, priority, or RDF vocabulary,
update the relevant file(s) in `docs/` in the same change.

## Maintaining these notes

These notes are living documents. **Update them as part of the conversation with the user** —
when something is learned or agreed (a new convention, preference, gotcha, or correction) —
without waiting for an explicit instruction to do so. Keep this file concise; put longer detail
in [`docs/development.md`](docs/development.md) or another `docs/` file.