/**
 * RevertWeekSummaryModal — D-41's data-summary modal (Phase D4 Task 2).
 *
 * Reverting the week clock is destructive-feeling: D-41 rules a RESTORE of a
 * modal listing the loot/materials/books that will move before the clock
 * mutates (`v1-v2-parity-matrix.md:267`). R-48 states v2's Log "builds its
 * own grid, count bar and revert modal" (`phase-d-loot-design.md:984-986`) —
 * `history/RevertWeekConfirmModal.tsx` is read-only behavioural reference for
 * what data must surface, not a dependency this component imports.
 *
 * No row cap: truncating a warning surface shown before a clock mutation
 * would remove information the user needs, so every row renders inside a
 * scroll container (`max-h-64 overflow-y-auto`, matching legacy's pattern).
 *
 * `week` is the clock's CURRENT week — the week that actually moves. The
 * caller (Task 3's `WeekScopeControl`) always passes `clock.currentWeek`;
 * this component never derives it.
 */
import { useMemo } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives';
import type { LootLogEntry, MaterialLogEntry, PageLedgerEntry, SnapshotPlayer } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';
import { UPGRADE_MATERIAL_DISPLAY_NAMES } from '../../gamedata/loot-tables';

export interface RevertWeekSummaryModalProps {
  isOpen: boolean;
  /** The clock's current week — the week that moves. Never derived here. */
  week: number;
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  pageLedger: PageLedgerEntry[];
  players: SnapshotPlayer[];
  isReverting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function countLabel(count: number, singular: string, plural: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Same direction convention as `PlayerLedgerModal.tsx:128-132` (frozen, read-only reference):
 * `spent`/`missed` render as a negative magnitude, everything else as a signed positive. */
function bookQtyDisplay(entry: PageLedgerEntry): string {
  if (entry.transactionType === 'spent' || entry.transactionType === 'missed') {
    return `-${Math.abs(entry.quantity)}`;
  }
  return entry.quantity > 0 ? `+${entry.quantity}` : String(entry.quantity);
}

export function RevertWeekSummaryModal({
  isOpen,
  week,
  lootLog,
  materialLog,
  pageLedger,
  players,
  isReverting,
  onConfirm,
  onCancel,
}: RevertWeekSummaryModalProps) {
  const weekLoot = useMemo(() => lootLog.filter((e) => e.weekNumber === week), [lootLog, week]);
  const weekMaterials = useMemo(
    () => materialLog.filter((e) => e.weekNumber === week),
    [materialLog, week],
  );
  const weekLedger = useMemo(() => pageLedger.filter((e) => e.weekNumber === week), [pageLedger, week]);

  const getPlayerName = (playerId: string): string => players.find((p) => p.id === playerId)?.name ?? 'Unknown';

  const hasData = weekLoot.length > 0 || weekMaterials.length > 0 || weekLedger.length > 0;

  const countsLine = [
    weekLoot.length > 0 ? countLabel(weekLoot.length, 'drop') : null,
    weekMaterials.length > 0 ? countLabel(weekMaterials.length, 'material') : null,
    weekLedger.length > 0 ? countLabel(weekLedger.length, 'book entry', 'book entries') : null,
  ]
    .filter((segment): segment is string => segment !== null)
    .join(' · ');

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        // Escape and the header X both route through Modal's onClose — don't let either
        // bypass the in-flight-revert cancel lock that the Cancel button already respects.
        if (!isReverting) onCancel();
      }}
      title={
        <span className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-status-warning" aria-hidden />
          {`Revert to Week ${week - 1}?`}
        </span>
      }
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-status-warning/30 bg-status-warning/10 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-status-warning" aria-hidden />
          <p className="text-sm text-text-primary">
            This moves the week clock back by one week.{' '}
            <strong>{`Week ${week}'s entries are not deleted`}</strong> &mdash; they will appear as
            future-week entries once the clock reverts.
          </p>
        </div>

        {hasData ? (
          <>
            <p className="text-xs font-medium text-text-secondary">{countsLine}</p>
            <div
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scroll region for a keyboard-only user; focus is the keyboard path to rows below the fold
              tabIndex={0}
              aria-label="Entries that will move"
              className="max-h-64 space-y-3 overflow-y-auto"
            >
              {weekLoot.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-medium text-text-primary">Loot ({weekLoot.length})</h4>
                  <ul className="space-y-0.5 pl-4 text-sm text-text-secondary">
                    {weekLoot.map((entry) => (
                      <li key={entry.id} className="list-disc">
                        {GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] || entry.itemSlot}
                        {' → '}
                        {entry.recipientPlayerName} ({entry.floor})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {weekMaterials.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-medium text-text-primary">
                    Materials ({weekMaterials.length})
                  </h4>
                  <ul className="space-y-0.5 pl-4 text-sm text-text-secondary">
                    {weekMaterials.map((entry) => (
                      <li key={entry.id} className="list-disc">
                        {UPGRADE_MATERIAL_DISPLAY_NAMES[entry.materialType]}
                        {' → '}
                        {entry.recipientPlayerName} ({entry.floor})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {weekLedger.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-medium text-text-primary">Books ({weekLedger.length})</h4>
                  <ul className="space-y-0.5 pl-4 text-sm text-text-secondary">
                    {weekLedger.map((entry) => (
                      <li key={entry.id} className="list-disc">
                        {`Page ${entry.bookType} (${bookQtyDisplay(entry)})`}
                        {' → '}
                        {getPlayerName(entry.playerId)} ({entry.floor})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-text-muted">{`Nothing logged for Week ${week}.`}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={isReverting}>
            Cancel
          </Button>
          <Button variant="warning" onClick={onConfirm} loading={isReverting}>
            Revert week
          </Button>
        </div>
      </div>
    </Modal>
  );
}
