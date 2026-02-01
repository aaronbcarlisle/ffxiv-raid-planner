/**
 * Page Balances Panel
 *
 * Displays book/page counts for all players with inline editing.
 * Supports "Week X" vs "All Time" toggle for filtering balances.
 */

import { useState, useEffect, useMemo } from 'react';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { MarkFloorClearedModal } from './MarkFloorClearedModal';
import { EditBookBalanceModal } from './EditBookBalanceModal';
import { PlayerLedgerModal } from './PlayerLedgerModal';
import { Tooltip } from '../primitives/Tooltip';
import { JobIcon } from '../ui/JobIcon';
import { toast } from '../../stores/toastStore';
import type { SnapshotPlayer, PageBalance } from '../../types';

type ViewMode = 'week' | 'allTime';

interface PageBalancesPanelProps {
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  floors: string[];
  currentWeek: number;
  canEdit: boolean;
}

interface EditState {
  balance: PageBalance;
  bookType: 'I' | 'II' | 'III' | 'IV';
  currentValue: number;
}

interface ResetState {
  type: 'row' | 'column' | 'all';
  playerId?: string;
  playerName?: string;
  bookType?: 'I' | 'II' | 'III' | 'IV';
}

export function PageBalancesPanel({
  groupId,
  tierId,
  players,
  floors,
  currentWeek,
  canEdit,
}: PageBalancesPanelProps) {
  const { pageBalances, isLoading, fetchPageBalances, markFloorCleared, adjustBookBalance, clearAllPageLedger, deletePlayerLedger } =
    useLootTrackingStore();
  const [showMarkClearedModal, setShowMarkClearedModal] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [resetState, setResetState] = useState<ResetState | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('allTime');
  const [ledgerPlayerId, setLedgerPlayerId] = useState<string | null>(null);
  const [ledgerPlayerName, setLedgerPlayerName] = useState<string>('');

  // Create player job lookup map
  const playerJobMap = useMemo(() => {
    const map = new Map<string, string>();
    players.forEach(p => map.set(p.id, p.job));
    return map;
  }, [players]);

  // Fetch page balances on mount and when view mode or week changes
  useEffect(() => {
    const weekParam = viewMode === 'week' ? currentWeek : undefined;
    fetchPageBalances(groupId, tierId, weekParam);
  }, [groupId, tierId, currentWeek, viewMode, fetchPageBalances]);

  // Handle reset confirmation
  const handleResetConfirm = async () => {
    if (!resetState) return;
    setIsResetting(true);

    try {
      if (resetState.type === 'all') {
        // Reset all books for all players - delete ledger history
        await clearAllPageLedger(groupId, tierId);
        toast.success('Reset all book balances - history cleared');
      } else if (resetState.type === 'row' && resetState.playerId) {
        // Reset all books for one player - delete their ledger history
        await deletePlayerLedger(groupId, tierId, resetState.playerId);
        await fetchPageBalances(groupId, tierId); // Refresh balances after delete
        toast.success(`Reset all book balances for ${resetState.playerName}`);
      } else if (resetState.type === 'column' && resetState.bookType) {
        // Reset one book type for all players - use adjustments (no endpoint for column delete)
        const key = `book${resetState.bookType}` as 'bookI' | 'bookII' | 'bookIII' | 'bookIV';
        let adjustmentCount = 0;
        for (const b of pageBalances) {
          if (b[key] !== 0) {
            await adjustBookBalance(groupId, tierId, b.playerId, resetState.bookType, -b[key], currentWeek, 'Reset to zero');
            adjustmentCount++;
          }
        }
        toast.success(`Reset Book ${resetState.bookType} for ${adjustmentCount} player(s)`);
      }

      setResetState(null);
    } catch {
      toast.error('Failed to reset book balances');
    } finally {
      setIsResetting(false);
    }
  };

  // Open player ledger modal
  const handleViewHistory = (playerId: string, playerName: string) => {
    setLedgerPlayerId(playerId);
    setLedgerPlayerName(playerName);
  };

  return (
    <div className="bg-surface-card rounded-lg p-4 border border-border-default">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-medium text-text-primary">Book Balances</h3>
          {/* View mode toggle */}
          {/* design-system-ignore: View mode toggle requires specific styling */}
          <div className="flex gap-1">
            <Tooltip content={`Show books earned in Week ${currentWeek} only`}>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  viewMode === 'week'
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
                }`}
              >
                Week {currentWeek}
              </button>
            </Tooltip>
            <Tooltip content="Show cumulative books earned across all weeks">
              <button
                onClick={() => setViewMode('allTime')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  viewMode === 'allTime'
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
                }`}
              >
                All Time
              </button>
            </Tooltip>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && pageBalances.length > 0 && (
            <Tooltip content="Reset all book balances to zero">
              <button
                onClick={() => setResetState({ type: 'all' })}
                className="px-3 py-1.5 rounded bg-status-error/20 text-status-error text-sm hover:bg-status-error/30 transition-colors"
              >
                Reset All
              </button>
            </Tooltip>
          )}
          {canEdit && (
            <Tooltip
              content={
                <div>
                  <div className="font-medium">Mark Floor Cleared</div>
                  <div className="text-text-secondary text-xs mt-0.5">Award books to all players who cleared a floor</div>
                </div>
              }
            >
              <button
                onClick={() => setShowMarkClearedModal(true)}
                className="px-3 py-1.5 rounded bg-accent text-accent-contrast text-sm font-bold hover:bg-accent-hover transition-colors"
              >
                Mark Floor Cleared
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Balances table */}
      {isLoading ? (
        <div className="text-center py-8 text-text-muted">Loading...</div>
      ) : pageBalances.length === 0 ? (
        <div className="text-center py-8 text-text-muted">
          No book tracking data yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                <th className="px-3 py-2 text-left text-sm text-text-secondary">Player</th>
                {(['I', 'II', 'III', 'IV'] as const).map((bookType) => (
                  canEdit ? (
                    <Tooltip key={bookType} content={`Click to reset Book ${bookType} for all players`}>
                      <th
                        className="px-3 py-2 text-center text-sm text-text-secondary cursor-pointer hover:text-status-error transition-colors"
                        onClick={() => setResetState({ type: 'column', bookType })}
                      >
                        Book {bookType}
                      </th>
                    </Tooltip>
                  ) : (
                    <th key={bookType} className="px-3 py-2 text-center text-sm text-text-secondary">
                      Book {bookType}
                    </th>
                  )
                ))}
                <th className="px-3 py-2 w-8"></th>
                {canEdit && <th className="px-3 py-2 w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {pageBalances.map((balance) => {
                const handleCellClick = (bookType: 'I' | 'II' | 'III' | 'IV', currentValue: number) => {
                  if (!canEdit) return;
                  setEditState({ balance, bookType, currentValue });
                };

                const cellClass = canEdit
                  ? 'px-3 py-2 text-center text-sm text-text-primary cursor-pointer hover:bg-accent/10 rounded transition-colors'
                  : 'px-3 py-2 text-center text-sm text-text-primary';

                return (
                  <tr
                    key={balance.playerId}
                    className="border-b border-border-default last:border-b-0"
                  >
                    <td className="px-3 py-2 text-sm text-text-primary">
                      <div className="flex items-center gap-2">
                        {playerJobMap.get(balance.playerId) && (
                          <JobIcon job={playerJobMap.get(balance.playerId)!} size="sm" />
                        )}
                        {balance.playerName}
                      </div>
                    </td>
                    {canEdit ? (
                      <Tooltip content={`Book I: ${balance.bookI} — Click to adjust`}>
                        <td className={cellClass} onClick={() => handleCellClick('I', balance.bookI)}>
                          {balance.bookI}
                        </td>
                      </Tooltip>
                    ) : (
                      <td className={cellClass}>{balance.bookI}</td>
                    )}
                    {canEdit ? (
                      <Tooltip content={`Book II: ${balance.bookII} — Click to adjust`}>
                        <td className={cellClass} onClick={() => handleCellClick('II', balance.bookII)}>
                          {balance.bookII}
                        </td>
                      </Tooltip>
                    ) : (
                      <td className={cellClass}>{balance.bookII}</td>
                    )}
                    {canEdit ? (
                      <Tooltip content={`Book III: ${balance.bookIII} — Click to adjust`}>
                        <td className={cellClass} onClick={() => handleCellClick('III', balance.bookIII)}>
                          {balance.bookIII}
                        </td>
                      </Tooltip>
                    ) : (
                      <td className={cellClass}>{balance.bookIII}</td>
                    )}
                    {canEdit ? (
                      <Tooltip content={`Book IV: ${balance.bookIV} — Click to adjust`}>
                        <td className={cellClass} onClick={() => handleCellClick('IV', balance.bookIV)}>
                          {balance.bookIV}
                        </td>
                      </Tooltip>
                    ) : (
                      <td className={cellClass}>{balance.bookIV}</td>
                    )}
                    {/* View history button */}
                    <td className="px-1 py-2">
                      <Tooltip content={`View book history for ${balance.playerName}`}>
                        <button
                          onClick={() => handleViewHistory(balance.playerId, balance.playerName)}
                          className="p-1 rounded text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                          </svg>
                        </button>
                      </Tooltip>
                    </td>
                    {canEdit && (
                      <td className="px-1 py-2">
                        <Tooltip content={`Reset all books for ${balance.playerName}`}>
                          <button
                            onClick={() => setResetState({
                              type: 'row',
                              playerId: balance.playerId,
                              playerName: balance.playerName
                            })}
                            className="p-1 rounded text-text-muted hover:text-status-error hover:bg-status-error/10 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        </Tooltip>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mark cleared modal */}
      {showMarkClearedModal && (
        <MarkFloorClearedModal
          isOpen={showMarkClearedModal}
          onClose={() => setShowMarkClearedModal(false)}
          onSubmit={async (request) => {
            await markFloorCleared(groupId, tierId, request);
            await fetchPageBalances(groupId, tierId);
          }}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
        />
      )}

      {/* Edit book balance modal */}
      {editState && (
        <EditBookBalanceModal
          isOpen={!!editState}
          onClose={() => setEditState(null)}
          onSubmit={async (adjustment, notes) => {
            try {
              await adjustBookBalance(
                groupId,
                tierId,
                editState.balance.playerId,
                editState.bookType,
                adjustment,
                currentWeek,
                notes
              );
              toast.success(`Updated Book ${editState.bookType} for ${editState.balance.playerName}`);
            } catch {
              toast.error('Failed to update book balance');
              throw new Error('Failed to update');
            }
          }}
          playerName={editState.balance.playerName}
          bookType={editState.bookType}
          currentBalance={editState.currentValue}
        />
      )}

      {/* Reset confirmation modal */}
      {resetState && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-card rounded-lg p-6 max-w-md w-full mx-4 border border-border-default">
            <h3 className="text-lg font-medium text-text-primary mb-4">
              Confirm Reset
            </h3>
            <p className="text-text-secondary mb-6">
              {resetState.type === 'all' && 'Are you sure you want to reset ALL book balances for ALL players to zero?'}
              {resetState.type === 'row' && `Are you sure you want to reset all book balances for ${resetState.playerName} to zero?`}
              {resetState.type === 'column' && `Are you sure you want to reset Book ${resetState.bookType} for ALL players to zero?`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setResetState(null)}
                disabled={isResetting}
                className="px-4 py-2 rounded bg-surface-interactive text-text-primary hover:bg-surface-raised transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetConfirm}
                disabled={isResetting}
                className="px-4 py-2 rounded bg-status-error text-white hover:bg-status-error/90 transition-colors disabled:opacity-50"
              >
                {isResetting ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player ledger modal */}
      {ledgerPlayerId && (
        <PlayerLedgerModal
          isOpen={!!ledgerPlayerId}
          onClose={() => {
            setLedgerPlayerId(null);
            setLedgerPlayerName('');
          }}
          groupId={groupId}
          tierId={tierId}
          playerId={ledgerPlayerId}
          playerName={ledgerPlayerName}
        />
      )}
    </div>
  );
}
