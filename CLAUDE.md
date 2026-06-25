# FFXIV Raid Planner - Project Guide

**Status:** v1.22.2 | **Next:** Solo Player Profile / Player Hub (in progress on `feature/solo-player-profile`), FFLogs integration

A web tool for FFXIV static raid groups to track gear progress toward BiS and manage loot distribution.

## Contents

[Quick Start](#quick-start) | [Commands](#commands) | [Key Files](#key-files) | [Project Structure](#project-structure) | [API Endpoints](#api-endpoints) | [Data Models](#data-models) | [Patterns](#key-patterns) | [Styling](#styling) | [What NOT To Do](#what-not-to-do)

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

---

## Commands

```bash
# Development
./dev.sh                          # Start both servers
pnpm dev                          # Frontend only
pnpm build                        # Type check + bundle (runs tsc -b && vite build)
pnpm lint                         # ESLint
pnpm check:design-system          # Design system violations
pnpm test                         # Frontend tests (Vitest)

# Backend
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --port 8001
pytest tests/ -q                  # Backend tests (pytest)

# Scripts
cd scripts && npm test            # Scripts tests (Vitest)
```

---

## Key Files

### Stores
- `stores/authStore.ts` - Discord OAuth, user state
- `stores/staticGroupStore.ts` - Static groups, membership
- `stores/tierStore.ts` - Tier snapshots, players
- `stores/lootTrackingStore.ts` - Loot log, page ledger, week tracking
- `stores/scheduleStore.ts` - Schedule sessions, RSVPs
- `stores/availabilityStore.ts` - Player availability grid
- `stores/mountFarmStore.ts` - Mount farm progress tracking
- `stores/lodestoneStore.ts` - Lodestone character sync
- `stores/apiKeyStore.ts` - API keys (Dalamud plugin)
- `stores/invitationStore.ts` - Invitations
- `stores/joinRequestStore.ts` - Join requests (discoverable statics)
- `stores/viewAsStore.ts` - Admin "View As" impersonation
- `stores/toastStore.ts` - Toast notifications

### Utils
- `utils/permissions.ts` - Role-based permission checks
- `utils/priority.ts` - Loot priority calculations
- `utils/lootCoordination.ts` - Cross-store loot/gear sync
- `lib/errorHandler.ts` - Centralized error parsing
- `lib/logger.ts` - Scoped logging utility
- `lib/eventBus.ts` - Pub/sub for cross-component events
- `lib/motion.ts` - Framer-motion animation presets

### Core Hooks
- `hooks/useGroupViewState.ts` - GroupView URL/localStorage sync
- `hooks/usePlayerActions.ts` - Player CRUD operations
- `hooks/useModal.ts` - Modal state management
- `hooks/useDebounce.ts` - Debounce utilities
- `hooks/useDoubleClickConfirm.ts` - Double-click confirm pattern
- `hooks/useTheme.ts` - Dark/light theme state, localStorage, OS preference

### Pages
- `pages/GroupView.tsx` - Main group view (~1455 lines)
- `pages/AdminDashboard.tsx` - Admin-only static browser

### Key Components
- `components/player/PlayerCard.tsx` - Player card with gear table
- `components/player/PlayerGrid.tsx` - Player grid with drag-drop
- `components/player/PlayerSetupBanner.tsx` - Contextual setup prompts
- `components/player/AssignUserModal.tsx` - Admin player assignment
- `components/wizard/SetupWizard.tsx` - 4-step static creation wizard
- `components/wizard/RosterSlot.tsx` - Wizard player slot with job picker
- `components/history/WeeklyLootGrid.tsx` - Spreadsheet-style loot grid

---

## Known Issues

See [OUTSTANDING_WORK.md](./docs/OUTSTANDING_WORK.md) for prioritized remaining work.

**Audit Status:** Complete. R-002 (props drilling) deferred; hooks mitigate it.

---

## Project Structure

```
backend/app/
├── models/        # 17 model files (~23 model classes): User, StaticGroup, Membership, TierSnapshot, SnapshotPlayer, schedule (ScheduleSession/Rsvp/Settings/DiscordMessageMapping/ReminderDelivery), availability (x2), invitation, join_request, loot_log_entry, material_log_entry, page_ledger_entry, mount_farm_progress, weekly_assignment, api_key, plugin_auth_code, analytics (x3)
├── schemas/       # Pydantic request/response
├── routers/       # 14 modules: auth, static_groups, tiers, loot_tracking, bis, invitations, join_requests, discovery, schedule, lodestone, mount_farms, api_keys, analytics, dev_auth
└── permissions.py # Role checks, admin helpers

frontend/src/
├── components/
│   ├── player/       # PlayerCard, PlayerGrid, GearTable, BiSImportModal
│   ├── loot/         # LootPriorityPanel, FloorSelector, QuickLogDropModal
│   ├── priority/     # Priority tab panels
│   ├── history/      # WeeklyLootGrid, SectionedLogView, All Weeks view
│   ├── schedule/     # ScheduleTab, AvailabilityGrid, CreateSessionModal, SessionCard
│   ├── mount-farms/  # Mount farm progress tracker UI
│   ├── settings/     # SettingsPanel (slide-out, replaces settings modal)
│   ├── admin/        # AdminSidebar, AdminKpiCard, analytics dashboard pieces
│   ├── wizard/       # SetupWizard, RosterSlot, step components
│   └── ui/           # Modal, ContextMenu, Button, Input
├── hooks/            # useGroupViewState, usePlayerActions, useModal
├── stores/           # Zustand stores
├── gamedata/         # jobs, costs, loot-tables, raid-tiers
└── utils/            # calculations, priority, permissions
```

---

## API Endpoints

**Auth:** `GET /api/auth/discord`, `POST .../callback`, `GET /api/auth/me`

**Static Groups:** `GET/POST /api/static-groups`, `GET .../by-code/{code}`, `PUT/DELETE .../{id}`, `POST .../{id}/duplicate`

**Tiers:** `GET/POST .../tiers`, `GET/PUT/DELETE .../tiers/{tierId}`, `POST .../rollover`

**Players:** `PUT/DELETE .../players/{playerId}`, `GET .../players/{playerId}/gear`, `POST .../players`, `POST/DELETE .../claim`, `POST .../assign`

**Invitations:** `GET/POST .../invitations`, `DELETE .../invitations/{id}`, `GET/POST /api/invitations/{code}`

**Join Requests / Discovery:** `GET /api/discovery/statics`, `POST /api/static-groups/{share_code}/join-requests`, `GET /api/static-groups/{group_id}/join-requests`, `POST .../join-requests/{id}/{accept|decline}`, `GET /api/me/join-requests`, `POST .../join-requests/{id}/cancel`

**BiS Import:** `GET /api/bis/presets/{job}`, `GET /api/bis/xivgear/{uuid}`, `GET /api/bis/etro/{uuid}`

**Loot:** `GET/POST/DELETE .../loot-log`, `GET/POST/DELETE .../material-log`, `GET/POST .../page-ledger`, `GET .../page-balances`, `POST .../mark-floor-cleared`

**Schedule:** `GET/POST .../static-groups/{id}/schedule`, `PUT/DELETE .../schedule/{sessionId}`, `POST .../schedule/{sessionId}/rsvp`, `GET/PUT .../static-groups/{id}/availability`

**Lodestone:** `GET /api/lodestone/search`, `GET /api/lodestone/status`, `GET /api/lodestone/character/{lodestone_id}`, `POST /api/lodestone/sync/{group_id}/{player_id}`, `POST /api/lodestone/identity/{group_id}/{player_id}`

**Mount Farms:** `GET/PUT .../static-groups/{id}/mount-farms`, `POST .../mount-farms/progress/bulk`, `GET .../mount-farms/recommendations`, `GET /api/plugin/mount-farms/catalog`, `POST /api/plugin/mount-farms/sync`

**API Keys (Dalamud plugin):** `GET/POST /api/auth/api-keys`, `DELETE /api/auth/api-keys/{key_id}`, `POST /api/auth/api-keys/plugin-auth/{authorize|exchange}` (PKCE browser sign-in)

**Analytics:** `POST /api/analytics/events`, `POST /api/analytics/errors`, `GET /api/admin/analytics/{overview|growth|usage|top-users|top-statics|errors}` (admin-only)

---

## Data Models

```typescript
interface SnapshotPlayer {
  id: string; tierSnapshotId: string; userId?: string;
  name: string; job: string; role: string;
  position?: 'T1'|'T2'|'H1'|'H2'|'M1'|'M2'|'R1'|'R2';
  tankRole?: 'MT'|'OT';
  configured: boolean; sortOrder: number;
  gear: GearSlotStatus[]; tomeWeapon: TomeWeaponStatus;
  weaponPriorities: WeaponPriority[];
  isSubstitute: boolean; bisLink?: string;
  lootAdjustment?: number;  // Mid-tier roster fairness
  pageAdjustments?: { I: number; II: number; III: number; IV: number };
}

interface GearSlotStatus {
  slot: GearSlot;
  bisSource: 'raid' | 'tome';
  currentSource?: 'savage'|'tome_up'|'catchup'|'tome'|'relic'|'crafted'|'prep'|'normal'|'unknown';
  hasItem: boolean; isAugmented: boolean;
  itemLevel?: number; itemName?: string; itemIcon?: string;
}

type GearSlot = 'weapon'|'head'|'body'|'hands'|'legs'|'feet'|'earring'|'necklace'|'bracelet'|'ring1'|'ring2';
```

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

### Release Notes Requirement

Any PR that touches `frontend/src/` or `backend/app/` **must** add or update an entry in `frontend/src/data/releaseNotes.ts`.

**Internal-only changes** (tests, refactors, CI fixes, backend plumbing, security hardening with no visible user change, workflow updates):
```ts
{ internal: true, ... }
```
This hides the entry from users but satisfies CI. Do **NOT** bump `CURRENT_VERSION` for internal-only entries.

**User-facing changes** (bug fixes, features, improvements visible to users) get a normal public release note entry. **Always bump `CURRENT_VERSION`** to match the new version string — including patch releases (e.g. `1.26.0` → `1.26.1`). The `scripts/discord-changelog.test.js` suite enforces that `CURRENT_VERSION` equals the version of the latest non-internal release entry; CI will fail if they differ.

Dates must be full ISO 8601 (`YYYY-MM-DDTHH:MM:SSZ`).

**Every item needs a `description`** (CI-enforced on the latest release). The title is a headline; the description is the sentence users actually read on the release-notes page.

**Reference the change with `pr` + `prTitle`, not `commits`.** Add `pr: <number>` (links to `/pull/{n}` on the release-notes page) and `prTitle: '<the PR title>'` (shown next to the `#n` link, like a commit message). The PR number is known as soon as you open the PR, is stable, and survives squash-merge — unlike a commit SHA, which doesn't exist until merge. The old pattern of `commits: [{ hash: 'pending', ... }]` left dead `/commit/pending` links because the placeholder was never backfilled; the page now refuses to link a non-SHA hash. Use `commits` only when you have a **real** short SHA (historical entries) — and you may include both `pr` and `commits`, the page renders a "Pull Request" section and a "Related Commits" section independently. Example:
```ts
{ category: 'fix', title: 'Short headline', description: 'What changed and why it matters.', pr: 128, prTitle: 'fix(scope): the PR title' }
```

### Fork PR Guard (GitHub Actions)

Any GitHub Actions workflow (new or updated) that **writes to PRs** must include a fork guard:
```yaml
if: github.event.pull_request.head.repo.full_name == github.repository
```

Write operations that require this guard:
- Adding/creating labels
- Assigning reviewers or assignees
- Creating/updating PR comments
- Modifying PR metadata

**Why:** Fork PRs receive a read-only `GITHUB_TOKEN`. Without the guard, write actions fail with `HttpError: Resource not accessible by integration`.

Existing guarded workflows: `pr-automation`, `release-notes-reminder`.

### Pre-PR Audit Checklist

Before declaring a branch ready, run:
```powershell
git diff --name-only | Select-String "frontend/src|backend/app"
git diff --name-only | Select-String "releaseNotes.ts"
git diff --name-only | Select-String ".github/workflows"
```

1. If `frontend/src/` or `backend/app/` changed and `releaseNotes.ts` did **not** change → stop and add the release note entry.
2. If `.github/workflows/` changed and the workflow writes to PRs → confirm the fork guard exists.
3. Run `git diff --check` to catch whitespace errors.

---

## Claude Code Commands

Custom slash commands for Claude Code (invoke with `/project:`):

| Command | Description |
|---------|-------------|
| `/project:audit-user-docs` | Audit user documentation against style guide, check for staleness, produce report |

**Related docs for documentation work:**
- `docs/DOCS_STYLE_GUIDE.md` - Tone, formatting, component usage for user docs
- `docs/DOCS_IMPLEMENTATION_PLAN.md` - Phased restructure plan (if active)

---

## Additional Documentation

### Design System
- **[UI_COMPONENTS.md](./docs/UI_COMPONENTS.md)** - Component inventory **(READ BEFORE UI WORK)**
- **[DESIGN_SYSTEM_SUMMARY.md](./docs/DESIGN_SYSTEM_SUMMARY.md)** - Design system integration quick reference
- **[DESIGN_SYSTEM_ENFORCEMENT.md](./docs/DESIGN_SYSTEM_ENFORCEMENT.md)** - How design system is enforced
- **[/docs/design-system](http://localhost:5174/docs/design-system)** - Interactive visual reference (dev server)

### Development
- **[CODING_STANDARDS.md](./docs/CODING_STANDARDS.md)** - Code style and patterns
- **[CONSOLIDATED_STATUS.md](./docs/CONSOLIDATED_STATUS.md)** - Version history, resolved issues
- **[OUTSTANDING_WORK.md](./docs/OUTSTANDING_WORK.md)** - Remaining work, prioritized
- **[SETUP_WIZARD_PLAN.md](./docs/SETUP_WIZARD_PLAN.md)** - Setup wizard implementation plan

### Reference
- **[GEARING_REFERENCE.md](./docs/GEARING_REFERENCE.md)** - FFXIV gearing data
- **[DOCS_STYLE_GUIDE.md](./docs/DOCS_STYLE_GUIDE.md)** - User documentation style guide

---

## Context Management

**Low Context (~15-20% remaining):** Update OUTSTANDING_WORK.md with progress, list next steps, notify user.

**Session Continuity:** Update OUTSTANDING_WORK.md with completed items and discoveries. Reference specific file paths.
