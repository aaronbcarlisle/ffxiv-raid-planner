# FFXIV Raid Planner - Project Guide

## Project Overview

A free, web-based tool for FFXIV static raid groups to:
- Track gear progress toward BiS (Best in Slot)
- Manage loot distribution with priority calculations
- Sync character data from Lodestone (planned)
- Schedule raids and document strategies (planned)

---

## Current Status

**Phase 1 Frontend: Complete** | **Phase 2 UX: Complete** | **Phase 3 Backend: Complete** | **Phase 4 Auth: In Progress**

The application now has a FastAPI backend with SQLite database for local development. Data persists across page refreshes, and share codes work for sharing statics. Phase 4 is adding user accounts, multi-static membership, and per-tier roster snapshots.

### What Works (Phase 1 + Phase 2 + Phase 3)
- Static creation with 8 template player slots
- Inline player editing (name, job selection)
- Gear tracking with BiS source (Raid/Tome) and Have/Augmented states
- Gear slot icons with completion-based styling (white when complete)
- Priority score calculations based on role + need
- Loot priority lists for each floor
- Team summary with materials needed, books, completion %
- Responsive UI with dark FFXIV theme
- **Tab-based navigation** (Party/Loot/Stats) with FFXIV icons
- **Responsive 4-column grid layout** (1→2→3→4 columns at breakpoints)
- **Wide container layout** (120rem / 1920px max-width for data-tool style)
- **Global view mode toggle** (▤/☰) + individual card expansion
- **Player card needs footer** (Raid/Tome/Upgrades/Weeks)
- **Raid position system** (T1/T2/H1/H2/M1/M2/R1/R2) with role-based coloring
- **Tank role designation** (MT/OT badges)
- **Double-click name edit** on player cards
- **Right-click context menu** (Copy/Paste/Duplicate/Mark as Sub/Remove) with FFXIV icons
- **Substitute player support** - Mark players as subs with visible SUB badge
- **Tome weapon tracking** (interim upgrade during prog with calculation support)
- **Floor selector dropdown** - Compact dropdown in Loot tab only with duty name tooltips
- **Sort presets** - Standard, DPS-First, Healer-First, and Custom drag-and-drop ordering
- **Drag-and-drop reordering** - Custom sort mode with @dnd-kit for manual card ordering
- **Group view (G1/G2)** - Split players by light party based on raid positions
- **Cross-group drag position swap** - Dragging between G1/G2 auto-updates position (M1↔M2, etc.)
- **Role-based player slot templates** - Empty slots show template role with position assignment
- **Job picker role sorting** - Current role appears first when changing jobs
- **Header consolidation** - Centered static title, Add Player button in header
- **FastAPI backend** with SQLite (local dev) / PostgreSQL (production-ready)
- **Data persistence** - all changes auto-save with debounced updates
- **Share code functionality** - 6-character alphanumeric codes for sharing
- **RESTful API** with full CRUD for statics and players

### Phase 4 In Progress (User Accounts + Multi-Tier)
Based on user feedback, Phase 4 was significantly expanded to include:
- **Discord OAuth** - User accounts via Discord login
- **Multi-static membership** - Users can be in multiple statics
- **Per-tier roster snapshots** - Each raid tier has its own roster state
- **Access control** - Owner/Lead/Member/Viewer permissions
- **Dashboard UX** - Static selector + Tier selector in header

**Phase 4.1 Authentication (Partially Complete):**
- [x] Backend: User model, Discord OAuth endpoints, JWT tokens
- [x] Frontend: authStore.ts for token/user management
- [ ] Frontend: Login button, user menu, protected routes

See `docs/IMPLEMENTATION_PLAN.md` for detailed Phase 4 checklist and data model.

### What's Missing (After Phase 4)
- BiS import (Etro, XIVGear)
- Lodestone sync
- Real-time collaboration
- Production deployment

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Tailwind CSS 4 + Vite 7 |
| State | Zustand 5 |
| Backend | FastAPI (Python) + SQLAlchemy + SQLite (dev) / PostgreSQL (prod) |
| Hosting | Vercel (frontend) + Railway (backend) - *not deployed* |

---

## Quick Start

```bash
# Terminal 1: Start Backend
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2: Start Frontend
cd frontend
pnpm install
pnpm dev
```

**API:** http://localhost:8000
**Frontend:** http://localhost:5173

---

## Project Structure

```
ffxiv-raid-planner/
├── backend/                     # FastAPI Backend
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Environment configuration
│   │   ├── database.py          # SQLAlchemy async setup
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── static.py        # Static model
│   │   │   └── player.py        # Player model
│   │   ├── schemas/             # Pydantic schemas
│   │   │   ├── static.py        # Static request/response schemas
│   │   │   └── player.py        # Player request/response schemas
│   │   ├── routers/             # API route handlers
│   │   │   ├── statics.py       # Static CRUD endpoints
│   │   │   └── players.py       # Player CRUD endpoints
│   │   └── services/
│   │       └── share_code.py    # Share code generation
│   ├── data/                    # SQLite database (auto-created)
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── .env                     # Environment variables
├── frontend/
│   ├── public/
│   │   └── icons/               # FFXIV-style UI icons (transparent bg)
│   └── src/
│       ├── components/
│       │   ├── player/          # Player cards, inline edit, gear table
│       │   ├── loot/            # Loot priority, floor selector, loot mode
│       │   ├── team/            # Team summary stats
│       │   ├── layout/          # Header, layout wrapper
│       │   └── ui/              # Reusable UI components
│       ├── pages/               # Home, CreateStatic, StaticView
│       ├── services/            # API client
│       │   └── api.ts           # Backend API functions
│       ├── stores/              # Zustand state (staticStore)
│       ├── gamedata/            # Jobs, costs, loot tables, raid tiers
│       ├── utils/               # Calculations, priority logic
│       └── types/               # TypeScript interfaces
├── docs/                        # Documentation
│   ├── IMPLEMENTATION_PLAN.md   # Phase 1 roadmap
│   ├── IMPLEMENTATION_PLAN_PHASE2.md  # Phase 2 UX enhancements
│   ├── GEARING_MATH.md          # FFXIV gearing mechanics
│   └── ARCHITECTURE_SPEC.md     # API integrations
└── CLAUDE.md                    # This file
```

---

## Key UX Patterns (Phase 2)

### 1. Tab-Based Navigation

Page-level tabs with FFXIV-style icons (transparent backgrounds):

```
[🎖️ Party] [📦 Loot] [📋 Stats]    [M5S][M6S][M7S][M8S]    [▤][☰]
```

| Tab | Icon | Content |
|-----|------|---------|
| **Party** | Party Members | Player cards grid (main view) |
| **Loot** | Armoury Chest | Full-screen loot distribution with priority lists |
| **Stats** | Strategy Board | Team summary (completion %, materials, books) |

Floor selector visible in all tabs. View mode toggle (▤/☰) only visible on Party tab.

**Icons stored locally:** `public/icons/*-transparent-bg.png`

### 2. View Mode Toggle (Hybrid)

**Both mechanisms coexist:**
- Global toggle (▤/☰) switches ALL cards between compact/expanded
- Individual card click can override to expand/collapse single card
- Changing global mode resets all individual overrides

```typescript
// State
globalViewMode: 'compact' | 'expanded'  // Store
localExpanded: boolean | null           // Per-card (null = follow global)
```

### 3. Responsive 4-Column Grid

Wide container (120rem / 1920px) with responsive columns matching FFXIV's party structure:

| Breakpoint | Width | Columns | Use Case |
|------------|-------|---------|----------|
| Default | <640px | 1 | Mobile |
| sm | ≥640px | 2 | Tablet portrait |
| lg | ≥1024px | 3 | Laptop |
| 3xl | ≥1400px | 4 | Desktop (full party visible) |

```typescript
// Custom breakpoint defined in index.css
--breakpoint-3xl: 1400px;

// Grid classes in StaticView.tsx
<div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 grid-4xl">
```

**Design rationale:** Data tools (like spreadsheets) benefit from wider layouts than content sites. 4 columns at 1400px+ allows all 8 party members to be visible in 2 rows without scrolling.

### 4. Player Card Needs Footer

Always visible at bottom of every card (compact and expanded):

```
| 4 Raid Need | 1 Tome Need | 4 Upgrades | 2 Tome Wks |
```

- **Raid Need**: Raid gear pieces still missing
- **Tome Need**: Tome gear pieces still missing
- **Upgrades**: Augments needed (has item but not augmented)
- **Tome Wks**: Weeks to acquire all tome gear at 450/week cap

### 5. Double-Click Name Edit

- Double-click player name → inline text input
- Enter/blur saves, Escape cancels
- No modal required for quick name changes

### 6. Tome Weapon Tracking

BiS weapon is ALWAYS raid. But during prog, players may get tome weapon as interim upgrade.

**Weapon source options:**
- **Raid** (default): Track raid weapon only
- **Raid + Tome**: Shows sub-row for tome weapon tracking

```
| Weapon      | [Raid][Raid+Tome] | ☐ Have | —    |
| └ Tome Wep  | Tome (fixed)      | ☐ Have | ☐ Aug |
```

**Requirements for Tome Weapon:**
- 500 tomestones (~2 weeks)
- Universal Tomestone (from Floor 2 / M6S)
- Solvent for augment (from Floor 3 / M7S)

### 7. Right-Click Context Menu

Right-click on PlayerCard shows menu with FFXIV-style icons:

| Action | Icon | Description |
|--------|------|-------------|
| **Copy Player** | Copy icon | Stores player data in clipboard state |
| **Paste Player** | Paste icon | Disabled if no clipboard data; overwrites target |
| **Duplicate Player** | Duplicate icon | Creates new card with same config |
| **Remove Player** | Remove icon | Shows confirmation modal before removing |

Icons are stored locally with transparent backgrounds for better theme integration.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/stores/staticStore.ts` | All state management (players, gear, settings) |
| `src/utils/priority.ts` | Loot priority calculations |
| `src/utils/calculations.ts` | Gear completion, materials needed |
| `src/gamedata/costs.ts` | Book costs, tomestone costs |
| `src/gamedata/loot-tables.ts` | Floor drop tables |
| `src/gamedata/raid-tiers.ts` | Tier configuration (M5S-M8S current) |
| `src/gamedata/jobs.ts` | Job definitions with XIVAPI icons |

---

## Gearing Reference

### Current Tier: AAC Cruiserweight (Savage) - Patch 7.2
- Floors: M5S, M6S, M7S, M8S
- Savage gear: iLvl 760 (weapon 765)
- Tome gear: iLvl 750 (augmented 760)

### Book Costs (per slot)

| Slot | Book Edition | Cost | Weeks |
|------|--------------|------|-------|
| Weapon | IV | 8 | 8 |
| Body | III | 6 | 6 |
| Legs | III | 6 | 6 |
| Head | II | 4 | 4 |
| Hands | II | 4 | 4 |
| Feet | II | 4 | 4 |
| Accessories | I | 3 | 3 |

### Floor Drop Tables

| Floor | Gear Drops | Upgrade Materials | Special |
|-------|------------|-------------------|---------|
| 1 (M5S) | Accessories | Glaze | - |
| 2 (M6S) | Head, Hands, Feet | Glaze | **Universal Tomestone** |
| 3 (M7S) | Body, Legs | Twine, Solvent | - |
| 4 (M8S) | Weapon | - | - |

### Tomestone Costs

| Slot | Cost | Weeks at 450/wk |
|------|------|-----------------|
| Weapon | 500 | 2 (+ Universal Tomestone) |
| Body/Legs | 825 | 2 |
| Head/Hands/Feet | 495 | 1-2 |
| Accessories | 375 | 1 |

### Upgrade Materials (per player)

| Material | Upgrades | Pieces Needed |
|----------|----------|---------------|
| Twine | Head, Body, Hands, Legs, Feet | 5 |
| Glaze | Earring, Necklace, Bracelet, Rings | 5 |
| Solvent | Weapon | 1 |

**Static totals:** 40 Twine + 40 Glaze + 8 Solvent

---

## Data Models

```typescript
interface Player {
  id: string;
  staticId: string;
  name: string;
  job: string;           // 'DRG', 'WHM', etc.
  role: Role;            // Derived from job
  position?: RaidPosition;  // T1, H2, M1, etc.
  tankRole?: TankRole;      // MT or OT (tanks only)
  templateRole?: TemplateRole;  // Template slot role (Tank, Healer, etc.)
  configured: boolean;   // false for empty template slots
  sortOrder: number;     // Display order (for drag-and-drop)
  gear: GearSlotStatus[];
  tomeWeapon: TomeWeaponStatus;
  isSubstitute: boolean;
  notes?: string;
  bisLink?: string;
  lodestoneId?: string;
}

interface GearSlotStatus {
  slot: GearSlot;
  bisSource: 'raid' | 'tome';
  hasItem: boolean;
  isAugmented: boolean;  // Only relevant for tome pieces
}

interface TomeWeaponStatus {
  pursuing: boolean;     // "Raid + Tome" selected
  hasItem: boolean;      // Got the tome weapon
  isAugmented: boolean;  // Augmented it
}

interface StaticSettings {
  displayOrder: Role[];     // Card sort order
  lootPriority: Role[];     // Who gets loot first
  timezone: string;
}

type PageMode = 'players' | 'loot' | 'stats';
type ViewMode = 'compact' | 'expanded';
type Role = 'tank' | 'healer' | 'melee' | 'ranged' | 'caster';
type RaidPosition = 'T1' | 'T2' | 'H1' | 'H2' | 'M1' | 'M2' | 'R1' | 'R2';
type TankRole = 'MT' | 'OT';
type TemplateRole = 'Tank' | 'Healer' | 'Melee' | 'Ranged' | 'Caster';
type SortPreset = 'standard' | 'dps-first' | 'healer-first' | 'custom';
type GearSlot = 'weapon' | 'head' | 'body' | 'hands' | 'legs' | 'feet' |
                'earring' | 'necklace' | 'bracelet' | 'ring1' | 'ring2';
```

---

## Priority System

### Display Order (party list style)
Tank > Healer > Melee > Ranged > Caster

### Loot Priority Order (who gets gear first)
Melee > Ranged > Caster > Tank > Healer

### Priority Score Calculation

```typescript
const ROLE_PRIORITY_SCORES = {
  melee: 125,
  ranged: 100,
  caster: 75,
  tank: 50,
  healer: 25
};

function calculatePriorityScore(player): number {
  const roleScore = ROLE_PRIORITY_SCORES[player.role];
  const stats = calculatePlayerNeeds(player);
  const needScore =
    stats.raidItems * 8 +
    stats.tomeItems * 4 +
    stats.upgrades * 6;
  return roleScore + needScore;
}
```

---

## Component Architecture

### Player Components
- `PlayerCard.tsx` - Expandable card with compact/full views, context menu, job picker
- `SortablePlayerCard.tsx` - Drag-and-drop wrapper for PlayerCard
- `InlinePlayerEdit.tsx` - Name/job form for configuring slots
- `EmptySlotCard.tsx` - Role-based placeholder for unconfigured template slots
- `RoleJobSelector.tsx` - Job selection with template role filtering and "Other jobs" picker
- `GearTable.tsx` - 11-slot gear editor with source/have/augmented
- `WeaponSlotRow.tsx` - Special weapon row with tome weapon sub-row
- `NeedsFooter.tsx` - 4-stat footer (raid/tome/upgrades/weeks)
- `PositionSelector.tsx` - Raid position (T1/H2/M1/etc.) selector
- `TankRoleSelector.tsx` - MT/OT designation selector

### Loot Components
- `LootPriorityPanel.tsx` - Priority lists for floor drops
- `LootModeView.tsx` - Full-screen loot distribution view
- `LootItemCard.tsx` - Individual item with priority list
- `FloorSelector.tsx` - M5S-M8S tab buttons
- `SummaryPanel.tsx` - Tabs for Loot Priority and Team Stats (legacy)

### Team Components
- `TeamSummary.tsx` - Aggregated stats (completion %, materials, books)
- `StatsView.tsx` - Full-page stats view

### UI Components
- `TabNavigation.tsx` - Page-level tab buttons with FFXIV icons
- `ViewModeToggle.tsx` - ▤/☰ toggle component
- `SortModeSelector.tsx` - Sort preset dropdown (Standard/DPS-First/etc.)
- `GroupViewToggle.tsx` - G1/G2 group view toggle
- `ContextMenu.tsx` - Right-click menu component with FFXIV icons
- `Modal.tsx` - Confirmation dialogs
- `Toast.tsx` - Temporary notification messages
- `JobIcon.tsx` - XIVAPI job icons with fallback

---

## Implementation Notes

### Ring Handling
- FFXIV restricts wearing two identical raid rings
- One ring is typically tome, one is raid
- Priority calculations consolidate to "Ring" (not ring1/ring2)

### Gear Completion Logic
```typescript
function isSlotComplete(slot: GearSlotStatus): boolean {
  if (slot.bisSource === 'raid') {
    return slot.hasItem;
  }
  return slot.hasItem && slot.isAugmented;
}
```

### Tome Weeks Calculation
```typescript
function calculateTomeWeeks(player: Player): number {
  const TOME_CAP = 450;
  let totalNeeded = 0;

  for (const slot of player.gear) {
    if (slot.bisSource === 'tome' && !slot.hasItem) {
      totalNeeded += TOME_COSTS[slot.slot];
    }
  }

  if (player.tomeWeapon?.pursuing && !player.tomeWeapon.hasItem) {
    totalNeeded += 500; // Weapon cost
  }

  return Math.ceil(totalNeeded / TOME_CAP);
}
```

### Book Edition IV Conversion
- Floor 4 books can convert 1:1 to any lower edition
- This provides flexibility for players to accelerate specific slots

### Cross-Group Drag Position Swap
When dragging players between light party groups (G1/G2), the position automatically updates:

```typescript
// Helper functions in staticStore.ts
function getGroupFromPosition(position: RaidPosition): 1 | 2 {
  return position.endsWith('1') ? 1 : 2;
}

function swapPositionGroup(position: RaidPosition): RaidPosition {
  const role = position.charAt(0); // T, H, M, or R
  const currentNum = position.charAt(1);
  const newNum = currentNum === '1' ? '2' : '1';
  return `${role}${newNum}` as RaidPosition;
}

// In reorderPlayers: detect cross-group move and swap position
if (activeGroup !== overGroup) {
  newPosition = swapPositionGroup(activePlayer.position);
}
```

This allows fluid party composition changes without manual position reassignment.

### Layout Shift Prevention Pattern
When swapping contextual controls (e.g., floor selector in Loot tab vs view toggle in Players tab), use this pattern to prevent layout shift:

```tsx
<div className="relative flex items-center justify-end">
  {/* Largest element in normal flow - determines container size */}
  <div className={pageMode !== 'loot' ? 'invisible' : ''}>
    <FloorSelector ... />
  </div>
  {/* Smaller elements absolutely positioned to overlap */}
  <div className={`absolute right-0 ${pageMode !== 'players' ? 'invisible' : ''}`}>
    <ViewModeToggle ... />
  </div>
</div>
```

Key principles:
- Use `invisible` instead of conditional rendering (keeps element in DOM)
- Largest control in normal flow determines container dimensions
- Smaller controls use `absolute` positioning to overlap same space

---

## Styling

### Colors
```css
--bg-primary: #0a0a12;
--bg-card: rgba(20, 20, 30, 0.9);
--accent-gold: #c9a227;
--role-tank: #4a90c2;
--role-healer: #4ab87a;
--role-melee: #c24a4a;
--role-ranged: #c29a4a;
--role-caster: #a24ac2;
--source-raid: #c44444;
--source-tome: #44aa44;
```

### Typography
- Headers: Cinzel (Google Fonts)
- Body: System fonts

---

## What NOT To Do

1. **Don't use sticky/fixed panels** - Use tab navigation instead
2. **Don't require modals for quick edits** - Use inline editing
3. **Don't use narrow containers** - Use wide layout (120rem) for data tools
4. **Don't limit grid columns** - Support 4 columns at 1400px+ for full party view
5. **Don't mix display order and priority order** - They're separate concepts
6. **Don't track weapon as either raid OR tome** - BiS is always raid; tome is interim
7. **Don't break Tailwind arbitrary values** - Use custom CSS for complex breakpoints

---

## Phase Roadmap

| Phase | Status | Features |
|-------|--------|----------|
| 1 | Complete | Core tracking, player cards, gear tables, priority |
| 2 | Complete | Tab navigation, view modes, needs footer, context menu, FFXIV icons, raid positions, tome weapon |
| 3 | Complete | FastAPI backend, SQLite/PostgreSQL, data persistence, share codes |
| 4 | **In Progress** | Discord OAuth, multi-static membership, per-tier roster snapshots, access control, dashboard |
| 5 | Planned | BiS import (Etro, XIVGear), Balance presets |
| 6 | Planned | Lodestone auto-sync |
| 7 | Planned | Loot distribution + real-time collaboration |
| 8 | Planned | Scheduling + strategies |
| 9 | Planned | FFLogs integration |
| 10 | Planned | Discord bot, PWA offline mode |

---

## XIVAPI Integration

### UI Icons (Tab Navigation & Context Menu)

FFXIV MainCommand icons are used for the UI, stored locally with transparent backgrounds:

**Tab Navigation Icons** (from XIVAPI, edited for transparent bg):
| Tab | XIVAPI Icon ID | Local Path |
|-----|----------------|------------|
| Party | 000017 (Party Members) | `/icons/party-transparent-bg.png` |
| Loot | 000032 (Armoury Chest) | `/icons/loot-transparent-bg.png` |
| Stats | 000095 (Strategy Board) | `/icons/stats-transparent-bg.png` |

**Context Menu Icons**:
| Action | XIVAPI Icon ID | Local Path |
|--------|----------------|------------|
| Copy | 000047 | `/icons/copy-transparent-bg.png` |
| Paste | 000080 | `/icons/paste-transparent-bg.png` |
| Duplicate | 019692 | `/icons/duplicate-transparent-bg.png` |
| Remove | 000026 | `/icons/remove-transparent-bg.png` |

Icon constants defined in `src/types/index.ts`:
- `TAB_ICONS` - Tab navigation icons
- `CONTEXT_MENU_ICONS` - Right-click menu icons

### Gear Slot Icons

Two icon sets are available from XIVAPI for gear slots:

**1. Gear Slot Placeholder Icons** (outline/silhouette style) - Currently used:
```
https://xivapi.com/img-misc/gear/head.png
https://xivapi.com/img-misc/gear/body.png
https://xivapi.com/img-misc/gear/hands.png
https://xivapi.com/img-misc/gear/legs.png
https://xivapi.com/img-misc/gear/feet.png
https://xivapi.com/img-misc/gear/ear.png
https://xivapi.com/img-misc/gear/neck.png
https://xivapi.com/img-misc/gear/wrist.png
https://xivapi.com/img-misc/gear/ring.png
https://xivapi.com/img-misc/gear/mainhand.png
```

**Completion-based styling:**
- Default (empty): 50% opacity grey
- Raid gear + Have: White (`brightness-0 invert opacity-90`)
- Tome gear + Have: 50% white (`brightness-0 invert opacity-50`)
- Tome gear + Have + Aug: Full white (`brightness-0 invert opacity-90`)

**2. ItemUICategory Icons** (colorful/filled) - For future use:
```
https://xivapi.com/i/060000/060124.png  // Head
https://xivapi.com/i/060000/060126.png  // Body
https://xivapi.com/i/060000/060129.png  // Hands
https://xivapi.com/i/060000/060128.png  // Legs
https://xivapi.com/i/060000/060130.png  // Feet
https://xivapi.com/i/060000/060133.png  // Earring
https://xivapi.com/i/060000/060132.png  // Necklace
https://xivapi.com/i/060000/060134.png  // Bracelet
https://xivapi.com/i/060000/060135.png  // Ring
https://xivapi.com/i/060000/060102.png  // Weapon (Gladiator's Arm)
```

### Future Feature: Dynamic BiS Item Icons (Phase 4+)

When Etro/XIVGear integration is added, gear slots could show:
- **Empty state**: Placeholder icon (outline style) when slot needs to be filled
- **Have state**: Actual BiS item icon from XIVAPI when "Have" is checked

This would require:
1. Parsing BiS link to extract item IDs
2. Fetching item icons from XIVAPI: `https://xivapi.com/i/{folder}/{icon}.png`
3. Storing item icon URLs in GearSlotStatus
4. Conditionally rendering placeholder vs actual item icon

Icon constants defined in `src/types/index.ts`:
- `GEAR_SLOT_ICONS` - Current placeholder/outline icons
- `GEAR_SLOT_FILLED_ICONS` - For future BiS item display

---

## Commands

```bash
# Backend Development
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend Development
cd frontend && pnpm dev

# Build
cd frontend && pnpm build

# Type check
cd frontend && pnpm tsc --noEmit

# Lint
cd frontend && pnpm lint

# Format
cd frontend && pnpm format
```

---

## API Endpoints

### Core (Phase 1-3)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/statics` | Create static (returns with shareCode) |
| GET | `/api/statics/{shareCode}` | Get static by share code |
| PUT | `/api/statics/{id}` | Update static |
| DELETE | `/api/statics/{id}` | Delete static |
| POST | `/api/statics/{id}/players` | Add player |
| PUT | `/api/statics/{id}/players/{playerId}` | Update player |
| DELETE | `/api/statics/{id}/players/{playerId}` | Remove player |

### Authentication (Phase 4)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/discord` | Get Discord OAuth URL |
| POST | `/api/auth/discord/callback` | Handle OAuth callback, return tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/me` | Get current user info |

### Phase 4 Endpoints (Coming)
See `docs/IMPLEMENTATION_PLAN.md` for full Phase 4 endpoint documentation including:
- Static groups management
- Memberships and invitations
- Tier snapshots and rollover
- Legacy static migration
