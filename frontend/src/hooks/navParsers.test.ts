/**
 * Unit tests for the URL→state parse helpers in useGroupViewState. These encode
 * the legacy-URL compatibility matrix (old shared links + Dalamud plugin deep
 * links) and the "null = leave current value" contract the back/forward
 * reconciliation depends on. A wrong mapping here silently lands users on the
 * wrong tab with no error, so it's worth locking down.
 */

import { describe, it, expect } from 'vitest';
import { pageModeFromTabParam, gearSubFromParam, lootSubFromParam, reconcileSubTab } from './useGroupViewState';

describe('pageModeFromTabParam', () => {
  it('passes through current tab values', () => {
    for (const tab of ['overview', 'roster', 'schedule', 'goals', 'gear', 'more'] as const) {
      expect(pageModeFromTabParam(tab)).toBe(tab);
    }
  });

  it('maps legacy tab values to their new equivalents', () => {
    expect(pageModeFromTabParam('home')).toBe('overview');
    expect(pageModeFromTabParam('players')).toBe('roster');
    for (const legacy of ['loot', 'priority', 'weapon', 'log', 'history', 'summary']) {
      expect(pageModeFromTabParam(legacy)).toBe('gear');
    }
    expect(pageModeFromTabParam('mount-farms')).toBe('goals');
    expect(pageModeFromTabParam('collections')).toBe('goals');
  });

  it('returns null for absent/unknown params (leave current value)', () => {
    expect(pageModeFromTabParam(null)).toBeNull();
    expect(pageModeFromTabParam('nonsense')).toBeNull();
  });
});

describe('gearSubFromParam', () => {
  it('passes through valid sub values', () => {
    for (const s of ['sync', 'priority', 'history', 'stats'] as const) {
      expect(gearSubFromParam(s)).toBe(s);
    }
  });

  it('maps legacy sub values', () => {
    expect(gearSubFromParam('weapon')).toBe('priority');
    expect(gearSubFromParam('summary')).toBe('stats');
  });

  it('returns null for absent/unknown', () => {
    expect(gearSubFromParam(null)).toBeNull();
    expect(gearSubFromParam('nope')).toBeNull();
  });
});

describe('lootSubFromParam', () => {
  it('passes through valid values and rejects the rest', () => {
    expect(lootSubFromParam('matrix')).toBe('matrix');
    expect(lootSubFromParam('gear')).toBe('gear');
    expect(lootSubFromParam('weapon')).toBe('weapon');
    expect(lootSubFromParam(null)).toBeNull();
    expect(lootSubFromParam('other')).toBeNull();
  });
});

describe('reconcileSubTab', () => {
  // gear sub-tab: default 'sync', parser = gearSubFromParam
  const gear = (current: 'sync' | 'priority' | 'history' | 'stats', raw: string | null, isPop: boolean) =>
    reconcileSubTab(current, raw, gearSubFromParam(raw), isPop, 'sync');

  it('adopts a recognized param value (back/forward to an explicit sub-tab)', () => {
    expect(gear('sync', 'history', true)).toBe('history');
    expect(gear('priority', 'stats', false)).toBe('stats');
    // legacy normalization still applies through the parser
    expect(gear('sync', 'weapon', true)).toBe('priority');
  });

  it('keeps the current value when the param is absent on forward/normal nav', () => {
    // This is what lets a remembered sub-tab persist when the URL has no param.
    expect(gear('history', null, false)).toBe('history');
    expect(gear('stats', null, false)).toBe('stats');
  });

  it('restores the default when the param is absent on a POP (the real fix)', () => {
    // Browser back/forward to a param-less entry → that entry showed the default.
    expect(gear('history', null, true)).toBe('sync');
    expect(gear('priority', null, true)).toBe('sync');
  });

  it('is a no-op when already at the default', () => {
    expect(gear('sync', null, true)).toBe('sync');
    expect(gear('sync', null, false)).toBe('sync');
  });

  it('an explicit non-default param wins over the POP default reset', () => {
    expect(gear('sync', 'stats', true)).toBe('stats');
  });

  it('works for the loot sub-tab defaults too', () => {
    const loot = (current: 'matrix' | 'gear' | 'weapon', raw: string | null, isPop: boolean) =>
      reconcileSubTab(current, raw, lootSubFromParam(raw), isPop, 'gear');
    expect(loot('weapon', null, true)).toBe('gear');   // POP, absent → default
    expect(loot('weapon', null, false)).toBe('weapon'); // forward, absent → keep
    expect(loot('gear', 'matrix', true)).toBe('matrix'); // explicit wins
  });
});
