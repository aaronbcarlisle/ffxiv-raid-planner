/**
 * FinderNudge — R-SF-P "Nudge": template/jobs/both/none, each LinkText
 * navigates, and `viewer: null` (a guest) renders nothing.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FinderNudge } from './FinderNudge';
import type { FitViewer } from './types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

function viewer(overrides: Partial<FitViewer> = {}): FitViewer {
  return { mainJob: 'DRG', mainRole: 'melee', missing: [], ...overrides };
}

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('FinderNudge', () => {
  it('missing ["template"]: the typical-week line, and its LinkText navigates', () => {
    render(<FinderNudge viewer={viewer({ missing: ['template'] })} />);
    expect(screen.getByText('Add your typical week on the Hub to match raid times.')).toBeInTheDocument();
    expect(screen.queryByText('Add your jobs on the Hub to match open roles.')).toBeNull();
    fireEvent.click(screen.getByText('Set your typical week'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile?tab=availability');
  });

  it('missing ["jobs"]: the jobs line, and its LinkText navigates', () => {
    render(<FinderNudge viewer={viewer({ missing: ['jobs'] })} />);
    expect(screen.getByText('Add your jobs on the Hub to match open roles.')).toBeInTheDocument();
    expect(screen.queryByText('Add your typical week on the Hub to match raid times.')).toBeNull();
    fireEvent.click(screen.getByText('Add jobs'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile?tab=characters');
  });

  it('both missing: both lines render', () => {
    render(<FinderNudge viewer={viewer({ missing: ['template', 'jobs'] })} />);
    expect(screen.getByText('Add your typical week on the Hub to match raid times.')).toBeInTheDocument();
    expect(screen.getByText('Add your jobs on the Hub to match open roles.')).toBeInTheDocument();
  });

  it('neither missing: renders nothing', () => {
    render(<FinderNudge viewer={viewer({ missing: [] })} />);
    expect(screen.queryByTestId('finder-nudge')).toBeNull();
  });

  it('viewer null (a guest): renders nothing', () => {
    render(<FinderNudge viewer={null} />);
    expect(screen.queryByTestId('finder-nudge')).toBeNull();
  });
});
