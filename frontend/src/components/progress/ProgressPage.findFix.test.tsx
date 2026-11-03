/**
 * S2a-4a·A3 TA3 fix wave — the page's half (A2-M3 `?edit`; D-8; E-4; R-F-6):
 *
 * - `?edit` is the URL's: a foreign `?edit` (one that is not `?track`) is dropped, and a deep link
 *   `?track=X&edit=X` opens the row with Edit on and its Title focused;
 * - a custom create clears the search, so a return to Find does not offer the same text again (the
 *   route has no duplicate check, E-4);
 * - after a successful I want this, and after Share, the control that is gone hands focus to the
 *   row's toggle, never <body>.
 *
 * The api is mocked per URL, so the real store actions run.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { useCollectionIntentStore } from '../../stores/collectionIntentStore';
import type { StaticGroup } from '../../types';
import { farmEditTitleId } from './farmFocus';
import { renderAt, search, seedPage, setUpPage, tearDownPage, trackOf } from './__fixtures__/pageHarness';
import { apiGoal } from './__fixtures__/progressFixtures';

// ── The server ──────────────────────────────────────────────────────────────

const CATALOG_URL = '/api/collection-catalog';
const SUGGESTIONS_URL = '/api/static-groups/g1/collection-suggestions';
const INTENTS_URL = '/api/me/collection-intent';
const CREATE_URL = '/api/static-groups/g1/collection-goals';
const LYNX = 'Lynx of Righteous Fire';

const CATALOG = [
  {
    id: 'cat-lynx',
    external_source: 'ffxivcollect',
    external_id: null,
    name: LYNX,
    category: 'mount',
    expansion: 'dt',
    patch: '7.0',
    icon_url: null,
    image_url: null,
    source_text: null,
    source_type: 'extreme',
    source_duty_name: 'Worqor Lar Dor (Extreme)',
    source_duty_key: 'worqor',
    token_name: 'Valigarmanda Totem',
    token_cost: 99,
    token_item_id: null,
    game_mount_id: null,
    tradeable: false,
    rarity_owned_percent: null,
    is_curated: true,
    notes: null,
  },
];

const member = (userId: string) => ({
  user_id: userId,
  display_name: `discord-${userId}`,
  ownership_state: 'missing',
  intent: 'hunting',
  token_count: 3,
  can_buy: false,
  confidence: 'high',
  reasons: [],
});

const SUGGESTIONS = [
  {
    catalog_item_id: 'cat-lynx',
    catalog_item_name: LYNX,
    catalog_item_category: 'mount',
    expansion: 'dt',
    source_duty_name: 'Worqor Lar Dor (Extreme)',
    source_type: 'extreme',
    static_goal_id: null,
    suggested_farm_score: 5,
    reason_summary: '',
    members: [member('u1'), member('u2')],
  },
];

type ApiIntentRow = { intent: string; priority: string; visibility: string; notes: string | null };
const apiIntent = (catalogItemId: string, row: ApiIntentRow) => ({
  id: `intent-${catalogItemId}`,
  profile_id: 'profile-u2',
  catalog_item_id: catalogItemId,
  updated_at: '2026-10-01T00:00:00Z',
  ...row,
});

function serve(intents: () => Promise<unknown> = async () => []) {
  vi.mocked(api.get).mockImplementation(async (url: string) => {
    if (url.startsWith(CATALOG_URL)) return CATALOG;
    if (url.startsWith(SUGGESTIONS_URL)) return SUGGESTIONS;
    if (url === INTENTS_URL) return intents();
    return [];
  });
  vi.mocked(api.post).mockImplementation(async (url: string, body?: unknown) => {
    const b = body as Record<string, unknown>;
    if (url === CREATE_URL) return apiGoal('new-custom', { goal_type: 'custom_reward', title: b.title });
    return {};
  });
  vi.mocked(api.put).mockImplementation(async (url: string, body?: unknown) => apiIntent(url.slice(`${INTENTS_URL}/`.length), body as ApiIntentRow));
}

const posts = (url: string) => vi.mocked(api.post).mock.calls.filter(([u]) => u === url);

const GROUP = {
  id: 'g1',
  name: 'Dev Test Static',
  shareCode: 'DEVTST',
  settings: {},
  userRole: 'owner',
  members: [
    { userId: 'u1', role: 'owner', user: { id: 'u1', displayName: 'Aya', discordUsername: 'discord-u1' } },
    { userId: 'u2', role: 'member', user: { id: 'u2', displayName: 'Bo', discordUsername: 'discord-u2' } },
  ],
} as unknown as StaticGroup;

const LEAD = { group: GROUP } as const;
const MEMBER = { group: GROUP, userRole: 'member', canManage: false, currentUserId: 'u2' } as const;

// ── Lookups ─────────────────────────────────────────────────────────────────

const findRegion = () => screen.getByRole('region', { name: 'Find' });
const searchBox = () => within(findRegion()).getByLabelText('Search farms') as HTMLInputElement;
const viewButton = (name: 'Tracks' | 'Find') =>
  within(within(screen.getByTestId('progress-view-bar')).getByRole('group', { name: 'Progress view' })).getByRole('button', { name });
async function wantedRow(): Promise<HTMLElement> {
  const wanted = await within(findRegion()).findByRole('region', { name: /^Wanted by your static/ });
  const toggle = await within(wanted).findByRole('button', { name: `Show details for ${LYNX}` });
  return toggle.closest('[data-testid="find-row"]') as HTMLElement;
}
const toggleOf = (row: HTMLElement) => within(row).getByRole('button', { name: `Show details for ${LYNX}` });
const PROMPT = 'Your want is private. Share it with your statics?';

/** As a reader does it: focus the control, then press it. */
function press(el: HTMLElement) {
  el.focus();
  fireEvent.click(el);
}

function resetStores() {
  useCollectionGoalStore.setState({ catalog: [], catalogLoaded: false, catalogLoading: false, catalogError: null });
  useCollectionIntentStore.setState({ suggestions: {}, suggestionsLoading: {}, suggestionsError: {}, myIntents: {}, myIntentsLoaded: false });
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

// ── ?edit (A2-M3) ───────────────────────────────────────────────────────────

describe('?edit is the URL\'s (A2-M3)', () => {
  it('a foreign ?edit (not the open row) is dropped, the row stays open and no block shows', async () => {
    seedPage();
    renderAt('/?tab=progress&track=hot&edit=calm', LEAD);
    await screen.findByTestId('progress-expansion');
    await waitFor(() => expect(search().get('edit')).toBeNull());
    expect(trackOf()).toBe('hot');
    expect(screen.queryByTestId('progress-edit-block')).not.toBeInTheDocument();
  });

  it('a deep link ?track=X&edit=X opens the row with Edit on and the Title focused', async () => {
    seedPage();
    renderAt('/?tab=progress&track=hot&edit=hot', LEAD);
    const block = await screen.findByTestId('progress-edit-block');
    await waitFor(() => expect(document.activeElement?.id).toBe(farmEditTitleId('hot')));
    expect(within(block).getByRole('textbox', { name: 'Title' })).toHaveValue('Hot Farm');
    expect(search().get('edit')).toBe('hot');
    expect(trackOf()).toBe('hot');
  });
});

// ── The custom row clears the search (D-8, E-4) ─────────────────────────────

describe('a custom create clears the search', () => {
  it('back in Find the search is empty, the muted line shows and nothing offers the same text again', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', LEAD);
    await wantedRow();
    fireEvent.change(searchBox(), { target: { value: 'Test custom' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Track "Test custom" as a custom farm' }));
    await waitFor(() => expect(search().get('edit')).toBe('new-custom'));
    await waitFor(() => expect(document.activeElement?.id).toBe(farmEditTitleId('new-custom')));

    fireEvent.click(viewButton('Find'));
    await waitFor(() => expect(search().get('pview')).toBe('find'));
    await wantedRow();
    expect(searchBox().value).toBe('');
    expect(await within(findRegion()).findByText('Type a name to track a custom farm')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as a custom farm$/ })).toBeNull();
    expect(posts(CREATE_URL)).toHaveLength(1);
  });
});

// ── Focus after a write (R-F-6) ─────────────────────────────────────────────

describe('focus after a write', () => {
  it('after a successful I want this (no row) focus lands on the row\'s toggle, never <body>', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', MEMBER);
    const row = await wantedRow();
    press(await within(row).findByRole('button', { name: /I want this/ }));
    expect(await within(row).findByText('Wanted ✓')).toBeInTheDocument();
    await waitFor(() => expect(toggleOf(row)).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });

  it('after Share on a private row focus lands on the row\'s toggle, never <body>', async () => {
    serve(async () => [apiIntent('cat-lynx', { intent: 'interested', priority: 'high', visibility: 'private', notes: 'mine' })]);
    seedPage();
    renderAt('/?tab=progress&pview=find', MEMBER);
    const row = await wantedRow();
    press(await within(row).findByRole('button', { name: /I want this/ }));
    expect(await within(row).findByText(PROMPT)).toBeInTheDocument();
    press(within(row).getByRole('button', { name: 'Share' }));
    expect(await within(row).findByText('Wanted ✓')).toBeInTheDocument();
    await waitFor(() => expect(toggleOf(row)).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });
});
