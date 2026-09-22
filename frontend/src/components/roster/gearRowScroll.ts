/**
 * scrollToGearRow — bring a jumped-to gear row into view (Phase D, D12,
 * R-18's destination).
 *
 * A DELIBERATE FORK of legacy `hooks/useViewNavigation.ts:25-52`'s
 * `scrollIntoViewWhenReady`, not an extraction of it (R-D12-J). That helper is
 * module-private inside a hook V1 consumes, so extracting it would make a
 * v2-only slice reach into the shared layer for zero V1 benefit — §2.1's
 * fork-shells/share-leaves rule, and the same call D6 made for `useAltHeld`
 * ("extract to hooks/ (NO V1 consumer) or duplicate" — here there IS one).
 *
 * ⚠ PRECEDENCE, stated exactly — the card wins whenever the row is absent on
 * the tick that finds anything. Both ids are re-resolved every tick, but the
 * `??` fallback is evaluated on the SAME tick as the row, so a card present at
 * tick 1 is scrolled and the loop exits; a row that mounts later never gets
 * looked at. The loop therefore only runs while NEITHER element exists.
 *
 * That is correct HERE, and only here. Task 4 calls this from a post-commit
 * effect inside an already-mounted `Roster`, where density is a global view
 * toggle (`RosterCards`) rather than a per-card animation — `RosterGearTable`
 * has already committed synchronously if it ever will, so tick 1 sees the
 * final state. There is no "card mid-expand" state in v2 to lose to.
 *
 * The poll is kept as a cheap net for a first paint that hasn't landed yet
 * (it costs nothing when the element is already there), and because legacy's
 * copy needs it — that one fires BEFORE `setPageMode('roster')` has rendered
 * anything. ⚠ If a future change makes the gear table mount late (lazy,
 * Suspense, AnimatePresence, deferred value), this precedence silently
 * downgrades every expanded-card jump to a card-level one. Defer the fallback
 * until the budget is spent if that day comes.
 *
 * Why the card fallback: the row exists only in expanded density
 * (`RosterGearTable` does not mount in compact) and, for `tome_weapon`, only
 * while the player is pursuing one. R-D12-F routes these misses and Board view
 * (where both fail to exist) to the card — legacy's own fallback
 * (`useViewNavigation.ts:135-138`), already pulsing from `?player=`.
 *
 * Interaction with `GroupViewContent`'s own 100 ms `player-card-{id}` scroll:
 * both use `block: 'center'` and the row is INSIDE the card, so whichever
 * lands later is correct. The +220 ms re-center below is what makes that
 * deterministic in the one ordering that matters (row found early, card scroll
 * at 100 ms overriding it).
 */
import { gearRowDomId, type JumpAnchorSlot } from './rosterLedgerJumps';

const CENTER: ScrollIntoViewOptions = { behavior: 'smooth', block: 'center' };

export function scrollToGearRow(
  playerId: string,
  slot: JumpAnchorSlot,
  { attempts = 24, interval = 40 }: { attempts?: number; interval?: number } = {},
): () => void {
  let tries = 0;
  // Only ever one timer is pending at a time (the next poll, or the re-center).
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = () => {
    const el =
      document.getElementById(gearRowDomId(playerId, slot)) ??
      document.getElementById(`player-card-${playerId}`);
    if (el) {
      el.scrollIntoView(CENTER);
      timer = setTimeout(() => el.scrollIntoView(CENTER), 220);
      return;
    }
    if (++tries < attempts) timer = setTimeout(tick, interval);
  };

  tick();

  return () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
