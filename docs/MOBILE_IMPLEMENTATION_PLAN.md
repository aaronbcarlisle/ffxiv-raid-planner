# FFXIV Raid Planner - Mobile UX Optimization Implementation Plan

**Version:** 1.0
**Created:** 2026-01-24
**Status:** Ready for Implementation

This document consolidates the mobile optimization plans from three sources into a unified implementation roadmap.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [UX Principles](#ux-principles)
3. [Scope](#scope)
4. [Implementation Phases](#implementation-phases)
   - [Phase 1: Foundation (PR-01, PR-02)](#phase-1-foundation)
   - [Phase 2: Navigation & Layout (PR-03, PR-04)](#phase-2-navigation--layout)
   - [Phase 3: Modal & Sheet Behavior (PR-05)](#phase-3-modal--sheet-behavior)
   - [Phase 4: Feature-Specific Fixes (PR-06, PR-07, PR-08)](#phase-4-feature-specific-fixes)
   - [Phase 5: Polish & PWA (PR-09, PR-10, PR-11)](#phase-5-polish--pwa)
5. [Component Specifications](#component-specifications)
6. [Testing Checklist](#testing-checklist)
7. [File Reference](#file-reference)

---

## Executive Summary

This plan optimizes the FFXIV Raid Planner mobile web experience. The goal is to fix existing mobile issues and ensure all features are usable on mobile devices without developing a native app.

**Rationale for mobile web over native app:**
- Periodic use case (weekly raid nights) doesn't justify native app friction
- dnd-kit would require complete replacement in React Native
- Single codebase maintenance for a free community tool
- No app store approval delays or developer account costs

**Priority Levels:**
- **P0 (Critical)**: Broken functionality, content cut off, unusable features
- **P1 (High)**: Poor UX, difficult interactions, confusing layouts
- **P2 (Medium)**: Minor polish, nice-to-haves
- **P3 (Low)**: Future enhancements

---

## UX Principles

### Thumb-First
- Primary navigation belongs near the bottom
- Top bar should be sparse; heavy controls go in overflow menus or sheets

### Touch-First
- No hover dependence
- Tooltips disabled on touch devices
- Tap targets >= 44x44px

### Progressive Disclosure
- Show most important info and actions first
- Move advanced settings to bottom sheet/drawer

### Scrolling Discipline
- Only one scroll region inside a modal/sheet
- Avoid nested scroll panes on mobile

### No Surprise Horizontal Scrolling
- Use wrapping or controlled horizontal carousels only when intentional
- Avoid wide tables; use list/accordion patterns

---

## Scope

### In-Scope
- Mobile-first UX improvements across main GroupView flows: Roster / Loot / Log / Summary
- Navigation improvements for small screens (bottom nav / simplified top bar)
- Modal behavior improvements on mobile (sheet/fullscreen, safe areas, better scrolling)
- Touch-first adjustments (disable hover tooltips, larger hit targets, better spacing)
- Progressive disclosure of dense controls into bottom sheet / overflow menu
- Safe-area + dynamic viewport height correctness (100dvh)
- PWA manifest for "Add to Home Screen" experience

### Out-of-Scope
- Major redesign of information architecture
- Backend/API changes beyond what is needed for UI wiring
- Reworking authorization/auth flows
- Localization work
- Rebuilding data models

### Definition of Done (Global)
- All primary views usable at 360x800 without horizontal scrolling
- Touch interactions are reliable (no accidental tooltip overlays, no micro-targets)
- Modals are usable with one scroll region and sticky actions where relevant
- Mobile navigation is thumb-friendly
- Build/lint/test run clean

---

## Implementation Phases

### Phase 1: Foundation

#### PR-01: Device Capabilities Hook + Touch-Safe Tooltip

**Priority:** P0 (Foundation)

**Goals:**
- Add `useDevice()` hook with device capability detection
- Disable tooltips on touch devices

**New File:** `frontend/src/hooks/useDevice.ts`

```typescript
import { useState, useEffect } from 'react';

interface DeviceCapabilities {
  isSmallScreen: boolean;    // max-width: 640px
  isTouch: boolean;          // pointer: coarse OR maxTouchPoints > 0
  canHover: boolean;         // hover: hover AND pointer: fine
  prefersReducedMotion: boolean;
}

export function useDevice(): DeviceCapabilities {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>(() => ({
    isSmallScreen: false,
    isTouch: false,
    canHover: true,
    prefersReducedMotion: false,
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const smallScreenQuery = window.matchMedia('(max-width: 640px)');
    const touchQuery = window.matchMedia('(pointer: coarse)');
    const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => {
      setCapabilities({
        isSmallScreen: smallScreenQuery.matches,
        isTouch: touchQuery.matches || navigator.maxTouchPoints > 0,
        canHover: hoverQuery.matches,
        prefersReducedMotion: motionQuery.matches,
      });
    };

    update();

    smallScreenQuery.addEventListener('change', update);
    touchQuery.addEventListener('change', update);
    hoverQuery.addEventListener('change', update);
    motionQuery.addEventListener('change', update);

    return () => {
      smallScreenQuery.removeEventListener('change', update);
      touchQuery.removeEventListener('change', update);
      hoverQuery.removeEventListener('change', update);
      motionQuery.removeEventListener('change', update);
    };
  }, []);

  return capabilities;
}
```

**Modify:** `frontend/src/components/primitives/Tooltip.tsx`

```typescript
// Add to Tooltip component
import { useDevice } from '../../hooks/useDevice';

export function Tooltip({ children, content, disabled, ...props }: TooltipProps) {
  const { canHover } = useDevice();

  // Disable tooltips on touch devices
  if (!canHover || disabled) {
    return <>{children}</>;
  }

  // ... existing tooltip implementation
}
```

**Definition of Done:**
- [ ] Tooltips never appear on touch devices
- [ ] Desktop tooltip behavior unchanged
- [ ] Build/lint passes

---

#### PR-02: Mobile Bottom Navigation

**Priority:** P1

**Goals:**
- Add bottom nav component for primary tabs on mobile
- Hide TabNavigation on small screens, show bottom nav
- Ensure safe-area padding and content not covered

**New File:** `frontend/src/components/ui/MobileBottomNav.tsx`

```typescript
import { useDevice } from '../../hooks/useDevice';
import type { TabDefinition } from './TabNavigation';

interface MobileBottomNavProps {
  tabs: TabDefinition[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function MobileBottomNav({ tabs, activeTab, onTabChange }: MobileBottomNavProps) {
  const { isSmallScreen } = useDevice();

  if (!isSmallScreen) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface-card border-t border-border-default pb-safe">
      <div className="flex justify-around items-center h-14">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[44px] ${
              activeTab === tab.id
                ? 'text-accent'
                : 'text-text-secondary'
            }`}
            aria-label={tab.label}
          >
            <img
              src={tab.icon}
              alt=""
              className={`w-5 h-5 ${activeTab === tab.id ? 'opacity-100' : 'opacity-60'}`}
            />
            <span className="text-[10px] mt-0.5">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
```

**Add to:** `frontend/src/index.css`

```css
/* Safe area utilities */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}

.pt-safe {
  padding-top: env(safe-area-inset-top);
}

/* Bottom nav content offset */
.has-bottom-nav {
  padding-bottom: calc(3.5rem + env(safe-area-inset-bottom));
}
```

**Modify:** `frontend/src/pages/GroupView.tsx`

- On desktop: keep `TabNavigation`
- On mobile: hide TabNavigation (`hidden sm:flex`), render `MobileBottomNav`
- Add `has-bottom-nav` class to main content container on mobile

**Definition of Done:**
- [ ] Bottom nav visible on small screens, usable with thumb
- [ ] Content not hidden behind nav (padding works)
- [ ] Desktop tab row unchanged
- [ ] No horizontal overflow at 360px

---

### Phase 2: Navigation & Layout

#### PR-03: Mobile Controls Sheet

**Priority:** P1

**Goals:**
- Replace sort/group/subs/view cluster with single "Controls" button on mobile
- Controls open in a sheet modal

**Modify:** `frontend/src/pages/GroupView.tsx`

```typescript
// Add state for controls sheet
const [showControlsSheet, setShowControlsSheet] = useState(false);
const { isSmallScreen } = useDevice();

// In render:
{isSmallScreen ? (
  <IconButton
    icon={<Settings className="w-5 h-5" />}
    onClick={() => setShowControlsSheet(true)}
    aria-label="View controls"
    size="md"
  />
) : (
  // Existing desktop control cluster
  <div className="flex items-center gap-2">
    {/* Sort, Group, Subs, View toggles */}
  </div>
)}

{/* Controls Sheet */}
<Modal
  isOpen={showControlsSheet}
  onClose={() => setShowControlsSheet(false)}
  title="View Controls"
  size="sm"
>
  <div className="space-y-4 p-4">
    {/* Full-width versions of each control */}
    <div className="space-y-2">
      <label className="text-sm text-text-muted">Sort By</label>
      <Select ... fullWidth />
    </div>
    {/* ... other controls ... */}
  </div>
</Modal>
```

**Definition of Done:**
- [ ] On mobile, controls accessible via sheet
- [ ] Desktop unchanged
- [ ] State updates work correctly

---

#### PR-04: Mobile Header Compaction

**Priority:** P1

**Goals:**
- Make header fit on 360px width
- Move secondary actions into overflow menu
- Prevent overflow

**Modify:** `frontend/src/components/layout/Header.tsx`

Key changes:
1. Hide invite button on mobile: `hidden sm:block`
2. Truncate static name: `truncate max-w-[100px] sm:max-w-[200px]`
3. Hide tier label on mobile: `hidden sm:inline`
4. Compact share code display
5. Add overflow menu for secondary actions on mobile

```typescript
// Hide invite button on mobile
{canManageInvitations && (
  <div className="hidden sm:block">
    <Tooltip content="Manage invitations">
      <IconButton ... />
    </Tooltip>
  </div>
)}

// Make tier selector more compact
<div className="flex items-center gap-1">
  <span className="hidden sm:inline text-text-muted text-sm">Tier:</span>
  <Select ... />
</div>

// Truncate static name
<span className="truncate max-w-[100px] sm:max-w-[200px]">{currentGroup.name}</span>
```

**Definition of Done:**
- [ ] Header fits on 360px width
- [ ] Actions still accessible
- [ ] Desktop unchanged

---

### Phase 3: Modal & Sheet Behavior

#### PR-05: Modal Sheet Variant + Safe Area

**Priority:** P1

**Goals:**
- Add `variant: 'dialog' | 'sheet'` prop to Modal
- Default to sheet on small screens
- Add safe-area padding and 100dvh support

**Modify:** `frontend/src/components/ui/Modal.tsx`

```typescript
interface ModalProps {
  // ... existing props
  variant?: 'dialog' | 'sheet';  // New prop
}

export function Modal({ variant, ...props }: ModalProps) {
  const { isSmallScreen } = useDevice();

  // Auto-select variant based on screen size
  const effectiveVariant = variant ?? (isSmallScreen ? 'sheet' : 'dialog');

  const containerClasses = effectiveVariant === 'sheet'
    ? 'fixed inset-x-0 bottom-0 max-h-[100dvh] rounded-t-xl animate-slide-up'
    : 'relative max-h-[90vh] rounded-lg';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={modalRef}
        className={`
          bg-surface-card border border-border-default
          w-full ${sizeClass}
          flex flex-col focus:outline-none
          ${containerClasses}
        `}
      >
        {/* Header - sticky */}
        <div className="sticky top-0 ...">
          {/* ... */}
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer - sticky with safe area */}
        {footer && (
          <div className="sticky bottom-0 pb-safe ...">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Add to:** `frontend/src/index.css`

```css
@keyframes slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slide-up 0.2s ease-out;
}
```

**Definition of Done:**
- [ ] Sheets scroll correctly with single scroll region
- [ ] Safe-area respected on notched devices
- [ ] Desktop dialogs unchanged
- [ ] Focus trap and ESC close work

---

### Phase 4: Feature-Specific Fixes

#### PR-06: WeaponPriorityGrid Mobile Fix (P0)

**Priority:** P0 - Critical

**Problem:** 2-column grid causes right column to be cut off on narrow screens.

**Modify:** `frontend/src/components/weapon-priority/WeaponPriorityGrid.tsx`

```typescript
// Replace gridColsClass logic (lines 373-377)
const gridColsClass = columns.length <= 1
  ? 'grid-cols-1'
  : columns.length === 2
  ? 'grid-cols-1 sm:grid-cols-2'  // Single col on mobile, 2 cols on sm+
  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';  // Responsive 1→2→3
```

**Additional Fix:** Make "Received" checkbox label responsive (lines 116-122):

```typescript
<Checkbox
  checked={priority.received}
  onChange={() => onToggleReceived?.()}
  disabled={disabled || isDragOverlay}
  label={<span className="hidden sm:inline">Received</span>}
  className="gap-1.5"
/>
```

**Mobile Reorder Alternative:**
Add move up/down buttons on mobile instead of relying on drag:

```typescript
const { isSmallScreen } = useDevice();

// In list item render
{isSmallScreen && (
  <div className="flex flex-col gap-1">
    <IconButton
      icon={<ChevronUp />}
      onClick={() => onMoveUp(index)}
      disabled={index === 0}
      size="sm"
      aria-label="Move up"
    />
    <IconButton
      icon={<ChevronDown />}
      onClick={() => onMoveDown(index)}
      disabled={index === items.length - 1}
      size="sm"
      aria-label="Move down"
    />
  </div>
)}
```

**Definition of Done:**
- [ ] Grid displays single column on mobile
- [ ] No horizontal scrolling
- [ ] Mobile reorder works without drag
- [ ] Desktop unchanged

---

#### PR-07: LootPriorityPanel Mobile Fix (P0)

**Priority:** P0 - Critical

**Problem:** Player names like "Alexander" overlap with score badges, showing "Alexande210".

**Modify:** `frontend/src/components/loot/LootPriorityPanel.tsx` (lines 118-157)

```typescript
<div
  className={`flex items-center justify-between px-2 py-1 rounded text-sm group min-w-0 ${
    isFirst ? 'bg-accent/20' : ''
  }`}
>
  {/* Left side - player info with truncation */}
  <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
    <span className={`flex-shrink-0 ${isFirst ? 'text-accent font-medium' : 'text-text-secondary'}`}>
      {index + 1}.
    </span>
    <span className="flex-shrink-0">
      <JobIcon job={entry.player.job} size="xs" />
    </span>
    <span className={`truncate ${isFirst ? 'text-accent font-medium' : 'text-text-secondary'}`}>
      {entry.player.name}
    </span>
  </div>

  {/* Right side - score (never shrinks) */}
  <div className="flex items-center gap-2 flex-shrink-0">
    {/* ... existing score badge code ... */}
  </div>
</div>
```

**Additional:** Make slot cards single-column on mobile:

```typescript
// Update grid layout
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* slot cards */}
</div>
```

**Definition of Done:**
- [ ] Names truncate properly without overlapping scores
- [ ] Single column layout on mobile
- [ ] Desktop unchanged

---

#### PR-08: WhoNeedsItMatrix Mobile View

**Priority:** P1

**Problem:** Matrix table with 8 player columns doesn't fit on mobile.

**Modify:** `frontend/src/components/loot/WhoNeedsItMatrix.tsx`

Add card-based alternative view for mobile:

```typescript
return (
  <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden">
    {/* Floor Filter Tabs - unchanged */}
    <div className="p-3 border-b border-border-default bg-surface-elevated/50">
      <FilterBar ... />
    </div>

    {/* Desktop: Table view */}
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-sm">
        {/* ... existing table code ... */}
      </table>
    </div>

    {/* Mobile: Card view */}
    <div className="md:hidden divide-y divide-border-default">
      {needsMatrix.map(({ slot, displayName, playersWhoNeed, count, isFree }) => (
        <div key={slot} className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <img src={GEAR_SLOT_ICONS[slot]} alt="" className="w-4 h-4" />
              <span className="font-medium text-text-primary">{displayName}</span>
            </div>
            {isFree ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-status-success/20 text-status-success">
                FREE
              </span>
            ) : (
              <span className="text-xs text-text-muted">{count}/8 need</span>
            )}
          </div>
          {!isFree && (
            <div className="flex flex-wrap gap-1.5">
              {sortedPlayers
                .filter(p => playersWhoNeed.has(p.id))
                .map(player => (
                  <button
                    key={player.id}
                    onClick={() => handlePlayerClick(player, slot)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: `${getRoleColor(player.role)}20`,
                      color: getRoleColor(player.role),
                    }}
                  >
                    <JobIcon job={player.job} size="xs" />
                    <span>{player.name.split(' ')[0]}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);
```

**Definition of Done:**
- [ ] Card view on mobile shows all needed information
- [ ] No horizontal scrolling
- [ ] Desktop table view unchanged

---

#### PR-09: Loot Log Mobile Layout

**Priority:** P2

**Goals:**
- Default to list-like layout on mobile
- Put filters and week selection in a sheet

**Modify:** `frontend/src/components/history/LootLogPanel.tsx`

```typescript
const { isSmallScreen } = useDevice();
const [showFiltersSheet, setShowFiltersSheet] = useState(false);

// In render
{isSmallScreen ? (
  <>
    <div className="flex items-center justify-between p-3 border-b border-border-default">
      <h3 className="font-medium">Loot Log</h3>
      <IconButton
        icon={<Filter />}
        onClick={() => setShowFiltersSheet(true)}
        aria-label="Filters"
      />
    </div>
    <Modal
      isOpen={showFiltersSheet}
      onClose={() => setShowFiltersSheet(false)}
      title="Filters"
    >
      <LootLogFilters ... />
    </Modal>
  </>
) : (
  // Existing desktop layout with inline filters
)}
```

**Definition of Done:**
- [ ] Log usable on mobile without cramped controls
- [ ] Filters accessible via sheet
- [ ] Desktop unchanged

---

### Phase 5: Polish & PWA

#### PR-10: Touch Target Sizing Pass

**Priority:** P2

**Goals:**
- Ensure IconButton/Button/Input are touch-friendly (>= 44px)
- Add aria-labels for icon-only controls

**Modify:** `frontend/src/components/primitives/IconButton.tsx`

```typescript
const sizeClasses = {
  sm: 'w-8 h-8 min-w-[44px] min-h-[44px]',  // Visual size + touch target
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};
```

**Modify:** `frontend/src/components/ui/Input.tsx`

```typescript
// Ensure adequate padding for touch
<input
  className={`
    px-3 py-2 min-h-[44px]
    ${/* ... existing classes */}
  `}
/>
```

**Definition of Done:**
- [ ] Tap targets meet minimum 44px sizing
- [ ] Icon-only buttons have aria-labels
- [ ] No desktop regressions

---

#### PR-11: Context Menu Mobile Alternative

**Priority:** P2

**Problem:** Right-click context menus don't work on touch devices.

**Solution:** Add visible menu button on mobile:

**Modify components using context menus (e.g., PlayerCard.tsx):**

```typescript
// Add explicit menu button for mobile
const { isSmallScreen } = useDevice();

return (
  <div className="relative">
    {/* Card content */}

    {/* Mobile menu button */}
    {isSmallScreen && (
      <IconButton
        icon={<MoreHorizontal />}
        onClick={handleMenuOpen}
        className="absolute top-2 right-2"
        aria-label="Actions menu"
      />
    )}

    {/* Context menu - works for desktop right-click and mobile button */}
    <ContextMenu ... />
  </div>
);
```

**Definition of Done:**
- [ ] Context menu actions accessible on mobile
- [ ] Desktop right-click unchanged

---

#### PR-12: Final Polish + PWA

**Priority:** P3

**Goals:**
- Add PWA manifest
- Final overflow sweep at 360px
- Confirm safe-area padding throughout

**New File:** `frontend/public/manifest.json`

```json
{
  "name": "FFXIV Raid Planner",
  "short_name": "Raid Planner",
  "description": "Track BiS gear and loot priority for your FFXIV static",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#2DD4BF",
  "background_color": "#0A0E14",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Update:** `frontend/index.html`

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#2DD4BF">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="/icon-192.png">
```

**Final Sweep Checklist:**
- [ ] Search for `100vh` and replace with `100dvh` where appropriate
- [ ] Verify bottom padding for bottom nav on all major views
- [ ] Check for horizontal overflow at 360px on all primary views
- [ ] Replace any remaining `w-screen` with `w-full`

---

## Component Specifications

### useDevice Hook

| Property | Type | Description |
|----------|------|-------------|
| `isSmallScreen` | `boolean` | Viewport <= 640px |
| `isTouch` | `boolean` | Touch-capable device |
| `canHover` | `boolean` | Supports hover interactions |
| `prefersReducedMotion` | `boolean` | User prefers reduced motion |

### MobileBottomNav

| Prop | Type | Description |
|------|------|-------------|
| `tabs` | `TabDefinition[]` | Tab definitions (id, label, icon) |
| `activeTab` | `string` | Currently active tab ID |
| `onTabChange` | `(id: string) => void` | Tab change handler |

### Modal (Extended)

| Prop | Type | Description |
|------|------|-------------|
| `variant` | `'dialog' \| 'sheet'` | Display mode (auto-selects based on screen) |
| `footer` | `ReactNode` | Sticky footer content |

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
- [ ] Switch between Roster / Loot / Log / Summary quickly
- [ ] Open weapon priority editor and reorder
- [ ] View loot priority lists (names don't overlap scores)
- [ ] Navigate Who Needs It matrix
- [ ] Use settings modal
- [ ] View documentation pages
- [ ] Create/join a static group
- [ ] Log a loot drop

### Interaction Tests
- [ ] Tooltips do not appear on tap
- [ ] Close modals by X and backdrop tap
- [ ] Bottom nav stays visible and doesn't overlap buttons
- [ ] Long-press doesn't trigger weird selection
- [ ] Scroll inertia works inside modals

### Regression Tests
- [ ] Desktop layout still OK at 1280x800
- [ ] Tooltip still works on desktop hover
- [ ] Drag and drop still works on desktop

---

## File Reference

| File | PRs | Priority |
|------|-----|----------|
| `hooks/useDevice.ts` (new) | PR-01 | P0 |
| `components/primitives/Tooltip.tsx` | PR-01 | P0 |
| `components/ui/MobileBottomNav.tsx` (new) | PR-02 | P1 |
| `pages/GroupView.tsx` | PR-02, PR-03, PR-12 | P1 |
| `components/ui/TabNavigation.tsx` | PR-02 | P1 |
| `components/layout/Header.tsx` | PR-04, PR-12 | P1 |
| `components/ui/Modal.tsx` | PR-05, PR-12 | P1 |
| `index.css` | PR-02, PR-05, PR-12 | P1 |
| `components/weapon-priority/WeaponPriorityGrid.tsx` | PR-06 | P0 |
| `components/weapon-priority/WeaponPriorityListItem.tsx` | PR-06 | P0 |
| `components/loot/LootPriorityPanel.tsx` | PR-07 | P0 |
| `components/loot/WhoNeedsItMatrix.tsx` | PR-08 | P1 |
| `components/history/LootLogPanel.tsx` | PR-09 | P2 |
| `components/history/LootLogFilters.tsx` | PR-09 | P2 |
| `components/primitives/IconButton.tsx` | PR-10 | P2 |
| `components/primitives/Button.tsx` | PR-10 | P2 |
| `components/ui/Input.tsx` | PR-10 | P2 |
| `components/player/PlayerCard.tsx` | PR-11 | P2 |
| `public/manifest.json` (new) | PR-12 | P3 |
| `index.html` | PR-12 | P3 |

---

## Tailwind Responsive Reference

The project uses Tailwind CSS with these breakpoints:
- `sm:` = 640px+ (landscape phones, small tablets)
- `md:` = 768px+ (tablets portrait)
- `lg:` = 1024px+ (tablets landscape, laptops)
- `xl:` = 1280px+ (desktops)

Common patterns:
```css
/* Hide on mobile, show on desktop */
hidden sm:block

/* Show on mobile, hide on desktop */
block sm:hidden

/* Responsive flex direction */
flex-col sm:flex-row

/* Responsive padding */
px-2 sm:px-4

/* Responsive text */
text-xs sm:text-sm

/* Responsive grid */
grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
```

---

## Implementation Notes

### Order of Implementation
Execute PRs in order (PR-01 through PR-12) as later PRs depend on earlier work:
1. **PR-01** provides `useDevice` hook used throughout
2. **PR-02** provides bottom nav infrastructure
3. **PR-05** provides modal sheet behavior used by PR-03, PR-09

### Per-PR Workflow
After each PR:
1. Run `pnpm lint`
2. Run `pnpm build`
3. Run `pnpm test`
4. Test manually on mobile emulator
5. Summarize changes
6. Complete relevant section of testing checklist

### Avoiding Regressions
- Keep desktop behavior intact unless explicitly changed
- Test at 1280x800 after each PR
- Verify hover tooltips still work on desktop
- Verify drag and drop unchanged on desktop
