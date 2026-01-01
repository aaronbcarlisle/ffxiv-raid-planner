# Loot System Audit Implementation Plan

## Summary

Implement all fixes and improvements from the comprehensive loot system audit. The audit identified that `lootCoordination.ts` is missing (causing broken imports in `useLootActions` hook), inline log buttons don't exist in the UI, and DEFAULT_SETTINGS is duplicated.

**Estimated effort:** 4-6 hours total

---

## Phase 1: Create lootCoordination.ts (Core Fix)

**Create:** `frontend/src/utils/lootCoordination.ts`

This is the missing coordination layer that `useLootActions.ts` tries to import. Must export:

```typescript
// Types
export interface LogLootOptions { updateGear?: boolean; updateWeaponPriority?: boolean; }
export interface DeleteLootOptions { revertGear?: boolean; }
export interface PlayerLootStats { totalDrops: number; dropsThisWeek: number; weeksSinceLastDrop: number; }

// Functions
export async function logLootAndUpdateGear(groupId, tierId, data, options): Promise<void>
export async function deleteLootAndRevertGear(groupId, tierId, entryId, entry, options): Promise<void>
export function getPrioritySuggestionsForSlot(players, slot, settings): PrioritySuggestion[]
export function calculatePlayerLootStats(playerId, lootLog, currentWeek): PlayerLootStats
export function calculateEnhancedPriorityScore(baseScore, stats, averageDrops): number
```

**Key implementation details:**
- Uses `useLootTrackingStore.getState()` and `useTierStore.getState()` for cross-store coordination
- `logLootAndUpdateGear`: Creates entry → updates gear hasItem → marks weapon priority received
- `deleteLootAndRevertGear`: Deletes entry → reverts gear hasItem
- `calculateEnhancedPriorityScore`: Adds drought bonus (+10/week, max +50) and balance penalty (-15/excess drop, max -45)

---

## Phase 2: Consolidate DEFAULT_SETTINGS

**Modify:** `frontend/src/utils/constants.ts`
- Add `DEFAULT_SETTINGS: StaticSettings` export with all 7 properties

**Modify:** `frontend/src/pages/GroupView.tsx`
- Remove local `DEFAULT_SETTINGS` definition (lines 36-44)
- Add import from `../utils/constants`

**Modify:** `frontend/src/hooks/useLootActions.ts`
- Replace inline partial settings with import from `../utils/constants`

---

## Phase 3: Add Inline Log Buttons to LootPriorityPanel

**Modify:** `frontend/src/components/loot/LootPriorityPanel.tsx`

### 3.1 Update Props Interface
```typescript
interface LootPriorityPanelProps {
  players: SnapshotPlayer[];
  settings: StaticSettings;
  selectedFloor: FloorNumber;
  floorName: string;
  // Add these:
  showLogButtons?: boolean;
  groupId?: string;
  tierId?: string;
  onLogDrop?: (playerId: string, slot: string) => void;
}
```

### 3.2 Add Log Button to PriorityList
- Show [Log] button next to #1 priority player when `showLogButtons={true}`
- On click, open `QuickLogDropModal` with pre-filled slot/floor/player
- After logging, gear updates automatically via coordination utilities

### 3.3 Update GroupView.tsx
Pass additional props to LootPriorityPanel:
```tsx
<LootPriorityPanel
  players={configuredPlayers}
  settings={DEFAULT_SETTINGS}
  selectedFloor={selectedFloor}
  floorName={tierInfo.floors[selectedFloor - 1]}
  showLogButtons={canEdit}
  groupId={staticGroup?.id}
  tierId={currentTier?.tierId}
/>
```

---

## Phase 4: Always Show Weapon Priority

**Modify:** `frontend/src/components/loot/LootPriorityPanel.tsx`

Change from:
```tsx
{selectedFloor === 4 && (
  <div>Weapon Priority...</div>
)}
```

To:
```tsx
<div className="border-t border-border-default pt-4 mt-4">
  <h4 className="text-text-secondary text-sm mb-3 flex items-center gap-2">
    Weapon Priority
    {selectedFloor === 4 && (
      <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
        Drops this floor
      </span>
    )}
  </h4>
  <WeaponPriorityList players={players} settings={settings} />
</div>
```

---

## Phase 5: Enhanced Priority Display (Optional)

**Modify:** `frontend/src/components/loot/LootPriorityPanel.tsx`

Add props for loot history:
```typescript
lootLog?: LootLogEntry[];
currentWeek?: number;
showEnhancedScores?: boolean;
```

In PriorityList, show enhanced scores with tooltip breakdown:
```
Score: 185  (hover: "Base: 150 | Drought: +40 | Balance: -5")
```

---

## Phase 6: Backend Enhancement (Optional)

**Modify:** `backend/app/routers/loot_tracking.py` line 205

Change delete permission from owner-only to lead-or-owner:
```python
# Current:
await require_owner(db, current_user.id, group_id)

# Change to:
await require_can_edit_roster(db, current_user.id, group_id)
```

---

## Files Summary

### Create
| File | Purpose |
|------|---------|
| `frontend/src/utils/lootCoordination.ts` | Cross-store coordination utilities |

### Modify
| File | Changes |
|------|---------|
| `frontend/src/utils/constants.ts` | Add DEFAULT_SETTINGS export |
| `frontend/src/pages/GroupView.tsx` | Import DEFAULT_SETTINGS, pass props to LootPriorityPanel |
| `frontend/src/hooks/useLootActions.ts` | Import DEFAULT_SETTINGS (fixes broken import) |
| `frontend/src/components/loot/LootPriorityPanel.tsx` | Add showLogButtons, inline log UI, always show weapon priority |
| `backend/app/routers/loot_tracking.py` | (Optional) Allow leads to delete loot entries |

---

## Testing Checklist

- [ ] `useLootActions` hook imports without errors
- [ ] Logging loot via Loot tab inline button updates gear checkbox
- [ ] Logging loot via History tab still works (regression)
- [ ] Deleting loot reverts gear checkbox
- [ ] Weapon priority shows on all floors
- [ ] "Drops this floor" badge only on Floor 4
- [ ] Log buttons only visible for owners/leads
- [ ] Members/viewers see read-only priority lists
