# UX/UI Improvements Plan

**Created:** 2026-01-09
**Status:** Pending Implementation
**Branch:** (create new branch: `feature/ux-improvements`)

## Overview
Four UX improvements to enhance navigation consistency and user flow.

---

## Task 1: Unify Floor Selectors

**Goal:** Replace floor selectors in "Who Needs It" and "Log > By Floor" with the Gear Priorities style.

**Current State:**
- **Gear Priorities** (`LootPriorityPanel.tsx:395-420`): Colored button tabs using `FLOOR_COLORS`
- **Who Needs It** (`WhoNeedsItMatrix.tsx:105-130`): Similar but with "All" option - already close to target
- **Log > By Floor** (`SectionedLogView.tsx:748-765`): Toggle buttons without floor colors

**Changes:**
1. **`WhoNeedsItMatrix.tsx`**: Already uses `FLOOR_COLORS` - minor styling alignment
2. **`SectionedLogView.tsx`**: Replace toggle buttons with colored button tabs matching Gear Priorities

**Files to Modify:**
- `frontend/src/components/history/SectionedLogView.tsx` (primary change)
- `frontend/src/components/loot/WhoNeedsItMatrix.tsx` (verify consistency)

---

## Task 2: Add Navigation Panel to Release Notes

**Goal:** Add sidebar navigation for quick version jumping, matching other docs pages.

**Pattern Source:** `ApiDocs.tsx` NavSidebar implementation (lines 190-300)

**Changes:**
1. Add `NAV_GROUPS` constant generated from `RELEASES` array
2. Add `VersionNav` sidebar component with:
   - Sticky positioning
   - Scroll-based active section tracking
   - Version + date display
3. Update layout to flex container with sidebar + main content
4. Ensure responsive behavior (hide on mobile)

**Files to Modify:**
- `frontend/src/pages/ReleaseNotes.tsx`

---

## Task 3: Rename "Edit Static" to "Open Static"

**Goal:** Clarify the context menu action - you're opening the static, not editing metadata.

**Current:** `{ label: 'Edit Static', onClick: handleEditStatic }`

**Change to:** `{ label: 'Open Static', onClick: handleEditStatic }`

**Files to Modify:**
- `frontend/src/pages/Dashboard.tsx` (line ~230)

---

## Task 4: Smart Tab Defaulting on Context Switch

**Goal:** Default to Roster tab when:
- Switching to a different static
- Creating a new static/tier

Preserve current tab when:
- Refreshing the same page
- Returning via back button

**Implementation Approach:**

1. **Track "last visited static"** in localStorage: `last-static-id`
2. **On GroupView load:**
   - Compare `currentGroup.id` with `localStorage.getItem('last-static-id')`
   - If DIFFERENT: Force `pageMode` to `players`, clear URL tab param
   - If SAME: Use existing logic (URL > localStorage > default)
   - Update `last-static-id` to current
3. **After tier creation:**
   - In `GroupView.tsx` after `createTier()` succeeds
   - Call `setPageMode('players')` explicitly

**Files to Modify:**
- `frontend/src/pages/GroupView.tsx`
  - Add last-static-id comparison logic (~lines 64-92)
  - Add tier creation callback to reset tab

---

## Verification

1. **Floor Selectors:**
   - Navigate to Loot > Gear Priorities - note floor selector style
   - Navigate to Loot > Who Needs It - should match
   - Navigate to Log > List View > By Floor - should match

2. **Release Notes Navigation:**
   - Go to /docs/release-notes
   - Verify sidebar appears on desktop (lg: breakpoint)
   - Click version in sidebar → scrolls to that release
   - Scroll manually → sidebar updates active state

3. **Context Menu:**
   - Right-click a static on Dashboard
   - Verify "Open Static" appears (not "Edit Static")

4. **Tab Defaulting:**
   - Open Static A, go to Loot tab
   - Switch to Static B via dropdown → should land on Roster tab
   - Refresh page → should stay on Roster tab (or whichever you're on)
   - Create new tier → should land on Roster tab
   - Switch back to Static A → should land on Roster tab (not Loot)

---

## Files Summary

| File | Changes |
|------|---------|
| `frontend/src/components/history/SectionedLogView.tsx` | Replace floor toggles with colored buttons |
| `frontend/src/components/loot/WhoNeedsItMatrix.tsx` | Verify/align floor selector styling |
| `frontend/src/pages/ReleaseNotes.tsx` | Add sidebar navigation |
| `frontend/src/pages/Dashboard.tsx` | Rename "Edit Static" to "Open Static" |
| `frontend/src/pages/GroupView.tsx` | Add smart tab defaulting logic |

---

## UX Rationale

### Why "Fresh Start on Context Switch"?
- When switching statics, the user's intent is typically to view/manage that static's roster
- The Loot tab is useless without players configured
- This matches patterns from Gmail (switches to Inbox on account change) and Slack (shows general channel on workspace switch)

### Why Preserve on Refresh?
- Refresh is a "continue where I was" action
- Users expect state preservation after refresh
- Back button behavior should also preserve state
