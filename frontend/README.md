# FFXIV Raid Planner - Frontend

React frontend for the FFXIV Raid Planner.

## Tech Stack

- React 19
- TypeScript
- Tailwind CSS 4
- Vite 7
- Zustand 5

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint

# Format code
pnpm format
```

## Project Structure

```
src/
├── components/
│   ├── player/     # PlayerCard, InlineEdit, GearTable
│   ├── loot/       # LootPriority, FloorSelector
│   ├── team/       # TeamSummary
│   ├── layout/     # Header, Layout
│   └── ui/         # JobIcon, Checkbox, Modal
├── pages/          # Home, CreateStatic, StaticView
├── stores/         # Zustand state management
├── gamedata/       # Jobs, costs, loot tables, tiers
├── utils/          # Calculations, priority logic
└── types/          # TypeScript interfaces
```

## Key Files

| File | Purpose |
|------|---------|
| `stores/staticStore.ts` | All state (players, gear, settings) |
| `utils/priority.ts` | Loot priority calculations |
| `utils/calculations.ts` | Gear completion, materials |
| `gamedata/costs.ts` | Book and tomestone costs |
| `gamedata/loot-tables.ts` | Floor drop tables |
| `gamedata/jobs.ts` | Job definitions with XIVAPI |
