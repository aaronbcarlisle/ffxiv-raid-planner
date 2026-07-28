// BRIDGE: the character registry re-homes to Player Hub (Person layer) when that ring is built — see spec §2.4. This is a deliberately temporary surface.
//
// C8 / D-12: legacy's per-player Lodestone entry (the PlayerCard kebab item,
// R-041) is restored HERE and not in `RosterCharacterPanel`, because that panel
// is mounted by BOTH shells (legacy `GroupViewContent.tsx:948`) — an entry there
// would be a V1-visible change. This wrapper is v2-only, so the re-home costs V1
// nothing and needs no shell gate. The Lodestone entry re-homes to Player Hub
// along with the rest of this surface at Stage 3.

import { useState } from 'react';
import { Globe } from 'lucide-react';
import type { MemberRole, SnapshotPlayer } from '../../types';
import { canEditPlayer } from '../../utils/permissions';
import { Modal } from '../ui';
import { Button } from '../primitives';
import { LodestoneSearchModal } from '../player/LodestoneSearchModal';
import { RosterCharacterPanel } from './RosterCharacterPanel';

interface CharacterManageBridgeProps {
  groupId: string;
  players: SnapshotPlayer[];
  canEdit: boolean;
  tierId?: string;
  userRole?: MemberRole | null;
  currentUserId?: string | null;
  isAdmin?: boolean;
}

export const CharacterManageBridge: React.FC<CharacterManageBridgeProps> = ({
  groupId,
  players,
  canEdit,
  tierId,
  userRole,
  currentUserId,
  isAdmin,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [syncPlayerId, setSyncPlayerId] = useState<string | null>(null);

  const syncPlayer = players.find(p => p.id === syncPlayerId) ?? null;
  const linkedCount = players.filter(p => p.lodestoneId).length;

  // Both Modals render at z-50 and each listens for Escape on `window`, so
  // stacking them would close both on one keypress. Hand off instead: opening
  // the sync flow closes Characters, and closing it returns the user there.
  function openSync(playerId: string) {
    setSyncPlayerId(playerId);
    setIsOpen(false);
  }

  function closeSync() {
    setSyncPlayerId(null);
    setIsOpen(true);
  }

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

        {players.length > 0 && (
          <section className="mb-5">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                Lodestone sync
              </h3>
              <p className="text-xs text-text-muted">
                {linkedCount}/{players.length} linked
              </p>
            </div>
            <ul className="space-y-1">
              {players.map(player => {
                // Gated per player, exactly as legacy gated R-041: a member can
                // sync their own claimed card without roster-level manage rights.
                const permission = canEditPlayer(userRole, player, currentUserId ?? undefined, isAdmin);
                const label = player.lodestoneId ? 'Re-sync Lodestone' : 'Lodestone Sync';
                const identity = player.lodestoneId
                  ? [player.lodestoneName ?? 'Linked character', player.lodestoneServer].filter(Boolean).join(' · ')
                  : 'Not linked';

                return (
                  <li
                    key={player.id}
                    className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{player.name || '—'}</p>
                      <p className="text-xs text-text-muted truncate">{identity}</p>
                    </div>
                    <Button
                      type="button"
                      size="xs"
                      variant="secondary"
                      disabled={!permission.allowed}
                      title={permission.allowed ? undefined : permission.reason}
                      aria-label={`${label} for ${player.name}`}
                      onClick={() => openSync(player.id)}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {label}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <RosterCharacterPanel groupId={groupId} players={players} canEdit={canEdit} />
      </Modal>

      <LodestoneSearchModal
        isOpen={syncPlayer !== null}
        onClose={closeSync}
        groupId={groupId}
        playerId={syncPlayer?.id ?? ''}
        playerName={syncPlayer?.name ?? ''}
        tierId={tierId}
        currentLodestoneId={syncPlayer?.lodestoneId}
      />
    </>
  );
};
