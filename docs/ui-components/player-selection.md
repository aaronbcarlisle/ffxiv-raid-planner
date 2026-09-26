# Player Selection

> Part of the [UI component inventory](../UI_COMPONENTS.md) — moved here verbatim on 2026-09-23 so the entry doc stays small. Quick Reference, decision tree, tokens and the compliance checker live there.


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

**When to use:** Tank-specific role assignment. V1 only — the V2 roster card uses `TankSeatSelector` instead (below).

---

### TankSeatSelector

**Path:** `components/player/TankSeatSelector.tsx`

**Purpose:** the V2 roster card's tank seat — role (MT/OT) and raid position (T1/T2) merged into one chip and one popover, so the card's header stays on one line. `TankRoleSelector` and `PositionSelector` stay untouched for V1.

**Props:**
```typescript
interface TankSeatSelectorProps {
  tankRole: TankRole | null | undefined;
  position: RaidPosition | null | undefined;
  onTankRoleSelect: (role: TankRole | undefined) => void;
  onPositionSelect: (position: RaidPosition | undefined) => void;
  player: SnapshotPlayer;
  userRole?: MemberRole | null;
  currentUserId?: string;
  isAdmin?: boolean;
}
```

**Usage:**
```tsx
import { TankSeatSelector } from '../components/player/TankSeatSelector';

<TankSeatSelector
  tankRole={player.tankRole}
  position={player.position}
  onTankRoleSelect={(role) => updatePlayer({ ...player, tankRole: role ?? null })}
  onPositionSelect={(position) => updatePlayer({ ...player, position: position ?? null })}
  player={player}
/>
```

**When to use:** V2 roster card, tank players only. A pick does not close the popover — the two halves are usually set together.

---

### BiSSourceSelector

**Path:** `components/player/BiSSourceSelector.tsx`

**Purpose:** BiS gear source selector (Raid/Tome/B. Tome/Crafted) for gear table rows.

**Props:**
```typescript
interface BiSSourceSelectorProps {
  bisSource: GearSource | null;  // 'raid' | 'tome' | 'base_tome' | 'crafted' | null
  onSelect: (source: GearSource | null) => void;
  disabled?: boolean;
  disabledReason?: string;
}
```

**Features:**
- 2x2 grid layout in popover
- Four BiS sources with distinct colors:
  - **Raid** (R) - Red - Savage drops
  - **Tome** (T) - Teal - Tomestone gear that needs augmentation
  - **B. Tome** (BT) - Blue - Base tomestone where unaugmented version is BiS
  - **Crafted** (C) - Orange - Crafted pentamelded gear
- Clear Slot option to reset to unset state
- ARIA labels for accessibility

**Usage:**
```tsx
import { BiSSourceSelector } from '../components/player/BiSSourceSelector';

<BiSSourceSelector
  bisSource={gearSlot.bisSource}
  onSelect={(source) => updateGearSlot({ bisSource: source })}
  disabled={!canEdit}
  disabledReason="You don't have permission to edit"
/>
```

**When to use:** BiS source selection in GearTable rows.

**NEVER recreate:** Use this component for any BiS source selection.
