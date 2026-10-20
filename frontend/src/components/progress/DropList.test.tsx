/**
 * DropList, "Last drops" (S2a-3a·G3 Task TG5, G4 Task TG6; D-13, D-14, D-15, R-S3-4, R-S3-9,
 * R-S3-12, vet M-3, M-4): the three newest drops and their lines, the recipient's name, the empty
 * and loading lines, and a failed load with Retry, alone and inside the real panel (whose other
 * parts still render); Show all; and the delete buttons and V1's confirm, inside the panel over
 * the REAL store (a fake drops route; `refreshGoalProgress` a spy).
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/api')>()),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../services/api';
import { useCollectionGoalStore, type RewardDrop } from '../../stores/collectionGoalStore';
import { serveDrops } from './__fixtures__/dropServer';
import { stubCanHover } from './__fixtures__/tooltipEnv';
import { installPanelStore, posts, renderPanel, restorePanelStore, toasts } from './__fixtures__/panelHarness';
import { apiDrop, farmRowOf, goal } from './__fixtures__/progressFixtures';
import { DropList } from './DropList';
import type { DropsStatus } from './useDrops';

/** Week 1 starts 1 Sep; the clock reads week 3. */
const CLOCK = { currentWeek: 3, weekStartDate: '2026-09-01T00:00:00Z' };

function drop(id: string, droppedAt: string, overrides: Partial<RewardDrop> = {}): RewardDrop {
  return {
    id, goalId: 'wings', staticGroupId: 'g1', recipientUserId: 'u1', createdById: 'u1', quantity: 1, droppedAt, notes: null,
    createdAt: droppedAt, recipientDisplayName: 'Melee 1', recipientCharacterName: null, recipientPriorState: null, ...overrides,
  };
}

/** No recipient has a column unless the case says so (#387: the account-name fallback). */
const noColumns = (): string | null => null;

function renderList(
  drops: RewardDrop[],
  status: DropsStatus = 'loaded',
  onRetry = vi.fn(),
  canDelete: (d: RewardDrop) => boolean = () => false,
  nameOf: (userId: string) => string | null = noColumns,
) {
  stubCanHover(); // the delete confirm's Modal reads matchMedia
  const onLeave = vi.fn();
  const view = render(
    <DropList drops={drops} status={status} onRetry={onRetry} clock={CLOCK} groupId="g1" goalId="wings" canDelete={canDelete} onLeave={onLeave} nameOf={nameOf} />,
  );
  return { ...view, onRetry, onLeave, lines: () => screen.queryAllByRole('listitem').map((li) => li.textContent) };
}

describe('DropList lines', () => {
  it('shows the three newest, newest first, as "{week} · {name} · ×{n} · {note}"', () => {
    const { lines } = renderList([
      drop('d1', '2026-09-09T10:00:00Z', { notes: 'first clear' }),
      drop('d2', '2026-09-02T10:00:00Z'),
      drop('d3', '2026-09-16T10:00:00Z', { quantity: 2 }),
      drop('d4', '2026-09-15T10:00:00Z', { recipientUserId: null, recipientDisplayName: null }),
    ]);
    expect(lines()).toEqual(['Week 3 · Melee 1 · ×2', 'Week 3 · Nobody · ×1', 'Week 2 · Melee 1 · ×1 · first clear']);
  });

  it('names the recipient: the display name, else the character, else "Unknown member", with the character only when it differs', () => {
    const at = '2026-09-09T10:00:00Z';
    const cases: [Partial<RewardDrop>, string][] = [
      [{ recipientDisplayName: 'Melee 1', recipientCharacterName: 'Aria Moon' }, 'Melee 1 (Aria Moon)'],
      [{ recipientDisplayName: 'Aria Moon', recipientCharacterName: 'Aria Moon' }, 'Aria Moon'],
      [{ recipientDisplayName: null, recipientCharacterName: 'Aria Moon' }, 'Aria Moon'],
      [{ recipientDisplayName: null, recipientCharacterName: null }, 'Unknown member'],
      [{ recipientUserId: null, recipientDisplayName: 'Ghost', recipientCharacterName: 'Aria Moon' }, 'Nobody'],
    ];
    for (const [overrides, name] of cases) {
      const { lines, unmount } = renderList([drop('d1', at, overrides)]);
      expect(lines()).toEqual([`Week 2 · ${name} · ×1`]);
      unmount();
    }
    // A V1-shaped drop with no character field at all reads the display name alone.
    const v1Shaped = drop('d1', at, { recipientCharacterName: 'unused' });
    delete v1Shaped.recipientCharacterName;
    expect('recipientCharacterName' in v1Shaped).toBe(false);
    expect(renderList([v1Shaped]).lines()).toEqual(['Week 2 · Melee 1 · ×1']);
  });

  it('reads "No drops logged yet." with none, and a loading line while the first load runs', () => {
    const empty = renderList([]);
    expect(screen.getByText('No drops logged yet.')).toBeInTheDocument();
    empty.unmount();
    renderList([], 'loading');
    expect(screen.getByRole('status')).toHaveTextContent('Loading drops…');
  });

  it('reads "Couldn\'t load drops" with a Retry Button on a failed load', () => {
    const { onRetry } = renderList([], 'failed');
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load drops");
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('DropList in the panel', () => {
  const DROPS = '/api/static-groups/g1/collection-goals/wings/drops';

  it('keeps the rest of the panel on a failed load, and Retry loads the drops again', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce([apiDrop('d1', 'u9', { recipient_display_name: 'Melee 1', dropped_at: '2026-09-09T10:00:00Z' })]);
    renderPanel({
      row: farmRowOf([{ id: 'u1', cell: { state: 'need', tokenCount: 4 } }], goal('wings', { title: 'Wings', summary: 'Tuesdays' }), 'member'),
      spanAll: 3,
      clock: CLOCK,
    });
    const drops = screen.getByTestId('progress-expansion-drops');
    expect(await within(drops).findByText("Couldn't load drops")).toBeInTheDocument();
    expect(within(screen.getByTestId('progress-expansion-queue')).getByText('u1 · Need 4/99')).toBeInTheDocument();
    expect(within(screen.getByTestId('progress-expansion-about')).getByText('Tuesdays')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy plan' })).toBeInTheDocument();

    fireEvent.click(within(drops).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(within(drops).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Week 2 · Melee 1 · ×1']));
    expect(vi.mocked(api.get).mock.calls).toEqual([[DROPS], [DROPS]]);
  });
});

describe('DropList: Show all (D-13)', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => drop(`d${i}`, `2026-09-${String(i + 1).padStart(2, '0')}T12:00:00Z`));

  it('lists three, then expands in place to every fetched drop (50) and folds back', () => {
    const { lines } = renderList(many(50));
    expect(lines()).toHaveLength(3);
    const show = screen.getByRole('button', { name: 'Show all (50)' });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(show);
    expect(lines()).toHaveLength(50);
    const fewer = screen.getByRole('button', { name: 'Show fewer' });
    expect(fewer).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(fewer);
    expect(lines()).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Show all (50)' })).toBeInTheDocument();
  });

  it('shows no button for three drops or fewer', () => {
    renderList(many(3));
    expect(screen.queryByRole('button', { name: /^Show / })).not.toBeInTheDocument();
  });
});

/** A September day as the delete button names it: en-GB short ('9 Sept 2026' or '9 Sep 2026', whatever this ICU spells). */
const sept = (day: number) =>
  new Date(`2026-09-${String(day).padStart(2, '0')}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

describe('DropList: delete (D-14)', () => {
  const DROPS_URL = '/api/static-groups/g1/collection-goals/wings/drops';
  const MINE = apiDrop('d1', 'Melee 1', { created_by_id: 'me', dropped_at: '2026-09-09T12:00:00Z' });
  const THEIRS = apiDrop('d2', 'Healer 1', { created_by_id: 'u9', dropped_at: '2026-09-02T12:00:00Z' });
  const MINE_NAME = `Delete drop for Melee 1, ${sept(9)}`;
  const THEIRS_NAME = `Delete drop for Healer 1, ${sept(2)}`;
  const refresh = vi.fn();
  let server: ReturnType<typeof serveDrops>;

  beforeEach(() => {
    vi.clearAllMocks();
    server = serveDrops(api, [MINE, THEIRS]);
    installPanelStore(refresh);
  });
  afterEach(restorePanelStore);

  const panel = async (options: Parameters<typeof renderPanel>[0] = {}) => {
    const view = renderPanel(options);
    await screen.findAllByRole('listitem');
    return view;
  };
  const lead = { userRole: 'lead', canManage: true } as const;
  const trash = () => screen.queryAllByRole('button', { name: /^Delete drop for / }).map((b) => b.getAttribute('aria-label'));
  const open = async (name: string) => {
    fireEvent.click(await screen.findByRole('button', { name }));
    return screen.findByRole('dialog', { name: 'Delete Drop' });
  };

  it.each([
    ['a lead', { userRole: 'lead', canManage: true }, [MINE_NAME, THEIRS_NAME]],
    ['an owner', { userRole: 'owner', canManage: true }, [MINE_NAME, THEIRS_NAME]],
    ['a member', { userRole: 'member' }, [MINE_NAME]],
    ['a viewer', { userRole: 'viewer' }, []],
    ['a viewer who manages', { userRole: 'viewer', canManage: true }, []],
  ] as const)('gives %s the buttons they may use: every drop for a lead, their own for a member, none for a viewer', async (_who, options, names) => {
    await panel({ ...options });
    expect(trash()).toEqual(names);
  });

  it("opens V1's confirm: \"Delete Drop\", the danger variant, \"Delete\", and the prior state when the server reports one", async () => {
    server = serveDrops(api, [
      apiDrop('d1', 'Melee 1', { dropped_at: '2026-09-09T12:00:00Z', recipient_prior_state: 'need' }),
      apiDrop('d2', 'Healer 1', { dropped_at: '2026-09-08T12:00:00Z', recipient_prior_state: 'want' }),
      apiDrop('d3', 'Tank 1', { dropped_at: '2026-09-07T12:00:00Z', recipient_display_name: null, recipient_prior_state: 'need' }),
      apiDrop('d4', 'Caster', { dropped_at: '2026-09-06T12:00:00Z', recipient_prior_state: null }),
    ]);
    await panel(lead);
    fireEvent.click(await screen.findByRole('button', { name: 'Show all (4)' }));
    const cases = [
      [`Delete drop for Melee 1, ${sept(9)}`, 'Delete this drop? Melee 1 goes back to Need if it was their only drop.'],
      [`Delete drop for Healer 1, ${sept(8)}`, 'Delete this drop? Healer 1 goes back to Want if it was their only drop.'],
      [`Delete drop for Unknown member, ${sept(7)}`, 'Delete this drop? The recipient goes back to Need if it was their only drop.'],
      [`Delete drop for Caster, ${sept(6)}`, 'Delete this drop?'],
    ];
    for (const [button, message] of cases) {
      const dialog = await open(button);
      expect(within(dialog).getByRole('heading', { name: 'Delete Drop' })).toBeInTheDocument();
      expect(within(dialog).getByText(message)).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Delete' }).className).toContain('bg-status-error/20');
      expect(within(dialog).getByRole('button', { name: 'Cancel' }).className).not.toContain('bg-status-error/20');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
    expect(vi.mocked(api.delete)).not.toHaveBeenCalled();
  });

  it('deletes through the store, then refreshes the farm, toasts, and moves focus to the next delete button', async () => {
    await panel(lead);
    const dialog = await open(MINE_NAME);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(refresh).toHaveBeenCalledWith('g1', 'wings'));
    expect(vi.mocked(api.delete)).toHaveBeenCalledWith(`${DROPS_URL}/d1`);
    expect(vi.mocked(api.delete).mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0]);
    expect(toasts()).toEqual([['success', 'Drop deleted.', null]]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(server.list().map((d) => d.id)).toEqual(['d2']);
    expect(trash()).toEqual([THEIRS_NAME]);
    await waitFor(() => expect(screen.getByRole('button', { name: THEIRS_NAME })).toHaveFocus());
  });

  it('moves focus to Copy plan when the last delete button goes', async () => {
    server = serveDrops(api, [MINE]);
    await panel({ userRole: 'member' });
    const dialog = await open(MINE_NAME);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await screen.findByText('No drops logged yet.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy plan' })).toHaveFocus());
  });

  it('keeps the confirm open with an error toast when the delete fails, does not refresh, and can try again', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce(new Error('boom'));
    await panel(lead);
    const dialog = await open(MINE_NAME);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(toasts()).toEqual([['error', "Couldn't delete the drop: boom", null]]));
    expect(screen.getByRole('dialog', { name: 'Delete Drop' })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(trash()).toHaveLength(2);

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('deletes nothing when the confirm is cancelled', async () => {
    await panel(lead);
    const dialog = await open(MINE_NAME);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(vi.mocked(api.delete)).not.toHaveBeenCalled();
    expect(posts()).toHaveLength(0);
    expect(useCollectionGoalStore.getState().drops.wings).toHaveLength(2);
  });

  it('closes only the confirm on Escape: the panel is not asked to close (R-S3-4)', async () => {
    const { onClose } = await panel(lead);
    const dialog = await open(MINE_NAME);
    act(() => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('progress-expansion')).toBeInTheDocument();
  });
});

/**
 * #387 (owner 2026-10-20, amends R-S3-12): a recipient with a column in this matrix is named by
 * the column's card name (`nameOf(userId)`), with "({character})" only when the character's name
 * differs from the card name; a recipient without a column keeps the account rule; no recipient
 * is "Nobody". The row, the delete button's name and the confirm all use the same name.
 */
describe('DropList: the recipient by card name (#387)', () => {
  const at = '2026-09-09T10:00:00Z';
  const cards = (map: Record<string, string>) => (userId: string) => map[userId] ?? null;

  it('names a recipient with a column by the card name, not the account name; no recipient stays "Nobody"', () => {
    const { lines } = renderList(
      [
        drop('d1', '2026-09-16T10:00:00Z', { recipientUserId: 'u7', recipientDisplayName: 'Melee 1' }),
        drop('d2', at, { recipientUserId: null, recipientDisplayName: 'Ghost' }),
      ],
      'loaded', vi.fn(), () => false, () => 'Moonbeam', // every user id has a column: null still is nobody
    );
    expect(lines()).toEqual(['Week 3 · Moonbeam · ×1', 'Week 2 · Nobody · ×1']);
  });

  it('asks nameOf by the recipient\'s user id', () => {
    const nameOf = vi.fn(cards({ u7: 'Moonbeam' }));
    renderList([drop('d1', at, { recipientUserId: 'u7', recipientDisplayName: 'u1' })], 'loaded', vi.fn(), () => false, nameOf);
    expect(nameOf).toHaveBeenCalledWith('u7');
    expect(nameOf).not.toHaveBeenCalledWith('u1');
  });

  it('adds "(character)" to the card name only when the character differs from the card name', () => {
    const cases: [Partial<RewardDrop>, string][] = [
      [{ recipientDisplayName: 'Melee 1', recipientCharacterName: 'Aria Moon' }, 'Moonbeam (Aria Moon)'],
      [{ recipientDisplayName: 'Melee 1', recipientCharacterName: 'Moonbeam' }, 'Moonbeam'],
      [{ recipientDisplayName: 'Melee 1', recipientCharacterName: null }, 'Moonbeam'],
      [{ recipientDisplayName: null, recipientCharacterName: null }, 'Moonbeam'],
    ];
    for (const [overrides, name] of cases) {
      const { lines, unmount } = renderList([drop('d1', at, { recipientUserId: 'u7', ...overrides })], 'loaded', vi.fn(), () => false, cards({ u7: 'Moonbeam' }));
      expect(lines()).toEqual([`Week 2 · ${name} · ×1`]);
      unmount();
    }
  });

  it('keeps the account rule for a recipient without a column, beside one with a column', () => {
    const { lines } = renderList(
      [
        drop('d1', '2026-09-16T10:00:00Z', { recipientUserId: 'u7', recipientDisplayName: 'Melee 1' }),
        drop('d2', '2026-09-09T10:00:00Z', { recipientUserId: 'u9', recipientDisplayName: 'Healer 1', recipientCharacterName: 'Aria Moon' }),
        drop('d3', '2026-09-02T10:00:00Z', { recipientUserId: 'u8', recipientDisplayName: null, recipientCharacterName: null }),
      ],
      'loaded', vi.fn(), () => false, cards({ u7: 'Moonbeam' }),
    );
    expect(lines()).toEqual(['Week 3 · Moonbeam · ×1', 'Week 2 · Healer 1 (Aria Moon) · ×1', 'Week 1 · Unknown member · ×1']);
  });

  it('shows a card name with quotes, backslashes, "$", "%", an ellipsis and unicode literally', () => {
    const odd = `Mo'ra "Tank" \\u00e9 $1 %s… 月の騎士 ✦`;
    const { lines } = renderList([drop('d1', at, { recipientUserId: 'u7', recipientCharacterName: 'Aria Moon' })], 'loaded', vi.fn(), () => false, cards({ u7: odd }));
    expect(lines()).toEqual([`Week 2 · ${odd} (Aria Moon) · ×1`]);
  });

  it('names the delete button and the confirm by the same card name as the row', async () => {
    renderList(
      [drop('d1', '2026-09-09T12:00:00Z', { recipientUserId: 'u7', recipientDisplayName: 'Melee 1', recipientPriorState: 'need' })],
      'loaded', vi.fn(), () => true, cards({ u7: 'Moonbeam' }),
    );
    fireEvent.click(screen.getByRole('button', { name: `Delete drop for Moonbeam, ${sept(9)}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Drop' });
    expect(within(dialog).getByText('Delete this drop? Moonbeam goes back to Need if it was their only drop.')).toBeInTheDocument();
  });
});

describe('DropList in the panel: the card name from the row\'s columns (#387)', () => {
  const refresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    installPanelStore(refresh);
  });
  afterEach(restorePanelStore);

  /** A row whose claimed column for `u7` reads "Moonbeam" on its card, plus an unclaimed column (no user). */
  function rowWithCards() {
    const base = farmRowOf(
      [{ id: 'u7', cell: { state: 'need', tokenCount: 4 } }, { id: 'open', kind: 'unclaimed' }],
      goal('wings', { title: 'Wings' }),
      'lead',
    );
    return {
      ...base,
      cells: base.cells.map((cell) => (cell.column.userId === 'u7' ? { ...cell, column: { ...cell.column, name: 'Moonbeam' } } : cell)),
    };
  }

  it('names the row, the delete button and the confirm by the column\'s card name; others keep the account rule', async () => {
    serveDrops(api, [
      apiDrop('d1', 'u7', { recipient_display_name: 'Melee 1', dropped_at: '2026-09-09T12:00:00Z', recipient_prior_state: 'need' }),
      apiDrop('d2', 'u9', { recipient_display_name: 'Healer 1', dropped_at: '2026-09-08T12:00:00Z' }),
      apiDrop('d3', null, { recipient_display_name: null, dropped_at: '2026-09-07T12:00:00Z' }),
    ]);
    renderPanel({ row: rowWithCards(), userRole: 'lead', canManage: true, clock: CLOCK });
    const drops = screen.getByTestId('progress-expansion-drops');
    await waitFor(() =>
      expect(within(drops).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        // A row's text ends with its delete button's name.
        `Week 2 · Moonbeam · ×1Delete drop for Moonbeam, ${sept(9)}`,
        `Week 2 · Healer 1 · ×1Delete drop for Healer 1, ${sept(8)}`,
        `Week 1 · Nobody · ×1Delete drop for Nobody, ${sept(7)}`,
      ]),
    );
    fireEvent.click(within(drops).getByRole('button', { name: `Delete drop for Moonbeam, ${sept(9)}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Drop' });
    expect(within(dialog).getByText('Delete this drop? Moonbeam goes back to Need if it was their only drop.')).toBeInTheDocument();
  });
});
