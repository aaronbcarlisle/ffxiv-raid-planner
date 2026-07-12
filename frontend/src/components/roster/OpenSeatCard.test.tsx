// `@testing-library/user-event` is not a dependency of this project, so this
// suite drives interaction via `fireEvent` (established convention — see
// RosterToolbar.test.tsx). OpenSeatCard is the Phase A A1 open-seat card:
// per-seat Configure (inline name + JobPicker form, role derived from job)
// and Remove affordances, both gated on the roster-manage permission
// (`canManage` — same gate legacy EmptySlotCard/InlinePlayerEdit use).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SnapshotPlayer } from '../../types';
import { OpenSeatCard } from './OpenSeatCard';
import { useToastStore } from '../../stores/toastStore';

function makeOpenSeat(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p9',
    tierSnapshotId: 't1',
    name: '',
    job: '',
    role: 'healer',
    configured: false,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {},
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '',
    updatedAt: '',
    position: 'H1',
    templateRole: 'pure-healer',
    ...overrides,
  } as unknown as SnapshotPlayer;
}

const onConfigure = vi.fn();
const onRemove = vi.fn();

beforeEach(() => {
  onRemove.mockClear();
  onConfigure.mockReset();
  useToastStore.setState({ toasts: [] });
});

describe('OpenSeatCard', () => {
  it('renders the seat title with Configure + Remove affordances for a manager', () => {
    render(
      <OpenSeatCard player={makeOpenSeat()} canManage onConfigure={onConfigure} onRemove={onRemove} />
    );
    // TEMPLATE_ROLE_INFO['pure-healer'].shortLabel === 'Healer'.
    expect(screen.getByText('Open seat · Healer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove open seat' })).toBeInTheDocument();
  });

  it('hides both affordances when the user cannot manage the roster', () => {
    render(
      <OpenSeatCard
        player={makeOpenSeat()}
        canManage={false}
        onConfigure={onConfigure}
        onRemove={onRemove}
      />
    );
    expect(screen.getByText('Open seat · Healer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configure' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove open seat' })).toBeNull();
  });

  it('renders no Remove affordance when onRemove is not provided', () => {
    render(<OpenSeatCard player={makeOpenSeat()} canManage onConfigure={onConfigure} />);
    expect(screen.queryByRole('button', { name: 'Remove open seat' })).toBeNull();
  });

  it('fires onRemove when the Remove affordance is clicked', () => {
    render(
      <OpenSeatCard player={makeOpenSeat()} canManage onConfigure={onConfigure} onRemove={onRemove} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove open seat' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('disables Save until BOTH a non-empty name and a job are set (legacy InlinePlayerEdit guard)', () => {
    render(
      <OpenSeatCard player={makeOpenSeat()} canManage onConfigure={onConfigure} onRemove={onRemove} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));

    // Form open, both fields empty → disabled.
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    // Name only → still disabled (no job picked).
    fireEvent.change(screen.getByLabelText('Player name'), { target: { value: 'Aria Moonfall' } });
    expect(save).toBeDisabled();

    // Pick a job from the template quick-select (pure-healer → WHM available).
    fireEvent.click(screen.getByTitle('WHM - White Mage'));
    expect(save).toBeEnabled();

    // Whitespace-only name → disabled again (trim guard).
    fireEvent.change(screen.getByLabelText('Player name'), { target: { value: '   ' } });
    expect(save).toBeDisabled();
  });

  it('submits trimmed name + job + role DERIVED from the job via getRoleForJob', () => {
    render(
      <OpenSeatCard player={makeOpenSeat()} canManage onConfigure={onConfigure} onRemove={onRemove} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.change(screen.getByLabelText('Player name'), { target: { value: '  Aria Moonfall  ' } });
    fireEvent.click(screen.getByTitle('WHM - White Mage'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onConfigure).toHaveBeenCalledTimes(1);
    expect(onConfigure).toHaveBeenCalledWith('Aria Moonfall', 'WHM', 'healer');
  });

  it('Cancel closes the form and returns to the invite state', () => {
    render(
      <OpenSeatCard player={makeOpenSeat()} canManage onConfigure={onConfigure} onRemove={onRemove} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.getByLabelText('Player name')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Player name')).toBeNull();
    expect(screen.getByRole('button', { name: 'Configure' })).toBeInTheDocument();
    expect(onConfigure).not.toHaveBeenCalled();
  });

  // A10 void'd-promise sweep (carry-forward from Task 2's review): onConfigure
  // chains to handleConfigurePlayer -> tierStore.updatePlayer, which re-throws
  // after rollback — the old `void onConfigure(...)` call let a rejected
  // configure escape as an unhandled rejection with no error surfaced.
  it('a rejected onConfigure surfaces an error toast instead of an unhandled rejection', async () => {
    onConfigure.mockRejectedValueOnce(new Error('configure failed'));
    render(
      <OpenSeatCard player={makeOpenSeat()} canManage onConfigure={onConfigure} onRemove={onRemove} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.change(screen.getByLabelText('Player name'), { target: { value: 'Aria Moonfall' } });
    fireEvent.click(screen.getByTitle('WHM - White Mage'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === 'configure failed',
      )).toBe(true);
    });
  });
});
