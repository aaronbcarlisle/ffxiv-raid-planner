/**
 * FarmExpansion (S2a-3a·G2 Task TG3, G2b Task TG4; R-S3-4, R-S3-2, R-S3-15): the panel row's shape,
 * its Escape filter, and what the panel now holds. The matrix tests cover the row inside the grid
 * (open, close, focus return, Tab in, the width following the scroller); here the panel stands
 * alone in a table: the shell and D-4's order (action bar, then Next in line · Last drops ·
 * About), the queue and About filled from the row (a viewer's unranked line), Copy plan (the
 * clipboard text, its toasts, every role, a finished row), and the Escape filter, pinned both
 * through the row and as the predicate `escapeClosesPanel`, since the shell has no portalled
 * layer of its own yet (TG5, TG6/TG7 and TG8 pin the real picker, confirm and Select).
 */
import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastStore } from '../../stores/toastStore';
import type { MemberRole } from '../../types';
import { buildColumns, splitFarmRows, type FarmRow } from '../../utils/progressModel';
import { farmRowOf, goal, row, type ColumnSpec } from './__fixtures__/progressFixtures';
import { FarmExpansion } from './FarmExpansion';
import { escapeClosesPanel } from './panelEscape';

const data = { goals: [goal('wings', { title: 'Wings of Resolve' })], participants: { wings: [row('wings', 'u1')] }, recordOnly: {} };
const columns = buildColumns([], 'standard', data);
const [wings] = splitFarmRows(data, columns, { currentUserId: 'u1', userRole: 'lead' }).active;

interface PanelOptions {
  onClose?: () => void;
  row?: FarmRow;
  userRole?: MemberRole;
  finished?: boolean;
  viewWidth?: number | null;
}

function renderPanel({ onClose = vi.fn(), row: farmRow = wings, userRole = 'lead', finished = false, viewWidth }: PanelOptions = {}) {
  render(
    <table>
      <tbody>
        <FarmExpansion
          row={farmRow}
          finished={finished}
          canManage
          userRole={userRole}
          currentUserId="u1"
          groupId="g1"
          onClose={onClose}
          id="progress-expansion-wings"
          spanAll={5}
          viewWidth={viewWidth}
        />
      </tbody>
    </table>,
  );
  return { onClose, panel: screen.getByTestId('progress-expansion') };
}

afterEach(() => document.body.replaceChildren());

describe('FarmExpansion shell', () => {
  it('is a grid row with one gridcell spanning every column, carrying the id the name button controls', () => {
    const { panel } = renderPanel();
    expect(panel).toHaveAttribute('role', 'row');
    expect(panel).toHaveAttribute('id', 'progress-expansion-wings');
    const cells = within(panel).getAllByRole('gridcell');
    expect(cells).toHaveLength(1);
    expect((cells[0] as HTMLTableCellElement).colSpan).toBe(5);
  });

  it('holds the action bar and the three named slots with their headings', () => {
    const { panel } = renderPanel();
    for (const [slot, heading] of [
      ['progress-expansion-queue', 'Next in line'],
      ['progress-expansion-drops', 'Last drops'],
      ['progress-expansion-about', 'About'],
    ] as const) {
      const section = within(panel).getByTestId(slot);
      expect(within(section).getByRole('heading', { name: heading })).toBeInTheDocument();
      expect(section).toHaveAccessibleName(heading);
    }
    expect(panel.querySelectorAll('[tabindex]')).toHaveLength(0);
  });

  it('holds its content to the visible width it is given, and leaves it free until measured', () => {
    const { panel } = renderPanel({ viewWidth: 1288 });
    expect(within(panel).getByTestId('progress-expansion-body')).toHaveStyle({ width: '1288px' });
    document.body.replaceChildren();
    const unmeasured = renderPanel({ viewWidth: null }).panel;
    expect((within(unmeasured).getByTestId('progress-expansion-body') as HTMLElement).style.width).toBe('');
  });

  it('puts the action bar first, then Next in line · Last drops · About, in DOM order (D-4)', () => {
    const { panel } = renderPanel();
    const order = [
      within(panel).getByTestId('progress-expansion-actions'),
      within(panel).getByRole('heading', { name: 'Next in line' }),
      within(panel).getByRole('heading', { name: 'Last drops' }),
      within(panel).getByRole('heading', { name: 'About' }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('fills Next in line and About from the row', () => {
    const { panel } = renderPanel({
      row: farmRowOf(
        [{ id: 'Ann', cell: { state: 'need', tokenCount: 7 } }],
        goal('g1', { priorityMode: 'priority_order', contentType: 'extreme', contentKey: 'ex4', summary: 'Tuesdays' }),
      ),
    });
    expect(within(within(panel).getByTestId('progress-expansion-queue')).getByText('Ann · Need 7/99')).toBeInTheDocument();
    const about = within(panel).getByTestId('progress-expansion-about');
    expect(within(about).getByText('Extreme · ex4')).toBeInTheDocument();
    expect(within(about).getByText('Priority order')).toBeInTheDocument();
    expect(within(about).getByText('Tuesdays')).toBeInTheDocument();
  });

  it('shows a viewer the unranked line, not the ranked list', () => {
    const { panel } = renderPanel({
      userRole: 'viewer',
      row: farmRowOf(
        [
          { id: 'Healer 1', cell: { state: 'need', tokenCount: 80 } },
          { id: 'Melee 2', cell: { state: 'need', tokenCount: 5 } },
        ],
        goal('g1'),
      ),
    });
    const queue = within(panel).getByTestId('progress-expansion-queue');
    expect(within(queue).getByText('Need: Healer 1, Melee 2')).toBeInTheDocument();
    expect(within(queue).queryByRole('list')).not.toBeInTheDocument();
  });
});

describe('FarmExpansion Copy plan (R-S3-2, D-17)', () => {
  const PLAN: ColumnSpec[] = [
    { id: 'Ann', cell: { state: 'need', tokenCount: 120 } },
    { id: 'Bea', cell: { state: 'need', tokenCount: 10 } },
    { id: 'Cy', cell: { state: 'want', tokenCount: 5 } },
    { id: 'Dee', cell: { state: 'have' } },
  ];
  const shiny = goal('g1', { title: 'Shiny Mount', priorityMode: 'priority_order', tokenName: 'Tomestone', tokenCost: 99 });
  const writeText = vi.fn();
  const toasts = () => useToastStore.getState().toasts.map((t) => [t.type, t.message]);

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    useToastStore.getState().clearAll();
  });

  it("writes the plan in the queue's order and toasts \"Plan copied\"", async () => {
    renderPanel({ row: farmRowOf(PLAN, shiny) });
    fireEvent.click(screen.getByRole('button', { name: 'Copy plan' }));
    await waitFor(() => expect(toasts()).toEqual([['success', 'Plan copied']]));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toBe(
      [
        '**Shiny Mount** farm plan',
        'Mode: Priority order',
        'Exchange: 99× Tomestone',
        '',
        '🎯 **Need (2):** Bea, Ann',
        '⭐ **Want (1):** Cy',
        '💰 **Can buy now:** Ann',
        '✅ **Have (1):** Dee',
      ].join('\n'),
    );
  });

  it('follows the mode: free_roll has no Need or Want line', async () => {
    renderPanel({ row: farmRowOf(PLAN, { ...shiny, priorityMode: 'free_roll' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Copy plan' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = writeText.mock.calls[0][0] as string;
    expect(text).not.toContain('🎯');
    expect(text).not.toContain('⭐');
    expect(text).toContain('💰 **Can buy now:** Ann');
  });

  it('gives a viewer a plan with every count null: no Can buy now line, even when the row carries counts', async () => {
    renderPanel({ userRole: 'viewer', row: farmRowOf(PLAN, shiny) });
    fireEvent.click(screen.getByRole('button', { name: 'Copy plan' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain('🎯 **Need (2):**');
    expect(text).not.toContain('Can buy now');
  });

  it("toasts \"Couldn't copy the plan\" when the clipboard rejects, and with no clipboard at all", async () => {
    writeText.mockRejectedValue(new Error('denied'));
    renderPanel({ row: farmRowOf(PLAN, shiny) });
    fireEvent.click(screen.getByRole('button', { name: 'Copy plan' }));
    await waitFor(() => expect(toasts()).toEqual([['error', "Couldn't copy the plan"]]));
    useToastStore.getState().clearAll();
    Object.assign(navigator, { clipboard: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Copy plan' }));
    await waitFor(() => expect(toasts()).toEqual([['error', "Couldn't copy the plan"]]));
  });

  it.each(['owner', 'lead', 'member', 'viewer'] as const)('is in the action bar for %s', (userRole) => {
    renderPanel({ userRole });
    expect(within(screen.getByTestId('progress-expansion-actions')).getByRole('button', { name: 'Copy plan' })).toBeInTheDocument();
  });

  it.each(['owner', 'lead', 'member', 'viewer'] as const)('is the only control on a finished row for %s', (userRole) => {
    renderPanel({ userRole, finished: true });
    const buttons = within(screen.getByTestId('progress-expansion-actions')).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Copy plan']);
  });
});

describe('FarmExpansion Escape (R-S3-4)', () => {
  it('asks to close on an Escape pressed inside the panel, and takes the key', () => {
    const { onClose, panel } = renderPanel();
    const heading = within(panel).getByRole('heading', { name: 'About' });
    expect(fireEvent.keyDown(heading, { key: 'Escape' })).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores every other key', () => {
    const { onClose, panel } = renderPanel();
    for (const key of ['Enter', ' ', 'ArrowDown', 'Tab', 'Home']) expect(fireEvent.keyDown(panel, { key })).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('leaves an Escape a layer already handled alone (defaultPrevented)', () => {
    const { onClose, panel } = renderPanel();
    const handled = createEvent.keyDown(panel, { key: 'Escape' });
    handled.preventDefault();
    fireEvent(panel, handled);
    expect(onClose).not.toHaveBeenCalled();
  });

  describe('escapeClosesPanel', () => {
    const panel = document.createElement('tr');
    const inside = panel.appendChild(document.createElement('td'));
    /** A node React would render through a portal from inside the panel: outside it in the DOM. */
    const portalled = document.createElement('div');

    it('closes for an unhandled Escape from a node inside the panel', () => {
      expect(escapeClosesPanel({ key: 'Escape', defaultPrevented: false, target: inside }, panel)).toBe(true);
    });

    it('does not close for an Escape another layer handled first', () => {
      expect(escapeClosesPanel({ key: 'Escape', defaultPrevented: true, target: inside }, panel)).toBe(false);
    });

    it('does not close for an Escape from a portalled node outside the panel in the DOM', () => {
      document.body.append(panel, portalled);
      expect(escapeClosesPanel({ key: 'Escape', defaultPrevented: false, target: portalled }, panel)).toBe(false);
    });

    it('does not close for another key, or with no panel mounted', () => {
      expect(escapeClosesPanel({ key: 'Enter', defaultPrevented: false, target: inside }, panel)).toBe(false);
      expect(escapeClosesPanel({ key: 'Escape', defaultPrevented: false, target: inside }, null)).toBe(false);
    });
  });
});
