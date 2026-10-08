/**
 * @vitest-environment jsdom
 *
 * W0 DEL-1 Task 1: the Settings -> Goals & Farms farm row asks before it deletes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPanel } from './SettingsPanel';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import { toast } from '../../stores/toastStore';
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

const deleteGoal = vi.fn();
const fetchGoals = vi.fn(async () => {});

function goal(id: string, title: string) {
  return { id, title, status: 'wanted', currentCount: null, targetCount: null };
}

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }))
  );
  deleteGoal.mockReset();
  deleteGoal.mockResolvedValue(undefined);
  useSettingsPanelStore.setState({ tab: 'goals' } as never);
  useCollectionGoalStore.setState({
    goals: [goal('goal-1', 'Alpha Mount'), goal('goal-2', 'Beta Minion')],
    isLoading: false,
    fetchGoals,
    deleteGoal,
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function group(role: StaticGroup['userRole']): StaticGroup {
  return { id: 'g1', name: 'S', shareCode: 'c', userRole: role, settings: {} } as StaticGroup;
}
const players: SnapshotPlayer[] = [];

function renderFarms(role: StaticGroup['userRole'] = 'owner') {
  return render(
    <MemoryRouter initialEntries={['/?gsub=farms']}>
      <SettingsPanel isOpen container="dock" onClose={vi.fn()} group={group(role)} players={players} />
    </MemoryRouter>
  );
}

const DIALOG_TITLE = 'Delete Farm';

describe('Settings farm delete confirm', () => {
  it('opens a dialog that names the farm and does not delete yet', async () => {
    renderFarms();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha Mount' }));

    expect(await screen.findByText(DIALOG_TITLE)).toBeInTheDocument();
    expect(screen.getByText(/Delete "Alpha Mount"\?/)).toBeInTheDocument();
    expect(deleteGoal).not.toHaveBeenCalled();
  });

  it('confirm deletes exactly that farm once and closes the dialog', async () => {
    renderFarms();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Beta Minion' }));
    await screen.findByText(DIALOG_TITLE);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByText(DIALOG_TITLE)).not.toBeInTheDocument());
    expect(deleteGoal).toHaveBeenCalledTimes(1);
    expect(deleteGoal).toHaveBeenCalledWith('g1', 'goal-2');
  });

  it('cancel closes the dialog and never deletes', async () => {
    renderFarms();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha Mount' }));
    await screen.findByText(DIALOG_TITLE);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText(DIALOG_TITLE)).not.toBeInTheDocument());
    expect(deleteGoal).not.toHaveBeenCalled();
  });

  it('each trash button names its own farm', () => {
    renderFarms();
    expect(screen.getByRole('button', { name: 'Delete Alpha Mount' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Beta Minion' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('the trash button is revealed on keyboard focus', () => {
    renderFarms();
    expect(screen.getByRole('button', { name: 'Delete Alpha Mount' }).className).toContain(
      'focus-visible:opacity-100'
    );
  });

  it('a failed delete keeps the row, toasts, and closes the dialog', async () => {
    const toastError = vi.spyOn(toast, 'error').mockReturnValue('t');
    deleteGoal.mockRejectedValue(new Error('boom'));
    renderFarms();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha Mount' }));
    await screen.findByText(DIALOG_TITLE);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to delete farm'));
    await waitFor(() => expect(screen.queryByText(DIALOG_TITLE)).not.toBeInTheDocument());
    expect(screen.getAllByTestId('collection-goal-row')).toHaveLength(2);
    expect(screen.getByText('Alpha Mount')).toBeInTheDocument();
  });

  it('Escape closes the dialog and never deletes', async () => {
    renderFarms();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha Mount' }));
    await screen.findByText(DIALOG_TITLE);

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByText(DIALOG_TITLE)).not.toBeInTheDocument());
    expect(deleteGoal).not.toHaveBeenCalled();
  });

  it('a double-clicked Delete calls the store once', async () => {
    deleteGoal.mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));
    renderFarms();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha Mount' }));
    await screen.findByText(DIALOG_TITLE);

    const confirm = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(screen.queryByText(DIALOG_TITLE)).not.toBeInTheDocument());
    expect(deleteGoal).toHaveBeenCalledTimes(1);
  });

  it('a member sees no trash button', () => {
    renderFarms('member');
    expect(screen.getAllByTestId('collection-goal-row')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
  });
});
