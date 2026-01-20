# FFXIV Raid Planner - Project Guide

**Status:** v1.9.0 | **Next:** Session 4 (MembersPanel), Phase 7 (Lodestone sync), Phase 8 (FFLogs)

A web tool for FFXIV static raid groups to track gear progress toward BiS and manage loot distribution.

## Contents

[Quick Start](#quick-start) | [Commands](#commands) | [Key Files](#key-files) | [Project Structure](#project-structure) | [API Endpoints](#api-endpoints) | [Data Models](#data-models) | [Patterns](#key-patterns) | [Styling](#styling) | [What NOT To Do](#what-not-to-do)

---

## IMPORTANT: Git Commit & PR Rules

**NEVER add AI attribution to commits or PRs.** No "Co-Authored-By: Claude", no "Generated with Claude Code", no AI tool attribution of any kind. This is **absolute and non-negotiable**.

---

## Quick Start

```bash
./dev.sh              # Start both servers
./dev.sh stop         # Stop servers
./dev.sh logs         # Tail logs
```

**API:** http://localhost:8000 | **Frontend:** http://localhost:5173

---

## UI Implementation Rules (MANDATORY)

**BEFORE implementing ANY new UI:**

1. **Check existing components** - See [docs/UI_COMPONENTS.md](./docs/UI_COMPONENTS.md)
2. **Run design system check** - `pnpm check:design-system`
3. **Use design system primitives** - Never raw `<button>`, `<input>`, `<select>`, `<label>`, `<textarea>`
4. **Use semantic color tokens** - Never hardcode colors

### Component Reference

| Need | Component | Path |
|------|-----------|------|
| Button | `Button` | `primitives/Button.tsx` |
| Icon button | `IconButton` | `primitives/IconButton.tsx` |
| Job selection | `JobPicker` | `player/JobPicker.tsx` |
| Position (T1-R2) | `PositionSelector` | `player/PositionSelector.tsx` |
| Tank role (MT/OT) | `TankRoleSelector` | `player/TankRoleSelector.tsx` |
| Text input | `Input` | `ui/Input.tsx` |
| Dropdown | `Select` | `ui/Select.tsx` |
| Checkbox | `Checkbox` | `ui/Checkbox.tsx` |
| Modal | `Modal` + `useModal` | `ui/Modal.tsx` |
| Confirm dialog | `ConfirmModal` | `ui/ConfirmModal.tsx` |
| Context menu | `ContextMenu` | `ui/ContextMenu.tsx` |
| Error display | `ErrorMessage` | `ui/ErrorMessage.tsx` |
| Loading state | `Skeleton` | `ui/Skeleton.tsx` |
| Job icon | `JobIcon` | `ui/JobIcon.tsx` |
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
pnpm build && pnpm tsc --noEmit   # Build + type check
pnpm lint                         # ESLint
pnpm check:design-system          # Design system violations
pnpm test                         # Frontend tests (351)

# Backend
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --port 8000
pytest tests/ -q                  # Backend tests (209)

# Scripts
cd scripts && npm test            # Scripts tests (87)
```

---

## Key Files

### Stores
- `stores/authStore.ts` - Discord OAuth, user state
- `stores/staticGroupStore.ts` - Static groups, membership
- `stores/tierStore.ts` - Tier snapshots, players
- `stores/lootTrackingStore.ts` - Loot log, page ledger, week tracking

### Utils
- `utils/permissions.ts` - Role-based permission checks
- `utils/priority.ts` - Loot priority calculations
- `utils/lootCoordination.ts` - Cross-store loot/gear sync
- `lib/errorHandler.ts` - Centralized error parsing
- `lib/logger.ts` - Scoped logging utility
- `lib/eventBus.ts` - Pub/sub for cross-component events

### Core Hooks
- `hooks/useGroupViewState.ts` - GroupView URL/localStorage sync
- `hooks/usePlayerActions.ts` - Player CRUD operations
- `hooks/useModal.ts` - Modal state management
- `hooks/useDebounce.ts` - Debounce utilities
- `hooks/useDoubleClickConfirm.ts` - Double-click confirm pattern

### Pages
- `pages/GroupView.tsx` - Main group view (~850 lines)
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
├── models/        # User, StaticGroup, Membership, TierSnapshot, SnapshotPlayer
├── schemas/       # Pydantic request/response
├── routers/       # auth, static_groups, tiers
└── permissions.py # Role checks, admin helpers

frontend/src/
├── components/
│   ├── player/       # PlayerCard, PlayerGrid, GearTable, BiSImportModal
│   ├── loot/         # LootPriorityPanel, FloorSelector, QuickLogDropModal
│   ├── history/      # WeeklyLootGrid, SectionedLogView
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

**Players:** `PUT/DELETE .../players/{playerId}`, `POST .../players`, `POST/DELETE .../claim`, `POST .../assign`

**Invitations:** `GET/POST .../invitations`, `DELETE .../invitations/{id}`, `GET/POST /api/invitations/{code}`

**BiS Import:** `GET /api/bis/presets/{job}`, `GET /api/bis/xivgear/{uuid}`, `GET /api/bis/etro/{uuid}`

**Loot:** `GET/POST/DELETE .../loot-log`, `GET/POST/DELETE .../material-log`, `GET/POST .../page-ledger`, `GET .../page-balances`, `POST .../mark-floor-cleared`

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

PRs to main run: `tsc --noEmit`, `lint`, `check:design-system:strict`, `test`, `build`. All must pass.

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

- **[UI_COMPONENTS.md](./docs/UI_COMPONENTS.md)** - Component inventory **(READ BEFORE UI WORK)**
- **[CODING_STANDARDS.md](./docs/CODING_STANDARDS.md)** - Code style and patterns
- **[CONSOLIDATED_STATUS.md](./docs/CONSOLIDATED_STATUS.md)** - Version history, resolved issues
- **[OUTSTANDING_WORK.md](./docs/OUTSTANDING_WORK.md)** - Remaining work, prioritized
- **[SETUP_WIZARD_PLAN.md](./docs/SETUP_WIZARD_PLAN.md)** - Setup wizard implementation plan
- **[GEARING_REFERENCE.md](./docs/GEARING_REFERENCE.md)** - FFXIV gearing data
- **[DOCS_STYLE_GUIDE.md](./docs/DOCS_STYLE_GUIDE.md)** - User documentation style guide

---

## Context Management

**Low Context (~15-20% remaining):** Update OUTSTANDING_WORK.md with progress, list next steps, notify user.

**Session Continuity:** Update OUTSTANDING_WORK.md with completed items and discoveries. Reference specific file paths.
