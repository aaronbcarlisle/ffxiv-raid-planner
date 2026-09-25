import { describe, it, expect } from 'vitest';
import { isBoardArrowKey, nextBoardCell } from './gearBoardNav';

/** Rendered player rows of cells: `x` = interactive, `_` = inert (or absent). */
const grid = (...rows: string[]) => rows.map((r) => [...r].map((c) => c === 'x'));

describe('nextBoardCell', () => {
  it('T2-b1: left/right move to the nearest interactive cell in the row, skipping inert cells', () => {
    const g = grid('x__xx');
    expect(nextBoardCell(g, { row: 0, col: 0 }, 'ArrowRight')).toEqual({ row: 0, col: 3 });
    expect(nextBoardCell(g, { row: 0, col: 3 }, 'ArrowRight')).toEqual({ row: 0, col: 4 });
    expect(nextBoardCell(g, { row: 0, col: 4 }, 'ArrowLeft')).toEqual({ row: 0, col: 3 });
    expect(nextBoardCell(g, { row: 0, col: 3 }, 'ArrowLeft')).toEqual({ row: 0, col: 0 });
  });

  it('T2-b2: up/down stay in the column and skip rows with no interactive cell there', () => {
    // Row 1 is a no-BiS / non-editable row; row 2 is live in other columns but not col 1.
    const g = grid('xxx', '___', 'x_x', 'xxx');
    expect(nextBoardCell(g, { row: 0, col: 1 }, 'ArrowDown')).toEqual({ row: 3, col: 1 });
    expect(nextBoardCell(g, { row: 3, col: 1 }, 'ArrowUp')).toEqual({ row: 0, col: 1 });
    expect(nextBoardCell(g, { row: 0, col: 0 }, 'ArrowDown')).toEqual({ row: 2, col: 0 });
    expect(nextBoardCell(g, { row: 3, col: 2 }, 'ArrowUp')).toEqual({ row: 2, col: 2 });
  });

  it('T2-b3: an edge returns null (no wrap)', () => {
    const g = grid('x_x', '___', 'x_x');
    expect(nextBoardCell(g, { row: 0, col: 0 }, 'ArrowLeft')).toBeNull();
    expect(nextBoardCell(g, { row: 0, col: 2 }, 'ArrowRight')).toBeNull();
    expect(nextBoardCell(g, { row: 0, col: 0 }, 'ArrowUp')).toBeNull();
    expect(nextBoardCell(g, { row: 2, col: 2 }, 'ArrowDown')).toBeNull();
    // Only inert cells remain below in this column: an edge, not a jump to another column.
    expect(nextBoardCell(grid('_x_', 'x_x'), { row: 0, col: 1 }, 'ArrowDown')).toBeNull();
  });
});

describe('isBoardArrowKey', () => {
  it('accepts the four arrows and nothing else', () => {
    expect(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].every(isBoardArrowKey)).toBe(true);
    expect(['Enter', ' ', 'Tab', 'Home', 'PageDown', 'Left'].some(isBoardArrowKey)).toBe(false);
  });
});
