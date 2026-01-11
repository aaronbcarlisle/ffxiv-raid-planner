# FFXIV Raid Planner - Outstanding Work

**Last Updated:** January 11, 2026 (Validated against codebase)
**Current Version:** v1.0.8 (Modal Polish Complete)
**Purpose:** Single source of truth for all remaining implementation work, validated against the actual codebase.

---

## Quick Reference

| Priority | Count | Estimated Hours |
|----------|-------|-----------------|
| **Critical (P0)** | 1 | 3 |
| **High (P1)** | 5 | 11 |
| **Medium (P2)** | 14 | 22 |
| **Low (P3)** | 8 | 15 |
| **Future (Phase 7+)** | 5 | TBD |
| **Total** | 33 | ~51 hrs |

---

## Critical Priority (P0) - Must Fix Immediately

### C-001: N+1 Query in Admin Dashboard
- **File:** `backend/app/routers/static_groups.py:359-445`
- **Issue:** Builds subqueries for counts but never uses them in SELECT. Instead, eager loads `tier_snapshots` and `memberships` collections, then counts them in Python. Causes 5-10+ second load times for large datasets.
- **Root Cause:** Lines 374-381 use `selectinload()` instead of using the subquery counts in `.add_columns()`
- **Fix:** Add subqueries to SELECT statement and remove eager loading of collections
- **Effort:** 3 hours

---

## High Priority (P1) - Complete This Sprint

### H-001: Missing Content-Security-Policy Header
- **File:** `backend/app/middleware/security.py`
- **Status:** SecurityHeadersMiddleware implements 6 headers but NO CSP
- **Issue:** No browser-level XSS protection for user-generated content
- **Fix:** Add CSP header with appropriate directives for SPA
- **Effort:** 2 hours

### H-002: SSRF Vulnerability in BiS Import (Partial)
- **File:** `backend/app/routers/bis.py:220, 333, 357, 407`
- **Status:** URLs are hardcoded (good) but `follow_redirects` not disabled
- **Issue:** `httpx.AsyncClient()` follows redirects by default, could be exploited
- **Fix:** Add `follow_redirects=False` to all AsyncClient instances
- **Effort:** 30 minutes

### H-003: No Pagination on Loot Log Endpoint
- **File:** `backend/app/routers/loot_tracking.py:93-147`
- **Issue:** GET endpoint returns all records with no limit/offset
- **Affected Endpoints:**
  - `/loot-log` (lines 93-147)
  - `/page-ledger` (lines 419-472)
  - `/material-log` (lines 876-927)
- **Fix:** Add limit/offset parameters with default 100, max 500
- **Effort:** 2 hours

### H-004: Missing Foreign Key Indexes
- **File:** `backend/app/models/loot_log_entry.py`
- **Issue:** FK columns (`recipient_player_id`, `tier_snapshot_id`, `created_by_user_id`) lack `index=True`
- **Fix:** Add `index=True` to all ForeignKey columns across models
- **Effort:** 1 hour

### H-005: No Request ID Tracking
- **File:** `backend/app/logging_config.py`
- **Issue:** structlog configured but no middleware to inject request IDs
- **Fix:** Implement RequestIDMiddleware, bind to contextvars for auto-inclusion
- **Effort:** 2 hours

---

## Medium Priority (P2) - Complete This Month

### M-001: Single Loading Flag Issue
- **File:** `frontend/src/stores/lootTrackingStore.ts`
- **Issue:** Single isLoading flag causes visual jitter with concurrent fetches
- **Fix:** Implement granular loading states: isLoadingLoot, isLoadingMaterials, isLoadingBalances
- **Effort:** 2 hours

### M-002: Inconsistent Error Display Patterns
- **File:** Various stores
- **Issue:** Mix of toast, inline, and modal error displays without clear pattern
- **Fix:** Standardize: Toast for user actions, Inline for validation, Modal for critical
- **Effort:** 3 hours

### M-003: OAuth State Validation Weakness
- **File:** `backend/app/routers/auth.py:49-86`
- **Issue:** OAuth state not bound to user session, vulnerable to CSRF
- **Fix:** Bind state to client IP and user agent
- **Effort:** 2 hours

### M-004: No CSRF Protection
- **File:** `backend/app/main.py`
- **Issue:** No CSRF tokens for state-changing operations
- **Fix:** Add CSRFMiddleware from Starlette
- **Effort:** 2 hours

### M-005: Insufficient BiS Path Input Validation
- **File:** `backend/app/routers/bis.py:111-148`
- **Issue:** Job/tier names not validated against whitelist
- **Fix:** Add job/tier whitelists and validate extracted values
- **Effort:** 1 hour

### M-006: No Rate Limiting on External API Calls
- **File:** `backend/app/routers/bis.py`
- **Issue:** 30/min rate limit too high for expensive operations
- **Fix:** Reduce to 10/min and add per-user limiting
- **Effort:** 1 hour

### M-007: Timing Attack on User Enumeration
- **File:** `backend/app/dependencies.py:39-47`
- **Issue:** Different error messages for invalid token vs user not found
- **Fix:** Use generic "Authentication failed" message for both cases
- **Effort:** 30 minutes

### M-008: Insecure JWT Algorithm Configuration
- **File:** `backend/app/config.py:81`
- **Issue:** JWT algorithm configurable without validation, could be set to "none"
- **Fix:** Use Literal type and validate allowed algorithms
- **Effort:** 30 minutes

### M-009: Missing Security Event Logging
- **File:** `backend/app/permissions.py:156-177`
- **Issue:** Permission denials and admin privilege usage not logged consistently
- **Fix:** Add logging to permission checks and auth endpoints
- **Effort:** 2 hours

### M-010: Inefficient Week Data Query
- **File:** `backend/app/routers/loot_tracking.py:817-870`
- **Issue:** Three separate queries to get distinct weeks when UNION would suffice
- **Fix:** Use union_all to consolidate into single query
- **Effort:** 1 hour

### M-011: No Database-Level Constraints
- **File:** `backend/app/models/*.py`
- **Issue:** Missing CHECK constraints for business logic (week_number > 0, quantity != 0)
- **Fix:** Add CheckConstraint to models
- **Effort:** 2 hours

### M-012: No Maximum Request Size Limit
- **File:** `backend/app/main.py`
- **Issue:** No limit on request body size, vulnerable to DoS
- **Fix:** Implement RequestSizeLimitMiddleware with 10MB cap
- **Effort:** 1 hour

### M-013: Inconsistent Border Radius
- **Pattern:** Across codebase
- **Issue:** Mix of rounded, rounded-lg, rounded-md used inconsistently
- **Fix:** Establish scale: rounded-sm (2px), rounded (4px), rounded-lg (8px), rounded-xl (12px)
- **Effort:** 2 hours

### M-014: Inconsistent Loading States
- **Files:** Dashboard.tsx, LootLogPanel.tsx, Button components
- **Issue:** Different spinners, text, and animations for loading
- **Fix:** Create unified Spinner component with size variants
- **Effort:** 2 hours

---

## Low Priority (P3) - Complete This Quarter

### L-001: Page Layout Consistency
- **Scope:** GroupView, Dashboard, AdminDashboard, docs pages
- **Issue:** 3-zone layout pattern (Header/Toolbar/Content) not consistently applied
- **Fix:** Create PageContainer component with layout variants
- **Effort:** 4 hours

### L-002: Design System Comprehensive Audit
- **Scope:** All 50+ components
- **Issue:** Need thorough review against design system specs
- **Action Items:**
  - Review all Button variants for consistent styling
  - Check all form inputs match design system specs
  - Verify color tokens used consistently
  - Ensure spacing and typography follow type scale
  - Check that all modals follow Modal pattern
  - Verify tables, badges, tooltips match design system
- **Effort:** 4 hours

### L-003: Materia in Gear Tooltip
- **File:** GearTable, BiS import
- **Issue:** Materia not shown in gear tooltip
- **Blocker:** Requires backend changes and cache regeneration
- **Effort:** 4 hours (deferred)

### L-004: Documentation Tasks
- **Missing Content:**
  1. API Cookbook Page - Create `/docs/api/cookbook` with Python/curl examples
  2. Visual Documentation - Add image/GIF placeholders for user flows
  3. Reorder Documentation Index - Getting Started first
  4. User Menu Documentation Sub-menu
- **Effort:** 3 hours

### L-005: No Database Migration Testing
- **File:** `backend/alembic/versions/*.py`
- **Issue:** No test suite to verify upgrade/downgrade paths work cleanly
- **Fix:** Create test_migrations.py with upgrade/downgrade tests
- **Effort:** 2 hours

### L-006: Missing OpenAPI Documentation Examples
- **Files:** Various routers
- **Issue:** OpenAPI docs missing request/response examples
- **Fix:** Add example objects to all endpoint definitions
- **Effort:** 2 hours

### L-007: Tier Duplication Bug (Investigation)
- **Location:** Frontend tier selection logic (GroupView.tsx:328-365) or localStorage
- **Issue:** Duplicated group opens with different tier than source
- **Note:** Backend tests pass - issue likely frontend
- **Effort:** 2 hours investigation

### L-008: PR #11 Minor Issues
- **File:** AdminDashboard.tsx
- **Issues:**
  1. Deprecated execCommand clipboard (line 162) - should show toast on fallback failure
  2. Stale members on fetch failure - clear viewAsMembers on API failure
  3. View As state race condition - add cancellation (low impact)
- **Effort:** 1 hour

---

## Future Phases (Not Started)

### Phase 7: Lodestone Auto-Sync
- Verify equipped gear against Lodestone API
- Character search and linking
- Scheduled sync with diff detection

### Phase 8: FFLogs Integration
- Parse logs for gear verification
- Link characters to FFLogs profiles
- Import fight data

### Phase 9: Discord Bot
- Notifications for loot drops
- Commands for priority lookup
- Integration with static group channels

### Alt Job Tracking (Deferred)
- Track multiple jobs per player
- Separate BiS configurations per job
- Alt priority calculations

### Loot System Redesign (Deferred)
- Customizable priority settings per group
- Unified week overview UI
- Enhanced summary tab
- Full 6-phase plan exists but deferred to after stabilization

---

## Recently Verified as Complete (v1.0.8)

The following items were validated against the actual codebase and confirmed as fixed:

| Item | Status | Verification |
|------|--------|--------------|
| **Session Auto-Commit** | FIXED | `database.py` has no auto-commit, explicit commits required |
| **Connection Pool** | OK | Development-appropriate; add config for production deployment |
| **useLootActions Hook** | FIXED | Line 53 correctly uses `currentTier?.tierId` |
| **SectionedLogView Size** | REFACTORED | Split into LootLogFilters, LootLogModals, WeeklyLootGrid, etc. |
| **Modal Focus Trap** | FIXED | Tab wrapping, focus restoration, requestAnimationFrame for timing |
| **Context Menu Navigation** | MOSTLY FIXED | Arrow keys + Home/End work; character search not implemented |
| **Toast ARIA** | FIXED | `aria-live="polite"`, `aria-atomic="false"`, `role="alert"` on items |
| **Hardcoded Colors** | FIXED | WeeklyLootGrid, LootCountBar, Tooltip all use design tokens |
| **Icon Button aria-labels** | FIXED | Dashboard, WeeklyLootGrid buttons have proper labels |
| **Focus Indicators** | FIXED | WeeklyLootGrid cells have `focus-visible:ring-2` |
| **Inline Log Buttons** | FIXED | GroupView line 695: `showLogButtons={canEdit}` |

---

## Verification Checklist

Before marking any item complete:

- [ ] Code changes reviewed
- [ ] Tests pass (if applicable)
- [ ] Manual testing verified
- [ ] No console errors
- [ ] Accessibility checked (if UI change)
- [ ] Mobile responsive (if UI change)

---

## Notes

### Deferred by Design
- **R-002 Props Drilling:** Deferred - hooks mitigate this adequately
- **Onboarding Tooltips:** Future enhancement, not blocking
- **Alt Job Linking:** Phase 7+ feature
- **Character Search in Context Menu:** Nice-to-have, not WCAG requirement

### Production Deployment Checklist
When deploying to production PostgreSQL, add to `database.py`:
```python
engine = create_async_engine(
    settings.async_database_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
)
```

---

**Document Consolidation:**
This file consolidates findings from 43 session handoffs, 10 audits, 9 plans, and 6 implementation docs.
All items have been validated against the actual codebase on January 11, 2026.
