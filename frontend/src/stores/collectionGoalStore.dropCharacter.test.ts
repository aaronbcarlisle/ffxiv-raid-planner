/**
 * The drop's character (S2a-3a·G1 Task 2, R-S3-12): `recipient_character_name` maps
 * to `recipientCharacterName`, and a response without it maps to null. Kept apart from
 * `collectionGoalStore.test.ts`, which stays unedited as a V1 pin.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import { useCollectionGoalStore } from './collectionGoalStore';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return { ...actual, api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const apiDrop = {
  id: 'd1', goal_id: 'goal-1', static_group_id: 'group-1', recipient_user_id: 'u1',
  created_by_id: 'u2', quantity: 1, dropped_at: '2026-09-30T00:00:00Z', notes: null,
  created_at: '2026-09-30T00:00:00Z', recipient_display_name: 'Aria',
};

describe('fromApiDrop: recipient character', () => {
  afterEach(() => {
    useCollectionGoalStore.setState({ drops: {} });
    vi.clearAllMocks();
  });

  it('maps recipient_character_name, and null when the response omits or nulls it', async () => {
    vi.mocked(api.get).mockResolvedValue([
      { ...apiDrop, id: 'd1', recipient_character_name: 'Aria Windfall' },
      { ...apiDrop, id: 'd2', recipient_character_name: null },
      { ...apiDrop, id: 'd3' },
    ]);

    await useCollectionGoalStore.getState().fetchDrops('group-1', 'goal-1');

    const drops = useCollectionGoalStore.getState().drops['goal-1'];
    expect(drops.map((d) => d.recipientCharacterName)).toEqual(['Aria Windfall', null, null]);
  });
});
