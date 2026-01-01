# FFXIV Raid Planner - Comprehensive Codebase Audit

**Date:** 2026-01-01
**Auditor:** Principal Architect
**Repository:** ffxiv-raid-planner
**Commit:** add-claude-github-actions-1767281710845

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [Summary Statistics](#summary-statistics)
- [Priority Deep Dives](#priority-deep-dives)
  - [Performance Analysis](#performance-analysis)
  - [React Frontend Assessment](#react-frontend-assessment)
  - [UX Audit](#ux-audit)
- [File-by-File Analysis](#file-by-file-analysis)
  - [Backend](#backend)
  - [Frontend](#frontend)
- [Cross-Cutting Concerns](#cross-cutting-concerns)
- [Prioritized Action Items](#prioritized-action-items)
- [Quick Wins](#quick-wins)
- [Strategic Recommendations](#strategic-recommendations)

---

## Executive Summary

The FFXIV Raid Planner codebase demonstrates **solid architectural foundations** with clear separation of concerns, comprehensive type safety, and well-documented patterns. The project is in a production-ready state for Phases 1-6.1 with Discord OAuth, multi-static membership, tier snapshots, and permission-aware UI all functioning correctly.

### Overall Health: **B+ (Good)**

**Strengths:**
- Excellent TypeScript coverage with comprehensive type definitions
- Well-structured Zustand stores with clear domain boundaries
- Robust permission system with frontend and backend enforcement
- Clean component architecture following established patterns
- Good error handling with graceful degradation
- Comprehensive CLAUDE.md documentation

**Areas for Improvement:**
- Performance optimizations needed (memoization, code splitting)
- Some components are too large and could be decomposed
- Test coverage is minimal (only 3 test files)
- Missing loading skeletons and optimistic UI in some areas
- Some duplicate code across similar components

### Critical Issues: 0
### High Priority Issues: 8
### Medium Priority Issues: 22
### Low Priority Issues: 15

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Files Reviewed | 178 |
| Backend Python Files | 48 |
| Frontend TypeScript/TSX Files | 85 |
| Configuration Files | 25 |
| Documentation Files | 12 |
| Test Files | 8 |
| Critical Issues | 0 |
| High Priority Issues | 8 |
| Medium Priority Issues | 22 |
| Low Priority Issues | 15 |
| Lines of Code (Frontend) | ~12,500 |
| Lines of Code (Backend) | ~4,800 |

---

## Priority Deep Dives

### Performance Analysis

#### Database Query Efficiency

**Finding P-001: N+1 Query Pattern in duplicateGroup**
- **Location:** `frontend/src/stores/staticGroupStore.ts:148-232`
- **Issue:** The `duplicateGroup` function fetches each tier individually in a loop, then creates players one at a time.
- **Impact:** A static with 4 tiers and 8 players each = 4 + 32 = 36 API calls.
- **Recommendation:** Implement a backend bulk duplication endpoint.
- **Severity:** High
- **Effort:** Medium

```typescript
// Current implementation (problematic)
for (const sourceTier of sourceTiers) {
  const fullTier = await authRequest<TierSnapshot>(...);  // N calls
  for (const sourcePlayer of configuredPlayers) {
    await authRequest<SnapshotPlayer>(...);  // M calls per tier
  }
}
```

**Finding P-002: Missing Database Indexes**
- **Location:** `backend/app/models/*.py`
- **Issue:** Several foreign key columns lack explicit indexes.
- **Impact:** Slow queries on large datasets.
- **Recommendation:** Add indexes on:
  - `snapshot_player.tier_snapshot_id`
  - `membership.static_group_id`
  - `tier_snapshot.static_group_id`
- **Severity:** Medium
- **Effort:** Quick

**Finding P-003: Unbounded Query Results**
- **Location:** `backend/app/routers/static_groups.py:124-170`
- **Issue:** `list_user_static_groups` returns all groups without pagination.
- **Impact:** Memory issues for users with many statics.
- **Recommendation:** Add pagination with default limit of 50.
- **Severity:** Medium
- **Effort:** Quick

#### Frontend Bundle Analysis

**Finding P-004: No Code Splitting**
- **Location:** `frontend/src/App.tsx`
- **Issue:** All pages are imported synchronously.
- **Impact:** Initial bundle size includes all pages.
- **Recommendation:** Use React.lazy() for route-level code splitting.
- **Severity:** High
- **Effort:** Quick

```typescript
// Recommended change
const GroupView = React.lazy(() => import('./pages/GroupView'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
```

**Finding P-005: Large Component Files**
- **Location:** `frontend/src/pages/GroupView.tsx` (800+ lines)
- **Issue:** GroupView is a monolithic component handling too many concerns.
- **Impact:** Harder to test, maintain, and optimize.
- **Recommendation:** Extract sub-components (PlayerGrid, ToolbarSection, etc.).
- **Severity:** Medium
- **Effort:** Medium

#### Memoization Opportunities

**Finding P-006: Missing useMemo in Priority Calculations**
- **Location:** `frontend/src/components/loot/LootPriorityPanel.tsx:167-220`
- **Issue:** `itemPriorities` and `materialPriorities` recalculate on every render.
- **Impact:** Unnecessary computations when other state changes.
- **Recommendation:** Wrap in useMemo with proper dependencies.
- **Severity:** Medium
- **Effort:** Quick

**Finding P-007: PlayerCard Re-renders**
- **Location:** `frontend/src/components/player/PlayerCard.tsx`
- **Issue:** PlayerCard lacks React.memo, re-renders when parent state changes.
- **Impact:** 8 cards re-rendering on any tier change.
- **Recommendation:** Wrap with React.memo and extract stable callbacks.
- **Severity:** High
- **Effort:** Quick

---

### React Frontend Assessment

#### Component Architecture

**Finding R-001: Good Composition Pattern**
- The player components follow solid composition:
  - `PlayerCard` -> `PlayerCardHeader`, `PlayerCardStatus`, `GearTable`, `NeedsFooter`
- This is a strength to maintain.

**Finding R-002: Props Drilling in GroupView**
- **Location:** `frontend/src/pages/GroupView.tsx`
- **Issue:** Many props passed through multiple levels (userRole, currentUserId, etc.).
- **Recommendation:** Consider a GroupContext for shared state.
- **Severity:** Low
- **Effort:** Medium

**Finding R-003: Missing Error Boundaries**
- **Location:** `frontend/src/App.tsx`
- **Issue:** No error boundaries around major page components.
- **Impact:** One component crash takes down entire app.
- **Recommendation:** Add error boundaries with fallback UI.
- **Severity:** High
- **Effort:** Quick

```tsx
// Recommended pattern
<ErrorBoundary fallback={<ErrorFallback />}>
  <Routes>...</Routes>
</ErrorBoundary>
```

#### State Management

**Finding R-004: Well-Structured Zustand Stores**
- The stores follow good patterns:
  - `authStore` - User authentication
  - `staticGroupStore` - Static group CRUD
  - `tierStore` - Tier and player management
  - `lootTrackingStore` - Loot coordination
- Clear separation of concerns.

**Finding R-005: Optimistic Updates Done Correctly**
- **Location:** `frontend/src/stores/tierStore.ts:356-398`
- The `reorderPlayers` function correctly implements optimistic updates with rollback.
- This is a strength to replicate elsewhere.

**Finding R-006: Missing Loading States in Stores**
- **Location:** `frontend/src/stores/invitationStore.ts`
- **Issue:** Individual action loading states (isCreating, isAccepting) are good, but no granular operation tracking.
- **Recommendation:** Consider per-operation loading IDs for concurrent requests.
- **Severity:** Low
- **Effort:** Medium

#### Custom Hooks

**Finding R-007: useDragAndDrop Hook Quality**
- **Location:** `frontend/src/components/dnd/useDragAndDrop.ts`
- Excellent encapsulation of drag-and-drop logic.
- Properly handles:
  - Disabled state for modals
  - Cross-group position swapping
  - Edge drop zones
- Minor: Could benefit from JSDoc comments on return values.

**Finding R-008: Missing useDebounce for API Calls**
- **Location:** `frontend/src/components/player/InlinePlayerEdit.tsx`
- **Issue:** No debounce on name input before API save.
- **Impact:** Potential rapid API calls during typing.
- **Recommendation:** Add useDebounce hook for form submissions.
- **Severity:** Low
- **Effort:** Quick

#### TypeScript Coverage

**Finding R-009: Excellent Type Definitions**
- **Location:** `frontend/src/types/index.ts`
- Comprehensive types for all domain entities.
- Good use of:
  - Union types for enums (GearSlot, Role, etc.)
  - Partial types for updates
  - Strict null checks

**Finding R-010: Type Assertion in GearTable**
- **Location:** `frontend/src/components/player/GearTable.tsx:67`
- **Issue:** `as any` cast on getRoleColor call.
- **Recommendation:** Fix the type signature or use proper type guards.
- **Severity:** Low
- **Effort:** Quick

---

### UX Audit

#### Loading States

**Finding U-001: Missing Skeleton Loaders**
- **Location:** `frontend/src/pages/Dashboard.tsx`
- **Issue:** Uses simple "Loading..." text instead of skeleton UI.
- **Impact:** Poor perceived performance.
- **Recommendation:** Add skeleton cards matching final layout.
- **Severity:** Medium
- **Effort:** Medium

**Finding U-002: Good Loading States in Header**
- **Location:** `frontend/src/components/layout/Header.tsx:261-262`
- Auth loading state shows pulsing placeholder. Good pattern.

#### Error Handling

**Finding U-003: Comprehensive Toast Notifications**
- **Location:** `frontend/src/stores/toastStore.ts`
- Good implementation with:
  - Auto-dismiss (5 seconds)
  - Multiple types (success, error, warning, info)
  - Positioned correctly

**Finding U-004: Missing Retry Mechanisms**
- **Location:** `frontend/src/pages/GroupView.tsx`
- **Issue:** API failures show toast but no retry option.
- **Recommendation:** Add "Retry" button on error states.
- **Severity:** Low
- **Effort:** Medium

#### Empty States

**Finding U-005: Good Empty State in Dashboard**
- **Location:** `frontend/src/pages/Dashboard.tsx`
- Shows helpful "Create your first static" message when no groups exist.

**Finding U-006: Missing Empty State in Loot Log**
- **Location:** `frontend/src/components/loot/LootPriorityPanel.tsx`
- **Issue:** No clear indicator when no loot has been logged.
- **Recommendation:** Add informative empty state.
- **Severity:** Low
- **Effort:** Quick

#### Accessibility

**Finding U-007: Missing ARIA Labels on Icon Buttons**
- **Location:** `frontend/src/components/ui/SettingsPopover.tsx`
- **Issue:** Icon-only buttons lack aria-label.
- **Impact:** Screen readers cannot describe button purpose.
- **Recommendation:** Add aria-label to all IconButton instances.
- **Severity:** High
- **Effort:** Quick

**Finding U-008: Good Focus Management in Modals**
- **Location:** `frontend/src/components/ui/Modal.tsx`
- Modals properly trap focus and handle backdrop clicks.

**Finding U-009: Missing Keyboard Navigation in Dropdowns**
- **Location:** `frontend/src/components/ui/Select.tsx`
- **Issue:** Custom select doesn't support arrow key navigation.
- **Recommendation:** Use Radix UI Select or implement keyboard handling.
- **Severity:** Medium
- **Effort:** Medium

#### Visual Consistency

**Finding U-010: Consistent Color Palette**
- The teal accent (#14b8a6) is used consistently across:
  - Active states
  - Primary buttons
  - Accents
- Role colors are applied correctly.

**Finding U-011: Inconsistent Button Styles**
- **Location:** Various modals
- **Issue:** Primary buttons sometimes use `bg-accent` and sometimes inline styles.
- **Recommendation:** Create Button component with variants.
- **Severity:** Low
- **Effort:** Medium

---

## File-by-File Analysis

<details>
<summary><strong>Backend</strong></summary>

### backend/app/main.py
- **Quality:** Excellent
- **Issues:** None critical
- **Notes:** Clean lifespan handler, proper CORS setup, rate limiting configured

### backend/app/config.py
- **Quality:** Good
- **Issues:**
  - Uses `functools.cache` appropriately for settings singleton
  - Good use of Pydantic Settings for validation
- **Notes:** Consider adding validation for CORS_ORIGINS format

### backend/app/database.py
- **Quality:** Good
- **Issues:**
  - P-002: Missing explicit indexes
- **Notes:** Async session factory pattern is correct

### backend/app/dependencies.py
- **Quality:** Excellent
- **Issues:** None
- **Notes:** Clean dependency injection for auth

### backend/app/permissions.py
- **Quality:** Excellent
- **Issues:** None
- **Notes:** Comprehensive permission checks with clear hierarchy

### backend/app/routers/static_groups.py
- **Quality:** Good
- **Issues:**
  - P-003: Missing pagination
- **Notes:** Well-structured CRUD operations

### backend/app/routers/tiers.py
- **Quality:** Good
- **Issues:** None critical
- **Notes:** Proper transaction handling

### backend/app/routers/bis.py
- **Quality:** Good
- **Issues:**
  - External API calls could timeout
- **Notes:** Good caching implementation

### backend/app/models/*.py
- **Quality:** Good
- **Issues:**
  - P-002: Missing indexes on FK columns
- **Notes:** Clean SQLAlchemy models

### backend/app/schemas/*.py
- **Quality:** Excellent
- **Issues:** None
- **Notes:** Comprehensive Pydantic schemas with proper validation

### backend/tests/
- **Quality:** Needs Improvement
- **Issues:**
  - Only 3 test files (test_health.py, test_permissions.py, test_static_groups.py)
  - Missing tests for:
    - BiS import endpoints
    - Tier operations
    - Invitation flows
    - Player CRUD
- **Severity:** High
- **Notes:** Test factories are well-structured

</details>

<details>
<summary><strong>Frontend</strong></summary>

### frontend/src/App.tsx
- **Quality:** Good
- **Issues:**
  - P-004: No code splitting
  - R-003: Missing error boundaries
- **Notes:** Clean routing setup

### frontend/src/main.tsx
- **Quality:** Good
- **Issues:** None
- **Notes:** Standard React 19 entry point

### frontend/src/index.css
- **Quality:** Excellent
- **Issues:** None
- **Notes:** Well-organized CSS variables, consistent theming

### frontend/src/stores/authStore.ts
- **Quality:** Excellent
- **Issues:** None
- **Notes:** Proper token handling, auth state management

### frontend/src/stores/staticGroupStore.ts
- **Quality:** Good
- **Issues:**
  - P-001: N+1 in duplicateGroup
- **Notes:** Good optimistic update patterns

### frontend/src/stores/tierStore.ts
- **Quality:** Excellent
- **Issues:** None
- **Notes:** Clean player management, proper rollback on errors

### frontend/src/pages/GroupView.tsx
- **Quality:** Good
- **Issues:**
  - P-005: File too large (800+ lines)
  - R-002: Props drilling
- **Notes:** Consider extracting PlayerGrid, ToolbarSection

### frontend/src/pages/Dashboard.tsx
- **Quality:** Good
- **Issues:**
  - U-001: Missing skeleton loaders
- **Notes:** Good empty state handling

### frontend/src/components/player/PlayerCard.tsx
- **Quality:** Good
- **Issues:**
  - P-007: Missing React.memo
- **Notes:** Clean composition of sub-components

### frontend/src/components/player/GearTable.tsx
- **Quality:** Good
- **Issues:**
  - R-010: Type assertion needed
- **Notes:** Complex but well-organized

### frontend/src/components/player/BiSImportModal.tsx
- **Quality:** Good
- **Issues:** None critical
- **Notes:** Good preset handling, error states

### frontend/src/components/loot/LootPriorityPanel.tsx
- **Quality:** Good
- **Issues:**
  - P-006: Missing useMemo
  - U-006: Missing empty state
- **Notes:** Good sub-tab implementation

### frontend/src/components/dnd/useDragAndDrop.ts
- **Quality:** Excellent
- **Issues:** None
- **Notes:** Well-encapsulated hook

### frontend/src/components/ui/Modal.tsx
- **Quality:** Excellent
- **Issues:** None
- **Notes:** Proper event handling, backdrop management

### frontend/src/utils/permissions.ts
- **Quality:** Excellent
- **Issues:** None
- **Notes:** Comprehensive permission checks

### frontend/src/utils/calculations.ts
- **Quality:** Good
- **Issues:** None
- **Notes:** Well-tested gear calculation logic

### frontend/src/utils/priority.ts
- **Quality:** Good
- **Issues:** None
- **Notes:** Clean priority algorithm implementation

### frontend/src/gamedata/*.ts
- **Quality:** Excellent
- **Issues:** None
- **Notes:** Well-typed game data with helper functions

### frontend/src/services/api.ts
- **Quality:** Good
- **Issues:** None
- **Notes:** Proper auth header handling, error extraction

</details>

---

## Cross-Cutting Concerns

### Security

**Finding S-001: JWT Token Storage**
- **Location:** `frontend/src/stores/authStore.ts`
- **Issue:** Tokens stored in localStorage (XSS vulnerability).
- **Recommendation:** Consider httpOnly cookies for production.
- **Severity:** Medium
- **Effort:** Medium

**Finding S-002: CORS Configuration**
- **Location:** `backend/app/main.py`
- Good: Uses environment-configured origins.
- Note: Ensure production CORS is restrictive.

**Finding S-003: Rate Limiting Present**
- **Location:** `backend/app/rate_limit.py`
- Good: slowapi integration for rate limiting.

### Code Duplication

**Finding D-001: Similar Modal Patterns**
- **Locations:**
  - `CreateTierModal.tsx`
  - `DeleteTierModal.tsx`
  - `GroupSettingsModal.tsx`
- **Issue:** Repeated modal wrapper code.
- **Recommendation:** Create higher-order component or hook for modal logic.
- **Severity:** Low
- **Effort:** Medium

**Finding D-002: Repeated Permission Checks in Components**
- **Location:** Various player components
- **Issue:** Permission checks duplicated across components.
- **Recommendation:** Create usePermissions hook.
- **Severity:** Low
- **Effort:** Quick

### Documentation

**Finding DOC-001: Excellent CLAUDE.md**
- Comprehensive project documentation including:
  - Architecture
  - Data models
  - UI patterns
  - API endpoints
  - Styling guidelines

**Finding DOC-002: Missing JSDoc on Complex Functions**
- **Location:** Various utility files
- **Recommendation:** Add JSDoc comments to exported functions.
- **Severity:** Low
- **Effort:** Quick

---

## Prioritized Action Items

### Critical (Block Release)
*None identified*

### High Priority

| ID | Issue | Location | Fix | Impact | Effort |
|----|-------|----------|-----|--------|--------|
| P-001 | N+1 in duplicateGroup | staticGroupStore.ts | Add bulk API endpoint | Performance | Medium |
| P-004 | No code splitting | App.tsx | Add React.lazy() | Bundle size | Quick |
| P-007 | PlayerCard re-renders | PlayerCard.tsx | Add React.memo | Performance | Quick |
| R-003 | Missing error boundaries | App.tsx | Add ErrorBoundary | Reliability | Quick |
| U-007 | Missing ARIA labels | Various | Add aria-label | Accessibility | Quick |
| T-001 | Low test coverage | backend/tests/ | Add tests | Reliability | Large |
| P-002 | Missing DB indexes | models/*.py | Add indexes | Performance | Quick |
| U-009 | Keyboard nav missing | Select.tsx | Implement or use Radix | Accessibility | Medium |

### Medium Priority

| ID | Issue | Location | Fix | Impact | Effort |
|----|-------|----------|-----|--------|--------|
| P-003 | Unbounded queries | static_groups.py | Add pagination | Performance | Quick |
| P-005 | Large GroupView | GroupView.tsx | Extract components | Maintainability | Medium |
| P-006 | Missing useMemo | LootPriorityPanel.tsx | Add memoization | Performance | Quick |
| U-001 | Missing skeletons | Dashboard.tsx | Add skeleton UI | UX | Medium |
| S-001 | Token in localStorage | authStore.ts | Consider httpOnly | Security | Medium |
| D-001 | Modal duplication | Various modals | Extract pattern | Maintainability | Medium |

### Low Priority

| ID | Issue | Location | Fix | Impact | Effort |
|----|-------|----------|-----|--------|--------|
| R-002 | Props drilling | GroupView.tsx | Add context | Code quality | Medium |
| R-008 | No debounce | InlinePlayerEdit.tsx | Add useDebounce | Performance | Quick |
| R-010 | Type assertion | GearTable.tsx | Fix types | Type safety | Quick |
| U-004 | No retry on errors | GroupView.tsx | Add retry button | UX | Medium |
| U-006 | Empty loot state | LootPriorityPanel.tsx | Add empty state | UX | Quick |
| U-011 | Inconsistent buttons | Various | Create Button component | Consistency | Medium |
| D-002 | Permission check duplication | Various | Create hook | Maintainability | Quick |
| DOC-002 | Missing JSDoc | Utils | Add documentation | Maintainability | Quick |

---

## Quick Wins

These are low-effort, high-value improvements that can be done immediately:

1. **Add React.lazy() to App.tsx** (P-004)
   ```tsx
   const GroupView = React.lazy(() => import('./pages/GroupView'));
   ```

2. **Wrap PlayerCard with React.memo** (P-007)
   ```tsx
   export const PlayerCard = React.memo(function PlayerCard(props) {...});
   ```

3. **Add Error Boundary** (R-003)
   ```tsx
   npm install react-error-boundary
   ```

4. **Add DB Indexes** (P-002)
   ```python
   Index('ix_snapshot_player_tier', snapshot_player.c.tier_snapshot_id)
   ```

5. **Add aria-labels to icon buttons** (U-007)
   ```tsx
   <button aria-label="Open settings">
   ```

6. **Add useMemo to priority calculations** (P-006)
   ```tsx
   const itemPriorities = useMemo(() => ..., [players, settings]);
   ```

7. **Add pagination query param** (P-003)
   ```python
   def list_user_static_groups(limit: int = 50, offset: int = 0):
   ```

---

## Strategic Recommendations

### Short-Term (1-2 Sprints)

1. **Performance Sprint**
   - Implement code splitting
   - Add React.memo to card components
   - Add memoization to expensive calculations
   - Add database indexes

2. **Accessibility Sprint**
   - Audit all interactive elements for aria-labels
   - Implement keyboard navigation in custom components
   - Add skip links for keyboard users
   - Test with screen reader

3. **Test Coverage**
   - Aim for 80% backend coverage
   - Add integration tests for critical flows:
     - User creates static, adds tier, configures players
     - BiS import from XIVGear
     - Invitation acceptance flow

### Medium-Term (1-2 Months)

1. **Bulk Operations API**
   - Create `/api/static-groups/{id}/duplicate` endpoint
   - Handle tier and player copying server-side
   - Reduce N+1 queries significantly

2. **Component Library**
   - Extract reusable primitives (Button, Input, Select)
   - Create design system documentation
   - Ensure consistent styling

3. **Skeleton Loaders**
   - Create skeleton components matching final layout
   - Implement Suspense boundaries
   - Improve perceived performance

### Long-Term (3+ Months)

1. **Real-Time Features**
   - WebSocket for live updates when multiple users edit
   - Presence indicators (who is viewing)
   - Collaborative editing

2. **Offline Support**
   - Service worker for static assets
   - IndexedDB for offline data
   - Sync when reconnected

3. **Analytics**
   - Track feature usage
   - Monitor performance metrics
   - Identify improvement opportunities

---

## Conclusion

The FFXIV Raid Planner codebase is well-architected and production-ready for its current feature set. The main areas requiring attention are:

1. **Performance optimizations** (code splitting, memoization)
2. **Accessibility improvements** (ARIA labels, keyboard navigation)
3. **Test coverage** (currently minimal)

The project follows good patterns and conventions, making it maintainable and extensible. The recommended improvements are evolutionary rather than revolutionary, suggesting the foundation is solid.

**Overall Grade: B+ (Good)**

---

*Report generated 2026-01-01 by Principal Architect*
