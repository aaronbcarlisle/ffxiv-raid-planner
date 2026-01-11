# FFXIV Raid Planner - Consolidated Status & Planning

**Last Updated:** January 11, 2026 (v1.0.8 In Progress - Modal Polish)
**Purpose:** Single source of truth for what's done, what's outstanding, and what's planned

---

## Project Status Overview

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

### 🔨 In Progress: v1.0.8 - Modal Polish (January 11, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Modal Header Icons** | ✅ Complete | All modals have contextual icons in headers |
| **ConfirmModal Improvements** | ✅ Complete | Uses Button component, auto-adds icons by variant |
| **Double-Click Confirm** | ✅ Complete | Revoke/Clear actions use arm-then-confirm pattern |
| **Job Icons in Dropdowns** | ✅ Complete | Recipient selects show job icons |
| **Static Settings Polish** | ✅ Complete | Tab icons, proper danger button styling |

### ✅ Completed: v1.0.7 - Audit Complete (January 11, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Skeleton Loaders** | ✅ Complete | StaticGridSkeleton, StaticListSkeleton for Dashboard |
| **useModal Hook** | ✅ Complete | Reusable modal state management (useModal, useModalWithData) |
| **useDebounce Hook** | ✅ Complete | Debounce utilities (useDebounce, useDebouncedCallback) |
| **ErrorMessage Component** | ✅ Complete | Error display with retry button, InlineError variant |
| **Button Variants** | ✅ Complete | Added success and link variants (7 total) |
| **Audit Resolution** | ✅ Complete | All actionable audit items resolved |

### ✅ Completed: v1.0.6 (January 11, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **httpOnly Cookie Auth** | ✅ Complete | Tokens migrated from localStorage to secure httpOnly cookies |
| **SameSite Protection** | ✅ Complete | CSRF protection via SameSite=Lax |
| **Secure Flag** | ✅ Complete | Cookies only sent over HTTPS in production |
| **Protected Logout** | ✅ Complete | Logout requires valid access token |
| **React.memo Optimization** | ✅ Complete | List item components memoized (PR #20) |
| **LogEntryItems Extraction** | ✅ Complete | LootLogEntryItem and MaterialLogEntryItem extracted |

### ✅ Completed: v1.0.5 (January 10, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **GroupView Refactoring** | ✅ Complete | Reduced from 1468 → 788 lines (46% reduction) |
| **State Management Hooks** | ✅ Complete | useGroupViewState, usePlayerActions extracted |
| **Keyboard Shortcuts Hook** | ✅ Complete | useGroupViewKeyboardShortcuts extracted |
| **Navigation Helpers** | ✅ Complete | useViewNavigation for cross-tab nav |
| **PlayerGrid Component** | ✅ Complete | Grid rendering with group view and subs (467 lines) |
| **AdminBanners Component** | ✅ Complete | Admin access and View As indicators |

### ✅ Completed: v1.0.2-v1.0.4 (January 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Rate Limiting** | ✅ Complete | slowapi with Redis support |
| **Security Headers** | ✅ Complete | HSTS, X-Frame-Options, etc. |
| **Error Boundaries** | ✅ Complete | react-error-boundary with ErrorFallback |
| **Keyboard Shortcuts** | ✅ Complete | Tab navigation, view toggles, quick actions |
| **Weekly Loot Grid** | ✅ Complete | Spreadsheet-style loot viewing/logging |
| **Design System Migration** | ✅ Complete | 57 CSS tokens, semantic colors, new primitives |
| **Admin Dashboard** | ✅ Complete | Super-user static browser with View As |

### ✅ Completed: v1.0.1 Audit Improvements (January 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Bulk Group Duplication** | ✅ Complete | Single endpoint replaces 40+ API calls |
| **Database Indexes** | ✅ Complete | 6 indexes for query performance |
| **Frontend Utilities** | ✅ Complete | errorHandler, logger, eventBus libraries |
| **Zustand Selectors** | ✅ Complete | 11 selector hooks for optimized re-renders |
| **Bundle Optimization** | ✅ Complete | Vite manual chunks for vendor splitting |
| **Production Config Validation** | ✅ Complete | JWT strength, debug mode, SQLite rejection |

### ✅ Completed: v1.0.0 Release (January 2026)

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

## Critical Issues (Blockers)

### ✅ All P0/P1 Issues Resolved

| Issue | Location | Status |
|-------|----------|--------|
| **Database migrations** | Backend | ✅ Done (Alembic) |
| **Rate limiting** | Backend API | ✅ Done (slowapi) |
| **Test coverage** | Frontend + Backend | ✅ Done (456 tests) |
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

**Total: 456 tests (137 backend + 319 frontend)**

### Backend (137 tests)
- `test_auth.py` - Authentication endpoints
- `test_auth_utils.py` - JWT token creation/verification
- `test_config_validation.py` - Production config validation
- `test_duplicate_group.py` - Bulk duplication endpoint
- `test_tier_deactivation.py` - Tier activation logic
- `test_pr_integration.py` - Integration tests

### Frontend (319 tests)
- `errorHandler.test.ts` - Error parsing utilities
- `logger.test.ts` - Logging utility
- `eventBus.test.ts` - Event bus pub/sub
- `tierStore.selectors.test.ts` - Zustand selector hooks
- `calculations.test.ts` - iLv and priority calculations
- `priority.test.ts` - Loot priority scoring
- `releaseNotes.test.ts` - Release notes data validation
- `uxHelpers.test.ts` - UX patterns and accessibility
- `lootCoordination.test.ts` - Loot stats and gear sync
- `useModal.test.ts` - Modal state hooks (v1.0.7)
- `useDebounce.test.ts` - Debounce utilities (v1.0.7)

---

## Next Steps

### 🔨 Current Priority: Phase 7 Planning
- Design Lodestone auto-sync architecture
- Evaluate XIVAPI character endpoints
- Plan gear verification workflow

### Future Phases
- **Phase 7:** Lodestone auto-sync - Verify equipped gear against Lodestone
- **Phase 8:** FFLogs integration - Parse logs for gear verification
- **Phase 9:** Discord bot - Notifications and commands

---

## Documentation Structure

```
docs/
├── CONSOLIDATED_STATUS.md    # This file - project status
├── GEARING_MATH.md           # Gearing mechanics and formulas
├── GEARING_REFERENCE.md      # FFXIV gearing data
├── audits/
│   ├── 2026-01-01-comprehensive-audit.md  # Main audit (v1.0.7 complete)
│   ├── 2026-01-02-ffxiv-raid-planner-parity-audit.md
│   └── 2026-01-10-comprehensive-ux-audit.md
└── archive/
    ├── 2025-12-audits/       # Historical audit snapshots
    ├── 2025-12-planning/     # Initial planning docs
    ├── 2026-01-audits/       # Superseded UX audits
    ├── plans/                # Completed implementation plans
    ├── redesign/             # Historical redesign docs
    └── session-handoffs/     # Development session context
        └── auto/             # Auto-generated handoffs
```

---

**Document maintained by:** Development Team
**Review cadence:** Monthly or after major features
