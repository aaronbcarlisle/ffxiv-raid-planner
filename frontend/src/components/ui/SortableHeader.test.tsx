// R-46 (Phase D) — v2's sortable header must be keyboard-operable.
//
// R-29 makes sorting absorb BOTH the chronological axis (D-32) and the layout
// axis (D-33) in v2's History, so a mouse-only header would leave a keyboard
// user with no way to reach either. These tests pin the three things
// `admin/SortableHeader` does NOT do — which is why R-46 rules a second
// component rather than a fix to the frozen one.
// `@testing-library/user-event` is not a dependency of this project — fireEvent
// throughout, matching WeekScopeControl.test.tsx.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SortableHeader } from './SortableHeader';

type Field = 'week' | 'player';

function renderHeader(overrides: Partial<Parameters<typeof SortableHeader<Field>>[0]> = {}) {
  const onSort = vi.fn();
  render(
    <table>
      <thead>
        <tr>
          <SortableHeader<Field>
            field="week"
            label="Week"
            currentField="week"
            currentDirection="asc"
            onSort={onSort}
            {...overrides}
          />
        </tr>
      </thead>
    </table>,
  );
  return { onSort };
}

describe('SortableHeader (ui)', () => {
  // The ruling's mechanism: use a real <button> so Enter/Space activation,
  // focus rings and AT activation come from the platform. Asserting "Enter
  // sorts" via fireEvent.keyDown would test jsdom, not this component — and
  // would still pass if someone swapped the button back for a <th onClick>.
  // Asserting the button role and its focusability is what actually pins it.
  it('exposes the control as a real button, so the platform supplies key handling', () => {
    renderHeader();
    const btn = screen.getByRole('button', { name: /week/i });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('is reachable by keyboard — not removed from the tab order', () => {
    renderHeader();
    const btn = screen.getByRole('button', { name: /week/i });

    btn.focus();
    expect(document.activeElement).toBe(btn);
    expect(btn.getAttribute('tabindex')).toBeNull();
  });

  it('sorts on activation', () => {
    const { onSort } = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /week/i }));
    expect(onSort).toHaveBeenCalledWith('week');
  });

  describe('aria-sort', () => {
    it('reports ascending on the active column', () => {
      renderHeader({ currentDirection: 'asc' });
      expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('ascending');
    });

    it('reports descending on the active column', () => {
      renderHeader({ currentDirection: 'desc' });
      expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('descending');
    });

    it('reports "none" — not nothing — on a sortable but unsorted column', () => {
      // This is what tells AT the column is sortable at all; the admin
      // component omits the attribute entirely in this state.
      renderHeader({ currentField: 'player' });
      expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('none');
    });
  });

  it('keeps the direction chevrons out of the accessible name', () => {
    // aria-sort already conveys state; the icons must not be announced too.
    renderHeader();
    expect(screen.getByRole('button').textContent).toBe('Week');
  });
});
