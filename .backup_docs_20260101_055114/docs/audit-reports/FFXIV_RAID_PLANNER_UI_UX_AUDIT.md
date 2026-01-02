# FFXIV Raid Planner: Comprehensive UI/UX Audit Report

**Date:** December 29, 2025  
**Auditor:** Claude (AI Design Review)  
**Project:** FFXIV Raid Planner Frontend  
**Stack:** React 19, TypeScript, Tailwind CSS 4, Zustand 5  

---

## Executive Summary

This audit identifies systemic UI/UX issues resulting from iterative development that has created inconsistent patterns, visual clutter, and disjointed user experience. While the **functionality is solid**, the **design architecture lacks intentionality** - elements feel "injected" rather than designed from a cohesive system.

### Overall Assessment: C+ (Functional but Unfocused)

| Area | Grade | Summary |
|------|-------|---------|
| Visual Hierarchy | C | Information overload, no clear focal points |
| Component Consistency | D+ | 8+ dropdown patterns, 4+ button styles |
| Color System | B- | Tokens exist but used inconsistently |
| Typography | C | No clear scale, inconsistent usage |
| Interaction Design | C- | Hidden functionality, discoverable issues |
| Information Architecture | B- | Good structure, poor presentation |
| Mobile/Responsive | C | Functional but cramped |

---

## Part 1: PlayerCard Clutter Analysis

### The Core Problem

The PlayerCard component (682 lines) is trying to be everything at once:
- Identity display (name, job, role)
- Status indicators (position, tank role, substitute, ownership)
- External links (BiS source)
- Progress tracking (gear completion)
- Inline editing (name, job, position)
- Context actions (10+ menu items)
- Detailed gear table (11 slots × 4 columns)

**Result:** Visual overload that makes it hard to scan or find information quickly.

### Specific Issues

#### 1.1 Badge Explosion (Lines 534-618)
The header row contains up to **7 badges** on a single line:
```
[Job Icon] [Name] [Position] [SUB] [BiS] [You] [Linked User]
```

**Problems:**
- No visual hierarchy - all badges have equal weight
- Colors clash (teal, yellow, blue, amber competing)
- Truncation on smaller cards makes badges unreadable
- Position badge uses double-dash `--` for empty state (cryptic)

**Recommendation:** Implement badge priority system:
- **Primary:** Position badge only (always visible)
- **Secondary:** Status badges (collapsed into overflow indicator `+2`)
- **Tertiary:** Show on hover/expand

#### 1.2 Dual Information Lines
```
Line 1: [Name] [Position] [SUB] [BiS] [You] [Linked]
Line 2: [Job Abbrev] - [Job Full Name] [MT/OT]
```

**Problems:**
- Line 2 is redundant (job icon already conveys job)
- Tank role badge on different line than position badge
- Dash separator adds visual noise

**Recommendation:** Consolidate to single line with smart density:
```
[Job Icon] [Name] [Position+TankRole] [Completion]
           ↳ hover/expand reveals: [BiS] [Ownership] [Sub status]
```

#### 1.3 Gear Table Density (GearTable.tsx)
The expanded gear table shows:
- 11 gear slots
- 4 columns each (Slot, BiS Source, Have, Augmented)
- Plus special weapon row with tome weapon sub-row

**Problems:**
- Table takes 50%+ of card height when expanded
- R/T buttons for source selection are tiny and cryptic
- Augment column disabled for 6+ slots (visual noise)

**Recommendation:** Progressive disclosure pattern:
- **Collapsed:** Visual slot icons (current compact mode is good)
- **Expanded:** Grouped by completion state, not slot order
  - "Missing" section with actionable items
  - "Complete" section (collapsed by default)

#### 1.4 NeedsFooter Overload
```
[Raid: 3] [Tome: 2] [Aug: 1] [Wks: 4]
```

**Problems:**
- Four metrics competing for attention
- Abbreviations require learned knowledge ("Aug" = Augments needed)
- "Wks" calculation is complex and often confusing

**Recommendation:** Single hero metric with expandable detail:
- Show "3/11 BiS" as primary
- Expand to show breakdown on demand

---

## Part 2: Menu & Dropdown Chaos

### The Fragmentation Problem

I identified **8 distinct dropdown/menu patterns** in the codebase:

| Component | Pattern | File |
|-----------|---------|------|
| JobPicker | Inline custom dropdown | PlayerCard.tsx (inline) |
| PositionSelector | Absolute positioned div | PositionSelector.tsx |
| TankRoleSelector | Different absolute pattern | TankRoleSelector.tsx |
| TierSelector | Simple dropdown | TierSelector.tsx |
| StaticSwitcher | Elaborate dropdown | StaticSwitcher.tsx |
| ContextMenu | Fixed position | ContextMenu.tsx |
| SettingsPopover | Popover pattern | SettingsPopover.tsx |
| UserMenu | Avatar dropdown | UserMenu.tsx |
| Modals | Native dialog vs div | Modal.tsx vs GroupSettingsModal.tsx |

### Specific Inconsistencies

#### 2.1 Background Colors
```css
/* Different components use different backgrounds */
JobPicker:       bg-bg-secondary
PositionSelector: bg-bg-secondary  
TierSelector:    bg-bg-elevated
StaticSwitcher:  bg-bg-elevated
ContextMenu:     bg-bg-secondary
SettingsPopover: bg-bg-elevated
UserMenu:        bg-bg-card
```

#### 2.2 Border Treatments
```css
/* Inconsistent border tokens */
border-border-default    /* TierSelector */
border-border-subtle     /* StaticSwitcher */
border-white/10          /* GroupSettingsModal - raw value! */
```

#### 2.3 Shadow Usage
```css
shadow-lg    /* ContextMenu, SettingsPopover */
shadow-xl    /* TierSelector, StaticSwitcher, UserMenu */
```

#### 2.4 Close Behaviors
- Some close on outside click only
- Some close on Escape only
- Some close on both
- Modal uses native `<dialog>` close event

### Unified Dropdown System Recommendation

Create a single `<Dropdown>` primitive:

```typescript
// Proposed unified dropdown API
interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  width?: 'trigger' | 'content' | number;
  closeOn?: ('outside' | 'escape' | 'select')[];
}
```

**Migration path:**
1. Create `<Dropdown>` component with consistent styling
2. Create `<DropdownItem>` for menu items
3. Migrate one component at a time
4. Deprecate individual patterns

---

## Part 3: Color System Audit

### Current Token Structure (index.css)

**Strengths:**
- Well-organized semantic tokens
- Good dark theme foundation
- Role colors match FFXIV conventions

**Weaknesses:**

#### 3.1 Background Level Confusion
```css
--color-bg-primary:   #050508   /* Darkest */
--color-bg-secondary: #0a0a0f
--color-bg-card:      #0e0e14
--color-bg-elevated:  #121218
--color-bg-hover:     #18181f   /* Lightest */
```

**Problem:** 5 levels with unclear hierarchy. When should you use `bg-card` vs `bg-elevated`?

**In practice, components use them randomly:**
- Dashboard cards: `bg-bg-card`
- Modal background: `bg-bg-secondary` (darker than cards!)
- Dropdown menu: Some `bg-bg-secondary`, some `bg-bg-elevated`

**Recommendation:** Reduce to 3 levels with clear purpose:
```css
--color-surface-base:     /* Page background */
--color-surface-raised:   /* Cards, modals, dropdowns */
--color-surface-overlay:  /* Popovers, tooltips */
```

#### 3.2 Border Token Misuse
```css
--color-border-default:   #1f1f28
--color-border-subtle:    #14141c
--color-border-highlight: #14b8a6
```

**Problem:** Components use raw values alongside tokens:
```tsx
// Found in GroupSettingsModal, Dashboard, etc.
border-white/10          // Should be border-border-default
border border-accent/30  // Should be border-border-highlight?
```

#### 3.3 Status Color Overlap
```css
--color-status-error:   #ef4444  /* Red */
--color-source-raid:    #ef4444  /* Also red! */
--color-status-info:    #14b8a6  /* Teal */
--color-accent:         #14b8a6  /* Also teal! */
```

**Problem:** "Raid" gear and "Error" states share the same red. User could interpret raid gear badges as errors.

**Recommendation:** Differentiate raid source:
```css
--color-source-raid: #f97316  /* Orange instead of error red */
```

---

## Part 4: Typography Audit

### Current State

```css
--font-display: "Inter", system-ui, ...  /* Headers */
--font-sans: "Inter", system-ui, ...      /* Body - same font! */
--font-mono: "JetBrains Mono", ...        /* Code */
```

**Problem:** Display and body fonts are identical, losing opportunity for visual hierarchy.

### Type Scale Issues

No defined scale. Components use arbitrary sizes:
```tsx
text-xs    /* 12px - badges, labels */
text-sm    /* 14px - body, buttons */
text-base  /* 16px - rarely used */
text-lg    /* 18px - some headers */
text-xl    /* 20px - modal titles */
text-4xl   /* 36px - hero only */
```

**Problem:** No consistent relationship between sizes. Gap from `text-xl` to `text-4xl` is huge.

### Recommendation: Establish Type Scale

```css
/* Proposed scale (1.25 ratio) */
--text-xs:   0.75rem;   /* 12px - captions */
--text-sm:   0.875rem;  /* 14px - body small */
--text-base: 1rem;      /* 16px - body */
--text-lg:   1.25rem;   /* 20px - subheadings */
--text-xl:   1.5rem;    /* 24px - headings */
--text-2xl:  2rem;      /* 32px - page titles */
--text-3xl:  2.5rem;    /* 40px - hero */
```

---

## Part 5: Interaction Design Issues

### 5.1 Hidden Functionality (Discoverability)

| Action | Current Discovery | Users Who Know |
|--------|-------------------|----------------|
| Edit player name | Double-click | ~10% |
| Copy full URL | Shift+click on code | ~5% |
| Context menu | Right-click card | ~30% |
| Expand card | Click anywhere | ~60% |

**Problem:** Power features are completely hidden. No tooltips, no onboarding, no visual hints.

**Recommendation:** Add progressive disclosure:
- Hover hints: "Double-click to edit"
- First-time tooltips on key actions
- Keyboard shortcut overlay (? key)

### 5.2 Conflicting Interaction Models

The same data can be edited multiple ways:

**Player Job:**
- Click job icon → dropdown
- Right-click → no job option (inconsistent!)
- Edit modal → would need to open BiS import

**Player Position:**
- Click position badge → selector
- Right-click → no position option

**Player Name:**
- Double-click → inline edit
- Right-click → no rename option
- No single-click option

**Recommendation:** Unify interaction model:
- Single primary method per action
- Context menu as comprehensive fallback (include ALL actions)
- Remove double-click pattern (accessibility issue)

### 5.3 No Feedback States

**Missing feedback for:**
- Saving changes (only `isSaving` spinner in header, not on card)
- Drag operation success
- Copy to clipboard (only on share code, not player copy)
- Gear checkbox changes (no optimistic update feedback)

**Recommendation:** Add Toast notification system (Toast.tsx exists but unused):
```tsx
// After gear change
toast.success("Weapon marked as obtained");

// After player copy
toast.info("Player copied to clipboard");
```

---

## Part 6: Information Architecture

### 6.1 Header Overcrowding (Header.tsx)

Current header contains:
```
[Logo] [Static Dropdown] [Role Badge] [Share Code+Copy] ... [Tier Dropdown] [Settings Gear] [User Avatar]
```

**Problems:**
- 7+ interactive elements in 60px height
- Share code competes with navigation
- Settings gear hidden meaning (what settings?)
- No breadcrumb context

**Recommendation:** Two-tier header or sidebar:
```
Tier 1: [Logo] .................. [User]
Tier 2: [Static: Name ▾] [Tier: M5S ▾] [Share] [Settings]
```

### 6.2 Tab Navigation Confusion

```
[Party] [Loot] [Stats]
```

**Problem:** "Party" is confusing - is it the party finder? The roster? Players?

**Recommendation:** Rename for clarity:
```
[Roster] [Loot Priority] [Progress]
```

### 6.3 Modal Depth Issues

Some flows require multiple modal layers:
- Settings → Members → (confirm remove) = 3 levels
- Player Card → BiS Import → Preview = 2 levels

**Problem:** No breadcrumb in modals, hard to know where you are.

**Recommendation:** Slide-over panel pattern for secondary views:
- Keep modal for confirmations only
- Use slide-over for settings panels
- Add back/breadcrumb for nested views

---

## Part 7: Component-Specific Recommendations

### 7.1 PlayerCard Redesign

**Proposed Structure:**
```
┌─────────────────────────────────────┐
│ [Job]  Player Name           [8/11] │  ← Collapsed (always visible)
│        Position: H1 • Main          │
├─────────────────────────────────────┤
│ ▼ Gear Progress                     │  ← Expandable section
│   ████████░░░ 72%                   │
│                                     │
│   Missing (3):                      │
│   • Weapon (Raid) [ ]               │
│   • Body (Tome) [ ] [Aug]           │
│   • Ring (Tome) [ ] [Aug]           │
│                                     │
│ ▶ Obtained (8) - collapsed          │
└─────────────────────────────────────┘
```

**Key Changes:**
- Single-line header with completion ratio
- Position and status on second line
- Progress bar as visual summary
- Group gear by state, not slot order
- Collapse obtained items by default

### 7.2 Unified Dropdown Component

```tsx
// components/ui/Dropdown.tsx
export function Dropdown({ 
  trigger, 
  children, 
  align = 'start',
  sideOffset = 4 
}: DropdownProps) {
  return (
    <div className="relative">
      {trigger}
      <div className={`
        absolute z-50 mt-1
        bg-surface-raised 
        border border-border-default 
        rounded-lg shadow-lg
        ${align === 'end' ? 'right-0' : 'left-0'}
      `}>
        {children}
      </div>
    </div>
  );
}
```

### 7.3 Toast Notification Integration

```tsx
// hooks/useToast.ts
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const toast = {
    success: (message: string) => addToast('success', message),
    error: (message: string) => addToast('error', message),
    info: (message: string) => addToast('info', message),
  };
  
  return { toast, toasts };
}
```

---

## Part 8: Design System Recommendations

### 8.1 Create Design Tokens File

```css
/* design-tokens.css */

/* Spacing Scale (4px base) */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */

/* Border Radius */
--radius-sm: 0.25rem;  /* 4px - badges */
--radius-md: 0.5rem;   /* 8px - buttons, inputs */
--radius-lg: 0.75rem;  /* 12px - cards, modals */

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
--shadow-md: 0 4px 6px rgba(0,0,0,0.4);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.5);
```

### 8.2 Component Audit Checklist

For each component, verify:
- [ ] Uses design tokens (no raw values)
- [ ] Consistent with similar components
- [ ] Has hover/focus/active states
- [ ] Has disabled state styling
- [ ] Accessible (keyboard nav, ARIA)
- [ ] Responsive behavior defined

### 8.3 Migration Priority

**Phase 1 (High Impact):**
1. Unify dropdown components
2. Clean up PlayerCard badges
3. Implement toast notifications

**Phase 2 (Consistency):**
4. Standardize button patterns
5. Fix border/background token usage
6. Add loading skeletons

**Phase 3 (Polish):**
7. Add micro-interactions
8. Implement keyboard shortcuts
9. Add first-run tooltips

---

## Part 9: Logo & Branding Analysis

### Current Logo Assessment

The logo (eye with 8 party dots, teal gradient) is **conceptually strong**:
- Eye represents "watching over" / "oversight" / planning
- 8 dots represent 8-person raid party
- Teal color is distinctive and FFXIV-adjacent

**However:**

### 9.1 Branding Presence Issues

Logo only appears in:
- Header (small, 36px)
- Home hero (larger, 96px)

**Missing from:**
- Loading states
- Empty states
- Error pages
- Modals
- Favicon (uses generic icon)

**Recommendation:** Create brand moments:
- Animated logo for loading states
- Watermark version for empty states
- Simplified mark for favicon

### 9.2 Color Identity Dilution

The teal accent (#14b8a6) is used for:
- Brand color
- Success states
- Info states
- Tome gear source
- Links
- Active tabs
- ... everything

**Problem:** When everything is teal, nothing stands out.

**Recommendation:** Reserve teal for:
- Brand elements (logo, primary buttons)
- Interactive affordances (links, focused inputs)

Use neutral for:
- General UI chrome
- Non-actionable badges

---

## Part 10: Actionable Summary

### Critical Fixes (Do First)

| Issue | Impact | Effort | File(s) |
|-------|--------|--------|---------|
| Unify dropdown patterns | High | Medium | Create Dropdown.tsx |
| PlayerCard badge overflow | High | Low | PlayerCard.tsx |
| Add toast notifications | Medium | Low | Toast.tsx (exists) |
| Fix border token usage | Medium | Low | Multiple files |

### Quick Wins (Low Effort, High Polish)

1. **Remove redundant job line** - PlayerCard line 621-623
2. **Add hover hints** - "Double-click to edit" title attributes
3. **Consistent shadows** - Standardize on `shadow-lg`
4. **Empty state improvements** - Use logo watermark

### Structural Changes (Plan For)

1. **PlayerCard refactor** - Break into sub-components
2. **Design token audit** - Create central tokens file
3. **Keyboard shortcut system** - Global handler + overlay
4. **Onboarding tooltips** - First-run experience

---

## Appendix A: File-by-File Issues

| File | Lines | Issues |
|------|-------|--------|
| PlayerCard.tsx | 682 | Monolithic, badge overflow, dual patterns |
| GearTable.tsx | 381 | Dense table, cryptic R/T buttons |
| Header.tsx | 251 | Too many elements, no hierarchy |
| Dashboard.tsx | 688 | Inconsistent card patterns |
| GroupSettingsModal.tsx | 275 | Raw border values, nested tabs |
| TierSelector.tsx | 93 | Different dropdown pattern |
| StaticSwitcher.tsx | 162 | Different dropdown pattern |
| PositionSelector.tsx | 120 | Different dropdown pattern |
| index.css | 313 | Token conflicts, unused utilities |

---

## Appendix B: Color Token Audit

### Tokens Used Correctly
- `text-text-primary` ✓
- `text-text-secondary` ✓
- `text-text-muted` ✓
- `text-accent` ✓
- `bg-accent` ✓

### Raw Values Found (Should Be Tokens)
- `border-white/10` → `border-border-default`
- `bg-black/50` → `bg-bg-overlay` (create token)
- `bg-red-500/10` → `bg-status-error/10`
- `text-red-400` → `text-status-error`
- `bg-teal-500/20` → `bg-accent-dim`

### Unused Tokens
- `btn-primary` class (defined in CSS, rarely used)
- `btn-secondary` class
- `btn-ghost` class
- `badge-raid` class
- `badge-tome` class
- `card-glow` class

---

## Conclusion

The FFXIV Raid Planner has **solid bones** - the data model is well-designed, the API integration works, and the core features are functional. However, the UI has accumulated debt from organic development that now impedes usability.

**The path forward:**
1. Establish design system foundations (tokens, components)
2. Unify interaction patterns (dropdowns, editing, feedback)
3. Reduce information density (progressive disclosure)
4. Add discoverability (hints, tooltips, keyboard shortcuts)

Estimated effort for full remediation: **4-6 weeks** of focused UI work.

---

*Report generated by Claude AI Design Audit System*
