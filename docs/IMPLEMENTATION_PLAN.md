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
| 1 | Core MVP (Frontend) | **Complete** |
| 2 | UX Enhancements | **Complete** |
| 3 | Backend + Persistence | **Complete** |
| 4 | User Accounts + Multi-Tier Roster | **In Progress** |
| 5 | BiS Integration | Not Started |
| 6 | Lodestone Auto-Sync | Not Started |
| 7 | Loot Distribution + Real-Time | Not Started |
| 8 | Scheduling + Strategies | Not Started |
| 9 | Progress Tracking + Alts | Not Started |
| 10 | FFLogs Integration | Not Started |
| 11 | Discord Bot + PWA | Not Started |

> **Note:** Phase 4 was significantly expanded based on user feedback. It now includes Discord OAuth, multi-static membership, per-tier roster snapshots, and access control. The original "BiS Integration" moved to Phase 5.
> See `docs/IMPLEMENTATION_PLAN_PHASE2.md` for detailed Phase 2 implementation specs.

---

## Phase 1: Core MVP (Complete)

### Frontend

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

---

## Phase 2: UX Enhancements (Complete)

See `docs/IMPLEMENTATION_PLAN_PHASE2.md` for detailed implementation specs.

### Features
- [x] Tab-based navigation (Players / Loot / Stats)
- [x] Responsive 4-column grid (1→2→3→4 columns at breakpoints)
- [x] Global view mode toggle (▤ compact / ☰ expanded)
- [x] Individual card expand/collapse (hybrid with global)
- [x] Player card needs footer (Raid Need / Tome Need / Upgrades / Tome Wks)
- [x] Double-click name to edit
- [x] Tome weapon sub-row tracking (interim upgrade during prog)
- [x] Right-click context menu (Copy / Paste / Duplicate / Mark as Sub / Remove)
- [x] Raid positions (T1/T2/H1/H2/M1/M2/R1/R2) with role coloring
- [x] Tank role designation (MT/OT badges)
- [x] Sort presets and drag-and-drop reordering
- [x] Group view (G1/G2) by light party
- [x] Cross-group drag position swap
- [x] Wide container layout (120rem / 1920px)
- [x] Header consolidation (centered title, Add Player in header)
- [x] Role-based player slot templates
- [x] Job picker role sorting

### Components Created
- [x] `TabNavigation.tsx` - Page-level tabs with FFXIV icons
- [x] `ViewModeToggle.tsx` - ▤/☰ toggle
- [x] `LootModeView.tsx` - Full-screen loot distribution
- [x] `LootItemCard.tsx` - Item with priority list
- [x] `StatsView.tsx` - Full-page team stats
- [x] `NeedsFooter.tsx` - 4-stat footer
- [x] `WeaponSlotRow.tsx` - Weapon with tome sub-row
- [x] `ContextMenu.tsx` - Right-click menu with FFXIV icons
- [x] `SortModeSelector.tsx` - Sort preset dropdown
- [x] `GroupViewToggle.tsx` - G1/G2 toggle
- [x] `RoleJobSelector.tsx` - Job selection with template role filtering
- [x] `PositionSelector.tsx` - Raid position picker
- [x] `TankRoleSelector.tsx` - MT/OT designation
- [x] `SortablePlayerCard.tsx` - Drag-and-drop wrapper

### Components Modified
- [x] `StaticView.tsx` - Tab navigation, 4-column grid, drag-and-drop
- [x] `PlayerCard.tsx` - Global view mode, context menu, name edit, job picker
- [x] `GearTable.tsx` - Weapon sub-row integration
- [x] `EmptySlotCard.tsx` - Role-based styling, template roles
- [x] `Header.tsx` - Centered title, Add Player button
- [x] `Layout.tsx` - Wide container (120rem)
- [x] `staticStore.ts` - pageMode, clipboardPlayer, tomeWeapon, reorderPlayers
- [x] `types/index.ts` - TomeWeaponStatus, RaidPosition, TemplateRole, etc.

---

## Phase 3: Backend + Persistence (Complete)

FastAPI backend with SQLite (local dev) and PostgreSQL support (production-ready).

### Setup
- [x] FastAPI project structure
- [x] SQLAlchemy async setup with SQLite/PostgreSQL
- [x] Environment configuration (.env)
- [x] CORS setup for frontend

### Database
- [x] statics table
- [x] players table (gear stored as JSON)
- [x] Share code generation (6-character alphanumeric)

### API Endpoints
- [x] POST `/api/statics` - Create static
- [x] GET `/api/statics/{shareCode}` - Get by share code
- [x] PUT `/api/statics/{id}` - Update static
- [x] DELETE `/api/statics/{id}` - Delete static
- [x] POST `/api/statics/{id}/players` - Add player
- [x] PUT `/api/statics/{id}/players/{playerId}` - Update player
- [x] DELETE `/api/statics/{id}/players/{playerId}` - Remove player

### Deployment
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway

---

## Phase 4: User Accounts + Multi-Tier Roster Management (In Progress)

**This phase transforms the app from anonymous share-codes to a proper team management platform.**

### 4.1 Authentication Foundation (In Progress)
- [x] Add auth dependencies (python-jose, httpx)
- [x] Create User model and schema
- [x] Add Discord OAuth config
- [x] Implement Discord OAuth flow
- [x] Add JWT middleware with refresh tokens
- [x] Create auth dependencies for protected routes
- [x] Create authStore.ts (frontend)
- [ ] Add LoginButton.tsx and UserMenu.tsx components
- [ ] Add ProtectedRoute.tsx wrapper
- [ ] Update Header with user avatar/menu

### 4.2 Static Groups + Memberships
- [ ] Create static_groups, memberships tables
- [ ] Implement static group CRUD endpoints
- [ ] Implement membership management endpoints
- [ ] Add permission checking utilities
- [ ] Create staticGroupStore.ts
- [ ] Build Dashboard page (/dashboard)
- [ ] Add StaticGroupSelector dropdown to Header
- [ ] Create member management UI

### 4.3 Tier Snapshots + Rollover
- [ ] Create tier_snapshots, snapshot_players tables
- [ ] Implement tier snapshot CRUD endpoints
- [ ] Implement rollover logic (copy roster, optionally reset gear)
- [ ] Update player endpoints to use snapshot context
- [ ] Add TierSelector dropdown to Header
- [ ] Refactor StaticView to load tier snapshots
- [ ] Create RolloverDialog component
- [ ] Handle tier switching in store

### 4.4 Invitations System
- [ ] Create invitations table
- [ ] Implement invitation CRUD (create, list, revoke)
- [ ] Implement invitation accept flow
- [ ] Add permission gates on all endpoints
- [ ] Create invitation management panel
- [ ] Add invitation accept page (/invite/{code})
- [ ] Add PermissionGate component for role-based UI

### 4.5 Legacy Migration
- [ ] Create legacy_static_claims table
- [ ] Implement claim code generation
- [ ] Implement claim flow (share code → claim code → ownership)
- [ ] Create data migration script
- [ ] Add claim page (/claim)
- [ ] Show claim prompts in dashboard for unclaimed statics

### New Data Model

```
User (Discord OAuth)
├── id, discord_id, discord_username, avatar
└── memberships[]

StaticGroup ("Girliepops", "Hardcore Raiders")
├── id, name, owner_id
├── share_code (for public viewer access)
├── is_public (default: false - only members can view)
├── members[] with roles
└── tierSnapshots[]

TierSnapshot (one per raid tier per group)
├── id, static_group_id, tier_id ("aac-cruiserweight")
├── content_type: "savage" | "ultimate" (future)
├── is_active (current working tier)
└── players[] (roster for this tier)

Membership (user <-> static relationship)
├── user_id, static_group_id
└── role: owner | lead | member | viewer

SnapshotPlayer (replaces current Player)
├── tier_snapshot_id (instead of static_id)
├── user_id (optional - links to account for self-service)
└── ...same fields as current Player
```

### Access Control Matrix

| Action | Owner | Lead | Member | Viewer |
|--------|-------|------|--------|--------|
| View roster | Yes | Yes | Yes | If public |
| Edit own character gear | Yes | Yes | Yes | No |
| Edit any character | Yes | Yes | No | No |
| Add/remove players | Yes | Yes | No | No |
| Rollover tier | Yes | Yes | No | No |
| Manage members | Yes | Yes | No | No |
| Change public/private | Yes | No | No | No |
| Delete static group | Yes | No | No | No |

### New Environment Variables

```env
# Discord OAuth
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=http://localhost:5173/auth/callback

# JWT
JWT_SECRET_KEY=
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Frontend
FRONTEND_URL=http://localhost:5173
```

### Future: Ultimate Support

Ultimates are fundamentally different from Savage:
- Savage: Track gear progression (Raid vs Tome, Have/Augmented)
- Ultimate: BiS is fixed pre-raid; no gear progression

The `content_type` field on TierSnapshot enables future Ultimate support:
- Add "ultimate" content type
- Create UltimatePlayerCard (simpler than current)
- Track prog phases instead of floors (P1, P2, Adds, etc.)
- BiS validation instead of gear tracking

---

## Phase 5: BiS Integration

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

## Phase 6: Lodestone Auto-Sync

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

## Phase 7: Loot Distribution + Real-Time

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

## Phase 8: Scheduling + Strategies

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

## Phase 9: Progress Tracking + Alts

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

## Phase 10: FFLogs Integration

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

## Phase 11: Discord Bot + PWA

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

## Database Schema

### Legacy Tables (Phase 1-3)
```sql
-- Legacy tables still in use until Phase 4 migration
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
  gear JSONB DEFAULT '[]',
  tome_weapon JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_players_static ON players(static_id);
CREATE INDEX idx_statics_share_code ON statics(share_code);
```

### Phase 4 Tables (User Accounts + Multi-Tier)
```sql
-- Users (Discord OAuth)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  discord_id VARCHAR(20) UNIQUE NOT NULL,
  discord_username VARCHAR(100) NOT NULL,
  discord_discriminator VARCHAR(10),
  discord_avatar VARCHAR(255),
  email VARCHAR(255),
  display_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Static groups (persistent team identity)
CREATE TABLE static_groups (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  share_code VARCHAR(8) UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id),
  is_public BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memberships (user <-> static group relationship)
CREATE TABLE memberships (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  static_group_id UUID NOT NULL REFERENCES static_groups(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'lead', 'member', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, static_group_id)
);

-- Tier snapshots (roster state for a specific tier)
CREATE TABLE tier_snapshots (
  id UUID PRIMARY KEY,
  static_group_id UUID NOT NULL REFERENCES static_groups(id) ON DELETE CASCADE,
  tier_id VARCHAR(50) NOT NULL,
  tier_name VARCHAR(100) NOT NULL,
  content_type VARCHAR(20) DEFAULT 'savage',
  is_active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(static_group_id, tier_id)
);

-- Player slots within a tier snapshot
CREATE TABLE snapshot_players (
  id UUID PRIMARY KEY,
  tier_snapshot_id UUID NOT NULL REFERENCES tier_snapshots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  name VARCHAR(100) NOT NULL DEFAULT '',
  job VARCHAR(10) NOT NULL DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT '',
  position VARCHAR(5),
  tank_role VARCHAR(5),
  template_role VARCHAR(20),
  configured BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  is_substitute BOOLEAN DEFAULT FALSE,
  notes TEXT,
  lodestone_id VARCHAR(50),
  bis_link TEXT,
  gear JSONB DEFAULT '[]',
  tome_weapon JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invitations for joining statics
CREATE TABLE invitations (
  id UUID PRIMARY KEY,
  static_group_id UUID NOT NULL REFERENCES static_groups(id) ON DELETE CASCADE,
  code VARCHAR(12) UNIQUE NOT NULL,
  target_role VARCHAR(20) NOT NULL CHECK (target_role IN ('lead', 'member')),
  max_uses INTEGER,
  uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy static migration tracking
CREATE TABLE legacy_static_claims (
  id UUID PRIMARY KEY,
  legacy_static_id VARCHAR(36) NOT NULL,
  legacy_share_code VARCHAR(6) NOT NULL,
  claimed_by UUID REFERENCES users(id),
  claim_code VARCHAR(8) NOT NULL,
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_discord_id ON users(discord_id);
CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_static_group_id ON memberships(static_group_id);
CREATE INDEX idx_tier_snapshots_static_group_id ON tier_snapshots(static_group_id);
CREATE INDEX idx_snapshot_players_tier_snapshot_id ON snapshot_players(tier_snapshot_id);
CREATE INDEX idx_snapshot_players_user_id ON snapshot_players(user_id);
CREATE INDEX idx_invitations_code ON invitations(code);
CREATE INDEX idx_static_groups_share_code ON static_groups(share_code);
```

---

## API Endpoints Reference

### Legacy Statics (Phase 1-3)
```
GET    /api/statics/:shareCode     - Get static by share code
POST   /api/statics                - Create new static
PUT    /api/statics/:id            - Update static settings
DELETE /api/statics/:id            - Delete static
POST   /api/statics/:id/players    - Add player
PUT    /api/statics/:id/players/:playerId  - Update player
DELETE /api/statics/:id/players/:playerId  - Remove player
```

### Authentication (Phase 4)
```
GET    /api/auth/discord           - Get Discord OAuth URL
POST   /api/auth/discord/callback  - Handle OAuth callback, return tokens
POST   /api/auth/refresh           - Refresh access token
POST   /api/auth/logout            - Logout (invalidate session)
GET    /api/auth/me                - Get current user info
```

### Static Groups (Phase 4)
```
GET    /api/static-groups                    - List user's static groups
POST   /api/static-groups                    - Create new static group
GET    /api/static-groups/:id                - Get static group details
GET    /api/static-groups/by-code/:code      - Viewer access via share code
PUT    /api/static-groups/:id                - Update static group
DELETE /api/static-groups/:id                - Delete static group (owner only)
```

### Memberships (Phase 4)
```
GET    /api/static-groups/:id/members        - List members
POST   /api/static-groups/:id/members        - Add member directly
PUT    /api/static-groups/:id/members/:userId - Update member role
DELETE /api/static-groups/:id/members/:userId - Remove member
POST   /api/static-groups/:id/leave          - Leave static group
```

### Tier Snapshots (Phase 4)
```
GET    /api/static-groups/:id/tiers              - List tier snapshots
POST   /api/static-groups/:id/tiers              - Create tier snapshot
GET    /api/static-groups/:id/tiers/:tierId      - Get tier with players
PUT    /api/static-groups/:id/tiers/:tierId      - Update tier settings
DELETE /api/static-groups/:id/tiers/:tierId      - Delete tier snapshot
POST   /api/static-groups/:id/tiers/:tierId/rollover - Copy roster to new tier
```

### Players in Tier (Phase 4)
```
GET    /api/tiers/:snapshotId/players            - List players
POST   /api/tiers/:snapshotId/players            - Add player
PUT    /api/tiers/:snapshotId/players/:id        - Update player
DELETE /api/tiers/:snapshotId/players/:id        - Remove player
POST   /api/tiers/:snapshotId/players/:id/link   - Link player to user account
```

### Invitations (Phase 4)
```
POST   /api/static-groups/:id/invitations   - Create invitation
GET    /api/static-groups/:id/invitations   - List invitations
DELETE /api/invitations/:id                 - Revoke invitation
POST   /api/invitations/:code/accept        - Accept invitation
```

### Legacy Migration (Phase 4)
```
POST   /api/migrate/claim-code              - Generate claim code for legacy static
POST   /api/migrate/claim                   - Claim legacy static with code
```

### Sync Proxies (Phase 5-6)
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
