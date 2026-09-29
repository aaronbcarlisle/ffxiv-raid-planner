/**
 * ReasonRows — the reason-row list extracted from FinderCard (R-RH-K).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ReasonRows } from './ReasonRows';
import type { FitNight, FitReason } from './types';

describe('ReasonRows', () => {
  it('renders reason text in API order', () => {
    const reasons: FitReason[] = [
      { kind: 'comms', status: 'match', params: {} },
      { kind: 'bis', status: 'partial', params: {} },
    ];
    render(<ReasonRows reasons={reasons} nights={[]} />);
    const texts = screen.getAllByText(/Comms match|Your BiS is partly set/).map(el => el.textContent);
    expect(texts).toEqual(['Comms match', 'Your BiS is partly set']);
  });

  it('skips a reason whose text builder returns null (unrecognized kind)', () => {
    const reasons = [{ kind: 'unknown', status: 'match', params: {} }] as unknown as FitReason[];
    const { container } = render(<ReasonRows reasons={reasons} nights={[]} />);
    expect(container.querySelectorAll('div').length).toBe(0);
  });

  it('subject="they" renders third-person copy', () => {
    const reasons: FitReason[] = [{ kind: 'bis', status: 'match', params: {} }];
    render(<ReasonRows reasons={reasons} nights={[]} subject="they" />);
    expect(screen.getByText('Their BiS is ready to share')).toBeInTheDocument();
  });

  it('a match reason renders the success icon with the status aria-label', () => {
    const reasons: FitReason[] = [{ kind: 'comms', status: 'match', params: {} }];
    render(<ReasonRows reasons={reasons} nights={[]} />);
    const icon = screen.getByLabelText('match');
    expect(icon.getAttribute('class')).toMatch(/status-success/);
  });

  it('renders schedule reason text using the supplied nights', () => {
    const reasons: FitReason[] = [{ kind: 'schedule', status: 'conflict', params: { basis: 'time' } }];
    const nights: FitNight[] = [{ day: 'FR', localDay: 'FR', localStart: '20:00', localEnd: '23:00', coverage: 'none' }];
    const { container } = render(<ReasonRows reasons={reasons} nights={nights} />);
    expect(within(container).getByText('Fri 8:00 PM–11:00 PM busy')).toBeInTheDocument();
  });
});
