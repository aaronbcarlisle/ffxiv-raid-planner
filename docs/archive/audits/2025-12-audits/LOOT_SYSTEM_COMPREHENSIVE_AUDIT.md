# FFXIV Raid Planner - Loot System Comprehensive Audit

**Date:** January 1, 2026  
**Auditor:** Claude  
**Project:** ffxiv-raid-planner-dev-loot-priority-updates-and-polish

---

## Executive Summary

The loot management system has made significant progress with foundational coordination utilities in place, but critical integration gaps remain. The system has the right building blocks (`lootCoordination.ts`, `useLootActions` hook, `QuickLogDropModal`) but they aren't consistently used throughout the application, leading to state fragmentation where logging loot in one area doesn't update related data in other areas.

### Key Findings

| Severity | Issue | Status |
|----------|-------|--------|
| 🔴 Critical | `useLootActions` hook has bug using `id` instead of `tierId` | Needs Fix |
| 🟠 High | Tab structure confusion (Loot vs History) | Redesign Recommended |
| 🟠 High | QuickLogDropModal broken due to hook bug | Blocked by hook fix |
| 🟡 Medium | Enhanced priority algorithm exists but not displayed | Enhancement |
| 🟡 Medium | Weapon priority collapsible but not prominent | Enhancement |
| 🟢 Good | LootLogPanel uses coordination utilities correctly | Working ✅ |
| 🟢 Low | Missing loot history integration in priority displays | Enhancement |

---

## Part 1: What's Working Well ✅

### 1.1 Coordination Utilities Exist
The foundation is solid with these key utilities in place:

**`utils/lootCoordination.ts`** - Provides:
- `logLootAndUpdateGear()` - Coordinates loot log + gear update + weapon priority
- `deleteLootAndRevertGear()` - Reverses the above
- `getPrioritySuggestionsForSlot()` - Gets top 3 priority players
- `calculatePlayerLootStats()` - Drought/balance calculations
- `calculateEnhancedPriorityScore()` - Advanced priority with loot history

**`hooks/useLootActions.ts`** - Provides React hook interface:
- `logLoot()` - Coordinated logging
- `deleteLoot()` - Coordinated deletion
- `getPrioritySuggestions()` - For UI display
- `getEnhancedPriority()` - Enhanced scoring

### 1.2 Quick Log Modal Implementation
`components/loot/QuickLogDropModal.tsx` is well-designed:
- Pre-selects top priority player
- Shows preview of what will happen
- Has "update gear" checkbox
- Uses `useLootActions` hook

### 1.3 Priority Suggestions in Add Modal
`components/history/AddLootEntryModal.tsx` shows priority context:
- Calculates suggestions based on slot
- Clickable to select player
- Shows priority score

### 1.4 Weapon Priority System
Complete implementation:
- Per-player weapon priority lists
- Job-based weapon queues
- Main job bonus calculation
- Lock/unlock functionality

---

## Part 2: Critical Issues 🔴

### 2.1 useLootActions Hook Bug (CRITICAL - Most Urgent)

**UPDATE:** After deeper review, `LootLogPanel.tsx` is actually using the coordination utilities correctly by importing `logLootAndUpdateGear` directly. The critical bug is specifically in the `useLootActions` hook, which is used by `QuickLogDropModal`.

**Location:** `hooks/useLootActions.ts` line 53

**Problem:** Uses wrong tier ID field

```typescript
// Current (BROKEN)
const tierId = currentTier?.id;  // ← Uses database UUID

// Should be
const tierId = currentTier?.tierId;  // ← Uses tier identifier like "m5s-m8s"
```

**Evidence:** 
- `TierSnapshot` interface has both `id` (database UUID) and `tierId` (tier identifier)
- Backend API routes use `tier_id` parameter expecting "m5s-m8s" format (see `loot_tracking.py` line 52: `TierSnapshot.tier_id == tier_id`)
- Hook passes database UUID but API expects tier identifier

**Impact:**
- `QuickLogDropModal` (which uses `useLootActions`) fails silently
- Users logging from Loot tab inline buttons get 404 errors
- Falls back to History tab which works (uses direct import)

**Fix:**
```typescript
// hooks/useLootActions.ts line 53
- const tierId = currentTier?.id;
+ const tierId = currentTier?.tierId;
```

### 2.2 LootLogPanel Working Correctly (REVISED) ✅

**Good News:** After reviewing the code, `LootLogPanel.tsx` IS using coordinated actions:

```typescript
// LootLogPanel.tsx - CORRECT implementation
import { logLootAndUpdateGear, deleteLootAndRevertGear } from '../../utils/lootCoordination';

// onSubmit handler
await logLootAndUpdateGear(groupId, tierId, entry, { updateGear });
await fetchLootLog(groupId, tierId, currentWeek);

// Delete handler  
await deleteLootAndRevertGear(groupId, tierId, entry.id, entry, { revertGear });
```

The History tab correctly:
- Updates gear checkbox on loot logging
- Reverts gear checkbox on delete
- Refreshes loot log after changes

**Status:** ✅ Working correctly (uses direct import, bypasses buggy hook)

---

## Part 3: UX/Architecture Issues 🟠

### 3.1 Confusing Tab Structure

**Current Tabs:**
1. **Roster** - Player cards, gear tracking ✅
2. **Loot** - Priority lists (READ-ONLY display) 
3. **Progress** - Team summary stats
4. **History** - Loot log, book balances (WHERE YOU LOG)

**Problem:** Users go to "Loot" tab expecting to log loot, but it's display-only. Actual logging is hidden in "History" tab.

**Recommended Restructure:**

| Tab | Purpose | Content |
|-----|---------|---------|
| **Roster** | Player management | Player cards, inline editing |
| **Loot Session** | Active loot distribution | Floor selector + priority lists + inline [Log Drop] buttons + book balances + weapon priority |
| **History** | Past loot review | Week-by-week read-only log for corrections/auditing |
| **Progress** | Team metrics | Completion stats, material needs |

### 3.2 Missing Inline Log Actions

**Current Flow:**
1. User sees priority list in Loot tab
2. Click somewhere (unclear where)
3. Must navigate to History tab
4. Open modal
5. Re-select floor, slot, player

**Recommended Flow:**
1. User sees priority list in Loot tab
2. Hover over #1 priority player → [Log Drop] button appears
3. Click → Streamlined QuickLogDropModal opens
4. One-click confirm

The infrastructure exists (`QuickLogDropModal`, `onLogDrop` prop) but `showLogButtons={false}` is the default:

```tsx
// GroupView.tsx line 696
<LootPriorityPanel
  players={configuredPlayers}
  settings={DEFAULT_SETTINGS}
  selectedFloor={selectedFloor}
  floorName={tierInfo.floors[selectedFloor - 1]}
  // Missing: showLogButtons={true}
/>
```

**Fix:** Enable inline buttons:
```tsx
<LootPriorityPanel
  ...
  showLogButtons={canEdit}  // Show for owners/leads
/>
```

### 3.3 Weapon Priority Visibility

**Current:** Collapsed section at bottom of Loot tab, only auto-expanded for Floor 4.

**Problems:**
- Easy to miss
- Users want to see weapon queue regardless of which floor they're on
- No quick way to mark received without full modal

**Recommendations:**
1. Always show weapon priority section expanded (or as dedicated sub-tab)
2. Add inline "Mark Received" checkbox/button
3. Show lock status prominently with icon

---

## Part 4: Enhancement Opportunities 🟡

### 4.1 Enhanced Priority Not Displayed

The `calculateEnhancedPriorityScore()` function exists but isn't used in displays:

```typescript
// Available in lootCoordination.ts
export function calculateEnhancedPriorityScore(
  baseScore: number,
  playerStats: PlayerLootStats,
  averageDrops: number
): number {
  const droughtBonus = Math.min(playerStats.weeksSinceLastDrop * 10, 50);
  const balancePenalty = excessDrops > 0 ? Math.min(excessDrops * 15, 45) : 0;
  return Math.round(baseScore + droughtBonus - balancePenalty);
}
```

**Recommendation:** Show enhanced scores in priority lists with breakdown tooltip:
```
Player Name  [Score: 185]
            Base: 150 | Drought: +40 | Balance: -5
```

### 4.2 Delete Permission Too Restrictive

**Current:** Only owners can delete loot entries (line 205 of `loot_tracking.py`)

```python
await require_owner(db, current_user.id, group_id)  # Owner only
```

**Recommendation:** Allow leads to delete as well (they can create entries):

```python
await require_can_edit_roster(db, current_user.id, group_id)  # Lead or owner
```

### 4.3 Missing Delete Confirmation

When deleting loot entries, should warn if it will revert gear:
- "This will uncheck [Weapon] on [Player]'s gear. Continue?"

---

## Part 5: Code Quality Issues

### 5.1 Duplicate Default Settings

`DEFAULT_SETTINGS` is defined in multiple files:
- `GroupView.tsx`
- `HistoryView.tsx`
- `useLootActions.ts` (partial)

**Recommendation:** Create single source of truth:

```typescript
// utils/constants.ts
export const DEFAULT_STATIC_SETTINGS: StaticSettings = {
  displayOrder: ['tank', 'healer', 'melee', 'ranged', 'caster'],
  lootPriority: ['melee', 'ranged', 'caster', 'tank', 'healer'],
  sortPreset: 'standard',
  groupView: false,
  timezone: 'UTC',
  autoSync: false,
  syncFrequency: 'weekly',
};
```

### 5.2 Missing Error Handling in Coordination

`logLootAndUpdateGear()` doesn't handle partial failures well:

```typescript
// Current - if gear update fails, loot entry still exists
await lootStore.createLootEntry(groupId, tierId, lootData);  // Success
await tierStore.updatePlayer(...);  // Fails - loot entry orphaned
```

**Recommendation:** Add transaction-like behavior or clear error messaging.

### 5.3 Inconsistent Store Usage

Some components use stores directly, others use hooks:
- `QuickLogDropModal` ✅ Uses `useLootActions`
- `LootLogPanel` ❌ Uses `useLootTrackingStore` directly
- `AddLootEntryModal` ❌ Receives callback, doesn't coordinate

---

## Part 6: Implementation Roadmap

### Phase 1: Critical Fixes (30 minutes)

#### 1.1 Fix useLootActions Hook (CRITICAL - 5 minutes)
```typescript
// hooks/useLootActions.ts line 53
- const tierId = currentTier?.id;
+ const tierId = currentTier?.tierId;
```

This single-line fix enables:
- QuickLogDropModal to work
- Inline [Log] buttons in Loot tab
- Future components using the hook

#### 1.2 Enable Inline Log Buttons (5 minutes)
```tsx
// pages/GroupView.tsx line 696
<LootPriorityPanel
  players={configuredPlayers}
  settings={DEFAULT_SETTINGS}
  selectedFloor={selectedFloor}
  floorName={tierInfo.floors[selectedFloor - 1]}
  showLogButtons={canEdit}  // Add this line
/>
```

#### 1.3 Verify Integration (20 minutes)
- Test logging via Loot tab inline button → gear updates
- Test logging via History tab → gear updates
- Test delete → gear reverts

### Phase 2: UX Improvements (2-3 hours)

#### 2.1 Consolidate Loot + History into "Loot Session"

```tsx
// New component: components/loot/LootSessionView.tsx
export function LootSessionView({
  groupId, tierId, players, floors, settings, canEdit
}) {
  const [selectedFloor, setSelectedFloor] = useState(1);
  
  return (
    <div className="space-y-6">
      {/* Floor selector */}
      <FloorSelector ... />
      
      {/* Priority panels with inline actions */}
      <LootPriorityPanel ... showLogButtons={canEdit} />
      
      {/* Always-visible weapon priority */}
      <WeaponPrioritySection players={players} settings={settings} />
      
      {/* Book balances */}
      <PageBalancesPanel ... />
      
      {/* Recent loot log for this floor */}
      <RecentLootLog floor={floors[selectedFloor - 1]} />
    </div>
  );
}
```

#### 2.2 Make Weapon Priority Always Visible

```tsx
// components/loot/LootPriorityPanel.tsx
// Remove the collapsible behavior, always show:

<div className="border-t border-border-default pt-4 mt-4">
  <h4 className="text-text-secondary text-sm mb-3 flex items-center gap-2">
    <span>Weapon Priority</span>
    {selectedFloor === 4 && (
      <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
        Drops this floor
      </span>
    )}
  </h4>
  <WeaponPriorityList players={players} settings={settings} />
</div>
```

### Phase 3: Enhanced Priority Display (2-3 hours)

#### 3.1 Add Enhanced Scores to Priority Lists

```tsx
// components/loot/PriorityList.tsx (new component)
interface PriorityListProps {
  entries: PriorityEntry[];
  showEnhanced?: boolean;
  lootLog?: LootLogEntry[];
  currentWeek?: number;
}

function PriorityList({ entries, showEnhanced, lootLog, currentWeek }) {
  const getEnhancedScore = (entry: PriorityEntry) => {
    if (!showEnhanced || !lootLog || !currentWeek) return entry.score;
    
    const stats = calculatePlayerLootStats(entry.player.id, lootLog, currentWeek);
    const avgDrops = calculateAverageDrops(entries.map(e => e.player.id), lootLog);
    return calculateEnhancedPriorityScore(entry.score, stats, avgDrops);
  };
  
  return (
    <div className="space-y-1">
      {entries.map((entry, index) => (
        <div key={entry.player.id} className="...">
          <span>{entry.player.name}</span>
          <div className="flex items-center gap-1">
            <span className="text-xs">{getEnhancedScore(entry)}</span>
            {showEnhanced && (
              <Tooltip content={
                `Base: ${entry.score}\n` +
                `Drought: +${stats.droughtBonus}\n` +
                `Balance: ${stats.balancePenalty}`
              }>
                <InfoIcon size={12} />
              </Tooltip>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Phase 4: Backend Enhancements (Optional, 1-2 hours)

#### 4.1 Return Updated Player from Loot Log Create

Modify backend to optionally update player gear and return the updated player:

```python
# routers/loot_tracking.py
@router.post("/{group_id}/tiers/{tier_id}/loot-log")
async def create_loot_log_entry(
    ...,
    update_gear: bool = False,  # New query param
):
    # ... create entry ...
    
    if update_gear and data.method == 'drop':
        # Update player's gear
        player = await update_player_gear(db, data.recipient_player_id, data.item_slot)
        return LootLogEntryWithPlayerResponse(
            entry=entry_response,
            updated_player=player_response
        )
    
    return entry_response
```

This eliminates the need for frontend to make two API calls.

---

## Part 7: File Change Summary

### Files to Modify (Immediate Fixes)

| File | Change | Priority |
|------|--------|----------|
| `hooks/useLootActions.ts` | Fix tierId bug (line 53: `id` → `tierId`) | 🔴 Critical |
| `pages/GroupView.tsx` | Enable `showLogButtons={canEdit}` on LootPriorityPanel | 🟠 High |

### Files Working Correctly (No Changes Needed)

| File | Status |
|------|--------|
| `components/history/LootLogPanel.tsx` | ✅ Uses coordination utilities correctly |
| `utils/lootCoordination.ts` | ✅ Well-designed coordination layer |
| `components/loot/QuickLogDropModal.tsx` | ✅ Well-designed (blocked by hook bug) |

### Files to Modify (UX Enhancements)

| File | Change |
|------|--------|
| `components/loot/LootPriorityPanel.tsx` | Always show weapon priority (remove collapsible) |
| `utils/constants.ts` | Add DEFAULT_STATIC_SETTINGS |

### Files to Create (Optional)

| File | Purpose |
|------|---------|
| `components/loot/LootSessionView.tsx` | Unified loot session tab |
| `components/loot/EnhancedPriorityList.tsx` | Priority list with loot history |
| `components/loot/WeaponPrioritySection.tsx` | Standalone weapon priority component |

---

## Part 8: Testing Checklist

### Critical Path Tests

- [ ] **Log drop via History tab → verify gear checkbox updates**
- [ ] **Delete drop → verify gear checkbox reverts**
- [ ] **Log weapon drop → verify weapon priority marks received**
- [ ] **Log via Loot tab inline button → verify all updates occur**

### Regression Tests

- [ ] Book balances update on floor cleared
- [ ] Priority scores calculate correctly
- [ ] Weapon priority lock/unlock works
- [ ] Week selector navigates correctly
- [ ] Delete requires owner permission
- [ ] Non-owners can't see Log Drop buttons

### Edge Cases

- [ ] Log ring drop → correct ring slot updates
- [ ] Log weapon for alt job → main job priority unchanged
- [ ] Delete last loot entry for a player → drought bonus recalculates
- [ ] Log multiple drops same session → all gear updates

---

## Appendix A: Current File Locations

```
frontend/src/
├── stores/
│   ├── lootTrackingStore.ts    # Loot log, page ledger state
│   └── tierStore.ts            # Player/tier state, weapon priorities
├── utils/
│   ├── priority.ts             # Base priority calculations
│   ├── weaponPriority.ts       # Weapon queue calculations
│   └── lootCoordination.ts     # Cross-store coordination
├── hooks/
│   └── useLootActions.ts       # React hook for coordinated actions
├── components/
│   ├── loot/
│   │   ├── LootPriorityPanel.tsx
│   │   ├── FloorSelector.tsx
│   │   ├── WeaponPriorityList.tsx
│   │   └── QuickLogDropModal.tsx
│   └── history/
│       ├── HistoryView.tsx
│       ├── LootLogPanel.tsx
│       ├── AddLootEntryModal.tsx
│       ├── PageBalancesPanel.tsx
│       └── WeekSelector.tsx
└── pages/
    └── GroupView.tsx           # Main page with tabs

backend/app/
├── routers/
│   └── loot_tracking.py        # API endpoints
├── models/
│   ├── loot_log_entry.py
│   └── page_ledger_entry.py
└── schemas/
    └── loot_tracking.py        # Request/response schemas
```

---

## Appendix B: UX Mockups

### Mockup 1: Unified Loot Session View

```
┌─────────────────────────────────────────────────────────────────┐
│  [Roster]  [Loot Session]  [Progress]  [History]     [M6S ▾]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  M6S Loot Priority                                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Head                     │  Hands                          ││
│  │  ┌─────────────────────┐  │  ┌─────────────────────┐        ││
│  │  │ 1. Test5 [Log] 245  │  │  │ 1. Test3 [Log] 230  │        ││
│  │  │ 2. Test6       220  │  │  │ 2. Test7       210  │        ││
│  │  │ 3. Test8       185  │  │  │ +2 more             │        ││
│  │  └─────────────────────┘  │  └─────────────────────┘        ││
│  │                            │                                 ││
│  │  Feet                      │  Glaze                         ││
│  │  ┌─────────────────────┐  │  ┌─────────────────────┐        ││
│  │  │ ✓ No one needs      │  │  │ 1. Test2       200  │        ││
│  │  └─────────────────────┘  │  │ 2. Test4       180  │        ││
│  │                            │  └─────────────────────┘        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Weapon Priority                                                │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐         │
│  │ 🗡️ Warrior    │ │ 🛡️ Paladin    │ │ ⚔️ Dark Knight│         │
│  │ 1. Test2 Main │ │ 1. Test5      │ │ 1. Test5      │         │
│  │ 2. Test5      │ │    [Received] │ │               │         │
│  └───────────────┘ └───────────────┘ └───────────────┘         │
│                                                                 │
│  Book Balances                           [Mark Floor Cleared]   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Player  │ Book I │ Book II │ Book III │ Book IV             ││
│  │ Test    │   5    │    5    │    0     │    2                ││
│  │ Test2   │   5    │    5    │    0     │    2                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Mockup 2: Quick Log Flow

```
User hovers over priority entry:
┌───────────────────────────────────┐
│ 1. Test5  [Log ▾]  Score: 245     │  ← Button appears on hover
└───────────────────────────────────┘

Click → Modal opens:
┌─────────────────────────────────────────┐
│  Log Head Drop                      ✕   │
├─────────────────────────────────────────┤
│                                         │
│  Recipient: Test5 (DRG) ✓               │
│  Floor: M6S                             │
│  Method: ● Drop ○ Book ○ Tome           │
│                                         │
│  ✓ Also mark gear as acquired           │
│                                         │
│  This will:                             │
│  ✓ Add Head to Week 3 loot log          │
│  ✓ Mark Head as acquired on Test5       │
│                                         │
│         [Cancel]  [Log Drop]            │
└─────────────────────────────────────────┘
```

---

## Conclusion

The loot system is in better shape than initially assessed. The core coordination utilities (`lootCoordination.ts`) are well-designed and `LootLogPanel` uses them correctly. The primary blocker is a single-line bug in the `useLootActions` hook that prevents the inline logging feature from working.

### Immediate Action (5 minutes):
1. **Fix the `tierId` bug** in useLootActions hook (line 53: change `id` to `tierId`)

### Quick Win (5 minutes):
2. **Enable inline Log buttons** by adding `showLogButtons={canEdit}` to LootPriorityPanel

### After fixes:
- Logging from Loot tab inline buttons → works
- Logging from History tab → works (already working)
- Gear updates propagate automatically
- Weapon priority updates on weapon drops

**Estimated Total Effort:**
- Critical fix: 5 minutes
- Enable inline buttons: 5 minutes
- Testing: 20 minutes
- UX improvements (optional): 3-4 hours
- Full tab restructure (optional): 8-12 hours
