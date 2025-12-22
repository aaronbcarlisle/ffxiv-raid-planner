# Phase 1: Core MVP Checklist

## Frontend (Complete)

### Setup
- [x] React 19 + Vite + TypeScript
- [x] Tailwind CSS 4 with custom FFXIV theme
- [x] ESLint + Prettier
- [x] Zustand for state management

### UI Components
- [x] JobIcon (with XIVAPI fallback)
- [x] Checkbox
- [x] Select
- [x] Modal

### Layout
- [x] Header with logo and nav
- [x] Responsive layout

### Player Components
- [x] PlayerCard (expandable with compact/full views)
- [x] InlinePlayerEdit (name/job form)
- [x] EmptySlotCard (template placeholder)
- [x] GearTable (11-slot editor)

### Loot Components
- [x] LootPriorityPanel (priority lists per floor)
- [x] FloorSelector (M5S-M8S tabs)
- [x] SummaryPanel (tabbed Loot Priority + Team Stats)

### Team Components
- [x] TeamSummary (completion %, materials, books, weeks)

### Pages
- [x] Home (landing page)
- [x] CreateStatic (form)
- [x] StaticView (main management)

### State Management
- [x] staticStore with full player/gear CRUD

### Game Data
- [x] Jobs with XIVAPI icons (21 raid jobs)
- [x] Book costs per slot
- [x] Floor loot tables
- [x] Upgrade material mappings
- [x] Raid tier configuration (M5S-M8S current)

### Calculations
- [x] Priority score (role + need weighted)
- [x] Gear completion tracking
- [x] Materials needed per player
- [x] Books needed per floor
- [x] Team summary aggregation

### Styling
- [x] Dark FFXIV theme
- [x] Role color coding
- [x] Raid (red) / Tome (green) indicators
- [x] Responsive breakpoints

---

## Backend (Not Started)

### Setup
- [ ] FastAPI project structure
- [ ] PostgreSQL with Supabase
- [ ] Environment configuration
- [ ] CORS setup

### Database
- [ ] statics table
- [ ] players table
- [ ] gear_slots table
- [ ] Migrations

### API Endpoints
- [ ] GET /api/statics/:shareCode
- [ ] POST /api/statics
- [ ] PUT /api/statics/:id
- [ ] DELETE /api/statics/:id
- [ ] GET /api/statics/:id/players
- [ ] POST /api/statics/:id/players
- [ ] PUT /api/players/:id
- [ ] DELETE /api/players/:id
- [ ] PUT /api/players/:id/gear

### Deployment
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway
- [ ] Configure production environment

### Testing
- [ ] Gear calculation unit tests
- [ ] API endpoint tests
