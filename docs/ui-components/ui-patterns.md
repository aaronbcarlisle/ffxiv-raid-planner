# UI Patterns

> Part of the [UI component inventory](../UI_COMPONENTS.md) — moved here verbatim on 2026-09-23 so the entry doc stays small. Quick Reference, decision tree, tokens and the compliance checker live there.


### Modal

**Path:** `components/ui/Modal.tsx`

**Purpose:** Dialog box with focus trap and backdrop.

**Props:**
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;           // Put any icon inside the title node (no separate `icon` prop)
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  variant?: 'dialog' | 'sheet';  // 'sheet' slides up from bottom; auto-selects by screen size
  footer?: ReactNode;         // Optional sticky footer
  className?: string;
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
  title={<><Settings className="w-5 h-5" /> Settings</>}
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

**When to use:** Dismissible/retryable API errors, fetch failures.

---

### ErrorBox (v1.0.12)

**Path:** `components/ui/ErrorMessage.tsx`

**Purpose:** Simple inline error display for modals and panels.

**Props:**
```typescript
interface ErrorBoxProps {
  message: string;
  size?: 'sm' | 'md';
  className?: string;
}
```

**Usage:**
```tsx
import { ErrorBox } from '../components/ui/ErrorMessage';

{error && <ErrorBox message={error} size="sm" />}
```

**When to use:** Simple inline errors in modals, panels, forms (no retry/dismiss needed).

**Error Component Pattern:**
- `ErrorMessage` - Dismissible/retryable, for page-level errors
- `ErrorBox` - Simple inline, for contextual errors
- `InlineError` - Form validation, attached to inputs
- Toast - Transient notifications

---

### Spinner (v1.0.12)

**Path:** `components/ui/Spinner.tsx`

**Purpose:** Unified loading spinner with consistent sizing.

**Props:**
```typescript
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  color?: 'accent' | 'current';   // only these two
  className?: string;
  label?: string;  // For accessibility (Spinner only)
}
```

**Size Reference:**
- `sm` - 16px (inline, buttons)
- `md` - 24px (default)
- `lg` - 32px (sections)
- `xl` - 40px (panels)
- `2xl` - 48px (full-page)

**Usage:**
```tsx
import { Spinner, SpinnerOverlay } from '../components/ui/Spinner';

// Inline spinner
<Spinner size="sm" />

// Full area overlay (note: SpinnerOverlay uses `text`, not `label`)
<SpinnerOverlay size="lg" text="Loading players..." />

// Button loading state (uses Spinner internally)
<Button loading={isLoading}>Save</Button>
```

**When to use:** Any loading state. Prefer this over custom spinners.

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

### StatCell

**Path:** `components/ui/StatCell.tsx`

**Purpose:** The one value/label(/detail) stat idiom — a big value over an uppercase label, with an optional caption line.

**Props:**
```typescript
interface StatCellProps {
  value: ReactNode;
  label: string;
  detail?: ReactNode;      // optional third line, e.g. "4/5 obtained"
  valueClassName?: string; // overrides the value's color; omit for text-text-primary
  align?: 'center' | 'start'; // default 'center'
}
```

**Usage:**
```tsx
import { StatCell } from '../components/ui/StatCell';

<StatCell value="87%" label="At full BiS" />
<StatCell align="start" label="Distribution" value="Even" valueClassName="text-status-success" detail="spread 1" />
```

**When to use:** Any value/label stat display (Roster Readiness, Loot Fairness). Don't build a bespoke stat tile — this is the shared idiom.

---

### TabNavigation

**Path:** `components/ui/TabNavigation.tsx`

**Purpose:** Main page tab bar.

**When to use:** Primary navigation between page sections.
