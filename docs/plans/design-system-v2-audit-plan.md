# Design System V2 Comprehensive Audit & Implementation Plan

**Created:** January 9, 2026
**Branch:** `feature/design-system-migration`
**Scope:** Issue #7 (Page Layout Consistency) + Issue #9 (Comprehensive Design System Audit)

---

## Executive Summary

This plan addresses the two remaining design system migration tasks:
1. **Issue #7**: Ensure all pages follow the design system's layout zone patterns (Header/Toolbar/Content)
2. **Issue #9**: Comprehensive audit of ALL UI elements for design system compliance

**Approach:** Bold improvements with enhanced visual polish across ALL pages equally.

**Key Decisions:**
- ✅ Bold design improvements (not just consistency fixes)
- ✅ All pages audited with equal priority
- ✅ New semantic color tokens for membership roles

The goal is to create a cohesive, beautiful, and user-friendly UI with consistent visual language across the entire application.

---

## Bold Improvements Planned

### New Semantic Color Tokens

Add membership role tokens to `index.css`:

```css
/* MEMBERSHIP ROLE COLORS */
--color-membership-owner: #14b8a6;     /* Teal - same as accent */
--color-membership-lead: #a855f7;      /* Purple */
--color-membership-member: #3b82f6;    /* Blue */
--color-membership-viewer: #71717a;    /* Zinc */
--color-membership-linked: #f59e0b;    /* Amber */
```

### Enhanced Visual Patterns

1. **Card Elevation System**
   - Add subtle gradient overlays for depth
   - Improve border visibility without harshness
   - Add hover glow effects consistently

2. **Focus States**
   - Consistent focus ring colors using `accent`
   - Visible but not jarring focus indicators
   - Keyboard navigation visual feedback

3. **Interactive Feedback**
   - Micro-animations on buttons (scale on press)
   - Toast notifications with entrance animations
   - Loading states with skeleton shimmer

4. **Typography Refinements**
   - Clearer heading hierarchy
   - Improved line-height for readability
   - Better font-weight distribution

5. **Color Harmony**
   - Review all color combinations for visual balance
   - Ensure sufficient contrast in all states
   - Standardize opacity values (10%, 20%, 30%, 50%)

---

## Phase 1: Design System Foundation Audit

### 1.1 Review & Enhance Design Tokens

**Files to audit:**
- `frontend/src/index.css` - Theme variables
- `frontend/src/pages/DesignSystem.tsx` - Reference page

**Tasks:**
- [ ] Audit color palette for visual harmony and accessibility (WCAG 2.1 AA)
- [ ] Review surface hierarchy progression (base → raised → card → elevated → overlay)
- [ ] Validate accent color usage consistency
- [ ] Check role colors meet contrast requirements
- [ ] Ensure status colors are semantically correct
- [ ] Review typography scale for hierarchy clarity
- [ ] Audit spacing scale for consistency

**Color Palette Improvements to Consider:**
- Border colors may need subtle adjustments for better visual definition
- Status colors should have consistent opacity patterns for backgrounds
- Consider adding a "surface-focus" for focused card states

### 1.2 Component Library Completeness Check

**Files to audit:**
- All files in `frontend/src/components/primitives/`
- All files in `frontend/src/components/ui/`

**Component Audit Checklist:**

| Component | Variants | States | A11y | Notes |
|-----------|----------|--------|------|-------|
| Button | primary, secondary, ghost, danger | hover, focus, disabled | ✓ | Check whitespace-nowrap |
| Badge | default, outline, solid | - | ✓ | Review color variants |
| IconButton | primary, secondary, ghost, danger | hover, focus, disabled | ✓ | Check sizes |
| Input | default, error | focus, disabled | ✓ | Check fullWidth prop |
| Select | default, error | focus, disabled | ✓ | Check dropdown styling |
| Checkbox | default | checked, indeterminate | ✓ | Verify accent color |
| Modal | sm, md, lg, xl, 2xl, 3xl, 4xl | - | ✓ | Check max-width variants |
| Tooltip | - | - | ✓ | Verify positioning |
| RadioGroup | - | - | ✓ | New component |
| NumberInput | - | - | ✓ | New component |

---

## Phase 2: Page Layout Consistency (Issue #7)

### 2.1 Layout Zone Architecture

The design system defines three layout zones for data pages:

```
┌─────────────────────────────────────────────────────┐
│ HEADER ZONE                                          │
│ [Logo] [Static Switcher ▾] [Tabs: Players|Loot|...]  │
├─────────────────────────────────────────────────────┤
│ TOOLBAR ZONE                                         │
│ [Floor Filter] [Sort] [View Mode] [Actions]          │
├─────────────────────────────────────────────────────┤
│                                                      │
│ CONTENT ZONE                                         │
│ (Full-width responsive grid)                         │
│                                                      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 2.2 Page-by-Page Layout Audit

| Page | Type | Current State | Target Pattern | Priority |
|------|------|---------------|----------------|----------|
| GroupView.tsx | Data Grid | Partial | 3-zone data layout | HIGH |
| Dashboard.tsx | Data Grid | Partial | 3-zone data layout | HIGH |
| Home.tsx | Landing | Good | Landing (max-w-80rem) | MEDIUM |
| AdminDashboard.tsx | Data Grid | Unknown | 3-zone data layout | MEDIUM |
| DesignSystem.tsx | Documentation | Good | Doc layout w/sidebar | LOW |
| ReleaseNotes.tsx | Documentation | Good | Doc layout w/sidebar | LOW |
| DocsIndex.tsx | Landing | Unknown | Landing (max-w-80rem) | LOW |
| MembersGuideDocs.tsx | Documentation | Unknown | Doc layout w/sidebar | LOW |
| LeadsGuideDocs.tsx | Documentation | Unknown | Doc layout w/sidebar | LOW |
| QuickStartDocs.tsx | Documentation | Unknown | Doc layout w/sidebar | LOW |
| LootMathDocs.tsx | Documentation | Unknown | Doc layout w/sidebar | LOW |
| ApiDocs.tsx | Documentation | Unknown | Doc layout w/sidebar | LOW |
| ApiCookbook.tsx | Documentation | Unknown | Doc layout w/sidebar | LOW |
| RoadmapDocs.tsx | Documentation | Unknown | Doc layout w/sidebar | LOW |
| CommonTasksDocs.tsx | Documentation | Unknown | Doc layout w/sidebar | LOW |
| AuthCallback.tsx | Utility | N/A | Minimal | N/A |
| InviteAccept.tsx | Form | Unknown | Form (max-w-2xl) | LOW |

### 2.3 Layout Implementation Tasks

**For Data Pages (GroupView, Dashboard, AdminDashboard):**
- [ ] Verify Header zone contains: logo, static switcher, main tabs, user menu
- [ ] Ensure Toolbar zone contains: contextual controls (floor filter, sort, view mode)
- [ ] Verify Content zone has: full-width responsive grid with proper background
- [ ] Check outer background is `#020203` or `surface-base`
- [ ] Ensure consistent padding and max-width (`max-w-[160rem]`)

**For Documentation Pages:**
- [ ] Verify consistent sidebar structure
- [ ] Check sticky navigation behavior
- [ ] Ensure proper content width (`max-w-[120rem]`)
- [ ] Verify breadcrumb pattern consistency

**For Landing Pages:**
- [ ] Verify hero pattern consistency
- [ ] Check CTA button styling
- [ ] Ensure proper width constraints (`max-w-[80rem]`)

---

## Phase 3: Component Usage Audit (Issue #9)

### 3.1 Raw HTML Violations to Fix

From `check-design-system.sh` output:

| File | Line | Issue | Fix |
|------|------|-------|-----|
| InvitationsPanel.tsx | 123 | Raw `<button>` | Use `Button` |
| TierSelector.tsx | 51 | Raw `<button>` | Use `Button` or `IconButton` |
| StaticSwitcher.tsx | 63 | Raw `<button>` | Likely intentional (Radix trigger) |
| SectionedLogView.tsx | 777 | Raw `<button>` | Evaluate if `Button` appropriate |
| WeaponPriorityListItem.tsx | 100 | Raw `<label>` | Use `Label` |
| WeaponPriorityGrid.tsx | 116 | Raw `<label>` | Use `Label` |
| InlinePlayerEdit.tsx | 269 | Raw `<label>` | Use `Label` |

### 3.2 File-by-File Component Audit

**Priority Order:**
1. **HIGH** - User-facing pages (GroupView, Dashboard, Home)
2. **MEDIUM** - Modal components, forms
3. **LOW** - Admin pages, utility components

**Audit Checklist per File:**
- [ ] All buttons use `Button` or `IconButton` component
- [ ] All inputs use `Input`, `TextArea`, or `Select` component
- [ ] All checkboxes use `Checkbox` or `ThreeStateCheckbox`
- [ ] All labels use `Label` component
- [ ] All modals use `Modal` component with proper sizing
- [ ] All badges use `Badge` component with correct variant
- [ ] Color tokens used (no hardcoded hex colors like `#14b8a6`)
- [ ] Spacing consistent (use Tailwind scale, not arbitrary values)
- [ ] Typography follows hierarchy (text-primary, text-secondary, text-muted)

### 3.3 Components Directory Audit

**frontend/src/components/player/**
- [ ] PlayerCard.tsx
- [ ] PlayerCardHeader.tsx
- [ ] GearTable.tsx
- [ ] BiSImportModal.tsx
- [ ] AddPlayerModal.tsx
- [ ] InlinePlayerEdit.tsx
- [ ] GearSourceBadge.tsx
- [ ] DroppablePlayerCard.tsx
- [ ] DragOverlayCard.tsx
- [ ] EmptySlotCard.tsx

**frontend/src/components/loot/**
- [ ] LootPriorityPanel.tsx
- [ ] FloorSelector.tsx
- [ ] QuickLogDropModal.tsx
- [ ] QuickLogMaterialModal.tsx
- [ ] QuickLogWeaponModal.tsx

**frontend/src/components/history/**
- [ ] HistoryView.tsx
- [ ] SectionedLogView.tsx
- [ ] WeeklyLootGrid.tsx
- [ ] AddLootEntryModal.tsx
- [ ] EditBookBalanceModal.tsx
- [ ] LogMaterialModal.tsx
- [ ] MarkFloorClearedModal.tsx
- [ ] DeleteLootConfirmModal.tsx
- [ ] PageBalancesPanel.tsx
- [ ] LootLogPanel.tsx

**frontend/src/components/static-group/**
- [ ] StaticSwitcher.tsx
- [ ] TierSelector.tsx
- [ ] GroupSettingsModal.tsx
- [ ] CreateTierModal.tsx
- [ ] DeleteTierModal.tsx
- [ ] RolloverDialog.tsx
- [ ] InvitationsPanel.tsx

**frontend/src/components/weapon-priority/**
- [ ] WeaponPriorityModal.tsx
- [ ] WeaponPriorityEditor.tsx
- [ ] WeaponPriorityGrid.tsx
- [ ] WeaponPriorityListItem.tsx

**frontend/src/components/team/**
- [ ] TeamSummaryEnhanced.tsx

**frontend/src/components/auth/**
- [ ] LoginButton.tsx
- [ ] UserMenu.tsx

**frontend/src/components/layout/**
- [ ] Header.tsx
- [ ] PageLoader.tsx
- [ ] ReleaseBanner.tsx

---

## Phase 4: Visual Polish & Enhancements

### 4.1 Design System Page Improvements

- [ ] Add interactive examples for all components
- [ ] Include copy-to-clipboard for code snippets
- [ ] Add dark/light preview for color swatches
- [ ] Include responsive preview for layouts
- [ ] Add animation/transition examples

### 4.2 Color Harmony Improvements

**Current Issues to Address:**
- Role badge colors in Home.tsx and Dashboard.tsx use hardcoded Tailwind colors instead of semantic tokens
- Some components use raw `teal-500/20` instead of `accent/20`

**Standardization:**
```css
/* Replace hardcoded role badge colors with semantic tokens */
owner: 'bg-accent/20 text-accent border-accent/30'
lead: 'bg-purple-500/20 text-purple-400 border-purple-500/30' → define --color-role-lead
member: 'bg-blue-500/20 text-blue-400 border-blue-500/30' → define --color-role-member
viewer: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' → define --color-role-viewer
```

### 4.3 Animation & Micro-interactions

- [ ] Consistent hover transitions (150ms ease)
- [ ] Focus ring animations
- [ ] Modal enter/exit animations
- [ ] Toast slide-in animations
- [ ] Loading skeleton shimmer effect

---

## Phase 5: Testing & Validation

### 5.1 Visual Regression Testing

- [ ] Screenshot key pages at different breakpoints
- [ ] Compare before/after for each phase
- [ ] Document any intentional visual changes

### 5.2 Accessibility Validation

- [ ] Run axe-core on all pages
- [ ] Verify keyboard navigation
- [ ] Test screen reader compatibility
- [ ] Check color contrast ratios

### 5.3 Cross-Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

---

## Implementation Strategy

### Session 1: Foundation & Tokens
**Goal:** Establish the design system foundation and new tokens

1. Add new semantic tokens to `index.css`:
   - Membership role colors (owner, lead, member, viewer, linked)
   - Review and enhance existing tokens
2. Update `DesignSystem.tsx` to showcase new tokens
3. Fix all 7 raw HTML violations from compliance check
4. Update `ROLE_COLORS` constants in Home.tsx and Dashboard.tsx to use new tokens

**Files Modified:**
- `frontend/src/index.css`
- `frontend/src/pages/DesignSystem.tsx`
- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/components/static-group/InvitationsPanel.tsx`
- `frontend/src/components/static-group/TierSelector.tsx`
- `frontend/src/components/history/SectionedLogView.tsx`
- `frontend/src/components/weapon-priority/WeaponPriorityListItem.tsx`
- `frontend/src/components/weapon-priority/WeaponPriorityGrid.tsx`
- `frontend/src/components/player/InlinePlayerEdit.tsx`

### Session 2: Data Page Layouts
**Goal:** Ensure GroupView, Dashboard, AdminDashboard follow 3-zone layout

1. Audit GroupView.tsx for Header/Toolbar/Content zone compliance
2. Audit Dashboard.tsx layout and max-width constraints
3. Audit AdminDashboard.tsx layout
4. Standardize outer background colors (#020203)
5. Ensure consistent padding and responsive behavior

**Files Modified:**
- `frontend/src/pages/GroupView.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/AdminDashboard.tsx`

### Session 3: Landing & Documentation Pages
**Goal:** Audit and polish all remaining pages

1. Home.tsx - Landing pattern (max-w-80rem, hero, CTA)
2. DocsIndex.tsx - Landing pattern
3. DesignSystem.tsx - Documentation pattern (sidebar, max-w-120rem)
4. ReleaseNotes.tsx - Documentation pattern
5. All Guide pages (Members, Leads, QuickStart, etc.)
6. InviteAccept.tsx - Form pattern (max-w-2xl)

**Files Modified:**
- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/DocsIndex.tsx`
- `frontend/src/pages/ReleaseNotes.tsx`
- `frontend/src/pages/MembersGuideDocs.tsx`
- `frontend/src/pages/LeadsGuideDocs.tsx`
- `frontend/src/pages/QuickStartDocs.tsx`
- `frontend/src/pages/LootMathDocs.tsx`
- `frontend/src/pages/ApiDocs.tsx`
- `frontend/src/pages/ApiCookbook.tsx`
- `frontend/src/pages/RoadmapDocs.tsx`
- `frontend/src/pages/CommonTasksDocs.tsx`
- `frontend/src/pages/InviteAccept.tsx`

### Session 4: Component Library Audit
**Goal:** Full audit of all component directories

1. Audit `components/player/` (10 files)
2. Audit `components/loot/` (5 files)
3. Audit `components/history/` (10 files)
4. Audit `components/static-group/` (7 files)
5. Audit `components/weapon-priority/` (4 files)
6. Audit `components/team/` (1 file)
7. Audit `components/auth/` (2 files)
8. Audit `components/layout/` (3 files)

**Focus Areas:**
- Color token consistency
- Spacing consistency
- Typography hierarchy
- Component usage (Button, Input, Label, etc.)

### Session 5: Visual Polish & Final Validation
**Goal:** Final polish pass and testing

1. Add micro-animations and transitions
2. Review all hover/focus states
3. Run full accessibility audit (axe-core)
4. Cross-browser testing
5. Update DesignSystem.tsx with any new patterns
6. Update CLAUDE.md documentation
7. Run all tests and fix any issues

**Verification Steps:**
```bash
./frontend/scripts/check-design-system.sh  # Should show 0 violations
cd frontend && pnpm tsc --noEmit           # No type errors
cd frontend && pnpm lint                    # No lint errors
cd frontend && pnpm test                    # All tests pass
./dev.sh                                    # Visual verification
```

---

## Key Files Reference

| Purpose | Path |
|---------|------|
| Theme Variables | `frontend/src/index.css` |
| Design System Page | `frontend/src/pages/DesignSystem.tsx` |
| Button Component | `frontend/src/components/primitives/Button.tsx` |
| All UI Components | `frontend/src/components/ui/` |
| All Primitives | `frontend/src/components/primitives/` |
| Compliance Script | `frontend/scripts/check-design-system.sh` |

---

## Verification Commands

```bash
# Run design system compliance check
./frontend/scripts/check-design-system.sh

# Type check
cd frontend && pnpm tsc --noEmit

# Lint check
cd frontend && pnpm lint

# Run tests
cd frontend && pnpm test

# Start dev servers
./dev.sh

# View design system reference
# Navigate to http://localhost:5173/design-system
```

---

## Success Criteria

1. **Zero violations** from `check-design-system.sh` (except documented intentional exceptions)
2. **All pages** follow appropriate layout pattern from design system
3. **All components** use design system tokens (no hardcoded colors)
4. **Consistent spacing** using Tailwind scale
5. **Consistent typography** hierarchy
6. **WCAG 2.1 AA** color contrast compliance
7. **Documentation** updated to reflect changes

---

## Notes

- Some raw `<button>` elements are intentional (Radix triggers)
- Preserve existing functionality while improving consistency
- Test thoroughly after each phase to catch regressions
- Update CLAUDE.md with any new patterns discovered
