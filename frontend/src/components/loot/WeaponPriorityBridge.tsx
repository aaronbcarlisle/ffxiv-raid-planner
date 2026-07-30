// BRIDGE: the legacy job-grouped weapon-priority view (per-job cards, tie rolls,
// received footer) survives verbatim inside a v2 card — zero rebuild, same
// precedent as the F6c `CharacterManageBridge`. `WeaponPriorityList` itself is
// SHARED with V1 (`LootPriorityPanel.tsx:25`) and is never edited here.
//
// Phase-D R-3: this is now the body of the Weapons switcher segment — weapon
// priority stopped being a collapsible text link in the Floor-4 card's footer,
// so the disclosure this bridge used to own is gone. The card header states the
// fixed scope (weapons always drop from the final floor) with the R-45 floor-4
// identity, mirroring FloorCard's header line.

import { useState } from 'react';
import { Tag } from '../ui';
import { WeaponPriorityList } from './WeaponPriorityList';
import { QuickLogWeaponModal } from './QuickLogWeaponModal';
import { FLOOR_TEXT_CLASS, FLOOR_ACCENT_CLASS } from './floorClasses';
import type { SnapshotPlayer, StaticSettings } from '../../types';

export interface WeaponPriorityBridgeProps {
  players: SnapshotPlayer[]; // main roster
  settings: StaticSettings;
  groupId: string;
  tierId: string;
  floors: string[];
  maxWeek: number;
  canEdit: boolean;
  onLogSuccess?: () => void;
}

export function WeaponPriorityBridge({
  players,
  settings,
  groupId,
  tierId,
  floors,
  maxWeek,
  canEdit,
  onLogSuccess,
}: WeaponPriorityBridgeProps) {
  const [weaponModalState, setWeaponModalState] = useState<{
    isOpen: boolean;
    weaponJob: string;
    player: SnapshotPlayer | null;
  }>({
    isOpen: false,
    weaponJob: '',
    player: null,
  });

  const handleWeaponLogClick = (weaponJob: string, player: SnapshotPlayer) => {
    setWeaponModalState({ isOpen: true, weaponJob, player });
  };

  const handleWeaponModalClose = () => {
    setWeaponModalState({ isOpen: false, weaponJob: '', player: null });
  };

  return (
    <div className={`overflow-hidden rounded-lg border border-border-default ${FLOOR_ACCENT_CLASS[4]} bg-surface-card`}>
      <div className="flex items-center gap-3 border-b border-border-default bg-surface-base px-4 py-3">
        <Tag variant="label" tone="muted">{floors[3] ?? 'Floor 4'}</Tag>
        <span className={`font-display text-sm font-bold ${FLOOR_TEXT_CLASS[4]}`}>Floor 4</span>
        <span className="text-xs text-text-tertiary">
          · weapon coffer · per-job funneling, ties &amp; rolls
        </span>
      </div>
      <div className="px-4 py-3">
        <WeaponPriorityList
          players={players}
          settings={settings}
          showLogButtons={canEdit}
          onLogClick={handleWeaponLogClick}
          groupId={groupId}
        />
      </div>
      {canEdit && weaponModalState.player && (
        <QuickLogWeaponModal
          isOpen={weaponModalState.isOpen}
          onClose={handleWeaponModalClose}
          groupId={groupId}
          tierId={tierId}
          floor={floors[3] || 'Floor 4'} // Weapons always drop from floor 4
          weaponJob={weaponModalState.weaponJob}
          maxWeek={maxWeek}
          suggestedPlayer={weaponModalState.player}
          allPlayers={players}
          settings={settings}
          onSuccess={onLogSuccess}
        />
      )}
    </div>
  );
}
