/**
 * Team Summary Enhanced
 *
 * Combines gear tracking, book tracking, and material tracking into a single
 * comprehensive per-player summary view.
 */

import { useEffect, useMemo, memo } from 'react';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { JobIcon } from '../ui/JobIcon';
import { calculatePlayerCompletion, calculatePlayerMaterials, calculatePlayerBooks } from '../../utils/calculations';
import type { RaidTier } from '../../gamedata/raid-tiers';
import type { SnapshotPlayer, PageBalance, MaterialBalance } from '../../types';

interface TeamSummaryEnhancedProps {
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  tierInfo: RaidTier;
}

interface PlayerSummaryRow {
  player: SnapshotPlayer;
  gearPercent: number;
  // Books: current balance
  booksBalance: { I: number; II: number; III: number; IV: number };
  // Books needed: remaining books to acquire remaining raid items
  booksNeeded: { I: number; II: number; III: number; IV: number };
  // Materials received (all time)
  matsReceived: { twine: number; glaze: number; solvent: number };
  // Materials needed: remaining materials to augment remaining tome items
  matsNeeded: { twine: number; glaze: number; solvent: number };
}

// Memoized row component
const SummaryRow = memo(function SummaryRow({ row }: { row: PlayerSummaryRow }) {
  const { player, gearPercent, booksBalance, booksNeeded, matsReceived, matsNeeded } = row;

  // Helper to format book display (balance / needed)
  const formatBook = (balance: number, needed: number) => {
    if (needed === 0) return <span className="text-text-muted">-</span>;
    const hasEnough = balance >= needed;
    return (
      <span className={hasEnough ? 'text-status-success' : 'text-text-primary'}>
        {balance}<span className="text-text-muted">/{needed}</span>
      </span>
    );
  };

  // Helper to format material display (received / needed)
  const formatMat = (received: number, needed: number) => {
    if (needed === 0) return <span className="text-text-muted">-</span>;
    const hasEnough = received >= needed;
    return (
      <span className={hasEnough ? 'text-status-success' : 'text-text-primary'}>
        {received}<span className="text-text-muted">/{needed}</span>
      </span>
    );
  };

  return (
    <tr className="border-b border-border-default last:border-b-0 hover:bg-surface-elevated/50 transition-colors">
      {/* Player */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <JobIcon job={player.job} size="sm" />
          <span className="text-sm font-medium text-text-primary">{player.name}</span>
        </div>
      </td>

      {/* Gear % */}
      <td className="px-3 py-2 text-center">
        <span className={`text-sm font-medium ${
          gearPercent === 100 ? 'text-status-success' :
          gearPercent >= 75 ? 'text-status-warning' :
          'text-text-primary'
        }`}>
          {gearPercent}%
        </span>
      </td>

      {/* Books: I, II, III, IV (balance/needed) */}
      <td className="px-2 py-2 text-center text-sm">
        {formatBook(booksBalance.I, booksNeeded.I)}
      </td>
      <td className="px-2 py-2 text-center text-sm">
        {formatBook(booksBalance.II, booksNeeded.II)}
      </td>
      <td className="px-2 py-2 text-center text-sm">
        {formatBook(booksBalance.III, booksNeeded.III)}
      </td>
      <td className="px-2 py-2 text-center text-sm">
        {formatBook(booksBalance.IV, booksNeeded.IV)}
      </td>

      {/* Materials: T, G, S (received/needed) */}
      <td className="px-2 py-2 text-center text-sm">
        {formatMat(matsReceived.twine, matsNeeded.twine)}
      </td>
      <td className="px-2 py-2 text-center text-sm">
        {formatMat(matsReceived.glaze, matsNeeded.glaze)}
      </td>
      <td className="px-2 py-2 text-center text-sm">
        {formatMat(matsReceived.solvent, matsNeeded.solvent)}
      </td>
    </tr>
  );
});

export function TeamSummaryEnhanced({
  groupId,
  tierId,
  players,
  tierInfo,
}: TeamSummaryEnhancedProps) {
  const {
    pageBalances,
    materialBalances,
    fetchPageBalances,
    fetchMaterialBalances,
  } = useLootTrackingStore();

  // Fetch balances on mount
  useEffect(() => {
    fetchPageBalances(groupId, tierId);
    fetchMaterialBalances(groupId, tierId);
  }, [groupId, tierId, fetchPageBalances, fetchMaterialBalances]);

  // Build lookup maps
  const pageBalanceMap = useMemo(() => {
    const map = new Map<string, PageBalance>();
    pageBalances.forEach(b => map.set(b.playerId, b));
    return map;
  }, [pageBalances]);

  const materialBalanceMap = useMemo(() => {
    const map = new Map<string, MaterialBalance>();
    materialBalances.forEach(b => map.set(b.playerId, b));
    return map;
  }, [materialBalances]);

  // Build player summaries
  const playerSummaries = useMemo<PlayerSummaryRow[]>(() => {
    return players
      .filter(p => p.configured)
      .map(player => {
        const gearPercent = calculatePlayerCompletion(player.gear);
        const booksNeededCalc = calculatePlayerBooks(player.gear);
        const matsNeededCalc = calculatePlayerMaterials(player.gear);

        // Get balances from store
        const pageBalance = pageBalanceMap.get(player.id);
        const matBalance = materialBalanceMap.get(player.id);

        return {
          player,
          gearPercent,
          booksBalance: {
            I: pageBalance?.bookI ?? 0,
            II: pageBalance?.bookII ?? 0,
            III: pageBalance?.bookIII ?? 0,
            IV: pageBalance?.bookIV ?? 0,
          },
          booksNeeded: {
            I: booksNeededCalc.floor1,
            II: booksNeededCalc.floor2,
            III: booksNeededCalc.floor3,
            IV: booksNeededCalc.floor4,
          },
          matsReceived: {
            twine: matBalance?.twine ?? 0,
            glaze: matBalance?.glaze ?? 0,
            solvent: matBalance?.solvent ?? 0,
          },
          matsNeeded: {
            twine: matsNeededCalc.twine,
            glaze: matsNeededCalc.glaze,
            solvent: matsNeededCalc.solvent,
          },
        };
      });
  }, [players, pageBalanceMap, materialBalanceMap]);

  // Calculate totals
  const totals = useMemo(() => {
    const result = {
      gearPercent: 0,
      booksBalance: { I: 0, II: 0, III: 0, IV: 0 },
      booksNeeded: { I: 0, II: 0, III: 0, IV: 0 },
      matsReceived: { twine: 0, glaze: 0, solvent: 0 },
      matsNeeded: { twine: 0, glaze: 0, solvent: 0 },
    };

    if (playerSummaries.length === 0) return result;

    playerSummaries.forEach(row => {
      result.gearPercent += row.gearPercent;
      result.booksBalance.I += row.booksBalance.I;
      result.booksBalance.II += row.booksBalance.II;
      result.booksBalance.III += row.booksBalance.III;
      result.booksBalance.IV += row.booksBalance.IV;
      result.booksNeeded.I += row.booksNeeded.I;
      result.booksNeeded.II += row.booksNeeded.II;
      result.booksNeeded.III += row.booksNeeded.III;
      result.booksNeeded.IV += row.booksNeeded.IV;
      result.matsReceived.twine += row.matsReceived.twine;
      result.matsReceived.glaze += row.matsReceived.glaze;
      result.matsReceived.solvent += row.matsReceived.solvent;
      result.matsNeeded.twine += row.matsNeeded.twine;
      result.matsNeeded.glaze += row.matsNeeded.glaze;
      result.matsNeeded.solvent += row.matsNeeded.solvent;
    });

    result.gearPercent = Math.round(result.gearPercent / playerSummaries.length);
    return result;
  }, [playerSummaries]);

  if (playerSummaries.length === 0) {
    return (
      <div className="bg-surface-card rounded-lg border border-border-default p-8 text-center">
        <p className="text-text-muted">No configured players to display</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-card rounded-lg border border-border-default">
      {/* Header */}
      <div className="p-4 border-b border-border-default">
        <h3 className="text-lg font-medium text-text-primary">Team Summary</h3>
        <p className="text-sm text-text-muted mt-1">
          Book and material progress for all players. Values show current balance vs. needed.
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default bg-surface-elevated/50">
              <th className="px-3 py-3 text-left text-sm font-medium text-text-secondary">Player</th>
              <th className="px-3 py-3 text-center text-sm font-medium text-text-secondary">Gear</th>
              <th className="px-2 py-3 text-center text-sm font-medium text-text-secondary" title={tierInfo.floors[0]}>I</th>
              <th className="px-2 py-3 text-center text-sm font-medium text-text-secondary" title={tierInfo.floors[1]}>II</th>
              <th className="px-2 py-3 text-center text-sm font-medium text-text-secondary" title={tierInfo.floors[2]}>III</th>
              <th className="px-2 py-3 text-center text-sm font-medium text-text-secondary" title={tierInfo.floors[3]}>IV</th>
              <th className="px-2 py-3 text-center text-sm font-medium text-material-twine" title={tierInfo.upgradeMaterials.twine}>T</th>
              <th className="px-2 py-3 text-center text-sm font-medium text-material-glaze" title={tierInfo.upgradeMaterials.glaze}>G</th>
              <th className="px-2 py-3 text-center text-sm font-medium text-material-solvent" title={tierInfo.upgradeMaterials.solvent}>S</th>
            </tr>
          </thead>
          <tbody>
            {playerSummaries.map(row => (
              <SummaryRow key={row.player.id} row={row} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-default bg-surface-elevated/30">
              <td className="px-3 py-2 text-sm font-medium text-text-secondary">Team Total</td>
              <td className="px-3 py-2 text-center">
                <span className={`text-sm font-medium ${
                  totals.gearPercent === 100 ? 'text-status-success' :
                  totals.gearPercent >= 75 ? 'text-status-warning' :
                  'text-text-primary'
                }`}>
                  {totals.gearPercent}%
                </span>
              </td>
              <td className="px-2 py-2 text-center text-sm font-medium">
                {totals.booksBalance.I}<span className="text-text-muted">/{totals.booksNeeded.I}</span>
              </td>
              <td className="px-2 py-2 text-center text-sm font-medium">
                {totals.booksBalance.II}<span className="text-text-muted">/{totals.booksNeeded.II}</span>
              </td>
              <td className="px-2 py-2 text-center text-sm font-medium">
                {totals.booksBalance.III}<span className="text-text-muted">/{totals.booksNeeded.III}</span>
              </td>
              <td className="px-2 py-2 text-center text-sm font-medium">
                {totals.booksBalance.IV}<span className="text-text-muted">/{totals.booksNeeded.IV}</span>
              </td>
              <td className="px-2 py-2 text-center text-sm font-medium text-material-twine">
                {totals.matsReceived.twine}<span className="text-text-muted">/{totals.matsNeeded.twine}</span>
              </td>
              <td className="px-2 py-2 text-center text-sm font-medium text-material-glaze">
                {totals.matsReceived.glaze}<span className="text-text-muted">/{totals.matsNeeded.glaze}</span>
              </td>
              <td className="px-2 py-2 text-center text-sm font-medium text-material-solvent">
                {totals.matsReceived.solvent}<span className="text-text-muted">/{totals.matsNeeded.solvent}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-border-default">
        <div className="flex flex-wrap gap-4 text-xs text-text-muted">
          <span>I-IV = Book types (Floor 1-4)</span>
          <span className="text-material-twine">T = {tierInfo.upgradeMaterials.twine}</span>
          <span className="text-material-glaze">G = {tierInfo.upgradeMaterials.glaze}</span>
          <span className="text-material-solvent">S = {tierInfo.upgradeMaterials.solvent}</span>
          <span className="text-status-success">Green = Complete</span>
        </div>
      </div>
    </div>
  );
}
