# FFXIV Savage Raid Planner - Implementation Plan v2

## Project Overview

**Goal**: Build a free, web-based raid planning tool that replaces Google Sheets AND When2Meet for FFXIV static groups, with automatic gear sync, raid scheduling, strategy documentation, and Discord integration.

**Core Problems Solved**:
1. Players forget to update gear tracking after raids
2. Scheduling raids across timezones is painful (When2Meet is clunky)
3. Strategy references are scattered across Discord, Google Docs, images
4. No centralized hub for static management

**Solution**: An all-in-one static management tool with auto-sync, smart scheduling, strategy pages, and real-time collaboration.

---

## Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand (local) + WebSocket (real-time sync)
- **Routing**: React Router v6
- **Build Tool**: Vite
- **PWA**: Workbox for offline support

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL (Supabase free tier)
- **Real-time**: WebSockets via FastAPI
- **Task Queue**: Celery + Redis (for Discord bot, scheduled tasks)
- **Auth**: JWT tokens + Discord OAuth

### Integrations
- **Discord Bot**: discord.py
- **APIs**: XIVAPI, Etro, XIVGear, FFLogs

### Hosting
- **Frontend**: Vercel (free tier)
- **Backend**: Railway (free tier)
- **Database**: Supabase (free tier)
- **Bot**: Railway or Fly.io

---

## Feature Overview

### Core Features
| Feature | Phase | Priority |
|---------|-------|----------|
| Gear tracking (manual) | 1 | 🔴 Critical |
| Shareable links | 1 | 🔴 Critical |
| Team summary | 1 | 🔴 Critical |
| BiS import (Etro/XIVGear) | 2 | 🔴 Critical |
| Auto-sync from Lodestone | 3 | 🔴 Critical |
| Loot priority suggestions | 4 | 🟡 High |
| Real-time collaboration | 4 | 🟡 High |
| Raid schedule/calendar | 5 | 🟡 High |
| Strategy pages per floor | 5 | 🟡 High |
| Progress tracking | 6 | 🟡 High |
| FFLogs integration | 7 | 🟡 High |
| Discord bot | 8 | 🟢 Medium |
| Offline mode (PWA) | 8 | 🟢 Medium |
| Substitute tracking | 5 | 🟢 Medium |
| Player notes | 5 | 🟢 Medium |
| Alt character tracking | 6 | 🟢 Medium |
| Optional auth/history | 9 | 🟢 Medium |

---

## Display Order vs Loot Priority

### Display Order (Party List)
How player cards are displayed (traditional FFXIV party order):
```
1. Tanks (MT, OT)
2. Healers (Pure, Shield)
3. Melee DPS
4. Ranged DPS
5. Casters
```

### Loot Priority Order
Who gets loot first (configurable per static):
```
1. Melee DPS (highest damage gain from gear)
2. Ranged DPS
3. Casters
4. Tanks
5. Healers
```

Both orders are independently configurable.

---

## Database Schema

```sql
-- ============================================
-- CORE TABLES
-- ============================================

-- Statics (raid groups)
CREATE TABLE statics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tier TEXT NOT NULL,  -- "AAC Cruiserweight (Savage)"
  share_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Settings (JSON)
  settings JSONB DEFAULT '{
    "displayOrder": ["tank", "healer", "melee", "ranged", "caster"],
    "lootPriority": ["melee", "ranged", "caster", "tank", "healer"],
    "timezone": "America/New_York",
    "autoSync": false,
    "syncFrequency": "weekly"
  }'
);

-- Players in a static
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  static_id UUID REFERENCES statics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  job TEXT NOT NULL,
  role TEXT NOT NULL,  -- tank, healer, melee, ranged, caster
  lodestone_id TEXT,
  bis_link TEXT,
  fflogs_id INTEGER,
  last_sync TIMESTAMP,
  sort_order INTEGER DEFAULT 0,
  is_substitute BOOLEAN DEFAULT FALSE,
  notes TEXT,  -- "Out Dec 28-Jan 2"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alt characters per player
CREATE TABLE player_alts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  job TEXT NOT NULL,
  lodestone_id TEXT,
  is_active BOOLEAN DEFAULT FALSE,  -- Currently playing this alt?
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gear status per player
CREATE TABLE gear_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,  -- weapon, head, body, etc.
  bis_source TEXT NOT NULL DEFAULT 'raid',  -- 'raid' or 'tome'
  has_item BOOLEAN DEFAULT FALSE,
  is_augmented BOOLEAN DEFAULT FALSE,
  item_id INTEGER,  -- XIVAPI item ID
  item_name TEXT,
  item_level INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(player_id, slot)
);

-- ============================================
-- LOOT TRACKING
-- ============================================

CREATE TABLE loot_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  static_id UUID REFERENCES statics(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  week_number INTEGER NOT NULL,
  floor INTEGER NOT NULL,  -- 1-4
  item_type TEXT NOT NULL,  -- 'weapon', 'head', 'twine', etc.
  acquisition_method TEXT DEFAULT 'drop',  -- 'drop' or 'book'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Book/token tracking per player
CREATE TABLE book_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  floor INTEGER NOT NULL,  -- 1-4
  books_earned INTEGER DEFAULT 0,
  books_spent INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(player_id, floor)
);

-- ============================================
-- SCHEDULING
-- ============================================

-- Raid schedule (recurring)
CREATE TABLE raid_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  static_id UUID REFERENCES statics(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,  -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual raid sessions (for attendance, cancellations)
CREATE TABLE raid_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  static_id UUID REFERENCES statics(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT DEFAULT 'scheduled',  -- scheduled, completed, cancelled
  notes TEXT,
  fflogs_report_id TEXT,  -- Link to FFLogs report
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player availability per session
CREATE TABLE player_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES raid_sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'unknown',  -- available, unavailable, tentative, unknown
  notes TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, player_id)
);

-- ============================================
-- STRATEGIES
-- ============================================

-- Strategy pages per floor
CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  static_id UUID REFERENCES statics(id) ON DELETE CASCADE,
  floor INTEGER NOT NULL,  -- 1-4
  title TEXT NOT NULL,  -- "M1S - Black Cat"
  content TEXT,  -- Markdown content
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(static_id, floor)
);

-- Strategy sections (for organization)
CREATE TABLE strategy_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,  -- "Phase 1", "Mouser", etc.
  content TEXT,  -- Markdown
  sort_order INTEGER DEFAULT 0,
  toolbox_link TEXT,  -- Link to FF14 Toolbox
  image_url TEXT,  -- Diagram image
  video_url TEXT,  -- YouTube/Twitch clip
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player-specific positions/assignments
CREATE TABLE strategy_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  mechanic_name TEXT NOT NULL,  -- "Mouser 1", "Nailchipper", etc.
  assignments JSONB NOT NULL,  -- {"MT": "NW", "OT": "NE", ...}
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROGRESS TRACKING
-- ============================================

CREATE TABLE weekly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  static_id UUID REFERENCES statics(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  snapshot_date DATE NOT NULL,
  data JSONB NOT NULL,  -- Full state snapshot
  summary JSONB,  -- Calculated summary stats
  UNIQUE(static_id, week_number)
);

-- ============================================
-- USER ACCOUNTS (Optional)
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT UNIQUE,
  discord_username TEXT,
  email TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_statics (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  static_id UUID REFERENCES statics(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',  -- 'owner', 'admin', 'member'
  PRIMARY KEY(user_id, static_id)
);

-- ============================================
-- DISCORD INTEGRATION
-- ============================================

CREATE TABLE discord_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  static_id UUID REFERENCES statics(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  webhook_url TEXT,
  
  -- Notification settings
  notify_raid_reminder BOOLEAN DEFAULT TRUE,
  reminder_minutes_before INTEGER DEFAULT 30,
  notify_loot_updates BOOLEAN DEFAULT TRUE,
  notify_gear_sync BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(static_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_players_static ON players(static_id);
CREATE INDEX idx_gear_player ON gear_slots(player_id);
CREATE INDEX idx_loot_static ON loot_history(static_id);
CREATE INDEX idx_sessions_static ON raid_sessions(static_id);
CREATE INDEX idx_strategies_static ON strategies(static_id);
```

---

## Phase Breakdown

### Phase 1: Core MVP (Week 1-2)
**Goal**: Functional replacement for basic spreadsheet tracking

#### Features
- [ ] Create new static (name, tier, timezone)
- [ ] Add/edit/remove players
  - Name, job selection
  - Role auto-assigned from job
  - Notes field
  - Substitute flag
- [ ] Gear tracking per player
  - BiS source selection (Raid/Tome) per slot
  - Have/Augmented checkboxes
  - Auto-calculated stats
- [ ] Team-wide summary panel
  - Total upgrade materials needed (Twine/Glaze/Solvent)
  - Total books needed per floor
  - Team completion percentage
  - Weeks to BiS estimate
- [ ] Shareable link (unique share code)
- [ ] Display order: Tank > Healer > DPS
- [ ] Sort toggle button
- [ ] Dark FFXIV theme
- [ ] Mobile-responsive

#### Technical Tasks
- [ ] React + Vite + TypeScript setup
- [ ] Tailwind CSS with custom theme
- [ ] Component library (PlayerCard, GearTable, etc.)
- [ ] Zustand stores (static, players, gear)
- [ ] FastAPI backend setup
- [ ] PostgreSQL with Supabase
- [ ] CRUD API endpoints
- [ ] Share code generation
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway

### Phase 2: BiS Integration (Week 3-4)
**Goal**: Auto-populate BiS from community tools

#### Features
- [ ] Etro.gg link import
  - Parse gearset ID from URL
  - Fetch gear via API proxy
  - Auto-detect Raid vs Tome from item names
- [ ] XIVGear.app link import
  - Parse UUID from URL
  - Use built-in source metadata
  - Support multi-set sheets
- [ ] Bundled Balance BiS presets
  - Current tier BiS for all jobs
  - "Use Balance BiS" quick button
  - Multiple options per job (SpS vs Crit builds)
- [ ] BiS comparison overlay
  - Current gear vs BiS side-by-side
  - Highlight missing pieces
- [ ] Gear name auto-detection
  - Parse item names to determine source

#### Technical Tasks
- [ ] API proxy endpoints (CORS handling)
- [ ] Etro API client
- [ ] XIVGear API client
- [ ] Item database cache
- [ ] BiS preset JSON files
- [ ] Import modal UI

### Phase 3: Auto-Sync from Lodestone (Week 5-6)
**Goal**: Automatically update gear from character data

#### Features
- [ ] Character linking
  - Search by name + server
  - Confirm with portrait preview
  - Store Lodestone ID
- [ ] Manual sync button
  - Per-player sync
  - "Sync All" for entire static
- [ ] Sync status indicators
  - Last sync timestamp
  - Loading spinner
  - Error states
- [ ] Gear change detection
  - "New this week" badges
  - Changelog of recent changes
- [ ] Sync conflict handling
  - Alert when equipped != BiS
  - Option to update BiS

#### Technical Tasks
- [ ] XIVAPI character endpoint proxy
- [ ] Gear comparison logic
- [ ] Rate limiting / caching
- [ ] Background sync job (optional)

### Phase 4: Loot Distribution & Real-Time (Week 7-8)
**Goal**: Smart loot suggestions + live collaboration

#### Features
- [ ] Floor selector (M1S-M4S)
- [ ] Per-item priority display
  - Who needs each drop
  - Priority score breakdown
  - Clear recommendation
- [ ] Configurable priority rules
  - Role order customization
  - Weight sliders
  - Manual overrides
- [ ] Loot assignment workflow
  - "Give to X" button
  - Auto-update gear status
  - Log to history
- [ ] Loot history view
  - Filterable log
  - Fairness metrics
- [ ] Book tracking
  - Books earned/spent per player
  - "Buy with books" option
- [ ] **Real-time collaboration**
  - WebSocket connection
  - Live cursor indicators (who's editing)
  - Instant sync across clients
  - Conflict resolution

#### Technical Tasks
- [ ] Priority calculation algorithm
- [ ] Loot assignment API
- [ ] WebSocket server setup
- [ ] Real-time state sync
- [ ] Presence indicators
- [ ] Optimistic updates

### Phase 5: Scheduling & Strategies (Week 9-11)
**Goal**: Replace When2Meet + centralize strat docs

#### Features
- [ ] **Raid Schedule**
  - Recurring schedule setup
    - Day of week picker
    - Start/end time
    - Timezone selection
  - Calendar view
    - Month/week views
    - Visual raid blocks
  - Session management
    - Create/cancel individual sessions
    - Add notes ("Prog night", "Reclear")
  - Availability tracking
    - Available / Unavailable / Tentative
    - Visual grid (like When2Meet but better)
    - "I'm available" quick toggle
  - Timezone handling
    - Display in user's local time
    - Show raid time in multiple zones

- [ ] **Strategy Pages**
  - One page per floor (M1S, M2S, M3S, M4S)
  - Rich text editor (Markdown)
  - Section organization
    - Phase breakdowns
    - Mechanic-specific sections
  - Media embeds
    - Image uploads (diagrams)
    - YouTube/Twitch clips
    - FF14 Toolbox links
  - Position assignments
    - Per-mechanic assignments table
    - Visual position grid
    - Player name → position mapping
  - Quick reference mode
    - Simplified view for during raid
    - Large text, key info only

- [ ] **Substitute Tracking**
  - Mark player as sub
  - Sub availability calendar
  - "Looking for sub" status

- [ ] **Player Notes**
  - Free-text notes per player
  - Visible on hover/expand
  - "Availability notes" section

#### Technical Tasks
- [ ] Calendar component (react-big-calendar or custom)
- [ ] Timezone conversion utilities
- [ ] Rich text editor (TipTap or Slate)
- [ ] Image upload (Supabase Storage)
- [ ] Strategy CRUD API
- [ ] Assignment table component

### Phase 6: Progress Tracking & Alts (Week 12-13)
**Goal**: Week-over-week progress visualization + alt support

#### Features
- [ ] **Weekly Snapshots**
  - Auto-save at weekly reset (Tuesday 8am UTC)
  - Manual snapshot creation
- [ ] **Progress Dashboard**
  - Team completion % over time (chart)
  - Individual player progress
  - Weeks remaining estimate
  - Projected completion date
- [ ] **Changelog View**
  - "This week: Lloyd got Chest, Theo got Twine"
  - Filter by player, item type, week
- [ ] **Milestones**
  - First clear celebration
  - BiS complete badge
  - Team achievements
- [ ] **Alt Character Support**
  - Add multiple characters per player
  - Switch "active" character
  - Separate gear tracking per alt
  - Alt job selection

#### Technical Tasks
- [ ] Snapshot scheduling (cron job)
- [ ] Progress chart components (Recharts)
- [ ] Alt character CRUD
- [ ] Active character switcher

### Phase 7: FFLogs Integration (Week 14-15)
**Goal**: Parse tracking and raid analysis links

#### Features
- [ ] **FFLogs Character Linking**
  - Link via character ID
  - OAuth for private logs (optional)
- [ ] **Parse Display**
  - Latest parse percentile per player
  - Historical parse trend (chart)
  - Per-fight breakdown
- [ ] **Report Linking**
  - Link reports to raid sessions
  - Quick access to recent reports
- [ ] **Analysis Integration**
  - "View in XIVAnalysis" button
  - Per-player analysis links
  - Improvement suggestions display
- [ ] **Raid Session Logs**
  - List of parses from last raid night
  - Click player → see their analysis
  - "What went well / could improve" notes

#### Technical Tasks
- [ ] FFLogs GraphQL client
- [ ] OAuth flow (optional)
- [ ] Parse display components
- [ ] XIVAnalysis link generation
- [ ] Report linking UI

### Phase 8: Discord Bot & PWA (Week 16-17)
**Goal**: Notifications + offline support

#### Features
- [ ] **Discord Bot**
  - Add to server flow
  - Link to static
  - Channel selection
  - **Raid Reminders**
    - Configurable timing (30 min, 1 hour, etc.)
    - "Raid starts in 30 minutes!"
    - Include who's marked unavailable
  - **Loot Priority Summary**
    - Post before raid starts
    - "Tonight's loot priority for M2S: Head → Theo, Lloyd; Hands → Ferus..."
  - **Gear Update Notifications**
    - "Lloyd synced gear: Got Chest!"
  - **Weekly Summary**
    - End of week recap
    - Loot distributed, progress made

- [ ] **PWA / Offline Mode**
  - Install prompt
  - Offline viewing of static data
  - Queue changes when offline
  - Sync when back online
  - Works during raid without internet

#### Technical Tasks
- [ ] discord.py bot setup
- [ ] Bot command handlers
- [ ] Scheduled task system (Celery)
- [ ] Webhook message formatting
- [ ] Service Worker setup (Workbox)
- [ ] IndexedDB for offline storage
- [ ] Sync queue implementation

### Phase 9: Auth & History (Week 18+)
**Goal**: Optional accounts for power users

#### Features
- [ ] **Discord OAuth Login**
  - One-click login
  - Link Discord profile
- [ ] **Claim Static**
  - Convert anonymous static to owned
  - Transfer ownership
- [ ] **Personal Dashboard**
  - All statics you're in
  - Quick switch between statics
  - Historical archive
- [ ] **Cross-Static Profile**
  - See your progress across multiple statics
  - Career loot history
- [ ] **Admin Features**
  - Role management (owner/admin/member)
  - Lock static (prevent edits)
  - Delete static

#### Technical Tasks
- [ ] Discord OAuth implementation
- [ ] JWT token management
- [ ] User dashboard
- [ ] Permission system

---

## API Endpoints

### Statics
```
GET    /api/statics/:shareCode         - Get static by share code
POST   /api/statics                    - Create new static
PUT    /api/statics/:id                - Update static settings
DELETE /api/statics/:id                - Delete static
GET    /api/statics/:id/summary        - Get team-wide summary stats
```

### Players
```
GET    /api/statics/:id/players        - Get all players
POST   /api/statics/:id/players        - Add player
PUT    /api/players/:id                - Update player
DELETE /api/players/:id                - Remove player
PUT    /api/players/:id/substitute     - Toggle substitute status
POST   /api/players/:id/sync           - Sync from Lodestone
```

### Alts
```
GET    /api/players/:id/alts           - Get player's alts
POST   /api/players/:id/alts           - Add alt character
PUT    /api/players/:id/alts/:altId    - Update alt
DELETE /api/players/:id/alts/:altId    - Remove alt
PUT    /api/players/:id/alts/:altId/activate - Set as active
```

### Gear
```
GET    /api/players/:id/gear           - Get player gear status
PUT    /api/players/:id/gear           - Bulk update gear
PUT    /api/players/:id/gear/:slot     - Update single slot
POST   /api/players/:id/gear/import    - Import from Etro/XIVGear
```

### Loot
```
GET    /api/statics/:id/loot           - Get loot history
POST   /api/statics/:id/loot           - Record loot distribution
GET    /api/statics/:id/loot/priority/:floor - Get priority for floor
GET    /api/statics/:id/books          - Get book progress
PUT    /api/players/:id/books/:floor   - Update book count
```

### Schedule
```
GET    /api/statics/:id/schedule       - Get raid schedule
PUT    /api/statics/:id/schedule       - Update schedule
GET    /api/statics/:id/sessions       - Get raid sessions
POST   /api/statics/:id/sessions       - Create session
PUT    /api/sessions/:id               - Update session
DELETE /api/sessions/:id               - Cancel session
PUT    /api/sessions/:id/availability  - Update player availability
```

### Strategies
```
GET    /api/statics/:id/strategies            - Get all strategies
GET    /api/statics/:id/strategies/:floor     - Get floor strategy
PUT    /api/statics/:id/strategies/:floor     - Update strategy
GET    /api/strategies/:id/sections           - Get sections
POST   /api/strategies/:id/sections           - Add section
PUT    /api/strategies/sections/:id           - Update section
DELETE /api/strategies/sections/:id           - Remove section
PUT    /api/strategies/:id/assignments        - Update assignments
```

### Progress
```
GET    /api/statics/:id/snapshots      - Get weekly snapshots
POST   /api/statics/:id/snapshots      - Create manual snapshot
GET    /api/statics/:id/progress       - Get progress stats
GET    /api/statics/:id/changelog      - Get recent changes
```

### Discord
```
GET    /api/statics/:id/discord        - Get Discord integration
POST   /api/statics/:id/discord        - Setup Discord integration
PUT    /api/statics/:id/discord        - Update settings
DELETE /api/statics/:id/discord        - Remove integration
POST   /api/statics/:id/discord/test   - Send test message
```

### Sync Proxies
```
GET    /api/proxy/xivapi/character/search  - Search character
GET    /api/proxy/xivapi/character/:id     - Get character data
GET    /api/proxy/etro/:gearsetId          - Get Etro gearset
GET    /api/proxy/xivgear/:uuid            - Get XIVGear set
GET    /api/proxy/fflogs/character/:id     - Get FFLogs data
```

### Real-Time (WebSocket)
```
WS     /ws/static/:shareCode           - Real-time updates
  -> join                              - Join static room
  -> leave                             - Leave room
  -> gear_update                       - Gear changed
  -> player_update                     - Player changed
  -> loot_assigned                     - Loot distributed
  -> presence                          - Who's viewing
```

---

## File Structure

```
ffxiv-raid-planner/
├── frontend/
│   ├── public/
│   │   ├── icons/                    # PWA icons
│   │   └── manifest.json             # PWA manifest
│   ├── src/
│   │   ├── components/
│   │   │   ├── player/
│   │   │   │   ├── PlayerCard.tsx
│   │   │   │   ├── PlayerHeader.tsx
│   │   │   │   ├── GearTable.tsx
│   │   │   │   ├── GearSlotRow.tsx
│   │   │   │   └── PlayerNotes.tsx
│   │   │   ├── team/
│   │   │   │   ├── TeamSummary.tsx
│   │   │   │   ├── UpgradeMaterialsPanel.tsx
│   │   │   │   └── BooksNeededPanel.tsx
│   │   │   ├── loot/
│   │   │   │   ├── LootPriorityPanel.tsx
│   │   │   │   ├── FloorSelector.tsx
│   │   │   │   ├── LootHistory.tsx
│   │   │   │   └── BookTracker.tsx
│   │   │   ├── schedule/
│   │   │   │   ├── RaidCalendar.tsx
│   │   │   │   ├── ScheduleSetup.tsx
│   │   │   │   ├── AvailabilityGrid.tsx
│   │   │   │   ├── SessionCard.tsx
│   │   │   │   └── TimezoneSelector.tsx
│   │   │   ├── strategy/
│   │   │   │   ├── StrategyPage.tsx
│   │   │   │   ├── StrategyEditor.tsx
│   │   │   │   ├── SectionEditor.tsx
│   │   │   │   ├── AssignmentTable.tsx
│   │   │   │   ├── PositionGrid.tsx
│   │   │   │   └── QuickReference.tsx
│   │   │   ├── progress/
│   │   │   │   ├── ProgressDashboard.tsx
│   │   │   │   ├── ProgressChart.tsx
│   │   │   │   ├── Changelog.tsx
│   │   │   │   └── Milestones.tsx
│   │   │   ├── analysis/
│   │   │   │   ├── ParseDisplay.tsx
│   │   │   │   ├── ParseHistory.tsx
│   │   │   │   ├── RaidSessionLogs.tsx
│   │   │   │   └── AnalysisLinks.tsx
│   │   │   ├── ui/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Select.tsx
│   │   │   │   ├── Checkbox.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Tooltip.tsx
│   │   │   │   └── LoadingSpinner.tsx
│   │   │   └── layout/
│   │   │       ├── Header.tsx
│   │   │       ├── Sidebar.tsx
│   │   │       ├── Navigation.tsx
│   │   │       └── Footer.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── CreateStatic.tsx
│   │   │   ├── StaticView.tsx
│   │   │   ├── GearTracker.tsx
│   │   │   ├── LootManager.tsx
│   │   │   ├── Schedule.tsx
│   │   │   ├── Strategy.tsx
│   │   │   ├── Progress.tsx
│   │   │   ├── Analysis.tsx
│   │   │   └── Settings.tsx
│   │   ├── stores/
│   │   │   ├── staticStore.ts
│   │   │   ├── playerStore.ts
│   │   │   ├── gearStore.ts
│   │   │   ├── scheduleStore.ts
│   │   │   ├── strategyStore.ts
│   │   │   └── websocketStore.ts
│   │   ├── hooks/
│   │   │   ├── useCalculations.ts
│   │   │   ├── useGearSync.ts
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useTimezone.ts
│   │   │   └── useOffline.ts
│   │   ├── utils/
│   │   │   ├── gearCalculations.ts
│   │   │   ├── priorityCalculations.ts
│   │   │   ├── constants.ts
│   │   │   ├── formatters.ts
│   │   │   └── timezone.ts
│   │   ├── types/
│   │   │   ├── index.ts
│   │   │   ├── gear.ts
│   │   │   ├── player.ts
│   │   │   ├── schedule.ts
│   │   │   └── strategy.ts
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── endpoints.ts
│   │   │   └── websocket.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── sw.ts                     # Service Worker
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── statics.py
│   │   │   ├── players.py
│   │   │   ├── gear.py
│   │   │   ├── loot.py
│   │   │   ├── schedule.py
│   │   │   ├── strategies.py
│   │   │   ├── progress.py
│   │   │   ├── discord.py
│   │   │   ├── sync.py
│   │   │   └── websocket.py
│   │   ├── models/
│   │   │   ├── database.py
│   │   │   ├── schemas.py
│   │   │   └── enums.py
│   │   ├── services/
│   │   │   ├── gear_calculator.py
│   │   │   ├── priority_calculator.py
│   │   │   ├── xivapi_client.py
│   │   │   ├── etro_client.py
│   │   │   ├── xivgear_client.py
│   │   │   ├── fflogs_client.py
│   │   │   ├── snapshot_service.py
│   │   │   └── discord_service.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── websocket_manager.py
│   │   └── main.py
│   ├── tests/
│   │   ├── test_gear.py
│   │   ├── test_priority.py
│   │   └── test_api.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── bot/
│   ├── cogs/
│   │   ├── reminders.py
│   │   ├── notifications.py
│   │   └── commands.py
│   ├── utils/
│   │   └── formatters.py
│   ├── main.py
│   └── requirements.txt
│
├── docs/
│   ├── IMPLEMENTATION_PLAN.md
│   ├── ARCHITECTURE_SPEC.md
│   ├── GEAR_LOGIC_RESEARCH.md
│   └── API.md
│
├── docker-compose.yml
├── README.md
└── LICENSE
```

---

## UI/UX Guidelines

### Color Palette
```css
:root {
  /* Backgrounds */
  --bg-primary: #0a0a12;
  --bg-secondary: #12121a;
  --bg-card: rgba(20, 20, 30, 0.9);
  --bg-hover: rgba(40, 40, 50, 0.8);
  
  /* Accent */
  --accent-gold: #c9a227;
  --accent-gold-dim: rgba(201, 162, 39, 0.3);
  --accent-gold-bright: #e0b830;
  
  /* Roles */
  --role-tank: #4a90c2;
  --role-healer: #4ab87a;
  --role-melee: #c24a4a;
  --role-ranged: #c29a4a;
  --role-caster: #a24ac2;
  
  /* Gear Sources */
  --source-raid: #c44444;
  --source-tome: #44aa44;
  --source-crafted: #aa8844;
  
  /* Status */
  --status-success: #44aa44;
  --status-warning: #aaaa44;
  --status-error: #aa4444;
  --status-info: #4488aa;
  
  /* Text */
  --text-primary: #ffffff;
  --text-secondary: #aaaaaa;
  --text-muted: #666666;
  
  /* Borders */
  --border-default: #444444;
  --border-highlight: #c9a227;
}
```

### Typography
- **Headers**: Cinzel (Google Fonts) - FFXIV aesthetic
- **Body**: System fonts for performance
- **Monospace**: JetBrains Mono (for codes, IDs)

### Navigation Structure
```
┌─────────────────────────────────────────────┐
│  [Logo] Static Name          [Share] [Sync] │
├─────────────────────────────────────────────┤
│  Gear | Loot | Schedule | Strategy | More ▼ │
├─────────────────────────────────────────────┤
│                                             │
│              Page Content                   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Success Metrics

1. **Adoption**: Statics created, daily active statics
2. **Engagement**: Page views, session duration
3. **Time Saved**: Estimated reduction in manual updates
4. **Sync Success Rate**: % of successful Lodestone syncs
5. **Feature Usage**: Which features are most used
6. **User Satisfaction**: Feedback, NPS score

---

## Potential Gotchas & Solutions

| Issue | Solution |
|-------|----------|
| XIVAPI rate limits | Aggressive caching, batch requests |
| Lodestone maintenance | Graceful fallback, show last known data |
| Gear name matching | Fuzzy matching, item ID lookup |
| Ring slots (2 of same) | Track as ring1/ring2 with notes |
| Timezone confusion | Always store UTC, display in user's TZ |
| WebSocket disconnects | Auto-reconnect with exponential backoff |
| Offline data conflicts | Last-write-wins with conflict UI |
| Large static history | Pagination, lazy loading |

---

## Getting Started with Claude Code

1. **Create GitHub repo**: `ffxiv-raid-planner`
2. **Copy docs to `/docs`**: All markdown files
3. **Initialize frontend**:
   ```bash
   cd frontend
   pnpm create vite . --template react-ts
   pnpm add tailwindcss postcss autoprefixer zustand react-router-dom
   ```
4. **Initialize backend**:
   ```bash
   cd backend
   pip install fastapi uvicorn sqlalchemy psycopg2-binary
   ```
5. **Start Phase 1**: Build core components

Reference this document throughout development. Each phase builds on the previous.

Let's build something awesome! 🎮⚔️
