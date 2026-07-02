import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { XivIcon } from '../ui/XivIcon';
import { Button } from '../primitives/Button';
import { CharacterCard } from './CharacterCard';
import { JobProfileCard } from './JobProfileCard';
import type { GearSnapshot, PlayerJobProfile, PlayerProfile } from '../../stores/playerProfileStore';
import { staggerContainerProps, staggerItemProps } from '../../lib/motion';
import { GameIcon } from '../ui/GameIcon';
import { hasUsableGearSnapshot, resolveJobGearSnapshot } from './jobGearUtils';
import { formatRelativeTimeAgo } from './freshness';

interface JobsGearTabProps {
  profile: PlayerProfile;
  gearSnapshots: Record<string, GearSnapshot[]>;
  onAddJob: () => void;
  onEditJob: (jobProfile: PlayerJobProfile) => void;
  onOpenLinkModal: () => void;
  onNavigate?: (tab: string) => void;
  onManageBiS?: (jobProfileId: string) => void;
}

const PRIORITY_ORDER = {
  main: 0,
  preferred_alt: 1,
  flex: 2,
  learning: 3,
  emergency: 4,
  casual: 5,
};

function latestSnapshot(gearSnapshots: Record<string, GearSnapshot[]>): GearSnapshot | null {
  let latest: GearSnapshot | null = null;
  for (const snapshots of Object.values(gearSnapshots)) {
    for (const snapshot of snapshots) {
      if (!hasUsableGearSnapshot(snapshot)) continue;
      if (!latest || (snapshot.syncedAt && (!latest.syncedAt || snapshot.syncedAt > latest.syncedAt))) {
        latest = snapshot;
      }
    }
  }
  return latest;
}

export function JobsGearTab({
  profile,
  gearSnapshots,
  onAddJob,
  onEditJob,
  onOpenLinkModal,
  onNavigate,
  onManageBiS,
}: JobsGearTabProps) {
  const { t, i18n } = useTranslation();
  const characters = profile.characters;
  const jobProfiles = profile.jobProfiles;
  const uiLocale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';
  const mainCharacter = characters.find((character) => character.isMain) ?? characters[0];
  const mainJob = jobProfiles.find((job) => job.priority === 'main');
  const jobsWithSnapshots = jobProfiles.map((jobProfile) => ({
    jobProfile,
    snapshot: resolveJobGearSnapshot(jobProfile, gearSnapshots),
  }));
  const jobsWithGear = jobsWithSnapshots.filter(({ snapshot }) => snapshot !== null).length;
  const jobsMissingGear = jobsWithSnapshots.filter(({ snapshot }) => snapshot === null).length;
  const jobsBelowTarget = jobsWithSnapshots.filter(
    ({ jobProfile, snapshot }) => snapshot !== null && jobProfile.readiness === 'needs_gear',
  ).length;
  const lastSync = latestSnapshot(gearSnapshots);
  const sortedJobs = [...jobsWithSnapshots].sort((left, right) =>
    (PRIORITY_ORDER[left.jobProfile.priority as keyof typeof PRIORITY_ORDER] ?? 99)
    - (PRIORITY_ORDER[right.jobProfile.priority as keyof typeof PRIORITY_ORDER] ?? 99)
  );

  if (characters.length === 0) {
    return (
      <motion.div {...staggerContainerProps} className="min-w-0 space-y-4 pb-24 md:pb-4" data-testid="jobs-gear-tab">
        <motion.div {...staggerItemProps} className="rounded-lg border border-border-default bg-surface-raised px-4 py-10 text-center">
          <div className="mb-3 text-accent"><GameIcon name="shield-person" size="xl" /></div>
          <h3 className="font-display text-lg font-semibold text-text-primary">{t('profile.jobsGear.linkCharacterFirst')}</h3>
          <p className="mx-auto mt-1 max-w-lg text-sm text-text-secondary">
            {t('profile.jobsGear.linkCharacterDesc')}
          </p>
          <Button className="mt-4" size="sm" onClick={onOpenLinkModal}>
            {t('profile.overview.linkCharacter')}
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div {...staggerContainerProps} className="min-w-0 space-y-4 pb-24 md:pb-4" data-testid="jobs-gear-tab">
      <motion.section {...staggerItemProps} className="min-w-0 rounded-lg border border-border-default bg-surface-raised p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold text-text-primary">{t('profile.tabJobsGear')}</h3>
            <p className="mt-1 max-w-3xl text-sm text-text-secondary">
              {t('profile.jobsGear.headerDesc')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onNavigate && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onNavigate('sync')}
                data-testid="manage-sync-cta"
              >
                {t('profile.jobsGear.manageSync')}
              </Button>
            )}
            <Button size="sm" onClick={onAddJob} leftIcon={<Plus className="h-4 w-4" />}>
              {t('profile.jobsGear.addJob')}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <SummaryTile label={t('profile.jobsGear.mainJob')} value={mainJob ? t('profile.jobsGear.mainJobValue', { job: mainJob.job }) : t('profile.jobsGear.missing')} tone={mainJob ? 'positive' : 'attention'} testId="tile-main-job" />
          <SummaryTile label={t('profile.jobsGear.trackedJobs')} value={String(jobProfiles.length)} tone="info" testId="tile-tracked-jobs" />
          <SummaryTile label={t('profile.jobsGear.gearSaved')} value={String(jobsWithGear)} tone={jobsWithGear === jobProfiles.length && jobProfiles.length > 0 ? 'positive' : 'info'} testId="tile-gear-saved" />
          <SummaryTile label={t('profile.jobsGear.missingGear')} value={String(jobsMissingGear)} tone={jobsMissingGear > 0 ? 'attention' : 'positive'} testId="tile-missing-gear" />
          <SummaryTile label={t('profile.jobsGear.needsReview')} value={String(jobsBelowTarget)} tone={jobsBelowTarget > 0 ? 'attention' : 'positive'} testId="tile-below-target" tooltip={t('profile.jobsGear.needsReviewTooltip')} />
          <SummaryTile label={t('profile.jobsGear.lastGearUpdate')} value={lastSync ? formatRelativeTimeAgo(lastSync.syncedAt ?? lastSync.updatedAt, uiLocale) : t('common.never')} tone={lastSync ? 'info' : 'attention'} testId="tile-last-update" />
        </div>
      </motion.section>

      <motion.section {...staggerItemProps} className="min-w-0 rounded-lg border border-border-default bg-surface-raised p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="font-display text-sm font-semibold text-text-primary">{t('profile.jobsGear.trackedJobs')}</h3>
            <p className="mt-1 text-xs text-text-tertiary">
              {t('profile.jobsGear.trackedJobsDesc')}
            </p>
          </div>
        </div>

        {sortedJobs.length === 0 ? (
          <div className="mt-4 rounded-lg border border-border-subtle bg-surface-elevated/60 px-4 py-8 text-center">
            <div className="mb-2 text-accent"><GameIcon name="crossed-swords" size="lg" /></div>
            <p className="font-medium text-text-primary">{t('profile.jobsGear.noJobProfilesYet')}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-text-secondary">
              {t('profile.jobsGear.noJobProfilesDesc')}
            </p>
            <Button className="mt-4" size="sm" onClick={onAddJob}>
              {t('profile.jobsGear.addMainJob')}
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid min-w-0 gap-3 xl:grid-cols-2">
            {sortedJobs.map(({ jobProfile, snapshot }) => (
              <JobProfileCard
                key={jobProfile.id}
                jobProfile={jobProfile}
                resolvedSnapshot={snapshot}
                onEdit={onEditJob}
                onManageBiS={onManageBiS}
              />
            ))}
          </div>
        )}
      </motion.section>

      <motion.section {...staggerItemProps} className="min-w-0 rounded-lg border border-border-default bg-surface-raised p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <XivIcon name="loot" size={16} className="mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="font-display text-sm font-semibold text-text-primary">{t('profile.jobsGear.applicationGear')}</h3>
              <p className="mt-1 text-xs text-text-tertiary">
                {t('profile.jobsGear.applicationGearDesc')}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onOpenLinkModal}>
            {t('profile.jobsGear.manageLinkedCharacter')}
          </Button>
        </div>
        {mainCharacter && (
          <div className="mt-3">
            <CharacterCard character={mainCharacter} />
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  testId,
  tooltip,
}: {
  label: string;
  value: string;
  tone: 'positive' | 'attention' | 'info';
  testId?: string;
  tooltip?: string;
}) {
  const color = {
    positive: 'text-status-success',
    attention: 'text-status-warning',
    info: 'text-accent',
  }[tone];

  return (
    <div
      className="min-w-0 rounded-lg border border-border-subtle bg-surface-elevated/70 px-2.5 py-2 sm:px-3"
      data-testid={testId}
      title={tooltip}
    >
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className={`mt-1 truncate font-display text-sm sm:text-lg ${color}`}>{value}</p>
    </div>
  );
}
