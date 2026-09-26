import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { YourStaticsCard } from './YourStaticsCard';
import type { StaticGroupListItem } from '../../../types';

// ── mocks ──────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

const storeState = {
  groups: [] as StaticGroupListItem[],
  isLoading: false,
  error: null as string | null,
  fetchGroups: vi.fn(),
  clearError: vi.fn(),
  duplicateGroup: vi.fn(),
  deleteGroup: vi.fn(),
};
vi.mock('../../../stores/staticGroupStore', () => ({
  useStaticGroupStore: (sel?: (s: typeof storeState) => unknown) =>
    sel ? sel(storeState) : storeState,
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: null }) => unknown) => sel({ user: null }),
}));

vi.mock('../../../stores/toastStore', () => ({
  useToastStore: (sel: (s: { addToast: ReturnType<typeof vi.fn> }) => unknown) =>
    sel({ addToast: vi.fn() }),
}));

let mockRemember = true;
vi.mock('../../../lib/navPreferences', async (orig) => ({
  ...(await orig<typeof import('../../../lib/navPreferences')>()),
  prefRememberTabs: () => mockRemember,
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

const onCreateStatic = vi.fn();

function renderCard(groups: StaticGroupListItem[] = [], extra = {}) {
  storeState.groups = groups;
  storeState.error = null;
  storeState.isLoading = false;
  return render(
    <MemoryRouter>
      <YourStaticsCard staticSuggestions={[]} onCreateStatic={onCreateStatic} {...extra} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
  mockNavigate.mockClear();
  onCreateStatic.mockClear();
  mockRemember = true;
  storeState.fetchGroups.mockReset();
  storeState.clearError.mockClear();
  storeState.duplicateGroup.mockResolvedValue({ id: 'g2', shareCode: 'NEW01' });
  storeState.deleteGroup.mockResolvedValue(undefined);
});

// ── tests ───────────────────────────────────────────────────────────────────

describe('YourStaticsCard — rows', () => {
  it('renders a row per static with name, role tag, and member count', () => {
    renderCard([makeGroup({ memberCount: 6, userRole: 'lead' })]);
    expect(screen.getByText('Test Static')).toBeInTheDocument();
    expect(screen.getByText('Lead')).toBeInTheDocument();
    expect(screen.getByText(/6 members/)).toBeInTheDocument();
  });

  it('shows Linked when source is linked', () => {
    renderCard([makeGroup({ source: 'linked', userRole: undefined })]);
    expect(screen.getByText('Linked')).toBeInTheDocument();
  });

  it('Enter button navigates to the static (remember=true reads localStorage key)', () => {
    renderCard([makeGroup()]);
    fireEvent.click(screen.getByRole('button', { name: /enter/i }));
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('TSTSC1'));
  });

  it('Enter navigates to /group/{shareCode} for a static', () => {
    renderCard([makeGroup({ shareCode: 'TSTSC1' })]);
    fireEvent.click(screen.getByRole('button', { name: /enter/i }));
    const target = mockNavigate.mock.calls[0][0] as string;
    expect(target).toMatch(/\/group\/TSTSC1/);
  });

  it('Enter uses a bare href when remember=false (no saved-tab params)', () => {
    mockRemember = false;
    renderCard([makeGroup({ shareCode: 'TSTSC1' })]);
    fireEvent.click(screen.getByRole('button', { name: /enter/i }));
    // With remember=false, buildStaticNavHref returns a bare /group/CODE path
    expect(mockNavigate).toHaveBeenCalledWith('/group/TSTSC1');
  });

  it('Open kebab item uses the same href as Enter (respects remember preference)', () => {
    renderCard([makeGroup({ shareCode: 'TSTSC1' })]);
    const kebab = screen.getByRole('button', { name: /actions for test static/i });
    fireEvent.keyDown(kebab, { key: 'Enter' });
    const open = screen.getAllByRole('menuitem', { name: 'Open' })[0];
    fireEvent.click(open);
    const target = mockNavigate.mock.calls[0][0] as string;
    expect(target).toMatch(/\/group\/TSTSC1/);
  });
});

describe('YourStaticsCard — kebab', () => {
  it('kebab shows Settings and Delete only for owner', async () => {
    renderCard([makeGroup({ userRole: 'owner' })]);
    const kebab = screen.getByRole('button', { name: /actions for test static/i });
    fireEvent.keyDown(kebab, { key: 'Enter' });
    expect(await screen.findByRole('menuitem', { name: 'Settings' })).toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('kebab hides Settings and Delete for non-owner', async () => {
    renderCard([makeGroup({ userRole: 'member' })]);
    const kebab = screen.getByRole('button', { name: /actions for/i });
    fireEvent.keyDown(kebab, { key: 'Enter' });
    await screen.findByRole('menuitem', { name: 'Duplicate' }); // wait for menu to open
    expect(screen.queryByRole('menuitem', { name: 'Settings' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
  });

  it('Duplicate calls duplicateGroup with "(Copy)"', async () => {
    renderCard([makeGroup()]);
    fireEvent.keyDown(screen.getByRole('button', { name: /actions for/i }), { key: 'Enter' });
    const dupeItem = await screen.findByRole('menuitem', { name: 'Duplicate' });
    await act(async () => { fireEvent.click(dupeItem); });
    expect(storeState.duplicateGroup).toHaveBeenCalledWith('g1', 'Test Static (Copy)');
  });
});

describe('YourStaticsCard — delete confirm', () => {
  it('delete confirm button is disabled until exact name typed', async () => {
    renderCard([makeGroup({ userRole: 'owner' })]);
    const kebab = screen.getByRole('button', { name: /actions for test static/i });
    fireEvent.keyDown(kebab, { key: 'Enter' });
    const deleteItem = await screen.findByRole('menuitem', { name: /^delete$/i });
    fireEvent.click(deleteItem);

    const confirmBtn = await screen.findByRole('button', { name: /^delete$/i });
    expect(confirmBtn).toBeDisabled();

    // Partial name — stays disabled
    const input = screen.getByRole('textbox', { name: /confirm static name/i });
    fireEvent.change(input, { target: { value: 'Test' } });
    expect(confirmBtn).toBeDisabled();

    // Exact name — becomes enabled
    fireEvent.change(input, { target: { value: 'Test Static' } });
    expect(confirmBtn).not.toBeDisabled();
  });

  it('clicking confirm calls deleteGroup with the group id', async () => {
    renderCard([makeGroup({ userRole: 'owner' })]);
    const kebab = screen.getByRole('button', { name: /actions for test static/i });
    fireEvent.keyDown(kebab, { key: 'Enter' });
    const deleteItem = await screen.findByRole('menuitem', { name: /^delete$/i });
    fireEvent.click(deleteItem);

    const confirmBtn = await screen.findByRole('button', { name: /^delete$/i });
    const input = screen.getByRole('textbox', { name: /confirm static name/i });
    fireEvent.change(input, { target: { value: 'Test Static' } });
    await act(async () => { fireEvent.click(confirmBtn); });

    expect(storeState.deleteGroup).toHaveBeenCalledWith('g1');
  });

  it('a rejected deleteGroup keeps the modal open and shows the failure toast', async () => {
    storeState.deleteGroup.mockRejectedValue(new Error('server error'));
    const addToast = vi.fn();
    // Override the toastStore mock for this test
    vi.doMock('../../../stores/toastStore', () => ({
      useToastStore: (sel: (s: { addToast: typeof addToast }) => unknown) =>
        sel({ addToast }),
    }));

    renderCard([makeGroup({ userRole: 'owner' })]);
    const kebab = screen.getByRole('button', { name: /actions for test static/i });
    fireEvent.keyDown(kebab, { key: 'Enter' });
    const deleteItem = await screen.findByRole('menuitem', { name: /^delete$/i });
    fireEvent.click(deleteItem);

    const confirmBtn = await screen.findByRole('button', { name: /^delete$/i });
    const input = screen.getByRole('textbox', { name: /confirm static name/i });
    fireEvent.change(input, { target: { value: 'Test Static' } });
    await act(async () => { fireEvent.click(confirmBtn); });

    // Modal must still be visible after rejection
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('YourStaticsCard — Create or join row', () => {
  it('Create or join row visible when statics exist', () => {
    renderCard([makeGroup()]);
    expect(screen.getAllByRole('button', { name: /create a static/i })).toHaveLength(1);
  });

  it('shows suggestion count when staticSuggestions provided', () => {
    storeState.groups = [makeGroup()];
    storeState.error = null;
    storeState.isLoading = false;
    render(
      <MemoryRouter>
        <YourStaticsCard
          staticSuggestions={[{ name: 'S1', shareCode: 'S1', recruitmentStatus: 'open', neededJobs: [], neededRoles: [], matchingJobs: [], matchingRoles: [], dataCenter: null, intensity: null }]}
          onCreateStatic={onCreateStatic}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/1 static.*match/i)).toBeInTheDocument();
  });
});

describe('YourStaticsCard — empty state', () => {
  it('empty state shows Create a static and Find a static buttons', () => {
    renderCard([]);
    expect(screen.getByRole('button', { name: /create a static/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /find a static/i })).toBeInTheDocument();
  });

  it('Create a static calls onCreateStatic', () => {
    renderCard([]);
    fireEvent.click(screen.getByRole('button', { name: /create a static/i }));
    expect(onCreateStatic).toHaveBeenCalledTimes(1);
  });
});

describe('YourStaticsCard — error banner', () => {
  it('error banner shows above rows with Retry and Dismiss', () => {
    storeState.groups = [makeGroup()];
    storeState.error = 'Network error';
    storeState.isLoading = false;
    render(<MemoryRouter><YourStaticsCard staticSuggestions={[]} onCreateStatic={onCreateStatic} /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    // rows still visible
    expect(screen.getByText('Test Static')).toBeInTheDocument();
  });

  it('error with no statics replaces the body', () => {
    storeState.groups = [];
    storeState.error = 'Load failed';
    storeState.isLoading = false;
    render(<MemoryRouter><YourStaticsCard staticSuggestions={[]} onCreateStatic={onCreateStatic} /></MemoryRouter>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Test Static')).toBeNull();
  });

  it('Retry calls fetchGroups', () => {
    storeState.groups = [];
    storeState.error = 'Load failed';
    storeState.fetchGroups.mockResolvedValue(undefined);
    render(<MemoryRouter><YourStaticsCard staticSuggestions={[]} onCreateStatic={onCreateStatic} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(storeState.fetchGroups).toHaveBeenCalledTimes(1);
  });

  it('Dismiss calls clearError', () => {
    storeState.groups = [];
    storeState.error = 'Load failed';
    render(<MemoryRouter><YourStaticsCard staticSuggestions={[]} onCreateStatic={onCreateStatic} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(storeState.clearError).toHaveBeenCalledTimes(1);
  });
});
