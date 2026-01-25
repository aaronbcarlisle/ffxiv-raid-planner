/**
 * Team Summary Enhanced
 *
 * Combines gear tracking, book tracking, and material tracking into a single
 * comprehensive per-player summary view with aggregate stats and visual indicators.
 */

import { useEffect, useMemo, memo, useState, useCallback } from 'react';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { JobIcon } from '../ui/JobIcon';
import { calculatePlayerCompletion, calculatePlayerMaterials, calculatePlayerBooks } from '../../utils/calculations';
import { Users, Target, Wrench, BookOpen, ChevronDown } from 'lucide-react';
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

// Simple text cell for book/material values - shows current/needed with color coding
function ValueCell({
  current,
  needed,
  colorClass,
}: {
  current: number;
  needed: number;
  colorClass?: string;
}) {
  if (needed === 0) {
    return <span className="text-text-muted">-</span>;
  }

  const isComplete = current >= needed;

  return (
    <span className={isComplete ? 'text-status-success font-medium' : colorClass || 'text-text-primary'}>
      {current}<span className="text-text-muted">/{needed}</span>
    </span>
  );
}

// Memoized row component
const SummaryRow = memo(function SummaryRow({ row }: { row: PlayerSummaryRow }) {
  const { player, gearPercent, booksBalance, booksNeeded, matsReceived, matsNeeded } = row;

  // Get color class based on gear completion
  const getGearColor = () => {
    if (gearPercent === 100) return 'bg-status-success';
    if (gearPercent >= 75) return 'bg-status-warning';
    if (gearPercent >= 50) return 'bg-accent';
    return 'bg-text-muted';
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

      {/* Gear % with progress bar - keep this one */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold min-w-[32px] ${
            gearPercent === 100 ? 'text-status-success' :
            gearPercent >= 75 ? 'text-status-warning' :
            gearPercent >= 50 ? 'text-accent' :
            'text-text-primary'
          }`}>
            {gearPercent}%
          </span>
          <div className="flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden min-w-[60px]">
            <div
              className={`h-full rounded-full transition-all ${getGearColor()}`}
              style={{ width: `${gearPercent}%` }}
            />
          </div>
        </div>
      </td>

      {/* Books: I, II, III, IV - simple text values */}
      <td className="px-2 py-2 text-center text-sm">
        <ValueCell current={booksBalance.I} needed={booksNeeded.I} />
      </td>
      <td className="px-2 py-2 text-center text-sm">
        <ValueCell current={booksBalance.II} needed={booksNeeded.II} />
      </td>
      <td className="px-2 py-2 text-center text-sm">
        <ValueCell current={booksBalance.III} needed={booksNeeded.III} />
      </td>
      <td className="px-2 py-2 text-center text-sm">
        <ValueCell current={booksBalance.IV} needed={booksNeeded.IV} />
      </td>

      {/* Materials: T, G, S - simple text with color */}
      <td className="px-2 py-2 text-center text-sm">
        <ValueCell current={matsReceived.twine} needed={matsNeeded.twine} colorClass="text-material-twine" />
      </td>
      <td className="px-2 py-2 text-center text-sm">
        <ValueCell current={matsReceived.glaze} needed={matsNeeded.glaze} colorClass="text-material-glaze" />
      </td>
      <td className="px-2 py-2 text-center text-sm">
        <ValueCell current={matsReceived.solvent} needed={matsNeeded.solvent} colorClass="text-material-solvent" />
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

  // Collapse state - defaults to collapsed on mobile, expanded on desktop
  const [statsExpanded, setStatsExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem('summary-stats-expanded');
      if (saved !== null) return saved === 'true';
    } catch { /* ignore */ }
    // Check screen size synchronously for default
    if (typeof window !== 'undefined') {
      return !window.matchMedia('(max-width: 639px)').matches;
    }
    return true; // Default to expanded on server
  });

  // Persist preference
  const toggleStatsExpanded = useCallback(() => {
    setStatsExpanded(prev => {
      const newValue = !prev;
      try {
        localStorage.setItem('summary-stats-expanded', String(newValue));
      } catch { /* ignore */ }
      return newValue;
    });
  }, []);

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

  // Calculate aggregate stats for summary cards
  // Must be before early return to comply with Rules of Hooks
  const aggregateStats = useMemo(() => {
    if (playerSummaries.length === 0) {
      return {
        playerCount: 0,
        gearPercent: 0,
        booksProgress: { have: 0, need: 0 },
        matsProgress: { have: 0, need: 0 },
      };
    }
    const totalBooksNeeded = totals.booksNeeded.I + totals.booksNeeded.II + totals.booksNeeded.III + totals.booksNeeded.IV;
    const totalBooksHave = totals.booksBalance.I + totals.booksBalance.II + totals.booksBalance.III + totals.booksBalance.IV;
    const totalMatsNeeded = totals.matsNeeded.twine + totals.matsNeeded.glaze + totals.matsNeeded.solvent;
    const totalMatsHave = totals.matsReceived.twine + totals.matsReceived.glaze + totals.matsReceived.solvent;

    return {
      playerCount: playerSummaries.length,
      gearPercent: totals.gearPercent,
      booksProgress: { have: totalBooksHave, need: totalBooksNeeded },
      matsProgress: { have: totalMatsHave, need: totalMatsNeeded },
    };
  }, [totals, playerSummaries.length]);

  if (playerSummaries.length === 0) {
    return (
      <div className="bg-surface-card rounded-lg border border-border-default p-8 text-center">
        <p className="text-text-muted">No configured players to display</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-card rounded-lg border border-border-default">
      {/* Header with collapsible toggle */}
      <div className="p-4 border-b border-border-default">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-text-primary">Team Summary</h3>
            <p className="text-sm text-text-muted mt-1">
              Book and material progress for all players. Values show current balance vs. needed.
            </p>
          </div>
          {/* Collapse toggle - mobile only */}
          {/* design-system-ignore: Custom toggle button for collapsible section */}
          <button
            onClick={toggleStatsExpanded}
            className="sm:hidden flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors rounded hover:bg-surface-hover"
            aria-expanded={statsExpanded}
            aria-controls="summary-stats"
          >
            <span>{statsExpanded ? 'Collapse' : 'Expand'}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${statsExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Collapsed summary - show key stats inline when collapsed on mobile only */}
        {!statsExpanded && (
          <div className="sm:hidden flex items-center gap-4 mt-2 text-sm">
            <span className="text-text-secondary">
              <span className="text-accent font-medium">{aggregateStats.gearPercent}%</span> BiS
            </span>
            <span className="text-text-secondary">
              <span className="text-text-primary font-medium">{aggregateStats.booksProgress.have}/{aggregateStats.booksProgress.need}</span> Books
            </span>
            <span className="text-text-secondary">
              <span className="text-text-primary font-medium">{aggregateStats.matsProgress.have}/{aggregateStats.matsProgress.need}</span> Mats
            </span>
          </div>
        )}
      </div>

      {/* Aggregate Stats Cards - Collapsible on mobile, always expanded on desktop */}
      <div
        id="summary-stats"
        className={`grid transition-[grid-template-rows] duration-300 ease-out sm:!grid-rows-[1fr] ${
          statsExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className={`overflow-hidden sm:border-b sm:border-border-default ${statsExpanded ? 'border-b border-border-default' : ''}`}>
          <div className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Players */}
          <div className="bg-surface-base rounded-lg p-4 border border-border-subtle">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-accent/10">
                <Users className="w-5 h-5 text-accent" />
              </div>
              <span className="text-text-secondary text-sm">Players</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {aggregateStats.playerCount}<span className="text-text-muted text-lg">/8</span>
            </div>
          </div>

          {/* BiS Completion */}
          <div className="bg-surface-base rounded-lg p-4 border border-border-subtle">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${
                aggregateStats.gearPercent === 100
                  ? 'bg-status-success/10'
                  : aggregateStats.gearPercent >= 50
                    ? 'bg-accent/10'
                    : 'bg-surface-elevated'
              }`}>
                <Target className={`w-5 h-5 ${
                  aggregateStats.gearPercent === 100
                    ? 'text-status-success'
                    : aggregateStats.gearPercent >= 50
                      ? 'text-accent'
                      : 'text-text-secondary'
                }`} />
              </div>
              <span className="text-text-secondary text-sm">BiS Progress</span>
            </div>
            <div className={`text-2xl font-bold ${
              aggregateStats.gearPercent === 100
                ? 'text-status-success'
                : aggregateStats.gearPercent >= 50
                  ? 'text-accent'
                  : 'text-text-primary'
            }`}>
              {aggregateStats.gearPercent}%
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  aggregateStats.gearPercent === 100
                    ? 'bg-status-success'
                    : aggregateStats.gearPercent >= 50
                      ? 'bg-accent'
                      : 'bg-text-muted'
                }`}
                style={{ width: `${aggregateStats.gearPercent}%` }}
              />
            </div>
          </div>

          {/* Books Progress */}
          <div className="bg-surface-base rounded-lg p-4 border border-border-subtle">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-surface-elevated">
                <BookOpen className="w-5 h-5 text-text-secondary" />
              </div>
              <span className="text-text-secondary text-sm">Books Collected</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {aggregateStats.booksProgress.have}
              <span className="text-text-muted text-lg">/{aggregateStats.booksProgress.need}</span>
            </div>
          </div>

          {/* Materials Progress */}
          <div className="bg-surface-base rounded-lg p-4 border border-border-subtle">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-surface-elevated">
                <Wrench className="w-5 h-5 text-text-secondary" />
              </div>
              <span className="text-text-secondary text-sm">Materials Received</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {aggregateStats.matsProgress.have}
              <span className="text-text-muted text-lg">/{aggregateStats.matsProgress.need}</span>
            </div>
          </div>
        </div>
        </div>
        </div>
      </div>

      {/* Table - simplified layout */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default bg-surface-elevated/50">
              <th className="px-3 py-2 text-left text-sm font-medium text-text-secondary">Player</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-text-secondary" style={{ minWidth: '140px' }}>Gear</th>
              <th className="px-2 py-2 text-center text-sm font-medium text-text-secondary" title={tierInfo.floors[0]}>I</th>
              <th className="px-2 py-2 text-center text-sm font-medium text-text-secondary" title={tierInfo.floors[1]}>II</th>
              <th className="px-2 py-2 text-center text-sm font-medium text-text-secondary" title={tierInfo.floors[2]}>III</th>
              <th className="px-2 py-2 text-center text-sm font-medium text-text-secondary" title={tierInfo.floors[3]}>IV</th>
              <th className="px-2 py-2 text-center text-sm font-medium text-material-twine" title={tierInfo.upgradeMaterials.twine}>T</th>
              <th className="px-2 py-2 text-center text-sm font-medium text-material-glaze" title={tierInfo.upgradeMaterials.glaze}>G</th>
              <th className="px-2 py-2 text-center text-sm font-medium text-material-solvent" title={tierInfo.upgradeMaterials.solvent}>S</th>
            </tr>
          </thead>
          <tbody>
            {playerSummaries.map(row => (
              <SummaryRow key={row.player.id} row={row} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-default bg-surface-elevated/30">
              <td className="px-3 py-2 text-sm font-semibold text-text-secondary">Team Total</td>
              <td className="px-3 py-2">
                <span className={`text-sm font-bold ${
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

      {/* Legend - more compact */}
      <div className="px-4 py-3 border-t border-border-default bg-surface-elevated/20">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
          <span>I-IV = Books (Floor 1-4)</span>
          <span className="text-material-twine">T = {tierInfo.upgradeMaterials.twine}</span>
          <span className="text-material-glaze">G = {tierInfo.upgradeMaterials.glaze}</span>
          <span className="text-material-solvent">S = {tierInfo.upgradeMaterials.solvent}</span>
          <span className="text-status-success">Green = Complete</span>
        </div>
      </div>
    </div>
  );
}
