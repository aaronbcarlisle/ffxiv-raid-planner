/**
 * FarmEditBlock (S2a-3a·G5 Task TG8; design §12.2, D-12, R-S3-10, R-S3-4): the seven fields, Save
 * sending only what changed (never `note`), the null rules, Escape and Cancel discarding, and a
 * failed save keeping the block. The REAL store runs over a mocked `api` (a fake PUT that answers
 * with the goal as sent); `refreshGoalProgress` is a spy, as the other panel tests have it. The
 * page-level cases (the dirty guard, the panel staying open) are `ProgressPage.edit.test.tsx`'s.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/api')>()),
  api: { get: vi.fn().mockResolvedValue([]), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../services/api';
import type { CollectionGoal } from '../../stores/collectionGoalStore';
import { installPanelStore, puts, restorePanelStore, toasts } from './__fixtures__/panelHarness';
import { apiGoal, goal } from './__fixtures__/progressFixtures';
import { stubCanHover } from './__fixtures__/tooltipEnv';
import { FarmEditBlock } from './FarmEditBlock';

const GOAL_URL = '/api/static-groups/g1/collection-goals/wings';
const refresh = vi.fn();
const onDone = vi.fn();
const onDirtyChange = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  stubCanHover();
  // Radix Select scrolls the highlighted option into view; jsdom has no scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  installPanelStore(refresh);
  vi.mocked(api.put).mockResolvedValue(apiGoal('wings', { title: 'Wings' }) as never);
});

afterEach(() => {
  restorePanelStore();
  document.body.removeAttribute('style');
});

const FULL = goal('wings', {
  title: 'Wings',
  goalType: 'mount',
  status: 'farming',
  contentType: 'savage',
  contentKey: 'm9s',
  priorityMode: 'priority_order',
  summary: 'Bring food',
});

function renderBlock(g: CollectionGoal = FULL) {
  return render(<FarmEditBlock groupId="g1" goal={g} onDone={onDone} onDirtyChange={onDirtyChange} />);
}

const box = (name: string) => screen.getByRole('textbox', { name });
const combo = (name: string) => screen.getByRole('combobox', { name });
const save = () => screen.getByRole('button', { name: 'Save' });
const open = (name: string) => fireEvent.keyDown(combo(name), { key: 'Enter' });
const optionNames = () => screen.getAllByRole('option').map((o) => o.textContent);
const choose = (name: string, option: string) => {
  open(name);
  fireEvent.click(screen.getByRole('option', { name: option }));
};

describe('FarmEditBlock: the fields (§12.2)', () => {
  it('opens with the goal in every field and the Title focused', () => {
    renderBlock();
    expect(box('Title')).toHaveValue('Wings');
    expect(box('Title')).toHaveFocus();
    expect(combo('Type')).toHaveTextContent('Mount');
    expect(combo('Status')).toHaveTextContent('Farming');
    expect(combo('Content')).toHaveTextContent('Savage');
    expect(box('Duty or key (optional)')).toHaveValue('m9s');
    expect(combo('Priority mode')).toHaveTextContent('Priority order');
    expect(box('Notes')).toHaveValue('Bring food');
  });

  it('requires a Title of at most 200 characters and a key of at most 50', () => {
    renderBlock();
    expect(box('Title')).toBeRequired();
    expect(box('Title')).toHaveAttribute('maxlength', '200');
    expect(box('Duty or key (optional)')).toHaveAttribute('maxlength', '50');
  });

  it('offers the ten types, three statuses, None and the seven contents, and the six priority modes', () => {
    renderBlock();
    open('Type');
    expect(optionNames()).toEqual([
      'Mount', 'Token', 'Minion', 'Music', 'Glamour', 'Custom', 'Weapon', 'Weapon Coffer', 'Title', 'Clear Count',
    ]);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    open('Status');
    expect(optionNames()).toEqual(['Wanted', 'Farming', 'Scheduled']);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    open('Content');
    expect(optionNames()).toEqual([
      'None', 'Extreme', 'Savage', 'Ultimate', 'Criterion', 'Chaotic Alliance', 'Field Operation', 'Other / Custom',
    ]);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    open('Priority mode');
    expect(optionNames()).toEqual(['Not set', 'Everyone gets one', 'Priority order', 'Free roll', 'Desired only', 'Custom']);
  });

  it('shows "Not set" and its help for a goal with no mode, and the help follows the chosen one', () => {
    renderBlock(goal('wings', { title: 'Wings' }));
    expect(combo('Priority mode')).toHaveTextContent('Not set');
    expect(screen.getByTestId('progress-edit-mode-help')).toHaveTextContent('Queues as Everyone gets one.');
    expect(combo('Content')).toHaveTextContent('None');

    choose('Priority mode', 'Free roll');
    expect(screen.getByTestId('progress-edit-mode-help')).toHaveTextContent('No queue: anyone can win the drop.');
    choose('Priority mode', 'Desired only');
    expect(screen.getByTestId('progress-edit-mode-help')).toHaveTextContent('Only players who Need it are queued.');
  });
});

describe('FarmEditBlock: Save (R-S3-10)', () => {
  it('is disabled while nothing changed, and while the Title is blank', () => {
    renderBlock();
    expect(save()).toBeDisabled();
    fireEvent.change(box('Notes'), { target: { value: 'Different' } });
    expect(save()).toBeEnabled();
    fireEvent.change(box('Title'), { target: { value: '   ' } });
    expect(save()).toBeDisabled();
    fireEvent.change(box('Title'), { target: { value: 'Wings' } });
    expect(save()).toBeEnabled();
  });

  it('sends only the changed fields, toasts "Saved", refreshes and closes the block', async () => {
    renderBlock();
    fireEvent.change(box('Title'), { target: { value: 'Bigger Wings' } });
    choose('Status', 'Scheduled');
    fireEvent.click(save());
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(puts()).toEqual([[GOAL_URL, { title: 'Bigger Wings', status: 'scheduled' }]]);
    expect(refresh).toHaveBeenCalledWith('g1', 'wings');
    expect(toasts()).toEqual([['success', 'Saved', null]]);
  });

  it('can send every one of the seven, and never the goal\'s note', async () => {
    renderBlock(goal('wings', { title: 'Wings', note: 'a private note' }));
    fireEvent.change(box('Title'), { target: { value: 'New title' } });
    choose('Type', 'Minion');
    choose('Status', 'Wanted');
    choose('Content', 'Chaotic Alliance');
    fireEvent.change(box('Duty or key (optional)'), { target: { value: '  Orbonne  ' } });
    choose('Priority mode', 'Custom');
    fireEvent.change(box('Notes'), { target: { value: ' Bring food ' } });
    fireEvent.click(save());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(puts()).toEqual([
      [
        GOAL_URL,
        {
          title: 'New title',
          goal_type: 'minion',
          status: 'wanted',
          content_type: 'chaotic_alliance',
          content_key: 'Orbonne',
          priority_mode: 'custom',
          summary: 'Bring food',
        },
      ],
    ]);
  });

  it('clears Notes and the Content Key with null', async () => {
    renderBlock();
    fireEvent.change(box('Notes'), { target: { value: '' } });
    fireEvent.change(box('Duty or key (optional)'), { target: { value: '' } });
    fireEvent.click(save());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(puts()).toEqual([[GOAL_URL, { content_key: null, summary: null }]]);
  });

  it('sends null for a Notes of only spaces', async () => {
    renderBlock();
    fireEvent.change(box('Notes'), { target: { value: '    ' } });
    fireEvent.click(save());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(puts()).toEqual([[GOAL_URL, { summary: null }]]);
  });

  it('sends null for "Not set" and for Content "None"', async () => {
    renderBlock();
    choose('Priority mode', 'Not set');
    choose('Content', 'None');
    fireEvent.click(save());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(puts()).toEqual([[GOAL_URL, { content_type: null, priority_mode: null }]]);
  });

  it('leaves a blank Notes or key that was already blank alone', () => {
    renderBlock(goal('wings', { title: 'Wings', summary: '  ', contentKey: '' }));
    fireEvent.change(box('Notes'), { target: { value: '' } });
    expect(save()).toBeDisabled();
  });

  it('keeps the block with an error toast when the save fails', async () => {
    vi.mocked(api.put).mockRejectedValue(new Error('boom'));
    renderBlock();
    fireEvent.change(box('Title'), { target: { value: 'Bigger Wings' } });
    fireEvent.click(save());
    await waitFor(() => expect(toasts()).toEqual([['error', "Couldn't save the farm: boom", null]]));
    expect(onDone).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(box('Title')).toHaveValue('Bigger Wings');
    expect(save()).toBeEnabled();
  });

  it('sends one save for a double click', async () => {
    renderBlock();
    fireEvent.change(box('Title'), { target: { value: 'Bigger Wings' } });
    fireEvent.click(save());
    fireEvent.click(save());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(puts()).toHaveLength(1);
  });

  it('saves on Enter in a field', async () => {
    renderBlock();
    fireEvent.change(box('Notes'), { target: { value: 'Different' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Edit Wings' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(puts()).toEqual([[GOAL_URL, { summary: 'Different' }]]);
  });
});

describe('FarmEditBlock: discarding (D-12)', () => {
  it('Cancel closes the block and sends nothing', () => {
    renderBlock();
    fireEvent.change(box('Title'), { target: { value: 'Bigger Wings' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(puts()).toEqual([]);
  });

  it('Escape in a field discards, and the key is prevented so the panel leaves itself alone', () => {
    renderBlock();
    fireEvent.change(box('Title'), { target: { value: 'Bigger Wings' } });
    const notPrevented = fireEvent.keyDown(box('Title'), { key: 'Escape' });
    expect(notPrevented).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(puts()).toEqual([]);
  });

  it('Escape inside an open Select closes only the select: the block keeps its edits', async () => {
    renderBlock();
    fireEvent.change(box('Title'), { target: { value: 'Bigger Wings' } });
    open('Status');
    const option = screen.getByRole('option', { name: 'Wanted' });
    fireEvent.keyDown(option, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Wanted' })).not.toBeInTheDocument());
    expect(onDone).not.toHaveBeenCalled();
    expect(box('Title')).toHaveValue('Bigger Wings');
    expect(screen.getByRole('form', { name: 'Edit Wings' })).toBeInTheDocument();
  });
});

describe('FarmEditBlock: telling the page whether it is dirty', () => {
  it('reports a change, a change undone, and false as it goes', () => {
    const { unmount } = renderBlock();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(box('Notes'), { target: { value: 'Different' } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    fireEvent.change(box('Notes'), { target: { value: 'Bring food' } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(box('Notes'), { target: { value: 'Different' } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    unmount();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('opens clean for a stored title with whitespace on its edges, and saves only what changed', async () => {
    renderBlock(goal('wings', { title: ' Wings ', summary: null }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(save()).toBeDisabled();
    fireEvent.change(box('Notes'), { target: { value: 'Different' } });
    fireEvent.click(save());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(puts()).toEqual([[GOAL_URL, { summary: 'Different' }]]);
  });

  it('keeps its fields in a form named for the farm', () => {
    renderBlock();
    const form = screen.getByRole('form', { name: 'Edit Wings' });
    expect(within(form).getAllByRole('combobox')).toHaveLength(4);
    expect(within(form).getAllByRole('textbox')).toHaveLength(3);
  });
});
