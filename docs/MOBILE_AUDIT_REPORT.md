# FFXIV Raid Planner - Mobile UX Audit Report

**Audit Date:** 2026-01-24
**Auditor:** Mobile UX Specialist Agent
**Scope:** Complete frontend codebase (`frontend/src/`)
**Test Viewports:** 375px (iPhone SE), 390px (iPhone 14), 768px (iPad)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Existing Mobile Infrastructure](#existing-mobile-infrastructure)
3. [Critical Issues (P0)](#critical-issues-p0)
4. [Major Issues (P1)](#major-issues-p1)
5. [Minor Issues (P2)](#minor-issues-p2)
6. [Optimization Opportunities](#optimization-opportunities)
7. [Component-by-Component Findings](#component-by-component-findings)
8. [Implementation Plan](#implementation-plan)

---

## Executive Summary

The FFXIV Raid Planner has **foundational mobile infrastructure already in place**, including:
- `useDevice` hook for capability detection
- `MobileBottomNav` component for bottom navigation
- Safe area CSS utilities (`pb-safe`, `pt-safe`)
- PWA manifest with proper meta tags
- Many responsive breakpoints already applied

However, the audit identified **23 issues** across priority levels:
- **P0 (Critical):** 6 issues that break functionality on mobile
- **P1 (Major):** 9 issues causing significant UX problems
- **P2 (Minor):** 8 polish items

**Key Finding:** Most critical issues stem from:
1. Complex data grids/tables not adapting to narrow viewports
2. Touch targets too small for reliable interaction
3. Context menus relying on right-click (unavailable on touch)
4. Horizontal overflow in specific components

---

## Existing Mobile Infrastructure

### Already Implemented (Good Foundation)

| Feature | File | Status |
|---------|------|--------|
| Device detection hook | `hooks/useDevice.ts` | Complete |
| Touch-safe tooltips | `primitives/Tooltip.tsx` | Complete - disables on touch devices |
| Mobile bottom nav | `ui/MobileBottomNav.tsx` | Complete |
| Safe area utilities | `index.css` | Complete (`.pb-safe`, `.pt-safe`) |
| PWA manifest | `public/manifest.json` | Complete |
| Dynamic viewport height | `index.css` | Complete (`100dvh`) |
| Bottom nav content offset | `index.css` | Complete (`.has-bottom-nav`) |
| Modal sheet variant | `ui/Modal.tsx` | Partial - needs full implementation |

### Infrastructure Gaps

1. **Modal variant prop not fully implemented** - The Modal component has conditional sizing but lacks the `variant: 'dialog' | 'sheet'` prop mentioned in the implementation plan
2. **Bottom nav integration incomplete** - `MobileBottomNav` exists but needs wiring into `GroupView.tsx`
3. **No mobile-specific controls sheet** - Desktop controls cluster needs consolidation on mobile

---

## Critical Issues (P0)

### P0-1: WeaponPriorityGrid Horizontal Overflow

**File:** `components/weapon-priority/WeaponPriorityGrid.tsx`
**Lines:** 373-377

**Problem:** The 2-column grid layout causes the right column to be cut off on screens narrower than 640px. Players cannot see or interact with priority items in the second column.

**Current Code:**
```typescript
const gridColsClass = columns.length <= 1
  ? 'grid-cols-1'
  : columns.length === 2
  ? 'grid-cols-2'
  : 'grid-cols-2 lg:grid-cols-3';
```

**Fix:**
```typescript
const gridColsClass = columns.length <= 1
  ? 'grid-cols-1'
  : columns.length === 2
  ? 'grid-cols-1 sm:grid-cols-2'  // Single col on mobile
  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
```

**Impact:** Users cannot manage weapon priorities on mobile - core functionality broken.

---

### P0-2: LootPriorityPanel Name/Score Overlap

**File:** `components/loot/LootPriorityPanel.tsx`
**Lines:** 118-157

**Problem:** Long player names (e.g., "Alexander") overlap with priority score badges on narrow screens, rendering "Alexande210" as unreadable text. The flex container doesn't properly truncate names.

**Current Code:**
```typescript
<div className="flex items-center gap-1.5">
  <span className={`${isFirst ? 'text-accent font-medium' : 'text-text-secondary'}`}>
    {index + 1}.
  </span>
  <JobIcon job={entry.player.job} size="xs" />
  <span className={`${isFirst ? 'text-accent font-medium' : 'text-text-secondary'}`}>
    {entry.player.name}
  </span>
</div>
```

**Fix:**
```typescript
<div className="flex items-center justify-between px-2 py-1 rounded text-sm min-w-0">
  {/* Left side - player info with truncation */}
  <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
    <span className="flex-shrink-0">{index + 1}.</span>
    <span className="flex-shrink-0"><JobIcon job={entry.player.job} size="xs" /></span>
    <span className="truncate">{entry.player.name}</span>
  </div>
  {/* Right side - score (never shrinks) */}
  <div className="flex-shrink-0">{/* score badge */}</div>
</div>
```

**Impact:** Priority lists unreadable on mobile - users cannot determine loot distribution.

---

### P0-3: WhoNeedsItMatrix Table Overflow

**File:** `components/loot/WhoNeedsItMatrix.tsx`
**Lines:** 180-320

**Problem:** The matrix table has 8 player columns plus slot column (9 total). On a 375px screen, each column would be ~42px wide, causing severe horizontal overflow and unreadable content.

**Current Code:**
```typescript
<table className="w-full text-sm">
  <thead>
    <tr className="border-b border-border-default">
      <th className="text-left px-3 py-2 sticky left-0 bg-surface-card">Slot</th>
      {sortedPlayers.map(player => (
        <th key={player.id} className="text-center px-2 py-2">
          {/* Player name and job */}
        </th>
      ))}
    </tr>
  </thead>
</table>
```

**Fix:** Implement card-based mobile alternative (see implementation plan PR-08).

**Impact:** Who Needs It feature completely unusable on mobile.

---

### P0-4: Context Menu Inaccessible on Touch

**File:** `components/ui/ContextMenu.tsx`, `components/player/PlayerCard.tsx`
**Lines:** Various

**Problem:** Context menus are triggered by right-click (`onContextMenu`), which is unavailable or unreliable on touch devices. Users cannot access player actions (edit, delete, etc.).

**Current Code (PlayerCard.tsx):**
```typescript
<div
  onContextMenu={(e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }}
>
```

**Fix:** Add visible menu button on mobile:
```typescript
const { isSmallScreen } = useDevice();

// In header area
{isSmallScreen && (
  <IconButton
    icon={<MoreHorizontal className="w-4 h-4" />}
    onClick={(e) => {
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }}
    aria-label="Actions menu"
    size="sm"
  />
)}
```

**Impact:** Player management actions inaccessible on mobile.

---

### P0-5: WeeklyLootGrid Table Overflow

**File:** `components/history/WeeklyLootGrid.tsx`
**Lines:** 150-400

**Problem:** Spreadsheet-style grid with multiple columns (Week, Floor, Slot, Player columns) causes horizontal overflow on mobile. The sticky columns compound the issue.

**Current Code:**
```typescript
<div className="overflow-x-auto">
  <table className="w-full min-w-[800px]">
```

**Fix:**
1. Add mobile card view alternative
2. Implement collapsible rows by week
3. Remove `min-w-[800px]` and use responsive design

**Impact:** Loot history completely broken on mobile.

---

### P0-6: Header Overflow on Narrow Screens

**File:** `components/layout/Header.tsx`
**Lines:** 50-200

**Problem:** Header contains static name, tier selector, share code, invite button, and user menu. On 375px screens, these elements overflow or wrap incorrectly.

**Current Issues:**
- Static name not truncated
- All controls visible simultaneously
- No responsive breakpoints for hiding secondary actions

**Fix:** Already partially addressed in existing code but needs completion:
```typescript
// Truncate static name
<span className="truncate max-w-[100px] sm:max-w-[200px]">{currentGroup.name}</span>

// Hide secondary actions on mobile
{canManageInvitations && (
  <div className="hidden sm:block">
    <IconButton icon={<UserPlus />} ... />
  </div>
)}
```

**Impact:** Navigation and group identification broken on mobile.

---

## Major Issues (P1)

### P1-1: Touch Targets Below Minimum Size

**Files:** Multiple components
**Minimum Required:** 44x44px

| Component | File | Current Size | Fix |
|-----------|------|--------------|-----|
| IconButton sm | `primitives/IconButton.tsx` | 32x32px | Add `min-w-[44px] min-h-[44px]` |
| Checkbox | `ui/Checkbox.tsx` | 16x16px | Wrap in 44px touch area |
| Filter buttons | `loot/FilterBar.tsx` | ~28px height | Increase to `py-2.5` |
| Position badges | `player/PositionSelector.tsx` | ~24px | Add padding wrapper |
| Tank role badges | `player/TankRoleSelector.tsx` | ~24px | Add padding wrapper |

**Fix for IconButton:**
```typescript
const sizeClasses = {
  sm: 'w-8 h-8 min-w-[44px] min-h-[44px]',  // Visual 32px, touch 44px
  md: 'w-10 h-10',  // Already 40px, acceptable
  lg: 'w-12 h-12',  // Already 48px, good
};
```

---

### P1-2: GearTable Dense Layout

**File:** `components/player/GearTable.tsx`
**Lines:** 1-400

**Problem:** GearTable shows 11 gear slots with checkboxes and icons. On mobile, this becomes a cramped, hard-to-interact-with list.

**Issues:**
- Checkboxes too close together
- Slot names truncated aggressively
- No progressive disclosure

**Fix:** Implement accordion/collapsible pattern for mobile:
- Show summary (X/11 items acquired)
- Tap to expand slot category (Weapons, Armor, Accessories)
- Larger touch targets within expanded sections

---

### P1-3: PlayerCard Information Density

**File:** `components/player/PlayerCard.tsx`
**Lines:** 1-500

**Problem:** PlayerCard displays:
- Player name and job
- BiS progress bar
- Position/Tank role badges
- Gear table
- Setup banner (conditional)

On mobile, this creates a very tall card with small interactive elements.

**Fix:**
1. Use `isSmallScreen` to show condensed view
2. Collapse gear table by default on mobile
3. Move position/role selectors into overflow menu
4. Increase all badge touch targets

---

### P1-4: SetupWizard Step Navigation

**File:** `components/wizard/SetupWizard.tsx`
**Lines:** 1-600

**Problem:** Wizard has 4 steps with horizontal step indicator. On mobile:
- Step labels may overflow
- Navigation buttons cramped
- Roster step (8 slots) extremely long

**Fix:**
1. Use numbered dots instead of labels on mobile
2. Make step navigation sticky at bottom
3. Consider 2-column grid for roster on tablet, 1-column on phone

---

### P1-5: RosterSlot Job Buttons

**File:** `components/wizard/RosterSlot.tsx`
**Lines:** 258-294

**Problem:** Job quick-select buttons are small (p-1.5 with 24px icons). Combined with the flex-wrap layout, buttons may be hard to tap accurately.

**Fix:**
```typescript
<button
  className="p-2 sm:p-1.5 rounded-lg ..."  // Larger on mobile
>
  <JobIcon job={jobInfo.abbreviation} size="md" />
</button>
```

---

### P1-6: JobPicker Dropdown Height

**File:** `components/player/JobPicker.tsx`
**Lines:** 343-475

**Problem:** Job picker dropdown has `max-h-56` (224px) which may not be enough on mobile when keyboard is visible. Users may not be able to see all job categories.

**Fix:**
```typescript
// Use viewport-relative height on mobile
const { isSmallScreen } = useDevice();
const maxHeight = isSmallScreen ? 'max-h-[50vh]' : 'max-h-56';
```

---

### P1-7: Select Dropdown Positioning

**File:** `components/ui/Select.tsx`
**Lines:** 138-159

**Problem:** Radix Select positions dropdown using `position="popper"` which can cause issues on mobile:
- Dropdown may open off-screen
- Virtual keyboard pushes content

**Fix:** Consider using native select on mobile:
```typescript
const { isTouch } = useDevice();

if (isTouch) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="..."
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  );
}
```

---

### P1-8: AdminDashboard Table Responsiveness

**File:** `pages/AdminDashboard.tsx`
**Lines:** 436-554

**Problem:** Admin table with 8 columns will not fit on mobile screens.

**Fix:**
1. Hide non-essential columns on mobile (Tiers, Visibility, Created)
2. Use card layout alternative
3. Add responsive `hidden md:table-cell` classes

---

### P1-9: Modal Footer Button Stacking

**File:** `components/ui/Modal.tsx`, various modals
**Lines:** Various

**Problem:** Modal footers with multiple buttons may cause wrapping on narrow screens, creating awkward layouts.

**Fix:**
```typescript
// In modal footer
<div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
  <Button variant="secondary" className="w-full sm:w-auto">Cancel</Button>
  <Button className="w-full sm:w-auto">Confirm</Button>
</div>
```

---

## Minor Issues (P2)

### P2-1: LootLogFilters Horizontal Layout

**File:** `components/history/LootLogFilters.tsx`
**Lines:** 1-150

**Problem:** Filter controls (week, floor, player) laid out horizontally. On mobile, these wrap awkwardly.

**Fix:** Stack vertically on mobile:
```typescript
<div className="flex flex-col sm:flex-row gap-3">
  {/* filters */}
</div>
```

---

### P2-2: WeekSelector Button Sizing

**File:** `components/history/WeekSelector.tsx`
**Lines:** 1-100

**Problem:** Week navigation buttons (`<` and `>`) are small.

**Fix:** Increase minimum size:
```typescript
<IconButton size="md" className="min-w-[44px]" ... />
```

---

### P2-3: StaticSwitcher Dropdown

**File:** `components/static-group/StaticSwitcher.tsx`
**Lines:** 1-200

**Problem:** Static group switcher dropdown may overflow on mobile with long group names.

**Fix:**
```typescript
<span className="truncate max-w-[150px] sm:max-w-[250px]">{group.name}</span>
```

---

### P2-4: Home Page CTA Buttons

**File:** `pages/Home.tsx`
**Lines:** 1-200

**Problem:** Hero section CTA buttons may need responsive sizing adjustments.

**Fix:** Already using Button component - verify touch targets are adequate.

---

### P2-5: Dashboard Card Layout

**File:** `pages/Dashboard.tsx`
**Lines:** 1-300

**Problem:** Static group cards may need responsive grid adjustments.

**Fix:** Verify `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` pattern is applied.

---

### P2-6: Login Button Touch Target

**File:** `components/auth/LoginButton.tsx`
**Lines:** 11-38

**Problem:** Login button uses raw `<button>` instead of design system `Button` component.

**Current Code:**
```typescript
<button
  onClick={() => login()}
  disabled={isLoading}
  className="flex items-center gap-2 px-4 py-2 ..."
>
```

**Fix:** Migrate to Button component:
```typescript
<Button onClick={() => login()} disabled={isLoading} className="...">
  <DiscordIcon /> Login with Discord
</Button>
```

---

### P2-7: Input Font Size on iOS

**File:** `components/ui/Input.tsx`
**Lines:** 93-116

**Problem:** Inputs smaller than 16px font size trigger iOS zoom on focus.

**Fix:** Ensure minimum 16px:
```typescript
className={`
  ... text-base ...  // 16px minimum
`}
```

---

### P2-8: Popover/Tooltip Arrow Positioning

**File:** `components/primitives/Popover.tsx`, `Tooltip.tsx`
**Lines:** Various

**Problem:** Popovers may position poorly near screen edges on mobile.

**Fix:** Add collision detection padding:
```typescript
<PopoverContent
  collisionPadding={16}
  avoidCollisions
  ...
/>
```

---

## Optimization Opportunities

### O-1: Implement Skeleton Loading on Mobile

**Benefit:** Prevent layout shift during data fetch
**Files:** `components/ui/Skeleton.tsx` (exists), various components

**Implementation:** Add skeleton states to PlayerCard, WeeklyLootGrid when loading.

---

### O-2: Add Pull-to-Refresh

**Benefit:** Mobile-native refresh pattern
**Scope:** GroupView main content area

**Implementation:** Use touch event detection for pull-down gesture.

---

### O-3: Swipe Gestures for Tabs

**Benefit:** Faster tab navigation on mobile
**Scope:** GroupView tab navigation

**Implementation:** Use touch events or library like `use-gesture`.

---

### O-4: Optimize Drag-and-Drop on Touch

**Benefit:** Better player reordering experience
**Scope:** PlayerGrid, WeaponPriorityGrid

**Implementation:** dnd-kit already supports touch, but may need:
- Larger drag handles on mobile
- Visual feedback improvements
- Consider up/down buttons as alternative

---

### O-5: Lazy Load Heavy Components

**Benefit:** Faster initial load on mobile networks
**Scope:** BiSImportModal, LootPriorityPanel

**Implementation:** Use React.lazy() with Suspense.

---

### O-6: Add Haptic Feedback

**Benefit:** Better touch interaction feedback
**Scope:** Buttons, drag interactions

**Implementation:** Use `navigator.vibrate()` API where available.

---

## Component-by-Component Findings

### Pages (`src/pages/`)

| Component | Mobile Status | Issues |
|-----------|---------------|--------|
| `Home.tsx` | OK | Minor CTA sizing |
| `Dashboard.tsx` | OK | Verify grid responsiveness |
| `GroupView.tsx` | Needs Work | P0: Header, P1: Controls |
| `AdminDashboard.tsx` | Needs Work | P1: Table overflow |

### Layout (`src/components/layout/`)

| Component | Mobile Status | Issues |
|-----------|---------------|--------|
| `Header.tsx` | Needs Work | P0: Overflow |

### Player (`src/components/player/`)

| Component | Mobile Status | Issues |
|-----------|---------------|--------|
| `PlayerCard.tsx` | Needs Work | P0: Context menu, P1: Density |
| `PlayerCardHeader.tsx` | Needs Work | P1: Badge touch targets |
| `PlayerGrid.tsx` | OK | Drag may need mobile alternative |
| `GearTable.tsx` | Needs Work | P1: Dense layout |
| `JobPicker.tsx` | Needs Work | P1: Dropdown height |
| `PositionSelector.tsx` | Needs Work | P1: Touch target |
| `TankRoleSelector.tsx` | Needs Work | P1: Touch target |
| `BiSImportModal.tsx` | OK | Uses Modal with responsive behavior |

### Loot (`src/components/loot/`)

| Component | Mobile Status | Issues |
|-----------|---------------|--------|
| `LootPriorityPanel.tsx` | Needs Work | P0: Name overlap |
| `WhoNeedsItMatrix.tsx` | Needs Work | P0: Table overflow |
| `FilterBar.tsx` | Needs Work | P1: Touch targets |
| `QuickLogDropModal.tsx` | OK | Uses design system |

### History (`src/components/history/`)

| Component | Mobile Status | Issues |
|-----------|---------------|--------|
| `WeeklyLootGrid.tsx` | Needs Work | P0: Table overflow |
| `WeekSelector.tsx` | Needs Work | P2: Button sizing |
| `LootLogFilters.tsx` | Needs Work | P2: Horizontal layout |

### Weapon Priority (`src/components/weapon-priority/`)

| Component | Mobile Status | Issues |
|-----------|---------------|--------|
| `WeaponPriorityGrid.tsx` | Needs Work | P0: Grid overflow |

### Wizard (`src/components/wizard/`)

| Component | Mobile Status | Issues |
|-----------|---------------|--------|
| `SetupWizard.tsx` | Needs Work | P1: Navigation |
| `RosterSlot.tsx` | Needs Work | P1: Job buttons |

### UI (`src/components/ui/`)

| Component | Mobile Status | Issues |
|-----------|---------------|--------|
| `Modal.tsx` | Needs Work | P1: Sheet variant incomplete |
| `MobileBottomNav.tsx` | OK | Already implemented |
| `Select.tsx` | Needs Work | P1: Dropdown positioning |
| `Checkbox.tsx` | Needs Work | P1: Touch target |
| `ContextMenu.tsx` | Needs Work | P0: Touch inaccessible |
| `Input.tsx` | Needs Work | P2: iOS zoom |

### Primitives (`src/components/primitives/`)

| Component | Mobile Status | Issues |
|-----------|---------------|--------|
| `Button.tsx` | OK | Good responsive handling |
| `IconButton.tsx` | Needs Work | P1: sm size touch target |
| `Tooltip.tsx` | OK | Already touch-safe |

### Auth (`src/components/auth/`)

| Component | Mobile Status | Issues |
|-----------|---------------|--------|
| `LoginButton.tsx` | Needs Work | P2: Uses raw button |

### Static Group (`src/components/static-group/`)

| Component | Mobile Status | Issues |
|-----------|---------------|--------|
| `StaticSwitcher.tsx` | Needs Work | P2: Name truncation |

---

## Implementation Plan

### Phase 1: Critical Fixes (Week 1)

**Goal:** Fix all P0 issues to make the app functional on mobile.

| PR | Focus | Files | Est. Hours |
|----|-------|-------|-----------|
| PR-01 | WeaponPriorityGrid responsive | `WeaponPriorityGrid.tsx` | 2 |
| PR-02 | LootPriorityPanel truncation | `LootPriorityPanel.tsx` | 2 |
| PR-03 | WhoNeedsItMatrix card view | `WhoNeedsItMatrix.tsx` | 4 |
| PR-04 | Context menu mobile button | `ContextMenu.tsx`, `PlayerCard.tsx` | 3 |
| PR-05 | WeeklyLootGrid mobile view | `WeeklyLootGrid.tsx` | 4 |
| PR-06 | Header responsive fixes | `Header.tsx` | 2 |

**Total Phase 1:** ~17 hours

---

### Phase 2: Navigation & Layout (Week 2)

**Goal:** Integrate bottom nav and improve overall mobile layout.

| PR | Focus | Files | Est. Hours |
|----|-------|-------|-----------|
| PR-07 | Wire up MobileBottomNav | `GroupView.tsx`, `MobileBottomNav.tsx` | 3 |
| PR-08 | Modal sheet variant | `Modal.tsx` | 3 |
| PR-09 | Mobile controls sheet | `GroupView.tsx` | 3 |
| PR-10 | Admin table responsiveness | `AdminDashboard.tsx` | 2 |

**Total Phase 2:** ~11 hours

---

### Phase 3: Touch Target Fixes (Week 3)

**Goal:** Ensure all interactive elements meet 44px minimum.

| PR | Focus | Files | Est. Hours |
|----|-------|-------|-----------|
| PR-11 | IconButton touch targets | `IconButton.tsx` | 1 |
| PR-12 | Checkbox touch targets | `Checkbox.tsx` | 1 |
| PR-13 | FilterBar touch targets | `FilterBar.tsx` | 1 |
| PR-14 | Badge selectors touch | `PositionSelector.tsx`, `TankRoleSelector.tsx` | 2 |
| PR-15 | Select mobile optimization | `Select.tsx` | 2 |

**Total Phase 3:** ~7 hours

---

### Phase 4: Component Optimizations (Week 4)

**Goal:** Improve individual component mobile UX.

| PR | Focus | Files | Est. Hours |
|----|-------|-------|-----------|
| PR-16 | GearTable mobile layout | `GearTable.tsx` | 4 |
| PR-17 | PlayerCard condensed view | `PlayerCard.tsx` | 3 |
| PR-18 | SetupWizard mobile | `SetupWizard.tsx`, `RosterSlot.tsx` | 3 |
| PR-19 | JobPicker improvements | `JobPicker.tsx` | 2 |

**Total Phase 4:** ~12 hours

---

### Phase 5: Polish & Enhancements (Week 5)

**Goal:** Minor fixes and optimizations.

| PR | Focus | Files | Est. Hours |
|----|-------|-------|-----------|
| PR-20 | Minor P2 fixes | Various | 4 |
| PR-21 | Skeleton loading states | Various | 3 |
| PR-22 | Final QA sweep | All | 4 |

**Total Phase 5:** ~11 hours

---

### Summary

| Phase | Focus | Hours | Priority |
|-------|-------|-------|----------|
| 1 | Critical Fixes | 17 | P0 |
| 2 | Navigation & Layout | 11 | P1 |
| 3 | Touch Targets | 7 | P1 |
| 4 | Component Optimizations | 12 | P1/P2 |
| 5 | Polish | 11 | P2 |
| **Total** | | **58** | |

---

## Testing Checklist

### Devices to Test
- [ ] iPhone SE (375px) - smallest common viewport
- [ ] iPhone 12/13/14 (390px)
- [ ] iPhone Plus/Max (428px)
- [ ] iPad Mini (768px)
- [ ] iPad Pro (1024px)
- [ ] Android phones (360-412px common)

### Core Flows to Verify
- [ ] View roster and player cards
- [ ] Open weapon priority editor and reorder
- [ ] View loot priority lists (names don't overlap scores)
- [ ] Navigate Who Needs It matrix
- [ ] Use settings modal
- [ ] Create/join a static group
- [ ] Log a loot drop
- [ ] Access player context menus
- [ ] Complete setup wizard

### Interaction Tests
- [ ] Tooltips do NOT appear on tap
- [ ] All buttons/controls have 44px touch target
- [ ] No horizontal scrolling on main content
- [ ] Modals are dismissible by backdrop tap
- [ ] Bottom nav stays visible and doesn't overlap content
- [ ] Scroll inertia works inside modals
- [ ] Virtual keyboard doesn't break layout

### Regression Tests (Desktop)
- [ ] Desktop layout unchanged at 1280x800
- [ ] Tooltips work on hover
- [ ] Drag and drop still works
- [ ] Context menus work with right-click

---

## Appendix: CSS Utilities Reference

### Existing Safe Area Classes (index.css)

```css
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }
.pt-safe { padding-top: env(safe-area-inset-top); }
.has-bottom-nav { padding-bottom: calc(3.5rem + env(safe-area-inset-bottom)); }
```

### Recommended Additional Classes

```css
/* Minimum touch target */
.touch-target { min-width: 44px; min-height: 44px; }

/* Mobile-only visibility */
.mobile-only { display: block; }
@media (min-width: 640px) { .mobile-only { display: none; } }

/* Desktop-only visibility */
.desktop-only { display: none; }
@media (min-width: 640px) { .desktop-only { display: block; } }
```

### Tailwind Breakpoint Reference

| Prefix | Min Width | Use Case |
|--------|-----------|----------|
| (none) | 0px | Mobile first |
| `sm:` | 640px | Large phones, small tablets |
| `md:` | 768px | Tablets portrait |
| `lg:` | 1024px | Tablets landscape, laptops |
| `xl:` | 1280px | Desktops |

---

## Conclusion

The FFXIV Raid Planner has a solid foundation for mobile support, with key infrastructure already in place. The main gaps are in data-dense components (tables, grids) and touch target sizing. Following this implementation plan will result in a fully functional mobile experience within approximately 5 weeks of focused work.

**Priority Recommendation:** Start with Phase 1 (Critical Fixes) immediately, as these issues make core functionality unusable on mobile devices.
