/**
 * Unit tests for the URL→state parse helpers in useGroupViewState. These encode
 * the legacy-URL compatibility matrix (old shared links + Dalamud plugin deep
 * links) and the "null = leave current value" contract the back/forward
 * reconciliation depends on. A wrong mapping here silently lands users on the
 * wrong tab with no error, so it's worth locking down.
 */

import { describe, it, expect } from 'vitest';
import { pageModeFromTabParam, reconcileSubTab } from './useGroupViewState';

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

describe('reconcileSubTab', () => {
  // Generic string-literal sub-tab union with legacy-alias normalization —
  // exercises reconcileSubTab's contract without depending on any specific
  // consumer's parser (gear/loot sub-tab parsers have both been pruned as
  // their consuming state was removed; reconcileSubTab itself is generic
  // and kept as a tested utility for any future URL-backed sub-tab).
  const parse = (raw: string | null): 'sync' | 'priority' | 'history' | 'stats' | null => {
    if (raw === 'sync' || raw === 'priority' || raw === 'history' || raw === 'stats') return raw;
    if (raw === 'weapon') return 'priority';
    if (raw === 'summary') return 'stats';
    return null;
  };
  const sub = (current: 'sync' | 'priority' | 'history' | 'stats', raw: string | null, isPop: boolean) =>
    reconcileSubTab(current, raw, parse(raw), isPop, 'sync');

  it('adopts a recognized param value (back/forward to an explicit sub-tab)', () => {
    expect(sub('sync', 'history', true)).toBe('history');
    expect(sub('priority', 'stats', false)).toBe('stats');
    // legacy normalization still applies through the parser
    expect(sub('sync', 'weapon', true)).toBe('priority');
  });

  it('keeps the current value when the param is absent on forward/normal nav', () => {
    // This is what lets a remembered sub-tab persist when the URL has no param.
    expect(sub('history', null, false)).toBe('history');
    expect(sub('stats', null, false)).toBe('stats');
  });

  it('restores the default when the param is absent on a POP (the real fix)', () => {
    // Browser back/forward to a param-less entry → that entry showed the default.
    expect(sub('history', null, true)).toBe('sync');
    expect(sub('priority', null, true)).toBe('sync');
  });

  it('is a no-op when already at the default', () => {
    expect(sub('sync', null, true)).toBe('sync');
    expect(sub('sync', null, false)).toBe('sync');
  });

  it('an explicit non-default param wins over the POP default reset', () => {
    expect(sub('sync', 'stats', true)).toBe('stats');
  });

  it('is generic over any string-literal sub-tab union, not just this fixture', () => {
    // reconcileSubTab has no gear-specific logic; pin that against a
    // differently-shaped union so a future gear-only refactor is caught.
    const other = (current: 'a' | 'b' | 'c', raw: string | null, isPop: boolean) =>
      reconcileSubTab(current, raw, (raw === 'a' || raw === 'b' || raw === 'c') ? raw : null, isPop, 'b');
    expect(other('c', null, true)).toBe('b');   // POP, absent → default
    expect(other('c', null, false)).toBe('c');  // forward, absent → keep
    expect(other('b', 'a', true)).toBe('a');    // explicit wins
  });
});
