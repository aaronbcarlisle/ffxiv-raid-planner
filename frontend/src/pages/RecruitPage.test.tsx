/**
 * RecruitPage — the V2 Recruiting frame (RH1b, R-RH-G/H/J/L).
 *
 * Stores and permissions are mocked at the hook seam; the settings-panel store
 * is REAL so the placeholders' `openDock` is proven to bypass a registered
 * redirect. Navigation is asserted through a probe under the same
 * MemoryRouter; "Back is one step" drives `navigate(-1)` after the member
 * redirect and expects the entry BEFORE the recruit URL.
 */
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  group: null as Record<string, unknown> | null,
  canEdit: true,
  applicants: null as { groupId: string; items: unknown[]; pendingCount: number } | null,
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
    sel({ applicants: mocks.applicants }),
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

import { RecruitPage } from './RecruitPage';
import { useSettingsPanelStore } from '../stores/settingsPanelStore';

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
  mocks.updateGroup.mockReset().mockResolvedValue(undefined);
  mocks.clearGroupError.mockReset();
  mocks.toastError.mockReset();
  useSettingsPanelStore.setState({
    isOpen: false, tab: 'general', recruitmentSection: undefined, highlightCreateInvite: false, recruitRedirect: null,
  });
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
  it('?rtab=listing selects Listing and hides the status select; the placeholder opens the dock via openDock past a redirect', () => {
    const redirect = vi.fn(() => true);
    useSettingsPanelStore.getState().setRecruitRedirect(redirect);
    renderAt(['/group/abc/recruit?rtab=listing']);
    expect(screen.getByRole('tab', { name: 'Listing' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('combobox', { name: 'Recruitment status' })).toBeNull();
    expect(screen.getByText('Coming in the next update, use Settings → Recruitment for now')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Settings → Recruitment' }));
    expect(redirect).not.toHaveBeenCalled();
    const s = useSettingsPanelStore.getState();
    expect(s.isOpen).toBe(true);
    expect(s.tab).toBe('recruitment');
    expect(s.recruitmentSection).toBe('listing');
  });

  it('clicking Invites writes ?rtab=invites, keeps the select, and its placeholder targets the invitations section', () => {
    renderAt(['/group/abc/recruit']);
    fireEvent.click(screen.getByRole('tab', { name: 'Invites' }));
    expect(path()).toBe('/group/abc/recruit?rtab=invites');
    expect(screen.getByRole('combobox', { name: 'Recruitment status' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Settings → Recruitment' }));
    expect(useSettingsPanelStore.getState().recruitmentSection).toBe('invitations');
    expect(useSettingsPanelStore.getState().highlightCreateInvite).toBe(false);
  });

  it('?rtab=invites&create=1 hands the create-invite highlight to the dock (TopBar invite parity)', () => {
    renderAt(['/group/abc/recruit?rtab=invites&create=1']);
    fireEvent.click(screen.getByRole('button', { name: 'Open Settings → Recruitment' }));
    const s = useSettingsPanelStore.getState();
    expect(s.isOpen).toBe(true);
    expect(s.recruitmentSection).toBe('invitations');
    expect(s.highlightCreateInvite).toBe(true);
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
