# Phase D · D12 — The jumps

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both halves of the gear↔ledger jump land on the *row* that actually holds the
thing — `RosterGearTable` gains `gear-row-{playerId}-{slot}` anchors and a pulse (R-18's
destination), and `RosterCard`'s entry jumps stop hard-coding `lview=history` and split by week
(R-28).

**Architecture:** Two directions over one shared pure module. `components/roster/rosterLedgerJumps.ts`
already answers *"which ledger entry does this gear slot point at"* and is already imported by three
`loot/` files (`LogWeekGrid`, `LootHistoryTable`, `BookLedgerCard` — all `ring0`, so this is an
intra-ring import, not a boundary cross). D12 adds its inverse — *"which gear row does this ledger
entry point at"* — plus the anchor-id author and the week-split predicate, so both directions are
unit-testable without a card, a grid or a router. The Loot→Roster half rides a new `?slot=` param
next to the shipped `?player=`; the Roster→Loot half resolves the Log's displayed week with
`useLogWeek`'s **own** resolver, so the card's routing decision and the Log's later mount can never
disagree.

**Tech Stack:** React 19 · TypeScript · react-router `useSearchParams` · Zustand (`lootTrackingStore`)
· Vitest + Testing Library · Tailwind 4 semantic tokens.

**Spec:**
- `design/redesign/specs/phase-d-loot-plan.md:200` — the D12 slice row (binding scope).
- `design/redesign/specs/phase-d-loot-design.md:703-782` — **R-18**, its three implementation notes,
  and D6a's build note (which names D12 as the slice that retargets the callback).
- `design/redesign/specs/phase-d-loot-design.md:1016-1024` — **R-28**.
- `design/redesign/specs/phase-d-loot-design.md:428` — D7's Books-only retarget, which states the
  loot/material half stays on History "until **D12**".

---

## Global Constraints

Copied verbatim from the phase spec and `CLAUDE.md`; every task's requirements include these.

- **Jumps are `Alt+Click` ONLY, never a plain click** (C7/D-55, restated in R-18 and in the user's
  standing ruling). D12 changes jump *destinations*; it does **not** touch the modifier family, the
  `detail === 0` AT route, the `Enter` route, or `useAltHeld`'s cursor swap.
- **No AI attribution** on commits or PRs — no `Co-Authored-By`, no "Generated with", nothing.
  Absolute and non-negotiable (`CLAUDE.md`).
- **Design system:** never raw `<button>`/`<input>`/`<select>`; never a hardcoded colour; `text-xs`
  (12 px) floor. `design-system-ignore: <reason>` is the only escape hatch, always with a reason.
- **`pnpm build` runs `tsc -b`, not `tsc --noEmit`.** `tsc --noEmit` does not catch what CI catches.
- **V1 safety, two-part assert (phase DoD 3):** (a) `git diff --stat` over legacy-only paths is
  empty, and (b) every hunk in a shared file is enumerated in the PR body with the exact V1 render
  path it reaches. D12 touches exactly **one** shared file — `pages/GroupViewContent.tsx` — for
  exactly **one** line. See Task 8.
- **Release note:** `internal: true`, `pr` + `prTitle` (never `commits`), `CURRENT_VERSION`
  unchanged. Invoke the `pr-checklist` skill before opening the PR.
- **`?slot=` is deliberately NOT registered with `useUrlTabState`** — for the same reason `week`
  isn't (`Loot.tsx`'s header, `useLogWeek.ts:144-149`): registering it adds it to
  `clearRegisteredTabParams`'s seed, which `setPageMode` calls on every primary-tab switch in
  **both** shells.
- **Mobile is deferred to Phase P** by standing ruling — recorded, not silently skipped.
- Gates to hold: **≥3117 tests**, **0 lint errors** against the **903-warning ceiling**, knip
  **181 / 140**, `pnpm build` clean, `check:design-system:strict` clean, `tokens:check` in sync,
  `pnpm dupes` green, and the D12 mutation battery reporting **`Battery OK`**.

---

## 1. Opening position — what this slice makes honest

Three affordances currently over-promise or under-deliver, and every one of them was left that way
*on purpose*, with the interim named in the spec:

| Today | Where | Why it's dishonest |
|---|---|---|
| `Alt+Click` a Log cell / History row → the **card** | `Loot.tsx:754` `jumpToRecipient` | The menu item says "Jump to {player}" but the user asked about a *slot*. D6a's build note calls this "card-level, **by stated interim**". |
| `Alt+Click` a gear slot → **History**, always | `RosterCard.tsx:281-297` `jumpToEntry` | R-28 ruled the destination splits by week in D-30; D7 retargeted only the books half and said so at `phase-d-loot-design.md:428`. |
| The gear table has **no row ids and no pulse** | `RosterGearTable.tsx` | R-18 note 2: "The jump destination is net-new" — the anchors live only in frozen legacy `GearTable.tsx:324,659`. |

D12 closes all three. It adds no new modifier, no new menu item, and no new copy beyond one
`aria-label`.

---

## 2. Rulings taken this slice

Recorded here and written back into `phase-d-loot-design.md` §3 in Task 9, so a later bot pass
cannot reopen them.

| # | Ruling | Rationale | Risk if wrong |
|---|---|---|---|
| **R-D12-A** | The Roster→Loot split is **`lview=log` iff `entry.weekNumber === the Log's displayed week`; every other case → `lview=history`.** Not "older → History" — *anything not in the displayed week*. | R-28's prose only names the older case, but an entry **newer** than the displayed week is equally absent from that week's grid. One symmetric rule beats two asymmetric ones. **User-ruled 2026-09-22.** | Routing a newer entry to the Log would make `Loot.tsx`'s out-of-week correction fire `logWeek.setWeek`, which **persists** the new week into `v2-history-week-*` — a jump silently moving the user's working week. |
| **R-D12-B** | "The displayed week" is resolved with `useLogWeek`'s **own** `resolveOverride` (`?week=` → v2 key → legacy key → clock), exported for this purpose. Not re-derived. | `Loot` genuinely **unmounts** on a tab switch (`GroupViewContent.tsx:977` renders the gear slot only while `pageMode === 'gear'`), so `useLogWeek`'s mount-only `?week=` read fires on **every** roster→Loot jump. Same function, same inputs, same answer — the card's decision and the Log's later resolve cannot disagree. | A re-derivation drifts the moment either side changes, and the failure is silent: the Log opens on a week whose grid does not hold the pulsed entry. |
| **R-D12-C** | While the clock is **provisional** (`Math.max(clock.maxWeek, clock.currentWeek) === 1`) every entry jump routes to **History**. | `lootTrackingStore` starts `currentWeek: 1, maxWeek: 1`. Routing to the Log against a provisional clock lets `Loot.tsx`'s correction effect fire `setWeek` and write the `'current'` sentinel — the exact clobber the F1/F2 guards in that file exist to prevent. History has no week axis, so it is always a correct destination. | **Disclosed residual:** a genuine week-1 tier also has ceiling 1, so its slot jumps land on History rather than the Log cell. Same trade-off R-D11-N already documents for the same guard; the entry is still found and still pulses. |
| **R-D12-D** | The jump writes **no `?week=`** and never calls `setWeek`. It preserves whatever `?week=` is already in the URL. | That param is the first input to R-D12-B's resolver. Writing it would be either redundant (Log branch, we only route there when it already matches) or actively harmful (it arms the disclosed legacy-History seeding cohort — `Loot.tsx`'s header). | Writing a week turns a read-only navigation into a persisted preference change. |
| **R-D12-E** | A material entry with `slotAugmented === 'tome_weapon'` lands on the **tome sub-row's own anchor**, `gear-row-{playerId}-tome_weapon` — **not** normalized to the weapon row. | v2 already ruled this direction: `rosterLedgerJumps.ts:52-57` keeps `tome_weapon` off the weapon row because "the tome sub-row's own jump owns it (C4)". The inverse mapping must agree. Legacy's `useViewNavigation.ts:125` normalizes to `weapon`; that is a **named delta**, not parity drift. **User-ruled 2026-09-22.** | Landing on the weapon row pulses a row about the *raid* weapon while the user asked about the *tome* one. |
| **R-D12-F** | A jump whose anchor slot does not resolve to a **rendered** row falls back to the **card** — no error, no toast. Three causes: `slotAugmented` is `null` (universal tomestone, already ruled at `phase-d-loot-plan.md:200`); the roster is in **compact** density so `RosterGearTable` never mounts; the tome sub-row is absent because the player is not pursuing. | Legacy's own reference behaviour: `startScroll(() => gear-row-…, () => player-card-…)` (`useViewNavigation.ts:135-138`) carries exactly this fallback. The card pulse is already wired from `?player=`, so the fallback costs nothing. | A dead-scroll with no pulse reads as a broken jump. |
| **R-D12-G** | **Both** the card and the slot row pulse. | Legacy parity — `handleNavigateToPlayer` sets `setHighlightedPlayerId` **and** `setHighlightedSlot` (`useViewNavigation.ts:131-132`), so both pulse there too. `?player=` is already in the URL, so the card pulse needs no new code, and it is the "where am I" cue on a long roster. **User-ruled 2026-09-22.** | Suppressing the card pulse costs new code in `Roster.tsx` and loses the coarse cue. |
| **R-D12-H** | A generic `itemSlot: 'ring'` loot entry anchors to **`ring1`**. | Legacy parity (`useViewNavigation.ts:126`) and the only available answer — the loot log stores one `ring` slot while gear tracks `ring1`/`ring2`, and nothing in the entry distinguishes them. It is the mirror of `findLootEntry`'s ring fallback, which lets **both** ring rows claim a generic entry. | Picking `ring2` or nothing would surprise; the asymmetry (one→both outbound, one→first inbound) is inherent to the data and is documented in the module. |
| **R-D12-I** | `?slot=` is stripped by **`GroupViewContent`'s existing `?player=` timer**, not by a second writer in `Roster.tsx`. | `Roster.tsx:352-353`'s header comment already rules that Roster must not touch the URL — `GroupViewContent.tsx:255-259` owns the strip. Two writers on the same 2500 ms boundary race. One line, in the effect that already exists. | A second URL writer produces a lost-update race that only shows up under timing. |
| **R-D12-J** | The row scroll is a **v2-local** poller (`components/roster/gearRowScroll.ts`), a deliberate fork of `useViewNavigation.ts:25-52`'s `scrollIntoViewWhenReady`, **not** an extraction of it. | That helper is module-private inside a hook V1 consumes; extracting it is a V1 edit for zero V1 benefit. §2.1's fork-shells/share-leaves rule and D6's own `useAltHeld` precedent ("extract to `hooks/` (**no V1 consumer**) or duplicate") point the same way — here there **is** a V1 consumer. | Editing `useViewNavigation.ts` turns a v2-only slice into a shared-layer reach needing the two-part assert. |

### What D12 explicitly does NOT do

- It does not touch the modifier family, `useAltHeld`, the cursor swap, `detail === 0`, or any menu
  item's label.
- It does not touch `components/history/` (frozen V1), `player/GearTable.tsx` (frozen), or
  `hooks/useViewNavigation.ts`.
- It does not change the books jump — `handleBooksJump` already writes `lview=log&book=` (D7/R-14).
- It does not add a "no entry found" toast. `buildSlotJumpTargets`'s stated invariant is that
  availability **is** the target, so the affordance cannot resolve to nothing.

---

## 3. File structure

| File | Responsibility | Δ |
|---|---|---|
| `src/components/roster/rosterLedgerJumps.ts` | **+ the inverse mapping.** `jumpAnchorSlotOf` (entry → anchor slot), `gearRowDomId` (anchor slot → DOM id), `entryJumpView` (entry week + displayed week → `'log' \| 'history'`). Stays pure and store-free. | modify |
| `src/components/roster/rosterLedgerJumps.test.ts` | Tests for all three. | modify |
| `src/components/roster/gearRowScroll.ts` | **NEW.** v2-local poll-then-recenter scroll to a gear row, card fallback (R-D12-J). | create |
| `src/components/roster/gearRowScroll.test.ts` | **NEW.** Fake-timer tests. | create |
| `src/components/loot/useLogWeek.ts` | Export `resolveOverride` as `resolveLogWeekOverride` (R-D12-B). No behaviour change. | modify |
| `src/components/roster/RosterGearTable.tsx` | `playerId` + `highlightedSlot` props; `id`/pulse on every main row and on the tome sub-row. | modify |
| `src/components/roster/RosterCard.tsx` | Week-split routing in `jumpToEntry`; forwards `playerId`/`highlightedSlot` to the table. | modify |
| `src/components/roster/RosterCards.tsx` | Forwards `highlightedSlot` to the highlighted card only. | modify |
| `src/components/roster/Roster.tsx` | Reads/validates `?slot=`, owns the local slot highlight + its 2500 ms clear + the row scroll. | modify |
| `src/pages/GroupViewContent.tsx` | **ONE line** — `params.delete('slot')` in the existing `?player=` strip (R-D12-I). The only shared-file hunk. | modify |
| `src/components/loot/Loot.tsx` | `jumpToRecipient(playerId, slot?)` writes `?slot=`. | modify |
| `src/components/loot/LogWeekGrid.tsx` | Passes the entry's anchor slot to `onJumpToPlayer` (cell + menu). | modify |
| `src/components/loot/LootHistoryTable.tsx` | Same (row activation + menu). | modify |
| `scripts/d12-mutation-battery.py` | **NEW.** Harness inherited from `d11-mutation-battery.py`, incl. `--selftest`. | create |
| `design/redesign/specs/phase-d-loot-design.md` | D12 build note under R-18 and R-28; R-D12-A…J. | modify |
| `design/redesign/specs/phase-d-loot-plan.md` | D12 row → ✅ BUILT. | modify |
| `src/data/releaseNotes.ts` | `internal: true` entry. | modify |

Test files modified alongside their components: `RosterGearTable.test.tsx`, `RosterCard.test.tsx`,
`Roster.test.tsx`, `Loot.test.tsx`, `LogWeekGrid.test.tsx`, `LootHistoryTable.test.tsx`.

---

## 4. Tasks

### Task 1 — the inverse mapping (`rosterLedgerJumps.ts`)

**Files:**
- Modify: `frontend/src/components/roster/rosterLedgerJumps.ts`
- Test: `frontend/src/components/roster/rosterLedgerJumps.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks. `GEAR_SLOTS`, `GearSlot`, `LootLogEntry`, `MaterialLogEntry`
  from `../../types`; `HistoryItem` from `../loot/logWeekGridData` (an `ring0`→`ring0` import; the
  reverse already exists at `LogWeekGrid.tsx:154`).
- Produces, for every later task:
  ```ts
  export type JumpAnchorSlot = GearSlot | 'tome_weapon';
  export function jumpAnchorSlotOf(item: HistoryItem): JumpAnchorSlot | null;
  export function gearRowDomId(playerId: string, slot: JumpAnchorSlot): string;
  export function isJumpAnchorSlot(value: string): value is JumpAnchorSlot;
  export function entryJumpView(
    entryWeek: number | null | undefined,
    displayedWeek: number | null,
  ): 'log' | 'history';
  ```

- [ ] **Step 1: Write the failing tests**

Append to `rosterLedgerJumps.test.ts`:

```ts
import {
  jumpAnchorSlotOf,
  gearRowDomId,
  isJumpAnchorSlot,
  entryJumpView,
} from './rosterLedgerJumps';
import type { HistoryItem } from '../loot/logWeekGridData';
import type { LootLogEntry, MaterialLogEntry } from '../../types';

const loot = (over: Partial<LootLogEntry>): HistoryItem => ({
  kind: 'loot',
  entry: {
    id: 1, weekNumber: 3, floorNumber: 1, itemSlot: 'head', recipientPlayerId: 'p1',
    recipientName: 'Tank One', method: 'need', isExtra: false, createdAt: '2026-01-01T00:00:00Z',
    ...over,
  } as LootLogEntry,
});

const material = (over: Partial<MaterialLogEntry>): HistoryItem => ({
  kind: 'material',
  entry: {
    id: 1, weekNumber: 3, floorNumber: 1, materialType: 'twine', recipientPlayerId: 'p1',
    recipientName: 'Tank One', createdAt: '2026-01-01T00:00:00Z', slotAugmented: 'head',
    ...over,
  } as MaterialLogEntry,
});

describe('jumpAnchorSlotOf', () => {
  it('maps a loot entry to its own slot', () => {
    expect(jumpAnchorSlotOf(loot({ itemSlot: 'body' }))).toBe('body');
  });

  // R-D12-H: the loot log stores one `ring`; gear tracks ring1/ring2.
  it('anchors a generic ring loot entry to ring1', () => {
    expect(jumpAnchorSlotOf(loot({ itemSlot: 'ring' }))).toBe('ring1');
  });

  it('passes an explicit ring1/ring2 through unchanged', () => {
    expect(jumpAnchorSlotOf(loot({ itemSlot: 'ring2' }))).toBe('ring2');
  });

  it('returns null for an unknown itemSlot', () => {
    expect(jumpAnchorSlotOf(loot({ itemSlot: 'mount' }))).toBeNull();
  });

  it('maps a material entry to its augmented slot', () => {
    expect(jumpAnchorSlotOf(material({ slotAugmented: 'legs' }))).toBe('legs');
  });

  // R-D12-E: NOT normalized to 'weapon' — the sub-row owns it (C4).
  it('keeps tome_weapon as its own anchor, never the weapon row', () => {
    expect(jumpAnchorSlotOf(material({ slotAugmented: 'tome_weapon' }))).toBe('tome_weapon');
  });

  // R-D12-F / phase-d-loot-plan.md:200: universal tomestone lands on the card.
  it('returns null for a material entry with no slotAugmented', () => {
    expect(jumpAnchorSlotOf(material({ slotAugmented: null }))).toBeNull();
    expect(jumpAnchorSlotOf(material({ slotAugmented: undefined }))).toBeNull();
  });
});

describe('gearRowDomId', () => {
  it('builds the legacy-shaped anchor id', () => {
    expect(gearRowDomId('p1', 'head')).toBe('gear-row-p1-head');
    expect(gearRowDomId('p1', 'tome_weapon')).toBe('gear-row-p1-tome_weapon');
  });
});

describe('isJumpAnchorSlot', () => {
  it('accepts every gear slot and tome_weapon, rejects anything else', () => {
    expect(isJumpAnchorSlot('head')).toBe(true);
    expect(isJumpAnchorSlot('tome_weapon')).toBe(true);
    expect(isJumpAnchorSlot('ring')).toBe(false);   // normalized upstream, never an anchor
    expect(isJumpAnchorSlot('')).toBe(false);
    expect(isJumpAnchorSlot('__proto__')).toBe(false);
  });
});

describe('entryJumpView', () => {
  // R-D12-A: the displayed week, not "older".
  it('routes an entry in the displayed week to the Log', () => {
    expect(entryJumpView(3, 3)).toBe('log');
  });

  it('routes an OLDER entry to History', () => {
    expect(entryJumpView(2, 5)).toBe('history');
  });

  it('routes a NEWER entry to History too', () => {
    expect(entryJumpView(7, 5)).toBe('history');
  });

  // R-D12-C: a provisional clock is signalled by a null displayedWeek.
  it('routes to History when the displayed week is unknown', () => {
    expect(entryJumpView(3, null)).toBe('history');
  });

  it('routes to History when the entry has no week', () => {
    expect(entryJumpView(null, 3)).toBe('history');
    expect(entryJumpView(undefined, 3)).toBe('history');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
cd frontend && npx vitest run src/components/roster/rosterLedgerJumps.test.ts
```

Expected: FAIL — `jumpAnchorSlotOf is not a function` (and the same for the other three).

- [ ] **Step 3: Implement**

Append to `rosterLedgerJumps.ts` (and extend the import line to pull in `HistoryItem`):

```ts
/**
 * The gear-table row a ledger entry points at — the INVERSE of
 * `buildSlotJumpTargets` above, and deliberately its neighbour: one module
 * owns both directions of the same mapping, so they can never drift apart.
 *
 * Two deltas from legacy's `useViewNavigation.ts:125-127`, both ruled:
 *   - `tome_weapon` is NOT normalized to `weapon` (R-D12-E). v2 renders a real
 *     tome sub-row with its own anchor, and `findMaterialEntry` above already
 *     rules that a tome material must never attach to the weapon row.
 *   - `ring` → `ring1` IS kept (R-D12-H), because nothing in the entry can
 *     tell the two rings apart. Note the asymmetry with `findLootEntry`'s ring
 *     fallback, which lets BOTH ring rows claim one generic entry: outbound is
 *     one-to-many, inbound is one-to-first. That is inherent to the data.
 */
export type JumpAnchorSlot = GearSlot | 'tome_weapon';

const ANCHOR_SLOTS: ReadonlySet<string> = new Set<string>([...GEAR_SLOTS, 'tome_weapon']);

/** Is this string an anchor slot? The `?slot=` param's validator. */
export function isJumpAnchorSlot(value: string): value is JumpAnchorSlot {
  return ANCHOR_SLOTS.has(value);
}

/** The gear row's DOM id. Legacy's shape (`GearTable.tsx:324,659`), v2's anchors. */
export function gearRowDomId(playerId: string, slot: JumpAnchorSlot): string {
  return `gear-row-${playerId}-${slot}`;
}

/**
 * `null` = "no row to land on, use the card" (R-D12-F): a universal tomestone
 * (no `slotAugmented`), or an `itemSlot` that isn't a gear slot at all.
 */
export function jumpAnchorSlotOf(item: HistoryItem): JumpAnchorSlot | null {
  const raw = item.kind === 'loot' ? item.entry.itemSlot : item.entry.slotAugmented;
  if (!raw) return null;
  const normalized = raw === 'ring' ? 'ring1' : raw;
  return isJumpAnchorSlot(normalized) ? normalized : null;
}

/**
 * R-28's split, as one symmetric rule (R-D12-A): the Log holds exactly one
 * week's grid, so an entry reaches a Log CELL only when it is in the week the
 * Log will display. Older AND newer both go to History — R-28's prose names
 * only the older case, but a newer entry is just as absent from that grid.
 *
 * `displayedWeek === null` means the caller could not resolve one (R-D12-C: a
 * provisional week clock). History has no week axis, so it is always a correct
 * destination — and, unlike the Log, reaching it can never trigger
 * `Loot.tsx`'s out-of-week correction, which would PERSIST a week the user
 * never chose.
 */
export function entryJumpView(
  entryWeek: number | null | undefined,
  displayedWeek: number | null,
): 'log' | 'history' {
  if (entryWeek == null || displayedWeek == null) return 'history';
  return entryWeek === displayedWeek ? 'log' : 'history';
}
```

- [ ] **Step 4: Run them and watch them pass**

```bash
cd frontend && npx vitest run src/components/roster/rosterLedgerJumps.test.ts
```

Expected: PASS, all previously-existing tests in the file still green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/roster/rosterLedgerJumps.ts frontend/src/components/roster/rosterLedgerJumps.test.ts
git commit -m "feat(v2): D12 Task 1 — the inverse gear↔ledger mapping

jumpAnchorSlotOf / gearRowDomId / isJumpAnchorSlot / entryJumpView, beside
buildSlotJumpTargets so both directions of the same mapping have one author.

R-D12-A (the split is 'in the displayed week', not 'older'), R-D12-E
(tome_weapon keeps its own anchor), R-D12-H (generic ring -> ring1)."
```

---

### Task 2 — the row scroll (`gearRowScroll.ts`)

**Files:**
- Create: `frontend/src/components/roster/gearRowScroll.ts`
- Test: `frontend/src/components/roster/gearRowScroll.test.ts`

**Interfaces:**
- Consumes: `gearRowDomId`, `JumpAnchorSlot` from Task 1.
- Produces:
  ```ts
  export function scrollToGearRow(
    playerId: string,
    slot: JumpAnchorSlot,
    opts?: { attempts?: number; interval?: number },
  ): () => void;   // returns a cancel function
  ```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/roster/gearRowScroll.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrollToGearRow } from './gearRowScroll';

function mountEl(id: string) {
  const el = document.createElement('div');
  el.id = id;
  el.scrollIntoView = vi.fn();
  document.body.appendChild(el);
  return el;
}

describe('scrollToGearRow', () => {
  beforeEach(() => { vi.useFakeTimers(); document.body.innerHTML = ''; });
  afterEach(() => { vi.useRealTimers(); });

  it('scrolls the gear row as soon as it appears, then re-centers', () => {
    const row = mountEl('gear-row-p1-head');
    scrollToGearRow('p1', 'head');
    expect(row.scrollIntoView).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(220);
    expect(row.scrollIntoView).toHaveBeenCalledTimes(2);
    expect(row.scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('polls until the row mounts (the tab-switch animation)', () => {
    scrollToGearRow('p1', 'head');
    vi.advanceTimersByTime(120);
    const row = mountEl('gear-row-p1-head');
    vi.advanceTimersByTime(40);
    expect(row.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  // R-D12-F: compact density never mounts the table — fall back to the card.
  it('falls back to the player card when the row never mounts', () => {
    const card = mountEl('player-card-p1');
    scrollToGearRow('p1', 'head');
    expect(card.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('gives up silently when neither the row nor the card exists', () => {
    expect(() => {
      scrollToGearRow('p1', 'head');
      vi.advanceTimersByTime(5000);
    }).not.toThrow();
  });

  it('cancel() clears the pending poll so a fast navigate-away leaves nothing queued', () => {
    const cancel = scrollToGearRow('p1', 'head');
    cancel();
    const row = mountEl('gear-row-p1-head');
    vi.advanceTimersByTime(5000);
    expect(row.scrollIntoView).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd frontend && npx vitest run src/components/roster/gearRowScroll.test.ts
```

Expected: FAIL — cannot resolve `./gearRowScroll`.

- [ ] **Step 3: Implement**

Create `frontend/src/components/roster/gearRowScroll.ts`:

```ts
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
 * Why polling: a cross-tab jump switches `pageMode` and the roster mounts
 * behind an AnimatePresence `mode="wait"` transition, so the row is not in the
 * DOM on the next frame. A single fixed timeout races that animation.
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
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd frontend && npx vitest run src/components/roster/gearRowScroll.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/roster/gearRowScroll.ts frontend/src/components/roster/gearRowScroll.test.ts
git commit -m "feat(v2): D12 Task 2 — v2-local gear-row scroll with the card fallback

Deliberate fork of useViewNavigation's module-private scrollIntoViewWhenReady
(R-D12-J): extracting it would be a V1 edit for no V1 benefit. Card fallback
per R-D12-F covers compact density, a non-pursued tome sub-row, and a
universal tomestone."
```

---

### Task 3 — anchors and the pulse (`RosterGearTable.tsx`)

**Files:**
- Modify: `frontend/src/components/roster/RosterGearTable.tsx` (props block ~`:76-124`; the
  `mainRow` `<tr>` at `:297`; the tome sub-row `<tr>` at `:462`)
- Test: `frontend/src/components/roster/RosterGearTable.test.tsx`

**Interfaces:**
- Consumes: `gearRowDomId`, `JumpAnchorSlot` (Task 1).
- Produces: two new optional props on `RosterGearTableProps` —
  ```ts
  playerId?: string;                      // anchors render only when supplied
  highlightedSlot?: JumpAnchorSlot | null;
  ```

- [ ] **Step 1: Write the failing tests**

Append to `RosterGearTable.test.tsx` (reuse the file's existing render helper / default props):

```ts
describe('D12 — gear row anchors and the jump pulse', () => {
  it('gives every main row a gear-row-{playerId}-{slot} id', () => {
    const { container } = renderTable({ playerId: 'p1' });
    expect(container.querySelector('#gear-row-p1-weapon')).not.toBeNull();
    expect(container.querySelector('#gear-row-p1-head')).not.toBeNull();
    expect(container.querySelector('#gear-row-p1-ring2')).not.toBeNull();
  });

  it('renders no anchors at all without a playerId (the id would be ambiguous)', () => {
    const { container } = renderTable({});
    expect(container.querySelector('[id^="gear-row-"]')).toBeNull();
  });

  it('pulses only the highlighted row', () => {
    const { container } = renderTable({ playerId: 'p1', highlightedSlot: 'head' });
    expect(container.querySelector('#gear-row-p1-head')!.className).toContain('highlight-pulse');
    expect(container.querySelector('#gear-row-p1-body')!.className).not.toContain('highlight-pulse');
  });

  it('pulses nothing when highlightedSlot is null', () => {
    const { container } = renderTable({ playerId: 'p1', highlightedSlot: null });
    expect(container.querySelector('.highlight-pulse')).toBeNull();
  });

  // R-D12-E: the tome sub-row owns tome_weapon; the weapon row must not steal it.
  it('anchors the tome sub-row separately from the weapon row', () => {
    const { container } = renderTable({
      playerId: 'p1',
      tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false },
      highlightedSlot: 'tome_weapon',
    });
    const sub = container.querySelector('#gear-row-p1-tome_weapon');
    expect(sub).not.toBeNull();
    expect(sub!.className).toContain('highlight-pulse');
    expect(container.querySelector('#gear-row-p1-weapon')!.className)
      .not.toContain('highlight-pulse');
  });

  // R-D12-F: not pursuing => no sub-row => the card fallback does the work.
  it('renders no tome anchor when the player is not pursuing', () => {
    const { container } = renderTable({
      playerId: 'p1',
      tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
      highlightedSlot: 'tome_weapon',
    });
    expect(container.querySelector('#gear-row-p1-tome_weapon')).toBeNull();
    expect(container.querySelector('.highlight-pulse')).toBeNull();
  });
});
```

> If `RosterGearTable.test.tsx` has no `renderTable` helper, add one that spreads the file's existing
> default props object over the overrides — do **not** duplicate a props literal per test.

- [ ] **Step 2: Run and watch fail**

```bash
cd frontend && npx vitest run src/components/roster/RosterGearTable.test.tsx -t "D12"
```

Expected: FAIL — the queries return `null` (no ids rendered).

- [ ] **Step 3: Implement**

Add to the props interface, after the `onSlotJump` prop:

```ts
  /**
   * D12 (R-18's destination): the player these rows belong to. Supplying it
   * renders `gear-row-{playerId}-{slot}` anchors — the ids a ledger jump
   * scrolls to and pulses. Optional because the table also renders standalone
   * (and in tests) where a global id would be ambiguous.
   */
  playerId?: string;
  /**
   * D12: the row to pulse, from `?slot=` (`Roster.tsx` owns the param and the
   * 2500 ms clear). `'tome_weapon'` targets the SUB-ROW, never the weapon row
   * above it (R-D12-E) — the inverse of `findMaterialEntry`'s own rule.
   */
  highlightedSlot?: JumpAnchorSlot | null;
```

Destructure them in the signature (`playerId, highlightedSlot = null,`), extend the import:

```ts
import { gearRowDomId, jumpMenuAnchor } from './rosterLedgerJumps';
import type { JumpAnchorSlot, JumpKind, SlotJumpTargets } from './rosterLedgerJumps';
```

Replace the `mainRow` opening tag (`:297`):

```tsx
          const mainRow = (
            <tr
              key={slot}
              id={playerId ? gearRowDomId(playerId, slot) : undefined}
              className={`border-t border-border-subtle${
                highlightedSlot === slot ? ' highlight-pulse' : ''
              }`}
            >
```

Replace the tome sub-row opening tag (`:462`):

```tsx
              <tr
                id={playerId ? gearRowDomId(playerId, 'tome_weapon') : undefined}
                className={`border-t border-border-subtle/60 bg-surface-elevated/40${
                  highlightedSlot === 'tome_weapon' ? ' highlight-pulse' : ''
                }`}
              >
```

- [ ] **Step 4: Run and watch pass**

```bash
cd frontend && npx vitest run src/components/roster/RosterGearTable.test.tsx
```

Expected: PASS — the 6 new tests plus every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/roster/RosterGearTable.tsx frontend/src/components/roster/RosterGearTable.test.tsx
git commit -m "feat(v2): D12 Task 3 — gear-row anchors and the highlightedSlot pulse

R-18 note 2's net-new destination. The tome sub-row gets its OWN anchor
(R-D12-E), so a tome material jump never pulses a row about the raid weapon.
Anchors render only with a playerId — a global id has to be unambiguous."
```

---

### Task 4 — `?slot=` end to end on the roster (`Roster.tsx`, `RosterCards.tsx`, `RosterCard.tsx`, `GroupViewContent.tsx`)

This is the assembly task — it is the one a reviewer could reject while approving its neighbours,
and it carries the slice's single shared-file hunk. Dispatch it to **`xivrp-implementer-deep`**.

**Files:**
- Modify: `frontend/src/components/roster/Roster.tsx` (the `?player=` block, `:341-379`)
- Modify: `frontend/src/components/roster/RosterCards.tsx` (`:116-133` props, `:386`/`:414-421` rows)
- Modify: `frontend/src/components/roster/RosterCard.tsx` (props block ~`:90-120`; the
  `RosterGearTable` mount)
- Modify: `frontend/src/pages/GroupViewContent.tsx` (**one line**, `:255-259`)
- Test: `frontend/src/components/roster/Roster.test.tsx`, `RosterCard.test.tsx`

**Interfaces:**
- Consumes: `isJumpAnchorSlot`, `JumpAnchorSlot` (Task 1); `scrollToGearRow` (Task 2);
  `playerId`/`highlightedSlot` props (Task 3).
- Produces: `highlightedSlot?: JumpAnchorSlot | null` on `RosterCardsProps` and `RosterCardProps`.

- [ ] **Step 1: Write the failing tests**

Append to `Roster.test.tsx` (follow the file's existing `MemoryRouter` render helper):

```ts
describe('D12 — the ?slot= deep link', () => {
  it('pulses the named gear row when ?player= and ?slot= both resolve', async () => {
    const { container } = renderRoster({
      route: '/group/G1?tab=roster&player=p1&slot=head',
      density: 'expanded',
    });
    await waitFor(() => {
      expect(container.querySelector('#gear-row-p1-head')!.className)
        .toContain('highlight-pulse');
    });
  });

  // R-D12-G: BOTH pulse — legacy sets highlightedPlayerId AND highlightedSlot.
  it('pulses the card as well as the row', async () => {
    const { container } = renderRoster({
      route: '/group/G1?tab=roster&player=p1&slot=head',
      density: 'expanded',
    });
    await waitFor(() => {
      expect(container.querySelector('#player-card-p1')!.className)
        .toContain('highlight-pulse');
    });
  });

  it('ignores a slot that is not an anchor slot', async () => {
    const { container } = renderRoster({
      route: '/group/G1?tab=roster&player=p1&slot=__proto__',
      density: 'expanded',
    });
    await waitFor(() => expect(container.querySelector('#player-card-p1')).not.toBeNull());
    expect(container.querySelector('.highlight-pulse[id^="gear-row-"]')).toBeNull();
  });

  it('applies the slot pulse to the named player only', async () => {
    const { container } = renderRoster({
      route: '/group/G1?tab=roster&player=p1&slot=head',
      density: 'expanded',
    });
    await waitFor(() => expect(container.querySelector('#gear-row-p1-head')).not.toBeNull());
    expect(container.querySelector('#gear-row-p2-head')!.className)
      .not.toContain('highlight-pulse');
  });

  it('clears the slot pulse after 2500ms', async () => {
    vi.useFakeTimers();
    try {
      const { container } = renderRoster({
        route: '/group/G1?tab=roster&player=p1&slot=head',
        density: 'expanded',
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(container.querySelector('#gear-row-p1-head')!.className)
        .toContain('highlight-pulse');
      await vi.advanceTimersByTimeAsync(2500);
      expect(container.querySelector('#gear-row-p1-head')!.className)
        .not.toContain('highlight-pulse');
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 2: Run and watch fail**

```bash
cd frontend && npx vitest run src/components/roster/Roster.test.tsx -t "D12"
```

Expected: FAIL — no gear row carries the pulse (the prop does not exist yet).

- [ ] **Step 3: Implement — `Roster.tsx`**

Extend the existing `?player=` block. Add the import:

```ts
import { isJumpAnchorSlot, type JumpAnchorSlot } from './rosterLedgerJumps';
import { scrollToGearRow } from './gearRowScroll';
```

Add state beside `highlightedPlayerId`:

```ts
  // D12: the slot half of the jump. `GroupViewContent.tsx:255-259` strips BOTH
  // params at 2500ms (R-D12-I) — Roster still must not write the URL, so this
  // is local state cleared by its own timer, exactly like the card highlight.
  const [highlightedSlot, setHighlightedSlot] = useState<JumpAnchorSlot | null>(null);
```

In the resolving effect, after `setHighlightedPlayerId(playerParam)`:

```ts
    // Validated, never trusted: `?slot=` reaches `gearRowDomId`, so an
    // unvalidated value would build an arbitrary selector string.
    const slotParam = playerLinkParams.get('slot');
    const slot = slotParam && isJumpAnchorSlot(slotParam) ? slotParam : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same deep-link resolution as the player highlight above
    setHighlightedSlot(slot);
```

> ⚠ `playerHandledRef` guards the effect to one shot per `playerParam`. Change its stored key to
> `` `${playerParam}::${slotParam ?? ''}` `` so two jumps to *different slots of the same player*
> both fire. Without this the second jump silently does nothing — write the test for it.

Own the scroll (a separate effect keyed on the highlight, the F6e timer-ownership lesson):

```ts
  // D12: scroll the row into view. Keyed on the highlight itself, never on the
  // resolving effect's cleanup, so unrelated `players`/param identity churn
  // during the window can't cancel it. `GroupViewContent` scrolls the CARD at
  // 100ms; this targets a row inside that card and re-centers at +220ms, so
  // the two compose rather than fight (see gearRowScroll.ts).
  useEffect(() => {
    if (!highlightedPlayerId || !highlightedSlot) return;
    return scrollToGearRow(highlightedPlayerId, highlightedSlot);
  }, [highlightedPlayerId, highlightedSlot]);
```

Clear it alongside the card highlight (extend the existing 2500 ms effect):

```ts
  useEffect(() => {
    if (!highlightedPlayerId) return;
    const timer = window.setTimeout(() => {
      setHighlightedPlayerId(null);
      setHighlightedSlot(null);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [highlightedPlayerId]);
```

Pass it to `RosterCards`, next to `highlightedPlayerId`:

```tsx
          highlightedSlot={highlightedSlot}
```

- [ ] **Step 4: Implement — `RosterCards.tsx` and `RosterCard.tsx`**

`RosterCards`: add the prop, document it, destructure it, and forward it **only to the highlighted
card** at both render sites (`:386-398` and `:414-421`):

```ts
  /**
   * D12: the gear row to pulse on the highlighted card. Forwarded to that card
   * ALONE — a slot is meaningless without the player it belongs to.
   */
  highlightedSlot?: JumpAnchorSlot | null;
```

```tsx
        highlightedSlot={player.id === highlightedPlayerId ? highlightedSlot ?? null : null}
```

`RosterCard`: add the same prop, and pass it plus `playerId` down at the `RosterGearTable` mount:

```tsx
            playerId={player.id}
            highlightedSlot={highlightedSlot}
```

- [ ] **Step 5: Implement — the one shared-file line**

`pages/GroupViewContent.tsx`, inside the existing `?player=` 2500 ms strip:

```ts
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.delete('player');
        // D12 (R-D12-I): `?slot=` rides with `?player=` and is stripped by the
        // same timer — Roster must not write the URL (its own header comment),
        // and two writers on one boundary race. V1 never writes `slot`, so
        // this delete is a no-op on every legacy path.
        params.delete('slot');
        return params;
      }, { replace: true });
```

- [ ] **Step 6: Run the whole roster suite**

```bash
cd frontend && npx vitest run src/components/roster/ src/pages/GroupViewContent.test.tsx
```

Expected: PASS, including the pre-existing suites.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/roster/ frontend/src/pages/GroupViewContent.tsx
git commit -m "feat(v2): D12 Task 4 — ?slot= end to end on the roster

Roster validates the param, owns the local highlight + its 2500ms clear + the
row scroll; RosterCards forwards the slot to the highlighted card alone.

ONE shared-file line: GroupViewContent's existing ?player= strip also deletes
?slot= (R-D12-I). V1 never writes slot, so it is a no-op on every legacy path."
```

---

### Task 5 — the Loot side writes `?slot=` (`Loot.tsx`, `LogWeekGrid.tsx`, `LootHistoryTable.tsx`)

**Files:**
- Modify: `frontend/src/components/loot/Loot.tsx` (`jumpToRecipient`, `:754-766`)
- Modify: `frontend/src/components/loot/LogWeekGrid.tsx` (`:188`, `:256`, `:390`, `:721`, `:735`)
- Modify: `frontend/src/components/loot/LootHistoryTable.tsx` (`:192`, `:476`, `:510`, `:717`)
- Test: `Loot.test.tsx`, `LogWeekGrid.test.tsx`, `LootHistoryTable.test.tsx`

**Interfaces:**
- Consumes: `jumpAnchorSlotOf`, `JumpAnchorSlot` (Task 1).
- Produces: the widened callback, identical in both consumers —
  ```ts
  onJumpToPlayer: (playerId: string, slot?: JumpAnchorSlot | null) => void;
  ```

- [ ] **Step 1: Write the failing tests**

`Loot.test.tsx` — extend the shipped jump test at `:1750`:

```ts
  it('a Log-grid jump writes tab=roster&player={id}&slot={slot}', async () => {
    // …open the grid cell's menu and click "Jump to Tank One" (the existing
    // test's own steps) against an entry with itemSlot 'head'…
    expect(search).toContain('tab=roster');
    expect(search).toContain('player=p1');
    expect(search).toContain('slot=head');
  });

  // R-D12-F: a universal tomestone has no slotAugmented — card, not row.
  it('omits ?slot= for a material entry with no augmented slot', async () => {
    // …jump from a universal-tomestone material entry…
    expect(search).toContain('player=p1');
    expect(search).not.toContain('slot=');
  });

  it('deletes a stale ?slot= when the new jump has none', async () => {
    // …land on ?player=p2&slot=head, then jump from a universal tomestone…
    expect(search).not.toContain('slot=');
  });
```

`LootHistoryTable.test.tsx`:

```ts
  it('Alt+Click on a row passes the entry\'s anchor slot to the jump', async () => {
    const onJumpToPlayer = vi.fn();
    renderTable({ onJumpToPlayer, items: [lootItem({ itemSlot: 'legs' })] });
    await user.keyboard('{Alt>}');
    await user.click(screen.getByRole('row', { name: /Tank One/ }));
    await user.keyboard('{/Alt}');
    expect(onJumpToPlayer).toHaveBeenCalledWith('p1', 'legs');
  });

  it('the menu Jump item passes the same slot', async () => {
    const onJumpToPlayer = vi.fn();
    renderTable({ onJumpToPlayer, items: [materialItem({ slotAugmented: 'tome_weapon' })] });
    // …open the kebab, click "Jump to Tank One"…
    expect(onJumpToPlayer).toHaveBeenCalledWith('p1', 'tome_weapon');
  });
```

`LogWeekGrid.test.tsx`: the mirror pair for the cell Alt+Click and the cell menu item.

- [ ] **Step 2: Run and watch fail**

```bash
cd frontend && npx vitest run src/components/loot/Loot.test.tsx src/components/loot/LootHistoryTable.test.tsx src/components/loot/LogWeekGrid.test.tsx -t "slot"
```

Expected: FAIL — `onJumpToPlayer` is called with one argument.

- [ ] **Step 3: Implement**

`Loot.tsx` — widen `jumpToRecipient` and update its comment block:

```ts
  // D6a Task 6 / D12: Alt+Click / context-menu "Jump to {name}" — the same
  // same-route URL-param jump `RosterCard.tsx` uses. D12 makes it SLOT-level
  // (R-18 note 2): `?slot=` names the gear row to scroll to and pulse, and is
  // OMITTED when the entry has no row to land on (R-D12-F: a universal
  // tomestone). The delete on the `null` path matters — a previous jump's slot
  // would otherwise pulse an unrelated row on this one (director F-18, the
  // same reason entry/entryType/book go).
  const jumpToRecipient = useCallback((playerId: string, slot?: JumpAnchorSlot | null) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('tab', 'roster');
      params.set('player', playerId);
      if (slot) params.set('slot', slot);
      else params.delete('slot');
      params.delete('entry');
      params.delete('entryType');
      params.delete('book');
      return params;
    });
  }, [setSearchParams]);
```

`LootHistoryTable.tsx` — widen the prop type at `:192`, then at `:510` and `:717`:

```ts
      onClick: () => ctx.onJumpToPlayer(recipientId, jumpAnchorSlotOf(item)),
```
```ts
      if (canJumpTo(item)) onJumpToPlayer(item.entry.recipientPlayerId, jumpAnchorSlotOf(item));
```

`LogWeekGrid.tsx` — widen `:188`/`:256`, then at `:390` and `:735`:

```ts
    ? () => onJumpToPlayer(newest.recipientPlayerId, jumpAnchorSlotOf(newest))
```
```ts
      items.push({
        label: `Jump to ${player.name}`,
        onClick: () => onJumpToPlayer(jumpPlayerId, jumpAnchorSlotOf(menu.ref)),
      });
```

> ⚠ `LogWeekGrid.tsx:390`'s `newest` is a **bare entry**, not a `HistoryItem`. Wrap it in the cell's
> own `kind` before calling — read the surrounding code and use the ref the cell already builds
> (`buildRef`), never a hand-rolled `{ kind: 'loot', entry: newest }` guess in a material cell.

- [ ] **Step 4: Run and watch pass**

```bash
cd frontend && npx vitest run src/components/loot/
```

Expected: PASS, whole loot suite.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/loot/Loot.tsx frontend/src/components/loot/LogWeekGrid.tsx frontend/src/components/loot/LootHistoryTable.tsx frontend/src/components/loot/*.test.tsx
git commit -m "feat(v2): D12 Task 5 — the Log grid and History rows jump to a SLOT

onJumpToPlayer carries the entry's anchor slot; Loot writes ?slot= beside
?player= and DELETES it when the entry has no row (R-D12-F), so a previous
jump's slot can't pulse an unrelated row."
```

---

### Task 6 — R-28's week split (`useLogWeek.ts`, `RosterCard.tsx`)

The riskiest task in the slice: it reaches into a hook D4 built with exactly one week writer, and
the failure mode is silent. Dispatch to **`xivrp-implementer-deep`**.

**Files:**
- Modify: `frontend/src/components/loot/useLogWeek.ts` (export `resolveOverride`; **no behaviour
  change**)
- Modify: `frontend/src/components/roster/RosterCard.tsx` (`jumpToEntry`, `:281-297`;
  `handleSlotJump`, `handleTomeMaterialJump`)
- Test: `frontend/src/components/roster/RosterCard.test.tsx`, `useLogWeek.test.ts`

**Interfaces:**
- Consumes: `entryJumpView` (Task 1).
- Produces:
  ```ts
  // useLogWeek.ts
  export function resolveLogWeekOverride(
    groupId: string | undefined,
    tierId: string | undefined,
    urlWeek: string | null,
  ): number | null;
  ```

- [ ] **Step 1: Write the failing tests**

`useLogWeek.test.ts`:

```ts
describe('resolveLogWeekOverride (exported for D12)', () => {
  it('is the same function the hook resolves with: ?week= wins', () => {
    expect(resolveLogWeekOverride('g1', 't1', '4')).toBe(4);
  });

  it("the 'current' sentinel resolves to null and never falls through to legacy", () => {
    localStorage.setItem('v2-history-week-g1-t1', 'current');
    localStorage.setItem('history-week-g1-t1', '9');
    expect(resolveLogWeekOverride('g1', 't1', null)).toBeNull();
  });
});
```

`RosterCard.test.tsx`:

```ts
describe('D12 — R-28, the entry jump splits by week', () => {
  it('lands on the Log when the entry is in the displayed week', async () => {
    // clock currentWeek 5, no ?week=, entry weekNumber 5
    await altClickSlotIcon('head');
    expect(search).toContain('lview=log');
    expect(search).toContain('entry=41');
    expect(search).toContain('entryType=loot');
  });

  it('lands on History when the entry is OLDER than the displayed week', async () => {
    // clock currentWeek 5, entry weekNumber 2
    await altClickSlotIcon('head');
    expect(search).toContain('lview=history');
  });

  // R-D12-A: the case R-28's prose doesn't name.
  it('lands on History when the entry is NEWER than the displayed week', async () => {
    // ?week=3 in the URL, entry weekNumber 5
    await altClickSlotIcon('head');
    expect(search).toContain('lview=history');
  });

  // R-D12-B: the displayed week is the RESOLVED one, not the clock's.
  it('compares against ?week=, not the clock', async () => {
    // ?week=2, clock currentWeek 5, entry weekNumber 2 -> Log
    await altClickSlotIcon('head');
    expect(search).toContain('lview=log');
  });

  it('compares against the stored v2 week when there is no ?week=', async () => {
    localStorage.setItem('v2-history-week-g1-t1', '2');
    // clock currentWeek 5, entry weekNumber 2 -> Log
    await altClickSlotIcon('head');
    expect(search).toContain('lview=log');
  });

  // R-D12-C.
  it('routes to History while the week clock is still provisional', async () => {
    // store at currentWeek 1 / maxWeek 1, entry weekNumber 1
    await altClickSlotIcon('head');
    expect(search).toContain('lview=history');
  });

  // R-D12-D — the load-bearing absence.
  it('never writes ?week= and never touches the stored week', async () => {
    const before = localStorage.getItem('v2-history-week-g1-t1');
    await altClickSlotIcon('head');
    expect(search).not.toContain('week=');
    expect(localStorage.getItem('v2-history-week-g1-t1')).toBe(before);
  });

  it('still deletes ?book= on both branches', async () => {
    await altClickSlotIcon('head');
    expect(search).not.toContain('book=');
  });
});
```

- [ ] **Step 2: Run and watch fail**

```bash
cd frontend && npx vitest run src/components/roster/RosterCard.test.tsx -t "R-28"
```

Expected: FAIL — every branch yields `lview=history` (the hard-coded value).

- [ ] **Step 3: Implement — export the resolver**

In `useLogWeek.ts`, rename `resolveOverride` → `resolveLogWeekOverride`, `export` it, update its two
internal call sites, and extend its doc comment with:

```
 * Exported for D12 (R-D12-B): `RosterCard`'s entry jump has to know which week
 * the Log will display in order to route by R-28's split, and `Loot` genuinely
 * REMOUNTS on a tab switch (`GroupViewContent.tsx` renders the gear slot only
 * while `pageMode === 'gear'`), so this function's first-resolve branch is
 * exactly what runs on arrival. Same function, same inputs, same answer — a
 * re-derivation on the card could drift and the failure would be silent: the
 * Log opens on a week whose grid does not hold the pulsed entry.
```

- [ ] **Step 4: Implement — the split in `RosterCard.tsx`**

Add imports and read the clock + the week param:

```ts
import { entryJumpView } from './rosterLedgerJumps';
import { resolveLogWeekOverride } from '../loot/useLogWeek';
```

```ts
  const [jumpParams, setSearchParams] = useSearchParams();
  const clockCurrentWeek = useLootTrackingStore((s) => s.currentWeek);
  const clockMaxWeek = useLootTrackingStore((s) => s.maxWeek);
```

Replace `jumpToEntry`:

```ts
  // ── R-28 (D12): the entry jump SPLITS by week ──
  // `lview=log` only when the entry sits in the week the Log will display;
  // everything else — older AND newer (R-D12-A) — goes to History. The
  // displayed week is resolved with `useLogWeek`'s OWN resolver (R-D12-B) so
  // the card's decision and the Log's later mount cannot disagree.
  //
  // R-D12-D, load-bearing ABSENCE: no `?week=` is written and `setWeek` is
  // never called. `?week=` is the resolver's first input, so preserving it is
  // what makes this deterministic — and writing one would arm the disclosed
  // legacy-History seeding cohort (`Loot.tsx`'s header) from a screen with no
  // week control on it.
  //
  // R-D12-C: while the clock is provisional (`lootTrackingStore` starts
  // `currentWeek: 1, maxWeek: 1`) every jump goes to History. Routing to the
  // Log against a provisional clock lets `Loot.tsx`'s out-of-week correction
  // fire `setWeek`, which writes the `'current'` sentinel and destroys the
  // user's real week — the exact clobber that file's F1/F2 guards exist for.
  // Disclosed residual: a genuine week-1 tier is indistinguishable here, so
  // its jumps land on History too. The entry is still found and still pulses.
  const jumpToEntry = useCallback(
    (entryId: number, kind: JumpKind, entryWeek: number | null | undefined) => {
      const clockSettled = Math.max(clockMaxWeek, clockCurrentWeek) > 1;
      const displayedWeek = clockSettled
        ? resolveLogWeekOverride(groupId, tierId, jumpParams.get('week')) ?? clockCurrentWeek
        : null;
      const lview = entryJumpView(entryWeek, displayedWeek);
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set('tab', 'gear');
        params.set('lview', lview);
        params.set('entry', String(entryId));
        params.set('entryType', kind);
        // One navigation, one highlight: the Log/History views and the Books
        // card read different params on the same route, so a leftover `book`
        // would pulse a second row the user never asked for.
        params.delete('book');
        return params;
      });
    },
    [clockMaxWeek, clockCurrentWeek, groupId, tierId, jumpParams, setSearchParams],
  );
```

Feed the week from both callers:

```ts
  const handleTomeMaterialJump = useCallback(() => {
    if (!tomeMaterialEntry) return;
    jumpToEntry(tomeMaterialEntry.id, 'material', tomeMaterialEntry.weekNumber);
  }, [tomeMaterialEntry, jumpToEntry]);
```

```ts
  const handleSlotJump = useCallback(
    (slot: GearSlot, kind: JumpKind) => {
      const entryId = slotJumps[slot]?.[kind];
      if (entryId == null) return;
      // The week is looked up here rather than carried on `SlotJumpTarget`:
      // that module's contract is "availability IS the target — one pass
      // produces the id", and routing is this card's concern, not its.
      const entry = kind === 'loot'
        ? lootLog.find((e) => e.id === entryId)
        : materialLog.find((e) => e.id === entryId);
      jumpToEntry(entryId, kind, entry?.weekNumber);
    },
    [slotJumps, lootLog, materialLog, jumpToEntry],
  );
```

- [ ] **Step 5: Run and watch pass**

```bash
cd frontend && npx vitest run src/components/roster/RosterCard.test.tsx src/components/loot/useLogWeek.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/roster/RosterCard.tsx frontend/src/components/roster/RosterCard.test.tsx frontend/src/components/loot/useLogWeek.ts frontend/src/components/loot/useLogWeek.test.ts
git commit -m "feat(v2): D12 Task 6 — R-28's week split on the roster's entry jumps

lview=log only when the entry sits in the week the Log will display, resolved
with useLogWeek's OWN resolver (R-D12-B) so the two sides cannot disagree.
Older AND newer both go to History (R-D12-A). No ?week= is written and setWeek
is never called (R-D12-D) — a jump must not persist a week the user never
chose. A provisional clock routes everything to History (R-D12-C)."
```

---

### Task 7 — the mutation battery

**Files:**
- Create: `scripts/d12-mutation-battery.py`

- [ ] **Step 1: Copy the harness**

```bash
cp scripts/d11-mutation-battery.py scripts/d12-mutation-battery.py
```

Keep `run_spec`'s `returncode` check and `--selftest` **exactly as they are** — they are PR #268's
fix. Rewrite the module docstring for D12 and replace `MUTATIONS`.

> ⚠ **Always pass `newline=''` to `io.open(..., 'w')`.** The default rewrites the tree to CRLF on
> Windows, and every multi-line anchor then reports `ANCHOR MISSING`. `git diff --stat` warning
> *"CRLF will be replaced by LF"* is the tell. (Handoff, Important Context.)

- [ ] **Step 2: Write the mutation rows**

One row per ruling, each naming the ruling it pins:

| Mutation | Pins | Killed by |
|---|---|---|
| `jumpAnchorSlotOf` normalizes `tome_weapon` → `'weapon'` | **R-D12-E** | `rosterLedgerJumps.test.ts` |
| `jumpAnchorSlotOf` returns `'ring2'` for a generic ring | **R-D12-H** | `rosterLedgerJumps.test.ts` |
| `jumpAnchorSlotOf` returns `'weapon'` instead of `null` for a null `slotAugmented` | **R-D12-F** | `rosterLedgerJumps.test.ts` |
| `entryJumpView` regresses to `entryWeek < displayedWeek ? 'history' : 'log'` (R-28's literal prose) | **R-D12-A** | `rosterLedgerJumps.test.ts` (the NEWER case) |
| `entryJumpView` treats a `null` displayed week as `'log'` | **R-D12-C** | `rosterLedgerJumps.test.ts` |
| `isJumpAnchorSlot` returns `true` unconditionally | param validation | `rosterLedgerJumps.test.ts` + `Roster.test.tsx` |
| `RosterGearTable` pulses on `slot === highlightedSlot \|\| true` | the pulse is scoped | `RosterGearTable.test.tsx` |
| The tome sub-row's anchor becomes `gear-row-{playerId}-weapon` | **R-D12-E** | `RosterGearTable.test.tsx` |
| `RosterCards` forwards `highlightedSlot` to every card | scoping | `Roster.test.tsx` |
| `RosterCard.jumpToEntry` drops the `clockSettled` guard | **R-D12-C** | `RosterCard.test.tsx` |
| `RosterCard.jumpToEntry` uses `clockCurrentWeek` instead of the resolver | **R-D12-B** | `RosterCard.test.tsx` (the `?week=` + stored-week cases) |
| `RosterCard.jumpToEntry` also writes `params.set('week', …)` | **R-D12-D** | `RosterCard.test.tsx` |
| `Loot.jumpToRecipient` drops the `else params.delete('slot')` | stale-slot pulse | `Loot.test.tsx` |
| `GroupViewContent`'s strip drops `params.delete('slot')` | **R-D12-I** | `GroupViewContent.test.tsx` |
| `scrollToGearRow` drops the card fallback | **R-D12-F** | `gearRowScroll.test.ts` |

> A row reporting **0 kills** is first evidence about the **mutation**, not the test. A mutant that
> cannot compile fails every test in the spec and proves nothing — the harness flags it
> `INVALID MUTANT`. Anchors must be present **and unique**.

- [ ] **Step 3: Prove the harness, then the battery**

```bash
cd frontend && python ../scripts/d12-mutation-battery.py --selftest
cd frontend && python ../scripts/d12-mutation-battery.py
```

Expected: `Selftest OK`, then every row applied/restored/scored with a non-zero kill count and
`Battery OK`.

> The battery **mutates the working tree in place** — never run `lint`/`test`/`build` concurrently
> with it.

- [ ] **Step 4: Commit**

```bash
git add scripts/d12-mutation-battery.py
git commit -m "test(v2): D12 mutation battery — one row per D12 ruling

Harness inherited from D11 including PR #268's returncode fix and --selftest.
Every R-D12-* ruling has a named mutant; the R-28-literal-prose row pins
R-D12-A by regressing to 'older -> history' and letting a NEWER entry through."
```

---

### Task 8 — gates, browser pass, docs

- [ ] **Step 1: Full gate sweep** (serially — never alongside the battery)

```bash
cd frontend && pnpm build && pnpm lint && pnpm check:design-system:strict && pnpm tokens:check && pnpm dupes && pnpm deadcode && pnpm test
cd scripts && npm test
```

Record every number. Required: **≥3117 tests**, **0 errors / ≤903 warnings**, knip **181 / 140**,
all others clean. `pnpm build` is `tsc -b` — the gate `tsc --noEmit` does not reproduce.

- [ ] **Step 2: Live browser pass** (`?shell=v2`, desktop; mobile → Phase P)

Backend on `:8001` as a background task, then `/api/dev-auth/login/0` → `/group/DEVTST?shell=v2`.
Walk and screenshot:

1. Roster → expand a card → `Alt+Click` a gear slot icon whose entry is in the **current** week →
   lands on **Log**, that cell pulsing.
2. Same, entry in an **older** week → lands on **History**, that row pulsing. Confirm the URL has
   **no `?week=`** and `localStorage['v2-history-week-…']` is **unchanged**.
3. Log grid → `Alt+Click` a filled cell → roster card **and** its gear row both pulse (R-D12-G).
4. History row kebab → "Jump to {player}" → same, and the row scrolls into view.
5. A universal-tomestone material entry → lands on the **card**, no row pulse, no `?slot=`.
6. A `tome_weapon` material entry on a **pursuing** player → the **sub-row** pulses, not the weapon
   row. Repeat on a **non-pursuing** player → card only.
7. Roster in **compact** density → a Log-grid jump still pulses the card, no console error.
8. Confirm `?player=`/`?slot=` are both gone from the URL after 2500 ms.

0 console errors on every step. Copy screenshots **out of the session scratchpad** and embed them in
the PR body (standing rule).

- [ ] **Step 3: Docs**

1. `design/redesign/specs/phase-d-loot-design.md` — a **D12 build note** under R-18 (what shipped,
   the `tome_weapon` delta vs `useViewNavigation.ts:125` named as a delta) and under R-28 (the
   symmetric rule, the resolver, the two disclosed residuals), plus R-D12-A…J.
2. `design/redesign/specs/phase-d-loot-plan.md:200` — mark the D12 row **✅ BUILT**, in the shape
   D9a/D9b/D10/D11 use.
3. `design/redesign/DESIGN_SYSTEM.md` — `RosterGearTable`'s new anchor/pulse contract.
4. `frontend/src/data/releaseNotes.ts` — `internal: true`, `pr` + `prTitle`, `CURRENT_VERSION`
   **unchanged**.

- [ ] **Step 4: PR**

Invoke the **`pr-checklist`** skill first. The body must carry:

- The **two-part V1 assert**: (a) `git diff --stat` over legacy-only paths is empty; (b) the single
  `pages/GroupViewContent.tsx` hunk enumerated with the exact V1 render path it reaches, and why
  it is a no-op there (V1 never writes `?slot=`).
- The knip before/after (CI runs `deadcode` `continue-on-error`, so it is claimable otherwise).
- An explicit grep assert that no v2 file uses `FLOOR_COLORS[n].hex`.
- The embedded screenshots.
- Both disclosed residuals: R-D12-C's genuine-week-1 case, and the ring one-to-many/one-to-first
  asymmetry.
- **No AI attribution of any kind.**

---

## 5. Self-review against the spec

**Spec coverage.**

| Spec requirement | Task |
|---|---|
| `RosterGearTable` gains `gear-row-{playerId}-{slot}` anchors | 3 |
| …and a `highlightedSlot` pulse | 3 |
| R-28's split: displayed week → Log cell | 1 (`entryJumpView`), 6 (wiring) |
| …older → History row | 1, 6 |
| …books → Books row | **already shipped** (D7/R-14 `handleBooksJump`); re-asserted by an existing test, not rebuilt |
| Retarget `RosterCard.tsx:281-297` | 6 |
| A material jump whose `slotAugmented` is null lands on the card | 1 (`jumpAnchorSlotOf` → `null`), 2 (fallback), 5 (`?slot=` omitted) |
| R-18's destination reached from the Log grid and History | 5 |
| Jumps stay `Alt+Click`-only | untouched by design — asserted in Task 7's battery only insofar as no row mutates the modifier family |

**Placeholder scan.** No "TBD", no "add error handling", no "similar to Task N". Task 5's test
bodies elide only the *existing* setup steps of tests already in those files, and say so; every new
assertion is written out.

**Type consistency.** `JumpAnchorSlot` is defined once (Task 1) and used by Tasks 2, 3, 4, 5.
`jumpAnchorSlotOf` takes `HistoryItem` — the type both loot consumers already hold.
`entryJumpView(entryWeek, displayedWeek)` keeps that argument order at every call site.
`resolveLogWeekOverride` keeps `resolveOverride`'s exact `(groupId, tierId, urlWeek)` signature.
`onJumpToPlayer`'s widened type is identical in `LogWeekGridProps` and `LootHistoryTableProps`.

**One risk flagged for the implementer of Task 4:** `playerHandledRef` currently stores the bare
`playerParam`, which would swallow a second jump to a *different slot of the same player*. The
step-3 note requires the composite key and the test for it.
