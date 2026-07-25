import { describe, it, expect } from 'vitest';
import { getNextGearState } from './calculations';

describe('getNextGearState', () => {
  it('null bisSource is a no-op (any state returns itself)', () => {
    expect(getNextGearState('missing', null, false)).toBe('missing');
    expect(getNextGearState('have', null, true)).toBe('have');
  });

  it('raid / base_tome / crafted cycle 2-state (missing <-> have)', () => {
    for (const src of ['raid', 'base_tome', 'crafted'] as const) {
      expect(getNextGearState('missing', src, false)).toBe('have');
      expect(getNextGearState('have', src, false)).toBe('missing');
      // requiresAug is irrelevant for these sources
      expect(getNextGearState('have', src, true)).toBe('missing');
    }
  });

  it('tome without augmentation cycles 2-state', () => {
    expect(getNextGearState('missing', 'tome', false)).toBe('have');
    expect(getNextGearState('have', 'tome', false)).toBe('missing');
  });

  it('tome requiring augmentation cycles 3-state (missing -> have -> augmented -> missing)', () => {
    expect(getNextGearState('missing', 'tome', true)).toBe('have');
    expect(getNextGearState('have', 'tome', true)).toBe('augmented');
    expect(getNextGearState('augmented', 'tome', true)).toBe('missing');
  });
});
