# Contributing to FFXIV Raid Planner

Thanks for your interest in contributing! This guide covers how to get a change from
idea to merged PR.

## Before You Start

- **Bug reports and feature ideas** — open an issue using the templates. For anything
  non-trivial, discussing the approach in an issue before building saves everyone time.
- **Security issues** — never open a public issue. See [SECURITY.md](SECURITY.md).
- The project is midway through a top-down UX redesign.
  [docs/PRODUCT_MODEL.md](docs/PRODUCT_MODEL.md) is the source of truth for what the app
  is and where it's going — worth a skim before proposing UI or flow changes.
- [CLAUDE.md](CLAUDE.md) is the full development guide (architecture, API endpoints,
  data models, patterns). This file is the short version.

## Development Setup

Prerequisites: **Node.js 20.19+** with [pnpm](https://pnpm.io), **Python 3.11+**.

Do the one-time setup first — create the backend venv, install backend and frontend
dependencies, and configure `backend/.env` — following the step-by-step instructions
in the [README](README.md#getting-started). The backend runs fine on SQLite locally —
no PostgreSQL needed for development.

After that, the helper script starts both servers in one command:

```bash
./dev.sh      # Linux / macOS / Git Bash
./dev.ps1     # Windows PowerShell
```

(The script only starts servers — it exits with an error if `backend/venv` doesn't
exist, and it never installs dependencies.)

## Quality Gates

PRs to `main` must pass five required CI checks. Run the same things locally before
pushing:

| Check | Command |
|-------|---------|
| Build + types | `pnpm build` (from `frontend/`) |
| Lint | `pnpm lint` (from `frontend/`) |
| Design system | `pnpm check:design-system:strict` (from `frontend/`) |
| Frontend tests | `pnpm test` (from `frontend/`) |
| Backend tests | `pytest tests/ -q` (from `backend/`, venv active) |

> ⚠️ `pnpm build` runs `tsc -b`, which is **stricter** than `tsc --noEmit`. Don't
> substitute one for the other — a clean `tsc --noEmit` can still fail CI.

## Project Conventions

These are enforced by lint rules and CI, not just convention:

- **Design system is mandatory.** Never use raw `<button>`, `<input>`, `<select>`,
  `<label>`, or `<textarea>` — use the primitives in `frontend/src/components/primitives/`
  and `components/ui/` (`Button`, `IconButton`, `Input`, `Select`, `Modal`, …). See
  [docs/UI_COMPONENTS.md](docs/UI_COMPONENTS.md) for the inventory.
- **Semantic color tokens only.** No hardcoded hex/`rgb()` values or `bg-[#…]` classes.
  Use tokens like `text-accent`, `text-role-tank`. Readable text stays at `text-xs`
  (12px) or larger.
- **Say "static", not "group"** in all user-facing text. (Code identifiers like
  `groupId` are fine.)
- **Release notes are CI-enforced.** Any PR touching `frontend/src/` or `backend/app/`
  must add an entry to `frontend/src/data/releaseNotes.ts` — use `internal: true` for
  changes users won't notice (refactors, tests, plumbing) and don't bump
  `CURRENT_VERSION` for those.
- **Screenshots for UI changes.** Any PR that changes something visible must embed
  before/after screenshots in the PR description (light and dark theme if colors or
  tokens changed).

## Pull Requests

- Fill out the PR template — its checklist mirrors the CI gates.
- Keep PRs focused; unrelated changes belong in separate PRs.
- Keep commit messages and PR bodies clean: no tool advertisements or AI attribution
  lines.

### Notes for fork PRs

CI installs with pnpm 9 and Node 20; the committed lockfiles are authoritative. A few
non-required workflows (automated review, Vercel preview deploys) skip or fail on PRs
from forks — that's expected and does **not** block your PR. Only the five required
checks matter.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be excellent to
each other — it's a tool for helping raid statics get along, after all.
