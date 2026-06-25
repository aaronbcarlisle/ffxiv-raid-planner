import { useState } from 'react';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { IconButton } from '../primitives/IconButton';
import { Select } from '../ui/Select';
import { ConfirmModal } from '../ui/ConfirmModal';
import { JobIcon } from '../ui/JobIcon';
import { useModal } from '../../hooks/useModal';
import type { PlayerCharacter } from '../../stores/playerProfileStore';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import { RAID_JOBS, getJobDisplayName } from '../../gamedata/jobs';
import { toast } from '../../stores/toastStore';

interface CharacterCardProps {
  character: PlayerCharacter;
}

const JOB_OPTIONS = RAID_JOBS.map((j) => ({
  value: j.abbreviation,
  label: `${j.abbreviation} — ${j.name}`,
}));

export function CharacterCard({ character }: CharacterCardProps) {
  const { unlinkCharacter, syncGear, updateCharacter } = usePlayerProfileStore();
  const syncing = usePlayerProfileStore((s) => s.syncing);
  const unlinkModal = useModal();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showJobFallback, setShowJobFallback] = useState(false);
  const [fallbackJob, setFallbackJob] = useState('');

  const handleSync = async (manualJob?: string) => {
    setSyncError(null);
    setShowJobFallback(false);
    try {
      const result = await syncGear(character.id, false, manualJob);
      toast.success(`Refreshed ${result.job} gear from Lodestone — iLv ${result.avgItemLevel}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      if (msg.includes('active job') || msg.includes('determine')) {
        setSyncError(msg);
        setShowJobFallback(true);
      } else {
        setSyncError(msg);
        toast.error(msg);
      }
    }
  };

  const handleManualSync = () => {
    if (!fallbackJob) return;
    handleSync(fallbackJob);
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
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-surface-elevated flex-shrink-0">
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

        {/* Info + mobile inline actions */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-semibold text-text-primary text-base sm:text-lg truncate">
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
            {/* Unlink button — visible on all screen sizes */}
            <IconButton
              icon="×"
              aria-label="Unlink character"
              variant="ghost"
              size="sm"
              onClick={unlinkModal.open}
              className="flex-shrink-0"
            />
          </div>

          {/* Action buttons — stacked below info on mobile, inline on desktop */}
          <div className="flex flex-wrap gap-2 mt-2">
            {!character.isMain && (
              <Button variant="ghost" size="sm" onClick={handleSetMain}>
                Set Main
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSync()}
              disabled={syncing}
            >
              {syncing ? 'Refreshing…' : 'Refresh from Lodestone'}
            </Button>
          </div>
        </div>
      </div>

      {/* Sync error with recovery options */}
      {syncError && (
        <div className="mt-3 rounded-lg border border-status-warning/30 bg-status-warning/5 p-3">
          <div className="text-sm text-status-warning font-medium mb-1">
            {showJobFallback ? "Couldn't detect your active job" : syncError}
          </div>
          {showJobFallback ? (
            <>
              <p className="text-xs text-text-secondary mb-2">
                Lodestone can only refresh the currently equipped job. Choose a job only if the current job could not be detected.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={fallbackJob}
                  onChange={setFallbackJob}
                  options={[{ value: '', label: 'Select job…' }, ...JOB_OPTIONS]}
                  className="w-48"
                />
                <Button size="sm" onClick={handleManualSync} disabled={!fallbackJob || syncing}>
                  {syncing ? 'Refreshing…' : 'Refresh as Selected Job'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleSync()}>
                  Retry Auto
                </Button>
              </div>
              {fallbackJob && (
                <div className="flex items-center gap-2 mt-2 text-xs text-text-secondary">
                  <JobIcon job={fallbackJob} size="sm" />
                  <span>Will sync gear as {getJobDisplayName(fallbackJob)}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex gap-2 mt-1">
              <Button size="sm" variant="ghost" onClick={() => handleSync()}>Retry</Button>
            </div>
          )}
        </div>
      )}

      {unlinkModal.isOpen && (
        <ConfirmModal
          isOpen={unlinkModal.isOpen}
          title="Unlink Character"
          message={`Remove ${character.name} from your profile? Saved gear for this character will also be deleted.`}
          confirmLabel="Unlink"
          variant="danger"
          onConfirm={handleUnlink}
          onCancel={unlinkModal.close}
        />
      )}
    </div>
  );
}
