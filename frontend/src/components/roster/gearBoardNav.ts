/**
 * gearBoardNav — pure 2-D arrow navigation for the Roster Board's roving tab
 * stop (R-E1-E).
 *
 * `grid[row][col]` is `true` when the rendered cell at that PLAYER row and slot
 * column is interactive (editable, with a BiS target). Rows are the rendered
 * player rows in render order: section dividers are not rows, and a no-BiS
 * spanning row is an all-`false` row. Left/Right move to the nearest interactive
 * cell in the same row; Up/Down to the nearest player row above/below with an
 * interactive cell in the SAME column. Nothing wraps — an edge returns `null` so
 * the caller leaves the key's default behavior alone.
 */
export type BoardArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

interface BoardCellPos {
  row: number;
  col: number;
}

const ARROW_KEYS: ReadonlySet<string> = new Set<BoardArrowKey>(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Type guard for a `KeyboardEvent.key` the Board navigates on. */
export function isBoardArrowKey(key: string): key is BoardArrowKey {
  return ARROW_KEYS.has(key);
}

/** The interactive cell an arrow press moves to from `from`, or `null` at an edge. */
export function nextBoardCell(
  grid: ReadonlyArray<ReadonlyArray<boolean>>,
  from: BoardCellPos,
  key: BoardArrowKey,
): BoardCellPos | null {
  const step = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const cells = grid[from.row] ?? [];
    for (let col = from.col + step; col >= 0 && col < cells.length; col += step) {
      if (cells[col]) return { row: from.row, col };
    }
    return null;
  }
  for (let row = from.row + step; row >= 0 && row < grid.length; row += step) {
    if (grid[row]?.[from.col]) return { row, col: from.col };
  }
  return null;
}
