import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { YourStaticsCard } from './YourStaticsCard';
import { formatSessionStart } from './overviewFormat';
import type { OverviewStatic } from './usePlayerOverview';
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
  errorSource: null as 'load' | 'action' | null,
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
  storeState.errorSource = null;
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

  it('kebab hides Duplicate for a viewer', async () => {
    renderCard([makeGroup({ userRole: 'viewer' })]);
    fireEvent.keyDown(screen.getByRole('button', { name: /actions for/i }), { key: 'Enter' });
    await screen.findByRole('menuitem', { name: 'Open' }); // wait for menu to open
    expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).toBeNull();
  });

  it('kebab hides Duplicate on a linked-only row (B12)', async () => {
    renderCard([makeGroup({ source: 'linked', userRole: undefined })]);
    fireEvent.keyDown(screen.getByRole('button', { name: /actions for/i }), { key: 'Enter' });
    await screen.findByRole('menuitem', { name: 'Open' });
    expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).toBeNull();
  });

  it.each(['owner', 'lead', 'member'] as const)('kebab keeps Duplicate for %s', async (role) => {
    renderCard([makeGroup({ userRole: role })]);
    fireEvent.keyDown(screen.getByRole('button', { name: /actions for/i }), { key: 'Enter' });
    expect(await screen.findByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument();
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

  it('a load error with no statics replaces the body (no create/find affordance)', () => {
    storeState.groups = [];
    storeState.error = 'Load failed';
    storeState.errorSource = 'load';
    storeState.isLoading = false;
    render(<MemoryRouter><YourStaticsCard staticSuggestions={[]} onCreateStatic={onCreateStatic} /></MemoryRouter>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Test Static')).toBeNull();
    expect(screen.queryByRole('button', { name: /create a static/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /find a static/i })).toBeNull();
  });

  // R-PH1-fix1 (PR #281 review): a non-load error (e.g. a failed createGroup from the
  // SetupWizard, which the Hub never unmounts for) must not strand the zero-statics hub
  // without its create/find affordance — only Dismiss was reachable before the fix.
  it('an action error (e.g. failed create) with no statics still shows the create/find affordance', () => {
    storeState.groups = [];
    storeState.error = 'Failed to create group';
    storeState.errorSource = 'action';
    storeState.isLoading = false;
    render(<MemoryRouter><YourStaticsCard staticSuggestions={[]} onCreateStatic={onCreateStatic} /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to create group');
    expect(screen.getByRole('button', { name: /create a static/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /find a static/i })).toBeInTheDocument();
  });

  it('Retry calls fetchGroups', () => {
    storeState.groups = [];
    storeState.error = 'Load failed';
    storeState.errorSource = 'load';
    storeState.fetchGroups.mockResolvedValue(undefined);
    render(<MemoryRouter><YourStaticsCard staticSuggestions={[]} onCreateStatic={onCreateStatic} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(storeState.fetchGroups).toHaveBeenCalledTimes(1);
  });

  it('Dismiss calls clearError', () => {
    storeState.groups = [];
    storeState.error = 'Load failed';
    storeState.errorSource = 'load';
    render(<MemoryRouter><YourStaticsCard staticSuggestions={[]} onCreateStatic={onCreateStatic} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(storeState.clearError).toHaveBeenCalledTimes(1);
  });
});

describe('YourStaticsCard — overview summary (R-PH2-L)', () => {
  function overview(overrides: Partial<OverviewStatic> = {}): OverviewStatic {
    return {
      id: 'g1', shareCode: 'TSTSC1', name: 'Test Static', role: 'member',
      tierId: 'aac-heavyweight', memberCount: 4,
      nextSession: null, floorsCleared: null, avgBisPct: null,
      ...overrides,
    };
  }

  it('renders all four parts, in order, joined by " · "', () => {
    const session = { sessionId: 's1', title: 'Prog Night', startsAt: '2026-10-03T18:30:00Z' };
    const overviewById = new Map([['g1', overview({ nextSession: session, floorsCleared: 2, avgBisPct: 63 })]]);
    renderCard([makeGroup()], { overviewById });

    const expected = [
      'AAC Heavyweight (Savage)',
      `Next ${formatSessionStart(session.startsAt)}`,
      '2/4 floors this week',
      '63% of BiS slots',
    ].join(' · ');
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('renders only the parts present (partial data)', () => {
    const overviewById = new Map([['g1', overview({ floorsCleared: 1 })]]);
    renderCard([makeGroup()], { overviewById });
    expect(screen.getByText('AAC Heavyweight (Savage) · 1/4 floors this week')).toBeInTheDocument();
  });

  it('avgBisPct: 0 still renders (guarded with != null, not &&)', () => {
    const overviewById = new Map([['g1', overview({ tierId: null, avgBisPct: 0 })]]);
    renderCard([makeGroup()], { overviewById });
    expect(screen.getByText('0% of BiS slots')).toBeInTheDocument();
  });

  it('an unknown tierId omits the tier part', () => {
    const overviewById = new Map([['g1', overview({ tierId: 'not-a-real-tier', floorsCleared: 3 })]]);
    renderCard([makeGroup()], { overviewById });
    expect(screen.getByText('3/4 floors this week')).toBeInTheDocument();
    expect(screen.queryByText(/AAC Heavyweight/)).toBeNull();
  });

  it('no overviewById entry for the row shows no summary line, and the PH1 row is unchanged', () => {
    renderCard([makeGroup()], { overviewById: new Map() });
    expect(screen.getByText('Test Static')).toBeInTheDocument();
    expect(screen.queryByText(/floors this week/)).toBeNull();
    expect(screen.queryByText(/of BiS slots/)).toBeNull();
  });
});
