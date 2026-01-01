# FFXIV Raid Planner - Project Guide

## Project Overview

A web-based tool for FFXIV static raid groups to track gear progress toward BiS, manage loot distribution with priority calculations, and (planned) sync with Lodestone/FFLogs.

**Status:** Phase 1-6.5 Complete | Ready for Production

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Tailwind CSS 4 + Vite 7 |
| State | Zustand 5 |
| Backend | FastAPI (Python) + SQLAlchemy + SQLite (dev) / PostgreSQL (prod) |

---

## Quick Start

```bash
# Start both servers
./dev.sh              # Kills existing, starts fresh
./dev.sh stop         # Stop both servers
./dev.sh logs         # Tail both log files

# Or manually:
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000
cd frontend && pnpm dev
```

**API:** http://localhost:8000 | **Frontend:** http://localhost:5173

---

## Project Structure

```
ffxiv-raid-planner/
├── backend/
│   ├── app/
│   │   ├── main.py, config.py, database.py, constants.py
│   │   ├── models/        # User, StaticGroup, Membership, TierSnapshot, SnapshotPlayer
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── routers/       # auth, static_groups, tiers
│   │   └── services/      # share_code generation
│   ├── scripts/           # backfill_gcd.py, normalize_preset_names.py
│   └── data/              # SQLite database, local_bis_presets.json
├── frontend/src/
│   ├── components/
│   │   ├── player/           # PlayerCard, GearTable, BiSImportModal, etc.
│   │   ├── loot/             # LootPriorityPanel, FloorSelector, QuickLogDropModal
│   │   ├── history/          # HistoryView, LootLogPanel, PageBalancesPanel
│   │   ├── weapon-priority/  # WeaponPriorityModal, WeaponPriorityEditor
│   │   ├── team/             # TeamSummary
│   │   ├── static-group/     # StaticSwitcher, TierSelector, GroupSettingsModal
│   │   ├── auth/             # LoginButton, UserMenu
│   │   └── ui/               # Modal, Toast, ContextMenu, TabNavigation
│   ├── pages/                # Home, Dashboard, GroupView, AuthCallback
│   ├── stores/               # authStore, staticGroupStore, tierStore, lootTrackingStore
│   ├── gamedata/             # jobs, costs, loot-tables, raid-tiers
│   ├── utils/                # calculations, priority, lootCoordination, weaponPriority
│   └── types/
└── docs/                     # Implementation plans, gearing math
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
| `utils/lootCoordination.ts` | Cross-store loot/gear sync utilities |
| `utils/weaponPriority.ts` | Weapon priority scoring |
| `utils/calculations.ts` | Gear completion, materials needed |
| `gamedata/costs.ts` | Book costs, tomestone costs |
| `gamedata/loot-tables.ts` | Floor drop tables |
| `gamedata/raid-tiers.ts` | Tier configuration |

---

## Core Features

- **Discord OAuth** - Login/logout with JWT tokens
- **Static Groups** - Multi-static membership with share codes
- **Role-Based Access** - Owner/Lead/Member/Viewer with permission-aware UI
- **Tier Snapshots** - Per-tier roster (M5S-M8S vs M9S-M12S)
- **Player Cards** - Inline editing, gear tracking, context menu
- **BiS Import** - XIVGear/Etro with item icons and hover cards
- **Loot Priority** - Role + need based priority scoring with enhanced modifiers
- **Weapon Priority** - Multi-job weapon tracking with drag-drop reordering
- **Loot Logging** - Historical loot tracking with week navigation
- **Book/Page Tracking** - Floor-based book earning and spending ledger
- **Invitation System** - Invite links with role/expiration/max uses
- **Tier-Specific Sharing** - Share links include tier selection via URL param

---

## Data Models

```typescript
interface SnapshotPlayer {
  id: string;
  tierSnapshotId: string;
  userId?: string;
  user?: { id: string; discordId: string; username: string; avatarUrl?: string };
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

interface WeaponPriority {
  job: string;           // Job code (e.g., 'PLD', 'DRG')
  received: boolean;     // Whether weapon has been obtained
  receivedDate?: string; // ISO date when received
}

interface GearSlotStatus {
  slot: GearSlot;
  bisSource: 'raid' | 'tome';
  hasItem: boolean;
  isAugmented: boolean;
  itemName?: string;
  itemLevel?: number;
  itemIcon?: string;
  itemStats?: ItemStats;
}

interface TomeWeaponStatus {
  pursuing: boolean;     // "Raid + Tome" selected
  hasItem: boolean;
  isAugmented: boolean;
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

**Enforcement:** Destructive actions disabled upfront with tooltips. Edit actions fail gracefully with toast notifications. Backend always validates (defense in depth).

---

## Priority System

**Display Order:** Tank > Healer > Melee > Ranged > Caster
**Loot Priority:** Melee > Ranged > Caster > Tank > Healer

```typescript
const ROLE_PRIORITY_SCORES = { melee: 125, ranged: 100, caster: 75, tank: 50, healer: 25 };
// Base Priority = roleScore + (raidItems * 8) + (tomeItems * 4) + (upgrades * 6)

// Enhanced Priority (when loot history available):
// - No Drops Bonus: +10 per week without drops (max +50)
// - Fair Share Adjustment: -15 per drop above average (max -45)
// Final = basePriority + droughtBonus - balancePenalty
```

### Weapon Priority Scoring

Main job always wins via a 2000-point bonus. This ensures:
- PLD will always get PLD weapon before a DRG who has PLD as an alt weapon
- Main job is implicitly included even if not explicitly in the priority list

```typescript
// weaponPriority.ts scoring:
const roleScore = (5 - roleIndex) * 100;     // 0-400 based on role
const rankScore = 1000 - (rank * 100);       // 1000 for rank 0, 900 for rank 1, etc.
const mainJobBonus = isMainJob ? 2000 : 0;   // Main job always wins
const total = roleScore + rankScore + mainJobBonus;
```

---

## Gearing Reference

### Current Tier: AAC Heavyweight (Savage) - Patch 7.4
- Floors: M9S, M10S, M11S, M12S
- Savage gear: iLvl 790 (weapon 795)
- Tome gear: iLvl 780 (augmented 790)

### Floor Drops

| Floor | Gear | Materials | Special |
|-------|------|-----------|---------|
| M9S | Accessories | Glaze | - |
| M10S | Head, Hands, Feet | Glaze | Universal Tomestone |
| M11S | Body, Legs | Twine, Solvent | - |
| M12S | Weapon | - | - |

### Tome Costs

| Slot | Cost | Weeks |
|------|------|-------|
| Weapon | 500 | 2 (+Univ) |
| Body/Legs | 825 | 2 |
| Head/Hands/Feet | 495 | 1-2 |
| Accessories | 375 | 1 |

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
- `GET .../tiers/{tierId}/loot-log?week=N` - Get loot log entries
- `POST .../tiers/{tierId}/loot-log` - Create loot log entry
- `DELETE .../tiers/{tierId}/loot-log/{id}` - Delete entry
- `GET .../tiers/{tierId}/page-balances` - Get player book balances
- `GET .../tiers/{tierId}/page-ledger?week=N` - Get page ledger entries
- `POST .../tiers/{tierId}/page-ledger` - Create ledger entry
- `POST .../tiers/{tierId}/mark-floor-cleared` - Batch add book earnings
- `GET .../tiers/{tierId}/current-week` - Get current/max week

---

## Key Implementation Patterns

### Reset Gear Options
Three presets handling field dependencies:
1. **Reset progress** (default) - Uncheck hasItem/isAugmented, keep BiS config
2. **Unlink BiS** - Clear bisLink and item metadata, keep progress
3. **Reset everything** - Complete wipe to defaults

### Tome Weapon Tracking
- BiS weapon is ALWAYS raid
- Toggle "Raid + Tome" to track interim tome weapon
- Aug column shows `—` (raid only) or `+` (tracking tome)

### Ring Handling
- FFXIV restricts two identical raid rings
- One ring typically tome (ring2 default), one raid

### Cross-Group Drag
Dragging between G1/G2 auto-swaps position (T1↔T2, H1↔H2, etc.)

### Modal + DnD
When modals open, set drag sensor distance to 999999 to disable dragging.

### UI State Persistence
Several UI states persist to localStorage:
- `group-view-tab` - Selected main tab (Roster/Loot/Progress/History)
- `loot-priority-subtab` - Selected sub-tab (Gear Priority/Weapon Priority)
- `history-week-{groupId}-{tierId}` - Selected week per tier
- `selected-tier-{groupId}` - Selected tier per group
- `party-view-mode` - Compact vs expanded player cards
- `sort-preset-{tierId}` - Sort preset per tier

### Tier-Specific Share Links
Share links can include tier selection:
- Shift+Click on share code copies URL with `?tier=` parameter
- URL format: `/group/{shareCode}?tier={tierId}`
- On load: URL param > localStorage > active tier > first tier
- URL param is cleared after use (refreshing uses localStorage)

### Loot Coordination
`lootCoordination.ts` provides cross-store utilities:
- `logLootAndUpdateGear()` - Creates loot entry + updates gear checkbox
- `deleteLootAndRevertGear()` - Deletes entry + reverts gear checkbox
- Weapon priority auto-updates when weapon logged

---

## Styling

**Theme:** Dark with teal accents (`#14b8a6`). See `index.css` for full palette.

**Role Colors:** Tank (#5a9fd4), Healer (#5ad490), Melee (#d45a5a), Ranged (#d4a05a), Caster (#b45ad4)

**Disabled State:** `opacity-50 cursor-not-allowed`, no hover effects

**Modal:** Uses `<div>` not native `<dialog>` (pointer event issues)

---

## XIVAPI Integration

**BiS Import Flow:**
1. Fetch item IDs from XIVGear/Etro
2. Fetch item details from `beta.xivapi.com/api/1/sheet/Item/{id}`
3. Extract icon URL and stats, store in GearSlotStatus

**BiS Presets:** Combined from The Balance (local JSON) + GitHub static-bis-sets repo. All 21 jobs covered.

**Gear Slot Icons:** `https://xivapi.com/img-misc/gear/{slot}.png`

---

## What NOT To Do

1. Don't use sticky/fixed panels - Use tab navigation
2. Don't require modals for quick edits - Use inline editing
3. Don't use narrow containers - Use wide layout (120rem)
4. Don't mix display order and priority order - They're separate
5. Don't track weapon as either raid OR tome - BiS is always raid; tome is interim

---

## Phase Roadmap

| Phase | Status | Features |
|-------|--------|----------|
| 1-3 | Complete | Core tracking, UI, FastAPI backend |
| 4 | Complete | Discord OAuth, multi-static, tiers, invitations |
| 5 | Complete | BiS import, presets, item icons, hover cards |
| 6 | Complete | Permission-aware UI, Reset Gear options |
| 6.5 | Complete | Loot logging, weapon priority, book tracking, inline logging, UI persistence |
| 7 | Planned | Lodestone auto-sync |
| 8 | Planned | FFLogs integration |

---

## Commands

```bash
# Development
./dev.sh              # Start both servers
pnpm dev              # Frontend only
pnpm build            # Production build
pnpm tsc --noEmit     # Type check
pnpm lint             # ESLint

# BiS Preset Regeneration
cd backend && python scripts/backfill_gcd.py
cd backend && python scripts/normalize_preset_names.py
```

---

## Documentation Maintenance

- Update CLAUDE.md when planning features or completing work
- Update `docs/CONSOLIDATED_STATUS.md` when features are completed or new issues discovered
- Keep Phase Roadmap current in CONSOLIDATED_STATUS.md
- Never commit without verifying documentation is current

## Additional Documentation

- **[CONSOLIDATED_STATUS.md](./docs/CONSOLIDATED_STATUS.md)** - Current project status, roadmap, technical debt tracking
- **[GEARING_MATH.md](./docs/GEARING_MATH.md)** - FFXIV gearing mechanics and formulas reference
- **[archive/](./docs/archive/)** - Historical planning documents and audit reports
