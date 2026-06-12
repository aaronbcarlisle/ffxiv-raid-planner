import { describe, expect, it } from 'vitest';
import type { GearSnapshot, PlayerJobProfile } from '../../stores/playerProfileStore';
import { formatGearActivity, getJobGearState, hasUsableGearSnapshot, resolveJobGearSnapshot } from './jobGearUtils';

const baseJob: PlayerJobProfile = {
  id: 'job-1',
  job: 'BRD',
  role: 'ranged',
  priority: 'main',
  readiness: 'ready',
  notes: null,
  gearSnapshotId: null,
  gearSnapshot: null,
  bisTargets: [],
  createdAt: '2026-06-08T00:00:00Z',
  updatedAt: '2026-06-08T00:00:00Z',
};

function snapshot(overrides: Partial<GearSnapshot>): GearSnapshot {
  return {
    id: 'snapshot',
    characterId: 'character-1',
    job: 'BRD',
    gear: [{ slot: 'weapon', equippedItemName: 'Test Bow', equippedItemLevel: 730 }],
    avgItemLevel: 730,
    source: 'plugin',
    syncedAt: '2026-06-08T00:00:00Z',
    lastPluginSeenAt: null,
    createdAt: '2026-06-08T00:00:00Z',
    updatedAt: '2026-06-08T00:00:00Z',
    ...overrides,
  };
}

describe('jobGearUtils', () => {
  it('does not assign a gear snapshot from one job to another', () => {
    const mchSnapshot = snapshot({ id: 'mch-snapshot', job: 'MCH', avgItemLevel: 720 });

    expect(resolveJobGearSnapshot(baseJob, { 'character-1': [mchSnapshot] })).toBeNull();
  });

  it('ignores a linked snapshot when it belongs to the wrong job', () => {
    const wrongLinkedSnapshot = snapshot({ id: 'war-snapshot', job: 'WAR', avgItemLevel: 725 });

    expect(resolveJobGearSnapshot({ ...baseJob, gearSnapshot: wrongLinkedSnapshot }, {})).toBeNull();
  });

  it('uses the newest matching job snapshot across character snapshot lists', () => {
    const olderBrd = snapshot({ id: 'older-brd', job: 'BRD', avgItemLevel: 720, syncedAt: '2026-06-07T00:00:00Z' });
    const newerBrd = snapshot({ id: 'newer-brd', job: 'brd', avgItemLevel: 735, syncedAt: '2026-06-08T00:00:00Z' });
    const mch = snapshot({ id: 'mch', job: 'MCH', avgItemLevel: 710 });

    expect(resolveJobGearSnapshot(baseJob, { 'character-1': [olderBrd, mch], 'character-2': [newerBrd] })).toEqual(newerBrd);
  });

  it('does not treat empty gear rows as saved gear', () => {
    const emptyPlugin = snapshot({
      id: 'empty-plugin',
      job: 'BRD',
      avgItemLevel: 0,
      gear: [],
      syncedAt: new Date().toISOString(),
    });

    expect(hasUsableGearSnapshot(emptyPlugin)).toBe(false);
    expect(resolveJobGearSnapshot(baseJob, { 'character-1': [emptyPlugin] })).toBeNull();
  });

  it('labels plugin, manual, and missing loadouts clearly', () => {
    expect(getJobGearState(baseJob, snapshot({ job: 'BRD', source: 'plugin' }))).toBe('BRD loadout');
    expect(getJobGearState(baseJob, snapshot({ job: 'BRD', source: 'manual' }))).toBe('Manual entry');
    expect(getJobGearState(baseJob, snapshot({ job: 'BRD', source: 'tomestone' }))).toBe('Current equipped job only');
    expect(getJobGearState({ ...baseJob, readiness: 'needs_gear' }, null)).toBe('No gear saved for this job yet');
    expect(getJobGearState(baseJob, null)).toBe('No gear saved for this job yet');
  });

  it('uses source-specific activity verbs', () => {
    const now = new Date().toISOString();
    expect(formatGearActivity(snapshot({ source: 'plugin', syncedAt: now }))).toBe('Synced just now');
    expect(formatGearActivity(snapshot({ source: 'manual', syncedAt: now }))).toBe('Updated just now');
    expect(formatGearActivity(snapshot({ source: 'tomestone', syncedAt: now }))).toBe('Refreshed just now');
  });
});
