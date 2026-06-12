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
import type { PlayerBisTargetSet } from '../../stores/playerProfileStore';

const mockFetchBisTargets = vi.fn().mockResolvedValue(undefined);
const mockCreateBisTarget = vi.fn();
const mockUpdateBisTarget = vi.fn();
const mockDeleteBisTarget = vi.fn();
const mockSetBisTargetActive = vi.fn();

const storeMock = {
  bisTargets: {} as Record<string, PlayerBisTargetSet[]>,
  fetchBisTargets: mockFetchBisTargets,
  createBisTarget: mockCreateBisTarget,
  updateBisTarget: mockUpdateBisTarget,
  deleteBisTarget: mockDeleteBisTarget,
  setBisTargetActive: mockSetBisTargetActive,
};

vi.mock('../../stores/playerProfileStore', async () => {
  const actual = await vi.importActual<typeof import('../../stores/playerProfileStore')>('../../stores/playerProfileStore');
  return {
    ...actual,
    usePlayerProfileStore: () => storeMock,
  };
});

vi.mock('../../stores/toastStore', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function makeTarget(overrides: Partial<PlayerBisTargetSet> = {}): PlayerBisTargetSet {
  return {
    id: 'target-1',
    profileId: 'profile-1',
    jobProfileId: 'jp-1',
    job: 'BRD',
    name: 'Prog Set',
    purpose: 'savage',
    sourceType: 'xivgear',
    externalUrl: 'https://xivgear.app/share/test',
    importStatus: 'linked_only',
    isActive: false,
    itemLevel: null,
    notes: null,
    itemsJson: null,
    createdAt: '2026-06-12T00:00:00Z',
    updatedAt: '2026-06-12T00:00:00Z',
    ...overrides,
  };
}

function renderModal(overrides?: Partial<typeof storeMock>) {
  Object.assign(storeMock, overrides);
  return render(
    <ManageBiSModal jobProfileId="jp-1" job="BRD" onClose={vi.fn()} />
  );
}

describe('ManageBiSModal', () => {
  beforeEach(() => {
    storeMock.bisTargets = {};
    mockFetchBisTargets.mockReset().mockResolvedValue(undefined);
    mockCreateBisTarget.mockReset().mockResolvedValue(makeTarget());
    mockUpdateBisTarget.mockReset().mockResolvedValue(undefined);
    mockDeleteBisTarget.mockReset().mockResolvedValue(undefined);
    mockSetBisTargetActive.mockReset().mockResolvedValue(undefined);
  });

  it('renders the modal title with job display name', () => {
    renderModal();
    expect(screen.getByText(/BiS Targets — Bard/i)).toBeInTheDocument();
  });

  it('calls fetchBisTargets on mount', () => {
    renderModal();
    expect(mockFetchBisTargets).toHaveBeenCalledWith('jp-1');
  });

  it('shows empty state message when no targets', () => {
    renderModal();
    expect(screen.getByText(/No BiS targets configured/i)).toBeInTheDocument();
  });

  it('renders existing targets', () => {
    storeMock.bisTargets = { 'jp-1': [makeTarget()] };
    renderModal();
    expect(screen.getByText('Prog Set')).toBeInTheDocument();
    expect(screen.getByText('Savage')).toBeInTheDocument();
  });

  it('shows "Add target" button', () => {
    renderModal();
    expect(screen.getByTestId('add-bis-target-btn')).toBeInTheDocument();
  });

  it('shows add form when "Add target" clicked', () => {
    renderModal();
    fireEvent.click(screen.getByTestId('add-bis-target-btn'));
    expect(screen.getByTestId('bis-name-input')).toBeInTheDocument();
    expect(screen.getByText('New BiS target')).toBeInTheDocument();
  });

  it('calls createBisTarget when form submitted with a name', async () => {
    renderModal();
    fireEvent.click(screen.getByTestId('add-bis-target-btn'));
    const nameInput = screen.getByTestId('bis-name-input');
    fireEvent.change(nameInput, { target: { value: 'Farm BiS' } });
    // Wait for React to re-render with the new state
    const addBtn = await screen.findByRole('button', { name: 'Add' });
    await waitFor(() => expect(addBtn).not.toBeDisabled());
    fireEvent.click(addBtn);
    await waitFor(() => expect(mockCreateBisTarget).toHaveBeenCalledWith(
      'jp-1',
      expect.objectContaining({ name: 'Farm BiS' }),
    ));
  });

  it('shows active indicator on active target', () => {
    storeMock.bisTargets = { 'jp-1': [makeTarget({ isActive: true })] };
    renderModal();
    expect(screen.getByLabelText('Active')).toBeInTheDocument();
  });

  it('shows "Set active" button for inactive targets', () => {
    storeMock.bisTargets = { 'jp-1': [makeTarget({ isActive: false })] };
    renderModal();
    expect(screen.getByText('Set active')).toBeInTheDocument();
  });

  it('calls setBisTargetActive when "Set active" clicked', async () => {
    storeMock.bisTargets = { 'jp-1': [makeTarget({ isActive: false })] };
    renderModal();
    fireEvent.click(screen.getByText('Set active'));
    await waitFor(() => expect(mockSetBisTargetActive).toHaveBeenCalledWith('jp-1', 'target-1'));
  });

  it('calls deleteBisTarget when delete button clicked', async () => {
    storeMock.bisTargets = { 'jp-1': [makeTarget()] };
    renderModal();
    fireEvent.click(screen.getByLabelText('Remove BiS target'));
    await waitFor(() => expect(mockDeleteBisTarget).toHaveBeenCalledWith('jp-1', 'target-1'));
  });
});
