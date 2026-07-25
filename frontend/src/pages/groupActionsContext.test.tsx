/**
 * groupActionsContext — context + shared GroupActionModals (F6a, Task 8).
 *
 * Locks the Task-8 contract:
 *   - calling a context action (onNewTier / onAddPlayer / …) opens its modal and
 *     flips `isActionModalOpen` true;
 *   - context actions go through the typed callbacks ONLY — they do NOT
 *     `window.dispatchEvent` any `header:*` CustomEvent (that bus is now only the
 *     legacy Header→GroupView bridge, not the chrome→modal path);
 *   - `useGroupActions()` throws outside a provider.
 *
 * Stores + heavy modal leaves are mocked — the point is the context wiring, not
 * the modals' internals.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

// ── Stores ──
const currentGroup = { id: 'g1', name: 'Test Static', shareCode: 'DEVTST', settings: {}, userRole: 'owner' };
const currentTier = { id: 'snap1', tierId: 'm5s', players: [] as unknown[] };
vi.mock('../stores/staticGroupStore', () => ({ useStaticGroupStore: () => ({ currentGroup }) }));
vi.mock('../stores/tierStore', () => ({
  useTierStore: () => ({ tiers: [currentTier], currentTier, addPlayer: vi.fn(), updatePlayer: vi.fn(), fetchTier: vi.fn() }),
}));
vi.mock('../stores/joinRequestStore', () => ({ useJoinRequestStore: () => ({ linkRoster: vi.fn() }) }));
vi.mock('../stores/settingsPanelStore', () => ({ useSettingsPanelStore: { getState: () => ({ close: vi.fn() }) } }));
vi.mock('../stores/toastStore', () => ({ toast: { success: vi.fn(), warning: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('../gamedata', () => ({ getTierById: () => ({ name: 'Test Tier' }) }));

// ── Modal leaves: lightweight markers ──
vi.mock('../components/static-group', () => ({
  CreateTierModal: () => <div data-testid="create-tier-modal" />,
  RolloverDialog: () => <div data-testid="rollover-dialog" />,
  DeleteTierModal: () => <div data-testid="delete-tier-modal" />,
}));
vi.mock('../components/player/AddPlayerModal', () => ({
  AddPlayerModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="add-player-modal" /> : null),
}));

import { GroupActionModals, useGroupActions, useGroupActionModalOpen } from './groupActionsContext';

function Consumer() {
  const actions = useGroupActions();
  const open = useGroupActionModalOpen();
  return (
    <div>
      <span data-testid="modal-open">{String(open)}</span>
      <button onClick={() => actions.onNewTier()}>new-tier</button>
      <button onClick={() => actions.onAddPlayer()}>add-player</button>
      <button onClick={() => actions.onRollover()}>rollover</button>
      <button onClick={() => actions.onDeleteTier()}>delete-tier</button>
      <button onClick={() => actions.onTierChange('m6s')}>tier-change</button>
    </div>
  );
}

const renderModals = () =>
  render(
    <MemoryRouter>
      <GroupActionModals><Consumer /></GroupActionModals>
    </MemoryRouter>
  );

describe('groupActionsContext', () => {
  it('opens the create-tier modal and flips isActionModalOpen when onNewTier is called', () => {
    renderModals();
    expect(screen.getByTestId('modal-open').textContent).toBe('false');
    expect(screen.queryByTestId('create-tier-modal')).toBeNull();

    fireEvent.click(screen.getByText('new-tier'));

    expect(screen.getByTestId('create-tier-modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-open').textContent).toBe('true');
  });

  it('opens the add-player modal and flips isActionModalOpen when onAddPlayer is called', () => {
    renderModals();
    expect(screen.queryByTestId('add-player-modal')).toBeNull();

    fireEvent.click(screen.getByText('add-player'));

    expect(screen.getByTestId('add-player-modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-open').textContent).toBe('true');
  });

  it('context actions do NOT dispatch any header:* window events', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    renderModals();

    fireEvent.click(screen.getByText('new-tier'));
    fireEvent.click(screen.getByText('tier-change'));
    fireEvent.click(screen.getByText('rollover'));
    fireEvent.click(screen.getByText('add-player'));
    fireEvent.click(screen.getByText('delete-tier'));

    const headerEvents = dispatchSpy.mock.calls.filter(
      ([e]) => e instanceof Event && e.type.startsWith('header:')
    );
    expect(headerEvents).toHaveLength(0);
    dispatchSpy.mockRestore();
  });

  it('useGroupActions throws when used outside a provider', () => {
    function Outside() {
      useGroupActions();
      return null;
    }
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Outside />)).toThrow();
    errSpy.mockRestore();
  });
});
