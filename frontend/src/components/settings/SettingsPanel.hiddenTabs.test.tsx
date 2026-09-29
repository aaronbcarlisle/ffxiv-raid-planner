/**
 * SettingsPanel.hiddenTabs (R-RH-J): a host can remove tabs after the role
 * filter; a stored active tab that is hidden falls back to General. Without the
 * prop the panel is unchanged (SettingsPanel.roles.test.tsx passes unedited).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPanel, type SettingsTab } from './SettingsPanel';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import type { StaticGroup, SnapshotPlayer } from '../../types';

vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: Object.assign(() => 0, { getState: () => ({ fetchGroupRequests: vi.fn() }) }),
}));
vi.mock('../../stores/authStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAuthStore: (sel?: any) => {
    const s = { user: { id: 'u', tabPersistence: 'remember' }, updatePreferences: vi.fn() };
    return sel ? sel(s) : s;
  },
}));
// The Recruitment tab's body pulls the discovery editor + invitation stores;
// the tests below only inspect the tab strip and the fallback to General.
vi.mock('./RecruitmentTab', () => ({
  RecruitmentTab: () => <div data-testid="recruitment-tab-body" />,
}));

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }))
  );
  useSettingsPanelStore.setState({ tab: 'general', isOpen: true } as never);
});

const group = { id: 'g1', name: 'S', shareCode: 'c', userRole: 'owner', settings: {} } as StaticGroup;
const players: SnapshotPlayer[] = [];

function renderPanel(hiddenTabs?: SettingsTab[]) {
  return render(
    <MemoryRouter>
      <SettingsPanel isOpen container="dock" onClose={vi.fn()} group={group} players={players} hiddenTabs={hiddenTabs} />
    </MemoryRouter>
  );
}

describe('SettingsPanel hiddenTabs', () => {
  it('owner + hiddenTabs=[recruitment]: the Recruitment button is absent, the other manager tabs stay', () => {
    renderPanel(['recruitment']);
    expect(screen.queryByText('Recruitment')).not.toBeInTheDocument();
    for (const label of ['General', 'Static', 'Priority', 'Goals & Farms', 'Integrations', 'Members']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('a stored tab: recruitment renders General when Recruitment is hidden', () => {
    useSettingsPanelStore.setState({ tab: 'recruitment' } as never);
    renderPanel(['recruitment']);
    expect(screen.queryByTestId('recruitment-tab-body')).not.toBeInTheDocument();
    // GeneralTab's own section heading.
    expect(screen.getByText('Navigation')).toBeInTheDocument();
  });

  it('without the prop an owner still sees Recruitment, and the stored tab renders it', () => {
    useSettingsPanelStore.setState({ tab: 'recruitment' } as never);
    renderPanel();
    expect(screen.getByText('Recruitment')).toBeInTheDocument();
    expect(screen.getByTestId('recruitment-tab-body')).toBeInTheDocument();
  });
});
