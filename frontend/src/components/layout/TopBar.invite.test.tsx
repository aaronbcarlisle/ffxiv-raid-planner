/**
 * @vitest-environment jsdom
 *
 * TopBar invite affordance — fresh-audited port of legacy Header.tsx's
 * `handleInviteMembers` (Header.tsx:123-150). Covers:
 *   - active invitation present → copies the link, success toast, settings
 *     panel NOT opened
 *   - no active invitation → opens the recruitment/invitations settings
 *     section with the exact options, clipboard NOT written
 *   - clipboard rejection → error toast, no success toast (deliberate
 *     deviation from legacy: no document.execCommand fallback)
 *   - gate: button absent for a non-manager (member, non-admin)
 *   - invitations are fetched on mount when the user can manage them
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { StaticGroup, StaticGroupListItem, TierSnapshot, Invitation } from '../../types';

// Mock the GroupActions context so TierBreadcrumb (rendered by TopBar) doesn't
// need a real <GroupActionModals> provider — mirrors TopBar.test.tsx.
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

interface MockPermissions {
  userRole: string;
  isAdmin: boolean;
  isAdminAccess: boolean;
  isMember: boolean;
  canEdit: boolean;
  canManageInvitations: boolean;
}

const mockPermissions = vi.fn<() => MockPermissions>(() => ({
  userRole: 'owner',
  isAdmin: false,
  isAdminAccess: false,
  isMember: true,
  canEdit: true,
  canManageInvitations: true,
}));
vi.mock('../../hooks/useStaticPermissions', () => ({
  useStaticPermissions: () => mockPermissions(),
}));

vi.mock('../../stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { TopBar } from './TopBar';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useTierStore } from '../../stores/tierStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useInvitationStore } from '../../stores/invitationStore';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import { toast } from '../../stores/toastStore';
import { ThemeProvider } from '../../hooks/useTheme';

const currentGroup = { id: 'g1', shareCode: 'ABC', name: 'Alpha Static', userRole: 'owner' } as unknown as StaticGroup;
const groups: StaticGroupListItem[] = [
  { id: 'g1', shareCode: 'ABC', name: 'Alpha Static', userRole: 'owner' } as unknown as StaticGroupListItem,
];
const tiers = [
  { id: 't-hw', tierId: 'aac-heavyweight', isActive: true } as unknown as TierSnapshot,
];

const activeInvitation: Invitation = {
  id: 'inv-1',
  staticGroupId: 'g1',
  inviteCode: 'CODE123',
  role: 'member',
  useCount: 0,
  isActive: true,
  isValid: true,
  createdAt: '2026-01-01T00:00:00Z',
  createdById: 'u1',
};

beforeEach(() => {
  mockPermissions.mockReturnValue({
    userRole: 'owner',
    isAdmin: false,
    isAdminAccess: false,
    isMember: true,
    canEdit: true,
    canManageInvitations: true,
  });

  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();

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

  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });

  useStaticGroupStore.setState({ currentGroup, groups });
  useTierStore.setState({ tiers, currentTier: tiers[0] });
  useLootTrackingStore.setState({ currentWeek: 3, maxWeek: 5 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useJoinRequestStore.setState({ fetchGroupRequests: vi.fn().mockResolvedValue(undefined) as any });

  useInvitationStore.setState({ invitations: [], fetchInvitations: vi.fn().mockResolvedValue(undefined) });
  useSettingsPanelStore.setState({
    isOpen: false,
    tab: 'general',
    recruitmentSection: undefined,
    highlightCreateInvite: false,
  });
});

function renderTopBar() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/group/ABC']}>
        <TopBar onOpenPalette={vi.fn()} onOpenNotifications={vi.fn()} />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('TopBar invite affordance', () => {
  it('copies the active invitation link and shows a success toast (settings NOT opened)', async () => {
    useInvitationStore.setState({ invitations: [activeInvitation], fetchInvitations: vi.fn().mockResolvedValue(undefined) });
    const openSpy = vi.spyOn(useSettingsPanelStore.getState(), 'open');

    renderTopBar();
    fireEvent.click(screen.getByRole('button', { name: 'Invite members' }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/CODE123`);
    });
    expect(toast.success).toHaveBeenCalledWith('Invite link copied!');
    expect(toast.error).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('opens the recruitment/invitations settings section when no active invitation exists', () => {
    useInvitationStore.setState({ invitations: [], fetchInvitations: vi.fn().mockResolvedValue(undefined) });
    const openSpy = vi.spyOn(useSettingsPanelStore.getState(), 'open');

    renderTopBar();
    fireEvent.click(screen.getByRole('button', { name: 'Invite members' }));

    expect(openSpy).toHaveBeenCalledWith({ tab: 'recruitment', section: 'invitations', highlightCreateInvite: true });
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('shows an error toast (no success toast) when the clipboard write rejects', async () => {
    useInvitationStore.setState({ invitations: [activeInvitation], fetchInvitations: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });

    renderTopBar();
    fireEvent.click(screen.getByRole('button', { name: 'Invite members' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to copy');
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('does not render the invite button for a non-manager (member, non-admin)', () => {
    mockPermissions.mockReturnValue({
      userRole: 'member',
      isAdmin: false,
      isAdminAccess: false,
      isMember: true,
      canEdit: false,
      canManageInvitations: false,
    });
    const fetchInvitations = vi.fn().mockResolvedValue(undefined);
    useInvitationStore.setState({ invitations: [], fetchInvitations });

    renderTopBar();
    expect(screen.queryByRole('button', { name: 'Invite members' })).toBeNull();
    expect(fetchInvitations).not.toHaveBeenCalled();
  });

  it('fetches invitations on mount when the user can manage invitations', () => {
    const fetchInvitations = vi.fn().mockResolvedValue(undefined);
    useInvitationStore.setState({ invitations: [], fetchInvitations });

    renderTopBar();

    expect(fetchInvitations).toHaveBeenCalledWith('g1');
  });

  it('fetches invitations once on mount for a manager and not again on an unrelated re-render', () => {
    // Characterization test (behavior-neutrality lock for the exhaustive-deps
    // fix): pins "fetch fires once per (canManageInvitations, groupId)" so the
    // TopBar.tsx deps-array change (adding fetchInvitations, capturing
    // currentGroupId) can be proven behavior-neutral. Must pass unchanged
    // both before and after that refactor.
    const fetchInvitations = vi.fn().mockResolvedValue(undefined);
    useInvitationStore.setState({ invitations: [], fetchInvitations });

    const { rerender } = renderTopBar();
    expect(fetchInvitations).toHaveBeenCalledTimes(1);
    expect(fetchInvitations).toHaveBeenCalledWith('g1');

    // Unrelated re-render: a new element (fresh onOpenPalette/onOpenNotifications
    // refs) with the same group id / canManageInvitations — must not refetch.
    rerender(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/group/ABC']}>
          <TopBar onOpenPalette={vi.fn()} onOpenNotifications={vi.fn()} />
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(fetchInvitations).toHaveBeenCalledTimes(1);
  });
});
