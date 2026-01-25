# FFXIV Raid Planner - Consolidated Status & Planning

**Last Updated:** January 25, 2026
**Purpose:** Single source of truth for what's done, what's outstanding, and what's planned

---

## Project Status Overview

### Current Version: v1.9.1

**Branch:** `main`

| Feature | Status | Description |
|---------|--------|-------------|
| **Mobile UX Optimization** | 🔨 ~80% | PR #60 - First pass complete; polish and refinements remaining |
| **Materia in Gear Tooltips** | ✅ Complete | PR #58 - L-003 resolved |
| **Multi-Set XIVGear Support** | ✅ Complete | PR #59 - Store setIndex in shortlink bisLinks |
| **Member Permissions Fix** | ✅ Complete | PR #57 - Edit Books feature added |

### 🔨 Next Up: Session 4 (Optional)

| Feature | Status | Description |
|---------|--------|-------------|
| **MembersPanel Enhancement** | Pending | Add Linked Card dropdown per member (see SETUP_WIZARD_PLAN.md) |

### ✅ Completed Features (Production Ready)

| Feature | Phase | Status | Notes |
|---------|-------|--------|-------|
| **Core Gear Tracking** | 1 | ✅ Complete | Player cards, manual BiS selection, checkboxes |
| **UX Enhancements** | 2 | ✅ Complete | Tab navigation, context menu, raid positions |
| **Backend & Persistence** | 3 | ✅ Complete | FastAPI, SQLAlchemy, SQLite/PostgreSQL |
| **Discord OAuth** | 4 | ✅ Complete | Authentication, user management |
| **Multi-Static Support** | 4 | ✅ Complete | Multiple groups per user, membership |
| **Role-Based Access** | 4 | ✅ Complete | Owner/Lead/Member/Viewer permissions |
| **Tier Snapshots** | 4 | ✅ Complete | Per-tier rosters (M5S-M8S vs M9S-M12S) |
| **Invitation System** | 4 | ✅ Complete | Invite links with roles/expiration |
| **Player Ownership** | 4 | ✅ Complete | Link Discord to player cards |
| **BiS Import (XIVGear)** | 5 | ✅ Complete | Import from XIVGear links |
| **BiS Import (Etro)** | 5 | ✅ Complete | Import from Etro links |
| **BiS Presets** | 5 | ✅ Complete | The Balance presets for all 21 jobs |
| **Item Icons & Stats** | 5 | ✅ Complete | XIVAPI integration, hover cards |
| **Permission-Aware UI** | 6 | ✅ Complete | Disabled actions with tooltips |
| **Reset Gear Options** | 6 | ✅ Complete | 3 presets (progress/BiS/everything) |
| **Weapon Priority System** | 6.5 | ✅ Complete | Multi-job weapon tracking, drag reorder, main job priority |
| **Loot Logging** | 6.5 | ✅ Complete | Historical loot tracking with week navigation |
| **Book/Page Tracking** | 6.5 | ✅ Complete | Book earning/spending ledger with inline editing |
| **Inline Loot Actions** | 6.5 | ✅ Complete | Quick log from Loot tab with priority-sorted recipients |
| **Enhanced Priority Display** | 6.5 | ✅ Complete | Drought bonus, fair share adjustment shown in tooltips |
| **UI State Persistence** | 6.5 | ✅ Complete | Tab, week, tier selections persist on refresh |
| **Tier-Specific Share Links** | 6.5 | ✅ Complete | Shift+click copies URL with tier param |
| **Design System V2** | 6.6 | ✅ Complete | Semantic tokens, 5-tier containers, new primitives |
| **Admin System** | 6.6 | ✅ Complete | Super-user access, View As feature, admin dashboard |
| **Keyboard Shortcuts** | 6.6 | ✅ Complete | Global shortcuts with help modal (Shift+?) |
| **User Documentation Restructure** | 6.7 | ✅ Complete | Phases 1-6 complete - unified guides, simplified landing, FAQ |

---

## Version History

### v1.9.1 - Mobile UX & Materia Tooltips (January 25, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Mobile UX Optimization** | 🔨 ~80% | PR #60 - First pass complete |
| **Materia Display** | ✅ Complete | PR #58 - Materia shown in gear tooltips |
| **XIVGear Multi-Set** | ✅ Complete | PR #59 - Store setIndex for multi-set sheets |
| **Member Permissions** | ✅ Complete | PR #57 - Edit Books feature |

**Mobile UX Features (First Pass):**
- `useDevice` hook for device capability detection
- `MobileBottomNav` component for thumb-friendly navigation
- Touch-safe tooltips (disabled on touch devices)
- Responsive layouts across all major views
- PWA manifest for "Add to Home Screen"
- Safe-area padding for notched devices

**Mobile Remaining (~20%):**
- Additional polish and edge case handling
- UX refinements on specific views

---

### v1.9.0 - BiS Source Improvements & User Docs Restructure (January 20, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **BiS Source Selector Redesign** | ✅ Complete | 2x2 grid with base_tome support, target-style status circles |
| **BiS Source Miscategorization Detection** | ✅ Complete | BiSSourceFixBanner component for detecting incorrectly categorized gear |
| **User Documentation Restructure (Phases 1-6)** | ✅ Complete | Unified Quick Start, task-oriented How-To, progressive Priority guide, FAQ page |
| **Tooltip Cleanup** | ✅ Complete | Removed tooltips from gear UI elements, added ARIA labels |
| **Color Differentiation** | ✅ Complete | base_tome (blue) vs tome (teal) visual distinction |

### v1.0.14 - Discord Version Detection Fix (January 19, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Simplified Version Detection** | ✅ Complete | `didVersionChange()` now detects any releaseNotes.ts modification |
| **Full ISO Timestamps** | ✅ Complete | releaseNotes.ts uses YYYY-MM-DDTHH:MM:SSZ format with actual merge times |
| **Historical Timestamp Backfill** | ✅ Complete | All 24 releases backfilled with accurate git commit timestamps |
| **Historical Release Script** | ✅ Complete | Added `--all` option to delete channel and repost all releases |
| **CI Date Validation** | ✅ Complete | Release notes workflow validates ISO timestamp format |

---

### v1.0.13 - Discord Changelog Improvements (January 19, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Release-Only Embeds** | ✅ Complete | Version releases now post a single clean embed (no commit embed) |
| **Dominant Category Colors** | ✅ Complete | Discord embed border reflects most common change type |

---

### v1.0.12 - UI Consistency Sprint (January 19, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Unified Spinner Component** | ✅ Complete | Consistent loading indicators with sm/md/lg/xl/2xl sizes |
| **Standardized Border Radius** | ✅ Complete | rounded (tooltips), rounded-lg (containers), rounded-xl (features) |
| **ErrorBox Component** | ✅ Complete | Simple inline errors for modals and panels |
| **Dashboard Toggle Fix** | ✅ Complete | Grid/list toggle matches adjacent button sizes |

---

### v1.0.11 - Security Hardening Sprint (January 18, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **CSRF Protection** | ✅ Complete | Double-submit cookie pattern for state-changing requests |
| **OAuth State Hardening** | ✅ Complete | Client fingerprint binding prevents session fixation |
| **SSRF Protection** | ✅ Complete | Redirect rejection on all external API calls |
| **Request Size Limits** | ✅ Complete | 10MB limit prevents DoS attacks |
| **Request ID Tracking** | ✅ Complete | UUID correlation for all requests |
| **JWT Algorithm Restriction** | ✅ Complete | Type-safe HS256/384/512 only |
| **Security Event Logging** | ✅ Complete | Permission denials and admin access logged |
| **Database Constraints** | ✅ Complete | CHECK constraints on week_number columns |

---

### Security Audit - Sessions 1-3 (January 17, 2026)

**PR #31 - Session 1 & 2: Critical Security Fixes**

| Issue | Status | Description |
|-------|--------|-------------|
| **P0-SEC-001** | ✅ Fixed | JWT tokens now only in httpOnly cookies by default |
| **P0-SEC-002** | ✅ Fixed | Local cache fallback enforces TTL expiration |
| **P0-SEC-003** | ✅ Fixed | X-Forwarded-For only trusted from configured proxy IPs |
| **C-001** | ✅ Fixed | Admin dashboard N+1 query uses scalar subqueries |

**PR #32 - Session 3: Dependency Security**

| Issue | Status | Description |
|-------|--------|-------------|
| **P1-SEC-001** | ✅ Fixed | react-router-dom 7.11.0 → 7.12.0 (CVE fixes) |
| **P1-DEVOPS-001** | ✅ Fixed | Removed dual lockfiles, standardized on pnpm |
| **P1-SEC-004** | ⏭️ N/A | ecdsa CVE not exploitable (we use HS256, not ECDSA) |

**Test Coverage:** 209 backend + 351 frontend + 87 scripts = 647 tests passing

---

### v1.0.10 - Loot Priority UX & Score Tooltips (January 16, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Weapon Priority Tie Styling** | ✅ Complete | Connector line style with collapsible sections |
| **Score Breakdown Tooltips** | ✅ Complete | Hover to see priority calculation breakdown |
| **Gear Slot Icons** | ✅ Complete | Icons in Gear Priority and Who Needs It panels |
| **Icon Gallery** | ✅ Complete | Developer tool for viewing all custom icons |
| **BiS Import Modal UX** | ✅ Complete | Default preset selection, improved gear tooltips |
| **Comprehensive Tooltip Audit** | ✅ Complete | Rich tooltips across UI with kbd hints |
| **Week Management** | ✅ Complete | Start next week, revert week, improved selectors |

### v1.0.9 - Setup Wizard & Player Setup Banner (January 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Setup Wizard** | ✅ Complete | 4-step guided static creation (Details → Roster → Share → Review) |
| **WizardProgress** | ✅ Complete | Horizontal 4-step indicator with labels |
| **RosterSlot** | ✅ Complete | Role-specific job quick-select buttons, keyboard navigation |
| **PlayerSetupBanner** | ✅ Complete | Contextual setup prompts on player cards |
| **AssignUserModal v2** | ✅ Complete | Role badges, reassignment confirmation, sorted by assignment |
| **TankRoleSelector** | ✅ Complete | Moved to PlayerCard header for visual alignment |

**Setup Wizard Features:**
- Default tier pre-selection (latest savage tier)
- Sticky navigation footer (always visible)
- Cancel confirmation prevents accidental data loss
- Partial roster allowed (creates empty slots for unconfigured positions)

**PlayerSetupBanner States:**
| Condition | Message | Action |
|-----------|---------|--------|
| Unclaimed + Owner/Lead | "Unclaimed" | Assign Player |
| Unclaimed + Member | "Unclaimed" | Take Ownership |
| Claimed by me + No BiS | "No BiS configured" | Import BiS |
| Fully configured | *(hidden)* | - |

### v1.0.8 - Admin Assignment & Modal Polish (January 11, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Modal Header Icons** | ✅ Complete | All modals have contextual icons in headers |
| **ConfirmModal Improvements** | ✅ Complete | Uses Button component, auto-adds icons by variant |
| **Double-Click Confirm** | ✅ Complete | useDoubleClickConfirm hook with arm/confirm/timeout |
| **Job Icons in Dropdowns** | ✅ Complete | Recipient selects show job icons |
| **Static Settings Polish** | ✅ Complete | Tab icons, proper danger button styling |
| **Admin Player Assignment** | ✅ Complete | Owners/admins can assign users to player cards |
| **Player Badge Colors** | ✅ Complete | Role-colored badges for linked users on player cards |
| **Race Condition Handling** | ✅ Complete | Membership creation handles concurrent requests |
| **Input Validation** | ✅ Complete | Discord ID (17-19 digits) and UUID format validation |
| **23 New Backend Tests** | ✅ Complete | Comprehensive player assignment test coverage |

### v1.0.7 - Audit Complete (January 11, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Skeleton Loaders** | ✅ Complete | StaticGridSkeleton, StaticListSkeleton for Dashboard |
| **useModal Hook** | ✅ Complete | Reusable modal state management (useModal, useModalWithData) |
| **useDebounce Hook** | ✅ Complete | Debounce utilities (useDebounce, useDebouncedCallback) |
| **ErrorMessage Component** | ✅ Complete | Error display with retry button, InlineError variant |
| **Button Variants** | ✅ Complete | Added success and link variants (7 total) |
| **Audit Resolution** | ✅ Complete | All actionable audit items resolved |

### v1.0.6 (January 11, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **httpOnly Cookie Auth** | ✅ Complete | Tokens migrated from localStorage to secure httpOnly cookies |
| **SameSite Protection** | ✅ Complete | CSRF protection via SameSite=Lax |
| **Secure Flag** | ✅ Complete | Cookies only sent over HTTPS in production |
| **Protected Logout** | ✅ Complete | Logout requires valid access token |
| **React.memo Optimization** | ✅ Complete | List item components memoized (PR #20) |
| **LogEntryItems Extraction** | ✅ Complete | LootLogEntryItem and MaterialLogEntryItem extracted |

### v1.0.5 (January 10, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **GroupView Refactoring** | ✅ Complete | Reduced from 1468 → 788 lines (46% reduction) |
| **State Management Hooks** | ✅ Complete | useGroupViewState, usePlayerActions extracted |
| **Keyboard Shortcuts Hook** | ✅ Complete | useGroupViewKeyboardShortcuts extracted |
| **Navigation Helpers** | ✅ Complete | useViewNavigation for cross-tab nav |
| **PlayerGrid Component** | ✅ Complete | Grid rendering with group view and subs (467 lines) |
| **AdminBanners Component** | ✅ Complete | Admin access and View As indicators |

### v1.0.2-v1.0.4 (January 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Rate Limiting** | ✅ Complete | slowapi with Redis support |
| **Security Headers** | ✅ Complete | HSTS, X-Frame-Options, etc. |
| **Error Boundaries** | ✅ Complete | react-error-boundary with ErrorFallback |
| **Keyboard Shortcuts** | ✅ Complete | Tab navigation, view toggles, quick actions |
| **Weekly Loot Grid** | ✅ Complete | Spreadsheet-style loot viewing/logging |
| **Design System Migration** | ✅ Complete | 57 CSS tokens, semantic colors, new primitives |
| **Admin Dashboard** | ✅ Complete | Super-user static browser with View As |

### v1.0.1 (January 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Bulk Group Duplication** | ✅ Complete | Single endpoint replaces 40+ API calls |
| **Database Indexes** | ✅ Complete | 6 indexes for query performance |
| **Frontend Utilities** | ✅ Complete | errorHandler, logger, eventBus libraries |
| **Zustand Selectors** | ✅ Complete | 11 selector hooks for optimized re-renders |
| **Bundle Optimization** | ✅ Complete | Vite manual chunks for vendor splitting |
| **Production Config Validation** | ✅ Complete | JWT strength, debug mode, SQLite rejection |

### v1.0.0 (January 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Gear Category Tracking** | ✅ Complete | 9 categories for current gear (vs 2 for BiS) |
| **iLv Calculation** | ✅ Complete | Per-slot iLv, average iLv display |
| **Roster Adjustments** | ✅ Complete | lootAdjustment + pageAdjustments for mid-tier joins |
| **Weapon Job Tracking** | ✅ Complete | Track which job's weapon was logged, display with job icon |
| **Extra Loot Tagging** | ✅ Complete | Mark loot as "extra" vs BiS priority |
| **Universal Tomestone** | ✅ Complete | Fourth material type for weapon augmentation |
| **Weapon Priority Ties** | ✅ Complete | Roll button for tied players, auto-expand on roll |
| **Release Notes System** | ✅ Complete | In-app release notes with version notification |
| **Auth Persistence** | ✅ Complete | Proactive token refresh, production detection |

---

## Critical Issues

### ✅ All P0/P1 Issues Resolved

| Issue | Location | Status |
|-------|----------|--------|
| **Database migrations** | Backend | ✅ Done (Alembic) |
| **Rate limiting** | Backend API | ✅ Done (slowapi) |
| **Test coverage** | Frontend + Backend | ✅ Done (479+ tests) |
| **Error boundaries** | Frontend | ✅ Done (react-error-boundary) |
| **ARIA labels** | UI components | ✅ Done (v1.0.4) |
| **Loading skeletons** | Dashboard | ✅ Done (v1.0.7) |
| **Security headers** | Backend API | ✅ Done |
| **Design system** | All components | ✅ Done (PR #15) |
| **Modal boilerplate** | Hooks | ✅ Done (v1.0.7) |
| **Error retry** | ErrorMessage | ✅ Done (v1.0.7) |

### 🟡 Deferred / Nice to Have

| Issue | Location | Status |
|-------|----------|--------|
| **Props drilling** | GroupView | Deferred - hooks mitigate (R-002) |
| **Materia in tooltips** | GearTable | Future - requires backend changes |
| **Onboarding tooltips** | First-run experience | Future |
| **Alt Job Linking** | Multi-job players | Future |

---

## Test Coverage

**Total: 647 tests (209 backend + 351 frontend + 87 scripts)**

### Backend (209 tests)
```bash
cd backend && source venv/bin/activate && pytest tests/ -q
```
- `test_auth.py` - Authentication endpoints
- `test_auth_utils.py` - JWT token creation/verification
- `test_config_validation.py` - Production config validation
- `test_duplicate_group.py` - Bulk duplication endpoint
- `test_tier_deactivation.py` - Tier activation logic
- `test_pr_integration.py` - Integration tests
- `test_player_assignment.py` - Admin player assignment endpoints
- Security middleware tests (CSRF, rate limiting, request size)

### Frontend (351 tests)
```bash
cd frontend && pnpm test
```
- `errorHandler.test.ts` - Error parsing utilities
- `logger.test.ts` - Logging utility
- `eventBus.test.ts` - Event bus pub/sub
- `tierStore.selectors.test.ts` - Zustand selector hooks
- `calculations.test.ts` - iLv and priority calculations
- `priority.test.ts` - Loot priority scoring
- `releaseNotes.test.ts` - Release notes data validation
- `uxHelpers.test.ts` - UX patterns and accessibility
- `lootCoordination.test.ts` - Loot stats and gear sync
- `useModal.test.ts` - Modal state hooks
- `useDebounce.test.ts` - Debounce utilities
- `PlayerSetupBanner.test.ts` - Banner visibility logic (20 tests)

### Scripts (87 tests)
```bash
cd scripts && npm test
```
- `discord-changelog.test.js` - Discord webhook, embed building, release parsing

---

## Next Steps

### Immediate Options

**Option A: Session 4 (MembersPanel Enhancement)**
Add "Linked Card" dropdown to each member row in MembersPanel:
- Show available cards: unclaimed OR already claimed by this member
- On selection, call existing assign endpoint
- Pre-select if member already has a linked card

See `docs/SETUP_WIZARD_PLAN.md` for implementation details.

**Option B: P3 Items (Low Priority)**
See `docs/OUTSTANDING_WORK.md` for prioritized remaining work:
- L-001 through L-009: Various low-priority improvements
- TD-001 through TD-005: Technical debt (lint issues)

### Future Phases

- **Phase 7:** Lodestone auto-sync - Verify equipped gear against Lodestone
- **Phase 8:** FFLogs integration - Parse logs for gear verification
- **Phase 9:** Discord bot - Notifications and commands

### Completed Audit Sessions

All critical (P0) and high (P1) security issues have been resolved:
- Sessions 1-2: Critical auth hardening, admin N+1 query
- Session 3: Dependency security (react-router CVEs)
- Session 4: CSP header, SSRF fix
- Session 5: Security hardening sprint (CSRF, OAuth binding, etc.)
- Session 7: UI Consistency Sprint

---

## Documentation Structure

```
docs/
├── CONSOLIDATED_STATUS.md       # This file - project status and version history
├── OUTSTANDING_WORK.md          # Prioritized list of remaining work (P0-P3)
├── SESSION_HANDOFF.md           # Current session handoff notes
├── UI_COMPONENTS.md             # UI component inventory (READ BEFORE UI WORK)
├── CODING_STANDARDS.md          # Code style and patterns
├── SETUP_WIZARD_PLAN.md         # Setup wizard implementation plan
├── GEARING_REFERENCE.md         # FFXIV gearing data
├── GEARING_MATH.md              # Gearing mechanics and formulas
├── plans/                       # Technical audit session plans
│   ├── COMBINED_AUDIT_PLAN.md   # Master plan (47 issues, 12 sessions)
│   └── SESSION_01-12.md         # Individual session details
├── implementation/              # Historical implementation plans
│   ├── parity-audit/            # Feature parity analysis
│   └── ux-audit/                # UX audit and improvements
└── archive/                     # Historical session handoffs
```

---

**Document maintained by:** Development Team
**Review cadence:** After each version release
