# Session Handoff: Focus Ring Artifact Fixes

**Date:** 2026-01-11
**Branch:** `feature/ux-improvements-v1.0.8`
**Session Focus:** BUG-003 - Fix focus ring artifacts from keyboard shortcuts and Shift+Click actions

---

## ✅ What Was Completed

### Fixed: BUG-003 - Focus Ring Artifacts

**Problem:** White focus ring outlines appeared when:
1. Opening modals via keyboard shortcuts (Alt+L, Alt+M)
2. Using Shift+Click to copy links (player cards, loot entries)
3. Flash during mousedown, persistent after release

**Root Cause:**
- Modals auto-focused the first focusable element (close button)
- Keyboard shortcuts with modifier keys were treated as "keyboard navigation" by browser
- Shift+Click caused mousedown focus before blur() could execute

### Implementation (4 Commits)

#### Commit 1: `54e5559` - CSS Focus-Visible Approach
```
fix(ux): replace focus: with focus-visible: to prevent focus ring artifacts
```
- Updated 9 components: Input, Select, TextArea, NumberInput, etc.
- Changed `focus:` to `focus-visible:` in CSS classes
- **Result:** Didn't fully solve the issue (modifier keys still triggered focus-visible)

#### Commit 2: `02af764` - Smart Modal Focus + Blur Strategy
```
fix(ux): prevent focus rings on modal close buttons and after Shift+Click
```
- **Modal.tsx**: Changed initial focus logic
  - OLD: Focus first focusable element (often close button)
  - NEW: Prefer first form field (input/select/textarea), fallback to modal container
- **PlayerCard.tsx**: Added `blur()` after Shift+Click copy action
- **Result:** Modals now focus Week input or Floor selector instead of close button

#### Commit 3: `c5445a7` - Prevent Text Selection
```
fix(ux): prevent text selection when Shift+Clicking to copy links
```
- Added `select-none` CSS class to:
  - PlayerCard.tsx
  - WeeklyLootGrid.tsx (loot and material cells)
- **Result:** No more random text highlighting when Shift+Clicking

#### Commit 4: `3b7b1a3` - Eliminate Focus Flash
```
fix(ux): eliminate focus ring flash during Shift+Click
```
- Added `onMouseDown` handlers that call `preventDefault()` when Shift is held
- Prevents focus from happening during the mousedown event
- Applied to:
  - PlayerCard.tsx
  - WeeklyLootGrid.tsx (loot and material cells)
- **Result:** No flash, even when holding Shift+Click down

---

## 📁 Files Modified

```
frontend/src/components/ui/Modal.tsx
frontend/src/components/player/PlayerCard.tsx
frontend/src/components/player/InlinePlayerEdit.tsx
frontend/src/components/player/JobPicker.tsx
frontend/src/components/history/WeeklyLootGrid.tsx
frontend/src/components/static-group/MembersPanel.tsx
frontend/src/components/ui/Input.tsx
frontend/src/components/ui/Select.tsx
frontend/src/components/ui/TextArea.tsx
frontend/src/components/ui/NumberInput.tsx
frontend/src/components/ui/SortModeSelector.tsx
frontend/src/index.css
```

---

## ✅ Verification Status

**Tested and Working:**
- ✅ Alt+L opens Log Loot modal → Week input focused (NOT close button)
- ✅ Alt+M opens Log Material modal → Floor selector focused (NOT close button)
- ✅ Shift+Click player card → Link copied, no flash, no ring, no text selection
- ✅ Shift+Click loot entries → Link copied, no flash, no ring, no text selection
- ✅ Holding Shift+Click down → No ring appears at all
- ✅ Normal Tab navigation → Focus rings still work correctly

---

## 📋 Next Steps (Outstanding UX Audit Items)

From `docs/implementation/ux-audit/FFXIV_RAID_PLANNER_UX_IMPLEMENTATION_PLAN.md`:

### Already Completed
- ✅ BUG-002: Duplicate "View As" banners (already fixed in codebase)
- ✅ BUG-003: Focus ring artifacts (completed this session)

### High Priority Remaining
1. **UX-006**: Fix Shift+S navigation (goes to `/` instead of `/statics`)
   - File: `hooks/useGroupViewKeyboardShortcuts.ts`
   - Quick fix: Update navigation path

2. **FEAT-006**: Admin Player Card Assignment
   - Admins can't assign users to players when using "View As"
   - Needs backend endpoint + UI in player options menu
   - **Priority:** HIGH (admin workflow blocker)

3. **UX-005**: Replace Native Prompts with Custom Modals
   - Search for: `window.confirm`, `window.prompt`, `alert()`
   - Create reusable `ConfirmDialog.tsx` if needed

### Medium Priority
4. **UX-001**: Move Shortcuts from Inline to Tooltips
   - Components: `SettingsPopover.tsx`, `Dropdown.tsx`, menus
   - Show keyboard icon + tooltip instead of inline text

5. **UX-003**: Keyboard Shortcuts Modal Redesign
   - File: `components/ui/KeyboardShortcutsHelp.tsx`
   - Current: Vertical list
   - Desired: Grid layout (Unreal Engine style)
   - Reference: `Screenshot 2026-01-10 173023.png`

6. **FEAT-003**: Floor Section Context Menu (Log > Grid View)
   - Right-click floor header
   - Options: Log Floor Loot, Log Floor Books, Reset Floor Loot

7. **FEAT-008**: Permission-Aware Tips Filtering
   - File: `components/ui/TipsCarousel.tsx`
   - Filter tips based on user role (don't show shortcuts they can't use)

8. **UX-009**: Add "Linked to X" Tags Everywhere
   - Priority lists, recipient dropdowns, loot entries
   - Already works on player cards

### Low Priority
9. **UX-004**: Modal Header Icons Audit
10. **UX-007**: Shift+Click Copy Link Consistency (check all linkable items)
11. **UX-008**: Update Menu Text ("Go to" → "Jump to")
12. **FEAT-005**: G Shortcut for Dashboard Grid/List Toggle

### Skip / Not Recommended
- UX-012: Reset All Data Shortcut (dangerous)
- UX-011: Floor filter hotkeys (over-optimization)

---

## 🔍 Investigation Needed

### BUG-001: Session Timeout / Authentication Error (STILL OUTSTANDING)
**Symptom:** After idle time, actions fail with "not a member" errors; refresh fixes it without re-login

**Analysis Done:**
- ✅ Checked `authStore.ts` - has token refresh logic
- ✅ Checked `services/api.ts` - `authRequest()` handles 401 with automatic refresh
- ✅ All stores use proper `authRequest` wrapper

**Appears to be implemented**, but user hasn't confirmed if issue still occurs. May need manual testing or reproduction steps.

**Files to investigate if issue persists:**
- `frontend/src/stores/authStore.ts` - Token refresh mechanism
- `frontend/src/services/api.ts` - 401 interceptor
- `backend/app/routers/auth.py` - Token validation

---

## 🛠️ Technical Details

### Modal Focus Strategy
```typescript
// Prefer form fields over buttons
const formField = focusable.find(el =>
  el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA'
);

if (formField) {
  formField.focus(); // Focus the Week input or Floor selector
} else {
  modalRef.current.focus(); // Focus modal container (tabindex=-1, no visible ring)
}
```

### Shift+Click Prevention Pattern
```typescript
// Prevent focus on mousedown
const handleMouseDown = (e: React.MouseEvent) => {
  if (e.shiftKey && onCopyUrl) {
    e.preventDefault(); // Stops focus from happening
  }
};

// Clean up on click
const handleCardClick = (e: React.MouseEvent) => {
  if (e.shiftKey && onCopyUrl) {
    e.preventDefault();
    window.getSelection()?.removeAllRanges(); // Clear selection
    onCopyUrl();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur(); // Remove any residual focus
    }
  }
};
```

---

## 📊 Project State

**TypeScript:** ✅ No errors
**ESLint:** ⚠️ Pre-existing warnings (unrelated to changes)
**Git Status:** Clean (all commits pushed to `feature/ux-improvements-v1.0.8`)

**Commands:**
```bash
./dev.sh              # Start dev servers
pnpm tsc --noEmit     # Type check
pnpm lint             # Lint check
```

---

## 🎯 Recommended Next Session

Start with **UX-006** (Shift+S navigation fix) - it's a 5-minute fix that will provide immediate value.

Then tackle **FEAT-006** (Admin Player Assignment) - high priority admin workflow blocker.

---

**End of Handoff**
