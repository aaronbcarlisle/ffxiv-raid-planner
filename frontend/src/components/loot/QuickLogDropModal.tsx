/**
 * Quick Log Drop Modal
 *
 * Streamlined modal for quickly logging a loot drop from the priority panel.
 * Pre-filled with slot, floor, and suggested player for one-click confirmation.
 */

import { useState, useEffect, useMemo } from 'react';
import { Package } from 'lucide-react';
import { Modal, Select, Checkbox, Label, NumberInput } from '../ui';
import { Button } from '../primitives';
import { JobIcon } from '../ui/JobIcon';
import { logLootAndUpdateGear, calculatePlayerLootStats, calculateAverageDrops } from '../../utils/lootCoordination';
import { toast } from '../../stores/toastStore';
import { getPriorityForItem, getPriorityForRing } from '../../utils/priority';
import type { SnapshotPlayer, GearSlot, StaticSettings, LootLogEntry } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';
import { RAID_JOBS } from '../../gamedata/jobs';

interface QuickLogDropModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  tierId: string;
  floor: string;
  slot: string;
  maxWeek: number; // Max week available for selection (defaults week selector to this)
  suggestedPlayer: SnapshotPlayer;
  allPlayers: SnapshotPlayer[];
  settings: StaticSettings;
  lootLog?: LootLogEntry[]; // For enhanced priority calculation matching Gear Priority panel
  currentWeek?: number; // Current week for drought bonus calculation
  onSuccess?: () => void;
}

export function QuickLogDropModal({
  isOpen,
  onClose,
  groupId,
  tierId,
  floor,
  slot,
  maxWeek,
  suggestedPlayer,
  allPlayers,
  settings,
  lootLog = [],
  currentWeek = 1,
  onSuccess,
}: QuickLogDropModalProps) {
  const [recipientPlayerId, setRecipientPlayerId] = useState(suggestedPlayer.id);
  const [selectedWeek, setSelectedWeek] = useState(maxWeek);
  const [updateGear, setUpdateGear] = useState(true);
  const [isExtra, setIsExtra] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isWeapon = slot === 'weapon';

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRecipientPlayerId(suggestedPlayer.id);
      setSelectedWeek(maxWeek);
      setUpdateGear(true);
      setIsExtra(false); // For gear priority weapons, it's the player's main job so not extra
    }
  }, [isOpen, suggestedPlayer.id, maxWeek]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientPlayerId) return;

    setIsSaving(true);
    try {
      const recipient = allPlayers.find((p) => p.id === recipientPlayerId);
      // For weapon drops from gear priority, the weapon job is the recipient's main job
      const weaponJob = isWeapon ? recipient?.job : undefined;

      await logLootAndUpdateGear(
        groupId,
        tierId,
        {
          weekNumber: selectedWeek,
          floor,
          itemSlot: slot,
          recipientPlayerId,
          method: 'drop',
          weaponJob,
          isExtra,
          notes: isWeapon && weaponJob ? `${weaponJob} weapon${isExtra ? ' (extra)' : ''}` : undefined,
        },
        {
          updateGear,
          updateWeaponPriority: isWeapon,
          weaponJob, // Pass for weapon priority updates
        }
      );

      const slotName = GEAR_SLOT_NAMES[slot as keyof typeof GEAR_SLOT_NAMES] || slot;
      const jobInfo = weaponJob ? RAID_JOBS.find((j) => j.abbreviation === weaponJob) : null;
      const displayName = isWeapon && jobInfo ? `${jobInfo.name} Weapon` : slotName;
      toast.success(`Logged ${displayName} drop for ${recipient?.name || 'player'}`);

      onSuccess?.();
      onClose();
    } catch {
      toast.error('Failed to log drop');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter to configured main roster players (subs can only be logged via Log tab)
  const eligiblePlayers = useMemo(() =>
    allPlayers.filter((p) => p.configured && !p.isSubstitute),
    [allPlayers]
  );
  const slotName = GEAR_SLOT_NAMES[slot as keyof typeof GEAR_SLOT_NAMES] || slot;
  const selectedPlayer = allPlayers.find((p) => p.id === recipientPlayerId);

  // Calculate average drops for enhanced scoring (matches Gear Priority panel)
  const averageDrops = useMemo(() => {
    if (lootLog.length === 0) return 0;
    const playerIds = eligiblePlayers.map((p) => p.id);
    return calculateAverageDrops(playerIds, lootLog);
  }, [lootLog, eligiblePlayers]);

  // Sort players by priority and add labels
  // Uses enhanced scoring (with loot history) to match Gear Priority panel
  const sortedRecipients = useMemo(() => {
    if (!slot) return eligiblePlayers.map(p => ({ player: p, priority: 0, needsItem: false }));

    // Get priority entries for this slot using the group's settings
    const priorityEntries = slot === 'ring1' || slot === 'ring2'
      ? getPriorityForRing(eligiblePlayers, settings)
      : getPriorityForItem(eligiblePlayers, slot as GearSlot, settings);

    // Apply enhanced scoring based on loot history (same as Gear Priority panel)
    const enhancedEntries = priorityEntries.map((entry) => {
      if (lootLog.length === 0) {
        return { ...entry, enhancedScore: entry.score };
      }
      const stats = calculatePlayerLootStats(entry.player.id, lootLog, currentWeek);
      const droughtBonus = Math.min(stats.weeksSinceLastDrop * 10, 50);
      const excessDrops = stats.totalDrops - averageDrops;
      const balancePenalty = excessDrops > 0 ? Math.min(excessDrops * 15, 45) : 0;
      return {
        ...entry,
        enhancedScore: entry.score + droughtBonus - balancePenalty,
      };
    }).sort((a, b) => b.enhancedScore - a.enhancedScore);

    // Create a map of player ID to priority rank (based on enhanced score order)
    const priorityMap = new Map(enhancedEntries.map((e, i) => [e.player.id, { rank: i + 1, score: e.enhancedScore }]));

    // Sort all players: those with priority first (by rank), then others alphabetically
    return eligiblePlayers
      .map(player => {
        const priority = priorityMap.get(player.id);
        return {
          player,
          priority: priority?.rank ?? 999,
          needsItem: !!priority,
        };
      })
      .sort((a, b) => {
        if (a.needsItem && !b.needsItem) return -1;
        if (!a.needsItem && b.needsItem) return 1;
        if (a.needsItem && b.needsItem) return a.priority - b.priority;
        return a.player.name.localeCompare(b.player.name);
      });
  }, [eligiblePlayers, slot, settings, lootLog, currentWeek, averageDrops]);

  // Get priority label for a player
  const getPriorityLabel = (priority: number, needsItem: boolean): string => {
    if (!needsItem) return '';
    if (priority === 1) return ' - Top Priority';
    if (priority === 2) return ' - 2nd Priority';
    if (priority === 3) return ' - 3rd Priority';
    return '';
  };

  // Build recipient options with job icons
  const recipientOptions = sortedRecipients.map(({ player, priority, needsItem }) => ({
    value: player.id,
    label: `${player.name}${getPriorityLabel(priority, needsItem)}`,
    icon: <JobIcon job={player.job} size="sm" />,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Log {slotName} Drop
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pre-filled info */}
        <div className="bg-surface-base rounded-lg p-3 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">Floor:</span>
            <span className="text-text-primary font-medium">{floor}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">Item:</span>
            {isWeapon && selectedPlayer ? (
              <div className="flex items-center gap-2">
                <JobIcon job={selectedPlayer.job} size="sm" />
                <span className="text-text-primary font-medium">
                  {RAID_JOBS.find((j) => j.abbreviation === selectedPlayer.job)?.name || selectedPlayer.job} Weapon
                </span>
              </div>
            ) : (
              <span className="text-text-primary font-medium">{slotName}</span>
            )}
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">Week:</span>
            <NumberInput
              value={selectedWeek}
              onChange={(val) => setSelectedWeek(val ?? maxWeek)}
              min={1}
              max={maxWeek}
              size="sm"
            />
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
          label={`Mark ${slotName.toLowerCase()} as acquired for ${selectedPlayer?.name || 'player'}`}
        />

        {/* Extra loot checkbox (weapons only) */}
        {isWeapon && (
          <Checkbox
            checked={isExtra}
            onChange={setIsExtra}
            label="Extra loot (not BiS priority)"
          />
        )}

        {/* Preview */}
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-sm">
          <div className="text-accent font-medium mb-1">This will:</div>
          <ul className="text-text-secondary space-y-1">
            <li>+ Add {slotName} to Week {selectedWeek} loot log</li>
            {updateGear && (
              <li>+ Mark {slotName} as acquired on {selectedPlayer?.name}</li>
            )}
            {updateGear && slot === 'weapon' && (
              <li>+ Update weapon priority status</li>
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
            Log Drop
          </Button>
        </div>
      </form>
    </Modal>
  );
}
