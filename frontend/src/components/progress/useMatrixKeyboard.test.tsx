/**
 * useMatrixKeyboard — the stale `focusWithin` (S2a-3a·G5 Task TG8, the G4 re-review's Minor). A
 * write that removes the focused row moves focus to a control outside the grid in the same commit
 * (the Finished toggle); no blur reaches the grid, so the flag stayed set and a later re-render
 * that found <body> pulled focus to the first cell.
 */
import { act, render, screen } from '@testing-library/react';
import { useLayoutEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useMatrixKeyboard } from './useMatrixKeyboard';

/** Takes focus in the same commit that removes the row, as `FinishedFarms` does for a moved farm. */
function Claim({ on }: { on: boolean }) {
  useLayoutEffect(() => {
    if (on) document.getElementById('outside')?.focus();
  }, [on]);
  return null;
}

function Harness({ claim = true }: { claim?: boolean }) {
  const [showA, setShowA] = useState(true);
  const [, setTick] = useState(0);
  const rows = showA ? ['a', 'b'] : ['b'];
  const { cellProps } = useMatrixKeyboard(rows, ['name']);
  return (
    <div>
      {rows.map((id) => (
        <button key={id} type="button" data-testid={`cell-${id}`} {...cellProps(id, 'name')}>
          {id}
        </button>
      ))}
      <Claim on={claim && !showA} />
      <button id="outside" type="button" onClick={() => setShowA(false)}>
        outside
      </button>
      <button type="button" onClick={() => setTick((n) => n + 1)}>
        rerender
      </button>
    </div>
  );
}

describe('useMatrixKeyboard: focusWithin after focus left for a control outside the grid', () => {
  it('does not pull focus back to the first cell on a later re-render', () => {
    render(<Harness />);
    screen.getByTestId('cell-a').focus();
    // Row a goes away and the outside control takes the focus it held.
    act(() => screen.getByRole('button', { name: 'outside' }).click());
    expect(screen.getByRole('button', { name: 'outside' })).toHaveFocus();

    // The user lets go (a click on nothing), then something re-renders the grid.
    act(() => screen.getByRole('button', { name: 'outside' }).blur());
    expect(document.body).toHaveFocus();
    act(() => screen.getByRole('button', { name: 'rerender' }).click());
    expect(screen.getByTestId('cell-b')).not.toHaveFocus();
  });

  it('still puts focus on the stop when the focused row vanishes and nobody takes the focus', () => {
    render(<Harness claim={false} />);
    screen.getByTestId('cell-a').focus();
    act(() => screen.getByRole('button', { name: 'outside' }).click());
    expect(screen.getByTestId('cell-b')).toHaveFocus();
  });
});
