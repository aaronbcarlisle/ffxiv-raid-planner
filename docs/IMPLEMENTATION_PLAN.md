# FFXIV Raid Planner - Implementation Plan

## Overview

A free, web-based raid planning tool for FFXIV static groups. Replaces Google Sheets with automatic gear sync, smart loot distribution, and centralized static management.

**Core Problems Solved:**
1. Players forget to update gear tracking after raids
2. Manual calculations for books, tomes, upgrade materials
3. No standardized loot priority system
4. Scheduling raids across timezones is painful

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 19 + TypeScript + Tailwind CSS 4 + Vite |
| State | Zustand |
| Backend | FastAPI (Python) + PostgreSQL (Supabase) |
| Real-time | WebSockets via FastAPI |
| Hosting | Vercel (frontend) + Railway (backend) |

---

## Phase Overview

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Core MVP | Frontend Complete, Backend Pending |
| 2 | BiS Integration | Not Started |
| 3 | Lodestone Auto-Sync | Not Started |
| 4 | Loot Distribution + Real-Time | Not Started |
| 5 | Scheduling + Strategies | Not Started |
| 6 | Progress Tracking + Alts | Not Started |
| 7 | FFLogs Integration | Not Started |
| 8 | Discord Bot + PWA | Not Started |
| 9 | Auth + User Accounts | Not Started |

---

## Phase 1: Core MVP

### Frontend (Complete)

#### Components
- [x] PlayerCard - Expandable card with compact/full views
- [x] InlinePlayerEdit - Name/job configuration form
- [x] EmptySlotCard - Template slot placeholder
- [x] GearTable - 11-slot gear editor
- [x] LootPriorityPanel - Priority lists per floor
- [x] FloorSelector - M5S-M8S tabs
- [x] SummaryPanel - Loot Priority + Team Stats tabs
- [x] TeamSummary - Aggregated statistics
- [x] JobIcon - XIVAPI job icons with fallback
- [x] Header - Navigation

#### Pages
- [x] Home - Landing page with create/join options
- [x] CreateStatic - Static creation form
- [x] StaticView - Main static management page

#### State Management
- [x] staticStore - Players, gear, settings, UI state

#### Game Data
- [x] Jobs with XIVAPI integration (21 raid jobs)
- [x] Book costs per slot
- [x] Floor loot tables
- [x] Upgrade material mappings
- [x] Raid tier configuration

#### Calculations
- [x] Priority score calculation
- [x] Gear completion tracking
- [x] Materials needed calculation
- [x] Books needed per floor
- [x] Team summary aggregation

#### Styling
- [x] Dark FFXIV theme
- [x] Role color coding
- [x] Responsive design
- [x] Cinzel font for headers

### Backend (Not Started)

#### Setup
- [ ] FastAPI project structure
- [ ] PostgreSQL with Supabase
- [ ] Environment configuration
- [ ] CORS setup

#### Database Tables
- [ ] statics - Raid groups
- [ ] players - Player roster
- [ ] gear_slots - Per-player gear status

#### API Endpoints
- [ ] `GET /api/statics/:shareCode` - Load static
- [ ] `POST /api/statics` - Create static
- [ ] `PUT /api/statics/:id` - Update settings
- [ ] `DELETE /api/statics/:id` - Delete static
- [ ] `POST /api/statics/:id/players` - Add player
- [ ] `PUT /api/players/:id` - Update player
- [ ] `DELETE /api/players/:id` - Remove player
- [ ] `PUT /api/players/:id/gear` - Update gear

#### Deployment
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway
- [ ] Configure environment variables

---

## Phase 2: BiS Integration

### Features
- [ ] Etro.gg link import - Parse gearset ID, fetch gear
- [ ] XIVGear.app link import - Parse UUID, use source metadata
- [ ] Balance BiS presets - Bundled current tier BiS per job
- [ ] Auto-detect Raid vs Tome from item names/sources
- [ ] BiS comparison overlay

### Technical
- [ ] API proxy endpoints (CORS handling)
- [ ] Etro API client
- [ ] XIVGear API client
- [ ] Item database cache
- [ ] BiS preset JSON files

---

## Phase 3: Lodestone Auto-Sync

### Features
- [ ] Character search by name + server
- [ ] Link character with portrait preview
- [ ] Manual sync button (per-player + sync all)
- [ ] Sync status indicators
- [ ] Gear change detection ("New this week" badges)

### Technical
- [ ] XIVAPI character endpoint proxy
- [ ] Gear comparison logic
- [ ] Rate limiting / caching
- [ ] Background sync job (optional)

---

## Phase 4: Loot Distribution + Real-Time

### Features
- [ ] Per-item priority display with score breakdown
- [ ] Configurable priority rules (role order, weights)
- [ ] Loot assignment workflow ("Give to X" button)
- [ ] Auto-update gear status on assignment
- [ ] Loot history with fairness metrics
- [ ] Book tracking (earned/spent)
- [ ] Real-time collaboration via WebSocket
- [ ] Live cursor indicators

### Technical
- [ ] Priority calculation algorithm refinement
- [ ] Loot assignment API
- [ ] WebSocket server setup
- [ ] Real-time state sync
- [ ] Optimistic updates

---

## Phase 5: Scheduling + Strategies

### Raid Schedule
- [ ] Recurring schedule setup (day/time picker)
- [ ] Calendar view (month/week)
- [ ] Session management (create/cancel)
- [ ] Availability tracking (available/unavailable/tentative)
- [ ] Timezone handling

### Strategy Pages
- [ ] One page per floor
- [ ] Rich text editor (Markdown)
- [ ] Section organization
- [ ] Media embeds (images, YouTube, Toolbox)
- [ ] Position assignments per mechanic
- [ ] Quick reference mode

### Other
- [ ] Substitute tracking
- [ ] Player notes

---

## Phase 6: Progress Tracking + Alts

### Features
- [ ] Weekly snapshots (auto-save at reset)
- [ ] Progress dashboard with charts
- [ ] Changelog view
- [ ] Milestones (first clear, BiS complete)
- [ ] Alt character support

### Technical
- [ ] Snapshot scheduling (cron job)
- [ ] Chart components (Recharts)
- [ ] Alt character CRUD

---

## Phase 7: FFLogs Integration

### Features
- [ ] FFLogs character linking
- [ ] Parse percentile display
- [ ] Historical parse trends
- [ ] Report linking to raid sessions
- [ ] XIVAnalysis links

### Technical
- [ ] FFLogs GraphQL client
- [ ] OAuth flow (optional for private logs)
- [ ] Parse display components

---

## Phase 8: Discord Bot + PWA

### Discord Bot
- [ ] Add to server flow
- [ ] Raid reminders (configurable timing)
- [ ] Loot priority summary before raids
- [ ] Gear update notifications
- [ ] Weekly summary

### PWA / Offline
- [ ] Install prompt
- [ ] Offline viewing
- [ ] Queue changes when offline
- [ ] Sync when back online

### Technical
- [ ] discord.py bot setup
- [ ] Scheduled task system (Celery)
- [ ] Service Worker (Workbox)
- [ ] IndexedDB for offline storage

---

## Phase 9: Auth + User Accounts

### Features
- [ ] Discord OAuth login
- [ ] Claim/transfer static ownership
- [ ] Personal dashboard (all statics)
- [ ] Cross-static profile
- [ ] Admin features (roles, locking)

### Technical
- [ ] Discord OAuth implementation
- [ ] JWT token management
- [ ] Permission system

---

## Database Schema

```sql
-- Core tables
CREATE TABLE statics (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL,
  share_code TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE players (
  id UUID PRIMARY KEY,
  static_id UUID REFERENCES statics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  job TEXT NOT NULL,
  role TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_substitute BOOLEAN DEFAULT FALSE,
  notes TEXT,
  lodestone_id TEXT,
  bis_link TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE gear_slots (
  id UUID PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,
  bis_source TEXT NOT NULL DEFAULT 'raid',
  has_item BOOLEAN DEFAULT FALSE,
  is_augmented BOOLEAN DEFAULT FALSE,
  UNIQUE(player_id, slot)
);

-- Indexes
CREATE INDEX idx_players_static ON players(static_id);
CREATE INDEX idx_gear_player ON gear_slots(player_id);
CREATE INDEX idx_statics_share_code ON statics(share_code);
```

---

## API Endpoints Reference

### Statics
```
GET    /api/statics/:shareCode     - Get static by share code
POST   /api/statics                - Create new static
PUT    /api/statics/:id            - Update static settings
DELETE /api/statics/:id            - Delete static
```

### Players
```
GET    /api/statics/:id/players    - Get all players
POST   /api/statics/:id/players    - Add player
PUT    /api/players/:id            - Update player
DELETE /api/players/:id            - Remove player
```

### Gear
```
GET    /api/players/:id/gear       - Get player gear
PUT    /api/players/:id/gear       - Bulk update gear
PUT    /api/players/:id/gear/:slot - Update single slot
```

### Sync Proxies (Phase 2-3)
```
GET    /api/proxy/xivapi/character/search
GET    /api/proxy/xivapi/character/:id
GET    /api/proxy/etro/:gearsetId
GET    /api/proxy/xivgear/:uuid
```

---

## Success Metrics

1. **Time saved** - Reduce weekly tracking from 15+ min to <2 min
2. **Accuracy** - Auto-sync eliminates "forgot to update" errors
3. **Adoption** - Zero-friction sharing via link
4. **Engagement** - Week-over-week progress visualization
