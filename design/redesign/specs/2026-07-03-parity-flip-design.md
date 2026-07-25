# Parity Flip — Design Spec (v2 shell becomes the default group route)

**Status:** APPROVED — **user gave the FLIP GO 2026-07-03** (do the flip now; `main` frozen until the whole redesign is done; the flip lives on `redesign/foundation` only; prod-data testing at the end via a Railway DB copy). §8 go/no-go items adopted per decide+ratify doctrine. **P1 (readiness) IMPLEMENTED + MERGED** into foundation `7e0cb0d` (PR #171, 2026-07-03 — closes the §3–§5 parity gaps behind `?shell=v2`). **P2 (the flip) IMPLEMENTED + MERGED** into foundation `85610b7` (PR #172, 2026-07-03 — GroupRoute+Layout inverted atomically so v2 is the default group route; `?shell=legacy` escape hatch; `?shell=v2` no-op alias; `flip.spec.ts` 4/4 live; internal release note, `CURRENT_VERSION` stays 2.0.2). **P3 (legacy deletion) IMPLEMENTED + MERGED** into foundation `cf25c92` (PR #173, 2026-07-03 — user gave the P3 go-ahead; plan `design/redesign/plans/2026-07-03-flip-p3-legacy-deletion.md`). The v2 shell is the ONLY `/group` experience: legacy chrome + `?shell=` gate/escape hatch + all legacy-only tab bodies deleted (~25k lines); slots unconditional; GearSyncDashboard re-homed to PluginPage (§5.3 executed); e2e smoke rewritten to v2 selectors (the 6 pre-existing failures un-rotted; 15/15 live). **§6 inventory corrections (verified at implementation):** `Header`/`SettingsDockToggle`/`SettingsPanelController` are KEEPS (Layout mounts them on every non-group route — the spec wrongly listed them as dying); suppression prune was 3 edges/2 files, not "~9"; `RosterCharacterPanel`/`AvailabilityGrid`/`WeekStepper`/v2 `SessionList` are keeps; the SessionCard/SessionList name collision never existed. **§6 ❓ resolved (decide+ratify):** SplitClearPlanner DROPPED (subtree+store+wizard toggle; recoverable from git history); TeamSummaryEnhanced DROPPED (gear-% subsumed by GearBoard; per-player Books/Materials ledger = documented Ring-1 gap). **Ratify-at-pause items (now 5):** (P1) SettingsPanel `boundaries/dependencies` suppression 4→5; (P1) the legacy-visible Settings Integrations tab; (P2-D1) e2e smoke pinned to `?shell=legacy` + deep v2-selector rewrite deferred to P3 (supersedes §7's "migrate in P2"); (P2-D3) internal release note + no version bump (supersedes §7's "public entry + 2.1.0 at P2"); (P2) the cursor "legacy shell lost on static switch" decline. **Discovered in P2 (hand to P3):** the legacy e2e smoke suite has 6 PRE-EXISTING failures (proven identical on a `0139de2` base worktree) from F6-era legacy chrome/data drift — its v2-selector rewrite + un-rot lands with the P3 deletion.

**Inputs:** F6a–F6e all merged (foundation `13a1726`); legacy-surface + flip-debt inventories (2026-07-03, file:line-verified against `13a1726`); F6d/F6e flip-blocker ledgers (F6e spec §6.3); holistic "revisit when whole" list items 1–41 (memory `feedback_defer_holistic_review`).

---

## 1. Goal, shape, and non-goals

**Goal:** make the v2 shell (`NewShell`: AppRail · TopBar · 4-tab Spine · slots) the default `/group/:code` experience, then delete the legacy `GroupView` chrome — without losing any capability that has no other home, and without breaking any deep link in circulation.

**Shape — three sequential PRs, not one:**

| PR | Scope | Reversible? |
|---|---|---|
| **P1 — flip-readiness** | Fix the hard parity gaps (§3) **while legacy is still the default**. All fixes are v2-side additions; legacy untouched. Ships flag-gated like every F6 slice — zero user-visible change. | Trivially. |
| **P2 — the flip** | Invert `GroupRoute`: default → `NewShell`; `?shell=legacy` escape hatch **kept for one soak window**. Public release note + version bump. No deletions. | One-line revert (the gate default) + the escape hatch works the whole time. |
| **P3 — legacy deletion** | After the soak window: delete `GroupView` + legacy tab bodies + the escape hatch; suppressions prune; test migration completes. | Only by git revert; hence gated on soak. |

This shape exists because the two risk classes are different: P2's risk is "users see the new thing" (reversible, escape-hatched), P3's risk is "code is gone" (not). Collapsing them couples a taste decision to an irreversible deletion.

**Non-goals (explicitly NOT the flip):**
- Redesigning Tracking/Plugin/More surfaces (Rings 1–3 per PRODUCT_MODEL §7). The flip only decides where their **existing** UIs live (§4).
- The holistic design-polish pass (items 1–41) — the user may fold selected items into P1, but the flip does not require them.
- `redesign/foundation → main` (user-merged, separate).
- Person-layer rail destinations (Player Hub / Static Finder buttons stay stubs until Ring 1).

---

## 2. Current mechanics (what actually flips)

- `GroupRoute.tsx:8-12` — `?shell=v2` → `NewShell`, else `GroupView`. **The flip inverts this default.**
- `Layout.tsx:26-27,53,76` — suppresses legacy `Header` + `SettingsDockToggle` for v2. After P3 both branches and the `isGroupV2Shell` predicate collapse.
- `GroupViewContent` is SHARED: v2 mounts it with `slots={{overview,roster,gear,schedule}}`; slotless pageModes (`goals`/`plugin`/`more`) render their legacy bodies **inside the v2 shell already today** (reachable by URL and by mobile bottom nav — just no Spine tab). This is load-bearing for §4's recommendation.
- Global chrome (`ViewAsBanner`, `SettingsPanelController`, `GlobalSettingsPanel`, `KeyboardShortcutsHelp`) is route-agnostic in `Layout` — unaffected.

---

## 3. Hard parity gaps → the P1 work-list

Inventory-verified gaps that would be **silent breakage** the moment v2 is default. All are v2-side fixes; none touch legacy.

1. **`?viewAs=` is inert in v2** — only `GroupView.tsx:143-159` runs the `startViewAs`/`stopViewAs` side effect; `NewShell` never populates the store it reads. Admin View As breaks at flip. *Fix:* replicate the effect in `NewShell` (or better: hoist it into `GroupRoute`/a shared hook so ONE copy serves both during the soak).
2. **`?player=` deep link half-dead** — the shared effect (`GroupViewContent.tsx:231-257`) switches to roster and strips the param, but v2 `RosterCard` has no `player-card-{id}` anchor and no highlight. Shared player links (Discord embeds) silently no-op. *Fix:* anchor id + `highlight-pulse` on `RosterCard` (the F6d/F6e deep-link pattern, ~15 lines + test).
3. **v2 has no load/error/empty states** — `GroupViewContent.tsx:672` returns `null` without group+tier; all of GroupView's states (No-Tiers + `CreateFirstTierButton`, Group-Not-Found, private-group login error, generic error modal w/ bug-report link) render **blank** in v2. A brand-new static (zero tiers) is unusable in v2. *Fix:* port the four states into `NewShell` (new v2 components per the byte-for-byte rule; the copy can be reused).
4. **`JoinRequestBanner` + `AdminBanners` missing** — rendered only by `GroupView.tsx:414-436`. Owners stop seeing pending join requests at flip. *Fix:* mount both in `NewShell` (they're self-contained; likely direct reuse, not rebuilds — they're not "chrome being redesigned," they're floating banners).
5. **No Invite affordance in v2** — legacy Header owns the invite button + share-code UI; TopBar has none. Inviting is a core loop. *Fix:* decide the v2 home (TopBar action, Home card, or Settings→Members tab which already hosts invitations — **recommendation: a TopBar invite icon-button opening the existing invite modal**, smallest honest fix; ❓ ratify).
6. **Mobile chrome stacking** — v2 `AppRail` has no responsive hiding (`AppRail.tsx:141`), so small viewports get AppRail + Spine + `MobileBottomNav` simultaneously; legacy hides its rail on mobile. *Fix:* `hidden sm:flex` on AppRail (mirror `SidebarRail.tsx:42`) + a mobile pass over the Spine; decide whether `MobileBottomNav` (which still lists `goals`/`more`) remains v2's mobile nav for now (**recommendation: yes, unchanged, until a Ring-1 mobile pass**).
7. **Per-static navigation memory** — legacy restores last tab per static (`localStorage['static-nav-'+shareCode]`, `GroupView.tsx:198-212`) and records `recent-statics` (`:184-196`); v2's `StaticPicker` navigates bare. *Fix:* port both effects to v2 (they're storage effects, not chrome). Note the Settings "Reset tabs to default" toggle interacts with this — verify it governs the ported copy.
8. **Legacy sub-tab deep links** (`sched`/`avail`/`mf`/`stab`/`goal`/`farm`/`coll`) — those that target surfaces v2 keeps via slotless fallback (§4) keep working; those targeting deleted legacy bodies (e.g. `sched=calendar`) should degrade gracefully (land on the v2 Schedule, drop the param — no redirect table needed; ❓ accept).

**P1 exit test:** with `?shell=v2` forced, every §3 scenario passes in browser validation (View As round-trip; player deep link scroll+highlight; fresh no-tier static shows the empty state; join-request banner appears; invite flow completes; mobile viewport sane; tab memory restores).

---

## 4. The three slotless tabs (Tracking · Plugin · More)

The spine is locked at 4 tabs. The redesign re-homes these surfaces in Rings 1–3 — but the flip must not orphan them.

**Recommendation (❓ ratify): keep all three mounted via the existing slotless `GroupViewContent` fallback through P2/P3, and give them explicit v2 entry points:**
- **Command palette** gains three navigate entries (Tracking / Plugin / More) — 3 lines each, honest, no chrome redesign.
- **Home** may optionally surface Tracking via making `TrackCard` navigate (currently documented no-click); ❓ optional.
- `MobileBottomNav` already exposes goals/more on mobile — unchanged.
- Their legacy bodies (`GoalsPage`, `PluginPage`, `MorePage` + `ObjectiveGoalsPanel`, `CollectionsHub`, `mount-farms/*`, `ApiKeyManager`) move to the **keep-list** (§6) and are re-homed properly in Rings 1–3 (mount farms → Tracks detail per PRODUCT_MODEL; Plugin/API keys → Person layer or Settings; More dissolves).
- **MorePage-only capabilities to verify before P3:** "Exports"/"Activity Log" are Coming-soon placeholders (safe); **Danger Zone** (leave/archive/delete static) — confirm `StaticSettingsHost` covers all three actions in v2 (Plan M ties in here); if not, that's a P1 item.

The alternative — building v2 homes for all three now — re-scopes the flip into three more slices for surfaces the roadmap already re-homes later. Rejected.

---

## 5. Flip-blocker ledger (carried F6d/F6e §6.3) — dispositions

1. **Availability editing** (F6e #1): the only editor feeding the static heatmap is legacy `AvailabilityGrid` (inside `ScheduleTab`), which **dies at P3**. Options: (a) land the Person→Static aggregation pipe (backend, Ring 1) pre-flip; (b) re-host the static-week editor on the Player Hub availability tab (the entry point v2 already links to); (c) interim: give the heatmap's `PersonLayerEntryPoint` a second action that opens the legacy grid **in a modal** (import-only reuse, F6 pattern) until Ring 1. **Recommendation: (c) for P1 (small, honest, keeps the editor alive), with (a) as the Ring-1 follow-up.** ❓ ratify — this is the largest judgment call in the flip.
2. **Discord integrations panel** (F6e #2): `ScheduleTab`'s integrations sub-tab (mirror sync, guild link, reminders) dies at P3 with no v2 host. *Disposition:* re-home into `StaticSettingsHost` as an Integrations tab (its `can_manage` gating already matches) — **P1 item**, since it's a re-home of an existing panel, not a redesign. ❓ ratify.
3. **Gear `Sync` sub-tab** (carried F6d): `GearSyncDashboard` (plugin gear-sync dashboard) is a legacy gear sub-tab with no v2 slot equivalent. *Disposition options:* fold into the Plugin tab's surface (both are Dalamud-facing) or keep via a v2 Loot toolbar link until Ring 1. **Recommendation: reachable from the Plugin tab (§4 keeps it), plus a one-line pointer in the v2 Loot empty/summary area if desired.** ❓ ratify.

---

## 6. Deletion inventory (P3) and keep-list

**Dies at P3** (single-importer-verified): `pages/GroupView.tsx` (+ locals `HeaderEventBridge`/`ConnectedContent`/`CreateFirstTierButton` — the empty/error states having been PORTED in P1), `components/layout/Header.tsx` (+ `HEADER_EVENTS` after re-pointing `useGroupViewKeyboardShortcuts`'s settings dispatch to the store/context), `SidebarNav.tsx`, `SettingsDockToggle.tsx`, `SettingsPanelController.tsx` (dead once no dispatcher remains), `StaticHomeTab.tsx`, `PlayerGrid.tsx` + `RosterDragOverlay` + `RosterViewToggle`, `RosterCharacterPanel.tsx` (v2 uses `CharacterManageBridge` — verify), `SplitClearPlanner.tsx` (❓ split-clear capability: deferred out of F6c with "stays reachable on legacy" — at P3 that escape disappears; decide drop vs re-home before deletion), `GearSyncDashboard.tsx` (per §5.3), `LootPriorityPanel.tsx`, `HistoryView.tsx` tree (`SectionedLogView`, `AllWeeksView`, `WeeklyLootGrid`, …), `TeamSummaryEnhanced.tsx` (❓ team-summary capability — no v2 equivalent was ever scoped; decide drop vs Ring-1), `ScheduleTab.tsx` (+ `AvailabilityGrid` per §5.1, `QuickFillHelper`), `ScheduleUpcomingPanel.tsx`, legacy `SessionCard.tsx` + legacy `schedule/SessionList.tsx` (verify the v2 `components/schedule/SessionList.tsx` name-collision before deleting), `AdminBanners.tsx` (after its P1 re-mount — the re-mounted copy imports the same file, so actually **keep-list** if reused directly).
**Also at P3:** the `GroupRoute` gate + `?shell=` param + `Layout`'s `isGroupV2Shell` branches + all `!slots?.x` guards in `GroupViewContent` (slots become unconditional).

**Keep-list (v2 imports or slotless fallback):** `GroupViewContent.tsx` (shrinks: slot fallbacks deleted, keeps shared effects + goals/plugin/more bodies), `GoalsPage`/`PluginPage`/`MorePage` + their trees (§4), `AddPlayerModal`, `RolloverDialog`/`CreateTierModal`/`DeleteTierModal`, `StaticSettingsHost` machinery, `CreateSessionModal`/`OccurrenceListModal`, book/BiS modals, all hooks (`useGroupViewState`, `useUrlTabState`, `usePlayerActions`, `useGroupViewKeyboardShortcuts`), `SidebarRail` (Profile/DesignSystem use it), `MobileBottomNav`, all `ui/`+`primitives/`.

**Deletion-riding debt settled by P3:** 9 suppressions entries (GoalsPage×1 stays — keep-list! — recount at P3: `AllWeeksView`×2, `Header`×2, `SidebarNav`×2, `SettingsDockToggle`×1, `SettingsPanelController`×1 prune; `Layout`×1 shrinks), all inline `eslint-disable`/`design-system` headers in deleted files, the `ScheduleUpcomingPanel` light-mode debt (moot), `GroupViewContent.*` test files that characterize deleted fallbacks.

---

## 7. URL, release, tests, housekeeping

- **URL policy:** P2 makes bare `/group/:code` → v2; `?shell=legacy` renders GroupView during soak (exact param name ❓); `?shell=v2` becomes a no-op alias (kept parsing, so circulating links survive). All legacy `?tab=` aliases keep working (shared hook). F6e's Share/Discord links (`?tab=schedule&sessionId=`) work unchanged on the flipped default — the "migrate the link form" item dissolves.
- **Release/version (P2):** first user-facing redesign release — public entry + `CURRENT_VERSION` bump (2.0.2 → **2.1.0**; ❓ or 3.0.0 given the scale). One public entry summarizing the new shell (pr + prTitle per convention), leaving the internal F6 entries as history. P1/P3 stay internal-only.
- **Tests:** all 14 e2e smoke tests drive the legacy route (`goToTestStatic` navigates bare `/group/`) — after P2 they automatically hit v2, so **P2 must include the smoke-suite migration** (selectors: legacy header tabs → Spine; availability-grid drag test retargets the §5.1 disposition). Unit: `GroupViewContent.*` suites die at P3 with their subjects. The 2026-07-07 real-timer fixture time-bomb (F6e item) should be swept in P1 while suites are being touched.
- **Housekeeping (P1–P3, mostly P3):** DESIGN_SYSTEM.md backfill — contracts for the ~9 F6c/F6d components (`GearBoard`/`GearBoardCell`, `SegmentedToggle`, `RecipientPicker`, `FloorCard`, `PriorityRow`, `FairnessSummary`, `WeekScopeControl`, `LootHistoryTable`/`WeekGroupHeader`, `RosterCard`) + tick stale §7 ledger items 2/3; add `rview`/`lview` to `SEEDED_TAB_PARAMS` (real deep-link staleness bug, one line — P1); contrast harness: delete nothing (legacy was never assessed), decide the `LEGACY_ROLE_BADGE_SELECTORS` excludes (real v2 debt — `RosterCard` imports legacy `PositionSelector`/`TankRoleSelector`; shared-selector pass is post-flip polish), re-visit the design-system-page `test.skip`; NewShell slot-test scaffold consolidation (4 copies) when P3 touches those tests anyway.

---

## 8. Go/no-go inputs for the user (the ❓ list)

1. Three-PR shape (P1 readiness → P2 flip w/ escape hatch → P3 deletion after soak) — and the soak window length (recommendation: 1–2 weeks of your own raid nights).
2. Availability-editing disposition (§5.1 — recommendation: legacy grid in a modal for P1; Person→Static pipe in Ring 1).
3. Integrations → Settings re-home (§5.2) as a P1 item.
4. Tracking/Plugin/More: keep-via-fallback + palette entries (§4), redesign later.
5. Invite affordance home (§3.5 — recommendation: TopBar icon-button).
6. Split-clear planner + TeamSummaryEnhanced: drop, or keep reachable (§6)?
7. Version number for the public flip release (2.1.0 vs 3.0.0).
8. The holistic items 1–41: which (if any) block the flip vs land as post-flip polish.

**Estimated shape:** P1 ≈ one F6-slice-sized SDD run (the §3 list + §5.2/§5.1c + housekeeping one-liners); P2 small but test-heavy (gate inversion + smoke migration + release note); P3 mechanical deletion + prune, gated on soak.
