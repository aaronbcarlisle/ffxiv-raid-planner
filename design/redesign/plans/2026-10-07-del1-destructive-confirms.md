# DEL-1 · Destructive confirms: farm delete asks first, the V2 session modal says what Discord will do (W0)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:**
- One click on a trash icon no longer deletes a farm. The Settings → Goals farm row asks first, with a `ConfirmModal` that names the farm. Its delete button can be seen when it has keyboard focus, and its `aria-label` names the farm.
- A lead creating or editing a session in the V2 Schedule sees the same Discord Delivery block as in V1. The block shows whether the session will mirror to Discord Events and which reminders will send, or says what to connect first. Today V2 hides the block but still sends `mirrorToDiscord: true` and `sendDiscordReminders: true`.

**Spec (binding):** `design/redesign/HOME_STRETCH.md` §6.3 W0, the **DEL-1** row (`:374`). Its sources:
- ST-30, `specs/phase-b-audit/legacy-schedule-settings-goals-plugin.md:112`: "Deletes a collection goal directly (no confirm modal here)".
- S-32, `:46` of the same file: the Discord Delivery block renders "only when caller passes discordDeliverySummary".
- P-90 and P-29, `specs/2026-09-30-s2a-parity-matrix.md:161` and `:66`: the farm delete is re-homed and "gains the confirm".

Also binding: the `CLAUDE.md` § UI rules (`ConfirmModal` with a header icon; "A clickable thing must look and announce clickable") and the D6 precedent `plans/2026-08-23-phase-d6-grid-affordances.md:129` (`focus-visible:opacity-100` on a hover-revealed button).

**Slice:** one slice, one PR. Branch `feat/w0-del1`, worktree `.claude/worktrees/guest1`, base `origin/main` `085a0b62`. There are 3 tasks, about **450 changed lines**, more than half of them tests. Frontend only: no backend, no migration, no API change, so the plugin contract is untouched. The V1-visible delta is R-D1-2: the shared Settings farm row gains the confirm in both shells.

**Plan-vet:** `xivrp-director`, 2026-10-07: CHANGES (0 Critical, 3 Important, 8 Minor). Every finding is folded below and tagged `(vet I-n / M-n)`; no re-vet. The OWNER-Q (R-D1-7: show the block vs flip the defaults) is taken as recommended: show the block, keep the defaults, carry C-2.

**Tech stack:** React 19 · Zustand · Vitest + Testing Library · Playwright (local only; CI has no Playwright job).

**Parallel slices:** the S2a-1 stack (#348/#349/#351–#353, drafts, main checkout) is backend-only. There are no file overlaps. `releaseNotes.ts`, `HOME_STRETCH.md` and `PRODUCT_MODEL.md` go **last** (Finish), after merging `origin/main` again. Whoever merges second renumbers the release patch.

**Tests first:** each implementer writes its task's tests first and shows the non-pin ones failing for the right reason before any production edit. Tests marked **(pin)** already pass on `main`: run them, but don't show them failing.

## Premises checked against the code (2026-10-07, `085a0b62`)

1. **Farm delete sites.** There are three:
   - **A**, `components/settings/SettingsPanel.tsx:231-240` (`CollectionGoalsSection`). One click calls `deleteGoal(groupId, goal.id)`. The button is `opacity-0 group-hover:opacity-100` with no focus style and `aria-label="Delete"`. It is shared: `StaticSettingsHost` mounts it in V1 (`pages/GroupView.tsx:101`) and V2 (`pages/V2SettingsHost.tsx:37`), and the Goals tab is not hidden in V2.
   - **B**, `components/static-group/StaticHomeTab.tsx:1318-1344`, V1 only. It already confirms with an inline two-click.
   - **C**, `components/collections/RewardGoalDetailModal.tsx:134-142`, both shells. It already uses a `ConfirmModal` ("Delete Goal", `variant="danger"`).
   - Mount-farm components have no delete. **DEL-1's farm delete is site A.**
2. **`ConfirmModal`** (`components/ui/ConfirmModal.tsx`) takes `isOpen`, `title`, `message`, `confirmLabel`, `variant` (default `danger`, Trash2 icon), `onConfirm` (async; it shows its own spinner) and `onCancel`. Site C is the template.
3. **The session modal is shared.** `components/schedule/CreateSessionModal.tsx` (props `:60-73`) defaults `mirrorToDiscord` and `sendDiscordReminders` to `source?.x ?? true` (`:163-164`). It renders the Discord Delivery block (`:484-539`) only when `discordDeliverySummary` is passed, and `onSubmit` (`:344-347`) always sends both flags.
4. **V1 builds the summary inline.** `components/schedule/ScheduleTab.tsx:148-168` derives it with a `useMemo` over `useScheduleStore().settings`. `sessionDeliveryStatus` (`:170-187`) also uses it, and it is passed to both modal mounts (`:417-434`).
5. **V2 passes nothing.** `components/schedule/Schedule.tsx:504-511` mounts `CreateSessionModal` without a summary and never calls `fetchSettings`. `settings` can be null, or belong to a previously viewed static. `ScheduleIntegrationsPanel.tsx:108-119` has the correct guard: fetch when `(userRole || canManage)` and `settings?.staticGroupId !== groupId`.
6. **Who can read the settings.** `GET /static-groups/{id}/scheduler/settings` is refused for viewers (`backend/app/routers/schedule.py:1149-1151`). In V2 only `canManage` opens the modal: every entry point is gated on it (`WeekNavigatorStrip.tsx:97`, `SessionList.tsx:307/366`, `BestTimesCard.tsx:70`, `AvailabilityHeatmap.tsx:156`) (vet M-3). `scheduleStore.fetchSettings` never rejects and sets `settings` only on success (`scheduleStore.ts:70-80`), so R-D1-6's guard cannot loop.
7. **Existing tests.** There is **no `ScheduleTab` test** anywhere (vet I-1). `components/schedule/Schedule.test.tsx:29-32` mocks `CreateSessionModal` and captures its props. `CreateSessionModal.test.tsx` has no Discord cases. No `SettingsPanel` test covers the farm row. No e2e clicks a farm delete or opens the Discord block.

## Rulings (bind every task)

- **R-D1-1 (scope).** Site A only. Site B (V1-only, already confirms) and site C (already confirms) are untouched. The other hover-only deletes the inventory saw are not farm deletes and are not DEL-1: `profile/GoalCard.tsx:128` (confirms already) and `history/WeeklyLootGrid.tsx:409/425`. They go to the holistic list.
- **R-D1-2 (both shells, sanctioned V1).** Site A is one shared component, so the confirm lands in V1 and V2 alike. This is a protective V1 delta, not a feature change, and it gets a release line. Adding a shell prop to keep V1 one-click would preserve a known data-loss path. Cost if wrong: one prop.
- **R-D1-3 (confirm copy).** Follow site C: title `Delete Farm` (title case, like the panel's "New Farm" and "Remove Objective"; vet M-8), message `Delete "<goal.title>"? This removes its participant progress and drop history.` (verified: both cascade, `reward_participant_state.py:26`, `reward_drop_log.py:23`), `confirmLabel="Delete"`, `variant="danger"`. The modal renders only while a goal is pending, holding one `pendingDelete: { id, title } | null`. Confirm awaits `deleteGoal` inside try/catch: on failure, `toast.error('Failed to delete farm')` unless `wasToastedByApi(err)` (the `Schedule.tsx:227` pattern), and the dialog closes either way, as `ObjectiveGoalsPanel.tsx:204-215` does. `deleteGoal` rethrows and `ConfirmModal` has no catch, so without this a failure is silent (vet I-2). Cancel clears it without calling the store.
- **R-D1-4 (button).** `aria-label={`Delete ${goal.title}`}`, and add `focus-visible:opacity-100` beside `group-hover:opacity-100`. Gating on `canManage` is unchanged.
- **R-D1-5 (summary, one source; sanctioned V1 refactor).** Move the summary `useMemo` body into a pure function plus hook, `useDiscordDeliverySummary(settings)`, in `components/schedule/discordDeliverySummary.ts`, and export its type. The type is what `CreateSessionModal` declares inline today: re-point the prop to the exported type, with no shape change. `ScheduleTab` calls the hook, and its output must stay byte-for-byte the same, including the null-settings case, where V1 shows `Discord` and both disabled. That is the V1 contract: pin it through `ScheduleTab` itself, not a copy (vet I-1). Also change the block's `text-[11px]` (`CreateSessionModal.tsx:488`) to `text-xs`: this slice makes it visible in V2, and W1's sweep covers only V2-only files (sanctioned V1 edit, vet M-5).
- **R-D1-6 (V2 fetch).** `Schedule.tsx` fetches settings with the `ScheduleIntegrationsPanel` guard, narrowed to `canManage`, the only role that opens the modal: `if (canManage && settings?.staticGroupId !== group.id) fetchSettings(group.id).catch(() => undefined)`. It passes the summary to `CreateSessionModal` **only when `settings?.staticGroupId === group.id`**. Otherwise it passes `undefined`, so the block stays hidden rather than describing another static's integrations. Cost if wrong: during the first fetch the block appears a beat late.
- **R-D1-7 (defaults unchanged).** The `?? true` defaults stay. The flags record the lead's intent, and the block says plainly when nothing will publish until Discord is connected ("Connect Discord Events in settings before this can publish"). Changing the defaults would change V1 and silently change what a session does once Discord is connected later. In this slice, "honest" means the V2 lead sees the same truthful block V1 shows. Cost if wrong: a follow-up that flips the defaults on `!mirrorEnabled`, in both shells, with an owner call.

## Review Focus

- R-D1-5: V1 `ScheduleTab` still passes an identical summary in every settings state: null, connected, bot-only, no webhook, and a role mention.
- R-D1-6: no stale-static summary, no fetch for members or viewers, and no fetch loop. Once the fetch resolves, `staticGroupId === group.id`, so the guard goes false.
- R-D1-3: Cancel and Escape never call `deleteGoal`, a failed delete leaves the row, and a double-clicked Confirm deletes only once (the `ConfirmModal` spinner).

## Task 1 — Settings farm delete asks first (`xivrp-implementer`)

**Files:** `frontend/src/components/settings/SettingsPanel.tsx` (`CollectionGoalsSection`) and a new `frontend/src/components/settings/SettingsPanel.farmDelete.test.tsx` (copy the store mocking from `SettingsPanel.roles.test.tsx`).

**Tests first:**
1. Clicking the row's trash opens a dialog titled "Delete farm" that names the goal, and `deleteGoal` is not called yet.
2. Confirm calls `deleteGoal(groupId, goalId)` exactly once, and the dialog closes.
3. Cancel closes the dialog, and `deleteGoal` is never called.
4. The trash button's accessible name is `Delete <goal title>`. With two goals, each button names its own goal.
5. The button's class list contains `focus-visible:opacity-100`.
6. `deleteGoal` rejects (a non-API error): the row stays, `toast.error('Failed to delete farm')` fires, and the dialog closes (vet I-2).
7. Escape closes the dialog and never calls `deleteGoal`.
8. Confirm double-clicked: `deleteGoal` is called once.
9. **(pin)** A non-manager sees no trash button.

**Do:** apply R-D1-3 and R-D1-4. Use `ConfirmModal` from `components/ui`. Don't use raw `<dialog>` and don't add a new modal file.

**Done:** tests 1–7 fail on `085a0b62` for the right reason and pass after the change. `pnpm -C frontend exec vitest run src/components/settings` is green.

## Task 2 — The V2 session modal gets the Discord summary (RISKIEST · `xivrp-implementer-deep`)

**Files:**
- a new `frontend/src/components/schedule/discordDeliverySummary.ts`, with a test file beside it;
- `ScheduleTab.tsx`, `Schedule.tsx` and `CreateSessionModal.tsx` (the prop type only);
- `Schedule.test.tsx`, `CreateSessionModal.test.tsx`.

**Tests first:**
0. **(pin, V1 contract; vet I-1)** New `ScheduleTab.discordSummary.test.tsx`: mock `CreateSessionModal` as `Schedule.test.tsx:30-35` does, seed `useScheduleStore` with the five states (null, connected, bot-only, no webhook, role mention), open "Add session" and assert the captured `discordDeliverySummary` against **literal objects**. Write it and pass it on `085a0b62` **before** any extraction; it must pass unedited after.
1. **(pin)** `buildDiscordDeliverySummary`: write the cases on the current inline `ScheduleTab` logic first by copying the body verbatim, then extract. Cases:
   - null settings → `{ serverLabel: 'Discord', mirrorEnabled: false, remindersEnabled: false, reminderLabels: [], pingLabel: 'No ping' }`;
   - connected link status;
   - bot plus guild without a link;
   - a webhook with no reminder flags → `remindersEnabled: false`;
   - a webhook plus 24h and Missing RSVP;
   - `mentionTarget: 'here'`;
   - role plus `mentionRoleId`;
   - a guild id without a name → `Guild <id>`.
2. V2 `Schedule`, with `canManage` and settings for this group: opening "Add session" passes the modal a `discordDeliverySummary` equal to `buildDiscordDeliverySummary(settings)`. The edit path passes it too.
3. V2 `Schedule`, with `canManage` and settings whose `staticGroupId` is another group: the summary passed is `undefined`, and `fetchSettings(group.id)` is called once.
4. **(pin)** V2 `Schedule` with `canManage: false`: `fetchSettings` is never called (passes on main, which never fetches; vet M-1). Stub `fetchSettings: vi.fn(async () => {})` in the `beforeEach` (`Schedule.test.tsx:127-133`), since R-D1-6 calls `.catch` on it.
5. `CreateSessionModal` with a summary where `mirrorEnabled: false` and `remindersEnabled: false` renders "Connect Discord Events in settings before this can publish" and "Configure a reminder webhook…". With `mirrorEnabled: true` it renders the server label. If these already pass on `main`, mark them **(pin)**; the modal isn't changing behaviour.

**Do:** apply R-D1-5, R-D1-6 and R-D1-7. In `Schedule.tsx`, add `settings` and `fetchSettings` to the existing `useScheduleStore()` destructure (`:96`). Leave `sessionDeliveryStatus` in `ScheduleTab` on the hook's output, with its logic unchanged.

**Done:** tests 2–3 fail on `085a0b62`, and all pass after the change. Test 0 passes before and after, with no edits in between; if an edit seems needed, report it as a concern. `pnpm -C frontend exec vitest run src/components/schedule` is green.

## Task 3 — e2e: the confirm and the block, live (`xivrp-implementer`)

**File:** a new `frontend/e2e/destructive-confirms.spec.ts`, as DevOwner on DEVTST. Seed through the CSRF helper `ownerApiContext` (`e2e/schedule-series.spec.ts:24-30`), set `E2E_API_URL` / `E2E_FRONTEND_URL` (`e2e/helpers/auth.ts:3-4`), and delete any seeded farm in `afterEach` (vet M-4).
1. V2 Settings: open the settings dock (gear) → Goals & Farms → Farms (`?gsub=farms`, `SettingsPanel.tsx:281`; V2SettingsHost is a dock, not a route). Seed a farm via the API, click its trash, and expect the "Delete Farm" dialog. Cancel, and the row is still there. Trash again and Confirm, and the row is gone.
2. Keyboard visibility (vet I-3): move the mouse off the row (`page.mouse.move(0, 0)`), reach the trash with `keyboard.press('Tab')` from the element before it, assert that the focused element's accessible name is `Delete <title>`, and `expect.poll` its computed `opacity` to `'1'`. `toBeVisible` and a programmatic `focus()` prove nothing here.
3. Legacy Settings → Goals & Farms → Farms: the same dialog appears (R-D1-2). Confirm, and the row is gone.
4. V2 Schedule → "Add session": the dialog shows the Discord Delivery heading. Read `GET …/scheduler/settings` first and assert whichever line matches its state: "Connect Discord Events…" when not linked, the server label when linked.

**Done:** the spec passes against local servers (the recipe is in `SESSION_HANDOFF.md`: API `:8021`, frontend `:5179`). Paste the result line. Run `role-gating.spec.ts` once more and confirm it still passes 23/23.

## Finish (controller)

1. Browser walk: V2 Settings farm delete (both themes, for the dialog shot), the legacy farm confirm, V2 Schedule "Add session" with the block, and legacy Schedule "Add session" (unchanged block; vet I-1/M-7). Shots go to `docs/redesign/pr-shots/del1-*`.
2. One `redesign-reviewer` pass over the whole branch, then one fix wave if needed.
3. Write-backs, in one commit after `git merge origin/main`:
   - a `releaseNotes.ts` entry at the highest `RELEASES[].version` on `origin/main` + 1, public, with V1-visible lines for the farm confirm (R-D1-2) and the V2 block, and `CURRENT_VERSION` bumped to match (vet M-7);
   - DEL-1 added to the §6.3 shared-code list (`HOME_STRETCH.md:389`) for the sanctioned V1 edits (vet M-7);
   - the HOME_STRETCH DEL-1 row Gate marked ✅ with the PR;
   - PRODUCT_MODEL §6.1 W0.
4. `pr-checklist`, the gates, a draft PR, then ready, merge when green and every thread is resolved.

## Carried, not DEL-1

- C-1: hover-only deletes outside farms: `history/WeeklyLootGrid.tsx:409/425`, `profile/GoalCard.tsx:128` (a hover-only Edit/Delete cluster with no focus reveal; vet M-6), and any others the reviewer finds. These go to the holistic list, keyboard-visibility pass.
- C-2: if the owner wants `mirrorToDiscord`/`sendDiscordReminders` to default **off** when Discord isn't connected (R-D1-7), that's a both-shell behaviour change and needs an owner call.
- C-4 (whole-branch review): `pages/MorePage.tsx:65-68` reads `useScheduleStore(s => s.settings)` with no `staticGroupId` guard, the stale-static class R-D1-6 guards against. It predates DEL-1 → holistic list.
- C-3: the S2a Progress row menu Delete (`specs/2026-09-30-s2a-progress-design.md:68`) reuses R-D1-3's copy when S2a-5 re-homes the farm list.
