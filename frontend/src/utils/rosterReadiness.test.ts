import { describe, it, expect } from 'vitest';
import { rosterAvgIlv, bisCompleteCount, bisSlotTotals } from './rosterReadiness';
import type { GearSlotStatus, SnapshotPlayer } from '../types';

// ─── Fixture builders ──────────────────────────────────────────────────────────
// Minimal SnapshotPlayer/GearSlotStatus shapes — only the fields the readiness
// helpers read are meaningful; the rest are filled to satisfy the type.

function slot(partial: Partial<GearSlotStatus>): GearSlotStatus {
  return {
    slot: 'head',
    bisSource: 'raid',
    hasItem: false,
    isAugmented: false,
    ...partial,
  };
}

function player(partial: Partial<SnapshotPlayer>): SnapshotPlayer {
  return {
    id: 'p',
    tierSnapshotId: 't',
    name: 'Player',
    job: 'WAR',
    role: 'tank',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {} as SnapshotPlayer['tomeWeapon'],
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

// A — configured, non-sub, fully BiS. iLvs 730/730/740 → avg 733.33
const A = player({
  id: 'A',
  gear: [
    slot({ slot: 'head', bisSource: 'raid', hasItem: true, itemLevel: 730 }),
    slot({ slot: 'body', bisSource: 'raid', hasItem: true, itemLevel: 730 }),
    slot({ slot: 'hands', bisSource: 'raid', hasItem: true, itemLevel: 740 }),
  ],
});

// B — configured, non-sub, partial. Uses equippedItemLevel ?? itemLevel: 710 + 700 → avg 705
const B = player({
  id: 'B',
  gear: [
    slot({ slot: 'head', bisSource: 'raid', hasItem: true, itemLevel: 720, equippedItemLevel: 710 }),
    slot({ slot: 'body', bisSource: 'tome', hasItem: false, itemLevel: 700 }),
  ],
});

// C — substitute → excluded everywhere
const C = player({ id: 'C', isSubstitute: true, gear: [slot({ hasItem: true, itemLevel: 999 })] });

// D — unconfigured → excluded everywhere
const D = player({ id: 'D', configured: false, gear: [slot({ hasItem: true, itemLevel: 999 })] });

// E — configured non-sub, no item levels, all slots unset bisSource but hasItem.
// Legacy bisComplete counts it (every gear slot hasItem); bisSlotTotals ignores it
// (no bisSource-set slots); rosterAvgIlv skips it (no iLvs).
const E = player({
  id: 'E',
  gear: [
    slot({ slot: 'ring1', bisSource: null, hasItem: true }),
    slot({ slot: 'ring2', bisSource: null, hasItem: true }),
  ],
});

const roster = [A, B, C, D, E];

describe('rosterReadiness (characterization of legacy StaticHomeTab logic)', () => {
  it('rosterAvgIlv averages per-player iLv (equippedItemLevel ?? itemLevel) over configured non-subs', () => {
    // A 733.33, B 705, E skipped (no iLvs); C sub & D unconfigured excluded.
    // (733.333 + 705) / 2 = 719.17 → round 719
    expect(rosterAvgIlv(roster)).toBe(719);
  });

  it('rosterAvgIlv returns null with no active players', () => {
    expect(rosterAvgIlv([])).toBeNull();
    expect(rosterAvgIlv([C, D])).toBeNull();
  });

  it('rosterAvgIlv returns null when active players have no item levels', () => {
    expect(rosterAvgIlv([E])).toBeNull();
  });

  it('bisCompleteCount counts configured non-subs whose every gear slot hasItem', () => {
    // A (all hasItem) ✓, B (one missing) ✗, E (both hasItem) ✓, C/D excluded
    expect(bisCompleteCount(roster)).toBe(2);
  });

  it('bisCompleteCount excludes a player with empty gear', () => {
    expect(bisCompleteCount([player({ id: 'Z', gear: [] })])).toBe(0);
  });

  it('bisSlotTotals sums bisSource-set slots (obtained / total) across active players', () => {
    // A: 3/3, B: 1/2, E: 0/0 → obtained 4, total 5
    expect(bisSlotTotals(roster)).toEqual({ obtained: 4, total: 5 });
  });

  it('bisSlotTotals is zero for an empty roster', () => {
    expect(bisSlotTotals([])).toEqual({ obtained: 0, total: 0 });
  });
});
