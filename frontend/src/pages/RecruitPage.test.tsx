/**
 * RecruitPage — the V2 Recruiting frame (RH1b/RH1d, R-RH-G/H/L/M).
 *
 * Stores and permissions are mocked at the hook seam. `ListingTab` and
 * `InvitesTab` are stubbed here (their own behaviour has dedicated suites,
 * ListingTab.test.tsx and InvitesTab.test.tsx) — this file only proves the
 * frame mounts the right one for the active tab with the right props.
 * Navigation is asserted through a probe under the same MemoryRouter; "Back
 * is one step" drives `navigate(-1)` after the member redirect and expects
 * the entry BEFORE the recruit URL.
 */
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  group: null as Record<string, unknown> | null,
  canEdit: true,
  applicants: null as { groupId: string; items: unknown[]; pendingCount: number } | null,
  fetchApplicants: vi.fn(),
  updateGroup: vi.fn(),
  clearGroupError: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../stores/staticGroupStore', () => ({
  useStaticGroupStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ currentGroup: mocks.group, updateGroup: mocks.updateGroup, clearError: mocks.clearGroupError }),
}));
vi.mock('../hooks/useStaticPermissions', () => ({
  useStaticPermissions: () => ({
    userRole: mocks.canEdit ? 'owner' : 'member', isAdmin: false, isAdminAccess: false,
    isMember: true, canEdit: mocks.canEdit, canManageInvitations: mocks.canEdit,
  }),
}));
vi.mock('../stores/joinRequestStore', () => ({
  useJoinRequestStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ applicants: mocks.applicants, fetchApplicants: mocks.fetchApplicants }),
}));
vi.mock('../stores/toastStore', () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}));
// RecruitPage's own tests cover the frame (guard/tabs/header); the
// Applicants tab's fetch, ordering and empty-state behavior have their own
// suite (ApplicantsTab.test.tsx). A stub here proves it is mounted for the
// current group and never for a member/stale/unloaded one.
vi.mock('../components/recruit/ApplicantsTab', () => ({
  ApplicantsTab: ({ group }: { group: { id: string } }) => <div data-testid="applicants-tab">{group.id}</div>,
}));
vi.mock('../components/recruit/ListingTab', () => ({
  ListingTab: ({ group, onTabChange }: { group: { id: string }; onTabChange: (t: string) => void }) => (
    <div data-testid="listing-tab" data-group={group.id}>
      <button type="button" onClick={() => onTabChange('applicants')}>close-listing</button>
    </div>
  ),
}));
vi.mock('../components/recruit/InvitesTab', () => ({
  // No `createRequested` prop (review wave, Important 2): InvitesTab reads
  // `?create=1` itself via useSearchParams, since the tab doesn't remount for
  // a same-tab re-navigation — see InvitesTab.test.tsx for that behaviour.
  InvitesTab: ({ groupId }: { groupId: string }) => (
    <div data-testid="invites-tab" data-group={groupId} />
  ),
}));

import { RecruitPage } from './RecruitPage';

function makeGroup(discovery: Record<string, unknown> | undefined, extra: Record<string, unknown> = {}) {
  const settings: Record<string, unknown> = { lootPriority: ['tank'] };
  if (discovery) settings.discovery = discovery;
  return {
    id: 'g1', name: 'Test Static', shareCode: 'abc', isPublic: true, ownerId: 'u1',
    memberCount: 8, userRole: 'owner', isAdminAccess: false, settings, ...extra,
  };
}

function Probe() {
  const loc = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <div data-testid="location" data-path={loc.pathname + loc.search} />
      <button type="button" data-testid="back" onClick={() => navigate(-1)}>back</button>
    </>
  );
}

function renderAt(entries: string[], initialIndex = entries.length - 1) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={initialIndex}>
      <Probe />
      <Routes>
        <Route path="/profile" element={<div data-testid="profile" />} />
        <Route path="/group/:shareCode" element={<div data-testid="static-home" />} />
        <Route path="/group/:shareCode/recruit" element={<RecruitPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const path = () => screen.getByTestId('location').getAttribute('data-path');

beforeEach(() => {
  mocks.group = makeGroup({ enabled: true, recruitmentStatus: 'open' });
  mocks.canEdit = true;
  mocks.applicants = null;
  mocks.fetchApplicants.mockReset().mockResolvedValue(undefined);
  mocks.updateGroup.mockReset().mockResolvedValue(undefined);
  mocks.clearGroupError.mockReset();
  mocks.toastError.mockReset();
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  );
});

describe('RecruitPage guard (R-RH-G)', () => {
  it('a manager sees the header, the three tabs, the status select and the mounted Applicants tab', () => {
    renderAt(['/group/abc/recruit']);
    expect(screen.getByRole('heading', { name: 'Recruiting' })).toBeInTheDocument();
    const tablist = screen.getByRole('tablist', { name: 'Recruiting sections' });
    ['Applicants', 'Listing', 'Invites'].forEach((label) =>
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument(),
    );
    expect(tablist).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Applicants' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('combobox', { name: 'Recruitment status' })).toBeInTheDocument();
    expect(screen.getByTestId('applicants-tab')).toHaveTextContent('g1');
  });

  it('a member is replace-redirected to the static; the inbox never mounts; Back is one step', () => {
    mocks.canEdit = false;
    renderAt(['/profile', '/group/abc/recruit'], 1);
    expect(path()).toBe('/group/abc');
    expect(screen.getByTestId('static-home')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recruiting' })).toBeNull();
    expect(screen.queryByTestId('applicants-tab')).toBeNull();
    // History length: the recruit entry was replaced, so one step back is /profile.
    act(() => { fireEvent.click(screen.getByTestId('back')); });
    expect(path()).toBe('/profile');
    expect(screen.getByTestId('profile')).toBeInTheDocument();
  });

  it('a member\'s redirect carries the tier the link had', () => {
    mocks.canEdit = false;
    renderAt(['/group/abc/recruit?rtab=listing&tier=t1']);
    expect(path()).toBe('/group/abc?tier=t1');
  });

  it('a member\'s redirect carries viewAs (URL-driven state) and drops only rtab/create (C2)', () => {
    mocks.canEdit = false;
    renderAt(['/group/abc/recruit?rtab=listing&tier=t1&viewAs=u2']);
    expect(path()).toBe('/group/abc?tier=t1&viewAs=u2');
  });

  it('group not loaded → skeleton, no header, no redirect', () => {
    mocks.group = null;
    renderAt(['/group/abc/recruit']);
    expect(screen.queryByRole('heading', { name: 'Recruiting' })).toBeNull();
    expect(path()).toBe('/group/abc/recruit');
    expect(screen.queryByTestId('applicants-tab')).toBeNull();
  });

  it('a stale group for another static → skeleton (no flash of its inbox), even for a member', () => {
    mocks.group = makeGroup({ enabled: true }, { shareCode: 'zzz' });
    mocks.canEdit = false;
    renderAt(['/group/abc/recruit']);
    expect(screen.queryByRole('heading', { name: 'Recruiting' })).toBeNull();
    expect(path()).toBe('/group/abc/recruit');
    expect(screen.queryByTestId('applicants-tab')).toBeNull();
  });
});

describe('RecruitPage tabs (R-RH-H, R-RH-J)', () => {
  it('arriving at ?rtab=listing still fetches applicants once, so the header count is not empty on arrival (IMPORTANT 1)', () => {
    mocks.applicants = { groupId: 'g1', items: [], pendingCount: 2 };
    renderAt(['/group/abc/recruit?rtab=listing']);
    expect(mocks.fetchApplicants).toHaveBeenCalledTimes(1);
    expect(mocks.fetchApplicants).toHaveBeenCalledWith('g1');
    expect(screen.getByText('Live · Open · 2 waiting')).toBeInTheDocument();
  });

  it('a rejected fetchApplicants on arrival toasts an error (never "group") — the page is the sole mount fetch (fix wave round 2)', async () => {
    mocks.fetchApplicants.mockRejectedValueOnce(new Error('Network error'));
    renderAt(['/group/abc/recruit']);
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(mocks.toastError).toHaveBeenCalledWith("Couldn't load applicants.");
    expect(mocks.toastError.mock.calls[0][0]).not.toMatch(/group/i);
  });

  it('?rtab=listing selects Listing, hides the status select, and mounts ListingTab with the group', () => {
    renderAt(['/group/abc/recruit?rtab=listing']);
    expect(screen.getByRole('tab', { name: 'Listing' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('combobox', { name: 'Recruitment status' })).toBeNull();
    expect(screen.getByTestId('listing-tab')).toHaveAttribute('data-group', 'g1');
  });

  it('ListingTab closing (its DiscoveryTab onClose) switches the page back to Applicants and drops the param', () => {
    renderAt(['/group/abc/recruit?rtab=listing']);
    fireEvent.click(screen.getByText('close-listing'));
    expect(path()).toBe('/group/abc/recruit');
    expect(screen.getByRole('tab', { name: 'Applicants' })).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking Invites writes ?rtab=invites, keeps the select, and mounts InvitesTab with the group id', () => {
    renderAt(['/group/abc/recruit']);
    fireEvent.click(screen.getByRole('tab', { name: 'Invites' }));
    expect(path()).toBe('/group/abc/recruit?rtab=invites');
    expect(screen.getByRole('combobox', { name: 'Recruitment status' })).toBeInTheDocument();
    expect(screen.getByTestId('invites-tab')).toHaveAttribute('data-group', 'g1');
  });

  it('clicking Applicants from Listing drops the param (default tab is omitted)', () => {
    renderAt(['/group/abc/recruit?rtab=listing']);
    fireEvent.click(screen.getByRole('tab', { name: 'Applicants' }));
    expect(path()).toBe('/group/abc/recruit');
  });
});

describe('RecruitHeader (R-RH-L)', () => {
  it.each([
    [{ enabled: true, recruitmentStatus: 'open' }, true, 3, 'Live · Open · 3 waiting'],
    [{ enabled: true, recruitmentStatus: 'paused' }, true, 2, 'Live · Paused · 2 still waiting'],
    [{ enabled: true, recruitmentStatus: 'closed' }, true, 1, 'Live · Closed · 1 still waiting'],
    [{ enabled: false, recruitmentStatus: 'selective' }, true, 0, 'Listing off · Selective'],
    [{ enabled: true, recruitmentStatus: 'open' }, false, 0, 'Listing off · Open'],
    [{ enabled: true }, true, 0, 'Live · Open'],
    [{ enabled: true, recruitmentStatus: 'limited' }, true, 4, 'Live · Selective · 4 waiting'],
    [undefined, true, 0, 'Listing off · Open'],
  ])('discovery %j, public %s, pending %i → subtitle "%s"', (discovery, isPublic, pending, subtitle) => {
    mocks.group = makeGroup(discovery as Record<string, unknown> | undefined, { isPublic });
    mocks.applicants = { groupId: 'g1', items: [], pendingCount: pending };
    renderAt(['/group/abc/recruit']);
    expect(screen.getByText(subtitle)).toBeInTheDocument();
  });

  it('a stale applicants slice for another static reads as 0 waiting', () => {
    mocks.group = makeGroup({ enabled: true, recruitmentStatus: 'open' });
    mocks.applicants = { groupId: 'other-group', items: [], pendingCount: 9 };
    renderAt(['/group/abc/recruit']);
    expect(screen.getByText('Live · Open')).toBeInTheDocument();
  });

  it('a stored limited shows the Selective option', () => {
    mocks.group = makeGroup({ enabled: true, recruitmentStatus: 'limited' });
    renderAt(['/group/abc/recruit']);
    expect(screen.getByRole('combobox', { name: 'Recruitment status' })).toHaveTextContent('Selective');
  });

  it('a missing status shows the Open option', () => {
    mocks.group = makeGroup({ enabled: true });
    renderAt(['/group/abc/recruit']);
    expect(screen.getByRole('combobox', { name: 'Recruitment status' })).toHaveTextContent('Open');
  });

  it('changing the select writes the status into the existing discovery settings via updateGroup', async () => {
    const discovery = { enabled: true, recruitmentStatus: 'open', description: 'Weekend savage', timezone: 'UTC' };
    mocks.group = makeGroup(discovery);
    renderAt(['/group/abc/recruit']);
    const combo = screen.getByRole('combobox', { name: 'Recruitment status' });
    fireEvent.keyDown(combo, { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Paused' }));
    await waitFor(() => expect(mocks.updateGroup).toHaveBeenCalledTimes(1));
    expect(mocks.updateGroup).toHaveBeenCalledWith('g1', {
      settings: { lootPriority: ['tank'], discovery: { ...discovery, recruitmentStatus: 'paused' } },
    });
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.clearGroupError).not.toHaveBeenCalled();
  });

  it('a failed save toasts its own copy (never the store\'s "group" message) and clears the group store error', async () => {
    mocks.updateGroup.mockRejectedValueOnce(new Error('Failed to update group'));
    renderAt(['/group/abc/recruit']);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Recruitment status' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: 'Closed' }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(mocks.toastError).toHaveBeenCalledWith("Couldn't update the recruitment status.");
    expect(mocks.toastError.mock.calls[0][0]).not.toMatch(/group/i);
    expect(mocks.clearGroupError).toHaveBeenCalledTimes(1);
  });
});
