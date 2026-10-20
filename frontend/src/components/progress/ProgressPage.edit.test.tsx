/**
 * ProgressPage and inline Edit (S2a-3a·G5 Task TG8; D-12, R-S3-4, R-S3-10, vet M-1, M-8): the row
 * menu's Edit opens the row with the block on top; a saved edit shows in About and closes the
 * block; Escape in the block (or in one of its selects) never closes the panel; and a block with
 * unsaved changes is never dropped silently: opening another row, closing the row and Mark
 * finished (menu and action bar) each ask "Discard changes?" first. The store is seeded as
 * `__fixtures__/pageHarness.tsx` does, with `updateGoal` replaced by a fake that edits the seeded
 * goals the way the real one does (the request itself is `FarmEditBlock.test.tsx`'s).
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({}),
      put: vi.fn().mockResolvedValue({}),
      patch: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
});

import { useToastStore } from '../../stores/toastStore';
import {
  NEEDY,
  EVERYONE,
  menuOf,
  nameOf,
  otherGroup,
  panel,
  pick,
  refreshGoalProgress,
  renderAt,
  seedPage,
  setUpPage,
  tearDownPage,
  trackOf,
  updateGoal,
} from './__fixtures__/pageHarness';
import { goal, row } from './__fixtures__/progressFixtures';

const GOALS = [
  goal('hot', { title: 'Hot Farm', summary: 'Original notes' }),
  goal('calm', { title: 'Calm Farm' }),
];
const seed = (participants = NEEDY, goals = GOALS) => seedPage(participants, goals);

const block = () => screen.queryByTestId('progress-edit-block');
const field = (name: string) => within(block()!).getByRole('textbox', { name });
const dirty = (value = 'Edited notes') => fireEvent.change(field('Notes'), { target: { value } });
const discardDialog = () => screen.queryByRole('dialog', { name: 'Discard changes?' });
const keepEditing = () => fireEvent.click(within(discardDialog()!).getByRole('button', { name: 'Keep editing' }));
const discard = () => fireEvent.click(within(discardDialog()!).getByRole('button', { name: 'Discard' }));

async function startEditing(id: string, title: string) {
  renderAt(`/?track=${id}`);
  await screen.findByTestId('progress-expansion');
  fireEvent.click(menuOf(title));
  pick('Edit');
  await screen.findByTestId('progress-edit-block');
}

beforeEach(() => {
  setUpPage();
  // jsdom has none.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(tearDownPage);

describe('the menu\'s Edit (vet M-1)', () => {
  it('reads Edit · Mark finished · Delete on an active row and Reopen · Delete on a finished one', async () => {
    seed(NEEDY, [...GOALS, goal('done', { title: 'Done Farm', status: 'complete', completedAt: '2026-10-01T00:00:00Z' })]);
    renderAt('/');
    await screen.findAllByTestId('progress-farm-row');
    fireEvent.click(menuOf('Hot Farm'));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Edit', 'Mark finished', 'Delete']);
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Edit' }), { key: 'Escape' });
  });

  it('opens a closed row with the block on top and the Title focused', async () => {
    seed();
    renderAt('/');
    await screen.findAllByTestId('progress-farm-row');
    expect(panel()).not.toBeInTheDocument();
    fireEvent.click(menuOf('Hot Farm'));
    pick('Edit');

    await screen.findByTestId('progress-edit-block');
    expect(trackOf()).toBe('hot');
    expect(nameOf('hot')).toHaveAttribute('aria-expanded', 'true');
    // On top: the block comes before the action bar in the panel.
    const body = within(panel()!).getByTestId('progress-expansion-body');
    expect(body.firstElementChild).toBe(block());
    await waitFor(() => expect(field('Title')).toHaveFocus());
    expect(field('Title')).toHaveValue('Hot Farm');
  });

  it('chosen again while editing, puts focus back on the Title', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    menuOf('Hot Farm').focus();
    fireEvent.click(menuOf('Hot Farm'));
    pick('Edit');
    await waitFor(() => expect(field('Title')).toHaveFocus());
    expect(field('Title').id).toBe('progress-expansion-hot-edit-title');
    expect(within(panel()!).getAllByRole('form')).toHaveLength(1);
  });

  it('enters the block on a row that is already open', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    expect(trackOf()).toBe('hot');
    expect(within(panel()!).getAllByRole('form')).toHaveLength(1);
  });

  it.each(['member', 'viewer'] as const)('is not offered to a %s: no menu, no block', async (userRole) => {
    seed();
    renderAt('/?track=hot', { userRole, canManage: false });
    await screen.findByTestId('progress-expansion');
    expect(screen.queryAllByRole('button', { name: /^Actions for / })).toHaveLength(0);
    expect(block()).not.toBeInTheDocument();
  });

  it('has no block on a finished row', async () => {
    seed({ ...NEEDY, done: [row('done', 'u1', { state: 'have' })] }, [
      ...GOALS,
      goal('done', { title: 'Done Farm', status: 'complete', completedAt: '2026-10-01T00:00:00Z' }),
    ]);
    renderAt('/?track=done');
    await screen.findByTestId('progress-expansion');
    fireEvent.click(menuOf('Done Farm'));
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
  });
});

describe('Save and Cancel', () => {
  it('Save writes, About follows, the block closes and focus returns to the row\'s menu button', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    expect(within(panel()!).getByTestId('progress-expansion-about')).toHaveTextContent('Original notes');
    dirty('Brand new notes');
    fireEvent.click(within(block()!).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(block()).not.toBeInTheDocument());
    expect(updateGoal).toHaveBeenCalledWith('g1', 'hot', { summary: 'Brand new notes' });
    expect(refreshGoalProgress).toHaveBeenCalledWith('g1', 'hot');
    expect(within(panel()!).getByTestId('progress-expansion-about')).toHaveTextContent('Brand new notes');
    expect(within(panel()!).getByTestId('progress-expansion-about')).not.toHaveTextContent('Original notes');
    expect(panel()).toBeInTheDocument();
    expect(trackOf()).toBe('hot');
    expect(menuOf('Hot Farm')).toHaveFocus();
  });

  it('clearing Notes saves null and About drops the line', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty('');
    fireEvent.click(within(block()!).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(block()).not.toBeInTheDocument());
    expect(updateGoal).toHaveBeenCalledWith('g1', 'hot', { summary: null });
    expect(within(panel()!).getByTestId('progress-expansion-about')).not.toHaveTextContent('Notes');
  });

  it('Cancel discards without asking and returns focus to the menu button', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    fireEvent.click(within(block()!).getByRole('button', { name: 'Cancel' }));
    expect(block()).not.toBeInTheDocument();
    expect(discardDialog()).not.toBeInTheDocument();
    expect(updateGoal).not.toHaveBeenCalled();
    expect(panel()).toBeInTheDocument();
    expect(menuOf('Hot Farm')).toHaveFocus();
  });
});

describe('Escape (R-S3-4, vet I-2)', () => {
  it('in a field discards the edit and leaves the panel open', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    fireEvent.keyDown(field('Notes'), { key: 'Escape' });
    expect(block()).not.toBeInTheDocument();
    expect(panel()).toBeInTheDocument();
    expect(trackOf()).toBe('hot');
    expect(discardDialog()).not.toBeInTheDocument();
  });

  it('inside an open Select closes only the select: the block keeps its edits and the panel stays open', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    fireEvent.keyDown(within(block()!).getByRole('combobox', { name: 'Status' }), { key: 'Enter' });
    const option = screen.getByRole('option', { name: 'Wanted' });
    fireEvent.keyDown(option, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('option', { name: 'Wanted' })).not.toBeInTheDocument());
    expect(block()).toBeInTheDocument();
    expect(field('Notes')).toHaveValue('Edited notes');
    expect(panel()).toBeInTheDocument();
    expect(trackOf()).toBe('hot');
    expect(discardDialog()).not.toBeInTheDocument();
  });

  it('outside the block, on a dirty edit, asks before the panel closes', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    fireEvent.keyDown(within(panel()!).getByRole('button', { name: 'Copy plan' }), { key: 'Escape' });
    expect(discardDialog()).toBeInTheDocument();
    expect(trackOf()).toBe('hot');
    keepEditing();
    expect(panel()).toBeInTheDocument();
    expect(field('Notes')).toHaveValue('Edited notes');
  });
});

describe('opening another row with unsaved changes (D-12)', () => {
  it('asks "Discard changes?"; Keep editing keeps both rows as they were', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    fireEvent.click(nameOf('calm'));

    expect(discardDialog()).toBeInTheDocument();
    expect(trackOf()).toBe('hot');
    keepEditing();
    expect(discardDialog()).not.toBeInTheDocument();
    expect(trackOf()).toBe('hot');
    expect(nameOf('calm')).toHaveAttribute('aria-expanded', 'false');
    expect(field('Notes')).toHaveValue('Edited notes');
    expect(updateGoal).not.toHaveBeenCalled();
  });

  it('Discard opens the other row and drops the edit', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    fireEvent.click(nameOf('calm'));
    discard();

    await waitFor(() => expect(trackOf()).toBe('calm'));
    expect(nameOf('calm')).toHaveAttribute('aria-expanded', 'true');
    expect(block()).not.toBeInTheDocument();
    expect(updateGoal).not.toHaveBeenCalled();
    // Back on the first row the edit has not come back.
    fireEvent.click(nameOf('hot'));
    await waitFor(() => expect(trackOf()).toBe('hot'));
    expect(block()).not.toBeInTheDocument();
  });

  it('asks nothing when nothing changed, or when the change was undone', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    dirty('Original notes');
    fireEvent.click(nameOf('calm'));
    expect(discardDialog()).not.toBeInTheDocument();
    await waitFor(() => expect(trackOf()).toBe('calm'));
    expect(block()).not.toBeInTheDocument();
  });

  it('also guards the menu\'s Edit on another row', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    fireEvent.click(menuOf('Calm Farm'));
    pick('Edit');
    expect(discardDialog()).toBeInTheDocument();
    expect(trackOf()).toBe('hot');
    discard();
    await waitFor(() => expect(trackOf()).toBe('calm'));
    await screen.findByTestId('progress-edit-block');
    expect(field('Title')).toHaveValue('Calm Farm');
  });
});

describe('closing the open row with unsaved changes (vet M-8)', () => {
  it('its name button asks; Keep editing keeps the row open with the edits', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    fireEvent.click(nameOf('hot'));

    expect(discardDialog()).toBeInTheDocument();
    expect(trackOf()).toBe('hot');
    keepEditing();
    expect(trackOf()).toBe('hot');
    expect(panel()).toBeInTheDocument();
    expect(field('Notes')).toHaveValue('Edited notes');
  });

  it('Discard closes the row and clears ?track', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    fireEvent.click(nameOf('hot'));
    discard();

    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    expect(trackOf()).toBeNull();
    expect(updateGoal).not.toHaveBeenCalled();
  });

  it('a clean block closes the row without asking', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    fireEvent.click(nameOf('hot'));
    expect(discardDialog()).not.toBeInTheDocument();
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    expect(trackOf()).toBeNull();
  });
});

describe('Mark finished with unsaved changes (vet M-8)', () => {
  it('from the menu asks before any write; Keep editing sends nothing', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    fireEvent.click(menuOf('Hot Farm'));
    pick('Mark finished');

    expect(discardDialog()).toBeInTheDocument();
    expect(updateGoal).not.toHaveBeenCalled();
    keepEditing();
    expect(updateGoal).not.toHaveBeenCalled();
    expect(field('Notes')).toHaveValue('Edited notes');
  });

  it('from the menu, Discard then marks it finished', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    fireEvent.click(menuOf('Hot Farm'));
    pick('Mark finished');
    discard();

    await waitFor(() => expect(updateGoal).toHaveBeenCalledWith('g1', 'hot', { status: 'complete' }));
    expect(updateGoal).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(block()).not.toBeInTheDocument());
  });

  it('from the action bar asks the same, and Discard then marks it finished', async () => {
    seed(EVERYONE);
    await startEditing('hot', 'Hot Farm');
    dirty();
    const markFinished = () => within(within(panel()!).getByTestId('progress-expansion-actions')).getByRole('button', { name: 'Mark finished' });
    fireEvent.click(markFinished());
    expect(discardDialog()).toBeInTheDocument();
    expect(updateGoal).not.toHaveBeenCalled();
    keepEditing();
    expect(updateGoal).not.toHaveBeenCalled();

    fireEvent.click(markFinished());
    discard();
    await waitFor(() => expect(updateGoal).toHaveBeenCalledWith('g1', 'hot', { status: 'complete' }));
  });

  it('asks nothing when the block is clean', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    fireEvent.click(menuOf('Hot Farm'));
    pick('Mark finished');
    expect(discardDialog()).not.toBeInTheDocument();
    await waitFor(() => expect(updateGoal).toHaveBeenCalledWith('g1', 'hot', { status: 'complete' }));
  });

  it('on another row asks nothing and leaves the edit alone', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    fireEvent.click(menuOf('Calm Farm'));
    pick('Mark finished');
    expect(discardDialog()).not.toBeInTheDocument();
    await waitFor(() => expect(updateGoal).toHaveBeenCalledWith('g1', 'calm', { status: 'complete' }));
    expect(field('Notes')).toHaveValue('Edited notes');
    expect(trackOf()).toBe('hot');
  });
});

// ── Focus after "Discard changes?" (G5 fix wave) ─────────────────────────────

describe('focus after "Discard changes?"', () => {
  const finishedToggle = () => screen.getByRole('button', { name: /^Finished \(/ });
  /** What a browser does when a control is pressed: it takes focus, then the click lands. */
  const press = (el: HTMLElement) => {
    el.focus();
    fireEvent.click(el);
  };
  /** The Modal moves focus into itself on the next frame; a browser's confirm is never answered before that. */
  const confirmHasFocus = () => waitFor(() => expect(discardDialog()!.contains(document.activeElement)).toBe(true));
  const actionBarMarkFinished = () =>
    within(within(panel()!).getByTestId('progress-expansion-actions')).getByRole('button', { name: 'Mark finished' });

  it("another row's name: Keep editing returns to it, and Discard lands on it, now open", async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    press(nameOf('calm'));
    expect(discardDialog()).toBeInTheDocument();
    await confirmHasFocus();
    keepEditing();
    expect(discardDialog()).not.toBeInTheDocument();
    expect(nameOf('calm')).toHaveFocus();
    expect(field('Notes')).toHaveValue('Edited notes');

    press(nameOf('calm'));
    await confirmHasFocus();
    discard();
    await waitFor(() => expect(trackOf()).toBe('calm'));
    expect(nameOf('calm')).toHaveFocus();
  });

  it("the open row's own name: Keep editing returns to it, and Discard leaves it on the closed row's name", async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    press(nameOf('hot'));
    await confirmHasFocus();
    keepEditing();
    expect(nameOf('hot')).toHaveFocus();
    expect(panel()).toBeInTheDocument();

    press(nameOf('hot'));
    await confirmHasFocus();
    discard();
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    expect(nameOf('hot')).toHaveFocus();
  });

  /** The menu as a browser leaves it: its first item focused, then the one chosen. */
  const chooseMarkFinished = () => {
    press(menuOf('Hot Farm'));
    screen.getByRole('menuitem', { name: 'Mark finished' }).focus();
    pick('Mark finished');
  };

  it("the menu's Mark finished: Keep editing returns to the ⋯ button (the menu item is gone), Discard lands on Finished (n)", async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    chooseMarkFinished();
    await confirmHasFocus();
    keepEditing();
    expect(menuOf('Hot Farm')).toHaveFocus();
    expect(updateGoal).not.toHaveBeenCalled();

    chooseMarkFinished();
    await confirmHasFocus();
    discard();
    await waitFor(() => expect(finishedToggle()).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });

  it("the action bar's Mark finished: Keep editing returns to the button, Discard lands on Finished (n)", async () => {
    seed(EVERYONE);
    await startEditing('hot', 'Hot Farm');
    dirty();
    press(actionBarMarkFinished());
    await confirmHasFocus();
    keepEditing();
    expect(actionBarMarkFinished()).toHaveFocus();

    press(actionBarMarkFinished());
    await confirmHasFocus();
    discard();
    await waitFor(() => expect(finishedToggle()).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });

  it('falls back to the Title when the control that asked took no focus (a click that does not focus, as in Safari)', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    (document.activeElement as HTMLElement).blur();
    fireEvent.click(nameOf('calm'));
    await confirmHasFocus();
    keepEditing();
    expect(field('Title')).toHaveFocus();
  });

  it("answered from the keyboard (focus is on the confirm's button) lands the same", async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    press(nameOf('calm'));
    await confirmHasFocus();
    const keep = within(discardDialog()!).getByRole('button', { name: 'Keep editing' });
    keep.focus();
    fireEvent.click(keep);
    expect(nameOf('calm')).toHaveFocus();
  });

  it('Escape on the confirm is Keep editing', async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    press(nameOf('calm'));
    await confirmHasFocus();
    fireEvent.keyDown(discardDialog()!, { key: 'Escape' });
    expect(discardDialog()).not.toBeInTheDocument();
    expect(nameOf('calm')).toHaveFocus();
    expect(field('Notes')).toHaveValue('Edited notes');
  });

  /** The menu as a browser leaves it: the item chosen holds the focus until the menu closes. */
  const chooseFrom = (title: string, item: string) => {
    press(menuOf(title));
    screen.getByRole('menuitem', { name: item }).focus();
    pick(item);
  };

  it("Edit chosen from another row's menu while dirty: Keep editing returns to that row's ⋯ button, not the Title", async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    chooseFrom('Calm Farm', 'Edit');
    await confirmHasFocus();
    keepEditing();
    expect(menuOf('Calm Farm')).toHaveFocus();
    expect(field('Notes')).toHaveValue('Edited notes');
    expect(trackOf()).toBe('hot');

    // Discard opens the other row's block, with its Title focused (the block's own mount).
    chooseFrom('Calm Farm', 'Edit');
    await confirmHasFocus();
    discard();
    await waitFor(() => expect(trackOf()).toBe('calm'));
    await waitFor(() => expect(field('Title')).toHaveFocus());
  });

  it("the menu's Mark finished: Discard keeps focus on the ⋯ button while the write runs, and when it fails", async () => {
    seed();
    await startEditing('hot', 'Hot Farm');
    dirty();
    let fail: (reason: Error) => void = () => {};
    updateGoal.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
    chooseMarkFinished();
    await confirmHasFocus();
    discard();
    await waitFor(() => expect(updateGoal).toHaveBeenCalledTimes(1));
    expect(menuOf('Hot Farm')).toHaveFocus();
    expect(document.body).not.toHaveFocus();

    await act(async () => fail(new Error('boom')));
    await waitFor(() => expect(useToastStore.getState().toasts.some((t) => t.type === 'error')).toBe(true));
    expect(menuOf('Hot Farm')).toHaveFocus();
    // The block went with the discard; the row stays where it was.
    expect(block()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Finished \(/ })).toBeNull();
  });

  it("the action bar's Mark finished: Discard keeps focus on the button when the write fails", async () => {
    seed(EVERYONE);
    await startEditing('hot', 'Hot Farm');
    dirty();
    updateGoal.mockRejectedValueOnce(new Error('boom'));
    press(actionBarMarkFinished());
    await confirmHasFocus();
    discard();
    await waitFor(() => expect(useToastStore.getState().toasts.some((t) => t.type === 'error')).toBe(true));
    expect(actionBarMarkFinished()).toHaveFocus();
  });
});

describe('a static switch under a dirty edit', () => {
  /** A way to put `?track` back without the row's name button, which clears the edit on its own. */
  function Jump({ to }: { to: string }) {
    const navigate = useNavigate();
    return (
      <button type="button" onClick={() => navigate(to)}>
        jump
      </button>
    );
  }

  it('drops the edit: back on the first static, the same id opens with no block and asks nothing', async () => {
    seed();
    // The page stays mounted across the switch (as under a static switch in the shell).
    const { rerender } = renderAt('/?track=hot', {}, <Jump to="/?track=hot" />);
    await screen.findByTestId('progress-expansion');
    fireEvent.click(menuOf('Hot Farm'));
    pick('Edit');
    await screen.findByTestId('progress-edit-block');
    dirty();

    rerender({ group: otherGroup });
    await waitFor(() => expect(trackOf()).toBeNull());
    expect(panel()).not.toBeInTheDocument();
    rerender({});
    await screen.findAllByTestId('progress-farm-row');

    // The id comes back by the URL (a Back step, a remembered tab), not through the row's own toggle.
    fireEvent.click(screen.getByRole('button', { name: 'jump' }));
    await waitFor(() => expect(nameOf('hot')).toHaveAttribute('aria-expanded', 'true'));
    expect(panel()).toBeInTheDocument();
    expect(block()).not.toBeInTheDocument();

    fireEvent.click(nameOf('hot'));
    expect(discardDialog()).not.toBeInTheDocument();
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
  });
});
