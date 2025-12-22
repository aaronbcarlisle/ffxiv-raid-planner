# Phase 2 Implementation Plan: UX Enhancements

## Overview

This document details the implementation plan for Phase 2 UX enhancements to the FFXIV Raid Planner. These changes focus on improved navigation, better information density, and streamlined workflows.

**Status: Complete** - All Phase 2 features implemented.

---

## Feature Summary

| Feature | Priority | Complexity | Status |
|---------|----------|------------|--------|
| 1. Tab-Based Navigation (Party/Loot/Stats) | High | Medium | ✅ Complete |
| 2. Responsive 3-Column Grid | High | Low | ✅ Complete |
| 3. Global View Mode Toggle | High | Medium | ✅ Complete |
| 4. Player Card Needs Footer | Medium | Low | ✅ Complete |
| 5. Double-Click Name Edit | Medium | Low | ✅ Complete |
| 6. Tome Weapon Sub-Row | Medium | Medium | ✅ Complete |
| 7. Right-Click Context Menu | Medium | Medium | ✅ Complete |

### Additional Features Implemented
| Feature | Description |
|---------|-------------|
| FFXIV Icons | Tab and context menu icons from XIVAPI with transparent backgrounds |
| Raid Positions | T1/T2/H1/H2/M1/M2/R1/R2 position system with role-based coloring |
| Tank Roles | MT/OT designation badges for tanks |
| Gear Slot Icons | Completion-based icon styling (white when complete) |
| Layout Stability | Fixed tab switching layout shifts |

---

## 1. Tab-Based Navigation

### Current State
- `SummaryPanel` has internal tabs for Loot/Stats
- Tabs are at bottom of page, below player grid
- Users must scroll to access loot priority

### Target State
- Page-level tabs: **Players | Loot | Stats**
- Each tab shows a full-screen dedicated view
- Floor selector remains visible in all tabs

### Implementation

#### 1.1 Add Page Mode to Store

**File:** `src/stores/staticStore.ts`

```typescript
export type PageMode = 'players' | 'loot' | 'stats';

interface StaticState {
  // ... existing
  pageMode: PageMode;
  setPageMode: (mode: PageMode) => void;
}

// In create():
pageMode: 'players',
setPageMode: (pageMode) => set({ pageMode }),
```

#### 1.2 Create TabNavigation Component

**File:** `src/components/ui/TabNavigation.tsx` (NEW)

```typescript
interface TabNavigationProps {
  activeTab: PageMode;
  onTabChange: (tab: PageMode) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs: { id: PageMode; label: string; icon: string }[] = [
    { id: 'players', label: 'Players', icon: '👥' },
    { id: 'loot', label: 'Loot Mode', icon: '🎯' },
    { id: 'stats', label: 'Stats', icon: '📊' },
  ];

  return (
    <div className="flex gap-2">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 rounded-t font-medium transition-colors ${
            activeTab === tab.id
              ? 'bg-bg-card text-accent border border-b-0 border-border-default'
              : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
          }`}
        >
          {tab.icon} {tab.label}
        </button>
      ))}
    </div>
  );
}
```

#### 1.3 Create LootModeView Component

**File:** `src/components/loot/LootModeView.tsx` (NEW)

Dedicated full-screen loot distribution view:
- Banner: "Loot Mode Active - Click a player to assign loot"
- Grid of loot item cards for selected floor
- Priority list per item (who needs it, ranked by score)
- Quick reference bar showing all players by priority order

```typescript
interface LootModeViewProps {
  players: Player[];
  settings: StaticSettings;
  selectedFloor: FloorNumber;
  floorName: string;
}

export function LootModeView({ players, settings, selectedFloor, floorName }: LootModeViewProps) {
  const floorDrops = getFloorDrops(selectedFloor);

  return (
    <div>
      {/* Info Banner */}
      <div className="bg-accent/10 border border-accent/30 rounded p-3 mb-4">
        <span className="text-accent font-medium">🎯 Loot Mode Active</span>
        <span className="text-text-secondary ml-2">— Click a player to assign loot</span>
      </div>

      {/* Loot Items Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {floorDrops.gear.map(item => (
          <LootItemCard key={item} item={item} players={players} settings={settings} />
        ))}
        {floorDrops.upgrades.map(material => (
          <LootItemCard key={material} item={material} players={players} settings={settings} isUpgrade />
        ))}
      </div>

      {/* Quick Reference Bar */}
      <div className="mt-6 p-4 bg-bg-secondary rounded">
        <div className="text-sm text-text-secondary mb-2">Quick Reference - Priority Order</div>
        <div className="flex flex-wrap gap-2">
          {sortByPriority(players, settings).map(player => (
            <PlayerChip key={player.id} player={player} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

#### 1.4 Create LootItemCard Component

**File:** `src/components/loot/LootItemCard.tsx` (NEW)

Individual loot item with priority list:

```typescript
interface LootItemCardProps {
  item: string;
  players: Player[];
  settings: StaticSettings;
  isUpgrade?: boolean;
  onAssign?: (playerId: string, item: string) => void;
}

export function LootItemCard({ item, players, settings, isUpgrade, onAssign }: LootItemCardProps) {
  const needers = isUpgrade
    ? getUpgradePriority(players, item, settings)
    : getGearPriority(players, item, settings);

  return (
    <div className="bg-bg-card border border-border-default rounded p-4">
      {/* Header */}
      <div className="font-medium text-lg mb-3">
        {isUpgrade ? '✦' : '⚔️'} {formatItemName(item)}
      </div>

      {/* Priority List */}
      {needers.length === 0 ? (
        <div className="text-green-500">✓ No one needs</div>
      ) : (
        <div className="space-y-2">
          {needers.slice(0, 4).map((entry, i) => (
            <div
              key={entry.player.id}
              onClick={() => onAssign?.(entry.player.id, item)}
              className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-bg-secondary ${
                i === 0 ? 'bg-accent/10 border border-accent/30' : ''
              }`}
            >
              <span className="text-text-secondary w-6">{i + 1}.</span>
              <JobBadge job={entry.player.job} size="sm" />
              <span className="flex-1">{entry.player.name}</span>
              <span className="text-sm text-text-secondary">{entry.reason}</span>
              <span className="text-xs bg-bg-secondary px-2 py-0.5 rounded">P{entry.score}</span>
            </div>
          ))}
          {needers.length > 4 && (
            <div className="text-sm text-text-secondary">+{needers.length - 4} more</div>
          )}
        </div>
      )}
    </div>
  );
}
```

#### 1.5 Create StatsView Component

**File:** `src/components/team/StatsView.tsx` (NEW)

Full-page stats view (elevate TeamSummary content):

```typescript
interface StatsViewProps {
  players: Player[];
  teamSummary: TeamSummaryData;
}

export function StatsView({ players, teamSummary }: StatsViewProps) {
  return (
    <div className="space-y-6">
      {/* Team Completion */}
      <section className="bg-bg-card border border-border-default rounded p-4">
        <h3 className="text-lg font-medium mb-4">Team Completion</h3>
        {/* Progress bar and stats */}
      </section>

      {/* Materials Needed */}
      <section className="bg-bg-card border border-border-default rounded p-4">
        <h3 className="text-lg font-medium mb-4">Materials Needed</h3>
        {/* Twine, Glaze, Solvent totals */}
      </section>

      {/* Books by Floor */}
      <section className="bg-bg-card border border-border-default rounded p-4">
        <h3 className="text-lg font-medium mb-4">Books Needed</h3>
        {/* Floor 1-4 book requirements */}
      </section>

      {/* Per-Player Breakdown */}
      <section className="bg-bg-card border border-border-default rounded p-4">
        <h3 className="text-lg font-medium mb-4">Player Breakdown</h3>
        {/* Table: Player | Raid | Tome | Aug | Weeks */}
      </section>
    </div>
  );
}
```

#### 1.6 Update StaticView Page

**File:** `src/pages/StaticView.tsx`

```typescript
export function StaticView() {
  const { pageMode, setPageMode, /* ... */ } = useStaticStore();

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between mb-4">
        <div>{/* Static name */}</div>
        <div>{/* Share button */}</div>
      </div>

      {/* Toolbar Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        {/* Left: Tab Navigation */}
        <TabNavigation activeTab={pageMode} onTabChange={setPageMode} />

        {/* Center: Floor Selector */}
        <FloorSelector floors={tierInfo.floors} selectedFloor={selectedFloor} onFloorChange={setSelectedFloor} />

        {/* Right: View Toggle (only shown in Players tab) */}
        {pageMode === 'players' && (
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        )}
      </div>

      {/* Tab Content */}
      {pageMode === 'players' && (
        <PlayersGrid players={sortedPlayers} viewMode={viewMode} /* ... */ />
      )}
      {pageMode === 'loot' && (
        <LootModeView players={configuredPlayers} settings={settings} selectedFloor={selectedFloor} floorName={floorName} />
      )}
      {pageMode === 'stats' && teamSummary && (
        <StatsView players={configuredPlayers} teamSummary={teamSummary} />
      )}
    </div>
  );
}
```

---

## 2. Responsive 4-Column Grid

### Current State
- Grid: `md:grid-cols-2` (max 2 columns)
- Wide monitors show 2 large cards with wasted space

### Target State
| Breakpoint | Width | Columns |
|------------|-------|---------|
| Default | <768px | 1 |
| md | ≥768px | 2 |
| lg | ≥1024px | 3 |
| xl | ≥1280px | 4 |

### Implementation

#### 2.1 Update Grid Classes

**File:** `src/pages/StaticView.tsx` (or new PlayersGrid component)

Change:
```typescript
// OLD
<div className="grid gap-4 md:grid-cols-2 mb-8">

// NEW
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
```

#### 2.2 Adjust Card Min-Width

Ensure cards don't get too narrow. Add to PlayerCard:

```css
/* In Tailwind config or component styles */
.player-card {
  min-width: 280px;
}
```

Or use grid with auto-fit:
```typescript
<div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
```

---

## 3. Global View Mode Toggle + Individual Expand

### Current State
- Store has `viewMode: 'compact' | 'expanded'` but NOT wired
- Each PlayerCard has local `isExpanded` state
- No global toggle UI

### Target State
- Global toggle (▤/☰) controls default view for all cards
- Individual cards can still be expanded/collapsed independently
- Clicking toggle resets all cards to match global mode

### Implementation

#### 3.1 Wire Up Store ViewMode

**File:** `src/pages/StaticView.tsx`

```typescript
const { viewMode, setViewMode } = useStaticStore();
```

#### 3.2 Create ViewModeToggle Component

**File:** `src/components/ui/ViewModeToggle.tsx` (NEW)

```typescript
interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="flex border border-border-default rounded overflow-hidden">
      <button
        onClick={() => onChange('compact')}
        className={`px-3 py-1.5 ${value === 'compact' ? 'bg-accent/30 text-accent' : 'text-text-secondary hover:text-text-primary'}`}
        title="Compact view"
      >
        ▤
      </button>
      <button
        onClick={() => onChange('expanded')}
        className={`px-3 py-1.5 ${value === 'expanded' ? 'bg-accent/30 text-accent' : 'text-text-secondary hover:text-text-primary'}`}
        title="Expanded view"
      >
        ☰
      </button>
    </div>
  );
}
```

#### 3.3 Update PlayerCard for Hybrid Behavior

**File:** `src/components/player/PlayerCard.tsx`

```typescript
interface PlayerCardProps {
  player: Player;
  settings: StaticSettings;
  globalViewMode: ViewMode;  // NEW: from store
  onUpdate: (updates: Partial<Player>) => void;
  onRemove: () => void;
}

export function PlayerCard({ player, settings, globalViewMode, onUpdate, onRemove }: PlayerCardProps) {
  // Local override: null means "follow global", true/false means "override"
  const [localExpanded, setLocalExpanded] = useState<boolean | null>(null);

  // Reset local override when global changes
  useEffect(() => {
    setLocalExpanded(null);
  }, [globalViewMode]);

  // Determine actual expanded state
  const isExpanded = localExpanded !== null
    ? localExpanded
    : globalViewMode === 'expanded';

  // Toggle individual card (creates local override)
  const handleToggle = () => {
    setLocalExpanded(prev => prev !== null ? !prev : !isExpanded);
  };

  // ... rest of component
}
```

---

## 4. Player Card Needs Footer

### Current State
- Collapsed view shows: `■ X raid | ■ X tome | ■ X aug`
- No tomestone weeks calculation

### Target State
Footer row at bottom of EVERY card (compact and expanded):
```
| 4 Raid Need | 1 Tome Need | 4 Upgrades | 2 Tome Wks |
```

### Implementation

#### 4.1 Add Calculation Utility

**File:** `src/utils/calculations.ts`

```typescript
export function calculateTomeWeeks(player: Player): number {
  const TOME_CAP_PER_WEEK = 450;
  const tomeCosts = getTomestoneCosts(); // From gamedata

  let totalTomesNeeded = 0;

  for (const slot of player.gear) {
    if (slot.bisSource === 'tome' && !slot.hasItem) {
      totalTomesNeeded += tomeCosts[slot.slot];
    }
  }

  // Include tome weapon if pursuing
  if (player.tomeWeapon?.pursuing && !player.tomeWeapon.hasItem) {
    totalTomesNeeded += tomeCosts.weapon; // 500
  }

  return Math.ceil(totalTomesNeeded / TOME_CAP_PER_WEEK);
}

export interface PlayerNeeds {
  raidNeed: number;
  tomeNeed: number;
  upgrades: number;
  tomeWeeks: number;
}

export function calculatePlayerNeeds(player: Player): PlayerNeeds {
  let raidNeed = 0;
  let tomeNeed = 0;
  let upgrades = 0;

  for (const slot of player.gear) {
    if (slot.bisSource === 'raid' && !slot.hasItem) {
      raidNeed++;
    } else if (slot.bisSource === 'tome') {
      if (!slot.hasItem) {
        tomeNeed++;
      } else if (!slot.isAugmented) {
        upgrades++;
      }
    }
  }

  // Include tome weapon upgrades if pursuing
  if (player.tomeWeapon?.pursuing) {
    if (!player.tomeWeapon.hasItem) {
      tomeNeed++;
    } else if (!player.tomeWeapon.isAugmented) {
      upgrades++;
    }
  }

  return {
    raidNeed,
    tomeNeed,
    upgrades,
    tomeWeeks: calculateTomeWeeks(player),
  };
}
```

#### 4.2 Create NeedsFooter Component

**File:** `src/components/player/NeedsFooter.tsx` (NEW)

```typescript
interface NeedsFooterProps {
  needs: PlayerNeeds;
}

export function NeedsFooter({ needs }: NeedsFooterProps) {
  const stats = [
    { label: 'Raid Need', value: needs.raidNeed, color: 'text-red-400' },
    { label: 'Tome Need', value: needs.tomeNeed, color: 'text-green-400' },
    { label: 'Upgrades', value: needs.upgrades, color: 'text-yellow-400' },
    { label: 'Tome Wks', value: needs.tomeWeeks, color: 'text-blue-400' },
  ];

  return (
    <div className="flex justify-between items-center mt-4 pt-3 border-t border-border-default">
      {stats.map(stat => (
        <div key={stat.label} className="text-center">
          <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
          <div className="text-xs text-text-secondary">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
```

#### 4.3 Add Footer to PlayerCard

**File:** `src/components/player/PlayerCard.tsx`

Add at the end of the card content (both compact and expanded):

```typescript
{/* Needs Footer - always visible */}
<NeedsFooter needs={calculatePlayerNeeds(player)} />
```

---

## 5. Double-Click Name Edit

### Current State
- Name editing only via InlinePlayerEdit (full form)
- No quick inline editing on existing cards

### Target State
- Double-click player name → inline text input
- Enter/blur saves, Escape cancels

### Implementation

#### 5.1 Add Editing State to PlayerCard

**File:** `src/components/player/PlayerCard.tsx`

```typescript
const [isEditingName, setIsEditingName] = useState(false);
const [editedName, setEditedName] = useState(player.name);
const nameInputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (isEditingName && nameInputRef.current) {
    nameInputRef.current.focus();
    nameInputRef.current.select();
  }
}, [isEditingName]);

const handleNameDoubleClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  setEditedName(player.name);
  setIsEditingName(true);
};

const handleNameSave = () => {
  if (editedName.trim() && editedName !== player.name) {
    onUpdate({ name: editedName.trim() });
  }
  setIsEditingName(false);
};

const handleNameKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') {
    handleNameSave();
  } else if (e.key === 'Escape') {
    setIsEditingName(false);
    setEditedName(player.name);
  }
};
```

#### 5.2 Update Name Display

```typescript
{/* Player Name */}
{isEditingName ? (
  <input
    ref={nameInputRef}
    type="text"
    value={editedName}
    onChange={(e) => setEditedName(e.target.value)}
    onBlur={handleNameSave}
    onKeyDown={handleNameKeyDown}
    className="bg-bg-secondary border border-accent rounded px-2 py-1 text-lg font-medium"
    onClick={(e) => e.stopPropagation()}
  />
) : (
  <span
    className="text-lg font-medium cursor-pointer hover:text-accent"
    onDoubleClick={handleNameDoubleClick}
    title="Double-click to edit"
  >
    {player.name}
  </span>
)}
```

---

## 6. Tome Weapon Sub-Row

### Current State
- Weapon slot treated same as other slots
- `bisSource` can be 'raid' or 'tome'
- No interim tome weapon tracking

### Target State
- Weapon source options: **Raid** | **Raid + Tome**
- Selecting "Raid + Tome" shows sub-row for tome weapon
- Tome weapon sub-row: fixed "Tome" source, Have/Aug checkboxes
- Main weapon row always tracks raid weapon (BiS)

### Implementation

#### 6.1 Update Player Type

**File:** `src/types/index.ts`

```typescript
interface TomeWeaponStatus {
  pursuing: boolean;    // "Raid + Tome" selected
  hasItem: boolean;     // Got the tome weapon
  isAugmented: boolean; // Augmented it
}

interface Player {
  // ... existing fields
  tomeWeapon: TomeWeaponStatus;
}
```

#### 6.2 Update Player Creation

**File:** `src/stores/staticStore.ts`

```typescript
// In createTemplatePlayers:
tomeWeapon: {
  pursuing: false,
  hasItem: false,
  isAugmented: false,
},
```

#### 6.3 Create WeaponSlotRow Component

**File:** `src/components/player/WeaponSlotRow.tsx` (NEW)

```typescript
interface WeaponSlotRowProps {
  weaponSlot: GearSlotStatus;
  tomeWeapon: TomeWeaponStatus;
  onWeaponChange: (updates: Partial<GearSlotStatus>) => void;
  onTomeWeaponChange: (updates: Partial<TomeWeaponStatus>) => void;
}

export function WeaponSlotRow({ weaponSlot, tomeWeapon, onWeaponChange, onTomeWeaponChange }: WeaponSlotRowProps) {
  const isPursuing = tomeWeapon.pursuing;

  return (
    <>
      {/* Main Weapon Row */}
      <tr className="border-b border-border-default">
        <td className="py-2 px-3 font-medium">Weapon</td>
        <td className="py-2 px-3">
          <div className="flex gap-1">
            <button
              onClick={() => onTomeWeaponChange({ pursuing: false })}
              className={`px-2 py-0.5 text-xs rounded ${!isPursuing ? 'bg-red-600 text-white' : 'bg-bg-secondary text-text-secondary'}`}
            >
              Raid
            </button>
            <button
              onClick={() => onTomeWeaponChange({ pursuing: true })}
              className={`px-2 py-0.5 text-xs rounded ${isPursuing ? 'bg-accent text-bg-primary' : 'bg-bg-secondary text-text-secondary'}`}
            >
              Raid + Tome
            </button>
          </div>
        </td>
        <td className="py-2 px-3 text-center">
          <input
            type="checkbox"
            checked={weaponSlot.hasItem}
            onChange={(e) => onWeaponChange({ hasItem: e.target.checked })}
            className="w-4 h-4"
          />
        </td>
        <td className="py-2 px-3 text-center text-text-disabled">—</td>
      </tr>

      {/* Tome Weapon Sub-Row (conditional) */}
      {isPursuing && (
        <tr className="border-b border-border-default bg-bg-secondary/50">
          <td className="py-2 px-3 pl-8 text-sm text-text-secondary">
            └ Tome Weapon
          </td>
          <td className="py-2 px-3">
            <span className="px-2 py-0.5 text-xs rounded bg-green-600 text-white">Tome</span>
          </td>
          <td className="py-2 px-3 text-center">
            <input
              type="checkbox"
              checked={tomeWeapon.hasItem}
              onChange={(e) => onTomeWeaponChange({ hasItem: e.target.checked })}
              className="w-4 h-4"
            />
          </td>
          <td className="py-2 px-3 text-center">
            <input
              type="checkbox"
              checked={tomeWeapon.isAugmented}
              onChange={(e) => onTomeWeaponChange({ isAugmented: e.target.checked })}
              disabled={!tomeWeapon.hasItem}
              className="w-4 h-4"
            />
          </td>
        </tr>
      )}
    </>
  );
}
```

#### 6.4 Update GearTable

**File:** `src/components/player/GearTable.tsx`

- Import and use `WeaponSlotRow` for weapon slot
- Pass `tomeWeapon` prop down from PlayerCard
- Handle `onTomeWeaponChange` callback

---

## 7. Right-Click Context Menu

### Current State
- No context menu on player cards
- Copy functionality not implemented

### Target State
Right-click on PlayerCard shows menu:
- **Copy Player** - Stores player data in state
- **Paste Player** - Only shown if clipboard has data; overwrites card
- **Duplicate Player** - Creates new card, focuses name input

### Implementation

#### 7.1 Add Clipboard State to Store

**File:** `src/stores/staticStore.ts`

```typescript
interface StaticState {
  // ... existing
  clipboardPlayer: Player | null;
  setClipboardPlayer: (player: Player | null) => void;
}

// In create():
clipboardPlayer: null,
setClipboardPlayer: (player) => set({ clipboardPlayer: player }),
```

#### 7.2 Create ContextMenu Component

**File:** `src/components/ui/ContextMenu.tsx` (NEW)

```typescript
interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
}

export function ContextMenu({ x, y, onClose, children }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed bg-bg-card border border-border-default rounded shadow-lg py-1 z-50 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {children}
    </div>
  );
}

interface ContextMenuItemProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function ContextMenuItem({ onClick, disabled, children }: ContextMenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-4 py-2 text-sm ${
        disabled
          ? 'text-text-disabled cursor-not-allowed'
          : 'hover:bg-bg-secondary'
      }`}
    >
      {children}
    </button>
  );
}
```

#### 7.3 Add Context Menu to PlayerCard

**File:** `src/components/player/PlayerCard.tsx`

```typescript
const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
const { clipboardPlayer, setClipboardPlayer, addPlayer, setEditingPlayerId } = useStaticStore();

const handleContextMenu = (e: React.MouseEvent) => {
  e.preventDefault();
  setContextMenu({ x: e.clientX, y: e.clientY });
};

const handleCopy = () => {
  setClipboardPlayer({ ...player });
  setContextMenu(null);
};

const handlePaste = () => {
  if (clipboardPlayer) {
    onUpdate({
      ...clipboardPlayer,
      id: player.id, // Keep original ID
      name: clipboardPlayer.name + ' (copy)',
    });
  }
  setContextMenu(null);
};

const handleDuplicate = () => {
  const newPlayer = {
    ...player,
    id: crypto.randomUUID(),
    name: player.name,
  };
  addPlayer(newPlayer);
  setEditingPlayerId(newPlayer.id); // Opens inline edit
  setContextMenu(null);
};

// In JSX:
<div onContextMenu={handleContextMenu} className="...">
  {/* Card content */}

  {contextMenu && (
    <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
      <ContextMenuItem onClick={handleCopy}>
        📋 Copy Player
      </ContextMenuItem>
      <ContextMenuItem onClick={handlePaste} disabled={!clipboardPlayer}>
        📥 Paste Player
      </ContextMenuItem>
      <ContextMenuItem onClick={handleDuplicate}>
        ⧉ Duplicate Player
      </ContextMenuItem>
    </ContextMenu>
  )}
</div>
```

---

## Files to Create/Modify Summary

### New Files
| File | Purpose |
|------|---------|
| `src/components/ui/TabNavigation.tsx` | Page-level tab buttons |
| `src/components/ui/ViewModeToggle.tsx` | ▤/☰ toggle component |
| `src/components/ui/ContextMenu.tsx` | Right-click menu component |
| `src/components/loot/LootModeView.tsx` | Full loot distribution view |
| `src/components/loot/LootItemCard.tsx` | Individual item priority card |
| `src/components/team/StatsView.tsx` | Full stats page view |
| `src/components/player/NeedsFooter.tsx` | 4-stat footer component |
| `src/components/player/WeaponSlotRow.tsx` | Special weapon row with sub-row |

### Modified Files
| File | Changes |
|------|---------|
| `src/stores/staticStore.ts` | Add pageMode, clipboardPlayer state |
| `src/types/index.ts` | Add TomeWeaponStatus, update Player |
| `src/pages/StaticView.tsx` | Tab navigation, view toggle, grid columns |
| `src/components/player/PlayerCard.tsx` | Global view mode, context menu, name edit, needs footer |
| `src/components/player/GearTable.tsx` | Weapon sub-row integration |
| `src/utils/calculations.ts` | Add calculatePlayerNeeds, calculateTomeWeeks |

---

## Implementation Order

### Phase 2A: Foundation (Do First)
1. Update types (TomeWeaponStatus)
2. Update store (pageMode, clipboardPlayer, defaults)
3. Update grid to 4 columns

### Phase 2B: Core Features
4. Create TabNavigation component
5. Create ViewModeToggle component
6. Wire global view mode to PlayerCard
7. Create NeedsFooter component
8. Add double-click name edit

### Phase 2C: Loot Mode
9. Create LootItemCard component
10. Create LootModeView component
11. Integrate into StaticView

### Phase 2D: Stats & Polish
12. Create StatsView component
13. Create WeaponSlotRow with sub-row
14. Create ContextMenu component
15. Add context menu to PlayerCard

### Phase 2E: Testing & Cleanup
16. Test all responsive breakpoints
17. Test view mode synchronization
18. Test context menu positioning
19. Update documentation

---

## Testing Checklist

### Grid Layout
- [x] 3-column grid at lg breakpoint (≥1024px)
- [x] 2-column grid at md breakpoint (≥768px)
- [x] 1-column grid on mobile (<768px)

### View Mode Toggle
- [x] Global ▤ toggle switches all cards to compact
- [x] Global ☰ toggle switches all cards to expanded
- [x] Individual card click still expands/collapses
- [x] Duplicated cards inherit expansion state from source

### Player Card Features
- [x] Double-click name enters edit mode
- [x] Enter saves name, Escape cancels
- [x] Needs footer shows on all cards (Raid/Tome/Upgrades/Weeks)
- [x] Tome Wks calculation is accurate
- [x] Raid position selector with role-based coloring
- [x] Tank role badges (MT/OT) for tanks

### Tome Weapon
- [x] "+Tome" toggle shows weapon sub-row
- [x] Toggling off hides sub-row
- [x] Tome weapon included in tomeNeed calculation (500 tomestones)
- [x] Tome weapon augmentation included in upgrades calculation
- [x] Solvent priority includes tome weapon augmentation needs

### Context Menu
- [x] Right-click shows context menu with FFXIV icons
- [x] Copy stores player data
- [x] Paste overwrites target card (disabled when no clipboard)
- [x] Duplicate creates new card
- [x] Remove shows confirmation modal

### Tab Navigation
- [x] Party tab shows player grid
- [x] Loot tab shows priority cards
- [x] Stats tab shows team summary
- [x] Floor selector visible in all tabs
- [x] View mode toggle only visible on Party tab
- [x] FFXIV-style icons with transparent backgrounds
- [x] No layout shift when switching tabs
