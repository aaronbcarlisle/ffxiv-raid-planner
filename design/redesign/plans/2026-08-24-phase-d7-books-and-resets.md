# Phase D — Slice D7: Books Re-home + Every Bulk Reset — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Vet record:** `xivrp-director` plan-vet 2026-08-24 → **APPROVE-WITH-CHANGES** (3 blockers ·
5 major · 10 minor) — **all folded into this revision**: F-1 real-card test convention (Task 4),
F-2 three deletion-trace corrections (Tasks 1/2), F-3 `deletePlayerLedger` true-DELETE mechanism
split + `ResetConfirmModal:152` inherited-copy disclosure, F-4 sizing ≈2,250 bottom-up → the
D7a/D7b split is the default, F-5 D7-B trade-offs stated + test class 2 narrowed, F-6 new D7-F
toggle-label decision row, F-7 eslint containment pre-authorized on the three `onContextMenu`
targets, F-8 doc-drift sweep list, F-9–F-18 minors (line anchors, trace rationales, unused
Dropdown import, no-`week` jump variant, D7-C param-stranding argument, hardening write-back,
label/confirm vocabulary note, seam-note collapse).

**USER RULINGS (2026-08-24, all six on the recommendation):**
- **R-D7a · Two floor-kebab reset items** — `Reset {floorName} loot` + `Reset {floorName} books`
  (the legacy-parity trio with "Log floor"; no combined data item).
- **R-D7b · ContextMenu two-trigger pattern on all three surfaces** — the floor kebab converts off
  its D6b Radix `Dropdown`; the focus-restore/`aria-expanded`/scroll-close gaps ship as a named,
  disclosed interim beside the standing kebab-family a11y queue.
- **R-D7c · Card after the fairness block, ungated** — §4 mockup order; the fresh-static render is
  preserved and screenshotted; keeps the `?book=` self-clear reachable everywhere.
- **R-D7d · Week-named labels** — toolbar `Reset Week {N} loot/books/data`; column
  `Reset Floor {F} books (Week {N})`; row `Reset {playerName}'s Week {N} books`; all-time items
  keep the `Reset ALL …` shape; the floor-kebab pair stays week-less.
- **R-D7e · The toolbar trigger stays the labeled Reset button** — the mockup's `⋮` deviation
  named in the R-16 build note.
- **R-D7f · Scope-toggle label** — `This week (Week N)` when displayed = clock, `Week {N}` when
  diverged (the `WeekScopeControl.tsx:133-134` shape).
- **Split confirmed as the ruled default:** D7a = Tasks 1–3 (first build session), D7b =
  Tasks 4–6 (fresh session), Task 7 records split across both.

**Goal:** Re-home `BookLedgerCard` from the v2 History view to the v2 Log view on the **displayed**
week (R-14: displayed week, row + column kebabs, per-row `JobIcon` restored), build R-16's four
bulk-reset entry points with **real** floor/player scoping (today `Loot.tsx:746` destructures only
`{scope, target, week}` — a floor- or player-scoped config would delete everything), move
`LootResetMenu` to the Log toolbar bound to the displayed week, and retarget the roster `?book=`
jump from `lview=history` to `lview=log` — without touching a line V1 renders.

**Architecture:** One confirm gate, one handler, one new pure planner. Every entry point keeps the
shipped pattern: menu item → `setResetConfig(config)` → the single `ResetConfirmModal`
(type-RESET-to-confirm) → `handleResetConfirm`. D7 does **not** edit `ui/ResetConfirmModal.tsx` —
its `ResetConfig` type already carries `floor`/`playerId`/`playerName` and `getResetDescription`
already renders correct copy for every config this slice emits (D0/R-44 built those branches
against V1's own emitters). The scoping logic legacy implements inline
(`SectionedLogView.tsx:450-538`, frozen reference) is **re-expressed** as a pure, unit-testable
planner (`loot/resetActions.ts`) that `handleResetConfirm` consumes — structurally different from
legacy's branch tree (jscpd) and independently deletion-traceable. The three new kebab surfaces
(floor header, Books column, Books row) follow the D6a cell precedent — **one items list, two
triggers** (kebab `IconButton` + `onContextMenu`), anchored via `jumpMenuAnchor` into `ui/ContextMenu`
— which satisfies R-16's "Right-click opens the same menu; the kebab is the keyboard and AT route."
`BookLedgerCard` re-homes with its internals intact: its `?book=` consumption effect has no lview
gate of its own, so re-mounting it under Log makes the retargeted jump land with zero consumer
changes; its scope toggle, `adjustBookBalance` write, and `MarkFloorClearedModal` default all key
off the `currentWeek` prop, so feeding `logWeek.week` re-points all three at once (that is R-14
delta 1's substance, not a side effect).

**Tech Stack:** React 19 + TypeScript, `ui/ContextMenu` + `jumpMenuAnchor`
(`components/roster/rosterLedgerJumps.ts:75`), Radix `primitives/Dropdown` (toolbar menu only),
`ui/ResetConfirmModal` (consumed, not edited), Zustand `lootTrackingStore`, Vitest + RTL.

**Spec:** `design/redesign/specs/phase-d-loot-design.md` — R-14 (:388-410), R-16 (:427-450),
R-22 boundary (:658-676), R-25 build note (:743-759, "D7 adds this floor's resets to this same
menu"), §4 mockup (:846-875), R-34 History loses both (:1105-1112), R-28 books-half-only (:835-842).
Slice row: `design/redesign/specs/phase-d-loot-plan.md` :40 (§1), :193 (§3 D7), sizing :266-267.
Parity rows to rewrite with the build: `design/redesign/specs/v1-v2-parity-matrix.md` D-38 (:264),
D-39 (:265). Predecessor record: `design/redesign/plans/2026-08-23-phase-d6-grid-affordances.md`.

> ⚠ Two rulings share the name "R-14": the parity matrix's V2R-14 is the roster kebab (unrelated).
> Every R-14 cite in this plan means `phase-d-loot-design.md:388`.

---

## Global Constraints

- **V1 safety — this slice touches NO shared file.** Verified against main @ `1f47c336`:
  `ui/ResetConfirmModal.tsx` is shared (V1 chain: `GroupViewContent.tsx:40` → `HistoryView.tsx:17`
  → `SectionedLogView.tsx:17` → `LootLogModals.tsx:20`) and is **not edited** — every config D7
  emits already renders correct description copy (verified: floor branch
  `ResetConfirmModal.tsx:64-73`, playerName branch `:54-59`). `LootResetMenu.tsx` has exactly ONE
  importer repo-wide (`Loot.tsx:154`) — v2-only, freely editable. `RosterCard.tsx` is v2-only
  (`RosterCard` ← `RosterCards.tsx` ← `Roster.tsx` ← `NewShell.tsx`; V1's card is elsewhere — the
  same chain D6's PR body cited). `Loot.tsx`, `LogWeekGrid.tsx`, `BookLedgerCard.tsx`,
  `loot/resetActions.ts` (new) are v2-only. **`history/` files are imported, never edited** —
  `git diff --stat` over `frontend/src/components/history/` must be empty in the final diff. The
  PR body carries the phase-DoD-3(b) statement: "no §2.1 file touched," with the file list.
- **The R-16 entry-point table is binding and closed:** toolbar kebab = week / all-time ×
  loot / books / data; floor-header kebab = that floor's loot and books for the **displayed** week;
  Books **column** kebab = Floor N books, week-or-all **following the card's own scope toggle**;
  Books **row** kebab = that player's books, same toggle. Right-click opens the same menu; the
  kebab is the keyboard/AT route. History keeps only its per-entry kebab (R-34). Do not add entry
  points, do not drop any.
- **The R-22 boundary stays intact:** Revert and Start-next-week remain **clock**-bound with the
  divergence notice (`WeekScopeControl.tsx:138-139` — untouched by this slice). Only the reset
  family and the books card follow the displayed week. A test may not "fix" this asymmetry.
- **Green-commit hook:** `.claude/hooks/pre_bash_guard.py` runs whole-project `tsc -b` on any
  commit with staged frontend TS. New required props land in the same commit as their wiring
  (Task 3 and Task 5 each add props + wiring + tests in one commit, the D6 precedent).
- **Deletion-trace discipline:** implementers prove load-bearing assertions by EXECUTING the
  mutation (delete the branch/guard, run the test, paste the verbatim failure output, restore) —
  never by argument. **Drive the displayed week apart from the clock week in every test where both
  exist** (seed clock at 3, drive Log to `?week=1`, assert on 1 AND `not.toBe(3)` — the
  `Loot.test.tsx:1272` idiom). The named traps for this slice: (a) week-binding assertions that
  pass because `logWeek.week === clock.currentWeek` by default; (b) a floor filter whose test
  seeds only one floor (deleting the filter still passes); (c) playerId-precedence tests that pass
  under any branch order because only one branch's inputs are seeded.
- **jscpd (blocking CI, `frontend/.jscpd.json`: threshold 5%, minLines 5, minTokens 50, and
  `components/history/` IS in scope):** the planner, the toast helper, and all three menu builders
  are **re-expressions** of `SectionedLogView.tsx:450-538` / `:404-447` and
  `WeeklyLootGrid.tsx:113-153` — same semantics, different structure (pure function + discriminated
  union vs inline branch tree; follow-the-toggle builders vs legacy's callbacks). Run `pnpm dupes`
  locally before the PR.
- **aria-hidden hazard (`index.css` ~:239):** any decorative `aria-hidden` element relying on
  flex/grid carries `role="presentation"`. The new `JobIcon` sits inside a
  `flex items-center gap-1.5` div (the legacy row shape, `SectionedLogView.tsx:1410-1415`) — if
  `JobIcon` renders aria-hidden flex internals, the existing sweep-test pattern
  (`LogWeekGrid.test.tsx`) is the reference; add the equivalent assertion to
  `BookLedgerCard.test.tsx` if the DOM warrants it.
- **eslint `a11yRecommendedWarn` hazard (§5 row, `phase-d-loot-plan.md:250` — director F-7):**
  the three new `onContextMenu` targets are non-interactive elements (floor-header `<div>`, Books
  `<th>`, Books `<tr>`) — the flipped-on `jsx-a11y` static/noninteractive-interaction rules will
  warn. The sanctioned containment is a one-line targeted `eslint-disable` WITH reason at each
  site (the D5 corner-`<td>` precedent, `LogWeekGrid.tsx:246`); the shared `eslint.config.js` is
  NEVER edited in this slice. Reason text: the kebab is the interactive route; `onContextMenu` on
  the container is a pointer-convenience duplicate of it.
- **12px floor:** all new menu labels and card copy are `text-xs`+ (menu primitives already
  comply). No `text-[7-11px]`.
- **Vocabulary:** "static," never "group," in all new user-facing copy. Player names and floor
  names in labels are data, not vocabulary.
- **Release note:** `internal: true`, `CURRENT_VERSION` untouched (v2 admin-gated dark). `pr: 0`
  backfilled at PR open; **`prTitle` = the PR title, not a commit subject** (two bots flagged this
  on #245). Invoke the pr-checklist skill before opening the PR.
- **Sizing (director-corrected, F-4): the split IS the default.** Bottom-up against the real
  files ≈**1,530** changed lines before the plan document, ≈**2,250** with it (the plan file lands
  in the PR, the D6 precedent — `2026-08-23-phase-d6-grid-affordances.md` landed 726 lines in
  `a96f36cc`). One PR busts the 1,500 budget; the phase plan already called D7 its most under-sized
  row (`phase-d-loot-plan.md:266-267`). **Two PRs on the named seam:** **D7a** = Tasks 1–3
  (planner + toolbar menu on Log + floor-kebab resets — self-contained, demo-able; the
  intermediate state is coherent: History has lost the reset menu, the card stays on History at
  `clock.currentWeek` until D7b) · **D7b** = Tasks 4–6 (card re-home + card kebabs + `?book=`
  retarget), fresh session per the slice cadence. Task 7's records split across both: each PR
  carries its own build notes + internal release note; the D-38 parity rewrite lands with D7b,
  D-39's with D7b too (the fourth entry point completes there). The planner's `player-*` branches
  sit unexercised through D7a — internal, not knip-visible. A single PR is the exception and
  needs the user's explicit call.
- **Test-edit discipline:** existing tests may change ONLY in these sanctioned classes, each named
  where it happens: (1) **the History→Log re-home class** — `Loot.test.tsx`'s reset-menu
  visibility/flow tests (`:773`, `:789`, `:930`) re-driven on Log with displayed ≠ clock, plus any
  assertion that pins `BookLedgerCard` or `LootResetMenu` to the History branch; (2) **the floor-
  kebab mechanism class (director-narrowed, F-5)** — ONLY `LogWeekGrid.test.tsx:936-947` (the
  one test using the Radix keyDown-Enter idiom) is rewritten to the `ui/ContextMenu`
  open-on-click idiom; `:924-934` (aria-label queries) and `:949-955` (read-only zero-buttons)
  are REQUIRED to pass unchanged through the conversion; (3) **the required-prop class** —
  `baseProps()`/render-helper extensions where Tasks 3/5 add required props; (4)
  `RosterCard.test.tsx:1453`'s `lview` assertion (`'history'` → `'log'`; `:1454` is the `book`
  assert — director F-9). Anything else needs its
  own justification in the task report.

---

## Decisions in this plan

Rows marked **OPEN** are user rulings (the Phase-D co-design rule); rows marked *Director vets*
are plan-level calls the vet pass checks.

| # | Decision | Status |
|---|---|---|
| **D7-A** | **Floor kebab: two reset items or one?** R-16's row reads "that floor's loot and books, for the displayed week" — ambiguous between two items and one combined `target:'data'` action. Legacy's floor context menu (`WeeklyLootGrid.tsx:113-153`, frozen reference) offers **two**: `Log Floor Loot` · separator · `Reset {floorName} Loot` (danger) · `Reset {floorName} Books` (danger). **Options:** (1) **two items** — exact D-39-family parity, finer control (books misticks are common and shouldn't cost the floor's loot), and the confirm copy stays precise ("loot entries for Floor 2 in Week 3" vs "book entries for…"); (2) one combined item emitting `{scope:'floor', target:'data', week, floor}` — shorter menu, blunter blast radius ("all data for Floor 2 in Week 3"). **Recommendation: (1) two items.** The planner handles `data`+floor anyway (defensive), so (2) remains reachable later without rework. | **RULED 2026-08-24 — on the recommendation; see R-D7a–f in the vet record** |
| **D7-B** | **Right-click mechanism.** R-16: "Right-click opens the same menu; the kebab is the keyboard and AT route" — covering the three surface-attached entry points (floor header, Books column, Books row; the toolbar entry is a standing dropdown button with nothing to right-click). **Director-verified facts to rule with (F-5):** legacy's books column/row menus are **right-click only** (`SectionedLogView.tsx:1384`, `:1408` — no kebab anywhere), so R-16's kebab is a NEW a11y capability, not a restore — the strongest argument against degrading it. Two menu mechanisms already coexist on the shipped grid (the `×N` chip is a Radix `Dropdown`, `LogCellEntriesMenu.tsx:73-99`; the cell menu is `ui/ContextMenu`, `LogWeekGrid.tsx:742-749`) — "two mechanisms in one family" is the status quo, not a novel cost. And the conversion has a real (small) a11y cost: `ui/ContextMenu` brings `role="menu"`, arrow/Home/End/Escape and focus-first (`ContextMenu.tsx:99-122`, `:150-162`) but **no focus restoration on close, no `aria-expanded` on the trigger, and it closes on any scroll** (`:138`) — all three of which the shipped Radix kebab has. Radix DropdownMenu has no cursor-anchored part, so there is no clean single-Radix route. **Options:** (1) **the D6a cell pattern on all three** — one items builder, one `ContextMenu`, two triggers (kebab click + `onContextMenu`), `jumpMenuAnchor` anchoring; the floor-header kebab **converts** from its D6b Radix `Dropdown` (same trigger button, same aria-label, same "Log floor" item — R-25's "the kebab is the intended home" holds), rewriting ONLY `LogWeekGrid.test.tsx:936-947` (class 2, director-narrowed); the focus-restore/aria-expanded gaps are disclosed as a named interim beside the standing kebab-family a11y queue; (2) kebab-only everywhere (keep/add Radix) — **no right-click**, contradicting R-16's ruled sentence; requires an explicit ruling amendment; (3) hybrid — books surfaces get pattern (1), the floor kebab keeps its shipped Radix and gains no right-click — preserves the shipped control's semantics but leaves one of the three surfaces without the ruled right-click. **Recommendation: (1), trade named.** | **RULED 2026-08-24 — on the recommendation; see R-D7a–f in the vet record** |
| **D7-C** | **Books card position + gating on Log.** §4 mockup order is grid → count bar → legend → **Books** (`phase-d-loot-design.md:846-875`). **Options:** (1) **sibling directly after the fairness wrapper, ungated** — renders exactly as it does on History today, including on a fresh/unconfigured static (header + scope toggle + Mark-floor-cleared + empty table; the fairness block above it stays gated on `mainRosterPlayers.length > 0` per PR #245 r3); (2) share the fairness block's `mainRosterPlayers.length > 0` gate — hides the card on fresh statics, but invents an emptiness rule the card never had on History and hides the Mark-floor-cleared door with it. **Decisive parity argument (director F-15):** under (2), a `?book=` jump landing on a fresh static finds no card — and the param's self-clear lives INSIDE the card (`BookLedgerCard.tsx:140-149`), so `book=` would never clear and would ride into every subsequently copied deep link — the exact failure class C7's review already fixed once. (1) is the only option that keeps the jump self-cleaning everywhere. **Recommendation: (1)** — placement per mockup, no new gate; the browser pass screenshots the fresh-static state so the call is made on evidence. | **RULED 2026-08-24 — on the recommendation; see R-D7a–f in the vet record** |
| **D7-D** | **Label policy for the reset menu family.** The displayed week is steppable — that is the point of R-16's displayed-week binding — so week-scoped items can name the week they act on (the R-22 principle, applied to menus). **Options:** (1) **week-scoped items name the week**: toolbar `Reset Week {N} loot/books/data` (today: "Reset week loot"); floor `Reset {floorName} loot` + `Reset {floorName} books` *(week named by the confirm — the menu already sits under a header reading `Week {N}`… see note)*; column `Reset Floor {F} books (Week {N})`; row `Reset {playerName}'s Week {N} books`; all-time items keep the `Reset ALL …` shape (`Reset ALL loot`, `Reset ALL Floor {F} books`, `Reset ALL {playerName}'s books`); (2) terse legacy-shaped labels everywhere ("Reset week loot", "Reset Floor 2 Books", "Reset {name}'s W3 Books") with the type-RESET confirm as the sole naming authority. **Two facts to rule with (director F-17, F-3):** (i) the frozen confirm names floors by NUMBER ("loot entries for Floor 2 in Week 3", `ResetConfirmModal.tsx:70`) and cannot echo a duty-name label like "Reset M10S loot" — menu label and confirm copy will differ in that one respect under either option (the shared modal is not editable); (ii) the row kebab's two items differ in MECHANISM — the all-time item is a true backend delete that erases the player's ledger rows, while the week item writes compensating adjustment rows that stay visible in the player's ledger modal — if that asymmetry should surface in any user-visible copy, this label ruling is the place to say so (the R-16 build note discloses it regardless). **Recommendation: (1)**, with the floor-kebab pair left week-less (the grid section header directly above the menu already names the week context, and the confirm restates "…for Floor 2 in Week 3" before anything executes). | **RULED 2026-08-24 — on the recommendation; see R-D7a–f in the vet record** |
| **D7-E** | **Toolbar trigger: labeled button or bare kebab?** The shipped `LootResetMenu` trigger is a ghost `Button` labeled **Reset** with a `RotateCcw` icon (`LootResetMenu.tsx:26+`); the §4 mockup draws the toolbar entry as a bare `⋮` (`phase-d-loot-design.md:854`). **Options:** (1) **keep the labeled Reset button** — a destructive menu benefits from a named trigger, the mockup's `⋮` reads as shorthand for "the R-16 menu lives here," and R-16's "toolbar kebab" names the entry point, not the glyph; (2) convert to a `MoreVertical` kebab `IconButton` for mockup fidelity — quieter, but hides a destructive family behind an unnamed control. **Recommendation: (1) keep the labeled button**, recorded as a named mockup deviation in the R-16 build note. | **RULED 2026-08-24 — on the recommendation; see R-D7a–f in the vet record** |
| **D7-F** | **The Books card scope-toggle label under a steppable week (director F-6 — a silent decision, now surfaced).** The toggle reads `This week` (`BookLedgerCard.tsx:168`) and after the re-home "this week" means the DISPLAYED week — clock at 3, Log stepped to 1: a control labelled "This week" shows and writes **week 1**. The R-22/D7-D honesty principle applies. **Options:** (1) label the option `This week (Week N)` when displayed = clock and `Week {N}` when diverged — mirroring `WeekScopeControl`'s own shape (`WeekScopeControl.tsx:133-134`); (2) always `Week {N}`; (3) keep `This week` as-is (the grid and week pill above already establish which week the surface is on). v2-only copy — `BookLedgerCard` has a single importer (`Loot.tsx:156`). **Recommendation: (1)** — honest when diverged, familiar when not, and the exact pattern the adjacent control already uses. | **RULED 2026-08-24 — on the recommendation; see R-D7a–f in the vet record** |
| D7-e | **`handleResetConfirm` is re-expressed around a pure planner** (`loot/resetActions.ts` — `resolveResetActions(config, {lootLog, materialLog, floors})` returning `{lootEntries, materialEntries, bookOp}` with `bookOp` a discriminated union). Rationale: the scope matrix is the slice's real risk surface ("wiping everything" is the bug R-16 names); a pure function makes every branch unit-testable and deletion-traceable without the modal, and its shape is structurally distinct from frozen `SectionedLogView.tsx:450-538` (jscpd). Legacy's **playerId-before-floor precedence** is preserved exactly. One deliberate hardening over legacy: legacy's loot branch with `scope:'floor'` and **no** week falls through to *unfiltered* (would delete everything); the planner filters by floor-across-all-weeks instead. No UI emits that config — hardening, not a parity delta. | Director vets |
| D7-f | **Feeding `logWeek.week` into `BookLedgerCard.currentWeek` deliberately re-points three things at once:** the scope-toggle's "This week" fetch (`BookLedgerCard.tsx:82`), `adjustBookBalance`'s week-of-record (`:249-257`), and `MarkFloorClearedModal`'s default week (`:294`). That is R-14 delta 1's stated substance ("It writes with the week it is given… backfilling week 3 would otherwise credit books to the current lockout"), not an accident — asserted by tests that drive displayed ≠ clock. | Director vets |
| D7-g | **Kebab permission gate = `canEdit` only** (Owner/Lead), matching legacy (`SectionedLogView.tsx:405`, `:428` both bail on `!canEdit`). The member-own-row exception (`BookLedgerCard.tsx:195`) keeps granting cell *editing* only — members do not get their own row's bulk-reset kebab, same as legacy. Read-only viewers: no kebabs, no context menus (the D6 floor-kebab and D6-l precedent). | Director vets |
| D7-h | **Books column/row kebabs emit ONE follow-the-toggle item, never both scopes** — R-16's own text ("following the card's own scope toggle") and legacy's semantics exactly, re-expressed (reference: `SectionedLogView.tsx:410-423`, `:433-446` — `bookViewMode` read in the builder; label and config flip together; never transcribed, per the jscpd constraint — director F-12). The card's toggle default stays `'all'` (shipped v2 behavior, `BookLedgerCard.tsx:76`; R-14 is silent on it). All reset items are `danger` (legacy marks even week-scoped ones danger). | Director vets |
| D7-i | **The card keeps its raw-`players` feed.** Its rows come from `pageBalances` filtered by `!isSubstitute` (`BookLedgerCard.tsx:104`), not from the players array — the D6b `mainRosterPlayers` lesson targeted components that *render* raw seats; this card renders backend balance rows and only uses `players` for lookups (userId, isSubstitute, and now job). No filtering change in this slice; parity with its History self. | Director vets |
| D7-j | **`?book=` retarget is one line + one assertion + one new integration test.** Writer: `RosterCard.tsx:304` (`'history'` → `'log'`). The consumer effect is component-local with no lview gate (`BookLedgerCard.tsx:114-154`) — re-homing the mount is what makes the jump land; the effect's `rows.length` dependency already self-heals the fetch-then-scroll race. `buildEntryLink`'s and `jumpToRecipient`'s `book`-stripping (`Loot.tsx:225`, `:568`) are orthogonal (they only ever delete the param) and their tests stand unchanged. R-28's loot/material jump halves stay `lview=history` — that is **D12**, restated in Out of scope. | Director vets |
| D7-k | **Toasts stay honest for the new scopes** via `describeResetToast(config)` beside the planner: the two existing shapes are preserved verbatim (`Reset Week {N} {target} complete`, `Reset all {target} complete`) and the new scopes get `Reset Floor {F} {target} for Week {N} complete`, `Reset Floor {F} {target} complete` (all-time), `Reset {name}'s Week {N} books complete`, `Reset {name}'s books complete`. | Director vets |

---

## File map

| File | Change |
|---|---|
| `frontend/src/components/loot/resetActions.ts` | **Create** — `resolveResetActions` + `describeResetToast` |
| `frontend/src/components/loot/resetActions.test.ts` | **Create** — the scope-matrix unit suite |
| `frontend/src/components/loot/Loot.tsx` | `handleResetConfirm` rewrite; `resetMenu` slot moves to Log on `logWeek.week`; `BookLedgerCard` re-home + new props; floor-reset wiring; header-comment rewrite |
| `frontend/src/components/loot/LootResetMenu.tsx` | Docblock + `week`-prop doc corrected (v2-only file); D7-D labels if ruled |
| `frontend/src/components/loot/LogWeekGrid.tsx` | Floor-header menu → ContextMenu two-trigger pattern; `onResetFloorLoot`/`onResetFloorBooks` (required) |
| `frontend/src/components/loot/BookLedgerCard.tsx` | Per-row `JobIcon`; column/row kebabs + right-click; `onResetConfig` (required) |
| `frontend/src/components/roster/RosterCard.tsx` | `handleBooksJump` writes `lview=log` (one line) |
| Tests | `Loot.test.tsx` (sanctioned class 1 + new integration), `LogWeekGrid.test.tsx` (class 2 + new), `BookLedgerCard.test.tsx` (class 3 + new), `RosterCard.test.tsx` (class 4) |
| Docs | `phase-d-loot-design.md` build notes (R-14, R-16, R-25 update), `v1-v2-parity-matrix.md` D-38/D-39 rewrites, `releaseNotes.ts` internal entry |

Dependencies: Task 2 needs Task 1 · Task 3 needs Task 2 · Task 5 needs Tasks 2+4 · Task 6 needs
Task 4 · Task 7 last. Tasks 1→7 execute in order.

---

### Task 1: The reset planner — `loot/resetActions.ts`

**Files:**
- Create: `frontend/src/components/loot/resetActions.ts`
- Create: `frontend/src/components/loot/resetActions.test.ts`

**Interfaces:**
- Consumes: `ResetConfig` from `../ui/ResetConfirmModal` (type-only import; the file is NOT edited),
  `LootLogEntry`/`MaterialLogEntry` from `../../types`.
- Produces (Task 2 relies on these exact names):
  ```ts
  export type BookResetOp =
    | { kind: 'none' }
    | { kind: 'player-all'; playerId: string }
    | { kind: 'player-week'; playerId: string; week: number }
    | { kind: 'floor-all'; floor: number }
    | { kind: 'floor-week'; floor: number; week: number }
    | { kind: 'week'; week: number }
    | { kind: 'all' };
  export interface ResetActionPlan {
    lootEntries: LootLogEntry[];
    materialEntries: MaterialLogEntry[];
    bookOp: BookResetOp;
  }
  export function resolveResetActions(
    config: ResetConfig,
    input: { lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; floors: string[] },
  ): ResetActionPlan;
  export function describeResetToast(config: ResetConfig): string;
  ```

- [ ] **Step 1: Write the failing unit suite** (`resetActions.test.ts`). Fixtures MUST spread
  entries across ≥2 floors and ≥2 weeks so every filter is load-bearing (trap (b) in Global
  Constraints). Core cases (one `it` each):

  ```ts
  import { describe, expect, it } from 'vitest';
  import { resolveResetActions, describeResetToast } from './resetActions';
  import type { LootLogEntry, MaterialLogEntry } from '../../types';

  const FLOORS = ['M9S', 'M10S', 'M11S', 'M12S'];
  const loot = (id: number, weekNumber: number, floor: string): LootLogEntry =>
    ({ id, weekNumber, floor } as LootLogEntry);
  const mat = (id: number, weekNumber: number, floor: string): MaterialLogEntry =>
    ({ id, weekNumber, floor } as MaterialLogEntry);
  const LOOT = [loot(1, 1, 'M9S'), loot(2, 1, 'M10S'), loot(3, 3, 'M9S'), loot(4, 3, 'M12S')];
  const MATS = [mat(11, 1, 'M10S'), mat(12, 3, 'M10S'), mat(13, 3, 'M9S')];
  const INPUT = { lootLog: LOOT, materialLog: MATS, floors: FLOORS };

  // scope matrix — loot/material halves
  it('week+loot selects exactly that week, all floors', () => {
    const p = resolveResetActions({ scope: 'week', target: 'loot', week: 1 }, INPUT);
    expect(p.lootEntries.map((e) => e.id)).toEqual([1, 2]);
    expect(p.materialEntries.map((e) => e.id)).toEqual([11]);
    expect(p.bookOp).toEqual({ kind: 'none' });
  });
  it('floor+week+loot selects exactly that floor AND that week', () => {
    const p = resolveResetActions({ scope: 'floor', target: 'loot', week: 3, floor: 1 }, INPUT);
    expect(p.lootEntries.map((e) => e.id)).toEqual([3]);   // NOT 1 (week 1), NOT 4 (M12S)
    expect(p.materialEntries.map((e) => e.id)).toEqual([13]);
  });
  it('all+loot selects everything, books untouched', () => { /* ids [1,2,3,4] + [11,12,13], bookOp none */ });
  it('floor WITHOUT week filters by floor across all weeks — never falls through to everything (legacy-hardening)', () => {
    const p = resolveResetActions({ scope: 'floor', target: 'loot', floor: 1 }, INPUT);
    expect(p.lootEntries.map((e) => e.id)).toEqual([1, 3]);
  });
  it('an out-of-range floor selects nothing (fails closed)', () => {
    const p = resolveResetActions({ scope: 'floor', target: 'loot', week: 3, floor: 9 }, INPUT);
    expect(p.lootEntries).toEqual([]);
    expect(p.materialEntries).toEqual([]);
  });
  // books op routing — legacy precedence: playerId FIRST, then floor, then week, then all
  it('books week → {kind:week}', () => { /* {scope:'week',target:'books',week:3} → {kind:'week',week:3}, lootEntries [] */ });
  it('books all → {kind:all}', () => { /* … */ });
  it('books floor+week → {kind:floor-week}', () => { /* {scope:'floor',target:'books',week:3,floor:2} */ });
  it('books floor all-time → {kind:floor-all}', () => { /* {scope:'floor',target:'books',floor:2} */ });
  it('books player+week → {kind:player-week} — playerId wins over scope (precedence trace target)', () => {
    const p = resolveResetActions(
      { scope: 'week', target: 'books', week: 3, playerId: 'p1', playerName: 'Tank One' }, INPUT);
    expect(p.bookOp).toEqual({ kind: 'player-week', playerId: 'p1', week: 3 });
  });
  it('books player all-time → {kind:player-all}', () => { /* {scope:'all',target:'books',playerId:'p1',playerName:'Tank One'} */ });
  it('data+floor+week scopes BOTH halves to the floor+week', () => { /* loot ids [3]+[13] AND bookOp {kind:'floor-week'} */ });
  // toasts
  it('describeResetToast keeps the two shipped shapes verbatim and names the new scopes', () => {
    expect(describeResetToast({ scope: 'week', target: 'loot', week: 3 })).toBe('Reset Week 3 loot complete');
    expect(describeResetToast({ scope: 'all', target: 'books' })).toBe('Reset all books complete');
    expect(describeResetToast({ scope: 'floor', target: 'books', week: 3, floor: 2 })).toBe('Reset Floor 2 books for Week 3 complete');
    expect(describeResetToast({ scope: 'floor', target: 'books', floor: 2 })).toBe('Reset Floor 2 books complete');
    expect(describeResetToast({ scope: 'week', target: 'books', week: 3, playerId: 'p1', playerName: 'Tank One' })).toBe("Reset Tank One's Week 3 books complete");
    expect(describeResetToast({ scope: 'all', target: 'books', playerId: 'p1', playerName: 'Tank One' })).toBe("Reset Tank One's books complete");
  });
  ```

- [ ] **Step 2: Run to verify RED** — `pnpm -C frontend test resetActions` → module not found.
- [ ] **Step 3: Implement** (`resetActions.ts`):

  ```ts
  /**
   * D7 (R-16): the one place a ResetConfig's blast radius is computed.
   * Re-expresses the frozen legacy semantics (SectionedLogView.tsx:450-538 —
   * reference, not a dependency) as a pure planner so every scope combination
   * is unit-provable before anything destructive runs. Book-op precedence is
   * legacy's exactly: playerId beats floor beats week beats all. One deliberate
   * hardening: a floor-scoped loot config with no week filters by floor across
   * all weeks (legacy fell through to EVERYTHING); no UI emits that config.
   */
  import type { ResetConfig } from '../ui/ResetConfirmModal';
  import type { LootLogEntry, MaterialLogEntry } from '../../types';

  export type BookResetOp = /* union as in Interfaces above */;
  export interface ResetActionPlan { /* as above */ }

  export function resolveResetActions(config, input): ResetActionPlan {
    const { scope, target, week, floor, playerId } = config;
    const wantsLoot = target === 'loot' || target === 'data';
    const wantsBooks = target === 'books' || target === 'data';

    let lootEntries: LootLogEntry[] = [];
    let materialEntries: MaterialLogEntry[] = [];
    if (wantsLoot) {
      // Floor numbers map to tier floor NAMES ('M9S'…) — entries carry the name.
      const floorName = scope === 'floor' && floor != null ? input.floors[floor - 1] : null;
      const matches = (e: { weekNumber: number; floor: string }) => {
        if (scope === 'floor' && floorName == null) return false; // out-of-range floor: fail closed
        if (floorName != null && e.floor !== floorName) return false;
        if (scope !== 'all' && week != null && e.weekNumber !== week) return false;
        return true;
      };
      lootEntries = input.lootLog.filter(matches);
      materialEntries = input.materialLog.filter(matches);
    }

    let bookOp: BookResetOp = { kind: 'none' };
    if (wantsBooks) {
      if (playerId && week == null) bookOp = { kind: 'player-all', playerId };
      else if (playerId && week != null) bookOp = { kind: 'player-week', playerId, week };
      else if (scope === 'floor' && floor != null && week == null) bookOp = { kind: 'floor-all', floor };
      else if (scope === 'floor' && floor != null && week != null) bookOp = { kind: 'floor-week', floor, week };
      else if (scope === 'week' && week != null) bookOp = { kind: 'week', week };
      else bookOp = { kind: 'all' };
    }
    return { lootEntries, materialEntries, bookOp };
  }

  export function describeResetToast(config: ResetConfig): string { /* the six shapes from Step 1 */ }
  ```

- [ ] **Step 4: GREEN** — full suite for the file passes.
- [ ] **Step 5: Deletion traces (execute + paste; director-corrected F-2):** (a) delete the
  `e.floor !== floorName` clause → the floor+week test fails with ids `[3, 4]` where `[3]` was
  expected (the week filter still removes week-1 entries — if you see `[3, 4]`, that IS the trace;
  do not "correct" the test); (b) move the two `playerId` branches BELOW the `scope === 'week'`
  branch → the player-week precedence test fails (`{kind:'week'}` where `{kind:'player-week'}` was
  expected). Swapping them below only the floor branches is NOT a valid trace — those branches
  require `scope === 'floor'` and skip, so that mutation stays green; (c) change
  `input.floors[floor - 1]` to `input.floors[floor]` → the floor tests fail; (d) route player
  configs through the generic `Week {N}`/`all` template inside `describeResetToast` → the two
  player-toast assertions fail. Restore each.
- [ ] **Step 6: Commit** — `feat(v2): D7 reset planner — floor/player scoping as a pure unit (R-16)`

---

### Task 2: `handleResetConfirm` honors every scope; the toolbar menu moves to Log on the displayed week

**Files:**
- Modify: `frontend/src/components/loot/Loot.tsx` (handler ~:744-782; `resetMenu` slot ~:868-872;
  the `740-743` comment above the handler)
- Modify: `frontend/src/components/loot/LootResetMenu.tsx` (docblock :2-7; `week` prop doc :21;
  D7-D labels if ruled)
- Test: `frontend/src/components/loot/Loot.test.tsx`

**Interfaces:**
- Consumes: Task 1's `resolveResetActions`/`describeResetToast`; store methods
  `clearAllPageLedger`, `clearWeekPageLedger`, `clearFloorPageLedger(groupId, tierId, week, floor)`
  (note the week-before-floor order, `lootTrackingStore.ts:549`), `clearAllFloorPageLedger`,
  `clearPlayerWeekPageLedger`, `deletePlayerLedger` (all exist — with two DIFFERENT mechanisms,
  director-verified F-3: the three `clear*` floor/player methods are reversal-POST shims netting
  balances to zero via compensating `adjustment` rows (`lootTrackingStore.ts:549-612`, `:614-681`,
  `:683+`), while **`deletePlayerLedger` is a TRUE backend DELETE** (`:495-505`). The row kebab's
  two items therefore differ in destructiveness semantics — all-time erases the player's ledger
  rows; week-scoped leaves the originals plus visible compensating adjustments in
  `PlayerLedgerModal`. Both facts land in the R-16 build note and the PR body; never describe the
  set as uniform backend bulk deletes).
- Produces: a `handleResetConfirm` that safely executes any `ResetConfig` Tasks 3/5 emit.

- [ ] **Step 1: Failing tests** (Loot.test.tsx — new describes at the end; sanctioned class 1 for
  the moved ones). All drive **Log** with displayed ≠ clock (clock seeded 3 in `beforeEach`,
  render with `['/?lview=log&week=1']`):
  - *(class 1 rewrite)* "shows the Reset menu on the Log view for editors — not on History, not on
    Priority, not for viewers": renders three times; `Reset` trigger present only on Log+canEdit.
  - *(class 1 rewrite)* "reset week loot on Log deletes exactly the DISPLAYED week's entries":
    seed loot weeks 1/1/3 — open Reset (Radix keyDown-Enter idiom, the menu is still a Radix
    Dropdown), item "Reset week loot" (or D7-D label), type RESET, confirm → delete mock called
    exactly for the two week-1 entries, `not` for week-3; assert the config's week is 1 AND
    `not.toBe(3)`.
  - Floor-scoped configs are NOT integration-tested in this task — no real door emits one until
    Task 3's kebab, and a synthetic test-only trigger is forbidden. Task 1's units pin the floor
    scoping; Task 3 Step 1 integration-tests it through the real kebab (director F-18: this seam
    is deliberate). This task pins the handler's book-op routing through the toolbar's REAL books
    items (next bullet).
  - "reset week books on Log routes to clearWeekPageLedger with the DISPLAYED week": toolbar →
    "Reset week books" → confirm → `clearWeekPageLedger('g1','t1',1)` (stubbed via
    `useLootTrackingStore.setState`), and `fetchPageLedger` called after.
  - "Reset ALL data still deletes both weeks and clears the full ledger" *(class 1 rewrite of
    `:930`, now driven from Log)*.
- [ ] **Step 2: RED** — the visibility test fails (menu still History-gated).
- [ ] **Step 3: Implement.**
  - `Loot.tsx` handler (full replacement of :744-782, keeping the useCallback shape and deps
    `[resetConfig, groupId, tierId, floors, refresh, fetchPageLedger]`):

    ```ts
    const handleResetConfirm = useCallback(async () => {
      if (!resetConfig || !tierId) return;
      const {
        clearAllPageLedger, clearWeekPageLedger, clearFloorPageLedger,
        clearAllFloorPageLedger, clearPlayerWeekPageLedger, deletePlayerLedger,
      } = useLootTrackingStore.getState();
      try {
        // Read fresh from the store at confirm-time (legacy parity), then plan.
        const plan = resolveResetActions(resetConfig, {
          lootLog: useLootTrackingStore.getState().lootLog,
          materialLog: useLootTrackingStore.getState().materialLog,
          floors,
        });
        for (const entry of plan.lootEntries) {
          await deleteLootAndRevertGear(groupId, tierId, entry.id, entry, { revertGear: true });
        }
        for (const entry of plan.materialEntries) {
          await deleteMaterialAndRevertGear(groupId, tierId, entry.id, entry, { revertGear: true });
        }
        const op = plan.bookOp;
        if (op.kind === 'player-all') await deletePlayerLedger(groupId, tierId, op.playerId);
        else if (op.kind === 'player-week') await clearPlayerWeekPageLedger(groupId, tierId, op.playerId, op.week);
        else if (op.kind === 'floor-all') await clearAllFloorPageLedger(groupId, tierId, op.floor);
        else if (op.kind === 'floor-week') await clearFloorPageLedger(groupId, tierId, op.week, op.floor);
        else if (op.kind === 'week') await clearWeekPageLedger(groupId, tierId, op.week);
        else if (op.kind === 'all') await clearAllPageLedger(groupId, tierId);

        refresh();
        await fetchPageLedger(groupId, tierId);
        toast.success(describeResetToast(resetConfig));
      } catch (error) {
        logger.error('Reset failed:', error);
        toast.error('Reset failed');
      } finally {
        setResetConfig(null);
      }
    }, [resetConfig, groupId, tierId, floors, refresh, fetchPageLedger]);
    ```
    *(Note `deletePlayerLedger` does not refetch balances itself — the trailing `fetchPageLedger`
    plus the card's pageLedger-reference backstop refetch cover it; keep both.)*
  - The `resetMenu` slot:
    ```tsx
    resetMenu={
      lview === 'log' && canEdit ? (
        <LootResetMenu week={logWeek.week} onSelect={setResetConfig} />
      ) : undefined
    }
    ```
  - `LootResetMenu.tsx`: docblock rewritten ("the Log view's destructive Reset dropdown — bound to
    the DISPLAYED week (R-16), the one entry point that isn't surface-attached"); `week` prop doc
    becomes "The Log view's displayed week — scopes the 'week' resets."; apply D7-D labels if
    ruled.
  - Update the handler's lead comment (:740-743) — it may no longer say the menu emits only six
    configs.
- [ ] **Step 4: GREEN** — file suite passes.
- [ ] **Step 5: Deletion traces (execute + paste):** (a) revert the slot gate to
  `lview === 'history'` → visibility test RED; (b) pass `clock.currentWeek` instead of
  `logWeek.week` → the displayed-week test RED (this is the vacuous-coincidence trap — it MUST go
  red; if it doesn't, the test is broken, fix the test). *(A toast trace here would be vacuous —
  on the six toolbar configs the old inline template and `describeResetToast` agree
  character-for-character by D7-k's own "verbatim" requirement; the new toast shapes are traced in
  Task 1 Step 5(d) — director F-2.)*
- [ ] **Step 6: Commit** — `feat(v2): D7 toolbar resets move to Log on the displayed week (R-16 ¼)`

---

### Task 3: Floor-header kebab gains the floor's resets; the menu becomes two-trigger (D7-B)

**Files:**
- Modify: `frontend/src/components/loot/LogWeekGrid.tsx` (kebab :541-562; props :159-198,
  :499-519; new floor-menu state + builder beside the cell menu's :666-692 pattern)
- Modify: `frontend/src/components/loot/Loot.tsx` (grid mount ~:992-1032 — two new wirings)
- Test: `frontend/src/components/loot/LogWeekGrid.test.tsx`, `frontend/src/components/loot/Loot.test.tsx`

**Interfaces:**
- Produces on `LogWeekGridProps` AND `FloorSectionProps` (required, indexed-lookup idiom):
  ```ts
  onResetFloorLoot: (floor: FloorNumber) => void;
  onResetFloorBooks: (floor: FloorNumber) => void;
  ```
- Consumes in `Loot.tsx`:
  ```tsx
  onResetFloorLoot={(floor) => setResetConfig({ scope: 'floor', target: 'loot', week: logWeek.week, floor })}
  onResetFloorBooks={(floor) => setResetConfig({ scope: 'floor', target: 'books', week: logWeek.week, floor })}
  ```
  *(If D7-A rules ONE combined item: a single `onResetFloor` prop emitting `target:'data'` — the
  task otherwise unchanged.)*

- [ ] **Step 1: Failing tests.**
  - `LogWeekGrid.test.tsx` *(sanctioned class 2 — the three D6b kebab tests rewritten for the
    ContextMenu mechanism, plus new)*: kebab per floor with both name shapes (query unchanged —
    same `aria-label`); kebab CLICK opens a menu holding exactly `Log floor` · `Reset M10S loot` ·
    `Reset M10S books` (query by the roles `ui/ContextMenu` renders — follow the existing cell
    context-menu tests in this file for the idiom, NOT the Radix keyDown idiom); "Log floor"
    fires `onLogFloor(2)` driven apart from 1; `Reset M10S loot` fires `onResetFloorLoot(2)` and
    NOT `onResetFloorBooks`; right-click (`fireEvent.contextMenu`) on the floor header bar opens
    the SAME items; `canEdit=false` renders no kebab and right-click opens nothing.
  - `Loot.test.tsx` (integration, displayed ≠ clock): drive Log to `?week=1` with clock 3, seed
    loot across floors/weeks, open floor 1's kebab → `Reset M9S loot` → type RESET → confirm →
    delete mock called ONLY for week-1 M9S entries (three-way discrimination: not week-3 M9S, not
    week-1 M10S); floor books item routes to `clearFloorPageLedger('g1','aac-heavyweight',1,1)`
    (week first; the Loot.test.tsx fixture tier id is `aac-heavyweight`, not `t1`).
    *(This closes the "honest seam" left in Task 2 Step 1.)*
- [ ] **Step 2: RED.**
- [ ] **Step 3: Implement** (per D7-B recommendation (1); if the user rules otherwise this step is
  re-planned, not adapted silently):
  - Add `FloorMenuState { x: number; y: number; floorNumber: FloorNumber; floorName: string }` and
    a `floorMenu` state at the grid root beside the cell menu's; one new builder:
    ```tsx
    function buildFloorMenuItems(
      menu: FloorMenuState,
      onLogFloor: LogWeekGridProps['onLogFloor'],
      onResetFloorLoot: LogWeekGridProps['onResetFloorLoot'],
      onResetFloorBooks: LogWeekGridProps['onResetFloorBooks'],
    ): ContextMenuItem[] {
      return [
        { label: 'Log floor', icon: <ClipboardList className="h-4 w-4" />, onClick: () => onLogFloor(menu.floorNumber) },
        { separator: true },
        { label: `Reset ${menu.floorName} loot`, icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => onResetFloorLoot(menu.floorNumber) },
        { label: `Reset ${menu.floorName} books`, icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => onResetFloorBooks(menu.floorNumber) },
      ];
    }
    ```
    *(Match `ContextMenuItem`'s actual fields in `ui/ContextMenu.tsx` — the cell builder at
    :666-692 is the in-file reference.)*
  - `FloorSection`: replace the Radix `Dropdown` (:545-562) with the same `IconButton` (same
    `aria-label={`${floorName} actions`}`, add `aria-haspopup="menu"` per the cell-kebab idiom)
    whose `onClick` anchors via `jumpMenuAnchor(e, e.currentTarget.getBoundingClientRect())` and
    calls `onOpenFloorMenu({ x, y, floorNumber, floorName })`; add a `canEdit`-gated
    `onContextMenu` on the header bar div doing the same with `preventDefault()`. Rewrite the
    :541-544 comment: the D7 arrival note becomes a description of the shipped menu.
  - Grid root: second `<ContextMenu>` mount (beside :742-749) rendering `buildFloorMenuItems`,
    `onClose={() => setFloorMenu(null)}`.
  - Remove the now-unused `primitives/Dropdown` import (`LogWeekGrid.tsx:141` — the floor kebab
    is the file's ONLY usage; director F-13).
  - The header-bar `onContextMenu` sits on a non-interactive `<div>` — apply the pre-authorized
    one-line targeted `eslint-disable` with reason (Global Constraints, F-7); never touch
    `eslint.config.js`.
  - `Loot.tsx`: the two wirings from Interfaces, same commit (green hook).
- [ ] **Step 4: GREEN** — both files' suites.
- [ ] **Step 5: Deletion traces (execute + paste):** (a) swap the two reset wirings in `Loot.tsx`
  (loot↔books) → the integration tests RED; (b) replace `week: logWeek.week` with
  `week: clock.currentWeek` in the wiring → the displayed-week floor test RED; (c) remove the
  header `onContextMenu` → the right-click test RED.
- [ ] **Step 6: Commit** — `feat(v2): D7 floor kebab carries the floor's resets, two triggers (R-16 2/4, R-25)`

---

### Task 4: `BookLedgerCard` re-homes to Log on the displayed week; the row regains its `JobIcon`

**Files:**
- Modify: `frontend/src/components/loot/Loot.tsx` (remove :967-975 from the History branch; insert
  after the fairness wrapper :1047-1052 per D7-C)
- Modify: `frontend/src/components/loot/BookLedgerCard.tsx` (row name cell :198-237)
- Test: `frontend/src/components/loot/Loot.test.tsx`, `frontend/src/components/loot/BookLedgerCard.test.tsx`

**Interfaces:**
- The card's props are unchanged in this task; the mount changes to
  `currentWeek={logWeek.week}` inside the `lview === 'log'` fragment. Task 5 adds `onResetConfig`.

- [ ] **Step 1: Failing tests.**
  - `Loot.test.tsx` — do NOT `vi.mock` the card (director F-1: the file's real convention is the
    OPPOSITE — `BookLedgerCard` renders for real with its store calls stubbed, per the file's own
    comment at `:257` and the `fetchPageBalances` stub at `:264`; none of the file's twelve
    `vi.mock`s cover it). Assert through the real card's observable behavior: "mounts
    BookLedgerCard on Log at the DISPLAYED week" — `?lview=log&week=1`, clock 3, click the card's
    week-scope toggle option → `fetchPageBalances` called with `('g1', 'aac-heavyweight', 1)` and
    the week arg `not.toBe(3)` (stronger than a captured prop; cannot pass vacuously); "History
    no longer mounts the books card"; "Priority never mounts it". Note: the re-home moves the
    card's render from the History-branch tests' tree to the Log-branch tests' tree — harmless
    because `:264` stubs `fetchPageBalances` globally; do not add a mock "defensively".
  - `BookLedgerCard.test.tsx`: "a balance row shows the player's JobIcon beside the name" (players
    fixture already carries `job`; assert via the JobIcon's accessible output or a test-id
    consistent with `JobIcon`'s own rendering — read `ui/JobIcon.tsx` first); "a balance row whose
    player is missing from the roster renders the name without an icon" (pageBalances row with an
    unknown playerId).
- [ ] **Step 2: RED.**
- [ ] **Step 3: Implement.**
  - Move the mount (all existing props verbatim except `currentWeek={logWeek.week}`), placed as a
    sibling AFTER the gated fairness wrapper, ungated (D7-C rec):
    ```tsx
    {mainRosterPlayers.length > 0 && ( /* WeekCountBar + LootFairnessLegend, untouched */ )}
    {/* D7 (R-14): the books ledger is Log's — full width below the fairness read,
        on the DISPLAYED week: the card writes with the week it is given, so
        backfilling week 3 credits week 3, never the current lockout. */}
    <BookLedgerCard
      groupId={group.id}
      tierId={tier.tierId}
      players={players}
      floors={floors}
      currentWeek={logWeek.week}
      canEdit={canEdit}
      effectiveUserId={effectiveUserId}
    />
    ```
    History branch: delete the card; `FairnessSummary` and `LootHistoryTable` remain.
  - Row name cell (legacy shape, `SectionedLogView.tsx:1410-1415` reference):
    ```tsx
    <td className={/* existing classes */}>
      <div className="flex items-center gap-1.5">
        {player?.job && <JobIcon job={player.job} size="sm" />}
        <span className="text-text-primary truncate max-w-[100px]">{b.playerName}</span>
      </div>
    </td>
    ```
    (`player` = the existing `playersById.get(b.playerId)` lookup already in row scope for
    `rowCanEdit`.) Check the aria-hidden hazard against `JobIcon`'s internals (Global Constraints).
- [ ] **Step 4: GREEN** — both suites.
- [ ] **Step 5: Deletion traces (execute + paste):** (a) feed `clock.currentWeek` at the new mount
  → the displayed-week test RED; (b) re-add the card to the History branch → the "History no
  longer mounts" test RED.
- [ ] **Step 6: Commit** — `feat(v2): D7 books card re-homes to Log on the displayed week + JobIcon (R-14)`

---

### Task 5: Books column + row kebabs (follow-the-toggle), two triggers

**Files:**
- Modify: `frontend/src/components/loot/BookLedgerCard.tsx` (header `<th>`s :180-191; row trailing
  `<td>` :228-236; new menu state + builder; new required prop)
- Modify: `frontend/src/components/loot/Loot.tsx` (pass `onResetConfig={setResetConfig}`)
- Test: `frontend/src/components/loot/BookLedgerCard.test.tsx`, `frontend/src/components/loot/Loot.test.tsx`

**Interfaces:**
- Produces on `BookLedgerCardProps` (required — sanctioned class 3 extends the test harness):
  ```ts
  /** D7 (R-16): column/row kebab items hand their ResetConfig to the host's single confirm gate. */
  onResetConfig: (config: ResetConfig) => void;
  ```
- Emitted configs (all follow the card's own toggle — D7-h; `currentWeek` is the displayed week
  after Task 4):
  - Column, toggle `'week'`: `{ scope: 'floor', target: 'books', week: currentWeek, floor }`
  - Column, toggle `'all'`: `{ scope: 'floor', target: 'books', floor }`
  - Row, toggle `'week'`: `{ scope: 'week', target: 'books', week: currentWeek, playerId, playerName }`
  - Row, toggle `'all'`: `{ scope: 'all', target: 'books', playerId, playerName }`
  (Column floor number = the Book column's ordinal, I→1 … IV→4 — the same 1:1 convention
  `clearFloorPageLedger` itself uses to map floor→bookType.)

- [ ] **Step 1: Failing tests** (`BookLedgerCard.test.tsx`; `onResetConfig` joins the harness
  baseline):
  - Column kebab present per Book column when `canEdit` (`aria-label` `Book II actions`); click
    opens ONE item; with toggle on **All time** (the default) the item reads
    `Reset ALL Floor 2 books` and emits `{scope:'floor', target:'books', floor:2}` (no week);
    toggle to **This week** → `Reset Floor 2 books (Week 3)` emits `week: 3` (fixture
    `currentWeek={3}` — and one variant renders `currentWeek={1}` asserting the label/config
    follow, the anti-vacuous pairing).
  - Row kebab in the trailing td beside the ledger IconButton (`aria-label`
    `Tank One book actions`); follow-the-toggle item pair
    (`Reset Tank One's Week 3 books` / `Reset ALL Tank One's books`) with configs verbatim incl.
    `playerId` AND `playerName`.
  - Right-click on the `<th>` / on the row `<tr>` opens the same single item.
  - `canEdit=false`: no kebabs, right-click inert. Member-own-row (`effectiveUserId` matches): row
    still has NO kebab (D7-g).
  - `Loot.test.tsx`: "the card's kebab configs land in the shared confirm" — drive the REAL
    card's row kebab (seed `pageBalances`; the card renders real per F-1) → `ResetConfirmModal`
    opens (its description text names the player + week) → type RESET → confirm →
    `clearPlayerWeekPageLedger('g1','aac-heavyweight','p1',1)` (fixture tier id).
- [ ] **Step 2: RED.**
- [ ] **Step 3: Implement.** One `BooksMenuState` union
  (`{kind:'column'; x; y; floor} | {kind:'row'; x; y; playerId; playerName}`), one builder reading
  the card's `scope` state + `currentWeek` prop (D7-h: label and config flip together — the legacy
  mechanism, re-expressed), one `ContextMenu` mount at the card root. Kebab `IconButton`s
  (`variant="ghost" size="sm"`, `aria-haspopup="menu"`) in each Book `<th>` and each row's
  trailing `<td>`; `onContextMenu` (canEdit-gated, `preventDefault()`) on the `<th>` and `<tr>`;
  both triggers anchor via `jumpMenuAnchor`. The `<th>`/`<tr>` `onContextMenu` handlers take the
  pre-authorized targeted `eslint-disable` with reason (Global Constraints, F-7). Wire
  `onResetConfig={setResetConfig}` in `Loot.tsx` (same commit — required prop). If D7-F rules a
  week-naming toggle label, apply it here (same file, same commit family).
- [ ] **Step 4: GREEN** — both suites.
- [ ] **Step 5: Deletion traces (execute + paste):** (a) hardcode the builder's scope read to
  `'all'` → the This-week tests RED; (b) drop `playerName` from the row config → the config-verbatim
  test RED (the field feeds the confirm's description copy — `ResetConfirmModal.tsx:54` — NOT the
  planner's precedence, which keys on `playerId`; rationale director-corrected, F-11); (c) swap `floor`
  ordinal mapping (I→4) → column config test RED.
- [ ] **Step 6: Commit** — `feat(v2): D7 books column/row kebabs — follow-the-toggle resets (R-16 4/4)`

---

### Task 6: `?book=` retargets to Log

**Files:**
- Modify: `frontend/src/components/roster/RosterCard.tsx` (:304)
- Test: `frontend/src/components/roster/RosterCard.test.tsx` (:1454 — sanctioned class 4),
  `frontend/src/components/loot/Loot.test.tsx` (new integration)

- [ ] **Step 1: Failing tests.** `RosterCard.test.tsx:1453` → `expect(params.get('lview')).toBe('log')`
  (`:1454` is the `book` assert; the neighboring stale-highlight tests :1458-1534 assert
  param-clearing only — all unchanged). `Loot.test.tsx` (the card already renders real after
  Task 4 — a separate describe seeding `pageBalances`), TWO variants: (a) render
  `['/?lview=log&book=p1&week=1']` with clock 3 → the card mounts under Log, row `book-row-p1`
  present, and the `book` param self-clears (fake timers, 2.5s — the card suite's own idiom);
  (b) **the REAL jump shape (director F-14):** `handleBooksJump` writes NO `week` param — render
  `['/?lview=log&book=p1']` with clock 3 → the Log resolves its week from storage/clock, the card
  still mounts, the row is present, the param still self-clears.
- [ ] **Step 2: RED** (RosterCard assertion fails against `'history'`).
- [ ] **Step 3: Implement** — `params.set('lview', 'log');` in `handleBooksJump`. Nothing else: the
  consumer effect is mount-scoped (D7-j), `rows.length` self-heals the fetch race.
- [ ] **Step 4: GREEN** — both suites, then the FULL frontend suite (`pnpm -C frontend test`) — the
  re-home's blast radius check.
- [ ] **Step 5: Deletion trace (execute + paste; F-14 — this task previously had none):** re-point
  `RosterCard.tsx:304` back to `'history'` → the `RosterCard.test.tsx:1453` assertion RED with
  `'history' ≠ 'log'`. Restore.
- [ ] **Step 6: Commit** — `feat(v2): D7 roster Books jump lands on Log (R-14 consequence)`

---

### Task 7: Records, write-backs, release note, gate

**Files:**
- Modify: `frontend/src/components/loot/Loot.tsx` (header comment :89-113 and :121-126)
- Modify: `frontend/src/components/loot/LogWeekGrid.tsx` (header doc comment)
- Modify: `design/redesign/specs/phase-d-loot-design.md` (build notes under R-14, R-16; R-25's
  build note gains "the resets arrived — D7")
- Modify: `design/redesign/specs/v1-v2-parity-matrix.md` (D-38, D-39 ruling-driven rewrites —
  the Phase-C precedent: rows and rulings land in the same PR)
- Modify: `frontend/src/data/releaseNotes.ts` (internal entry)

- [ ] **Step 1: Header-comment + doc-drift sweep (director F-8 list).** `Loot.tsx` :89-113: the
  D7 rows (Books card, displayed-week reset menu) become shipped statements; D11/D12 interims
  stay; fix the stale self-cite (`:109` says "Loot.tsx:629-704" — re-derive the real range or
  drop the numbers for a symbol reference); `Loot.tsx:127-130`'s "the History reset reproduces
  exactly the six configs the LootResetMenu emits" is false on both counts after D7 — rewrite.
  `LogWeekGrid.tsx`: the floor-kebab comment no longer says "D7 later adds".
  `BookLedgerCard.tsx:2`: the docblock's "the v2 Loot History 'Books' home" names the old home —
  rewrite; `:94`'s pointer to "Loot.tsx:287" is stale (the handler lives at ~:744-782,
  `fetchPageLedger` at ~:774) — fix or de-number. `Loot.test.tsx:257`'s "added for the History
  view" comment follows the mount.
- [ ] **Step 2: Design-record build notes (dated, under each ruling):** R-14 — shipped: displayed
  week (the three re-pointed writes named), JobIcon restored, `?book=` → `lview=log`, History
  loses the card (R-34), collapse-toggle drop restated, position per D7-C ruling. R-16 — shipped:
  four entry points enumerated with their emitted configs, the planner named as the re-expression,
  the mechanism split disclosed (three reversal-POST book clears vs `deletePlayerLedger`'s true
  DELETE — the row kebab's week/all-time items differ in destructiveness, F-3), the
  floor-without-week fail-closed hardening over the frozen reference recorded (F-16), the
  inherited `ResetConfirmModal.tsx:152` "permanently delete" copy named as a pre-existing
  divergence on the reversal paths (shared frozen file — disclosed, not fixed), D7-A/B/D/E/F
  rulings recorded with whatever the user decided, the R-22 boundary restated (revert stays
  clock-bound). R-25 —
  one line: the same-menu resets arrived (D7), mechanism per D7-B ruling.
- [ ] **Step 3: Parity-matrix rewrites.** D-38 → ✅ BUILT (D7, date): full-width card below the Log
  grid, displayed week, collapse/sidebar dropped by ruling, mobile axis → Phase P. D-39 →
  ✅ BUILT (D7, date): all four entry points restored with real scoping; column/row menus follow
  the card's toggle; kebab + right-click.
- [ ] **Step 4: Release note** — `internal: true`, `CURRENT_VERSION` untouched; invoke the
  pr-checklist skill before opening the PR (`prTitle` = the PR title).
- [ ] **Step 5: Full local gate** — `pnpm build` (tsc -b) · `pnpm lint` ·
  `pnpm check:design-system:strict` · `pnpm dupes` · `pnpm tokens:check` · `pnpm deadcode` (vs
  captured baseline — knip is `continue-on-error` in CI, so attach before/after) · `pnpm test`.
  Greps: no `FLOOR_COLORS` in v2-authored files; no `text-[7-11px]` in new code; `git diff --stat`
  over `frontend/src/components/history/` EMPTY.
- [ ] **Step 6: Commit** — `docs(v2): D7 write-backs — R-14/R-16 build notes, D-38/D-39 rows`

---

## Definition of done (slice level)

1. All task suites + the full local gate green.
2. **Live browser demonstration (`?shell=v2`, desktop, dark primary + light spot-check),
   evidence-first, with displayed ≠ clock demonstrated live** (step Log to a past week with the
   clock ahead): toolbar Reset menu on Log — week reset names and hits the DISPLAYED week (verify
   in the confirm copy AND the surviving entries); floor kebab AND right-click open the same menu —
   floor reset removes only that floor's displayed-week entries; Books card below the fairness
   read, JobIcons on rows; card toggle → column/row kebab labels and configs flip; a row reset
   zeroes only that player; Mark floor cleared defaults to the displayed week; roster card Books
   jump → lands on Log, row pulses, param self-clears; Revert still shows the clock-divergence
   notice (R-22 regression check); read-only viewer: no kebabs anywhere; History: no books card,
   no reset menu, per-entry kebab intact. Fresh-static Log screenshot for the D7-C evidence.
3. **V1 safety, two-part:** (a) `git diff --stat` over `frontend/src/components/history/` and all
   legacy-only paths EMPTY; (b) PR-body statement: **no §2.1 shared file touched** — explicitly:
   `ui/ResetConfirmModal.tsx` unedited (consumed only; its existing branches cover every emitted
   config), `history/` imported-only, `LootResetMenu.tsx`/`RosterCard.tsx` v2-only with the import
   chains cited. The PR body also pre-empts the two facts a reviewer would otherwise "discover"
   (F-3): `ResetConfirmModal.tsx:152` says "permanently delete" even on the three reversal-POST
   paths v2 makes reachable for the first time (frozen shared copy — disclosed, not fixed), and
   the row kebab's all-time item is a true delete while its week item writes compensating
   adjustments.
   - Step the Log week within 2.5 s of a `?book=` jump — `?week=` must survive the param's
     self-clear.
   - A This-week-scoped column reset must not leave the card settled on all-time numbers (the
     unscoped-refetch backstop).
   - A bare `?lview=log&week=N` cold open in a fresh tab — observe whether the storage re-resolve
     clobbers the URL week (pre-existing `useLogWeek` behavior; disclosed, not fixed here).
4. Screenshots embedded in the PR per the pr-shots convention (commit on-branch under
   `docs/redesign/pr-shots/d7-*`, SHA-pinned URLs). **Amended 2026-09-17 for D7b:** the
   "netted out before merge" half of that convention is **retired** — shots now stay in the repo,
   but must be run through `python scripts/shrink-pr-shots.py` first (900px WebP; CI enforces a
   120 KB per-file budget). See `.claude/skills/pr-checklist/SKILL.md` § Screenshots.
5. `pnpm dupes` green with `history/` in scope (the re-expression discipline held).
6. Release note present (internal); design-record + parity-matrix write-backs in the same PR; the
   D7-A/B/C/D rulings recorded in this plan's vet record and the PR body.

## Out of scope (named so the ledger cannot drift)

R-28's loot/material jump halves (`RosterCard.tsx` still writes `lview=history` for those —
**D12**, which also brings slot-level anchors and the week-split) · D11 (History row affordances;
arbitrary-entry delete) · `Alt+B` / `Alt+←→` rebinds and every shortcut (**D14**) · `FairnessSummary`
staying on History until **D14** moves it to Home (R-40) · mobile (Phase P — including the dropped
mobile Loot⇄Books panel-tab axis, named in R-14) · the sidebar collapse toggle (dropped by R-14,
restated in the build note) · a true backend bulk-delete for floor/player book clears (the
reversal-POST shims are the shipped mechanism; a backend endpoint would be its own follow-up) ·
the `ui/Select` effect-ordering race, index.css aria-hidden narrowing, Tooltip keyboard gap,
deadcode baseline chore, Modal focus-restore (standing phase-level queue — untouched unless a task
lands one for free) · viewer copy/jump affordances on read-only surfaces (D6-l divergence stands).
