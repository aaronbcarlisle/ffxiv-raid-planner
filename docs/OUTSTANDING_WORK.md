# FFXIV Raid Planner - Outstanding Work

**Last Updated:** January 18, 2026 (Session 5 Complete)
**Current Version:** v1.0.11
**Purpose:** Single source of truth for all remaining implementation work, validated against the actual codebase.

---

## Session Continuity (for AI assistants)

**Current Branch:** `feature/security-hardening-sprint` (pushed, not yet merged)
**Commit:** `a398392` - feat: security hardening sprint

**Session 5 completed 14 items:**
- All P1 and most P2 backend security items
- Middleware: RequestID, CSRF, RequestSizeLimit
- Auth: OAuth fingerprint, timing attack fix, JWT algorithm restriction
- API: BiS validation, rate limiting, query optimization, DB constraints
- Frontend: CSRF tokens, granular loading states

**Remaining work (3 P2 frontend polish items):**
- M-002: Error display standardization (toast/inline/modal patterns)
- M-013: Border radius consistency audit
- M-014: Unified Spinner component

**To continue:** Review M-002, M-013, M-014 below, or create PR from branch.

---

## Quick Reference

| Priority | Count | Estimated Hours |
|----------|-------|-----------------|
| **Critical (P0)** | 0 | 0 |
| **High (P1)** | 0 | 0 |
| **Medium (P2)** | 3 | 7 |
| **Low (P3)** | 9 | 23 |
| **Tech Debt - Lint (P3)** | 5 | 11 |
| **Future (Phase 7+)** | 5 | TBD |
| **Total** | 22 | ~41 hrs |

---

## Critical Priority (P0) - Must Fix Immediately

*No critical issues remaining. See "Recently Verified as Complete" for resolved items.*

---

## High Priority (P1) - Complete This Sprint

*All P1 items completed in Session 5. See "Recently Verified as Complete" section.*

---

## Medium Priority (P2) - Complete This Month

### M-002: Inconsistent Error Display Patterns
- **File:** Various stores
- **Issue:** Mix of toast, inline, and modal error displays without clear pattern
- **Fix:** Standardize: Toast for user actions, Inline for validation, Modal for critical
- **Effort:** 3 hours

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

### L-009: Etro Relic Weapon Import
- **File:** `backend/app/routers/bis.py:405-427`
- **Issue:** Etro stores relic weapons in a separate `relics` object, not the main `weapon` field
- **Impact:** Ultimate BiS sets with relic weapons import without weapon data
- **Fix:** Check `data.get("relics", {}).get("weapon")` UUID and resolve to item ID
- **Effort:** 1 hour

---

## Technical Debt - Lint Issues (P3)

**Added:** January 15, 2026
**Current Error Count:** ~49 (down from 65 after quick fixes)

These are ESLint errors that don't affect functionality but should be addressed for code quality.

### TD-001: Explicit `any` Types (21 occurrences)
- **Rule:** `@typescript-eslint/no-explicit-any`
- **Files Affected:**
  - `components/history/SectionedLogView.tsx` (~18 occurrences)
  - Various other components (3 occurrences)
- **Fix:** Add proper TypeScript types
- **Effort:** 4 hours

### TD-002: React Compiler Warnings (24 occurrences)
- **Rule:** React compiler (react-compiler)
- **Issues:**
  - "Calling setState synchronously within an effect" (18)
  - "Compilation Skipped: Existing memoization" (6)
- **Files Affected:**
  - Various docs pages (ApiCookbook, ApiDocs, CommonTasksDocs, etc.)
  - AuthCallback.tsx, HistoryView.tsx, ReleaseBanner.tsx
  - JobPicker.tsx, BiSImportModal.tsx, ContextMenu.tsx, TipsCarousel.tsx
  - WeaponPriorityEditor.tsx, KeyboardShortcutsHelp.tsx, ReleaseNotes.tsx
- **Fix:** Wrap setState calls in setTimeout or restructure effects
- **Effort:** 3 hours

### TD-003: React Hooks Dependency Warnings (11 warnings)
- **Rule:** `react-hooks/exhaustive-deps`
- **Files Affected:**
  - `stores/lootTrackingStore.ts`
  - `hooks/useLootActions.ts`, `hooks/useModal.ts`, `hooks/useDebounce.ts`
  - `components/player/PlayerGrid.tsx`
  - `components/team/TeamSummaryEnhanced.tsx`
  - `components/loot/FilterBar.tsx`, `components/loot/LootPriorityPanel.tsx`
- **Fix:** Review dependencies, add missing deps or refactor to avoid infinite loops
- **Effort:** 2 hours

### TD-004: React Refresh Export Warnings (5 occurrences)
- **Rule:** `react-refresh/only-export-components`
- **Files Affected:**
  - `components/loot/RoleSection.tsx`
  - `components/ui/ThreeStateCheckbox.tsx`
  - `components/weapon-priority/WeaponJobSelector.tsx`
  - Other files exporting constants alongside components
- **Fix:** Move non-component exports to separate files
- **Effort:** 1 hour

### TD-005: Refs During Render (2 occurrences)
- **Rule:** React compiler
- **Files:** `components/history/WeeklyLootGrid.tsx`, `components/player/BiSImportModal.tsx`
- **Fix:** Move ref access to effects or callbacks
- **Effort:** 1 hour

### Quick Wins Completed (January 15, 2026)
- ✅ Added ESLint rule to ignore `_`-prefixed unused variables
- ✅ Fixed 7 unused variable errors by adding `_` prefix
- ✅ Fixed `prefer-const` error in eventBus.test.ts
- ✅ Fixed `no-constant-condition` error in uxHelpers.test.ts

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

## Recently Verified as Complete (v1.0.8+)

### Session 5: Security Hardening Sprint (January 18, 2026)

| Item | Status | Notes |
|------|--------|-------|
| **H-003: Loot Log Pagination** | ✅ FIXED | Completed in PR #37 |
| **H-004: Missing FK Indexes** | ✅ FIXED | Completed in PR #36 |
| **H-005: Request ID Middleware** | ✅ FIXED | RequestIDMiddleware binds UUID to structlog context and response headers |
| **M-001: Single Loading Flag** | ✅ FIXED | Components now use granular loadingStates (lootLog, playerLedger, etc.) |
| **M-003: OAuth State Validation** | ✅ FIXED | State bound to client fingerprint (IP + user agent hash) |
| **M-004: CSRF Protection** | ✅ FIXED | CSRFMiddleware with double-submit cookie pattern |
| **M-005: BiS Path Validation** | ✅ FIXED | Job/tier validated against whitelist to prevent path traversal |
| **M-006: External API Rate Limit** | ✅ FIXED | Reduced from 30/min to 10/min |
| **M-007: Timing Attack Fix** | ✅ FIXED | Generic "Authentication failed" message for all auth failures |
| **M-008: JWT Algorithm Config** | ✅ FIXED | Literal type restricts to HS256/HS384/HS512 only |
| **M-009: Security Event Logging** | ✅ FIXED | Permission denials and admin access logged in permissions.py |
| **M-010: Week Data Query** | ✅ FIXED | Consolidated to single UNION ALL query |
| **M-011: DB CHECK Constraints** | ✅ FIXED | week_number > 0 constraints on all log tables |
| **M-012: Request Size Limit** | ✅ FIXED | RequestSizeLimitMiddleware caps requests at 10MB |

### Session 4: Security Headers & SSRF (January 17, 2026)

| Item | Status | Notes |
|------|--------|-------|
| **H-001: Content-Security-Policy** | ✅ FIXED | Added CSP header with strict directives for SPA |
| **H-002: SSRF in BiS Import** | ✅ FIXED | Disabled httpx redirects in all 4 BiS import external API calls (plus 2 Discord OAuth endpoints) |

### Session 3: Dependency Security (January 17, 2026)

| Item | Status | Notes |
|------|--------|-------|
| **P1-SEC-001: React Router CVEs** | ✅ FIXED | Updated 7.11.0 → 7.12.0, fixes GHSA-h5cw-625j-3rxh (CSRF) and GHSA-2w69-qvjg-hvjx (XSS) |
| **P1-DEVOPS-001: Dual Lockfiles** | ✅ FIXED | Removed package-lock.json, added to .gitignore, standardized on pnpm |
| **P1-SEC-004: ecdsa CVE** | ⏭️ N/A | Not exploitable - we use HS256 for JWT, not ECDSA algorithms. CVE-2024-23342 requires ECDSA usage. |

### Session 1 & 2: Critical Security (January 17, 2026)

| Item | Status | Notes |
|------|--------|-------|
| **P0-SEC-001: JWT in Response Body** | ✅ FIXED | Tokens now only in httpOnly cookies by default |
| **P0-SEC-002: Cache TTL Enforcement** | ✅ FIXED | Local cache fallback now enforces TTL expiration |
| **P0-SEC-003: Trusted Proxy Validation** | ✅ FIXED | X-Forwarded-For only trusted from configured proxy IPs |
| **C-001: N+1 Query in Admin Dashboard** | ✅ FIXED | Uses scalar subqueries instead of eager loading |

### v1.0.8 Completions

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
| **Modal Header Icons** | ADDED | All modals have contextual icons (v1.0.8) |
| **Double-Click Confirm** | ADDED | useDoubleClickConfirm hook with isLoading, timeout, blur reset |
| **Admin Player Assignment** | ADDED | Owner/admin can assign users to player cards |
| **Player Badge Colors** | ADDED | Role-colored badges (owner/lead/member/linked) on player cards |
| **Race Condition Handling** | FIXED | `create_membership_for_assignment()` handles IntegrityError |
| **Input Validation** | ADDED | Discord ID (17-19 digits) and UUID format validation |

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
