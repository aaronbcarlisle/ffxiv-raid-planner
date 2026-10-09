/**
 * useMatrixKeyboard — the Progress matrix as one roving-tabindex grid (S2a-2·F4 Task
 * TF6; the R-E1-E pattern of `GearBoard`). Exactly one cell is a Tab stop; the arrow
 * keys, Home and End move focus between cells and Tab leaves the grid. Unlike the
 * Board, every cell is focusable (blank and unclaimed ones too: their tooltip and name
 * are worth reading), so with no cell focused yet the first one is the stop.
 *
 * The stop is DERIVED at render, as `GearBoard` does: the last focused cell while it
 * still exists, else the first cell. Focus moves through a ref map, never a document
 * query. A handler that has already handled a key (`defaultPrevented`) is left alone.
 *
 * The props go on the cell's focus element: the `<td>` itself, or, when the cell holds a
 * single control (S2a-2·F5's own-cell picker), that control, as the WAI-ARIA grid puts a
 * cell's focus on its one widget. The `<td>` around a control takes no tabIndex, so the
 * grid keeps exactly one stop. Putting the props on the control, not the `<td>`, is also
 * what keeps a portalled popover's keys and focus (which React bubbles through the
 * Popover root, the control's sibling) away from the grid.
 */
import { useRef, useState, type KeyboardEvent } from 'react';

interface CellKey {
  rowId: string;
  colKey: string;
}

export interface MatrixCellProps {
  ref: (el: HTMLElement | null) => void;
  tabIndex: 0 | -1;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

const SEP = '\u001f';
const keyOf = (rowId: string, colKey: string) => `${rowId}${SEP}${colKey}`;

/** The index a key moves to from (row, col), or null when it goes nowhere (an edge, or not ours). */
function target(key: string, row: number, col: number, rows: number, cols: number): { row: number; col: number } | null {
  switch (key) {
    case 'ArrowRight':
      return col + 1 < cols ? { row, col: col + 1 } : null;
    case 'ArrowLeft':
      return col > 0 ? { row, col: col - 1 } : null;
    case 'ArrowDown':
      return row + 1 < rows ? { row: row + 1, col } : null;
    case 'ArrowUp':
      return row > 0 ? { row: row - 1, col } : null;
    case 'Home':
      return col > 0 ? { row, col: 0 } : null;
    case 'End':
      return col < cols - 1 ? { row, col: cols - 1 } : null;
    default:
      return null;
  }
}

const NAV_KEYS: ReadonlySet<string> = new Set(['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End']);

/**
 * `rowIds` are the grid's rows top to bottom and `colKeys` its columns left to right.
 * Spread `cellProps(rowId, colKey)` onto each cell's focus element (see above).
 */
export function useMatrixKeyboard(rowIds: readonly string[], colKeys: readonly string[]) {
  const [active, setActive] = useState<CellKey | null>(null);
  const cellEls = useRef(new Map<string, HTMLElement>());

  const stillThere = active !== null && rowIds.includes(active.rowId) && colKeys.includes(active.colKey);
  const stop: CellKey | null = stillThere
    ? active
    : rowIds.length > 0 && colKeys.length > 0
      ? { rowId: rowIds[0], colKey: colKeys[0] }
      : null;

  const focusAt = (row: number, col: number): boolean => {
    const el = cellEls.current.get(keyOf(rowIds[row], colKeys[col]));
    if (!el) return false;
    el.focus();
    // Native focus() scrolls only a fully hidden element; a half-hidden cell needs the nudge.
    // (Optional: jsdom has no scrollIntoView.)
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    return el.ownerDocument.activeElement === el;
  };

  const cellProps = (rowId: string, colKey: string): MatrixCellProps => ({
    ref: (el) => {
      const key = keyOf(rowId, colKey);
      if (el) cellEls.current.set(key, el);
      else cellEls.current.delete(key);
    },
    tabIndex: stop !== null && stop.rowId === rowId && stop.colKey === colKey ? 0 : -1,
    onFocus: () => setActive((prev) => (prev?.rowId === rowId && prev.colKey === colKey ? prev : { rowId, colKey })),
    onKeyDown: (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!NAV_KEYS.has(event.key)) return;
      const row = rowIds.indexOf(rowId);
      const col = colKeys.indexOf(colKey);
      if (row < 0 || col < 0) return;
      const next = target(event.key, row, col, rowIds.length, colKeys.length);
      // At an edge nothing moves, and the key keeps its default (the page may scroll).
      if (next !== null && focusAt(next.row, next.col)) event.preventDefault();
    },
  });

  return { cellProps };
}

export type MatrixKeyboard = ReturnType<typeof useMatrixKeyboard>;
