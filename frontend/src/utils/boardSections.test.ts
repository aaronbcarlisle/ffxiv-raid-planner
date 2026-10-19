/**
 * boardSections (S2a-2·F2 Task TF3, R-S2-6, vet M-6): the Board's labelled party
 * sections, shared by GearBoard's dividers and the Progress tab's column order.
 */
import { describe, expect, it } from 'vitest';
import { boardSections } from './calculations';
import type { SnapshotPlayer } from '../types';

function player(id: string, overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return { id, name: id, configured: true, isSubstitute: false, position: null, ...overrides } as unknown as SnapshotPlayer;
}

describe('boardSections', () => {
  it('labels Light Party 1, Light Party 2, Unassigned, Substitutes in that order', () => {
    const sections = boardSections([
      player('sub', { isSubstitute: true, position: 'T1' }),
      player('none'),
      player('p2', { position: 'M2' }),
      player('p1', { position: 'H1' }),
    ]);
    expect(sections.map((s) => s.label)).toEqual(['Light Party 1', 'Light Party 2', 'Unassigned', 'Substitutes']);
    expect(sections.map((s) => s.players.map((p) => p.id))).toEqual([['p1'], ['p2'], ['none'], ['sub']]);
  });

  it('drops empty sections', () => {
    const sections = boardSections([player('p2', { position: 'T2' }), player('sub', { isSubstitute: true })]);
    expect(sections.map((s) => s.label)).toEqual(['Light Party 2', 'Substitutes']);
  });

  it('returns nothing for an empty roster', () => {
    expect(boardSections([])).toEqual([]);
  });

  it('keeps only configured players, and a configured sub still lands in Substitutes', () => {
    const sections = boardSections([
      player('off', { configured: false, position: 'T1' }),
      player('on', { position: 'T1' }),
      player('offSub', { configured: false, isSubstitute: true }),
    ]);
    expect(sections.map((s) => s.label)).toEqual(['Light Party 1']);
    expect(sections[0].players.map((p) => p.id)).toEqual(['on']);
  });

  it('keeps the input order inside each section', () => {
    const sections = boardSections([
      player('m1', { position: 'M1' }),
      player('t1', { position: 'T1' }),
      player('r1', { position: 'R1' }),
      player('h1', { position: 'H1' }),
      player('x2', { position: 'weird' as unknown as SnapshotPlayer['position'] }),
      player('x1'),
    ]);
    expect(sections[0].players.map((p) => p.id)).toEqual(['m1', 't1', 'r1', 'h1']);
    expect(sections[1].label).toBe('Unassigned');
    expect(sections[1].players.map((p) => p.id)).toEqual(['x2', 'x1']);
  });
});
