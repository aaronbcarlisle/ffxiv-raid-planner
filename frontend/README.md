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

# Design system compliance
pnpm check:design-system

# Run tests
pnpm test
```

## Project Structure

```
src/
├── components/
│   ├── player/        # PlayerCard, PlayerGrid, GearTable, JobPicker
│   ├── loot/          # LootPriorityPanel, FloorSelector, QuickLogDropModal
│   ├── priority/      # Priority tab panels
│   ├── history/       # WeeklyLootGrid, SectionedLogView, All Weeks view
│   ├── schedule/      # ScheduleTab, AvailabilityGrid, CreateSessionModal
│   ├── settings/      # SettingsPanel slide-out
│   ├── admin/         # Admin analytics dashboard pieces
│   ├── wizard/        # SetupWizard, RosterSlot, step components
│   ├── weapon-priority/ # Weapon priority tracking
│   ├── static-group/  # TierSelector, Invitations
│   ├── auth/          # LoginButton, UserMenu
│   ├── layout/        # Header, Layout
│   ├── primitives/    # Button, IconButton, low-level primitives
│   └── ui/            # JobIcon, Modal, Toast, ContextMenu, Select, Input
├── pages/             # Home, Dashboard, GroupView, AdminDashboard, docs pages
├── stores/            # Zustand state management
├── hooks/             # Custom hooks (useGroupViewState, usePlayerActions, etc.)
├── gamedata/          # Jobs, costs, loot tables, tiers
├── utils/             # Calculations, priority logic
└── types/             # TypeScript interfaces
```

## Key Files

| File | Purpose |
|------|---------|
| `stores/authStore.ts` | Discord OAuth, user state, tokens |
| `stores/staticGroupStore.ts` | Static groups, membership, invitations |
| `stores/tierStore.ts` | Tier snapshots, players, gear |
| `utils/priority.ts` | Loot priority calculations |
| `utils/calculations.ts` | Gear completion, materials |
| `gamedata/costs.ts` | Book and tomestone costs |
| `gamedata/loot-tables.ts` | Floor drop tables |
| `gamedata/jobs.ts` | Job definitions with XIVAPI icons |
| `gamedata/raid-tiers.ts` | Tier configuration |

## State Architecture

Three Zustand stores manage application state:

- **authStore** - User authentication, JWT tokens, Discord OAuth flow
- **staticGroupStore** - User's static groups, membership roles, invitations
- **tierStore** - Current tier's players, gear status, player reordering

Each store includes async actions for API communication with automatic token refresh on 401 errors.

## Environment Variables

Create `.env.local`:
```env
VITE_API_URL=http://localhost:8001
```
