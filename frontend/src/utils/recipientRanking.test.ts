import { describe, it, expect } from 'vitest';
import { buildRecipientEntries } from './recipientRanking';
import { DEFAULT_SETTINGS } from './constants';
import type { SnapshotPlayer } from '../types';

function makePlayer(id: string, name: string, opts: {
  sub?: boolean; hasEarring?: boolean; earringSource?: 'raid' | 'tome';
} = {}): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: 'PLD', role: 'tank',
    configured: true, sortOrder: 0, isSubstitute: opts.sub ?? false,
    gear: [{
      slot: 'earring', bisSource: opts.earringSource ?? 'raid',
      hasItem: opts.hasEarring ?? false, isAugmented: false,
    }],
    tomeWeapon: {}, weaponPriorities: [],
  } as unknown as SnapshotPlayer;
}
const settings = { ...DEFAULT_SETTINGS };
const base = { slot: 'earring' as const, settings, lootLog: [], currentWeek: 1, enhancedActive: false };

describe('buildRecipientEntries', () => {
  const needer = makePlayer('a', 'Alice');
  const haver = makePlayer('b', 'Bob', { hasEarring: true });
  const tomeBis = makePlayer('c', 'Cara', { earringSource: 'tome' });
  const sub = makePlayer('d', 'Dana', { sub: true });
  const players = [needer, haver, tomeBis, sub];

  it("scope 'priority' returns ranked main-roster needers only", () => {
    const out = buildRecipientEntries({ ...base, players, scope: 'priority' });
    expect(out.map((e) => e.player.id)).toEqual(['a']);
    expect(out[0]).toMatchObject({ rank: 1, needsItem: true, needTag: 'bis' });
    expect(out[0].reason).toContain('BiS');
  });

  it("scope 'all' includes everyone: needers ranked first, others alphabetical with tags", () => {
    const out = buildRecipientEntries({ ...base, players, scope: 'all' });
    expect(out[0].player.id).toBe('a');                       // needer first
    const ids = out.map((e) => e.player.id);
    expect(ids).toHaveLength(4);                              // subs included
    const bob = out.find((e) => e.player.id === 'b')!;
    expect(bob.needTag).toBe('free');                         // already has raid BiS
    const cara = out.find((e) => e.player.id === 'c')!;
    expect(cara.needTag).toBe('minor');                       // tome BiS in slot
  });

  it("scope 'offspec' returns everyone alphabetical, tagged free", () => {
    const out = buildRecipientEntries({ ...base, players, scope: 'offspec' });
    expect(out.map((e) => e.player.name)).toEqual(['Alice', 'Bob', 'Cara', 'Dana']);
    expect(out.every((e) => e.needTag === 'free' && e.rank === null)).toBe(true);
  });
});
