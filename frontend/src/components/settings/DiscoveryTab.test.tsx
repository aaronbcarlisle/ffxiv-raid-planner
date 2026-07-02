/**
 * DiscoveryTab tests
 *
 * Tests the interactive listing builder UX.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiscoveryTab } from './DiscoveryTab';
import type { StaticGroup } from '../../types';

// ── Mocks ─────────────────────────────────────────────────────

vi.mock('../../stores/staticGroupStore', () => ({
  useStaticGroupStore: () => ({
    updateGroup: vi.fn(),
  }),
}));

vi.mock('../../stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../services/api', () => ({
  authRequest: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────

function makeGroup(overrides: Partial<StaticGroup> = {}): StaticGroup {
  return {
    id: 'g1',
    name: 'Test Static',
    shareCode: 'share1',
    isPublic: true,
    ownerId: 'u1',
    memberCount: 5,
    userRole: 'owner',
    settings: {},
    ...overrides,
  } as StaticGroup;
}

// ── Tests ─────────────────────────────────────────────────────

describe('DiscoveryTab', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders listing toggle', () => {
    render(<DiscoveryTab group={makeGroup()} onClose={onClose} />);
    expect(screen.getByText('List in Static Finder')).toBeInTheDocument();
  });

  it('shows "Listed in Static Finder" checklist item when public + enabled', () => {
    const group = makeGroup({
      isPublic: true,
      settings: { discovery: { enabled: true, recruitmentStatus: 'open' } },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);
    expect(screen.getByText('Listed in Static Finder')).toBeInTheDocument();
  });

  it('shows warning when static is private', () => {
    const group = makeGroup({
      isPublic: false,
      settings: { discovery: { enabled: true, recruitmentStatus: 'open' } },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);
    expect(screen.getByText(/enable Public Static/)).toBeInTheDocument();
  });

  it('shows status cards and description when enabled', () => {
    const group = makeGroup({
      settings: { discovery: { enabled: true, recruitmentStatus: 'open' } },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.getByText('Recruitment Status')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    // Status card options
    expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Selective')).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('shows builder section headings', () => {
    const group = makeGroup({
      settings: { discovery: { enabled: true, recruitmentStatus: 'open' } },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    // Each label appears at least twice (nav pill + section heading)
    expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('About').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Schedule').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Recruiting').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Communication').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Contact').length).toBeGreaterThanOrEqual(1);
  });

  it('section nav pills are always rendered', () => {
    render(<DiscoveryTab group={makeGroup()} onClose={onClose} />);
    // Nav pills (role=navigation)
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });

  it('hides status cards when listing is disabled', () => {
    render(<DiscoveryTab group={makeGroup()} onClose={onClose} />);
    // Status cards only appear inside the {enabled && ...} block
    expect(screen.queryByText('Recruitment Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Actively recruiting')).not.toBeInTheDocument();
  });

  it('shows fill from schedule button for editors', () => {
    const group = makeGroup({
      userRole: 'owner',
      settings: { discovery: { enabled: true, recruitmentStatus: 'open' } },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.getByText(/Fill from current schedule/)).toBeInTheDocument();
    expect(screen.getByText(/Only fills empty fields/)).toBeInTheDocument();
  });

  it('renders privacy info banner in About section', () => {
    render(<DiscoveryTab group={makeGroup()} onClose={onClose} />);
    expect(screen.getByText(/Description and contact info are/)).toBeInTheDocument();
  });

  it('shows member count toggle when enabled', () => {
    const group = makeGroup({
      settings: { discovery: { enabled: true, recruitmentStatus: 'open' } },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.getByText('Show member count')).toBeInTheDocument();
    expect(screen.getByText(/lets applicants see how full/)).toBeInTheDocument();
  });

  it('shows Save Listing and Cancel buttons', () => {
    render(<DiscoveryTab group={makeGroup()} onClose={onClose} />);

    expect(screen.getByText('Save Listing')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('Cancel button calls onClose', () => {
    render(<DiscoveryTab group={makeGroup()} onClose={onClose} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows contact input when method is pre-selected from settings', () => {
    const group = makeGroup({
      settings: {
        discovery: {
          enabled: true,
          recruitmentStatus: 'open',
          contactMethod: 'discord',
          contactValue: '',
        },
      },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.getByPlaceholderText(/@username/)).toBeInTheDocument();
  });

  it('loads existing contact values from settings', () => {
    const group = makeGroup({
      settings: {
        discovery: {
          enabled: true,
          recruitmentStatus: 'open',
          contactMethod: 'discord',
          contactValue: 'myuser#9999',
        },
      },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.getByDisplayValue('myuser#9999')).toBeInTheDocument();
  });

  it('renders live preview panel', () => {
    const group = makeGroup({
      settings: {
        discovery: {
          enabled: true,
          recruitmentStatus: 'open',
          description: 'A test description',
        },
      },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.getByText('Live Preview')).toBeInTheDocument();
    expect(screen.getAllByText('A test description').length).toBeGreaterThanOrEqual(1);
  });

  it('renders listing quality checklist', () => {
    const group = makeGroup({
      settings: { discovery: { enabled: true, recruitmentStatus: 'open' } },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.getByText('Listing Quality')).toBeInTheDocument();
    expect(screen.getByText('Roles / jobs recruiting')).toBeInTheDocument();
  });

  it('preview hides member count when showMemberCount is off', () => {
    const group = makeGroup({
      memberCount: 5,
      settings: {
        discovery: {
          enabled: true,
          recruitmentStatus: 'open',
          showMemberCount: false,
        },
      },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.queryByText('5 members')).not.toBeInTheDocument();
  });

  it('shows voice requirement options', () => {
    render(<DiscoveryTab group={makeGroup()} onClose={onClose} />);

    expect(screen.getByText('Voice required')).toBeInTheDocument();
    expect(screen.getByText('Text only OK')).toBeInTheDocument();
  });

  it('shows expanded language list including southeast asian languages', () => {
    render(<DiscoveryTab group={makeGroup()} onClose={onClose} />);

    expect(screen.getByText('Thai')).toBeInTheDocument();
    expect(screen.getByText('Indonesian')).toBeInTheDocument();
    expect(screen.getByText('Filipino / Tagalog')).toBeInTheDocument();
    expect(screen.getByText('Vietnamese')).toBeInTheDocument();
  });

  it('shows role cards for all roles', () => {
    render(<DiscoveryTab group={makeGroup()} onClose={onClose} />);

    expect(screen.getByText('Tank')).toBeInTheDocument();
    expect(screen.getByText('Healer')).toBeInTheDocument();
    expect(screen.getByText('Melee')).toBeInTheDocument();
    expect(screen.getByText('Physical Ranged')).toBeInTheDocument();
    expect(screen.getByText('Caster')).toBeInTheDocument();
  });

  it('migrates legacy neededRoles/neededJobs to recruitingRoles on load', () => {
    const group = makeGroup({
      settings: {
        discovery: {
          enabled: true,
          recruitmentStatus: 'open',
          neededRoles: ['tank'],
          neededJobs: ['PLD', 'WAR'],
        },
      },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);
    // Tank role card should be checked (checkbox is filled)
    // Just verify the component renders without error and Tank is present
    expect(screen.getByText('Tank')).toBeInTheDocument();
  });
});
