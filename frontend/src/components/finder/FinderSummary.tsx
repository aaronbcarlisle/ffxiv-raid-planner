/* eslint-disable react-refresh/only-export-components -- summaryText/summarySubline/sortOptionsFor are exported alongside the component so they can be unit-tested directly and reused (StaticFinder's guest branch). */
/**
 * FinderSummary — the match-count headline plus the sort `Select` (R-SF-N/P).
 */
import { Select } from '../ui/Select';
import type { SelectOption } from '../ui/Select';
import { ROLE_FIT_LABELS, type FitCounts, type FitViewer, type RoleKey } from './types';

const SIGNED_IN_SORT_OPTIONS: SelectOption[] = [
  { value: 'best', label: 'Best match' },
  { value: 'recent', label: 'Recent' },
  { value: 'members', label: 'Members' },
  { value: 'name', label: 'Name' },
];

const GUEST_SORT_OPTIONS: SelectOption[] = SIGNED_IN_SORT_OPTIONS.filter(o => o.value !== 'best');

export function sortOptionsFor(isGuest: boolean): SelectOption[] {
  return isGuest ? GUEST_SORT_OPTIONS : SIGNED_IN_SORT_OPTIONS;
}

/** R-SF-P: "{n} of {total} statics are a good fit for you[ as a {role}]"; guests get a plain count. */
export function summaryText(fitCounts: FitCounts | null, total: number, roleKey: string | null): string {
  if (!fitCounts) {
    return `${total} ${total === 1 ? 'static' : 'statics'}`;
  }
  const n = fitCounts.strong + fitCounts.good;
  if (n === 0) {
    return 'No strong matches yet — try another role or loosen your filters.';
  }
  const roleLabel = roleKey ? ROLE_FIT_LABELS[roleKey as RoleKey] : undefined;
  return `${n} of ${total} statics are a good fit for you${roleLabel ? ` as a ${roleLabel}` : ''}`;
}

/** R-SF-P/m16: only with Best match and a typical week (no `template` in `missing`). */
export function summarySubline(sort: string, viewer: FitViewer | null): string | null {
  if (sort !== 'best' || !viewer || viewer.missing.includes('template')) return null;
  return 'Ranked by fit · uses your Player Hub typical week';
}

interface FinderSummaryProps {
  total: number;
  fitCounts: FitCounts | null;
  viewer: FitViewer | null;
  asRole: string;
  sort: string;
  onSortChange: (value: string) => void;
  isGuest: boolean;
}

export function FinderSummary({ total, fitCounts, viewer, asRole, sort, onSortChange, isGuest }: FinderSummaryProps) {
  const roleKey = asRole || viewer?.mainRole || null;
  const text = summaryText(fitCounts, total, roleKey);
  const subline = summarySubline(sort, viewer);

  return (
    <div className="flex items-start justify-between gap-3 mb-4 flex-wrap" data-testid="finder-summary">
      <div className="min-w-0">
        <p className="text-sm text-text-primary font-medium">{text}</p>
        {subline && <p className="text-xs text-text-muted mt-0.5">{subline}</p>}
      </div>
      <div className="w-40 flex-shrink-0">
        <Select value={sort} onChange={onSortChange} options={sortOptionsFor(isGuest)} aria-label="Sort" />
      </div>
    </div>
  );
}
