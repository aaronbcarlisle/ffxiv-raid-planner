/**
 * The tier cell's slot breakdown and the jump (S2a-3b·H3b Task TH4; design §3.4; D-5, D-8,
 * D-11, E-9; R-T-9). Driven through `ProgressPage`, whose `onNavigate` is the public seam, so
 * these tests pin what a reader sees and where the jump goes, not how the popover is wired.
 *
 * Contract hooks these tests read:
 *   - the popover is a `role="dialog"` named "{player} · BiS slots" (the `Popover` primitive's
 *     `PopoverContent aria-label`), holding "{done}/{total} done", then the groups "Done",
 *     "Needs augment", "To go" (each listing `GEAR_SLOT_NAMES` in gear order, omitted when
 *     empty) or "No BiS set.", then a button "Open on board";
 *   - the jump is `onNavigate('roster', { rview: 'board', player: <player id> })`;
 *   - the Alt cursor reads `useAltHeld` from `hooks/useAltHeld` (mocked here): the cell's
 *     button carries a bare `cursor-pointer` class only while it returns true.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({}),
      put: vi.fn().mockResolvedValue({}),
      patch: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
});

const altHeld = vi.hoisted(() => ({ value: false }));
vi.mock('../../hooks/useAltHeld', () => ({ useAltHeld: () => altHeld.value }));

import { getTierById } from '../../gamedata';
import { useCollectionGoalStore, type CollectionGoal, type ParticipantStateEntry } from '../../stores/collectionGoalStore';
import { useLootTrackingStore, weekClockKeyOf } from '../../stores/lootTrackingStore';
import { GEAR_SLOT_NAMES, type GearSlot, type GearSlotStatus, type StaticGroup, type TierSnapshot } from '../../types';
import { gearOf, goal, row, SLOTS } from './__fixtures__/progressFixtures';
import { stubCanHover, TooltipWrapper } from './__fixtures__/tooltipEnv';
import { ProgressPage } from './ProgressPage';

// ── Fixtures ────────────────────────────────────────────────────────────────

const group = { id: 'g1', name: 'Dev Test Static', shareCode: 'DEVTST', settings: {}, userRole: 'owner', members: [] } as unknown as StaticGroup;

const DONE: GearSlot[] = ['weapon', 'head', 'hands', 'feet', 'earring', 'necklace'];
const AUGMENT: GearSlot[] = ['body', 'legs'];
const TO_GO: GearSlot[] = ['bracelet', 'ring1', 'ring2'];

/** 6 done, Body and Legs had as tome but not augmented, the rings and bracelet to go: 6/11. */
function healerGear(): GearSlotStatus[] {
  return SLOTS.map((slot) => {
    if (DONE.includes(slot)) return { slot, bisSource: 'raid', hasItem: true, isAugmented: false } as GearSlotStatus;
    if (AUGMENT.includes(slot)) return { slot, bisSource: 'tome', hasItem: true, isAugmented: false } as GearSlotStatus;
    return { slot, bisSource: 'raid', hasItem: false, isAugmented: false } as GearSlotStatus;
  });
}

const noTargets = () => SLOTS.map((slot) => ({ slot, bisSource: null, hasItem: true, isAugmented: false }) as GearSlotStatus);

const player = (id: string, name: string, job: string, role: string, position: string | null, userId: string | null, gear: GearSlotStatus[]) => ({
  id, name, job, role, position, configured: true, isSubstitute: false, sortOrder: 0, userId, gear,
});

const ODD = 'Ëlise "Q" O\'Brien $1 \\u0041 …';
const PLAYERS = [
  player('p1', 'Aya', 'WAR', 'tank', 'T1', 'u1', gearOf(5)),
  player('p2', 'Healer 1', 'WHM', 'healer', 'H1', 'u2', healerGear()),
  player('p3', 'Cy', 'BLM', 'caster', 'R1', null, gearOf(3)),
  player('p4', 'Eli', 'NIN', 'melee', 'M1', 'u4', noTargets()),
  player('p5', ODD, 'DRG', 'melee', 'M2', 'u5', gearOf(2)),
];

const CRUISER = 'aac-cruiserweight';
const tierA = { id: 't1', staticGroupId: 'g1', tierId: CRUISER, isActive: true, players: PLAYERS } as unknown as TierSnapshot;
const TIER = getTierById(CRUISER)!.name;

const fetchGoals = vi.fn();
const fetchProgress = vi.fn();
const fetchPageLedger = vi.fn();
const realFetchPageLedger = useLootTrackingStore.getState().fetchPageLedger;

function seedGoals(goals: CollectionGoal[] = [], participants: Record<string, ParticipantStateEntry[]> = {}) {
  useCollectionGoalStore.setState({
    goals, participants, recordOnly: {}, loadedGroupId: 'g1', progressError: null, progressLoading: false, error: null,
    fetchGoals, fetchProgress,
  });
}

type Props = Parameters<typeof ProgressPage>[0];
type Reader = Pick<Props, 'canManage' | 'userRole' | 'currentUserId'>;
const READERS: Record<'owner' | 'lead' | 'member' | 'viewer' | 'guest', Reader> = {
  owner: { canManage: true, userRole: 'owner', currentUserId: 'u1' },
  lead: { canManage: true, userRole: 'lead', currentUserId: 'u1' },
  member: { canManage: false, userRole: 'member', currentUserId: 'u1' },
  viewer: { canManage: false, userRole: 'viewer', currentUserId: 'u1' },
  guest: { canManage: false, userRole: null, currentUserId: null },
};

function renderPage(props: Partial<Props> = {}) {
  const onNavigate = vi.fn();
  const base: Props = { group, tier: tierA, ...READERS.owner, isViewingAs: false, onNavigate };
  const tree = (p: Partial<Props>) => (
    <MemoryRouter>
      <ProgressPage {...base} {...p} />
    </MemoryRouter>
  );
  const view = render(tree(props), { wrapper: TooltipWrapper });
  return { onNavigate, rerender: (next: Partial<Props>) => view.rerender(tree({ ...props, ...next })), unmount: view.unmount };
}

const tierRow = () => screen.getByTestId('progress-tier-row');
const tierCell = (name: string) => within(tierRow()).getByRole('button', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `) });
const breakdown = (name: string) => screen.getByRole('dialog', { name: `${name} · BiS slots` });
const gridStops = () => Array.from(screen.getByRole('grid').querySelectorAll<HTMLElement>('[tabindex="0"]'));
const focus = (el: HTMLElement) => act(() => el.focus());
const jumpTo = (id: string) => ['roster', { rview: 'board', player: id }];

/** The slot names (from `GEAR_SLOT_NAMES`) found in `text`, in the order they appear. */
function slotNamesIn(text: string): string[] {
  const names = Object.values(GEAR_SLOT_NAMES);
  return names
    .map((n) => ({ n, at: text.indexOf(n) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.n);
}
const label = (slots: GearSlot[]) => slots.map((s) => GEAR_SLOT_NAMES[s]);

beforeEach(() => {
  vi.clearAllMocks();
  stubCanHover();
  altHeld.value = false;
  fetchGoals.mockResolvedValue(undefined);
  fetchProgress.mockResolvedValue({ error: null });
  fetchPageLedger.mockImplementation(() => new Promise(() => {}));
  useLootTrackingStore.setState({ fetchPageLedger, pageLedger: [], currentWeek: 11, weekClockKey: weekClockKeyOf('g1', CRUISER) });
  seedGoals();
});

afterEach(() => {
  useLootTrackingStore.setState({ fetchPageLedger: realFetchPageLedger, pageLedger: [] });
  vi.unstubAllGlobals();
});

// ── The breakdown (§3.4, D-5) ──────────────────────────────────────────────

describe('the tier cell\'s breakdown', () => {
  it('opens on click: "Healer 1 · BiS slots", "6/11 done", Done, Needs augment, To go in gear order, then Open on board', () => {
    const { onNavigate } = renderPage();
    fireEvent.click(tierCell('Healer 1'));
    const dialog = breakdown('Healer 1');
    const text = dialog.textContent ?? '';
    expect(text).toContain('6/11 done');
    const at = (s: string) => text.indexOf(s);
    // The order of the parts: the count, the three groups, then the link.
    expect(at('6/11 done')).toBeLessThan(at('Done'));
    expect(at('Done')).toBeLessThan(at('Needs augment'));
    expect(at('Needs augment')).toBeLessThan(at('To go'));
    expect(at('To go')).toBeLessThan(at('Open on board'));
    // Each group lists its slots, in gear order, and only its own.
    expect(slotNamesIn(text.slice(at('Done'), at('Needs augment')))).toEqual(label(DONE));
    expect(slotNamesIn(text.slice(at('Needs augment'), at('To go')))).toEqual(label(AUGMENT));
    expect(slotNamesIn(text.slice(at('To go'), at('Open on board')))).toEqual(label(TO_GO));
    expect(within(dialog).getByRole('button', { name: 'Open on board' })).toBeInTheDocument();
    // Opening is not a jump.
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('lets Enter through to the native button (the grid does not swallow it), and the click it makes opens the breakdown', () => {
    renderPage();
    const cell = tierCell('Healer 1');
    focus(cell);
    expect(fireEvent.keyDown(cell, { key: 'Enter' })).toBe(true);
    // jsdom does not synthesize the click a real Enter fires on a button; the click opens it.
    fireEvent.click(cell);
    expect(breakdown('Healer 1')).toBeInTheDocument();
  });

  it('omits an empty group: a card with nothing to augment has no "Needs augment"', () => {
    renderPage();
    fireEvent.click(tierCell('Aya'));
    const dialog = breakdown('Aya');
    expect(dialog).toHaveTextContent('5/11 done');
    expect(dialog).toHaveTextContent('Done');
    expect(dialog).toHaveTextContent('To go');
    expect(dialog).not.toHaveTextContent('Needs augment');
  });

  it('reads "No BiS set." for a card with no targets, with no slot groups, and still offers Open on board', () => {
    renderPage();
    fireEvent.click(tierCell('Eli'));
    const dialog = breakdown('Eli');
    expect(dialog).toHaveTextContent('No BiS set.');
    expect(dialog).not.toHaveTextContent(/Needs augment|To go/);
    expect(dialog).not.toHaveTextContent(/\d+\/\d+ done/);
    expect(within(dialog).getByRole('button', { name: 'Open on board' })).toBeInTheDocument();
  });

  it('names the popover with the player\'s name verbatim, quotes, backslashes, $ and ellipsis included', () => {
    renderPage();
    fireEvent.click(tierCell(ODD));
    expect(breakdown(ODD)).toHaveTextContent('2/11 done');
  });

  it('follows the card: a gear change while it is open updates the breakdown', () => {
    const { rerender } = renderPage();
    fireEvent.click(tierCell('Healer 1'));
    expect(breakdown('Healer 1')).toHaveTextContent('6/11 done');
    const healer = { ...PLAYERS[1], gear: healerGear().map((g) => (g.slot === 'bracelet' ? { ...g, hasItem: true } : g)) };
    const players = PLAYERS.map((p) => (p.id === 'p2' ? healer : p));
    rerender({ tier: { ...tierA, players } as unknown as TierSnapshot });
    expect(breakdown('Healer 1')).toHaveTextContent('7/11 done');
  });

  it('closes on Escape, returns focus to the cell, and keeps the grid\'s one stop on that cell', async () => {
    renderPage();
    const cell = tierCell('Healer 1');
    focus(cell);
    fireEvent.click(cell);
    const dialog = breakdown('Healer 1');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(tierCell('Healer 1')).toHaveFocus();
    expect(gridStops()).toEqual([tierCell('Healer 1')]);
  });

  it('keeps keys pressed inside it out of the grid: ArrowRight on Open on board moves nothing', () => {
    renderPage();
    fireEvent.click(tierCell('Healer 1'));
    const link = within(breakdown('Healer 1')).getByRole('button', { name: 'Open on board' });
    focus(link);
    expect(fireEvent.keyDown(link, { key: 'ArrowRight' })).toBe(true);
    expect(link).toHaveFocus();
    expect(breakdown('Healer 1')).toBeInTheDocument();
  });
});

// ── Open on board and Alt+Click (D-8, E-9, R-T-9) ───────────────────────────

describe('the jump to the Board', () => {
  it('Open on board jumps to that card on Roster ▸ Board and closes the popover', async () => {
    const { onNavigate } = renderPage();
    fireEvent.click(tierCell('Healer 1'));
    fireEvent.click(within(breakdown('Healer 1')).getByRole('button', { name: 'Open on board' }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(...jumpTo('p2'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('makes Open on board a Tab stop inside the popover (not a roving -1, not disabled)', () => {
    renderPage();
    fireEvent.click(tierCell('Healer 1'));
    const link = within(breakdown('Healer 1')).getByRole('button', { name: 'Open on board' });
    expect(link.tabIndex).toBe(0);
    expect(link).not.toBeDisabled();
    focus(link);
    expect(link).toHaveFocus();
  });

  it('Alt+Click jumps and opens no popover', () => {
    const { onNavigate } = renderPage();
    fireEvent.click(tierCell('Healer 1'), { altKey: true });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(...jumpTo('p2'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Alt+Click on a no-targets card jumps too (the jump does not need BiS)', () => {
    const { onNavigate } = renderPage();
    fireEvent.click(tierCell('Eli'), { altKey: true });
    expect(onNavigate).toHaveBeenCalledWith(...jumpTo('p4'));
  });

  it('a plain click never jumps, opening or closing', () => {
    const { onNavigate } = renderPage();
    const cell = tierCell('Healer 1');
    fireEvent.click(cell);
    expect(breakdown('Healer 1')).toBeInTheDocument();
    fireEvent.click(cell);
    fireEvent.click(tierCell('Aya'));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('a Not-on-the-roster cell does nothing on Alt+Click or click', async () => {
    seedGoals([goal('wings')], { wings: [row('wings', 'u1'), row('wings', 'u9', { displayName: 'Nia', memberRole: 'member' })] });
    const { onNavigate } = renderPage();
    await screen.findAllByTestId('progress-farm-row');
    const empty = within(tierRow()).getByRole('gridcell', { name: `Nia, ${TIER}, no card` });
    fireEvent.click(empty, { altKey: true });
    fireEvent.click(empty);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The row's cells still work: the guard is the empty cell, not a broken row.
    fireEvent.click(tierCell('Healer 1'), { altKey: true });
    expect(onNavigate).toHaveBeenCalledWith(...jumpTo('p2'));
  });

  it('has no context menu: a contextmenu event opens nothing, jumps nowhere and keeps the browser\'s menu (D-8)', () => {
    const { onNavigate } = renderPage();
    const cell = tierCell('Healer 1');
    expect(fireEvent.contextMenu(cell)).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
    // The cell still opens its breakdown on a click, so this is not a dead cell.
    fireEvent.click(cell);
    expect(breakdown('Healer 1')).toBeInTheDocument();
  });

  it('shows the pointer cursor on the cell only while Alt is held', () => {
    const bare = /(?<![\w:-])cursor-pointer(?![\w-])/;
    altHeld.value = false;
    const first = renderPage();
    expect(tierCell('Healer 1').className).not.toMatch(bare);
    first.unmount();
    altHeld.value = true;
    renderPage();
    expect(tierCell('Healer 1').className).toMatch(bare);
  });
});

// ── The count is a heading (design §3.4; H3b review m5) ─────────────────────

describe('the breakdown\'s count', () => {
  it('is a heading, "6/11 done", not a paragraph', () => {
    renderPage();
    fireEvent.click(tierCell('Healer 1'));
    expect(within(breakdown('Healer 1')).getByRole('heading', { name: '6/11 done' })).toBeInTheDocument();
  });
});

// ── Every reader (D-11) ─────────────────────────────────────────────────────

describe.each(Object.entries(READERS))('as %s', (_who, reader) => {
  it('gets the breakdown, Open on board and the Alt+Click jump', () => {
    const { onNavigate } = renderPage(reader);
    fireEvent.click(tierCell('Healer 1'));
    fireEvent.click(within(breakdown('Healer 1')).getByRole('button', { name: 'Open on board' }));
    expect(onNavigate).toHaveBeenLastCalledWith(...jumpTo('p2'));
    fireEvent.click(tierCell('Aya'), { altKey: true });
    expect(onNavigate).toHaveBeenLastCalledWith(...jumpTo('p1'));
    expect(onNavigate).toHaveBeenCalledTimes(2);
  });
});
