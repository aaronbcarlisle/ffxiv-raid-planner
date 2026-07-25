import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import { useLootTrackingStore } from './lootTrackingStore';

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

function resetLootTrackingStore() {
  useLootTrackingStore.setState({
    currentWeek: 1,
    maxWeek: 1,
    weekStartDate: null,
    error: null,
  });
}

describe('lootTrackingStore week mutations', () => {
  afterEach(() => {
    resetLootTrackingStore();
    vi.clearAllMocks();
  });

  it('startNextWeek writes the shifted weekStartDate from the response', async () => {
    vi.mocked(api.post).mockResolvedValue({
      currentWeek: 2,
      weekStartDate: '2026-07-08T00:00:00Z',
    });
    // Secondary current-week refetch — allowed to resolve independently.
    vi.mocked(api.get).mockResolvedValue({ currentWeek: 2, maxWeek: 2 });

    await useLootTrackingStore.getState().startNextWeek('group-1', 'tier-1');

    expect(useLootTrackingStore.getState().weekStartDate).toBe('2026-07-08T00:00:00Z');
    expect(useLootTrackingStore.getState().currentWeek).toBe(2);
  });

  it('revertWeek writes the shifted weekStartDate from the response', async () => {
    vi.mocked(api.post).mockResolvedValue({
      currentWeek: 1,
      weekStartDate: '2026-07-01T00:00:00Z',
    });
    vi.mocked(api.get).mockResolvedValue({ currentWeek: 1, maxWeek: 2 });

    await useLootTrackingStore.getState().revertWeek('group-1', 'tier-1');

    expect(useLootTrackingStore.getState().weekStartDate).toBe('2026-07-01T00:00:00Z');
    expect(useLootTrackingStore.getState().currentWeek).toBe(1);
  });
});
