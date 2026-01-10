# Design System & UX Improvements Implementation Plan

**Created:** 2026-01-10
**Branch:** `feature/design-system-migration`
**Status:** Planning

## Overview

This plan addresses a comprehensive set of UI/UX improvements across the Loot tab, Player Cards, and various modals. The changes focus on:
- Consistent shared filter components across Loot sub-tabs
- Enhanced visual feedback (progress rings, group headers)
- Improved modal UX and data consistency
- Better keyboard accessibility with hotkey tooltips

---

## Summary

**Total Tasks:** 22 (1 deferred)
- Loot Tab: 5 tasks + 1 deferred
- Player Cards: 7 tasks
- Modal Fixes: 5 tasks
- Tooltips: 1 task

---

## Table of Contents

1. [Loot Tab Improvements](#1-loot-tab-improvements)
2. [Player Card Improvements](#2-player-card-improvements)
3. [Modal & Form Fixes](#3-modal--form-fixes)
4. [Tooltips & Accessibility](#4-tooltips--accessibility)
5. [Questions & Clarifications](#5-questions--clarifications-resolved)

---

## 1. Loot Tab Improvements

### 1.1 Preserve Floor Selection Across Sub-tabs

**Problem:** When switching between Loot sub-tabs (Who Needs It, Gear Priority, Weapon Priority), the floor selection resets. WhoNeedsItMatrix manages its own local state while Gear Priority uses the parent's controlled state.

**Solution:** Lift floor selection state to the parent `LootPriorityPanel` and pass it down to all sub-tabs as a controlled prop.

**Files to modify:**
- `frontend/src/components/loot/LootPriorityPanel.tsx` (lines 171-197)
- `frontend/src/components/loot/WhoNeedsItMatrix.tsx` (lines 48-54, 104-133)

**Implementation:**
1. Add `selectedFloor` prop to `WhoNeedsItMatrix` interface
2. Add `onFloorChange` callback prop to `WhoNeedsItMatrix`
3. Remove local `selectedFloor` state from `WhoNeedsItMatrix`
4. Wire controlled floor state in `LootPriorityPanel` to `WhoNeedsItMatrix`
5. Ensure URL param `?floor=` is synced across all sub-tabs

---

### 1.2 Create Shared Filter Bar Component

**Problem:** Floor selection in "Who Needs It" and "Gear Priority" tabs, and the "Show" section in "Weapon Priority" tab all have different implementations and positions. Switching tabs causes visual shifts.

**Solution:** Create a unified `FilterBar` component that all three sub-tabs use for their filter controls.

**New file:** `frontend/src/components/loot/FilterBar.tsx`

**Component API:**
```typescript
interface FilterBarProps {
  // Floor filter (for Who Needs It / Gear Priority)
  floors?: string[];
  selectedFloor?: FloorNumber | 'all';
  onFloorChange?: (floor: FloorNumber | 'all') => void;
  showAllOption?: boolean;

  // Role filter (for Weapon Priority)
  roleFilters?: Array<{ id: string; label: string; color: string }>;
  visibleRoles?: Set<string>;
  onRoleToggle?: (roleId: string) => void;

  // Common
  filterLabel?: string; // "Floor:" or "Show:"
  alignment?: 'left' | 'right'; // For positioning
}
```

**Implementation:**
1. Create `FilterBar` component with shared styling
2. Use `FLOOR_COLORS` for floor buttons, role colors for role buttons
3. Consistent padding, spacing, and button sizes (`px-3 py-1.5 rounded text-xs font-bold`)
4. Apply to all three sub-tabs
5. Ensure filter bar position is consistent (left-aligned) across all tabs

**Files to modify:**
- Create: `frontend/src/components/loot/FilterBar.tsx`
- `frontend/src/components/loot/WhoNeedsItMatrix.tsx` (lines 104-133)
- `frontend/src/components/loot/LootPriorityPanel.tsx` (lines 396-422)
- `frontend/src/components/loot/WeaponPriorityList.tsx` (lines 413-436)

---

### 1.3 Move Weapon Priority "Show" Section to Left

**Problem:** The "Show" section in Weapon Priority is right-aligned (`justify-end`), while floor selectors are left-aligned. This causes visual inconsistency when switching tabs.

**Solution:** Part of 1.2 - the shared `FilterBar` component will align all filters to the left.

**File:** `frontend/src/components/loot/WeaponPriorityList.tsx` (lines 413-436)

**Change:**
```diff
- <div className="flex items-center justify-end gap-2 flex-wrap">
+ <div className="flex items-center gap-2 flex-wrap">
```

---

### 1.4 Collapsible Role Sections in Weapon Priority

**Problem:** Role sections (Tanks, Healers, Melee DPS, etc.) in Weapon Priority are always expanded with no collapse functionality.

**Solution:** Use the same `FloorSection` pattern from the Log tab's "By Floor" view.

**Reference:** `frontend/src/components/history/FloorSection.tsx` (collapsible header pattern)

**Files to modify:**
- `frontend/src/components/loot/WeaponPriorityList.tsx` (lines 453-463)

**Implementation:**
1. Create `RoleSection` component similar to `FloorSection`
2. Add collapsible header with chevron indicator
3. Use role colors (from `getRoleColor()`) instead of floor colors
4. Track expanded state per role section
5. Default to expanded for all sections
6. Show weapon count in header badge (e.g., "4 weapons")

---

### 1.5 ~~Synchronized "+X More" Expansion~~ (DEFERRED)

**Status:** Skipped for now per user request.

---

### 1.6 Contained Scroll Container for Loot Tab

**Problem:** The Loot tab uses page-level scrolling, while the Log tab uses a contained scroll area that doesn't expand past the viewport.

**Reference mockup:** `reference/Screenshot 2026-01-10 050057.png` - shows Log tab with contained scroll

**Solution:** Apply dynamic viewport-relative height for optimal UX.

**Files to modify:**
- `frontend/src/components/loot/LootPriorityPanel.tsx`
- `frontend/src/pages/GroupView.tsx` (lines 1171-1199)

**Implementation:**
1. Calculate fixed element heights:
   - Header/navbar: ~64px
   - Tab navigation: ~48px
   - Sub-tab bar + filters: ~56px
   - Padding/margins: ~32px
   - Total offset: ~200px (verify exact values)
2. Apply `max-h-[calc(100vh-200px)] overflow-y-auto` to Loot panel container
3. Ensure filter bar stays fixed at top while content scrolls
4. Test across viewport sizes to ensure no page-level scroll occurs

**Rationale:** Dynamic height is better UX than fixed height because:
- Maximizes usable space on large monitors
- Adapts responsively to any viewport
- Content area always fills remaining space below fixed elements

---

## 2. Player Card Improvements

### 2.1 Progress Ring Component

**Problem:** Gear progress is shown as text "5/11" which doesn't provide visual feedback at a glance.

**Reference mockups:**
- `reference/Screenshot 2026-01-10 050419.png` - Progress ring examples (1/11, 5/11, 9/11, 11/11)
- `reference/Screenshot 2026-01-10 051547.png` - Progress ring in player card header

**Solution:** Replace text counter with SVG progress ring.

**New file:** `frontend/src/components/ui/ProgressRing.tsx`

**Component API:**
```typescript
interface ProgressRingProps {
  value: number;      // Current value (e.g., 5)
  max: number;        // Maximum value (e.g., 11)
  size?: 'sm' | 'md' | 'lg';  // Ring size
  showLabel?: boolean; // Show "5/11" text inside
}
```

**Color coding (using app design tokens):**
- 0-25% (0-2/11): `text-text-muted` / muted gray
- 26-75% (3-8/11): `text-accent` / teal (primary accent)
- 76-99% (9-10/11): `text-status-warning` / amber (almost there!)
- 100% (11/11): `text-status-success` / green (complete)

**Note:** Colors should use existing design tokens from `index.css` for consistency.

**Files to modify:**
- Create: `frontend/src/components/ui/ProgressRing.tsx`
- `frontend/src/components/player/PlayerCardHeader.tsx` (lines 237-253)

**Implementation:**
1. Create SVG-based circular progress indicator
2. Use `stroke-dasharray` and `stroke-dashoffset` for arc calculation
3. Apply color based on percentage thresholds
4. Display "X/Y" text in center
5. Replace text display in `PlayerCardHeader` with `ProgressRing`

---

### 2.2 Enhanced G1/G2 Group Headers

**Problem:** G1/G2 headers only show "Light Party 1/2" text with a colored badge. Missing useful information like role composition and aggregate progress.

**Reference mockup:** `reference/Screenshot 2026-01-10 050458.png`
- Shows LP1/LP2 badges
- Role composition icons (tank, healer, melee, ranged)
- Aggregate progress bar
- "28/44 BiS" summary text

**Files to modify:**
- `frontend/src/pages/GroupView.tsx` (lines 1070-1146)

**New component:** `frontend/src/components/player/LightPartyHeader.tsx`

**Component API:**
```typescript
interface LightPartyHeaderProps {
  groupNumber: 1 | 2;
  players: SnapshotPlayer[];
}
```

**Implementation:**
1. Extract header rendering to `LightPartyHeader` component
2. Calculate role composition from player list
3. Show role icons with presence indicators
4. Calculate aggregate BiS progress (sum of player completions)
5. Add horizontal progress bar showing group completion
6. Display "X/44 BiS" (4 players × 11 slots = 44)

---

### 2.3 BiS Source as Dropdown/Toggle

**Problem:** BiS source is displayed as two side-by-side buttons ("Raid" and "Tome") taking up significant horizontal space.

**Reference mockup:** `reference/mockup_player_card_callouts.png` - Point #2: "Replace the two-button toggle with a single dropdown"

**Solution:** Convert BiS source to a compact dropdown similar to position tags.

**Files to modify:**
- `frontend/src/components/player/GearTable.tsx` (lines 421-447)

**Implementation:**
1. Create inline select/dropdown for BiS source
2. Options: **Raid, Tome** (keep current options only)
3. Color-code the selected value (green/red for Raid, teal for Tome)
4. Reduce column width for BiS source
5. Match styling of `PositionSelector` component (Radix Popover)

---

### 2.4 Add Item Name Column to GearTable

**Problem:** GearTable doesn't show the actual item name from BiS import, only the slot name.

**Reference mockup:** `reference/Screenshot 2026-01-10 050406.png`
- Shows columns: SLOT | ITEM | SOURCE | ACTIONS
- Item names like "Grand Champion's Falchion", "Grand Champion's Headgear"

**Files to modify:**
- `frontend/src/components/player/GearTable.tsx`

**Implementation:**
1. Add "Item" column between Slot and BiS Source
2. Display `status.itemName` when available
3. Truncate long names with ellipsis + tooltip
4. Make column responsive - collapse at smaller breakpoints
5. Use `text-text-secondary` for item names

**Responsive behavior:**
- Large screens: Show full item name
- Medium screens: Truncate with tooltip
- Small screens: Hide column entirely

---

### 2.5 Add CurrentSource Column (Responsive)

**Problem:** GearTable doesn't show what gear the player currently has equipped (`currentSource`).

**Solution:** Add conditional column showing `currentSource` when screen is wide enough.

**Files to modify:**
- `frontend/src/components/player/GearTable.tsx`

**Implementation:**
1. Add "Current" column between Item and BiS Source
2. Show `currentSource` category badge (savage, tome_up, catchup, etc.)
3. Use appropriate styling for each category
4. Only show when viewport is above certain breakpoint (e.g., `lg:`)
5. Use Tailwind responsive classes: `hidden lg:table-cell`

---

### 2.6 Show Materia in Gear Tooltip

**Problem:** Gear tooltip (ItemHoverCard) doesn't show materia from BiS import.

**Reference mockup:** `reference/Screenshot 2026-01-10 051156.png`
- Shows materia icons below item name
- Format: "54 DET" with materia icon
- Multiple materia shown in a row

**Files to modify:**
- `frontend/src/components/ui/ItemHoverCard.tsx` (128 lines)
- `frontend/src/types/index.ts` (add materia to GearSlotStatus if needed)
- `backend/scripts/backfill_gcd.py` (may need to re-run to cache materia)

**Implementation:**
1. Verify materia is being stored from XIVGear/Etro imports
2. Check if `local_bis_presets.json` includes materia data
3. If materia not cached, update backfill script to include it and re-run
4. Add `materia?: Array<{ stat: string; value: number }>` to GearSlotStatus
5. Add materia section to `ItemHoverCard` below stats grid
6. Display materia with stat abbreviation + value (e.g., "54 DET")
7. Handle cases where materia data isn't available (older imports)

**Note:** Materia IS stored from XIVGear/Etro imports, but the BiS preset cache may not include it. May need to regenerate `local_bis_presets.json` to include materia data.

---

### 2.7 Replace Player Options Menu Icons with Lucide

**Problem:** Player options menu uses custom PNG icons from `/icons/` directory instead of Lucide React icons.

**Current icons (from types/index.ts lines 239-251):**
- `/icons/copy-transparent-bg.png`
- `/icons/paste-transparent-bg.png`
- `/icons/duplicate-transparent-bg.png`
- `/icons/remove-transparent-bg.png`
- `/icons/substitute-transparent-bg.png`
- `/icons/weapon-priority-transparent-bg.png`
- `/icons/reset-gear-transparent-bg.png`
- `/icons/take-ownership-transparent-bg.png`
- `/icons/release-ownership-transparent-bg.png`
- `/icons/import-bis-transparent-bg.png`

**Lucide equivalents:**
| Current | Lucide Icon |
|---------|------------|
| copy | `Copy` |
| paste | `ClipboardPaste` |
| duplicate | `CopyPlus` |
| remove | `Trash2` |
| substitute | `UserMinus` / `UserPlus` |
| weapon-priority | `Swords` |
| reset-gear | `RotateCcw` |
| take-ownership | `UserCheck` |
| release-ownership | `UserX` |
| import-bis | `Import` or `FileDown` |

**Files to modify:**
- `frontend/src/types/index.ts` (lines 239-251)
- `frontend/src/components/player/PlayerCard.tsx` (lines 252-365)
- `frontend/src/components/player/PlayerCardHeader.tsx` (line 261-265, menu button)

**Implementation:**
1. Import Lucide icons in PlayerCard
2. Update `CONTEXT_MENU_ICONS` to use Lucide components instead of PNG paths
3. Update ContextMenu component to handle React component icons (already supports `ReactNode`)
4. Replace player-options.png button with Lucide `MoreVertical` or `EllipsisVertical`

---

## 3. Modal & Form Fixes

### 3.1 Fix Edit Book Balance Modal Input Sizing

**Problem:** In Edit Book modal, "Current" and "New Balance" inputs have different sizes. Current is a plain div, New Balance uses NumberInput.

**Reference mockup:** `reference/Screenshot 2026-01-10 053410.png`

**Files to modify:**
- `frontend/src/components/history/EditBookBalanceModal.tsx` (lines 63-77)

**Implementation:**
1. Replace Current display div with a disabled NumberInput
2. Match sizing with New Balance input (`size="sm"`)
3. Add disabled styling: `opacity-50 cursor-not-allowed`
4. Ensure both inputs have same height and padding

```tsx
// Before (line 66-67):
<div className="px-3 py-2 rounded bg-surface-elevated border border-border-default text-text-primary text-center font-medium">
  {currentBalance}
</div>

// After:
<NumberInput
  value={currentBalance}
  onChange={() => {}} // No-op
  disabled
  showButtons={false}
  size="sm"
  className="opacity-50"
/>
```

---

### 3.2 Add Job Icons to Recipients in Log Entry Modals

**Problem:** Recipient dropdowns in log entry modals show text only (`PlayerName (JOB)`) without visual job icons.

**Files to modify:**
- `frontend/src/components/history/AddLootEntryModal.tsx` (lines 286-291)
- `frontend/src/components/history/LogMaterialModal.tsx`
- `frontend/src/components/loot/QuickLogDropModal.tsx`
- `frontend/src/components/loot/QuickLogMaterialModal.tsx`

**Implementation:**
1. Create custom Select option renderer with job icon
2. Format: `[JobIcon] PlayerName (JOB) - Priority Label`
3. Use `JobIcon` component with `size="xs"`
4. May need to customize the Select component to support custom option rendering

**Alternative:** If Select doesn't support custom rendering, consider using a custom dropdown or Radix Select with custom content.

---

### 3.3 Fix Edit Loot Entry Recipient Pre-population

**Problem:** When editing an existing loot entry, the Recipient dropdown is blank instead of showing the current recipient.

**Reference mockup:** `reference/Screenshot 2026-01-10 054310.png` - Shows blank recipient field

**Root cause:** In AddLootEntryModal, the `recipientPlayerId` is set from `editEntry.recipientPlayerId` in the useEffect (line 88-96), but the auto-selection effect (lines 191-204) may be overriding it.

**File:** `frontend/src/components/history/AddLootEntryModal.tsx` (lines 191-204)

**Issue analysis:**
```typescript
// Line 193: This skips auto-selection in edit mode, which is correct
if (isEditMode) return;

// But line 75: Initial state sets recipientPlayerId from editEntry
const [recipientPlayerId, setRecipientPlayerId] = useState(editEntry?.recipientPlayerId || '');
```

**The bug:** The issue is likely that when `visibleRecipients` changes (due to filters), the auto-selection effect runs and clears the value. Need to trace the exact flow.

**Fix:**
1. Ensure `isEditMode` check prevents any auto-selection
2. Verify `editEntry.recipientPlayerId` is being preserved through filter changes
3. If recipient is filtered out (e.g., is a sub), auto-enable `includeSubs`

**Investigation needed:** Line 95-96 already handles the sub case. Need to debug the exact race condition.

---

### 3.4 Filter Material Log Floor Selector to Valid Floors

**Problem:** When logging material, all floors are shown in the dropdown including floors with no material drops (M9S, M12S).

**Reference mockup:** `reference/Screenshot 2026-01-10 054536.png`
- Shows "M9S (no materials)", "M10S", "M11S", "M12S (no materials)"

**Current behavior (LogMaterialModal.tsx lines 271-276):**
```typescript
const floorOptions = floors.map((floor) => {
  const materials = getMaterialsForFloor(floor);
  return {
    value: floor,
    label: materials.length === 0 ? `${floor} (no materials)` : floor,
  };
});
```

**Better solution:** Only show floors that have materials, or disable invalid options.

**Files to modify:**
- `frontend/src/components/history/LogMaterialModal.tsx` (lines 271-276)

**Implementation options:**

**Option A: Filter out floors without materials**
```typescript
const floorOptions = floors
  .filter(floor => getMaterialsForFloor(floor).length > 0)
  .map(floor => ({ value: floor, label: floor }));
```

**Option B: Disable floors without materials (keeps context)**
```typescript
const floorOptions = floors.map((floor) => {
  const materials = getMaterialsForFloor(floor);
  return {
    value: floor,
    label: floor,
    disabled: materials.length === 0,
  };
});
```

**Recommendation:** Option A is cleaner - only show valid options. If user needs context on which floors have materials, they can see it in the tier configuration.

---

### 3.5 Add Gear Slot Icons to Who Needs It Table

**Problem:** The "Slot" column in WhoNeedsItMatrix shows text only ("Weapon", "Head", etc.) without visual gear slot icons.

**Files to modify:**
- `frontend/src/components/loot/WhoNeedsItMatrix.tsx` (lines 169-172)

**Implementation:**
1. Import gear slot icons (from `/icons/` or create new component)
2. Display icon to the left of slot name
3. Use same icons as player card gear table
4. Match the generic slot icon style (before BiS is imported)

**Note:** Need to verify where generic gear slot icons are defined. May need to create a `GearSlotIcon` component.

---

## 4. Tooltips & Accessibility

### 4.1 Add Hotkeys to Tooltips

**Problem:** Tooltips for actions don't show associated keyboard shortcuts. Users have to open the keyboard help modal to learn shortcuts.

**Solution:** Append hotkey indicator to relevant tooltips.

**Files to modify:**
- `frontend/src/pages/GroupView.tsx` (various tooltip/title attributes)
- `frontend/src/components/ui/TabNavigation.tsx` (if tooltips exist on tabs)

**Implementation:**
1. Create utility function to format hotkey in tooltip:
   ```typescript
   function tooltipWithHotkey(text: string, hotkey?: string): string {
     return hotkey ? `${text} (${hotkey})` : text;
   }
   ```
2. Update tab tooltips to include hotkeys (1, 2, 3, 4)
3. Update view toggle tooltips (v for compact/expanded, g for group view)
4. Update any other action tooltips with keyboard shortcuts

**Example:**
- Players tab: "Players (1)"
- Loot tab: "Loot (2)"
- Toggle view: "Compact view (V)"
- Toggle groups: "Show G1/G2 (G)"

---

## 5. Questions & Clarifications (RESOLVED)

All questions have been resolved:

### 5.1 "+X More" Row Expansion
**Status:** ~~DEFERRED~~ - Skipping this feature for now.

### 5.2 Materia Data Availability
**Answer:** Materia IS stored from XIVGear/Etro imports, but the BiS preset cache (`local_bis_presets.json`) may not include it. May need to regenerate cache to include materia data.

### 5.3 Progress Ring Color Thresholds
**Answer:** Use colors that match the app's design theme (design tokens from `index.css`), not the mockup exactly. Updated implementation to use:
- `text-text-muted` for low progress
- `text-accent` for mid progress
- `text-status-warning` for near-complete
- `text-status-success` for complete

### 5.4 Contained Scroll Height Calculation
**Answer:** Use dynamic viewport-relative height (`calc(100vh - fixed_elements)`) for better UX. This maximizes usable space and adapts to any viewport size.

### 5.5 BiS Source Extended Options
**Answer:** Keep current **Raid/Tome only** for now. No need to add Crafted/Relic/Other options.

---

## Implementation Order

Recommended implementation order based on dependencies (22 tasks total, 1.5 deferred):

### Phase 1: Foundation Components
1. Create `FilterBar` component (1.2)
2. Create `ProgressRing` component (2.1)
3. Create `RoleSection` component (1.4)

### Phase 2: Loot Tab Improvements
4. Apply FilterBar to Who Needs It (1.2)
5. Apply FilterBar to Gear Priority (1.2)
6. Apply FilterBar to Weapon Priority (1.2, 1.3)
7. Lift floor selection state (1.1)
8. Add collapsible role sections (1.4)
9. Contained scroll container (1.6)

### Phase 3: Player Card Improvements
10. Replace progress counter with ring (2.1)
11. Enhanced G1/G2 headers (2.2)
12. Replace PNG icons with Lucide (2.7)
13. BiS source dropdown (2.3)
14. Item name column (2.4)
15. CurrentSource column (2.5)
16. Materia in tooltip (2.6) - may require cache regeneration

### Phase 4: Modal Fixes
17. Edit Book modal sizing (3.1)
18. Job icons in recipients (3.2)
19. Fix recipient pre-population (3.3)
20. Filter material floor selector (3.4)
21. Gear slot icons in Who Needs It (3.5)

### Phase 5: Tooltips
22. Add hotkeys to tooltips (4.1)

---

## Testing Checklist

For each change:
- [ ] Manual testing in development
- [ ] Responsive breakpoint testing
- [ ] Accessibility testing (keyboard navigation, screen readers)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Update existing tests if behavior changes
- [ ] Add new tests for new components

---

## References

**Mockups:**
- `reference/Screenshot 2026-01-10 050057.png` - Loot/Log contained scroll
- `reference/Screenshot 2026-01-10 050406.png` - Item column in gear table
- `reference/Screenshot 2026-01-10 050419.png` - Progress ring examples
- `reference/Screenshot 2026-01-10 050458.png` - Enhanced group headers
- `reference/Screenshot 2026-01-10 051156.png` - Materia in tooltip
- `reference/Screenshot 2026-01-10 051547.png` - Progress ring in card
- `reference/Screenshot 2026-01-10 053410.png` - Edit Book modal
- `reference/Screenshot 2026-01-10 054310.png` - Edit Loot entry recipient
- `reference/Screenshot 2026-01-10 054536.png` - Material floor selector
- `reference/mockup_player_card_callouts.png` - Detailed player card mockup
- `reference/mockup_roster_overview_callouts.png` - Roster overview mockup
- `reference/mockup_import_wizard_callouts.png` - BiS import wizard mockup

**Key Source Files:**
- `frontend/src/components/loot/LootPriorityPanel.tsx`
- `frontend/src/components/loot/WhoNeedsItMatrix.tsx`
- `frontend/src/components/loot/WeaponPriorityList.tsx`
- `frontend/src/components/player/PlayerCard.tsx`
- `frontend/src/components/player/PlayerCardHeader.tsx`
- `frontend/src/components/player/GearTable.tsx`
- `frontend/src/components/history/AddLootEntryModal.tsx`
- `frontend/src/components/history/EditBookBalanceModal.tsx`
- `frontend/src/components/history/FloorSection.tsx`
- `frontend/src/gamedata/loot-tables.ts`
