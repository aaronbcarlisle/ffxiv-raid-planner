/**
 * DiscoveryTab tests
 *
 * Tests the discovery settings panel for static owners/leads.
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

  it('renders listing status and toggle', () => {
    render(<DiscoveryTab group={makeGroup()} onClose={onClose} />);

    expect(screen.getByText('List in Static Finder')).toBeInTheDocument();
    expect(screen.getByText(/Not listed — listing is off/)).toBeInTheDocument();
  });

  it('shows "listed" status when public + enabled', () => {
    const group = makeGroup({
      isPublic: true,
      settings: { discovery: { enabled: true, recruitmentStatus: 'open' } },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.getByText('Listed in Static Finder')).toBeInTheDocument();
  });

  it('shows warning when enabled but static is private', () => {
    const group = makeGroup({
      isPublic: false,
      settings: { discovery: { enabled: true, recruitmentStatus: 'open' } },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.getByText(/Not listed — static is private/)).toBeInTheDocument();
  });

  it('shows settings fields when enabled', () => {
    const group = makeGroup({
      settings: { discovery: { enabled: true, recruitmentStatus: 'open' } },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.getByText('Recruitment Status')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Contact Info')).toBeInTheDocument();
    expect(screen.getByText('Vibe')).toBeInTheDocument();
    expect(screen.getByText('Public Preview')).toBeInTheDocument();
  });

  it('shows section headings when enabled', () => {
    const group = makeGroup({
      settings: { discovery: { enabled: true, recruitmentStatus: 'open' } },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.getByText('About Your Static')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText("Who You're Looking For")).toBeInTheDocument();
    expect(screen.getByText('Raid Schedule')).toBeInTheDocument();
    expect(screen.getByText('Visibility')).toBeInTheDocument();
  });

  it('hides settings fields when disabled', () => {
    render(<DiscoveryTab group={makeGroup()} onClose={onClose} />);

    expect(screen.queryByText('Recruitment Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Description')).not.toBeInTheDocument();
  });

  it('shows fill from schedule button for owners', () => {
    const group = makeGroup({
      userRole: 'owner',
      settings: { discovery: { enabled: true, recruitmentStatus: 'open' } },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.getByText(/Fill from schedule/)).toBeInTheDocument();
    expect(screen.getByText(/Only fills empty fields/)).toBeInTheDocument();
  });

  it('renders privacy info banner', () => {
    render(<DiscoveryTab group={makeGroup()} onClose={onClose} />);

    expect(screen.getByText(/Your listing only shows the public details/)).toBeInTheDocument();
  });

  it('shows public data warning when enabled', () => {
    const group = makeGroup({
      settings: { discovery: { enabled: true, recruitmentStatus: 'open' } },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.getByText(/Description and contact info below are/)).toBeInTheDocument();
  });

  it('shows member count toggle', () => {
    const group = makeGroup({
      settings: { discovery: { enabled: true, recruitmentStatus: 'open' } },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.getByText('Show member count on listing')).toBeInTheDocument();
    expect(screen.getByText(/Helps applicants see how full/)).toBeInTheDocument();
  });

  it('shows Save and Cancel buttons', () => {
    render(<DiscoveryTab group={makeGroup()} onClose={onClose} />);

    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('Cancel button calls onClose', () => {
    render(<DiscoveryTab group={makeGroup()} onClose={onClose} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows contact input when method is selected', () => {
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

    expect(screen.getByPlaceholderText(/username#1234/)).toBeInTheDocument();
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

  it('renders listing preview when enabled', () => {
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

    expect(screen.getByText('Listing preview')).toBeInTheDocument();
    expect(screen.getByText(/This is exactly what players will see/)).toBeInTheDocument();
    // Description appears in both textarea and preview
    expect(screen.getAllByText('A test description').length).toBeGreaterThanOrEqual(1);
  });

  it('shows contact helper copy', () => {
    const group = makeGroup({
      settings: { discovery: { enabled: true, recruitmentStatus: 'open' } },
    });
    render(<DiscoveryTab group={group} onClose={onClose} />);

    expect(screen.getByText(/How should interested players reach you/)).toBeInTheDocument();
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

    // Preview should not show member count
    expect(screen.queryByText('5 members')).not.toBeInTheDocument();
  });
});
