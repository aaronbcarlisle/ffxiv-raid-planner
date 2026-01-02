/**
 * Weapon Priority List
 *
 * Display calculated weapon priority for Floor 4 (weapon floor).
 * Shows which players should receive weapons in what order.
 */

import type { SnapshotPlayer, StaticSettings } from '../../types';
import { getWeaponPriorityForJob } from '../../utils/weaponPriority';
import { RAID_JOBS } from '../../gamedata/jobs';
import { JobIcon } from '../ui/JobIcon';
import { getRoleColor } from '../../gamedata';

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
  // Get all jobs that appear in weapon priorities OR are main jobs
  // Every player's main job is a default weapon priority
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
  const sortedJobs = Array.from(allJobs).sort((a, b) => {
    const jobA = RAID_JOBS.find((j) => j.abbreviation === a);
    const jobB = RAID_JOBS.find((j) => j.abbreviation === b);
    if (!jobA || !jobB) return 0;

    const roleOrder = ['tank', 'healer', 'melee', 'ranged', 'caster'];
    const indexA = roleOrder.indexOf(jobA.role);
    const indexB = roleOrder.indexOf(jobB.role);

    return indexA - indexB;
  });

  if (sortedJobs.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted">
        <p>No configured players yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedJobs.map((job) => {
        const priority = getWeaponPriorityForJob(players, job, settings);
        const jobInfo = RAID_JOBS.find((j) => j.abbreviation === job);
        const jobName = jobInfo?.name || job;

        return (
          <div
            key={job}
            className="bg-surface-base rounded-lg p-3"
          >
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
                {priority.slice(0, 3).map((entry, index) => {
                  const roleColor = getRoleColor(entry.player.role as any);
                  const isFirst = index === 0;

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
                          {index + 1}.
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
                        {/* Log button - only show on first entry */}
                        {showLogButtons && isFirst && onLogClick && (
                          <button
                            onClick={() => onLogClick(job, entry.player)}
                            className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs rounded bg-accent/80 text-white hover:bg-accent transition-all"
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
                {priority.length > 3 && (
                  <div className="text-text-muted text-xs px-2">
                    +{priority.length - 3} more
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
