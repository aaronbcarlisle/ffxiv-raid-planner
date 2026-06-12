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
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManageBiSModal } from './ManageBiSModal';
import type { SharedBiSTargetSet, BiSOwnerType } from '../../types';

const mockFetchTargets = vi.fn().mockResolvedValue(undefined);
const mockCreateTarget = vi.fn();
const mockUpdateTarget = vi.fn();
const mockDeleteTarget = vi.fn();
const mockSetTargetActive = vi.fn();
const mockCreateMultipleTargets = vi.fn();

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
    }),
  };
});

vi.mock('../../stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../services/api', () => ({
  fetchBiSPresets: vi.fn().mockResolvedValue({ job: 'BRD', presets: [] }),
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
});
