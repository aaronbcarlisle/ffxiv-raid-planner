import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRosterSortPreset, rosterSortPresetKey } from './useRosterSortPreset';

// C6 / D-06. The defect this closes: `useGroupViewState`'s sortPreset
// initializer resolves URL → 'standard' and is "overwritten by tier-specific
// localStorage in useEffect" — but that effect lives only in the legacy hosts
// (GroupViewContent.tsx:205, GroupView.tsx:174) and writes a DIFFERENT hook
// instance than v2's Roster reads. So v2 silently ignores a stored preset.

const LEGACY_KEY = (tierId: string) => `sort-preset-${tierId}`;

describe('useRosterSortPreset', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hydrates from the v2 key', () => {
    localStorage.setItem(rosterSortPresetKey('t1'), 'healer-first');
    const applied: string[] = [];

    renderHook(() =>
      useRosterSortPreset({ tierId: 't1', urlSort: null, applyPreset: (p) => applied.push(p) })
    );

    expect(applied).toEqual(['healer-first']);
  });

  it('falls back to the legacy key so a preset set in the old UI carries over', () => {
    localStorage.setItem(LEGACY_KEY('t1'), 'dps-first');
    const applied: string[] = [];

    renderHook(() =>
      useRosterSortPreset({ tierId: 't1', urlSort: null, applyPreset: (p) => applied.push(p) })
    );

    expect(applied).toEqual(['dps-first']);
  });

  it('prefers the v2 key over the legacy one', () => {
    localStorage.setItem(LEGACY_KEY('t1'), 'dps-first');
    localStorage.setItem(rosterSortPresetKey('t1'), 'custom');
    const applied: string[] = [];

    renderHook(() =>
      useRosterSortPreset({ tierId: 't1', urlSort: null, applyPreset: (p) => applied.push(p) })
    );

    expect(applied).toEqual(['custom']);
  });

  it('falls back to standard when nothing is stored, and ignores junk values', () => {
    localStorage.setItem(rosterSortPresetKey('t1'), 'not-a-preset');
    const applied: string[] = [];

    renderHook(() =>
      useRosterSortPreset({ tierId: 't1', urlSort: null, applyPreset: (p) => applied.push(p) })
    );

    expect(applied).toEqual(['standard']);
  });

  it('lets an explicit URL preset win — a deep link is not overwritten', () => {
    localStorage.setItem(rosterSortPresetKey('t1'), 'healer-first');
    const applied: string[] = [];

    renderHook(() =>
      useRosterSortPreset({ tierId: 't1', urlSort: 'dps-first', applyPreset: (p) => applied.push(p) })
    );

    expect(applied).toEqual([]);
  });

  it('re-hydrates when the tier changes — the roster stays mounted across switches', () => {
    localStorage.setItem(rosterSortPresetKey('t1'), 'healer-first');
    localStorage.setItem(rosterSortPresetKey('t2'), 'dps-first');
    const applied: string[] = [];

    const { rerender } = renderHook(
      ({ tierId }) =>
        useRosterSortPreset({ tierId, urlSort: null, applyPreset: (p) => applied.push(p) }),
      { initialProps: { tierId: 't1' } }
    );
    rerender({ tierId: 't2' });

    expect(applied).toEqual(['healer-first', 'dps-first']);
  });

  it('persists under the v2 key only — the legacy key is never written', () => {
    localStorage.setItem(LEGACY_KEY('t1'), 'standard');
    const { result } = renderHook(() =>
      useRosterSortPreset({ tierId: 't1', urlSort: null, applyPreset: () => {} })
    );

    act(() => result.current.persistPreset('healer-first'));

    expect(localStorage.getItem(rosterSortPresetKey('t1'))).toBe('healer-first');
    // Writing legacy's key would change what the frozen shell renders next
    // visit — a V1-visible effect with zero file diff (C1 persistence ruling).
    expect(localStorage.getItem(LEGACY_KEY('t1'))).toBe('standard');
  });

  it('survives localStorage throwing', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const applied: string[] = [];

    const { result } = renderHook(() =>
      useRosterSortPreset({ tierId: 't1', urlSort: null, applyPreset: (p) => applied.push(p) })
    );
    expect(applied).toEqual(['standard']);
    expect(() => act(() => result.current.persistPreset('custom'))).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
