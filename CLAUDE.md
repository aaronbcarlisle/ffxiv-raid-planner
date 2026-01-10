# FFXIV Raid Planner - Project Guide

**Status:** v1.0.2 Released (Phase 1-6.5 + Parity + Audit + UX Improvements) | **Next:** Phase 7 (Lodestone sync), Phase 8 (FFLogs)

A web-based tool for FFXIV static raid groups to track gear progress toward BiS, manage loot distribution with priority calculations.

## Contents

[Quick Start](#quick-start) | [Commands](#commands) | [Key Files](#key-files) | [Known Issues](#known-issues)

[Project Structure](#project-structure) | [API Endpoints](#api-endpoints) | [Data Models](#data-models)

[Patterns](#key-implementation-patterns) | [Styling](#styling) | [What NOT To Do](#what-not-to-do)

---

## IMPORTANT: Git Commit & PR Rules

**NEVER add AI attribution to commits or PRs.** This includes:
- No "Co-Authored-By: Claude" or similar in commit messages
- No "Generated with Claude Code" in PR descriptions
- No "Written by AI" or contributor credits for AI assistance
- No AI tool attribution of any kind in any commit or PR content

This rule is **absolute and non-negotiable**.

---

## Quick Start

```bash
./dev.sh              # Start both servers (kills existing, starts fresh)
./dev.sh stop         # Stop both servers
./dev.sh logs         # Tail both log files
```

**API:** http://localhost:8000 | **Frontend:** http://localhost:5173

---

## Commands

```bash
# Development
./dev.sh              # Start both servers
pnpm dev              # Frontend only
pnpm build            # Production build
pnpm tsc --noEmit     # Type check
pnpm lint             # ESLint

# Design System
./frontend/scripts/check-design-system.sh           # Check for raw HTML/hardcoded colors
./frontend/scripts/check-design-system.sh --strict  # Strict mode for CI (exits 1 on violations)

# Backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000
cd backend && python scripts/backfill_gcd.py        # BiS preset regen
cd backend && python scripts/normalize_preset_names.py
cd backend && python scripts/migrate_add_is_admin.py  # Add admin column (run once)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `stores/authStore.ts` | Discord OAuth, user state |
| `stores/staticGroupStore.ts` | Static groups, membership |
| `stores/tierStore.ts` | Tier snapshots, players |
| `stores/lootTrackingStore.ts` | Loot log, page ledger, week tracking |
| `utils/permissions.ts` | Role-based permission checks |
| `utils/priority.ts` | Loot priority calculations |
| `utils/lootCoordination.ts` | Cross-store loot/gear sync |
| `utils/weaponPriority.ts` | Weapon priority scoring |
| `gamedata/loot-tables.ts` | Floor drop tables, FLOOR_COLORS |
| `gamedata/raid-tiers.ts` | Tier configuration |
| `data/releaseNotes.ts` | Version history data |
| `pages/ReleaseNotes.tsx` | Release notes page with collapsible nav |
| `pages/GroupView.tsx` | Main group view with tab navigation |
| `pages/AdminDashboard.tsx` | Admin-only static browser |
| `components/layout/ReleaseBanner.tsx` | New version notification |
| `components/history/WeeklyLootGrid.tsx` | Spreadsheet-style loot grid |
| `components/history/SectionedLogView.tsx` | Log tab with floor filters |
| `components/ui/ContextMenu.tsx` | Reusable context menu |
| `lib/errorHandler.ts` | Centralized error parsing with HTTP messages |
| `lib/logger.ts` | Development-aware logging with scoping |
| `lib/eventBus.ts` | Pub/sub for cross-component communication |
| `hooks/useKeyboardShortcuts.ts` | Global keyboard shortcuts hook |
| `components/ui/KeyboardShortcutsHelp.tsx` | Keyboard shortcuts help modal |
| `config.ts` | API URL and environment configuration |

---

## Known Issues (from Audit)

See [2026-01-01-comprehensive-audit.md](./docs/audits/2026-01-01-comprehensive-audit.md) for details.

### Open Items
- **P-005:** GroupView.tsx is 811 lines (consider splitting)

### Resolved in v1.0.1
- ~~**P-001:** N+1 in duplicateGroup~~ - Now uses bulk `/duplicate` endpoint
- ~~**T-001:** Low test coverage~~ - Now 321 tests (95 backend + 226 frontend)

---

## Parity Implementation (Phases 1-4 Complete)

**Plan:** `/home/serapis/.claude/plans/nifty-pondering-summit.md`
**Audit:** `docs/audits/2026-01-02-ffxiv-raid-planner-parity-audit.md`

### Completed Features

| Feature | Description | Files |
|---------|-------------|-------|
| **Gear Categories** | 9-category `currentSource` tracking | `types/index.ts`, `schemas/tier_snapshot.py` |
| **iLv Tracking** | Average iLv calculated and displayed | `utils/calculations.ts`, `PlayerCardHeader.tsx` |
| **Adjustments** | `lootAdjustment` + `pageAdjustments` for mid-tier joins | `models/snapshot_player.py`, `priority.ts` |

### Parity Types

```typescript
// 9 gear source categories for current equipment state
type GearSourceCategory = 'savage' | 'tome_up' | 'catchup' | 'tome' |
                          'relic' | 'crafted' | 'prep' | 'normal' | 'unknown';

// GearSlotStatus with currentSource
interface GearSlotStatus {
  slot: GearSlot;
  bisSource: 'raid' | 'tome';         // BiS target
  currentSource?: GearSourceCategory; // What's actually equipped
  hasItem: boolean;
  isAugmented: boolean;
  itemLevel?: number;                 // Used for iLv calculation
  // ... rest unchanged
}

// SnapshotPlayer with adjustments
interface SnapshotPlayer {
  // ... existing fields ...
  lootAdjustment?: number;                              // For mid-tier roster changes
  pageAdjustments?: { I: number; II: number; III: number; IV: number };
}
```

### Tests (321 Total)

**Backend (95 tests):**
```bash
cd backend && source venv/bin/activate && pytest tests/ -q
```
- `test_auth.py` - Authentication endpoints
- `test_auth_utils.py` - JWT token creation/verification
- `test_config_validation.py` - Production config validation
- `test_duplicate_group.py` - Bulk duplication endpoint
- `test_tier_deactivation.py` - Tier activation logic
- `test_pr_integration.py` - Integration tests for PR features

**Frontend (226 tests):**
```bash
pnpm test
```
- `errorHandler.test.ts` - Error parsing utilities
- `logger.test.ts` - Logging utility
- `eventBus.test.ts` - Event bus pub/sub
- `tierStore.selectors.test.ts` - Zustand selector hooks
- `calculations.test.ts` - iLv and priority calculations
- `priority.test.ts` - Loot priority scoring
- `releaseNotes.test.ts` - Release notes data validation (v1.0.2)
- `uxHelpers.test.ts` - UX patterns and accessibility (v1.0.2)
- `lootCoordination.test.ts` - Loot stats and gear sync (v1.0.2)

### Optional Future Enhancements
- Add currentSource dropdown to GearTable (manual override per slot)
- Add UI for editing lootAdjustment and pageAdjustments per player

---

## Project Structure

```
ffxiv-raid-planner/
├── backend/
│   ├── app/
│   │   ├── main.py, config.py, database.py
│   │   ├── models/        # User, StaticGroup, Membership, TierSnapshot, SnapshotPlayer
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── routers/       # auth, static_groups, tiers
│   │   └── services/      # share_code generation
│   ├── scripts/           # backfill_gcd.py, normalize_preset_names.py
│   └── data/              # SQLite database, local_bis_presets.json
├── frontend/src/
│   ├── components/
│   │   ├── player/           # PlayerCard, GearTable, BiSImportModal
│   │   ├── loot/             # LootPriorityPanel, FloorSelector, QuickLogDropModal
│   │   ├── history/          # HistoryView, LootLogPanel, PageBalancesPanel
│   │   ├── weapon-priority/  # WeaponPriorityModal, WeaponPriorityEditor
│   │   ├── static-group/     # StaticSwitcher, TierSelector, GroupSettingsModal
│   │   ├── auth/             # LoginButton, UserMenu
│   │   ├── primitives/       # IconButton, VisuallyHidden
│   │   └── ui/               # Modal, Toast, ContextMenu, TabNavigation
│   ├── pages/                # Home, Dashboard, GroupView, AuthCallback
│   ├── stores/               # authStore, staticGroupStore, tierStore, lootTrackingStore
│   ├── gamedata/             # jobs, costs, loot-tables, raid-tiers
│   ├── utils/                # calculations, priority, lootCoordination
│   └── types/
└── docs/
```

---

## API Endpoints

### Auth
- `GET /api/auth/discord` - Get OAuth URL
- `POST /api/auth/discord/callback` - Handle callback
- `GET /api/auth/me` - Current user

### Static Groups
- `GET/POST /api/static-groups` - List/Create
- `GET /api/static-groups/by-code/{code}` - By share code
- `PUT/DELETE /api/static-groups/{id}` - Update/Delete
- `POST /api/static-groups/{id}/duplicate` - Bulk duplicate group with tiers/players

### Tiers
- `GET/POST /api/static-groups/{id}/tiers` - List/Create
- `GET/PUT/DELETE /api/static-groups/{id}/tiers/{tierId}` - CRUD
- `POST .../tiers/{tierId}/rollover` - Copy roster

### Players
- `PUT/DELETE .../tiers/{tierId}/players/{playerId}` - Update/Remove
- `POST .../tiers/{tierId}/players` - Add player
- `POST/DELETE .../players/{playerId}/claim` - Take/Release ownership

### Invitations
- `GET/POST /api/static-groups/{id}/invitations` - List/Create
- `DELETE .../invitations/{inviteId}` - Revoke
- `GET/POST /api/invitations/{code}` - Preview/Accept

### BiS Import
- `GET /api/bis/presets/{job}?category=savage` - Job presets
- `GET /api/bis/xivgear/{uuid}` - Fetch XIVGear set
- `GET /api/bis/etro/{uuid}` - Fetch Etro set

### Loot Tracking
- `GET/POST/DELETE .../tiers/{tierId}/loot-log` - Loot log CRUD
- `GET/POST/DELETE .../tiers/{tierId}/material-log` - Material log CRUD
- `GET/POST .../tiers/{tierId}/page-ledger` - Page ledger
- `GET .../tiers/{tierId}/page-balances` - Player book balances
- `POST .../tiers/{tierId}/mark-floor-cleared` - Batch add book earnings
- `GET .../tiers/{tierId}/current-week` - Get current/max week

---

## Data Models

```typescript
interface SnapshotPlayer {
  id: string;
  tierSnapshotId: string;
  userId?: string;
  name: string;
  job: string;           // 'DRG', 'WHM', etc.
  role: string;          // 'tank', 'healer', 'melee', 'ranged', 'caster'
  position?: RaidPosition;
  tankRole?: TankRole;
  configured: boolean;
  sortOrder: number;
  gear: GearSlotStatus[];
  tomeWeapon: TomeWeaponStatus;
  weaponPriorities: WeaponPriority[];
  isSubstitute: boolean;
  bisLink?: string;
}

interface GearSlotStatus {
  slot: GearSlot;
  bisSource: 'raid' | 'tome';       // BiS target
  currentSource: GearSourceCategory; // Actual equipped gear (9 options)
  hasItem: boolean;
  isAugmented: boolean;
  itemLevel?: number;               // For iLv calculation
  itemName?: string;
  itemIcon?: string;
}

type RaidPosition = 'T1' | 'T2' | 'H1' | 'H2' | 'M1' | 'M2' | 'R1' | 'R2';
type TankRole = 'MT' | 'OT';
type GearSlot = 'weapon' | 'head' | 'body' | 'hands' | 'legs' | 'feet' |
                'earring' | 'necklace' | 'bracelet' | 'ring1' | 'ring2';

interface LootLogEntry {
  id: number;
  tierSnapshotId: string;
  weekNumber: number;
  floor: string;
  itemSlot: string;
  recipientPlayerId: string;
  recipientPlayerName: string;
  method: 'drop' | 'book' | 'tome';
  notes?: string;
  weaponJob?: string;    // Which job's weapon (e.g., 'DRG', 'WHM')
  isExtra: boolean;      // True if off-job/extra loot (not BiS priority)
  createdAt: string;
  createdByUserId: string;
  createdByUsername: string;
}

type MaterialType = 'twine' | 'glaze' | 'solvent' | 'universal_tomestone';
```

---

## Permission System

| Role | Access Level |
|------|-------------|
| **Owner** | Full control - settings, delete, edit all players, roster |
| **Lead** | Manage tiers, add/remove/reorder players, edit all players |
| **Member** | Edit only players they've claimed via "Take Ownership" |
| **Viewer** | Read-only via share code |

Backend always validates (defense in depth). Destructive actions disabled with tooltips.

---

## Key Implementation Patterns

### Reset Gear Options
1. **Reset progress** - Uncheck hasItem/isAugmented, keep BiS config
2. **Unlink BiS** - Clear bisLink and metadata, keep progress
3. **Reset everything** - Complete wipe to defaults

### Tome Weapon Tracking
- BiS weapon is ALWAYS raid; toggle "Raid + Tome" to track interim tome weapon

### Cross-Group Drag
Dragging between G1/G2 auto-swaps position (T1↔T2, H1↔H2, etc.)

### Modal + DnD
When modals open, set drag sensor distance to 999999 to disable dragging.

### UI State Persistence (localStorage)
- `group-view-tab`, `loot-priority-subtab`, `party-view-mode`
- `history-week-{groupId}-{tierId}`, `selected-tier-{groupId}`, `sort-preset-{tierId}`

### Tier-Specific Share Links
- Shift+Click on share code copies URL with `?tier=` parameter
- On load: URL param > localStorage > active tier > first tier

### Loot Coordination
`lootCoordination.ts` syncs loot log entries with gear checkboxes and weapon priorities.

### Current vs BiS Gear
- `bisSource` = BiS target (raid or tome) - what you're working toward
- `currentSource` = what you actually have equipped (9 categories)
- Average iLv calculated from `currentSource` when `itemLevel` not available

### iLv Calculation
- For tome BiS with `hasItem` but NOT `isAugmented`: uses base tome iLv (not augmented)
- Otherwise uses `itemLevel` from BiS import if `hasItem` is true
- Falls back to `getItemLevelForCategory()` using `currentSource` and tier config
- `currentSource` is auto-updated when `hasItem`/`isAugmented` checkboxes change
- Displayed next to completion count in PlayerCard header

### Mid-Tier Roster Changes
- `lootAdjustment` - positive = extra drops counted, negative = drops to ignore
- `pageAdjustments` - per-floor book adjustments for players joining mid-tier
- Both affect priority calculations for fairness

### Weapon Job Tracking (v1.0.0)
- `weaponJob` field on loot entries identifies which job's weapon was received
- Displayed in loot log with job icon (e.g., "Weapon (DRG)")
- Used to correctly update weapon priority when logging

### Extra Loot Tagging (v1.0.0)
- `isExtra` boolean marks off-job/extra loot (not BiS priority)
- Auto-detected when recipient's main job doesn't match weapon job
- Displayed with "Extra" badge in loot log

### Universal Tomestone (v1.0.0)
- Fourth material type for weapon augmentation (floor 2 drop)
- Tracked separately with priority calculation
- Only one per player counted for priority

### Weapon Priority Ties (v1.0.0)
- Players with same score grouped as tie
- Roll button generates random 1-100 for each tied player
- Auto-expands list if tie extends beyond visible entries
- Winner highlighted in green

### Auth Persistence (v1.0.0)
- Proactive token refresh on app load (60-second buffer)
- Production misconfiguration detection with console warnings
- JWT expiration check prevents unnecessary 401 errors

### Weekly Loot Grid (v1.0.2)
- Spreadsheet-style view in Log tab for viewing/logging weekly loot
- Floor-colored section headers matching floor selector colors
- Click cells to log loot, right-click for context menu
- Context menu respects `canEdit` permission - Edit/Delete hidden for read-only users
- Loot count summary bar shows distribution fairness indicators
- `highlightedEntryId` prop supports deep linking with pulse animation

### Floor Selectors (v1.0.2)
- Unified colored button tabs across Gear Priorities, Who Needs It, and Log By Floor
- `FLOOR_COLORS` from `loot-tables.ts` provides consistent colors
- Use `aria-pressed={isSelected}` for accessibility
- Floor filter uses `invisible` class instead of conditional render to prevent layout shift

### Smart Tab Navigation (v1.0.2)
- When switching statics via StaticSwitcher, check if new group has players
- If no players, auto-switch to "players" tab to prevent empty state confusion
- Uses `setPageMode()` wrapper (not direct state setter) to sync URL and localStorage

### Dashboard Context Menus (v1.0.2)
- Right-click static cards for quick actions: Open, Rename, Copy Share Code, Delete
- Delete option only shown to owners (`role === 'owner'`)
- Uses `ContextMenu` component from `components/ui/ContextMenu.tsx`

### Release Notes Navigation (v1.0.2)
- Collapsible version sections using expandedVersions Set state
- Sticky navigation panel with scroll-synced active version tracking
- `scrollEndTimeoutRef` prevents scroll jitter with 150ms debounce
- `isScrollingRef` prevents recursive updates during programmatic scrolls
- URL hash navigation auto-expands target version section
- Uses `ReturnType<typeof setTimeout>` for cross-environment type safety

### Subs Toggle (v1.0.2)
- Independent from G1/G2 view - can show subs without group split
- Matches G1/G2 toggle styling with user-add icon and accent colors
- Uses `aria-label` for accessibility

### Keyboard Shortcuts (v1.0.3)
Global keyboard shortcuts for power users in GroupView.

**Available shortcuts:**
| Key | Action |
|-----|--------|
| `?` | Show keyboard shortcuts help |
| `1` | Go to Players tab |
| `2` | Go to Loot tab |
| `3` | Go to Log tab |
| `4` | Go to Summary tab |
| `v` | Toggle compact/expanded view (Players tab only) |
| `g` | Toggle G1/G2 group view (Players tab only) |
| `Escape` | Close modal |

**Implementation:**
- `hooks/useKeyboardShortcuts.ts` - Reusable hook with modifier support
- `components/ui/KeyboardShortcutsHelp.tsx` - Help modal component
- Shortcuts disabled when typing in inputs or when modals are open
- Uses `isInputElement()` check to prevent conflicts with text entry

### Admin System (v1.0.2)
Super-user access for app owners to troubleshoot any static group.

**Setup:**
1. Run migration: `python scripts/migrate_add_is_admin.py`
2. Set `ADMIN_DISCORD_IDS` env var (comma-separated Discord IDs)
3. Admin users log in via Discord - flag is auto-set on login

**How it works:**
- `is_admin` column on `users` table (boolean, default false)
- `ADMIN_DISCORD_IDS` env var = whitelist that auto-grants admin on login
- Admin users get owner-level access to ALL static groups (view, edit, manage)
- No API endpoint to grant admin - only via env var or direct DB edit

**Admin Dashboard (`/admin/statics`):**
- Shows ALL statics in the system with search/filter
- Displays owner info (avatar, username), member/tier counts
- Click any row to view/edit that static
- Only visible to users with `isAdmin=true`

**View As Feature:**
- Admins can impersonate any member of a static group
- Click eye icon in Actions column → select member from modal
- URL supports `?viewAs={userId}` for direct linking
- Amber banner shows current impersonation with "Exit View As" button
- Permissions reflect the impersonated user's role (not admin)
- All UI permission checks use `getEffectiveRole()` which applies View As context
- Exit clears both URL param and Zustand state
- Validates group ID to prevent stale state across navigation

**Security:**
- Admin can only be granted via direct database access or env var whitelist
- The env var only grants admin, never revokes (manual DB edit to revoke)
- Frontend permission utilities accept `isAdmin` parameter for UI checks

**Files:**
- `backend/app/models/user.py` - `is_admin` column
- `backend/app/config.py` - `admin_discord_ids` setting
- `backend/app/permissions.py` - `is_user_admin()`, `create_admin_membership()`
- `backend/app/routers/static_groups.py` - `GET /api/static-groups/admin/all`
- `backend/scripts/migrate_add_is_admin.py` - Migration script
- `frontend/src/pages/AdminDashboard.tsx` - Admin dashboard page
- `frontend/src/utils/permissions.ts` - `getEffectiveRole()` helper

**Admin System Helpers (when to use which):**
- `get_user_role_for_response()` - Use in API endpoints to get `(role, is_admin_access)` tuple for responses
- `is_user_admin()` - Use for permission checks in service layer (returns bool)
- `check_view_permission()` - Use for view access validation (handles admins automatically)
- `create_admin_membership()` - Creates virtual membership object for admins accessing non-member groups

### Frontend Utilities (v1.0.1)

**Error Handler (`lib/errorHandler.ts`):**
```typescript
import { parseApiError, handleApiError } from '../lib/errorHandler';

// Parse error to standardized format
const error = parseApiError(response); // { message, code, status }

// Handle with logging and optional toast
handleApiError(error, 'save player', true);
```

**Logger (`lib/logger.ts`):**
```typescript
import { logger } from '../lib/logger';

// Basic logging (dev only for debug/info)
logger.debug('Value:', value);
logger.info('Loading...');
logger.warn('Deprecation warning');
logger.error('Failed to save');

// Scoped logger
const log = logger.scope('TierStore');
log.debug('Fetching tiers...'); // [HH:MM:SS.mmm] [DEBUG] [TierStore] Fetching tiers...

// Performance timing
const end = logger.time('fetchTiers');
await fetchTiers();
end(); // Logs: fetchTiers took 123ms
```

**Event Bus (`lib/eventBus.ts`):**
```typescript
import { eventBus, useEventBus } from '../lib/eventBus';

// Emit events
eventBus.emit('player:updated', { playerId: '123' });

// Subscribe in components
useEventBus('player:updated', (data) => {
  console.log('Player updated:', data.playerId);
});
```

### Zustand Selector Hooks (v1.0.1)
Use specialized selector hooks to prevent unnecessary re-renders:
```typescript
// Instead of: useTierStore((s) => s.currentTier?.players)
import { useTierPlayers } from '../stores/tierStore';
const players = useTierPlayers();

// Available selectors:
useTierPlayers()         // Current tier players
usePlayersByGroup()      // { group1: Player[], group2: Player[] }
useCurrentTierMeta()     // { tierId, tierName, isActive }
useGroupTiers()          // All tiers for current group
```

### Group Duplication (v1.0.1)
- Single API call replaces 40+ individual requests
- Resets tracking data (current_week, week_start_date, loot history)
- Resets player ownership (user_id cleared)
- Deep copies settings to prevent shared references
- Ensures only one tier is active in duplicated group

---

## Styling

**Theme:** Dark with teal accents (`#14b8a6`). See `index.css`.

**Role Colors:** Tank (#5a9fd4), Healer (#5ad490), Melee (#d45a5a), Ranged (#d4a05a), Caster (#b45ad4)

**Membership Colors:** Use semantic tokens for role badges:
- Owner: `text-membership-owner` (teal, same as accent)
- Lead: `text-membership-lead` (purple)
- Member: `text-membership-member` (blue)
- Viewer: `text-membership-viewer` (zinc)
- Linked: `text-membership-linked` (amber)

**Material Colors:** Use semantic tokens for material indicators:
- Twine: `text-material-twine` / `bg-material-twine/20`
- Glaze: `text-material-glaze` / `bg-material-glaze/20`
- Solvent: `text-material-solvent` / `bg-material-solvent/20`
- Tomestone: `text-material-tomestone` / `bg-material-tomestone/20`

**Status Colors:** `status-success`, `status-warning`, `status-error`, `status-info`

**Disabled State:** `opacity-50 cursor-not-allowed`

**Modal:** Uses `<div>` not native `<dialog>` (pointer event issues)

**Design System Compliance:** Run `./frontend/scripts/check-design-system.sh` to detect raw HTML elements and hardcoded colors. Use `--strict` flag in CI to fail on violations.

---

## What NOT To Do

1. Don't use sticky/fixed panels - Use tab navigation
2. Don't require modals for quick edits - Use inline editing
3. Don't use narrow containers - Use wide layout (120rem)
4. Don't mix display order and priority order - They're separate
5. Don't track weapon as either raid OR tome - BiS is always raid; tome is interim

---

## Core Features

- **Discord OAuth** - Login/logout with JWT tokens
- **Static Groups** - Multi-static membership with share codes
- **Role-Based Access** - Owner/Lead/Member/Viewer with permission-aware UI
- **Tier Snapshots** - Per-tier roster (M5S-M8S vs M9S-M12S)
- **Player Cards** - Inline editing, gear tracking, context menu
- **BiS Import** - XIVGear/Etro with item icons and hover cards
- **Loot Priority** - Role + need based priority scoring
- **Weapon Priority** - Multi-job weapon tracking with drag-drop reordering
- **Loot Logging** - Historical loot tracking with week navigation
- **Book/Page Tracking** - Floor-based book earning and spending ledger
- **Invitation System** - Invite links with role/expiration/max uses

---

## Additional Documentation

- **[CONSOLIDATED_STATUS.md](./docs/CONSOLIDATED_STATUS.md)** - Project status, roadmap
- **[2026-01-01-comprehensive-audit.md](./docs/audits/2026-01-01-comprehensive-audit.md)** - Codebase audit
- **[2026-01-02-ffxiv-raid-planner-parity-audit.md](./docs/audits/2026-01-02-ffxiv-raid-planner-parity-audit.md)** - Spreadsheet parity audit
- **[GEARING_REFERENCE.md](./docs/GEARING_REFERENCE.md)** - FFXIV gearing data (floor drops, tome costs)
- **[GEARING_MATH.md](./docs/GEARING_MATH.md)** - Gearing mechanics and formulas

### Implementation Plans
- **Parity Implementation:** `/home/serapis/.claude/plans/nifty-pondering-summit.md`
- **Design System Remaining Tasks:** `docs/plans/2026-01-10-remaining-design-tasks.md`
- **Design System Full Plan:** `docs/plans/2026-01-10-design-system-ux-improvements.md`

---

## Context Management

This project has automated context management via Claude Code PreCompact hooks.

### Automatic Handoff Generation
When context auto-compacts, a SESSION_HANDOFF document is automatically created at:
`frontend/docs/SESSION_HANDOFF_AUTO_{date}_{session-id}.md`

The handoff includes:
- Session ID for resuming (`claude --resume {id}`)
- Prompt for starting fresh with context
- Quick reference commands

### Manual Handoff
For complex work, create manual handoffs at `frontend/docs/SESSION_HANDOFF_{description}.md` with:
1. What was done (files changed, key decisions)
2. What's next (pending tasks, blockers)
3. Key code locations with line numbers

### Low Context Warning
When context reaches ~15-20% remaining, proactively:
1. Create a SESSION_HANDOFF summarizing progress
2. List in-progress tasks and next steps
3. Notify the user that context is low

### Hook Configuration
- Hook script: `.claude/hooks/generate-handoff.sh`
- Settings: `.claude/settings.json`
