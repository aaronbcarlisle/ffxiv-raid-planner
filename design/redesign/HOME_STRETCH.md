# Home Stretch: now → V1 deletion

> **What this is.** The complete, sequenced list of what is left between today and deleting legacy V1, written 2026-09-30 (home-stretch session 2) off `main` `6aec8590`. The current state and the definition of done are in [PRODUCT_MODEL §6](../../docs/PRODUCT_MODEL.md#6-current-state-and-definition-of-done): that section states the state and the gates, and this doc states the order and the detail. Every open owner question was ruled in session 2 (HS-1…HS-25, §2). If new work turns up, add it here with its ruling. Never add it to another doc's status line.
>
> **How to use it.** Work the §4 items in order, or run them in parallel where §3 allows. When an item ships, tick it in §4 with its PR, update the §6.1 row it affects in PRODUCT_MODEL, and keep going. Run each build item with the `slice-loop` skill. An item marked **spec first** runs brainstorming → spec → owner-signed parity matrix → plan before any code, as Phase D did.

## 1. The finish line

Two gates, in order. The owner merged the old "un-gate" and "3.0.0" gates into one release (HS-25).

1. **Release 3.0.0: V2 is the default for everyone.** Every user is flipped to V2; no per-user choice is kept (HS-23). The only way back is a **"Switch back to legacy UI"** option in the user menu or Settings, with a mobile-reachable path (HS-24). The "Try the new UI" entry and the `isAdmin` gate are deleted. **Requires** every item in §4 up to and including R2: all owed parity rows executed, Stage 2, Stages 5–6, Phase F, H-10, the typical-week layer, Plan M, shell-switch telemetry, the mobile pass, Phase P, and the release plan. Admin V2 is not a prerequisite (HS-14).
2. **V1 deleted.** Requires all of: V2 the default for at least 4 weeks; a trailing-2-week switch-back rate under 10% (the telemetry in §4 T1 measures it; tune with data); V2's error-log rate no higher than V1's; zero open parity-tagged issues. Deletion re-runs the flip-P3 checklist with its verification steps actually executed (§4 D1). *(Ratified HS-6, amended by HS-25.)*

**Standing rules that still apply to every item:** no surface is replaced without an owner-reviewed affordance-parity matrix. The legacy path stays byte-identical until D1. Every V1-visible edit carries a sanctioned-edit justification and a release note. Every UI PR embeds screenshots. `xivrp-director` vets each slice (`V2_COVERAGE_PLAN.md` §5 hard gates).

## 2. Owner rulings (session 2, 2026-09-30)

These close every item in the session-1 decision list (groups A–E, 22 items). Older labels are cited as SF-OWNER-n (Stage 4) and AD-OWNER-n (Admin); new rulings are HS-n (HS-18).

| # | Question | Ruling |
|---|---|---|
| HS-1 | Plan shape | This one doc, now → V1 deletion, linked from PRODUCT_MODEL §6 |
| HS-2 | Spine tab count; is Progress a tab? | **Five tabs:** Home · Roster · Loot · Schedule · **Progress**. F-03 (2026-07-26) is reaffirmed. Progress is the tracks surface (Goals, Farms, Collections, Split Clears). Text that still says "four tabs" was written before the amendment and is corrected in this PR |
| HS-3 | Plugin's home | F-05 reaffirmed. Setup and the API key go in Player Hub, as a section inside "Characters & gear", not a new tab (the exact placement is a Stage 2 spec detail). The guide goes in Docs. The team Gear-Sync dashboard goes in the Roster area |
| HS-4 | Which owed parity rows gate the release | **All of them:** D-48, D-49, D-50, D-58, D-63, D-65, D-66, D-70, plus D-18, D-52, D-67 and D-68 via Stage 2. H-10 and the typical-week layer gate it too (HS-25) |
| HS-5 | The Phase P bar vs parity | The release needs **both**: parity (HS-4) and Phase P's first-impression bar. D-18 ships with Stage 2 |
| HS-6 | Ratify the proposed gates 2–3 | Ratified, then amended by HS-25 into the two gates in §1 |
| HS-7 | V1 bugfixes | **Approved** as one V1 bugfix bundle: the not-found flow, PlayerGrid/PlayerCard rejections, and clear-on-edit for BiS targets, goals and objectives. The heading-only fixes wait for V1 deletion |
| HS-8 | B9, the V1 roster re-render | Not fixed in V1; V1 deletion retires it. Phase F checks the V2 roster for the same pattern |
| HS-9 | D-50's home | The first parity slice (P1): the frontend guard plus the backend re-gate |
| HS-10 | PH2 F14 | Both kept as shipped: the conservative `loot_priority` skips, and the copy "{n}% of BiS slots" |
| HS-11 | Holistic carry list | Concrete defects go to Phase F; taste calls go to Phase P's pre-seeded punch list (§5.3) |
| HS-12 | Public `/docs/roadmap` | P1 fixes the Mobile phase status and drops the internal known issue. The release PR adds the "new interface" entry |
| HS-13 | Plan M (account delete + export) | Its own track; a release prerequisite |
| HS-14 | Admin V2 | AD2+ stays parked and gates nothing |
| HS-15 | Post-redesign rings | Ring work may start during the post-release soak, V2-only, and is not scoped here |
| HS-16 | Superseded docs | Stay in place; archived in D1 |
| HS-17 | #224's two log buttons | Judged live in Phase P (Loot page) |
| HS-18 | Colliding OWNER-n labels | Old notes stay as they are; cited with SF-/AD- prefixes; new rulings are HS-n |
| HS-19 | Card richness (#3) | Goes on Phase P's punch list |
| HS-20 | Sequencing | The small slices (P1, V1B) run first, in their own worktrees, while the Stage 2 spec is co-designed. The Home-module parity rows wait for Stage 2 |
| HS-21 | The plugin's off-hand mapping | A parallel plugin-repo track; it gates nothing |
| HS-22 | Telemetry | A shell-switch event log ships before the release; the thresholds are in §1 gate 2 |
| HS-23 | Default flip | Flip everyone; don't remember any per-user choice (only admins are on V2 today). The rollout is planned in detail when it's near (§4 R1) |
| HS-24 | The entry point (was D2) | "Try the new UI" is retired. After the release the entry is "Switch back to legacy UI" in the user menu or Settings. D2's `isGroupRoute` question is moot |
| HS-25 | Gate structure | Un-gate and 3.0.0 merge into one release (§1). The opt-in window and its "healthy telemetry" criterion are dropped |

## 3. Sequence at a glance

```
now ─ H0 this plan
   ├─ P1 safety + quick parity ──┐    (worktree)
   ├─ V1B V1 bugfix bundle ──────┤    (worktree)
   ├─ X1 hygiene ────────────────┤    (any time)
   └─ S2 Stage 2 spec (session 3) ─► S2a Progress ─► S2b More/Plugin ─► S2c mobile nav + B7
                                          │
            P2a Schedule rows ────────────┤ (any time after P1)
            P2b Home rows ◄───────────────┘ (after S2a)
   parallel once S2 is specced: M1 Plan M · H1 typical-week + H-10 · T1 telemetry · S5 docs · S6 ⌘K
   ─► F1–F3 Phase F ─► MP mobile pass ─► PP Phase P ─► R1 release plan ─► R2 RELEASE 3.0.0
   ─► soak ≥4 weeks (fix-only; ring work may start, HS-15) ─► D1 V1 deletion
off the path: Admin V2 (parked) · plugin off-hand (plugin repo) · rings (post-release)
```

Sizes: **S** is one PR under ~300 changed lines; **M** is one PR under ~1,500 (the repo's slice cap); **L** is several PRs, cut by its spec.

## 4. Items, in order

Each item lists its scope, dependencies, acceptance criteria, size and rulings. "Parity row executed" means the row's ruling is visible in V2 and the matrix row gets a ship marker with its PR.

### H0 · This plan (docs) — S
- **Scope:** this doc; PRODUCT_MODEL §6 rewritten to the two gates and linked here; the "four tabs" text written before the amendment corrected in REDESIGN_SPEC §11 #7 / review checklist, V2_COVERAGE Stage 2, RECONCILIATION B7 and the DESIGN_SYSTEM Spine contract; amendment notes where ROLLOUT §7b and V2_COVERAGE D7 describe the un-gate.
- **Acceptance:** the director says READY; merged; §6 links here; no owner question is left open.

### P1 · Safety + quick parity — S · HS-9, HS-12, HS-20
- **Scope:**
  - **D-50:** hide Delete Static under View As in `components/settings/StaticTab.tsx:305` and `MorePage.tsx:379-386`, matching Leave (`GroupViewContent.tsx:1191`). Backend: `DELETE` on a static refuses a request made under admin override (the §13.3 residual in the parity matrix).
  - **D-58:** a "View Schedule" link on Home's next-session card (`Home.tsx:331-335`).
  - **Home RSVP:** catch the rejection from `submitRsvp` (`Home.tsx:334`) and surface it.
  - **Public roadmap (`RoadmapDocs.tsx`):** Phase 9 Mobile → "planned (part of the new interface)"; drop the "Large component files" known issue.
- **Depends on:** nothing.
- **Acceptance:** a failing test first for each; under `?viewAs=`, neither surface shows Delete and the API returns 403 for an override delete; D-50 and D-58 get ship markers; public release note.

### V1B · V1 bugfix bundle — M · HS-7
- **Scope (V1-visible, sanctioned):**
  1. **Not-found flow:** a bad share code reaches "Static Not Found" in both shells. `fetchGroupByShareCode` clears a stale `currentGroup`, and `ShellContentStates.tsx:145` is ordered after `:175` (ROLLOUT §7 E1 carried list; ~60–90 lines).
  2. **Rejections:** `PlayerGrid`/`PlayerCard` catch and surface failed claim, release and reset.
  3. **Clear-on-edit:** BiS targets (`BiSTargetManagerModal:288-290`), goals and objectives (`GoalModal:142`) can be cleared, as #239 did for loot.
- **Depends on:** nothing.
- **Acceptance:** a test per bug that fails before the fix; legacy snapshots unchanged apart from the fixed behaviour; browser check in both shells; public release note.

### X1 · Hygiene (any time; small PRs) — S each
- Dependabot alert 83: `undici` → ≥6.28.1 via the surgical lockfile edit (memory: frontend CVE bumps).
- A CI guard that re-runs the uv `--universal` compile and fails if `backend/requirements.txt` changes (the Dependabot marker clobber).
- **Acceptance:** alert closed; the guard fails on a clobbered file in a test branch.

### S2 · Stage 2, the in-static IA collapse — L · **spec first** (session 3) · HS-2, HS-3, HS-20
**Spec-ready boundary.** Session 3 ends when three things exist: the Stage 2 spec, an owner-signed parity matrix for every surface it replaces (More page, `PluginPage`, `GoalsPage`/Tracking, `MobileBottomNav`), and the slice plan. No code before all three.

*Settled inputs (don't reopen):* F-01…F-12 (`specs/systems-flow-map.md:213-224`); HS-2; HS-3; D-18 → Progress ▸ Split Clears (R-41); D-52 (no More tab; Plugin isn't a tab); D-67 → one evolved Home TrackCard pointing into Progress (F-10); D-68 → a data-gated attention row on Home (F-11); D-71 drop; the Danger Zone moves to Settings ▸ Static as an approved V1-visible delta (F-12); a mobile-reachable shell switch must exist before the More card dies (F-12); the More dissolution table (`systems-flow-map.md:192-205`).

*The spec decides:* Progress's internal layout and sub-views; whether the orphaned `components/mount-farms/**` tree is revived or deleted (matrix §12-A9); the shared catalog browser mounted by both Player Hub and Progress; where exactly the Plugin setup section sits in Hub ▸ Characters & gear; the V2 mobile nav's shape (five tabs, plus how Settings and the shell switch are reached); the order of content-host extraction as `GroupViewContent` conditionals shrink; and the slice cut.

*Likely slices (the spec confirms):*
- **S2a · Progress tab:** the fifth spine tab; Goals/Farms/Collections; Split Clears with the Split Planner wired (D-18); the Home TrackCard pointer (F-10) and the split attention row (F-11); ⌘K `goals` retargeted.
- **S2b · More dissolution + Plugin:** re-home every More entry per the table. The Exports and Activity Log stubs are deleted. The Danger Zone goes to Settings ▸ Static. Plugin setup and the API key go into Player Hub, and the guide goes in Docs. `GearSyncDashboard` moves from `PluginPage` into the Roster area (KEPT P-2…P-7). The More route is removed from V2.
- **S2c · Mobile nav + B7:** a V2 mobile nav replaces `MobileBottomNav` under V2 (`GroupViewContent.tsx:1244`); off-spine reachability is removed (`:1140/1154/1219/1239`); a mobile-reachable shell switch (HS-24).
- **Acceptance (whole stage):** `Spine.tsx` renders five tabs; no V2 route reaches More, `PluginPage` or legacy Tracking; B4–B7 closed in RECONCILIATION; D-18, D-52, D-67 and D-68 get ship markers; the Spine contract in DESIGN_SYSTEM is updated; legacy is byte-identical except the approved Danger Zone delta.

### P2a · Schedule parity rows — M · HS-4
- **Scope:** **D-48**, session-card badges (category, Discord mirror/"Discord issue", reminder label). **D-49**, `BestTimesCard` gets "Copy proposal to Discord" plus the recurring/typical-week recommendations with duration quick-sets and "Create recurring session".
- **Depends on:** P1 (only for merge order); independent of Stage 2.
- **Acceptance:** both rows executed; the matrix rows get ship markers; browser check against the V1 equivalents.

### P2b · Home parity rows — M · HS-4, HS-20
- **Scope:** **D-63**, Home consumes `GET /api/static-groups/{id}/activity-log` again, with a view-all path (this also becomes the Activity Log's home from S2b). **D-66**, up to 3 official objectives with badges, an empty state and "+N more". **D-70**, Member Interest: suggestions with votes, "Suggest content →" for every role, the role-forked footer, `SuggestContentModal`. **D-65**, the Schedule-Farm handoff (a pre-filled `CreateSessionModal`) from the Goals surface, now on Progress, role-gated (A14).
- **Depends on:** S2a (Progress and the Home module layout).
- **Acceptance:** four rows executed with ship markers; the O-46 shared footer handled per the matrix seam note.

### M1 · Plan M, account delete + data export — M/L · **spec first** · HS-13
- **Scope:** self-serve "Download my data" and "Delete my account", from Player Hub or Settings (the spec picks). Starts from the archived plan `docs/archive/2026-06-27-pre-redesign/superpowers/plans/2026-06-27-self-service-leave-and-account-data-controls.md`.
- **The spec decides:** the export's contents and format; what happens to statics the user owns (require a transfer, or delete); how loot and log history that names the user is anonymised; whether there's a grace period; whether V1 gets the entry (a sanctioned edit) or it is V2-only.
- **Depends on:** nothing (backend-heavy; runs alongside Stage 2).
- **Acceptance:** endpoints with tests, including the permission and ownership cases; an alembic migration if the spec needs one (dialect and heads checks green); a browser check of both flows; a public release note.

### H1 · Availability: typical-week layer + H-10 — M/L · HS-4, HS-25
- **Scope:** (1) a timezone column on the static typical-week template, then the template as a layer in the availability pipe; this also fixes the quick-fill template copy's latent timezone bug. (2) **H-10:** a V2-native per-week exceptions editor that shows template-derived cells and stores the painter's timezone on dated rows; the Schedule stopgap modal (legacy `AvailabilityGrid`) is removed from V2. Spec: `specs/2026-09-25-player-hub-design.md:26,103-104,122,129`.
- **Depends on:** nothing; (1) before (2).
- **Acceptance:** the heatmap reads the template through the pipe; round-trip timezone tests; the V2 Schedule has no legacy modal; H-10 marked done in `V2_COVERAGE_PLAN.md`.

### T1 · Shell-switch telemetry — S · HS-22
- **Scope:** `analytics.track` events on every shell switch, both directions (`services/analytics.ts` already batches to `/api/analytics/events`); errors tagged with the shell; an admin readout (a query or a panel on the existing Usage Analytics page) giving the trailing-2-week switch-back rate and the error rate by shell.
- **Depends on:** nothing. It must ship before R2, so the soak is measured from day one.
- **Acceptance:** the events show up in the admin readout from a dev switch; the numbers are reproducible with a documented query.

### S5 · Stage 5, the docs light restyle — M
- **Scope:** the `/docs/**` pages restyled inside V2 chrome (tokens, type scale, a consistent `PageHeader`); the `/docs/design-system` page rebuilt so `contrast.spec.ts:178` stops skipping it. Admin is out of scope (HS-14).
- **Acceptance:** design-system strict clean; the contrast spec covers the page; screenshots light and dark.

### S6 · Stage 6, ⌘K actions — M/L · **spec first** (a short spec)
- **Scope:** `CommandPalette` gains actions beyond navigation, per REDESIGN_SPEC §3.4: log a drop, log the week, RSVP, who-needs-X. The spec rules each action's permission scope and confirmation.
- **Depends on:** S2 (the palette's navigation targets change there).
- **Acceptance:** each action works from the keyboard alone, is role-gated, and has tests; shortcut labels come from `lib/platform.ts`.

### F1–F3 · Phase F, chrome seams + carried items — L
- **F1, V2 defects (frontend):**
  - HS-11's defects: V2 Roster's applicant-review link (`onOpenRequests` is never used); "Live" shown on a paused or closed listing; PriorityRow's tooltip trigger isn't focusable; the save-error overlay policy (`tierStore.updatePlayer`) and Modal initial focus (`Modal.tsx:106-125`).
  - E1 carried: #8 the two "no BiS" signals and the D4 aggregate mismatch (`RosterCards.tsx:288`); #9 `currentSource`; #24 whole-store destructures; #27 `clearAllPageLedger`; #32 membership intersection; #38 the boundary-evening week; the `fetchCurrentWeek` race.
  - **R-D12-F cause 5**, the missing ledger anchor for a folded or hidden section.
  - The PH1 residuals.
  - HS-8's check of the V2 roster for the whole-roster re-render.
- **F2, backend carried from PH2:**
  - `loot_priority` under enhanced scoring and for the weapon (`player_overview.py:71-74,532-533`);
  - a Queues `floor=` deep link (`:581`);
  - the plugin `priority` endpoint ranking on raw settings, plus the `roleOrder == []` gap (`loot_tracking.py:1665`, `priority_calculator.py:305`), keeping the plugin contract;
  - `objective_goals.py:560-571`'s next session ignoring recurrence.
- **F3, enforcement, dead code and docs:**
  - user-menu items retargeted where V2 equivalents exist;
  - a knip dead-code sweep;
  - the contrast harness in CI, with the `Badge.tsx` exclusion resolved;
  - `--max-warnings` in `ci.yml`;
  - `no-tiny-text` reaching const class strings;
  - the `index.css` `aria-hidden` rule narrowed (`:239-243`);
  - a DESIGN_SYSTEM contract for the Finder card;
  - `home/`, `finder/` and `recruit/` rows in FRONTEND_STRUCTURE;
  - the suppressions count corrected (29 in 17 files);
  - CLAUDE.md Key Files and UI_COMPONENTS updated.
- **Depends on:** S2 and S6 for anything they touch; otherwise any time.
- **Acceptance:** each item closed, or ruled a residual by the owner (and then listed here); the ROLLOUT §7 carried lists are emptied into this doc's ticks.

### MP · The mobile pass — L · **spec first**
- **Scope:** the one consolidated V2 phone pass (ROLLOUT §7b, the ruling from 2026-07-26): density; toolbar reachability; breadcrumb overlap; **D-44** mobile loot logging (Loot ⇄ Books panels, the FABs); the D-42 Team Summary collapse; SegmentedToggle's 44px targets (#11); Hub tab swipe and the mobile tab nav; the V2 loading skeleton that still uses V1's centred frame. The S2c mobile nav is its foundation.
- **Depends on:** S2c, P2b, H1, S6 (so every mobile surface exists).
- **Acceptance:** D-44 executed; every in-static tab and every Hub tab usable at 390px; browser screenshots per surface.

### PP · Phase P, the beta-polish walkthrough — a process (§5)

### R1 · Release plan — docs, co-designed · HS-23, HS-24
- **Scope:** the owner asked to plan the rollout in detail when it's near. The release plan covers: timing and comms (release notes, Discord); where "Switch back to legacy UI" lives (the user menu, Settings, or both; how mobile reaches it); what the flip does to the `ui_shell` default and to the localStorage preference; the rollback lever if V2 misbehaves in the first days; what the soak watches daily.
- **Depends on:** PP under way.
- **Acceptance:** the owner signs it; its decisions are added to §2 as HS-n.

### R2 · Release 3.0.0 — M · §1 gate 1
- **Scope:**
  - Delete the admin-gated "Try the new UI" entries: `TryNewUiBanner` (`:30`, `:35`; mounted at `Header.tsx:326`, `:445`) and `UserMenu.tsx:341-356`.
  - Flip every user and the default to V2, per R1.
  - Rename or place "Switch back to legacy UI" per R1.
  - The public roadmap's "new interface" entry (HS-12).
  - `CURRENT_VERSION` 3.0.0 with a public release note.
- **Depends on:** every item above.
- **Acceptance:** every §1 gate-1 prerequisite ticked in this doc; a signed-out user, a new user and an existing user all land in V2; the switch-back works on desktop and mobile; T1 is recording.

### Soak · at least 4 weeks
V1 is fix-only; V2 gets fixes. Ring work may start, V2-only (HS-15). Read T1's numbers weekly.

### D1 · V1 deletion — L · §1 gate 2
- **Scope:** re-run `plans/2026-07-03-flip-p3-legacy-deletion.md`, correcting it for what has changed since:
  - `SplitClearPlanner` is now a keep (D-18);
  - `GearSyncDashboard` lives in Roster (S2b);
  - re-check D-P3-1…7 against the parity rulings;
  - `MobileBottomNav` is replaced (S2c).

  Also: delete "Switch back to legacy UI" and the `shell` plumbing; the V1 heading fixes and B9 are retired, not fixed (HS-7, HS-8); archive the superseded redesign docs to `docs/archive/` (HS-16).
- **Depends on:** gate 2's criteria met.
- **Acceptance:** the P3 land gate (build, lint, design-system strict, test, `tokens:check`, `git diff --check`, scripts tests); a zero-importer check per deleted file; live e2e smoke and contrast green; PRODUCT_MODEL §6 says V1 is deleted.

### Off the critical path
- **Admin V2 AD3+:** parked (HS-14). It owes the Appendix A sign-off before AD3 and a backup runbook before AD5/AD6a. Resume prompt in `SESSION_HANDOFF.md`.
- **Plugin off-hand (HS-21, plugin repo):** on plugin `main` `687b23a` (v0.4.1), enable index 1 in `GearsetService` and `InventoryService`, and map the off-hand to `offhand` in `LootDetectionService:162`. **Acceptance:** a PLD/GLA gearset syncs the shield to the off-hand slot the web app has had since #238/#240. It ships on the plugin's release cadence.
- **Rings (HS-15):** Ring 2 FFLogs, new Ring 3 tracks and strat references; after the release, each with its own spec.

## 5. Phase P, the process

The bar is **a first-time user's first impression**, on top of parity, which is already guaranteed by §4 (HS-5). Source: ROLLOUT §7b.

### 5.1 Pages to walk, in order
1. Landing and entry: `/` (L-1…L-3), create a static, and join by share code (guest view included).
2. In-static: Home, Roster (Cards ⇄ Board, Characters), Loot (Priority · Log · History), Schedule, Progress, and each Settings dock tab.
3. Person layer: the Player Hub's five tabs, the Static Finder, the Recruit home, the notification inbox, and the user menu.
4. Docs pages and the not-found and error states.
5. The mobile variant of each page above, walked after its desktop page.

Admin is not walked (HS-14).

### 5.2 How a page is walked
1. **Prepare:** the controller opens the page in the browser at desktop width, with a realistic static (the dev-auth recipe; the prod DB copy if it's available) and each role that sees it differently.
2. **Walk:** the owner calls out changes. Each goes on the page's punch list in `design/redesign/plans/phase-p-punch-list.md` (committed), with an ID `PP-<page>-n`.
3. **Fix:** a batch per page (or per few pages, under the 1,500-line cap) runs through `slice-loop` with the usual gates: tests where the fix is behavioural, screenshots per change, the director on shared code.
4. **Re-demonstrate:** each item is shown fixed in the browser. The page is accepted when the owner says **"next"**. An item may be deferred only by the owner, and the deferral is recorded on the list.
5. **Exit:** every page is walked and every item is fixed or deferred. R1 and R2 follow.

### 5.3 Pre-seeded punch-list items
Walk these on their page:
- #3 card richness (Roster, Hub);
- #20 materials-picker unification (Loot);
- #22 the accent-tint idiom (global);
- #34 the RSVP-row role seam (Schedule/Home);
- #40 the null-anchor strip (Schedule, `WeekNavigatorStrip.tsx:49-53`);
- the Hub tile 1 title against its body (Hub);
- #224's two log buttons (Loot, HS-17);
- D-60, Command Brief chips as clickable subtitle and prompt elements (Home).

## 6. Change log
- 2026-09-30: written (session 2). Rulings HS-1…HS-25.
