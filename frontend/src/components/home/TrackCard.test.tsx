import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Real trial slug — getTrialById('dt-valigarmanda') resolves dutyName
// 'Worqor Lar Dor (Extreme)'. Using a real id (not a fabricated friendly one)
// proves the slug → human-name resolution path renders as the card title.
const mocks = vi.hoisted(() => ({ data: { trials: [{ trialId: 'dt-valigarmanda', totalMembers: 8, membersComplete: 3 }] } as unknown }));
vi.mock('../../stores/mountFarmStore', () => ({ useMountFarmStore: (s: (x: { data: unknown }) => unknown) => s({ data: mocks.data }) }));

import { TrackCard } from './TrackCard';

describe('TrackCard', () => {
  beforeEach(() => {
    mocks.data = { trials: [{ trialId: 'dt-valigarmanda', totalMembers: 8, membersComplete: 3 }] };
  });

  it('resolves the human track name from the slug as the title', () => {
    render(<TrackCard />);
    // 'dt-valigarmanda' → 'Worqor Lar Dor (Extreme)'; the slug must NOT appear.
    expect(screen.getByText('Worqor Lar Dor (Extreme)')).toBeInTheDocument();
    expect(screen.queryByText('dt-valigarmanda')).toBeNull();
  });

  it('renders the track summary, display-only (no link/button)', () => {
    render(<TrackCard />);
    expect(screen.getByText(/3 of 8 have it/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders the Ring 3 label chip', () => {
    render(<TrackCard />);
    expect(screen.getByText('Ring 3')).toBeInTheDocument();
  });

  it('renders nothing when data is null', () => {
    mocks.data = null;
    const { container } = render(<TrackCard />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when trials array is empty', () => {
    mocks.data = { trials: [] };
    const { container } = render(<TrackCard />);
    expect(container.firstChild).toBeNull();
  });
});
