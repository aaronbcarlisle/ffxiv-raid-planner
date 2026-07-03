/**
 * NewShell — JoinRequestBanner + AdminBanners mounted in v2 shell (flip-P1 Task 4).
 *
 * Locks that `ShellContent` mounts both self-contained banners INSIDE
 * `ShellContentStates`' happy-path children, above `GroupViewContent` —
 * mirroring legacy `GroupView.tsx:392-415` byte-for-byte in prop wiring, so they
 * only render on the happy path (and error-over-content), never on the
 * loading/private/not-found/no-tiers states:
 *   (a) `AdminBanners` gets `isAdminAccess` from `useStaticPermissions()` — asserted
 *       via the prop captured on the mock stub for both an admin-access fixture and
 *       a non-admin fixture (the component itself owns its null-render; here we only
 *       assert the WIRING, not `AdminBanners`' internals — covered by its own tests).
 *   (b) `JoinRequestBanner` gets `shareCode`/`staticName`/`groupId`/`settings`/
 *       `userRole` straight off `currentGroup` + `useStaticPermissions()`, asserted
 *       via the captured props for a discoverable-static viewer visit
 *       (`userRole: null`).
 *   (c) neither banner mounts in the not-found state (no `currentGroup`) — pinning
 *       the happy-path-only placement inside `ShellContentStates`.
 *
 * Both banners are mocked to lightweight testid stubs (self-contained components —
 * direct-reuse per spec §3.4 — so their own internals are covered by
 * `AdminBanners`/`JoinRequestBanner`'s own test suites, not here). The mock surface
 * mirrors `NewShell.slot.test.tsx` (GroupViewContent + Home stubbed, `useCurrentTier`/
 * `useTierStore` fixtures) plus a route-scoped `shareCode` (`onExitAdminMode` sources
 * it from `useParams`, mirroring legacy `GroupView.tsx:105,397`).
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentGroup: {
    id: 'g1',
    name: 'Crescent',
    shareCode: 'DEVTST',
    settings: { discovery: { enabled: true } },
  } as unknown | null,
  tier: { tierId: 't1', players: [] } as unknown,
  isAdminAccess: false,
  userRole: 'owner' as string | null,
  fetchGroupByShareCode: vi.fn(),
}));

vi.mock('./GroupViewContent', () => ({
  GroupViewContent: () => <div data-testid="gvc" />,
}));
vi.mock('../components/home/Home', () => ({ Home: () => <div data-testid="home" /> }));
vi.mock('../components/admin/AdminBanners', () => ({
  AdminBanners: (props: { isAdminAccess: boolean; onExitAdminMode?: () => void }) => (
    <button
      type="button"
      aria-label="admin-banners-stub"
      data-testid="admin-banners"
      data-is-admin-access={String(props.isAdminAccess)}
      onClick={() => props.onExitAdminMode?.()}
    />
  ),
}));
vi.mock('../components/static-group/JoinRequestBanner', () => ({
  JoinRequestBanner: (props: {
    shareCode: string;
    staticName: string;
    groupId: string;
    settings?: { discovery?: { enabled?: boolean } };
    userRole?: string | null;
  }) => (
    <div
      data-testid="join-request-banner"
      data-share-code={props.shareCode}
      data-static-name={props.staticName}
      data-group-id={props.groupId}
      data-has-settings={String(!!props.settings)}
      data-user-role={String(props.userRole)}
    />
  ),
}));
vi.mock('./groupActionsContext', () => ({
  GroupActionModals: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGroupActions: () => ({}),
}));
vi.mock('../hooks/useGroupViewState', () => ({
  useGroupViewState: () => ({ setPageMode: vi.fn(), pageMode: 'overview' }),
}));
vi.mock('../stores/staticGroupStore', () => ({
  useStaticGroupStore: (sel: (s: {
    currentGroup: unknown;
    fetchGroupByShareCode: typeof mocks.fetchGroupByShareCode;
  }) => unknown) =>
    sel({ currentGroup: mocks.currentGroup, fetchGroupByShareCode: mocks.fetchGroupByShareCode }),
}));
vi.mock('../stores/tierStore', () => ({
  useCurrentTier: () => mocks.tier,
  // ShellContentStates reads `tiers` + `isLoading` via a selector — a non-empty
  // list keeps the no-tiers state from firing so the states pass through to gvc.
  useTierStore: (sel?: (s: { tiers: unknown[]; isLoading: boolean }) => unknown) => {
    const state = { tiers: mocks.tier ? [mocks.tier] : [], isLoading: false };
    return sel ? sel(state) : state;
  },
}));
vi.mock('../hooks/useStaticPermissions', () => ({
  useStaticPermissions: () => ({
    userRole: mocks.userRole,
    isAdmin: false,
    isAdminAccess: mocks.isAdminAccess,
    isMember: true,
    canEdit: true,
    canManageInvitations: true,
  }),
}));

import { ShellContent } from './NewShell';

beforeEach(() => {
  mocks.currentGroup = {
    id: 'g1',
    name: 'Crescent',
    shareCode: 'DEVTST',
    settings: { discovery: { enabled: true } },
  };
  mocks.tier = { tierId: 't1', players: [] };
  mocks.isAdminAccess = false;
  mocks.userRole = 'owner';
  mocks.fetchGroupByShareCode.mockClear();
});

function renderShell(shareCode = 'DEVTST') {
  return render(
    <MemoryRouter initialEntries={[`/group/${shareCode}`]}>
      <Routes>
        <Route path="/group/:shareCode" element={<ShellContent />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NewShell ShellContent — admin + join-request banners', () => {
  it('(a) mounts AdminBanners with isAdminAccess=true for an admin-access fixture', () => {
    mocks.isAdminAccess = true;
    renderShell();
    expect(screen.getByTestId('admin-banners')).toHaveAttribute('data-is-admin-access', 'true');
  });

  it('(a) passes isAdminAccess=false for a non-admin fixture (AdminBanners owns its own null-render)', () => {
    mocks.isAdminAccess = false;
    renderShell();
    expect(screen.getByTestId('admin-banners')).toHaveAttribute('data-is-admin-access', 'false');
  });

  it('onExitAdminMode refetches the group by the route shareCode (GroupView.tsx:395-400 parity)', () => {
    renderShell('DEVTST');
    fireEvent.click(screen.getByTestId('admin-banners'));
    expect(mocks.fetchGroupByShareCode).toHaveBeenCalledTimes(1);
    expect(mocks.fetchGroupByShareCode).toHaveBeenCalledWith('DEVTST');
  });

  it('(b) mounts JoinRequestBanner with the current group props + userRole for a discoverable-static viewer visit', () => {
    mocks.userRole = null;
    renderShell();
    const banner = screen.getByTestId('join-request-banner');
    expect(banner).toHaveAttribute('data-share-code', 'DEVTST');
    expect(banner).toHaveAttribute('data-static-name', 'Crescent');
    expect(banner).toHaveAttribute('data-group-id', 'g1');
    expect(banner).toHaveAttribute('data-has-settings', 'true');
    expect(banner).toHaveAttribute('data-user-role', 'null');
  });

  it('(c) mounts neither banner when there is no current group (not-found state — happy-path-only placement)', () => {
    mocks.currentGroup = null;
    renderShell();
    expect(screen.getByTestId('shell-state-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-banners')).not.toBeInTheDocument();
    expect(screen.queryByTestId('join-request-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gvc')).not.toBeInTheDocument();
  });

  it('(d) mounts BOTH banners in the no-tiers state — legacy parity: banners render whenever currentGroup exists, including a zero-tier static (GroupView.tsx early-return guards are all !currentGroup)', () => {
    mocks.tier = null; // ShellContentStates' tierStore mock maps a null tier to tiers:[] -> branch 4 (no-tiers)
    mocks.isAdminAccess = true;
    mocks.userRole = null;
    renderShell();
    expect(screen.getByTestId('shell-state-no-tiers')).toBeInTheDocument();
    expect(screen.getByTestId('admin-banners')).toHaveAttribute('data-is-admin-access', 'true');
    const banner = screen.getByTestId('join-request-banner');
    expect(banner).toHaveAttribute('data-share-code', 'DEVTST');
    expect(banner).toHaveAttribute('data-group-id', 'g1');
  });
});
