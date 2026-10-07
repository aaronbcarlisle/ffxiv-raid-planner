import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MyStaticsPanel } from './MyStaticsPanel';
import { TooltipProvider } from '../primitives';
import type { StaticGroupListItem } from '../../types';

// ── mocks ──────────────────────────────────────────────────────────────────

const storeState = {
  groups: [] as StaticGroupListItem[],
  isLoading: false,
  error: null as string | null,
  fetchGroups: vi.fn(),
  duplicateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  clearError: vi.fn(),
};
vi.mock('../../stores/staticGroupStore', () => ({
  useStaticGroupStore: () => storeState,
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({ isAuthenticated: true }),
}));

vi.mock('../../stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../wizard', () => ({
  SetupWizard: () => null,
}));

// ── helpers ─────────────────────────────────────────────────────────────────

function makeGroup(overrides: Partial<StaticGroupListItem> = {}): StaticGroupListItem {
  return {
    id: 'g1', name: 'Test Static', shareCode: 'TSTSC1',
    isPublic: false, ownerId: 'u1', memberCount: 4,
    userRole: 'member', isAdminAccess: false, source: 'membership',
    createdAt: '', updatedAt: '',
    ...overrides,
  };
}

function openContextMenu(group: StaticGroupListItem) {
  storeState.groups = [group];
  render(
    <MemoryRouter>
      <TooltipProvider>
        <MyStaticsPanel />
      </TooltipProvider>
    </MemoryRouter>,
  );
  fireEvent.contextMenu(screen.getByText(group.name));
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
  localStorage.clear();
  storeState.error = null;
  storeState.isLoading = false;
  storeState.fetchGroups.mockReset();
});

// ── tests ───────────────────────────────────────────────────────────────────

describe('MyStaticsPanel — context menu Duplicate (#331, B12)', () => {
  it('hides Duplicate Static for a viewer', async () => {
    openContextMenu(makeGroup({ userRole: 'viewer' }));
    await screen.findByRole('menuitem', { name: 'Open Static' });
    expect(screen.queryByRole('menuitem', { name: 'Duplicate Static' })).toBeNull();
  });

  it('hides Duplicate Static on a linked-only row (no membership)', async () => {
    openContextMenu(makeGroup({ source: 'linked', userRole: undefined }));
    await screen.findByRole('menuitem', { name: 'Open Static' });
    expect(screen.queryByRole('menuitem', { name: 'Duplicate Static' })).toBeNull();
  });

  it.each(['owner', 'lead', 'member'] as const)('keeps Duplicate Static for a %s', async (role) => {
    openContextMenu(makeGroup({ userRole: role }));
    expect(await screen.findByRole('menuitem', { name: 'Duplicate Static' })).toBeInTheDocument();
  });
});
