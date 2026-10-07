/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { StaticGroup, StaticGroupListItem, TierSnapshot, User } from '../../types';

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
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useAuthStore } from '../../stores/authStore';
import { ThemeProvider } from '../../hooks/useTheme';

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
  // Signed-in by default: the bell and gear are authed-only (GUEST-1 R-G1-4).
  // Guest and pre-hydration cases override this explicitly.
  useAuthStore.setState({ user: signedInUser, isLoading: false });
  // Prevent NotificationBell's join-count fetch from making real API calls.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useJoinRequestStore.setState({ fetchGroupRequests: vi.fn().mockResolvedValue(undefined) as any });
});

const signedInUser = { id: 'u1', discordId: 'd1', username: 'tester', isAdmin: false } as unknown as User;

function renderTopBar(
  onOpenPalette = vi.fn(),
  onOpenNotifications = vi.fn(),
  initialEntry = '/group/ABC',
) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <TopBar onOpenPalette={onOpenPalette} onOpenNotifications={onOpenNotifications} />
      </MemoryRouter>
    </ThemeProvider>
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

  it('renders the tier actions kebab (canEdit) and the wired affordances (bell, gear, theme, ⌘K)', () => {
    renderTopBar();
    expect(screen.getByRole('button', { name: 'Tier actions menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Command palette' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Notifications/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
  });

  it('opens the command palette via the ⌘K affordance', () => {
    const onOpenPalette = vi.fn();
    renderTopBar(onOpenPalette);
    fireEvent.click(screen.getByRole('button', { name: 'Command palette' }));
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });

  // A12: affordance order is ⌘K · invite · bell · theme · │ · settings — theme
  // joins the passive affordances; settings sits isolated after the divider.
  it('orders the affordances ⌘K · invite · bell · theme · divider · settings (A12)', () => {
    const { container } = renderTopBar();
    const palette = screen.getByRole('button', { name: 'Command palette' });
    const invite = screen.getByRole('button', { name: 'Invite members' });
    const bell = screen.getByRole('button', { name: /^Notifications/ });
    const theme = screen.getByRole('button', { name: 'Toggle theme' });
    const settings = screen.getByRole('button', { name: 'Settings' });
    const divider = container.querySelector('span.w-px');
    expect(divider).not.toBeNull();
    expect(divider).toHaveAttribute('aria-hidden');
    // compareDocumentPosition: if a precedes b, a.compareDocumentPosition(b)
    // carries DOCUMENT_POSITION_FOLLOWING (same pattern as AppRail.test.tsx).
    const precedes = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(precedes(palette, invite)).toBe(true);
    expect(precedes(invite, bell)).toBe(true);
    expect(precedes(bell, theme)).toBe(true);
    expect(precedes(theme, divider!)).toBe(true);
    expect(precedes(divider!, settings)).toBe(true);
  });

  // ── GUEST-1 R-G1-4: the auth slot and the authed-only bell/gear ───────────
  describe('auth gates (GUEST-1 R-G1-4)', () => {
    const precedes = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    it('guest (hydrated): Login in the header, no bell, no gear; ⌘K and theme stay', () => {
      useAuthStore.setState({ user: null, isLoading: false });
      renderTopBar();
      const header = screen.getByRole('banner');
      expect(within(header).getByRole('button', { name: 'Login with Discord' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Notifications/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
      expect(screen.queryByTestId('auth-skeleton')).toBeNull();
      expect(screen.getByRole('button', { name: 'Command palette' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
    });

    it('signed-in (pin): bell and gear present in A12 order, no Login, no skeleton', () => {
      renderTopBar();
      expect(screen.queryByRole('button', { name: 'Login with Discord' })).toBeNull();
      expect(screen.queryByTestId('auth-skeleton')).toBeNull();
      const bell = screen.getByRole('button', { name: /^Notifications/ });
      const theme = screen.getByRole('button', { name: 'Toggle theme' });
      const settings = screen.getByRole('button', { name: 'Settings' });
      expect(precedes(bell, theme)).toBe(true);
      expect(precedes(theme, settings)).toBe(true);
    });

    it('pre-hydration, no user: skeleton only (no Login, no bell, no gear)', () => {
      const spy = vi.spyOn(useAuthStore.persist, 'hasHydrated').mockReturnValue(false);
      try {
        useAuthStore.setState({ user: null, isLoading: false });
        renderTopBar();
        expect(screen.getByTestId('auth-skeleton')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Login with Discord' })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Notifications/ })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });

    it('isLoading, no user: skeleton only', () => {
      useAuthStore.setState({ user: null, isLoading: true });
      renderTopBar();
      expect(screen.getByTestId('auth-skeleton')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Login/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Notifications/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    });

    it('pre-hydration with a persisted user: bell and gear in A12 order, no skeleton, no Login', () => {
      const spy = vi.spyOn(useAuthStore.persist, 'hasHydrated').mockReturnValue(false);
      try {
        useAuthStore.setState({ user: signedInUser, isLoading: true });
        renderTopBar();
        expect(screen.queryByTestId('auth-skeleton')).toBeNull();
        expect(screen.queryByRole('button', { name: /Login/ })).toBeNull();
        const bell = screen.getByRole('button', { name: /^Notifications/ });
        const theme = screen.getByRole('button', { name: 'Toggle theme' });
        const settings = screen.getByRole('button', { name: 'Settings' });
        expect(precedes(bell, theme)).toBe(true);
        expect(precedes(theme, settings)).toBe(true);
      } finally {
        spy.mockRestore();
      }
    });

    it('guest Login click passes the rendered route path + search to login()', () => {
      const originalLogin = useAuthStore.getState().login;
      const login = vi.fn();
      try {
        useAuthStore.setState({ user: null, isLoading: false, login: login as unknown as typeof originalLogin });
        renderTopBar(vi.fn(), vi.fn(), '/group/ABC?tab=roster');
        fireEvent.click(screen.getByRole('button', { name: 'Login with Discord' }));
        expect(login).toHaveBeenCalledTimes(1);
        expect(login).toHaveBeenCalledWith('/group/ABC?tab=roster');
      } finally {
        useAuthStore.setState({ login: originalLogin });
      }
    });
  });
});
