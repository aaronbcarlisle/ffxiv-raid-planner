# Phase D — Loot rework (co-design record)

**Status: 🔴 IN CO-DESIGN, started 2026-07-28.** This document is the running record of the Phase-D
design conversation, written ruling-by-ruling as the user makes each call.

**Process (binding).** Phase D is **co-designed step by step with the user, not sliced
autonomously** — the standing ruling from 2026-07-26: *"a lot of work went into v1 based on user
feedback"*, and v2's loot surfaces regressed its usability. Nothing here is implemented until the
surface it belongs to is fully designed and the user says to build.

---

## 0. What Phase D covers

22 ruled matrix units plus two deferrals. Structure is already settled by the flow map and is **not**
in scope to re-open:

- **F-06** — Loot is a triad: **Priority · Log · History** (decide / record / find).
- **F-07** — the books ledger lives **inside Log**; balances stay readable from Team Summary.

| Area | Units |
|---|---|
| **Priority** | D-22 Who Needs It matrix · D-23 view axis · D-24 floor scoping · D-25 score transparency · D-26 "+ Log Floor" · D-27 weapon priority placement · D-28 RecipientPicker additions · D-29 candidate reasons/warnings/confidence |
| **Log** *(does not exist in v2)* | D-30 weekly grid · D-35 free-form material entry · D-37 material edit · D-38 books placement · D-39 per-floor + per-player book resets · D-40 week stepping · D-41 revert data-summary |
| **History** | D-31 cross-week table as the model · D-72 structured search · D-32 fold · D-33 layout axis dissolved · D-34 kebab + "Jump to {player}" |
| **Elsewhere** | D-42 Team Summary restore · D-43 its home (user leans Home/Overview) · F-04 Split Planner entry · D-44 mobile *(deferred to the Phase-P pass)* |

Standing design inputs from the user, carried into every surface here:

1. **Floor-selector isolation** beats one long scroll (applies to Priority *and* History).
2. **Who Needs It is a headline feature**, not an afterthought — it earned real user feedback.
3. **Entry icon/colour polish:** floor-derived colours; colourise the gear *name* on entries;
   generic gear-slot icons instead of coloured letter squares; **exception** — a logged *weapon*
   entry shows the recipient's **job icon**, so which weapon dropped is unambiguous.
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

### R-7 · **One Priority-level "+ Log Floor"** that follows the pill (D-26)

A single button beside the pill row, scoped to whichever floor is selected, behaving identically in
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
logged **weapon** entry shows the **recipient's job icon**, so which weapon dropped is unambiguous.

### R-9 · The Matrix **keeps** the floor-coloured names (refines R-8)

Drawing R-8 exposed something the prose hadn't: the Matrix lists every slot at once, so its name
column runs green → blue → purple → amber down its length, where a Queues card shows exactly one
colour. **Kept anyway.** The colour answers "which floor drops this?" with no lookup — the planning
question the Matrix exists for — and because the slots already sit in floor order it reads as bands
rather than confetti.

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

### R-11 · The Need column counts **the roster**, not a full party

`3/8` on a seven-player static is v1's own behaviour — `WhoNeedsItMatrix.tsx:419` and `:547` print a
**literal 8** while `count` comes from the players actually rendered. v2 prints the roster size:
`3/7` for seven players, `3/8` once the eighth seat is filled.

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
│  Floor: [All] [M9S] [M10S] [M11S] [M12S]         [+ Log Floor]         │
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

## 3. Open — the other surfaces (Priority is closed)

- **Log** (does not exist in v2): the weekly grid's shape, books' placement inside it, free-form
  material entry, material editing, week stepping, revert data-summary.
- **History**: the cross-week table as the model, structured search merged with v2's filter pills,
  the kebab's "Jump to {player}".
- **Elsewhere**: Team Summary's restore + home, the Split Planner's entry (F-04).

---

## 3. Carried in from the Phase-C closeout

**`roster-hide-subs` — RULED 2026-07-28: namespace it v2-side.** The key is currently shared by both
shells (`Roster.tsx:143,147` / `GroupViewContent.tsx:534,538`), so "Show subs" bleeds between v1 and
v2. It becomes `v2-roster-hide-subs`, **reading legacy's key as a fallback for continuity but
writing v2-only** — the same shape as `useRosterSortPreset` (C6), whose identical defect the director
caught. Closes the closeout's last open DoD item. Small severable micro-slice; not part of a Phase-D
surface.
