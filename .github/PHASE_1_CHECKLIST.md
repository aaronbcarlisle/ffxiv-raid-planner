# Phase 1: Core MVP Checklist

Track progress on Phase 1 implementation.

## Setup
- [ ] Initialize frontend with Vite + React + TypeScript
- [ ] Configure Tailwind CSS with custom FFXIV theme
- [ ] Set up ESLint + Prettier
- [ ] Initialize backend with FastAPI
- [ ] Set up PostgreSQL with Supabase
- [ ] Configure environment variables
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway

## Frontend Components

### UI Components
- [ ] Button (primary, secondary, ghost variants)
- [ ] Select (dropdown)
- [ ] Checkbox
- [ ] Card
- [ ] Modal
- [ ] Tooltip
- [ ] LoadingSpinner

### Layout
- [ ] Header with logo and nav
- [ ] Main content area
- [ ] Mobile responsive navigation

### Player Components
- [ ] PlayerCard (expandable)
- [ ] PlayerHeader (name, job, role color)
- [ ] GearTable (all slots)
- [ ] GearSlotRow (source, have, augmented)
- [ ] PlayerNotes

### Team Components
- [ ] TeamSummary panel
- [ ] UpgradeMaterialsPanel (Twine/Glaze/Solvent counts)
- [ ] BooksNeededPanel (per floor)

## State Management
- [ ] staticStore (static info, settings)
- [ ] playerStore (player list, CRUD)
- [ ] gearStore (gear status per player)

## Backend API

### Statics
- [ ] GET /api/statics/:shareCode
- [ ] POST /api/statics
- [ ] PUT /api/statics/:id
- [ ] DELETE /api/statics/:id

### Players
- [ ] GET /api/statics/:id/players
- [ ] POST /api/statics/:id/players
- [ ] PUT /api/players/:id
- [ ] DELETE /api/players/:id

### Gear
- [ ] GET /api/players/:id/gear
- [ ] PUT /api/players/:id/gear

## Database
- [ ] statics table
- [ ] players table
- [ ] gear_slots table
- [ ] Migrations setup

## Features
- [ ] Create new static flow
- [ ] Add/edit/remove player
- [ ] Job selector (all 24 jobs)
- [ ] Role auto-assignment from job
- [ ] BiS source selection (Raid/Tome) per slot
- [ ] Have/Augmented checkboxes
- [ ] Auto-calculated player stats
- [ ] Team-wide summary calculations
- [ ] Share code generation
- [ ] Load static by share code
- [ ] Display order: Tank > Healer > DPS
- [ ] Sort toggle button
- [ ] Substitute player flag
- [ ] Player notes field

## Styling
- [ ] Dark FFXIV theme colors
- [ ] Role color coding
- [ ] Raid (red) / Tome (green) indicators
- [ ] Gold accent highlights
- [ ] Mobile responsive breakpoints

## Testing
- [ ] Gear calculation unit tests
- [ ] API endpoint tests
- [ ] Basic E2E flow test

---

**Target Completion**: 2 weeks
