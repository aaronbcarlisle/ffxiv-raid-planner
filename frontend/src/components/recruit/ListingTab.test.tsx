/**
 * ListingTab — RH1d, R-RH-L. The status card's Live/Hidden text, no status
 * `Select` on the card, `DiscoveryTab` receives the group and its `onClose`
 * switches the page back to Applicants.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ListingTab } from './ListingTab';
import type { DiscoverySettings, StaticGroup } from '../../types';

const mocks = vi.hoisted(() => ({
  applicants: null as { groupId: string; items: unknown[]; pendingCount: number } | null,
  discoveryTabProps: null as Record<string, unknown> | null,
}));

vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: (sel: (s: Record<string, unknown>) => unknown) => sel({ applicants: mocks.applicants }),
}));

vi.mock('../settings/DiscoveryTab', () => ({
  DiscoveryTab: (props: Record<string, unknown>) => {
    mocks.discoveryTabProps = props;
    return <div data-testid="discovery-tab" />;
  },
}));

function group(discovery: Partial<DiscoverySettings> | undefined, extra: Partial<StaticGroup> = {}): StaticGroup {
  const full: DiscoverySettings | undefined = discovery
    ? { enabled: false, recruitmentStatus: 'open', ...discovery }
    : undefined;
  return {
    id: 'g1', name: 'Test Static', shareCode: 'abc', isPublic: true, ownerId: 'u1',
    memberCount: 8, settings: full ? { discovery: full } : {},
    ...extra,
  } as StaticGroup;
}

describe('ListingTab status card', () => {
  it('live with waiting applicants: "Live · N waiting"', () => {
    mocks.applicants = { groupId: 'g1', items: [], pendingCount: 2 };
    render(<ListingTab group={group({ enabled: true })} onTabChange={vi.fn()} />);
    expect(screen.getByText('Live · 2 waiting')).toBeInTheDocument();
  });

  it('live with none waiting: just "Live"', () => {
    mocks.applicants = { groupId: 'g1', items: [], pendingCount: 0 };
    render(<ListingTab group={group({ enabled: true })} onTabChange={vi.fn()} />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('hidden (not public): "Hidden · listing off", regardless of pending count', () => {
    mocks.applicants = { groupId: 'g1', items: [], pendingCount: 3 };
    render(<ListingTab group={group({ enabled: true }, { isPublic: false })} onTabChange={vi.fn()} />);
    expect(screen.getByText('Hidden · listing off')).toBeInTheDocument();
  });

  it('hidden (discovery disabled): "Hidden · listing off"', () => {
    mocks.applicants = null;
    render(<ListingTab group={group({ enabled: false })} onTabChange={vi.fn()} />);
    expect(screen.getByText('Hidden · listing off')).toBeInTheDocument();
  });

  it('a stale applicants slice for another static reads as 0 waiting', () => {
    mocks.applicants = { groupId: 'other', items: [], pendingCount: 9 };
    render(<ListingTab group={group({ enabled: true })} onTabChange={vi.fn()} />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('renders no status Select, checklist, preview or fill-button controls of its own', () => {
    mocks.applicants = { groupId: 'g1', items: [], pendingCount: 0 };
    render(<ListingTab group={group({ enabled: true })} onTabChange={vi.fn()} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button', { name: /fill/i })).toBeNull();
  });
});

describe('ListingTab → DiscoveryTab hand-off', () => {
  it('passes the group through to DiscoveryTab', () => {
    mocks.applicants = null;
    const g = group({ enabled: true });
    render(<ListingTab group={g} onTabChange={vi.fn()} />);
    expect(mocks.discoveryTabProps?.group).toBe(g);
  });

  it('DiscoveryTab\'s onClose switches the page tab back to Applicants', () => {
    mocks.applicants = null;
    const onTabChange = vi.fn();
    render(<ListingTab group={group({ enabled: true })} onTabChange={onTabChange} />);
    (mocks.discoveryTabProps?.onClose as () => void)();
    expect(onTabChange).toHaveBeenCalledWith('applicants');
  });
});
