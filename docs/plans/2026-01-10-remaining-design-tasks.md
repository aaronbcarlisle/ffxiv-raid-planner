# Remaining Design System Tasks - Implementation Plan

**Created:** 2026-01-10
**Branch:** `feature/design-system-migration`
**Status:** ✅ COMPLETE - All Phase 1 & 2 tasks done

---

## Completed Tasks Summary

| Task | Description | Commit |
|------|-------------|--------|
| ✅ 4.1 | Hotkeys in tooltips | `2dfb00a` |
| ✅ 3.5 | Gear slot icons in Who Needs It | `0512819` |
| ✅ 2.4 | Item name column in GearTable | `d332075` |
| ✅ 2.3 | BiS source compact toggle | `d52265d` |
| ✅ 2.5 | CurrentSource column in GearTable | `116cc35` |

---

## Deferred Task

| Task | Description | Reason |
|------|-------------|--------|
| 2.6 | Materia in gear tooltip | Requires backend changes, cache regeneration - defer to separate PR |

---

## Implementation Details

### Task 4.1: Hotkeys in Tooltips
- Tab buttons show hotkey hints: "Roster (1)", "Loot (2)", etc.
- View toggle shows "(V)" in tooltips
- Group toggle shows "(G)" in tooltips
- Added new "S" shortcut for toggling substitutes section
- Updated KeyboardShortcutsHelp modal

**Files modified:**
- `components/ui/TabNavigation.tsx`
- `components/ui/ViewModeToggle.tsx`
- `components/ui/GroupViewToggle.tsx`
- `components/ui/KeyboardShortcutsHelp.tsx`
- `pages/GroupView.tsx`

### Task 3.5: Gear Slot Icons in Who Needs It
- Added XIVAPI gear slot icons next to slot names
- Icons use muted opacity (60%) for subtle visual

**Files modified:**
- `components/loot/WhoNeedsItMatrix.tsx`

### Task 2.4: Item Name Column in GearTable
- Added "Item" column between Slot and BiS Source
- Shows item name from BiS import when available
- Responsive: hidden on small screens (`hidden md:table-cell`)
- Includes truncation with tooltip for long names

**Files modified:**
- `components/player/GearTable.tsx`

### Task 2.3: BiS Source Compact Toggle
- Replaced two-button toggle with single compact toggle button
- Click toggles between Raid and Tome
- Shows up/down arrows icon to indicate togglable
- Color-coded: green for Raid, teal for Tome
- Reduced column width and header text

**Files modified:**
- `components/player/GearTable.tsx`

### Task 2.5: CurrentSource Column in GearTable
- Added "Current" column showing equipped gear source category
- Uses GEAR_SOURCE_NAMES and GEAR_SOURCE_COLORS
- Responsive: only shown on lg+ screens
- Color-coded per source category

**Files modified:**
- `components/player/GearTable.tsx`

---

## Test Results

All 285 tests passing.

---

## Next Steps

1. **Update PR #15** with completed work summary
2. **Task 2.6 (Materia)** - Consider for future PR:
   - Requires adding `materia` field to GearSlotStatus type
   - Backend changes to XIVGear/Etro import
   - BiS preset cache regeneration
   - ItemHoverCard updates
