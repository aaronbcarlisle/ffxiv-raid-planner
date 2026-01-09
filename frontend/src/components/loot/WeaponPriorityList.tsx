/**
 * Weapon Priority List
 *
 * Display calculated weapon priority for Floor 4 (weapon floor).
 * Shows which players should receive weapons in what order.
 */

import { useState, useMemo, useCallback } from 'react';
import type { SnapshotPlayer, StaticSettings } from '../../types';
import { getWeaponPriorityForJob, type WeaponPriorityEntry } from '../../utils/weaponPriority';
import { RAID_JOBS } from '../../gamedata/jobs';
import { JobIcon } from '../ui/JobIcon';
import { getRoleColor } from '../../gamedata';

// Roll result for a player
interface RollResult {
  playerId: string;
  roll: number;
}

// Group of tied entries with optional roll results
interface TieGroup {
  entries: WeaponPriorityEntry[];
  tieGroup: number;
  rollResults?: RollResult[];
}

interface WeaponPriorityCardProps {
  job: string;
  jobName: string;
  priority: WeaponPriorityEntry[];
  showLogButtons: boolean;
  onLogClick?: (weaponJob: string, player: SnapshotPlayer) => void;
}

function WeaponPriorityCard({
  job,
  jobName,
  priority,
  showLogButtons,
  onLogClick,
}: WeaponPriorityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [rollResults, setRollResults] = useState<Map<number, RollResult[]>>(new Map());

  const maxShown = 3;
  const hasMore = priority.length > maxShown;
  const visibleEntries = expanded ? priority : priority.slice(0, maxShown);

  // Group entries and identify tie groups
  const groupedEntries = useMemo(() => {
    const result: Array<{ entry: WeaponPriorityEntry; displayRank: number; tieGroupEntries?: WeaponPriorityEntry[] }> = [];
    let currentRank = 1;
    let i = 0;

    while (i < visibleEntries.length) {
      const entry = visibleEntries[i];

      if (entry.isTied && entry.tieGroup !== undefined) {
        // Collect all entries in the same tie group that are visible
        const tieGroupEntries = visibleEntries.filter(
          (e) => e.tieGroup === entry.tieGroup
        );

        // Add first entry with tie group info
        result.push({
          entry,
          displayRank: currentRank,
          tieGroupEntries,
        });

        // Skip the rest of the tie group (they're handled together)
        i += tieGroupEntries.length;
        currentRank++; // Tie group counts as one rank
      } else {
        result.push({ entry, displayRank: currentRank });
        i++;
        currentRank++;
      }
    }

    return result;
  }, [visibleEntries]);

  // Roll for a tie group
  const handleRoll = useCallback((tieGroup: number, entries: WeaponPriorityEntry[]) => {
    const results: RollResult[] = entries.map((e) => ({
      playerId: e.player.id,
      roll: Math.floor(Math.random() * 100) + 1, // 1-100
    }));

    // Sort by roll descending so winner is first
    results.sort((a, b) => b.roll - a.roll);

    setRollResults((prev) => new Map(prev).set(tieGroup, results));
  }, []);

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
      ) : (
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
                  className={`rounded border border-dashed border-yellow-500/50 ${
                    groupIndex === 0 ? 'bg-accent/10' : 'bg-yellow-500/5'
                  }`}
                >
                  {/* Tie group header with roll button */}
                  <div className="flex items-center justify-between px-2 py-1 border-b border-yellow-500/30">
                    <span className="text-xs text-yellow-500 font-medium">
                      Tied for #{displayRank}
                    </span>
                    <button
                      onClick={() => handleRoll(tieGroup!, tieGroupEntries)}
                      className="px-2 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 transition-colors font-medium"
                    >
                      {hasRolled ? 'Reroll' : 'Roll'}
                    </button>
                  </div>

                  {/* Tied players */}
                  {tieGroupEntries.map((tieEntry) => {
                    const roleColor = getRoleColor(tieEntry.player.role as any);
                    const playerRoll = tieGroup !== undefined ? getPlayerRoll(tieGroup, tieEntry.player.id) : null;
                    const isWinner = winnerId === tieEntry.player.id;
                    const isFirst = groupIndex === 0;

                    return (
                      <div
                        key={tieEntry.player.id}
                        className={`flex items-center justify-between px-2 py-1 text-sm group ${
                          isWinner ? 'bg-green-500/20' : ''
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
                          <span
                            className={`truncate ${
                              isWinner ? 'text-green-400 font-medium' : isFirst ? 'text-accent font-medium' : 'text-text-secondary'
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
                                isWinner ? 'bg-green-500/30 text-green-400 font-medium' : 'bg-surface-elevated text-text-muted'
                              }`}
                            >
                              {playerRoll}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Log button - shows on hover */}
                          {showLogButtons && onLogClick && (
                            <button
                              onClick={() => onLogClick(job, tieEntry.player)}
                              className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-all"
                            >
                              Log
                            </button>
                          )}
                          <span
                            className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: `${roleColor}30`, color: roleColor }}
                          >
                            {tieEntry.score}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Render regular (non-tied) entry
            const roleColor = getRoleColor(entry.player.role as any);
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
                  {/* Log button - shows on hover for any entry */}
                  {showLogButtons && onLogClick && (
                    <button
                      onClick={() => onLogClick(job, entry.player)}
                      className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-all"
                    >
                      Log
                    </button>
                  )}
                  <span
                    className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${roleColor}30`, color: roleColor }}
                  >
                    {entry.score}
                  </span>
                </div>
              </div>
            );
          })}
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-text-muted hover:text-accent text-xs px-2 py-0.5 transition-colors"
            >
              {expanded ? 'Show less' : `+${priority.length - maxShown} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type RoleFilter = 'all' | 'tank' | 'healer' | 'dps';

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
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  // Get all jobs that appear in weapon priorities OR are main jobs
  // Every player's main job is a default weapon priority
  const sortedJobs = useMemo(() => {
    const allJobs = new Set<string>();
    for (const player of players) {
      // Add main job by default
      if (player.job) {
        allJobs.add(player.job);
      }
      // Add explicitly set weapon priorities
      for (const wp of player.weaponPriorities || []) {
        allJobs.add(wp.job);
      }
    }

    // Sort jobs by role (tank > healer > melee > ranged > caster)
    return Array.from(allJobs).sort((a, b) => {
      const jobA = RAID_JOBS.find((j) => j.abbreviation === a);
      const jobB = RAID_JOBS.find((j) => j.abbreviation === b);
      if (!jobA || !jobB) return 0;

      const roleOrder = ['tank', 'healer', 'melee', 'ranged', 'caster'];
      const indexA = roleOrder.indexOf(jobA.role);
      const indexB = roleOrder.indexOf(jobB.role);

      return indexA - indexB;
    });
  }, [players]);

  // Filter jobs by selected role
  const filteredJobs = useMemo(() => {
    if (roleFilter === 'all') return sortedJobs;

    return sortedJobs.filter((job) => {
      const jobInfo = RAID_JOBS.find((j) => j.abbreviation === job);
      if (!jobInfo) return false;

      if (roleFilter === 'tank') return jobInfo.role === 'tank';
      if (roleFilter === 'healer') return jobInfo.role === 'healer';
      if (roleFilter === 'dps') return ['melee', 'ranged', 'caster'].includes(jobInfo.role);
      return true;
    });
  }, [sortedJobs, roleFilter]);

  if (sortedJobs.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted">
        <p>No configured players yet.</p>
      </div>
    );
  }

  const filterButtonClass = (filter: RoleFilter) =>
    `px-3 py-1 text-sm rounded transition-colors font-bold ${
      roleFilter === filter
        ? 'bg-accent text-accent-contrast'
        : 'bg-surface-interactive text-text-secondary hover:text-text-primary hover:bg-surface-hover'
    }`;

  return (
    <div className="space-y-4">
      {/* Role filter buttons */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-text-muted mr-1">Filter:</span>
        <button
          onClick={() => setRoleFilter('all')}
          className={filterButtonClass('all')}
        >
          All
        </button>
        <button
          onClick={() => setRoleFilter('tank')}
          className={filterButtonClass('tank')}
        >
          Tank
        </button>
        <button
          onClick={() => setRoleFilter('healer')}
          className={filterButtonClass('healer')}
        >
          Healer
        </button>
        <button
          onClick={() => setRoleFilter('dps')}
          className={filterButtonClass('dps')}
        >
          DPS
        </button>
      </div>

      {/* Weapon cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredJobs.map((job) => {
          const priority = getWeaponPriorityForJob(players, job, settings);
          const jobInfo = RAID_JOBS.find((j) => j.abbreviation === job);
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
    </div>
  );
}
