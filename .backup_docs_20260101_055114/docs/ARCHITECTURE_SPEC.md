# FFXIV Raid Planner - Architecture & Integration Specification

## Executive Summary

This document outlines the architecture for a free, web-based FFXIV raid planning tool that solves the core problem: **players forget to update their gear tracking sheets**. By integrating with existing FFXIV community APIs, we can automatically sync character gear and suggest BiS sets, eliminating manual data entry.

---

## 1. Core Features

### 1.1 Automatic Gear Sync (The Killer Feature)
- Link FFXIV character via Lodestone ID
- Auto-fetch current equipped gear from XIVAPI/Lodestone
- Compare against BiS to show progress
- Optional: Poll for updates on schedule (e.g., after raid nights)

### 1.2 BiS Auto-Population
- Select job → fetch community BiS from The Balance/XIVGear
- Parse Etro.gg or XIVGear.app links
- Determine which slots are Raid vs Tome automatically
- Allow manual override

### 1.3 Priority-Based Loot Suggestions
- Default priority: Melee DPS > Ranged DPS > Tanks > Healers
- Custom priority ordering per static
- Real-time loot suggestions when items drop
- Track loot history for fairness

### 1.4 Week-over-Week Progress
- Track gear acquisitions per week
- Visualize progress toward BiS
- Book/page accumulation tracking
- Tomestone spending tracking

### 1.5 Raid Analysis Integration
- Link to FFLogs reports
- Link to XIVAnalysis for fight breakdowns
- Link to XIVODReview for VOD analysis
- Show parse percentiles per player

---

## 2. API Integrations

### 2.1 XIVAPI / Lodestone (Character Data)
**Purpose**: Fetch current equipped gear for automatic sync

**Endpoint**: `https://xivapi.com/character/{lodestoneId}?data=CG`
- Returns: Current gear, job, level, stats
- Rate limit: Moderate (use caching)
- Auth: API key (free tier available)

**Data Available**:
```json
{
  "Character": {
    "ID": 26213642,
    "Name": "Lloyd Crescent",
    "Server": "Excalibur",
    "ActiveClassJob": { "Name": "Dragoon", "Level": 100 },
    "GearSet": {
      "Gear": {
        "MainHand": { "ID": 12345, "Name": "Babyface Champion's Spear" },
        "Head": { "ID": 12346, "Name": "Augmented Historia Helm of Maiming" },
        // ... all slots
      }
    }
  }
}
```

**Implementation**:
```typescript
async function fetchCharacterGear(lodestoneId: string) {
  const response = await fetch(
    `https://xivapi.com/character/${lodestoneId}?data=CG`
  );
  const data = await response.json();
  return parseGearToSlots(data.Character.GearSet.Gear);
}
```

### 2.2 Etro.gg API (BiS Sets)
**Purpose**: Import BiS gear sets from Etro links

**Endpoint**: `https://etro.gg/api/gearsets/{id}/`
- Returns: Full gear set with items, materia, stats
- Auth: Optional API key
- CORS: May require backend proxy

**Data Available**:
```json
{
  "id": "abc123",
  "name": "7.2 DRG BiS",
  "job": "DRG",
  "weapon": 12345,
  "head": 12346,
  "body": 12347,
  // ... item IDs for each slot
}
```

### 2.3 XIVGear.app API (BiS Sets)
**Purpose**: Import BiS sets, supports multiple sets per sheet

**Endpoint**: `https://api.xivgear.app/shortlink/{uuid}`
- Returns: Full gear set with computed stats
- Auth: None required
- CORS: Supported

**Data Available**:
```json
{
  "name": "DRG 2.50 BiS",
  "job": "DRG",
  "items": {
    "Weapon": { "id": 12345, "name": "...", "source": "savage" },
    "Head": { "id": 12346, "name": "...", "source": "tome" },
    // ...
  }
}
```

**Key Feature**: XIVGear items include `source` metadata, telling us if it's Savage or Tome gear!

### 2.4 FFLogs API v2 (Raid Performance)
**Purpose**: Show parse percentiles, link to reports, track clears

**Endpoint**: `https://www.fflogs.com/api/v2/client` (GraphQL)
- Auth: OAuth 2.0 client credentials
- Returns: Character rankings, reports, fight data

**GraphQL Query Example**:
```graphql
query {
  characterData {
    character(id: 18370865) {
      name
      server { name }
      zoneRankings(zoneID: 62)  # AAC Cruiserweight Savage
    }
  }
}
```

**Data Available**:
- Parse percentiles per fight
- Gear worn during each fight
- Clear dates (useful for book tracking!)
- Links to full reports

### 2.5 The Balance / Static BiS Sets
**Purpose**: Provide default BiS for each job

**Source**: `https://github.com/xiv-gear-planner/static-bis-sets`
- Pre-curated BiS sets per job per tier
- JSON format, can be bundled with app
- Updated by community experts

**Implementation**: 
- Bundle current tier BiS as JSON in app
- Fetch from GitHub for updates
- Allow user to pick from multiple options (e.g., SpS vs Crit builds)

---

## 3. Priority System

### 3.1 Default Priority Order
```
1. Melee DPS (highest priority)
   - Theo (VPR)
   - Lloyd (DRG)
2. Ranged DPS
   - Ferus (BLM)
   - Vel (MCH)
3. Tanks
   - Alexander (PLD)
   - Grimm (WAR)
4. Healers (lowest priority)
   - Binckle (WHM)
   - Demonic (SGE)
```

### 3.2 Priority Calculation Algorithm

```typescript
interface PriorityFactors {
  rolePriority: number;      // 1-4 based on role (configurable)
  slotValue: number;         // Weapon > Body > Legs > etc.
  weeksToAcquire: number;    // 8 for weapon, 6 for body, etc.
  isBiS: boolean;            // Is this actually their BiS?
  gearGap: number;           // How far behind are they?
  recentLoot: number;        // Diminishing returns if got loot recently
}

function calculatePriority(player: Player, item: Item): number {
  const factors = getFactors(player, item);
  
  let priority = 0;
  
  // Role priority (configurable per static)
  priority += (5 - factors.rolePriority) * 100;
  
  // BiS bonus
  if (factors.isBiS) priority += 50;
  
  // Slot value (weapon most valuable)
  priority += factors.slotValue * 20;
  
  // Time to acquire via books (longer = higher priority for drop)
  priority += factors.weeksToAcquire * 5;
  
  // Gear gap bonus (further behind = higher priority)
  priority += factors.gearGap * 10;
  
  // Diminishing returns for recent loot
  priority -= factors.recentLoot * 25;
  
  return priority;
}
```

### 3.3 Upgrade Material Priority

```typescript
function calculateUpgradePriority(player: Player, material: 'twine' | 'glaze' | 'solvent'): number {
  // Player must HAVE the tome piece to use the upgrade
  const eligibleSlots = getUnaugmentedTomeSlots(player, material);
  
  if (eligibleSlots.length === 0) return 0;
  
  let priority = player.rolePriority * 100;
  
  // More pieces to augment = higher priority
  priority += eligibleSlots.length * 20;
  
  // Close to BiS completion bonus
  const remaining = player.getRemainingBiSCount();
  if (remaining <= 3) priority += 50;
  
  return priority;
}
```

---

## 4. Data Model

### 4.1 Core Entities

```typescript
interface Static {
  id: string;
  name: string;
  tier: string;           // "AAC Cruiserweight (Savage)"
  createdAt: Date;
  shareCode: string;      // For zero-friction sharing
  settings: StaticSettings;
  players: Player[];
  lootHistory: LootEntry[];
  weeklyProgress: WeeklySnapshot[];
}

interface StaticSettings {
  priorityOrder: Role[];  // Custom role priority
  autoSync: boolean;      // Auto-fetch gear from Lodestone
  syncFrequency: 'manual' | 'daily' | 'weekly';
}

interface Player {
  id: string;
  name: string;
  lodestoneId?: string;   // For auto-sync
  job: Job;
  role: Role;
  bisLink?: string;       // Etro or XIVGear link
  gear: GearSet;
  bisGear: GearSet;       // Parsed from bisLink
  fflogs?: {
    characterId: number;
    currentParses: ParseData[];
  };
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
  itemId?: number;        // XIVAPI item ID
  itemName?: string;
  itemLevel?: number;
  source: 'raid' | 'tome' | 'crafted' | 'normal' | 'unknown';
  hasItem: boolean;
  isAugmented: boolean;   // Only for tome gear
}

interface LootEntry {
  id: string;
  weekNumber: number;
  floor: number;          // 1-4
  itemType: string;       // 'weapon', 'head', 'twine', etc.
  playerId: string;
  timestamp: Date;
  method: 'drop' | 'book';
}

interface WeeklySnapshot {
  weekNumber: number;
  date: Date;
  players: {
    playerId: string;
    gearState: GearSet;
    booksAccumulated: { [floor: number]: number };
    tomesEarned: number;
  }[];
}
```

### 4.2 Job & Role Definitions

```typescript
type Role = 'tank' | 'healer' | 'melee' | 'ranged' | 'caster';

type Job = 
  // Tanks
  | 'PLD' | 'WAR' | 'DRK' | 'GNB'
  // Healers
  | 'WHM' | 'SCH' | 'AST' | 'SGE'
  // Melee DPS
  | 'MNK' | 'DRG' | 'NIN' | 'SAM' | 'RPR' | 'VPR'
  // Ranged DPS
  | 'BRD' | 'MCH' | 'DNC'
  // Casters
  | 'BLM' | 'SMN' | 'RDM' | 'PCT';

const JOB_TO_ROLE: Record<Job, Role> = {
  PLD: 'tank', WAR: 'tank', DRK: 'tank', GNB: 'tank',
  WHM: 'healer', SCH: 'healer', AST: 'healer', SGE: 'healer',
  MNK: 'melee', DRG: 'melee', NIN: 'melee', SAM: 'melee', RPR: 'melee', VPR: 'melee',
  BRD: 'ranged', MCH: 'ranged', DNC: 'ranged',
  BLM: 'caster', SMN: 'caster', RDM: 'caster', PCT: 'caster',
};
```

---

## 5. User Flows

### 5.1 Initial Setup Flow
```
1. Create new static → Enter name, select tier
2. Add players → For each:
   a. Enter name
   b. Select job from dropdown
   c. (Optional) Enter Lodestone ID for auto-sync
   d. (Optional) Paste BiS link (Etro/XIVGear)
3. System auto-populates:
   - Role based on job
   - BiS gear from link (determines Raid vs Tome slots)
   - Current gear from Lodestone (if ID provided)
4. Review and confirm
5. Get shareable link for team
```

### 5.2 Weekly Raid Flow
```
1. Pre-raid: View team status
   - Who needs what from each floor
   - Priority suggestions pre-calculated
   
2. During raid: Track drops
   - Select floor (M1S, M2S, etc.)
   - "Item dropped!" → Select item type
   - System shows priority ranking
   - Assign to player → Updates their status
   
3. Post-raid: Sync & Review
   - Click "Sync All" → Fetches latest gear from Lodestone
   - System compares to last week
   - Shows: "Lloyd got Chest! Demonic got Glaze!"
   - Week snapshot saved automatically
```

### 5.3 Analysis Integration Flow
```
1. After raid: View FFLogs integration
   - Latest report linked automatically (if configured)
   - Parse percentiles shown per player
   - Click player → Opens FFLogs/XIVAnalysis
   
2. Deep dive options:
   - "View in XIVAnalysis" → Opens analysis page
   - "Watch VOD" → Links to XIVODReview (if configured)
   - "View FFLogs Report" → Opens full report
```

---

## 6. Technical Architecture

### 6.1 Frontend
- **Framework**: React + TypeScript
- **State**: Zustand or React Context
- **Styling**: Tailwind CSS
- **Hosting**: Vercel (free tier)

### 6.2 Backend
- **Framework**: FastAPI (Python) or Express (Node.js)
- **Database**: SQLite (simple) or Supabase (free hosted)
- **Auth**: Optional (share via link, no login required for MVP)
- **Hosting**: Railway or Render (free tier)

### 6.3 API Proxy Requirements
Some APIs require server-side calls due to:
- CORS restrictions (Etro)
- API keys (FFLogs OAuth)
- Rate limiting (XIVAPI)

Backend handles:
```
/api/character/:lodestoneId  → Proxies XIVAPI
/api/bis/etro/:gearsetId     → Proxies Etro API
/api/bis/xivgear/:uuid       → Proxies XIVGear API
/api/fflogs/character/:id    → Proxies FFLogs GraphQL
```

### 6.4 Caching Strategy
```typescript
// Character data: Cache 1 hour (gear doesn't change mid-raid)
// BiS sets: Cache 24 hours (changes rarely)
// FFLogs parses: Cache 1 hour
// Static BiS list: Cache 7 days (bundled with app)
```

---

## 7. MVP Scope

### Phase 1: Core Tracking (Week 1-2)
- [ ] Static creation with shareable link
- [ ] Player cards with job selection
- [ ] Manual BiS source selection (Raid/Tome)
- [ ] Have/Augmented checkboxes
- [ ] Auto-calculated needs (pages, tomes, upgrades)
- [ ] Priority display per floor

### Phase 2: BiS Integration (Week 3-4)
- [ ] Etro.gg import
- [ ] XIVGear.app import
- [ ] Auto-detect Raid vs Tome from BiS link
- [ ] Bundled Balance BiS sets per job

### Phase 3: Auto-Sync (Week 5-6)
- [ ] Lodestone character linking
- [ ] Auto-fetch current gear from XIVAPI
- [ ] Compare current vs BiS
- [ ] Manual refresh button

### Phase 4: Week Tracking & History (Week 7-8)
- [ ] Weekly snapshots
- [ ] Progress visualization
- [ ] Loot history log
- [ ] Book accumulation tracking

### Phase 5: FFLogs Integration (Future)
- [ ] Link FFLogs character
- [ ] Show parse percentiles
- [ ] Link to reports
- [ ] Auto-detect clears for book tracking

---

## 8. External Links (Reference)

### APIs
- XIVAPI: https://xivapi.com/docs
- Etro API: https://etro.gg/api/docs/
- XIVGear API: https://xivgear.app/docs/
- FFLogs API: https://www.fflogs.com/api/docs

### Analysis Tools
- FFLogs: https://www.fflogs.com/
- XIVAnalysis: https://xivanalysis.com/
- XIVODReview: https://xivodreview.com/

### BiS Resources
- The Balance: https://www.thebalanceffxiv.com/
- Static BiS Sets: https://github.com/xiv-gear-planner/static-bis-sets

### Character Lookup
- Lodestone: https://na.finalfantasyxiv.com/lodestone/
- Tomestone.gg: https://tomestone.gg/

---

## 9. Success Metrics

1. **Time saved**: Reduce weekly tracking time from 15+ min to <2 min
2. **Accuracy**: Auto-sync eliminates "forgot to update" errors
3. **Adoption**: Shareable links enable zero-friction team onboarding
4. **Engagement**: Week-over-week progress visualization keeps players motivated
