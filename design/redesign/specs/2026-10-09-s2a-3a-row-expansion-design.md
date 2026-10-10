# Stage 2a · S2a-3a, the farm row expansion (V2) — design

**Status:** owner co-design, 2026-10-09. This note records only the decisions S2a-3a adds. Everything else is already ruled in the parent spec, [`2026-09-30-s2a-progress-design.md`](2026-09-30-s2a-progress-design.md): S2-5 (Finished, Reopen), S2-8 (the queue), S2-9 (the expanded row), §4 (one stack with S2a-2), §7 criteria 4 and 5. The parity matrix rows tagged "· S2a-3a" ([`2026-09-30-s2a-parity-matrix.md`](2026-09-30-s2a-parity-matrix.md), 28 rows) and §12.2 (G-14, inline Edit) set the scope. Where this note and the parent differ, this note wins for S2a-3a and the parent is corrected at write-back (§9). **Plan-vet, 2026-10-10:** the plan's `xivrp-director` vet (APPROVE WITH CHANGES) corrected D-15 and amended D-9; the owner ruled D-19…D-22 the same day, all as recommended.

## 1. Scope

S2a-3a ships level 2 for **farm rows**: one row open at a time, opened by a click or `?track=<goalId>`, holding the queue, the drops, the farm's details, Log a drop / I got it with Undo, Copy plan, and the lead's row menu (Edit, Mark finished, Reopen, Delete).

It also closes the halves the S2a-2 plan handed on (`plans/2026-10-08-s2a-2-progress-tab.md:529`): P-17's finished-row expansion, P-19's content, mode and notes, P-33's rank in the queue, P-46 (Mark finished and Reopen, including Mark finished when everyone has it, D-22), and the drop's character on display.

**Not in S2a-3a:**
- the tier row's expansion and `?track=tier` (S2a-3b);
- **Change order / Back to automatic** (S2-8 :55): deferred to its own slice after S2a-3a (§2 D-1);
- Schedule a farm night (S2-9 :67): absent until W4 SCHED, as the parent rules;
- phones (S2-15).

## 2. Decisions (owner, 2026-10-09; D-19…D-22 2026-10-10)

| # | Decision | Why |
|---|---|---|
| D-1 | **Change order is deferred** to a small slice after S2a-3a. The automatic queue ships now; leads can still set ranks through the classic view. | Keeps S2a-3a frontend-only and under the cap. Clearing a rank may need a backend change: the participant PATCH treats `null` as unchanged. |
| D-2 | **Copy plan keeps legacy's format, in V2's queue order.** Hidden counts are left out; `free_roll` and `desired_only` follow the queue rules (§3.1). | The pasted list matches what the expansion shows. V1 keeps its own order and its output stays byte-identical (§3.2). |
| D-3 | **Drop Undo keeps re-resolving the chain** (R-S1-14 as built). The stored `recipient_character_id` is not preferred. | The edge (a card or main change between the drop and its Undo) is rare and fails safe: the revert is skipped, never applied to the wrong record. Disclosed as a residual. |
| D-4 | **Layout A.** The panel holds an action bar on top, then three columns: Next in line · Last drops · About. Edit's block goes above the action bar. Mockup: claude.ai artifact `NagngyR4V32ssZjaV5K1cH`. | The action comes first, #1 sits right under it, and the panel stays about six lines so the matrix stays in view. One primary action per region (rule 11). |
| D-5 | **"I got it" is hidden when the member's cell is Have** (and, since D-21, once they have a drop on this farm). It shows on Need, Want, Pass and blank. | A Pass player can still win a free roll, and the drop should be recordable by them. Legacy lets any non-viewer log their own drop whatever their state. |
| D-6 | **Log a drop is a split button.** The main part reads "Log drop for {#1}" and logs in one click. The ▾ opens a picker: the queue in order, then "Not in the queue" (every other member with a column, Not on the roster included (D-19), in column order), then Nobody, plus an optional note and "Log drop". Under `free_roll` (or an empty queue) the button reads "Log a drop" and opens the picker with Nobody preselected. Mockup: artifact `DinzNGuCGMWiD9EqPXDw14`. | The common case is one click, the button names the recipient before the click, and Undo covers a mistake. |
| D-7 | **Opening a row:** the farm's name cell becomes a disclosure `Button` with a chevron and `aria-expanded`. Player cells keep their picker, so a cell click never opens the row. Enter on the name cell in the keyboard grid toggles it. | Cells are already interactive (S2a-2·F5); one clear target avoids double meaning. |
| D-8 | **`?track=` is written in place** (history replace). An unknown or deleted id is dropped from the URL silently. A finished farm's id expands "Finished (n)" and opens that row. The open row scrolls into view. | Back leaves the page instead of stepping through rows. |
| D-9 | **Mark finished** is one click, from the row menu or, when everyone has it, from the open panel's action bar (leads). A toast offers Undo, which restores the farm's earlier status (Wanted, Farming or Scheduled). The row moves under Finished. *Amended 2026-10-10 by D-22 (plan-vet I-1): the status cell's inline "· Mark finished" link is gone; it reads only "Everyone has it".* | A status change is cheap to undo; a confirm would be friction. |
| D-10 | **Reopen** is one click on a finished row and sets Farming (S2-5), with a toast. | As the parent rules. |
| D-11 | **Delete a farm** uses today's `ConfirmModal` text word for word: title "Delete Goal", message `Delete "{title}"? This will remove all participant states and drop history for this goal.`, label "Delete", danger variant (`RewardGoalDetailModal.tsx:135-141`). No Undo. | Destructive and unrecoverable server-side. |
| D-12 | **Edit:** Save shows a toast; Escape cancels. Opening another row while Edit has unsaved changes asks "Discard changes?" in a `ConfirmModal` first. | One row open at a time must not silently lose a lead's edits. |
| D-13 | **"Show all"** expands in place, for the queue (only when more than four are queued) and for the drops (up to the 50 most recent, the route's limit). | No modal; the matrix stays the page. |
| D-14 | **Deleting a listed drop:** a delete `IconButton` per drop under today's rule (lead or owner: any; member: their own, `createdById`; viewer: none; `DropHistoryPanel.tsx:79`), with today's confirm (title "Delete Drop", label "Delete", danger variant, `:120-123`): `Delete this drop? {recipient ?? 'The recipient'} goes back to {prior state} if it was their only drop.` when the drop carries a prior state, else `Delete this drop?` (`:52-54`). The Undo toast is only for the drop just logged. | Q-1 as answered, kept to today's rule. |
| D-15 | **Drop labels:** a drop in this tier reads "Week n". *Corrected 2026-10-10 per plan-vet (C-1): `weekStartDate` is the start of week 1, not of the current week, so* n = floor(whole days from `weekStartDate` to the drop ÷ 7) + 1, mirroring the server's `calculate_week_number` (`backend/app/services/loot_context.py:67-73`). "Week n" shows when 1 ≤ n ≤ `currentWeek`; otherwise, or with a null `weekStartDate`, an unresolved week clock or an unknown week, a short date ("12 Mar"). | Drops store only a timestamp (S2-9 :63). |
| D-16 | **"I got it"'s toast** reads "Logged as yours · Undo". A lead's log reads "Drop logged for {name} · Undo" (or "Drop logged · Undo" for Nobody). | |
| D-17 | **Copy plan is open to everyone who can see the farm**, viewers included, with a "Plan copied" toast. | The counts it reads are already gated for the reader (R-S1-19). |
| D-18 | **Queue entries** read "{name} · {state} {count}", for example "Healer 1 · Need 12/99". A hidden count shows the state alone ("Need"). | |
| D-19 | **Not-on-the-roster and Card-not-set-up members count fully** (2026-10-10, plan-vet C-2). They join the queue under the same rules as rostered members (same state and count order; a hidden count is unknown, last in its state), appear in the Log-drop picker, and can use "I got it" on their own cell. The farm order and the "n of m" tally still count rostered columns only (S2a-2). | V1 parity: V1 lets a lead log for any non-viewer member and a member log their own. |
| D-20 | **Viewers see no queue order** (2026-10-10, plan-vet I-5). In place of the ranked Next in line list they get one unranked line, "Need: A, B · Want: C", names in column order, no ranks and no counts. | S2-7 and V1 delta (i): viewers read states only. A rank derived from hidden counts would leak them. |
| D-21 | **"I got it" hides once that member has a drop on this farm** (2026-10-10, plan-vet I-6): any loaded drop for this goal whose recipient is the current user (the viewed user under View As), in addition to D-5's hide-on-Have. The button stays locked from the click until the read model refreshes. Undo (deleting the drop) brings it back. | A Pass cell, or a custom farm with no catalog item, doesn't change on a drop, so the button would invite a second log. |
| D-22 | **The row menu gets its own grid column for leads** (2026-10-10, plan-vet I-1): a narrow "Actions" column after the name, on the keyboard grid (`'__menu'`), so arrow keys reach the ⋯ button. The status cell reads only "Everyone has it" (S2-5's inline "· Mark finished" link is removed); when everyone has it, Mark finished also shows in the open panel's action bar, as well as in the menu. | One control per cell keeps the grid navigable; a link inside the status cell had no arrow-key path. |

## 3. Design

### 3.1 The queue (`utils/progressQueue.ts`, pure)

`queueFor(row, mode)` returns the ordered entries for one farm row (each cell carries its column):
- **Who:** every column with a member (`claimed`, and `notOnRoster` with either reason, D-19) whose cell is Need or Want. Have, Pass, blank and unclaimed columns are out.
- **Order:** Need before Want; within each, the fewest totems first. A hidden count (`null` with `countHidden`) ranks as unknown, after the known counts in its state. Farms with no token cost (drop-only) fall back to roster (column) order within each state. Ties keep column order.
- **Mode:** `free_roll` returns no queue. `desired_only` keeps Need only. `everyone_gets_one`, `priority_order`, `custom` and null use the rule above. `priority_rank` is ignored until Change order ships (D-1).
- It feeds the expansion's list, the split button's #1, the picker's order and Copy plan. Viewers never see its order (D-20).

### 3.2 Copy plan (`utils/discordPlan.ts`)

`buildDiscordPlan` moves out of `components/collections/CollectionsHub.tsx:19-56`, unchanged in format, and takes its participant list already ordered. `CollectionsHub` passes its current sort, which orders Need only (`priorityRank ?? 999`; Want and Have keep input order), and a separate "Can buy now" source in input order, any state but Have (Pass included), so V1's text stays byte-identical; a test pins V1's output before the move, with a Pass player at the cost, Wants out of input order and a member with no display name. V2 passes `queueFor`'s order (D-2) and omits hidden counts; under `free_roll` it has no Need or Want line, under `desired_only` no Want line (the paste matches the expansion), and "Can buy now" lists anyone at the cost whatever the mode. The "Can buy now" line stays (Q-4).

### 3.3 `?track=` (`hooks/useTrackParam.ts`)

Reads and writes `track` through `useSearchParams` with replace (D-8), and registers the param (`SEEDED_TAB_PARAMS`) so it behaves like every sub-tab param. `useUrlTabState` needs a fixed value list and can't take goal ids. `ProgressPage` owns the open id: one row at a time, opening one closes the other (subject to D-12).
- **Tab switch:** with the default "remember" tab memory, `?track` stays and coming back to Progress reopens the row; with "reset", the switch clears it, as it clears every sub-tab.
- **Static switch:** cleared. Today's switches navigate with no query, and `ProgressPage` also clears it when the static changes under a mounted page, since a goal id never belongs to two statics.

### 3.4 Components (`components/progress/`)

- **`FarmRow`** gains the disclosure name cell (D-7) and, for leads, the row-menu cell in its own column (D-22). The status cell reads "Everyone has it" with no link.
- **`FarmExpansion`**: the panel, rendered as a row under its farm row whose single cell spans the matrix. Order: Edit's block (when editing), the action bar (Log a drop or I got it, Mark finished when everyone has it (leads, D-22), Copy plan), then Next in line · Last drops · About (D-4). A finished row's panel has no drop action. Next in line is the ranked queue for leads and members; a viewer gets the unranked "Need: … · Want: …" line (D-20).
- **`LogDropButton`** (D-6) and **`IGotItButton`** (D-5, D-21).
- **`DropList`**: the last three drops, Show all (D-13), each drop's recipient, character name when it differs from the player's name (the S2a-1 display slice), ×quantity, note, week label (D-15) and delete (D-14). The name: "Nobody" for a drop with no recipient; else the player's display name, else the character name, else "Unknown member"; then "({character})" only when the character name is set and differs.
- **`FarmRowMenu`**: active rows Edit · Mark finished · Delete; finished rows Reopen · Delete. Leads only; members and viewers see no menu and no column (ROLE-1: hidden, not disabled).
- **`FarmEditBlock`**: §12.2's field table, exactly.
- **About** (read-only, every role): content, priority mode and notes (`summary`) (Q-3).

Every control uses the design-system primitives (`Button`, `IconButton`, `Popover`, `ContextMenu`, `ConfirmModal`, `Input`, `Select`); no raw elements.

### 3.5 Data flow

- Logging: `logDrop` (recipient id or null, note). Undo: `deleteDrop` on the returned drop id, which restores the recipient's earlier state through the server's rules (R-S1-14).
- Mark finished / Reopen / Edit: `updateGoal`. Mark finished's Undo: `updateGoal` with the earlier status.
- Delete: `deleteGoal`.
- **Store change (delta (e), additive):** after a drop, a drop delete or a status change, V2 refreshes its read model for that farm (`fetchProgress(groupId, [goalId])`, plus the active list when a farm moves between active and Finished). Today these actions refetch only the legacy participant list (and, for a delete, the drops). V1's calls behave as before. V2 loads drops through a new `loadDrops` that reports a failure (for "Couldn't load drops"); V1's `fetchDrops` keeps swallowing it.
- The backend changes one thing, additively: `RewardDropResponse` gains `recipient_character_name` (the drop row already stores it, `collection_goals.py:1526`, but the response leaves it out, `schemas/collection_goals.py:248-262`; one helper, `_drop_to_response`, builds the create and list responses). The client field is optional (`recipientCharacterName?`), so V1's drop fixtures compile unchanged. Nothing else: a null recipient is allowed and the delete route restores the prior state. The plugin calls no drop route.

### 3.6 Keyboard and the grid (the risky part)

The matrix is an ARIA grid with roving focus (`useMatrixKeyboard`). The panel row sits outside it: arrow keys skip it, and Tab moves from the open row's cells into the panel and on through its controls. Closing the row returns focus to the name cell. For leads the row-menu column (D-22) sits on the grid between the name and the first player cell. Escape inside Edit cancels; Escape elsewhere in the panel closes it. A nested layer keeps its own Escape: the panel ignores an Escape that was already handled or that comes from outside the panel's DOM (the picker's popover and the confirms render in portals), so Escape in the picker, a confirm or an Edit select closes only that layer. axe must stay at 0 critical and 0 serious in both themes with a row open, the picker open and Edit open (§7 criterion 10).

### 3.7 Errors

A failed write shows the existing error toast and leaves the panel as it was. A failed Undo says so and keeps the logged state. A drop fetch that fails shows "Couldn't load drops" with a retry `Button`; the rest of the panel still renders. A failed delete keeps the confirm open, as legacy does (`DropHistoryPanel.tsx:57-59`).

## 4. Acceptance

The parent's criteria 4 and 5 (the `?track=<id>` half), 10 and 11 apply, demonstrated on the running app with screenshots in light and dark:
1. A lead logs a drop in one click for #1, or picks anyone (Not-on-the-roster members included, D-19) or Nobody with a note; under `free_roll` the picker opens with Nobody. Undo restores the earlier state, including after a plugin token sync.
2. A member's "I got it" logs for themselves only, is hidden on Have and once they have a drop on the farm (D-21, Pass cells and custom farms included), and their other statics stop queueing them; Undo reverts their record while its `state_changed_at` is unchanged, and brings the button back.
3. `?track=<id>` opens that row expanded and in view, a finished farm's id included; an unknown id is dropped; a static switch clears it; a tab switch keeps or clears it with the tab-memory setting.
4. The queue orders Need, then Want, fewest totems first, hidden counts last in their state, Not-on-the-roster members by the same rules; `desired_only` shows Need only; `free_roll` shows none. A viewer sees no order: "Need: … · Want: …" in column order with no counts (D-20).
5. V1's Copy plan text is byte-identical; V2's follows the queue.
6. Edit, Mark finished (with Undo; from the menu, and from the action bar when everyone has it), Reopen and Delete work for leads and are absent for members and viewers; the status cell reads only "Everyone has it" (D-22).
7. axe clean in both themes with a row, the picker and Edit open; every control is keyboard-reachable, the row menu by arrow keys; Escape closes only the innermost layer.

## 5. Slicing

PRs stacked on #375, each with an internal 2.1.72 release item, screenshots and a browser walk. The cut below is the design's; the plan (`plans/2026-10-10-s2a-3a-row-expansion.md`) sizes it into seven PRs under the cap (G1, G2, G2b, G3, G4, G5, G5b; after the plan-vet's additions):
1. **G1 · the models:** `progressQueue`, `discordPlan` (with the V1 pin), the drop-week label, `useTrackParam`.
2. **G2 · the panel:** disclosure, `?track=`, queue, About, Copy plan, drops (Show all, delete), the grid integration (§3.6).
3. **G3 · logging:** the split button and picker, I got it, Undo, the read-model refresh.
4. **G4 · the lead's menu:** Edit, Mark finished with Undo, Reopen, Delete; the slice's e2e, axe, role-gating and contrast.

Then the whole stack is updated onto `main`, the green `redesign/s2a2-preflight` push run follows on that exact tree, and the whole stack (#370–#375 plus G1–G5b) merges bottom-first with no further update (R-S2-1).

## 6. Matrix coverage

All 28 "· S2a-3a" rows ship here: P-22 (queue, §3.1, D-19; viewers unranked, D-20), P-23 and P-27 (About), P-24 (D-7, D-8; the menu column, D-22), P-25 and P-38…P-42 (D-5, D-6, D-16, D-19, D-21), P-26 (D-2, §3.2), P-28 and P-43…P-51 (`FarmEditBlock`, §12.2; P-43's create half is S2a-4), P-29 (D-11), P-30 (one panel), P-36 and P-37 (D-13…D-15, D-15 as corrected), P-46 and P-99 (D-9 as amended by D-22, D-10), P-73 (cells, provenance and the queue, D-19, D-20; "Can buy" retired by Q-4), P-76 (null mode queues as Everyone gets one, §3.1).

## 7. Residuals (disclosed)

- D-3's edge: Undo after a card or main change skips the record revert.
- Quantity and drop date aren't offered (always ×1, now), as today's dialog.
- The drop list shows at most 50 drops.
- `priority_rank` set in the classic view doesn't affect V2's queue until Change order ships (D-1).
- A member gets a column (and so "I got it") only when rostered or holding a row on an active farm (S2a-2's columns); a member with neither can be logged by a lead only through Nobody plus a note, or from the classic view.
- D-21 reads the loaded drops: while they load "I got it" waits; if they fail to load, D-5's cell rule alone decides, so a Pass member could log twice in that state.

## 8. Out of scope

Change order (D-1), Schedule a farm night, the tier row (S2a-3b), Find and custom-farm creation (S2a-4), phones (S2-15, W7).

## 9. Write-back to the parent spec (after the stack merges)

S2-8 :55 gains "deferred to its own slice after S2a-3a (S2a-3a D-1)"; S2-8 gains D-19 (Not-on-the-roster members queue) and D-20 (viewers see no order); S2-9 gains D-2, D-5, D-6, D-16, D-21 and D-22; S2-9 :63's week label takes D-15 **as corrected 2026-10-10** (week 1's start, plan-vet C-1); S2-5 :32 loses "· Mark finished" after "Everyone has it" (D-9 as amended by D-22: Mark finished lives in the row menu and, when everyone has it, the panel's action bar); §7 criteria 4 and 5's shipped markers.
