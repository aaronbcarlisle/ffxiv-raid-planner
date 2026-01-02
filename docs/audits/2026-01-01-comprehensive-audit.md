# FFXIV Raid Planner - Comprehensive Codebase Audit

**Date:** 2026-01-01
**Last Verified:** 2026-01-02
**Auditor:** Principal Architect
**Repository:** ffxiv-raid-planner
**Status:** Phase 6.5 Complete

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [Summary Statistics](#summary-statistics)
- [Findings Status Summary](#findings-status-summary)
- [Open Issues](#open-issues)
  - [High Priority](#high-priority)
  - [Medium Priority](#medium-priority)
  - [Low Priority](#low-priority)
- [Resolved Issues](#resolved-issues)
- [Quick Wins](#quick-wins)

---

## Executive Summary

The FFXIV Raid Planner codebase demonstrates **solid architectural foundations** with clear separation of concerns, comprehensive type safety, and well-documented patterns. The project is in a production-ready state for Phases 1-6.5 with Discord OAuth, multi-static membership, tier snapshots, permission-aware UI, loot tracking, weapon priority, and book tracking all functioning correctly.

### Overall Health: **B+ (Good)**

**Strengths:**
- Excellent TypeScript coverage with comprehensive type definitions
- Well-structured Zustand stores with clear domain boundaries
- Robust permission system with frontend and backend enforcement
- Clean component architecture following established patterns
- Good error handling with graceful degradation
- Comprehensive CLAUDE.md documentation
- Proper database indexing on all FK columns
- Accessible IconButton component with required aria-label

**Areas for Improvement:**
- Performance optimizations needed (memoization, code splitting)
- Some components are too large and could be decomposed
- Test coverage is minimal (only 3 test files)
- Missing loading skeletons in Dashboard

### Issue Summary

| Priority | Total | Open | Fixed | Invalid |
|----------|-------|------|-------|---------|
| High | 8 | 5 | 2 | 1 |
| Medium | 6 | 5 | 1 | 0 |
| Low | 5 | 3 | 2 | 0 |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Frontend TypeScript/TSX Files | ~85 |
| Backend Python Files | ~48 |
| Test Files | 3 |
| Lines of Code (Frontend) | ~12,500 |
| Lines of Code (Backend) | ~4,800 |

---

## Findings Status Summary

### High Priority

| ID | Issue | Status | Notes |
|----|-------|--------|-------|
| P-001 | N+1 in duplicateGroup | **OPEN** | Backend bulk endpoint needed |
| P-002 | Missing DB indexes | **FIXED** | All FK columns indexed |
| P-004 | No code splitting | **OPEN** | React.lazy() not used |
| P-007 | PlayerCard re-renders | **OPEN** | React.memo missing |
| R-003 | Missing error boundaries | **OPEN** | No ErrorBoundary in App.tsx |
| T-001 | Low test coverage | **OPEN** | Only 3 test files |
| U-007 | Missing ARIA labels | **FIXED** | IconButton requires aria-label |
| U-009 | Keyboard nav in Select | **INVALID** | Uses native `<select>` |

### Medium Priority

| ID | Issue | Status | Notes |
|----|-------|--------|-------|
| P-003 | Unbounded queries | **OPEN** | No pagination |
| P-005 | Large GroupView | **OPEN** | 811 lines |
| P-006 | Missing useMemo | **FIXED** | LootPriorityPanel uses useMemo |
| U-001 | Missing skeletons | **OPEN** | Dashboard uses spinner |
| S-001 | Token in localStorage | **OPEN** | XSS concern |
| D-001 | Modal duplication | **OPEN** | Pattern extraction needed |

### Low Priority

| ID | Issue | Status | Notes |
|----|-------|--------|-------|
| R-002 | Props drilling | **OPEN** | GroupContext suggested |
| R-008 | No debounce | **OPEN** | InlinePlayerEdit |
| U-004 | No retry on errors | **OPEN** | Add retry button |
| U-006 | Empty loot state | **FIXED** | Shows "No one needs" |
| U-011 | Inconsistent buttons | **OPEN** | Button component needed |

---

## Open Issues

### High Priority

#### P-001: N+1 Query Pattern in duplicateGroup
- **Location:** `frontend/src/stores/staticGroupStore.ts:163-231`
- **Issue:** The `duplicateGroup` function fetches each tier individually in a loop, then creates players one at a time.
- **Impact:** A static with 4 tiers and 8 players each = 36+ API calls.
- **Recommendation:** Implement a backend bulk duplication endpoint: `POST /api/static-groups/{id}/duplicate`

#### P-004: No Code Splitting
- **Location:** `frontend/src/App.tsx`
- **Issue:** All pages are imported synchronously.
- **Impact:** Initial bundle includes all pages.
- **Fix:**
```tsx
const GroupView = React.lazy(() => import('./pages/GroupView'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
```

#### P-007: PlayerCard Re-renders
- **Location:** `frontend/src/components/player/PlayerCard.tsx`
- **Issue:** PlayerCard lacks React.memo, re-renders when parent state changes.
- **Impact:** 8 cards re-rendering on any tier change.
- **Fix:**
```tsx
export const PlayerCard = React.memo(function PlayerCard(props) {...});
```

#### R-003: Missing Error Boundaries
- **Location:** `frontend/src/App.tsx`
- **Issue:** No error boundaries around major page components.
- **Impact:** One component crash takes down entire app.
- **Fix:**
```tsx
import { ErrorBoundary } from 'react-error-boundary';
<ErrorBoundary fallback={<ErrorFallback />}>
  <Routes>...</Routes>
</ErrorBoundary>
```

#### T-001: Low Test Coverage
- **Location:** `backend/tests/`
- **Issue:** Only 3 test files (test_health.py, test_permissions.py, test_static_groups.py)
- **Missing tests for:**
  - BiS import endpoints
  - Tier operations
  - Invitation flows
  - Player CRUD
  - Loot tracking endpoints

### Medium Priority

#### P-003: Unbounded Query Results
- **Location:** `backend/app/routers/static_groups.py:134`
- **Issue:** `list_user_static_groups` returns all groups without pagination.
- **Impact:** Memory issues for users with many statics.
- **Fix:** Add pagination with default limit of 50.

#### P-005: Large Component File
- **Location:** `frontend/src/pages/GroupView.tsx` (811 lines)
- **Issue:** GroupView handles too many concerns.
- **Recommendation:** Extract PlayerGrid, ToolbarSection, TabContent components.

#### U-001: Missing Skeleton Loaders
- **Location:** `frontend/src/pages/Dashboard.tsx:354-357`
- **Issue:** Uses simple spinner instead of skeleton UI.
- **Impact:** Poor perceived performance.
- **Recommendation:** Add skeleton cards matching final layout.

#### S-001: JWT Token Storage
- **Location:** `frontend/src/stores/authStore.ts`
- **Issue:** Tokens stored in localStorage (XSS vulnerability).
- **Recommendation:** Consider httpOnly cookies for production.

#### D-001: Modal Pattern Duplication
- **Locations:** CreateTierModal, DeleteTierModal, GroupSettingsModal
- **Issue:** Repeated modal wrapper code.
- **Recommendation:** Create useModal hook or higher-order component.

### Low Priority

#### R-002: Props Drilling in GroupView
- **Location:** `frontend/src/pages/GroupView.tsx`
- **Issue:** Many props passed through multiple levels.
- **Recommendation:** Consider GroupContext for shared state.

#### R-008: Missing useDebounce
- **Location:** `frontend/src/components/player/InlinePlayerEdit.tsx`
- **Issue:** No debounce on name input before API save.
- **Recommendation:** Add useDebounce hook.

#### U-004: Missing Retry Mechanism
- **Location:** `frontend/src/pages/GroupView.tsx`
- **Issue:** API failures show toast but no retry option.
- **Recommendation:** Add "Retry" button on error states.

#### U-011: Inconsistent Button Styles
- **Location:** Various modals
- **Issue:** Primary buttons use mixed styling approaches.
- **Recommendation:** Create Button component with variants.

---

## Resolved Issues

### P-002: Missing Database Indexes ✅
- **Resolution:** All FK columns now have `index=True`:
  - `snapshot_player.tier_snapshot_id`
  - `membership.static_group_id`
  - `tier_snapshot.static_group_id`

### P-006: Missing useMemo in Priority Calculations ✅
- **Resolution:** `LootPriorityPanel.tsx` now imports and uses `useMemo` for `averageDrops` calculation and entry enhancement.

### U-006: Missing Empty State in Loot Log ✅
- **Resolution:** `PriorityList` component shows "No one needs" message when entries array is empty.

### U-007: Missing ARIA Labels ✅
- **Resolution:** `IconButton` component now:
  - Requires `aria-label` as a mandatory prop
  - Applies it to the button element
  - Uses `VisuallyHidden` component for screen readers

### U-009: Keyboard Navigation in Select (Invalid) ✅
- **Resolution:** Finding was invalid - `Select.tsx` uses native `<select>` element which has built-in keyboard navigation support.

---

## Quick Wins

Remaining low-effort, high-value improvements:

1. **Add React.lazy() to App.tsx** (P-004) - 5 min
2. **Wrap PlayerCard with React.memo** (P-007) - 2 min
3. **Add Error Boundary** (R-003) - 10 min
4. **Add pagination to list_user_static_groups** (P-003) - 15 min

---

*Report generated 2026-01-01, verified 2026-01-02*
