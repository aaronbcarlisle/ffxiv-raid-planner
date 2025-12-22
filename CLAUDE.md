# FFXIV Raid Planner - Project Guide

## Project Overview

A free, web-based tool for FFXIV static raid groups to:
- Track gear progress toward BiS (Best in Slot)
- Manage loot distribution with priority calculations
- Sync character data from Lodestone (planned)
- Schedule raids and document strategies (planned)

---

## Current Status

**Phase 1 Frontend: Complete** | **Phase 1 Backend: Not Started**

The frontend is a fully functional local-only prototype. All UI components work, but data is not persisted to a backend - it resets on page refresh.

### What Works
- Static creation with 8 template player slots
- Inline player editing (name, job selection)
- Gear tracking with BiS source (Raid/Tome) and Have/Augmented states
- Priority score calculations based on role + need
- Loot priority lists for each floor
- Team summary with materials needed, books, completion %
- Responsive UI with dark FFXIV theme

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
│       │   ├── loot/            # Loot priority, floor selector
│       │   ├── team/            # Team summary stats
│       │   ├── layout/          # Header, layout wrapper
│       │   └── ui/              # Reusable UI components
│       ├── pages/               # Home, CreateStatic, StaticView
│       ├── stores/              # Zustand state (staticStore)
│       ├── gamedata/            # Jobs, costs, loot tables, raid tiers
│       ├── utils/               # Calculations, priority logic
│       └── types/               # TypeScript interfaces
├── docs/                        # Documentation
└── CLAUDE.md                    # This file
```

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

| Floor | Gear Drops | Upgrade Materials |
|-------|------------|-------------------|
| 1 (M5S) | Accessories | Glaze |
| 2 (M6S) | Head, Hands, Feet | Glaze |
| 3 (M7S) | Body, Legs | Twine, Solvent |
| 4 (M8S) | Weapon | - |

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

interface StaticSettings {
  displayOrder: Role[];     // Card sort order
  lootPriority: Role[];     // Who gets loot first
  timezone: string;
}

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
// Role base scores
const ROLE_PRIORITY_SCORES = {
  melee: 125,
  ranged: 100,
  caster: 75,
  tank: 50,
  healer: 25
};

// Score = role base + weighted need
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
- `PlayerCard.tsx` - Expandable card with compact/full views
- `InlinePlayerEdit.tsx` - Name/job form for configuring slots
- `EmptySlotCard.tsx` - Placeholder for unconfigured template slots
- `GearTable.tsx` - 11-slot gear editor with source/have/augmented

### Loot Components
- `LootPriorityPanel.tsx` - Priority lists for floor drops
- `FloorSelector.tsx` - M5S-M8S tab buttons
- `SummaryPanel.tsx` - Tabs for Loot Priority and Team Stats

### Team Components
- `TeamSummary.tsx` - Aggregated stats (completion %, materials, books)

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
  // Tome pieces need both the item AND augmentation
  return slot.hasItem && slot.isAugmented;
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

## Next Steps (Phase 1 Completion)

1. **Backend Setup**
   - FastAPI project structure
   - PostgreSQL with Supabase
   - CRUD endpoints for statics/players/gear

2. **API Integration**
   - Connect frontend to backend
   - Share code generation and loading
   - Deploy to Vercel + Railway

3. **Testing**
   - Unit tests for calculations
   - API endpoint tests

---

## Phase 2+ Roadmap

| Phase | Features |
|-------|----------|
| 2 | BiS import (Etro, XIVGear), Balance presets |
| 3 | Lodestone auto-sync |
| 4 | Loot assignment workflow, real-time collaboration |
| 5 | Scheduling, strategy pages |
| 6 | Progress tracking, alt characters |
| 7 | FFLogs integration |
| 8 | Discord bot, PWA offline mode |
| 9 | User accounts, authentication |

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
