import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { LogEmptyState } from './LogEmptyState';

// Pins two D4 rulings:
//  1. Copy: the description no longer invites "pick a week" (the placeholder
//     body can't respond to that), and states what the week control above
//     actually does instead.
//  2. Layout: the card lays its content out left-aligned, not centered — a
//     regression to the shared `EmptyState` primitive's `items-center`/
//     `text-center` would fail the alignment assertion below.
describe('LogEmptyState', () => {
  it('states the honest week-copy — no "pick a week" invitation', () => {
    render(<LogEmptyState />);
    expect(screen.getByText("The week's record lands here")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Next up: the weekly grid.*The week above sets where new drops are logged; History has the full record\./,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/pick a week/i)).not.toBeInTheDocument();
  });

  it('left-aligns its content — not centered like the shared EmptyState default', () => {
    render(<LogEmptyState />);
    const card = screen.getByTestId('log-empty-state');
    expect(card.className).toContain('items-start');
    expect(card.className).not.toContain('items-center');
    expect(card.className).not.toContain('text-center');
  });
});
