/**
 * WeekScopeControl — the Loot toolbar's week pill (spec §2.3/§5.4): a scope
 * dropdown fed by the shared `WeekClock`, and the host for the clock's
 * mutations ("Start next week" / "Revert week"). Local scope control + the
 * clock's mutation host in one place — resolves the F5 §C tension (the
 * mutations were homeless until the shared clock landed in F6d).
 */
import { useState } from 'react';
import { Button } from '../primitives/Button';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '../primitives/Dropdown';
import { ConfirmModal } from '../ui';
import { toast } from '../../stores/toastStore';
import type { WeekClock } from '../../hooks/useWeekClock';
import type { WeekEntryType } from '../../stores/lootTrackingStore';

export interface WeekScopeControlProps {
  clock: WeekClock;
  scopedWeek: number;
  onScopedWeekChange: (week: number) => void;
  canEdit: boolean;
}

const DOT_COLOR: Record<WeekEntryType, string> = {
  loot: 'bg-accent',
  books: 'bg-membership-lead',
  mats: 'bg-status-warning',
};

/** UTC-pinned so the shown date never shifts a day from the mid-day UTC anchor. */
function formatWeekDate(d: Date): string {
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
}

type PendingMutation = 'start-next' | 'revert' | null;

export function WeekScopeControl({
  clock,
  scopedWeek,
  onScopedWeekChange,
  canEdit,
}: WeekScopeControlProps) {
  const [pendingMutation, setPendingMutation] = useState<PendingMutation>(null);

  const { currentWeek, maxWeek, weekDataTypes, rangeOfWeek, startNextWeek, revertWeek } = clock;

  const label =
    scopedWeek === currentWeek ? `This week (Week ${scopedWeek})` : `Week ${scopedWeek}`;

  const weeks = Array.from({ length: maxWeek }, (_, i) => maxWeek - i);

  const handleStartNextWeek = async () => {
    try {
      const newWeek = await startNextWeek();
      toast.success('Week advanced');
      onScopedWeekChange(newWeek);
    } catch {
      toast.error('Failed to advance the week');
    } finally {
      setPendingMutation(null);
    }
  };

  const handleRevertWeek = async () => {
    try {
      const newWeek = await revertWeek();
      toast.success('Week reverted');
      onScopedWeekChange(newWeek);
    } catch {
      toast.error('Failed to revert the week');
    } finally {
      setPendingMutation(null);
    }
  };

  return (
    <>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="secondary" size="sm" trailing="chevron">
            {label}
          </Button>
        </DropdownTrigger>
        <DropdownContent align="start" className="w-56">
          {weeks.map((w) => {
            const range = rangeOfWeek(w);
            const types = weekDataTypes.get(w) ?? [];
            const rangeText = range
              ? ` · ${formatWeekDate(range.start)} – ${formatWeekDate(range.end)}`
              : '';
            return (
              <DropdownItem key={w} onSelect={() => onScopedWeekChange(w)}>
                <span
                  className="flex w-full items-center gap-2"
                  title={types.length ? types.join(', ') : undefined}
                >
                  <span>{`Week ${w}${rangeText}`}</span>
                  {types.length > 0 && (
                    <span className="flex items-center gap-0.5" aria-hidden="true">
                      {types.map((t) => (
                        <span key={t} className={`h-1.5 w-1.5 rounded-full ${DOT_COLOR[t]}`} />
                      ))}
                    </span>
                  )}
                </span>
              </DropdownItem>
            );
          })}

          {canEdit && (
            <>
              <DropdownSeparator />
              <DropdownItem onSelect={() => setPendingMutation('start-next')}>
                Start next week
              </DropdownItem>
              <DropdownItem
                // Guard: reverting from Week 1 would open a modal reading "Week 0".
                disabled={currentWeek <= 1}
                onSelect={() => setPendingMutation('revert')}
              >
                Revert week
              </DropdownItem>
            </>
          )}
        </DropdownContent>
      </Dropdown>

      <ConfirmModal
        isOpen={pendingMutation === 'start-next'}
        title="Start next week"
        message={`Advance the week clock to Week ${currentWeek + 1}? Logged data is never modified.`}
        variant="default"
        confirmLabel="Start next week"
        onConfirm={handleStartNextWeek}
        onCancel={() => setPendingMutation(null)}
      />

      <ConfirmModal
        isOpen={pendingMutation === 'revert'}
        title="Revert week"
        message={`Move the clock back to Week ${currentWeek - 1}? Entries logged for Week ${currentWeek} will appear as future-week entries.`}
        variant="warning"
        confirmLabel="Revert week"
        onConfirm={handleRevertWeek}
        onCancel={() => setPendingMutation(null)}
      />
    </>
  );
}
