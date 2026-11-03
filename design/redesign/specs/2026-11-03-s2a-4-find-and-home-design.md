# Stage 2a · S2a-4, Find and Home's pointers (V2) — design

**Status:** drafted 2026-11-03 from the specs and the code, at `main` `8e871801`. The owner skipped the co-design Q&A. **Plan-vet, 2026-11-03:** `xivrp-director` PASS with fixes. Every finding (M-1…M-5, S-1…S-9, C-1…C-8) is folded in here and in the plan. **D-2, D-4, D-6, D-8 and D-10 changed.** D-1…D-14 are the controller's recommendations and wait for the owner. E-1…E-12 are the controller's engineering rulings. This note records only what S2a-4 adds; the rest is ruled in the parent spec, [`2026-09-30-s2a-progress-design.md`](2026-09-30-s2a-progress-design.md): S2-3 (the toolbar), S2-5 (row order), S2-11 (Find), S2-12 (Home's pointers), §4 (`?pview=find`), §7 criteria 7 and 8, R-S2-5, R-S2-7 and R-S2-17. The binding matrix rows are in the parity matrix, [`2026-09-30-s2a-parity-matrix.md`](2026-09-30-s2a-parity-matrix.md): P-09, P-14, P-52…P-77 (the interim rows), P-96…P-107. Where this note and the parent differ, this note wins for S2a-4, and the parent is corrected at write-back (§9).

## 1. Scope

**S2a-4a · Find.** The Progress toolbar gets a **Tracks ⇄ Find** switch, and leads get **Track a farm**. Find is one ranked list: search, filter tags, "Wanted by your static (n)" first, then "All farm sources (n)". Each row's action depends on role. A lead gets **Track**, which seeds statuses, plus a last row, **Track "{search}" as a custom farm**. A member gets **I want this**, which asks before sharing a private want. Anything already tracked shows **Tracking ✓**. Under the matrix, a footer line names the top wanted farm. When Find ships, P-52…P-77's interim rows end: V2 no longer needs the classic view to browse or track.

**S2a-4b · Home's pointers.** Home's **TrackCard** shows the static's top active farm (S2-12, 8A) and links to its Progress row. It replaces the old mount-farm card. A data-gated **Split clears** row in "Needs your attention" opens the split plan (`?track=tier`).

**Not in S2a-4:** the Hub adopting Find's list (S2b), the Objectives card and the retirements (S2a-5), Home-A's layout (W4 HOME), a server-side duplicate-track guard (E-4), phones (S2-15). Team Summary stays on Home, because HS-35 #10 isn't this slice.

## 2. Decisions

D-1…D-14 are the **controller's recommendations, awaiting the owner**. The decision is in bold; the last column holds the alternative and why not. E-1…E-12 are the controller's.

| # | Decision | Alternative, and why not |
|---|---|---|
| D-1 | **Two sub-slices, seven PRs, frontend only.** S2a-4a is a stack of five: A1 the Find model and store, A2 the URL, the switch and the toolbar, A2b the list, rows and filters (read-only), A3 the row actions, the custom track, Track a farm and the footer, A4 the proof. S2a-4b is a stack of two: B1 the TrackCard, B2 the split row and the proof. Each PR is one slice-loop run with one task. Each stack merges together after a preflight. 4a runs first, and 4b's branch is cut from a `main` that holds it. *(Plan-vet S-8: A2 was cut in two before building.)* | One slice: ~5,500 lines in one stack, and Home would wait on Find for no reason. |
| D-2 | **"Wanted by your static" is every item in the suggestions join with at least one member whose `intent` is `hunting` or `interested` and whose `ownership_state` isn't `have`.** That includes the old mount tracker's `wants_mount` when the member has no record (the join reports it as `hunting`, `collection_suggestion_service.py:384-387`), even when the tracker says they own it. That case is why `ownership_state` is checked: the seed puts a record Have first (`collection_goals.py:647-650`). The join already drops private wants at the query (`:265-270`). *(Plan-vet S-1.)* | Hub wants only: the old tracker's wants could be told apart through `reasons` ("Hunting (legacy)", `:110-112`), but they are the same members saying the same thing, static-scoped, and the tracker is deleted in S2a-5b. |
| D-3 | **A wanted item that is already tracked stays in the wanted section, after the untracked ones, and shows Tracking ✓.** Members can see their want was picked up. The footer only names an untracked item and is hidden when there isn't one. Order within each part follows the join's `suggested_farm_score`, then the name. With nothing wanted, the section is replaced by P-55's guidance line (§3.2). | Dropping tracked items: a member's want would vanish with no trace. |
| D-4 | **Find is for every member role. Viewers browse it read-only:** the switch, the list and the footer, with no row action, no custom row and no Track a farm. V1 viewers can browse Suggested and Catalog today (`GoalsPage.tsx:32` gates on membership only), and no matrix row retires that. Guests have no Progress at all. *(Plan-vet M-2; changed from "no Find for viewers".)* | No Find for viewers: a silent V1 loss with no signed row. |
| D-5 | **The switch is one control** (`SegmentedToggle`, "Tracks · Find"; its two buttons count as one, C-8). Leads at rest: the switch, Track a farm, Edit statuses, in that DOM order, so Tab from Edit statuses still reaches the tier row (`e2e/progress.spec.ts:327-329`). In edit mode: the switch, Track a farm, Mark Need, Done. That's four at most (R-S2-17). Members and viewers get only the switch. **Track a farm** opens Find with the search focused. Entering Find ends edit-statuses mode (C-4). | Track a farm as a menu item: S2-3 names it as a toolbar control. |
| D-6 | **"I want this" sets the member's Hub want to `hunting` (the Hub's Want).** It needs the member's own intents loaded (`myIntentsLoaded`). Until they are, the action is a busy placeholder, and on a failed load it's an error line with Retry, so it never writes blind (M-5a). Any existing intent row, whatever its intent (`pass` and `hidden` included), keeps its `priority` and `notes`, because the PUT is a full replace (`player_collection.py:126-132`). A private one first asks inline: "Your want is private. Share it with your statics?" with **Cancel** and **Share**. Focus goes to Cancel, and Share isn't placed where the trigger was, so a double press can't share (S-6). Share sets `static_only`. A `dossier_public` row keeps its visibility. With no row, the PUT is `static_only` and `priority: 'medium'`, with no prompt. A member whose shared want (`hunting` or `interested`) exists sees **Wanted ✓**, with no action. **Under View As, the action is absent:** `/me/collection-intent` ignores `X-View-As`, so it would write the admin's own want (M-5c; the R-S2-10 precedent). Fallback items get no I want this (their PUT 404s). Changing or removing a want stays on the Hub (S2b). After a write, suggestions are fetched again. | Silently flipping the visibility: B4 forbids it. |
| D-7 | **Track uses the seeding route** (`POST …/collection-goals/from-suggestion`, `status: 'farming'`) for a catalog item, wanted or not. It switches to Tracks, opens `?track=<id>` and toasts "Tracking {name}". There is no Undo: the row menu already deletes, and V1 has none either. The route sets the token name and cost (`collection_goals.py:583-584`). What's lost against V1's catalog Track is the linked duty and the note (`TrackFromCatalogModal.tsx:53-54`), which a lead sets in the row's Edit (P-77 accepts this; S-4). Fallback items (`fallback-…` ids, `curatedCatalog.ts`) get no Track button. They show "Offline list: retry to track" and a Retry when the catalog failed. | `createGoal` as V1's catalog Track does: no seeding, which criterion 7 requires. |
| D-8 | **The custom track is a lead's last row, always present.** With non-blank text in the search, it reads **Track "{search}" as a custom farm**. It creates a `custom_reward` farm (`status: 'farming'`, the trimmed raw search as the title, at most 200 characters), switches to Tracks and opens the row in Edit with Title focused. With the search empty or blank, it is a muted line, "Type a name to track a custom farm", and not a control. **This amends signed §12.1** ("the row stays, disabled", `parity-matrix.md:230`), so the owner signs it (S-4). | A disabled button, as §12.1 signed it: CLAUDE.md says a clickable thing must look clickable, and an inert one must not. |
| D-9 | **Switching to Find clears `?track` and closes any open row.** An open Edit with changes goes through the existing discard guard first. Switching back to Tracks doesn't restore the row. **A `?track` always wins:** arriving with both `?track` and `?pview=find` (a TrackCard link under "remember" tab memory, `useGroupViewState.ts:327-340`) shows Tracks with the row open and drops `pview` in the same write (M-4). | Keeping the row open behind Find: hidden state. |
| D-10 | **Find's rows are ~56 px and collapsed by default, and carry every signed P-row affordance.** Each row shows the name, type and source duty, the exchange (token) when there is one (P-75), the plugin-ready tag (P-71), "{n} wants" or "{n} want" when wanted, and the action. **Tracking ✓** is a `Tag variant="nav"` that opens `?track=<id>` (P-60). Expanding a row lists every member's state with B1-gated counts, as V1's Suggested card does (P-58), plus the source details. The names come from the roster (`memberNames`, `ProgressPage.tsx:287-295`), never the join's Discord name (S-2). The collapsed body is `inert`. Search matches name, duty, expansion and token name (`collectionSourceGrouping.ts:108-112`), with a Clear button (P-65). The filter tags are V1's three dimensions, Category, Source and Expansion (`CatalogBrowse.tsx:37-59`, P-64), one of each selectable, plus **Clear filters** (P-66). Counts are per item row (C-2). | One flat table: S2-11 names the row and the sections. Dropping signed affordances: a false "ended" on P-52…P-77 (plan-vet M-1). |
| D-11 | **TrackCard:** "{farm} · {type}" as a `LinkText` to `?tab=progress&track=<id>`, then "{n} of {m} have it", then one pip per counted column. Those are claimed columns not on Pass, in Progress's column order (built from active goals only, as Progress builds them, through one shared helper, S-9). Each pip has a role colour, a pip glyph distinct for every state, Need and no-status included (S-7), and an accessible name, so the pips agree with m. Next comes **"{name} is next (62/99)"**, or "(62)" with no token cost, or no bracket when the count is hidden. A top entry that is a Want still reads "is next". Under `free_roll` there is no next line. A viewer sees the tally and the pips (the matrix shows states to viewers) but never a next line or a count (B1). The card is hidden while loading, on a failed fetch, with no active farm, and for guests. It agrees with Progress because it calls `splitFarmRows` and `queueFor` with the same sort preset. | The whole card as one link: a nested target, and the old card was deliberately not clickable. |
| D-12 | **The old mount-farm TrackCard is retired.** That's its body (`home/TrackCard.tsx:21-53`), not the mount-farm fetch, which `StaticActivityFeed` still reads until W4 HOME. | Keeping both: two "track" cards. |
| D-13 | **Split clears row:** an `AttentionItem` titled "Split clears", with meta "Alts assigned {x}/{y}", plus " · {n} need attention" when n > 0. The action is **Open split plan** → `?tab=progress&track=tier`. It shows (and Home fetches split-clear data at all) only when split clears are on for the static and Home is showing the active tier (the split plan exists only there, `ProgressPage.tsx:348-397`). Every member role sees it, viewers included, since Progress opens the split plan for them (P-107). It goes after the existing attention rows and is not subject to their per-kind cap of 3. While it shows, the list isn't empty, so the empty copy stays as written. | Showing it only with issues: legacy always showed the card when enabled, and P-107 carries x/y. |
| D-14 | **No V1 delta.** Every edit is in the V2 shell or additive in shared stores (delta (e)). V1's GoalsPage, its catalog Track and its Suggested tab stay byte-for-byte. Every release note is internal (E-12). | — |
| E-1 | **The URL:** `pview` (`tracks` \| `find`, default `tracks`, omitted) is added to `SEEDED_TAB_PARAMS` (`hooks/useUrlTabState.ts:31-38`). V1 never writes it, and `clearRegisteredTabParams` only deletes it (`:55-60`). **Every view change is one write:** `useProgressView()` returns `setProgressView({ pview, track, edit })`, which sets every param it is given in a single `setSearchParams` callback. React Router 7 builds from the render-time params, so two setters in one handler clobber each other (R-D11-B, `Loot.tsx:455-470,894-899`; plan-vet M-3). It's held in a latest-setter ref for writes after an `await`. `editControls.start` and `useTrackParam` go through it. `?farm=suggested\|catalog` (P-09) maps to `pview=find` inside `ProgressPage` only, removing `farm` in the same write, so `useGroupViewState` (shared with V1) is untouched. | |
| E-2 | **The model is pure, in `utils/findModel.ts`** (non-ring, R-S2-5, so S2b's Hub can import it): `buildFindList(catalog, suggestions, goals, query, filters)` → `{ wanted: FindItem[]; all: FindItem[]; counts }`; `FindItem { item, wantedBy: string[] (user ids), tracking: goalId \| null, trackable }`; `topWanted(list)`; `findSearch` normalization (trim, lower case, 200-char cap). "Tracking" means an open goal (not complete) with that `catalogItemId` in this static. | |
| E-3 | **The list is presentational:** `progress/FindList.tsx` takes the model's output and `renderAction(item) => ReactNode`. `ProgressPage` injects a lead's or a member's action, and S2b's Hub will inject its own. Its rows are `progress/FindRow.tsx`. | |
| E-4 | **No server duplicate guard.** "Tracking ✓" comes from the client's goal list, so two leads tracking at the same moment can make a duplicate, as V1 can today. The second lead's list refreshes on the next fetch. Disclosed (§7). | |
| E-5 | **The store:** `collectionIntentStore` gains `suggestionsError[groupId]`, set on failure and cleared on success (additive, delta (e)). Find shows an inline error with **Retry** instead of an empty list. `fetchCatalog`'s existing error state drives the fallback (P-67). | |
| E-6 | **Data loading:** Find fetches the catalog and suggestions when it first opens. When the reader is a member and not under View As, it also fetches their own intents (`fetchMyIntents`). The footer fetches suggestions once per static for every member role. Nothing loads for guests. | |
| E-7 | **The toolbar:** `progress/ProgressToolbar.tsx` (testid `progress-view-bar`) holds the switch, Track a farm and `EditStatusesBar`. `EditStatusesBar` is unchanged and keeps its own testid `progress-toolbar`. So the existing "members get no toolbar" assertions (`ProgressPage.editStatuses.test.tsx:150-160`, `e2e/role-gating.spec.ts:349`) still hold, unedited (S-3). The toolbar renders for every member role, even with no active farm. | |
| E-8 | **Home's data:** Home fetches `fetchGoals` and `fetchProgress` (as `ProgressPage.tsx:160-223` does, gated on `loadedGroupId === group.id`) and the split-clear data, all in its existing branch for members with a real role (`Home.tsx:140-194`), so a guest sends no new request. The split-clear result is held per static in Home (the store is unkeyed and shared with Progress, `splitClearStore.ts:53-58`), as `ProgressPage`'s `SplitResult` is. | |
| E-9 | **The reader under View As** is `effectiveRole` and `effectiveUserId` (`Home.tsx:128-130`); `cellFor` already hides counts and ranks for a viewer reader. The "no next for viewers" rule is the card's, as D-20's is `QueueList`'s. | |
| E-10 | **Rings:** `home/` is ring 0 and can't import `progress/` (`eslint.config.js:54-56,133-135`). The state glyph and tone tables move to `utils/progressState.ts`: `STATE_TEXT` is exported from there, and `ProgressCell`'s tone map moves without changing any class string. `home/FarmPips.tsx` renders the pips. `progress/` keeps importing the same values through the new module. | |
| E-11 | **The split row's numbers** come from `getSplitClearReadiness(players, data.assignments)` (`utils/splitClear.ts:54`), with legacy's filter: configured players who aren't substitutes (`StaticHomeTab.tsx:1591-1626`). | |
| E-12 | **Release notes:** every PR is internal. The V2 preview is admin-gated, so no V1 user sees a change, and `CURRENT_VERSION` doesn't move for an internal-only release (`internal: true` on the release object as well). | |

## 3. Design

### 3.1 The toolbar and the switch (A2)

`ProgressToolbar` is one row.
- **Left:** the switch, for every member role.
- **Right, for leads:**
  - **Track a farm** (`Button variant="secondary" size="sm"`, `leftIcon` `Plus`). It's `secondary` because ghost's accent text fails light contrast on `bg-surface-elevated` (S2a-3c).
  - then `EditStatusesBar` (shown with an active farm, as today).

With `pview=find`, Find replaces the matrix region and `PageHeader` stays. Edit statuses is hidden in Find, because it edits the matrix.

### 3.2 Find (A2b read-only, A3 actions)

- **Head:**
  - a search `Input` (label "Search farms", `maxLength` 200) with a Clear `IconButton` while it has text (P-65);
  - three labelled filter groups of `Tag variant="filter"`: Category, Source and Expansion (P-64). Each group allows one selection and "All";
  - **Clear filters** while any is set (P-66).
- **Sections:** `<section aria-labelledby>`, first "Wanted by your static ({n})", then "All farm sources ({n})".
  - The second lists every catalog item that matches, wanted ones included, so search finds anything.
  - The counts follow the search and filters.
  - With nothing wanted (before any search or filter), the wanted section shows P-55's guidance line in place of rows: "Nobody in your static has shared a want yet. Members add wants from Find or their Hub."
  - With a search or filter set and no wanted match, the section isn't rendered.
- **Row:**
  - an expand toggle (`IconButton`, `aria-expanded`), the type icon (`GOAL_TYPE_ICONS`), the name, and "{type} · {duty}";
  - the exchange (P-75), the plugin-ready tag (P-71), and "{n} wants" / "{n} want" when wanted;
  - the action on the right.
  - **The expanded body** lists every member's state with B1-gated counts (P-58), roster names, plus the source (expansion, duty, source type). It is `inert` and hidden while collapsed.
- **Actions** (A3), all through `renderAction`:
  - **Track** (`secondary`) for leads, on a trackable untracked item.
  - **Tracking ✓** (`Tag variant="nav"`) for a tracked item, opening `?track=<id>` (P-60). Every role sees it, viewers included.
  - **I want this** for members (not under View As, D-6). While the Share prompt is open, it shows in the row's body line, with Cancel where the trigger was.
  - **Wanted ✓** (label) for a member who already has a shared want.
  - Viewers get no action except Tracking ✓.
- **The custom row** (D-8) is last for leads, after both sections.
- **Busy:** an action being written is `aria-disabled` with `BUSY_CLASS`, one write at a time per row. A failure toasts `Couldn't track {name}: …` or `Couldn't save your want: …`, unless `wasToastedByApi`.

### 3.3 After Track (A3)

**Track:**
1. `createGoalFromSuggestion(groupId, { catalogItemId, status: 'farming' })`.
2. `refreshGoalProgress(groupId, goal.id, { lists: true })`.
3. One `setProgressView({ pview: 'tracks', track: goal.id })`.
4. Focus the row.

**The custom track:**
1. `createGoal(groupId, { goalType: 'custom_reward', title, status: 'farming' })`.
2. One `setProgressView({ pview: 'tracks', track: goal.id, edit: goal.id })`, through `editControls.start`'s single-write form.
3. That focuses Title (`farmEditTitleId`).

A unit test checks the final URL of each.

### 3.4 The footer line (A3)

Under the matrix, for every member role, while some wanted item is untracked: "{names} want {farm} · Find" ("wants" for one).
- It names up to two members, then "and {k} more".
- Find is a `LinkText` with the accessible name "Find {farm}". It opens Find with that item expanded and focuses that row's toggle.
- Names come from `memberNames`, and someone with no name there is "A member".

### 3.5 TrackCard (B1)

The card replaces the old one in Home's right column (`Home.tsx:465-466`), and takes `group`, `tier`, the reader and `onNavigate`. Its model is `utils/trackCardModel.ts` (pure): `trackCardFor(data, columns, reader, mode)` → `{ goal, typeLabel, tally, pips, next } | null`, built on `splitFarmRows(...).active[0]` and `queueFor`. The sort preset comes from `useRosterSortPreset`, as Progress gets it (`ProgressPage.tsx:258-268`). The link is `onNavigate('goals', { track: goal.id })`.

### 3.6 The split row (B2)

Home's `attentionItems` gains the D-13 item, with an action `Button` that calls `onNavigate('goals', { track: 'tier' })`.

### 3.7 Who sees what

| Reader | Switch, Find, footer | Track, custom row, Track a farm | I want this | TrackCard | Split row |
|---|---|---|---|---|---|
| Owner, lead, admin | yes | yes | no | full | when on |
| Member | yes | no | yes | full | when on |
| Viewer | yes, read-only (D-4) | no | no | tally and pips, no next | when on |
| Guest | no Progress | — | — | hidden | hidden |
| View As | the viewed role's; writes go as the admin | as the viewed role | **absent** (D-6) | the viewed role's | the viewed role's |

### 3.8 Edge cases

| Case | Behaviour |
|---|---|
| Catalog failed | The fallback list, with no Track on fallback items, plus Retry (D-7, P-67) |
| Suggestions failed | Wanted section: inline error with Retry; All farm sources still lists the catalog |
| Search with no match | "No farms match "{q}"", followed by the custom row for leads |
| The item is tracked in another static | Not tracked here: Track shows |
| The farm is finished in this static | Not open, so Track shows (a new goal); its Reopen stays in Finished farms |
| A member's want is private | The Share prompt; Cancel leaves it private and writes nothing |
| Track double click | One request |
| The member's intents failed to load | I want this is an error line with Retry; nothing is written (D-6) |
| Existing `pass` or `hidden` intent | I want this keeps its priority and notes; a private one asks first |
| Find, then Home, then the TrackCard link | `?track` wins: Tracks with the row open, `pview` dropped (D-9) |
| Edit-statuses mode, then Find | The mode ends |
| No farm is active | TrackCard hidden; Find still works |
| Top farm under `free_roll` | Tally and pips, no next line |
| Past tier on Home | No split row; TrackCard still shows the static's farms (they aren't per-tier) |
| Static switch on Home | Results keyed by static, so the old static's card and row never show |

### 3.9 Keyboard and a11y

Search, filter tags, each row's toggle, then its action, in DOM order. No roving grid in Find. The expanded body is out of the tab order while `inert`. The pips are one `role="img"` with an accessible name such as "Need: Caster One, Melee One; Have: …". axe gives 0 critical and 0 serious in both themes at 1440 × 900, in three states: Find with a row expanded, Find with the Share prompt open, and Home with both pointers.

## 4. Acceptance

Shown on the running app, light and dark:
1. A lead opens Find from the switch and from Track a farm. The wanted section is first and has no private want. Tracking a wanted item seeds its statuses from wants and records, and opens its row.
2. A lead tracks "Foo" as a custom farm, and its row opens in Edit with Title focused.
3. A member with a private want presses I want this, sees the Share prompt, Cancel writes nothing, and Share makes it wanted (the section updates). A shared want reads Wanted ✓.
4. A viewer browses Find read-only: no Track, no I want this, no custom row, no Track a farm.
5. `?farm=catalog` opens Find. `?pview=find&track=<id>` opens the row in Tracks.
6. Home's TrackCard and Progress's first farm row name the same farm, and the link opens that row. The next line matches the open row's #1. A viewer sees no next line (criterion 8).
7. With split clears on, the Split clears row shows "Alts assigned x/y" and opens the split plan. With them off, there's no row.
8. axe is clean in both themes, and guests send no new request.

## 5. Slicing

| PR | Contents |
|---|---|
| A1 | `utils/findModel.ts` and its tests, the store's `suggestionsError` |
| A2 | `pview`, `useProgressView`'s single write, the `?farm` map, `?track` wins, `ProgressToolbar`, the switch (Find renders a placeholder region) |
| A2b | `FindList`/`FindRow` read-only, with search, Clear, three filter groups, Clear filters, P-55/58/60/71/75 |
| A3 | Track, I want this with the Share prompt, Tracking ✓ / Wanted ✓, the custom row, Track a farm, the footer |
| A4 | e2e and axe for Find, role gating, guest |
| B1 | `utils/progressState.ts` (the move), `utils/trackCardModel.ts`, `home/FarmPips.tsx`, the new TrackCard, Home's fetches |
| B2 | the split row, then the e2e for criterion 8, the split row, role gating and guest |

## 6. Matrix coverage

The parity matrix's S2a-4 rows (30) are written in at write-back:
- **P-52…P-77:** the RE-HOMED INTERIM rows get "ended 2026-11-xx (S2a-4)" and the Find control that replaced each one. Each row is ended only when A4's e2e or A2b's or A3's unit tests show its affordance. D-10 lists the ones the first draft missed.
- **§12.1:** D-8's amendment (a muted line, not a disabled row), once the owner signs it.
- **P-13:** the "Find's half is INTERIM" note ends (`parity-matrix.md:40`).
- **P-09:** `?farm` → Find ships.
- **P-96…P-103:** as the matrix rules.
- **P-104:** the TrackCard ships (D-67 marker). **P-105:** the O-39 empty state, as ruled. **P-106** and **P-107:** ship (D-68 marker).
- **P-89's slice** is corrected from S2a-5a to S2a-4, since the spec's §6 and S2-3 place Track a farm in S2a-4. Settings' Add Farm stays in V2 until S2a-5a (`parity-matrix.md:150`).

## 7. Residuals (disclosed)

- Two leads tracking the same item at the same moment can create a duplicate (E-4), as V1 can.
- The old mount tracker's wants count as wanted (D-2) until S2a-5b deletes that tracker.
- A farm tracked from Find has no duty or note until a lead sets them in Edit (D-7, P-77).
- The split row's x/y is always the active tier's (the GET returns active-tier assignments), so it's hidden on a past tier (D-13).
- Phones: Find's list is one column and the matrix scrolls sideways (S2-15).

## 8. Spec facts corrected

- The parent's seed cite `collection_goals.py:406-409` is now `:647-673`, and V1 delta (g) (the blank seed for no signal) has already shipped (`:672-673`, S2a-1a).
- The matrix's `:263-440` (now `:527-701`), §12.1's `:205-217` (now `:469-511`) and `CollectionsHub.tsx:184-187` (now `:158-161`) are stale.
- P-89 puts "Track a farm" in S2a-5a. The spec's §6 and S2-3 put it in S2a-4, and the spec wins.

## 9. Write-back (after each stack merges)

After S2a-4a merges:
- The parent spec: S2-11 as built (D-2…D-10), §6 records the PRs, §7 marks criterion 7 shipped.
- The matrix: §6's rows and the interim end date (`:288`).
- `PRODUCT_MODEL` §6 and `HOME_STRETCH`'s W3 S2a row.

After S2a-4b merges:
- The parent spec: S2-12 as built (D-11…D-13), §7 marks criterion 8 shipped.
- The matrix: P-104…P-107.
- The same two status docs.
- §8's corrections land in the first write-back.
