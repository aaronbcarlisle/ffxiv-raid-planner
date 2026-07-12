/**
 * Unit tests for navPreferences — TRANSIENT_NAV_PARAMS + buildStaticNavHref.
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
import { TRANSIENT_NAV_PARAMS, buildStaticNavHref } from './navPreferences';

describe('TRANSIENT_NAV_PARAMS', () => {
  it('includes shell — the v2 flip gate must never be baked into persisted static-nav state', () => {
    expect(TRANSIENT_NAV_PARAMS).toContain('shell');
  });
});

describe('buildStaticNavHref', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
  });

  it('remember=true restores the saved static-nav params (minus transient) and appends extraParams', () => {
    localStorage.setItem('static-nav-ABC', 'tab=roster&sub=weapon');
    const href = buildStaticNavHref('ABC', { remember: true, extraParams: { shell: 'v2' } });
    expect(href).toBe('/group/ABC?tab=roster&sub=weapon&shell=v2');
  });

  it('extraParams overrides a same-named persisted key without duplicating it', () => {
    localStorage.setItem('static-nav-ABC', 'tab=roster&sub=gear');
    const href = buildStaticNavHref('ABC', { remember: true, extraParams: { tab: 'loot' } });
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.getAll('tab')).toEqual(['loot']);
    expect(params.get('sub')).toBe('gear');
  });

  it('remember=true with no saved state → bare href + extras', () => {
    const href = buildStaticNavHref('NEWCODE', { remember: true, extraParams: { shell: 'v2' } });
    expect(href).toBe('/group/NEWCODE?shell=v2');
  });

  it('remember=false carries currentParams minus transient minus tier', () => {
    const currentParams = new URLSearchParams('tab=loot&tier=t9&viewAs=u1');
    const href = buildStaticNavHref('ABC', { remember: false, currentParams });
    expect(href).toBe('/group/ABC?tab=loot');
  });

  it('remember=false with no currentParams (not on a static) → bare href + extras', () => {
    const href = buildStaticNavHref('ABC', { remember: false, extraParams: { shell: 'v2' } });
    expect(href).toBe('/group/ABC?shell=v2');
  });

  it('flip-safety: a static-nav seeded with shell=v2 has shell stripped as transient on restore', () => {
    localStorage.setItem('static-nav-ABC', 'tab=roster&shell=v2');
    const href = buildStaticNavHref('ABC', { remember: true, extraParams: {} });
    expect(href).toBe('/group/ABC?tab=roster');
    expect(href).not.toContain('shell');
  });
});

describe('buildStaticNavHref — characterization pin (old ContextSwitcher inline logic)', () => {
  // Frozen snapshot of TRANSIENT_NAV_PARAMS as it was BEFORE this task added
  // 'shell' — the exact list the original ContextSwitcher.buildStaticHref
  // closed over. None of the fixtures below carry a `shell` key, so comparing
  // against this frozen list (rather than the live, now-shell-aware export) is
  // a true equivalence pin, independent of the flip-safety change.
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
