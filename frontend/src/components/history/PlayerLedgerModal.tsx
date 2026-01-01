/**
 * Player Ledger Modal
 *
 * Modal displaying all page ledger entries for a specific player.
 * Shows date/time, week, floor, book type, transaction type, quantity, and notes.
 */

import { useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';

interface PlayerLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  tierId: string;
  playerId: string;
  playerName: string;
}

// Transaction type styling
const TRANSACTION_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  earned: { label: 'Earned', color: 'text-status-success', bg: 'bg-status-success/10' },
  spent: { label: 'Spent', color: 'text-status-error', bg: 'bg-status-error/10' },
  missed: { label: 'Missed', color: 'text-status-warning', bg: 'bg-status-warning/10' },
  adjustment: { label: 'Adjustment', color: 'text-accent', bg: 'bg-accent/10' },
};

function formatDateTime(isoString: string): { date: string; time: string } {
  const date = new Date(isoString);
  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

export function PlayerLedgerModal({
  isOpen,
  onClose,
  groupId,
  tierId,
  playerId,
  playerName,
}: PlayerLedgerModalProps) {
  const { playerLedger, isLoading, fetchPlayerLedger, clearPlayerLedger } = useLootTrackingStore();

  // Fetch ledger entries when modal opens
  useEffect(() => {
    if (isOpen && playerId) {
      fetchPlayerLedger(groupId, tierId, playerId);
    }
    return () => {
      // Clear when modal closes
      clearPlayerLedger();
    };
  }, [isOpen, groupId, tierId, playerId, fetchPlayerLedger, clearPlayerLedger]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Book History: ${playerName}`}
      size="3xl"
    >
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-text-muted">Loading...</div>
        ) : playerLedger.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            No book history for this player
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-card">
                <tr className="border-b border-border-default">
                  <th className="px-3 py-2 text-left text-text-secondary">Date</th>
                  <th className="px-3 py-2 text-center text-text-secondary">Week</th>
                  <th className="px-3 py-2 text-left text-text-secondary">Floor</th>
                  <th className="px-3 py-2 text-center text-text-secondary">Book</th>
                  <th className="px-3 py-2 text-center text-text-secondary">Type</th>
                  <th className="px-3 py-2 text-center text-text-secondary">Qty</th>
                  <th className="px-3 py-2 text-left text-text-secondary">Notes</th>
                </tr>
              </thead>
              <tbody>
                {playerLedger.map((entry) => {
                  const { date, time } = formatDateTime(entry.createdAt);
                  const style = TRANSACTION_STYLES[entry.transactionType] || TRANSACTION_STYLES.adjustment;
                  const qtyDisplay = entry.transactionType === 'spent' || entry.transactionType === 'missed'
                    ? `-${Math.abs(entry.quantity)}`
                    : entry.quantity > 0
                      ? `+${entry.quantity}`
                      : String(entry.quantity);

                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-border-default last:border-b-0 hover:bg-surface-interactive/50"
                    >
                      <td className="px-3 py-2">
                        <div className="text-text-primary">{date}</div>
                        <div className="text-text-muted text-xs">{time}</div>
                      </td>
                      <td className="px-3 py-2 text-center text-text-primary">
                        {entry.weekNumber}
                      </td>
                      <td className="px-3 py-2 text-text-primary">
                        {entry.floor}
                      </td>
                      <td className="px-3 py-2 text-center text-text-primary font-medium">
                        {entry.bookType}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.color} ${style.bg}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-center font-medium ${style.color}`}>
                        {qtyDisplay}
                      </td>
                      <td className="px-3 py-2 text-text-secondary max-w-48 truncate" title={entry.notes || ''}>
                        {entry.notes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary stats */}
        {!isLoading && playerLedger.length > 0 && (
          <div className="flex gap-4 pt-4 border-t border-border-default text-sm">
            <div className="text-text-secondary">
              Total entries: <span className="font-medium text-text-primary">{playerLedger.length}</span>
            </div>
          </div>
        )}

        {/* Close button */}
        <div className="flex justify-end pt-4 border-t border-border-default">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-surface-interactive text-text-secondary hover:bg-surface-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
