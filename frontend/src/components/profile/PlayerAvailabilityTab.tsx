import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChevronDown, Lock, Sparkles } from 'lucide-react';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from '../primitives';
import { usePersonalAvailabilityStore } from '../../stores/personalAvailabilityStore';
import type { StaticGroupListItem } from '../../types';
import { getBrowserTimezone } from '../../utils/timezone';
import { PersonalAvailabilityEditor } from './PersonalAvailabilityEditor';

const DAY_LABELS: Record<string, string> = {
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
  SU: 'Sun',
};

interface PlayerAvailabilityTabProps {
  primaryStatic?: StaticGroupListItem | null;
  staticGroups?: StaticGroupListItem[];
}

export function PlayerAvailabilityTab({ primaryStatic, staticGroups = primaryStatic ? [primaryStatic] : [] }: PlayerAvailabilityTabProps) {
  const { days, fetchPersonalAvailability } = usePersonalAvailabilityStore();

  useEffect(() => {
    fetchPersonalAvailability();
  }, [fetchPersonalAvailability]);

  const configuredDays = days.filter((day) => day.slots.length > 0);
  const totalSlots = configuredDays.reduce((total, day) => total + day.slots.length, 0);
  const timezone = configuredDays[0]?.timezone || getBrowserTimezone();
  const hasMultipleStatics = staticGroups.length > 1;
  const scheduleLink = staticGroups.length === 1 ? `/group/${staticGroups[0].shareCode}?tab=schedule` : '/discover';

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-accent/20 bg-surface-raised p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <CalendarDays className="h-3.5 w-3.5" />
              Personal default
            </div>
            <h2 className="font-display text-xl font-semibold text-text-primary">Typical Availability</h2>
            <p className="mt-1 max-w-2xl text-sm text-text-secondary">
              Set your usual raid times once. When used in a static, it copies into that static&apos;s week so you can adjust exceptions there.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default" size="sm">{timezone}</Badge>
            <Badge variant={configuredDays.length > 0 ? 'success' : 'warning'} size="sm">
              {configuredDays.length} day{configuredDays.length !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="info" size="sm">
              {totalSlots / 2} hour{totalSlots === 2 ? '' : 's'}
            </Badge>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {configuredDays.length > 0 ? configuredDays.map((day) => (
            <span key={day.dayOfWeek} className="rounded-full bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
              {DAY_LABELS[day.dayOfWeek] ?? day.dayOfWeek}
            </span>
          )) : (
            <span className="text-sm text-text-tertiary">No typical availability yet.</span>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border-subtle bg-surface-elevated/70 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              Used by schedule quick fill
            </div>
            <p className="mt-1 text-xs text-text-tertiary">Fills empty This Week days only.</p>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface-elevated/70 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
              <Lock className="h-3.5 w-3.5" />
              Private by default
            </div>
            <p className="mt-1 text-xs text-text-tertiary">Not shown on public profile yet.</p>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface-elevated/70 px-3 py-2">
            <div className="text-xs font-medium text-accent">Schedule matching</div>
            <p className="mt-1 text-xs text-text-tertiary">Used later for schedule matching.</p>
          </div>
        </div>

        <div className="mt-4">
          {hasMultipleStatics ? (
            <Dropdown>
              <DropdownTrigger>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  Choose static schedule
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownTrigger>
              <DropdownContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
                {staticGroups.map((group, index) => (
                  <div key={group.id}>
                    {index > 0 && <DropdownSeparator />}
                    <DropdownItem href={`/group/${group.shareCode}?tab=schedule`} icon={<CalendarDays className="h-4 w-4" />}>
                      <span className="min-w-0 truncate">{group.name}</span>
                    </DropdownItem>
                  </div>
                ))}
              </DropdownContent>
            </Dropdown>
          ) : (
            <Link
              to={scheduleLink}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border-default bg-surface-elevated px-3 py-2 text-sm font-semibold text-text-secondary transition-colors hover:border-accent/30 hover:text-accent sm:min-h-0"
            >
              {staticGroups.length === 1 ? 'Use in static schedule' : 'Find a static'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border-default bg-surface-raised p-4 sm:p-5">
        <PersonalAvailabilityEditor />
      </section>
    </div>
  );
}
