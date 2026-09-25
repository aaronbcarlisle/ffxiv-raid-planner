# Phase D · D14 — Elsewhere, shortcuts, write-backs (Phase D close-out)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** D14 closes Phase D. It:
- moves `FairnessSummary` to static Home (R-40);
- binds D-54's surviving loot shortcuts in v2 and makes the shortcut help truthful for each shell (R-42, A16);
- namespaces `roster-hide-subs` v2-side (§9);
- pins DoD-2's one-logging-model call-site set with a test;
- writes back the Phase D decisions, with the DoD-1 in-app sweep as the evidence.

**Architecture:**
- **Fairness on Home.** `FairnessSummary` is v2-owned and presentational. It leaves `Loot.tsx`'s History branch and mounts at the top of Home's side column, in a titled card. It is fed by the same derivations Loot uses, for anyone who can view the static.
- **Shortcuts.** v2's loot bindings register locally in `Loot.tsx` through the shared `useKeyboardShortcuts` hook (the R-D11-C precedent `Ctrl+Shift+F` set). The legacy block in `useGroupViewKeyboardShortcuts` stays byte-identical.
- **The help registry** splits by shell:
  - `SHORTCUT_GROUPS` stays V1's list, with unchanged content;
  - `V2_SHORTCUT_GROUPS` becomes v2's complete list, no longer an append;
  - the help overlay takes a `groups` prop that defaults to V1's list.
- **Subs toggle.** The hide-subs key follows `useRosterSortPreset`'s C6 shape: read the v2 key, fall back to the legacy key, write v2 only.

**Tech stack:** React 19 · TypeScript · Zustand 5 (`lootTrackingStore`) · Vitest + Testing Library · Tailwind 4 semantic tokens.

**Spec (binding):**
- **`design/redesign/specs/phase-d-loot-plan.md`:**
  - `:207` — the D14 row;
  - `:211-235` — the Phase D DoD;
  - `:244` — §5: the shortcut help needs an explicit user decision;
  - `:128-130` — how the release note is decided.
- **`design/redesign/specs/phase-d-loot-design.md`:** R-40 `:1795`, R-42 `:1832-1854` (the binding table), §9 `:1981-1988`.
- **`design/redesign/specs/v1-v2-parity-matrix.md`:** A16 `:576` (v2's help gives four wrong answers), D-54 `:512`, and the D-xx rows written back at the finish.
- **Drift:** the plan row cites `Loot.tsx:396-404` for the fairness mount. On `main` it is at `Loot.tsx:1214-1224`, gated on `lview === 'history'`. The write-back corrects it.

**Plan-vet:** `xivrp-director`, 2026-09-25: NOT-READY, with 1 Blocker, 8 Major and 8 Minor findings. All are folded in below.
- **B1** is the DoD-1 in-app sweep before any "Phase D complete" claim, with D-18 still open.
- **M7** went to the user and became R-D14-C.

---

## Rulings (bind every task)

| ID | Ruling | Why | Cost if wrong |
|---|---|---|---|
| R-D14-A | **User ruling (2026-09-25): a shell-aware registry.** V1's `Shift+?` help renders **byte-identical** to `main`. v2's help and command palette list **only what v2 binds**, and **every** v2 binding appears in them, described as v2 behaves | §5 requires an explicit decision. This keeps V1 frozen and closes A16 | None to V1. A wrong v2 row is a copy fix |
| R-D14-B | **User ruling (2026-09-25): `FairnessSummary` sits at the top of Home's side column**, above `StaticActivityFeed`, inside a titled `CardShell` like its neighbours (`home/StaticActivityFeed.tsx:70-71`). Its grid is re-fitted for the narrow column (`FairnessSummary.tsx:45` is `sm:grid-cols-2 lg:grid-cols-4` today; Home is now its only mount) | D13 reserved the slot (R-D13-C). The module is small | A visual call; on the holistic-review list |
| R-D14-C | **User ruling (2026-09-25): anyone who can view sees fairness on Home.** Home fetches the loot log, page ledger and material log for **non-member viewers** too, read-only, mirroring Loot's viewer path (`Loot.tsx:641-643`; the backend serves these reads for public statics, `backend/app/routers/loot_tracking.py:142-144`). Balance fetches, registrations and `TeamSummaryCard` stay **members-only** (R-D13-G/J unchanged) | "Move, not restore": public viewers see fairness on History today, and must not lose it | One extra read per Home visit for public viewers |
| R-D14-D | **Fairness inputs on Home are the same derivations as Loot's mount** (`Loot.tsx:1216-1224`): `players` = `configured && !isSubstitute`; `settings` and `floors` use Loot's source expressions (`floors` via `getTierById(tier.tierId)?.floors`); `currentWeek` = the store's `currentWeek`, which **is** `clock.currentWeek` (`hooks/useWeekClock.ts:28`) and which Home already reads (`Home.tsx:90`) | The rollup must not change with the move (R-40) | The numbers drift between shells. A Home test pins them |
| R-D14-E | **v2 loot-shortcut scope matches the control each key mirrors:**<ul><li>`Alt+L` log a drop and `Alt+U` log a material work on **every Loot view** for `canEdit`, like `LootToolbar`'s buttons (`LootToolbar.tsx:58-91`, mounted at `Loot.tsx:1082`).</li><li>`Alt+←` / `Alt+→` step the displayed week on the **Log only**, with **no role gate**, since viewers use the chevrons (`WeekScopeControl.tsx:233-240,294-300`). They do nothing at the bounds.</li><li>`Alt+B` marks a floor cleared on the **Log only**, for `canEdit`.</li></ul>All of them register in `Loot.tsx`'s local `useKeyboardShortcuts` block (`:571-603`), never in `useGroupViewKeyboardShortcuts` | R-42 rebinds only the week and books keys to the Log (`phase-d-loot-design.md:1839-1842`). The rest follow their visible control. The shared hook's `legacyLootSurface` block is V1-live | A wrong surface: a one-line condition. **D-54 write-back:** V1's cross-tab `Alt+L`/`U`/`B` (`useGroupViewKeyboardShortcuts.ts:178-198`) are narrowed to the Loot surface |
| R-D14-F | **The one modal guard for every Loot key:** `anyModalOpen` **or** Loot's new `markClearedOpen` state **or** focus inside an open dialog. The focus check currently lives inside the `Ctrl+Shift+F` action (`Loot.tsx:600`); it moves into a local guard that every Loot key, `Ctrl+Shift+F` included, runs through | `anyModalOpen` deliberately leaves out the Log-only overlays (`Loot.tsx:552-553`). `BookLedgerCard` keeps two more modals in internal state (`:150-151`) | A key firing under a dialog. Tests open `EditBookBalanceModal` and the `Shift+?` help |
| R-D14-G | **`Alt+B` opens the same `MarkFloorClearedModal` as the books card's button**, through an **optional controlled-open prop** on `BookLedgerCard`. When the prop is omitted, the card keeps its internal state. Its only importer is `Loot.tsx:182` | Today the card owns `showMarkCleared` internally (`BookLedgerCard.tsx:152,447-451`), with no seam | None: a single importer |
| R-D14-H | **Registry shape.** `SHORTCUT_GROUPS` keeps its name and exact content. `V2_SHORTCUT_GROUPS` becomes v2's complete list. A row whose text is identical in both shells is authored once, as a named constant. `KeyboardShortcutsHelp`'s `extraGroups` prop is **replaced** by `groups?: ShortcutGroup[]`, which defaults to a module-scope `SHORTCUT_GROUPS` reference. The legacy mount (`Layout.tsx:144-148`) passes nothing | One author per row. The V1 render path is unchanged by construction | Reviewer churn on naming only |
| R-D14-I | **The V1 guard is a literal.** Before touching the registry, Task 3 copies today's `SHORTCUT_GROUPS` into the tests as a **literal fixture**. Two tests assert against that literal, never against the export: the help component's legacy test (T-28) **and** Layout's legacy-mount test (T-29, `Layout.chrome.test.tsx:241-248`) | Comparing against the export would pass vacuously after the list is edited, and T-29 today only checks that two v2 rows are absent | None: a stricter test |
| R-D14-J | **Hide-subs uses a v2 key:** `v2-roster-hide-subs`. The read order is v2 key → legacy `roster-hide-subs` → `false`. Writes go to the v2 key only. A v2-local hook in `components/roster/`. `GroupViewContent.tsx` is untouched | §9's ruling (2026-07-28) and the C6 shape (`useRosterSortPreset.ts:41-113`) | None to V1. A v2 toggle stops bleeding into V1, which is the intent |
| R-D14-K | **The DoD-2 enumeration pins (file, function) call pairs as they are on `main`.** Each pair is tagged **v2-reachable** (with its import chain) or **V1-only**. It covers `logLootAndUpdateGear`, `logMaterialAndUpdateGear` and the nine book-changing store actions (`stores/lootTrackingStore.ts:81-89`). It matches **call expressions**, not mentions in comments or `typeof` (`RecipientPicker.tsx:5,313`). **Call sites are not edited to fit the doc:** the write-back amends DoD-2's literal list (`phase-d-loot-plan.md:216-219`) to the real, tagged set | The test documents the model; it is not a refactor. The known extras are listed in Task 4 | DoD-2's text is corrected at the write-back |

**Release note:** internal (`internal: true`, `CURRENT_VERSION` untouched). R-D14-A keeps V1's help byte-identical, so no V1-visible line changes (`phase-d-loot-plan.md:128-130`). R-D14-I's two literal tests are the evidence. It is written at the finish, once the draft PR number exists.

**Riskiest task: Task 3.** The registry crosses the V1 freeze in `ui/` and `Layout.tsx`. Dispatch `xivrp-implementer-deep`, then run one task-scoped review.

**Budget contingency:** if the branch diff passes about 1,300 lines before the Finish, Task 4 and the write-back split off as **D14b**, with their own PR.
**✅ Taken 2026-09-25.** The branch reached 1,555 lines (1,035 of them tests).
- **D14a** (this PR) is Tasks 1–3 plus their fix wave.
- **D14b** is Task 4 (committed as `97cec462` on `feat/phase-d14b-closeout`, rebased onto `main` after D14a merges) plus Finish §2 (the DoD-1 sweep), §4 (DoD checks and the director phase-close vet) and §5 (the write-back).
- **D14b's write-back must also record:**
  - R-D14-A's scope qualifier: "every v2 binding" means static-view and global keys; page-local keys on Profile, SetupWizard and the priority editors are out;
  - the D-54 narrowing (R-D14-E);
  - Loot's keys `preventDefault` while a Loot modal is open, because the local block no longer passes `disabled: anyModalOpen`.

**Main baselines** (`c0d4b4e2`): test 3244 · lint 0 errors / 903 warnings · knip files 15 / exports 179 / types 140.

**Gates for every task:**
- `pnpm build` (`tsc -b` type-checks the tests; Vitest does not);
- `pnpm lint`: 0 errors, warnings ≤ 903;
- `pnpm check:design-system:strict`;
- the task's `vitest` scope.

Paste each result line.

---

## Task 1 — `FairnessSummary` → static Home (R-40, R-D14-B/C/D)

**Files:**
- modify `frontend/src/components/home/Home.tsx`, `frontend/src/components/home/Home.test.tsx`, `frontend/src/components/loot/FairnessSummary.tsx` (grid and doc comment only), `frontend/src/components/loot/Loot.tsx` and `frontend/src/components/loot/Loot.test.tsx`;
- touch nothing else.

1. **Home mount (R-D14-B):** make the fairness module the **first** child of the `side` region's `flex flex-col gap-4` wrapper (`Home.tsx:331-336`).
   - Wrap it in a titled `CardShell` that matches `StaticActivityFeed`'s usage: title "Loot fairness", with an icon, as every card header has one.
   - Render it whenever a tier exists, with no membership gate (R-D14-C).
2. **Inputs (R-D14-D):**
   - `players`, `settings` and `floors` use Loot's source expressions (`Loot.tsx:1216-1224`).
   - `currentWeek` is the `currentWeek` Home already reads (`:90`).
   - Read `materialLog` from `useLootTrackingStore`.
3. **Fetches (R-D14-C):**
   - **Leave the member path exactly as it is.** That is the `Promise.all` with one toast, plus the member-gated `fetchMaterialLog` at `:134`, kept outside the `Promise.all` on purpose.
   - Add a **non-member** branch that fetches `fetchLootLog`, `fetchPageLedger` and `fetchMaterialLog` for the tier, with the same error handling as Loot's viewer path (`Loot.tsx:641-643`; cite what that is).
   - Balances and registrations stay member-only.
4. **`FairnessSummary.tsx`:**
   - Re-fit the grid for the side column: two columns at every width ≥ `sm`, and no four-column step. Home is now its only mount.
   - Fix the doc comment at `:2` ("atop the History view").
   - No logic change.
5. **Loot unmount:**
   - Delete the History-branch mount (`Loot.tsx:1214-1224`), its comment (`:1225-1228`) and the dead import (`:181`).
   - Update the comments at `:15` and `:114-115`, and Home's header comment (`Home.tsx:4-8`).
6. **Loot tests:**
   - `Loot.test.tsx:769-796`: fairness is absent on every `lview`. Each History case **also** asserts something positive on History (the search box or the table).
   - `:938-943` (the R-D10-H order): re-anchor to what is now first on History, keeping the intent. Cite the anchor.
   - `:1987-2014` is the `WeekCountBar` input test: **keep it** and fix only its comments (`:1993`, `:2008`).
7. **Home tests:**
   - A member sees the fairness module above the activity feed, in DOM order.
   - A **non-member viewer** sees it too. That case fetches the three logs, fetches neither balance nor `fetchRegistrations`, and does not render Team Summary.
   - Seeded with one substitute and one unconfigured seat, fairness counts only `configured && !isSubstitute`. Mutation check: drop the filter, paste the failing line, then revert.
   - Every D13 Home test stays green **unchanged**.

**Done when:** the gates pass on `src/components/home src/components/loot`. Commit: `feat(v2): D14 Task 1 — FairnessSummary moves to static Home (R-40)`.

---

## Task 2 — v2's loot shortcuts (R-42, R-D14-E/F/G)

**Files:**
- modify `frontend/src/components/loot/Loot.tsx`, `frontend/src/components/loot/BookLedgerCard.tsx` and their tests;
- do **not** touch `hooks/useGroupViewKeyboardShortcuts.ts`, `hooks/useKeyboardShortcuts.ts` or anything under `history/`.

1. **`BookLedgerCard` seam (R-D14-G):**
   - Add an optional controlled pair, `markClearedOpen?: boolean` and `onMarkClearedOpenChange?: (open: boolean) => void`.
   - When the pair is omitted, the card keeps its internal state.
   - The card's own button and the modal's close both go through whichever state source is active.
   - Test both modes.
2. **One guard (R-D14-F):**
   - Hoist the focus-in-dialog check out of the `Ctrl+Shift+F` action (`Loot.tsx:600`) into a local guard: `anyModalOpen || markClearedOpen || focusInsideDialog()`.
   - Every Loot key uses it, `Ctrl+Shift+F` included, and `Ctrl+Shift+F`'s tests stay green.
3. **Bindings (R-D14-E):** extend the local block (`Loot.tsx:571-603`).
   - `Alt+L` and `Alt+U` call the **same handlers** as `LootToolbar`'s log buttons on every view, for `canEdit`.
   - `Alt+ArrowLeft` and `Alt+ArrowRight` call `logWeek.prev` and `logWeek.next` (`components/loot/useLogWeek.ts:353-361`) on the Log only, with no role gate. They do nothing when `canPrev`/`canNext` is false.
   - `Alt+B` opens the card's controlled state on the Log, for `canEdit`.
4. **Browser defaults:** `useKeyboardShortcuts` already calls `preventDefault` on a match (`:83`) and skips input focus (`:34-43`, `:70`). Test that `Alt+←` is `defaultPrevented` on the Log, so the browser doesn't go Back.
5. **Tests (`Loot.test.tsx`):**
   - **Editor:** `Alt+L`/`U` fire on Priority, Log and History; `Alt+B` fires on the Log only.
   - **Viewer:** `Alt+L`/`U`/`B` do nothing, and `Alt+←`/`→` step the week on the Log.
   - Every key does nothing while each of these is open: a typed Loot modal, `EditBookBalanceModal`, and the `Shift+?` help.
   - `Alt+←` at the first week does nothing.
   - `Alt+B` → the modal opens, end to end.
   - Mutation checks, pasting the failing line for each: (a) drop the `lview === 'log'` condition on the week keys; (b) drop `focusInsideDialog()` from the guard.

**Done when:** the gates pass on `src/components/loot`. Commit: `feat(v2): D14 Task 2 — loot shortcuts in v2 (Alt+L/U everywhere, Alt+←/→/B on the Log)`.

---

## Task 3 — Shell-aware shortcut registry (R-D14-A/H/I) — RISKIEST

**Files:**
- modify `frontend/src/components/ui/keyboardShortcutGroups.ts`, `frontend/src/components/ui/KeyboardShortcutsHelp.tsx`, `frontend/src/components/layout/Layout.tsx` (**the v2 branch only**, `:~104`) and `frontend/src/components/layout/CommandPalette.tsx`, plus their tests (including `Layout.chrome.test.tsx`);
- the two `ui/` files and `Layout.tsx` are **shared**: V1 renders them.

1. **Literal fixture first (R-D14-I):**
   - Before any registry edit, copy today's `SHORTCUT_GROUPS` into a test fixture as a literal: every group title, key, description and `adminOnly` flag.
   - Re-point T-28 (`KeyboardShortcutsHelp.test.tsx:53-70`) **and** T-29's legacy case (`Layout.chrome.test.tsx:241-248`) at it, asserting the full (key, description) rows in order.
   - Run both green against `main`'s code and paste the result.
2. **Trace every v2 binding.** Sources:
   - `hooks/useGroupViewKeyboardShortcuts.ts`: the non-legacy entries, including `V` → `loot:toggle-expand-all`, handled by `WeaponPriorityList.tsx:940`, mounted at `Loot.tsx:1389`;
   - `hooks/useGlobalKeyboardShortcuts.ts:39-62`: `Shift+S`, `Shift+?`, `Ctrl+Shift+S`;
   - `pages/NewShell.tsx:296`: ⌘K;
   - `components/roster/useRosterViewShortcuts.ts`: `G` grouping, `S` subs;
   - `components/roster/useRosterDensity.ts:100`: `V` on the Roster;
   - `Loot.tsx`'s local block, including Task 2;
   - `layout/Spine.tsx`;
   - the D-55 `Shift+Click` / `Alt+Click` sites.

   Build the complete `V2_SHORTCUT_GROUPS` from what these bind. Describe each row as v2 behaves, per surface where one key does different things (for example, `V` on the Roster vs on Loot's weapon list, and `G` = light-party grouping). Remove A16's wrong answers: `Alt+1-3`, `G` "grid view", and the global "Change week" (now "Log: previous / next week").

   The report carries a table: **every v2 row → its binding `file:line`**, and every binding found → its row.
3. **Shared constants (R-D14-H):**
   - A row whose text is identical in both shells becomes one named constant that both lists use.
   - `SHORTCUT_GROUPS` still deep-equals the literal.
   - Rewrite the D11 comment at `:88-98` to describe the split.
4. **Consumers:**
   - `KeyboardShortcutsHelp`: `extraGroups` becomes `groups?`, defaulting to the module-scope `SHORTCUT_GROUPS`. The `adminOnly` filter is unchanged.
   - `Layout.tsx` v2 branch: `groups={V2_SHORTCUT_GROUPS}`. The legacy branch is untouched.
   - `CommandPalette.tsx:264`: `V2_SHORTCUT_GROUPS` only. Update the comment at `:263`.
   - Update T-29's v2 case (`:250`).
5. **Shared-file hunk list (§2.1):** in the report, list every hunk in the three shared files, each with its V1 render path. Paste `git diff main -- frontend/src/hooks/useGroupViewKeyboardShortcuts.ts frontend/src/pages/GroupViewContent.tsx` and confirm it is empty.
6. **Tests:**
   - The legacy help equals the literal, and so does Layout's legacy mount (step 1).
   - The v2 help renders the v2 list as (key, description) pairs.
   - v2's help contains none of A16's wrong rows and contains Task 2's rows.
   - The command palette's footer lists no V1-only row (`CommandPalette.test.tsx:183-186`).
   - Mutation checks, pasting each failure:
     - (a) add one row to `SHORTCUT_GROUPS`, and T-28 fails;
     - (b) re-append `SHORTCUT_GROUPS` in the palette, and the palette test fails;
     - (c) pass `groups={V2_SHORTCUT_GROUPS}` to the **legacy** mount (`Layout.tsx:144-148`), and T-29 fails.

**Done when:** the gates pass on `src/components/ui src/components/layout`. Commit: `feat(v2): D14 Task 3 — shell-aware shortcut registry (closes A16)`.

---

## Task 4 — `v2-roster-hide-subs` (§9) + the DoD-2 enumeration test (R-D14-J/K)

**Files:**
- create `frontend/src/components/roster/useRosterHideSubs.ts` and its test;
- modify `frontend/src/components/roster/Roster.tsx` (`:145`, `:149`, and the header at `:26-27`);
- create `frontend/src/components/loot/loggingModel.enumeration.test.ts`;
- do **not** touch `pages/GroupViewContent.tsx`.

1. **Hook (R-D14-J):** use `useRosterSortPreset.ts`'s shape.
   - The read order is `v2-roster-hide-subs` → `roster-hide-subs` → `false`.
   - The setter writes the v2 key only.
   - Storage access is wrapped in try/catch.
2. **`Roster.tsx`:** swap the `useState` and `setSubsHiddenPersist` pair for the hook. The only behaviour change is the key.
3. **Hook tests:**
   - The legacy value applies when there is no v2 value.
   - **The v2 value wins, tested with v2 = `'false'` and legacy = `'true'`.**
   - A toggle leaves the legacy key's value unchanged.
   - Storage that throws falls back to `false`.
   - Mutation check: make the setter also write the legacy key, and paste the failing line.
4. **DoD-2 test (R-D14-K):**
   - Use `import.meta.glob(…, { query: '?raw', import: 'default', eager: true })` (`tsconfig.app.json` types include `vite/client`).
   - Glob `components/loot/**` plus the shared components v2's Loot mounts that make these calls (`LogWeekWizard/`, `RecipientPicker`, `QuickLogMaterialModal`; resolve their paths). A new file in scope must trip the test.
   - Pin the exact (file, function) set, each pair tagged:
     - **v2-reachable**, with its import chain;
     - or **V1-only**, for example `QuickLogDropModal.tsx:140`, whose only importer is `LootPriorityPanel.tsx:26`.
   - Known v2 extras beyond DoD-2's literal list:
     - `QuickLogWeaponModal.tsx:79`, reached via `WeaponPriorityBridge.tsx:15,80`;
     - `markFloorCleared` at `LogWeekWizard/index.tsx:603`;
     - the six ledger-clearing calls at `Loot.tsx:1025-1032`.
   - Match call expressions only, not comments or `typeof`.
   - Mutation check: add a stray `logLootAndUpdateGear(` call in a throwaway loot file, paste the failure, then delete the file.

**Done when:** the gates pass on `src/components/roster src/components/loot`. Commit: `feat(v2): D14 Task 4 — v2-roster-hide-subs and the one-logging-model enumeration`.

---

## Finish (controller)

1. **D14 browser pass** at `/group/DEVTST?shell=v2`, using the dev-auth recipe in memory.
   - Home's fairness card as a member, and as a non-member viewer via the share code.
   - Each Loot shortcut on each view, including `Alt+←` not going Back.
   - v2's `Shift+?` and the ⌘K footer.
   - `?shell=legacy`'s `Shift+?`, unchanged against a shot from `main`.
   - The v2 Roster subs toggle leaves V1's alone.

   Shots go to `docs/redesign/pr-shots/d14-*`.
2. **The DoD-1 in-app sweep (B1):** one row at a time for D-05, D-22…D-44, D-54, D-55 and D-72, in the running app, with evidence (a shot or a DOM or API read) for each row. A failing row is reported and ruled on, not fixed inside the sweep. D-18 is recorded as open (R-41: there is no Progress tab yet).
3. One `redesign-reviewer` whole-branch dispatch, then one fix wave.
4. **Phase D DoD checks** (`phase-d-loot-plan.md:211-235`), pasted into the PR body:
   - DoD 3: the V1-safety two-part assert over D0–D14;
   - DoD 4: knip against the baseline;
   - DoD 5: grep v2-authored files for `FLOOR_COLORS[…].hex`, and run `pnpm tokens:check`;
   - DoD 6: `pnpm dupes`;
   - DoD 8: the Phase-P mobile deferral recorded, including D13's Team Summary collapse.

   Then an `xivrp-director` phase-close change-vet, reading the sweep evidence.
5. **Write-back** (one commit, with every claim verified against the code):
   - **`v1-v2-parity-matrix.md`:**
     - D-23, D-27, D-37, D-38, D-39, D-40, D-43, D-72;
     - D-54, with the R-D14-E narrowing;
     - D-42, naming D13's two deltas: the mobile collapse deferred to Phase P, and the "Avg BiS progress" relabel;
     - D-18, left explicitly open with R-41's blocker restated;
     - A16, closed.
   - **`phase-d-loot-design.md`:** R-40 as built (R-D14-B/C); R-42's scope as built (R-D14-E); §9 closed.
   - **`phase-d-loot-plan.md`:**
     - mark the D14 row ✅;
     - correct the stale `Loot.tsx:396-404` cite;
     - amend DoD-2 to the tagged set (R-D14-K).
   - **Status lines:**
     - the Phase D status in `ROLLOUT_ROADMAP.md` §7;
     - `CLAUDE.md`'s status line becomes "Phase D complete except D-18 (R-41: no Progress tab yet)".
6. Internal release note, the gates, and a draft PR.
7. **Holistic-review list:** R-D14-B placement and the card title.
