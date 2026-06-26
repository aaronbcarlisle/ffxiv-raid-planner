/**
 * Unit tests for the URL→state parse helpers in useGroupViewState. These encode
 * the legacy-URL compatibility matrix (old shared links + Dalamud plugin deep
 * links) and the "null = leave current value" contract the back/forward
 * reconciliation depends on. A wrong mapping here silently lands users on the
 * wrong tab with no error, so it's worth locking down.
 */

import { describe, it, expect } from 'vitest';
import { pageModeFromTabParam, gearSubFromParam, lootSubFromParam } from './useGroupViewState';

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
