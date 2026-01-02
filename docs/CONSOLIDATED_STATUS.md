# FFXIV Raid Planner - Consolidated Status & Planning

**Last Updated:** January 2, 2026 (Parity Implementation In Progress)
**Purpose:** Single source of truth for what's done, what's outstanding, and what's planned

This document consolidates:
- ROADMAP.md
- UNIFIED_AUDIT_PLAN.md
- FFXIV_RAID_PLANNER_UI_UX_AUDIT.md
- FFXIV_RAID_PLANNER_AUDIT_REPORT.md
- LOOT_SYSTEM_COMPREHENSIVE_AUDIT.md
- LOOT_PRIORITY_UPDATES_PLAN.md
- LOOT_SYSTEM_AUDIT_IMPLEMENTATION.md
- ARCHITECTURE_SPEC.md

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

### 🔨 In Progress: Parity Implementation

**Audit:** `docs/audits/2026-01-02-ffxiv-raid-planner-parity-audit.md`
**Plan:** `/home/serapis/.claude/plans/nifty-pondering-summit.md`

| Feature | Status | Description |
|---------|--------|-------------|
| **Gear Category Tracking** | 🔨 In Progress | 9 categories for current gear (vs 2 for BiS) |
| **iLv Calculation** | 🔨 Planned | Per-slot iLv, average iLv display |
| **Roster Adjustments** | 🔨 Planned | lootAdjustment + pageAdjustments for mid-tier joins |
| **Alt Job Linking** | ⏳ Future | Multi-job players with shared page pools |

### 🚧 Partially Complete / Needs Work

| Feature | Status | What's Done | What's Missing |
|---------|--------|-------------|----------------|
| **Design System** | 70% | CSS tokens defined, some components use them | Inconsistent usage (raw Tailwind values in many places) |
| **Accessibility** | 30% | Semantic HTML, basic structure | Missing ARIA labels, keyboard navigation incomplete |
| **Error Handling** | 40% | Basic try/catch in stores | No error boundaries, no retry logic, minimal user feedback |

### ❌ Not Started (Planned for Future)

| Feature | Priority | Phase | Est. Effort |
|---------|----------|-------|-------------|
| **Lodestone Auto-Sync** | High | 7 | 2-3 weeks |
| **FFLogs Integration** | Medium | 7 | 2-3 weeks |
| **Week-over-Week Tracking** | Medium | 8 | 1-2 weeks |
| **Discord Bot** | Low | 8 | 2-4 weeks |
| **PWA Offline Mode** | Low | 8 | 1 week |

---

## Critical Issues (Blockers)

### 🔴 P0 - Must Fix Before Production

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| **No database migrations** | Backend | Data loss risk on schema changes | Add Alembic migrations |
| **No rate limiting** | Backend API | DoS vulnerability | Add slowapi rate limiter |
| **No test coverage** | Frontend + Backend | Regressions, bugs | Add pytest (backend) + vitest (frontend) |

### 🟠 P1 - High Priority

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| **Missing error boundaries** | Frontend | App crashes on errors | Add React ErrorBoundary |
| **No ARIA labels** | UI components | Accessibility issues | Add aria-* attributes to dropdowns/modals |
| **Inconsistent button styles** | Throughout UI | Poor UX | Standardize Button component |
| **No loading skeletons** | All pages | Poor perceived performance | Add skeleton components |

### 🟡 P2 - Medium Priority

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| **Raw Tailwind values** | Many components | Design system drift | Use CSS custom properties |
| **Duplicate DEFAULT_SETTINGS** | GroupView, HistoryView, useLootActions | Maintenance burden | Create shared constant |
| **PlayerCard too complex** | PlayerCard.tsx (682 lines) | Hard to maintain | Split into sub-components |

---

## Audit Consolidation

### Backend Code Quality Audit

**Source:** FFXIV_RAID_PLANNER_AUDIT_REPORT.md

#### ✅ Completed Items
- [x] Created shared API client (`services/api.ts`)
- [x] Removed duplicate `authRequest` from stores
- [x] Added barrel exports for components
- [x] Created `backend/app/constants.py`
- [x] Removed legacy models (Phase 1-3 cleanup done per UNIFIED_AUDIT_PLAN)

#### ❌ Outstanding Items
- [ ] **Database Migrations** - Critical: Add Alembic
- [ ] **Database Indexes** - High: Add indexes on common queries
- [ ] **Rate Limiting** - Critical: Add slowapi
- [ ] **Redis Caching** - High: Replace in-memory cache for XIVAPI
- [ ] **Structured Logging** - High: Add structlog
- [ ] **Security Headers** - High: Add CSP, X-Frame-Options, etc.
- [ ] **API Versioning** - Low: Prepare for v2 API

### Frontend UX/UI Audit

**Source:** FFXIV_RAID_PLANNER_UI_UX_AUDIT.md

#### ✅ Completed Items
- [x] Unified dropdown components (SettingsPopover exists)
- [x] Header simplified to single-row layout
- [x] PlayerCard has left-accent role styling

#### ❌ Outstanding Items
- [ ] **Badge overflow** - Medium: PlayerCard shows 7+ badges, need overflow UI
- [ ] **Toast notifications** - High: Toast.tsx exists but not integrated
- [ ] **Design token audit** - Medium: Many raw Tailwind values remain
- [ ] **Keyboard shortcuts** - Low: No global keyboard handler
- [ ] **Onboarding tooltips** - Low: No first-run experience

### Loot System Audit

**Sources:** LOOT_SYSTEM_COMPREHENSIVE_AUDIT.md, LOOT_PRIORITY_UPDATES_PLAN.md, LOOT_SYSTEM_AUDIT_IMPLEMENTATION.md

#### ✅ Completed Items
- [x] Created `lootCoordination.ts` utilities
- [x] Created `useLootActions` hook
- [x] Built `QuickLogDropModal` component
- [x] Implemented weapon priority system
- [x] Added loot log tracking (LootLogPanel)
- [x] Added book/page tracking (PageBalancesPanel)
- [x] Backend loot_log_entry and page_ledger_entry models
- [x] Backend API endpoints for loot tracking
- [x] Enabled inline log buttons with `showLogButtons={canEdit}`
- [x] Enhanced priority scores displayed in tooltips
- [x] Always show weapon priority on all floors (with "Drops this floor" badge on F4)
- [x] Leads can delete loot entries (changed from owner-only)
- [x] Book balance inline editing
- [x] Priority-sorted recipient dropdowns with labels
- [x] UI state persistence (tabs, weeks, tiers)
- [x] Tier-specific share links
- [x] Main job always wins weapon priority (2000-point bonus)

#### ❌ Outstanding Items
- [ ] **Tab restructure** - Low: Consider consolidating Loot + History into "Loot Session" view

---

## Technical Debt Prioritization

### ✅ Completed (Phase 6.5)

1. ~~**Enable inline loot logging**~~ ✅
   - Inline log buttons in Loot tab with QuickLogDropModal
   - Priority-sorted recipients with labels

2. ~~**Verify loot system integration**~~ ✅
   - Logging via Loot tab → gear updates ✓
   - Logging via History tab → gear updates ✓
   - Delete → gear reverts ✓
   - Book balance inline editing ✓

3. ~~**UI state persistence**~~ ✅
   - Tab selection persists on refresh
   - Week selection persists per tier
   - Tier selection persists per group

### Short Term (Next 2 Weeks)

1. **Add error boundaries**
   - Create ErrorBoundary component
   - Wrap routes and key components
   - Add error fallback UI

2. **Add database migrations**
   - Set up Alembic
   - Create initial migration from current schema
   - Document migration workflow

3. **Add basic test suite**
   - Frontend: vitest + testing-library
   - Backend: pytest + async tests
   - Cover critical paths (auth, loot logging, gear updates)

### Medium Term (Next Month)

4. **Accessibility improvements**
   - Add ARIA labels to all dropdowns/modals
   - Implement keyboard navigation
   - Test with screen reader

5. **Design system cleanup**
   - Audit all raw Tailwind usage
   - Replace with CSS custom properties
   - Standardize button/badge components

6. **Performance optimization**
   - Add React.memo to PlayerCard
   - Implement code splitting
   - Add skeleton loading states

### Long Term (Next Quarter)

7. **Redis caching layer**
   - Set up Redis
   - Migrate XIVAPI cache
   - Add cache invalidation strategy

8. **Production security**
   - Rate limiting (slowapi)
   - Security headers
   - CORS tightening
   - Audit logging

9. **Lodestone auto-sync**
   - XIVAPI character endpoint integration
   - Auto-update gear from Lodestone
   - Sync scheduling system

---

## File Status Matrix

### Documentation Files

| File | Status | Action |
|------|--------|--------|
| README.md | Current | Keep, update tier info |
| CLAUDE.md | Current | Keep, consolidate project guide |
| frontend/README.md | Current | Keep minimal |
| docs/GEARING_MATH.md | Current | Keep as reference |
| docs/ROADMAP.md | **Outdated** | Archive, content moved here |
| docs/ARCHITECTURE_SPEC.md | **Outdated** | Archive, was initial planning |
| docs/UNIFIED_AUDIT_PLAN.md | **Partially outdated** | Archive, consolidate here |
| docs/LOOT_PRIORITY_UPDATES_PLAN.md | **Mostly complete** | Archive, 90% implemented |
| docs/LOOT_SYSTEM_AUDIT_IMPLEMENTATION.md | **Redundant** | Archive, overlaps with above |
| docs/audit-reports/*.md | **Historical** | Archive, preserve as snapshots |

### Key Implementation Files

| File | Status | Notes |
|------|--------|-------|
| frontend/src/utils/lootCoordination.ts | ✅ Working | Cross-store coordination |
| frontend/src/hooks/useLootActions.ts | ✅ Working | Loot action handlers |
| frontend/src/components/loot/QuickLogDropModal.tsx | ✅ Working | Inline logging with priority labels |
| frontend/src/components/loot/LootPriorityPanel.tsx | ✅ Working | Gear + weapon priority with sub-tabs |
| frontend/src/components/weapon-priority/WeaponPriorityModal.tsx | ✅ Working | Multi-job priority management |
| frontend/src/components/history/LootLogPanel.tsx | ✅ Working | Loot log with week navigation |
| frontend/src/components/history/PageBalancesPanel.tsx | ✅ Working | Book tracking with inline editing |
| frontend/src/components/history/EditBookBalanceModal.tsx | ✅ Working | Manual balance adjustment |
| backend/app/models/loot_log_entry.py | ✅ Working | Loot log model |
| backend/app/models/page_ledger_entry.py | ✅ Working | Book ledger model |
| backend/app/routers/loot_tracking.py | ✅ Working | Loot/book API endpoints |

---

## Next Steps

### ✅ Completed (January 1, 2026)
1. ~~Complete documentation consolidation~~ ✅
2. ~~Update CLAUDE.md with current tier info~~ ✅
3. ~~Enable inline loot logging feature~~ ✅
4. ~~UI state persistence (tabs, weeks, tiers)~~ ✅
5. ~~Tier-specific share links~~ ✅

### ✅ Completed (January 2, 2026)
6. ~~Parity audit comparing web-app to spreadsheets~~ ✅
7. ~~Create implementation plan for parity gaps~~ ✅

### 🔨 Current Priority: Parity Implementation
See plan: `/home/serapis/.claude/plans/nifty-pondering-summit.md`

**Phase 1:** Backend schema changes (GearSourceCategory, adjustments, migration)
**Phase 2:** Frontend type definitions
**Phase 3:** Business logic (iLv calculation, priority adjustments)
**Phase 4:** UI updates (currentSource selector, iLv display, adjustments)
**Phase 5:** Testing and documentation

### After Parity
8. Archive old planning/audit files to docs/archive/
9. Add error boundaries
10. Set up database migrations (Alembic)

### This Month
9. Add basic test suite (vitest + pytest)
10. Complete accessibility improvements
11. Clean up design system

### This Quarter
12. Production readiness (security, caching, monitoring)
13. Lodestone auto-sync feature
14. Consider FFLogs integration

---

## Archive Recommendations

Move to `docs/archive/`:

**2025-12-planning/** (Historical planning docs)
- ARCHITECTURE_SPEC.md
- ROADMAP.md
- LOOT_PRIORITY_UPDATES_PLAN.md
- LOOT_SYSTEM_AUDIT_IMPLEMENTATION.md

**2025-12-audits/** (Audit snapshots)
- UNIFIED_AUDIT_PLAN.md
- FFXIV_RAID_PLANNER_UI_UX_AUDIT.md
- FFXIV_RAID_PLANNER_AUDIT_REPORT.md
- LOOT_SYSTEM_COMPREHENSIVE_AUDIT.md

Add README.md in each:
```markdown
# Historical Documentation

These files are preserved for historical reference. They represent the state
of planning and auditing as of December 2025 - January 2026.

For current status, see: /docs/CONSOLIDATED_STATUS.md
```

---

**Document maintained by:** Development Team
**Review cadence:** Monthly or after major features
