# S2a-3c · Change order / Back to automatic (V2)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo. Each PR below is one slice-loop run: its own ledger, one whole-branch review against its parent branch, one fix wave.

**Plan-vet (2026-10-25).** `xivrp-director`: PASS with fixes. Every finding (M1, S1–S7, C1–C5) is folded in below and in the design note. The owner delegated D-1…D-10 ("do whatever you think is best"); the controller's rulings stand as the owner's answers: D-2 changed (the pin orders within each state), D-6 changed (Move up / Move down only; drag to the holistic list), the rest as recommended, D-10 with M1's full declaration and a public release line. The plan-vet is done: slice-loop §0 needs no second one.

**Goal:** a lead pins a farm's queue from the open row's Next in line (**Change order**: Move up / Move down within Need and within Want, Save order) and drops the pin (**Back to automatic**), each with an Undo toast; the queue model honours the pin, so Next in line, "Log drop for {#1}" and Copy plan follow it; a rank-only write leaves each cell's provenance true; V1 shows the pin through its existing rank displays (delta (l)).

**Design (binding):** `design/redesign/specs/2026-10-25-s2a-3c-change-order-design.md`, D-1…D-10, E-1…E-10, §3–§7. It sits on the parent spec `design/redesign/specs/2026-09-30-s2a-progress-design.md`: S2-7 :45, S2-8 (:55 is this slice), S2-9, §5 "Queue order", §7 criteria 10 and 11, and the new V1 delta (l) (design §6).
**Parity matrix (binding):** `design/redesign/specs/2026-09-30-s2a-parity-matrix.md`: P-126 and the P-22, P-33, P-38 notes (design §6), written in at write-back.
**Earlier plans (binding):** S2a-2 (`plans/2026-10-08-s2a-2-progress-tab.md`) R-S2-1, R-S2-2 (new cases in new files), R-S2-5, R-S2-14, R-S2-15, R-S2-16, R-S2-17; S2a-3a (`plans/2026-10-10-s2a-3a-row-expansion.md`) R-S3-4, R-S3-5, R-S3-6, R-S3-13, R-S3-14, R-S3-15; S2a-3b R-T-10.
**Scope (binding).** The files each task names, no others. **Not edited:** the participant PATCH routes and `ParticipantStateUpsert`, `write_row`, `utils/discordPlan.ts`, `components/collections/**`, `components/ui/**`, `components/primitives/**`, `pages/**`, `backend/app/database.py`. No migration. **V1 renders byte-for-byte as today** until a V2 lead pins; then delta (l)'s four effects (design §6), release-noted in C3.
**Plugin contract (binding, `CLAUDE.md` § Pitfalls).** No plugin route or DTO changes. The plugin never sends or reads `priority_rank` (E-9). TC1 proves both syncs leave a pin in place.

## Size and stack

Estimates use the S2a-2 rule: code lines ÷ 0.35 (tests), × 1.8 (the measured overrun); a rewritten or moved test line counts twice. The cap is ~1,500 changed lines, plan excluded (slice-loop rule 1). D-1's cut, four PRs, one task each; re-estimated after the plan-vet fold (no drag, per-state moves, the extra guards and tests).

| PR | Slice | Branch · base | Task (code est.) | Total |
|---|---|---|---|---|
| C1 | **S2a-3c·C1** the queue-order route | `feat/s2a3c-c1-queue-order` · `main` | TC1 route with locks, `write_rank`, guards, AUTHZ row, pytest incl. both syncs (~130) | ~700 |
| C2 | **S2a-3c·C2** the pinned queue | `feat/s2a3c-c2-pinned-queue` · `main` (after C1 merges) | TC2 per-state `queueFor`, `cellFor`'s viewer rule, `queueIsManual`, `pinnedOrder`, draft helpers, `setQueueOrder` (~100) | ~520 |
| C3 | **S2a-3c·C3** Change order | `feat/s2a3c-c3-change-order` · C2 | TC3 controls, tag, editor, focus, Save, Back to automatic, Undo, delta (l) shots (~225, **deep**) | ~1,150 |
| C4 | **S2a-3c·C4** the proof | `feat/s2a3c-c4-proof` · C3 | TC4 e2e, axe, role gating, guest, the hoisted seeding helpers (~0 product code) | ~450 |

- **Order.** C1 opens, passes and merges alone (backend, as S2a-3b's H1). C2's branch is cut from a `main` that holds C1. C2…C4 are one stack.
- **Worktrees.** C1 gets a short-lived one; the stack gets `.claude/worktrees/s2a3c`. Copy `frontend/.npmrc` in before `pnpm -C frontend install` (`CLAUDE.md`).
- **The cap.** At each Finish run `git diff --stat <parent>...HEAD`. C3 is the one near it: if it runs over, stop and re-cut with the controller before opening (the ledger records the cut). Don't trim tests.
- **Merging (R-S2-1), in one session.** Stack PRs open as drafts. After C4: (1) update the stack onto the latest `main` (slice-loop § Stacked PRs); (2) push the top commit to `redesign/s2a3c-preflight` (a draft PR to `main` labelled `no-automerge`) and run `e2e/progress.spec.ts`, `e2e/role-gating.spec.ts` and `e2e/guest.spec.ts` locally on that tree; (3) once that run is green on that exact tree, merge C2…C4 bottom-first with no further update. If `main` moves first, go back to (1). Link the run and paste the counts in C2's body. Close the preflight PR after.

## Code facts checked (worktree `s2a3cplan` at `00eb394a`, 2026-10-25; re-checked at the plan-vet fold)

| Fact | Where | Consequence |
|---|---|---|
| The PATCH maps `null` to unchanged | `backend/app/services/collection_records.py:379-381` (`unset_if_none`); `routers/collection_goals.py:881` (self, leads only), `:1066` (lead for another) | Unchanged; the clear is a new route (E-1) |
| V1's store sends `priority_rank: data.priorityRank ?? null` on every write; its one caller sends `{ state }`; `upsertStateForUser` has no caller; V2's `setCell` sends state and count only | `frontend/src/stores/collectionGoalStore.ts:742,764,784-787`; `components/collections/RewardGoalDetailModal.tsx:42` | Explicit `null` can't mean "clear" (E-1). **No V1 control sets a rank** (design §8) |
| `ParticipantStateUpsert`: `state` required, `priority_rank` `ge=1` | `schemas/collection_goals.py:105-109` | A PATCH flag would rewrite state per member |
| Self PATCH refuses viewers, ignores a member's rank; lead PATCH `require_can_manage_members`, a viewer target 400 | `collection_goals.py:939-941,1012,1027-1028` | The route's gate mirrors the lead PATCH |
| `write_row` sets `updated_at`, `updated_by_user_id`, `updated_via` on every write; the only rank writes are its `:783-784` | `collection_records.py:735-736,783-784,802-804`; `collection_goals.py:881,1066,1241` | A rank-only door (R-C-2, D-9) |
| `restore_*` keywords are Undo's alone, guarded by an AST test | `collection_records.py:740-743`; `tests/test_participant_undo_token.py:709-714,783` | The pattern for "only `set_queue_order` calls `write_rank`" (R-C-2) |
| Cell provenance reads the row's writer and channel | `components/progress/progressProvenance.ts:36-46,66-75` | D-9 |
| PROV-1 guard: `priority_rank` is TRACKED and a stamped FACT; door functions are an exact set; door callers listed, both syncs among them | `backend/tests/test_provenance_coverage.py:117-140,156-174,695,761-763,894-896` | One door and one named exemption (R-C-2) |
| Undo locks rows `order_by(id).with_for_update().execution_options(populate_existing=True)`; skips a row whose `updated_at` moved, else restores its prior rank; logs caller and channel | `collection_goals.py:1182-1190,1223,1241,1251-1259`; `services/participant_undo.py:34,55,69` | The route's lock and log (R-C-1); `write_rank` moves `updated_at` (E-3) |
| `list_participants` orders by rank (nulls last), `updated_at`, id; viewers get `priority_rank` null, and so does the Progress read | `collection_goals.py:151,207-211,784`; `tests/test_progress_participants.py:247,260` | Delta (l)(d); viewers can't see a pin |
| V1 rank displays: "#n" in every state group; Next priority = first ranked Need; Log Drop sorts Need and Want together by rank; Copy plan sorts Need by rank, others in input order | `collections/ParticipantsPanel.tsx:95-121`; `RewardGoalCard.tsx:41-43,148-156`; `LogDropModal.tsx:35-36`; `CollectionsHub.tsx:73-79` | Delta (l)(a)–(d) |
| V2's Copy plan lines filter by state, keeping order | `utils/discordPlan.ts:36-37,53-54` | Per-state D-2 keeps them in pin order; file unedited |
| The bulk Need: lead helper, one `now`, skips counted, one commit; its schemas and 200 cap | `collection_goals.py:1263-1412` (`:1287`); `schemas/collection_goals.py:188-211` | TC1's shape |
| `_get_goal(..., for_update=True)` | `collection_goals.py:235-237` (used `:1432`) | The goal lock |
| AUTHZ rows; the table must list every mutation route | `backend/tests/authz_matrix.py:532-544`; `tests/test_authz_matrix.py:532` | One new row (R-C-3) |
| The plugin's farm calls; no `priority_rank` in the plugin; neither sync door passes it | `XIVRaidPlannerPlugin/Api/RaidPlannerClient.cs:370-378`; `collection_records.py:1009` (`_sync_row`), `:1071` (`apply_sync`) | E-9; TC1's two sync cases |
| `queueFor` ignores rank; its consumers | `frontend/src/utils/progressQueue.ts:29-56`; `progress/QueueList.tsx:27`; `progress/LogDropButton.tsx:54`; `utils/discordPlan.ts:73` | TC2 (R-C-4) |
| The entry carries `priorityRank`; fixtures default it null; a test builds a `ProgressCell` literal | `stores/collectionGoalStore.ts:116,421`; `progress/__fixtures__/progressFixtures.ts:42,74-77`; `progress/editStatuses.test.ts:27` | `cellFor` copies the entry rather than adding a `ProgressCell` field (R-C-4) |
| `cellFor` withholds counts from a viewer reader (View As reads come back as the admin) | `utils/progressModel.ts:146-179` | It drops the rank the same way (E-5) |
| QueueList: the viewer line, the ranked `<ol>`, Show all | `progress/QueueList.tsx:32-44,46-58,59-63` | TC3 edits the non-viewer branch only |
| FarmExpansion: `lead`; the Next in line section; the Escape filter; FarmEditBlock's own-Escape rule; `focusCopyPlan` | `progress/FarmExpansion.tsx:98-99,193-200,140-144,27-30,95-97` | TC3 (R-C-6, R-C-7) |
| `toast.withUndo`; `messageOf`; `wasToastedByApi`; `BUSY_CLASS`; `refreshGoalProgress`; `api.put` | `stores/toastStore.ts:104`; `progress/undoToasts.ts:12`; `services/api.ts:88,338`; `progress/useDrops.ts:27`; `stores/collectionGoalStore.ts:593,882` | R-C-5, R-C-8 |
| Move up / Move down `IconButton`s; `IconButton` forwards ref and props and dims only for native `disabled` | `components/priority/PlayerBasedEditor.tsx:318-331`; `primitives/IconButton.tsx:41-68` (`:63`) | `aria-disabled` + `BUSY_CLASS` (R-C-7) |
| The grid's keys are per cell; the panel row is outside its rows (R-S3-4) | `progress/useMatrixKeyboard.ts:126` | No grid change |
| A demoted viewer keeps a claimed column; lead controls | `progress/ProgressPage.tsx:296-301,307` | Design §7; R-C-6 |
| e2e `seedFarm` and `setStates` live inside the row-expansion describe; claimed columns; axe helper; role-gating's S2a-3a block | `frontend/e2e/progress.spec.ts:483,751,762,1462`; `e2e/role-gating.spec.ts:432-563` | TC4 hoists them (R-C-9) |
| `CURRENT_VERSION = '2.1.75'`; 2.1.76–2.1.77 above it are internal | `data/releaseNotes.ts:12,63,125` | R-C-10 |

## Rulings (bind every task)

The design note's D-n and E-n bind. These are the plan's own:

- **R-C-1 (the route, E-1, E-2).** `PUT /static-groups/{group_id}/collection-goals/{goal_id}/queue-order`, `response_model=QueueOrderResponse`, handler `set_queue_order(group_id, goal_id, body: QueueOrderRequest, request: Request, session, current_user)`. Schemas (snake_case, as the farm routes): `QUEUE_ORDER_MAX_USERS = 200`; `QueueOrderRequest { user_ids: list[str] = Field(..., max_length=QUEUE_ORDER_MAX_USERS) }` with a validator that refuses duplicates (422); `QueueOrderResponse { ranked: int; cleared: int; skipped: int }`. Steps: `get_static_group`; `require_can_manage_members`; `via = logged_via(request)` before any write; `_get_goal(..., for_update=True)`; the goal's rows in this static, `.order_by(RewardParticipantState.id).with_for_update().execution_options(populate_existing=True)` (Undo's form); target rank = position + 1 for each listed user who has a row, `None` for every other row; `write_rank` on each; `ranked` = listed users with a row, `cleared` = rows taken from a rank to `None`, `skipped` = listed users with none; one commit; then `logger.info("collection_queue_order_set", group_id=…, goal_id=…, user_id=current_user.id, via=via, ranked=…, cleared=…, skipped=…)`. No role check on listed users, no goal-status check, no undo token.
- **R-C-2 (the door, D-9, E-3).** `async def write_rank(db: AsyncSession, *, row: RewardParticipantState, priority_rank: int | None, now: str) -> bool` in `services/collection_records.py`, after `write_row`, its docstring saying `set_queue_order` is its only caller (a test asserts it). `ValueError` for a rank below 1. Equal rank: returns False, writes nothing. Else sets `row.priority_rank` and `row.updated_at = now`, returns True; no other column. The caller flushes. Guards: `DOOR_FUNCTIONS` gains `"write_rank"`; (f) gains `UNSTAMPED_FACT_WRITES = {("write_rank", "priority_rank")}` (comment: S2a-3c D-9), honoured by `_stamp_problems` for that pair only; `write_rank` is not a door entry point under (g) (it takes no writer). A new AST test, `test_only_set_queue_order_calls_write_rank`, in the pattern of `test_only_the_undo_route_passes_the_restore_keywords` (`test_participant_undo_token.py:783`). The guard's existing cases pass unedited.
- **R-C-3 (AUTHZ, R-S2-14).** `R("PUT", CG + "/{goal_id}/queue-order", "lead", "helper", "set or clear a farm's queue order (S2a-3c)", build=lambda w: _r(_goal(w), None, {"user_ids": [w.u["member2"].id]}))`. Not a plugin row.
- **R-C-4 (the queue, D-2, D-3, E-5).** `utils/progressModel.ts`: `cellFor` returns, for a viewer reader whose entry has a rank, `entry: { ...entry, priorityRank: null }` (no `ProgressCell` type change; an entry with no rank keeps its identity). `utils/progressQueue.ts`: `QueueEntry` gains `pinned: boolean` (`cell.entry?.priorityRank != null`); `queueFor(row, mode)` keeps its signature and builds each state's list as today, then stable-sorts it (both pinned → `priorityRank` ascending; a pinned before an unpinned; otherwise 0); Needs before Wants; numbers 1…n across the queue. `queueIsManual(queue: readonly QueueEntry[]): boolean` (any pinned). `pinnedOrder(row: FarmRow): string[]`: every cell with a member whose entry has a rank, by rank, ties in column order (Have rows included, so Undo keeps their ranks). Draft helpers (E-7): `orderedDraft(draft: readonly string[], queue: readonly QueueEntry[]): QueueEntry[]` (per state, in the queue's state order: the draft's ids in that state in draft order, then that state's ids not in the draft in queue order) and `moveWithinState(order: readonly QueueEntry[], userId: string, delta: -1 | 1): string[]` (the ids with that entry swapped with its neighbour; unchanged at the list's end or when the neighbour is in the other state). No caller changes: `QueueList`, `LogDropButton` and Copy plan read the cells they already get.
- **R-C-5 (the store, E-6).** `setQueueOrder: (groupId: string, goalId: string, userIds: readonly string[]) => Promise<{ ranked: number; cleared: number; skipped: number }>`: `api.put` to `/api/static-groups/${groupId}/collection-goals/${goalId}/queue-order` with `{ user_ids: [...userIds] }`, then `await get().refreshGoalProgress(groupId, goalId)`; a failed PUT rejects and refreshes nothing. Additive (V1 delta (e)).
- **R-C-6 (the controls, D-5, D-7, E-8, R-S2-17).** `QueueList` gains `canOrder: boolean` (FarmExpansion passes `lead && !finished`), `groupId: string` and `onLeave: () => void` (`focusCopyPlan`). In the non-viewer branch, first: a row holding `{manual && <Tag variant="label">Manual order</Tag>}` and, when `canOrder && mode !== 'free_roll'` and the editor is closed, **Change order** (`Button variant="secondary" size="sm"`, `leftIcon` `ArrowUpDown`) *(as built, S2a-3c: both order buttons are `secondary`, not `ghost`, for contrast; see R-C-7)* when `queue.length >= 2` and **Back to automatic** (`Button variant="secondary" size="sm"`, `leftIcon` `RotateCcw`) when `manual`. Under the list when `manual`: `<p className="text-xs text-text-muted">Set by a lead. Anyone added later goes after the set order in their group.</p>`. The viewer branch is unchanged. Absent, not disabled, for members, viewers, finished rows and `free_roll`, and both hidden while editing.
- **R-C-7 (the editor, D-2, D-6, E-7, E-8).** `progress/QueueOrderEditor.tsx`: `QueueOrderEditor({ queue, tokenCost, saving, onSave, onCancel }: { queue: readonly QueueEntry[]; tokenCost: number | null; saving: boolean; onSave(userIds: string[]): void; onCancel(): void })`. Draft seeded from `queue` at mount; render `orderedDraft(draft, queue)` as `<ol aria-label="Queue order">`, each `<li>`: "#k", "{name} · {queueEntryText}", `IconButton` "Move {name} up" and "Move {name} down" calling `moveWithinState`. A button that can't move (list end, or the Need/Want boundary) is `aria-disabled` with `className={BUSY_CLASS}` and does nothing. After each move a layout effect focuses the same button of the moved entry (a ref map keyed by user id and direction). A `VisuallyHidden` `role="status"` line reads "{name}, {k} of {n}". Footer: **Save order** (`Button variant="primary" size="sm"`, `className={BUSY_CLASS}`, `aria-disabled` while `saving`, ignoring clicks then) and **Cancel** (`variant="secondary"`) *(as built, S2a-3c: `secondary`, not `ghost`; ghost's accent text is 4.11:1 on the farm panel's `bg-surface-elevated` in light; fixed in #411 and #412)*. `onKeyDown`: Escape not already prevented → `preventDefault()`, then `onCancel()`. Show all is not rendered while editing.
- **R-C-8 (save, Back to automatic, Undo; D-8).** In `QueueList`: `prior = pinnedOrder(row)` read before each write. **Save:** `await setQueueOrder(groupId, goalId, ids)` → close the editor, focus Change order, `toast.withUndo('Order saved', () => void restore(prior))`. **Back to automatic:** `setQueueOrder(…, [])` → `toast.withUndo('Back to automatic order', () => void restore(prior))`, focus Change order, or `onLeave()` when Change order is absent. **restore(ids):** `setQueueOrder(…, ids)` → `toast.success('Order restored')`. A failure toasts `Couldn't save the order: ${messageOf(err)}` (or `Couldn't restore the order: …`) unless `wasToastedByApi(err)`; a failed Save keeps the editor and its draft. One write at a time per list.
- **R-C-9 (the proof, C4).** `seedFarm` and `setStates` (`e2e/progress.spec.ts:751,762`) move to module scope, unchanged in behaviour, and the row-expansion describe calls them there (a move, not a copy: `dupes`). The new describe seeds `${PREFIX} Order` (a drop-only custom farm, so the automatic order is column order) with Need for three members with claimed columns and Want for none or one as each case needs, and deletes it in `afterAll`.
- **R-C-10 (release notes, R-S2-16, R-T-10).** Each PR takes the next free version at its Finish. C1: `internal: true` "Farm queue order route". C2: internal "Progress: the queue honours a lead's order". C3: one public `improvement` for delta (l), "A lead's farm queue order now shows in the classic farm view as ranks" (bumps `CURRENT_VERSION`), plus an internal item "Progress: Change order and Back to automatic". C4: internal "Progress: Change order end-to-end checks". `pr`/`prTitle` on each; escape `'` as `\'`.
- **R-C-11 (V1 and the PATCH intact).** The PATCH routes, `ParticipantStateUpsert` and `write_row` are not edited; their existing pytest cases pass unedited (`test_farm_drop_authz.py:1053-1096`, `test_record_provenance.py:1036-1174`, `test_count_visibility.py:372-376`, `test_participant_merge.py:381-402`). `CollectionsHub.copyPlan.test.tsx` and `discordPlan.test.ts` pass unedited.

## Shared files (V1 reaches them)

| File | The edit (task) | The V1 path that reaches it | The unedited pin |
|---|---|---|---|
| `backend/app/routers/collection_goals.py` | one new route (TC1) | V1 farm reads and writes | every existing `test_collection_goals.py`, `test_farm_drop_authz.py`, `test_mark_need.py` case |
| `backend/app/services/collection_records.py` | `write_rank` added; `write_row` untouched (TC1) | every farm-row and record write, both plugin syncs | `test_participant_merge.py`, `test_record_provenance.py`, `test_write_provenance.py`, `test_participant_undo_token.py` |
| `stores/collectionGoalStore.ts` | `setQueueOrder` added (TC2) | V1 `CollectionsHub`, `RewardGoalDetailModal` | `collectionGoalStore.test.ts` unedited |

## Review Focus

- **TC1:** only `priority_rank` and `updated_at` move on a re-ranked row, nothing on an unchanged one; one guard exemption, one caller; a status Undo after a re-rank is skipped, never restoring the old rank; V1's `null` keeps a pin on both PATCH routes; both syncs keep a pin.
- **TC2:** per state: ties, a pinned Want never above a Need, a joiner before every Want, `desired_only`, `free_roll`, Have rows' ranks, Not on the roster; a viewer reader never gets `pinned`; with no ranks, today's order.
- **TC3:** moves stop at the boundary; focus after each move, Save, Cancel and Back to automatic; the controls hidden while editing; the draft across a refresh; Escape never closes the panel from the editor; one PUT per click; controls absent for members, viewers, finished rows and `free_roll`.
- **TC4:** keyboard-only reorder with focus asserted; Undo's place after a drop; axe with the editor open; the hoist leaves the earlier describes' behaviour unchanged.
- **UI rules:** no raw elements, semantic tokens, `text-xs` floor, no modal, nothing sticky.

---

### PR C1 · S2a-3c·C1 — the queue-order route

#### Task TC1 — the route, `write_rank` and the guards (`test-author`, then `xivrp-implementer`)

**Goal:** E-1…E-4, E-9, D-4, D-9; R-C-1, R-C-2, R-C-3, R-C-11.

**Files.** Modify `backend/app/schemas/collection_goals.py` (the two models), `backend/app/services/collection_records.py` (`write_rank`), `backend/app/routers/collection_goals.py` (`set_queue_order`), `backend/tests/authz_matrix.py` (R-C-3), `backend/tests/test_provenance_coverage.py` (R-C-2's door, exemption and new guard cases). Create `backend/tests/test_queue_order.py`. Add C1's release item (R-C-10).

1. **Tests first** (`test-author`; fixtures as `test_mark_need.py` builds a static, goal, rows and roles; sleep 0.02 s between writes whose `updated_at` is compared, per memory `reference_windows_clock_test_flake`):
   - a lead's PUT `[B, A]` (both Need) → B rank 1, A rank 2; `GET …/participants` lists B then A; response `{ranked: 2, cleared: 0, skipped: 0}`; its key set is exactly `{"ranked", "cleared", "skipped"}`;
   - full replace (D-4): C (Have, rank 1) unlisted → rank null, `cleared: 1`; `[]` clears every rank of the goal; another goal's and another static's ranks are untouched;
   - a re-ranked row keeps `updated_by_user_id`, `updated_via`, `state`, `state_changed_at`, `source`, `last_manual_override_at`, `token_count`, `token_count_updated_at` and `notes`, and its `updated_at` moves; a row whose rank already matches keeps its `updated_at`;
   - an id with no row for the goal and an id of a non-member are skipped and counted; a listed demoted viewer who has a row is ranked;
   - duplicates → 422; 201 ids → 422; no `user_ids` → 422; another static's goal → 404; member and viewer → 403; a non-member → 403;
   - Undo: a lead's status edit (its token), then a PUT that re-ranks that row → the undo reports it skipped and the rank stays; with a PUT that leaves that row's rank alone → the undo restores the state and the rank is unchanged;
   - the PATCH (R-C-11): after a pin, a self PATCH and a lead PATCH, each with `priority_rank: null`, keep the rank;
   - the plugin syncs over a pinned row keep its `priority_rank`: `POST /api/plugin/collections/sync` and `POST /api/plugin/mount-farms/sync`, each with an `xrp_` key (the two door callers, `test_provenance_coverage.py:173-174`);
   - `write_rank`: refuses 0; returns False and changes nothing for an equal rank;
   - the guards: `write_rank` writing `priority_rank` unstamped passes; the same write in another door function fails (f); a `state` write in `write_rank` fails (f); `test_only_set_queue_order_calls_write_rank` (R-C-2).
   Each new route case fails on today's code (404 or 405: the route is missing), recorded in the ledger.
2. **Implement.**
3. **Gates:** `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -q` (paste the count), `venv/Scripts/ruff.exe check` on the touched files (no new violations), the migration checks (no change), frontend `build` and `test` (unchanged).

**Acceptance:** curl on the dev DB (a PUT, the GET after, `[]`, the GET after). **PR body:** the plugin contract unchanged; the PATCH and `write_row` untouched (R-C-11); the guard's one exemption and one caller (D-9); `updated_at`'s move and why (E-3, delta (l)(d)); no V1-visible change until a V2 lead pins (C3).

### PR C2 · S2a-3c·C2 — the pinned queue

#### Task TC2 — the per-state pin, `cellFor`'s viewer rule, the store action (`test-author`, then `xivrp-implementer`)

**Goal:** D-2, D-3, E-5, E-6, E-7's helpers; R-C-4, R-C-5.

**Files.** Modify `frontend/src/utils/progressModel.ts` (`cellFor` only), `utils/progressQueue.ts`, `stores/collectionGoalStore.ts` (`setQueueOrder`). Create `utils/progressQueue.pin.test.ts`, `utils/progressModel.rank.test.ts`, `stores/collectionGoalStore.queueOrder.test.ts`, `components/progress/LogDropButton.pin.test.tsx`. Add C2's release item.

**Interfaces — produces:** `QueueEntry.pinned`; `queueIsManual`; `pinnedOrder`; `orderedDraft`; `moveWithinState`; `setQueueOrder` (R-C-4, R-C-5).

1. **Tests first** (`test-author`; cells built with `progressFixtures.ts`'s `farmRowOf`, setting `priorityRank` on the rows):
   - per state, on a farm with a token cost: A (Need 50, rank 2), B (Need 10, no rank), C (Want 5, rank 1), D (Need 30, rank 2), E (Want 1, no rank) → D, A, B, C, E (Needs first: the pinned by rank, the tie in the automatic order, then B; then the Wants); ranks 1…5; `pinned` true for D, A, C;
   - a joiner: a new unranked Need lands after the pinned Needs and before every Want (D-3);
   - `desired_only` keeps the pinned Needs' order and drops every Want; `free_roll` → `[]` with ranks present;
   - a ranked Have, Pass or blank cell is not queued; `queueIsManual` false when only a Have row has a rank;
   - a ranked Not-on-the-roster cell takes its place among its state's pinned (R-S3-14);
   - with no ranks, every case in `progressQueue.test.ts` holds (that file unedited);
   - `cellFor` for a viewer reader whose row has a rank → `entry.priorityRank` null, so `queueFor` gives no `pinned` and today's order; for a lead or member reader the rank stays; an entry with no rank is the same object;
   - `QueueList` with ranks in the data and a viewer reader: the unranked line in column order, unchanged (View As);
   - `pinnedOrder`: ranked members by rank, Have included, ties in column order, unranked out;
   - `orderedDraft`: a draft id no longer queued drops; a newly queued id is appended at the end of its state's group; a member who switched Need → Want moves to the Want group;
   - `moveWithinState`: swaps with the neighbour; unchanged at either end and across the Need/Want boundary;
   - `LogDropButton` with a pin: its main part reads "Log drop for {the pinned #1}";
   - `setQueueOrder`: PUTs `{ user_ids }` to the route, then `fetchProgress(groupId, [goalId])`; a rejected PUT rejects and fetches nothing.
2. **Implement.**
3. **Gates:** the touched tests, `lint`, `build`, `test`, `deadcode` (the allowed delta, § Finish), `dupes`.

### PR C3 · S2a-3c·C3 — Change order

#### Task TC3 — the controls, the editor, Save, Back to automatic, Undo (RISKIEST · `test-author`, then `xivrp-implementer-deep`; task-scoped review)

**Goal:** D-5…D-8, D-10, E-7, E-8; R-C-6, R-C-7, R-C-8; design §3.3–§3.6, §6.

**Files.** Create `components/progress/QueueOrderEditor.tsx` and `QueueOrderEditor.test.tsx`, `QueueList.order.test.tsx`. Modify `QueueList.tsx` (R-C-6, R-C-8, the editor swap), `FarmExpansion.tsx` (pass `canOrder`, `groupId`, `onLeave`). Add C3's release items (R-C-10).

**Interfaces — consumes:** TC2's exports and `setQueueOrder`; `toast.withUndo`; `messageOf`; `wasToastedByApi`; `BUSY_CLASS`; `Tag`, `Button`, `IconButton`, `VisuallyHidden`.

1. **Tests first** (`test-author`; mock the PUT at the `api` layer as the progress tests mock writes; re-render with the refreshed ranks):
   - a lead on an active row with three queued sees **Change order**; with one queued, none; a member, a viewer, a finished row and `free_roll` see neither control; **Back to automatic** only while manual;
   - **manual at rest:** "Manual order" and the caption for a lead and a member;
   - Change order hides Change order and Back to automatic, and shows every entry (more than four, no Show all), each "Move {name} up/down", then Save order and Cancel; Tab runs Move up, Move down entry by entry, then Save order, Cancel;
   - Move up on the second Need → it reads #1; focus is on that entry's Move up (`document.activeElement`); the status line reads "{name}, 1 of 3";
   - the first entry's Move up, the last Need's Move down, the first Want's Move up and the last entry's Move down are `aria-disabled`, carry `BUSY_CLASS` and change nothing;
   - Save → one PUT with the edited `user_ids`, Needs then Wants (a double click sends one); toast "Order saved" with Undo; the editor closes; the controls return; the list shows the new order and the tag; focus on Change order;
   - Undo → PUT the prior `pinnedOrder` (`[]` when it was automatic); toast "Order restored";
   - a failed Save → error toast, the editor still open with its draft; an api-toasted 403 is not toasted twice;
   - Cancel → no request, the old order, focus on Change order;
   - Escape in the editor → cancelled and prevented: the panel stays open (FarmExpansion's filter sees `defaultPrevented`);
   - the draft across a refresh: a member turned Have drops out; a new Need is appended to the Need group; Save sends the derived list;
   - Back to automatic → PUT `[]`, toast "Back to automatic order" with Undo, which PUTs the prior pinned list; focus on Change order, or on Copy plan when Change order is gone;
   - Log drop's main part follows the saved order after the refresh.
2. **Implement.**
3. **Gates:** the touched tests, `lint`, `check:design-system:strict`, `build`, `test`, `deadcode`, `dupes`. `git diff <parent>...HEAD -- frontend/src/components/collections frontend/src/components/ui frontend/src/components/primitives frontend/src/pages frontend/src/utils/discordPlan.ts` is empty.

**Acceptance (browser):** as DevOwner on DEVTST, a seeded farm with three Needs and one Want: Change order by keyboard, Save, the order and "Log drop for …" follow, reload keeps it; Back to automatic, Undo. As DevMember: the order and the tag, no controls. **Delta (l) shots, before and after a pin, V1 classic farm view:** (a) a pinned member's "#1" under Have after their drop; (b) V1's stored "#n" against V2's 1…n after a pinned member leaves; (c) "Next priority" with a pinned Need, then with only Wants queued; (d) a cleared row's move to the end of its state's unranked rows after Back to automatic. Light and dark.

### PR C4 · S2a-3c·C4 — the proof

#### Task TC4 — e2e, axe, role gating (`test-author`; the e2e are the deliverable, an implementer only if one exposes a defect)

**Goal:** design §4 end to end; R-C-9.

**Files.** Extend `frontend/e2e/progress.spec.ts` (the hoist, R-C-9, and a new `test.describe.serial('Progress: Change order (S2a-3c)')` reusing `ownerSession`, the hoisted helpers and `blockingIn`), `e2e/role-gating.spec.ts` (new cases only), `e2e/guest.spec.ts` (only if its recorder lacks `queue-order`; existing cases unedited). Add C4's release item.

1. **Tests first** (`test-author`):
   - owner, keyboard only: open the row, Change order, focus the third Need's Move up, press Enter twice, and `toBeFocused()` holds on that button after each press; the boundary button is `aria-disabled`; Save → Next in line and "Log drop for {name}" follow, "Manual order" shows, a reload keeps them;
   - owner: a joiner (set Need for a fourth member through the API) lands after the pinned Needs and before the Want;
   - owner: log a drop for the pinned #1 → they leave the queue; its Undo puts them back at #1;
   - owner: Back to automatic → column order (drop-only farm); its Undo → the pin back;
   - owner: Escape in the editor cancels it and the panel stays open;
   - axe with the editor open, both themes, 1440 × 900 (`blockingIn`);
   - role-gating: member sees the order and the tag, no Change order or Back to automatic; viewer sees the unranked line, no tag, no "#";
   - guest: Progress makes no `queue-order` request.
   Each e2e is run once against C2's head and recorded failing for the right reason (no Change order), then passes on C4's head. The earlier describes pass unchanged after the hoist.
2. **Gates:** `pnpm -C frontend test:e2e e2e/progress.spec.ts e2e/role-gating.spec.ts e2e/guest.spec.ts` against the worktree's servers (paste the counts), plus the unit gates and `dupes`.

**Acceptance (browser):** the full walk as DevOwner, DevMember, a viewer (demote DevMember from an owner session, restore after) and a guest, light and dark; the shots go in C4's body.

---

## Finish (each PR)

- `git fetch`; renumber if `releaseNotes.ts` moved on `origin/main` (R-C-10). The size check, the `pr-checklist` skill, and the slice-loop §5 gates: `pytest` when backend changed, `pnpm -C frontend build`, `lint` (0 errors, warnings ≤ the parent's), `check:design-system:strict`, `test`, `deadcode` unchanged except the allowed delta, `dupes`. Paste the counts.
- **The allowed `deadcode` delta:** `queueIsManual`, `pinnedOrder`, `orderedDraft` and `moveWithinState` (C2), consumed by TC3 in C3; none after C3. Record it in each PR body.
- **V1 intact:** no file under `components/collections/`, `components/ui/`, `components/primitives/` or `pages/`, and not `utils/discordPlan.ts`, in any diff; the shared files' pins pass unedited.
- **Live check (slice-loop §2)** on `/group/DEVTST?shell=v2&tab=progress` (`mkdir -p .logs` first); seed farms through the owner's API session, delete them after; shots to `docs/redesign/pr-shots/s2a3c-<pr>-*.webp`, light and dark.
- `gh pr create --draft --base <parent>` (C1 against `main`, on the ship loop); then the item's `pr`/`prTitle`. **Body:** V1-reached files and pins, the plugin contract, the D-n/E-n/R-C-n it implements, the `deadcode` delta, residuals; C3 adds delta (l)'s four before/after shots.

## Write-backs (once, after the stack merges)

- [x] Design §9 into the parent spec (S2-8 :55 as built; §5 "Queue order"; §7 delta (l) as design §6 words it; §6 the PRs), in one docs PR.
- [x] Correct the four false "leads can still set ranks through the classic view" sentences in place, each with "(corrected 2026-10-25, S2a-3c: no V1 control sets a rank)": `specs/2026-09-30-s2a-progress-design.md:55`, `specs/2026-10-09-s2a-3a-row-expansion-design.md:21` and `:122`, `specs/2026-10-20-s2a-3b-tier-row-design.md:130`.
- [x] The parity matrix: P-126 shipped, the P-22, P-33, P-38 notes, §16's tallies.
- [ ] #406's holistic list: the drag handle for Change order, as a candidate (D-6).
- [x] `PRODUCT_MODEL.md` §6 and `HOME_STRETCH.md`'s W3 S2a row: S2a-3c shipped with PR numbers; next S2a-4.
- [ ] Memory `project_home_stretch` (the controller's).

## Carried, not S2a-3c

- **Home's TrackCard "is next"** (S2a-4) reads `queueFor` over `cellFor`'s cells, so it follows the pin and a viewer reader never gets it (E-5); its plan says so.
- **Drag to reorder** (D-6): a holistic-review candidate.
- **Who last pinned a farm** isn't stored (D-9); "Order set by {lead}" would need a column (a migration).
- **The stored `recipient_character_id` on Undo** (S2a-3a D-3) and **the reset-mode jump** (S2a-3b D-9): residuals, unchanged.
