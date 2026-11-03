/**
 * S2a-4a·A3 TA3 — Find's lead actions on their own (R-F-6; design D-7, D-8, §3.2, §3.3, §3.8).
 *
 * `LeadFindAction({ item, groupId, onTracked })`:
 * - a trackable, untracked item shows **Track**, which runs `createGoalFromSuggestion(groupId,
 *   { catalogItemId, status: 'farming' })` (one POST to `…/collection-goals/from-suggestion`, even on
 *   a double click), then `refreshGoalProgress(groupId, id, { lists: true })`, then `onTracked(id)`,
 *   then the toast "Tracking {name}";
 * - while writing it is `aria-disabled` with `BUSY_CLASS`; a failure toasts unless the api already did;
 * - a fallback item (`trackable: false`) shows "Offline list: retry to track" and no Track.
 *
 * `CustomTrackRow({ query, groupId, onCreated })`:
 * - a non-blank query shows `Track "{trimmed}" as a custom farm`, which sends one POST to
 *   `…/collection-goals` with `goal_type: 'custom_reward'`, the trimmed title (at most 200
 *   characters) and `status: 'farming'`, then `onCreated(id)` and "Tracking {title}";
 * - a blank query shows the muted line "Type a name to track a custom farm" and no control.
 *
 * The api is mocked, so the real store actions run and the requests are counted exactly.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
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

import { ApiError, api } from '../../services/api';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { useToastStore } from '../../stores/toastStore';
import type { FindItem } from '../../utils/findModel';
import { CustomTrackRow, LeadFindAction } from './findActions';
import { BUSY_CLASS } from './useDrops';
import { apiGoal } from './__fixtures__/progressFixtures';
import { stubCanHover, TooltipWrapper } from './__fixtures__/tooltipEnv';

// ── Fixtures ────────────────────────────────────────────────────────────────

const FROM_SUGGESTION_URL = '/api/static-groups/g1/collection-goals/from-suggestion';
const CREATE_URL = '/api/static-groups/g1/collection-goals';

function item(over: Partial<FindItem> = {}): FindItem {
  return {
    id: 'cat-lynx',
    name: 'Lynx of Righteous Fire',
    category: 'mount',
    sourceType: 'extreme',
    duty: 'Worqor Lar Dor (Extreme)',
    expansion: 'dt',
    token: { name: 'Valigarmanda Totem', cost: 99 },
    pluginReady: false,
    members: [],
    wantedBy: [],
    tracking: null,
    trackable: true,
    ...over,
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const posts = (url: string) => vi.mocked(api.post).mock.calls.filter(([u]) => u === url);
const toasts = () => useToastStore.getState().toasts;

function wrap(node: ReactNode) {
  return render(<MemoryRouter initialEntries={['/?tab=progress&pview=find']}>{node}</MemoryRouter>, { wrapper: TooltipWrapper });
}

function expectBusy(el: HTMLElement) {
  expect(el).toHaveAttribute('aria-disabled', 'true');
  for (const cls of BUSY_CLASS.split(/\s+/).filter(Boolean)) expect(el).toHaveClass(cls);
}

const realRefresh = useCollectionGoalStore.getState().refreshGoalProgress;
/** The order the lead's Track runs its steps in. */
let order: string[] = [];
const refreshGoalProgress = vi.fn(async (..._args: unknown[]) => {
  order.push('refresh');
});

beforeEach(() => {
  vi.clearAllMocks();
  stubCanHover();
  order = [];
  useToastStore.getState().clearAll();
  useCollectionGoalStore.setState({ goals: [], refreshGoalProgress: refreshGoalProgress as never });
});

afterEach(() => {
  useCollectionGoalStore.setState({ goals: [], refreshGoalProgress: realRefresh });
  useToastStore.getState().clearAll();
});

// ── LeadFindAction ──────────────────────────────────────────────────────────

describe('LeadFindAction: Track (D-7, R-F-6)', () => {
  const trackButton = () => screen.getByRole('button', { name: /^Track\b/ });

  it('sends one POST to from-suggestion with { catalog_item_id, status: "farming" }, refreshes the lists, calls onTracked(id), then toasts "Tracking {name}"', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(apiGoal('new-lynx', { catalog_item_id: 'cat-lynx', title: 'Lynx of Righteous Fire' }));
    const onTracked = vi.fn(() => {
      order.push('tracked');
    });
    wrap(<LeadFindAction item={item()} groupId="g1" onTracked={onTracked} />);
    fireEvent.click(trackButton());
    await waitFor(() => expect(onTracked).toHaveBeenCalledTimes(1));
    expect(onTracked).toHaveBeenCalledWith('new-lynx');
    expect(posts(FROM_SUGGESTION_URL)).toHaveLength(1);
    expect(posts(FROM_SUGGESTION_URL)[0][1]).toEqual({ catalog_item_id: 'cat-lynx', status: 'farming' });
    expect(vi.mocked(api.post)).toHaveBeenCalledTimes(1);
    expect(refreshGoalProgress).toHaveBeenCalledWith('g1', 'new-lynx', { lists: true });
    expect(order).toEqual(['refresh', 'tracked']);
    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0]).toMatchObject({ type: 'success', message: 'Tracking Lynx of Righteous Fire' });
  });

  it('a double click still sends one POST, and the button is aria-disabled with BUSY_CLASS while it runs', async () => {
    const held = deferred<unknown>();
    vi.mocked(api.post).mockReturnValueOnce(held.promise as never);
    const onTracked = vi.fn();
    wrap(<LeadFindAction item={item()} groupId="g1" onTracked={onTracked} />);
    const button = trackButton();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expectBusy(trackButton()));
    fireEvent.click(trackButton());
    held.resolve(apiGoal('new-lynx', { catalog_item_id: 'cat-lynx' }));
    await waitFor(() => expect(onTracked).toHaveBeenCalledTimes(1));
    expect(posts(FROM_SUGGESTION_URL)).toHaveLength(1);
  });

  it('keeps quotes, $, an ellipsis and unicode in the toast name literally', async () => {
    const name = 'Ŝéra «Ω» "q" $1 $& … \\u00e9 50%';
    vi.mocked(api.post).mockResolvedValueOnce(apiGoal('new-odd', { catalog_item_id: 'cat-odd', title: name }));
    wrap(<LeadFindAction item={item({ id: 'cat-odd', name })} groupId="g1" onTracked={vi.fn()} />);
    fireEvent.click(trackButton());
    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0].message).toBe(`Tracking ${name}`);
    expect(posts(FROM_SUGGESTION_URL)[0][1]).toEqual({ catalog_item_id: 'cat-odd', status: 'farming' });
  });

  it('a failure toasts "Couldn\'t track {name}: …", does not call onTracked, and Track works again', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('boom'));
    const onTracked = vi.fn();
    wrap(<LeadFindAction item={item()} groupId="g1" onTracked={onTracked} />);
    fireEvent.click(trackButton());
    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0].type).toBe('error');
    expect(toasts()[0].message).toMatch(/^Couldn't track Lynx of Righteous Fire: .*boom/);
    expect(onTracked).not.toHaveBeenCalled();
    await waitFor(() => expect(trackButton()).not.toHaveAttribute('aria-disabled', 'true'));
    vi.mocked(api.post).mockResolvedValueOnce(apiGoal('new-lynx', { catalog_item_id: 'cat-lynx' }));
    fireEvent.click(trackButton());
    await waitFor(() => expect(onTracked).toHaveBeenCalledWith('new-lynx'));
    expect(posts(FROM_SUGGESTION_URL)).toHaveLength(2);
  });

  it('a 403 the api already toasted is not toasted again', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new ApiError(403, 'Forbidden', true));
    const onTracked = vi.fn();
    wrap(<LeadFindAction item={item()} groupId="g1" onTracked={onTracked} />);
    fireEvent.click(trackButton());
    await waitFor(() => expect(trackButton()).not.toHaveAttribute('aria-disabled', 'true'));
    expect(posts(FROM_SUGGESTION_URL)).toHaveLength(1);
    expect(toasts()).toHaveLength(0);
    expect(onTracked).not.toHaveBeenCalled();
  });

  it('a fallback item shows "Offline list: retry to track" and no Track', () => {
    wrap(<LeadFindAction item={item({ id: 'fallback-x', name: 'Offline Mount', trackable: false })} groupId="g1" onTracked={vi.fn()} />);
    expect(screen.getByText('Offline list: retry to track')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Track\b/ })).not.toBeInTheDocument();
  });
});

// ── CustomTrackRow ──────────────────────────────────────────────────────────

describe('CustomTrackRow (D-8, R-F-6)', () => {
  const customButton = () => screen.getByRole('button', { name: /as a custom farm$/ });

  it('with "Foo": one POST to collection-goals with goal_type custom_reward, title Foo, status farming; onCreated(id); toast "Tracking Foo"', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(apiGoal('new-custom', { goal_type: 'custom_reward', title: 'Foo' }));
    const onCreated = vi.fn();
    wrap(<CustomTrackRow query="Foo" groupId="g1" onCreated={onCreated} />);
    expect(customButton()).toHaveAccessibleName('Track "Foo" as a custom farm');
    fireEvent.click(customButton());
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(onCreated).toHaveBeenCalledWith('new-custom');
    expect(posts(CREATE_URL)).toHaveLength(1);
    expect(vi.mocked(api.post)).toHaveBeenCalledTimes(1);
    expect(posts(CREATE_URL)[0][1]).toMatchObject({ goal_type: 'custom_reward', title: 'Foo', status: 'farming' });
    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0]).toMatchObject({ type: 'success', message: 'Tracking Foo' });
  });

  it.each([
    ['surrounding spaces', '  Foo  '],
    ['a CRLF tail', 'Foo\r\n'],
    ['an LF tail and a tab', '\tFoo\n'],
  ])('trims %s from the label and the title', async (_label, query) => {
    vi.mocked(api.post).mockResolvedValueOnce(apiGoal('new-custom', { goal_type: 'custom_reward', title: 'Foo' }));
    const onCreated = vi.fn();
    wrap(<CustomTrackRow query={query} groupId="g1" onCreated={onCreated} />);
    expect(customButton()).toHaveAccessibleName('Track "Foo" as a custom farm');
    fireEvent.click(customButton());
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect((posts(CREATE_URL)[0][1] as { title: string }).title).toBe('Foo');
  });

  it('keeps quotes, backslashes, $, % and unicode literally in the label and the title', async () => {
    const q = 'Ŝéra «Ω» "q" $1 $& … \\u00e9 50%';
    vi.mocked(api.post).mockResolvedValueOnce(apiGoal('new-custom', { goal_type: 'custom_reward', title: q }));
    const onCreated = vi.fn();
    wrap(<CustomTrackRow query={q} groupId="g1" onCreated={onCreated} />);
    expect(customButton()).toHaveAccessibleName(`Track "${q}" as a custom farm`);
    fireEvent.click(customButton());
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect((posts(CREATE_URL)[0][1] as { title: string }).title).toBe(q);
  });

  it('caps the title at 200 characters', async () => {
    const q = `${'a'.repeat(199)}bcdefg`;
    vi.mocked(api.post).mockResolvedValueOnce(apiGoal('new-custom', { goal_type: 'custom_reward', title: q.slice(0, 200) }));
    const onCreated = vi.fn();
    wrap(<CustomTrackRow query={q} groupId="g1" onCreated={onCreated} />);
    fireEvent.click(customButton());
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const title = (posts(CREATE_URL)[0][1] as { title: string }).title;
    expect(title).toHaveLength(200);
    expect(title).toBe(q.slice(0, 200));
  });

  it('a double click still sends one POST, aria-disabled with BUSY_CLASS while it runs', async () => {
    const held = deferred<unknown>();
    vi.mocked(api.post).mockReturnValueOnce(held.promise as never);
    const onCreated = vi.fn();
    wrap(<CustomTrackRow query="Foo" groupId="g1" onCreated={onCreated} />);
    fireEvent.click(customButton());
    fireEvent.click(customButton());
    await waitFor(() => expectBusy(customButton()));
    fireEvent.click(customButton());
    held.resolve(apiGoal('new-custom', { goal_type: 'custom_reward', title: 'Foo' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(posts(CREATE_URL)).toHaveLength(1);
  });

  it('a failure toasts with the reason and does not call onCreated; a toasted 403 is not toasted again', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('boom'));
    const onCreated = vi.fn();
    const { unmount } = wrap(<CustomTrackRow query="Foo" groupId="g1" onCreated={onCreated} />);
    fireEvent.click(customButton());
    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0].type).toBe('error');
    expect(toasts()[0].message).toMatch(/boom/);
    expect(onCreated).not.toHaveBeenCalled();
    unmount();

    useToastStore.getState().clearAll();
    vi.mocked(api.post).mockRejectedValueOnce(new ApiError(403, 'Forbidden', true));
    wrap(<CustomTrackRow query="Foo" groupId="g1" onCreated={onCreated} />);
    fireEvent.click(customButton());
    await waitFor(() => expect(customButton()).not.toHaveAttribute('aria-disabled', 'true'));
    expect(posts(CREATE_URL)).toHaveLength(2);
    expect(toasts()).toHaveLength(0);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it.each([
    ['empty', ''],
    ['spaces', '   '],
    ['CRLF only', '\r\n'],
  ])('with an %s query: the muted line "Type a name to track a custom farm" and no control', (_label, query) => {
    const { container } = wrap(<CustomTrackRow query={query} groupId="g1" onCreated={vi.fn()} />);
    const line = screen.getByText('Type a name to track a custom farm');
    expect(line.tagName).toBe('P');
    expect(line).toHaveClass('text-xs', 'text-text-muted');
    expect(container.querySelector('button, a, input, [role="button"], [tabindex]')).toBeNull();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });
});
