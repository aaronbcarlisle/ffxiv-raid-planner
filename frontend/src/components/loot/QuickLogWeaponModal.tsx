/**
 * Quick Log Weapon Modal
 *
 * Streamlined modal for quickly logging a weapon drop from the weapon priority panel.
 * Pre-filled with weapon job and suggested player for one-click confirmation.
 */

import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { JobIcon } from '../ui/JobIcon';
import { logLootAndUpdateGear } from '../../utils/lootCoordination';
import { toast } from '../../stores/toastStore';
import { getWeaponPriorityForJob } from '../../utils/weaponPriority';
import { RAID_JOBS } from '../../gamedata/jobs';
import type { SnapshotPlayer, StaticSettings } from '../../types';

interface QuickLogWeaponModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  tierId: string;
  floor: string;
  weaponJob: string;
  currentWeek: number;
  suggestedPlayer: SnapshotPlayer;
  allPlayers: SnapshotPlayer[];
  settings: StaticSettings;
  onSuccess?: () => void;
}

export function QuickLogWeaponModal({
  isOpen,
  onClose,
  groupId,
  tierId,
  floor,
  weaponJob,
  currentWeek,
  suggestedPlayer,
  allPlayers,
  settings,
  onSuccess,
}: QuickLogWeaponModalProps) {
  const [recipientPlayerId, setRecipientPlayerId] = useState(suggestedPlayer.id);
  const [updateGear, setUpdateGear] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Reset recipient when suggested player changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setRecipientPlayerId(suggestedPlayer.id);
      setUpdateGear(true);
    }
  }, [isOpen, suggestedPlayer.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientPlayerId) return;

    setIsSaving(true);
    try {
      await logLootAndUpdateGear(
        groupId,
        tierId,
        {
          weekNumber: currentWeek,
          floor,
          itemSlot: 'weapon',
          recipientPlayerId,
          method: 'drop',
          notes: `${weaponJob} weapon`,
        },
        {
          updateGear,
          updateWeaponPriority: updateGear,
        }
      );

      const recipient = allPlayers.find((p) => p.id === recipientPlayerId);
      const jobInfo = RAID_JOBS.find((j) => j.abbreviation === weaponJob);
      const jobName = jobInfo?.name || weaponJob;
      toast.success(`Logged ${jobName} weapon for ${recipient?.name || 'player'}`);

      onSuccess?.();
      onClose();
    } catch {
      toast.error('Failed to log weapon drop');
    } finally {
      setIsSaving(false);
    }
  };

  const configuredPlayers = allPlayers.filter((p) => p.configured);
  const selectedPlayer = allPlayers.find((p) => p.id === recipientPlayerId);
  const jobInfo = RAID_JOBS.find((j) => j.abbreviation === weaponJob);
  const jobName = jobInfo?.name || weaponJob;

  // Sort players by weapon priority for this job
  const sortedRecipients = useMemo(() => {
    const priority = getWeaponPriorityForJob(configuredPlayers, weaponJob, settings);
    const priorityMap = new Map(priority.map((e, i) => [e.player.id, { rank: i + 1, isMainJob: e.isMainJob }]));

    return configuredPlayers
      .map(player => {
        const priorityInfo = priorityMap.get(player.id);
        return {
          player,
          priority: priorityInfo?.rank ?? 999,
          isMainJob: priorityInfo?.isMainJob ?? false,
          needsWeapon: !!priorityInfo,
        };
      })
      .sort((a, b) => {
        if (a.needsWeapon && !b.needsWeapon) return -1;
        if (!a.needsWeapon && b.needsWeapon) return 1;
        if (a.needsWeapon && b.needsWeapon) return a.priority - b.priority;
        return a.player.name.localeCompare(b.player.name);
      });
  }, [configuredPlayers, weaponJob, settings]);

  // Get priority label for a player
  const getPriorityLabel = (priority: number, needsWeapon: boolean, isMainJob: boolean): string => {
    if (!needsWeapon) return '';
    let label = '';
    if (priority === 1) label = ' - Top Priority';
    else if (priority === 2) label = ' - 2nd Priority';
    else if (priority === 3) label = ' - 3rd Priority';
    if (isMainJob && label) label += ' (Main)';
    return label;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Log ${jobName} Weapon`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pre-filled info */}
        <div className="bg-surface-base rounded-lg p-3 space-y-1">
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">Weapon:</span>
            <div className="flex items-center gap-2">
              <JobIcon job={weaponJob} size="sm" />
              <span className="text-text-primary font-medium">{jobName}</span>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Floor:</span>
            <span className="text-text-primary font-medium">{floor}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Week:</span>
            <span className="text-text-primary font-medium">{currentWeek}</span>
          </div>
        </div>

        {/* Recipient selection */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">Recipient</label>
          <select
            value={recipientPlayerId}
            onChange={(e) => setRecipientPlayerId(e.target.value)}
            className="w-full px-3 py-2 rounded bg-surface-interactive border border-border-default text-text-primary focus:border-accent focus:outline-none"
          >
            {sortedRecipients.map(({ player, priority, needsWeapon, isMainJob }) => (
              <option key={player.id} value={player.id}>
                {player.name} ({player.job}){getPriorityLabel(priority, needsWeapon, isMainJob)}
              </option>
            ))}
          </select>
        </div>

        {/* Update gear checkbox */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={updateGear}
            onChange={(e) => setUpdateGear(e.target.checked)}
            className="w-4 h-4 rounded border-border-default text-accent focus:ring-accent cursor-pointer"
          />
          <span className="text-sm text-text-primary">
            Mark weapon as acquired for {selectedPlayer?.name || 'player'}
          </span>
        </label>

        {/* Preview */}
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-sm">
          <div className="text-accent font-medium mb-1">This will:</div>
          <ul className="text-text-secondary space-y-1">
            <li>+ Add Weapon to Week {currentWeek} loot log</li>
            {updateGear && (
              <>
                <li>+ Mark Weapon as acquired on {selectedPlayer?.name}</li>
                <li>+ Update weapon priority status (mark {jobName} as received)</li>
              </>
            )}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-surface-interactive text-text-secondary hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!recipientPlayerId || isSaving}
            className="px-4 py-2 rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Logging...' : 'Log Weapon'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
