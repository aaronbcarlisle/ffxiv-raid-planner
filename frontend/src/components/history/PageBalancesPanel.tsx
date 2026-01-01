/**
 * Page Balances Panel
 *
 * Displays book/page counts for all players.
 */

import { useState, useEffect } from 'react';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { MarkFloorClearedModal } from './MarkFloorClearedModal';
import type { SnapshotPlayer } from '../../types';

interface PageBalancesPanelProps {
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  floors: string[];
  currentWeek: number;
  canEdit: boolean;
}

export function PageBalancesPanel({
  groupId,
  tierId,
  players,
  floors,
  currentWeek,
  canEdit,
}: PageBalancesPanelProps) {
  const { pageBalances, isLoading, fetchPageBalances, markFloorCleared } =
    useLootTrackingStore();
  const [showMarkClearedModal, setShowMarkClearedModal] = useState(false);

  // Fetch page balances on mount
  useEffect(() => {
    fetchPageBalances(groupId, tierId);
  }, [groupId, tierId, fetchPageBalances]);

  return (
    <div className="bg-surface-card rounded-lg p-4 border border-border-default">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-text-primary">Book Balances</h3>
        {canEdit && (
          <button
            onClick={() => setShowMarkClearedModal(true)}
            className="px-3 py-1.5 rounded bg-accent text-white text-sm hover:bg-accent-bright transition-colors"
          >
            Mark Floor Cleared
          </button>
        )}
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
                <th className="px-3 py-2 text-center text-sm text-text-secondary">Book I</th>
                <th className="px-3 py-2 text-center text-sm text-text-secondary">Book II</th>
                <th className="px-3 py-2 text-center text-sm text-text-secondary">Book III</th>
                <th className="px-3 py-2 text-center text-sm text-text-secondary">Book IV</th>
              </tr>
            </thead>
            <tbody>
              {pageBalances.map((balance) => (
                <tr
                  key={balance.playerId}
                  className="border-b border-border-default last:border-b-0 hover:bg-surface-hover"
                >
                  <td className="px-3 py-2 text-sm text-text-primary">
                    {balance.playerName}
                  </td>
                  <td className="px-3 py-2 text-center text-sm text-text-primary">
                    {balance.bookI}
                  </td>
                  <td className="px-3 py-2 text-center text-sm text-text-primary">
                    {balance.bookII}
                  </td>
                  <td className="px-3 py-2 text-center text-sm text-text-primary">
                    {balance.bookIII}
                  </td>
                  <td className="px-3 py-2 text-center text-sm text-text-primary">
                    {balance.bookIV}
                  </td>
                </tr>
              ))}
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
    </div>
  );
}
