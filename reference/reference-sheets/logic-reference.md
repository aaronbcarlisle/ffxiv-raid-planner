# FFXIV Raid Gear Tracker - Spreadsheet Logic Reference

**Document Purpose:** Audit reference for comparing web-app implementation against source spreadsheets  
**Source Spreadsheets Analyzed:**
1. **Savage Group Sheet** by Udra Virias (v1.8)
2. **Arcadion Raid Team Gear Planning** by Wyssberk Kajitani (v7.4)

---

## 1. Structural Analysis

### Spreadsheet 1: Savage Group Sheet (Udra Virias)

| Sheet | Purpose |
|-------|---------|
| **Info & Version Tracker** | Version info, share link, contact info |
| **BiS Tracker** | Per-player gear tracking: slots, sources, have/augmented status, upgrade materials, page requirements |
| **Loot Tracker** | Week-by-week loot distribution log (20 weeks × 8 players × 4 floors) |
| **Quick Summary** | Auto-calculated dashboard: weapon drops, coffer counts, upgrade material status, needed gear |
| **Weapon Tracker** | Weapon priority matrix, drops/coffers per player, mount tracker, auto-priority table by job |

### Spreadsheet 2: Arcadion Raid Team Gear Planning (Wyssberk Kajitani)

| Sheet | Purpose |
|-------|---------|
| **Instructions** | Usage guide, setup instructions, version history, troubleshooting |
| **Heavyweight Gear** | Main gear tracking: desired vs current per slot, iLv display, markers, page calculations, Glaze/Twine tracking |
| **(Alts) Heavyweight Gear** | Linked alt job tracking with combined page totals from main sheet |
| **Heavyweight Loot** | Weekly loot distribution with weights, team member counts, notes |
| **Who Needs It?** | Auto-generated view: which players need which gear from which floor |

---

## 2. Data Entities

### 2.1 Player/Team Member

| Field | Savage Group Sheet | Arcadion Gear Planning | Notes |
|-------|-------------------|------------------------|-------|
| Name | Yes (column header) | Yes (Name row) | Required identifier |
| Job/Class | Implied by role (Tank1, Healer1, etc.) | Explicit (Job row) | Arcadion is more precise |
| Role | Tank, Healer, DPS (4 categories) | Tank, Healer, Melee, Ranged, Caster (5 categories) | Arcadion separates DPS types |
| BiS Link | Yes (reference field) | Yes (Gear Set Link row) | External gear planner URL |
| Alt Jobs | No | Yes (Alt Jobs row + linked sheets) | Arcadion supports multi-job tracking |
| Timestamp | No | Yes (auto-updated) | Tracks when player last updated |
| Extra Notes | No | Yes | Free-text player notes |
| Pages Adjust | No | Yes | Adjust for missed weeks |

**Recommendation:** Use Arcadion's expanded role system (5 categories) and all additional fields.

### 2.2 Gear Slot

| Slot | Savage Group Sheet | Arcadion Gear Planning | Floor |
|------|-------------------|------------------------|-------|
| Weapon | Yes | Yes | 4 |
| Offhand | No | Yes (for applicable jobs) | - |
| Head/Helmet | Yes | Yes | 2 |
| Chest | Yes | Yes | 3 |
| Gloves | Yes | Yes | 2 |
| Legs/Pants | Yes | Yes | 3 |
| Feet/Boots | Yes | Yes | 2 |
| Earring | Yes | Yes | 1 |
| Necklace | Yes | Yes | 1 |
| Bracelet | Yes | Yes | 1 |
| Ring (×2) | Yes (2 rings: Raid + Tome) | Yes (2 rings) | 1 |

**Total Slots:** 11 (10 + second ring slot)

### 2.3 Gear Source/Category

| Category | Savage Group Sheet | Arcadion Gear Planning | iLv (Weapon) | iLv (Armor) |
|----------|-------------------|------------------------|--------------|-------------|
| Savage | Yes ("Raid") | Yes | 795 | 790 |
| Tome Up (Augmented) | Yes (implied by "Augmented?" column) | Yes | 790 | 790 |
| Catchup | No | Yes | 785 | 780 |
| Tome | Yes | Yes | 780 | 780 |
| Relic | No | Yes | 775 | 770 |
| Crafted | No | Yes | 770 | 770 |
| Prep | No | Yes | 775 | 770 |
| Trash | No | Yes | 765 | 760 |
| Wow | No | Yes | 745 | 740 |
| Either | No | Yes (desired-only) | - | - |

**Recommendation:** Use Arcadion's complete category system with iLv values for proper progress visualization.

### 2.4 Upgrade Materials

| Material | Savage Group Sheet | Arcadion Gear Planning | Purpose |
|----------|-------------------|------------------------|---------|
| Polish (Glaze) | Yes | Yes (💍 emoji) | Accessory upgrade |
| Weave (Twine) | Yes | Yes (👢 emoji) | Armor upgrade |
| Solvent | Implied | Yes | Weapon upgrade |
| Weapon Token | Yes | Yes | 4th floor weapon coffer |

### 2.5 Markers/Status Flags

| Marker | Savage Group Sheet | Arcadion Gear Planning | Meaning |
|--------|-------------------|------------------------|---------|
| Have? | Yes (TRUE/FALSE) | Implicit (Current = Desired) | Player has the item |
| Augmented? | Yes (TRUE/FALSE) | Implicit (Tome Up category) | Tome gear is upgraded |
| 🔨 | No | Yes | Plan to craft this slot |
| 📃 | No | Yes | Bought with pages |
| ♻️ | No | Yes | Bought with 4th floor pages |
| 💰 | No | Yes | Bought token via alliance/hunts |
| ◀️ | No | Yes | Plan to improve next |
| 💾 | No | Yes | Already have the upgrade token |

**Recommendation:** Implement Arcadion's marker system for planning granularity.

### 2.6 Page Types

| Page Type | Floor | Items Purchasable |
|-----------|-------|-------------------|
| M1S Pages | 1 | Accessories (Earring, Necklace, Bracelet, Ring) |
| M2S Pages | 2 | Left-side gear (Head, Gloves, Boots) |
| M3S Pages | 3 | Body pieces (Chest, Pants) |
| M4S Pages | 4 | Weapon token + any item |

### 2.7 Loot Entry

| Field | Savage Group Sheet | Arcadion Gear Planning |
|-------|-------------------|------------------------|
| Week | Yes (1-20) | Yes (1-20+) |
| Floor | Yes (1-4) | Yes (1-4) |
| Item | Yes (text: ring, brace, etc.) | Yes (column: Earring, Necklace, etc.) |
| Recipient | Yes (column per player) | Yes (Recipient row) |
| Notes | No | Yes |
| Polish/Weave/Solvent | Yes (separate row) | Yes (separate columns) |
| Mount | Savage: separate tracker | Yes (column) |
| Coffer | Yes | Yes |
| Weight | No | Yes (configurable per column) |

**Recommendation:** Use Arcadion's structured loot format with weights and notes.

---

## 3. Calculations & Formulas

### 3.1 Progress/Completion Calculations

#### BiS Progress Percentage
```
BiS_Progress = (slots_with_desired_gear / total_bis_slots) × 100
```
Where:
- `total_bis_slots` = 11 (including both rings)
- `slots_with_desired_gear` = COUNT of slots where Current == Desired

#### iLv Calculation (Arcadion method - MORE PRECISE)
```
Average_iLv = SUM(slot_ilv for all equipped slots) / equipped_slot_count
```
Each gear category maps to an iLv value (see table 2.3).

### 3.2 Page Calculations

#### Current Pages per Floor
```
Current_Pages[floor] = (Team_Clears[floor] × pages_per_clear) + Pages_Adjust[floor]
```
Where `pages_per_clear` varies by floor:
- Floor 1-3: Fixed page drops per clear
- Floor 4: 8 pages per clear (weapon token = 8 pages)

#### Spent Pages per Floor
```
Spent_Pages[floor] = SUM(page_cost for items purchased from floor)
```
Page costs:
- Floor 1 accessories: 3 pages each (estimated from data showing 3 pages needed)
- Floor 2 armor: 3 pages each
- Floor 3 armor: Varies (Chest/Pants)
- Floor 4: 8 pages for weapon token

#### Pages Needed per Floor
```
Pages_Needed[floor] = SUM(page_cost for each BiS item from floor NOT yet obtained) - Spent_Pages[floor]
```

**Arcadion Specific:**
```
Pages_Needed[floor] = base_need - (Current_Pages[floor] - Spent_Pages[floor])
```

#### Total Pages Needed (with Alt Linking)
```
Linked_Total[floor] = SUM(Pages_Needed[floor] for main + all linked alt sheets)
```

### 3.3 Upgrade Material Calculations

#### Polish/Glaze Still Needed (Savage Group Sheet)
```
Polish_Still_Need = Total_Need - Bought - Drops
```
Where:
- `Total_Need` = COUNT of BiS accessory slots requiring raid gear (1 per augmented tome accessory)
- `Bought` = manually tracked purchases
- `Drops` = manually tracked floor drops

#### Twine/Weave Still Needed
```
Weave_Still_Need = Total_Need - Bought - Drops
```
Where `Total_Need` = COUNT of BiS armor slots requiring upgrade

### 3.4 Weapon/Coffer Tracking

#### Weapon Token Need
```
Weapon_Token_Needed = 1 if (BiS_Weapon == "Raid" AND Has_Weapon == FALSE) else 0
```

#### Weeks to Weapon Token
```
Weeks_To_Token = CEILING((8 - current_floor4_pages) / pages_per_week)
```

### 3.5 Tome Calculations (Savage Group Sheet specific)

#### Total Tomes Needed
```
Total_Tomes = SUM(tome_cost for each BiS Tome item) + upgrade_tome_cost
```
Example from data: 375 tomes total

#### Weeks of Tome Cap
```
Weeks_For_Tomes = Total_Tomes / weekly_tome_cap
```
Weekly cap = 450 tomes
Example: 375 / 450 = 0.83 weeks

### 3.6 Loot Count Calculations (Arcadion method)

#### Total Loot Count per Player
```
Loot_Count[player] = SUM(weight[column] × item_received[column] for all loot columns)
```
Where:
- Default weight = 1
- Weight = 0 for items like Music, Mount (configurable)
- Only counts if Recipient == player_name

#### Adjusted Loot Count
```
Adjusted_Loot_Count = Loot_Count + Adjust_Loot + Adjust_Weapons
```
For tracking loot received outside team/before joining.

### 3.7 "Who Needs It?" Logic

#### Needs Gear Check
```
Needs_Gear[player][slot] = (Desired[slot] == "Savage") AND (Current[slot] != Desired[slot])
```
Returns TRUE/FALSE per player per slot.

#### Free Roll Eligibility (team-wide)
```
Free_Roll[slot] = NOT(ANY(Needs_Gear[player][slot] for player in team))
```
If no player needs the savage drop for BiS, coffers are free roll.

---

## 4. Business Rules

### 4.1 Loot Priority Rules

#### Savage Group Sheet - Weapon Priority System
The sheet defines explicit priority queues per weapon type:
```
Priority_Queue[weapon_job] = ordered_list of players
```
Example from data:
- DRK weapon: [Udra, Tank2, Healer1, Healer2, DPS1, DPS2, DPS3, DPS4]
- VPR weapon: staggered priority across multiple positions
- PCT weapon: staggered priority across multiple positions

**Decision Logic:**
1. Look up weapon type that dropped
2. Find first player in priority queue who hasn't received weapon
3. Award to that player

#### Arcadion Gear Planning - Loot Distribution
Uses loot count balancing:
```
Priority = players with LOWEST Adjusted_Loot_Count
```
Ties resolved by:
- Who needs it more for BiS (Pages_Needed comparison)
- Team discussion (facilitated by color coding: blue = most loot, yellow = least loot)

**Recommendation:** Implement both systems:
- Configurable priority queues for high-value items (weapons, mounts)
- Loot count balancing with tie-breaker logic for regular gear

### 4.2 Eligibility Rules

#### Can Receive Item
```
Eligible[player][item] = (
    slot_is_in_player_bis AND
    player_does_not_have_item AND
    item_type_matches_job_role
)
```

#### Coffer Distribution
From Arcadion:
```
Coffer_Priority = [
    players_needing_for_BiS,
    players_for_ilv_padding,
    players_for_alt_jobs
]
```

### 4.3 Data Validation Rules

#### Gear Source Validation
- Only valid categories: Savage, Tome Up, Tome, Catchup, Relic, Crafted, Prep, Trash, Wow, Either
- Ring slots can mix sources (one Tome, one Savage)

#### Slot-Floor Mapping
- Floor 1: Earring, Necklace, Bracelet, Ring
- Floor 2: Head, Gloves, Boots, Glaze token
- Floor 3: Chest, Pants, Twine token, Solvent token
- Floor 4: Weapon, Coffer (any slot), Music, Mount

#### Team Composition
- Standard: 8 players (2 Tank, 2 Healer, 4 DPS)
- Arcadion splits DPS into: 2 Melee, 1 Ranged, 1 Caster

### 4.4 Weekly Reset Logic

```
On_Weekly_Reset:
    Team_Clears[floor] += clears_this_week
    Current_Pages[floor] = recalculate()
    Available_Loot[week] = initialize_new_week()
```

---

## 5. Core Workflows

### 5.1 Initial Setup Workflow

1. Create team/static
2. Add 8 players with names, jobs, roles
3. Each player enters:
   - BiS gear set link (external URL)
   - Desired gear per slot (gear source category)
   - Current gear per slot
   - (Optional) Alt jobs
4. System calculates initial Pages Needed

### 5.2 Weekly Raid Workflow

1. **Pre-raid:** Review "Who Needs It?" to plan loot distribution
2. **During raid:** Track floor clears (increment Team Clears)
3. **Post-floor:** Record loot drops:
   - Select item that dropped
   - Select recipient
   - (Optional) Add notes
4. **Post-raid:** Players update Current gear for received items
5. System auto-updates: Pages, Progress, Loot Counts

### 5.3 Loot Decision Workflow

1. Item drops from floor
2. Check "Who Needs It?" for eligible players
3. If multiple need:
   - Check priority queue (if configured for item type)
   - OR compare Loot_Count (lowest gets priority)
   - OR compare Pages_Needed (highest need gets priority)
4. Record recipient in loot log
5. Recipient updates Current gear

### 5.4 Tome/Page Purchase Workflow

1. Player earns tome cap or accumulates pages
2. Check Pages_Needed per floor
3. Purchase item from vendor
4. Update marker (📃 or ♻️) on gear slot
5. Update Spent_Pages
6. Update Current gear when item acquired

### 5.5 Progress Review Workflow

1. Open summary/dashboard view
2. Review per-player:
   - BiS completion percentage
   - Pages still needed by floor
   - Upgrade materials still needed
3. Identify:
   - Lagging players (high Pages_Needed)
   - Completed players (eligible for free roll/alts)
   - Upcoming milestone (e.g., everyone has weapon)

### 5.6 Alt Job Tracking Workflow (Arcadion-specific)

1. Duplicate gear sheet for alt tracking
2. Enter Linked Sheet name (reference to main sheet)
3. System combines page totals:
   - Current Pages from main
   - Pages Needed aggregated across linked sheets
4. Alt gear doesn't affect main BiS progress but shares page pool

---

## 6. Data Relationships

### Entity Relationship Diagram (Text)

```
Team
 └── Players (1:8)
      ├── Main Job (1:1)
      │    └── Gear Slots (1:11)
      │         ├── Desired Gear (1:1) → Gear Category
      │         ├── Current Gear (1:1) → Gear Category
      │         └── Markers (1:many) → Marker Type
      ├── Alt Jobs (1:many) [via Linked Sheets]
      │    └── Gear Slots (same structure)
      └── Loot History (1:many)
           └── Loot Entry → Item + Week + Floor

Floor
 └── Drops Available (1:many)
      └── Item Type

Week
 └── Loot Entries (1:many per floor)
      └── Loot Entry

Gear Category
 └── iLv Values
 └── Source Type (Raid/Tome/Other)

Pages
 └── Floor → Page Count
 └── Player → Pages Adjust
```

### Key Relationships

| Relationship | Cardinality | Description |
|-------------|-------------|-------------|
| Team → Player | 1:8 | Fixed team composition |
| Player → Job | 1:many | Main + alts |
| Job → Gear Slot | 1:11 | Standard gear slots |
| Gear Slot → Gear Category | 2:1 | Desired and Current |
| Floor → Item Type | 1:many | Fixed drop table |
| Week × Floor → Loot Entry | 1:many | Weekly loot log |
| Loot Entry → Player | many:1 | Recipient |

---

## 7. Validation Rules

### Required Fields
- Player Name (non-empty, unique within team)
- Job (valid FFXIV job abbreviation)
- Desired gear per slot (valid category or empty)

### Data Constraints
- Team size: 8 players
- Weeks: 1-20+ (expandable)
- Floors: 1-4
- Page values: non-negative integers
- iLv: 740-795 (current tier range)

### Business Constraints
- Only one weapon per player (weapon token consumed)
- Ring slots: can have different sources (one Tome, one Savage)
- Coffer: can satisfy any gear slot
- Linked sheets must reference valid sheet names

### Input Validation
- Gear category must be from valid enum
- Markers must be valid emoji/symbol set
- Loot recipient must match team member name exactly

---

## 8. Comparison: Which Approach is Better?

### Areas Where Arcadion is Superior

| Feature | Why Better |
|---------|------------|
| **Gear Categories** | 9 categories vs 2 - allows tracking progression through multiple gear tiers |
| **iLv Tracking** | Explicit iLv per category enables actual average iLv calculation |
| **Color Coding** | Automatic visual feedback (Purple/Blue/Green/Yellow/White/Red) |
| **Markers** | 6 planning markers vs 2 status flags - better planning granularity |
| **Role Split** | 5 roles (separate Melee/Ranged/Caster) vs 4 - matches actual job categories |
| **Linked Sheets** | Alt job support with combined page tracking |
| **Timestamps** | Track when players last updated |
| **Loot Weights** | Configurable weighting for different loot types |
| **Notes Fields** | Per-player notes, loot notes |
| **Pages Adjust** | Handle missed weeks per player |

### Areas Where Savage Group Sheet is Superior

| Feature | Why Better |
|---------|------------|
| **Weapon Priority** | Explicit priority queues per weapon type - clear, deterministic |
| **Tome Tracking** | Explicit tome cost and weeks calculation |
| **Simpler Format** | Easier for basic teams to adopt |

### Recommended Hybrid Approach

1. Use Arcadion's data model (gear categories, iLv, markers, linked sheets)
2. Add Savage Group Sheet's weapon priority queue system
3. Add explicit tome tracking calculations
4. Implement both loot distribution methods:
   - Priority queues (configurable per item type)
   - Loot count balancing (default for non-priority items)

---

## 9. Recommended Web-App Improvements

### Data Entry Improvements
1. **Import from XivGear/Etro:** Auto-populate BiS from gear planner links
2. **Dropdown validation:** Enforce valid categories/jobs
3. **Bulk updates:** Update team clears once, propagate to all players
4. **Auto-save:** Eliminate manual save step

### Calculation Improvements
1. **Real-time progress bars:** Visual BiS completion
2. **Projected completion date:** Based on page accumulation rate
3. **Optimal loot distribution:** Algorithm to minimize time-to-BiS team-wide
4. **What-if analysis:** "If X gets this coffer, how does it affect team progress?"

### Workflow Improvements
1. **Loot roll integration:** Generate suggested recipient during raid
2. **Weekly checklist:** Guided flow for weekly updates
3. **Notification system:** Alert when player can purchase upgrade
4. **History/audit log:** Track all changes with timestamps

### Collaboration Improvements
1. **Real-time sync:** Multiple users editing simultaneously
2. **Permission levels:** Loot master vs player vs viewer
3. **Discord integration:** Post updates to channel
4. **Mobile view:** Simplified view for checking during raid

### Missing Features to Add
1. **Multiple tiers:** Support tracking across raid tiers (not just current)
2. **Job-specific slots:** Handle PLD/WAR off-hand
3. **Materia tracking:** BiS melds per slot
4. **Food/pot buffs:** Track consumables for raid
5. **Clear history:** Track when each floor was first cleared

---

## 10. Formula Reference Quick Guide

### Page Formulas
```
Current_Pages[f] = Team_Clears[f] × pages_per_clear + Adjust[f]
Spent_Pages[f] = SUM(purchased items from floor f)
Pages_Needed[f] = BiS_Items_From_Floor[f] × cost - Current + Spent
```

### Progress Formulas
```
BiS_Complete = COUNT(Current == Desired) / 11 × 100
Avg_iLv = SUM(iLv_lookup[Current[slot]]) / 11
```

### Loot Formulas
```
Loot_Count = SUM(weight × received for all weeks)
Adjusted_Count = Loot_Count + Adjust_Loot + Adjust_Weapons
Needs_Item = (Desired == "Savage") AND (Current != "Savage")
```

### Priority Formulas
```
Priority_Score = (Pages_Needed / Max_Pages) × 0.5 + (1 / Loot_Count) × 0.5
```
(Suggested composite priority - not in original sheets)

---

## CONDENSED SUMMARY FOR COMPARISON

### Data Entities & Key Fields

**Player:**
- name, job, role (Tank/Healer/Melee/Ranged/Caster), bis_link, alt_jobs[], extra_notes, pages_adjust[4], timestamp

**Gear Slot (11 total):**
- slot_type (Weapon/Offhand/Head/Chest/Gloves/Pants/Boots/Earring/Necklace/Bracelet/Ring×2)
- desired_source, current_source, markers[]
- floor_source: {1: accessories, 2: left-side, 3: body, 4: weapon/coffer}

**Gear Category:**
- enum: [Savage, Tome Up, Catchup, Tome, Relic, Crafted, Prep, Trash, Wow, Either]
- ilv_map: {Savage: 790, Tome Up: 790, Catchup: 780, Tome: 780, Relic: 770, Crafted: 770, Prep: 770, Trash: 760, Wow: 740}

**Markers:** [🔨craft, 📃pages, ♻️floor4pages, 💰alliance, ◀️improve_next, 💾have_token]

**Upgrade Materials:** [Glaze/Polish (acc), Twine/Weave (armor), Solvent (weapon)]

**Loot Entry:**
- week, floor, item_type, recipient, notes, weight

### Calculations (Shorthand)

```
BiS_Progress = count(current==desired) / 11 × 100
Avg_iLv = sum(ilv_map[current[slot]]) / 11
Current_Pages[f] = clears[f] × pages_per_clear + adjust[f]
Pages_Needed[f] = bis_from_floor[f] × cost - current[f] + spent[f]
Loot_Count = sum(weight × received) + adjust_loot + adjust_weapons
Needs_Item[p][s] = (desired[s]=="Savage") AND (current[s]!="Savage")
Free_Roll[s] = NOT(any(needs_item[p][s] for p in players))
Upgrade_Need = count(bis_slots_needing_upgrade) - bought - drops
Weeks_To_Weapon = ceil((8 - floor4_pages) / pages_per_week)
```

### Business Rules (One-Liners)

1. **Loot priority:** Explicit queue > lowest loot count > highest pages needed
2. **Eligibility:** Player needs item for BiS AND doesn't have it AND job matches
3. **Free roll:** When no player needs item for BiS
4. **Coffer priority:** BiS need > iLv padding > alt jobs
5. **Page accumulation:** Auto-increment on floor clear, adjust per player for missed weeks
6. **Linked alts:** Share page pool, separate gear tracking
7. **Weapon token:** 8 floor4 pages, once per player
8. **Team composition:** 2 Tank, 2 Healer, 2 Melee, 1 Ranged, 1 Caster (8 total)

### Core Workflows (Numbered Steps)

**Weekly Raid:**
1. Pre-raid: Review "Who Needs It" view
2. Clear floor → Increment clears
3. Item drops → Check eligibility → Apply priority → Record recipient
4. Recipient updates current gear
5. System recalculates pages, progress, loot counts

**Loot Decision:**
1. Identify eligible players (needs for BiS)
2. Check priority queue (if exists for item type)
3. Else: Compare loot counts (lowest wins)
4. Tie-breaker: Highest pages needed
5. Record and update

**Purchase Decision:**
1. Check pages_needed per floor
2. Identify affordable items
3. Apply marker (📃 or ♻️)
4. Update spent_pages and current gear

### Data Relationships (Simple Notation)

```
Team (1) → Players (8)
Player (1) → MainJob (1) + AltJobs (0..n)
Job (1) → GearSlots (11)
GearSlot (1) → DesiredCategory (1) + CurrentCategory (1) + Markers (0..n)
Floor (1) → ItemTypes (many) [fixed drop table]
Week×Floor → LootEntries (0..many)
LootEntry → Recipient (1 player)
GearCategory → iLv (lookup)
```

### Validation Rules (Compact)

- player.name: required, unique
- player.job: valid FFXIV job enum
- gear_slot.desired: valid category or null
- gear_slot.current: valid category
- loot.recipient: must match existing player.name
- pages: non-negative integers
- floor: 1-4
- week: 1+
- team.players.length: 8

### Critical Web-App Improvements

1. **Import BiS from XivGear/Etro** - eliminate manual entry
2. **Real-time loot recommendations** - during raid
3. **Projected completion dates** - based on page rates
4. **Priority queue builder** - for weapons/high-value items
5. **Multi-tier support** - track across raid tiers
6. **Audit log** - all changes timestamped
7. **Mobile-optimized "Who Needs It"** - quick raid reference
8. **Discord webhook** - post loot assignments
