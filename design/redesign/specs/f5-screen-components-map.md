# F5 — Screen → Components Map (the F6 build manifest)

> **What this is.** The migration-grade build input F6 consumes: every structural element of the Ring-0 spine + shell chrome + Schedule mockups, tagged against the *now-real* design system (both `DESIGN_SYSTEM.md` contracts **and** the actual `frontend/src/components/` tree), and linked to the current component(s) it consolidates. Produced by the F5 mockup-validation pass (`specs/2026-06-28-f5-mockup-validation-design.md`).
>
> **Corrections applied.** This synthesis applies the full xhigh-review correction layer (`CORRECTIONS.md` §A cross-set reconciliations + §B per-fragment fixes + §C approved-minors) over the eight raw fragments. Where a correction named a path/line it was re-grounded against actual code before being written here (PageHeader, NotificationCenter + UserMenu bell, `StaticHomeTab` modules, the `ActivityFeed.tsx:200` name collision, `RosterViewToggle`, `ScheduleTab.tsx:527-534`). The whole-branch review re-verifies every tag against code.

---

## Legend

**Tag rubric (every row gets exactly one, grounded in real code):**

| Tag | Means | Cites |
|---|---|---|
| **existing** | A built component already covers this element **and** conforms to `DESIGN_SYSTEM.md`. Drops in as-is. | the component path |
| **refine** | A real component exists but needs change before drop-in: token/conformance fix, prop/API change, or **fork-consolidation** (forks collapse to one). | path(s) + the change |
| **new** | No component covers it; F6 builds it. | the new-component catalog name (§ New-component catalog) |

**Escapes (visible to the reviewer, never promoted into the build manifest):**

- **`filler? — confirm`** — possibly placeholder/decorative mockup content; treat layout as signal, filler as noise. Not catalogued until confirmed structural.
- **`retired-IA — no home, drop`** — an element from the retired IA (Gear tab, "Who Needs It," "More," sub-tab toggles). Flagged, never tagged existing/refine/new.

**Catalog-membership rule (§6 of the design spec):** only `new` rows **and** `refine` rows whose target is a *consolidated/renamed shared component* earn a catalog entry. A `refine` that only fixes tokens on an already-single component (e.g. `PageHeader`, `LightPartyHeader`) does **not**.

**Schema (every table, exact columns, no additions/renames/reorders):**
`| Element | Tag | Target component | Consolidates | DS ref | Notes |`

---

## Shell chrome

| Element | Tag | Target component | Consolidates | DS ref | Notes |
|---|---|---|---|---|---|
| Context rail container (72px, `surface-raised`, full-height, 1px right border) | refine | `components/layout/AppRail.tsx` | `components/layout/SidebarNav.tsx` (in-static rail role retired; AppRail repurposed for Person layer) | §3.9 | Remove collapse, lock to 72px, swap item set to Person-layer items, remove identity-header block, tokenize inline `rgba(20,184,166,…)` → `nav.*` tokens. **a11y (LOCKED §3.9):** `<nav aria-label="Primary navigation">` (current AppRail uses "Application navigation" — must change); **skip link to `#main-content` is required, not optional** and no rail row currently captures it. |
| Rail: app logo slot (top of rail) | refine | `components/layout/AppRail.tsx` | `components/layout/Header.tsx` (logo lives here as `<img src="/logo.svg">`) | §2.1, §3.9 | Logo moves Header→rail top; AppRail identity-header becomes icon-only logo container. "RP" is placeholder initials. |
| Rail: Player Hub item (person icon, tooltip "Player Hub") | refine | `components/layout/AppRail.tsx` | — | §3.9 | Person-layer nav item; sr-only label + WAI-ARIA tooltip on hover AND keyboard focus; 44px touch target; active = filled + `accent.default` + left-edge pill. |
| Rail: Static Finder item (compass/grid icon, tooltip "Static Finder") | refine | `components/layout/AppRail.tsx` | — | §3.9 | Person-layer nav item; same a11y requirements as Player Hub item. |
| Rail: static avatar items (active "CS" accent-bordered + inactive "LP" muted) | refine | `components/layout/AppRail.tsx` | — | §3.9 | **Net-new item variant** (no avatar variant exists in `RailNavItem` today): 44px rounded-square static initials; active = accent border + left-edge pill; extends `railTypes.ts`. |
| Rail item: active state (filled icon + `accent.default` + left-edge pill) | refine | `components/layout/AppRail.tsx` | — | §3.9 | Pill exists as `motion.span` w/ `layoutId` but uses raw `linear-gradient(rgba(20,184,166,…))` → `nav.item-active-indicator` token; motion spec is a v3.1 gap. |
| Rail item: hover state (surface-overlay tint) | refine | `components/layout/AppRail.tsx` | — | §3.9 | `hover:bg-white/[0.035]` → `--color-hover-overlay` semantic token. |
| Rail item: focus state (visible focus ring, distinct from hover) | refine | `components/layout/AppRail.tsx` | — | §3.9 | No explicit `focus-visible` styling today; needs ring (not fill); exact ring width/offset is DS §7 gap 9, carried to F6. |
| Rail: user avatar (bottom footer slot) | existing | `components/auth/UserMenu` | — | §3.9 | `UserMenu variant="rail"` already passed as AppRail `footer` in `SidebarNav.tsx`; reused as-is. |
| Top bar container (`surface-raised`, h-56px, 1px bottom border) | refine | `components/layout/Header.tsx` | — | §2.1, §3.1 | DS §3.8 lists "top bar" as a *new* component; it is realized here as a **refine of the existing `Header.tsx`**, not a fresh mint (§A.8). Refine: remove logo (→ rail), remove Discord/GitHub external links from primary chrome, restructure to [static/track pickers] [spacer] [⌘K] [bell] [gear] [theme]; `max-w` → `size.container.*`. |
| Top bar: static + track context pickers ([Static ▾] › [Track ▾]) | refine | `components/layout/ContextSwitcher.tsx` | `static-group/TierSelector.tsx` (merges in) | §3.1 | ContextSwitcher's 3 segments drop to the static segment only (Player Hub/Finder → rail) and gain an inline breadcrumb Track picker from TierSelector logic; segmented-pill → breadcrumb inline. |
| Top bar: ⌘K affordance button (kbd-styled trigger) | refine | `components/layout/Header.tsx` | — | §3.8, §4 | New inline element added during Header refine; platform-aware label (⌘K mac / Ctrl K win per §4); triggers CommandPalette; replaces TipsCarousel as the center element. (DS ref corrected: §3.8 + §4, not §3.4.) |
| Top bar: notification bell (bell icon + badge-dot count) | refine | `NotificationBell` | `components/auth/NotificationCenter.tsx` (bell modal, filters, mark-read) + `components/auth/UserMenu.tsx` bell trigger + unread badge (`:216-228`) + `stores/notificationStore` + `components/layout/Header.tsx` settings-gear join badge (`:344-348`, minor predecessor) | §3.8 | **A bell already exists** (correction: the "no bell" claim was false). NotificationCenter already carries join-requests (`new_application`/`join_request`). F6 consolidates these into one top-bar bell + unified badge; join-request count moves off the settings gear. |
| Top bar: settings gear (opens role-scoped Settings panel) | refine | `components/layout/Header.tsx` | `components/layout/SettingsDockToggle.tsx` | §3.1 | Mobile gear (Header) + desktop `SettingsDockToggle` consolidate into one always-visible `IconButton`; join badge moves to `NotificationBell`. |
| Top bar: theme toggle (dark/light icon button) | existing | `components/ui/ThemeToggle.tsx` | — | §5 | Already in Header (`hidden sm:flex`); conforms; remove the `hidden sm:flex` wrapper so it is always shown. |
| In-static spine tab-bar (Home · Roster · Loot · Schedule, h-48px, `surface-base`) | refine | `components/layout/TabNavigation.tsx` | `components/layout/SidebarNav.tsx` (in-static sidebar nav role fully retired) | §2.4, §3.2 | DS §3.8 lists "spine tab-bar" as *new*; realized as a **refine of `TabNavigation.tsx`** (§A.8). Tabs Overview→Home; Gear/Goals/More/Plugin → retired-IA; result = 4-tab spine; pill-container → full-width border-bottom bar on `surface-base`. |
| Spine: tab active state (bottom 2px underline accent indicator) | refine | `components/layout/TabNavigation.tsx` | — | §2.4 | Filled `bg-accent/20` active → text `accent.default` + `::after` 2px underline; icon opaque active / 45% inactive; visual-pattern change, no new color token. |
| Spine: tier fight-range label ("M9S–M12S") | filler? — confirm | — | — | §2.3 | Right-aligned spine label; if structural, `ui/Tag variant="label"` inline in TabNavigation refine; confirm before elevating. |
| Spine: week indicator pill ("WEEK 3") | filler? — confirm | — | — | §3.5 | Either a simplified inline WeekStepper or a placeholder while the real week control lives in the top bar (the shell week clock — see `WeekNavigatorStrip / WeekStepper` catalog entry); confirm. |
| ⌘K command palette overlay (full-overlay, keyboard-triggered) | new | `CommandPalette` | `components/ui/KeyboardShortcutsHelp.tsx` (shortcuts modal — display-only, not a palette; content absorbed) | §3.8, §4 | No palette exists (no `cmdk` in repo). Search input + go-anywhere + do-anything + context-switch; platform-aware trigger (§4). (DS ref corrected to §3.8 + §4.) |

---

## Home

| Element | Tag | Target component | Consolidates | DS ref | Notes |
|---|---|---|---|---|---|
| Two-region layout (actionable-left / ambient-right grid) | new | `TwoRegionDashboard` | — | REDESIGN_SPEC §4.2 | 1.85fr + 1fr grid, collapses to 1-col at 1180px; no layout wrapper exists; `.dash` is mockup-only CSS. Shared with Schedule (+ Player Hub deferred). |
| Page header ("This week" + session subtitle) | refine | `components/layout/PageHeader.tsx` | — | DS §3 (PageHeader); REDESIGN_SPEC §6 | Confirmed at `layout/PageHeader.tsx` (title/subtitle/icon/actions). Token-only refine: raw-accent-`rgba()` violations at `:17,26-27,35` → `var(--color-accent)` / `color-mix`. Not a catalog entry (single component, token fix). |
| Card surface shell (all `.card` surfaces) | new | `CardShell` | `ui/DashboardCard.tsx` + ~25-strong bespoke `*Card` family (`player/PlayerCard.tsx`, `schedule/SessionCard.tsx`, `dashboard/MyStaticsPanel.tsx`, …) | watchlist; REDESIGN_SPEC §6 | No shared shell exists; watchlist mandates consolidate/new, **not** refine-a-primitive. `DashboardCard` has inline-hex violations (GLASS_GRADIENT, GOLD_LABEL, MEDALLION_COLORS). |
| Next-session RSVP card | refine | `SessionRsvpCard` | `schedule/SessionCard.tsx` + `schedule/ScheduleUpcomingPanel.tsx` + Home `NextRaidModule` (`static-group/StaticHomeTab.tsx:456-558`) | watchlist; REDESIGN_SPEC §5.4 | Shared Home + Schedule. Home variant drops manage controls; needs role-colored avatar stack + tz-offset line. (Corrected from `new ← SessionCard`: full precursor list, `refine`.) |
| This week's loot — per-fight progress bars + "Log this week's loot" CTA | new | `WeeklyLootSummaryCard` | — | REDESIGN_SPEC §5.1 | Per-fight cleared/in-progress bar rows + single primary CTA; no Home-summary precursor. |
| Roster readiness summary (stat row + single bar) | new | `RosterReadinessCard` | `static-group/StaticHomeTab.tsx` `WeeklyProgressModule` (`:560-656`, BiS fraction + bar + Avg iLv) + `GroupHeroPanel` stat strip (`:919-941`) | REDESIGN_SPEC §5.1; §7 (Gear → Home readiness) | Corrected: "no existing card" was false — the readiness numbers are computed in the Home modules above. avg iLvl + % BiS + raider count pills + single BiS-complete bar. |
| "Needs your attention" per-action-item row | new | `AttentionRow` | `player/PlayerSetupBanner.tsx` + `group/MorePage.tsx` join-requests + `static-group/StaticHomeTab.tsx` `NotificationsModule` (`:340-454`) + `JoinRequestReviewModal` | watchlist; REDESIGN_SPEC §7 (Requests → Home attention list) | 3 row variants in mockup (no-BiS, unclaimed-slot, join-request); consolidates all four precursors into one prioritized list. |
| BiS progress by role bars (the per-role linear bars) | new | `ProgressBar` | `static-group/StaticHomeTab.tsx` `WeeklyProgressModule` per-role bars | DS §4.1 role color tokens | Decoupled per §A.7: the role-colored *bar* is the configurable `ProgressBar` primitive (color = role \| gear-source \| accent). Same primitive as the Roster-Cards per-card BiS bar. |
| Gear-source legend (raid / tome aug / augmented / needed swatches) | new | `ProgressBarLegend` | `static-group/StaticHomeTab.tsx` `WeeklyProgressModule` (legend region) | DS §4.1 gear-source tokens | Decoupled per §A.7: the once-per-screen gear-source legend, separate from the bar. Corrected: `loot/RoleSection.tsx`/`player/PlayerCard.tsx` are **not** precursors (RoleSection is a colored accordion header; PlayerCard shows gear circles, no bars). |
| Recent activity feed (loot / material / mount event rows) | new | `StaticActivityFeed` | `static-group/StaticHomeTab.tsx` `deriveActivityItems` (`:160-305`) | REDESIGN_SPEC §5.1 | **Renamed from `ActivityFeedCard`** — that name already exists/exported at `profile/ActivityFeed.tsx:200` (Person layer). Real precursor is the Static-layer activity builder, **not** `profile/ActivityFeed` (different layer/domain). |
| "Also tracking" track card (mini Progress Engine summary) | new | `TrackCard` | `mount-farms/MountFarmTab.tsx` + `mount-farms/MountFarmSummary.tsx` | watchlist; REDESIGN_SPEC §2 | Neither precursor is a mini-card; TrackCard generalizes to any non-flagship track (ultimate, mount farm, gear funnel). |

---

## Roster — Cards

| Element | Tag | Target component | Consolidates | DS ref | Notes |
|---|---|---|---|---|---|
| Roster page header (h1 "Roster" + subtitle: player count, party grouping, avg iLvl) | refine | `components/layout/PageHeader.tsx` | bespoke per-page h1 + subtitle JSX across spine pages | DS §3 (PageHeader); §2 structural layer | **Corrected `new`→`refine`**: PageHeader exists at `layout/PageHeader.tsx` (§A.1). Wire subtitle to screen stats; adopt across the spine. Not a catalog entry (single component). |
| Cards⇄Board segmented toggle (toolbar primary view switch) | refine | `SegmentedToggle` | `ui/GroupViewToggle.tsx` + `ui/ViewModeToggle.tsx` + `player/RosterViewToggle.tsx` | DS §2.4 content-variant tabs | 3 confirmed forks. **Axes note (§A.2):** GroupViewToggle = grouping axis (Standard⇄Light-Party); ViewModeToggle/RosterViewToggle = density (compact⇄expanded); **Cards⇄Board is a net-new view axis** none of the three forks cover — consolidation unifies the raw-`<button>` pill pattern AND introduces the new axis. |
| Roster filter pills ("All jobs ▼" + "Standard comp ▼") | refine | `primitives/Dropdown.tsx` | — | DS §3.7 Inputs | Needs a compact pill/filter variant for toolbar context; one row covers both pills. Not a catalog entry (variant on a single component). |
| "Show subs" labeled toggle chip | existing | `ui/Toggle.tsx` | — | DS §3.5 Toggle (Recessed-Orb) | Conforms; label is inline layout. |
| Reorder + Add player action buttons (ghost sm + primary sm) | existing | `primitives/Button.tsx` | — | DS §3.1 Button | Both variants conform; no decorative trailing arrow (correct per §3.1). |
| Party group header (G1/G2 badge + "Light Party N" + aggregate BiS% bar + chevron) | refine | `components/player/LightPartyHeader.tsx` | — | DS §4.1 tokens | Structurally matches; hardcodes `bg-blue-500/20`(G1) / `bg-red-500/20`(G2) → semantic party-group tokens. Party BiS% bar is single-fill accent (not the gear-source legend). Token-only refine, not a catalog entry. |
| Substitutes section header (SUB badge + "Substitutes", no bar) | refine | `components/player/LightPartyHeader.tsx` | — | DS §4.1 tokens (membership-linked SUB color) | Same component; needs a `subs` variant that omits the BiS bar + renders the linked/amber SUB color. (See Board row — same variant gap.) |
| Player card shell (`surface-card` + `radius-lg` + role-colored 3px left edge) | new | `CardShell` | `ui/DashboardCard.tsx` + `player/PlayerCard.tsx` (shell layer) + ~25-strong bespoke `*Card` family | DS §3.2 Card | Same canonical `CardShell` as Home/Board/Schedule. |
| PlayerIdentity block (role-colored job badge + name + position tag + job/server subtitle) | new | `PlayerIdentity` | `player/PlayerCardHeader.tsx` inline identity (`:237-419`) + `ui/SafeAvatar.tsx` (reused) | DS §6 player-identity convention; watchlist | Identity is inline JSX in `PlayerCardHeader`, not standalone → `new` (extract shared). Cross-screen (Cards, Board, Loot, Schedule); variants: card / board-cell / RSVP-row. |
| iLvl display (bold numeric + "iLvl" label, right-aligned) | refine | `components/player/PlayerCardHeader.tsx` | — | DS §1.1 type tokens | Already computed/displayed; `ProgressRing` demotes to secondary now that a linear bar is added. Token-only refine, not a catalog entry. |
| Card BiS progress bar (horizontal bar + "X/11 BiS"; accent fill / warning when low) | new | `ProgressBar` | inline bar in `player/PlayerCard.tsx` + the `LightPartyHeader` party bar | DS §4.1 tokens (accent / status-warning fill) | **Corrected (§A.7):** stop smuggling a new shared linear-progress primitive into a `PlayerCard` refine — own it as the `ProgressBar` catalog entry so it dedups with the Home role bars + party-header bar. `ProgressRing` demoted. |
| Per-slot gear strip (11 compact source-colored pips) | refine | `components/player/PlayerCardGear.tsx` | — | DS §3.4 GearStatusCircle | DS §7 gap 2: replace ad-hoc pips with `GearStatusCircle` compact variant; `.slot.raid/.tome/.aug/.need` map to existing states. |
| Card footer / inline setup prompt (role dot + linked/sync + needs count, OR warning + CTA) | refine | `components/player/PlayerCard.tsx` | `player/NeedsFooter.tsx` + `player/PlayerSetupBanner.tsx` | DS §3.1 trailing-arrow rule; §4.1 status/membership tokens | "Import →"/"Assign →" trailing arrows violate §4.1 → remove glyph; `NeedsFooter` 4-col grid → one-line footer; banner → inline footer treatment. |
| Player context menu (kebab ⋮ → multi-section menu) | refine | `ui/ContextMenu.tsx` | right-click handler in `player/PlayerCard.tsx` + kebab `IconButton` in `player/PlayerCardHeader.tsx` | DS §4.1 glyph lexicon (⋮ overflow-vertical); §3.1a | Both triggers fire the same menu today; mockup consolidates to single kebab. `ui/ContextMenu.tsx` is the right component. |
| Empty/setup card (dashed border + role placeholder + "Open seat · Role" + Add/Recruit CTAs) | refine | `EmptyStateInvite` | `player/EmptySlotCard.tsx` + `player/PlayerSetupBanner.tsx` + entry into `wizard/SetupWizard.tsx` | DS §3.2 Card `empty` variant; watchlist | Merges slot placeholder + setup invitation; remove animated-cursor hover hint. Recruit → Static Finder (Ring-1; `filler? — confirm` the link target). |
| Gear source legend (Raid·Tome·Augmented·Needed swatches + slot-abbreviation key, once per screen) | refine | `ProgressBarLegend` | `player/PlayerCardGear.tsx` (inline legend) | DS §4.1 gear-source tokens | Same once-per-screen gear-source legend as Home/Board → consolidated into `ProgressBarLegend` (§A.7) rather than left as a bespoke inline block. Confirm token-conformance at F6. |

---

## Roster — Board

| Element | Tag | Target component | Consolidates | DS ref | Notes |
|---|---|---|---|---|---|
| Roster page header (Board variant) | refine | `components/layout/PageHeader.tsx` | bespoke per-page h1 + subtitle JSX | DS §3 (PageHeader); §2 | **Added row (§A.1 / §B-T4-IMPORTANT-2):** mockup `:450-453` has a page head; the report's "no PageHeader" was false. It is a screen page-header (not shell chrome). `refine`, not a catalog entry. |
| Cards⇄Board segmented toggle (toolbar `.seg`) | refine | `SegmentedToggle` | `ui/GroupViewToggle.tsx` + `ui/ViewModeToggle.tsx` + `player/RosterViewToggle.tsx` | DS §2.4 (Cards⇄Board canonical example) | **Corrected to 3 forks** (was 2 — added `RosterViewToggle`, §A.2). Axes note as in Roster-Cards. |
| Board toolbar slot filter pill ("All slots ▼") | refine | `primitives/Button.tsx` (ghost) + `primitives/PopoverSelect.tsx` | — | DS §3.1, §3.6 | **Corrected: not a catalog entry** (§B-T4-MINOR). Realized as a Button(ghost)+PopoverSelect composition pattern, not a bespoke `FilterPill` component. |
| Board toolbar tier/context filter pill ("Show: current tier ▼") | refine | `primitives/Button.tsx` (ghost) + `primitives/PopoverSelect.tsx` | — | DS §3.1, §3.6 | Same composition pattern; not a catalog entry. |
| "Split planner" Board mode button | existing | `primitives/Button.tsx` | — | DS §3.1 (ghost, sm) | Activates Split Planner Board mode (`SplitClearPlanner` re-homed here per §7); button itself is plain ghost. |
| "Export" button | existing | `primitives/Button.tsx` | — | DS §3.1 (ghost, sm) | Standard ghost action. |
| Board outer container (`.board` card wrapper) | new | `CardShell` | `ui/DashboardCard.tsx` + bespoke `*Card` family | DS §3.2 | Same canonical `CardShell`; F6 confirms whether GearBoard owns its shell or delegates. |
| Gear matrix table assembly (rows=players, cols=gear slots) | new | `GearBoard` | `team/TeamSummaryEnhanced.tsx` + `group/GearSyncDashboard.tsx` + `split-clear/SplitClearPlanner.tsx` (+ `SplitClearAssignmentBoard.tsx`, `SplitClearDraftReview.tsx`, … as Board modes) + legacy "Gear" surface | DS §3.4; REDESIGN_SPEC §5.2, §7 | **The big consolidation:** Board ← Gear tab + Loot-Log→Sync gear view + Team Summary gear table + Split Planner (becomes a Board mode). DS §7 gap 8 (density / compact mode) flagged here, carried to F6. |
| Party divider row (Light Party 1 / 2 / Substitutes `<tr>`) | refine | `player/LightPartyHeader.tsx` | — | DS §6 (party grouping, role color) | Board needs a `<tr colspan=…>` render-mode variant + the **Substitutes variant** (typed `groupNumber:1\|2` today, no Subs) + token-conformance (`bg-blue-500/20`, `bg-red-500` raw palette → semantic). |
| Player identity cell (role-colored left border + job badge + name + position/iLvl) | refine | `PlayerIdentity` | `player/PlayerCardHeader.tsx` (compact read-only variant) | DS §6 | Board needs the compact read-only board-cell variant of the cross-screen `PlayerIdentity`. |
| Job badge (role-colored square w/ job abbreviation) | existing | `ui/JobIcon.tsx` | — | DS §4 | Mockup's PLD/SGE/SAM text are placeholders; real impl uses `JobIcon`; `team/TeamSummaryEnhanced.tsx` already does `<JobIcon …/>`. (DS ref corrected to §4.) |
| Gear source cell per slot (have/need/need+priority; `.gcell` R/T/A/·/● codes) | new | `GearBoardCell` | `ui/GearStatusCircle.tsx` (gear atom — derived from) | DS §3.4; §7 gap 2 | REDESIGN_SPEC §5.2 names "gear-board cell" explicitly; derives its state machine from `GearStatusCircle` (raid=2-state, tome=3-state); `need+priority` (`.gcell.need.up`) is an internal variant. DS §7 gap 2 (unify ad-hoc pips) resolves here. |
| BiS summary cell (X/11 count per row, status-colored) | new | `GearBoard` (internal column) | — | DS §1.1 (status tokens) | Internal rightmost column; no standalone component. |
| "No BiS imported" player row state (warning spanning gear cells + "Import BiS" CTA) | new | `GearBoard` (internal row state) | — | DS §6 (empty states invite the next action) | Per-row conditional; "Import BiS" routes to player BiS import (remove trailing arrow per §4.1). |
| Substitute "SUB" tag (on player name) | existing | `ui/Tag.tsx` | — | DS §3.3 (Tag `variant="label"`) | `Tag.type-test.tsx` enforces label-variant cannot have onClick. |
| Gear source legend (Raid/Tome/Augmented/Empty/Priority swatches) | new | `ProgressBarLegend` | — | DS §1.1 (gear-source tokens) | Once-per-screen legend; Board-specific 5th state (Priority) not on Home/Loot legends — handle as a legend variant. |

---

## Loot — Priority

> Sources: `mockups/03-loot-priority.html` + `mockups/03-loot-priority-with-picker.html`.

| Element | Tag | Target component | Consolidates | DS ref | Notes |
|---|---|---|---|---|---|
| Priority \| History sub-tab toggle (`.subtabs`) | refine | `SegmentedToggle` | `ui/GroupViewToggle.tsx` + `ui/ViewModeToggle.tsx` + `player/RosterViewToggle.tsx` | DS §2.4 | Priority·History is the canonical view/filter subtab; same catalog `SegmentedToggle` as Roster/History (one entry, three forks). |
| Week-scope filter pill ("This week (Week 3) ▼") | refine | `components/history/WeekSelector.tsx` | — | DS §3.5 Week Stepper | **Name the mismatch (§C):** this is a `WeekSelector` *dropdown*, whereas DS §3.5 specs a dot-stepper; week context is a global top-bar control per §3.1 → confirm local-override vs redundant; needs compact toolbar variant. |
| "Log a drop" toolbar button | existing | `components/primitives/Button.tsx` | — | DS §3.1 (ghost) | Leading scan icon, no trailing glyph. |
| "Log this week's loot" toolbar button | existing | `components/primitives/Button.tsx` | — | DS §3.1 (primary) | One primary per toolbar region. |
| Floor card (`FloorCard`) | new | `FloorCard` | `components/loot/LootPriorityPanel.tsx` (inline per-floor rendering in `itemPriorities.map`) | DS §3.2; REDESIGN_SPEC §5.3 | Groups drops by fight; header = fight badge + floor label + status chip; body = `FloorDropRow` list; collapsed state reveals via `ui/LinkText.tsx`. |
| Fight badge (`.fno` — "M12S") | existing | `components/ui/Tag.tsx` | — | DS §3.3 (label variant) | Inert display-only. |
| Floor status chip ("2 items pending" / "N logged") | existing | `components/ui/Tag.tsx` | — | DS §3.3 (label); status tokens | Success-colored when fully logged. |
| Drop row per item slot (`FloorDropRow`) | new | `FloorDropRow` | `components/loot/LootPriorityPanel.tsx` (inline `itemPriorities.map` / `materialPriorities.map`) | REDESIGN_SPEC §5.3 | Item source icon (gear-source tokens) + name/slot + `PriorityRow` chip queue + Assign button; verify source icon vs DS §3.4 (no ad-hoc pip). |
| Inline priority chip queue (`PriorityRow`) | new | `PriorityRow` | `components/loot/LootPriorityPanel.tsx` local `LootPriorityEntry` memo (file-local, unexported) | watchlist; REDESIGN_SPEC §5.3 | Chip form: role-colored avatar + truncated name + rank badge; first chip accent-highlighted; "+N eligible" overflow. Shared with Home. (`priority/` folder = settings-only, no display precursor.) |
| "Assign" action button in drop row | existing | `components/primitives/Button.tsx` | — | DS §3.1 | accent-subtle sm; **remove the "Assign →" trailing arrow** per §4.1 → "Assign". (DS ref corrected to §3.1, not §4.1.) |
| Recipient picker overlay (`RecipientPicker`) | refine | `RecipientPicker` | `loot/QuickLogDropModal.tsx` + `history/AddLootEntryModal.tsx` + `loot/LootRecommendationCandidates.tsx`; precursor `primitives/PopoverSelect.tsx` (§3.6) | DS §3.6 specialization; §6 rule 3; REDESIGN_SPEC §5.3 | Full scrim-overlay; same selected/suggested/grayed grammar as PopoverSelect; internal scope mini-tabs use `SegmentedToggle`; search via `ui/Input.tsx`; resolves the "can't select that player" fork bug. |
| Player identity in picker rows (`PlayerIdentity`) | refine | `PlayerIdentity` | `player/` avatar/name patterns + `ui/SafeAvatar.tsx` | REDESIGN_SPEC §6; watchlist | Role-colored avatar + name + role dot + reason line; rank-number prefix is picker-specific. |
| Need badge in picker rows ("BiS"/"minor"/"free") | existing | `components/ui/Tag.tsx` | — | DS §3.3 (label); status tokens | "BiS" success-tinted, "minor" interactive, "free" muted; confirm Tag supports custom bg/color combos. |
| `loot/WhoNeedsItMatrix.tsx` | retired-IA — no home, drop | — | — | REDESIGN_SPEC §10; §3.3 | "Who Needs It" 3-deep sub-tab view eliminated; the capability is first-class in `FloorCard` + `PriorityRow`; term retired; absent from both mockups. |

> **Note (not a tagged element) — `loot/FloorSelector.tsx`:** the dropdown floor picker is **absent from the Priority mockup** — the always-visible `FloorCard` layout replaces it. It may survive in Loot-History; assess there, do not catalogue from Priority. The `priority/` editors (`ModeSelector`, `PresetSelector`, role/job/player editors) are settings-configuration, not Priority-view elements — they belong in Settings.

---

## Loot — History

| Element | Tag | Target component | Consolidates | DS ref | Notes |
|---|---|---|---|---|---|
| Priority · History sub-tab bar | refine | `SegmentedToggle` | `ui/GroupViewToggle.tsx` + `ui/ViewModeToggle.tsx` + `player/RosterViewToggle.tsx` | DS §2.4 | Shared with Loot-Priority + Roster; same catalog entry. |
| Filter pills (All weeks / All players / All sources) | refine | `components/ui/Select.tsx` | ad-hoc controls in `history/AllWeeksView.tsx`, `history/LootLogFilters.tsx` | DS §3.7 | Needs token-aligned inline pill presentation; scattered controls today. Not a catalog entry (variant on a single component). |
| "Log a drop" action button | existing | `components/primitives/Button.tsx` | — | DS §3.1 (ghost) | Triggers `RecipientPicker` flow in F6. |
| "Log this week's loot" action button | existing | `components/primitives/Button.tsx` | — | DS §3.1 (primary) | Invokes `LogWeekWizard`; one primary per region. |
| `AddLootEntryModal` (single-drop log modal) | refine | `RecipientPicker` | `history/AddLootEntryModal.tsx` | DS §3.6 | One of the two forked drop-log modals consolidated into the shared picker (with `loot/QuickLogDropModal`). |
| Log Week Wizard (GearStep → BooksStep → ConfirmStep) | refine | `components/loot/LogWeekWizard/index.tsx` | — | DS §3.6 | Wizard retained; per-drop assignment in `GearStep` delegates to shared `RecipientPicker`; token alignment. |
| Fairness summary strip (4 stat cards) | new | `FairnessSummary` | `history/LootCountBar.tsx` | DS §3.2; `--color-status-success` | Tier-wide aggregate (drops this tier, most/fewest, distribution status, this-week); `LootCountBar` (per-player bar) partially overlaps → absorbed/retired. |
| History view orchestrator | refine | `components/history/HistoryView.tsx` | `history/SectionedLogView.tsx` (retired) + `history/LootLogFilters.tsx` (toolbar refactored) | DS §2.2 `size.container.data` | **Double-attribution fixed (§C):** `SectionedLogView`'s successor is **this orchestrator** (removed from the record-table row). `LootLogPanel` is **not** here — its successor is `UnifiedWeekOverview` (record-table row). Remove per-week nav state (moves to shell top bar); retain modal orchestration. |
| History record table (all-weeks chronological list) | refine | `components/history/AllWeeksView.tsx` | `history/WeeklyLootGrid.tsx` + `history/UnifiedWeekOverview.tsx` + `history/LootLogPanel.tsx` | DS §3.2; `size.container.data` | **Double-attribution fixed (§C):** `LootLogPanel` → `UnifiedWeekOverview` lands here; `SectionedLogView` removed (it goes to the orchestrator). Add week-group header sections; restyle rows to tokens. |
| Week group header (week pill + date range + drop count) | new | `WeekGroupHeader` | — | DS §2.3 (Week); `--color-accent-dim`, `--color-text-tertiary` | Section header per week; accent "WEEK N" pill + ISO range + count; sub-component of `AllWeeksView`. |
| Log entry row (source badge + item + arrow + recipient + floor + timestamp + kebab) | refine | `components/history/LogEntryItems.tsx` | `history/FloorSection.tsx` (row rendering) | DS `--color-gear-*`, §3.3 | Recipient → `PlayerIdentity`; source/reason badges → `Tag(variant="label")`; currently split across `LootLogEntryItem`/`MaterialLogEntryItem`. |
| Gear source badge (R/T/A colored square) | refine | `components/ui/Tag.tsx` | ad-hoc inline styling in `history/LogEntryItems.tsx`, `history/WeeklyLootGrid.tsx` | DS §3.3; `--color-gear-*` | Standardize to `Tag(variant="label")` w/ gear-source tokens. |
| Recipient identity block (avatar + name + role/job) | refine | `PlayerIdentity` | `ui/SafeAvatar.tsx` + inline display in `history/LogEntryItems.tsx`, `history/AllWeeksView.tsx` | DS §6; REDESIGN_SPEC §6 | Compact inline form of the canonical `PlayerIdentity`. |
| Reason tag ("BiS need" / "aug weapon" / "free/sell") | refine | `components/ui/Tag.tsx` | ad-hoc `.reason-tag` CSS in history rows | DS §3.3; status tokens | Inert label; success-tinted "BiS need", muted "free/sell". |
| Per-row kebab overflow menu | existing | `components/ui/ContextMenu.tsx` | — | DS §4.1 (kebab = vertical overflow) | Already used in `AllWeeksView.tsx`, `WeeklyLootGrid.tsx`. |
| WeekStepper (week navigation) | refine | `WeekNavigatorStrip / WeekStepper` | `components/history/WeekStepper.tsx` | DS §3.5 | Week nav moves to the shell top bar (the shared clock); the dot-stepper becomes the cross-screen shell week control. Within History it is replaced by the "All weeks" filter pill. |
| Log layout toggle (grid / list / all-weeks — mobile FAB) | refine | `SegmentedToggle` | `history/LogLayoutToggle.tsx` (mobile FAB) + `history/LootLogFilters.tsx` (desktop inline) | DS §2.4 | **Resolved (§A.2 / §C):** mockup shows a single layout → the toggle is **likely dropped** in the redesign; if a list/grid affordance is retained it folds into `SegmentedToggle` (related consolidation, not a 5th component). Currently a `design-system-ignore` FAB. |
| Log floating action buttons (mobile FABs — Log Loot / Log Material) | refine | `components/history/LogFloatingActions.tsx` | — | DS §3.1 / §3.1a | Mobile-only FABs; desktop equivalents are the toolbar Buttons; needs `IconButton` contract alignment or a justified `design-system-ignore` (§6). |

---

## Schedule

> Sources: `mockups/04-schedule.html`, grounded against `frontend/src/components/schedule/` + `ui/`.

| Element | Tag | Target component | Consolidates | DS ref | Notes |
|---|---|---|---|---|---|
| Week navigator strip (shared clock) | new | `WeekNavigatorStrip / WeekStepper` | — | §4.2; §9.3 invariant | Prev/next + "Week N · this week" + date range + recurring-summary ghost btn + "Add session" primary CTA; **must bind to the SAME week object Loot uses** — any parallel week state is a §9.3 violation. Same catalog entry as the History WeekStepper (the shell week clock). |
| Two-region layout (sessions left 1.7fr, heatmap right 1fr) | new | `TwoRegionDashboard` | `components/schedule/ScheduleTab.tsx` sub-tab structure | §4.2 | Same actionable-left/ambient-right pattern as Home; collapses ≤1180px; replaces `SCHED_SUB_TABS = ['sessions','availability','integrations']`. |
| Session card — next session (accent border + RSVP roster) | refine | `SessionRsvpCard` | `components/schedule/SessionCard.tsx` + `components/schedule/ScheduleUpcomingPanel.tsx` | §5.4; DS `surface-card`, `border-highlight`, `accent-dim` | Needs `.daypill`, `nexttag` badge, countdown chip, accent border + accent-dim header, role-colored `.rmember` RSVP grid. Shared with Home (which also folds in `NextRaidModule`). Uses `CardShell`. |
| Session card — later session (neutral variant) | refine | `SessionRsvpCard` | `components/schedule/SessionCard.tsx` | §5.4; DS `surface-card`, `border-default` | Same component as NEXT without accent; ghost RSVP buttons (unanswered); one component, prop/state differentiation. |
| Per-member RSVP mini-card (`.rmember`) | refine | `PlayerIdentity` | `components/ui/SafeAvatar.tsx` + role-color avatar treatment across `components/player/` | §4.1 role colors; §6 | RSVP-row variant of the canonical `PlayerIdentity` + status dot (in/tentative/out/no-answer); current SessionCard renders plain `rsvp.username` text. |
| "Your RSVP" button strip + contextual warning | refine | `SessionRsvpCard` | `components/schedule/SessionCard.tsx` | DS Button (primary/ghost/sm) | Three RSVP buttons exist (`available/tentative/unavailable`); add left label, spacer, contextual sub-warning. Fold into `SessionRsvpCard`, not standalone. |
| Create / edit session modal | existing | `components/schedule/CreateSessionModal.tsx` | — | DS Modal/Input/Select/Checkbox/Button (confirmed imports) | DS-conformant; handles create + edit; recurrence/tz/RSVP-toggle/Discord preview present. No changes. |
| Team availability heatmap (aggregated, read-only) | refine | `AvailabilityHeatmap` | `components/schedule/AvailabilityGrid.tsx` | §5.4; DS `surface-interactive` → `accent` density scale | Extract read-only heat-cell rendering + headers/labels from `AvailabilityGrid`; individual drag-to-paint editing is **removed** from Schedule, re-homed to Player Hub. `session-mark` overlay is **mockup-only / net-new sub-scope**, not an extraction. Aside cards use `CardShell`. |
| "Best times this week" recommendations card | refine | `AvailabilityHeatmap` | `components/schedule/AvailabilityRecommendations.tsx` + `components/schedule/TemplateRecommendations.tsx` | DS `surface-card`; mini bar pattern | Ranked windows + mini bar + n/N count; becomes a compact aside (named sub-section or sibling of `AvailabilityHeatmap`); both recommendation components collapse into this. Uses `CardShell`. |
| "Your availability" Person-layer edit prompt | new | `PersonLayerEntryPoint` | — | DS `surface-card`; Button ghost sm | Link-card: track medallion + "Your availability" + "Set once on your Player Hub — it feeds every static you're in." + Edit btn (remove trailing arrow per §4.1); structural signal that editing moved to Person layer; Schedule-local. |
| Schedule empty state (no sessions) | refine | `EmptyStateInvite` | `ScheduleTab.tsx:527-534` (hand-rolled raw `<div>` block) + `ui/EmptyState.tsx` | DS §3.2 Card `empty` variant; watchlist | **Corrected `existing`→`refine` (§B-T7):** `EmptyState` is **not** used here — confirmed the empty state is a bespoke raw block at `ScheduleTab.tsx:527-534`. Consolidate it + `ui/EmptyState` into the shared `EmptyStateInvite`. |

> **Retired from this screen (not tagged):** the Sessions/Availability/Integrations sub-tab toggle (`SCHED_SUB_TABS`) — replaced by the two-region layout; the availability drag-to-paint editor (`AvailabilityGrid` core) — re-homed to Player Hub; the Integrations panel (`ScheduleTab.tsx:607+`) — re-homed to top-bar Settings per §7.

---

## Deferred screens (light pass — no full table)

### Player Hub (deferred)

`design/redesign/mockups/05-player-hub.html` was reviewed in full. It is the Person-layer front door — no spine tabs, no static context in the top bar. The structural elements it implies (filler data skipped):

- **`AttentionRow`** *(shared with Ring-0 Home)* — the "Needs you · across your statics" card renders one `.needrow` per action, each tagged with its source static. Same action-row pattern Home uses within one static; on Player Hub the rows aggregate cross-statically. Canonical watchlist name applies; precursor is `player/PlayerSetupBanner`.
- **`TwoRegionDashboard`** *(shared with Ring-0 Home)* — the `.hub` two-column layout (`1.6fr / 1fr`, collapses at ≤1180px) is structurally the same actionable-left / ambient-right region Home uses. Canonical watchlist name applies.
- **`StaticSummaryCard`** — clickable card for each static the user belongs to: initials badge with accent border, static name + membership role chip, schedule/progress summary, avg-BiS percentage, "Enter" CTA. Not on the Ring-0 watchlist; not shared with Ring-0 screens. Possible precursors to check at build time: `static-group/StaticSwitcher.tsx`, `components/dashboard/MyStaticsPanel.tsx` (light-inspect only; confirm when building).
- **`PersonalAvailabilityCard`** — 7-day mini availability grid (set-once, feeds every static's schedule). Already exists at `components/profile/PersonalAvailabilityCard.tsx` + `PersonalAvailabilityEditor.tsx`; likely `existing` or minor `refine`. Distinct from the aggregated `AvailabilityHeatmap` (team view, Schedule screen).
- **`CharacterCard`** — character list row: avatar, display name, server/data-center, "MAIN" tag. Already exists at `components/profile/CharacterCard.tsx`; likely `existing` or minor `refine`.

Note: the `.idbanner` (large user-profile header — avatar, Discord linked chip, plugin-sync chip) is the user's own identity header, structurally distinct from the watchlist's `PlayerIdentity` (which is role-colored player treatment on roster/loot screens). It is a candidate for a `UserIdentityBanner` component but is Person-layer only; not catalogued here.

Re-validate when its ring is built.

### Static Finder (deferred)

`design/redesign/mockups/06-static-finder.html` was reviewed in full. It is a Ring-1 recruitment browse screen — two-column layout with a sticky filter sidebar on the left and ranked listing cards on the right. No watchlist components are shared with Ring-0 screens (the `AttentionRow` watchlist note "Home (Static Finder)" does not appear in the actual Static Finder mockup; the finder shows listing cards, not action rows for the viewer). Structural new components it implies:

- **`FinderFilterSidebar`** — sticky left sidebar (240px) with filter groups for Content, Role need (role-pill toggles), Schedule fit, and Vibe (checkbox options). No existing component covers this multi-group filter sidebar pattern. Deferred (Ring-1).
- **`StaticListingCard`** — ranked recruitment card: static initials badge, name/meta, match-score percentage (top-right), role-need pills (open slots + "your fit" highlight), schedule-fit match indicators (yes/partial bullets), schedule line, View and Apply CTAs. Absorbs no existing owned component; nearest precursor is `static-group/JoinRequestModal.tsx` (a different surface). Deferred (Ring-1). *(This realizes DS §3.8's "match-score listing.")*
- **`MatchBanner`** — accent-tinted summary bar above results stating match count, criteria used, and a sort control. Structurally distinct from `AttentionRow` and `EmptyStateInvite`. Deferred (Ring-1).

The "Leading a static instead?" CTA block (dashed-border, "Post a listing" button) is a persistent CTA rather than a true empty state; it is sub-element content of the finder results area and does not warrant a separate catalog entry at this ring.

Re-validate when its ring is built.

### Flow-map (not a screen)

`design/redesign/mockups/00-flow-map.html` is the IA architecture diagram rendered as an inline SVG — it is not a buildable screen and has no element table. It illustrates the two-layer model (Person layer hosting Player Hub + Static Finder → enter a static → Static layer Home / Roster / Loot / Schedule / Progress), the weekly loop flow (Roster → Schedule → Raid → Loot → Progress → next week), the one Progress Engine with multiple tracks (Savage Tier, Ultimate, Mount farm, Gear funnel), and the availability cross-layer feed (Person layer availability feeds Static layer Schedule). The one cross-screen flow component it explicitly implies is `CommandPalette` (⌘K — "the fast path over everything"), which belongs to Shell chrome element set #0 and is a Ring-0 component; it is catalogued there, not here. No additional buildable components are implied by the diagram beyond what the individual screen mockups surface.

Re-validate when its ring is built.

---

## New-component catalog

> One entry per **distinct not-yet-single owned shared component** the map calls for — sourced from `new` rows and consolidating/renaming `refine` rows, deduped via the §5.2 watchlist. Each = purpose · element sets · current component(s) it consolidates · **contract deferred to F6**. No props/state tables (that is F6). Pure token-fix refines (`PageHeader`, `LightPartyHeader`, the filter-pill compositions) earn no entry.

| # | Component | Tag origin | Purpose | Used by | Consolidates | |
|---|---|---|---|---|---|---|
| 1 | **TwoRegionDashboard** | new | Actionable-left / ambient-right two-region layout wrapper (collapses ≤1180px). | Home, Schedule (+ Player Hub) | — (no layout wrapper exists) | contract deferred to F6 |
| 2 | **CardShell** | new (consolidate) | The shared `surface-card` + radius + uppercase section-header shell. | Home, Roster-Cards, Roster-Board, Schedule | `ui/DashboardCard.tsx` + ~25-strong bespoke `*Card` family | contract deferred to F6 |
| 3 | **SegmentedToggle** | refine (consolidate) | One segmented view/density switch; also introduces the net-new Cards⇄Board view axis. | Roster-Cards, Roster-Board, Loot-Priority, Loot-History | `ui/GroupViewToggle.tsx` (grouping) + `ui/ViewModeToggle.tsx` (density) + `player/RosterViewToggle.tsx` (mobile density); related: `history/LogLayoutToggle.tsx` (list/grid, likely dropped) | contract deferred to F6 |
| 4 | **SessionRsvpCard** | refine (consolidate) | Session + per-member RSVP card (next/later variants). | Home, Schedule | `schedule/SessionCard.tsx` + `schedule/ScheduleUpcomingPanel.tsx` + `static-group/StaticHomeTab.tsx` `NextRaidModule` (`:456-558`) | contract deferred to F6 |
| 5 | **PlayerIdentity** | new (extract shared) | Role-colored name/avatar/job identity unit (card / board-cell / RSVP-row variants). | Roster-Cards, Roster-Board, Loot-Priority, Loot-History, Schedule | `player/PlayerCardHeader.tsx` inline identity (`:237-419`); reuses `ui/SafeAvatar.tsx` | contract deferred to F6 |
| 6 | **ProgressBar** | new | Configurable linear progress primitive (color = role \| gear-source \| accent). | Home, Roster-Cards | inline bar in `player/PlayerCard.tsx` + the `LightPartyHeader` party bar + `StaticHomeTab` `WeeklyProgressModule` role bars | contract deferred to F6 |
| 7 | **ProgressBarLegend** | new | Once-per-screen gear-source-colored legend (decoupled from the bar). | Home, Roster-Cards, Roster-Board | `StaticHomeTab` `WeeklyProgressModule` legend + `player/PlayerCardGear.tsx` inline legend | contract deferred to F6 |
| 8 | **CommandPalette** | new | ⌘K go-anywhere / do-anything / context-switch overlay. | Shell (flow-map) | `ui/KeyboardShortcutsHelp.tsx` (content absorbed) | contract deferred to F6 |
| 9 | **NotificationBell** | refine (consolidate) | Top-bar bell + unified unread badge (notifications + join requests). | Shell | `auth/NotificationCenter.tsx` + `auth/UserMenu.tsx` bell trigger/badge (`:216-228`) + `stores/notificationStore` + `layout/Header.tsx` settings-gear join badge (`:344-348`) | contract deferred to F6 |
| 10 | **EmptyStateInvite** | refine (consolidate) | Empty state that invites the next action. | Roster-Cards, Schedule (+ Loot) | `ui/EmptyState.tsx` + `player/EmptySlotCard.tsx` + `player/PlayerSetupBanner.tsx` (in-card) + `ScheduleTab.tsx:527-534` bespoke block | contract deferred to F6 |
| 11 | **StaticActivityFeed** | new | Static-layer event roll-up (drops / materials / mounts / plugin events). | Home | `static-group/StaticHomeTab.tsx` `deriveActivityItems` (`:160-305`) | contract deferred to F6 |
| 12 | **RosterReadinessCard** | new | Roster readiness summary (avg iLvl + % BiS + raider count + single bar). | Home | `static-group/StaticHomeTab.tsx` `WeeklyProgressModule` (`:560-656`) + `GroupHeroPanel` stat strip (`:919-941`) | contract deferred to F6 |
| 13 | **WeeklyLootSummaryCard** | new | Per-fight loot progress bars + "Log this week's loot" CTA. | Home | — | contract deferred to F6 |
| 14 | **AttentionRow** | new | One prioritized "needs you" action item. | Home (+ Player Hub) | `player/PlayerSetupBanner.tsx` + `group/MorePage.tsx` join-requests + `StaticHomeTab` `NotificationsModule` (`:340-454`) + `JoinRequestReviewModal` | contract deferred to F6 |
| 15 | **TrackCard** | new | Mini Progress-Engine track summary (icon + name + ring chip + bar). | Home | `mount-farms/MountFarmTab.tsx` + `mount-farms/MountFarmSummary.tsx` | contract deferred to F6 |
| 16 | **GearBoard** | new | The re-homed gearsheet matrix (rows=players, cols=slots; Split = a Board mode). | Roster-Board | `team/TeamSummaryEnhanced.tsx` + `group/GearSyncDashboard.tsx` + `split-clear/SplitClearPlanner.tsx` (+ Split sub-components) + legacy "Gear" surface | contract deferred to F6 |
| 17 | **GearBoardCell** | new (derived) | Per-slot board cell (have / need / need+priority), derived from the gear atom. | Roster-Board | `ui/GearStatusCircle.tsx` (atom) | contract deferred to F6 |
| 18 | **RecipientPicker** | refine (specialize/consolidate) | Unified eligible-player picker (priority-ordered scrim overlay); kills the forked log modals. | Loot-Priority, Loot-History | `loot/QuickLogDropModal.tsx` + `history/AddLootEntryModal.tsx` + `loot/LootRecommendationCandidates.tsx`; precursor `primitives/PopoverSelect.tsx` | contract deferred to F6 |
| 19 | **PriorityRow** | new | One player's priority standing chip for a slot. | Loot-Priority, Home | `loot/LootPriorityPanel.tsx` local `LootPriorityEntry` memo | contract deferred to F6 |
| 20 | **FloorCard** | new | Per-fight drop-grouping card (header + `FloorDropRow` list + collapsed state). | Loot-Priority | `loot/LootPriorityPanel.tsx` inline per-floor rendering | contract deferred to F6 |
| 21 | **FloorDropRow** | new | One item slot's drop row (source icon + name + `PriorityRow` queue + Assign). | Loot-Priority | `loot/LootPriorityPanel.tsx` inline `itemPriorities.map` / `materialPriorities.map` | contract deferred to F6 |
| 22 | **FairnessSummary** | new | Tier-wide loot-distribution aggregate stat strip. | Loot-History | `history/LootCountBar.tsx` | contract deferred to F6 |
| 23 | **WeekGroupHeader** | new | Per-week section header in the history table (pill + date range + count). | Loot-History | — (sub-component of `AllWeeksView`) | contract deferred to F6 |
| 24 | **AvailabilityHeatmap** | refine (consolidate) | Aggregated read-only availability grid + "best times" recommendations. | Schedule | `schedule/AvailabilityGrid.tsx` + `schedule/AvailabilityRecommendations.tsx` + `schedule/TemplateRecommendations.tsx` | contract deferred to F6 |
| 25 | **WeekNavigatorStrip / WeekStepper** | new + refine | The shell-bound week clock (one shared week object across Loot + Schedule). | Shell, Loot, Schedule | `history/WeekStepper.tsx` + `history/WeekSelector.tsx` | contract deferred to F6 |
| 26 | **PersonLayerEntryPoint** | new | Link-card signaling a capability moved to the Person layer (e.g. "Your availability"). | Schedule | — | contract deferred to F6 |

**Explicitly NOT catalogued (framing notes):**
- **PageHeader** — already exists at `layout/PageHeader.tsx`; every screen's page-header row is `refine`, never `new` (§A.1).
- **top bar / spine** — DS §3.8 lists these as "new", but they are realized as **refine-of-`Header.tsx`** and **refine-of-`TabNavigation.tsx`** (§A.8); no fresh mint.
- **FilterPill** — realized as a `Button(ghost)+PopoverSelect` composition, not a component (§B-T4).
- **LightPartyHeader** — single existing component getting a Substitutes variant + token fix; not a consolidation.
- **HistoryView / AllWeeksView** — `refine`-consolidations kept in the cross-screen consolidation map but **not** the catalog, because the owned component name is **unchanged** (an in-place refactor of an existing same-named component), not a renamed or newly-created shared component. The §6 catalog rule promotes only new/renamed owned shared components; the dedup contract for these still lives in the consolidation map, which is what F6 reads.

---

## Cross-screen consolidation map

> The "many predecessors → one owned component" dedup contract F6 executes, cross-checked against `REDESIGN_SPEC §7` re-homing (✅ keep · ♻️ re-home · 🔀 merge · 🗑️ delete).

| Owned component (F6) | Predecessors consolidated | §7 re-homing row |
|---|---|---|
| `RecipientPicker` | `loot/QuickLogDropModal.tsx` + `history/AddLootEntryModal.tsx` + `loot/LootRecommendationCandidates.tsx` (+ `LogWeekWizard` GearStep picker) | 🔀 Loot Log: Log → Loot |
| `GearBoard` | `team/TeamSummaryEnhanced.tsx` + `group/GearSyncDashboard.tsx` + `split-clear/SplitClearPlanner.tsx` (+ Split sub-components) + legacy "Gear" surface | ♻️ Gear concept → Roster Board; 🔀 Roster Split = Board mode; 🔀 Loot Sync/gear → Roster Board |
| `GearBoardCell` | `ui/GearStatusCircle.tsx` (atom; ad-hoc pips unified) | ♻️ Gear concept (DS §7 gap 2) |
| `SegmentedToggle` | `ui/GroupViewToggle.tsx` + `ui/ViewModeToggle.tsx` + `player/RosterViewToggle.tsx` (+ `history/LogLayoutToggle.tsx`, likely dropped) | — (DS §3.8 / governance rule 3) |
| `AttentionRow` | `player/PlayerSetupBanner.tsx` + `group/MorePage.tsx` join-requests + `StaticHomeTab` `NotificationsModule` + `JoinRequestReviewModal` | ♻️ More → Requests → Home attention list |
| `CardShell` | `ui/DashboardCard.tsx` + ~25 bespoke `*Card` | — (REDESIGN_SPEC §6) |
| `PlayerIdentity` | `player/PlayerCardHeader.tsx` inline identity (reuses `ui/SafeAvatar.tsx`) | — (REDESIGN_SPEC §6 player-identity invariant) |
| `SessionRsvpCard` | `schedule/SessionCard.tsx` + `schedule/ScheduleUpcomingPanel.tsx` + `StaticHomeTab` `NextRaidModule` | 🔀 Schedule/Calendar → Schedule |
| `NotificationBell` | `auth/NotificationCenter.tsx` + `auth/UserMenu.tsx` bell + `notificationStore` + Header settings-gear join badge | ♻️ More → Requests; ♻️ Header context switcher |
| `AvailabilityHeatmap` | `schedule/AvailabilityGrid.tsx` + `schedule/AvailabilityRecommendations.tsx` + `schedule/TemplateRecommendations.tsx` | 🔀 Schedule/Calendar → Schedule |
| `EmptyStateInvite` | `ui/EmptyState.tsx` + `player/EmptySlotCard.tsx` + `player/PlayerSetupBanner.tsx` + `ScheduleTab.tsx:527-534` block | — |
| `ProgressBar` | inline bar in `player/PlayerCard.tsx` + `LightPartyHeader` bar + `StaticHomeTab` `WeeklyProgressModule` role bars | ♻️ Gear → Home readiness |
| `ProgressBarLegend` | `StaticHomeTab` `WeeklyProgressModule` legend + `player/PlayerCardGear.tsx` legend | ♻️ Gear → Home/Roster readiness |
| `StaticActivityFeed` | `static-group/StaticHomeTab.tsx` `deriveActivityItems` | ♻️ More → Activity Log → Recent Activity (Home) |
| `RosterReadinessCard` | `StaticHomeTab` `WeeklyProgressModule` + `GroupHeroPanel` stat strip | ♻️ Gear → Home readiness |
| `TrackCard` | `mount-farms/MountFarmTab.tsx` + `mount-farms/MountFarmSummary.tsx` | ♻️ Tracking / Goals & Farms → tracks on Progress Engine |
| `FairnessSummary` | `history/LootCountBar.tsx` | ♻️ Loot Summary → Loot History |
| `HistoryView` (orchestrator) | `history/SectionedLogView.tsx` + `history/LootLogFilters.tsx` (toolbar) | ♻️ More → Loot History → Loot → History |
| `AllWeeksView` (record table) | `history/WeeklyLootGrid.tsx` + `history/UnifiedWeekOverview.tsx` + `history/LootLogPanel.tsx` | ♻️ Loot History → Loot → History |
| `PriorityRow` | `loot/LootPriorityPanel.tsx` `LootPriorityEntry` memo | 🔀 Loot Log: Priority → Loot |
| `FloorCard` / `FloorDropRow` | `loot/LootPriorityPanel.tsx` inline per-floor + drop rendering | 🔀 Loot Log: Priority → Loot |
| `WeekNavigatorStrip / WeekStepper` | `history/WeekStepper.tsx` + `history/WeekSelector.tsx` (shell shared clock) | ♻️ Header context switcher → week to top bar |
| `CommandPalette` | `ui/KeyboardShortcutsHelp.tsx` | — (DS §3.8; §4 lexicon for ⌘K affordance) |
| Top bar (`Header.tsx` refine) / `ContextSwitcher` | `static-group/TierSelector.tsx` + `layout/SettingsDockToggle.tsx` (gear) | ♻️ Header context switcher → static/track/week to top bar |
| Context rail (`AppRail.tsx` refine) | `layout/SidebarNav.tsx` (in-static rail role retired) | ♻️ Header context switcher → Player Hub/Finder to rail |
| Spine (`TabNavigation.tsx` refine) | `layout/SidebarNav.tsx` (in-static sidebar tabs → horizontal spine) | ♻️ Overview → Home (4-tab spine) |

**§7 rows consciously marked N/A (no Ring-0 component — Settings / admin / deferred):** Plugin tab → Player Hub/Settings; ↳ Lead Tools/Settings → top-bar gear (role-scoped Settings panel, kept); ↳ Integrations/Dalamud → Settings; ↳ Exports → Settings; ↳ Danger Zone → Settings → Static; ↳ Session History → Schedule (session list, Ring-1); Settings slide-out ✅ kept; Admin ✅ separate gated area.

---

## DESIGN_SYSTEM §7 open-gaps reconciliation

| # | §7 gap | Disposition |
|---|---|---|
| 1 | ✅ Trailing-arrow buttons | **Carried to F6** as conformance notes across rows ("Assign →", "Import →", "Enter →", "Take Ownership →" → plain action per §4.1). No catalog entry. |
| 2 | Gear cell duplication (ad-hoc pips → GearStatusCircle) | **Resolved → catalog `GearBoardCell`** (derives from `GearStatusCircle`) + Roster-Cards per-slot strip refine. |
| 3 | Recipient picker (one PopoverSelect specialization) | **Resolved → catalog `RecipientPicker`** (consolidates the two forked modals). |
| 4 | ⌘K affordance (platform-correct, font-safe) | **Resolved → catalog `CommandPalette`** + Shell ⌘K affordance row; §4 platform-aware label. Contract carried to F6. |
| 5 | Motion tokens (toggle, popover, tab, rail pill) | **Carried to F6 (v3.1 gap).** Flagged on AppRail pill, `SegmentedToggle` orb, `RecipientPicker` overlay. Not a catalog entry. |
| 6 | ✅ Context rail | **Resolved → `AppRail.tsx` refine** (Shell). Remaining `nav.*` component-tier tokens carried to F6. |
| 7 | New components (§3.8): top bar · spine · palette · heatmap · RSVP row · match listing · attention row | top bar = `Header.tsx` refine; spine = `TabNavigation.tsx` refine; palette = `CommandPalette` (cat); heatmap = `AvailabilityHeatmap` (cat); RSVP row = `SessionRsvpCard`/`PlayerIdentity` (cat); match listing = `StaticListingCard` (deferred Ring-1); attention row = `AttentionRow` (cat). All dispositioned. |
| 8 | Density (compact mode for the data-dense Board) | **Carried to F6.** Flagged on `GearBoard`. |
| 9 | Focus-visible spec (per-component ring width/offset) | **Carried to F6.** Flagged on the AppRail focus-state row. |
