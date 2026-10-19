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

function renderList(drops: RewardDrop[], status: DropsStatus = 'loaded', onRetry = vi.fn(), canDelete: (d: RewardDrop) => boolean = () => false) {
  stubCanHover(); // the delete confirm's Modal reads matchMedia
  const onLeave = vi.fn();
  const view = render(
    <DropList drops={drops} status={status} onRetry={onRetry} clock={CLOCK} groupId="g1" goalId="wings" canDelete={canDelete} onLeave={onLeave} />,
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
    vi.mocked(api.get).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce([apiDrop('d1', 'u1', { recipient_display_name: 'Melee 1', dropped_at: '2026-09-09T10:00:00Z' })]);
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

describe('DropList: delete (D-14)', () => {
  const DROPS_URL = '/api/static-groups/g1/collection-goals/wings/drops';
  const MINE = apiDrop('d1', 'Melee 1', { created_by_id: 'me', dropped_at: '2026-09-09T12:00:00Z' });
  const THEIRS = apiDrop('d2', 'Healer 1', { created_by_id: 'u9', dropped_at: '2026-09-02T12:00:00Z' });
  const MINE_NAME = 'Delete drop for Melee 1, Sep 9, 2026';
  const THEIRS_NAME = 'Delete drop for Healer 1, Sep 2, 2026';
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
      ['Delete drop for Melee 1, Sep 9, 2026', 'Delete this drop? Melee 1 goes back to Need if it was their only drop.'],
      ['Delete drop for Healer 1, Sep 8, 2026', 'Delete this drop? Healer 1 goes back to Want if it was their only drop.'],
      ['Delete drop for Unknown member, Sep 7, 2026', 'Delete this drop? The recipient goes back to Need if it was their only drop.'],
      ['Delete drop for Caster, Sep 6, 2026', 'Delete this drop?'],
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
