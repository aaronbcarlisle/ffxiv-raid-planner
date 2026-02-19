# Priority System Overhaul - Implementation Plan

**Status:** UI Complete, Multiplier Wiring Complete
**Last Updated:** 2026-02-01
**Version:** 2.1

---

## Overview

Major redesign of the priority system to give leads/owners complete control over loot distribution. Includes:
- Priority Settings slide-out panel (accessible from Loot/Log tabs)
- Multiple priority modes (Role, Job, Player, Manual Planning, Disabled)
- Advanced calculation tuning with presets
- Log Week Wizard for batch logging

---

## Current Implementation Status

### Completed
- [x] Priority Settings slide-out panel (basic structure)
- [x] Mode selector (Role, Job, Player, Manual Planning, Disabled)
- [x] Role-based editor with DnD
- [x] Job-based editor with DnD (groups work, items work)
- [x] Player-based editor with DnD (groups work, items work)
- [x] Advanced options (presets, multipliers)
- [x] Log Week Wizard (includes materials, slots, augmentation, "Free for All")
- [x] Priority panel accessible from Loot tab
- [x] SlideOutPanel component with proper text selection handling
- [x] Types defined in `types/index.ts`
- [x] Alt+P keyboard shortcut opens Priority Settings
- [x] **Multipliers wired to calculations** (2026-02-01)
  - advancedOptions multipliers now used in priority.ts
  - useMultipliers, useWeightedNeed, useLootAdjustments toggles work
  - Enhanced fairness uses configurable drought/balance multipliers
  - Vestigial `components/priority/PriorityTab.tsx` deleted

### In Progress / Needs Work
- [ ] Log Week Wizard refinements (see Phase 5 below)
- [ ] DnD improvements for Job/Player modes (visual indicators)
- [ ] Priority panel accessible from Log tab header

### Not Started
- [ ] Backend: Weekly assignments table & API (for Manual Planning)
- [ ] Manual Planning mode UI in Loot tab
- [ ] Migration script for existing statics

---

## Architecture

### Priority Panel Structure (Revised)

Two-tab layout inside slide-out panel:

```
┌─────────────────────────────────────────────┐
│ [Settings icon] Priority Settings      [X]  │
├─────────────────────────────────────────────┤
│  [ Priority Mode ]  [ Advanced ]            │
├─────────────────────────────────────────────┤
│                                             │
│  (Tab content here)                         │
│                                             │
├─────────────────────────────────────────────┤
│                          [ Save Changes ]   │  ← Sticky footer
└─────────────────────────────────────────────┘
```

**Priority Mode Tab:**
- Mode selector dropdown
- Mode-specific editor (Role/Job/Player/Manual)
- For Role-based: Option to show/edit priority values

**Advanced Tab:**
Two sub-tabs:
```
[ Role Priority ] [ Calculations ]
```

- **Role Priority**: Priority value spinboxes for each role (when enabled)
- **Calculations**:
  - Preset selector (Balanced, Strict Fairness, Gear Need Focus, Custom)
  - [ ] Enable Custom Multipliers → expandable section
  - [ ] Enable Enhanced Fairness → expandable section
  - Each multiplier has its own enable/disable checkbox

---

## Phase 1: Backend for Manual Planning (NOT STARTED)

### Files to Create
- `backend/app/models/weekly_assignment.py`
- `backend/app/schemas/weekly_assignment.py`

### Database Table
```sql
CREATE TABLE weekly_assignments (
  id VARCHAR(36) PRIMARY KEY,
  static_group_id VARCHAR(36) NOT NULL REFERENCES static_groups(id) ON DELETE CASCADE,
  tier_id VARCHAR(50) NOT NULL,
  week INTEGER NOT NULL,
  floor VARCHAR(20) NOT NULL,
  slot VARCHAR(20) NOT NULL,
  player_id VARCHAR(36) REFERENCES snapshot_players(id),
  sort_order INTEGER DEFAULT 0,
  did_not_drop BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(static_group_id, tier_id, week, floor, slot, player_id)
);
```

### API Endpoints
- `GET /api/static-groups/{id}/tiers/{tierId}/assignments?week=N`
- `POST /api/static-groups/{id}/tiers/{tierId}/assignments`
- `DELETE /api/static-groups/{id}/tiers/{tierId}/assignments/{assignmentId}`

---

## Phase 2: Priority Panel Refinements

### 2.1 Two-Tab Layout
**File:** `components/priority/PriorityTab.tsx`

- Add tab navigation: `[ Priority Mode ] [ Advanced ]`
- Priority Mode tab: Mode selector + mode-specific editor
- Advanced tab: Sub-tabs for Role Priority and Calculations

### 2.2 Advanced Tab Sub-Tabs
**File:** `components/priority/AdvancedOptions.tsx`

- `[ Role Priority ]`: Show priority spinboxes for each role
- `[ Calculations ]`: Presets + multiplier sections

### 2.3 Checkbox Structure for Multipliers
Each multiplier group:
```
[ ] Enable Custom Multipliers  [Active badge when enabled]
    ├── [ ] Role Priority Multiplier: [___]
    ├── [ ] Gear Needed Multiplier: [___]
    ├── [ ] Loot Received Penalty: [___]
    └── ...

[ ] Enable Enhanced Fairness  [Active badge when enabled]
    ├── [ ] Drought Bonus Multiplier: [___]
    ├── [ ] Drought Cap (weeks): [___]
    └── ...
```

### 2.4 Sticky Footer
The Save Changes button should be in a sticky footer that's always visible.

### 2.5 Panel Icon
Add Settings2 icon to panel title.

### 2.6 Checkbox Alignment Fix
**File:** `components/ui/Checkbox.tsx`

Fix vertical alignment when tip text is present. Options:
1. Move tip to tooltip on hover
2. Align checkbox to top of text block
3. Use `items-start` instead of `items-center`

### 2.7 Scrollbar Shift Fix
Add `overflow-y: scroll` or use `scrollbar-gutter: stable` to prevent content shift.

---

## Phase 3: DnD Improvements for Job/Player Modes

### Current Issues
- Groups only swap positions, can't reorder freely
- Items can only reorder within container, not move between groups
- No visual drop indicators

### Solution
Follow `WeaponPriorityGrid.tsx` pattern:
- Use `@dnd-kit/core` with `DndContext` and `DragOverlay`
- Custom collision detection for cross-container drops
- Visual drop indicators (line or highlight)
- Smooth animations

**Files to Update:**
- `components/priority/JobBasedEditor.tsx`
- `components/priority/PlayerBasedEditor.tsx`

---

## Phase 4: Manual Planning Mode UI

### In Priority Panel (when Manual Planning selected)
Show info message: "Configure assignments in the Loot tab"

### In Loot Tab (Gear Priority sub-tab)
When Manual Planning mode is active:
```
Week: [ 1 ▼ ]  [ Log This Week's Drops ]

M9S - Gear Priority
┌──────────────────────────────────────────┐
│ [Head]    [ + Assign Player ▼ ]    [x]   │
│ [Body]    [ Alex (WAR) ]           [x]   │
│ [Hands]   [ + Assign Player ▼ ]    [x]   │
│ ...                                      │
└──────────────────────────────────────────┘
```

- "+ Assign Player" dropdown shows players who need that item
- Assigned players can be removed
- Assignments persist to backend

---

## Phase 5: Log Week Wizard Refinements

### 5.1 Layout Changes
**File:** `components/loot/LogWeekWizard.tsx`

- Use `size="2xl"` for wider modal
- Horizontal layout: Gear (left) | Materials (right) for floors with both
- Each slot layout:
  ```
  [ Icon ] [ Select Player ▼ ] [ ] Didn't Drop
  [ ] Mark head as acquired for PlayerName
  ```

### 5.2 Floor Tabs with Checkboxes
Allow unchecking entire floors:
```
[ ] M9S  [x] M10S  [x] M11S  [x] M12S
```
- Checked = cleared this floor
- Unchecked = skip this floor entirely
- Clicking tab name switches to that floor's content

### 5.3 "Free for All" Label
When no players need an item, show "(Free for All)" in dropdown:
```
[ (Free for All) ▼ ]
```

### 5.4 Material Handling (Critical Fix)
**Reference:** `components/history/LogMaterialModal.tsx`

Materials need:
- Material type (Twine, Glaze, Solvent)
- Target slot dropdown (which gear to augment)
- Player dropdown (based on who needs augmentation for that slot)
- [ ] Mark [slot] as augmented for [player]

Current wizard is missing slot selection and augmentation checkbox.

### 5.5 Summary Page Improvements
- Use gear icons next to slot names
- Two-column layout for more visibility
- Match Create Static wizard's summary style (lots of real estate)

### 5.6 Back Button Style
Match Create Static wizard's back button (text button, not ghost).

### 5.7 Dropdown Height Bug
Fix material section height jumping when dropdown opens/closes.

---

## Phase 6: Integration & Cleanup

### 6.1 Priority Panel in Log Tab
**File:** `pages/GroupView.tsx`

Add "Priority Settings" button to Log tab header for leads/owners.

### 6.2 Log Week Button in Loot Tab
Add for selected floor in Gear Priority tab.

### 6.3 Alt+P Keyboard Shortcut
**Files:**
- `hooks/useGroupViewKeyboardShortcuts.ts`
- `components/ui/KeyboardShortcutsHelp.tsx`

- Alt+P opens Priority Settings panel
- Only show in shortcuts help for leads/owners/admins

### 6.4 Remove Priority Tab from Settings Modal
**File:** `components/static-group/GroupSettingsModal.tsx`

Remove the Priority tab since it's now a slide-out panel.

---

## Data Model

### StaticPrioritySettings (in static_groups.settings JSON)

```typescript
interface StaticPrioritySettings {
  mode: 'role-based' | 'job-based' | 'player-based' | 'manual-planning' | 'disabled';

  roleBasedConfig?: {
    roleOrder: RoleType[];
    rolePriorities?: Record<RoleType, number>;  // NEW: custom priority values
  };

  jobBasedConfig?: {
    groups: Array<{ id: string; name: string; sortOrder: number; basePriority: number; }>;
    jobs: Array<{ job: string; groupId: string; sortOrder: number; priorityOffset: number; }>;
    showAdvancedControls: boolean;
  };

  playerBasedConfig?: {
    groups: Array<{ id: string; name: string; sortOrder: number; basePriority: number; }>;
    players: Array<{ playerId: string; groupId: string; sortOrder: number; priorityOffset: number; }>;
    showAdvancedControls: boolean;
  };

  advancedOptions: {
    showPriorityScores: boolean;
    preset: 'balanced' | 'strict-fairness' | 'gear-need-focus' | 'custom';

    // NEW: Individual enable/disable flags
    enableCustomMultipliers: boolean;
    enableEnhancedFairness: boolean;

    // Core multipliers (each can be toggled)
    rolePriorityEnabled: boolean;
    rolePriorityMultiplier: number;
    gearNeededEnabled: boolean;
    gearNeededMultiplier: number;
    lootReceivedEnabled: boolean;
    lootReceivedPenalty: number;
    useWeightedNeed: boolean;
    useLootAdjustments: boolean;

    // Enhanced fairness
    droughtBonusEnabled: boolean;
    droughtBonusMultiplier: number;
    droughtBonusCapWeeks: number;
    balancePenaltyEnabled: boolean;
    balancePenaltyMultiplier: number;
    balancePenaltyCapDrops: number;
  };
}
```

---

## Files Summary

### Priority Panel Components
| File | Status | Purpose |
|------|--------|---------|
| `components/priority/PriorityTab.tsx` | Needs Update | Main container, add tabs |
| `components/priority/ModeSelector.tsx` | Done | Mode dropdown |
| `components/priority/RoleBasedEditor.tsx` | Needs Update | Add priority spinboxes option |
| `components/priority/JobBasedEditor.tsx` | Needs Update | Fix DnD |
| `components/priority/PlayerBasedEditor.tsx` | Needs Update | Fix DnD |
| `components/priority/AdvancedOptions.tsx` | Needs Rewrite | Two sub-tabs, per-multiplier toggles |
| `components/priority/ManualPlanningEditor.tsx` | Not Created | Weekly assignment UI |

### Log Week Wizard
| File | Status | Purpose |
|------|--------|---------|
| `components/loot/LogWeekWizard.tsx` | Needs Update | All refinements from Phase 5 |

### Integration
| File | Status | Purpose |
|------|--------|---------|
| `pages/GroupView.tsx` | Needs Update | Log tab button, Alt+P shortcut |
| `components/static-group/GroupSettingsModal.tsx` | Needs Update | Remove Priority tab |
| `hooks/useGroupViewKeyboardShortcuts.ts` | Needs Update | Alt+P shortcut |
| `components/ui/KeyboardShortcutsHelp.tsx` | Needs Update | Show Alt+P for leads/owners |
| `components/ui/Checkbox.tsx` | Needs Update | Fix alignment with tip text |

### Backend (Manual Planning)
| File | Status | Purpose |
|------|--------|---------|
| `backend/app/models/weekly_assignment.py` | Not Created | Model |
| `backend/app/schemas/weekly_assignment.py` | Not Created | Schemas |
| `backend/app/routers/tiers.py` | Needs Update | CRUD endpoints |

---

## Verification Checklist

### Log Week Wizard
- [ ] Gear slots show icon + dropdown + "Didn't drop" in one line
- [ ] Floor tabs are checkable (can uncheck floors not cleared)
- [ ] Items with no priority show "(Free for All)"
- [ ] Materials have slot selection and "Mark as augmented"
- [ ] Materials dropdown shows players correctly
- [ ] Summary page uses gear icons and is easy to scan
- [ ] Modal is wide enough (2xl)
- [ ] Back button matches Create Static wizard

### Priority Panel
- [ ] Two-tab layout works (Priority Mode / Advanced)
- [ ] Advanced has sub-tabs (Role Priority / Calculations)
- [ ] Each multiplier has enable/disable checkbox
- [ ] Enhanced Fairness is its own expandable section
- [ ] Save button is sticky at bottom
- [ ] Alt+P opens panel (leads/owners only)
- [ ] Icon in panel title
- [ ] No scrollbar shift when content changes

### DnD
- [ ] Jobs/Players can drag between groups freely
- [ ] Groups can be reordered (not just swapped)
- [ ] Visual drop indicators like WeaponPriorityGrid

### Integration
- [ ] Priority button in Log tab
- [ ] Log Week button in Loot tab (per-floor version)
- [ ] Priority tab removed from Settings modal
- [ ] Manual Planning mode shows assignments in Loot tab

---

## Open Decisions

1. **Checkbox tip text**: Move to tooltip or fix alignment?
   - **Recommendation**: Move to tooltip for cleaner look

2. **Material handling in wizard**: Separate materials step or inline with gear?
   - **Recommendation**: Inline, but in right column

3. **Free for All behavior**: Auto-select first player or leave empty?
   - **Recommendation**: Leave empty, let user choose

---

## Session Notes

### 2026-01-31 Session 1
- Created Log Week Wizard (basic implementation)
- Priority panel as slide-out from Loot tab
- Fixed SlideOutPanel text selection issue
- Identified issues with material handling, DnD, and modal layout

### 2026-01-31 Session 2 (Current)
- User feedback on wizard layout, materials, DnD
- Decision: Two-tab structure for Priority panel
- Decision: Create persistent plan file in project
- Major refinements needed for Phase 5 (wizard) and Phase 2 (panel)
