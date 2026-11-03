/**
 * S2a-4a TA1 (R-F-2, E-5): `suggestionsError[groupId]` is set on a failed
 * `fetchSuggestions` and cleared by a later success. Additive only: the
 * action keeps its signature, still swallows errors, and leaves the cached
 * `suggestions` alone on failure.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import { useCollectionIntentStore, type StaticCollectionSuggestion } from './collectionIntentStore';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      patch: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

const apiRow = {
  catalog_item_id: 'cat-1',
  catalog_item_name: 'Lynx of Righteous Fire',
  catalog_item_category: 'mount',
  expansion: 'dt',
  source_duty_name: 'Worqor Lar Dor (Extreme)',
  source_type: 'extreme',
  static_goal_id: null,
  suggested_farm_score: 3,
  reason_summary: '1 member hunting',
  members: [
    {
      user_id: 'u1', display_name: 'aria', ownership_state: 'missing', intent: 'hunting',
      token_count: 4, can_buy: false, confidence: 'high', reasons: ['Hunting'],
    },
  ],
};

const cached: StaticCollectionSuggestion = {
  catalogItemId: 'cat-old',
  catalogItemName: 'Old Mount',
  catalogItemCategory: 'mount',
  expansion: 'ew',
  sourceDutyName: 'Old Duty',
  sourceType: 'extreme',
  staticGoalId: null,
  suggestedFarmScore: 1,
  reasonSummary: '',
  members: [],
};

type ErrorMap = Record<string, string | null | undefined>;
const errorMap = () =>
  (useCollectionIntentStore.getState() as unknown as { suggestionsError?: ErrorMap }).suggestionsError;

describe('collectionIntentStore.suggestionsError', () => {
  afterEach(() => {
    useCollectionIntentStore.setState({
      suggestions: {},
      suggestionsLoading: {},
      suggestionsError: {},
    } as never);
    vi.clearAllMocks();
  });

  it('starts as an empty map', () => {
    expect(errorMap()).toEqual({});
  });

  it('sets suggestionsError[groupId] to the error message on failure, and fetchSuggestions still resolves', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Boom: 500 $1 "quoted" \\n'));

    await expect(useCollectionIntentStore.getState().fetchSuggestions('group-1')).resolves.toBeUndefined();

    expect(errorMap()?.['group-1']).toBe('Boom: 500 $1 "quoted" \\n');
    expect(useCollectionIntentStore.getState().suggestionsLoading['group-1']).toBe(false);
  });

  it('sets a non-empty message when the rejection is not an Error', async () => {
    vi.mocked(api.get).mockRejectedValueOnce('nope');

    await useCollectionIntentStore.getState().fetchSuggestions('group-1');

    const msg = errorMap()?.['group-1'];
    expect(typeof msg).toBe('string');
    expect((msg as string).length).toBeGreaterThan(0);
  });

  it('leaves the cached suggestions untouched on failure', async () => {
    useCollectionIntentStore.setState({ suggestions: { 'group-1': [cached] } });
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Boom'));

    await useCollectionIntentStore.getState().fetchSuggestions('group-1');

    expect(errorMap()?.['group-1']).toBe('Boom');
    expect(useCollectionIntentStore.getState().suggestions['group-1']).toEqual([cached]);
  });

  it('a later success clears the error and stores the rows', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Boom'));
    await useCollectionIntentStore.getState().fetchSuggestions('group-1');
    expect(errorMap()?.['group-1']).toBe('Boom');

    vi.mocked(api.get).mockResolvedValueOnce([apiRow]);
    await useCollectionIntentStore.getState().fetchSuggestions('group-1');

    expect(errorMap()?.['group-1'] ?? null).toBeNull();
    const rows = useCollectionIntentStore.getState().suggestions['group-1'];
    expect(rows).toHaveLength(1);
    expect(rows[0].catalogItemId).toBe('cat-1');
  });

  it('keys the error per static: one failure does not touch another static', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([apiRow]);
    await useCollectionIntentStore.getState().fetchSuggestions('group-2');
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Boom'));
    await useCollectionIntentStore.getState().fetchSuggestions('group-1');

    expect(errorMap()?.['group-1']).toBe('Boom');
    expect(errorMap()?.['group-2'] ?? null).toBeNull();
    expect(useCollectionIntentStore.getState().suggestions['group-2']).toHaveLength(1);
  });

  it('a second static\'s failure keeps the first static\'s message (A1-M2)', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Boom two'));
    await useCollectionIntentStore.getState().fetchSuggestions('group-2');
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Boom one'));
    await useCollectionIntentStore.getState().fetchSuggestions('group-1');

    expect(errorMap()?.['group-1']).toBe('Boom one');
    expect(errorMap()?.['group-2']).toBe('Boom two');
  });
});
