# Stage 2a · S2a-3c, Change order / Back to automatic (V2) — design

**Status:** drafted 2026-10-25 from the specs and the code (the owner skipped the co-design Q&A). **Plan-vet, 2026-10-25:** `xivrp-director` PASS with fixes; every finding (M1, S1–S7, C1–C5) is folded here and in the plan. The owner delegated D-1…D-10 ("do whatever you think is best"), so the controller's rulings stand as the owner's answers: **D-2 and D-6 changed** from the first draft's recommendation, the rest as recommended. E-1…E-10 are the controller's engineering rulings. This note records only what S2a-3c adds. The rest is ruled in the parent spec, [`2026-09-30-s2a-progress-design.md`](2026-09-30-s2a-progress-design.md): S2-7 :45 (the manual order is lead-only), S2-8 (the queue; :55 is this slice), S2-9 (the open farm row), §5's "Queue order" row and §7 criteria 10 and 11. Carried from S2a-3a D-1 (`specs/2026-10-09-s2a-3a-row-expansion-design.md:21`) and S2a-3b D-1 (`specs/2026-10-20-s2a-3b-tier-row-design.md:20`). Where this note and the parent differ, this note wins for S2a-3c and the parent is corrected at write-back (§9).

## 1. Scope

S2a-3c lets a lead pin a farm's queue: **Change order** in the open farm row's Next in line, and **Back to automatic** to drop the pin. The queue model honours the pin, so Next in line, Log drop's #1 and Copy plan all follow it. One new route sets or clears a farm's order; the participant PATCH is unchanged.

**Not in S2a-3c:** drag to reorder (a holistic-review candidate on #406's list, D-6); Home's TrackCard "is next" (S2a-4; it will read `queueFor` over `cellFor`'s cells, so it follows the pin and a viewer never gets it); Edit's priority-mode help lines (unchanged: they describe the automatic rule); phones (S2-15).

## 2. Decisions

D-1…D-10: **Owner: as amended by the controller under delegation 2026-10-25.** The decision is in bold; the last column holds the alternative and why not. E-1…E-10: controller.

| # | Decision | Alternative, and why not |
|---|---|---|
| D-1 | **Four PRs.** C1 the route (backend, merges alone), then a stack: C2 the pinned queue (model and store), C3 Change order (the editor, Back to automatic, Undo), C4 the end-to-end proof. | One frontend PR: ~2,100 lines, over the cap. |
| D-2 | **Changed: the pin orders within each state.** Needs stay before Wants; the pin orders the Needs among themselves and the Wants among themselves. The editor is one list, Needs first then Wants, and Move up/down stop at the Need/Want boundary. The spec's reason for the pin is the lead correcting self-reported counts, which rank members within one state (parent :58); per state, V1's "Next priority" (the first ranked Need, `collections/RewardGoalCard.tsx:41-43`) and Copy plan's per-state lines (`utils/discordPlan.ts:36-37,53-54`) agree with V2. | One order across states (the first draft): a Want could outrank a Need, and V1's Next priority and Copy plan would then disagree with V2's #1. |
| D-3 | **A later joiner goes after the pinned members of their own state,** in the automatic order, so a new Need lands before every Want. A pinned member who leaves the queue (Have, Pass, blank) keeps their rank until the next Save (D-4) and returns to their place if they come back, so Undo of a logged drop restores it. | Clear a rank when its member leaves: a write in the drop route (V1 reaches it), and Undo loses the place. |
| D-4 | **Save replaces the farm's whole order.** The listed members are ranked 1…n in order; every other rank on the farm is cleared. **Back to automatic** clears every rank on the farm. | Rank only the listed: stale ranks resurface. |
| D-5 | **The controls live in the open row's Next in line section**, for leads only (`canManage` and not a viewer), on an active row, never under `free_roll`. **Change order** shows with two or more queued; **Back to automatic** only while the queue is manual. Not in the row menu, not in the matrix. | A row-menu item: the order belongs where the queue is read. |
| D-6 | **Changed: Move up / Move down buttons only.** Change order turns Next in line into the full queue (not the top four), each entry with **Move {name} up** and **Move {name} down** `IconButton`s (the pattern of `components/priority/PlayerBasedEditor.tsx:318-331`), then **Save order** and **Cancel**. Inline, no modal (CLAUDE.md). A drag handle goes on the holistic-review list (#406's) as a candidate. | Buttons plus a dnd-kit handle (the first draft): ~350 more lines and an Escape-mid-drag interplay with the panel, for a list of a handful. |
| D-7 | **A manual queue says so.** A `Tag` "Manual order" above the list and, under it, "Set by a lead. Anyone added later goes after the set order in their status." *(Copy as built, S2a-3c: "status", not "group".)* Members see both; viewers neither (they get no order, S2a-3a D-20). No per-entry marker. | Mark each later joiner: more noise; the caption says where they go. |
| D-8 | **Undo, not confirm.** Save toasts "Order saved · Undo"; Back to automatic toasts "Back to automatic order · Undo". Undo re-applies the order shown before, or automatic, through the same route. | `ConfirmModal` on Back to automatic: a modal for a reversible quick edit. |
| D-9 | **A reorder leaves each cell's provenance alone.** "Where it came from" reads the row's last writer (`progress/progressProvenance.ts:36-46,66-75`), which `write_row` restamps on every write (`services/collection_records.py:802-804`); a rank-only write must not, or every re-ranked member's self-reported "Need 12/99" reads "set by {lead}". The backend gets a rank-only door (E-3) and the PROV-1 guard one named exemption. | Accept the stamp: the tooltip then misnames who set the state. |
| D-10 | **V1 shows the pin,** with no V1 code change: declared V1 delta **(l)**, all four effects in §6, with a public release line and before/after shots of each. | Store the pin elsewhere: a migration, and S2-8 :55 names `priority_rank`. |
| E-1 | **A dedicated route:** `PUT /api/static-groups/{group_id}/collection-goals/{goal_id}/queue-order`, body `{ "user_ids": [...] }`; `[]` is Back to automatic. The PATCH stays as it is: explicit `null` can't mean "clear", because V1's store sends `priority_rank: null` on every write (`stores/collectionGoalStore.ts:742,764`), so every V1 status change would wipe a pin. A clear flag on the PATCH needs `state` on every call (`schemas/collection_goals.py:105-109`), n requests per reorder, n undo tokens and n restamps, none atomic. | |
| E-2 | **The route:** lead and above (`require_can_manage_members`, as the bulk Need, `collection_goals.py:1287`); another static's goal is a 404; duplicates or more than 200 ids are a 422. It locks the goal (`_get_goal(..., for_update=True)`, `:235-237`), then the goal's rows in id order with `populate_existing`, as Undo does (`:1182-1190`); one `now`. An id with no row for (goal, static) is skipped and counted. No role check on the listed users (ordering a row creates nothing) and no goal-status check (a finished farm keeps its order for Reopen). Only rows whose rank changes are written. Response `{ ranked, cleared, skipped }`. The log line carries the caller and channel, as Undo's does (`:1251-1259`). | |
| E-3 | **The door:** `write_rank(db, *, row, priority_rank, now) -> bool` beside `write_row` sets `priority_rank` and `updated_at` only; `set_queue_order` is its only caller (a guard test, as for Undo's `restore_*` keywords, `collection_records.py:743`). **`updated_at` must move:** Undo's "unchanged since" is equality with it (`collection_goals.py:1223`) and the restore puts back the row's prior rank (`:1241`, token format 2, `services/participant_undo.py:34`), so without the move a pending status Undo would silently undo a pin; not restoring the rank would reopen B3's ruling for API PATCHes. The move reorders V1's unranked rows: declared as delta (l)(d). Writer, channel, `state_changed_at`, `source` and `last_manual_override_at` stay (the plugin's collision rule is untouched too). | |
| E-4 | **No undo token.** The client's Undo (D-8) re-PUTs the prior order it held; a member who left the queue since is skipped. | |
| E-5 | **The queue:** `queueFor` orders each state's entries pinned first by rank (ties in the automatic order), then the rest in the automatic order; Needs before Wants as today; ranks stay 1…n across the queue. `QueueEntry` gains `pinned`. **`cellFor` drops the rank for a viewer reader** (`utils/progressModel.ts:146-179`, as it withholds counts): the server already nulls ranks for a real viewer (`collection_goals.py:784`), and this covers View As, where reads come back as the admin. No caller passes a flag. | |
| E-6 | **The store:** `setQueueOrder(groupId, goalId, userIds)` PUTs, then `refreshGoalProgress(groupId, goalId)` (R-S3-5). Additive, under V1 delta (e). | |
| E-7 | **The draft** is a list of user ids taken when the editor opens. Each render groups the current queue by state: the draft's ids in that state, in draft order, then anyone queued in it since (a member who switched state lands in the new group). Save sends that list. Closing the panel drops the draft (no discard prompt). Escape in the editor cancels it and is prevented, so the panel stays open (the `FarmEditBlock` rule, `FarmExpansion.tsx:27-30`). | |
| E-8 | **Focus and state:** after each move, focus is put back explicitly on the button that moved its entry. A Move button at the list's end or the Need/Want boundary is `aria-disabled` with `BUSY_CLASS` (`progress/useDrops.ts:27`), since `IconButton` dims only for native `disabled` (`primitives/IconButton.tsx:63`). A polite status line reads "{name}, {k} of {n}". While the editor is open, Change order and Back to automatic are hidden. After Save, Cancel or Back to automatic, focus goes to Change order, or to Copy plan when Change order is absent (the `onLeave` precedent, `FarmExpansion.tsx:97`). | |
| E-9 | **Plugin contract unchanged.** The plugin never sends or reads `priority_rank` (no match in `XIVRaidPlannerPlugin`; its farm calls are `RaidPlannerClient.cs:370-378`), and neither sync door passes it to `write_row`, so a pin survives both syncs. | |
| E-10 | **Release notes:** C1, C2 and C4 internal; C3 carries delta (l)'s public line (V1 users see the ranks once a V2 lead pins). | |

## 3. Design

### 3.1 The route (C1)

`set_queue_order` locks the goal and its rows, then gives the k-th listed user who has a row rank k and every other row `None`, through `write_rank`. It logs `collection_queue_order_set` (static, goal, caller, channel, counts) and commits once. `authz_matrix.py` gains its row (lead). No migration, `database.py` untouched, no plugin route changes.

### 3.2 The queue (C2, `utils/progressQueue.ts`, pure)

With nothing pinned, today's order exactly (`progressQueue.ts:29-56`). With a pin, each state's list is stable-sorted: pinned entries first by rank, the rest after in place. `queueIsManual(queue)` is true when a queued entry is pinned (ranks left only on Have rows don't count). `pinnedOrder(row)` lists the ranked user ids by rank, for Undo. Because Save sends Needs then Wants, the stored ranks run 1…n in queue order at save time.

### 3.3 What the lead sees and does (C3)

- **At rest:** Next in line as today, plus D-7's tag and caption when manual; a lead also gets D-5's two `Button variant="secondary" size="sm"` *(as built, S2a-3c: `secondary`, not `ghost`, on Change order, Back to automatic, the editor's Cancel and the queue's Show all, because ghost's accent text is 4.11:1 on the farm panel's `bg-surface-elevated` in the light theme; fixed in #411 and #412)*.
- **Change order** hides both controls and swaps the list for `QueueOrderEditor`: every queued entry as "#k {name} · Need 12/99" with its Move up and Move down, then **Save order** (primary) and **Cancel**. Show all is hidden while editing.
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
| Someone sets Need after the pin | After the pinned Needs, before every Want (D-3) |
| Someone sets Want after the pin | After the pinned Wants |
| A pinned member switches Need ↔ Want | Keeps their rank; placed by it among the pinned of the new state |
| A pinned member gets the drop (Have) | Leaves the queue; rank kept; Undo of the drop puts them back in place (D-3) |
| A pinned member passes or clears | Leaves the queue; returns to their place if they set Need or Want again |
| A pinned member leaves the static | No column, not queued; the rank stays on the row until the next Save or Back to automatic (D-4) |
| Not on the roster, Card not set up | Queued (D-19), so pinnable like anyone |
| Unclaimed column | Never queued, never pinned |
| Hidden count | The pin ignores counts; the editor shows the state alone; nothing leaks |
| Equal ranks (old PATCH, API only) | The automatic order between them |
| `desired_only` | Wants out; the pin orders the Needs |
| `free_roll` | No queue, no controls; ranks kept for a switch back |
| Finished farm | Order kept for Reopen; no controls |
| Two leads save at once | The goal and row locks serialise them; the last save wins |
| A rank change after a status edit | That status edit's Undo then reports "changed since" (E-3) |
| The old PATCH with `priority_rank` | Unchanged: sets one rank and stamps the writer, as today |

### 3.6 Keyboard and errors

The panel row is outside the grid's rows (R-S3-4), so the editor's keys never reach `useMatrixKeyboard`. Tab order at rest: Change order, Back to automatic. While editing: each entry's Move up and Move down, then Save order and Cancel. axe 0 critical / 0 serious in both themes at 1440 with the editor open. A failed Undo toasts and leaves the order as saved.

## 4. Acceptance

Shown on the running app, light and dark:
1. A lead reorders a queue of three by keyboard only, Move up twice keeping focus on the moved entry's button, saves, and Next in line, "Log drop for {#1}" and Copy plan follow (Copy plan's Need and Want lines each in the pinned order: true by construction under D-2); a reload keeps it; "Manual order" shows; a move never crosses the Need/Want boundary.
2. A member sees the same order and the tag with no controls; a viewer sees the unranked line and no tag.
3. A member who sets Need after the pin lands after the pinned Needs and before every Want; a pinned member's logged drop takes them out, and its Undo puts them back in place.
4. Back to automatic restores Need, then Want, fewest first; its Undo brings the pin back.
5. A re-ranked member's cell tooltip reads what it read before (pytest on the stored writer and channel).
6. The PATCH is unchanged: V1's `null` keeps a pin, a member's rank is ignored (pytest).
7. V1 shows delta (l)'s four effects, each in before/after shots.
8. axe clean with the editor open in both themes; the plugin contract unchanged.

## 5. Slicing

D-1's cut; the plan (`plans/2026-10-25-s2a-3c-change-order.md`) sizes it: **C1** the route and its pytest (merges alone) · **C2** the per-state pinned `queueFor`, `cellFor`'s viewer rule, `pinnedOrder` and the draft helpers, the store action · **C3** Change order: controls, tag, editor, Save, Back to automatic, Undo, delta (l)'s shots · **C4** the e2e proof. C2…C4 stack on `main` after C1 and merge together after a preflight.

## 6. Matrix coverage and V1 delta (l)

No V1 control sets a rank, so the capability itself has no row yet. Written into the matrix at write-back (§9; next free id is P-126, P-112…P-125 are taken):
- **P-126** · "Set a farm's queue order (`priority_rank`): API only; no V1 control sends one" · `routers/collection_goals.py:881,1066`; `stores/collectionGoalStore.ts:742,764` · RE-HOMED · Change order and Back to automatic in the open farm row (S2-8 :55) · S2a-3c.
- Notes on **P-22**, **P-33** and **P-38**: V2's queue, #1 preselect and ranks honour a lead's pin (S2a-3c).

**V1 delta (l)** (parent §7; slice S2a-3c; release line "A lead's farm queue order now shows in the classic farm view as ranks"). V1's code is unchanged; once a V2 lead pins, V1 renders:
- **(a)** "#n" badges in every state group (`collections/ParticipantsPanel.tsx:95-121`), so a pinned member who got the drop or passed shows "#1" under Have or Pass until the next Save clears it (D-3, D-4).
- **(b)** V1 prints stored ranks; V2 numbers its queue 1…n. They agree at save time and differ once a pinned member leaves or a later joiner arrives (V2 renumbers; V1 shows "#2, #3"). V1's Log Drop picker sorts Need and Want together by rank (`LogDropModal.tsx:35-36`), so an unranked later Need lists after the ranked Wants there.
- **(c)** "Next priority" (`RewardGoalCard.tsx:41-43,148-156`) is the first ranked Need. Under D-2 it is V2's #1 whenever a pinned Need is queued. With Needs queued but none ranked, V1 shows no Next priority line while V2's #1 is the first automatic Need; with only Wants queued, V1 shows none while V2's #1 is a Want.
- **(d)** `write_rank` moves `updated_at` (E-3), and V1 lists unranked rows in the server's order (rank, then `updated_at`, `collection_goals.py:207-210`; V1's sorts are stable). A row whose rank is cleared therefore moves to the end of its state's unranked rows in ParticipantsPanel, the Log Drop picker, and Copy plan's Want and Have lines and "Can buy now", which keep input order (`CollectionsHub.tsx:73-79`). V2 orders by column, so it is unaffected.

## 7. Residuals (disclosed)

- A rank-only write records no writer: who last pinned a farm isn't stored (D-9). The log line is the trace.
- After a reorder, recent status-edit Undos on re-ranked rows report "changed since" (E-3).
- Undo of a Save or a Back to automatic re-applies the prior order wholesale, so within its 8 s window it can overwrite another lead's save made in between.
- A member demoted to viewer who keeps a claimed card stays queued, as today (`ProgressPage.tsx:296-297`), so a lead can pin them; Log drop then refuses them as a recipient, as it already would for #1.
- V1 still has no control that sets a rank; it only shows them, with delta (l)'s four effects.
- No drag to reorder (D-6): a holistic-review candidate. Phones: the matrix scrolls sideways (S2-15).

## 8. Spec facts corrected

- Four sentences say "leads can still set ranks through the classic view" or imply it: parent S2-8 :55, S2a-3a design :21 and :122, S2a-3b design :130. **No V1 surface sets a rank:** V1's one caller sends `{ state }` (`collections/RewardGoalDetailModal.tsx:42`), the store maps a missing rank to `null`, which the PATCH reads as unchanged (`unset_if_none`, `services/collection_records.py:379-381`), and `upsertStateForUser` has no caller. Only a direct API call sets one. (S2a-3b D-1 already says "V1 has none".)
- The PROV-1 guard counts `priority_rank` as a stamped fact (`tests/test_provenance_coverage.py:117-140`), so D-9 needs its one exemption.

## 9. Write-back (after the stack merges)

**Done 2026-10-25** (S2a-3c write-backs, after #409-#412 merged; main `c72d2207`). What follows is the list as planned.

The parent spec: S2-8 :55 becomes the as-built rule (D-2…D-5, D-7, D-8) with the shipped markers; §5's "Queue order" row names the per-state pin (E-5) and the route (E-1); §7 gains delta (l) as written in §6; §6 records S2a-3c's PRs. The four sentences in §8 are corrected in place, each with a note "(corrected 2026-10-25, S2a-3c: no V1 control sets a rank)". The parity matrix: P-126 shipped and the P-22, P-33, P-38 notes. #406's holistic list gains the drag handle candidate (D-6).
