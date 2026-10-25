/**
 * QueueOrderEditor (S2a-3c·C3 Task TC3; design D-6, E-7, E-8; R-C-7): the inline editor alone,
 * fed a queue from `queueFor` over `farmRowOf` (the matrix's own cells). Every entry is listed,
 * "#k" by its place in the draft, with Move {name} up / down; a move that can't happen is
 * `aria-disabled` + `BUSY_CLASS` and does nothing; focus follows the moved entry; a polite status
 * line reads "{name}, {k} of {n}"; Save order hands the draft's ids up; Cancel and Escape cancel.
 * No request is made here (the save path is `QueueList.order.test.tsx`'s).
 */
import { createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { queueFor } from '../../utils/progressQueue';
import { farmRowOf, goal, type ColumnSpec } from './__fixtures__/progressFixtures';
import { QueueOrderEditor } from './QueueOrderEditor';
import { BUSY_CLASS } from './useDrops';

const WINGS = goal('wings', { title: 'Wings' });
const need = (tokenCount: number | null, extra: Partial<NonNullable<ColumnSpec['cell']>> = {}) => ({ state: 'need' as const, tokenCount, ...extra });
const want = (tokenCount: number | null) => ({ state: 'want' as const, tokenCount });

const queueOf = (specs: ColumnSpec[], g = WINGS) => queueFor(farmRowOf(specs, g), g.priorityMode);

function renderEditor(specs: ColumnSpec[], opts: { saving?: boolean; g?: typeof WINGS } = {}) {
  const g = opts.g ?? WINGS;
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <QueueOrderEditor queue={queueOf(specs, g)} tokenCost={g.tokenCost} saving={opts.saving ?? false} onSave={onSave} onCancel={onCancel} />,
  );
  const rerenderWith = (next: ColumnSpec[], saving = opts.saving ?? false) =>
    view.rerender(<QueueOrderEditor queue={queueOf(next, g)} tokenCost={g.tokenCost} saving={saving} onSave={onSave} onCancel={onCancel} />);
  return { ...view, onSave, onCancel, rerenderWith };
}

const list = () => screen.getByRole('list', { name: 'Queue order' });
/** An entry's own text, "#k {name} · {text}", without its buttons' hidden labels, whitespace collapsed. */
const entryText = (li: Element) => {
  const copy = li.cloneNode(true) as Element;
  copy.querySelectorAll('button').forEach((b) => b.remove());
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim().replace(/^(#\d+)\s*/, '$1 ');
};
const entries = () => within(list()).getAllByRole('listitem').map(entryText);
const btn = (name: string) => screen.getByRole('button', { name });
const busy = BUSY_CLASS.split(' ');

// Automatic: Bea (10), Ann (60), Cy (Want 5).
const THREE: ColumnSpec[] = [
  { id: 'Ann', cell: need(60) },
  { id: 'Bea', cell: need(10) },
  { id: 'Cy', cell: want(5) },
];

const SIX: ColumnSpec[] = [
  { id: 'Ann', cell: need(60) },
  { id: 'Bea', cell: need(10) },
  { id: 'Cy', cell: need(30) },
  { id: 'Dee', cell: want(5) },
  { id: 'Eli', cell: need(90) },
  { id: 'Fay', cell: want(1) },
];

describe('QueueOrderEditor: the list (R-C-7, D-6)', () => {
  it('lists every queued entry as "#k {name} · {text}" in an <ol> named "Queue order", more than four with no Show all', () => {
    renderEditor(SIX);
    expect(list().tagName).toBe('OL');
    expect(entries()).toEqual([
      '#1 Bea · Need 10/99',
      '#2 Cy · Need 30/99',
      '#3 Ann · Need 60/99',
      '#4 Eli · Need 90/99',
      '#5 Fay · Want 1/99',
      '#6 Dee · Want 5/99',
    ]);
    expect(screen.queryByRole('button', { name: /Show all|Show fewer/ })).not.toBeInTheDocument();
  });

  it('runs Move up, Move down entry by entry, then Save order, then Cancel, in DOM (Tab) order', () => {
    const { container } = renderEditor(THREE);
    const names = [...container.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim());
    expect(names).toEqual([
      'Move Bea up', 'Move Bea down',
      'Move Ann up', 'Move Ann down',
      'Move Cy up', 'Move Cy down',
      'Save order', 'Cancel',
    ]);
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(0);
  });

  it('reads the state alone for a hidden count, and "Need 12" on a drop-only farm', () => {
    const { unmount } = renderEditor([{ id: 'Ann', cell: need(null, { countHidden: true }) }, { id: 'Bea', cell: need(5) }]);
    expect(entries()).toEqual(['#1 Bea · Need 5/99', '#2 Ann · Need']);
    unmount();
    renderEditor([{ id: 'Ann', cell: need(12) }, { id: 'Bea', cell: need(3) }], { g: goal('wings', { tokenCost: null }) });
    expect(entries()).toEqual(['#1 Ann · Need 12', '#2 Bea · Need 3']);
  });

  it('names the buttons with quotes, apostrophes and non-ASCII names verbatim', () => {
    renderEditor([{ id: 'Zoë O\'Brien "Ł"', cell: need(1) }, { id: '$100%…', cell: need(2) }]);
    expect(btn('Move Zoë O\'Brien "Ł" down')).toBeInTheDocument();
    expect(btn('Move $100%… up')).toBeInTheDocument();
    expect(entries()).toEqual(['#1 Zoë O\'Brien "Ł" · Need 1/99', '#2 $100%… · Need 2/99']);
  });
});

describe('QueueOrderEditor: moving (E-8)', () => {
  it('Move up on the second Need puts it at #1, keeps focus on its Move up, and announces "{name}, 1 of 3"', () => {
    renderEditor([{ id: 'Ann', cell: need(60) }, { id: 'Bea', cell: need(10) }, { id: 'Cy', cell: need(30) }]);
    // Automatic: Bea, Cy, Ann. Cy is the second Need.
    fireEvent.click(btn('Move Cy up'));
    expect(entries()).toEqual(['#1 Cy · Need 30/99', '#2 Bea · Need 10/99', '#3 Ann · Need 60/99']);
    expect(document.activeElement).toBe(btn('Move Cy up'));
    expect(screen.getByRole('status')).toHaveTextContent('Cy, 1 of 3');
  });

  it('Move down moves the entry one place and keeps focus on its Move down', () => {
    renderEditor([{ id: 'Ann', cell: need(60) }, { id: 'Bea', cell: need(10) }, { id: 'Cy', cell: need(30) }]);
    fireEvent.click(btn('Move Bea down'));
    expect(entries()).toEqual(['#1 Cy · Need 30/99', '#2 Bea · Need 10/99', '#3 Ann · Need 60/99']);
    expect(document.activeElement).toBe(btn('Move Bea down'));
    expect(screen.getByRole('status')).toHaveTextContent('Bea, 2 of 3');
    fireEvent.click(btn('Move Bea down'));
    expect(entries()[2]).toBe('#3 Bea · Need 10/99');
    expect(document.activeElement).toBe(btn('Move Bea down'));
    expect(screen.getByRole('status')).toHaveTextContent('Bea, 3 of 3');
  });

  it('numbers "#k" by place in the draft, never by the queue rank, after several moves', () => {
    renderEditor(SIX);
    fireEvent.click(btn('Move Eli up'));
    fireEvent.click(btn('Move Eli up'));
    fireEvent.click(btn('Move Dee up'));
    expect(entries()).toEqual([
      '#1 Bea · Need 10/99',
      '#2 Eli · Need 90/99',
      '#3 Cy · Need 30/99',
      '#4 Ann · Need 60/99',
      '#5 Dee · Want 5/99',
      '#6 Fay · Want 1/99',
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Dee, 5 of 6');
  });

  it('marks the first entry\'s up, the last Need\'s down, the first Want\'s up and the last entry\'s down aria-disabled with BUSY_CLASS, and they change nothing', () => {
    const { onSave } = renderEditor([
      { id: 'Ann', cell: need(10) },
      { id: 'Bea', cell: need(20) },
      { id: 'Cy', cell: want(1) },
      { id: 'Dee', cell: want(2) },
    ]);
    const stuck = ['Move Ann up', 'Move Bea down', 'Move Cy up', 'Move Dee down'];
    for (const name of stuck) {
      expect(btn(name)).toHaveAttribute('aria-disabled', 'true');
      expect(btn(name)).toHaveClass(...busy);
      expect(btn(name)).not.toBeDisabled();
    }
    for (const name of ['Move Ann down', 'Move Bea up', 'Move Cy down', 'Move Dee up']) {
      expect(btn(name)).not.toHaveAttribute('aria-disabled', 'true');
    }
    const before = entries();
    for (const name of stuck) fireEvent.click(btn(name));
    expect(entries()).toEqual(before);
    fireEvent.click(btn('Save order'));
    expect(onSave).toHaveBeenCalledWith(['Ann', 'Bea', 'Cy', 'Dee']);
  });

  it('keeps a moved-to-the-top entry\'s focused Move up focusable once it turns aria-disabled', () => {
    renderEditor(THREE);
    fireEvent.click(btn('Move Ann up'));
    expect(btn('Move Ann up')).toHaveAttribute('aria-disabled', 'true');
    expect(btn('Move Bea up')).not.toHaveAttribute('aria-disabled', 'true');
    expect(document.activeElement).toBe(btn('Move Ann up'));
  });

  it('handles a long queue (60 Needs): all listed, and the last one moves up', () => {
    const many: ColumnSpec[] = Array.from({ length: 60 }, (_, i) => ({ id: `P${String(i).padStart(2, '0')}`, cell: need(i) }));
    renderEditor(many);
    expect(entries()).toHaveLength(60);
    fireEvent.click(btn('Move P59 up'));
    expect(entries()[58]).toBe('#59 P59 · Need 59/99');
    expect(screen.getByRole('status')).toHaveTextContent('P59, 59 of 60');
  });
});

describe('QueueOrderEditor: Save, Cancel, Escape (R-C-7)', () => {
  it('Save order hands up the draft ids, Needs then Wants', () => {
    const { onSave } = renderEditor(THREE);
    fireEvent.click(btn('Move Ann up'));
    const save = btn('Save order');
    expect(save).toHaveClass(...busy);
    expect(save).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['Ann', 'Bea', 'Cy']);
  });

  it('while saving, Save order is aria-disabled and ignores clicks', () => {
    const { onSave } = renderEditor(THREE, { saving: true });
    const save = btn('Save order');
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).toHaveClass(...busy);
    fireEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Cancel calls onCancel and saves nothing', () => {
    const { onSave, onCancel } = renderEditor(THREE);
    fireEvent.click(btn('Move Ann up'));
    fireEvent.click(btn('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Escape inside cancels and prevents the key; an Escape a child already prevented is left alone', () => {
    const { onCancel } = renderEditor(THREE);
    const escape = createEvent.keyDown(btn('Move Ann down'), { key: 'Escape' });
    fireEvent(btn('Move Ann down'), escape);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(escape.defaultPrevented).toBe(true);

    const handled = createEvent.keyDown(btn('Move Bea up'), { key: 'Escape' });
    handled.preventDefault();
    fireEvent(btn('Move Bea up'), handled);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('QueueOrderEditor: the draft across a refresh (E-7)', () => {
  it('drops a member turned Have, appends a new Need to the Needs, renumbers, and saves the derived list', () => {
    const start: ColumnSpec[] = [
      { id: 'Ann', cell: need(60) },
      { id: 'Bea', cell: need(10) },
      { id: 'Cy', cell: need(30) },
      { id: 'Dee', cell: want(5) },
    ];
    const { onSave, rerenderWith } = renderEditor(start);
    // Automatic: Bea, Cy, Ann, Dee. Draft after the move: Bea, Ann, Cy, Dee.
    fireEvent.click(btn('Move Ann up'));
    expect(entries().map((e) => e.split(' ')[1])).toEqual(['Bea', 'Ann', 'Cy', 'Dee']);

    // A refresh: Bea got it (Have), Eve set Need with the fewest tokens (automatic would put her first).
    rerenderWith([
      { id: 'Ann', cell: need(60) },
      { id: 'Bea', cell: { state: 'have' } },
      { id: 'Cy', cell: need(30) },
      { id: 'Dee', cell: want(5) },
      { id: 'Eve', cell: need(1) },
    ]);
    expect(entries()).toEqual(['#1 Ann · Need 60/99', '#2 Cy · Need 30/99', '#3 Eve · Need 1/99', '#4 Dee · Want 5/99']);
    expect(screen.queryByRole('button', { name: 'Move Bea up' })).not.toBeInTheDocument();
    fireEvent.click(btn('Save order'));
    expect(onSave).toHaveBeenCalledWith(['Ann', 'Cy', 'Eve', 'Dee']);
  });

  it('moves a member who switched Need to Want into the Wants, in draft order there', () => {
    const { onSave, rerenderWith } = renderEditor(THREE);
    // Draft: Ann, Bea, Cy. Ann switches to Want: the Wants read in draft order, Ann before Cy.
    fireEvent.click(btn('Move Ann up'));
    rerenderWith([{ id: 'Ann', cell: want(60) }, { id: 'Bea', cell: need(10) }, { id: 'Cy', cell: want(5) }]);
    expect(entries()).toEqual(['#1 Bea · Need 10/99', '#2 Ann · Want 60/99', '#3 Cy · Want 5/99']);
    fireEvent.click(btn('Save order'));
    expect(onSave).toHaveBeenCalledWith(['Bea', 'Ann', 'Cy']);
  });
});
