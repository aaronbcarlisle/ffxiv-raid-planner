# Loot Tracking System Redesign

## Summary
Redesign the loot tracking system to provide a unified week-based overview, add material logging, enhance Progress tab into Summary view, add quick-log functionality to Weapon Priority, and enable customizable loot priority settings per static group.

## Tab Structure (After Redesign)

| Tab | Purpose | Question it answers |
|-----|---------|---------------------|
| **Roster** | Player configuration | "Who's in our static and what's their BiS?" |
| **Priority** | Decision support + quick logging | "Who should get the next drop?" |
| **Log** | Week-by-week unified view | "What happened this week?" |
| **Summary** | Aggregated totals + needs | "Where do we stand overall?" |

---

## 6 Phases (Prioritized)

| Phase | Focus | Effort | Dependencies |
|-------|-------|--------|--------------|
| 0 | Customizable Loot Priority Settings | 1 day | None |
| 1 | Material Logging Backend | 2-3 days | None |
| 2 | Unified Week Overview UI | 3-4 days | Phase 1 |
| 3 | Summary Tab Redesign | 2 days | Phase 1, 2 |
| 4 | Weapon Priority Quick-Log | 1 day | None (parallel) |
| 5 | Week Selector Enhancement | 1 day | Phase 2 |

---

## Phase 0: Customizable Loot Priority Settings

**Goal**: Enable Owners/Leads to customize role-based loot priority per static group.

### Current State
- `StaticSettings` type exists with `lootPriority: Role[]` field
- `utils/priority.ts` already uses `settings.lootPriority` for calculations
- All code currently passes `DEFAULT_SETTINGS` instead of actual group settings
- No UI exists to customize priority order

### Backend Changes
| File | Change |
|------|--------|
| `backend/app/models/static_group.py` | Add `settings` JSON column |
| `backend/alembic/versions/XXXX_add_static_settings.py` | NEW - Migration |
| `backend/app/schemas/static_groups.py` | Add StaticSettings schema |
| `backend/app/routers/static_groups.py` | Handle settings in create/update |

### Frontend Changes
| File | Change |
|------|--------|
| `frontend/src/types/index.ts` | Ensure StaticSettings exported |
| `frontend/src/stores/staticGroupStore.ts` | Store settings, add updateSettings action |
| `frontend/src/components/static-group/GroupSettingsModal.tsx` | Add Priority tab with drag-drop reorder |
| `frontend/src/components/loot/LootPriorityPanel.tsx` | Pass real settings instead of DEFAULT_SETTINGS |
| `frontend/src/utils/priority.ts` | No change (already supports custom settings) |

### Priority Customization UI
```
┌─────────────────────────────────────────────────────────────┐
│  Group Settings                                      [×]    │
├─────────────────────────────────────────────────────────────┤
│  [General]  [Priority]  [Danger Zone]                       │
│                                                             │
│  Loot Priority Order (drag to reorder):                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ≡  1. Melee                                         │    │
│  │ ≡  2. Ranged                                        │    │
│  │ ≡  3. Caster                                        │    │
│  │ ≡  4. Tank                                          │    │
│  │ ≡  5. Healer                                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  [Reset to Default]                     [Cancel]  [Save]    │
└─────────────────────────────────────────────────────────────┘
```

### Behavior
- Default order: Melee > Ranged > Caster > Tank > Healer
- Owners and Leads can reorder via drag-and-drop
- Changes immediately affect priority calculations across all views
- Reset button restores default order

---

## Phase 1: Material Logging Backend

**Goal**: Add database support for tracking upgrade material distribution.

### Database Changes
- **New table**: `material_log_entries`
  - `id`, `tier_snapshot_id`, `week_number`, `floor`
  - `material_type` (enum: twine/glaze/solvent)
  - `recipient_player_id`, `notes`, `created_at`, `created_by_user_id`

### Backend Files
| File | Change |
|------|--------|
| `backend/alembic/versions/XXXX_add_material_log_entries.py` | NEW - Migration |
| `backend/app/models/material_log_entry.py` | NEW - Model |
| `backend/app/models/__init__.py` | Export new model |
| `backend/app/schemas/loot_tracking.py` | Add MaterialLogEntry schemas |
| `backend/app/routers/loot_tracking.py` | Add CRUD endpoints |

### New Endpoints
- `GET/POST /{group_id}/tiers/{tier_id}/material-log`
- `DELETE /{group_id}/tiers/{tier_id}/material-log/{entry_id}`
- `GET /{group_id}/tiers/{tier_id}/material-balances`
- Update `weeks-with-entries` to include materials

### Frontend Files
| File | Change |
|------|--------|
| `frontend/src/types/index.ts` | Add MaterialLogEntry, MaterialBalance types |
| `frontend/src/stores/lootTrackingStore.ts` | Add material state + actions |

---

## Phase 2: Unified Week Overview UI

**Goal**: Replace two-panel History view with unified per-player week table.

### New Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  Week Selector: [←] [Week 3 (loot/books) ▼] [→] [+ Add Week]   │
├─────────────────────────────────────────────────────────────────┤
│  Player      │ Loot Received    │ Materials │ I  │ II │III│ IV │
│  ──────────────────────────────────────────────────────────────│
│  Zara (DRG)  │ Body (M11S)      │ T:1       │ +1 │ +1 │ +1│ -  │
│  Kai (WHM)   │ -                │ -         │ +1 │ +1 │ +1│ -  │
│  Rin (PLD)   │ Weapon (M12S)    │ T:1 S:1   │ +1 │ +1 │ +1│ +1 │
│                                                                 │
│  [Mark Floor Cleared]  [Log Loot]  [Log Material]  [Adjust]    │
└─────────────────────────────────────────────────────────────────┘
```

### New Components
| File | Description |
|------|-------------|
| `frontend/src/components/history/UnifiedWeekOverview.tsx` | Main unified table |
| `frontend/src/components/history/WeekSummaryRow.tsx` | Expandable player row |
| `frontend/src/components/history/LogMaterialModal.tsx` | Material logging modal |
| `frontend/src/components/history/QuickActionsToolbar.tsx` | Action buttons |
| `frontend/src/hooks/useWeekSummary.ts` | Data aggregation hook |

### Modified Files
| File | Change |
|------|--------|
| `frontend/src/components/history/HistoryView.tsx` | Use UnifiedWeekOverview |

### Deprecated (remove after Phase 2)
- `frontend/src/components/history/LootLogPanel.tsx`
- `frontend/src/components/history/PageBalancesPanel.tsx`

---

## Phase 3: Summary Tab Redesign

**Goal**: Rename Progress to Summary, combine tracking + needs in one view.

### New Table Structure
| Player | Gear % | Books Earned | Books Balance | Books Needed | Mats Received | Mats Needed |
|--------|--------|--------------|---------------|--------------|---------------|-------------|
| (name) | 72%    | I:4 II:3...  | I:2 II:3...   | I:4 II:2...  | T:1 G:0 S:0   | T:2 G:1 S:0 |

### Files
| File | Change |
|------|--------|
| `frontend/src/components/team/TeamSummaryEnhanced.tsx` | NEW - Combined view |
| `frontend/src/pages/GroupView.tsx` | Rename tab "Progress" → "Summary" |
| `frontend/src/utils/calculations.ts` | Add remaining calculations |

### Deprecated
- `frontend/src/components/team/TeamSummary.tsx`

---

## Phase 4: Weapon Priority Quick-Log

**Goal**: Add "Log" button to Weapon Priority (same pattern as Gear Priority).

### Files
| File | Change |
|------|--------|
| `frontend/src/components/loot/WeaponPriorityList.tsx` | Add log button on hover |
| `frontend/src/components/loot/QuickLogWeaponModal.tsx` | NEW - Confirmation modal |
| `frontend/src/utils/lootCoordination.ts` | Add `logWeaponDrop()` function |

### Behavior
- First-priority player for each weapon shows "Log" button on hover
- Opens modal to confirm drop (can change recipient)
- Updates `weaponPriorities[job].received = true`

---

## Phase 5: Week Selector Enhancement

**Goal**: Only show weeks with data, add type indicators and "Add Week" button.

### New Format
- Only weeks with entries shown in dropdown
- Format: "Week 3 (loot/books)" or "Week 2 (mats)"
- "Add Week" button navigates to current calculated week

### Files
| File | Change |
|------|--------|
| `frontend/src/components/history/WeekSelector.tsx` | Filter + type indicators |
| `backend/app/routers/loot_tracking.py` | Add `weeks-data-types` endpoint |
| `frontend/src/stores/lootTrackingStore.ts` | Add weekDataTypes state |

---

## Material Drop Reference

| Floor | Materials | Notes |
|-------|-----------|-------|
| M9S | None | Accessories only |
| M10S | Glaze | 1 per clear |
| M11S | Twine + Solvent | 1 each per clear |
| M12S | None | Weapon only |

---

## Decisions Made

1. **Material Priority**: Yes - add priority scoring like gear. Calculate who needs materials most and show sorted suggestions when logging.
2. **Week "Add" Behavior**: Navigate to current calculated week (based on tier start date).
3. **Deprecation**: Remove old components immediately after Phase 2.
4. **Loot Priority Customization**: Include in this redesign to avoid later refactoring.

---

## Pre-Implementation

**IMPORTANT**: Commit and push current changes before starting this work to snapshot where we're at.

---

## Audit Findings to Address

The following issues from the 2026-01-01 audit should be addressed during this redesign:

| ID | Issue | How to Address |
|----|-------|---------------|
| P-006 | Missing useMemo in priority calculations | Add useMemo to all new priority/calculation hooks |
| U-006 | Missing empty state in Loot Log | Add informative empty states in UnifiedWeekOverview |
| P-005 | Large component files | Keep new components < 300 lines, extract sub-components |
| D-001 | Modal pattern duplication | Create shared modal wrapper or hook for new modals |
| D-002 | Permission check duplication | Create usePermissions hook for consistent access checks |
| P-007 | Component re-renders | Use React.memo on player row components |

### New Shared Utilities

| File | Purpose |
|------|---------|
| `frontend/src/hooks/usePermissions.ts` | Centralized permission checking hook |
| `frontend/src/components/ui/FormModal.tsx` | Shared modal wrapper with form handling |

---

## Success Criteria

1. Owners/Leads can customize loot priority order per static group
2. Log material drops with same ease as gear drops
3. Week overview shows all activity types in one unified view
4. Summary tab answers "what do I still need?" at a glance
5. Weapon priority has parity with gear priority (quick-log button)
6. Week selector is cleaner (no empty weeks, type indicators)
7. No data loss or breaking changes to existing functionality
8. New components follow audit recommendations (memoization, small files, shared utilities)
