# Multi-Static Membership + Per-Tier Roster Snapshots

## Overview

Transform the FFXIV Raid Planner from an anonymous share-code system to a user account system with:
- **Multi-static membership** - Users can be in multiple statics
- **Per-tier roster snapshots** - Each raid tier has its own roster state
- **Access control** - Owner/Lead/Member/Viewer permissions
- **Dashboard UX** - Static selector + Tier selector in header

---

## New Data Model

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

---

## Access Control

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

### Public vs Private Statics
- **Private (default)**: Only logged-in members can view
- **Public**: Anyone with share code can view (anonymous) - useful when lead manages everything
- Setting controlled by owner only

---

## Implementation Phases

### Phase 4.1: Authentication Foundation

**Backend:**
- [ ] Add auth dependencies (`authlib`, `python-jose`, `httpx`)
- [ ] Create `users` table and model
- [ ] Implement Discord OAuth flow (`/api/auth/discord`, callback)
- [ ] Add JWT middleware with refresh tokens
- [ ] Create auth dependencies for protected routes

**Frontend:**
- [ ] Create `authStore.ts` (user state, login/logout)
- [ ] Add `LoginButton.tsx`, `UserMenu.tsx` components
- [ ] Add `ProtectedRoute.tsx` wrapper
- [ ] Update Header with user avatar/menu

**Files:**
- `backend/requirements.txt`
- `backend/app/config.py`
- `backend/app/models/user.py` (new)
- `backend/app/routers/auth.py` (new)
- `frontend/src/stores/authStore.ts` (new)
- `frontend/src/components/auth/*` (new)

---

### Phase 4.2: Static Groups + Memberships

**Backend:**
- [ ] Create `static_groups`, `memberships` tables
- [ ] Implement static group CRUD endpoints
- [ ] Implement membership management endpoints
- [ ] Add permission checking utilities

**Frontend:**
- [ ] Create `staticGroupStore.ts`
- [ ] Build Dashboard page (`/dashboard`)
- [ ] Add `StaticGroupSelector` dropdown to Header
- [ ] Create member management UI

**Files:**
- `backend/app/models/static_group.py` (new)
- `backend/app/models/membership.py` (new)
- `backend/app/routers/static_groups.py` (new)
- `frontend/src/pages/Dashboard.tsx` (new)
- `frontend/src/stores/staticGroupStore.ts` (new)

---

### Phase 4.3: Tier Snapshots + Rollover

**Backend:**
- [ ] Create `tier_snapshots`, `snapshot_players` tables
- [ ] Implement tier snapshot CRUD endpoints
- [ ] Implement rollover logic (copy roster, optionally reset gear)
- [ ] Update player endpoints to use snapshot context

**Frontend:**
- [ ] Add `TierSelector` dropdown to Header
- [ ] Refactor `StaticView` to load tier snapshots
- [ ] Create `RolloverDialog` component
- [ ] Handle tier switching in store

**Files:**
- `backend/app/models/tier_snapshot.py` (new)
- `backend/app/routers/tiers.py` (new)
- `frontend/src/pages/StaticView.tsx` (refactor)
- `frontend/src/components/static-group/TierSelector.tsx` (new)
- `frontend/src/components/static-group/RolloverDialog.tsx` (new)

---

### Phase 4.4: Invitations System

**Backend:**
- [ ] Create `invitations` table
- [ ] Implement invitation CRUD (create, list, revoke)
- [ ] Implement invitation accept flow
- [ ] Add permission gates on all endpoints

**Frontend:**
- [ ] Create invitation management panel
- [ ] Add invitation accept page (`/invite/{code}`)
- [ ] Add `PermissionGate` component for role-based UI

**Files:**
- `backend/app/models/invitation.py` (new)
- `backend/app/routers/invitations.py` (new)
- `frontend/src/pages/InviteAccept.tsx` (new)
- `frontend/src/components/permissions/PermissionGate.tsx` (new)

---

### Phase 4.5: Legacy Migration

**Backend:**
- [ ] Create `legacy_static_claims` table
- [ ] Implement claim code generation
- [ ] Implement claim flow (share code → claim code → ownership)
- [ ] Create data migration script

**Frontend:**
- [ ] Add claim page (`/claim`)
- [ ] Show claim prompts in dashboard for unclaimed statics
- [ ] Update Home page with migration info

**Strategy:**
1. Keep legacy `statics` table working (backward compatible)
2. Users can claim legacy statics via share code
3. Claimed statics migrate to new model with user as owner

---

## API Endpoints Summary

### Authentication
```
POST /api/auth/discord           # Initiate Discord OAuth
GET  /api/auth/discord/callback  # Handle callback
POST /api/auth/logout            # Clear session
GET  /api/auth/me                # Get current user
```

### Static Groups
```
GET    /api/static-groups                    # List user's groups
POST   /api/static-groups                    # Create new group
GET    /api/static-groups/{id}               # Get group details
GET    /api/static-groups/by-code/{code}     # Viewer access
DELETE /api/static-groups/{id}               # Delete (owner only)
```

### Tiers
```
GET    /api/static-groups/{id}/tiers              # List tier snapshots
POST   /api/static-groups/{id}/tiers              # Create tier snapshot
GET    /api/static-groups/{id}/tiers/{tierId}     # Get tier with players
POST   /api/static-groups/{id}/tiers/{tierId}/rollover  # Copy roster
```

### Players (within tier)
```
GET    /api/tiers/{snapshotId}/players            # List players
POST   /api/tiers/{snapshotId}/players            # Add player
PUT    /api/tiers/{snapshotId}/players/{id}       # Update player
DELETE /api/tiers/{snapshotId}/players/{id}       # Remove player
```

---

## Environment Variables (New)

```env
# Discord OAuth
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=http://localhost:5173/api/auth/discord/callback

# JWT
JWT_SECRET_KEY=
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Frontend
VITE_DISCORD_CLIENT_ID=
```

---

## UX Flow

### Header Layout (Logged In)
```
[Logo] [Static: Girliepops ▼] [Tier: M5S-M8S ▼]  [Party][Loot][Stats]  [Avatar ▼]
```

### Dashboard
- Cards for each static user is in
- Role badge (Owner/Lead/Member)
- Quick stats (completion %, active tier)
- Create new static button

### Rollover Dialog
```
┌─────────────────────────────────────────┐
│ Roll Over to New Tier                   │
├─────────────────────────────────────────┤
│ Source: AAC Light-heavyweight (M1S-M4S) │
│ Target: AAC Cruiserweight (M5S-M8S) ▼   │
│                                         │
│ ○ Copy players with current gear        │
│ ● Copy players with gear reset          │
│                                         │
│           [Cancel]  [Roll Over]         │
└─────────────────────────────────────────┘
```

---

## Critical Files to Modify

### Backend
- `backend/app/database.py` - Add migration support
- `backend/app/models/` - New models for users, groups, tiers
- `backend/app/routers/` - New routers for auth, groups, tiers
- `backend/app/config.py` - Discord OAuth config

### Frontend
- `frontend/src/stores/staticStore.ts` → Split into `authStore` + `staticGroupStore`
- `frontend/src/pages/StaticView.tsx` - Load tier snapshot instead of static
- `frontend/src/components/layout/Header.tsx` - Add selectors + user menu
- `frontend/src/App.tsx` - Add new routes, protected route wrapper

---

## Design Decisions (Resolved)

1. **Viewer access** - Anonymous for public statics, login required for private (default)
2. **Self-service linking** - Members can link their own account to a player slot
3. **Tier history** - Keep all tiers accessible (no archiving)

---

## Future Consideration: Ultimate Support

Ultimates are fundamentally different from Savage:
- **Savage**: Track gear progression (Raid vs Tome, Have/Augmented)
- **Ultimate**: BiS is fixed pre-raid; no gear progression

### Ultimate Player Card (Future)
Instead of gear tracking, show:
- BiS validation (is equipped gear correct?)
- Prog checkpoints (Phase reached: P1, P2, Adds, etc.)
- Clear status (Cleared / In Prog)
- Party role assignments

### Implementation Notes
- Add `content_type: "savage" | "ultimate"` to TierSnapshot
- Create `UltimatePlayerCard` component (simpler than current PlayerCard)
- Ultimate tiers use different "floors" (prog phases instead of M5S/M6S/etc.)
- Can be added after Phase 4 without major architecture changes
