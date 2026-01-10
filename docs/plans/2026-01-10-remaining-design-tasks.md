# Remaining Design System Tasks - Implementation Plan

**Created:** 2026-01-10
**Branch:** `feature/design-system-migration`
**Reference:** Original plan at `docs/plans/2026-01-10-design-system-ux-improvements.md`

---

## Audit Summary

### Completed Tasks
- ✅ **3.2** Job icons in recipient dropdowns - Done (`AddLootEntryModal.tsx:332`)
- ✅ **3.3** Edit entry recipient pre-population - Fixed (`useState` initializer at line 77-87)

### Outstanding Tasks (6 remaining)
| Task | Description | Complexity | Priority |
|------|-------------|------------|----------|
| 2.3 | BiS source dropdown in GearTable | Medium | High |
| 2.4 | Item name column in GearTable | Low | Medium |
| 2.5 | CurrentSource column in GearTable | Medium | Low |
| 2.6 | Materia in gear tooltip | High | Low |
| 3.5 | Gear slot icons in Who Needs It | Low | Medium |
| 4.1 | Hotkeys in tooltips | Low | High |

---

## Task Details

### 2.3 BiS Source Dropdown in GearTable

**Current State:** Two side-by-side buttons ("Raid" / "Tome") at `GearTable.tsx:423-447`

**Goal:** Convert to compact dropdown/select for better space usage

**Files to modify:**
- `frontend/src/components/player/GearTable.tsx` (lines 421-447)

**Implementation:**
```tsx
// Replace button pair with inline select
<Select
  value={status.bisSource}
  onChange={(value) => handleSourceChange(slot, value as 'raid' | 'tome')}
  options={[
    { value: 'raid', label: 'Raid' },
    { value: 'tome', label: 'Tome' },
  ]}
  size="sm"
  disabled={!gearPermission.allowed}
/>
```

**Color coding:**
- Raid selected: `text-gear-raid` (green)
- Tome selected: `text-gear-tome` (teal)

**Considerations:**
- Existing `Select` component supports small size
- May need custom styling to match the compact toggle look
- Alternative: Use Radix `ToggleGroup` for semantic toggle behavior

---

### 2.4 Item Name Column in GearTable

**Current State:** `itemName` exists in `GearSlotStatus` but only shown in tooltips

**Goal:** Add visible "Item" column between Slot and BiS Source

**Files to modify:**
- `frontend/src/components/player/GearTable.tsx`

**Implementation:**
1. Add new `<th>` for "Item" column header
2. Add new `<td>` showing `status.itemName` with truncation
3. Use `text-text-secondary` for item names
4. Add `title` attribute for full name tooltip on truncated text

**Responsive behavior:**
```tsx
// Header
<th className="hidden md:table-cell">Item</th>

// Cell
<td className="hidden md:table-cell py-1 px-2">
  <span
    className="text-xs text-text-secondary truncate max-w-[120px] block"
    title={status.itemName}
  >
    {status.itemName || '—'}
  </span>
</td>
```

---

### 2.5 CurrentSource Column in GearTable

**Current State:** `currentSource` field exists in `GearSlotStatus` type but not displayed

**Goal:** Show what gear player currently has equipped (responsive, large screens only)

**Files to modify:**
- `frontend/src/components/player/GearTable.tsx`

**Implementation:**
1. Add "Current" column header (hidden on small screens)
2. Display `currentSource` category as styled badge
3. Use appropriate category colors

**Category styling map:**
```typescript
const CURRENT_SOURCE_STYLES: Record<GearSourceCategory, { bg: string; text: string; label: string }> = {
  savage: { bg: 'bg-gear-raid/20', text: 'text-gear-raid', label: 'Savage' },
  tome_up: { bg: 'bg-accent/20', text: 'text-accent', label: 'Aug Tome' },
  tome: { bg: 'bg-gear-tome/20', text: 'text-gear-tome', label: 'Tome' },
  catchup: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Catchup' },
  relic: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Relic' },
  crafted: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Crafted' },
  prep: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'Prep' },
  normal: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'Normal' },
  unknown: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: '?' },
};
```

**Responsive behavior:**
```tsx
// Only show on lg+ breakpoints
<th className="hidden lg:table-cell">Current</th>
<td className="hidden lg:table-cell">...</td>
```

---

### 2.6 Materia in Gear Tooltip

**Current State:**
- `GearSlotStatus` has NO materia field
- `ItemHoverCard` shows stats but no materia
- BiS preset cache (`local_bis_presets.json`) does not include materia

**Goal:** Display melded materia in gear tooltips

**This is a LARGER task requiring:**

1. **Type Updates** (`frontend/src/types/index.ts`):
```typescript
interface MateriaSlot {
  stat: string;      // e.g., "Critical Hit"
  value: number;     // e.g., 54
  grade?: string;    // e.g., "XII"
}

interface GearSlotStatus {
  // ... existing fields ...
  materia?: MateriaSlot[];
}
```

2. **Backend/Import Changes:**
   - Update XIVGear import to extract materia data
   - Update Etro import to extract materia data
   - Update BiS preset schema if caching materia
   - Run `python scripts/backfill_gcd.py` to regenerate cache

3. **ItemHoverCard Updates** (`frontend/src/components/ui/ItemHoverCard.tsx`):
```tsx
interface ItemHoverCardProps {
  // ... existing ...
  materia?: MateriaSlot[];
}

// In render:
{materia && materia.length > 0 && (
  <>
    <div className="border-t border-border-default my-2" />
    <div className="text-xs text-text-muted mb-1">Materia</div>
    <div className="flex flex-wrap gap-1">
      {materia.map((m, i) => (
        <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-surface-elevated text-text-secondary">
          {STAT_ABBREV[m.stat] || m.stat} +{m.value}
        </span>
      ))}
    </div>
  </>
)}
```

**RECOMMENDATION:** Defer this task to a separate PR. It requires:
- Backend changes to import/store materia
- Cache regeneration
- More extensive testing

---

### 3.5 Gear Slot Icons in Who Needs It Table

**Current State:** Slot column shows text only ("Weapon", "Head", etc.)

**Goal:** Add gear slot icons next to slot names

**Files to modify:**
- `frontend/src/components/loot/WhoNeedsItMatrix.tsx` (around line 169-172)

**Option A: Use existing XIVAPI slot icons (if available)**
Check if generic slot icons exist in `/public/icons/` or can be fetched

**Option B: Use Lucide icons as fallback**
```typescript
const SLOT_ICONS: Record<GearSlot, LucideIcon> = {
  weapon: Swords,
  head: Crown,        // or custom icon
  body: Shirt,
  hands: Hand,
  legs: Footprints,   // legs approximation
  feet: Footprints,
  earring: Gem,
  necklace: Gem,
  bracelet: Circle,
  ring1: Circle,
  ring2: Circle,
};
```

**Implementation:**
```tsx
// In slot cell render
<td className="...">
  <div className="flex items-center gap-1.5">
    <SlotIcon slot={slot} className="w-4 h-4 text-text-muted" />
    <span>{GEAR_SLOT_NAMES[slot]}</span>
  </div>
</td>
```

**RECOMMENDATION:** Use simple Lucide icons for now. Custom gear icons can be added later if desired.

---

### 4.1 Hotkeys in Tooltips

**Current State:** No keyboard shortcuts shown in tooltips

**Goal:** Show hotkey hints in relevant tooltips

**Files to modify:**
- `frontend/src/pages/GroupView.tsx` - Tab buttons, view toggles
- Create utility function for consistent formatting

**Implementation:**

1. **Create helper function:**
```typescript
// utils/tooltipHelpers.ts
export function withHotkey(text: string, hotkey?: string): string {
  return hotkey ? `${text} (${hotkey})` : text;
}
```

2. **Update tab navigation tooltips:**
```tsx
// GroupView.tsx - Tab definitions
const tabs = [
  { id: 'players', label: 'Players', tooltip: withHotkey('Manage roster', '1') },
  { id: 'loot', label: 'Loot', tooltip: withHotkey('Loot priorities', '2') },
  { id: 'log', label: 'Log', tooltip: withHotkey('Loot history', '3') },
  { id: 'summary', label: 'Summary', tooltip: withHotkey('Team overview', '4') },
];
```

3. **Update view toggle tooltips:**
```tsx
// Compact/expanded toggle
title={withHotkey(isCompact ? 'Expanded view' : 'Compact view', 'V')}

// G1/G2 toggle
title={withHotkey(showGroups ? 'Hide groups' : 'Show G1/G2', 'G')}

// Subs toggle
title={withHotkey(showSubs ? 'Hide subs' : 'Show subs', 'S')}
```

**Key mappings (from existing keyboard shortcuts):**
- `1-4`: Tab navigation
- `V`: Toggle compact/expanded view
- `G`: Toggle G1/G2 groups
- `?`: Show keyboard help

---

## Implementation Order

**Recommended order (quick wins first):**

### Phase 1: Quick Wins (Low complexity)
1. **4.1** Hotkeys in tooltips (~15 min)
2. **3.5** Gear slot icons in Who Needs It (~30 min)
3. **2.4** Item name column in GearTable (~30 min)

### Phase 2: Medium Tasks
4. **2.3** BiS source dropdown (~45 min)
5. **2.5** CurrentSource column (~45 min)

### Phase 3: Deferred
6. **2.6** Materia in tooltip - **Defer to separate PR**
   - Requires backend changes
   - Cache regeneration needed
   - More extensive testing

---

## Testing Checklist

For each task:
- [ ] Manual testing in development
- [ ] Responsive breakpoint testing (sm, md, lg, xl)
- [ ] Verify no TypeScript errors (`pnpm tsc --noEmit`)
- [ ] Run test suite (`pnpm test`)
- [ ] Check design system compliance (`./frontend/scripts/check-design-system.sh`)

---

## Files Reference

| File | Purpose |
|------|---------|
| `components/player/GearTable.tsx` | Tasks 2.3, 2.4, 2.5 |
| `components/ui/ItemHoverCard.tsx` | Task 2.6 |
| `components/loot/WhoNeedsItMatrix.tsx` | Task 3.5 |
| `pages/GroupView.tsx` | Task 4.1 |
| `types/index.ts` | Type updates for 2.5, 2.6 |
