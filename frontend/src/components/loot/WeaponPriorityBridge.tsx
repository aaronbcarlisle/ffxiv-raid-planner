// BRIDGE: the legacy job-grouped weapon-priority view (per-job cards, tie rolls,
// received footer) survives verbatim inside the F4 card — zero rebuild, same
// precedent as the F6c `CharacterManageBridge`. Final visual form (polish or
// retirement) is a holistic-review decision — see spec §2.8.

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { LinkText } from '../ui';
import { WeaponPriorityList } from './WeaponPriorityList';
import { QuickLogWeaponModal } from './QuickLogWeaponModal';
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
  const [expanded, setExpanded] = useState(false);
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
    <div>
      <div className="flex items-center gap-2">
        <LinkText
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          icon={
            <ChevronRight
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          }
        >
          Weapon priorities
        </LinkText>
        <span className="text-xs text-text-tertiary">per-job funneling, ties &amp; rolls</span>
      </div>
      {expanded && (
        <>
          <WeaponPriorityList
            players={players}
            settings={settings}
            showLogButtons={canEdit}
            onLogClick={handleWeaponLogClick}
            groupId={groupId}
          />
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
        </>
      )}
    </div>
  );
}
