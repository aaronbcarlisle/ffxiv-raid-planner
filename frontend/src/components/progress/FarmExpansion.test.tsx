/**
 * FarmExpansion (S2a-3a·G2 Task TG3; R-S3-4): the panel row's shape and its Escape filter.
 * The matrix tests cover the row inside the grid (open, close, focus return); here the panel
 * stands alone in a table, and the filter is pinned both through the row and as the predicate
 * `escapeClosesPanel`, since the shell has no portalled layer of its own yet (TG5, TG6/TG7 and
 * TG8 pin the real picker, confirm and Select).
 */
import { createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildColumns, splitFarmRows } from '../../utils/progressModel';
import { goal, row } from './__fixtures__/progressFixtures';
import { FarmExpansion } from './FarmExpansion';
import { escapeClosesPanel } from './panelEscape';

const data = { goals: [goal('wings', { title: 'Wings of Resolve' })], participants: { wings: [row('wings', 'u1')] }, recordOnly: {} };
const columns = buildColumns([], 'standard', data);
const [wings] = splitFarmRows(data, columns, { currentUserId: 'u1', userRole: 'lead' }).active;

function renderPanel(onClose = vi.fn()) {
  render(
    <table>
      <tbody>
        <FarmExpansion
          row={wings}
          finished={false}
          canManage
          userRole="lead"
          currentUserId="u1"
          groupId="g1"
          onClose={onClose}
          id="progress-expansion-wings"
          spanAll={5}
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

  it('holds the empty action bar and the three named slots with their headings, and no control', () => {
    const { panel } = renderPanel();
    expect(within(panel).getByTestId('progress-expansion-actions')).toBeEmptyDOMElement();
    for (const [slot, heading] of [
      ['progress-expansion-queue', 'Next in line'],
      ['progress-expansion-drops', 'Last drops'],
      ['progress-expansion-about', 'About'],
    ] as const) {
      const section = within(panel).getByTestId(slot);
      expect(within(section).getByRole('heading', { name: heading })).toBeInTheDocument();
      expect(section).toHaveAccessibleName(heading);
    }
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument();
    expect(panel.querySelectorAll('[tabindex]')).toHaveLength(0);
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
