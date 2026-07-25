import { CardShell, ProgressBar, Select } from '../ui';
import { Button } from '../primitives';
import type { AvailabilityRecommendation } from './availabilityUtils';

const DURATION_OPTIONS = [
  { value: '60', label: '1h' },
  { value: '90', label: '1.5h' },
  { value: '120', label: '2h' },
  { value: '150', label: '2.5h' },
  { value: '180', label: '3h' },
];

export interface BestTimesCardProps {
  recommendations: AvailabilityRecommendation[];
  durationMinutes: number;
  onDurationChange: (m: number) => void;
  /** Viewer-local 'YYYY-MM-DD|HH:MM' start keys of scoped occurrences. */
  scheduledSlotIds?: Set<string>;
  canManage: boolean;
  onProposeSession?: (rec: AvailabilityRecommendation) => void;
}

function formatWhenLabel(startIso: string): string {
  const start = new Date(startIso);
  const weekday = start.toLocaleDateString('en-US', { weekday: 'short' });
  const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${weekday} ${time}`;
}

export function BestTimesCard({
  recommendations,
  durationMinutes,
  onDurationChange,
  scheduledSlotIds,
  canManage,
  onProposeSession,
}: BestTimesCardProps) {
  return (
    <CardShell
      as="div"
      title="Best times this week"
      headerRight={(
        <Select
          aria-label="Session length"
          value={String(durationMinutes)}
          onChange={(value) => onDurationChange(Number(value))}
          options={DURATION_OPTIONS}
        />
      )}
    >
      {recommendations.length === 0 ? (
        <p className="text-xs text-text-tertiary">Not enough availability data yet.</p>
      ) : (
        <div className="space-y-2">
          {recommendations.map((rec) => {
            const when = formatWhenLabel(rec.startIso);
            const isScheduled = scheduledSlotIds?.has(rec.id.split('|').slice(0, 2).join('|'));

            const content = (
              <>
                <span className="text-xs font-medium text-text-primary w-24 shrink-0">{when}</span>
                <ProgressBar value={rec.availableCount / Math.max(1, rec.totalMembers)} className="flex-1" />
                <span className="text-xs text-text-tertiary">
                  {rec.availableCount}/{rec.totalMembers}
                  {isScheduled && <span className="text-xs text-text-tertiary"> · scheduled</span>}
                </span>
              </>
            );

            if (canManage && onProposeSession) {
              return (
                <Button
                  key={rec.id}
                  variant="ghost"
                  size="sm"
                  className="flex w-full items-center gap-2"
                  aria-label={`Propose session ${when}`}
                  onClick={() => onProposeSession(rec)}
                >
                  {content}
                </Button>
              );
            }

            return (
              <div key={rec.id} className="flex items-center gap-2">
                {content}
              </div>
            );
          })}
        </div>
      )}
    </CardShell>
  );
}
