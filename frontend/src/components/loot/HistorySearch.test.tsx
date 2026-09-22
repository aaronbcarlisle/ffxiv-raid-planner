// `@testing-library/user-event` is not a dependency of this project (see
// `Loot.test.tsx`/`WeekScopeControl.test.tsx` headers) — interaction is driven
// via `fireEvent`, the established convention.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { HistorySearch, type HistorySearchProps } from './HistorySearch';
import type { SnapshotPlayer } from '../../types';

function makePlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Tank One',
    job: 'PLD',
    role: 'tank',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    ...overrides,
  } as unknown as SnapshotPlayer;
}

const FLOORS = ['M9S', 'M10S', 'M11S', 'M12S'];
const PLAYERS = [makePlayer(), makePlayer({ id: 'p2', name: 'Healer Two' })];

function renderControl(overrides: Partial<HistorySearchProps> = {}) {
  const onQueryChange = vi.fn();
  const props: HistorySearchProps = {
    query: '',
    onQueryChange,
    unknownKeys: [],
    unknownValues: [],
    floors: FLOORS,
    players: PLAYERS,
    ...overrides,
  };
  const utils = render(<HistorySearch {...props} />);
  return { onQueryChange, ...utils };
}

/**
 * A tiny "controlled component" harness: each `onQueryChange` call is fed
 * back into a re-render, the way `Loot.tsx` actually wires this component —
 * so a click sequence (e.g. Gear then Materials) exercises real query
 * composition, not just a single fired callback.
 */
function renderStateful(initial: Partial<HistorySearchProps> = {}) {
  let query = initial.query ?? '';
  const rerenderRef: { current: () => void } = { current: () => {} };
  const onQueryChange = vi.fn((next: string) => {
    query = next;
    rerenderRef.current();
  });
  const build = () => (
    <HistorySearch
      query={query}
      onQueryChange={onQueryChange}
      unknownKeys={initial.unknownKeys ?? []}
      unknownValues={initial.unknownValues ?? []}
      floors={initial.floors ?? FLOORS}
      players={initial.players ?? PLAYERS}
    />
  );
  const utils = render(build());
  rerenderRef.current = () => utils.rerender(build());
  return { getQuery: () => query, onQueryChange, ...utils };
}

describe('HistorySearch', () => {
  // ── Search row ──────────────────────────────────────────────────────────

  it('renders the placeholder verbatim, naming week/source but never the D11 shortcut', () => {
    renderControl();
    const input = screen.getByPlaceholderText(
      'Search — player:"Tank One", floor:m9s,m10s, source:tome, week:3',
    );
    expect(input).toBeInTheDocument();
    expect(input.getAttribute('placeholder')).not.toMatch(/Ctrl\+Shift\+F|\^⇧F/i);
  });

  it('calls onQueryChange with the new value as the box is typed into', () => {
    const { onQueryChange } = renderControl();
    fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: 'floor:m9s' } });
    expect(onQueryChange).toHaveBeenCalledWith('floor:m9s');
  });

  it('shows no clear button when the query is empty', () => {
    renderControl({ query: '' });
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('shows the clear button once the query is non-empty, and it empties the query', () => {
    const { onQueryChange } = renderControl({ query: 'floor:m9s' });
    const clearBtn = screen.getByRole('button', { name: 'Clear search' });
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(onQueryChange).toHaveBeenCalledWith('');
  });

  // ── Hint line ───────────────────────────────────────────────────────────

  it('mounts the hint line even with nothing to say, with empty text', () => {
    renderControl();
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status.textContent).toBe('');
  });

  it('reports a single unknown key', () => {
    renderControl({ unknownKeys: ['colour'] });
    expect(screen.getByRole('status').textContent).toBe(
      'Unknown filter "colour" — ignored. Try: player, floor, slot, type, method, week, job, source',
    );
  });

  it('reports multiple unknown keys with the plural form', () => {
    renderControl({ unknownKeys: ['colour', 'size'] });
    expect(screen.getByRole('status').textContent).toBe(
      'Unknown filters "colour", "size" — ignored. Try: player, floor, slot, type, method, week, job, source',
    );
  });

  it('reports an unknown source value', () => {
    renderControl({ unknownValues: [{ key: 'source', value: 'tomes' }] });
    expect(screen.getByRole('status').textContent).toBe(
      'Unknown source "tomes" — nothing matches. Try: raid, tome, book, material',
    );
  });

  it('reports an unknown week value', () => {
    renderControl({ unknownValues: [{ key: 'week', value: 'three' }] });
    expect(screen.getByRole('status').textContent).toBe(
      'Unknown week "three" — nothing matches. Use a week number.',
    );
  });

  it('renders every applicable fact as its own line when several are true at once', () => {
    // One query can carry all three at once (`colour:blue source:tomes
    // week:three`). Each fact is a separate <p> inside the one live region:
    // the key line must keep saying "ignored" and the value lines "nothing
    // matches", because those are different outcomes (R-D10-K) and collapsing
    // them into one sentence would make the wrong one true for two of them.
    renderControl({
      unknownKeys: ['colour'],
      unknownValues: [
        { key: 'source', value: 'tomes' },
        { key: 'week', value: 'three' },
      ],
    });
    const lines = Array.from(screen.getByRole('status').querySelectorAll('p')).map(
      (p) => p.textContent,
    );
    expect(lines).toEqual([
      'Unknown filter "colour" — ignored. Try: player, floor, slot, type, method, week, job, source',
      'Unknown source "tomes" — nothing matches. Try: raid, tome, book, material',
      'Unknown week "three" — nothing matches. Use a week number.',
    ]);
  });

  // ── Type row (R-D10-A / R-D10-E / R-47) ────────────────────────────────

  it('lights the Type "All" pill when no type token exists, and Gear/Materials when typed', () => {
    const { rerender } = renderControl({ query: '' });
    const typeGroup = () => screen.getByRole('group', { name: 'Type filter' });
    expect(within(typeGroup()).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    rerender(
      <HistorySearch
        query="type:gear"
        onQueryChange={vi.fn()}
        unknownKeys={[]}
        unknownValues={[]}
        floors={FLOORS}
        players={PLAYERS}
      />,
    );
    expect(within(typeGroup()).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(within(typeGroup()).getByRole('button', { name: 'Gear' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(typeGroup()).getByRole('button', { name: 'Materials' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('clicking Gear then Materials merges into one comma token, never a second type: token', () => {
    const { getQuery } = renderStateful({ query: '' });
    const typeGroup = () => screen.getByRole('group', { name: 'Type filter' });

    fireEvent.click(within(typeGroup()).getByRole('button', { name: 'Gear' }));
    expect(getQuery()).toBe('type:gear');

    fireEvent.click(within(typeGroup()).getByRole('button', { name: 'Materials' }));
    expect(getQuery()).toBe('type:gear,materials');
    expect(getQuery().match(/type:/g)).toHaveLength(1);
  });

  it('clicking the Type "All" pill removes the type: token entirely', () => {
    const { getQuery } = renderStateful({ query: 'type:gear floor:m9s' });
    const typeGroup = () => screen.getByRole('group', { name: 'Type filter' });
    fireEvent.click(within(typeGroup()).getByRole('button', { name: 'All' }));
    expect(getQuery()).toBe('floor:m9s');
  });

  // ── Floor row (R-36) ─────────────────────────────────────────────────────

  it("renders one pill per floor and lights it exactly on that floor's lowercased token", () => {
    renderControl({ query: 'floor:m10s' });
    const floorGroup = screen.getByRole('group', { name: 'Floor filter' });
    expect(within(floorGroup).getByRole('button', { name: 'M9S' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(within(floorGroup).getByRole('button', { name: 'M10S' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('a typed substring like floor:m1 lights no floor pill (pills are exact, not substring)', () => {
    renderControl({ query: 'floor:m1' });
    const floorGroup = screen.getByRole('group', { name: 'Floor filter' });
    for (const floor of FLOORS) {
      expect(within(floorGroup).getByRole('button', { name: floor })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
    // Still a real token of the key, so "All" must not be lit either.
    expect(within(floorGroup).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('clicking a second floor pill produces one comma token, not two floor: tokens', () => {
    const { getQuery } = renderStateful({ query: 'floor:m9s' });
    const floorGroup = () => screen.getByRole('group', { name: 'Floor filter' });
    fireEvent.click(within(floorGroup()).getByRole('button', { name: 'M10S' }));
    expect(getQuery()).toBe('floor:m9s,m10s');
    expect(getQuery().match(/floor:/g)).toHaveLength(1);
  });

  it('clicking a lit floor pill again removes just that value', () => {
    const { getQuery } = renderStateful({ query: 'floor:m9s,m10s' });
    const floorGroup = () => screen.getByRole('group', { name: 'Floor filter' });
    fireEvent.click(within(floorGroup()).getByRole('button', { name: 'M9S' }));
    expect(getQuery()).toBe('floor:m10s');
  });

  // ── Player row (R-D10-J / R-D10-L) ──────────────────────────────────────

  it('lights a player pill only on an exact, quoted match — a substring query lights nothing', () => {
    renderControl({ query: 'player:tank' });
    const playerGroup = screen.getByRole('group', { name: 'Player filter' });
    expect(within(playerGroup).getByRole('button', { name: 'Tank One' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('lights a player pill on its own quoted emission', () => {
    renderControl({ query: 'player:"Tank One"' });
    const playerGroup = screen.getByRole('group', { name: 'Player filter' });
    expect(within(playerGroup).getByRole('button', { name: 'Tank One' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(playerGroup).getByRole('button', { name: 'Healer Two' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('clicking a player pill emits an always-quoted token', () => {
    const { getQuery } = renderStateful({ query: '' });
    const playerGroup = () => screen.getByRole('group', { name: 'Player filter' });
    fireEvent.click(within(playerGroup()).getByRole('button', { name: 'Tank One' }));
    expect(getQuery()).toBe('player:"Tank One"');
  });

  it('the Player "All" pill is lit with no player token and clears the key on click', () => {
    const { getQuery } = renderStateful({ query: 'player:"Tank One" floor:m9s' });
    const playerGroup = () => screen.getByRole('group', { name: 'Player filter' });
    expect(within(playerGroup()).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    fireEvent.click(within(playerGroup()).getByRole('button', { name: 'All' }));
    expect(getQuery()).toBe('floor:m9s');
  });
});

describe('review fixes — N5 / N7', () => {
  it('N7: clicking an already-lit All pill does not rewrite the query', () => {
    // `removeQueryKey` re-joins the token list, which normalises whitespace the
    // user may be mid-way through typing after. An idle click must be inert.
    const { onQueryChange } = renderControl({ query: 'player:"Tank One"  ' });
    const floorGroup = screen.getByRole('group', { name: 'Floor filter' });
    const allFloor = within(floorGroup).getByRole('button', { name: 'All' });
    expect(allFloor).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(allFloor);
    // It still reports the click, but with the string untouched — trailing
    // spaces intact. Without the guard this comes back as `player:"Tank One"`.
    expect(onQueryChange).toHaveBeenCalledWith('player:"Tank One"  ');
  });

  it('N7: clicking a LIT All pill for a key that IS set still clears it', () => {
    // The guard must not disable the pill's real job — control for the above.
    const { onQueryChange } = renderControl({ query: 'floor:m9s player:"Tank One"' });
    const floorGroup = screen.getByRole('group', { name: 'Floor filter' });
    fireEvent.click(within(floorGroup).getByRole('button', { name: 'All' }));
    expect(onQueryChange).toHaveBeenCalledWith('player:"Tank One"');
  });

  it('N5: clearing returns focus to the search box, not <body>', () => {
    // The clear button unmounts itself the instant the query empties, so a
    // keyboard user would otherwise be dropped on <body> mid-task.
    const { rerender } = renderControl({ query: 'floor:m9s' });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    // The parent re-renders with the emptied query (the control is controlled).
    rerender(
      <HistorySearch
        query=""
        onQueryChange={() => {}}
        unknownKeys={[]}
        unknownValues={[]}
        floors={FLOORS}
        players={PLAYERS}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Search history' })).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });
});
