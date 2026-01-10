# Session Handoff: Design System Fixes

**Date:** 2026-01-09
**Branch:** `feature/design-system-migration`
**PR:** https://github.com/aaronbcarlisle/ffxiv-raid-planner-dev/pull/15

## Current State

Design system migration is largely complete with PR #15 submitted. However, testing revealed several UI/UX issues that need to be addressed before merging.

### Completed Work
- Created `RadioGroup` and `NumberInput` components
- Migrated 20+ components from raw HTML to design system components
- Added `scripts/check-design-system.sh` lint enforcement
- Fixed Select empty value error (Radix compatibility)
- Fixed Modal horizontal scrollbar
- Fixed Button text wrapping (`whitespace-nowrap`)

## Outstanding Issues

### Issue 1: Create Invitation Link Button Styling
**Location:** `frontend/src/components/static-group/InvitationsPanel.tsx`
**Problem:** The "+ Create Invitation Link" button uses `variant="ghost"` which makes it look like floating text instead of a proper button.
**Fix:** Change to `variant="secondary"` or create a new button variant with a visible border/background.

### Issue 2: Danger Button Hover State
**Location:** `frontend/src/components/primitives/Button.tsx`
**Problem:** The `danger` variant has a teal focus ring that clashes with the red color scheme. Screenshot shows "Delete Static" button with teal highlight.
**Fix:** Update the danger variant to use `focus:ring-status-error/50` instead of the default teal focus ring.

### Issue 3: Share Link Input Not Full Width
**Location:** `frontend/src/components/static-group/GroupSettingsModal.tsx`
**Problem:** The Share Link input field doesn't expand to fill the modal width. There's extra space between the input and the Copy button.
**Fix:** Ensure the input has `flex-1` and the container uses proper flex layout.

### Issue 4: Week Dropdown Over-Expanding
**Location:** `frontend/src/components/history/QuickLogDropModal.tsx` (or similar)
**Problem:** The Week dropdown in the Log Loot modal expands too wide horizontally.
**Fix:** Add a max-width constraint to the dropdown or use a fixed-width container.

### Issue 5: CRITICAL - Click Lock After Dropdown Selection
**Location:** `frontend/src/components/ui/Select.tsx`
**Problem:** After making a selection from a dropdown, the entire app becomes unresponsive to clicks. Only Escape key works. Requires page refresh.
**Likely Cause:** The `usePreventScrollLock` hook is leaving stale event listeners or body styles that block pointer events.
**Fix:** Debug the scroll-lock prevention logic. Check that cleanup runs properly on close.

### Issue 6: Reset Dropdown Styling
**Location:** `frontend/src/components/history/SectionedLogView.tsx`
**Problem:** The Reset dropdown trigger looks like a normal button despite containing destructive actions. The dropdown content has a red border but the trigger button doesn't indicate danger.
**Fix:** Style the Reset dropdown trigger with danger colors (red text, red border on hover).

### Issue 7: Page Layout Not Applied
**Location:** Multiple pages
**Problem:** The design system page shows a specific page layout pattern (Data-First Layout Anatomy with Header Zone, Toolbar Zone, Content Zone) that isn't consistently applied across the app.
**Reference:** See `/design-system` page > Page Layout section for the correct pattern.
**Fix:** Audit all pages and apply the consistent layout structure.

### Issue 8: URL Navigation for User Docs
**Location:** `frontend/src/pages/MembersGuideDocs.tsx`, `frontend/src/pages/LeadsGuideDocs.tsx`, etc.
**Problem:** Navigation anchors in user documentation don't update the URL, making it impossible to share direct links to specific sections.
**Fix:** Add hash-based URL updates when clicking navigation items (similar to Release Notes page).

### Issue 9: Comprehensive Design System Audit
**Problem:** Need a thorough review of ALL UI elements against the design system page to ensure consistent styling.
**Action Items:**
- Review all Button variants and ensure consistent styling
- Check all form inputs match design system specs
- Verify color tokens are used consistently (no hardcoded colors)
- Ensure spacing and typography follow the type scale
- Check that all modals follow the Modal pattern
- Verify tables, badges, tooltips match design system

## Key Files to Review

| File | Issues |
|------|--------|
| `components/primitives/Button.tsx` | #2 (danger hover) |
| `components/ui/Select.tsx` | #5 (click lock - CRITICAL) |
| `components/static-group/InvitationsPanel.tsx` | #1 (button styling) |
| `components/static-group/GroupSettingsModal.tsx` | #3 (share link width) |
| `components/history/SectionedLogView.tsx` | #6 (reset dropdown) |
| `components/history/QuickLogDropModal.tsx` | #4 (week dropdown width) |
| `pages/MembersGuideDocs.tsx` | #8 (URL navigation) |
| `pages/DesignSystem.tsx` | Reference for #7, #9 |

## Commands

```bash
# Start dev servers
./dev.sh

# Type check
cd frontend && pnpm tsc --noEmit

# Run design system compliance check
./frontend/scripts/check-design-system.sh

# View the design system reference
# Navigate to http://localhost:5173/design-system
```

## Resume Session

To resume this session:
```bash
claude --resume 69c1a333-89a3-4f5d-8dc8-f4bc2b4d2290
```

---

## Continuation Prompt

Copy and paste this prompt to continue the work:

```
I'm continuing work on the FFXIV Raid Planner design system migration.

Read the session handoff at: frontend/docs/SESSION_HANDOFF_design-system-fixes.md

There are 9 outstanding issues to address, with Issue #5 (click lock after dropdown selection) being CRITICAL.

Priority order:
1. Fix Issue #5 (click lock) - this is a blocking bug
2. Fix Issue #2 (danger button hover) - visual clash
3. Fix Issue #1 (invitation button styling)
4. Fix Issue #3 (share link width)
5. Fix Issue #4 (week dropdown width)
6. Fix Issue #6 (reset dropdown styling)
7. Address Issue #7 (page layout consistency)
8. Address Issue #8 (URL navigation for docs)
9. Address Issue #9 (comprehensive design system audit)

Start by investigating Issue #5 - the Select component's usePreventScrollLock hook is likely leaving stale pointer-events styles on the body after the dropdown closes.

Branch: feature/design-system-migration
PR: https://github.com/aaronbcarlisle/ffxiv-raid-planner-dev/pull/15
```
