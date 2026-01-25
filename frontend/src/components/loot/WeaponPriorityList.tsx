/**
 * Weapon Priority List
 *
 * Display calculated weapon priority for Floor 4 (weapon floor).
 * Shows which players should receive weapons in what order.
 */

import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SnapshotPlayer, StaticSettings } from '../../types';
import { getWeaponPriorityForJob, type WeaponPriorityEntry } from '../../utils/weaponPriority';
import { RAID_JOBS } from '../../gamedata/jobs';
import { JobIcon } from '../ui/JobIcon';
import { getRoleColor } from '../../gamedata';
import { FilterBar } from './FilterBar';
import { RoleSection } from './RoleSection';
import { Tooltip } from '../primitives/Tooltip';
import { useDevice } from '../../hooks/useDevice';

// Roll result for a player
interface RollResult {
  playerId: string;
  roll: number;
}

// Build tooltip content for score breakdown
function ScoreTooltip({ entry }: { entry: WeaponPriorityEntry }) {
  return (
    <div className="text-xs space-y-0.5">
      <div className="font-medium text-text-primary mb-1">Priority Score: {entry.score}</div>
      {entry.mainJobBonus > 0 && (
        <div className="text-text-secondary">Main Job Bonus: <span className="text-accent">+{entry.mainJobBonus}</span></div>
      )}
      {entry.roleScore > 0 && (
        <div className="text-text-secondary">Role Priority: <span className="text-accent">+{entry.roleScore}</span></div>
      )}
      <div className="text-text-secondary">List Position: <span className="text-accent">+{entry.rankScore}</span></div>
    </div>
  );
}

// Build tooltip content for weapon log button
function WeaponLogTooltip({ job, jobName, playerName }: { job: string; jobName: string; playerName: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <JobIcon job={job} size="xs" />
      <span>Log {jobName} Weapon for {playerName}</span>
    </span>
  );
}

/**
 * Visual styles for displaying tied players in weapon priority lists.
 * - 'connector': Shows a vertical line connecting tied players (default)
 * - 'border': Adds a colored border around tied entries
 * - 'sameRank': Displays same rank number for all tied players
 * - 'rankNotation': Shows "T1", "T2" notation for tied ranks
 * - 'background': Uses background color to group tied players
 */
export type TieStyle = 'border' | 'sameRank' | 'rankNotation' | 'background' | 'connector';

interface WeaponPriorityCardProps {
  job: string;
  jobName: string;
  priority: WeaponPriorityEntry[];
  showLogButtons: boolean;
  onLogClick?: (weaponJob: string, player: SnapshotPlayer) => void;
  /** Visual style for displaying tied players. Defaults to 'connector'. */
  tieStyle?: TieStyle;
}

/**
 * Displays weapon priority list for a specific job with tie visualization.
 * Shows ranked players with their priority scores and optional log buttons.
 */
export const WeaponPriorityCard = memo(function WeaponPriorityCard({
  job,
  jobName,
  priority,
  showLogButtons,
  onLogClick,
  tieStyle = 'connector',
}: WeaponPriorityCardProps) {
  const [rollResults, setRollResults] = useState<Map<number, RollResult[]>>(new Map());
  // Track which tie groups are expanded (for connector style)
  const [expandedTieGroups, setExpandedTieGroups] = useState<Set<number>>(new Set());

  // Toggle expansion of a tie group
  const toggleTieGroup = useCallback((tieGroup: number) => {
    setExpandedTieGroups(prev => {
      const next = new Set(prev);
      if (next.has(tieGroup)) {
        next.delete(tieGroup);
      } else {
        next.add(tieGroup);
      }
      return next;
    });
  }, []);

  // For 'border' style: Group entries and collapse tie groups into single render blocks
  // For other styles: Keep entries flat but annotate with rank and tie info
  const groupedEntries = useMemo(() => {
    if (tieStyle === 'border') {
      // Original collapsed logic for bordered style
      const result: Array<{ entry: WeaponPriorityEntry; displayRank: number; tieGroupEntries?: WeaponPriorityEntry[] }> = [];
      let currentRank = 1;
      let i = 0;

      while (i < priority.length) {
        const entry = priority[i];

        if (entry.isTied && entry.tieGroup !== undefined) {
          const tieGroupEntries = priority.filter(
            (e) => e.tieGroup === entry.tieGroup
          );

          result.push({
            entry,
            displayRank: currentRank,
            tieGroupEntries,
          });

          i += tieGroupEntries.length;
          currentRank++;
        } else {
          result.push({ entry, displayRank: currentRank });
          i++;
          currentRank++;
        }
      }

      return result;
    }

    // For flat styles (sameRank, rankNotation, background, connector)
    // Each entry renders separately, but tied entries share the same rank
    const result: Array<{
      entry: WeaponPriorityEntry;
      displayRank: number;
      isTied: boolean;
      isFirstInTie: boolean;
      isLastInTie: boolean;
      tieGroupEntries?: WeaponPriorityEntry[];
    }> = [];
    let currentRank = 1;
    let i = 0;

    while (i < priority.length) {
      const entry = priority[i];

      if (entry.isTied && entry.tieGroup !== undefined) {
        const tieGroupEntries = priority.filter(
          (e) => e.tieGroup === entry.tieGroup
        );

        // Add all entries in the tie group with same rank
        tieGroupEntries.forEach((tieEntry, tieIdx) => {
          result.push({
            entry: tieEntry,
            displayRank: currentRank,
            isTied: true,
            isFirstInTie: tieIdx === 0,
            isLastInTie: tieIdx === tieGroupEntries.length - 1,
            tieGroupEntries: tieIdx === 0 ? tieGroupEntries : undefined, // Only first gets the group
          });
        });

        i += tieGroupEntries.length;
        currentRank++;
      } else {
        result.push({
          entry,
          displayRank: currentRank,
          isTied: false,
          isFirstInTie: false,
          isLastInTie: false,
        });
        i++;
        currentRank++;
      }
    }

    return result;
  }, [priority, tieStyle]);

  // Roll for a tie group
  const handleRoll = useCallback((tieGroup: number) => {
    // Roll for ALL tied entries in this group
    const allTiedEntries = priority.filter((e) => e.tieGroup === tieGroup);
    const results: RollResult[] = allTiedEntries.map((e) => ({
      playerId: e.player.id,
      roll: Math.floor(Math.random() * 100) + 1, // 1-100
    }));

    // Sort by roll descending so winner is first
    results.sort((a, b) => b.roll - a.roll);

    setRollResults((prev) => new Map(prev).set(tieGroup, results));
  }, [priority]);

  // Get winner from roll results
  const getWinnerId = useCallback((tieGroup: number): string | null => {
    const results = rollResults.get(tieGroup);
    if (!results || results.length === 0) return null;
    // Winner is highest roll (first after sorting)
    return results[0].playerId;
  }, [rollResults]);

  // Get roll for a specific player
  const getPlayerRoll = useCallback((tieGroup: number, playerId: string): number | null => {
    const results = rollResults.get(tieGroup);
    if (!results) return null;
    const result = results.find((r) => r.playerId === playerId);
    return result?.roll ?? null;
  }, [rollResults]);

  return (
    <div className="bg-surface-base rounded-lg p-3">
      {/* Job header */}
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border-default">
        <JobIcon job={job} size="sm" />
        <div className="font-medium text-text-primary">{jobName}</div>
      </div>

      {/* Priority list */}
      {priority.length === 0 ? (
        <div className="text-sm text-text-muted py-2">No one needs</div>
      ) : tieStyle === 'border' ? (
        // Original bordered tie group style
        <div className="space-y-1">
          {groupedEntries.map(({ entry, displayRank, tieGroupEntries }, groupIndex) => {
            const isTieGroup = tieGroupEntries && tieGroupEntries.length > 1;
            const tieGroup = entry.tieGroup;
            const hasRolled = tieGroup !== undefined && rollResults.has(tieGroup);
            const winnerId = tieGroup !== undefined ? getWinnerId(tieGroup) : null;

            if (isTieGroup && tieGroupEntries) {
              // Render tie group
              return (
                <div
                  key={`tie-${tieGroup}`}
                  className={`rounded-r border-l-2 ${
                    groupIndex === 0 ? 'border-accent bg-surface-elevated/50' : 'border-accent/40 bg-surface-elevated/30'
                  }`}
                >
                  {/* Tie group header with roll button */}
                  <div className="flex items-center justify-between px-2 py-1 border-b border-border-subtle">
                    <Tooltip content="Click to show tied players">
                      <span className="text-xs text-text-muted font-medium cursor-help">
                        Tied for #{displayRank}
                      </span>
                    </Tooltip>
                    <Tooltip content={hasRolled ? 'Roll again for a new winner' : 'Randomly select a winner'}>
                      {/* design-system-ignore: Roll button with specific accent styling */}
                      <button
                        onClick={() => handleRoll(tieGroup!)}
                        className="px-2 py-0.5 text-xs rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors font-medium"
                      >
                        {hasRolled ? 'Reroll' : 'Roll'}
                      </button>
                    </Tooltip>
                  </div>

                  {/* Tied players */}
                  {tieGroupEntries.map((tieEntry) => {
                    const roleColor = tieEntry.player.role
                      ? getRoleColor(tieEntry.player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster')
                      : 'var(--color-text-secondary)';
                    const playerRoll = tieGroup !== undefined ? getPlayerRoll(tieGroup, tieEntry.player.id) : null;
                    const isWinner = winnerId === tieEntry.player.id;
                    const isFirst = groupIndex === 0;

                    return (
                      <div
                        key={tieEntry.player.id}
                        className={`flex items-center justify-between px-2 py-1 text-sm group ${
                          isWinner ? 'bg-status-success/20' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`flex-shrink-0 w-4 ${
                              isFirst || isWinner ? 'text-accent font-medium' : 'text-text-secondary'
                            }`}
                          >
                            -
                          </span>
                          <JobIcon job={tieEntry.player.job} size="xs" />
                          <span
                            className={`truncate ${
                              isWinner ? 'text-status-success font-medium' : isFirst ? 'text-accent font-medium' : 'text-text-secondary'
                            }`}
                          >
                            {tieEntry.player.name}
                          </span>
                          {tieEntry.isMainJob && (
                            <span className="flex-shrink-0 text-xs px-1 py-0.5 rounded bg-accent/20 text-accent">
                              <span className="hidden sm:inline">Main</span>
                              <span className="sm:hidden">M</span>
                            </span>
                          )}
                          {playerRoll !== null && (
                            <span
                              className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded ${
                                isWinner ? 'bg-status-success/30 text-status-success font-medium' : 'bg-surface-elevated text-text-muted'
                              }`}
                            >
                              {playerRoll}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Log button - shows on hover */}
                          {showLogButtons && onLogClick && (
                            <Tooltip content={<WeaponLogTooltip job={job} jobName={jobName} playerName={tieEntry.player.name} />}>
                              {/* design-system-ignore: Log button with specific accent styling */}
                              <button
                                onClick={() => onLogClick(job, tieEntry.player)}
                                className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-all"
                              >
                                Log
                              </button>
                            </Tooltip>
                          )}
                          <Tooltip delayDuration={200} content={<ScoreTooltip entry={tieEntry} />}>
                            <span
                              className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded cursor-help"
                              style={{ backgroundColor: `${roleColor}30`, color: roleColor }}
                            >
                              {tieEntry.score}
                            </span>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Render regular (non-tied) entry
            const roleColor = entry.player.role
              ? getRoleColor(entry.player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster')
              : 'var(--color-text-secondary)';
            const isFirst = groupIndex === 0;

            return (
              <div
                key={entry.player.id}
                className={`flex items-center justify-between px-2 py-1 rounded text-sm group ${
                  isFirst ? 'bg-accent/20' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`flex-shrink-0 ${
                      isFirst ? 'text-accent font-medium' : 'text-text-secondary'
                    }`}
                  >
                    {displayRank}.
                  </span>
                  <JobIcon job={entry.player.job} size="xs" />
                  <span
                    className={`truncate ${
                      isFirst ? 'text-accent font-medium' : 'text-text-secondary'
                    }`}
                  >
                    {entry.player.name}
                  </span>
                  {entry.isMainJob && (
                    <span className="flex-shrink-0 text-xs px-1 py-0.5 rounded bg-accent/20 text-accent">
                      <span className="hidden sm:inline">Main</span>
                      <span className="sm:hidden">M</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Log button - shows on hover for any entry */}
                  {showLogButtons && onLogClick && (
                    <Tooltip content={<WeaponLogTooltip job={job} jobName={jobName} playerName={entry.player.name} />}>
                      {/* design-system-ignore: Log button with specific accent styling */}
                      <button
                        onClick={() => onLogClick(job, entry.player)}
                        className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-all"
                      >
                        Log
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip delayDuration={200} content={<ScoreTooltip entry={entry} />}>
                    <span
                      className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded cursor-help"
                      style={{ backgroundColor: `${roleColor}30`, color: roleColor }}
                    >
                      {entry.score}
                    </span>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      ) : tieStyle === 'connector' ? (
        // Style D: Connector with header, background, and connecting dots/line
        // Uses grouped rendering similar to border style
        <div className="space-y-1">
          {(() => {
            // Re-group entries for connector style (need grouped blocks like border style)
            const blocks: Array<{ type: 'single' | 'tie'; displayRank: number; entries: WeaponPriorityEntry[]; tieGroup?: number }> = [];
            let currentRank = 1;
            let i = 0;

            while (i < priority.length) {
              const entry = priority[i];
              if (entry.isTied && entry.tieGroup !== undefined) {
                const tieGroupEntries = priority.filter((e) => e.tieGroup === entry.tieGroup);
                blocks.push({ type: 'tie', displayRank: currentRank, entries: tieGroupEntries, tieGroup: entry.tieGroup });
                i += tieGroupEntries.length;
                currentRank++;
              } else {
                blocks.push({ type: 'single', displayRank: currentRank, entries: [entry] });
                i++;
                currentRank++;
              }
            }

            return blocks.map((block, blockIndex) => {
              const isFirstBlock = blockIndex === 0;

              if (block.type === 'tie') {
                const hasRolled = block.tieGroup !== undefined && rollResults.has(block.tieGroup);
                const winnerId = block.tieGroup !== undefined ? getWinnerId(block.tieGroup) : null;
                const winnerEntry = winnerId ? block.entries.find(e => e.player.id === winnerId) : null;
                const isExpanded = block.tieGroup !== undefined && expandedTieGroups.has(block.tieGroup);

                return (
                  <div
                    key={`tie-${block.tieGroup}`}
                    className={`rounded ${isFirstBlock ? 'bg-surface-elevated/50' : 'bg-surface-elevated/30'}`}
                  >
                    {/* Tie group header - clickable to expand/collapse */}
                    <div
                      className="flex items-center justify-between px-2 py-1 cursor-pointer select-none"
                      onClick={() => toggleTieGroup(block.tieGroup!)}
                    >
                      <Tooltip content={isExpanded ? 'Click to collapse' : 'Click to expand tied players'}>
                        <div className="flex items-center gap-1.5">
                          {/* Rank number - same style as regular entries */}
                          <span className={`text-sm ${isFirstBlock ? 'text-accent font-medium' : 'text-text-secondary'}`}>
                            {block.displayRank}.
                          </span>
                          {/* Expand/collapse chevron */}
                          <svg
                            className={`w-3 h-3 text-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-xs text-text-muted font-medium">
                            <span className="sm:hidden">T({block.entries.length})</span>
                            <span className="hidden sm:inline">Tied ({block.entries.length})</span>
                          </span>
                          {/* Winner info shown in header after roll */}
                          {hasRolled && winnerEntry && (
                            <div className="flex items-center gap-1.5 ml-2">
                              <JobIcon job={winnerEntry.player.job} size="xs" />
                              <span className="text-xs text-status-success font-medium">
                                {winnerEntry.player.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </Tooltip>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {/* Log button for winner - always visible after roll */}
                        {hasRolled && winnerEntry && onLogClick && (
                          <Tooltip content={<WeaponLogTooltip job={job} jobName={jobName} playerName={winnerEntry.player.name} />}>
                            {/* design-system-ignore: Log button with specific accent styling */}
                            <button
                              onClick={() => onLogClick(job, winnerEntry.player)}
                              className="px-2 py-0.5 text-xs rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-colors"
                            >
                              Log
                            </button>
                          </Tooltip>
                        )}
                        <Tooltip content={hasRolled ? 'Roll again for a new winner' : 'Randomly select a winner'}>
                          {/* design-system-ignore: Roll button with specific accent styling */}
                          <button
                            onClick={() => handleRoll(block.tieGroup!)}
                            className="px-2 py-0.5 text-xs rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors font-medium"
                          >
                            {hasRolled ? 'Reroll' : 'Roll'}
                          </button>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Expandable tied players with connector line */}
                    {isExpanded && (
                      <div className="relative shadow-[inset_0_0_6px_rgba(0,0,0,1)] border-t border-border-subtle/50 rounded-b">
                        {/* Connector line - positioned below the chevron (around 30px from left) */}
                        <div className="absolute left-[30px] top-[14px] bottom-[14px] w-px bg-accent/50" />

                        {block.entries.map((tieEntry) => {
                          const roleColor = tieEntry.player.role
                            ? getRoleColor(tieEntry.player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster')
                            : 'var(--color-text-secondary)';
                          const playerRoll = block.tieGroup !== undefined ? getPlayerRoll(block.tieGroup, tieEntry.player.id) : null;
                          const isWinner = winnerId === tieEntry.player.id;
                          const isFirst = isFirstBlock;

                          return (
                            <div
                              key={tieEntry.player.id}
                              className={`relative flex items-center justify-between pl-10 pr-2 py-1 text-sm group ${
                                isWinner ? 'bg-status-success/20' : ''
                              }`}
                            >
                              {/* Connector dot - centered on line at 30px */}
                              <div className="absolute left-[26px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent border border-[#1a1a22]" />

                              <div className="flex items-center gap-2 min-w-0">
                                <JobIcon job={tieEntry.player.job} size="xs" />
                                <span
                                  className={`truncate ${
                                    isWinner ? 'text-status-success font-medium' : isFirst ? 'text-accent font-medium' : 'text-text-secondary'
                                  }`}
                                >
                                  {tieEntry.player.name}
                                </span>
                                {tieEntry.isMainJob && (
                                  <span className="flex-shrink-0 text-xs px-1 py-0.5 rounded bg-accent/20 text-accent">
                                    Main
                                  </span>
                                )}
                                {playerRoll !== null && (
                                  <span
                                    className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded ${
                                      isWinner ? 'bg-status-success/30 text-status-success font-medium' : 'bg-surface-elevated text-text-muted'
                                    }`}
                                  >
                                    {playerRoll}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Log button - shows on hover */}
                                {showLogButtons && onLogClick && (
                                  <Tooltip content={<WeaponLogTooltip job={job} jobName={jobName} playerName={tieEntry.player.name} />}>
                                    {/* design-system-ignore: Log button with specific accent styling */}
                                    <button
                                      onClick={() => onLogClick(job, tieEntry.player)}
                                      className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-all"
                                    >
                                      Log
                                    </button>
                                  </Tooltip>
                                )}
                                <Tooltip delayDuration={200} content={<ScoreTooltip entry={tieEntry} />}>
                                  <span
                                    className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded cursor-help"
                                    style={{ backgroundColor: `${roleColor}30`, color: roleColor }}
                                  >
                                    {tieEntry.score}
                                  </span>
                                </Tooltip>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Single (non-tied) entry
              const entry = block.entries[0];
              const roleColor = entry.player.role
                ? getRoleColor(entry.player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster')
                : 'var(--color-text-secondary)';
              const isFirst = isFirstBlock;

              return (
                <div
                  key={entry.player.id}
                  className={`flex items-center justify-between px-2 py-1 rounded text-sm group ${
                    isFirst ? 'bg-accent/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`flex-shrink-0 ${
                        isFirst ? 'text-accent font-medium' : 'text-text-secondary'
                      }`}
                    >
                      {block.displayRank}.
                    </span>
                    <JobIcon job={entry.player.job} size="xs" />
                    <span
                      className={`truncate ${
                        isFirst ? 'text-accent font-medium' : 'text-text-secondary'
                      }`}
                    >
                      {entry.player.name}
                    </span>
                    {entry.isMainJob && (
                      <span className="flex-shrink-0 text-xs px-1 py-0.5 rounded bg-accent/20 text-accent">
                        Main
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Log button - shows on hover */}
                    {showLogButtons && onLogClick && (
                      <Tooltip content={<WeaponLogTooltip job={job} jobName={jobName} playerName={entry.player.name} />}>
                        {/* design-system-ignore: Log button with specific accent styling */}
                        <button
                          onClick={() => onLogClick(job, entry.player)}
                          className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-all"
                        >
                          Log
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip delayDuration={200} content={<ScoreTooltip entry={entry} />}>
                      <span
                        className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded cursor-help"
                        style={{ backgroundColor: `${roleColor}30`, color: roleColor }}
                      >
                        {entry.score}
                      </span>
                    </Tooltip>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      ) : (
        // Flat styles: sameRank, rankNotation, background
        <div className="space-y-0">
          {groupedEntries.map((grouped) => {
            const { entry, displayRank, isTied, isFirstInTie, tieGroupEntries } = grouped as {
              entry: WeaponPriorityEntry;
              displayRank: number;
              isTied: boolean;
              isFirstInTie: boolean;
              tieGroupEntries?: WeaponPriorityEntry[];
            };
            const tieGroup = entry.tieGroup;
            const hasRolled = tieGroup !== undefined && rollResults.has(tieGroup);
            const winnerId = tieGroup !== undefined ? getWinnerId(tieGroup) : null;
            const playerRoll = tieGroup !== undefined ? getPlayerRoll(tieGroup, entry.player.id) : null;
            const isWinner = winnerId === entry.player.id;
            const isFirst = displayRank === 1;
            const roleColor = entry.player.role
              ? getRoleColor(entry.player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster')
              : 'var(--color-text-secondary)';

            // Determine rank display based on style
            let rankDisplay: React.ReactNode;
            if (tieStyle === 'sameRank') {
              // Style A: Same rank number + "=" indicator
              rankDisplay = (
                <span className={`flex-shrink-0 w-6 text-right ${isFirst || isWinner ? 'text-accent font-medium' : 'text-text-secondary'}`}>
                  {displayRank}.
                </span>
              );
            } else if (tieStyle === 'rankNotation') {
              // Style B: "2=." notation
              rankDisplay = (
                <span className={`flex-shrink-0 w-6 text-right ${isFirst || isWinner ? 'text-accent font-medium' : 'text-text-secondary'}`}>
                  {displayRank}{isTied ? '=' : ''}.
                </span>
              );
            } else if (tieStyle === 'background') {
              // Style C: Same rank number
              rankDisplay = (
                <span className={`flex-shrink-0 w-6 text-right ${isFirst || isWinner ? 'text-accent font-medium' : 'text-text-secondary'}`}>
                  {displayRank}.
                </span>
              );
            }

            // Background for style C (subtle banding)
            const bgClass = tieStyle === 'background' && isTied
              ? (isFirst ? 'bg-accent/10' : 'bg-surface-elevated/40')
              : (isFirst && !isTied ? 'bg-accent/20' : '');

            return (
              <div
                key={entry.player.id}
                className={`relative flex items-center justify-between px-2 py-1 text-sm group ${bgClass} ${isWinner ? 'bg-status-success/20' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {rankDisplay}
                  {/* Tie indicator for style A */}
                  {tieStyle === 'sameRank' && isTied && (
                    <span className="flex-shrink-0 w-3 text-accent/60 text-xs font-bold">=</span>
                  )}
                  <JobIcon job={entry.player.job} size="xs" />
                  <span
                    className={`truncate ${
                      isWinner ? 'text-status-success font-medium' : isFirst ? 'text-accent font-medium' : 'text-text-secondary'
                    }`}
                  >
                    {entry.player.name}
                  </span>
                  {entry.isMainJob && (
                    <span className="flex-shrink-0 text-xs px-1 py-0.5 rounded bg-accent/20 text-accent">
                      <span className="hidden sm:inline">Main</span>
                      <span className="sm:hidden">M</span>
                    </span>
                  )}
                  {playerRoll !== null && (
                    <span
                      className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded ${
                        isWinner ? 'bg-status-success/30 text-status-success font-medium' : 'bg-surface-elevated text-text-muted'
                      }`}
                    >
                      {playerRoll}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Roll button - only on first entry in tie group */}
                  {isTied && isFirstInTie && tieGroupEntries && (
                    <Tooltip content={hasRolled ? 'Roll again for a new winner' : 'Randomly select a winner from tied players'}>
                      <button
                        onClick={() => handleRoll(tieGroup!)}
                        className="px-2 py-0.5 text-xs rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors font-medium"
                      >
                        {hasRolled ? 'Reroll' : 'Roll'}
                      </button>
                    </Tooltip>
                  )}
                  {/* Log button - shows on hover */}
                  {showLogButtons && onLogClick && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip content={<WeaponLogTooltip job={job} jobName={jobName} playerName={entry.player.name} />}>
                        <button
                          onClick={() => onLogClick(job, entry.player)}
                          className="px-2 py-0.5 text-xs rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-colors"
                        >
                          Log
                        </button>
                      </Tooltip>
                    </div>
                  )}
                  <Tooltip delayDuration={200} content={<ScoreTooltip entry={entry} />}>
                    <span
                      className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded cursor-help"
                      style={{ backgroundColor: `${roleColor}30`, color: roleColor }}
                    >
                      {entry.score}
                    </span>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// Role section configuration - separate physical ranged and magical ranged (caster)
type RoleSectionId = 'tank' | 'healer' | 'melee' | 'ranged' | 'caster';

const ROLE_SECTIONS: { id: RoleSectionId; label: string; roles: string[]; textColor: string; bgColor: string; borderColor: string }[] = [
  { id: 'tank', label: 'Tanks', roles: ['tank'], textColor: 'text-role-tank', bgColor: 'bg-role-tank', borderColor: 'border-role-tank' },
  { id: 'healer', label: 'Healers', roles: ['healer'], textColor: 'text-role-healer', bgColor: 'bg-role-healer', borderColor: 'border-role-healer' },
  { id: 'melee', label: 'Melee DPS', roles: ['melee'], textColor: 'text-role-melee', bgColor: 'bg-role-melee', borderColor: 'border-role-melee' },
  { id: 'ranged', label: 'Physical Ranged', roles: ['ranged'], textColor: 'text-role-ranged', bgColor: 'bg-role-ranged', borderColor: 'border-role-ranged' },
  { id: 'caster', label: 'Magical Ranged', roles: ['caster'], textColor: 'text-role-caster', bgColor: 'bg-role-caster', borderColor: 'border-role-caster' },
];

interface WeaponPriorityListProps {
  players: SnapshotPlayer[];
  settings: StaticSettings;
  // Optional props for inline logging
  showLogButtons?: boolean;
  onLogClick?: (weaponJob: string, player: SnapshotPlayer) => void;
}

export function WeaponPriorityList({
  players,
  settings,
  showLogButtons = false,
  onLogClick,
}: WeaponPriorityListProps) {
  const { isSmallScreen } = useDevice();

  // URL params for deep linking
  const [searchParams, setSearchParams] = useSearchParams();

  // Track expanded state for each role section (persisted to localStorage)
  const [expandedSections, setExpandedSectionsState] = useState<Set<RoleSectionId>>(() => {
    try {
      const saved = localStorage.getItem('weapon-priority-expanded');
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        return new Set(parsed.filter(s =>
          ['tank', 'healer', 'melee', 'ranged', 'caster'].includes(s)
        ) as RoleSectionId[]);
      }
    } catch {
      // Ignore localStorage errors
    }
    return new Set(['tank', 'healer', 'melee', 'ranged', 'caster']);
  });

  // Wrapper to persist expanded state to localStorage
  const setExpandedSections = useCallback((update: Set<RoleSectionId> | ((prev: Set<RoleSectionId>) => Set<RoleSectionId>)) => {
    setExpandedSectionsState(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      try {
        localStorage.setItem('weapon-priority-expanded', JSON.stringify(Array.from(next)));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  }, []);

  // Handlers for expand/collapse all
  const handleExpandAll = useCallback(() => {
    setExpandedSections(new Set(['tank', 'healer', 'melee', 'ranged', 'caster']));
  }, [setExpandedSections]);

  const handleCollapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, [setExpandedSections]);

  // Listen for 'V' keyboard shortcut (dispatched as custom event from GroupView)
  useEffect(() => {
    const handleToggleExpandAll = () => {
      if (expandedSections.size > 2) {
        handleCollapseAll();
      } else {
        handleExpandAll();
      }
    };

    window.addEventListener('loot:toggle-expand-all', handleToggleExpandAll);
    return () => {
      window.removeEventListener('loot:toggle-expand-all', handleToggleExpandAll);
    };
  }, [expandedSections.size, handleExpandAll, handleCollapseAll]);

  // Handler for individual section expand/collapse
  const handleSectionExpandChange = useCallback((sectionId: RoleSectionId, expanded: boolean) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (expanded) {
        next.add(sectionId);
      } else {
        next.delete(sectionId);
      }
      return next;
    });
  }, [setExpandedSections]);

  // Visible sections: URL param > default (all visible)
  const [visibleSections, setVisibleSectionsState] = useState<Set<RoleSectionId>>(() => {
    const urlSections = searchParams.get('weaponSections');
    if (urlSections) {
      const sections = urlSections.split(',').filter(s =>
        ['tank', 'healer', 'melee', 'ranged', 'caster'].includes(s)
      ) as RoleSectionId[];
      // Allow empty set from URL (all hidden)
      return new Set(sections);
    }
    return new Set(['tank', 'healer', 'melee', 'ranged', 'caster']);
  });

  // Wrapper to toggle section visibility and update URL
  // Accepts string for FilterBar compatibility but validates it's a valid RoleSectionId
  const toggleSection = useCallback((sectionId: string) => {
    if (!['tank', 'healer', 'melee', 'ranged', 'caster'].includes(sectionId)) return;
    const section = sectionId as RoleSectionId;
    setVisibleSectionsState(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        // Allow hiding all sections (will show empty state)
        next.delete(section);
      } else {
        next.add(section);
      }

      // Update URL
      setSearchParams(params => {
        const newParams = new URLSearchParams(params);
        if (next.size === 5) {
          // All visible = default, remove param
          newParams.delete('weaponSections');
        } else if (next.size === 0) {
          // None visible - use special marker
          newParams.set('weaponSections', 'none');
        } else {
          newParams.set('weaponSections', Array.from(next).join(','));
        }
        return newParams;
      }, { replace: true });

      return next;
    });
  }, [setSearchParams]);

  // Get all jobs that appear in weapon priorities OR are main jobs
  // Every player's main job is a default weapon priority
  const allJobs = useMemo(() => {
    const jobs = new Set<string>();
    for (const player of players) {
      // Add main job by default
      if (player.job) {
        jobs.add(player.job);
      }
      // Add explicitly set weapon priorities
      for (const wp of player.weaponPriorities || []) {
        jobs.add(wp.job);
      }
    }
    return jobs;
  }, [players]);

  // Group jobs by role section
  const jobsBySection = useMemo(() => {
    const grouped = new Map<RoleSectionId, string[]>();

    ROLE_SECTIONS.forEach(section => {
      const sectionJobs = Array.from(allJobs).filter(job => {
        const jobInfo = RAID_JOBS.find(j => j.abbreviation === job);
        return jobInfo && section.roles.includes(jobInfo.role);
      });
      grouped.set(section.id, sectionJobs);
    });

    return grouped;
  }, [allJobs]);

  // Calculate hidden roles (roles with no jobs)
  const hiddenRoles = useMemo(() => {
    const hidden = new Set<string>();
    ROLE_SECTIONS.forEach(section => {
      const sectionJobs = jobsBySection.get(section.id) || [];
      if (sectionJobs.length === 0) {
        hidden.add(section.id);
      }
    });
    return hidden;
  }, [jobsBySection]);

  if (allJobs.size === 0) {
    return (
      <div className="text-center py-8 text-text-muted">
        <p>No configured players yet.</p>
      </div>
    );
  }

  const anyVisible = visibleSections.size > 0;

  return (
    <div className="flex flex-col h-full sm:block sm:h-auto">
      {/* Section filter toggles - matches Who Needs It and Gear Priority layout */}
      <div className="flex-shrink-0 p-3 border-b border-border-default bg-surface-elevated">
        <FilterBar
          type="role"
          visibleRoles={visibleSections}
          onRoleToggle={toggleSection}
          hiddenRoles={hiddenRoles}
        />
      </div>

      {/* Content area with consistent padding */}
      <div className="flex-1 min-h-0 overflow-y-auto sm:overflow-visible p-4 space-y-4">
        {/* Empty state when no sections visible */}
        {!anyVisible && (
          <div className="text-center py-8 text-text-muted border border-border-subtle rounded-lg bg-surface-base">
            <p>No role sections selected.</p>
            <p className="text-sm mt-1">Click a role button above to show weapons.</p>
          </div>
        )}

        {/* Mobile: Flat grid */}
        {isSmallScreen && anyVisible && (
          <div className="grid grid-cols-1 gap-3">
            {ROLE_SECTIONS.map(section => {
              const sectionJobs = jobsBySection.get(section.id) || [];
              if (sectionJobs.length === 0) return null;
              if (!visibleSections.has(section.id)) return null;

              return sectionJobs.map(job => {
                const priority = getWeaponPriorityForJob(players, job, settings);
                const jobInfo = RAID_JOBS.find(j => j.abbreviation === job);
                const jobName = jobInfo?.name || job;

                return (
                  <WeaponPriorityCard
                    key={job}
                    job={job}
                    jobName={jobName}
                    priority={priority}
                    showLogButtons={showLogButtons}
                    onLogClick={onLogClick}
                  />
                );
              });
            })}
          </div>
        )}

        {/* Desktop: Role sections - collapsible */}
        {!isSmallScreen && ROLE_SECTIONS.map(section => {
        const sectionJobs = jobsBySection.get(section.id) || [];
        if (sectionJobs.length === 0) return null;
        if (!visibleSections.has(section.id)) return null;

        return (
          <RoleSection
            key={section.id}
            role={section}
            itemCount={sectionJobs.length}
            itemLabel="weapon"
            expanded={expandedSections.has(section.id)}
            onExpandChange={(expanded) => handleSectionExpandChange(section.id, expanded)}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
          >
            {/* Weapon cards grid for this section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sectionJobs.map(job => {
                const priority = getWeaponPriorityForJob(players, job, settings);
                const jobInfo = RAID_JOBS.find(j => j.abbreviation === job);
                const jobName = jobInfo?.name || job;

                return (
                  <WeaponPriorityCard
                    key={job}
                    job={job}
                    jobName={jobName}
                    priority={priority}
                    showLogButtons={showLogButtons}
                    onLogClick={onLogClick}
                  />
                );
              })}
            </div>
          </RoleSection>
        );
      })}
      </div>
    </div>
  );
}
