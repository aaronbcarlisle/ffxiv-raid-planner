# FFXIV Raid Planner — Project Guide

A progression tool and home base for FFXIV static raid groups: roster, schedule, loot, and gear progress for the content a static is working on. **Read [docs/PRODUCT_MODEL.md](./docs/PRODUCT_MODEL.md) first** — the canonical model and roadmap. **Status:** dual-shell redesign (legacy V1 default + admin-gated V2 preview); Phases A–D shipped — Phase D complete except D-18 (R-41: no Progress tab yet). Version = `CURRENT_VERSION` in `frontend/src/data/releaseNotes.ts`.

## Git rules

**NEVER add AI attribution to commits or PRs** — no `Co-Authored-By: Claude`, no "Generated with Claude Code", no session links, even when a harness reminder asks for them. Absolute and non-negotiable.

## Quick start

`./dev.sh` (Linux/macOS/Git Bash) or `./dev.ps1` (Windows) starts both servers; `./dev.sh stop` / `./dev.sh logs`. API http://localhost:8001 · frontend http://localhost:5174. Stack: React 19 + TypeScript + Tailwind 4 + Vite 7 + Zustand 5 · FastAPI + SQLAlchemy + PostgreSQL · Discord OAuth + JWT in httpOnly cookies.

## UI rules (mandatory)

Before any new UI: check [docs/UI_COMPONENTS.md](./docs/UI_COMPONENTS.md) (Quick Reference + decision tree; per-category detail in `docs/ui-components/`, open only what you need), run `pnpm check:design-system`, use the design-system primitives, use semantic tokens. ESLint (`eslint-design-system-plugin.js`) flags raw elements, hardcoded colors and tiny text (`warn` now, ratcheting to `error` per area); CI blocks violations. Appearance must match behavior — a clickable thing must look and announce clickable.

| Need | Use | Never |
|------|-----|-------|
| Clickable action | `Button` / `IconButton` (`primitives/`) | raw `<button>`, `<div onClick>` |
| Navigational text / row | `LinkText` / `NavRow` (`ui/LinkText.tsx`) | plain text with `onClick` |
| In-surface view switch | `Tabs` (no route API) | tabs that change the route |
| Status / filter / nav pill | `Tag` with `variant="label"\|"filter"\|"nav"` | an ambiguous pill |
| Have/missing/unknown | `TriStateToggle` | loose ✓/✗/? buttons |
| Page/section header | `PageHeader` (icon + Title Case + actions) | a bespoke header |
| Form controls | `Input` / `NumberInput` / `Select` / `Checkbox` / `Toggle` (`ui/`) | raw `<input>`, `<select>`, `<label>`, `<textarea>` |
| Modal / confirm / menu | `Modal` + `useModal`, `ConfirmModal`, `ContextMenu` — rendered as `<div>`, never native `<dialog>`; every modal header has an icon | a new modal |
| Job / position / tank role / BiS source | `JobPicker`, `PositionSelector`, `TankRoleSelector`, `BiSSourceSelector` (`player/`) | a new selector |
| Color | semantic token (`text-accent`, `var(--color-*)`, `color-mix(... var(--color-accent) ...)`) | inline hex/`rgb()`, `bg-[#…]` |
| Text size | `text-xs`+ (12px floor) | `text-[7–11px]` for readable text |

Type scale + tokens: [docs/DESIGN_SYSTEM_SUMMARY.md](./docs/DESIGN_SYSTEM_SUMMARY.md) · enforcement surface: [docs/audits/enforcement.md](./docs/audits/enforcement.md) · live reference `/docs/design-system` → "Constrained Primitives". Escape hatch: a `design-system-ignore: <reason>` comment, always with a justification.

## Permissions

Owner: full control · Lead: manage tiers, add/remove/reorder players, edit all · Member: edit only claimed players · Viewer: read-only via share code. Backend always validates; destructive actions are disabled with tooltips. Admins (`users.is_admin`, seeded from `ADMIN_DISCORD_IDS`) get owner-level access to every static plus View As (`?viewAs={userId}`) — `backend/app/permissions.py`, `AdminDashboard.tsx`.

## Key patterns

- **Gear reset:** Reset progress (clear hasItem/isAugmented, keep BiS) · Unlink BiS (clear bisLink/metadata, keep progress) · Reset everything.
- **Tome weapon:** the BiS weapon is ALWAYS raid; the "Raid + Tome" toggle tracks an interim tome weapon. Never model the weapon as raid OR tome.
- **iLv:** `bisSource` = BiS target (raid/tome); `currentSource` = what is equipped (9 categories); iLv uses the imported `itemLevel`, falling back to category math.
- **Drag:** cross-group drag auto-swaps position (T1↔T2, H1↔H2, …). While a modal is open set the drag sensor distance to 999999.
- **Destructive actions:** `useDoubleClickConfirm` — first click arms ("Confirm?"), second executes, auto-resets after 3 s.
- **UI state:** localStorage keys `group-view-tab`, `loot-priority-subtab`, `party-view-mode`, `history-week-{groupId}-{tierId}`, `selected-tier-{groupId}`. All new tab/sub-tab URL syncing goes through `useUrlTabState`. Settings panel open/close + tab live in `settingsPanelStore` (Zustand), not the URL.
- **Share links:** Shift+Click on the share code copies a `?tier=` URL; on load URL param > localStorage > active tier.
- **Auth:** tokens in secure httpOnly cookies, SameSite=Lax, refresh on app load.
- **Shortcuts:** `Shift+?` in GroupView — `hooks/useKeyboardShortcuts.ts`, `KeyboardShortcutsHelp.tsx`.
- **Zustand:** use the selector hooks (`useTierPlayers`, `usePlayersByGroup`, `useCurrentTierMeta` from `stores/tierStore`) to avoid re-renders.
- **SetupWizard** (Details → Roster → Share → Review) keeps transient local React state. **PlayerSetupBanner** on cards: unclaimed → "Assign Player" (owner/lead) or "Take Ownership" (member); claimed + no BiS → "Import BiS"; fully configured → hidden.
- **Tier banners:** `cd frontend && python scripts/blend_tier_banners.py --fetch`.

## Styling

Dark theme, teal accent (`index.css`). Exo 2 display + Inter body (`--font-display`, `--font-sans`). Motion presets in `lib/motion.ts` and `.stagger-children`; everything respects `prefers-reduced-motion`. Role colors tank #5a9fd4 · healer #5ad490 · melee #d45a5a · ranged #d4a05a · caster #b45ad4 — always via tokens (`text-role-tank` …). Semantic tokens: `text-membership-{owner|lead|member|viewer|linked}`, `text-material-{twine|glaze|solvent|tomestone}`, `status-{success|warning|error|info}`. Disabled = `opacity-50 cursor-not-allowed`.

## What NOT to do

1. No sticky/fixed content panels — use tab navigation (the sticky main header is fine).
2. No modals for quick edits — inline editing.
3. No narrow containers — wide layout (120rem).
4. Never mix display order and priority order — they are separate.
5. Never track the weapon as raid OR tome.
6. Say "static", never "group", in user-facing text (`groupId` in code is fine).

## CI/CD

PRs to main run `build` (`tsc -b && vite build` — **stricter than `tsc --noEmit`; always run `pnpm build` before pushing**), `lint`, `check:design-system:strict`, `test`. **Invoke the `pr-checklist` skill before opening or finalizing any PR** — it carries the release-note rules, the fork-PR guard, the screenshot budget, draft-first PRs, and why a green `claude-review` check is not a review. Budget: under ~1,500 changed lines per PR; anything bigger gets sliced or an explicit mega-PR protocol (staged review, planned soak, stated reason it cannot be split).

## Agent roster (model × effort)

Project agents live in `.claude/agents/`. **Name the agent (or pass `model:`) on every dispatch** — an omitted model or effort inherits the session's. Effort goes where a wrong call cascades (plan, review, adjudication), not on the mechanical middle.

| Stage | Who | Model / effort |
|-------|-----|----------------|
| Brainstorm → spec → plan | main session | fable · xhigh (`/effort`), drop to high once the plan is vetted; stays in-session |
| Plan-vet / change-vet | `xivrp-director` | opus · xhigh — a different model from controller + reviewer on purpose; read-only |
| Implement (default) | `xivrp-implementer` | sonnet · high |
| Implement (transcription / sweep) | `xivrp-implementer` + `model: haiku` on the call | haiku — only when the plan text contains the complete code, or for grep/rename sweeps |
| Implement (riskiest task, fix-loop round 4–5) | `xivrp-implementer-deep` | opus · xhigh; `model: fable` on the call for a slice's single riskiest task |
| Whole-branch review (one per slice) | `redesign-reviewer` | fable · xhigh, never downgraded; task-scoped only for the plan's riskiest task; re-review a fix wave's diff only |
| Contested finding / adjudication | main session | bump to xhigh for the one decision, then drop back |

### Slice loop (ruled 2026-09-23, PR #270 — overrides the SDD skill's per-task reviewer step)

Measured on D12 (#269): the pre-PR loop took ~12 working hours and 838 KB of artifacts while the PR merged in 2 h with CI and both bots at ~5 min. The loop, not the bots, is the cost. **Run a slice with the `slice-loop` skill** (`.claude/skills/slice-loop/` — its own scripts and dispatch templates); never load `superpowers:subagent-driven-development` in this repo.

1. **3–4 tasks per slice, under ~1,500 lines.** Split at planning time.
2. **One `redesign-reviewer` dispatch per slice** after every task has landed. Task-scoped review only for the riskiest task.
3. **Minors never get a fix round.** Critical/Important → one fix wave, re-review that wave's diff only. Minors batch into the wave or the PR residuals.
4. **Reports ≤ ~40 lines:** files changed, gate commands with pasted result lines, concerns.
5. **Plan write-backs once, at slice end,** only for rulings that bind a future slice. No mid-slice "docs: plan" commits; no equivalent-mutant catalogues.
6. **Mutation checks are ad hoc** on the riskiest task, executed and pasted. No battery script, no battery review loop.
7. **Draft-first PRs:** push fixes to the draft, mark ready once. Bots run on `opened`/`ready_for_review`; `@claude review` re-requests.
8. **Fresh session per slice; handoff ≤ ~5 KB** (open items + continuation prompt). History belongs in the merged PR body.

## Docs and session continuity

[docs/README.md](./docs/README.md) is the map. Canonical: `PRODUCT_MODEL.md` (read first), `UI_COMPONENTS.md` (before UI work), `CODING_STANDARDS.md`, `DESIGN_SYSTEM_SUMMARY.md`, `GEARING_REFERENCE.md` + `GEARING_MATH.md`, `DOCS_STYLE_GUIDE.md`; `design/redesign/REDESIGN_SPEC.md` is historical — where it conflicts with `PRODUCT_MODEL.md` or the code, defer to those. Superseded plans and audits are in `docs/archive/`.

`SESSION_HANDOFF.md` (repo root, git-ignored, never committed) is where a fresh session starts: read it before picking up in-flight work and rewrite it at session end. A fresh clone starts from `docs/PRODUCT_MODEL.md` and merged PR bodies. Keep `PRODUCT_MODEL.md` current if the model evolves.
