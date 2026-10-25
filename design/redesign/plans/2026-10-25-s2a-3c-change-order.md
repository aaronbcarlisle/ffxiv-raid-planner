# S2a-3c · Change order / Back to automatic (V2)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo. Each PR below is one slice-loop run: its own ledger, one whole-branch review against its parent branch, one fix wave.

**Plan-vet: not yet run.** The owner skipped co-design; this plan follows the recommendations of D-1…D-10 (design note). Before TC1 the controller folds in the owner's answers, re-cuts any task an answer changes, and dispatches `xivrp-director` (slice-loop §0). D-6 "buttons only" → TC4 keeps only the proof.

**Goal:** a lead pins a farm's queue from the open row's Next in line (**Change order**: Move up/down and drag, Save order) and drops the pin (**Back to automatic**), each with an Undo toast; the queue model honours the pin, so Next in line, "Log drop for {#1}" and Copy plan follow it; a rank-only write leaves each cell's provenance true; V1 shows the pin through its existing rank displays.

**Design (binding):** `design/redesign/specs/2026-10-25-s2a-3c-change-order-design.md`, D-1…D-10, E-1…E-10, §3–§7. It sits on the parent spec `design/redesign/specs/2026-09-30-s2a-progress-design.md`: S2-7 :45, S2-8 (:55 is this slice), S2-9, §5 "Queue order", §7 criteria 10 and 11 and the new V1 delta (l).
**Parity matrix (binding):** `design/redesign/specs/2026-09-30-s2a-parity-matrix.md`: the proposed P-126 and the P-22, P-33, P-38 notes (design §6), written into the matrix in this plan's PR once the owner has answered.
**Earlier plans (binding):** S2a-2 (`plans/2026-10-08-s2a-2-progress-tab.md`) R-S2-1, R-S2-2 (new cases in new files), R-S2-5, R-S2-14, R-S2-15, R-S2-16, R-S2-17; S2a-3a (`plans/2026-10-10-s2a-3a-row-expansion.md`) R-S3-4, R-S3-5, R-S3-6, R-S3-13, R-S3-14, R-S3-15; S2a-3b R-T-10.
**Scope (binding).** The files each task names, no others. **Not edited:** the participant PATCH routes and `ParticipantStateUpsert`, `write_row`, `components/collections/**`, `components/ui/**`, `components/primitives/**`, `pages/**`, `backend/app/database.py`. No migration. **V1 renders byte-for-byte as today**; its rank displays show a pin once a V2 lead sets one (delta (l), D-10), release-noted in C3.
**Plugin contract (binding, `CLAUDE.md` § Pitfalls).** No plugin route or DTO changes. The plugin never sends or reads `priority_rank` (E-9). TC1 adds a case that a plugin sync leaves a pin in place.

## Size and stack

Estimates use the S2a-2 rule: code lines ÷ 0.35 (tests), × 1.8 (the measured overrun); a rewritten test line counts twice. The cap is ~1,500 changed lines, plan excluded (slice-loop rule 1). D-1's cut, four PRs, one task each.

| PR | Slice | Branch · base | Task (code est.) | Total |
|---|---|---|---|---|
| C1 | **S2a-3c·C1** the queue-order route | `feat/s2a3c-c1-queue-order` · `main` | TC1 route, `write_rank`, guard, AUTHZ row, pytest (~125) | ~650 |
| C2 | **S2a-3c·C2** the pinned queue | `feat/s2a3c-c2-pinned-queue` · `main` (after C1 merges) | TC2 `queueFor` with the pin, `queueIsManual`, `pinnedOrder`, the draft helpers, `setQueueOrder` (~95) | ~490 |
| C3 | **S2a-3c·C3** Change order | `feat/s2a3c-c3-change-order` · C2 | TC3 controls, tag, editor with buttons, Save, Back to automatic, Undo (~200, **deep**) | ~1,050 |
| C4 | **S2a-3c·C4** drag and the proof | `feat/s2a3c-c4-drag-proof` · C3 | TC4 the drag handle (~70) and the e2e (~400) | ~760 |

- **Order.** C1 opens, passes and merges alone (backend, as S2a-3b's H1). C2's branch is cut from a `main` that holds C1. C2…C4 are one stack.
- **Worktrees.** C1 gets a short-lived one; the stack gets `.claude/worktrees/s2a3c`. Copy `frontend/.npmrc` in before `pnpm -C frontend install` (`CLAUDE.md`).
- **The cap.** At each Finish run `git diff --stat <parent>...HEAD`. C3 is the one near it: if it runs over, stop and re-cut with the controller before opening (the ledger records the cut). Don't trim tests.
- **Merging (R-S2-1), in one session.** Stack PRs open as drafts. After C4: (1) update the stack onto the latest `main` (slice-loop § Stacked PRs); (2) push the top commit to `redesign/s2a3c-preflight` (a draft PR to `main` labelled `no-automerge`) and run `e2e/progress.spec.ts`, `e2e/role-gating.spec.ts` and `e2e/guest.spec.ts` locally on that tree; (3) once that run is green on that exact tree, merge C2…C4 bottom-first with no further update. If `main` moves first, go back to (1). Link the run and paste the counts in C2's body. Close the preflight PR after.

## Code facts checked (worktree `s2a3cplan` at `00eb394a`, 2026-10-25)

| Fact | Where | Consequence |
|---|---|---|
| The PATCH maps `null` to unchanged | `backend/app/services/collection_records.py:379-381` (`unset_if_none`); `routers/collection_goals.py:881` (self, leads only), `:1066` (lead for another) | Unchanged; the clear is a new route (E-1) |
| V1's store sends `priority_rank: data.priorityRank ?? null` on every write; its one caller sends `{ state }`; `upsertStateForUser` has no caller; V2's `setCell` sends state and count only | `frontend/src/stores/collectionGoalStore.ts:742,764,784-787`; `components/collections/RewardGoalDetailModal.tsx:42` | Explicit `null` can't mean "clear" (E-1). **No V1 control sets a rank** (design §8: S2-8 :55 corrected) |
| `ParticipantStateUpsert`: `state` required, `priority_rank` `ge=1` | `schemas/collection_goals.py:105-109` | A PATCH flag would rewrite state per member (E-1) |
| Self PATCH refuses viewers, ignores a member's rank; lead PATCH `require_can_manage_members`, a viewer target 400 | `collection_goals.py:939-941,1012,1027-1028` | The route's gate mirrors the lead PATCH (R-C-1) |
| `write_row` sets `updated_at`, `updated_by_user_id`, `updated_via` on every write; the only rank writes are its `:783-784`, from the two PATCHes and Undo's restore | `collection_records.py:735-736,783-784,802-804`; `collection_goals.py:881,1066,1241` | A rank-only door (R-C-2, D-9) |
| Cell provenance reads the row's writer and channel | `components/progress/progressProvenance.ts:36-46,66-75` | D-9 |
| PROV-1 guard: `priority_rank` is TRACKED and a FACT that must be stamped; the door functions are an exact set; `_stamp_problems` checks (f) | `backend/tests/test_provenance_coverage.py:117-140,695,761-763,894-896` | TC1 adds `write_rank` and one named exemption (R-C-2) |
| Undo skips a row whose `updated_at` moved and otherwise restores its prior rank (token format 2) | `collection_goals.py:1223,1241`; `services/participant_undo.py:34,55,69` | `write_rank` moves `updated_at` (E-3) |
| `list_participants` orders by rank (nulls last), `updated_at`, id; viewers get `priority_rank` null, and so does the Progress read | `collection_goals.py:151,207-211,784`; `backend/tests/test_progress_participants.py:247,260` | V1 delta (l); viewers can't see a pin |
| The bulk Need: lead helper, one `now`, skips counted, one commit; its schemas and 200 cap | `collection_goals.py:1263-1412` (`:1287`); `schemas/collection_goals.py:188-211` | TC1's shape |
| `_get_goal(..., for_update=True)` locks the goal | `collection_goals.py:235-237` (used `:1432`) | Concurrent saves serialise (E-2) |
| AUTHZ rows for the participant writes and the bulk Need; the table must list every mutation route | `backend/tests/authz_matrix.py:532-544`; `tests/test_authz_matrix.py:532` | One new row (R-C-3) |
| The plugin's farm calls; no `priority_rank` anywhere in the plugin; the sync doors never pass it | `XIVRaidPlannerPlugin/Api/RaidPlannerClient.cs:370-378`; `collection_records.py:1009` (`_sync_row`), `:1071` (`apply_sync`) | E-9; TC1's sync case |
| `queueFor` ignores rank; its consumers | `frontend/src/utils/progressQueue.ts:29-56`; `progress/QueueList.tsx:27`; `progress/LogDropButton.tsx:54`; `utils/discordPlan.ts:69-87` | TC2 (R-C-4) |
| The entry carries `priorityRank`; fixtures default it null | `stores/collectionGoalStore.ts:116,421`; `progress/__fixtures__/progressFixtures.ts:42` | Existing queue tests hold unedited |
| `cellFor` gates counts for a viewer reader because View As reads come back as the admin | `utils/progressModel.ts:146-179` | Viewer callers pass `pin: false` (E-5) |
| QueueList: the viewer line, the ranked `<ol>`, Show all | `progress/QueueList.tsx:32-44,46-58,59-63` | TC3 edits the non-viewer branch only |
| FarmExpansion: `lead`; the Next in line section; the Escape filter; FarmEditBlock's own-Escape rule; `focusCopyPlan` | `progress/FarmExpansion.tsx:98-99,193-200,140-144,27-30,95-97` | TC3 (R-C-6, R-C-7) |
| `toast.withUndo`; `messageOf`; `wasToastedByApi`; `BUSY_CLASS` | `stores/toastStore.ts:104`; `progress/undoToasts.ts:12`; `services/api.ts:88`; `progress/useDrops.ts:27` | R-C-8 |
| `refreshGoalProgress`; `api.put` | `stores/collectionGoalStore.ts:593,882`; `services/api.ts:338` | R-C-5 |
| dnd-kit 6.3.1 / sortable 10.0.0; the sortable list with Pointer and Keyboard sensors and Move up/down `IconButton`s; `IconButton` forwards ref and props | `frontend/package.json:39-41`; `components/priority/PlayerBasedEditor.tsx:100,318-331,438-447`; `primitives/IconButton.tsx:41-68` | TC3's buttons, TC4's handle |
| The grid's keys are per cell; the panel row is outside its rows (R-S3-4) | `progress/useMatrixKeyboard.ts:126` | No grid change |
| A demoted viewer keeps a claimed column; lead controls | `progress/ProgressPage.tsx:296-301,307` | Design §7; R-C-6 |
| e2e `seedFarm`, `setStates`, claimed columns, axe helper; role-gating's S2a-3a block | `frontend/e2e/progress.spec.ts:483,747-790,1462`; `e2e/role-gating.spec.ts:432-563` | TC4 |
| `CURRENT_VERSION = '2.1.75'`; 2.1.76–2.1.77 above it are internal | `data/releaseNotes.ts:12,63,125` | R-C-10 |

## Rulings (bind every task)

The design note's D-n and E-n bind. These are the plan's own:

- **R-C-1 (the route, E-1, E-2).** `PUT /static-groups/{group_id}/collection-goals/{goal_id}/queue-order`, `response_model=QueueOrderResponse`, handler `set_queue_order(group_id, goal_id, body: QueueOrderRequest, session, current_user)`. Schemas (snake_case, as the farm routes): `QUEUE_ORDER_MAX_USERS = 200`; `QueueOrderRequest { user_ids: list[str] = Field(..., max_length=QUEUE_ORDER_MAX_USERS) }` with a validator that refuses duplicates (422); `QueueOrderResponse { ranked: int; cleared: int; skipped: int }`. Steps: `get_static_group`; `require_can_manage_members`; `_get_goal(..., for_update=True)`; select every row of (goal, static); target rank = position + 1 for each listed user who has a row, `None` for every other row; `write_rank` on each; `ranked` = listed users with a row, `cleared` = rows taken from a rank to `None`, `skipped` = listed users with none; `logger.info("collection_queue_order_set", group_id=…, goal_id=…, ranked=…, cleared=…, skipped=…)`; one commit. No role check on listed users, no goal-status check, no undo token.
- **R-C-2 (the door, D-9, E-3).** `async def write_rank(db: AsyncSession, *, row: RewardParticipantState, priority_rank: int | None, now: str) -> bool` in `services/collection_records.py`, after `write_row`. `ValueError` for a rank below 1. Equal rank: returns False, writes nothing. Else sets `row.priority_rank` and `row.updated_at = now`, returns True; touches no other column. The caller flushes. Guard: `DOOR_FUNCTIONS` gains `"write_rank"`; (f) gains `UNSTAMPED_FACT_WRITES = {("write_rank", "priority_rank")}` (comment: S2a-3c D-9), honoured by `_stamp_problems` for that pair only. `write_rank` is not a door entry point under (g) (it takes no writer). The guard's existing cases pass unedited.
- **R-C-3 (AUTHZ, R-S2-14).** `R("PUT", CG + "/{goal_id}/queue-order", "lead", "helper", "set or clear a farm's queue order (S2a-3c)", build=lambda w: _r(_goal(w), None, {"user_ids": [w.u["member2"].id]}))`. Not a plugin row.
- **R-C-4 (the queue, D-2, D-3, E-5).** In `utils/progressQueue.ts`: `QueueEntry` gains `pinned: boolean`; `interface QueueOptions { pin?: boolean }` (default true); `queueFor(row, mode, opts?: QueueOptions)` builds today's list, then stable-sorts it: both pinned → `priorityRank` ascending; a pinned before an unpinned; otherwise 0; then numbers 1…n. `pinned = opts.pin !== false && cell.entry?.priorityRank != null`. `queueIsManual(queue: readonly QueueEntry[]): boolean` (any pinned). `pinnedOrder(row: FarmRow): string[]`: every cell with a member whose entry has a rank, by rank, ties in column order (Have rows included, so Undo keeps their ranks). Draft helpers (E-7): `orderedDraft(draft: readonly string[], queue: readonly QueueEntry[]): QueueEntry[]` (draft ids still queued in draft order, then queued ids not in the draft in queue order) and `moveEntry(order: readonly string[], userId: string, toIndex: number): string[]` (clamped; same array content when unchanged). `planEntriesFor(row, mode, opts?: QueueOptions)` passes `opts` through. Callers: `QueueList` passes `{ pin: !viewer }`; FarmExpansion's Copy plan passes `{ pin: !viewer }`; `LogDropButton` (leads only) keeps the default.
- **R-C-5 (the store, E-6).** `setQueueOrder: (groupId: string, goalId: string, userIds: readonly string[]) => Promise<{ ranked: number; cleared: number; skipped: number }>`: `api.put` to `/api/static-groups/${groupId}/collection-goals/${goalId}/queue-order` with `{ user_ids: [...userIds] }`, then `await get().refreshGoalProgress(groupId, goalId)`; a failed PUT rejects and refreshes nothing. Additive (V1 delta (e)).
- **R-C-6 (the controls, D-5, D-7, R-S2-17).** `QueueList` gains `canOrder: boolean` (FarmExpansion passes `lead && !finished`), `groupId: string` and `onLeave: () => void` (`focusCopyPlan`). In the non-viewer branch, first: a row holding `{manual && <Tag variant="label">Manual order</Tag>}`, then for `canOrder && mode !== 'free_roll'`: **Change order** (`Button variant="ghost" size="sm"`, `leftIcon` `ArrowUpDown`) when `queue.length >= 2`, **Back to automatic** (`Button variant="ghost" size="sm"`, `leftIcon` `RotateCcw`) when `manual`. Under the list when `manual`: `<p className="text-xs text-text-muted">Set by a lead. Anyone added later follows in the automatic order.</p>`. The viewer branch is unchanged (no tag, no caption). Absent, not disabled, for members, viewers, finished rows and `free_roll`.
- **R-C-7 (the editor, D-6, E-7, E-8).** `progress/QueueOrderEditor.tsx`: `QueueOrderEditor({ queue, tokenCost, saving, onSave, onCancel }: { queue: readonly QueueEntry[]; tokenCost: number | null; saving: boolean; onSave(userIds: string[]): void; onCancel(): void })`. Draft state seeded from `queue` at mount; render `orderedDraft(draft, queue)` as `<ol aria-label="Queue order">`, each `<li>`: "#k", "{name} · {queueEntryText}", `IconButton` "Move {name} up" and "Move {name} down" (`aria-disabled` at the ends, a no-op there; focus stays on the pressed button as its entry moves). A `VisuallyHidden` `role="status"` line reads "{name}, {k} of {n}" after a move. Footer: **Save order** (`Button variant="primary" size="sm"`, `className={BUSY_CLASS}`, `aria-disabled` while `saving`, ignores clicks then) and **Cancel** (`variant="ghost"`). `onKeyDown`: Escape not already prevented → `preventDefault()`, then `onCancel()` (C4 adds: unless a drag is active). Show all is not rendered while editing.
- **R-C-8 (save, Back to automatic, Undo; D-8).** In `QueueList`: `prior = pinnedOrder(row)` read before each write. **Save:** `await setQueueOrder(groupId, goalId, ids)` → close the editor, focus Change order, `toast.withUndo('Order saved', () => void restore(prior))`. **Back to automatic:** `setQueueOrder(…, [])` → `toast.withUndo('Back to automatic order', () => void restore(prior))`, focus Change order, or `onLeave()` when Change order is absent. **restore(ids):** `setQueueOrder(…, ids)` → `toast.success('Order restored')`. A failure toasts `Couldn't save the order: ${messageOf(err)}` (or `Couldn't restore the order: …`) unless `wasToastedByApi(err)`; a failed Save keeps the editor and its draft. One write at a time per list.
- **R-C-9 (the handle, D-6; C4).** `DndContext` with `useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))` and `SortableContext` (`verticalListSortingStrategy`) over the ordered ids; each `<li>` takes `useSortable({ id: userId })`'s node ref and transform; the handle is an `IconButton` "Reorder {name}" (`GripVertical`) taking `setActivatorNodeRef`, `attributes` and `listeners`. `onDragEnd` → `moveEntry(draft, active.id, ids.indexOf(over.id))`. `accessibility.announcements` use names, never user ids. While a drag is active, Escape is left to dnd-kit (still `preventDefault`ed, so the panel stays open).
- **R-C-10 (release notes, R-S2-16, R-T-10).** Each PR takes the next free version at its Finish. C1: `internal: true` "Farm queue order route". C2: internal "Progress: the queue honours a lead's order". C3: one public `improvement` for delta (l), "A lead's farm queue order now shows in the classic farm view as ranks" (bumps `CURRENT_VERSION`), plus an internal item "Progress: Change order and Back to automatic". C4: internal "Progress: drag to reorder; end-to-end checks". `pr`/`prTitle` on each; escape `'` as `\'`.
- **R-C-11 (V1 and the PATCH intact).** The PATCH routes, `ParticipantStateUpsert` and `write_row` are not edited; their existing pytest cases pass unedited (`test_farm_drop_authz.py:1053-1096`, `test_record_provenance.py:1036-1174`, `test_count_visibility.py:372-376`, `test_participant_merge.py:381-402`). V1's Copy plan pin `components/collections/CollectionsHub.copyPlan.test.tsx` passes unedited.

## Shared files (V1 reaches them)

| File | The edit (task) | The V1 path that reaches it | The unedited pin |
|---|---|---|---|
| `backend/app/routers/collection_goals.py` | one new route (TC1) | V1 farm reads and writes | every existing `test_collection_goals.py`, `test_farm_drop_authz.py`, `test_mark_need.py` case |
| `backend/app/services/collection_records.py` | `write_rank` added; `write_row` untouched (TC1) | every farm-row and record write, the plugin syncs | `test_participant_merge.py`, `test_record_provenance.py`, `test_write_provenance.py` |
| `stores/collectionGoalStore.ts` | `setQueueOrder` added (TC2) | V1 `CollectionsHub`, `RewardGoalDetailModal` | `collectionGoalStore.test.ts` unedited |
| `utils/discordPlan.ts` | `planEntriesFor`'s optional `opts` (TC2); `buildDiscordPlan` untouched | V1 Copy plan through `buildDiscordPlan` | `CollectionsHub.copyPlan.test.tsx` unedited |

## Review Focus

- **TC1:** only `priority_rank` and `updated_at` move on a re-ranked row, nothing on an unchanged one; the guard exemption is one (function, attribute) pair; a status Undo after a re-rank is skipped, never restoring the old rank; V1's `null` keeps a pin on both PATCH routes.
- **TC2:** ties, a Want above a Need, `desired_only`, `free_roll`, Have rows' ranks, Not on the roster; `pin: false` equals today's order.
- **TC3:** the draft across a refresh; focus after each move, Save, Cancel and Back to automatic; Escape never closes the panel from the editor; one PUT per click; controls absent for members, viewers, finished rows and `free_roll`; no tag for a viewer even with ranks in the data (View As).
- **TC4:** mouse and keyboard drag in a real browser; Escape mid-drag cancels the drag only; announcements name players.
- **UI rules:** no raw elements, semantic tokens, `text-xs` floor, no modal, nothing sticky.

---

### PR C1 · S2a-3c·C1 — the queue-order route

#### Task TC1 — the route, `write_rank` and the guard (`test-author`, then `xivrp-implementer`)

**Goal:** E-1…E-4, E-9, D-4, D-9; R-C-1, R-C-2, R-C-3, R-C-11.

**Files.** Modify `backend/app/schemas/collection_goals.py` (the two models), `backend/app/services/collection_records.py` (`write_rank`), `backend/app/routers/collection_goals.py` (`set_queue_order`), `backend/tests/authz_matrix.py` (R-C-3), `backend/tests/test_provenance_coverage.py` (R-C-2's door and exemption, plus its new guard cases). Create `backend/tests/test_queue_order.py`. Add C1's release item (R-C-10).

1. **Tests first** (`test-author`; fixtures as `test_mark_need.py` builds a static, goal, rows and roles; sleep 0.02 s between writes whose `updated_at` is compared):
   - a lead's PUT `[B, A]` (both Need) → B rank 1, A rank 2; `GET …/participants` lists B then A; response `{ranked: 2, cleared: 0, skipped: 0}`; the response key set is exactly `{"ranked", "cleared", "skipped"}`;
   - full replace (D-4): C (Have, rank 1) unlisted → rank null, `cleared: 1`; `[]` clears every rank of the goal; another goal's and another static's ranks are untouched;
   - a re-ranked row keeps `updated_by_user_id`, `updated_via`, `state`, `state_changed_at`, `source`, `last_manual_override_at`, `token_count`, `token_count_updated_at` and `notes`, and its `updated_at` moves; a row whose rank already matches keeps its `updated_at`;
   - an id with no row for the goal, and an id of a non-member, are skipped and counted; a listed demoted viewer who has a row is ranked;
   - duplicates → 422; 201 ids → 422; no `user_ids` → 422; another static's goal → 404; member and viewer → 403; a non-member → 403;
   - Undo: a lead's status edit (its token), then a PUT that re-ranks that row → the undo reports it skipped and the rank stays; the same with a PUT that leaves its rank alone → the undo restores the state and the rank is unchanged;
   - the PATCH (R-C-11): after a pin, a self PATCH with `priority_rank: null` and a lead PATCH for another with `priority_rank: null` both keep the rank;
   - a plugin sync through `POST /api/plugin/collections/sync` (an `xrp_` key) over a pinned row keeps its `priority_rank`;
   - `write_rank`: refuses 0; returns False and changes nothing for an equal rank;
   - the guard: `write_rank` writing `priority_rank` unstamped passes; the same write in another door function fails (f); a `state` write in `write_rank` fails (f).
   Each new route case fails on today's code (405 or 404, the route is missing), recorded in the ledger.
2. **Implement.**
3. **Gates:** `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -q` (paste the count), `venv/Scripts/ruff.exe check` on the touched files (no new violations), the migration checks (no change), frontend `build` and `test` (unchanged).

**Acceptance:** curl on the dev DB (a PUT, the GET after, `[]`, the GET after). **PR body:** the plugin contract unchanged; the PATCH and `write_row` untouched (R-C-11); the guard's one exemption and why (D-9); no V1-visible change until C3.

### PR C2 · S2a-3c·C2 — the pinned queue

#### Task TC2 — the queue honours a pin; the store action (`test-author`, then `xivrp-implementer`)

**Goal:** D-2, D-3, E-5, E-6, E-7's helpers; R-C-4, R-C-5.

**Files.** Modify `frontend/src/utils/progressQueue.ts`, `utils/discordPlan.ts` (`planEntriesFor` only), `stores/collectionGoalStore.ts` (`setQueueOrder`), `components/progress/QueueList.tsx` and `FarmExpansion.tsx` (pass `{ pin: !viewer }` only). Create `utils/progressQueue.pin.test.ts`, `stores/collectionGoalStore.queueOrder.test.ts`. Add C2's release item.

**Interfaces — produces:** `QueueEntry.pinned`; `QueueOptions`; `queueFor(row, mode, opts?)`; `queueIsManual`; `pinnedOrder`; `orderedDraft`; `moveEntry`; `planEntriesFor(row, mode, opts?)`; `setQueueOrder` (R-C-4, R-C-5).

1. **Tests first** (`test-author`; cells built with `progressFixtures.ts`, setting `priorityRank` on the entry):
   - pinned first by rank: A (Need 50, rank 2), B (Need 10, no rank), C (Want 5, rank 1), D (Need 30, rank 2) → C, D, A, B; ranks 1…4; `pinned` true for C, D, A;
   - a pinned Want above Needs (D-2); `desired_only` drops a pinned Want; `free_roll` → `[]` with ranks present;
   - a ranked Have, Pass or blank cell is not queued; `queueIsManual` false when only a Have row has a rank;
   - a ranked Not-on-the-roster cell takes its place (R-S3-14);
   - `{ pin: false }` returns exactly today's order with ranks present; with no ranks, every case in `progressQueue.test.ts` holds (that file unedited);
   - `pinnedOrder`: ranked members by rank, Have included, ties in column order, unranked out;
   - `orderedDraft`: a draft id no longer queued is dropped; a newly queued id is appended in queue order; `moveEntry` clamps at both ends and keeps the content;
   - `planEntriesFor` with ranks: the Need line follows the pin; with `{ pin: false }`, the automatic order;
   - `QueueList` with ranks present and `viewer`: the unranked line in column order, unchanged (View As);
   - `LogDropButton` with a pin: its main part reads "Log drop for {the pinned #1}" (new file `LogDropButton.pin.test.tsx`);
   - `setQueueOrder`: PUTs `{ user_ids }` to the route, then `fetchProgress(groupId, [goalId])`; a rejected PUT rejects and fetches nothing.
2. **Implement.**
3. **Gates:** the touched tests, `lint`, `build`, `deadcode` (allowed delta, § Finish), `dupes`.

### PR C3 · S2a-3c·C3 — Change order

#### Task TC3 — the controls, the editor, Save, Back to automatic, Undo (RISKIEST · `test-author`, then `xivrp-implementer-deep`; task-scoped review)

**Goal:** D-5…D-8, E-7, E-8; R-C-6, R-C-7, R-C-8; design §3.3–§3.6.

**Files.** Create `components/progress/QueueOrderEditor.tsx` and `QueueOrderEditor.test.tsx`, `QueueList.order.test.tsx`. Modify `QueueList.tsx` (R-C-6, R-C-8, the editor swap), `FarmExpansion.tsx` (pass `canOrder`, `groupId`, `onLeave`). Add C3's release items (R-C-10).

**Interfaces — consumes:** TC2's exports and `setQueueOrder`; `toast.withUndo`; `messageOf`; `wasToastedByApi`; `BUSY_CLASS`; `Tag`, `Button`, `IconButton`, `VisuallyHidden`.

1. **Tests first** (`test-author`; mock the PUT at the `api` layer as the progress tests mock writes; then re-render with the refreshed ranks):
   - a lead on an active row with three queued sees **Change order**; with one queued, none; a member, a viewer, a finished row and `free_roll` see neither control; **Back to automatic** only while manual;
   - **manual at rest:** "Manual order" and the caption for a lead and a member; neither for a viewer with ranks in the data;
   - Change order shows every entry (more than four, no Show all), "Move {name} up/down", Save order, Cancel;
   - Move down on #1 → it reads #2; focus stays on that entry's Move down; the status line reads "{name}, 2 of 3"; Move up on #1 is `aria-disabled` and changes nothing;
   - Save → one PUT with the edited `user_ids` (a double click sends one); toast "Order saved" with Undo; the editor closes; the list shows the new order and the tag; focus on Change order;
   - Undo → PUT the prior `pinnedOrder` (`[]` when it was automatic); toast "Order restored";
   - a failed Save → error toast, the editor still open with its draft; an api-toasted 403 is not toasted twice;
   - Cancel → no request, the old order, focus on Change order;
   - Escape in the editor → cancelled and prevented: the panel stays open (FarmExpansion's filter sees `defaultPrevented`);
   - the draft across a refresh: a member turned Have drops out; a new Need is appended; Save sends the derived list;
   - Back to automatic → PUT `[]`, toast "Back to automatic order" with Undo, which PUTs the prior pinned list; focus on Change order, or on Copy plan when Change order is gone;
   - Log drop's main part follows the saved order after the refresh.
2. **Implement.**
3. **Gates:** the touched tests, `lint`, `check:design-system:strict`, `build`, `test`, `deadcode`, `dupes`. `git diff <parent>...HEAD -- frontend/src/components/collections frontend/src/components/ui frontend/src/components/primitives frontend/src/pages` is empty.

**Acceptance (browser):** as DevOwner on DEVTST, a seeded farm with three Needs: Change order by keyboard, Save, the order and "Log drop for …" follow, reload keeps it; Back to automatic, Undo. As DevMember: the order and the tag, no controls. V1 classic farm view before and after a pin ("#n", "Next priority"; delta (l)). Shots light and dark.

### PR C4 · S2a-3c·C4 — drag and the proof

#### Task TC4 — the drag handle; e2e, axe, role gating (`test-author`, then `xivrp-implementer`)

**Goal:** D-6's drag; design §4 end to end; R-C-9.

**Files.** Modify `QueueOrderEditor.tsx` (R-C-9). Create `QueueOrderEditor.drag.test.tsx`. Extend `frontend/e2e/progress.spec.ts` (a new `test.describe.serial('Progress: Change order (S2a-3c)')`, reusing `ownerSession`, `seedFarm`'s pattern, `setStates` and `blockingIn`; seeded farm `${PREFIX} Order` with Need for three members with claimed columns, deleted in `afterAll`) and `e2e/role-gating.spec.ts` (new cases only). Add C4's release item.

1. **Tests first** (`test-author`):
   - unit: each entry has a handle named "Reorder {name}"; an `onDragEnd` from the third id over the first reorders the draft; the announcements name players, never ids;
   - e2e owner: keyboard reorder (Move up twice), Save → Next in line and "Log drop for {name}" follow, a reload keeps them, "Manual order" shows; mouse drag of one entry above another, Save; keyboard drag (focus a handle, Space, ArrowUp, Space), Save; Escape mid keyboard-drag cancels the drag and leaves the editor open, a second Escape cancels the edit and the panel stays open; log a drop for the pinned #1 → they leave the queue, its Undo puts them back at #1; Back to automatic → column order (drop-only farm), its Undo → the pin back;
   - e2e axe with the editor open, both themes, 1440 × 900 (`blockingIn`);
   - role-gating: member sees the order and the tag, no Change order or Back to automatic; viewer sees the unranked line, no tag, no "#".
   Each e2e is run once against C2's head and recorded failing for the right reason (no Change order), then passes on C4's head.
2. **Implement** the handle (R-C-9).
3. **Gates:** `pnpm -C frontend test:e2e e2e/progress.spec.ts e2e/role-gating.spec.ts e2e/guest.spec.ts` against the worktree's servers (paste the counts), plus the unit gates.

**Acceptance (browser):** the full walk as DevOwner, DevMember, a viewer (demote DevMember from an owner session, restore after) and a guest (no farms, no new request), light and dark.

---

## Finish (each PR)

- `git fetch`; renumber if `releaseNotes.ts` moved on `origin/main` (R-C-10). The size check, the `pr-checklist` skill, and the slice-loop §5 gates: `pytest` when backend changed, `pnpm -C frontend build`, `lint` (0 errors, warnings ≤ the parent's), `check:design-system:strict`, `test`, `deadcode` unchanged except the allowed delta, `dupes`. Paste the counts.
- **The allowed `deadcode` delta:** `queueIsManual`, `pinnedOrder`, `orderedDraft` and `moveEntry` (C2), consumed by TC3 in C3; none after C3. Record it in each PR body.
- **V1 intact:** no file under `components/collections/`, `components/ui/`, `components/primitives/` or `pages/` in any diff; the shared files' pins pass unedited.
- **Live check (slice-loop §2)** on `/group/DEVTST?shell=v2&tab=progress` (`mkdir -p .logs` first); seed farms through the owner's API session, delete them after; shots to `docs/redesign/pr-shots/s2a3c-<pr>-*.webp`, light and dark.
- `gh pr create --draft --base <parent>` (C1 against `main`, on the ship loop); then the item's `pr`/`prTitle`. **Body:** V1-reached files and pins, the plugin contract, the D-n/E-n/R-C-n it implements, the `deadcode` delta, residuals; C3 adds delta (l)'s before/after shots.

## Write-backs (once, after the stack merges)

- [ ] Design §9 into the parent spec (S2-8 :55 as built, minus the classic-view sentence; §5 "Queue order"; §7 delta (l); §6 the PRs), in one docs PR.
- [ ] The parity matrix: P-126 shipped, the P-22, P-33, P-38 notes, §16's tallies.
- [ ] `PRODUCT_MODEL.md` §6 and `HOME_STRETCH.md`'s W3 S2a row: S2a-3c shipped with PR numbers; next S2a-4.
- [ ] Memory `project_home_stretch` (the controller's).

## Carried, not S2a-3c

- **Home's TrackCard "is next"** (S2a-4) reads `queueFor` and follows the pin; its plan says so.
- **Who last pinned a farm** isn't stored (D-9); if the holistic review wants "Order set by {lead}", it needs a column (a migration).
- **The stored `recipient_character_id` on Undo** (S2a-3a D-3) and **the reset-mode jump** (S2a-3b D-9): residuals, unchanged.
