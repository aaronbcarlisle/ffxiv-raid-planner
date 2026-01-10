# FFXIV Raid Planner - Consolidated Status & Planning

**Last Updated:** January 10, 2026 (v1.0.4 Released)
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

### ✅ Completed: v1.0.1 Audit Improvements (January 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| **Bulk Group Duplication** | ✅ Complete | Single endpoint replaces 40+ API calls |
| **Database Indexes** | ✅ Complete | 6 indexes for query performance |
| **Frontend Utilities** | ✅ Complete | errorHandler, logger, eventBus libraries |
| **Zustand Selectors** | ✅ Complete | 11 selector hooks for optimized re-renders |
| **Bundle Optimization** | ✅ Complete | Vite manual chunks for vendor splitting |
| **Production Config Validation** | ✅ Complete | JWT strength, debug mode, SQLite rejection |
| **Comprehensive Test Suite** | ✅ Complete | 321 tests (95 backend + 226 frontend) |
| **Skeleton Components** | ✅ Complete | Loading placeholder components |

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

---

## Critical Issues (Blockers)

### ✅ All P0/P1 Issues Resolved

| Issue | Location | Status |
|-------|----------|--------|
| **Database migrations** | Backend | ✅ Done (Alembic) |
| **Rate limiting** | Backend API | ✅ Done (slowapi) |
| **Test coverage** | Frontend + Backend | ✅ Done (321 tests) |
| **Error boundaries** | Frontend | ✅ Done (react-error-boundary) |
| **ARIA labels** | UI components | ✅ Done (v1.0.4) |
| **Loading skeletons** | All pages | ✅ Done |
| **Security headers** | Backend API | ✅ Done |
| **Design system** | All components | ✅ Done (PR #15) |

### 🟡 Low Priority / Nice to Have

| Issue | Location | Status |
|-------|----------|--------|
| **Large component files** | GroupView (1267 lines) | Optional - functional as-is |
| **Materia in tooltips** | GearTable | Future - requires backend changes |
| **Onboarding tooltips** | First-run experience | Future |
| **Alt Job Linking** | Multi-job players | Future |

---

## Test Coverage

**Total: 321 tests (95 backend + 226 frontend)**

### Backend (95 tests)
- `test_auth.py` - Authentication endpoints
- `test_auth_utils.py` - JWT token creation/verification
- `test_config_validation.py` - Production config validation
- `test_duplicate_group.py` - Bulk duplication endpoint
- `test_tier_deactivation.py` - Tier activation logic
- `test_pr_integration.py` - Integration tests

### Frontend (226 tests)
- `errorHandler.test.ts` - Error parsing utilities
- `logger.test.ts` - Logging utility
- `eventBus.test.ts` - Event bus pub/sub
- `tierStore.selectors.test.ts` - Zustand selector hooks
- `calculations.test.ts` - iLv and priority calculations
- `priority.test.ts` - Loot priority scoring
- `releaseNotes.test.ts` - Release notes data validation
- `uxHelpers.test.ts` - UX patterns and accessibility
- `lootCoordination.test.ts` - Loot stats and gear sync

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
│   ├── 2026-01-01-comprehensive-audit.md
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
