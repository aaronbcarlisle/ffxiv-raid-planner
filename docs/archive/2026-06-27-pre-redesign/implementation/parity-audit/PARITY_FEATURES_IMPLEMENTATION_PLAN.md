# FFXIV Raid Planner - Parity Features Implementation Plan

**Created:** 2026-01-11  
**Based on:** January 2026 Parity Audit + UX Mockups  
**Target:** Close remaining ~15% feature gap with reference spreadsheets

---

## Executive Summary

This plan addresses the 6 major UX features identified in the parity audit. The codebase already has foundational infrastructure in place (types, backend fields, calculation utilities), so implementation focuses on UI integration and algorithm updates.

**Estimated Total Effort:** 3-4 days of focused development  
**Risk Level:** Low-Medium (infrastructure exists; mostly UI work)

---

## Feature 1: Enhanced Player Card with Gear Categories & Markers

### Current State
- ✅ `GearSourceCategory` type exists (9 categories)
- ✅ `GEAR_SOURCE_NAMES` and `GEAR_SOURCE_COLORS` defined
- ✅ `currentSource` field exists on `GearSlotStatus`
- ✅ iLv calculation functions exist (`calculateAverageItemLevel`)
- ❌ GearTable hides currentSource column (`hidden` class)
- ❌ No marker system for planning intent

### Implementation Tasks

#### 1.1 Enable Current Gear Source Column (1-2 hours)
**File:** `frontend/src/components/player/GearTable.tsx`

```tsx
// Line ~488-492: Change from hidden to visible
<th className="text-center py-1 font-medium hidden md:table-cell">Current</th>
// ...
<td className="py-1 hidden md:table-cell text-center">
```

Add a dropdown/popover for selecting currentSource:

```tsx
// New component: CurrentSourceSelector.tsx
import { Popover } from '../primitives';
import { GEAR_SOURCE_NAMES, GEAR_SOURCE_COLORS, type GearSourceCategory } from '../../types';

const GEAR_CATEGORIES: GearSourceCategory[] = [
  'savage', 'tome_up', 'catchup', 'tome', 'relic', 'crafted', 'prep', 'normal', 'unknown'
];

export function CurrentSourceSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: GearSourceCategory;
  onChange: (source: GearSourceCategory) => void;
  disabled?: boolean;
}) {
  return (
    <Popover
      trigger={
        <button
          className={`text-xs px-2 py-0.5 rounded ${GEAR_SOURCE_COLORS[value]} bg-surface-interactive`}
          disabled={disabled}
        >
          {GEAR_SOURCE_NAMES[value]}
        </button>
      }
    >
      <div className="flex flex-col gap-1 p-2">
        {GEAR_CATEGORIES.filter(c => c !== 'unknown').map((cat) => (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            className={`text-xs px-2 py-1 rounded text-left ${GEAR_SOURCE_COLORS[cat]} hover:bg-surface-hover`}
          >
            {GEAR_SOURCE_NAMES[cat]}
          </button>
        ))}
      </div>
    </Popover>
  );
}
```

#### 1.2 Display Average iLv in Player Card Header (1 hour)
**File:** `frontend/src/components/player/PlayerCardHeader.tsx`

```tsx
import { calculateAverageItemLevel } from '../../utils/calculations';
import { useTierStore } from '../../stores/tierStore';

// Inside component:
const { activeTier } = useTierStore();
const avgILv = calculateAverageItemLevel(player.gear, activeTier?.tierId || '');

// In JSX, after completion fraction:
<span className="text-accent text-sm font-medium ml-2">
  iLv {avgILv}
</span>
```

#### 1.3 Add Planning Markers System (3-4 hours)

**Step 1: Add types**
**File:** `frontend/src/types/index.ts`

```typescript
// Planning markers for gear slots (matches spreadsheet)
export type PlanningMarker = 
  | 'craft'        // 🔨 Plan to craft
  | 'pages'        // 📃 Buying with pages
  | 'floor4pages'  // ♻️ Using F4 pages
  | 'alliance'     // 💰 From alliance raid
  | 'next'         // ◀️ Improve next
  | 'have_token';  // 💾 Already have token

export const PLANNING_MARKERS: Record<PlanningMarker, { icon: string; label: string }> = {
  craft: { icon: '🔨', label: 'Plan to craft' },
  pages: { icon: '📃', label: 'Buying with pages' },
  floor4pages: { icon: '♻️', label: 'Using F4 pages' },
  alliance: { icon: '💰', label: 'From alliance raid' },
  next: { icon: '◀️', label: 'Improve next' },
  have_token: { icon: '💾', label: 'Already have token' },
};

// Update GearSlotStatus
export interface GearSlotStatus {
  // ... existing fields
  markers?: PlanningMarker[];  // NEW
}
```

**Step 2: Add backend field**
**File:** `backend/alembic/versions/xxx_add_gear_markers.py`

```python
def upgrade():
    # markers stored in gear JSON array - no schema change needed
    # Just document that gear[].markers is an optional string array
    pass
```

**Step 3: Create MarkerPicker component**
**File:** `frontend/src/components/player/MarkerPicker.tsx`

```tsx
import { useState } from 'react';
import { Popover } from '../primitives';
import { PLANNING_MARKERS, type PlanningMarker } from '../../types';

interface MarkerPickerProps {
  markers: PlanningMarker[];
  onChange: (markers: PlanningMarker[]) => void;
  disabled?: boolean;
}

export function MarkerPicker({ markers, onChange, disabled }: MarkerPickerProps) {
  const toggleMarker = (marker: PlanningMarker) => {
    if (markers.includes(marker)) {
      onChange(markers.filter(m => m !== marker));
    } else {
      onChange([...markers, marker]);
    }
  };

  return (
    <Popover
      trigger={
        <button
          className="text-sm hover:bg-surface-hover rounded p-1"
          disabled={disabled}
        >
          {markers.length > 0 
            ? markers.map(m => PLANNING_MARKERS[m].icon).join('') 
            : <span className="text-text-muted">+</span>}
        </button>
      }
    >
      <div className="p-2 w-48">
        <div className="text-xs text-text-muted mb-2">Planning Markers</div>
        {Object.entries(PLANNING_MARKERS).map(([key, { icon, label }]) => (
          <button
            key={key}
            onClick={() => toggleMarker(key as PlanningMarker)}
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm ${
              markers.includes(key as PlanningMarker)
                ? 'bg-accent/20 text-accent'
                : 'hover:bg-surface-hover text-text-primary'
            }`}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </Popover>
  );
}
```

**Step 4: Add column to GearTable**
Integrate MarkerPicker as 6th column in expanded view.

---

## Feature 2: Loot & Page Adjustments Panel

### Current State
- ✅ `lootAdjustment` field exists on `SnapshotPlayer` (frontend + backend)
- ✅ `pageAdjustments` field exists (JSON: `{I, II, III, IV}`)
- ✅ `calculatePriorityScore` already has `includeLootAdjustment` option
- ❌ No UI to edit these fields
- ❌ Priority calculations don't consistently use adjustments

### Implementation Tasks

#### 2.1 Create AdjustmentsPanel Component (3-4 hours)
**File:** `frontend/src/components/player/AdjustmentsPanel.tsx`

```tsx
import { useState } from 'react';
import { Modal, Input, Label } from '../ui';
import { Button } from '../primitives';
import type { SnapshotPlayer, PageAdjustments } from '../../types';

interface AdjustmentsPanelProps {
  players: SnapshotPlayer[];
  onUpdatePlayer: (playerId: string, updates: Partial<SnapshotPlayer>) => void;
  disabled?: boolean;
}

export function AdjustmentsPanel({ players, onUpdatePlayer, disabled }: AdjustmentsPanelProps) {
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  const hasAdjustments = (player: SnapshotPlayer) =>
    (player.lootAdjustment ?? 0) !== 0 ||
    Object.values(player.pageAdjustments ?? { I: 0, II: 0, III: 0, IV: 0 }).some(v => v !== 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Player Adjustments</h3>
          <p className="text-sm text-text-muted">
            Adjust loot counts and pages for mid-tier joins
          </p>
        </div>
        {players.some(hasAdjustments) && (
          <span className="px-3 py-1 bg-status-warning/20 text-status-warning rounded-full text-sm">
            {players.filter(hasAdjustments).length} adjusted
          </span>
        )}
      </div>

      {players.map((player) => (
        <PlayerAdjustmentRow
          key={player.id}
          player={player}
          isExpanded={expandedPlayer === player.id}
          onToggle={() => setExpandedPlayer(expandedPlayer === player.id ? null : player.id)}
          onUpdate={(updates) => onUpdatePlayer(player.id, updates)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function PlayerAdjustmentRow({
  player,
  isExpanded,
  onToggle,
  onUpdate,
  disabled,
}: {
  player: SnapshotPlayer;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<SnapshotPlayer>) => void;
  disabled?: boolean;
}) {
  const hasAdjustments = 
    (player.lootAdjustment ?? 0) !== 0 ||
    Object.values(player.pageAdjustments ?? { I: 0, II: 0, III: 0, IV: 0 }).some(v => v !== 0);

  return (
    <div className={`bg-surface-default rounded-lg border ${hasAdjustments ? 'border-status-warning/40' : 'border-border-default'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">⚔️</span>
          <div>
            <div className="text-text-primary font-medium">{player.name}</div>
            <div className="text-xs text-text-muted">{player.job}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasAdjustments && (
            <span className="text-xs px-2 py-1 bg-status-warning/20 text-status-warning rounded">
              Adjusted
            </span>
          )}
          <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border-default">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label>Loot Count Adjustment</Label>
              <Input
                type="number"
                value={player.lootAdjustment ?? 0}
                onChange={(e) => onUpdate({ lootAdjustment: parseInt(e.target.value) || 0 })}
                disabled={disabled}
              />
              <p className="text-xs text-text-muted mt-1">
                Positive = received extra, negative = missed loot
              </p>
            </div>
          </div>

          <div>
            <Label>Page Adjustments</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {(['I', 'II', 'III', 'IV'] as const).map((floor) => (
                <div key={floor}>
                  <div className="text-xs text-text-muted text-center mb-1">Floor {floor}</div>
                  <Input
                    type="number"
                    value={player.pageAdjustments?.[floor] ?? 0}
                    onChange={(e) => onUpdate({
                      pageAdjustments: {
                        ...player.pageAdjustments,
                        [floor]: parseInt(e.target.value) || 0,
                      },
                    })}
                    disabled={disabled}
                    className="text-center"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 2.2 Add Adjustments Tab to GroupSettingsModal (1 hour)
**File:** `frontend/src/components/static-group/GroupSettingsModal.tsx`

Add `'adjustments'` to the `SettingsTab` type and create a new tab panel using the `AdjustmentsPanel` component.

#### 2.3 Update Priority Calculations (1 hour)
**File:** `frontend/src/utils/priority.ts`

Update all priority functions to consistently use `includeLootAdjustment: true`:

```typescript
// In getPriorityForItem, getPriorityForRing, etc:
score: calculatePriorityScore(player, settings, { includeLootAdjustment: true }),
```

#### 2.4 Update Page Balance Display (1 hour)
**File:** `frontend/src/components/history/PageBalancesPanel.tsx`

Include page adjustments in balance calculation:

```typescript
const effectiveBalance = {
  bookI: balance.bookI + (player.pageAdjustments?.I ?? 0),
  bookII: balance.bookII + (player.pageAdjustments?.II ?? 0),
  // ... etc
};
```

---

## Feature 3: Priority Mode & Loot Weight Settings

### Current State
- ✅ `settings.lootPriority` exists for role order
- ❌ No priority mode toggle (role vs loot count)
- ❌ No loot weight configuration

### Implementation Tasks

#### 3.1 Add Settings Types (30 min)
**File:** `frontend/src/types/index.ts`

```typescript
export type PriorityMode = 'role' | 'lootCount';

export interface LootWeightConfig {
  gear: boolean;
  weapons: boolean;
  mounts: boolean;
  music: boolean;
  coffers: boolean;
}

// Update StaticSettings
export interface StaticSettings {
  // ... existing
  priorityMode: PriorityMode;           // NEW
  lootWeights: LootWeightConfig;        // NEW
}
```

#### 3.2 Update Backend Schema (1 hour)
**File:** `backend/app/schemas/static_group.py`

```python
class StaticSettings(BaseModel):
    # ... existing
    priority_mode: str = "role"  # "role" | "lootCount"
    loot_weights: dict = {
        "gear": True,
        "weapons": True,
        "mounts": False,
        "music": False,
        "coffers": True,
    }
```

#### 3.3 Create PrioritySettingsPanel Component (2-3 hours)
**File:** `frontend/src/components/static-group/PrioritySettingsPanel.tsx`

```tsx
import { RadioGroup, Checkbox, Label } from '../ui';
import type { PriorityMode, LootWeightConfig } from '../../types';

interface PrioritySettingsPanelProps {
  priorityMode: PriorityMode;
  lootWeights: LootWeightConfig;
  lootPriority: string[];
  onModeChange: (mode: PriorityMode) => void;
  onWeightsChange: (weights: LootWeightConfig) => void;
  onPriorityChange: (priority: string[]) => void;
  disabled?: boolean;
}

export function PrioritySettingsPanel({
  priorityMode,
  lootWeights,
  lootPriority,
  onModeChange,
  onWeightsChange,
  onPriorityChange,
  disabled,
}: PrioritySettingsPanelProps) {
  return (
    <div className="space-y-6">
      {/* Priority Mode Toggle */}
      <div>
        <Label>Priority Mode</Label>
        <div className="grid grid-cols-2 gap-2 mt-2 p-1 bg-surface-default rounded-lg">
          <button
            onClick={() => onModeChange('role')}
            className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              priorityMode === 'role'
                ? 'bg-accent text-surface-base'
                : 'text-text-muted hover:text-text-primary'
            }`}
            disabled={disabled}
          >
            Role-Based
          </button>
          <button
            onClick={() => onModeChange('lootCount')}
            className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              priorityMode === 'lootCount'
                ? 'bg-accent text-surface-base'
                : 'text-text-muted hover:text-text-primary'
            }`}
            disabled={disabled}
          >
            Loot Count First
          </button>
        </div>
        <p className="text-xs text-text-muted mt-2">
          {priorityMode === 'role'
            ? 'Priority based on role order + slot weights + fairness modifiers'
            : 'Lowest loot count always wins, with pages as tie-breaker'}
        </p>
      </div>

      {/* Role Order (only visible in role mode) */}
      {priorityMode === 'role' && (
        <RolePriorityList
          priority={lootPriority}
          onChange={onPriorityChange}
          disabled={disabled}
        />
      )}

      {/* Loot Weights */}
      <div>
        <Label>Include in Loot Count</Label>
        <div className="space-y-2 mt-2">
          {Object.entries(lootWeights).map(([key, enabled]) => (
            <label
              key={key}
              className="flex items-center justify-between p-3 bg-surface-default rounded-lg cursor-pointer"
            >
              <span className="text-text-primary capitalize">{key}</span>
              <Checkbox
                checked={enabled}
                onChange={(checked) => onWeightsChange({ ...lootWeights, [key]: checked })}
                disabled={disabled}
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-2">
          Disabled items won't count toward a player's total loot received.
        </p>
      </div>
    </div>
  );
}
```

#### 3.4 Implement Loot Count First Algorithm (2 hours)
**File:** `frontend/src/utils/priority.ts`

```typescript
/**
 * Calculate priority score in "loot count first" mode.
 * Lowest loot count wins, with pages needed as tie-breaker.
 */
export function calculateLootCountPriority(
  player: SnapshotPlayer,
  lootStats: { totalDrops: number },
  pageBalance: { total: number },
): number {
  // Invert loot count: fewer drops = higher priority
  // Max theoretical drops in a tier is ~80, so 100 - drops gives priority
  const lootPriority = 100 - lootStats.totalDrops;
  
  // Pages needed as secondary factor (more pages needed = slightly higher)
  const pagesNeeded = Math.max(0, -pageBalance.total); // negative balance = need
  const pageBoost = Math.min(pagesNeeded, 20); // cap at 20
  
  // Apply loot adjustment
  const adjustment = (player.lootAdjustment ?? 0) * -1; // invert: positive adj = lower priority
  
  return lootPriority * 100 + pageBoost + adjustment;
}

/**
 * Get priority for item using settings-based mode selection.
 */
export function getPriorityForItemWithMode(
  players: SnapshotPlayer[],
  slot: GearSlot,
  settings: StaticSettings,
  lootStats: Map<string, { totalDrops: number }>,
  pageBalances: Map<string, { total: number }>,
): PriorityEntry[] {
  const eligiblePlayers = players.filter((p) => {
    const gear = p.gear.find((g) => g.slot === slot);
    return gear?.bisSource === 'raid' && !gear?.hasItem;
  });

  if (settings.priorityMode === 'lootCount') {
    return eligiblePlayers
      .map((player) => ({
        player,
        score: calculateLootCountPriority(
          player,
          lootStats.get(player.id) ?? { totalDrops: 0 },
          pageBalances.get(player.id) ?? { total: 0 },
        ),
      }))
      .sort((a, b) => b.score - a.score);
  }

  // Default: role-based
  return eligiblePlayers
    .map((player) => ({
      player,
      score: calculatePriorityScore(player, settings, { includeLootAdjustment: true }),
    }))
    .sort((a, b) => b.score - a.score);
}
```

#### 3.5 Implement Loot Weight Filtering (1 hour)
**File:** `frontend/src/utils/lootCoordination.ts`

```typescript
/**
 * Calculate loot stats with weight filtering.
 */
export function calculateFilteredLootStats(
  entries: LootLogEntry[],
  weights: LootWeightConfig,
): Map<string, { totalDrops: number }> {
  const stats = new Map<string, { totalDrops: number }>();

  for (const entry of entries) {
    // Filter by category based on weights
    const category = getLootCategory(entry.itemSlot, entry.method);
    if (!weights[category]) continue;

    const current = stats.get(entry.recipientPlayerId) ?? { totalDrops: 0 };
    current.totalDrops++;
    stats.set(entry.recipientPlayerId, current);
  }

  return stats;
}

function getLootCategory(slot: string, method: string): keyof LootWeightConfig {
  if (slot === 'weapon') return 'weapons';
  if (slot === 'mount') return 'mounts';
  if (slot === 'music') return 'music';
  if (slot.includes('coffer')) return 'coffers';
  return 'gear';
}
```

---

## Feature 4: Enhanced Team Summary with iLv

### Current State
- ✅ TeamSummary component exists
- ✅ `calculateAverageItemLevel` function exists
- ❌ iLv not displayed in summary
- ❌ No loot rank visualization

### Implementation Tasks

#### 4.1 Enhance TeamSummary Component (2-3 hours)
**File:** `frontend/src/components/team/TeamSummaryEnhanced.tsx`

Add columns for:
- Average iLv per player
- Loot rank with visual indicator
- Color-coded progress bars

```tsx
// Add to existing component:
import { calculateAverageItemLevel } from '../../utils/calculations';
import { calculatePlayerLootStats } from '../../utils/lootCoordination';

// In table headers:
<th>Avg iLv</th>
<th>Loot Rank</th>

// In player rows:
<td className={avgIlv >= 780 ? 'text-status-success font-semibold' : ''}>
  {calculateAverageItemLevel(player.gear, tierId)}
</td>
<td>
  <LootRankBadge rank={lootRank} total={players.length} />
</td>
```

#### 4.2 Add Progress Bar Color Coding (1 hour)
**File:** `frontend/src/components/ui/ProgressBar.tsx`

```tsx
export function ProgressBar({ 
  value, 
  max = 100,
  colorMode = 'default' 
}: { 
  value: number; 
  max?: number;
  colorMode?: 'default' | 'tiered';
}) {
  const percentage = Math.min((value / max) * 100, 100);
  
  let colorClass = 'bg-accent';
  if (colorMode === 'tiered') {
    if (percentage >= 50) colorClass = 'bg-status-success';
    else if (percentage >= 25) colorClass = 'bg-status-warning';
    else colorClass = 'bg-status-error';
  }
  
  return (
    <div className="h-2 bg-surface-default rounded-full overflow-hidden">
      <div 
        className={`h-full ${colorClass} transition-all duration-300`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
```

---

## Feature 5: Alt Job Tracking (Phase 2 - Lower Priority)

### Current State
- ❌ No alt job entity
- ❌ No shared page pool concept

### Implementation Tasks (Future Phase)

#### 5.1 Add AltJob Entity
**File:** `backend/app/models/alt_job.py`

```python
class AltJob(Base):
    __tablename__ = "alt_jobs"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    snapshot_player_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("snapshot_players.id", ondelete="CASCADE")
    )
    job: Mapped[str] = mapped_column(String(10))
    priority_tier: Mapped[str] = mapped_column(String(20))  # 'bis' | 'padding'
    gear: Mapped[list] = mapped_column(JSON, default=list)
```

#### 5.2 Add AltJobPanel Component
Similar to mockup, allows adding/managing alt jobs with shared page pool display.

---

## Feature 6: Tiered Coffer Priority

### Current State
- ✅ Priority functions exist for gear
- ❌ No coffer-specific priority tiers

### Implementation Tasks

#### 6.1 Add Coffer Priority Types (30 min)
**File:** `frontend/src/types/index.ts`

```typescript
export type CofferPriorityTier = 'bis' | 'padding' | 'alts' | 'free';

export interface CofferPriorityEntry {
  player: SnapshotPlayer;
  tier: CofferPriorityTier;
  score: number;
  reason: string;
}
```

#### 6.2 Implement Coffer Priority Algorithm (2 hours)
**File:** `frontend/src/utils/priority.ts`

```typescript
/**
 * Get tiered priority for coffer drops.
 * Returns players grouped by: BiS > iLv Padding > Alts > Free Roll
 */
export function getPriorityForCoffer(
  players: SnapshotPlayer[],
  slot: GearSlot,
  settings: StaticSettings,
  tierId: string,
): CofferPriorityEntry[] {
  const entries: CofferPriorityEntry[] = [];

  for (const player of players) {
    const gear = player.gear.find((g) => g.slot === slot);
    if (!gear) continue;

    // Tier 1: BiS Priority - player needs this slot as BiS
    if (gear.bisSource === 'raid' && !gear.hasItem) {
      entries.push({
        player,
        tier: 'bis',
        score: calculatePriorityScore(player, settings) + 1000,
        reason: 'BiS slot',
      });
      continue;
    }

    // Tier 2: iLv Padding - would improve current iLv
    const currentILv = gear.itemLevel ?? getItemLevelForCategory(tierId, gear.currentSource ?? 'crafted', slot === 'weapon');
    const cofferILv = getItemLevelForCategory(tierId, 'savage', slot === 'weapon');
    
    if (cofferILv > currentILv) {
      entries.push({
        player,
        tier: 'padding',
        score: calculatePriorityScore(player, settings) + 500 + (cofferILv - currentILv),
        reason: `iLv upgrade (+${cofferILv - currentILv})`,
      });
      continue;
    }

    // Tier 3: Free roll
    entries.push({
      player,
      tier: 'free',
      score: 0,
      reason: 'Free roll',
    });
  }

  // Sort by tier (bis > padding > free), then by score within tier
  const tierOrder: Record<CofferPriorityTier, number> = { bis: 0, padding: 1, alts: 2, free: 3 };
  return entries.sort((a, b) => {
    if (tierOrder[a.tier] !== tierOrder[b.tier]) {
      return tierOrder[a.tier] - tierOrder[b.tier];
    }
    return b.score - a.score;
  });
}
```

#### 6.3 Create CofferPriorityList Component (1-2 hours)
**File:** `frontend/src/components/loot/CofferPriorityList.tsx`

Display tiered priority with visual grouping per tier.

---

## Implementation Order (Recommended)

### Sprint 1: Core Parity (Days 1-2)
1. **Feature 1.1-1.2**: Enable current source column + iLv display
2. **Feature 2**: Loot/page adjustments panel
3. **Feature 4**: Enhanced team summary with iLv

### Sprint 2: Priority Enhancements (Days 2-3)
4. **Feature 3**: Priority mode toggle + loot weights
5. **Feature 6**: Coffer priority tiers
6. **Feature 1.3**: Planning markers (if time permits)

### Sprint 3: Future Phase
7. **Feature 5**: Alt job tracking (Phase 7+)

---

## Testing Checklist

- [ ] Current source selector updates gear correctly
- [ ] Average iLv calculation matches expected values
- [ ] Planning markers persist on save/reload
- [ ] Loot adjustments affect priority calculations
- [ ] Page adjustments affect balance display
- [ ] Priority mode toggle changes priority ordering
- [ ] Loot weight toggles filter drop counts
- [ ] Team summary shows all new columns
- [ ] Coffer priority groups players correctly
- [ ] All features work with view-only permissions (disabled but visible)

---

## Migration Notes

### Backward Compatibility
- All new fields have defaults (empty arrays, 0 values, 'role' mode)
- Existing data remains valid - no migration script needed
- UI gracefully handles missing optional fields

### API Changes
- `PATCH /static-groups/{id}` accepts new settings fields
- `PATCH /tiers/{id}/players/{id}` accepts `lootAdjustment` and `pageAdjustments`
- No breaking changes to existing endpoints

---

**End of Implementation Plan**

*Document generated by Claude • FFXIV Raid Planner Parity Features*
