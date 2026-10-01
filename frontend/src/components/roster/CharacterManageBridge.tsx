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
  /** Registry list — legacy's own Characters panel is main-roster-only. */
  players: SnapshotPlayer[];
  /**
   * Lodestone-sync list. Wider than `players`: legacy renders a full PlayerCard
   * (kebab and all) for substitutes, so R-041 reaches them. Defaults to
   * `players` for callers that don't distinguish.
   */
  syncPlayers?: SnapshotPlayer[];
  canEdit: boolean;
  tierId?: string;
  userRole?: MemberRole | null;
  currentUserId?: string | null;
  /**
   * Admin ACCESS, not the raw `user.isAdmin` flag — View As must downgrade the
   * row exactly as it downgrades a card. Named for the value, not for
   * `canEditPlayer`'s parameter, so a caller can't pass the wrong one by
   * matching names (PR #201 review).
   */
  isAdminAccess?: boolean;
}

export const CharacterManageBridge: React.FC<CharacterManageBridgeProps> = ({
  groupId,
  players,
  syncPlayers,
  canEdit,
  tierId,
  userRole,
  currentUserId,
  isAdminAccess,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [syncPlayerId, setSyncPlayerId] = useState<string | null>(null);

  const syncRoster = syncPlayers ?? players;
  const syncPlayer = syncPlayerId ? syncRoster.find(p => p.id === syncPlayerId) ?? null : null;
  const linkedCount = syncRoster.filter(p => p.lodestoneId).length;
  // Gated per player, exactly as legacy gated R-041: a member can sync their
  // own claimed card without roster-level manage rights.
  const canSyncRow = (player: SnapshotPlayer) =>
    canEditPlayer(userRole, player, currentUserId ?? undefined, isAdminAccess).allowed;
  // ROLE-1 (R-R1-8): the entry never names an action the user can't take.
  // `canEdit` covers the registry panel (a manager with an empty roster can
  // still add characters); the rows cover a member's own card.
  const canEditAny = canEdit || syncRoster.some(canSyncRow);

  // Derived, not stored: if the target leaves the roster mid-flow (a poll, or
  // someone removes them) the sync modal unmounts on its own, and the user falls
  // back into Characters rather than being left with both dialogs shut.
  const charactersOpen = isOpen || (syncPlayerId !== null && syncPlayer === null);

  // Deliberately one modal at a time. Each Modal registers its Escape handler on
  // `window`, and the first one registered wins the `stopImmediatePropagation`
  // (`Modal.tsx:61-66`). With both open that is Characters, so Escape would close
  // the modal *behind* the one the user is in and the sync modal — the topmost —
  // would never see the key at all. The two Tab focus traps compete on `window`
  // for the same reason. Hand off instead: opening the sync flow closes
  // Characters, and closing it returns the user there.
  function openSync(playerId: string) {
    setSyncPlayerId(playerId);
    setIsOpen(false);
  }

  function closeSync() {
    setSyncPlayerId(null);
    setIsOpen(true);
  }

  // ROLE-1 (R-R1-8): a guest's list request 401s, so there is no entry without
  // a signed-in user. Viewer-role members and signed-in non-members may read
  // the list (`static_characters.py`), and V1 shows it to every role, so they
  // keep the read-only modal under the "Characters" label.
  if (!currentUserId) return null;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
        {canEditAny ? 'Manage characters' : 'Characters'}
      </Button>
      <Modal
        isOpen={charactersOpen}
        onClose={() => { setIsOpen(false); setSyncPlayerId(null); }}
        title="Characters"
      >
        <p className="text-xs text-text-muted mb-4">
          Registered characters feed the gear board. This is managed per-static for now.
        </p>

        {syncRoster.length > 0 && (
          <section className="mb-5">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                Lodestone sync
              </h3>
              <p className="text-xs text-text-muted">
                {linkedCount}/{syncRoster.length} linked
              </p>
            </div>
            <ul className="space-y-1">
              {syncRoster.map(player => {
                const label = player.lodestoneId ? 'Re-sync Lodestone' : 'Lodestone Sync';
                const displayName = player.name || '—';
                const identity = player.lodestoneId
                  ? [player.lodestoneName ?? 'Linked character', player.lodestoneServer].filter(Boolean).join(' · ')
                  : 'Not linked';

                return (
                  <li
                    key={player.id}
                    className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{displayName}</p>
                      <p className="text-xs text-text-muted truncate">{identity}</p>
                    </div>
                    {/* ROLE-1 (R-R1-8): a row the user can't edit shows its
                        identity line and no control — not a disabled button
                        with its reason spelled out beside it. */}
                    {canSyncRow(player) && (
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        aria-label={`${label} for ${displayName}`}
                        onClick={() => openSync(player.id)}
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {label}
                      </Button>
                    )}
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
