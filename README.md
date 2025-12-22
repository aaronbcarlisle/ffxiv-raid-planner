# FFXIV Savage Raid Planner

A free, web-based raid planning tool for FFXIV static groups. Track gear progress, manage loot distribution, and sync character data automatically.

## Why This Exists

Static raid groups typically use Google Sheets to track BiS gear and loot distribution. The main problems:
- **People forget to update** after getting gear
- **Manual calculations** for books, tomes, upgrade materials
- **No loot priority system** - leads to arguments
- **Hard to share** - requires Google account, permission management

This tool solves all of these with automatic gear sync from Lodestone, BiS import from community tools, and smart loot priority suggestions.

## Features

### Core Features (MVP)
- ✅ Create raid groups with shareable links
- ✅ Track gear per player (Raid vs Tome BiS)
- ✅ Auto-calculate books, tomes, and upgrade materials needed
- ✅ Team-wide progress summary
- ✅ Mobile-friendly dark FFXIV theme

### Coming Soon
- 🔄 Auto-sync gear from Lodestone
- 📊 Import BiS from Etro.gg / XIVGear.app
- 🎯 Smart loot priority suggestions
- 📈 Week-over-week progress tracking
- 🔗 FFLogs integration

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: FastAPI (Python) or Express (Node.js)
- **Database**: SQLite → PostgreSQL
- **Hosting**: Vercel + Railway (free tiers)

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+ (if using FastAPI backend)
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ffxiv-raid-planner.git
cd ffxiv-raid-planner

# Install frontend dependencies
cd frontend
pnpm install

# Install backend dependencies
cd ../backend
pip install -r requirements.txt

# Start development servers
# Terminal 1 - Frontend
cd frontend && pnpm dev

# Terminal 2 - Backend
cd backend && uvicorn app.main:app --reload
```

### Environment Variables

```bash
# frontend/.env
VITE_API_URL=http://localhost:8000

# backend/.env
DATABASE_URL=sqlite:///./raid_planner.db
XIVAPI_KEY=your_key_here  # Optional, for higher rate limits
```

## Project Structure

```
/frontend
  /src
    /components     # React components
    /stores         # Zustand state management
    /hooks          # Custom React hooks
    /utils          # Helper functions
    /types          # TypeScript types
    /api            # API client

/backend
  /app
    /routers        # API routes
    /models         # Database models
    /services       # Business logic
    main.py         # FastAPI app

/docs
  IMPLEMENTATION_PLAN.md
  GEAR_LOGIC_RESEARCH.md
  ARCHITECTURE_SPEC.md
```

## Documentation

- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md) - Detailed phase breakdown
- [Gear Logic Research](./docs/GEAR_LOGIC_RESEARCH.md) - FFXIV mechanics deep dive
- [Architecture Spec](./docs/ARCHITECTURE_SPEC.md) - API integrations and data model

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

- [XIVAPI](https://xivapi.com/) - Character data and game info
- [Etro.gg](https://etro.gg/) - BiS gearset planning
- [XIVGear.app](https://xivgear.app/) - Advanced gear planning
- [FFLogs](https://www.fflogs.com/) - Raid analysis
- [The Balance](https://www.thebalanceffxiv.com/) - Community BiS guides
- [HimbeertoniRaidTool](https://github.com/Koenari/HimbeertoniRaidTool) - Inspiration

---

Made with ❤️ for the FFXIV raiding community
