import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ data: { trials: [{ trialId: 'Lunar Whale', totalMembers: 8, membersComplete: 3 }] } as unknown }));
vi.mock('../../stores/mountFarmStore', () => ({ useMountFarmStore: (s: (x: { data: unknown }) => unknown) => s({ data: mocks.data }) }));

import { TrackCard } from './TrackCard';

describe('TrackCard', () => {
  beforeEach(() => {
    mocks.data = { trials: [{ trialId: 'Lunar Whale', totalMembers: 8, membersComplete: 3 }] };
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
