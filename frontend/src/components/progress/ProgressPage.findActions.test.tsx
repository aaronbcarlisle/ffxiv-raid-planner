/**
 * S2a-4a·A3 TA3 — Find's actions and the footer on the page (R-F-3, R-F-6, R-F-7; design D-5, D-6,
 * D-7, D-8, §3.2–§3.4, §3.7, §3.8; carried A2-M3 `?edit`, twin expansion, Track a farm's focus).
 *
 * - Leads: **Track** on a trackable untracked row (one POST to `from-suggestion`, then ONE URL write:
 *   no `pview`, `track=<new id>`, the row open, "Tracking {name}"); fallback rows read "Offline list:
 *   retry to track"; the custom row last (one POST to `collection-goals`, then `track` and `edit` set
 *   to the new id with Title focused; a muted line while the search is blank); **Track a farm** opens
 *   Find with the search focused, after a Discard too.
 * - Members: **I want this**, never written before `myIntentsLoaded` or after a failed load ("Couldn't
 *   load your wants" with Retry); a PUT to `/api/me/collection-intent/{id}` that keeps an existing
 *   row's priority and notes; a private row asks first (focus on Cancel, Escape cancels and is
 *   prevented); a `dossier_public` row is never downgraded; a shared want reads "Wanted ✓". Under
 *   View As there is no I want this and `GET /api/me/collection-intent` is never sent.
 * - Every member role: the footer under the matrix, "{A} and {B} want {farm} · Find", whose Find
 *   opens Find with the Wanted copy of that row expanded and its toggle focused.
 *
 * The api is mocked per URL, so the real store actions run and every request is counted exactly.
 * Every URL assertion reads the FINAL location; focus is read after the async work settles.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
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
import { useCollectionIntentStore } from '../../stores/collectionIntentStore';
import { useToastStore } from '../../stores/toastStore';
import type { StaticGroup } from '../../types';
import { farmEditTitleId } from './farmFocus';
import {
  DEFAULT_GOALS,
  loadedMatrix,
  menuOf,
  panel,
  pick,
  refreshGoalProgress,
  renderAt,
  rowOf,
  search,
  seedPage,
  setUpPage,
  tearDownPage,
} from './__fixtures__/pageHarness';
import { apiGoal, goal } from './__fixtures__/progressFixtures';

// ── The server ──────────────────────────────────────────────────────────────

const CATALOG_URL = '/api/collection-catalog';
const SUGGESTIONS_URL = '/api/static-groups/g1/collection-suggestions';
const INTENTS_URL = '/api/me/collection-intent';
const FROM_SUGGESTION_URL = '/api/static-groups/g1/collection-goals/from-suggestion';
const CREATE_URL = '/api/static-groups/g1/collection-goals';
const LYNX = 'Lynx of Righteous Fire';

const apiCat = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  external_source: 'ffxivcollect',
  external_id: null,
  name: id,
  category: 'mount',
  expansion: 'dt',
  patch: '7.0',
  icon_url: null,
  image_url: null,
  source_text: null,
  source_type: 'extreme',
  source_duty_name: `${id} duty`,
  source_duty_key: `${id}-key`,
  token_name: null,
  token_cost: null,
  token_item_id: null,
  game_mount_id: null,
  tradeable: false,
  rarity_owned_percent: null,
  is_curated: true,
  notes: null,
  ...over,
});

const CATALOG = [
  apiCat('cat-lynx', {
    name: LYNX,
    source_duty_name: 'Worqor Lar Dor (Extreme)',
    source_duty_key: 'worqor',
    token_name: 'Valigarmanda Totem',
    token_cost: 99,
  }),
  apiCat('cat-ew', { name: 'Abyssal Steed', expansion: 'ew', source_duty_name: 'The Abyssal Fracture (Extreme)', source_duty_key: 'abyss' }),
];

const apiMember = (userId: string, intent: string | null, ownership: string, tokenCount: number | null = null) => ({
  user_id: userId,
  display_name: `discord-${userId}-handle`,
  ownership_state: ownership,
  intent,
  token_count: tokenCount,
  can_buy: false,
  confidence: 'high',
  reasons: [],
});

const suggestion = (id: string, name: string, members: ReturnType<typeof apiMember>[], score = 5) => ({
  catalog_item_id: id,
  catalog_item_name: name,
  catalog_item_category: 'mount',
  expansion: 'dt',
  source_duty_name: `${name} duty`,
  source_type: 'extreme',
  static_goal_id: null,
  suggested_farm_score: score,
  reason_summary: '',
  members,
});

/** Lynx is wanted by Aya (u1) and Bo (u2); Cy (u3) is a member with no want. */
const SUGGESTIONS = [suggestion('cat-lynx', LYNX, [apiMember('u1', 'hunting', 'missing', 37), apiMember('u2', 'hunting', 'missing', 12), apiMember('u3', null, 'unknown')])];

type ApiIntentRow = { intent: string; priority: string; visibility: string; notes: string | null };
const apiIntent = (catalogItemId: string, row: ApiIntentRow) => ({
  id: `intent-${catalogItemId}`,
  profile_id: 'profile-u2',
  catalog_item_id: catalogItemId,
  updated_at: '2026-10-01T00:00:00Z',
  ...row,
});

interface Route {
  catalog?: () => Promise<unknown>;
  suggestions?: () => Promise<unknown>;
  intents?: () => Promise<unknown>;
  post?: (url: string, body: unknown) => Promise<unknown>;
  put?: (url: string, body: unknown) => Promise<unknown>;
}

/** What the server saw, in order: 'put', 'suggestions', … */
let log: string[] = [];

async function defaultPost(url: string, body: unknown): Promise<unknown> {
  const b = body as Record<string, unknown>;
  if (url === FROM_SUGGESTION_URL) return apiGoal('new-lynx', { catalog_item_id: b.catalog_item_id, title: LYNX });
  if (url === CREATE_URL) return apiGoal('new-custom', { goal_type: 'custom_reward', title: b.title });
  return {};
}

async function defaultPut(url: string, body: unknown): Promise<unknown> {
  const id = url.slice(`${INTENTS_URL}/`.length);
  return apiIntent(id, body as ApiIntentRow);
}

function serve({
  catalog = async () => CATALOG,
  suggestions = async () => SUGGESTIONS,
  intents = async () => [],
  post = defaultPost,
  put = defaultPut,
}: Route = {}) {
  vi.mocked(api.get).mockImplementation(async (url: string) => {
    if (url.startsWith(CATALOG_URL)) return catalog();
    if (url.startsWith(SUGGESTIONS_URL)) {
      log.push('suggestions');
      return suggestions();
    }
    if (url === INTENTS_URL) return intents();
    return [];
  });
  vi.mocked(api.post).mockImplementation(async (url: string, body?: unknown) => {
    log.push(`post ${url}`);
    return post(url, body);
  });
  vi.mocked(api.put).mockImplementation(async (url: string, body?: unknown) => {
    log.push('put');
    return put(url, body);
  });
}

const gets = (prefix: string) => vi.mocked(api.get).mock.calls.filter(([url]) => String(url) === prefix || String(url).startsWith(`${prefix}?`)).length;
const getsFrom = (prefix: string) => vi.mocked(api.get).mock.calls.filter(([url]) => String(url).startsWith(prefix)).length;
const posts = (url: string) => vi.mocked(api.post).mock.calls.filter(([u]) => u === url);
const intentPuts = () => vi.mocked(api.put).mock.calls.filter(([u]) => String(u).startsWith(`${INTENTS_URL}/`));
const toasts = () => useToastStore.getState().toasts;

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** The harness's static, with a roster that names u1, u2 and u3. */
const ROSTER_GROUP = {
  id: 'g1',
  name: 'Dev Test Static',
  shareCode: 'DEVTST',
  settings: {},
  userRole: 'owner',
  members: [
    { userId: 'u1', role: 'owner', user: { id: 'u1', displayName: 'Aya', discordUsername: 'discord-u1-handle' } },
    { userId: 'u2', role: 'member', user: { id: 'u2', displayName: 'Bo', discordUsername: 'discord-u2-handle' } },
    { userId: 'u3', role: 'viewer', user: { id: 'u3', displayName: 'Cy', discordUsername: 'discord-u3-handle' } },
  ],
} as unknown as StaticGroup;

const LEAD = { group: ROSTER_GROUP } as const;
const MEMBER = { group: ROSTER_GROUP, userRole: 'member', canManage: false, currentUserId: 'u2' } as const;
const VIEWER = { group: ROSTER_GROUP, userRole: 'viewer', canManage: false, currentUserId: 'u3' } as const;

// ── Lookups ─────────────────────────────────────────────────────────────────

const findRegion = () => screen.getByRole('region', { name: 'Find' });
const wantedRegion = async () => within(await screen.findByRole('region', { name: 'Find' })).findByRole('region', { name: /^Wanted by your static/ });
const allRegion = async () => within(await screen.findByRole('region', { name: 'Find' })).findByRole('region', { name: /^All farm sources/ });

async function rowIn(section: 'wanted' | 'all', name: string): Promise<HTMLElement> {
  const region = section === 'wanted' ? await wantedRegion() : await allRegion();
  const toggle = await within(region).findByRole('button', { name: `Show details for ${name}` });
  return toggle.closest('[data-testid="find-row"]') as HTMLElement;
}
const toggleOf = (row: HTMLElement) => within(row).getAllByRole('button', { name: /^Show details for / })[0];
const trackIn = (row: HTMLElement) => within(row).queryByRole('button', { name: /^Track\b/ });
const wantIn = (row: HTMLElement) => within(row).queryByRole('button', { name: /I want this/ });
const allWantButtons = () => screen.queryAllByRole('button', { name: /I want this/ });
const allTrackButtons = () => within(findRegion()).queryAllByRole('button', { name: /^Track\b/ });
const customButton = () => screen.queryByRole('button', { name: /as a custom farm$/ });
const trackAFarm = () => within(screen.getByTestId('progress-view-bar')).getByRole('button', { name: 'Track a farm' });
const searchBox = () => within(findRegion()).getByLabelText('Search farms') as HTMLInputElement;
const PROMPT = 'Your want is private. Share it with your statics?';
const footerLink = (farm = LYNX) =>
  screen.queryByRole('button', { name: `Find ${farm}` }) ?? screen.queryByRole('link', { name: `Find ${farm}` });

function resetStores() {
  useCollectionGoalStore.setState({ catalog: [], catalogLoaded: false, catalogLoading: false, catalogError: null });
  useCollectionIntentStore.setState({ suggestions: {}, suggestionsLoading: {}, suggestionsError: {}, myIntents: {}, myIntentsLoaded: false });
}

function fresh(route: Route = {}) {
  cleanup();
  tearDownPage();
  resetStores();
  setUpPage();
  log = [];
  serve(route);
}

beforeEach(() => {
  setUpPage();
  Element.prototype.scrollIntoView = vi.fn();
  resetStores();
  log = [];
  serve();
});

afterEach(() => {
  tearDownPage();
  resetStores();
});

// ── Lead: Track (D-7, R-F-6, §3.3) ──────────────────────────────────────────

describe('lead: Track', () => {
  it('sends one POST to from-suggestion; the final URL has no pview and track=<new id>; the row is open; "Tracking {name}"', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', LEAD);
    const row = await rowIn('wanted', LYNX);
    fireEvent.click(await within(row).findByRole('button', { name: /^Track\b/ }));
    await waitFor(() => expect(search().get('track')).toBe('new-lynx'));
    expect(search().get('pview')).toBeNull();
    expect(search().get('edit')).toBeNull();
    expect(posts(FROM_SUGGESTION_URL)).toHaveLength(1);
    expect(posts(FROM_SUGGESTION_URL)[0][1]).toEqual({ catalog_item_id: 'cat-lynx', status: 'farming' });
    expect(refreshGoalProgress).toHaveBeenCalledWith('g1', 'new-lynx', { lists: true });
    await waitFor(() => expect(panel()).not.toBeNull());
    expect(rowOf('new-lynx')).toBeDefined();
    await waitFor(() => expect(toasts().map((t) => t.message)).toContain(`Tracking ${LYNX}`));
  });

  it('a double click still sends one POST', async () => {
    const held = deferred<unknown>();
    serve({ post: (url, body) => (url === FROM_SUGGESTION_URL ? held.promise : defaultPost(url, body)) });
    seedPage();
    renderAt('/?tab=progress&pview=find', LEAD);
    const row = await rowIn('wanted', LYNX);
    const track = await within(row).findByRole('button', { name: /^Track\b/ });
    fireEvent.click(track);
    fireEvent.click(track);
    await waitFor(() => expect(track).toHaveAttribute('aria-disabled', 'true'));
    fireEvent.click(track);
    held.resolve(apiGoal('new-lynx', { catalog_item_id: 'cat-lynx', title: LYNX }));
    await waitFor(() => expect(search().get('track')).toBe('new-lynx'));
    expect(posts(FROM_SUGGESTION_URL)).toHaveLength(1);
  });

  it('a 403 the api already toasted is not toasted again, and Find stays', async () => {
    serve({ post: async () => Promise.reject(new ApiError(403, 'Forbidden', true)) });
    seedPage();
    renderAt('/?tab=progress&pview=find', LEAD);
    const row = await rowIn('wanted', LYNX);
    const track = await within(row).findByRole('button', { name: /^Track\b/ });
    fireEvent.click(track);
    await waitFor(() => expect(posts(FROM_SUGGESTION_URL)).toHaveLength(1));
    await waitFor(() => expect(track).not.toHaveAttribute('aria-disabled', 'true'));
    expect(toasts()).toHaveLength(0);
    expect(search().get('pview')).toBe('find');
    expect(search().get('track')).toBeNull();
  });
});

// ── Lead: fallback, the custom row and Track a farm (D-5, D-7, D-8) ─────────

describe('lead: fallback, custom row and Track a farm', () => {
  it('a fallback item shows "Offline list: retry to track" and no Track', async () => {
    serve({ catalog: () => Promise.reject(new Error('catalog down')) });
    seedPage();
    renderAt('/?tab=progress&pview=find', LEAD);
    const all = await allRegion();
    await waitFor(() => expect(within(all).getAllByTestId('find-row').length).toBeGreaterThan(0));
    const fallbackRow = within(all).getAllByTestId('find-row')[0];
    expect(within(fallbackRow).getByText('Offline list: retry to track')).toBeInTheDocument();
    expect(trackIn(fallbackRow)).toBeNull();
  });

  it('with "Foo": one POST to collection-goals (custom_reward, Foo, farming); the final URL has track and edit = the new id and no pview; Title is focused', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', LEAD);
    await rowIn('all', LYNX);
    fireEvent.change(searchBox(), { target: { value: 'Foo' } });
    const custom = await screen.findByRole('button', { name: 'Track "Foo" as a custom farm' });
    fireEvent.click(custom);
    fireEvent.click(custom);
    await waitFor(() => expect(search().get('edit')).toBe('new-custom'));
    expect(search().get('track')).toBe('new-custom');
    expect(search().get('pview')).toBeNull();
    expect(posts(CREATE_URL)).toHaveLength(1);
    expect(posts(CREATE_URL)[0][1]).toMatchObject({ goal_type: 'custom_reward', title: 'Foo', status: 'farming' });
    await waitFor(() => expect(document.activeElement?.id).toBe(farmEditTitleId('new-custom')));
    expect((document.activeElement as HTMLInputElement).value).toBe('Foo');
    await waitFor(() => expect(toasts().map((t) => t.message)).toContain('Tracking Foo'));
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
  ])('with an %s search: the muted line and no custom control', async (_label, value) => {
    seedPage();
    renderAt('/?tab=progress&pview=find', LEAD);
    await rowIn('all', LYNX);
    fireEvent.change(searchBox(), { target: { value } });
    expect(await within(findRegion()).findByText('Type a name to track a custom farm')).toBeInTheDocument();
    expect(customButton()).toBeNull();
  });

  it('the custom row is the last thing in Find, after both sections', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', LEAD);
    const all = await allRegion();
    const line = await within(findRegion()).findByText('Type a name to track a custom farm');
    expect(all.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Track a farm opens Find with the search focused', async () => {
    seedPage();
    renderAt('/?tab=progress', LEAD);
    await loadedMatrix();
    trackAFarm().focus();
    fireEvent.click(trackAFarm());
    await waitFor(() => expect(search().get('pview')).toBe('find'));
    await waitFor(() => expect(document.activeElement).toBe(searchBox()));
  });

  it('Track a farm over a dirty Edit: after Discard, the search is focused', async () => {
    seedPage();
    renderAt('/?tab=progress&track=hot', LEAD);
    await screen.findByTestId('progress-expansion');
    fireEvent.click(menuOf('Hot Farm'));
    pick('Edit');
    const block = await screen.findByTestId('progress-edit-block');
    fireEvent.change(within(block).getByRole('textbox', { name: 'Notes' }), { target: { value: 'Edited notes' } });
    trackAFarm().focus();
    fireEvent.click(trackAFarm());
    const dialog = await screen.findByRole('dialog', { name: 'Discard changes?' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    const discard = within(dialog).getByRole('button', { name: 'Discard' });
    discard.focus();
    fireEvent.click(discard);
    await waitFor(() => expect(search().get('pview')).toBe('find'));
    expect(search().get('track')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(searchBox()));
  });
});

// ── Member: before the intents load (D-6, M-5a) ─────────────────────────────

describe('member: before the intents load', () => {
  it('before myIntentsLoaded no PUT is possible; once they load, I want this sends one', async () => {
    const held = deferred<unknown>();
    serve({ intents: () => held.promise });
    seedPage();
    renderAt('/?tab=progress&pview=find', MEMBER);
    const row = await rowIn('wanted', LYNX);
    await waitFor(() => expect(gets(INTENTS_URL)).toBeGreaterThan(0));
    for (const b of within(row).queryAllByRole('button')) {
      if (/^Show details for /.test(b.getAttribute('aria-label') ?? '')) continue;
      if (/I want this|Share/.test(b.textContent ?? '') || /I want this|Share/.test(b.getAttribute('aria-label') ?? '')) {
        expect(b).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(b);
      }
    }
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();

    held.resolve([]);
    const want = await waitFor(() => {
      const b = wantIn(row);
      expect(b).not.toBeNull();
      expect(b).not.toHaveAttribute('aria-disabled', 'true');
      return b!;
    });
    fireEvent.click(want);
    await waitFor(() => expect(intentPuts()).toHaveLength(1));
  });

  it('when fetchMyIntents fails: "Couldn\'t load your wants" with a Retry, no PUT; Retry loads them', async () => {
    let fail = true;
    serve({ intents: async () => (fail ? Promise.reject(new Error('intents down')) : []) });
    seedPage();
    renderAt('/?tab=progress&pview=find', MEMBER);
    const row = await rowIn('wanted', LYNX);
    expect(await within(row).findByText(/Couldn't load your wants/)).toBeInTheDocument();
    expect(wantIn(row)).toBeNull();
    const retry = within(row).getByRole('button', { name: /Retry/ });
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
    const before = gets(INTENTS_URL);
    fail = false;
    fireEvent.click(retry);
    await waitFor(() => expect(gets(INTENTS_URL)).toBe(before + 1));
    expect(await within(row).findByRole('button', { name: /I want this/ })).toBeInTheDocument();
    expect(within(row).queryByText(/Couldn't load your wants/)).toBeNull();
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });
});

// ── Member: writing a want (D-6, §3.2) ──────────────────────────────────────

describe('member: writing a want', () => {
  it('no row: one PUT { hunting, medium, static_only, notes: null } even on a double click, then a suggestions refetch, the toast and Wanted ✓', async () => {
    const held = deferred<void>();
    serve({ put: async (url, body) => held.promise.then(() => defaultPut(url, body)) });
    seedPage();
    renderAt('/?tab=progress&pview=find', MEMBER);
    const row = await rowIn('wanted', LYNX);
    const want = await within(row).findByRole('button', { name: /I want this/ });
    expect(screen.queryByText(PROMPT)).toBeNull();
    fireEvent.click(want);
    fireEvent.click(want);
    expect(screen.queryByText(PROMPT)).toBeNull();
    await waitFor(() => expect(want).toHaveAttribute('aria-disabled', 'true'));
    fireEvent.click(want);
    const suggestionsBefore = getsFrom(SUGGESTIONS_URL);
    held.resolve();
    await waitFor(() => expect(getsFrom(SUGGESTIONS_URL)).toBe(suggestionsBefore + 1));
    expect(intentPuts()).toHaveLength(1);
    expect(intentPuts()[0][0]).toBe(`${INTENTS_URL}/cat-lynx`);
    expect(intentPuts()[0][1]).toEqual({ intent: 'hunting', priority: 'medium', visibility: 'static_only', notes: null });
    expect(log.indexOf('put')).toBeLessThan(log.lastIndexOf('suggestions'));
    await waitFor(() => expect(toasts().map((t) => t.message)).toContain(`Your statics can see you want ${LYNX}`));
    const wantedRow = await rowIn('wanted', LYNX);
    expect(await within(wantedRow).findByText('Wanted ✓')).toBeInTheDocument();
  });

  it('a PUT failure toasts "Couldn\'t save your want: …"; a toasted 403 is not toasted again', async () => {
    serve({ put: async () => Promise.reject(new Error('nope')) });
    seedPage();
    renderAt('/?tab=progress&pview=find', MEMBER);
    let row = await rowIn('wanted', LYNX);
    fireEvent.click(await within(row).findByRole('button', { name: /I want this/ }));
    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0].type).toBe('error');
    expect(toasts()[0].message).toMatch(/^Couldn't save your want: .*nope/);

    fresh({ put: async () => Promise.reject(new ApiError(403, 'Forbidden', true)) });
    seedPage();
    renderAt('/?tab=progress&pview=find', MEMBER);
    row = await rowIn('wanted', LYNX);
    const want = await within(row).findByRole('button', { name: /I want this/ });
    fireEvent.click(want);
    await waitFor(() => expect(intentPuts()).toHaveLength(1));
    await waitFor(() => expect(wantIn(row)).not.toHaveAttribute('aria-disabled', 'true'));
    expect(toasts()).toHaveLength(0);
  });

  describe('a private row', () => {
    const PRIVATE = { intent: 'interested', priority: 'high', visibility: 'private', notes: 'my "note" $1 \\u00e9 …' };

    async function openPrompt(row: ApiIntentRow = PRIVATE) {
      serve({ intents: async () => [apiIntent('cat-lynx', row)] });
      seedPage();
      renderAt('/?tab=progress&pview=find', MEMBER);
      const r = await rowIn('wanted', LYNX);
      fireEvent.click(await within(r).findByRole('button', { name: /I want this/ }));
      expect(await within(r).findByText(PROMPT)).toBeInTheDocument();
      return r;
    }

    it('the prompt appears with focus on Cancel, and nothing is written', async () => {
      const row = await openPrompt();
      await waitFor(() => expect(document.activeElement).toBe(within(row).getByRole('button', { name: 'Cancel' })));
      expect(within(row).getByRole('button', { name: 'Share' })).not.toBe(document.activeElement);
      expect(vi.mocked(api.put)).not.toHaveBeenCalled();
    });

    it('a second press on the trigger\'s spot lands on Cancel, never Share (S-6)', async () => {
      const row = await openPrompt();
      await waitFor(() => expect(document.activeElement).toBe(within(row).getByRole('button', { name: 'Cancel' })));
      fireEvent.click(document.activeElement as HTMLElement);
      await waitFor(() => expect(within(row).queryByText(PROMPT)).toBeNull());
      expect(vi.mocked(api.put)).not.toHaveBeenCalled();
    });

    it('Cancel sends no request and puts focus back on I want this', async () => {
      const row = await openPrompt();
      fireEvent.click(within(row).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(within(row).queryByText(PROMPT)).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(wantIn(row)));
      expect(vi.mocked(api.put)).not.toHaveBeenCalled();
    });

    it('Escape cancels and is prevented, so nothing else closes: the row stays expanded and Find stays', async () => {
      serve({ intents: async () => [apiIntent('cat-lynx', PRIVATE)] });
      seedPage();
      renderAt('/?tab=progress&pview=find', MEMBER);
      const row = await rowIn('wanted', LYNX);
      fireEvent.click(toggleOf(row));
      await waitFor(() => expect(toggleOf(row)).toHaveAttribute('aria-expanded', 'true'));
      fireEvent.click(await within(row).findByRole('button', { name: /I want this/ }));
      const cancel = await within(row).findByRole('button', { name: 'Cancel' });
      await waitFor(() => expect(document.activeElement).toBe(cancel));
      const notPrevented = fireEvent.keyDown(cancel, { key: 'Escape', code: 'Escape' });
      expect(notPrevented).toBe(false);
      await waitFor(() => expect(within(row).queryByText(PROMPT)).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(wantIn(row)));
      expect(toggleOf(row)).toHaveAttribute('aria-expanded', 'true');
      expect(search().get('pview')).toBe('find');
      expect(vi.mocked(api.put)).not.toHaveBeenCalled();
    });

    it('Share sends one PUT keeping priority and notes, with visibility static_only (a double click too)', async () => {
      const row = await openPrompt();
      const share = within(row).getByRole('button', { name: 'Share' });
      fireEvent.click(share);
      fireEvent.click(share);
      await waitFor(() => expect(intentPuts()).toHaveLength(1));
      await waitFor(() => expect(toasts().map((t) => t.message)).toContain(`Your statics can see you want ${LYNX}`));
      expect(intentPuts()).toHaveLength(1);
      expect(intentPuts()[0][0]).toBe(`${INTENTS_URL}/cat-lynx`);
      expect(intentPuts()[0][1]).toEqual({ intent: 'hunting', priority: 'high', visibility: 'static_only', notes: 'my "note" $1 \\u00e9 …' });
    });

    it('a private pass row asks too, and Share keeps its priority and notes', async () => {
      const row = await openPrompt({ intent: 'pass', priority: 'low', visibility: 'private', notes: 'later\r\nmaybe' });
      expect(vi.mocked(api.put)).not.toHaveBeenCalled();
      fireEvent.click(within(row).getByRole('button', { name: 'Share' }));
      await waitFor(() => expect(intentPuts()).toHaveLength(1));
      expect(intentPuts()[0][1]).toEqual({ intent: 'hunting', priority: 'low', visibility: 'static_only', notes: 'later\r\nmaybe' });
    });
  });

  it('a dossier_public row is never downgraded: no prompt, one PUT keeping its visibility, priority and notes', async () => {
    serve({ intents: async () => [apiIntent('cat-lynx', { intent: 'pass', priority: 'high', visibility: 'dossier_public', notes: 'pub' })] });
    seedPage();
    renderAt('/?tab=progress&pview=find', MEMBER);
    const row = await rowIn('wanted', LYNX);
    fireEvent.click(await within(row).findByRole('button', { name: /I want this/ }));
    await waitFor(() => expect(intentPuts()).toHaveLength(1));
    expect(screen.queryByText(PROMPT)).toBeNull();
    expect(intentPuts()[0][1]).toEqual({ intent: 'hunting', priority: 'high', visibility: 'dossier_public', notes: 'pub' });
  });

  it('a static_only hidden row: no prompt, one PUT keeping its priority and notes', async () => {
    serve({ intents: async () => [apiIntent('cat-lynx', { intent: 'hidden', priority: 'low', visibility: 'static_only', notes: null })] });
    seedPage();
    renderAt('/?tab=progress&pview=find', MEMBER);
    const row = await rowIn('wanted', LYNX);
    fireEvent.click(await within(row).findByRole('button', { name: /I want this/ }));
    await waitFor(() => expect(intentPuts()).toHaveLength(1));
    expect(screen.queryByText(PROMPT)).toBeNull();
    expect(intentPuts()[0][1]).toEqual({ intent: 'hunting', priority: 'low', visibility: 'static_only', notes: null });
  });

  it.each([
    ['hunting', 'static_only'],
    ['interested', 'dossier_public'],
  ])('a shared want (%s, %s) reads "Wanted ✓" with no I want this', async (intent, visibility) => {
    serve({ intents: async () => [apiIntent('cat-lynx', { intent, priority: 'medium', visibility, notes: null })] });
    seedPage();
    renderAt('/?tab=progress&pview=find', MEMBER);
    const row = await rowIn('wanted', LYNX);
    expect(await within(row).findByText('Wanted ✓')).toBeInTheDocument();
    expect(wantIn(row)).toBeNull();
    // Another item with no row still offers it.
    expect(await within(await rowIn('all', 'Abyssal Steed')).findByRole('button', { name: /I want this/ })).toBeInTheDocument();
  });
});

// ── Who sees what (§3.7) ────────────────────────────────────────────────────

describe('who sees what', () => {
  it('under View As there is no I want this and fetchMyIntents is never called', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', MEMBER);
    expect(await within(await rowIn('wanted', LYNX)).findByRole('button', { name: /I want this/ })).toBeInTheDocument();

    fresh();
    seedPage();
    renderAt('/?tab=progress&pview=find', { ...MEMBER, userRole: 'member', currentUserId: 'u2', isViewingAs: true });
    await rowIn('wanted', LYNX);
    await rowIn('all', 'Abyssal Steed');
    await waitFor(() => expect(getsFrom(SUGGESTIONS_URL)).toBeGreaterThan(0));
    expect(allWantButtons()).toHaveLength(0);
    expect(gets(INTENTS_URL)).toBe(0);
    expect(vi.mocked(api.put)).not.toHaveBeenCalled();
  });

  it('a fallback item has no I want this; a trackable wanted one does', async () => {
    serve({ catalog: () => Promise.reject(new Error('catalog down')) });
    seedPage();
    renderAt('/?tab=progress&pview=find', MEMBER);
    expect(await within(await rowIn('wanted', LYNX)).findByRole('button', { name: /I want this/ })).toBeInTheDocument();
    const all = await allRegion();
    const fallbackRows = within(all)
      .getAllByTestId('find-row')
      .filter((r) => !within(r).queryByRole('button', { name: `Show details for ${LYNX}` }));
    expect(fallbackRows.length).toBeGreaterThan(0);
    for (const r of fallbackRows) expect(wantIn(r)).toBeNull();
  });

  it('a member sees I want this, and no Track and no custom row', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', MEMBER);
    expect(await within(await rowIn('wanted', LYNX)).findByRole('button', { name: /I want this/ })).toBeInTheDocument();
    expect(allTrackButtons()).toHaveLength(0);
    expect(screen.queryByText('Type a name to track a custom farm')).toBeNull();
    fireEvent.change(searchBox(), { target: { value: 'Foo' } });
    await waitFor(() => expect(searchBox().value).toBe('Foo'));
    expect(customButton()).toBeNull();
  });

  it('a lead sees Track, and no I want this', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', LEAD);
    expect(await within(await rowIn('wanted', LYNX)).findByRole('button', { name: /^Track\b/ })).toBeInTheDocument();
    expect(trackIn(await rowIn('all', 'Abyssal Steed'))).not.toBeNull();
    expect(allWantButtons()).toHaveLength(0);
    expect(gets(INTENTS_URL)).toBe(0);
  });

  it('a viewer sees no action: no Track, no I want this, no custom row', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', LEAD);
    expect(await within(await rowIn('wanted', LYNX)).findByRole('button', { name: /^Track\b/ })).toBeInTheDocument();

    fresh();
    seedPage();
    renderAt('/?tab=progress&pview=find', VIEWER);
    await rowIn('wanted', LYNX);
    await rowIn('all', 'Abyssal Steed');
    expect(allTrackButtons()).toHaveLength(0);
    expect(allWantButtons()).toHaveLength(0);
    expect(screen.queryByText('Wanted ✓')).toBeNull();
    expect(screen.queryByText('Type a name to track a custom farm')).toBeNull();
    fireEvent.change(searchBox(), { target: { value: 'Foo' } });
    expect(customButton()).toBeNull();
    expect(gets(INTENTS_URL)).toBe(0);
  });
});

// ── The footer (R-F-7, §3.4) ────────────────────────────────────────────────

describe('the footer', () => {
  it('reads "{A} and {B} want {farm} · Find" with roster names, under the matrix', async () => {
    seedPage();
    renderAt('/?tab=progress', LEAD);
    const matrix = await loadedMatrix();
    const link = await waitFor(() => {
      const l = footerLink();
      expect(l).not.toBeNull();
      return l!;
    });
    const para = (link.closest('p') ?? link.parentElement!.querySelector('p') ?? link.parentElement!) as HTMLElement;
    const holder = (para.contains(link) ? para : para.parentElement!) as HTMLElement;
    expect((holder.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe(`Aya and Bo want ${LYNX} · Find`);
    expect(matrix.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('progress-screen').textContent).not.toMatch(/discord-/);
  });

  it('Find opens Find (final URL: pview=find, no track) with the Wanted row expanded and its toggle focused', async () => {
    seedPage();
    renderAt('/?tab=progress&track=hot', LEAD);
    await screen.findByTestId('progress-expansion');
    const link = await waitFor(() => {
      const l = footerLink();
      expect(l).not.toBeNull();
      return l!;
    });
    fireEvent.click(link);
    await waitFor(() => expect(search().get('pview')).toBe('find'));
    expect(search().get('track')).toBeNull();
    const wantedRow = await rowIn('wanted', LYNX);
    await waitFor(() => expect(toggleOf(wantedRow)).toHaveAttribute('aria-expanded', 'true'));
    await waitFor(() => expect(document.activeElement).toBe(toggleOf(wantedRow)));
    const allRow = await rowIn('all', LYNX);
    expect(document.activeElement).not.toBe(toggleOf(allRow));
  });

  it('a viewer sees it', async () => {
    seedPage();
    renderAt('/?tab=progress', VIEWER);
    await loadedMatrix();
    await waitFor(() => expect(footerLink()).not.toBeNull());
  });

  it('names the first untracked wanted item, and is hidden when every wanted item is tracked', async () => {
    const twoWanted = [
      ...SUGGESTIONS,
      suggestion('cat-ew', 'Abyssal Steed', [apiMember('u2', 'hunting', 'missing')], 1),
    ];
    serve({ suggestions: async () => twoWanted });
    seedPage(undefined, [...DEFAULT_GOALS, goal('lynx-goal', { title: LYNX, catalogItemId: 'cat-lynx', status: 'farming' })]);
    renderAt('/?tab=progress', LEAD);
    await loadedMatrix();
    await waitFor(() => expect(footerLink('Abyssal Steed')).not.toBeNull());
    expect(footerLink()).toBeNull();

    fresh();
    seedPage(undefined, [...DEFAULT_GOALS, goal('lynx-goal', { title: LYNX, catalogItemId: 'cat-lynx', status: 'farming' })]);
    renderAt('/?tab=progress', LEAD);
    await loadedMatrix();
    await waitFor(() => expect(getsFrom(SUGGESTIONS_URL)).toBeGreaterThan(0));
    await waitFor(() => expect(useCollectionIntentStore.getState().suggestions.g1).toBeDefined());
    expect(footerLink()).toBeNull();
    expect(screen.queryByText(/want(s)? Lynx/)).toBeNull();
  });
});
