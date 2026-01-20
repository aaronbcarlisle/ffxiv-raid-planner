# BiS Source Improvements - Updated Plan

**Branch:** `feature/bis-source-improvements`
**Status:** In Progress - Issues Found During Testing

---

## Current Issues (Found During Testing)

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

## Implementation Plan

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
