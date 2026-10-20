# Stage 2a · S2a-3b, the tier row in full (V2) — design

**Status:** owner co-design, 2026-10-20. This note records only the decisions S2a-3b adds. Everything else is already ruled in the parent spec, [`2026-09-30-s2a-progress-design.md`](2026-09-30-s2a-progress-design.md): S2-5 (row 1 is the tier, always), S2-6 (the tier row), S2-9 (one open row, `?track=tier`), §5's "Tier BiS" and "Split plan" rows, §7 criteria 5, 10 and 11, and V1 delta (f). The parity matrix rows tagged "· S2a-3b" ([`2026-09-30-s2a-parity-matrix.md`](2026-09-30-s2a-parity-matrix.md), P-108…P-111) and HS-35 #6 (`HOME_STRETCH.md:518`, one BiS definition, answer B) set the scope. Where this note and the parent differ, this note wins for S2a-3b and the parent is corrected at write-back (§9). D-1…D-11 are the owner's; E-1…E-4 are the controller's engineering rulings from the same session; E-5…E-11 are the controller's, added while planning. **Plan-vet, 2026-10-20:** `xivrp-director` PASS with fixes (M1–M4, S6–S10 and its Considers), all folded here and in the plan; the owner answered its five questions the same day as D-7…D-11.

## 1. Scope

S2a-3b ships the tier row in full: one cell per roster column with the BiS count and a three-part bar, the status column ("23/77 BiS slots · Week 11 · 0 of 4 floors cleared"), a read-only slot breakdown per cell with an "Open on board" link (and Alt+Click as the mouse shortcut), and level 2 for the tier: `?track=tier` opens the row into the split plan, the existing `SplitClearPlanner` moved into V2 (D-18 ships here). The split-clear GET gets its active-tier filter (V1 delta (f)), and the light healer token is lifted to AA first (#388).

**Not in S2a-3b:**
- **Change order / Back to automatic** (S2-8 :55; S2a-3a D-1): its own slice, **S2a-3c**, with its own plan (§2 D-1);
- the stored `recipient_character_id` on Undo (S2a-3a D-3): stays a residual;
- Home and Roster ▸ Board adopting the selector: their W4 reworks (E-1);
- any visual or feature-identity rework of the split planner: the holistic list (D-3);
- gear editing on Progress (D-5); phones (S2-15).

## 2. Decisions (owner D-1…D-11 and controller E-1…E-4, 2026-10-20; E-5…E-11 at planning)

| # | Decision | Why |
|---|---|---|
| D-1 | **Two slices.** S2a-3b is the tier row in full, the split plan, `?track=tier` and the split-clear GET's tier filter. **Change order** (S2a-3a's carried D-1) becomes **S2a-3c**, with its own plan later. It needs a way to clear a rank (the participant PATCH treats `null` as unchanged through `unset_if_none`, `backend/app/services/collection_records.py:379`, used at `routers/collection_goals.py:881,1066`), an order UI (V1 has none) and `queueFor` (`frontend/src/utils/progressQueue.ts:38`) honouring a pin. The stored `recipient_character_id` on Undo (S2a-3a D-3) stays a residual. | Keeps S2a-3b to one backend change and the tier row; Change order is a separate design with a backend change of its own. |
| D-2 | **The cell number counts done only.** "6/11": a tome slot is done only once augmented (`isSlotComplete`, `utils/calculations.ts:109-124`). The bar has three parts, **done · needs augment · to go**, in the player's role colour. A player with no BiS targets shows "No BiS set". The total uses `relevantGear` (an empty off-hand counts only for PLD, `utils/offhand.ts:24-35`, `gamedata/jobs.ts:29`), as `playerBisProgress` does (`utils/playerBisProgress.ts:20-28`). | HS-35 #6 B: two quantities, one bar. The number agrees with the roster card's (`RosterCard.tsx:609`) and the Board's (`GearBoard.tsx:132`), which already read `playerBisProgress`. |
| D-3 | **The split plan mounts the existing `SplitClearPlanner`** (`components/split-clear/`, unchanged) inside the tier row's expansion panel. Its visual and feature-identity rework goes to the holistic list (as #391 holds S2a-3a's). | D-18 ships with no change to a component V1 still mounts (`pages/GroupViewContent.tsx:976-984`). |
| D-4 | **Unclaimed columns show their card's BiS cell, dimmed, and count in the status total.** "Not on the roster" and "Card not set up" columns show an empty cell and don't count. | An unclaimed card still has gear and BiS; a member with no card has none to show. |
| D-5 | **A tier cell opens a read-only slot breakdown** on click or Enter: done / needs augment / to go, by slot name. **Alt+Click** jumps to that card on Roster ▸ Board (the Phase D convention: jumps are Alt+Click only, never a plain click). No gear editing on Progress. | The cell answers "which slots?" in place; gear is edited where it lives. |
| D-6 | **#388 lands first, as its own small PR:** the light `--color-role-healer` (#1a8a4a, 4.39:1 on white) is lifted to ≥ 4.5:1, and the v2 loot light contrast e2e goes green. | The tier row paints role colour on every column; the token debt is shared and older than S2a. |
| D-7 | **Substitutes keep their own cell but are excluded from the status total** (plan-vet Q1), as `bisSlotTotals` excludes them (`utils/rosterReadiness.ts:60`). | The total answers "how far is the raiding eight", and matches Home's filter. |
| D-8 | **The keyboard and AT route to the jump is the breakdown** (plan-vet Q2): the read-only popover (click or Enter) carries a visible **Open on board** link. Alt+Click stays the mouse shortcut. No context menu, no Shift+F10. | One visible, explicit path; Chrome's keyboard click carries no `altKey` (`LogWeekGrid.tsx:97-104`). |
| D-9 | **Under the "reset" tab memory the jump lands on Roster ▸ Cards** (plan-vet Q3), highlighted. `GroupViewContent`'s `?player=` effect (`pages/GroupViewContent.tsx:248`) stays byte-for-byte; a residual until D1. | V1 stays frozen; the default "remember" lands on the Board. |
| D-10 | **After its first open the split panel stays mounted, hidden,** while the tier row is collapsed or a farm row is open (plan-vet Q4), as V1 keeps the planner mounted behind `hidden` (`GroupViewContent.tsx:975-984`). A draft survives a collapse and re-open. | The planner's draft lives in component state (`SplitClearPlanner.tsx:26`); unmounting would lose it. |
| D-11 | **Guests see the BiS cells and "x/y BiS slots · Week n"** (plan-vet Q5). The floors part and the split plan stay hidden (they need member-only requests); guests make no new request. | The roster's gear is already public to a share-code visitor; nothing new is fetched. |
| E-1 | **One pure selector, `tierBisCell(player) → { done, needsAugment, toGo, total, hasTargets }`**, in `utils/tierBis.ts` beside `utils/progressModel.ts`. Home (`utils/rosterReadiness.ts:59`, `bisSlotTotals`) and the Board adopt it in their own W4 reworks; no call site outside Progress changes now. | S2-6's "one helper": the three numbers agree once each surface adopts it. |
| E-2 | **The status column** reads "23/77 BiS slots · Week 11 · 0 of 4 floors cleared". Floors come from `computeWeeklyLootSummary` (`hooks/useWeeklyLootSummary.ts:28`). `ProgressPage` gains a page-ledger fetch gated on the tier and week, as Home does (`components/home/Home.tsx:156-161,174-178`). The helper's "cleared" reads the page ledger only (`:35-39`); the loot log feeds only `dropCount`, so Progress fetches no loot log (§3.3). | The weekly question in one line, from the same source as Home's card. |
| E-3 | **`?track=tier`** is special-cased before the goal-id effect that would drop it (`components/progress/ProgressPage.tsx:253-256`); the param is `useTrackParam`'s (`hooks/useTrackParam.ts:17`). **Split clears on:** the row expands into the planner; V2 must start fetching split-clear, which today only V1's roster tab does (`GroupViewContent.tsx:355-365`, gated on `!hasRosterSlot`). **Off** (`settings.splitClearMode`, read through the GET's `enabled`): a lead expands into a V2 "Turn on split clears" off-state that calls the store's settings PUT (`toggleMode`, `stores/splitClearStore.ts:65-78`); a member gets no expand control and `?track=tier` is cleared. | The planner's own off-state (`SplitClearPlanner.tsx:33-63`) is V1's "Enable split planning" card; V2 owns its copy. |
| E-4 | **Backend:** `get_split_clear` (`backend/app/routers/split_clear.py:217`, query `:226-228`) joins `snapshot_players.tier_snapshot_id` to the static's active tier. The response shape is unchanged (plugin contract: `XIVRaidPlannerPlugin/Api/RaidPlannerClient.cs:393` reads it). PATCH, reset-week and the settings write stay static-scoped. One public release-note item: the classic Split Planner and the plugin's overlay now show only the current tier's assignments. | The docstring (`:222`) already promises "for the active tier"; earlier tiers' rows no longer count as existing. |
| E-5 | **The tier row moves into the matrix** as its first body row (`<tr data-testid="progress-tier-row">`), so its cells sit under the player columns. The matrix renders whenever a tier is selected: with no farms (DEVTST), while farms load (the "Loading farms…" line moves below the matrix) and after a first-load failure (the error line stays; the tier row needs no collection data). **Guests** (no role) get the same matrix holding the tier row alone (D-11), above the members-only card, with no new request (R-S2-19; `e2e/guest.spec.ts`'s 401-free walk). The header "Farm" and the region's "Farms by player" label and caption (`ProgressMatrix.tsx:184,190,195`) become "Track" and "Tracks by player". | S2-5 "row 1 is the tier, always" in the same table. |
| E-6 | **The Status column joins the keyboard grid** (`STATUS_KEY`, between the name, or a lead's menu, and the players) on every row. The tier row's status cell holds **Open board** as its one control, now a `Button variant="link"` (`components/primitives/Button.tsx:52`, which forwards its ref and props; `ui/LinkText` forwards neither, `ui/LinkText.tsx:12-64`), with `aria-describedby` pointing at the status text. A farm row's status cell is a focusable read-only cell. "Week n" moves from the tier's name cell into the status text. A lead's menu column has an empty focusable cell on the tier row. | `useMatrixKeyboard` moves by index and stops at a column with no registered element (`useMatrixKeyboard.ts:102-110`), so every key column needs a cell on every row, and one control per cell keeps one Tab stop. No `ui/` or `primitives/` file changes. |
| E-7 | **The status total** sums the cells that count: claimed and unclaimed columns (D-4), substitutes excluded (D-7). A "No BiS set" cell adds to neither number; with none set anywhere the part reads "No BiS set". The floors part (members only, D-11) shows only once this mount's ledger fetch for (static, tier) has returned and the week is known; the entries are copied into local state on resolve, keyed by tier; a failed fetch omits the part, with no toast. | The ledger slice is shared and unkeyed (`stores/lootTrackingStore.ts:54`), and a late response for another tier can land in it (`:197-200`), so only this mount's copy counts. |
| E-8 | **The split plan belongs to the active tier.** The expand control and `?track=tier` exist only when the shell's selected tier is the active one (`TierSnapshot.isActive`). `?track=tier` is cleared only once a tier is known and isn't active (`tier !== null && !tier.isActive`): on a cold load `tier` is null at first (the shell picks it after `fetchTiers`, `pages/NewShell.tsx:303-317`), and the id waits for it. | The GET returns the active tier's assignments only (E-4); a past tier's players would match none. |
| E-9 | **The jump** is `onNavigate('roster', { rview: 'board', player: <id> })`, the Loot precedent's `?player=` (`components/loot/Loot.tsx:857-869`), from Alt+Click on a cell or the breakdown's **Open on board** link (D-8). The Board has no landing today: its row has no anchor and no highlight (`components/roster/GearBoard.tsx:236`; Roster passes `highlightedPlayerId` to the Cards only, `Roster.tsx:569-597`). S2a-3b gives the Board's row the `player-card-{id}` anchor that `GroupViewContent`'s `?player=` effect scrolls to (`pages/GroupViewContent.tsx:243-256`) and the highlight. The cell's cursor turns to a pointer only while Alt is held (`hooks/useAltHeld.ts:11`). | Alt+Click stays the only pointer shortcut; the link is the visible path. |
| E-10 | **The settings PUT's response lists the same filtered assignments** as the GET (one helper); the write itself stays static-scoped (E-4). This reaches V1 too: the "Enable split planning" card and the setup wizard (`components/wizard/SetupWizard.tsx:71`) load that response into the store, so V1 delta (f) names it. | Its response replaces the store's data (`splitClearStore.ts:72-73`); unfiltered, turning split clears on would load earlier tiers' rows into the planner. |
| E-11 | **V2's split-clear fetch** runs in `ProgressPage` for members and viewers when the selected tier is active, keyed on (member, static, `tier?.isActive === true`), and again on a return to the tab (`useVisibilityRefresh`, as V1's `GroupViewContent.tsx:368-375`). `ProgressPage` keeps the last settled result locally, `{ groupId, enabled, failed }`: set after `await fetchData` (failed = `getState().data === null`, never the store's `error`, which `toggleMode`, `updateAssignment` and `resetWeek` also write, `splitClearStore.ts:75,98,124`) and after a successful toggle. The panel reads that result, not the store's `data`, so a refresh, which blanks `data` first (`:54`), never closes or unmounts the open planner. | The store is shared and unkeyed; the planner returns null while `data` is null (`SplitClearPlanner.tsx:29`), so it is shown only when settled and stays mounted across refreshes. |

## 3. Design

### 3.1 The selector (`utils/tierBis.ts`, pure)

`tierBisCell(player)` reads `relevantGear(player.job, player.gear)` and counts each relevant slot once:
- **done:** `isSlotComplete(slot)`;
- **needs augment:** not done, `hasItem`, and `requiresAugmentation(slot)` (`calculations.ts:81`) with `isAugmented` false;
- **to go:** every other relevant slot (no `bisSource`, or not had);
- `total` = `relevant.length || 11` (as `playerBisProgress`); with no relevant slot (the fallback) `toGo` = 11; `hasTargets` = any relevant slot with a `bisSource`.

The counts are computed directly, not as the breakdown's list lengths (those are 0 under the fallback). So `done + needsAugment + toGo === total`, and `done` and `total` equal `playerBisProgress`'s `completed` and `total` for every player (a test pins it). `tierBisBreakdown(player)` returns the three slot lists (`GearSlot[]`, in gear order) for the popover. `tierBisTotals(cells)` sums the counted cells (E-7), and `tierStatusText({ totals, week, floors })` builds the status line.

### 3.2 The row (`components/progress/TierRow.tsx`, in the matrix)

- **Name cell** (rowheader): the tier name. With the split plan available (§3.5) it is a disclosure `Button` (chevron, `aria-expanded`, `aria-controls`), like a farm's (S2a-3a D-7); otherwise a focusable plain cell. It is the grid's `'__name'` cell on row `TIER_ROW_ID` (`'__tier'`, never a goal id).
- **Menu cell** (leads): empty and focusable (E-6).
- **Status cell:** the status text and **Open board** (`Button variant="link"`, `aria-describedby` the text; E-6).
- **Player cells** (one per column, D-4):
  - claimed: "6/11" over the three-part bar in the column's role colour; "No BiS set" when `hasTargets` is false;
  - unclaimed: the same, dimmed (the column header already reads "Claim to track");
  - substitutes: their own cell, out of the total (D-7);
  - Not on the roster / Card not set up: an empty focusable cell, out of the total.
  - Each non-empty cell is a `Button` whose accessible name is "{player}, {tier}, {done} of {total} BiS slots done[, {n} need augment]" (or "…, no BiS set"), opening the breakdown (§3.4).
- **The bar** is a progress-local component (`TierBisBar`): three segments, done at full role colour, needs augment at the role colour's tint with a pattern so it never reads by colour alone, to go on the track. It is decorative (`aria-hidden`); the cell's name carries the numbers. `ui/ProgressBar` has one fill, so it isn't extended.

### 3.3 The status column and the ledger

`ProgressPage` fetches the page ledger (`fetchPageLedger(group.id, tier.tierId)`) for members when a tier is selected, keyed on (static, tier). On resolve it copies the store's entries into local state with that key (E-7). It passes `getTierById(tier.tierId)?.floors`, an empty loot log and the copied ledger to `computeWeeklyLootSummary` with the resolved week; "k of N floors cleared" counts `cleared`. Parts are omitted while unknown: no week → no "Week n" and no floors; ledger not settled, failed, or a guest → no floors. Viewers get the floors (the ledger carries no count).

### 3.4 The breakdown and the jump

- **Click or Enter** opens a `Popover` named "{player} · BiS slots": a heading "{done}/{total} done", then "Done", "Needs augment" and "To go", each listing slot names (`GEAR_SLOT_NAMES`, `types/index.ts:518`) and omitted when empty; "No BiS set." when `hasTargets` is false; then the **Open on board** link (D-8), which jumps (E-9). No other control besides close; Escape closes it and returns focus to the cell.
- **Alt+Click** never opens the popover: it jumps. A plain click never jumps.
- Every role, guests included (D-11), sees the breakdown and can jump.

### 3.5 `?track=tier` and the expansion (`components/progress/TierExpansion.tsx`)

- **When the row can open:** the selected tier is active (E-8), the reader is a member or viewer, this mount's split-clear result for this static has settled (E-11), and either split clears are on (everyone) or the reader is a lead (`canManage && userRole !== 'viewer'`, the PUT's `require_can_edit_roster`). A failed result leaves the row openable, with the error inside (§3.7). Guests get no expand control (D-11).
- **`?track=tier`** opens it once those hold. While `tier` is null or the fetch is in flight the id is kept. When it settles: openable → open and scroll into view (S2-9); not openable (a member with split clears off, or a known past tier) → `?track` is cleared. The goal-id drop effect skips `'tier'` (E-3). One row open at a time: opening the tier closes a farm and the reverse, through the same dirty-Edit guard (`askToDiscard`, `ProgressPage.tsx:296-318`); `toggleRow` compares against the effective open row (`ProgressPage.tsx:325` compares `openId`, which is a goal id only), so clicking the open tier row closes it. A static switch clears it as it clears a goal id (`:266-271`).
- **The panel** is a row after the tier row whose one cell spans the matrix (`progress-tier-expansion`), outside the grid's rows, laid out at the scroller's width (`viewWidth`, as `FarmExpansion` takes it: `FarmExpansion.tsx:72,150`, `ProgressMatrix.tsx:144,174`), with the S2a-3a Escape filter (`panelEscape.ts`). After its first open it stays mounted and is hidden (`hidden`) while collapsed or while a farm is open (D-10). It holds:
  - **on:** `<SplitClearPlanner groupId players canEdit={canManage} />`, unchanged (D-3), with `players` = the tier's configured non-substitute players in Board order (V1 passes `mainRosterPlayers`, `GroupViewContent.tsx:447-449`). Its heading reads "Split Clear Composer" (`SplitClearPlanner.tsx:130`, or `SplitClearEmptyState.tsx:64` with no assignments yet); its assignment board renders only with assignments or after a draft (`:71`);
  - **off, lead:** "Split clears are off. Plan a main and alt run for each card." and a primary `Button` **Turn on split clears**, which calls `toggleMode(group.id, true)`; on success the planner mounts in place and a toast reads "Split clears on"; on failure an error toast, and the panel stays. No UI on Progress turns split clears off (the classic view and the setup wizard keep theirs);
  - **loading:** "Loading the split plan…"; **failed:** "Couldn't load the split plan" with a Retry `Button`.

### 3.6 Backend (H1)

A helper `_active_tier_assignments(session, group_id)` selects `SplitClearAssignment` joined to `SnapshotPlayer` and `TierSnapshot`, where the assignment's and the tier's `static_group_id` are this static and `TierSnapshot.is_active` is true (the join `_load_player_characters` already uses, `split_clear.py:110-117`). The GET and the settings PUT's response use it (E-10). No active tier → no assignments, `enabled` as stored. PATCH, reset-week and mark-run-cleared are unchanged (E-4). No migration; `database.py` untouched. `authz_matrix.py` is unchanged (no new or changed mutation route).

### 3.7 Keyboard, focus and errors

- The grid's rows are `['__tier', ...active goal ids]`; its columns `['__name', '__menu'?, '__status', ...players]`. The grid's one Tab stop is the tier's name cell until a cell is focused; arrows cross from the tier row into the farms and back. The tier panel row sits outside the grid, as a farm's does; Tab from the open row enters it.
- Escape: the breakdown popover and the planner's own layers close themselves; Escape elsewhere in the tier panel closes it and returns focus to the tier's name button.
- axe 0 critical / 0 serious in both themes at 1440 with the tier row at rest, a breakdown open and the tier panel open (on, and the lead's off-state).
- A failed ledger fetch drops the floors part only. A failed split-clear fetch shows the panel's error and Retry. A failed toggle keeps the off-state with an error toast. The breakdown has no write, so no error.

## 4. Acceptance

The parent's criterion 5 (the `?track=tier` half and the D-18 ship marker), 10 and 11, demonstrated on the running app with screenshots in light and dark:
1. The tier row is the matrix's first row for every reader, farms or not: each claimed column reads "n/m" over a three-part bar in its role colour, an unclaimed column the same dimmed, a Not-on-the-roster column empty; a player with no targets reads "No BiS set".
2. The numbers agree with `playerBisProgress` for every player (the roster card's and the Board's).
3. The status column reads "{done}/{total} BiS slots · Week n · k of N floors cleared", substitutes out of the total, the floors from the page ledger; parts drop out while unknown; a guest reads "x/y BiS slots · Week n" and makes no new request.
4. Click or Enter on a cell opens its slot breakdown, whose **Open on board** lands on that card on Roster ▸ Board, scrolled and highlighted; Alt+Click does the same; a plain click never jumps.
5. `?track=tier` opens the tier row into the split planner when split clears are on, for every member and viewer, including on a cold load; a lead with them off sees "Turn on split clears" and, after it, the planner; a member with them off sees no expand control and the param is cleared; a past tier never opens; a draft survives a collapse and re-open, and a return to the tab.
6. The classic Split Planner and the plugin overlay show only the active tier's assignments (pytest; the plugin's response shape unchanged).
7. The light healer token clears 4.5:1 on all four light surfaces and the v2 loot light contrast e2e passes (P0).
8. axe clean in both themes with the row, a breakdown and the panel open; every cell keyboard-reachable; V1 renders byte-for-byte except delta (f) and #388's colour.

## 5. Slicing

The design's cut; the plan (`plans/2026-10-20-s2a-3b-tier-row.md`) sizes it under the cap:
1. **P0 · #388**, the healer token (own PR, merges alone).
2. **H1 · the GET filter** and pytest (merges alone when it passes).
3. **H2 · the selector** and the status text (pure).
4. **H3 · the row:** the tier row in the table (outside the grid's rows), cells, bar, status column, the ledger, guests.
5. **H3a · the grid:** `TIER_ROW_ID`, `STATUS_KEY` and every grid-test rewrite.
6. **H3b · the breakdown:** the popover with Open on board, Alt+Click, the Board's landing.
7. **H4 · level 2:** `?track=tier`, the panel, the planner mount, the off-states, the split-clear fetch.
8. **H4b · the proof:** e2e, axe, role gating, contrast, shots.

The owner's cut named H3 (cells to Alt+Click) and H4 (level 2 plus e2e); each estimates over ~1,500 lines whole, so H3 ships as H3, H3a and H3b and H4 as H4 and H4b from the start, as S2a-3a's G2b and G5b did. H2…H4b stack on `main` and merge together, bottom-first, after a preflight on the whole stack.

## 6. Matrix coverage

All four "· S2a-3b" rows ship here: P-108 (Roster ▸ Split Planner sub-tab → the tier row's expansion, `?track=tier`; D-18 ship marker), P-109 (More ▸ Split Planner quick action → the same), P-110 (the planner body moved unchanged, D-3; the GET filtered, E-4), P-111 (split planning off: "Turn on split clears" for leads, no expand control for members, E-3). V1 keeps its own entries until D1.

## 7. Residuals (disclosed)

- D-1: Change order waits for S2a-3c; `priority_rank` set in the classic view still doesn't affect V2's queue. S2a-3a D-3's stored-character edge stays.
- The planner inside the panel keeps V1's look and copy ("Split Clear Composer"; its own Enable card never shows in V2) until the holistic review (D-3).
- Home's BiS bar (`bisSlotTotals`: "obtained" = `hasItem` on target slots) and the tier row's status total (done only) can differ until W4 HOME adopts the selector (E-1); both now exclude substitutes (D-7).
- D-9: under the "reset" tab memory a jump lands on Roster ▸ Cards, highlighted, not the Board: `GroupViewContent`'s `?player=` effect calls `setPageMode('roster')` again (`:248`), which clears `rview` in that mode (`hooks/useGroupViewState.ts:333-334`). V1's file stays byte-for-byte until D1.
- The mark-run-cleared and reset-week routes still touch every assignment of the static, earlier tiers' included (E-4); the filtered reads no longer show them.
- Progress has no "turn split clears off"; leads use the classic view or the setup wizard.
- Phones: the matrix scrolls sideways (S2-15).

## 8. Out of scope

Change order (S2a-3c), gear editing on Progress, the planner's rework (holistic), Home's and the Board's adoption of the selector (W4), Find and Home's pointers including the split attention row (S2a-4), phones (W7).

## 9. Write-back to the parent spec (after the stack merges)

S2-6 :37-41 gains D-2 (done-only number, the three-part bar), D-4 and D-7 (who counts), D-5 and D-8 (the breakdown, Open on board, Alt+Click), D-10 (the planner stays mounted), D-11 (guests), E-6 (Status in the grid, Open board in the status cell, Week moves there), E-8 (active tier only) and the shipped markers; S2-8 :55 names S2a-3c (D-1); S2-9 :62 gains the tier panel's states (E-3); §5's "Tier BiS" row names `utils/tierBis.ts` (E-1); §7 criterion 5's `?track=tier` half and V1 delta (f) (amended for the settings response, E-10) get their shipped markers; §6 records S2a-3b's PRs.
