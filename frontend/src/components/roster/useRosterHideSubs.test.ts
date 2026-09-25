import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRosterHideSubs, ROSTER_HIDE_SUBS_KEY } from './useRosterHideSubs';

// §9 / R-D14-J. v2's Roster used to replicate legacy's `roster-hide-subs`
// localStorage key byte-for-byte — a toggle in one shell silently changed
// what the other rendered on its next visit. This closes that the same way
// C6 closed it for the sort preset: v2 key wins on read, legacy is read-only
// fallback, writes go to the v2 key alone.

const LEGACY_KEY = 'roster-hide-subs';

describe('useRosterHideSubs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('applies the legacy value when there is no v2 value', () => {
    localStorage.setItem(LEGACY_KEY, 'true');

    const { result } = renderHook(() => useRosterHideSubs());

    expect(result.current.subsHidden).toBe(true);
  });

  it('the v2 value wins over a conflicting legacy value', () => {
    localStorage.setItem(ROSTER_HIDE_SUBS_KEY, 'false');
    localStorage.setItem(LEGACY_KEY, 'true');

    const { result } = renderHook(() => useRosterHideSubs());

    expect(result.current.subsHidden).toBe(false);
  });

  it('falls back to false when nothing is stored', () => {
    const { result } = renderHook(() => useRosterHideSubs());

    expect(result.current.subsHidden).toBe(false);
  });

  it('a toggle leaves the legacy key unchanged', () => {
    localStorage.setItem(LEGACY_KEY, 'false');
    const { result } = renderHook(() => useRosterHideSubs());

    act(() => result.current.setSubsHidden(true));

    expect(localStorage.getItem(ROSTER_HIDE_SUBS_KEY)).toBe('true');
    expect(localStorage.getItem(LEGACY_KEY)).toBe('false');
  });

  it('survives localStorage throwing, falling back to false', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    const { result } = renderHook(() => useRosterHideSubs());
    expect(result.current.subsHidden).toBe(false);
    expect(() => act(() => result.current.setSubsHidden(true))).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
