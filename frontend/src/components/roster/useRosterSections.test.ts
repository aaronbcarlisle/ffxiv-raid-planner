import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRosterSections, rosterCollapseKey, visibleRosterSections } from './useRosterSections';
import type { SnapshotPlayer } from '../../types';

// C6 / D-08. Legacy's PlayerGrid folds G1/G2/Subs and persists per static+tier
// (`roster-collapse-{groupId}-{tierId}`). v2 adds Unassigned — its grouped view
// renders that section too — and writes a v2-scoped key so a v2 fold never
// changes what the frozen shell renders next visit.

const LEGACY_KEY = (g: string, t: string) => `roster-collapse-${g}-${t}`;

const render = (groupId = 'g1', tierId: string | undefined = 't1', sections: readonly string[] = ['g1', 'g2', 'subs']) =>
  renderHook(
    (props: { groupId: string; tierId: string | undefined; sections: readonly string[] }) =>
      useRosterSections(props),
    { initialProps: { groupId, tierId, sections: [...sections] } }
  );

describe('useRosterSections', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with every section expanded', () => {
    const { result } = render();
    expect(result.current.isCollapsed('g1')).toBe(false);
    expect(result.current.isCollapsed('subs')).toBe(false);
  });

  it('folds and unfolds one section at a time', () => {
    const { result } = render();

    act(() => result.current.toggleSection('g2'));
    expect(result.current.isCollapsed('g2')).toBe(true);
    expect(result.current.isCollapsed('g1')).toBe(false);

    act(() => result.current.toggleSection('g2'));
    expect(result.current.isCollapsed('g2')).toBe(false);
  });

  it('persists folds under the v2 key, leaving legacy’s untouched', () => {
    localStorage.setItem(LEGACY_KEY('g1', 't1'), JSON.stringify({ g1: true }));
    const { result } = render();

    act(() => result.current.toggleSection('subs'));

    expect(JSON.parse(localStorage.getItem(rosterCollapseKey('g1', 't1')) ?? '{}')).toEqual({
      subs: true,
    });
    expect(JSON.parse(localStorage.getItem(LEGACY_KEY('g1', 't1')) ?? '{}')).toEqual({ g1: true });
  });

  it('restores folds from storage on mount', () => {
    localStorage.setItem(rosterCollapseKey('g1', 't1'), JSON.stringify({ g2: true }));
    const { result } = render();
    expect(result.current.isCollapsed('g2')).toBe(true);
  });

  it('re-reads folds when the tier changes — the roster stays mounted across switches', () => {
    localStorage.setItem(rosterCollapseKey('g1', 't1'), JSON.stringify({ g1: true }));
    localStorage.setItem(rosterCollapseKey('g1', 't2'), JSON.stringify({ subs: true }));

    const { result, rerender } = render();
    expect(result.current.isCollapsed('g1')).toBe(true);

    rerender({ groupId: 'g1', tierId: 't2', sections: ['g1', 'g2', 'subs'] });
    expect(result.current.isCollapsed('g1')).toBe(false);
    expect(result.current.isCollapsed('subs')).toBe(true);
  });

  it('ignores a stale non-object stored value', () => {
    localStorage.setItem(rosterCollapseKey('g1', 't1'), '"nonsense"');
    const { result } = render();
    expect(result.current.isCollapsed('g1')).toBe(false);
  });

  describe('expand/collapse-all (re-click Expanded)', () => {
    it('folds every rendered section when all are open', () => {
      const { result } = render();

      act(() => result.current.toggleAll());

      expect(result.current.isCollapsed('g1')).toBe(true);
      expect(result.current.isCollapsed('g2')).toBe(true);
      expect(result.current.isCollapsed('subs')).toBe(true);
    });

    it('expands everything when any section is folded', () => {
      const { result } = render();

      act(() => result.current.toggleSection('g1'));
      act(() => result.current.toggleAll());

      expect(result.current.isCollapsed('g1')).toBe(false);
      expect(result.current.isCollapsed('g2')).toBe(false);
    });

    it('only touches the sections currently rendered', () => {
      // Flat view with no subs section: folding all must not fold sections that
      // aren't on screen, or they'd be folded when the user switches back.
      const { result } = render('g1', 't1', ['g1']);

      act(() => result.current.toggleAll());

      expect(result.current.isCollapsed('g1')).toBe(true);
      expect(result.current.isCollapsed('subs')).toBe(false);
    });

    it('keeps an off-screen section FOLDED across a fold-all (PR #199 review)', () => {
      // Fold Substitutes, hide the section, fold-all, bring it back: the user
      // never expanded Substitutes, so it must still be folded. (The test above
      // can't catch this — it checks a section that started expanded anyway.)
      const { result, rerender } = render();

      act(() => result.current.toggleSection('subs'));
      expect(result.current.isCollapsed('subs')).toBe(true);

      rerender({ groupId: 'g1', tierId: 't1', sections: ['g1', 'g2'] });
      act(() => result.current.toggleAll());

      expect(result.current.isCollapsed('g1')).toBe(true);
      expect(result.current.isCollapsed('g2')).toBe(true);
      expect(result.current.isCollapsed('subs')).toBe(true);
    });

    it('still clears every fold on expand-all, on-screen or not', () => {
      // The other direction stays a full reset: expanding a section nobody can
      // see has no visible effect, and it keeps "expand all" meaning all.
      const { result, rerender } = render();

      act(() => result.current.toggleSection('subs'));
      act(() => result.current.toggleSection('g1'));

      rerender({ groupId: 'g1', tierId: 't1', sections: ['g1', 'g2'] });
      act(() => result.current.toggleAll());

      expect(result.current.isCollapsed('g1')).toBe(false);
      expect(result.current.isCollapsed('subs')).toBe(false);
    });

    it('does nothing when no sections are rendered', () => {
      const { result } = render('g1', 't1', []);
      act(() => result.current.toggleAll());
      expect(result.current.isCollapsed('g1')).toBe(false);
    });
  });

  it('survives localStorage throwing (fold state)', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    const { result } = render();
    expect(result.current.isCollapsed('g1')).toBe(false);
    expect(() => act(() => result.current.toggleSection('g1'))).not.toThrow();
    expect(result.current.isCollapsed('g1')).toBe(true);

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

// The fold-all action must act on exactly the sections RosterCards renders, so
// the two derive that list from one expression.
describe('visibleRosterSections', () => {
  const player = (over: Partial<SnapshotPlayer>): SnapshotPlayer =>
    ({ id: 'p', configured: true, isSubstitute: false, position: 'T1', ...over }) as SnapshotPlayer;

  const roster = [
    player({ id: 'a', position: 'T1' }),
    player({ id: 'b', position: 'T2' }),
    player({ id: 'c', position: undefined }),
    player({ id: 'd', isSubstitute: true }),
  ];

  it('lists the grouped sections that have players', () => {
    expect(
      visibleRosterSections({ players: roster, groupView: true, subsView: true, subsHidden: false })
    ).toEqual(['g1', 'g2', 'unassigned', 'subs']);
  });

  it('drops empty groups', () => {
    const onlyG1 = [player({ id: 'a', position: 'T1' })];
    expect(
      visibleRosterSections({ players: onlyG1, groupView: true, subsView: true, subsHidden: false })
    ).toEqual(['g1']);
  });

  it('has no group sections in the flat view — only substitutes fold there', () => {
    expect(
      visibleRosterSections({ players: roster, groupView: false, subsView: true, subsHidden: false })
    ).toEqual(['subs']);
  });

  it('drops substitutes when they are hidden or merged into the main grid', () => {
    expect(
      visibleRosterSections({ players: roster, groupView: true, subsView: true, subsHidden: true })
    ).toEqual(['g1', 'g2', 'unassigned']);
    expect(
      visibleRosterSections({ players: roster, groupView: true, subsView: false, subsHidden: false })
    ).toEqual(['g1', 'g2', 'unassigned']);
  });
});
