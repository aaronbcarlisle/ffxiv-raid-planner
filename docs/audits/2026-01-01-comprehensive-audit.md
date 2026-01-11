# FFXIV Raid Planner - Comprehensive Codebase Audit

**Date:** 2026-01-01
**Last Verified:** 2026-01-11
**Quick Wins Fixed:** 2026-01-02
**v1.0.1 Fixes:** 2026-01-09
**v1.0.5 Fixes:** 2026-01-10
**v1.0.6 Fixes:** 2026-01-11
**v1.0.7 Fixes:** 2026-01-11 (PR #21)
**Auditor:** Principal Architect
**Repository:** ffxiv-raid-planner
**Status:** v1.0.7 Released - Audit Complete

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [Summary Statistics](#summary-statistics)
- [Findings Status Summary](#findings-status-summary)
- [Open Issues](#open-issues)
- [Resolved Issues](#resolved-issues)
- [Quick Wins](#quick-wins)

---

## Executive Summary

The FFXIV Raid Planner codebase demonstrates **solid architectural foundations** with clear separation of concerns, comprehensive type safety, and well-documented patterns. The project is in a production-ready state for Phases 1-6.5 with Discord OAuth, multi-static membership, tier snapshots, permission-aware UI, loot tracking, weapon priority, and book tracking all functioning correctly.

### Overall Health: **A- (Excellent)**

**Strengths:**
- Excellent TypeScript coverage with comprehensive type definitions
- Well-structured Zustand stores with clear domain boundaries
- Robust permission system with frontend and backend enforcement
- Clean component architecture following established patterns
- Good error handling with graceful degradation and retry mechanisms
- Comprehensive CLAUDE.md documentation
- Proper database indexing on all FK columns
- Accessible IconButton component with required aria-label
- Reusable hooks (useModal, useDebounce) reducing boilerplate
- Skeleton loaders for improved perceived performance
- Unified Button component with semantic variants

**Areas for Future Enhancement:**
- Rate limiting not yet implemented (low priority)
- R-002: Props drilling could be addressed with GroupContext (deferred - hooks mitigate this)

### Issue Summary

| Priority | Total | Open | Fixed | Invalid | Deferred |
|----------|-------|------|-------|---------|----------|
| High | 8 | 0 | 7 | 1 | 0 |
| Medium | 6 | 0 | 6 | 0 | 0 |
| Low | 5 | 0 | 4 | 0 | 1 |

**All actionable audit items have been resolved.**

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Frontend TypeScript/TSX Files | ~95 |
| Backend Python Files | ~55 |
| Test Files | 18 (6 backend + 12 frontend) |
| Total Tests | 456 (137 backend + 319 frontend) |
| Lines of Code (Frontend) | ~15,000 |
| Lines of Code (Backend) | ~5,500 |

---

## Findings Status Summary

### High Priority

| ID | Issue | Status | Notes |
|----|-------|--------|-------|
| P-001 | N+1 in duplicateGroup | **FIXED** | Bulk `/duplicate` endpoint (v1.0.1) |
| P-002 | Missing DB indexes | **FIXED** | All FK columns indexed + 6 new indexes (v1.0.1) |
| P-004 | No code splitting | **FIXED** | React.lazy() for all pages |
| P-007 | PlayerCard re-renders | **FIXED** | Wrapped with React.memo |
| R-003 | Missing error boundaries | **FIXED** | ErrorBoundary wraps Routes |
| T-001 | Low test coverage | **FIXED** | 456 tests (v1.0.7) |
| U-007 | Missing ARIA labels | **FIXED** | IconButton requires aria-label |
| U-009 | Keyboard nav in Select | **INVALID** | Uses native `<select>` |

### Medium Priority

| ID | Issue | Status | Notes |
|----|-------|--------|-------|
| P-003 | Unbounded queries | **FIXED** | Pagination with limit=50, max=100 |
| P-005 | Large GroupView | **FIXED** | Refactored to 788 lines with 6 extracted modules (v1.0.5) |
| P-006 | Missing useMemo | **FIXED** | LootPriorityPanel uses useMemo |
| S-001 | Token in localStorage | **FIXED** | Migrated to httpOnly cookies (v1.0.6) |
| U-001 | Missing skeletons | **FIXED** | StaticGridSkeleton, StaticListSkeleton added (v1.0.7) |
| D-001 | Modal duplication | **FIXED** | useModal, useModalWithData hooks (v1.0.7) |

### Low Priority

| ID | Issue | Status | Notes |
|----|-------|--------|-------|
| R-002 | Props drilling | **DEFERRED** | Hooks mitigate; GroupContext optional |
| R-008 | No debounce | **FIXED** | useDebounce, useDebouncedCallback hooks (v1.0.7) |
| U-004 | No retry on errors | **FIXED** | ErrorMessage component with retry (v1.0.7) |
| U-006 | Empty loot state | **FIXED** | Shows "No one needs" |
| U-011 | Inconsistent buttons | **FIXED** | Button component with 7 variants (v1.0.7) |

---

## Open Issues

### Deferred (Low Priority)

#### R-002: Props Drilling in GroupView
- **Location:** `frontend/src/pages/GroupView.tsx`
- **Issue:** Some props passed through multiple levels.
- **Status:** Deferred - The extracted hooks (useGroupViewState, usePlayerActions, useViewNavigation) significantly reduce prop drilling. A GroupContext could further improve this but is not critical.
- **Recommendation:** Address when/if GroupView becomes harder to maintain.

---

## Resolved Issues

### U-001: Missing Skeleton Loaders ✅ (v1.0.7)
- **Resolution:** Added skeleton components for Dashboard loading states:
  - `StaticGridSkeleton` - Skeleton for grid view static cards
  - `StaticListSkeleton` - Skeleton for list view static rows
  - `Skeleton` base component for reuse
- **Files Changed:**
  - `frontend/src/components/ui/Skeleton.tsx` - New component
  - `frontend/src/pages/Dashboard.tsx` - Uses skeletons instead of spinner

### D-001: Modal Pattern Duplication ✅ (v1.0.7)
- **Resolution:** Created reusable modal state hooks:
  - `useModal()` - Simple open/close/toggle state
  - `useModalWithData<T>()` - Modal with associated data, auto-clears on close
- **Files Changed:**
  - `frontend/src/hooks/useModal.ts` - New hook with comprehensive tests
  - `frontend/src/hooks/useModal.test.ts` - 19 tests covering all functionality

### R-008: Missing useDebounce ✅ (v1.0.7)
- **Resolution:** Created debounce utilities:
  - `useDebounce<T>(value, delay)` - Debounce any value
  - `useDebouncedCallback<T>(callback, delay)` - Debounce function calls with cancel/flush
- **Files Changed:**
  - `frontend/src/hooks/useDebounce.ts` - New hook
  - `frontend/src/hooks/useDebounce.test.ts` - 15 tests with timer mocking

### U-004: Missing Retry Mechanism ✅ (v1.0.7)
- **Resolution:** Created ErrorMessage component with retry support:
  - Displays error icon, message, and optional retry button
  - `InlineError` variant for form field errors
  - Accessible with `role="alert"` and proper ARIA attributes
- **Files Changed:**
  - `frontend/src/components/ui/ErrorMessage.tsx` - New component
  - `frontend/src/pages/Dashboard.tsx` - Uses ErrorMessage with retry

### U-011: Inconsistent Button Styles ✅ (v1.0.7)
- **Resolution:** Extended Button component with additional variants:
  - Added `success` variant for positive actions
  - Added `link` variant for inline link-style buttons
  - Total 7 variants: primary, secondary, ghost, danger, warning, success, link
- **Files Changed:**
  - `frontend/src/components/primitives/Button.tsx` - Added variants

### S-001: JWT Token Storage ✅ (v1.0.6)
- **Resolution:** Migrated authentication from localStorage to httpOnly cookies:
  - Access and refresh tokens stored in httpOnly cookies (not accessible to JavaScript)
  - SameSite=Lax attribute prevents CSRF attacks
  - Secure flag ensures cookies only sent over HTTPS in production
  - Protected logout endpoint requires valid access token
  - Removed auth state persistence from localStorage to prevent stale state
  - Automatic token refresh before logout if access token expired
- **Files Changed:**
  - `backend/app/routers/auth.py` - Cookie-based token management
  - `frontend/src/stores/authStore.ts` - Removed localStorage, added credentials: include
  - `frontend/src/lib/api.ts` - Global credentials: include for all API calls

### P-005: Large Component File ✅ (v1.0.5)
- **Resolution:** Refactored GroupView.tsx from 1468 → 788 lines (46% reduction) by extracting:
  - `useGroupViewState` hook (343 lines) - URL params, localStorage sync, tab state
  - `usePlayerActions` hook (210 lines) - Player CRUD operations
  - `useGroupViewKeyboardShortcuts` hook (219 lines) - Keyboard shortcut configuration
  - `useViewNavigation` hook (87 lines) - Cross-tab navigation helpers
  - `PlayerGrid` component (250 lines) - Grid rendering with group view and subs
  - `AdminBanners` component (69 lines) - Admin access and View As indicators

### P-001: N+1 Query Pattern in duplicateGroup ✅ (v1.0.1)
- **Resolution:** Implemented bulk `POST /api/static-groups/{id}/duplicate` endpoint that:
  - Creates entire group, tiers, and players in a single database transaction
  - Resets tracking data (current_week, week_start_date, loot history)
  - Resets player ownership (user_id cleared)
  - Deep copies settings to prevent shared references
  - Ensures only one tier is active in duplicated group

### T-001: Low Test Coverage ✅ (v1.0.7)
- **Resolution:** Comprehensive test suite with 456 total tests:
  - **Backend (137 tests):** auth, config validation, group duplication, tier activation, integration tests
  - **Frontend (319 tests):** error handling, logging, event bus, Zustand selectors, calculations, useModal (19), useDebounce (15)

### P-002: Missing Database Indexes ✅ (v1.0.1 Enhanced)
- **Resolution:** Original FK indexes plus 6 additional indexes added:
  - `snapshot_players.position` for player queries
  - Composite indexes on loot_log_entries (tier_id + week)
  - Composite indexes on material_log_entries (tier_id + week)
  - Composite indexes on page_ledger_entries (tier_id + player_id)

### P-003: Unbounded Query Results ✅
- **Resolution:** Added `limit` (default 50, max 100) and `offset` parameters to `list_user_static_groups` endpoint.

### P-004: No Code Splitting ✅
- **Resolution:** All page components now use `React.lazy()` with dynamic imports in `App.tsx`.

### P-007: PlayerCard Re-renders ✅
- **Resolution:** `PlayerCard` component wrapped with `React.memo()` to prevent unnecessary re-renders.

### R-003: Missing Error Boundaries ✅
- **Resolution:** Added `react-error-boundary` package and wrapped Routes with `ErrorBoundary` component including:
  - Custom `ErrorFallback` component with retry button
  - `Suspense` wrapper with `PageLoader` for lazy-loaded components

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

All quick wins have been implemented ✅

---

*Report generated 2026-01-01, verified 2026-01-02, quick wins fixed 2026-01-02, v1.0.1 updates 2026-01-09, v1.0.5 updates 2026-01-10, v1.0.6 updates 2026-01-11, v1.0.7 updates 2026-01-11*
