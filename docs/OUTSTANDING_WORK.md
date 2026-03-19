# FFXIV Raid Planner - Outstanding Work

**Last Updated:** March 18, 2026
**Current Version:** v1.15.0
**Purpose:** Single source of truth for all remaining implementation work, validated against the actual codebase.

---

## Session Continuity (for AI assistants)

**Current Branch:** `frontend/ui-upgrade-2026` (active UI upgrade work)

**Recent Completions:**
- **2026-03-18:** Frontend UI upgrade (branch: `frontend/ui-upgrade-2026`, 6 phases):
  - Phase 1: Typography (Exo 2 display font), activated dormant card depth classes, fixed 9 Skeleton design system violations
  - Phase 2: Motion system (framer-motion presets), CSS stagger animations, shimmer skeletons, page transitions, card hover lift
  - Phase 3: Landing page transformation (hero gradient, staggered entrance, feature card icons, tier timeline)
  - Phase 4: Toast enter/exit animations, PageSkeleton loader, EmptyState component
  - Phase 5: Header gradient accent, progress ring glow at 75%+
  - Phase 6: Bundle size monitoring (size-limit), framer-motion chunk splitting
- **2026-03-06:** PR #72 merged: API docs updated to document API key auth
  - ApiDocs and ApiCookbook updated with Python/C#/curl examples using Bearer xrp_ auth
  - Base URL convention fixed, C# snippets use env vars consistently
- **2026-03-01:** PR #70 merged: API key auth + server-side priority for Dalamud plugin
  - `ApiKey` model with SHA-256 hashing, per-user key limits, optional expiry
  - `GET .../priority` endpoint returns pre-calculated priority for plugin overlay
  - `LootMethodEnum.PURCHASE` for vendor purchase self-logging
  - `GET .../players/{playerId}/gear` for plugin BiS viewer
  - Ring slot normalization fix (ring1/ring2 mapping)
- **2026-02-28:** PR #71 merged: FOUC prevention moved to inline HTML script
- **2026-02-24:** Backend support for Dalamud plugin BiS tracking feature
  - Added `item_id` field to `GearSlotStatus` schema (persisted through BiS imports)
  - New `GET .../players/{playerId}/gear` endpoint for plugin BiS viewer
  - `LootMethodEnum.PURCHASE` for vendor purchase self-logging
  - Members can self-log purchases for their own linked player
  - UUID | slug lookup fix on 4 player endpoints (plugin passes UUIDs)
- **2026-02-23:** PR #68 merged: Light mode theme with day/night toggle in user menu
  - Full light mode via CSS custom property overrides (`[data-theme="light"]`)
  - `useTheme` hook with localStorage persistence, OS preference detection, FOUC prevention
  - Theme toggle in UserMenu dropdown (replaced floating pill)
  - 13 new hook tests for useTheme
- **2026-02-19:** PR #67 merged: PR #66 review follow-ups
  - Cross-field `model_validator` on `StaticPrioritySettings`
  - 31 new endpoint tests for weekly assignments + `clear_week_page_ledger`
  - `LogWeekWizard` split into directory: `GearStep`, `BooksStep`, `ConfirmStep`, `types.ts`
- PR #66 merged: Flexible loot priority control and streamlined week/floor drop wizards
- PR #57-60: Member permissions, materia tooltips, XIVGear multi-set, mobile UX

---

## Quick Reference

| Priority | Count | Estimated Hours |
|----------|-------|-----------------|
| **Critical (P0)** | 0 | 0 |
| **High (P1)** | 0 | 0 |
| **Medium (P2)** | 0 | 0 |
| **Low (P3)** | 7 | 15.5 |
| **Tech Debt - Lint (P3)** | 2 | 6 |
| **Planned** | 1 | TBD |
| **Future (Phase 7+)** | 4 | TBD |
| **Total** | 14 | ~21.5 hrs |

---

## Critical Priority (P0) - Must Fix Immediately

*No critical issues remaining. See "Recently Verified as Complete" for resolved items.*

---

## High Priority (P1) - Complete This Sprint

*All P1 items completed in Session 5. See "Recently Verified as Complete" section.*

---

## Medium Priority (P2) - Complete This Month

*All P2 items completed in Session 7. See "Recently Verified as Complete" section.*

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

### L-004: Documentation Tasks
- **Missing Content:**
  1. Visual Documentation - Add screenshots/GIFs to user docs
  2. User Menu Documentation Sub-menu
- **Note:** API Cookbook already exists at `/docs/api/cookbook`. Docs index already restructured.
- **Effort:** 2 hours

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

### L-008: Deprecated execCommand Clipboard
- **Files:** Dashboard.tsx:215, Home.tsx:61, Header.tsx:125,151
- **Issue:** Using deprecated `document.execCommand('copy')` as fallback
- **Fix:** Show toast on fallback failure, consider removing fallback entirely
- **Effort:** 30 minutes

### L-009: Etro Relic Weapon Import
- **File:** `backend/app/routers/bis.py:405-427`
- **Issue:** Etro stores relic weapons in a separate `relics` object, not the main `weapon` field
- **Impact:** Ultimate BiS sets with relic weapons import without weapon data
- **Fix:** Check `data.get("relics", {}).get("weapon")` UUID and resolve to item ID
- **Effort:** 1 hour

---

## Technical Debt - Lint Issues (P3)

**Last Audited:** February 23, 2026
**Current Warning Count:** 152 (design-system + react-hooks combined)
**Note:** Warning count should be verified with `pnpm lint` after any major changes

**Test Coverage:** ~949 tests (346 backend + 508 frontend + 95 scripts)
**Note:** 5 fixture errors in `tests/test_httponly_cookies.py` (pre-existing, tests run but async fixtures fail in isolation)

All lint errors resolved; only warnings remain. These don't affect functionality.

### TD-001: React Hooks Dependency Warnings
- **Rule:** `react-hooks/exhaustive-deps`
- **Files Affected:**
  - `pages/AuthCallback.tsx` - missing savedOAuthState
  - Various other files
- **Fix:** Wrap functions in useCallback, add missing deps
- **Effort:** 2 hours

### TD-002: Design System Raw Element Warnings
- **Rule:** `design-system/no-raw-button`
- **Files Affected:** AdminDashboard.tsx, GroupView.tsx, ApiCookbook.tsx, docs pages, etc.
- **Note:** Many are in documentation pages where design system components aren't strictly required
- **Effort:** 4 hours (low priority - doesn't affect functionality)

### Completed (January 19, 2026)
- ✅ TD-003 through TD-005 from original list - resolved
- ✅ Explicit `any` types - resolved
- ✅ React Compiler warnings - resolved
- ✅ React Refresh warnings - resolved
- ✅ Refs during render - resolved
- ✅ Earlier quick wins (unused variables, prefer-const, no-constant-condition)

---

## Planned

### UI Reorganization: Header, Settings, and Actions
- **Plan:** Implementation steps outlined below (plan doc not yet created)
- **Scope:**
  1. Header breadcrumb layout: `[Static ▼] > [Tier ▼] [⋮]`
  2. Tier actions in dedicated kebab menu (⋮)
  3. Settings slide-out panel with 4 tabs (replaces modal)
  4. Add Player button on Roster tab
  5. Log tab toolbar consolidation
- **Status:** Not started — infrastructure partially exists (SettingsPanel, PriorityTab, GeneralTab)
- **Phases:** 4 (see plan for details)

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

### Phase 9: Mobile Optimization (~80% Complete)
- **Status:** First pass completed in PR #60
- **Implemented:** useDevice hook, MobileBottomNav, touch-safe tooltips, responsive layouts, PWA manifest
- **Remaining (~20%):**
  - WeeklyLootGrid horizontal scroll behavior on narrow screens
  - Context menu positioning edge cases near screen edges
  - Modal/sheet keyboard handling on mobile
  - Touch gesture refinements (swipe to dismiss, pull-to-refresh candidates)
  - Testing on physical devices (currently emulator-tested only)

### Phase 10: Discord Bot
- Notifications for loot drops
- Commands for priority lookup
- Integration with static group channels

### Alt Job Tracking (Deferred)
- Track multiple jobs per player
- Separate BiS configurations per job
- Alt priority calculations

---

## Recently Verified as Complete (v1.7.0+)

### Session 7: UI Consistency Sprint (January 19, 2026)

| Item | Status | Notes |
|------|--------|-------|
| **M-014: Inconsistent Loading States** | ✅ FIXED | Unified Spinner component with sm/md/lg/xl/2xl sizes |
| **M-013: Inconsistent Border Radius** | ✅ FIXED | Standardized to rounded (tooltips), rounded-lg (containers/buttons), rounded-xl (features) |
| **M-002: Inconsistent Error Display** | ✅ FIXED | ErrorBox component for simple inline errors; pattern: ErrorMessage (dismissible), ErrorBox (inline), InlineError (validation), toast (transient) |
| **Dashboard Toggle Size** | ✅ FIXED | Grid/list view toggle now matches adjacent button sizes |
| **Release Notes Commits** | ✅ FIXED | Added commit references to v1.0.4-v1.0.12 release notes |

### Session 6: PR #38 Review Feedback (January 18, 2026)

| Item | Status | Notes |
|------|--------|-------|
| **Copilot: CSRF callback path** | ✅ FIXED | Fixed `/api/auth/callback` → `/api/auth/discord/callback` |
| **Copilot: Missing refresh exempt** | ✅ FIXED | Added `/api/auth/refresh` to CSRF exempt paths |
| **Copilot: CSRFAwareClient headers** | ✅ FIXED | Refactored `_inject_csrf_header()` for all header types |
| **Copilot: Cookie parsing edge case** | ✅ FIXED | Used `indexOf`/`slice` for cookies with `=` in values |
| **Copilot: hashlib import location** | ✅ FIXED | Moved to module level |
| **Copilot: Combined typing imports** | ✅ FIXED | Single `from typing import Literal, Self` |
| **Copilot: CSRF header spreading** | ✅ FIXED | Spread order ensures CSRF token cannot be overwritten |
| **Cursor: Logout CSRF exempt** | ✅ FIXED | Removed `/api/auth/logout` from exempt paths |
| **Claude: CSRF cookie parsing** | ✅ FIXED | Handles `=` in cookie values correctly |
| **Claude: Fingerprint bypass** | ✅ FIXED | Made fingerprint validation mandatory |
| **Claude: Client CSRF validation** | ✅ FIXED | Fail-fast with clear error if token missing |
| **Claude: Request size docs** | ✅ FIXED | Documented bypass limitation and nginx config |

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
Last validated against the actual codebase on March 18, 2026.
