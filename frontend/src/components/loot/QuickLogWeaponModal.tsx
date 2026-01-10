/**
 * Quick Log Weapon Modal
 *
 * Streamlined modal for quickly logging a weapon drop from the weapon priority panel.
 * Pre-filled with weapon job and suggested player for one-click confirmation.
 */

import { useState, useEffect, useMemo } from 'react';
import { Modal, Select, Checkbox, Label } from '../ui';
import { Button } from '../primitives';
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
  maxWeek: number; // Max week available for selection (defaults week selector to this)
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
  maxWeek,
  suggestedPlayer,
  allPlayers,
  settings,
  onSuccess,
}: QuickLogWeaponModalProps) {
  const [recipientPlayerId, setRecipientPlayerId] = useState(suggestedPlayer.id);
  const [selectedWeek, setSelectedWeek] = useState(String(maxWeek));
  const [updateGear, setUpdateGear] = useState(true);
  const [isExtra, setIsExtra] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRecipientPlayerId(suggestedPlayer.id);
      setSelectedWeek(String(maxWeek));
      setUpdateGear(true);
      // Auto-detect if this is extra loot (weapon job doesn't match player's main job)
      setIsExtra(suggestedPlayer.job !== weaponJob);
    }
  }, [isOpen, suggestedPlayer.id, suggestedPlayer.job, weaponJob, maxWeek]);

  // Update isExtra when recipient changes
  useEffect(() => {
    const recipient = allPlayers.find((p) => p.id === recipientPlayerId);
    if (recipient) {
      setIsExtra(recipient.job !== weaponJob);
    }
  }, [recipientPlayerId, weaponJob, allPlayers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientPlayerId) return;

    setIsSaving(true);
    try {
      await logLootAndUpdateGear(
        groupId,
        tierId,
        {
          weekNumber: Number(selectedWeek),
          floor,
          itemSlot: 'weapon',
          recipientPlayerId,
          method: 'drop',
          weaponJob,
          isExtra,
          notes: `${weaponJob} weapon${isExtra ? ' (extra)' : ''}`,
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

  // Build week options
  const weekOptions = Array.from({ length: maxWeek }, (_, i) => ({
    value: String(i + 1),
    label: `Week ${i + 1}`,
  }));

  // Build recipient options
  const recipientOptions = sortedRecipients.map(({ player, priority, needsWeapon, isMainJob }) => ({
    value: player.id,
    label: `${player.name} (${player.job})${getPriorityLabel(priority, needsWeapon, isMainJob)}`,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Log ${jobName} Weapon`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pre-filled info */}
        <div className="bg-surface-base rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">Weapon:</span>
            <div className="flex items-center gap-2">
              <JobIcon job={weaponJob} size="sm" />
              <span className="text-text-primary font-medium">{jobName}</span>
            </div>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">Floor:</span>
            <span className="text-text-primary font-medium">{floor}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">Week:</span>
            <div className="w-32">
              <Select
                value={selectedWeek}
                onChange={setSelectedWeek}
                options={weekOptions}
              />
            </div>
          </div>
        </div>

        {/* Recipient selection */}
        <div>
          <Label htmlFor="recipient">Recipient</Label>
          <Select
            id="recipient"
            value={recipientPlayerId}
            onChange={setRecipientPlayerId}
            options={recipientOptions}
          />
        </div>

        {/* Update gear checkbox */}
        <Checkbox
          checked={updateGear}
          onChange={setUpdateGear}
          label={`Mark weapon as acquired for ${selectedPlayer?.name || 'player'}`}
        />

        {/* Extra loot checkbox */}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isExtra}
            onChange={setIsExtra}
            label="Extra loot (not BiS priority)"
          />
          {selectedPlayer?.job !== weaponJob && (
            <span className="text-xs text-text-muted">(auto-detected: off-job)</span>
          )}
        </div>

        {/* Preview */}
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-sm">
          <div className="text-accent font-medium mb-1">This will:</div>
          <ul className="text-text-secondary space-y-1">
            <li>+ Add Weapon to Week {selectedWeek} loot log</li>
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
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!recipientPlayerId}
            loading={isSaving}
          >
            Log Weapon
          </Button>
        </div>
      </form>
    </Modal>
  );
}
