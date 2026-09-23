# Loot Priority Components (v1.0.10)

> Part of the [UI component inventory](../UI_COMPONENTS.md) — moved here verbatim on 2026-09-23 so the entry doc stays small. Quick Reference, decision tree, tokens and the compliance checker live there.


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
