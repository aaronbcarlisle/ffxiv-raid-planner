import { describe, expect, it } from 'vitest';
import { deriveProfileSetup, type SetupCallbacks } from './profileSetup';
import type { GearSnapshot, PlayerProfile } from '../../../stores/playerProfileStore';
import type { PersonalAvailabilityDay } from '../../../stores/personalAvailabilityStore';

const makeCallbacks = (): SetupCallbacks & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    onOpenLinkModal: () => calls.push('link-modal'),
    onAddJob: () => calls.push('add-job'),
    setTab: (tab) => calls.push(`tab:${tab}`),
  };
};

const baseProfile: PlayerProfile = {
  id: 'p1', userId: 'u1', visibility: 'shareable', shareCode: 'ABC', shareEnabled: true, bio: null,
  characters: [{ id: 'c1', lodestoneId: '1', name: 'Rin Test', server: 'Balmung', dataCenter: 'Crystal', avatarUrl: null, isMain: true, createdAt: '', updatedAt: '' }],
  jobProfiles: [{ id: 'j1', job: 'BRD', role: 'ranged', priority: 'main', readiness: 'ready', notes: null, gearSnapshotId: null, gearSnapshot: null, bisTargets: [], createdAt: '', updatedAt: '' }],
  createdAt: '', updatedAt: '',
};

const usableSnap: GearSnapshot = {
  id: 's1', characterId: 'c1', job: 'BRD', source: 'plugin', syncedAt: '2026-09-26T00:00:00Z',
  lastPluginSeenAt: null, avgItemLevel: 700, createdAt: '', updatedAt: '',
  gear: [{ slot: 'weapon', equippedItemLevel: 700 }],
};

const availDays: PersonalAvailabilityDay[] = [
  { dayOfWeek: 'MO', slots: ['18:00', '18:30'], timezone: 'America/New_York' },
];

describe('deriveProfileSetup — next step order', () => {
  it('step 1: no character → Link character calls onOpenLinkModal', () => {
    const cb = makeCallbacks();
    const result = deriveProfileSetup(null, {}, [], cb);
    expect(result.allDone).toBe(false);
    expect(result.nextStep?.label).toMatch(/character/i);
    result.nextStep?.action();
    expect(cb.calls).toContain('link-modal');
  });

  it('step 2: character but no main job → Set main job calls onAddJob', () => {
    const cb = makeCallbacks();
    const profile = { ...baseProfile, jobProfiles: [] };
    const result = deriveProfileSetup(profile, {}, [], cb);
    expect(result.nextStep?.label).toMatch(/job/i);
    result.nextStep?.action();
    expect(cb.calls).toContain('add-job');
  });

  it('step 3: no gear → Check gear switches to characters tab', () => {
    const cb = makeCallbacks();
    const profile = { ...baseProfile, jobProfiles: [{ ...baseProfile.jobProfiles[0] }] };
    const result = deriveProfileSetup(profile, {}, [], cb);
    expect(result.nextStep?.label).toMatch(/gear/i);
    result.nextStep?.action();
    expect(cb.calls).toContain('tab:characters');
  });

  it('step 4: no availability → Set availability switches to availability tab', () => {
    const cb = makeCallbacks();
    const result = deriveProfileSetup(baseProfile, { c1: [usableSnap] }, [], cb);
    expect(result.nextStep?.label).toMatch(/availability/i);
    result.nextStep?.action();
    expect(cb.calls).toContain('tab:availability');
  });

  it('step 5: no readiness → Set readiness switches to characters tab', () => {
    const cb = makeCallbacks();
    const profile = {
      ...baseProfile,
      jobProfiles: [{ ...baseProfile.jobProfiles[0], readiness: 'unknown' as const }],
    };
    const result = deriveProfileSetup(profile, { c1: [usableSnap] }, availDays, cb);
    expect(result.nextStep?.label).toMatch(/readiness/i);
    result.nextStep?.action();
    expect(cb.calls).toContain('tab:characters');
  });

  it('step 6: not visible → Configure sharing switches to sharing tab', () => {
    const cb = makeCallbacks();
    const profile = { ...baseProfile, visibility: 'private' };
    const result = deriveProfileSetup(profile, { c1: [usableSnap] }, availDays, cb);
    expect(result.nextStep?.label).toMatch(/sharing/i);
    result.nextStep?.action();
    expect(cb.calls).toContain('tab:sharing');
  });

  it('all done: completedCount === 7, allDone true, nextStep null', () => {
    const cb = makeCallbacks();
    const result = deriveProfileSetup(baseProfile, { c1: [usableSnap] }, availDays, cb);
    expect(result.completedCount).toBe(7);
    expect(result.totalCount).toBe(7);
    expect(result.allDone).toBe(true);
    expect(result.nextStep).toBeNull();
    expect(result.readyPct).toBe(100);
  });

  it('counts optional alt-job check separately', () => {
    const cb = makeCallbacks();
    const result = deriveProfileSetup(baseProfile, { c1: [usableSnap] }, availDays, cb);
    expect(result.optionalChecks).toHaveLength(1);
    expect(result.optionalChecks[0].key).toBe('alt-job');
  });
});

describe('deriveProfileSetup — null profile', () => {
  it('returns 0 completedCount and Link character next step', () => {
    const cb = makeCallbacks();
    const r = deriveProfileSetup(null, {}, [], cb);
    expect(r.completedCount).toBe(0);
    expect(r.allDone).toBe(false);
  });
});
