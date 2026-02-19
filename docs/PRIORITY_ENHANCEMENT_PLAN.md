# Loot Priority Enhancement & Pre-Planned Distribution

## Summary

Enhance the loot priority system with more flexibility based on user feedback from Reddit.

**MVP Scope**: Phase 1 only (priority flexibility)
**Future**: Phase 2 (breakdown UI), Phase 3 (pre-plan distribution)
**Deferred**: Alt support (separate project)

## User Feedback Summary

| User | Request |
|------|---------|
| **Noxus11** | Turn off role priority for equal distribution groups |
| **RiotFairguard** | Pre-plan loot before raid, apply with one click after |
| **bubblegum_cloud** | Supports getting weapon over DPS (priority order issues) |
| **Multiple users** | Alt BiS tracking, split run support |

---

## Phase 1: Flexible Priority Settings (MVP) ✅ COMPLETE

### Goal
Give users control over priority calculations without breaking the default experience.

> **Update 2026-02-01:** Advanced Options multipliers are now fully wired to calculations.
> All toggles (useMultipliers, useWeightedNeed, useLootAdjustments) work correctly.
> Enhanced fairness uses configurable drought bonus and balance penalty multipliers.

### Key User Needs Addressed
- **Noxus11**: "Turn off role priority" → `priorityMode: 'disabled'`
- **bubblegum_cloud**: "Supports getting weapon over DPS" → Job modifiers
- **General**: More control over priority calculations → Exposed settings

### Data Model Changes

**StaticSettings** (added to existing):
```typescript
priorityMode: 'automatic' | 'manual' | 'disabled';  // Default: 'automatic'
jobPriorityModifiers?: Record<string, number>;       // e.g., { "PCT": +20, "WAR": -10 }
showPriorityScores?: boolean;                        // Default: true
enableEnhancedScoring?: boolean;                     // Default: false (opt-in)
```

**SnapshotPlayer** (added to existing):
```typescript
priorityModifier?: number;  // Per-player adjustment (-100 to +100)
```

### Priority Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Automatic** | System calculates, suggests top priority | Most groups (default) |
| **Manual** | Shows priority but doesn't auto-suggest | "I'll decide each drop" |
| **Disabled** | All players show equal priority (0) | Equal distribution groups |

### Updated Priority Formula
```
score = rolePriority + (weightedNeed × 10)
      + jobModifier          // Job-level adjustment
      + playerModifier       // Player-level adjustment
      - (lootAdjustment × 15)
      + droughtBonus         // If enhanced scoring enabled
      - balancePenalty       // If enhanced scoring enabled
```

### UI: Enhanced Priority Settings Tab

```
Priority Settings
├── Mode Selection
│   ├── ● Automatic (recommended)
│   ├── ○ Manual (show priority, I decide)
│   └── ○ Disabled (equal distribution)
│
├── Role Priority Order (existing drag-drop)
│   └── [Melee] [Ranged] [Caster] [Tank] [Healer]
│
└── ▸ Advanced Options (collapsed by default)
    ├── Enhanced Fairness Scoring [Toggle]
    │   └── Adds drought bonus and balance penalty
    ├── Job Adjustments [+]
    │   └── Fine-tune priority for specific jobs
    └── Show Priority Scores [Toggle]
```

### Files Modified

| File | Changes |
|------|---------|
| `frontend/src/types/index.ts` | Added new StaticSettings fields, PriorityMode type |
| `backend/app/schemas/static_group.py` | Added new settings schema fields |
| `backend/app/models/snapshot_player.py` | Added `priority_modifier` column |
| `backend/app/schemas/tier_snapshot.py` | Added `priority_modifier` to player schemas |
| `frontend/src/utils/priority.ts` | Updated `calculatePriorityScore()` with new modifiers |
| `frontend/src/utils/constants.ts` | Added default values for new settings |
| `frontend/src/components/static-group/GroupSettingsModal.tsx` | Enhanced Priority tab UI |
| `frontend/src/components/loot/LootPriorityPanel.tsx` | Respects priorityMode and new settings |
| `frontend/src/components/player/PlayerCard.tsx` | Added "Adjust Priority" context menu |
| `frontend/src/components/player/PriorityAdjustModal.tsx` | NEW: Player priority adjustment modal |
| `backend/alembic/versions/h8i9j0k1l2m3_...` | NEW: Migration for priority_modifier column |

---

## Phase 2: Priority Breakdown UI (FUTURE)

### Goal
Expose the priority calculation so users understand and can tweak it.

### New Component: PriorityBreakdown

Accessible via hover/click on priority scores:

```
Priority Score: 118
─────────────────────
Role (Caster #3):    +75
Gear Needed:         +33
  └─ Body, Hands, Ring
Job Modifier (BLM):  +10
Player Modifier:      -5
Loot Adjustment:     -15
Drought Bonus:       +20
─────────────────────
```

### Player Card Context Menu Addition
```
⋮ Menu
├── ... existing options ...
└── Adjust Priority → Opens slider modal
```

### Files to Create/Modify

| File | Changes |
|------|---------|
| `frontend/src/components/loot/PriorityBreakdown.tsx` | NEW: Breakdown popover |
| `frontend/src/components/player/PriorityAdjustModal.tsx` | NEW: Player adjustment |
| `frontend/src/components/player/PlayerCard.tsx` | Add context menu option |

---

## Phase 3: Pre-Planned Loot Distribution (FUTURE)

### Goal
Allow leaders to plan loot distribution before raid, then apply with one click.

**Key User**: RiotFairguard - "I make a loot list for all four floors in advance of the kills"

### Data Model

**New table: `loot_plans`**
```python
class LootPlan(Base):
    id: str
    tier_snapshot_id: str
    week_number: int
    status: 'draft' | 'active' | 'completed'
    entries: JSON  # Array of LootPlanEntry
    created_at: str
    created_by_user_id: str
```

**LootPlanEntry** (stored in entries JSON):
```typescript
interface LootPlanEntry {
  floor: string;              // "M9S"
  slot: GearSlot;             // "body"
  recipientPlayerId: string;
  priorityAtPlan: number;     // Score when planned
  isManualOverride: boolean;  // True if user changed from auto
}
```

### UI: New "Plan Distribution" Tab

Add as 4th sub-tab in LootPriorityPanel:
`[Matrix] [Gear Priority] [Weapons] [Plan Distribution]`

```
Plan Distribution - Week 5
├── Status: [Draft ▼]
├── Floor: [M9S] [M10S] [M11S] [M12S]
└── Plan Grid:
    ┌──────────┬─────────────┬──────────┐
    │ Slot     │ Assigned To │ Priority │
    ├──────────┼─────────────┼──────────┤
    │ Earring  │ [T1 PLD ▼]  │ 125      │
    │ Necklace │ [H1 WHM ▼]  │ 115      │
    │ Ring     │ [M1 DRG ▼]  │ 150      │
    │ Ring     │ [R1 BRD ▼]  │ 140      │
    └──────────┴─────────────┴──────────┘

    [Generate from Priority] [Apply All] [Clear]
```

### Workflow

1. **Before raid**: Click "Generate from Priority" - auto-fills based on current priority
2. **Customize**: Adjust any assignments as needed
3. **During raid**: Reference the plan to distribute loot
4. **After raid**: Click "Apply All" to log everything at once

### "Apply All" Logic

```typescript
async function applyLootPlan(plan: LootPlan) {
  for (const entry of plan.entries) {
    await logLootAndUpdateGear(groupId, tierId, {
      weekNumber: plan.weekNumber,
      floor: entry.floor,
      itemSlot: entry.slot,
      recipientPlayerId: entry.recipientPlayerId,
      method: 'drop',
    }, { updateGear: true });
  }
  await updatePlanStatus(plan.id, 'completed');
}
```

### API Endpoints

```
POST   /api/.../loot-plans                    Create plan
GET    /api/.../loot-plans?week=5             Get plan for week
PUT    /api/.../loot-plans/{id}               Update plan
DELETE /api/.../loot-plans/{id}               Delete plan
POST   /api/.../loot-plans/{id}/apply         Apply all entries
POST   /api/.../loot-plans/generate           Auto-generate from priority
```

### Files to Create/Modify

| File | Changes |
|------|---------|
| `backend/app/models/loot_plan.py` | NEW: LootPlan model |
| `backend/app/schemas/loot_plan.py` | NEW: Pydantic schemas |
| `backend/app/routers/loot_plans.py` | NEW: API endpoints |
| `frontend/src/types/index.ts` | Add LootPlan types |
| `frontend/src/stores/lootTrackingStore.ts` | Add plan state/actions |
| `frontend/src/components/loot/PlanDistributionTab.tsx` | NEW: Plan UI |
| `frontend/src/components/loot/LootPriorityPanel.tsx` | Add 4th tab |
| `frontend/src/utils/lootCoordination.ts` | Add `applyLootPlan()` |

---

## Phase 4: Alt Support (Future)

Deferred per OUTSTANDING_WORK.md. When implemented:

- Add `altBisSets` array to SnapshotPlayer
- Alt priority calculated with significant penalty (e.g., -500 base)
- UI to switch between main/alt view
- Split run optimization for 8+8 groups

---

## Decisions Made

- **MVP Scope**: Phase 1 only (priority flexibility)
- **Pre-plan Apply**: "Apply All" button when Phase 3 is implemented
- **Alt support**: Deferred to separate project
- **Disabled mode**: Just hide priority scores (no drop counter needed)
