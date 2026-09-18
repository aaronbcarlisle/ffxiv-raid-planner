# Phase D — Slice D9a: The v2 History Table — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Vet record:** `xivrp-director` plan-vet 2026-09-18 → **APPROVE-WITH-CHANGES** (0 blockers ·
6 major · 7 minor) — **all folded into this revision**: F-1 the sticky scrollport is
`GroupViewContent.tsx:711-713`, not `Layout.tsx:121` (legacy branch) + the `overflow-clip`
no-horizontal-scroll trade surfaced (D9a-n), F-2 the shared-file statement restated with complete
importer chains (`utils/historyItems.ts` named as the one `utils/` file, v2-only), F-3 the eight
in-repo comments naming the deleted files enumerated with per-file rulings + the `historyRowDomId`
one-author helper (D9a-q), F-4 traps (e)/(f) + executed traces for the kind/id tiebreak and the
R-D9a-A aug readout, F-5 the "what today's History loses" table (D9a-p) + the Date-column
timezone decision (D9a-o), F-6 `phase-d-loot-plan.md:195-196` rows added to Task 4, F-7 the
sr-only `Actions` header reconciled against the `LogWeekGrid.tsx:33-37` precedent + a
`<caption>`, F-8 the proven `GearSlotIcon.test.tsx:39-41` style-attr idiom + `GEAR_SLOT_ICONS`
constants, F-9 `methodLabelOf` one-authored + the `METHOD_INFO` typing shape pre-authorised,
F-10 typed floor→tone lookup + empty-floor `—` (D9a-r), F-11 D9a-e reversed (`HistoryItem` →
`logWeekGridData.ts`), F-12 the `CELL` render map (D9a-u) + sibling clone candidates named, F-13
DoD gains rendered-column monotonicity reads, a keyboard pass, the horizontal-clip check and the
`tome_weapon` cell; sizing recomputed honestly (≈1,850 before the plan document) and the PR opened
under the mega-PR protocol; eleven line anchors corrected.

**USER RULINGS (2026-09-18, all four on the recommendation):**
- **R-D9a-A · The D9a/D9b seam** — D9a renders the material's `slotAugmented` in the Type column
  (R-34's "must survive the flattening" binds the flattening itself, i.e. this slice). The week
  group header (date range · current-week marker · count) is absent for one slice; D9b re-expresses
  it as R-29's separator `<tr>`. `WeekGroupHeader.tsx` is **deleted** in D9a; its measured
  `text-accent-hover` note, its UTC-pinned range formatter and its `{n} drop(s)` copy are carried
  into the R-29 build note by git ref (Task 4) so D9b needs no archaeology.
- **R-D9a-B · Tiebreak is fixed newest-first** — ties resolve `createdAt` desc whatever the primary
  column or its direction (R-29's literal text). Identical timestamps fall through to `kind`
  (`loot` before `material`) then `id` desc, for determinism.
- **R-D9a-C · Per-column natural first direction** — Week/Date start `desc`; Floor/Slot/Player/
  Method/Type start `asc`; a second click on the active column flips. v2-local `nextHistorySort`;
  nothing imported from `admin/sortUtils`.
- **R-D9a-D · Flow with the page, `thead` sticky to the shell's scrollport** — no inner scroll
  region; the table lives in a bordered card using `overflow-clip` (NOT `overflow-hidden`, which
  would make the card the sticky containing block; NOT `overflow-x-auto`, same reason — see
  D9a-n). The nearest scrollport in v2 is **`GroupViewContent.tsx:711-713`**'s content div
  (`overflow-y-auto` because `preventPageScroll` is `!slots?.gear` → false in v2, `:706`), a
  height-bounded `flex-1` child of `AppChrome.tsx:238-242`'s `<main id="main-content" … min-h-0
  overflow-y-auto>` pane. (`Layout.tsx:121` is the **legacy** branch's pane — `Layout.tsx:72-103`
  returns the v2 chrome before reaching it.) CLAUDE.md's "no sticky/fixed content panels" targets
  panels; a table header is not one.

**Goal:** Replace v2 History's week-grouped card list (`LootHistoryTable` + `LootEntryRow` +
`WeekGroupHeader`) with v2's **own flat, sortable, eight-column table** on D0's keyboard-operable
`ui/SortableHeader` (R-46) — Week · Floor · Slot · Player · Method · Date · Type · ⋮ — with the
R-33 floor chip on tokens, the R-38 weapon-job icon in the Slot cell, the R-39 generic slot icon,
the material `aug {slot}` readout kept alive (R-34, R-D9a-A), the shipped `?entry=`/`?entryType=`
highlight preserved verbatim, and the shipped kebab (Edit / Copy link / Delete) as the eighth
column — re-expressing `history/AllWeeksView.tsx` (frozen reference, never transcribed) without
touching a line V1 renders.

**Architecture:** One pure sorter, one host component, one wiring change. The sort is a pure,
unit-testable function in `utils/historyItems.ts` (`sortHistoryItems(items, sort, ctx)` + the
`nextHistorySort` toggle rule) operating on the existing `HistoryItem` discriminated union via
per-field **key accessors** — structurally distinct from v1's flattened `UnifiedRow` +
`switch`-comparator (`AllWeeksView.tsx:274-291`), which is what keeps jscpd quiet. The host
`LootHistoryTable.tsx` is **rewritten in place**: it keeps its prop contract (minus the two
week-header props D9b re-adds), keeps the `?entry=` highlight effect (`:69-103`) and the row ids
`loot-entry-N` / `material-entry-N` it scrolls to — now composed by ONE author,
`historyRowDomId` (D9a-q), so `Loot.tsx`'s mount and every History test in `Loot.test.tsx` that
drives a row by id + `Entry actions` survive unchanged — and swaps its body for a `<table>` whose
`<tr>`s are **inert** (no click, no `tabIndex`; R-31 is D11's) with the kebab as the only control.
Column ⇄ sort key ⇄ cell renderer are one-authored: a `COLUMNS` header table and a `CELL` render
map in the host, a `KEY` accessor map in the util, sharing `slotNameOf` / `methodLabelOf`
(D9a-u). Sort state is session-local `useState` in the host (R-29 impl note 3). Cell anatomy uses
design-system primitives only: `Tag tone="floor-N"` (R-33/R-45), `GearSlotIcon` (R-39), `JobIcon`
(R-38 in Slot; recipient in Player), `Tag` for Type, the shipped Radix `Dropdown` kebab (D11
converts it to the two-trigger `ContextMenu` under R-32 — converting it here would be converting it
twice).

**Tech Stack:** React 19 + TypeScript, `ui/SortableHeader` (D0/R-46), `ui/Tag`, `ui/GearSlotIcon`,
`ui/JobIcon`, `primitives/Dropdown` + `primitives/IconButton` (kebab, unchanged from
`LootEntryRow.tsx:147-162`), Vitest + RTL.

**Spec:** `design/redesign/specs/phase-d-loot-design.md` — R-29 (:1080, table + tiebreak + impl
notes 1–3), R-33 (:1230), R-38 (:1244), R-39 (:1258), R-34 (:1267), §6 mockup (:1310-1333), R-45
(:1484, floor tokens), R-46 (:1500, v2's header, `admin/SortableHeader` untouched). Slice row:
`design/redesign/specs/phase-d-loot-plan.md` :195 (D9a), :196 (D9b — what this slice must NOT
absorb), dependency graph :163-175, §2.1 shared-layer inventory :63-93, §2.2 re-express rule
:94-106, sizing :266-267. Parity rows to rewrite with the build:
`design/redesign/specs/v1-v2-parity-matrix.md` D-31 (:256), D-32 (:258), D-33 (:259).
Predecessor record: `design/redesign/plans/2026-08-24-phase-d7-books-and-resets.md`.

---

## Global Constraints

- **V1 safety — this slice touches no file V1 renders.** Verified against main @ `3f90d420`:
  `Loot` is mounted only through `pages/NewShell.tsx:93` into `pages/GroupViewContent.tsx:977`'s
  `slots?.gear`, so no V1 render path reaches any edited file. Importer chains, **complete**:
  `LootHistoryTable.tsx` ← `Loot.tsx:171` + `LootHistoryTable.test.tsx:4` · `LootEntryRow.tsx` ←
  `LootHistoryTable.tsx:10`, `Loot.tsx:173` (type-only), `utils/historyItems.ts:12` (type-only),
  `LootEntryRow.test.tsx:3` · `WeekGroupHeader.tsx` ← `LootHistoryTable.tsx:11`,
  `LootEntryRow.test.tsx:4` · **`utils/historyItems.ts` is the ONE `utils/` file edited** —
  `utils/` sits on the shared-layer list, but this file is v2-only by importer: `Loot.tsx:198`,
  `LootHistoryTable.tsx:12`, `loot/HistoryFilters.tsx:12` (value import), `LootHistoryTable.test.tsx:5`,
  `utils/historyItems.test.ts` — all reached only via `NewShell.tsx:93 → GroupViewContent.tsx:977`
  · `loot/logWeekGridData.ts` (D9a-q/D9a-e) is v2-only (the Log grid's data module). **`history/`
  files are imported, never edited** — `history/lootMethodDisplay.ts`'s `METHOD_INFO` is read for
  its `label` only (its `textClass` carries `text-blue-400`, `:13`, a raw palette utility; never
  render it). `admin/SortableHeader.tsx` and `admin/sortUtils.ts` are **not imported** (R-46).
  `git diff --stat` over `frontend/src/components/history/`, `frontend/src/components/admin/` and
  `frontend/src/components/ui/` must be EMPTY in the final diff. The PR body carries the
  phase-DoD-3(b) statement **in this wording** (not "no shared file touched").
- **The D9a/D9b/D10/D11 boundary is binding.** D9a ships: the flat table, the 7 sortable headers +
  the kebab column, the fixed tiebreak, the per-column toggle rule, R-33/R-38/R-39 cells, the aug
  readout (R-D9a-A), the preserved highlight, the shipped kebab items, sticky `thead`. D9a does
  **not** ship: week separators / current-week marker (D9b), the stats count and the
  filtered-vs-empty split (D9b — the single empty message `No entries match — log a drop from the
  Priority view.` stays verbatim), the search box / pill dissolution (D10 — `HistoryFilters` +
  `filterHistoryItems` stay wired exactly as today), row click-to-edit / modifier clicks /
  `tabIndex` / `Ctrl+Shift+F` / right-click / "View week N in Log" / material Edit /
  `jumpMenuAnchor` (D11), gear-row anchors (D12). Do not pull any of these forward; do not drop
  anything listed as shipping.
- **The `?entry=` highlight is live v2 behaviour, not an interim.** Shipped C7 roster jumps
  (`RosterCard.tsx:281-297`) land on `lview=history&entry=N`. The effect at
  `LootHistoryTable.tsx:69-103` and its three tests (`LootHistoryTable.test.tsx:141-180`) carry
  over semantically intact: resolves against the **unfiltered** logs, `highlight-pulse` on the
  `<tr>`, `scrollIntoView` at 100 ms, `replace: true` param delete at 2.5 s. The element id the
  effect scrolls to and the id the row renders are **the same call** (`historyRowDomId`, D9a-q).
- **DOM contract preserved for `Loot.test.tsx`:** every row `<tr>` carries `id="loot-entry-{id}"`
  / `id="material-entry-{id}"`; the kebab trigger keeps `aria-label="Entry actions"`; the menu
  items keep the names `Edit` / `Copy link` / `Delete`. The seven `Loot.test.tsx` History kebab
  tests — `:777-788`, `:790-806`, `:808-831`, `:837-841`, `:855-859`, `:875-878`, `:1180-1184` —
  must pass **unchanged**; that is the assembly-level proof the rewrite is a drop-in. (Director-
  verified: they drive only `getElementById` → `within(row).getByRole('button', {name:'Entry
  actions'})` → `findByRole('menuitem', …)` and then assert on `Loot`'s own state.
  `Loot.test.tsx`'s own `?entry=` tests at `:1347-1460` drive the **Log** view's consumption
  effect, and `:2069`'s pulse is the Books jump — neither touches this table; History's `?entry=`
  behaviour is asserted only in `LootHistoryTable.test.tsx`, which is why its three deep-link
  tests must re-land with the same assertions.)
- **The comment sweep is part of the diff (director F-3).** Eight in-repo comments name the
  deleted files or line ranges this slice moves; each is handled where named in the file map —
  five inside `loot/` (fixed in Task 2/3), three outside (`roster/RosterCard.test.tsx:727`,
  `schedule/SessionList.test.tsx:53`, `utils/lootActivity.test.ts:10` — **comment-only edits,
  fixed in Task 3**, widening the diff by three one-line hunks with no behaviour). Leaving a
  rewrite that deletes two components with eight comments naming them is the doc–code drift class
  this branch exists to close.
- **Green-commit hook:** `.claude/hooks/pre_bash_guard.py` runs whole-project `tsc -b` on any
  commit with staged frontend TS. Task 2 deletes two components and moves a type alias — the
  deletions, the alias move and every import-path edit land in ONE commit.
- **Deletion-trace discipline:** implementers prove load-bearing assertions by EXECUTING the
  mutation (delete the branch/clause, run the test, paste the verbatim failure output, restore) —
  never by argument. The named traps for this slice: (a) a sort test whose fixture order already
  equals the expected order (seed rows **out of order** — newest week first in the array must NOT
  be the expected result under `week asc`); (b) a tiebreak test whose two rows differ in the
  primary key (then the tiebreak never runs — seed the SAME player / floor / slot and differ only
  in `createdAt`); (c) an R-38 test with `weaponJob === recipient.job` (then the wrong icon
  passes — seed a WHM recipient with a DRG weapon); (d) a floor-chip test that checks the text and
  not the token class; **(e)** the kind/id tiebreak fixture seeded loot-first and low-id-first
  (V8's sort is stable, so deleting the second and third tiebreak legs would leave the test green
  — seed **material first and the higher id first**); **(f)** the aug readout asserted only for
  the `slotAugmented` branch (assert BOTH `aug body` AND the `tome wpn` fallback so deleting the
  whole material branch of the Type cell cannot pass).
- **jscpd (blocking CI, `frontend/.jscpd.json`: threshold 5 %, minLines 5, minTokens 50, tests
  ignored, `components/history/` IS in scope; main = 4.02 % tokens):** the sorter, the header
  row and the cells are **re-expressions** of `AllWeeksView.tsx:274-291` (sort), `:520-527`
  (headers), `:563-635` (row). Same semantics, different structure: key accessors + one generic
  comparator instead of a `switch`; a `COLUMNS` table driving `SortableHeader`s instead of seven
  hand-written JSX lines; a `CELL` render map instead of a contiguous eight-`<td>` JSX block (the
  block the director named as the residual clone risk — D9a-u); `HistoryItem` union narrowing
  instead of a flattened `UnifiedRow` with `originalLoot`/`originalMaterial` back-pointers.
  **Never build a `UnifiedRow`.** Clone candidates are not only `AllWeeksView.tsx`: the
  icon-plus-name cell shapes already exist in `LogWeekGrid.tsx`, `NeedMatrix.tsx` and
  `BookLedgerCard.tsx` — `pnpm dupes` runs over all of `src`. Run it after Task 2 and before the
  PR; paste the number.
- **aria-hidden hazard (`index.css:239-240`):** `GearSlotIcon` renders an `aria-hidden`
  `inline-block` span whose explicit width/height the app-wide rule reverts to `inline` UNLESS a
  flex/grid ancestor blockifies it (F-4, `LogWeekGrid.tsx:39-48`). The material dot
  (`aria-hidden`, `h-2 w-2`) is subject to the same revert. Every Slot cell's content sits inside
  ONE `inline-flex items-center gap-1.5` wrapper span — the wrapper itself is NOT aria-hidden (it
  carries the announced name) — and `LootHistoryTable.test.tsx` carries BOTH sweep assertions
  from `LogWeekGrid.test.tsx:305-327`: (i) every `[aria-hidden="true"]` inside a Slot cell has a
  parent whose className contains `inline-flex`; (ii) every `[aria-hidden="true"]` element whose
  own className matches `/\b(flex|inline-flex|grid|inline-grid)\b/` carries `role="presentation"`.
- **eslint `a11yRecommendedWarn`:** the `<tr>`s carry no handlers in this slice, so no
  static/noninteractive-interaction rule fires and **no `eslint-disable` is authorised** (a dead
  disable is the regression). The kebab column's header is `<th scope="col"><span
  className="sr-only">Actions</span></th>`. **Reconciliation with the shipped precedent** (director
  F-7): `LogWeekGrid.tsx:33-37` + `:624` rejected an sr-only name on its **corner** cell and used
  a targeted `eslint-disable` instead — because that cell heads no real column, so a name there
  is a false label. The D9a case is the opposite: an actions column IS a real column of the
  table (every row has a kebab in it) and "Actions" is a truthful name, so the sr-only header is
  the honest choice here and no disable is needed. Both are the same rule — name a header only
  when it heads something. The table also carries `<caption className="sr-only">` (the
  `LogWeekGrid.tsx:614-616` / `NeedMatrix.tsx:158` sibling idiom). Lint must stay at **0 errors /
  ≤ 903 warnings** (= main).
- **12px floor:** every cell and header is `text-xs`+ (v1's `text-[10px]` Type badge is NOT
  restored — `Tag` is 12px). No `text-[7-11px]` anywhere in the diff.
- **Colour:** every colour is a token class — `Tag tone="floor-N"`, `bg-material-{twine|glaze|
  solvent|tomestone}`, `text-text-*`. `FLOOR_COLORS`, `.hex`, `style={{ color }}`,
  `color-mix(...)` with a literal, `METHOD_INFO[...].textClass` — none appear in the diff.
  `pnpm check:design-system:strict` is the gate; grep for `FLOOR_COLORS` and `textClass` in
  `loot/` and `utils/` as a second check.
- **Vocabulary:** "static," never "group," in any new user-facing copy (this slice adds no new
  sentences beyond column headers, the caption and `aug {slot}`; the empty message stays verbatim).
- **Release note:** `internal: true`, `CURRENT_VERSION` untouched (v2 admin-gated dark). `pr: 0`
  backfilled at PR open; `prTitle` = the PR title. Invoke the pr-checklist skill before opening the
  PR.
- **Sizing (director-recomputed, F-8/F-sizing):** deletions ≈ **787** (`LootEntryRow.tsx` 165 +
  `LootEntryRow.test.tsx` 248 + `WeekGroupHeader.tsx` 45 whole-file, plus the two in-place
  rewrites' old bodies `LootHistoryTable.tsx` 148 + `LootHistoryTable.test.tsx` 181); additions ≈
  **1,060** (sorter ~110, sorter tests ~180, host ~230, host tests ~400, `Loot.tsx` ~10,
  `Loot.test.tsx` ~20, comment sweep ~8, docs ~110, release note ~12). **≈ 1,850 changed lines
  before the plan document, ≈ 2,300 with it.** That busts the 1,500 budget, so the PR opens under
  the **mega-PR protocol**: (i) *staged review* — diff-scoped `redesign-reviewer` per task + the
  whole-branch reviewer + the director change-review, all recorded in the PR body; (ii) *stated
  reason it can't be split* — Task 1 alone ships a sorter with no consumer, Task 4's write-backs
  must ride with the build (the Phase-C rulings-land-with-the-row rule), and D9a **is** the
  pre-declared half of D9 (`phase-d-loot-plan.md:266-267`) — ~790 of the lines are whole-file or
  whole-body deletion of the surface being replaced; (iii) *planned post-merge soak* — D9b is the
  next slice on the same surface and starts with a live pass over D9a's table before adding
  separators. A single PR is the ruled default; the user may still call a split.
- **Test-edit discipline:** existing tests may change ONLY in these sanctioned classes, each named
  where it happens: (1) **the merge-vs-sort class** — `historyItems.test.ts:56-83`'s three
  ordering tests move from `buildHistoryItems` (which becomes merge-only) to `sortHistoryItems`;
  (2) **the table-rewrite class** — `LootHistoryTable.test.tsx` is rewritten whole; its three
  deep-link tests (`:141-180`) and the `applies the filters prop` / `material-entry id` / `kebab
  Edit` tests (`:111-140`) re-land with the same assertions on the new DOM; the two
  `WEEK N`/`drops` header tests (`:91-110`) are **retired with the component** (D9b re-lands them
  as separator tests); (3) **the row-test re-home class** — `LootEntryRow.test.tsx`'s kebab
  visibility/handler tests (`:138-203`), unknown-player fallback (`:118`) and empty-floor `—`
  (`:204-209`) re-land in `LootHistoryTable.test.tsx`; its badge/"BiS need"/"free / sell"/"aug
  body" text assertions are rewritten to the new cell copy (`BiS` / `Extra` / `aug body`); the
  `WeekGroupHeader` describe (`:212-247`) is retired with the component; (4) **the comment class**
  — `Loot.test.tsx:10`'s component list drops `LootEntryRow`; (5) **the cross-file comment class**
  — `RosterCard.test.tsx:727`, `SessionList.test.tsx:53`, `lootActivity.test.ts:10` change ONE
  comment line each, no assertion. `Loot.test.tsx` assertions change **nowhere**. Anything else
  needs its own justification in the task report.

---

## What today's v2 History loses, and where each goes (director F-5)

V1 is untouched, so this is not the parity-matrix rule — it is the same discipline applied to a
v2→v2 surface replacement, so the drops are decided, not discovered.

| Today (`LootEntryRow.tsx`) | After D9a | Disposition |
|---|---|---|
| R/T/A 30 px source badge (`:38-48`, `:95-99`, `:121`) | Method column reads `Drop` / `Tome` / `Purchase` / `Book`; material rows read `Twine` etc. with the material dot | **Absorbed.** The "A" augment marker's successor is the dot + the `aug {slot}` Type tag |
| `floorText`'s `· F{n}` suffix (`:67-71`) | Floor column shows the duty name in the floor-coloured `Tag`; the floor NUMBER is carried by the token colour and by the Floor sort (tier order) | **Dropped as redundant** — the column exists for it (R-33) |
| `floorText`'s `—` for an empty floor (`:68`; test `:204-209`) | An empty floor renders `—` in `text-text-tertiary`, **not** an empty `Tag` | **Kept** (D9a-r) |
| `{itemSlot} · {method}{ · extra}` sub-line (`:105-107`) | Method → Method column; `extra` → Type `Extra`; the raw `itemSlot` key (`ring`, `ring1`) is no longer shown | **Dropped.** The display name suffices in a table; D10's search matches raw keys |
| `PlayerIdentity variant="inline"` (`:53-65`) — 32 px avatar ring + name + `job` subtitle | `JobIcon size="xs"` + name (the `BookLedgerCard` D7b row shape) | **Replaced** — a two-line 32 px unit is too tall for a find-table; the icon carries job; role tint omitted (D9a-h) |
| `relativeTime(createdAt)` (`:146`) | Absolute `Jul 24, 3:45 PM` in **local time** | **Replaced** (D9a-h, D9a-o) |
| `WeekGroupHeader` — UTC-pinned lockout range, current-week marker, `{n} drop(s)` (`:14-19`, `:29-39`, `:42`) | Absent for one slice; Week column carries `W{n}` | **Deferred to D9b** by R-D9a-A; archaeology carried in the R-29 build note |
| `aug {slotAugmented ?? 'tome wpn'}` (`:132-136`) | Same copy in the Type column; `'tome_weapon'` now also reads `tome wpn` | **Kept** (R-D9a-A) + one copy fix (D9a-t) |

---

## Decisions in this plan

Rows marked **RULED** are user rulings (the Phase-D co-design rule); rows marked *Director vets*
are plan-level calls the vet pass checks (all vetted 2026-09-18; D9a-e reversed by the vet).

| # | Decision | Status |
|---|---|---|
| **D9a-A** | **The D9a/D9b seam** — see R-D9a-A. | **RULED 2026-09-18** |
| **D9a-B** | **Tiebreak direction** — see R-D9a-B. | **RULED 2026-09-18** |
| **D9a-C** | **First-click direction** — see R-D9a-C. | **RULED 2026-09-18** |
| **D9a-D** | **Sticky `thead` to the shell scrollport** — see R-D9a-D. | **RULED 2026-09-18** |
| D9a-e | **Host rewritten in place; `HistoryItem` moves to `logWeekGridData.ts`** (director F-11 — reversed from "moves to `LootHistoryTable.tsx`"). `LootHistoryTable.tsx` keeps its name, its highlight effect and its `Loot.tsx` mount; `LootEntryRow.tsx` and `WeekGroupHeader.tsx` are deleted (no consumer after the rewrite — knip would flag them). The alias `export type HistoryItem = LogGridEntryRef` (`LootEntryRow.tsx:22`) lands in `logWeekGridData.ts` directly beneath `LogGridEntryRef` (`:77-79`) — cycle-free (a util importing a type from the component that imports the util was the alternative), and exactly what `:71-76`'s docblock already describes ("one type across the grid, the History rows and `requestDelete`"). `Loot.tsx:173`, `utils/historyItems.ts:12` and `LootHistoryTable.tsx` import it from there. | Director vets ✓ (as revised) |
| D9a-f | **`buildHistoryItems` becomes merge-only**; ordering is `sortHistoryItems`'s job (one sort, not two). Its only other consumer, `Loot.tsx:865 → historyWeeks(...)`, self-sorts (`historyItems.ts:76`). The three `historyItems.test.ts` ordering tests move (class 1). | Director vets ✓ |
| D9a-g | **Sort keys per column** — Week: `weekNumber` · Floor: `floors.indexOf(entry.floor)` (unknown/empty floor sorts last; tier-aware, the `LootEntryRow.floorText` precedent, not `parseFloorName`) · Slot: `slotNameOf(item)` (`GEAR_SLOT_NAMES[itemSlot]`, `'ring'`→`Ring`, unknown → raw; materials → `UPGRADE_MATERIAL_DISPLAY_NAMES`) · Player: resolved roster name, falling back to `recipientPlayerName` · Method: `methodLabelOf(item)` (what the cell shows) · Date: `createdAt` ms · Type: rank `0` loot-BiS, `1` loot-Extra, `2` material (v1's `type` then `isExtra` order, `AllWeeksView.tsx:285`). Text keys use `localeCompare`. **Both display strings that double as sort keys are exported from the util and consumed by the cell** (director F-9) — a sort-by-what-you-show column whose key and label are authored twice is the bug the column exists to prevent. | Director vets ✓ |
| D9a-h | **Cell anatomy.** Week `W{n}` (`font-medium text-text-primary`) · Floor `<Tag variant="label" tone={floorToneOf(floors, entry.floor)}>{entry.floor}</Tag>`, or `—` (`text-text-tertiary`) when the floor is empty (D9a-r) · Slot: `GearSlotIcon size={16}` (loot rows with a known `LootSlot`) **or** an `aria-hidden` `h-2 w-2 rounded-full bg-material-{token}` dot (material rows), then `JobIcon size="xs"` of `weaponJob` when present (R-38), then `slotNameOf(item)` in `text-text-primary` — all inside one `inline-flex items-center gap-1.5` span (aria-hidden hazard) · Player: `JobIcon size="xs"` of the **recipient's** job + name in `text-text-primary`, inside `inline-flex items-center gap-1.5` (`PlayerIdentity` leaves the surface — see the drops table; role tint deliberately omitted — say it once, the icon carries job) · Method: `methodLabelOf(item)`, `text-text-secondary` (mockup shape; no per-method colour) · Date: `Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })` → `Jul 24, 3:45 PM`, `text-text-secondary whitespace-nowrap` (D9a-o for the zone) · Type: loot → `<Tag variant="label" tone="success">BiS</Tag>` / `tone="muted">Extra` (mockup copy; v2's "BiS need"/"free / sell" retired); material → `<Tag variant="label" tone="muted">aug {augSlotLabel}</Tag>` (D9a-t) · ⋮: the shipped kebab verbatim. | Director vets ✓ |
| D9a-i | **Row is inert; hover is a reading aid.** `<tr>` carries `id={historyRowDomId(item)}`, the optional `highlight-pulse`, `hover:bg-surface-raised` and nothing else — no `onClick`, `tabIndex`, `cursor-pointer`, `select-none` or `aria-label` (all R-31/D11, and the last two would be lies on an inert row). A hover tint on a table row tracks the eye across eight cells; it promises no activation. | Director vets ✓ |
| D9a-j | **Header anatomy.** A `COLUMNS` const (`field`, `label`, `thClassName`, `align`) drives seven `ui/SortableHeader`s; the eighth `<th scope="col">` holds `<span className="sr-only">Actions</span>` (see the eslint constraint for the precedent reconciliation). `<caption className="sr-only">Loot and material history for this tier</caption>`. `<thead className="sticky top-0 z-10 bg-surface-card border-b border-border-default">`; the card wrapper is `rounded-lg border border-border-default bg-surface-card overflow-clip`. Widths: Week `w-16`, Floor `w-24`, Method `w-24`, Type `w-28`, ⋮ `w-12`; Slot/Player/Date auto. | Director vets ✓ |
| D9a-k | **Kebab stays Radix** (`Dropdown` + `IconButton`, `LootEntryRow.tsx:147-162` moved verbatim into the ⋮ cell renderer). Items: `Edit` (loot rows AND `canEdit`), `Copy link`, `Delete` (`canEdit`, danger). D11 converts to the two-trigger `ContextMenu` + right-click + "View week N in Log" + material Edit under R-32; converting here would be converting twice. Read-only viewers keep `Copy link` (shipped v2 behaviour; D6-l's inert-cell divergence is the Log grid's, not History's). | Director vets ✓ |
| D9a-l | **Props dropped, not parked.** `currentWeek` and `rangeOfWeek` leave `LootHistoryTableProps` (unused without week headers — a destructured-but-unused prop is a lint error, an undestructured one is dead API). D9b re-adds both with the separators. `Loot.tsx`'s mount loses the two lines (`:998-999`). | Director vets ✓ |
| D9a-m | **`isLootSlot` guard is file-local** to `LootHistoryTable.tsx` (`s === 'ring' \|\| (GEAR_SLOTS as readonly string[]).includes(s)`; `GEAR_SLOTS: GearSlot[]` at `types/index.ts:471`, `itemSlot: string` at `:1247`, `LootSlot` at `:27`): an unknown slot renders name-only, no icon, no crash. Not exported (`react-refresh/only-export-components` is an error in this repo). | Director vets ✓ |
| D9a-n | **`overflow-clip` means no horizontal scroll** (director F-1). `overflow-x-auto` (the `LogWeekGrid.tsx:612` idiom) would create a scrollport and defeat the sticky header, so R-D9a-D forces this trade: below the width where eight columns fit, the card **clips** its right edge. Desktop (≥ 1024 px) fits with the widths in D9a-j — verified in the browser pass at 1280 and 1024 (DoD 2); narrower is Phase P's, where the sticky/scroll trade is re-decided for mobile. | Director vets ✓ (new) |
| D9a-o | **The Date column is local time; D9b's week range stays UTC-pinned** (director F-5 item 6). `WeekGroupHeader.tsx:14-19` pins `timeZone: 'UTC'` because a lockout RANGE is a day-granular boundary that must never shift a day (the `WeekScopeControl` precedent); a logged entry's `createdAt` is a moment, and the user asks "when tonight did that drop?" — local time answers it. The two conventions will sit in the same table after D9b and are correct for different reasons; the R-29 build note says so. Tests assert only the date half (`/Jun 24, /`) — CI's jsdom is UTC, Windows runners are local. | Director vets ✓ (new) |
| D9a-p | **The v2-affordance drops are enumerated** — the table above. | Director vets ✓ (new) |
| D9a-q | **`historyRowDomId` — one author for the row id** (director F-3 bonus). `logWeekGridData.ts:90-96` records the director's earlier blocker ruling: the Log grid's cell id has ONE author (`logCellDomId`, `:100-101`), contrasted with "the shipped History path's drift-prone split (`LootHistoryTable.tsx:84-85` vs `LootEntryRow.tsx:80`)". D9a is the moment both authors land in one file — so the split is closed, not preserved: `export const historyRowDomId = (ref: HighlightEntryRef): string => \`${ref.kind}-entry-${ref.id}\`;` beside `logCellDomId` (keyed on the `{kind, id}` shape at `:88` because the effect holds no entry object), consumed by the effect's `getElementById` AND the `<tr id>`. The `:90-96` comment is rewritten (its premise changes); `RosterCard.test.tsx:727` re-points to the helper by name. | Director vets ✓ (new) |
| D9a-r | **Typed floor→tone lookup; empty floor renders `—`** (director F-10). `Tone` is a closed union (`Tag.tsx:15-18`); `\`floor-${n}\`` type-checks only when `n` is `FloorNumber` (the `Loot.tsx:940` precedent), and an `as Tone` cast would admit `floor-5` → `undefined` className on a >4-floor tier. File-local `floorToneOf(floors: string[], floor: string): Tone` → `idx = floors.indexOf(floor)`; `0 ≤ idx < 4` → `\`floor-${(idx + 1) as FloorNumber}\``; else `'muted'`. An **empty** floor short-circuits before the `Tag` to `—` (the `LootEntryRow.tsx:68` fallback, kept). | Director vets ✓ (new) |
| D9a-s | **`methodLabelOf` + the `METHOD_INFO` typing shape** (director F-9). `METHOD_INFO` is `Record<string, MethodInfo>` (`lootMethodDisplay.ts:9`) and this repo does not set `noUncheckedIndexedAccess`, so a bare `METHOD_INFO[m]?.label` reads as a dead optional chain. Pre-authorised shape: `const info = METHOD_INFO[method] as MethodInfo \| undefined; return info?.label ?? method;` — `MethodInfo` is not exported from the frozen file, so use `(typeof METHOD_INFO)[string] \| undefined`. Exported from `utils/historyItems.ts`, consumed by `KEY.method` and the Method cell. | Director vets ✓ (new) |
| D9a-t | **`aug` label mapping** (director F-13). `slotAugmented` is `GearSlot \| 'tome_weapon' \| null` (`types/index.ts:1302`); today's copy renders the raw enum `aug tome_weapon` for the tome-weapon case. `augSlotLabel = slotAugmented == null \|\| slotAugmented === 'tome_weapon' ? 'tome wpn' : slotAugmented` — the shipped `null → tome wpn` fallback kept, the enum leak closed. Raw slot keys (`aug body`) stay as shipped (R-34 keeps "v2's readout"; polishing to display names is D9b's R-34 states pass if wanted). | Director vets ✓ (new) |
| D9a-u | **`CELL` render map** (director F-12). `const CELL: Record<HistorySortField, (item: HistoryItem, ctx: CellContext) => ReactNode>` in the host, iterated with `COLUMNS` — so column ⇄ key ⇄ cell are one-authored (folding F-9) and a contiguous eight-`<td>` block structurally identical to `AllWeeksView.tsx:563-635` cannot exist. The ⋮ cell is rendered after the map (it is not a sort field). | Director vets ✓ (new) |

---

## File map

| File | Change |
|---|---|
| `frontend/src/utils/historyItems.ts` | `buildHistoryItems` → merge-only; **add** `HistorySortField`, `HistorySortDirection`, `HistorySortState`, `HISTORY_SORT_FIELDS`, `DEFAULT_HISTORY_SORT`, `nextHistorySort`, `sortHistoryItems`, `slotNameOf`, `methodLabelOf`; `HistoryItem` import → `../components/loot/logWeekGridData` |
| `frontend/src/utils/historyItems.test.ts` | class 1 move + the new sort/toggle/label suites |
| `frontend/src/components/loot/logWeekGridData.ts` | **add** `export type HistoryItem = LogGridEntryRef` beneath `:77-79` (D9a-e); **add** `historyRowDomId` beside `logCellDomId` (D9a-q); comments `:73` and `:90-96` rewritten |
| `frontend/src/components/loot/LootHistoryTable.tsx` | **Rewrite in place** — flat table; highlight effect kept, now on `historyRowDomId` |
| `frontend/src/components/loot/LootHistoryTable.test.tsx` | **Rewrite** (class 2 + class 3 re-homes + new) |
| `frontend/src/components/loot/LootEntryRow.tsx` | **Delete** |
| `frontend/src/components/loot/LootEntryRow.test.tsx` | **Delete** |
| `frontend/src/components/loot/WeekGroupHeader.tsx` | **Delete** |
| `frontend/src/components/loot/LogWeekGrid.tsx` | Comment `:195` (`LootEntryRow.tsx:80-83` idiom → `LootHistoryTable.tsx`'s highlight derivation, by symbol) — comment-only |
| `frontend/src/components/loot/Loot.tsx` | `:173` import → `./logWeekGridData`; mount loses `:998-999`; comments `:592` (alias home), `:603` and `:702` (cite the effect by symbol, not `:60-103`/`:91-96`); header comment `:83-88` gains the sort-locality sentence |
| `frontend/src/components/loot/Loot.test.tsx` | `:10` comment (class 4) + ONE new assembly test; no assertion changes |
| `frontend/src/components/roster/RosterCard.test.tsx` | `:727` comment → "the highlight params `LootHistoryTable`'s `?entry=` effect consumes (row ids from `historyRowDomId`)" — comment-only (class 5) |
| `frontend/src/components/schedule/SessionList.test.tsx` | `:53` comment → `LootHistoryTable.test.tsx` — comment-only (class 5) |
| `frontend/src/utils/lootActivity.test.ts` | `:10` comment → `LootHistoryTable` — comment-only (class 5) |
| Docs | `phase-d-loot-design.md` build notes (R-29 D9a-half, R-33, R-34 partial, R-38, R-39, R-46); `phase-d-loot-plan.md` :195-196 (D9a gains the aug readout + sticky thead; D9b loses `slotAugmented`); `v1-v2-parity-matrix.md` D-31/D-32/D-33; `releaseNotes.ts` internal entry |

Dependencies: Task 2 needs Task 1 · Task 3 needs Task 2 · Task 4 last. Tasks 1→4 execute in
order.

---

### Task 1: The pure sorter — `utils/historyItems.ts`

**Files:**
- Modify: `frontend/src/utils/historyItems.ts` (`buildHistoryItems` :37-52 → merge-only; new
  exports below; the `HistoryItem` import stays on the `LootEntryRow` path in THIS task so the
  commit stands alone — Task 2 re-points it)
- Modify: `frontend/src/utils/historyItems.test.ts` (class 1 move at `:56-83`; new describes)

**Interfaces** (Task 2 relies on these exact names):
```ts
export type HistorySortField = 'week' | 'floor' | 'slot' | 'player' | 'method' | 'date' | 'type';
export type HistorySortDirection = 'asc' | 'desc';   // = ui/SortableHeader's SortDirection
export interface HistorySortState { field: HistorySortField; direction: HistorySortDirection }
export const HISTORY_SORT_FIELDS: readonly HistorySortField[];
export const DEFAULT_HISTORY_SORT: HistorySortState;          // { field: 'week', direction: 'desc' }
/** R-D9a-C: same field flips; a new field starts on its natural direction. */
export function nextHistorySort(field: HistorySortField, current: HistorySortState): HistorySortState;
export interface HistorySortContext {
  floors: string[];
  /** recipient display name; the caller resolves roster name ?? recipientPlayerName. */
  playerNameOf: (item: HistoryItem) => string;
}
/** The Slot cell's text AND the slot sort key — one author (D9a-g). */
export function slotNameOf(item: HistoryItem): string;
/** The Method cell's text AND the method sort key — one author (D9a-s). */
export function methodLabelOf(item: HistoryItem): string;
/** Pure; returns a NEW array. Primary per `sort`; ties createdAt desc → kind → id desc (R-D9a-B). */
export function sortHistoryItems(items: HistoryItem[], sort: HistorySortState, ctx: HistorySortContext): HistoryItem[];
```
- Consumes: `METHOD_INFO` from `../components/history/lootMethodDisplay` (label only — the file is
  imported, never edited; typing shape per D9a-s), `GEAR_SLOT_NAMES` from `../types`,
  `UPGRADE_MATERIAL_DISPLAY_NAMES` from `../gamedata/loot-tables`.
- **Not** consumed: `admin/sortUtils` (R-46).

- [ ] **Step 1: Failing tests.** Fixtures MUST be seeded out of the expected order (trap (a)), the
  createdAt-tiebreak fixtures MUST share their primary key (trap (b)), and the kind/id fixture
  MUST be seeded material-first and higher-id-first (trap (e)). Sketch:
  ```ts
  // helpers: loot(id, week, createdAt, extra?) / mat(id, week, createdAt, materialType?)
  const ctx = { floors: ['M9S','M10S','M11S','M12S'], playerNameOf: (i) => NAMES[i.entry.recipientPlayerId] ?? i.entry.recipientPlayerName };
  describe('buildHistoryItems', () => {
    it('merges loot then material in INPUT order (ordering is sortHistoryItems\'s job)', …); // class 1
  });
  describe('slotNameOf / methodLabelOf', () => {
    it('ring → "Ring", body → "Body", unknown → raw; materials → display name', …);
    it('drop → "Drop", tome → "Tome", unknown "xyz" → "xyz"', …);
  });
  describe('sortHistoryItems', () => {
    it('week desc (the default) puts the newest week first', …);                      // moved from :56
    it('createdAt desc within a week', …);                                            // moved from :66
    it('merges loot and material within a week by createdAt desc', …);               // moved from :76
    it('week asc reverses the weeks but keeps ties newest-first (R-D9a-B)', …);      // W1 rows still createdAt desc
    it('player asc/desc by resolved name with localeCompare; fallback to recipientPlayerName', …);
    it('player asc keeps one player\'s rows newest-first — tiebreak never flips', …); // same player, 3 createdAt
    it('floor sorts by tier index, unknown/empty floor last', …);                    // seed 'M12S','M9S','XYZ',''
    it('slot sorts by displayed name — ring → "Ring", weapon → "Weapon", material → display name', …);
    it('method sorts by the displayed label (Book < Drop < Purchase < Tome)', …);
    it('type ranks loot-BiS < loot-Extra < material', …);
    it('date sorts on createdAt across weeks', …);
    it('identical createdAt: loot before material, then higher id first', …);       // fixture: [mat 7, loot 3, loot 9] → [loot 9, loot 3, mat 7]
    it('does not mutate its input', …);
  });
  describe('nextHistorySort', () => {
    it('flips the active field', …);
    it('week and date start desc; floor/slot/player/method/type start asc', …);      // loop HISTORY_SORT_FIELDS
  });
  ```
- [ ] **Step 2: RED** — `pnpm -C frontend test historyItems`.
- [ ] **Step 3: Implement.** Shape (not a transcription of `AllWeeksView.tsx:274-291`):
  ```ts
  const NATURAL_DIRECTION: Record<HistorySortField, HistorySortDirection> = {
    week: 'desc', date: 'desc', floor: 'asc', slot: 'asc', player: 'asc', method: 'asc', type: 'asc',
  };
  type MethodInfoLike = (typeof METHOD_INFO)[string] | undefined;   // D9a-s: the frozen file doesn't export MethodInfo
  export function methodLabelOf(item: HistoryItem): string {
    const info = METHOD_INFO[item.entry.method] as MethodInfoLike;
    return info?.label ?? item.entry.method;
  }
  export function slotNameOf(item: HistoryItem): string { /* loot: 'ring' → 'Ring', GEAR_SLOT_NAMES lookup, raw fallback; material: UPGRADE_MATERIAL_DISPLAY_NAMES */ }
  type Key = number | string;
  const KEY: Record<HistorySortField, (item: HistoryItem, ctx: HistorySortContext) => Key> = {
    week:   (i) => i.entry.weekNumber,
    floor:  (i, c) => { const n = c.floors.indexOf(i.entry.floor); return n < 0 ? Number.MAX_SAFE_INTEGER : n; },
    slot:   (i) => slotNameOf(i),
    player: (i, c) => c.playerNameOf(i),
    method: (i) => methodLabelOf(i),
    date:   (i) => createdAtOf(i),
    type:   (i) => (i.kind === 'material' ? 2 : i.entry.isExtra ? 1 : 0),
  };
  function compareKeys(a: Key, b: Key): number { return typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : (a as number) - (b as number); }
  function tiebreak(a: HistoryItem, b: HistoryItem): number {   // R-D9a-B — never direction-aware
    return createdAtOf(b) - createdAtOf(a) || (a.kind === b.kind ? 0 : a.kind === 'loot' ? -1 : 1) || b.entry.id - a.entry.id;
  }
  export function sortHistoryItems(items, sort, ctx) {
    const key = KEY[sort.field]; const sign = sort.direction === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => sign * compareKeys(key(a, ctx), key(b, ctx)) || tiebreak(a, b));
  }
  ```
- [ ] **Step 4: GREEN.**
- [ ] **Step 5: Deletion traces (execute + paste):** (a) drop the `|| tiebreak(a, b)` → the
  "player asc keeps one player's rows newest-first" test fails with the rows in input order;
  (b) make `tiebreak` direction-aware (multiply by `sign`) → the "week asc … keeps ties
  newest-first" test fails; (c) change `NATURAL_DIRECTION.player` to `'desc'` → the
  `nextHistorySort` natural-direction test fails on `player`; (d) return `n` (not
  `MAX_SAFE_INTEGER`) for an unknown floor → the floor test fails with `XYZ` first; **(e)** delete
  the second and third legs of `tiebreak` (`|| (kind…) || b.entry.id - a.entry.id`) → the
  "identical createdAt" test fails with `[mat 7, loot 3, loot 9]` (input order — that IS the
  trace; if it stays green the fixture was seeded in the expected order, trap (e)).
- [ ] **Step 6: Commit** — `feat(v2): D9a history sorter — per-column keys, fixed newest-first tiebreak (R-29)`

---

### Task 2: `LootHistoryTable` becomes the flat sortable table; `LootEntryRow` + `WeekGroupHeader` retire

**Files:**
- Rewrite: `frontend/src/components/loot/LootHistoryTable.tsx`
- Rewrite: `frontend/src/components/loot/LootHistoryTable.test.tsx`
- Delete: `frontend/src/components/loot/LootEntryRow.tsx`, `LootEntryRow.test.tsx`,
  `WeekGroupHeader.tsx`
- Modify: `frontend/src/components/loot/logWeekGridData.ts` (add the `HistoryItem` alias beneath
  `:77-79`; add `historyRowDomId` beside `logCellDomId` `:100-101`; rewrite the `:73` and
  `:90-96` comments — the second one's premise ("the shipped History path's drift-prone split")
  is exactly what this task closes)
- Modify (so the commit builds): `frontend/src/utils/historyItems.ts:12` (`HistoryItem` import →
  `../components/loot/logWeekGridData`), `frontend/src/components/loot/Loot.tsx:173` (same), the
  two prop lines `Loot.tsx:998-999` (a TS error if left), `frontend/src/components/loot/
  LogWeekGrid.tsx:195` (comment). `Loot.test.tsx` imports no `HistoryItem` (verified; `:1433`
  only names it in a test title). Task 3 owns the rest of `Loot.tsx`.

**Interfaces:**
```ts
// logWeekGridData.ts
export type HistoryItem = LogGridEntryRef;                  // moved from LootEntryRow.tsx:22, same name
/** The History row's DOM id — ONE author (D9a-q): the `?entry=` effect and the `<tr id>` both call this.
 *  Takes `HighlightEntryRef` (`{kind, id}`, `:88`) — the effect has no entry object, only its kind + id. */
export const historyRowDomId = (ref: HighlightEntryRef): string => `${ref.kind}-entry-${ref.id}`;
// LootHistoryTable.tsx
export interface LootHistoryTableProps {
  lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; players: SnapshotPlayer[]; floors: string[];
  filters: HistoryFilterState; canEdit: boolean;
  onEdit: (entry: LootLogEntry) => void; onCopyLink: (item: HistoryItem) => void; onDelete: (item: HistoryItem) => void;
}   // currentWeek / rangeOfWeek REMOVED (D9a-l)
```
- Consumes: Task 1's sorter + `nextHistorySort` + `slotNameOf` + `methodLabelOf`;
  `ui/SortableHeader`, `ui/Tag` (+ `Tone`), `ui/GearSlotIcon`, `ui/JobIcon`; `primitives/Dropdown`,
  `primitives/IconButton`; `GEAR_SLOTS`, `GEAR_SLOT_ICONS` (tests only), `FloorNumber` type.

- [ ] **Step 1: Failing tests** (`LootHistoryTable.test.tsx`, rewritten; keep the file's
  `makePlayer`/`makeLootEntry`/`makeMaterialEntry`/`renderTable`/`openKebab` helpers, drop
  `currentWeek`/`rangeOfWeek` from `renderTable`). Row order is read as
  `Array.from(container.querySelectorAll('tbody tr[id]')).map(tr => tr.id)`.
  - **Headers + caption:** "renders seven sortable column headers, an sr-only Actions header and
    a caption" — `getAllByRole('columnheader')` length 8; `Week` has `aria-sort="descending"`,
    the other six `"none"`; the 8th has text `Actions` and no button;
    `container.querySelector('caption')` has the sr-only class and non-empty text.
  - **Default order:** seed `[loot W1 old, mat W2 old, loot W2 new, loot W1 new]` → ids
    `[loot-entry-W2new, material-entry-W2old, loot-entry-W1new, loot-entry-W1old]`.
  - **Sort click:** click `Player` → rows A→Z, `aria-sort="ascending"` on Player, Week back to
    `"none"`; click again → Z→A + `"descending"`. Click `Week` (inactive, natural desc) → desc.
  - **Tiebreak under a text sort:** same player, three `createdAt`s, Player asc → newest first.
  - **Floor chip (R-33/R-45/D9a-r):** the Floor cell contains an element with classes
    `text-floor-2` AND `bg-floor-2/10` for `M10S`; `getAttribute('style')` is `null` (no hex, no
    inline colour); unknown floor `'XYZ'` → `text-text-secondary` (muted tone) without throwing;
    empty floor `''` → the cell text is `—` and contains NO element with a `text-floor-` or
    `bg-surface-elevated` class (no empty `Tag`).
  - **Slot cell (R-39; the `GearSlotIcon.test.tsx:39-41` idiom):** loot row `body` → the cell
    contains a `[aria-hidden="true"]` span whose `getAttribute('style')` contains
    `GEAR_SLOT_ICONS.body` and the text `Body`; material row `twine` → a `.bg-material-twine`
    span, **no** span with a `style` containing `/images/gear-slots/`, text `Twine`;
    `itemSlot: 'ring'` → text `Ring` + a style containing `GEAR_SLOT_ICONS.ring1` (the constant —
    its value is `…/ring.png`, not `ring1`); `itemSlot: 'not_a_slot'` → raw text, no icon span,
    no throw.
  - **Weapon row (R-38 — trap (c)):** recipient WHM, `weaponJob: 'DRG'` → the **Slot** cell has
    `getByAltText('DRG')` and NOT `WHM`; the **Player** cell has `getByAltText('WHM')` and NOT
    `DRG`. Non-weapon row: the Slot cell has no `<img>`.
  - **Player cell:** resolved name + job icon; unknown player → `recipientPlayerName`, no `<img>`
    (class 3 re-home of `LootEntryRow.test.tsx:118`).
  - **Method / Date:** `method: 'book'` → `Book`; `'tome'` → `Tome`; unknown `'xyz'` → `xyz`.
    `createdAt: '2026-06-24T15:45:00Z'` → the Date cell text matches `/^Jun 24, /` (date half
    only — D9a-o).
  - **Type (R-34 / R-D9a-A / D9a-t — trap (f)):** loot → `BiS`; `isExtra` → `Extra`; material
    `slotAugmented: 'body'` → `aug body`; `slotAugmented: null` → `aug tome wpn`;
    `slotAugmented: 'tome_weapon'` → `aug tome wpn` (NOT `aug tome_weapon`). No `BiS need` /
    `free / sell` anywhere (`queryByText` null).
  - **Filters + empty:** `applies the filters prop` (class 2, same assertion); empty → a single
    `<td colSpan=8>` with the verbatim message, and the eight headers still rendered.
  - **Kebab (class 3):** loot+canEdit → `Edit`/`Copy link`/`Delete`; material+canEdit → no
    `Edit`; `canEdit:false` → only `Copy link`; `onEdit(entry)` / `onCopyLink(item)` /
    `onDelete(item)` fire with the exact objects.
  - **Inert row:** `tbody tr` has no `tabindex`, no `cursor-pointer`, no `aria-label`.
  - **Deep-link highlight (class 2, three tests, same assertions):** `highlight-pulse` on the
    `<tr>` for `?entry=1`; param cleared after 2.5 s (`vi.useFakeTimers` as today);
    `entryType=material`; not-in-unfiltered-log → no pulse. Plus one new: "the effect scrolls the
    element whose id `historyRowDomId` returns" — stub `scrollIntoView`, assert it was called on
    the element with `id === historyRowDomId({ kind: 'loot', id: entry.id })`.
  - **aria-hidden sweep (F-4, two tests, the `LogWeekGrid.test.tsx:305-327` idiom):** (i) with a
    loot row AND a material row rendered, every `td [aria-hidden="true"]` in a Slot cell has
    `parentElement.className` containing `inline-flex` (asserts `length > 0` first so the sweep
    can't pass vacuously); (ii) every `[aria-hidden="true"]` whose own className matches
    `/\b(flex|inline-flex|grid|inline-grid)\b/` has `role="presentation"`.
- [ ] **Step 2: RED.**
- [ ] **Step 3: Implement** `LootHistoryTable.tsx`. Skeleton (the effect block `:69-103` is kept
  byte-identical apart from indentation and the `elementId` line `:88-89`, which becomes
  `historyRowDomId({ kind: highlightType, id: highlightId })` — the effect already holds exactly
  the `HighlightEntryRef` shape (`logWeekGridData.ts:88`), so the helper takes that, not a full
  `HistoryItem`, and the row calls it as `historyRowDomId({ kind: item.kind, id: item.entry.id })`):
  ```tsx
  const COLUMNS: ReadonlyArray<{ field: HistorySortField; label: string; thClassName?: string; align?: 'left'|'center' }> = [
    { field: 'week', label: 'Week', thClassName: 'w-16' }, { field: 'floor', label: 'Floor', thClassName: 'w-24' },
    { field: 'slot', label: 'Slot' }, { field: 'player', label: 'Player' }, { field: 'method', label: 'Method', thClassName: 'w-24' },
    { field: 'date', label: 'Date' }, { field: 'type', label: 'Type', thClassName: 'w-28' },
  ];
  function isLootSlot(s: string): s is LootSlot { return s === 'ring' || (GEAR_SLOTS as readonly string[]).includes(s); }
  function floorToneOf(floors: string[], floor: string): Tone { const idx = floors.indexOf(floor); return idx >= 0 && idx < 4 ? `floor-${(idx + 1) as FloorNumber}` : 'muted'; }
  function augSlotLabel(slotAugmented: MaterialLogEntry['slotAugmented']): string { return slotAugmented == null || slotAugmented === 'tome_weapon' ? 'tome wpn' : slotAugmented; }
  const MATERIAL_DOT: Record<MaterialType, string> = { twine: 'bg-material-twine', glaze: 'bg-material-glaze', solvent: 'bg-material-solvent', universal_tomestone: 'bg-material-tomestone' };
  const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  interface CellContext { floors: string[]; playersById: Map<string, SnapshotPlayer> }
  const CELL: Record<HistorySortField, (item: HistoryItem, ctx: CellContext) => ReactNode> = {
    week:   (i) => <span className="font-medium text-text-primary">{`W${i.entry.weekNumber}`}</span>,
    floor:  (i, c) => i.entry.floor ? <Tag variant="label" tone={floorToneOf(c.floors, i.entry.floor)}>{i.entry.floor}</Tag> : <span className="text-text-tertiary">—</span>,
    slot:   (i) => <span className="inline-flex items-center gap-1.5">{/* GearSlotIcon | dot */}{/* weaponJob JobIcon */}<span className="text-text-primary">{slotNameOf(i)}</span></span>,
    player: (i, c) => { const p = c.playersById.get(i.entry.recipientPlayerId); return <span className="inline-flex items-center gap-1.5">{p?.job && <JobIcon job={p.job} size="xs" />}<span className="text-text-primary">{p?.name ?? i.entry.recipientPlayerName}</span></span>; },
    method: (i) => <span className="text-text-secondary">{methodLabelOf(i)}</span>,
    date:   (i) => <span className="text-text-secondary whitespace-nowrap">{DATE_FMT.format(new Date(i.entry.createdAt))}</span>,
    type:   (i) => i.kind === 'loot' ? (i.entry.isExtra ? <Tag variant="label" tone="muted">Extra</Tag> : <Tag variant="label" tone="success">BiS</Tag>) : <Tag variant="label" tone="muted">{`aug ${augSlotLabel(i.entry.slotAugmented)}`}</Tag>,
  };

  export function LootHistoryTable({ … }: LootHistoryTableProps) {
    const [sort, setSort] = useState<HistorySortState>(DEFAULT_HISTORY_SORT);   // session-local, R-29 note 3
    /* highlight derivations + effect — unchanged from :60-103 except the id comes from historyRowDomId */
    const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
    const sortCtx = useMemo<HistorySortContext>(() => ({ floors, playerNameOf: (i) => playersById.get(i.entry.recipientPlayerId)?.name ?? i.entry.recipientPlayerName }), [floors, playersById]);
    const rows = useMemo(() => sortHistoryItems(filterHistoryItems(buildHistoryItems(lootLog, materialLog), filters), sort, sortCtx), [lootLog, materialLog, filters, sort, sortCtx]);
    const cellCtx: CellContext = { floors, playersById };
    return (
      <div className="rounded-lg border border-border-default bg-surface-card overflow-clip">
        <table className="w-full text-sm">
          <caption className="sr-only">Loot and material history for this tier</caption>
          <thead className="sticky top-0 z-10 bg-surface-card border-b border-border-default">
            <tr>
              {COLUMNS.map((c) => <SortableHeader key={c.field} field={c.field} label={c.label} currentField={sort.field} currentDirection={sort.direction} onSort={(f) => setSort((s) => nextHistorySort(f, s))} thClassName={c.thClassName} align={c.align} />)}
              <th scope="col" className="w-12 px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.length === 0 ? <tr><td colSpan={8} className="px-4 py-6 text-sm text-text-tertiary">No entries match — log a drop from the Priority view.</td></tr>
              : rows.map((item) => (
                <tr key={historyRowDomId({ kind: item.kind, id: item.entry.id })} id={historyRowDomId({ kind: item.kind, id: item.entry.id })} className={`hover:bg-surface-raised${isHighlighted(item) ? ' highlight-pulse' : ''}`}>
                  {COLUMNS.map((c) => <td key={c.field} className="px-4 py-2.5">{CELL[c.field](item, cellCtx)}</td>)}
                  <td className="px-4 py-2.5">{/* the Dropdown block from LootEntryRow.tsx:147-162, verbatim */}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  }
  ```
  Docblock: rewrite `:1-7` — "the flat sortable transparent record (R-29/R-46; D9a)", name the
  owned `?entry=` effect and `historyRowDomId`, name what D9b/D10/D11 add, cite
  `AllWeeksView.tsx` as the frozen reference, name the `overflow-clip` trade (D9a-n) and the
  local-time Date (D9a-o).
- [ ] **Step 4: Delete** `LootEntryRow.tsx`, `LootEntryRow.test.tsx`, `WeekGroupHeader.tsx`;
  add the alias + helper to `logWeekGridData.ts` and rewrite its `:73` / `:90-96` comments;
  re-point `historyItems.ts:12`, `Loot.tsx:173`; remove `Loot.tsx:998-999`; fix the
  `LogWeekGrid.tsx:195` comment. `pnpm -C frontend exec tsc -b` clean.
- [ ] **Step 5: GREEN** — `LootHistoryTable`, `historyItems`, `logWeekGridData`, AND
  `Loot.test.tsx` (the seven History tests must pass **unchanged** — if one fails, the DOM
  contract slipped; fix the table, never the test).
- [ ] **Step 6: `pnpm -C frontend dupes`** — paste the percentage; must stay < 5 % with
  `history/` in scope. If a clone appears (against `AllWeeksView.tsx` OR a v2 sibling —
  `LogWeekGrid.tsx`, `NeedMatrix.tsx`, `BookLedgerCard.tsx`), restructure the offending block —
  do not add an ignore.
- [ ] **Step 7: Deletion traces (execute + paste):** (a) render `player.job` instead of
  `entry.weaponJob` in the Slot cell → the R-38 test fails on `getByAltText('DRG')`; (b) replace
  the `Tag tone` with `style={{ color: … }}` → the floor-chip `style === null` assertion fails;
  (c) drop the `inline-flex` wrapper in the Slot cell → the aria-hidden sweep (i) fails; (d)
  compose the `<tr id>` inline as `` `${kind}-entry-${id}` `` with a deliberate typo
  (`-entry_`) → the new "scrolls the element whose id `historyRowDomId` returns" test AND
  `Loot.test.tsx:781` fail (proves both consumers read the one author); (e) call
  `sortHistoryItems` with `DEFAULT_HISTORY_SORT` instead of `sort` → the Player-click test fails
  with the default order; **(f)** delete the material branch of `CELL.type` (return `null` for
  materials) → the `aug body` AND `aug tome wpn` tests fail (trap (f) — R-D9a-A's payload has an
  executed trace); (g) return `'muted'` unconditionally from `floorToneOf` → the `text-floor-2`
  assertion fails.
- [ ] **Step 8: Commit** — `feat(v2): D9a History is a flat sortable table — R-33 floor chip, R-38 weapon job, R-39 slot icon, kebab column (R-29/R-46)`

---

### Task 3: `Loot.tsx` wiring + the comment sweep; one assembly test

**Files:**
- Modify: `frontend/src/components/loot/Loot.tsx` (header comment `:83-88`; comments `:592`,
  `:603`, `:702`; the History branch `:981-1005` — the mount itself was already trimmed in
  Task 2)
- Modify: `frontend/src/components/loot/Loot.test.tsx` (`:10` comment — class 4; one new `it`)
- Modify (comment-only, class 5): `frontend/src/components/roster/RosterCard.test.tsx:727`,
  `frontend/src/components/schedule/SessionList.test.tsx:53`,
  `frontend/src/utils/lootActivity.test.ts:10`

- [ ] **Step 1: Failing test** (`Loot.test.tsx`, appended to the History describe): "sorting by
  Player from the History view reorders the real table" — seed two loot entries for two players
  (names chosen so the default week/createdAt order is the REVERSE of A→Z — trap (a)), render
  `['/?lview=history']`, read `tbody tr[id]` order, click `getByRole('button', { name: 'Player'
  })`, assert the new order and `aria-sort="ascending"` on the Player `columnheader`. This proves
  the assembly hands the table its `players` (the name resolver) and that the table's sort is live
  end-to-end.
- [ ] **Step 2: RED** (only if Task 2 left the mount broken — otherwise this passes immediately;
  if it does, RECORD that and still keep the test: it is the assembly guard).
- [ ] **Step 3: Implement.** Mount (already trimmed in Task 2 — verify it reads exactly):
  ```tsx
  <LootHistoryTable lootLog={lootLog} materialLog={materialLog} players={players} floors={floors}
    filters={filters} canEdit={canEdit} onEdit={openEdit} onCopyLink={copyLink} onDelete={requestDelete} />
  ```
  Comments: `:83-88` add one sentence — "History's sort is session-local too (R-29 note 3) — a
  fresh deep-link always opens Week desc"; `:592` → "`logWeekGridData.ts`'s `HistoryItem` alias";
  `:603` → "Re-expresses `LootHistoryTable`'s `?entry=` highlight effect's contract" (symbol, not
  `:60-103`); `:702` → "(the `replace: true` idiom `LootHistoryTable`'s clear timer uses" (symbol,
  not `:91-96`); `:130-132` still true. `Loot.test.tsx:10`: drop `LootEntryRow` from the list.
  Class 5: `RosterCard.test.tsx:727` → "the highlight params `LootHistoryTable`'s `?entry=` effect
  consumes (row ids from `historyRowDomId`)"; `SessionList.test.tsx:53` → replace
  `LootEntryRow.test.tsx` with `LootHistoryTable.test.tsx`; `lootActivity.test.ts:10` → replace
  `LootEntryRow` with `LootHistoryTable`.
- [ ] **Step 4: GREEN** — full `Loot.test.tsx`; the three class-5 files' suites unchanged and
  green. `grep -rn "LootEntryRow\|WeekGroupHeader" frontend/src` → **zero hits** (paste it).
- [ ] **Step 5: Commit** — `feat(v2): D9a Loot mounts the flat History table; assembly sort test; comment sweep`

---

### Task 4: Records, write-backs, release note, gate

**Files:**
- Modify: `design/redesign/specs/phase-d-loot-design.md` (build notes under R-29, R-33, R-34,
  R-38, R-39, R-46)
- Modify: `design/redesign/specs/phase-d-loot-plan.md` (:195 D9a row, :196 D9b row — director
  F-6)
- Modify: `design/redesign/specs/v1-v2-parity-matrix.md` (D-31 :256, D-32 :258, D-33 :259)
- Modify: `frontend/src/data/releaseNotes.ts` (internal entry)

- [ ] **Step 1: Design-record build notes (dated, under each ruling).** R-29 — shipped the
  **table half** (D9a): seven sortable columns on `ui/SortableHeader` plus a plain sr-only
  `Actions` `<th>` for the kebab (the eighth column is not sortable), fixed newest-first tiebreak
  (R-D9a-B), per-column natural first direction (R-D9a-C), sticky `thead` to the
  `GroupViewContent.tsx:711-713` scrollport with the `overflow-clip` no-h-scroll trade (R-D9a-D,
  D9a-n), local-time Date column vs the UTC-pinned range D9b will add (D9a-o), session-local sort;
  **separators are D9b**; rewrite impl note 1 so it no longer cites the deleted
  `WeekGroupHeader.tsx:34-36` — cite `3f90d420:frontend/src/components/loot/WeekGroupHeader.tsx`
  `:14-19` (the UTC-pinned `DATE_FMT` + its rationale), `:29-39` (the pill — quote the classes
  `bg-accent/15 text-accent-hover` / `bg-surface-elevated text-text-secondary` and the
  measured-contrast rationale verbatim) and `:42` (the `{n} drop(s)` copy), so D9b rebuilds the
  separator from the note alone; impl note 2 → "resolved by D0's `ui/SortableHeader` (R-46);
  consumer arrived D9a". R-33 — shipped: `Tag tone="floor-N"` via a typed lookup; `FLOOR_COLORS`
  unused; empty floor renders `—`. R-34 — **partial**: the aug readout survived the flattening in
  D9a per R-D9a-A (Type column; `tome_weapon` now reads `tome wpn`); stats count +
  filtered-vs-empty → D9b. R-38 / R-39 — shipped (the Slot cell's anatomy in one line each;
  material rows carry the dot, not a slot glyph). R-46 — the v2 consumer exists;
  `admin/SortableHeader` untouched (cite the diff-stat assert).
- [ ] **Step 2: Slice-table rows** (`phase-d-loot-plan.md`): `:195` D9a gains "+ R-34's
  `slotAugmented` readout (R-D9a-A) + sticky thead (R-D9a-D)" and a "✅ BUILT (PR #N)" marker;
  `:196` D9b loses "`slotAugmented` in the Type column" and gains "(the `?entry=` highlight
  already survived D9a on `historyRowDomId`; D9b's job is the test under separators)".
- [ ] **Step 3: Parity-matrix rewrites.** D-31 → **⏳ PARTIAL (D9a, 2026-09-18):** flat
  cross-week table + sortable columns BUILT (v2-owned header, fixed tiebreak); stats header +
  filtered-vs-empty → D9b; row click-to-edit + context menu "View Week N in Log" → D11; search →
  D-72/D10. D-32 / D-33 → one appended sentence each: "the chronological axis exists again as
  the Date/Week sort (D9a)". D-34 untouched (kebab model stands; D11 adds the jump).
- [ ] **Step 4: Release note** — `internal: true`, version `2.1.23` (latest entry is `2.1.22` at
  `releaseNotes.ts:63`), `CURRENT_VERSION` untouched (`2.1.17`); `prTitle` = the PR title; `pr: 0`
  until the PR number exists. Invoke the pr-checklist skill before opening the PR.
- [ ] **Step 5: Full local gate** — from `frontend/`: `pnpm build` (tsc -b) · `pnpm lint` (0
  errors, ≤ 903 warnings) · `pnpm check:design-system:strict` · `pnpm dupes` (< 5 %, paste the
  number) · `pnpm tokens:check` · `pnpm deadcode` vs the clean-main baseline captured at
  `C:/Users/aaron/AppData/Local/Temp/xrp-d9a/knip-baseline-main.txt` (knip exits 1 always; diff
  the two outputs — expected delta: `LootEntryRow`/`WeekGroupHeader` entries GONE, nothing new) ·
  `pnpm test` (≥ 2943 → expect ≈ 2943 − 28 retired + ≈ 45 new; paste the count). Greps:
  `FLOOR_COLORS`, `textClass`, `admin/sortUtils`, `admin/SortableHeader`, `LootEntryRow`,
  `WeekGroupHeader`, `text-\[(7|8|9|10|11)px\]` → none in `frontend/src` (outside the frozen
  `history/` and `admin/` trees). `git diff --stat origin/main...HEAD --
  frontend/src/components/history/ frontend/src/components/admin/ frontend/src/components/ui/` →
  EMPTY.
- [ ] **Step 6: Commit** — `docs(v2): D9a write-backs — R-29/R-33/R-34/R-38/R-39/R-46 build notes, D9a/D9b rows, D-31 row, 2.1.23 note`

---

## Definition of done (slice level)

1. All task suites + the full local gate green (numbers pasted in the PR body).
2. **Live browser demonstration (`?shell=v2`, desktop, dark primary + light spot-check),
   evidence-first:**
   - **Sort, 14 checks, not self-fulfilling** (director F-13): for Player / Floor / Method /
     Slot / Type, **read the rendered column** top-to-bottom and assert monotonicity directly
     (A→Z then Z→A; tier order M9S→M12S then reversed; `Book < Drop < Purchase < Tome`; BiS → Extra
     → aug); for Week / Date, read the rendered `W{n}` / date cells and assert monotone. Use the
     API (`GET …/loot-log` + `…/material-log` for DEVTST) only for **row membership and count**
     (every API id appears exactly once in `tbody tr[id]`). Paste as a table.
   - The fixed tiebreak shown on a Player sort with a multi-entry player (newest first within the
     name run, both directions).
   - **Keyboard pass** (R-46's reason to exist): Tab from the toolbar into the header row, Enter
     on `Player` sorts, Space on `Week` sorts, `aria-sort` follows, and focus stays on the pressed
     header after the re-render.
   - The Floor chip's computed `color` equals
     `getComputedStyle(document.documentElement).getPropertyValue('--color-floor-N')` for its
     floor.
   - A weapon row shows the weapon's job in Slot and the recipient's in Player (seed one if
     DEVTST has none — log a DRG weapon to a non-DRG); a material row reads `aug {slot}`; a
     `universal_tomestone` row reads `aug tome wpn`.
   - Kebab Edit opens the picker in edit mode, Copy link copies `lview=history&entry=`, Delete
     confirms; a roster-card entry jump lands on History, pulses, self-clears in 2.5 s with
     `lview` intact.
   - Viewer role: one `Copy link` item, no Edit/Delete.
   - **Sticky:** scroll the element found by
     `document.querySelector('#main-content [class*="overflow-y-auto"]')` (the
     `GroupViewContent.tsx:711` div — NOT `window`, NOT `main`; if that selector returns null the
     check is inconclusive, not passed) and confirm the `thead` stays pinned.
   - **Horizontal clip** (D9a-n): at 1280 and 1024 px widths the ⋮ column is fully visible; note
     the width at which clipping begins.
   - The fresh static (`UGAAQQ`) shows the caption-bearing table with eight headers + the empty
     message; light theme: chip + icons legible.
3. **V1 safety, two-part:** (a) `git diff --stat` over `history/`, `admin/`, `ui/` EMPTY; (b)
   PR-body statement **in the Global-Constraints wording**: no file V1 renders is touched; the one
   `utils/` file edited is v2-only with its four importers named; `history/lootMethodDisplay.ts`
   imported for `label` only; `admin/SortableHeader`/`sortUtils` not imported (R-46); the deleted
   files' complete importer chains cited.
4. Screenshots embedded in the PR: `docs/redesign/pr-shots/d9a-*.png` → `python
   scripts/shrink-pr-shots.py docs/redesign/pr-shots/d9a-*.png` → WebP ≤ 120 KB each;
   `node scripts/check-pr-shots.mjs` clean. Viewport shots (the v2 pane defeats `fullPage`).
   Set: default (Week desc) · Player asc · Floor asc · weapon row close-up (R-38) · material aug
   row · kebab open · highlight pulse · viewer · sticky thead mid-scroll · 1024 px width · fresh-
   static empty · light theme.
5. `pnpm dupes` green with `history/` in scope (the re-expression discipline held).
6. Release note present (internal); design-record + slice-table + parity-matrix write-backs in
   the same PR; R-D9a-A…D recorded in this plan's vet record and the PR body; the PR opened under
   the mega-PR protocol with the three parts stated (Global Constraints, sizing).

## Out of scope (named so the ledger cannot drift)

R-29's week separators + current-week marker (rebuilt from the R-29 build note's git-ref
archaeology), R-34's stats count and filtered-vs-empty split, the `?entry=` highlight's *test*
under separators (**D9b**) · the search parser, pill dissolution, `Ctrl+Shift+F`,
R-30/R-36/R-37/R-47 (**D10**) · R-31 row click/modifier clicks/`tabIndex`/`role`, R-32's kebab
conversion to the two-trigger `ContextMenu` with right-click + "View week N in Log" + material Edit
+ `jumpMenuAnchor`, R-35 (**D11**) · R-18/R-28 jumps and gear-row anchors, `RosterCard.jumpToEntry`
retarget (**D12**) · `FairnessSummary` leaving History for Home (**D14**, R-40) ·
`admin/SortableHeader` migration (R-46 — admin's call) · mobile, including re-deciding the
sticky-vs-horizontal-scroll trade below 1024 px (Phase P) · polishing `aug body` to `aug Body`
(D9b's R-34 states pass, if wanted) · the standing phase-level queue (index.css aria-hidden
narrowing, Tooltip keyboard gap, `ui/Select` race, deadcode baseline chore, Modal focus-restore,
ContextMenu a11y interim, `fetchPageLedger` gating).
