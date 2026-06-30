/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { StaticGroup, StaticGroupListItem, TierSnapshot } from '../../types';

// Mock the GroupActions context so we can assert onTierChange fires via it,
// without standing up the whole <GroupActionModals> provider.
const mockActions = {
  onTierChange: vi.fn(),
  onAddPlayer: vi.fn(),
  onNewTier: vi.fn(),
  onRollover: vi.fn(),
  onDeleteTier: vi.fn(),
};
vi.mock('../../pages/groupActionsContext', () => ({
  useGroupActions: () => mockActions,
}));

// Mock permissions so canEdit is deterministic (the tier kebab is gated on it).
vi.mock('../../hooks/useStaticPermissions', () => ({
  useStaticPermissions: () => ({
    userRole: 'owner',
    isAdmin: false,
    isAdminAccess: false,
    isMember: true,
    canEdit: true,
    canManageInvitations: true,
  }),
}));

import { TopBar } from './TopBar';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useTierStore } from '../../stores/tierStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';

const currentGroup = { id: 'g1', shareCode: 'ABC', name: 'Alpha Static', userRole: 'owner' } as unknown as StaticGroup;
const groups: StaticGroupListItem[] = [
  { id: 'g1', shareCode: 'ABC', name: 'Alpha Static', userRole: 'owner' } as unknown as StaticGroupListItem,
];
// cruiserweight is the *selected* tier; heavyweight is the gamedata "current" tier,
// so heavyweight renders as a top-level dropdown item (not in the Previous submenu).
const tiers = [
  { id: 't-hw', tierId: 'aac-heavyweight', isActive: true } as unknown as TierSnapshot,
  { id: 't-cw', tierId: 'aac-cruiserweight', isActive: false } as unknown as TierSnapshot,
];
const currentTier = tiers[1];

beforeEach(() => {
  mockActions.onTierChange.mockClear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }))
  );
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', { configurable: true, value: () => false });
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() });

  useStaticGroupStore.setState({ currentGroup, groups });
  useTierStore.setState({ tiers, currentTier });
  useLootTrackingStore.setState({ currentWeek: 3, maxWeek: 5 });
});

function renderTopBar(onOpenPalette = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/group/ABC?shell=v2']}>
      <TopBar onOpenPalette={onOpenPalette} />
    </MemoryRouter>
  );
}

describe('TopBar', () => {
  it('renders the static picker and the tier picker', () => {
    renderTopBar();
    expect(screen.getByText('Alpha Static')).toBeInTheDocument();
    expect(screen.getByText('AAC Cruiserweight (Savage)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch static' })).toBeInTheDocument();
  });

  it('shows the week indicator as a read-only label (no navigation buttons)', () => {
    renderTopBar();
    // Week label is display-only — currentWeek must NOT be mutated from here.
    // Full week navigation belongs to F6d (the Loot slice / week-clock owner).
    expect(screen.getByText('Week 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /previous week/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /next week/i })).toBeNull();
  });

  it('fires onTierChange via the GroupActions context when a tier is selected', async () => {
    renderTopBar();
    const trigger = screen.getByText('AAC Cruiserweight (Savage)').closest('button')!;
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const item = await screen.findByText('AAC Heavyweight (Savage)');
    fireEvent.click(item);
    expect(mockActions.onTierChange).toHaveBeenCalledWith('aac-heavyweight');
  });

  it('renders the tier actions kebab (canEdit) and the affordance placeholders', () => {
    renderTopBar();
    expect(screen.getByRole('button', { name: 'Tier actions menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Command palette' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
  });

  it('opens the command palette via the ⌘K affordance', () => {
    const onOpenPalette = vi.fn();
    renderTopBar(onOpenPalette);
    fireEvent.click(screen.getByRole('button', { name: 'Command palette' }));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });
});
