# FFXIV Raid Planner - Comprehensive Codebase Audit

**Date:** 2026-01-01
**Last Verified:** 2026-01-09
**Quick Wins Fixed:** 2026-01-02
**v1.0.1 Fixes:** 2026-01-09
**Auditor:** Principal Architect
**Repository:** ffxiv-raid-planner
**Status:** v1.0.1 Released

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
- Some components are too large and could be decomposed (GroupView.tsx)
- Missing loading skeletons in Dashboard
- Rate limiting not yet implemented

### Issue Summary

| Priority | Total | Open | Fixed | Invalid |
|----------|-------|------|-------|---------|
| High | 8 | 0 | 7 | 1 |
| Medium | 6 | 4 | 2 | 0 |
| Low | 5 | 3 | 2 | 0 |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Frontend TypeScript/TSX Files | ~90 |
| Backend Python Files | ~55 |
| Test Files | 12 (6 backend + 6 frontend) |
| Total Tests | 237 (95 backend + 142 frontend) |
| Lines of Code (Frontend) | ~14,000 |
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
| T-001 | Low test coverage | **FIXED** | 237 tests (v1.0.1) |
| U-007 | Missing ARIA labels | **FIXED** | IconButton requires aria-label |
| U-009 | Keyboard nav in Select | **INVALID** | Uses native `<select>` |

### Medium Priority

| ID | Issue | Status | Notes |
|----|-------|--------|-------|
| P-003 | Unbounded queries | **FIXED** | Pagination with limit=50, max=100 |
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

### Medium Priority

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

### P-001: N+1 Query Pattern in duplicateGroup ✅ (v1.0.1)
- **Resolution:** Implemented bulk `POST /api/static-groups/{id}/duplicate` endpoint that:
  - Creates entire group, tiers, and players in a single database transaction
  - Resets tracking data (current_week, week_start_date, loot history)
  - Resets player ownership (user_id cleared)
  - Deep copies settings to prevent shared references
  - Ensures only one tier is active in duplicated group

### T-001: Low Test Coverage ✅ (v1.0.1)
- **Resolution:** Comprehensive test suite with 237 total tests:
  - **Backend (95 tests):** auth, config validation, group duplication, tier activation, integration tests
  - **Frontend (142 tests):** error handling, logging, event bus, Zustand selectors, calculations

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

All quick wins have been implemented ✅

---

*Report generated 2026-01-01, verified 2026-01-02, quick wins fixed 2026-01-02, v1.0.1 updates 2026-01-09*
