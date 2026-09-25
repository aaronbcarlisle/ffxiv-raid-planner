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

- **R-E2-A (headings):** `CardShell` takes `level?: 'h2' | 'h3'`, **default `'h2'`** — every current caller sits directly under the page `<h1>` (`home/*`, `loot/BookLedgerCard`, `roster/{GearBoard,OpenSeatCard,RosterCard,RosterCards}`, `schedule/{AvailabilityHeatmap,BestTimesCard,PersonLayerEntryPoint}`, `ui/SessionRsvpCard`, `pages/ShellContentStates`). `SessionRsvpCard`'s inner session-title `<h4>` (`:367`) becomes `<h3>`. `RosterCards.tsx:319` group label `<h3>` → `<h2>`. **Out of scope (V1-shared, frozen):** `schedule/AvailabilityGrid.tsx:531` and `TemplateRecommendations.tsx:48` (also imported by legacy `ScheduleTab`), `priority/LootPriorityPanel.tsx:509` (V1). Parked as a residual.
- **R-E2-B (tz line):** `session-tz-line` renders **only** when the viewer's zone differs from the session's, and reads `your time {viewerTime}` — the session time is already in the headline (`session-daytime`).
- **R-E2-C (#36):** in the member grid `<li>` (`SessionRsvpCard.tsx:389-404`), the glyph span drops `ml-auto` and follows `PlayerIdentity` directly (the existing gap); the identity wrapper can shrink (`min-w-0`, name truncates), the glyph is `shrink-0`. The sr-only status label is unchanged.
- **R-E2-D (#5 header):** `RosterCard.tsx:786-787`'s header row stops wrapping. Shrink order: the name truncates first (with its existing tooltip or a `title`), chips and the job-swap `IconButton` never shrink or wrap. Holds in every header state — tank (TankRoleSelector + PositionSelector), SUB tag, weapon-priority `+N` tag, Compact and Expanded — at the narrowest card column the Cards grid produces at 1440 px and at the `min-[1181px]` breakpoint. If a state genuinely cannot fit one line at the narrowest column, the implementer stops and reports (NEEDS_CONTEXT) rather than inventing a second row.
- **R-E2-E (job badge):** `PlayerIdentity.tsx:163-172`'s badge sits on the avatar's outer edge (outside the ring's bounds) with a card-surface ring, so no initial is covered. Applies wherever the inline variant renders (RosterCard, RosterCards, GearBoard). `rsvp-row` has no badge — untouched.
- **R-E2-F (#7):** one per-player helper — `playerBisProgress(player) → { completed, total }` using RosterCard's definition (`relevantGear(player.job, player.gear)`, `isSlotComplete`, `total = relevant.length || 11`, `RosterCard.tsx:551-554`) — in `utils/` (next to `rosterReadiness.ts`). RosterCard and GearBoard both call it; GearBoard's number **and** `summaryColor` use it (replacing `playerBis()` → `bisSlotTotals`, `GearBoard.tsx:103-112,126,285-290`). This also fixes substitutes, which `bisSlotTotals` filters out (0/0 → gray) on the Board. `bisSlotTotals` itself (the team total on Home) is unchanged.
- **R-E2-G (Home grid):** `Home.tsx:333-390` renders both rows in **one** grid: `grid grid-cols-1 gap-4 min-[1181px]:grid-cols-[1.15fr_1.15fr_1fr]` (the first row's current tracks and gap). The main stack (Needs attention, RoleBisCard, TeamSummaryCard) spans two columns (`min-[1181px]:col-span-2`); the side stack (Loot fairness, TrackCard) is column 3; `items-start`. Home stops importing `TwoRegionDashboard`; Schedule keeps it (unchanged). Below 1181 px the single-column order is unchanged.
- **R-E2-H (one stat idiom):** new `components/ui/StatCell.tsx` — `{ value, label, detail?, valueClassName?, align?: 'center' | 'start' }`, markup = RosterReadinessCard's `Stat` (`RosterReadinessCard.tsx:28-35`: value `text-lg font-display font-bold tabular-nums`, label `text-xs uppercase tracking-wide text-text-tertiary`) plus an optional `detail` line (`text-xs text-text-tertiary`). RosterReadinessCard's local `Stat` is replaced by it (centered, `divide-x` row unchanged). FairnessSummary's `StatCard` tiles are replaced by `StatCell` (`align="start"`) in a 2×2 grid with hairline dividers (`border-border-subtle`), no per-cell border/background. The empty-roster branch (R-E1 / #30) is unchanged. FairnessSummary also renders on Loot (`Loot.tsx`) — same change there, by construction.
- **R-E2-I (labels):** RosterReadinessCard `"% BiS"` → `"At full BiS"` (the value is the share of raiders whose BiS is complete). FairnessSummary Most / fewest detail becomes two lines — `Most: {names}` and `Fewest: {names}` (names joined with `, `; the counts stay in the value `2 / 1`).
- **R-E2-J (V1-authorized, U-9):** (1) `TierSelector.tsx:76,94,116` `text-[10px]` → `text-xs` (nothing else in those spans changes). (2) `frontend/tokens/tokens.light.json:28` `#6b6b7e` → `#606073`, then `pnpm tokens:build` so `tokens.generated.css` matches (CI `tokens:check`); if `tokens:parity`'s baseline (`frontend/scripts/__parity__/index.baseline.css:254`) pins the old value, update it; update the hex in the `e2e/contrast.spec.ts:27` residual comment. The mockup mirror under `design/redesign/mockups/theme/` is historical — leave it. (3) `pages/Discover.tsx:357` drop `mx-auto` (keep `max-w-[160rem] w-full px-4 py-6 sm:py-8`).
- **R-E2-K (#13):** match legacy `priority/PlayerAdjustmentsModal.tsx:60-81`: `Loot.handleSaveAdjustments` (`Loot.tsx:806-819`) keeps `Promise.allSettled`, and when any update failed it **throws** (an `Error` naming the count) instead of only toasting; `LootAdjustmentsModal.handleSave` (`:108-131`) already keeps the modal open and toasts on a rejection — exactly **one** error toast per failed save (no double toast). Full success closes as today.
- **R-E2-L (#14, U-13):** the modal receives every configured player (`Loot.tsx:389-392,1632` — change only the prop it passes; any other `mainRosterPlayers` use stays). `LootAdjustmentsModal` renders main-roster rows first, then — only when any exist — a `Substitutes` group label and their rows (same row component). Saving a sub's edit PUTs that sub.
- **R-E2-M (#12):** in `RecipientPicker.tsx`, when `selected && !selectionVisible` (`:295`), render a one-line hint beside the submit area (`:607-626`): `{name} is selected but hidden by your search — clear it to assign.` (`text-xs text-text-secondary`, `role="status"` or `aria-live="polite"`). Submit gating is unchanged.
- **R-E2-N (Book revert):** `history/DeleteLootConfirmModal.tsx:29,82`: the revert checkbox shows when `(entry.method === 'drop' || entry.method === 'book') && !entry.isExtra` — the same condition `utils/lootCoordination.ts:315-345` reverts on — and defaults **checked** for both (legacy always reverts, `phase-d-loot-design.md:781-788`). Otherwise no checkbox and `revertGear` is false. The modal is V2-only today (only `Loot.tsx` imports it).
- **R-E2-O (V1):** every file this plan touches is V2-only **except** `TierSelector.tsx`, `tokens.light.json`/`tokens.generated.css` and `Discover.tsx` (U-9). No other V1-rendered file changes. `LootPriorityPanel`, `AvailabilityGrid`, `TemplateRecommendations`, `ScheduleUpcomingPanel`, `PlayerAdjustmentsModal` are read-only references.

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
3. **Headings (R-E2-A).** `CardShell` `level` prop, default `'h2'`; SessionRsvpCard inner title → `h3`; RosterCards group label → `h2`. Tests: CardShell renders `h2` by default and `h3` with `level="h3"`; update every test that looked a CardShell title up as `level: 3` (grep `level: 3` under `components/{home,roster,loot,schedule,ui}` and `pages/ShellContentStates`), never by dropping the level.

Size: ~150 lines incl. tests.

## Task 2 — Roster card header + Board summary (RISKIEST · `xivrp-implementer-deep`, opus)

Files: `components/roster/RosterCard.tsx`, `components/ui/PlayerIdentity.tsx`, `components/roster/GearBoard.tsx`, a new helper in `utils/` (+ test), their tests.

1. **One-line header (R-E2-D).** Tests: in a tank card with both selectors, a SUB card and a card with the weapon-priority tag, the header row has no wrapping class and the name element truncates (class-level assertions are acceptable for layout here); the full name stays in the accessible name. Browser-check the narrowest column at 1440 px and at 1181 px, Compact and Expanded, in both themes — paste the widths you checked.
2. **Job badge (R-E2-E).** Test: the badge wrapper's offset/ring classes (layout pin). Browser-check "HO"/"MO"/"RO" initials are fully visible in Cards and Board.
3. **#7 (R-E2-F).** `playerBisProgress` + unit tests (a relevant slot with no `bisSource`; an off-PLD empty off-hand; a substitute). GearBoard test with a diverging fixture: the number and the color agree and equal RosterCard's fraction for the same player. RosterCard's existing tests stay green unchanged.

Task-scoped review after this task (slice-loop §1.4). Size: ~200 lines incl. tests.

## Task 3 — Home levers + V1-authorized fixes (`xivrp-implementer`, sonnet)

Files: `components/home/Home.tsx`, `components/ui/StatCell.tsx` (new) + test, `components/home/RosterReadinessCard.tsx`, `components/loot/FairnessSummary.tsx`, `components/static-group/TierSelector.tsx`, `frontend/tokens/tokens.light.json`, `src/styles/tokens.generated.css` (generated), `pages/Discover.tsx`, `e2e/contrast.spec.ts` (comment only), their tests.

1. **Grid (R-E2-G).** Test: Home renders the two stacks inside one grid container; `TwoRegionDashboard` is no longer rendered by Home.
2. **StatCell (R-E2-H).** Unit test for `StatCell` (value/label/detail, both aligns). RosterReadinessCard and FairnessSummary render through it; FairnessSummary has no per-cell border/background (assert the absence of the old tile classes).
3. **Labels (R-E2-I).** Update `RosterReadinessCard.test.tsx:40` (`/At full BiS/`) and `FairnessSummary.test.tsx:47` (two lines `Most: Alice` / `Fewest: Bob`); the empty-roster describe block (`:73-80`) stays green unchanged.
4. **V1-authorized (R-E2-J).** TierSelector `text-xs` ×3; the token + `pnpm tokens:build` + `pnpm tokens:check`; Discover wrapper. Paste `tokens:check` (and `tokens:parity` if it exists) output.

Size: ~250 lines incl. tests.

## Task 4 — Loot fixes (`xivrp-implementer`, sonnet)

Files: `components/loot/Loot.tsx`, `components/loot/LootAdjustmentsModal.tsx`, `components/loot/RecipientPicker.tsx`, `components/history/DeleteLootConfirmModal.tsx` + a new `DeleteLootConfirmModal.test.tsx`, their tests.

1. **#13 (R-E2-K).** Test through the real `handleSaveAdjustments` path (Loot-level test with one `updatePlayer` rejecting): the modal stays open, exactly one error toast, draft intact; all-success closes.
2. **#14 (R-E2-L).** Tests: a substitute row renders under `Substitutes`; no group label when there are no subs; saving a sub's value calls the update for that sub.
3. **#12 (R-E2-M).** Test: search hides the selected recipient → the hint shows and names the player; clearing the search removes it.
4. **Book revert (R-E2-N).** New test file: drop → checkbox, checked; book → checkbox, checked; `isExtra` → no checkbox; confirm passes `revertGear` through; unchecking passes `false`.

Size: ~250 lines incl. tests.

## Finish (controller)

1. **Browser pass** (memory `feedback_browser_validation_process`): dev-auth → `/group/DEVTST?shell=v2`, tabs `overview|roster|loot|schedule`, 1440×900 via `emulate` (verify `innerWidth`), plus 2560×1440 for Schedule (RSVP grid) and Roster; both themes. Walk: the RSVP card (same zone and a spoofed different zone), roster headers (tank/SUB/weapon-tag, Compact + Expanded), the Board summary for a sub, Home at 1440 and just under 1181, Loot adjustments with a sub + a forced failure, the recipient-picker hint, a Book delete confirm, Static Finder, the tier badge. **V1** at `?shell=legacy`: Home/Roster/Loot/Schedule unchanged except the tier badge and light muted text; `/discover` left-aligned. 0 console errors.
2. **Detector re-run** on the same snapshot recipe (dark + light, 1440): expect `undersized-ui-text` 0, `skipped-heading` 0 on Home/Roster/Loot (Schedule may keep the parked AvailabilityGrid h3 only if it renders on the main view — report), Home `nested-cards` down by the fairness tiles, the light `#6b6b7e` low-contrast hits gone. Paste the table in the PR body.
3. **Shots** → `docs/redesign/pr-shots/e2-*.webp`, light + dark of every touched surface (pr-checklist budget; `md5sum` for duplicates).
4. **Write-back (once):** `DESIGN_SYSTEM.md` — U-11's five drifts + the ambient wash, CardShell's heading contract (§3.16, `:315,318` → default h2 + `level`), `StatCell` (a new §3 entry), the light muted value; `docs/UI_COMPONENTS.md` Quick Reference row for `StatCell`; `ROLLOUT_ROADMAP.md` §7 E2 status + the carried residuals (the V1-shared h3s, #3/#8/#20/#22/#32/#34 homes); `phase-d-loot-design.md:781-788` note for R-E2-N.
5. `pr-checklist` skill, gates, draft PR, ready once.

**Gates (on the branch, pasted into the PR body):** `pnpm build` ✓ · `pnpm lint` 0 errors, warnings ≤ 812 · `pnpm check:design-system:strict` ✓ · `pnpm test` ≥ 3358 passing · `pnpm deadcode` ≤ 8 files / 179 exports / 139 types · dupes ≤ 320 clones · `pnpm tokens:check` ✓ · V1 unchanged except U-9 · light + dark shots of every touched surface.

**Budget:** ~850 changed lines (code + tests) + docs, under the ~1,500 cap.
