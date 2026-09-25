import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import { useLootTrackingStore, weekClockKeyOf } from './lootTrackingStore';

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
    weekClockKey: null,
    error: null,
  });
}

/** Every store notification's clock, in order — pins how many `set`s an
 *  action makes and what each one wrote together. */
function recordClock() {
  const seen: Array<{ currentWeek: number; maxWeek: number; weekClockKey: string | null }> = [];
  const unsubscribe = useLootTrackingStore.subscribe(({ currentWeek, maxWeek, weekClockKey }) => {
    seen.push({ currentWeek, maxWeek, weekClockKey });
  });
  return { seen, unsubscribe };
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

// R-DC-E: "the clock is resolved" means a successful server response wrote
// THIS (static, tier)'s week values. The key rides in the same `set` as
// `currentWeek` — a second `set` would be a second render of every
// whole-store subscriber (V1's GroupViewContent among them).
describe('lootTrackingStore week clock key (R-DC-E)', () => {
  afterEach(() => {
    resetLootTrackingStore();
    vi.clearAllMocks();
  });

  it('S-1: a successful fetchCurrentWeek keys the clock in the same set as its week values', async () => {
    // 7/9, not the store's 1/1 start, so a stale value can't pass for a fresh one.
    vi.mocked(api.get).mockResolvedValue({ currentWeek: 7, maxWeek: 9, weekStartDate: null });
    const { seen, unsubscribe } = recordClock();

    await useLootTrackingStore.getState().fetchCurrentWeek('group-1', 'tier-1');
    unsubscribe();

    expect(useLootTrackingStore.getState().weekClockKey).toBe(weekClockKeyOf('group-1', 'tier-1'));
    // Fetch start (loading flag, key untouched), then ONE success set.
    expect(seen).toEqual([
      { currentWeek: 1, maxWeek: 1, weekClockKey: null },
      { currentWeek: 7, maxWeek: 9, weekClockKey: weekClockKeyOf('group-1', 'tier-1') },
    ]);
  });

  it('S-2: a failed fetch for another tier leaves the key naming the tier that last succeeded', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ currentWeek: 4, maxWeek: 4 });
    await useLootTrackingStore.getState().fetchCurrentWeek('group-1', 'tier-A');

    vi.mocked(api.get).mockRejectedValueOnce(new Error('network down'));
    await expect(
      useLootTrackingStore.getState().fetchCurrentWeek('group-1', 'tier-B'),
    ).rejects.toThrow('network down');

    const state = useLootTrackingStore.getState();
    expect(state.weekClockKey).toBe(weekClockKeyOf('group-1', 'tier-A'));
    expect(state.currentWeek).toBe(4);
  });

  it('S-3: clearLootTracking resets the key to null', async () => {
    vi.mocked(api.get).mockResolvedValue({ currentWeek: 3, maxWeek: 3 });
    await useLootTrackingStore.getState().fetchCurrentWeek('group-1', 'tier-1');
    expect(useLootTrackingStore.getState().weekClockKey).toBe(weekClockKeyOf('group-1', 'tier-1'));

    useLootTrackingStore.getState().clearLootTracking();

    expect(useLootTrackingStore.getState().weekClockKey).toBeNull();
  });

  it.each([
    ['startNextWeek', 4],
    ['revertWeek', 2],
  ] as const)('S-4: a successful %s keys the clock to its own tier, with its currentWeek', async (action, newWeek) => {
    // The clock was last resolved for ANOTHER tier, at week 3.
    useLootTrackingStore.setState({
      currentWeek: 3,
      maxWeek: 3,
      weekClockKey: weekClockKeyOf('group-1', 'tier-A'),
    });
    vi.mocked(api.post).mockResolvedValue({ currentWeek: newWeek, weekStartDate: null });
    vi.mocked(api.get).mockResolvedValue({ currentWeek: newWeek, maxWeek: 5 });
    const { seen, unsubscribe } = recordClock();

    await useLootTrackingStore.getState()[action]('group-1', 'tier-B');
    unsubscribe();

    const keyB = weekClockKeyOf('group-1', 'tier-B');
    expect(useLootTrackingStore.getState().weekClockKey).toBe(keyB);
    expect(useLootTrackingStore.getState().currentWeek).toBe(newWeek);
    // No notified state pairs tier B's week with tier A's key, or the reverse.
    expect(seen.every((s) => (s.currentWeek === newWeek) === (s.weekClockKey === keyB))).toBe(true);
  });
});
