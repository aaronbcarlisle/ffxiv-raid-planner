import { describe, it, expect } from 'vitest';
import { getFreshness, formatSyncAge, freshnessColor, formatSource } from './freshness';

describe('getFreshness', () => {
  it('returns none for null', () => {
    expect(getFreshness(null)).toBe('none');
  });

  it('returns fresh for recent sync', () => {
    const now = new Date().toISOString();
    expect(getFreshness(now)).toBe('fresh');
  });

  it('returns recent for 3-day-old sync', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400_000).toISOString();
    expect(getFreshness(threeDaysAgo)).toBe('recent');
  });

  it('returns stale for 14-day-old sync', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400_000).toISOString();
    expect(getFreshness(twoWeeksAgo)).toBe('stale');
  });

  it('returns old for 60-day-old sync', () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 86400_000).toISOString();
    expect(getFreshness(twoMonthsAgo)).toBe('old');
  });
});

describe('formatSyncAge', () => {
  it('returns Never synced for null', () => {
    expect(formatSyncAge(null)).toBe('Never synced');
  });

  it('returns Synced just now for recent', () => {
    const now = new Date().toISOString();
    expect(formatSyncAge(now)).toBe('Synced just now');
  });

  it('returns hours format for same-day sync', () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 3600_000).toISOString();
    expect(formatSyncAge(fiveHoursAgo)).toBe('Synced 5h ago');
  });

  it('returns yesterday for 1-day-old sync', () => {
    const yesterday = new Date(Date.now() - 1.5 * 86400_000).toISOString();
    expect(formatSyncAge(yesterday)).toBe('Synced yesterday');
  });

  it('returns days format for multi-day sync', () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86400_000).toISOString();
    expect(formatSyncAge(fourDaysAgo)).toBe('Synced 4 days ago');
  });

  it('returns weeks format for 2+ week sync', () => {
    const twoWeeksAgo = new Date(Date.now() - 15 * 86400_000).toISOString();
    expect(formatSyncAge(twoWeeksAgo)).toBe('Synced 2 weeks ago');
  });

  it('returns months format for 2+ month sync', () => {
    const twoMonthsAgo = new Date(Date.now() - 65 * 86400_000).toISOString();
    expect(formatSyncAge(twoMonthsAgo)).toBe('Synced 2 months ago');
  });
});

describe('freshnessColor', () => {
  it('returns success for fresh', () => {
    expect(freshnessColor('fresh')).toBe('text-status-success');
  });

  it('returns warning for stale', () => {
    expect(freshnessColor('stale')).toBe('text-status-warning');
  });

  it('returns error for old', () => {
    expect(freshnessColor('old')).toBe('text-status-error');
  });

  it('returns tertiary for none', () => {
    expect(freshnessColor('none')).toBe('text-text-tertiary');
  });
});

describe('formatSource', () => {
  it('formats plugin source', () => {
    expect(formatSource('plugin')).toBe('Plugin sync');
  });

  it('formats roster_sync source', () => {
    expect(formatSource('roster_sync')).toBe('Updated from static roster');
  });

  it('formats lodestone sources', () => {
    expect(formatSource('xivapi')).toBe('Lodestone sync');
    expect(formatSource('tomestone')).toBe('Lodestone sync');
    expect(formatSource('lodestone')).toBe('Lodestone sync');
  });

  it('formats manual source', () => {
    expect(formatSource('manual')).toBe('Manual entry');
  });

  it('formats unknown source', () => {
    expect(formatSource('unknown')).toBe('Unknown source');
  });

  it('passes through unrecognized sources', () => {
    expect(formatSource('something_else')).toBe('something_else');
  });
});
