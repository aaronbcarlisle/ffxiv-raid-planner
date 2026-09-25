# Phase E · E1 — Mechanical polish

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** E1 ships the mechanical half of Phase E (`ROLLOUT_ROADMAP.md` §7, the "~20 mechanical holistic items"), plus the code the user's 2026-09-25 design calls produced. It:
- closes the v2 loot and books a11y and copy items: rank-chip contrast, books-table headers and button names, SR text for the week dots, the PriorityRow truncate, the method-aware context line, the empty-roster fairness state, the sunk header strips, the raw aug-slot copy and BookLedgerCard's whole-store selector;
- gives the Roster Board one tab stop with arrow-key movement;
- gives the command palette a real combobox, and gives the palette shortcut label one author;
- fixes the TrackCard, the next-session card, the heatmap's manager cells and the v2 "Group Not Found" copy (per the rulings), and adds the missing v2 delete-flow tests;
- records the six rulings and the 41-item status check in the docs, and carries what is left, each with a named home.

The impeccable-assisted pass (the second half of the roadmap's Phase E bullet) is **not** in E1. It is its own slice (E2): it needs a tool install and a `/detect` run whose output cannot be sized in advance.

**Architecture:**
- **Task 1:** class, attribute and copy edits in v2 loot files, plus one `useShallow` selector.
- **Task 2:** a pure navigation function (`nextBoardCell`) fed from the interactivity GearBoard already computes. Cells report arrow keys (and whether a move happened) and focus through new optional props; GearBoard derives the one tab stop at render, keyed by player and slot.
- **Task 3:** the palette moves keyboard management onto its input (the ARIA combobox pattern, mirroring `SearchableSelect.tsx:237-245`). A shared helper becomes the one author of the shortcut label.
- **Task 4:** copy, attribute and heading edits in v2 home, schedule and shell files, plus the v2 delete-flow tests.

**Tech stack:** React 19 · TypeScript · Zustand 5 · Vitest + Testing Library · ESLint 9 (jsx-a11y `warn`; full `error` in `primitives/` and `ui/`; shell-layer import boundaries at `eslint.config.js:96-99`).

**Spec (binding):**
- `design/redesign/ROLLOUT_ROADMAP.md` §7, "E — Polish" (`:245-248`).
- Memory `feedback_defer_holistic_review`: the 41-item list. It was status-checked 2026-09-25 against `530fa383`; see "Status check" below.
- The user's six design-call rulings, 2026-09-25 (U-1…U-6 below).

**Drift found while sizing (2026-09-25):**
- **#31 is not fixed.** `SessionRsvpCard.tsx:347` is `title={isLater ? session.title : 'Next session'}`, so the promoted card is still anonymous. U-3 fixes it.
- **#25 is partly stale.**
  - The "Logging marks the drop…" footer no longer exists anywhere in `frontend/src`.
  - The context line (`RecipientPicker.tsx:632`) says "· raid drop" whatever the method. `METHOD_OPTIONS` (`:113-118`) offers Book, Tome and Purchase in every mode, and Options is open by default in log mode (`:186`).
  - The checkbox caption (`:807-812`) is already mode-aware.
- **#10's role gating is mostly right already.** A disabled cell that has BiS correctly keeps `role="checkbox"` + `aria-disabled="true"`. The only gap is the inert-but-enabled state (`!disabled && !onCycle`, `GearBoardCell.tsx:66`): it announces `aria-disabled="false"` on a cell nobody can operate.
- **The static-vocab sweep found one v2 hit:**
  - The hit is `pages/ShellContentStates.tsx:180-181`. It is v2-only (its only importer is `NewShell.tsx`) and renders "Group Not Found" / "The static group you're looking for doesn't exist." Task 4e fixes it.
  - Every other "group" match in v2 files is an identifier, a route, a Tailwind `group` utility, an ARIA `role="group"`, or the G1/G2 light-party wording.
  - The remaining user-facing "Group" strings are V1-only and frozen: `GroupViewContent.tsx:1295`, which renders only when `pageMode==='roster' && !slots?.roster` (`:1280`), and `pages/GroupView.tsx:328`.
- **#39's legacy half is already covered; the v2 half has no test.**
  - `SessionCard` is legacy (its only importer is `ScheduleTab.tsx:11`), and its choice modal is tested at `SessionCard.test.tsx:114-162`.
  - The v2 chain is `components/schedule/Schedule.tsx:354-383` (`deleteChoice`, `handleCancelOccurrence`) and `:505-527` (the modal). `Schedule.test.tsx` has no delete test.
- **V1 reachability.** Every file E1 changes is v2-only, with one shared data module:
  - PriorityRow is imported only by `FloorCard.tsx` and `FloorDropRow.tsx`.
  - GearBoard is imported only by `Roster.tsx`, and CommandPalette only by `NewShell.tsx`.
  - `historyItems.ts`'s importers are all v2.
  - The shared module is `components/ui/keyboardShortcutGroups.ts`. V1's `KeyboardShortcutsHelp.tsx:12` imports it, but for the frozen `SHORTCUT_GROUPS` (`Layout.tsx:97-99`); only `V2_SHORTCUT_GROUPS` changes. The V1 guard is `keyboardShortcutGroups.test.ts:20`, a literal fixture, which must stay green and unedited.

**Plan-vet:** `xivrp-director`, 2026-09-25: **READY-WITH-FOLDS** (3 Blockers, 5 Majors, 10 minors). No re-vet is needed once they are folded, and **all are folded below:**
- **B1:** the v2 "Group Not Found" copy → Task 4e.
- **B2:** #39 retargeted to v2 `Schedule`.
- **B3:** `onNavigate` returns a boolean; the stop is derived at render and keyed by `{playerId, slot}`; `onFocus` goes only on interactive cells.
- **M1:** the R-E1-D label and tests are corrected.
- **M2:** "raid drop" is gated on the method.
- **M3:** U-1's reach → R-E1-J.
- **M4:** status and V1-reachability corrections.
- **M5:** one label string, "Ctrl+K".
- **m1–m9:** folded in place.
- **m10:** the old Task 2 is split into Task 2 (board) and Task 3 (palette), and the riskiest task gets its task-scoped review.

---

## User rulings (2026-09-25)

| ID | Call | Ruling | E1 work |
|---|---|---|---|
| U-1 | Fight vs Floor | **Floor-first, no code change:** "Floor N" is the primary label; the fight name is its tag. The REDESIGN_SPEC §10 glossary line (`:356`, "avoid 'floor' in user-facing copy") is amended to describe the as-built pattern. See R-E1-J | Doc (Finish). Task 1b only removes the context line's doubled and empty names |
| U-2 | TrackCard vocab | Tag "Mount farm" (was "Ring 3"). The subline is just "{n} of {m} have it" | Task 4a |
| U-3 | Next-session hero | **V1 parity:** a "Next session" eyebrow over `session.title` as the card's real title | Task 4b |
| U-4 | Subtitle vs show-subs | **Describes the static.** No change; closes #6 | Doc only |
| U-5 | R-D14-B fairness | **Confirmed as built:** "Loot fairness", at the top of Home's side column | Doc only |
| U-6 | First-paint week window | **Confirmed:** `?week=` (first mount only) → v2 stored week → legacy stored week → live clock (`useLogWeek.ts:239-253`) | Doc only |

## Rulings (bind every task)

| ID | Ruling | Why | Cost if wrong |
|---|---|---|---|
| R-E1-A | **Text on an accent tint uses `text-accent-hover`.** This applies to the RecipientPicker rank chips only (`:733`, `:742`; the `/10` tint is on the selected row, `:713`). The broader idiom convergence (#22) stays a holistic call | `LootHistoryTable.tsx:368-374` measured `text-accent` on a `bg-accent/15` tint at ≈4.07:1, which fails AA, and `/10` is weaker. Light `--color-accent-hover` is `#0a6b60`, darker (`tokens.generated.css:124`). Dark is `#2dd4bf`, lighter (`:14`) | A lighter number on the selected row in dark theme |
| R-E1-B | **The picker's context line is method-aware and never doubles or blanks the fight.**<ul><li>Keep today's order, `{fight} Floor {n}` (it matches the `[fight] Floor N` headers, R-E1-J).</li><li>Omit `{fight}` when `floorName` is empty (assign `item?.floorName ?? ''`, `:204`; log `floors[0] ?? ''`, `:189`) or equals the generic `Floor {n}` (FloorCard's condition, `:128-132`; reuse it if it is exported, else inline the equality).</li><li>Then ` · {label} slot`.</li><li>Then ` · raid drop` **only when the current `method === 'drop'`**, in every mode.</li></ul>The checkbox label "Mark {label} as acquired" (`:805`) stays: it states the save-time effect in every mode, and its caption is already mode-aware | #25. Book, Tome and Purchase are offered in every mode (`:113-118`, `:177-179`) | One string |
| R-E1-C | **Card header strips drop their own background:**<ul><li>FloorCard (`:127`, `bg-surface-base`);</li><li>LogWeekGrid's floor header (`:594`, the same class).</li></ul>Both inherit the card's `bg-surface-card`. Keep any divider border. CardShell headers (`CardShell.tsx:46,49`) have no separate background | Dark `surface-base` `#050508` under a `#0e0e14` card reads sunk (#30) | A flatter strip. The PR shots are light + dark |
| R-E1-D | **The aug-slot label is `GEAR_SLOT_NAMES[slot]` verbatim** (`types/index.ts:487-500`, Title Case, the one author of slot text), e.g. "aug R. Ring". The tome branch (`'tome wpn'`, `historyItems.ts:94`) is unchanged. Search keeps matching the displayed text: matching lowercases (`historyQuery.ts:389,480`), so "ring" and `slot:ring` match a ring1 aug row and "ring1" does not. The round-9/10 tests (`historyQuery.test.ts:577-592`) are untouched and stay green | #29. Raw enums are the bug | Searching "ring1" stops matching |
| R-E1-E | **Board arrow keys use a roving tab stop, keep `role="checkbox"` and add no `role="grid"`.**<ul><li>**The stop is derived at render, not in an effect:** `activeCell` (keyed by `{ playerId, slot }`, never row/col indices) if that cell is still interactive, else the first interactive cell in render order.</li><li>**Only interactive cells get `onFocus`**, so clicking a disabled cell (which has `tabIndex=-1`, so a click can still focus it) never records a non-interactive stop.</li><li>**Handlers live on the cells, not the `<table>`**: jsx-a11y `no-noninteractive-element-interactions` would fire on `<table>`/`<tbody>`.</li><li>Only unmodified arrow keys navigate (Alt+Left is browser Back). `onNavigate` returns `boolean`, and the cell calls `preventDefault` only on `true`.</li><li>ArrowLeft/Right move to the previous/next interactive cell in the row.</li><li>ArrowUp/Down move to the nearest player row above/below with an interactive cell **in the same slot column**, skipping section dividers, the no-BiS spanning row and non-interactive cells.</li><li>At an edge nothing moves and there is no `preventDefault`.</li><li>Cells get `scroll-margin-top` clearing the sticky header (`GearBoard.tsx:127,134`).</li></ul> | Tabbing through up to 8 × 12 cells is the defect. A grid role is a larger semantics change with SR browse-mode costs. Index keys drift when a player above leaves or the OFFH column toggles (`GearBoard.tsx:90-92`) | A keyboard trap or zero tab stops is Critical: T2-b5 and T2-c5 prove neither happens |
| R-E1-F | **The palette is an ARIA combobox.**<ul><li>The input gets `role="combobox"`, `aria-expanded`, `aria-controls` → the listbox id, `aria-autocomplete="list"` and `aria-activedescendant` → the highlighted option's id (omitted with zero results). Option ids are prefixed with `useId`.</li><li>`highlightedIndex` resets to 0 **in the query `onChange` and in `handleClose`**, not in an effect (`:90-91`).</li><li>ArrowDown/ArrowUp **clamp** (as `SearchableSelect.tsx:239-245` does).</li><li>Enter runs the highlighted command through the click handler, and is ignored while `event.nativeEvent.isComposing`. Escape is unchanged.</li><li>Options get `aria-selected={i === highlightedIndex}`. The highlight is **state-driven only**: drop `hover:bg-surface-elevated` (`:238`) and set the highlight `onMouseEnter`, so two rows never look highlighted.</li><li>**Rows go from `tabIndex={0}` to `tabIndex={-1}` and keep their `onKeyDown`**, so jsx-a11y `interactive-supports-focus` and `click-events-have-key-events` stay satisfied.</li><li>Call `scrollIntoView?.({ block: 'nearest' })` on highlight change (jsdom lacks it).</li></ul> | Hand-rolled today (`:13` "No cmdk dependency"): `aria-selected` is hard-coded `false` and arrows do nothing (`:225-248`). `SearchableSelect` is the repo's own combobox | A prop that `ui/Input` does not forward (if the palette uses it) drops the ARIA. T3-a1 asserts it on the DOM |
| R-E1-G | **One author for the palette shortcut label:** a helper in `lib/` or `utils/` (never `components/layout/`: a shared→shell import is an error, `eslint.config.js:96-99`). It returns `'⌘K'` on Mac and `'Ctrl+K'` otherwise, and replaces `computeCmdkLabel` (`CommandPalette.tsx:47-52`).<ul><li>The palette chip (`:220`) changes from "Ctrl K" to "Ctrl+K" (update `CommandPalette.test.tsx:153-160`).</li><li>`V2_SHORTCUT_GROUPS`'s Command-palette row (`keyboardShortcutGroups.ts:134`) reads the helper. Non-Mac stays `'Ctrl+K'`, so `:68` stands; on Mac it reads `'⌘K'`.</li></ul>How the row reads the helper is the implementer's call, provided a test can exercise the Mac branch. Tests that redefine `navigator.platform` (`:144`, `:153`) restore it in `afterEach` | The literal is wrong on Mac, and two formats disagree today | None to V1: `SHORTCUT_GROUPS` is untouched, guarded by `keyboardShortcutGroups.test.ts:20` |
| R-E1-H | **The heatmap's manager cells get the read-only branch's `title`** (`title={cell.names.join(', ') \|\| undefined}`, `AvailabilityHeatmap.tsx:183-193`), and their `aria-label` appends the names when there are any. `title` is used, not the Tooltip primitive, because it is the file's own idiom on the sibling branch | #33: the list is most useful to the manager proposing a time | The aria-label gets longer |
| R-E1-I | **The next-session title is a real heading inside the body.** `CardShell`'s `title` is string-only and already renders an eyebrow-styled `<h3>` (`CardShell.tsx:19,55-58`).<ul><li>For `!isLater`, the body's first line is `session.title`, marked up as `<h4>` (or `role="heading" aria-level={4}` if the design-system lint objects to a raw heading).</li><li>It is styled in the v2 display step from `docs/DESIGN_SYSTEM_SUMMARY.md`, V1's equivalent being `text-xl font-display font-bold text-text-primary leading-tight` (`ScheduleUpcomingPanel.tsx:186-188`).</li><li>It is not rendered when `session.title.trim()` is empty.</li><li>When it renders, `SessionRsvpCard.tsx:330`'s fallback to `session.title` for a missing day label is suppressed, so the title never shows twice.</li><li>The later variant and Home's empty state (`Home.tsx:318`) are unchanged.</li></ul> | U-3 says "real title". Heading navigation finds the session name without widening `CardShell`'s API | The heading outline gains one level |
| R-E1-J | **U-1's reach: "Floor-first" means visual prominence, not text order.** "Floor N" is the primary label and the fight name its tag. The as-built `[fight] Floor N` headers (`FloorCard.tsx:132-133`, `LogWeekGrid.tsx:596-598`) stay. Compact controls that show only the fight name are **accepted as-built**: the floor pills (`Loot.tsx:1275`), "Log floor — M12S" (`:1306`) and the picker's "Fight" Select (`RecipientPicker.tsx:638-643`). The glossary amendment names this pattern. #18 closes by ruling | The user picked "no code change" | A later copy pass revisits the compact controls |

**Release note:** internal (`internal: true`, `CURRENT_VERSION` untouched, next `version` `2.1.33`).
- **V1-visible change: nil.** Every changed file is v2-only; the shared data module's V1 half is untouched (see Drift).
- **Evidence:** `keyboardShortcutGroups.test.ts:20`, and the Finish's `?shell=legacy` check.

**Riskiest task: Task 2.** It is the only new interaction logic: 2-D navigation over grouped rows with skip rules, and a tab stop that must survive roster changes. Dispatch `xivrp-implementer-deep` with `model: fable`, run the ad hoc mutation check (step 2.6) and **a task-scoped `redesign-reviewer` pass** (slice-loop §1.4).

**Budget:** about 1,150 changed lines: Task 1 ~180, Task 2 ~260, Task 3 ~130, Task 4 ~130, this plan ~370, the write-back ~80.

**Baselines** (`main` = `8022b3be`, the #274 squash of `530fa383`+`e404de12`, identical code; DC's gate run): lint 0 errors / 812 warnings · knip (`pnpm deadcode`) 8 / 179 / 139 · dupes 320 clones · tests 3305 passed.

**Gates for every task (run from `frontend/`), with each result line pasted:**
- `pnpm build` (`tsc -b` type-checks tests; Vitest does not);
- `pnpm lint`: 0 errors, warnings ≤ 812;
- `pnpm check:design-system:strict`;
- `pnpm dupes`: ≤ 320 clones;
- the task's `vitest` scope.

**At the Finish:** full `pnpm test` ≥ 3305 passed; `pnpm deadcode` ≤ 8 / 179 / 139.

---

## Review Focus

These are the inputs most likely to bite that no happy-path test hits. Each one has a named test.
1. **Board ArrowDown across a gap:** a section divider followed by a non-interactive row (no-BiS or non-editable). Focus must land on the nearest interactive cell in the same column, or stay put. (T2-b2, T2-b6)
2. **The tab stop after the roster changes:** a player above the active cell leaves, or a disabled cell is clicked. The same player and slot keep the stop, and there is always exactly one. (T2-c4, T2-c5)
3. **Keys that must not be eaten:** Alt+ArrowLeft, Shift+ArrowDown, and an arrow at an edge are not `defaultPrevented`. (T2-b3b, T2-b4)
4. **A palette query that shrinks the list below the highlight:** with ArrowDown pressed first, then typing, the highlight resets to 0. With zero results there is no `aria-activedescendant`, and Enter is a no-op. (T3-a2, T3-a3)
5. **Aug-slot search after the relabel:** "ring" and `slot:ring` find the ring1 aug row; "ring1" does not; rounds 9/10 stay green. (T1-i2)
6. **The context line with a Book method, a generic floor name, or an empty floor name:** no "raid drop", no "Floor 4 Floor 4", no "Floor 4 ·  ·". (T1-b2, T1-b3)

---

## Task 1 — v2 Loot & Books polish (`xivrp-implementer`, sonnet)

**Files:** `components/loot/RecipientPicker.tsx`, `components/ui/PriorityRow.tsx`, `components/loot/BookLedgerCard.tsx`, `FairnessSummary.tsx` (wherever `Home.tsx` imports it from), `components/loot/FloorCard.tsx`, `components/loot/LogWeekGrid.tsx` (the header class only), `components/loot/WeekScopeControl.tsx`, `utils/historyItems.ts`, and their tests, plus `LootHistoryTable.test.tsx` and `historyQuery.test.ts`. **Test scope:** these files plus the `FloorCard`, `FloorDropRow`, `NeedMatrix`, `LogWeekGrid` and `Loot` tests.

1. **(a) Rank chips (R-E1-A):** at `RecipientPicker.tsx:733,742`, `text-accent` → `text-accent-hover`. **T1-a:** a class assertion on both rank spans.
2. **(b) Context line (R-E1-B)** at `:632`.
   - **T1-b1:** log mode, method Drop, a named fight reads `<fight> Floor N · <Label> slot · raid drop`.
   - **T1-b2:** log mode switched to Book has no "raid drop", and neither does an edit of a book entry.
   - **T1-b3:** a generic `floorName === 'Floor N'` and an empty `floorName` each render "Floor N" once, with no empty separator.
3. **(c) PriorityRow (#16):**
   - The `li` is `flex-none` (`PriorityRow.tsx:47`), so today the `truncate` span (`:60`) never shows an ellipsis: the `ul`'s `overflow-hidden` (`:40`) clips it. Give the name span a max width (e.g. `max-w-32`) so `truncate` works.
   - Wrap the span in the `Tooltip` primitive (`components/primitives/Tooltip.tsx`), used the way `RecipientPicker.tsx:721-738` uses it. Check the `ui/` → `primitives/` boundary with an existing `ui/` import of a primitive.
   - The Tooltip needs `matchMedia` (via `useDevice`), so add the stub the way `FloorCard.test.tsx:56-57` does.
   - **T1-c:** the full name is the tooltip content, and the span carries the max-width class.
4. **(d) Books table (#30):**
   - `scope="col"` on the header cells: `BookLedgerCard.tsx:303`, the per-book `:307`, and `:335`. The empty `:335` header gets an `sr-only` "Actions".
   - Each balance button (`:368-381`) gets an `aria-label` that contains its visible digit (label-in-name), e.g. `` `Edit ${playerName} Book ${label} balance, ${value}` ``, from the header's book label and the row's player display name.
   - **T1-d1:** every `columnheader` has `scope="col"` and a non-empty name.
   - **T1-d2:** `getByRole('button', { name: /Book I balance, 3/ })`, using the fixture's values.
5. **(e) Empty fairness:** when the main roster is empty (key it off `most === null`, `utils/lootFairness.ts:90,105`), `FairnessSummary` replaces the Most/fewest and Distribution rows with one empty-state line. Say "static", not "group", and follow sibling Home cards' empty-state wording. The "Drops this tier" and "This week" counts stay: they are truthful at zero. **T1-e:** a **rewrite** of the `FairnessSummary.test.tsx:71-74` case: no "Most / fewest", no "Even", no "spread 0"; the empty line is present; the counts still render.
6. **(f) Header strips (R-E1-C):** remove `bg-surface-base` at `FloorCard.tsx:127` and `LogWeekGrid.tsx:594`. **T1-f:** neither header strip carries `bg-surface-base`.
7. **(g) Store selector (#24, BookLedgerCard only):** `BookLedgerCard.tsx:164-165`'s whole-store destructure becomes `useLootTrackingStore(useShallow((s) => ({ pageBalances, fetchPageBalances, adjustBookBalance, markFloorCleared, fetchPageLedger })))`, the idiom at `stores/tierStore.ts:887`. The `pageLedger` selector (`:169`) is unchanged. If the test file mocks the store as a function that ignores the selector, adapt the mock without weakening any assertion.
8. **(h) Week dots (#15):** add an `sr-only` span beside the `aria-hidden` dots (`WeekScopeControl.tsx:259-270`), using the idiom at `LogWeekGrid.tsx:378`.
   - Word it from a label map (loot → "loot", books → "books", mats → "materials"), e.g. "Logged: loot, books, materials". Feed the same map to the parent's `title` (`:258`), which leaks the raw "mats" today.
   - **T1-h:** a week with data has the SR text and a worded `title`; a week without data has neither.
9. **(i) Aug-slot copy (R-E1-D):** `historyItems.ts:93-95`.
   - **T1-i1:** update `LootHistoryTable.test.tsx:452-455` (`'aug body'` → the `GEAR_SLOT_NAMES` label; the matcher is case-sensitive), and add a ring1 aug row that reads "aug R. Ring".
   - **T1-i2:** a new `historyQuery` test. "ring" and `slot:ring` match a ring1 aug row; "ring1" does not.
10. **Gates.** Commit: `fix(v2): E1 Task 1 — loot & books a11y and copy polish`.

## Task 2 — Board roving focus (RISKIEST · `xivrp-implementer-deep`, `model: fable`)

**Files:** `components/roster/GearBoardCell.tsx`, `components/roster/GearBoard.tsx`, a new pure util beside them (`gearBoardNav.ts`), and their tests. **Before editing, grep to re-confirm that GearBoard and GearBoardCell have no V1 importer. If one appears, stop and report.**

1. **(a) GearBoardCell (#10):**
   - `'aria-disabled': !interactive` (was `disabled`, `:66-74`).
   - Add a `design-system-ignore: <reason>` comment on the `BASE` const's `text-[9px]` (`:29`). It is readable text (R/T/BT/C, ·, ●, —) in a dense 30 px gearsheet cell, and each cell's full meaning is in its `aria-label`.
   - New optional props: `isTabStop?: boolean` (default `true`, so standalone behavior is unchanged), `onNavigate?: (key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight') => boolean` and `onFocus?: () => void`.
   - `handleKeyDown` routes **unmodified** arrows to `onNavigate` and calls `preventDefault` only when it returns `true`. Space/Enter behave as today.
   - `tabIndex` becomes `interactive && isTabStop ? 0 : -1`. `scroll-margin-top` clears the sticky header.
   - **T2-a1:** Space calls `onCycle`. **T2-a2:** Enter calls `onCycle`. **T2-a3:** a disabled cell ignores both. **T2-a4:** an inert-but-enabled cell has `aria-disabled="true"`.
2. **(b) Navigation (R-E1-E):** a pure `nextBoardCell(grid, from, key)`.
   - `grid` holds the rendered player rows × slot columns as `boolean` interactive flags, with non-player rows excluded. The function returns the target `{ row, col }` or `null`.
   - GearBoard builds `grid` from the values it already passes to each cell (`disabled`, `onCycle`, `bisSource`), and maps row/col ↔ `{ playerId, slot }` at render.
   - It moves focus through a ref map or a `data-*` query inside the board's own container ref, never `document`.
   - The table gets an `sr-only` description, wired by `aria-describedby`: "Use arrow keys to move between gear cells."
   - **Unit tests:**
     - **T2-b1:** left/right within a row, skipping non-interactive cells.
     - **T2-b2:** up/down in the same column, skipping rows with no interactive cell in that column.
     - **T2-b3:** edges return `null`.
   - **Component tests:**
     - **T2-b3b:** an arrow at an edge is not `defaultPrevented`.
     - **T2-b4:** Alt+ArrowLeft and Shift+ArrowDown neither move focus nor are `defaultPrevented`.
     - **T2-b5:** with sentinel buttons before and after the board, Tab from the first sentinel lands on exactly one board cell, and the next Tab lands on the second sentinel.
     - **T2-b6:** the fixture is a section divider followed by a non-interactive row (no-BiS or non-editable) and then an interactive row. ArrowDown lands on the interactive row's cell in the same column.
3. **(c) The tab stop (derived at render, keyed by `{ playerId, slot }`):**
   - **T2-c1:** remove the active player: exactly one `tabIndex=0` cell.
   - **T2-c2:** clicking a cell makes it the stop.
   - **T2-c3:** a read-only board (no interactive cells) has no `tabIndex=0` cell, as today.
   - **T2-c4:** remove a player **above** the active cell: the same player and slot keep `tabIndex=0`.
   - **T2-c5:** click a disabled cell: still exactly one `tabIndex=0`, on an interactive cell.
4. **(d) The role border:** at `GearBoard.tsx:173`, `getRoleColor(role)` → `` `var(--color-role-${role}, var(--color-text-muted))` `` (the `RecipientPicker.tsx:753` idiom). Drop the import if it becomes unused. Light role-tank moves from `#5a9fd4` to `#2e7ab4` (`tokens.generated.css:19` vs `:129`), so the Finish takes Board shots in light + dark.
5. **Gates**, plus `pnpm deadcode` (a new file must not raise knip).
6. **Ad hoc mutation check:** make `nextBoardCell`'s up/down stop at the first adjacent row instead of skipping. Paste the failing test names (T2-b2 and T2-b6 are expected), then revert.
7. **Task-scoped review** (slice-loop §1.4): `review-package PLAN $BASE HEAD` → `redesign-reviewer`. Critical/Important → a same-agent fix now. Minors → ledger.
8. Commit: `feat(v2): E1 Task 2 — board roving focus`.

## Task 3 — Palette combobox + one shortcut label (`xivrp-implementer`, sonnet)

**Files:** `components/layout/CommandPalette.tsx` (confirm the path), `components/ui/keyboardShortcutGroups.ts`, a new helper in `lib/` or `utils/`, and their tests. Confirm with a grep that CommandPalette has no V1 importer.

1. **(a) Combobox (R-E1-F).** Rewrite `'activates a command row via keyboard Enter'` (`CommandPalette.test.tsx:251`) to the input-driven flow: rows are no longer tab stops.
   - **T3-a1:** the combobox ARIA is on the input, and ArrowDown moves `aria-activedescendant` to the second option.
   - **T3-a2:** press ArrowDown, **then** type a query: the highlight resets to the first match.
   - **T3-a3:** zero results means no `aria-activedescendant`, and Enter is a no-op.
   - **T3-a4:** Enter runs the highlighted command; Enter during IME composition does not.
   - **T3-a5:** ArrowUp at the first option clamps.
   - **T3-a6:** hovering a row moves the highlight, and only one row carries the highlight class.
2. **(b) One label author (R-E1-G).**
   - **T3-b1:** on a Mac platform both the chip and the row read `⌘K`, and elsewhere `Ctrl+K`. Update `CommandPalette.test.tsx:153-160`, and restore `navigator.platform` in `afterEach`.
   - **T3-b2:** `keyboardShortcutGroups.test.ts:20` (the V1 fixture) and `:68` pass unedited.
3. **Gates.** Commit: `feat(v2): E1 Task 3 — command palette combobox, one shortcut label`.

## Task 4 — Home, Schedule & shell copy (`xivrp-implementer`, sonnet)

**Files:** `components/home/TrackCard.tsx`, `components/ui/SessionRsvpCard.tsx`, `components/schedule/AvailabilityHeatmap.tsx`, `pages/ShellContentStates.tsx`, their tests, and `Schedule.test.tsx`.

1. **(a) TrackCard (U-2):**
   - The tag at `:41` changes from `Ring 3` to `Mount farm`.
   - Drop the tertiary `<span>` at `:43-48`.
   - **T4-a:** rename and update `TrackCard.test.tsx:31-34` to assert "Mount farm", and assert that "Progress Engine" is absent.
2. **(b) Next-session title (U-3, R-E1-I).**
   - **T4-b1:** the next variant shows the "Next session" heading and the session title as a level-4 heading.
   - **T4-b2:** the later variant is unchanged.
   - **T4-b3:** an empty title renders no heading line.
   - **T4-b4:** with the title line rendered and no day label, the title appears once.
   - Update the flipping assertion at `SessionList.test.tsx:80`, and the "ONE sanctioned delta" lock at `SessionRsvpCard.test.tsx:190`.
3. **(c) Heatmap manager cells (R-E1-H):** `AvailabilityHeatmap.tsx:166-180`. **T4-c:** the `AvailabilityHeatmap.test.tsx:113` case queries the new exact accessible name (it was "Tue 7:00 PM — 2 of 2 free"), and the cell carries `title` = the names.
4. **(d) The v2 delete flow (#39)**, in `Schedule.test.tsx` (the chain is at `Schedule.tsx:354-383`, `:505-527`).
   - **T4-d1:** recurring delete → "Delete recurring session" → "Cancel just this occurrence" calls the cancel path and closes the modal.
   - **T4-d2:** "Delete entire series" → `ConfirmModal` → the delete is called.
   - Test-only. No escape clause: both tests are new.
5. **(e) Static vocab (B1):**
   - At `ShellContentStates.tsx:180-181`, the heading becomes "Static Not Found" and the line becomes "The static you're looking for doesn't exist."
   - **T4-e:** update `ShellContentStates.test.tsx:134-138`.
6. **Gates.** Commit: `fix(v2): E1 Task 4 — home, schedule & shell copy (U-2, U-3), heatmap names, delete-flow tests`.

---

## Finish (controller)

1. **Browser pass** (dev-auth, `/group/DEVTST?shell=v2`; recipe in memory `feedback_browser_validation_process`):
   - **Loot:** the picker in log/edit with Drop and Book, the FloorCard and Log headers in light + dark, the Books table, the week dots and a long-name PriorityRow (ellipsis + tooltip).
   - **Roster Board** in light + dark: Tab in once, arrows move (including under the sticky header), Space cycles, Tab leaves.
   - **Palette:** Ctrl+K, arrows, Enter.
   - **Home:** the TrackCard and the next-session card.
   - **Schedule:** the next card and a manager heatmap title.
   - **Not-found state:** a bad share code.
   - **V1:** `?shell=legacy`, with Roster/Loot/Schedule unchanged.
   - Shots go to `docs/redesign/pr-shots/e1-*.webp`.
2. **Write-back (one commit):**
   - `ROLLOUT_ROADMAP.md` §7: E1 closed items, E2 = the impeccable pass, and the carried list below. Phase F gains the `fetchCurrentWeek` stale-response race that #274 declined (user-approved 2026-09-25).
   - `REDESIGN_SPEC.md` §10 `:356`: U-1 / R-E1-J.
   - `specs/phase-d-loot-design.md` R-D14-B: provisional → final (U-5), closing `plans/2026-09-25-phase-d14-elsewhere-shortcuts.md:274`'s holistic item.
   - Record U-4 and U-6 where their items live.
   - Update memory `feedback_defer_holistic_review` (controller only; not committed).
3. **Release note** 2.1.33 (internal), then `pr-checklist`, the Finish gates, and a draft PR.

## Status check — the 41 holistic items (2026-09-25, `530fa383`)

- **Closed before E1 (fixed or obsolete):**
  - #1, #2 and #4 (Phase A/C cards and seats);
  - #17 (Weapons segment);
  - #19 (`lview`/`rview` seeded, `useUrlTabState.ts:37-39`);
  - #21 (Alt+Click-only ruling);
  - #26 (reset targets the displayed week);
  - #28 (`LootEntryRow` deleted; the type is in `logWeekGridData.ts`);
  - #35 (no bleed; 44 px via Button);
  - #37 (#175);
  - #41 (#173 scaffold);
  - #11's `rview` seeding and `switchTab` anchoring (`e2e/helpers/auth.ts:188`).
- **Closed by E1:** #10, #15, #16, #23, #25, #29, #30, #31, #33, #39, #11's hex border, the Ctrl+K literal, the palette arrows and the v2 "Group Not Found" copy. By ruling: #6 (U-4) and #18 (U-1, R-E1-J).
- **Carried, each with a named home:**

| Home | Items |
|---|---|
| Holistic / Phase P (design calls) | #3 card richness · #7 Board denominator vs color · #8 two "no BiS" signals · #12 search-hidden selection · #13 adjustments close-on-failure · #14 subs in adjustments · #20 materials-picker unification · #22 accent-tint idiom · #32 membership intersection · #34 rsvp-row role seam · R-E1-J's compact fight-only controls |
| Phase P (mobile) | #11 SegmentedToggle 44 px touch target |
| E2 (impeccable pass, visual) | #5 spacing nit · #36 ultra-wide glyph adjacency |
| Phase F (semantics / shared store / enforcement / backend) | #9 `currentSource` recalc · #24's remaining whole-store destructures, `LogWeekWizard/index.tsx:96` and `QuickLogMaterialModal.tsx:333` (legacy `LootPriorityPanel` mounts both) · #27 `clearAllPageLedger` player set (shared V1 store) · #38 boundary-evening week · #11 Split planner/Export re-home · #11 `Badge.tsx` contrast-harness exclusion · the `fetchCurrentWeek` stale-response race (#274) |
| Next mechanical slice | #40 null-anchor strip (`WeekNavigatorStrip.tsx:49-53,66`) |
