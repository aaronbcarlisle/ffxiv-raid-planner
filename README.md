# FFXIV Raid Planner

A free, web-based raid planning tool for FFXIV static groups. Track gear progress toward BiS, manage loot distribution, and coordinate your team.

## Live Demo

- **Frontend:** Vercel (vercel.com)
- **Backend:** Railway (railway.app)

## Features

### Core Features
- **Discord OAuth** - Login with Discord, no account creation needed
- **Multi-Static Support** - Manage multiple raid groups from one account
- **Tier Snapshots** - Separate rosters per raid tier (e.g., M1S-M4S vs M5S-M8S)
- **Share Codes** - Public read-only links for non-members

### Gear Tracking
- Track all 11 gear slots per player
- BiS source tracking (Raid vs Tome)
- Augmentation status for tome gear
- Tome weapon tracking (interim weapon during prog)

### Team Management
- Drag-and-drop player reordering
- Light party split view (G1/G2)
- Raid position assignments (T1/T2, H1/H2, M1/M2, R1/R2)
- Tank role designation (MT/OT)

### Loot Distribution
- Auto-calculated loot priority per floor
- Priority based on role + gear needs
- Book cost tracking (weeks to BiS)
- Upgrade material tracking (Twine/Glaze/Solvent/Universal Tomestone)
- Weapon job tracking (which job's weapon was received)
- Extra loot tagging (mark off-job/extra drops)

### Weapon Priority
- Multi-job weapon tracking per player
- Drag-and-drop priority reordering
- Main job priority bonus (2000 points)
- Tie-breaker roll system with auto-expand

### Collaboration
- **Role-Based Access** - Owner/Lead/Member/Viewer permissions
- **Invitation System** - Invite links with configurable roles and expiration
- **Player Ownership** - Link your Discord to your player card

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Tailwind CSS 4 + Vite 7 |
| State | Zustand 5 |
| Backend | FastAPI (Python) + SQLAlchemy + PostgreSQL |
| Auth | Discord OAuth 2.0 + JWT |

## Getting Started

### Prerequisites
- Node.js 18+ and pnpm
- Python 3.11+
- PostgreSQL (or SQLite for development)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/ffxiv-raid-planner.git
cd ffxiv-raid-planner

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Configure Discord OAuth credentials
uvicorn app.main:app --reload --port 8000

# Frontend setup (new terminal)
cd frontend
pnpm install
pnpm dev
```

**Backend:** http://localhost:8001
**Frontend:** http://localhost:5174

### Environment Variables

Create `backend/.env`:
```env
DATABASE_URL=sqlite+aiosqlite:///./data/raid_planner.db
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=http://localhost:5174/auth/callback
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5174
```

## Project Structure

```
ffxiv-raid-planner/
├── backend/                 # FastAPI Backend
│   ├── app/
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── routers/         # API endpoints
│   │   └── services/        # Business logic
│   └── requirements.txt
├── frontend/                # React Frontend
│   └── src/
│       ├── components/      # React components
│       ├── pages/           # Route pages
│       ├── stores/          # Zustand state
│       ├── gamedata/        # FFXIV data (jobs, costs, tiers)
│       └── types/           # TypeScript types
├── docs/                    # Documentation
│   ├── CONSOLIDATED_STATUS.md  # Current status & roadmap
│   ├── GEARING_MATH.md         # FFXIV mechanics reference
│   └── archive/                # Historical planning/audits
└── CLAUDE.md                # Development guide

_See [CLAUDE.md](./CLAUDE.md) for detailed project structure and key files._
```

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Comprehensive development guide
- **[docs/CONSOLIDATED_STATUS.md](./docs/CONSOLIDATED_STATUS.md)** - Current status, roadmap, and technical debt
- **[docs/GEARING_MATH.md](./docs/GEARING_MATH.md)** - FFXIV gearing mechanics reference

**Archived Documentation:**
- [docs/archive/2025-12-planning/](./docs/archive/2025-12-planning/) - Historical planning documents
- [docs/archive/2025-12-audits/](./docs/archive/2025-12-audits/) - Historical audit reports

## Current Raid Tier

**AAC Heavyweight (Savage)** - Patch 7.4
- Floors: M9S, M10S, M11S, M12S
- Savage gear: iLvl 790 (weapon 795)
- Tome gear: iLvl 780 (augmented 790)

## Contributing

Contributions welcome! Please read CLAUDE.md for development guidelines.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm tsc --noEmit` and `pnpm lint`
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [XIVAPI](https://xivapi.com/) - Character data and icons
- [Etro.gg](https://etro.gg/) - BiS gearset planning
- [The Balance](https://www.thebalanceffxiv.com/) - Community BiS guides
