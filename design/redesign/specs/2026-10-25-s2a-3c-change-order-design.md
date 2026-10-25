# Stage 2a · S2a-3c, Change order / Back to automatic (V2) — design

**Status:** draft, 2026-10-25, from the specs and the code. The owner skipped the co-design Q&A, so **D-1…D-10 are open for the owner**, each with the controller's recommendation; E-1…E-10 are the controller's engineering rulings. Plan-vet has not run yet (the plan's slice-loop setup dispatches it). This note records only what S2a-3c adds. The rest is ruled in the parent spec, [`2026-09-30-s2a-progress-design.md`](2026-09-30-s2a-progress-design.md): S2-7 :45 (the manual order is lead-only), S2-8 (the queue; :55 is this slice), S2-9 (the open farm row), §5's "Queue order" row and §7 criteria 10 and 11. Carried from S2a-3a D-1 (`specs/2026-10-09-s2a-3a-row-expansion-design.md:21`) and S2a-3b D-1 (`specs/2026-10-20-s2a-3b-tier-row-design.md:20`). Where this note and the parent differ, this note wins for S2a-3c and the parent is corrected at write-back (§9).

## 1. Scope

S2a-3c lets a lead pin a farm's queue: **Change order** in the open farm row's Next in line, and **Back to automatic** to drop the pin. The queue model honours the pin, so Next in line, Log drop's #1 and Copy plan all follow it. One new route sets or clears a farm's order; the participant PATCH is unchanged.

**Not in S2a-3c:** Home's TrackCard "is next" (S2a-4; it will read `queueFor`, so it follows the pin); Edit's priority-mode help lines (unchanged: they describe the automatic rule); phones (S2-15).

## 2. Decisions

Owner items D-1…D-10 (**recommendation in bold**; the alternative after it). Controller items E-1…E-10.

| # | Decision | Alternative, and why not |
|---|---|---|
| D-1 | **Four PRs.** C1 the route (backend, merges alone), then a stack: C2 the pinned queue (model and store), C3 Change order (the editor, Back to automatic, Undo), C4 drag and the end-to-end proof. | One frontend PR: ~2,300 lines, over the cap. |
| D-2 | **One manual order across Need and Want.** The pin overrides "Need before Want": a lead may place a Want above a Need. Under `desired_only` a pinned Want is still out of the queue. | Pin within each state (Need stays first): needs two lists in the editor; less control for the same cost. |
| D-3 | **Later joiners go after the pin.** A member who joins the queue after the pin (no rank) follows every pinned member, in the automatic order. A pinned member who leaves the queue (Have, Pass, blank) keeps their rank on their row until the next Save (D-4), and returns to their place if they come back, so Undo of a logged drop puts them back where they were. | Clear a rank when its member leaves the queue: needs a write in the drop route (V1 reaches it) and breaks Undo's place. |
| D-4 | **Save replaces the farm's whole order.** The listed members are ranked 1…n in order; every other rank on the farm is cleared. **Back to automatic** clears every rank on the farm. | Rank only the listed: stale ranks from people who left the queue would resurface in odd places. |
| D-5 | **The controls live in the open row's Next in line section**, for leads only (`canManage` and not a viewer), on an active row, never under `free_roll`. **Change order** shows with two or more queued; **Back to automatic** shows only while the queue is manual. Not in the row menu, not in the matrix. | A row-menu item: the order belongs where the queue is read. |
| D-6 | **Inline editor, no modal** (CLAUDE.md: no modals for quick edits). Change order turns Next in line into the full queue (not the top four) where each entry has **Move up** and **Move down** buttons and a **drag handle**, then **Save order** and **Cancel**. Drag reuses the repo's dnd-kit sortable pattern (`components/priority/PlayerBasedEditor.tsx:100,438-447`, which pairs drag with Move up/down `IconButton`s at `:318-331`). The buttons are the keyboard and AT route. | Buttons only: about 350 lines less (C4 shrinks to the proof); mouse users lose drag. |
| D-7 | **A manual queue says so.** Next in line shows a `Tag` "Manual order" and, under the list, "Set by a lead. Anyone added later follows in the automatic order." Members see both. Viewers see neither (they get no order at all, S2a-3a D-20). No per-entry marker. | Mark each entry added after the pin: more noise, and the caption already says where they go. |
| D-8 | **Undo, not confirm.** Save toasts "Order saved · Undo"; Back to automatic toasts "Back to automatic order · Undo". Undo re-applies the order shown before, or automatic, through the same route. | `ConfirmModal` on Back to automatic: a modal for a reversible quick edit. |
| D-9 | **A reorder leaves each cell's provenance alone.** "Where it came from" reads the row's last writer (`progress/progressProvenance.ts:36-46,66-75`), and `write_row` restamps it on every write (`services/collection_records.py:802-804`). A rank-only write must not, or every re-ranked member's self-reported "Need 12/99" turns into "set by {lead}". The backend gets a rank-only door (E-3), and the PROV-1 guard one named exemption. | Accept the stamp: no guard change, but the tooltip then lies about who set the state. |
| D-10 | **V1 shows the pin.** V1 already reads `priority_rank`: the "#n" badge and its sort in `collections/ParticipantsPanel.tsx:109-121`, "Next priority" in `RewardGoalCard.tsx:42-43`, Log Drop's sort and "#n" in `LogDropModal.tsx:36,45`, Copy plan's Need order in `CollectionsHub.tsx:73-79`, and `list_participants`' order (`routers/collection_goals.py:207-211`). No V1 code changes; it is declared V1 delta **(l)** with a public release line. | Store the pin elsewhere: a migration, and S2-8 :55 names `priority_rank`. |
| E-1 | **A dedicated route:** `PUT /api/static-groups/{group_id}/collection-goals/{goal_id}/queue-order`, body `{ "user_ids": [...] }`; `[]` is Back to automatic. The PATCH stays as it is: explicit `null` can't mean "clear", because V1's store sends `priority_rank: null` on every write (`stores/collectionGoalStore.ts:742,764`), so every V1 status change would wipe a pin. A clear flag on the PATCH would need `state` on every call (`schemas/collection_goals.py:105-109`), n requests per reorder, n undo tokens and n restamps, none atomic. | |
| E-2 | **The route:** lead and above (`require_can_manage_members`, as the bulk Need, `collection_goals.py:1287`); another static's goal is a 404; duplicates or more than 200 ids are a 422. The goal row is locked (`_get_goal(..., for_update=True)`, `:235-237`), one `now`. An id with no row for (goal, static) is skipped and counted. No role check on the listed users (ordering a row creates nothing) and no goal-status check (a finished farm keeps its order for Reopen). Only rows whose rank changes are written. Response `{ ranked, cleared, skipped }`. | |
| E-3 | **The door:** `write_rank(db, *, row, priority_rank, now) -> bool` beside `write_row` sets `priority_rank` and `updated_at` only. `updated_at` must move: Undo skips a row whose `updated_at` changed (`collection_goals.py:1223`) and otherwise restores the row's prior rank (`:1241`, token format 2, `services/participant_undo.py:34`), which would undo a pin. Writer, channel, `state_changed_at`, `source` and `last_manual_override_at` stay (so the plugin's collision rule is untouched too). | |
| E-4 | **No undo token.** The client's Undo (D-8) re-PUTs the prior order it held. A member who left the queue since is skipped. | |
| E-5 | **The queue:** `queueFor(row, mode, { pin })` puts entries whose row has a rank first, by rank (ties in the automatic order), then the rest in the automatic order; ranks stay 1…n. `QueueEntry` gains `pinned`. Viewer callers pass `pin: false`: the server already nulls ranks for a real viewer (`collection_goals.py:784`), and this covers View As, where reads come back as the admin (the `cellFor` precedent, `utils/progressModel.ts:146-179`). | |
| E-6 | **The store:** `setQueueOrder(groupId, goalId, userIds)` PUTs, then `refreshGoalProgress(groupId, goalId)` (R-S3-5). Additive, under V1 delta (e). | |
| E-7 | **The draft** is a list of user ids taken when the editor opens. Each render shows the draft's ids still queued, in draft order, then anyone queued since, appended. Save sends that list. Closing the panel drops the draft (no discard prompt). Escape is the editor's: it cancels a keyboard drag, else the edit, and is prevented so the panel stays open (the `FarmEditBlock` rule, `FarmExpansion.tsx:27-30`). | |
| E-8 | **Focus:** a moved entry keeps focus on the button that moved it; Move up/down at an end is `aria-disabled` (focus stays); a polite status line reads "{name}, {k} of {n}". After Save, Cancel or Back to automatic, focus goes to Change order, or to Copy plan when Change order is absent (the `onLeave` precedent, `FarmExpansion.tsx:97`). | |
| E-9 | **Plugin contract unchanged.** The plugin never sends or reads `priority_rank` (no match in `XIVRaidPlannerPlugin`; its farm calls are `RaidPlannerClient.cs:370-378`), and the sync paths never pass it to `write_row`, so a pin survives every sync. | |
| E-10 | **Release notes:** C1, C2 and C4 internal; C3 carries delta (l)'s public line. | |

## 3. Design

### 3.1 The route (C1)

`set_queue_order` loads every `RewardParticipantState` of the goal in this static, then gives the k-th listed user who has a row rank k and every other row `None`, through `write_rank`. It logs `collection_queue_order_set` (static, goal, counts) and commits once. `authz_matrix.py` gains its row (lead). No migration, `database.py` untouched, no plugin route changes.

### 3.2 The queue (C2, `utils/progressQueue.ts`, pure)

With nothing pinned, today's order exactly (`progressQueue.ts:29-56`). With a pin: a stable re-sort of that list, pinned entries first by rank, everyone else after, in place. `queueIsManual(queue)` is true when a queued entry is pinned (ranks left only on Have rows don't count). `pinnedOrder(row)` lists the ranked user ids by rank, for Undo.

### 3.3 What the lead sees and does (C3, C4)

- **At rest:** Next in line as today, plus D-7's tag and caption when manual. A lead also gets D-5's two `Button variant="ghost" size="sm"`.
- **Change order** swaps the list for `QueueOrderEditor`: every queued entry as "#k {name} · Need 12/99" with **Move {name} up** and **Move {name} down** (`IconButton`) and, from C4, a handle **Reorder {name}**; then **Save order** (primary) and **Cancel**. Show all is hidden while editing.
- **Save** PUTs, refreshes and closes the editor (D-8's toast); a failure keeps the editor and its draft, with an error toast; Save is `aria-disabled` while saving. **Back to automatic** PUTs `[]`. **Undo** PUTs `pinnedOrder` as it was before the write (or `[]`) and toasts "Order restored".
- Log drop's "Log drop for {#1}" and Copy plan follow the saved order with no change of their own.

### 3.4 Who sees what

| Reader | Order | Tag and caption | Change order, Back to automatic |
|---|---|---|---|
| Owner, lead, admin (owner access) | ranked | when manual | yes (D-5) |
| Member | ranked | when manual | absent (ROLE-1) |
| Viewer | unranked line (D-20) | never | absent |
| Guest | no farms | — | — |
| View As | the viewed role's, as Edit statuses (`ProgressPage.tsx:307`) | a viewed viewer: never (E-5) | as the viewed role; writes go as the admin |

### 3.5 Edge cases

| Case | Behaviour |
|---|---|
| Someone sets Need after the pin | After every pinned entry, in the automatic order (D-3) |
| A pinned member gets the drop (Have) | Leaves the queue; rank kept; Undo of the drop puts them back in place (D-3) |
| A pinned member passes or clears | Leaves the queue; returns to their place if they set Need or Want again |
| A pinned member leaves the static | No column, not queued; the rank stays on the row until the next Save or Back to automatic clears it (D-4) |
| Not on the roster, Card not set up | Queued (D-19), so pinnable like anyone |
| Unclaimed column | Never queued, never pinned |
| Hidden count | The pin ignores counts; the editor shows the state alone; nothing leaks |
| Equal ranks (old PATCH, API only) | The automatic order between them |
| `desired_only` | Pinned Wants out; the pin still orders the Needs |
| `free_roll` | No queue, no controls; ranks kept for a switch back |
| Finished farm | Order kept for Reopen; no controls |
| Two leads save at once | The goal row lock serialises them; the last save wins |
| A rank change after a status edit | That status edit's Undo then reports "changed since" (E-3) |
| The old PATCH with `priority_rank` | Unchanged: sets one rank and stamps the writer, as today |

### 3.6 Keyboard and errors

The panel row is outside the grid's rows (R-S3-4), so the editor's keys never reach `useMatrixKeyboard`. Tab order: Change order, Back to automatic, each entry's controls, Save order, Cancel. axe 0 critical / 0 serious in both themes at 1440 with the editor open. A failed Undo toasts and leaves the order as saved.

## 4. Acceptance

Shown on the running app, light and dark:
1. A lead reorders a queue of three by keyboard (Move up/down) and by drag, saves, and Next in line, "Log drop for {#1}" and Copy plan follow; a reload keeps it; "Manual order" shows.
2. A member sees the same order and the tag with no controls; a viewer sees the unranked line and no tag.
3. A member who sets Need after the pin lands after the pinned entries; a pinned member's logged drop takes them out, and its Undo puts them back in place.
4. Back to automatic restores Need, then Want, fewest first; its Undo brings the pin back.
5. A re-ranked member's cell tooltip still reads what it read before (pytest on the stored writer and channel).
6. The PATCH is unchanged: V1's `null` keeps a pin, a member's rank is ignored (pytest).
7. V1's farm view shows the pin as "#n" and "Next priority" (delta (l), shots before and after).
8. axe clean with the editor open in both themes; the plugin contract unchanged.

## 5. Slicing

D-1's cut; the plan (`plans/2026-10-25-s2a-3c-change-order.md`) sizes it: **C1** the route and its pytest (merges alone) · **C2** `queueFor` with the pin, `pinnedOrder` and the draft helpers, the store action · **C3** Change order: controls, tag, editor with buttons, Save, Back to automatic, Undo · **C4** the drag handle and the e2e proof. C2…C4 stack on `main` after C1 and merge together after a preflight.

## 6. Matrix coverage

No V1 control sets a rank, so the capability itself has no row yet. Proposed, written in after the owner's answers (next free id is P-126; P-112…P-125 are taken):
- **P-126** · "Set a farm's queue order (`priority_rank`): API only; no V1 control sends one" · `routers/collection_goals.py:881,1066`; `stores/collectionGoalStore.ts:742,764` · RE-HOMED · Change order and Back to automatic in the open farm row (S2-8 :55) · S2a-3c.
- Notes on **P-22**, **P-33** and **P-38**: V2's queue, #1 preselect and ranks honour a lead's pin (S2a-3c).
- Parent §7 gains V1 delta **(l)** (D-10): V1 renders a lead's pin through its existing rank displays; release line "A lead's farm queue order now shows in the classic farm view as ranks."

## 7. Residuals (disclosed)

- A rank-only write records no writer: who last pinned a farm isn't stored (D-9). The structured log line is the trace.
- After a reorder, recent status-edit Undos on re-ranked rows report "changed since" (E-3).
- A member demoted to viewer who keeps a claimed card stays queued, as today (`ProgressPage.tsx:296-297`), so a lead can pin them; Log drop then refuses them as a recipient, as it already would for #1.
- V1 still has no control that sets a rank; it only shows them (D-10).
- Phones: the matrix scrolls sideways (S2-15).

## 8. Spec facts corrected

- S2-8 :55 and S2a-3a D-1 say "leads can still set ranks through the classic view". **No V1 surface sets a rank:** the only V1 caller sends `{ state }` (`collections/RewardGoalDetailModal.tsx:42`), the store maps a missing rank to `null`, which the PATCH reads as unchanged (`unset_if_none`, `services/collection_records.py:379-381`), and `upsertStateForUser` has no caller. Only a direct API call sets one. S2a-3b D-1 already says "V1 has none".
- The PROV-1 guard counts `priority_rank` as a stamped fact (`tests/test_provenance_coverage.py:117-140`), so D-9 needs its one exemption (§3.1, E-3).

## 9. Write-back to the parent spec (after the stack merges)

S2-8 :55 becomes the as-built rule (D-2…D-5, D-7, D-8) with the shipped markers, and loses the classic-view sentence (§8); §5's "Queue order" row names `queueFor`'s pin (E-5) and the route (E-1); §7 gains delta (l) (D-10); the parity matrix gains P-126 and the P-22, P-33, P-38 notes; §6 records S2a-3c's PRs.
