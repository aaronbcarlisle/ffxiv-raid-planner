# UI Component Inventory

**IMPORTANT:** Before implementing ANY new UI, search this document for existing components. Reuse is mandatory.

This document lists all reusable UI components in the FFXIV Raid Planner project. Components are organized by category with usage examples and key props.

## Quick Reference

| Need | Component | Path |
|------|-----------|------|
| Button | `Button` | `components/primitives/Button.tsx` |
| Icon-only button | `IconButton` | `components/primitives/IconButton.tsx` |
| Job selector | `JobPicker` | `components/player/JobPicker.tsx` |
| Position selector (T1-R2) | `PositionSelector` | `components/player/PositionSelector.tsx` |
| Tank role (MT/OT) | `TankRoleSelector` | `components/player/TankRoleSelector.tsx` |
| Tank role + position, merged (V2 roster card) | `TankSeatSelector` | `components/player/TankSeatSelector.tsx` |
| BiS source (R/T/BT/C) | `BiSSourceSelector` | `components/player/BiSSourceSelector.tsx` |
| Badge-style popover select | `PopoverSelect` | `components/primitives/PopoverSelect.tsx` |
| Text input | `Input` | `components/ui/Input.tsx` |
| Dropdown select | `Select` | `components/ui/Select.tsx` |
| Searchable dropdown | `SearchableSelect` | `components/ui/SearchableSelect.tsx` |
| Categorized dropdown | `SearchableSelect` + `groupOrder` | `components/ui/SearchableSelect.tsx` |
| Checkbox | `Checkbox` | `components/ui/Checkbox.tsx` |
| Gear status indicator | `GearStatusCircle` | `components/ui/GearStatusCircle.tsx` |
| Initials avatar (no image) | `InitialsAvatar` | `components/ui/InitialsAvatar.tsx` |
| Modal dialog | `Modal` | `components/ui/Modal.tsx` |
| Confirmation dialog | `ConfirmModal` | `components/ui/ConfirmModal.tsx` |
| Dropdown menu | `Dropdown` | `components/primitives/Dropdown.tsx` |
| Right-click menu | `ContextMenu` | `components/ui/ContextMenu.tsx` |
| Error display | `ErrorMessage` | `components/ui/ErrorMessage.tsx` |
| Inline error | `ErrorBox` | `components/ui/ErrorMessage.tsx` |
| Empty state | `EmptyState` | `components/ui/EmptyState.tsx` |
| Loading spinner | `Spinner` | `components/ui/Spinner.tsx` |
| Loading placeholder | `Skeleton` | `components/ui/Skeleton.tsx` |
| Job icon | `JobIcon` | `components/ui/JobIcon.tsx` |
| Tooltip | `Tooltip` | `components/primitives/Tooltip.tsx` |
| Status badge | `Badge` | `components/primitives/Badge.tsx` |
| Toggle switch | `Toggle` | `components/ui/Toggle.tsx` |
| Static creation | `SetupWizard` | `components/wizard/SetupWizard.tsx` |
| Player setup prompts | `PlayerSetupBanner` | `components/player/PlayerSetupBanner.tsx` |
| User assignment | `AssignUserModal` | `components/player/AssignUserModal.tsx` |
| Status / filter / nav pill | `Tag` (explicit `variant`) | `components/ui/Tag.tsx` |
| In-surface view switch | `Tabs` (no route API) | `components/ui/Tabs.tsx` |
| Navigational text | `LinkText` | `components/ui/LinkText.tsx` |
| Navigational row (icon + label + chevron) | `NavRow` | `components/ui/LinkText.tsx` |
| Have/missing/unknown | `TriStateToggle` | `components/ui/TriStateToggle.tsx` |
| Page/section header | `PageHeader` | `components/layout/PageHeader.tsx` |
| Segmented control | `SegmentedToggle` | `components/ui/SegmentedToggle.tsx` |
| Three-state checkbox | `ThreeStateCheckbox` | `components/ui/ThreeStateCheckbox.tsx` |
| Value/label stat display | `StatCell` | `components/ui/StatCell.tsx` |

### Constrained primitives (design language — enforced)

These carry the redesign's "illegal UI is unrepresentable" rules. They are
**type-enforced** — their prop types make the illegal state unrepresentable,
caught by `pnpm build` (`tsc -b`). The ESLint plugin
(`frontend/eslint-design-system-plugin.js`, rules like
`no-noninteractive-onclick` and `no-cursor-pointer-without-role`) is what
steers raw HTML toward them:

- **`Tag`** — every pill declares `variant="label" | "filter" | "nav"`; the discriminated union makes an ambiguous pill a **type error** (`onClick`/`href` are `never` on `variant="label"`).
- **`Tabs`** — in-surface view switching only; it has no `href`/route API by construction, so a tab can never masquerade as navigation.
- **`LinkText`** / **`NavRow`** — navigational text and row-level navigation (icon + label + description + chevron); both live in `LinkText.tsx` and take `href` xor `onClick` by type.
- **`TriStateToggle`** — have/missing/unknown state; replaces loose ✓/✗/? buttons.
- **`PageHeader`** — icon + Title Case + actions; lives in `layout/`, not `ui/`.

---

## Component reference (by category)

Detail — props, usage examples, variants — lives in `docs/ui-components/`, one file per category. Open only the one you need:

- [Primitives](./ui-components/primitives.md) - Low-level building blocks (Button, IconButton, Dropdown, Tooltip, Badge, PopoverSelect …)
- [Form Controls](./ui-components/form-controls.md) - Inputs and selections
- [Player Selection](./ui-components/player-selection.md) - FFXIV-specific selectors
- [UI Patterns](./ui-components/ui-patterns.md) - Modals, menus, loading, errors, empty states
- [Wizard Components](./ui-components/wizard.md) - SetupWizard and its steps
- [Loot Priority Components](./ui-components/loot-priority.md)
- [Icons and Assets](./ui-components/icons-and-assets.md)

Design tokens, the compliance checker and the decision tree stay in this file, below.

---

## Design Tokens

### Color Usage

Always use semantic color classes, never hardcode hex values.

```tsx
// Role colors
<span className="text-role-tank">Tank</span>
<span className="text-role-healer">Healer</span>
<span className="text-role-melee">Melee</span>
<span className="text-role-ranged">Ranged</span>
<span className="text-role-caster">Caster</span>

// Membership colors
<span className="text-membership-owner">Owner</span>
<span className="text-membership-lead">Lead</span>
<span className="text-membership-member">Member</span>

// Status colors
<span className="text-status-success">Success</span>
<span className="text-status-warning">Warning</span>
<span className="text-status-error">Error</span>

// Gear source colors
<span className="text-gear-raid">Raid</span>           // Red - Savage drops
<span className="text-gear-tome">Tome</span>           // Teal - Augmented tomestone
<span className="text-gear-base-tome">Base Tome</span> // Blue - Base tomestone (no aug needed)
<span className="text-gear-augmented">Augmented</span>

// Material colors
<span className="text-material-twine">Twine</span>
<span className="text-material-glaze">Glaze</span>
<span className="text-material-solvent">Solvent</span>
```

### Surface Hierarchy

```tsx
// Background layers (darkest to lightest)
<div className="bg-surface-base">      {/* Page background */}
<div className="bg-surface-raised">    {/* Sections */}
<div className="bg-surface-card">      {/* Cards */}
<div className="bg-surface-elevated">  {/* Nested containers */}
<div className="bg-surface-overlay">   {/* Dropdowns, modals */}
<div className="bg-surface-interactive">{/* Hover states */}
```

---

## Design System Compliance

### Running the Checker

```bash
# Check all violations (HTML elements + hardcoded colors)
./frontend/scripts/check-design-system.sh

# Only check raw HTML elements
./frontend/scripts/check-design-system.sh --html

# Only check hardcoded colors
./frontend/scripts/check-design-system.sh --colors

# Group violations by file
./frontend/scripts/check-design-system.sh --summary

# Strict mode (fails on violations, use in CI)
./frontend/scripts/check-design-system.sh --strict
```

### Ignoring Specific Lines

Add `// design-system-ignore` comment to ignore intentional exceptions:

```typescript
// design-system-ignore - Radix requires native button
<button className="trigger" {...props}>
```

### HTML Violations Caught

| Pattern | Required Component |
|---------|-------------------|
| `<input ` | Input, NumberInput, or Checkbox |
| `<select ` | Select |
| `<button ` | Button or IconButton |
| `<label ` | Label |
| `<textarea ` | TextArea |

### Color Violations Caught

| Pattern | Required Token |
|---------|---------------|
| `#14b8a6` | `text-accent` / `bg-accent` |
| `#5a9fd4` | `text-role-tank` |
| `#5ad490` | `text-role-healer` |
| `#d45a5a` | `text-role-melee` |
| `#d4a05a` | `text-role-ranged` |
| `#b45ad4` | `text-role-caster` |
| `#ef4444` | `text-status-error` |
| `#22c55e` | `text-status-success` |
| *(and 15+ more)* | |

**Run this before committing any UI changes.**

---

## Decision Tree

**Need a button?**
→ Text button: `Button` with appropriate variant
→ Icon only: `IconButton` (requires aria-label)

**Need job selection?**
→ Always use `JobPicker` - never recreate

**Need position selection?**
→ Always use `PositionSelector` - never recreate

**Need a dropdown?**
→ Action menu: `Dropdown` + `DropdownItem`
→ Single value (small list): `Select`
→ Large searchable list: `SearchableSelect`
→ Categorized list: `SearchableSelect` + `groupOrder`
→ Custom content: `Popover`

**Need a modal?**
→ Form/complex: `Modal` + `useModal` hook
→ Confirmation: `ConfirmModal`
→ No modal needed: `useDoubleClickConfirm`

**Need loading state?**
→ Match content shape: `Skeleton` variant
→ Inline: `Spinner`

**Need error display?**
→ Always use `ErrorMessage`

**Need static creation?**
→ Use `SetupWizard` for 4-step guided creation

**Need player setup prompts?**
→ Use `PlayerSetupBanner` on PlayerCard

---
