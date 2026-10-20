/**
 * Roster — the Progress jump's scroll on the Board (S2a-3b·H3b, E-9, R-T-9).
 *
 * `GroupViewContent` scrolls `player-card-{id}` 100 ms after `?player=` changes. A jump from
 * Progress has not mounted this Roster by then (measured live: the Board's row lands ~300 ms
 * in), so that scroll finds nothing; Roster's own post-commit effect polls for the row. Kept
 * apart from `Roster.test.tsx` (its wiring mocks, trimmed to the Board's needs). The Cards
 * view's scroll stays `GroupViewContent`'s alone.
 */
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SnapshotPlayer, StaticGroup, TierSnapshot } from '../../types';

vi.mock('../../hooks/useGroupViewState', () => ({
  useGroupViewState: () => ({
    searchParams: new URLSearchParams(),
    groupView: true,
    setGroupView: vi.fn(),
    subsView: true,
    setSubsView: vi.fn(),
    sortPreset: 'standard',
    setSortPreset: vi.fn(),
    setSortPresetState: vi.fn(),
    setEditingPlayerId: vi.fn(),
    clipboardPlayer: null,
    setClipboardPlayer: vi.fn(),
  }),
}));
vi.mock('../../hooks/usePlayerActions', () => ({ usePlayerActions: () => new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: string; isAdmin: boolean } }) => unknown) => selector({ user: { id: 'u1', isAdmin: false } }),
}));
vi.mock('../../stores/viewAsStore', () => ({
  useViewAsStore: (selector: (s: { viewAsUser: null }) => unknown) => selector({ viewAsUser: null }),
}));
vi.mock('../../pages/groupActionsContext', () => ({
  useGroupActionModalOpen: () => false,
  useGroupActions: () => ({ onTierChange: vi.fn(), onAddPlayer: vi.fn(), onNewTier: vi.fn(), onRollover: vi.fn(), onDeleteTier: vi.fn() }),
}));
vi.mock('./CharacterManageBridge', () => ({ CharacterManageBridge: () => null }));

import { Roster } from './Roster';
import { TooltipProvider } from '../primitives';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const player = (id: string, name: string, position: string) =>
  ({
    id, tierSnapshotId: 't1', name, job: 'PLD', role: 'tank', position, configured: true, sortOrder: 0, isSubstitute: false,
    gear: [{ slot: 'body', bisSource: 'raid', hasItem: false, isAugmented: false }],
    tomeWeapon: {}, weaponPriorities: [], weaponPrioritiesLocked: false, createdAt: '', updatedAt: '',
  }) as unknown as SnapshotPlayer;

const group = { id: 'g1', name: 'Test Static', userRole: 'owner', isAdminAccess: false } as unknown as StaticGroup;
const tier = { tierId: 't1', contentType: 'savage', players: [player('p1', 'Tank One', 'T1'), player('p2', 'Tank Two', 'T2')] } as unknown as TierSnapshot;

function renderAt(url: string) {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[url]}>
        <Roster group={group} canManage tier={tier} onNavigate={vi.fn()} onOpenRequests={vi.fn()} />
      </MemoryRouter>
    </TooltipProvider>,
  );
}

let realScroll: typeof Element.prototype.scrollIntoView;
let scrolled: string[];

beforeEach(() => {
  localStorage.clear();
  scrolled = [];
  realScroll = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.id);
  };
  useLootTrackingStore.setState({
    lootLog: [], materialLog: [], currentWeek: 1,
    fetchLootLog: vi.fn().mockResolvedValue(undefined),
    fetchMaterialLog: vi.fn().mockResolvedValue(undefined),
    fetchCurrentWeek: vi.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => {
  Element.prototype.scrollIntoView = realScroll;
});

describe('Roster — the Board scrolls to the jumped-to row', () => {
  it('scrolls that player\'s row into view on the Board', () => {
    const { container } = renderAt('/group/DEVTST?tab=roster&rview=board&player=p2');
    expect(container.querySelector('tr#player-card-p2')).not.toBeNull();
    expect(scrolled).toContain('player-card-p2');
    expect(scrolled).not.toContain('player-card-p1');
  });

  it('scrolls nothing without a ?player=', () => {
    renderAt('/group/DEVTST?tab=roster&rview=board');
    expect(scrolled).toEqual([]);
  });

  it('leaves the Cards view\'s scroll to GroupViewContent', () => {
    renderAt('/group/DEVTST?tab=roster&player=p2');
    expect(scrolled).toEqual([]);
  });
});
