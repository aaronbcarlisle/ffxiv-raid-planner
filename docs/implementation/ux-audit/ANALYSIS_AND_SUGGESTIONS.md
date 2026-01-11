# Analysis & Suggestions on UX Audit Items

**Date:** 2026-01-11  
**For:** Aaron's FFXIV Raid Planner

---

## Overview

After thoroughly examining your codebase and notes, here's my analysis with suggestions, concerns, and alternative approaches where applicable.

---

## Bug Analysis

### Session Timeout Issue (BUG-001) - **INVESTIGATE FIRST**

This is your most critical bug and needs root cause analysis before fixing. Possible causes:

1. **JWT Expiration Without Refresh**
   - Check `authStore.ts` for token refresh logic
   - Backend may be returning 401 but frontend isn't catching it

2. **WebSocket/Real-time Connection Drop**
   - If you have any WebSocket connections, they may be timing out

3. **Browser Tab Sleep/Throttling**
   - Modern browsers aggressively throttle background tabs
   - Timers and fetch requests can be delayed

**Recommendation:** Add console logging to API error handlers and reproduce the bug to capture the actual error response before attempting to fix.

### Duplicate Banners (BUG-002) - **Easy Fix**

The issue is clear: `ViewAsBanner` in Layout.tsx AND `AdminBanners` in GroupView.tsx both render when `viewAsUser` is present.

**My Recommendation:** Remove the `viewAsUser` banner from `AdminBanners.tsx` and keep only the "Admin Access" banner there. This is cleaner because:
- Layout-level banners are for global state (viewing as someone)
- Page-level banners are for page-specific context (admin access to this static)

### Focus Ring Artifacts (BUG-003) - **CSS Solution**

This is a common issue with programmatic focus. The modern solution:

```css
/* Only show focus rings on keyboard navigation */
*:focus:not(:focus-visible) {
  outline: none;
  box-shadow: none;
}
```

However, Tailwind already supports this with `focus-visible:` variants. You need to audit your components and change:
- `focus:ring-2` → `focus-visible:ring-2`
- `focus:outline-none` (leave as is, it removes default)

---

## UX Improvements - My Take

### Shortcuts to Tooltips (UX-001) - **AGREE with modification**

Moving shortcuts to tooltips is good, but consider:

1. **Discoverability Issue:** If shortcuts are hidden in tooltips, users may never find them
2. **Alternative:** Keep a small keyboard icon (⌨️) next to menu items that have shortcuts, tooltip shows the actual key combo

```tsx
// Suggested pattern
<MenuItem>
  <Icon />
  <Label>Add Player</Label>
  {shortcut && (
    <Tooltip content={shortcut}>
      <Keyboard className="w-3 h-3 text-text-muted" />
    </Tooltip>
  )}
</MenuItem>
```

### Tips & Tricks Redesign (UX-002) - **PARTIAL AGREE**

Moving to footer: ✅ Good - less intrusive
Modal with all tips: ✅ Good - better discoverability
Permission filtering: ✅ Essential
Remove dismissability: ⚠️ **DISAGREE**

**Concern:** Some users find tips annoying after they've learned the app. Consider:
- Keep dismissable, but add "Show tips again" in settings
- Or use a "new user" flag that shows tips for first 7 days only

### Keyboard Shortcuts Modal (UX-003) - **AGREE**

The grid layout reference (Unreal Engine style) is excellent. This is a significant usability improvement for a shortcuts-heavy app.

**Additional Suggestion:** Add a search/filter box at the top for users to quickly find a specific shortcut.

### Modal Headers with Icons (UX-004) - **AGREE**

Consistency is good. I'd suggest creating a standard pattern:

```tsx
// Create a standard modal header component
<ModalHeader icon={PlusCircle} title="Add Player" />
```

### Replace Native Prompts (UX-005) - **STRONGLY AGREE**

`window.confirm()` breaks immersion and looks unprofessional. This should be high priority.

### Shift+S Navigation (UX-006) - **AGREE** - Simple fix

### Shift+Click Copy Link (UX-007) - **AGREE**

Good catch. This should be consistent across all items with URLs.

### Menu Text Updates (UX-008) - **MINOR SUGGESTION**

"Jump to" is slightly better than "Go to" for spatial metaphor. But I'd also suggest:
- Keep it concise: "Jump to Loot Entry" → "View Entry"
- Adding the job icon is excellent for context

### Linked Tags in Lists (UX-009) - **AGREE**

This provides important context for loot decisions.

### Hotkey Toggle (UX-010) - **AGREE with caveat**

Good accessibility feature. Also consider:
- Warn users that some features become slower without shortcuts
- Maybe offer "reduced shortcuts" mode that keeps navigation shortcuts but disables action shortcuts

### Floor/Show Filter Hotkeys (UX-011) - **LOW PRIORITY**

This feels like over-optimization. The mouse works fine for floor selection. I'd deprioritize this unless you have user feedback requesting it.

### Reset All Data Shortcut (UX-012) - **DISAGREE - SKIP THIS**

Adding a keyboard shortcut to a destructive action is dangerous. Even with Shift+Ctrl+Alt, muscle memory mistakes happen. Keep this as a menu-only action with confirmation.

---

## New Features - My Take

### Admin Super-User Menu (FEAT-001) - **AGREE with caution**

**Auto Fill Empty Slots:** ✅ Useful for initial setup

**Import BiS for All:** ⚠️ Needs careful design
- What if a player already has a BiS set?
- What if the "first found" preset isn't appropriate?
- Suggestion: Show a preview modal listing what will be imported for each player before confirming

### Progress Wheel Quick Actions (FEAT-002) - **MARGINAL**

This feels like edge-case optimization. How often do users need to mark ALL gear as obtained? Usually gear is acquired piece by piece.

**Alternative:** Maybe "Mark Floor X Complete" (marks all gear from that floor as obtained) would be more realistic?

### Floor Section Right-Click Menu (FEAT-003) - **AGREE**

This is a solid workflow improvement for raid logging sessions.

**Sequential Logging:** I like this approach. Stepping through each item is less overwhelming than a giant form.

**Reset Floor Loot:** Make sure this has a very clear confirmation with the floor name and number of entries to be deleted.

### Log Week Button (FEAT-004) - **AGREE - WIZARD APPROACH**

I agree the wizard approach is better. One big form would be overwhelming for floors with many drops.

**Suggested Flow:**
1. Click "Log Week" on floor header
2. Step 1: Select which items dropped this week (checkboxes)
3. Step 2-N: For each selected item, assign recipient
4. Final step: Mark books for everyone? (optional)
5. Summary before commit

### G for Dashboard Toggle (FEAT-005) - **AGREE**

Consistency with GroupView is good.

### Admin Player Card Assignment (FEAT-006) - **AGREE - HIGH PRIORITY**

This is an admin workflow blocker. The current error makes sense from a data integrity standpoint (a user shouldn't be linked to multiple players in the same tier), but admins need an override.

**Suggested Implementation:**
```tsx
// Player options menu (admin only)
{isAdmin && (
  <>
    <DropdownSeparator />
    <DropdownItem icon={<UserPlus />} onSelect={openAssignUserModal}>
      Assign User
    </DropdownItem>
  </>
)}
```

### Design Language Update (FEAT-007) - **LOW PRIORITY**

This is documentation/communication, not a feature. Handle it when you have time.

### Permission-Aware Tips (FEAT-008) - **AGREE**

Essential for UX. Showing tips about features users can't access is confusing.

---

## Suggestions You Didn't Mention

### 1. Loading States / Skeleton Loaders

Your CLAUDE.md mentions this is a known issue (U-001). Consider adding skeleton loaders during:
- Initial page load
- Tab switches with data fetching
- Modal content loading

### 2. Error Boundary Components

Add React error boundaries to prevent entire app crashes from component errors.

### 3. Undo/Redo for Loot Actions

Consider adding undo functionality for loot logging (for 30 seconds after action). This is safer than relying on delete.

### 4. Keyboard Navigation Indicators

When users press `?` to see shortcuts, maybe briefly highlight which elements have shortcuts with a subtle overlay/badge.

### 5. Mobile Responsiveness

I didn't see any mobile-specific issues in your audit, but ensure these changes don't break narrow viewport layouts.

---

## Priority Reordering Suggestion

Based on impact vs. effort:

### Must Do First (Session 1)
1. BUG-002: Duplicate banners (5 min fix)
2. BUG-003: Focus ring artifacts (30 min CSS audit)
3. UX-006: Fix Shift+S (5 min fix)
4. FEAT-006: Admin player assignment (blocker)

### High Priority (Sessions 2-3)
1. BUG-001: Session timeout (needs investigation)
2. UX-005: Replace native prompts
3. UX-001: Shortcuts to tooltips
4. UX-003: Shortcuts modal redesign

### Medium Priority (Sessions 4-5)
1. FEAT-003: Floor section context menu
2. FEAT-004: Log Week wizard
3. UX-009: Linked tags everywhere
4. FEAT-008: Permission-aware tips

### Low Priority / Can Wait
1. UX-002: Tips modal redesign
2. UX-004: Modal header icons
3. FEAT-001: Admin super-user menu
4. FEAT-002: Progress wheel actions

### Skip / Not Recommended
1. UX-012: Reset shortcut (dangerous)
2. UX-011: Floor filter hotkeys (over-optimization)

---

## Session Management for Claude Code

### When to Start a New Session

1. After completing a logical group of related tasks
2. When context window is getting full (~100k+ tokens)
3. When switching between major areas (frontend vs backend)
4. When you need a "fresh perspective" on a stuck problem

### Session Handoff Best Practices

Before ending a session:
1. Commit all changes
2. Note any in-progress work in a TODO comment
3. Run type check and lint
4. Test manually in browser

When starting a new session:
1. Pull latest changes
2. Read CLAUDE.md
3. Check for TODO comments from previous session
4. Run dev server to verify starting state

### Model Choice Guidance

| Situation | Model |
|-----------|-------|
| Simple, well-defined tasks | Sonnet (faster, cheaper) |
| Complex debugging | Opus (better reasoning) |
| Multi-file refactors | Opus (better context) |
| New architectural decisions | Opus (better judgment) |
| Style/CSS changes | Sonnet (straightforward) |
| Test writing | Sonnet (pattern matching) |
| Security-related code | Opus (careful reasoning) |

---

**End of Analysis**
