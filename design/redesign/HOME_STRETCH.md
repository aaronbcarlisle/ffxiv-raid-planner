# Home Stretch: now → V1 deletion

> **What this is.** The complete, sequenced list of what is left between today and deleting legacy V1, written 2026-09-30 (home-stretch session 2) off `main` `6aec8590`. The current state and the definition of done are in [PRODUCT_MODEL §6](../../docs/PRODUCT_MODEL.md#6-current-state-and-definition-of-done): that section states the state and the gates, and this doc states the order and the detail. Every open owner question is ruled (§2): HS-1…HS-25 in session 2, and HS-26…HS-31 on the questions director vets 1 and 2 raised. If new work turns up, add it here with its ruling. Never add it to another doc's status line.
>
> **How to use it.** Work the §4 items in order, or run them in parallel where §3 allows. When an item ships, tick it in §4 with its PR, update the §6.1 row it affects in PRODUCT_MODEL, and keep going; if a tick and §6.1 disagree, §6.1 wins (PRODUCT_MODEL §8). Run each build item with the `slice-loop` skill. An item marked **spec first** runs brainstorming → spec → owner-signed parity matrix → plan before any code, as Phase D did. An item marked **not a gate** runs in parallel and doesn't hold the release (HS-28).

## 1. The finish line

The two gates are defined in [PRODUCT_MODEL §6.2](../../docs/PRODUCT_MODEL.md#62-definition-of-done), and only there. This doc maps them onto §4:

- **Gate 1, release 3.0.0, is R2.** R2 requires every §4 item above it except those marked **not a gate** (V1B items 2–3 and X1, HS-28; F1's two admin-only items, HS-14). Admin V2 isn't a prerequisite (HS-14).
- **Gate 2, V1 deleted, is D1.** T1 measures its switch-back and error-rate criteria from R2's first day.

**Standing rules that still apply to every item:** no surface is replaced without an owner-reviewed affordance-parity matrix. The legacy path stays byte-identical until D1. Every V1-visible edit carries a sanctioned-edit justification and a release note. Every UI PR embeds screenshots. `xivrp-director` vets each slice (`V2_COVERAGE_PLAN.md` §5 hard gates).

## 2. Owner rulings (session 2, 2026-09-30)

These close every item in the session-1 decision list (groups A–E, 22 items). HS-26…HS-29 answer the four owner questions director vet 1 raised (its F4, F8, F12 and F1); HS-30 and HS-31 answer vet 2's Q1 and Q2. Older labels are cited as SF-OWNER-n (Stage 4) and AD-OWNER-n (Admin); new rulings are HS-n (HS-18).

| # | Question | Ruling |
|---|---|---|
| HS-1 | Plan shape | This one doc, now → V1 deletion, linked from PRODUCT_MODEL §6 |
| HS-2 | Spine tab count; is Progress a tab? | **Five tabs:** Home · Roster · Loot · Schedule · **Progress**. F-03 (2026-07-26) is reaffirmed. Progress is the tracks surface (Goals, Farms, Collections, Split Clears). Text that still says "four tabs" was written before the amendment and is corrected in this PR (glossary wording: HS-29) |
| HS-3 | Plugin's home | F-05 reaffirmed. Setup and the API key go in Player Hub, as a section inside "Characters & gear", not a new tab (the exact placement is a Stage 2 spec detail). The guide goes in Docs. The team Gear-Sync dashboard goes in the Roster area |
| HS-4 | Which owed parity rows gate the release | **All of them:** D-48, D-49, D-50, D-58, D-63, D-65, D-66, D-70, plus D-18, D-52, D-67 and D-68 via Stage 2. H-10 and the typical-week layer gate it too (HS-25) |
| HS-5 | The Phase P bar vs parity | The release needs **both**: parity (HS-4) and Phase P's first-impression bar. D-18 ships with Stage 2 |
| HS-6 | Ratify the proposed gates 2–3 | Ratified, then amended by HS-25 into the two gates in PRODUCT_MODEL §6.2 |
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
| HS-22 | Telemetry | A shell-switch event log ships before the release; the thresholds are in PRODUCT_MODEL §6.2 gate 2, the definitions in §4 T1 |
| HS-23 | Default flip | Flip everyone. The shell choice made before the release isn't migrated (only admins are on V2 today), and a switch-back made after it persists *(wording clarified by director vet 1)*. The rollout is planned in detail when it's near (§4 R1) |
| HS-24 | The entry point (was D2) | The admin-gated "Try the new UI" opt-in is retired: `TryNewUiBanner` is deleted, and the user-menu item stays for everyone, renamed (HS-26). After the release the V2→legacy entry is "Switch back to legacy UI" in the user menu or Settings. D2's `isGroupRoute` question goes to R1 *(amended by HS-26; this row first said the entry was retired and D2 was moot)* |
| HS-25 | Gate structure | Un-gate and 3.0.0 merge into one release (PRODUCT_MODEL §6.2). The opt-in window and its "healthy telemetry" criterion are dropped |
| HS-26 | Is there a legacy→V2 path after 3.0.0? (vet F4) | **Yes, for everyone.** R2 keeps the legacy user-menu item (`UserMenu.tsx:341-356`), drops its `user.isAdmin` gate and renames it (for example "Use the new UI"); `TryNewUiBanner` is still deleted. R1 settles the final label, whether the item shows off group routes (it's `isGroupRoute`-gated today) and how mobile reaches it. Switching back is never a one-way door. T1 also logs legacy→V2 returns |
| HS-27 | Does the past-sessions/attendance view gate 3.0.0? (vet F8) | **No.** It's a new feature, not parity: neither shell has one (`specs/systems-flow-map.md:127`, `:203`). More's "Session History" card only links to Schedule, so it dies in S2b with Schedule as its home. The view is listed under "After 3.0.0" (§4) |
| HS-28 | Are V1B and X1 release gates? (vet F12) | **Only V1B item 1, the not-found flow**, because it's broken in V2 too (`ShellContentStates.tsx`). V1B items 2–3 and all of X1 are **not a gate: run in parallel** |
| HS-29 | Glossary: Progress vs prog (vet F1) | **"Progress"** is the fifth spine tab, the tracks surface (Goals, Farms, Collections, Split Clears). **"Prog"** stays the status word ("Floor 3 prog"). DESIGN_SYSTEM §2.3 and REDESIGN_SPEC §10 carry a dated amendment |
| HS-30 | D-50's backend scope (vet 2 Q1) | **Only View-As deletes are refused.** P1 makes the client send the `X-View-As` header that `services/audit.py:140-145` already reads, and the backend refuses a static delete, and Leave (per the D-50 wording), only when that header is present. Admins keep moderation delete under `?adminMode` (`StaticTab.tsx:305`) |
| HS-31 | A11: "Mark floor cleared" in admin mode (vet 2 Q2) | **Keep V2's behaviour.** In admin mode, an admin whose real role in the static is member can mark a floor cleared in V2 but not in legacy. A declared delta, consistent with P-15 (`specs/v1-v2-parity-matrix.md:276`); no work item |

## 3. Sequence at a glance

```
now ─ H0 this plan
   ├─ P1 safety + quick parity ─────┐ (worktree)
   ├─ V1B item 1, not-found flow ───┤ (worktree; V1B's only gate, HS-28)
   └─ S2 Stage 2 spec (session 3) ─► S2a Progress ─► S2b More/Plugin + mobile switch ─► S2c mobile nav + B7
                                          └─► P2b Home rows
   parallel once S2 is specced: M1 Plan M · T1 telemetry · S5 docs · S6 ⌘K (after S2)
                                H1(1) typical-week tz ─┬─► H1(2) H-10 (spec first)
                                                       └─► P2a Schedule rows (also after P1)
   ─► F1–F3 Phase F ─► MP mobile pass ─► PP Phase P ─► R1 release plan ─► R2 RELEASE 3.0.0
   ─► soak ≥4 weeks (fix-only; ring work may start, HS-15) ─► D1 V1 deletion
not gates, in parallel: V1B items 2–3 · X1 hygiene (HS-28) · F1's admin-only items (HS-14)
off the path: Admin V2 (parked) · plugin off-hand (plugin repo) · rings and "After 3.0.0" (post-release)
```

Sizes: **S** is one PR under ~300 changed lines; **M** is one PR under ~1,500 (the repo's slice cap); **L** is several PRs, cut by its spec.

## 4. Items, in order

Each item lists its scope, dependencies, acceptance criteria, size and rulings. "Parity row executed" means the row's ruling is visible in V2 and the matrix row gets a ship marker with its PR.

### H0 · This plan (docs) — S
- **Scope:** this doc; PRODUCT_MODEL §6 rewritten to the two gates and linked here; the "four tabs" text written before the amendment corrected in REDESIGN_SPEC §11 #7 / review checklist, V2_COVERAGE Stage 2, RECONCILIATION B7 and the DESIGN_SYSTEM Spine contract; amendment notes where ROLLOUT §7b and V2_COVERAGE D7 describe the un-gate. Director vet 1 added dated amendments where DESIGN_SYSTEM §2.1/§2.3 and REDESIGN_SPEC §9.1/§10 still read "four tabs" or "Progress is never a tab" (HS-29), and where `docs/README.md`, ROLLOUT (the header note, §1, §8, §9) and V2_COVERAGE (the status line, Stage 5, D2, D7) still describe three gates; `xivrp-director.md` cites F-03 for Progress.
- **Acceptance:** the director says READY; merged; §6 links here; no owner question is left open.

### P1 · Safety + quick parity — S · HS-9, HS-12, HS-20, HS-30
- **Scope:**
  - **D-50, a V1-visible sanctioned edit scoped to View As (HS-30):** under View As, hide Delete Static in `components/settings/StaticTab.tsx:305` and `components/group/MorePage.tsx:379-386` (both shells mount both), matching Leave (`GroupViewContent.tsx:1191`). The client sends the `X-View-As` header only while `viewAsStore.viewAsUser` is set (View As state is per-static, `stores/viewAsStore.ts:20`, and clears when the group view unmounts, `hooks/useViewAsUrlSync.ts:38-44`); `services/audit.py:140-145` already reads it, but no client sends it today. When that header is present, the backend refuses a static delete (`static_groups.py:682`) and the View-As Leave. Under View As the client's Leave is `DELETE …/members/{viewed user id}` (`effectiveUserId`, `GroupViewContent.tsx:374`, `:1192-1194`), which the backend sees as an admin removing another member, not a self-removal, so the guard refuses `DELETE …/members/{user_id}` when `user_id` equals the header's user id (the value audit stores, `audit.py:145`). Other member removals under View As are not blocked (that would need a new ruling). This closes the §13.3 residual in the parity matrix. Admin-mode moderation delete (`?adminMode`, `StaticTab.tsx:305`) is unchanged: no admin UI deletes a static (`AdminStatics` has none; Admin V2 is parked, HS-14), so it stays the admins' moderation path. (Owners can also delete from `dashboard/MyStaticsPanel.tsx:284` and `profile/hub/YourStaticsCard.tsx:60`; neither is an admin path.)
  - **D-58:** a "View Schedule" link on Home's next-session card (`Home.tsx:331-335`).
  - **Home RSVP:** catch the rejection from `submitRsvp` (`Home.tsx:334`) and surface it.
  - **Public roadmap (`RoadmapDocs.tsx`):** Phase 9 Mobile → "planned (part of the new interface)"; drop the "Large component files" known issue.
- **Depends on:** nothing.
- **Acceptance:** a failing test first for each. D-50: under View As, Delete is hidden on both surfaces, and the API returns 403 for a static delete that carries `X-View-As`, and for `DELETE …/members/{user_id}` whose `user_id` equals the header's user id; admin-mode moderation delete still works (the button shows under `?adminMode` and the API deletes without the header); an admin's own delete outside View As (e.g. `profile/hub/YourStaticsCard.tsx:60`) still succeeds, because the header isn't sent (test); a browser check of each. D-50 and D-58 get ship markers; public release note.

### V1B · V1 bugfix bundle — M · HS-7, HS-28
- **Gate:** item 1 only (HS-28). Items 2–3 are **not a gate: run in parallel**, in this PR or a later one.
- **Scope (V1-visible, sanctioned):**
  1. **Not-found flow:** a bad share code reaches "Static Not Found" in both shells. `fetchGroupByShareCode` clears a stale `currentGroup`, and the branches in `ShellContentStates.tsx` let the error through: both the error branch (`:152`) and the not-found branch (`:182`) require `!currentGroup` today (E1 cited them as `:145`/`:175`), and frozen `GroupView.tsx` has the same shape (ROLLOUT §7 E1 carried list; ~60–90 lines).
  2. **Rejections:** `PlayerGrid`/`PlayerCard` catch and surface failed claim, release and reset.
  3. **Clear-on-edit:** BiS targets (`BiSTargetManagerModal:288-290`), goals and objectives (`GoalModal:142`) can be cleared, as #239 did for loot.
- **Depends on:** nothing.
- **Acceptance:** a test per bug that fails before the fix; legacy snapshots unchanged apart from the fixed behaviour; browser check in both shells; public release note.

### X1 · Hygiene — S each · **not a gate: runs in parallel** (HS-28)
- Dependabot alert 83: `undici` 6.28.0 → ≥6.28.1 in `scripts/package-lock.json`. That lock is npm, not the frontend's pnpm lock, so this is an npm lock update inside `scripts/`, not the surgical pnpm-lock edit.
- A CI guard that re-runs the uv `--universal` compile and fails if `backend/requirements.txt` changes (the Dependabot marker clobber).
- Parity matrix §12 A15: delete the stale comment in `components/group/PluginPage.test.tsx:4-5`, which says `GearSyncDashboard` has zero importers (`GroupViewContent.tsx:51` imports it).
- **Acceptance:** alert closed, scripts tests green; the guard fails on a clobbered file in a test branch; the comment is gone.

### S2 · Stage 2, the in-static IA collapse — L · **spec first** (session 3) · HS-2, HS-3, HS-20, HS-27, HS-29
**Spec-ready boundary.** Session 3 ends when three things exist: the Stage 2 spec, an owner-signed parity matrix for every surface it replaces (More page, `PluginPage`, `GoalsPage`/Tracking, `MobileBottomNav`), and the slice plan. No code before all three.

*Settled inputs (don't reopen):* F-01…F-12 (`specs/systems-flow-map.md:213-224`); HS-2; HS-3; HS-27; HS-29; D-18 → Progress ▸ Split Clears (R-41); D-52 (no More tab; Plugin isn't a tab); D-67 → one evolved Home TrackCard pointing into Progress (F-10); D-68 → a data-gated attention row on Home (F-11); D-71 drop; the Danger Zone moves to Settings ▸ Static as an approved V1-visible delta (F-12); a mobile-reachable shell switch must exist before the More card dies (F-12); the More dissolution table (`systems-flow-map.md:192-205`).

*The spec decides:* Progress's internal layout and sub-views; whether the orphaned `components/mount-farms/**` tree is revived or deleted (matrix §12-A9); the shared catalog browser mounted by both Player Hub and Progress; where exactly the Plugin setup section sits in Hub ▸ Characters & gear; the V2 mobile nav's shape (five tabs, plus how Settings and the shell switch are reached); the order of content-host extraction as `GroupViewContent` conditionals shrink; and the slice cut.

*Likely slices (the spec confirms):*
- **S2a · Progress tab:** the fifth spine tab; Goals/Farms/Collections; Split Clears with the Split Planner wired (D-18); the Home TrackCard pointer (F-10) and the split attention row (F-11), which opens the Split Planner itself (legacy's "Open Split Planner" lands on Roster, matrix §12 A13); ⌘K `goals` retargeted; the farm mutations get role checks (§12 A7: `G-13` LogDropModal, `G-21` per-reward Track and `G-22` TrackFromCatalogModal have none).
- **S2b · More dissolution + Plugin:** re-home every More entry per the table, with two corrections. **Requests** goes to the Recruit home (`/group/:code/recruit`), not Settings ▸ Recruitment ▸ Requests: RH1 moved V2's recruitment there and the V2 dock hides the Recruitment tab (`plans/2026-09-28-rh1-recruit-home.md:260`; D-69's keep-v2 ruling still holds). **Session History** dies with Schedule as its home (HS-27). The Exports and Activity Log stubs are deleted (§12 A17; V1's copies go at D1). The Danger Zone goes to Settings ▸ Static. Plugin setup and the API key go into Player Hub, and the guide goes in Docs. `GearSyncDashboard` moves from `PluginPage` into the Roster area (KEPT P-2…P-7), and its "Team Summary" shortcut is wired to Home's Team Summary or removed (§12 A10: `PluginPage.tsx:85` never passes `onViewStats`). **A mobile-reachable V2→legacy switch ships in S2b**, before or with the More route's removal: the More card is V2's only mobile path today (V2M-11), and F-12 makes the switch a hard precondition. The More route is removed from V2.
- **S2c · Mobile nav + B7:** a V2 mobile nav replaces `MobileBottomNav` under V2 (`GroupViewContent.tsx:1244`); off-spine reachability is removed (`:1140/1154/1219/1239`); the nav may re-home S2b's shell switch (HS-24).
- **Acceptance (whole stage):** `Spine.tsx` renders five tabs; no V2 route reaches More, `PluginPage` or legacy Tracking; the V2→legacy switch works at 390px before More is gone; B4–B7 closed in RECONCILIATION; D-18, D-52, D-67 and D-68 get ship markers; the Spine contract in DESIGN_SYSTEM is updated; legacy is byte-identical except the approved Danger Zone delta.

### P2a · Schedule parity rows — M · HS-4
- **Scope:** **D-48**, session-card badges (category, Discord mirror/"Discord issue", reminder label). **D-49**, `BestTimesCard` gets "Copy proposal to Discord" plus the recurring/typical-week recommendations with duration quick-sets and "Create recurring session".
- **Depends on:** P1 (only for merge order) and H1(1): D-49's recurring/typical-week recommendations read the static template, whose timezone H1(1) adds. Independent of Stage 2.
- **Acceptance:** both rows executed; the matrix rows get ship markers; browser check against the V1 equivalents.

### P2b · Home parity rows — M · HS-4, HS-20
- **Scope:** **D-63**, Home consumes `GET /api/static-groups/{id}/activity-log` again, with a view-all path (this also becomes the Activity Log's home from S2b). That feed only records farm events today (`models/activity_log.py:31`; only `routers/mount_farms.py` writes it), while V2's client-side feed also shows loot and material rows (`utils/lootActivity.ts`, `utils/staticActivity.ts`). P2b keeps those rows, by merging the two feeds or by adding backend writes for loot and material events (the plan picks). **D-66**, up to 3 official objectives with badges, an empty state and "+N more". **D-70**, Member Interest: suggestions with votes, "Suggest content →" for every role, the role-forked footer, `SuggestContentModal`. **D-65**, the Schedule-Farm handoff (a pre-filled `CreateSessionModal`) from the Goals surface, now on Progress, role-gated (A14).
- **Depends on:** S2a (Progress and the Home module layout).
- **Acceptance:** four rows executed with ship markers; the Home feed shows farm, loot and material rows; the O-46 shared footer handled per the matrix seam note.

### M1 · Plan M, account delete + data export — M/L · **spec first** · HS-13
- **Scope:** self-serve "Download my data" and "Delete my account", from Player Hub or Settings (the spec picks). Starts from the archived plan `docs/archive/2026-06-27-pre-redesign/superpowers/plans/2026-06-27-self-service-leave-and-account-data-controls.md`.
- **The spec decides:** the export's contents and format; what happens to statics the user owns (require a transfer, or delete); how loot and log history that names the user is anonymised; whether there's a grace period; whether V1 gets the entry (a sanctioned edit) or it is V2-only.
- **Depends on:** nothing (backend-heavy; runs alongside Stage 2).
- **Acceptance:** endpoints with tests, including the permission and ownership cases; an alembic migration if the spec needs one (dialect and heads checks green); a browser check of both flows; a public release note.

### H1 · Availability: typical-week layer + H-10 — M/L · (2) **spec first** · HS-4, HS-25
- **Scope:** (1) a timezone column on the static typical-week template, then the template as a layer in the availability pipe; this also fixes the quick-fill template copy's latent timezone bug. (2) **H-10:** a V2-native per-week exceptions editor that shows template-derived cells and stores the painter's timezone on dated rows; the Schedule stopgap modal (legacy `AvailabilityGrid`) is removed from V2. Spec: `specs/2026-09-25-player-hub-design.md:26,103-104,122,129`.
- **(2) is spec first:** before the stopgap leaves V2, an owner-signed parity matrix of legacy `AvailabilityGrid`'s affordances: painting, quick-fill and `TemplateRecommendations`.
- **Depends on:** nothing; (1) before (2). P2a waits on (1).
- **Acceptance:** (1) the heatmap reads the template through the pipe; round-trip timezone tests. (2) the matrix is signed; a browser demo walks the V2 editor through every matrix row; the V2 Schedule has no legacy modal. Both: every alembic migration passes `backend/scripts/check_migration_heads.py` and `check_migration_dialect.py`; PRODUCT_MODEL §6.1's Stage 3 row is updated.

### T1 · Shell-switch telemetry — S · HS-22, HS-26
- **Scope:** the `ui_shell_toggle` event already fires on every switch, both directions, with its surface (`hooks/useShellToggle.ts:17-20`), and events carry the user (`routers/analytics.py:115`). T1 adds: the shell as a property of `page_view` (`App.tsx:146`) and of every error report (`services/errorReporter.ts` → `/api/analytics/errors`, which records no shell today); the surfaces R2 creates (the renamed legacy→V2 item, the switch-back) in the surface union; and an admin readout (a documented query, or a panel on the existing Usage Analytics page).
- **Definitions** (trailing 14 days, signed-in users; guests are reported separately, since they can't be de-duplicated):
  - *switch-back rate* (the gate-2 figure, measured from R2) = signed-in users active in the window whose last `page_view` in it is legacy ÷ all signed-in users active in the window. A user who switched back before the window and stayed on legacy still counts;
  - *new switch-backs* (secondary) = users with a `to-legacy` `ui_shell_toggle` in the window;
  - *return rate* (HS-26, reported, not a gate) = users with a `to-v2` toggle in the window ÷ users with at least one legacy `page_view` in the window;
  - *error rate by shell* = error reports tagged with the shell ÷ `page_view`s tagged with the same shell, per 1,000;
  - *V1 baseline:* V1's error rate over the 14 days before R2, while V1 is everyone's default, recorded in this doc. Gate 2 compares V2's rate with it.
- **Depends on:** nothing. It ships at least 14 days before R2, so the baseline exists and the soak is measured from day one.
- **Acceptance:** a dev switch in each direction shows up in the readout; every figure above is reproducible with the documented query; the V1 baseline is recorded here before R2.

### S5 · Stage 5, the docs light restyle — M
- **Scope:** the `/docs/**` pages restyled inside V2 chrome (tokens, type scale, a consistent `PageHeader`); the `/docs/design-system` page rebuilt so `contrast.spec.ts:178` stops skipping it. Admin is out of scope (HS-14).
- **Acceptance:** design-system strict clean; the contrast spec covers the page; screenshots light and dark.

### S6 · Stage 6, ⌘K actions — M/L · **spec first** (a short spec)
- **Scope:** `CommandPalette` gains actions beyond navigation, per REDESIGN_SPEC §3.4: log a drop, log the week, RSVP, who-needs-X. The spec rules each action's permission scope and confirmation.
- **Depends on:** S2 (the palette's navigation targets change there).
- **Acceptance:** each action works from the keyboard alone, is role-gated, and has tests; shortcut labels come from `lib/platform.ts`.

### F1–F3 · Phase F, chrome seams + carried items — L
Each F1, F2 and F3 item says whether its fix is **V2-only** or **sanctioned V1** (a shared file V1 renders: it needs the sanctioned-edit justification and a release note). F3's shared-file edits are sanctioned V1 and behaviour-neutral, with legacy snapshots unchanged; F3 items without a label (jscpd, `--max-warnings`, the docs items) are tooling or docs and change no V1 render.
- **F1, V2 defects (frontend):**
  - HS-11's defects:
    - V2 Roster's applicant-review link (`onOpenRequests` is never used; RH1 plan :269) — V2-only;
    - "Live" shown on a paused or closed listing (RH1 plan :265; `home/Home.tsx:324`, `recruit/RecruitHeader.tsx:40`, `recruit/ListingTab.tsx:30`) — V2-only;
    - PriorityRow's tooltip trigger isn't focusable (`ui/PriorityRow.tsx`; only V2 loot imports it) — V2-only;
    - the save-error overlay policy: `tierStore.updatePlayer` sets the global `error` on any failed update, and both shells render the overlay — sanctioned V1 (shared store), unless the plan picks a V2-only caller-side policy and says so;
    - Modal initial focus lands on `Checkbox`'s `sr-only` input (`Modal.tsx:106-125`) — sanctioned V1 (shared primitive).
  - E1 carried:
    - #8 the two "no BiS" signals and the D4 aggregate mismatch (`RosterCards.tsx:288`) — V2-only if the fix stays in `bisSlotTotals` and `playerBisProgress` (only V2 imports them); sanctioned V1 if it touches `bisCompleteCount` or `rosterAvgIlv` in `utils/rosterReadiness.ts`, which legacy `StaticHomeTab.tsx:46` imports (legacy Overview mounts it, `GroupViewContent.tsx:905-909`);
    - #9 the `currentSource` recalc (`player/BiSImportModal.tsx:415-425`) — sanctioned V1;
    - #24 whole-store destructures (`LogWeekWizard/index.tsx:96`, `QuickLogMaterialModal.tsx:333`; legacy `LootPriorityPanel` mounts both) — sanctioned V1, behaviour-neutral;
    - #27 `clearAllPageLedger`'s player set (`stores/lootTrackingStore.ts:516`) — sanctioned V1;
    - #32 the schedule membership-intersection family (`schedule/scheduleWeek.ts`, `AvailabilityHeatmap.tsx`; only V2's `Schedule.tsx` imports them) — V2-only;
    - #38 the boundary-evening week — the holistic list names it without a location (E1 plan :281); the F1 plan locates and labels it, and if it can't, the owner closes it as a residual;
    - the `fetchCurrentWeek` stale-response race (`stores/lootTrackingStore.ts:303`) — sanctioned V1.
  - **R-D12-F cause 5**, the missing ledger anchor for a folded or hidden section — V2-only.
  - The PH1 test and polish residuals (ROLLOUT §7 "Carried out of PH1") — V2-only.
  - HS-8's check of the V2 roster for the whole-roster re-render — V2-only.
  - RH1 residuals (`plans/2026-09-28-rh1-recruit-home.md:264-272`, besides the two above):
    - the same-tab TopBar Invite leaves a dead Back entry — V2-only;
    - a failed invitations fetch shows "No invitations yet." and never reads the store's `error` (`recruit/InvitesTab.tsx:151`) — V2-only;
    - the shared `Checkbox` has no accessible name (the Finder too), and `DiscoveryTab`'s role toggles are unnamed — sanctioned V1 (`ui/Checkbox`, `settings/DiscoveryTab.tsx`);
    - a declined request reads as still active and Request to Join is never re-offered (`JoinRequestBanner`, both shells: sanctioned V1; `FinderCard`: V2-only), and the dossier's "Maybe Later" marks the request under review instead of closing it;
    - `NotificationCenter` builds the V2 href by string append, and `DiscoveryTab` re-renders on URL writes through `useResolvedShell` — sanctioned V1 (both shared).
  - SF1 residuals (`plans/2026-09-27-sf1-static-finder.md:648-650`):
    - (a) `DiscoveryTab.tsx:819` fills `timezone` only when it's empty, so a form already set to another zone mislabels the auto-filled times — sanctioned V1 (V1 `RecruitmentTab` and V2 `recruit/ListingTab` both mount it);
    - (b) "Post a listing": `openSettings({section})`'s `initialSection` handoff loses to same-commit URL writes (`hooks/useGroupViewState.ts`, `settings/RecruitmentTab.tsx`; SF1c works around it by seeding `?rcsub=listing`). RH1 closed it for V2, which sends recruitment settings to `/recruit` (`specs/2026-09-27-recruit-home-design.md:127`; RH1 plan :260), so only V1 reaches it and it retires at D1;
    - (c) logged-out Finder polish → Phase P (the Finder walk); Finder mobile → MP; reverse matching is new build → "After 3.0.0"; the lead-side home shipped as RH1.
  - From `V2_COVERAGE_PLAN.md:5`: the M6 desktop pre-hydration skeleton sits in the top bar while the authed menu resolves to the rail footer — V2-only; the `/admin` spurious ~17px scrollbar — V2-only and admin-only, **not a gate (HS-14)**.
  - The AdminOverview initials chip (queued 2026-08-22), admin-only and **not a gate (HS-14)**: **UNVERIFIED.** A code check on 2026-09-30 finds no `aria-hidden` anywhere in `pages/admin/AdminOverview.tsx`, and the chip at `:431-433` is a flex-centred `div` (the file is unchanged since #80), so the recorded cause (the `index.css` `aria-hidden` rule) can't apply. A browser look at `/admin/overview` confirms or closes it.
  - Parity matrix §12 rows homed here (triage below): A5's V2 check, A6.
- **F2, backend carried from PH2:**
  - `loot_priority` under enhanced scoring and for the weapon (`player_overview.py:71-74,532-533`) — V2-only (`/api/player/overview` feeds only the V2 Hub);
  - a Queues `floor=` deep link (`:581`) — V2-only;
  - the plugin `priority` endpoint ranking on raw settings, plus the `roleOrder == []` gap (`loot_tracking.py:1665`, `priority_calculator.py:305`) — a plugin-contract change, kept backward-compatible; no UI in either shell;
  - `objective_goals.py:560-571`'s next session ignoring recurrence — no live consumer today: `objectiveCommandStore`, its only reader, is used only by `ObjectiveCommandCenter.tsx`, which has zero importers. Fix it if P2b's D-66 consumes the endpoint; otherwise F3's knip sweep deletes the dead reader and this item closes.
- **F3, enforcement, dead code and docs:**
  - user-menu items retargeted where V2 equivalents exist (`auth/UserMenu.tsx` renders in both shells: sanctioned V1 unless gated on `inV2Chrome`);
  - a knip dead-code sweep, including matrix §12 A9's survivors (`history/WeekSelector.tsx` with zero importers, `GearSourceBadge` used only by the design-system page, `GearTable`'s `compact` branch at `:538`) and A8's unreachable `edge-*` drop-zone code (`dnd/useDragAndDrop.ts:288-303`) — sanctioned V1 for `GearTable.tsx` and `useDragAndDrop.ts` (shared), behaviour-neutral;
  - matrix §12 A2: 7 of the 9 `eventBus` listeners in `services/analytics.ts:50-58` have no emitter (only `player_gear_changed` and `member_role_changed` fire); rewire or delete them (T1 may rewire what it needs) — sanctioned V1 (shared service), behaviour-neutral;
  - jscpd back to main's count (RH1 added a clone pair: 340 against 339);
  - the contrast harness in CI, with the `Badge.tsx` exclusion resolved — the exclusion covers the shared legacy `PositionSelector`/`TankRoleSelector` role badges (`frontend/e2e/contrast.spec.ts:206-215`, about 3.4–4.0:1): sanctioned V1 and V1-visible if resolved by a style change (release note, light and dark shots); keeping a documented exclusion changes no render;
  - `--max-warnings` in `ci.yml`;
  - `no-tiny-text` reaching const class strings — the rule is tooling, but fixing the shared consts it flags is sanctioned V1 and V1-visible (release note, light and dark shots);
  - the `index.css` `aria-hidden` rule narrowed (`:239-243`; both shells: sanctioned V1);
  - a DESIGN_SYSTEM contract for the Finder card;
  - `home/`, `finder/` and `recruit/` rows in FRONTEND_STRUCTURE;
  - the suppressions count corrected (29 in 17 files);
  - CLAUDE.md § Map and UI_COMPONENTS updated;
  - REDESIGN_SPEC §7's drop corrections (re-homings the parity rulings reversed) and the "broken REDESIGN_SPEC link" (ROLLOUT §7 :302-304). A link check on 2026-09-30 found every link in and to REDESIGN_SPEC resolving, so F3 finds the one meant or closes it as already fixed;
  - E1 #11's Export half: S2b deletes the Exports stub, and a static-data export is new build → "After 3.0.0" (F-12: "Stub — delete card, note in backlog", `systems-flow-map.md:201`). The Split planner half is D-18 (S2a).
- **Parity matrix §12 A2–A17, triaged against code 2026-09-30** (`specs/v1-v2-parity-matrix.md:552-577`):
  - A2 → F3. A3, the legacy Loot Priority `Alt+1/2/3` tooltips (`LootPriorityPanel.tsx:523,546,569`) → legacy-only, retires at D1. A4, the legacy loot sub-tab reset (`useGroupViewState.ts:332`, feeding only legacy `LootPriorityPanel`) → retires at D1.
  - A5, blank states (L-05, R-183, O-02) → the legacy instances retire at D1; F1 checks V2 Roster and Loot with zero players.
  - A6, viewers can Roll/Reroll a weapon tie (`WeaponPriorityList.tsx:294-299`, not gated by `showLogButtons`; V2 mounts it through `WeaponPriorityBridge`) → F1; sanctioned V1, or a V2-only prop.
  - A7 → S2a. A8 and A9 → F3 (A9's `mount-farms/**` tree → the S2 spec). A10 → S2b.
  - A11 → kept as V2 has it (HS-31), no work item. V2's "Mark floor cleared" gates on `canEdit` (`BookLedgerCard.tsx:299`), which includes admin-mode access (`useStaticPermissions.ts:54-57`); legacy adds `userRole !== 'member'` (`SectionedLogView.tsx:1472`). The two diverge only for an admin in admin mode whose real role in the static is member: a declared delta, like P-15 (`specs/v1-v2-parity-matrix.md:276`).
  - A12, legacy Overview omits `isAdminAccess` (`GroupViewContent.tsx:915`) → retires at D1; V2 Home takes `canEdit` from `useStaticPermissions`, which includes it (`NewShell.tsx:66,79`).
  - A13 → retires at D1; S2a's attention row opens the Split Planner itself.
  - A14 → P2b (D-65). A15 → X1. A16 ✅ closed by D14a #272 (recorded in the row). A17 → S2b; V1's stubs go at D1.
- **Depends on:** S2 and S6 for anything they touch; otherwise any time.
- **Acceptance:** each item closed, or ruled a residual by the owner (and then listed here); the ROLLOUT §7 carried lists are emptied into this doc's ticks.

### MP · The mobile pass — L · **spec first**
- **Scope:** the one consolidated V2 phone pass (ROLLOUT §7b, the ruling from 2026-07-26): density; toolbar reachability; breadcrumb overlap; **D-44** mobile loot logging (Loot ⇄ Books panels, the FABs); the D-42 Team Summary collapse; SegmentedToggle's 44px targets (#11); Hub tab swipe and the mobile tab nav; the V2 loading skeleton that still uses V1's centred frame. The S2c mobile nav is its foundation.
- **Depends on:** S2c, P2a, P2b, H1, S6, M1 and S5 (so every mobile surface exists).
- **Acceptance:** D-44 executed; every in-static tab and every Hub tab usable at 390px; browser screenshots per surface.

### PP · Phase P, the beta-polish walkthrough — a process (§5)

### R1 · Release plan — docs, co-designed · HS-23, HS-24, HS-26
- **Scope:** the owner asked to plan the rollout in detail when it's near. The release plan covers: timing and comms (release notes, Discord); where "Switch back to legacy UI" lives (the user menu, Settings, or both; how mobile reaches it); the legacy→V2 item's final label, whether it shows off group routes (`isGroupRoute`-gated today, `UserMenu.tsx:348`; this reopens D2) and how mobile reaches it once the banner at `Header.tsx:445` is gone (HS-26); what the flip does to the `ui_shell` default and to the localStorage preference (the pre-release choice isn't migrated; a post-release switch-back persists, HS-23); the rollback lever if V2 misbehaves in the first days; what the soak watches daily.
- **Depends on:** PP under way.
- **Acceptance:** the owner signs it; its decisions are added to §2 as HS-n.

### R2 · Release 3.0.0 — M · PRODUCT_MODEL §6.2 gate 1
- **Scope:**
  - Delete `TryNewUiBanner` (`:30`, `:35`; mounted at `Header.tsx:326`, `:445`).
  - Keep the legacy user-menu item (`UserMenu.tsx:341-356`): drop its `user.isAdmin` gate (`:348`) and rename it per R1 (HS-26).
  - Flip every user and the default to V2 (HS-23, per R1): an alembic data migration sets every `users.ui_shell` to `'v2'`, and the column's `default` and `server_default` become `'v2'` (`models/user.py:49-51`; the account value hydrates over localStorage on login, `lib/shellPreference.ts:136-154`). The frontend fallback for guests and signed-out users (`lib/shellPreference.ts:114`, `preference ?? 'legacy'`) and the stored localStorage value follow R1. Retarget the dev-auth reset (`routers/dev_auth.py:442-443` normalises the dev accounts to `'legacy'` on every login) and any e2e spec that relies on a legacy default.
  - Rename or place "Switch back to legacy UI" per R1 (today it reads "Switch to classic UI", `UserMenu.tsx:365-372`).
  - The public roadmap's "new interface" entry (HS-12).
  - `CURRENT_VERSION` 3.0.0 with a public release note.
- **Depends on:** every item above except those marked **not a gate** (HS-28).
- **Acceptance:** every gate-1 prerequisite ticked in this doc; the migration passes the heads and dialect checks; a signed-out user, a new user and an existing user (including one who chose legacy before the release) all land in V2; the switch-back works on desktop and mobile and persists; a user on legacy can return to V2 from the user menu (HS-26); T1 is recording and the V1 baseline is recorded.

### Soak · at least 4 weeks
V1 is fix-only; V2 gets fixes. Ring work may start, V2-only (HS-15). Read T1's numbers weekly.

### D1 · V1 deletion — L · PRODUCT_MODEL §6.2 gate 2
- **Scope:** re-run `plans/2026-07-03-flip-p3-legacy-deletion.md`, correcting it for what has changed since:
  - `SplitClearPlanner` is now a keep (D-18);
  - `GearSyncDashboard` lives in Roster (S2b);
  - re-check D-P3-1…7 against the parity rulings;
  - `MobileBottomNav` is replaced (S2c).

  Also: delete "Switch back to legacy UI", the legacy→V2 user-menu item (HS-26) and the `shell` plumbing. B9 is retired, not fixed (HS-8). Heading-level skips (HS-7): fix them in files that survive V1 deletion, such as Collections' `h4` (`profile/CollectionsCenterTab.tsx:628`, mounted by V2's `PlayerHub.tsx:209`), and retire them in deleted files (`AvailabilityGrid.tsx:531`, `TemplateRecommendations.tsx:48`, `LootPriorityPanel.tsx:509`, each confirmed by the zero-importer check). The legacy-only matrix §12 rows (A3, A4, A5's legacy instances, A12, A13, A17's V1 stubs) retire with their files. Archive the superseded redesign docs to `docs/archive/` (HS-16).
- **Depends on:** gate 2's criteria met.
- **Acceptance:** the P3 land gate (build, lint, design-system strict, test, `tokens:check`, `git diff --check`, scripts tests); a zero-importer check per deleted file; live e2e smoke and contrast green; PRODUCT_MODEL §6 says V1 is deleted.

### Off the critical path
- **Admin V2 AD2+:** parked (HS-14). It owes the Appendix A sign-off before AD3 and a backup runbook before AD5/AD6a. Resume prompt in `SESSION_HANDOFF.md`.
- **Plugin off-hand (HS-21, plugin repo):** on plugin `main` `687b23a` (v0.4.1), enable index 1 in `GearsetService` and `InventoryService`, and map the off-hand to `offhand` in `LootDetectionService:162`. **Acceptance:** a PLD/GLA gearset syncs the shield to the off-hand slot the web app has had since #238/#240. It ships on the plugin's release cadence.
- **Rings (HS-15):** Ring 2 FFLogs, new Ring 3 tracks and strat references; after the release, each with its own spec.

### After 3.0.0 (not gates)
New builds, not parity: neither shell has them today, and PRODUCT_MODEL §6.2's gate-1 list is exhaustive, so they don't gate the release. This list isn't exhaustive either: it holds the items the plan's sources carry forward, and more will join it.
- The past-sessions/attendance view, homed in Schedule (HS-27; `specs/systems-flow-map.md:127`, `:203`).
- A static-data export in Settings ▸ Static (F-12's Exports row, `systems-flow-map.md:201`; E1 #11's Export half). Plan M's personal export is separate and does gate the release (HS-13).
- From the Finder and Recruit-home carried lists (`specs/2026-09-27-static-finder-design.md:194-195`, `specs/2026-09-27-recruit-home-design.md:120-125`):
  - reverse matching, leads browsing players who fit (SF1 spec :194, "carried");
  - the static typical-week template as a Finder matching input (SF1 spec :195);
  - email or user-targeted invites;
  - a Discord webhook for applications;
  - player-side language and voice preferences;
  - a V2-native listing editor (RH-5).

## 5. Phase P, the process

The bar is **a first-time user's first impression**, on top of parity, which is already guaranteed by §4 (HS-5). Source: ROLLOUT §7b.

### 5.1 Pages to walk, in order
1. Landing and entry: `/` (L-1…L-3), create a static, join by share code (guest view included), the invite link (`/invite/:inviteCode`) and the plugin sign-in (`/plugin-auth`).
2. In-static: Home, Roster (Cards ⇄ Board, Characters), Loot (Priority · Log · History), Schedule, Progress, and each Settings dock tab.
3. Person layer: the Player Hub's five tabs, the public profile (`/profile/:shareCode`), the Static Finder, the Recruit home, the notification inbox, the user menu, and Plan M's flows (download my data, delete my account; M1).
4. The ⌘K palette: navigation and S6's actions.
5. Docs pages and the not-found and error states.
6. The mobile variant of each page above, walked after its desktop page.

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
- 2026-09-30: director vet 1 fixes; HS-26…HS-29.
- 2026-09-30: director vet 2 fixes; HS-30, HS-31.
- 2026-09-30: director vet 3 fixes (View-As Leave guard target, `X-View-As` scope, F3 V1 labels).
