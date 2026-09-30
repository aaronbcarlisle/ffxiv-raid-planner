# V1B item 1 — The not-found flow (both shells)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo. Items 2–3 of V1B are out of scope.

## Owner questions

The plan is written on the recommended answers. What changes if an answer differs is stated.

- **Q1 — Legacy's not-found copy.** Legacy's branch reads "Group Not Found" / "The static group you're looking for doesn't exist." (`GroupView.tsx:328-329`); E1 Task 4e renamed only V2's (`ShellContentStates.tsx:187-188`). The branch is unreachable after a load today, so this fix is the first time legacy users see it. Rename it to V2's "Static Not Found" / "The static you're looking for doesn't exist." (two strings, markup and classes unchanged)? **Recommended: yes.** HOME_STRETCH §4 V1B says "Static Not Found" in both shells, and CLAUDE.md § Product rules bans "group" in user-facing text. *If no:* `GroupView.tsx` gets no edit, and L1/L2 assert "Group Not Found".
- **Q2 — A way out of the not-found state.** Today a bad link lands on the Error card, which has "Go to My Statics" (`ShellContentStates.tsx:169-174`, `GroupView.tsx:312-316`). The not-found branch has no action in either shell. Add one? **Recommended: no, not in this slice.** Both shells keep their navigation chrome around it (the V2 rail and TopBar, the legacy Header). Add "a CTA on not-found" to the holistic-review list. *If yes:* V2 passes `action` to `EmptyState`, legacy adds a `Button` (~10 lines, V1-visible), and L1 and N1 assert it.

**Goal:** a bad share code reaches the not-found state in both shells, whether it's opened directly or from another static. Today a direct bad link shows "Error / Static group not found". From another static, the old static stays on screen under the bad URL, with "No Raid Tiers" and an error modal. Once the modal is dismissed, Create First Tier would write to the old static.

**Architecture:** only `staticGroupStore.fetchGroupByShareCode` changes behaviour. A 404 produces the state both shells already define as not-found. Any other failure drops a stale group. A superseded response is ignored. `ShellContentStates.tsx` isn't edited. `GroupView.tsx` changes only by Q1's two strings. There's one new store test file and one new integration test per shell.

| Edit | Reach | Label |
|---|---|---|
| `frontend/src/stores/staticGroupStore.ts` (`fetchGroupByShareCode`, one module `let`) | both shells (shared store) | V1-visible, sanctioned (HS-7, HS-28) |
| `frontend/src/pages/GroupView.tsx:328-329` (Q1) | legacy only | V1-visible, sanctioned (HS-7) |
| `frontend/src/data/releaseNotes.ts` | public note, `CURRENT_VERSION` bump | HOME_STRETCH §1 standing rule |
| `ShellContentStates.tsx`, `NewShell.tsx` | — | no edit (V2 gets a test only) |

**Spec (binding):** `design/redesign/HOME_STRETCH.md` §4 V1B item 1 and its acceptance (`:90-97`); HS-7 (`:28`), HS-28 (`:49`); `ROLLOUT_ROADMAP.md` §7 "New from E1" (`:361-364`); CLAUDE.md § Pitfalls (`releaseNotes.ts` quoting, LF) and § Product rules.

**Plan-vet:** pending: `xivrp-director` before Task 1. HOME_STRETCH is READY, but this plan corrects its mechanism (below). R-V1B-1 and R-V1B-3 are new and need the vet.

## Spec premises checked against the code

| Spec says | Code says | Ruling |
|---|---|---|
| `fetchGroupByShareCode` should clear a stale `currentGroup` | **Confirmed:** `staticGroupStore.ts:101-115` writes `currentGroup` only on success (`:106`). The catch (`:108-113`) and the start (`:102`) leave it. The switch effects clear only tiers and errors (`GroupView.tsx:150-155`, `NewShell.tsx:247-252`), and the tier effect keys on the unchanged `currentGroup.id` (`GroupView.tsx:187`, `NewShell.tsx:282`). So both shells render the old static with "No Raid Tiers" (`GroupView.tsx:355`, `ShellContentStates.tsx:267`) and the error modal (`GroupView.tsx:416`, `ShellContentStates.tsx:202`). **Root cause 1.** | R-V1B-2 |
| Error branch `:152` and not-found branch `:182` both require `!currentGroup` | **Confirmed** (`ShellContentStates.tsx:152`, `:182`; legacy `GroupView.tsx:291`, `:324`). E1's `:145`/`:175` are stale. | — |
| The branches should "let the error through" | **Corrected.** The branches match their contract ("not-found: load finished, still no group", `ShellContentStates.tsx:14-16`). A direct bad code gets `404 {"detail":"Static group not found"}` (`permissions.py:208-209`), then `ApiError(404)` (`api.ts:255`), then the store's `error` (`:108-113`). So the error branch renders "Error" plus the raw message, and no finished load ever produces branch 3's no-error state. **Root cause 2.** Also in legacy (`GroupView.tsx:291`). | R-V1B-1: fix the store, not the branches |
| — (race) | **No guard.** Nothing sequences `fetchGroupByShareCode`, and neither shell cancels it. A late success for an old code overwrites the newer static today. Clearing on failure without a guard would let a late 404 for an old code wipe the newer static. **Root cause 3.** | R-V1B-3 |
| — (same-code refetch) | Exit Admin Mode refetches the same code (`GroupView.tsx:371`, `NewShell.tsx:153`). The route param can be lowercase, and the backend uppercases it (`routers/static_groups.py:319`). | R-V1B-2 |
| "legacy snapshots unchanged" | No test renders `GroupView`: `GroupRoute.test.tsx:12` stubs it, and the only snapshot in `frontend/src` is `QuickLogMaterialModal.test.tsx`. `e2e/` has no screenshot baselines. | L1/L2 are the first `GroupView` render tests. The byte check is `git diff origin/main -- frontend/src/pages/GroupView.tsx` = Q1's two strings only |

## Rulings (bind every task)

- **R-V1B-1 (a 404 is the not-found state).** In the catch, `error instanceof ApiError && error.status === 404` (precedent `mountFarmStore.ts:78`) → `set({ currentGroup: null, error: null, errorStack: null, errorSource: null, isLoading: false })`. No branch edits in either shell. The only readers of the group store's `error` are the two shells, `GroupViewContent.tsx:102` (content path only), and list/action surfaces fed by other actions. *Cost if wrong:* a reader that expected the 404 message loses it.
- **R-V1B-2 (stale group on any other failure).** A non-404 failure clears `currentGroup` only when `current.shareCode.toUpperCase() !== shareCode.toUpperCase()`. It sets `error`/`errorStack`/`errorSource: 'load'` as today. A same-code refetch failure keeps the page and the overlay, as today. A private or failing static opened from another static therefore shows its full-page card (Private Static / Error) instead of the old static. *Cost if wrong:* that card, which is the spec's "clears a stale currentGroup".
- **R-V1B-3 (sequence guard).** Add a module-level `let shareCodeRequestSeq = 0;` (precedent `joinRequestStore.ts:46,129,134,139`). `const seq = ++shareCodeRequestSeq;` runs first. After the `await`, the success path and the catch each `return` when `seq !== shareCodeRequestSeq`, so a superseded response writes nothing, and `isLoading` stays true until the latest request settles.
- **R-V1B-4 (no clear at fetch start).** A switch between two valid statics keeps today's stale-chrome-while-loading. `ShellContentStates.tsx:262-267` and its test 6b stay unedited. Clearing at start would flash the loading state on every rail switch and on Exit Admin Mode, an unsanctioned V1 change.
- **R-V1B-5 (no test-author).** The implementer writes the tests first, as in R-AD-I (`plans/2026-09-29-ad1b-audit-emits.md:99`). No existing test file is edited.
- **Out of scope (pre-existing, noted only):** recent-statics records bad codes (`useStaticNavMemory.ts:25-38`); late tier-store responses after a switch (the `fetchCurrentWeek`-class race stays in Phase F); `isLoading`/`error` are shared with `fetchGroups` (`staticGroupStore.ts:64`).

## Review Focus

- A lowercase URL (`/group/devtst`) is never treated as stale. Exit Admin Mode keeps the page with no skeleton flash, and a non-404 failure shows the overlay.
- A slow 404 for an old code can't clear a newer static, and a slow success can't overwrite one. `isLoading` stays true until the latest request settles.
- `ShellContentStates.test.tsx` (1–7b, including 6b mid-switch) and every `NewShell.*`/`GroupViewContent.*` suite pass unedited.
- The `GroupView.tsx` diff is Q1's two strings and nothing else. No `ShellContentStates.tsx` diff.

## Task 1 — Store: 404 is not-found, stale group cleared, stale responses dropped (`xivrp-implementer`, sonnet; ~25 product + ~130 test lines)

**Files.** Create `frontend/src/stores/staticGroupStore.fetchByShareCode.test.ts`. Modify `frontend/src/stores/staticGroupStore.ts` (import `ApiError`; R-V1B-1/2/3).

**Failing tests first.** Mock `../services/api` with `importOriginal` so the real `ApiError` survives, and make `authRequest` a `vi.fn()`. Use deferred promises for the races. Reset the store in `beforeEach`. Each test below fails on `main` except S4.
- **S1** Direct 404 → `currentGroup: null`, `error: null`, `isLoading: false`. On `main`, `error` is "Static group not found".
- **S2** Seeded `DEVTST` group, fetch `ZZZZZZ` → 404 → `currentGroup: null`, `error: null`. On `main`, DEVTST is kept and `error` is set.
- **S3** Seeded `DEVTST`, fetch `PRIV01` → `ApiError(403, 'This static is private')` → `currentGroup: null`, `error` is that message, `errorSource: 'load'`.
- **S4** Seeded `DEVTST`, fetch `devtst` → `ApiError(500)` → DEVTST is kept and `error` is set (regression lock for Exit Admin Mode and case).
- **S5** Fetch `ZZZZZZ`, then `BBBBBB`, both deferred. Reject Z with 404: `isLoading` is still true and `error` still null. Resolve B: `currentGroup` is B.
- **S6** Fetch `AAAAAA`, then `BBBBBB`. B resolves, then A resolves: `currentGroup` is still B.

**Ad hoc mutation checks (execute and paste):**
- Drop the catch's seq check → S5 fails.
- Drop `.toUpperCase()` → S4 fails.
- Route the 404 through the generic path → S1 and S2 fail.

## Task 2 — Both shells: integration tests, legacy copy, release note (`xivrp-implementer`, sonnet; ~2 product + ~15 note + ~170 test lines)

**Files.** Create `frontend/src/pages/ShellContentStates.notFound.test.tsx` and `frontend/src/pages/GroupView.notFound.test.tsx`. Modify `frontend/src/pages/GroupView.tsx:328-329` (Q1) and `frontend/src/data/releaseNotes.ts`.

**Tests first.** Use the real stores, and mock `../services/api` as in Task 1.
- **V2** (the `useDevice` and `groupActionsContext` mocks of `ShellContentStates.test.tsx:20-26`; a new file keeps that suite's "never fetches" contract):
  - **N1** An empty store; `await act(() => fetchGroupByShareCode('ZZZZZZ'))` with a 404. Expect `shell-state-not-found` and "Static Not Found", and no `shell-state-error`.
  - **N2** Seed DEVTST plus one tier, with `children` rendered. Fetch `ZZZZZZ` with a 404. Expect not-found, no `content`, no "No Raid Tiers", and `queryByRole('dialog')` null.
- **Legacy** (`createMemoryRouter` + `RouterProvider`; `authRequest` routed by path: `by-code/DEVTST` returns the group, `/tiers` returns `[]`, `by-code/ZZZZZZ` rejects with 404; stub `./GroupViewContent`, `./groupActionsContext` (`GroupActionModals` renders its children), `../components/settings`, `../components/static-group`, `../components/admin/AdminBanners`, `../components/layout/SidebarNav` and `../hooks/useDevice`):
  - **L1** `/group/ZZZZZZ` shows "Static Not Found" (Q1) and no "Error" heading.
  - **L2** `/group/DEVTST`: wait for "No Raid Tiers", then `router.navigate('/group/ZZZZZZ')`. Expect the not-found heading, no "No Raid Tiers", and no dialog.

**Red proof (the acceptance's "fails before the fix"):**
1. `git show <Task-1 BASE>:frontend/src/stores/staticGroupStore.ts > frontend/src/stores/staticGroupStore.ts`, then run both files. All four tests go red; paste the output.
2. `git checkout -- frontend/src/stores/staticGroupStore.ts`, then run them again: green.

**Release note (public).** Bump `CURRENT_VERSION` to the next patch (`2.1.55` today). Add a `fix` item: title `A broken static link shows "Static Not Found"`. Description: `Opening a link to a static that doesn\'t exist showed a bare error, and following one from another static left that static on screen under the wrong link. Both now show "Static Not Found". A private static opened from another static now shows its own page instead of the one you came from.` Add `pr` and `prTitle` once the PR opens. Single quotes throughout, with `\'` escaped. Edit the file with Edit only.

## Finish (controller)

1. **Browser check** (dev-auth `/api/dev-auth/login/0`; one tab per shell, because `?shell=` sticks per tab, `shellPreference.ts:110-113`; a full load resets the store, so the stale case must be client-side). In each tab, load `/group/ZZZZZZ?shell=legacy` (then `?shell=v2`) → not-found. Load `/group/DEVTST?shell=…` → content. Run `history.pushState(null,'','/group/ZZZZZZ'); dispatchEvent(new PopStateEvent('popstate'))` → not-found: no DEVTST name, no "No Raid Tiers", no modal. Back → DEVTST renders; Forward → not-found. `/group/DEVTST?shell=v2&adminMode=true` → Exit Admin Mode → no flash. A rail switch between two valid statics is unchanged. No console errors beyond the expected 404. Take screenshots of both shells' not-found state, shrunk.
2. **Review:** one `redesign-reviewer` pass, then one fix wave. `xivrp-director` change-vets the final diff.
3. **`pr-checklist`:** check the release note, and re-check `CURRENT_VERSION` against `origin/main` at PR time, because P1 runs in parallel and ships a public note too. Also run `git diff --check`; there are no workflow changes. The PR body gets a "Sanctioned V1 edits" section (the table above, HS-7/HS-28) and the Q1/Q2 answers.
4. **Gates, counts pasted:** `pnpm -C frontend build`, `lint` (0 errors), `check:design-system:strict`, `test`, `deadcode` (unchanged). Backend is untouched.
5. **Write-backs, once:**
   - Tick HOME_STRETCH §4 V1B item 1 with the PR, correcting its mechanism line: the store, not the branches (R-V1B-1).
   - Mark PRODUCT_MODEL §6.2's "the not-found fix" bullet ✅ with the PR.
   - Close ROLLOUT_ROADMAP §7's E1 item (`:361-364`): ✅ CLOSED (V1B item 1, #n).
   - If Q2 is "no": add the not-found CTA to the holistic list.
6. **PR:** draft first, marked ready once. Merge when green and every thread is resolved, then rewrite `SESSION_HANDOFF.md`.
