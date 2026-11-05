# S2a-5b · The deletions (V2)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load `superpowers:subagent-driven-development` in this repo. Each PR below is one slice-loop run: its own ledger, one whole-branch review, one fix wave.

**Plan-vet (2026-11-04).** `xivrp-director` returned **approve with required changes**: 2 Critical, 5 Important, 11 Minor, read in code. All are folded in below. It compiled Tailwind over scratch copies of each PR's state and confirmed the 12 selectors and the per-PR split. It took the dry run's build, test and lint numbers on trust. The Criticals changed R-D-7 (the release-note exception covered V1's entry chunk) and PR W (criterion 9 isn't true "by removal").

**Owner gate:** nothing below runs until the owner confirms § Owner gate.

**Goal:** the dead code S2-14 names is gone, plus what its deletion orphans, plus `useTrackParam`, which is dead on its own since S2a-4a. Nothing a user can reach in either shell changes.

**Spec (binding):** `design/redesign/specs/2026-09-30-s2a-progress-design.md`: S2-14, S2-7's G-27 line, §7 criteria 9 and 11, §8.

**Parity matrix (binding):** `design/redesign/specs/2026-09-30-s2a-parity-matrix.md`: §11, P-112…P-125, §15.

**Out of scope:** `mountFarmStore`, the `/mount-farms` API, `GoalsPage`, `CollectionsHub` and their modals (all stay; V1 keeps them until D1), the backend, migrations, the other knip findings (`WeekSelector`, `TabNavigation`, `layout/index.ts`, `GearSnapshotView`), and `gamedata/` exports (R-D-4).

**Constraints:**
- V1 stays byte-for-byte: with `releaseNotes.ts` held at `main`'s copy, every JS chunk is identical to `main`'s and `index.css` only loses rules (R-D-7).
- The plugin contract is unchanged. The plugin calls `/api/plugin/mount-farms/{catalog,sync}` (`RaidPlannerClient.cs:370,373`) and none of this code. No PR's diff has a `backend/` path.
- V1-reachable source doesn't change, with three named exceptions: `releaseNotes.ts`, and two comments (R-D-6).

## Measured against `main` (`1a3a31d9`, 2026-11-04)

S2-14's 2,865 lines hold exactly: 1,189 + 598 + 561 + 517.

| Deleted | Lines | Importers today (`frontend/src`, `frontend/e2e`) |
|---|---|---|
| `components/mount-farms/index.ts` | 1 | none; knip lists it unused |
| `mount-farms/MountFarmTab.tsx` | 616 | `index.ts` only; knip lists it unused |
| `mount-farms/MountFarmSummary.tsx` | 160 | `MountFarmTab`; `gamedata/mount-farms.test.ts:14` |
| `mount-farms/MountFarmDetail.tsx` | 260 | `MountFarmSummary` |
| `mount-farms/FarmProgress.tsx` | 130 | `MountFarmDetail`, `MountFarmSummary`, `CollectionsTab.tsx:25` |
| `mount-farms/farmProgressUtils.ts` | 22 | `FarmProgress`, `CollectionsTab.tsx:29` |
| `profile/CollectionsTab.tsx` + test | 499 + 99 | its test only |
| `collections/CatalogFarmRow.tsx` | 290 | none; knip lists it unused |
| `collections/SuggestionFarmCard.tsx` | 271 | none; knip lists it unused |
| `static-group/ObjectiveCommandCenter.tsx` + test | 279 + 238 | its test only |
| **S2-14's list** | **2,865** | |
| `stores/objectiveCommandStore.ts` (matrix §11) | 96 | `ObjectiveCommandCenter` + its test only |
| `hooks/useTrackParam.ts` + test (R-D-1) | 38 + 69 | its test only |
| `gamedata/mount-farms.test.ts`, edited | 88 | keeps its catalog tests |
| `eslint-suppressions.json`, CollectionsTab's entry | 5 | |
| **Total** | **3,161** | |

Searched and clear: `import.meta.glob`, `?raw`, `readFileSync` (only `loggingModel.enumeration.test.ts` globs source, and only `loot/` and `history/`), `lazy()`, `vi.mock` paths, `.claude/`, `.github/`, `.githooks/`, `knip.json`.

**The ⌘K "Go to Progress" label is already done** (S2a-2: `CommandPalette.tsx:141`, `CommandPalette.test.tsx:399-402`). Nothing to do.

## Dry run (2026-11-04)

Every deletion in the table was applied in a throwaway worktree off `1a3a31d9` and nothing was committed. This predates the small edits in the task list (the README line, `eslint.config.js`, the comments), which each PR's gates cover.

| Gate | `main` | After all deletions |
|---|---|---|
| `pnpm build` | pass | pass |
| Built assets, hashes normalised | 70 files | 70 files; **69 identical, only `index.css` differs** |
| `index.css` | 185,442 bytes | 184,344 bytes; 12 selectors removed, 0 added |
| `pnpm test` | 405 files, 5,841 tests | 402 files, 5,818 tests, all passing |
| `pnpm lint` | 0 errors, 808 warnings | 0 errors, 784 warnings |
| `check:design-system:strict` | clean | clean |
| knip, unused files | 8 | 4 (the four out-of-scope files) |

**The 12 selectors:** `-m-0.5`, `bg-accent/60`, `bg-amber-400`, `bg-amber-500/20`, `bg-blue-500/5`, `border-blue-500/20`, `h-[120px]`, `hover:text-blue-300`, `lg:grid-cols-[minmax(0,1fr)_180px_250px]`, `max-w-[132px]`, `min-w-[156px]`, `w-[96px]`. A literal search of the kept source finds none of them (`bg-amber-400`'s only matches there are `bg-amber-400/20`, a different class). No kept template string assembles any of them. The kept dynamic classes are `text-role-${…}` (`RosterSlot.tsx:261,302`), `${role.bgColor}/10` and `${role.borderColor}/30` (`RoleSection.tsx:102,126`) and `hover:${floorColor.bg}` (`LogWeekWizard/GearStep.tsx:107`), which resolve to `text-role-*`, `bg-role-*/10`, `border-role-*/30` and `hover:bg-*-500/10`. None is one of the 12, so removing them changes no rendering.

By PR: D1 loses `lg:grid-cols-[minmax(0,1fr)_180px_250px]`; D2 loses `h-[120px]`; D3 loses the other ten. No `--*` variable is lost, nothing is added and nothing reorders (director's Tailwind 4.3.3 compile of each state).

## Rulings (bind every task)

### R-D-1 · `hooks/useTrackParam.ts`: delete it, with its test
- It has no production importer. `ProgressPage` writes through `useProgressView` since S2a-4a.
- `useProgressView` reads `?track=` by the same rule (an empty value is null, `useProgressView.ts:28-31`), and writes in place and removes on `null`. What `useTrackParam.test.tsx` proves is held between `useProgressView.test.tsx`, `hooks/useGroupViewState.progress.test.ts:140-150` (`track`'s reset) and `components/progress/ProgressPage.track.test.tsx:184,194` (replace, not push).
- A second writer is the trap R-D11-B names: two writes in one handler lose the first. Keeping an unused one invites that.
- `track` stays in `SEEDED_TAB_PARAMS`. The param is live; only the hook goes.
- `useProgressView.ts:13`'s "stays as it is for other callers" is removed. `useUrlTabState.ts:41` points at `useProgressView` (R-D-6).

### R-D-2 · `stores/objectiveCommandStore.ts`: delete it
- Matrix §11's condition: "unless P2b's D-66 has adopted it by then". It hasn't. S2a-5a's Home card reads `objectiveGoalStore` (`utils/objectiveCardModel.ts`).
- `GET /static-groups/{id}/objective-command` stays with no client. The backend is out of scope; see Carried.
- This closes `HOME_STRETCH.md:220`'s recurrence item and that part of the F3 sweep, as the matrix says.

### R-D-3 · `mountFarmStore` and the `/mount-farms` API stay, for a corrected reason
- S2-14 says they stay "because the plugin calls them". The plugin calls `/api/plugin/mount-farms/*`, not the store or `/static-groups/{id}/mount-farms`.
- The store stays because `StaticHomeTab.tsx:1640` (V1), `GroupViewContent.tsx:935`, `Home.tsx:140` and `StaticActivityFeed.tsx:57` read it.
- `updateProgress`'s only caller is the never-mounted `MountFarmDetail.tsx:63`, so nothing in the app calls it today. It stays, unedited; see Carried. Trimming the store is a V1-shared edit with no gain before D1.

### R-D-4 · `gamedata/mount-farms.ts` is not edited
- Six exports end with no product reader: `EXPANSIONS`, `getTrialsByExpansion`, `getCurrencyLabel` (already none), `getRewardLabel`, `hasCurrencyTracking`, `getExchangeSummary`.
- S2-14 doesn't scope them, knip ignores `gamedata/`, the bundler drops them, and the test still exercises several. See Carried.

### R-D-5 · Old URLs and keys stay as they are
- `?tab=mount-farms` and `?tab=collections` still map to `goals` (`useGroupViewState.ts:39`).
- `'mf'` stays in `SEEDED_TAB_PARAMS`: removing it would change what a tab switch does to a stale `?mf=`. That is a V1 delta with no benefit.
- `mount-farm-plugin-cta-dismissed-{id}` in localStorage is left alone.
- `TAB_ICONS.mountFarms` stays.

### R-D-6 · Comments
- Matrix §11's rule holds: a comment in a V1-reachable file stays (criterion 11). So `StaticHomeTab.tsx:1442` and `SourceFarmCard.tsx:4` are untouched. Both read true as history.
- **Two exceptions, against that rule, recorded in PR W:** `useUrlTabState.ts:41` says "`useTrackParam`, not this hook", and `collectionBadgeConfig.ts:4-6` is a present-tense "used by" list naming `SuggestionFarmCard`. Each would state something untrue. Both are comment-only edits in shared code, and R-D-7's bundle diff proves they reach nothing.
- V2-only comments are corrected: `useProgressView.ts:13`, `Home.tsx:17-19`, `StaticActivityFeed.tsx:14`.
- Matrix §11's `home/TrackCard.tsx:10` is stale: that comment no longer names a deleted file. No edit.

### R-D-7 · How V1 byte-for-byte is shown
A clean importer grep doesn't prove it, because Tailwind builds CSS from whatever source exists. Each PR runs both of these and pastes the result in the PR body:

1. **JS.** Build `origin/main`, then build the branch head with `frontend/src/data/releaseNotes.ts` restored from `origin/main`, because `releaseNotes.ts` sits in the entry chunk (`App.tsx` → `NotificationCenterHost` → `NotificationCenter` → `lib/syntheticNotifications.ts`), so an exception for "its chunk" would cover V1's shell. Restore the file afterwards. With hashes normalised in file names and contents, every JS file must be identical. Only `index.css` may differ.
2. **CSS.** A rule-level diff of `index.css`, built from the real head so release-note text can't slip a rule in: deletions only, `:root` unchanged, and the lost selectors exactly that PR's list in § Dry run. Any other selector stops the PR until it's audited as those 12 were: a literal search of the kept source plus the dynamic-class check, named in the PR body.

The comparison script is ad hoc and uncommitted (slice rule 6). D1's implementer writes it once, to `.superpowers/sdd/s2a-5b-bundle-diff.py`, and D2 and D3 reuse it.

### R-D-8 · The two `MountFarmSummary` tests go, per matrix §11
- They render a component nobody mounts, so nothing is ported.
- `beforeEach`'s `matchMedia` stub (`:55-69`) goes with them, as do `vi`, `beforeEach`, `createElement` and the testing-library imports, which only they used. The catalog tests pass without them (dry run).

### R-D-9 · The loop, sized for deletions
- `xivrp-implementer` (sonnet) for D1, which writes R-D-7's script. `model: haiku` for D2 and D3, whose edits the plan names in full.
- `pnpm deadcode` isn't literally unchanged, which is accepted here: D1 adds `FarmStatusBadge` and `FarmCatalogSummary` (`FarmProgress.tsx`, gone in D3); D3 adds `DataSource` and `TrialSummary` (`mountFarmStore.ts`, Carried). Anything else stops the PR.
- No `test-author`: no behaviour changes. No screenshots: no UI changes.
- One `redesign-reviewer` per PR. It's asked to check the importers and R-D-7's output, not to re-run them.
- Instead of slice-loop §2's full walk, D3 does one live smoke: `/group/DEVTST?shell=legacy` (Home, Goals & Farms) and `?shell=v2` (Home, Progress with a row open, Recruit ▸ Listing), with the console clean. The bundle proof is the evidence, and this catches what it can't.
- Run e2e `role-gating`, `home-pointers`, `objectives`, `progress` and `settings-suggestions` on D3. Playwright isn't in CI; the first three weren't re-run after C3, and the last two back the owner gate and criterion 9.

### R-D-10 · Order: smallest risk first, G-27 last
- D3 can't precede D1: `CollectionsTab` imports `FarmProgress`.
- D3 holds `MountFarmDetail`, the one file the matrix singles out, alone, so it's a clean revert.
- Each PR branches off `main` after the previous one merges. They aren't stacked.

## The PRs

| PR | Branch | Changed lines | Release note |
|---|---|---|---|
| D1 | `chore/s2a-5b-d1-orphans` | ~1,170 | internal 2.1.93 |
| D2 | `chore/s2a-5b-d2-objective-command` | ~730 | internal 2.1.94 |
| D3 | `chore/s2a-5b-d3-mount-farm-tree` | ~1,290 | internal 2.1.95 |
| W | `docs/s2a-5b-write-backs` | docs | none |

`CURRENT_VERSION` stays 2.1.80. All three are maintenance with no user-visible change, so internal.

### PR D1 · The two zero-importer cards and `CollectionsTab`

**Delete:** `components/profile/CollectionsTab.tsx`, `CollectionsTab.test.tsx`, `components/collections/CatalogFarmRow.tsx`, `SuggestionFarmCard.tsx`.

**Edit:** `frontend/eslint-suppressions.json`: remove `src/components/profile/CollectionsTab.tsx`'s entry and nothing else. `utils/collectionBadgeConfig.ts:6`: drop `SuggestionFarmCard` from the list, comment only (R-D-6). `releaseNotes.ts`.

**Done when:** gates pass, knip's unused files read 6, R-D-7 is pasted, and `rg "CollectionsTab\b|CatalogFarmRow|SuggestionFarmCard" frontend/src -g '!**/releaseNotes.ts'` matches only `SourceFarmCard.tsx:4`.

### PR D2 · `ObjectiveCommandCenter`, its store, `useTrackParam`

**Delete:** `components/static-group/ObjectiveCommandCenter.tsx`, its test, `stores/objectiveCommandStore.ts`, `hooks/useTrackParam.ts`, its test.

**Edit:** `components/progress/useProgressView.ts:13` (drop the sentence). `hooks/useUrlTabState.ts:41` (`useProgressView`, comment only). `releaseNotes.ts`.

**Done when:** gates pass, R-D-7 is pasted, `rg "ObjectiveCommand|useTrackParam" frontend/src -g '!**/releaseNotes.ts'` matches nothing, and `git diff main -- frontend/src/hooks/useUrlTabState.ts` is one comment line.

### PR D3 · The mount-farm tree

**Precondition:** D1 is merged.

**Delete:** `components/mount-farms/` (six files).

**Edit:**
- `gamedata/mount-farms.test.ts` (R-D-8).
- `frontend/README.md:48`: remove the line.
- `frontend/eslint.config.js:56`: `(collections|progress)`.
- `components/home/Home.tsx:17-19`, `components/home/StaticActivityFeed.tsx:14`: the ring rule stays; the example no longer names the deleted directory.
- `releaseNotes.ts`.

**Done when:** gates pass, unit totals are 402 files and 5,818 tests, lint is 0 errors with at most 784 warnings, knip's unused files read 4, R-D-7 is pasted, the smoke and e2e in R-D-9 pass, and:
- `rg "components/mount-farms" frontend/src frontend/eslint.config.js frontend/README.md -g '!**/releaseNotes.ts'` matches nothing;
- `rg "MountFarm(Tab|Detail|Summary)|\bFarmProgress\b|farmProgressUtils" frontend/src -g '!**/releaseNotes.ts'` matches only `StaticHomeTab.tsx:1442`.

### PR W · Write-backs (once, at the end)
- Matrix: §11 and P-112…P-125 marked shipped; the change log.
- Matrix §11's comment rule: record R-D-6's two exceptions, and that `TrackCard.tsx:10` no longer applies.
- Spec: §6's S2a-5 row and status; S2-14's "because the plugin calls them" (R-D-3).
- **Criterion 9 closes on routing, not removal:** `GoalsPage` and `CollectionsHub` stay until D1, and `GroupViewContent.tsx:50,1161-1165` still renders them; V2 only bypasses them through `slots.goals` (`NewShell.tsx:203`). The proof is `e2e/settings-suggestions.spec.ts`. Correct spec :271's "not yet by removal" and :176, which puts `GoalsPage` and `CollectionsHub` among the lines being deleted. Record criterion 11's S2a-5b evidence (R-D-7).
- `docs/PRODUCT_MODEL.md` §6; `HOME_STRETCH.md:130,220,223,240` and its log.
- `design/redesign/FRONTEND_STRUCTURE.md:100,101,136,205,206`.
- Memory: `project_home_stretch.md`, `MEMORY.md`.

## Owner gate

**G-27's row reads as already signed.** Matrix §15 has `[x] G-27 port (P-119, P-120) … date: 2026-10-01` and `[x] Sweep … 2,865 lines … date: 2026-10-01`, and `HOME_STRETCH.md:558` agrees. The handoff's "sign G-27's row" doesn't reflect that. But the tick came before the port existed, so the owner should confirm it stands now that the port has shipped.

| Legacy (`MountFarmDetail`, never mounted in either shell) | The port today | Evidence |
|---|---|---|
| Has and Wants checkboxes per member | Need · Want · Have · Pass, in the cell | `CellPicker.tsx`, `ProgressPage.ownCell.test.tsx` |
| Currency count per member | Totem count in the picker | `CellPicker.test.tsx:135` (own), `e2e/progress.spec.ts:568` (a lead's) |
| A lead edits any row | Edit statuses, with the limits in item 2 below | `e2e/progress.spec.ts:568`, `ProgressPage.editStatuses.test.tsx` |
| A member edits their own row | The own cell | `ProgressPage.ownCell.test.tsx` |
| Source badge and sync time | Provenance: "plugin, 2d ago", "self-reported", "you", "set by {name}" | `progressProvenance.ts`, `e2e/progress.spec.ts:304,609` |
| Manual-correction marker | "set by {name}", with the limit in item 3 below | `ProgressPage.editStatuses.test.tsx:414` |

`e2e/progress.spec.ts` ran on `main` for this gate on 2026-11-04: 61 of 61 passed.

Where the port differs, for the owner to accept. S2-4, S2-5 and S2-7 ruled much of this:
1. **A count needs a status first.** The picker's count is disabled until the member picks one (`CellPicker.tsx:211,214`). Legacy's count sat beside the checkboxes.
2. **Edit statuses doesn't reach every row.** Others' Not-on-the-roster cells and viewers' claimed cells stay read-only, and finished rows are read-only (`editStatuses.ts:39-46`).
3. **The manual correction loses its date and can lose its name.** Legacy kept a stored date ("Manual correction on {date}"). "set by {name}" has no date, and it doesn't survive a token-only plugin sync (spec :308, R-S1-8).
4. **The exchange summary has no V2 home.** Legacy's tooltip ("1 Oracle Totem for … at Uah'shepya in Solution Nine") is gone, and `getExchangeSummary` ends with no reader (R-D-4).
5. **Only tracked farms and claimed columns.** Legacy listed every trial and gave every non-viewer a row. A member with no card and no row has no cell (S2-4, S2-5).
6. **The Status column is gone** (Obtained · Pending · Ready · Farming · Skip). The cell's "✓ Have" and "Need 62/99" carry most of it; "Ready" and "Pending" have no direct equivalent (P-21's "Can buy" badge was RETIRED-ACK).
7. **Two records stay separate.** V1 Home and V2's activity feed read `MountFarmProgress`, which Progress edits never reach (spec :98). `PATCH /mount-farms/progress` has no UI caller today, so D3 doesn't change that; the split already exists.

## Carried (not this slice)

- `GET /static-groups/{id}/objective-command` has no client after D2 (`objective_goals.py:491`). A backend deletion, F3.
- `mountFarmStore.updateProgress` and `PATCH /mount-farms/progress` have no client today, and the store's `DataSource` and `TrialSummary` types lose their importers in D3. F3, or D1 of the release with the store.
- The six `gamedata/mount-farms.ts` exports in R-D-4. F3.
- `eslint.config.js`'s `ring3` and `FRONTEND_STRUCTURE.md` keep `collections/`, which V1 still uses.
