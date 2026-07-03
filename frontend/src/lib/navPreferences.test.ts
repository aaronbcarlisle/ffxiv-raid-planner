/**
 * Unit tests for navPreferences — buildStaticNavHref.
 *
 * buildStaticNavHref is a promotion of ContextSwitcher's inline `buildStaticHref`
 * (Task 7). The "characterization pin" suite below reproduces that ORIGINAL
 * inline logic verbatim (frozen against a snapshot of the pre-repoint transient
 * list) and asserts the new util produces byte-identical output for all four
 * remember/onStatic combinations — the repoint's safety net.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { buildStaticNavHref } from './navPreferences';

describe('buildStaticNavHref', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
  });

  it('remember=true restores the saved static-nav params (minus transient) and appends extraParams', () => {
    localStorage.setItem('static-nav-ABC', 'tab=roster&sub=weapon');
    const href = buildStaticNavHref('ABC', { remember: true, extraParams: { foo: 'bar' } });
    expect(href).toBe('/group/ABC?tab=roster&sub=weapon&foo=bar');
  });

  it('extraParams overrides a same-named persisted key without duplicating it', () => {
    localStorage.setItem('static-nav-ABC', 'tab=roster&sub=gear');
    const href = buildStaticNavHref('ABC', { remember: true, extraParams: { tab: 'loot' } });
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.getAll('tab')).toEqual(['loot']);
    expect(params.get('sub')).toBe('gear');
  });

  it('remember=true with no saved state → bare href + extras', () => {
    const href = buildStaticNavHref('NEWCODE', { remember: true, extraParams: { foo: 'bar' } });
    expect(href).toBe('/group/NEWCODE?foo=bar');
  });

  it('remember=false carries currentParams minus transient minus tier', () => {
    const currentParams = new URLSearchParams('tab=loot&tier=t9&viewAs=u1');
    const href = buildStaticNavHref('ABC', { remember: false, currentParams });
    expect(href).toBe('/group/ABC?tab=loot');
  });

  it('remember=false with no currentParams (not on a static) → bare href + extras', () => {
    const href = buildStaticNavHref('ABC', { remember: false, extraParams: { foo: 'bar' } });
    expect(href).toBe('/group/ABC?foo=bar');
  });
});

describe('buildStaticNavHref — characterization pin (old ContextSwitcher inline logic)', () => {
  // Frozen snapshot of the exact list the original ContextSwitcher.buildStaticHref
  // closed over, so this suite pins equivalence against a fixed reference rather
  // than the live export (which could otherwise drift in lockstep and mask a
  // regression).
  const OLD_TRANSIENT = ['player', 'viewAs', 'adminMode', 'showSettings', 'settings', 'gsub', 'psub', 'rcsub'];

  function oldBuildStaticHref(
    shareCode: string,
    rememberStaticTab: boolean,
    onStatic: boolean,
    searchParams: URLSearchParams
  ): string {
    const base = `/group/${shareCode}`;
    if (rememberStaticTab) {
      try {
        const saved = localStorage.getItem(`static-nav-${shareCode}`);
        if (saved) {
          const p = new URLSearchParams(saved);
          OLD_TRANSIENT.forEach((k) => p.delete(k));
          const s = p.toString();
          return s ? `${base}?${s}` : base;
        }
      } catch { /* ignore */ }
      return base;
    }
    if (onStatic) {
      const p = new URLSearchParams(searchParams);
      [...OLD_TRANSIENT, 'tier'].forEach((k) => p.delete(k));
      const s = p.toString();
      return s ? `${base}?${s}` : base;
    }
    return base;
  }

  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
  });

  it('(i) remember=true with a saved static-nav', () => {
    localStorage.setItem('static-nav-ABC', 'tab=loot&player=p1&sub=gear');
    const searchParams = new URLSearchParams('tab=roster');
    const expected = oldBuildStaticHref('ABC', true, true, searchParams);
    const actual = buildStaticNavHref('ABC', { remember: true, currentParams: searchParams, extraParams: {} });
    expect(actual).toBe(expected);
    expect(actual).toBe('/group/ABC?tab=loot&sub=gear');
  });

  it('(ii) remember=true, no saved → base', () => {
    const searchParams = new URLSearchParams('tab=roster');
    const expected = oldBuildStaticHref('FRESH', true, true, searchParams);
    const actual = buildStaticNavHref('FRESH', { remember: true, currentParams: searchParams, extraParams: {} });
    expect(actual).toBe(expected);
    expect(actual).toBe('/group/FRESH');
  });

  it('(iii) remember=false + currentParams (onStatic) → minus transient minus tier', () => {
    const searchParams = new URLSearchParams('tab=loot&tier=t1&player=p2&sub=matrix');
    const expected = oldBuildStaticHref('ABC', false, true, searchParams);
    const actual = buildStaticNavHref('ABC', { remember: false, currentParams: searchParams, extraParams: {} });
    expect(actual).toBe(expected);
    expect(actual).toBe('/group/ABC?tab=loot&sub=matrix');
  });

  it('(iv) remember=false + undefined currentParams (!onStatic) → base', () => {
    const expected = oldBuildStaticHref('ABC', false, false, new URLSearchParams());
    const actual = buildStaticNavHref('ABC', { remember: false, currentParams: undefined, extraParams: {} });
    expect(actual).toBe(expected);
    expect(actual).toBe('/group/ABC');
  });
});
