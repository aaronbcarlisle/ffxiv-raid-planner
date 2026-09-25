# Phase D · DC — The carried-out-of-Phase-D follow-ups

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** DC clears the "Carried out of Phase D" list (`ROLLOUT_ROADMAP.md` §7, `:260-271`) before Phase E. It:
- deletes the three orphaned `history/` panels and normalizes the type-test files, so knip's unused files drop 15 → 8;
- fixes `eslint.config.js`'s jsx-a11y mapping, so Phase E's a11y work is measured against the real upstream rule set;
- fixes the edit door's away-and-back slot loss in `QuickLogMaterialModal` (the real residual behind the "`ui/Select` race" entry);
- fixes R-D12-C, so a tier that is genuinely on week 1 routes a roster jump to the Log. Every static starts the next tier on week 1;
- closes the stale and accepted entries (`notes: null`, R-D12-H, R-D12-F cause 4) in the docs, with citations.

**Architecture:**
- **Cleanup** is deletions, `git mv` renames and one test-table edit. No config change: knip's vitest entry already matches `*.test-d.*` (`frontend/knip.json:11`).
- **Lint** is one config expression. It keeps each jsx-a11y rule's upstream severity (`off` stays off) and its options, and downgrades `error` to `warn`.
- **The edit door:** one local helper routes both user-driven re-derive sites through the entry's own seed (`editGearSelection`) when the user returns to the entry's recipient **and** material.
- **The clock:** a keyed store field records which `(groupId, tierId)` the current-week values were actually fetched for. `RosterCard` trusts the clock only when that key is its own tier.

**Tech stack:** React 19 · TypeScript · Zustand 5 (`lootTrackingStore`) · Vitest + Testing Library · ESLint 9 flat config · knip.

**Spec (binding):**
- `design/redesign/ROLLOUT_ROADMAP.md` §7 "Carried out of Phase D" (`:260-271`).
- `design/redesign/specs/phase-d-loot-plan.md` §5: `notes: null` `:287`; the Select race `:289`; the eslint mapping row; DoD-2 `:226`, `:241-244`.
- `design/redesign/specs/phase-d-loot-design.md`: R-D12-C `:1073-1080`, R-D12-H `:1082-1085`, R-D12-F cause 4 `:1091-1093`.
- **Drift found while sizing (2026-09-25), corrected by this slice:**
  - **`notes: null` is already fixed** by #239 (`e369dd16`): `loot_tracking.py:449-450` (loot log) and `:1518-1519` (material log) honour `model_fields_set`. Regression tests: `backend/tests/test_loot_tracking.py:430,478`.
  - **#239 already fixed the Radix race itself.** `ui/Select.tsx:147-160` drops the phantom `''`, and `QuickLogMaterialModal.test.tsx:311-367` proves it. What D5 saw live (`phase-d-loot-plan.md:289`) is a **different** bug:
    - where: `handleRecipientChange` (`QuickLogMaterialModal.tsx:539-548`) and `applyMaterialChange` (`:588-594`) always re-derive through `initialGearSelection` (`:89-98`) and never consult the entry;
    - why the slot goes: back on the original recipient, the recorded slot is already augmented, so it is not "eligible", and the fresh derivation drops it or **silently swaps** it;
    - the options list re-offers it: `eligibleOptions` (`:400-438`, `withOriginalSlot`);
    - only v2 passes `editEntry` (`Loot.tsx:1603`). V1's only mount is pinned mode (`LootPriorityPanel.tsx:770-782`), and V1's material edit is a different component (`LogMaterialModal.tsx`).

**Plan-vet:** `xivrp-director`, 2026-09-25: NOT-READY on four Majors, no Blockers. READY once they are folded, with no second vet. Every Drift and ruling claim was verified true against the code. **All findings are folded below:**
- **M1:** T3-c becomes a Solvent entry, and both material-change routes are covered.
- **M2:** after an A→B→A switch the modal shows no gear line.
- **M3:** R-D12-F cause 5 is re-carried.
- **M4:** Task 1 goes to sonnet, and the enumeration test's `IS_TEST_FILE` regex is updated.
- **m1–m6:** folded in place.

---

## Rulings (bind every task)

| ID | Ruling | Why | Cost if wrong |
|---|---|---|---|
| R-DC-A | **Pure deletions stay in the slice but out of the review package.** The three files are verified by evidence instead of line review: a `--diff-filter=D` stat showing pure deletes, plus a zero-importer grep over `frontend/src` (comments and the enumeration fixture excepted), both pasted. The review diff excludes the three paths | 1,218 dead lines would double the reviewer's read for nothing (roadmap: "zero importers in `frontend/src`, listed in knip's unused files") | A missed importer. `tsc -b` would fail the build, so this cannot ship silently |
| R-DC-B | **Type-test normalization is by rename, not by config.** The four `*.type-test.tsx` files become `*.test-d.tsx` (`git mv`). `BookLedgerCard.test.tsx`'s `it.skip` type test (`:361-378`) moves to `BookLedgerCard.test-d.tsx` as a plain module, like the other four. The result is still compiled by `tsc -b` (`tsconfig.app.json:20` includes `src`), still outside Vitest's `include` (`vitest.config.ts:8`, only `*.test.ts(x)`), and now a knip entry | Uses the existing glob. Zero moving parts | None. A wrong name fails `tsc -b` or knip, visibly |
| R-DC-C | **The jsx-a11y mapping keeps upstream severity and options.** `off` stays `off`. `error`, `2` and `warn` become `['warn', ...options]` (director-verified against the installed 6.10.2: 34 rules, 31 `error`, 3 `off`, 7 with options). The shared-layer relock (`eslint.config.js:197-208`, full recommended at `error` for `primitives/` and `ui/`) is untouched. **Every `eslint-disable` directive the fix makes unused is deleted in this task.** All 13 jsx-a11y directives on `main` are in v2 or relocked shared files. **None are expected in V1 files; if one appears, stop and report** | The roadmap calls this a dedicated chore, not per-call-site patches. `phase-d-loot-plan.md` §5's D11 addendum: "predict nothing, measure first" | A rule whose count rises is reported, not silenced. The source fixes belong to Phase E |
| R-DC-D | **The edit door re-seeds from the entry only on a full return:** `mode === 'edit'` **and** the recipient is `editEntry.recipientPlayerId` **and** the material is `editEntry.materialType`. Then `slot` and `augmentTome` come from `editGearSelection` (`:161-176`), the function the open seed already uses (`:357`, `:381`, `:390`, `:530`). Every other change derives fresh, as today. **`updateGear` is never touched by a recipient or material change**, which is today's contract for both handlers. Pinned and free-form modes are unchanged by construction (`editEntry` is `never` there). The auto-recipient effect (`:708-726`) and the pinned open-reset (`:468-480`) are not edit-mode paths and stay as they are | The options list already re-offers the recorded slot (`withOriginalSlot`). Selection state must agree with the options it is chosen from | None to V1 (edit mode is v2-only). A wrong edge is a unit-test fix |
| R-DC-E | **"The clock is resolved" means that a successful server response wrote this `(groupId, tierId)`'s `currentWeek`/`maxWeek`.** New store field `weekClockKey: string \| null`:<ul><li>`null` initially, and in `clearLootTracking` (`:798-812`; it has zero callers today, but is kept consistent);</li><li>set to `weekClockKeyOf(groupId, tierId)` **in the same `set` call** that writes the week values, on every success path: `fetchCurrentWeek` (`:303-308`), `startNextWeek` (`:749`) and `revertWeek` (`:778`). One `set` matters because `GroupViewContent.tsx:325` subscribes to the whole store, so a second `set` means a second V1 render;</li><li>**left as-is** on failure and at fetch start.</li></ul>`RosterCard.jumpToEntry` replaces `Math.max(clockMaxWeek, clockCurrentWeek) > 1` (`RosterCard.tsx:324`, the only settled-clock routing site) with a key match. `Loot.tsx`'s F1/F2 and `unresolvedByClock` guards (`:1000-1007`) are untouched. The director verified that with the key resolved, F2 resolves a week-1 entry and Loot's mount refetch returns the same values, so the pulse holds and so does R-D12-B | Week 1 cannot be told apart from "not fetched yet" by value. A key also covers the tier-switch race: while tier B's fetch is pending the key still names A, so B's jump goes to History. Every caller passes `(group.id, tier.tierId)`: `Roster.tsx:260`, `NewShell.tsx:270`, `Loot.tsx:742,801`, the same IDs `Roster.tsx:598-599` hands `RosterCard` | V1 only gains a field, which its fetch callers (`GroupViewContent.tsx:328`, `HistoryView.tsx:142`) set and never read. A never-successful fetch keeps today's History fallback |
| R-DC-F | **R-D12-H and R-D12-F cause 4 close as accepted residuals, with no code.** H is inherent to the data (no stored left/right ring) and is pinned in v2 by `rosterLedgerJumps.test.ts:81-94` (outbound) and `:176-182` (inbound). F cause 4 was ruled out of scope by the user and is pinned by `Roster.test.tsx:823-831`. No tests are added for the legacy `useViewNavigation` hook: V1 is frozen and the asymmetry is already documented. **R-D12-F cause 5 is not closed** (a folded section or hidden subs renders no anchor, `phase-d-loot-design.md:1095-1100`). It was never carried to the roadmap, which lists "three residuals" against the design doc's four. D14b's persisted `v2-roster-hide-subs` makes it more reachable. The write-back **re-carries** it, neither fixed nor ruled | A real H fix needs a schema change. H and F4 are already pinned | Clearing the list would orphan cause 5. Director M3 |
| R-DC-G | **`notes: null` closes as fixed-in-#239**, doc only (see Drift). The evidence is a pasted `pytest` run of #239's six notes tests (`backend/tests/test_loot_tracking.py:427-487`) | — | — |

**Release note:** internal (`internal: true`, `CURRENT_VERSION` untouched, next `version` `2.1.32`).
- **V1-visible change: nil.**
  - Task 3's new branch is gated on edit mode, which V1 never mounts.
  - Task 4 adds a field V1 does not read.
  - Tasks 1–2 change no runtime code.
- **Evidence:** QuickLogMaterialModal's pinned-mode tests pass unmodified, and the Finish's `?shell=legacy` check.

**Riskiest task: Task 4.** It edits the shared, V1-live `lootTrackingStore` and changes jump routing, which has 10+ fixture tests that assumed the `> 1` heuristic. Dispatch `xivrp-implementer-deep`, with an ad hoc mutation check (Task 4, step 6). No task-scoped review unless the diff grows past the store, `RosterCard` and their tests.

**Budget:** the raw diff is about 1,600 lines: 1,218 pure deletions (R-DC-A) plus roughly 350–450 reviewed lines. That is over the ~1,500 cap on raw count.
- **User-accepted 2026-09-25:** the user took the recommended option (b), which named "keep the deletions in this slice" as the pick.
- The PR body records that acceptance.
- It also names the exception to Phase D's "don't edit `history/`" rule (`phase-d-loot-plan.md:99-103`): deleting unreachable files is not editing live ones.

**Contingency:** if the reviewed (non-deletion) lines pass ~700 before the Finish, Task 4 splits off as its own PR.

**Main baselines** (`06e99346`, measured 2026-09-25): lint 0 errors / 903 warnings · knip (`pnpm deadcode`) files 15 / exports 179 / types 139 · tests: re-measured by the preflight gate run (the last recorded figure, 3288 + 1 skipped, is at `cbcf6128`, before the #273 bot fix).

**Gates for every task:**
- `pnpm build` (`tsc -b` type-checks the tests and the `*.test-d.tsx` files; Vitest does not);
- `pnpm lint`: 0 errors; warnings ≤ 903 (Task 2 sets the new ceiling);
- `pnpm check:design-system:strict`;
- `pnpm dupes` (it blocks CI at `.github/workflows/ci.yml:73-74`, and `.jscpd.json` does not ignore `*.test-d.tsx`);
- the task's `vitest` scope.

Paste each result line.

---

## Review Focus

These are the inputs most likely to bite that no happy-path test hits. Each one has a named test in its task.
1. **Material away-and-back on the original recipient, by both routes** (still Sara): the recorded slot must come back. The routes are a floor pill (Twine → Glaze → Twine) and a direct material pick (Twine → Solvent → Twine). Task 3, T3-b1/b2.
2. **A Solvent tome-weapon entry** (`slotAugmented: 'tome_weapon'`; only Solvent records it, `utils/materialCoordination.ts:233-238`) away-and-back: `augmentTome` must come back checked with no slot. Task 3, T3-c.
3. **An entry logged without a gear update** (`slotAugmented: null`) away-and-back: it must derive exactly as today, not invent a slot. Task 3, T3-d.
4. **A tier switch with the new tier's fetch pending:** tier A's resolved clock must not send tier B's jump to the Log. Task 4, T4-c.
5. **A directive made unused by the mapping fix** (the known one is `LogWeekGrid.tsx:632`'s D5 disable; `:593` is probably freed too, since the upstream handler list omits `onContextMenu`): it must be deleted, not left as a new warning. Task 2, step 4.

---

## Task 1 — Cleanup: orphans, type-tests, test hygiene (R-DC-A/B)

**Implementer:** `xivrp-implementer` (sonnet). Director M4: this is not a haiku task, because `BookLedgerCard.test-d.tsx` has to be written from scratch and the enumeration test's file filter has to change.

**Files:**
- Delete: `frontend/src/components/history/LootLogPanel.tsx` (225), `PageBalancesPanel.tsx` (405), `UnifiedWeekOverview.tsx` (588).
- Modify: `frontend/src/components/loot/loggingModel.enumeration.test.ts:419-480`. Remove the 9 `unreachable` rows for those three files:
  - `LootLogPanel` × 1 (`:419`);
  - `PageBalancesPanel` × 5 (`:426-454`);
  - `UnifiedWeekOverview` × 3 (`:461-475`).

  The `unreachable` tag is then used by no row, so remove it from the tag type (`:205`) and its use at `:499`. Fix the stale comments at `:345-346` and `:412-417` that describe the unreachable trio. The test hard-codes no count (`:492` is `toEqual(expectedSorted)`); the table becomes **26 pairs, 15 v2-reachable · 11 V1-only**.
  - **Also change `IS_TEST_FILE` (`:82`, used at `:180` and `:513`)** from `/\.(test|type-test)\.tsx?$/` to `/\.(test|test-d)\.tsx?$/`. Otherwise the renamed files are scanned as production code.
- Modify: `frontend/src/components/loot/BookLedgerCard.tsx:10`. The comment names `PageBalancesPanel`'s default `viewMode`. Keep the fact, and mark the file as deleted in DC (git history).
- Rename (`git mv`):
  - `components/loot/QuickLogMaterialModal.type-test.tsx` → `QuickLogMaterialModal.test-d.tsx`;
  - `components/loot/RecipientPicker.type-test.tsx` → `RecipientPicker.test-d.tsx`;
  - `components/primitives/Button.type-test.tsx` → `Button.test-d.tsx`;
  - `components/ui/Tag.type-test.tsx` → `Tag.test-d.tsx`.

  Then `grep -rn "type-test" frontend/ docs/ design/ .claude/` and update live references. Leave historical plan and audit snapshots alone.
- Create: `frontend/src/components/loot/BookLedgerCard.test-d.tsx`. It carries the same assertions as `BookLedgerCard.test.tsx:361-378` (the comment plus the `it.skip` body), written in the shape of `ui/Tag.type-test.tsx:10-22`: exported `createElement` consts with `// @ts-expect-error` lines.
  - It is not a test file, so there is no `vi`. Any callback props that `baseProps` (`BookLedgerCard.test.tsx:89-98`) builds with `vi.fn()` become plain `() => {}` no-ops, declared in the new file.
  - Delete the block from `BookLedgerCard.test.tsx`, along with any helper that only it used.
- Modify: `frontend/src/components/home/Home.test.tsx:362-365`. The comment claims the `getTierById` mock "returns real floors" for a real id. The mock (`:107`) ignores its argument. Replace it with: "`'t1'` is a placeholder id — the `getTierById` mock (`:107`) ignores its argument and always returns `['M9S','M10S']`, so this proves Home threads the mocked floors through, not that it looks up the right tier."

**Steps:**
- [ ] 1. Run `cd frontend && pnpm deadcode` and paste the three counts (expect 15 / 179 / 139).
- [ ] 2. Make the deletions and the enumeration edit. Run `pnpm vitest run src/components/loot/loggingModel.enumeration.test.ts`. It must pass with the 26-row table.
- [ ] 3. Do the renames and the `BookLedgerCard.test-d.tsx` split. Prove the new file bites for the right reason: temporarily drop `markClearedOpen` from one asserted line in `BookLedgerCard.test-d.tsx`. `pnpm build` must FAIL with **TS2578** (unused `@ts-expect-error`) on that line. Restore it and `pnpm build` passes. Paste both lines.
- [ ] 4. Fix the two comments.
- [ ] 5. Gates (including `pnpm dupes`), plus `pnpm deadcode`: **unused files must be 8.** Exports and types must be ≤ 179 / 139; record the new values. Vitest scope: `src/components/loot src/components/home src/components/primitives src/components/ui`.
- [ ] 6. Commit: `chore(v2): DC Task 1 — delete orphaned history panels, normalize type-tests (knip files 15 → 8)`.

**Done when:** knip reports 8 unused files; the enumeration test passes with 26 pairs; the type tests fail the build when broken.

---

## Task 2 — The jsx-a11y mapping (R-DC-C)

**Implementer:** `xivrp-implementer` (sonnet).

**Files:**
- Modify: `frontend/eslint.config.js:13-15`.
- Modify: every file holding an `eslint-disable` directive that the fix makes unused (deletions only).

**Steps:**
- [ ] 1. **Before:**
  - `cd frontend && npx eslint . -f json -o <scratchpad>/lint-before.json`. Tabulate the per-rule warning counts for `jsx-a11y/*` plus the count of "Unused eslint-disable directive" reports.
  - Save `npx eslint --print-config src/components/ui/Select.tsx` and `npx eslint --print-config src/components/loot/LogWeekGrid.tsx`. Keep only the `jsx-a11y/*` keys.
- [ ] 2. Replace the mapping with:

```js
// Upstream recommended, downgraded to warn: `off` rules stay off and each
// rule keeps its upstream options (the old keys→'warn' map re-enabled three
// upstream-off rules and stripped seven rules' options).
const a11yRecommendedWarn = Object.fromEntries(
  Object.entries(jsxA11y.flatConfigs.recommended.rules).map(([rule, entry]) => {
    const [severity, ...options] = Array.isArray(entry) ? entry : [entry];
    return [rule, severity === 'off' || severity === 0 ? 'off' : ['warn', ...options]];
  }),
);
```

- [ ] 3. **After:** the same JSON run. The expected direction:
  - `anchor-ambiguous-text`, `control-has-associated-label` (46) and `label-has-for` (29) go to 0;
  - the 7 option-carrying rules change by whatever they change.
- [ ] 4. Delete every directive now reported as an unused eslint-disable directive. The known one is `LogWeekGrid.tsx:632`, and `:593` is probably freed too. Each hunk must be a directive-only deletion. List every file. **If one is in a V1 file, stop and report** (none are expected, R-DC-C).
- [ ] 5. Gates. Lint must be 0 errors, and warnings must be below 903; the new figure becomes the ceiling for Tasks 3–4. **Relock evidence:** repeat both `--print-config` reads and diff them against step 1.
  - The `ui/Select.tsx` a11y block must be unchanged (full recommended, `error`).
  - The `LogWeekGrid.tsx` block must show the three upstream-off rules as `off` and the seven rules with options restored.

  (`check:design-system:strict` runs no ESLint, `scripts/check-design-system.sh`, so it is a gate here, not evidence.) Vitest: none (no runtime change).
- [ ] 6. Commit: `chore(lint): DC Task 2 — jsx-a11y mapping keeps upstream off-rules and options`.

**Report must include:**
- the `--print-config` diff summary: one line per file;
- the before/after per-rule table, covering only the rules whose count changed;
- the unused-directive count, before and after (after ≤ before);
- for any rule that **rose**, two example sites. Report these; do not fix them.

---

## Task 3 — The edit door's away-and-back (R-DC-D)

**Implementer:** `xivrp-implementer` (sonnet).

**Files:**
- Modify: `frontend/src/components/loot/QuickLogMaterialModal.tsx`. Add a helper next to the handlers, and change the two call sites `:545` (`handleRecipientChange`) and `:591` (`applyMaterialChange`).
- Test: `frontend/src/components/loot/QuickLogMaterialModal.test.tsx`, inside `describe('edit mode (R-21)')` (`:909`). Reuse:
  - `editFixturePlayers()` (`:915-950`): `sara` has an augmented `head` and an eligible `body`; `theo` has an eligible `body` only;
  - `editEntryFixture()` (`:952-971`): `recipientPlayerId: 'sara'`, `slotAugmented: 'head'`;
  - `renderEdit()` (`:973-989`).

**The helper** (inside the component; it reads `mode` and `editEntry` the way `:381`/`:390` already do):

```ts
// R-DC-D: an away-and-back in the edit door restores the entry's own selection.
// Back on the entry's recipient AND material, re-seed exactly as the open seed
// does (editGearSelection) — the options list already re-offers the recorded
// slot (withOriginalSlot), so the selection must agree with it. Anything else
// derives fresh. `updateGear` is the user's checkbox: never touched here.
function gearSelectionFor(player: SnapshotPlayer | undefined, m: MaterialType) {
  if (mode === 'edit' && player?.id === editEntry!.recipientPlayerId && m === editEntry!.materialType) {
    const { slot, augmentTome } = editGearSelection(m, editEntry!.slotAugmented, player);
    return { slot, augmentTome };
  }
  return initialGearSelection(player, m);
}
```

`:545` and `:591` call `gearSelectionFor(...)` instead of `initialGearSelection(...)`. Nothing else changes.

**Steps:**
- [ ] 1. Write the failing tests:
  - **T3-a:** Sara → Theo → Sara.
    - The slot `Select` shows the recorded `head`, not `body` or the placeholder.
    - The save payload carries `head`; use the assertion shape the existing edit-mode submit tests use.
    - **The preview renders no gear line**, neither "− Un-mark…" nor "+ Mark…". Back on the original recipient, `recipientChanged` is false and the effects are equal (`:265-275`); "keeps…" renders only while the recipient differs (`:280`). Director M2.
  - **T3-b1 (floor route, `pickFloor`):** stay on Sara and go Twine → Glaze → Twine through the floor pills. Twine and Glaze live on different floors (`gamedata/loot-tables.ts:43,50`). `head` is restored and there is no gear line.
  - **T3-b2 (material route, `pickMaterial`):** stay on Sara and go Twine → Solvent → Twine through a direct material pick. `head` is restored.
  - **T3-c:** a **Solvent** entry with `slotAugmented: 'tome_weapon'`: floor M11S, recipient Sara, built from `editEntryFixture` with overrides. Only Solvent records `'tome_weapon'` (`utils/materialCoordination.ts:233-238`); UT ignores `augmentTome` (`QuickLogMaterialModal.tsx:218`, `materialCoordination.ts:442`), so a UT fixture would pass on `main` (director M1). Sara needs no tome augment, so only `originalSlot` offers the option (`:428`). After Sara → Theo → Sara:
    - the tome-weapon option is checked and no slot is selected;
    - there is no "− Un-mark tome weapon as augmented" line;
    - the payload has `augmentTomeWeapon: true`.

    On `main` the line shows and the payload has `false`.
  - **T3-d:** an entry with `slotAugmented: null`. The away-and-back result equals `initialGearSelection`'s: the same first-eligible slot as today, not invented.
  - **T3-e (control):** Sara → Theo shows Theo's `body`, today's behavior.
- [ ] 2. Run them. T3-a, b1, b2 and c must FAIL on `main`'s code (T3-a lands on `body`); T3-d and e pass. Paste the lines.
- [ ] 3. Add the helper and the two call-site changes.
- [ ] 4. Run the whole file. It must pass, **with the pinned-mode and free-form describe blocks unmodified**; that is the V1 evidence. Paste the counts.
- [ ] 5. Gates. Vitest scope: `src/components/loot`.
- [ ] 6. Commit: `fix(v2): DC Task 3 — the edit door restores the recorded slot on an away-and-back`.

---

## Task 4 — R-D12-C: a keyed week-clock (R-DC-E) — RISKIEST

**Implementer:** `xivrp-implementer-deep` (opus, xhigh).

**Files:**
- Modify: `frontend/src/stores/lootTrackingStore.ts`:
  - the state type (near `:56-57`), with an initial value `weekClockKey: null` (near `:115-116`);
  - `fetchCurrentWeek`'s success `set` (`:303-308`);
  - the success `set` of `startNextWeek` (`:749`) and of `revertWeek` (`:778`). Each writes this tier's `currentWeek`, so the key goes in the **same** `set` call;
  - `clearLootTracking` (`:798-812`);
  - export `weekClockKeyOf`.
- Modify: `frontend/src/components/roster/RosterCard.tsx:296-297` (the selectors) and `:324-326` (`clockSettled`), plus the R-D12-C comment block (`:312-321`). Drop the `clockMaxWeek` selector if it is left unused, and fix the `useCallback` deps.
- Test: `frontend/src/stores/lootTrackingStore.test.ts` (or the store's existing test file), and `frontend/src/components/roster/RosterCard.test.tsx`, `describe('RosterCard — D12 R-28, the entry jump splits by week')` (`:1817`).

```ts
/** R-DC-E: which (static, tier) the currentWeek/maxWeek values were fetched for. */
export const weekClockKeyOf = (groupId: string, tierId: string) => `${groupId}:${tierId}`;
// state:            weekClockKey: string | null   — initial null; clearLootTracking → null
// fetchCurrentWeek / startNextWeek / revertWeek: the SAME success set(...) that writes
//                   currentWeek/maxWeek adds  weekClockKey: weekClockKeyOf(groupId, tierId)
//                   failure and fetch-start leave it unchanged
// RosterCard:
const clockResolved = useLootTrackingStore((s) => s.weekClockKey === weekClockKeyOf(groupId, tierId));
const displayedWeek = override ?? (clockResolved ? clockCurrentWeek : null);
```

- **Verify first:** the `groupId`/`tierId` that `RosterCard` passes to `resolveLogWeekOverride` must be the same identifiers the v2 fetch callers pass to `fetchCurrentWeek`: `Roster.tsx:260` (`group.id, tierId`), `NewShell.tsx:270` (`currentGroup.id, activeTier.tierId`) and `Loot.tsx:742,801`. Report the trace.
- **Comment rewrite (`:312-321`):** "follow the clock" is safe once **this tier's** fetch has succeeded. A genuinely week-1 tier now routes to the Log; an unfetched or failed clock keeps History.

**Steps:**
- [ ] 1. Write the failing tests. Store:
  - **S-1:** a successful fetch sets the key;
  - **S-2:** after a successful fetch for tier A, a **failed fetch for tier B** leaves the key at A. Using a different tier is what lets S-2 kill mutation (iii);
  - **S-3:** `clearLootTracking` resets the key to `null`;
  - **S-4:** a successful `startNextWeek` and `revertWeek` each set this tier's key.

  RosterCard:
  - **T4-a:** key = this tier, `currentWeek: 1`, `maxWeek: 1`, entry week 1 → `lview=log`;
  - **T4-b:** key `null`, week 1 → `lview=history` (today's fallback);
  - **T4-c:** key = another tier, `currentWeek: 5`, entry week 5 → `history` (the tier-switch race);
  - **T4-d:** key = this tier, `currentWeek: 6`, entry week 6 → `log` (the settled case keeps working).
- [ ] 2. Run them. T4-a and S-1 must FAIL on `main`'s code. Paste the lines.
- [ ] 3. Implement.
- [ ] 4. Update existing R-28 fixtures that settled the clock by value alone (`currentWeek > 1` with no key) so they set the key. **Count and list them.**
  - **Only fixture setup changes, with one exception:** `treats a clock whose maxWeek has moved past 1 as settled` (`RosterCard.test.tsx:2048-2053`) is premised on the heuristic being removed. Invert it: `maxWeek > 1` with no key → `history`. Rename it to match.
  - **Isolation:** the store is module-global. Reset `weekClockKey: null` wherever the file resets the clock (`:1887`, `:1892`) and at file level (`:71`), so a key set in one test can't leak into the next.
- [ ] 5. Gates. Vitest scope: `src/stores src/components/roster src/components/loot src/pages` (`pages` covers `GroupViewContent`'s V1 tests, which call `fetchCurrentWeek`).
- [ ] 6. **Ad hoc mutation check** (paste each result):
  - (i) revert `RosterCard` to `Math.max(clockMaxWeek, clockCurrentWeek) > 1` → T4-a fails;
  - (ii) weaken the match to `s.weekClockKey !== null` → T4-c fails;
  - (iii) also set the key in the catch branch → S-2 fails.

  Restore after each.
- [ ] 7. Commit: `fix(v2): DC Task 4 — R-D12-C: a keyed week clock, so a week-1 tier's jump reaches the Log`.

---

## Finish (controller)

1. **Browser pass** at `/group/DEVTST`, using the dev-auth recipe in memory (`project_dev_server_startup`). Shots go to `docs/redesign/pr-shots/dc-*.webp`. Every DB mutation is undone and listed.
   - **Task 3 (the owed F-3 case):**
     - make two players Twine- or Glaze-eligible (a reversible gear toggle);
     - open the v2 Log edit door on a material entry and switch A → B → A;
     - the recorded slot shows again, and the preview shows **no gear line** (no "− Un-mark…" and no "+ Mark…"; "keeps…" appears only while on B);
     - cancel without saving.
   - **Task 4:**
     - first check which of the four tier ids (`gamedata/raid-tiers.ts:63-166`) DEVTST has no snapshot for;
     - create that tier on DEVTST (week 1) and log one drop in week 1;
     - on the Roster, jump from the card: it lands on the Log with the pulse;
     - then delete the drop and the tier.
     - **Undo list:** rollover deactivates the source tier (`backend/app/routers/tiers.py:595`), so also re-activate the original tier and restore `localStorage['selected-tier-DEVTST']`. Paste the before and after `GET` of the tier list.
   - **V1:** `?shell=legacy` (force it; the `ui-shell-session` caveat applies). The Loot tab's pinned material modal opens and derives its slot as on `main`, and the History edit still works.
2. **Evidence, pasted into the PR body:**
   - **R-DC-A:** `git diff main --diff-filter=D --stat` and the zero-importer grep.
   - **R-DC-G:** `cd backend && pytest tests/test_loot_tracking.py -k notes -q`, covering #239's six notes tests.
3. **One `redesign-reviewer` whole-branch dispatch.** The package excludes the three deleted paths (`git diff main...HEAD -- . ':!frontend/src/components/history/LootLogPanel.tsx' ':!frontend/src/components/history/PageBalancesPanel.tsx' ':!frontend/src/components/history/UnifiedWeekOverview.tsx'`). Then at most one fix wave for Critical/Important findings. Minors batch.
4. **Write-back** (one commit, every claim checked against the code):
   - `ROLLOUT_ROADMAP.md` §7 "Carried out of Phase D": each entry marked with its closure:
     - `notes: null` → #239;
     - Select → #239 plus the reframed residual → DC Task 3;
     - eslint → DC Task 2;
     - R-D12-C → DC Task 4;
     - R-D12-H and F cause 4 → accepted and pinned (R-DC-F);
     - orphans → DC Task 1.

     **R-D12-F cause 5 is re-carried as the one open entry** (R-DC-F, director M3). The block must not read as cleared. Phase F's knip figure ("24 files/168 exports") gets the current numbers.
   - `phase-d-loot-plan.md` §5: rows `:287` and `:289` and the eslint row get their closure notes. DoD-2 (`:226`, `:241-244`) is amended, not rewritten: "35 pairs at D14b; 26 after DC deleted the three unreachable files."
   - `phase-d-loot-design.md`: R-D12-C (`:1073-1080`) as built; R-D12-H and F cause 4 marked accepted, with their pins.
   - `v1-v2-parity-matrix.md:569` and `:588` are live rows naming the deleted files: annotate each "deleted in DC". A9's "v2-only consumer" note on `PageBalancesPanel` is stale; correct it. Historical baselines and old plans stay as snapshots.
5. **Release note** 2.1.32 (internal), the gates (including `pnpm dupes`), then a draft PR (`pr-checklist` skill). The PR body carries:
   - the knip and lint deltas;
   - the Task 3/4 red→green lines;
   - the mutation trace;
   - the browser evidence;
   - the Review Focus coverage;
   - the budget acceptance and the `history/` deletion exception (see Budget).
6. **Holistic-review list:** no additions expected. Any rule that rose in Task 2's table goes to Phase E's a11y bucket.
