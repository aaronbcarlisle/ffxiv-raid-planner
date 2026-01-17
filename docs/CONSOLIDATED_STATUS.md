# FFXIV Raid Planner - Consolidated Status & Planning

**Last Updated:** January 17, 2026 (Security Audit Sessions 1-3 Complete)
**Purpose:** Single source of truth for what's done, what's outstanding, and what's planned

---

## Project Status Overview

### Current Version: v1.0.10

**Branch:** `feature/start-next-week`

| Feature | Status | Description |
|---------|--------|-------------|
| **Weapon Priority Tie Styling** | ✅ Complete | Connector line style with collapsible sections |
| **Score Breakdown Tooltips** | ✅ Complete | Hover to see priority calculation breakdown |
| **Gear Slot Icons** | ✅ Complete | Icons in Gear Priority and Who Needs It panels |
| **Tooltip Audit** | ✅ Complete | Comprehensive tooltip improvements across UI |
| **Week Management** | ✅ Complete | Start next week, revert week, improved selectors |

### 🔨 Current Priority: Session 4

| Feature | Status | Description |
|---------|--------|-------------|
| **MembersPanel Enhancement** | 🔨 Pending | Session 4: Linked Card dropdown per member |

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

---

## Version History

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

**Test Coverage:** 191 backend + 351 frontend = 542 tests passing

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

**Total: 479+ tests (160 backend + 319 frontend)**

### Backend (160 tests)
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

### Frontend (319 tests)
```bash
pnpm test
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

---

## Next Steps

### 🔨 Current Priority: Session 4 (MembersPanel Enhancement)

**Task:** Add "Linked Card" dropdown to each member row in MembersPanel
- Show available cards: unclaimed OR already claimed by this member
- On selection, call existing assign endpoint
- Pre-select if member already has a linked card

See `docs/SETUP_WIZARD_PLAN.md` for implementation details.

### Future Phases

- **Phase 7:** Lodestone auto-sync - Verify equipped gear against Lodestone
- **Phase 8:** FFLogs integration - Parse logs for gear verification
- **Phase 9:** Discord bot - Notifications and commands

### Technical Debt (See OUTSTANDING_WORK.md)

- **H-001-H-005:** Security headers, SSRF fix, pagination, indexes, request IDs
- **Audit Sessions 4-12:** Combined audit plan in `docs/plans/`

*Note: C-001 (N+1 Query) fixed in Session 1 & 2. Sessions 1-3 complete.*

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
