import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HubOverview } from './HubOverview';

vi.mock('./YourStaticsCard', () => ({
  YourStaticsCard: () => <div data-testid="your-statics-card" />,
}));
vi.mock('./HubSideCards', () => ({
  HubSideCards: () => (
    <div data-testid="hub-side-cards">
      <div>Characters</div>
      <div>Your availability</div>
      <div>Profile setup</div>
    </div>
  ),
}));

const defaultProps = {
  profile: null,
  gearSnapshots: {},
  collectionSuggestions: [],
  staticSuggestions: [],
  groups: [],
  onOpenLinkModal: vi.fn(),
  onAddJob: vi.fn(),
  setTab: vi.fn(),
  onCreateStatic: vi.fn(),
};

describe('HubOverview', () => {
  it('renders the hub-overview testid', () => {
    render(<MemoryRouter><HubOverview {...defaultProps} /></MemoryRouter>);
    expect(screen.getByTestId('hub-overview')).toBeInTheDocument();
  });

  it('Your statics spans two columns (col-span-2) and side stack is present', () => {
    render(<MemoryRouter><HubOverview {...defaultProps} /></MemoryRouter>);
    const statics = screen.getByTestId('your-statics-card').parentElement!;
    expect(statics.className).toMatch(/col-span-2/);
    expect(screen.getByTestId('hub-side-cards')).toBeInTheDocument();
  });

  it('side stack contains Characters, Your availability, and Profile setup sections', () => {
    render(<MemoryRouter><HubOverview {...defaultProps} /></MemoryRouter>);
    const side = screen.getByTestId('hub-side-cards');
    expect(side).toHaveTextContent('Characters');
    expect(side).toHaveTextContent('Your availability');
    expect(side).toHaveTextContent('Profile setup');
  });

  it('does not render Needs you, Profile status, Raider Snapshot or Activity', () => {
    render(<MemoryRouter><HubOverview {...defaultProps} /></MemoryRouter>);
    expect(screen.queryByText(/needs you/i)).toBeNull();
    expect(screen.queryByText(/profile status/i)).toBeNull();
    expect(screen.queryByText(/raider snapshot/i)).toBeNull();
    expect(screen.queryByText(/activity/i)).toBeNull();
  });
});
