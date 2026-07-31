/**
 * Unit tests for useLogWeek — the Log tab's week model (Phase D4, R-15).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { useLogWeek, logWeekKey } from './useLogWeek';
import type { WeekClock } from '../../hooks/useWeekClock';

const LEGACY_KEY = (groupId: string, tierId: string) => `history-week-${groupId}-${tierId}`;

function makeClock(overrides: Partial<WeekClock> = {}): WeekClock {
  const currentWeek = overrides.currentWeek ?? 3;
  return {
    currentWeek,
    maxWeek: 4,
    weekStartDate: null,
    weeksWithData: new Set(),
    weekDataTypes: new Map(),
    rangeOfWeek: () => null,
    isCurrent: (w: number) => w === currentWeek,
    startNextWeek: vi.fn(),
    revertWeek: vi.fn(),
    ...overrides,
  };
}

interface Props {
  groupId?: string;
  tierId?: string;
  clock: WeekClock;
}

function setup(initialPath: string, initialProps: Props) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [initialPath] }, children);
  return renderHook(
    (props: Props) => {
      const [searchParams] = useSearchParams();
      const logWeek = useLogWeek(props.groupId, props.tierId, props.clock);
      return { ...logWeek, search: searchParams.toString() };
    },
    { wrapper, initialProps },
  );
}

describe('useLogWeek', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('resolution precedence', () => {
    it('?week= wins over everything', () => {
      localStorage.setItem(logWeekKey('g1', 't1'), '2');
      localStorage.setItem(LEGACY_KEY('g1', 't1'), '1');
      const { result } = setup('/?week=4', { groupId: 'g1', tierId: 't1', clock: makeClock() });
      expect(result.current.week).toBe(4);
    });

    it('falls back to the v2 storage key when there is no ?week=', () => {
      localStorage.setItem(logWeekKey('g1', 't1'), '2');
      localStorage.setItem(LEGACY_KEY('g1', 't1'), '1');
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock() });
      expect(result.current.week).toBe(2);
    });

    it('falls back to the legacy storage key when there is no v2 key', () => {
      localStorage.setItem(LEGACY_KEY('g1', 't1'), '1');
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3 }) });
      expect(result.current.week).toBe(1);
    });

    it('follows the clock when nothing is stored and there is no ?week=', () => {
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3 }) });
      expect(result.current.week).toBe(3);
      expect(result.current.isCurrent).toBe(true);
    });

    it(
      'resolves ?week=5 even while the store still holds its currentWeek:1 / ' +
        'maxWeek:1 defaults (cold-load guard)',
      () => {
        // Director B2: REV 1 clamped at resolve time against clock.maxWeek,
        // which is provisionally 1 until fetchCurrentWeek settles — that
        // silently discarded every deep-linked ?week=N (N > 1) on a cold load.
        const { result } = setup('/?week=5', {
          groupId: 'g1',
          tierId: 't1',
          clock: makeClock({ currentWeek: 1, maxWeek: 1 }),
        });
        expect(result.current.week).toBe(5);
        expect(result.current.isCurrent).toBe(false);
      },
    );

    it.each(['0', '-3', 'abc', '5.5', '', ' '])(
      'treats garbage ?week=%s as absent and falls through to the clock',
      (garbage) => {
        const { result } = setup(`/?week=${encodeURIComponent(garbage)}`, {
          groupId: 'g1',
          tierId: 't1',
          clock: makeClock({ currentWeek: 3 }),
        });
        expect(result.current.week).toBe(3);
      },
    );

    it('treats a garbage stored value as absent and falls through to the clock', () => {
      localStorage.setItem(logWeekKey('g1', 't1'), 'not-a-number');
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3 }) });
      expect(result.current.week).toBe(3);
    });

    it('does not touch storage when groupId/tierId are undefined — just follows the clock', () => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem');
      const { result } = setup('/', { groupId: undefined, tierId: undefined, clock: makeClock({ currentWeek: 3 }) });
      expect(result.current.week).toBe(3);
      expect(getItem).not.toHaveBeenCalled();
      getItem.mockRestore();
    });
  });

  describe('setWeek', () => {
    it('clamps below 1 up to 1', () => {
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3, maxWeek: 4 }) });
      act(() => result.current.setWeek(-5));
      expect(result.current.week).toBe(1);
    });

    it('clamps above max(clock.maxWeek, clock.currentWeek) down to it', () => {
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3, maxWeek: 4 }) });
      act(() => result.current.setWeek(99));
      expect(result.current.week).toBe(4);
    });

    it('a week other than current writes both the v2 storage key and the URL param', () => {
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3, maxWeek: 4 }) });
      act(() => result.current.setWeek(2));
      expect(result.current.week).toBe(2);
      expect(result.current.isCurrent).toBe(false);
      expect(localStorage.getItem(logWeekKey('g1', 't1'))).toBe('2');
      expect(result.current.search).toContain('week=2');
    });

    it('a week equal to current clears the override, the v2 key, and the URL param', () => {
      localStorage.setItem(logWeekKey('g1', 't1'), '2');
      const { result } = setup('/?week=2', {
        groupId: 'g1',
        tierId: 't1',
        clock: makeClock({ currentWeek: 3, maxWeek: 4 }),
      });
      expect(result.current.week).toBe(2);

      act(() => result.current.setWeek(3));

      expect(result.current.week).toBe(3);
      expect(result.current.isCurrent).toBe(true);
      expect(localStorage.getItem(logWeekKey('g1', 't1'))).toBeNull();
      expect(result.current.search).not.toContain('week=');
    });

    it('never writes the legacy key', () => {
      localStorage.setItem(LEGACY_KEY('g1', 't1'), '1');
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3, maxWeek: 4 }) });
      act(() => result.current.setWeek(2));
      expect(localStorage.getItem(LEGACY_KEY('g1', 't1'))).toBe('1');
      expect(localStorage.getItem(logWeekKey('g1', 't1'))).toBe('2');
    });
  });

  describe('prev / next', () => {
    it('next steps forward and is a no-op at maxWeek', () => {
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3, maxWeek: 4 }) });
      act(() => result.current.next());
      expect(result.current.week).toBe(4);
      expect(result.current.canNext).toBe(false);

      act(() => result.current.next());
      expect(result.current.week).toBe(4); // no-op at the bound
    });

    it('prev steps backward and is a no-op at week 1', () => {
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 1, maxWeek: 4 }) });
      expect(result.current.canPrev).toBe(false);
      act(() => result.current.prev());
      expect(result.current.week).toBe(1); // no-op at the bound
    });
  });

  describe('followClock', () => {
    it('clears the override, the v2 storage key, and the URL param', () => {
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3, maxWeek: 4 }) });
      act(() => result.current.setWeek(2));
      expect(result.current.week).toBe(2);

      act(() => result.current.followClock());

      expect(result.current.week).toBe(3);
      expect(result.current.isCurrent).toBe(true);
      expect(localStorage.getItem(logWeekKey('g1', 't1'))).toBeNull();
      expect(result.current.search).not.toContain('week=');
    });
  });

  describe('tier / group changes', () => {
    it('re-resolves when tierId changes', () => {
      localStorage.setItem(logWeekKey('g1', 't1'), '2');
      localStorage.setItem(logWeekKey('g1', 't2'), '4');
      const clock = makeClock({ currentWeek: 3, maxWeek: 4 });
      const { result, rerender } = setup('/', { groupId: 'g1', tierId: 't1', clock });
      expect(result.current.week).toBe(2);

      rerender({ groupId: 'g1', tierId: 't2', clock });
      expect(result.current.week).toBe(4);
    });

    it('re-resolves when groupId changes', () => {
      localStorage.setItem(logWeekKey('g1', 't1'), '2');
      localStorage.setItem(logWeekKey('g2', 't1'), '4');
      const clock = makeClock({ currentWeek: 3, maxWeek: 4 });
      const { result, rerender } = setup('/', { groupId: 'g1', tierId: 't1', clock });
      expect(result.current.week).toBe(2);

      rerender({ groupId: 'g2', tierId: 't1', clock });
      expect(result.current.week).toBe(4);
    });
  });

  describe('storage guard', () => {
    it('survives a throwing localStorage on both read and write', () => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied');
      });
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('denied');
      });
      const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('denied');
      });

      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3, maxWeek: 4 }) });
      expect(result.current.week).toBe(3);
      expect(() => act(() => result.current.setWeek(2))).not.toThrow();
      expect(result.current.week).toBe(2);
      expect(() => act(() => result.current.followClock())).not.toThrow();
      expect(result.current.week).toBe(3);

      getItem.mockRestore();
      setItem.mockRestore();
      removeItem.mockRestore();
    });
  });
});
