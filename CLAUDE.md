# FFXIV Raid Planner - Project Guide

**Status:** Undergoing a top-down UX/IA redesign — **read [docs/PRODUCT_MODEL.md](./docs/PRODUCT_MODEL.md) first.** It is the canonical source of truth: what the app is, how everything nests (layers · weekly loop · Progress Engine · rings), what fits inside it, and the roadmap.

A progression tool and home base for FFXIV static raid groups: roster, schedule, loot, and gear progress for the content a static is working on.

## Contents

[Quick Start](#quick-start) | [UI Rules](#ui-implementation-rules-mandatory) | [Patterns](#key-patterns) | [Permissions](#permission-system) | [Styling](#styling) | [What NOT To Do](#what-not-to-do) | [CI/CD](#cicd)

---

## IMPORTANT: Git Commit & PR Rules

**NEVER add AI attribution to commits or PRs.** No "Co-Authored-By: Claude", no "Generated with Claude Code", no AI tool attribution of any kind. This is **absolute and non-negotiable**.

---

## Quick Start

```bash
./dev.sh              # Start both servers (Linux/macOS/Git Bash)
./dev.ps1             # Start both servers (Windows PowerShell)
./dev.sh stop         # Stop servers
./dev.sh logs         # Tail logs
```

**API:** http://localhost:8001 | **Frontend:** http://localhost:5174

---

## UI Implementation Rules (MANDATORY)

**BEFORE implementing ANY new UI:**

1. **Check existing components** - See [docs/UI_COMPONENTS.md](./docs/UI_COMPONENTS.md)
2. **Run design system check** - `pnpm check:design-system`
3. **Use design system primitives** - Never raw `<button>`, `<input>`, `<select>`, `<label>`, `<textarea>`
4. **Use semantic color tokens** - Never hardcode colors

**Automated enforcement:**
- ESLint will warn on raw HTML elements (see `eslint-design-system-plugin.js`)
- CI blocks PRs with design system violations
- Run `pnpm lint` to see violations in your code

### Component Reference

| Need | Component | Path |
|------|-----------|------|
| Button | `Button` | `primitives/Button.tsx` |
| Icon button | `IconButton` | `primitives/IconButton.tsx` |
| Job selection | `JobPicker` | `player/JobPicker.tsx` |
| Position (T1-R2) | `PositionSelector` | `player/PositionSelector.tsx` |
| Tank role (MT/OT) | `TankRoleSelector` | `player/TankRoleSelector.tsx` |
| BiS source (R/T/BT/C) | `BiSSourceSelector` | `player/BiSSourceSelector.tsx` |
| Text input | `Input` | `ui/Input.tsx` |
| Dropdown | `Select` | `ui/Select.tsx` |
| Checkbox | `Checkbox` | `ui/Checkbox.tsx` |
| Gear status | `GearStatusCircle` | `ui/GearStatusCircle.tsx` |
| Modal | `Modal` + `useModal` | `ui/Modal.tsx` |
| Confirm dialog | `ConfirmModal` | `ui/ConfirmModal.tsx` |
| Context menu | `ContextMenu` | `ui/ContextMenu.tsx` |
| Error display | `ErrorMessage` | `ui/ErrorMessage.tsx` |
| Loading state | `Skeleton` | `ui/Skeleton.tsx` |
| Job icon | `JobIcon` | `ui/JobIcon.tsx` |
| Toggle switch | `Toggle` | `ui/Toggle.tsx` |
| Static creation wizard | `SetupWizard` | `wizard/SetupWizard.tsx` |
| Player setup prompts | `PlayerSetupBanner` | `player/PlayerSetupBanner.tsx` |
| User assignment | `AssignUserModal` | `player/AssignUserModal.tsx` |

### Common Mistakes

| Wrong | Right |
|-------|-------|
| Raw `<button>` | `Button` or `IconButton` |
| Raw `<input>` | `Input`, `Checkbox`, or `NumberInput` |
| Raw `<select>` | `Select` |
| Hardcoded `#14b8a6` | `text-accent` or `bg-accent` |
| Hardcoded `#5a9fd4` | `text-role-tank` |
| New job selector | Use existing `JobPicker` |
| New modal | Use `Modal` with `useModal` |

### Design Language (enforced)

**The design system is the source of truth.** Raw HTML, hardcoded colors, and tiny text are lint-flagged (`warn` now, ratcheting to `error` per area). Appearance must match behavior — a clickable thing must *look and announce* clickable.

| Need | Use | Never |
|------|-----|-------|
| Clickable action | `Button` / `IconButton` | raw `<button>`, `<div onClick>` |
| Navigational text / row | `LinkText` / `NavRow` | plain text with `onClick` |
| In-surface view switch | `Tabs` (no route API) | tabs that change the route |
| Status / filter / nav pill | `Tag` with `variant="label"\|"filter"\|"nav"` | an ambiguous pill |
| Have/missing/unknown | `TriStateToggle` | loose ✓/✗/? buttons |
| Page/section header | `PageHeader` (icon + Title Case + actions) | a bespoke header |
| Color | semantic token (`text-accent`, `var(--color-*)`, `color-mix(... var(--color-accent) ...)`) | inline hex/`rgb()`, `bg-[#…]` |
| Text size | `text-xs`+ (12px floor) | `text-[7–11px]` for readable text |

Type scale + tokens: [docs/DESIGN_SYSTEM_SUMMARY.md](./docs/DESIGN_SYSTEM_SUMMARY.md). Enforcement surface: [docs/audits/enforcement.md](./docs/audits/enforcement.md). Live reference: `/docs/design-system` → "Constrained Primitives". The `design-system-ignore: <reason>` comment is the escape hatch — always with a justification.

---

## Roadmap & Status

The roadmap is anchored in **[docs/PRODUCT_MODEL.md](./docs/PRODUCT_MODEL.md)** (§6 current state, §7 core-anchored roadmap). The changelog lives in `frontend/src/data/releaseNotes.ts`. Superseded planning, audit, and session docs are in `docs/archive/`.

---

## Permission System

| Role | Access |
|------|--------|
| **Owner** | Full control - settings, delete, edit all, roster |
| **Lead** | Manage tiers, add/remove/reorder players, edit all |
| **Member** | Edit only claimed players |
| **Viewer** | Read-only via share code |

Backend always validates. Destructive actions disabled with tooltips.

---

## Key Patterns

### Gear Reset Options
1. **Reset progress** - Clear hasItem/isAugmented, keep BiS
2. **Unlink BiS** - Clear bisLink/metadata, keep progress
3. **Reset everything** - Complete wipe

### Tome Weapon
BiS weapon is ALWAYS raid. Toggle "Raid + Tome" to track interim tome weapon.

### Cross-Group Drag
Dragging between G1/G2 auto-swaps position (T1↔T2, H1↔H2, etc.)

### Modal + DnD
When modals open, set drag sensor distance to 999999 to disable dragging.

### Double-Click Confirm
For destructive actions: first click arms ("Confirm?"), second executes. Auto-resets after 3s.
Use `useDoubleClickConfirm` hook from `hooks/useDoubleClickConfirm.ts`.

### iLv Calculation
- `bisSource` = BiS target (raid/tome)
- `currentSource` = what's equipped (9 categories)
- iLv uses `itemLevel` from BiS import when available, falls back to category-based calculation

### UI State Persistence
localStorage keys: `group-view-tab`, `loot-priority-subtab`, `party-view-mode`, `history-week-{groupId}-{tierId}`, `selected-tier-{groupId}`

### Tier-Specific Share Links
Shift+Click share code copies URL with `?tier=` param. On load: URL param > localStorage > active tier.

### Auth (httpOnly Cookies)
Tokens in secure httpOnly cookies. SameSite=Lax for CSRF. Token refresh on app load.

### Admin System
`is_admin` column on users, set via `ADMIN_DISCORD_IDS` env var. Admins get owner-level access to all statics. View As feature for impersonation (`?viewAs={userId}`). See `AdminDashboard.tsx` and `backend/app/permissions.py`.

### Keyboard Shortcuts
Press `Shift+?` in GroupView for shortcuts help. See `hooks/useKeyboardShortcuts.ts` and `KeyboardShortcutsHelp.tsx`.

### Zustand Selectors
Use specialized hooks to prevent re-renders:
```typescript
import { useTierPlayers, usePlayersByGroup, useCurrentTierMeta } from '../stores/tierStore';
```

### Setup Wizard
4-step guided static creation: Details → Roster → Share → Review.
Uses local React state (not Zustand) because state is transient. See `components/wizard/SetupWizard.tsx`.

### PlayerSetupBanner
Contextual prompts on PlayerCards when setup incomplete:
- Unclaimed + Owner/Lead → "Assign Player" button
- Unclaimed + Member → "Take Ownership" button
- Claimed + No BiS → "Import BiS" button
- Fully configured → Hidden

### Modal Header Icons
All modals have contextual icons in headers. ConfirmModal auto-adds icons by variant.

### Raid Tier Banners
Composite banner images in `public/images/raid-tiers/`. Regenerate with:
```bash
cd frontend && python scripts/blend_tier_banners.py --fetch
```

---

## Styling

**Theme:** Dark with teal accents. See `index.css`.

**Typography:** Exo 2 (display/headings) + Inter (body text). See `--font-display` and `--font-sans` in `index.css`.

**Animation:** Framer-motion presets in `lib/motion.ts`. CSS stagger via `.stagger-children`. All animations respect `prefers-reduced-motion`.

**Role Colors:** Tank (#5a9fd4), Healer (#5ad490), Melee (#d45a5a), Ranged (#d4a05a), Caster (#b45ad4)

**Semantic Tokens:**
- Membership: `text-membership-{owner|lead|member|viewer|linked}`
- Materials: `text-material-{twine|glaze|solvent|tomestone}`
- Status: `status-{success|warning|error|info}`

**Disabled:** `opacity-50 cursor-not-allowed`

**Modal:** Use `<div>` not native `<dialog>` (pointer event issues)

---

## What NOT To Do

1. Don't use sticky/fixed content panels - Use tab navigation (main header is sticky, that's fine)
2. Don't require modals for quick edits - Use inline editing
3. Don't use narrow containers - Use wide layout (120rem)
4. Don't mix display order and priority order - They're separate
5. Don't track weapon as either raid OR tome - BiS is always raid; tome is interim
6. **Don't say "group" when referring to the roster/static** - Use "static" in user-facing text (code vars like `groupId` are fine)

---

## CI/CD

PRs to main run: `build` (`tsc -b && vite build`), `lint`, `check:design-system:strict`, `test`. All must pass.

> **⚠️ `tsc --noEmit` ≠ `tsc -b`** — The build script runs `tsc -b` (project build mode), which is stricter than `tsc --noEmit`. Running `tsc --noEmit` locally will NOT catch all the same errors CI catches. Always run `pnpm build` before pushing to confirm the build is clean.

**Before opening or finalizing any PR, invoke the `pr-checklist` skill** (`.claude/skills/pr-checklist/SKILL.md`). It carries the CI-enforced rules that used to live here: the `releaseNotes.ts` entry requirement (internal vs public, `CURRENT_VERSION`, `pr`/`prTitle` over `commits`), the GitHub Actions fork-PR guard, and the pre-PR audit checklist.

---

## Additional Documentation

See **[docs/README.md](./docs/README.md)** for the full doc map. Canonical set:

### Source of truth
- **[PRODUCT_MODEL.md](./docs/PRODUCT_MODEL.md)** - What the app is, the model, the roadmap **(READ FIRST)**
- **[REDESIGN_SPEC.md](./design/redesign/REDESIGN_SPEC.md)** - IA, visual language, flows + mockups *(in progress)*

### Design System
- **[UI_COMPONENTS.md](./docs/UI_COMPONENTS.md)** - Component inventory **(READ BEFORE UI WORK)**
- **[DESIGN_SYSTEM_SUMMARY.md](./docs/DESIGN_SYSTEM_SUMMARY.md)** - Integration quick reference
- **[DESIGN_SYSTEM_ENFORCEMENT.md](./docs/DESIGN_SYSTEM_ENFORCEMENT.md)** - How it's enforced
- **[/docs/design-system](http://localhost:5174/docs/design-system)** - Interactive visual reference (dev server)

### Reference
- **[CODING_STANDARDS.md](./docs/CODING_STANDARDS.md)** - Code style and patterns
- **[GEARING_REFERENCE.md](./docs/GEARING_REFERENCE.md)** + **[GEARING_MATH.md](./docs/GEARING_MATH.md)** - FFXIV gearing data
- **[DOCS_STYLE_GUIDE.md](./docs/DOCS_STYLE_GUIDE.md)** - In-app user-docs style guide
- **`frontend/src/data/releaseNotes.ts`** - Changelog (CI-enforced)
- **[docs/archive/](./docs/archive/)** - Superseded planning, audit, and session docs

---

## Context Management

**Low Context (~15-20% remaining):** Summarize progress and next steps for the user; reference specific file paths.

**Session Continuity:** Capture decisions and discoveries; keep `docs/PRODUCT_MODEL.md` current if the model evolves.
