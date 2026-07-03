/**
 * AvailabilityHeatmap — the right-region ambient availability grid (spec §5.4).
 *
 * 7 day columns × 8 prime-hour rows; density = accent color-mix steps derived
 * from `deriveHourlyHeatCells` (name-intersection count / tracked-member total).
 * Read-only with respect to availability DATA always — cells only become
 * propose-session buttons when `canManage && onProposeSession` is provided,
 * using the GearBoardCell accessible-span pattern (span + role="button" +
 * tabIndex + click/Enter/Space keydown), never a raw `<button>`.
 */
import { useMemo } from 'react';
import { CardShell } from '../ui';
import { Button } from '../primitives';
import { buildHeatMap, formatTimeLabel, formatDateHeader } from './availabilityUtils';
import { deriveHourlyHeatCells, PRIME_HOURS, localSlotKeyOf } from './scheduleWeek';
import type {
  AvailabilityDateSummary,
  Membership,
  ScheduleSession,
  ScheduleSessionCreate,
} from '../../types';

export interface AvailabilityHeatmapProps {
  data: AvailabilityDateSummary[];
  members: Membership[];
  weekDates: string[];
  sessions: Array<{ session: ScheduleSession; occursAt: string }>;
  canManage: boolean;
  onProposeSession?: (draft: ScheduleSessionCreate) => void;
  /** Task 10 (§5.1 stopgap): opens the legacy AvailabilityGrid editor in a v2
   * modal. Additive — omitting this prop leaves the header render unchanged. */
  onEditWeek?: () => void;
}

const HOUR_MS = 60 * 60 * 1000;
const MAX_SESSION_HOURS = 12;
/** The 5 F1/F6d-sanctioned density steps (token color-mix, no new tokens),
 * ascending lightest → darkest for the legend gradient (darker = more free). */
const DENSITY_STEPS = [8, 16, 28, 45, 70];

function densityStep(r: number): number {
  if (r >= 1) return 70;
  if (r >= 0.75) return 45;
  if (r >= 0.5) return 28;
  if (r >= 0.25) return 16;
  return 8;
}

function densityBackground(step: number): string {
  return `color-mix(in srgb, var(--color-accent) ${step}%, var(--color-surface-card))`;
}

const SCHEDULED_RING_STYLE = { boxShadow: 'inset 0 0 0 2px var(--color-accent-hover)' } as const;

export function AvailabilityHeatmap({
  data,
  members,
  weekDates,
  sessions,
  canManage,
  onProposeSession,
  onEditWeek,
}: AvailabilityHeatmapProps) {
  const heat = useMemo(() => buildHeatMap(data), [data]);
  const rows = useMemo(() => deriveHourlyHeatCells(heat, weekDates), [heat, weekDates]);
  const total = members.length;

  const scheduledKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const { session, occursAt } of sessions) {
      const start = new Date(occursAt);
      const startMs = start.getTime();
      if (Number.isNaN(startMs)) continue;
      const rawDurationMs = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
      const durationMs = Math.min(
        MAX_SESSION_HOURS * HOUR_MS,
        Number.isNaN(rawDurationMs) || rawDurationMs <= 0 ? HOUR_MS : rawDurationMs,
      );
      const endMs = startMs + durationMs;
      // Floor the viewer-local start to its hour top, then emit the HH:00 key of
      // every local hour top the [start, end) span overlaps. Flooring in local
      // space also handles half-hour-offset timezones (e.g. IST) correctly.
      const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), start.getHours());
      // Off-hour start + 12h cap can overlap at most 13 hour tops.
      for (let i = 0; i <= MAX_SESSION_HOURS && cursor.getTime() < endMs; i++) {
        keys.add(localSlotKeyOf(cursor.toISOString()));
        cursor.setHours(cursor.getHours() + 1);
      }
    }
    return keys;
  }, [sessions]);

  const allZero = rows.every((row) => row.every((cell) => cell.count === 0));

  const handleProposeSession = (dateKey: string, hour: number) => {
    if (!onProposeSession) return;
    const [y, m, d] = dateKey.split('-').map(Number);
    const start = new Date(y, m - 1, d, hour);
    const end = new Date(start.getTime() + 2 * HOUR_MS);
    onProposeSession({
      title: 'Raid session',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isRecurring: false,
    });
  };

  const noteLine = allZero
    ? 'No availability marked yet. Set yours via “Your availability” below — the picture fills in as members add theirs.'
    : `Aggregated from each member's availability · darker = more free.${canManage ? ' Click a slot to propose a session.' : ''}`;

  return (
    <CardShell
      as="div"
      title="Team availability"
      headerRight={
        onEditWeek ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">{members.length} raiders</span>
            <Button variant="ghost" size="sm" onClick={onEditWeek}>
              Edit week
            </Button>
          </div>
        ) : (
          <span className="text-xs text-text-tertiary">{members.length} raiders</span>
        )
      }
    >
      <p className="text-xs text-text-tertiary mb-2">{noteLine}</p>
      <div className="grid" style={{ gridTemplateColumns: '44px repeat(7, minmax(0, 1fr))' }}>
        <div />
        {weekDates.map((date) => (
          <div key={date} className="text-xs text-text-tertiary text-center">
            {formatDateHeader(date).day}
          </div>
        ))}
        {rows.flatMap((row, rowIndex) => {
          const hour = PRIME_HOURS[rowIndex];
          const hourLabel = formatTimeLabel(`${String(hour).padStart(2, '0')}:00`).replace(':00', '');
          const cells = row.map((cell) => {
            const r = total > 0 ? cell.count / total : 0;
            const isFull = cell.count === total && total > 0;
            const scheduled = scheduledKeys.has(`${cell.date}|${String(cell.hour).padStart(2, '0')}:00`);
            const baseClass = `h-7 rounded-[4px] flex items-center justify-center${
              r === 0 ? ' bg-surface-card border border-border-subtle' : ''
            }`;
            const style: React.CSSProperties = {};
            if (r !== 0) style.background = densityBackground(densityStep(r));
            if (scheduled) style.boxShadow = SCHEDULED_RING_STYLE.boxShadow;
            const countText = isFull ? (
              <span className="text-xs font-bold text-text-primary">{cell.count}</span>
            ) : null;
            const key = `${cell.date}-${cell.hour}`;

            if (canManage && onProposeSession) {
              const ariaLabel = `${formatDateHeader(cell.date).day} ${formatTimeLabel(
                `${String(cell.hour).padStart(2, '0')}:00`,
              )} — ${cell.count} of ${total} free`;
              const onKeyDown = (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleProposeSession(cell.date, cell.hour);
                }
              };
              return (
                <span
                  key={key}
                  role="button"
                  tabIndex={0}
                  aria-label={ariaLabel}
                  className={`${baseClass} cursor-pointer`}
                  style={style}
                  data-scheduled={scheduled ? 'true' : undefined}
                  onClick={() => handleProposeSession(cell.date, cell.hour)}
                  onKeyDown={onKeyDown}
                >
                  {countText}
                </span>
              );
            }

            return (
              <div
                key={key}
                className={baseClass}
                style={style}
                data-scheduled={scheduled ? 'true' : undefined}
                title={cell.names.join(', ') || undefined}
              >
                {countText}
              </div>
            );
          });
          return [
            <div key={`hour-${hour}`} className="text-xs text-text-tertiary">
              {hourLabel}
            </div>,
            ...cells,
          ];
        })}
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-text-tertiary">
        <span>Fewer free</span>
        {DENSITY_STEPS.map((step) => (
          <span
            key={step}
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: densityBackground(step) }}
          />
        ))}
        <span>All {total}</span>
        <span aria-hidden="true">·</span>
        <span className="h-2.5 w-2.5 rounded-sm" style={SCHEDULED_RING_STYLE} />
        <span>scheduled</span>
      </div>
    </CardShell>
  );
}
