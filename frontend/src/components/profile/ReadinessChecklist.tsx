import { Badge } from '../primitives/Badge';
import { useTranslation } from 'react-i18next';
import type { PlayerProfile } from '../../stores/playerProfileStore';

interface ReadinessChecklistProps {
  profile: PlayerProfile;
  hasGearSnapshots: boolean;
}

function CheckItem({ done, label, optional }: { done: boolean; label: string; optional?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`text-sm ${done ? 'text-status-success' : optional ? 'text-text-tertiary' : 'text-status-warning'}`}>
        {done ? '✓' : optional ? '—' : '✗'}
      </span>
      <span className={`text-sm ${done ? 'text-text-primary' : 'text-text-secondary'}`}>
        {label}
      </span>
      {optional && !done && (
        <span className="text-xs text-text-tertiary">({t('common.optional').toLowerCase()})</span>
      )}
    </div>
  );
}

export function ReadinessChecklist({ profile, hasGearSnapshots }: ReadinessChecklistProps) {
  const { t } = useTranslation();
  const hasCharacter = profile.characters.length > 0;
  const hasMainJob = profile.jobProfiles.some((j) => j.priority === 'main');
  const hasAltJob = profile.jobProfiles.some((j) => j.priority !== 'main');
  const hasReadyJob = profile.jobProfiles.some((j) => j.readiness !== 'unknown');
  const visibilityConfigured = profile.visibility !== 'private';
  const shareAvailable = profile.shareEnabled && !!profile.shareCode;

  const requiredChecks = [
    { done: hasCharacter, label: t('profile.jobsGear.checklistCharacterLinked') },
    { done: hasMainJob, label: t('profile.jobsGear.checklistMainJobSelected') },
    { done: hasGearSnapshots, label: t('profile.jobsGear.checklistGearSynced') },
    { done: hasReadyJob, label: t('profile.jobsGear.checklistReadinessSet') },
    { done: visibilityConfigured, label: t('profile.jobsGear.checklistVisibilityConfigured') },
    { done: shareAvailable, label: t('profile.jobsGear.checklistShareLinkAvailable') },
  ];

  const optionalChecks = [
    { done: hasAltJob, label: t('profile.jobsGear.checklistAltFlexAdded'), optional: true },
  ];

  const allChecks = [...requiredChecks, ...optionalChecks];
  const completedRequired = requiredChecks.filter((c) => c.done).length;

  return (
    <div className="bg-surface-raised rounded-lg border border-border-default p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-text-primary text-sm">
          {t('profile.jobsGear.applicationReadiness')}
        </h3>
        <Badge variant={completedRequired === requiredChecks.length ? 'success' : 'default'} size="sm">
          {completedRequired}/{requiredChecks.length}
        </Badge>
      </div>

      <div className="space-y-0.5">
        {allChecks.map((check) => (
          <CheckItem key={check.label} done={check.done} label={check.label} optional={'optional' in check ? (check as { optional?: boolean }).optional : undefined} />
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-border-default">
        <p className="text-xs text-text-tertiary">
          {t('profile.jobsGear.applicationReadinessDesc')}
        </p>
      </div>
    </div>
  );
}
