/**
 * FinderFilters — the Static Finder's filter column (R-SF-N).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FinderFilters } from './FinderFilters';
import type { FinderSetters, FinderState } from './useFinderQuery';
import type { FitViewer } from './types';

function makeState(overrides: Partial<FinderState> = {}): FinderState {
  return {
    q: '', sort: 'best', asRole: '', dayGroup: '', goalCategory: [],
    scheduleOverlap: false, hideGoalConflicts: false, job: '', recruitmentStatus: '',
    intensity: '', dataCenter: '', server: '', timezone: '', language: '',
    ...overrides,
  };
}

function Harness({
  initial = {},
  viewer = null,
  isGuest = false,
  moreFiltersInitiallyOpen = false,
  clearFilters = vi.fn(),
  onStateChange,
}: {
  initial?: Partial<FinderState>;
  viewer?: FitViewer | null;
  isGuest?: boolean;
  moreFiltersInitiallyOpen?: boolean;
  clearFilters?: () => void;
  onStateChange?: (state: FinderState) => void;
}) {
  const [state, setState] = useState<FinderState>(() => makeState(initial));
  useEffect(() => { onStateChange?.(state); });

  const patch = (p: Partial<FinderState>) => setState(s => ({ ...s, ...p }));
  const setters: FinderSetters = {
    setQ: (v) => patch({ q: v }),
    setSort: (v) => patch({ sort: v }),
    setAsRole: (v) => patch({ asRole: v }),
    setDayGroup: (v) => patch({ dayGroup: v }),
    setGoalCategory: (v) => patch({ goalCategory: v }),
    setScheduleOverlap: (v) => patch({ scheduleOverlap: v }),
    setHideGoalConflicts: (v) => patch({ hideGoalConflicts: v }),
    setJob: (v) => patch({ job: v }),
    setRecruitmentStatus: (v) => patch({ recruitmentStatus: v }),
    setIntensity: (v) => patch({ intensity: v }),
    setDataCenter: (v) => patch({ dataCenter: v, server: '' }),
    setServer: (v) => patch({ server: v }),
    setTimezone: (v) => patch({ timezone: v }),
    setLanguage: (v) => patch({ language: v }),
  };
  const hasFilters = !!(
    state.asRole || state.dayGroup || state.goalCategory.length || state.scheduleOverlap ||
    state.hideGoalConflicts || state.job || state.recruitmentStatus || state.intensity ||
    state.dataCenter || state.server || state.timezone || state.language
  );

  return (
    <FinderFilters
      state={state}
      setters={setters}
      viewer={viewer}
      isGuest={isGuest}
      hasFilters={hasFilters}
      clearFilters={clearFilters}
      moreFiltersInitiallyOpen={moreFiltersInitiallyOpen}
    />
  );
}

/** Click a Checkbox by its visible label text (the label wraps the control). */
function clickCheckboxLabel(text: string) {
  fireEvent.click(screen.getByText(text));
}

function checkboxControl(labelText: string) {
  const label = screen.getByText(labelText).closest('label');
  if (!label) throw new Error(`no <label> ancestor for "${labelText}"`);
  return within(label).getByRole('checkbox');
}

describe('FinderFilters', () => {
  it('the main role chip is pressed with the caption; another choice sets asRole and shows the reset link; clicking it again clears', () => {
    render(<Harness viewer={{ mainJob: 'DRG', mainRole: 'melee', missing: [] }} />);

    expect(screen.getByRole('button', { name: 'Melee' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Matching as your DRG')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tank' }));
    expect(screen.getByRole('button', { name: 'Tank' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Match as your DRG again/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tank' }));
    expect(screen.getByRole('button', { name: 'Tank' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Matching as your DRG')).toBeInTheDocument();
  });

  it('clicking the pressed main role chip is a no-op — never sets asRole to the main role (PR-review fix wave item 4)', () => {
    let latest: FinderState | undefined;
    render(<Harness viewer={{ mainJob: 'DRG', mainRole: 'melee', missing: [] }} onStateChange={(s) => { latest = s; }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Melee' }));
    expect(latest?.asRole).toBe('');
    expect(screen.getByRole('button', { name: 'Melee' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/Match as your DRG again/)).toBeNull();
  });

  it('clicking an explicit non-main chip again clears back to the main role (PR-review fix wave item 4)', () => {
    let latest: FinderState | undefined;
    render(<Harness viewer={{ mainJob: 'DRG', mainRole: 'melee', missing: [] }} onStateChange={(s) => { latest = s; }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tank' }));
    expect(latest?.asRole).toBe('tank');
    fireEvent.click(screen.getByRole('button', { name: 'Tank' }));
    expect(latest?.asRole).toBe('');
    expect(screen.getByRole('button', { name: 'Melee' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('content checkboxes build the goalCategory CSV', () => {
    let latest: FinderState | undefined;
    render(<Harness onStateChange={(s) => { latest = s; }} />);

    clickCheckboxLabel('Savage — BiS');
    clickCheckboxLabel('Ultimate — Clear');

    expect(latest?.goalCategory.slice().sort()).toEqual(['savage_bis', 'ultimate_clear'].sort());
  });

  it('Fits my typical week and Hide goal conflicts toggle their own state', () => {
    let latest: FinderState | undefined;
    render(<Harness viewer={{ mainJob: null, mainRole: null, missing: [] }} onStateChange={(s) => { latest = s; }} />);

    clickCheckboxLabel('Fits my typical week');
    expect(latest?.scheduleOverlap).toBe(true);

    clickCheckboxLabel('Hide goal conflicts');
    expect(latest?.hideGoalConflicts).toBe(true);
  });

  it('Weeknights and Weekends are exclusive toggles', () => {
    let latest: FinderState | undefined;
    render(<Harness onStateChange={(s) => { latest = s; }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Weeknights' }));
    expect(latest?.dayGroup).toBe('weeknights');

    fireEvent.click(screen.getByRole('button', { name: 'Weekends' }));
    expect(latest?.dayGroup).toBe('weekends');

    fireEvent.click(screen.getByRole('button', { name: 'Weekends' }));
    expect(latest?.dayGroup).toBe('');
  });

  it('Vibe chips are exclusive', () => {
    let latest: FinderState | undefined;
    render(<Harness onStateChange={(s) => { latest = s; }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Casual' }));
    expect(latest?.intensity).toBe('casual');

    fireEvent.click(screen.getByRole('button', { name: 'Hardcore' }));
    expect(latest?.intensity).toBe('hardcore');
  });

  it('More filters starts collapsed (aria-expanded="false") and expands to reveal the extra selects', () => {
    render(<Harness />);
    const toggle = screen.getByText('More filters');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Job')).toBeNull();

    fireEvent.click(toggle);
    expect(screen.getByText('Fewer filters')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Job')).toBeInTheDocument();
    expect(screen.getByLabelText('Recruitment status')).toBeInTheDocument();
    expect(screen.getByLabelText('Data center')).toBeInTheDocument();
    expect(screen.getByLabelText('Server')).toBeInTheDocument();
    expect(screen.getByLabelText('Timezone')).toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
  });

  it('More filters starts expanded when moreFiltersInitiallyOpen is true (m8)', () => {
    render(<Harness moreFiltersInitiallyOpen={true} />);
    expect(screen.getByText('Fewer filters')).toHaveAttribute('aria-expanded', 'true');
  });

  it('Clear all appears only once a filter is set, and calls clearFilters', () => {
    const clearFilters = vi.fn();
    render(<Harness clearFilters={clearFilters} />);
    expect(screen.queryByText('Clear all')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Casual' }));
    expect(screen.getByText('Clear all')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear all'));
    expect(clearFilters).toHaveBeenCalledTimes(1);
  });

  it('with viewer.missing including template, Fits my typical week is disabled with its caption (m10)', () => {
    render(<Harness viewer={{ mainJob: null, mainRole: null, missing: ['template'] }} />);
    expect(checkboxControl('Fits my typical week')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Set your typical week on the Hub to use this.')).toBeInTheDocument();
  });

  it('guest branch: no role chips and no fit checkboxes; Weeknights/Weekends stay available', () => {
    render(<Harness isGuest={true} viewer={null} />);
    expect(screen.queryByRole('button', { name: 'Tank' })).toBeNull();
    expect(screen.queryByText('Fits my typical week')).toBeNull();
    expect(screen.queryByText('Hide goal conflicts')).toBeNull();
    expect(screen.getByRole('button', { name: 'Weeknights' })).toBeInTheDocument();
  });
});
