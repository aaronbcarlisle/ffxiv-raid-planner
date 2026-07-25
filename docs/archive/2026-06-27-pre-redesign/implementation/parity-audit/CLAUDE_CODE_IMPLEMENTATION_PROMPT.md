# Claude Code Implementation Prompt: FFXIV Raid Planner Parity Features

## Project Context

You are implementing parity features for the FFXIV Raid Planner web application. This is a React 19 + TypeScript frontend with a FastAPI + SQLAlchemy backend. The app helps Final Fantasy XIV raid teams coordinate gear progression and loot distribution.

**Repository:** ffxiv-raid-planner (`feature/parity-features` dev branch)
**Key directories:**
- `frontend/src/components/` - React components
- `frontend/src/types/index.ts` - TypeScript types
- `frontend/src/utils/` - Utility functions (priority.ts, calculations.ts)
- `frontend/src/stores/` - Zustand stores
- `backend/app/models/` - SQLAlchemy models
- `backend/app/schemas/` - Pydantic schemas

**Design System:** Dark theme with teal accent (#2dd4bf). Uses custom primitives in `components/primitives/` and UI components in `components/ui/`.

---

## Task Overview

Implement 5 features to close the remaining feature gap with reference spreadsheets. Work through them in order. Each feature builds on existing infrastructure.

---

## Feature 1: Enable Current Gear Source Column + iLv Display

### 1.1 Enable Current Source Column in GearTable

**File:** `frontend/src/components/player/GearTable.tsx`

The `currentSource` column exists but is hidden. Enable it and add a selector.

**Tasks:**
1. Find the hidden column (search for `hidden` class on the "Current" header around line 488)
2. Change `hidden` to `hidden md:table-cell` to show on medium+ screens
3. Create a `CurrentSourceSelector` component for changing the source

**Create file:** `frontend/src/components/player/CurrentSourceSelector.tsx`

```tsx
import { useState } from 'react';
import { Popover } from '../primitives';
import { GEAR_SOURCE_NAMES, GEAR_SOURCE_COLORS, type GearSourceCategory } from '../../types';

const GEAR_CATEGORIES: GearSourceCategory[] = [
  'savage', 'tome_up', 'catchup', 'tome', 'relic', 'crafted', 'prep', 'normal'
];

interface CurrentSourceSelectorProps {
  value: GearSourceCategory;
  onChange: (source: GearSourceCategory) => void;
  disabled?: boolean;
}

export function CurrentSourceSelector({ value, onChange, disabled }: CurrentSourceSelectorProps) {
  const [open, setOpen] = useState(false);
  
  const displayValue = value === 'unknown' ? '—' : GEAR_SOURCE_NAMES[value];
  const colorClass = value === 'unknown' ? 'text-text-muted' : GEAR_SOURCE_COLORS[value];

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          className={`text-xs px-2 py-0.5 rounded ${colorClass} bg-surface-interactive hover:bg-surface-hover disabled:opacity-50`}
          disabled={disabled}
        >
          {displayValue}
        </button>
      }
    >
      <div className="flex flex-col gap-1 p-2 min-w-[120px]">
        <div className="text-xs text-text-muted mb-1 px-2">Current Gear</div>
        {GEAR_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              onChange(cat);
              setOpen(false);
            }}
            className={`text-xs px-2 py-1.5 rounded text-left hover:bg-surface-hover ${
              value === cat ? 'bg-accent/20' : ''
            } ${GEAR_SOURCE_COLORS[cat]}`}
          >
            {GEAR_SOURCE_NAMES[cat]}
          </button>
        ))}
      </div>
    </Popover>
  );
}
```

4. Import and use `CurrentSourceSelector` in the table cell where currentSource is displayed
5. Add `onCurrentSourceChange` prop to GearTable and wire it through to the selector

### 1.2 Display Average iLv in Player Card Header

**File:** `frontend/src/components/player/PlayerCardHeader.tsx`

**Tasks:**
1. Import `calculateAverageItemLevel` from `../../utils/calculations`
2. Import `useTierStore` from `../../stores/tierStore`
3. Get the active tier ID and calculate average iLv
4. Display it after the completion percentage

```tsx
// Add to imports
import { calculateAverageItemLevel } from '../../utils/calculations';
import { useTierStore } from '../../stores/tierStore';

// Constants for tier and item level thresholds
const DEFAULT_TIER_ID = 'arcadion-light-heavyweight';
const AVG_ILV_HIGHLIGHT_THRESHOLD = 780;

// Inside component, get tier and calculate
const { activeTier } = useTierStore();
const avgILv = player.gear.length > 0
  ? calculateAverageItemLevel(player.gear, activeTier?.tierId ?? DEFAULT_TIER_ID)
  : 0;

// In JSX, add after existing stats (find the completion display)
{avgILv > 0 && (
  <span className="text-text-muted text-xs ml-2">
    iLv <span className={avgILv >= AVG_ILV_HIGHLIGHT_THRESHOLD ? 'text-accent font-medium' : ''}>{avgILv}</span>
  </span>
)}
```

---

## Feature 2: Loot & Page Adjustments Panel

### 2.1 Create AdjustmentsPanel Component

**Create file:** `frontend/src/components/player/AdjustmentsPanel.tsx`

```tsx
import { useState } from 'react';
import { Input, Label } from '../ui';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { SnapshotPlayer } from '../../types';

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

  const playersWithAdjustments = players.filter(hasAdjustments);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-medium text-text-primary">Player Adjustments</h4>
          <p className="text-xs text-text-muted">
            Adjust loot counts and page balances for mid-tier roster changes
          </p>
        </div>
        {playersWithAdjustments.length > 0 && (
          <span className="px-2 py-0.5 bg-status-warning/20 text-status-warning rounded text-xs">
            {playersWithAdjustments.length} adjusted
          </span>
        )}
      </div>

      <div className="space-y-2">
        {players.filter(p => p.configured).map((player) => (
          <PlayerAdjustmentRow
            key={player.id}
            player={player}
            isExpanded={expandedPlayer === player.id}
            onToggle={() => setExpandedPlayer(expandedPlayer === player.id ? null : player.id)}
            onUpdate={(updates) => onUpdatePlayer(player.id, updates)}
            hasAdjustments={hasAdjustments(player)}
            disabled={disabled}
          />
        ))}
      </div>

      <div className="text-xs text-text-muted mt-4 p-3 bg-surface-default rounded-lg">
        <strong>How adjustments work:</strong>
        <ul className="mt-1 space-y-1 list-disc list-inside">
          <li><strong>Loot Count:</strong> Positive = player received extra drops (lower priority). Negative = player missed drops (higher priority).</li>
          <li><strong>Page Adjustments:</strong> Adds/subtracts from page balance for each floor.</li>
        </ul>
      </div>
    </div>
  );
}

function PlayerAdjustmentRow({
  player,
  isExpanded,
  onToggle,
  onUpdate,
  hasAdjustments,
  disabled,
}: {
  player: SnapshotPlayer;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<SnapshotPlayer>) => void;
  hasAdjustments: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`rounded-lg border ${hasAdjustments ? 'border-status-warning/40 bg-status-warning/5' : 'border-border-default bg-surface-default'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-hover/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-text-primary font-medium">{player.name}</span>
          <span className="text-xs text-text-muted">{player.job}</span>
          {hasAdjustments && (
            <span className="text-xs px-1.5 py-0.5 bg-status-warning/20 text-status-warning rounded">
              Adjusted
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border-default/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Loot Count Adjustment */}
            <div>
              <Label className="text-xs">Loot Count Adjustment</Label>
              <Input
                type="number"
                value={player.lootAdjustment ?? 0}
                onChange={(e) => onUpdate({ lootAdjustment: parseInt(e.target.value) || 0 })}
                disabled={disabled}
                className="mt-1"
              />
            </div>

            {/* Page Adjustments */}
            <div>
              <Label className="text-xs">Page Adjustments (per floor)</Label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {(['I', 'II', 'III', 'IV'] as const).map((floor) => (
                  <div key={floor}>
                    <div className="text-xs text-text-muted text-center mb-1">{floor}</div>
                    <Input
                      type="number"
                      value={player.pageAdjustments?.[floor] ?? 0}
                      onChange={(e) => onUpdate({
                        pageAdjustments: {
                          I: player.pageAdjustments?.I ?? 0,
                          II: player.pageAdjustments?.II ?? 0,
                          III: player.pageAdjustments?.III ?? 0,
                          IV: player.pageAdjustments?.IV ?? 0,
                          [floor]: parseInt(e.target.value) || 0,
                        },
                      })}
                      disabled={disabled}
                      className="text-center text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdjustmentsPanel;
```

### 2.2 Add Adjustments Tab to GroupSettingsModal

**File:** `frontend/src/components/static-group/GroupSettingsModal.tsx`

**Tasks:**
1. Add `'adjustments'` to the `SettingsTab` type (around line 36)
2. Add a new tab button in the tab navigation
3. Import `AdjustmentsPanel` and add the tab content
4. You'll need to pass players from the active tier - use `useTierStore` to get them

```tsx
// Add to imports
import { AdjustmentsPanel } from '../player/AdjustmentsPanel';
import { useTierStore } from '../../stores/tierStore';

// Update SettingsTab type
type SettingsTab = 'general' | 'priority' | 'adjustments' | 'members' | 'invitations';

// In the component, get players
const { activeTier, updatePlayer } = useTierStore();
const players = activeTier?.players ?? [];

// Add tab button (in the tab navigation section)
<button
  onClick={() => setActiveTab('adjustments')}
  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
    activeTab === 'adjustments'
      ? 'bg-surface-elevated text-text-primary border-b-2 border-accent'
      : 'text-text-muted hover:text-text-primary'
  }`}
>
  Adjustments
</button>

// Add tab content (in the tab content switch/conditional)
{activeTab === 'adjustments' && (
  <AdjustmentsPanel
    players={players}
    onUpdatePlayer={(playerId, updates) => updatePlayer(playerId, updates)}
    disabled={!canEditPriority}
  />
)}
```

### 2.3 Update Priority Calculations to Use Adjustments

**File:** `frontend/src/utils/priority.ts`

Find all calls to `calculatePriorityScore` and ensure they pass `{ includeLootAdjustment: true }`:

```tsx
// In getPriorityForItem (around line 77-81)
.map((player) => ({
  player,
  score: calculatePriorityScore(player, settings, { includeLootAdjustment: true }),
}))

// In getPriorityForRing (around line 100-104)
.map((player) => ({
  player,
  score: calculatePriorityScore(player, settings, { includeLootAdjustment: true }),
}))

// In getPriorityForUpgradeMaterial (around line 186-189)
return {
  player,
  score: calculatePriorityScore(player, settings, { includeLootAdjustment: true }) + effectiveNeed * 15,
};

// In getPriorityForUniversalTomestone (around line 236-239)
.map((player) => ({
  player,
  score: calculatePriorityScore(player, settings, { includeLootAdjustment: true }),
}))
```

---

## Feature 3: Priority Mode & Loot Weight Settings

### 3.1 Add New Types

**File:** `frontend/src/types/index.ts`

Add these types near the other settings types:

```typescript
// Priority mode for loot distribution
export type PriorityMode = 'role' | 'lootCount';

// Loot weight configuration - which items count toward loot totals
export interface LootWeightConfig {
  gear: boolean;
  weapons: boolean;
  mounts: boolean;
  music: boolean;
  coffers: boolean;
}

// Default loot weights
export const DEFAULT_LOOT_WEIGHTS: LootWeightConfig = {
  gear: true,
  weapons: true,
  mounts: false,
  music: false,
  coffers: true,
};
```

Update `StaticSettings` interface to include new fields:

```typescript
export interface StaticSettings {
  displayOrder: string[];
  lootPriority: string[];
  sortPreset: SortPreset;
  groupView: boolean;
  timezone: string;
  autoSync: boolean;
  syncFrequency: 'daily' | 'weekly';
  priorityMode?: PriorityMode;           // NEW - defaults to 'role'
  lootWeights?: LootWeightConfig;        // NEW - defaults to DEFAULT_LOOT_WEIGHTS
}
```

### 3.2 Create PrioritySettingsPanel Component

**Create file:** `frontend/src/components/static-group/PrioritySettingsPanel.tsx`

```tsx
import { Checkbox } from '../ui';
import type { PriorityMode, LootWeightConfig } from '../../types';
import { DEFAULT_LOOT_WEIGHTS } from '../../types';

interface PrioritySettingsPanelProps {
  priorityMode: PriorityMode;
  lootWeights: LootWeightConfig;
  onModeChange: (mode: PriorityMode) => void;
  onWeightsChange: (weights: LootWeightConfig) => void;
  disabled?: boolean;
}

const WEIGHT_LABELS: Record<keyof LootWeightConfig, { label: string; description: string }> = {
  gear: { label: 'Gear Drops', description: 'Armor and accessory drops' },
  weapons: { label: 'Weapons', description: 'Weapon drops and coffers' },
  mounts: { label: 'Mounts', description: 'Mount drops from final floor' },
  music: { label: 'Orchestrion Rolls', description: 'Music drops' },
  coffers: { label: 'Gear Coffers', description: 'Universal gear coffers' },
};

export function PrioritySettingsPanel({
  priorityMode,
  lootWeights,
  onModeChange,
  onWeightsChange,
  disabled,
}: PrioritySettingsPanelProps) {
  return (
    <div className="space-y-6">
      {/* Priority Mode Toggle */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Priority Mode
        </label>
        <div className="grid grid-cols-2 gap-2 p-1 bg-surface-default rounded-lg">
          <button
            onClick={() => onModeChange('role')}
            className={`py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
              priorityMode === 'role'
                ? 'bg-accent text-surface-base'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
            }`}
            disabled={disabled}
          >
            Role-Based
          </button>
          <button
            onClick={() => onModeChange('lootCount')}
            className={`py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
              priorityMode === 'lootCount'
                ? 'bg-accent text-surface-base'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
            }`}
            disabled={disabled}
          >
            Loot Count First
          </button>
        </div>
        <p className="text-xs text-text-muted mt-2">
          {priorityMode === 'role'
            ? 'Priority based on role order (set below), slot value weights, and fairness adjustments.'
            : 'Players with fewer drops always have priority. Role order used as tie-breaker.'}
        </p>
      </div>

      {/* Loot Weights */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Include in Loot Count
        </label>
        <p className="text-xs text-text-muted mb-3">
          Select which drop types count toward a player's total when calculating priority.
        </p>
        <div className="space-y-2">
          {(Object.keys(WEIGHT_LABELS) as (keyof LootWeightConfig)[]).map((key) => (
            <label
              key={key}
              className="flex items-center justify-between p-3 bg-surface-default rounded-lg cursor-pointer hover:bg-surface-hover transition-colors"
            >
              <div>
                <span className="text-text-primary text-sm">{WEIGHT_LABELS[key].label}</span>
                <p className="text-xs text-text-muted">{WEIGHT_LABELS[key].description}</p>
              </div>
              <Checkbox
                checked={lootWeights[key]}
                onChange={(checked) => onWeightsChange({ ...lootWeights, [key]: checked })}
                disabled={disabled}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PrioritySettingsPanel;
```

### 3.3 Integrate into GroupSettingsModal Priority Tab

**File:** `frontend/src/components/static-group/GroupSettingsModal.tsx`

Update the priority tab to include the new panel above the role order list:

```tsx
// Add imports
import { PrioritySettingsPanel } from './PrioritySettingsPanel';
import { DEFAULT_LOOT_WEIGHTS, type PriorityMode, type LootWeightConfig } from '../../types';

// Add state for new settings (near other state declarations)
const [priorityMode, setPriorityMode] = useState<PriorityMode>(
  group.settings?.priorityMode || 'role'
);
const [lootWeights, setLootWeights] = useState<LootWeightConfig>(
  group.settings?.lootWeights || DEFAULT_LOOT_WEIGHTS
);

// Update hasChanges check to include new fields
const priorityModeChanged = priorityMode !== (group.settings?.priorityMode || 'role');
const lootWeightsChanged = JSON.stringify(lootWeights) !== JSON.stringify(group.settings?.lootWeights || DEFAULT_LOOT_WEIGHTS);
const hasChanges = name !== group.name || isPublic !== group.isPublic || priorityChanged || priorityModeChanged || lootWeightsChanged;

// In the priority tab content, add the panel before the role order section
{activeTab === 'priority' && (
  <div className="space-y-6">
    <PrioritySettingsPanel
      priorityMode={priorityMode}
      lootWeights={lootWeights}
      onModeChange={setPriorityMode}
      onWeightsChange={setLootWeights}
      disabled={!canEditPriority}
    />
    
    <div className="border-t border-border-default pt-6">
      <label className="block text-sm font-medium text-text-primary mb-2">
        Role Priority Order
      </label>
      {/* ... existing role order DnD list ... */}
    </div>
  </div>
)}

// Update handleSave to include new settings
const updateData: { ... } = {};
// ... existing updates ...
if (priorityModeChanged || lootWeightsChanged || priorityChanged) {
  updateData.settings = {
    ...group.settings,
    lootPriority,
    priorityMode,
    lootWeights,
  };
}
```

### 3.4 Update Backend Schema (if not already present)

**File:** `backend/app/schemas/static_group.py`

Ensure the settings schema accepts the new fields:

```python
class StaticSettings(BaseModel):
    display_order: list[str] = []
    loot_priority: list[str] = []
    sort_preset: str = "standard"
    group_view: bool = False
    timezone: str = "UTC"
    auto_sync: bool = False
    sync_frequency: str = "weekly"
    priority_mode: str = "role"  # "role" | "lootCount"
    loot_weights: dict = {
        "gear": True,
        "weapons": True,
        "mounts": False,
        "music": False,
        "coffers": True,
    }
```

---

## Feature 4: Enhanced Team Summary with iLv

### 4.1 Update TeamSummaryEnhanced Component

**File:** `frontend/src/components/team/TeamSummaryEnhanced.tsx`

Add average iLv column and loot stats:

```tsx
// Add imports
import { calculateAverageItemLevel, calculatePlayerCompletion } from '../../utils/calculations';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';

// In the component, get loot data
const { lootLog } = useLootTrackingStore();

// Calculate loot counts per player
const lootCounts = useMemo(() => {
  const counts = new Map<string, number>();
  lootLog.forEach(entry => {
    counts.set(entry.recipientPlayerId, (counts.get(entry.recipientPlayerId) || 0) + 1);
  });
  return counts;
}, [lootLog]);

// Calculate team average iLv
const teamAvgILv = useMemo(() => {
  if (players.length === 0) return 0;
  const total = players.reduce((sum, p) => sum + calculateAverageItemLevel(p.gear, tierId), 0);
  return Math.round(total / players.length);
}, [players, tierId]);

// Add to the summary header
<div className="flex items-center gap-6 text-sm">
  <div>
    <span className="text-text-muted">Team Avg iLv:</span>
    <span className="ml-2 text-accent font-semibold">{teamAvgILv}</span>
  </div>
  <div>
    <span className="text-text-muted">Team Completion:</span>
    <span className="ml-2 text-text-primary font-semibold">{teamCompletion}%</span>
  </div>
</div>

// Add columns to the player table header
<th className="text-right py-2 px-3 text-xs font-medium text-text-muted">Avg iLv</th>
<th className="text-right py-2 px-3 text-xs font-medium text-text-muted">Drops</th>

// Add columns to player rows (uses AVG_ILV_HIGHLIGHT_THRESHOLD constant defined above)
<td className="text-right py-2 px-3">
  <span className={avgILv >= AVG_ILV_HIGHLIGHT_THRESHOLD ? 'text-accent font-medium' : 'text-text-primary'}>
    {avgILv}
  </span>
</td>
<td className="text-right py-2 px-3">
  <span className="text-text-primary">{lootCounts.get(player.id) || 0}</span>
</td>
```

### 4.2 Add Color-Coded Progress Bars

Update the progress display to use tiered colors:

```tsx
// Helper function for progress color
function getProgressColor(percentage: number): string {
  if (percentage >= 75) return 'bg-status-success';
  if (percentage >= 50) return 'bg-accent';
  if (percentage >= 25) return 'bg-status-warning';
  return 'bg-status-error';
}

// In the progress bar JSX
<div className="w-full h-2 bg-surface-default rounded-full overflow-hidden">
  <div
    className={`h-full ${getProgressColor(completion)} transition-all duration-300`}
    style={{ width: `${completion}%` }}
  />
</div>
```

---

## Feature 5: Coffer Priority Tiers

### 5.1 Add Coffer Priority Types

**File:** `frontend/src/types/index.ts`

```typescript
// Coffer priority tiers (matches Arcadion spreadsheet hierarchy)
export type CofferPriorityTier = 'bis' | 'padding' | 'alts' | 'free';

export interface CofferPriorityEntry {
  player: SnapshotPlayer;
  tier: CofferPriorityTier;
  score: number;
  reason: string;
}

export const COFFER_TIER_CONFIG: Record<CofferPriorityTier, { label: string; color: string; description: string }> = {
  bis: { label: 'BiS Priority', color: 'text-status-success', description: 'Needs this slot for BiS' },
  padding: { label: 'iLv Padding', color: 'text-accent', description: 'Would improve current iLv' },
  alts: { label: 'Alt Jobs', color: 'text-status-warning', description: 'For alternate job gearing' },
  free: { label: 'Free Roll', color: 'text-text-muted', description: 'No specific need' },
};
```

### 5.2 Implement Coffer Priority Algorithm

**File:** `frontend/src/utils/priority.ts`

Add this function:

```typescript
import { getItemLevelForCategory } from '../gamedata/raid-tiers';
import type { CofferPriorityEntry, CofferPriorityTier } from '../types';

/**
 * Get tiered priority for coffer drops.
 * Returns players grouped by: BiS > iLv Padding > Free Roll
 */
export function getPriorityForCoffer(
  players: SnapshotPlayer[],
  slot: GearSlot,
  settings: StaticSettings,
  tierId: string,
): CofferPriorityEntry[] {
  const entries: CofferPriorityEntry[] = [];
  const cofferILv = getItemLevelForCategory(tierId, 'savage', slot === 'weapon');

  for (const player of players) {
    if (!player.configured) continue;
    
    const gear = player.gear.find((g) => g.slot === slot);
    if (!gear) continue;

    // Tier 1: BiS Priority - player needs this slot as raid BiS
    if (gear.bisSource === 'raid' && !gear.hasItem) {
      entries.push({
        player,
        tier: 'bis',
        score: calculatePriorityScore(player, settings, { includeLootAdjustment: true }) + 10000,
        reason: 'BiS slot',
      });
      continue;
    }

    // Calculate current item level for this slot
    const currentSource = gear.currentSource ?? 'crafted';
    const currentILv = gear.hasItem && gear.itemLevel 
      ? gear.itemLevel 
      : getItemLevelForCategory(tierId, currentSource, slot === 'weapon');

    // Tier 2: iLv Padding - coffer would be an upgrade
    if (cofferILv > currentILv) {
      const ilvGain = cofferILv - currentILv;
      entries.push({
        player,
        tier: 'padding',
        score: calculatePriorityScore(player, settings, { includeLootAdjustment: true }) + 5000 + ilvGain,
        reason: `+${ilvGain} iLv upgrade`,
      });
      continue;
    }

    // Tier 3: Free roll - already at or above coffer iLv
    entries.push({
      player,
      tier: 'free',
      score: calculatePriorityScore(player, settings, { includeLootAdjustment: true }),
      reason: 'No upgrade needed',
    });
  }

  // Sort by tier first, then by score within tier
  const tierOrder: Record<CofferPriorityTier, number> = { bis: 0, padding: 1, alts: 2, free: 3 };
  return entries.sort((a, b) => {
    const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
    if (tierDiff !== 0) return tierDiff;
    return b.score - a.score;
  });
}
```

### 5.3 Create CofferPriorityList Component

**Create file:** `frontend/src/components/loot/CofferPriorityList.tsx`

```tsx
import { useMemo } from 'react';
import { getPriorityForCoffer } from '../../utils/priority';
import { COFFER_TIER_CONFIG, type CofferPriorityTier, type GearSlot, type SnapshotPlayer, type StaticSettings } from '../../types';
import { JobIcon } from '../ui/JobIcon';

interface CofferPriorityListProps {
  players: SnapshotPlayer[];
  slot: GearSlot;
  settings: StaticSettings;
  tierId: string;
  onAward?: (playerId: string) => void;
}

export function CofferPriorityList({ players, slot, settings, tierId, onAward }: CofferPriorityListProps) {
  const priorityList = useMemo(
    () => getPriorityForCoffer(players, slot, settings, tierId),
    [players, slot, settings, tierId]
  );

  // Group by tier
  const groupedByTier = useMemo(() => {
    const groups: Record<CofferPriorityTier, typeof priorityList> = {
      bis: [],
      padding: [],
      alts: [],
      free: [],
    };
    priorityList.forEach(entry => {
      groups[entry.tier].push(entry);
    });
    return groups;
  }, [priorityList]);

  const topPlayer = priorityList[0];

  return (
    <div className="space-y-4">
      {/* Quick Award Button */}
      {topPlayer && onAward && (
        <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <JobIcon job={topPlayer.player.job} size={24} />
            <div>
              <span className="text-text-primary font-medium">{topPlayer.player.name}</span>
              <span className="text-xs text-accent ml-2">{COFFER_TIER_CONFIG[topPlayer.tier].label}</span>
            </div>
          </div>
          <button
            onClick={() => onAward(topPlayer.player.id)}
            className="px-3 py-1.5 bg-accent text-surface-base rounded-md text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Award Coffer
          </button>
        </div>
      )}

      {/* Tiered List */}
      {(['bis', 'padding', 'free'] as CofferPriorityTier[]).map(tier => {
        const entries = groupedByTier[tier];
        if (entries.length === 0) return null;

        const config = COFFER_TIER_CONFIG[tier];

        return (
          <div key={tier} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
              <span className="text-xs text-text-muted">({entries.length})</span>
            </div>
            <div className="space-y-1">
              {entries.map((entry, index) => (
                <div
                  key={entry.player.id}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    index === 0 && tier === 'bis' ? 'bg-status-success/10 border border-status-success/30' : 'bg-surface-default'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-text-muted text-xs w-4">{index + 1}</span>
                    <JobIcon job={entry.player.job} size={20} />
                    <span className="text-text-primary">{entry.player.name}</span>
                  </div>
                  <span className="text-xs text-text-muted">{entry.reason}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CofferPriorityList;
```

### 5.4 Integrate into LootPriorityPanel

**File:** `frontend/src/components/loot/LootPriorityPanel.tsx`

Add coffer priority display when viewing coffer drops:

```tsx
// Import the new component
import { CofferPriorityList } from './CofferPriorityList';

// In the component, detect if current item is a coffer
const isCofferDrop = selectedSlot?.includes('coffer') || false;

// Render coffer priority list for coffer drops
{isCofferDrop ? (
  <CofferPriorityList
    players={players}
    slot={mapCofferToSlot(selectedSlot)} // Map "body_coffer" -> "body"
    settings={settings}
    tierId={tierId}
    onAward={handleAwardLoot}
  />
) : (
  // Existing priority list for regular drops
  <RegularPriorityList ... />
)}
```

---

## Testing Checklist

After implementing each feature, verify:

- [ ] **Feature 1:** Current source column shows and selector works. iLv displays in header.
- [ ] **Feature 2:** Adjustments panel accessible in settings. Values save and persist. Priority calculations reflect adjustments.
- [ ] **Feature 3:** Priority mode toggle switches between algorithms. Loot weights affect drop counting.
- [ ] **Feature 4:** Team summary shows iLv column. Progress bars color-coded correctly.
- [ ] **Feature 5:** Coffer drops show tiered priority list. BiS tier highlighted.

---

## Notes

- The codebase uses Zustand for state management. Check `stores/` for patterns.
- Design system colors: `text-accent` (teal), `text-status-success` (green), `text-status-warning` (yellow), `text-status-error` (red)
- The `Popover` component is from `components/primitives/Popover.tsx` - follow existing usage patterns
- Run `pnpm lint` and `pnpm typecheck` after changes to catch issues
- Backend uses snake_case, frontend uses camelCase - serialization handles conversion

Work through features in order. Commit after each feature is complete and tested.
