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
 * Why polling, stated honestly: at THIS call site the poll almost never loops.
 * We run from an effect inside an already-mounted `Roster`, where the card
 * exists at tick 1 — so the `?? player-card-` fallback short-circuits
 * immediately even when the row is still settling. (Legacy's copy fires BEFORE
 * `setPageMode('roster')` has rendered anything, which is where the 24-attempt
 * loop earns its keep.) The loop is kept for the one case that does need it —
 * a card mid-expand — and because the row is checked FIRST on every tick, so a
 * late row still wins over the early card.
 *
 * Why the card fallback: the row exists only when the card is EXPANDED
 * (`RosterGearTable` does not mount in compact density) and, for
 * `tome_weapon`, only while the player is pursuing one. R-D12-F routes all
 * three misses to the card — which is legacy's own fallback
 * (`useViewNavigation.ts:135-138`) and is already pulsing from `?player=`.
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
