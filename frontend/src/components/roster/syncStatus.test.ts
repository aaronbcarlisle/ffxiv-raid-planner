import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isSyncStale, formatSyncLabel } from './syncStatus';

// isSyncStale/formatSyncLabel read Date.now(), so the clock is frozen for
// deterministic boundary checks around the 7-day STALE_MS threshold.
const NOW = '2026-07-03T12:00:00Z';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('isSyncStale', () => {
  it('returns true when lastSyncedAt is null (never synced)', () => {
    expect(isSyncStale(null)).toBe(true);
  });

  it('returns false just under the 7-day threshold', () => {
    const justUnder = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000 - 1)).toISOString();
    expect(isSyncStale(justUnder)).toBe(false);
  });

  it('returns false exactly at the 7-day threshold (strictly-greater-than comparison)', () => {
    const exactlyAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(isSyncStale(exactlyAt)).toBe(false);
  });

  it('returns true just over the 7-day threshold', () => {
    const justOver = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000 + 1)).toISOString();
    expect(isSyncStale(justOver)).toBe(true);
  });

  it('returns false for a timestamp seconds ago', () => {
    const recent = new Date(Date.now() - 5000).toISOString();
    expect(isSyncStale(recent)).toBe(false);
  });
});

describe('formatSyncLabel', () => {
  it('returns "No sync" when lastSyncedAt is null', () => {
    expect(formatSyncLabel(null, null)).toBe('No sync');
  });

  it('labels a sync under 1 hour ago as "recently"', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(formatSyncLabel(thirtyMinAgo, null)).toBe('Synced recently');
  });

  it('labels a sync several hours ago with an hour count', () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    expect(formatSyncLabel(fiveHoursAgo, null)).toBe('Synced 5h ago');
  });

  it('labels a sync several days ago with a day count', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatSyncLabel(threeDaysAgo, null)).toBe('Synced 3d ago');
  });

  it('uses the "Plugin" prefix when syncSource is "plugin"', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatSyncLabel(twoHoursAgo, 'plugin')).toBe('Plugin 2h ago');
  });

  it('uses the "Synced" prefix for any non-"plugin" syncSource, including null', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatSyncLabel(twoHoursAgo, 'manual')).toBe('Synced 2h ago');
    expect(formatSyncLabel(twoHoursAgo, null)).toBe('Synced 2h ago');
  });
});
