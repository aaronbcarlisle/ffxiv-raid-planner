/**
 * LogDropButton (S2a-3a·G3 Task TG5; D-6, D-16, R-S3-6, R-S3-8, R-S3-14): a lead's split button
 * and picker, inside the real panel. The REAL store runs over a mocked `api` (a fake drops
 * route); its legacy refetches after a log are stubbed and `refreshGoalProgress` is a spy (its
 * own requests are the store test's).
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/api')>()),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../services/api';
import { useCollectionGoalStore, type CollectionGoal } from '../../stores/collectionGoalStore';
import { useToastStore } from '../../stores/toastStore';
import { serveDrops } from './__fixtures__/dropServer';
import { emulateFocusFixup } from './__fixtures__/focusFixup';
import { farmRowOf, goal, type ColumnSpec } from './__fixtures__/progressFixtures';
import { stubCanHover } from './__fixtures__/tooltipEnv';
import { FarmExpansion } from './FarmExpansion';

const WINGS = goal('wings', { title: 'Wings' });
const DROPS = '/api/static-groups/g1/collection-goals/wings/drops';

/** #1 Healer 1 (Need 12), #2 Tank 1 (Want 3); Melee 2 on Pass and Ranged blank are not queued; Caster is unclaimed. */
const ROSTER: ColumnSpec[] = [
  { id: 'Tank 1', cell: { state: 'want', tokenCount: 3 } },
  { id: 'Healer 1', cell: { state: 'need', tokenCount: 12 } },
  { id: 'Melee 2', cell: { state: 'pass' } },
  { id: 'Caster', kind: 'unclaimed' },
  { id: 'Ranged' },
];

const real = useCollectionGoalStore.getState();
const refresh = vi.fn();
let server: ReturnType<typeof serveDrops>;

/** The panel, once its drops load has settled (none are served). */
async function renderPanel(specs: ColumnSpec[] = ROSTER, g: CollectionGoal = WINGS, onClose = vi.fn()) {
  const view = render(
    <table>
      <tbody>
        <FarmExpansion
          row={farmRowOf(specs, g, 'lead')}
          finished={false}
          canManage
          userRole="lead"
          currentUserId="me"
          groupId="g1"
          onClose={onClose}
          id="progress-expansion-wings"
          spanAll={7}
        />
      </tbody>
    </table>,
  );
  await screen.findByText('No drops logged yet.');
  return { ...view, onClose };
}

const main = (name: RegExp | string = /^Log (drop for|a drop)/) => screen.getByRole('button', { name });
const more = () => screen.getByRole('button', { name: 'More recipients' });
const radios = () => within(screen.getByRole('radiogroup', { name: 'Recipient' })).getAllByRole('radio');
const checkedName = () => radios().find((r) => r.getAttribute('aria-checked') === 'true')?.textContent;
const posts = () => vi.mocked(api.post).mock.calls;
const toasts = () => useToastStore.getState().toasts.map((t) => [t.type, t.message, t.action?.label ?? null]);
const clickUndo = () => act(() => useToastStore.getState().toasts.find((t) => t.action?.label === 'Undo')?.action?.onClick());

beforeEach(() => {
  vi.clearAllMocks();
  stubCanHover();
  server = serveDrops(api);
  refresh.mockResolvedValue(undefined);
  useCollectionGoalStore.setState({
    drops: {},
    dropsLoading: {},
    fetchParticipants: vi.fn().mockResolvedValue(undefined),
    fetchGoals: vi.fn().mockResolvedValue(undefined),
    refreshGoalProgress: refresh,
  });
  useToastStore.getState().clearAll();
});

afterEach(() => {
  vi.unstubAllGlobals();
  useCollectionGoalStore.setState({
    fetchParticipants: real.fetchParticipants,
    fetchGoals: real.fetchGoals,
    refreshGoalProgress: real.refreshGoalProgress,
    drops: {},
  });
});

describe('LogDropButton: one click for #1 (D-6)', () => {
  it('names #1, logs for them with no note, toasts with Undo, and refreshes the farm', async () => {
    await renderPanel();
    expect(screen.getByRole('group', { name: 'Log a drop' })).toContainElement(main());
    fireEvent.click(main('Log drop for Healer 1'));

    await waitFor(() => expect(refresh).toHaveBeenCalledWith('g1', 'wings'));
    expect(posts()).toHaveLength(1);
    expect(posts()[0][0]).toBe(DROPS);
    expect(posts()[0][1]).toMatchObject({ recipient_user_id: 'Healer 1', notes: null });
    expect(toasts()).toEqual([['success', 'Drop logged for Healer 1', 'Undo']]);
  });

  it('sends one request for a double click, and keeps both halves unavailable until the log and its refresh are done', async () => {
    let finish = () => {};
    refresh.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const release = server.gate();
    await renderPanel();
    const button = main('Log drop for Healer 1');
    act(() => {
      button.click();
      button.click();
    });
    expect(posts()).toHaveLength(1);
    for (const half of [button, more()]) expect(half).toHaveAttribute('aria-disabled', 'true');

    release();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    // The ▾ ignores a click too: no picker while a log is in flight.
    fireEvent.click(more());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(async () => finish());
    for (const half of [main(), more()]) expect(half).not.toHaveAttribute('aria-disabled');
    expect(posts()).toHaveLength(1);
  });

  it('keeps focus on the main button through a one-click log: it is never natively disabled (G3 live defect)', async () => {
    const stop = emulateFocusFixup();
    let finish = () => {};
    refresh.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    await renderPanel();
    const button = main('Log drop for Healer 1');
    act(() => button.focus());
    fireEvent.click(button);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
    await act(async () => finish());
    expect(document.activeElement).toBe(button);
    stop();
  });
});

describe('LogDropButton: the picker (D-6, vet M-2)', () => {
  it('opens a dialog named for the farm: the queue with #n, Not in the queue, then Nobody, with #1 checked and the one tab stop', async () => {
    await renderPanel();
    expect(more()).toHaveAttribute('aria-haspopup', 'dialog');
    fireEvent.click(more());

    const dialog = screen.getByRole('dialog', { name: 'Log a drop for Wings' });
    expect(radios().map((r) => r.textContent)).toEqual([
      '#1 Healer 1 · Need 12/99',
      '#2 Tank 1 · Want 3/99',
      'Melee 2 · Pass',
      'Ranged',
      'Nobody',
    ]);
    // "Not in the queue" heads the rest, and describes each of them.
    const label = within(dialog).getByText('Not in the queue');
    expect(radios()[1].compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(label.compareDocumentPosition(radios()[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(radios()[2]).toHaveAccessibleDescription('Not in the queue');
    expect(checkedName()).toBe('#1 Healer 1 · Need 12/99');
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    expect(radios()[0]).toHaveFocus();
  });

  it('moves the check and focus with ArrowDown and ArrowUp, wrapping, and keeps one tab stop', async () => {
    await renderPanel();
    fireEvent.click(more());
    fireEvent.keyDown(radios()[0], { key: 'ArrowDown' });
    expect(checkedName()).toBe('#2 Tank 1 · Want 3/99');
    expect(radios()[1]).toHaveFocus();
    expect(radios().filter((r) => r.tabIndex === 0)).toEqual([radios()[1]]);
    fireEvent.keyDown(radios()[1], { key: 'ArrowUp' });
    fireEvent.keyDown(radios()[0], { key: 'ArrowUp' });
    expect(checkedName()).toBe('Nobody');
    expect(radios()[4]).toHaveFocus();
    fireEvent.keyDown(radios()[4], { key: 'ArrowDown' });
    expect(checkedName()).toBe('#1 Healer 1 · Need 12/99');
  });

  it('logs for the member picked, with the note, toasts for them and closes', async () => {
    await renderPanel();
    fireEvent.click(more());
    fireEvent.click(radios()[2]);
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: '  first clear ' } });
    expect(screen.getByLabelText('Note (optional)')).toHaveAttribute('maxLength', '500');
    fireEvent.click(screen.getByRole('button', { name: 'Log drop' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(posts()[0][1]).toMatchObject({ recipient_user_id: 'Melee 2', notes: 'first clear' });
    expect(toasts()).toEqual([['success', 'Drop logged for Melee 2', 'Undo']]);
    expect(refresh).toHaveBeenCalledWith('g1', 'wings');
  });

  it('logs Nobody as a null recipient and toasts "Drop logged"', async () => {
    await renderPanel();
    fireEvent.click(more());
    fireEvent.click(radios()[4]);
    fireEvent.click(screen.getByRole('button', { name: 'Log drop' }));
    await waitFor(() => expect(toasts()).toEqual([['success', 'Drop logged', 'Undo']]));
    expect(posts()[0][1]).toMatchObject({ recipient_user_id: null, notes: null });
  });

  it('closes on Escape inside it, alone: the panel keeps its row and focus returns to the ▾ (R-S3-4)', async () => {
    const { onClose } = await renderPanel();
    fireEvent.click(more());
    fireEvent.keyDown(radios()[0], { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    // Radix hands focus back on a timer after the content unmounts.
    await waitFor(() => expect(more()).toHaveFocus());
    expect(posts()).toHaveLength(0);
  });

  it('logs nothing on Cancel', async () => {
    await renderPanel();
    fireEvent.click(more());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(posts()).toHaveLength(0);
  });

  it('logs for the checked option on Enter in the radio group (a form of radios submits on Enter)', async () => {
    await renderPanel();
    fireEvent.click(more());
    fireEvent.keyDown(radios()[0], { key: 'ArrowDown' });
    fireEvent.keyDown(radios()[1], { key: 'Enter' });
    await waitFor(() => expect(toasts()).toEqual([['success', 'Drop logged for Tank 1', 'Undo']]));
    expect(posts()).toHaveLength(1);
    expect(posts()[0][1]).toMatchObject({ recipient_user_id: 'Tank 1' });
  });

  it('closes onto a live ▾ when Cancel is pressed while its log is in flight (G3 fix wave)', async () => {
    const stop = emulateFocusFixup();
    const release = server.gate();
    await renderPanel();
    fireEvent.click(more());
    fireEvent.click(screen.getByRole('button', { name: 'Log drop' }));
    expect(more()).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(more()).toHaveFocus());
    expect(more()).not.toBeDisabled();
    release();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    stop();
  });
});

describe('LogDropButton: Not-on-the-roster members (R-S3-14, vet C-2)', () => {
  const MIXED: ColumnSpec[] = [
    { id: 'Healer 1', cell: { state: 'need', tokenCount: 12 } },
    { id: 'Nora', kind: 'notOnRoster', cell: { state: 'need', tokenCount: 2 } },
    { id: 'Pip', kind: 'unconfigured', cell: { state: 'pass' } },
  ];

  it('queues a Not-on-the-roster Need with the fewest as #1 and names them on the main button', async () => {
    await renderPanel(MIXED);
    fireEvent.click(main('Log drop for Nora'));
    await waitFor(() => expect(posts()[0][1]).toMatchObject({ recipient_user_id: 'Nora' }));
  });

  it('lists a Not-on-the-roster Pass member under "Not in the queue", and logs for them when picked', async () => {
    await renderPanel(MIXED);
    fireEvent.click(more());
    expect(radios().map((r) => r.textContent)).toEqual(['#1 Nora · Need 2/99', '#2 Healer 1 · Need 12/99', 'Pip · Pass', 'Nobody']);
    fireEvent.click(radios()[2]);
    fireEvent.click(screen.getByRole('button', { name: 'Log drop' }));
    await waitFor(() => expect(toasts()).toEqual([['success', 'Drop logged for Pip', 'Undo']]));
    expect(posts()[0][1]).toMatchObject({ recipient_user_id: 'Pip' });
  });
});

describe('LogDropButton: no #1 (D-6)', () => {
  it.each([
    ['free_roll', ROSTER, goal('wings', { title: 'Wings', priorityMode: 'free_roll' })],
    ['an empty queue', [{ id: 'Melee 2', cell: { state: 'pass' } }, { id: 'Ranged' }] as ColumnSpec[], WINGS],
  ])('reads "Log a drop" under %s and opens the picker with Nobody checked', async (_label, specs, g) => {
    await renderPanel(specs, g);
    expect(main('Log a drop')).toHaveAttribute('aria-haspopup', 'dialog');
    expect(main('Log a drop')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(main('Log a drop'));
    expect(screen.getByRole('dialog', { name: 'Log a drop for Wings' })).toBeInTheDocument();
    expect(main('Log a drop')).toHaveAttribute('aria-expanded', 'true');
    expect(checkedName()).toBe('Nobody');
    expect(radios().at(-1)).toHaveFocus();
    expect(posts()).toHaveLength(0);
    // Closing hands focus back to the button that opened it, not the ▾.
    fireEvent.keyDown(radios().at(-1)!, { key: 'Escape' });
    await waitFor(() => expect(main('Log a drop')).toHaveFocus());
    expect(main('Log a drop')).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('LogDropButton: Undo (R-S3-8, D-16)', () => {
  it('deletes the drop the log returned, then refreshes, even after the panel has closed', async () => {
    const view = await renderPanel();
    fireEvent.click(main('Log drop for Healer 1'));
    await waitFor(() => expect(toasts()).toHaveLength(1));
    await waitFor(() => expect(main()).toBeEnabled());
    view.unmount();
    refresh.mockClear();

    clickUndo();
    await waitFor(() => expect(refresh).toHaveBeenCalledWith('g1', 'wings'));
    expect(vi.mocked(api.delete).mock.calls).toEqual([[`${DROPS}/d1`]]);
    expect(vi.mocked(api.delete).mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0]);
    expect(server.list()).toEqual([]);
    expect(toasts().at(-1)).toEqual(['success', 'Undone', null]);
  });

  it('toasts "Couldn\'t undo the drop" when the delete fails, and keeps the drop', async () => {
    await renderPanel();
    fireEvent.click(main('Log drop for Healer 1'));
    await waitFor(() => expect(main()).toBeEnabled());
    vi.mocked(api.delete).mockRejectedValueOnce(new Error('boom'));
    refresh.mockClear();

    clickUndo();
    await waitFor(() => expect(toasts().at(-1)).toEqual(['error', "Couldn't undo the drop", null]));
    expect(useCollectionGoalStore.getState().drops.wings.map((d) => d.id)).toEqual(['d1']);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('LogDropButton: a failed log', () => {
  it('toasts the error, offers no Undo, refreshes nothing and leaves the row and the drops as they were', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Recipient must be a member of this static'));
    await renderPanel();
    fireEvent.click(main('Log drop for Healer 1'));
    await waitFor(() =>
      expect(toasts()).toEqual([['error', "Couldn't log the drop: Recipient must be a member of this static", null]]),
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(main('Log drop for Healer 1')).toBeEnabled();
    expect(useCollectionGoalStore.getState().drops.wings).toEqual([]);
  });
});
