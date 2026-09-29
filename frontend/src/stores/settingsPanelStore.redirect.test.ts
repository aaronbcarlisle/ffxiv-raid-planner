/**
 * settingsPanelStore — the Recruiting seam (R-RH-I) and the dock bypass (R-RH-J).
 *
 * With no redirect registered the store behaves as it always has. Once the V2
 * shell registers `recruitRedirect`, an `open`/`toggle` for the Recruitment tab
 * never opens the dock (`isOpen` stays false) and the redirect sees the exact
 * options. `openDock` bypasses the redirect for the interim placeholders. The
 * opener table pins where each of the eight settings openers' option objects
 * land, through the same `recruitUrlForOpen` the shell composes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsPanelStore, type OpenOptions } from './settingsPanelStore';
import { recruitUrlForOpen } from '../components/recruit/recruitTabs';

function reset() {
  useSettingsPanelStore.setState({
    isOpen: false,
    tab: 'general',
    recruitmentSection: undefined,
    highlightCreateInvite: false,
    recruitRedirect: null,
  });
}

beforeEach(reset);

describe('settingsPanelStore without a redirect (V1 and today)', () => {
  it('open({ tab: recruitment }) opens the dock on that tab', () => {
    useSettingsPanelStore.getState().open({ tab: 'recruitment' });
    expect(useSettingsPanelStore.getState().isOpen).toBe(true);
    expect(useSettingsPanelStore.getState().tab).toBe('recruitment');
  });

  it('toggle({ tab: recruitment }) opens the dock with highlightCreateInvite defaulted on', () => {
    useSettingsPanelStore.getState().toggle({ tab: 'recruitment' });
    expect(useSettingsPanelStore.getState().isOpen).toBe(true);
    expect(useSettingsPanelStore.getState().highlightCreateInvite).toBe(true);
  });
});

describe('settingsPanelStore with the V2 redirect registered', () => {
  it('open({ tab: recruitment, section: listing }) leaves isOpen false and calls the redirect once with the options', () => {
    const redirect = vi.fn(() => true);
    useSettingsPanelStore.getState().setRecruitRedirect(redirect);
    useSettingsPanelStore.getState().open({ tab: 'recruitment', section: 'listing' });
    expect(useSettingsPanelStore.getState().isOpen).toBe(false);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith({ tab: 'recruitment', section: 'listing' });
  });

  it('toggle({ tab: recruitment }) likewise never opens the dock', () => {
    const redirect = vi.fn(() => true);
    useSettingsPanelStore.getState().setRecruitRedirect(redirect);
    useSettingsPanelStore.getState().toggle({ tab: 'recruitment' });
    expect(useSettingsPanelStore.getState().isOpen).toBe(false);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith({ tab: 'recruitment' });
  });

  it('toggle({ tab: recruitment }) on a dock already open on Recruitment closes it and never consults the redirect (Alt+I)', () => {
    const redirect = vi.fn(() => true);
    useSettingsPanelStore.getState().setRecruitRedirect(redirect);
    useSettingsPanelStore.setState({ isOpen: true, tab: 'recruitment' });
    useSettingsPanelStore.getState().toggle({ tab: 'recruitment' });
    expect(redirect).not.toHaveBeenCalled();
    expect(useSettingsPanelStore.getState().isOpen).toBe(false);
  });

  it('toggle({ tab: recruitment }) on a dock open on another tab switches to it (today\'s semantics), no redirect', () => {
    const redirect = vi.fn(() => true);
    useSettingsPanelStore.getState().setRecruitRedirect(redirect);
    useSettingsPanelStore.setState({ isOpen: true, tab: 'general' });
    useSettingsPanelStore.getState().toggle({ tab: 'recruitment' });
    expect(redirect).not.toHaveBeenCalled();
    expect(useSettingsPanelStore.getState().isOpen).toBe(true);
    expect(useSettingsPanelStore.getState().tab).toBe('recruitment');
  });

  it('toggle({ tab: recruitment }) on a closed dock calls the redirect and stays closed', () => {
    const redirect = vi.fn(() => true);
    useSettingsPanelStore.getState().setRecruitRedirect(redirect);
    useSettingsPanelStore.getState().toggle({ tab: 'recruitment' });
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(useSettingsPanelStore.getState().isOpen).toBe(false);
  });

  it('open({ tab: members }) never consults the redirect and opens as before', () => {
    const redirect = vi.fn(() => true);
    useSettingsPanelStore.getState().setRecruitRedirect(redirect);
    useSettingsPanelStore.getState().open({ tab: 'members' });
    expect(redirect).not.toHaveBeenCalled();
    expect(useSettingsPanelStore.getState().isOpen).toBe(true);
    expect(useSettingsPanelStore.getState().tab).toBe('members');
  });

  it('a redirect that returns false falls through to the dock', () => {
    useSettingsPanelStore.getState().setRecruitRedirect(() => false);
    useSettingsPanelStore.getState().open({ tab: 'recruitment' });
    expect(useSettingsPanelStore.getState().isOpen).toBe(true);
  });

  it('setRecruitRedirect(null) restores today\'s behaviour', () => {
    const redirect = vi.fn(() => true);
    useSettingsPanelStore.getState().setRecruitRedirect(redirect);
    useSettingsPanelStore.getState().setRecruitRedirect(null);
    useSettingsPanelStore.getState().open({ tab: 'recruitment', section: 'requests' });
    expect(redirect).not.toHaveBeenCalled();
    expect(useSettingsPanelStore.getState().isOpen).toBe(true);
    expect(useSettingsPanelStore.getState().recruitmentSection).toBe('requests');
  });

  it('openDock opens the dock even with a redirect registered (R-RH-J placeholders)', () => {
    const redirect = vi.fn(() => true);
    useSettingsPanelStore.getState().setRecruitRedirect(redirect);
    useSettingsPanelStore.getState().openDock({ tab: 'recruitment', section: 'invitations' });
    expect(redirect).not.toHaveBeenCalled();
    const s = useSettingsPanelStore.getState();
    expect(s.isOpen).toBe(true);
    expect(s.tab).toBe('recruitment');
    expect(s.recruitmentSection).toBe('invitations');
    expect(s.highlightCreateInvite).toBe(false);
  });
});

/**
 * Criterion 6 — the eight openers (plan premises table, R-RH-I) with the exact
 * option objects the code passes, and the route each maps to through the
 * redirect the shell registers (`recruitUrlForOpen`). `method` is which store
 * action the opener calls.
 */
describe('the opener table', () => {
  const openers: [string, 'open' | 'toggle', OpenOptions, string][] = [
    ['NewShell Home onOpenRequests', 'open', { tab: 'recruitment', section: 'requests' }, '/group/abc/recruit'],
    ['NewShell Roster onOpenRequests', 'open', { tab: 'recruitment', section: 'requests' }, '/group/abc/recruit'],
    ['GroupViewContent overview fallback onOpenRequests', 'open', { tab: 'recruitment', section: 'requests' }, '/group/abc/recruit'],
    ['TopBar invite (no tier)', 'open', { tab: 'recruitment', section: 'invitations', highlightCreateInvite: true }, '/group/abc/recruit?rtab=invites&create=1'],
    ['SettingsPanelController OPEN_SETTINGS_INVITATIONS', 'open', { tab: 'recruitment', section: 'invitations', highlightCreateInvite: true }, '/group/abc/recruit?rtab=invites&create=1'],
    ['MorePage onOpenSettings(recruitment)', 'open', { tab: 'recruitment' }, '/group/abc/recruit'],
    ['Header bell via SettingsPanelController toggle:true (dock closed)', 'open', { tab: 'recruitment', section: undefined, highlightCreateInvite: true }, '/group/abc/recruit'],
    ['Alt+I via SettingsPanelController toggle', 'toggle', { tab: 'recruitment', section: undefined }, '/group/abc/recruit'],
    ['LeadingStaticRow (pre-R-RH-N options)', 'open', { tab: 'recruitment', section: 'listing' }, '/group/abc/recruit?rtab=listing'],
  ];

  it.each(openers)('%s → %s', (_name, method, opts, expected) => {
    const landed: string[] = [];
    useSettingsPanelStore.getState().setRecruitRedirect((o) => {
      landed.push(recruitUrlForOpen('abc', o, null));
      return true;
    });
    useSettingsPanelStore.getState()[method](opts);
    expect(landed).toEqual([expected]);
    expect(useSettingsPanelStore.getState().isOpen).toBe(false);
  });

  it('carries the current tier when the shell has one', () => {
    expect(recruitUrlForOpen('abc', { tab: 'recruitment', section: 'requests' }, 't1')).toBe(
      '/group/abc/recruit?tier=t1',
    );
  });
});
