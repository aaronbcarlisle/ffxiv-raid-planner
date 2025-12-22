# FFXIV Savage Raid Gear Acquisition Logic

## Executive Summary

This document analyzes the gear acquisition mechanics in FFXIV's Savage raid tier system to establish the logic needed for a web-based raid planning tool. The goal is to dynamically calculate loot priority, track gear progress, and help static raid groups distribute loot efficiently.

---

## 1. Gear Sources Overview

In FFXIV's endgame, BiS (Best-in-Slot) gear comes from two primary sources:

### 1.1 Savage Raid Drops (Direct)
- **Item Level**: Highest available (currently iL760 armor, iL765 weapons in 7.2)
- **Acquisition**: Direct coffer drops from Savage raid bosses
- **Lockout**: Weekly (1 loot opportunity per floor per week)
- **Key feature**: Dyeable, cannot be augmented

### 1.2 Tomestone Gear (Purchased)
- **Item Level**: 10 levels below Savage (currently iL750 base)
- **Acquisition**: Weekly-capped tomestones (450/week)
- **Upgrade Path**: Can be augmented to match Savage gear iLevel
- **Key feature**: Requires upgrade materials from Savage to reach max iLevel

---

## 2. Savage Raid Floor Structure

Each Savage tier has 4 floors with specific loot tables:

### Floor 1 (M1S/M5S/M9S)
- **Gear Drops**: Accessories (Ring, Earring, Necklace, Bracelet)
- **Book Type**: Book I
- **Upgrade Material**: Glaze (accessory augment) - Full chest only

### Floor 2 (M2S/M6S/M10S)
- **Gear Drops**: Head, Hands, Feet
- **Book Type**: Book II  
- **Upgrade Materials**: Glaze (accessory augment)

### Floor 3 (M3S/M7S/M11S)
- **Gear Drops**: Body (Chest), Legs
- **Book Type**: Book III
- **Upgrade Materials**: Twine (armor augment), Solvent (weapon augment)

### Floor 4 (M4S/M8S/M12S)
- **Gear Drops**: Weapon
- **Book Type**: Book IV
- **Additional**: Mount, Minion, Orchestrion Roll
- **Special**: Book IV can be exchanged 1:1 for Books I-III

---

## 3. Book/Token Exchange Costs

Books earned each week can be exchanged for guaranteed gear (bad luck protection):

### Gear Costs (Current as of Patch 6.4+)
| Slot | Book Type | Cost |
|------|-----------|------|
| Weapon | Book IV | 8 |
| Body/Chest | Book III | 6 |
| Legs | Book III | 6 |
| Head | Book II | 4 |
| Hands | Book II | 4 |
| Feet | Book II | 4 |
| Accessories (each) | Book I | 3 |

### Upgrade Material Costs
| Material | Book Type | Cost |
|----------|-----------|------|
| Twine (Armor Augment) | Book III | 4 |
| Glaze (Accessory Augment) | Book II | 4 |
| Solvent (Weapon Augment) | Book III (special) | N/A |

---

## 4. Tomestone Gear Costs

Weekly-capped tomestone costs for gear:

| Slot | Tomestone Cost |
|------|----------------|
| Weapon | 500 + Universal Tomestone* |
| Body/Chest | 825 |
| Legs | 825 |
| Head | 495 |
| Hands | 495 |
| Feet | 495 |
| Accessories (each) | 375 |

*Universal Tomestone requires 7 weekly clears of Normal M4

### Total Costs
- **Full left side (6 pieces)**: 3,135 tomestones (~7 weeks)
- **Full right side (5 pieces)**: 1,875 tomestones (~4.2 weeks)
- **Weapon**: 500 + 7 weeks of Normal clears
- **Complete set**: 4,635 tomestones (~10.3 weeks)

---

## 5. Upgrade Materials (Current Naming)

### Tier 1 (7.0 Light-heavyweight)
- **Surgelight Twine**: Upgrades left-side armor (Head, Body, Hands, Legs, Feet)
- **Surgelight Glaze**: Upgrades accessories (Earring, Necklace, Bracelet, Rings)
- **Surgelight Solvent**: Upgrades weapon

### Tier 2 (7.2 Cruiserweight)
- **Evercharged Twine**: Upgrades left-side armor
- **Evercharged Glaze**: Upgrades accessories
- **Evercharged Ester**: Upgrades weapon

### Spreadsheet Naming Convention (from user's sheet)
- **Polish** = Twine (left-side armor augment)
- **Weave** = Glaze (accessory augment)
- **Weapon** = Solvent/Ester (weapon augment)

---

## 6. Calculating Gear Requirements

### Per-Player Calculations

For each player, we need to track:

```
For each gear slot:
  - BiS Source: "Raid" or "Tome"
  - Has Base Item: boolean
  - Is Augmented: boolean (only for Tome pieces)

Derived calculations:
  - Raid Pieces Needed = count(BiS Source == "Raid" AND Has Base Item == false)
  - Tome Pieces Needed = count(BiS Source == "Tome" AND Has Base Item == false)
  - Augments Needed = count(BiS Source == "Tome" AND Has Base Item == true AND Is Augmented == false)
```

### Upgrade Material Requirements

```
Polish (Twine) Needed:
  = count(slot in [Head, Body, Hands, Legs, Feet] 
          WHERE BiS Source == "Tome" 
          AND (Has Base Item == false OR Is Augmented == false))

Weave (Glaze) Needed:
  = count(slot in [Earring, Necklace, Bracelet, Ring1, Ring2] 
          WHERE BiS Source == "Tome" 
          AND (Has Base Item == false OR Is Augmented == false))

Weapon Solvent Needed:
  = 1 if (Weapon BiS Source == "Tome" 
          AND (Has Weapon == false OR Is Augmented == false))
    else 0
```

### Book/Page Requirements by Floor

```
1st Floor Books Needed:
  = sum(3 for each accessory WHERE BiS Source == "Raid" AND Has Item == false)

2nd Floor Books Needed:
  = sum(4 for each [Head, Hands, Feet] WHERE BiS Source == "Raid" AND Has Item == false)
  + sum(4 for each Tome accessory WHERE needs augment)  // For Glaze

3rd Floor Books Needed:
  = sum(6 for each [Body, Legs] WHERE BiS Source == "Raid" AND Has Item == false)
  + sum(4 for each Tome left-side WHERE needs augment)  // For Twine

4th Floor Books Needed:
  = 8 if (Weapon BiS Source == "Raid" AND Has Weapon == false)
    else 0
```

### Weeks to Complete Calculation

```
Total Tomes Needed = sum of remaining tome gear costs
Weeks for Tomes = ceil(Total Tomes Needed / 450)

Weeks for Raid Gear:
  - Best case: Win all rolls (could be 1-4 weeks)
  - Worst case: Book exchange only (8 weeks for weapon, 6 for chest/legs, etc.)
  - Expected: Combination of drops and book accumulation
```

---

## 7. Loot Priority Algorithm

### Priority Factors (HimbeertoniRaidTool-inspired)

The tool calculates loot priority based on:

1. **Item Level Gain**: How much iLevel does the player gain?
   - `priority += (new_item_ilvl - current_item_ilvl) * weight`

2. **BiS Status**: Is this item BiS for the player?
   - BiS items get higher priority than "good enough" items

3. **Slot Importance**: Some slots provide more stats
   - Weapon > Body > Legs > Head/Hands/Feet > Accessories

4. **Current Gear State**: Do they have alternatives?
   - Player with crafted gear gets priority over player with tome gear

5. **Weeks to Acquire Otherwise**: How long via books?
   - 8-week book items get priority over 3-week items

6. **Augment Readiness**: For upgrade materials
   - Player who HAS the tome piece should get augment before player who doesn't

### Priority Formula (Simplified)

```javascript
function calculatePriority(player, item) {
  let priority = 0;
  
  // Base priority: Is this BiS?
  if (player.getBiSSource(item.slot) === item.source) {
    priority += 100;
  }
  
  // Item level gain
  const ilvlGain = item.ilvl - player.getCurrentIlvl(item.slot);
  priority += ilvlGain * 2;
  
  // Slot weight (weapon most valuable)
  const slotWeights = {
    weapon: 3.0,
    body: 1.5,
    legs: 1.5,
    head: 1.0,
    hands: 1.0,
    feet: 1.0,
    accessory: 0.8
  };
  priority *= slotWeights[item.slotType];
  
  // Weeks to acquire via books (longer = higher priority for direct drop)
  const bookWeeks = getBookWeeksRequired(item.slot);
  priority += bookWeeks * 5;
  
  // Diminishing returns if player already got loot this week
  priority -= player.lootReceivedThisWeek * 20;
  
  return priority;
}
```

### Augment Priority (Upgrade Materials)

```javascript
function calculateAugmentPriority(player, upgradeType) {
  // upgradeType: "twine" | "glaze" | "solvent"
  
  // Only players with the base tome piece can use augments
  const eligibleSlots = getEligibleSlots(player, upgradeType);
  
  if (eligibleSlots.length === 0) return 0;
  
  let priority = 0;
  
  // Priority based on how many pieces they can augment
  priority += eligibleSlots.length * 10;
  
  // Higher priority if this completes their BiS set
  const remainingBiS = player.getRemainingBiSCount();
  if (remainingBiS <= 2) {
    priority += 50; // Close to completion bonus
  }
  
  // Consider total augments still needed vs. available
  const totalAugmentsNeeded = player.getTotalAugmentsNeeded(upgradeType);
  priority += totalAugmentsNeeded * 5;
  
  return priority;
}
```

---

## 8. Weekly Loot Distribution Workflow

### Pre-Raid Setup
1. Each player sets their BiS (link to Etro.gg or manual entry)
2. System calculates what each player needs from each floor
3. System suggests loot priority order

### During Raid
1. Clear floor → Loot drops
2. System shows who needs each item and priority scores
3. Raid lead distributes based on priority (or players roll)
4. Track who received what

### Post-Raid
1. Update "Have" checkboxes for received items
2. System recalculates remaining needs
3. Update tomestone progress
4. Calculate weeks remaining to BiS

---

## 9. Data Model for Implementation

```typescript
interface Player {
  id: string;
  name: string;
  job: Job;
  etroLink?: string;
  gear: GearSet;
  lootHistory: LootEntry[];
}

interface GearSet {
  weapon: GearSlot;
  head: GearSlot;
  body: GearSlot;
  hands: GearSlot;
  legs: GearSlot;
  feet: GearSlot;
  earring: GearSlot;
  necklace: GearSlot;
  bracelet: GearSlot;
  ring1: GearSlot;
  ring2: GearSlot;
}

interface GearSlot {
  bisSource: 'raid' | 'tome';
  hasItem: boolean;
  isAugmented: boolean;  // Only relevant if bisSource === 'tome'
  currentIlvl?: number;
}

interface LootEntry {
  week: number;
  floor: number;
  itemType: string;
  timestamp: Date;
}

interface UpgradeMaterials {
  polish: { needed: number; obtained: number };  // Twine
  weave: { needed: number; obtained: number };   // Glaze
  weapon: { needed: number; obtained: number };  // Solvent
}

interface BookProgress {
  floor1: { needed: number; obtained: number };
  floor2: { needed: number; obtained: number };
  floor3: { needed: number; obtained: number };
  floor4: { needed: number; obtained: number };
}

interface TomestoneProgress {
  total: number;
  currentWeek: number;
  weeklyEarned: number;
  weeksRemaining: number;
}
```

---

## 10. Key Calculations Summary

### Items per Floor (What Drops)
| Floor | Gear Slots | Upgrade Materials |
|-------|------------|-------------------|
| 1 | Accessories | Glaze (full clear) |
| 2 | Head, Hands, Feet | Glaze |
| 3 | Body, Legs | Twine, Solvent |
| 4 | Weapon | - |

### Book Exchange Summary
| Floor | Book | Can Buy |
|-------|------|---------|
| 1 | I | Accessories (3 each) |
| 2 | II | Head/Hands/Feet (4 each), Glaze (4) |
| 3 | III | Body/Legs (6 each), Twine (4) |
| 4 | IV | Weapon (8), OR convert to I/II/III |

### Weeks to BiS (Worst Case via Books Only)
- Weapon: 8 weeks
- Body: 6 weeks
- Legs: 6 weeks
- Head/Hands/Feet: 4 weeks each
- Accessories: 3 weeks each

---

## 11. Recommendations for Implementation

### MVP Features
1. Player roster with job selection
2. BiS source selection per slot (Raid/Tome)
3. Have/Augmented tracking per slot
4. Automatic calculation of:
   - Raid pieces needed
   - Tome pieces needed
   - Upgrade materials needed
   - Books needed per floor
   - Tomestones needed and weeks remaining

### Phase 2 Features
1. Etro.gg integration (auto-populate BiS)
2. Loot priority calculation
3. Weekly loot tracking
4. Loot history

### Phase 3 Features
1. Real-time collaboration
2. Character lookup via XIVAPI
3. Discord notifications
4. Export/Import functionality
