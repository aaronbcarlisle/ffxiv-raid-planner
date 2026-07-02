import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { JobIcon } from '../ui/JobIcon';
import { Badge } from '../primitives/Badge';
import { IconButton } from '../primitives/IconButton';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Button } from '../primitives/Button';
import { useModal } from '../../hooks/useModal';
import { PriorityBadge } from './PriorityBadge';
import { ReadinessBadge } from './ReadinessBadge';
import { SourceBadge } from './SourceBadge';
import { formatRelativeTimeAgo, getFreshness, freshnessColor } from './freshness';
import type { GearSnapshot, GearSlotData, PlayerJobProfile } from '../../stores/playerProfileStore';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import { useSharedBisStore } from '../../stores/sharedBisStore';
import { getJobDisplayName } from '../../gamedata/jobs';
import { toast } from '../../stores/toastStore';
import { getBiSCompareStatus } from './jobGearUtils';

interface JobProfileCardProps {
  jobProfile: PlayerJobProfile;
  resolvedSnapshot?: GearSnapshot | null;
  onEdit: (jobProfile: PlayerJobProfile) => void;
  onManageBiS?: (jobProfileId: string) => void;
}

const SLOT_LABEL_KEYS: Record<string, string> = {
  weapon: 'profile.jobsGear.slotWeapon',
  head: 'profile.jobsGear.slotHead',
  body: 'profile.jobsGear.slotBody',
  hands: 'profile.jobsGear.slotHands',
  legs: 'profile.jobsGear.slotLegs',
  feet: 'profile.jobsGear.slotFeet',
  earring: 'profile.jobsGear.slotEarring',
  necklace: 'profile.jobsGear.slotNecklace',
  bracelet: 'profile.jobsGear.slotBracelet',
  ring1: 'profile.jobsGear.slotRing1',
  ring2: 'profile.jobsGear.slotRing2',
};

const PURPOSE_LABEL_KEYS: Record<string, string> = {
  savage: 'profile.jobsGear.bisPurposeSavage',
  ultimate: 'profile.jobsGear.bisPurposeUltimate',
  prog: 'profile.jobsGear.bisPurposeProg',
  farm: 'profile.jobsGear.bisPurposeFarm',
  speed: 'profile.jobsGear.bisPurposeSpeed',
  comfort: 'profile.jobsGear.bisPurposeComfort',
  custom: 'profile.jobsGear.bisPurposeCustom',
  savage_prog: 'profile.jobsGear.bisPurposeSavageProg',
  savage_reclear: 'profile.jobsGear.bisPurposeSavageReclear',
  week1: 'profile.jobsGear.bisPurposeWeek1',
  alt_job: 'profile.jobsGear.bisPurposeAltJob',
  parse: 'profile.jobsGear.bisPurposeParse',
};

function GearSlotCompactRow({
  slot,
  emptyLabel,
  getSlotLabel,
}: {
  slot: GearSlotData;
  emptyLabel: string;
  getSlotLabel: (slotName: string) => string;
}) {
  const itemName = slot.equippedItemName || emptyLabel;
  const itemLevel = slot.equippedItemLevel || slot.itemLevel || 0;

  return (
    <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)_44px] items-center gap-2 rounded-md bg-surface-elevated/60 px-2 py-1.5 text-xs">
      <span className="truncate text-text-tertiary">{getSlotLabel(slot.slot)}</span>
      <span className={`min-w-0 truncate ${itemName === emptyLabel ? 'text-text-tertiary italic' : 'text-text-secondary'}`}>
        {itemName}
      </span>
      <span className="text-right font-mono text-text-muted">{itemLevel || '-'}</span>
    </div>
  );
}

export function JobProfileCard({ jobProfile, resolvedSnapshot, onEdit, onManageBiS }: JobProfileCardProps) {
  const { t, i18n } = useTranslation();
  const { deleteJobProfile } = usePlayerProfileStore();
  const bisStore = useSharedBisStore();
  const deleteModal = useModal();
  const [expanded, setExpanded] = useState(false);
  const uiLocale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';

  const snapshot = resolvedSnapshot ?? jobProfile.gearSnapshot;
  const getSlotLabel = (slotName: string) => t(SLOT_LABEL_KEYS[slotName] ?? '', { defaultValue: slotName });
  const formatActivity = (value: string | null | undefined, source?: string | null) => {
    const time = formatRelativeTimeAgo(value ?? null, uiLocale);
    switch (source) {
      case 'plugin':
        return t('profile.jobsGear.activitySynced', { time });
      case 'tomestone':
      case 'xivapi':
      case 'lodestone':
        return t('profile.jobsGear.activityRefreshed', { time });
      case 'roster_sync':
        return t('profile.jobsGear.activityImported', { time });
      default:
        return t('profile.jobsGear.activityUpdated', { time });
    }
  };
  const getGearStateLabel = () => {
    if (snapshot?.source === 'plugin') return t('profile.jobsGear.pluginLoadout', { job: snapshot.job });
    if (snapshot?.source === 'manual') return t('profile.jobsGear.manualEntry');
    if (snapshot?.source === 'lodestone' || snapshot?.source === 'xivapi' || snapshot?.source === 'tomestone') {
      return t('profile.jobsGear.currentEquippedJobOnly');
    }
    if (snapshot?.source) return snapshot.source;
    return t('profile.jobsGear.noGearSavedForJobYet');
  };

  const handleDelete = async () => {
    try {
      await deleteJobProfile(jobProfile.id);
      toast.success(t('profile.jobsGear.jobProfileRemoved', { job: jobProfile.job }));
    } catch {
      toast.error(t('profile.jobsGear.jobProfileRemoveFailed'));
    }
  };

  // Read from sharedBisStore (live, post-modal) and fall back to embedded profile data on first load
  const storeTargets = bisStore.getTargets('player_job_profile', jobProfile.id);
  const bisTargets = storeTargets.length > 0 ? storeTargets : (jobProfile.bisTargets ?? []);
  const activeBisTarget = bisTargets.find((target) => target.isActive) ?? null;
  const bisTargetCount = bisTargets.length;
  const compareStatus = getBiSCompareStatus(snapshot, activeBisTarget);
  const freshness = snapshot ? getFreshness(snapshot.syncedAt) : 'none';
  const isStale = freshness === 'stale' || freshness === 'old';

  return (
    <div className={`min-w-0 overflow-hidden bg-surface-raised rounded-lg border transition-colors hover:border-border-hover ${
      jobProfile.priority === 'main' ? 'border-accent/30 ring-1 ring-accent/10' : 'border-border-default'
    } p-4`}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <JobIcon job={jobProfile.job} size="lg" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex min-w-0 items-center gap-2 flex-wrap">
            <span className={`min-w-0 truncate font-display font-semibold text-text-primary ${jobProfile.priority === 'main' ? 'text-lg' : ''}`}>
              {getJobDisplayName(jobProfile.job)}
            </span>
            <span className="text-text-tertiary text-sm">{jobProfile.job}</span>
            <PriorityBadge priority={jobProfile.priority} />
            {jobProfile.readiness === 'needs_gear' ? (
              <Badge
                variant="warning"
                size="sm"
                title={snapshot ? t('profile.jobsGear.needsReviewTooltip') : undefined}
              >
                {snapshot ? t('profile.jobsGear.needsReview') : t('profile.jobsGear.missingGear')}
              </Badge>
            ) : jobProfile.readiness === 'unknown' && snapshot ? null : (
              <ReadinessBadge readiness={jobProfile.readiness} />
            )}
          </div>

          {snapshot ? (
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2 text-sm">
              <Badge variant="info" size="sm">iLv {snapshot.avgItemLevel}</Badge>
              <SourceBadge source={snapshot.source} />
              <span className={`text-xs ${freshnessColor(freshness)}`}>
                {formatActivity(snapshot.syncedAt ?? snapshot.updatedAt, snapshot.source)}
              </span>
              {isStale && (
                <Badge variant="warning" size="sm">{t('profile.jobsGear.stale')}</Badge>
              )}
            </div>
          ) : (
            <div className="mt-1.5 inline-flex text-xs text-text-tertiary">
              {t('profile.jobsGear.noGearSavedForJobYet')}
            </div>
          )}

          {snapshot?.source !== 'plugin' && (
            <div className="mt-2 rounded-md border border-border-subtle bg-surface-elevated/50 px-2 py-1.5 text-xs text-text-secondary">
              {getGearStateLabel()}
            </div>
          )}

          <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-text-tertiary">
            {activeBisTarget ? (
              <>
                <span className="font-medium text-text-secondary">{activeBisTarget.name}</span>
                <span className="rounded bg-surface-elevated/80 px-1.5 py-0.5 text-text-tertiary">
                  {t(PURPOSE_LABEL_KEYS[activeBisTarget.purpose] ?? '', { defaultValue: activeBisTarget.purpose })}
                </span>
                {activeBisTarget.itemLevel != null && (
                  <span className="text-accent font-mono">iLv {activeBisTarget.itemLevel}</span>
                )}
                {compareStatus === 'on_target' && (
                  <span className="rounded bg-status-success/10 px-1.5 py-0.5 text-status-success font-medium">{t('profile.jobsGear.onTarget')}</span>
                )}
                {compareStatus === 'missing_pieces' && (
                  <span className="rounded bg-status-warning/10 px-1.5 py-0.5 text-status-warning font-medium">{t('profile.jobsGear.missingPieces')}</span>
                )}
                {bisTargetCount > 1 && (
                  <span className="text-text-muted">{t('profile.jobsGear.moreBisTargets', { count: bisTargetCount - 1 })}</span>
                )}
              </>
            ) : (
              <span>{t('profile.jobsGear.noBisTargetSet')}</span>
            )}
          </div>

          {jobProfile.notes && (
            <div className="mt-1.5 text-sm text-text-secondary italic">
              {jobProfile.notes}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <IconButton
            icon="✎"
            aria-label={t('profile.jobsGear.editJobProfile')}
            variant="ghost"
            size="sm"
            onClick={() => onEdit(jobProfile)}
          />
          <IconButton
            icon="×"
            aria-label={t('profile.jobsGear.removeJobProfile')}
            variant="ghost"
            size="sm"
            onClick={deleteModal.open}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setExpanded((value) => !value)}>
          {expanded ? t('profile.jobsGear.hideGear') : t('profile.jobsGear.showGear')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(jobProfile)}>
          {t('profile.jobsGear.editJob')}
        </Button>
        {onManageBiS && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onManageBiS(jobProfile.id)}
            data-testid={`manage-bis-${jobProfile.id}`}
          >
            {t('profile.jobsGear.bisTargets')}
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 space-y-1.5" data-testid={`gear-slots-${jobProfile.job}`}>
          {snapshot?.gear?.length ? (
            snapshot.gear.map((slot) => (
              <GearSlotCompactRow
                key={slot.slot}
                slot={slot}
                emptyLabel={t('profile.jobsGear.empty')}
                getSlotLabel={getSlotLabel}
              />
            ))
          ) : (
            <div className="rounded-md border border-border-subtle bg-surface-elevated/60 px-3 py-2 text-sm text-text-tertiary">
              {t('profile.jobsGear.noGearSavedForJob', { job: jobProfile.job })}
            </div>
          )}
        </div>
      )}

      {deleteModal.isOpen && (
        <ConfirmModal
          isOpen={deleteModal.isOpen}
          title={t('profile.jobsGear.removeJobProfileTitle')}
          message={t('profile.jobsGear.removeJobProfileMessage', { job: getJobDisplayName(jobProfile.job) })}
          confirmLabel={t('common.remove')}
          variant="danger"
          onConfirm={handleDelete}
          onCancel={deleteModal.close}
        />
      )}
    </div>
  );
}
