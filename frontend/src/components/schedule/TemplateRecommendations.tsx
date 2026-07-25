/* eslint-disable design-system/no-raw-button */
/**
 * TemplateRecommendations
 *
 * Displays the top-3 best recurring raid windows derived from the static's
 * typical-week availability templates, with a "Create session" button that
 * pre-fills a weekly recurring session on the correct weekday.
 */

import { CalendarPlus } from 'lucide-react';
import { Button } from '../primitives';
import type { TemplateRecommendation } from './availabilityUtils';
import { DAY_FULL_LABELS, formatTimeLabel } from './availabilityUtils';

interface TemplateRecommendationsProps {
  recommendations: TemplateRecommendation[];
  durationMinutes: number;
  onDurationChange: (value: number) => void;
  canCreateSession: boolean;
  onCreateSession: (rec: TemplateRecommendation) => void;
}

const DURATION_OPTIONS = [60, 90, 120, 180, 240];

export function TemplateRecommendations({
  recommendations,
  durationMinutes,
  onDurationChange,
  canCreateSession,
  onCreateSession,
}: TemplateRecommendationsProps) {
  const rankColors = [
    'border-yellow-500/40 bg-yellow-500/10',
    'border-green-500/40 bg-green-500/10',
    'border-sky-500/40 bg-sky-500/10',
  ];

  const rankBadgeColors = [
    'bg-yellow-500/20 text-yellow-300',
    'bg-green-500/20 text-green-300',
    'bg-sky-500/20 text-sky-300',
  ];

  return (
    <div className="rounded-2xl border border-border-default bg-surface-card/60 p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-base text-text-primary">Best recurring raid windows</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            Based on typical weekly schedules — these slots have the most overlap every week.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>Duration:</span>
          <div className="flex gap-1">
            {DURATION_OPTIONS.map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => onDurationChange(min)}
                className={`rounded-md px-2 py-1 transition-colors ${
                  durationMinutes === min
                    ? 'bg-accent text-accent-contrast'
                    : 'bg-surface-elevated text-text-secondary hover:bg-surface-interactive'
                }`}
              >
                {min >= 60 ? `${min / 60}h` : `${min}m`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-surface-elevated/50 px-4 py-6 text-center text-sm text-text-muted">
          No overlap found yet. Members need to fill in their typical weekly schedule first.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {recommendations.map((rec, index) => (
            <div
              key={rec.id}
              className={`rounded-xl border p-4 ${rankColors[index] ?? 'border-border-default bg-surface-elevated/50'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${rankBadgeColors[index] ?? ''}`}>
                    #{index + 1} best
                  </div>
                  <div className="text-sm font-semibold text-text-primary">
                    {DAY_FULL_LABELS[rec.dayOfWeek as keyof typeof DAY_FULL_LABELS]}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {formatTimeLabel(rec.startTime)} – {formatTimeLabel(rec.endTime)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-status-success">{rec.availableCount}</div>
                  <div className="text-[10px] text-text-muted">/ {rec.totalMembers}</div>
                </div>
              </div>

              {rec.availableNames.length > 0 && (
                <div className="mt-2 text-[11px] text-text-muted truncate">
                  {rec.availableNames.join(', ')}
                </div>
              )}

              {canCreateSession && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  leftIcon={<CalendarPlus className="h-3.5 w-3.5" />}
                  className="mt-3 w-full"
                  onClick={() => onCreateSession(rec)}
                >
                  Create recurring session
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
