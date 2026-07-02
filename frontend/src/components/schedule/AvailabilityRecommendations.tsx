import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, CalendarRange, Copy } from 'lucide-react';
import { toast } from '../../stores/toastStore';
import { Button, Badge } from '../primitives';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { formatInTimeZone } from '../../utils/timezone';
import type { AvailabilityRecommendation } from './availabilityUtils';

const DURATION_OPTIONS = [
  { value: '60', label: '1h' },
  { value: '90', label: '1.5h' },
  { value: '120', label: '2h' },
  { value: '150', label: '2.5h' },
  { value: '180', label: '3h' },
];

interface AvailabilityRecommendationsProps {
  recommendations: AvailabilityRecommendation[];
  durationMinutes: number;
  onDurationChange: (value: number) => void;
  referenceTimezone: string;
  localTimezone: string;
  staticName: string;
  schedulePageUrl: string;
  responderCount: number;
  totalMembers: number;
  canCreateSession: boolean;
  onCreateSession: (recommendation: AvailabilityRecommendation) => void;
}

function formatRecommendationRange(startIso: string, endIso: string, timeZone: string, locale: string): string {
  const startLabel = formatInTimeZone(startIso, timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }, locale);
  const endLabel = formatInTimeZone(endIso, timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }, locale);
  return `${startLabel} - ${endLabel}`;
}

function confidenceLabel(index: number, availableCount: number, totalMembers: number, t: (key: string) => string): string {
  const ratio = totalMembers > 0 ? availableCount / totalMembers : 0;
  if (index === 0 && ratio >= 0.75) return t('schedule.confidenceGreatFit');
  if (ratio >= 0.5) return t('schedule.confidenceGoodBackup');
  return t('schedule.confidenceThinOption');
}

export function AvailabilityRecommendations({
  recommendations,
  durationMinutes,
  onDurationChange,
  referenceTimezone,
  localTimezone,
  staticName,
  schedulePageUrl,
  responderCount,
  totalMembers,
  canCreateSession,
  onCreateSession,
}: AvailabilityRecommendationsProps) {
  const { t, i18n } = useTranslation();
  const uiLocale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';
  const [copiedProposal, setCopiedProposal] = useState(false);
  const proposalText = useMemo(() => {
    if (recommendations.length === 0) {
      return '';
    }

    const lines = [
      t('schedule.proposalHeader', { staticName }),
      t('schedule.proposalTimezone', { referenceTimezone }),
      '',
      ...recommendations.map((recommendation, index) => (
        `${index + 1}. ${formatRecommendationRange(recommendation.startIso, recommendation.endIso, referenceTimezone, uiLocale)} - `
        + t('schedule.proposalAvailable', { availableCount: recommendation.availableCount, totalMembers: recommendation.totalMembers })
      )),
      '',
      t('schedule.proposalSchedulerUrl', { schedulePageUrl }),
    ];
    return lines.join('\n');
  }, [recommendations, referenceTimezone, schedulePageUrl, staticName, t, uiLocale]);

  const handleCopyProposal = async () => {
    if (!proposalText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(proposalText);
      setCopiedProposal(true);
      window.setTimeout(() => setCopiedProposal(false), 1800);
      toast.success(t('common.copied'));
    } catch {
      toast.error(t('schedule.failedToCopyProposal'));
    }
  };

  return (
    <div className="rounded-2xl border border-border-default bg-surface-base/90 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <CalendarRange className="h-3.5 w-3.5" />
            {t('schedule.bestRaidWindowsBadge')}
          </div>
          <div className="space-y-1">
            <h4 className="font-display text-lg text-text-primary">
              {t('schedule.bestRaidWindowsHeading')}
            </h4>
            <p className="max-w-3xl text-sm text-text-secondary">
              {t('schedule.bestRaidWindowsDesc')}
            </p>
          </div>
        </div>

        <div className="w-full max-w-xs">
          <Label size="sm">{t('schedule.targetSessionLength')}</Label>
          <Select
            value={String(durationMinutes)}
            onChange={(value) => onDurationChange(Number(value))}
            options={DURATION_OPTIONS}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="default">{t('schedule.respondersCount', { count: responderCount })}</Badge>
        <Badge variant="default">{t('schedule.trackedMembersCount', { count: totalMembers })}</Badge>
        <Badge variant="info">{referenceTimezone}</Badge>
        {referenceTimezone !== localTimezone && (
          <Badge variant="default">{t('schedule.localTzBadge', { tz: localTimezone })}</Badge>
        )}
      </div>

      {recommendations.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-border-default bg-surface-elevated/70 px-4 py-5 text-sm text-text-secondary">
          {t('schedule.noAvailabilityMarked')}
        </div>
      ) : (
        <div className="mt-5 grid gap-3 xl:grid-cols-3">
          {recommendations.map((recommendation, index) => (
            <div
              key={recommendation.id}
              className="rounded-2xl border border-border-default bg-surface-elevated/80 p-4 transition-all duration-150 hover:border-accent/35 hover:shadow-lg hover:shadow-accent/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                    {index === 0 ? t('schedule.rankBest') : t('schedule.rankBackup', { n: index })}
                  </div>
                  <div className="mt-1 font-medium text-text-primary">
                    {formatRecommendationRange(recommendation.startIso, recommendation.endIso, referenceTimezone, uiLocale)}
                  </div>
                </div>
                <Badge variant={index === 0 ? 'success' : 'default'}>
                  {recommendation.availableCount}/{recommendation.totalMembers}
                </Badge>
              </div>
              <Badge variant={index === 0 ? 'success' : 'info'} className="mt-3">
                {confidenceLabel(index, recommendation.availableCount, recommendation.totalMembers, t)}
              </Badge>

              {referenceTimezone !== localTimezone && (
                <p className="mt-2 text-xs text-text-muted">
                  {t('session.yourTime', { time: formatRecommendationRange(recommendation.startIso, recommendation.endIso, localTimezone, uiLocale) })}
                </p>
              )}

              <div className="mt-3 space-y-2 text-xs">
                <div className="text-status-success">
                  {t('schedule.availableLabel')}: {recommendation.availableNames.join(', ') || t('schedule.noMarkedMembers')}
                </div>
                <div className="text-text-secondary">
                  {t('schedule.notMarkedLabel')}: {recommendation.missingNames.join(', ') || t('schedule.nobodyNotMarked')}
                </div>
              </div>

              {canCreateSession && (
                <Button
                  variant="accent-subtle"
                  size="sm"
                  className="mt-4 w-full"
                  leftIcon={<CalendarPlus className="h-4 w-4" />}
                  onClick={() => onCreateSession(recommendation)}
                >
                  {t('schedule.createSessionFromTime')}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Copy className="h-4 w-4" />}
          disabled={recommendations.length === 0}
          onClick={handleCopyProposal}
        >
          {copiedProposal ? t('common.copied') : t('schedule.copyProposalToDiscord')}
        </Button>
        {canCreateSession ? (
          <span className="text-xs text-text-muted">
            {t('schedule.ownersLeadsCanCreateDraft')}
          </span>
        ) : (
          <span className="text-xs text-text-muted">
            {t('schedule.ownersLeadsCanCreateFromBlocks')}
          </span>
        )}
      </div>
    </div>
  );
}
