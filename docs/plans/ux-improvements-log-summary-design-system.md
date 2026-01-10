# UX Improvements Plan - Log Tab, Summary, and Design System Consistency

**Created:** January 10, 2026
**Branch:** `feature/design-system-migration`
**Status:** Planning

---

## Issues Identified

| # | Issue | Severity | Category |
|---|-------|----------|----------|
| 1 | Getting Started page narrower container | Low | ✅ Intentional - no change |
| 2 | Grid view recipient not auto-selecting highest priority | Medium | Bug fix |
| 3 | Include Subs logic doesn't show subs when no eligible recipients | Medium | UX improvement |
| 4 | Week number input takes too much vertical space | Low | UX improvement |
| 5 | Notes field doesn't support multiline in Material modal | Medium | Bug fix |
| 6 | Books section text/icons too small | Medium | UX improvement |
| 7 | Reset dropdown items don't look dangerous enough | Low | UX improvement |
| 8 | Week dropdown doesn't match design system Select | Low | Design consistency |
| 9 | Tab/subtab structure inconsistency across views | Low | Documentation |
| 10 | Summary page not visually inviting | Medium | UX improvement |

---

## Issue Analysis & Decisions

### 1. Getting Started Page Width (80rem)
**Decision:** No change needed.

The 80rem width for sidebar-less documentation pages follows modern design standards. Long-form prose content reads best at 60-80 characters per line. The current implementation is intentional and correct.

---

### 2. Grid View Recipient Auto-Selection Bug

**Current Behavior:**
- Auto-selection code exists in `AddLootEntryModal.tsx:165-179`
- It finds the top priority player from `sortedRecipients`
- But the dropdown shows `visibleRecipients` (filtered list)
- When no one "needs" the item, dropdown is empty but auto-selection still runs

**Root Cause:** The auto-selection and visible recipients filtering are disconnected.

**Solution:** When auto-selecting, use the first player from `visibleRecipients` instead of `sortedRecipients`. If `visibleRecipients` is empty and not showing all players, auto-enable "Show all players" or select from the full list.

---

### 3. Include Subs Logic Improvement

**Current Behavior:**
- "Include Subs" only adds subs to the pool
- If no main roster players need the item, subs don't show unless "Show all players" is also checked
- This is confusing

**New Logic (user's proposal):**
| Include Subs | Show All Players | Result |
|--------------|------------------|--------|
| ❌ | ❌ | Main roster who need item only |
| ✅ | ❌ | Main roster who need item + subs who need item. If none need it, show ONLY subs |
| ❌ | ✅ | All main roster (excluding subs) |
| ✅ | ✅ | Everyone (main + subs) |

**Implementation:** Update `visibleRecipients` filtering logic in `AddLootEntryModal.tsx` and `LogMaterialModal.tsx`.

---

### 4. Week Number Input Layout

**Current:** "Week" label on own line, full-width NumberInput below

**Problem:** Wastes vertical space, feels disconnected from Floor selector

**Solution:** Combine Week and Floor into a single row with inline layout:
```
[Floor: M9S ▼] [Week: 1 ▼]
```

Or make Week a compact inline element:
```
Week [1] [-][+]  Floor [M9S ▼]
```

**Decision:** Move Week inline with Floor selector as side-by-side compact inputs.

---

### 5. Notes Field Multiline Bug

**Current State:**
- `AddLootEntryModal.tsx` uses `<TextArea>` ✅
- `LogMaterialModal.tsx` uses `<Input>` ❌ (single-line only)
- `EditBookBalanceModal.tsx` uses `<Input>` ❌ (single-line only)

**Solution:** Replace `Input` with `TextArea` in both modals for consistency.

**Files to modify:**
- `frontend/src/components/history/LogMaterialModal.tsx`
- `frontend/src/components/history/EditBookBalanceModal.tsx`

---

### 6. Books Section Size Increase

**Current Styling:**
- Text: `text-xs` (12px)
- Week toggle buttons: `text-[10px]` (10px!)
- Column widths: `w-7` (28px)
- Sidebar width: `w-72` (288px)

**Problems:**
- 10px text is below accessibility guidelines (minimum 12px)
- Cramped columns make numbers hard to read
- No visual distinction between players

**Solution:**
- Increase table text to `text-sm` (14px)
- Increase week toggle buttons to `text-xs` (12px)
- Widen columns to `w-10` (40px)
- Add subtle row hover states
- Consider widening sidebar to `w-80` (320px)

**File to modify:** `frontend/src/components/history/SectionedLogView.tsx` (lines 943-1049)

---

### 7. Reset Dropdown Danger Styling

**Current:** Red trigger button, but dropdown items appear normal (except "Reset All Data")

**Problem:** Visual disconnect between danger trigger and normal-looking items

**Solution:** Style ALL dropdown items as dangerous:
- Add warning icon (⚠️ or trash icon) prefix to each item
- Use `text-status-error` for all items
- Add subtle `bg-status-error/5` hover background
- Keep "Reset All Data" even more emphasized (bold, darker red)

**File to modify:** `frontend/src/components/history/SectionedLogView.tsx` (lines 773-804)

---

### 8. Week Dropdown Design System Alignment

**Current:** Raw HTML `<select>` with custom styling

**Design System Select differences:**
- Missing focus ring (`ring-2 ring-accent/30`)
- Different background (`surface-raised` vs `surface-elevated`)
- No animation on open
- Browser-native dropdown

**Solution:** Replace with design system `Select` component while keeping the prev/next navigation arrows.

**File to modify:** `frontend/src/components/history/WeekSelector.tsx`

---

### 9. Tab/Subtab Structure Documentation

**Current patterns (intentionally different):**
- **Loot tab:** Subtabs inside section header (content variants)
- **Log tab:** Layout mode toggle at top, view mode toggle in content (fundamentally different layouts)
- **Party display:** Large in Grid view (primary editing), small in List header (summary only)

**Decision:** These differences are intentional and appropriate. Add documentation to DesignSystem.tsx explaining the rationale:

1. **Content variant tabs** - Same data, different visualization (Loot subtabs)
2. **Layout mode toggles** - Fundamentally different UI structure (Grid vs List)
3. **Context-appropriate sizing** - Primary interaction areas get prominence

---

### 10. Summary Page Visual Improvement

**Current Issues:**
- Plain numbers without visual hierarchy
- Monochromatic color scheme
- No icons or visual indicators
- Dense information without breathing room
- No interactive elements

**Solution - Visual Refresh:**

1. **Stat boxes with icons:**
   - Players: Users icon
   - BiS Complete: Percentage/target icon
   - Upgrades Needed: Wrench/tool icon
   - Weeks to BiS: Calendar icon

2. **Color-coded progress:**
   - 100% = green
   - 50-99% = accent/teal
   - <50% = default

3. **Progress bars for percentages**

4. **Material colors:**
   - Twine: `text-[#f97316]` (orange)
   - Glaze: `text-[#3b82f6]` (blue)
   - Solvent: `text-[#a855f7]` (purple)

5. **Increased spacing:**
   - `gap-6` between sections
   - `p-8` padding in main container

6. **Card styling with depth:**
   - Subtle shadows on stat boxes
   - Hover states with scale transform

**File to modify:** `frontend/src/components/team/TeamSummary.tsx`

---

## Implementation Plan

### Phase 1: Bug Fixes (High Priority)

**1.1 Fix recipient auto-selection in Grid view logging**
- File: `frontend/src/components/history/AddLootEntryModal.tsx`
- Lines: 165-179
- Change: Use `visibleRecipients[0]` for auto-selection, handle empty state

**1.2 Fix notes multiline support**
- File: `frontend/src/components/history/LogMaterialModal.tsx`
- Lines: 347-354
- Change: Replace `Input` with `TextArea`

- File: `frontend/src/components/history/EditBookBalanceModal.tsx`
- Lines: 93-99
- Change: Replace `Input` with `TextArea`

---

### Phase 2: UX Improvements (Medium Priority)

**2.1 Improve Include Subs logic**
- File: `frontend/src/components/history/AddLootEntryModal.tsx`
- Lines: 125-163
- Change: Implement hierarchical filtering logic

- File: `frontend/src/components/history/LogMaterialModal.tsx`
- Apply same logic changes

**2.2 Enlarge Books section**
- File: `frontend/src/components/history/SectionedLogView.tsx`
- Lines: 943-1049
- Changes:
  - `text-xs` → `text-sm` for table
  - `text-[10px]` → `text-xs` for toggle buttons
  - `w-7` → `w-10` for columns
  - Add hover states for rows

**2.3 Compact Week/Floor layout in modals**
- File: `frontend/src/components/history/AddLootEntryModal.tsx`
- File: `frontend/src/components/history/LogMaterialModal.tsx`
- Change: Move Week and Floor to same row

---

### Phase 3: Design System Consistency (Lower Priority)

**3.1 Style Reset dropdown items as dangerous**
- File: `frontend/src/components/history/SectionedLogView.tsx`
- Lines: 788-803
- Change: Add warning icons, use `text-status-error` for all items

**3.2 Replace Week selector with design system Select**
- File: `frontend/src/components/history/WeekSelector.tsx`
- Change: Use `<Select>` component, keep arrows

---

### Phase 4: Summary Page Refresh (Medium Priority)

**4.1 Add icons to stat boxes**
- File: `frontend/src/components/team/TeamSummary.tsx`
- Add lucide-react icons: Users, Target, Wrench, Calendar

**4.2 Add progress bars**
- Use existing ProgressBar component or create inline

**4.3 Color-code materials**
- Twine: orange, Glaze: blue, Solvent: purple

**4.4 Improve spacing and visual hierarchy**
- Increase padding and gaps
- Add subtle shadows/depth

---

### Phase 5: Documentation

**5.1 Document tab patterns in DesignSystem.tsx**
- Add "Navigation Patterns" section
- Explain when to use each pattern
- Include examples

---

## Files to Modify

| File | Changes |
|------|---------|
| `AddLootEntryModal.tsx` | Auto-selection fix, Include Subs logic, Week/Floor layout |
| `LogMaterialModal.tsx` | Notes TextArea, Include Subs logic, Week/Floor layout |
| `EditBookBalanceModal.tsx` | Notes TextArea |
| `SectionedLogView.tsx` | Books section sizing, Reset dropdown styling |
| `WeekSelector.tsx` | Design system Select component |
| `TeamSummary.tsx` | Visual refresh with icons, colors, progress bars |
| `DesignSystem.tsx` | Tab pattern documentation |

---

## Verification

```bash
# Type check
pnpm tsc --noEmit

# Run tests
pnpm test

# Visual verification:
# 1. Log Material modal - notes accepts multiline, Week/Floor compact
# 2. Grid view - recipient auto-selects correctly
# 3. Include Subs - shows subs when no main roster eligible
# 4. Books section - readable at text-sm size
# 5. Reset dropdown - all items look dangerous
# 6. Week selector - uses design system styling
# 7. Summary page - visually appealing with icons and colors
```

---

## Success Criteria

1. ✅ All notes fields support multiline text
2. ✅ Grid view auto-selects highest priority recipient
3. ✅ Include Subs shows subs when appropriate
4. ✅ Week/Floor inputs on same row (more compact)
5. ✅ Books section readable (14px minimum)
6. ✅ Reset dropdown items look dangerous
7. ✅ Week selector matches design system
8. ✅ Summary page visually improved
9. ✅ Tab patterns documented in DesignSystem
