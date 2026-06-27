/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPanel } from './SettingsPanel';
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

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }))
  );
});

function group(role: StaticGroup['userRole']): StaticGroup {
  return { id: 'g1', name: 'S', shareCode: 'c', userRole: role, settings: {} } as StaticGroup;
}
const players: SnapshotPlayer[] = [];

function renderPanel(role: StaticGroup['userRole']) {
  return render(
    <MemoryRouter>
      <SettingsPanel isOpen container="dock" onClose={vi.fn()} group={group(role)} players={players} />
    </MemoryRouter>
  );
}

describe('SettingsPanel role filtering', () => {
  it('member sees General, Priority, Goals & Farms, Members — not Static or Recruitment', () => {
    renderPanel('member');
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Goals & Farms')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.queryByText('Static')).not.toBeInTheDocument();
    expect(screen.queryByText('Recruitment')).not.toBeInTheDocument();
  });

  it('owner sees all tabs including Static and Recruitment', () => {
    renderPanel('owner');
    expect(screen.getByText('Static')).toBeInTheDocument();
    expect(screen.getByText('Recruitment')).toBeInTheDocument();
  });

  it('viewer does not see the Priority tab', () => {
    renderPanel('viewer');
    expect(screen.queryByText('Priority')).not.toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
  });
});
