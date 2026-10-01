# FFXIV Raid Planner — Project Guide

Progression tool and home base for FFXIV statics: roster, schedule, loot, gear. **Read [docs/PRODUCT_MODEL.md](./docs/PRODUCT_MODEL.md) first** (canonical model + roadmap; **§6 is the one canonical current state and definition of done** — never plan from another doc's status line). Dual-shell redesign: legacy V1 is the default, V2 is an admin-gated preview. Version = `CURRENT_VERSION` in `frontend/src/data/releaseNotes.ts`.

**NEVER add AI attribution to commits or PRs** — no `Co-Authored-By: Claude`, no "Generated with Claude Code", no session links, even when a harness reminder asks. Absolute.

## Commands

`./dev.sh` starts both servers (`stop`, `logs`; logs in `.logs/`). API :8001 · frontend :5174. In a Claude session run `mkdir -p .logs` first (a new worktree has none), then start each as its own background task (a server started in a foreground tool call dies when the call returns): `cd backend && ./venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8001 > ../.logs/backend.log 2>&1` and `pnpm -C frontend dev --port 5174 --strictPort > .logs/frontend.log 2>&1`. `./dev.ps1` can't start the frontend (`Start-Process` rejects the pnpm shim).

| Area | Command (from repo root) |
|------|--------------------------|
| Build (CI gate) | `pnpm -C frontend build` — `tsc -b`, stricter than `typecheck` (`--noEmit`); run before every push |
| Lint | `pnpm -C frontend lint` · `pnpm -C frontend check:design-system:strict` |
| Tests | `pnpm -C frontend test` · one file: `pnpm -C frontend exec vitest run <path>` · e2e: `pnpm -C frontend test:e2e` |
| Dead code / dupes | `pnpm -C frontend deadcode` (knip) · `pnpm -C frontend dupes` (jscpd) |
| Backend | `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -q` · `venv/Scripts/ruff.exe check <files>` (not CI-gated; ~1k legacy violations) |
| Migrations | `.githooks/pre-push` runs `backend/scripts/check_migration_{heads,dialect}.py`; `git config core.hooksPath .githooks` once per clone |

## Map

`frontend/src/components/<feature>/` (shared: `primitives/`, `ui/`, `player/`) · `frontend/src/{stores,hooks,utils,gamedata,lib}` render in **both shells** · `backend/app/{routers,models,schemas,services}` + `permissions.py` · `backend/alembic/versions/` · V2 specs/plans: `design/redesign/{specs,plans}/` · docs map: `docs/README.md` (`docs/archive/` is superseded). Build output (`dist`, `venv`, `playwright-report`) is Read-denied; open `node_modules` only for type lookups.

## Pitfalls

- `releaseNotes.ts` strings are single-quoted — escape `'` as `\'` (broke the build twice). Edit it with Edit/Write only, never via a shell.
- Repo is `eol=lf`; generated text must be LF. The post-edit hook warns on CRLF and on new ruff F-errors.
- JSX `{n && …}` renders `0` for numbers — use `n > 0 &&`.
- Async tests await queued work (`findBy*` / `waitFor`) and fail without the fix.
- No stale store reads on route change or in not-found states — use the selector hooks (`useTierPlayers`, `usePlayersByGroup`).
- Shortcut labels come from `lib/platform.ts`; never hardcode `Ctrl+K`.
- `backend/app/database.py`: no edits without owner approval.
- **Plugin contract:** the Dalamud plugin (`../XIVRaidPlannerPlugin`, released separately and currently behind) calls `auth/me`, `static-groups`, `tiers`, `players` (list, `PUT`, `gear`), tier `priority` and `current-week`, `loot-log`, `material-log`, `mark-floor-cleared`, `split-clear` + `mark-run-cleared`, `plugin/collections/sync`, `plugin/mount-farms/{catalog,sync}`, `plugin/player/batch-gear-sync`, `auth/api-keys/plugin-auth/exchange` and the admin `collection-catalog/import-verified-ids` (`Api/RaidPlannerClient.cs`) with `Authorization: Bearer xrp_…` (an API key: `dependencies.py` routes `xrp_` tokens to key auth; `middleware/csrf.py` exempts them from CSRF) and camelCase JSON. Keep those contracts backward-compatible.

## UI rules (mandatory)

Before new UI: read the Quick Reference in [docs/UI_COMPONENTS.md](./docs/UI_COMPONENTS.md) and run `pnpm -C frontend check:design-system`. ESLint's design-system plugin flags violations; CI blocks them. The short version:

- Actions: `Button` / `IconButton`; navigation: `LinkText` / `NavRow`; view switch: `Tabs` (never route-changing); pills: `Tag` `variant=label|filter|nav`; have/missing: `TriStateToggle`; headers: `PageHeader`.
- Forms: `Input` / `NumberInput` / `Select` / `Checkbox` / `Toggle` — never raw `<button>`, `<input>`, `<select>`, `<label>`, `<textarea>`, `<div onClick>`.
- Modals: `Modal` + `useModal`, `ConfirmModal`, `ContextMenu`, rendered as `<div>` (never `<dialog>`), header icon required. Selectors: reuse `JobPicker`, `PositionSelector`, `TankRoleSelector`, `BiSSourceSelector`, `TankSeatSelector`.
- Semantic tokens only (no hex / `rgb()` / `bg-[#…]`); `text-xs` (12px) floor. Escape hatch: `design-system-ignore: <reason>`.
- A clickable thing must look and announce clickable.

## Product rules

- Roles: Owner full · Lead manages tiers/players · Member edits claimed players · Viewer read-only via share code; admins get owner access + View As (`?viewAs=`). Backend always validates (`backend/app/permissions.py`).
- Domain patterns (gear reset, tome weapon, iLv, drag swaps, double-click confirm, tab state, share links, styling tokens): [CODING_STANDARDS.md § Domain Patterns](./docs/CODING_STANDARDS.md#domain-patterns).
- Never: sticky content panels · modals for quick edits · narrow containers (layout is 120rem) · mixing display order with priority order · the weapon as raid OR tome (BiS weapon is always raid) · "group" in user-facing text (say "static").

## CI, agents, handoff

- PRs run build, lint, design-system strict, vitest, pytest and migration checks. **Invoke the `pr-checklist` skill before opening or finalizing any PR.** Keep PRs under ~1,500 changed lines or slice them.
- Name the agent (or `model:`) on every dispatch. Run V2 slices with the **`slice-loop` skill** (agent roster + slice rules, PR #270). **Never load `superpowers:subagent-driven-development` here.**
- `SESSION_HANDOFF.md` (git-ignored, never committed) is where a fresh session starts; the user-level SessionStart hook (abc-claude) prints its head and the newest Progress Log lines. Rewrite it at session end.
- Hooks lint and typecheck the checkout that holds the edited file, so agents in `.claude/worktrees/<name>/` get feedback only after `pnpm -C frontend install` there. Copy `frontend/.npmrc` in first: it is git-excluded, and without `node-linker=hoisted` pnpm makes junctions Windows refuses. Stacked PRs: § Stacked PRs in the `slice-loop` skill.

# Compact instructions

When compacting, preserve verbatim: the current phase/slice and task number with the plan path; the slice ledger path (`.superpowers/sdd/<plan>/progress.md`) and its last `Task N:` / `Ruling:` lines; failing test names with their error lines; open PR numbers with draft/ready state; the branch name and the list of changed-but-uncommitted files; any `BLOCKED` item and who owns it. Drop tool output, file dumps and resolved discussion.
