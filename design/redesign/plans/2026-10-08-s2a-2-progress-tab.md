# S2a-2 · The Progress tab: the matrix (V2)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo. Each PR below is one slice-loop run: its own ledger, one whole-branch review against its parent branch, one fix wave.

**Goal:** V2 gets its fifth spine tab, Progress, and level 1 of it: the Tracks matrix. Rows are the tier (bare) and the static's farms; columns are the tier's players; each cell is that player's status, explains where it came from, and is editable by its owner, or by a lead in **Edit statuses**.
- `PageMode 'goals'` gets a V2 slot that renders `ProgressPage`. V1's Goals & Farms body is untouched. V2 writes `?tab=progress`; every old alias lands on Progress.
- The bare tier row comes first, so the page is never empty. Active farms follow, ordered by need; finished farms collapse into "Finished (n)".
- A member sets their own status and totem count inline, with an Undo toast. A lead's Edit statuses edits any claimed cell and offers one bulk action, "Mark everyone without a status as Need".
- Three backend additions close S2a-1's carried items: one batched read that also returns record-only cells, an exact Undo for a cell edit or a bulk action, and the bulk route itself. No migration. They ship first, on their own short stack, V1-invisible (vet I-3).

**Spec (binding):** `design/redesign/specs/2026-09-30-s2a-progress-design.md`: S2-3, S2-4, S2-5's farm rows, S2-6's bare tier row ("Bare first", :37), S2-7, the display half of B1 (S2-7 :46, S2-10 :94-104), S2-14's ⌘K label (:144), S2-15, §3, §4, §5's rows for columns and counts, §6's S2a-2 row (:200), §7 criteria 1, 2, 3, 10 and 11, V1 deltas (d) and (e), and "S2a-1 rulings that bind S2a-2…S2a-4" (R-S1-8, -9, -10, -14, -19; :254-269).
**Parity matrix (binding):** `design/redesign/specs/2026-09-30-s2a-parity-matrix.md` (signed 2026-10-01). Its 26 S2a-2 rows are mapped below (§ Coverage), with Q-3's answer (a farm row reads "{title} · {type}" plus a Wanted or Scheduled tag) and the INTERIM rows that leave V2 when the frontend stack merges.
**S2a-1 plan (binding):** `design/redesign/plans/2026-10-01-s2a-1-character-records.md`, its "As built" sections (:782-812) and "Carried, not S2a-1" (:836-851), whose three S2a-2 items are R-S2-11, R-S2-12 and R-S2-13 here.
**Scope (binding).** V2 frontend under a new `frontend/src/components/progress/`, pure helpers in non-ring `frontend/src/utils/` (vet I-5), the shared seam (`GroupViewContent`, `NewShell`, `useGroupViewState`, `Spine`, `CommandPalette`), additive store actions, `toastStore`'s Undo helper, three additive backend routes, additive response fields and two door extensions, `releaseNotes.ts`, `DESIGN_SYSTEM.md` §3.13, `eslint.config.js` and the e2e specs named below. `backend/app/database.py` gets no edits. No migration. **V1 renders byte-for-byte as today except spec §7's (d)** (`?tab=progress` opens Goals & Farms in V1); (e) (new store actions) has no visible effect. V2 is the admin-gated preview; V1 is the default.
**Plugin contract (binding, `CLAUDE.md` § Pitfalls).** The plugin calls none of the routes this plan touches (`collection-goals/*/participants`, the new `collection-participants` family). No plugin route, request field or response field changes.

## Size and stack

Estimates use S2a-1's ratio (tests ran ~65% of the diff, so a task's total is its code lines ÷ 0.35) **times 1.8**, S2a-1's measured overrun (plan :785) (vet I-4). The PR cap is ~1,500 changed lines, plan excluded (slice-loop rule 1). Cut now into nine PRs on two stacks (vet I-3, I-4).

| PR | Slice | Branch · base | Tasks (est. total lines, ×1.8) | Total |
|---|---|---|---|---|
| **Backend stack** (worktree `.claude/worktrees/s2a2b`; merged as each passes) | | | | |
| B1 | **S2a-2·B1** the Progress read API | `feat/s2a2-b1-read-api` · `main` (≥ `924f11d5`) | TB1 the read API (~1,190, **deep**) | ~1,190 |
| B2 | **S2a-2·B2** Undo tokens and the door's restores | `feat/s2a2-b2-undo-tokens` · B1 (`main` once B1 merges) | TB2 tokens, PATCH tokens, door restores (~1,220, **deep, `model: fable`**) | ~1,220 |
| B3 | **S2a-2·B3** the undo route and the bulk Need | `feat/s2a2-b3-undo-bulk` · B2 | TB3 the undo route (~920, **deep**) · TB4 the bulk Need route (~610) | **~1,530** |
| **Frontend stack** (worktree `.claude/worktrees/s2a2`; merges with S2a-3a) | | | | |
| F1 | **S2a-2·F1** the tab | `feat/s2a2-f1-tab` · `main` after B1 merges | TF1 page shell + bare tier row (~610) · TF2 seam, URLs, Spine, ⌘K, contract, e2e retarget (~760, **deep**) | ~1,370 |
| F2 | **S2a-2·F2** the read model | `feat/s2a2-f2-model` · F1 | TF3 store read model + Board sections (~540) · TF4 the matrix model (~860, **deep**) | ~1,400 |
| F3 | **S2a-2·F3** the matrix on screen | `feat/s2a2-f3-matrix` · F2 | TF5 type labels + the matrix render + e2e/axe (~1,220, sole task) | ~1,220 |
| F4 | **S2a-2·F4** provenance and the keyboard | `feat/s2a2-f4-provenance` · F3 | TF6 provenance + roving grid (~940, sole task) | ~940 |
| F5 | **S2a-2·F5** your cell | `feat/s2a2-f5-your-cell` · F4 (after B2 and B3 merge) | TF7 own-cell picker, "Set status", Undo toast (~1,220, **deep**) | ~1,220 |
| F6 | **S2a-2·F6** leads' Edit statuses | `feat/s2a2-f6-edit-statuses` · F5 | TF8 Edit statuses, lead cells, bulk + Undo (~940, **deep**) · TF9 e2e, axe, role gating, contrast (~470) | ~1,410 |

- **Two stacks (vet I-3).** The backend is ~3,900 lines that change nothing V1 renders (new routes, additive fields), so it doesn't wait on the seam. B1 → B2 → B3 stack off `main` and each merges as soon as it passes review and full CI (bottom-first, slice-loop § Stacked PRs). The frontend stack F1 → F6, with S2a-3a's PRs on top, merges together in one session (spec §4 :166, R-S2-1).
- **Order.** B1 first. F1 branches from `main` once B1 has merged (F3's browser walk needs the read API). B2 and B3 run meanwhile in their own worktree. **F5 and F6 need B2 and B3 merged**: when they merge, merge `origin/main` into F1 and up the frontend stack (slice-loop § Stacked PRs' update procedure) before F5 starts.
- **Preflight before the first frontend merge (vet I-3).** Upper stacked PRs get no full CI (slice-loop § Stacked PRs), and **draft PRs get none at all** (`.github/workflows/ci.yml:17-22`). So push S2a-3a's top commit to `redesign/s2a2-preflight`; CI's push trigger runs the full suite on `redesign/**` (`ci.yml:7-9`). Open it as a draft PR to `main` labelled `no-automerge`, for the record only. Merge the frontend stack only after that push run is green on the exact tree, and link the run in F1's body. Close the preflight PR and delete its branch after the merge.
- **The cap.** At each Finish run `git diff --stat <parent>...HEAD`. Over ~1,500 changed lines (plan excluded) → the last task ships as its own PR stacked on top. Don't trim tests to fit. **B3 is at the cap (~1,530):** if it lands over, TB4 ships as B3b. F6 (~1,410) → TF9 as F6b; F2 (~1,400) → TF4 as F2b; F1 (~1,370) → TF2 as F1b.
- **Fewer tasks per slice.** Several PRs carry one or two tasks rather than slice-loop's 3–4; the cap, not the task count, set the cut (vet I-4).

Backend commands use the main checkout's venv (`D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner/backend/venv/Scripts/python.exe`, "`<venv python>`" below), run from `<worktree>/backend`. A new worktree needs `frontend/.npmrc` copied in before `pnpm -C frontend install` (`CLAUDE.md` § CI). **Factories** (`backend/tests/factories.py`): `create_tier_snapshot` :126, `create_snapshot_player` :149, `create_player_profile` :415, `create_player_character` :434, `create_static_character_registration` :512, `create_claimed_card` :545, `create_collection_goal` :616, `create_participant_state` :641, `create_catalog_item` :799; `count_statements` is in `tests/conftest.py:283`.

**Plan-vet:** run 2026-10-08 by `xivrp-director`: APPROVE-WITH-FOLDS, 0 Critical, Important I-1…I-6, Minor M-1…M-8 (`.superpowers/stage2/plan-vet-s2a2.md`). Folded 2026-10-08; each fold is tagged inline. Owner questions Q1–Q4: pending.

**Tests first:** each implementer writes the task's listed tests first and shows them failing for the right reason before any production edit; a new module starts as stubs that raise `NotImplementedError` (backend) or `throw new Error('not implemented')` (frontend). The repo's agents take precedence over `test-author` (S2a-1 plan :43).

**Siblings (2026-10-08).** `gh pr list --state open` is empty at `924f11d5`. The worktrees `authz2`, `guest1`, `s2a1` and `s2spec` are detached and idle. Shared with any later sibling: `releaseNotes.ts`, `HOME_STRETCH.md`, `PRODUCT_MODEL.md`, `GroupViewContent.tsx`. S2a-2 adds no migration, so the Alembic head is untouched.

## Spec premises checked against the code (`924f11d5`, 2026-10-08)

| The spec / brief says | Code says | Ruling |
|---|---|---|
| §4: "`PageMode 'goals'` gets a V2 content slot … as `gear` did for Loot" | **Not wired for it.** `GroupTab` is `'overview' \| 'roster' \| 'gear' \| 'schedule'` (`pages/GroupViewContent.tsx:78`, `slots` typed at `:90`). The goals branch renders its `PageHeader` and `GoalsPage` with no slot fallback (`:1160-1175`); its title is `slots ? 'Tracking' : 'Goals & Farms'` (`:1163`). NewShell passes four slots (`pages/NewShell.tsx:182`) | R-S2-4 |
| §4: "V2 writes `?tab=progress`; … the parser is shared (`useGroupViewState.ts:30-40`)" | The parser (`hooks/useGroupViewState.ts:30-42`) has no `progress`. **The writer is shared and shell-unaware:** `setPageMode` writes `params.set('tab', mode)` (`:314-316`) and the first-render reflect writes `pageMode` (`:495-504`). `useResolvedShell()` (`lib/shellPreference.ts:105-115`) is a pure read the hook can call | R-S2-3 |
| §7 (d): "`?tab=progress` resolves to Tracking in V1 too"; line "Progress links open Tracking in the classic view." | **V1's tab is labelled "Goals & Farms"** (`components/layout/TabNavigation.tsx:26`; header `GroupViewContent.tsx:1163`). "Tracking" is V2's old label (vet M-1) | R-S2-16's line; write-back fixes §7 |
| §4: the Spine gains Progress; the contract (`DESIGN_SYSTEM.md:284`) becomes five tabs | **Confirmed.** `Spine.tsx:17-22` has four; `Spine.test.tsx:32` pins "exactly the 4". `DESIGN_SYSTEM.md` says four in §3.13 (`:284-294`) **and** in §2's spine line (`:83`) | TF2 updates both |
| S2-14: ⌘K "Go to Tracking" → "Go to Progress" | **Confirmed** at `layout/CommandPalette.tsx:137-142`, pinned by `CommandPalette.test.tsx:401-409` | TF2 |
| P-02…P-04, P-10: key 3, the phone bar, the swipe and the `suggestion_vote` link reach `goals` | **Confirmed**, all through `setPageMode` or `?tab=goals`: `useGroupViewKeyboardShortcuts.ts:96` (mounted `GroupViewContent.tsx:506`), `ui/MobileBottomNav.tsx:22-41` (mounted `GroupViewContent.tsx:1261-1267`), `SWIPE_TABS` (`:178-191`), `backend/app/routers/content_suggestions.py:371`. Each lands on the slot with no change | TF2 tests pin them |
| S2-4: "Columns follow Roster ▸ Board order, subs last" | **No shared helper.** `components/roster/Roster.tsx:223-226` sorts with `sortPlayersByRole` and the v2 sort preset that `useRosterSortPreset` hydrates (`:205-209`); `GearBoard.tsx:125-139` keeps configured players and builds labelled sections Light Party 1 · 2 · Unassigned · Substitutes, which it renders as dividers (`:132-138`) | R-S2-6 (vet M-6) |
| S2-4: "the current tier's roster" | The client's current tier is the **selected** tier (`stores/tierStore.ts:821`); the server's chain resolves the claimed card in the **newest active** tier (`services/collection_records.py:217-228`). Same tier unless a past tier is selected | R-S2-6 (disclosed); R-S2-13 (vet M-3) |
| §5: roster columns are a "client join, no API change" | True for columns. But participants load **one goal at a time** (`stores/collectionGoalStore.ts:484-497`; `routers/collection_goals.py:554-608`), and the merge is **rows only** (`merged_participants`, `collection_records.py:810-838`; R-S1-9): a claimed member with a record and no row is invisible to the static | R-S2-13; Q1 |
| R-S1-19: "A hidden count is `null`, never 0" | **`null` means two things:** hidden by the gate, or no count yet (`collection_goals.py:129`). A lead can't tell an unflagged member with no count from a flagged one, so no lead could ever set a member's first count (P-119, S2-7 :48) (vet I-1) | R-S2-13's `count_hidden` |
| R-S1-9: "S2a-2 labels cells from these" response fields | **The client maps none of them.** `ApiParticipant` and `ParticipantStateEntry` (`collectionGoalStore.ts:109-124,244-258`, mapper `:301-317`) stop at `member_role`; the server sends `updated_by_user_id`, `updated_via`, `state_changed_at`, `token_count_updated_at`, `state_from_record`, `count_from_record`, `record` (`schemas/collection_goals.py:146-153`) | TF3; delta (e) |
| S2-7: saves on pick, Undo toast | `upsertMyState`/`upsertStateForUser` return `void` and refetch the whole goal list after each write (`collectionGoalStore.ts:499-541`, `:518`, `:540`); V1 relies on that. No Undo toast exists: only `errorWithRetry` uses `ToastAction` (`stores/toastStore.ts:11-22,73-126`), which `layout/ToastContainer.tsx:62,90-95` renders | New V2 actions (e); `toast.withUndo` |
| Carried: "Undo can't clear a count, or restore a record to absent" | **Confirmed, and more.** Both PATCH routes pass `unset_if_none(body.token_count)` (`collection_goals.py:680,830`). `write_record` reads `token_count=None` as "not given" (`collection_records.py:392,461-462`). `write_row` has no restore stamps and moves `state_changed_at` to `now` on a state change (`:638-655,717-718`), and both doors stamp the caller as writer (`:480-481`, `:722-723`), which decides "correction" in the merge (`:775`). No route deletes a farm row. A response's `state` is the **merged** state (`collection_goals.py:128`), so the client can't rebuild the prior row | R-S2-11 (vet I-2) |
| Carried: the bulk action ("per-member PATCHes, or a new route") | Per-cell PATCHes would each refetch the goal list (`:518`, `:540`): 40 blanks = 80 requests, and 40 Undo tokens | R-S2-12 |
| §5: "Any new or changed mutation route gets its row in `authz_matrix.py`" | The table covers mutation routes only (`tests/test_authz_matrix.py:532-541`); the farm rows, with their own/other variants, are `tests/authz_matrix.py:494-520` (`:503-510`) | R-S2-14 (vet M-4) |
| The record door's guard | `EXPECTED_DOOR_CALLERS` and `DOOR_CALLER_ROUTES` pin every caller of `write_row`/`write_record`/`apply_sync` (`tests/test_provenance_coverage.py:152-194`); `DOOR_FUNCTIONS` is the exact set of in-place writers (`:132-138`) | R-S2-11, R-S2-12 |
| A signed Undo token | Auth JWTs use `jwt_secret_key` and a `type` claim (`app/auth_utils.py:14-45`), and a JWT payload is readable: a lead's token for a flagged member's row would expose the hidden count (B1). `cryptography==50.0.0` is installed (`backend/requirements.txt:30`) and already imported directly (`routers/discord_interactions.py:19-20`) | R-S2-11: Fernet (encrypted, authenticated, TTL) |
| S2-7: "Viewers see the matrix read-only" | **Confirmed** for viewers (`require_membership` passes them, `collection_goals.py:565`). **Spec silent on non-members:** every collection-goals route needs membership (`:255`, `:565`); GUEST-2 gave V1 `MembersOnlyCard` (`group/GoalsPage.tsx:22-34`), and `frontend/e2e/guest.spec.ts:108-109,171-175` expects that card, and no 401/403, on V2 `?tab=goals` | R-S2-19 |
| P-13/P-61…P-71: the catalog leaves V2 (INTERIM) | `frontend/e2e/role-gating.spec.ts:104-130,309-318,355-358` drives V2's catalog at `tab=goals&goal=farms`; it breaks at the seam. The legacy describe (`:365-385`) keeps both Track pins | TF2 retargets (vet M-8) |
| New component folder; S2a-4 reuse | `components/progress/` matches no boundary element (`frontend/eslint.config.js:50-61`); ring3 (`mount-farms\|collections`) may import ring0/ring1 (`:142-146`), but **ring0 (`home/`) may not import ring3** (`:133-135`), and S2a-4's TrackCard (`home/`) reuses the row order (vet I-5). New V2 trees lock design-system rules at error (`recruit/**`, `:250-262`) | R-S2-5 |
| S2-7: "Glyph plus text in every state" | Its own example is "Need 62/99" (S2-7 :44): no Need glyph | R-S2-8 |
| S2-5: "ordered by the number of players who still need them, then by name" | Ambiguous: the Need state, or everyone who doesn't have it yet | Q3; R-S2-7 |
| S2-5: "Everyone has it · Mark finished" | Mark finished is S2-9's row menu, which §6 puts in S2a-3a (P-46) | R-S2-7 (split) |
| Matrix P-33 "rank in the queue (S2-8) · S2a-2"; P-19, P-17 | S2-8 ships in S2a-3a (§6 :201). P-19's content/mode/notes and P-17's finished-row expansion are level 2 (S2-9) | Split; the same merge ships both halves (§ Coverage) |
| View As | V1 passes `currentUserId={effectiveUserId}` (`GroupViewContent.tsx:1168`), but the self PATCH writes the **caller's** row (`collection_goals.py:717-721`): under View As an admin's "my status" writes the admin's own row. Reads are gated as the admin (owner), so a flagged viewed member's own count reads hidden (`count_visibility`, `collection_records.py:1086-1120`) (vet M-7). The API leaves every verb open under View As except two (`backend/app/permissions.py:27-46`, HS-30) | R-S2-10 |
| Farm row "{title} · {type}" (Q-3) | The labels and icons are private to `collections/RewardGoalCard.tsx:7-31` | TF5 lifts them to `utils/` (vet I-5) |
| S2-6: "Week n" | **Confirmed:** NewShell fetches the current week for every tab; Home reads `useLootTrackingStore((s) => s.currentWeek)` (`home/Home.tsx:111-113`). The tier's name is `getTierById(tier.tierId)?.name` (`gamedata/raid-tiers.ts:10-14`) | TF1 |
| R-S1-19: `token_count_updated_at` and `count_from_record` survive the gate | **Confirmed** (`collection_goals.py:108-145`; `_record_view` `:90-105`) | R-S2-9 |
| R-S1-8: a token-only plugin sync restamps the row's writer | **Confirmed** (S2a-1 plan :788) | R-S2-9 |
| S2-4: "Not on the roster" reads the member's main | **Confirmed:** chain step 2 (`collection_records.py:288-289`) | — |

## Rulings (bind every task)

- **R-S2-1 (the stacks; vet I-3).** The backend stack (B1 → B2 → B3) merges as each PR passes. The frontend stack (F1 → F6) and S2a-3a's PRs on top merge together, bottom-first, in one session, only after the `redesign/s2a2-preflight` push run is green (§ Size and stack). If the frontend stack must pause, it pauses with nothing merged. Before its first merge, update the whole stack (slice-loop § Stacked PRs).
- **R-S2-2 (V1).** V1 renders as today except delta (d). The V1 code this plan touches, and how each is pinned. **New test cases go in new files, so every V1 pin file stays unedited** (vet M-2):
  - `GroupViewContent`'s goals branch becomes `slots?.goals ?? (<legacy header + GoalsPage>)`. The fallback keeps its markup; its title becomes the literal `'Goals & Farms'` (the `slots ? 'Tracking'` arm is unreachable once V2 always passes `goals`), and the stale comment at `:1162` goes. Pinned by `GroupViewContent.slots.test.tsx` and `GroupViewContent.canManageRoster.test.tsx`, unedited; new cases in `GroupViewContent.goalsSlot.test.tsx`.
  - `useGroupViewState`: the parser gains `progress` (delta (d)); in the legacy shell the writer still writes `tab=goals`. `useGroupViewState.test.ts` unedited; new cases in `useGroupViewState.progress.test.ts`.
  - `collectionGoalStore`: optional fields, a new `recordOnly` slice and new actions; `fetchParticipants`, `upsertMyState`, `upsertStateForUser`, `logDrop`, `deleteDrop` are byte-identical. `collectionGoalStore.test.ts` unedited; new cases in `collectionGoalStore.progress.test.ts`.
  - `RewardGoalCard` imports its labels and icons from `utils/goalTypeMeta.ts` (same values). `RewardGoalCard.test.tsx` unedited.
  - `toastStore` gains `withUndo`; nothing else changes.
  - Backend: `ParticipantStateResponse` gains `count_hidden` (vet I-1), and the two PATCH responses gain `undo_token`; V1 reads named fields only (`collectionGoalStore.ts:301-317`). The door gains keyword-only parameters that default to today's behaviour.
- **R-S2-3 (URLs, §4 :169-170).** `pageModeFromTabParam` maps `progress` to `goals` (both shells: delta (d)). One helper, `tabParamFor(mode, shell)`, returns `progress` for `goals` when `useResolvedShell() === 'v2'` and the mode otherwise. `setPageMode` and the first-render reflect use it. Recalled tabs stay `goals` (`rememberTab`). `?goal=`, `?farm=` and `?gsub=` are left in the URL and ignored by `ProgressPage` (P-07, P-08, P-09); no V2 surface writes them. `?track=` and `?pview=` are not registered until S2a-3a and S2a-4.
- **R-S2-4 (the seam).** `GroupTab` gains `'goals'`. NewShell builds `const progress = currentGroup ? <ProgressPage …/> : undefined` and passes `slots={{ overview, roster, gear: loot, schedule, goals: progress }}`. `ProgressPage` takes `{ group, tier, canManage, userRole, currentUserId, isViewingAs, onNavigate }`, with `canManage` = NewShell's `canEdit` (owner, lead, admin access) and `currentUserId` = `effectiveUserId` (`NewShell.tsx:116-119`).
- **R-S2-5 (folders and lint; vet I-5).** Components live in `frontend/src/components/progress/` (the Progress Engine is Ring 3, `docs/PRODUCT_MODEL.md` §5). `eslint.config.js`'s ring3 pattern becomes `(mount-farms|collections|progress)`, and `progress/**` gets the `recruit/**` error lock (`:250-262`) for its four design-system rules. **Pure logic any ring may reuse lives in non-ring `utils/`:** `utils/progressModel.ts` (columns, cells, tallies, row order, text) and `utils/goalTypeMeta.ts` (labels; icons as lucide component references, so the file stays `.ts`), so S2a-4's TrackCard in `home/` (Ring 0) can import them. Everything follows `CLAUDE.md` § UI rules: `Button`/`IconButton`, `LinkText` for navigation, `Tag variant="label"`, `NumberInput`, `Popover`, `Tooltip`, `PageHeader`; semantic tokens only; `text-xs` floor; no raw `<button>`, `<input>`, `<label>`; no modal for any edit; no sticky column (`CLAUDE.md` § Product rules); left-aligned in the 120rem layout.
- **R-S2-6 (columns, S2-4).**
  - **The tier is the shell's selected tier** (`useCurrentTier`), as on every other spine tab. When a past tier is selected, its roster gives the columns while the server's merge still reads each member's active-tier card. Disclosed in F3's body; the cell value is the member's either way, because status is per user.
  - **Order (vet M-6):** `boardSections(sortedPlayers)` (new, `utils/calculations.ts`, beside `groupPlayersByLightParty`) returns the labelled sections Light Party 1 · 2 · Unassigned · Substitutes of configured players. `GearBoard` renders its dividers from it; Progress flattens it. `sortedPlayers` is `sortPlayersByRole(players, SORT_PRESETS[preset].order, preset)`, with the preset hydrated through `useRosterSortPreset` read-only (never `persistPreset`).
  - **Claimed** column: a configured player with a `userId`. **Unclaimed:** no `userId`; dim, labelled "Claim to track" (a `Tag variant="label"`, not a control), no cells.
  - **Not on the roster:** a participant row's user who has no claimed player in this tier, whose `memberRole` is set and isn't `viewer` (former members' rows stay hidden). Trailing columns, by display name. Record-only cells never create one.
  - Each column header: `JobIcon`, position, name in `text-role-{role}`.
- **R-S2-7 (rows, S2-5).**
  - **Tier row first, always.** In S2a-2 it is one full-width row: tier name, "Week n" (omitted while the week is unknown) and **Open board** (`LinkText`, `onNavigate('roster', { rview: 'board' })`). No empty player cells and no stub text: S2a-3b adds its cells and status column.
  - **Active farms** (`wanted`, `farming`, `scheduled`) follow. **Per the recommended answer to Q3; revisit if the owner rules otherwise:** ordered by the number of claimed columns whose cell is **Need**, descending, then by the number whose cell is **Want**, descending, then by title (`localeCompare`, base sensitivity). One exported comparator, `compareFarmRows` in `utils/progressModel.ts`, so S2a-4's TrackCard reuses it (S2-12: "the card and the first farm row always agree").
  - A farm row reads "{title} · {type}" with its type icon, plus `Tag variant="label"` "Wanted" or "Scheduled" when it isn't Farming (Q-3).
  - **Status column:** "{n} of {m} have it". m = claimed columns not on Pass; n = those whose cell is Have (record-only Haves included, Q1). Unclaimed and Not-on-the-roster columns count in neither (vet M12). m = 0 reads "Nobody to track yet". When n = m > 0, leads read "Everyone has it"; S2a-3a adds "· Mark finished" and the row menu.
  - **Finished (n):** `complete` goals, most recently completed first, collapsed under a `Button` with `aria-expanded`. Expanding fetches their cells (`goal_id=`) and shows the same rows, read-only. Reopen is S2a-3a's.
- **R-S2-8 (cells, S2-7 :44).**
  - Text: Have "✓ Have"; Need "Need 62/99"; Want "★ Want" or "★ Want 30/99"; Pass "– Pass"; blank: nothing (one's own blank cell shows "Set status" from F5 on, R-S2-10). The count shows on Need and Want only, as "{count}/{tokenCost}", or "{count}" when the goal has no cost. **Need's word is its glyph**, as the spec's own example; no state is told by colour alone.
  - A cell is the row's merged entry; else a record-only Have (Q1); else blank.
  - **Hidden counts (B1) are told by `countHidden`, never by `tokenCount === null`** (vet I-1): a hidden cell shows the state alone; a cell with `countHidden = false` and no count simply has none yet. Viewers see states only.
  - Accessible name: "{player}, {track}, {state}[, {count} of {cost} {tokenName}]"; blank → "no status"; unclaimed → "unclaimed".
- **R-S2-9 (provenance, S2-7 :47; B2, B10).** A pure `cellProvenance(entry, { viewerUserId, nameOf })`, shown on hover and focus. The side is the record when `stateFromRecord`, else the row.

  | Side's writer and channel | Label |
  |---|---|
  | `updated_via = 'api_key'` | "plugin, {relative time}" (B10) |
  | writer = the viewer | "you" |
  | writer = the member | "self-reported" |
  | writer set, not the member (row only) | "set by {name}" |
  | writer NULL, channel set (Track's derived seed, R-S1-8) | "added when tracked" |
  | writer and channel NULL (before S2a-1) | by `source`: plugin → "plugin"; player_hub → "from the Hub"; manual → "recorded earlier" |

  - The time is the side's `state_changed_at` (the record's `last_synced_at` when that is NULL), never `updated_at` or `token_count_updated_at`.
  - When the count is shown and `countFromRecord !== stateFromRecord`, a second line labels the count's side the same way, timed by `token_count_updated_at`. **A hidden count gets no line and no time** (R-S1-19: those fields survive the gate).
  - A token-only plugin sync restamps a row's writer (R-S1-8), so a lead's correction can then read "plugin". Accepted and disclosed: a per-field writer is a backend change outside S2a-2.
- **R-S2-10 (who edits what, S2-7).**
  - **A member** (owner, lead or member role) edits their own cell wherever it appears, Not-on-the-roster included, through the self route: Have, un-Have and the count reach their record (R-S1-10). **Their own blank cell shows a muted `text-xs` "Set status"** inside its button, because B5 makes a blank own cell the commonest first edit (vet I-6).
  - **A lead in Edit statuses** edits every claimed cell on active rows: their own through the self route, another's through the lead route (a correction). Not-on-the-roster cells of others stay read-only ("every claimed cell", S2-7 :48). **The count field shows unless `countHidden`** (vet I-1): a lead can set an unflagged member's first count; a flagged member's cell keeps its state editable and has no count field.
  - **Finished rows are read-only** for everyone (Reopen first, S2a-3a), and the bulk action skips them.
  - **Viewers and non-managers** get no lead control: hidden, not disabled (ROLE-1). Viewers edit nothing.
  - **Under View As** the matrix renders as the viewed user sees it. An edit to "their own" cell goes through the lead route aimed at the viewed user (the admin has owner access, HS-30), so the admin's own row is never written by mistake. It reads "set by {admin}". **Reads stay gated as the admin**, so a viewed member who hides their counts shows "hidden" even on their own cell (vet M-7). Both disclosed in F5's body.
  - **A count can't be cleared from a cell**, as in the API (`None` = unchanged); 0 is a count. Undo restores a missing count (R-S2-11).
- **R-S2-11 (Undo, carried item 2; vet I-2, M-4).**
  - **A token per write.** Both PATCH routes, and the bulk route, return `undo_token`: a Fernet token (`cryptography.fernet`; key = urlsafe-base64 of HMAC-SHA256(`settings.jwt_secret_key`, `b"participant-undo"`)), encrypted and authenticated, valid 10 minutes. It holds the static, the actor and, per cell, the goal, the user, the row's prior (or "absent") and the row's `updated_at` after the write, plus, when a record was written, the record's id, its prior (or "absent") and its `updated_at` after. Priors carry `state`/`ownership_state`, `token_count`, `state_changed_at`, `token_count_updated_at`, `source`, **`updated_by_user_id` and `updated_via`** (vet I-2), plus the row's `last_manual_override_at` and the record's `confidence`. Encryption keeps a flagged member's prior count away from the lead holding the token (B1). It can't pass `verify_token` (`auth_utils.py:38-45`).
  - **Minted before commit (vet M-4).** Every PATCH mints its token after the flush and before the commit, V1's included (V1 ignores the field). If minting fails, the response carries `undo_token: null` and the write still commits: a token failure never turns a saved edit into an error.
  - **One route restores:** `POST /api/static-groups/{group_id}/collection-participants/undo`, body `{ "token": … }`. **The role check runs first** (a viewer gets 403 before the token is read; vet M-4); then the caller must be the token's actor, in the token's static, still holding the role the original write needed (member for one's own cells, lead for another's).
  - **Per part, only if unchanged since:** a part is restored only when its current `updated_at` equals the token's "after" (every door write moves `updated_at`). Otherwise that part is skipped (R-S1-14's spirit: never overwrite a later write). The response is `{ restored, skipped }`.
  - **Exact values, the writer included. Per the recommended answer to Q4; revisit if the owner rules otherwise.** A prior "absent" row is deleted; a prior "absent" record is deleted. Otherwise state/ownership, count (`None` included), `source`, both timestamps **and the prior writer and channel** return to their prior values, so the merge (whose "correction" test reads the writer, `collection_records.py:775`) and the labels show exactly what they showed before. The restore passes the token's prior writer and channel as the door's `actor_user_id=` and `via=`. **R-PV-2's intent holds:** a channel is never taken from the client; these are values the server wrote, carried in a token the client can neither read nor forge. The route logs the undo itself (`participant_undo`, with the undoer and `logged_via(request)`).
  - **Door changes** (`collection_records.py`): `write_row` gains `restore_state_changed_at=` and `restore_token_count_updated_at=` (UNSET by default); `write_record` gains `restore_token_count=` (sets the count exactly, `None` clears) and `restore_token_count_updated_at=`; new `delete_row(db, row)` and `delete_record(db, record)`. Only the undo route passes the restore keywords (an AST test asserts it).
  - **Client:** the toast offers Undo for 8 s; Undo calls the route, then refetches the matrix. A skip toasts "Couldn't undo: it changed since".
- **R-S2-12 (the bulk Need, carried item 3; Q2).** `POST /api/static-groups/{group_id}/collection-participants/mark-need`, lead and above, body `{ "cells": [{ "goal_id", "user_id" }] }` (1–200). The client sends exactly the blank claimed cells it shows on active rows (Q2). The server creates a `need` row for a cell only when the goal is in this static and not `complete`, the user is a non-viewer member, no row exists, and the user's record for the goal's item doesn't say `have`. Everything else is skipped and counted. Rows are written through `write_row` with the lead as writer and `source="manual"`: a correction for others, "own" for the lead's cell (R-S1-8). The response is `{ created: [ParticipantStateResponse], skipped, undo_token }`, and Undo deletes the created rows that are unchanged.
- **R-S2-13 (the read API, carried item 1; Q1).** `GET /api/static-groups/{group_id}/collection-participants`, any member (viewers included), optional repeated `goal_id` (≤ 50).
  - With no `goal_id`: every goal not `complete`. With ids: those goals, any status (404 if one isn't in the static).
  - Response: `list[GoalParticipantsResponse]` = `{ goal_id, participants: [ParticipantStateResponse], record_only: [RecordOnlyCellResponse] }`. `participants` equals `list_participants`' output for that goal, merged and gated the same way.
  - **`count_hidden: bool`** (vet I-1) on `ParticipantStateResponse` (so on `list_participants`, both PATCH responses and this route) and on `RecordOnlyCellResponse`: `not show_count`. Additive; V1 ignores it.
  - `record_only` (Q1): for each goal with a `catalog_item_id`, each **claimant** (a user with a claimed `SnapshotPlayer` in the static's **newest** active tier, picked as the chain picks it, `collection_records.py:217-228` (vet M-3), whose membership isn't `viewer`) with no row for the goal and a record for the item. Fields: `user_id`, `display_name`, `member_role`, `state` (`"have"` when the record says `have`, else `null`), `token_count` (gated by `count_visibility`), `count_hidden`, `record` (`ParticipantRecordView`, gated).
  - Counts follow `count_visibility` (`collection_records.py:1086-1120`); viewers get no `priority_rank`.
  - **Budget:** the same SELECT count for 1 vs 6 members and for 1 vs 3 goals (`count_statements`).
  - Routes are declared in `routers/collection_goals.py`, so its helpers (`_participant_to_response`, `_get_goal`) are reused.
- **R-S2-14 (AUTHZ; vet M-4).** Mutation rows in `tests/authz_matrix.py`: `POST /collection-participants/undo` with **two variants**, as the drop rows have (`:503-510`): `own` (`member`, actor `member`, "undo your own farm-status edit (S2-7)") and `other` (`lead`, "undo a farm-status correction (S2-7)"), each with a build that mints a token for its actor through the service; and `POST /collection-participants/mark-need` (`lead`, "mark blank farm cells Need (S2-7)"). The GET gets direct tests: a non-member 403, a viewer 200 with no counts.
- **R-S2-15 (no migration; contract additive only; vet I-1).** No table or column is added. No plugin route or field changes. Responses change additively only: `ParticipantStateResponse` gains `count_hidden`; the PATCH routes respond with `ParticipantWriteResponse(ParticipantStateResponse)` plus `undo_token: str | None = None`. No key is removed or renamed.
- **R-S2-16 (release notes, `pr-checklist`; vet I-3, M-1).**
  - **The backend stack is internal.** B1 creates an internal release (release-level `internal: true`) at the highest `RELEASES[].version` on `origin/main` + 1, read at its Finish (**2.1.69** unless something lands first; `CURRENT_VERSION` is 2.1.68, `frontend/src/data/releaseNotes.ts:12`, and doesn't move for an internal release). B2 and B3 add `internal: true` items to that release while it is unmerged; a backend PR that finds it already merged creates the next internal release instead.
  - **The frontend stack is public.** F1 creates the next free version, **public**, because (d) is V1-visible: "Progress links open Goals & Farms in the classic view." (vet M-1: the spec's line says "Tracking", V1's label is "Goals & Farms"), and sets `CURRENT_VERSION` to match. F1 also adds an internal item for the V2 Progress tab; F2–F6 add `internal: true` items. S2a-3a's plan should join this release, since the stack merges together.
  - Format: single-quoted strings, `'` escaped as `\'`, written with the Edit tool; every item has a `description`; `pr`/`prTitle` filled after `gh pr create`. On a sibling's release landing first, renumber (S2a-1's R-S1-21).
- **R-S2-17 (density, absent controls, refetch; §4 :172; S2-3; vet M-8).** One toolbar row with at most four controls. In S2a-2 a lead sees "Edit statuses"; in the mode, "Mark everyone without a status as Need" and "Done". There's no Tracks ⇄ Find switch and no "Track a farm" until S2a-4 (S2-3 :16): absent, not stubbed. Settings ▸ Goals & Farms' Add Farm stays V2's create path (P-14, P-89). `ProgressPage` refetches when the store's active goal ids change, **keyed on the sorted ids joined into one string**, never on an array or object identity (the churn `NewShell.tsx:193-199` documents), so a farm added in Settings appears at once and nothing refetches in a loop.
- **R-S2-18 (phones, S2-15).** The matrix scrolls sideways inside its own container, never the page. No phone layout, no phone gate.
- **R-S2-19 (non-members).** A user with no role (`userRole == null`: a guest or an outsider) sees the tier row and `<MembersOnlyCard staticName={group.name} subject="Farms" />` in place of the matrix. No `collection-` request fires (as GUEST-2's R-G2-5).
- **R-S2-20 (e2e; vet M-8).** F1 moves `role-gating.spec.ts`'s V2 catalog tests (`:309-318`, `:355-358`) out and deletes the now-unused `openCatalogV2` (`:130`): the catalog is INTERIM, and the legacy describe (`:365-385`) already pins member and owner. In their place, a V2 member sweep of Progress. F6 adds the lead pins. `guest.spec.ts` stays unedited and green.

## Owner answers already given (binding)

- **B1** (viewers see states only; a member's flag hides their counts), **B2** (counts ranked as given, labelled by origin), **B5** (no-signal members start blank: the bulk action has blanks to fill), **B10** (`api_key` reads "plugin"). B3, B4, B7 and B11 bind S2a-3a…S2a-5.
- **Spec owner-accepted designs:** the four canvas departures (§3: unclaimed columns dim and empty; no prog row; fewest totems first; phones in W7); the INTERIM loss of Suggested and Browse Catalog from the S2a-2 merge to the S2a-4 merge (§4 :168).
- **Matrix §14:** Q-3 (farm row text and tags), Q-4 (no stats strip or can-buy badge), Q-6 (no static-wide target/current count).
- **S2a-1 Q1–Q7** as built: a person's un-Have and count take effect on a plugin-synced record (Q1); Need/Want over a Have un-Haves the record (Q6), which the own-cell picker inherits; a yielding Have reads Want (Q3).
- **View As writes** follow HS-30 (every verb open but two); not an owner question (vet).

## Owner questions

The plan is written to each recommendation; rulings that depend on Q3 and Q4 say so. Q1 binds B1 (TB1), Q2 binds B3 and F6, Q3 binds F2, Q4 binds B2 and B3; a PR whose question is unanswered stays draft.

1. **Q1 · A claimed member with a record and no row in this static** (S2a-1 carried item 1). Today the merge is rows only (R-S1-9). Example: you mark Wings of Resolve owned in the Hub; your static then adds the farm through Settings' Add Farm (which seeds nothing). Your cell is blank, "n of m" undercounts, and the bulk Need would treat you as blank.
   - **(a) Show it.** The read API returns record-only cells (R-S2-13). The matrix shows "✓ Have", labelled by the record's origin, and counts it in n; the bulk Need skips it. A record count with no Have prefills the picker's count. Nothing is written until someone picks. About +250 lines in TB1.
   - **(b) Keep rows only.** The cell stays blank until a pick, a drop or a sync creates a row. The bulk route still checks the record server-side, so it never marks an owner Need; the cell and n stay wrong meanwhile.
   - **Recommend (a).** S2-4 says a claimed player's cells show their status "merged with their character's record" (:21); S2a-1 carried this "until an additive API field says otherwise (S2a-2)" (spec :261).
2. **Q2 · How far "Mark everyone without a status as Need" reaches** (S2a-1 carried item 3). **Confirm; non-blocking — S2-7 + density rule 11 already imply (a)** (vet).
   - **(a) The whole matrix:** every blank claimed cell on every active farm row (Finished excluded), one click, with an Undo toast.
   - **(b) One farm at a time:** a "Mark blanks Need" control on each farm row while Edit statuses is on.
   - **Recommend (a).** S2-7 puts "one bulk action" in a matrix-wide mode (:48), and density rule 11 allows one control there, not one per row. Undo (R-S2-11) makes a wide action safe. The typical use is right after a Track, when the new farm's row is the only one with blanks.
3. **Q3 · The order of farm rows** (vet). S2-5 orders active farms "by the number of players who still need them, then by name" (:30). "Still need" can mean the **Need** state, or **everyone who doesn't have it yet** (Need, Want and blank). The choice also picks Home's TrackCard farm, which reuses the order (S2-12).
   - **(a) Need count, then Want count, then title.**
   - **(b) Need count, then title** (the spec's literal tie-break).
   - **(c) Not-yet-Have count** (Need + Want + blank), then title.
   - **Recommend (a).** Need is the vocabulary's strong signal and the queue's first tier (S2-8); among farms with equal Need, the one more players still want is the better night; title last keeps the order stable. (c) would rank a farm of blanks and Wants above one with real Needs.
4. **Q4 · Does Undo restore the prior writer and channel exactly?** (vet I-2)
   - **(a) Yes.** The token carries each prior's writer and channel, and the restore writes them back (R-S2-11). The merge's correction test and the cell labels return exactly. The undo itself is logged with the undoer.
   - **(b) No: the undoer becomes the writer**, as R-S1-14's drop restore does. A lead's Undo of a member's own Pass or Have turns it into a correction, which then stops behaving as the member's (merge rules 1 and 3: an own Pass resists a newer record Have, an own Have yields to a newer un-Have), and a restored plugin value reads "you".
   - **Recommend (a).** Criterion 2 says "Undo restores it"; only (a) restores what the static saw. The values are server-written and travel encrypted, so R-PV-2's intent (no client-supplied channel) holds.

## Coverage: the 26 S2a-2 matrix rows and the 3 carried items

Every S2a-2 row ships in S2a-2. Four rows have a level-2 half that S2a-3a ships in the same merge (R-S2-1). **None is deferred.**

| ID | Affordance (matrix) | PR · task | Notes |
|---|---|---|---|
| P-01 | ⌘K "Go to Progress" | F1 · TF2 | |
| P-02 | Key `3` opens Progress | F1 · TF2 | Shortcut help text stays "Tracking tab" (shared with V1, P-02 note); key 5 is W1 |
| P-03 | `MobileBottomNav` "Goals" | F1 · TF2 | Opens the desktop matrix (S2-15); label unchanged |
| P-04 | Phone swipe lands on Progress | F1 · TF2 | `SWIPE_TABS` unchanged; the slot does it |
| P-05 | `?tab=goals`, recalled `goals` | F1 · TF2 | V2 then writes `?tab=progress`; delta (d) |
| P-06 | `?tab=mount-farms`, `?tab=collections` | F1 · TF2 | |
| P-08 | `?goal=farms` | F1 · TF2 | Ignored by `ProgressPage` (R-S2-3) |
| P-09 | `?farm=suggested\|active\|catalog` | F1 · TF2 | Lands on Progress; Find opens them from S2a-4 |
| P-10 | `suggestion_vote` → `?tab=goals` | F1 · TF2 | No backend change |
| P-11 | Header "Every track {static} is working on, the tier first · Week n" | F1 · TF1 | Title "Progress" |
| P-12 | Objectives ⇄ Farms switcher retired | F1 · TF1, TF2 | No segmented control; objectives stay in Settings until S2a-5a |
| P-13 | Toolbar (Tracks ⇄ Find) | F1 · TF1; F6 · TF8 | Find's half INTERIM to S2a-4 (absent, R-S2-17); Edit statuses in F6 |
| P-16 | Empty state retired: never empty | F1 · TF1 | The tier row is first for DEVTST |
| P-17 | Farm rows by need; "Finished (n)" collapsed | F2 · TF4; F3 · TF5 | Order per Q3; a finished row's expansion: S2a-3a |
| P-18 | Farm row name and type icon | F3 · TF5 | Icons lifted to `utils/goalTypeMeta.ts` |
| P-19 | "{title} · {type}" + Wanted/Scheduled tag | F3 · TF5 | Content, mode and notes in the expansion: S2a-3a |
| P-20 | One cell per player + "{n} of {m} have it" | F2 · TF4; F3 · TF5 | |
| P-21 | Each player's count in their cell, "Need 62/99" | F3 · TF5 (shown); F5 · TF7 (set) | "Can buy" badge RETIRED-ACK (Q-4) |
| P-31 | My status picker, saves on pick, Undo, own count | B2 · TB2; B3 · TB3; F5 · TF7 | Have and the count write the record (S2a-1a) |
| P-32 | No-status state → blank cells + picker | F3 · TF5; F5 · TF7 | Own blank cell reads "Set status" (vet I-6) |
| P-33 | Player columns in Board order, role colour | F2 · TF3, TF4; F3 · TF5 | "Rank in the queue" is S2-8: S2a-3a's queue |
| P-34 | Counts; viewers none; a member may hide theirs | B1 · TB1 (server, `count_hidden`); F3 · TF5 (shown) | R-S1-19's gate reused |
| P-35 | Provenance on hover and focus | F4 · TF6 | |
| P-72 | Tracked rewards are matrix rows | F3 · TF5 | |
| P-119 | G-27: lead edits any row, member their own, with count | F5 · TF7; F6 · TF8 | A lead sets a first count (vet I-1); owner-signed port (§15) |
| P-120 | G-27: source badge, sync time, manual-override marker | F4 · TF6 | Provenance labels |
| **C-1** | Record values for a claimed member with no row | B1 · TB1; F2 · TF4 | Q1 |
| **C-2** | Undo can't clear a count or restore a record to absent | B2 · TB2; B3 · TB3; F5 · TF7; F6 · TF8 | R-S2-11; Q4 |
| **C-3** | Bulk "Mark everyone without a status as Need" | B3 · TB4; F6 · TF8 | Q2 |

**Rows of other slices that S2a-2 changes in passing:** P-07 (`?goal=objectives` lands on Progress until S2a-5a, matrix :34); the 20 INTERIM rows P-52…P-77 leave V2 when the frontend stack merges (the merging PR fills in §15's date, Write-backs); P-14 and P-89 (Settings' Add Farm stays the create path); P-78…P-86 (objectives and the Goals & Farms tab stay whole in Settings, S2-14 :136).

## Review Focus

- **V1 renders as today except (d)** (R-S2-2). The goals fallback, the legacy URL writer, the five old store actions and `RewardGoalCard` are pinned by **unedited** test files; new cases live in new files (vet M-2). Every edited V1 file is listed in its PR body.
- **The URLs.** Every alias lands on Progress in V2; V2 writes `progress`, V1 `goals`; back and forward work; `?tab=progress` opens Goals & Farms in V1.
- **The read API (TB1).** For each goal, `participants` equals `list_participants`; record-only cells only for newest-active-tier claimants with no row; counts gated for viewers and flagged members; `count_hidden` true exactly when the gate withheld a count; fixed SELECT counts.
- **Undo is exact (TB2, TB3).** For each case, the merged response after Undo equals the merged response before the edit: both timestamps, the writer and the channel included (Q4), and the two merge flips (vet I-2). Skip-if-changed holds per part. The token is encrypted (a lead can't read a flagged count), expires, is bound to its actor and static, and can't authenticate. The role check precedes the token.
- **The bulk route (TB4)** marks only blanks the server re-checks, records the lead as writer, and Undo removes only unchanged rows.
- **The guard.** The new callers are in `EXPECTED_DOOR_CALLERS`/`DOOR_CALLER_ROUTES` with `@covers_record` tests; only the undo route passes the restore keywords; PROV-1's registry self-test passes unedited.
- **The model (TF4).** Board order equals `GearBoard`'s sections, flattened; n and m follow R-S2-7; ordering follows Q3; hidden counts by `countHidden`; record-only Haves count.
- **Roles.** Hidden, not disabled (ROLE-1); viewers see no counts and no controls; a lead sets an unflagged member's first count; View As never writes the admin's own row.
- **a11y.** One tab stop into the matrix; every cell names its player, track and state; provenance on focus; axe 0 critical / 0 serious in both themes at 1440 (criterion 10).
- **UI rules.** No raw elements; semantic tokens; `text-xs` floor; no modal for an edit; no sticky column; no stub for an absent control; the own blank cell looks and announces clickable (vet I-6).
- **The preflight.** The `redesign/s2a2-preflight` push run is green on the exact tree before the frontend stack merges (vet I-3).

---

## Backend stack

### PR B1 · S2a-2·B1 — the Progress read API

#### Task TB1 — the read API (RISKIEST in B1 · `xivrp-implementer-deep`) (was T1.3)

**Goal:** one request returns every active farm's merged cells, the record-only cells Q1 asks for, and whether each count was withheld.

**Files.** Modify `backend/app/routers/collection_goals.py` (`list_progress_participants`, declared before any `/{goal_id}` route; `_participant_to_response` sets `count_hidden`), `backend/app/schemas/collection_goals.py` (`count_hidden` on `ParticipantStateResponse`; `GoalParticipantsResponse`, `RecordOnlyCellResponse`), `backend/app/services/collection_records.py` (`active_tier_claimants(db, *, static_group_id) -> set[str]`: the newest active tier, as the chain picks it (vet M-3), its claimed players and their non-viewer memberships, in at most two SELECTs). Create `backend/tests/test_progress_participants.py`. Add B1's internal release items to `frontend/src/data/releaseNotes.ts` (R-S2-16).

1. **Tests first:**
   - **Access:** a non-member gets 403; a viewer gets 200 with every `token_count` and `record.token_count` null, every `count_hidden` true for others, and every `priority_rank` null.
   - **Equality:** for a member caller, each goal's `participants` equals `GET …/collection-goals/{id}/participants` for that goal, key for key.
   - **Scope:** no `goal_id` → `complete` goals absent; `goal_id=<complete>` → present; an id from another static → 404.
   - **Record-only:**
     - a claimed active-tier member with no row and a record `have` → one entry, `state "have"`, `record.ownership_state "have"`;
     - a record holding only a count → `state null` and the count;
     - an unclaimed member, a viewer, and a member claimed only in an inactive tier → no entry;
     - **two active tiers:** only the newest tier's claimants get entries (vet M-3);
     - a member with a row → no record-only entry;
     - a goal without `catalog_item_id` → none;
     - the claimant's card resolving to an alt → the alt's record, not the main's (chain).
   - **Gating and `count_hidden` (vet I-1):** a flagged member's count is null with `count_hidden: true` for a lead and an owner, and shown to themselves with `count_hidden: false`; **an unflagged member with no count reads `token_count: null, count_hidden: false` for a lead**; `list_participants` and both PATCH responses carry the same flag.
   - **Budget:** the same SELECT count (`count_statements`, `SELECT` only) for 1 vs 6 members and for 1 vs 3 goals.
   - **Additive only:** `ParticipantStateResponse`'s old keys are all present and unchanged; the only new key is `count_hidden` (R-S2-15).
2. **Implement** R-S2-13, then the release items (internal: the Progress read API).
3. **Gates:** the new file, `test_participant_merge.py`, `test_count_visibility.py`, `test_collection_goals.py`, then the full suite (paste the count); `ruff check` on touched files; `pnpm -C frontend build`, the releaseNotes test, `scripts` `npm test`.

**Mutation check (execute, paste, revert):** drop the claimant filter → the unclaimed case fails; take the oldest active tier → the two-tier case fails; derive `count_hidden` from `token_count is None` → the no-count case fails.

**Finish for B1:** curl the route as owner, member and viewer on DEVTST with two seeded farms; paste the trimmed JSON in the PR body. Merge when it passes (R-S2-1).

### PR B2 · S2a-2·B2 — Undo tokens and the door's restores

#### Task TB2 — tokens, PATCH tokens, door restores (RISKIEST of S2a-2 · `xivrp-implementer-deep`, `model: fable`) (was T3.1)

**Goal:** every cell write can be undone exactly, writer included, by its author, for ten minutes, without revealing a hidden count.

**Files.** Create `backend/app/services/participant_undo.py` (`UndoCell`, `UndoClaims`, `mint_undo_token(...)`, `read_undo_token(token, *, group_id, actor_user_id) -> UndoClaims`, `UndoTokenInvalid`). Modify `services/collection_records.py` (R-S2-11's door keywords; `delete_row`, `delete_record`), `routers/collection_goals.py` (`_write_own_state` returns the row and record with their priors; both PATCH routes mint `undo_token` after the flush and before the commit), `schemas/collection_goals.py` (`ParticipantWriteResponse`). Create `backend/tests/test_participant_undo_token.py`; extend `tests/test_provenance_coverage.py` only if a registry needs the new door functions. Add B2's internal release item.

1. **Tests first:**
   - **Token:** a round trip keeps every field, each prior's `updated_by_user_id` and `updated_via` included (vet I-2); a tampered token, an expired one (10 min + 1 s, injected clock), another static's and another actor's are each refused with `UndoTokenInvalid`; `auth_utils.verify_token(token)` returns `None`.
   - **Encrypted (vet M-4):** a row whose prior count is the sentinel `987654321` mints a token; neither the token string nor its base64-decoded bytes contain `987654321` or its JSON form, while `read_undo_token` returns it.
   - **PATCH:** both routes return `undo_token`; the old keys are unchanged; the self route's token names the record when one was written and not otherwise; the lead route for another member names no record; **a mint failure (patched to raise) returns `undo_token: null` and the write is committed** (vet M-4).
   - **Door:** `write_row(restore_state_changed_at=t0, restore_token_count_updated_at=t1)` stores exactly t0/t1; `token_count=None` with the restore keywords clears the row's count; `write_record(restore_token_count=None)` clears the record's count; `restore_token_count_updated_at` sets it exactly; `delete_row` and `delete_record` delete one row each. Omitting the keywords leaves today's behaviour, pinned by `test_participant_merge.py` and `test_record_provenance.py` unedited.
   - **Guard:** an AST test asserts that only `undo_participant_edits` passes `restore_token_count`, `restore_token_count_updated_at`, or `restore_state_changed_at` to `write_row` (`delete_drop`'s existing `restore_state_changed_at` on `write_record` stays allowed).
2. **Implement** R-S2-11's token and door parts.
3. **Gates:** the new file, `test_provenance_coverage.py`, `test_record_provenance.py`, `test_participant_merge.py`, `test_farm_drop_authz.py`, then the full suite; `ruff`. The review is task-scoped for this task (slice-loop §1.4).

**Mutation check:** sign without encrypting (JWT) → the sentinel case fails; drop the TTL → the expiry case fails; mint after the commit → the mint-failure case fails.

### PR B3 · S2a-2·B3 — the undo route and the bulk Need

#### Task TB3 — the undo route (RISKIEST in B3 · `xivrp-implementer-deep`) (was T3.2)

**Goal:** `POST …/collection-participants/undo` restores a cell, or a bulk action's cells, exactly.

**Files.** Modify `routers/collection_goals.py` (`undo_participant_edits`), `schemas/collection_goals.py` (`UndoRequest`, `UndoResponse`), `tests/authz_matrix.py` (R-S2-14's `own` and `other` rows and a token-minting build helper), `tests/test_provenance_coverage.py` (`EXPECTED_DOOR_CALLERS`, `DOOR_CALLER_ROUTES`). Create `tests/test_participant_undo.py`; add `@covers_record("undo_participant_edits")` cases to `tests/test_record_provenance.py`.

1. **Tests first.** Each case asserts that the merged response after Undo equals the one before the edit (state, count, source, `state_from_record`, both timestamps, **the stored writer and channel**):
   - blank → Need → Undo: the row is gone;
   - row Want, no record → Have (the record is created) → Undo: the row is Want with its prior stamps; the record is gone;
   - row Want (older), record `have` (newer, shown Have) → Need (un-Have) → Undo: the record is `have` with its prior `state_changed_at`; the cell reads Have again; another static's Have row reads Have again;
   - count 30 → 40 → Undo: 30, with the prior `token_count_updated_at`; count null → 40 → Undo: null on the record;
   - a lead's correction of another member → Undo restores that row only; the member's record is untouched;
   - **flip case, merge rule 1 (vet I-2):** a member's own Pass; a lead sets Need; the lead's Undo → Pass with the member as writer, and a newer record `have` still leaves it Pass (as before the edit);
   - **flip case, merge rule 3 (vet I-2):** a member's own Have; a lead sets Want; the lead's Undo → Have with the member as writer, and a newer record `missing` still turns it to Want (as before);
   - **label case:** a row last written by the plugin (`api_key`); the member edits; Undo → `updated_via 'api_key'` again (it reads "plugin", not "you");
   - **changed since:** a second PATCH, or a plugin token sync on the record, after the edit → that part is skipped and counted, the other part restored;
   - the same token twice → the second is all skipped;
   - **order of checks (vet M-4):** a viewer gets 403 before the token is read (an invalid token from a viewer is still 403); a member with another actor's token, or another static's, is refused (403 or 400); an expired token → 400;
   - AUTHZ: the `own` and `other` rows pass `test_authz_matrix.py`.
2. **Implement** the route (R-S2-11).
3. **Gates:** the touched files, `test_authz_matrix.py`, the full suite; `ruff`.

#### Task TB4 — the bulk Need route (`xivrp-implementer`) (was T3.3)

**Goal:** `POST …/collection-participants/mark-need` fills blank claimed cells with Need, once, undoably.

**Files.** Modify `routers/collection_goals.py` (`mark_blank_cells_need`), `schemas/collection_goals.py` (`MarkNeedRequest`, `MarkNeedResponse`), `tests/authz_matrix.py` (R-S2-14's row), `tests/test_provenance_coverage.py` (registries). Create `tests/test_mark_need.py`; add `@covers_record("mark_blank_cells_need")` to `test_record_provenance.py`; add B3's internal release item.

1. **Tests first:**
   - a member and a viewer get 403;
   - a lead's request creates `need` rows only for cells with no row, on goals not `complete`, for non-viewer members whose record isn't `have`; each other cell is skipped and counted (an existing row is left byte-identical);
   - created rows: writer = the lead, channel `web`, `source "manual"`; the lead's own cell reads "own" (writer = user);
   - 201 cells → 422; a goal from another static → 404;
   - the response's `undo_token` → the undo route deletes the created rows; a created row edited since is kept;
   - AUTHZ passes.
2. **Implement** R-S2-12. 3. **Gates:** as TB3, plus `pnpm -C frontend build` and the releaseNotes test.

**Finish for B3:** curl a self PATCH, a lead PATCH and a bulk call on DEVTST, then each Undo; paste each response pair (before, after Undo). Merge when it passes (R-S2-1); then merge `origin/main` up the frontend stack.

## Frontend stack

### PR F1 · S2a-2·F1 — the tab

#### Task TF1 — `ProgressPage` and the bare tier row (`xivrp-implementer`) (was T1.1)

**Goal:** the page V2 will mount: header, the tier row, and the members-only card for outsiders. No farm data yet.

**Files.** Create `frontend/src/components/progress/ProgressPage.tsx`, `TierRow.tsx` and `ProgressPage.test.tsx`.

1. **Tests first** (`ProgressPage.test.tsx`, stores mocked):
   - renders `data-testid="progress-screen"`, a `PageHeader` titled "Progress" and the subtitle "Every track Dev Test Static is working on, the tier first · Week 11" for `currentWeek = 11`;
   - with `currentWeek = null` the subtitle ends at "the tier first" (no "· Week");
   - the tier row shows `getTierById(tier.tierId).name` and "Week 11"; **Open board** is a link, and clicking it calls `onNavigate('roster', { rview: 'board' })`;
   - a member with no farms sees the tier row first and no empty state (criterion 1, P-16);
   - no `role="group"`/tab control named "Objectives" or "Farms" exists (P-12);
   - `userRole = null` renders `members-only-card` with "Farms are shared with members of Dev Test Static." and the api mock records **no** request containing `/collection-` (R-S2-19).
2. **Implement** R-S2-7's tier row and R-S2-19.
3. **Gates:** `pnpm -C frontend test src/components/progress`, `pnpm -C frontend build`.

#### Task TF2 — the seam, the URLs, the Spine and ⌘K (RISKIEST in F1 · `xivrp-implementer-deep`) (was T1.2)

**Goal:** V2's `goals` mode renders `ProgressPage`; Progress is the fifth spine tab; every entry lands on it; V1 doesn't move.

**Files.** Modify `frontend/src/pages/GroupViewContent.tsx` (`GroupTab`, the goals branch), `pages/NewShell.tsx` (the `goals` slot), `hooks/useGroupViewState.ts` (`pageModeFromTabParam`, `tabParamFor`, `setPageMode`, the reflect effect), `components/layout/Spine.tsx` (`{ id: 'goals', label: 'Progress', Icon: Target }` fifth), `components/layout/CommandPalette.tsx` (label), `frontend/eslint.config.js` (R-S2-5), `design/redesign/DESIGN_SYSTEM.md` (§2 :83 and §3.13: five tabs, `goals` → Progress), `frontend/e2e/role-gating.spec.ts` (R-S2-20). **Create** `hooks/useGroupViewState.progress.test.ts` and `pages/GroupViewContent.goalsSlot.test.tsx` (vet M-2); extend the V2 tests `pages/NewShell.slot.test.tsx`, `components/layout/Spine.test.tsx`, `components/layout/CommandPalette.test.tsx`. Add F1's public release (R-S2-16).

1. **Tests first:**
   - `pageModeFromTabParam`: `progress`, `goals`, `mount-farms`, `collections` → `goals`;
   - under `?shell=v2`: `setPageMode('goals')` writes `tab=progress`; the first-render reflect writes `tab=progress`; `setPageMode('roster')` still writes `tab=roster`; a recalled `goals` opens goals;
   - under the legacy shell: `setPageMode('goals')` writes `tab=goals` (**V1 pin**, in the new file);
   - `GroupViewContent` with `slots.goals` and `pageMode = 'goals'`: the slot renders; no `goals-page` and no "Tracking" heading (new file). `GroupViewContent.slots.test.tsx` and `GroupViewContent.canManageRoster.test.tsx` pass **unedited** (**V1 pin**);
   - NewShell passes a `goals` slot that renders `ProgressPage` (mocked) when a static is active;
   - Spine: exactly five tabs, Home · Roster · Loot · Schedule · Progress; Progress maps to `goals`; End from Home lands on Progress;
   - ⌘K: "Go to Progress" present, "Go to Tracking" absent; selecting it calls `setPageMode('goals')`;
   - key 3 still calls `setPageMode('goals')` (existing `useGroupViewKeyboardShortcuts.test.ts`, unedited).
2. **Implement** R-S2-3, R-S2-4 and R-S2-5; update the contract; in `role-gating.spec.ts`, delete the V2 "Tracking" describe (`:309-318`), the owner pin's V2 catalog test (`:355-358`) and the unused `openCatalogV2` (`:130`) (vet M-8), add "member: Progress sweep, no disabled control" (`openV2(page, 'tab=progress', progressReady)`), and update the header comment (`:3`).
3. **Gates:** the touched test files, `pnpm -C frontend lint` (0 errors), `check:design-system:strict`, `build`, `deadcode` unchanged, the releaseNotes test, `scripts` `npm test`.

**Acceptance (browser, V2 and V1):** the Spine shows Progress and clicking it writes `?tab=progress`. `?tab=goals&goal=farms`, `?tab=mount-farms`, `?farm=catalog`, key 3, ⌘K and (at 390 px) the bottom bar's "Goals" all land on Progress. V1 `?tab=progress` opens Goals & Farms, and V1's own tab click still writes `tab=goals`. Shots: V2 Progress (DEVTST, tier row only) light and dark; V1 `?tab=progress`.

### PR F2 · S2a-2·F2 — the read model

#### Task TF3 — the store's read model and Board sections (`xivrp-implementer`) (was most of T2.1)

**Goal:** the client holds every cell with its provenance fields and `countHidden`, and knows the Board's column order.

**Files.** Modify `frontend/src/stores/collectionGoalStore.ts` (optional `ParticipantStateEntry` fields `updatedByUserId`, `updatedVia`, `stateChangedAt`, `tokenCountUpdatedAt`, `stateFromRecord`, `countFromRecord`, `countHidden`, `record: ParticipantRecordView | null`; `RecordOnlyCell`; state `recordOnly: Record<string, RecordOnlyCell[]>`; action `fetchProgress(groupId, goalIds?)` that sets `participants[goalId]` and `recordOnly[goalId]` for the goals returned and leaves the rest), `utils/calculations.ts` (`boardSections`, vet M-6), `components/roster/GearBoard.tsx` (renders its sections from it). Create `stores/collectionGoalStore.progress.test.ts` and `utils/boardSections.test.ts` (vet M-2).

1. **Tests first:**
   - the mapper reads every new snake_case field, `count_hidden` included, and defaults them (`false`, `null`) when absent (a V1-shaped payload);
   - `fetchProgress` populates two goals' `participants` and `recordOnly` and keeps a third goal's cached rows; with `goalIds` it requests `?goal_id=a&goal_id=b`;
   - `collectionGoalStore.test.ts` passes **unedited** (`upsertMyState` still refetches goals);
   - `boardSections`: configured only; sections labelled Light Party 1, Light Party 2, Unassigned, Substitutes, empty ones dropped; input order kept inside each;
   - `GearBoard.test.tsx` passes unedited (same dividers, same row order).
2. **Implement.** 3. **Gates:** the touched tests, `build`, `deadcode`, `dupes`.

#### Task TF4 — the matrix model (RISKIEST in F2 · `xivrp-implementer-deep`) (was T2.2)

**Goal:** one pure module decides columns, cells, rows, tallies and text, so the render and S2a-4's TrackCard share it.

**Files.** Create `frontend/src/utils/progressModel.ts` (vet I-5: `buildColumns`, `cellFor`, `compareFarmRows`, `splitFarmRows`, `haveTally`, `cellText`, `cellAccessibleName`) and `utils/progressModel.test.ts`.

1. **Tests first** (table-driven):
   - **Columns:** claimed/unclaimed by `userId`; `boardSections` flattened, with each sort preset; a row-holder with no card → trailing "Not on the roster" by name; a row-holder whose `memberRole` is `null` or `viewer` → no column; a record-only user with no card → no column.
   - **Cells:** row merged state → that state; no row + record-only `have` → Have; record-only `null` → blank; `countHidden: true` → hidden; **`countHidden: false` with `tokenCount: null` → not hidden, no count** (vet I-1); one's own count always shown.
   - **Tally:** m excludes unclaimed, Not-on-the-roster and Pass; n counts Have, record-only included; n = m → `everyone: true`; m = 0.
   - **Order (per Q3's recommended answer):** 3 Need beats 1 Need; equal Need → more Want first; equal Need and Want → title order, case-insensitive; `complete` goals go to `finished`, newest `completedAt` first.
   - **Text:** exactly "✓ Have", "Need 62/99", "Need 62" (no cost), "★ Want", "★ Want 30/99", "– Pass", ""; a hidden count → "Need"; viewer → no counts.
   - **Accessible name:** "Caster One, Wings of Resolve, Need, 62 of 99 totems"; blank → "…, no status"; unclaimed → "…, unclaimed".
2. **Implement** R-S2-6, R-S2-7 and R-S2-8. Add F2's internal release item.
3. **Gates:** the file, `lint`, `build`, `deadcode`; the review is task-scoped for this task (slice-loop §1.4).

**Mutation check:** drop the Want tie-break → the equal-Need case fails; include Pass in m → the tally case fails; read hidden from `tokenCount === null` → the no-count case fails.

### PR F3 · S2a-2·F3 — the matrix on screen

#### Task TF5 — type labels and the matrix render (sole task in F3 · `xivrp-implementer`) (was T2.1's lift + T2.3)

**Goal:** the matrix on screen, read-only: tier row, farm rows by need, Finished, every cell's text.

**Files.** Create `frontend/src/utils/goalTypeMeta.ts` (`GOAL_TYPE_LABELS`, `GOAL_TYPE_ICONS` as lucide components; vet I-5) and modify `components/collections/RewardGoalCard.tsx` to import them (renders `<Icon size={16} />`, same output). Create `frontend/src/components/progress/ProgressMatrix.tsx`, `FarmRow.tsx`, `ProgressCell.tsx`, `FinishedFarms.tsx` and their tests; modify `ProgressPage.tsx` (fetch `fetchGoals` and `fetchProgress` on mount and when the active goal ids change, keyed per R-S2-17; Finished fetches with `goalIds` on first expand). Create `frontend/e2e/progress.spec.ts` (seeds two farms through the API, one catalog mount with a token cost and one custom farm, prefix "E2E Progress", and deletes them after).

1. **Tests first:**
   - `RewardGoalCard.test.tsx` passes **unedited**;
   - DOM order: the tier row, then farm rows in `compareFarmRows` order, then the "Finished (n)" button with `aria-expanded="false"`; expanding calls `fetchProgress` with that goal's id and shows its rows, read-only;
   - column headers: job icon, position and name with `text-role-{role}`; an unclaimed column dim with "Claim to track"; a trailing "Not on the roster" column;
   - a farm row "Wings of Resolve · Mount" with a "Scheduled" tag; a Farming row has no tag;
   - cells show TF4's text; a viewer's matrix has no count anywhere;
   - the status column "2 of 6 have it"; a lead sees "Everyone has it" at n = m; a member sees "6 of 6 have it";
   - the matrix sits in an `overflow-x-auto` container, and no element is `sticky`;
   - adding a goal to the store refetches progress once; re-rendering with the same ids (a new array) refetches nothing (vet M-8);
   - e2e (`progress.spec.ts`): as owner, member and viewer on DEVTST, the seeded rows show in order; axe (`@axe-core/playwright`, scoped to `[data-testid="progress-screen"]`) reports 0 critical / 0 serious in both themes at 1440 × 900.
2. **Implement**, then F3's internal release item.
3. **Gates:** the touched tests, `lint`, `check:design-system:strict`, `build`, `deadcode`, `dupes`; run the e2e file locally against the worktree's servers.

**Acceptance (browser):** DEVTST with the two seeded farms, as owner, member and viewer: rows by need, counts for members and none for the viewer, Finished collapsed then expanded. At 390 px the matrix scrolls sideways inside its container. Shots: owner, viewer, Finished open; light and dark. The PR body discloses R-S2-6's selected-tier note.

### PR F4 · S2a-2·F4 — provenance and the keyboard

#### Task TF6 — provenance and the roving grid (sole task in F4 · `xivrp-implementer`) (was T4.1)

**Goal:** every cell says where its value came from, and the matrix is one tab stop with arrow keys.

**Files.** Create `frontend/src/components/progress/progressProvenance.ts` (`cellProvenance`), `useMatrixKeyboard.ts` and tests; modify `ProgressCell.tsx` (`Tooltip` on hover and focus; `role="gridcell"`, accessible name), `ProgressMatrix.tsx` (`role="grid"`, the roving stop, as `GearBoard.tsx:143-160`'s R-E1-E pattern). Add F4's internal release item.

1. **Tests first:**
   - every row of R-S2-9's table, plus: record side when `stateFromRecord`; "plugin, 2 days ago" from `state_changed_at` (fake clock); the count line only when the sides differ; **no count line and no time for a hidden count**; "set by Lead One" for a correction;
   - keyboard: one element of the grid has `tabIndex=0`; ArrowRight/Left/Up/Down, Home and End move focus across farm rows and columns; focus shows the tooltip; Tab leaves the grid; the stop survives a re-render.
2. **Implement** R-S2-9 and the grid. 3. **Gates:** the touched tests, `lint`, `check:design-system:strict`, `build`.

**Acceptance (browser):** hover and keyboard-walk the seeded matrix; a plugin-synced cell reads "plugin, …", a lead correction "set by …". Shots: two tooltips; light and dark.

### PR F5 · S2a-2·F5 — your cell

#### Task TF7 — the own-cell picker, "Set status" and the Undo toast (RISKIEST in F5 · `xivrp-implementer-deep`) (was T4.2)

**Goal:** a member changes their own cell inline, sets their totem count, and can undo it (criterion 2). Needs B2 and B3 merged (§ Size and stack).

**Files.** Create `frontend/src/components/progress/CellPicker.tsx` and its test. Modify `ProgressCell.tsx` (own cell = `Button` trigger; own blank cell shows "Set status"), `stores/collectionGoalStore.ts` (`setCell(groupId, goalId, { targetUserId?, state, tokenCount? }) -> { entry, undoToken }`, which merges the entry into `participants[goalId]`, drops that user's record-only cell and doesn't refetch goals; `undoCells(groupId, token) -> { restored, skipped }` then `fetchProgress`), `stores/toastStore.ts` (`withUndo(message, onUndo, duration = 8000)`). Extend `stores/collectionGoalStore.progress.test.ts`. Add F5's internal release item.

1. **Tests first:**
   - the viewer's own cell is a `Button` named "{name}, {track}, {state} — change your status"; others' cells aren't buttons; a viewer has none;
   - **an own blank cell renders a muted `text-xs` "Set status"** and is a button named "…, no status — set your status"; another member's blank cell renders nothing (vet I-6);
   - the picker is a `Popover` (no `Modal`) with four `Button`s in a `role="group"`, "Need", "★ Want", "✓ Have", "– Pass", the current one `aria-pressed`; a token farm adds a `NumberInput` "Totems" (min 0);
   - picking Need sends `PATCH …/participants` with `{ state: 'need', token_count: null }`, updates the cell without a goal-list refetch, closes the picker, and shows a toast "Need saved" with **Undo**; Undo posts the token and refetches; a `skipped` result toasts "Couldn't undo: it changed since"; a response with `undo_token: null` toasts "Need saved" with no Undo;
   - the count commits on Enter or blur with the cell's current state; it's disabled with "Pick a status first" on a blank cell; empty input sends nothing;
   - a failed PATCH toasts an error and leaves the cell as it was;
   - under View As, a pick sends the lead route aimed at the viewed user (R-S2-10);
   - Escape closes the picker and returns focus to the cell;
   - `withUndo` adds a toast whose action is "Undo".
2. **Implement** R-S2-10's member half and R-S2-11's client half.
3. **Gates:** the touched tests, `lint`, `check:design-system:strict`, `build`, `deadcode`.

**Acceptance (browser), criterion 2:** as DevMember: a blank own cell reads "Set status"; set Need on the seeded mount, then a count of 62 ("Need 62/99"), Undo each and watch both return; set Have and see Profile ▸ Collections show it owned, then Undo and see it return; hover and focus show "you". Shots: "Set status", picker open, Undo toast, a provenance tooltip; light and dark. The PR body discloses R-S2-10's two View As notes.

### PR F6 · S2a-2·F6 — leads' Edit statuses

#### Task TF8 — Edit statuses, lead cells and the bulk action (RISKIEST in F6 · `xivrp-implementer-deep`) (was T5.1)

**Goal:** a lead corrects any claimed cell, sets a member's first count, and fills the blanks with Need, undoably (criterion 3).

**Files.** Create `frontend/src/components/progress/EditStatusesBar.tsx` and its test; modify `ProgressPage.tsx` (toolbar, mode state), `ProgressCell.tsx` (editable in the mode per R-S2-10), `CellPicker.tsx` (target user; the count field follows `countHidden`, vet I-1), `stores/collectionGoalStore.ts` (`markNeed(groupId, cells) -> { created, skipped, undoToken }`, then `fetchProgress`). Add F6's internal release item.

1. **Tests first:**
   - owner, lead and admin access see "Edit statuses"; a member and a viewer see no such button (hidden, not disabled);
   - in the mode: "Mark everyone without a status as Need" and "Done" (toolbar ≤ 4 controls); every claimed cell on active rows is a `Button`; unclaimed, Not-on-the-roster (others') and Finished cells aren't;
   - a lead's pick on another member's cell sends `PATCH …/participants/{userId}`; on their own, the self route;
   - **an unflagged member with no count (`countHidden: false`) gets a count field, and setting 12 sends `token_count: 12`** (vet I-1); a flagged member's cell (`countHidden: true`) has no count field;
   - the bulk action sends exactly the blank claimed cells of active rows (record-only Haves excluded, Q1), toasts "Marked 5 cells Need" with Undo, and Undo restores the blanks; with no blank cell it is disabled with "No blank cells" (a state, not a role);
   - "Done" leaves the mode, and leaving the page resets it.
2. **Implement** R-S2-10's lead half and R-S2-12's client half.
3. **Gates:** the touched tests, `lint`, `check:design-system:strict`, `build`, `deadcode`.

#### Task TF9 — e2e, axe, role gating, contrast (`xivrp-implementer`) (was T5.2)

**Goal:** criteria 3 and 10, end to end.

**Files.** Extend `frontend/e2e/progress.spec.ts`, `e2e/role-gating.spec.ts` and `e2e/contrast.spec.ts`.
- `progress.spec.ts`, as owner: Edit statuses; a correction whose tooltip reads "set by"; a first count for a member with none; **a farm tracked through `POST …/collection-goals/from-suggestion` for a catalog item no seeded member has a signal for leaves those members blank (B5)** (vet M-5: Settings' Add Farm seeds nothing, so it proves nothing about B5); then the bulk action fills them, and its Undo empties them again; axe with the picker open and in the mode, both themes, 1440 × 900.
- `role-gating.spec.ts`: member: no "Edit statuses"; owner pin: "Edit statuses" enabled.
- `contrast.spec.ts`: Progress, scoped to `progress-screen`, both themes.

1. **Tests first** as listed; each new e2e fails on F5's head for the right reason.
2. **Gates:** `pnpm -C frontend test:e2e` for the three files against the worktree's servers (paste the counts), plus the unit gates.

**Acceptance (browser), criterion 3:** as DevOwner: Edit statuses, correct a member's cell (hover reads "set by DevOwner"), set a member's first count, track a farm from the catalog, Mark everyone without a status as Need, Undo, Done. As DevMember: no lead control. As a viewer: states with no counts. Shots of each; light and dark.

---

## Finish (each PR)

- `git fetch`; if `releaseNotes.ts` changed on `origin/main` since the branch point, renumber (R-S2-16). Then the size check (`git diff --stat <parent>...HEAD`), the `pr-checklist` skill, and the slice-loop §5 gates: backend `pytest` when backend changed, `pnpm -C frontend build`, `lint` (0 errors, warnings ≤ the parent's count), `check:design-system:strict`, `test`, `deadcode` unchanged, `dupes`. Paste the counts in the PR body.
- **The live check (slice-loop §2):** the worktree's dev servers (`CLAUDE.md` § Commands, `mkdir -p .logs` first) on a **copy** of the dev DB, dev-auth login, `/group/DEVTST?shell=v2`, then the PR's walk. Seed farms through the API with the "E2E Progress" prefix and delete them after. Shots shrunk to `docs/redesign/pr-shots/s2a2-<pr>-*.webp` (`python scripts/shrink-pr-shots.py`). Backend PRs paste curl pairs instead of shots.
- `gh pr create --draft --base <parent branch>`, then the release item's `pr`/`prTitle`.
- **The PR body:** the V1 files touched and the unedited tests that pin them (R-S2-2); delta (d) with its render path (F1); the plugin contract unchanged and the response changes additive only (R-S2-15); the owner's answers to the questions the PR implements (a PR implementing an unanswered one stays draft); disclosed residuals (R-S2-6's tier note, R-S2-9's restamp note, R-S2-10's View As notes).
- **Merging:** backend PRs merge as they pass (R-S2-1). The frontend stack merges only with S2a-3a, after the green `redesign/s2a2-preflight` push run (vet I-3).

## Write-backs (once, after the frontend + S2a-3a stack merges)

- **Spec §6:** the S2a-2 row as built (nine PRs on two stacks, numbers) and the status paragraph. **Correct §6's "~17 PRs"** (:195): S2a-1's eleven plus S2a-2's nine already make twenty, before S2a-3…S2a-5 re-count at their plans (vet I-4). The same correction goes to `HOME_STRETCH.md`'s W3 S2a row ("~17 PRs").
- **Spec §7:** criteria 1, 2, 3, 10 and 11's shipped markers; (d)'s wording ("resolves to Goals & Farms in V1"; release line "Progress links open Goals & Farms in the classic view.", vet M-1) and (d), (e) shipped; the rulings below as "S2a-2 rulings that bind S2a-3a…S2a-5"; the owner's answers to Q1–Q4.
- **Parity matrix §15:** the INTERIM rows' "out of V2 from" date (the merging PR's); the as-built notes on P-17, P-19 and P-33's split halves.
- **`HOME_STRETCH.md`:** W3 S2a's PR count and the dated log; §4 S2's acceptance line "`Spine.tsx` renders five tabs" met.
- **`docs/PRODUCT_MODEL.md` §6:** the Stage 2 row (`:240` still says "`Spine.tsx` has 4 tabs" and "no V2 UI yet").
- **This plan:** an "As built" section.
- **Rulings that bind later slices:** R-S2-5 (`utils/progressModel.ts` and `utils/goalTypeMeta.ts` as the shared home), R-S2-6 (columns), R-S2-7 (`compareFarmRows` for TrackCard, the tier row's shape for S2a-3b), R-S2-9 (provenance), R-S2-10 (who edits), R-S2-11 (the Undo token, which S2a-3a may reuse for its row edits), R-S2-13 (the read API and `count_hidden`), R-S2-17 (absent controls).

## Carried, not S2a-2

- **S2a-3a:** the queue and its rank (P-22, P-33's rank); the expansion (P-19's content, mode and notes; P-17's finished-row expansion; P-23, P-24, P-27, P-30); Mark finished and Reopen, including "Everyone has it · Mark finished" (P-46); `?track=`; Undo for drops in V2, which may prefer the drop's stored `recipient_character_id` (S2a-1 plan :789); **the drop's character on display** (S2a-1 plan :846, "The display slice") (vet M-8).
- **S2a-3b:** the tier row in full (cells, status column, split plan, `?track=tier`).
- **S2a-4:** Find, "Track a farm", TrackCard on `compareFarmRows`, the split row; the INTERIM rows return.
- **S2a-5:** the Settings relabel, objectives' move, the deletions.
- **HUB:** the privacy toggle (B1) and the character picker (B8).
- **After 3.0.0 or a backend slice:** a per-field writer for the farm row, so a count sync doesn't restamp a lead's state correction (R-S2-9); clearing a count from a cell; leads editing other members' Not-on-the-roster cells; View As reads gated as the viewed member rather than the admin (R-S2-10).
- **Other waves:** the shortcut help's "Tracking tab" text (W1 with key 5); phone cards (W7); `MobileBottomNav`'s "Goals" label (S2c removes the bar).
