/**
 * S2a-4a·A2b TA2b — Find on the page (R-F-5 wiring; design E-5, E-6, D-4, D-10, §3.7, §3.8;
 * P-58, P-67; carried A2-M1, A2-M2).
 *
 * With `pview=find` the page's `<section aria-label="Find">` holds `FindList`, fed by the store's
 * catalog (`fetchCatalog` → `GET /api/collection-catalog`) and suggestions (`fetchSuggestions` →
 * `GET /api/static-groups/{id}/collection-suggestions`), both fetched when Find first opens and
 * never for a guest. Names come from the roster (`memberNames`), never the join's Discord name.
 * The api is mocked per URL, so the real store actions run.
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

import { FALLBACK_CATALOG } from '../../data/curatedCatalog';
import { api } from '../../services/api';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { useCollectionIntentStore } from '../../stores/collectionIntentStore';
import type { StaticGroup } from '../../types';
import { menuOf, pick, renderAt, search, seedPage, setUpPage, tearDownPage } from './__fixtures__/pageHarness';

// ── The server ──────────────────────────────────────────────────────────────

const CATALOG_URL = '/api/collection-catalog';
const SUGGESTIONS_URL = '/api/static-groups/g1/collection-suggestions';

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
    name: 'Lynx of Righteous Fire',
    source_duty_name: 'Worqor Lar Dor (Extreme)',
    source_duty_key: 'worqor',
    token_name: 'Valigarmanda Totem',
    token_cost: 99,
    game_mount_id: 312,
  }),
  apiCat('cat-ew', { name: 'Abyssal Steed', expansion: 'ew', source_duty_name: 'The Abyssal Fracture (Extreme)', source_duty_key: 'abyss' }),
];

const apiMember = (userId: string, intent: string | null, ownership: string, tokenCount: number | null) => ({
  user_id: userId,
  display_name: `discord-${userId}-handle`,
  ownership_state: ownership,
  intent,
  token_count: tokenCount,
  can_buy: false,
  confidence: 'high',
  reasons: [],
});

/** Lynx is wanted by Aya (37 tokens) and by u9, who is not on the roster (12 tokens); Bo has it. */
const SUGGESTIONS = [
  {
    catalog_item_id: 'cat-lynx',
    catalog_item_name: 'Lynx of Righteous Fire',
    catalog_item_category: 'mount',
    expansion: 'dt',
    source_duty_name: 'Worqor Lar Dor (Extreme)',
    source_type: 'extreme',
    static_goal_id: null,
    suggested_farm_score: 5,
    reason_summary: '',
    members: [apiMember('u1', 'hunting', 'missing', 37), apiMember('u2', null, 'have', null), apiMember('u9', 'hunting', 'missing', 12)],
  },
];

type Route = { catalog?: () => Promise<unknown>; suggestions?: () => Promise<unknown> };

function serve({ catalog = async () => CATALOG, suggestions = async () => SUGGESTIONS }: Route = {}) {
  vi.mocked(api.get).mockImplementation(async (url: string) => {
    if (url.startsWith(CATALOG_URL)) return catalog();
    if (url.startsWith(SUGGESTIONS_URL)) return suggestions();
    return [];
  });
}

const calls = (prefix: string) => vi.mocked(api.get).mock.calls.filter(([url]) => String(url).startsWith(prefix)).length;

/** The harness's static, with a roster that names u1 and u2. */
const ROSTER_GROUP = {
  id: 'g1',
  name: 'Dev Test Static',
  shareCode: 'DEVTST',
  settings: {},
  userRole: 'owner',
  members: [
    { userId: 'u1', role: 'owner', user: { id: 'u1', displayName: 'Aya', discordUsername: 'discord-u1-handle' } },
    { userId: 'u2', role: 'member', user: { id: 'u2', displayName: 'Bo', discordUsername: 'discord-u2-handle' } },
  ],
} as unknown as StaticGroup;

// ── Lookups ─────────────────────────────────────────────────────────────────

const findRegion = () => screen.getByRole('region', { name: 'Find' });
const wantedRegion = () => within(findRegion()).findByRole('region', { name: /^Wanted by your static/ });
const allRegion = () => within(findRegion()).findByRole('region', { name: /^All farm sources/ });
const viewButton = (name: 'Tracks' | 'Find') =>
  within(within(screen.getByTestId('progress-view-bar')).getByRole('group', { name: 'Progress view' })).getByRole('button', { name });

async function expandLynx(): Promise<HTMLElement> {
  const wanted = await wantedRegion();
  const toggle = await within(wanted).findByRole('button', { name: 'Show details for Lynx of Righteous Fire' });
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'true'));
  return document.getElementById(toggle.getAttribute('aria-controls')!)!;
}

function resetStores() {
  useCollectionGoalStore.setState({ catalog: [], catalogLoaded: false, catalogLoading: false, catalogError: null });
  useCollectionIntentStore.setState({ suggestions: {}, suggestionsLoading: {}, suggestionsError: {} });
}

beforeEach(() => {
  setUpPage();
  Element.prototype.scrollIntoView = vi.fn();
  resetStores();
  serve();
});

afterEach(() => {
  tearDownPage();
  resetStores();
});

// ── The list on the page ────────────────────────────────────────────────────

describe('Find shows the list', () => {
  it('fills the Find section from the catalog and the suggestions, with their counts', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', { group: ROSTER_GROUP });
    expect(await within(findRegion()).findByRole('region', { name: 'Wanted by your static (1)' })).toBeInTheDocument();
    expect(await within(findRegion()).findByRole('region', { name: 'All farm sources (2)' })).toBeInTheDocument();
    expect(within(findRegion()).getByLabelText('Search farms')).toBeInTheDocument();
    expect(calls(CATALOG_URL)).toBeGreaterThan(0);
    expect(calls(SUGGESTIONS_URL)).toBeGreaterThan(0);
  });

  it('search filters the list on the page, and Clear search brings it back', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', { group: ROSTER_GROUP });
    await within(findRegion()).findByRole('region', { name: 'All farm sources (2)' });
    fireEvent.change(within(findRegion()).getByLabelText('Search farms'), { target: { value: 'abyssal' } });
    expect(await within(findRegion()).findByRole('region', { name: 'All farm sources (1)' })).toBeInTheDocument();
    fireEvent.click(within(findRegion()).getByRole('button', { name: 'Clear search' }));
    expect(await within(findRegion()).findByRole('region', { name: 'All farm sources (2)' })).toBeInTheDocument();
  });

  it('fetches the catalog when Find first opens, not in Tracks', async () => {
    seedPage();
    renderAt('/?tab=progress', { group: ROSTER_GROUP });
    await screen.findAllByTestId('progress-farm-row');
    expect(calls(CATALOG_URL)).toBe(0);
    fireEvent.click(viewButton('Find'));
    await waitFor(() => expect(calls(CATALOG_URL)).toBe(1));
    await within(findRegion()).findByRole('region', { name: 'All farm sources (2)' });
  });
});

// ── The row body on the page (P-58, S-2) ────────────────────────────────────

describe('a row\'s body on the page', () => {
  it('a member reads every member\'s state by roster name, with counts; "A member" for u9', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', { group: ROSTER_GROUP, userRole: 'member', canManage: false });
    const body = await expandLynx();
    expect(body).toHaveTextContent(/Aya: Want/);
    expect(body).toHaveTextContent(/Bo: Have/);
    expect(body).toHaveTextContent(/A member: Want/);
    expect(body).toHaveTextContent(/(?<!\d)37(?!\d)/);
    expect(body).toHaveTextContent(/(?<!\d)12(?!\d)/);
  });

  it('a viewer browses the list and reads the states with no counts', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', { group: ROSTER_GROUP, userRole: 'viewer', canManage: false });
    expect(await within(findRegion()).findByRole('region', { name: 'All farm sources (2)' })).toBeInTheDocument();
    const body = await expandLynx();
    expect(body).toHaveTextContent(/Aya: Want/);
    expect(body.textContent).not.toMatch(/(?<!\d)37(?!\d)/);
    expect(body.textContent).not.toMatch(/(?<!\d)12(?!\d)/);
  });

  it('never renders a Discord name from the join', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', { group: ROSTER_GROUP });
    await expandLynx();
    expect(screen.getByTestId('progress-screen').textContent).not.toMatch(/discord-/);
  });
});

// ── Failures (E-5, P-67) ────────────────────────────────────────────────────

describe('failures', () => {
  it('a catalog error shows the built-in fallback items and a Retry that refetches', async () => {
    serve({ catalog: () => Promise.reject(new Error('catalog down')) });
    seedPage();
    renderAt('/?tab=progress&pview=find', { group: ROSTER_GROUP });
    const all = await allRegion();
    expect(await within(all).findByRole('button', { name: `Show details for ${FALLBACK_CATALOG[0].name}` })).toBeInTheDocument();
    const before = calls(CATALOG_URL);
    const retry = within(findRegion())
      .getAllByRole('button', { name: /Retry/ })
      .find((b) => !(within(findRegion()).queryByRole('region', { name: /^Wanted by your static/ })?.contains(b) ?? false));
    expect(retry).toBeDefined();
    serve();
    fireEvent.click(retry!);
    await waitFor(() => expect(calls(CATALOG_URL)).toBe(before + 1));
    expect(await within(findRegion()).findByRole('region', { name: 'All farm sources (2)' })).toBeInTheDocument();
  });

  it('a suggestions error shows the inline error and a Retry that refetches; All still lists the catalog', async () => {
    serve({ suggestions: () => Promise.reject(new Error('suggestions down')) });
    seedPage();
    renderAt('/?tab=progress&pview=find', { group: ROSTER_GROUP });
    const wanted = await wantedRegion();
    const retry = await within(wanted).findByRole('button', { name: /Retry/ });
    expect(await within(findRegion()).findByRole('region', { name: 'All farm sources (2)' })).toBeInTheDocument();
    const before = calls(SUGGESTIONS_URL);
    serve();
    fireEvent.click(retry);
    await waitFor(() => expect(calls(SUGGESTIONS_URL)).toBe(before + 1));
    expect(await within(findRegion()).findByRole('region', { name: 'Wanted by your static (1)' })).toBeInTheDocument();
  });

  it('Tracks\' "Loading farms…" line does not show in Find (A2-M2)', async () => {
    seedPage(undefined, undefined, { ready: false });
    renderAt('/?tab=progress&pview=find', { group: ROSTER_GROUP });
    await within(findRegion()).findByLabelText('Search farms');
    expect(screen.queryByTestId('progress-loading')).not.toBeInTheDocument();
  });

  it('Tracks\' "Couldn\'t load farms" line and its Retry do not show in Find (A2-M2)', async () => {
    seedPage(undefined, undefined, { ready: false });
    useCollectionGoalStore.setState({ error: 'goals down' });
    renderAt('/?tab=progress&pview=find', { group: ROSTER_GROUP });
    await within(findRegion()).findByLabelText('Search farms');
    expect(screen.queryByTestId('progress-error')).not.toBeInTheDocument();
    expect(screen.queryByText(/Couldn't load farms/)).not.toBeInTheDocument();
  });
});

// ── Guests (E-6, D-11) ──────────────────────────────────────────────────────

describe('guests', () => {
  it('a member\'s Find fetches the catalog and suggestions; a guest\'s triggers neither', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', { group: ROSTER_GROUP, userRole: 'member', canManage: false });
    await waitFor(() => expect(calls(CATALOG_URL)).toBeGreaterThan(0));
    await waitFor(() => expect(calls(SUGGESTIONS_URL)).toBeGreaterThan(0));

    cleanup();
    tearDownPage();
    resetStores();
    setUpPage();
    serve();
    seedPage();
    renderAt('/?tab=progress&pview=find', { group: ROSTER_GROUP, userRole: null, canManage: false, currentUserId: null });
    await screen.findByTestId('progress-screen');
    expect(calls(CATALOG_URL)).toBe(0);
    expect(calls(SUGGESTIONS_URL)).toBe(0);
  });
});

// ── Focus after Discard (A2-M1) ─────────────────────────────────────────────

describe('focus after Discard on the way to Find (A2-M1)', () => {
  async function dirtyEdit() {
    seedPage();
    renderAt('/?tab=progress&track=hot', { group: ROSTER_GROUP });
    await screen.findByTestId('progress-expansion');
    fireEvent.click(menuOf('Hot Farm'));
    pick('Edit');
    const block = await screen.findByTestId('progress-edit-block');
    fireEvent.change(within(block).getByRole('textbox', { name: 'Notes' }), { target: { value: 'Edited notes' } });
  }

  /** As a reader does it: focus has moved into the dialog, then Discard is pressed (and so focused). */
  async function discardFromDialog() {
    const dialog = screen.getByRole('dialog', { name: 'Discard changes?' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    const discard = within(dialog).getByRole('button', { name: 'Discard' });
    discard.focus();
    fireEvent.click(discard);
  }

  it('returns focus to the Find switch button', async () => {
    await dirtyEdit();
    viewButton('Find').focus();
    fireEvent.click(viewButton('Find'));
    await discardFromDialog();
    await waitFor(() => expect(search().get('pview')).toBe('find'));
    await waitFor(() => expect(viewButton('Find')).toHaveFocus());
  });

  it('returns focus to Track a farm', async () => {
    await dirtyEdit();
    const track = within(screen.getByTestId('progress-view-bar')).getByRole('button', { name: 'Track a farm' });
    track.focus();
    fireEvent.click(track);
    await discardFromDialog();
    await waitFor(() => expect(search().get('pview')).toBe('find'));
    await waitFor(() => expect(within(findRegion()).getByLabelText('Search farms')).toHaveFocus());
  });
});
