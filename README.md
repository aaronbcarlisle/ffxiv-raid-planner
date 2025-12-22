# FFXIV Savage Raid Planner

A free, web-based raid planning tool for FFXIV static groups. Track gear progress, manage loot distribution, and sync character data automatically.

## Why This Exists

Static raid groups typically use Google Sheets to track BiS gear and loot distribution. The main problems:
- **People forget to update** after getting gear
- **Manual calculations** for books, tomes, upgrade materials
- **No loot priority system** - leads to arguments
- **Hard to share** - requires Google account, permission management

This tool solves these with automatic gear sync from Lodestone, BiS import from community tools, and smart loot priority suggestions.

## Current Status

**Frontend: Complete** | **Backend: Not Started**

The frontend is a fully functional local prototype. Data is stored in browser memory only - it resets on page refresh. Backend integration is the next phase.

## Features

### Working Now
- Create raid groups with 8 template player slots
- Track gear per player (Raid vs Tome BiS)
- Auto-calculate books, tomes, and upgrade materials needed
- Loot priority suggestions per floor
- Team-wide progress summary
- Mobile-friendly dark FFXIV theme

### Planned
- Data persistence with shareable links
- Auto-sync gear from Lodestone
- Import BiS from Etro.gg / XIVGear.app
- Week-over-week progress tracking
- FFLogs integration
- Discord bot notifications

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 + Vite
- **State**: Zustand
- **Backend**: FastAPI (Python) + PostgreSQL (planned)
- **Hosting**: Vercel + Railway (planned)

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ffxiv-raid-planner.git
cd ffxiv-raid-planner

# Install frontend dependencies
cd frontend
pnpm install

# Start development server
pnpm dev
```

The app will be available at `http://localhost:5173`

## Project Structure

```
ffxiv-raid-planner/
├── frontend/
│   └── src/
│       ├── components/     # React components
│       ├── pages/          # Route pages
│       ├── stores/         # Zustand state
│       ├── gamedata/       # Jobs, costs, loot tables
│       ├── utils/          # Calculations, helpers
│       └── types/          # TypeScript types
├── docs/
│   ├── IMPLEMENTATION_PLAN.md   # Roadmap and status
│   ├── GEARING_MATH.md          # FFXIV gearing mechanics
│   ├── ARCHITECTURE_SPEC.md     # API integrations
│   └── GEAR_LOGIC_RESEARCH.md   # Mechanics research
└── CLAUDE.md                    # Project guide
```

## Documentation

- [Project Guide](./CLAUDE.md) - Quick reference for development
- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md) - Detailed roadmap
- [Gearing Math](./docs/GEARING_MATH.md) - FFXIV mechanics deep dive
- [Architecture Spec](./docs/ARCHITECTURE_SPEC.md) - API integrations

## Contributing

Contributions welcome! Please read the implementation plan first to understand the project direction.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [XIVAPI](https://xivapi.com/) - Character data and job icons
- [Etro.gg](https://etro.gg/) - BiS gearset planning
- [XIVGear.app](https://xivgear.app/) - Advanced gear planning
- [FFLogs](https://www.fflogs.com/) - Raid analysis
- [The Balance](https://www.thebalanceffxiv.com/) - Community BiS guides
