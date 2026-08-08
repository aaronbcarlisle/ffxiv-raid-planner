/**
 * Unit tests for useLogWeek — the Log tab's week model (Phase D4, R-15).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useSearchParams, useNavigationType } from 'react-router-dom';
import { useLogWeek, logWeekKey, CURRENT_WEEK_SENTINEL } from './useLogWeek';
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
  /** The hook's `?week=` mirror gate ("is the Log view showing"). Defaults to
   *  true here so every test that predates the gate keeps its original
   *  meaning — the Log-visible case. Pass `false` for the Priority/History
   *  case. */
  mirrorToUrl?: boolean;
}

function setup(initialPath: string, initialProps: Props) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [initialPath] }, children);
  return renderHook(
    (props: Props) => {
      const [searchParams] = useSearchParams();
      const navigationType = useNavigationType();
      const logWeek = useLogWeek(props.groupId, props.tierId, props.clock, props.mirrorToUrl ?? true);
      return { ...logWeek, search: searchParams.toString(), navigationType };
    },
    { wrapper, initialProps },
  );
}

describe('useLogWeek', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    // Storage-guard tests spy on Storage.prototype and restore inline, but
    // restoring only on the happy path leaks a throwing spy into every later
    // test on an assertion failure. Belt-and-suspenders cleanup.
    vi.restoreAllMocks();
  });

  describe('resolution precedence', () => {
    it('?week= wins over everything on a fresh mount (the deep-link contract)', () => {
      // Half one of the mount-only rule (fix round 2). D6/D11 deep links live
      // or die on this: on a FIRST resolve the param outranks both storage
      // keys. Half two — that a later tier change ignores the param — is
      // pinned in the "tier / group changes" block below. Neither may be
      // dropped without the other becoming meaningless.
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

    it('a malformed v2 key value (neither "current" nor a valid integer) falls through to legacy', () => {
      localStorage.setItem(logWeekKey('g1', 't1'), 'not-a-number');
      localStorage.setItem(LEGACY_KEY('g1', 't1'), '1');
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3 }) });
      expect(result.current.week).toBe(1);
    });

    it(
      'a v2 key of "current" resolves to the clock even when a stale legacy key exists ' +
        '(the sentinel STOPS resolution — it never falls through to legacy)',
      () => {
        localStorage.setItem(logWeekKey('g1', 't1'), CURRENT_WEEK_SENTINEL);
        localStorage.setItem(LEGACY_KEY('g1', 't1'), '1'); // stale V1 leftover
        const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3 }) });
        expect(result.current.week).toBe(3);
        expect(result.current.isCurrent).toBe(true);
      },
    );

    it('a v2 key holding a number still wins over a legacy key', () => {
      localStorage.setItem(logWeekKey('g1', 't1'), '2');
      localStorage.setItem(LEGACY_KEY('g1', 't1'), '1');
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3 }) });
      expect(result.current.week).toBe(2);
    });

    it('does not touch storage when groupId/tierId are undefined — just follows the clock', () => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem');
      const { result } = setup('/', { groupId: undefined, tierId: undefined, clock: makeClock({ currentWeek: 3 }) });
      expect(result.current.week).toBe(3);
      expect(getItem).not.toHaveBeenCalled();
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

    it('a week equal to current clears the override, writes the "current" sentinel to the v2 key, and removes the URL param', () => {
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
      expect(localStorage.getItem(logWeekKey('g1', 't1'))).toBe(CURRENT_WEEK_SENTINEL);
      expect(result.current.search).not.toContain('week=');
    });

    it('never writes the legacy key', () => {
      localStorage.setItem(LEGACY_KEY('g1', 't1'), '1');
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3, maxWeek: 4 }) });
      act(() => result.current.setWeek(2));
      expect(localStorage.getItem(LEGACY_KEY('g1', 't1'))).toBe('1');
      expect(localStorage.getItem(logWeekKey('g1', 't1'))).toBe('2');
    });

    it('never writes the legacy key even when clearing to the "current" sentinel', () => {
      localStorage.setItem(LEGACY_KEY('g1', 't1'), '1');
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3, maxWeek: 4 }) });
      act(() => result.current.setWeek(2));
      act(() => result.current.setWeek(3)); // back to current -> sentinel path
      expect(localStorage.getItem(LEGACY_KEY('g1', 't1'))).toBe('1');
      expect(localStorage.getItem(logWeekKey('g1', 't1'))).toBe(CURRENT_WEEK_SENTINEL);
    });

    it('preserves sibling URL params (e.g. ?tier=, ?lview=) and uses a REPLACE navigation', () => {
      const { result } = setup('/?tier=abc&lview=log', {
        groupId: 'g1',
        tierId: 't1',
        clock: makeClock({ currentWeek: 3, maxWeek: 4 }),
      });

      act(() => result.current.setWeek(2));

      expect(result.current.search).toContain('tier=abc');
      expect(result.current.search).toContain('lview=log');
      expect(result.current.search).toContain('week=2');
      expect(result.current.navigationType).toBe('REPLACE');
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
    it('clears the override, writes the "current" sentinel to the v2 key, and removes the URL param', () => {
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3, maxWeek: 4 }) });
      act(() => result.current.setWeek(2));
      expect(result.current.week).toBe(2);

      act(() => result.current.followClock());

      expect(result.current.week).toBe(3);
      expect(result.current.isCurrent).toBe(true);
      expect(localStorage.getItem(logWeekKey('g1', 't1'))).toBe(CURRENT_WEEK_SENTINEL);
      expect(result.current.search).not.toContain('week=');
    });

    it('does not touch the legacy key', () => {
      localStorage.setItem(LEGACY_KEY('g1', 't1'), '1');
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3, maxWeek: 4 }) });
      act(() => result.current.setWeek(2));

      act(() => result.current.followClock());

      expect(localStorage.getItem(LEGACY_KEY('g1', 't1'))).toBe('1');
    });

    it(
      'a stale legacy key does not resurrect after followClock — the "current" sentinel STOPS ' +
        'resolution instead of falling through (the V1-migration loop this fix closes)',
      () => {
        // Regression guard: before this fix, followClock() REMOVED the v2 key,
        // so a mount/tier round-trip after "go to current" fell through past
        // the (now-absent) v2 key straight to legacy's unconditionally-written
        // stale week and resurrected it — R-22's go-to-current silently
        // reverted. Writing 'current' instead, and having read STOP on it,
        // closes the loop.
        localStorage.setItem(LEGACY_KEY('g1', 't1'), '1');
        const clock = makeClock({ currentWeek: 3, maxWeek: 4 });
        const { result, rerender } = setup('/', { groupId: 'g1', tierId: 't1', clock });
        act(() => result.current.setWeek(2));

        act(() => result.current.followClock());
        expect(result.current.week).toBe(3);

        // Simulate the "mount/tier round-trip" by forcing a re-resolve on the
        // same key (tierId round-trips off and back on).
        rerender({ groupId: 'g1', tierId: 't2', clock });
        rerender({ groupId: 'g1', tierId: 't1', clock });

        expect(result.current.week).toBe(3); // NOT 1 (the stale legacy value)
        expect(result.current.isCurrent).toBe(true);
      },
    );
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

    // ── `?week=` wins on MOUNT ONLY (fix round 2, user-ruled) ──
    // The two tests above mount at '/', with no `?week=` in play — which is
    // exactly why they could never see the bug below. `setWeek` mirrors the
    // displayed week into `?week=`, so on a real tier switch the param almost
    // always holds this hook's own write for the PREVIOUS tier.

    it(
      'a tier switch resolves from the NEW tier\'s storage, not the ?week= this hook mirrored ' +
        'for the previous tier — and the URL mirror follows the new week',
      () => {
        localStorage.setItem(logWeekKey('g1', 't1'), '2');
        localStorage.setItem(logWeekKey('g1', 't2'), '4');
        const clock = makeClock({ currentWeek: 3, maxWeek: 4 });
        // Mount WITH ?week=2 — the state the hook itself leaves behind after a
        // chevron step on t1.
        const { result, rerender } = setup('/?week=2', { groupId: 'g1', tierId: 't1', clock });
        expect(result.current.week).toBe(2);
        expect(result.current.search).toContain('week=2');

        rerender({ groupId: 'g1', tierId: 't2', clock });

        // Before the fix this was 2 (the carried param), t2's saved 4 was never
        // consulted, and the next chevron click overwrote t2's preference.
        expect(result.current.week).toBe(4);
        expect(result.current.search).toContain('week=4');
        // A re-resolve chooses nothing, so it writes no storage — t1's key is
        // left exactly as it was and t2's is not rewritten.
        expect(localStorage.getItem(logWeekKey('g1', 't1'))).toBe('2');
        expect(localStorage.getItem(logWeekKey('g1', 't2'))).toBe('4');
      },
    );

    it('a group switch ignores the carried ?week= the same way', () => {
      localStorage.setItem(logWeekKey('g1', 't1'), '2');
      localStorage.setItem(logWeekKey('g2', 't1'), '4');
      const clock = makeClock({ currentWeek: 3, maxWeek: 4 });
      const { result, rerender } = setup('/?week=2', { groupId: 'g1', tierId: 't1', clock });
      expect(result.current.week).toBe(2);

      rerender({ groupId: 'g2', tierId: 't1', clock });

      expect(result.current.week).toBe(4);
      expect(result.current.search).toContain('week=4');
    });

    it(
      'a carried ?week= above the new tier\'s range does not survive the switch (resolution is ' +
        'deliberately unclamped, so nothing would correct it afterwards)',
      () => {
        // The sharp edge of the same bug: resolution never clamps (director
        // B2) and the ref guard means the pair never re-resolves, so a carried
        // out-of-range week would sit there for the rest of the session.
        const clock = makeClock({ currentWeek: 3, maxWeek: 4 });
        const { result, rerender } = setup('/?week=9', { groupId: 'g1', tierId: 't1', clock });
        expect(result.current.week).toBe(9); // unclamped at resolve time, by design

        rerender({ groupId: 'g1', tierId: 't2', clock }); // t2 has nothing stored

        expect(result.current.week).toBe(3); // t2 follows the clock
        expect(result.current.isCurrent).toBe(true);
        expect(result.current.search).not.toContain('week=');
      },
    );

    it('a tier switch still falls through v2 → legacy → clock for the NEW tier', () => {
      // Skipping the URL step must skip ONLY the URL step: the rest of the
      // chain (including the read-only legacy fallback) is unchanged.
      localStorage.setItem(logWeekKey('g1', 't1'), '2');
      localStorage.setItem(LEGACY_KEY('g1', 't2'), '1');
      const clock = makeClock({ currentWeek: 3, maxWeek: 4 });
      const { result, rerender } = setup('/?week=2', { groupId: 'g1', tierId: 't1', clock });

      rerender({ groupId: 'g1', tierId: 't2', clock });

      expect(result.current.week).toBe(1);
      expect(result.current.search).toContain('week=1');
      expect(localStorage.getItem(logWeekKey('g1', 't2'))).toBeNull(); // legacy read never migrates
    });

    it('a tier whose v2 key holds the "current" sentinel clears the carried ?week=', () => {
      localStorage.setItem(logWeekKey('g1', 't1'), '2');
      localStorage.setItem(logWeekKey('g1', 't2'), CURRENT_WEEK_SENTINEL);
      localStorage.setItem(LEGACY_KEY('g1', 't2'), '1'); // stale V1 leftover — must stay ignored
      const clock = makeClock({ currentWeek: 3, maxWeek: 4 });
      const { result, rerender } = setup('/?week=2', { groupId: 'g1', tierId: 't1', clock });

      rerender({ groupId: 'g1', tierId: 't2', clock });

      expect(result.current.week).toBe(3);
      expect(result.current.isCurrent).toBe(true);
      expect(result.current.search).not.toContain('week=');
    });

    it('the re-resolve URL write preserves sibling params and stays a REPLACE', () => {
      localStorage.setItem(logWeekKey('g1', 't2'), '4');
      const clock = makeClock({ currentWeek: 3, maxWeek: 4 });
      const { result, rerender } = setup('/?tier=abc&lview=log&week=2', {
        groupId: 'g1',
        tierId: 't1',
        clock,
      });

      rerender({ groupId: 'g1', tierId: 't2', clock });

      expect(result.current.search).toContain('tier=abc');
      expect(result.current.search).toContain('lview=log');
      expect(result.current.search).toContain('week=4');
      expect(result.current.navigationType).toBe('REPLACE');
    });

    // ── The mirror is gated on the Log being visible (fix round 2) ──
    // Every test above runs with the gate OPEN (`mirrorToUrl` defaults to true
    // in the harness), which is the Log-visible half of the rule. These cover
    // the closed half: the hook is mounted screen-wide by `Loot.tsx`, so a
    // tier switch made from Priority/History must not plant a `?week=` that
    // no on-screen control can clear.

    it(
      'a tier switch with the Log NOT showing DELETES ?week= — while still resolving the new ' +
        "tier's stored week, so the Log is already right when it is opened",
      () => {
        localStorage.setItem(logWeekKey('g1', 't1'), '2');
        localStorage.setItem(logWeekKey('g1', 't2'), '4');
        const clock = makeClock({ currentWeek: 3, maxWeek: 4 });
        const { result, rerender } = setup('/?lview=priority&week=2', {
          groupId: 'g1',
          tierId: 't1',
          clock,
          mirrorToUrl: false,
        });

        rerender({ groupId: 'g1', tierId: 't2', clock, mirrorToUrl: false });

        // Resolution is UNCONDITIONAL — only the URL write is gated.
        expect(result.current.week).toBe(4);
        // …and the param is gone, not left holding t1's 2 (plain gating would
        // leave the previous tier's week armed, which is strictly worse).
        expect(result.current.search).not.toContain('week=');
        expect(result.current.search).toContain('lview=priority'); // siblings survive
      },
    );

    it('a tier switch with the Log NOT showing clears ?week= even when the new tier follows the clock', () => {
      const clock = makeClock({ currentWeek: 3, maxWeek: 4 });
      const { result, rerender } = setup('/?week=2', {
        groupId: 'g1',
        tierId: 't1',
        clock,
        mirrorToUrl: false,
      });

      rerender({ groupId: 'g1', tierId: 't2', clock, mirrorToUrl: false }); // nothing stored for t2

      expect(result.current.week).toBe(3);
      expect(result.current.search).not.toContain('week=');
    });

    it('a tier switch with the Log NOT showing and no ?week= present navigates not at all', () => {
      // The `mirrored !== urlWeek` guard: deleting an absent param would still
      // be a REPLACE navigation on every tier switch, for nothing.
      localStorage.setItem(logWeekKey('g1', 't2'), '4');
      const clock = makeClock({ currentWeek: 3, maxWeek: 4 });
      const { result, rerender } = setup('/?lview=priority', {
        groupId: 'g1',
        tierId: 't1',
        clock,
        mirrorToUrl: false,
      });
      expect(result.current.navigationType).toBe('POP'); // the initial entry

      rerender({ groupId: 'g1', tierId: 't2', clock, mirrorToUrl: false });

      expect(result.current.week).toBe(4);
      expect(result.current.navigationType).toBe('POP'); // never became a REPLACE
    });

    it('a MOUNT deep link is never cleared, even with the Log not showing', () => {
      // Only tier/group re-resolves clear. A hand-built
      // `?week=4&lview=priority` link is the author's own business, and the
      // deep-link contract must survive the gate untouched.
      const clock = makeClock({ currentWeek: 3, maxWeek: 4 });
      const { result } = setup('/?lview=priority&week=4', {
        groupId: 'g1',
        tierId: 't1',
        clock,
        mirrorToUrl: false,
      });

      expect(result.current.week).toBe(4);
      expect(result.current.search).toContain('week=4');
      expect(result.current.navigationType).toBe('POP');
    });

    it('setWeek still mirrors to the URL regardless of the gate (the gate is re-resolve-only)', () => {
      // `setWeek` only ever runs from a week control, which only the Log
      // renders — gating it too would be dead weight, and a Log that could not
      // write its own week. Pinned so the gate can't creep into setWeek.
      const clock = makeClock({ currentWeek: 3, maxWeek: 4 });
      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock, mirrorToUrl: false });

      act(() => result.current.setWeek(2));

      expect(result.current.search).toContain('week=2');
      expect(localStorage.getItem(logWeekKey('g1', 't1'))).toBe('2');
    });
  });

  describe('storage guard', () => {
    it('survives a throwing localStorage on both read and write', () => {
      // Spies are restored by the top-level afterEach (vi.restoreAllMocks()),
      // not inline here — an inline-only restore leaks a throwing spy into
      // every later test if an assertion above it fails first.
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('denied');
      });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('denied');
      });

      const { result } = setup('/', { groupId: 'g1', tierId: 't1', clock: makeClock({ currentWeek: 3, maxWeek: 4 }) });
      expect(result.current.week).toBe(3);
      expect(() => act(() => result.current.setWeek(2))).not.toThrow();
      expect(result.current.week).toBe(2);
      expect(() => act(() => result.current.followClock())).not.toThrow();
      expect(result.current.week).toBe(3);
    });
  });
});
