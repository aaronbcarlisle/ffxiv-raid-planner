/**
 * FinderSummary — the match-count headline plus the sort `Select` (R-SF-P).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinderSummary, summaryText, summarySubline, sortOptionsFor } from './FinderSummary';
import type { FitCounts, FitViewer } from './types';

function counts(overrides: Partial<FitCounts> = {}): FitCounts {
  return { strong: 0, good: 0, partial: 0, weak: 0, unknown: 0, ...overrides };
}

describe('summaryText', () => {
  it('with fitCounts {strong:2, good:1, ...} and total 7, reads "3 of 7 statics are a good fit for you as a melee DPS"', () => {
    const text = summaryText(counts({ strong: 2, good: 1, partial: 1, weak: 3 }), 7, 'melee');
    expect(text).toBe('3 of 7 statics are a good fit for you as a melee DPS');
  });

  it('with n == 0, reads the no-match string', () => {
    const text = summaryText(counts({ partial: 2, weak: 3 }), 5, 'tank');
    expect(text).toBe('No strong matches yet — try another role or loosen your filters.');
  });

  it('guest (no fitCounts): "{total} statics", singular for 1', () => {
    expect(summaryText(null, 5, null)).toBe('5 statics');
    expect(summaryText(null, 1, null)).toBe('1 static');
  });

  it('total === 0 reads "0 statics", not the no-match string (whole-branch review item 6)', () => {
    expect(summaryText(counts(), 0, 'tank')).toBe('0 statics');
  });
});

describe('summarySubline', () => {
  it('shows with Best match and a template', () => {
    const viewer: FitViewer = { mainJob: 'DRG', mainRole: 'melee', missing: [] };
    expect(summarySubline('best', viewer, false)).toBe('Ranked by fit · uses your Player Hub typical week');
  });

  it('does not show without a template', () => {
    const viewer: FitViewer = { mainJob: null, mainRole: null, missing: ['template'] };
    expect(summarySubline('best', viewer, false)).toBeNull();
  });

  it('does not show for a sort other than best', () => {
    const viewer: FitViewer = { mainJob: 'DRG', mainRole: 'melee', missing: [] };
    expect(summarySubline('recent', viewer, false)).toBeNull();
  });

  it('does not show for a guest, even if sort somehow reads "best" (item 1, PR-review fix wave)', () => {
    const viewer: FitViewer = { mainJob: 'DRG', mainRole: 'melee', missing: [] };
    expect(summarySubline('best', viewer, true)).toBeNull();
  });
});

describe('sortOptionsFor', () => {
  it('signed-in gets four options defaulting to Best match', () => {
    const options = sortOptionsFor(false);
    expect(options.map(o => o.value)).toEqual(['best', 'recent', 'members', 'name']);
  });

  it('guest gets three options, no Best match', () => {
    const options = sortOptionsFor(true);
    expect(options.map(o => o.value)).toEqual(['recent', 'members', 'name']);
  });
});

describe('<FinderSummary>', () => {
  it('renders the sort Select defaulting to the given value', () => {
    render(
      <FinderSummary
        total={7}
        fitCounts={counts({ strong: 2, good: 1 })}
        viewer={{ mainJob: 'DRG', mainRole: 'melee', missing: [] }}
        asRole=""
        sort="best"
        onSortChange={vi.fn()}
        isGuest={false}
      />,
    );
    expect(screen.getByText('3 of 7 statics are a good fit for you as a melee DPS')).toBeInTheDocument();
    expect(screen.getByText('Ranked by fit · uses your Player Hub typical week')).toBeInTheDocument();
    expect(screen.getByText('Best match')).toBeInTheDocument();
  });
});
