# FFXIV Raid Planner - Project Guide

## Project Overview

A free, web-based tool for FFXIV static raid groups to:
- Track gear progress toward BiS (Best in Slot)
- Manage loot distribution with priority calculations
- Sync character data from Lodestone (planned)
- Schedule raids and document strategies (planned)

---

## Current Status

**Phase 1 Frontend: Complete** | **Phase 2 UX: In Progress** | **Backend: Not Started**

The frontend is a fully functional local-only prototype. All UI components work, but data is not persisted to a backend - it resets on page refresh.

### What Works (Phase 1)
- Static creation with 8 template player slots
- Inline player editing (name, job selection)
- Gear tracking with BiS source (Raid/Tome) and Have/Augmented states
- Priority score calculations based on role + need
- Loot priority lists for each floor
- Team summary with materials needed, books, completion %
- Responsive UI with dark FFXIV theme

### In Progress (Phase 2)
- Tab-based navigation (Players/Loot/Stats)
- Responsive 4-column grid layout
- Global view mode toggle + individual card expansion
- Player card needs footer (Raid/Tome/Upgrades/Weeks)
- Tome weapon tracking (interim upgrade during prog)
- Right-click context menu (Copy/Paste/Duplicate)

### What's Missing
- Backend API (FastAPI + PostgreSQL)
- Data persistence
- Share code functionality
- Authentication
- Lodestone sync
- Real-time collaboration

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Tailwind CSS 4 + Vite 7 |
| State | Zustand 5 |
| Backend | FastAPI (Python) + PostgreSQL (Supabase) - *not implemented* |
| Hosting | Vercel (frontend) + Railway (backend) - *not deployed* |

---

## Quick Start

```bash
cd frontend
pnpm install
pnpm dev
```

---

## Project Structure

```
ffxiv-raid-planner/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── player/          # Player cards, inline edit, gear table
│       │   ├── loot/            # Loot priority, floor selector, loot mode
│       │   ├── team/            # Team summary stats
│       │   ├── layout/          # Header, layout wrapper
│       │   └── ui/              # Reusable UI components
│       ├── pages/               # Home, CreateStatic, StaticView
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

Page-level tabs replace scrolling to bottom for loot/stats:

```
[👥 Players] [🎯 Loot] [📊 Stats]    [M5S][M6S][M7S][M8S]    [▤][☰]
```

| Tab | Content |
|-----|---------|
| **Players** | Player cards grid (main view) |
| **Loot** | Full-screen loot distribution with priority lists |
| **Stats** | Team summary (completion %, materials, books) |

Floor selector visible in all tabs.

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

### 3. Responsive 3-Column Grid

| Breakpoint | Width | Columns |
|------------|-------|---------|
| Default | <768px | 1 |
| md | ≥768px | 2 |
| lg | ≥1024px | 3 |

```typescript
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
```

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

Right-click on PlayerCard shows:
- **Copy Player**: Stores player data in clipboard state
- **Paste Player**: Appears only if clipboard has data; overwrites target
- **Duplicate Player**: Creates new card, auto-focuses name for editing

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
  configured: boolean;   // false for empty template slots
  gear: GearSlotStatus[];
  tomeWeapon: TomeWeaponStatus;  // NEW: Interim weapon tracking
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
- `PlayerCard.tsx` - Expandable card with compact/full views, context menu
- `InlinePlayerEdit.tsx` - Name/job form for configuring slots
- `EmptySlotCard.tsx` - Placeholder for unconfigured template slots
- `GearTable.tsx` - 11-slot gear editor with source/have/augmented
- `WeaponSlotRow.tsx` - Special weapon row with tome weapon sub-row
- `NeedsFooter.tsx` - 4-stat footer (raid/tome/upgrades/weeks)

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
- `TabNavigation.tsx` - Page-level tab buttons
- `ViewModeToggle.tsx` - ▤/☰ toggle component
- `ContextMenu.tsx` - Right-click menu component

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
3. **Don't limit grid to 2 columns** - Support up to 4 on wide screens
4. **Don't mix display order and priority order** - They're separate concepts
5. **Don't track weapon as either raid OR tome** - BiS is always raid; tome is interim

---

## Phase Roadmap

| Phase | Status | Features |
|-------|--------|----------|
| 1 | Complete | Core tracking, player cards, gear tables, priority |
| 2 | **In Progress** | Tab navigation, view modes, needs footer, tome weapon, context menu |
| 3 | Planned | Backend API, data persistence |
| 4 | Planned | BiS import (Etro, XIVGear), Balance presets |
| 5 | Planned | Lodestone auto-sync |
| 6 | Planned | FFLogs integration |
| 7 | Planned | Discord bot, PWA offline mode |

---

## XIVAPI Integration

### Gear Slot Icons

Two icon sets are available from XIVAPI for gear slots:

**1. ItemUICategory Icons** (colorful/filled) - Currently used in GearTable:
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

**2. Gear Slot Placeholder Icons** (outline/silhouette style) - For empty slots:
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

### Future Feature: Dynamic BiS Item Icons (Phase 4+)

When Etro/XIVGear integration is added, gear slots could show:
- **Empty state**: Placeholder icon (outline style) when slot needs to be filled
- **Have state**: Actual BiS item icon from XIVAPI when "Have" is checked

This would require:
1. Parsing BiS link to extract item IDs
2. Fetching item icons from XIVAPI: `https://xivapi.com/i/{folder}/{icon}.png`
3. Storing item icon URLs in GearSlotStatus
4. Conditionally rendering placeholder vs actual item icon

Both icon sets are defined in `src/types/index.ts`:
- `GEAR_SLOT_ICONS` - Current filled icons
- `GEAR_SLOT_PLACEHOLDER_ICONS` - For future empty state

---

## Commands

```bash
# Development
cd frontend && pnpm dev

# Build
pnpm build

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint

# Format
pnpm format
```
