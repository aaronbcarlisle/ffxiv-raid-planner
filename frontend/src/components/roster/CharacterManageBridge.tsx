// BRIDGE: the character registry re-homes to Player Hub (Person layer) when that ring is built — see spec §2.4. This is a deliberately temporary surface.

import { useState } from 'react';
import type { SnapshotPlayer } from '../../types';
import { Modal } from '../ui';
import { Button } from '../primitives';
import { RosterCharacterPanel } from './RosterCharacterPanel';

interface CharacterManageBridgeProps {
  groupId: string;
  players: SnapshotPlayer[];
  canEdit: boolean;
}

export const CharacterManageBridge: React.FC<CharacterManageBridgeProps> = ({ groupId, players, canEdit }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
        Manage characters
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Characters"
      >
        <p className="text-xs text-text-muted mb-4">
          Registered characters feed the gear board. This is managed per-static for now.
        </p>
        <RosterCharacterPanel groupId={groupId} players={players} canEdit={canEdit} />
      </Modal>
    </>
  );
};
