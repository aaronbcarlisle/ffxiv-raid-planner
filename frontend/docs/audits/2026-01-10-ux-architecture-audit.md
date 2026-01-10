# FFXIV Raid Planner - UX Architecture Audit

**Date:** 2026-01-10
**Auditor:** Principal Architect
**Scope:** Frontend codebase - UX patterns, state management, accessibility, design system compliance

---

## Executive Summary

The FFXIV Raid Planner frontend demonstrates solid architectural foundations with well-structured Zustand stores, comprehensive permission utilities, and thoughtful component decomposition. However, several areas require attention to improve user experience, accessibility compliance, and design system consistency.

### Key Findings by Severity

| Priority | Category | Count |
|----------|----------|-------|
| High | Accessibility | 5 |
| High | UX Patterns | 3 |
| Medium | State Management | 4 |
| Medium | Design System | 4 |
| Low | Component Architecture | 3 |
| Low | Performance | 2 |

---

## 1. State Management & UX

### 1.1 Loading States [Medium Priority]

**File:** `/frontend/src/stores/lootTrackingStore.ts`
**Location:** Lines 86-98, 135-147, etc.

**Current Behavior:** The store uses a single `isLoading` flag for all operations.

**Issue:** Multiple concurrent API calls share the same loading state, causing visual jitter when one completes while another is pending.

```typescript
// Current pattern (problematic)
set({ isLoading: true, error: null });
// ... API call
set({ lootLog: response, isLoading: false });
```

**Recommendation:** Implement granular loading states per operation type:
```typescript
interface LootTrackingState {
  isLoadingLoot: boolean;
  isLoadingMaterials: boolean;
  isLoadingBalances: boolean;
  // ...
}
```

**Impact:** Users see confusing loading states when multiple fetches happen simultaneously (e.g., switching weeks triggers loot log + page ledger + balances).

---

### 1.2 Optimistic Updates [Medium Priority]

**File:** `/frontend/src/stores/tierStore.ts`
**Location:** Lines 365-406 (`reorderPlayers`)

**Current Behavior:** Optimistic updates are used for drag-and-drop reordering, with rollback on error.

**Positive:** This pattern is well-implemented for reorderPlayers.

**Issue:** Other operations like `updatePlayer`, `claimPlayer`, `releasePlayer` wait for API response before updating UI, causing noticeable delay.

**Recommendation:** Apply optimistic update pattern to high-frequency player edits:
- Gear checkbox toggling (most frequent user action)
- Claim/release operations
- Substitute toggle

---

### 1.3 Error State Recovery [Medium Priority]

**File:** `/frontend/src/stores/staticGroupStore.ts`
**Location:** Lines 60-66, 77-82, etc.

**Current Behavior:** Errors are stored in state and displayed generically.

**Issue:** No automatic retry mechanism or user-friendly recovery options.

```typescript
// Current pattern
set({
  error: error instanceof Error ? error.message : 'Failed to fetch groups',
  isLoading: false,
});
```

**Recommendation:** Add retry callbacks and structured error information:
```typescript
interface ErrorState {
  message: string;
  code?: string;
  retryFn?: () => Promise<void>;
  timestamp: number;
}
```

**Impact:** Users must manually refresh the page to recover from transient network errors.

---

### 1.4 State Synchronization Gaps [Medium Priority]

**File:** `/frontend/src/pages/GroupView.tsx`
**Location:** Lines 489-499

**Current Behavior:** Loot log and material log are fetched when switching to the Loot tab.

**Issue:** If user logs loot and immediately switches tabs, returning to the loot tab doesn't reflect changes until data is refetched.

**Recommendation:** Implement event-based data invalidation using the existing eventBus:
```typescript
eventBus.emit('loot:logged', { groupId, tierId, weekNumber });
// In LootPriorityPanel:
useEventBus('loot:logged', () => refreshLootLog());
```

---

## 2. User Flow Analysis

### 2.1 New User Onboarding [High Priority]

**File:** `/frontend/src/pages/Home.tsx`, `/frontend/src/pages/Dashboard.tsx`

**Current Behavior:** New users see feature cards on the homepage, then an empty dashboard after login.

**Issue:** No guided onboarding flow. First-time users don't understand:
- How to create their first static
- What "BiS" means in context
- How to invite raid members

**Recommendation:**
1. Add empty state CTA with steps: "1. Create Static -> 2. Add Players -> 3. Import BiS"
2. Add contextual tooltips on first interaction (e.g., "Click here to import your gear set from XIVGear")
3. Consider a "Getting Started" wizard modal for first-time users

**Impact:** High friction for new users discovering the app.

---

### 2.2 BiS Import Flow [High Priority]

**File:** `/frontend/src/components/player/BiSImportModal.tsx`
**Location:** Lines 130-218

**Current Behavior:** Users can paste XIVGear/Etro links or select from presets.

**Issue:** Error messages are technical and don't guide users to resolution:
```typescript
if (err.message.includes('404')) {
  setError('Gear set not found. Please check the link or UUID.');
}
```

**Recommendation:**
1. Add link validation before preview (regex check for valid URL patterns)
2. Provide specific guidance: "Gear set not found. Make sure the set is public on XIVGear."
3. Add "Example link" placeholder showing correct format
4. Consider a "Copy from XIVGear" button that opens XIVGear in new tab

---

### 2.3 Missing Confirmation Dialogs [High Priority]

**File:** `/frontend/src/components/player/PlayerCard.tsx`
**Location:** Various context menu actions

**Current Behavior:** "Reset Gear" has a confirmation modal (lines 392-448).

**Issue:** Other destructive actions lack confirmation:
- "Mark as Sub" immediately toggles without confirmation
- "Unlink BiS" immediately clears data
- "Paste Player" overwrites data without warning

**Recommendation:** Add confirmation for:
- Unlink BiS: "This will remove the BiS link and item metadata. Progress will be kept."
- Paste Player: "This will overwrite {playerName}'s gear and job. Continue?"

---

## 3. Component Architecture

### 3.1 GroupView.tsx Complexity [Low Priority - Known Issue]

**File:** `/frontend/src/pages/GroupView.tsx`
**Location:** Entire file (1339 lines)

**Current Behavior:** Single file handles all GroupView logic including tabs, DnD, modals, and URL state.

**Issue:** This is tracked in P-005 from the previous audit. File is difficult to maintain.

**Recommendation:** Extract into sub-components:
- `GroupViewToolbar.tsx` - Tab navigation + view toggles
- `PlayerGrid.tsx` - Player card rendering logic
- `GroupViewModals.tsx` - Modal state management

---

### 3.2 Props Drilling vs Context [Low Priority]

**File:** `/frontend/src/components/player/PlayerCard.tsx`
**Location:** Lines 24-51 (Props interface)

**Current Behavior:** PlayerCard receives 22 props including callbacks.

```typescript
interface PlayerCardProps {
  player: SnapshotPlayer;
  settings: StaticSettings;
  viewMode: ViewMode;
  contentType: ContentType;
  clipboardPlayer: SnapshotPlayer | null;
  currentUserId?: string;
  isGroupOwner?: boolean;
  userRole?: MemberRole | null;
  // ... 14 more props
}
```

**Issue:** Deep props drilling increases coupling and makes refactoring difficult.

**Recommendation:** Create a PlayerCardContext for shared state:
```typescript
const PlayerCardContext = createContext<{
  userRole: MemberRole | null;
  currentUserId: string | undefined;
  isAdmin: boolean;
  canEdit: boolean;
}>(null);
```

---

### 3.3 Memoization Opportunities [Low Priority]

**File:** `/frontend/src/components/player/PlayerCard.tsx`
**Location:** Lines 91-102 (Context menu items)

**Current Behavior:** Context menu items array is recreated on every render.

**Issue:** `contextMenuItems` array is built inline, causing unnecessary re-renders of ContextMenu.

**Recommendation:** Memoize with useMemo:
```typescript
const contextMenuItems = useMemo(() => [
  // ... items
], [editPermission, rosterPermission, clipboardPlayer]);
```

---

## 4. Accessibility (a11y)

### 4.1 Missing ARIA Labels [High Priority]

**Files:** Multiple components
**Pattern:** Custom buttons without screen reader context

**Findings:**
- Total `aria-label` occurrences: 29 (across 15 files)
- Total `role=` attributes: 10 (across 8 files)

**Specific Issues:**

1. **GroupView.tsx Lines 1063-1085:** G1/G2 layout toggle uses `aria-label` but many similar toggles don't.

2. **Dashboard.tsx Lines 430-444:** Copy code button lacks `aria-label`:
```jsx
<button
  onClick={(e) => handleCopyCode(group.shareCode, e)}
  className="p-1 rounded..."
  title="Copy code (hold Shift for full URL)"  // title is not accessible
>
```

3. **WeaponPriorityList.tsx Lines 150-155:** Roll button has no accessible label:
```jsx
<button onClick={() => handleRoll(tieGroup!, tieGroupEntries)}>
  {hasRolled ? 'Reroll' : 'Roll'}
</button>
```

**Recommendation:** Add `aria-label` to all icon-only buttons and provide `aria-live` regions for dynamic content updates.

---

### 4.2 Focus Management in Modals [High Priority]

**File:** `/frontend/src/components/ui/Modal.tsx`
**Location:** Lines 23-73

**Current Behavior:** Modal handles Escape key and backdrop click.

**Issue:** Focus is not trapped within the modal and not returned to trigger on close.

**Missing:**
- Focus trap (tabbing can exit modal)
- Initial focus on first interactive element
- Focus restoration on close

**Recommendation:** Use Radix Dialog or implement focus trap:
```typescript
useEffect(() => {
  if (isOpen) {
    const previousFocus = document.activeElement;
    // Trap focus in modal
    return () => previousFocus?.focus();
  }
}, [isOpen]);
```

---

### 4.3 Keyboard Navigation [High Priority]

**File:** `/frontend/src/components/ui/ContextMenu.tsx`
**Location:** Lines 39-152

**Current Behavior:** Context menu closes on Escape.

**Issue:** No arrow key navigation between menu items.

**Recommendation:**
- Add arrow key handlers for menu item navigation
- Add Home/End for first/last item
- Add character search for quick selection

---

### 4.4 Color Contrast [Medium Priority]

**File:** `/frontend/src/components/history/LootCountBar.tsx`
**Location:** Lines 88-93

**Current Behavior:** Position labels use dynamic role colors:
```jsx
<span style={{ color: roleColor }}>
  {player.position || '?'}
</span>
```

**Issue:** Some role colors may not meet WCAG 2.1 AA contrast requirements on the dark background.

**Recommendation:** Audit all role colors for 4.5:1 contrast ratio against `surface-card` background.

---

### 4.5 Screen Reader Announcements [High Priority]

**File:** `/frontend/src/stores/toastStore.ts`
**Location:** Lines 66-106

**Current Behavior:** Toast notifications appear visually but may not be announced.

**Issue:** Toast container lacks `aria-live` attribute for screen reader announcements.

**Recommendation:** Add to ToastContainer:
```jsx
<div role="status" aria-live="polite" aria-atomic="true">
  {/* toasts */}
</div>
```

---

## 5. Design System Compliance

### 5.1 Hardcoded Colors [Medium Priority]

**Files with hex colors:** 7 files
- `WeaponPriorityList.tsx` - `#9ca3af` fallback color
- `LootCountBar.tsx` - `#9ca3af` fallback color
- `Tooltip.tsx` - Hardcoded shadow colors
- `WeeklyLootGrid.tsx` - Inline style colors
- `CodeBlock.tsx` - Syntax highlighting colors (acceptable)
- `DesignSystem.tsx` - Documentation examples (acceptable)
- `LootMathDocs.tsx` - Documentation examples (acceptable)

**Recommendation:** Replace runtime fallbacks with design tokens:
```typescript
// Instead of
const roleColor = player.role ? getRoleColor(player.role) : '#9ca3af';

// Use
const roleColor = player.role ? getRoleColor(player.role) : 'var(--color-text-muted)';
```

---

### 5.2 Inconsistent Button Usage [Medium Priority]

**Files:** Various
**Pattern:** Mix of `Button` primitive and raw `<button>` elements

**Examples:**
- `GroupView.tsx` Line 987-990: Raw button for "Create First Tier"
- `Dashboard.tsx` Lines 430-444: Raw button for copy action
- `WeaponPriorityList.tsx` Lines 150-155: Raw button for roll action

**Recommendation:** Use `Button` or `IconButton` primitives consistently for:
- Consistent styling
- Proper focus states
- Loading state support

---

### 5.3 Missing Skeleton States [Medium Priority]

**File:** `/frontend/src/components/ui/Skeleton.tsx` (exists but underutilized)

**Current Behavior:** Loading states show spinner.

**Issue:** No content placeholders during load, causing layout shift.

**Locations needing skeletons:**
- Dashboard group cards
- PlayerCard during tier load
- Loot log entries

**Recommendation:** Use Skeleton components for content-aware loading states.

---

### 5.4 Toast Component Duplication [Low Priority]

**Files:**
- `/frontend/src/components/ui/Toast.tsx` - Simple toast component
- `/frontend/src/stores/toastStore.ts` - Toast store with queue

**Issue:** Two toast systems coexist. The simple `Toast.tsx` component is unused in favor of the store-based system.

**Recommendation:** Remove `Toast.tsx` or consolidate into single system.

---

## 6. Usability Patterns

### 6.1 Drag-and-Drop Feedback [Positive]

**File:** `/frontend/src/components/dnd/useDragAndDrop.tsx`

The DnD implementation properly:
- Disables when modals are open
- Provides visual overlay
- Supports cross-group position swapping

---

### 6.2 Form Validation [Medium Priority]

**File:** `/frontend/src/components/ui/Input.tsx`

**Current Behavior:** Input supports `error` prop for validation display.

**Issue:** No real-time validation feedback. Forms validate only on submit.

**Examples:**
- Create Static: No character limit indicator
- Delete confirmation: Validates after typing (good)
- BiS import: No URL format validation before submit

**Recommendation:** Add real-time validation for URL inputs:
```typescript
const isValidBiSUrl = useMemo(() => {
  if (!inputValue) return true;
  return /^(https:\/\/)?(xivgear\.app|etro\.gg)/.test(inputValue);
}, [inputValue]);
```

---

### 6.3 Empty States [Positive]

**File:** `/frontend/src/pages/Dashboard.tsx` Lines 333-358

Empty states are well-designed with:
- Friendly messaging
- Clear CTA
- Appropriate icons

---

### 6.4 Context Menu Consistency [Positive]

**File:** `/frontend/src/components/ui/ContextMenu.tsx`

Context menu implementation properly:
- Uses portal for positioning
- Handles viewport boundaries
- Supports separators and disabled items
- Closes on scroll/resize

---

## 7. Performance Considerations

### 7.1 Selector Optimization [Positive]

**File:** `/frontend/src/stores/tierStore.ts` Lines 640-733

Well-implemented selector hooks prevent unnecessary re-renders:
- `useTierPlayers()` - stable empty array reference
- `usePlayersByGroup()` - uses `useShallow`
- `useConfiguredPlayers()` - filtered selector

---

### 7.2 Context Menu Items Recreation [Low Priority]

**File:** `/frontend/src/components/player/PlayerCard.tsx` Lines 249-343

**Issue:** `contextMenuItems` array rebuilds on every render.

**Impact:** Minor, but compounds with 8+ player cards.

**Recommendation:** Memoize with relevant dependencies.

---

## 8. Recommendations Summary

### High Priority (Address in next sprint)
1. Add focus trap and focus management to Modal component
2. Add keyboard navigation to ContextMenu
3. Add aria-live regions for toast notifications
4. Add aria-labels to all icon-only buttons
5. Improve BiS import error messaging with actionable guidance
6. Add confirmation dialogs for "Unlink BiS" and "Paste Player"
7. Improve onboarding flow for new users

### Medium Priority (Next 2-3 sprints)
1. Implement granular loading states in lootTrackingStore
2. Add optimistic updates for gear checkbox toggling
3. Add retry mechanisms for failed API calls
4. Replace hardcoded colors with design tokens
5. Standardize button usage across components
6. Add skeleton loading states for major components
7. Implement real-time URL validation for BiS import

### Low Priority (Backlog)
1. Extract GroupView.tsx into smaller components (P-005)
2. Consider PlayerCardContext for reduced props drilling
3. Memoize context menu items in PlayerCard
4. Remove unused Toast.tsx component
5. Audit role colors for WCAG contrast compliance

---

## Appendix: Files Analyzed

| Category | Files |
|----------|-------|
| Stores | authStore, staticGroupStore, tierStore, lootTrackingStore, toastStore |
| Pages | Home, Dashboard, GroupView, InviteAccept |
| UI Components | Modal, ContextMenu, Button, IconButton, Input, Select, Toast |
| Player Components | PlayerCard, BiSImportModal |
| Loot Components | WeaponPriorityList, LootCountBar |
| History Components | HistoryView |
| Utils | permissions.ts |

---

*Report generated by FFXIV Raid Planner Principal Architect*
