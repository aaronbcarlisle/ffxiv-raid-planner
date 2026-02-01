# UI Reorganization Plan: Header, Settings, and Actions

**Status:** Ready for Implementation
**Created:** 2026-01-31
**Scope:** Header layout, settings consolidation, toolbar improvements

---

## Summary

Reorganize the header layout, consolidate settings into a single slide-out panel, move primary actions to their appropriate locations, and consolidate the Log tab toolbar.

**Key Changes:**
1. Header breadcrumb style: `[Static ▼] > [Tier ▼] [⋮]`
2. Tier actions in dedicated kebab menu (⋮)
3. Settings slide-out panel with 4 tabs (replaces modal)
4. Add Player button on Roster tab (not header)
5. Log tab toolbar consolidation

---

## Phase 1: Header Restructure

### 1.1 Update Header Layout (Breadcrumb Style)

**File:** `frontend/src/components/layout/Header.tsx`

**Current Layout:**
```
[Logo] [Static ▼] [Invite] ... [Tier ▼] [⚙️] [User ▼]
```

**New Layout:**
```
[Logo] ─ [Static ▼] > [Tier ▼] [⋮] ─── [Invite] [⚙️] [User ▼]
```

**Implementation:**
1. Group StaticSwitcher and TierSelector together with a `>` separator
2. Move Invite/Share button to right side (before settings gear)
3. Add breadcrumb separator styling:
   ```tsx
   <span className="text-slate-500 mx-2">›</span>
   ```

**Lines to modify (approximate):**
- Lines 280-400: Main header render section
- Group the static/tier selectors in a flex container

### 1.2 Create TierActionsMenu Component

**File:** `frontend/src/components/ui/TierActionsMenu.tsx` (new, based on SettingsPopover.tsx)

**Actions to include:**
- Create New Tier (with Plus icon)
- Copy to New Tier (with Copy icon)
- Delete Tier (with Trash2 icon, danger styling)

**Implementation:**
1. Copy SettingsPopover.tsx as base
2. Remove Add Player and Settings actions
3. Change trigger icon from Settings (gear) to MoreVertical (⋮)
4. Update tooltip to "Tier Actions"

```tsx
import { MoreVertical, Plus, Copy, Trash2 } from 'lucide-react';

// Icon change
<IconButton
  aria-label="Tier actions"
  icon={<MoreVertical className="w-5 h-5" />}
  variant="ghost"
  size="md"
/>
```

### 1.3 Update SettingsPopover → Settings Gear Only

**File:** `frontend/src/components/ui/SettingsPopover.tsx`

**Change:** Settings gear now only opens the slide-out panel (Phase 2)

**Implementation:**
1. Replace dropdown with simple IconButton that dispatches `HEADER_EVENTS.SETTINGS`
2. Remove all action items (they move to TierActionsMenu or Roster tab)

```tsx
export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip content="Static Settings">
      <IconButton
        aria-label="Settings"
        icon={<Settings className="w-5 h-5" />}
        variant="ghost"
        size="md"
        onClick={onClick}
      />
    </Tooltip>
  );
}
```

### 1.4 Update Header.tsx Render

**Changes in Header.tsx:**
1. Import new TierActionsMenu
2. Group static/tier with breadcrumb separator
3. Move invite button to right side
4. Wire settings button to open panel

**Code structure:**
```tsx
{/* Left side - Logo */}
<div className="flex items-center">
  <Link to="/">...</Link>
</div>

{/* Center - Context breadcrumb */}
{isGroupRoute && (
  <div className="flex items-center gap-1">
    <StaticSwitcher ... />
    <span className="text-slate-500 mx-1">›</span>
    <TierSelector ... />
    <TierActionsMenu actions={tierActions} />
  </div>
)}

{/* Right side - Actions + User */}
<div className="flex items-center gap-2">
  {/* Invite/Share button */}
  {isGroupRoute && canManageInvitations && <InviteButton />}
  {isGroupRoute && !canManageInvitations && <ShareCodeButton />}

  {/* Settings */}
  {isGroupRoute && canEdit && (
    <SettingsButton onClick={() => dispatchHeaderEvent(HEADER_EVENTS.SETTINGS)} />
  )}

  {/* User */}
  <UserMenu />
</div>
```

---

## Phase 2: Settings Slide-Out Panel

### 2.1 Create SettingsPanel Component

**File:** `frontend/src/components/settings/SettingsPanel.tsx` (new)

**Structure:**
```tsx
interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  group: StaticGroup;
  players: SnapshotPlayer[];
  initialTab?: 'general' | 'members' | 'invitations' | 'priority';
}

export function SettingsPanel({ isOpen, onClose, group, players, initialTab = 'general' }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <SlideOutPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      width="md"
    >
      {/* Tab navigation */}
      <div className="flex border-b border-border-default mb-4">
        <TabButton active={activeTab === 'general'} onClick={() => setActiveTab('general')}>
          General
        </TabButton>
        <TabButton active={activeTab === 'members'} onClick={() => setActiveTab('members')}>
          Members
        </TabButton>
        <TabButton active={activeTab === 'invitations'} onClick={() => setActiveTab('invitations')}>
          Invitations
        </TabButton>
        <TabButton active={activeTab === 'priority'} onClick={() => setActiveTab('priority')}>
          Priority
        </TabButton>
      </div>

      {/* Tab content */}
      {activeTab === 'general' && <GeneralTab group={group} onClose={onClose} />}
      {activeTab === 'members' && <MembersPanel group={group} />}
      {activeTab === 'invitations' && <InvitationsPanel group={group} />}
      {activeTab === 'priority' && <PriorityTab group={group} players={players} />}
    </SlideOutPanel>
  );
}
```

### 2.2 Extract GeneralTab Component

**File:** `frontend/src/components/settings/GeneralTab.tsx` (new)

**Extract from:** `GroupSettingsModal.tsx` lines 367-519 (General tab content)

**Contents:**
- Static Name input (owner only)
- Public/Private toggle (owner only)
- Hide Setup Banners toggle (lead+)
- Hide BiS Banners toggle (lead+)
- Share Link copy button
- Delete Static button (owner only, with confirmation)

### 2.3 Consolidate PriorityTab Component

**File:** `frontend/src/components/settings/PriorityTab.tsx` (new, consolidates two sources)

**Sources to merge:**
1. `components/priority/PriorityTab.tsx` - Main priority configuration
2. `components/static-group/GroupSettingsModal.tsx` - Priority tab section (lines 521-741)

**Contents:**
1. Mode Selection (ModeSelector component)
2. Mode Configuration:
   - RoleBasedEditor (drag-to-reorder roles)
   - JobBasedEditor (job groups with priority)
   - PlayerBasedEditor (player-based priority)
   - ManualPlanning (if implemented)
3. Advanced Options (AdvancedOptions component)
4. **NEW:** Player Loot Adjustments table

### 2.4 Create PlayerLootAdjustments Component

**File:** `frontend/src/components/settings/PlayerLootAdjustments.tsx` (new)

**Purpose:** Consolidated table showing all players with their individual loot adjustment values. Currently this is only accessible via player card context menu (right-click → Adjust Priority).

**Implementation:**
```tsx
interface PlayerLootAdjustmentsProps {
  players: SnapshotPlayer[];
  onUpdatePlayer: (playerId: string, adjustment: number) => void;
}

export function PlayerLootAdjustments({ players, onUpdatePlayer }: PlayerLootAdjustmentsProps) {
  // Sort by role order (tank, healer, melee, ranged, caster) then name
  const sortedPlayers = useMemo(() =>
    [...players]
      .filter(p => p.configured)
      .sort((a, b) => /* role order, then name */),
    [players]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Player Loot Adjustments</Label>
        <span className="text-xs text-text-muted">
          Positive = higher priority, Negative = lower priority
        </span>
      </div>

      <div className="border border-border-default rounded-lg divide-y divide-border-default">
        {sortedPlayers.map(player => (
          <div key={player.id} className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <JobIcon job={player.job} size="sm" />
              <span>{player.name}</span>
            </div>
            <NumberInput
              value={player.lootAdjustment ?? 0}
              onChange={(val) => onUpdatePlayer(player.id, val)}
              min={-50}
              max={50}
              step={5}
              className="w-20"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 2.5 Update GroupView State Management

**File:** `frontend/src/pages/GroupView.tsx`

**State changes:**
```tsx
// Remove these:
const [showSettingsModal, setShowSettingsModal] = useState(false);
const [settingsModalTab, setSettingsModalTab] = useState<'general' | 'priority' | 'members' | 'invitations'>('general');
const [showPriorityPanel, setShowPriorityPanel] = useState(false);

// Add these:
const [showSettingsPanel, setShowSettingsPanel] = useState(false);
const [settingsTab, setSettingsTab] = useState<'general' | 'members' | 'invitations' | 'priority'>('general');
```

**Event handler updates (lines 385-426):**
```tsx
// Update SETTINGS event
useEffect(() => {
  const handleSettings = () => {
    setSettingsTab('general');
    setShowSettingsPanel(true);
  };
  window.addEventListener(HEADER_EVENTS.SETTINGS, handleSettings);
  return () => window.removeEventListener(HEADER_EVENTS.SETTINGS, handleSettings);
}, []);

// Update OPEN_SETTINGS_INVITATIONS event
useEffect(() => {
  const handleOpenInvitations = () => {
    setSettingsTab('invitations');
    setShowSettingsPanel(true);
  };
  window.addEventListener(HEADER_EVENTS.OPEN_SETTINGS_INVITATIONS, handleOpenInvitations);
  return () => window.removeEventListener(HEADER_EVENTS.OPEN_SETTINGS_INVITATIONS, handleOpenInvitations);
}, []);
```

**Render updates:**
```tsx
// Remove GroupSettingsModal render (lines 945-958)
// Remove old PriorityTab SlideOutPanel render (lines 1254-1266)

// Add new SettingsPanel render:
<SettingsPanel
  isOpen={showSettingsPanel}
  onClose={() => setShowSettingsPanel(false)}
  group={currentGroup}
  players={mainRosterPlayers}
  initialTab={settingsTab}
/>
```

---

## Phase 3: Tab Enhancements

### 3.1 Add Player Button on Roster Tab

**File:** `frontend/src/pages/GroupView.tsx`

**Location:** Roster tab toolbar (around line 680-720)

**Implementation:**
Add button next to existing Roster tab controls:

```tsx
{activeTab === 'roster' && (
  <div className="flex items-center gap-2 mb-4">
    {/* Add Player button - visible for leads/owners */}
    {canEdit && (
      <Tooltip content="Add a new player to the roster (Alt+Shift+P)">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAddPlayer}
          disabled={!tierId}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Player
        </Button>
      </Tooltip>
    )}

    {/* Existing controls... */}
    <ViewToggle mode={partyViewMode} onChange={setPartyViewMode} />
  </div>
)}
```

### 3.2 Consolidate Log Tab Toolbar

**File:** `frontend/src/pages/GroupView.tsx`

**Current:** Two separate rows (main tabs, then toolbar)
**New:** Single consolidated toolbar row

**Location:** Around lines 1100-1180 (Log tab render)

**Implementation:**
```tsx
{activeTab === 'log' && (
  <>
    {/* Consolidated toolbar */}
    <div className="flex items-center justify-between mb-4">
      {/* Left: View controls */}
      <div className="flex items-center gap-2">
        <ViewToggle mode={logViewMode} onChange={setLogViewMode} />
        <ResetDropdown ... />
      </div>

      {/* Center: Week selector */}
      <div className="flex items-center gap-2">
        <WeekSelector
          week={selectedWeek}
          onChange={setSelectedWeek}
          maxWeek={maxWeek}
        />
        <Button variant="secondary" size="sm" onClick={handleLogWeek}>
          Log Week
        </Button>
      </div>

      {/* Right: Log actions */}
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setShowLogLootModal(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Log Loot
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowLogMaterialModal(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Log Material
        </Button>
      </div>
    </div>

    {/* Log content */}
    {logViewMode === 'grid' ? <WeeklyLootGrid ... /> : <SectionedLogView ... />}
  </>
)}
```

---

## Phase 4: Cleanup

### 4.1 Remove Deprecated Files

**Files to delete:**
- `frontend/src/components/static-group/GroupSettingsModal.tsx`
- `frontend/src/components/priority/PriorityTab.tsx` (moved to settings/)

### 4.2 Update Component Exports

**File:** `frontend/src/components/ui/index.ts`
- Remove SettingsPopover export (if keeping as internal)
- Add TierActionsMenu export

**File:** `frontend/src/components/settings/index.ts` (new)
```tsx
export { SettingsPanel } from './SettingsPanel';
export { GeneralTab } from './GeneralTab';
export { PriorityTab } from './PriorityTab';
export { PlayerLootAdjustments } from './PlayerLootAdjustments';
```

### 4.3 Update Event System

**File:** `frontend/src/components/layout/Header.tsx`

**Events to update:**
- `HEADER_EVENTS.ADD_PLAYER` - Keep for keyboard shortcut, but button is now on Roster tab
- `HEADER_EVENTS.SETTINGS` - Now opens slide-out panel instead of modal

### 4.4 Update Keyboard Shortcuts

**File:** `frontend/src/hooks/useKeyboardShortcuts.ts`

Verify these still work:
- `Alt+Shift+P` - Add Player (should work via event)
- `Alt+Shift+S` - Open Settings (should work via event)
- `Alt+Shift+N` - New Tier (now in TierActionsMenu)
- `Alt+Shift+R` - Copy to New Tier (now in TierActionsMenu)

---

## UI Specifications

### Slide-Out Panel
- Width: `max-w-md` (~448px)
- Position: Right edge, full height
- Behavior: **Overlay** (no content adjustment)
- Close: Click backdrop, Escape key, X button

### Breadcrumb Separator
- Character: `›` (right single guillemet)
- Color: `text-slate-500`
- Spacing: `mx-2`

### Tier Actions Menu
- Icon: `MoreVertical` (⋮) from lucide-react
- Items: New Tier, Copy Tier, Delete Tier (danger)

### Add Player Button
- Style: `variant="secondary" size="sm"`
- Icon: `Plus` from lucide-react
- Tooltip: "Add a new player to the roster (Alt+Shift+P)"

### Log Tab Toolbar
- Layout: `justify-between` with three groups
- Groups: Left (view), Center (week), Right (actions)

---

## Verification Checklist

### Phase 1
- [ ] Header shows breadcrumb: `Static › Tier`
- [ ] Tier actions (⋮) shows New/Copy/Delete
- [ ] Invite button moved to right side
- [ ] Settings gear opens slide-out panel

### Phase 2
- [ ] Settings panel opens with 4 tabs
- [ ] General tab has all settings from old modal
- [ ] Members tab works correctly
- [ ] Invitations tab works correctly
- [ ] Priority tab has mode selection + editors
- [ ] Player Loot Adjustments table shows all players

### Phase 3
- [ ] Add Player button visible on Roster tab
- [ ] Add Player creates new player correctly
- [ ] Log tab toolbar is single consolidated row
- [ ] Week selector is centered

### Phase 4
- [ ] Old GroupSettingsModal removed
- [ ] Old PriorityTab removed
- [ ] No console errors
- [ ] All keyboard shortcuts work

### Cross-Cutting
- [ ] Mobile responsive
- [ ] Permission checks work (owner/lead/member/viewer)
- [ ] Admin mode works correctly
- [ ] Dark theme styling correct

---

## File Summary

### New Files
```
frontend/src/components/settings/
├── SettingsPanel.tsx       # Main slide-out container
├── GeneralTab.tsx          # Static settings tab
├── PriorityTab.tsx         # Priority configuration tab
├── PlayerLootAdjustments.tsx # Player adjustment table
└── index.ts                # Exports

frontend/src/components/ui/
└── TierActionsMenu.tsx     # Kebab menu for tier actions
```

### Modified Files
```
frontend/src/components/layout/Header.tsx          # Breadcrumb layout
frontend/src/components/ui/SettingsPopover.tsx     # Simplified to button
frontend/src/pages/GroupView.tsx                   # State + render updates
```

### Deleted Files
```
frontend/src/components/static-group/GroupSettingsModal.tsx
frontend/src/components/priority/PriorityTab.tsx   # Moved to settings/
```
