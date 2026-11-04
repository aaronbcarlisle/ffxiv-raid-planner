# S2a-4 · Find and Home's pointers (V2)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load `superpowers:subagent-driven-development` in this repo. Each PR below is one slice-loop run: its own ledger, one whole-branch review against its parent branch, and one fix wave.

**Plan-vet (2026-11-03).** `xivrp-director` returned **PASS with fixes**. Every finding is folded in below and in the design note: M-1…M-5, S-1…S-9 and C-1…C-8. The fold changed D-2, D-4, D-6, D-8 and D-10, cut A2 into A2 and A2b, and adds `useProgressView`'s single write (R-F-3). Because the plan-vet is done, slice-loop §0 needs no second one. **Owner (2026-11-03): D-1…D-14 all as recommended**, D-8's §12.1 amendment included.

**Goal (S2a-4a):**
- The Progress toolbar gets a Tracks ⇄ Find switch for every member role, and leads also get Track a farm.
- Find lists "Wanted by your static" first and never shows a private want.
- Leads:
  - **Track** seeds statuses and opens the row.
  - **The custom row** creates a custom farm and opens it in Edit.
- Members: **I want this** asks before sharing a private want, never writes blind, and never writes under View As.
- Viewers browse read-only.
- A footer line under the matrix names the top wanted farm.
- Every signed P-52…P-77 affordance is in Find, so the interim classic-view rows end.

**Goal (S2a-4b):** Home's TrackCard names the farm that is Progress's first farm row and opens it. It shows the tally and the pips, and who is next to everyone except a viewer. A Split clears row opens the split plan.

**Design (binding):** `design/redesign/specs/2026-11-03-s2a-4-find-and-home-design.md`: D-1…D-14, E-1…E-12, §3–§8. It builds on the parent spec, `design/redesign/specs/2026-09-30-s2a-progress-design.md`: S2-3, S2-5, S2-11, S2-12, §4 (`?pview=find`), and §7 criteria 7 and 8.

**Parity matrix (binding):** `design/redesign/specs/2026-09-30-s2a-parity-matrix.md`. The rows are P-09, P-13, P-14, P-52…P-77, P-89 (slice corrected), P-96…P-107, and §12.1 (amended by D-8, which the owner signed on 2026-11-03).

**Earlier plans (binding):**
- **S2a-2** (`plans/2026-10-08-s2a-2-progress-tab.md`):
  - R-S2-1 (stacks merge after a preflight);
  - R-S2-2 (new cases in new files);
  - R-S2-5 (the shared home);
  - R-S2-7 (rows);
  - R-S2-10 (no writes that ignore View As);
  - R-S2-14 (AUTHZ);
  - R-S2-16 (release notes);
  - R-S2-17 (absent controls).
- **S2a-3a:** R-S3-4 and R-S3-5.
- **S2a-3c:** E-5 (`cellFor`'s viewer rule) and the ghost-contrast lesson (`secondary` on `bg-surface-elevated`).

**Scope (binding).**
- Each task edits only the files it names.
- **Not edited:**
  - `components/collections/**`
  - `components/static-group/**`
  - `pages/**`
  - `hooks/useGroupViewState.ts`
  - `components/ui/**`
  - `components/primitives/**`
  - `backend/**` (no backend change at all, E-4)
  - `utils/discordPlan.ts`
- There is no migration, and **V1 renders byte-for-byte as it does today** (D-14).
- **Existing tests stay unedited**, with two exceptions: `home/TrackCard.test.tsx`, which TB1 rewrites with the card (D-12), and `home/Home.test.tsx`, where TB1 deletes one assertion, the retired card's heading in the side-stack order test (the plan missed it; D-12 retires the card). This works because of the S-3 testid and DOM-order rulings (E-7, D-5).

**Plugin contract (binding, `CLAUDE.md` § Pitfalls).** Nothing changes, because there is no backend edit.

## Size and stack

Estimates follow the S2a-2 rule: divide code lines by 0.35 to add the tests, then multiply by 1.8 for the measured overrun. The cap is about 1,500 changed lines per PR, not counting the plan.

| PR | Slice | Branch · base | Task (code est.) | Total |
|---|---|---|---|---|
| A1 | **S2a-4a·A1** the Find model | `feat/s2a4a-a1-find-model` · `main` | TA1 `findModel.ts`, `suggestionsError` (~160) | ~820 |
| A2 | **S2a-4a·A2** the URL and the toolbar | `feat/s2a4a-a2-progress-view` · A1 | TA2 `useProgressView`, `?farm` map, `?track` wins, `ProgressToolbar`, the switch, the Find placeholder (~150) | ~780 |
| A2b | **S2a-4a·A2b** the list | `feat/s2a4a-a2b-find-list` · A2 | TA2b `FindList`, `FindRow`, search, Clear, three filter groups, Clear filters, P-55/58/60/71/75 (~270) | ~1,390 |
| A3 | **S2a-4a·A3** the actions | `feat/s2a4a-a3-find-actions` · A2b | TA3 Track, I want this with the Share prompt, the labels, the custom row, Track a farm, the footer (~280, **deep**) | ~1,440 |
| A4 | **S2a-4a·A4** the Find proof | `feat/s2a4a-a4-find-proof` · A3 | TA4 e2e, axe, role gating, guest (~0 product code) | ~600 |
| B1 | **S2a-4b·B1** the TrackCard | `feat/s2a4b-b1-trackcard` · `main` (after S2a-4a merges) | TB1 `progressState.ts` move, the shared columns helper, `trackCardModel.ts`, `FarmPips`, TrackCard, Home's fetches (~240) | ~1,230 |
| B2 | **S2a-4b·B2** the split row and the proof | `feat/s2a4b-b2-split-row` · B1 | TB2 the split row (~60), e2e for criterion 8, the split row, role gating, guest | ~800 |

**Order.** A1…A4 form one stack, cut from `main`. B1's branch is cut from a `main` that already holds A4. B1 and B2 form the second stack.

**Worktrees.** Each stack gets its own: `.claude/worktrees/s2a4a` and `.claude/worktrees/s2a4b`. Copy `frontend/.npmrc` in before running `pnpm -C frontend install` (`CLAUDE.md`).

**The cap.** At each Finish, run `git diff --stat <parent>...HEAD`.
- If A3 runs over, the footer becomes its own PR, A3b.
- If A2b runs over, P-58's member-state body moves to A3.
- Record the cut in the ledger. Don't trim tests.

**Merging (R-S2-1).** Do this per stack, in one session:
1. Bring the stack up to date with the latest `main`. GitHub hasn't auto-restacked the last three stacks, so go straight to `git rebase --update-refs --onto origin/main <old lower head>`, check that the trees are equal, and push with `--force-with-lease`.
2. Push the top commit to `redesign/s2a4a-preflight` (or `s2a4b-`) as a draft PR labelled `no-automerge`.
3. Run `e2e/progress.spec.ts`, `e2e/role-gating.spec.ts` and `e2e/guest.spec.ts`, plus B2's new spec file if it creates one, locally on that tree.
4. Merge bottom-first once that run and CI are green on that exact tree.
5. Close the preflight PR.

## Code facts (recon on 2026-11-03 at `8e871801`, re-checked by the plan-vet; each task re-checks its own cites before editing)

| Fact | Where | Consequence |
|---|---|---|
| The spec reserves `?pview=find` (default `tracks`, omitted from the URL) | parent `:177` | E-1 |
| `SEEDED_TAB_PARAMS`; `clearRegisteredTabParams` only deletes; V1 never writes `pview` | `hooks/useUrlTabState.ts:31-44,55-60` | `pview` joins the list safely |
| React Router 7 `setSearchParams` builds from the render-time params: two setters in one handler clobber each other (R-D11-B) | `components/loot/Loot.tsx:455-470,894-899` | R-F-3's single write |
| `editControls.start` calls `setTrack` | `progress/ProgressPage.tsx:478-518` (`:491-492`) | It goes through `setProgressView` |
| "Remember" tab memory keeps every param on `setPageMode` | `hooks/useGroupViewState.ts:327-340` | D-9: `?track` wins |
| `?farm=suggested\|catalog` is read by V1 | `useGroupViewState.ts:39,42`; `collections/CollectionsHub.tsx:33` | Map it in `ProgressPage` only |
| `useTrackParam` writes `?track` with replace | `hooks/useTrackParam.ts:17-37` | Routed through `setProgressView` |
| Today's toolbar is `EditStatusesBar` (testid `progress-toolbar`), shown only when `mayEdit && active.length > 0`; edit mode lives in page state | `ProgressPage.tsx:307-313,551-560`; `progress/EditStatusesBar.tsx:95-125` (`:96`) | E-7; C-4 ends edit mode on the switch |
| Members have no toolbar, asserted by that testid; Tab runs from "Edit statuses" into the tier row | `ProgressPage.editStatuses.test.tsx:150-160`; `e2e/role-gating.spec.ts:349`; `e2e/progress.spec.ts:327-329` | E-7's new testid; D-5's DOM order |
| The names map | `ProgressPage.tsx:287-295` (`memberNames`) | S-2 |
| Columns are built from active goals only | `ProgressPage.tsx:258-268` (`:265`) | S-9's shared helper |
| `SegmentedToggle` is the V2 view switch (two buttons) | `ui/SegmentedToggle.tsx`; `roster/RosterToolbar.tsx`, `loot/LootToolbar.tsx` | D-5; it counts as one control (C-8) |
| `Tag variant="filter"` needs `pressed` and `onClick` and sets `aria-pressed`; `variant="nav"` is a link tag | `ui/Tag.tsx:48-52,69-74` | TA2b; Tracking ✓ (P-60) |
| Search and filters examples | `loot/HistorySearch.tsx`; `finder/FinderFilters.tsx:59-64` | TA2b |
| Catalog: `fetchCatalog` → `GET /api/collection-catalog`; `catalog`, `catalogLoaded`, `catalogError` | `stores/collectionGoalStore.ts:621-636`; `backend/app/routers/collection_catalog.py:28-35` | Reused (E-6) |
| V1's chip sets (category, source, expansion: 3 dimensions); fallback merge; fallback ids `fallback-…` | `collections/CatalogBrowse.tsx:37-59,69-78`; `data/curatedCatalog.ts:22,56,91` | D-10; `trackable = !id.startsWith('fallback-')` |
| Grouping, search (it also matches the token name) and counts (source counts are per group) | `utils/collectionSourceGrouping.ts:38,93,108-112,135,146-153,156` | `findModel` reuses grouping and search, and counts per item (C-2) |
| Suggestions: `GET /static-groups/{id}/collection-suggestions` (viewers allowed); private wants dropped at the query; a union of wanted, tracked and old-tracker items, sorted by score; every non-viewer member listed per item; old-tracker `wants_mount` → `hunting` when there is no record (even when they own it); "Hunting (legacy)" in `reasons`; `display_name` is the Discord username | `routers/player_collection.py:191-208`; `services/collection_suggestion_service.py:110-112,265-270,285-300,352-413,384-387,398,430` | D-2's rule; S-2 |
| Response fields: `catalog_item_id`, `…_name`, `…_category`, `expansion`, `source_duty_name`, `source_type`, `static_goal_id`, `suggested_farm_score`, and `members[]` with `user_id`, `display_name`, `ownership_state`, `intent`, `token_count`, `can_buy`, … | `schemas/player_collection.py:48-69` | `FindItem`; P-58's body |
| `fetchSuggestions(groupId)` → `suggestions[groupId]`, `suggestionsLoading`; it swallows errors | `stores/collectionIntentStore.ts:261-275` | E-5 |
| Intents: `PUT /api/me/collection-intent/{catalog_item_id}` is a full replace; it ignores `X-View-As`; visibilities are `private`, `static_only`, `dossier_public` (default `private`); intents include `pass` and `hidden` | `routers/player_collection.py:87-139` (`:126-132`); `routers/static_groups.py:727,1289` (the only `X-View-As` reads); `models/player_collection_intent.py:6,17,52` | D-6 |
| The store: `fetchMyIntents` throws on failure; `myIntents`, `myIntentsLoaded`; `upsertIntent(catalogItemId, { intent, priority, visibility, notes })` already carries priority and notes | `collectionIntentStore.ts:76-81,199-252` (`:230-237`) | D-6 (M-5a); no store change for intents |
| The seeding route `POST …/collection-goals/from-suggestion` (lead only), body `{catalog_item_id, status}` (default `wanted`). It sets `token_name`/`token_cost`. Seed order: record Have > Hub pass > Hub want → Want > old tracker > record missing → Want. No signal means no row. There is no duplicate check | `routers/collection_goals.py:527-701` (`:554`, `:583-584`, `:624`, `:647-673`); `schemas/collection_goals.py:44-47` | D-7, E-4 |
| The store: `createGoalFromSuggestion(groupId, { catalogItemId, status })` returns the goal; `createGoal(groupId, { goalType, title, status, … })` (camelCase) appends to `goals`; `refreshGoalProgress(groupId, goalId, { lists: true })` | `collectionGoalStore.ts:211-227,545,659-672,902-907` | R-F-6 (C-1) |
| V1 catalog Track uses `createGoal` with no seeding, setting a linked duty and a note; V1 Suggested uses the seeding route with no status | `collections/TrackFromCatalogModal.tsx:43-64` (`:53-54`); `SuggestedFarmsTab.tsx:46-58`; `CollectionsHub.tsx:155-171` | Unedited (D-14); D-7's losses |
| V1 viewers browse Suggested and Catalog | `pages/GoalsPage.tsx:32`; `CollectionsHub.tsx:155-171` | D-4 (M-2) |
| Custom create: `POST …/collection-goals` (lead only), with `goal_type` + `title` (1–200) | `collection_goals.py:469-511`; `schemas/collection_goals.py:26-41` | D-8 |
| AUTHZ rows exist for every route used | `backend/tests/authz_matrix.py:240,242,511,513` | No new row |
| Rings: `home` (ring 0) may not import `progress` (ring 3); `useRosterSortPreset` is ring 0 | `frontend/eslint.config.js:54-56,133-135` | E-10 |
| The old TrackCard reads `useMountFarmStore().data.trials[0]`; Home renders it with no props | `home/TrackCard.tsx:21-53`; `home/Home.tsx:465-466`; `home/TrackCard.test.tsx:8` | D-12 |
| Home's member-gated fetch effect; the `fetchProgress` name already used there; `effectiveRole`, `effectiveUserId`; the `AttentionItem` type; `attentionItems` and the empty copy | `Home.tsx:88,120,128-130,140-194,258-328,416-425` | E-8, E-9, D-13 (C-7) |
| The model: `ProgressData`, `ProgressReader`, `buildColumns`, `cellFor` (a viewer gets no counts and no rank), `haveTally`, `compareFarmRows`, `splitFarmRows`. `STATE_TEXT` is private, and Need and blank have no glyph | `utils/progressModel.ts:23-33,76-114,155-182,187-204,209-273,278-321` | TB1 (S-7) |
| `queueFor`, `QueueEntry`, `queueEntryText` ("Need 62/99"); the caller enforces the viewer rule on order | `utils/progressQueue.ts:4-5,10-21,54-74,125-129` | D-11's own format |
| `GOAL_TYPE_LABELS`, `GOAL_TYPE_ICONS` (safe for ring 0) | `utils/goalTypeMeta.ts:1-40` | TA2b, TB1 |
| `ProgressCell`'s tones are private; role colours come from `getRoleColor` | `progress/ProgressCell.tsx:28-33`; `gamedata/jobs.ts:177` | E-10's move |
| `onNavigate('goals', extra)` → `tab=progress` plus the params | `pages/NewShell.tsx:81`; `useGroupViewState.ts:50-52,309-341` | The card's and the row's links |
| `?track=tier` opens for members when split clears are on, on the active tier only | `ProgressPage.tsx:348-397`; `progress/TierExpansion.tsx:28` (`TIER_TRACK`) | D-13 |
| The legacy split card: readiness through `getSplitClearReadiness`, with players filtered | `static-group/StaticHomeTab.tsx:1591-1626,1641,1653-1660,1770-1776`; `utils/splitClear.ts:54` | E-11 |
| `splitClearStore.fetchData` nulls `data` first; the store is unkeyed | `stores/splitClearStore.ts:53-58,129` | E-8's per-static result |
| e2e helpers: `seedFarm` and `setStates` are at module scope but not exported; `helpers/owner.ts` has `setSplit`, `withSplit`, `setRole`, `ownerSession`; role-gating sweeps Home; so does the guest spec | `e2e/progress.spec.ts:60,79,747,758`; `e2e/helpers/owner.ts:12-66`; `e2e/role-gating.spec.ts:219,240`; `e2e/guest.spec.ts:55` | TA4, TB2 |
| `CURRENT_VERSION = '2.1.80'`; the newest entry is 2.1.81 (internal) | `data/releaseNotes.ts:12,63` | E-12 |

## Rulings (bind every task)

The design note's D-n and E-n rulings bind. The plan adds its own:

### R-F-1 · the model (E-2, D-2, D-3, D-10)

`utils/findModel.ts` exports the following.

**Types and helpers:**
- `FindFilters { category: string | null; source: string | null; expansion: string | null }`, plus `hasFilters(f)`.
- `normalizeQuery(q)`: trims, lower-cases and caps the query at 200 characters. A query that is only whitespace becomes `''`.
- `FindItem`, with these fields:

| Field | Meaning |
|---|---|
| `id`, `name`, `category`, `sourceType` | The item's identity |
| `duty`, `expansion` | `string \| null` |
| `token: { name: string; cost: number } \| null` | The exchange (P-75) |
| `pluginReady: boolean` | From the catalog field V1's plugin-ready tag reads (P-71; TA1 cites it) |
| `members: SuggestionMember[]` | From the join |
| `wantedBy: string[]` | Members with intent `hunting` or `interested` whose `ownership_state` isn't `have` |
| `tracking: string \| null` | The goal id |
| `trackable: boolean` | `!id.startsWith('fallback-')` |

**`buildFindList({ catalog, suggestions, goals, groupId, query, filters })`** returns `{ wanted, all, counts: { wanted, all, byCategory, bySource, byExpansion }, anyWanted }`.
- **`wanted`** holds the items with `wantedBy.length > 0`, untracked first, then tracked. Each part is sorted by score (descending), then name, then id.
- **`all`** holds every catalog item, in the order `groupCatalogBySource` gives them.
- **Filtering:** both lists are filtered by the query (name, duty, expansion and token name, as V1's search) and by the filters.
- **Counts** are per item row.
- **`anyWanted`** ignores the query and filters, so P-55's guidance line shows only when nothing is wanted at all.
- **A failed catalog:** a wanted item missing from the catalog is still listed in `wanted`, built from its suggestion row.
- **`tracking`** is the id of a goal in this static whose `catalogItemId` matches and whose status isn't `complete`.

**`topWanted(list)`** returns the first untracked wanted item, or null.

### R-F-2 · the store (E-5)

`collectionIntentStore` gains `suggestionsError: Record<string, string | null>`.
- A failure sets it to `messageOf(err)`, and a success clears it.
- `fetchSuggestions` keeps its signature and still swallows errors, so V1's callers see no change.

It's additive, under V1 delta (e).

### R-F-3 · the view and the URL (E-1, D-4, D-9, M-3, M-4, C-4)

**The hook.** `progress/useProgressView.ts` exports `useProgressView()` → `{ pview, track, edit, setProgressView(patch: { pview?, track?: string | null, edit?: string | null }) }`.
- `setProgressView` sets every param in `patch` in one `setSearchParams(prev => …, { replace: true })`. `null` deletes a param, and `pview: 'tracks'` deletes `pview`.
- It's kept in a latest-setter ref, so a write after an `await` uses the current params.
- `useTrackParam` stays as it is for V1 or other callers, but `ProgressPage` and `editControls.start` use `setProgressView` only.

**`ProgressPage`'s rules:**
1. If `track` is set while `pview === 'find'`, one write deletes `pview` (`?track` wins).
2. On mount, if `?farm` is `suggested` or `catalog`, one write sets `pview=find` and deletes `farm`.
3. Switching to `find`:
   - runs the existing discard guard if an Edit is dirty;
   - then, in one write, sets `pview=find` and clears `track` and `edit`;
   - also ends edit-statuses mode.

**Tests** check the final URL after each rule, after Track and after the custom row.

### R-F-4 · the toolbar (D-5, E-7, R-S2-17)

`progress/ProgressToolbar.tsx`: `ProgressToolbar({ view, onView, lead, editBar, onTrackFarm })`, with testid `progress-view-bar`. In DOM order it holds:
1. The `SegmentedToggle`, labelled "Progress view", with Tracks and Find.
2. **Track a farm**, for leads only: `Button variant="secondary" size="sm"`, `leftIcon` `Plus`.
3. `editBar`, which is the existing `EditStatusesBar` node or null. It is hidden in Find.

It renders for every member role. A test counts the controls in each state, at rest, in edit mode and in Find, and expects four or fewer each time. The switch's group counts as one control.

### R-F-5 · the list (E-3, D-10)

**`progress/FindList.tsx`.** The signature is:

`FindList({ list, query, onQuery, filters, onFilters, renderAction, names, expandedId, onExpand, footer, error, onRetry, catalogFallback, onRetryCatalog, searchRef })`

It renders, in order:
1. The search `Input`, labelled "Search farms", with `maxLength` 200 and ref `searchRef`. A Clear `IconButton` ("Clear search") shows while the query has text.
2. Three `role="group"` filter sets, labelled "Category", "Source" and "Expansion". Each has an "All" tag.
3. **Clear filters** (`Button variant="secondary" size="sm"`), shown while `hasFilters`.
4. `<section aria-labelledby>` "Wanted by your static ({n})", with three possible states:
   - P-55's line when `!anyWanted` and there is no query or filter;
   - nothing at all when there are no matches;
   - the inline error and Retry when `error` is set.
5. `<section>` "All farm sources ({n})".
6. "No farms match "{q}"" when both lists are empty.
7. `footer` last.

When `catalogFallback` is set, a line and Retry sit above the lists (P-67).

**`progress/FindRow.tsx`.** The signature is `FindRow({ item, names, expanded, onToggle, action, readerIsViewer })`.
- It holds about 56 px of content.
- The toggle is an `IconButton` "Show details for {name}", with `aria-expanded` and `aria-controls`.
- The meta line shows the token as "{cost} {token}" and the plugin-ready `Tag variant="label"` (P-71).
- "{n} want" reads "{n} wants" when n is 1.
- **The body** is `inert` and `hidden` while collapsed.
  - **When expanded:** a list of every member's state ("{name}: Want", "{name}: Have", …). Counts are shown unless the reader is a viewer, or unless `token_count` is null (B1; P-58). Then come the source facts.
  - **Names** come from `names` (`memberNames`). A member not in it is "A member".

**Tracking ✓** is a `Tag variant="nav"` that opens `setProgressView({ pview: 'tracks', track })` (P-60). The row renders it for every role, so `renderAction` never has to.

### R-F-6 · the actions (D-6, D-7, D-8, §3.2–§3.3)

`progress/findActions.tsx` exports `LeadFindAction`, `MemberFindAction` and `CustomTrackRow`. All three share these rules:
- While writing, the control is `aria-disabled` with `BUSY_CLASS` (`progress/useDrops.ts:27`).
- One write at a time per row.
- On error, toast unless `wasToastedByApi`.

**Lead.** For a trackable item that isn't tracked, **Track** (`secondary`) runs:
1. `createGoalFromSuggestion(groupId, { catalogItemId: id, status: 'farming' })`;
2. `refreshGoalProgress(groupId, goal.id, { lists: true })`;
3. `onTracked(goal.id)`, which makes one `setProgressView({ pview: 'tracks', track: goal.id })`;
4. `toast.success('Tracking {name}')`.

A fallback item shows "Offline list: retry to track" instead.

**Member.** `ProgressPage` doesn't render `MemberFindAction` when `isViewingAs` is set or the item isn't trackable. Otherwise:
- **While loading:** until `myIntentsLoaded`, a busy placeholder.
- **On a load error:** "Couldn't load your wants" with a Retry, and nothing is written.
- **A shared want** (`hunting` or `interested`, with `static_only` or `dossier_public`) shows **Wanted ✓** (label).
- **An existing row** (any intent) shows **I want this**:
  - **Private:** the prompt shows in the row's body line: "Your want is private. Share it with your statics?", followed by **Cancel** (in the trigger's slot, and focused) and then **Share**. Escape cancels; it's prevented, so nothing else closes. Share sends `upsertIntent(id, { intent: 'hunting', priority: existing.priority, visibility: 'static_only', notes: existing.notes })`.
  - **Not private:** the same PUT, keeping `existing.visibility`, with no prompt.
- **No row** shows **I want this**, which PUTs `{ intent: 'hunting', priority: 'medium', visibility: 'static_only', notes: null }` with no prompt.
- **After success:** `fetchSuggestions(groupId)`, then toast "Your statics can see you want {name}".

**Custom row (leads).**
- When `normalizeQuery(query)` is non-empty, it shows `Button variant="secondary"` "Track "{trimmed}" as a custom farm". Clicking it runs:
  1. `createGoal(groupId, { goalType: 'custom_reward', title: query.trim().slice(0, 200), status: 'farming' })`;
  2. `onCreated(goal.id)`, which makes one `setProgressView({ pview: 'tracks', track: goal.id, edit: goal.id })` through `editControls.start`'s single-write form;
  3. `toast.success('Tracking {title}')`.
- Otherwise it shows `<p className="text-xs text-text-muted">Type a name to track a custom farm</p>`.

**Track a farm** makes one `setProgressView({ pview: 'find', track: null, edit: null })`, then focuses `searchRef` in a layout effect.

### R-F-7 · the footer (§3.4, D-4)

`progress/FindFooter.tsx` renders under `ProgressMatrix`, for every member role, when `topWanted` is non-null:
- `<p className="text-xs text-text-secondary">` "{A} and {B} want {farm}". It uses "{A} wants {farm}" for one person, and adds "and {k} more" past two.
- Then " · " and a `LinkText` "Find", with `aria-label` "Find {farm}". It makes one `setProgressView({ pview: 'find', track: null })`, sets `expandedId` and focuses that row's toggle.
- Names come from `memberNames`.

Suggestions are fetched once per static per mount.

### R-F-8 · the state module (E-10, S-7)

`utils/progressState.ts` holds:
- `STATE_TEXT`, moved from `progressModel.ts` and unchanged;
- `STATE_TONE`, moved from `ProgressCell.tsx:28-33` and unchanged;
- a new `PIP_GLYPH: Record<'need' | 'want' | 'have' | 'pass' | 'none', string>`, with a distinct non-empty glyph for each. The implementer picks them, and the test asserts they're distinct.

The two old sites import from it.

This is a pure move, checked three ways:
- `progressModel.test.ts`, `ProgressCell`'s tests and every progress test pass unedited;
- grep finds no other copy;
- `dupes` doesn't rise.

### R-F-9 · the card model (D-11, S-9)

**The shared columns helper.** `utils/progressView.ts`: `progressInputs({ goals, groupId, players, sortPreset, data })` → `{ activeGoals, columns }` is the helper Progress uses at `ProgressPage.tsx:258-268`. `ProgressPage` switches to it with no behaviour change; its tests stay unedited.

**The card model.** `utils/trackCardModel.ts`: `trackCardFor({ data, columns, reader, readerIsViewer })` → `TrackCardModel | null`:
- **Shape:** `{ goalId; title; typeLabel; typeIcon; tally: { n; m }; pips: { name; role; state }[]; next: { name; count: number | null; needed: number | null } | null }`.
- **When it's null:** whenever `splitFarmRows(data, columns, reader).active` is empty.
- **`pips`** are the counted columns (claimed, not on Pass), in column order.
- **`next`** is `queueFor(row, goal.priorityMode)[0]`. It is null when `readerIsViewer` or the queue is empty.
- **`count`** is null when the count is hidden. **`needed`** is the goal's token cost, or null.

`nextText(next)` renders "{name} is next (62/99)", "(62)", or no bracket.

### R-F-10 · the card (D-11, D-12, E-8, E-9)

**`home/TrackCard.tsx`** is rewritten as `TrackCard({ group, tier, onNavigate })`. It reads the stores and the reader inside.
- **Columns:** it calls `useRosterSortPreset` as Progress calls it, then `progressInputs`.
- **When it hides:**
  - until `loadedGroupId === group.id` and progress has loaded;
  - on error;
  - for guests;
  - when the model is null.
- **Layout:** `CardShell` is titled "Farm". The body holds:
  - `LinkText` "{title}", which calls `onNavigate('goals', { track: id })`;
  - "· {typeLabel}";
  - the tally line;
  - `FarmPips`;
  - the next line.

**`home/FarmPips.tsx`** is a `role="img"` whose `aria-label` groups members by state ("Need: A, B; Want: C; Have: D; No status: E"). Each pip is a role-coloured dot carrying its `PIP_GLYPH`.

**`Home.tsx`:**
- It passes the card its props.
- It adds `fetchGoals` and the goal-store progress fetch to its member branch, imported under an alias so it doesn't clash with the mount-farm `fetchProgress` at `:120` (C-7).
- It keeps the mount-farm fetch for `StaticActivityFeed`.

### R-F-11 · the split row (D-13, E-8, E-11, C-7)

**The fetch.** `Home.tsx` keeps `splitResult: { groupId; data } | null`, filled from its own `fetchSplitClear` call. That call runs only when `tier.isActive`, for a member or a viewer. *(As built it is an effect of its own, not the member branch: B2's ledger ruled that setState in that branch loops under unstable mock deps and breaks asks-once. The goals and cells (R-F-10) have an effect of their own too, and both carry the same `group.userRole` gate.)*

**When the row shows.** It's added after the existing kinds when:
- `splitResult.groupId === group.id`;
- `splitResult.data?.enabled`;
- and `tier.isActive`.

**What it shows:**
- the title "Split clears";
- the meta `Alts assigned ${x}/${y}`, plus ` · ${n} need attention` when n > 0. All three come from `getSplitClearReadiness`, using legacy's filter: x is `altCount`, y is `memberCount`, and n is `issueMemberCount` (members with something to fix, as legacy's card counts them, not `issueCount`'s warnings);
- the action `Button variant="secondary" size="sm"` "Open split plan", which calls `onNavigate('goals', { track: 'tier' })`.

`AttentionItem`'s variant type widens to include it (`Home.tsx:88`).

### R-F-12 · release notes (E-12, R-S2-16)

Each PR takes the next free version at its Finish, marked `internal: true` on both the item and the release. `CURRENT_VERSION` doesn't move.

| PR | Item |
|---|---|
| A1 | "Progress: the Find model" |
| A2 | "Progress: the Tracks and Find switch" |
| A2b | "Progress: the Find list" |
| A3 | "Progress: Track, I want this and custom farms in Find" |
| A4 | "Progress: Find end-to-end checks" |
| B1 | "Home: the farm card" |
| B2 | "Home: the split clears row" |

Each item carries `pr` and `prTitle`. Escape `'` as `\'`.

### R-F-13 · V1 intact (D-14)

No diff touches any path in § Scope's "Not edited" list. Two stores' existing tests also pass unedited:
- `collectionIntentStore`'s tests;
- `collectionGoalStore.test.ts`.

## Shared files (V1 reaches them)

| File | The edit (task) | V1 path | Pinned by (unedited) |
|---|---|---|---|
| `stores/collectionIntentStore.ts` | `suggestionsError` (TA1) | V1 Suggested, Profile Collections | its existing tests |
| `hooks/useUrlTabState.ts` | `pview` in `SEEDED_TAB_PARAMS` (TA2) | every tab URL | `useUrlTabState` tests |
| `utils/progressModel.ts` | `STATE_TEXT` moved out (TB1) | none (V2 only) | `progressModel.test.ts` |

## Review Focus

- **TA1:**
  - Wanted means `hunting` or `interested`, and not Have. Pass, owned and no-signal members don't count.
  - Untracked items come before tracked ones.
  - "Tracking" means open goals only, in this static only.
  - Fallback items aren't trackable.
  - The query is capped and normalised, and a blank query is empty.
  - Counts are per item.
- **TA2:**
  - Every view change is one URL write, and the final URL is asserted.
  - `?track` wins.
  - `?farm` maps once and is removed.
  - The discard guard runs on the switch, and edit mode ends.
  - At most four controls in every state.
  - The existing toolbar assertions still hold, unedited.
  - V1 tabs are unaffected by the new seeded param.
- **TA2b:**
  - Every signed affordance is present: P-55, P-58, P-60, P-64, P-65, P-66, P-71, P-75.
  - `inert` on collapsed bodies.
  - B1 counts are hidden from a viewer in the body.
  - No Discord names.
- **TA3:**
  - A private want is never written without Share.
  - Nothing is written before `myIntentsLoaded`, or under View As.
  - Every existing row keeps its `priority` and `notes`.
  - Focus lands on Cancel.
  - One request per click.
  - Track opens the new row (final URL).
  - The custom row opens Edit with Title focused.
  - Escape in the prompt closes nothing else.
- **TA4:**
  - The criterion-7 walk, end to end.
  - axe with a row expanded and with the prompt open.
  - The guest sends no catalog, suggestion or intent request.
  - Fail-first against `main`.
- **TB1:**
  - The move changes no class string.
  - The card names `splitFarmRows`' first row under every sort preset, using the shared columns.
  - A viewer reader gets no next line and no count.
  - A hidden count gives no bracket.
  - `free_roll` gives no next line.
  - A static switch never shows the old static's card.
- **TB2:**
  - The split row is hidden on a past tier and with split clears off.
  - A viewer sees it.
  - It opens the split plan.
  - Criterion 8 holds end to end.
- **UI rules:**
  - No raw elements.
  - Semantic tokens only.
  - The `text-xs` floor.
  - No modal, and nothing sticky.
  - `secondary`, not `ghost`, on `bg-surface-elevated`.

---

### PR A1 · S2a-4a·A1 — the Find model

#### Task TA1 — `findModel.ts` and `suggestionsError` (`test-author`, then `xivrp-implementer`)

**Goal:** E-2, E-5, D-2, D-3 and D-7's `trackable`; R-F-1 and R-F-2.

**Files:**
- **Create:**
  - `frontend/src/utils/findModel.ts`;
  - `utils/findModel.test.ts`;
  - `stores/collectionIntentStore.suggestionsError.test.ts`.
- **Modify:** `stores/collectionIntentStore.ts`.
- **Release note:** add A1's item.

**Produces:** `buildFindList`, `topWanted`, `normalizeQuery`, `hasFilters`, `FindItem`, `FindFilters`, `suggestionsError`.

1. **Tests first** (`test-author`):
   - **Wanted:**
     - A `hunting` member and an `interested` member both make an item wanted.
     - A `hunting` member whose `ownership_state` is `have` doesn't.
     - Members who are all `none`, owned or `pass` don't.
   - **Order:**
     - Untracked comes first, then tracked.
     - Score, then name, orders each part.
   - **Tracking:**
     - A `complete` goal doesn't count.
     - Another static's goal doesn't count.
   - **`all`:**
     - It lists every catalog item, wanted ones included, grouped as `groupCatalogBySource` groups them.
   - **The query:**
     - It matches name, duty, expansion and token name, case-insensitively.
     - A 300-character query is cut to 200.
     - A query of only spaces is empty.
   - **Filters and counts:**
     - The three filters combine.
     - Counts are per item and follow the filters.
     - `anyWanted` ignores both.
   - **Fallback and a failed catalog:**
     - A `fallback-` item has `trackable: false`.
     - A wanted item missing from a failed catalog is still listed.
   - **`topWanted`:** it skips tracked items, and returns null when none remain.
   - **`suggestionsError`:**
     - A failure sets `suggestionsError[groupId]`, and a later success clears it.
     - `suggestions` is untouched on failure.
2. **Implement.**
3. **Gates:**
   - the touched tests;
   - `lint` and `build`;
   - `test`;
   - `deadcode` (the allowed delta, § Finish);
   - `dupes`.

### PR A2 · S2a-4a·A2 — the URL and the toolbar

#### Task TA2 — `useProgressView`, the rules, `ProgressToolbar` (`test-author`, then `xivrp-implementer`)

**Goal:** E-1, E-7, D-4 (the switch for every role), D-5, D-9 and C-4; R-F-3 and R-F-4. While `pview=find`, the matrix region renders an empty `<section aria-label="Find">` placeholder, which A2b fills.

**Files:**
- **Create:**
  - `progress/useProgressView.ts`;
  - `progress/ProgressToolbar.tsx`;
  - `useProgressView.test.tsx`;
  - `ProgressToolbar.test.tsx`;
  - `ProgressPage.view.test.tsx`.
- **Modify:**
  - `progress/ProgressPage.tsx`;
  - `hooks/useUrlTabState.ts`.
- **Release note:** add A2's item.

1. **Tests first:**
   - **`setProgressView`:**
     - `{ pview, track }` in one call leaves both in the final URL.
     - A write after an `await` keeps the params set in between.
   - **The switch:**
     - A lead, a member, an owner and a viewer all see it.
     - The toolbar's testid is `progress-view-bar`.
   - **Arriving in Find:**
     - `?farm=catalog` → Find, with `farm` removed.
     - `?pview=find&track=<id>` → Tracks with the row open and `pview` gone.
   - **Switching to Find:**
     - With `?track=<id>` open, `track` is gone afterwards.
     - With a dirty Edit, the discard guard asks first.
     - In edit-statuses mode, the mode ends.
   - **The control count:** for a lead, the count is four or fewer at rest, in edit mode and in Find.
   - **Track a farm:**
     - It's absent for members and viewers.
     - It sets `pview=find` and clears `track`.
   - **DOM order:** the switch, then Track a farm, then Edit statuses.
   - **Unedited assertions:** the existing `ProgressPage.editStatuses.test.tsx` member assertions pass unedited.
2. **Implement.**
3. **Gates:** as TA1, plus `check:design-system:strict`.

**Acceptance (browser):**
- Users: DevOwner and DevMember on DEVTST (`?shell=v2&tab=progress`).
- Walk: the switch both ways, `?farm=catalog`, and `?pview=find&track=<id>`.
- Themes: light and dark.

### PR A2b · S2a-4a·A2b — the list

#### Task TA2b — `FindList`, `FindRow`, search and filters (`test-author`, then `xivrp-implementer`)

**Goal:** E-3, E-6, D-3 and D-10; R-F-5. `renderAction` is passed as `() => null` here, so Find is read-only, except for Tracking ✓, which the row owns.

**Files:**
- **Create:**
  - `progress/FindList.tsx` and `progress/FindRow.tsx`;
  - `FindList.test.tsx` and `FindRow.test.tsx`;
  - `ProgressPage.find.test.tsx`.
- **Modify:** `progress/ProgressPage.tsx` (the placeholder becomes `FindList`, and the fetches).
- **Release note:** add A2b's item.

1. **Tests first:**
   - **The sections:**
     - They render in order, with their counts.
     - P-55's line shows with nothing wanted.
     - With a filter set and no wanted match, there's no wanted section.
   - **Search:**
     - It filters, and Clear empties it.
     - An empty match shows the message.
   - **Filters:**
     - The three filter groups each set `aria-pressed`.
     - Clear filters resets them.
   - **The row's collapsed line:**
     - The token and plugin-ready tag show on the row (P-75, P-71).
     - It reads "1 wants" or "2 want".
   - **The row body:**
     - Collapsed, it's `inert` and hidden.
     - Expanded, it lists every member's state from the roster names. "A member" stands in for an unknown name, never the Discord name.
     - Counts are shown for a member reader and hidden for a viewer reader (P-58).
   - **Tracking ✓:** it's a link tag that opens `?track=<id>` (P-60).
   - **Failures:**
     - A catalog error → fallback items and a Retry.
     - A suggestions error → the inline error and a Retry.
   - **Guests:** a guest triggers no catalog or suggestion fetch.
   - **Viewers:** a viewer browses the list.
2. **Implement.**
3. **Gates:** as TA2.

**Acceptance (browser):**
- Users: DevOwner, DevMember and a viewer.
- Walk: search, each filter group, Clear filters, and a row expanded.
- Themes: light and dark.

### PR A3 · S2a-4a·A3 — the actions

#### Task TA3 — Track, I want this, the custom row, Track a farm, the footer (RISKIEST · `test-author`, then `xivrp-implementer-deep` with `model: fable`; task-scoped review)

**Goal:** D-5 (Track a farm's focus), D-6, D-7 and D-8; R-F-6 and R-F-7; design §3.2–§3.4.

**Files:**
- **Create:**
  - `progress/findActions.tsx` and `progress/FindFooter.tsx`;
  - `findActions.test.tsx` and `FindFooter.test.tsx`;
  - `ProgressPage.findActions.test.tsx`.
- **Modify:**
  - `progress/ProgressPage.tsx`;
  - `progress/ProgressToolbar.tsx` (the search focus).
- **Release note:** add A3's item.

**Consumes:**
- TA1–TA2b's exports;
- `createGoalFromSuggestion`, `createGoal`, `refreshGoalProgress`;
- `upsertIntent`, `fetchMyIntents`, `myIntentsLoaded`, `fetchSuggestions`;
- `setProgressView`, `editControls.start`;
- `toast`, `messageOf`, `wasToastedByApi`, `BUSY_CLASS`.

1. **Tests first** (mocked at the `api` layer):
   - **Lead: Track**
     - Track sends one POST to `from-suggestion` with `{ catalog_item_id, status: 'farming' }`. A double click still sends one.
     - The final URL then has no `pview` and has `track=<new id>`.
     - The row is open and the toast reads "Tracking {name}".
     - A 403 the api already toasted isn't toasted again.
   - **Lead: fallback, custom row and Track a farm**
     - A fallback item shows the offline text.
     - **The custom row:**
       - With "Foo", one POST to `collection-goals` with `goal_type: 'custom_reward'`, `title: 'Foo'` and `status: 'farming'`.
       - The final URL has `track` and `edit` set to the new id, and the Title input is focused.
       - With an empty search or "   ", a muted line and no control.
     - Track a farm opens Find with the search focused.
   - **Member: before the intents load**
     - Before `myIntentsLoaded`: no PUT is possible.
     - When `fetchMyIntents` fails: "Couldn't load your wants" and a Retry, with no PUT.
   - **Member: writing a want**
     - **No row:** one PUT `{ intent: 'hunting', priority: 'medium', visibility: 'static_only', notes: null }`, then a suggestions refetch and the toast.
     - **A private row:**
       - the prompt appears with focus on Cancel;
       - Cancel sends no request and puts focus back on I want this;
       - Escape cancels and is prevented;
       - Share sends one PUT keeping the existing `priority` and `notes`, with `visibility: 'static_only'`.
     - **A private `pass` row:** the prompt appears too, and Share keeps the row's priority and notes.
     - **A `dossier_public` row:** never downgraded.
     - **A shared want:** "Wanted ✓".
   - **Who sees what**
     - Under View As, no I want this, and `fetchMyIntents` is never called.
     - A fallback item has no I want this.
     - A member sees no Track and no custom row. A lead sees no I want this. A viewer sees no action.
   - **The footer**
     - **Wording:**
       - "{A} and {B} want {farm} · Find", using roster names;
       - one wanter → "wants";
       - three wanters → "and 1 more".
     - **The link:** Find opens Find with that item expanded and its toggle focused.
     - **When it shows:**
       - a viewer sees it;
       - it's hidden when every wanted item is tracked.
2. **Implement.**
3. **Gates:**
   - as TA2;
   - plus `git diff <parent>...HEAD` over § Scope's "Not edited" paths, which must be empty.

**Acceptance (browser):** on DEVTST, in light and dark.
- **As DevOwner:**
  1. Track a wanted catalog item; its row opens with the seeded statuses.
  2. Track "Test custom" as a custom farm; Edit opens with Title focused.
  3. Delete both afterwards.
- **As DevMember:**
  1. Set a Hub want to private first.
  2. I want this → the Share prompt → Cancel.
  3. Then Share; the wanted section updates.
  4. Restore the want afterwards.
- **As DevOwner viewing as DevMember:** no I want this.

### PR A4 · S2a-4a·A4 — the Find proof

#### Task TA4 — e2e, axe, role gating, guest (`test-author`; the e2e are the deliverable, and an implementer runs only if one exposes a defect)

**Goal:** design §4 items 1–5 and 8, and criterion 7, end to end.

**Files:**
- Extend `frontend/e2e/progress.spec.ts` with a new `test.describe.serial('Progress: Find (S2a-4a)')`. It reuses `ownerSession`, the module-scope `seedFarm` and `setStates`, and `blockingIn`.
- Add new cases only to `e2e/role-gating.spec.ts` and `e2e/guest.spec.ts`.
- Seed Hub wants through the API, as the member session, and restore them in `afterAll`.
- **Release note:** add A4's item.

1. **Tests first:**
   - **Owner:**
     - The switch opens Find.
     - The wanted section comes first, and lists the member's shared want but not their private one.
     - Track it: the row opens and the member's cell is Want.
     - Track a farm focuses the search.
     - The custom row opens Edit with Title focused.
     - `?farm=catalog` opens Find.
     - `?pview=find&track=<id>` opens the row.
     - The footer names the wanted farm, and its Find link expands it.
     - Search, a filter and Clear filters work.
   - **Member:**
     - I want this on a private want shows the prompt. Cancel records no request, and Share makes it wanted.
     - No Track control anywhere.
   - **Viewer:** browses Find, with no action, no custom row and no Track a farm.
   - **Guest:** no `collection-catalog`, `collection-suggestions` or `collection-intent` request.
   - **axe:** both themes, at 1440 × 900, on Find with a row expanded and on Find with the Share prompt open.
   - **Fail-first:** run each case once against `main`, the stack's base, where Find doesn't exist (S-5), and record it failing for the right reason. It must then pass on A4's head.
2. **Gates:**
   - `pnpm -C frontend test:e2e e2e/progress.spec.ts e2e/role-gating.spec.ts e2e/guest.spec.ts`, against the worktree's servers (paste the counts);
   - plus the unit gates and `dupes`.

**Acceptance (browser):**
- **The walk:** as DevOwner, DevMember, a viewer and a guest. For the viewer, demote DevMember from an owner session and restore them afterwards.
- **Themes:** light and dark.
- **Shots:** in A4's body.

### PR B1 · S2a-4b·B1 — the TrackCard

#### Task TB1 — the state move, the shared columns, the card model, the pips, the card, Home's fetches (`test-author`, then `xivrp-implementer-deep`, because the card must agree with Progress)

**Goal:** D-11, D-12, E-8, E-9, E-10 and S-9; R-F-8, R-F-9 and R-F-10.

**Files:**
- **Create:**
  - `utils/progressState.ts` and `utils/progressState.test.ts`;
  - `utils/progressView.ts` and `utils/progressView.test.ts`;
  - `utils/trackCardModel.ts` and `utils/trackCardModel.test.ts`;
  - `home/FarmPips.tsx` and `home/FarmPips.test.tsx`;
  - `home/Home.trackCard.test.tsx`.
- **Rewrite:** `home/TrackCard.tsx` and `home/TrackCard.test.tsx`.
- **Modify:**
  - `utils/progressModel.ts` (the move only);
  - `progress/ProgressCell.tsx` (the import only);
  - `progress/ProgressPage.tsx` (`progressInputs` only);
  - `home/Home.tsx` (the props and the fetches).
- **Release note:** add B1's item.

1. **Tests first:**
   - **The move and the shared columns:**
     - Every existing progress test and `ProgressPage` test passes unedited after the move and the `progressInputs` switch. Run them before and after.
     - The `PIP_GLYPH` values are distinct and non-empty.
   - **The top farm:** `trackCardFor` picks the same goal as Progress's first active row for three farms, under `standard` and one other preset. Both use `progressInputs`, and a finished farm's members don't add columns.
   - **Tally and pips:**
     - "{n} of {m}" leaves out Pass and unclaimed columns.
     - The pips are the counted columns, in column order.
   - **The next line:**
     - Next is the queue's #1, and a Want-only queue still has a next.
     - `free_roll` gives no next.
     - A viewer reader gets no next and no counts.
     - A hidden count gives no bracket.
     - No token cost gives "(62)".
     - The model is null with no active farm.
   - **`FarmPips`:** its accessible name is grouped by state, and every pip has a glyph, so colour isn't the only signal.
   - **The card on Home:**
     - **When it hides:**
       - before `loadedGroupId` matches;
       - on a progress error;
       - for a guest, who also sends no request;
       - with no active farm.
     - **Behaviour:**
       - The title calls `onNavigate('goals', { track: id })`.
       - The old mount-farm card text is gone, but the mount-farm fetch is still called.
       - A static switch hides the card until the new static's data has loaded.
2. **Implement.**
3. **Gates:** as TA2.

**Acceptance (browser):**
- **As DevOwner on DEVTST:**
  - Seed two farms with different needs.
  - Home's card names the farm that Progress lists first.
  - Its next line matches the open row's #1.
  - The link opens that row.
- **As a viewer:** no next line.
- **Themes:** light and dark.

### PR B2 · S2a-4b·B2 — the split row and the proof

#### Task TB2 — the split row, then e2e for criterion 8 and the split row (`test-author`, then `xivrp-implementer`)

**Goal:** D-13 and E-11; R-F-11; design §4 items 6–8; criterion 8.

**Files:**
- **Modify:** `home/Home.tsx`.
- **Create:** `home/Home.splitRow.test.tsx`.
- **e2e:** a new `e2e/home-pointers.spec.ts`. It seeds through `helpers/owner.ts` and its own API calls, because `progress.spec.ts`'s helpers aren't exported, and exporting them would edit an existing spec's module.
- **Existing specs:** new cases only in `e2e/role-gating.spec.ts` and `e2e/guest.spec.ts`.
- **Release note:** add B2's item.

1. **Tests first:**
   - **Unit:**
     - With split clears on and the active tier, the row reads "Alts assigned 3/8 · 2 need attention". *(That shape can't come from the real helper: a member with no alt always warns, so n >= y - x. The reachable shape is 6/8 · 2, which is what the real-helper test pins; "3/8 · 2" is asserted only through a stubbed helper.)*
     - With n = 0, there's no " · …" part.
     - The row is hidden:
       - with split clears off;
       - on a past tier, which also makes no split-clear request;
       - when the result is for another static.
     - A viewer sees it.
     - "Open split plan" calls `onNavigate('goals', { track: 'tier' })`.
     - The existing attention rows keep their order and caps.
     - The empty copy shows only when nothing is listed, the split row included.
   - **e2e:**
     - **Criterion 8, as owner:**
       - Seed two farms.
       - Home's card names Progress's first farm row, read from the matrix.
       - The card's link opens it with `?track=<id>`.
       - The next line names the open row's #1.
       - Start from Find, go Home, then use the card's link: the row still opens (D-9).
     - **Split row:**
       - `withSplit(true)`: the row shows and opens the split plan (`?track=tier`, with the tier row expanded).
       - `withSplit(false)`: no row.
     - **Role gating:**
       - A viewer sees the card with no next line, and sees the split row.
       - A member sees both.
     - **Guest:** Home sends no `collection-goals`, `collection-participants` or `split-clear` request.
     - **axe:** Home with both pointers, in both themes.
     - **Fail-first:** run each e2e once against `main` (B1's parent) and record it failing. Each must then pass on B2's head.
2. **Implement.**
3. **Gates:** the unit gates, plus the e2e files (paste the counts).

**Acceptance (browser):** on DEVTST, in light and dark.
- As DevOwner, DevMember and a viewer, check Home with the card and the split row.
- Follow the card's link, then the split row's link.

---

## Finish (each PR)

- **Before the gates:**
  - Run `git fetch`, then renumber if `releaseNotes.ts` moved on `origin/main` (R-F-12).
  - Run the size check and the `pr-checklist` skill.
- **The gates** (slice-loop §5; paste the counts):
  - `pnpm -C frontend build`;
  - `lint` (0 errors, and no more warnings than the parent);
  - `check:design-system:strict`;
  - `test`;
  - `deadcode`, unchanged except the allowed delta;
  - `dupes`.
- **The allowed `deadcode` delta:**
  - A1 adds four exports that A2b and A3 consume: `buildFindList`, `topWanted`, `normalizeQuery` and `hasFilters`.
  - None after A3, and none in B1 or B2.
  - Record it in each PR body.
- **V1 intact:** none of R-F-13's paths appear in any diff.
- **Live check** (slice-loop §2):
  - The pages are `/group/DEVTST?shell=v2&tab=progress` and Home at `/group/DEVTST?shell=v2`.
  - Run `mkdir -p .logs` first.
  - Seed farms and wants through the API, then delete or restore them afterwards.
  - Save shots to `docs/redesign/pr-shots/s2a4-<pr>-*.webp`, in light and dark.
- **Opening the PR:**
  - Run `gh pr create --draft --base <parent>`, then fill the item's `pr`/`prTitle`.
  - **The body carries:**
    - the V1-reached files and the tests that pin them;
    - "no backend change";
    - the D-n, E-n and R-F-n rulings it implements;
    - the `deadcode` delta;
    - the residuals.

## Write-backs (once per stack, after it merges)

- [x] **S2a-4a**, one docs PR *(done 2026-11-03, after #423–#427 merged, main `c145e38f`; P-68 stays open, see the matrix)*:
  - the first half of the design's §9, into the parent spec;
  - the matrix:
    - P-09, P-13 and P-14;
    - P-52…P-77, each ended only where a test shows its affordance;
    - P-89's slice, and the Add Farm note;
    - P-96…P-103;
    - the §12.1 amendment;
  - §8's corrections;
  - `PRODUCT_MODEL.md` §6 and `HOME_STRETCH.md`'s W3 S2a row.
- [x] **S2a-4b**, one docs PR *(done 2026-11-03, after #430 and #431 merged, main `47501e99`; P-68 stays open, see the matrix)*:
  - the second half: S2-12 as built, P-104…P-107, and the D-67/D-68 markers;
  - the same two status docs;
  - the design note's corrections (D-11 link scope, §3.5, E-8, D-13 and §3.6).
- [ ] Update memory `project_home_stretch` (the controller's).

## Carried, not S2a-4

- **The Hub adopting `FindList`** (S2b) uses `renderAction`.
- **A server-side duplicate-track guard** (E-4): a 409 on `from-suggestion` when an open goal already holds the item. It's a backend change, so it gets its own small PR if the owner wants it.
- **Old-tracker wants** count as wanted until S2a-5b deletes that tracker (D-2).
- **Home-A's layout** (W4 HOME): where the card and the row finally sit.
- **Team Summary off Home** (HS-35 #10): not this slice.

## Carried from S2a-4a (residuals, 2026-11-03)

Found at write-back, against the code at `c145e38f`. None blocks S2a-4b. Homes are the holistic review (taste calls) or a small cleanup PR (defects).

- **`hooks/useTrackParam.ts`** is imported only by its own test now (`useProgressView` replaced it in `ProgressPage`): a candidate to delete, with `useTrackParam.test.tsx`.
- **P-68's patch line** isn't in Find's rows (`FindItem` has no `patch`), so that INTERIM row stays open: add it to the row body, or the owner signs it off (matrix §7).
- **`Tag tone="info"`** is under 4.5:1 in the light theme at 12px (`bg-status-info/10` with `text-status-info`; about 4.48:1 over white by calculation, not measured in a browser). It's token-level. Find doesn't use it (Tracking ✓ is `success`, Plugin ready the default tone), but `TeamSummaryCard`'s Alt chip, `HubIdentityHeader`'s "Shareable" chip and `JobsGearTab` do.
- **The toolbar is left-packed.** §3.1 puts the switch left and Track a farm and Edit statuses right; `ProgressToolbar` keeps one left-aligned wrapping row. The Find row has no type icon either (R-F-5 doesn't list one).
- **Find's Retry drops focus to `<body>` once its line goes**, as Tracks' does: no code restores focus after a Retry (read from `LoadFailure` and `FindList`, not run in a browser).
- **A warm-cache goals failure shows in Find but not Tracks.** Tracks' `goalsFailed` needs the goals not to be loaded for this static; Find's line (`findGoalsError`) shows whenever this mount's fetch failed.
- **A wanted row counts Interested as "wants"**: `wantedBy` includes `interested` members (D-2), so "2 want" can include members who only said "interested".
- **V1's orchestrion supplement** (`CatalogBrowse.tsx:70-80`, built-in orchestrion rolls added when the live catalog has none) isn't carried into All.
- **The Share prompt's text sits in the action slot**, not in the row's body line (§3.2).
- **No `landing.isConnected` guard** in `findActions.tsx`'s focus move: the microtask checks that the removed button is gone and that focus is on `<body>`, but not that the landing target (the row's toggle) is still mounted.

## Carried from S2a-4b (residuals, 2026-11-03)

Found at write-back, against the code at `47501e99`. None blocks S2a-5. Homes are the holistic review (taste and copy calls), a small cleanup PR (defects), or W4 HOME.

**Defects and races**
- **The card blinks on return to Home.** Home refetches the goals and the cells on every mount, and the card hides while `progressLoading` (`TrackCard.tsx:76`), so a warm store still hides it until the cells land.
- **`progressError` is shared.** A Finished fetch in flight when the member leaves Progress (`ProgressPage.tsx:288-300` calls the same `fetchProgress`) can fail after Home has mounted, and the card then hides until remount. The fix is a Home-held `{ groupId, error }` taken from Home's own fetch result, as `ProgressPage` holds `settled`.
- **A late old-static goals response overwrites the unkeyed store** (`fetchGoals` sets `loadedGroupId` with no staleness guard), so the new static's card stays hidden until remount. The card never shows the wrong static (`Home.trackCard.test.tsx` "never shows the old static when its goals land late"); it just doesn't recover.
- **A load failure on Home is silent.** The card hides, as D-11 says, with no line and no Retry. Progress shows both.
- **The `error` race in Home's split read.** Home reads the shared store's `error` after its `fetchData` resolves (`Home.tsx:251-254`), and another caller's `fetchData` can change it in between. `ProgressPage` has the mirror-image race: it reads `data === null` (`ProgressPage.tsx:501-502`). The fix is a keyed result from `splitClearStore` that both read.
- **The split row's render gate doesn't re-check `group.userRole`** (`Home.tsx:395`): the fetch does, but the row stays up after a mid-session role revoke until remount.

**Code and tests**
- **`CellPicker.tsx` keeps literal state labels** (`:57-60`, "Need", "★ Want", "✓ Have", "– Pass"). R-F-8's "grep finds no other copy" is false for them: they predate the move, and `STATE_TEXT` carries the same words.
- **`Home.test.tsx` reaches the real goal store (and split-clear store) and jsdom's `fetch`**, since Home's new effects call them and the file mocks neither. Its `mountData` seed (`:410`) no longer feeds anything that test asserts; it fed the retired card.
- **`Home.tsx`'s split-effect comment misdescribes the store** (`:244-246`): `fetchData` blanks `data` when a read starts (`splitClearStore.ts:54`), it doesn't leave the old one. `error` still decides, and the code is right.
- **The split row re-derives `mainRosterPlayers`** (`Home.tsx:397`, the same filter as the memo at `:264`).
- **`home-pointers.spec.ts`'s axe exclusion** (`withoutAccentSubtleDebt`) covers every `button.bg-accent/10` node's `color-contrast`, the whole `accent-subtle` variant. It could be pinned to the two known labels ("Add session", "Import BiS"), as `SPLIT_PLANNER_LIGHT_DEBT` (`helpers/owner.ts:66`) is. The debt is #394.
- **e2e seeding is written three times**: `seedFarm` in `home-pointers.spec.ts`, `withActiveFarm` in `role-gating.spec.ts` and `withFarm` in `guest.spec.ts`. A `helpers/home.ts` could serve all three.
- **A leftover split assignment row swaps the planner's empty state, even with every field reset** (`SplitClearPlanner.tsx:68`, `hasExistingAssignments`), so a test seed must leave zero rows, and there is no delete route. B2's walk left seven on DEVTST's local copy, and the preflight's first e2e run failed 7 and skipped 4 until they were deleted by hand.

**Copy and taste (holistic)**
- **All-Pass copy**: a top farm whose claimed columns are all on Pass reads "0 of 0 have it" with no pips (`FarmPips` returns null when empty). It agrees with the matrix row; a holistic call.
- **"1 need attention"**: the singular reads wrong. D-13's copy is verbatim, and legacy has the same grammar ("1 member need attention", `StaticHomeTab.tsx:1611`), so it is an owner copy ruling. **Ruled 2026-11-04 (O-2, #435):** "1 needs attention", V2 only.

**Not walked live**
- The empty copy with nothing listed, and a past tier (DEVTST has one tier). Unit tests pin both (`Home.splitRow.test.tsx` "keeps the empty copy on a past tier" and "on a past tier shows no row and makes no split-clear request").
