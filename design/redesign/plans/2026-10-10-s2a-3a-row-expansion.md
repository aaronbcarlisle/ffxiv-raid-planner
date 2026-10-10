# S2a-3a · The farm row expansion (V2)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo. Each PR below is one slice-loop run: its own ledger, one whole-branch review against its parent branch, one fix wave.

**Goal:** level 2 of Progress for farm rows. A farm row opens (click or `?track=<goalId>`, one at a time) into a panel: an action bar (a lead's **Log drop for {#1}** split button or a member's **I got it**, plus **Copy plan**), then **Next in line · Last drops · About**. Leads get a row menu: Edit (inline, §12.2), Mark finished (with Undo), Reopen on finished rows, and Delete.

**Design (binding):** `design/redesign/specs/2026-10-09-s2a-3a-row-expansion-design.md`, decisions D-1…D-18 and §3–§7. It sits on the parent spec, `design/redesign/specs/2026-09-30-s2a-progress-design.md`: S2-5 (Finished, Reopen), S2-8 (the queue), S2-9 (the expanded row), §4, §7 criteria 4, 5 (`?track=<id>`), 10 and 11, and the S2a-1 rulings (R-S1-13, R-S1-14, R-S1-19).
**Parity matrix (binding):** `design/redesign/specs/2026-09-30-s2a-parity-matrix.md`: the 28 "· S2a-3a" rows (mapped in the design note §6) and §12.2's field table (G-14).
**S2a-2 plan (binding):** `design/redesign/plans/2026-10-08-s2a-2-progress-tab.md`: R-S2-1 (the stacks and the preflight), R-S2-2 (V1 byte-identical), R-S2-5 (`utils/` as the pure home), R-S2-10 (who edits; View As), R-S2-16 (release numbering), R-S2-17 (absent controls), and its hand-off list (:529).
**Scope (binding).** V2 frontend under `frontend/src/components/progress/`, pure helpers in `frontend/src/utils/`, one hook in `frontend/src/hooks/`, additive store actions, one additive backend response field (R-S3-12), `releaseNotes.ts`, and the e2e specs named below. `backend/app/database.py` gets no edits. No migration. **V1 renders byte-for-byte as today:** the only V1 file touched is `components/collections/CollectionsHub.tsx`, which imports the moved `buildDiscordPlan` (R-S3-2).
**Plugin contract (binding, `CLAUDE.md` § Pitfalls).** The plugin calls no `collection-goals` route. The one response change (R-S3-12) is additive.

## Size and stack

Estimates use the S2a-2 rule: code lines ÷ 0.35 (tests), × 1.8 (the measured overrun). The cap is ~1,500 changed lines, plan excluded (slice-loop rule 1). The cap, not slice-loop's 3–4 tasks, sets the cut (as in S2a-2): five PRs, nine tasks.

| PR | Slice | Branch · base | Tasks (est. total lines) | Total |
|---|---|---|---|---|
| G1 | **S2a-3a·G1** the models | `feat/s2a3a-g1-models` · `feat/s2a2-f6-edit-statuses` (#375, `57f1542c`) | TG1 the queue (~650) · TG2 Copy plan, week label, `?track=`, the drop's character (~800) | ~1,450 |
| G2 | **S2a-3a·G2** the panel | `feat/s2a3a-g2-panel` · G1 | TG3 disclosure, `?track=`, the panel row and the grid (~1,050, **deep, `model: fable`**) · TG4 Next in line, About, Copy plan (~450) | ~1,500 |
| G3 | **S2a-3a·G3** logging | `feat/s2a3a-g3-logging` · G2 | TG5 Log a drop, I got it, Undo, the read-model refresh, the last three drops (~1,250, **deep**) | ~1,250 |
| G4 | **S2a-3a·G4** drops and the row menu | `feat/s2a3a-g4-menu` · G3 | TG6 Show all and drop delete (~450) · TG7 the row menu: Mark finished, Reopen, Delete (~700) | ~1,150 |
| G5 | **S2a-3a·G5** Edit and the proof | `feat/s2a3a-g5-edit` · G4 | TG8 inline Edit (~900) · TG9 e2e, axe, role gating, contrast (~600) | ~1,500 |

- **One worktree:** `.claude/worktrees/s2a3a`, created from `feat/s2a2-f6-edit-statuses`. Copy `frontend/.npmrc` in before `pnpm -C frontend install` (`CLAUDE.md`).
- **The cap.** At each Finish run `git diff --stat <parent>...HEAD`. Over ~1,500 → the PR's last task ships as its own PR stacked on top (G2 → TG4 as G2b; G5 → TG9 as G5b). Don't trim tests.
- **Merging (R-S2-1).** Every PR opens as a draft. After G5 (or G5b): push its top commit to `redesign/s2a2-preflight` (a draft PR to `main` labelled `no-automerge`, for the record), and once that push run is green on the exact tree, update the whole stack (slice-loop § Stacked PRs) and merge #370…#375 then G1…G5 bottom-first in one session. Link the run in #370's body. Close the preflight PR after.
- **Before G1:** `git fetch`; if anything below #375 moved (the owner may merge mid-loop), update the stack first.

## Code facts checked (worktree `s2a2b` at `57f1542c`, 2026-10-10)

| Fact | Where | Consequence |
|---|---|---|
| The matrix is `<table role="grid">`; `useMatrixKeyboard(rowIds, colKeys)` returns `cellProps(rowId, colKey)` (ref, tabIndex, focus, keydown); cells are a ref map keyed by row and column; movement is by index | `progress/ProgressMatrix.tsx:~122`, `progress/useMatrixKeyboard.ts` | The name cell joins the grid as a leading column key (R-S3-4) |
| The rowheader `<th role="rowheader">` has no focus props | `progress/FarmRow.tsx:~46` | TG3 adds the disclosure `Button` there |
| Finished rows are a second `<tbody>` in the same table, rendered by `FarmRow` without `keyboard` | `progress/FinishedFarms.tsx` | Their disclosure is a plain tab stop (R-S3-4) |
| The colSpan is inline: `columns.length + 2` | `ProgressMatrix.tsx` | TG3 names it once (`spanAll`) |
| `ProgressPage` props: `group, tier, canManage, userRole, currentUserId, isViewingAs, onNavigate`; `week` from `useLootTrackingStore(s => s.currentWeek)` gated by `weekClockKey`; `weekStartDate` exists in that store but isn't selected | `progress/ProgressPage.tsx` (268 lines); `stores/lootTrackingStore.ts:59-65` | TG2's label takes both (R-S3-9) |
| `toast.withUndo(message, onUndo, duration = 8000)`, `toast.error`, `toast.success` | `stores/toastStore.ts:104` | Every Undo uses `withUndo` |
| `logDrop(groupId, goalId, RewardDropCreate): Promise<RewardDrop>`; `deleteDrop(groupId, goalId, dropId)`; `fetchDrops(groupId, goalId)` (swallows errors, `dropsLoading`); `updateGoal`; `deleteGoal`; `fetchProgress(groupId, goalIds?)`. The first two refetch only participants and goals | `stores/collectionGoalStore.ts` (864 lines) | R-S3-5 adds V2's refresh |
| `RewardDrop` has no character name; `RewardDropResponse` omits it though the row stores it | store `:164`; `backend/app/schemas/collection_goals.py:248-262`; `routers/collection_goals.py:217-229,1526` | R-S3-12 |
| `CollectionGoalUpdate` serializes nullable fields with `'x' in u` | store `:256` | Edit sends only the fields it shows (R-S3-10) |
| `buildDiscordPlan(goal, participants)` is pure, unexported, sorts by `priorityRank ?? 999`, names by `displayName ?? userId`; the caller toasts "Farm plan copied to clipboard!" | `components/collections/CollectionsHub.tsx:19-56,108-114` | R-S3-2 |
| RewardGoalModal's content options (`unreal`, `eureka`, …) don't match the server's 7; the server's 7 have labels in `CreateCollectionGoalModal.tsx:22-30`; all option lists are unexported | `components/collections/RewardGoalModal.tsx:12-51`; `components/static-group/CreateCollectionGoalModal.tsx` | V2 owns its option lists (R-S3-10) |
| `useUrlTabState` takes a fixed value list; its registry is seeded by `SEEDED_TAB_PARAMS` and cleared by `clearRegisteredTabParams` | `hooks/useUrlTabState.ts:42,80` | R-S3-3 |
| Row-menu precedent: an `IconButton` (`MoreVertical`, `aria-haspopup="menu"`) opening `ContextMenu` at the button | `components/loot/BookLedgerCard.tsx:332`; `components/ui/ContextMenu.tsx` | TG7 follows it |
| No split-button primitive exists | — | TG5 composes two `Button`s and a `Popover` (R-S3-6) |
| `CURRENT_VERSION = '2.1.72'`; items carry `category, title, description, pr, prTitle, internal` | `data/releaseNotes.ts:12,63` | R-S3-11 |

## Rulings (bind every task)

- **R-S3-1 (stack).** As § Size and stack. Every PR is a draft until the whole stack merges (R-S2-1).
- **R-S3-2 (Copy plan, D-2).** `buildDiscordPlan` moves to `utils/discordPlan.ts` as `buildDiscordPlan(goal, ordered: readonly DiscordPlanEntry[])`, where `DiscordPlanEntry = { name: string; state: ParticipantState; count: number | null }`. Its lines, emoji and labels are unchanged. **The sort leaves the function**: `CollectionsHub` maps its participants with today's sort (`priorityRank ?? 999`, names `displayName ?? userId`) and keeps its toast text. A test written **first, against today's unmoved code** (`CollectionsHub.copyPlan.test.tsx`: render, click Copy plan, capture the clipboard) pins V1's text and must pass unedited after the move. V2 passes `queueFor`'s order for Need and Want, then Have in column order; a hidden count is `null` (so "Can buy now" never lists a hidden count); its toast reads "Plan copied" (D-17).
- **R-S3-3 (`?track=`, D-8).** `useTrackParam(): [string | null, (id: string | null) => void]` reads `track` with `useSearchParams` and writes with `replace`. Add `track` to `SEEDED_TAB_PARAMS`, so leaving the tab clears it. `ProgressPage` drops an id only **after** goals have loaded and the id matches no goal of this static (never during loading). A finished goal's id expands Finished (n) first, then opens the row. The open row scrolls into view once per open (`scrollIntoView({ block: 'nearest' })`).
- **R-S3-4 (the grid, D-7).** `ProgressMatrix` prepends the key `'__name'` to `colKeys` for active rows; the disclosure `Button` in the rowheader takes `cellProps(goalId, '__name')`. So Home lands on the name, ArrowLeft from the first player cell reaches it, and Enter or Space toggles (native button). The panel is `<tr role="row" data-testid="progress-expansion"><td role="gridcell" colSpan={spanAll}>` **after** its farm row and **not** in `rowIds`, so arrow keys skip it; Tab from the open row's roving cell moves into the panel. Closing returns focus to the name button. Escape inside the panel (outside Edit) closes it. Finished rows' disclosure is a plain tab stop (their cells stay outside the grid, as S2a-2 parked). axe 0 critical / 0 serious with a row open, both themes.
- **R-S3-5 (the read-model refresh).** New store action `refreshGoalProgress(groupId, goalId, { lists?: boolean })`: `fetchProgress(groupId, [goalId])`, and with `lists` also `fetchGoals(groupId)` and `fetchProgress(groupId)` (a farm moved between active and Finished). V2 calls it after a log, a drop delete, an Undo, Mark finished, Reopen and Edit. `logDrop`/`deleteDrop`/`updateGoal` keep their behaviour (V1 delta (e)).
- **R-S3-6 (Log a drop, D-6).** `LogDropButton` = a `Button` "Log drop for {name}" plus an `IconButton` "More recipients" (`aria-haspopup="dialog"`) in one `role="group"` named "Log a drop", the second opening a `Popover` named "Log a drop for {track}". The picker is a `role="radiogroup"` of `Button`s with `aria-checked` (queue in order with "#n · {state} {count}", then a "Not in the queue" label and every other claimed column in column order, then Nobody), an `Input` "Note (optional)" (≤ 500 characters), and "Log drop" / "Cancel". With no #1 (`free_roll` or an empty queue) the main button reads "Log a drop", opens the picker, and Nobody is preselected. **Both buttons are disabled while a log is in flight** (no double drop). Leads only (`canManage && userRole !== 'viewer'`); hidden otherwise (ROLE-1). Absent on finished rows.
- **R-S3-7 (I got it, D-5).** Shown to a non-lead member whose own cell (`cell.own`) is claimed and not Have, on active rows. It sends `recipientUserId` = the own column's `userId`, never the caller's id, so under View As it logs for the viewed user; the backend then treats it as a lead's drop (no record write), a disclosed View As note (as R-S2-10). One click, no note.
- **R-S3-8 (Undo).** A log's Undo is `deleteDrop` on the returned id, then `refreshGoalProgress`. The toast (D-16) is `withUndo`, so Undo works after the row closes. A failed Undo toasts "Couldn't undo the drop" and keeps it. Mark finished's Undo is `updateGoal({ status: prior })` with the status read **before** the write.
- **R-S3-9 (week labels, D-15).** `dropWeekLabel(droppedAt, { currentWeek, weekStartDate }, now?)`: when both are known and the drop is on or after `weekStartDate − (currentWeek − 1) × 7 days`, "Week n" with n = `currentWeek − ceil((weekStartDate − droppedAt) / 7 days)`, else a date in `en-GB` short form ("12 Mar"; add the year when it isn't this year). Normalize U+202F before comparing in tests (memory `reference_intl_narrow_nbsp`).
- **R-S3-10 (Edit, §12.2, D-12).** V2's option lists live in `utils/goalTypeMeta.ts` (new exports `GOAL_STATUS_OPTIONS` (Wanted · Farming · Scheduled), `CONTENT_TYPE_LABELS` (the server's 7, labelled as `CreateCollectionGoalModal.tsx:22-30`), `PRIORITY_MODE_OPTIONS` (the 6, with a one-line queue help each)); V1's files keep theirs. Edit sends only `title, goalType, status, contentType, contentKey, priorityMode, summary`, and only the changed ones. Save is disabled while Title is blank or nothing changed. Content Key ≤ 50, Title ≤ 200 (the schema's limits). A dirty Edit blocks opening another row behind `ConfirmModal` "Discard changes?" (Discard / Keep editing).
- **R-S3-11 (release notes, R-S2-16).** Each PR adds one `internal: true` item to 2.1.72 with `pr`/`prTitle` (no commit SHAs). `git fetch` at each Finish; renumber if `releaseNotes.ts` moved on `origin/main`. Escape `'` as `\'`.
- **R-S3-12 (the drop's character).** `RewardDropResponse` gains `recipient_character_name: str | None = None`, filled from the drop row in `_drop_response` (`routers/collection_goals.py:217-229`) for the create, list and any other drop response. The client type gains `recipientCharacterName: string | null`. The drop list shows "{player} ({character})" only when the character name differs from the player's name (design §3.4).
- **R-S3-13 (absent controls, R-S2-17).** Change order (D-1) and Schedule a farm night are absent, not stubbed. Viewers see the panel with no action except Copy plan, and no row menu.

## Review Focus

- **The queue's edges (TG1).** All counts hidden; ties; a drop-only farm; `desired_only` with only Wants (empty queue → "Log a drop" with Nobody); a Want with a lower count than a Need stays after it. Pinned in TG1's tests.
- **`?track=` before the data (TG3).** A deep link while goals are still loading keeps the id and opens the row once they arrive; a finished id waits for Finished's fetch; a foreign or deleted id is dropped only after load. Pinned in TG3's tests.
- **A row that changes under the panel (TG5, TG7).** Mark finished, Reopen or Delete on the open row: the panel follows the goal (into Finished, or closes and clears `?track`) with no crash and no stale actions. Pinned in TG7's tests.
- **Double writes (TG5).** A double click on "Log drop for …" or "I got it" sends one drop. Pinned in TG5's tests.
- **View As (TG5).** "I got it" under View As logs for the viewed user, never the admin. Pinned in TG5's tests.
- **V1 unchanged (TG2).** The Copy plan pin passes unedited after the move; no other V1 file appears in any diff.
- **a11y.** Every panel control is reachable by Tab and named; the split button's two halves have distinct names; axe clean with the row, the picker and Edit open, both themes at 1440 × 900 (TG9).
- **UI rules.** No raw elements; semantic tokens; `text-xs` floor; no modal except the two confirms and "Discard changes?"; no sticky panel.

---

### PR G1 · S2a-3a·G1 — the models

#### Task TG1 — the queue (`xivrp-implementer`)

**Goal:** `queueFor` per design §3.1, the one order every consumer uses.

**Files.** Create `frontend/src/utils/progressQueue.ts` and `progressQueue.test.ts`. Add G1's internal release item ("Progress: the farm queue model", `internal: true`).

**Interfaces — produces:**
```ts
export interface QueueEntry {
  cell: ProgressCell;          // from utils/progressModel
  rank: number;                // 1-based
  state: 'need' | 'want';
  count: number | null;        // null when hidden or unknown
  countHidden: boolean;
}
export function queueFor(row: FarmRow, mode: CollectionPriorityMode | null): QueueEntry[];
export function queueEntryText(e: QueueEntry, tokenCost: number | null): string; // "Need 12/99", "Need" when hidden, "Want 30" when no cost
```

1. **Tests first** (fixture rows built with the existing `__fixtures__` helpers):
   - Need before Want; within each, fewest count first; ties keep column order;
   - a hidden count (`countHidden: true`) ranks after every known count in its state, and so does an unknown (`null`) count; two hidden keep column order;
   - Have, Pass, blank, unclaimed and Not-on-the-roster columns are excluded;
   - `free_roll` → `[]`; `desired_only` → Need only (a row with only Wants → `[]`); `everyone_gets_one`, `priority_order`, `custom` and `null` → the full rule;
   - a drop-only farm (`goal.tokenCost === null`) orders by column order within each state, ignoring counts;
   - `priority_rank` on an entry changes nothing (D-1);
   - ranks are 1-based and contiguous;
   - `queueEntryText`: "Need 12/99", "Want 80/99", "Need" when hidden, "Need 12" when `tokenCost` is null.
2. **Implement.**
3. **Gates:** the touched tests, `lint`, `build`, `deadcode` (the exports are used by TG4/TG5; until then list them in the ledger, as S2a-2 did).

#### Task TG2 — Copy plan, the week label, `?track=`, the drop's character (`xivrp-implementer`)

**Goal:** the remaining pure pieces and the one backend field.

**Files.**
- Create `frontend/src/components/collections/CollectionsHub.copyPlan.test.tsx` **first** (R-S3-2) and commit it alone ("test: pin V1 Copy plan text"), passing on today's code.
- Create `frontend/src/utils/discordPlan.ts` (+ test), `frontend/src/utils/dropWeek.ts` (+ test), `frontend/src/hooks/useTrackParam.ts` (+ test).
- Modify `components/collections/CollectionsHub.tsx` (import the builder, map with today's sort), `hooks/useUrlTabState.ts` (`SEEDED_TAB_PARAMS` gains `track`), `stores/collectionGoalStore.ts` (`RewardDrop.recipientCharacterName`), `backend/app/schemas/collection_goals.py`, `backend/app/routers/collection_goals.py` (`_drop_response`), `backend/tests/test_collection_goals.py` (add the drop-response cases).

**Interfaces — produces:** `buildDiscordPlan(goal, ordered: readonly DiscordPlanEntry[]): string`; `DiscordPlanEntry`; `dropWeekLabel(droppedAt: string, clock: { currentWeek: number | null; weekStartDate: string | null }, now?: Date): string`; `useTrackParam(): [string | null, (id: string | null) => void]`; `RewardDrop.recipientCharacterName: string | null`.

1. **Tests first:**
   - the V1 pin: a farm with Need, Want, Have, a can-buy count and a note, ranks set out of name order; the clipboard text equals today's string exactly (write the expected string out in the test);
   - `buildDiscordPlan` with ordered entries reproduces each line (`**{title}** farm plan`, `Mode: …`, `Exchange: …×…`, `🎯 **Need (n):**`, `⭐ **Want (n):**`, `💰 **Can buy now:**`, `✅ **Have (n):**`, `📝 {note}`), lists names in the given order, and never lists an entry with `count: null` under Can buy now;
   - `dropWeekLabel`: this week → "Week {currentWeek}"; 8 days before `weekStartDate` → "Week {currentWeek − 2}"; before week 1 → "12 Mar"; last year → "12 Mar 2025"; unknown clock → a date;
   - `useTrackParam`: reads `?track=abc`; setting writes in place (history length unchanged); `null` removes it; `clearRegisteredTabParams` removes `track`;
   - pytest: a logged drop's response and the list response carry `recipient_character_name` (the resolved character's name), and `null` for a Nobody drop.
2. **Implement** R-S3-2, R-S3-3's hook, R-S3-9, R-S3-12.
3. **Gates:** the touched tests, `pytest tests/ -q`, `lint`, `check:design-system:strict`, `build`, `deadcode`, `dupes`.

**Acceptance:** V1's Copy plan text unchanged in the running classic view (paste before/after into the PR body). Curl pair for a drop's new field.

### PR G2 · S2a-3a·G2 — the panel

#### Task TG3 — disclosure, `?track=`, the panel row and the grid (RISKIEST of S2a-3a · `xivrp-implementer-deep`, `model: fable`)

**Goal:** a farm row opens and closes, one at a time, by click, keyboard or `?track=`, with the grid intact (D-7, D-8, R-S3-3, R-S3-4).

**Files.** Create `frontend/src/components/progress/FarmExpansion.tsx` (the panel shell: an empty action bar slot and the three column slots, filled by TG4–TG5) and its test. Modify `FarmRow.tsx` (disclosure `Button` with chevron, `aria-expanded`, `aria-controls`), `ProgressMatrix.tsx` (`'__name'` key, `spanAll`, render the panel after the open row, in both `<tbody>`s), `FinishedFarms.tsx` (open state), `ProgressPage.tsx` (owns `openId` through `useTrackParam`; scroll; drop-after-load). Extend `ProgressMatrix.test.tsx`; new `ProgressPage.track.test.tsx`.

**Interfaces — produces:** `FarmExpansion` props `{ row: FarmRow; finished: boolean; canManage: boolean; userRole: MemberRole | null | undefined; groupId: string; onClose(): void }`; `ProgressMatrix` gains `openId: string | null; onToggle(goalId: string): void`.

1. **Tests first:**
   - the name cell is a `Button` named "{title}" with `aria-expanded="false"`; clicking opens the panel (`progress-expansion`) right after that row and sets `aria-expanded="true"`; clicking another row closes the first; clicking the open one closes it;
   - clicking a player cell (own-cell picker) never opens the row;
   - keyboard: Home from a player cell focuses the name button; ArrowLeft from the first player cell too; ArrowDown from the name moves to the next row's name; Enter toggles; ArrowDown from the open row skips the panel to the next farm row;
   - Tab from the open row's cell reaches the panel's first control; Escape in the panel closes it and focuses the name button;
   - `?track=<active id>` opens that row on load and calls `scrollIntoView` once; `?track=<finished id>` expands Finished (n) and opens that row; `?track=` while goals are loading keeps the id, then opens it; `?track=<unknown>` is removed after goals load; opening writes `?track` in place and closing removes it;
   - the panel row is `role="row"` with one `role="gridcell"` spanning `spanAll`, outside `rowIds`.
   - (axe is e2e-only here: `@axe-core/playwright`. G2 adds one case to `e2e/progress.spec.ts`, axe with a row open in both themes; TG9 widens it.)
2. **Implement.**
3. **Gates:** the touched tests, `lint`, `check:design-system:strict`, `build`, `deadcode`.

#### Task TG4 — Next in line, About, Copy plan (`xivrp-implementer`)

**Goal:** the panel's read-only parts and Copy plan, for every role (D-4, D-13's queue half, D-17, D-18; Q-3).

**Files.** Create `progress/QueueList.tsx`, `progress/AboutBlock.tsx` and tests. Modify `FarmExpansion.tsx` (columns, the Copy plan `Button` in the action bar). Add G2's internal release item.

**Interfaces — consumes:** `queueFor`, `queueEntryText` (TG1); `buildDiscordPlan` (TG2). **Produces:** in `utils/goalTypeMeta.ts`, `CONTENT_TYPE_LABELS: Record<CollectionContentType, string>` and `PRIORITY_MODE_OPTIONS: readonly { value: CollectionPriorityMode | null; label: string; help: string }[]` (R-S3-10); TG8 reuses both.

1. **Tests first:**
   - Next in line shows the top four as "{name} · {queueEntryText}", ordered; "Show all ({n})" appears only when more than four are queued and expands in place; `free_roll` reads "Free roll: no queue"; an empty queue reads "Nobody needs it";
   - a viewer's queue entries show states with no counts (counts are null for them, R-S1-19);
   - About shows content (label + key), priority mode (label; null reads "Everyone gets one") and notes (`summary`), each omitted when empty; "No details yet" when all are;
   - Copy plan writes `buildDiscordPlan(goal, V2 order)` to the clipboard and toasts "Plan copied"; a clipboard rejection toasts "Couldn't copy the plan";
   - Copy plan renders for owner, lead, member and viewer.
2. **Implement.**
3. **Gates:** as TG3, plus `dupes`.

**Acceptance (browser, G2):** as DevOwner on a seeded farm: open by click, by keyboard (Home, Enter) and by `?track=`; one open at a time; Copy plan pasted into the PR body. As a viewer: no counts. Shots: closed, open, Show all, keyboard focus on the name; light and dark.

### PR G3 · S2a-3a·G3 — logging

#### Task TG5 — Log a drop, I got it, Undo, the refresh, the last three drops (RISKIEST in G3 · `xivrp-implementer-deep`)

**Goal:** criterion 4 (D-5, D-6, D-16, R-S3-5…R-S3-8).

**Files.** Create `progress/LogDropButton.tsx`, `progress/IGotItButton.tsx`, `progress/DropList.tsx` (the last three, labels, character; TG6 adds Show all and delete) and tests. Modify `FarmExpansion.tsx` (action bar), `stores/collectionGoalStore.ts` (`refreshGoalProgress`), extend `stores/collectionGoalStore.progress.test.ts`. Add G3's internal release item.

**Interfaces — produces:** `refreshGoalProgress(groupId: string, goalId: string, opts?: { lists?: boolean }): Promise<void>`.

1. **Tests first:**
   - a lead sees "Log drop for Healer 1" (#1); one click sends `POST …/drops` `{ recipient_user_id: <#1>, notes: null }`, toasts "Drop logged for Healer 1" with Undo, and calls `refreshGoalProgress`; a double click sends one request;
   - the ▾ opens the picker named "Log a drop for {track}": the queue in order with "#n", "Not in the queue" with the rest of the claimed columns in column order, then Nobody; #1 checked; picking Melee 2 and a note "first clear" sends both; Nobody sends `recipient_user_id: null` and toasts "Drop logged · Undo";
   - `free_roll`: the main button reads "Log a drop", opens the picker, Nobody checked; an empty queue behaves the same;
   - Undo calls `deleteDrop` with the returned id, then refreshes; it works after the panel closes; a failed Undo toasts "Couldn't undo the drop";
   - a member with an own cell on Need, Want, Pass or blank sees "I got it"; on Have, nothing; a viewer, nothing; one click sends their own column's `userId` and toasts "Logged as yours · Undo";
   - **under View As** (`isViewingAs`, `currentUserId` = the viewed user) "I got it" sends the viewed user's id;
   - finished rows show no drop action;
   - a failed log toasts an error and leaves the row unchanged;
   - the last three drops render newest first as "Week 10 · Melee 1 · ×1 · first clear", with "(Aria Moon)" when the character name differs; no drops reads "No drops logged yet."; a failed fetch reads "Couldn't load drops" with a Retry `Button`;
   - `refreshGoalProgress` fetches the one goal's progress, and with `lists` also the goals and the full progress.
2. **Implement.**
3. **Gates:** the touched tests, `lint`, `check:design-system:strict`, `build`, `deadcode`.

**Acceptance (browser), criterion 4:** as DevOwner: log for #1 in one click and Undo; log for someone else with a note; Nobody. As DevMember: "I got it", watch the cell turn Have and Profile ▸ Collections show it, Undo and watch both return; then set Have and see "I got it" disappear. After a plugin token sync (`POST plugin/collections/sync` with the dev API key, as S2a-1's walk), Undo still restores. Shots: split button, picker, toasts, member view; light and dark.

### PR G4 · S2a-3a·G4 — drops and the row menu

#### Task TG6 — Show all and drop delete (`xivrp-implementer`)

**Goal:** D-13's drops half and D-14.

**Files.** Modify `progress/DropList.tsx` and its test. Add G4's internal release item.

1. **Tests first:**
   - "Show all ({n})" under the last three expands in place to every fetched drop (≤ 50);
   - the delete `IconButton` ("Delete drop for {name}, {date}") shows for a lead on every drop, for a member on drops whose `createdById` is theirs, and for nobody else (a viewer: none);
   - it opens `ConfirmModal` "Delete this drop?" with the message `Delete this drop? {recipient ?? 'The recipient'} goes back to {Need|Want} if it was their only drop.` when `recipientPriorState` is set, else `Delete this drop?`, label "Delete"; confirming calls `deleteDrop` then `refreshGoalProgress`; a failure keeps the confirm open with an error toast.
2. **Implement.**
3. **Gates:** as TG5.

#### Task TG7 — the row menu: Mark finished, Reopen, Delete (`xivrp-implementer`)

**Goal:** D-9, D-10, D-11; P-46's "Everyone has it · Mark finished".

**Files.** Create `progress/FarmRowMenu.tsx` and its test. Modify `FarmRow.tsx` (menu `IconButton` in the rowheader, after the name; the "· Mark finished" `LinkText`-style `Button` beside "Everyone has it"), `FinishedFarms.tsx`, `ProgressPage.tsx` (close and clear `?track` when the open goal is deleted; follow it into or out of Finished).

1. **Tests first:**
   - leads see an `IconButton` "Actions for {title}" (`aria-haspopup="menu"`) opening `ContextMenu` with Edit · Mark finished · Delete on active rows and Reopen · Delete on finished rows; members and viewers see no button (hidden, not disabled);
   - Mark finished sends `PUT …` `{ status: 'complete' }`, toasts "Marked finished · Undo", refreshes with `lists`; Undo sends `{ status: <the prior status> }` (Wanted, Farming and Scheduled each pinned);
   - "Everyone has it · Mark finished" does the same and shows only for leads when n = m > 0;
   - Reopen sends `{ status: 'farming' }` and toasts "Reopened";
   - Delete opens `ConfirmModal` titled "Delete Goal" with `Delete "{title}"? This will remove all participant states and drop history for this goal.`, label "Delete", danger; confirming calls `deleteGoal`, closes the panel and removes `?track`;
   - the open row stays open as it moves into Finished (Finished expands) and back out on Reopen;
   - Edit opens the row (TG8 fills the block; until then it only opens the row).
2. **Implement.**
3. **Gates:** as TG5.

**Acceptance (browser, G4):** as DevOwner: Show all, delete a drop (confirm names the prior state), Mark finished + Undo, the "Everyone has it" link on a farm everyone has, Reopen, Delete a seeded farm. As DevMember: delete only their own drop; no menu. Shots of each; light and dark.

### PR G5 · S2a-3a·G5 — Edit and the proof

#### Task TG8 — inline Edit (`xivrp-implementer`)

**Goal:** §12.2 exactly, with D-12.

**Files.** Create `progress/FarmEditBlock.tsx` and its test. Modify `FarmExpansion.tsx` (the block on top while editing), `FarmRowMenu.tsx` (Edit enters it), `ProgressPage.tsx` (the dirty guard on opening another row), `utils/goalTypeMeta.ts` (`GOAL_STATUS_OPTIONS`; TG4 created the others). Add G5's internal release item.

1. **Tests first:**
   - Edit opens the row with the block on top and Title focused; fields: Title (`Input`, required, ≤ 200), Type (`Select`, the 10), Status (`Select` Wanted · Farming · Scheduled), Content (`Select` None + the server's 7, with CreateCollectionGoalModal's labels) and its key (`Input` "Duty or key (optional)", ≤ 50), Priority mode (`Select`, the 6, with the help line for the chosen one), Notes (`Input`, writes `summary`);
   - Save is disabled while Title is blank or nothing changed; Save sends `PUT` with only the changed fields of those seven (never `note`), toasts "Saved", refreshes, and closes the block;
   - Escape and Cancel discard; a failed save keeps the block with an error toast;
   - with unsaved changes, opening another row asks "Discard changes?"; Keep editing keeps both as they were; Discard opens the other row;
   - members and viewers can't reach Edit.
2. **Implement.**
3. **Gates:** as TG5, plus `dupes`.

#### Task TG9 — e2e, axe, role gating, contrast (`xivrp-implementer`)

**Goal:** criteria 4, 5 (`?track=<id>`), 10 and 11 end to end.

**Files.** Extend `frontend/e2e/progress.spec.ts` (reuse `ownerSession`, `trackBlankCatalogFarm`, `deleteSeededFarms`, `PREFIX`), `frontend/e2e/role-gating.spec.ts`, `frontend/e2e/contrast.spec.ts`.
- `progress.spec.ts`, as owner: `?track=<id>` opens the row in view; log for #1 and Undo; log for Nobody with a note; Mark finished, Undo, Mark finished, Reopen; Edit the title and save; Delete; axe with the row open, the picker open and Edit open, both themes, 1440 × 900. As member: "I got it" and Undo.
- `role-gating.spec.ts`: member: no row menu, no Log a drop, "I got it" present; viewer: Copy plan only; owner pin: menu present.
- `contrast.spec.ts`: Progress with a row open, both themes.

1. **Tests first** as listed; each new e2e fails on G4's head for the right reason.
2. **Gates:** `pnpm -C frontend test:e2e` for the three files against the worktree's servers (paste the counts), plus the unit gates.

**Acceptance (browser), criteria 4, 5, 10:** the full walk as DevOwner, DevMember and a viewer (demote DevMember from an owner session, restore after; handoff recipe), light and dark.

---

## Finish (each PR)

- `git fetch`; renumber if `releaseNotes.ts` moved on `origin/main` (R-S3-11). The size check (`git diff --stat <parent>...HEAD`), the `pr-checklist` skill, and the slice-loop §5 gates: `pytest` when backend changed, `pnpm -C frontend build`, `lint` (0 errors, warnings ≤ the parent's), `check:design-system:strict`, `test`, `deadcode` unchanged, `dupes`. Paste the counts.
- **The live check (slice-loop §2):** the worktree's servers (`mkdir -p .logs` first) on a copy of the dev DB, dev-auth login, `/group/DEVTST?shell=v2`. DEVTST has no farms: seed through `POST …/collection-goals/from-suggestion` with a real `catalog_item_id` and the "E2E Progress" prefix, delete after. Toasts last ~8 s: click Undo promptly. Shots shrunk to `docs/redesign/pr-shots/s2a3a-<pr>-*.webp` (`python scripts/shrink-pr-shots.py`).
- `gh pr create --draft --base <parent branch>`, then the item's `pr`/`prTitle`.
- **The PR body:** V1 files touched (G1 only: `CollectionsHub.tsx`, pinned by the test committed first); the additive response field and the plugin contract unchanged (G1); the owner's decisions it implements (D-n); disclosed residuals (design §7; R-S3-7's View As note in G3).

## Write-backs (once, after the stack merges)

- The design note §9's write-backs to the parent spec, plus the S2a-2 plan's (:518-523), in one docs PR.
- `PRODUCT_MODEL.md` §6 and `HOME_STRETCH.md`'s S2a row: S2a-2 and S2a-3a shipped, with PR numbers.
- Memory `project_home_stretch`: the stack merged; next S2a-3b.

## Carried, not S2a-3a

- **Change order / Back to automatic** (D-1): its own slice. It needs a way to clear `priority_rank` (the PATCH treats `null` as unchanged) and an order UI; the queue model (TG1) then honours a pin.
- **The stored `recipient_character_id` on Undo** (D-3): a residual.
- **S2a-3b:** the tier row's expansion and `?track=tier`.
