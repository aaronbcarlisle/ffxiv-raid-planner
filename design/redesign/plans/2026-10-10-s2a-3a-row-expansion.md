# S2a-3a · The farm row expansion (V2)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo. Each PR below is one slice-loop run: its own ledger, one whole-branch review against its parent branch, one fix wave.

**Plan-vet (2026-10-10).** `xivrp-director`: APPROVE WITH CHANGES. Every finding (C-1, C-2, I-1…I-10, M-1…M-8) is folded in below, and the owner ruled the four open questions as recommended: D-19 (Not-on-the-roster members count fully), D-20 (viewers see no queue order), D-21 (hide "I got it" once the member has a drop on this farm), D-22 (the row menu gets its own grid column). They bind as R-S3-14…R-S3-17. The additions pushed G2 and G5 over the cap, so TG4 and TG9 ship as G2b and G5b from the start: seven PRs.

**Goal:** level 2 of Progress for farm rows. A farm row opens (click or `?track=<goalId>`, one at a time) into a panel: an action bar (a lead's **Log drop for {#1}** split button or a member's **I got it**, plus **Copy plan**), then **Next in line · Last drops · About**. Leads get a row menu: Edit (inline, §12.2), Mark finished (with Undo), Reopen on finished rows, and Delete.

**Design (binding):** `design/redesign/specs/2026-10-09-s2a-3a-row-expansion-design.md`, decisions D-1…D-22 and §3–§7. It sits on the parent spec, `design/redesign/specs/2026-09-30-s2a-progress-design.md`: S2-5 (Finished, Reopen), S2-8 (the queue), S2-9 (the expanded row), §4, §7 criteria 4, 5 (`?track=<id>`), 10 and 11, and the S2a-1 rulings (R-S1-13, R-S1-14, R-S1-19).
**Parity matrix (binding):** `design/redesign/specs/2026-09-30-s2a-parity-matrix.md`: the 28 "· S2a-3a" rows (mapped in the design note §6) and §12.2's field table (G-14).
**S2a-2 plan (binding):** `design/redesign/plans/2026-10-08-s2a-2-progress-tab.md`: R-S2-1 (the stacks and the preflight), R-S2-2 (V1 byte-identical), R-S2-5 (`utils/` as the pure home), R-S2-10 (who edits; View As), R-S2-16 (release numbering), R-S2-17 (absent controls), and its hand-off list (:529).
**Scope (binding).** V2 frontend under `frontend/src/components/progress/`, pure helpers in `frontend/src/utils/`, one hook in `frontend/src/hooks/`, additive store actions, one additive backend response field (R-S3-12), `releaseNotes.ts`, and the e2e specs named below. `backend/app/database.py` gets no edits. No migration. **V1 renders byte-for-byte as today:** the only V1 file touched is `components/collections/CollectionsHub.tsx`, which imports the moved `buildDiscordPlan` (R-S3-2). Four shared files V1 also reaches are edited additively, each guarded by an unedited V1 test (§ Shared files).
**Plugin contract (binding, `CLAUDE.md` § Pitfalls).** The plugin calls no `collection-goals` route. The one response change (R-S3-12) is additive.

## Size and stack

Estimates use the S2a-2 rule: code lines ÷ 0.35 (tests), × 1.8 (the measured overrun). The cap is ~1,500 changed lines, plan excluded (slice-loop rule 1). The cap, not slice-loop's 3–4 tasks, sets the cut (as in S2a-2): seven PRs, nine tasks. The plan-vet's additions (re-estimated 2026-10-10) put G2 at ~1,960 and G5 at ~1,650 as two-task PRs, so their last tasks ship as G2b and G5b from the start.

| PR | Slice | Branch · base | Tasks (est. total lines) | Total |
|---|---|---|---|---|
| G1 | **S2a-3a·G1** the models | `feat/s2a3a-g1-models` · `feat/s2a2-f6-edit-statuses` (#375, `57f1542c`) | TG1 the queue (~700) · TG2 Copy plan, the week label, the drop's character (~750) | ~1,450 |
| G2 | **S2a-3a·G2** the panel | `feat/s2a3a-g2-panel` · G1 | TG3 disclosure, `?track=` (hook and page), the panel row, the grid, Escape (~1,400, **deep, `model: fable`**) | ~1,400 |
| G2b | **S2a-3a·G2b** the panel's read-only parts | `feat/s2a3a-g2b-panel-read` · G2 | TG4 Next in line, About, Copy plan (~560) | ~560 |
| G3 | **S2a-3a·G3** logging | `feat/s2a3a-g3-logging` · G2b | TG5 Log a drop, I got it, Undo, the read-model refresh, `loadDrops`, the last three drops (~1,450, **deep**) | ~1,450 |
| G4 | **S2a-3a·G4** drops and the row menu | `feat/s2a3a-g4-menu` · G3 | TG6 Show all and drop delete (~480) · TG7 the row menu column: Mark finished, Reopen, Delete (~900) | ~1,380 |
| G5 | **S2a-3a·G5** Edit | `feat/s2a3a-g5-edit` · G4 | TG8 inline Edit (~1,000) | ~1,000 |
| G5b | **S2a-3a·G5b** the proof | `feat/s2a3a-g5b-proof` · G5 | TG9 e2e, axe, role gating, contrast (~650) | ~650 |

- **One worktree:** `.claude/worktrees/s2a3a`, created from `feat/s2a2-f6-edit-statuses`. Copy `frontend/.npmrc` in before `pnpm -C frontend install` (`CLAUDE.md`).
- **The cap.** At each Finish run `git diff --stat <parent>...HEAD`. Over ~1,500 → the PR's last task ships as its own PR stacked on top (G1 → TG2 as G1b; G4 → TG7 as G4b). G3 is one task: if it runs over, stop and re-cut it with the controller before opening the PR (the ledger records the cut). Don't trim tests.
- **Merging (R-S2-1, I-9), in this order, in one session.** Every PR opens as a draft. After G5b: (1) update the whole stack onto the latest `main` (slice-loop § Stacked PRs); (2) push the updated top commit to `redesign/s2a2-preflight` (a draft PR to `main` labelled `no-automerge`, for the record) and run `e2e/progress.spec.ts`, `e2e/role-gating.spec.ts` and `e2e/contrast.spec.ts` locally on that tree; (3) once that push run is green on that exact tree, merge #370…#375 then G1…G5b bottom-first with **no further update**. If `main` moves before the last merge, go back to (1) and re-run the preflight. Link the run and paste the e2e counts in #370's body. Close the preflight PR after.
- **Before G1:** `git fetch`; if anything below #375 moved (the owner may merge mid-loop), update the stack first.

## Code facts checked (worktree `s2a2b` at `57f1542c`, 2026-10-10)

| Fact | Where | Consequence |
|---|---|---|
| The matrix is `<table role="grid">`; `useMatrixKeyboard(rowIds, colKeys)` returns `cellProps(rowId, colKey)` (ref, tabIndex, focus, keydown); cells are a ref map keyed by row and column; movement is by index | `progress/ProgressMatrix.tsx:~122`, `progress/useMatrixKeyboard.ts` | The name cell joins the grid as a leading column key (R-S3-4) |
| The rowheader `<th role="rowheader">` has no focus props | `progress/FarmRow.tsx:~46` | TG3 adds the disclosure `Button` there |
| Finished rows are a second `<tbody>` in the same table, rendered by `FarmRow` without `keyboard` | `progress/FinishedFarms.tsx` | Their disclosure is a plain tab stop (R-S3-4) |
| The colSpan is inline: `columns.length + 2` | `ProgressMatrix.tsx` | TG3 names it once (`spanAll`) |
| `ProgressPage` props: `group, tier, canManage, userRole, currentUserId, isViewingAs, onNavigate`; `week` from `useLootTrackingStore(s => s.currentWeek)` gated by `weekClockKey`; `weekStartDate` exists in that store but isn't selected | `progress/ProgressPage.tsx` (268 lines); `progress/ProgressPage.tsx:59-66` (`clockResolved`); `stores/lootTrackingStore.ts:59-65` | TG2's label takes both; TG5 selects `weekStartDate` behind the same `clockResolved` gate (R-S3-9) |
| `toast.withUndo(message, onUndo, duration = 8000)`, `toast.error`, `toast.success` | `stores/toastStore.ts:104` | Every Undo uses `withUndo` |
| The week clock: `currentWeek` = `(now − start).days // 7 + 1`, start = `tier.week_start_date or tier.created_at`. So `weekStartDate` is the start of **week 1**, not of the current week | `backend/app/services/loot_context.py:67-73` (`calculate_week_number`) | R-S3-9 mirrors it (vet C-1) |
| Columns: `claimed` and `unclaimed` (the roster), then `notOnRoster` (a member with a row on an active farm and no column; `reason` `unconfigured` = "Card not set up", else "Not on the roster"). Both `claimed` and `notOnRoster` carry a `userId`; `cellFor` gives every column with a `userId` its real state, count and `own`. `FarmRow.need`/`want` and the tally count `claimed` only | `utils/progressModel.ts:50-60,77-114,154-180,191-252` | `queueFor` admits `notOnRoster` (R-S3-14); the farm order and tally stay as S2a-2 ruled |
| `logDrop(groupId, goalId, RewardDropCreate): Promise<RewardDrop>` prepends the new drop to `drops[goalId]`, then refetches participants and goals; `deleteDrop(groupId, goalId, dropId)` refetches drops, participants and goals; `fetchDrops(groupId, goalId)` swallows errors (only `dropsLoading`); `updateGoal`; `deleteGoal`; `fetchProgress(groupId, goalIds?)` | `stores/collectionGoalStore.ts:817-863` (864 lines) | R-S3-5 adds V2's refresh and `loadDrops` |
| `RewardDrop` has no character name; `RewardDropResponse` omits it though the row stores it. One helper builds every drop response | store `:164-177`; `backend/app/schemas/collection_goals.py:248-262`; `routers/collection_goals.py:216-229` (`_drop_to_response`, called at `:1547` create and `:1573` list), stored at `:1526` | R-S3-12 |
| V1 tests build `RewardDrop` literals field by field | `stores/collectionGoalStore.test.ts:19-31`; `components/collections/DropHistoryPanel.test.tsx:35-47` | The new field is optional (R-S3-12, vet I-3) |
| V1's drop-delete confirm: title "Delete Drop", label "Delete", `variant="danger"` | `components/collections/DropHistoryPanel.tsx:120-123` | TG6 uses the same (vet M-3) |
| Nested layers and Escape: `Modal` listens on `window` (`preventDefault` + `stopImmediatePropagation`) and portals; `Popover` renders in a Radix `Portal`; `Select` renders inline (no portal) | `components/ui/Modal.tsx:59-102,206`; `components/primitives/Popover.tsx:93`; `components/ui/Select.tsx:213` | The panel's Escape filter (R-S3-4, vet I-2) |
| A radio list precedent: `role="radiogroup"` of `role="radio"` + `aria-checked` with arrow keys, passing `check:design-system:strict` | `components/loot/RecipientPicker.tsx:705-717` | TG5's picker follows it (vet M-2) |
| Tab memory defaults to `'remember'`; a primary-tab switch clears the registered params only in `'reset'`; static switches navigate to `/group/{shareCode}` with no query | `lib/navPreferences.ts:88-89`; `hooks/useGroupViewState.ts:327-336`; `static-group/StaticSwitcher.tsx:135` | R-S3-3 (vet I-7) |
| The grid tests and e2e assume the first player cell is the one Tab stop | `progress/ProgressMatrix.test.tsx:391-396, 398-415, 442-450, 452-468, 506-511`; `e2e/progress.spec.ts:243-256` | TG3 rewrites them for `'__name'`, TG7 extends them for `'__menu'` (R-S3-17) |
| A member's own drop already flips their other statics' merged state, and the Undo reverts it | `backend/tests/test_farm_drop_authz.py:990` (`test_the_other_statics_merged_state_follows_the_revert`) | TG5's "other statics" acceptance cites it (vet M-7) |
| `CollectionGoalUpdate` serializes nullable fields with `'x' in u` | store `:256` | Edit sends only the fields it shows (R-S3-10) |
| `buildDiscordPlan(goal, participants)` is pure and unexported. **Only Need is sorted** (`priorityRank ?? 999`); Want and Have keep input order; "Can buy now" filters all participants in input order, any state but Have (Pass included), by `(tokenCount ?? 0) >= tokenCost`; names are `displayName ?? userId`; the caller toasts "Farm plan copied to clipboard!" | `components/collections/CollectionsHub.tsx:18-56,108-114` | R-S3-2 (vet I-4) |
| RewardGoalModal's content options (`unreal`, `eureka`, …) don't match the server's 7; the server's 7 have labels in `CreateCollectionGoalModal.tsx:22-30`; all option lists are unexported | `components/collections/RewardGoalModal.tsx:12-51`; `components/static-group/CreateCollectionGoalModal.tsx` | V2 owns its option lists (R-S3-10) |
| `useUrlTabState` takes a fixed value list; its registry is seeded by `SEEDED_TAB_PARAMS` and cleared by `clearRegisteredTabParams` | `hooks/useUrlTabState.ts:42,80` | R-S3-3 |
| Row-menu precedent: an `IconButton` (`MoreVertical`, `aria-haspopup="menu"`) opening `ContextMenu` at the button | `components/loot/BookLedgerCard.tsx:332`; `components/ui/ContextMenu.tsx` | TG7 follows it |
| No split-button primitive exists | — | TG5 composes two `Button`s and a `Popover` (R-S3-6) |
| `CURRENT_VERSION = '2.1.72'`; items carry `category, title, description, pr, prTitle, internal` | `data/releaseNotes.ts:12,63` | R-S3-11 |

## Rulings (bind every task)

- **R-S3-1 (stack).** As § Size and stack. Every PR is a draft until the whole stack merges (R-S2-1).
- **R-S3-2 (Copy plan, D-2).** `buildDiscordPlan` moves to `utils/discordPlan.ts` as `buildDiscordPlan(goal, ordered: readonly DiscordPlanEntry[], canBuyFrom: readonly DiscordPlanEntry[] = ordered)`, where `DiscordPlanEntry = { name: string; state: ParticipantState; count: number | null }`. Its lines, emoji and labels are unchanged. The 🎯, ⭐ and ✅ lines filter `ordered` by state, keeping its order; "💰 Can buy now" filters `canBuyFrom`, in its order, to `state !== 'have' && count !== null && count >= tokenCost` (only when `tokenCost != null`). **The sort leaves the function**, and V1's sort was Need-only (vet I-4): `CollectionsHub` passes `ordered` = its Need entries sorted by `priorityRank ?? 999`, then every other entry in input order, and `canBuyFrom` = every participant in input order; it maps `name: displayName ?? userId` and `count: tokenCount ?? 0` (so a null count reads 0, exactly as today), and keeps its toast text. A test written **first, against today's unmoved code** (`CollectionsHub.copyPlan.test.tsx`: render, click Copy plan, capture the clipboard) pins V1's text and must pass unedited after the move. V2 builds its entries with `planEntriesFor(row, mode): { ordered; canBuyFrom }` (same file). `ordered` = the queue's Need and Want entries in `queueFor`'s order, then Have in column order (every column with a `userId`, R-S3-14); a Need or Want the queue leaves out (all of them under `free_roll`, the Wants under `desired_only`) is omitted from it. `canBuyFrom` = the queue's entries in order, then every other non-blank cell with a `userId` in column order (Pass, and the Needs and Wants the queue left out), so a player who can buy is listed whatever the mode. A hidden count is `null` (so "Can buy now" never lists a hidden count, and lists a Pass player at or over the cost). So under `free_roll` V2's paste has no 🎯 or ⭐ line, and under `desired_only` no ⭐ line (D-2: the paste matches the expansion). Its toast reads "Plan copied" (D-17).
- **R-S3-3 (`?track=`, D-8).** `useTrackParam(): [string | null, (id: string | null) => void]` reads `track` with `useSearchParams` and writes with `replace`. Add `track` to `SEEDED_TAB_PARAMS`, so it behaves exactly like every other sub-tab param (vet I-7): **on a primary-tab switch** under the default `'remember'` tab memory `?track` stays in the URL and coming back to Progress reopens that row; under `'reset'` the switch's `clearRegisteredTabParams` removes it and Progress comes back closed. **On a static switch** it is cleared: today's switches navigate to `/group/{shareCode}` with no query, and `ProgressPage` also clears `track` when `group.id` changes under a mounted page (a goal id never belongs to two statics), before the new static's goals load, so a stale id never waits for a load that cannot match. `ProgressPage` drops an id only **after** goals have loaded and the id matches no goal of this static (never during loading). A finished goal's id expands Finished (n) first, then opens the row. The open row scrolls into view once per open (`scrollIntoView({ block: 'nearest' })`).
- **R-S3-4 (the grid, D-7).** `ProgressMatrix` prepends the key `'__name'` to `colKeys` for active rows; the disclosure `Button` in the rowheader takes `cellProps(goalId, '__name')`. So Home lands on the name, ArrowLeft from the first player cell reaches it (through the menu cell for leads, R-S3-17), and Enter or Space toggles (native button). The panel is `<tr role="row" data-testid="progress-expansion"><td role="gridcell" colSpan={spanAll}>` **after** its farm row and **not** in `rowIds`, so arrow keys skip it; Tab from the open row's roving cell moves into the panel. Closing returns focus to the name button. Escape inside the panel (outside Edit) closes it. **The Escape filter (vet I-2):** the panel's `onKeyDown` handles Escape only when `!e.defaultPrevented` and `panelRef.current?.contains(e.target as Node)`; React bubbles portal events through the React tree, so the picker's Radix-portal `Popover`, a `ConfirmModal` (portaled, with its own `window` listener) and an inline `Select` that handles its own Escape never also close the panel. Finished rows' disclosure is a plain tab stop (their cells stay outside the grid, as S2a-2 parked). axe 0 critical / 0 serious with a row open, both themes.
- **R-S3-5 (the read-model refresh).** New store action `refreshGoalProgress(groupId, goalId, { lists?: boolean })`: `fetchProgress(groupId, [goalId])`, and with `lists` also `fetchGoals(groupId)` and `fetchProgress(groupId)` (a farm moved between active and Finished). V2 calls it after a log, a drop delete, an Undo, Mark finished, Reopen and Edit. New store action `loadDrops(groupId, goalId): Promise<{ error: unknown | null }>` (vet I-8) does `fetchDrops`'s request and writes the same `drops` and `dropsLoading` slices, but returns the error instead of swallowing it; V2's `DropList` uses it for "Couldn't load drops". `fetchDrops`, `logDrop`, `deleteDrop` and `updateGoal` stay byte-identical (V1 delta (e)).
- **R-S3-6 (Log a drop, D-6).** `LogDropButton` = a `Button` "Log drop for {name}" plus an `IconButton` "More recipients" (`aria-haspopup="dialog"`) in one `role="group"` named "Log a drop", the second opening a `Popover` named "Log a drop for {track}". The picker is a `role="radiogroup"` whose options are `role="radio"` with `aria-checked`, one tab stop, arrow keys moving the choice (the `loot/RecipientPicker.tsx:705-717` precedent, vet M-2): the queue in order with "#n · {state} {count}", then a "Not in the queue" label and every other column with a `userId` (claimed and Not-on-the-roster, R-S3-14) in column order, then Nobody; an `Input` "Note (optional)" (≤ 500 characters), and "Log drop" / "Cancel". With no #1 (`free_roll` or an empty queue) the main button reads "Log a drop", opens the picker, and Nobody is preselected. **Both buttons are disabled while a log is in flight** (no double drop). Leads only (`canManage && userRole !== 'viewer'`); hidden otherwise (ROLE-1). Absent on finished rows.
- **R-S3-7 (I got it, D-5, D-21).** Shown to a non-lead member whose own cell (`cell.own`, a `claimed` or `notOnRoster` column, R-S3-14) is not Have, on active rows, **and** who has no drop on this farm yet (R-S3-16). It sends `recipientUserId` = the own column's `userId`, never the caller's id, so under View As it logs for the viewed user; the backend then treats it as a lead's drop (no record write), a disclosed View As note (as R-S2-10). One click, no note.
- **R-S3-8 (Undo).** A log's Undo is `deleteDrop` on the returned id, then `refreshGoalProgress`. The toast (D-16) is `withUndo`, so Undo works after the row closes. A failed Undo toasts "Couldn't undo the drop" and keeps it. Mark finished's Undo is `updateGoal({ status: prior })` with the status read **before** the write.
- **R-S3-9 (week labels, D-15 as corrected, vet C-1).** `weekStartDate` is the start of week 1 (`services/loot_context.py:67-73`). `dropWeekLabel(droppedAt, { currentWeek, weekStartDate }, now?)` mirrors the server: `days = floor((droppedAt − weekStartDate) / 86,400,000 ms)` (whole elapsed days, as Python's `timedelta.days`), `n = floor(days / 7) + 1`. It reads "Week n" when both are known and `1 ≤ n ≤ currentWeek`; otherwise (before week 1, after the clock, a null `weekStartDate` or an unknown week) a date in `en-GB` short form ("12 Mar"; add the year when it isn't this year). `ProgressPage` passes `weekStartDate` only when `clockResolved` (the same `weekClockKey` gate as `week`), else `null`. Normalize U+202F before comparing in tests (memory `reference_intl_narrow_nbsp`).
- **R-S3-10 (Edit, §12.2, D-12, vet M-5).** V2's option lists live in `utils/goalTypeMeta.ts` (new exports `GOAL_STATUS_OPTIONS` (Wanted · Farming · Scheduled), `CONTENT_TYPE_LABELS` (the server's 7 with the labels of `static-group/CreateCollectionGoalModal.tsx:22-30`: `extreme` "Extreme", `savage` "Savage", `ultimate` "Ultimate", `criterion` "Criterion", `chaotic_alliance` "Chaotic Alliance", `field_operation` "Field Operation", `custom` "Other / Custom"), `PRIORITY_MODE_OPTIONS` (the 6: `null` "Not set" with help "Queues as Everyone gets one.", then the five modes with V1's labels (Everyone gets one, Priority order, Free roll, Desired only, Custom), each with a one-line queue help)). Type uses the existing `GOAL_TYPE_LABELS` (the 10). `CreateCollectionGoalModal` keeps its own list (it carries descriptions, and moving it would touch a V1 file); V1's files keep theirs. In a `Select`, `null` maps to the value `''`. Edit sends only `title, goalType, status, contentType, contentKey, priorityMode, summary`, and only the changed ones; a Notes or Content Key left blank (after trim) sends `null`. Save is disabled while Title is blank or nothing changed. Content Key ≤ 50, Title ≤ 200 (the schema's limits). A dirty Edit blocks opening another row behind `ConfirmModal` "Discard changes?" (Discard / Keep editing).
- **R-S3-11 (release notes, R-S2-16).** Each PR adds one `internal: true` item to 2.1.72 with `pr`/`prTitle` (no commit SHAs). `git fetch` at each Finish; renumber if `releaseNotes.ts` moved on `origin/main`. Escape `'` as `\'`.
- **R-S3-12 (the drop's character).** `RewardDropResponse` gains `recipient_character_name: str | None = None` (additive), filled from the drop row in `_drop_to_response` (`routers/collection_goals.py:216-229`), which builds both the create (`:1547`) and the list (`:1573`) response. The client gains `ApiDrop.recipient_character_name?: string | null` and `RewardDrop.recipientCharacterName?: string | null`, **optional**, mapped in `fromApiDrop` with `?? null` (vet I-3), so V1's literal fixtures (`collectionGoalStore.test.ts:19-31`, `DropHistoryPanel.test.tsx:35-47`) compile unedited. The drop list names a drop (vet M-4) `recipientUserId === null` → "Nobody"; else `recipientDisplayName ?? recipientCharacterName ?? 'Unknown member'`; then " ({character})" only when `recipientCharacterName` is set and differs from that name (design §3.4).
- **R-S3-13 (absent controls, R-S2-17).** Change order (D-1) and Schedule a farm night are absent, not stubbed. Viewers see the panel with no action except Copy plan, no row menu and no queue order (R-S3-15).
- **R-S3-14 (Not-on-the-roster members count fully, D-19, vet C-2).** A `notOnRoster` column (either `reason`: "Not on the roster" or "Card not set up") has a `userId` and real cells, so it is a member like any other: `queueFor` admits every cell whose `column.userId !== null` (`claimed` or `notOnRoster`), under the same state and count rules (a hidden count is unknown, last in its state); a drop-only farm's "column order" includes the trailing columns in their place. The picker lists them (queued, or under "Not in the queue"), and their own cell gets "I got it". Unclaimed columns stay out. `FarmRow.need`/`want` (the farm order) and the tally keep counting `claimed` only, as S2a-2 ruled. This is V1 parity: V1 lets a lead log for any non-viewer member and a member log their own.
- **R-S3-15 (viewers see no queue order, D-20, vet I-5).** Per S2-7 and V1 delta (i), a viewer (`userRole === 'viewer'`) gets, in place of the ranked Next in line list, one unranked line: "Need: A, B · Want: C", names in **column order**, no ranks, no counts, a part omitted when empty ("Nobody needs it" when both are). No "#n" anywhere for them, and no Show all. Copy plan stays (D-17) and follows R-S3-2 with every count `null`.
- **R-S3-16 (one "I got it" per member per farm, D-21, vet I-6).** "I got it" is hidden once the loaded drops for this goal hold any drop with `recipientUserId === currentUserId` (under View As, the viewed user), in addition to D-5's hide-on-Have. This stops a double log on a Pass cell and on a custom farm with no catalog item, where the cell never changes. `logDrop` prepends the new drop, so the button hides as soon as the log returns; the in-flight lock holds until `refreshGoalProgress` resolves. Undo (deleting that drop) brings it back. While the drops load, the button waits (no flash); if `loadDrops` fails, D-5's cell rule alone applies.
- **R-S3-17 (the row-menu column, D-22, vet I-1).** For leads the matrix gains a narrow column right after the name: a `<th role="columnheader">` with visually hidden "Actions", and in each farm row a `<td role="gridcell">` holding the ⋯ `IconButton`, which takes `cellProps(goalId, '__menu')`. `colKeys` is `['__name', '__menu', …players]` for leads and `['__name', …players]` for everyone else, and `spanAll` adds one for leads. So arrows reach the menu; ArrowLeft from the first player cell lands on it, then the name. Finished rows render the same cell as a plain tab stop. The status cell reads only "Everyone has it" (S2-5's inline "· Mark finished" link is removed); when everyone has it, **Mark finished** also shows in the open panel's action bar, as well as in the menu.

## Shared files (V1 reaches them; vet I-10)

Each is edited additively. The V1 test named beside it guards it and must pass **unedited** in every PR that touches the file.

| File | The edit (task) | The V1 path that reaches it | The unedited V1 pin |
|---|---|---|---|
| `hooks/useUrlTabState.ts` | `SEEDED_TAB_PARAMS` gains `track` (TG3) | Every V1 sub-tab (`rsub`, `goal`, `farm`, `coll`, …) and the `'reset'` primary-tab switch (`hooks/useGroupViewState.ts:334`, `clearRegisteredTabParams`) | `hooks/useUrlTabState.test.tsx` (the `clearRegisteredTabParams` cases from `:62`); `hooks/useGroupViewState.test.ts` |
| `stores/collectionGoalStore.ts` | `RewardDrop.recipientCharacterName?` and its mapping (TG2); `refreshGoalProgress`, `loadDrops` (TG5) | V1's `CollectionsHub`, `LogDropModal`, `RewardGoalModal`, `RewardGoalDetailModal` and `DropHistoryPanel` through `fetchDrops`, `logDrop`, `deleteDrop`, `updateGoal`, `deleteGoal` (unchanged) | `stores/collectionGoalStore.test.ts`; `components/collections/DropHistoryPanel.test.tsx`; `components/collections/LogDropModal.test.tsx` |
| `utils/goalTypeMeta.ts` | `CONTENT_TYPE_LABELS`, `PRIORITY_MODE_OPTIONS` (TG4); `GOAL_STATUS_OPTIONS` (TG8); the existing two exports untouched | V1's `components/collections/RewardGoalCard.tsx` (`GOAL_TYPE_LABELS`, `GOAL_TYPE_ICONS`) | `components/collections/RewardGoalCard.test.tsx` |
| Backend drop response: `schemas/collection_goals.py` `RewardDropResponse`, `routers/collection_goals.py` `_drop_to_response` | `recipient_character_name` (TG2) | V1's `DropHistoryPanel` reads the list route; `LogDropModal` the create route | `backend/tests/test_collection_goals.py` and `backend/tests/test_farm_drop_authz.py` (existing cases unedited; TG2 only adds cases); `DropHistoryPanel.test.tsx` |

## Review Focus

- **The queue's edges (TG1).** All counts hidden; ties; a drop-only farm; `desired_only` with only Wants (empty queue → "Log a drop" with Nobody); a Want with a lower count than a Need stays after it; Not-on-the-roster and Card-not-set-up members queue by the same rules (R-S3-14). Pinned in TG1's tests.
- **`?track=` before the data, and across tabs and statics (TG3).** A deep link while goals are still loading keeps the id and opens the row once they arrive; a finished id waits for Finished's fetch; a foreign or deleted id is dropped only after load; a tab switch keeps or clears it per tab memory; a static switch clears it (R-S3-3). Pinned in TG3's tests.
- **Escape and the grid (TG3, TG5–TG8).** Escape in the picker, a confirm or an Edit `Select` closes only that layer (R-S3-4); arrows reach the name and the menu column, never the panel (R-S3-17). Pinned in each task's tests.
- **A row that changes under the panel (TG5, TG7).** Mark finished, Reopen or Delete on the open row: the panel follows the goal (into Finished, or closes and clears `?track`) with no crash and no stale actions. Pinned in TG7's tests.
- **Double writes (TG5).** A double click on "Log drop for …" or "I got it" sends one drop; "I got it" stays gone once the member has a drop on the farm, Pass cells and custom farms included (R-S3-16). Pinned in TG5's tests.
- **View As (TG5).** "I got it" under View As logs for the viewed user, never the admin. Pinned in TG5's tests.
- **V1 unchanged (TG2, § Shared files).** The Copy plan pin passes unedited after the move; no other V1 file appears in any diff; the shared files' V1 pins pass unedited.
- **a11y.** Every panel control is reachable by Tab and named; the split button's two halves have distinct names; axe clean with the row, the picker and Edit open, both themes at 1440 × 900 (TG9).
- **UI rules.** No raw elements; semantic tokens; `text-xs` floor; no modal except the two confirms and "Discard changes?"; no sticky panel.

---

### PR G1 · S2a-3a·G1 — the models

#### Task TG1 — the queue (`xivrp-implementer`)

**Goal:** `queueFor` per design §3.1 and R-S3-14, the one order every consumer uses.

**Files.** Create `frontend/src/utils/progressQueue.ts` and `progressQueue.test.ts`. Add G1's internal release item ("Progress: the farm queue model", `internal: true`).

**Interfaces — produces:**
```ts
export interface QueueEntry {
  cell: ProgressCell;          // from utils/progressModel; column.kind 'claimed' | 'notOnRoster'
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
   - Have, Pass, blank and unclaimed columns are excluded;
   - **Not-on-the-roster members count fully (R-S3-14):** a `notOnRoster` column with `reason: 'notOnRoster'` on Need 3/99 ranks ahead of a claimed Need 10/99; one with `reason: 'unconfigured'` on Want queues among the Wants by count; a `notOnRoster` hidden count ranks last in its state; on a drop-only farm the trailing columns keep their place after the roster; an unclaimed column on the same row never appears;
   - `free_roll` → `[]`; `desired_only` → Need only (a row with only Wants → `[]`); `everyone_gets_one`, `priority_order`, `custom` and `null` → the full rule;
   - a drop-only farm (`goal.tokenCost === null`) orders by column order within each state, ignoring counts;
   - `priority_rank` on an entry changes nothing (D-1);
   - ranks are 1-based and contiguous;
   - `queueEntryText`: "Need 12/99", "Want 80/99", "Need" when hidden, "Need 12" when `tokenCost` is null.
2. **Implement.**
3. **Gates:** the touched tests, `lint`, `build`, `deadcode` (the allowed delta, § Finish: `queueEntryText` stays unused until TG4 in G2b; `queueFor` and `QueueEntry` are used by TG2's `planEntriesFor` in the same PR).

#### Task TG2 — Copy plan, the week label, the drop's character (`xivrp-implementer`)

**Goal:** the remaining pure pieces and the one backend field. (`useTrackParam` moved to TG3 at the plan-vet re-cut, so the hook lands with its only consumer.)

**Files.**
- Create `frontend/src/components/collections/CollectionsHub.copyPlan.test.tsx` **first** (R-S3-2) and commit it alone ("test: pin V1 Copy plan text"), passing on today's code.
- Create `frontend/src/utils/discordPlan.ts` (+ test), `frontend/src/utils/dropWeek.ts` (+ test).
- Modify `components/collections/CollectionsHub.tsx` (import the builder, map with today's Need-only sort and pass `canBuyFrom`), `stores/collectionGoalStore.ts` (`ApiDrop.recipient_character_name?`, `RewardDrop.recipientCharacterName?`, `fromApiDrop` maps `?? null`), `backend/app/schemas/collection_goals.py` (`RewardDropResponse`), `backend/app/routers/collection_goals.py` (`_drop_to_response`), `backend/tests/test_collection_goals.py` (add the drop-response cases; existing cases unedited).

**Interfaces — produces:** `buildDiscordPlan(goal, ordered: readonly DiscordPlanEntry[], canBuyFrom?: readonly DiscordPlanEntry[]): string`; `DiscordPlanEntry`; `planEntriesFor(row: FarmRow, mode: CollectionPriorityMode | null): { ordered: DiscordPlanEntry[]; canBuyFrom: DiscordPlanEntry[] }` (R-S3-2's V2 order; TG4 consumes it); `dropWeekLabel(droppedAt: string, clock: { currentWeek: number | null; weekStartDate: string | null }, now?: Date): string`; `RewardDrop.recipientCharacterName?: string | null`.

1. **Tests first:**
   - **the V1 pin (vet I-4)**, against today's code: a farm with a token cost of 99, a note and a mode; two Needs whose ranks put them out of input order, a Need with no rank; two Wants given in a non-alphabetical input order; a Have; a **Pass player at 99/99** (listed under Can buy now); a Need at 120/99 (listed under Can buy now in input order, not rank order); a member with **no display name** (named by `userId`). The clipboard text equals today's string exactly (write the expected string out in the test). Only Need is sorted in V1's path; the test proves Want, Have and Can buy now keep input order;
   - `buildDiscordPlan` with ordered entries reproduces each line (`**{title}** farm plan`, `Mode: …`, `Exchange: …×…`, `🎯 **Need (n):**`, `⭐ **Want (n):**`, `💰 **Can buy now:**`, `✅ **Have (n):**`, `📝 {note}`), lists names in the given order, filters Can buy now from `canBuyFrom` when given, and never lists an entry with `count: null` under Can buy now;
   - **V2's outputs** (`planEntriesFor` then `buildDiscordPlan`, the full string written out): `everyone_gets_one` (queue order for Need and Want, a hidden count left out of Can buy now, a Pass player at the cost in it, a Not-on-the-roster Need in queue order); `free_roll` (no 🎯 or ⭐ line; Can buy now, a Need at the cost included, and Have still listed); `desired_only` (🎯 only, no ⭐ line); a viewer's row (every count `null`: no Can buy now line);
   - `dropWeekLabel` (vet C-1; `weekStartDate` = week 1's start, `currentWeek` = 5): at `weekStartDate` → "Week 1"; 6 days 23 hours after → "Week 1"; exactly 7 days after → "Week 2"; 30 days after → "Week 5"; 36 days after (n = 6 > `currentWeek`) → a date; one minute before `weekStartDate` → "12 Mar" style date; last year → "12 Mar 2025"; `weekStartDate: null` → a date; `currentWeek: null` → a date;
   - pytest: a logged drop's response and the list response carry `recipient_character_name` (the resolved character's name), and `null` for a Nobody drop.
2. **Implement** R-S3-2, R-S3-9, R-S3-12.
3. **Gates:** the touched tests, `pytest tests/ -q`, `lint`, `check:design-system:strict`, `build`, `deadcode` (the allowed delta: `dropWeekLabel` unused until TG5 in G3; `planEntriesFor` until TG4 in G2b), `dupes`. The V1 pin and `collectionGoalStore.test.ts` / `DropHistoryPanel.test.tsx` pass unedited.

**Acceptance:** V1's Copy plan text unchanged in the running classic view (paste before/after into the PR body). Curl pair for a drop's new field.

### PR G2 · S2a-3a·G2 — the panel

#### Task TG3 — disclosure, `?track=`, the panel row and the grid (RISKIEST of S2a-3a · `xivrp-implementer-deep`, `model: fable`)

**Goal:** a farm row opens and closes, one at a time, by click, keyboard or `?track=`, with the grid intact (D-7, D-8, R-S3-3, R-S3-4).

**Files.** Create `frontend/src/components/progress/FarmExpansion.tsx` (the panel shell: an empty action bar slot and the three column slots, filled by TG4–TG5; the Escape filter) and its test; `frontend/src/hooks/useTrackParam.ts` (+ test, moved from TG2). Modify `hooks/useUrlTabState.ts` (`SEEDED_TAB_PARAMS` gains `track`; a shared file, § Shared files), `FarmRow.tsx` (disclosure `Button` with chevron, `aria-expanded`, `aria-controls`), `ProgressMatrix.tsx` (`'__name'` key, `spanAll`, render the panel after the open row, in both `<tbody>`s), `FinishedFarms.tsx` (open state), `ProgressPage.tsx` (owns `openId` through `useTrackParam`; scroll; drop-after-load; clear on a static switch). Extend `ProgressMatrix.test.tsx` and rewrite its grid cases that assume the first player cell is the stop (`:391-396`, `:398-415`, `:442-450`, `:452-468`, `:506-511`); rewrite `e2e/progress.spec.ts:243-256` (the one stop is now the first row's name button, inside a `rowheader`, so the locator takes `[role="rowheader"] [tabindex="0"]` too); new `ProgressPage.track.test.tsx`. Add G2's internal release item ("Progress: open a farm row", `internal: true`).

**Interfaces — produces:** `useTrackParam(): [string | null, (id: string | null) => void]`; `FarmExpansion` props `{ row: FarmRow; finished: boolean; canManage: boolean; userRole: MemberRole | null | undefined; currentUserId: string; groupId: string; onClose(): void }` (`currentUserId` is the viewed user under View As, as `ProgressPage` already receives it; vet M-4); `ProgressMatrix` gains `openId: string | null; onToggle(goalId: string): void`.

1. **Tests first:**
   - the name cell is a `Button` named "{title}" with `aria-expanded="false"`; clicking opens the panel (`progress-expansion`) right after that row and sets `aria-expanded="true"`; clicking another row closes the first; clicking the open one closes it;
   - clicking a player cell (own-cell picker) never opens the row;
   - keyboard: Home from a player cell focuses the name button; ArrowLeft from the first player cell too; ArrowDown from the name moves to the next row's name; Enter toggles; ArrowDown from the open row skips the panel to the next farm row;
   - the rewritten grid cases: the one Tab stop is the first row's name button; Home/End land on the name and the last player cell; the edges stop at the name; the fallback after the stop's row goes is the first row's name;
   - Tab from the open row's cell reaches the panel's first control; Escape in the panel closes it and focuses the name button;
   - **the Escape filter (R-S3-4, vet I-2):** an Escape whose event is already `defaultPrevented` leaves the panel open; an Escape fired on a node rendered through a portal from inside the panel (outside `panelRef` in the DOM) leaves it open. (TG5, TG6/TG7 and TG8 pin the real picker, confirm and `Select`.)
   - `useTrackParam`: reads `?track=abc`; setting writes in place (history length unchanged); `null` removes it; `clearRegisteredTabParams` removes `track`;
   - `?track=<active id>` opens that row on load and calls `scrollIntoView` once; `?track=<finished id>` expands Finished (n) and opens that row; `?track=` while goals are loading keeps the id, then opens it; `?track=<unknown>` is removed after goals load; opening writes `?track` in place and closing removes it;
   - **tab and static switches (R-S3-3, vet I-7):** with `tabPersistence: 'remember'`, `setPageMode('roster')` keeps `?track` and switching back opens the row again; with `'reset'` the switch removes it and Progress comes back closed (in `hooks/useGroupViewState.progress.test.ts`); rerendering `ProgressPage` with another `group` clears `?track` at once and opens nothing, even while the new static's goals load;
   - the panel row is `role="row"` with one `role="gridcell"` spanning `spanAll`, outside `rowIds`.
   - (axe is e2e-only here: `@axe-core/playwright`. G2 adds one case to `e2e/progress.spec.ts`, axe with a row open in both themes; TG9 widens it.)
2. **Implement.**
3. **Gates:** the touched tests, `lint`, `check:design-system:strict`, `build`, `deadcode` (the allowed delta: `queueEntryText`, `planEntriesFor`, `dropWeekLabel`, as G1). `hooks/useUrlTabState.test.tsx` passes unedited.

**Acceptance (browser, G2):** as DevOwner on a seeded farm: open by click, by keyboard (Home, Enter) and by `?track=`; one open at a time; Escape closes; Roster and back with the default tab memory reopens the row; switching static clears it. Shots: closed, open (the empty shell), keyboard focus on the name; light and dark.

### PR G2b · S2a-3a·G2b — the panel's read-only parts

#### Task TG4 — Next in line, About, Copy plan (`xivrp-implementer`)

**Goal:** the panel's read-only parts and Copy plan, for every role (D-4, D-13's queue half, D-17, D-18, D-20; Q-3).

**Files.** Create `progress/QueueList.tsx`, `progress/AboutBlock.tsx` and tests. Modify `FarmExpansion.tsx` (columns, the Copy plan `Button` in the action bar), `utils/goalTypeMeta.ts` (a shared file: two new exports, the existing two untouched). Add G2b's internal release item ("Progress: the queue, About and Copy plan", `internal: true`).

**Interfaces — consumes:** `queueFor`, `queueEntryText` (TG1); `buildDiscordPlan`, `planEntriesFor` (TG2). **Produces:** in `utils/goalTypeMeta.ts`, `CONTENT_TYPE_LABELS: Record<CollectionContentType, string>` and `PRIORITY_MODE_OPTIONS: readonly { value: CollectionPriorityMode | null; label: string; help: string }[]` (R-S3-10); TG8 reuses both.

1. **Tests first:**
   - for leads and members, Next in line shows the top four as "{name} · {queueEntryText}", ordered; "Show all ({n})" appears only when more than four are queued and expands in place; `free_roll` reads "Free roll: no queue"; an empty queue reads "Nobody needs it";
   - Next in line includes a Not-on-the-roster member in queue order (R-S3-14);
   - **a viewer (R-S3-15, vet I-5)** sees no ranked list: one line "Need: Healer 1, Melee 2 · Want: Tank 1" in column order although the queue would rank Melee 2 first; no "#", no counts, no Show all even with more than four; "Nobody needs it" when neither state has anyone; a Want-only row reads "Want: …";
   - About shows content (`CONTENT_TYPE_LABELS` label + key), priority mode (label; null reads "Everyone gets one") and notes (`summary`), each omitted when empty; "No details yet" when all are;
   - Copy plan writes `buildDiscordPlan(goal, ordered, canBuyFrom)` (from `planEntriesFor(row, mode)`) to the clipboard and toasts "Plan copied"; a clipboard rejection toasts "Couldn't copy the plan";
   - Copy plan renders for owner, lead, member and viewer, and **on a finished row** (vet M-8), where it is the action bar's only control for every role;
   - **D-4's order (vet M-8):** inside `progress-expansion` the action bar comes first, then the three columns in DOM order Next in line · Last drops · About (headings in that order).
2. **Implement.**
3. **Gates:** as TG3, plus `dupes` (deadcode delta now `dropWeekLabel` only).

**Acceptance (browser, G2b):** as DevOwner on a seeded farm: the queue, Show all, About, Copy plan pasted into the PR body (and Copy plan on a finished farm). As a viewer: the unranked "Need: … · Want: …" line and no counts. Shots: open with the queue, Show all, the viewer line; light and dark.

### PR G3 · S2a-3a·G3 — logging

#### Task TG5 — Log a drop, I got it, Undo, the refresh, the last three drops (RISKIEST in G3 · `xivrp-implementer-deep`)

**Goal:** criterion 4 (D-5, D-6, D-16, D-19, D-21, R-S3-5…R-S3-8, R-S3-14, R-S3-16).

**Files.** Create `progress/LogDropButton.tsx`, `progress/IGotItButton.tsx`, `progress/DropList.tsx` (the last three, labels, character; TG6 adds Show all and delete) and tests. Modify `FarmExpansion.tsx` (action bar), `ProgressPage.tsx` (pass `weekStartDate` gated by `clockResolved`, R-S3-9), `stores/collectionGoalStore.ts` (a shared file: `refreshGoalProgress`, `loadDrops`), extend `stores/collectionGoalStore.progress.test.ts`. Add G3's internal release item ("Progress: log a drop and I got it", `internal: true`).

**Interfaces — produces:** `refreshGoalProgress(groupId: string, goalId: string, opts?: { lists?: boolean }): Promise<void>`; `loadDrops(groupId: string, goalId: string): Promise<{ error: unknown | null }>` (R-S3-5, vet I-8). **Consumes:** `dropWeekLabel` (TG2); `queueFor` (TG1); `FarmExpansion`'s `currentUserId` (TG3).

1. **Tests first:**
   - a lead sees "Log drop for Healer 1" (#1); one click sends `POST …/drops` `{ recipient_user_id: <#1>, notes: null }`, toasts "Drop logged for Healer 1" with Undo, and calls `refreshGoalProgress`; a double click sends one request;
   - the ▾ opens the picker named "Log a drop for {track}": a `radiogroup` of `radio`s (vet M-2; ArrowDown/ArrowUp move the checked option, one tab stop), the queue in order with "#n", "Not in the queue" with the rest of the columns that have a `userId` in column order, then Nobody; #1 checked; picking Melee 2 and a note "first clear" sends both; Nobody sends `recipient_user_id: null` and toasts "Drop logged · Undo";
   - **Not-on-the-roster (R-S3-14, vet C-2):** a Not-on-the-roster Need with the fewest totems is #1 and the main button names them; a Not-on-the-roster Pass member is listed under "Not in the queue" and can be picked; a "Card not set up" member logged in sees "I got it" on their own cell and it sends their `userId`;
   - `free_roll`: the main button reads "Log a drop", opens the picker, Nobody checked; an empty queue behaves the same;
   - **Escape (R-S3-4, vet I-2):** Escape inside the open picker closes only the picker (the panel stays open, `?track` unchanged, focus back on ▾);
   - Undo calls `deleteDrop` with the returned id, then refreshes; it works after the panel closes; a failed Undo toasts "Couldn't undo the drop";
   - a member with an own cell on Need, Want, Pass or blank sees "I got it"; on Have, nothing; a viewer, nothing; one click sends their own column's `userId` and toasts "Logged as yours · Undo";
   - **one per member per farm (R-S3-16, vet I-6):** a member on **Pass** clicks "I got it": the drop logs, the cell stays Pass, and the button is gone; on a **custom farm with no catalog item** and a blank cell, the same; a loaded drop list that already holds a drop for `currentUserId` hides the button on open; a second click while the first is in flight sends nothing, and the button stays disabled until `refreshGoalProgress` resolves (hold that promise in the test and assert the lock, then release it); Undo of that drop brings the button back; while the drops are loading the button is not shown; if `loadDrops` fails, D-5's cell rule alone decides;
   - **under View As** (`isViewingAs`, `currentUserId` = the viewed user) "I got it" sends the viewed user's id, and R-S3-16 reads drops for the viewed user;
   - finished rows show no drop action;
   - a failed log toasts an error and leaves the row unchanged;
   - the last three drops render newest first as "Week 2 · Melee 1 · ×1 · first clear" (week from R-S3-9); a drop's name follows R-S3-12 (vet M-4): "Nobody" for a null recipient, the display name, else the character name, else "Unknown member", with "(Aria Moon)" only when the character name differs; a drop with no `recipientCharacterName` field at all renders the display name alone; no drops reads "No drops logged yet."; a failed `loadDrops` reads "Couldn't load drops" with a Retry `Button` that calls `loadDrops` again, while the rest of the panel renders;
   - `loadDrops` writes `drops[goalId]` and `dropsLoading` like `fetchDrops` and resolves `{ error: null }`; on a rejected request it resolves `{ error }` and leaves `drops[goalId]` as it was; `fetchDrops` still swallows (its existing tests unedited);
   - `refreshGoalProgress` fetches the one goal's progress, and with `lists` also the goals and the full progress.
2. **Implement.**
3. **Gates:** the touched tests, `lint`, `check:design-system:strict`, `build`, `deadcode` (delta: none left). `collectionGoalStore.test.ts` and `DropHistoryPanel.test.tsx` pass unedited.

**Acceptance (browser), criterion 4:** as DevOwner: log for #1 in one click and Undo; log for someone else with a note; Nobody; log for a Not-on-the-roster member from the picker. As DevMember: "I got it", watch the cell turn Have and Profile ▸ Collections show it, and the button disappear; check a second static where DevMember is on Need for the same item: it stops queueing them (V2's queue there no longer lists them; the server side is pinned by `backend/tests/test_farm_drop_authz.py:990`, `test_the_other_statics_merged_state_follows_the_revert`, vet M-7); Undo and watch all three return; then set Have and see "I got it" disappear. On Pass: "I got it" once, then gone. After a plugin token sync (`POST plugin/collections/sync` with the dev API key, as S2a-1's walk), Undo still restores. Shots: split button, picker, toasts, member view; light and dark.

### PR G4 · S2a-3a·G4 — drops and the row menu

#### Task TG6 — Show all and drop delete (`xivrp-implementer`)

**Goal:** D-13's drops half and D-14.

**Files.** Modify `progress/DropList.tsx` and its test. Add G4's internal release item ("Progress: drop history and the row menu", `internal: true`).

1. **Tests first:**
   - "Show all ({n})" under the last three expands in place to every fetched drop (≤ 50);
   - the delete `IconButton` ("Delete drop for {name}, {date}", the name per R-S3-12) shows for a lead on every drop, for a member on drops whose `createdById` is theirs, and for nobody else (a viewer: none);
   - it opens V1's confirm exactly (vet M-3, `DropHistoryPanel.tsx:120-123`): `ConfirmModal` titled **"Delete Drop"**, `variant="danger"`, label "Delete", with the message `Delete this drop? {recipientDisplayName ?? 'The recipient'} goes back to {Need|Want} if it was their only drop.` when `recipientPriorState` is set, else `Delete this drop?`; the test asserts the title, the danger variant and both messages; confirming calls `deleteDrop` then `refreshGoalProgress`; a failure keeps the confirm open with an error toast;
   - **Escape (R-S3-4, vet I-2):** Escape inside the open confirm closes only the confirm; the panel stays open and `?track` is unchanged.
2. **Implement.**
3. **Gates:** as TG5.

#### Task TG7 — the row menu column: Mark finished, Reopen, Delete (`xivrp-implementer`)

**Goal:** D-9 (as amended by D-22), D-10, D-11, D-22; P-46. (Edit's menu item is TG8's, vet M-1.)

**Files.** Create `progress/FarmRowMenu.tsx` and its test. Modify `ProgressMatrix.tsx` (the leads-only "Actions" column header, `'__menu'` in `colKeys` after `'__name'`, `spanAll` + 1 for leads; R-S3-17), `FarmRow.tsx` (the menu `<td role="gridcell">` with the `IconButton` taking `cellProps(goalId, '__menu')`; the status cell keeps reading only "Everyone has it"), `FarmExpansion.tsx` (Mark finished in the action bar when everyone has it), `FinishedFarms.tsx` (the menu cell as a plain tab stop), `ProgressPage.tsx` (close and clear `?track` when the open goal is deleted; follow it into or out of Finished). Extend `ProgressMatrix.test.tsx`'s rewritten grid cases (TG3) with the lead's `'__menu'` column, and `e2e/progress.spec.ts:243-256` likewise (the owner is a lead: Tab still lands on the one stop, the name).

1. **Tests first:**
   - leads see an `IconButton` "Actions for {title}" (`aria-haspopup="menu"`) in its own column, opening `ContextMenu` with Mark finished · Delete on active rows and Reopen · Delete on finished rows (TG8 prepends Edit); members and viewers see no button and no column (hidden, not disabled; their `spanAll` is one less);
   - **the menu column in the grid (R-S3-17, vet I-1):** for a lead, ArrowRight from the name focuses the menu button, ArrowRight again the first player cell, ArrowLeft back through the menu to the name; Home lands on the name; the grid still has one Tab stop; for a member the name's ArrowRight goes straight to the first player cell; Finished rows' menu buttons are plain tab stops, not arrow targets;
   - Mark finished sends `PUT …` `{ status: 'complete' }`, toasts "Marked finished · Undo", refreshes with `lists`; Undo sends `{ status: <the prior status> }` (Wanted, Farming and Scheduled each pinned);
   - **"Everyone has it" (D-22):** the status cell reads exactly "Everyone has it" for leads when n = m > 0, with no link or button in it; with that row open, the panel's action bar shows a "Mark finished" `Button` (leads only, not when n < m, not for members or viewers) that does the same as the menu item;
   - Reopen sends `{ status: 'farming' }` and toasts "Reopened";
   - Delete opens `ConfirmModal` titled "Delete Goal" with `Delete "{title}"? This will remove all participant states and drop history for this goal.`, label "Delete", danger; confirming calls `deleteGoal`, closes the panel and removes `?track`;
   - Escape inside the Delete confirm closes only the confirm (R-S3-4);
   - the open row stays open as it moves into Finished (Finished expands) and back out on Reopen.
2. **Implement.**
3. **Gates:** as TG5.

**Acceptance (browser, G4):** as DevOwner: Show all, delete a drop (confirm "Delete Drop" names the prior state), Mark finished + Undo, Mark finished from the action bar on a farm everyone has ("Everyone has it" alone in the status cell), arrows across the name, the menu and the cells, Reopen, Delete a seeded farm. As DevMember: delete only their own drop; no menu column. Shots of each; light and dark.

### PR G5 · S2a-3a·G5 — Edit

#### Task TG8 — inline Edit (`xivrp-implementer`)

**Goal:** §12.2 exactly, with D-12 and R-S3-10.

**Files.** Create `progress/FarmEditBlock.tsx` and its test. Modify `FarmExpansion.tsx` (the block on top while editing), `FarmRowMenu.tsx` (adds the **Edit** item first on active rows, vet M-1; it opens the row and enters the block), `ProgressPage.tsx` (the dirty guard on opening another row, on closing the row and on Mark finished), `utils/goalTypeMeta.ts` (`GOAL_STATUS_OPTIONS`; TG4 created the others). Add G5's internal release item ("Progress: inline Edit", `internal: true`).

1. **Tests first:**
   - the lead's menu on an active row reads Edit · Mark finished · Delete; Edit opens the row with the block on top and Title focused; fields: Title (`Input`, required, ≤ 200), Type (`Select`, the 10, labels from `GOAL_TYPE_LABELS`), Status (`Select` Wanted · Farming · Scheduled), Content (`Select` None + the 7 from `CONTENT_TYPE_LABELS`, e.g. "Chaotic Alliance", "Other / Custom") and its key (`Input` "Duty or key (optional)", ≤ 50), Priority mode (`Select`, the 6 from `PRIORITY_MODE_OPTIONS`: a goal with `priorityMode: null` shows "Not set" and the help "Queues as Everyone gets one."; the help line follows the chosen one), Notes (`Input`, writes `summary`);
   - Save is disabled while Title is blank or nothing changed; Save sends `PUT` with only the changed fields of those seven (never `note`), toasts "Saved", refreshes, and closes the block;
   - clearing Notes sends `summary: null`; clearing Content Key sends `content_key: null`; a Notes of only spaces sends `null`; choosing "Not set" sends `priority_mode: null`; Content "None" sends `content_type: null`;
   - Escape and Cancel discard; a failed save keeps the block with an error toast;
   - **Escape (R-S3-4, vet I-2):** Escape inside an open Edit `Select` closes only the select; the block keeps its edits and the panel stays open;
   - with unsaved changes, opening another row asks "Discard changes?"; Keep editing keeps both as they were; Discard opens the other row;
   - **the dirty guard on the other exits (vet M-8):** with unsaved changes, clicking the open row's name button asks "Discard changes?" (Keep editing keeps the row open with the edits; Discard closes it and clears `?track`); choosing Mark finished from the menu or the action bar asks the same before any `PUT` (Keep editing sends nothing; Discard then marks finished);
   - members and viewers can't reach Edit.
2. **Implement.**
3. **Gates:** as TG5, plus `dupes`.

**Acceptance (browser, G5):** as DevOwner: Edit each field on a seeded farm, Save and see About follow; clear Notes; "Discard changes?" from another row, the name button and Mark finished. Shots: the block open, a priority mode's help, the discard confirm; light and dark.

### PR G5b · S2a-3a·G5b — the proof

#### Task TG9 — e2e, axe, role gating, contrast (`xivrp-implementer`)

**Goal:** criteria 4, 5 (`?track=<id>`), 10 and 11 end to end.

**Files.** Extend `frontend/e2e/progress.spec.ts` (reuse `ownerSession`, `trackBlankCatalogFarm`, `deleteSeededFarms`, `PREFIX`), `frontend/e2e/role-gating.spec.ts`, `frontend/e2e/contrast.spec.ts`. Add G5b's internal release item ("Progress: row expansion end-to-end checks", `internal: true`).
- `progress.spec.ts`, as owner: `?track=<id>` opens the row in view; arrows reach the name and the menu column, never the panel; log for #1 and Undo; log for Nobody with a note; Mark finished, Undo, Mark finished from the action bar on a farm everyone has, Reopen; Edit the title and save; Delete; axe with the row open, the picker open and Edit open, both themes, 1440 × 900. As member: "I got it", the button gone after the log, Undo, the button back.
- `role-gating.spec.ts`: member: no row menu column, no Log a drop, "I got it" present; **viewer (R-S3-15):** Copy plan only, no "Actions" column, and the queue reads as the unranked "Need: … · Want: …" line with no "#" and no counts; owner pin: menu column present.
- `contrast.spec.ts`: Progress with a row open, both themes.

1. **Tests first** as listed. The features already shipped in G2–G5, so prove each new e2e can fail: run it once against #375's head (`57f1542c`) and record in the ledger that it fails for the right reason (the S2a-3a control is missing), then on G5b's head, where it passes.
2. **Gates:** `pnpm -C frontend test:e2e` for the three files against the worktree's servers (paste the counts), plus the unit gates.

**Acceptance (browser), criteria 4, 5, 10:** the full walk as DevOwner, DevMember and a viewer (demote DevMember from an owner session, restore after; handoff recipe), light and dark.

---

## Finish (each PR)

- `git fetch`; renumber if `releaseNotes.ts` moved on `origin/main` (R-S3-11). The size check (`git diff --stat <parent>...HEAD`), the `pr-checklist` skill, and the slice-loop §5 gates: `pytest` when backend changed, `pnpm -C frontend build`, `lint` (0 errors, warnings ≤ the parent's), `check:design-system:strict`, `test`, `deadcode` unchanged except the allowed delta below, `dupes`. Paste the counts.
- **The allowed `deadcode` delta (vet M-6).** knip may report only these exports as unused, each until the PR that consumes it, and must report none after G3: `queueEntryText` (G1 and G2; consumed by TG4 in G2b), `planEntriesFor` (G1 and G2; consumed by TG4 in G2b), `dropWeekLabel` (G1, G2 and G2b; consumed by TG5 in G3). Anything else new in knip's output is a finding. Record the delta in each PR body.
- **The shared files (§ Shared files):** the V1 pins named there pass unedited; `git diff <parent>...HEAD -- <the pin files>` is empty.
- **The live check (slice-loop §2):** the worktree's servers (`mkdir -p .logs` first) on a copy of the dev DB, dev-auth login, `/group/DEVTST?shell=v2`. DEVTST has no farms: seed through `POST …/collection-goals/from-suggestion` with a real `catalog_item_id` and the "E2E Progress" prefix, delete after. Toasts last ~8 s: click Undo promptly. Shots shrunk to `docs/redesign/pr-shots/s2a3a-<pr>-*.webp` (`python scripts/shrink-pr-shots.py`).
- `gh pr create --draft --base <parent branch>`, then the item's `pr`/`prTitle`.
- **The PR body:** V1 files touched (G1 only: `CollectionsHub.tsx`, pinned by the test committed first); the shared files it edits and their unedited V1 pins; the additive response field and the plugin contract unchanged (G1); the owner's decisions it implements (D-n); the `deadcode` delta; disclosed residuals (design §7; R-S3-7's View As note in G3).
- **The stack's merge (after G5b):** § Size and stack's three steps in order: update the whole stack onto `main`, then the preflight push and the local e2e run (counts and the run link into #370), then merge bottom-first with no further update; re-run from the update if `main` moves.

## Write-backs (once, after the stack merges)

- The design note §9's write-backs to the parent spec, plus the S2a-2 plan's (:518-523), in one docs PR. They include the plan-vet's: D-15 corrected (week 1's start, vet C-1); D-9 amended by D-22 (S2-5 :32 loses the inline "· Mark finished" link; Mark finished lives in the row menu and, when everyone has it, the panel's action bar); D-19…D-22 into S2-8 and S2-9.
- `PRODUCT_MODEL.md` §6 and `HOME_STRETCH.md`'s S2a row: S2a-2 and S2a-3a shipped, with PR numbers.
- Memory `project_home_stretch`: the stack merged; next S2a-3b.

## Carried, not S2a-3a

- **Change order / Back to automatic** (D-1): its own slice. It needs a way to clear `priority_rank` (the PATCH treats `null` as unchanged) and an order UI; the queue model (TG1) then honours a pin.
- **The stored `recipient_character_id` on Undo** (D-3): a residual.
- **S2a-3b:** the tier row's expansion and `?track=tier`.
