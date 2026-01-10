/**
 * Weapon Priority List
 *
 * Display calculated weapon priority for Floor 4 (weapon floor).
 * Shows which players should receive weapons in what order.
 */

import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const handleRoll = useCallback((tieGroup: number, visibleEntries: WeaponPriorityEntry[]) => {
    // Check if there are more tied players in the full list than what's visible
    const allTiedEntries = priority.filter((e) => e.tieGroup === tieGroup);

    // If tie group extends beyond visible entries, auto-expand
    if (allTiedEntries.length > visibleEntries.length) {
      setExpanded(true);
    }

    // Roll for ALL tied entries (not just visible ones)
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
                  className={`rounded border border-dashed border-status-warning/50 ${
                    groupIndex === 0 ? 'bg-accent/10' : 'bg-status-warning/5'
                  }`}
                >
                  {/* Tie group header with roll button */}
                  <div className="flex items-center justify-between px-2 py-1 border-b border-status-warning/30">
                    <span className="text-xs text-status-warning font-medium">
                      Tied for #{displayRank}
                    </span>
                    <button
                      onClick={() => handleRoll(tieGroup!, tieGroupEntries)}
                      className="px-2 py-0.5 text-xs rounded bg-status-warning/20 text-status-warning hover:bg-status-warning/30 transition-colors font-medium"
                    >
                      {hasRolled ? 'Reroll' : 'Roll'}
                    </button>
                  </div>

                  {/* Tied players */}
                  {tieGroupEntries.map((tieEntry) => {
                    const roleColor = tieEntry.player.role
                      ? getRoleColor(tieEntry.player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster')
                      : '#9ca3af';
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
            const roleColor = entry.player.role
              ? getRoleColor(entry.player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster')
              : '#9ca3af';
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

// Role section configuration - separate physical ranged and magical ranged (caster)
type RoleSection = 'tank' | 'healer' | 'melee' | 'ranged' | 'caster';

const ROLE_SECTIONS: { id: RoleSection; label: string; roles: string[]; textColor: string; bgColor: string; borderColor: string }[] = [
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
  // URL params for deep linking
  const [searchParams, setSearchParams] = useSearchParams();

  // Visible sections: URL param > default (all visible)
  const [visibleSections, setVisibleSectionsState] = useState<Set<RoleSection>>(() => {
    const urlSections = searchParams.get('weaponSections');
    if (urlSections) {
      const sections = urlSections.split(',').filter(s =>
        ['tank', 'healer', 'melee', 'ranged', 'caster'].includes(s)
      ) as RoleSection[];
      // Allow empty set from URL (all hidden)
      return new Set(sections);
    }
    return new Set(['tank', 'healer', 'melee', 'ranged', 'caster']);
  });

  // Wrapper to toggle section visibility and update URL
  const toggleSection = useCallback((section: RoleSection) => {
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
    const grouped = new Map<RoleSection, string[]>();

    ROLE_SECTIONS.forEach(section => {
      const sectionJobs = Array.from(allJobs).filter(job => {
        const jobInfo = RAID_JOBS.find(j => j.abbreviation === job);
        return jobInfo && section.roles.includes(jobInfo.role);
      });
      grouped.set(section.id, sectionJobs);
    });

    return grouped;
  }, [allJobs]);

  if (allJobs.size === 0) {
    return (
      <div className="text-center py-8 text-text-muted">
        <p>No configured players yet.</p>
      </div>
    );
  }

  const anyVisible = visibleSections.size > 0;

  return (
    <div className="space-y-6">
      {/* Section filter toggles - role-colored */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <span className="text-sm text-text-muted mr-1">Show:</span>
        {ROLE_SECTIONS.map(section => {
          const isVisible = visibleSections.has(section.id);
          const jobCount = jobsBySection.get(section.id)?.length || 0;
          if (jobCount === 0) return null;

          return (
            <button
              key={section.id}
              onClick={() => toggleSection(section.id)}
              aria-pressed={isVisible}
              className={`px-3 py-1 text-sm rounded transition-colors font-bold border ${
                isVisible
                  ? `${section.bgColor} text-white ${section.borderColor}`
                  : `bg-surface-interactive ${section.textColor} ${section.borderColor}/40 hover:${section.bgColor}/20`
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </div>

      {/* Empty state when no sections visible */}
      {!anyVisible && (
        <div className="text-center py-8 text-text-muted border border-border-subtle rounded-lg bg-surface-base">
          <p>No role sections selected.</p>
          <p className="text-sm mt-1">Click a role button above to show weapons.</p>
        </div>
      )}

      {/* Role sections */}
      {ROLE_SECTIONS.map(section => {
        const sectionJobs = jobsBySection.get(section.id) || [];
        if (sectionJobs.length === 0) return null;
        if (!visibleSections.has(section.id)) return null;

        return (
          <div key={section.id} className="space-y-3">
            {/* Section header */}
            <div className="flex items-center gap-3">
              <h4 className={`text-sm font-semibold ${section.textColor}`}>
                {section.label}
              </h4>
              <div className="flex-1 h-px bg-border-subtle" />
              <span className="text-xs text-text-muted">
                {sectionJobs.length} {sectionJobs.length === 1 ? 'weapon' : 'weapons'}
              </span>
            </div>

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
          </div>
        );
      })}
    </div>
  );
}
