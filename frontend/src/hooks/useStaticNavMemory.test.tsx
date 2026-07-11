/**
 * Unit tests for useStaticNavMemory — the shared "recent statics" MRU +
 * per-static tab-memory hook promoted out of GroupView so the v2 shell also
 * gets nav memory (StaticPicker restore, `recent-statics`).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useStaticNavMemory } from './useStaticNavMemory';

function setup(initialPath: string, shareCode: string | undefined) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
  );
  return renderHook(({ code }: { code: string | undefined }) => useStaticNavMemory(code), {
    wrapper,
    initialProps: { code: shareCode },
  });
}

describe('useStaticNavMemory', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
  });

  it('does nothing when shareCode is undefined (no writes)', () => {
    setup('/', undefined);
    expect(localStorage.getItem('recent-statics')).toBeNull();
  });

  it('adds a freshly visited static to recent-statics', () => {
    setup('/group/ABC', 'ABC');
    expect(JSON.parse(localStorage.getItem('recent-statics')!)).toEqual(['ABC']);
  });

  it('moves an existing recent-statics entry to the front instead of duplicating it', () => {
    localStorage.setItem('recent-statics', JSON.stringify(['XYZ', 'ABC', 'DEF']));
    setup('/group/ABC', 'ABC');
    expect(JSON.parse(localStorage.getItem('recent-statics')!)).toEqual(['ABC', 'XYZ', 'DEF']);
  });

  it('caps recent-statics at 10 entries, dropping the oldest', () => {
    const seeded = Array.from({ length: 10 }, (_, i) => `S${i}`);
    localStorage.setItem('recent-statics', JSON.stringify(seeded));

    setup('/group/S10', 'S10');

    const updated = JSON.parse(localStorage.getItem('recent-statics')!);
    expect(updated).toHaveLength(10);
    // New visit goes to the front; the previous 9 follow; the 10th (oldest, S9) is dropped.
    expect(updated).toEqual(['S10', ...seeded.slice(0, 9)]);
    expect(updated).not.toContain('S9');
  });

  it('persists static-nav-{code} from the current URL params', () => {
    setup('/group/ABC?tab=roster&sub=weapon', 'ABC');
    const saved = new URLSearchParams(localStorage.getItem('static-nav-ABC') ?? '');
    expect(saved.get('tab')).toBe('roster');
    expect(saved.get('sub')).toBe('weapon');
  });

  it('strips transient params (viewAs, shell) before persisting static-nav', () => {
    setup('/group/ABC?tab=roster&viewAs=u1&shell=v2', 'ABC');
    const saved = new URLSearchParams(localStorage.getItem('static-nav-ABC') ?? '');
    expect(saved.get('tab')).toBe('roster');
    expect(saved.has('viewAs')).toBe(false);
    expect(saved.has('shell')).toBe(false);
  });

  it('does not write static-nav when shareCode is undefined', () => {
    setup('/?tab=roster', undefined);
    expect(localStorage.getItem('static-nav-undefined')).toBeNull();
  });
});
