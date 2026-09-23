# Primitives

> Part of the [UI component inventory](../UI_COMPONENTS.md) — moved here verbatim on 2026-09-23 so the entry doc stays small. Quick Reference, decision tree, tokens and the compliance checker live there.


### Button

**Path:** `components/primitives/Button.tsx`

**Purpose:** Primary button component with multiple variants. Use for ALL buttons in the app.

**Props:**
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'accent-subtle' | 'ghost' | 'danger' | 'warning' | 'success' | 'link';
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

### PopoverSelect

**Path:** `components/primitives/PopoverSelect.tsx`

**Purpose:** Standardized badge-style popover selector. Used for compact selectors like Position (T1-R2), Tank Role (MT/OT), and BiS Source (Raid/Tome/Crafted).

**Design Standards:**

| Element | Style |
|---------|-------|
| **Trigger** | `px-1.5 py-0.5 rounded text-xs font-bold` |
| **Dropdown items** | `px-2 py-1.5 rounded text-xs font-bold` |
| **Unselected** | `bg-{color}/20 text-{color} hover:bg-{color}/30` |
| **Selected** | `bg-{color} text-surface-base` (solid bg, dark text) |
| **Disabled** | `opacity-50 cursor-not-allowed` |
| **Clear button** | `w-full mt-2 px-2 py-1 text-xs text-text-muted` |

**Props:**
```typescript
interface PopoverSelectOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  description?: string;
  colorClasses?: { selected: string; unselected: string };
}

interface PopoverSelectProps<T extends string> {
  value: T | null | undefined;
  options: PopoverSelectOption<T>[];
  onSelect: (value: T | undefined) => void;
  disabled?: boolean;
  disabledReason?: string;
  tooltipContent?: ReactNode;
  clearable?: boolean;
  clearText?: string;
  layout?: 'vertical' | 'horizontal' | 'grid';
  gridCols?: number;
  align?: 'start' | 'center' | 'end';
  getOptionClasses?: (option, isSelected) => string;
  getTriggerClasses?: (value) => string;
  placeholder?: string;
  triggerWidth?: string;
  showIcons?: boolean;
}
```

**Color Helpers:**
```tsx
import {
  PopoverSelect,
  createRoleColorClasses,
  createGearSourceColorClasses,
} from '../components/primitives';

// Role colors (tank, healer, dps)
const tankClasses = createRoleColorClasses('T');
// { selected: 'bg-role-tank text-surface-base', unselected: 'bg-role-tank/20 text-role-tank hover:bg-role-tank/30' }

// Gear source colors
const tomeClasses = createGearSourceColorClasses('tome');
// { selected: 'bg-gear-tome text-surface-base', unselected: 'bg-gear-tome/20 text-gear-tome hover:bg-gear-tome/30' }

const baseTomeClasses = createGearSourceColorClasses('base_tome');
// { selected: 'bg-gear-base-tome text-surface-base', unselected: 'bg-gear-base-tome/20 text-gear-base-tome hover:bg-gear-base-tome/30' }
```

**Usage:**
```tsx
import { PopoverSelect, createGearSourceColorClasses } from '../components/primitives';

const options = [
  { value: 'raid', label: 'Raid', colorClasses: createGearSourceColorClasses('raid') },
  { value: 'tome', label: 'Tome', colorClasses: createGearSourceColorClasses('tome') },
  { value: 'crafted', label: 'Crafted', colorClasses: createGearSourceColorClasses('crafted') },
];

<PopoverSelect
  value={bisSource}
  options={options}
  onSelect={setBisSource}
  layout="vertical"
  showIcons
/>
```

**When to use:** Badge-style selectors where selection is from a small set of options.

**Specialized wrappers:** Use the domain-specific components instead when available:
- `PositionSelector` - Raid positions with role suggestions
- `TankRoleSelector` - MT/OT selection
- `BiSSourceSelector` - BiS gear source
