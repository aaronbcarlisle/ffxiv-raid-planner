# FFXIV Raid Planner - Roadmap

## Current Status

**Phase 4: Complete** - The application is fully functional with Discord OAuth, multi-static membership, invitations, and player ownership.

---

## Completed Phases

### Phase 1: Core Tracking
- Player cards with job selection
- Manual BiS source selection (Raid/Tome)
- Have/Augmented checkboxes
- Auto-calculated needs (books, tomes, upgrades)
- Priority display per floor

### Phase 2: UX Enhancements
- Tab navigation (Party/Loot/Stats) with FFXIV icons
- View mode toggle (compact/expanded)
- Needs footer on all player cards
- Right-click context menu
- Raid positions (T1/T2, H1/H2, M1/M2, R1/R2)
- Tome weapon tracking

### Phase 3: Backend & Persistence
- FastAPI backend with SQLAlchemy
- SQLite (dev) / PostgreSQL (prod) support
- Share codes for static groups
- Data persistence

### Phase 4: Multi-User System
- Discord OAuth authentication
- Multi-static membership
- Role-based access (Owner/Lead/Member/Viewer)
- User dashboard
- Group settings (rename, public/private, delete)
- Tier management (create, rollover, delete)
- Invitation system (invite links with roles/expiration)
- Player ownership (link Discord to player card)

---

## Planned Phases

### Phase 5: BiS Integration

**Goal:** Auto-populate BiS gear from community tools

| Feature | Priority | Description |
|---------|----------|-------------|
| Etro.gg Import | High | Parse Etro link to extract BiS items and sources |
| XIVGear.app Import | High | Parse XIVGear link (includes source metadata) |
| Balance BiS Presets | Medium | Bundled BiS sets per job from The Balance |
| Auto-Detect Sources | Medium | Determine Raid vs Tome from item IDs |

**API Endpoints:**
```
GET /api/bis/etro/{gearsetId}     # Proxy Etro API
GET /api/bis/xivgear/{uuid}       # Proxy XIVGear API
```

**XIVGear Advantage:** Items include `source` field indicating "savage" or "tome" - no manual source selection needed.

---

### Phase 6: Lodestone Auto-Sync

**Goal:** Automatically fetch current gear from Lodestone

| Feature | Priority | Description |
|---------|----------|-------------|
| Character Linking | High | Link Lodestone ID to player card |
| Gear Sync | High | Fetch current equipped gear from XIVAPI |
| BiS Comparison | Medium | Compare current gear to BiS, show delta |
| Manual Refresh | Medium | "Sync" button to update on demand |
| Auto-Sync Schedule | Low | Optional daily/weekly auto-refresh |

**API Integration:**
```
GET https://xivapi.com/character/{lodestoneId}?data=CG
```

Returns current equipped gear with item IDs, names, and levels.

**Implementation Notes:**
- Cache character data for 1 hour (gear doesn't change mid-raid)
- Backend proxy required for rate limiting
- Item ID matching to determine if current gear = BiS

---

### Phase 7: FFLogs Integration

**Goal:** Show raid performance and auto-detect clears

| Feature | Priority | Description |
|---------|----------|-------------|
| Character Linking | High | Link FFLogs character ID |
| Parse Percentiles | High | Show latest parse per fight |
| Report Links | Medium | Link to full FFLogs reports |
| Clear Detection | Medium | Auto-track clears for book counting |
| XIVAnalysis Links | Low | Deep-link to fight analysis |

**API Integration:**
```graphql
# FFLogs GraphQL API
query {
  characterData {
    character(id: 18370865) {
      name
      zoneRankings(zoneID: 62)  # AAC Cruiserweight Savage
    }
  }
}
```

**Auth:** OAuth 2.0 client credentials flow required.

---

### Phase 8: Enhanced Features

**Goal:** Quality-of-life improvements

| Feature | Priority | Description |
|---------|----------|-------------|
| Week-over-Week Tracking | Medium | Weekly snapshots, progress visualization |
| Loot History | Medium | Log of who got what each week |
| Book Accumulation | Medium | Track books earned per floor per week |
| Discord Bot | Low | Notifications for sync, loot drops |
| PWA Offline Mode | Low | Service worker for offline access |

---

## Technical Debt (From Audit)

See `docs/UNIFIED_AUDIT_PLAN.md` for detailed cleanup tasks.

### High Priority
- [ ] Create shared API client (`services/apiClient.ts`)
- [ ] Remove duplicate `authRequest` from stores
- [ ] Add barrel exports for component directories

### Medium Priority
- [ ] Evaluate color palette refresh (Obsidian & Amber theme)
- [ ] Header simplification (single-row layout)
- [ ] PlayerCard left-accent styling

---

## API Resources

| Service | Documentation | Purpose |
|---------|---------------|---------|
| XIVAPI | https://xivapi.com/docs | Character data, gear sync |
| Etro.gg | https://etro.gg/api/docs/ | BiS gearset import |
| XIVGear | https://xivgear.app/docs/ | BiS gearset import |
| FFLogs | https://www.fflogs.com/api/docs | Raid performance |

---

## Success Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Time Saved | 15min → 2min | Weekly tracking time |
| Data Accuracy | 100% | Auto-sync eliminates manual errors |
| Team Adoption | Zero friction | Share codes for instant access |
| Engagement | Weekly return | Progress visualization motivates tracking |
