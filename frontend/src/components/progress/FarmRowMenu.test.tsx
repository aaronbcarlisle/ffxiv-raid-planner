/**
 * FarmRowMenu and the panel's Mark finished (S2a-3a·G4 Task TG7; D-9, D-10, D-11, D-22, R-S3-8,
 * R-S3-17). The REAL store runs over a mocked `api` (a fake PUT that answers the status it was
 * sent); its legacy refetches are stubbed and `refreshGoalProgress` is a spy, as the other panel
 * tests do. The matrix and page cases (the grid column, the row following its status, Delete
 * closing the panel) are `ProgressMatrix.test.tsx`'s and `ProgressPage.rowMenu.test.tsx`'s.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/api')>()),
  api: { get: vi.fn().mockResolvedValue([]), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../services/api';
import { useToastStore } from '../../stores/toastStore';
import type { CollectionGoal } from '../../stores/collectionGoalStore';
import type { FarmRow } from '../../utils/progressModel';
import { installPanelStore, puts, renderPanel, restorePanelStore, toasts } from './__fixtures__/panelHarness';
import { apiGoal, farmRowOf, goal } from './__fixtures__/progressFixtures';
import { stubCanHover } from './__fixtures__/tooltipEnv';
import { FarmRowMenu } from './FarmRowMenu';

const GOAL_URL = '/api/static-groups/g1/collection-goals/wings';
const refresh = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  installPanelStore(refresh);
  // The server answers with the goal as written.
  vi.mocked(api.put).mockImplementation((_url: string, body?: unknown) =>
    Promise.resolve(apiGoal('wings', { title: 'Wings', status: (body as { status: string }).status }) as never),
  );
  vi.mocked(api.delete).mockResolvedValue(undefined as never);
});

afterEach(restorePanelStore);

function renderMenu(g: CollectionGoal = goal('wings', { title: 'Wings' })) {
  stubCanHover();
  return render(
    <table>
      <tbody>
        <tr>
          <td>
            <FarmRowMenu groupId="g1" goal={g} />
          </td>
        </tr>
      </tbody>
    </table>,
  );
}

const menuButton = () => screen.getByRole('button', { name: 'Actions for Wings' });
const openMenu = () => fireEvent.click(menuButton());
const items = () => screen.getAllByRole('menuitem').map((item) => item.textContent);
const pickItem = (name: string) => fireEvent.click(screen.getByRole('menuitem', { name }));

describe('FarmRowMenu: the menu (D-9, D-10, D-22)', () => {
  it('is an "Actions for {title}" button with a menu popup, opening Mark finished · Delete on an active row', () => {
    renderMenu();
    expect(menuButton()).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    openMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(items()).toEqual(['Mark finished', 'Delete']);
  });

  it.each(['wanted', 'farming', 'scheduled'] as const)('offers Mark finished, never Reopen, on a %s farm', (status) => {
    renderMenu(goal('wings', { title: 'Wings', status }));
    openMenu();
    expect(items()).toEqual(['Mark finished', 'Delete']);
  });

  it('opens Reopen · Delete on a finished row', () => {
    renderMenu(goal('wings', { title: 'Wings', status: 'complete', completedAt: '2026-10-01T00:00:00Z' }));
    openMenu();
    expect(items()).toEqual(['Reopen', 'Delete']);
  });

  it('closes on Escape and gives the focus back to the button', () => {
    renderMenu();
    openMenu();
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Mark finished' }), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(menuButton()).toHaveFocus();
  });
});

describe('FarmRowMenu: Mark finished (D-9, R-S3-8)', () => {
  it('sends status complete, toasts "Marked finished" with Undo, and refreshes with the lists', async () => {
    renderMenu();
    openMenu();
    pickItem('Mark finished');
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(puts()).toEqual([[GOAL_URL, { status: 'complete' }]]);
    expect(refresh).toHaveBeenCalledWith('g1', 'wings', { lists: true });
    expect(toasts()).toEqual([['success', 'Marked finished', 'Undo']]);
  });

  it.each(['wanted', 'farming', 'scheduled'] as const)(
    'Undo sends the status the farm held before: %s',
    async (prior) => {
      renderMenu(goal('wings', { title: 'Wings', status: prior }));
      openMenu();
      pickItem('Mark finished');
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

      await act(async () => {
        useToastStore.getState().toasts[0].action!.onClick();
      });
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
      expect(puts().map(([, body]) => body)).toEqual([{ status: 'complete' }, { status: prior }]);
      expect(refresh).toHaveBeenLastCalledWith('g1', 'wings', { lists: true });
      expect(toasts().map(([, message]) => message)).toContain('Undone');
    },
  );

  it('toasts a failure once, with no Undo and no refresh', async () => {
    vi.mocked(api.put).mockRejectedValue(new Error('boom'));
    renderMenu();
    openMenu();
    pickItem('Mark finished');
    await waitFor(() => expect(toasts()).toEqual([['error', "Couldn't mark it finished: boom", null]]));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('tells a failed Undo and leaves the farm as it is', async () => {
    renderMenu(goal('wings', { title: 'Wings', status: 'scheduled' }));
    openMenu();
    pickItem('Mark finished');
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    vi.mocked(api.put).mockRejectedValue(new Error('gone'));
    await act(async () => {
      useToastStore.getState().toasts[0].action!.onClick();
    });
    await waitFor(() => expect(toasts().map(([, message]) => message)).toContain("Couldn't undo: gone"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe('FarmRowMenu: Reopen (D-10)', () => {
  it('sends status farming and toasts "Reopened"', async () => {
    renderMenu(goal('wings', { title: 'Wings', status: 'complete', completedAt: '2026-10-01T00:00:00Z' }));
    openMenu();
    pickItem('Reopen');
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(puts()).toEqual([[GOAL_URL, { status: 'farming' }]]);
    expect(refresh).toHaveBeenCalledWith('g1', 'wings', { lists: true });
    expect(toasts()).toEqual([['success', 'Reopened', null]]);
  });
});

describe('FarmRowMenu: Delete (D-11)', () => {
  const dialog = () => screen.getByRole('dialog', { name: 'Delete Goal' });

  it('asks first, with the farm\'s title and V1\'s warning, and deletes nothing until confirmed', async () => {
    renderMenu();
    openMenu();
    pickItem('Delete');
    expect(within(dialog()).getByText('Delete "Wings"? This will remove all participant states and drop history for this goal.')).toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(GOAL_URL));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(toasts()).toEqual([['success', 'Goal deleted.', null]]);
  });

  it('cancels without deleting and gives the focus back to the button', async () => {
    renderMenu();
    openMenu();
    pickItem('Delete');
    await waitFor(() => expect(dialog()).toHaveFocus());
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();
    expect(menuButton()).toHaveFocus();
  });

  it('keeps the confirm open and toasts when the delete fails', async () => {
    vi.mocked(api.delete).mockRejectedValue(new Error('nope'));
    renderMenu();
    openMenu();
    pickItem('Delete');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(toasts()).toEqual([['error', "Couldn't delete the goal: nope", null]]));
    expect(dialog()).toBeInTheDocument();
  });
});

// ── The panel's action bar (D-22, R-S3-17) ───────────────────────────────────

describe('the panel: Mark finished when everyone has it', () => {
  const WINGS = goal('wings', { title: 'Wings', status: 'scheduled' });
  const rowWith = (tally: FarmRow['tally']): FarmRow => ({ ...farmRowOf([{ id: 'me', cell: { state: 'have' } }], WINGS), tally });
  const EVERYONE = { n: 2, m: 2, everyone: true };
  const markFinished = () => screen.queryByRole('button', { name: 'Mark finished' });

  it('is a Button in the lead\'s action bar, doing what the menu item does', async () => {
    const { panel } = renderPanel({ row: rowWith(EVERYONE), g: WINGS, userRole: 'lead', canManage: true });
    const button = within(within(panel).getByTestId('progress-expansion-actions')).getByRole('button', { name: 'Mark finished' });
    fireEvent.click(button);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(puts()).toEqual([[GOAL_URL, { status: 'complete' }]]);
    expect(refresh).toHaveBeenCalledWith('g1', 'wings', { lists: true });
    expect(toasts()).toEqual([['success', 'Marked finished', 'Undo']]);

    await act(async () => {
      useToastStore.getState().toasts[0].action!.onClick();
    });
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(puts()[1]).toEqual([GOAL_URL, { status: 'scheduled' }]);
  });

  it.each([
    ['not everyone has it', { n: 1, m: 2, everyone: false }, 'lead', true, false],
    ['nobody to track', { n: 0, m: 0, everyone: false }, 'lead', true, false],
    ['a member', EVERYONE, 'member', false, false],
    ['a viewer', EVERYONE, 'viewer', false, false],
    ['a viewer with manage access', EVERYONE, 'viewer', true, false],
    ['a finished row', EVERYONE, 'lead', true, true],
  ] as const)('is absent when %s', (_label, tally, userRole, canManage, finished) => {
    renderPanel({ row: rowWith(tally), g: WINGS, userRole, canManage, finished });
    expect(markFinished()).not.toBeInTheDocument();
  });

  it('is unavailable, yet keeps its focus, while a write is in flight, and sends one write for a double click', async () => {
    let release = () => {};
    vi.mocked(api.put).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(apiGoal('wings', { title: 'Wings', status: 'complete' }) as never);
        }),
    );
    renderPanel({ row: rowWith(EVERYONE), g: WINGS, userRole: 'lead', canManage: true });
    const button = markFinished()!;
    button.focus();
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'true'));
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(puts()).toHaveLength(1);

    await act(async () => release());
    await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled'));
    expect(puts()).toHaveLength(1);
  });
});
