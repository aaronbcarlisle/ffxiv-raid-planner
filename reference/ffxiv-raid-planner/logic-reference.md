# FFXIV Raid Gear Tracker - Web-App Logic Reference

**Generated:** 2026-01-02
**Source:** `/home/serapis/projects/ffxiv-raid-planner`
**Status:** Phase 1-6.5 Complete | Next: Phase 7 (Lodestone sync), Phase 8 (FFLogs)

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend Framework** | React | 19.2.0 |
| **Language** | TypeScript | 5.9.3 |
| **Build Tool** | Vite | 7.2.4 |
| **State Management** | Zustand | 5.0.9 |
| **Routing** | React Router DOM | 7.11.0 |
| **UI Components** | Radix UI, Tailwind CSS 4.1 | - |
| **Drag & Drop** | @dnd-kit | 6.1.0 |
| **Backend Framework** | FastAPI | 0.115.0 |
| **Server** | Uvicorn | 0.32.0 |
| **ORM** | SQLAlchemy (async) | 2.0.0 |
| **Database** | SQLite (dev) / PostgreSQL (prod) | - |
| **Auth** | JWT + Discord OAuth | python-jose |
| **Python** | 3.11+ | - |

---

## Data Entities

### User
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `discord_id` | String | Discord user ID (unique) |
| `discord_username` | String | Discord username |
| `discord_discriminator` | String | Legacy discriminator (nullable) |
| `discord_avatar` | String | Avatar hash (nullable) |
| `email` | String | Email (nullable) |
| `display_name` | String | Custom display name (nullable) |
| `created_at` | ISO timestamp | Account creation |
| `updated_at` | ISO timestamp | Last update |
| `last_login_at` | ISO timestamp | Last login (nullable) |

### StaticGroup
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `name` | String | Group name |
| `owner_id` | UUID (FK→User) | Owner reference |
| `share_code` | String (6 chars) | Unique share code |
| `is_public` | Boolean | Public visibility |
| `settings` | JSON | `{ lootPriority: string[] }` |
| `created_at` | ISO timestamp | Creation time |
| `updated_at` | ISO timestamp | Last update |

### Membership
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID (FK→User) | User reference |
| `static_group_id` | UUID (FK→StaticGroup) | Group reference |
| `role` | Enum | owner, lead, member, viewer |
| `joined_at` | ISO timestamp | Join time |
| `updated_at` | ISO timestamp | Last update |

**Unique Constraint:** (user_id, static_group_id)

### TierSnapshot
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `static_group_id` | UUID (FK→StaticGroup) | Group reference |
| `tier_id` | String | e.g., "aac-cruiserweight" |
| `content_type` | String | "savage" or "ultimate" |
| `is_active` | Boolean | Active tier flag |
| `current_week` | Integer | Current week number (default=1) |
| `week_start_date` | ISO timestamp | Tier start date (nullable) |
| `weapon_priorities_global_lock` | Boolean | Global lock flag |
| `weapon_priorities_auto_lock_date` | ISO timestamp | Auto-lock date (nullable) |
| `weapon_priorities_global_locked_by` | UUID (FK→User) | Who locked (nullable) |
| `weapon_priorities_global_locked_at` | ISO timestamp | Lock time (nullable) |
| `created_at` | ISO timestamp | Creation time |
| `updated_at` | ISO timestamp | Last update |

**Unique Constraint:** (static_group_id, tier_id)

### SnapshotPlayer
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `tier_snapshot_id` | UUID (FK→TierSnapshot) | Tier reference |
| `user_id` | UUID (FK→User, nullable) | Claimed by user |
| `name` | String | Character name |
| `job` | String | e.g., "DRG", "WHM" |
| `role` | String | tank, healer, melee, ranged, caster |
| `position` | String (nullable) | T1, T2, H1, H2, M1, M2, R1, R2 |
| `tank_role` | String (nullable) | MT or OT |
| `template_role` | String (nullable) | Expected role for slot |
| `configured` | Boolean | Player configured flag |
| `sort_order` | Integer | Display order |
| `is_substitute` | Boolean | Substitute flag |
| `notes` | Text (nullable) | Player notes |
| `lodestone_id` | String (nullable) | Lodestone ID |
| `bis_link` | Text (nullable) | XIVGear/Etro URL |
| `fflogs_id` | Integer (nullable) | FFLogs ID |
| `last_sync` | ISO timestamp (nullable) | Last sync time |
| `gear` | JSON Array | GearSlotStatus[] |
| `tome_weapon` | JSON Object | TomeWeaponStatus |
| `weapon_priorities` | JSON Array | WeaponPriority[] |
| `weapon_priorities_locked` | Boolean | Individual lock |
| `weapon_priorities_locked_by` | String (nullable) | Who locked |
| `weapon_priorities_locked_at` | ISO timestamp (nullable) | Lock time |
| `created_at` | ISO timestamp | Creation time |
| `updated_at` | ISO timestamp | Last update |

### GearSlotStatus (Embedded JSON)
| Field | Type | Description |
|-------|------|-------------|
| `slot` | String | weapon, head, body, hands, legs, feet, earring, necklace, bracelet, ring1, ring2 |
| `bisSource` | "raid" \| "tome" | BiS source (default: raid) |
| `hasItem` | Boolean | Has item (default: false) |
| `isAugmented` | Boolean | Augmented (default: false) |
| `itemName` | String (optional) | Item name |
| `itemLevel` | Integer (optional) | Item level |
| `itemIcon` | String (optional) | Icon path |
| `itemStats` | Object (optional) | Stat dictionary |

### TomeWeaponStatus (Embedded JSON)
| Field | Type | Description |
|-------|------|-------------|
| `pursuing` | Boolean | Tracking interim tome weapon |
| `hasItem` | Boolean | Has tome weapon |
| `isAugmented` | Boolean | Tome weapon augmented |

### WeaponPriority (Embedded JSON Array)
| Field | Type | Description |
|-------|------|-------------|
| `job` | String | Job code (e.g., "DRG") |
| `weaponName` | String (optional) | Weapon display name |
| `received` | Boolean | Weapon received |
| `receivedDate` | ISO timestamp (optional) | When received |

### LootLogEntry
| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Primary key (auto-increment) |
| `tier_snapshot_id` | UUID (FK→TierSnapshot) | Tier reference |
| `week_number` | Integer | Week number (>= 1) |
| `floor` | String | "M9S", "M10S", etc. |
| `item_slot` | String | Gear slot |
| `recipient_player_id` | UUID (FK→SnapshotPlayer) | Recipient |
| `method` | Enum | drop, book, tome |
| `notes` | Text (nullable) | Notes |
| `created_at` | ISO timestamp | Creation time |
| `created_by_user_id` | UUID (FK→User) | Who logged |

### PageLedgerEntry
| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Primary key (auto-increment) |
| `tier_snapshot_id` | UUID (FK→TierSnapshot) | Tier reference |
| `player_id` | UUID (FK→SnapshotPlayer) | Player reference |
| `week_number` | Integer | Week number (>= 1) |
| `floor` | String | "M9S", "M10S", etc. |
| `book_type` | String | "I", "II", "III", "IV" |
| `transaction_type` | Enum | earned, spent, missed, adjustment |
| `quantity` | Integer | +1 (earned), -N (spent), 0 (missed) |
| `notes` | Text (nullable) | Notes |
| `created_at` | ISO timestamp | Creation time |
| `created_by_user_id` | UUID (FK→User) | Who logged |

### MaterialLogEntry
| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Primary key (auto-increment) |
| `tier_snapshot_id` | UUID (FK→TierSnapshot) | Tier reference |
| `week_number` | Integer | Week number (>= 1) |
| `floor` | String | "M9S", "M10S", "M11S" |
| `material_type` | Enum | twine, glaze, solvent |
| `recipient_player_id` | UUID (FK→SnapshotPlayer) | Recipient |
| `notes` | Text (nullable) | Notes |
| `created_at` | ISO timestamp | Creation time |
| `created_by_user_id` | UUID (FK→User) | Who logged |

### Invitation
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `static_group_id` | UUID (FK→StaticGroup) | Group reference |
| `created_by_id` | UUID (FK→User) | Creator |
| `invite_code` | String (12 chars) | Unique invite code |
| `role` | String | Role to assign on join |
| `expires_at` | ISO timestamp (nullable) | Expiration |
| `max_uses` | Integer (nullable) | Max uses |
| `use_count` | Integer | Current uses (default: 0) |
| `is_active` | Boolean | Active flag |
| `created_at` | ISO timestamp | Creation time |
| `updated_at` | ISO timestamp | Last update |

---

## Calculations & Formulas

### Gear Completion

| Calculation | File:Line | Formula | Notes |
|-------------|-----------|---------|-------|
| **isSlotComplete()** | `calculations.ts:15-20` | `if (bisSource='raid') hasItem; else hasItem && isAugmented` | Tome pieces must be augmented to count as complete |
| **calculatePlayerCompletion()** | `calculations.ts:25-28` | `Math.round((completedSlots / gear.length) * 100)` | Percentage of 11 slots complete |

### Material Needs

| Calculation | File:Line | Formula | Notes |
|-------------|-----------|---------|-------|
| **calculatePlayerMaterials()** | `calculations.ts:33-51` | Count tome pieces where `!isAugmented`, group by material type | twine=armor, glaze=accessories, solvent=weapon |
| **getUpgradeMaterialForSlot()** | `loot-tables.ts:112-117` | Lookup: slot → material type | Direct mapping |

**Material Mapping:**
- **Twine:** head, body, hands, legs, feet (left-side armor)
- **Glaze:** earring, necklace, bracelet, ring1, ring2 (accessories)
- **Solvent:** weapon only

### Book Needs

| Calculation | File:Line | Formula | Notes |
|-------------|-----------|---------|-------|
| **calculatePlayerBooks()** | `calculations.ts:56-77` | `sum(BOOK_COSTS[slot])` for raid pieces where `!hasItem` | Grouped by floor |

**Book Costs (BOOK_COSTS):**
| Slot | Cost | Book Type |
|------|------|-----------|
| Weapon | 8 books | Book IV (Floor 4) |
| Body | 6 books | Book III (Floor 3) |
| Legs | 6 books | Book III (Floor 3) |
| Head | 4 books | Book II (Floor 2) |
| Hands | 4 books | Book II (Floor 2) |
| Feet | 4 books | Book II (Floor 2) |
| Earring | 3 books | Book I (Floor 1) |
| Necklace | 3 books | Book I (Floor 1) |
| Bracelet | 3 books | Book I (Floor 1) |
| Ring1 | 3 books | Book I (Floor 1) |
| Ring2 | 3 books | Book I (Floor 1) |

### Priority Scoring

| Calculation | File:Line | Formula | Notes |
|-------------|-----------|---------|-------|
| **calculatePriorityScore()** | `priority.ts:28-40` | `(5 - roleIndex) * 25 + (weightedNeed * 10)` | Higher score = higher priority |
| **getPriorityForItem()** | `priority.ts:47-63` | Filter `bisSource='raid' && !hasItem`, sort by score desc | Returns priority list for slot |
| **getPriorityForRing()** | `priority.ts:69-86` | Filter if ring1 OR ring2 needs raid | Special ring handling |

**Role Priority (by index in settings.lootPriority):**
| Role Index | Role Priority Score |
|------------|---------------------|
| 0 (first) | 125 points |
| 1 | 100 points |
| 2 | 75 points |
| 3 | 50 points |
| 4 (last) | 25 points |

**Slot Value Weights (SLOT_VALUE_WEIGHTS):**
| Slot | Weight | Points Added |
|------|--------|--------------|
| Weapon | 3.0 | 30 |
| Body | 1.5 | 15 |
| Legs | 1.5 | 15 |
| Head | 1.0 | 10 |
| Hands | 1.0 | 10 |
| Feet | 1.0 | 10 |
| Earring | 0.8 | 8 |
| Necklace | 0.8 | 8 |
| Bracelet | 0.8 | 8 |
| Ring1 | 0.8 | 8 |
| Ring2 | 0.8 | 8 |

### Material Priority

| Calculation | File:Line | Formula | Notes |
|-------------|-----------|---------|-------|
| **getPriorityForUpgradeMaterial()** | `priority.ts:97-173` | `baseScore + (effectiveNeed * 15) - receivedCount` | Deducts already-received |

**Special Case - Solvent:** If player has `tomeWeapon.pursuing && tomeWeapon.hasItem && !tomeWeapon.isAugmented`, add 1 to their solvent need.

### Player Needs Summary

| Calculation | File:Line | Formula | Notes |
|-------------|-----------|---------|-------|
| **calculatePlayerNeeds()** | `priority.ts:183-215` | Returns `{raidNeed, tomeNeed, upgrades, tomeWeeks}` | Comprehensive needs |

**Tomestone Calculation:**
```
tomeWeeks = Math.ceil(totalTomestoneCost / 450)
WEEKLY_TOMESTONE_CAP = 450
```

**Tomestone Costs (TOMESTONE_COSTS):**
| Slot | Cost |
|------|------|
| Weapon | 500 |
| Body | 825 |
| Legs | 825 |
| Head | 495 |
| Hands | 495 |
| Feet | 495 |
| Earring | 375 |
| Necklace | 375 |
| Bracelet | 375 |
| Ring1 | 375 |
| Ring2 | 375 |

### Weapon Priority

| Calculation | File:Line | Formula | Notes |
|-------------|-----------|---------|-------|
| **getWeaponPriorityForJob()** | `weaponPriority.ts:29-92` | `roleScore + rankScore + mainJobBonus` | Main job always wins |

**Weapon Score Components:**
```
roleScore = (5 - roleIndex) * 100          // 0-500 based on role
rankScore = max(0, 1000 - rankIndex * 100) // 0-1000 based on priority rank
mainJobBonus = 2000                         // Added if this is player's main job

Total = roleScore + rankScore + mainJobBonus  // Max ~3100
```

**Key Rule:** Main job bonus (2000) exceeds any possible role+rank combination, ensuring main job always wins.

### Team Summary

| Calculation | File:Line | Formula | Notes |
|-------------|-----------|---------|-------|
| **calculateTeamSummary()** | `calculations.ts:82-140` | Aggregates all players | Returns team totals |

**Weeks to Complete:**
```
weeksToComplete = max(
  ceil(floor1_books / playerCount),
  ceil(floor2_books / playerCount),
  ceil(floor3_books / playerCount),
  ceil(floor4_books / playerCount)
)
```

### Enhanced Priority (Fairness Adjustments)

| Calculation | File:Line | Formula | Notes |
|-------------|-----------|---------|-------|
| **calculatePlayerLootStats()** | `lootCoordination.ts:335-362` | Returns `{totalDrops, dropsThisWeek, weeksSinceLastDrop}` | History tracking |
| **calculateEnhancedPriorityScore()** | `lootCoordination.ts:371-384` | `baseScore + droughtBonus - balancePenalty` | Fairness adjustment |
| **calculateAverageDrops()** | `lootCoordination.ts:390-404` | `totalDrops / playerCount` | Team average |

**Fairness Bonuses/Penalties:**
```
droughtBonus = min(weeksSinceLastDrop * 10, 50)   // Max +50 after 5 weeks
balancePenalty = min((totalDrops - avgDrops) * 15, 45)  // Max -45 if 3+ ahead
enhancedScore = baseScore + droughtBonus - balancePenalty
```

### Week Calculations

| Calculation | File:Line | Formula | Notes |
|-------------|-----------|---------|-------|
| **calculate_week_number()** | `loot_tracking.py:65-71` | `(now - start_date).days // 7 + 1` | Week 1 = days 0-6 |

### Balance Calculations (Backend)

| Calculation | File:Line | Formula | Notes |
|-------------|-----------|---------|-------|
| **get_page_balances()** | `loot_tracking.py:312-368` | `SUM(quantity) GROUP BY book_type` per player | Returns I, II, III, IV balances |
| **get_material_balances()** | `loot_tracking.py:975-1029` | `COUNT(*) GROUP BY player, material_type` | Single optimized query |

---

## Business Rules

### Permission Rules

| ID | Rule | Location | Description |
|----|------|----------|-------------|
| PR-001 | Edit Player | `permissions.ts:32-56` | Owner/Lead can edit any player; Member can only edit claimed players; Viewer cannot edit |
| PR-002 | Edit Gear | `permissions.ts:63-73` | Same as PR-001 but for gear-specific operations |
| PR-003 | Reset Gear | `permissions.ts:80-104` | Owner/Lead can reset any; Member can only reset their claimed card |
| PR-004 | Claim Player | `permissions.ts:115-138` | Must be logged in; Cannot claim if already owned (unless Owner); Members+ can claim unclaimed |
| PR-005 | Manage Roster | `permissions.ts:149-163` | Only Owner/Lead can add/remove/reorder players |
| PR-006 | Manage Tiers | `permissions.ts:170-176` | Only Owner/Lead can create/delete/rollover tiers |
| PR-007 | Group Settings | `permissions.ts:186-196` | Only Owner can manage group settings or delete group |
| PR-008 | Invitations | `permissions.ts:204-214` | Only Owner/Lead can create and revoke invitations |
| PR-009 | Membership Required | `permissions.py:78-115` | User must be member of group (except public view) |
| PR-010 | View Permission | `permissions.py:118-152` | Public groups can be viewed by anyone; Private require membership |
| PR-011 | Roster Editing | `permissions.py:155-161` | Requires Lead+ role for loot tracking and tier management |
| PR-012 | Owner-Only | `permissions.py:173-179` | Group deletion, membership changes, settings require Owner |

### Loot Priority Rules

| ID | Rule | Description |
|----|------|-------------|
| LP-001 | Role Order | Priority order from `settings.lootPriority[]` (default: melee > ranged > caster > tank > healer) |
| LP-002 | Eligibility | Only players with `bisSource='raid' && !hasItem` are eligible for priority |
| LP-003 | Ring Special | Ring drops: player eligible if either ring slot needs raid |
| LP-004 | Material Deduction | Material priority deducts already-received from calculation |
| LP-005 | Tome Weapon | Tome weapon counts toward solvent need if `pursuing && hasItem && !isAugmented` |
| LP-006 | Position Assignment | Auto-assigns position when adding player based on role and availability |

### Weapon Priority Rules

| ID | Rule | Description |
|----|------|-------------|
| WP-001 | Main Job Wins | Main job always wins (2000-point bonus exceeds any role+rank combination) |
| WP-002 | Explicit Priority | Explicit priority list controls off-job weapon order |
| WP-003 | Received Excluded | Players who already received weapon for job are excluded |

### Gear Rules

| ID | Rule | Description |
|----|------|-------------|
| GR-001 | Raid Complete | Raid BiS complete when `hasItem=true` |
| GR-002 | Tome Complete | Tome BiS complete when `hasItem=true && isAugmented=true` |
| GR-003 | BiS Weapon | BiS weapon is ALWAYS raid; "Raid + Tome" toggle for interim tome weapon |

### Loot Coordination Rules

| ID | Rule | Description |
|----|------|-------------|
| LC-001 | Gear Sync | Log loot syncs gear: method='drop'/'book' marks `hasItem=true` |
| LC-002 | Ring Routing | Ring drops auto-route to ring1 if both need, else whichever needs |
| LC-003 | Delete Revert | Delete loot entry reverts gear: unmarks `hasItem` |
| LC-004 | Weapon Mark | Weapon drops auto-mark main job weapon as received |

### Game Data Rules

| ID | Rule | Description |
|----|------|-------------|
| GD-001 | Floor 1 Drops | earring, necklace, bracelet, ring + Book I |
| GD-002 | Floor 2 Drops | head, hands, feet + glaze + Book II |
| GD-003 | Floor 3 Drops | body, legs + twine, solvent + Book III |
| GD-004 | Floor 4 Drops | weapon + Book IV |
| GD-005 | Solvent-Only | Solvent cannot be purchased with books (drop-only from Floor 3) |

---

## Core Workflows

### 1. Authentication Flow
1. User clicks Login on Home page
2. `authStore.login()` → GET `/api/auth/discord` → Returns OAuth URL + state
3. State stored in sessionStorage for CSRF protection
4. Redirect to Discord OAuth → User authorizes
5. Discord redirects to `/auth/callback` with code + state
6. `AuthCallback.tsx` validates state matches sessionStorage
7. `authStore.handleCallback(code, state)` → POST `/api/auth/discord/callback`
8. Returns access_token + refresh_token
9. Tokens stored in localStorage via Zustand persist
10. `authStore.fetchUser()` → GET `/api/auth/me` → Populates user data

### 2. Create Static Group
1. Navigate to Dashboard (authenticated)
2. Click "Create Static" button
3. Enter name, select public/private in modal
4. `staticGroupStore.createGroup(name, isPublic)` → POST `/api/static-groups`
5. Server generates 6-char share code
6. Returns StaticGroup with owner set to current user
7. Auto-navigate to `/group/{shareCode}`
8. Auto-creates active tier with 8 empty player slots

### 3. Configure Player
1. In GroupView, click empty player slot or "Add Player"
2. Enter character name
3. Select job from JobPicker (auto-sets role)
4. Optionally import BiS:
   - Click "Import BiS" → Opens BiSImportModal
   - Select preset OR paste XIVGear/Etro URL
   - GET `/api/bis/xivgear/{uuid}` or `/api/bis/etro/{uuid}`
   - Returns gear data with item names, icons, levels
5. `tierStore.updatePlayer()` → PUT endpoint
6. Player marked as `configured=true`
7. Gear checkboxes now functional

### 4. Log Loot Drop
1. In GroupView, switch to Loot tab
2. FloorSelector shows current floor's drops
3. Click item to log → Opens QuickLogDropModal
4. Modal shows priority list (sorted by score)
5. Select recipient from list
6. Optional: Check "Update gear" checkbox (default: true)
7. `lootCoordination.logLootAndUpdateGear()`:
   - Creates LootLogEntry via `lootTrackingStore.createLootEntry()`
   - If updateGear=true and method='drop' or 'book':
     - Finds player in tierStore
     - Updates `gear[slot].hasItem = true`
   - If slot='weapon' and updateWeaponPriority=true:
     - Marks main job weapon as received
8. Both stores stay in sync

### 5. Log Material Drop
1. In GroupView Loot tab, select floor with materials
2. Click material (twine/glaze/solvent)
3. Opens QuickLogMaterialModal
4. Shows priority list based on who needs augmentation
5. Select recipient
6. `lootTrackingStore.createMaterialEntry()`
7. Priority recalculates (received count increases)

### 6. Book/Page Tracking
1. After clearing a floor, use "Mark Floor Cleared" button
2. `lootTrackingStore.markFloorCleared()` → POST endpoint
3. Creates PageLedgerEntry for each player with type='earned', quantity=+1
4. When player exchanges books for gear:
   - Log loot with method='book'
   - Optionally create ledger entry with type='spent', quantity=-N
5. Page balances viewable in History tab

### 7. Tier Rollover
1. Current tier complete, need new tier (e.g., M5S-8 → M9S-12)
2. Click "Create Tier" or "Rollover"
3. Select target tier ID from dropdown
4. Choose reset option:
   - **Keep gear**: Copy players with current gear state
   - **Reset gear**: Copy players but clear hasItem/isAugmented
5. `tierStore.rollover()` → POST endpoint
6. Creates new tier with copied roster
7. Loot log NOT copied (stays with source tier)
8. New tier set as active

### 8. Duplicate Group
1. In Dashboard, right-click group → "Duplicate"
2. Enter new name
3. `staticGroupStore.duplicateGroup()`:
   - Creates new group
   - Fetches all tiers from source
   - For each tier: creates tier, copies players
4. Note: Currently has N+1 issue (many API calls)

---

## Data Relationships

```
User (Discord OAuth)
  │
  ├── owns ──────────────> StaticGroup
  │                            │
  │                            ├──> TierSnapshot (one-to-many)
  │                            │        │
  │                            │        ├──> SnapshotPlayer[] (8 slots)
  │                            │        │        │
  │                            │        │        ├──> gear: GearSlotStatus[]
  │                            │        │        ├──> tome_weapon: TomeWeaponStatus
  │                            │        │        ├──> weapon_priorities: WeaponPriority[]
  │                            │        │        └──> user_id: FK→User (for claiming)
  │                            │        │
  │                            │        ├──> LootLogEntry[] (loot drops)
  │                            │        ├──> PageLedgerEntry[] (book tracking)
  │                            │        └──> MaterialLogEntry[] (upgrade materials)
  │                            │
  │                            ├──> Membership[] (members with roles)
  │                            └──> Invitation[] (join links)
  │
  └── joins via Membership ──> StaticGroup
```

**Key Relationships:**
- User → StaticGroup: Owner (1:many)
- User → Membership → StaticGroup: Member (many:many)
- StaticGroup → TierSnapshot: 1:many (one per raid tier)
- TierSnapshot → SnapshotPlayer: 1:8 (fixed party size)
- SnapshotPlayer → User: Optional link for claiming (self-service editing)
- TierSnapshot → LootLogEntry/PageLedgerEntry/MaterialLogEntry: 1:many

---

## Validation Rules

| Context | Field | Validation | Location |
|---------|-------|------------|----------|
| Loot Entry | week_number | >= 1 | `schemas/loot_tracking.py:47-55` |
| Loot Entry | recipient_player_id | Must exist in tier | `loot_tracking.py:152-161` |
| Loot Entry | method | Enum: drop, book, tome | `schemas/loot_tracking.py:27-32` |
| Page Ledger | book_type | Enum: I, II, III, IV | `schemas/loot_tracking.py:91-100` |
| Page Ledger | transaction_type | Enum: earned, spent, missed, adjustment | Schema |
| Material Log | material_type | Enum: twine, glaze, solvent | `schemas/loot_tracking.py:154-162` |
| Membership | (user_id, group_id) | Unique constraint | Model |
| Group Access | Private groups | Require membership | `permissions.py:118-152` |
| Tier Operations | Role | Require Lead+ | `permissions.py:155-161` |
| Destructive Ops | Role | Require Owner | `permissions.py:173-179` |
| Gear Slot | bisSource | Literal: raid, tome | `schemas/tier_snapshot.py:26-36` |

---

## API/Function Reference

### Auth Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/discord` | Get OAuth URL + state |
| POST | `/api/auth/discord/callback` | Exchange code for tokens |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout (token blacklist) |
| POST | `/api/auth/refresh` | Refresh access token |

### Static Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/static-groups` | List user's groups |
| POST | `/api/static-groups` | Create new group |
| GET | `/api/static-groups/by-code/{code}` | Get by share code (public) |
| GET | `/api/static-groups/{id}` | Get group details |
| PUT | `/api/static-groups/{id}` | Update group |
| DELETE | `/api/static-groups/{id}` | Delete group |
| GET | `/api/static-groups/{id}/members` | List members |
| POST | `/api/static-groups/{id}/members` | Add member |
| PUT | `/api/static-groups/{id}/members/{user_id}` | Update member role |
| DELETE | `/api/static-groups/{id}/members/{user_id}` | Remove member |
| POST | `/api/static-groups/{id}/transfer-ownership` | Transfer ownership |

### Tier Snapshots
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/static-groups/{id}/tiers` | List tiers |
| POST | `/api/static-groups/{id}/tiers` | Create tier |
| GET | `/api/static-groups/{id}/tiers/{tierId}` | Get tier with players |
| PUT | `/api/static-groups/{id}/tiers/{tierId}` | Update tier settings |
| DELETE | `/api/static-groups/{id}/tiers/{tierId}` | Delete tier |
| POST | `/api/static-groups/{id}/tiers/{tierId}/rollover` | Copy roster |

### Players
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `.../tiers/{tierId}/players` | List players |
| POST | `.../tiers/{tierId}/players` | Add player slot |
| PUT | `.../tiers/{tierId}/players/{playerId}` | Update player |
| DELETE | `.../tiers/{tierId}/players/{playerId}` | Remove player |
| POST | `.../players/{playerId}/claim` | Claim ownership |
| DELETE | `.../players/{playerId}/claim` | Release ownership |
| PUT | `.../players/{playerId}/weapon-priorities` | Update weapon priorities |
| POST | `.../players/{playerId}/lock-weapon-priorities` | Lock priorities |
| DELETE | `.../players/{playerId}/lock-weapon-priorities` | Unlock priorities |

### Loot Tracking
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `.../tiers/{tierId}/loot-log` | Get loot entries |
| POST | `.../tiers/{tierId}/loot-log` | Create loot entry |
| PUT | `.../tiers/{tierId}/loot-log/{id}` | Update loot entry |
| DELETE | `.../tiers/{tierId}/loot-log/{id}` | Delete loot entry |
| GET | `.../tiers/{tierId}/page-ledger` | Get ledger entries |
| POST | `.../tiers/{tierId}/page-ledger` | Create ledger entry |
| GET | `.../tiers/{tierId}/page-balances` | Get book balances |
| DELETE | `.../players/{playerId}/page-ledger` | Clear player ledger |
| POST | `.../tiers/{tierId}/mark-floor-cleared` | Batch add earnings |
| GET | `.../tiers/{tierId}/material-log` | Get material log |
| POST | `.../tiers/{tierId}/material-log` | Create material entry |
| DELETE | `.../tiers/{tierId}/material-log/{id}` | Delete material entry |
| GET | `.../tiers/{tierId}/material-balances` | Get material balances |
| GET | `.../tiers/{tierId}/current-week` | Get current/max week |
| GET | `.../tiers/{tierId}/weeks-with-entries` | Get weeks with data |
| GET | `.../tiers/{tierId}/weeks-data-types` | Get entry types per week |

### BiS Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bis/presets/{job}` | Get job presets |
| GET | `/api/bis/xivgear/{uuid}` | Import from XIVGear |
| GET | `/api/bis/etro/{uuid}` | Import from Etro |

### Invitations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/static-groups/{id}/invitations` | List invitations |
| POST | `/api/static-groups/{id}/invitations` | Create invitation |
| DELETE | `/api/static-groups/{id}/invitations/{inviteId}` | Revoke invitation |
| GET | `/api/invitations/{code}` | Preview invitation |
| POST | `/api/invitations/{code}/accept` | Accept invitation |

---

## Incomplete Items

| Type | File:Line | Description | Severity |
|------|-----------|-------------|----------|
| **N+1 Query** | `staticGroupStore.ts:163-231` | duplicateGroup makes 36+ API calls for large static | High |
| **Low Test Coverage** | `backend/tests/` | Only 3 test files, missing BiS/tiers/invites/loot tests | High |
| **Large Component** | `GroupView.tsx` (811 lines) | Needs decomposition into smaller components | Medium |
| **JWT Storage** | `authStore.ts` | JWT in localStorage vulnerable to XSS (should use httpOnly cookies) | Medium |
| **Missing Barrel Export** | `components/loot/index.ts` | QuickLogMaterialModal not exported | Low |
| **No Skeleton Loaders** | `Dashboard.tsx:354-357` | Uses spinner instead of skeletons | Low |
| **Missing Debounce** | `InlinePlayerEdit.tsx` | No debounce on name input | Low |
| **No Retry Mechanism** | `GroupView.tsx` | No retry button on API errors | Low |

### Planned Features (Not Implemented)
| Phase | Feature | Status |
|-------|---------|--------|
| Phase 7 | Lodestone auto-sync | Not started |
| Phase 7 | FFLogs integration | Not started |
| Phase 8 | Week-over-week tracking | Not started |
| Phase 8 | Discord Bot | Not started |
| Phase 8 | PWA offline mode | Not started |

---

## Current Gaps

1. **No bulk API** for group duplication (causes N+1 query problem)
2. **No skeleton loaders** during Dashboard loading
3. **No retry mechanism** for failed API calls in GroupView
4. **No debounce** on inline name editing
5. **Test coverage** extremely low (3 files)
6. **JWT storage** in localStorage vulnerable to XSS attacks
7. **GroupView.tsx** is 811 lines and needs component extraction
8. **No offline support** (PWA planned for Phase 8)

---

## File Structure Reference

```
ffxiv-raid-planner/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/         # LoginButton, UserMenu, ProtectedRoute
│   │   │   ├── dnd/          # Drag & drop utilities
│   │   │   ├── history/      # HistoryView, LootLogPanel, PageBalancesPanel
│   │   │   ├── layout/       # Header, Layout
│   │   │   ├── loot/         # LootPriorityPanel, FloorSelector, QuickLog modals
│   │   │   ├── player/       # PlayerCard variants, GearTable, BiSImportModal
│   │   │   ├── primitives/   # IconButton, Badge, Tooltip
│   │   │   ├── static-group/ # StaticSwitcher, TierSelector, GroupSettingsModal
│   │   │   ├── team/         # TeamSummary components
│   │   │   ├── ui/           # Modal, Toast, ContextMenu, TabNavigation
│   │   │   └── weapon-priority/ # WeaponPriorityModal, WeaponPriorityEditor
│   │   ├── gamedata/         # jobs.ts, costs.ts, loot-tables.ts, raid-tiers.ts
│   │   ├── hooks/            # useLootActions, useWeekSummary
│   │   ├── pages/            # Home, Dashboard, GroupView, AuthCallback
│   │   ├── services/         # api.ts (HTTP client)
│   │   ├── stores/           # authStore, staticGroupStore, tierStore, lootTrackingStore
│   │   ├── types/            # index.ts (all TypeScript interfaces)
│   │   └── utils/            # calculations, priority, permissions, lootCoordination
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── routers/          # API route handlers
│   │   ├── services/         # Business logic
│   │   ├── middleware/       # Security headers
│   │   ├── main.py           # FastAPI app
│   │   ├── config.py         # Environment config
│   │   ├── database.py       # Async SQLAlchemy setup
│   │   ├── auth_utils.py     # JWT handling
│   │   ├── permissions.py    # Permission checks
│   │   └── dependencies.py   # FastAPI DI
│   ├── scripts/              # backfill_gcd.py, normalize_preset_names.py
│   └── data/                 # local_bis_presets.json
└── docs/
    ├── CONSOLIDATED_STATUS.md
    ├── GEARING_REFERENCE.md
    ├── GEARING_MATH.md
    └── audits/               # 2026-01-01-comprehensive-audit.md
```

---

# CONDENSED SUMMARY FOR COMPARISON

## Tech Stack (One Line)
React 19 + TypeScript + Vite + Zustand | FastAPI + SQLAlchemy (async) + SQLite/PostgreSQL | JWT + Discord OAuth

## Data Entities (Key Fields)
- **User**: id, discord_id, discord_username, discord_avatar, email, display_name
- **StaticGroup**: id, name, share_code (6-char), is_public, owner_id, settings{lootPriority[]}
- **Membership**: user_id, static_group_id, role (owner|lead|member|viewer)
- **TierSnapshot**: id, tier_id, is_active, current_week, weapon lock settings
- **SnapshotPlayer**: name, job, role, position, configured, gear[], tome_weapon{}, weapon_priorities[]
- **GearSlotStatus**: slot, bisSource (raid|tome), hasItem, isAugmented, itemName, itemIcon, itemLevel
- **TomeWeaponStatus**: pursuing, hasItem, isAugmented
- **WeaponPriority**: job, weaponName, received, receivedDate
- **LootLogEntry**: week_number, floor, item_slot, recipient_player_id, method (drop|book|tome)
- **PageLedgerEntry**: week_number, floor, book_type (I-IV), transaction_type, quantity
- **MaterialLogEntry**: week_number, floor, material_type (twine|glaze|solvent), recipient_player_id
- **Invitation**: invite_code (12-char), role, expires_at, max_uses, use_count

## All Calculations (Shorthand with References)
```
SlotComplete = (raid) ? hasItem : hasItem && isAugmented              [calculations.ts:15]
GearPercent = round(complete/11 * 100)                                [calculations.ts:25]
MaterialsNeeded = count(tome && !augmented) by type                   [calculations.ts:33]
BooksNeeded = sum(BOOK_COSTS[slot]) where raid && !hasItem            [calculations.ts:56]
PriorityScore = (5-roleIdx)*25 + weightedNeed*10                     [priority.ts:28]
WeaponScore = (5-roleIdx)*100 + (1000-rank*100) + mainJobBonus(2000) [weaponPriority.ts:62]
TeamWeeks = max(ceil(floor_books/players))                           [calculations.ts:82]
DroughtBonus = min(weeksSinceLastDrop*10, 50)                        [lootCoordination.ts:371]
BalancePenalty = min((drops-avg)*15, 45)                             [lootCoordination.ts:371]
EnhancedScore = base + droughtBonus - balancePenalty                 [lootCoordination.ts:371]
CurrentWeek = (now-start).days//7 + 1                                [loot_tracking.py:65]
PageBalance = SUM(quantity) GROUP BY book_type                       [loot_tracking.py:312]
MaterialBalance = COUNT(*) GROUP BY player, material_type            [loot_tracking.py:975]
TomeWeeks = ceil(cost/450)                                           [costs.ts:81]
```

## Cost Constants
```
BOOK_COSTS: weapon=8, body/legs=6, head/hands/feet=4, accessories=3
TOMESTONE_COSTS: weapon=500, body/legs=825, head/hands/feet=495, accessories=375
SLOT_VALUE_WEIGHTS: weapon=3.0, body/legs=1.5, head/hands/feet=1.0, accessories=0.8
WEEKLY_TOMESTONE_CAP: 450
```

## Business Rules (One-Liners)
1. Owner/Lead edit all players; Member edits only claimed; Viewer read-only
2. Priority order from settings.lootPriority[] (default: melee>ranged>caster>tank>healer)
3. Only raid BiS pieces with !hasItem eligible for priority calculation
4. Main job weapon priority always wins (+2000 bonus exceeds any combo)
5. Tome BiS requires augmentation to count as complete
6. Ring drops auto-route to ring1 if both need, else whichever needs it
7. Material priority deducts already-received from need count
8. Loot log sync: drop/book method marks gear hasItem=true
9. Delete loot entry reverts gear hasItem=false
10. Solvent cannot be purchased with books (drop-only)

## Core Workflows (Brief Steps)
1. **Auth**: Login→Discord OAuth→callback→tokens→fetchUser
2. **Create Group**: Dashboard→CreateModal→POST→navigate to /group/{code}
3. **Add Player**: GroupView→AddPlayer→selectJob→importBiS→updatePlayer
4. **Log Loot**: FloorSelector→QuickLogModal→selectRecipient→createEntry+updateGear
5. **Rollover**: NewTier→selectSource→optionalResetGear→copyRoster

## Entity Relationships (Simple)
```
User owns StaticGroup → has TierSnapshot → has SnapshotPlayer[8]
User joins StaticGroup via Membership
TierSnapshot has LootLogEntry[], PageLedgerEntry[], MaterialLogEntry[]
SnapshotPlayer links to User via userId (claiming)
```

## Incomplete Items
- **HIGH**: N+1 in duplicateGroup (needs bulk API)
- **HIGH**: Low test coverage (3 files)
- **MEDIUM**: GroupView.tsx 811 lines (needs decomposition)
- **MEDIUM**: JWT in localStorage (XSS vulnerable)
- **LOW**: QuickLogMaterialModal missing from barrel export
- **PLANNED**: Phase 7 (Lodestone/FFLogs), Phase 8 (Discord Bot/PWA)
