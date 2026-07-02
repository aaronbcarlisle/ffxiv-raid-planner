/**
 * HistoryFilters — the History table's toolbar filter pills (spec §5.6).
 * Three independent Dropdowns (Week / Player / Source); mirrors
 * WeekScopeControl's trigger composition (`Button` + `trailing="chevron"`)
 * and swaps in the accent treatment when a pill is scoped to a non-default
 * value. Presentational + controlled: filters/onChange come from the host
 * (Task 9 owns the state).
 */
import { Button } from '../primitives/Button';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from '../primitives/Dropdown';
import type { SnapshotPlayer } from '../../types';
import { DEFAULT_HISTORY_FILTERS, type HistoryFilterState, type HistorySource } from '../../utils/historyItems';

export interface HistoryFiltersProps {
  filters: HistoryFilterState;
  onChange: (next: HistoryFilterState) => void;
  /** from historyWeeks. */
  weeks: number[];
  /** mains + subs, for the player pill. */
  players: SnapshotPlayer[];
}

const SOURCE_LABELS: Record<HistorySource, string> = {
  all: 'All sources',
  raid: 'Raid drops',
  tome: 'Tome',
  book: 'Books',
  material: 'Materials',
};

const SOURCE_OPTIONS: HistorySource[] = ['all', 'raid', 'tome', 'book', 'material'];

function FilterPill({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button variant={active ? 'accent-subtle' : 'secondary'} size="sm" trailing="chevron">
          {label}
        </Button>
      </DropdownTrigger>
      <DropdownContent align="start" className="w-48">
        {children}
      </DropdownContent>
    </Dropdown>
  );
}

export function HistoryFilters({ filters, onChange, weeks, players }: HistoryFiltersProps) {
  const configuredPlayers = players
    .filter((p) => p.configured)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const weekLabel = filters.week === 'all' ? 'All weeks' : `Week ${filters.week}`;
  const playerLabel =
    filters.playerId === 'all'
      ? 'All players'
      : configuredPlayers.find((p) => p.id === filters.playerId)?.name ?? 'All players';
  const sourceLabel = SOURCE_LABELS[filters.source];

  return (
    <div className="flex items-center gap-2">
      <FilterPill label={weekLabel} active={filters.week !== DEFAULT_HISTORY_FILTERS.week}>
        <DropdownItem onSelect={() => onChange({ ...filters, week: 'all' })}>All weeks</DropdownItem>
        {weeks.map((w) => (
          <DropdownItem key={w} onSelect={() => onChange({ ...filters, week: w })}>
            {`Week ${w}`}
          </DropdownItem>
        ))}
      </FilterPill>

      <FilterPill label={playerLabel} active={filters.playerId !== DEFAULT_HISTORY_FILTERS.playerId}>
        <DropdownItem onSelect={() => onChange({ ...filters, playerId: 'all' })}>All players</DropdownItem>
        {configuredPlayers.map((p) => (
          <DropdownItem key={p.id} onSelect={() => onChange({ ...filters, playerId: p.id })}>
            {p.name}
          </DropdownItem>
        ))}
      </FilterPill>

      <FilterPill label={sourceLabel} active={filters.source !== DEFAULT_HISTORY_FILTERS.source}>
        {SOURCE_OPTIONS.map((s) => (
          <DropdownItem key={s} onSelect={() => onChange({ ...filters, source: s })}>
            {SOURCE_LABELS[s]}
          </DropdownItem>
        ))}
      </FilterPill>
    </div>
  );
}
