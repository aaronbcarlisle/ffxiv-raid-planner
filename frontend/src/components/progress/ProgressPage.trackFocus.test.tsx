/**
 * S2a-4a·A3 TA3 — where focus lands after Track (design §3.3 step 4): the new row opens in Tracks
 * and its name button (the row's toggle) takes focus, never <body>, so a keyboard user carries on
 * from the row Track just opened. The custom row is the other way round (its Title takes focus,
 * `ProgressPage.findActions.test.tsx`), so Track's focus never lands on a name when Edit is on.
 *
 * The api is mocked per URL, so the real `createGoalFromSuggestion` runs over it.
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
import { nameOf, renderAt, search, seedPage, setUpPage, tearDownPage } from './__fixtures__/pageHarness';
import { apiGoal } from './__fixtures__/progressFixtures';

const CATALOG_URL = '/api/collection-catalog';
const SUGGESTIONS_URL = '/api/static-groups/g1/collection-suggestions';
const FROM_SUGGESTION_URL = '/api/static-groups/g1/collection-goals/from-suggestion';
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
    members: [{ user_id: 'u1', display_name: 'discord-u1', ownership_state: 'missing', intent: 'hunting', token_count: 3, can_buy: false, confidence: 'high', reasons: [] }],
  },
];

const GROUP = {
  id: 'g1',
  name: 'Dev Test Static',
  shareCode: 'DEVTST',
  settings: {},
  userRole: 'owner',
  members: [{ userId: 'u1', role: 'owner', user: { id: 'u1', displayName: 'Aya', discordUsername: 'discord-u1' } }],
} as unknown as StaticGroup;

const findRegion = () => screen.getByRole('region', { name: 'Find' });
const wantedRegion = async () => within(findRegion()).findByRole('region', { name: /^Wanted by your static/ });

beforeEach(() => {
  setUpPage();
  Element.prototype.scrollIntoView = vi.fn();
  useCollectionGoalStore.setState({ catalog: [], catalogLoaded: false, catalogLoading: false, catalogError: null });
  useCollectionIntentStore.setState({ suggestions: {}, suggestionsLoading: {}, suggestionsError: {} });
  vi.mocked(api.get).mockImplementation(async (url: string) => {
    if (url.startsWith(CATALOG_URL)) return CATALOG;
    if (url.startsWith(SUGGESTIONS_URL)) return SUGGESTIONS;
    return [];
  });
  vi.mocked(api.post).mockImplementation(async (url: string, body?: unknown) => {
    const b = body as Record<string, unknown>;
    if (url === FROM_SUGGESTION_URL) return apiGoal('new-lynx', { catalog_item_id: b.catalog_item_id, title: LYNX });
    if (url === CREATE_URL) return apiGoal('new-custom', { goal_type: 'custom_reward', title: b.title });
    return {};
  });
});

afterEach(() => {
  tearDownPage();
  useCollectionGoalStore.setState({ catalog: [], catalogLoaded: false, catalogLoading: false, catalogError: null });
  useCollectionIntentStore.setState({ suggestions: {}, suggestionsLoading: {}, suggestionsError: {} });
});

describe('focus after Track (§3.3 step 4)', () => {
  it("lands on the new row's name button in Tracks, never on <body>", async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', { group: GROUP });
    const wanted = await wantedRegion();
    const track = await within(wanted).findByRole('button', { name: /^Track\b/ });
    track.focus();
    fireEvent.click(track);
    await waitFor(() => expect(search().get('track')).toBe('new-lynx'));
    await waitFor(() => expect(nameOf('new-lynx')).toHaveFocus());
    expect(nameOf('new-lynx')).toHaveAttribute('aria-expanded', 'true');
    expect(document.body).not.toHaveFocus();
  });

  it('the custom row leaves focus on the Title of its Edit block, not on the row name', async () => {
    seedPage();
    renderAt('/?tab=progress&pview=find', { group: GROUP });
    await wantedRegion();
    fireEvent.change(within(findRegion()).getByLabelText('Search farms'), { target: { value: 'Foo' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Track "Foo" as a custom farm' }));
    await waitFor(() => expect(search().get('edit')).toBe('new-custom'));
    await waitFor(() => expect(document.activeElement?.id).toBe(farmEditTitleId('new-custom')));
    expect(nameOf('new-custom')).not.toHaveFocus();
  });
});
