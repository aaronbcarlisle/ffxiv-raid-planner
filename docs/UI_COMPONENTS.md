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
| Text input | `Input` | `components/ui/Input.tsx` |
| Dropdown select | `Select` | `components/ui/Select.tsx` |
| Checkbox | `Checkbox` | `components/ui/Checkbox.tsx` |
| Modal dialog | `Modal` | `components/ui/Modal.tsx` |
| Confirmation dialog | `ConfirmModal` | `components/ui/ConfirmModal.tsx` |
| Dropdown menu | `Dropdown` | `components/primitives/Dropdown.tsx` |
| Right-click menu | `ContextMenu` | `components/ui/ContextMenu.tsx` |
| Error display | `ErrorMessage` | `components/ui/ErrorMessage.tsx` |
| Loading placeholder | `Skeleton` | `components/ui/Skeleton.tsx` |
| Job icon | `JobIcon` | `components/ui/JobIcon.tsx` |
| Tooltip | `Tooltip` | `components/primitives/Tooltip.tsx` |
| Status badge | `Badge` | `components/primitives/Badge.tsx` |
| Static creation | `SetupWizard` | `components/wizard/SetupWizard.tsx` |
| Player setup prompts | `PlayerSetupBanner` | `components/player/PlayerSetupBanner.tsx` |
| User assignment | `AssignUserModal` | `components/player/AssignUserModal.tsx` |

---

## Table of Contents

- [Primitives](#primitives) - Low-level building blocks
- [Form Controls](#form-controls) - Inputs and selections
- [Player Selection](#player-selection) - FFXIV-specific selectors
- [UI Patterns](#ui-patterns) - Complex reusable patterns
- [Design Tokens](#design-tokens) - Colors and styling

---

## Primitives

### Button

**Path:** `components/primitives/Button.tsx`

**Purpose:** Primary button component with multiple variants. Use for ALL buttons in the app.

**Props:**
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'success' | 'link';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;      // Shows spinner, disables interaction
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  // ...extends HTMLButtonElement attributes
}
```

**Usage:**
```tsx
import { Button } from '../components/primitives/Button';

// Primary action
<Button variant="primary" onClick={handleSave}>Save Changes</Button>

// Danger action with icon
<Button variant="danger" leftIcon={<Trash2 className="w-4 h-4" />}>
  Delete
</Button>

// Loading state
<Button loading={isSubmitting}>Submit</Button>

// Link style
<Button variant="link" onClick={handleNavigate}>View Details</Button>
```

**When to use:** Every button in the application.

**Never use:** Raw `<button>` elements.

---

### IconButton

**Path:** `components/primitives/IconButton.tsx`

**Purpose:** Icon-only button with required accessibility label.

**Props:**
```typescript
interface IconButtonProps {
  'aria-label': string;   // REQUIRED for accessibility
  icon: ReactNode;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}
```

**Usage:**
```tsx
import { IconButton } from '../components/primitives/IconButton';

<IconButton
  aria-label="Close modal"
  icon={<X className="w-4 h-4" />}
  onClick={onClose}
/>

<IconButton
  aria-label="Delete item"
  icon={<Trash2 className="w-4 h-4" />}
  variant="danger"
  onClick={handleDelete}
/>
```

**When to use:** Toolbar buttons, close buttons, action icons.

---

### Badge

**Path:** `components/primitives/Badge.tsx`

**Purpose:** Small labeled badges for status/category display.

**Props:**
```typescript
interface BadgeProps {
  variant?: 'default' | 'raid' | 'tome' | 'augmented' | 'crafted' |
            'success' | 'warning' | 'error' | 'info' |
            'tank' | 'healer' | 'melee' | 'ranged' | 'caster';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}
```

**Usage:**
```tsx
import { Badge } from '../components/primitives/Badge';

<Badge variant="raid">Savage</Badge>
<Badge variant="tank">Tank</Badge>
<Badge variant="warning">Needs Upgrade</Badge>
```

**When to use:** Gear source indicators, role labels, status tags.

---

### Tooltip

**Path:** `components/primitives/Tooltip.tsx`

**Purpose:** Floating tooltips with configurable positioning.

**Props:**
```typescript
interface TooltipProps {
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  delayDuration?: number;
  children: ReactNode;
}
```

**Usage:**
```tsx
import { Tooltip } from '../components/primitives/Tooltip';

<Tooltip content="Save your changes (Ctrl+S)">
  <Button>Save</Button>
</Tooltip>

<Tooltip content="This player has not configured their gear" side="right">
  <WarningIcon />
</Tooltip>
```

**When to use:** Help text, keyboard shortcuts, disabled reason explanations, score breakdowns.

**Priority Score Tooltips (v1.0.10):**
The Tooltip component is used extensively in loot priority panels to show score breakdowns:
- **Gear Priority**: Hover shows Role Priority, Gear Needed (weighted), and Loot Adjustment
- **Weapon Priority**: Hover shows Main Job Bonus, Role Priority, and List Position
- Enhanced scores also display No Drops Bonus and Fair Share Adjustment when active

---

### Dropdown

**Path:** `components/primitives/Dropdown.tsx`

**Purpose:** Radix-based dropdown menu with full keyboard navigation.

**Sub-components:**
- `Dropdown` - Root wrapper
- `DropdownTrigger` - Clickable trigger
- `DropdownContent` - Menu panel
- `DropdownItem` - Menu item (supports icon, shortcut, danger, href)
- `DropdownCheckboxItem` - Checkbox menu item
- `DropdownSeparator` - Visual divider
- `DropdownLabel` - Section label
- `DropdownSub`, `DropdownSubTrigger`, `DropdownSubContent` - Nested menus

**Usage:**
```tsx
import {
  Dropdown, DropdownTrigger, DropdownContent,
  DropdownItem, DropdownSeparator
} from '../components/primitives/Dropdown';

<Dropdown>
  <DropdownTrigger asChild>
    <Button variant="ghost">Actions</Button>
  </DropdownTrigger>
  <DropdownContent>
    <DropdownItem icon={<Edit className="w-4 h-4" />} onClick={handleEdit}>
      Edit
    </DropdownItem>
    <DropdownItem icon={<Copy className="w-4 h-4" />} shortcut="Ctrl+C">
      Copy
    </DropdownItem>
    <DropdownSeparator />
    <DropdownItem danger icon={<Trash2 className="w-4 h-4" />}>
      Delete
    </DropdownItem>
  </DropdownContent>
</Dropdown>
```

**When to use:** Action menus, settings dropdowns, context actions.

**Don't use for:** Single value selection (use `Select` instead).

---

### Popover

**Path:** `components/primitives/Popover.tsx`

**Purpose:** Floating panel for custom content (not list-based).

**Sub-components:**
- `Popover` - Root
- `PopoverTrigger` - Opens popover
- `PopoverContent` - Float panel
- `PopoverClose` - Close button

**Usage:**
```tsx
import { Popover, PopoverTrigger, PopoverContent } from '../components/primitives/Popover';

<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost">Settings</Button>
  </PopoverTrigger>
  <PopoverContent>
    <h3>Settings Panel</h3>
    {/* Custom form content */}
  </PopoverContent>
</Popover>
```

**When to use:** Custom layouts in floating panels, settings forms, complex selectors.

**Use Dropdown instead for:** Menu-style lists of actions.

---

## Form Controls

### Input

**Path:** `components/ui/Input.tsx`

**Purpose:** Text input with error handling and icon support.

**Props:**
```typescript
interface InputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  // ...standard input attributes
}
```

**Usage:**
```tsx
import { Input } from '../components/ui/Input';

<Input
  value={name}
  onChange={setName}
  placeholder="Player name"
  error={errors.name}
/>

<Input
  value={search}
  onChange={setSearch}
  leftIcon={<Search className="w-4 h-4" />}
  placeholder="Search..."
/>
```

**When to use:** All text inputs.

**Never use:** Raw `<input>` elements.

---

### Select

**Path:** `components/ui/Select.tsx`

**Purpose:** Custom dropdown select.

**Props:**
```typescript
interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}
```

**Usage:**
```tsx
import { Select } from '../components/ui/Select';

const roleOptions = [
  { value: 'tank', label: 'Tank' },
  { value: 'healer', label: 'Healer' },
  { value: 'dps', label: 'DPS' },
];

<Select
  value={role}
  onChange={setRole}
  options={roleOptions}
  placeholder="Select role..."
/>
```

**When to use:** Single-value dropdown selection.

**Never use:** Raw `<select>` elements.

---

### Checkbox

**Path:** `components/ui/Checkbox.tsx`

**Purpose:** Custom checkbox with label and keyboard support.

**Props:**
```typescript
interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}
```

**Usage:**
```tsx
import { Checkbox } from '../components/ui/Checkbox';

<Checkbox
  checked={hasItem}
  onChange={setHasItem}
  label="Has item"
/>

<Checkbox
  checked={isAugmented}
  onChange={setIsAugmented}
  disabled={!hasItem}
/>
```

**When to use:** Boolean toggles, gear slot checkboxes.

---

### RadioGroup

**Path:** `components/ui/RadioGroup.tsx`

**Purpose:** Radio button group for exclusive selection.

**Props:**
```typescript
interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
}
```

**Usage:**
```tsx
import { RadioGroup } from '../components/ui/RadioGroup';

<RadioGroup
  value={visibility}
  onChange={setVisibility}
  options={[
    { value: 'public', label: 'Public' },
    { value: 'private', label: 'Private' },
  ]}
/>
```

**When to use:** Mutually exclusive choices.

---

### TextArea

**Path:** `components/ui/TextArea.tsx`

**Purpose:** Multi-line text input.

**Never use:** Raw `<textarea>` elements.

---

### NumberInput

**Path:** `components/ui/NumberInput.tsx`

**Purpose:** Numeric input with increment/decrement buttons.

---

### Label

**Path:** `components/ui/Label.tsx`

**Purpose:** Form label component.

**Never use:** Raw `<label>` elements.

---

## Player Selection

### JobPicker

**Path:** `components/player/JobPicker.tsx`

**Purpose:** Comprehensive job selector with search, categories, and role-based quick selection.

**Props:**
```typescript
interface JobPickerProps {
  selectedJob: string;
  onJobSelect: (job: string) => void;
  templateRole?: TemplateRole;     // Shows role-specific quick icons
  onRequestClose?: () => void;
  reverseLayout?: boolean;         // Search at bottom for upward dropdowns
}
```

**Features:**
- Search with tag matching (job name, abbreviation, role)
- Category grouping (Tank, Pure Healer, Barrier Healer, Melee, Ranged, Caster)
- Keyboard navigation (arrow keys, Enter, Escape)
- Role-specific quick-select buttons when `templateRole` provided

**Usage:**
```tsx
import { JobPicker } from '../components/player/JobPicker';

<JobPicker
  selectedJob={player.job}
  onJobSelect={(job) => updatePlayer({ ...player, job })}
  templateRole="healer"
/>
```

**When to use:** ANY job selection in the app.

**NEVER recreate:** This component handles all the complexity of job selection. Do not create your own job selector.

---

### PositionSelector

**Path:** `components/player/PositionSelector.tsx`

**Purpose:** Raid position picker (T1-R2 grid) with role-based suggestions.

**Props:**
```typescript
interface PositionSelectorProps {
  position: RaidPosition | null | undefined;
  role: string;
  onSelect: (position: RaidPosition | undefined) => void;
  player: SnapshotPlayer;
  userRole?: MemberRole;
  currentUserId?: string;
  isAdmin?: boolean;
}
```

**Features:**
- 4x2 grid layout (T1, T2, H1, H2, M1, M2, R1, R2)
- Role-based suggestions (healers see H1/H2 highlighted)
- Permission-aware styling
- Clear button to unset

**Usage:**
```tsx
import { PositionSelector } from '../components/player/PositionSelector';

<PositionSelector
  position={player.position}
  role={player.role}
  onSelect={(pos) => updatePlayer({ ...player, position: pos })}
  player={player}
  userRole={membership?.role}
/>
```

**When to use:** Position assignment (T1, H2, M1, etc.).

**NEVER recreate:** Use this component for any position selection.

---

### TankRoleSelector

**Path:** `components/player/TankRoleSelector.tsx`

**Purpose:** MT/OT (Main Tank/Off Tank) selector.

**Props:**
```typescript
interface TankRoleSelectorProps {
  tankRole: TankRole | null | undefined;
  onSelect: (role: TankRole | undefined) => void;
  player: SnapshotPlayer;
  userRole?: MemberRole;
  currentUserId?: string;
  isAdmin?: boolean;
}
```

**Usage:**
```tsx
import { TankRoleSelector } from '../components/player/TankRoleSelector';

<TankRoleSelector
  tankRole={player.tankRole}
  onSelect={(role) => updatePlayer({ ...player, tankRole: role })}
  player={player}
/>
```

**When to use:** Tank-specific role assignment.

---

## UI Patterns

### Modal

**Path:** `components/ui/Modal.tsx`

**Purpose:** Dialog box with focus trap and backdrop.

**Props:**
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  icon?: ReactNode;           // v1.0.8+: All modals should have icons
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  children: ReactNode;
}
```

**Features:**
- Escape key closes
- Focus trap (tab stays within modal)
- Auto-focuses first form field
- Portal rendering
- `aria-modal="true"`

**Usage:**
```tsx
import { Modal } from '../components/ui/Modal';
import { useModal } from '../hooks/useModal';

const { isOpen, open, close } = useModal();

<Button onClick={open}>Open Settings</Button>

<Modal
  isOpen={isOpen}
  onClose={close}
  title="Settings"
  icon={<Settings className="w-5 h-5" />}
>
  {/* Modal content */}
</Modal>
```

**When to use:** Any dialog or modal form.

**Always use:** `useModal` hook for state management.

---

### ConfirmModal

**Path:** `components/ui/ConfirmModal.tsx`

**Purpose:** Simple confirmation dialog for destructive actions.

**Props:**
```typescript
interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'default';
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: ReactNode;  // Auto-determined by variant if not provided
}
```

**Features:**
- Auto-adds contextual icon (Trash2 for danger, AlertTriangle for warning)
- Loading state on confirm button
- Color-coded by variant

**Usage:**
```tsx
import { ConfirmModal } from '../components/ui/ConfirmModal';

<ConfirmModal
  isOpen={showDeleteConfirm}
  onConfirm={handleDelete}
  onCancel={() => setShowDeleteConfirm(false)}
  title="Delete Player"
  message="Are you sure you want to remove this player? This cannot be undone."
  variant="danger"
  confirmLabel="Delete"
/>
```

**When to use:** Delete confirmations, irreversible actions.

---

### ContextMenu

**Path:** `components/ui/ContextMenu.tsx`

**Purpose:** Right-click context menu with keyboard navigation.

**Props:**
```typescript
interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  keepOpen?: boolean;
  tooltip?: string;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}
```

**Usage:**
```tsx
import { ContextMenu } from '../components/ui/ContextMenu';

const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

const handleContextMenu = (e: React.MouseEvent) => {
  e.preventDefault();
  setContextMenu({ x: e.clientX, y: e.clientY });
};

{contextMenu && (
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    items={[
      { label: 'Edit', icon: <Edit />, onClick: handleEdit },
      { separator: true },
      { label: 'Delete', icon: <Trash2 />, danger: true, onClick: handleDelete },
    ]}
    onClose={() => setContextMenu(null)}
  />
)}
```

**When to use:** Right-click menus on cards, tables, list items.

---

### ErrorMessage

**Path:** `components/ui/ErrorMessage.tsx`

**Purpose:** Error display with optional retry.

**Props:**
```typescript
interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  retrying?: boolean;
  size?: 'sm' | 'md';
}
```

**Usage:**
```tsx
import { ErrorMessage } from '../components/ui/ErrorMessage';

{error && (
  <ErrorMessage
    message={error}
    onRetry={handleRetry}
    retrying={isRetrying}
  />
)}
```

**When to use:** API errors, fetch failures, validation errors.

---

### Skeleton

**Path:** `components/ui/Skeleton.tsx`

**Purpose:** Loading placeholder components.

**Pre-built variants:**
- `PlayerCardSkeleton` - Single player card
- `PlayerGridSkeleton` - Grid of player cards
- `TableSkeleton`, `TableRowSkeleton` - Table placeholders
- `StaticCardSkeleton`, `StaticGridSkeleton` - Static group cards
- `ListSkeleton`, `CardSkeleton` - Generic shapes
- `PageSkeleton` - Full page

**Usage:**
```tsx
import { PlayerGridSkeleton, StaticGridSkeleton } from '../components/ui/Skeleton';

if (isLoading) {
  return <PlayerGridSkeleton count={8} />;
}

if (isLoadingStatics) {
  return <StaticGridSkeleton count={6} />;
}
```

**When to use:** Loading states while fetching data.

---

### JobIcon

**Path:** `components/ui/JobIcon.tsx`

**Purpose:** Displays FFXIV job icon image.

**Props:**
```typescript
interface JobIconProps {
  job: string;              // Job abbreviation: 'DRG', 'WHM', etc.
  size?: 'sm' | 'md' | 'lg';
}
```

**Usage:**
```tsx
import { JobIcon } from '../components/ui/JobIcon';

<JobIcon job="DRG" size="md" />
<JobIcon job={player.job} />
```

**When to use:** Displaying job icons anywhere in the UI.

---

### TabNavigation

**Path:** `components/ui/TabNavigation.tsx`

**Purpose:** Main page tab bar.

**When to use:** Primary navigation between page sections.

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
<span className="text-gear-raid">Raid</span>
<span className="text-gear-tome">Tome</span>
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
→ Single value: `Select`
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

## Wizard Components (v1.0.9)

### SetupWizard

**Path:** `components/wizard/SetupWizard.tsx`

**Purpose:** 4-step guided modal for creating new static groups.

**Steps:**
1. **Static Details** - Name, tier selection (defaults to latest), content type
2. **Roster Setup** - 8 player slots with job quick-select
3. **Share** - Copy share link for inviting members
4. **Review** - Summary of configuration before creation

**Features:**
- Role-specific job quick-select buttons
- Keyboard navigation (Tab through slots, Enter to advance)
- Sticky navigation footer (always visible)
- Default tier pre-selected (latest savage tier)
- Partial roster allowed
- Cancel confirmation prevents data loss

**Sub-components:**
- `WizardProgress` - 4-step horizontal progress indicator
- `WizardNavigation` - Back/Next/Create buttons
- `RosterSlot` - Individual player slot with job picker
- `StaticDetailsStep`, `RosterSetupStep`, `ShareStep`, `ReviewStep`

**Usage:**
```tsx
import { SetupWizard } from '../components/wizard';

<SetupWizard
  isOpen={showWizard}
  onClose={() => setShowWizard(false)}
  onComplete={(group) => navigate(`/group/${group.shareCode}`)}
/>
```

**When to use:** Dashboard "Create Static" button.

---

### PlayerSetupBanner

**Path:** `components/player/PlayerSetupBanner.tsx`

**Purpose:** Contextual banner on PlayerCards when setup is incomplete.

**Props:**
```typescript
interface PlayerSetupBannerProps {
  player: SnapshotPlayer;
  userRole: MemberRole | undefined;
  currentUserId: string | undefined;
  isAdmin: boolean;
  viewAsUserId?: string;
  onAssign: () => void;
  onClaim: () => void;
  onImportBiS: () => void;
}
```

**Banner States:**
| Condition | Message | Action |
|-----------|---------|--------|
| Unclaimed + Owner/Lead | "Unclaimed" | Assign Player |
| Unclaimed + Member | "Unclaimed" | Take Ownership |
| Claimed by me + No BiS | "No BiS configured" | Import BiS |
| Fully configured | *(hidden)* | - |

**Features:**
- Auto-hides when card is fully configured
- Respects View As mode for admin impersonation
- Compact design (~32px height)
- Uses `bg-surface-elevated` styling

**Usage:**
```tsx
import { PlayerSetupBanner } from '../components/player/PlayerSetupBanner';

<PlayerSetupBanner
  player={player}
  userRole={membership?.role}
  currentUserId={user?.id}
  isAdmin={isAdmin}
  onAssign={() => setShowAssignModal(true)}
  onClaim={handleClaim}
  onImportBiS={() => setShowBiSModal(true)}
/>
```

**When to use:** Between PlayerCard header and gear table.

---

### AssignUserModal

**Path:** `components/player/AssignUserModal.tsx`

**Purpose:** Modal for owners/admins to assign Discord users to player cards.

**Features:**
- Two tabs: Members (existing group members) and Manual (enter user ID)
- Role-colored badges (Owner/Lead/Member/Viewer/Linked)
- Users already assigned to other cards appear at bottom with indicator
- Confirmation modal when reassigning from another card
- Discord ID (17-19 digits) and UUID format validation

**Usage:**
```tsx
import { AssignUserModal } from '../components/player/AssignUserModal';

<AssignUserModal
  isOpen={showAssignModal}
  onClose={() => setShowAssignModal(false)}
  player={player}
  members={groupMembers}
  allPlayers={allPlayers}
  onAssign={handleAssignUser}
/>
```

**When to use:** Admin/owner player assignment via context menu or PlayerSetupBanner

---

## Loot Priority Components (v1.0.10)

### LootPriorityPanel

**Path:** `components/loot/LootPriorityPanel.tsx`

**Purpose:** Main panel for displaying loot priority calculations and quick logging.

**Features:**
- **Gear Priority Tab**: Shows priority for each gear slot with gear slot icons
- **Weapon Priority Tab**: Shows weapon priority by job with collapsible tie sections
- **Who Needs It Matrix**: Cross-player/slot matrix view
- **Score Tooltips**: All scores show breakdown on hover
- **Quick Logging**: Log button on each priority entry for inline logging

**Sub-components:**
- `GearScoreTooltip` - Score breakdown (Role Priority, Gear Needed, Loot Adjustment)
- `PriorityList` - Ranked list of players for a slot

---

### WeaponPriorityList

**Path:** `components/loot/WeaponPriorityList.tsx`

**Purpose:** Displays weapon priority by job with advanced tie handling.

**Features:**
- **Connector Line Styling**: Tied players shown with vertical line + dots connector
- **Collapsible Tie Sections**: Click chevron to expand/collapse tie groups
- **Winner Display**: After rolling, winner's job icon + name shown in header
- **Score Tooltips**: Hover shows Main Job Bonus, Role Priority, List Position

**Props:**
```typescript
interface WeaponPriorityListProps {
  players: SnapshotPlayer[];
  settings: StaticSettings;
  showLogButtons?: boolean;
  onLogClick?: (weaponJob: string, player: SnapshotPlayer) => void;
}
```

**Tie Style Options:**
The `WeaponPriorityCard` component accepts a `tieStyle` prop:
- `'connector'` (default) - Vertical line + dots, collapsible sections
- `'border'` - Left accent border (legacy)
- `'sameRank'` - Same rank number with "=" indicator
- `'rankNotation'` - Mathematical "2=." notation
- `'background'` - Subtle background banding

**Usage:**
```tsx
import { WeaponPriorityList } from '../components/loot/WeaponPriorityList';

<WeaponPriorityList
  players={players}
  settings={settings}
  showLogButtons={canLog}
  onLogClick={handleWeaponLog}
/>
```

**When to use:** Weapon priority display on the Loot tab.

---

## Icons and Assets

### Gear Slot Icons

**Path:** `types/index.ts` (GEAR_SLOT_ICONS constant)

**Purpose:** Generic gear slot icons for UI elements.

**Usage:**
```tsx
import { GEAR_SLOT_ICONS, GearSlot } from '../types';

<img
  src={GEAR_SLOT_ICONS[slot as GearSlot]}
  alt=""
  className="w-4 h-4 brightness-[3.0]"
/>
```

**Available Slots:** weapon, head, body, hands, legs, feet, earring, necklace, bracelet, ring1, ring2

**Icon Variants:** Located in `public/images/gear-slots/{variant}/`
- `white` (active) - Used with `brightness-[3.0]` filter
- `gray`, `black`, `teal`, `gold`, `gold-vibrant`, `gold-rich`, `gold-bright`, `amber`, `yellow`

**Regenerate:** `cd frontend && python scripts/colorize-gear-icons.py`

---

### Material Icons

**Path:** `public/images/materials/{variant}/`

**Purpose:** Upgrade material icons (twine, glaze, solvent, tomestone).

**Variants:**
- `original/` - Full-color XIVAPI originals (for Photoshop editing)
- `white/`, `white-flat/`, `gray/`, `black/`, `teal/`, `gold-vibrant/` - Processed silhouettes

**Files:** twine.png, glaze.png, solvent.png, tomestone.png

**Regenerate:** `cd frontend && python scripts/process-material-icons.py`

---

### Icon Gallery (Developer Tool)

**URL:** `http://localhost:5173/icon-gallery.html`

**Purpose:** Visual reference for all custom icons in the application.

**Contents:**
- All gear slot icon variants with color comparison
- Upgrade material icons (original and silhouettes)
- Job icons by role (from XIVAPI)
- Visual comparison section
- XIVAPI URLs and regeneration commands

**When to use:** Choosing icon variants, verifying icon appearance, referencing XIVAPI URLs.
