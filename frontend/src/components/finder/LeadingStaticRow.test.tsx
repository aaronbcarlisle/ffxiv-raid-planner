/**
 * LeadingStaticRow — R-SF-J: zero/one/several led statics, a member-only
 * group excluded, and the guest branch.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LeadingStaticRow } from './LeadingStaticRow';
import type { StaticGroupListItem } from '../../types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

const authState: { user: Record<string, unknown> | null } = { user: { id: 'u1' } };
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: unknown }) => unknown) => selector({ user: authState.user }),
}));

const fetchGroups = vi.fn();
let groups: StaticGroupListItem[] = [];
vi.mock('../../stores/staticGroupStore', () => ({
  useStaticGroupStore: (selector: (s: { groups: StaticGroupListItem[]; fetchGroups: () => void; createGroup: () => void }) => unknown) =>
    selector({ groups, fetchGroups, createGroup: vi.fn() }),
}));

// R-RH-N: the row no longer touches the settings store — a real one is
// imported here only to prove that. Any call would flip `isOpen`.
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';

function group(overrides: Partial<StaticGroupListItem> = {}): StaticGroupListItem {
  return {
    id: 'g1', name: 'Twilight Wardens', shareCode: 'ABC', isPublic: true, ownerId: 'u1',
    memberCount: 4, isAdminAccess: false, source: 'membership', createdAt: '', updatedAt: '',
    ...overrides,
  } as StaticGroupListItem;
}

function renderRow() {
  return render(<MemoryRouter><LeadingStaticRow /></MemoryRouter>);
}

beforeEach(() => {
  authState.user = { id: 'u1' };
  groups = [];
  mockNavigate.mockClear();
  fetchGroups.mockClear();
  useSettingsPanelStore.setState({ isOpen: false, recruitRedirect: null });
  // jsdom has no matchMedia; Modal -> useDevice depends on it (SetupWizard renders a Modal).
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  );
});

describe('LeadingStaticRow', () => {
  it('zero led statics: "Create a static" opens SetupWizard', () => {
    renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'Create a static' }));
    expect(screen.getByRole('heading', { name: /create.*static/i })).toBeInTheDocument();
  });

  it('one led static: "Post a listing" is one navigation to the Recruiting route\'s Listing tab (R-RH-N)', () => {
    groups = [group({ id: 'g1', shareCode: 'ABC', userRole: 'owner' })];
    renderRow();

    fireEvent.click(screen.getByRole('button', { name: 'Post a listing' }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/group/ABC/recruit?rtab=listing');
    // No settings-dock open any more.
    expect(useSettingsPanelStore.getState().isOpen).toBe(false);
  });

  it('two led statics: the Select lists both, and choosing one runs the same navigation', () => {
    groups = [
      group({ id: 'g1', name: 'Twilight Wardens', shareCode: 'ABC', userRole: 'owner' }),
      group({ id: 'g2', name: 'Savage Clears Co', shareCode: 'DEF', userRole: 'lead' }),
    ];
    renderRow();
    const combo = screen.getByRole('combobox', { name: 'Choose a static' });
    fireEvent.keyDown(combo, { key: 'Enter' });
    expect(screen.getByRole('option', { name: 'Twilight Wardens' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Savage Clears Co' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'Savage Clears Co' }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/group/DEF/recruit?rtab=listing');
    expect(useSettingsPanelStore.getState().isOpen).toBe(false);
  });

  it('a member-only group is not listed', () => {
    groups = [group({ id: 'g1', shareCode: 'ABC', userRole: 'member' })];
    renderRow();
    expect(screen.getByRole('button', { name: 'Create a static' })).toBeInTheDocument();
  });

  it('never fetches groups itself, even when empty — AppChrome already owns the cold-load fetch (PR-review fix wave item 6)', () => {
    renderRow();
    expect(fetchGroups).not.toHaveBeenCalled();
  });

  it('a guest: the row is not rendered, and fetchGroups is never called (F1)', () => {
    authState.user = null;
    renderRow();
    expect(screen.queryByTestId('leading-static-row')).toBeNull();
    expect(fetchGroups).not.toHaveBeenCalled();
  });
});
