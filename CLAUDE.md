# FFXIV Raid Planner - Project Guide

## Project Overview

A free, web-based tool for FFXIV static raid groups to:
- Track gear progress toward BiS (Best in Slot)
- Manage loot distribution with priority calculations
- Sync character data from Lodestone (planned)
- Schedule raids and document strategies (planned)

---

## Current Status

**Phase 1-4: Complete** | **Ready for Production**

The application is a full auth-first system with Discord OAuth, multi-static membership, and per-tier roster snapshots.

### What Works
- **Discord OAuth** - Full login/logout with JWT tokens
- **User Dashboard** (`/dashboard`) - View, create, and manage static groups
  - Grid/list view toggle (persisted to localStorage)
  - Copy button on cards (Shift+click for full URL)
  - Duplicate static copies all tiers and configured players
- **Static Groups** - Multi-static membership with share codes
- **Role-Based Access** - Owner/Lead/Member/Viewer permissions
- **Invitation System** - Invite links for joining statics (`/invite/{code}`)
  - Create invitations with role, expiration, and max uses
  - Accept invitations via link (requires Discord login)
  - Manage invitations in Group Settings modal
- **Take Ownership** - Link Discord account to a player card
  - Right-click context menu "Take Ownership" / "Release Ownership"
  - Shows "You" badge and user avatar on owned cards
  - Dashboard shows both memberships and linked statics
  - Owners can unlink any user from Group Settings
- **Tier Snapshots** - Per-tier roster (e.g., M1S-M4S vs M5S-M8S)
- **GroupView** (`/group/{shareCode}`) - Full player card editing with gear tracking
- **Tier Management** - Create, switch, rollover, delete tiers
- **Group Settings** - Rename, toggle public/private, manage invitations, delete groups
- **Home Page** - Recent statics for logged-in users, feature cards for visitors
- Static creation with 8 template player slots
- Inline player editing (name, job selection)
- Gear tracking with BiS source (Raid/Tome) and Have/Augmented states
- Priority score calculations based on role + need
- Loot priority lists for each floor
- Team summary with materials needed, books, completion %
- Tab-based navigation (Party/Loot/Stats) with FFXIV icons
- Responsive 4-column grid layout
- View mode toggle (compact/expanded)
- Raid position system (T1/T2/H1/H2/M1/M2/R1/R2)
- Context menu (Copy/Paste/Duplicate/Mark as Sub/Remove)
- Sort presets and drag-and-drop reordering (optimistic updates)
- Group view (G1/G2) light party split with cross-group position swap
- FastAPI backend with SQLite (dev) / PostgreSQL (prod)
- Share code functionality (copy button with Shift for full URL)
- **BiS Import** - Import gear sets from XIVGear
  - Predefined BiS presets dropdown (from The Balance via xiv-gear-planner/static-bis-sets)
  - Supports XIVGear share links, UUIDs, and curated BiS URLs
  - Preview changes before importing with job mismatch warnings
  - BiS link badge on player card header (opens XIVGear in new tab)
  - Context menu shows "Update BiS" / "Unlink BiS" when player has linked set

### Architecture

**Key Stores:**
- `authStore.ts` - Discord OAuth tokens, current user
- `staticGroupStore.ts` - Static groups, membership
- `tierStore.ts` - Tier snapshots, players within tiers

**API Endpoints (New System):**
```
POST /api/auth/discord           # Initiate Discord OAuth
GET  /api/auth/discord/callback  # Handle callback
GET  /api/auth/me                # Get current user

GET    /api/static-groups                    # List user's groups
POST   /api/static-groups                    # Create new group
GET    /api/static-groups/by-code/{code}     # Viewer access
PUT    /api/static-groups/{id}               # Update group
DELETE /api/static-groups/{id}               # Delete group

GET    /api/static-groups/{id}/tiers              # List tier snapshots
POST   /api/static-groups/{id}/tiers              # Create tier snapshot
GET    /api/static-groups/{id}/tiers/{tierId}     # Get tier with players
PUT    /api/static-groups/{id}/tiers/{tierId}     # Update tier
DELETE /api/static-groups/{id}/tiers/{tierId}     # Delete tier
POST   /api/static-groups/{id}/tiers/{tierId}/rollover  # Copy roster

PUT    /api/static-groups/{id}/tiers/{tierId}/players/{id}  # Update player
```

### What's Next
- BiS presets by job (predefined BiS dropdown)
- Item icons from BiS with hover cards
- Lodestone auto-sync
- FFLogs integration
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
│   │   ├── constants.py         # Shared constants and factory functions
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── user.py          # User model (Discord OAuth)
│   │   │   ├── static_group.py  # Static group model
│   │   │   ├── membership.py    # Group membership model
│   │   │   ├── tier_snapshot.py # Tier snapshot model
│   │   │   └── snapshot_player.py # Player within tier model
│   │   ├── schemas/             # Pydantic schemas
│   │   │   ├── user.py          # User request/response schemas
│   │   │   ├── static_group.py  # Static group schemas
│   │   │   └── tier_snapshot.py # Tier and player schemas
│   │   ├── routers/             # API route handlers
│   │   │   ├── auth.py          # Discord OAuth endpoints
│   │   │   ├── static_groups.py # Static group CRUD
│   │   │   └── tiers.py         # Tier and player endpoints
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
│       ├── pages/               # Home, Dashboard, GroupView, AuthCallback
│       ├── services/            # API client utilities
│       │   └── api.ts           # API helpers (health check, debounce)
│       ├── stores/              # Zustand state (authStore, staticGroupStore, tierStore)
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
| **Import BiS** / **Update BiS** | Upload icon | Opens BiS import modal (label changes if player has linked BiS) |
| **Copy Player** | Copy icon | Stores player data in clipboard state |
| **Paste Player** | Paste icon | Disabled if no clipboard data; overwrites target |
| **Duplicate Player** | Duplicate icon | Creates new card with same config |
| **Take Ownership** | - | Link your Discord account to this player card |
| **Release Ownership** | - | Unlink yourself from this player card |
| **Unlink User** | - | Owner-only: remove another user's link |
| **Mark as Sub** | - | Toggle substitute player status |
| **Reset Gear** | - | Reset all gear to unchecked state |
| **Remove Player** | Remove icon | Shows confirmation modal before removing |

Icons are stored locally with transparent backgrounds for better theme integration.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/stores/authStore.ts` | Discord OAuth, user state |
| `src/stores/staticGroupStore.ts` | Static groups, membership |
| `src/stores/tierStore.ts` | Tier snapshots, players |
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
// Player in a tier snapshot
interface SnapshotPlayer {
  id: string;
  tierSnapshotId: string;
  userId?: string;        // Link to user account (optional)
  user?: {                // Populated when userId is set
    id: string;
    discordId: string;
    username: string;
    avatarUrl?: string;
  };
  name: string;
  job: string;           // 'DRG', 'WHM', etc.
  role: string;          // 'tank', 'healer', 'melee', 'ranged', 'caster'
  position?: RaidPosition;  // T1, H2, M1, etc.
  tankRole?: TankRole;      // MT or OT (tanks only)
  templateRole?: TemplateRole;  // Template slot role
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
  itemName?: string;     // From BiS import
  itemLevel?: number;    // From BiS import
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

### Static Group Components (`components/static-group/`)
- `StaticSwitcher.tsx` - Static dropdown for quick group switching (shows in header)
- `GroupSettingsModal.tsx` - Rename, toggle public/private, delete group
- `TierSelector.tsx` - Tier dropdown (select tier within group)
- `CreateTierModal.tsx` - Select and create new tier snapshot
- `DeleteTierModal.tsx` - Confirm tier deletion
- `RolloverDialog.tsx` - Copy roster to new tier with gear reset option

### Auth Components (`components/auth/`)
- `LoginButton.tsx` - Discord OAuth login button
- `UserMenu.tsx` - User avatar dropdown with logout

### Player Components (`components/player/`)
- `PlayerCard.tsx` - Expandable card with compact/full views, context menu, job picker, BiS badge
- `DroppablePlayerCard.tsx` - Drag-and-drop wrapper for PlayerCard
- `InlinePlayerEdit.tsx` - Name/job form for configuring slots
- `EmptySlotCard.tsx` - Role-based placeholder for unconfigured template slots
- `RoleJobSelector.tsx` - Job selection with template role filtering
- `GearTable.tsx` - 11-slot gear editor with source/have/augmented
- `WeaponSlotRow.tsx` - Special weapon row with tome weapon sub-row
- `NeedsFooter.tsx` - 4-stat footer (raid/tome/upgrades/weeks)
- `PositionSelector.tsx` - Raid position selector
- `TankRoleSelector.tsx` - MT/OT designation selector
- `BiSImportModal.tsx` - Modal for importing BiS from XIVGear

### Loot Components (`components/loot/`)
- `LootPriorityPanel.tsx` - Priority lists for floor drops
- `FloorSelector.tsx` - M5S-M8S tab buttons
- `SummaryPanel.tsx` - Combined loot/stats view

### Team Components (`components/team/`)
- `TeamSummary.tsx` - Aggregated stats (completion %, materials, books)

### UI Components (`components/ui/`)
- `TabNavigation.tsx` - Page-level tab buttons with FFXIV icons
- `ViewModeToggle.tsx` - ▤/☰ toggle component
- `SortModeSelector.tsx` - Sort preset dropdown
- `GroupViewToggle.tsx` - G1/G2 group view toggle
- `ContextMenu.tsx` - Right-click menu component
- `Modal.tsx` - Confirmation dialogs
- `Toast.tsx` - Notification messages
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

### Design Theme: Teal Glow

The application uses a dark theme with teal accents and subtle glow effects.

### Color Palette
```css
/* Backgrounds - Deep blacks with cool undertone */
--color-bg-primary: #050508;
--color-bg-secondary: #0a0a0f;
--color-bg-card: #0e0e14;
--color-bg-elevated: #121218;
--color-bg-hover: #18181f;

/* Accent - Teal gradient */
--color-accent: #14b8a6;
--color-accent-dim: rgba(20, 184, 166, 0.15);
--color-accent-bright: #2dd4bf;
--color-accent-muted: #0d7377;
--color-accent-deep: #0891b2;

/* Roles - FFXIV standard colors */
--color-role-tank: #5a9fd4;
--color-role-healer: #5ad490;
--color-role-melee: #d45a5a;
--color-role-ranged: #d4a05a;
--color-role-caster: #b45ad4;

/* Gear Sources */
--color-source-raid: #ef4444;
--color-source-tome: #14b8a6;  /* Matches accent */
--color-source-crafted: #a78bfa;
--color-source-augmented: #fbbf24;

/* Status */
--color-status-success: #22c55e;
--color-status-warning: #eab308;
--color-status-error: #ef4444;
--color-status-info: #14b8a6;
```

### Typography
- Display/Headers: Inter (Google Fonts)
- Body: Inter, system-ui fallback
- Monospace: JetBrains Mono (for numbers, codes)

### Glow Effects
```css
/* Logo/icon glow */
.glow-teal {
  filter: drop-shadow(0 0 8px rgba(20, 184, 166, 0.4));
}

/* Card hover glow */
.card-glow:hover {
  box-shadow: 0 0 20px rgba(20, 184, 166, 0.1);
  border-color: rgba(20, 184, 166, 0.3);
}

/* Active/selected state */
.border-glow {
  box-shadow: inset 0 0 0 1px rgba(20, 184, 166, 0.3),
              0 0 15px rgba(20, 184, 166, 0.1);
}
```

### Badge Styles
| Type | Background | Text | Border |
|------|------------|------|--------|
| Raid | `rgba(239, 68, 68, 0.2)` | `#f87171` | `rgba(239, 68, 68, 0.4)` |
| Tome | `rgba(20, 184, 166, 0.2)` | `#2dd4bf` | `rgba(20, 184, 166, 0.4)` |
| Crafted | `rgba(167, 139, 250, 0.2)` | `#c4b5fd` | `rgba(167, 139, 250, 0.4)` |
| Augmented | `rgba(251, 191, 36, 0.2)` | `#fcd34d` | `rgba(251, 191, 36, 0.4)` |

---

## What NOT To Do

1. **Don't use sticky/fixed panels** - Use tab navigation instead
2. **Don't require modals for quick edits** - Use inline editing
3. **Don't use narrow containers** - Use wide layout (120rem) for data tools
4. **Don't limit grid columns** - Support 4 columns at 1400px+ for full party view
5. **Don't mix display order and priority order** - They're separate concepts
6. **Don't track weapon as either raid OR tome** - BiS is always raid; tome is interim
7. **Don't break Tailwind arbitrary values** - Use custom CSS for complex breakpoints
8. **Don't repeat information** - Static name and tier should appear only once in the UI

---

## UI/UX Design Principles

### Information Hierarchy (GroupView) - 2-Row Header
```
Header:   [Logo] [Static ▼][Owner][Code]              [Tier ▼] [⚙️] [User]
Toolbar:  [Party] [Loot] [Stats]                      [Sort] [G1/G2] [View]
Content:  [Player Cards Grid - all 8 visible without scrolling]
```

**Key principles:**
- Header = unified context bar (logo, static switcher, tier, settings, user)
- Toolbar = view options (tabs, sort, display mode)
- No redundant information (each item appears once)
- Minimal vertical chrome (2 rows, not 3)
- All 8 player cards visible in expanded view without scrolling

### Static Switcher Dropdown
When on a group page, the header includes a static switcher dropdown:
- Shows current static name with chevron
- Lists all user's statics with role badges
- "Go to Dashboard" link at bottom
- Non-members see static name as plain text (no dropdown)

---

## Phase Roadmap

| Phase | Status | Features |
|-------|--------|----------|
| 1 | Complete | Core tracking, player cards, gear tables, priority |
| 2 | Complete | Tab navigation, view modes, needs footer, context menu, FFXIV icons, raid positions, tome weapon |
| 3 | Complete | FastAPI backend, SQLite/PostgreSQL, data persistence, share codes |
| 4 | Complete | Discord OAuth, multi-static membership, per-tier roster snapshots, access control, dashboard, group settings, rollover, invitation system, player ownership |
| 5 | Complete | XIVGear BiS import with preview, BiS link badge, dynamic menu labels, Unlink BiS |
| 5.2 | **Complete** | BiS presets by job (dropdown from The Balance), in-game gear slot names |
| 5.3 | Planned | Item icons with hover cards |
| 6 | Planned | Lodestone auto-sync |
| 7 | Planned | FFLogs integration |
| 8 | Planned | Discord bot, PWA offline mode |

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
# Start both servers (recommended)
./dev.sh              # Kills existing, starts fresh frontend + backend
./dev.sh stop         # Stop both servers
./dev.sh logs         # Tail both log files

# Backend Development (manual)
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend Development (manual)
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

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/discord` | Get Discord OAuth URL |
| POST | `/api/auth/discord/callback` | Handle OAuth callback, return tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/me` | Get current user info |

### Static Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/static-groups` | List user's groups |
| POST | `/api/static-groups` | Create new group |
| GET | `/api/static-groups/by-code/{code}` | Get group by share code |
| PUT | `/api/static-groups/{id}` | Update group |
| DELETE | `/api/static-groups/{id}` | Delete group |

### Tier Snapshots
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/static-groups/{id}/tiers` | List tier snapshots |
| POST | `/api/static-groups/{id}/tiers` | Create tier snapshot |
| GET | `/api/static-groups/{id}/tiers/{tierId}` | Get tier with players |
| PUT | `/api/static-groups/{id}/tiers/{tierId}` | Update tier |
| DELETE | `/api/static-groups/{id}/tiers/{tierId}` | Delete tier |
| POST | `/api/static-groups/{id}/tiers/{tierId}/rollover` | Copy roster to new tier |

### Players
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/static-groups/{id}/tiers/{tierId}/players/{playerId}` | Update player |
| POST | `/api/static-groups/{id}/tiers/{tierId}/players` | Add player |
| DELETE | `/api/static-groups/{id}/tiers/{tierId}/players/{playerId}` | Remove player |
| POST | `/api/static-groups/{id}/tiers/{tierId}/players/{playerId}/claim` | Take ownership |
| DELETE | `/api/static-groups/{id}/tiers/{tierId}/players/{playerId}/claim` | Release ownership |

### Invitations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/static-groups/{id}/invitations` | List group invitations |
| POST | `/api/static-groups/{id}/invitations` | Create invitation |
| DELETE | `/api/static-groups/{id}/invitations/{inviteId}` | Revoke invitation |
| GET | `/api/invitations/{code}` | Get invitation preview (public) |
| POST | `/api/invitations/{code}/accept` | Accept invitation |

### BiS Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bis/presets/{job}` | Get available BiS presets for a job |
| GET | `/api/bis/xivgear/{uuid_or_url}` | Fetch BiS from XIVGear (UUID, share link, or curated BiS) |

---

## Development Practices

### Documentation Maintenance
- **On Planning:** Update CLAUDE.md with planned features and architecture changes
- **Before Commit:** ALWAYS update CLAUDE.md to reflect completed work (new endpoints, components, data model changes)
- **Rule:** Never commit without verifying documentation is current
- Keep Phase Roadmap current with status updates

### Modal and DnD Interaction
When modals are open inside a DnD context, disable drag sensors to prevent text selection from triggering drags:

```typescript
// useDragAndDrop.ts - use high activation distance when disabled
// This keeps array size constant to avoid React useEffect warnings from @dnd-kit
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: disabled ? 999999 : 8,
    },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);

// GroupView.tsx - track modal state
const [playerModalCount, setPlayerModalCount] = useState(0);
const isAnyModalOpen = showSettingsModal || playerModalCount > 0;
const dnd = useDragAndDrop({ disabled: isAnyModalOpen, ... });

// PlayerCard.tsx - notify parent of modal state changes
useEffect(() => {
  const isModalOpen = showRemoveConfirm || showBiSImport;
  if (isModalOpen) onModalOpen?.();
  return () => { if (isModalOpen) onModalClose?.(); };
}, [showRemoveConfirm, showBiSImport, onModalOpen, onModalClose]);
```
