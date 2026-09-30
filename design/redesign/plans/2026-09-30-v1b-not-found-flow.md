# V1B item 1 — The not-found flow (both shells)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo. Items 2–3 of V1B are out of scope.

**Goal:** a bad share code reaches "Static Not Found" in both shells, whether it's opened directly or from another static. Today a direct bad link shows "Error / Static group not found". From another static, the old static stays on screen under the bad URL, with "No Raid Tiers" and an error modal. Once the modal is dismissed, Create First Tier would write to the old static.

**Architecture:** `staticGroupStore.fetchGroupByShareCode` is the fix:
- A 404 produces the state both shells already define as not-found.
- Any other failure drops a stale group.
- A superseded response is ignored.

The shells' branch logic is untouched. Their not-found state only gains the owner's copy and "Go to My Statics" action (R-V1B-6, R-V1B-7). Tests: one new store test file and one new integration test file per shell.

| Edit / newly reached code | Reach | Label |
|---|---|---|
| `frontend/src/stores/staticGroupStore.ts` (`fetchGroupByShareCode`, one module `let`) | both shells (shared store) | V1-visible, sanctioned (HS-7, HS-28) |
| `frontend/src/pages/GroupView.tsx:324-332`: heading and line copy, plus a "Go to My Statics" `Button` | legacy only | V1-visible, sanctioned (HS-7; owner Q1 and Q2, 2026-09-30) |
| `frontend/src/pages/ShellContentStates.tsx:185-189`: `EmptyState` `action` "Go to My Statics" | V2 only | V2-only (owner Q2) |
| No edit, but newly sees `currentGroup` cleared mid-session: legacy Header's static-scoped controls (`Header.tsx:105-118`, `:237`, `:250`, `:274`, `:313`, `:423`, `:444`), the desktop and mobile `TryNewUiBanner` (`Header.tsx:325`, `:444`), the `NotificationCenter` "static" filter (`NotificationCenter.tsx:107-110`), an open legacy settings panel unmounting (`ConnectedSettingsHost`, `GroupView.tsx:403`, sits below the not-found return at `:324`), an open V2 settings dock unmounting (`V2SettingsHost.tsx:33`) | both shells | V1-visible side effects: checked in the browser (Finish 1) and listed in the PR table |
| `frontend/src/data/releaseNotes.ts` | public note, `CURRENT_VERSION` bump | HOME_STRETCH §1 standing rule |
| `NewShell.tsx` | — | no edit |

**Spec (binding):** `design/redesign/HOME_STRETCH.md` §4 V1B item 1 and its acceptance (`:90-97`); HS-7 (`:28`) and HS-28 (`:49`); `ROLLOUT_ROADMAP.md` §7 "New from E1" (`:361-364`). Also CLAUDE.md § Pitfalls (`releaseNotes.ts` quoting, LF), § UI rules and § Product rules.

**Plan-vet:** `xivrp-director`, 2026-09-30: **CHANGES**. Every finding has an outcome:
- 1 → Finish 5.
- 2, 3 → owner rulings R-V1B-6 and R-V1B-7 (2026-09-30). The director confirmed that HS-7's "heading-only fixes" means heading-level skips, not copy.
- 4 → R-V1B-1, R-V1B-2 and the S6 mutation.
- 5 → no plan change: the fold brief carried no action for it.
- 6 → the reach table and Finish 1(c).
- 7 → N2.
- 8 → the red proof.
- 9 → the legacy stubs.
- 10 → Finish 1.
- 11 → no plan change: the fold brief carried no action for it.

**Fold-check** (director, same day): **ALIGNED**, with three doc folds, all folded here:
- The guest landing → R-V1B-7 and Finish 1(g).
- Two more side effects → the reach table and Finish 1(c).
- This outcome list, plus the cites.

## Spec premises checked against the code

| Spec says | Code says | Ruling |
|---|---|---|
| `fetchGroupByShareCode` should clear a stale `currentGroup` | **Confirmed:** `staticGroupStore.ts:101-115` writes `currentGroup` only on success (`:106`). The catch (`:108-113`) and the start (`:102`) leave it. The switch effects clear only tiers and errors (`GroupView.tsx:150-155`, `NewShell.tsx:247-252`, `tierStore.ts:244-246`), and the tier effect keys on the unchanged `currentGroup.id` (`GroupView.tsx:187`, `NewShell.tsx:282`). So both shells render the old static with "No Raid Tiers" (`GroupView.tsx:355`, `ShellContentStates.tsx:267`) and the error modal (`GroupView.tsx:416`, `ShellContentStates.tsx:202`). **Root cause 1.** | R-V1B-2 |
| Error branch `:152` and not-found branch `:182` both require `!currentGroup` | **Confirmed** (`ShellContentStates.tsx:152`, `:182`; legacy `GroupView.tsx:291`, `:324`). E1's `:145`/`:175` are stale. | — |
| The branches should "let the error through" | **Corrected.** The branches match their contract ("not-found: load finished, still no group", `ShellContentStates.tsx:14-16`). A direct bad code gets `404 {"detail":"Static group not found"}` (`permissions.py:208-209`), then `ApiError(404)` (`api.ts:255`), then the store's `error` (`:108-113`). So the error branch renders "Error" plus the raw message (`GroupView.tsx:291` too), and no finished load ever produces branch 3's no-error state. **Root cause 2.** | R-V1B-1: fix the store, not the branches. Write-back to HOME_STRETCH is required (Finish 5) |
| — (race) | **No guard.** Nothing sequences `fetchGroupByShareCode`, and neither shell cancels it. A late success for an old code overwrites the newer static today. Clearing on failure without a guard would let a late 404 for an old code wipe the newer static. **Root cause 3.** | R-V1B-3 |
| — (same-code refetch) | Exit Admin Mode refetches the same code (`GroupView.tsx:368-373`, `NewShell.tsx:153`). The route param can be lowercase, and the backend uppercases it (`routers/static_groups.py:319`). | R-V1B-1, R-V1B-2 |
| "legacy snapshots unchanged" | No test renders `GroupView`: `GroupRoute.test.tsx:12` stubs it, and the only snapshot in `frontend/src` is `QuickLogMaterialModal.test.tsx`. `e2e/` has no screenshot baselines. **No V2 test mounts `NewShell` with the real store**, so V2's route wiring (`NewShell.tsx:247-259`) is proven only by the browser check. | L1/L2 are the first `GroupView` render tests. The byte check is `git diff origin/main -- frontend/src/pages/GroupView.tsx`, which must show only R-V1B-6/7 |

## Rulings (bind every task)

- **R-V1B-1 (a 404 is the not-found state).**
  - In the catch, after the sequence check, `error instanceof ApiError && error.status === 404` (precedent `mountFarmStore.ts:78`) → `set({ currentGroup: null, error: null, errorStack: null, errorSource: null, isLoading: false })`.
  - This applies to the **same** code too, and that is intended. Example: Exit Admin Mode on a static that was deleted meanwhile lands on not-found.
  - No branch-logic edits in either shell.
  - The group store's `error` is read by the two shells, by `GroupViewContent.tsx:102` (content path only), and by list/action surfaces fed by other actions.
  - *Cost if wrong:* a reader that expected the 404 message loses it.
- **R-V1B-2 (stale group on any other failure).**
  - Inside the catch, **after** the sequence check, read `const current = get().currentGroup`. Never use a value captured before the `await`.
  - `current` may be null. Clear only when `current !== null && current.shareCode.toUpperCase() !== shareCode.toUpperCase()`.
  - Set `error`, `errorStack` and `errorSource: 'load'` as today.
  - A same-code non-404 failure keeps the page and the overlay, as today.
  - A private or failing static opened from another static shows its full-page card (Private Static / Error) instead of the old static.
- **R-V1B-3 (sequence guard).**
  - Add a module-level `let shareCodeRequestSeq = 0;` (precedent `joinRequestStore.ts:46,129,134,139`). `const seq = ++shareCodeRequestSeq;` runs first.
  - After the `await`, both the success path and the catch `return` when `seq !== shareCodeRequestSeq`. A superseded response writes nothing, and `isLoading` stays true until the latest request settles.
- **R-V1B-4 (no clear at fetch start).**
  - A switch between two valid statics keeps today's stale-chrome-while-loading. `ShellContentStates.tsx:262-267` and its test 6b stay unedited.
  - Clearing at start would flash the loading state on every rail switch and on Exit Admin Mode, an unsanctioned V1 change.
- **R-V1B-5 (no test-author).** The implementer writes the tests first, as in R-AD-I (`plans/2026-09-29-ad1b-audit-emits.md:99`). No existing test file is edited.
- **R-V1B-6 (owner Q1, 2026-09-30: legacy copy).**
  - `GroupView.tsx:328-329` becomes "Static Not Found" / "The static you're looking for doesn't exist.", matching `ShellContentStates.tsx:187-188` and `HOME_STRETCH.md:93`.
  - The markup and classes stay as they are.
- **R-V1B-7 (owner Q2, 2026-09-30: keep the way out).** The not-found state gets "Go to My Statics" → `/profile?tab=statics` in both shells, as the Error card has today (`ShellContentStates.tsx:169-174`, `GroupView.tsx:312-316`).
  - V2: pass `action={{ label: 'Go to My Statics', onClick: () => navigate('/profile?tab=statics') }}` to `EmptyState`, which renders a primitive `Button` (`EmptyState.tsx:30-33`).
  - Legacy: after the `<p>`, add `<div className="flex justify-center mt-4"><Button onClick={() => navigate('/profile?tab=statics')}>Go to My Statics</Button></div>` (`Button` from `GroupView.tsx:29`, `navigate` from `:106`).
  - It goes in the PR's sanctioned-edits table.
  - **A logged-out user can land here too.** A share link opens for guests because `by-code` auth is optional (`routers/static_groups.py:315`).
    - The button then goes to `/profile?tab=statics`. `Profile` renders nothing (`Profile.tsx:269`), then redirects to `/` (`:191-193`).
    - That matches the Error card's button today, so it is parity, not a regression.
    - Whether guests should see this button at all is a taste call for the punch list (Finish 5). The Error card's private branch offers them "Log In with Discord" instead (`ShellContentStates.tsx:163-167`).
- **Out of scope (pre-existing, noted only):**
  - Recent-statics records bad codes (`useStaticNavMemory.ts:25-38`).
  - Late tier-store responses after a switch (the `fetchCurrentWeek`-class race stays in Phase F).
  - `fetchGroups` shares `isLoading`/`error` (`staticGroupStore.ts:64`).

## Review Focus

- A lowercase URL (`/group/devtst`) is never treated as stale. On Exit Admin Mode, a non-404 failure keeps the page with the overlay, and a 404 lands on not-found.
- A slow 404 for an old code can't clear a newer static, and a slow success can't overwrite one. `isLoading` stays true until the latest request settles.
- `ShellContentStates.test.tsx` (1–7b, including 6b mid-switch) and every `NewShell.*`/`GroupViewContent.*` suite pass unedited.
- Two diffs only, beyond the store:
  - `GroupView.tsx`: R-V1B-6's two strings plus R-V1B-7's action block.
  - `ShellContentStates.tsx`: only the `action` prop.

## Task 1 — Store: 404 is not-found, stale group cleared, stale responses dropped (`xivrp-implementer`, sonnet; ~25 product + ~140 test lines)

**Files.** Create `frontend/src/stores/staticGroupStore.fetchByShareCode.test.ts`. Modify `frontend/src/stores/staticGroupStore.ts` (import `ApiError`; R-V1B-1/2/3).

**Failing tests first.** Mock `../services/api` with `importOriginal` so the real `ApiError` survives, and make `authRequest` a `vi.fn()`. Use deferred promises for the races, and reset the store in `beforeEach`. Every test fails on `main` except S4 and S7.
- **S1** Direct 404 → `currentGroup: null`, `error: null`, `isLoading: false`. On `main`, `error` is "Static group not found".
- **S2** Seed `DEVTST`, fetch `ZZZZZZ`, 404 → `currentGroup: null`, `error: null`. On `main`, DEVTST is kept and `error` is set.
- **S3** Seed `DEVTST`, fetch `PRIV01` → `ApiError(403, 'This static group is private')` (the real message, `permissions.py:372`) → `currentGroup: null`, `error` is that message, `errorSource: 'load'`.
- **S4** Seed `DEVTST`, fetch `devtst` → `ApiError(500)` → DEVTST kept, `error` set. This locks in Exit Admin Mode and case-insensitivity.
- **S5** Fetch `ZZZZZZ`, then `BBBBBB`, both deferred:
  - Reject Z with 404: `isLoading` is still true and `error` still null.
  - Resolve B: `currentGroup` is B.
- **S6** Fetch `AAAAAA`, then `BBBBBB`. B resolves, then A resolves: `currentGroup` is still B.
- **S7** No group seeded, fetch `PRIV01` → 403 → `currentGroup: null`, `error` set, no throw (a null `current` is handled).
- **S8** Seed `DEVTST`, fetch `DEVTST` → 404 → `currentGroup: null`. This is the R-V1B-1 same-code case.

**Ad hoc mutation checks (execute and paste):**
- Drop the catch's seq check → S5 fails.
- Drop the success path's seq check → S6 fails.
- Drop `.toUpperCase()` → S4 fails.
- Route the 404 through the generic path → S1, S2 and S8 fail.

## Task 2 — Both shells: integration tests, copy, "Go to My Statics", release note (`xivrp-implementer`, sonnet; ~10 product + ~15 note + ~200 test lines)

**Start only after Task 1 is committed** (ledger `Task 1: complete (commits …)`), so the red proof can't touch uncommitted work.

**Files.** Create `frontend/src/pages/ShellContentStates.notFound.test.tsx` and `frontend/src/pages/GroupView.notFound.test.tsx`. Modify `frontend/src/pages/GroupView.tsx:324-332` (R-V1B-6/7), `frontend/src/pages/ShellContentStates.tsx:185-189` (R-V1B-7) and `frontend/src/data/releaseNotes.ts`.

**Tests first.** Use the real stores, and mock `../services/api` as in Task 1. Scope each button query `within` the not-found container: the Error card has the same button, so an unscoped query would pass on `main`.
- **V2** file: reuse the `useDevice` and `groupActionsContext` mocks from `ShellContentStates.test.tsx:20-26`. A new file keeps that suite's "never fetches" contract. It needs a `/profile` probe route.
  - **N1** Empty store; `await act(() => fetchGroupByShareCode('ZZZZZZ'))` with a 404. Expect:
    - `shell-state-not-found` and "Static Not Found";
    - no `shell-state-error`;
    - "Go to My Statics" within it, and clicking it reaches the `/profile` probe.
  - **N2** Seed the real mid-switch state: `currentGroup` DEVTST, `tiers: []`, `isLoading: false` (`clearTiers`, `tierStore.ts:244-246`, called at `NewShell.tsx:248-252`). Fetch `ZZZZZZ` with a 404. Expect not-found, no "No Raid Tiers", and `queryByRole('dialog')` null. On `main`, the same seed renders "No Raid Tiers" plus the dialog.
- **Legacy** file: `createMemoryRouter` + `RouterProvider`, with a `/profile` probe route.
  - Route `authRequest` by path: `by-code/DEVTST` returns the group, `/tiers` returns `[]`, and `by-code/ZZZZZZ` rejects with a 404.
  - Stubs:
    - `./GroupViewContent`.
    - `./groupActionsContext`, exporting all three names `GroupView.tsx:42` imports: `GroupActionModals` renders its children; `useGroupActions` returns spies for `onTierChange`, `onAddPlayer`, `onNewTier`, `onRollover` and `onDeleteTier`, which `HeaderEventBridge` (`:55-67`) and `CreateFirstTierButton` use; `useGroupAddToRoster` returns a `vi.fn()`.
    - `../components/settings`, `../components/static-group`, `../components/admin/AdminBanners`, `../components/layout/SidebarNav` and `../hooks/useDevice`.
    - `../components/layout/Header` stays real, or its stub exports `HEADER_EVENTS` (`Header.tsx:33`, imported at `GroupView.tsx:36`).
  - **L1** `/group/ZZZZZZ` shows "Static Not Found" and no "Error" heading. "Go to My Statics" sits beside the heading, and clicking it reaches the probe.
  - **L2** `/group/DEVTST`: wait for "No Raid Tiers", then `router.navigate('/group/ZZZZZZ')`. Expect "Static Not Found", no "No Raid Tiers", and no dialog.

**Red proof (the acceptance's "fails before the fix"):**
1. Run `git show <Task-1 BASE>:frontend/src/stores/staticGroupStore.ts > frontend/src/stores/staticGroupStore.ts`, then both files. N1, N2, L1 and L2 all go red; paste the output.
2. Restore with `git show HEAD:frontend/src/stores/staticGroupStore.ts > frontend/src/stores/staticGroupStore.ts` (never `git checkout --`). `git status --short` must not list the store. Rerun: green.

**Release note (public).**
- Bump `CURRENT_VERSION` to `2.1.55`. P1 (`feat/p1-safety-parity`) claims it too; whichever merges second takes the next patch.
- Add a `fix` item titled `A broken static link shows "Static Not Found"`.
- Description: `Opening a link to a static that doesn\'t exist showed a bare error, and following one from another static left that static on screen under the wrong link. Both now show "Static Not Found", with a button back to your statics. A private static opened from another static now shows its own page instead of the one you came from.`
- Add `pr` and `prTitle` once the PR opens.
- Use single quotes throughout, with `\'` escaped, and edit the file with Edit only.

## Finish (controller)

1. **Browser check, in both shells.**
   - Setup:
     - Log in with dev-auth `/api/dev-auth/login/0` (admin).
     - Use one tab per shell: `?shell=` sticks per tab (`shellPreference.ts:110-113`).
     - A full load resets the store, so the stale case must be client-side: `history.pushState(null,'',P); dispatchEvent(new PopStateEvent('popstate'))`, called "nav to P" below.
   - Per tab (`?shell=legacy`, then `?shell=v2`):
     - (a) `/group/ZZZZZZ` → "Static Not Found". Its "Go to My Statics" lands on `/profile?tab=statics`.
     - (b) `/group/DEVTST`, then nav to `/group/ZZZZZZ` → not-found: no DEVTST name, no "No Raid Tiers", no modal. Back → DEVTST renders; Forward → not-found.
     - (c) During (b), watch the newly reached chrome from the reach table:
       - Legacy Header's static controls and the desktop and mobile `TryNewUiBanner` hide.
       - The bell's "static" filter empties.
       - Legacy: open the settings panel, nav to the bad code (the panel unmounts), go Back, and check the panel's state on DEVTST.
       - V2: with the settings dock open before the nav, the dock closes cleanly.
     - (d) Private static:
       - As `login/0`, create a second static (private by default) and note its code.
       - As `login/2` (not an admin, not a member), open `/group/DEVTST` (public after dev login, `dev_auth.py:419-420`) and nav to that code.
       - Expect "Private Static", not DEVTST. The 403 toast (`api.ts:251-253`) is expected.
     - (e) Exit Admin Mode as `login/0` on `/group/DEVTST?adminMode=true`, on the legacy path (`GroupView.tsx:368-373`) and in V2 → the page stays, with no skeleton or not-found flash.
     - (f) A rail or static-switcher switch between two valid statics is unchanged.
     - (g) Logged out, legacy only: `/group/ZZZZZZ` → not-found → "Go to My Statics" → lands on `/` with no console error (R-V1B-7's guest landing).
   - No console errors beyond the expected 404/403. Screenshots of both shells' not-found state, shrunk.
2. **Review:** one `redesign-reviewer` pass, then one fix wave. `xivrp-director` change-vets the final diff.
3. **`pr-checklist`:**
   - Check the release note. Re-check `CURRENT_VERSION` against `origin/main` at PR time.
   - Run `git diff --check`. There are no workflow changes.
   - The PR body gets a "Sanctioned V1 edits" table: the reach table above, with the store, legacy copy and "Go to My Statics", plus the Header, `TryNewUiBanner`, `NotificationCenter`, legacy settings panel and V2 dock rows as side effects, citing HS-7/HS-28 and the owner's 2026-09-30 rulings.
4. **Gates, counts pasted:** `pnpm -C frontend build`, `lint` (0 errors), `check:design-system:strict`, `test` and `deadcode` (unchanged). The backend is untouched.
5. **Write-backs, once (all required):**
   - HOME_STRETCH §4 V1B item 1: tick it with the PR, and **rewrite its mechanism line**: the store maps a 404 to not-found, clears a stale static on other failures and drops superseded responses. The branches were already right (R-V1B-1). Name the not-found "Go to My Statics" action (R-V1B-7).
   - PRODUCT_MODEL §6.2's "the not-found fix" bullet: ✅ with the PR.
   - ROLLOUT_ROADMAP §7's E1 item (`:361-364`): ✅ CLOSED (V1B item 1, #n).
   - HOME_STRETCH §5.3, Phase P's pre-seeded punch list, which is the holistic-review home for taste calls (HS-11): add "Go to My Statics shown to guests on not-found (and on the Error card); the private branch shows them Log In with Discord instead (`ShellContentStates.tsx:163-167`)".
6. **PR:** draft first, marked ready once. Merge when green and every thread is resolved, then rewrite `SESSION_HANDOFF.md`.
