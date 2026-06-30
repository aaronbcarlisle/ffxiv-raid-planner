import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { deriveActivityItems } from './staticActivity';
import type { MountFarmData, MemberProgress } from '../stores/mountFarmStore';

// Characterization test for the privacy-sensitive activity derivation that was
// promoted verbatim from StaticHomeTab. Locks the load-bearing rules:
//   manual source  → actor NAMED
//   plugin source  → actor anonymized ("A member …")
//   plugin sync    → system aggregate row ("Shared mount data updated")
//   activityDisplayMode === 'anonymous' + own NAMED action → anonymized
//   visibility filter keeps 'static'/'public'
//   desc sort by createdAt, capped at 5
//
// `relativeTime` reads Date.now(), so the clock is frozen to make the `time`
// field deterministic and assert the EXACT StaticActivityItem[] output.

const TRIAL = 'dt-valigarmanda'; // getTrialById → dutyName 'Worqor Lar Dor (Extreme)', mountName 'Wings of Ruin'
const DUTY = 'Worqor Lar Dor (Extreme)';
const MOUNT = 'Wings of Ruin';
const NOW = '2026-06-30T12:00:00Z';

function mp(partial: Partial<MemberProgress> & { userId: string }): MemberProgress {
  return {
    displayName: partial.userId,
    discordUsername: null,
    discordAvatar: null,
    trialId: TRIAL,
    hasMount: false,
    wantsMount: false,
    totemCount: 0,
    notes: null,
    updatedAt: null,
    ownershipSource: 'manual',
    totemSource: 'manual',
    lastImportedAt: null,
    lastPluginSyncAt: null,
    lastManualOverrideAt: null,
    ...partial,
  };
}

function fixture(members: MemberProgress[]): MountFarmData {
  return {
    currentUserId: null,
    trials: [
      {
        trialId: TRIAL,
        totalMembers: members.length,
        membersComplete: 0,
        membersMissing: 0,
        membersWanting: 0,
        membersCanBuy: 0,
        memberProgress: members,
      },
    ],
  };
}

// One member of every kind, with distinct timestamps so the desc sort is unambiguous.
const ALICE = mp({ userId: 'u-alice', displayName: 'Alice', hasMount: true, updatedAt: '2026-06-30T11:58:00Z' }); // manual mount → named, 2m ago
const BOB = mp({ userId: 'u-bob', displayName: 'Bob', totemCount: 40, updatedAt: '2026-06-30T11:00:00Z' }); // manual totem → named, 1h ago
const CAROL = mp({ userId: 'u-carol', displayName: 'Carol', wantsMount: true, updatedAt: '2026-06-30T10:00:00Z' }); // manual tracking → named, 2h ago
const DAVE = mp({
  userId: 'u-dave',
  displayName: 'Dave',
  hasMount: true,
  ownershipSource: 'plugin',
  updatedAt: '2026-06-30T09:00:00Z',
  lastPluginSyncAt: '2026-06-30T09:30:00Z',
}); // plugin mount → "A member obtained …", 3h ago
const EVE = mp({
  userId: 'u-eve',
  displayName: 'Eve',
  totemCount: 50,
  totemSource: 'plugin',
  updatedAt: '2026-06-30T08:00:00Z',
  lastPluginSyncAt: '2026-06-30T08:30:00Z',
}); // plugin totem → "A member updated collection progress", 4h ago (dropped by 5-cap)

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('deriveActivityItems', () => {
  it('applies the privacy model, desc sort, and 5-cap (exact output)', () => {
    const data = fixture([EVE, DAVE, CAROL, BOB, ALICE]); // intentionally out of order

    const items = deriveActivityItems(data);

    expect(items).toEqual([
      {
        key: `${TRIAL}-u-alice-obtained`,
        actorUserId: 'u-alice',
        actorDisplayName: 'Alice',
        actorDisplay: 'named',
        visibility: 'static',
        type: 'mount_progress',
        icon: 'mount',
        label: `Alice obtained ${MOUNT}`,
        createdAt: '2026-06-30T11:58:00Z',
        time: '2m ago',
      },
      {
        key: `${TRIAL}-u-bob-currency`,
        actorUserId: 'u-bob',
        actorDisplayName: 'Bob',
        actorDisplay: 'named',
        visibility: 'static',
        type: 'mount_progress',
        icon: 'currency',
        label: `Bob updated ${DUTY} progress`,
        createdAt: '2026-06-30T11:00:00Z',
        time: '1h ago',
      },
      {
        key: `${TRIAL}-u-carol-tracking`,
        actorUserId: 'u-carol',
        actorDisplayName: 'Carol',
        actorDisplay: 'named',
        visibility: 'static',
        type: 'mount_progress',
        icon: 'tracking',
        label: `Carol started tracking ${DUTY}`,
        createdAt: '2026-06-30T10:00:00Z',
        time: '2h ago',
      },
      {
        key: 'plugin-sync',
        actorUserId: undefined,
        actorDisplayName: undefined,
        actorDisplay: 'system',
        visibility: 'static',
        type: 'plugin_sync',
        icon: 'plugin',
        label: 'Shared mount data updated',
        createdAt: '2026-06-30T09:30:00Z',
        time: '2h ago',
      },
      {
        key: `${TRIAL}-u-dave-obtained`,
        actorUserId: null,
        actorDisplayName: null,
        actorDisplay: 'anonymous',
        visibility: 'static',
        type: 'mount_progress',
        icon: 'mount',
        label: `A member obtained ${MOUNT}`,
        createdAt: '2026-06-30T09:00:00Z',
        time: '3h ago',
      },
    ]);
  });

  it('caps at 5 even with more visible entries', () => {
    const items = deriveActivityItems(fixture([ALICE, BOB, CAROL, DAVE, EVE]));
    expect(items).toHaveLength(5);
    // Eve (oldest, 08:00) is dropped.
    expect(items.some((i) => i.key === `${TRIAL}-u-eve-currency`)).toBe(false);
  });

  it('anonymizes the current user’s own NAMED action when activityDisplayMode is anonymous', () => {
    const items = deriveActivityItems(fixture([ALICE, BOB]), 'u-alice', 'anonymous');

    const alice = items.find((i) => i.key === `${TRIAL}-u-alice-obtained`)!;
    expect(alice.actorDisplay).toBe('anonymous');
    expect(alice.actorUserId).toBeNull();
    expect(alice.actorDisplayName).toBeNull();
    expect(alice.label).toBe(`A member obtained ${MOUNT}`);

    // A different member's action stays named even in anonymous mode.
    const bob = items.find((i) => i.key === `${TRIAL}-u-bob-currency`)!;
    expect(bob.actorDisplay).toBe('named');
    expect(bob.actorDisplayName).toBe('Bob');
  });

  it('leaves other members named when the current user is in named mode', () => {
    const items = deriveActivityItems(fixture([ALICE]), 'u-alice', 'named');
    expect(items[0].actorDisplay).toBe('named');
    expect(items[0].label).toBe(`Alice obtained ${MOUNT}`);
  });

  it('only emits static-visibility rows (the visibility filter retains them)', () => {
    const items = deriveActivityItems(fixture([ALICE, DAVE]));
    expect(items.every((i) => i.visibility === 'static')).toBe(true);
  });
});
