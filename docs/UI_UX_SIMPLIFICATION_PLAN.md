# UI/UX Simplification Plan

## Problem Statement

The current GroupView page has significant information redundancy and visual clutter:

**Current State (from screenshot):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FFXIV RAID PLANNER / hardcore raiders   HARDCORE RAIDERS | AAC Light...  [▼]│  ← Header
├─────────────────────────────────────────────────────────────────────────────┤
│ HARDCORE RAIDERS [Owner] ⚙️                    [Tier ▼] [+New] [Roll] [+Add]│  ← GroupHeader + TierSelector
│ Code: HA9NVM (Public)                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ AAC LIGHT-HEAVYWEIGHT (SAVAGE) ()                        0/8 configured     │  ← Tier Info Banner
├─────────────────────────────────────────────────────────────────────────────┤
│ [Party] [Loot] [Stats]                              [Standard ▼] [G1/G2] [≡]│  ← Toolbar
├─────────────────────────────────────────────────────────────────────────────┤
│ [Player Cards...]                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Redundancy Issues:**
1. "HARDCORE RAIDERS" appears 3 times (breadcrumb, center, main heading)
2. "AAC Light-heavyweight" appears 3 times (header center, dropdown, banner)
3. 4 horizontal rows before content (Header → GroupHeader → Banner → Toolbar)

---

## Proposed Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FFXIV Raid Planner                                     [My Statics] [Avatar]│  ← Simplified Header
├─────────────────────────────────────────────────────────────────────────────┤
│ HARDCORE RAIDERS [Owner] ⚙️  HA9NVM              [M1S-M4S ▼] [+] [↻] [+Add]│  ← Unified Control Bar
├─────────────────────────────────────────────────────────────────────────────┤
│ [Party] [Loot] [Stats]                              [Standard ▼] [G1/G2] [≡]│  ← Toolbar (unchanged)
├─────────────────────────────────────────────────────────────────────────────┤
│ [Player Cards...]                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Changes:**
1. **Header** - Remove center display and breadcrumb; just logo + nav + user
2. **Unified Control Bar** - Merge GroupHeader and TierSelector into single row
3. **Remove Tier Banner** - Redundant with tier dropdown
4. **Result** - 3 rows instead of 4, no repeated information

---

## Detailed Changes

### 1. Header Component Simplification

**File:** `frontend/src/components/layout/Header.tsx`

**Remove:**
- Center display (`getCenterDisplay()`) - static name + tier shown elsewhere
- Breadcrumb (`getBreadcrumb()`) - redundant with main content

**Keep:**
- Logo (left)
- "My Statics" link when on group page (right)
- User menu (right)

**Before:**
```
[Logo] [/ static name]        [STATIC NAME | Tier]        [My Statics] [User]
```

**After:**
```
[Logo]                                                    [My Statics] [User]
```

### 2. Unified Control Bar (GroupHeader + TierSelector)

**File:** `frontend/src/pages/GroupView.tsx`

Merge the two-line GroupHeader with TierSelector into a single horizontal bar:

**Layout:**
```
Left side:                                              Right side:
[Group Name] [Role Badge] [⚙️] [Share Code]            [Tier ▼] [+New] [↻] [🗑️] [+Add]
```

**Changes:**
- Move share code inline (currently on second line)
- Remove "(Public)" text - settings modal shows this
- Make share code clickable to copy
- Tier controls stay on right

**Player count:** Show as small badge next to "+Add Player" button:
```
[+Add Player] (3/8)
```

### 3. Remove Tier Info Banner

**File:** `frontend/src/pages/GroupView.tsx` (lines 386-399)

Delete the tier info banner section entirely. Information is available in:
- Tier dropdown shows tier name
- Player count moves to "+Add" button area

### 4. Minor Toolbar Adjustments

Keep toolbar mostly unchanged, but consider:
- Tabs stay left
- Floor selector / view controls stay right
- No changes needed unless we want to consolidate further

---

## Implementation Steps

### Step 1: Simplify Header
**File:** `frontend/src/components/layout/Header.tsx`
- Remove `getCenterDisplay()` function and its usage
- Remove `getBreadcrumb()` function and its usage
- Keep logo, "My Statics" link, and user menu

### Step 2: Update GroupHeader Component
**File:** `frontend/src/components/static-group/GroupHeader.tsx`
- Add share code inline (same row as name)
- Make share code clickable to copy
- Remove "(Public/Private)" text
- Keep role badge and settings button

### Step 3: Update TierSelector Component
**File:** `frontend/src/components/static-group/TierSelector.tsx`
- Add player count badge near "+Add Player" button
- Accept `playerCount` and `totalSlots` props

### Step 4: Update GroupView Layout
**File:** `frontend/src/pages/GroupView.tsx`
- Remove tier info banner (lines 386-399)
- Pass player count to TierSelector
- Ensure single-row layout for header controls

---

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/components/layout/Header.tsx` | Remove center display and breadcrumb |
| `frontend/src/components/static-group/GroupHeader.tsx` | Inline share code, remove public/private text |
| `frontend/src/components/static-group/TierSelector.tsx` | Add player count badge |
| `frontend/src/pages/GroupView.tsx` | Remove tier banner, pass player count |

---

## Visual Comparison

**Before (4 info rows):**
```
Header:      [Logo / breadcrumb]     [Static | Tier]     [Nav] [User]
GroupHeader: [Static] [Owner] [⚙️]
             Code: XXXXX (Public)                        [Tier ▼] [+New]...
Tier Banner: [AAC LIGHT-HEAVYWEIGHT]                     0/8 configured
Toolbar:     [Party] [Loot] [Stats]                      [Sort] [G1/G2] [View]
```

**After (2 info rows):**
```
Header:      [Logo]                                      [My Statics] [User]
Controls:    [Static] [Owner] [⚙️] XXXXX                [Tier ▼] [+] [↻] [+Add (3/8)]
Toolbar:     [Party] [Loot] [Stats]                      [Sort] [G1/G2] [View]
```

---

## Benefits

1. **Less visual noise** - Static name appears once, tier appears once
2. **Faster scanning** - Important controls in predictable locations
3. **More content space** - One fewer row of chrome
4. **Clearer hierarchy** - Header = app nav, Controls = page context, Toolbar = view options

---

## Step 5: Update CLAUDE.md Documentation

**File:** `CLAUDE.md`

Update the project documentation to reflect the current state and UI/UX changes.

### Changes to Make:

#### 1. Fix "Phase 4 Endpoints (Coming)" Section (line ~738)
Replace with actual implemented endpoints:
```markdown
### Static Groups (Phase 4 - Implemented)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/static-groups` | List user's groups |
| POST | `/api/static-groups` | Create new group |
| GET | `/api/static-groups/by-code/{code}` | Get group by share code |
| PUT | `/api/static-groups/{id}` | Update group |
| DELETE | `/api/static-groups/{id}` | Delete group |

### Tier Snapshots (Phase 4 - Implemented)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/static-groups/{id}/tiers` | List tier snapshots |
| POST | `/api/static-groups/{id}/tiers` | Create tier snapshot |
| GET | `/api/static-groups/{id}/tiers/{tierId}` | Get tier with players |
| PUT | `/api/static-groups/{id}/tiers/{tierId}` | Update tier |
| DELETE | `/api/static-groups/{id}/tiers/{tierId}` | Delete tier |
| POST | `/api/static-groups/{id}/tiers/{tierId}/rollover` | Copy roster to new tier |

### Players (Phase 4 - Implemented)
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/static-groups/{id}/tiers/{tierId}/players/{playerId}` | Update player |
| POST | `/api/static-groups/{id}/tiers/{tierId}/players` | Add player |
| DELETE | `/api/static-groups/{id}/tiers/{tierId}/players/{playerId}` | Remove player |
```

#### 2. Add UI/UX Design Principles Section
Add after "What NOT To Do":
```markdown
## UI/UX Design Principles

### Information Hierarchy (GroupView)
```
Header:    [Logo]                                      [My Statics] [User]
Controls:  [Static] [Owner] [⚙️] XXXXX                [Tier ▼] [+] [↻] [+Add (3/8)]
Toolbar:   [Party] [Loot] [Stats]                      [Sort] [G1/G2] [View]
Content:   [Player Cards Grid]
```

**Key principles:**
- Header = app-level navigation only (logo, nav, user)
- Controls = page context (group name, tier, actions)
- Toolbar = view options (tabs, sort, display mode)
- No redundant information (each item appears once)
- Minimal vertical chrome (2 info rows, not 4)
```

#### 3. Update Component Architecture Section
Update `GroupHeader.tsx` description:
```markdown
- `GroupHeader.tsx` - Group name, role badge, settings button, inline share code (single row)
```

Update `TierSelector.tsx` description:
```markdown
- `TierSelector.tsx` - Tier dropdown, new/rollover/delete buttons, player count badge
```

#### 4. Update "What NOT To Do" Section
Add new item:
```markdown
8. **Don't repeat information** - Static name and tier should appear only once in the UI
```

---

## Summary: All Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/components/layout/Header.tsx` | Remove center display and breadcrumb |
| `frontend/src/components/static-group/GroupHeader.tsx` | Inline share code, remove public/private text |
| `frontend/src/components/static-group/TierSelector.tsx` | Add player count badge |
| `frontend/src/pages/GroupView.tsx` | Remove tier banner, pass player count |
| `CLAUDE.md` | Update API docs, add UI principles, fix outdated sections |
