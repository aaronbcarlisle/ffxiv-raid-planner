# BiS Source Improvements - Implementation Complete

**Branch:** `feature/bis-source-improvements` (merged to main in v1.9.0)
**Status:** ✅ Complete - Implemented with architectural changes

---

## Implementation Summary

This plan was completed with a **bifurcated architecture approach** that separates concerns:

1. **BiS Source Selector** (`BiSSourceSelector.tsx`) - Core gear source selection UI
   - 2x2 grid with 4 sources: Raid, Tome, Base Tome, Crafted
   - Target-style status circles (`GearStatusCircle.tsx`)
   - Color differentiation: base_tome (blue) vs tome (teal)
   - Backend schema updated to accept `null` for unset BiS sources

2. **BiS Source Fix Banner** (`BiSSourceFixBanner.tsx`) - Separate miscategorization detection
   - Detects gear incorrectly categorized (e.g., crafted gear marked as raid BiS)
   - Uses item name prefix matching for accurate detection
   - Shows contextual messages guiding users to fix categorization
   - Does NOT modify BiSSourceSelector - independent component

3. **Augmentation Detection** - Uses item name prefix (authoritative)
   - `requiresAugmentation()` checks for "Aug." or "Augmented" prefix in item name
   - More reliable than iLv comparison (no tier lookup needed, no edge cases)
   - Only `tome` BiS requires augmentation, not `base_tome` or `crafted`

**Key Architectural Decision:** Initial plan proposed integrating triple-state checkbox and auto-detection into a single component. Final implementation separated these concerns for better maintainability and clearer user experience.

---

## Original Issues (Resolved)

### Issue 1: Augmentation Detection is Broken

**Problem:** When importing a BiS set (e.g., https://etro.gg/gearset/da9ef350-7568-4c98-8ecc-959040d9ba3a), ALL tome pieces are incorrectly marked as "does not need augment".

**Root Cause:** The `requiresAugmentation()` function uses **itemLevel comparison** which is unreliable:
```typescript
// Current logic (calculations.ts:60-67)
if (slot.itemLevel && tierId) {
  const baseTomeILv = tier.itemLevels.tome + (isWeapon ? 5 : 0);
  return slot.itemLevel > baseTomeILv;  // 790 > 780 = needs aug
}
```

**Why it fails:** Either `slot.itemLevel` isn't being stored correctly, or the comparison has edge cases.

**Fix:** Use **item name prefix** instead - much more reliable:
```typescript
export function requiresAugmentation(slot: GearSlotStatus): boolean {
  if (slot.bisSource !== 'tome') return false;

  // Check if BiS item name indicates augmented version
  if (slot.itemName) {
    const name = slot.itemName.toLowerCase();
    return name.startsWith('aug.') || name.startsWith('augmented');
  }

  // No item name - assume augmented needed (safer default)
  return true;
}
```

**Why this is better:**
- Item names from XIVAPI definitively include "Aug." prefix for augmented items
- No tier lookup required
- No edge cases with item level variations
- Example: "Aug. Quetzalli Coat" = BiS is augmented = needs aug = true
- Example: "Quetzalli Coat" = BiS is base tome = needs aug = false

### Issue 2: Triple-State Checkbox Not Implemented

**Problem:** GearTable still shows separate "Have" and "Aug" columns. The combined triple-state checkbox was planned but never integrated.

**Current State:**
- `GearStatusCheckbox.tsx` EXISTS and is complete
- It's NOT USED anywhere - just sitting as an untracked file
- GearTable.tsx still uses two separate `Checkbox` components

**Fix:** Replace the two-column approach with single `GearStatusCheckbox`:
- Raid/Crafted: 2-state cycle (missing ↔ have)
- Tome (base is BiS): 2-state cycle (missing ↔ have)
- Tome (needs aug): 3-state cycle (missing → have → augmented → missing)

### Issue 3: No Manual Override for Augmentation Requirement

**Problem:** Users cannot manually specify whether a tome slot needs augmentation. The system auto-detects from BiS import but provides no override.

**Options:**
1. **Option A: No override needed** - If item name detection works correctly, auto-detection is sufficient
2. **Option B: Add toggle** - Add a small toggle/indicator that users can click to flip aug requirement
3. **Option C: Edit in BiS modal** - Allow editing aug requirement when reviewing BiS import preview

**Recommendation:** Start with Option A (fix detection). If users need manual control, add Option B later.

---

## Final Implementation (What Was Actually Done)

### Completed Changes

1. **BiSSourceSelector Component** ✅
   - 2x2 grid layout with Raid, Tome, Base Tome, Crafted
   - Left-aligned popover (align="start")
   - Fixed-width trigger badges (w-7)
   - "Clear Slot" button for null bisSource
   - ARIA labels for accessibility

2. **GearStatusCircle Component** ✅
   - Target-style status indicator (replaces checkbox)
   - Three visual states: missing (gray), have (colored ring), complete (ring + fill)
   - Color by source: raid=red, tome=teal, base_tome=blue, crafted=orange
   - Sizes: sm/md/lg with 2px borders for anti-aliasing

3. **BiSSourceFixBanner Component** ✅
   - Separate from PlayerSetupBanner
   - Detects miscategorized gear using item name/iLv comparison
   - Shows "Base Tome gear detected" or "Crafted gear detected" messages
   - Links to BiS import modal for correction

4. **Backend Schema Updates** ✅
   - `GearBisSource` allows `null` for unset slots
   - Added `base_tome` to allowed BiS sources
   - `determine_source()` in `bis.py` distinguishes tome vs base_tome by "Aug." prefix

5. **Calculation Updates** ✅
   - `requiresAugmentation()` uses item name prefix (authoritative detection)
   - `isSlotComplete()` handles `null` bisSource
   - `calculatePlayerMaterials()` only counts `tome` for upgrade materials
   - Progress ring calculation correctly counts `base_tome` and `crafted` as complete without aug

6. **Color System** ✅
   - Added `--color-gear-base-tome: #60a5fa` (Blue-400)
   - Updated all color mappings across components
   - Tooltips removed, ARIA labels added

### What Was NOT Done (Deferred/Changed)

- **Triple-state GearStatusCheckbox integration** - GearStatusCheckbox.tsx exists but not integrated
  - Reason: GearStatusCircle proved sufficient, checkbox adds complexity
  - Current approach: Separate status circle + BiS source selector works well
  - File kept for potential future use

- **Manual augmentation override** - No toggle for aug requirement
  - Reason: Item name detection is reliable enough
  - Users can re-import BiS if detection is wrong
  - Can add in future if needed

---

## Original Implementation Plan (For Reference)

### Phase 1: Fix Augmentation Detection

**File:** `frontend/src/utils/calculations.ts`

```typescript
/**
 * Check if a tome BiS slot requires augmentation
 * Uses item name prefix which is authoritative from XIVAPI
 */
export function requiresAugmentation(slot: GearSlotStatus): boolean {
  // Only tome BiS can require augmentation
  if (slot.bisSource !== 'tome') return false;

  // Check if BiS item name indicates augmented version
  if (slot.itemName) {
    const name = slot.itemName.toLowerCase();
    // "Aug. Item Name" or "Augmented Item Name" = BiS is augmented version
    return name.startsWith('aug.') || name.startsWith('augmented');
  }

  // No item name data - assume augmented is target (safer default)
  return true;
}
```

**Update callers:** Remove `tierId` parameter from all call sites:
- `calculations.ts:isSlotComplete()` - remove tierId param
- `calculations.ts:calculatePlayerMaterials()` - remove tierId param
- `priority.ts:getPriorityForUpgradeMaterial()` - remove tierId param
- `priority.ts:calculatePlayerNeeds()` - remove tierId param
- All component call sites

### Phase 2: Integrate Triple-State Checkbox

**File:** `frontend/src/components/player/GearTable.tsx`

1. **Import change:**
   ```typescript
   import { GearStatusCheckbox } from '../ui/GearStatusCheckbox';
   import { toGearState, fromGearState } from '../../utils/calculations';
   ```

2. **Replace columns:** Merge "Have" and "Aug" into single "Status" column

3. **Update handler:**
   ```typescript
   const handleGearStateChange = (slot: string, newState: GearState) => {
     const { hasItem, isAugmented } = fromGearState(newState);
     onGearChange(slot, { hasItem, isAugmented });
   };
   ```

4. **Replace checkboxes with GearStatusCheckbox:**
   ```tsx
   <GearStatusCheckbox
     state={toGearState(status.hasItem, status.isAugmented)}
     bisSource={status.bisSource}
     requiresAugmentation={requiresAugmentation(status)}
     disabled={!gearPermission.allowed}
     onChange={(newState) => handleGearStateChange(slot, newState)}
   />
   ```

### Phase 3: Commit Backend Schema Fix

**File:** `backend/app/schemas/tier_snapshot.py`

The uncommitted change adding `GearBisSource = Literal["raid", "tome", "crafted"]` must be committed - this fixes the 422 error when saving crafted BiS.

### Phase 4: Commit Other Pending Changes

1. TankRoleSelector color fix
2. GearStatusCheckbox component (track the file)
3. UI_COMPONENTS.md updates
4. CLAUDE.md updates

### Phase 5: Update Tests

Update `calculations.test.ts` to test new `requiresAugmentation()` logic:
- Test with "Aug. Item Name" → returns true
- Test with "Item Name" (no prefix) → returns false
- Test with undefined itemName → returns true (safe default)

---

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/utils/calculations.ts` | Fix `requiresAugmentation()` to use item name |
| `frontend/src/utils/priority.ts` | Remove tierId params from aug-related calls |
| `frontend/src/components/player/GearTable.tsx` | Integrate GearStatusCheckbox |
| `frontend/src/components/ui/GearStatusCheckbox.tsx` | Track file (already complete) |
| `backend/app/schemas/tier_snapshot.py` | Commit existing change |
| `frontend/src/utils/calculations.test.ts` | Update tests for new logic |

---

## Verification Steps

1. `pnpm build` - No type errors
2. `pnpm test` - All tests pass (update failing tests)
3. `pytest tests/ -q` - Backend tests pass
4. **Manual testing:**
   - Import BiS from https://etro.gg/gearset/da9ef350-7568-4c98-8ecc-959040d9ba3a
   - Verify augmented tome items show "needs aug" indicator
   - Verify base tome items show "complete when acquired"
   - Test triple-state checkbox cycling
   - Set a slot to Crafted, verify no 422 error

---

## Edge Cases

1. **Old data without itemName** - Falls back to assuming aug needed (safe)
2. **Tome weapon** - Same logic applies (check "Aug." prefix)
3. **Double ring tome** - Each ring checked independently by name
4. **Manual BiS entry** - Users can set bisSource, itemName comes from any BiS link import

---

## CLAUDE.md Rule Addition

Add to CLAUDE.md:

```markdown
## Plan Files

**NEVER save plans to the `.claude` folder.** Always create plan files in the project:
- Location: `docs/` folder with descriptive name (e.g., `docs/BIS_SOURCE_PLAN.md`)
- Plans in `.claude/plans/` are lost between sessions
```
