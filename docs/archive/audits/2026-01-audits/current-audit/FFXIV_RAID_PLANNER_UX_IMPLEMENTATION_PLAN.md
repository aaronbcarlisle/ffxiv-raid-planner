# FFXIV Raid Planner UX Implementation Plan

**Date:** 2026-01-11  
**Author:** Aaron (prepared with Claude assistance)  
**Version:** 1.0  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Bug Fixes (Critical)](#bug-fixes-critical)
3. [UX Improvements](#ux-improvements)
4. [New Features](#new-features)
5. [High-Priority Parity Items](#high-priority-parity-items)
6. [Implementation Sessions](#implementation-sessions)
7. [Claude Code Prompt](#claude-code-prompt)

---

## Executive Summary

This document organizes 25+ items identified during manual QA audit into actionable tasks for Claude Code implementation. Items are categorized by type and priority, with specific implementation guidance and file locations.

### Quick Stats

| Category | Count | Estimated Sessions |
|----------|-------|-------------------|
| Critical Bugs | 3 | 1 session |
| UX Improvements | 12 | 3-4 sessions |
| New Features | 8 | 4-5 sessions |
| Parity Items | TBD | See audit doc |

---

## Bug Fixes (Critical)

### BUG-001: Session Timeout / Authentication Error on Page Idle

**Symptom:** After staying on a page for an extended period, interactions fail with "not a member" or "private" errors. Refreshing immediately fixes it without re-login.

**Root Cause Analysis:** This is likely a JWT token expiration issue where:
1. The token expires while the page is idle
2. The frontend doesn't detect the expiration until an action is attempted
3. The refresh mechanism isn't triggering properly on 401/403 responses

**Files to Check:**
- `frontend/src/stores/authStore.ts` - Token refresh logic
- `frontend/src/lib/api.ts` - API interceptor for 401 handling
- `backend/app/routers/auth.py` - Token validation

**Fix Strategy:**
1. Add a token expiration check before API calls
2. Implement proactive token refresh 5 minutes before expiry
3. Add 401/403 interceptor that triggers silent refresh
4. If refresh fails, redirect to login gracefully

**Priority:** CRITICAL - breaks user workflow

---

### BUG-002: Duplicate "View As" Banners

**Symptom:** When an admin uses "View As" feature, two identical banners appear stacked.

**Root Cause:** Two components render the same banner:
1. `components/admin/ViewAsBanner.tsx` - rendered in `Layout.tsx` (line 10)
2. `components/admin/AdminBanners.tsx` - rendered in `GroupView.tsx` (line 561)

**Fix:**
Remove the View As banner from ONE location. Recommendation: Keep it in `ViewAsBanner.tsx` (Layout level) and remove from `AdminBanners.tsx`.

```tsx
// AdminBanners.tsx - REMOVE the viewAsUser conditional block (lines 38-60)
// Keep only the isAdminAccess banner
```

**Files:**
- `frontend/src/components/admin/AdminBanners.tsx`
- `frontend/src/components/layout/Layout.tsx`

**Priority:** HIGH - visual glitch, confusing UX

---

### BUG-003: Focus Ring Artifacts on Keyboard Shortcuts

**Symptom:** After using keyboard shortcuts (e.g., Alt+L to open Log Loot modal), focus rings appear on unexpected elements like the close button (X) or gear slots.

**Root Cause:** Keyboard shortcuts use `element.focus()` or `element.click()` programmatically, triggering browser focus states.

**Fix Strategy:**
1. Use `:focus-visible` instead of `:focus` for focus styling (only shows on keyboard navigation, not programmatic focus)
2. Add `focus({ preventScroll: true })` with `blur()` after programmatic actions
3. Or add `tabindex="-1"` to elements that shouldn't receive visible focus from shortcuts

**Files to Check:**
- `frontend/src/index.css` - Global focus styles
- `frontend/src/components/ui/Modal.tsx` - Modal focus management
- Any component with `.focus()` calls

**CSS Fix:**
```css
/* Replace all :focus with :focus-visible for decorative focus rings */
button:focus-visible {
  @apply ring-2 ring-accent ring-offset-2;
}
```

**Priority:** MEDIUM - visual polish issue

---

## UX Improvements

### UX-001: Move Shortcuts from Inline to Tooltips

**Current:** Menu items show shortcuts inline (e.g., "Add Player Alt+Shift+P")  
**Problem:** Text is too long, clutters menu items  
**Solution:** Show shortcuts as tooltips on hover

**Affected Components (Coverage List):**
1. `components/ui/SettingsPopover.tsx` - Static actions menu
2. `components/primitives/Dropdown.tsx` - DropdownItem shortcut prop
3. `components/player/PlayerOptionsMenu.tsx` - Player card context menu
4. `components/ui/ContextMenu.tsx` - Right-click menus
5. `components/layout/Header.tsx` - Any header menus

**Implementation:**
```tsx
// Update DropdownItem to use Tooltip for shortcut
{shortcut && (
  <Tooltip content={`Shortcut: ${shortcut}`} side="right">
    <span className="ml-auto text-xs text-text-muted">⌨️</span>
  </Tooltip>
)}
```

**Priority:** MEDIUM - declutters UI

---

### UX-002: Tips & Tricks Modal Redesign

**Current:** Cycling tips in header, dismissable with X  
**Changes Requested:**
1. Move to bottom footer area
2. Click opens modal with ALL tips (not cycling)
3. Filter tips by user permission level
4. Remove dismissability (always visible)

**New Component:** `TipsAndTricksModal.tsx`

**Implementation:**
1. Create modal with categorized grid layout
2. Pass user role to filter tips
3. Move TipsCarousel to footer position
4. Remove X button / localStorage dismissal

**Files:**
- `frontend/src/components/ui/TipsCarousel.tsx` - Refactor to footer trigger
- `frontend/src/components/ui/TipsAndTricksModal.tsx` - New modal
- `frontend/src/components/layout/Footer.tsx` - Add tip trigger

**Priority:** LOW - nice to have

---

### UX-003: Keyboard Shortcuts Modal Redesign

**Current:** Vertical list layout  
**Desired:** Grid/column layout like Unreal Engine hotkey cheat sheet

**Reference:** Screenshot 2026-01-10 173023.png (Unreal Engine style)

**Implementation:**
```tsx
// KeyboardShortcutsHelp.tsx - Use CSS Grid
<div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
  {SHORTCUT_GROUPS.map((group) => (
    <div key={group.title} className="bg-surface-elevated p-4 rounded-lg">
      <h3 className="font-bold text-accent mb-3 border-b border-border-default pb-2">
        {group.title}
      </h3>
      <div className="space-y-1 text-sm">
        {group.shortcuts.map((s) => (
          <div key={s.key} className="flex justify-between gap-2">
            <span className="text-text-secondary">{s.description}</span>
            <kbd className="font-mono bg-surface-card px-1 rounded">
              {s.key}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  ))}
</div>
```

**Priority:** MEDIUM - improves discoverability

---

### UX-004: Modal Headers - Add Icons

**Current:** Some modals have plain text titles  
**Desired:** All modals have icon + title in header

**Audit Required:** Check all modals for consistency:
- Log Loot Drop ✓ (has icon?)
- Mark Floor Cleared
- Add Player
- New Tier
- Static Settings
- Delete confirmation dialogs
- etc.

**Implementation Pattern:**
```tsx
<Modal 
  title={
    <span className="flex items-center gap-2">
      <Icon className="w-5 h-5" />
      Modal Title
    </span>
  }
>
```

**Priority:** LOW - visual consistency

---

### UX-005: Replace Native Prompts with Custom Modals

**Current:** Some confirmations use `window.confirm()` or `window.prompt()`  
**Desired:** All prompts use custom styled modals

**Search for:**
```bash
grep -rn "window.confirm\|window.prompt\|alert(" src/
```

**Create:** `ConfirmDialog.tsx` reusable component if not exists

**Priority:** MEDIUM - polish

---

### UX-006: Shift+S Goes to Home Instead of Dashboard

**Current:** Shift+S navigates to `/` (home)  
**Desired:** Shift+S navigates to `/statics` (My Statics dashboard)

**File:** `frontend/src/hooks/useKeyboardShortcuts.ts` or `useGroupViewKeyboardShortcuts.ts`

**Fix:** Update the navigation action

**Priority:** HIGH - documented shortcut doesn't work as expected

---

### UX-007: Shift+Click Copy Link Inconsistency

**Current:** Shift+click works on player cards but not release notes  
**Desired:** Consistent behavior on all linkable items

**Affected Items:**
- ✅ Player cards
- ❌ Release notes
- Check: Loot log entries, gear items, etc.

**Implementation:** Add shift+click handler to `ReleaseNotes.tsx`

**Priority:** LOW - consistency

---

### UX-008: Update Right-Click Menu Text

**Current:** "Go to Loot Entry" / "Go to PlayerName"  
**Desired:** "Jump to Loot Entry" / "Jump to PlayerName" with job icon

**Files:**
- `components/history/LogEntryItems.tsx`
- `components/history/SectionedLogView.tsx`
- Any context menu definitions

**Priority:** LOW - minor wording

---

### UX-009: Add "Linked to X" Tag in Priority Lists

**Current:** Player cards show "Linked to X" tag  
**Desired:** Same tag appears in:
- All logged loot entries
- Gear Priority tab player lists
- Weapon Priority tab player lists
- Recipient dropdowns in modals

**Implementation:** Add `linkedPlayerName` to player display components

**Priority:** MEDIUM - improves context

---

### UX-010: Add Hotkey Toggle (Disable All Shortcuts)

**Desired:** Option in Keyboard Shortcuts modal to disable all hotkeys  
**Use Case:** Users who prefer mouse-only or have conflicting browser shortcuts

**Implementation:**
1. Add state to `authStore` or localStorage: `shortcutsEnabled`
2. Add toggle switch in `KeyboardShortcutsHelp.tsx`
3. Check flag in `useKeyboardShortcuts` hook

**Priority:** LOW - accessibility enhancement

---

### UX-011: Floor/Show Filters Hotkeys in Loot Tab

**Desired:** Keyboard shortcuts for floor selection in Loot tab

**Suggested Mappings:**
- `F1-F4` = Select floors (M9S-M12S)
- `Shift+1-4` = Toggle role filters

**Priority:** LOW - power user feature

---

### UX-012: Reset All Data Shortcut

**Desired:** `Shift+Ctrl+Alt+R` opens Reset All Data prompt

**Priority:** LOW - dangerous action, probably shouldn't be easy to trigger

**My Recommendation:** Skip this one - accidental triggers could cause data loss. Keep as menu-only action.

---

## New Features

### FEAT-001: Admin Super-User Menu

**Trigger:** Shift+Left Click on Roster Menu (as Lead/Owner)

**Actions:**
1. **Auto Fill Empty Slots**
   - Find all unconfigured player slots
   - Create default player cards for empty slots
   - Handle both role-based and normal slots

2. **Import BiS for All**
   - Confirmation modal explaining the action
   - For each player: find first BiS preset, import it
   - Show progress indicator
   - Auto-confirm all changes

**Implementation:**
1. Add shift+click handler to Roster tab header/menu
2. Create `AdminSuperMenu.tsx` context menu component
3. Implement batch operations in `tierStore` or new utility

**Files:**
- `pages/GroupView.tsx` - Add shift+click handler
- `components/ui/AdminSuperMenu.tsx` - New component
- `stores/tierStore.ts` - Batch operations

**Priority:** MEDIUM - admin productivity

---

### FEAT-002: Progress Wheel Quick Actions

**Trigger:** Shift+Right Click on Progress Wheel (player card)

**Actions:**
- **Mark All Obtained** (for card owner only)
  - Sets `hasItem: true` for all gear slots
  - Sets `isAugmented: true` for all tome slots
  - Confirmation dialog first

**Implementation:**
```tsx
// Add context menu to progress wheel
<ProgressWheel
  onContextMenu={(e) => {
    if (e.shiftKey && isOwner) {
      showQuickActionsMenu(e);
    }
  }}
/>
```

**Priority:** LOW - convenience feature

---

### FEAT-003: Floor Section Right-Click Menu (Log > Grid View)

**Trigger:** Right-click on floor section header in Log Grid view

**Menu Options:**
- **Log Floor Loot** - Opens sequential modals for each gear/material cell
- **Log Floor Books** - Opens "Mark Floor Cleared" with floor pre-selected
- **Reset Floor Loot** (danger) - Clears all loot entries for that floor

**Implementation:**
1. Add context menu handler to floor section component
2. Create sequential logging wizard component
3. Add reset confirmation dialog

**Priority:** MEDIUM - workflow improvement

---

### FEAT-004: "Log Week" Button on Floor Headers

**Behavior:**
- Appears on hover over floor section header
- Click shows either:
  - Combined prompt with all loot for floor (defaults filled by priority)
  - Step-by-step wizard through each loot item + books option

**My Recommendation:** Implement as wizard (step-by-step) for better UX - less overwhelming than one giant form.

**Priority:** MEDIUM - raid night workflow

---

### FEAT-005: G Shortcut for Dashboard Grid/List Toggle

**Desired:** `G` key toggles grid/list view on My Statics dashboard page

**Files:**
- `pages/Dashboard.tsx` - Add keyboard shortcut
- `hooks/useKeyboardShortcuts.ts`

**Priority:** LOW - consistency with GroupView

---

### FEAT-006: Admin Player Card Assignment

**Current Issue:** When "Viewing as X", admin cannot take ownership of cards (403 error: "You are already linked to another player")

**Solution Options:**
1. Admin-only "Assign User" action in player options menu
2. When viewing as a user without a card, allow claiming
3. Special admin override for card assignment

**Implementation:**
- Add API endpoint: `POST /players/{id}/assign` (admin only)
- Add UI in player options menu
- Show confirmation with user search/select

**Priority:** HIGH - admin workflow blocker

---

### FEAT-007: Update "Design Language in Transition" Message

**Desired:** Complete the in-app message about design system changes  
**Action:** Review commit history and update the message content

**File:** Check release notes or app notifications

**Priority:** LOW - documentation

---

### FEAT-008: Permission-Aware Tips Filtering

**Requirement:** Tips should not show shortcuts the user can't use

**Example:** Members shouldn't see "Alt+Shift+S opens static settings" tip

**Implementation:**
```tsx
// TipsCarousel.tsx
const filteredTips = TIPS.filter(tip => {
  if (tip.requiresPermission && !hasPermission(userRole, tip.requiresPermission)) {
    return false;
  }
  return true;
});
```

**Priority:** MEDIUM - prevents confusion

---

## High-Priority Parity Items

Reference: `docs/audits/2026-01-02-ffxiv-raid-planner-parity-audit.md`

### From Section 7 (Recommendations - High Priority)

1. **Add loot/page adjustment UI**
   - `lootAdjustment` and `pageAdjustments` fields exist but have no UI
   - Add inline edit to player card header

2. **Material tracking improvements**
   - Track received materials (subtract from need)
   - Show net material balance

3. **iLv display per slot** (if not already implemented)
   - Show item level in gear table
   - Color-code by gear source category

4. **Loot count mode toggle**
   - Option to use "lowest loot count wins" priority
   - Alternative to current weighted algorithm

---

## Implementation Sessions

### Recommended Session Structure

**Session 1: Critical Bug Fixes (Use Opus)**
- BUG-001: Session timeout
- BUG-002: Duplicate banners
- BUG-003: Focus ring artifacts

**Session 2: Shortcut System Overhaul (Use Sonnet)**
- UX-001: Shortcuts to tooltips
- UX-003: Shortcuts modal redesign
- UX-006: Fix Shift+S navigation
- UX-010: Add hotkey toggle

**Session 3: Menu System Enhancements (Use Sonnet)**
- FEAT-001: Admin super-user menu
- FEAT-003: Floor section context menu
- UX-008: Update menu text wording

**Session 4: Tips & Tricks + Modal Polish (Use Sonnet)**
- UX-002: Tips modal redesign
- UX-004: Modal header icons
- UX-005: Replace native prompts
- FEAT-008: Permission-aware tips

**Session 5: Advanced Features (Use Opus for complex logic)**
- FEAT-002: Progress wheel actions
- FEAT-004: Log Week wizard
- FEAT-006: Admin player assignment

**Session 6: Parity & Polish (Use Sonnet)**
- UX-007: Shift+click consistency
- UX-009: Linked tags everywhere
- Parity items as time allows

### Model Selection Guide

| Task Type | Recommended Model | Rationale |
|-----------|------------------|-----------|
| Complex state management | Opus | Better at architectural decisions |
| Authentication/security | Opus | Needs careful reasoning |
| Simple component changes | Sonnet | Fast, efficient |
| CSS/styling updates | Sonnet | Straightforward patterns |
| Multi-file refactors | Opus | Better context handling |
| New utility functions | Sonnet | Clear, well-defined |
| Bug fixes with root cause analysis | Opus | Better debugging |
| Copy/text changes | Sonnet | Simple edits |

---

## Claude Code Prompt

Below is the prompt to provide to Claude Code for each session.

---

### SESSION START PROMPT

```markdown
# FFXIV Raid Planner - UX Implementation Session

## Project Context

You're working on the FFXIV Raid Planner, a web app for FFXIV static raid groups to track gear progression and loot distribution.

**Stack:** React + TypeScript + Zustand + TailwindCSS (frontend), FastAPI + SQLite (backend)

**Key Documentation:**
- `CLAUDE.md` - Project conventions, patterns, and file locations
- `docs/audits/2026-01-02-ffxiv-raid-planner-parity-audit.md` - Spreadsheet parity audit

**IMPORTANT RULES:**
1. Never add AI attribution to commits
2. Use design system tokens (not hardcoded colors)
3. Follow existing patterns in codebase
4. Run `./frontend/scripts/check-design-system.sh` after styling changes

## Session Tasks

[INSERT TASKS FOR THIS SESSION]

## Implementation Order

1. Read `CLAUDE.md` first to understand project structure
2. Check existing implementations before creating new patterns
3. Make atomic commits with clear messages
4. Test changes in browser before moving to next task

## Key File Locations

- **Auth/API:** `stores/authStore.ts`, `lib/api.ts`
- **Modals:** `components/ui/Modal.tsx`
- **Context Menus:** `components/ui/ContextMenu.tsx`
- **Dropdowns:** `components/primitives/Dropdown.tsx`
- **Keyboard Shortcuts:** `hooks/useKeyboardShortcuts.ts`
- **Tips:** `components/ui/TipsCarousel.tsx`
- **Admin Banners:** `components/admin/AdminBanners.tsx`, `ViewAsBanner.tsx`
- **GroupView:** `pages/GroupView.tsx` + extracted hooks in `hooks/useGroupView*.ts`

## Design System Tokens

```css
/* Colors - NEVER use hex values directly */
text-text-primary    /* Main text */
text-text-secondary  /* Secondary text */
text-text-muted      /* Muted/disabled */
text-accent          /* Teal accent (#14b8a6) */
bg-surface-card      /* Card backgrounds */
bg-surface-elevated  /* Elevated surfaces */
bg-surface-interactive /* Hover states */
border-border-default /* Standard borders */
text-status-error    /* Error/danger */
text-status-warning  /* Warning */
text-status-success  /* Success */
```

## Verification Steps

After each change:
1. Check browser for visual correctness
2. Test keyboard navigation
3. Test on narrow viewport
4. Run design system check script
5. Ensure no TypeScript errors

Ready to begin implementation.
```

---

## Appendix: Reference Images

| File | Description |
|------|-------------|
| Screenshot 2026-01-10 173023.png | Desired keyboard shortcuts layout (Unreal Engine style) |
| Screenshot 2026-01-10 173117.png | Current keyboard shortcuts layout (vertical list) |
| Screenshot 2026-01-10 174719.png | Focus ring bug on modal close button |
| Screenshot 2026-01-10 181045.png | Inline shortcuts cluttering menu |
| Screenshot 2026-01-10 183111.png | Focus ring bug on player card gear slot |
| Screenshot 2026-01-11 041624.png | Duplicate View As banners |

---

**End of Implementation Plan**
