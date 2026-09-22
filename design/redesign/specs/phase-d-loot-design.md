# Phase D — Loot rework (co-design record)

**Status: ✅ DESIGN COMPLETE 2026-07-28** (started the same day). This document is the running record of
the Phase-D design conversation, written ruling-by-ruling as the user made each call. All four surfaces
are ruled — Priority R-1…R-12 + R-49 (D1 build-time) · Log R-13…R-28 · History R-29…R-39 · Elsewhere R-40…R-42 ·
cross-cutting R-47 · shared-layer R-43…R-46, R-48. Three `xivrp-director` passes ran: two per-surface (§4, §6 — against a
reconstructed charter, so no shared-layer, design-system or vocabulary lens) and one **whole-record**
pass against the real charter on 2026-07-29, which returned **SHARED-DRIFT** and produced §7a.
**Implementation is not planned yet** (§8).

**Process (binding).** Phase D is **co-designed step by step with the user, not sliced
autonomously** — the standing ruling from 2026-07-26: *"a lot of work went into v1 based on user
feedback"*, and v2's loot surfaces regressed its usability. Nothing here is implemented until the
surface it belongs to is fully designed and the user says to build.

---

## 0. What Phase D covers

Structure is already settled by the flow map and is **not** in scope to re-open:

- **F-06** — Loot is a triad: **Priority · Log · History** (decide / record / find).
- **F-07** — the books ledger lives **inside Log**; balances stay readable from Team Summary.

| Area | Units |
|---|---|
| **Priority** | D-22 Who Needs It matrix · D-23 view axis · D-24 floor scoping · D-25 score transparency · D-26 "+ Log Floor" · D-27 weapon priority placement · D-28 RecipientPicker additions · D-29 candidate reasons/warnings/confidence |
| **Log** *(does not exist in v2)* | D-30 weekly grid · D-35 free-form material entry · D-37 material edit · D-38 books placement · D-39 per-floor + per-player book resets · D-40 week stepping · D-41 revert data-summary |
| **History** | D-31 cross-week table as the model · D-72 structured search · D-32 fold · D-33 layout axis dissolved · D-34 kebab + "Jump to {player}" |
| **Elsewhere** | D-42 Team Summary restore · D-43 its home (closed by F-08 → static Home) · F-04 Split Planner entry · D-44 mobile *(deferred to the Phase-P pass)* |
| **Cross-cutting** | D-36 picker additions incl. the "no one needs this" hint · D-54 the loot/history shortcut set · D-05/D-55 the jump affordances' loot half |

*(This table listed 22 units and omitted the cross-cutting row until 2026-07-29; the phase rules those
too, so a completeness claim measured against the old table would have under-counted.)*

Standing design inputs from the user, carried into every surface here:

1. **Floor-selector isolation** beats one long scroll (applies to Priority *and* History).
2. **Who Needs It is a headline feature**, not an afterthought — it earned real user feedback.
3. **Entry icon/colour polish:** floor-derived colours; colourise the gear *name* on entries;
   generic gear-slot icons instead of coloured letter squares; **exception** — a logged *weapon*
   entry shows a **job icon**, so which weapon dropped is unambiguous.
   ⚠ **Corrected 2026-07-28 by R-38.** As given, this input said the *recipient's* job icon, which
   defeats its own stated purpose: `weaponJob` is stored per entry (`types/index.ts:1249`) precisely
   because it can differ from the recipient's job. It is the **weapon's** job icon; the recipient's
   already rides on the recipient chip.
4. **Reverse jump** (log entry → player card with the slot row highlighted) is D-55's loot half and
   lands in this phase. Legacy mechanism: `useViewNavigation.ts:117-136`
   (`gear-row-{playerId}-{slot}` + highlight). v2 today has card-level `?player=` only.

---

## 1. Priority — rulings

### R-1 · The landing view is the **Matrix** (D-23)

Priority hosts two views behind a **Queues ⇄ Matrix** switcher. **Who Needs It is what the Loot tab
lands on.**

*Why:* it matches v1's default — the version that earned the positive feedback — and it is the
whole-tier "where does this static stand" read. The choice **persists per user**, so this decision
governs the first visit; the queues stay one click away for when something actually drops.

⚠ **Renamed 2026-08-21 by R-P1.** The switcher segment's label and its persisted value (previously
`'matrix'`) are both renamed to **Who Needs It** / `'who-needs-it'` — no backwards-compat shim, since
v2 is pre-release with zero users and the sub-view isn't URL-backed: a stale `'matrix'` value just
falls through to this same landing default, like any other unrecognized string. Every bare "Matrix"
below that names this view reads as **Who Needs It**; a short dated pointer sits at each ruling where
that reading applies — not necessarily an exhaustive list, but currently R-2, R-3, R-4, R-6, R-7, R-9,
R-10, R-12, R-17, R-26's R-a note, R-48, R-50.2 and R-50.4, plus §2's diagram and §4's "One model, not
one button" summary.

### R-2 · Floor scoping is **v1's pill row: All + F1–F4** (D-24)

One pill row scopes **the whole Priority view** — both Matrix and Queues answer to it. `All` stays
available. Pills carry their floor's colour from the existing **`FLOOR_COLORS`** set in
`gamedata/loot-tables`.

*Why:* the standing input — v2's "render all four floors, scroll to reach Floor 1" is the disliked
pattern, and the pills are what v1 used. Scoping the *view* rather than each card means the Matrix
and the Queues can never disagree about which floor the user is looking at.

**Implementation note, not a ruling:** `components/loot/FloorSelector.tsx` is an **orphan** —
exported from `loot/index.ts`, imported by nothing, and it is a `Select` **dropdown**, not a pill
row. It is a name squatter, not a reusable leaf. Delete or repurpose it when R-2 is built.

⚠ **Renamed 2026-08-21 by R-P1** — see R-1's amendment. Both bare "Matrix" mentions above read as
**Who Needs It**.

⚠ **Amended 2026-08-21 by R-P3.** "Scopes the whole Priority view" is refined for the Who Needs It
view specifically: floor scoping there **highlights, it does not hide** — every row stays mounted,
rows matching the selected floor get the floor-accent highlight, and every other row dims and has
its log affordances **disabled**, matching v1's `WhoNeedsItMatrix.tsx:391,480`. Queues and Weapons
are unchanged — Queues still narrows per this ruling; Weapons is governed by R-5, which replaces the
pill row entirely rather than filtering against it.
Controller ruling R-V4.

### R-3 · Weapon Priority becomes the **third switcher segment** (D-27)

The axis is **Queues ⇄ Matrix ⇄ Weapons**. Weapon priority stops being a collapsible text link in
the Floor-4 card's footer.

*Why:* weapon priority is its own decision procedure — per-job funnelling, tie groups, rolls and
rerolls — not another slot queue. v1 gave it a peer sub-tab and that is the shape that earned the
feedback.

⚠ **This deliberately widens D-23**, whose wording specified a two-view Queues ⇄ Matrix switcher.
In substance the result is v1's three-way axis (Who Needs It / Gear Priority / Weapon Priority)
re-expressed as one switcher instead of a sub-tab bar. **Write back to matrix D-23 and D-27 when
this ships**, per the Phase-C precedent that rulings and matrix rows land in the same PR.

⚠ **Renamed 2026-08-21 by R-P1** — see R-1's amendment. The axis is now **Queues ⇄ Who Needs It ⇄
Weapons**; nothing else about this ruling changes.

### R-4 · A Matrix cell opens the **RecipientPicker, pre-filled to that player + slot** (D-22)

Clicking a dot keeps v1's log-from-here speed, but routes through v2's picker so there is **one
logging path**, with a confirm step before anything is written.

*Why:* v1's one-click write was fast but the matrix is a dense dot grid — a mis-click wrote real
data that then had to be hunted down in History. Pre-filling means the click still does the obvious
thing; it just shows its work first.

**Implementation note, not a ruling:** the picker's existing modes (`assign`/`log`/`edit`) fix it to
a *slot or material*. Pre-selecting a **recipient** as well is new — the ranked list must still
render, with that player selected and freely switchable, so the cell click is a shortcut into the
normal flow rather than a second flow.

⚠ **Renamed 2026-08-21 by R-P1** — see R-1's amendment. This ruling's title ("A Matrix cell opens...")
and its "the matrix is a dense dot grid" both read as **Who Needs It**; the mechanism — RecipientPicker,
pre-filled to the clicked player + slot — is unchanged.

### R-5 · In the Weapons view the pill row becomes a **static floor label**

Switching to Weapons replaces the pills in place with a label naming the floor weapons drop from
(e.g. `M12S · Floor 4`). The row keeps its space, so nothing jumps between views, and the scope is
**stated** rather than implied by a control that could do nothing.

### R-6 · **One shared explanation** for why a ranking is what it is (D-25 + D-29)

One derivation and one presentation component explain a ranking **wherever it appears** — queue row,
matrix cell, picker candidate. The picker layers its extras on top: per-candidate **warnings** and
the **high/medium/low confidence** header.

*Why:* this is the same shape the project has landed on repeatedly for exactly this class of
problem — `computeGearSlotUpdate`, `rosterIlv`, `gearCycleHint` — and it means the number a user
sees in the queue can never disagree with the reasoning shown in the modal that logs it.

⚠ **Renamed 2026-08-21 by R-P1** — see R-1's amendment. The lowercase "matrix cell" in the "queue row,
matrix cell, picker candidate" list reads as **Who Needs It**.

### R-7 · **One Priority-level "Log floor"** that follows the pill (D-26)

A single **Log floor** button beside the pill row, scoped to whichever floor is selected, behaving identically in
all three views. When **All** is selected it steps aside for the toolbar's existing
**"Log this week's loot"** — the whole-week wizard already owns that case.

*Why:* the pills made "the current floor" a first-class property of the view, so the action belongs
to the view, not to a card. One button and one rule; and the Matrix — the landing view under R-1 —
can log a floor, which a card-header-only entry would have prevented. Resolves the D-26/D-30
coupling without creating the two entry points that note warned about.

⚠ **Renamed 2026-08-21 by R-P1** — see R-1's amendment. "The Matrix — the landing view under R-1"
reads as **Who Needs It**.

### R-8 · Entry visual language: **name carries the floor colour, icon stays neutral**

Replacing today's coloured letter squares:

| Element | Treatment |
|---|---|
| Slot icon | **Generic gear-slot icon, monochrome** — it reads as an icon, not as a status |
| Gear name | **Coloured by floor** (`FLOOR_COLORS`) — the thing the eye actually lands on |
| Floor identity | A thin floor-coloured **accent on the card/section header** — stated once per group, not repeated on every row |

*Why:* the old square encoded slot *and* status *and* floor in one 16px element. Splitting them means
each element says one thing. Repeating the floor colour per row was rejected because a Priority row
already carries role colour on its recipient chips.

**Carried from the standing input, applies wherever a logged entry renders (Log + History too):** a
logged **weapon** entry shows the **weapon's job icon** (`weaponJob`), so which weapon dropped is
unambiguous. ⚠ *This clause read "the recipient's job icon" as given; **R-38** corrects it — the
recipient's job can differ from the weapon's, and only the weapon's answers the question. R-39 cites
this paragraph as its mandate, so the correction has to live here, not only in §0.*

### R-9 · The Matrix **keeps** the floor-coloured names (refines R-8)

Drawing R-8 exposed something the prose hadn't: the Matrix lists every slot at once, so its name
column runs green → blue → purple → amber down its length, where a Queues card shows exactly one
colour. **Kept anyway.** The colour answers "which floor drops this?" with no lookup — the planning
question the Matrix exists for — and because the slots already sit in floor order it reads as bands
rather than confetti.

⚠ *This paragraph's premise was false: the slots did **not** already sit in floor order. Legacy's
`WhoNeedsItMatrix.tsx:57` `GEAR_SLOT_ORDER` and the mockup's `SLOTS` array are **anatomical** order
(weapon, head, body, hands, legs, feet, ears, neck, wrists, ring), which mixes floors freely. v2's
matrix rows instead **band F4→F1** (Weapon first, matching the Queues stack's newest-first order) —
**user-ruled 2026-07-30 at the D3 build.** The banding is what makes the kept colours actually read
as bands rather than confetti; without it R-9's own justification would have been false too.*

⚠ **Renamed 2026-08-21 by R-P1** — see R-1's amendment. This ruling's title and every bare "Matrix"
above, including the lowercase "v2's matrix rows" in the correction paragraph, read as **Who Needs
It**.

### R-10 · Default scope is **per view**; an explicit pick is **global** (refines R-2)

Taken flat, "Queues opens on a floor, Matrix opens on All" would contradict R-2's one-scope-for-all-
views. The reconciliation, which is the ruling:

1. The pill row is **one shared scope**. There is no per-view pill memory.
2. Until the user has stated a scope in this session, each view opens at **its own default** —
   **Matrix → All** (the whole-tier read is its purpose), **Queues → the newest in-progress floor**
   (one card, no scroll).
3. **The first pill click ends that.** From then on the user's scope is global and switching segments
   never moves it.

*Why:* R-2 fixed *reaching* a floor but left Queues-on-All as four stacked cards — the exact scroll
the standing input rejected. This gets the good default without the surprise of a control that
changes under you once you've touched it.

⚠ **Renamed 2026-08-21 by R-P1** — see R-1's amendment. The intro line's "Matrix opens on All" and
item 2's **Matrix → All** both read as **Who Needs It → All**; the mechanic is unchanged.

### R-11 · The Need column counts **the roster**, not a full party

`3/8` on a seven-player static is v1's own behaviour — `WhoNeedsItMatrix.tsx:419` and `:547` print a
**literal 8** while `count` comes from the players actually rendered. v2 prints the roster size:
`3/7` for seven players, `3/8` once the eighth seat is filled. **Scope: v2 only — see R-48.**

*Why:* the denominator is only useful if it can be verified by counting the columns above it. The
literal 8 also disagreed with the material rows in the same table (`:507`, `:614`), which print a
bare total with no denominator at all — so the fix makes the Need column internally consistent as
well. `sortedPlayers.length` is already in scope at both call sites.

### R-12 · The picker states its consequences **without a disclosure click** (D-28)

Three changes, all inside `RecipientPicker`:

| Change | Placement |
|---|---|
| **"This will:"** action preview | Replaces the static footer line (`RecipientPicker.tsx:381-383`), and is **live** — it names the recipient, the week, and each side effect the current toggles will actually cause |
| **Acquired visibility** | The `Mark {slot} as acquired` checkbox is **promoted out of the disclosure into the modal body**, so it renders in assign mode |
| **Rename** | The expandable **`Details` → `Options`** |

*Why:* `showDetails` initialises to `mode !== 'assign'` (`:119`), so on the R-4 path — a matrix cell
click — the acquired checkbox was collapsed and the only consequence text was a static line that
said the same thing regardless of the toggles. R-4 justified routing the cell click through the
picker *because it shows its work before writing*; a preview behind a disclosure would not have
delivered that. v1's quick-log modal showed both (matrix D-28), so this is a restore.

R-6 already settles the reasons/warnings/confidence layer that shares this modal.

**D-36's "no one needs this item!" hint lands here too.** The matrix ruled it `KEEP V2 + HINT`, it
exists only in legacy (`AddLootEntryModal.tsx:564`, `LogMaterialModal.tsx:694`) and `RecipientPicker`
has no equivalent — yet R-4 routes a matrix cell into this modal precisely for the empty-queue case,
and R-12/R-24 rebuild its body. It is the assign-mode complement of "This will:", so it belongs in the
same block; without this clause D-36 would be orphaned between two closed phases.

⚠ **Renamed 2026-08-21 by R-P1** — see R-1's amendment. The two lowercase "matrix cell" mentions
above (the R-4 path in the *Why:* paragraph, and D-36's routing note) read as **Who Needs It**.

### R-49 · A solo-scoped floor card never auto-collapses (refines R-10; ruled at D1 build, 2026-07-30)

FloorCard's auto-collapse (a fully-logged week folds the card behind a `Show` link) applies **only
in the All stack**. When one card is the whole view — R-10's single-floor default or an explicit
floor pill — the card always renders its rows.

*Why:* two ruled behaviours composed badly. R-10 lands Queues on the newest in-progress floor; for
a static whose newest floor is fully logged, the auto-collapse (built for the four-card stack, where
a cleared floor gets out of the way of the others) left the landing view a nearly-empty screen. With
one card there is nothing to get out of the way *of*. Surfaced by the D1 browser-validation
screenshot; user-ruled in session, implemented as FloorCard's `autoCollapse` prop (default true —
the All stack keeps today's behaviour).

### R-50 · D3 build rulings (ruled at D3 build, 2026-07-30/31)

Four decisions made in the course of building D3, recorded here so the design record matches the
shipped code (the matrix's PR body and the parity-matrix write-backs carried them; they had not yet
been folded into this record).

**1. D-25 lands in both the queue why-popover and the picker's ranked rows.** The headline score is
the **enhanced final** — `entry.enhancedScore ?? entry.score`, the exact sort key `priorityEntries.ts`
uses — never the pre-adjustment base. Adjustments restore **both** halves: the "Loot history
adjustments active" line (gated on enhanced scoring being on AND a non-empty loot log) and a per-row
**Adjusted** tag on any nonzero `lootAdjustmentBonus` / `playerModifier`.

*Why:* the base score would let a lower-ranked row display a higher "Priority score" than the row
above it — `ScoreBreakdown`'s component lines only sum to the enhanced total, so anything else never
reconciled with its own breakdown's arithmetic (legacy parity: `LootPriorityPanel.tsx:53`'s
`displayScore` is exactly this ternary).

**2. The why popover shows reasons AND warnings; matrix cells stay minimal.** `QueueWhy` renders
`RankingExplanation` with `showWarnings` on, same as the picker. Matrix cells keep their plain
"Log X for Y" tooltip — no explanation layer.

*Why:* R-6 rules warnings as the picker's layered extra, but a queue row ranking the same candidates
the picker would should be able to answer "why" with the same completeness — hiding warnings there
would make the queue's ranking less trustworthy than the picker's, for no reason. The matrix is a grid
of yes/no cells meant to be scanned at a glance; an explanation essay per dot would defeat that.

⚠ **Renamed 2026-08-21 by R-P1** — see R-1's amendment. Item 2's "matrix cells stay minimal," "Matrix
cells keep their plain… tooltip" and "the matrix is a grid of yes/no cells" all read as **Who Needs
It**.

**3. D-36's hint suppresses the confidence pill when the hint renders; edit mode keeps the pill.**
`RecipientPicker`'s confidence `Tag` is hidden exactly when the empty-pool hint ("No one needs this
item for BiS…") is showing, which is create-mode-only.

*Why:* the two are both header-level, single-line statements about the SAME empty pool — stacking
them said the same thing twice in two registers. Edit mode never shows the hint (reassigning an
existing drop isn't rolling a fresh one), so its pill has nothing to compete with there.

**4. Matrix material cells keep v1's progress-pie treatment, re-expressed v2-owned.** User-ruled
2026-07-31, reversing the interim D3 count-dot: `MaterialProgressRing` (`NeedMatrix.tsx`) restores the
segmented-ring visual — bright slices for what's still owed, dim slices for what's already applied —
via a CSS conic-gradient built from per-segment degree stops, not `MaterialPieIndicator`'s SVG
stroke-dasharray circles (a different mechanism, required by the jscpd gate against the frozen
`WhoNeedsItMatrix`).

*Why:* the plain number-in-a-ring dot D3 shipped first dropped the progress signal legacy's pie
carried — a player needing 1 of 3 twine slots and a player needing 1 of 1 read identically. "How much
is left of how much total" is exactly what a lead scans the matrix for.

⚠ **Renamed 2026-08-21 by R-P1** — see R-1's amendment. Item 4's title ("Matrix material cells keep
v1's progress-pie treatment") and "a lead scans the matrix for" both read as **Who Needs It**; the
ruling's substance — the segmented-ring visual, unchanged by R-P2 — stands as written.

---

## 2. Priority — the shape after R-1…R-12

```
┌────────────────────────────────────────────────────────────────────────┐
│  Loot                                             Adjustments · Rules  │
│  ┌──────────────────────────┐                                          │
│  │ Priority │ Log │ History │    ← the F-06 triad                      │
│  └──────────────────────────┘                                          │
│  ┌────────────────────────────────┐                                    │
│  │ Queues │ Matrix │ Weapons      │    R-3 · lands on Matrix (R-1)     │
│  └────────────────────────────────┘                                    │
│  Floor: [All] [M9S] [M10S] [M11S] [M12S]         [Log floor]           │
│         └ R-2, scopes all three views            └ R-7, follows pill   │
│         └ in Weapons this row reads "M12S · Floor 4" (R-5)             │
├────────────────────────────────────────────────────────────────────────┤
│  MATRIX (landing)           T1   T2   H1   H2   M1   R1   R2    Need   │
│    ⬦ Weapon                  ◉    ·    ·    ◉    ·    ·    ◉     3/8   │
│    ⬦ Head                    ·    ·    ·    ◉    ·    ·    ·     1/8   │
│      └ click a dot → RecipientPicker, pre-filled player + slot (R-4)   │
│    MATERIALS …                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

⚠ **Renamed 2026-08-21 by R-P1.** The diagram predates the rename and is left unredrawn to avoid
breaking its box-drawing alignment (`Matrix` → `Who Needs It` is six characters longer, which would
force every line's border to be recut). Read every "Matrix" in it as **Who Needs It**: the switcher
row's `Queues │ Matrix │ Weapons` segment and its `R-3 · lands on Matrix (R-1)` annotation, and the
section header `MATRIX (landing)`.

**Mockup:** `design/redesign/mockups/03-loot-priority-phase-d.html` — the switcher and the floor
pills are live in it (scoping, the R-7 button swap, the R-5 label swap); everything else is a still.
Also published for viewing at
<https://claude.ai/code/artifact/6ed22323-c071-4cfc-b60d-ec317909b5bf>.

**Priority is fully designed** — R-1…R-12 leave nothing open on this surface. The two items the
mockup raised are ruled: the Need denominator (R-11) and the picker's placement details (R-12).

---

## 3. Log — rulings

Log is the surface v2 never had. D-30 ruled the weekly grid **restored and re-homed** as a *logging*
surface, leaving "where it lives and how it's displayed" to this phase; everything below answers that.

Verification note: the **live** v1 Log surface is `SectionedLogView.tsx` (1,865 lines) — it renders the
grid, the books sidebar, the resets and the count bar inline. `UnifiedWeekOverview.tsx`,
`LootLogPanel.tsx` and `PageBalancesPanel.tsx` have **zero importers** and are dead code; "restore v1's
books panel" means what `SectionedLogView` draws, not `PageBalancesPanel`.

### R-13 · Log shows the **whole week** — four floors, no pill row

Priority's shared floor scope (R-2/R-10) **stops at Priority**. Log's only axis is the week.

*Why:* each floor in the grid is a single compact row, so all four fit without scrolling — the
"scroll to reach Floor 1" complaint that drove R-2 simply doesn't arise here. The week's whole record
in one glance *is* the surface's purpose. Standing input #1 names Priority and History, not Log, and
v1's own grid showed four floors in one table.

### R-14 · Books = a **full-width card below the grid** (D-38)

`BookLedgerCard` re-homes History → Log. **Not unchanged** — three deltas, each load-bearing:

| Delta | Why |
|---|---|
| Takes the **displayed** week, not the clock's | It writes with the week it is given — `adjustBookBalance(…, currentWeek, …)` (`BookLedgerCard.tsx:249-257`) and `MarkFloorClearedModal` (`:294`), fed `clock.currentWeek` at `Loot.tsx:411`. Under R-13/R-15, backfilling week 3 would otherwise credit books to the current lockout |
| Gains row + column kebabs | R-16 / D-39 |
| Regains the per-row `JobIcon` | Legacy shows one (`SectionedLogView.tsx:1412`); the v2 card dropped it |

*Why the card and not v1's rail:* the grid keeps the full width for its cells, and books read as
their own ledger rather than as marginalia. F-07 already put the ledger inside Log; this decides only
its shape there.

**Consequences:** the roster kebab's `?book=` jump (C7/D-05) must retarget `lview=log`; History loses
its books card.

**Dropped by this redesign, named so they are decisions rather than omissions:** the sidebar's
**persisted collapse toggle** (`SectionedLogView.tsx:1358-1370`) — a full-width card has nothing to
collapse into — and the **mobile Loot ⇄ Books panel-tab axis**, which D-44 defers to the Phase-P pass.
Everything else in that sidebar is accounted for and already present in `BookLedgerCard`: scope
toggle, cell-click edit, per-row ledger, mark-floor-cleared, the member-own-row exception and the
`book-row-{playerId}` anchor.

**Build note (D7b, 2026-09-17) — shipped.**

- `BookLedgerCard` mounts on Log (`Loot.tsx`), full width below the fairness read, keyed on the
  DISPLAYED week: `currentWeek={logWeek.week}`. The three writes this ruling named are all
  re-pointed to it — the scoped `fetchPageBalances` fetch, `adjustBookBalance`'s week-of-record,
  and `MarkFloorClearedModal`'s default week.
- A new required prop, `clockWeek` (fed `clock.currentWeek`), is kept separate from `currentWeek`
  and feeds ONLY the scope toggle's "This week" label — **R-D7f**: `This week (Week N)` when the
  displayed week matches the clock, the bare `Week N` when it doesn't, so the toggle never claims
  "this week" for a backlogged view (`BookLedgerCard.tsx`'s `thisWeekLabel`, the same honesty
  `WeekScopeControl.tsx` already applies elsewhere).
- The per-row `JobIcon` is restored (a missing-roster row — no matching `SnapshotPlayer` — renders
  the stored name only, no icon).
- The roster kebab's `?book=` jump now also writes `?lview=log` (`RosterCard.tsx`'s
  `handleBooksJump`) so the jump lands on the view that actually holds the card; History loses the
  card entirely (R-34). This retarget is Books-only: `RosterCard.tsx`'s `jumpToEntry` (the
  loot/material entry jumps) still writes `?lview=history` — those stay on History until **D12**
  (R-28's slot-level anchors, out of scope here).
- Placement is per the **D7-C** ruling: a sibling of the (gated) fairness wrapper, itself UNGATED
  — Books stays useful on a freshly created static with an empty configured main roster (there is
  nothing to divide by zero here, unlike the fairness read). Pinned by test: `Loot.test.tsx`'s
  fresh-static Log test asserts `getByRole('group', { name: 'Books scope' })` renders against two
  unconfigured placeholders + a substitute.
- Collapse toggle and the mobile Loot⇄Books panel-tab axis are dropped, restated from the ruling
  above — nothing new landed for either.
- Two accepted behaviors, named rather than fixed:
  1. **The cold-load first paint is honest only when storage agrees with the URL — it is not a
     flicker-free case by construction.** `useLogWeek`'s `override` state (`useLogWeek.ts:261`)
     initializes to `null` and only resolves `?week=` inside a `useEffect` — which fires after the
     first paint, and only once per `groupId`/`tierId` pair (`useLogWeek.ts:288-314`). `NewShell.tsx`
     mounts `Loot` on `currentGroup` alone (`:92-99`) while `currentTier` is still `null`
     (`tierStore.ts:65`), so the FIRST resolve runs with `tierId` undefined — `?week=` still wins
     there (the URL check runs before the `!tierId` short-circuit, `useLogWeek.ts:236-239`), and the
     card's very first paint reads `currentWeek = N`. But `tier` arriving asynchronously changes the
     effect's key (`groupId`/`tierId` pair, `:289-292`), so it re-runs as a NON-first resolve: that
     pass passes `null` for the URL (`:299`) and reads STORAGE only, so `override` is replaced by
     whatever the tier's stored week is (or `null` → clock) and the mirror (`:309-310`)
     rewrites/deletes `?week=` to match. Net: the first paint is honest at `Week N` from the start
     only when storage already agrees with `N` — for a shared or hand-edited `?week=N` that diverges
     from storage, the label still flips after the tier resolves, AND the deep link's week is lost.
     This `?week=` cold-load clobber is PRE-EXISTING `useLogWeek` behavior (D4/D5), not introduced by
     D7b — queued as a follow-up, observed in the D7b browser pass. The in-app-navigation flicker and
     the `?week=1` special case below are unaffected by this correction. The flicker happens on an
     in-app navigation where `tier` is **already hydrated** when `Loot` (re)mounts:
     `BookLedgerCard`'s first paint lands before the resolve effect has fired, so `currentWeek` still
     falls back to `clock.currentWeek` — trivially equal to the `clockWeek` prop (same source) —
     producing one paint of `This week (Week {clock.currentWeek})` before the effect resolves the
     URL override and, if it differs, the label flips to the bare `Week N`.
     **Special case, more than one paint:** with `?week=1` specifically, the override resolves to
     `1` — which coincides with `lootTrackingStore`'s own `currentWeek: 1` default
     (`lootTrackingStore.ts:115`) for as long as the mount effect's `fetchCurrentWeek(groupId,
     tierId)` call (`Loot.tsx:487`) hasn't resolved the real clock week yet. Until that async fetch
     settles, `currentWeek === clockWeek === 1` holds for real, not just for one paint, so the
     toggle correctly-but-misleadingly reads `This week (Week 1)` across however many renders that
     fetch takes.
     **Observed in the D7b browser pass (2026-09-17):** a bare `?lview=log&week=2` cold open in a fresh tab, with the v2 storage key holding `1`, displayed **Week 2** and kept `?week=2` — the tier was already known at `Loot`'s first resolve (NewShell renders `<Loot tier={currentTier}>` only once the group has loaded), so the re-key path never ran. The clobber therefore remains a real code path in `useLogWeek.ts:288-314` that bites only if the first resolve runs tier-less; it was not reproduced on a cold open, and it stays queued rather than fixed.
  2. **All-time scope re-fires on every Log week step.** The card's fetch effect depends on
     `currentWeek` even when `scope === 'all'` (where `scopedWeek` is always `undefined`), so
     stepping the Log week re-issues an identical unscoped `fetchPageBalances` call each time. This
     `currentWeek` dep is actually redundant, not load-bearing: in week scope `scopedWeek` (also a
     dep) already changes in lockstep with it, and the backstop the adjacent comment documents is
     the `pageLedger` dep alone. Pre-existing (`git blame` dates the line to 2026-07-02, before D7b
     touched this card), left untrimmed here as a harmless idempotent over-fetch — out of this
     task's scope to change.

### R-15 · **Log owns the week; Priority is always now**

Week stepping exists only in Log. Priority ranks against the current lockout, always, and has no week
control at all.

*Why:* v2 today lets a stale Priority-view scope drive a write, and the codebase already carries the
scar — `Loot.tsx:322-326` documents a deliberate History-side override so "Log a drop" can't inherit
it. Making the week Log's property deletes `scopedWeekOverride` (`:170-171`, consumed at `:326`,
`:377`, `:441`, `:505`) and the workaround with it. Deciding is about now; backfilling is a Log task.

**Implementation note, not a ruling:** legacy persists the Log week under
`history-week-{groupId}-{tierId}` (`HistoryView.tsx:101,122`) and mirrors `?week=` (`:129-137`). v2's
Log needs its own key — **`v2-history-week-{groupId}-{tierId}`, reading legacy's as a fallback but
writing v2-only**, the same shape §6 rules for `roster-hide-subs` and C6 used for `useRosterSortPreset`.

### R-16 · **Log owns every bulk reset** (D-39)

| Entry point | Scope |
|---|---|
| Toolbar kebab | week / all-time × loot / books / data — moves from History |
| Floor-header kebab | that floor's loot and books, **for the displayed week** |
| Books **column** kebab | Floor N books — week or all-time, **following the card's own scope toggle** |
| Books **row** kebab | that player's books — week or all-time, same toggle |

Right-click opens the same menu; the kebab is the keyboard and AT route. History keeps only its
per-entry kebab (edit / copy link / delete / jump).

*Why:* destructive bulk edits belong where the data is authored. The scope-toggle coupling is what
D-39 actually restores — legacy's column and row menus read the books panel's week/all-time state
(`SectionedLogView.tsx:404-424`, `:427-447`), and `BookLedgerCard` already has the same toggle (`:162-171`).

**Implementation note, not a ruling — this is work, not a re-home.** `ResetConfig` carries
`floor`/`playerId` (`ResetConfirmModal.tsx:21-32`) but v2's handler destructures only
`{ scope, target, week }` (`Loot.tsx:279`) and filters week-or-all (`:290-292`): a floor- or
player-scoped config fed to it today would delete **everything**. The legacy reference implementation
is `SectionedLogView.tsx:450-538`, including `clearFloorPageLedger` / `clearAllFloorPageLedger` /
`clearPlayerWeekPageLedger` / `deletePlayerLedger` (`:491-511`). Separately, `LootResetMenu` is passed
`clock.currentWeek` (`Loot.tsx:384`) where legacy passes the *selected* week (`HistoryView.tsx:287`) —
under R-15 it must follow the displayed week or "reset week loot" wipes the wrong one.

**Build note (D7a 2026-08-24 / D7b 2026-09-17) — all four entry points shipped (1 & 2 D7a; 3 & 4
D7b, with the card re-home).**

- Toolbar `LootResetMenu` re-gated to `lview === 'log' && canEdit` at `logWeek.week` (the
  DISPLAYED week, R-15-consistent); week-scoped labels name the week per ruling **R-D7d**
  (`Reset Week {N} loot/books/data`); the trigger stays the labeled **Reset** button per ruling
  **R-D7e** — a named deviation from the §4 mockup's bare `⋮`.
- The scope machinery: `handleResetConfirm` now consumes the pure planner `loot/resetActions.ts`
  (`resolveResetActions` + `describeResetToast`) — a structural re-expression of the frozen
  `SectionedLogView.tsx:450-538` semantics with legacy's playerId-beats-floor-beats-week-beats-all
  precedence, unit-pinned. One deliberate hardening over the frozen reference: a floor-scoped loot
  config with NO week filters by floor across all weeks (legacy fell through to EVERYTHING); a
  missing/out-of-range floor fails closed.
- The mechanism split, disclosed: the three floor/player book clears
  (`clearFloorPageLedger`/`clearAllFloorPageLedger`/`clearPlayerWeekPageLedger`) are reversal-POST
  shims netting balances to zero via compensating adjustment rows, while `deletePlayerLedger` is a
  TRUE backend DELETE — the Books card's row kebab (D7b, below) surfaces both: its week item runs
  `clearPlayerWeekPageLedger` (a shim) and its all-time item runs `deletePlayerLedger` (a true
  delete), so the two items on the same row differ in destructiveness. **Present tense for D7a:**
  the floor kebab's
  `Reset {floorName} books` already reaches a shim today — it emits a floor+week config, so it runs
  `clearFloorPageLedger`, which writes compensating `adjustment` rows rather than deleting any. Of
  D7a's six toolbar book paths, `Reset Week {N} books/data` and `Reset ALL books/data` are true
  DELETEs (`clearWeekPageLedger`, `clearAllPageLedger`); `deletePlayerLedger` and
  `clearPlayerWeekPageLedger` are wired through the planner and, since D7b, first reachable
  *through the reset-confirm pipeline* via the Books card's row kebab (below) — `deletePlayerLedger`
  itself has been reachable in v2 since F6d through the card's own `PlayerLedgerModal` "Clear
  History" door (`history/PlayerLedgerModal.tsx:59`, mounted in `BookLedgerCard.tsx`), a separate,
  non-planner path this note is not about.
- Inherited copy divergence, disclosed not fixed: `ui/ResetConfirmModal.tsx:152` says "permanently
  delete" even on the reversal-POST paths (shared frozen file; R-44 was the one approved delta) —
  and D7a is the slice that first makes one of those paths reachable, via the floor kebab's books
  item.
- **D7-D fact (i), now observed:** the floor menu names the duty (`Reset M9S loot`) while the frozen
  confirm names the position (`loot entries for Floor 1 in Week 3`, `ResetConfirmModal.tsx:70`).
  Both are correct and the index-1 mapping is unit-pinned; the vocabulary simply differs across the
  menu/confirm seam because the confirm copy is shared frozen V1 copy.
- **Materials ride with loot, per legacy:** a `target: 'loot'` (or `'data'`) config deletes the
  matching *material* entries too — `handleResetConfirm` loops `plan.materialEntries` on the same
  scope. Exact parity with `SectionedLogView.tsx:470-477`, which filters materials by week and
  floor on the floor branch; called out here because the floor-scoped door is new in v2.
- Floor kebab per rulings **R-D7a** (two week-less reset items — `Reset {floorName} loot` /
  `Reset {floorName} books` — joining "Log floor" after a separator) and **R-D7b** (ContextMenu
  two-trigger conversion off the D6b Radix Dropdown; kebab keeps `aria-label="{floorName} actions"`
  + gains `aria-haspopup="menu"`). Named interim per R-D7b: `ui/ContextMenu` lacks
  focus-restore-on-close and `aria-expanded`, and closes on scroll — joins the standing
  kebab-family a11y queue. **D11 enlarged this queue rather than adding to it differently:** History's
  row kebab took the same conversion (R-D11-D), so those three gaps now recur **once per table row**
  instead of once per card. It also carries one gap of its own — the kebab `<button>` now sits inside
  a `<tr role="button">`, which ARIA marks presentational (mitigated: the row's `onKeyDown` ignores
  events whose target is not the row itself, so the kebab's Enter never doubles as a row activation).
  **And a fourth, found in D11's browser pass with the comparison that makes it actionable:** the
  History row kebab opened with **Enter** does not move focus into the menu (no `focusin` fires at
  all), while the same component opened by **mouse** focuses the first item at the second animation
  frame — and D7's own `M9S actions` kebab *does* move focus on Enter. So it is usage-specific, not
  component-wide. The menu remains operable (`ArrowDown` enters it; roving `tabindex` is correct),
  so this is one keypress and a missed announcement rather than lost access. Whoever takes this
  queue should price `ui/ContextMenu` against Radix once for the whole family — and start from that
  D7-vs-D11 difference, which is a live reproduction rather than a theory. **Third gap, same queue (whole-branch review, nit 5):** a
  keyboard-invoked context menu (Shift+F10 / the menu key with the kebab focused) bubbles to the
  header `<div>`, so `jumpMenuAnchor` measures the full-width bar and anchors the menu at its
  far-left while the kebab sits at `ml-auto` right. Enter/Space on the kebab anchors correctly
  (button rect), so the keyboard route works — it is only mis-placed. The header-bar `onContextMenu` carries a targeted
  `jsx-a11y/no-static-element-interactions` disable with reason (the pre-authorized F-7
  containment; `eslint.config.js` untouched).
- The R-22 boundary restated: Revert and Start-next-week remain CLOCK-bound with the divergence
  notice — only the reset family follows the displayed week.

**Build note (D7b, 2026-09-17) — entry points 3 & 4 (Books column/row kebabs) shipped.**

- The Books **column** kebab (per floor header) and Books **row** kebab (per player) each carry
  ONE item, following the card's own scope toggle (This week / All time — the toggle's default
  stays all-time, unchanged). The four emitted configs, exactly as the card builds them
  (`BookLedgerCard.tsx`'s `buildBooksMenuItem`):
  - Column, week scope: `Reset Floor {F} books (Week {N})` → `{ scope: 'floor', target: 'books', week: N, floor: F }`
  - Column, all-time scope: `Reset ALL Floor {F} books` → `{ scope: 'floor', target: 'books', floor: F }`
  - Row, week scope: `Reset {name}'s Week {N} books` → `{ scope: 'week', target: 'books', week: N, playerId, playerName }`
  - Row, all-time scope: `Reset ALL {name}'s books` → `{ scope: 'all', target: 'books', playerId, playerName }`
  Labels follow **R-D7d**'s naming convention (the toolbar/floor items already established); both
  kebabs hand their config to the same `onResetConfig={setResetConfig}` the floor-header kebab
  already uses, so all four entry points converge on one `handleResetConfirm`/`resolveResetActions`
  pipeline.
- Two-trigger mechanism per **R-D7b**, re-applied one level down from the floor header: a
  `canEdit`-gated `IconButton` kebab (`aria-label="Book {numeral} actions"` on the column,
  `aria-label="{playerName} book actions"` on the row, both `aria-haspopup="menu"`) plus
  right-click on the `<th>`/`<tr>` itself, both routing into ONE `BooksMenuState` and ONE
  `ContextMenu` mount at the card root — never a per-column or per-row menu instance.
  `jumpMenuAnchor` (the same helper `LogWeekGrid.tsx`'s floor menu uses) supplies the
  keyboard-invoked (Shift+F10/menu-key) fallback anchor. For a viewer (`!canEdit`), the right-click
  door is not merely hidden — `BookLedgerCard.tsx:285-292,325-332` passes `onContextMenu={undefined}`
  on both the `<th>` and `<tr>` in that case, so right-click is inert, not just visually absent (no
  kebab renders either, per the `canEdit`-gated `IconButton` above).
  No `jsx-a11y` rule fired on the `<th>`/`<tr>` `onContextMenu` handlers, so — unlike the floor
  header's `<div>` — no eslint containment comment was needed here.
- The row kebab gates on `canEdit` ONLY (**D7-g**): the member-own-row cell-edit exception
  (`rowCanEdit`, which also admits the row's own linked user) grants edit access to that row's
  balance cells but never the bulk-reset kebab — a member editing their own row still sees no
  kebab.
- The **R-D7b named interim** recorded under D7a (no focus-restore-on-close, no `aria-expanded`,
  closes on scroll, and a keyboard-invoked context menu mis-anchoring relative to the visible
  trigger) now applies to these two new surfaces as well — it was never floor-kebab-specific, and
  is restated here rather than left implicit.
- The inherited `ResetConfirmModal.tsx:152` "permanently delete" copy (disclosed, not fixed, under
  D7a) sits over these paths too, including the row's `clearPlayerWeekPageLedger` shim — the same
  frozen shared file, unedited.

### R-17 · One logging path — **loot cells** to the picker, **material cells** to the material modal

A loot cell opens `RecipientPicker`: empty → assign mode pre-filled floor + slot, filled → edit mode.
Legacy's `AddLootEntryModal` is **not** restored. Material cells route to the material modal (R-21/R-26)
in both create and edit.

*Why:* R-4 applied to a different geometry — the grid and the matrix become the same flow. The
material split is forced, not chosen: `DropItemContext.slot` is `GearSlot | 'ring'`
(`RecipientPicker.tsx:31-36`), so the picker cannot represent a material at all.

⚠ **Renamed 2026-08-21 by R-P1** — see R-1's amendment. "The grid and the matrix become the same
flow" reads as "the grid and **Who Needs It** become the same flow."

**Build note (D5, 2026-08-22) — three cell-door decision points ruled at plan-vet fold; four
re-expression deltas disclosed at build.**

- **R-D5a · subs reach the grid through an opt-in, not a default.** `QuickLogMaterialModal`'s
  pinned branch gains an optional `allowSubs?: boolean` prop (`QuickLogMaterialModal.tsx:64`,
  `:307`, `:649-652`) — `undefined` everywhere it isn't explicitly passed, so V1's pinned door,
  the matrix cell door, and the queues floor-card door all stay value-identical to today and keep
  R-a's main-roster-only inheritance (R-26's D8 build note, below). Only `Loot.tsx`'s grid
  material-cell door passes `allowSubs: true` (`Loot.tsx:761`, `:901-902`), which both surfaces
  the "Include substitutes" checkbox and swaps the full roster in for the main-roster-only list it
  filters from. User-ruled 2026-08-22 during the D5 plan-vet fold, ahead of R-a's next natural
  pinned-door decision point.
- **R-D5b · the section header matches `FloorCard`'s shipped treatment, not R-19's literal text.**
  R-19 below describes a "floor-coloured accent bar"; what shipped is FloorCard's header
  treatment, plus R-19's `· Book {numeral}` metadata line in place of FloorCard's status
  metadata — the `FLOOR_ACCENT_CLASS` stripe, the duty name as a muted
  `Tag variant="label" tone="muted"` (only when the tier actually names the floor, the same
  `floorName !== 'Floor N'` guard FloorCard uses), and the `Floor {n} · Book {numeral}` metadata
  line (not part of FloorCard's own header, which carries `· {cleared|in progress} · drops: …`
  metadata instead) — with **no tint band** (`FLOOR_TINT_CLASS` intentionally not added). One structural
  difference from FloorCard: because one grid wrapper holds all four floors (not one card per
  floor), the accent stripe scopes to each floor's header bar rather than the section as a whole
  (`LogWeekGrid.tsx:1-20`). User-ruled 2026-08-22 — matching an already-shipped, already-reviewed
  header beats inventing a second one for the grid.
- **R-D5c · the suggested recipient answers "who's up next right now," not "who's up next for
  this week's cell."** The material cell's suggestion runs `materialPriorityEntries` against the
  shared clock's **current** week regardless of which week Log is displaying — the honest read of
  "who should get this" is always about present standing. The **write** still targets the
  **displayed** week (R-15/R-20 unchanged): stepping to a past week and logging a material there
  logs it in that week, suggestion notwithstanding. User-ruled 2026-08-22.

**Four re-expression deltas, disclosed, not rulings:**

1. **A filled cell's click edits the newest entry — an accepted interim, not R-17's final shape.**
   A cell holding more than one entry (the `×N` badge) opens the edit door on the newest one only;
   there is no route yet from `×N` to the other entries it counts. D6's `EntryPopover` (R-18/R-27)
   closes this — until then the badge is a count with no route to what it counts (F-14i).
   **Closed in D6a (2026-08-23):** the `×N` badge is now a real trigger button —
   `LogCellEntriesMenu` (R-D6a, the v2-owned fork; `EntryPopover` was not imported — see the R-18
   build note below) opens a newest-first list of every entry the badge counts, loot and material
   alike, and clicking any row edits that exact entry. The cell's single edit `Button` still targets
   `entries[0]` only — the R-17/D5 interim shape, unchanged by this close — the chip is the route to
   everything else. F-14i is closed.
2. **Material cells bucket every matching entry per week, not just one.** The legacy grid's
   `find()` surfaced a single material entry per cell, silently under-reporting a week where the
   same material dropped twice (e.g. two Solvents). `logWeekGridData.ts` buckets materials the
   same way it buckets loot — an array, newest-first — so a double-drop week shows its real `×2`
   instead of hiding the second entry. Deliberate re-expression, not a legacy quirk reproduced.
3. **Material column labels use the short forms, including "Tome."** `universal_tomestone`'s
   column reads "Tome," matching both the §4 mockup's column label and legacy's own grid column;
   the long `UPGRADE_MATERIAL_DISPLAY_NAMES` form ("Universal Tomestone") stays for the modal and
   History, where there's room for it (F-14ii).
4. **The floor-name fallback matches what v2 *writes*, not a parity claim against legacy's
   lookup.** An entry lands in floor *n*'s bucket when its stored floor name matches
   `floors[n-1]`, falling back to `` `Floor ${n}` `` when the tier has no name for that slot — the
   same fallback v2's own writers already use (`Loot.tsx`). This is **not** a restore of legacy
   behavior: legacy's `WeeklyLootGrid` lookup path has no such fallback at all (only its *display*
   config falls back to `Floor N`), so an unnamed floor would have silently dropped legacy's
   entries. Recorded as a correction, not a parity gap (F-8).

### R-18 · Cell affordances — plain click **never navigates**

| Input | Effect |
|---|---|
| Click | Log (empty) or edit (filled) — never a jump |
| `Shift+Click` | Copy the entry's deep link |
| `Alt+Click` | Jump to the recipient's card, slot row highlighted |
| Right-click / kebab | Edit · Copy link · Jump to {player} · Delete |

The pointer cursor appears **only while Alt is held** (`useAltHeld`, the C4 reference implementation).
The `×N` multi-entry badge → `EntryPopover` survives.

*Why:* the C7/D-55 ruling, unchanged — "forcing the alt modifier makes it an intentional action". The
kebab exists so every modifier action has a keyboard and AT route; right-click is the shortcut to it.

**Implementation notes, not rulings:**

1. The deep link is `lview=log&week=N&entry=<id>&entryType=loot|material` and lands **on Log**, at that
   week, with the cell pulsed. `entryType` is not optional — loot and material ids are independent
   sequences, legacy disambiguates with it (`SectionedLogView.tsx:631-652`) and v2's own `copyLink`
   already sets it (`Loot.tsx:256`).
2. **The jump destination is net-new.** `gear-row-{playerId}-{slot}` and the slot pulse exist only in
   legacy `GearTable.tsx:324,659` via `useViewNavigation.ts:136`; v2's `RosterGearTable.tsx:319` has no
   row ids and no `highlightedSlot`, and v2's only deep link is card-level `?player=`
   (`Roster.tsx:359,388`). The legacy hook is the reference *behaviour*; the build adds the anchors to
   `RosterGearTable` and drives them with same-route params, the C7 pattern at `RosterCard.tsx:281-297`.
3. A material entry's jump target is `slotAugmented` (`WeeklyLootGrid.tsx:731`), which is **null for a
   universal tomestone** — that case jumps to the card, not to a row.

**Build note (D6a, 2026-08-23) — the modifier family shipped; two forks ruled ahead of build.**

- **Shipped modifier table**, matching the ruling above exactly: Click = log (empty) / edit `entries[0]`
  (filled) — never a jump. `Shift+Click` = copy the entry's deep link
  (`tab=gear&lview=log&week={displayed}&entry={id}&entryType={loot|material}`, `shell` stripped,
  `tier` kept from `window.location.href`, the A10 clipboard shape — `tab=gear` is what lands the
  recipient on the Loot tab at all, `Loot.tsx:214`). `Alt+Click` = jump to the recipient's roster
  card. **Correction (D6a browser pass, 2026-08-23, F3) — the "Alt+Enter also jumps" parenthetical
  above was false, live-falsified in Chrome:** a trusted Alt+Enter on a focused cell fires the
  PRIMARY action (edit), not the jump — Chrome's keyboard-activation click on a `<button>` does not
  carry `altKey`, so nothing distinguishes it from a plain click/AT-activation (D6-c already routes
  that case to edit). The keyboard/AT jump routes are the cell kebab and Shift+F10/menu-key → "Jump
  to {player}" in the context menu below (D6-c's own rationale: "the AT route to the jump is the
  context menu"). No separate keydown handler was added — the plan's no-separate-handler stance
  stands with this premise corrected.
  Right-click / menu-key / the R-D6b kebab = Edit · Copy link · Jump to {player} (only when the
  recipient resolves) · Delete. Pointer cursor appears only while Alt is held **and** a jump target
  resolves (`useAltHeld`, extracted verbatim to `hooks/useAltHeld.ts`, the C4 reference — one
  consumer each in `RosterGearTable` and `LogWeekGrid`).
- **R-D6a · the `×N` route is a fork, not an import.** `LogCellEntriesMenu`
  (`loot/LogCellEntriesMenu.tsx`) is v2-owned, built on `primitives/Dropdown`, generic over loot
  AND material entries (newest-first; clicking any row edits that exact entry). The frozen
  `EntryPopover` above is **not imported** — D6-a's three verified legs (legacy is
  `LootLogEntry[]`-only so half of D6's material need goes unmet, it re-derives a ring label v2's
  data layer already canonicalises, and it hand-rolls positioning/dismissal the Radix primitive
  gives for free) supersede §5's recorded "Import" default for this leaf; `phase-d-loot-plan.md` §5
  (the `EntryPopover` / `LootFairnessLegend` row) is updated in this same write-back to record the
  outcome. `LootFairnessLegend`'s own import default is untouched — it lands with the count bar in
  D6b, not here.
- **R-D6b · the context menu also lives on a hover/focus-revealed per-cell kebab** (every filled
  cell), opening the identical items list right-click/menu-key open — one items list, multiple
  triggers, and a real button browse-mode AT users can reach without relying on Shift+F10 passing
  through an AT virtual cursor.
- **D6-c refinement — `detail === 0` (a synthetic AT click) fires the PRIMARY action, not the jump.**
  Deliberate divergence from the C4 gate: on `RosterGearTable`'s jump spans the jump IS the only
  action, so detail-0 maps to it there; a grid cell's primary action is edit, and mapping AT
  activation to a hidden secondary action would violate "appearance must match behavior." The AT
  route to the jump is the context menu (this ruling's own rationale: "the kebab exists so every
  modifier action has a keyboard and AT route").
- **D6-h — empty-cell modifier clicks are no-ops.** Shift/Alt held over an empty cell does nothing;
  there is no entry to copy a link to or jump from, and opening the log door on a modifier click
  aimed at something else would surprise.
- **The Alt-jump destination is card-level, by stated interim.** `Alt+Click` / "Jump to {player}"
  lands on `tab=roster&player={id}` — the only `?player=` contract the app consumes today
  (`Roster.tsx:359,388`; scroll + URL-strip owned by `GroupViewContent.tsx:239-265`; the pulse
  applied by `RosterCards`) — and renders only when the entry's recipient resolves to a current
  roster player. This ruling's own note 2 above (slot-level `gear-row-{playerId}-{slot}` anchors +
  `highlightedSlot`) and R-28's week-split destination are **not** built by D6a; they arrive in
  **D12**, which retargets the same callback.
- **Delete parity, verified end to end.** Delete routes through `Loot.tsx`'s existing
  `requestDelete` → confirm modals, matching the legacy hover-× path hop for hop:
  `onDeleteLoot(entry.id)` (`WeeklyLootGrid.tsx:405-408`) → `handleGridDeleteLoot`
  (`SectionedLogView.tsx:901-906`) → `handleDeleteLoot` → `setConfirmState` →
  `deleteLootAndRevertGear(..., { revertGear: true })` (`:262-275`). One named delta: legacy always
  reverts gear; v2's loot confirm exposes a revert-gear **checkbox** (the `DeleteLootConfirmModal`
  mount, `Loot.tsx:1146-1166`; the checkbox itself lives in `history/DeleteLootConfirmModal.tsx`)
  instead of hard-coding it.
- Out of D6a, ruled for **D6b**: the teaching tooltip, the recipient-badge hover-`×`, the count bar
  + legend, and the floor-header "Log floor" kebab (R-23/R-25/R-27's own build notes land there).

### R-19 · Floor colour is stated **once**, on the section header

The header carries the floor-coloured accent bar **and keeps its `Floor N · Book {I–IV}` metadata line**
(`WeeklyLootGrid.tsx:527-529`). Cells stay neutral. Recipient badges keep role colour + job icon;
material cells keep the material tokens.

*Why:* R-8's rule applied here — a grid row's floor is never in doubt, so repeating the colour per cell
would be noise. The metadata line stays because it is the **only** place the floor↔book mapping is
stated on the logging surface, and R-16 puts book resets on that same header.

### R-20 · Free-form entry points (D-35)

Log's toolbar carries **Log a drop** (`Alt+L`, v2's existing) and **Log material** (`Alt+U`, the D-35
restore — v2 has no free-form material entry today). Both target the **displayed** week. The whole-week
wizard stays reachable from both tabs: Priority's targets the current week, Log's the displayed one.

⚠ **`Alt+M` is not available.** It is bound to *Settings: Members*
(`useGroupViewKeyboardShortcuts.ts:213-217`), registered `alwaysEnabled` **outside** the legacy-loot
guard, so it is live in v2 today. Legacy's material binding was always `Alt+U` (`:185-191`).
**Matrix D-35's wording carries the same error and must be corrected in the same write-back.**

**Build note (D4, 2026-07-31) — "Log material" ships in D8, not D4.** `QuickLogMaterialModal`'s
props (`QuickLogMaterialModal.tsx:27-39`) are fixed `floor`/`material`, exactly what R-26 grows into
real floor + material selectors; a toolbar button can't honestly log free-form material before that
selector exists. User-ruled at D4 kickoff: D4 ships **"Log a drop"** (and the whole-week wizard) on
Log's toolbar; **"Log material" carries to D8**, alongside R-26's selector work. This is a build note,
not a ruling change — R-20's substance (both actions target the displayed week, restored, `Alt+U`
binding) is untouched; only "Log material"'s arrival slice moves.

**Build note (D4, 2026-07-31) — Log's D4 body is an honest placeholder.** The weekly grid (this
ruling's home for logging cells) is **D5**; the Books card is **D7**. D4 ships the real toolbar, the
real week model (`useLogWeek`), and an empty-state card (`LogEmptyState.tsx`) naming what lands next —
no fake controls, no disabled buttons standing in for D5's cells. Per the phase dependency graph
(`phase-d-loot-plan.md` §3), D8 lands before D5, so this placeholder outlives D4 by at least one more
slice.

### R-21 · Material entries become **editable** (D-37)

A filled material cell opens the material modal in edit mode with old-vs-new augmentation
reconciliation.

**Implementation note, not a ruling:** net-new, not a re-home — `QuickLogMaterialModal`'s props
(`:27-39`) carry no `editEntry`, and it has no notes field either, which an edit round-trip needs.

### R-22 · Week control (D-40 + D-41)

`WeekScopeControl` gains **prev/next chevrons** and **go-to-current**, keeping Start-next-week and
Revert. Revert runs the pre-check and shows a **data-summary modal** listing the loot, materials and
books that will move.

**Revert and Start-next-week stay bound to the *clock*, never the displayed week.** They read
`clock.currentWeek`/`maxWeek`, the data summary summarises the clock's newest week, and when the
displayed week differs the control **says which week it will act on**. Today the two cannot diverge
(`WeekScopeControl.tsx:50,69-75` calls `clock.revertWeek()`), but R-15 gives Log a freely-steppable
displayed week, and V1's summary modal filters strictly by the week it is handed
(`RevertWeekConfirmModal.tsx:37-49`). A user reading week 2 who hits Revert must not revert week 2.

**Correction to the D-40 row's reading:** the pill's *label* is only `This week (Week N)`
(`WeekScopeControl.tsx:52-53`); the date range and the loot/books/mats dots are on the dropdown
**items** (`:90-113`) and already exist.

**`Alt+←` / `Alt+→` and `Alt+B` are restored** (`useGroupViewKeyboardShortcuts.ts:166-175`, `:192-198`),
rebound to Log — see R-42.

### R-23 · The week's count bar **and its legend**

`LootCountBar` comes with the grid as a per-week fairness read, **with `LootFairnessLegend` directly
below it** (`WeeklyLootGrid.tsx:859-877`, rendered at `SectionedLogView.tsx:1143-1147`).

*Why the legend is not optional:* it is the only thing that decodes the bar's blue/grey/amber counts,
and D-30 lists it in the restore. It does not collide with R-19 — it explains the count bar, not cell
colour.

**Both homes are now closed.** `FairnessSummary` moves to static Home beside Team Summary (**R-40**),
and Team Summary's own home was already ruled there by F-08 (`systems-flow-map.md:218`, `:122`), which
also closes D-43. *(This paragraph read "still open, and only this" until R-40 ruled it.)*

**Build note (D6b, 2026-08-23) — shipped as the v2-owned `WeekCountBar`, not the imported frozen
`LootCountBar`.**

- **Per ruling R-D6n**, the count bar is a re-expression (`loot/WeekCountBar.tsx`), not an import —
  the frozen `history/LootCountBar.tsx` drops to `text-[10px]`/`text-[9px]`, below the 12px floor
  this grid and its teaching layer hold everywhere else. This makes the plan's "sub-12px disclosed
  interim" branch (D6-n option 1) moot: it was never taken. Every text node in `WeekCountBar.tsx`
  is `text-xs` or larger. `LootFairnessLegend` is still imported from `history/WeeklyLootGrid.tsx`
  unmodified, per R-D6n.
- **Boundary semantics preserved from the frozen reference:** main-roster only
  (`!isSubstitute`, `WeekCountBar.tsx:32`), counts scoped to the one week passed in
  (`WeekCountBar.tsx:35`), sorted by seat — `T1 T2 H1 H2 M1 M2 R1 R2`, an unknown/missing
  position sorting last (`WeekCountBar.tsx:29,41-44`) — and colored against the roster average:
  `> avg+1` → `var(--color-status-info)`, `< avg-1` → `var(--color-status-warning)`, otherwise
  `var(--color-text-secondary)` (`WeekCountBar.tsx:56-62`).
- **Reads the DISPLAYED week** (D6-g) — `week={logWeek.week}`, never `clock.currentWeek`
  (`Loot.tsx:1039`), so the read always matches whatever week the grid above it shows.
- **Review fix (PR #245):** the mount was changed to `players={mainRosterPlayers}` — the same
  `configured && !isSubstitute` read `FairnessSummary` already uses (`Loot.tsx:336-339`) — a
  deliberate delta from the frozen reference's raw-`players` feed, so an unconfigured placeholder
  seat (`backend/app/routers/tiers.py:97-106`) neither renders a nameless 0-drop tile nor dilutes
  the average's denominator.
- **Named interim, not a fix:** the per-tile tooltip trigger is a non-focusable `<div>`
  (`WeekCountBar.tsx:77-81`) — a 1:1 carry from the frozen reference's own non-focusable trigger.
  Keyboard users cannot open a tile's tooltip at all (there is nothing in the tab order to focus).
  This joins the already-queued project-wide Tooltip keyboard-gap item; disclosed here, not fixed
  by this slice.

### R-24 · Assign mode gains **Method and Notes** (extends R-12)

The picker's assign body gains the method choice (drop / book / tome / purchase) and the notes field.

*Why:* both are gated on `mode !== 'assign'` today (`RecipientPicker.tsx:536`, `:584`) with
`method='drop'` hard-set (`:237`), so a cell click could not log a **book** acquisition at all —
legacy's empty-cell click opened `AddLootEntryModal` with the full choice (`SectionedLogView.tsx:889-894`).
R-17 removes the legacy modal, so the picker has to carry what it carried.

⚠ *Corrected at D2 build (director plan-vet): this paragraph's "legacy's empty-cell click
opened `AddLootEntryModal` with the full choice" is a mechanism error — that modal offers only
Drop/Book (`AddLootEntryModal.tsx:472-475`), and no legacy modal ever offered tome or purchase.
R-24's four-method list stands on its own text: it is a **new capability**, not a restore.*

### R-25 · **"Log floor"** lives on the floor-header kebab

Not a standing button. The kebab already carries that floor's resets (R-16), so one control per floor
means "log it or clear it".

*Why:* legacy had both a visible `[Log Floor]` button and a context item (`WeeklyLootGrid.tsx:532-547`,
`:119-125`); four standing CTAs above four data rows would compete with the cells that are themselves
the primary logging affordance. This closes the D-26/D-30 coupling the matrix flagged: R-7 homes
Priority's floor wizard, R-25 homes Log's.

**Build note (D6b, 2026-08-23) — shipped kebab-only, exactly as ruled.**

- Each `FloorSection` header carries a `canEdit`-gated `Dropdown` kebab (`LogWeekGrid.tsx:536-553`),
  `aria-label={`${floorName} actions`}` (a duty name, or the `Floor N` fallback when gamedata names
  none — `logWeekGridData.ts:149`), holding the ONE item this ruling specifies: `Log floor`
  (`LogWeekGrid.tsx:548-550`). No standing button — the kebab is the only door.
- Selecting it fires the required `onLogFloor(floorNumber)` prop, which `Loot.tsx:1031` wires to
  `setWizardState({ floor })` — the SAME already-shipped `LogWeekWizard` the controls row's own
  "Log floor" button opens (R-7), not a second wizard instance.
- **Displayed-week initial, exactly like R-7's own door:** `writeWeek` resolves to `logWeek.week`
  whenever `lview === 'log'` (`Loot.tsx:795`), and the wizard mount reads
  `currentWeek={writeWeek}` / `singleFloorMode={wizardState?.floor != null}` /
  `initialFloor={wizardState?.floor ?? 1}` (`Loot.tsx:1153,1157-1158`) — so opening the kebab on
  a non-current displayed week logs against THAT week by default. The user can still change the
  week inside the wizard afterward, same as every other door into it.
- D7 adds this floor's resets to this same menu — the kebab is the intended home, not a stopgap
  needing replacement.
- **D7a (2026-08-24):** the promised resets arrived — the kebab now carries `Log floor` + the
  floor's two reset items (R-D7a), and the menu itself converted to the two-trigger `ContextMenu`
  pattern (R-D7b).

### R-26 · **`QuickLogMaterialModal` is the one owned material component**

It grows floor + material selectors (free-form entry), a notes field, and edit mode. Legacy's
`LogMaterialModal` is **not** adopted.

*Why:* `PRODUCT_MODEL.md:201` demands one owned component, and `history/` is frozen — mounting the
legacy modal would take a v2 dependency on a file v2 must not edit. What has to be built is exactly
what legacy already proves out (`LogMaterialModal.tsx:84`, `:209-238`, `:306-310`).

**Build note (D8, 2026-08-08) — R-a/R-b ruled at Task 7 build (the toolbar wiring).**

- **R-a · subs widening.** The "Include substitutes" checkbox (D-37's restore) is real in
  **non-pinned** modes only — free-form and edit. The pinned door keeps its original
  `configured && !isSubstitute` filter verbatim, because V1 only ever mounts pinned
  (`LootPriorityPanel.tsx:770`), and V1's `QuickLogMaterialModal` (the priority-panel quick door)
  never offered subs at all — widening it there would be a V1-visible behavior change, not a
  restore. Legacy's Loot-Log-tab `LogMaterialModal` DID offer subs (an "Include Subs" checkbox,
  `LogMaterialModal.tsx:672-677`, applying the widened predicate at `:460`) — which is why D8's
  restore is exactly that: a restore, re-expressing that existing widening into the one owned
  component, not a new capability. The two v2 cell doors (matrix + queues floor card) also mount
  pinned, so they inherit the same main-roster-only filter; only the toolbar's free-form door gets
  the full roster (`allPlayers={players}`, not `mainRosterPlayers`) for the checkbox to widen from.
  Legacy's second recipient control, `showAllRecipients` ("Show all players",
  `LogMaterialModal.tsx:678-683`), has no v2 equivalent by construction — the recipient list always
  ranks needers first and lists non-needers after (never hides them), so there is nothing left to
  toggle.
- **R-b · both toolbar actions everywhere.** "Log a drop" (D4) and "Log material" (D8) render on
  **all three** Loot views — Priority, Log, History — matching D4's already-shipped precedent: the
  toolbar mounts once, unconditioned on `lview`, so there is no per-view gate to diverge. They **move
  together or not at all**: a future slice that hides one from a view must hide the other too, or the
  toolbar starts making an unstated claim about which entry points are "real" on that view.

⚠ **Renamed 2026-08-21 by R-P1** — see R-1's amendment. R-a's "the two v2 cell doors (matrix + queues
floor card)" reads as "(**Who Needs It** + queues floor card)."

### R-27 · The grid details that come back

**Restored:** the per-cell modifier-teaching tooltip (`WeeklyLootGrid.tsx:653-680`, `:773-798`) — R-18
defines the modifiers and this is what teaches them, the same pairing C7 needed for R-076 · the
`Floor N · Book {I–IV}` header line (folded into R-19) · the recipient-badge hover inline-delete `×`
(`:402-433`), which keeps one-hover deletion alongside the kebab route.

**Build note (D6b, 2026-08-23) — both restorations shipped, re-expressed at the 12px floor.**

- **The teaching tooltip** is `CellTeachingTooltip` (`LogWeekGrid.tsx:233-263`), mounted on every
  FILLED interactive cell's edit `Button` via `Tooltip` (`LogWeekGrid.tsx:452`). It is a
  re-expression, not a transcription, of the legacy rows: `Click` "Edit entry" ·
  `Shift+Click` "Copy link" · `Alt+Click` "Go to player" · `Right-click` "More options"
  (`LogWeekGrid.tsx:245-250`), data-driven off `CELL_TEACHING_ROWS` rather than hand-repeated JSX.
  Every row is `text-xs` (`LogWeekGrid.tsx:254,257`) — the 12px-floor correction over legacy's
  `text-[10px]` chips. The `Alt+Click` row is gated on `canJump` and omitted entirely when no jump
  target resolves (`LogWeekGrid.tsx:255`, the same `jump` gate `GridCell` already computes for the
  cursor swap) — the tooltip never teaches a modifier the cell can't currently honor.
- **The hover-`×`** is an `IconButton` sibling between the `×N` chip and the kebab
  (`LogWeekGrid.tsx:469-476`), revealed on hover **and** keyboard focus
  (`opacity-0 focus-visible:opacity-100 group-hover:opacity-100`, `LogWeekGrid.tsx:474`) — the
  **D6-e delta**: the frozen reference is keyboard-reachable but visually invisible on focus
  (`group-hover:opacity-100` only, no `focus-visible` rule), and this build adds the reveal rather
  than carrying the gap forward.
- **Delete routing matches legacy hop for hop** (verified end to end, D6-d): the hover-`×` calls
  `onDeleteEntry`, which `Loot.tsx`'s existing `requestDelete` routes to the same confirm modals
  the D6a modifier-menu Delete item already uses — `DeleteLootConfirmModal` for loot,
  `ConfirmModal` for material (`Loot.tsx:1229-1265`), matching
  `onDeleteLoot` → `handleGridDeleteLoot` (`SectionedLogView.tsx:901-906`) → `handleDeleteLoot` →
  `deleteLootAndRevertGear(..., { revertGear: true })` (`SectionedLogView.tsx:262-275`). **One
  named delta, carried from the R-18 build note and unchanged here:** legacy always reverts gear
  on delete; v2's loot confirm exposes a revert-gear **checkbox** instead of hard-coding it
  (`DeleteLootConfirmModal` mount, `Loot.tsx:1229-1246`) — the checkbox control itself lives in
  `history/DeleteLootConfirmModal.tsx`, read-only reuse.
- **Named interim, not D11's scope:** the hover-`×` (and the identical Delete item on the
  modifier-menu route) both target the NEWEST entry only — `onClick={() => onDeleteEntry(buildRef(newest))}`
  (`LogWeekGrid.tsx:475`). An older entry is reached via the `×N` chip menu → its edit door, or via
  History. Arbitrary-entry delete on the grid itself is **D11**'s scope, not this slice's.

### R-28 · The gear-slot jump **splits by week** (D-05, completing R-18)

A roster gear-slot jump lands on the **Log cell** when the entry is in the displayed week's grid, on
the **History row** when it is older, and on the **Books row** for books.

*Why:* `systems-flow-map.md:175` already ruled the destination splits post-D-30; R-14 retargeted only
the books half. `RosterCard.tsx:281-297` still hard-codes `lview=history` for every loot and material
jump, so the loot half is unbuilt.

---

## 4. Log — the shape after R-13…R-28

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Loot                                                Adjustments · Rules │
│  ┌──────────────────────────┐                                            │
│  │ Priority │ Log │ History │                                            │
│  └──────────────────────────┘                                            │
│  Week 3 · Jul 22–29  ◀ ●●● ▶  ⊙  ⟳  ＋      [Log a drop] [Log material] ⋮│
│  └ R-15 · Log owns the week   └ R-22 chevrons + go-to-current  └ R-16 ⋮  │
├──────────────────────────────────────────────────────────────────────────┤
│ ▌M9S   Floor 1 · Book I                                              ⋮   │
│   Loot │ Ears    │ Neck   │ Wrists │ Ring          └ R-25 Log floor      │
│        │ ◆Alice  │  —     │ ◆Bob   │  —              + R-16 floor resets │
│ ▌M10S  Floor 2 · Book II                                             ⋮   │
│   Loot │ Head    │ Hands  │ Feet   │ Glaze  │ Tome                       │
│        │  —      │ ◆Cara  │  —     │ ◆Dan   │  —                         │
│ ▌M11S  Floor 3 · Book III                                            ⋮   │
│ ▌M12S  Floor 4 · Book IV                                             ⋮   │
│   Loot │ Weapon        └ click: log/edit · Shift: link · Alt: jump (R-18)│
│        │ ◆Erin                                                           │
├──────────────────────────────────────────────────────────────────────────┤
│  This week   Alice ██ 2 · Bob █ 1 · Cara █ 1 · Dan █ 1 · Erin █ 1 · … 0   │
│  Loot fairness:  ■ Most (>avg+1)   ■ Average   ■ Least (<avg-1)   ← R-23 │
├──────────────────────────────────────────────────────────────────────────┤
│  Books                    [This week│All time]   [Mark floor cleared]     │
│    Player    I ⋮   II ⋮   III ⋮   IV ⋮      └ R-16 column + row kebabs   │
│    ◆Alice    2     1     0      3    ⋮ ⏱     follow this toggle          │
└──────────────────────────────────────────────────────────────────────────┘
```

**One model, not one button.** Loot ends this phase with five logging entry points — R-7's floor
button, R-4's matrix cell, R-20's two toolbar actions and R-25's floor kebab — plus the queue-row
assign. That is deliberate and is *not* the "16 ways to log loot" regression `PRODUCT_MODEL.md:222`
names: the consolidation target is **one model** (picker for loot, material modal for materials, wizard
for the week), which is what `:142` asks for, reached from wherever the user already is.

⚠ **Renamed 2026-08-21 by R-P1** — see R-1's amendment. "R-4's matrix cell" reads as "R-4's **Who
Needs It** cell."

**Sketch amendment (D9b, 2026-09-21).** Two details above are superseded by what shipped, and the
sketch is left as drawn rather than redrawn so the change stays visible: the stats count
(`12 entries (9 gear, 3 material)`) is **not** in the toolbar stack above the card — it moved inside
the card, immediately above `<thead>`, as a `role="status"` line (R-D9b-C, user ruling); and the
separator renders `· current` **beside the date range**, with the entry count right-aligned at the
far end of the band, rather than after the count as drawn.

**Director verdict (2026-07-28): PARITY-GAP — approve with required changes.** All thirteen required
changes are folded in; the four that were design forks rather than corrections were ruled by the user
as R-24 (method + notes), R-25 (floor kebab), R-26 (one material component) and R-27 (grid details).
⚠ **Scope of that pass:** it ran against a charter *reconstructed from prose*, because this branch was
cut before the real `xivrp-director` definition merged to main. It therefore had **no shared-layer,
design-system or vocabulary lens**. §7a is the pass that supplied them.

**Write-back policy** (stated because this phase split them, where Phase C did not):

- **Factual corrections land now** — a row that misstates today's code misleads whoever reads it next,
  regardless of whether any code ships. ✅ **Already applied on this branch:** D-35's `Alt+M`→`Alt+U`
  (*both* the What and Ruling cells) · D-31's "stats footer"→header · §0 standing input 3's job-icon
  correction (R-38, inline at §0) · F-04 and the stale `⏳` markers in the flow map (R-41).
- **Ruling-driven row rewrites land with the build**, per the Phase-C precedent that rulings and matrix
  rows arrive in the same PR: **D-38** (books' placement = R-14) · **D-39** (reset entry points = R-16)
  · **D-40** (the pill already carries the dots) · **D-43** (closed by F-08) · **D-54** (see R-42) —
  alongside D-23/D-27 already owed from R-3.

---

## 5. History — rulings

Structure is already ruled and not re-opened here: **D-31** makes v1's cross-week flat table the
History model, **D-72** merges the structured search into it, **D-32/D-33** dissolve the List view and
the layout axis, **D-34** keeps v2's kebab and returns "Jump to {player}". History's identity is
*find*, and after §3 it is the only loot surface that does not author the week.

Two components meet here: v1's `AllWeeksView.tsx` (655 lines — flat sortable table, structured search,
`Ctrl+Shift+F`, All/Gear/Materials toggle, floor chips, stats count, sticky header, row-click edit,
modifier clicks, right-click menu) and v2's `LootHistoryTable.tsx` (week-grouped cards + `LootEntryRow`,
and the owner of the `?entry=`/`?entryType=` highlight effect at `:81-103`).

### R-29 · Week grouping survives as **separator rows**, only while sorted by week

The table is flat and sortable. While the sort is **Week** — the default — a thin separator carries
v2's week header content: `Week 3 · Jul 22–29 · 4 entries`, **including its current-week marker**.
Sort by any other column and the separators disappear.

Within a week the secondary sort is **`createdAt` descending**.

*Why:* v2's `WeekGroupHeader` earned its keep (the date range answers "which lockout was that?" without
arithmetic), but a week separator under a Player sort would be a lie — the rows either side of it are
no longer a week. Making the separators a property *of the week sort* keeps the information and drops
it exactly when it stops being true.

*Why the tiebreaker is a ruling and not a detail:* v1 sorts on `a.weekNumber - b.weekNumber` alone
(`AllWeeksView.tsx:279`) over a `[...lootRows, ...materialRows]` concatenation (`:199`), so a stable
sort leaves every week as "all loot in log order, then all materials" — and `sortDir` never touches
the tie. v2 today already sorts `createdAt` desc within a week (`historyItems.ts:47-51`), so restoring
v1's comparator verbatim would be a **regression against what ships now**.

**Implementation notes, not rulings:**

1. ⚠ **Rewritten 2026-09-18 — the cited file is deleted; D9b rebuilds from this note, not from the
   old citation.** The current-week marker and its token choice live only in git history now, at
   `3f90d420:frontend/src/components/loot/WeekGroupHeader.tsx`. `:14-19` is the UTC-pinned `DATE_FMT`
   (`Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })`), with its
   rationale documented inline: "UTC-pinned so the shown date never shifts a day (WeekScopeControl
   precedent)"; `:21-23` is `formatRange`, joining the two formatted dates with an en dash —
   `` `${DATE_FMT.format(range.start)} – ${DATE_FMT.format(range.end)}` ``. `:29-39` is the week pill:
   `:34`'s base classes (`font-display text-xs font-extrabold rounded-full px-2.5 py-0.5`) plus
   `bg-accent/15 text-accent-hover` when current, `bg-surface-elevated text-text-secondary` when not,
   with the measured-contrast rationale quoted verbatim from the deleted file's comment —
   "text-accent-hover (not text-accent): the default accent (#0c7d71) only clears AA on solid
   surface-base/card backgrounds, not on the bg-accent/15 tint composited over them (#dbebea ≈ 4.07:1
   in light theme, measured via the contrast harness). accent-hover (#0a6b60) is darker and clears AA
   on the tinted pill with margin" — and `:38`'s label, `` `WEEK ${week}` ``. `:42` is the
   `` `${count} drop${count === 1 ? '' : 's'}` `` copy.
2. Resolved by D0's `ui/SortableHeader` (R-46); consumer arrived D9a.
3. **Sort and filter state are session-local**, matching v1 (`AllWeeksView.tsx:97-102`, which persists
   nothing). If that is ever revisited, the key must be distinct — `v2-sort-preset-{tierId}` is already
   taken by the roster (`useRosterSortPreset.ts:43`).

**Build note (D9a, 2026-09-18) — shipped the table half; separators are D9b.** Seven sortable columns
on `ui/SortableHeader` (`COLUMNS`) plus a plain sr-only `Actions` `<th>` for the kebab, a fixed
newest-first tiebreak (`sortHistoryItems`'s `tiebreak`, R-D9a-B: `createdAt` desc → `loot` before
`material` → id desc, never direction-aware) and per-column natural first direction
(`nextHistorySort`'s `NATURAL_DIRECTION`, R-D9a-C). `thead` is `sticky top-0 z-10`, pinned to its
nearest scrollport — `GroupViewContent`'s `overflow-y-auto` content div inside `AppChrome`'s
`<main id="main-content">` (the element `#main-content [class*="overflow-y-auto"]` resolves to);
the table's card never scrolls horizontally (`overflow-clip`); the content pane itself can still
overflow at narrow widths from the pre-existing stats-card row above the table, which is not this
slice's (R-D9a-D, D9a-n) — measured on the shipped table (after the Type column went `w-36` +
`whitespace-nowrap`): at 1440 the table's max-content width is 953 px and its min-content width
835 px; at 1024 it fills an 874 px card (872 px) and at 900 it sits at its min-content in an
837 px card (2 px of slack), the ⋮ column fully visible at both; at 880 the card stays 837 px and
the *pane* scrolls horizontally from its own minimum width (the stats-card row), so the table card
itself never clips at any width tested — narrower is mobile territory, Phase P. The Date column reads local time (D9a-o); D9b's
week-range separators stay UTC-pinned per implementation note 1 above — both are correct for what
they each show. Sort state is session-local component state (`useState`), matching note 3. Week
separators and the current-week marker are **not** built this slice — rebuild them from note 1's
git-ref archaeology.

**Build note (D9b, 2026-09-21) — separators shipped; R-29 is now complete.** A `<tr>` with one
`colSpan={COLUMNS.length + 1}` cell (`WeekSeparatorRow` in `LootHistoryTable.tsx`, not a restored
`WeekGroupHeader.tsx` — R-D9b-D: it is table-coupled now and has one consumer), emitted whenever the
previous row's `weekNumber` differs, gated on `sort.field === 'week'` and **direction-agnostic**
(R-D9b-E — week asc is still grouped by week). Three deviations from note 1's archaeology, all
deliberate:
- **R-D9b-A** — the count reads `{n} entries`, not `{n} drop(s)`: §6's sketch says "entries", R-34's
  stats count on the same screen says "entries", and the number includes material rows. `entryCount`
  is the single author for both readouts.
- **R-D9b-B** — the current week carries a visible `· current` beside the range as well as the pill
  tint (§6's sketch). Tint alone is a colour-only signal. Range and marker share one span joined on
  ` · `, so a week the clock cannot date renders "current" with no orphan dot.
- **R-D9b-F** — the pill is `Tag variant="label" tone={isCurrent ? 'accent' : 'muted'}`, not the
  archaeology's hand-rolled span. `Tag`'s `accent` tone **is** the measured pair note 1 argues for
  (`bg-accent/15 text-accent-hover`) and `muted` **is** its non-current pair
  (`bg-surface-elevated text-text-secondary`), so the contrast ruling survives intact — verified live
  in light theme, where the pill computes `rgb(10, 107, 96)` = `#0a6b60` = accent-hover exactly.
  **Three deltas from the archaeology's span, all cosmetic and all disclosed:** `font-extrabold` is
  dropped — a **choice**, not an impossibility: an appended plain weight utility does not beat `Tag`'s
  own `font-medium` (same Tailwind layer, and the emitted stylesheet sorts `.font-extrabold` before
  `.font-medium`, so the later rule wins the equal-specificity tie whatever the class string says —
  measured 500 on the rendered pill), and the important form `font-extrabold!` **would** have carried
  it. Forcing `!` past a primitive's own base is a worse trade than a lighter pill, and the shipped
  weight reads fine in both themes (D9b PR screenshots); `Tag` adds a **1 px border** (`border-accent/30` / `border-border-default`) the
  span never had; and `Tag`'s `BASE` is `px-2` against the archaeology's `px-2.5`. Net: a ringed pill
  2 px narrower, in the display face, carrying the identical contrast pair. `font-display` is applied
  and does take effect.

**Re-measured after the layout change** (D9a's own lesson): with separators rendered, the table's
min-content is **836 px** and max-content **954 px** at 1440 — +1 px each vs D9a's 835/953, so the
`colSpan` cell does not move the intrinsic widths and D9a-n's clipping conclusion stands.

**The `<tr>` `highlight-pulse` ring was finally eyeballed** (D9a had computed-style evidence only):
under `border-collapse: collapse` the `inset` ring paints on all four edges in **both** themes at
1440. The outset glow is clipped by the card's `overflow-clip`, as D9a's trade note predicted. No
fix was needed.

### R-30 · **One filter state** — the pills write into the search box (D-72)

Clicking a pill inserts its token — `player:alice`, `floor:m12s`, `type:loot` — and clicking it again
removes it. The box stays freely typable, keeps its clear button, and `Ctrl+Shift+F` still focuses it.

*Why:* D-72 asked for "the best of the structured search + v2's filter pills", and two independent
filter surfaces ANDed together give a user two places to look when the table comes back empty. Writing
the pill's token into the box means the pills are a **teaching surface** for a syntax that is otherwise
undiscoverable — the power-user feature and the beginner affordance become the same control.

**The round-trip is not free.** v2 ships **its own** parser, modelled on `AllWeeksView.tsx:214-268` —
that function lives inside frozen `history/` and must not be edited (R-43). The v2 reimplementation
carries four fixes the original lacks:

| Defect | Evidence | Resolution |
|---|---|---|
| `type:gear` matches **nothing** | `:234` compares against `r.type ∈ {'loot','material'}` (`:161`, `:181`), so `'loot'.includes('gear')` is false. The v1 toggle's *label* is "Gear"; its *value* is `loot` (`:466`, `:476`). `type:materials` fails the same way | v2's parser **accepts aliases** — see R-47 |
| No token expresses v2's **Tome** pill | `historyItems.ts:60` — `tome` means `method === 'tome' \|\| method === 'purchase'` | The `source:` key, per R-36 |
| Multi-floor selection unexpressible | v1's `activeFloors` is a multi-select `Set` with a min-1 guard (`:100`, `:299-309`); AND-ed tokens make `floor:m9s floor:m10s` empty | Comma alternation, per R-36 |
| A player name with a space cannot round-trip | The tokenizer splits on `/\s+/` with no quoting (`:215`), so `player:Tank One` parses as `player:tank` + a free `one`. FFXIV names are always two words | **Quoting**: `player:"Tank One"` |

Two behaviours the reverse read must state, because the parser is silent on both today:

- A pill renders active **only on exact token equality**. A freely typed `player:ali` filters the table
  (`:233` is a substring match) but lights no pill — the pills reflect what they wrote, not what matches.
- **A trailing-colon token is neutral, and an unknown key is surfaced.** `player:` alone fails the
  `colonIdx < token.length - 1` guard (`:221`) and falls through to free text, so the table *empties
  while the user is still typing the word*. An unknown key silently no-ops (`default: return true`,
  `:239`), which reads as "filter applied" when nothing was. Neither is acceptable on a find surface.

v2's own pill state (`HistoryFilters.tsx`, `DEFAULT_HISTORY_FILTERS`) dissolves into the query string.

### R-36 · The query gains **comma alternation** and a `source:` key

A comma-separated value means OR: `floor:m9s,m10s`. Repeated keys keep their current AND meaning, so
no existing query changes behaviour. `source:` is added, mapping to v2's `matchesSource`
(`utils/historyQuery.ts`'s `matchesSource` — D10 moved it there; `historyItems.ts` no longer holds
it) — `source:tome` is tome-or-purchase **and loot-only**, which no `method:`
tokens can express.

> **Precision added at D10 build.** Comma alternation — added by this same ruling — means
> `method:tome,purchase` *does* reach the method half. What it cannot reach is `source:`'s
> **loot-only gate**: a material logged under either method is swept in by the `method:` form and
> excluded by the `source:` one. The key earns its place on the kind gate, not on the OR.

*Why:* one parser change closes both losses D-31 would otherwise take — the multi-select floor chips it
names in the restore, and v2's Tome pill. Comma was chosen over "repeated keys OR" because the latter
silently redefines queries that already work.

### R-47 · `type:` accepts **aliases**, so the pill teaches a token that works

v2's parser maps `gear|loot → loot` and `materials|material → material`. The pills keep reading
**Gear** and **Materials**; `type:extra` and `type:bis`, which the original parser already honours
(`AllWeeksView.tsx:234`), survive and match the Type column's own vocabulary.

*Why:* R-30 justifies the pills as a **teaching surface** for an undiscoverable syntax. A pill labelled
"Gear" that inserts `type:loot` teaches a token the user could not have derived from the label, which
defeats the rationale and breaks label-matches-outcome. Aliasing keeps the better word — everything on
this tab is loot, so *gear vs materials* is the real distinction — while making the obvious typed
token work.

### R-37 · The filter query is **session-local**, and never reaches a copied link

> ⚠ **Built differently, and deliberately (R-D10-F, D10).** The heading's mechanism did not survive
> contact: the query lives in `useState` and never enters the URL, so `copyLink` has **nothing to
> strip**. A `params.delete('q')` against a param nothing writes is dead code that reads as
> protection. What is load-bearing is the **absence** of that delete — `buildEntryLink` keeps every
> param it does not explicitly remove — so the invariant is commented at the denylist site and
> pinned by a test that reads the router's own location. **Do not add a strip call.**

The query is not URL-backed, so it cannot reach a copied link. *(As ruled 2026-07-28 this said
"`copyLink` strips it from the link it builds, exactly as it already strips `shell`" — a mechanism
that presumes the query IS in the URL. D10 built the stronger version instead; see the warning
above and R-D10-F.)*

*Why:* `Loot.tsx:39-43` documents the invariant being protected, in the code, as a deliberate decision:
filters are session-local *so that an `?entry=` deep-link can never be hidden by a filter on first
mount*. Making the query shareable would break it in a way that fails silently — `LootHistoryTable`
resolves the highlight against the **unfiltered** logs (`:72-77`) but renders only filtered rows
(`:107-108`), so a filtered-out target scrolls to nothing and then clears its own params 2.5 s later
(`:90-97`). The user sees the right screen and no highlight, with nothing to indicate why. A
non-shareable filter is the cheaper loss.

**Build note — R-30 / R-36 / R-47 / R-37 all shipped in D10.** `HistoryFilters.tsx` (97 lines),
`DEFAULT_HISTORY_FILTERS`, `HistoryFilterState`, `HistorySource`, `filterHistoryItems` and
`historyWeeks` are **deleted**; the query string is the tab's only filter state. v2's parser is
`utils/historyQuery.ts`, the control block is `components/loot/HistorySearch.tsx`, and
`AllWeeksView.tsx` was never edited or imported (R-43 held). Contract in `DESIGN_SYSTEM.md` §3.37.

Nine things this ruling text did **not** settle were ruled at plan or build time, and the build
follows the ruling, not the sketch, wherever they disagree:

1. **The pill set is §6's** — Type · Floor · Player. Week and Source keep their tokens but lose
   their controls, so **the placeholder is where they are taught**:
   `Search — player:"Tank One", floor:m9s,m10s, source:tome, week:3`. It deliberately does **not**
   carry `Ctrl+Shift+F`, which §6's sketch draws and V1's placeholder advertises — that binding is
   D11's (R-35), and advertising an activation that will not fire inverts D-55.
   **Discharged (D11, 2026-09-22):** the binding now fires, so the prohibition's *reason* is spent.
   The placeholder still omits it — it is already carrying four keys of syntax teaching, which is
   this rule's other job — and the shortcut is surfaced instead as the `(^⇧F)` hint at the end of
   the search row, which is where §6's sketch draws it (R-D11-J).
2. **Pills merge into one comma list**, never a second token of the same key. `floor:m9s floor:m10s`
   ANDs to empty, so a second click had to extend the first token's value list.
3. **`hasQueryToken` and `toggleQueryToken` must agree across repeated keys.** Found at build: the
   reader searched every token of a key while the writer edited only the first, so a hand-typed
   `floor:m9s floor:m10s` lit the M10S pill off the *second* token and a click could never switch it
   off. The remove branch now clears the value from all tokens of that key.
4. **`player:` — quoted means exact, bare means substring.** The deleted dropdown matched by
   **id** (`a99da91d:frontend/src/utils/historyItems.ts:166` — the line is gone from HEAD); a name-substring pill would silently over-select whenever one
   roster name prefixes another ("Tank One" / "Tank One Alt"). Pills always quote, so a pill still
   means *this player*, while R-30's own sanctioned `player:ali` still filters. **Residual,
   accepted, both disclosed:** once a roster row is deleted the log keeps only
   `recipientPlayerName`, so a current same-named player's pill claims those rows; and
   `SnapshotPlayer.name` carries no uniqueness constraint, so two configured slots sharing a name
   are one pill and one result set. An id-bearing token would close the second and defeat R-30 —
   the pills exist to *teach* a syntax the user can read and retype, and `player:#a3f1c2` is
   neither.
5. **An unknown key is *ignored*; an unknown value on `source:`/`week:` *matches nothing*.** Both
   are surfaced in the hint line. Not an inconsistency: a key the parser cannot identify names no
   field and so cannot constrain anything, while a value on a known field is a real constraint
   nothing satisfies. This closes the half of R-30's complaint the ruling text left open — it names
   the unknown *key* but an unknown *value* produced the same unexplained empty table.
6. **An unterminated quote is lenient.** It still groups to end-of-string, but it does not buy
   exact-match semantics: `player:"Tank` is a query mid-typing, and exact-matching it empties the
   table for exactly the reason the neutral trailing colon exists.
7. **`week:` takes a whole number or it is an unknown value.** `parseInt('3abc')` is `3`, which
   filtered to week 3 while reporting nothing — the failure mode of point 5 reintroduced by a
   weaker check. One helper authors both the validity test and the match.
8. **`method:` matches the raw method only.** Every `METHOD_INFO` label is the capitalised raw value
   (`lootMethodDisplay.ts:10-13`), so a label clause could never add a match under case-insensitive
   substring — dead code by the same standard that rejected a `delete('q')` for R-37.
9. **`slot:` also reaches a material's `slotAugmented`**, so R-34's `aug {slot}` readout is
   searchable. On the tab whose identity is *find*, visible-and-unsearchable is a defect. (`date:`
   is the same class and is left alone — v1 has no date field either, so it is parity-neutral.)

**R-37 holds by construction, not by a strip call.** The query lives in `useState` and never enters
the URL, so `copyLink` has nothing to delete — a `params.delete('q')` against a param nothing writes
is dead code that reads as protection. Because `buildEntryLink` **keeps every param it does not
explicitly delete**, the *absence* of that delete is load-bearing and is commented at the denylist
site; a test drives the real box and the real copy-link path to pin it. The `?entry=` highlight still
resolves against the **unfiltered** logs, with a third test case added for a target the active query
filters out.

**Found at whole-branch review, fixed in-slice.** Three of these are worth carrying forward
because each is a *class* of mistake, not a one-off:

- **A writer must never append after an unterminated quote.** Clicking a pill while `player:"Tank`
  sat in the box appended `floor:m9s` *inside* the open quote, producing one token whose bare value
  was `Tank floor:m9s` — pill unlit, table empty, and **neither** hint line firing, because the key
  was known and the value merely unmatched. Exactly the unexplained empty table point 5 was ruled to
  prevent, reintroduced through the writers instead of the parser.

  ⚠ **The first fix for this was itself wrong, and is the more useful half of the lesson.** It
  normalised the open token — keyed → bare, free → quote closed — which fixed the one-word case and
  broke the multiword one: `player:"Tank One` became `player:Tank One`, re-tokenizing as
  `player:Tank` plus a free `One`. A different filter, silently, past a regression test that only
  covered one word. **The shipped fix does not rewrite the token at all.** An unterminated token can
  only ever be *last* (its quote runs to end-of-string), so `appendToken` inserts the new token
  **before** it and leaves it verbatim — R-D10-D's promise intact, no semantics changed.
  `serializeToken` separately quotes any value containing whitespace, so editing the open token
  itself cannot emit a bare multiword value. `emitToken` no longer exists; do not reinstate it.
- **`slot:` matched a stale `weaponJob` the cell deliberately hides.** The Slot cell gates its job
  icon on `itemSlot === 'weapon'` because the edit API keeps a non-null `weapon_job` when a slot
  moves away from weapon — so `slot:pld` surfaced a Body row showing no PLD anywhere. Point 9 with
  the sign flipped: searchable but invisible. The matcher now gates identically.
- **A test can pin the wrong thing convincingly.** T-8 asserted that `copyLink`'s output carries no
  query, and its comment claimed that URL-backing the query later would fail it. It would not:
  `buildEntryLink` reads `window.location.href`, while the repo's URL-backing path
  (`useUrlTabState` → `useSearchParams`) never touches `window.location` under `MemoryRouter`. The
  test now also reads the **router's** location, and a mutation that URL-backs the query does fail
  it.

**`week 3` never worked, in either shell (R-D10-T).** `w3` and `week3` are single tokens and hit the
shorthand regex; `week 3` is **two** terms, matched independently — `week` matches every row (the
matcher tests `` `week ${n}`.includes(term) ``) and `3` matches anything containing a 3, so a week-4
row on floor `M3S` came back. v1 has the identical hole. Free terms are otherwise v1-verbatim, but a
shorthand the docs *advertise* while the parser filters by "contains 3" is a defect, not parity: an
adjacent `week` + digits pair is now rejoined before matching.

Free text was extended to reach `slotAugmented` too (**R-D10-S**) — `legs` is what someone types to
find which twine went into legs, and point 9's rule binds harder on the un-keyed form than the
keyed one.

**Placement (interim).** The search block sits **inside the History grid, below `FairnessSummary`
and directly above the table** — not above the card, as §6's sketch implies. `FairnessSummary` stays
between the toolbar and the table until D14 moves it Home (R-40), and a control belongs next to what
it filters. The two positions converge once D14 lands.

### R-31 · A plain row click **opens the entry for editing**

Same contract as a Log grid cell: click authors, `Shift+Click` copies the link, `Alt+Click` jumps to
the player with the slot row highlighted, and a plain click **never navigates**.

*Why:* v1 did this (`AllWeeksView.tsx:311-333`) and R-18 just set the same rule one tab over. One
mental model across both surfaces beats a per-tab exception.

Three qualifications, none of them optional:

1. **The cursor tells the truth.** v1 sets `cursor-pointer` and `tabIndex={0}` unconditionally
   (`:551-552`) while gating the click on `canEdit` (`:326`) — so a viewer's rows advertise an
   activation that will never fire. Pointer only when `canEdit`, plus R-18's Alt-held swap. This is
   D-55's C7 refinement verbatim: an element must never advertise a plain click it won't honour.
2. **Text stays selectable.** v1 sets `select-none` on every row (`:551`) — on the one tab whose whole
   identity is reading back what happened. Selection survives on the text cells (Player, Slot, Method,
   Date); v1's `window.getSelection()?.removeAllRanges()` guard (`:315`) stays, so `Shift+Click` still
   doesn't leave a selection artifact behind.
3. **The modifiers work from the keyboard** — `:555-559` casts the `KeyboardEvent` through to the same
   handler, and `altKey`/`shiftKey` exist on it, so `Alt+Enter` and `Shift+Enter` carry. Stated because
   it currently reads as accidental rather than designed.

**Implementation note, not a ruling:** a `tabIndex={0}` `<tr>` with an `aria-label` (`:553`) and no
`role` needs one — the row *is* a control here, unlike C7's `RosterCard` body, which took a justified
`design-system-ignore` precisely because a plain click there does nothing.

### R-32 · The row kebab, and what "view this week" now means

Kebab items, with right-click opening the same menu (the kebab is the keyboard and AT route):
**Edit · Copy link · Jump to {player} · View week N in Log · Delete**.

*Why the rename:* v1's menu offered "View Week N in **Grid**" and "in **List**"
(`AllWeeksView.tsx:378-391`). D-33 dissolved the layout axis and D-30 re-homed the grid, so "Grid" is
now simply **the Log tab** and "List" no longer exists. The item survives as a cross-tab jump —
History finds the entry, Log shows its week in context.

**A material row's Edit opens R-21's material modal.** This is net-new: v2 cannot edit a material at
all — `LootHistoryTable.tsx:26` types `onEdit` as `(entry: LootLogEntry)`, `LootEntryRow.tsx:148`
gates the item on `kind === 'loot'`, and `Loot.tsx:238-240` only ever opens the picker. v1's table
*can* (`:329-330`, `:353-359`), so leaving this unsaid would drop a live v1 affordance while D-37
explicitly restores it.

**Implementation notes, not rulings:**

1. **The table needs an eighth column for the kebab.** v1 has no kebab at all — only `onContextMenu`
   (`:561`), so "the kebab is the AT route" is a v2 addition, not a restore.
2. Right-click anchors at raw `clientX/clientY` (`:337`), which puts the menu in the page corner when
   the context menu is invoked from the keyboard (both coordinates zero). Reuse the owned
   `jumpMenuAnchor` helper (`rosterLedgerJumps.ts:75-83`) — the same fix PR #200 already made.

### R-33 · Floor colour lives in the **Floor column**, and only there

The Floor cell keeps v1's floor-coloured chip (`AllWeeksView.tsx:569-579`). The Slot name stays
neutral; material rows keep their material dot (`:584-589`).

*Why:* this is R-8 applied to a table rather than a card. R-8 colours the gear *name* because a Queues
card has no floor column to carry it; History has one on every row, so colouring the name too would
state the floor twice. Same principle as R-9 and R-19 — say it once, in the element that exists for it.

**Implementation note, not a ruling:** restore the chip's *treatment*, not its code.
`:570-578` builds it from inline `style` with `floorColors.hex` and `` `${hex}15` `` — hardcoded colour,
a design-system violation — while the floor *filter* chip on the same screen already uses the class
tokens (`:493-497`; `loot-tables.ts:69-73` exposes `bg`/`text`/`border` alongside `hex`). Use the tokens.

**Build note (D9a, 2026-09-18) — shipped.** `LootHistoryTable.tsx`'s `floorToneOf` is a typed
`floors.indexOf` lookup into `` `floor-${n}` `` (a closed `Tone` union — only floors 1–4 tint), rendered
via `Tag tone="floor-N"`; an empty `entry.floor` renders `—` rather than an empty chip. `FLOOR_COLORS`
(`loot-tables.ts`) is unused by this cell.

### R-38 · A weapon row shows the **weapon's** job icon (amends R-8's standing input)

The Slot cell carries `weaponJob`; the recipient's own job icon stays where it belongs, on the
recipient chip.

*Why — this corrects the standing input, which was self-defeating as written.* The 2026-07-26 input
said a logged weapon entry shows *the recipient's* job icon "so which weapon dropped is unambiguous",
but those two clauses contradict each other: `weaponJob` is stored per entry (`types/index.ts:1249` —
"DRG, WHM, etc. for weapon slots") **precisely because it can differ from the recipient's job**. When
a WHM picks up a Dragoon weapon for an alt job, only `weaponJob` answers the question the input was
asking. v1 already renders the right one (`:590`); the recipient's is separately at `:606`.

**Write-back owed:** the standing input in §0 item 3, and any matrix row quoting it.

### R-39 · History rows carry **R-8's generic slot icon**

A monochrome generic slot glyph leads the Slot cell, alongside the material dot for material rows and
`weaponJob` for weapons.

*Why:* R-8 mandates the icon "wherever a logged entry renders (Log + History too)", and v1's Slot cell
has none (`:582-593`), so without this ruling the icon rule would silently become Log-only. On a long
table it also makes the column scannable by shape rather than by reading.

**Build note (D9a, 2026-09-18) — R-38 / R-39 shipped.** The Slot cell's anatomy, in one line each
(`LootHistoryTable.tsx`'s `lootSlotLeadIns` + `CELL.slot`): a loot row leads with `GearSlotIcon` (R-39,
known slots only) then — on weapon rows only — `weaponJob`'s `JobIcon` (R-38; gated on the slot, not
on the field's presence, because the loot edit API keeps a non-null `weapon_job` when an entry's slot
is changed away from weapon — a Body row could otherwise carry a stale job icon) then `slotNameOf`; a material row
carries `MATERIAL_DOT`, not a slot glyph, then `slotNameOf`. The recipient's own `JobIcon` renders
separately in the Player cell, never in Slot.

### R-34 · What History keeps, loses, and still owns

| | |
|---|---|
| **Loses** | The books card (R-14) and the bulk reset menu (R-16) — both move to Log |
| **Keeps** | Per-entry edit/delete (materials included, per R-32), the `?entry=`/`?entryType=` deep-link highlight (`LootHistoryTable.tsx:81-103`), and v2's `aug {slotAugmented}` readout (`LootEntryRow.tsx:128-132`) — see below |
| **Restores** | The stats count and the **filtered-vs-empty** distinction — "No entries match your filters" vs "No loot or materials logged this tier" (`AllWeeksView.tsx:530-537`); v2 has one message for both (`LootHistoryTable.tsx:110-116`) |
| **Receives** | Past-week gear-slot jumps, per R-28's split |

**The material's augmented slot must survive the flattening.** v2 shows it as a tag
(`LootEntryRow.tsx:128-132`, falling back to `tome wpn`); v1's table renders nothing for materials in
the Type column (`:626` gates on `row.type === 'loot'`), leaving `slotAugmented` alive only as an
`Alt+Click` target (`:322`). Restoring v1's table verbatim would make *"which slot did that twine go
into?"* unanswerable in History — it lands in the Type column, which is otherwise empty on those rows.

**The stats breakdown needs a new condition.** v1 shows the `(X gear, Y material)` split only when
`entryType === 'all'` (`:508`) — a state R-30 deletes. It shows whenever both kinds are present in the
filtered set.

**History renders no fairness block.** R-40 homes `FairnessSummary` on static Home, so the provisional
wording this row carried is resolved: R-23 put the per-week read in Log, R-40 puts the whole-tier read
on Home, and History — whose identity is *find* — carries neither. `Loot.tsx:397` is its only mount
today and that mount goes away.

**Build note (D9a, 2026-09-18) — partial.** The aug readout survived the flattening in D9a per
**R-D9a-A**: it lands in the Type column (`LootHistoryTable.tsx`'s `CELL.type` material branch,
`` `aug ${augSlotLabel(...)}` ``), with `tome_weapon` (and `null`) now reading `tome wpn` rather than
the enum value (D9a-t). The stats count and the filtered-vs-empty split are **not** built this
slice — D9b. **The Keeps/Restores rows above cite pre-rewrite line numbers; they now resolve to:**
`LootEntryRow.tsx:128-132` → `3f90d420:frontend/src/components/loot/LootEntryRow.tsx:132-136`;
`3f90d420:…/LootHistoryTable.tsx:81-103` (the pre-rewrite `?entry=` effect) → the effect of the same
name in today's `LootHistoryTable.tsx`, now keyed on `historyRowDomId`;
`3f90d420:…/LootHistoryTable.tsx:110-116` (the pre-rewrite early-return empty `<p>`) → the single
empty `<tr>` (`colSpan={COLUMNS.length + 1}`) inside today's `<tbody>`. Both left-hand citations are
`3f90d420` line numbers, not current ones — cite the symbols above, which do not rot.

**Build note (D9b, 2026-09-21) — the Restores row is now built. R-34 is NOT complete.** Only one
of its four rows lands here; the rest are still owed, and are listed so a reader scanning for
remaining Phase-D work does not tick this ruling off:

| R-34 row | State |
|---|---|
| **Loses** (books card + bulk reset menu → Log) | ✅ D7a/D7b |
| **Restores** (stats count + filtered-vs-empty) | ✅ **D9b, below** |
| **Keeps** — the `?entry=` highlight and the `aug {slot}` readout | ✅ D9a/D9b |
| **Keeps** — per-entry edit/delete **"materials included, per R-32"** | ✅ **complete (D11)**: a material row's Edit — from the kebab, the row right-click, or a plain row click — opens D8's `QuickLogMaterialModal` through the same `materialState.mode === 'edit'` door the Log grid uses. One mount, a second caller; D8's §5 mount obligations were discharged in D5 for that mount, so they are inherited satisfied. The `kind === 'loot'` gate is gone |
| **Receives** (past-week gear-slot jumps, R-28's split) | ❌ **D12** |
| **"History renders no fairness block"** | ❌ **D14** — `FairnessSummary` is still mounted in the History branch (`Loot.tsx`, and that file's own header comment says it stays until D14) |

What D9b itself builds:
- **Stats count.** `{n} entries`, plus `({X} gear, {Y} material)` gated on both kinds being present
  in the **filtered** set — the new condition this row called for, replacing v1's `entryType ===
  'all'` gate (`AllWeeksView.tsx:508`) for a state R-30/D10 deletes. It sits **inside the table card,
  above `<thead>`** (R-D9b-C, user ruling) as a `role="status"` line, so a filter change announces;
  §6's sketch placed it a level out, in the toolbar stack, but the count belongs with the table it
  describes and D14's removal of `FairnessSummary` would otherwise re-flow it.
- **Filtered-vs-empty.** v1's two **strings** are restored byte-for-byte
  (`AllWeeksView.tsx:534-535`): `No entries match your filters.` when the tier holds entries the
  filter excludes, `No loot or materials logged this tier.` when it holds none. D9a's single message
  (`No entries match — log a drop from the Priority view.`) is gone; its hint had also gone stale,
  since logging is a Log-toolbar action now, not a Priority-view one.
  ⚠ **A third zero-row state was added in review (D9b M1).** "No loot or materials logged this
  tier." is a claim about the *tier*, and empty arrays do not support it while the fetch is still in
  flight — nor during a tier switch, where the store holds the previous tier's rows. The table now
  takes `logsLoading` (`loadingStates.lootLog || .materialLog`) and shows `Loading entries…` instead
  of asserting. **A fourth state followed in review:** the store clears its loading flags on the
  ERROR path too, so a failed load left the same empty arrays with `logsLoading` false — the identical
  falsehood through a different door. `logsFailed` (tier-scoped local state in `Loot.tsx`, deliberately
  not the store's single shared `error` field) renders `Couldn't load this tier's entries.` The stats
  count is gated the same way and goes blank rather than reporting `0 entries`, which in a live region
  would otherwise be announced. The store's flags initialise `false`, so a single pre-effect frame is still
  unguarded; that is the same one-frame window D9a had, and it is the request duration — the part a
  user actually sees — that this closes. Rows keep rendering while loading; only the claim is
  withheld.
  ⚠ **The CONDITION is deliberately not v1's.** v1 branches on *filter-activeness*
  (`debouncedQuery || entryType !== 'all' || activeFloors.size < 4`); v2 branches on
  *log-emptiness* — the **raw** `lootLog`/`materialLog` props, not `rows`. They differ in exactly one
  state: an **empty tier with a filter set**, where v1 says "No entries match your filters" and v2
  says "No loot or materials logged this tier." v2's is the truthful one there — no filter change
  could produce a row — and R-34 rules the strings, not the predicate. Recorded because "restored
  verbatim" is true of the copy and false of the logic.
- **The `?entry=` highlight still resolves against the unfiltered logs**, as this row requires, and
  that is now pinned by a test: an entry excluded by the active filter still arms the effect and
  still self-clears the param, with a paired control proving an id absent from the raw logs does
  **not**. Mutation-checked — re-pointing the lookup at the filtered set kills exactly that test.

### R-35 · Shortcuts: `Ctrl+Shift+F` stays, `Alt+1/2/3` does not

The search focus shortcut is restored. Legacy's `Alt+1/2/3` is **dropped**.

*Why:* those keys are overloaded onto the old four-sub-tab axis — they call
`setGearSubTab('priority'|'history'|'stats')` *and* dispatch an entry-type change
(`useGroupViewKeyboardShortcuts.ts:144-163`). D-33 and D-43 dissolved that axis, so the binding has no
coherent meaning left — and unlike `Alt+←/→` and `Alt+B` (R-42), there is no surviving action to rebind
them to. Note the drop costs current users nothing either way: these bindings are registered only under
`legacyLootSurface` (`:139`), so they are **not live in v2 today**.

**Implementation note, not a ruling:** `Ctrl+Shift+F` cannot be restored the way v1 implements it — a
bare component-local `document` listener with no guard (`AllWeeksView.tsx:111-120`), on a screen that
mounts `RecipientPicker` and `LogWeekWizard` above it. It needs a focus/modal guard, and it needs
registering in `ui/keyboardShortcutGroups.ts` (which lists only `Ctrl+Shift+S` today, `:28`) or it will
never appear in the `Shift+?` help.

**Build note (D11, 2026-09-22) — R-31, R-32 and R-35 are built.** Nine points the ruling text left
open, settled in the slice (full reasoning in `plans/2026-09-22-phase-d11-row-affordances.md` §2,
R-D11-A…N):

1. **Row interactivity is permission-shaped.** `tabIndex`/`role="button"`/`aria-label`/`onKeyDown`
   only when `canEdit`; Shift and Alt stay live for **everyone**, which is R-31 q1's own premise —
   "pointer only when `canEdit`, plus R-18's Alt-held swap" is vacuous otherwise, because an
   editor's row is already `cursor-pointer`. **Named delta against V1:** a V1 viewer *can* focus a
   row and press `Shift+Enter`/`Alt+Enter` today (`AllWeeksView.tsx:311-325` runs both **before**
   the `canEdit` gate at `:326`). D11 does not carry that row-level **gesture**; every **capability**
   survives on the kebab, which R-32 already calls the keyboard and AT route. Affordance parity with
   a mapped home, not a silent drop.
2. **This diverges from the Log grid on purpose.** D6-l ruled v2's read-only grid cells inert while
   History's rows stay modifier-live for viewers. Two rulings own the two surfaces; recorded because
   it qualifies "one mental model across both surfaces".
3. **The cursor gate is `canEdit || (altHeld && canJump)`**, one `useAltHeld()` per table.
4. **Text stays selectable**, and a plain click that *completes* a drag-select is treated as a
   selection rather than an activation — **pointer path only**. Enter cannot complete a drag, and
   gating the keyboard on a stale selection elsewhere on the page would be q1's mismatch again.
5. **`role="button"` costs the `<tr>` its `row` semantics** (mitigated by an `aria-label` carrying
   the whole row, V1's `:553` shape), and the kebab `<button>` then sits inside it, which ARIA marks
   presentational. The row's `onKeyDown` ignores keydowns whose target is not the row itself, so the
   kebab's Enter never doubles as a row activation.
6. **The menu is one item list behind two triggers**, per D9a-k: kebab (own rect, `stopPropagation`)
   and row right-click (`jumpMenuAnchor`, so Shift+F10 lands on the row). It keeps the family's
   separator before Delete, which R-32's item list does not draw but `LogWeekGrid.tsx:738-739` and
   V1's own menu (`AllWeeksView.tsx:392-393`) both do. **Interim:** `ui/ContextMenu` has no
   focus-restore-on-close, no `aria-expanded`, and closes on any captured scroll — R-D7b's three,
   now multiplied by row count. Standing queue.
7. **"View week N in Log" carries the entry** (`lview=log` + `entry` + `entryType`), not just the
   week, and writes **no `?week=`** — `useLogWeek` reads that param on mount only and `Loot` does not
   remount on an `lview` change, so it would be inert; and calling `logWeek.setWeek` instead would be
   a second `setSearchParams` in one handler, which react-router's snapshot-bound functional updater
   would clobber. D6a's out-of-week correction runs in a later tick, which is why it composes.
   **Disclosed residual:** the F2 provisional-clock guard can swallow the jump on a genuine week-1
   tier displaying a stale unclamped week — no pulse, no self-clear until the user returns to
   History. Not narrowed here; that guard prevents a worse clobber.
8. **`Ctrl+Shift+F` is registered v2-locally** through the shared `useKeyboardShortcuts` hook —
   importing it is not editing it — so the hook every V1 screen runs is untouched. Three gates: the
   hook's own input-focus guard, a modal guard fed by Loot's modal state, and `lview === 'history'`
   checked *inside* the action so registration stays stable. The hook `preventDefault`s on any match,
   so the chord is swallowed on Priority and Log too, where it no-ops.
9. **The registry entry keeps V1's help byte-identical.** `SHORTCUT_GROUPS` is unchanged; a new
   additive `V2_SHORTCUT_GROUPS` reaches the help through an optional `extraGroups` prop that only
   `Layout.tsx`'s **v2** mount passes (the file already mounts the modal once per shell). The seam is
   append-only, so it cannot express §5's D14 default ("V1's rows stay, v2's reflect the new set") —
   **D14 decides whether to generalise or replace it**. Until then v2's help is a mixed-truth list:
   `Alt+1-3`, `V` and `G` still render there and R-35/R-42 dropped all three for v2. D11 does not
   make that worse, but it does add one authoritative row beside them.

---

## 6. History — the shape after R-29…R-39

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Loot                                                Adjustments · Rules │
│  ┌──────────────────────────┐                                            │
│  │ Priority │ Log │ History │                                            │
│  └──────────────────────────┘                                            │
│  ⌕ player:alice floor:m9s,m10s source:tome                    ✕  (^⇧F)   │
│  [All][Gear][Mats]  Floor:[▪M9S][▪M10S][M11S][M12S]   └ R-36 alternation │
│  Player:[▪Alice][Bob][Cara]…              R-30 · pills write tokens ↑    │
│                                                    12 entries (9 gear)   │
├──────────────────────────────────────────────────────────────────────────┤
│ Week ▾│ Floor │ Slot        │ Player     │ Method │ Date    │ Type │  ⋮  │
│ ──── Week 3 · Jul 22–29 · 4 entries · current ───────── R-29 ─────────── │
│  W3   │ M12S  │ ⚔DRG Weapon │ ◆Erin      │ Drop   │ Jul 24  │ BiS  │  ⋮  │
│  W3   │ M11S  │ ▭   Chest   │ ◆Dan       │ Drop   │ Jul 24  │ Extra│  ⋮  │
│ ──── Week 2 · Jul 15–22 · 6 entries ─────────────────────────────────────│
│  W2   │ M10S  │ ◇   Hands   │ ◆Cara      │ Book   │ Jul 17  │ BiS  │  ⋮  │
│  W2   │ M10S  │ ●   Glaze   │ ◆Dan       │ Drop   │ Jul 17  │ aug legs│⋮ │
│       └ R-33   └ R-39 slot icon        R-38 weapon's job ↑    └ R-34     │
│  click: edit · Shift: link · Alt: jump · ⋮ / right-click: all of it      │
└──────────────────────────────────────────────────────────────────────────┘
```

**Director verdict (2026-07-28): PARITY-GAP — approve with required changes.** All twenty-one required
changes are folded in; the four that were design forks rather than corrections were ruled by the user
as R-36 (comma alternation + `source:`), R-37 (session-local query), R-38 (the weapon's job icon) and
R-39 (the generic slot icon). ⚠ **Same scope caveat as §4** — reconstructed charter, no shared-layer,
design-system or vocabulary lens; §7a supplied them.

**Write-backs**, per §4's policy: **D-31**'s "stats footer"→header ✅ *applied* · **D-72** (the clear
button, named in the row and now in R-30) and **D-37** (material edit reaches History too, R-32) are
ruling-driven and land with the build.

## 7. Elsewhere — rulings

The two units the flow map and the matrix left homed nowhere.

### R-40 · The tier-wide fairness read moves to **static Home**, beside Team Summary (D-42/D-43)

`FairnessSummary` leaves History and lands on Home as its own module, next to the Team Summary that
F-08 already put there.

*Why:* fairness is a whole-tier "how is this static doing" question, which is the scope Home exists to
answer and precisely the scope F-08 assigned it. That gives one fairness read per scope and no
duplication — **the week** is answered by Log's count bar and legend (R-23), **the tier** by this
module, and **a specific entry** by History's table, which now carries no aggregate at all.

Note this is a *move*, not a restore: `FairnessSummary` is a v2-era artifact (`FairnessSummary.tsx:2`,
F6d spec §5.5) with no v1 ancestor — D-42's row calls it "a *different, much smaller* artifact" than
the Team Summary being restored. Its rollup (`computeTierFairness`) is unchanged by the move.

### R-41 · The Split Planner is reached from the **Progress tab** — closes F-04

Split Clears become a Progress-tab surface alongside Goals, Farms and Collections. Home's F-11
attention row links to it there; Roster gets no second entry.

*Why:* split clears are Ring-3 alt progression, which is the class of thing F-03 made Progress the
owner of when it ruled Progress a 5th Spine tab. The Roster candidate on record reads well — the
planner does arrange people — but Roster is a Ring-0 weekly surface and a split is an occasional
objective; putting an occasional Ring-3 action on a weekly Ring-0 tab is the mismatch F-04 was
deferred to avoid. One home, one entry, plus the attention row that already exists.

**This closes the flow map's last open decision point** — F-01…F-12 are now all ruled. ✅ Written back
to `systems-flow-map.md` (F-04, the Split Planner rows, the header count, and a sweep of the stale
`⏳` markers the header change would otherwise have contradicted) on 2026-07-28.

⚠ **The home does not exist yet.** v2's spine is Home/Roster/Loot/Schedule (`NewShell.tsx:38,72,88,106`)
— F-03's Progress tab is unbuilt. Split Clears is live in V1 (`GroupViewContent.tsx:43`) and **already
unreachable in v2** (`MorePage.tsx:172-186` renders for the legacy shell only), so R-41 causes no
regression, but it is not a re-homing the parity ledger can mark done until Progress ships. F-12's
More-page deletion inherits the same dependency.

---

### R-42 · The D-54 shortcut set is restored **wherever its surface survived**

D-54 rules the whole loot/history shortcut set `RESTORE (IN PHASE D)`. The rule for how far that
reaches:

| Binding | Ruling | Reason |
|---|---|---|
| `Alt+L` log a drop · `Alt+U` log material | **Restored** (R-20) | The action exists; `Alt+M` was never the material binding — see R-20 |
| `Ctrl+Shift+F` focus search | **Restored** (R-35) | With a modal/focus guard and a registry entry |
| `Alt+←` / `Alt+→` week stepping | **Restored**, rebound to Log | The action survives as R-22's chevrons |
| `Alt+B` mark floor cleared | **Restored**, rebound to Log's books card | The action survives as R-14's card button |
| `Alt+P` Settings ▸ Priority | Already live in v2 | No work |
| `Alt+1/2/3` sub-tab + entry type | **Dropped** (R-35) | The four-sub-tab axis is dissolved (D-33/D-43) |
| `v` expand-all · `g` grid/list | **Dropped** | List view and the layout axis no longer exist (D-32/D-33) |

*Why this is the rule and not a case-by-case list:* D-54's own wording allows that "bindings may shift
where surfaces changed", which is latitude to **rebind** — not licence to drop a shortcut whose action
is still there. Splitting on "did the surface survive?" makes every row above fall out of one test, and
makes the three drops defensible as *impossible* rather than merely unbuilt.

**Write-back owed to D-54:** its restore is satisfied for five bindings, narrowed for three, and the
narrowing is surface-death in every case. The nine `log:*` event listeners it also names are an
implementation detail of the legacy event bus — the v2 surfaces own their state directly, so they do
not return as such.

---

## 7a. Shared-layer discipline — rulings

Phase D was designed one surface at a time, which made it easy to miss that several rulings mutate
code the **legacy shell renders**. V1 is the default shell and is frozen; these three rulings decide
what that means here.

### R-43 · Which Phase-D rulings reach V1, and what each must do

| Ruling | Component | Reaches V1? | Requirement |
|---|---|---|---|
| **R-26** | `QuickLogMaterialModal` | **YES** — `LootPriorityPanel.tsx:28,770` ← `GroupViewContent.tsx:38,1017` (legacy body) | Every new input is **optional and off by default**, so the legacy call site (fixed `floor`/`material` from `LootPriorityPanel.tsx:764-767`) renders byte-identically. Phase-C two-part assert: v2 renders the new form, V1's render is unchanged |
| **R-16** | `ui/ResetConfirmModal` | **YES** — `LootLogModals.tsx:20,254` | Fix `getResetDescription`; see R-44 |
| **R-29** | `admin/SortableHeader` | **YES** — `AllWeeksView.tsx:13,520-526` (7 headers) + ~20 admin headers | Do **not** touch it; see R-46 |
| **R-30/R-36** | the search parser | **YES** if edited in place — it lives at `AllWeeksView.tsx:214-268`, inside frozen `history/` | v2 ships **its own** parser modelled on that one. `type:` values, comma alternation and `source:` change what a query returns, so editing V1's would silently change legacy search |
| **R-12 / R-24** | `RecipientPicker` | No — sole importer `Loot.tsx:64`, mounted only by `NewShell.tsx:13`. V1 uses `history/AddLootEntryModal` | — |
| **R-18 / R-28** | `RosterGearTable` | No — reached only via `RosterCard`→`RosterCards`→`Roster`→`NewShell.tsx:12`. V1's gear table is `player/GearTable.tsx` | — |
| **R-15** | `scopedWeekOverride` | No — declared inside the v2 screen (`Loot.tsx:170`) | — |
| **R-20** | `LogWeekWizard` | Shared, but already takes a week (`LogWeekWizard/index.tsx:48-57`) | Call-site prop only — change no default |
| **R-8 / R-9 / R-11** | `WhoNeedsItMatrix` | **YES, and V1-*only* today** — `LootPriorityPanel.tsx:29,715` ← `GroupViewContent.tsx:38,1017`. v2's `Loot.tsx` renders `FloorCard` (`:62,432`) and **no matrix at all** | See R-48 |

### R-48 · v2's Matrix is **its own component**; legacy's keeps its literal 8

R-1 makes the Matrix v2's landing view, but the component that exists — `WhoNeedsItMatrix` — is
reached only through the **legacy** shell. So R-8, R-9 and R-11 describe **v2's** matrix, which is
net-new. `WhoNeedsItMatrix` stays frozen: legacy keeps `{count}/8`.

*Why:* this is §7a's Log ruling applied one component further. R-11 as written would otherwise have
been a **V1-only** visible change — `3/7` where a legacy user reads `3/8` — in a file v2 never renders,
which is the inverse of what it was for. It also doesn't earn R-44's delta treatment: `3/8` is
defensible (a full party *is* eight), so unlike the "Week undefined" string there is no V1 defect to
fix. And gating the denominator on a shell flag inside the frozen file is the shell-aware branching
the freeze exists to prevent.

**R-11's ruling is unchanged** — v2 prints the roster size — it is only scoped here.

**Ownership, stated once:** v2's Log **builds its own** grid, count bar and revert modal.
`history/WeeklyLootGrid.tsx`, `history/LootCountBar.tsx` and `history/RevertWeekConfirmModal.tsx` are
**read-only reference**. The project's invariant is *don't edit* `history/`, not *don't import* it —
`BookLedgerCard.tsx:21-23` already imports three legacy modals unmodified, which is fine. **R-26's
rationale is corrected accordingly:** the argument for growing `QuickLogMaterialModal` is
`PRODUCT_MODEL.md:201` (one owned component per task), not a false claim that importing legacy is
forbidden.

⚠ **Renamed 2026-08-21 by R-P1.** Every "Matrix" in this ruling, including its own title, is this
ruling's shorthand for the view this phase built; the user-facing name is now **Who Needs It** (label
and persisted value both — see R-1's amendment). The **component identifier is unchanged**: v2's file
is still `NeedMatrix.tsx`, distinct from legacy's frozen `WhoNeedsItMatrix.tsx` — so "v2's Matrix is
its own component" remains true of the code even though the UI no longer calls it that.

⚠ **Amended 2026-08-21 by R-P2.** `NeedMatrix.tsx`'s gear cells now draw their visual treatment — the
role-coloured ring, tint fill and inner dot — from **`WhoNeedsItMatrix.tsx:379-405`**, replacing the
interim `NeedDot`/`EmptyDot` rendering. This is the same **reference-not-dependency** relationship
this ruling already establishes for Log's `WeeklyLootGrid`/`LootCountBar`/`RevertWeekConfirmModal`:
`WhoNeedsItMatrix` stays frozen and unimported; `NeedMatrix.tsx` re-expresses its look in v2-owned
code. Controller ruling R-V1 is explicit that the rendering reference is V1's `WhoNeedsItMatrix`, not
the `GearStatusCircle` component. **The material progress rings are unaffected** — R-50's fourth D3
build ruling already governs those and stands as written.

### R-44 · `getResetDescription`'s week bug is fixed — an approved **V1-visible delta**

`ResetConfirmModal.tsx:48-50` returns `` `${playerName}'s book entries for Week ${week}` `` with no
guard, and the floor branch (`:56-61`) does the same. V1 already emits week-less configs for exactly
the all-time cases D-39 restores (`SectionedLogView.tsx:410-423`, `:433-441`), so **a V1 user typing
RESET today reads "for Week undefined"** — and the floor/all-time case falls through to "ALL book
balances for this tier" (`:66-68`), which *mis-states the blast radius of a destructive action*.

*Why this is worth a delta:* the freeze protects V1's behaviour from redesign churn, not from
correctness fixes. The precedent is Danger-Zone-in-Settings (F-12), approved as an explicit V1-visible
delta because it fixed a real V1 defect. Recorded here so the change is *expected* in V1's copy rather
than discovered as drift.

### R-45 · Floor colour becomes **semantic tokens** (`--color-floor-1…4`)

Every floor-coloured element in this phase — R-2's pills, R-8's names, R-9, R-19's header accent,
R-33's Floor chip — reads `var(--color-floor-N)`. `FLOOR_COLORS[n].hex` is **never** used.

*Why:* the phase makes floor colour pervasive, and the existing source doesn't survive that scale.
`loot-tables.ts:69-74` exposes `hex: '#22c55e'` / `'#3b82f6'` — literal entries in the design-system
checker's violation table, so a build following R-8 the way v1 built its chip fails CI. Its
`bg`/`text`/`border` fields are raw Tailwind palette utilities (`text-green-400`, `bg-blue-500/10`),
not semantic tokens, so calling them "class tokens" overstated them. And R-8 puts floor colour on
**gear names** — body text at scale — on a project that has already recorded an oklab contrast
blindspot; tokens mean the contrast is measured once, centrally, instead of per call site.

**Additive and freeze-safe:** V1 keeps using `FLOOR_COLORS` exactly as it does today. New tokens in
`index.css`, consumed by v2 only.

### R-46 · v2 owns its **sortable header**; `admin/SortableHeader` is untouched

A new keyboard-first `ui/SortableHeader` (a real `<button>` inside the `<th>`, `aria-sort`, key
handling) serves v2's History. `components/admin/SortableHeader.tsx` keeps its current behaviour.

*Why:* R-29 makes sorting absorb both the chronological axis (D-32) and the layout axis (D-33), so it
must be keyboard-operable — but the existing component is rendered by **V1's** All Weeks table
(`AllWeeksView.tsx:13,520-526`), and adding tabbable elements changes V1's tab order and focus rings
on a frozen shell. Two components until admin chooses to migrate is the cheaper trade. This also
retires R-29's suggestion of *relocating* `admin/SortableHeader`, which would have forced an edit to
the frozen `AllWeeksView.tsx:13` import — the thing the freeze exists to prevent.

**Build note (D9a, 2026-09-18) — the v2 consumer exists.** `LootHistoryTable.tsx` imports and mounts
`ui/SortableHeader` for all seven sortable columns. `components/admin/SortableHeader` and
`components/admin/sortUtils` are untouched and unimported by it — asserted by
`git diff --stat origin/main...HEAD -- frontend/src/components/admin/` printing nothing (PR #262 body).

## 8. Open — what is left

**Phase D's design is complete.** Priority R-1…R-12 + R-49 (D1 build-time) · Log R-13…R-28 · History R-29…R-39 ·
Elsewhere R-40…R-42 · cross-cutting R-47 · shared-layer R-43…R-46, R-48.

**Reviewed, with the scope of each pass on record.** Two per-surface director passes (§4, §6) ran
against a reconstructed charter and could not see the shared layer, the design system or the
vocabulary; the whole-record pass on 2026-07-29 supplied those and returned **SHARED-DRIFT**, which
§7a resolves. "Design complete" means the rulings are made — not that anything is demonstrated.

- **Mobile** (D-44) stays deferred to the Phase-P pass, per the standing ruling that mobile gets one
  consolidated walkthrough rather than per-slice affordances.
- **Implementation** is unplanned. Much of this phase is net-new rather than re-homed — Log does not
  exist at all, and R-16, R-21, R-26, R-28 and R-32 each name work rather than a move — so the build
  wants its own slicing pass against the ~1,500-line PR budget.

---

## 9. Carried in from the Phase-C closeout

**`roster-hide-subs` — RULED 2026-07-28: namespace it v2-side.** The key is currently shared by both
shells (`Roster.tsx:143,147` / `GroupViewContent.tsx:534,538`), so "Show subs" bleeds between v1 and
v2. It becomes `v2-roster-hide-subs`, **reading legacy's key as a fallback for continuity but
writing v2-only** — the same shape as `useRosterSortPreset` (C6), whose identical defect the director
caught. Closes the closeout's last open DoD item. Small severable micro-slice; not part of a Phase-D
surface.
