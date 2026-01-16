# Session 9: Performance Optimization - Zustand + Hooks

**Duration:** 4-6 hours
**Issues:** P2-PERF-001, P2-ARCH-001
**Priority:** MEDIUM

---

## Pre-Session Checklist

- [ ] Frontend dependencies installed
- [ ] React DevTools installed in browser
- [ ] All tests passing (`pnpm test`)
- [ ] Clean git status

---

## Prompt for Claude Code

```
I need to optimize Zustand store usage and split a large hook. Work through each issue, creating commits after each fix.

## Issue 1: Zustand Store Selectors Not Used in GroupView (P2-PERF-001)

**Location:** `frontend/src/pages/GroupView.tsx` (around lines 44-51)

**Current problem:**
```typescript
const {
  tiers,
  currentTier,
  isLoading: tierLoading,
  error: tierError,
  fetchTiers,
  fetchTier,
  clearTiers,
} = useTierStore();  // Destructures entire store!
```

**Problem:** Component re-renders whenever ANY tierStore field changes, not just the ones being used.

**Solution options:**

Option A: Individual selectors (best for granular control)
```typescript
const tiers = useTierStore((state) => state.tiers);
const currentTier = useTierStore((state) => state.currentTier);
const tierLoading = useTierStore((state) => state.isLoading);
const tierError = useTierStore((state) => state.error);

// Actions don't trigger re-renders, get from store directly
const { fetchTiers, fetchTier, clearTiers } = useTierStore.getState();
```

Option B: Use existing selector hooks (if they exist in tierStore.ts)
```typescript
import { useTiers, useCurrentTierMeta, useTierPlayers } from '../stores/tierStore';
```

Option C: useShallow for grouped state
```typescript
import { useShallow } from 'zustand/react/shallow';

const { tiers, currentTier, isLoading, error } = useTierStore(
  useShallow((state) => ({
    tiers: state.tiers,
    currentTier: state.currentTier,
    isLoading: state.isLoading,
    error: state.error,
  }))
);
```

**Apply the same pattern to other store usages in GroupView:**
- `useStaticGroupStore`
- `useLootTrackingStore`
- `useAuthStore`

**Verification:**
1. Install React DevTools Profiler
2. Record while interacting with GroupView
3. Compare re-render counts before/after
4. Target: Fewer unnecessary re-renders when unrelated state changes

Commit: "perf(stores): use Zustand selectors in GroupView to reduce re-renders"

---

## Issue 2: Split useGroupViewState Hook (P2-ARCH-001)

**Location:** `frontend/src/hooks/useGroupViewState.ts` (360 lines)

**Current problem:** 20+ useState calls managing unrelated concerns in one hook.

**Goal:** Split into focused hooks:
1. `usePageNavigation` - tabs, URL sync, history
2. `useModalState` - modal open/close states
3. `useViewSettings` - sort mode, group view, show substitutes

**Step 1: Analyze the current hook**
Read useGroupViewState.ts and categorize each useState call:

Navigation-related:
- activeTab, setActiveTab
- lootSubTab, setLootSubTab
- historyViewMode, setHistoryViewMode
- selectedWeek, setSelectedWeek
- URL sync logic

Modal-related:
- isSettingsOpen, setIsSettingsOpen
- isAddPlayerOpen, setIsAddPlayerOpen
- isBiSImportOpen, setIsBiSImportOpen
- (and other modal states)

View settings:
- sortMode, setSortMode
- showSubs, setShowSubs
- partyViewMode, setPartyViewMode

**Step 2: Create new hooks**

Create `frontend/src/hooks/usePageNavigation.ts`:
```typescript
export function usePageNavigation(groupId: string, tierId: string | null) {
  const [activeTab, setActiveTab] = useState<Tab>('roster');
  const [lootSubTab, setLootSubTab] = useState<LootSubTab>('priority');
  // ... URL sync logic

  return {
    activeTab,
    setActiveTab,
    lootSubTab,
    setLootSubTab,
    // ...
  };
}
```

Create `frontend/src/hooks/useModalState.ts`:
```typescript
export function useGroupViewModals() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  // ... other modals

  return {
    settings: { isOpen: isSettingsOpen, open: () => setIsSettingsOpen(true), close: () => setIsSettingsOpen(false) },
    addPlayer: { isOpen: isAddPlayerOpen, open: () => setIsAddPlayerOpen(true), close: () => setIsAddPlayerOpen(false) },
    // ...
  };
}
```

Create `frontend/src/hooks/useViewSettings.ts`:
```typescript
export function useViewSettings() {
  const [sortMode, setSortMode] = useState<SortMode>('display');
  const [showSubs, setShowSubs] = useState(true);
  const [partyViewMode, setPartyViewMode] = useState<PartyViewMode>('combined');

  return { sortMode, setSortMode, showSubs, setShowSubs, partyViewMode, setPartyViewMode };
}
```

**Step 3: Refactor useGroupViewState**

Update useGroupViewState.ts to compose the new hooks:
```typescript
export function useGroupViewState(groupId: string, tierId: string | null) {
  const navigation = usePageNavigation(groupId, tierId);
  const modals = useGroupViewModals();
  const viewSettings = useViewSettings();

  return {
    ...navigation,
    ...modals,
    ...viewSettings,
  };
}
```

**Step 4: Update GroupView.tsx**

The import and usage should remain the same, but you can also use the focused hooks directly if preferred.

**Testing:**
1. Run tests: `pnpm test`
2. Verify all GroupView functionality works
3. Test tab switching, modal opening, view settings

Commit: "refactor(hooks): split useGroupViewState into focused hooks"

---

## After Both Fixes

```bash
pnpm test
pnpm lint
pnpm tsc --noEmit
```

Profile with React DevTools to verify re-render reduction.
```

---

## Expected Outcomes

### Files Modified
- `frontend/src/pages/GroupView.tsx` (selector usage)
- `frontend/src/hooks/useGroupViewState.ts` (refactored)
- `frontend/src/hooks/usePageNavigation.ts` (new)
- `frontend/src/hooks/useModalState.ts` (new)
- `frontend/src/hooks/useViewSettings.ts` (new)

### Performance Improvement
Before:
- GroupView re-renders on ANY store change
- Single 360-line hook

After:
- GroupView only re-renders on subscribed state changes
- Focused hooks for different concerns
- Easier testing and maintenance

---

## Troubleshooting

### Hook dependency issues
- Ensure effects have correct dependencies
- Use `useCallback` for functions passed to child components

### Tests fail after refactor
- Check that all state is still being managed
- Verify localStorage sync still works

### Re-renders not reduced
- Verify selectors are actually being used (not destructuring)
- Check that child components use memo() if needed

---

## Rollback Plan

```bash
git checkout frontend/src/pages/GroupView.tsx
git checkout frontend/src/hooks/useGroupViewState.ts
rm frontend/src/hooks/usePageNavigation.ts
rm frontend/src/hooks/useModalState.ts
rm frontend/src/hooks/useViewSettings.ts
```

---

## Commit Messages

```
perf(stores): use Zustand selectors in GroupView to reduce re-renders

Replaces full store destructuring with individual selectors:
- useTierStore: individual state selectors
- useStaticGroupStore: individual state selectors
- Actions accessed via getState() to avoid re-renders

Reduces unnecessary re-renders when unrelated state changes.

Addresses: P2-PERF-001
```

```
refactor(hooks): split useGroupViewState into focused hooks

Splits 360-line useGroupViewState into:
- usePageNavigation: tab state, URL sync
- useGroupViewModals: modal open/close states
- useViewSettings: sort mode, substitutes, party view

Improves maintainability and testability.
useGroupViewState now composes these hooks for backward compatibility.

Addresses: P2-ARCH-001
```
