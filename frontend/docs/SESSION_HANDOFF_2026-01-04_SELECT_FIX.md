# Session Handoff - 2026-01-04 (Radix Select & WCAG Fixes)

## Branch
`docs/design-system-v2`

## Last Commit
`aec35db` - Fix Radix Select scroll-lock breaking sticky nav, hide unused gear badges

## Completed This Session

### Radix UI Select Component
- Replaced native `<select>` with `@radix-ui/react-select` for WCAG-compliant styling
- Highlighted options now show teal background with dark text (`text-accent-contrast`)
- Added `modal={false}` to disable focus trapping
- Removed Portal wrapper to render inline (avoids some scroll-lock issues)

### Scroll-Lock Fix (Critical)
Radix's scroll-lock was breaking the sticky navigation panel when Select opened. The fix required:

1. **CSS Tokens Added** (`index.css`):
   - `--color-accent-hover: #2dd4bf`
   - `--color-accent-contrast: #052e2b`

2. **CSS Overrides** (`index.css`):
   - `overflow-y: scroll !important` on html
   - `position: static !important` on body
   - `[data-radix-focus-guard]` hidden
   - `[aria-hidden="true"]` kept visible

3. **usePreventScrollLock Hook** (`Select.tsx`):
   - MutationObserver watches body for Radix's style changes
   - Overrides `position`, `overflow`, `pointer-events` on body
   - Removes `aria-hidden` attributes from sibling elements
   - This was the key fix - CSS alone wasn't enough because Radix injects styles AFTER the stylesheet

### Design System Page Updates
- Tooltips section: buttons stacked vertically (Top, Left, Right, Bottom)
- Nav sidebar: added `z-40` for proper stacking
- Gear Source badges: hidden unused categories (catchup, relic, prep, normal, unknown)
- Kept only: Savage, Aug. Tome, Tomestone, Crafted

## Key Files Modified

| File | Changes |
|------|---------|
| `src/components/ui/Select.tsx` | Radix UI Select with usePreventScrollLock hook |
| `src/index.css` | WCAG tokens, scroll-lock CSS overrides |
| `src/pages/DesignSystem.tsx` | Tooltips layout, nav z-index, gear badges filtered |
| `package.json` | Added `@radix-ui/react-select` |

## Known Issues

### Compact Gear Badges Appear White
The compact badges (second row in Gear Source Colors) have white backgrounds instead of colored. This is likely a styling issue in `GearSourceBadge.tsx` with the `compact` prop. Currently hidden by filtering to only 4 badge types.

## Technical Notes

### Why usePreventScrollLock Was Needed
Radix injects a `<style>` tag dynamically when Select opens:
```css
body[data-scroll-locked] {
  position: relative !important;
  overflow: hidden !important;
}
```

This comes AFTER the stylesheet, so CSS-only `!important` overrides don't work (same specificity, later source wins). The MutationObserver approach directly manipulates the body element's style property after Radix sets it.

### Debug Flag
`Select.tsx` has `DEBUG_KEEP_OPEN` constant (currently `false`). Set to `true` to keep dropdown open for DevTools inspection.

## Commands to Resume

```bash
cd /home/serapis/projects/ffxiv-raid-planner/frontend
git status  # Should be clean
pnpm dev    # Start dev server
```

## What's Next

1. **Merge to main** - This branch has documentation and UX improvements ready
2. **Fix compact badge styling** - If needed, update GearSourceBadge component
3. **Continue WCAG audit** - Other components may need similar contrast fixes
