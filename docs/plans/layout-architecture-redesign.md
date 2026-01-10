# Layout Architecture Redesign for Ultrawide UX

**Created:** January 10, 2026
**Branch:** `feature/design-system-migration`
**Issue:** Ultrawide monitor (3440x1440) layout stretching and container inconsistency

---

## Problem Statement

On ultrawide monitors (3440x1440), the UI appears stretched and inconsistent:
- **GroupView.tsx has NO max-width constraint** - content stretches infinitely
- **Inconsistent container widths** across pages (4xl, 6xl, 7xl, 80rem, 120rem)
- **Missing CSS breakpoints** for grid-5xl and grid-6xl classes
- **No unified container language** - each page implements its own pattern
- **Header width (120rem) doesn't match data page needs**

---

## Current State Audit

| Page | Current Max-Width | Pixel Value | Issue |
|------|-------------------|-------------|-------|
| **Layout.tsx** | None (delegates) | Full width | No global constraint |
| **Header.tsx** | `max-w-[120rem]` | 1920px | Too narrow for data pages |
| **GroupView.tsx** | **NONE** | Infinite | **CRITICAL** - stretches to viewport |
| **Dashboard.tsx** | `max-w-6xl` | 1152px | Appropriate for card grid |
| **AdminDashboard.tsx** | `max-w-7xl` | 1280px | Could be wider |
| **Home.tsx** | `max-w-4xl` | 896px | Appropriate for landing |
| **Docs (with sidebar)** | `max-w-[120rem]` | 1920px | Consistent |
| **Docs (simple)** | `max-w-[80rem]` | 1280px | Consistent |

**Grid Classes Issue:**
```css
/* GroupView.tsx uses these classes: */
grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 grid-4xl grid-5xl grid-6xl

/* But only grid-4xl is defined in index.css! */
/* grid-5xl and grid-6xl DO NOT EXIST - they do nothing */
```

---

## Solution: 5-Tier Container System

### Container Tiers

| Tier | Class | Width | Purpose | Use Cases |
|------|-------|-------|---------|-----------|
| **Data** | `max-w-[160rem]` | 2560px | Data-dense, grid content | GroupView, data tables |
| **Wide** | `max-w-[120rem]` | 1920px | Documentation with sidebar | API Docs, Guides, DesignSystem |
| **Focus** | `max-w-[80rem]` | 1280px | Focused content, simple docs | ReleaseNotes, DocsIndex |
| **Narrow** | `max-w-6xl` | 1152px | Card grids, dashboards | Dashboard, AdminDashboard |
| **Compact** | `max-w-4xl` | 896px | Marketing, landing pages | Home page |

### Design Principles

1. **Header matches widest content** - Use Data tier (160rem) for header
2. **Consistent centering** - All containers use `mx-auto`
3. **Responsive padding** - `px-4 sm:px-6 lg:px-8`
4. **Content type determines tier** - Not arbitrary choices

---

## Implementation Plan

### Phase 1: Critical Fix - GroupView (HIGH PRIORITY)

**Goal:** Fix the infinite stretch on ultrawide monitors

**1.1 Add missing CSS grid breakpoints to `index.css`:**
```css
/* After existing grid-4xl definition */

/* 5-column grid at 1600px */
@media (min-width: 1600px) {
  .grid-5xl {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

/* 6-column grid at 2000px */
@media (min-width: 2000px) {
  .grid-6xl {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
```

**1.2 Wrap GroupView content with Data tier container:**
```tsx
// GroupView.tsx - wrap the main content return
return (
  <div className="max-w-[160rem] mx-auto">
    {/* All existing content */}
  </div>
);
```

**Files Modified:**
- `frontend/src/index.css` (add grid breakpoints)
- `frontend/src/pages/GroupView.tsx` (add container wrapper)

---

### Phase 2: Create PageContainer Component

**Goal:** Provide consistent container patterns for all pages

**2.1 Create new component:**
```tsx
// frontend/src/components/layout/PageContainer.tsx

type ContainerVariant = 'data' | 'wide' | 'focus' | 'narrow' | 'compact';

interface PageContainerProps {
  variant?: ContainerVariant;
  className?: string;
  children: React.ReactNode;
}

const CONTAINER_CLASSES: Record<ContainerVariant, string> = {
  data: 'max-w-[160rem]',    // 2560px - GroupView, data grids
  wide: 'max-w-[120rem]',    // 1920px - Docs with sidebar
  focus: 'max-w-[80rem]',    // 1280px - Simple docs
  narrow: 'max-w-6xl',       // 1152px - Dashboard
  compact: 'max-w-4xl',      // 896px - Home page
};

export function PageContainer({
  variant = 'wide',
  className = '',
  children
}: PageContainerProps) {
  return (
    <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${CONTAINER_CLASSES[variant]} ${className}`}>
      {children}
    </div>
  );
}
```

**2.2 Export from layout index:**
```tsx
// frontend/src/components/layout/index.ts
export { PageContainer } from './PageContainer';
```

**Files Modified:**
- `frontend/src/components/layout/PageContainer.tsx` (new file)
- `frontend/src/components/layout/index.ts` (export)

---

### Phase 3: Align Header with Data Tier

**Goal:** Header should match the widest content page

**3.1 Update Header.tsx:**
```tsx
// Change from:
<div className="max-w-[120rem] mx-auto px-4 py-2 ...">

// To:
<div className="max-w-[160rem] mx-auto px-4 py-2 ...">
```

**3.2 Update ReleaseBanner.tsx and ViewAsBanner.tsx to match**

**Files Modified:**
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/ReleaseBanner.tsx`
- `frontend/src/components/admin/ViewAsBanner.tsx`

---

### Phase 4: Migrate Pages to PageContainer (Optional)

**Goal:** Replace inline container patterns with component usage

| Page | Current Pattern | New Pattern |
|------|-----------------|-------------|
| GroupView | Manual `max-w-[160rem]` | `<PageContainer variant="data">` |
| Dashboard | `max-w-6xl mx-auto` | `<PageContainer variant="narrow">` |
| AdminDashboard | `max-w-7xl mx-auto` | `<PageContainer variant="narrow">` |
| Home | `max-w-4xl mx-auto` | `<PageContainer variant="compact">` |
| Docs (sidebar) | `max-w-[120rem] mx-auto` | `<PageContainer variant="wide">` |
| Docs (simple) | `max-w-[80rem] mx-auto` | `<PageContainer variant="focus">` |

**Priority:** Low - existing inline patterns work, component is optional sugar

---

### Phase 5: Documentation

**Goal:** Update DesignSystem.tsx to document the container system

**5.1 Add Container section to DesignSystem page showing:**
- All 5 container tiers with visual examples
- When to use each tier
- Grid scaling behavior at different breakpoints

**5.2 Update CLAUDE.md with container guidelines**

---

## Player Card Grid Behavior on Ultrawide

With `max-w-[160rem]` (2560px) and proper grid breakpoints:

| Viewport | Container | Grid Cols | Card Width | UX |
|----------|-----------|-----------|------------|-----|
| < 640px | 100% | 1 | Full | Mobile |
| 640-1023px | 100% | 2 | ~300px | Tablet |
| 1024-1399px | 100% | 3 | ~320px | Desktop |
| 1400-1599px | 100% | 4 | ~340px | Wide |
| 1600-1999px | 100% | 5 | ~320px | Ultrawide |
| 2000-2560px | 100% | 6 | ~400px | Max ultrawide |
| 3440px+ | 2560px | 6 | ~400px | **Constrained** |

The 2560px max-width prevents cards from exceeding ~400px width even on 3440px displays.

---

## Files to Modify

### Critical (Phase 1)
- `frontend/src/index.css` - Add grid-5xl, grid-6xl breakpoints
- `frontend/src/pages/GroupView.tsx` - Add max-w-[160rem] container

### Component (Phase 2)
- `frontend/src/components/layout/PageContainer.tsx` - New component
- `frontend/src/components/layout/index.ts` - Export

### Header Alignment (Phase 3)
- `frontend/src/components/layout/Header.tsx` - Update to 160rem
- `frontend/src/components/layout/ReleaseBanner.tsx` - Match header
- `frontend/src/components/admin/ViewAsBanner.tsx` - Match header

### Documentation (Phase 5)
- `frontend/src/pages/DesignSystem.tsx` - Document container system
- `CLAUDE.md` - Add container guidelines

---

## Verification

```bash
# After implementation, verify:
pnpm tsc --noEmit           # No type errors
pnpm lint                   # No lint errors
pnpm test                   # All tests pass

# Visual verification on ultrawide:
# 1. GroupView should NOT stretch beyond 2560px
# 2. Player cards should show 6 columns max on ultrawide
# 3. Header should align with content width
# 4. All pages should feel visually consistent
```

---

## Success Criteria

1. **GroupView constrained** - Max 2560px width on any monitor
2. **Grid scales properly** - 6 columns at 2000px+, not stretched
3. **Header aligned** - Matches data page width
4. **Consistent container language** - 5 clear tiers with defined purposes
5. **PageContainer available** - Optional component for future use
6. **Documented** - DesignSystem page explains the system
