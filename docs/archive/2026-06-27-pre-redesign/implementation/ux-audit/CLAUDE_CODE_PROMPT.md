# Claude Code Implementation Prompt

## Project Overview

You're working on the **FFXIV Raid Planner**, a React + TypeScript web application for Final Fantasy XIV raid groups to track gear progression and loot distribution.

**Tech Stack:**
- Frontend: React 18, TypeScript, Zustand, TailwindCSS, Radix UI primitives
- Backend: FastAPI, SQLite, SQLAlchemy
- Auth: Discord OAuth with JWT

**CRITICAL RULE:** Never add AI attribution to commits. No "Co-authored-by: Claude" or similar.

---

## Before Starting

1. **Read `CLAUDE.md`** - Contains project conventions, file locations, patterns
2. **Start dev server:** `./dev.sh` (runs both frontend :5174 and backend :8001)
3. **Check design system:** `./frontend/scripts/check-design-system.sh`

---

## Session 1: Critical Bug Fixes

### Task 1.1: Fix Duplicate "View As" Banners

**Problem:** Two banners appear when admin uses "View As" feature.

**Root Cause:** Both `ViewAsBanner.tsx` (in Layout) and `AdminBanners.tsx` (in GroupView) render the same banner.

**Fix:**
1. Open `frontend/src/components/admin/AdminBanners.tsx`
2. Remove the `viewAsUser` banner section (lines 38-60)
3. Keep only the `isAdminAccess` banner
4. Verify Layout.tsx still has ViewAsBanner

**Test:** Enable View As on any static, should see only ONE banner.

---

### Task 1.2: Fix Focus Ring Artifacts on Keyboard Shortcuts

**Problem:** After using shortcuts (Alt+L, Shift+Click), focus rings appear on unexpected elements.

**Solution:** Use `:focus-visible` instead of `:focus` for decorative focus styles.

**Steps:**
1. Open `frontend/src/index.css`
2. Find any global focus styles and update to focus-visible
3. Check these components for focus styling:
   - `components/ui/Modal.tsx`
   - `components/primitives/Dropdown.tsx`
   - `components/ui/ContextMenu.tsx`
4. Pattern to follow:
   ```css
   /* Before */
   button:focus {
     @apply ring-2 ring-accent;
   }
   /* After */
   button:focus-visible {
     @apply ring-2 ring-accent;
   }
   ```

**Test:** 
1. Press Alt+L to open Log Loot modal
2. Close button (X) should NOT have focus ring visible
3. Shift+click player card to copy link
4. No visible focus rings should appear

---

### Task 1.3: Fix Shift+S Navigation

**Problem:** Shift+S goes to home (`/`) instead of dashboard (`/statics`).

**Fix:**
1. Find the shortcut definition (likely in `hooks/useGroupViewKeyboardShortcuts.ts` or similar)
2. Update the navigation path from `/` to `/statics`

**Test:** Press Shift+S from any group page, should navigate to My Statics dashboard.

---

## Session 2: Shortcuts System Overhaul

### Task 2.1: Move Inline Shortcuts to Tooltips

**Current:** Menu items show shortcuts inline (e.g., "Add Player Alt+Shift+P")
**Desired:** Show only a keyboard icon, with shortcut in tooltip on hover

**Files to update:**
1. `components/ui/SettingsPopover.tsx` - Static actions menu
2. `components/primitives/Dropdown.tsx` - DropdownItem shortcut prop

**Implementation pattern:**
```tsx
// In DropdownItem, replace:
{shortcut && (
  <span className="ml-auto text-xs text-text-muted">{shortcut}</span>
)}

// With:
{shortcut && (
  <Tooltip content={shortcut} side="right" delayDuration={100}>
    <Keyboard className="ml-auto w-3.5 h-3.5 text-text-muted" />
  </Tooltip>
)}
```

**Document all locations that need this change:**
- SettingsPopover.tsx
- PlayerOptionsMenu.tsx (if exists)
- Any ContextMenu usages
- User menu items

---

### Task 2.2: Redesign Keyboard Shortcuts Modal

**Current:** Vertical list, hard to scan
**Desired:** Grid layout with columns, like Unreal Engine hotkey reference

**File:** `frontend/src/components/ui/KeyboardShortcutsHelp.tsx`

**Changes:**
1. Change container from `space-y-6` to CSS Grid
2. Each shortcut group becomes a card
3. More compact display within each card

```tsx
// Suggested structure
<Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" size="3xl">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {SHORTCUT_GROUPS.map((group) => (
      <div 
        key={group.title} 
        className="bg-surface-elevated rounded-lg p-4 border border-border-default"
      >
        <h3 className="text-sm font-bold text-accent mb-3 pb-2 border-b border-border-subtle">
          {group.title}
        </h3>
        <div className="space-y-1.5">
          {group.shortcuts.map((shortcut) => (
            <div key={shortcut.key} className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">{shortcut.description}</span>
              <kbd className="font-mono px-1.5 py-0.5 bg-surface-card border border-border-default rounded text-text-muted">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
  
  <div className="mt-4 pt-4 border-t border-border-default flex justify-between items-center">
    <p className="text-xs text-text-muted">
      Shortcuts disabled when typing or in modals
    </p>
    {/* Future: Add toggle for disabling shortcuts */}
  </div>
</Modal>
```

---

### Task 2.3: Add Shortcut Disable Toggle

**Desired:** Option in Keyboard Shortcuts modal to disable all hotkeys

**Implementation:**
1. Add to localStorage: `shortcuts-enabled` (default: true)
2. Add toggle switch to KeyboardShortcutsHelp footer
3. Check flag in `useKeyboardShortcuts` hook

```tsx
// In useKeyboardShortcuts.ts
export function useKeyboardShortcuts({ shortcuts, disabled = false }: UseKeyboardShortcutsOptions) {
  const shortcutsEnabled = localStorage.getItem('shortcuts-enabled') !== 'false';
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (disabled || !shortcutsEnabled || isInputElement(event.target)) return;
    // ... rest of logic
  }, [shortcuts, disabled, shortcutsEnabled]);
```

---

## Session 3: Menu & Context Menu Enhancements

### Task 3.1: Update Menu Item Text

**Changes:**
- "Go to Loot Entry" → "Jump to Loot Entry"
- "Go to PlayerName" → "Jump to [PlayerName]" (with job icon)

**Files:**
- `components/history/LogEntryItems.tsx`
- `components/history/SectionedLogView.tsx`
- Any ContextMenu item definitions

**For job icons:**
```tsx
// Import job icon utility
import { getJobIcon } from '../gamedata/jobs';

// In menu item
icon: player.jobId ? getJobIcon(player.jobId) : undefined,
label: `Jump to ${player.name}`
```

---

### Task 3.2: Add Admin Player Assignment Feature

**Problem:** Admin can't assign users to player cards when using "View As"

**New Feature:** Add "Assign User" option in player options menu (admin only)

**Backend:**
1. Add endpoint: `POST /api/static-groups/{group_id}/tiers/{tier_key}/players/{player_id}/assign`
2. Accept body: `{ userId: string }`
3. Verify admin permission
4. Clear any existing link for that user in this tier first
5. Set new link

**Frontend:**
1. Add to player options menu (admin only):
```tsx
{isAdmin && (
  <>
    <DropdownSeparator />
    <DropdownItem
      icon={<UserPlus className="w-4 h-4" />}
      onSelect={() => openAssignUserModal(player)}
    >
      Assign User
    </DropdownItem>
  </>
)}
```

2. Create `AssignUserModal.tsx`:
   - Search field for username
   - Show list of group members without a linked player
   - Confirm button

---

### Task 3.3: Floor Section Context Menu (Log Grid View)

**Trigger:** Right-click on floor section header in Log > Grid view

**Menu Items:**
1. "Log Floor Loot" - Opens sequential modals for each slot
2. "Log Floor Books" - Opens Mark Floor Cleared with floor pre-selected
3. (separator)
4. "Reset Floor Loot" (danger) - Clears all entries for floor

**Files:**
- `components/history/WeeklyLootGrid.tsx` or wherever floor sections are rendered

**Implementation:**
```tsx
const [floorContextMenu, setFloorContextMenu] = useState<{x: number, y: number, floor: string} | null>(null);

// On floor header
<div 
  onContextMenu={(e) => {
    e.preventDefault();
    setFloorContextMenu({ x: e.clientX, y: e.clientY, floor: floorKey });
  }}
>
  {/* Floor header content */}
</div>

// Context menu
{floorContextMenu && (
  <ContextMenu
    x={floorContextMenu.x}
    y={floorContextMenu.y}
    onClose={() => setFloorContextMenu(null)}
    items={[
      { label: 'Log Floor Loot', icon: <Package />, onClick: () => startFloorLogging(floorContextMenu.floor) },
      { label: 'Log Floor Books', icon: <BookOpen />, onClick: () => openBooksModal(floorContextMenu.floor) },
      { separator: true },
      { label: 'Reset Floor Loot', icon: <Trash2 />, danger: true, onClick: () => confirmResetFloor(floorContextMenu.floor) },
    ]}
  />
)}
```

---

## Session 4: Modal & Tips Improvements

### Task 4.1: Replace Native Prompts with Custom Modals

**Search for native prompts:**
```bash
grep -rn "window.confirm\|window.prompt\|alert(" frontend/src/
```

**Create reusable ConfirmDialog if not exists:**
```tsx
// components/ui/ConfirmDialog.tsx
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmDanger?: boolean;
}
```

**Replace each native prompt with the custom dialog.**

---

### Task 4.2: Modal Header Icons Audit

**Goal:** All modals should have icon + title in header

**Audit these modals:**
- Log Loot Drop
- Log Material
- Mark Floor Cleared
- Add Player
- New Tier
- Static Settings
- Delete confirmations
- BiS Import
- Invite creation

**Pattern:**
```tsx
<Modal
  title={
    <span className="flex items-center gap-2">
      <Package className="w-5 h-5" />
      Log Loot Drop
    </span>
  }
>
```

---

### Task 4.3: Permission-Aware Tips Filtering

**File:** `components/ui/TipsCarousel.tsx`

**Add permission requirement to tips:**
```tsx
interface Tip {
  id: string;
  text: string;
  context?: 'roster' | 'loot' | 'log' | 'summary' | 'global';
  requiredRole?: 'owner' | 'lead' | 'member' | 'viewer'; // Minimum role needed
}

// Tips that require elevated permissions
{ 
  id: 'settings', 
  text: 'Press Alt+Shift+S for static settings', 
  context: 'global',
  requiredRole: 'lead' // Only show to leads and owners
},
```

**Filter logic:**
```tsx
const relevantTips = TIPS.filter(tip => {
  // Context filter
  if (tip.context && tip.context !== 'global' && tip.context !== currentContext) {
    return false;
  }
  // Permission filter
  if (tip.requiredRole) {
    const roleHierarchy = ['viewer', 'member', 'lead', 'owner'];
    const requiredLevel = roleHierarchy.indexOf(tip.requiredRole);
    const userLevel = roleHierarchy.indexOf(userRole || 'viewer');
    if (userLevel < requiredLevel) return false;
  }
  return true;
});
```

---

## Session 5: Parity & Polish

### Task 5.1: Add "Linked to X" Tags in Lists

**Locations to add:**
1. Gear Priority tab - player list
2. Weapon Priority tab - player list  
3. Recipient dropdown in Log Loot modal
4. Logged loot entries display

**Implementation:**
```tsx
// When displaying player name
<span className="flex items-center gap-2">
  <JobIcon jobId={player.jobId} />
  {player.name}
  {player.linkedToPlayerName && (
    <span className="text-xs px-1.5 py-0.5 rounded bg-membership-linked/20 text-membership-linked">
      Linked to {player.linkedToPlayerName}
    </span>
  )}
</span>
```

---

### Task 5.2: Shift+Click Copy Link Consistency

**Ensure shift+click works on:**
- ✅ Player cards
- Release notes items
- Loot log entries
- Any other linkable elements

**Pattern:**
```tsx
const handleClick = (e: React.MouseEvent) => {
  if (e.shiftKey) {
    e.preventDefault();
    navigator.clipboard.writeText(window.location.origin + itemUrl);
    toast.success('Link copied!');
  }
};
```

---

## Verification Checklist

After each session, verify:

- [ ] No TypeScript errors: `pnpm tsc --noEmit`
- [ ] No lint errors: `pnpm lint`
- [ ] Design system check: `./frontend/scripts/check-design-system.sh`
- [ ] Manual browser testing
- [ ] Keyboard navigation works
- [ ] Mobile viewport still works
- [ ] No console errors

---

## Commit Guidelines

- Atomic commits (one logical change per commit)
- Clear messages: `fix: resolve duplicate View As banners`
- No AI attribution
- Reference task ID if tracking: `fix(UX-001): move shortcuts to tooltips`

---

**Ready to implement. Start with Session 1 tasks.**
