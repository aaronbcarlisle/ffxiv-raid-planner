# Session 5: Frontend Accessibility - Radix Fixes

**Duration:** 4-6 hours
**Issues:** P1-SEC-005, P1-SEC-006
**Priority:** HIGH

---

## Pre-Session Checklist

- [ ] Frontend dependencies installed
- [ ] All tests passing (`pnpm test`)
- [ ] Clean git status
- [ ] Screen reader available for testing (optional but recommended)

---

## Prompt for Claude Code

```
I need to fix accessibility issues related to Radix UI components. There are two related problems that should be fixed together.

## Background

The codebase has hacky workarounds for Radix UI scroll-lock behavior:
1. Global CSS that forces aria-hidden elements visible
2. MutationObserver in Select component that removes aria-hidden attributes

These hacks break screen reader accessibility and modal semantics. We need to fix the root cause.

## Issue 1: Remove Global Aria-Hidden Override CSS (P1-SEC-005)

**Location:** `frontend/src/index.css` (around line 216-221)

**Current state:**
```css
[data-aria-hidden="true"],
[aria-hidden="true"]:not([role="presentation"]):not(.sr-only) {
  visibility: visible !important;
  display: revert !important;
}
```

**Problem:** This defeats the purpose of aria-hidden, breaking screen reader UX.

**Step 1:** Simply delete this CSS block.

**Warning:** After deleting this, some UI might break (scroll lock, element hiding). That's expected - we'll fix the root cause in Issue 2.

---

## Issue 2: Fix Select Component MutationObserver Hacks (P1-SEC-006)

**Location:** `frontend/src/components/ui/Select.tsx`

**Current state:** The component uses MutationObserver and custom scroll-lock prevention hooks to work around Radix behavior.

**Goal:** Remove these hacks and use Radix properly with Portal.

**Investigation steps:**
1. First, read the current Select.tsx implementation
2. Identify all the workaround code:
   - `usePreventScrollLock` hook usage
   - MutationObserver that removes aria-hidden
   - Any direct DOM manipulation
3. Check what version of Radix Select is being used

**Fix approach:**

Option A (Preferred): Use Portal properly
```tsx
<SelectPrimitive.Portal>
  <SelectPrimitive.Content
    position="popper"
    sideOffset={4}
    align="start"
    className="..."
  >
    <SelectPrimitive.Viewport>
      {children}
    </SelectPrimitive.Viewport>
  </SelectPrimitive.Content>
</SelectPrimitive.Portal>
```

Option B: If Portal causes issues, use modal={false}
```tsx
<SelectPrimitive.Content
  position="popper"
  sideOffset={4}
  modal={false}  // Disables scroll lock and focus trap
>
```

**Things to remove:**
- `usePreventScrollLock` hook (if it exists)
- MutationObserver setup in useEffect
- Any code that removes aria-hidden attributes
- Any code that manipulates body scroll/overflow

**Testing requirements:**
1. Test all Select components in the app:
   - Job picker in player cards
   - Floor selector in loot tab
   - Week selector in history tab
   - Any other dropdowns
2. Verify:
   - Dropdown opens and closes correctly
   - Keyboard navigation works (arrow keys, Enter, Escape)
   - Selection updates correctly
   - Page doesn't scroll unexpectedly
   - No accessibility warnings in browser console

---

## After Both Fixes

1. Run frontend tests: `pnpm test`
2. Run lint: `pnpm lint`
3. Build: `pnpm build`
4. Manual test all Select components
5. Optional: Test with screen reader

Commit: "fix(a11y): remove Radix workarounds, use proper Portal/modal patterns"
```

---

## Expected Outcomes

### Files Modified
- `frontend/src/index.css` (remove CSS hack)
- `frontend/src/components/ui/Select.tsx` (remove JS hacks)
- Possibly `frontend/src/hooks/usePreventScrollLock.ts` (delete if exists)

### Tests to Run
```bash
pnpm test
pnpm lint
pnpm build
```

### Manual Testing Checklist

| Component | Location | Test |
|-----------|----------|------|
| JobPicker | Player cards | Open, select, close |
| FloorSelector | Loot tab | Open, select, close |
| WeekSelector | Log tab | Open, select, close |
| Position selector | Player setup | Open, select, close |

For each:
- [ ] Opens on click
- [ ] Closes on Escape
- [ ] Arrow keys navigate options
- [ ] Enter selects highlighted option
- [ ] Click outside closes dropdown
- [ ] Selected value updates correctly
- [ ] No page scroll issues

---

## Troubleshooting

### Dropdown appears behind other elements
Add z-index to Portal content:
```css
.select-content {
  z-index: 50;
}
```

### Dropdown position is wrong
Check `position="popper"` and `sideOffset` props.

### Focus gets lost
Ensure Portal is used, not removed.

### Scroll lock still happening
Check for any remaining body scroll manipulation code.

---

## Rollback Plan

```bash
git checkout frontend/src/index.css frontend/src/components/ui/Select.tsx
```

---

## Commit Message

```
fix(a11y): remove Radix workarounds, use proper Portal/modal patterns

- Remove global CSS that forced aria-hidden elements visible
- Remove MutationObserver that stripped aria-hidden attributes
- Remove usePreventScrollLock workaround
- Use Radix Select Portal properly

This restores proper accessibility semantics for screen readers
and fixes modal overlay behavior.

Addresses: P1-SEC-005, P1-SEC-006
```
