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
│   ├── player/        # PlayerCard, GearTable, JobPicker
│   ├── loot/          # LootPriority, FloorSelector
│   ├── team/          # TeamSummary
│   ├── static-group/  # TierSelector, GroupSettings, Invitations
│   ├── auth/          # LoginButton, UserMenu
│   ├── layout/        # Header, Layout
│   └── ui/            # JobIcon, Modal, Toast, ContextMenu
├── pages/             # Home, Dashboard, GroupView, AuthCallback, InviteAccept
├── stores/            # Zustand state management
├── services/          # API client utilities
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
