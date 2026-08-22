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
falls through to this same landing default, like any other unrecognized string. Read every bare
"Matrix" in R-2, R-3, R-10's second point and R-48 below as this name. **Write-back owed:** those
four spots.

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
are unchanged — a selected floor still narrows those views the way this ruling always described.
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

### R-7 · **One Priority-level "Log floor"** that follows the pill (D-26)

A single **Log floor** button beside the pill row, scoped to whichever floor is selected, behaving identically in
all three views. When **All** is selected it steps aside for the toolbar's existing
**"Log this week's loot"** — the whole-week wizard already owns that case.

*Why:* the pills made "the current floor" a first-class property of the view, so the action belongs
to the view, not to a card. One button and one rule; and the Matrix — the landing view under R-1 —
can log a floor, which a card-header-only entry would have prevented. Resolves the D-26/D-30
coupling without creating the two entry points that note warned about.

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

### R-17 · One logging path — **loot cells** to the picker, **material cells** to the material modal

A loot cell opens `RecipientPicker`: empty → assign mode pre-filled floor + slot, filled → edit mode.
Legacy's `AddLootEntryModal` is **not** restored. Material cells route to the material modal (R-21/R-26)
in both create and edit.

*Why:* R-4 applied to a different geometry — the grid and the matrix become the same flow. The
material split is forced, not chosen: `DropItemContext.slot` is `GearSlot | 'ring'`
(`RecipientPicker.tsx:31-36`), so the picker cannot represent a material at all.

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

### R-27 · The grid details that come back

**Restored:** the per-cell modifier-teaching tooltip (`WeeklyLootGrid.tsx:653-680`, `:773-798`) — R-18
defines the modifiers and this is what teaches them, the same pairing C7 needed for R-076 · the
`Floor N · Book {I–IV}` header line (folded into R-19) · the recipient-badge hover inline-delete `×`
(`:402-433`), which keeps one-hover deletion alongside the kebab route.

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

1. The current-week marker is `WeekGroupHeader.tsx:34-36`; carry its token choice with it — `:30-33`
   documents `text-accent-hover` rather than `text-accent` as a *measured* AA-contrast decision.
2. **`SortableHeader` is not keyboard-operable and must be fixed before Log/History adopt it.**
   `admin/SortableHeader.tsx:35-39` is a raw `<th onClick>` — no `tabIndex`, no `role`, no key handler
   (it does set `aria-sort`, `:38`). R-29 makes sorting the mechanism that absorbs D-32's chronological
   axis *and* D-33's layout axis, so shipping it mouse-only would strand a keyboard user with neither.
   It also wants promoting out of `components/admin/` if a ring-0 loot surface imports it.
3. **Sort and filter state are session-local**, matching v1 (`AllWeeksView.tsx:97-102`, which persists
   nothing). If that is ever revisited, the key must be distinct — `v2-sort-preset-{tierId}` is already
   taken by the roster (`useRosterSortPreset.ts:43`).

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
(`historyItems.ts:54-64`) — `source:tome` is tome-or-purchase, which no combination of `method:`
tokens can express.

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

### R-37 · The filter query is **session-local**, and `copyLink` strips it

The query is not URL-backed. `copyLink` strips it from the link it builds, exactly as it already
strips `shell` (`Loot.tsx:252`).

*Why:* `Loot.tsx:39-43` documents the invariant being protected, in the code, as a deliberate decision:
filters are session-local *so that an `?entry=` deep-link can never be hidden by a filter on first
mount*. Making the query shareable would break it in a way that fails silently — `LootHistoryTable`
resolves the highlight against the **unfiltered** logs (`:72-77`) but renders only filtered rows
(`:107-108`), so a filtered-out target scrolls to nothing and then clears its own params 2.5 s later
(`:90-97`). The user sees the right screen and no highlight, with nothing to indicate why. A
non-shareable filter is the cheaper loss.

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

⚠ **Renamed 2026-08-21 by R-P1.** Every "Matrix" above, including this ruling's own title, is this
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
