import { motion } from 'framer-motion';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { JobIcon } from '../ui/JobIcon';
import { ReadinessChecklist } from './ReadinessChecklist';
import { PriorityBadge } from './PriorityBadge';
import { ReadinessBadge } from './ReadinessBadge';
import { formatSyncAge, getFreshness, freshnessColor, formatSource } from './freshness';
import type { PlayerProfile, PlayerGoal, GearSnapshot } from '../../stores/playerProfileStore';
import { COLLECTION_GOAL_TYPES, PERSONAL_GOAL_TYPES } from '../../stores/playerProfileStore';
import { getJobDisplayName } from '../../gamedata/jobs';
import { staggerContainerProps, staggerItemProps } from '../../lib/motion';

interface OverviewTabProps {
  profile: PlayerProfile;
  goals: PlayerGoal[];
  gearSnapshots: Record<string, GearSnapshot[]>;
  onNavigate: (tab: string) => void;
  onOpenLinkModal: () => void;
  onOpenJobModal: () => void;
}

function SummaryCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-raised rounded-lg border border-border-default p-4 ${className ?? ''}`}>
      <h3 className="font-display font-semibold text-text-primary text-sm mb-3">{title}</h3>
      {children}
    </div>
  );
}

interface SetupStepProps {
  done: boolean;
  label: string;
  description: string;
  action?: string;
  onClick?: () => void;
}

function SetupStep({ done, label, description, action, onClick }: SetupStepProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
        done ? 'bg-status-success/20 text-status-success' : 'bg-surface-elevated text-text-tertiary'
      }`}>
        {done ? '✓' : '○'}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${done ? 'text-text-primary' : 'text-text-secondary'}`}>{label}</div>
        {!done && <div className="text-xs text-text-tertiary">{description}</div>}
      </div>
      {!done && action && onClick && (
        <Button variant="secondary" size="sm" onClick={onClick}>{action}</Button>
      )}
    </div>
  );
}

export function OverviewTab({ profile, goals, gearSnapshots, onNavigate, onOpenLinkModal, onOpenJobModal }: OverviewTabProps) {
  const characters = profile.characters;
  const jobProfiles = profile.jobProfiles;
  const mainCharacter = characters.find((c) => c.isMain) ?? characters[0];
  const mainJob = jobProfiles.find((j) => j.priority === 'main');
  const altJobs = jobProfiles.filter((j) => j.priority !== 'main').slice(0, 3);

  let latestSnapshot: GearSnapshot | null = null;
  for (const snaps of Object.values(gearSnapshots)) {
    for (const snap of snaps) {
      if (!latestSnapshot || (snap.syncedAt && (!latestSnapshot.syncedAt || snap.syncedAt > latestSnapshot.syncedAt))) {
        latestSnapshot = snap;
      }
    }
  }

  const hasAnyGear = Object.values(gearSnapshots).some((s) => s.length > 0);
  const hasCharacter = characters.length > 0;
  const hasMainJob = !!mainJob;
  const hasReadyJob = jobProfiles.some((j) => j.readiness !== 'unknown');
  const shareConfigured = profile.shareEnabled && profile.visibility !== 'private';

  const collectionGoals = goals.filter((g) => COLLECTION_GOAL_TYPES.includes(g.goalType as never));
  const personalGoals = goals.filter((g) => PERSONAL_GOAL_TYPES.includes(g.goalType as never));

  const setupComplete = hasCharacter && hasMainJob && hasAnyGear && hasReadyJob;

  return (
    <motion.div {...staggerContainerProps} className="space-y-5">
      {/* Hero card */}
      <motion.div {...staggerItemProps} className="bg-surface-raised rounded-lg border border-border-default p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-surface-elevated flex-shrink-0 border-2 border-accent/30">
            {mainCharacter?.avatarUrl ? (
              <img src={mainCharacter.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl text-text-tertiary">?</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-text-primary text-lg">
              {mainCharacter?.name ?? 'No Character'}
            </div>
            <div className="text-sm text-text-secondary">
              {mainCharacter ? (
                <>
                  {mainCharacter.server}
                  {mainCharacter.dataCenter && <span className="text-text-tertiary"> [{mainCharacter.dataCenter}]</span>}
                </>
              ) : 'Link a character to get started'}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {mainJob && (
              <div className="flex items-center gap-1.5">
                <JobIcon job={mainJob.job} size="md" />
                <Badge variant={mainJob.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster'} size="sm">
                  {mainJob.job}
                </Badge>
                <ReadinessBadge readiness={mainJob.readiness} />
              </div>
            )}
            <Badge
              variant={profile.visibility === 'private' ? 'default' : profile.visibility === 'shareable' ? 'info' : 'success'}
              size="sm"
            >
              {profile.visibility === 'private' ? 'Private' : profile.visibility === 'shareable' ? 'Shareable' : 'Discoverable'}
            </Badge>
          </div>
        </div>

        {/* Alt jobs inline */}
        {altJobs.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border-default flex items-center gap-4 flex-wrap">
            <span className="text-xs text-text-tertiary uppercase tracking-wider">Also plays</span>
            {altJobs.map((jp) => (
              <div key={jp.id} className="flex items-center gap-1.5">
                <JobIcon job={jp.job} size="sm" />
                <span className="text-sm text-text-secondary">{jp.job}</span>
                <PriorityBadge priority={jp.priority} />
              </div>
            ))}
            {jobProfiles.length > 4 && (
              <span className="text-xs text-text-tertiary">+{jobProfiles.length - 4} more</span>
            )}
          </div>
        )}
      </motion.div>

      {/* Guided setup — shown until core setup is complete */}
      {!setupComplete && (
        <motion.div {...staggerItemProps} className="bg-surface-raised rounded-lg border border-accent/20 p-4">
          <h3 className="font-display font-semibold text-text-primary text-sm mb-1">Get Started</h3>
          <p className="text-xs text-text-tertiary mb-3">Complete these steps to build your raider profile.</p>
          <div className="divide-y divide-border-default">
            <SetupStep
              done={hasCharacter}
              label="Link your FFXIV character"
              description="Search Lodestone and link your character identity."
              action="Link"
              onClick={onOpenLinkModal}
            />
            <SetupStep
              done={hasMainJob}
              label="Set your main job"
              description="Choose the job you raid as primarily."
              action="Add Job"
              onClick={onOpenJobModal}
            />
            <SetupStep
              done={hasAnyGear}
              label="Sync your gear"
              description="Fetch your equipped gear from Lodestone."
              action="Characters"
              onClick={() => onNavigate('characters')}
            />
            <SetupStep
              done={hasReadyJob}
              label="Set job readiness"
              description="Mark your readiness for each job."
              action="Jobs"
              onClick={() => onNavigate('jobs')}
            />
            <SetupStep
              done={shareConfigured}
              label="Share your profile"
              description="Enable sharing so static leads can view it."
              action="Preview"
              onClick={() => onNavigate('preview')}
            />
          </div>
        </motion.div>
      )}

      {/* Summary grid */}
      <motion.div {...staggerItemProps} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Gear */}
        <SummaryCard title="Latest Gear">
          {latestSnapshot ? (
            <div>
              <div className="flex items-center gap-2">
                <JobIcon job={latestSnapshot.job} size="md" />
                <span className="text-text-primary font-medium">{getJobDisplayName(latestSnapshot.job)}</span>
                <Badge variant="info" size="sm">iLv {latestSnapshot.avgItemLevel}</Badge>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs">
                <span className={freshnessColor(getFreshness(latestSnapshot.syncedAt))}>
                  {formatSyncAge(latestSnapshot.syncedAt)}
                </span>
                <span className="text-text-tertiary">{formatSource(latestSnapshot.source)}</span>
              </div>
            </div>
          ) : (
            <p className="text-text-tertiary text-sm">No gear synced yet.</p>
          )}
        </SummaryCard>

        {/* Collections */}
        <SummaryCard title="Collections">
          {collectionGoals.length > 0 ? (
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xl font-display font-bold text-accent">{collectionGoals.filter((g) => g.status === 'active').length}</span>
                <span className="text-xs text-text-tertiary ml-1">active</span>
              </div>
              <div>
                <span className="text-xl font-display font-bold text-status-success">{collectionGoals.filter((g) => g.status === 'completed').length}</span>
                <span className="text-xs text-text-tertiary ml-1">done</span>
              </div>
            </div>
          ) : (
            <p className="text-text-tertiary text-sm">No collection goals yet.</p>
          )}
        </SummaryCard>

        {/* Goals */}
        <SummaryCard title="Personal Goals">
          {personalGoals.length > 0 ? (
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xl font-display font-bold text-accent">{personalGoals.filter((g) => g.status === 'active').length}</span>
                <span className="text-xs text-text-tertiary ml-1">active</span>
              </div>
              <div>
                <span className="text-xl font-display font-bold text-status-success">{personalGoals.filter((g) => g.status === 'completed').length}</span>
                <span className="text-xs text-text-tertiary ml-1">done</span>
              </div>
            </div>
          ) : (
            <p className="text-text-tertiary text-sm">No personal goals yet.</p>
          )}
        </SummaryCard>
      </motion.div>

      {/* Readiness checklist */}
      <motion.div {...staggerItemProps}>
        <ReadinessChecklist profile={profile} hasGearSnapshots={hasAnyGear} />
      </motion.div>
    </motion.div>
  );
}
