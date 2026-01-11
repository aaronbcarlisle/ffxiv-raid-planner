# FFXIV Raid Planner - Loot Priority Updates and Polish

## Overview

Comprehensive plan to address feedback from beta testers:
1. **Bug Fixes** - Fix upgrade material display issues (Glaze on M9S, missing Universal Tomestone)
2. **Weapon Priority System** - Multi-job weapon tracking with priority ordering and locking
3. **Loot & Page Tracking** - Historical loot log and book earning/spending tracking

**Scope:** All improvements in one implementation phase
**Priority:** Bugs first → Weapon priority → Page tracking → Integration

---

## Part 1: Bug Fixes (Quick Wins)

### Issue 1: Floor 1 (M9S) Shows Glaze - INCORRECT

**Problem:** First floor NEVER drops upgrade materials in savage tiers
**Current state:** `loot-tables.ts` line 33 has `upgradeMaterials: ['glaze']`

**Fix:**
```typescript
// frontend/src/gamedata/loot-tables.ts
1: {
  floor: 1,
  gearDrops: ['earring', 'necklace', 'bracelet', 'ring1'],
  upgradeMaterials: [], // ✅ FIX: Remove glaze
  bookType: 'I',
  cofferCount: 2,
}
```

**Also update helper function (line 88):**
```typescript
case 'glaze':
  return [2]; // ✅ FIX: Only floor 2 (was [1, 2])
```

### Issue 2: Floor 2 (M10S) Missing Universal Tomestone

**Problem:** Universal Tomestone required for tome weapon but not displayed

**Solution:** Add `specialMaterials` field to loot tables

```typescript
// Update FloorLootTable interface (line 12)
export interface FloorLootTable {
  floor: FloorNumber;
  gearDrops: GearSlot[];
  upgradeMaterials: ('twine' | 'glaze' | 'solvent')[];
  specialMaterials?: string[]; // ✅ NEW
  bookType: string;
  cofferCount: number;
}

// Update Floor 2 (line 37)
2: {
  floor: 2,
  gearDrops: ['head', 'hands', 'feet'],
  upgradeMaterials: ['glaze'],
  specialMaterials: ['Universal Tomestone'], // ✅ NEW
  bookType: 'II',
  cofferCount: 2,
}
```

**UI Update in LootPriorityPanel.tsx:**
Add new section after upgrade materials to display special materials (informational only, no priority calculation needed)

---

## Part 2: Weapon Priority System

### Data Model

**Add to SnapshotPlayer (backend/app/models/snapshot_player.py):**
```python
weapon_priorities = Column(JSON, nullable=False, default=list)
# Format: [{"job": "DRG", "weaponName": null, "received": false, "receivedDate": null}, ...]

weapon_priorities_locked = Column(Boolean, nullable=False, default=False)
weapon_priorities_locked_by = Column(String, nullable=True)
weapon_priorities_locked_at = Column(DateTime, nullable=True)
```

**Add to TierSnapshot (backend/app/models/tier_snapshot.py):**
```python
weapon_priorities_auto_lock_date = Column(DateTime, nullable=True)
weapon_priorities_global_lock = Column(Boolean, nullable=False, default=False)
weapon_priorities_global_locked_by = Column(String, nullable=True)
weapon_priorities_global_locked_at = Column(DateTime, nullable=True)
```

**Frontend TypeScript types:**
```typescript
interface WeaponPriority {
  job: string;
  weaponName?: string;
  received: boolean;
  receivedDate?: string;
}

interface SnapshotPlayer {
  // ... existing fields ...
  weaponPriorities: WeaponPriority[];
  weaponPrioritiesLocked: boolean;
  weaponPrioritiesLockedBy?: string;
  weaponPrioritiesLockedAt?: string;
}
```

### Backend API

**New endpoints (backend/app/routers/tiers.py):**
- `PUT /api/static-groups/{id}/tiers/{tierId}/players/{playerId}/weapon-priorities` - Update player's weapon list
- `POST /api/static-groups/{id}/tiers/{tierId}/players/{playerId}/weapon-priorities/lock` - Lock individual player
- `DELETE /api/static-groups/{id}/tiers/{tierId}/players/{playerId}/weapon-priorities/lock` - Unlock individual player
- `PUT /api/static-groups/{id}/tiers/{tierId}/weapon-priority-settings` - Set auto-lock date and global lock

**Permission checks:**
- Locked state checked by: global lock OR auto-lock date passed OR individual lock
- Owner/Lead can edit when locked, Members can edit own card when unlocked
- Only Owner/Lead can lock/unlock

### Frontend Components

**New components to create:**
1. `WeaponPriorityModal.tsx` - Opened from player card context menu "Set Weapon Priorities"
2. `WeaponPriorityEditor.tsx` - Reusable drag-and-drop list editor
3. `WeaponPrioritySettings.tsx` - Lock controls + auto-lock date picker (in Loot tab)
4. `WeaponPriorityList.tsx` - Display calculated priority in Loot tab

**Context menu integration:**
- Add "Set Weapon Priorities" option to PlayerCard context menu
- Opens modal with drag-and-drop job list
- Shows locked state with helpful tooltips

**Loot tab integration:**
- Add "Weapon Priority" section to Floor 4 (M12S) loot panel
- Show calculated priority list (who gets next weapon)
- "Settings" button (Owner/Lead only) opens WeaponPrioritySettings modal

### Priority Calculation Algorithm

```typescript
// frontend/src/utils/weaponPriority.ts
calculateWeaponPriority(players) {
  // For each weapon job:
  // 1. Filter players who want this weapon (in their priority list)
  // 2. Filter out players who already received it
  // 3. Sort by priority rank (lower = higher priority)
  // 4. Tie-break by role score (melee > ranged > caster > tank > healer)
  // 5. Further tie-break: main job > off-job > alphabetical
}
```

### Locking Mechanisms

**Three locking modes (all coexist):**
1. **Global lock toggle** - Simple on/off, Owner/Lead only
2. **Per-player lock** - Lock individual player's preferences
3. **Auto-lock date** - Players can edit until date, then auto-locks

**User flow:**
- Lead sets auto-lock date (e.g., "Jan 7, 2025 at tier release")
- Players freely edit their weapon priorities until that date
- After date passes, only Lead/Owner can edit
- Lead can manually unlock global or per-player if needed

---

## Part 3: Loot & Page Tracking

### Data Models

**New table: loot_log_entries (backend/app/models/loot_log_entry.py):**
```python
class LootLogEntry(Base):
    id = Column(Integer, primary_key=True)
    tier_snapshot_id = Column(Integer, ForeignKey("tier_snapshots.id"))
    week_number = Column(Integer)
    floor = Column(String)  # "M9S", "M10S", etc.
    item_slot = Column(String)  # "weapon", "head", etc.
    recipient_player_id = Column(Integer, ForeignKey("snapshot_players.id"))
    method = Column(Enum("drop", "book", "tome"))
    notes = Column(String, nullable=True)
    created_at = Column(DateTime)
    created_by_user_id = Column(Integer, ForeignKey("users.id"))
```

**New table: page_ledger_entries (backend/app/models/page_ledger_entry.py):**
```python
class PageLedgerEntry(Base):
    id = Column(Integer, primary_key=True)
    tier_snapshot_id = Column(Integer, ForeignKey("tier_snapshots.id"))
    player_id = Column(Integer, ForeignKey("snapshot_players.id"))
    week_number = Column(Integer)
    floor = Column(String)
    book_type = Column(String)  # "I", "II", "III", "IV"
    transaction_type = Column(Enum("earned", "spent", "missed", "adjustment"))
    quantity = Column(Integer)  # +1 (earned), -N (spent), 0 (missed)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime)
    created_by_user_id = Column(Integer, ForeignKey("users.id"))
```

**Add to TierSnapshot:**
```python
current_week = Column(Integer, default=1)
week_start_date = Column(DateTime, nullable=True)
```

### Backend API

**New routers:**
- `backend/app/routers/loot_log.py` - CRUD for loot history
- `backend/app/routers/page_tracking.py` - Book earning/spending tracking

**Key endpoints:**
- `GET /api/static-groups/{id}/tiers/{tierId}/loot-log?week=5` - Get loot history
- `POST /api/static-groups/{id}/tiers/{tierId}/loot-log` - Add loot entry
- `GET /api/static-groups/{id}/tiers/{tierId}/page-balances` - Get current book counts
- `POST /api/static-groups/{id}/tiers/{tierId}/mark-floor-cleared` - Batch mark earned books
- `GET /api/static-groups/{id}/tiers/{tierId}/current-week` - Get week number

**Page balance calculation:**
- Calculated on-demand: `sum(quantity)` from ledger entries
- Not stored - ledger is source of truth
- Allows corrections via adjustment entries

### Frontend Components

**New tab: "History" (4th tab after Party/Loot/Stats):**
- Two-panel layout: Loot Log (left) + Page Balances (right)
- Week selector at top (dropdown + prev/next buttons)
- "Add Loot Entry" button (Owner/Lead only)
- "Mark Floor Cleared" button for batch book earning

**New components:**
1. `HistoryView.tsx` - Main container for History tab
2. `WeekSelector.tsx` - Navigate between weeks
3. `LootLogPanel.tsx` - Display loot history, add/delete entries
4. `PageBalancesPanel.tsx` - Display book counts, mark floor cleared
5. `AddLootEntryModal.tsx` - Form to log loot drops
6. `MarkFloorClearedModal.tsx` - Batch select players who cleared

**New store: `lootTrackingStore.ts`:**
- Manages loot log entries, page balances, current week
- Actions for fetching, adding, deleting entries
- Week number tracking

### Week Number Calculation

**Formula:**
```python
def calculate_current_week(tier: TierSnapshot) -> int:
    start_date = tier.week_start_date or tier.created_at
    weeks_since_start = (now - start_date).days // 7
    return weeks_since_start + 1
```

**Weekly reset:** Tuesday 08:00 UTC (FFXIV reset time)

---

## Part 4: Integration Points

### Weapon Priority ← Loot Log Integration

**When logging a weapon drop:**
1. Create loot log entry (floor 4, item=weapon, player)
2. Auto-update weapon priority: `received = true, receivedDate = now`
3. Optionally update gear: `weapon.hasItem = true` (checkbox in modal)

**Unified "Log Loot" modal:**
- Floor selector, Item selector, Player selector
- Checkboxes:
  - ☑ Mark as acquired in gear table
  - ☑ Update weapon priority (if weapon)
  - ☐ Deduct books (manual, not automatic)

### Page Tracking ← Gear Interaction

**Decision: NO AUTO-DEDUCTION**
- Too many edge cases (traded coffers, PF clears, mixed sources)
- Keep systems separate
- Users manually log book spending in Page Tracking tab

### Permission Matrix

| Action | Owner | Lead | Member | Viewer |
|--------|-------|------|--------|--------|
| **Weapon Priority** |
| View priority list | ✅ | ✅ | ✅ | ✅ |
| Edit own weapon priorities | ✅ | ✅ | ✅ (unlocked) | ❌ |
| Edit all weapon priorities | ✅ | ✅ | ❌ | ❌ |
| Lock/unlock priorities | ✅ | ✅ | ❌ | ❌ |
| Set auto-lock date | ✅ | ✅ | ❌ | ❌ |
| **Loot Log** |
| View loot history | ✅ | ✅ | ✅ | ✅ |
| Add loot entry | ✅ | ✅ | ❌ | ❌ |
| Delete loot entry | ✅ | ❌ | ❌ | ❌ |
| **Page Tracking** |
| View page balances | ✅ | ✅ | ✅ | ✅ |
| Log books earned | ✅ | ✅ | Own card | ❌ |
| Edit/delete entries | ✅ | ✅ | ❌ | ❌ |

---

## Part 5: Migration Strategy

### Database Migration

**Alembic migration (backend/alembic/versions/):**
```python
def upgrade():
    # Add weapon priority columns to snapshot_players
    op.add_column('snapshot_players', sa.Column('weapon_priorities', sa.JSON(), default=[]))
    op.add_column('snapshot_players', sa.Column('weapon_priorities_locked', sa.Boolean(), default=False))
    # ... other weapon priority fields

    # Add weapon priority settings to tier_snapshots
    op.add_column('tier_snapshots', sa.Column('weapon_priorities_auto_lock_date', sa.DateTime()))
    op.add_column('tier_snapshots', sa.Column('weapon_priorities_global_lock', sa.Boolean(), default=False))
    # ... other tier fields

    # Create new tables
    op.create_table('loot_log_entries', ...)
    op.create_table('page_ledger_entries', ...)
```

### Initialization Script

**For existing players without weapon priorities:**
```python
# backend/scripts/initialize_weapon_priorities.py
# Sets each player's main job weapon as priority #1
for player in existing_players:
    player.weapon_priorities = [
        {"job": player.job, "received": False}
    ]
```

**For existing tiers without week tracking:**
```python
# backend/scripts/initialize_tier_weeks.py
for tier in existing_tiers:
    tier.current_week = calculate_current_week(tier)
    tier.week_start_date = tier.created_at
```

### Frontend Migration

**Graceful handling of missing fields:**
```typescript
// Default to empty array if weaponPriorities doesn't exist
const priorities = player.weaponPriorities || [];

// Default to unlocked if field doesn't exist
const isLocked = player.weaponPrioritiesLocked || false;
```

---

## Part 6: Implementation Order

### Phase 1: Bug Fixes (30 min)
1. Update `loot-tables.ts` (remove glaze from floor 1, add specialMaterials field)
2. Update `LootPriorityPanel.tsx` (display special materials section)
3. Test on M9S and M10S

### Phase 2: Weapon Priority (4-6 hours)
1. Backend models + migration
2. Backend API endpoints + permission checks
3. Frontend types and store
4. WeaponPriorityModal component
5. Context menu integration
6. Loot tab integration (WeaponPriorityList)
7. WeaponPrioritySettings modal
8. Priority calculation algorithm
9. Testing (lock states, permissions, auto-lock date)

### Phase 3: Loot & Page Tracking (4-6 hours)
1. Backend models + migration
2. Backend API endpoints
3. Frontend store (lootTrackingStore)
4. History tab components
5. Week calculation utilities
6. Testing (logging loot, marking clears, balance calculations)

### Phase 4: Integration & Polish (2-3 hours)
1. Unified "Log Loot" modal
2. Weapon priority auto-update from loot log
3. Permission enforcement across all features
4. Edge case testing
5. Documentation updates

**Total estimated time: 10-15 hours**

---

## Critical Files to Create/Modify

### Backend - New Files (9)
1. `backend/app/models/loot_log_entry.py` - Loot history model
2. `backend/app/models/page_ledger_entry.py` - Book transaction ledger
3. `backend/app/routers/loot_log.py` - Loot log API
4. `backend/app/routers/page_tracking.py` - Page tracking API
5. `backend/app/utils/weapon_priorities.py` - Lock check helpers
6. `backend/app/utils/week_helpers.py` - Week calculation
7. `backend/scripts/initialize_weapon_priorities.py` - Migration script
8. `backend/scripts/initialize_tier_weeks.py` - Migration script
9. `backend/alembic/versions/XXX_add_tracking_features.py` - DB migration

### Backend - Modify Files (3)
10. `backend/app/models/snapshot_player.py` - Add weapon priority columns
11. `backend/app/models/tier_snapshot.py` - Add tracking fields
12. `backend/app/routers/tiers.py` - Add weapon priority endpoints

### Frontend - New Files (15)
13. `frontend/src/components/weapon-priority/WeaponPriorityModal.tsx`
14. `frontend/src/components/weapon-priority/WeaponPriorityEditor.tsx`
15. `frontend/src/components/weapon-priority/WeaponPrioritySettings.tsx`
16. `frontend/src/components/weapon-priority/WeaponJobSelector.tsx`
17. `frontend/src/components/weapon-priority/WeaponPriorityListItem.tsx`
18. `frontend/src/components/loot/WeaponPriorityList.tsx`
19. `frontend/src/components/loot/LogLootModal.tsx`
20. `frontend/src/components/history/HistoryView.tsx`
21. `frontend/src/components/history/WeekSelector.tsx`
22. `frontend/src/components/history/LootLogPanel.tsx`
23. `frontend/src/components/history/PageBalancesPanel.tsx`
24. `frontend/src/components/history/AddLootEntryModal.tsx`
25. `frontend/src/components/history/MarkFloorClearedModal.tsx`
26. `frontend/src/stores/lootTrackingStore.ts`
27. `frontend/src/utils/weaponPriority.ts` - Priority calculation

### Frontend - Modify Files (6)
28. `frontend/src/gamedata/loot-tables.ts` - Bug fixes + specialMaterials
29. `frontend/src/components/loot/LootPriorityPanel.tsx` - Add weapon section + special materials
30. `frontend/src/components/player/PlayerCard.tsx` - Add context menu option
31. `frontend/src/stores/tierStore.ts` - Add weapon priority actions
32. `frontend/src/utils/permissions.ts` - Add weapon/loot permission checks
33. `frontend/src/types/index.ts` - Add new interfaces

**Total: 33 files (24 new, 9 modified)**

---

## Testing Checklist

### Bug Fixes
- [ ] M9S shows no upgrade materials section
- [ ] M10S shows Glaze in upgrade materials
- [ ] M10S shows Universal Tomestone in special materials section

### Weapon Priority
- [ ] Open weapon priority modal from player card
- [ ] Drag-and-drop reorder weapons
- [ ] Add off-job weapons to priority list
- [ ] Mark weapon as received
- [ ] Global lock prevents all editing (except Owner/Lead)
- [ ] Auto-lock date works (before = editable, after = locked)
- [ ] Per-player lock works
- [ ] Loot tab shows weapon priority for M12S
- [ ] Priority calculation correct (role scores, tie-breaking)

### Loot & Page Tracking
- [ ] History tab shows loot log and page balances
- [ ] Week selector works (prev/next, dropdown)
- [ ] Add loot entry creates log
- [ ] Mark floor cleared creates earned entries
- [ ] Page balances calculate correctly from ledger
- [ ] Delete loot entry works

### Integration
- [ ] Log weapon drop → auto-updates priority "received"
- [ ] Permissions enforced (Viewer can't log, Member can edit own priorities when unlocked)
- [ ] Old tiers lazy-initialize weapon priorities on first access

---

## Success Criteria

1. **Bug fixes deployed** - M9S shows no Glaze, M10S shows Universal Tomestone
2. **Weapon priority functional** - Players can set multi-job preferences, leads can lock
3. **Loot tracking functional** - History tab shows weekly loot and book balances
4. **No regressions** - Existing features (gear tracking, BiS import, etc.) still work
5. **Documentation updated** - CLAUDE.md reflects all new features

---

## Notes

- **Markers feature deferred** - User confirmed to skip visual state indicators for now
- **Additional gear tiers deferred** - Focus on BiS (raid/tome) only for now
- **Auto-deduction rejected** - Page tracking separate from gear checkboxes (too many edge cases)
- **Hybrid locking approach** - All three lock modes coexist for maximum flexibility
- **Auto-lock date is priority** - Most important feature per user feedback
