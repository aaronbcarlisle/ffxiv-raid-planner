/**
 * RevertWeekConfirmModal
 *
 * Confirmation modal shown when reverting a week that has logged data.
 * Shows a summary of loot, materials, and books logged for that week.
 */

import { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives';
import type { LootLogEntry, MaterialLogEntry, PageLedgerEntry, SnapshotPlayer } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';

interface RevertWeekConfirmModalProps {
  isOpen: boolean;
  week: number;
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  pageLedger: PageLedgerEntry[];
  players: SnapshotPlayer[];
  isReverting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RevertWeekConfirmModal({
  isOpen,
  week,
  lootLog,
  materialLog,
  pageLedger,
  players,
  isReverting,
  onConfirm,
  onCancel,
}: RevertWeekConfirmModalProps) {
  // Filter entries for this week
  const weekLoot = useMemo(
    () => lootLog.filter((e) => e.weekNumber === week),
    [lootLog, week]
  );
  const weekMaterials = useMemo(
    () => materialLog.filter((e) => e.weekNumber === week),
    [materialLog, week]
  );
  const weekLedger = useMemo(
    () => pageLedger.filter((e) => e.weekNumber === week),
    [pageLedger, week]
  );

  // Get player name by ID
  const getPlayerName = (playerId: string): string => {
    const player = players.find((p) => p.id === playerId);
    return player?.name || 'Unknown';
  };

  const hasData = weekLoot.length > 0 || weekMaterials.length > 0 || weekLedger.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={
        <span className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-status-warning" />
          Revert to Previous Week?
        </span>
      }
      size="md"
    >
      <div className="space-y-4">
        {/* Warning message */}
        <div className="flex items-start gap-3 p-3 rounded-lg border bg-status-warning/10 border-status-warning/30">
          <svg
            className="w-5 h-5 flex-shrink-0 mt-0.5 text-status-warning"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="text-sm text-text-primary">
            <p>
              This will move the week calculation back by one week. The following data was logged
              for <strong>Week {week}</strong>:
            </p>
          </div>
        </div>

        {/* Data summary */}
        {hasData ? (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {/* Loot entries */}
            {weekLoot.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-text-primary mb-1">
                  Loot ({weekLoot.length})
                </h4>
                <ul className="text-sm text-text-secondary space-y-0.5 pl-4">
                  {weekLoot.map((entry) => (
                    <li key={entry.id} className="list-disc">
                      {GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] ||
                        entry.itemSlot}{' '}
                      → {entry.recipientPlayerName} ({entry.floor})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Material entries */}
            {weekMaterials.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-text-primary mb-1">
                  Materials ({weekMaterials.length})
                </h4>
                <ul className="text-sm text-text-secondary space-y-0.5 pl-4">
                  {weekMaterials.map((entry) => (
                    <li key={entry.id} className="list-disc">
                      {entry.materialType.charAt(0).toUpperCase() + entry.materialType.slice(1)} →{' '}
                      {entry.recipientPlayerName} ({entry.floor})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Book entries */}
            {weekLedger.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-text-primary mb-1">
                  Books ({weekLedger.length})
                </h4>
                <ul className="text-sm text-text-secondary space-y-0.5 pl-4">
                  {weekLedger.map((entry) => (
                    <li key={entry.id} className="list-disc">
                      Page {entry.bookType} ({entry.transactionType === 'earned' ? '+' : ''}
                      {entry.quantity}) → {getPlayerName(entry.playerId)} ({entry.floor})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-text-muted">No data logged for this week.</p>
        )}

        {/* Note about data preservation */}
        <p className="text-xs text-text-muted">
          Note: This only changes the week calculation. Your logged data will remain intact and
          will now appear under Week {week + 1} relative to the new calculation.
        </p>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isReverting}>
            Cancel
          </Button>
          <Button type="button" variant="warning" onClick={onConfirm} loading={isReverting}>
            Revert Week
          </Button>
        </div>
      </div>
    </Modal>
  );
}
