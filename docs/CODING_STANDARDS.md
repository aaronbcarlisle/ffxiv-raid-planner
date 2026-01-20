# Coding Standards & Conventions

This document defines the coding standards, naming conventions, and patterns used in the FFXIV Raid Planner project. All contributors should follow these guidelines to maintain consistency.

## Table of Contents

- [File Naming Conventions](#file-naming-conventions)
- [TypeScript/React Standards](#typescriptreact-standards)
- [Python Standards](#python-standards)
- [CSS & Styling](#css--styling)
- [Component Patterns](#component-patterns)
- [UI Component Selection](#ui-component-selection) ← **Read before implementing UI**
- [State Management](#state-management)
- [Git Conventions](#git-conventions)
- [Versioning](#versioning) ← **Follow semver for releases**
- [Documentation](#documentation)
- [Testing](#testing)

---

## File Naming Conventions

### Scripts

| Type | Convention | Example |
|------|------------|---------|
| Python (.py) | `snake_case` | `blend_tier_banners.py`, `migrate_add_is_admin.py` |
| Shell (.sh) | `kebab-case` | `check-design-system.sh`, `backup-db.sh` |
| TypeScript (.ts) | `kebab-case` | `fetch-xivapi-data.ts` |

**Rationale:**
- Python follows [PEP 8](https://peps.python.org/pep-0008/#package-and-module-names) which mandates snake_case for modules
- Shell scripts use kebab-case following common Unix conventions
- TypeScript scripts use kebab-case following Node.js/frontend ecosystem conventions

### React Components

| Type | Convention | Example |
|------|------------|---------|
| Component files | `PascalCase.tsx` | `PlayerCard.tsx`, `LootPriorityPanel.tsx` |
| Hook files | `camelCase.ts` | `useGroupViewState.ts`, `useModal.ts` |
| Utility files | `camelCase.ts` | `priority.ts`, `calculations.ts` |
| Test files | `{name}.test.ts(x)` | `priority.test.ts`, `Button.test.tsx` |
| Type definition files | `camelCase.ts` or `index.ts` | `types/index.ts` |

### Directories

| Type | Convention | Example |
|------|------------|---------|
| Component directories | `kebab-case` | `player/`, `static-group/`, `weapon-priority/` |
| Feature directories | `kebab-case` | `raid-tiers/`, `release-notes/` |
| Utility directories | `lowercase` | `utils/`, `lib/`, `hooks/` |

### Assets

| Type | Convention | Example |
|------|------------|---------|
| Images | `kebab-case` | `aac-heavyweight.png`, `og-image.png` |
| Icons | `kebab-case` or matching source | `favicon.ico`, `logo.svg` |
| Data files | `kebab-case` | `local_bis_presets.json` |

---

## TypeScript/React Standards

### General TypeScript

```typescript
// Use explicit return types for exported functions
export function calculatePriority(player: Player): number {
  // ...
}

// Use interfaces for object shapes (prefer over type aliases for objects)
interface PlayerData {
  id: string;
  name: string;
  job: Job;
}

// Use type aliases for unions, primitives, and utility types
type GearSlot = 'weapon' | 'head' | 'body' | 'hands' | 'legs' | 'feet';
type PlayerMap = Record<string, Player>;

// Use const assertions for literal objects
const FLOOR_COLORS = {
  floor1: '#ef4444',
  floor2: '#f59e0b',
} as const;
```

### React Components

```typescript
// Use function declarations for components
export function PlayerCard({ player, onUpdate }: PlayerCardProps) {
  // ...
}

// Props interface naming: ComponentNameProps
interface PlayerCardProps {
  player: Player;
  onUpdate: (player: Player) => void;
  className?: string;
}

// Destructure props in function signature
// Good
function Button({ variant, children, onClick }: ButtonProps) { }

// Avoid
function Button(props: ButtonProps) {
  const { variant, children, onClick } = props;
}
```

### Hooks

```typescript
// Custom hooks must start with "use"
export function useGroupViewState() { }
export function useModal<T>() { }

// Return objects for hooks with multiple values
export function useDoubleClickConfirm({ onConfirm, timeout }: Options) {
  return {
    isArmed,
    isLoading,
    handleClick,
    handleBlur,
  };
}

// Return tuples for simple state-like hooks
export function useToggle(initial = false): [boolean, () => void] {
  const [value, setValue] = useState(initial);
  const toggle = useCallback(() => setValue(v => !v), []);
  return [value, toggle];
}
```

### Imports

```typescript
// Order imports: React, external libs, internal absolute, internal relative
import { useState, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';

import { Player } from '../types';
import { useTierStore } from '../stores/tierStore';

import { PlayerCardHeader } from './PlayerCardHeader';
import styles from './PlayerCard.module.css';

// Use named exports (avoid default exports except for pages)
export function PlayerCard() { }  // Good
export default function PlayerCard() { }  // Avoid (except pages)
```

### Event Handlers

```typescript
// Prefix event handlers with "handle" or "on"
function PlayerCard({ onUpdate }: Props) {
  const handleClick = () => { };
  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => { };

  return <button onClick={handleClick}>...</button>;
}

// Use useCallback for handlers passed to children
const handleUpdate = useCallback((data: PlayerData) => {
  onUpdate(data);
}, [onUpdate]);
```

---

## Python Standards

Follow [PEP 8](https://peps.python.org/pep-0008/) with these project-specific additions:

### Naming

```python
# Variables and functions: snake_case
player_count = 0
def calculate_priority(player_data):
    pass

# Constants: SCREAMING_SNAKE_CASE
MAX_PLAYERS = 8
DEFAULT_OVERLAP_RATIO = 0.35

# Classes: PascalCase
class TierSnapshot:
    pass

# Private functions/variables: leading underscore
def _internal_helper():
    pass
```

### Type Hints

```python
# Use type hints for function signatures
def process_tier(
    tier_id: str,
    tier_data: dict,
    overlap_ratio: float = 0.35
) -> bool:
    """Process a single tier and create its composite banner."""
    pass

# Use Optional for nullable values
from typing import Optional

def get_player(player_id: str) -> Optional[Player]:
    pass
```

### Docstrings

```python
def blend_images_horizontal(images: list, overlap_ratio: float = 0.35) -> Image:
    """
    Blend multiple images horizontally with gradient transitions.

    Args:
        images: List of PIL Image objects to blend
        overlap_ratio: How much each image overlaps with the next (0.0-1.0)

    Returns:
        PIL Image of the blended result
    """
    pass
```

---

## CSS & Styling

### Design Tokens

Use Tailwind CSS utility classes with project-defined design tokens:

```typescript
// Role colors (jobs)
const roleColors = {
  tank: 'text-role-tank',      // #5a9fd4
  healer: 'text-role-healer',  // #5ad490
  melee: 'text-role-melee',    // #d45a5a
  ranged: 'text-role-ranged',  // #d4a05a
  caster: 'text-role-caster',  // #b45ad4
};

// Membership colors
const membershipColors = {
  owner: 'text-membership-owner',    // teal
  lead: 'text-membership-lead',      // purple
  member: 'text-membership-member',  // blue
  viewer: 'text-membership-viewer',  // zinc
};

// Material colors
const materialColors = {
  twine: 'text-material-twine',
  glaze: 'text-material-glaze',
  solvent: 'text-material-solvent',
  tomestone: 'text-material-tomestone',
};

// Status colors
const statusColors = {
  success: 'text-status-success',
  warning: 'text-status-warning',
  error: 'text-status-error',
  info: 'text-status-info',
};
```

### Component Styling

```typescript
// Use Tailwind classes directly
<button className="px-4 py-2 bg-accent text-white rounded hover:bg-accent/90">

// Use cn() utility for conditional classes
import { cn } from '../lib/utils';

<div className={cn(
  'base-styles',
  isActive && 'active-styles',
  variant === 'danger' && 'text-red-500'
)}>

// Avoid inline styles except for dynamic values
<div style={{ width: `${percentage}%` }}>
```

### Accessibility

```typescript
// Always include aria labels for icon buttons
<button aria-label="Close modal">
  <X className="w-4 h-4" />
</button>

// Use semantic HTML
<nav aria-label="Main navigation">
<button type="button">  // Not <div onClick>
<a href="/path">        // Not <span onClick>

// Include focus states
className="focus:outline-none focus:ring-2 focus:ring-accent"
```

---

## Component Patterns

### Modal Pattern

```typescript
// Use the useModal hook for modal state
import { useModal } from '../hooks/useModal';

function MyComponent() {
  const { isOpen, open, close } = useModal();

  return (
    <>
      <Button onClick={open}>Open Modal</Button>
      <Modal isOpen={isOpen} onClose={close} title="My Modal">
        {/* content */}
      </Modal>
    </>
  );
}

// All modals must have header icons (v1.0.8+)
<Modal
  isOpen={isOpen}
  onClose={close}
  title="Delete Player"
  icon={<Trash2 className="w-5 h-5 text-red-500" />}
>
```

### Double-Click Confirm Pattern

```typescript
// Use for destructive actions that don't need type-to-confirm
import { useDoubleClickConfirm } from '../hooks/useDoubleClickConfirm';

const { isArmed, handleClick, handleBlur } = useDoubleClickConfirm({
  onConfirm: async () => { await deleteItem(); },
  timeout: 3000,
});

<Button
  variant={isArmed ? 'warning' : 'danger'}
  onClick={handleClick}
  onBlur={handleBlur}
>
  {isArmed ? 'Confirm?' : 'Delete'}
</Button>
```

### Error Handling

```typescript
// Use ErrorMessage component for user-facing errors
import { ErrorMessage } from '../components/ui/ErrorMessage';

{error && (
  <ErrorMessage
    message={error}
    onRetry={handleRetry}
  />
)}

// Use centralized error handler for API errors
import { handleApiError } from '../lib/errorHandler';

try {
  await api.updatePlayer(data);
} catch (err) {
  handleApiError(err, 'update player', true);  // Shows toast
}
```

### Loading States

```typescript
// Use Skeleton components for loading states
import { StaticGridSkeleton } from '../components/ui/Skeleton';

if (isLoading) {
  return <StaticGridSkeleton count={6} />;
}
```

---

## UI Component Selection

**IMPORTANT:** Before implementing any new UI, check [UI_COMPONENTS.md](./UI_COMPONENTS.md) for existing components.

### Decision Tree

**Need a button?**
- Text button → `Button` with variant: `primary`, `secondary`, `ghost`, `danger`, `warning`, `success`, `link`
- Icon only → `IconButton` (requires `aria-label` for accessibility)
- NEVER use raw `<button>` elements

**Need job selection?**
- → Always use `JobPicker` from `components/player/JobPicker.tsx`
- Handles search, categories, keyboard navigation, role filtering
- NEVER recreate job selection UI

**Need position selection (T1, H2, M1, R2, etc)?**
- → Always use `PositionSelector` from `components/player/PositionSelector.tsx`
- Has role-based suggestions, 2x4 grid layout
- NEVER recreate position selection UI

**Need tank role selection (MT/OT)?**
- → Use `TankRoleSelector` from `components/player/TankRoleSelector.tsx`

**Need a dropdown menu?**
- List of actions → `Dropdown` + `DropdownItem` from `primitives/Dropdown.tsx`
- Select single value → `Select` from `ui/Select.tsx`
- Custom floating content → `Popover` from `primitives/Popover.tsx`
- NEVER use raw `<select>` elements

**Need text input?**
- → Use `Input` from `ui/Input.tsx`
- Supports error state, icons, helper text
- NEVER use raw `<input>` elements

**Need a modal/dialog?**
- Form or complex content → `Modal` + `useModal` hook
- Simple confirmation → `ConfirmModal`
- Destructive action without modal → `useDoubleClickConfirm` hook

**Need loading state?**
- Match content shape → Use appropriate `Skeleton` variant
- Inline loading → `Spinner`

**Need error display?**
- → Always use `ErrorMessage` with optional retry

**Need checkbox?**
- → Use `Checkbox` from `ui/Checkbox.tsx`
- NEVER use raw `<input type="checkbox">`

### Design System Compliance

Always run before committing UI changes:

```bash
# Check all violations (HTML elements + hardcoded colors)
./frontend/scripts/check-design-system.sh

# Only check raw HTML elements
./frontend/scripts/check-design-system.sh --html

# Only check hardcoded colors
./frontend/scripts/check-design-system.sh --colors

# Group violations by file (easier to fix one file at a time)
./frontend/scripts/check-design-system.sh --summary

# Strict mode (fails on violations, use in CI)
./frontend/scripts/check-design-system.sh --strict
```

**Inline ignore:** Add `// design-system-ignore` comment to ignore a specific line.

**HTML violations caught:**

| Pattern | Required Component |
|---------|-------------------|
| `<input ` | `Input`, `NumberInput`, or `Checkbox` |
| `<select ` | `Select` |
| `<button ` | `Button` or `IconButton` |
| `<label ` | `Label` |
| `<textarea ` | `TextArea` |

**Color violations caught:**

| Pattern | Required Token |
|---------|---------------|
| `#14b8a6` | `text-accent` or `bg-accent` |
| `#5a9fd4` | `text-role-tank` |
| `#5ad490` | `text-role-healer` |
| `#d45a5a` | `text-role-melee` |
| `#d4a05a` | `text-role-ranged` |
| `#b45ad4` | `text-role-caster` |
| `#ef4444` | `text-status-error` |
| `#22c55e` | `text-status-success` |
| (and 15+ more color patterns) |

### Color Tokens

Never hardcode colors. Use semantic Tailwind classes:

```typescript
// Role colors
className="text-role-tank"    // #5a9fd4
className="text-role-healer"  // #5ad490
className="text-role-melee"   // #d45a5a
className="text-role-ranged"  // #d4a05a
className="text-role-caster"  // #b45ad4

// Membership colors
className="text-membership-owner"   // teal
className="text-membership-lead"    // purple
className="text-membership-member"  // blue

// Status colors
className="text-status-success"
className="text-status-warning"
className="text-status-error"

// Surface hierarchy
className="bg-surface-base"       // Page background
className="bg-surface-card"       // Cards
className="bg-surface-elevated"   // Nested containers
className="bg-surface-overlay"    // Modals, dropdowns
```

---

## State Management

### Zustand Stores

```typescript
// Store file structure
// stores/exampleStore.ts

interface ExampleState {
  items: Item[];
  isLoading: boolean;
  error: string | null;
}

interface ExampleActions {
  fetchItems: () => Promise<void>;
  addItem: (item: Item) => void;
}

export const useExampleStore = create<ExampleState & ExampleActions>((set, get) => ({
  // State
  items: [],
  isLoading: false,
  error: null,

  // Actions
  fetchItems: async () => {
    set({ isLoading: true, error: null });
    try {
      const items = await api.getItems();
      set({ items, isLoading: false });
    } catch (err) {
      set({ error: parseApiError(err).message, isLoading: false });
    }
  },

  addItem: (item) => {
    set(state => ({ items: [...state.items, item] }));
  },
}));

// Use selector hooks to prevent re-renders
export const useExampleItems = () => useExampleStore(state => state.items);
export const useExampleLoading = () => useExampleStore(state => state.isLoading);
```

### URL State

```typescript
// Use URL as source of truth for shareable state
// Sync with localStorage for persistence

const [searchParams, setSearchParams] = useSearchParams();
const tab = searchParams.get('tab') || 'players';

// Update both URL and localStorage
const setTab = (newTab: string) => {
  setSearchParams({ ...Object.fromEntries(searchParams), tab: newTab });
  localStorage.setItem('selected-tab', newTab);
};
```

---

## Git Conventions

### Commit Messages

```
feat: add weapon priority tracking
fix: resolve race condition in membership creation
refactor: extract useGroupViewState hook from GroupView
docs: update API endpoint documentation
test: add priority calculation tests
chore: update dependencies
```

**Format:** `type: short description`

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code restructuring without behavior change
- `docs` - Documentation only
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

### Branch Naming

```
feature/weapon-priority
fix/modal-focus-trap
refactor/group-view-hooks
```

### Pull Requests

```markdown
## Summary
- Brief description of changes
- List of main modifications

## Test plan
- [ ] Manual testing steps
- [ ] Unit tests added/updated
- [ ] Integration tests pass
```

**IMPORTANT:** Never add AI attribution to commits or PRs.

---

## Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/). Version numbers follow the format `MAJOR.MINOR.PATCH`.

### Version Bump Rules

| Change Type | Version Bump | Examples |
|-------------|--------------|----------|
| **MAJOR** (x.0.0) | Breaking changes, backward incompatible API changes | Removing endpoints, changing data formats, major UI overhauls that break workflows |
| **MINOR** (0.x.0) | New features, backward compatible additions | New components, new API endpoints, new user-facing functionality |
| **PATCH** (0.0.x) | Bug fixes, security patches, internal improvements | Fixing crashes, security hardening, performance improvements, CI/tooling fixes |

### Decision Guide

**Bump MINOR when:**
- Adding a new user-facing feature (new modal, new panel, new functionality)
- Adding a new API endpoint
- Adding new components to the design system
- Adding new hooks or utilities that enable new capabilities

**Bump PATCH when:**
- Fixing bugs (crashes, incorrect behavior, visual glitches)
- Security improvements (CSRF, auth hardening, etc.)
- Performance optimizations
- Internal refactoring without feature changes
- CI/CD and tooling improvements
- Documentation updates

**Bump MAJOR when:**
- Removing or renaming API endpoints
- Changing response formats in breaking ways
- Major UI redesigns that change user workflows
- Dropping support for older data formats

### Release Notes Format

When creating a release in `frontend/src/data/releaseNotes.ts`:

```typescript
{
  version: '1.9.0',  // Follow semver rules above
  date: '2026-01-20T08:00:00Z',  // ISO 8601 format
  title: 'Short Descriptive Title',
  highlights: ['Key feature 1', 'Key feature 2'],  // 1-2 items max
  items: [
    {
      category: 'feature',  // feature | fix | improvement | breaking
      title: 'Feature name',
      description: 'Brief description',
      details: 'Extended explanation (optional)',
      commits: [{ hash: 'abc1234', message: 'commit message' }],
    },
  ],
}
```

### Category Guidelines

| Category | When to Use |
|----------|-------------|
| `feature` | New user-facing functionality |
| `improvement` | Enhancements to existing features |
| `fix` | Bug fixes |
| `breaking` | Breaking changes (should be rare) |

### Historical Note

Prior to v1.9.0 (January 2026), versioning was not strictly following semver - many feature releases were incorrectly tagged as patches. The version history was corrected in v1.9.0 to properly reflect the scope of each release.

---

## Documentation

### Code Comments

```typescript
// Use comments sparingly - code should be self-documenting
// Good: Explain WHY, not WHAT
// Compensate for API returning stale data during rapid updates
const debouncedFetch = useDebouncedCallback(fetchData, 300);

// Avoid: Obvious comments
// Bad: Increment the counter
counter++;
```

### JSDoc for Public APIs

```typescript
/**
 * Calculate loot priority score for a player
 *
 * @param player - The player to calculate priority for
 * @param floor - The floor number (1-4)
 * @returns Priority score (lower = higher priority)
 */
export function calculatePriority(player: Player, floor: number): number {
  // ...
}
```

### README Files

- Keep CLAUDE.md as the primary project documentation
- Add section-specific docs in `/docs/` for detailed topics
- Update OUTSTANDING_WORK.md with new issues/improvements

---

## Testing

### Test File Location

```
src/
├── utils/
│   ├── priority.ts
│   └── priority.test.ts    # Co-located with source
├── components/
│   └── ui/
│       ├── Button.tsx
│       └── Button.test.tsx
```

### Test Naming

```typescript
describe('calculatePriority', () => {
  it('returns lower score for players with fewer drops', () => {
    // ...
  });

  it('handles edge case of new player with no history', () => {
    // ...
  });
});
```

### Test Patterns

```typescript
// Use descriptive test names
it('should return empty array when no players match filter', () => {});

// Group related tests
describe('PlayerCard', () => {
  describe('when player is configured', () => {
    it('displays job icon', () => {});
    it('shows gear completion percentage', () => {});
  });

  describe('when player is not configured', () => {
    it('shows setup prompt', () => {});
  });
});
```

---

## Checklist for New Code

- [ ] File names follow conventions for the file type
- [ ] TypeScript types are explicit for exported functions
- [ ] React components use proper prop interfaces
- [ ] Hooks follow the `use` prefix convention
- [ ] CSS uses design tokens, not hardcoded colors
- [ ] Accessibility attributes included (aria-label, etc.)
- [ ] Error states handled with ErrorMessage component
- [ ] Loading states use Skeleton components
- [ ] Tests added for new utilities and complex logic
- [ ] Documentation updated if adding new patterns
