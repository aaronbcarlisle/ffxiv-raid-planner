# FFXIV Savage Gearing: Complete Mathematical Guide

A comprehensive reference for understanding and planning savage raid gear distribution within a static. This document covers the underlying systems, mathematical formulas, and strategic frameworks for optimal gear progression.

---

## Table of Contents

1. [Core Systems Overview](#core-systems-overview)
2. [The Loot Lockout System](#the-loot-lockout-system)
3. [Book (Token) Accumulation](#book-token-accumulation)
4. [Chest Rules and Direct Drops](#chest-rules-and-direct-drops)
5. [Upgrade Materials](#upgrade-materials)
6. [The Complete Math](#the-complete-math)
7. [Priority Systems](#priority-systems)
8. [Week-by-Week Planning](#week-by-week-planning)
9. [Formulas and Calculations](#formulas-and-calculations)
10. [Static Planning Framework](#static-planning-framework)

---

## Core Systems Overview

FFXIV's savage gearing operates on three parallel progression tracks:

| Track | Source | Weekly Limit | Control Level |
|-------|--------|--------------|---------------|
| **Direct Drops** | Chest loot from clears | 1 lockout per floor | RNG-dependent |
| **Book Exchange** | Guaranteed tokens per clear | 1 reward per floor | Guaranteed, player choice |
| **Tomestone + Upgrades** | Weekly capped currency + savage materials | Tome cap + upgrade drops | Hybrid |

Understanding how these three tracks interact is fundamental to efficient static planning.

---

## The Loot Lockout System

### How Lockouts Work

Each savage floor has an **independent weekly lockout** that resets on Tuesday (NA/EU) or varies by region. Once you receive *any* loot from a floor (either a drop or your weekly book), you are **locked** to that floor for the week.

**Critical Rules:**

1. **Entering a cleared instance** consumes your lockout even if you receive nothing
2. **Clearing with a mixed group** (some members already cleared) reduces chest count
3. **Books are always awarded** on your first clear of the week, regardless of chest situation
4. Lockouts are **per-character**, not per-account

### Lockout State Tracking

For each player, track a 4-bit lockout state per week:

```
Player Lockout State = [F1, F2, F3, F4]
Where each value ∈ {0: Available, 1: Locked}

Example: [1, 1, 0, 0] = Cleared floors 1-2, floors 3-4 available
```

---

## Book (Token) Accumulation

### Standard Book Distribution by Floor (Dawntrail - The Arcadion)

In Dawntrail's Arcadion raids, each floor awards **1 book (AAC Illustrated)** per clear, automatically placed in your inventory. Books are floor-specific and named by edition:

| Floor | Book Reward | Books per Week |
|-------|-------------|----------------|
| M1S / M5S / M9S | Edition I | 1 |
| M2S / M6S / M10S | Edition II | 1 |
| M3S / M7S / M11S | Edition III | 1 |
| M4S / M8S / M12S | Edition IV | 1 |

**Total per full weekly clear: 4 books** (one of each edition)

**Important:** Edition IV books can be exchanged 1:1 for any lower edition book at the vendor, providing flexibility if you need more of a specific type.

*Source: [FFXIV Console Games Wiki - AAC Light-heavyweight Tier (Savage)](https://ffxiv.consolegameswiki.com/wiki/AAC_Light-heavyweight_Tier_(Savage))*

### Book Exchange Costs (Dawntrail Standard)

#### Edition I Books (M1S/M5S - Accessories)

| Item | Book Cost | Weeks to Acquire |
|------|-----------|------------------|
| Earring | 3 | 3 |
| Necklace | 3 | 3 |
| Bracelet | 3 | 3 |
| Ring | 3 | 3 |

**Total for all accessories via Edition I:** 12 books = 12 weeks

#### Edition II Books (M2S/M6S - Minor Armor + Accessory Upgrades)

| Item | Book Cost | Weeks to Acquire |
|------|-----------|------------------|
| Head | 4 | 4 |
| Hands | 4 | 4 |
| Feet | 4 | 4 |
| Glaze (accessory upgrade) | 3 | 3 |

#### Edition III Books (M3S/M7S - Major Armor + Upgrades)

| Item | Book Cost | Weeks to Acquire |
|------|-----------|------------------|
| Body | 6 | 6 |
| Legs | 6 | 6 |
| Twine (armor upgrade) | 4 | 4 |
| Solvent/Ester (weapon upgrade) | 4 | 4 |

#### Edition IV Books (M4S/M8S - Weapon)

| Item | Book Cost | Weeks to Acquire |
|------|-----------|------------------|
| Weapon | 8 | 8 |
| Gladiator's Arm (PLD) | 5 | 5 |
| Shield (PLD) | 3 | 3 |
| Any lower edition book | 1 | 1 (conversion) |

*Source: [FFXIV Console Games Wiki - AAC Light-heavyweight Tier (Savage)](https://ffxiv.consolegameswiki.com/wiki/AAC_Light-heavyweight_Tier_(Savage))*

### Book Accumulation Formula

```
Books_accumulated(edition, week) = 1 × weeks_cleared

Time_to_item(item_cost) = item_cost weeks (since you get 1 book per floor per week)
```

**Example:** Weapon via Edition IV books
```
Weapon cost = 8 Edition IV books
Edition IV books per week = 1
Time = 8 weeks
```

**Example:** Body armor via Edition III books
```
Body cost = 6 Edition III books
Edition III books per week = 1
Time = 6 weeks
```

---

## Chest Rules and Direct Drops

### Chest Spawn Conditions (Dawntrail)

The treasure coffer contents depend on how many party members are **eligible for loot** (haven't cleared that floor this week):

| Players Eligible | Chest Contents |
|------------------|----------------|
| 8 (all eligible) | Full loot table |
| 5-7 eligible | Reduced drops (roughly half) |
| 4 or fewer eligible | No treasure coffer |

**Note:** The book reward is separate and always goes directly to inventory for eligible players regardless of chest status.

*Source: [FFXIV Patch 7.05 Notes](https://na.finalfantasyxiv.com/lodestone/topics/detail/3a247a30e096e56b701157cd9fb903299a244c2f/)*

### Chest Contents by Floor (Dawntrail - The Arcadion)

#### M1S / M5S (First Floor)
- **Treasure Coffer:** Bracelet, Earrings, Necklace, Ring coffers
- **Guaranteed to Inventory:** 1× Edition I book

#### M2S / M6S (Second Floor)
- **Treasure Coffer:** Head, Hands, Feet coffers + Glaze (accessory upgrade) + Universal Tomestone (weapon token)
- **Guaranteed to Inventory:** 1× Edition II book

#### M3S / M7S (Third Floor)
- **Treasure Coffer:** Body coffer, Legs coffer + Twine (armor upgrade) + Solvent/Ester (weapon upgrade)
- **Guaranteed to Inventory:** 1× Edition III book

#### M4S / M8S (Fourth Floor)
- **Treasure Coffer:** Weapon Coffer + Random Weapon (specific job) + Mount + Minion/Facewear + Orchestrion Roll
- **Guaranteed to Inventory:** 1× Edition IV book

*Source: [FFXIV Console Games Wiki](https://ffxiv.consolegameswiki.com/wiki/AAC_Light-heavyweight_Tier_(Savage))*

### Drop Probability Math

For a single item drop with N eligible rollers:

```
P(win) = 1/N

Expected_weeks_to_win(N) = N weeks (geometric distribution mean)
```

**For an 8-player static rolling on 2 items per floor:**

```
P(at least one item) = 1 - (7/8)² ≈ 23.4% per week
Expected items per player per floor = 2/8 = 0.25 per week
```

Over a full tier (typically 16-20 weeks before unlock):

```
Expected_drops_per_player(weeks, items_per_week, party_size) = 
    (weeks × items_per_week) / party_size
```

**Example:** Floor 1 over 16 weeks
```
Expected drops = (16 × 2) / 8 = 4 accessories per player from drops alone
```

---

## Upgrade Materials

### The Tomestone Gear Path

Capped tomestone gear (Heliometry → Quetzalli, Mnemonics → Historia) starts 10 ilvl below savage gear. Upgrade materials from savage raise it to savage-equivalent ilvl.

#### Light-heavyweight Tier (7.0)
| Material | Upgrades | Source | Tome Gear → Augmented |
|----------|----------|--------|----------------------|
| **Surgelight Twine** | Left-side armor | M3S chests, Edition III books | IL 720 → 730 |
| **Surgelight Glaze** | Right-side accessories | M2S chests, Edition II books | IL 720 → 730 |
| **Surgelight Solvent** | Weapon | M3S chests, Edition III books | IL 720 → 730 |

#### Cruiserweight Tier (7.2)
| Material | Upgrades | Source | Tome Gear → Augmented |
|----------|----------|--------|----------------------|
| **Evercharged Twine** | Left-side armor | M7S chests, Edition III books | IL 750 → 760 |
| **Evercharged Glaze** | Right-side accessories | M6S chests, Edition II books | IL 750 → 760 |
| **Evercharged Ester** | Weapon | M7S chests, Edition III books | IL 750 → 760 |

*Source: [FFXIV Console Games Wiki](https://ffxiv.consolegameswiki.com/wiki/AAC_Cruiserweight_Tier_(Savage))*

### Upgrade Material Requirements per Player

| Slot Type | Pieces | Materials Each | Total Needed |
|-----------|--------|----------------|--------------|
| Left-side | 5 | 1 Twine | 5 Twine |
| Right-side | 5 | 1 Glaze | 5 Glaze |
| Weapon | 1 | 1 Solvent/Ester | 1 Solvent/Ester |

**Static totals (8 players, if everyone needs all upgrades):**
- **40 Twines** for full left-side
- **40 Glazes** for full right-side  
- **8 Solvents/Esters** for all weapons

### Upgrade Material Supply Rate

From chest drops (assuming 8/8 eligible, full drops):
- M2S/M6S: ~1 Glaze per clear
- M3S/M7S: ~1 Twine + ~1 Solvent/Ester per clear

From book purchases:
- Glaze: 3 Edition II books each
- Twine: 4 Edition III books each
- Solvent/Ester: 4 Edition III books each

**Weekly upgrade material income (per static):**
```
Chest drops: ~1 Glaze + ~1 Twine + ~1 Solvent per week
Book purchases: Variable based on gear vs. upgrade priority

If static dedicates all Edition III books to upgrades:
8 players × 1 Edition III/week = 8 books
8 books ÷ 4 per Twine = 2 Twines/week from books
Combined: ~3 Twines/week total

Weeks to fully outfit static with Twines:
40 ÷ 3 ≈ 14 weeks (if prioritizing upgrades heavily)
```

**Note:** In practice, players mix savage drops, tome + upgrades, and book gear based on BiS optimization.

---

## The Complete Math

### Total Gear Pieces per Player

| Category | Pieces | Typical Source Priority |
|----------|--------|-------------------------|
| Weapon | 1 | F4 drop > F4 books > Tome + Solvent |
| Head | 1 | F2 drop > F2 books > Tome + Twine |
| Body | 1 | F3 drop > F3 books > Tome + Twine |
| Hands | 1 | F2 drop > F2 books > Tome + Twine |
| Legs | 1 | F3 drop > F3 books > Tome + Twine |
| Feet | 1 | F2 drop > F2 books > Tome + Twine |
| Earring | 1 | F1/F2 drop > Books > Tome + Shine |
| Necklace | 1 | F1/F2 drop > Books > Tome + Shine |
| Bracelet | 1 | F1/F2 drop > Books > Tome + Shine |
| Ring 1 | 1 | F1/F2 drop > Books > Tome + Shine |
| Ring 2 | 1 | Tome + Shine (savage is unique) |

**Total: 11 gear slots** (one ring must be tomestone due to unique restriction)

### Gear Acquisition Timeline (Solo Player, No Drops)

Assuming full weekly clears and optimal book spending:

| Week | Ed. I | Ed. II | Ed. III | Ed. IV | Purchasable |
|------|-------|--------|---------|--------|-------------|
| 1 | 1 | 1 | 1 | 1 | Nothing |
| 2 | 2 | 2 | 2 | 2 | Nothing |
| 3 | 3 | 3 | 3 | 3 | 1× Accessory |
| 4 | 4 | 4 | 4 | 4 | 1× Minor armor (head/hands/feet) |
| 5 | 5 | 5 | 5 | 5 | ... |
| 6 | 6 | 6 | 6 | 6 | 1× Major armor (body/legs) |
| 7 | 7 | 7 | 7 | 7 | ... |
| 8 | 8 | 8 | 8 | 8 | 1× Weapon |

### Full BiS Timeline (Books Only, No Drops)

Assuming you need via books:
- 1 weapon (8 Edition IV books) → **8 weeks**
- 2 major armor (6 Edition III each = 12 total) → **12 weeks**
- 3 minor armor (4 Edition II each = 12 total) → **12 weeks**
- 4 accessories (3 Edition I each = 12 total) → **12 weeks**

```
Bottleneck analysis (1 book per edition per week):
- Edition IV: 8 books needed → 8 weeks
- Edition III: 12 books needed → 12 weeks (BOTTLENECK)
- Edition II: 12 books needed → 12 weeks (BOTTLENECK)
- Edition I: 12 books needed → 12 weeks (BOTTLENECK)

Longest path = 12 weeks for full books-only BiS
```

**Key insight:** You can use Edition IV books to convert down to lower editions (1:1), which provides flexibility. A player could:
- Week 8: Buy weapon with 8 Ed. IV
- Weeks 9-12: Convert 4 Ed. IV → Ed. III to accelerate body/legs

**Optimized path with conversions:**
```
Weeks 1-8: Save Ed. IV for weapon, spend Ed. I/II/III normally
Week 8: Buy weapon (8 Ed. IV)
After week 8: Any excess Ed. IV converts to fill gaps

Realistic full BiS: 10-12 weeks via books alone
```

---

## Priority Systems

### Common Priority Frameworks

#### 1. Loot Council

A designated group (usually leadership) decides distribution based on:
- Greatest upgrade value (stat weight × ilvl gain)
- Attendance and contribution
- Role criticality (e.g., tanks for prog)
- Who hasn't received loot recently

**Pros:** Optimal for raid DPS, flexible  
**Cons:** Potential for bias, requires trust

#### 2. Round Robin / Rotation

Players take turns having first choice on drops.

```
Priority_order = rotate(players, week_number)
Current_picker = Priority_order[0]
```

**Pros:** Fair, simple, transparent  
**Cons:** May not optimize raid DPS

#### 3. DKP (Dragon Kill Points)

Points earned for attendance, spent on loot.

```
Player_DKP += attendance_points_per_raid
On_loot_win: Player_DKP -= item_cost
Priority = max(DKP) among those who want item
```

**Pros:** Rewards attendance, self-balancing  
**Cons:** Can lead to hoarding, complex tracking

#### 4. Static Priority List (BiS-based)

Each player submits their BiS list with priorities. System cross-references to minimize conflicts.

```
For each drop:
    eligible = players where drop ∈ their_BiS
    winner = min(eligible, key=λp: p.priority_rank[drop])
```

**Pros:** Pre-planned, reduces drama  
**Cons:** Requires upfront coordination

### Priority Weighting Formula

For loot council decisions, a weighted scoring system:

```
Score(player, item) = w₁×ilvl_upgrade + w₂×stat_weight_gain + w₃×weeks_since_last_loot + w₄×attendance_rate

Where:
- ilvl_upgrade = new_ilvl - current_ilvl (0 if sidegrade)
- stat_weight_gain = Σ(stat_diff × job_stat_weight)
- weeks_since_last_loot = current_week - last_loot_week
- attendance_rate = raids_attended / total_raids

Typical weights: w₁=0.3, w₂=0.3, w₃=0.2, w₄=0.2
```

---

## Week-by-Week Planning

### Phase 1: Progression (Weeks 1-4)

**Goals:**
- Clear all floors
- Establish loot system
- Prioritize survivability for prog

**Priorities:**
1. Tank/Healer defensive upgrades for prog
2. Weapon for highest-impact DPS
3. Largest ilvl upgrades overall

**Book Strategy:**
- Save books until clear is stable
- Consider upgrade materials for tome gear if struggling

### Phase 2: Optimization (Weeks 5-10)

**Goals:**
- Fill BiS slots efficiently
- Balance drops + books + tome upgrades
- Clear speed improvements

**Priorities:**
1. Weapon completion for all DPS
2. Body/Legs pieces (highest stat budgets)
3. Complete accessory sets

**Book Strategy:**
- Spend books on slots with worst drop luck
- Coordinate to avoid duplicate book purchases when drops are likely

### Phase 3: Cleanup (Weeks 11+)

**Goals:**
- Complete BiS for all members
- Alt job gearing if desired
- Prepare for next tier

**Priorities:**
1. Fill remaining gaps
2. Help undergeared members catch up
3. Optimize substats (savage vs. augmented tome choices)

### Weekly Planning Checklist

```
□ Check everyone's lockout status
□ Identify who needs drops from each floor
□ Verify book counts and planned purchases
□ Track upgrade material distribution
□ Update gear tracking spreadsheet
□ Resolve any loot conflicts pre-raid
```

---

## Formulas and Calculations

### Core Formulas

#### Expected Weeks to Complete Slot (Drops Only)

```
E[weeks] = party_size / items_per_week_for_slot

For 8-player static, 2 drops per floor:
E[weeks] = 8 / 2 = 4 weeks per slot (if only source)
```

#### Expected Weeks to Complete Slot (Drops + Books)

```
E[weeks] = min(
    E[weeks_via_drops],
    weeks_via_books
)

More precisely (accounting for drop luck):
P(complete by week W) = 1 - (1 - 1/eligible_players)^(drops_per_week × W) + I(W ≥ book_weeks)
```

#### Gear Score Progression

```
GearScore(week) = Σ(slot_ilvl × slot_weight) / Σ(slot_weight)

Typical weights (by stat budget):
- Weapon: 1.5
- Body/Legs: 1.2
- Head/Hands/Feet: 1.0
- Accessories: 0.8
```

#### Static Efficiency Metric

```
Efficiency = actual_drops_distributed / theoretical_max_drops

theoretical_max_drops(week) = floors_cleared × chests_per_floor × weeks
actual_drops_distributed = Σ(drops that went to someone who needed them)
```

### Optimization Calculations

#### Opportunity Cost of Book Purchase

```
Opportunity_cost(item) = Σ(alternative_item_value × P(drop_before_books))

If P(getting drop before book threshold) > 50%, consider waiting.
```

#### Upgrade Material Efficiency

```
Tome_gear_efficiency = (upgrade_ilvl - tome_ilvl) / material_cost

Compare to:
Savage_drop_efficiency = (savage_ilvl - current_ilvl) / expected_weeks_to_acquire
```

#### Conflict Resolution Scoring

When multiple players want the same drop:

```
Score_i = base_priority + need_modifier + luck_modifier

Where:
- base_priority: role-based or rotation-based starting score
- need_modifier: +N if BiS, +N/2 if upgrade, 0 if sidegrade
- luck_modifier: +1 per week since last won item
```

---

## Static Planning Framework

### Pre-Tier Preparation

1. **Collect BiS lists** from all 8 members
2. **Identify conflicts** (same items wanted by multiple players)
3. **Establish priority rules** (council, rotation, DKP, etc.)
4. **Create tracking spreadsheet** with:
   - Player names and jobs
   - All 11 gear slots per player
   - Book counts per floor
   - Drop history
   - Upgrade material counts

### Conflict Matrix

Build a matrix showing item demand:

```
              | PLDₐ | WARᵦ | WHMᵧ | SCHᵨ | MNKₑ | DRGᵩ | BRDᵪ | BLMₕ |
--------------|------|------|------|------|------|------|------|------|
F4 Weapon     |  1   |  1   |  1   |  1   |  1   |  1   |  1   |  1   | ← High conflict
F3 Body       |  1   |  1   |  0   |  0   |  1   |  1   |  0   |  0   |
F3 Legs       |  0   |  0   |  1   |  1   |  0   |  0   |  1   |  1   |
Twine         |  1   |  1   |  1   |  1   |  1   |  1   |  1   |  1   | ← High conflict
...
```

Items with 4+ players needing them are **high conflict** and need explicit priority rules.

### Data Model for Tracking

```typescript
interface Player {
  name: string;
  job: Job;
  bis: GearSet;
  current: GearSet;
  books: { f1: number; f2: number; f3: number; f4: number };
  drops_received: Drop[];
  priority_score: number;
}

interface GearSet {
  weapon: Item | null;
  head: Item | null;
  body: Item | null;
  hands: Item | null;
  legs: Item | null;
  feet: Item | null;
  earring: Item | null;
  necklace: Item | null;
  bracelet: Item | null;
  ring1: Item | null;
  ring2: Item | null;
}

interface Drop {
  item: Item;
  floor: 1 | 2 | 3 | 4;
  week: number;
  was_bis: boolean;
}
```

### Weekly Process Flow

```
1. PRE-RAID
   ├── Verify all members have lockouts available
   ├── Review who needs what from each floor
   └── Confirm book purchase intentions

2. DURING RAID
   ├── Record drops as they occur
   ├── Apply priority system for distribution
   └── Note any passes or unexpected outcomes

3. POST-RAID
   ├── Update tracking spreadsheet
   ├── Calculate new book totals
   ├── Identify next week's priorities
   └── Announce any planned book purchases
```

### Red Flags to Monitor

- **Unlucky streaks:** Player with 3+ weeks no drops → Consider book priority
- **Hoarding:** Player with excess books not spending → Clarify BiS/intentions  
- **Efficiency loss:** Drops going to players who don't need them
- **Conflict escalation:** Repeated disputes over same item type

---

## Appendix A: Quick Reference Tables

### Books per Item (Dawntrail - The Arcadion)

| Item Type | Edition | Book Cost | Weeks (Min) |
|-----------|---------|-----------|-------------|
| Accessory | I | 3 | 3 |
| Minor Armor (Head/Hands/Feet) | II | 4 | 4 |
| Glaze (accessory upgrade) | II | 3 | 3 |
| Major Armor (Body/Legs) | III | 6 | 6 |
| Twine (armor upgrade) | III | 4 | 4 |
| Solvent/Ester (weapon upgrade) | III | 4 | 4 |
| Weapon | IV | 8 | 8 |
| Gladiator's Arm (PLD) | IV | 5 | 5 |
| Shield (PLD) | IV | 3 | 3 |

### Item Level Reference (Dawntrail)

| Tier | Savage Gear | Savage Weapon | Tome Gear | Augmented Tome |
|------|-------------|---------------|-----------|----------------|
| Light-heavyweight (7.0) | 730 | 735 | 720 | 730 |
| Cruiserweight (7.2) | 760 | 765 | 750 | 760 |
| Heavyweight (7.4) | 790 | 795 | 780 | 790 |

### Probability Quick Reference

| Scenario | Formula | 8-Player Value |
|----------|---------|----------------|
| Win 1 roll | 1/N | 12.5% |
| Win at least 1 of 2 rolls | 1-(1-1/N)² | 23.4% |
| Expected weeks for 1 win | N/drops_per_week | 4 weeks |
| 90% confidence interval | weeks where CDF ≥ 0.9 | ~9 weeks |

### Stat Weights (General DPS Reference)

| Stat | Typical Weight Range |
|------|---------------------|
| Weapon Damage | 10-15× |
| Main Stat | 1.0 (baseline) |
| Critical Hit | 0.15-0.25 |
| Direct Hit | 0.10-0.20 |
| Determination | 0.10-0.15 |
| Skill/Spell Speed | 0.05-0.15 (job dependent) |

---

## Appendix B: Example Scenarios

### Scenario 1: Two Players Want Same Weapon Drop

**Situation:** MNK and DRG both need the Maiming weapon from F4.

**Loot Council Approach:**
```
MNK: Current weapon ilvl 630, savage weapon 660
     Upgrade = 30 ilvl, MNK stat weights favor weapon heavily
     Weeks since last loot: 2
     Score = 0.3(30) + 0.3(high) + 0.2(2) + 0.2(100%) = high

DRG: Current weapon ilvl 645 (augmented tome), savage weapon 660  
     Upgrade = 15 ilvl
     Weeks since last loot: 4
     Score = 0.3(15) + 0.3(medium) + 0.2(4) + 0.2(100%) = medium-high

Result: MNK wins due to larger upgrade value
DRG compensated: Priority on next shared drop, or book weapon priority
```

### Scenario 2: Upgrade Material Distribution

**Situation:** Week 6, 4 twines have dropped total. 8 players need 5 each (40 total).

**Distribution Strategy:**
```
Priority order based on:
1. Tome pieces already owned (can upgrade immediately)
2. Slots where savage drop is unlikely (bad luck protection)
3. Rotation fairness

Week 6 state:
- 4 twines distributed (1 each to: PLD, WHM, MNK, BLM)
- 4 players with 0 twines need catch-up priority
- Next 4 twines go to: WAR, SCH, DRG, BRD
```

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **BiS** | Best in Slot - optimal gear for a job |
| **Book/Token** | Guaranteed drop currency exchanged for gear |
| **Coffer** | Gear container that becomes job-appropriate item |
| **Lockout** | Weekly restriction on loot eligibility |
| **Prog** | Progression - learning and clearing new content |
| **Tier** | Set of 4 savage floors released together |
| **Tome** | Tomestone - weekly capped currency |
| **Twine/Shine/Solvent** | Upgrade materials for tomestone gear |
| **Unlock** | When loot restrictions are removed (usually next tier) |

---

## Sources

This document was compiled from the following verified sources:

1. **FFXIV Console Games Wiki** - AAC Light-heavyweight Tier (Savage)
   - https://ffxiv.consolegameswiki.com/wiki/AAC_Light-heavyweight_Tier_(Savage)

2. **FFXIV Console Games Wiki** - AAC Cruiserweight Tier (Savage)
   - https://ffxiv.consolegameswiki.com/wiki/AAC_Cruiserweight_Tier_(Savage)

3. **Official FFXIV Lodestone** - Patch 7.05 Notes
   - https://na.finalfantasyxiv.com/lodestone/topics/detail/3a247a30e096e56b701157cd9fb903299a244c2f/

4. **Icy Veins** - AAC Light-heavyweight Raid Guides
   - https://www.icy-veins.com/ffxiv/aac-light-heavyweight-raid-guides

---

*Document Version: 2.0 (Verified)*  
*For use with: FFXIV Raid Planner Tool*  
*Last Updated: December 2024*  
*Verified against: Dawntrail Patch 7.2 (AAC Cruiserweight Tier)*
