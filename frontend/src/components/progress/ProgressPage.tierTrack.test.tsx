/**
 * ProgressPage and `?track=tier` (S2a-3b·H4 Task TH5; D-3, D-10, D-11, E-3, E-8, E-11; R-T-6,
 * R-T-7, R-T-8, R-T-11; design §3.5): the tier row opens into the split planner, its off-states
 * and failure state, and the split-clear fetch behind them.
 *
 * The split-clear GET and settings PUT are faked at the `api` layer (as `dropServer.ts` fakes
 * drops) and the real `useSplitClearStore` runs over them; "off" is the GET's `enabled: false`.
 *
 * Contract hooks these tests read:
 *   - the tier name is a disclosure `Button` named exactly "{tier name}" (aria-expanded,
 *     aria-controls = the panel `<tr>`'s id) when openable; otherwise no button by that name;
 *   - the panel is `<tr role="row" data-testid="progress-tier-expansion" hidden?>` right after the
 *     tier row, one `role="gridcell"` spanning every column, its content in
 *     `data-testid="progress-tier-expansion-body"` with `style.width = viewWidth px`;
 *   - failed: "Couldn't load the split plan" + Button "Retry"; off for a lead: text starting
 *     "Split clears are off." + Button "Turn on split clears"; toasts "Split clears on" / the
 *     error's message; never the text "Loading the split plan…" during a visibility refetch;
 *   - an open that waited on the data scrolls into view with one `scrollIntoView` call.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
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

import { api } from '../../services/api';
import { getTierById } from '../../gamedata';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { useSplitClearStore } from '../../stores/splitClearStore';
import { useToastStore } from '../../stores/toastStore';
import type { TierSnapshot } from '../../types';
import {
  actionOf,
  DEFAULT_GOALS,
  loadedMatrix,
  menuOf,
  NEEDY,
  nameOf,
  otherGroup,
  panel,
  pick,
  renderAt,
  seedPage,
  setUpPage,
  tearDownPage,
  trackOf,
} from './__fixtures__/pageHarness';

// ── Fixtures ────────────────────────────────────────────────────────────────

const TIER_ID = 'aac-cruiserweight';
const TIER = getTierById(TIER_ID)!.name;
const player = (id: string, name: string, position: string, role: string, userId: string) => ({
  id, name, job: 'PLD', role, position, configured: true, isSubstitute: false, sortOrder: 0, userId, gear: [],
});
const activeTier = {
  id: 't1', staticGroupId: 'g1', tierId: TIER_ID, isActive: true,
  players: [player('p1', 'Aya', 'T1', 'tank', 'u1'), player('p2', 'Bo', 'H1', 'healer', 'u2')],
} as unknown as TierSnapshot;
const pastTier = { ...activeTier, isActive: false } as unknown as TierSnapshot;
const g2Tier = { ...activeTier, id: 't9', staticGroupId: 'g2' } as unknown as TierSnapshot;

const MEMBER = { userRole: 'member', canManage: false } as const;
const VIEWER = { userRole: 'viewer', canManage: false } as const;
const GUEST = { userRole: null, canManage: false, currentUserId: null } as const;

// ── The split-clear server ──────────────────────────────────────────────────

type Hook = () => Promise<void>;

/** Fakes `GET …/split-clear` and `PUT …/split-clear/settings` per static; every other GET is `[]`. */
function serveSplit(enabled: Record<string, boolean>) {
  const state = { ...enabled };
  const gets: Hook[] = [];
  const puts: Hook[] = [];
  const body = (gid: string) => ({ enabled: state[gid] ?? false, assignments: [], playerCharacters: {} });
  vi.mocked(api.get).mockImplementation(async (url: string) => {
    const m = /\/static-groups\/([^/]+)\/split-clear$/.exec(url);
    if (!m) return [] as never;
    await gets.shift()?.();
    return body(m[1]) as never;
  });
  vi.mocked(api.put).mockImplementation(async (url: string, data?: unknown) => {
    const m = /\/static-groups\/([^/]+)\/split-clear\/settings$/.exec(url);
    if (!m) return {} as never;
    await puts.shift()?.();
    state[m[1]] = (data as { enabled: boolean }).enabled;
    return body(m[1]) as never;
  });
  const hold = (queue: Hook[]) => {
    let release = () => {};
    const p = new Promise<void>((res) => (release = res));
    queue.push(() => p);
    return () => act(async () => release());
  };
  const fail = (queue: Hook[], message: string) => queue.push(() => Promise.reject(new Error(message)));
  return {
    /** Holds the next GET; the returned function releases it. */
    holdGet: () => hold(gets),
    failGet: (message = 'Server down') => fail(gets, message),
    holdPut: () => hold(puts),
    failPut: (message = 'Settings down') => fail(puts, message),
    set: (gid: string, on: boolean) => (state[gid] = on),
    gets: () => vi.mocked(api.get).mock.calls.map((c) => String(c[0])).filter((u) => /\/split-clear$/.test(u)),
  };
}

// ── Lookups and helpers ─────────────────────────────────────────────────────

const tierRow = () => screen.getByTestId('progress-tier-row');
const disclosure = () => within(tierRow()).queryByRole('button', { name: TIER });
const findDisclosure = () => within(tierRow()).findByRole('button', { name: TIER });
const tierPanel = () => screen.queryByTestId('progress-tier-expansion');
const inPanel = () => within(tierPanel()!);
const composer = () => inPanel().queryByRole('heading', { name: 'Split Clear Composer' });
const draftHeading = () => inPanel().queryByRole('heading', { name: 'Suggested Split Plan' });
const toasts = () => useToastStore.getState().toasts.map((t) => t.message);
const settle = () => act(async () => {});

/** Renders the page on the active tier with `?track=tier` (or `url`), and waits for the open panel. */
async function openTier(props: Record<string, unknown> = {}, url = '/?tab=progress&track=tier') {
  const view = renderAt(url, { tier: activeTier, ...props });
  await waitFor(() => expect(disclosure()).toHaveAttribute('aria-expanded', 'true'));
  return view;
}

/** Builds a planner draft (component state, D-10) in the open panel. */
function startDraft() {
  fireEvent.click(inPanel().getByRole('button', { name: 'Generate draft plan' }));
  expect(draftHeading()).toBeInTheDocument();
}

let visibility: DocumentVisibilityState = 'visible';
/** Hides the tab for 5 s and returns to it (`useVisibilityRefresh`'s threshold is 2 s). */
async function returnToTab() {
  const t = Date.now();
  visibility = 'hidden';
  act(() => void document.dispatchEvent(new Event('visibilitychange')));
  const now = vi.spyOn(Date, 'now').mockReturnValue(t + 5_000);
  visibility = 'visible';
  await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
  now.mockRestore();
}

const scrollIntoView = vi.fn();
let split: ReturnType<typeof serveSplit>;

beforeEach(() => {
  setUpPage();
  Element.prototype.scrollIntoView = scrollIntoView;
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  useSplitClearStore.setState({ data: null, error: null, isLoading: false, isSaving: false });
  seedPage();
  split = serveSplit({ g1: true });
});

afterEach(() => {
  tearDownPage();
  delete (document as { visibilityState?: unknown }).visibilityState;
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  useSplitClearStore.setState({ data: null, error: null, isLoading: false, isSaving: false });
});

// ── The fetch (R-T-7, E-11, D-11) ───────────────────────────────────────────

describe('ProgressPage split-clear fetch', () => {
  it('a member fetches GET …/split-clear once on mount, again on a static change and on a return to the tab', async () => {
    const { rerender } = renderAt('/?tab=progress', { tier: activeTier, ...MEMBER });
    await loadedMatrix();
    await settle();
    expect(split.gets()).toEqual(['/api/static-groups/g1/split-clear']);

    rerender({ group: otherGroup, tier: g2Tier, ...MEMBER });
    await waitFor(() => expect(split.gets()).toHaveLength(2));
    expect(split.gets()[1]).toBe('/api/static-groups/g2/split-clear');

    await returnToTab();
    await waitFor(() => expect(split.gets()).toHaveLength(3));
    expect(split.gets()[2]).toBe('/api/static-groups/g2/split-clear');
  });

  it('a guest never fetches, nor anyone on a past tier; a member on the active tier does', async () => {
    const guest = renderAt('/?tab=progress', { tier: activeTier, ...GUEST });
    await settle();
    await returnToTab();
    expect(split.gets()).toEqual([]);
    guest.rerender({ tier: pastTier });
    await settle();
    expect(split.gets()).toEqual([]);
    guest.rerender({ tier: activeTier, ...MEMBER });
    await waitFor(() => expect(split.gets()).toEqual(['/api/static-groups/g1/split-clear']));
  });
});

// ── Cold load (plan-vet M2) ─────────────────────────────────────────────────

describe('ProgressPage ?track=tier on a cold load', () => {
  it('keeps the param and fetches nothing while the tier is null, then fetches and opens once it is the active tier', async () => {
    const { rerender } = renderAt('/?tab=progress&track=tier', { tier: null });
    await settle();
    expect(trackOf()).toBe('tier');
    expect(split.gets()).toEqual([]);

    rerender({ tier: activeTier });
    await waitFor(() => expect(disclosure()).toHaveAttribute('aria-expanded', 'true'));
    expect(split.gets()).toHaveLength(1);
    expect(trackOf()).toBe('tier');
    expect(tierPanel()).not.toHaveAttribute('hidden');
  });
});

// ── On (R-T-6, R-T-8) ───────────────────────────────────────────────────────

describe('ProgressPage tier row with split clears on', () => {
  it('the tier name is a disclosure that opens the planner right after the row, written in place, and closes again', async () => {
    renderAt('/?tab=progress', { tier: activeTier });
    const button = await findDisclosure();
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(trackOf()).toBe('tier');
    expect(actionOf()).toBe('REPLACE');
    expect(disclosure()).toHaveAttribute('aria-expanded', 'true');
    expect(tierRow().nextElementSibling).toBe(tierPanel());
    expect(document.getElementById(disclosure()!.getAttribute('aria-controls') ?? '')).toBe(tierPanel());
    expect(composer()).toBeInTheDocument();
    // canEdit for a lead: the planner offers its editor controls.
    expect(inPanel().getByRole('button', { name: 'Generate draft plan' })).toBeInTheDocument();

    fireEvent.click(disclosure()!);
    expect(trackOf()).toBeNull();
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
    expect(tierPanel()).toHaveAttribute('hidden');
  });

  it.each([['member', MEMBER], ['viewer', VIEWER]])('a %s gets the planner read-only (canEdit false)', async (_who, reader) => {
    await openTier(reader);
    expect(composer()).toBeInTheDocument();
    expect(inPanel().queryByRole('button', { name: 'Generate draft plan' })).not.toBeInTheDocument();
  });

  it('opening a farm hides the tier panel, and opening the tier closes the farm', async () => {
    await openTier();
    fireEvent.click(nameOf('hot'));
    expect(trackOf()).toBe('hot');
    expect(tierPanel()).toHaveAttribute('hidden');
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
    expect(panel()).not.toBeNull();

    fireEvent.click(disclosure()!);
    expect(trackOf()).toBe('tier');
    expect(panel()).toBeNull();
    expect(tierPanel()).not.toHaveAttribute('hidden');
  });
});

// ── D-10: the planner stays mounted ─────────────────────────────────────────

describe('ProgressPage tier panel keeps the planner mounted (D-10)', () => {
  it('keeps a draft across a collapse and re-open, and across a farm opened and closed; the <tr> is hidden while closed', async () => {
    await openTier();
    startDraft();

    fireEvent.click(disclosure()!);
    expect(tierPanel()).toHaveAttribute('hidden');
    expect(screen.getByText('Suggested Split Plan')).toBeInTheDocument();
    fireEvent.click(disclosure()!);
    expect(draftHeading()).toBeInTheDocument();

    fireEvent.click(nameOf('hot'));
    expect(tierPanel()).toHaveAttribute('hidden');
    fireEvent.click(disclosure()!);
    expect(tierPanel()).not.toHaveAttribute('hidden');
    expect(draftHeading()).toBeInTheDocument();
  });

  it('a return to the tab refetches, the panel stays open with no loading flash, and the draft survives (plan-vet M4)', async () => {
    await openTier();
    startDraft();
    const release = split.holdGet();
    await returnToTab();
    await waitFor(() => expect(split.gets()).toHaveLength(2));
    expect(trackOf()).toBe('tier');
    expect(disclosure()).toHaveAttribute('aria-expanded', 'true');
    expect(tierPanel()).not.toHaveAttribute('hidden');
    expect(screen.queryByText(/Loading the split plan/)).not.toBeInTheDocument();

    await release();
    await waitFor(() => expect(draftHeading()).toBeInTheDocument());
    expect(screen.queryByText(/Loading the split plan/)).not.toBeInTheDocument();
  });
});

// ── Failure (plan-vet M3) ───────────────────────────────────────────────────

describe('ProgressPage tier panel when the split plan fails', () => {
  it('a rejected GET shows "Couldn\'t load the split plan" with Retry, which refetches and then shows the planner; a failed toggleMode never does', async () => {
    split.failGet();
    renderAt('/?tab=progress&track=tier', { tier: activeTier });
    await waitFor(() => expect(tierPanel()).not.toBeNull());
    expect(await inPanel().findByText("Couldn't load the split plan")).toBeInTheDocument();
    expect(trackOf()).toBe('tier');
    expect(composer()).not.toBeInTheDocument();

    fireEvent.click(inPanel().getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(composer()).toBeInTheDocument());
    expect(split.gets()).toHaveLength(2);
    expect(inPanel().queryByText("Couldn't load the split plan")).not.toBeInTheDocument();

    // toggleMode writes the store's `error`; the panel's failed state reads only the fetch's result.
    split.failPut();
    await act(async () => {
      await useSplitClearStore.getState().toggleMode('g1', false).catch(() => {});
    });
    expect(useSplitClearStore.getState().error).not.toBeNull();
    expect(composer()).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load the split plan")).not.toBeInTheDocument();
  });
});

// ── Off (R-T-8, R-T-11, design §3.5) ────────────────────────────────────────

describe('ProgressPage tier row with split clears off', () => {
  it('a lead gets the disclosure and the off-state; Turn on split clears PUTs, toasts and mounts the planner in place', async () => {
    split = serveSplit({ g1: false });
    await openTier();
    expect(inPanel().getByText(/^Split clears are off\./)).toBeInTheDocument();
    const turnOn = () => inPanel().getByRole('button', { name: 'Turn on split clears' });
    expect(screen.queryByRole('button', { name: 'Enable split planning' })).not.toBeInTheDocument();

    // A failed PUT toasts its message and keeps the off-state.
    split.failPut('Settings down');
    fireEvent.click(turnOn());
    await waitFor(() => expect(toasts()).toContain('Settings down'));
    expect(turnOn()).toBeEnabled();
    expect(composer()).not.toBeInTheDocument();

    // Disabled while saving; then on.
    const release = split.holdPut();
    fireEvent.click(turnOn());
    await waitFor(() => expect(turnOn()).toBeDisabled());
    await release();
    await waitFor(() => expect(composer()).toBeInTheDocument());
    expect(vi.mocked(api.put)).toHaveBeenLastCalledWith('/api/static-groups/g1/split-clear/settings', { enabled: true });
    expect(toasts()).toContain('Split clears on');
    expect(trackOf()).toBe('tier');
    expect(inPanel().queryByText(/^Split clears are off\./)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enable split planning' })).not.toBeInTheDocument();
  });

  it.each([['member', MEMBER], ['viewer', VIEWER]])('a %s gets no disclosure; ?track=tier is kept while the GET runs, then removed', async (_who, reader) => {
    split = serveSplit({ g1: false });
    const release = split.holdGet();
    renderAt('/?tab=progress&track=tier', { tier: activeTier, ...reader });
    await loadedMatrix();
    await settle();
    expect(trackOf()).toBe('tier');

    await release();
    await waitFor(() => expect(trackOf()).toBeNull());
    expect(disclosure()).not.toBeInTheDocument();
    expect(within(tierRow()).getByRole('rowheader')).toHaveTextContent(TIER);
    expect(tierPanel()).toBeNull();
  });
});

// ── ?track=tier before the data, past tiers, the goal-id drop (R-T-6, E-3, E-8) ──

describe('ProgressPage ?track=tier before the data', () => {
  it.each([['on', true], ['off, for a lead', false]])('is kept while the GET is pending, then opens (%s) and scrolls into view once', async (_case, on) => {
    split = serveSplit({ g1: on });
    const release = split.holdGet();
    renderAt('/?tab=progress&track=tier', { tier: activeTier });
    await loadedMatrix();
    await settle();
    expect(trackOf()).toBe('tier');
    expect(tierPanel()).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();

    await release();
    await waitFor(() => expect(disclosure()).toHaveAttribute('aria-expanded', 'true'));
    expect(tierPanel()).not.toHaveAttribute('hidden');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    await act(async () => useCollectionGoalStore.setState({ participants: { ...NEEDY } }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('is removed on a known past tier (E-8), with no disclosure and no fetch', async () => {
    seedPage(NEEDY, DEFAULT_GOALS, { ready: false });
    renderAt('/?tab=progress&track=tier', { tier: pastTier });
    await settle();
    expect(trackOf()).toBeNull();
    expect(disclosure()).not.toBeInTheDocument();
    expect(split.gets()).toEqual([]);
  });

  it.each([['with goals', DEFAULT_GOALS], ['with none', []]])('survives the goals fetch settling (%s)', async (_case, goals) => {
    seedPage(NEEDY, goals, { ready: false });
    renderAt('/?tab=progress&track=tier', { tier: activeTier });
    await settle();
    await act(async () => useCollectionGoalStore.setState({ loadedGroupId: 'g1' }));
    await settle();
    expect(trackOf()).toBe('tier');
    await waitFor(() => expect(disclosure()).toHaveAttribute('aria-expanded', 'true'));
  });
});

// ── A static switch (R-T-6) ─────────────────────────────────────────────────

describe('ProgressPage ?track=tier across a static switch', () => {
  it('clears the param and the panel; the old static\'s enabled never shows a disclosure for the new one', async () => {
    split = serveSplit({ g1: true, g2: false });
    const { rerender } = await openTier(MEMBER);
    const release = split.holdGet();
    rerender({ group: otherGroup, tier: g2Tier, ...MEMBER });
    await settle();
    expect(trackOf()).toBeNull();
    expect(tierPanel()).toBeNull();
    expect(disclosure()).not.toBeInTheDocument();

    await release();
    await settle();
    expect(split.gets().at(-1)).toBe('/api/static-groups/g2/split-clear');
    expect(disclosure()).not.toBeInTheDocument();
    expect(trackOf()).toBeNull();
  });
});

// ── The dirty guard, Escape, the grid (R-S3-4, R-T-6, R-T-8) ────────────────

describe('ProgressPage tier panel: the dirty guard, Escape and the grid', () => {
  it('with a farm\'s Edit dirty, opening the tier row asks "Discard changes?"; Keep editing keeps both as they were', async () => {
    renderAt('/?tab=progress&track=hot', { tier: activeTier });
    await screen.findByTestId('progress-expansion');
    fireEvent.click(menuOf('Hot Farm'));
    pick('Edit');
    const block = await screen.findByTestId('progress-edit-block');
    fireEvent.change(within(block).getByRole('textbox', { name: 'Notes' }), { target: { value: 'Edited notes' } });

    fireEvent.click(await findDisclosure());
    const dialog = screen.getByRole('dialog', { name: 'Discard changes?' });
    expect(trackOf()).toBe('hot');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(trackOf()).toBe('hot');
    expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
    expect(within(screen.getByTestId('progress-edit-block')).getByRole('textbox', { name: 'Notes' })).toHaveValue('Edited notes');
  });

  it('Escape inside the panel closes it with focus on the tier name; an Escape already handled leaves it open', async () => {
    await openTier();
    const heading = composer()!;
    heading.addEventListener('keydown', (e) => e.preventDefault(), { once: true });
    fireEvent.keyDown(heading, { key: 'Escape' });
    expect(trackOf()).toBe('tier');
    expect(tierPanel()).not.toHaveAttribute('hidden');

    fireEvent.keyDown(heading, { key: 'Escape' });
    expect(trackOf()).toBeNull();
    expect(tierPanel()).toHaveAttribute('hidden');
    expect(disclosure()).toHaveFocus();
  });

  it('is a row with one gridcell spanning every column at the visible width, outside the grid\'s rows', async () => {
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
    Object.defineProperty(Element.prototype, 'clientWidth', {
      configurable: true,
      get(this: Element) {
        return this.getAttribute('data-testid') === 'progress-matrix' ? 1290 : 0;
      },
    });
    try {
      await openTier();
      const row = tierPanel()!;
      expect(row).toHaveAttribute('role', 'row');
      const cells = within(row).getAllByRole('gridcell');
      expect(cells).toHaveLength(1);
      expect((cells[0] as HTMLTableCellElement).colSpan).toBe(screen.getAllByRole('columnheader').length);
      expect(within(row).getByTestId('progress-tier-expansion-body')).toHaveStyle({ width: '1290px' });

      const name = disclosure()!;
      act(() => name.focus());
      fireEvent.keyDown(name, { key: 'ArrowDown' });
      expect(nameOf('hot')).toHaveFocus();
    } finally {
      if (original) Object.defineProperty(Element.prototype, 'clientWidth', original);
    }
  });
});
