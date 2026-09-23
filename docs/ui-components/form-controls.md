# Form Controls

> Part of the [UI component inventory](../UI_COMPONENTS.md) — moved here verbatim on 2026-09-23 so the entry doc stays small. Quick Reference, decision tree, tokens and the compliance checker live there.


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

**When to use:** Single-value dropdown selection with small lists.

**Never use:** Raw `<select>` elements.

---

### SearchableSelect

**Path:** `components/ui/SearchableSelect.tsx`

**Purpose:** Filterable dropdown for large lists. Supports grouped/categorized options with colored headers.

**Props:**
```typescript
interface GroupConfig {
  name: string;      // Group name (matches option.group values)
  color?: string;    // CSS color for header (e.g., 'var(--color-membership-owner)')
}

interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  group?: string;    // Group name for categorization
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  emptyMessage?: string;
  groupOrder?: (string | GroupConfig)[];  // Order and styling of groups
}
```

**Basic Usage:**
```tsx
import { SearchableSelect } from '../components/ui/SearchableSelect';

const userOptions = users.map(u => ({
  value: u.id,
  label: u.displayName,
  icon: <RoleBadge role={u.role} />,
}));

<SearchableSelect
  value={selectedUserId}
  onChange={setSelectedUserId}
  options={userOptions}
  placeholder="Select user..."
  searchPlaceholder="Search by name..."
  emptyMessage="No matching users"
/>
```

**Grouped/Categorized Usage:**
```tsx
// Define group configuration with colors
const GROUP_CONFIG = {
  owner: { name: 'Owners', color: 'var(--color-membership-owner)' },
  lead: { name: 'Leads', color: 'var(--color-membership-lead)' },
  member: { name: 'Members', color: 'var(--color-membership-member)' },
  linked: { name: 'Linked Users', color: 'var(--color-membership-linked)' },
};

// Options with group assignment
const userOptions = users.map(u => ({
  value: u.id,
  label: u.displayName,
  icon: <RoleBadge role={u.role} />,
  group: GROUP_CONFIG[u.role].name,  // Must match GroupConfig.name
}));

// Group order with colors
const groupOrder = ['owner', 'lead', 'member', 'linked'].map(r => GROUP_CONFIG[r]);

<SearchableSelect
  value={selectedUserId}
  onChange={setSelectedUserId}
  options={userOptions}
  groupOrder={groupOrder}
  placeholder="Select user..."
  searchPlaceholder="Search by name..."
/>
```

**Grouped Dropdown Features:**
- **Sticky Headers**: Group headers stay visible while scrolling within that section
- **Colored Headers**: Each group can have its own color (uses CSS variables)
- **Smart Filtering**: Search matches both option labels AND group names (type "owner" to see all owners)
- **Keyboard Navigation**: Arrow keys work across groups seamlessly
- **Subtle Highlighting**: Keyboard selection uses `color-mix` with group color at 15% opacity

**Styling Details:**
- Dropdown background: `bg-surface-raised` (dark)
- Search input: `bg-surface-base` (darker)
- Headers: `bg-surface-raised` with colored text
- Hover/highlight: `bg-white/5` or `color-mix(in srgb, {groupColor} 15%, transparent)`

**When to use:** Dropdown selection with many options (10+), especially when options have natural categories.

**When NOT to use:** Small lists where regular `Select` is sufficient.

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

**When to use:** Boolean toggles, settings, feature flags.

---

### GearStatusCircle

**Path:** `components/ui/GearStatusCircle.tsx`

**Purpose:** Target-style status indicator for gear tracking with 2-state or 3-state cycles based on BiS source type.

**Props:**
```typescript
interface GearStatusCircleProps {
  state: 'missing' | 'have' | 'augmented';
  bisSource: 'raid' | 'tome' | 'base_tome' | 'crafted' | null;
  requiresAugmentation: boolean;
  onChange: (state: GearState) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

**Visual States:**
- **Missing:** Solid gray filled circle (no ring)
- **Have (partial):** Colored ring only, no inner fill - for tome gear that needs augmentation
- **Complete/Augmented:** Colored ring + filled inner circle

**State Cycles:**
- **Raid/Base Tome/Crafted:** 2-state cycle (missing ↔ complete)
- **Tome (needs augmentation):** 3-state cycle (missing → have → augmented → missing)

**Color Coding:**
- Raid gear: Red ring/fill (`gear-raid`)
- Tome gear: Teal ring/fill (`gear-tome`)
- Base Tome: Light blue ring/fill (`gear-base-tome`)
- Crafted: Orange ring/fill (`gear-crafted`)

**Usage:**
```tsx
import { GearStatusCircle } from '../components/ui/GearStatusCircle';
import { toGearState, fromGearState } from '../utils/calculations';

// Basic usage
<GearStatusCircle
  state={toGearState(slot.hasItem, slot.isAugmented)}
  bisSource={slot.bisSource}
  requiresAugmentation={requiresAugmentation(slot.bisSource)}
  onChange={(newState) => {
    const { hasItem, isAugmented } = fromGearState(newState);
    onUpdate({ hasItem, isAugmented });
  }}
/>

// Disabled state
<GearStatusCircle
  state="have"
  bisSource="tome"
  requiresAugmentation={true}
  onChange={() => {}}
  disabled={true}
/>

// Different sizes
<GearStatusCircle state="missing" bisSource="raid" size="sm" ... />
<GearStatusCircle state="have" bisSource="tome" size="md" ... />
<GearStatusCircle state="augmented" bisSource="tome" size="lg" ... />
```

**When to use:** Gear slot status tracking in player cards and gear tables.

**Never use:** For generic boolean toggles - use `Checkbox` instead. GearStatusCircle is specifically designed for FFXIV gear tracking with its unique state cycles.

---

### InitialsAvatar

**Path:** `components/ui/InitialsAvatar.tsx`

**Purpose:** The shared circular initials fallback for every avatar-shaped surface that has no image to show (rail chips, roster/loot identity rows, recipient pickers, the members list). Extracted (Phase D feedback-polish Task 6) from several independently hand-rolled copies — the `aria-hidden` ones all shared the same bug (initials text visibly off-center); the MembersPanel copies never had it (no `aria-hidden`, so the rule below never matched them) and were migrated purely as consolidation, under ruling R-V2. The root cause was NOT font metrics or line-height — it was a global CSS rule (`index.css`, `[aria-hidden="true"] { display: revert !important }`, added to stop Radix from hiding dropdown siblings) silently stripping `flex`/`grid` centering from any `aria-hidden` element. `InitialsAvatar` bakes in the fix (`role="presentation"` alongside `aria-hidden="true"` — the rule's own carve-out) so every consumer gets correctly centered initials for free.

**Props:**
```typescript
interface InitialsAvatarProps {
  initials: string;                 // pre-derived text; callers own the derivation
  size: number | string;             // px number, or a CSS length/var() expression
  background?: string;               // CSS color/token expr; omit to use className instead
  borderColor?: string;              // CSS color/token expr (often per-role); omit for no border
  borderWidth?: number;              // default 2; only applied when borderColor is set
  fontWeight?: 'medium' | 'semibold' | 'bold'; // default 'semibold'
  textSize?: 'sm' | 'xs' | '2xs';    // default 'xs' (12px floor); '2xs' (10px) carries a design-system-ignore
  className?: string;                // escape hatch for Tailwind-expressible colors (e.g. opacity utilities)
}
```

**Usage:**
```tsx
import { InitialsAvatar } from '../components/ui';

// Static Tailwind color, no border (PlayerIdentity's fallback avatar)
<InitialsAvatar initials="TO" size={32} className="bg-surface-interactive text-text-secondary" fontWeight="medium" />

// Dynamic per-role border color (PriorityRow / RecipientPicker queue chips)
<InitialsAvatar
  initials="CO"
  size={22}
  className="bg-surface-interactive text-text-secondary"
  borderColor={`var(--color-role-${role}, var(--color-text-muted))`}
  borderWidth={2}
  fontWeight="bold"
  textSize="2xs"
/>

// Fully dynamic background + border (AppRail static-switcher chip)
<InitialsAvatar
  initials={entry.initials}
  size="var(--nav-item-icon-size, 24px)"
  background={entry.accent ?? 'var(--color-accent-dim)'}
  className="text-text-primary"
  borderColor={isActive ? 'var(--color-nav-item-active-indicator)' : 'var(--color-border-default)'}
  borderWidth={isActive ? 2 : 1}
/>
```

**When to use:** Any circular initials fallback for a player/user avatar that has no image (or as the `fallback` of `SafeAvatar`).

**Never use:** For anything that isn't a circular initials glyph — it always renders `rounded-full` + centered text. `textSize="2xs"` (10px, below the 12px floor) only when the glyph is small enough (≤24px) that 12px would overflow AND the name renders directly adjacent.

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
