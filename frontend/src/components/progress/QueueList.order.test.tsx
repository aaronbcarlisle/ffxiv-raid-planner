/**
 * QueueList's Change order (S2a-3c·C3 Task TC3; design D-5, D-7, D-8, E-7, E-8; R-C-6, R-C-8):
 * the "Manual order" tag and caption, the lead's Change order and Back to automatic, the editor
 * swap, Save, Cancel, Escape, Undo and their focus targets. The REAL store's `setQueueOrder` runs
 * over a mocked `api.put` (a fake queue-order route); its `refreshGoalProgress` spy applies the
 * PUT to the live specs, so the list re-renders with the refreshed ranks as the page would.
 */
import { act, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/api')>()),
  api: { get: vi.fn().mockResolvedValue([]), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api, ApiError } from '../../services/api';
import type { CollectionGoal } from '../../stores/collectionGoalStore';
import { useToastStore } from '../../stores/toastStore';
import type { MemberRole } from '../../types';
import { installPanelStore, restorePanelStore, toasts } from './__fixtures__/panelHarness';
import { farmRowOf, goal, type ColumnSpec } from './__fixtures__/progressFixtures';
import { liveSpecs, QUEUE_ORDER_URL, serveQueueOrder, type LiveSpecs } from './__fixtures__/queueOrderServer';
import { QueueList } from './QueueList';

const WINGS = goal('wings', { title: 'Wings' });
const CAPTION = 'Set by a lead. Anyone added later goes after the set order in their status.';

const need = (tokenCount: number | null, priorityRank: number | null = null) => ({ state: 'need' as const, tokenCount, priorityRank });
const want = (tokenCount: number | null, priorityRank: number | null = null) => ({ state: 'want' as const, tokenCount, priorityRank });

// Automatic: Bea (10), Ann (60), then Cy's Want.
const THREE: ColumnSpec[] = [
  { id: 'Ann', cell: need(60) },
  { id: 'Bea', cell: need(10) },
  { id: 'Cy', cell: want(5) },
];
// A lead pinned Ann above Bea; Dee holds a rank under Have (pinnedOrder keeps it for Undo).
const PINNED: ColumnSpec[] = [
  { id: 'Ann', cell: need(60, 1) },
  { id: 'Bea', cell: need(10, 2) },
  { id: 'Cy', cell: want(5) },
  { id: 'Dee', cell: { state: 'have', priorityRank: 3 } },
];

function Harness({ live, g, role, canOrder, onLeave }: { live: LiveSpecs; g: CollectionGoal; role: MemberRole; canOrder: boolean; onLeave: () => void }) {
  const specs = live.useSpecs();
  return <QueueList row={farmRowOf(specs, g, role)} viewer={role === 'viewer'} canOrder={canOrder} groupId="g1" onLeave={onLeave} />;
}

const refresh = vi.fn();
let live: LiveSpecs;
let server: ReturnType<typeof serveQueueOrder>;

function renderList(specs: ColumnSpec[], opts: { role?: MemberRole; canOrder?: boolean; g?: CollectionGoal } = {}) {
  live = liveSpecs(specs);
  server = serveQueueOrder(api, refresh, live);
  const onLeave = vi.fn();
  const role = opts.role ?? 'lead';
  const view = render(<Harness live={live} g={opts.g ?? WINGS} role={role} canOrder={opts.canOrder ?? role === 'lead'} onLeave={onLeave} />);
  return { ...view, onLeave };
}

/** An entry's own text, "#k {name} · {text}", without any button's hidden label, whitespace collapsed. */
const norm = (li: Element) => {
  const copy = li.cloneNode(true) as Element;
  copy.querySelectorAll('button').forEach((b) => b.remove());
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim().replace(/^(#\d+)\s*/, '$1 ');
};
const items = () => screen.getAllByRole('listitem').map(norm);
const btn = (name: string) => screen.getByRole('button', { name });
const query = (name: string) => screen.queryByRole('button', { name });
const editor = () => screen.queryByRole('list', { name: 'Queue order' });
const undoOf = (message: string) => {
  const t = useToastStore.getState().toasts.find((x) => x.message === message);
  if (!t?.action) throw new Error(`no Undo toast "${message}"`);
  return t.action.onClick;
};

beforeEach(() => {
  vi.clearAllMocks();
  installPanelStore(refresh);
});

afterEach(restorePanelStore);

describe('QueueList at rest: the controls (R-C-6, D-5)', () => {
  it('a lead with three queued sees Change order, and no Back to automatic, tag or caption while automatic', () => {
    renderList(THREE);
    expect(btn('Change order')).toBeInTheDocument();
    expect(query('Back to automatic')).not.toBeInTheDocument();
    expect(screen.queryByText('Manual order')).not.toBeInTheDocument();
    expect(screen.queryByText(CAPTION)).not.toBeInTheDocument();
  });

  it('has no Change order with one queued; with one pinned queued, Back to automatic alone', () => {
    const { unmount } = renderList([{ id: 'Ann', cell: need(5) }, { id: 'Bea', cell: { state: 'have' } }]);
    expect(query('Change order')).not.toBeInTheDocument();
    expect(query('Back to automatic')).not.toBeInTheDocument();
    unmount();
    renderList([{ id: 'Ann', cell: need(5, 1) }, { id: 'Bea', cell: { state: 'have', priorityRank: 2 } }]);
    expect(query('Change order')).not.toBeInTheDocument();
    expect(btn('Back to automatic')).toBeInTheDocument();
  });

  it('a lead on a manual queue sees the tag, Change order then Back to automatic, and the exact caption under the list', () => {
    renderList(PINNED);
    expect(items()).toEqual(['#1 Ann · Need 60/99', '#2 Bea · Need 10/99', '#3 Cy · Want 5/99']);
    expect(screen.getByText('Manual order')).toBeInTheDocument();
    const change = btn('Change order');
    const back = btn('Back to automatic');
    expect(change.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const caption = screen.getByText(CAPTION);
    expect(caption).toHaveClass('text-xs');
    expect(screen.getByRole('list').compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a member (canOrder false) sees the tag and caption on a manual queue, but neither control', () => {
    renderList(PINNED, { role: 'member', canOrder: false });
    expect(screen.getByText('Manual order')).toBeInTheDocument();
    expect(screen.getByText(CAPTION)).toBeInTheDocument();
    expect(query('Change order')).not.toBeInTheDocument();
    expect(query('Back to automatic')).not.toBeInTheDocument();
  });

  it('a lead gets the controls under priority_order but not under free_roll; a viewer gets no control or tag', () => {
    const { unmount } = renderList(PINNED, { g: goal('wings', { priorityMode: 'priority_order' }) });
    expect(btn('Change order')).toBeInTheDocument();
    unmount();
    const freeRoll = renderList(PINNED, { g: goal('wings', { priorityMode: 'free_roll' }) });
    expect(screen.getByText('Free roll: no queue')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    freeRoll.unmount();
    // Even told canOrder (FarmExpansion never does), the viewer branch is unchanged.
    renderList(PINNED, { role: 'viewer', canOrder: true });
    expect(screen.getByText('Need: Ann, Bea · Want: Cy')).toBeInTheDocument();
    expect(screen.queryByText('Manual order')).not.toBeInTheDocument();
    expect(screen.queryByText(CAPTION)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('QueueList: Change order opens the editor (R-C-7, E-8)', () => {
  it('hides Change order and Back to automatic and lists every entry with no Show all', () => {
    const six: ColumnSpec[] = [
      { id: 'Ann', cell: need(60, 1) },
      { id: 'Bea', cell: need(10) },
      { id: 'Cy', cell: need(30) },
      { id: 'Dee', cell: want(5) },
      { id: 'Eli', cell: need(90) },
      { id: 'Fay', cell: want(1) },
    ];
    renderList(six);
    expect(btn('Show all (6)')).toBeInTheDocument();
    fireEvent.click(btn('Change order'));
    const list = editor();
    expect(list).not.toBeNull();
    expect(within(list as HTMLElement).getAllByRole('listitem')).toHaveLength(6);
    expect(query('Change order')).not.toBeInTheDocument();
    expect(query('Back to automatic')).not.toBeInTheDocument();
    expect(query('Show all (6)')).not.toBeInTheDocument();
    expect(btn('Move Ann down')).toBeInTheDocument();
    expect(btn('Save order')).toBeInTheDocument();
    expect(btn('Cancel')).toBeInTheDocument();
  });
});

describe('QueueList: Save (R-C-8, D-8)', () => {
  it('PUTs the edited ids once, toasts "Order saved" with Undo, closes the editor, shows the new order and tag, and focuses Change order', async () => {
    renderList(THREE);
    fireEvent.click(btn('Change order'));
    fireEvent.click(btn('Move Ann up'));
    fireEvent.click(btn('Save order'));
    await waitFor(() => expect(editor()).not.toBeInTheDocument());
    expect(server.urls()).toEqual([QUEUE_ORDER_URL]);
    expect(server.sent()).toEqual([['Ann', 'Bea', 'Cy']]);
    expect(toasts()).toEqual([['success', 'Order saved', 'Undo']]);
    expect(items()).toEqual(['#1 Ann · Need 60/99', '#2 Bea · Need 10/99', '#3 Cy · Want 5/99']);
    expect(screen.getByText('Manual order')).toBeInTheDocument();
    expect(btn('Back to automatic')).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(btn('Change order')));
  });

  it('sends one PUT for a double click, and Save order is aria-disabled while it is in flight', async () => {
    renderList(THREE);
    fireEvent.click(btn('Change order'));
    const release = server.gate();
    const save = btn('Save order');
    act(() => {
      save.click();
      save.click();
    });
    await waitFor(() => expect(save).toHaveAttribute('aria-disabled', 'true'));
    fireEvent.click(save);
    release();
    await waitFor(() => expect(editor()).not.toBeInTheDocument());
    expect(server.sent()).toHaveLength(1);
  });

  it('Undo after a Save from automatic PUTs [] and toasts "Order restored"', async () => {
    renderList(THREE);
    fireEvent.click(btn('Change order'));
    fireEvent.click(btn('Move Ann up'));
    fireEvent.click(btn('Save order'));
    await waitFor(() => expect(toasts()).toContainEqual(['success', 'Order saved', 'Undo']));
    act(() => undoOf('Order saved')());
    await waitFor(() => expect(toasts()).toContainEqual(['success', 'Order restored', null]));
    expect(server.sent()).toEqual([['Ann', 'Bea', 'Cy'], []]);
    await waitFor(() => expect(screen.queryByText('Manual order')).not.toBeInTheDocument());
    expect(items()).toEqual(['#1 Bea · Need 10/99', '#2 Ann · Need 60/99', '#3 Cy · Want 5/99']);
  });

  it('Undo after a Save over a pin PUTs the prior pinnedOrder, a Have row\'s rank included', async () => {
    renderList(PINNED);
    fireEvent.click(btn('Change order'));
    fireEvent.click(btn('Move Bea up'));
    fireEvent.click(btn('Save order'));
    await waitFor(() => expect(toasts()).toContainEqual(['success', 'Order saved', 'Undo']));
    expect(server.sent()).toEqual([['Bea', 'Ann', 'Cy']]);
    act(() => undoOf('Order saved')());
    await waitFor(() => expect(server.sent()).toHaveLength(2));
    expect(server.sent()[1]).toEqual(['Ann', 'Bea', 'Dee']);
    await waitFor(() => expect(toasts()).toContainEqual(['success', 'Order restored', null]));
  });

  it('a failed Save toasts the error and keeps the editor open with its draft, Save usable again', async () => {
    renderList(THREE);
    fireEvent.click(btn('Change order'));
    fireEvent.click(btn('Move Ann up'));
    vi.mocked(api.put).mockRejectedValueOnce(new Error('Server down'));
    fireEvent.click(btn('Save order'));
    await waitFor(() => expect(toasts()).toEqual([['error', "Couldn't save the order: Server down", null]]));
    expect(editor()).toBeInTheDocument();
    expect(within(editor() as HTMLElement).getAllByRole('listitem').map(norm)).toEqual([
      '#1 Ann · Need 60/99',
      '#2 Bea · Need 10/99',
      '#3 Cy · Want 5/99',
    ]);
    await waitFor(() => expect(btn('Save order')).not.toHaveAttribute('aria-disabled', 'true'));
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.click(btn('Save order'));
    await waitFor(() => expect(editor()).not.toBeInTheDocument());
    expect(server.sent()).toEqual([['Ann', 'Bea', 'Cy'], ['Ann', 'Bea', 'Cy']]);
  });

  it('does not toast a 403 that api.ts already toasted, and keeps the editor', async () => {
    renderList(THREE);
    fireEvent.click(btn('Change order'));
    vi.mocked(api.put).mockRejectedValueOnce(new ApiError(403, 'Forbidden', true));
    fireEvent.click(btn('Save order'));
    await waitFor(() => expect(btn('Save order')).not.toHaveAttribute('aria-disabled', 'true'));
    await waitFor(() => expect(vi.mocked(api.put)).toHaveBeenCalledTimes(1));
    expect(toasts()).toEqual([]);
    expect(editor()).toBeInTheDocument();
  });

  it('a failed Undo toasts "Couldn\'t restore the order: …" and leaves the saved order', async () => {
    renderList(THREE);
    fireEvent.click(btn('Change order'));
    fireEvent.click(btn('Move Ann up'));
    fireEvent.click(btn('Save order'));
    await waitFor(() => expect(toasts()).toContainEqual(['success', 'Order saved', 'Undo']));
    vi.mocked(api.put).mockRejectedValueOnce(new Error('Gone away'));
    act(() => undoOf('Order saved')());
    await waitFor(() => expect(toasts()).toContainEqual(['error', "Couldn't restore the order: Gone away", null]));
    expect(items()[0]).toBe('#1 Ann · Need 60/99');
  });
});

describe('QueueList: Cancel and Escape (E-7, E-8)', () => {
  it('Cancel sends nothing, shows the old order, and focuses Change order', async () => {
    renderList(THREE);
    fireEvent.click(btn('Change order'));
    fireEvent.click(btn('Move Ann up'));
    fireEvent.click(btn('Cancel'));
    expect(editor()).not.toBeInTheDocument();
    expect(items()).toEqual(['#1 Bea · Need 10/99', '#2 Ann · Need 60/99', '#3 Cy · Want 5/99']);
    await waitFor(() => expect(document.activeElement).toBe(btn('Change order')));
    expect(api.put).not.toHaveBeenCalled();
  });

  it('Escape in the editor cancels, is prevented, and focuses Change order', async () => {
    renderList(THREE);
    fireEvent.click(btn('Change order'));
    fireEvent.click(btn('Move Ann up'));
    const target = btn('Move Ann down');
    const escape = createEvent.keyDown(target, { key: 'Escape' });
    fireEvent(target, escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(editor()).not.toBeInTheDocument();
    expect(items()[0]).toBe('#1 Bea · Need 10/99');
    await waitFor(() => expect(document.activeElement).toBe(btn('Change order')));
    expect(api.put).not.toHaveBeenCalled();
  });

  it('keeps the draft across a refresh: a member turned Have drops out, a new Need joins the Needs, Save sends the derived list', async () => {
    renderList([{ id: 'Ann', cell: need(60) }, { id: 'Bea', cell: need(10) }, { id: 'Cy', cell: need(30) }, { id: 'Dee', cell: want(5) }]);
    fireEvent.click(btn('Change order'));
    fireEvent.click(btn('Move Ann up')); // Draft: Bea, Ann, Cy, Dee.
    act(() =>
      live.set([
        { id: 'Ann', cell: need(60) },
        { id: 'Bea', cell: { state: 'have' } },
        { id: 'Cy', cell: need(30) },
        { id: 'Dee', cell: want(5) },
        { id: 'Eve', cell: need(1) },
      ]),
    );
    expect(within(editor() as HTMLElement).getAllByRole('listitem').map(norm)).toEqual([
      '#1 Ann · Need 60/99',
      '#2 Cy · Need 30/99',
      '#3 Eve · Need 1/99',
      '#4 Dee · Want 5/99',
    ]);
    fireEvent.click(btn('Save order'));
    await waitFor(() => expect(editor()).not.toBeInTheDocument());
    expect(server.sent()).toEqual([['Ann', 'Cy', 'Eve', 'Dee']]);
  });
});

describe('QueueList: Back to automatic (R-C-8, D-8)', () => {
  it('PUTs [], toasts with Undo, drops the tag and itself, and focuses Change order; Undo PUTs the prior pins', async () => {
    renderList(PINNED);
    fireEvent.click(btn('Back to automatic'));
    await waitFor(() => expect(toasts()).toEqual([['success', 'Back to automatic order', 'Undo']]));
    expect(server.urls()).toEqual([QUEUE_ORDER_URL]);
    expect(server.sent()).toEqual([[]]);
    await waitFor(() => expect(screen.queryByText('Manual order')).not.toBeInTheDocument());
    expect(query('Back to automatic')).not.toBeInTheDocument();
    expect(items()).toEqual(['#1 Bea · Need 10/99', '#2 Ann · Need 60/99', '#3 Cy · Want 5/99']);
    await waitFor(() => expect(document.activeElement).toBe(btn('Change order')));

    act(() => undoOf('Back to automatic order')());
    await waitFor(() => expect(toasts()).toContainEqual(['success', 'Order restored', null]));
    expect(server.sent()).toEqual([[], ['Ann', 'Bea', 'Dee']]);
    await waitFor(() => expect(screen.getByText('Manual order')).toBeInTheDocument());
    expect(items()[0]).toBe('#1 Ann · Need 60/99');
  });

  it('calls onLeave when Change order is absent (one queued)', async () => {
    const { onLeave } = renderList([{ id: 'Ann', cell: need(5, 1) }, { id: 'Bea', cell: { state: 'have', priorityRank: 2 } }]);
    fireEvent.click(btn('Back to automatic'));
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
    expect(server.sent()).toEqual([[]]);
  });

  it('a failed Back to automatic toasts the error once and keeps the manual order', async () => {
    renderList(PINNED);
    vi.mocked(api.put).mockRejectedValueOnce(new Error('Server down'));
    fireEvent.click(btn('Back to automatic'));
    await waitFor(() => expect(toasts()).toHaveLength(1));
    const [[type, message]] = toasts();
    expect(type).toBe('error');
    expect(message).toMatch(/^Couldn't .+: Server down$/);
    expect(screen.getByText('Manual order')).toBeInTheDocument();
    expect(btn('Back to automatic')).toBeInTheDocument();
  });
});
