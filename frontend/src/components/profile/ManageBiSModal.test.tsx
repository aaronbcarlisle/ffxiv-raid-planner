/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
});
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManageBiSModal } from './ManageBiSModal';
import { fetchBiSFromXIVGear } from '../../services/api';
import type { SharedBiSTargetSet, BiSOwnerType } from '../../types';

const mockFetchTargets = vi.fn().mockResolvedValue(undefined);
const mockCreateTarget = vi.fn();
const mockUpdateTarget = vi.fn();
const mockDeleteTarget = vi.fn();
const mockSetTargetActive = vi.fn();
const mockCreateMultipleTargets = vi.fn();
const mockImportTarget = vi.fn();

function makeSharedTarget(overrides: Partial<SharedBiSTargetSet> = {}): SharedBiSTargetSet {
  return {
    id: 'target-1',
    ownerType: 'player_job_profile' as BiSOwnerType,
    ownerId: 'jp-1',
    jobProfileId: 'jp-1',
    snapshotPlayerId: null,
    groupId: null,
    profileId: 'profile-1',
    job: 'BRD',
    name: 'Prog Set',
    purpose: 'savage',
    sourceType: 'xivgear',
    externalUrl: 'https://xivgear.app/share/test',
    importStatus: 'linked_only',
    isActive: false,
    isPublic: false,
    patch: null,
    itemLevel: null,
    notes: null,
    itemsJson: null,
    createdBy: null,
    createdAt: '2026-06-12T00:00:00Z',
    updatedAt: '2026-06-12T00:00:00Z',
    ...overrides,
  };
}

const sharedStoreState: {
  targets: Record<string, SharedBiSTargetSet[]>;
} = {
  targets: {},
};

vi.mock('../../stores/sharedBisStore', async () => {
  const actual = await vi.importActual<typeof import('../../stores/sharedBisStore')>('../../stores/sharedBisStore');
  return {
    ...actual,
    useSharedBisStore: () => ({
      getTargets: (ownerType: string, ownerId: string) =>
        sharedStoreState.targets[`${ownerType}:${ownerId}`] ?? [],
      getActive: (ownerType: string, ownerId: string, job: string) =>
        (sharedStoreState.targets[`${ownerType}:${ownerId}`] ?? []).find(
          (t) => t.job.toUpperCase() === job.toUpperCase() && t.isActive,
        ) ?? null,
      isLoading: () => false,
      fetchTargets: mockFetchTargets,
      createTarget: mockCreateTarget,
      createMultipleTargets: mockCreateMultipleTargets,
      updateTarget: mockUpdateTarget,
      deleteTarget: mockDeleteTarget,
      setTargetActive: mockSetTargetActive,
      importTarget: mockImportTarget,
    }),
  };
});

vi.mock('../../stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../services/api', () => ({
  fetchBiSPresets: vi.fn().mockResolvedValue({ job: 'BRD', presets: [] }),
  fetchBiSFromXIVGear: vi.fn(),
  withXivGearSetIndex: (url: string, setIndex: number) => {
    const parsed = new URL(url);
    parsed.searchParams.set('selectedIndex', String(setIndex));
    return parsed.toString();
  },
}));

function renderModal() {
  return render(
    <ManageBiSModal jobProfileId="jp-1" job="BRD" onClose={vi.fn()} />,
  );
}

describe('ManageBiSModal', () => {
  beforeEach(() => {
    sharedStoreState.targets = {};
    mockFetchTargets.mockReset().mockResolvedValue(undefined);
    mockCreateTarget.mockReset().mockResolvedValue(makeSharedTarget());
    mockUpdateTarget.mockReset().mockResolvedValue(makeSharedTarget());
    mockDeleteTarget.mockReset().mockResolvedValue(undefined);
    mockSetTargetActive.mockReset().mockResolvedValue(undefined);
    mockCreateMultipleTargets.mockReset().mockResolvedValue([]);
    mockImportTarget.mockReset().mockResolvedValue(undefined);
    vi.mocked(fetchBiSFromXIVGear).mockReset();
  });

  it('renders the modal title with job display name', () => {
    renderModal();
    expect(screen.getByText(/BiS Targets — Bard/i)).toBeInTheDocument();
  });

  it('calls fetchTargets on mount with player_job_profile owner type', () => {
    renderModal();
    expect(mockFetchTargets).toHaveBeenCalledWith('player_job_profile', 'jp-1');
  });

  it('shows empty state message when no targets', () => {
    renderModal();
    expect(screen.getByText(/No BiS targets yet/i)).toBeInTheDocument();
  });

  it('renders existing targets', () => {
    sharedStoreState.targets['player_job_profile:jp-1'] = [makeSharedTarget()];
    renderModal();
    expect(screen.getByText('Prog Set')).toBeInTheDocument();
    expect(screen.getByText('Savage')).toBeInTheDocument();
  });

  it('shows "Set active" button for inactive targets', () => {
    sharedStoreState.targets['player_job_profile:jp-1'] = [makeSharedTarget({ isActive: false })];
    renderModal();
    expect(screen.getByText('Set active')).toBeInTheDocument();
  });

  it('calls setTargetActive when "Set active" clicked', async () => {
    sharedStoreState.targets['player_job_profile:jp-1'] = [makeSharedTarget({ isActive: false })];
    renderModal();
    fireEvent.click(screen.getByText('Set active'));
    await waitFor(() =>
      expect(mockSetTargetActive).toHaveBeenCalledWith('target-1', 'player_job_profile', 'jp-1'),
    );
  });

  it('shows active indicator on active target', () => {
    sharedStoreState.targets['player_job_profile:jp-1'] = [makeSharedTarget({ isActive: true })];
    renderModal();
    expect(screen.getByLabelText('Active')).toBeInTheDocument();
  });

  it('calls deleteTarget when delete button clicked', async () => {
    sharedStoreState.targets['player_job_profile:jp-1'] = [makeSharedTarget()];
    renderModal();
    fireEvent.click(screen.getByLabelText('Remove BiS target'));
    await waitFor(() =>
      expect(mockDeleteTarget).toHaveBeenCalledWith('target-1', 'player_job_profile', 'jp-1'),
    );
  });

  it('shows Manual tab and can open add form', async () => {
    renderModal();
    fireEvent.click(screen.getByText('Manual'));
    expect(await screen.findByTestId('bis-name-input')).toBeInTheDocument();
  });

  it('calls createTarget when manual form submitted with a name', async () => {
    mockCreateTarget.mockResolvedValue(makeSharedTarget({ name: 'Farm BiS' }));
    renderModal();
    fireEvent.click(screen.getByText('Manual'));
    const nameInput = await screen.findByTestId('bis-name-input');
    fireEvent.change(nameInput, { target: { value: 'Farm BiS' } });
    const addBtn = await screen.findByRole('button', { name: 'Add' });
    await waitFor(() => expect(addBtn).not.toBeDisabled());
    fireEvent.click(addBtn);
    await waitFor(() =>
      expect(mockCreateTarget).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Farm BiS', ownerType: 'player_job_profile', ownerId: 'jp-1' }),
      ),
    );
  });

  it('requires selecting a XivGear set when a pasted sheet has multiple sets', async () => {
    vi.mocked(fetchBiSFromXIVGear).mockResolvedValue({
      name: 'WHM Sheet',
      job: 'WHM',
      slots: [],
      requiresSelection: true,
      selectedSetIndex: null,
      originalUrl: 'https://xivgear.app/?page=sl|sheet-id',
      setOptions: [
        { index: 1, name: '2.44 Savage BiS', job: 'WHM', gcd: '2.44' },
        { index: 2, name: '2.29 High DPS', job: 'WHM', gcd: '2.29' },
      ],
    });

    renderModal();
    fireEvent.click(screen.getByText('Paste Link'));
    fireEvent.change(screen.getByTestId('bis-link-url-input'), {
      target: { value: 'https://xivgear.app/?page=sl|sheet-id' },
    });
    const addButton = screen.getByTestId('add-link-btn');
    await waitFor(() => expect(addButton).not.toBeDisabled());
    fireEvent.click(addButton);

    expect(await screen.findByText(/2.44 Savage BiS/)).toBeInTheDocument();
    expect(fetchBiSFromXIVGear).toHaveBeenCalledWith('https://xivgear.app/?page=sl|sheet-id');
    expect(mockCreateTarget).not.toHaveBeenCalled();
  });

  it('stores the chosen XivGear set index when adding a multi-set link', async () => {
    vi.mocked(fetchBiSFromXIVGear).mockResolvedValue({
      name: 'WHM Sheet',
      job: 'WHM',
      slots: [],
      requiresSelection: true,
      selectedSetIndex: null,
      originalUrl: 'https://xivgear.app/?page=sl|sheet-id',
      setOptions: [
        { index: 1, name: '2.44 Savage BiS', job: 'WHM', gcd: '2.44' },
        { index: 2, name: '2.29 High DPS', job: 'WHM', gcd: '2.29' },
      ],
    });
    mockCreateTarget.mockResolvedValue(makeSharedTarget({ id: 'selected-set-target' }));

    renderModal();
    fireEvent.click(screen.getByText('Paste Link'));
    fireEvent.change(screen.getByTestId('bis-link-url-input'), {
      target: { value: 'https://xivgear.app/?page=sl|sheet-id' },
    });
    const addButton = screen.getByTestId('add-link-btn');
    await waitFor(() => expect(addButton).not.toBeDisabled());
    fireEvent.click(addButton);

    await screen.findByText(/2.44 Savage BiS/);
    fireEvent.click(addButton);

    await waitFor(() =>
      expect(mockCreateTarget).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '2.44 Savage BiS',
          externalUrl: expect.stringContaining('selectedIndex=1'),
        }),
      ),
    );
    expect(mockImportTarget).toHaveBeenCalledWith(
      'selected-set-target',
      'player_job_profile',
      'jp-1',
    );
  });
});
