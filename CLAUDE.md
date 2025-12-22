# Claude Code Instructions

This file provides context for Claude Code when working on this project.

## Project Overview

FFXIV Savage Raid Planner - A free, web-based tool for FFXIV static raid groups to track gear, manage loot distribution, schedule raids, and document strategies.

## Key Documentation

Before starting any work, read these docs in order:

1. **docs/IMPLEMENTATION_PLAN.md** - Master plan with all phases, database schema, API endpoints, file structure
2. **docs/ARCHITECTURE_SPEC.md** - API integrations, data models, user flows
3. **docs/GEAR_LOGIC_RESEARCH.md** - FFXIV mechanics (books, tomes, upgrades, priority calculations)

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: FastAPI (Python) + PostgreSQL (Supabase)
- **Real-time**: WebSockets
- **State**: Zustand
- **PWA**: Workbox

## Current Phase

**Phase 1: Core MVP** - See docs/IMPLEMENTATION_PLAN.md for detailed tasks

### Phase 1 Features
- Create static with name/tier
- Add/edit/remove players (name, job, notes, substitute flag)
- Gear tracking (BiS source, have/augmented checkboxes)
- Team-wide summary (materials needed, books, completion %)
- Shareable links
- Dark FFXIV theme
- Mobile responsive

## Project Structure

```
ffxiv-raid-planner/
├── frontend/           # React + Vite app
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/      # Page components
│   │   ├── stores/     # Zustand stores
│   │   ├── hooks/      # Custom hooks
│   │   ├── utils/      # Helper functions
│   │   ├── types/      # TypeScript types
│   │   └── api/        # API client
│   └── ...
├── backend/            # FastAPI app
│   ├── app/
│   │   ├── routers/    # API routes
│   │   ├── models/     # Database models
│   │   └── services/   # Business logic
│   └── ...
├── docs/               # Documentation
└── design/             # UI mockups
```

## Design Reference

The mockup in `design/concept-a-v2-priority-autosync.jsx` shows the target UI. Key design elements:
- Dark background (#0a0a12)
- Gold accent (#c9a227)
- Role colors: Tank (blue), Healer (green), Melee (red), Ranged (orange), Caster (purple)
- Gear sources: Raid (red), Tome (green)

## FFXIV-Specific Terms

- **BiS**: Best in Slot - optimal gear for a job
- **Savage**: High-difficulty 8-player raids (M1S-M4S for current tier)
- **Books/Pages**: Weekly tokens from clearing floors, exchanged for gear
- **Tomes**: Currency capped at 450/week, used for tome gear
- **Twine/Glaze/Solvent**: Upgrade materials for tome gear
- **Lodestone**: Official FFXIV character database (sync source)
- **Etro/XIVGear**: Community BiS planning tools
- **FFLogs**: Raid performance tracking

## Common Commands

```bash
# Frontend
cd frontend
pnpm install
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm test         # Run tests

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload  # Start dev server
pytest                          # Run tests
```

## API Conventions

- REST endpoints under `/api/`
- Use plural nouns: `/api/statics`, `/api/players`
- Return JSON with consistent structure
- Handle errors with appropriate HTTP codes

## Database

Using PostgreSQL via Supabase. Schema in docs/IMPLEMENTATION_PLAN.md.

Key tables: `statics`, `players`, `gear_slots`, `loot_history`, `raid_schedule`, `strategies`

## Testing Strategy

- Unit tests for calculation functions
- Integration tests for API endpoints
- E2E tests for critical user flows

## Deployment

- Frontend: Vercel
- Backend: Railway
- Database: Supabase

## Git Commits

- Never add Claude as a co-author or contributor to commits
- Do not append "Generated with Claude Code" or similar attribution to commit messages

## Getting Help

If unsure about FFXIV mechanics, refer to docs/GEAR_LOGIC_RESEARCH.md or ask for clarification.
