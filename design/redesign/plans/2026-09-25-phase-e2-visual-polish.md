# Phase E · E2 — Visual polish (impeccable-assisted)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** E2 ships the visual half of Phase E (`ROLLOUT_ROADMAP.md` §7, "E — Polish"): the impeccable detector pass over the four V2 screens, the user's 2026-09-25 design calls from the design canvas, the carried #5 and #36, and four small V2 loot/board defects the user pulled forward from the holistic list. It:
- fixes the next-session card (#36 glyph adjacency, a duplicated time line) and gives every V2 tab a heading outline with no skipped level;
- makes the roster card header one line in every state and stops the job badge covering the avatar initials (#5); makes the Board's BiS summary number and color use one total (#7);
- puts Home's two rows on one column grid, gives Home one stat idiom and fixes two stat labels; ships three V1-authorized fixes (the 12 px floor on the tier badge, light-theme muted-text contrast, Static Finder left-align);
- keeps the loot Adjustments modal open on a partial failure (#13), lets substitutes get adjustments (#14), explains a search-hidden recipient (#12), and offers the gear revert when deleting a Book entry.

**Architecture:**
- **Task 1:** class and markup edits in `SessionRsvpCard`, a `level` prop on `CardShell` (default `h2`), two heading-level bumps.
- **Task 2 (riskiest):** RosterCard's header row becomes non-wrapping with an explicit shrink order; `PlayerIdentity`'s job badge moves outside the avatar; one per-player BiS-progress helper shared by RosterCard and GearBoard.
- **Task 3:** Home renders both rows in one grid; a new `ui/StatCell` is the one stat idiom (RosterReadinessCard + FairnessSummary); copy edits; one class change in `TierSelector` and `Discover`; one token value regenerated.
- **Task 4:** error propagation in `Loot.handleSaveAdjustments`, a substitutes group in `LootAdjustmentsModal`, a hint branch in `RecipientPicker`, a widened gate in `DeleteLootConfirmModal`.

**Tech stack:** React 19 · TypeScript · Zustand 5 · Vitest + Testing Library · ESLint 9 (jsx-a11y `error` in `primitives/` and `ui/`) · design tokens via `pnpm tokens:build` (CI: `tokens:check`).

**Spec (binding):**
- `design/redesign/ROLLOUT_ROADMAP.md` §7, "E — Polish" (E2 bullet + "Carried out of E1": #5, #36).
- The user's rulings U-7…U-14 below (2026-09-25), made on the design canvas `claude.ai/artifact/G5bWkMadnjCmSiUbZ8YMVb` (Decisions page: before/after mockups for #36, #5, the V1 fixes and the Home levers).
- `CLAUDE.md` § UI rules (binding for every change) and `design/redesign/DESIGN_SYSTEM.md`.

**How impeccable was used (local-only, git-excluded per the user):** `impeccable` 4.1.0, no hook. `init` wrote a local `PRODUCT.md` inherited from `docs/PRODUCT_MODEL.md`; `document` wrote a local `DESIGN.md` transcribed from `DESIGN_SYSTEM.md` + `index.css` (it surfaced the five doc drifts U-11 reconciles). `detect` ran on rendered-DOM snapshots of Home/Roster/Loot/Schedule (dark + light, 1440 and 2560); every finding was traced to source and classified (below). The canvas carries the 47-shot map of every V2 page, tab and tool.

**Plan-vet:** `xivrp-director`, 2026-09-25: **READY-WITH-FOLDS** — 0 Blockers, 6 Majors, 10 minors, all folded in place: M1 R-E2-F keeps the no-BiS gate (the subs premise was wrong); M2 R-E2-G keeps StaticActivityFeed, `minmax(0,…)` tracks, top-row stretch; M3 StatCell's single value color + `detail: ReactNode`; M4 Task 1's real `level: 4` queries; M5 R-E2-D's 1024/1400 px widths + name-edit state; M6 R-E2-M's copy and always-mounted status. Minors folded into R-E2-A/C/E/H/J/K/N/O and the write-back list. V1 reachability confirmed; Task 2 confirmed riskiest.

## Detector baseline and what E2 does with each rule

| Rule (count/screen) | Source | Verdict | E2 |
|---|---|---|---|
| `undersized-ui-text` (1 everywhere) | `static-group/TierSelector.tsx:76,94,116` `text-[10px]` "Current" | Real (CLAUDE.md 12 px floor); **V1-shared** | Task 3 (U-9) |
| `skipped-heading` (1 everywhere) | `layout/PageHeader.tsx:38` h1 → `ui/CardShell.tsx:56` h3 / `roster/RosterCards.tsx:319` h3 | Real; V2-only | Task 1 |
| `low-contrast` light, `#6b6b7e` on raised/elevated/interactive (3.83–4.47:1) | `frontend/tokens/tokens.light.json:28` → `tokens.generated.css:151` | Real (AA); **V1-shared token** | Task 3 (U-9) |
| `nested-cards` (Home 8 real) | `loot/FairnessSummary.tsx:19-29` bordered `StatCard` tiles inside a CardShell | Real | Task 3 (U-10) |
| `nested-cards` (2 everywhere), Loot h3 "Navigation" | the closed settings dock (`RightDockPanel`, `aria-hidden`+`inert`) | Artifact | — |
| `low-contrast` "analytic-gradient+alpha" | PageHeader/CardShell text over the ambient wash | Artifact (flat surfaces, > 8:1) | — |
| `ai-color-palette`, `dark-glow`, `radial-spotlight-glow`, `overused-font` | the teal accent, `.highlight-pulse` family, `GroupViewContent.tsx:717-718` wash, Inter | System choice | wash documented at write-back (U-11) |
| `side-tab` (Loot) | `loot/floorClasses.ts:22-31` floor accent | System choice (R-8) | — |
| `line-length`, `layout-transition`, `clipped-overflow-container`, `gpt-thin-border-wide-shadow`, `cramped-padding` | PageHeader subtitle, `.progress-fill`, the shell's skip link, Tooltip, RSVP badges | Artifact or declined (big reach, no user value) | — |

## User rulings (2026-09-25)

- **U-7 (#36):** the RSVP status glyph sits right after the name; no `ml-auto`.
- **U-8 (#5):** the roster card header is one line — tank role + position chips + job swap sit inline after the name; the job badge moves outside the avatar so both initials show.
- **U-9 (V1 authorized):** TierSelector "Current" badge 10 → 12 px; light `--color-text-muted` `#6b6b7e` → `#606073`; Static Finder left-aligned (drop `mx-auto`), both shells.
- **U-10 (Home):** one column grid for both rows; Loot Fairness adopts Roster Readiness's divider-stat idiom; "% BiS" → "At full BiS"; Most / fewest splits into two labelled lines.
- **U-11 (docs):** `DESIGN_SYSTEM.md` is reconciled to the code on five drifts (card radius 8 px, Tag = pill, filter-off state, Input surface, the two "standard" easings) and records the ambient teal wash as intentional. Controller write-back, not a task.
- **U-12:** holistic #13, #7, #12 and the Book-delete revert ship in E2; #3 → the Player Hub brainstorm; #8, #32 → Phase F; #20, #22 → their own slices; #34 deferred.
- **U-13 (#14):** substitutes get loot adjustments, in their own group in the modal.
- **U-14:** the Player Hub brainstorm (Stage 3, B2) runs alongside E2 — not in this plan.

## Rulings (bind every task)

- **R-E2-A (headings):** `CardShell` takes `level?: 'h2' | 'h3'`, **default `'h2'`** — every current caller that passes a title sits directly under the page `<h1>` (`home/*`, `loot/BookLedgerCard`, `roster/{OpenSeatCard,RosterCard,RosterCards}`, `schedule/{AvailabilityHeatmap,BestTimesCard,PersonLayerEntryPoint}`, `ui/SessionRsvpCard`, `pages/ShellContentStates`); untitled CardShells render no heading. `SessionRsvpCard`'s inner session-title `<h4>` (`:367`) becomes `<h3>`. `RosterCards.tsx:319` group label `<h3>` → `<h2>`. **Out of scope (V1-shared, frozen):** `schedule/AvailabilityGrid.tsx:531` and `TemplateRecommendations.tsx:48` (also imported by legacy `ScheduleTab`; on V2 only inside a modal), `loot/LootPriorityPanel.tsx:509` (V1). Parked as a residual.
- **R-E2-B (tz line):** `session-tz-line` renders **only** when the viewer's zone differs from the session's, and reads `your time {viewerTime}` — the session time is already in the headline (`session-daytime`; both print `sessionTime` today, `SessionRsvpCard.tsx:336,339`).
- **R-E2-C (#36):** in the member grid `<li>` (`SessionRsvpCard.tsx:389-404`) the glyph already follows `PlayerIdentity` in DOM order (`:403-406`); it drops `ml-auto` so it sits right after the name; the identity wrapper can shrink (`min-w-0`, name truncates), the glyph is `shrink-0`. The sr-only status label is unchanged. Proof = the class change pinned in a test + the 2560 px shot.
- **R-E2-D (#5 header):** `RosterCard.tsx:786-787`'s header row stops wrapping. Shrink order: the name truncates first, chips and the job-swap `IconButton` never shrink or wrap. The name wrapper's `title` becomes `${name} — double-click to rename` (today it is only "Double-click to rename", `:803`), and the full name stays in the accessible name. Holds in every header state — tank (TankRoleSelector + PositionSelector), SUB tag, weapon-priority `+N` tag, the name-edit state (Input `w-40`, `:797`), Compact and Expanded — at the Cards grid's narrowest columns: **1024 px (3 columns) and 1400 px (4 columns)** plus 1440 px (`RosterCards.tsx:92`, `index.css:539-542`). If a state genuinely cannot fit one line there, the implementer stops and reports (NEEDS_CONTEXT) rather than inventing a second row.
- **R-E2-E (job badge):** `PlayerIdentity.tsx:169-179`'s badge sits on the avatar's outer edge (outside the ring's bounds) with a card-surface ring, so no initial is covered; widen the avatar-to-name gap (`:149`, `gap-2`) enough that the moved badge never overlaps the name. Scope: RosterCard and the RosterCards drag overlay (`RosterCards.tsx:248`) — GearBoard's `board-cell` identity (`GearBoard.tsx:242`) has no avatar or badge. `rsvp-row` has no badge — untouched.
- **R-E2-F (#7):** one per-player helper — `playerBisProgress(player) → { completed, total }` using RosterCard's definition (`relevantGear(player.job, player.gear)`, `isSlotComplete`, `total = relevant.length || 11`, `RosterCard.tsx:551-554`) — in `utils/` (next to `rosterReadiness.ts`). RosterCard and GearBoard both call it. In GearBoard the helper sets **only the displayed number and `summaryColor`** (`GearBoard.tsx:112,285-290`). **The "No BiS imported" row (`:244`), the `—` cell and `interactive` (`:128`) keep their `bisSlotTotals(...).total === 0` gate** (`:103-104,126`) — that row is contracted in `DESIGN_SYSTEM.md:426` and pinned at `GearBoard.test.tsx:90,313`, which stay unchanged; the "no BiS" semantics are #8, Phase F (U-12). (Director M1: substitutes already get real numbers — `GearBoard.tsx:104` passes `isSubstitute: false` — so a sub test is a pin only, not a fix.) `bisSlotTotals` itself is unchanged.
- **R-E2-G (Home grid):** `Home.tsx:333-390` renders both rows in **one** grid: `grid grid-cols-1 gap-4 min-[1181px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,1fr)]` — `minmax(0,…)` so TeamSummaryCard's table (`TeamSummaryCard.tsx:297-305`) cannot widen a track (the reason `TwoRegionDashboard.tsx:24` uses it). The top row's three cards keep stretching to equal height (**no** grid-level `items-start`). Row 2: the main stack (Needs attention, RoleBisCard, TeamSummaryCard) spans two columns (`min-[1181px]:col-span-2`); the side stack is column 3 — **Loot fairness, StaticActivityFeed, TrackCard, order unchanged** (`Home.tsx:372-385`); `self-start` on the two row-2 stacks only. Home stops importing `TwoRegionDashboard`; Schedule keeps it (`Schedule.tsx:19,420`, unchanged). Below 1181 px the single-column order is unchanged.
- **R-E2-H (one stat idiom):** new `components/ui/StatCell.tsx` — `{ value, label, detail?: ReactNode, valueClassName?, align?: 'center' | 'start' }`, markup = RosterReadinessCard's `Stat` (`RosterReadinessCard.tsx:28-35`: value `text-lg font-display font-bold tabular-nums`, label `text-xs uppercase tracking-wide text-text-tertiary`) plus an optional `detail` block (`text-xs text-text-tertiary`). **`text-text-primary` is applied only when no `valueClassName` is passed** (no tailwind-merge in the repo; two color classes would resolve by CSS order). RosterReadinessCard's local `Stat` is replaced by it (centered, `divide-x` row unchanged). FairnessSummary's `StatCard` tiles are replaced by `StatCell` (`align="start"`) in a 2×2 grid whose dividers are drawn as cell borders (`border-border-subtle`: right border on column 1, bottom border on row 1), with no per-cell border radius or background. **Empty roster:** the two remaining stats (Drops this tier, This week) sit side by side and the one-line message spans both columns — no empty grid cell (closes the carried "empty grid cell at ≥ sm", `ROLLOUT_ROADMAP.md:330-331`). FairnessSummary renders only on Home (`FairnessSummary.tsx:5-7`; `Loot.tsx:114`).
- **R-E2-I (labels):** RosterReadinessCard `"% BiS"` → `"At full BiS"` (the value is the share of raiders whose BiS is complete). FairnessSummary Most / fewest detail becomes two lines — `Most: {names}` and `Fewest: {names}` (names joined with `, `; the counts stay in the value `2 / 1`).
- **R-E2-J (V1-authorized, U-9):** (1) `TierSelector.tsx:76,94,116` `text-[10px]` → `text-xs` (nothing else in those spans changes). (2) `frontend/tokens/tokens.light.json:28` `#6b6b7e` → `#606073`, then `pnpm tokens:build` so `tokens.generated.css` matches (CI `tokens:check`, `.github/workflows/ci.yml:59`). **Leave `tokens:parity` and its baseline alone** — it is not in CI and already fails on `main` (10 values, untouched since #155); it is not a gate. In the `e2e/contrast.spec.ts:27-28` residual comment, recompute the stated blended color and ratio (today `#9292a1`, 2.62:1) for the new value, not just the hex. The mockup mirror under `design/redesign/mockups/theme/` is historical — leave it. (3) `pages/Discover.tsx:357` drop `mx-auto` (keep `max-w-[160rem] w-full px-4 py-6 sm:py-8`).
- **R-E2-K (#13):** match legacy `priority/PlayerAdjustmentsModal.tsx:60-81`: `Loot.handleSaveAdjustments` (`Loot.tsx:806-819`, sole caller `:1633`) keeps `Promise.allSettled`, and when any update failed it **throws instead of toasting** — an `Error` whose message names the count (`Failed to update N player(s)`). `LootAdjustmentsModal.handleSave` (`:108-131`) keeps the modal open on a rejection and toasts **`err.message`** (as `RosterCard.tsx:545` does) — exactly one error toast per failed save; update `LootAdjustmentsModal.test.tsx:124`. Full success closes as today.
- **R-E2-L (#14, U-13):** the modal receives every configured player (`Loot.tsx:389-392,1632` — change only the prop it passes; any other `mainRosterPlayers` use stays). `LootAdjustmentsModal` renders main-roster rows first, then — only when any exist — a `Substitutes` group label and their rows (same row component). Saving a sub's edit PUTs that sub.
- **R-E2-M (#12):** in `RecipientPicker.tsx`, one always-mounted `role="status"` container beside the submit area (`:607-626`) whose text is non-empty only when `selected && !selectionVisible` (`:295`): `{name} is selected but hidden by your search — pick a visible player or clear the search.` (`text-xs text-text-secondary`). The picker pre-selects the top-ranked player at open (`:383-386`), so any search for someone else triggers it — the copy must work for that case. Submit gating is unchanged.
- **R-E2-N (Book revert):** `history/DeleteLootConfirmModal.tsx:29,82,95`: the revert checkbox **and** the "This will:" preview (`:95`) use one condition, `(entry.method === 'drop' || entry.method === 'book') && !entry.isExtra` — the condition `utils/lootCoordination.ts:315-345` reverts on — and the checkbox defaults **checked** for both (legacy always reverts, `phase-d-loot-design.md:781-788`). Otherwise no checkbox and `revertGear` is false; this also removes today's checkbox on extra-loot drops, which did nothing (`:82`). **Reviewer note:** Book deletes now revert gear by default — a changed destructive default, deliberately matching legacy. The modal is V2-only today (only `Loot.tsx` imports it).
- **R-E2-O (V1):** every file this plan touches is V2-only **except** `TierSelector.tsx`, `tokens.light.json`/`tokens.generated.css` and `Discover.tsx` (U-9). No other V1-rendered file changes. `loot/LootPriorityPanel`, `schedule/AvailabilityGrid` (V2 shows it only inside a modal, `Schedule.tsx:50`), `TemplateRecommendations`, `ScheduleUpcomingPanel`, `priority/PlayerAdjustmentsModal` are read-only references.

## Review Focus

- R-E2-D: does the header hold one line in **every** state at the narrowest column, and does truncation keep the full name reachable (tooltip/title, and the accessible name)?
- R-E2-F: RosterCard's displayed fraction must not change for any player; the Board must now agree with it, including substitutes and a job with an empty off-hand.
- R-E2-K: exactly one toast on partial failure, the modal stays open with the draft intact, successful rows are not lost; full success unchanged.
- R-E2-A: no remaining V2 tab skips a heading level (except the parked V1-shared files); no test was silenced by loosening a `level` query.
- V1: only the three U-9 changes are visible in `?shell=legacy`.

## Task 1 — Session card + heading outline (`xivrp-implementer`, sonnet)

Files: `components/ui/SessionRsvpCard.tsx`, `components/ui/CardShell.tsx`, `components/roster/RosterCards.tsx`, their tests, and any test that queries a CardShell title by `level: 3`.

1. **#36 (R-E2-C).** Tests: the glyph is the element immediately after the identity inside each `<li>` and has no `ml-auto`; the sr-only label and the `·`/`✓`/`?` characters (`SessionRsvpCard.test.tsx:225-260`) still pass.
2. **tz line (R-E2-B).** Tests: same zone → `queryByTestId('session-tz-line')` is null; different zone → the line reads `your time …` and does not repeat the session time (update `:59-62`).
3. **Headings (R-E2-A).** `CardShell` `level` prop, default `'h2'`; SessionRsvpCard inner title → `h3`; RosterCards group label → `h2`. Tests: CardShell renders `h2` by default and `h3` with `level="h3"`. Grep `level: [34]` across `frontend/src`: the inner-title queries at `SessionList.test.tsx:82` and `SessionRsvpCard.test.tsx:195,327` (`level: 4`) move to `level: 3`, and the negative check at `SessionRsvpCard.test.tsx:216` must still assert something real after the change — never fix a query by dropping the level.

Size: ~150 lines incl. tests.

## Task 2 — Roster card header + Board summary (RISKIEST · `xivrp-implementer-deep`, opus)

Files: `components/roster/RosterCard.tsx`, `components/ui/PlayerIdentity.tsx`, `components/roster/GearBoard.tsx`, a new helper in `utils/` (+ test), their tests.

1. **One-line header (R-E2-D).** Tests: in a tank card with both selectors, a SUB card and a card with the weapon-priority tag, the header row has no wrapping class and the name element truncates (class-level assertions are acceptable for layout here); the `title` reads `${name} — double-click to rename`; the full name stays in the accessible name. Browser-check at **1024, 1400 and 1440 px**, Compact and Expanded, including the name-edit state, in both themes — paste the measured card widths.
2. **Job badge (R-E2-E).** Test: the badge wrapper's offset/ring classes (layout pin). Browser-check "HO"/"MO"/"RO" initials are fully visible on Cards and in the drag overlay, and the badge clears the name.
3. **#7 (R-E2-F).** `playerBisProgress` + unit tests (a relevant slot with no `bisSource`; an off-PLD empty off-hand). GearBoard test with a diverging fixture: the displayed number and `summaryColor` agree and equal RosterCard's fraction for the same player; a substitute test as a pin. `GearBoard.test.tsx:90,313` (the no-BiS row) and RosterCard's existing tests stay green **unchanged**.

Task-scoped review after this task (slice-loop §1.4). Size: ~200 lines incl. tests.

## Task 3 — Home levers + V1-authorized fixes (`xivrp-implementer`, sonnet)

Files: `components/home/Home.tsx`, `components/ui/StatCell.tsx` (new) + test, `components/home/RosterReadinessCard.tsx`, `components/loot/FairnessSummary.tsx`, `components/static-group/TierSelector.tsx`, `frontend/tokens/tokens.light.json`, `src/styles/tokens.generated.css` (generated), `pages/Discover.tsx`, `e2e/contrast.spec.ts` (comment only), their tests.

1. **Grid (R-E2-G).** Test: Home renders both rows inside one grid container; `TwoRegionDashboard` is no longer rendered by Home; "Recent activity" (StaticActivityFeed) still renders, in the side stack between Loot fairness and the track card.
2. **StatCell (R-E2-H).** Unit test for `StatCell` (value/label/detail as a node, both aligns, and `text-text-primary` absent when `valueClassName` is passed). RosterReadinessCard and FairnessSummary render through it; FairnessSummary has no per-cell radius/background (assert the absence of the old tile classes); the empty-roster layout has no empty cell.
3. **Labels (R-E2-I).** Update `RosterReadinessCard.test.tsx:40` (`/At full BiS/`) and `FairnessSummary.test.tsx:47` (two lines `Most: Alice` / `Fewest: Bob`); the empty-roster describe block (`:73-80`) stays green unchanged.
4. **V1-authorized (R-E2-J).** TierSelector `text-xs` ×3; the token + `pnpm tokens:build` + `pnpm tokens:check` (paste its output; not `tokens:parity`); the recomputed `contrast.spec.ts` comment; Discover wrapper.

Size: ~250 lines incl. tests.

## Task 4 — Loot fixes (`xivrp-implementer`, sonnet)

Files: `components/loot/Loot.tsx`, `components/loot/LootAdjustmentsModal.tsx`, `components/loot/RecipientPicker.tsx`, `components/history/DeleteLootConfirmModal.tsx` + a new `DeleteLootConfirmModal.test.tsx`, their tests.

1. **#13 (R-E2-K).** Test through the real `handleSaveAdjustments` path (Loot-level test with one `updatePlayer` rejecting): the modal stays open, exactly one error toast carrying the count, draft intact; all-success closes. Browser pass forces a failure by blocking one player's PUT (DevTools request blocking on that player's URL).
2. **#14 (R-E2-L).** Tests: a substitute row renders under `Substitutes`; no group label when there are no subs; saving a sub's value calls the update for that sub.
3. **#12 (R-E2-M).** Test: the `role="status"` container is always present; a search that hides the selected recipient fills it with the player's name; clearing the search or picking a visible player empties it.
4. **Book revert (R-E2-N).** New test file: drop → checkbox, checked; book → checkbox, checked; `isExtra` → no checkbox and no revert line in "This will:"; the preview and checkbox agree; confirm passes `revertGear` through; unchecking passes `false`.

Size: ~250 lines incl. tests.

## Finish (controller)

1. **Browser pass** (memory `feedback_browser_validation_process`): dev-auth → `/group/DEVTST?shell=v2`, tabs `overview|roster|loot|schedule`, 1440×900 via `emulate` (verify `innerWidth`), plus 2560×1440 for Schedule (RSVP grid) and Roster; both themes. Walk: the RSVP card (same zone and a spoofed different zone), roster headers (tank/SUB/weapon-tag, Compact + Expanded), the Board summary for a sub, Home at 1440 and just under 1181, Loot adjustments with a sub + a forced failure, the recipient-picker hint, a Book delete confirm, Static Finder, the tier badge. **V1** at `?shell=legacy`: Home/Roster/Loot/Schedule unchanged except the tier badge and light muted text; `/discover` left-aligned. 0 console errors.
2. **Detector re-run** on the same snapshot recipe (dark + light, 1440): expect `undersized-ui-text` 0, `skipped-heading` 0 on Home/Roster/Loot (Schedule may keep the parked AvailabilityGrid h3 only if it renders on the main view — report), Home `nested-cards` down by the fairness tiles, the light `#6b6b7e` low-contrast hits gone. Paste the table in the PR body.
3. **Shots** → `docs/redesign/pr-shots/e2-*.webp`, light + dark of every touched surface (pr-checklist budget; `md5sum` for duplicates).
4. **Write-back (once):** `DESIGN_SYSTEM.md` — U-11's five drifts + the ambient wash, CardShell's heading contract (§3.16, `:315,318` → default h2 + `level`), the PlayerIdentity badge (`:338`), TwoRegionDashboard's users (`:352`, and `ui/TwoRegionDashboard.tsx:19`'s "Used by"), the GearBoard summary number (`:426`), `StatCell` (a new §3 entry), the light muted value; the header comments at `RosterReadinessCard.tsx:4-5` and `FairnessSummary.tsx:1-7`; the "TierSelector untouched byte-for-byte" comments at `layout/TopBar.tsx:17` and `pages/TierBreadcrumb.tsx:11`, which U-9 makes false; `docs/UI_COMPONENTS.md` Quick Reference row for `StatCell`; `ROLLOUT_ROADMAP.md` §7 E2 status + the carried residuals (the V1-shared h3s, #3/#8/#20/#22/#32/#34 homes) and the closed "empty grid cell" item; `phase-d-loot-design.md:781-788` note for R-E2-N. (Code comments in the files above belong to the task that touches the file; the controller catches any left over.)
5. `pr-checklist` skill, gates, draft PR, ready once.

**Gates (on the branch, pasted into the PR body):** `pnpm build` ✓ · `pnpm lint` 0 errors, warnings ≤ 812 · `pnpm check:design-system:strict` ✓ · `pnpm test` ≥ 3358 passing · `pnpm deadcode` ≤ 8 files / 179 exports / 139 types · dupes ≤ 320 clones · `pnpm tokens:check` ✓ · V1 unchanged except U-9 · light + dark shots of every touched surface.

**Budget:** ~850 changed lines (code + tests) + docs, under the ~1,500 cap.
