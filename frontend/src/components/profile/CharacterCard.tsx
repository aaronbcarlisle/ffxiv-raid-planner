/**
 * CharacterCard - Displays a linked FFXIV character with sync controls
 */

import { useState } from 'react';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { IconButton } from '../primitives/IconButton';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useModal } from '../../hooks/useModal';
import type { PlayerCharacter } from '../../stores/playerProfileStore';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import { toast } from '../../stores/toastStore';

interface CharacterCardProps {
  character: PlayerCharacter;
}

export function CharacterCard({ character }: CharacterCardProps) {
  const { unlinkCharacter, syncGear, updateCharacter } = usePlayerProfileStore();
  const syncing = usePlayerProfileStore((s) => s.syncing);
  const unlinkModal = useModal();
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncError(null);
    try {
      const result = await syncGear(character.id);
      toast.success(`Synced ${result.job} gear — iLv ${result.avgItemLevel}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setSyncError(msg);
      toast.error(msg);
    }
  };

  const handleUnlink = async () => {
    try {
      await unlinkCharacter(character.id);
      toast.success('Character unlinked');
    } catch {
      toast.error('Failed to unlink character');
    }
  };

  const handleSetMain = async () => {
    try {
      await updateCharacter(character.id, { isMain: true });
    } catch {
      toast.error('Failed to set main character');
    }
  };

  return (
    <div className="bg-surface-raised rounded-lg border border-border-default p-4">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-elevated flex-shrink-0">
          {character.avatarUrl ? (
            <img
              src={character.avatarUrl}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-tertiary text-2xl">
              ?
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-semibold text-text-primary text-lg truncate">
              {character.name}
            </span>
            {character.isMain && (
              <Badge variant="raid" size="sm">Main</Badge>
            )}
          </div>
          <div className="text-text-secondary text-sm mt-0.5">
            {character.server}
            {character.dataCenter && (
              <span className="text-text-tertiary"> [{character.dataCenter}]</span>
            )}
          </div>
          <div className="text-text-tertiary text-xs mt-1">
            Lodestone ID: {character.lodestoneId}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!character.isMain && (
            <Button variant="ghost" size="sm" onClick={handleSetMain}>
              Set Main
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? 'Syncing…' : 'Sync Gear'}
          </Button>
          <IconButton
            icon="×"
            aria-label="Unlink character"
            variant="ghost"
            size="sm"
            onClick={unlinkModal.open}
          />
        </div>
      </div>

      {syncError && (
        <div className="mt-3 text-sm text-status-error bg-status-error/10 rounded px-3 py-2">
          {syncError}
        </div>
      )}

      {unlinkModal.isOpen && (
        <ConfirmModal
          isOpen={unlinkModal.isOpen}
          title="Unlink Character"
          message={`Remove ${character.name} from your profile? Gear snapshots for this character will also be deleted.`}
          confirmLabel="Unlink"
          variant="danger"
          onConfirm={handleUnlink}
          onCancel={unlinkModal.close}
        />
      )}
    </div>
  );
}
