# Stage 2a · S2a-3a, the farm row expansion (V2) — design

**Status:** owner co-design, 2026-10-09. This note records only the decisions S2a-3a adds. Everything else is already ruled in the parent spec, [`2026-09-30-s2a-progress-design.md`](2026-09-30-s2a-progress-design.md): S2-5 (Finished, Reopen), S2-8 (the queue), S2-9 (the expanded row), §4 (one stack with S2a-2), §7 criteria 4 and 5. The parity matrix rows tagged "· S2a-3a" ([`2026-09-30-s2a-parity-matrix.md`](2026-09-30-s2a-parity-matrix.md), 28 rows) and §12.2 (G-14, inline Edit) set the scope. Where this note and the parent differ, this note wins for S2a-3a and the parent is corrected at write-back (§9).

## 1. Scope

S2a-3a ships level 2 for **farm rows**: one row open at a time, opened by a click or `?track=<goalId>`, holding the queue, the drops, the farm's details, Log a drop / I got it with Undo, Copy plan, and the lead's row menu (Edit, Mark finished, Reopen, Delete).

It also closes the halves the S2a-2 plan handed on (`plans/2026-10-08-s2a-2-progress-tab.md:529`): P-17's finished-row expansion, P-19's content, mode and notes, P-33's rank in the queue, P-46 (Mark finished and Reopen, including "Everyone has it · Mark finished"), and the drop's character on display.

**Not in S2a-3a:**
- the tier row's expansion and `?track=tier` (S2a-3b);
- **Change order / Back to automatic** (S2-8 :55): deferred to its own slice after S2a-3a (§2 D-1);
- Schedule a farm night (S2-9 :67): absent until W4 SCHED, as the parent rules;
- phones (S2-15).

## 2. Decisions (owner, 2026-10-09)

| # | Decision | Why |
|---|---|---|
| D-1 | **Change order is deferred** to a small slice after S2a-3a. The automatic queue ships now; leads can still set ranks through the classic view. | Keeps S2a-3a frontend-only and under the cap. Clearing a rank may need a backend change: the participant PATCH treats `null` as unchanged. |
| D-2 | **Copy plan keeps legacy's format, in V2's queue order.** Hidden counts are left out; `free_roll` and `desired_only` follow the queue rules (§3.1). | The pasted list matches what the expansion shows. V1 keeps its own order and its output stays byte-identical (§3.2). |
| D-3 | **Drop Undo keeps re-resolving the chain** (R-S1-14 as built). The stored `recipient_character_id` is not preferred. | The edge (a card or main change between the drop and its Undo) is rare and fails safe: the revert is skipped, never applied to the wrong record. Disclosed as a residual. |
| D-4 | **Layout A.** The panel holds an action bar on top, then three columns: Next in line · Last drops · About. Edit's block goes above the action bar. Mockup: claude.ai artifact `NagngyR4V32ssZjaV5K1cH`. | The action comes first, #1 sits right under it, and the panel stays about six lines so the matrix stays in view. One primary action per region (rule 11). |
| D-5 | **"I got it" is hidden only when the member's cell is Have.** It shows on Need, Want, Pass and blank. | A Pass player can still win a free roll, and the drop should be recordable by them. Legacy lets any non-viewer log their own drop whatever their state. |
| D-6 | **Log a drop is a split button.** The main part reads "Log drop for {#1}" and logs in one click. The ▾ opens a picker: the queue in order, then "Not in the queue" (every other claimed player, in column order), then Nobody, plus an optional note and "Log drop". Under `free_roll` (or an empty queue) the button reads "Log a drop" and opens the picker with Nobody preselected. Mockup: artifact `DinzNGuCGMWiD9EqPXDw14`. | The common case is one click, the button names the recipient before the click, and Undo covers a mistake. |
| D-7 | **Opening a row:** the farm's name cell becomes a disclosure `Button` with a chevron and `aria-expanded`. Player cells keep their picker, so a cell click never opens the row. Enter on the name cell in the keyboard grid toggles it. | Cells are already interactive (S2a-2·F5); one clear target avoids double meaning. |
| D-8 | **`?track=` is written in place** (history replace). An unknown or deleted id is dropped from the URL silently. A finished farm's id expands "Finished (n)" and opens that row. The open row scrolls into view. | Back leaves the page instead of stepping through rows. |
| D-9 | **Mark finished** is one click, from the row menu or from the "Everyone has it · Mark finished" link (leads). A toast offers Undo, which restores the farm's earlier status (Wanted, Farming or Scheduled). The row moves under Finished. | A status change is cheap to undo; a confirm would be friction. |
| D-10 | **Reopen** is one click on a finished row and sets Farming (S2-5), with a toast. | As the parent rules. |
| D-11 | **Delete a farm** uses today's `ConfirmModal` text word for word: title "Delete Goal", message `Delete "{title}"? This will remove all participant states and drop history for this goal.`, label "Delete", danger variant (`RewardGoalDetailModal.tsx:135-141`). No Undo. | Destructive and unrecoverable server-side. |
| D-12 | **Edit:** Save shows a toast; Escape cancels. Opening another row while Edit has unsaved changes asks "Discard changes?" in a `ConfirmModal` first. | One row open at a time must not silently lose a lead's edits. |
| D-13 | **"Show all"** expands in place, for the queue (only when more than four are queued) and for the drops (up to the 50 most recent, the route's limit). | No modal; the matrix stays the page. |
| D-14 | **Deleting a listed drop:** a delete `IconButton` per drop under today's rule (lead or owner: any; member: their own, `createdById`; viewer: none; `DropHistoryPanel.tsx:79`), with today's confirm: `Delete this drop? {recipient ?? 'The recipient'} goes back to {prior state} if it was their only drop.` when the drop carries a prior state, else `Delete this drop?` (`:52-54`). The Undo toast is only for the drop just logged. | Q-1 as answered, kept to today's rule. |
| D-15 | **Drop labels:** a drop in this tier reads "Week n", where n = `currentWeek` minus the whole weeks between the drop and `weekStartDate` (`lootTrackingStore`). A result below 1, or an unknown week, shows a short date ("12 Mar"). | Drops store only a timestamp (S2-9 :63). |
| D-16 | **"I got it"'s toast** reads "Logged as yours · Undo". A lead's log reads "Drop logged for {name} · Undo" (or "Drop logged · Undo" for Nobody). | |
| D-17 | **Copy plan is open to everyone who can see the farm**, viewers included, with a "Plan copied" toast. | The counts it reads are already gated for the reader (R-S1-19). |
| D-18 | **Queue entries** read "{name} · {state} {count}", for example "Healer 1 · Need 12/99". A hidden count shows the state alone ("Need"). | |

## 3. Design

### 3.1 The queue (`utils/progressQueue.ts`, pure)

`queueFor(row, columns, mode)` returns the ordered entries for one farm row:
- **Who:** claimed columns whose cell is Need or Want. Have, Pass, blank and unclaimed columns are out.
- **Order:** Need before Want; within each, the fewest totems first. A hidden count (`null` with `countHidden`) ranks as unknown, after the known counts in its state. Farms with no token cost (drop-only) fall back to roster (column) order within each state. Ties keep column order.
- **Mode:** `free_roll` returns no queue. `desired_only` keeps Need only. `everyone_gets_one`, `priority_order`, `custom` and null use the rule above. `priority_rank` is ignored until Change order ships (D-1).
- It feeds the expansion's list, the split button's #1, the picker's order and Copy plan.

### 3.2 Copy plan (`utils/discordPlan.ts`)

`buildDiscordPlan` moves out of `components/collections/CollectionsHub.tsx:19-56`, unchanged in format, and takes its participant list already ordered. `CollectionsHub` passes its current `priorityRank ?? 999` sort, so V1's text stays byte-identical; a test pins V1's output before the move. V2 passes `queueFor`'s order (D-2) and omits hidden counts. The "Can buy now" line stays (Q-4).

### 3.3 `?track=` (`hooks/useTrackParam.ts`)

Reads and writes `track` through `useSearchParams` with replace (D-8), and registers the param so tab-state cleanup keeps it. `useUrlTabState` needs a fixed value list and can't take goal ids. `ProgressPage` owns the open id: one row at a time, opening one closes the other (subject to D-12).

### 3.4 Components (`components/progress/`)

- **`FarmRow`** gains the disclosure name cell (D-7), the lead's row menu and "Everyone has it · Mark finished".
- **`FarmExpansion`**: the panel, rendered as a row under its farm row whose single cell spans the matrix. Order: Edit's block (when editing), the action bar (Log a drop or I got it, Copy plan), then Next in line · Last drops · About (D-4). A finished row's panel has no drop action.
- **`LogDropButton`** (D-6) and **`IGotItButton`** (D-5).
- **`DropList`**: the last three drops, Show all (D-13), each drop's recipient, character name when it differs from the player's name (the S2a-1 display slice), ×quantity, note, week label (D-15) and delete (D-14).
- **`FarmRowMenu`**: active rows Edit · Mark finished · Delete; finished rows Reopen · Delete. Leads only; members and viewers see no menu (ROLE-1: hidden, not disabled).
- **`FarmEditBlock`**: §12.2's field table, exactly.
- **About** (read-only, every role): content, priority mode and notes (`summary`) (Q-3).

Every control uses the design-system primitives (`Button`, `IconButton`, `Popover`, `ContextMenu`, `ConfirmModal`, `Input`, `Select`); no raw elements.

### 3.5 Data flow

- Logging: `logDrop` (recipient id or null, note). Undo: `deleteDrop` on the returned drop id, which restores the recipient's earlier state through the server's rules (R-S1-14).
- Mark finished / Reopen / Edit: `updateGoal`. Mark finished's Undo: `updateGoal` with the earlier status.
- Delete: `deleteGoal`.
- **Store change (delta (e), additive):** after a drop, a drop delete or a status change, V2 refreshes its read model for that farm (`fetchProgress(groupId, [goalId])`, plus the active list when a farm moves between active and Finished). Today these actions refetch only the legacy participant list. V1's calls behave as before.
- The backend changes nothing. A null recipient is allowed; the drop already stores the recipient's character; the delete route restores the prior state.

### 3.6 Keyboard and the grid (the risky part)

The matrix is an ARIA grid with roving focus (`useMatrixKeyboard`). The panel row sits outside it: arrow keys skip it, and Tab moves from the open row's cells into the panel and on through its controls. Closing the row returns focus to the name cell. Escape inside Edit cancels; Escape elsewhere in the panel closes it. axe must stay at 0 critical and 0 serious in both themes with a row open, the picker open and Edit open (§7 criterion 10).

### 3.7 Errors

A failed write shows the existing error toast and leaves the panel as it was. A failed Undo says so and keeps the logged state. A drop fetch that fails shows "Couldn't load drops" with a retry `Button`; the rest of the panel still renders. A failed delete keeps the confirm open, as legacy does (`DropHistoryPanel.tsx:57-59`).

## 4. Acceptance

The parent's criteria 4 and 5 (the `?track=<id>` half), 10 and 11 apply, demonstrated on the running app with screenshots in light and dark:
1. A lead logs a drop in one click for #1, or picks anyone or Nobody with a note; under `free_roll` the picker opens with Nobody. Undo restores the earlier state, including after a plugin token sync.
2. A member's "I got it" logs for themselves only, is hidden on Have, and their other statics stop queueing them; Undo reverts their record while its `state_changed_at` is unchanged.
3. `?track=<id>` opens that row expanded and in view, a finished farm's id included; an unknown id is dropped.
4. The queue orders Need, then Want, fewest totems first, hidden counts last in their state; `desired_only` shows Need only; `free_roll` shows none.
5. V1's Copy plan text is byte-identical; V2's follows the queue.
6. Edit, Mark finished (with Undo), Reopen and Delete work for leads and are absent for members and viewers.
7. axe clean in both themes with a row, the picker and Edit open; every control is keyboard-reachable.

## 5. Slicing

Four PRs stacked on #375, each with an internal 2.1.72 release item, screenshots and a browser walk; the plan sets the tasks and sizes:
1. **G1 · the models:** `progressQueue`, `discordPlan` (with the V1 pin), the drop-week label, `useTrackParam`.
2. **G2 · the panel:** disclosure, `?track=`, queue, About, Copy plan, drops (Show all, delete), the grid integration (§3.6).
3. **G3 · logging:** the split button and picker, I got it, Undo, the read-model refresh.
4. **G4 · the lead's menu:** Edit, Mark finished with Undo, Reopen, Delete; the slice's e2e, axe, role-gating and contrast.

Then the green `redesign/s2a2-preflight` push run, and the whole stack (#370–#375 plus G1–G4) merges bottom-first (R-S2-1).

## 6. Matrix coverage

All 28 "· S2a-3a" rows ship here: P-22 (queue, §3.1), P-23 and P-27 (About), P-24 (D-7, D-8), P-25 and P-38…P-42 (D-5, D-6, D-16), P-26 (D-2, §3.2), P-28 and P-43…P-51 (`FarmEditBlock`, §12.2; P-43's create half is S2a-4), P-29 (D-11), P-30 (one panel), P-36 and P-37 (D-13…D-15), P-46 and P-99 (D-9, D-10), P-73 (cells, provenance and the queue; "Can buy" retired by Q-4), P-76 (null mode queues as Everyone gets one, §3.1).

## 7. Residuals (disclosed)

- D-3's edge: Undo after a card or main change skips the record revert.
- Quantity and drop date aren't offered (always ×1, now), as today's dialog.
- The drop list shows at most 50 drops.
- `priority_rank` set in the classic view doesn't affect V2's queue until Change order ships (D-1).

## 8. Out of scope

Change order (D-1), Schedule a farm night, the tier row (S2a-3b), Find and custom-farm creation (S2a-4), phones (S2-15, W7).

## 9. Write-back to the parent spec (after the stack merges)

S2-8 :55 gains "deferred to its own slice after S2a-3a (S2a-3a D-1)"; S2-9 gains D-2, D-5, D-6 and D-16; §7 criteria 4 and 5's shipped markers.
