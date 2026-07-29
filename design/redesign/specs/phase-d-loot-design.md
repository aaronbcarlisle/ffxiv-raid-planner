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

### R-21 · Material entries become **editable** (D-37)

A filled material cell opens the material modal in edit mode with old-vs-new augmentation
reconciliation.

**Implementation note, not a ruling:** net-new, not a re-home — `QuickLogMaterialModal`'s props
(`:27-39`) carry no `editEntry`, and it has no notes field either, which an edit round-trip needs.

### R-22 · Week control (D-40 + D-41)

`WeekScopeControl` gains **prev/next chevrons** and **go-to-current**, keeping Start-next-week and
Revert. Revert runs the pre-check and shows a **data-summary modal** listing the loot, materials and
books that will move.

**Correction to the D-40 row's reading:** the pill's *label* is only `This week (Week N)`
(`WeekScopeControl.tsx:52-53`); the date range and the loot/books/mats dots are on the dropdown
**items** (`:90-113`) and already exist.

**Explicitly dropped:** legacy's `Alt+←` / `Alt+→` week stepping and `Alt+B` (mark floor cleared)
(`useGroupViewKeyboardShortcuts.ts:166-175`, `:192-198`). The chevrons are ordinary buttons, so the
keyboard route to week stepping is Tab-reachable; the shortcuts are not restored.

### R-23 · The week's count bar **and its legend**

`LootCountBar` comes with the grid as a per-week fairness read, **with `LootFairnessLegend` directly
below it** (`WeeklyLootGrid.tsx:859-877`, rendered at `SectionedLogView.tsx:1143-1147`).

*Why the legend is not optional:* it is the only thing that decodes the bar's blue/grey/amber counts,
and D-30 lists it in the restore. It does not collide with R-19 — it explains the count bar, not cell
colour.

**Still open, and only this:** `FairnessSummary`'s own home. **Team Summary's home is *closed*** —
F-08 ruled it onto the static Home module (`systems-flow-map.md:218`, `:122`), which also closes D-43.

### R-24 · Assign mode gains **Method and Notes** (extends R-12)

The picker's assign body gains the method choice (drop / book / tome / purchase) and the notes field.

*Why:* both are gated on `mode !== 'assign'` today (`RecipientPicker.tsx:536`, `:584`) with
`method='drop'` hard-set (`:237`), so a cell click could not log a **book** acquisition at all —
legacy's empty-cell click opened `AddLootEntryModal` with the full choice (`SectionedLogView.tsx:889-894`).
R-17 removes the legacy modal, so the picker has to carry what it carried.

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

**Director verdict (2026-07-28): PARITY-GAP — approve with required changes.** All thirteen required
changes are folded in above; the four that were design forks rather than corrections were ruled by the
user as R-24 (method + notes), R-25 (floor kebab), R-26 (one material component) and R-27 (grid details).

**Write-backs owed when this ships**, per the Phase-C precedent that rulings and matrix rows land in
the same PR: **D-35** (its `Alt+M` is wrong — the binding is `Alt+U`) · **D-38** (books' placement =
R-14) · **D-39** (reset entry points = R-16) · **D-40** (the pill already carries the dots) · **D-43**
(closed by F-08, not open) — alongside D-23/D-27 already owed from R-3.

## 5. Open — the other surfaces

- **History**: the cross-week table as the model, structured search merged with v2's filter pills,
  the kebab's "Jump to {player}". Net change from Phase D so far: History **loses** the books card
  (R-14) and the reset menu (R-16), and keeps its per-entry kebab.
- **Elsewhere**: `FairnessSummary`'s home (R-23 — Team Summary's is closed by F-08), the Split
  Planner's entry (F-04).
- **Mobile** (D-44) stays deferred to the Phase-P pass.

---

## 6. Carried in from the Phase-C closeout

**`roster-hide-subs` — RULED 2026-07-28: namespace it v2-side.** The key is currently shared by both
shells (`Roster.tsx:143,147` / `GroupViewContent.tsx:534,538`), so "Show subs" bleeds between v1 and
v2. It becomes `v2-roster-hide-subs`, **reading legacy's key as a fallback for continuity but
writing v2-only** — the same shape as `useRosterSortPreset` (C6), whose identical defect the director
caught. Closes the closeout's last open DoD item. Small severable micro-slice; not part of a Phase-D
surface.
