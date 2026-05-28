import { useMemo, useState } from 'react';
import { CalendarPlus, Copy, Sparkles } from 'lucide-react';
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

function formatRecommendationRange(startIso: string, endIso: string, timeZone: string): string {
  const startLabel = formatInTimeZone(startIso, timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const endLabel = formatInTimeZone(endIso, timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });
  return `${startLabel} - ${endLabel}`;
}

function confidenceLabel(index: number, availableCount: number, totalMembers: number): string {
  const ratio = totalMembers > 0 ? availableCount / totalMembers : 0;
  if (index === 0 && ratio >= 0.75) return 'Great fit';
  if (ratio >= 0.5) return 'Good backup';
  return 'Thin option';
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
  const [copiedProposal, setCopiedProposal] = useState(false);
  const proposalText = useMemo(() => {
    if (recommendations.length === 0) {
      return '';
    }

    const lines = [
      `Raid time proposal for ${staticName}`,
      `Reference timezone: ${referenceTimezone}`,
      '',
      ...recommendations.map((recommendation, index) => (
        `${index + 1}. ${formatRecommendationRange(recommendation.startIso, recommendation.endIso, referenceTimezone)} - `
        + `${recommendation.availableCount}/${recommendation.totalMembers} available`
      )),
      '',
      `Scheduler: ${schedulePageUrl}`,
    ];
    return lines.join('\n');
  }, [recommendations, referenceTimezone, schedulePageUrl, staticName]);

  const handleCopyProposal = async () => {
    if (!proposalText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(proposalText);
      setCopiedProposal(true);
      window.setTimeout(() => setCopiedProposal(false), 1800);
      toast.success('Copied!');
    } catch {
      toast.error('Failed to copy scheduler proposal');
    }
  };

  return (
    <div className="rounded-2xl border border-border-default bg-surface-base/90 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Best Raid Windows
          </div>
          <div className="space-y-1">
            <h4 className="font-display text-lg text-text-primary">
              Best raid windows
            </h4>
            <p className="max-w-3xl text-sm text-text-secondary">
              These are the strongest overlap windows from your static&apos;s availability.
            </p>
          </div>
        </div>

        <div className="w-full max-w-xs">
          <Label size="sm">Target session length</Label>
          <Select
            value={String(durationMinutes)}
            onChange={(value) => onDurationChange(Number(value))}
            options={DURATION_OPTIONS}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="default">{responderCount} responders</Badge>
        <Badge variant="default">{totalMembers} tracked members</Badge>
        <Badge variant="info">{referenceTimezone}</Badge>
        {referenceTimezone !== localTimezone && (
          <Badge variant="default">Local: {localTimezone}</Badge>
        )}
      </div>

      {recommendations.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-border-default bg-surface-elevated/70 px-4 py-5 text-sm text-text-secondary">
          No availability marked yet. Ask your static to paint the grid so the planner can find your best raid windows.
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
                    {index === 0 ? 'Best' : `Backup ${index}`}
                  </div>
                  <div className="mt-1 font-medium text-text-primary">
                    {formatRecommendationRange(recommendation.startIso, recommendation.endIso, referenceTimezone)}
                  </div>
                </div>
                <Badge variant={index === 0 ? 'success' : 'default'}>
                  {recommendation.availableCount}/{recommendation.totalMembers}
                </Badge>
              </div>
              <Badge variant={index === 0 ? 'success' : 'info'} className="mt-3">
                {confidenceLabel(index, recommendation.availableCount, recommendation.totalMembers)}
              </Badge>

              {referenceTimezone !== localTimezone && (
                <p className="mt-2 text-xs text-text-muted">
                  Your time: {formatRecommendationRange(recommendation.startIso, recommendation.endIso, localTimezone)}
                </p>
              )}

              <div className="mt-3 space-y-2 text-xs">
                <div className="text-status-success">
                  Available: {recommendation.availableNames.join(', ') || 'No marked members'}
                </div>
                <div className="text-text-secondary">
                  Not marked: {recommendation.missingNames.join(', ') || 'Nobody'}
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
                  Create session from this time
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
          {copiedProposal ? 'Copied!' : 'Copy proposal to Discord'}
        </Button>
        {canCreateSession ? (
          <span className="text-xs text-text-muted">
            Owners and leads can turn any highlighted recommendation into a ready-to-edit session draft.
          </span>
        ) : (
          <span className="text-xs text-text-muted">
            Owners and leads can create sessions directly from these recommended blocks.
          </span>
        )}
      </div>
    </div>
  );
}

