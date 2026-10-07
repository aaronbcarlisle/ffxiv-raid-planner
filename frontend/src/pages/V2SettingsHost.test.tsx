import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  group: { id: 'g1', name: 'Crescent', userRole: 'owner' },
  tier: { tierId: 't1', players: [] },
  user: { id: 'u1', isAdmin: false } as { id: string; isAdmin: boolean } | null,
}));

const hiddenTabsRefs: (string[] | undefined)[] = [];
vi.mock('../components/settings', () => ({
  StaticSettingsHost: (p: { tierId?: string; isAdmin?: boolean; hiddenTabs?: string[] }) => {
    hiddenTabsRefs.push(p.hiddenTabs);
    return <div data-testid="settings-host" data-tier={p.tierId} data-admin={String(p.isAdmin)} data-hidden={p.hiddenTabs?.join(',')} />;
  },
}));
vi.mock('../stores/staticGroupStore', () => ({ useStaticGroupStore: (s: (x: { currentGroup: unknown }) => unknown) => s({ currentGroup: mocks.group }) }));
vi.mock('../stores/tierStore', () => ({ useCurrentTier: () => mocks.tier }));
vi.mock('../stores/authStore', () => ({ useAuthStore: (s: (x: { user: unknown }) => unknown) => s({ user: mocks.user }) }));
vi.mock('./groupActionsContext', () => ({ useGroupAddToRoster: () => vi.fn() }));

import { V2SettingsHost } from './V2SettingsHost';
import { useSettingsPanelStore } from '../stores/settingsPanelStore';

describe('V2SettingsHost', () => {
  it('renders nothing for a guest, even with the settings panel store open (GUEST-1 R-G1-5)', () => {
    const user = mocks.user;
    mocks.user = null;
    useSettingsPanelStore.getState().open();
    try {
      const { container } = render(<V2SettingsHost />);
      expect(useSettingsPanelStore.getState().isOpen).toBe(true);
      expect(screen.queryByTestId('settings-host')).toBeNull();
      expect(container).toBeEmptyDOMElement();
    } finally {
      mocks.user = user;
      useSettingsPanelStore.getState().close();
    }
  });

  it('renders StaticSettingsHost with the active group/tier', () => {
    render(<V2SettingsHost />);
    const host = screen.getByTestId('settings-host');
    expect(host).toHaveAttribute('data-tier', 't1');
    expect(host).toHaveAttribute('data-admin', 'false');
  });

  it('passes hiddenTabs={["recruitment"]} (R-RH-J): the Recruiting route owns Listing/Invites now', () => {
    render(<V2SettingsHost />);
    expect(screen.getByTestId('settings-host')).toHaveAttribute('data-hidden', 'recruitment');
  });

  it('passes the SAME array reference across renders (SettingsPanel uses it as a useMemo dep, so a fresh literal would defeat the memo)', () => {
    hiddenTabsRefs.length = 0;
    const { rerender } = render(<V2SettingsHost />);
    rerender(<V2SettingsHost />);
    expect(hiddenTabsRefs).toHaveLength(2);
    expect(hiddenTabsRefs[0]).toBe(hiddenTabsRefs[1]);
    expect(hiddenTabsRefs[0]).toEqual(['recruitment']);
  });
});
