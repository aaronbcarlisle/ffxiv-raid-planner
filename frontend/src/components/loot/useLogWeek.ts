/**
 * useLogWeek — the Log tab's week model (Phase D slice D4, R-15).
 *
 * R-15 makes the week the *Log tab's* property, not Loot's: Priority always
 * ranks against the shared `WeekClock`'s current week, and the old
 * `scopedWeekOverride` local state in `Loot.tsx` goes away entirely once this
 * hook is wired in (Task 4). This hook is the whole model for "which week is
 * the Log looking at" — resolution, stepping, and persistence all live here.
 *
 * Co-located with its screen (`components/loot/`), not the shared `hooks/`
 * tree — same call as `roster/useRosterSortPreset.ts` and for the same
 * reason: this is a v2-Loot-only concern, not a cross-surface primitive.
 *
 * ── The override, not the number ──
 * Internal state is `override: number | null`. `null` means "follow the
 * clock" — `week` derives as `override ?? clock.currentWeek`. That single
 * `null` state is what makes `followClock()` a one-line state clear instead
 * of having to know what "current" currently resolves to, and what keeps a
 * freshly-mounted Log correct while `fetchCurrentWeek` is still in flight
 * (see the resolution note below).
 *
 * ── Resolution order — `?week=` wins on MOUNT ONLY (fix round 2, user-ruled) ──
 * FIRST resolve (fresh mount / deep link): `?week=` →
 * `v2-history-week-{groupId}-{tierId}` → legacy
 * `history-week-{groupId}-{tierId}` → `null` (follow the clock). Legacy's key
 * is read as a fallback and *never* written — the `useRosterSortPreset`
 * shape: continuity flows legacy → v2, never back, so the frozen V1 shell
 * never sees a v2-originated value on its next visit.
 *
 * Every LATER resolve (a groupId/tierId change on a live component) SKIPS the
 * `?week=` step and starts at the NEW tier's v2 key. `setWeek` mirrors the
 * displayed week into `?week=`, so by the time the user switches tier the
 * param normally holds this hook's own write for the PREVIOUS tier: reading
 * it would carry that week across, shadow the new tier's stored preference
 * entirely, and let the first chevron click overwrite it. Worse, a carried
 * week above the new tier's range would never be corrected — resolution
 * deliberately does not clamp (B2 below), and the ref guard means the pair
 * never re-resolves. `lastKeyRef.current === null` is precisely "this is the
 * first resolve", so the ref that guards re-entry also tells the two cases
 * apart; deep links (D6/D11) keep working because they arrive on a mount.
 *
 * ── The `'current'` sentinel (fix round 1, director-ruled) ──
 * Legacy's `HistoryView.tsx:122` writes `history-week-{groupId}-{tierId}`
 * *unconditionally* on every week change, so any V1 user who ever changed
 * the week in History has that key sitting in storage forever — legacy never
 * clears it even when the selection lands back on the current week. If this
 * hook's "clear on current" simply *removed* the v2 key (as it did before
 * this fix), the next mount or tier round-trip would fall through past the
 * (now-absent) v2 key straight to that stale legacy key and resurrect it —
 * `followClock()`/R-22's go-to-current would appear to work and then
 * silently revert. Since the legacy key is never written *or removed* here,
 * removing the v2 key can never outrun it.
 *
 * The fix: the v2 key holds either a week number *or the literal string
 * `'current'`*. A current-week target writes `'current'` instead of
 * removing the key. On read, `'current'` resolves to `null` and STOPS —
 * it never falls through to legacy, which is what breaks the loop above.
 * A v2 key holding a valid integer still wins over legacy, and a malformed
 * v2 value (neither `'current'` nor a valid integer) falls through to
 * legacy exactly as before.
 *
 * Resolution deliberately does NOT clamp against `clock.maxWeek` — this was
 * REV 1's bug (director B2). `lootTrackingStore` initialises
 * `currentWeek: 1, maxWeek: 1` and only corrects them from an async
 * `fetchCurrentWeek` effect in `Loot.tsx`, so at the moment resolution runs
 * the upper bound is provisionally 1. Clamping here would silently discard
 * every `?week=N` (N > 1) on a cold load — breaking the exact deep-link
 * substrate this slice exists to lay — and the ref guard below means it
 * would never get a chance to re-resolve once the store settles. Any
 * integer >= 1 is accepted, matching legacy's own (deliberately unclamped)
 * rule (`HistoryView.tsx:105-109`). `NaN`, non-integers, and values <= 0
 * fall through to `null`.
 *
 * Clamping lives on `setWeek` only, against `1 … Math.max(clock.maxWeek,
 * clock.currentWeek)`. Once the clock settles this derives correctly;
 * before that, a resolved week outside the provisional range is simply a
 * week the user can step back from.
 *
 * ── Tier re-resolve ──
 * v2's `Loot` mounts un-keyed (`NewShell.tsx`), so a tier switch re-runs
 * effects on a live component rather than remounting it — a `useState`
 * lazy initializer would never fire again. Resolution therefore runs
 * entirely inside a `useEffect` keyed on `[groupId, tierId]`, guarded by a
 * ref holding the last-resolved key so the effect only ever resolves once
 * per distinct group/tier pair. That ref does double duty: a `null` value is
 * what marks the first resolve, which is what gates the `?week=` step above.
 *
 * A re-resolve also re-points the `?week=` mirror at whatever the new tier
 * resolved to — removing the param when the new tier follows the clock —
 * through `writeWeekParam`, the same single writer `setWeek` uses. Without
 * that the param would go on advertising the previous tier's week while the
 * Log displays another (and a shell toggle would hand that stale week to
 * legacy History). Storage is NOT touched on a re-resolve: nothing was
 * chosen, so the `'current'` sentinel's meaning is left exactly as found.
 *
 * ── Persistence + URL, one rule ──
 * Any target equal to `clock.currentWeek` *clears* the in-memory override,
 * writes the `'current'` sentinel to the v2 storage key (see above — NOT a
 * removal), and removes `?week=`; any other target writes the concrete week
 * to all three. `followClock()` is therefore just `setWeek(clock.currentWeek)`.
 *
 * This is a deliberate delta from legacy, which writes localStorage
 * unconditionally (`HistoryView.tsx:122`) while only deleting the URL param
 * when the target equals the current week (`:131-132`). Storing "follow the
 * clock" as the `'current'` sentinel instead of a concrete number means a
 * returning user whose clock has since advanced lands on the *new* current
 * week rather than a now-stale stored one.
 *
 * ── Storage guard ──
 * Safari private mode / blocked-storage embeds throw from the accessor
 * itself, so every read and write is wrapped in try/catch and degrades to
 * "not persisted" — the `Loot.tsx:130-161` pattern.
 *
 * When `groupId`/`tierId` is undefined there is no tier context to key
 * storage on, so the hook doesn't touch storage at all — it just follows
 * the clock (resolution short-circuits to `null`).
 *
 * URL writes all go through one function (`writeWeekParam`) — there is no
 * second `?week=` writer in this hook — using `useSearchParams`'s functional
 * updater with `{ replace: true }` so sibling params (`?tier=`, `?lview=`, …) survive —
 * legacy's `HistoryView.tsx:129-137` pattern. This hook uses raw
 * `useSearchParams`, not `useUrlTabState`: registering `week` there would
 * add it to `clearRegisteredTabParams`'s seed, which `setPageMode`
 * (`useGroupViewState.ts:320`) calls on every primary-tab switch in BOTH
 * shells — that would make a V1 primary-tab switch start wiping the
 * legacy History view's own `?week=`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { WeekClock } from '../../hooks/useWeekClock';

export interface LogWeek {
  week: number;
  isCurrent: boolean;
  canPrev: boolean;
  canNext: boolean;
  setWeek(w: number): void;
  prev(): void;
  next(): void;
  followClock(): void;
}

/** v2-scoped write key (never legacy's `history-week-{groupId}-{tierId}`). */
export function logWeekKey(groupId: string, tierId: string): string {
  return `v2-history-week-${groupId}-${tierId}`;
}

/** Legacy's per-tier key. Read-only here: continuity in, nothing out. */
function legacyLogWeekKey(groupId: string, tierId: string): string {
  return `history-week-${groupId}-${tierId}`;
}

/**
 * The v2 key's "follow the clock" sentinel — see the doc header's
 * "'current' sentinel" note. Deliberately NOT a removal: legacy writes its
 * own key unconditionally, so removing ours would fall through to a stale
 * legacy value forever.
 */
export const CURRENT_WEEK_SENTINEL = 'current';

/**
 * Parses a week value from a URL param or storage string. Any integer >= 1
 * is accepted — deliberately unclamped (see the doc header's B2 note).
 * `NaN`, non-integers, and values <= 0 fall through to `null`.
 */
function parseWeek(raw: string | null): number | null {
  if (raw == null || !/^-?\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

type V2Read =
  | { kind: 'current' }
  | { kind: 'week'; week: number }
  | { kind: 'absent' };

/** Reads the v2 key only, distinguishing the sentinel from a real week from
 *  "nothing usable here" — the caller decides what "absent" falls through to. */
function readV2Week(groupId: string, tierId: string): V2Read {
  try {
    const raw = localStorage.getItem(logWeekKey(groupId, tierId));
    if (raw === CURRENT_WEEK_SENTINEL) return { kind: 'current' };
    const parsed = parseWeek(raw);
    if (parsed !== null) return { kind: 'week', week: parsed };
  } catch {
    // Ignore localStorage errors (private mode / disabled / quota).
  }
  return { kind: 'absent' };
}

function readLegacyWeek(groupId: string, tierId: string): number | null {
  try {
    return parseWeek(localStorage.getItem(legacyLogWeekKey(groupId, tierId)));
  } catch {
    return null;
  }
}

/**
 * `?week=` → v2 storage (`'current'` STOPS here, resolving to `null` without
 * ever consulting legacy) → legacy storage → `null` (follow the clock).
 *
 * `urlWeek` is the raw `?week=` value on a FIRST resolve and always `null` on
 * a tier/group re-resolve — see the doc header's "mount only" rule. The two
 * cases share this function precisely so the storage half stays identical.
 */
function resolveOverride(
  groupId: string | undefined,
  tierId: string | undefined,
  urlWeek: string | null,
): number | null {
  const fromUrl = parseWeek(urlWeek);
  if (fromUrl !== null) return fromUrl;
  // No tier context: don't touch storage at all, just follow the clock.
  if (!groupId || !tierId) return null;

  const v2 = readV2Week(groupId, tierId);
  if (v2.kind === 'current') return null; // sentinel: stop, never fall through to legacy
  if (v2.kind === 'week') return v2.week;
  return readLegacyWeek(groupId, tierId);
}

export function useLogWeek(
  groupId: string | undefined,
  tierId: string | undefined,
  clock: WeekClock,
): LogWeek {
  const [searchParams, setSearchParams] = useSearchParams();
  const [override, setOverride] = useState<number | null>(null);

  /**
   * The hook's ONLY `?week=` writer. `null` removes the param, anything else
   * sets it; sibling params survive via the functional updater, and the write
   * is always a REPLACE. Both callers — `setWeek` and the re-resolve effect —
   * go through here rather than each owning a `setSearchParams` call.
   */
  const writeWeekParam = useCallback(
    (value: string | null) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (value === null) params.delete('week');
          else params.set('week', value);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Re-resolve on mount and on every groupId/tierId change. Ref-held key
  // guards against the effect resolving more than once for the same pair
  // (e.g. a dev double-invoke) — see the doc header's "Tier re-resolve" note.
  const lastKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${groupId ?? ''}::${tierId ?? ''}`;
    if (lastKeyRef.current === key) return;
    const isFirstResolve = lastKeyRef.current === null;
    lastKeyRef.current = key;

    const urlWeek = searchParams.get('week');
    // `?week=` participates on MOUNT ONLY (user-ruled). On a tier/group change
    // the param usually holds this hook's own mirror of the PREVIOUS tier, so
    // feeding it back in would shadow the new tier's stored week — see the
    // doc header's resolution-order note.
    const resolved = resolveOverride(groupId, tierId, isFirstResolve ? urlWeek : null);
    setOverride(resolved);

    if (isFirstResolve) return;
    // Re-point the mirror at what the NEW tier resolved to (absent = following
    // the clock) so the previous tier's week can't linger in the URL.
    const mirrored = resolved === null ? null : String(resolved);
    if (mirrored !== urlWeek) writeWeekParam(mirrored);
    // Intentionally re-resolves only on groupId/tierId changes, not on every
    // searchParams identity change — see the doc header's resolution-order note.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, tierId]);

  const week = override ?? clock.currentWeek;
  const max = Math.max(clock.maxWeek, clock.currentWeek);
  const isCurrent = clock.isCurrent(week);
  const canPrev = week > 1;
  const canNext = week < max;

  const setWeek = useCallback(
    (w: number) => {
      const clamped = Math.min(Math.max(w, 1), Math.max(clock.maxWeek, clock.currentWeek));
      const clearing = clamped === clock.currentWeek;

      setOverride(clearing ? null : clamped);

      if (groupId && tierId) {
        try {
          localStorage.setItem(
            logWeekKey(groupId, tierId),
            clearing ? CURRENT_WEEK_SENTINEL : String(clamped),
          );
        } catch {
          // Ignore localStorage errors (private mode / disabled / quota).
        }
      }

      writeWeekParam(clearing ? null : String(clamped));
    },
    [clock.maxWeek, clock.currentWeek, groupId, tierId, writeWeekParam],
  );

  const prev = useCallback(() => {
    if (!canPrev) return;
    setWeek(week - 1);
  }, [canPrev, setWeek, week]);

  const next = useCallback(() => {
    if (!canNext) return;
    setWeek(week + 1);
  }, [canNext, setWeek, week]);

  const followClock = useCallback(() => {
    setWeek(clock.currentWeek);
  }, [setWeek, clock.currentWeek]);

  return { week, isCurrent, canPrev, canNext, setWeek, prev, next, followClock };
}
