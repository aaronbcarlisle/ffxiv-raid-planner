# FFXIV Raid Planner - Project Guide

**Status:** Phase 1-6.5 + Parity Complete | **Next:** Phase 7 (Lodestone sync), Phase 8 (FFLogs)

A web-based tool for FFXIV static raid groups to track gear progress toward BiS, manage loot distribution with priority calculations.

## Contents

[Quick Start](#quick-start) | [Commands](#commands) | [Key Files](#key-files) | [Known Issues](#known-issues)

[Project Structure](#project-structure) | [API Endpoints](#api-endpoints) | [Data Models](#data-models)

[Patterns](#key-implementation-patterns) | [Styling](#styling) | [What NOT To Do](#what-not-to-do)

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

# Backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000
cd backend && python scripts/backfill_gcd.py        # BiS preset regen
cd backend && python scripts/normalize_preset_names.py
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
| `gamedata/loot-tables.ts` | Floor drop tables |
| `gamedata/raid-tiers.ts` | Tier configuration |

---

## Known Issues (from Audit)

See [2026-01-01-comprehensive-audit.md](./docs/audits/2026-01-01-comprehensive-audit.md) for details.

### Open Items
- **P-001:** N+1 in duplicateGroup (needs bulk API)
- **P-005:** GroupView.tsx is 811 lines
- **T-001:** Low test coverage (3 test files)

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

### Tests (Phase 5 Complete)
- `pnpm test` runs 25 unit tests for calculations and priority functions
- Tests verify: iLv calculation, currentSource inference, loot adjustments

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

---

## Styling

**Theme:** Dark with teal accents (`#14b8a6`). See `index.css`.

**Role Colors:** Tank (#5a9fd4), Healer (#5ad490), Melee (#d45a5a), Ranged (#d4a05a), Caster (#b45ad4)

**Disabled State:** `opacity-50 cursor-not-allowed`

**Modal:** Uses `<div>` not native `<dialog>` (pointer event issues)

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
