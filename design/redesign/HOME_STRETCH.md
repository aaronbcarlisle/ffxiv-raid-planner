# Home Stretch: now → V1 deletion

> **What this is.** The complete, sequenced list of what is left between today and deleting legacy V1, written 2026-09-30 (home-stretch session 2) off `main` `6aec8590`; §6 (the W-plan) and HS-32…HS-35 were added the same day off `main` `301a1b9e`, which is the current baseline. The current state and the definition of done are in [PRODUCT_MODEL §6](../../docs/PRODUCT_MODEL.md#6-current-state-and-definition-of-done): that section states the state and the gates, and this doc states the order and the detail. Every open owner question is ruled (§2): HS-1…HS-25 in session 2, and HS-26…HS-31 on the questions director vets 1 and 2 raised. **On 2026-09-30 the owner adopted the V2 audit's revised plan, W0–W8 plus design-quality gate Q (HS-32…HS-34), and the same day accepted the recommended answer to all 31 of its decisions (HS-35, §6.5): §6 is now the order.** If new work turns up, add it here with its ruling. Never add it to another doc's status line.
>
> **How to use it.** Work in §6's order (§6.1 says what's next); §4 holds each pre-audit item's detail, and §6.4 maps it onto its wave. Run §4 items in parallel where §3 and §6 allow. When an item ships, tick it in §4 with its PR, update the §6.1 row it affects in PRODUCT_MODEL, and keep going; if a tick and §6.1 disagree, §6.1 wins (PRODUCT_MODEL §8). Run each build item with the `slice-loop` skill. An item marked **spec first** runs brainstorming → spec → owner-signed parity matrix → plan before any code, as Phase D did. An item marked **not a gate** runs in parallel and doesn't hold the release (HS-28).

## 1. The finish line

The two gates are defined in [PRODUCT_MODEL §6.2](../../docs/PRODUCT_MODEL.md#62-definition-of-done), and only there. This doc maps them onto §4:

- **Gate 1, release 3.0.0, is R2.** R2 requires every §4 item above it except those marked **not a gate** (V1B items 2–3 and X1, HS-28; F1's two admin-only items, HS-14; S6's actions beyond the palette navigator and F3's docs/tooling hygiene, HS-35 #31), and every §6 item whose Gate column says gate: design-quality gate Q (HS-32), the kill switch and the invite-only beta (HS-35 #29) included. Admin V2 isn't a prerequisite (HS-14).
- **Gate 2, V1 deleted, is D1.** T1 measures its switch-back and error-rate criteria from R2's first day.

**Standing rules that still apply to every item:** no surface is replaced without an owner-reviewed affordance-parity matrix. The legacy path stays byte-identical until D1, except for the sanctioned V1 edits this plan names (P1, V1B, the F1–F3 items labelled sanctioned V1, and the §6 items whose plan labels them sanctioned V1; §6.3 lists the W0/W1 items known to touch shared code). Every V1-visible edit carries a sanctioned-edit justification and a release note. Every UI PR embeds screenshots. `xivrp-director` vets each slice (`V2_COVERAGE_PLAN.md` §5 hard gates).

## 2. Owner rulings (session 2, 2026-09-30)

These close every item in the session-1 decision list (groups A–E, 22 items). HS-26…HS-29 answer the four owner questions director vet 1 raised (its F4, F8, F12 and F1); HS-30 and HS-31 answer vet 2's Q1 and Q2. Older labels are cited as SF-OWNER-n (Stage 4) and AD-OWNER-n (Admin); new rulings are HS-n (HS-18).

| # | Question | Ruling |
|---|---|---|
| HS-1 | Plan shape | This one doc, now → V1 deletion, linked from PRODUCT_MODEL §6 |
| HS-2 | Spine tab count; is Progress a tab? | **Five tabs:** Home · Roster · Loot · Schedule · **Progress**. F-03 (2026-07-26) is reaffirmed. Progress is the tracks surface (Goals, Farms, Collections, Split Clears). Text that still says "four tabs" was written before the amendment and is corrected in this PR (glossary wording: HS-29) *(amended by HS-35: #1 Progress is a Tracks matrix with Farms-B, overturning S2-1/S2-2; #3 Objectives go to Recruit ▸ Listing and Home; #27 farm status Need · Want · Have · Pass)* |
| HS-3 | Plugin's home | F-05 reaffirmed. Setup and the API key go in Player Hub, as a section inside "Characters & gear", not a new tab (the exact placement is a Stage 2 spec detail). The guide goes in Docs. The team Gear-Sync dashboard goes in the Roster area *(refined by HS-35 #23: plugin setup, the guide link and API keys sit in the Hub's collapsed Connections section, inside the Sync card's state machine)* |
| HS-4 | Which owed parity rows gate the release | **All of them:** D-48, D-49, D-50, D-58, D-63, D-65, D-66, D-70, plus D-18, D-52, D-67 and D-68 via Stage 2. H-10 and the typical-week layer gate it too (HS-25) *(amended by HS-35: #10 makes P2b a Home information-hierarchy spec, not four restored V1 modules; W4 SCHED puts D-48/D-49 inside the Schedule Planner (#19), and #20 gives H-10's grid two mounts)* |
| HS-5 | The Phase P bar vs parity | The release needs **both**: parity (HS-4) and Phase P's first-impression bar. D-18 ships with Stage 2 *(amended by HS-32: parity + gate Q + Phase P)* |
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
| HS-16 | Superseded docs | Stay in place; archived in D1 *(amended by HS-35 #30: ROLLOUT, V2_COVERAGE and RECONCILIATION are frozen as history now, and the five foundation docs are archived now, in W6 DOCS-INT, not at D1)* |
| HS-17 | #224's two log buttons | Judged live in Phase P (Loot page) *(resolved by HS-35 #8: one split "Log M10S ▾" primary, and the V2 floor log sheet replaces the wizard)* |
| HS-18 | Colliding OWNER-n labels | Old notes stay as they are; cited with SF-/AD- prefixes; new rulings are HS-n |
| HS-19 | Card richness (#3) | Goes on Phase P's punch list |
| HS-20 | Sequencing | The small slices (P1, V1B) run first, in their own worktrees, while the Stage 2 spec is co-designed. The Home-module parity rows wait for Stage 2 *(amended by HS-35 #13, which schedules the ⌘K palette as a global navigator with the four-verb tranche after S2a, and #30: S2a's spec and build may start after batch A while batch B continues; T1, the M1 spec, AUTHZ, KS, CI-0 and the W1 clusters start now)* |
| HS-21 | The plugin's off-hand mapping | A parallel plugin-repo track; it gates nothing |
| HS-22 | Telemetry | A shell-switch event log ships before the release; the thresholds are in PRODUCT_MODEL §6.2 gate 2, the definitions in §4 T1 |
| HS-23 | Default flip | Flip everyone. The shell choice made before the release isn't migrated (only admins are on V2 today), and a switch-back made after it persists *(wording clarified by director vet 1)*. The rollout is planned in detail when it's near (§4 R1) |
| HS-24 | The entry point (was D2) | The admin-gated "Try the new UI" opt-in is retired: `TryNewUiBanner` is deleted, and the user-menu item stays for everyone, renamed (HS-26). After the release the V2→legacy entry is "Switch back to legacy UI" in the user menu or Settings. D2's `isGroupRoute` question goes to R1 *(amended by HS-26; this row first said the entry was retired and D2 was moot)* |
| HS-25 | Gate structure | Un-gate and 3.0.0 merge into one release (PRODUCT_MODEL §6.2). The opt-in window and its "healthy telemetry" criterion are dropped *(amended by HS-35 #29: an invite-only beta cohort, volunteer statics via Discord for 1–2 weeks with T1 live, precedes the flip; still two gates)* |
| HS-26 | Is there a legacy→V2 path after 3.0.0? (vet F4) | **Yes, for everyone.** R2 keeps the legacy user-menu item (`UserMenu.tsx:341-356`), drops its `user.isAdmin` gate and renames it (for example "Use the new UI"); `TryNewUiBanner` is still deleted. R1 settles the final label, whether the item shows off group routes (it's `isGroupRoute`-gated today) and how mobile reaches it. Switching back is never a one-way door. T1 also logs legacy→V2 returns |
| HS-27 | Does the past-sessions/attendance view gate 3.0.0? (vet F8) | **No.** It's a new feature, not parity: neither shell has one (`specs/systems-flow-map.md:127`, `:203`). More's "Session History" card only links to Schedule, so it dies in S2b with Schedule as its home. The view is listed under "After 3.0.0" (§4) |
| HS-28 | Are V1B and X1 release gates? (vet F12) | **Only V1B item 1, the not-found flow**, because it's broken in V2 too (`ShellContentStates.tsx`). V1B items 2–3 and all of X1 are **not a gate: run in parallel** |
| HS-29 | Glossary: Progress vs prog (vet F1) | **"Progress"** is the fifth spine tab, the tracks surface (Goals, Farms, Collections, Split Clears). **"Prog"** stays the status word ("Floor 3 prog"). DESIGN_SYSTEM §2.3 and REDESIGN_SPEC §10 carry a dated amendment |
| HS-30 | D-50's backend scope (vet 2 Q1) | **Only View-As deletes are refused.** P1 makes the client send the `X-View-As` header that `services/audit.py:140-145` already reads, and the backend refuses a static delete, and Leave (per the D-50 wording), only when that header is present. Admins keep moderation delete under `?adminMode` (`StaticTab.tsx:305`) |
| HS-31 | A11: "Mark floor cleared" in admin mode (vet 2 Q2) | **Keep V2's behaviour.** In admin mode, an admin whose real role in the static is member can mark a floor cleared in V2 but not in legacy. A declared delta, consistent with P-15 (`specs/v1-v2-parity-matrix.md:276`); no work item |
| HS-32 | The V2 audit's revised plan (2026-09-30) | **Adopted in full:** waves W0–W8, the release waves and design-quality gate Q (§6). **Amends HS-5:** 3.0.0 needs parity (HS-4), gate Q (§6.3 W5) and Phase P, which becomes the owner's taste pass after each surface's Q-1 pre-score. This answers §6.5 #28 |
| HS-33 | Which earlier rulings the audit may reopen | **None is off-limits.** Any HS-n, S2-n, F-n, H-n, R-n or DESIGN_SYSTEM contract may be overturned by a §6.5 answer (S2-1/S2-2, R-3/R-4/R-14, DS §3.9/§3.13/§3.14/§3.20 and H-3/H-6/H-10 are named). Until the owner answers the decision that reopens it, the earlier ruling stands. *(All 31 were answered the same day, HS-35; the rule still governs any later reopening.)* |
| HS-34 | Order after P1 | V1B ✅ #322 → P1 ✅ #323 → the docs PR adopting §6 → **the P0 safety slice** (SEC-1, LOG-1, RSVP-0, AUTHZ) → **Stage 2 co-design restarting from canvas DA 10**. The rest of W0 and W1 run in parallel (§6.1) |
| HS-35 | The 31 audit decisions (DEC-1, §6.5) | **Every recommended answer accepted** (2026-09-30), batches A, B and C in full. Cite one as "HS-35 #n". The rulings each answer overturns or amends are named on its §6.5 line; the HS rows above carry a dated note where one changed. Parity: an answer that removes or moves a shipped affordance (for example #10's removal of Team Summary from Home) is the owner's parity ruling for that row, and the executing PR records it in the matrix. It covers only the affordance the answer names: every surface a W3/W4 slice replaces still gets its owner-signed parity matrix (§1) |
| HS-36 | Who may write a member's facts, and what each write records (Stage 2 co-design, session 4) | **Self-service with attribution** (2026-09-30). Members edit and log their **own** gear, books, totems, mount ownership, drops and purchases, PF clears before reset included; never another member's without the role; viewers never. Every write records who, how (web, plugin, or a lead on someone's behalf), where (static, tier, week, floor; the origin: a static clear, PF or a purchase) and which **character**, and the UI shows it. Facts belong to the character (alts, split clears), not the user (PRODUCT_MODEL §3.1). The once-per-character-per-floor-per-week rule applies only while the tier has weekly limits: W4 LOOT adds a lead toggle "Weekly limits lifted" (default off). Order: PROV-1 (W0) records how and which character; S2a makes totems and mount ownership self-editable per character ([S2a spec](specs/2026-09-30-s2a-progress-design.md) S2-10, accepted 2026-10-01); W4 LOOT does self-logged drops, books and purchases |
| HS-37 | Who may duplicate a static (#331, W0 AUTHZ-2) | **Members and up** (2026-09-30, option 1). A viewer gets 403, and neither shell offers Duplicate to a viewer. Both menus also hide it on linked-only rows, where the caller isn't a member and the API answers 404 (B12, 2026-10-01). Non-members keep the 404; the gate is inline in `duplicate_group`, so the R-AD-A audit flag stays right. The six-route viewer allowlist is unchanged (HS-35 #2 (a)). ✅ #344 |

## 3. Sequence at a glance

**The order is now §6's waves (HS-32, HS-34):**

```
W0 safety + correctness (P0 slice first) ──► in parallel with everything below until R2
W1 quick wins (parallel, rolling)
W2 DEC-1 ✅ answered (HS-35) ─► CC-5 reconciliation PR
                                                   ├─► W3 S2a Progress ─► S2b More/Settings/Hub ─► S2c mobile nav · PAL-1
                                                   └─► W4 FRAME · HOME · ROSTER · LOOT · SCHED · RECRUIT · FINDER · HUB · ENTRY · M1
W5 gate Q (rolling from S2c) ─► W6 docs/help/onboarding ─► W7 mobile pass ─► W8 Phase P
─► BETA (HS-35 #29) ─► R1 ─► R2 RELEASE 3.0.0 ─► soak ≥4 weeks ─► D1 V1 deletion
```

The pre-audit sequence below still gives §4's dependencies:

```
now ─ H0 this plan
   ├─ P1 safety + quick parity ─────┐ (worktree; ✅ #323)
   ├─ V1B item 1, not-found flow ───┤ (worktree; V1B's only gate, HS-28; ✅ #322)
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

Sizes: **S** is one PR under ~300 changed lines; **M** is one PR under ~1,500 (the repo's slice cap); **L** is several PRs, cut by its spec. §6 uses the audit's recalibration (S < 700 lines including tests), which §6.5 #30 asks the owner to adopt for the whole plan.

## 4. Items, in order

Each item lists its scope, dependencies, acceptance criteria, size and rulings. "Parity row executed" means the row's ruling is visible in V2 and the matrix row gets a ship marker with its PR.

### H0 · This plan (docs) — S — ✅ #321 (2026-09-30)
- **Scope:** this doc; PRODUCT_MODEL §6 rewritten to the two gates and linked here; the "four tabs" text written before the amendment corrected in REDESIGN_SPEC §11 #7 / review checklist, V2_COVERAGE Stage 2, RECONCILIATION B7 and the DESIGN_SYSTEM Spine contract; amendment notes where ROLLOUT §7b and V2_COVERAGE D7 describe the un-gate. Director vet 1 added dated amendments where DESIGN_SYSTEM §2.1/§2.3 and REDESIGN_SPEC §9.1/§10 still read "four tabs" or "Progress is never a tab" (HS-29), and where `docs/README.md`, ROLLOUT (the header note, §1, §8, §9) and V2_COVERAGE (the status line, Stage 5, D2, D7) still describe three gates; `xivrp-director.md` cites F-03 for Progress.
- **Acceptance:** the director says READY; merged; §6 links here; no owner question is left open.

### P1 · Safety + quick parity — S · HS-9, HS-12, HS-20, HS-30 — ✅ #323 (2026-09-30)
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
  1. ✅ **Not-found flow** (#322): a bad share code reaches "Static Not Found" in both shells. `fetchGroupByShareCode` maps a 404 to not-found, clears a stale static on other failures, and drops superseded responses. The branches were already right (R-V1B-1). The not-found state adds "Go to My Statics" (R-V1B-7).
  2. **Rejections:** `PlayerGrid`/`PlayerCard` catch and surface failed claim, release and reset.
  3. **Clear-on-edit:** BiS targets (`BiSTargetManagerModal:288-290`), goals and objectives (`GoalModal:142`) can be cleared, as #239 did for loot.
- **Depends on:** nothing.
- **Acceptance:** a test per bug that fails before the fix; legacy snapshots unchanged apart from the fixed behaviour; browser check in both shells; public release note.

### X1 · Hygiene — S each · **not a gate: runs in parallel** (HS-28)
- Dependabot alert 83: `undici` 6.28.0 → ≥6.28.1 in `scripts/package-lock.json`. That lock is npm, not the frontend's pnpm lock, so this is an npm lock update inside `scripts/`, not the surgical pnpm-lock edit.
- A CI guard that re-runs the uv `--universal` compile and fails if `backend/requirements.txt` changes (the Dependabot marker clobber).
- Parity matrix §12 A15: delete the stale comment in `components/group/PluginPage.test.tsx:4-5`, which says `GearSyncDashboard` has zero importers (`GroupViewContent.tsx:51` imports it).
- **Acceptance:** alert closed, scripts tests green; the guard fails on a clobbered file in a test branch; the comment is gone.

### S2 · Stage 2, the in-static IA collapse — L · **spec first** (session 3; the S2a spec ✅ accepted 2026-10-01, #334; its parity matrix ✅ signed 2026-10-01, `specs/2026-09-30-s2a-parity-matrix.md`) · HS-2, HS-3, HS-20, HS-27, HS-29
**Spec-ready boundary.** Session 3 ends when three things exist: the Stage 2 spec, an owner-signed parity matrix for every surface it replaces (More page, `PluginPage`, `GoalsPage`/Tracking, `MobileBottomNav`), and the slice plan. No code before all three. *(HS-35 #30: batch A is answered, so S2a's spec and build may start while batch B's surfaces are specced; S2a still needs its own owner-signed matrix.)*

*Settled inputs (don't reopen), except where HS-35 amends them (HS-33): #1 and #3 replace S2-1/S2-2 and move Objectives; #21 makes Settings a page (Leave in Members, Delete in its Danger zone); #23 refines HS-3; #11–#13 reshape the frame, tabs and palette, and S2c follows DA 4 Mobile-A. The S2 spec reads §6.3 W3 first:* F-01…F-12 (`specs/systems-flow-map.md:213-224`); HS-2; HS-3; HS-27; HS-29; D-18 → Progress ▸ Split Clears (R-41); D-52 (no More tab; Plugin isn't a tab); D-67 → one evolved Home TrackCard pointing into Progress (F-10); D-68 → a data-gated attention row on Home (F-11); D-71 drop; the Danger Zone moves to Settings ▸ Static as an approved V1-visible delta (F-12); a mobile-reachable shell switch must exist before the More card dies (F-12); the More dissolution table (`systems-flow-map.md:192-205`).

*The spec decides:* the order of content-host extraction as `GroupViewContent` conditionals shrink, and the slice cut. *(HS-35 settled the rest, and §6.3 W3 states it: Progress's layout is the Tracks matrix with Farms-B (#1); the orphaned `components/mount-farms/**` tree is deleted (S2a); the shared catalog browser is DA 11's Find mode; plugin setup sits in the Hub's Connections section (#23); the mobile nav is DA 4 Mobile-A (S2c).)*

*Likely slices (the spec confirms):*
- **S2a · Progress tab:** the fifth spine tab; Goals/Farms/Collections; Split Clears with the Split Planner wired (D-18); the Home TrackCard pointer (F-10) and the split attention row (F-11), which opens the Split Planner itself (legacy's "Open Split Planner" lands on Roster, matrix §12 A13); ⌘K `goals` retargeted; the farm mutations get role checks (§12 A7: `G-13` LogDropModal, `G-21` per-reward Track and `G-22` TrackFromCatalogModal have none; ✅ shipped in #329, so A7 is closed).
- **S2b · More dissolution + Plugin:** re-home every More entry per the table, with two corrections. **Requests** goes to the Recruit home (`/group/:code/recruit`), not Settings ▸ Recruitment ▸ Requests: RH1 moved V2's recruitment there and the V2 dock hides the Recruitment tab (`plans/2026-09-28-rh1-recruit-home.md:260`; D-69's keep-v2 ruling still holds). **Session History** dies with Schedule as its home (HS-27). The Exports and Activity Log stubs are deleted (§12 A17; V1's copies go at D1). The Danger Zone goes to Settings ▸ Static. Plugin setup and the API key go into Player Hub, and the guide goes in Docs. `GearSyncDashboard` moves from `PluginPage` into the Roster area (KEPT P-2…P-7), and its "Team Summary" shortcut is removed, because HS-35 #10 drops Team Summary from V2 (§12 A10: `PluginPage.tsx:85` never passes `onViewStats`). **A mobile-reachable V2→legacy switch ships in S2b**, before or with the More route's removal: the More card is V2's only mobile path today (V2M-11), and F-12 makes the switch a hard precondition. The More route is removed from V2.
- **S2c · Mobile nav + B7:** a V2 mobile nav replaces `MobileBottomNav` under V2 (`GroupViewContent.tsx:1244`); off-spine reachability is removed (`:1140/1154/1219/1239`); the nav may re-home S2b's shell switch (HS-24).
- **Acceptance (whole stage):** `Spine.tsx` renders five tabs; no V2 route reaches More, `PluginPage` or legacy Tracking; the V2→legacy switch works at 390px before More is gone; B4–B7 closed in RECONCILIATION; D-18, D-52, D-67 and D-68 get ship markers; the Spine contract in DESIGN_SYSTEM is updated; legacy is byte-identical except the approved Danger Zone delta and S2a's declared deltas ([S2a spec](specs/2026-09-30-s2a-progress-design.md) §7, owner-accepted 2026-10-01).

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

### S6 · Stage 6, ⌘K actions — M/L · **spec first** (a short spec) · the navigator is a gate (§6.3 PAL-1); the action tranche is PAL-2, **not a gate** (HS-35 #31)
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
  - V1B carried (out of V1B item 1's scope, seen in its browser check):
    - late tier-store responses after a static switch: switching to a static with no tiers leaves the previous static's roster on screen (V1B plan, out of scope; the same class as `fetchCurrentWeek`) — sanctioned V1;
    - on the not-found page, V2's top bar names another static with its role badge, because `StaticPicker` falls back to `groups[0]` (`layout/StaticPicker.tsx:80-81`); this already happened on direct bad links, and V1B's fix now also reaches it from another static — V2-only.
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
  - jscpd back to main's count (RH1 added a clone pair: 340 against 339) — **not a gate** (HS-35 #31);
  - the contrast harness in CI, with the `Badge.tsx` exclusion resolved — the exclusion covers the shared legacy `PositionSelector`/`TankRoleSelector` role badges (`frontend/e2e/contrast.spec.ts:206-215`, about 3.4–4.0:1): sanctioned V1 and V1-visible if resolved by a style change (release note, light and dark shots); keeping a documented exclusion changes no render;
  - `--max-warnings` in `ci.yml`;
  - `no-tiny-text` reaching const class strings — the rule is tooling, but fixing the shared consts it flags is sanctioned V1 and V1-visible (release note, light and dark shots);
  - the `index.css` `aria-hidden` rule narrowed (`:239-243`; both shells: sanctioned V1);
  - a DESIGN_SYSTEM contract for the Finder card;
  - `home/`, `finder/` and `recruit/` rows in FRONTEND_STRUCTURE — **not a gate** (HS-35 #31);
  - the suppressions count corrected (29 in 17 files) — **not a gate** (HS-35 #31);
  - CLAUDE.md § Map and UI_COMPONENTS updated — **not a gate** (HS-35 #31);
  - REDESIGN_SPEC §7's drop corrections (re-homings the parity rulings reversed) and the "broken REDESIGN_SPEC link" (ROLLOUT §7 :302-304). A link check on 2026-09-30 found every link in and to REDESIGN_SPEC resolving, so F3 finds the one meant or closes it as already fixed;
  - E1 #11's Export half: S2b deletes the Exports stub, and a static-data export is new build → "After 3.0.0" (F-12: "Stub — delete card, note in backlog", `systems-flow-map.md:201`). The Split planner half is D-18 (S2a).
- **Parity matrix §12 A2–A17, triaged against code 2026-09-30** (`specs/v1-v2-parity-matrix.md:552-577`):
  - A2 → F3. A3, the legacy Loot Priority `Alt+1/2/3` tooltips (`LootPriorityPanel.tsx:523,546,569`) → legacy-only, retires at D1. A4, the legacy loot sub-tab reset (`useGroupViewState.ts:332`, feeding only legacy `LootPriorityPanel`) → retires at D1.
  - A5, blank states (L-05, R-183, O-02) → the legacy instances retire at D1; F1 checks V2 Roster and Loot with zero players.
  - A6, viewers can Roll/Reroll a weapon tie (`WeaponPriorityList.tsx:294-299`, not gated by `showLogButtons`; V2 mounts it through `WeaponPriorityBridge`) → F1; sanctioned V1, or a V2-only prop.
  - A7 → S2a; closed by #329's farm-mutation role checks (`collection_goals.py:217,287,705-708`; S2a spec §5). A8 and A9 → F3 (A9's `mount-farms/**` tree → the S2 spec). A10 → S2b.
  - A11 → kept as V2 has it (HS-31), no work item. V2's "Mark floor cleared" gates on `canEdit` (`BookLedgerCard.tsx:299`), which includes admin-mode access (`useStaticPermissions.ts:54-57`); legacy adds `userRole !== 'member'` (`SectionedLogView.tsx:1472`). The two diverge only for an admin in admin mode whose real role in the static is member: a declared delta, like P-15 (`specs/v1-v2-parity-matrix.md:276`).
  - A12, legacy Overview omits `isAdminAccess` (`GroupViewContent.tsx:915`) → retires at D1; V2 Home takes `canEdit` from `useStaticPermissions`, which includes it (`NewShell.tsx:66,79`).
  - A13 → retires at D1; S2a's attention row opens the Split Planner itself.
  - A14 → P2b (D-65). A15 → X1. A16 ✅ closed by D14a #272 (recorded in the row). A17 → S2b; V1's stubs go at D1.
- **Depends on:** S2 and S6 for anything they touch; otherwise any time.
- **Acceptance:** each item closed, or ruled a residual by the owner (and then listed here); the ROLLOUT §7 carried lists are emptied into this doc's ticks.

### MP · The mobile pass — L · **spec first**
- **Scope:** the one consolidated V2 phone pass (ROLLOUT §7b, the ruling from 2026-07-26): density; toolbar reachability; breadcrumb overlap; **D-44** mobile loot logging (Loot ⇄ Books panels, the FABs); the D-42 Team Summary collapse (moot in V2 once HS-35 #10 drops Team Summary; V1 keeps it until D1); SegmentedToggle's 44px targets (#11); Hub tab swipe and the mobile tab nav; the V2 loading skeleton that still uses V1's centred frame. The S2c mobile nav is its foundation.
- **Depends on:** S2c, P2a, P2b, H1, M1 and S5 (so every mobile surface exists), and S6's actions if they have shipped (they aren't a gate, HS-35 #31).
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

The bar is **a first-time user's first impression**, on top of parity, which is already guaranteed by §4 (HS-5), and on top of gate Q: each surface is walked after its Q-1 pre-score (HS-32; §6.3 W5, W8). Source: ROLLOUT §7b.

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
- #224's two log buttons (Loot, HS-17): verify only, since HS-35 #8 resolved it;
- D-60, Command Brief chips as clickable subtitle and prompt elements (Home);
- Go to My Statics shown to guests on not-found (and on the Error card); the private branch shows them Log In with Discord instead (`ShellContentStates.tsx:163-167`).

## 6. The W-plan (V2 audit, adopted 2026-09-30)

> **What this is.** The revised plan from the V2 holistic audit of 2026-09-30 (§9 and §10 of its synthesis report), which the owner adopted in full: waves W0–W8, the release waves, and design-quality gate Q (HS-32). It is the **order** from now to V1 deletion. §4's items keep their scope, file references and acceptance criteria; §6.4 maps each one onto its wave. Where a W item and a §4 item cover the same work, both acceptance lists apply. Where they conflict, the HS-35 answer (§6.5) wins, and the §4 text is corrected when that item is planned.
>
> **Sources.** The audit's report is [the published synthesis](https://claude.ai/artifact/2qL46K63cBihrRsnuyFpEM), and its 18 decision areas are on [the design canvas](https://claude.ai/artifact/FSew85ViFxg3ERcBAbkAQP). The agent reports behind them are in the owner's git-ignored `.superpowers/v2-audit/`. Finding IDs cite them: A1–A6 are the per-surface design reviews (for example `A2 R-1` is finding R-1 of A2, the Home/Roster review), B is the screenshot capture and detector, C1 performance, C2 conformance and accessibility (`C2-08`), D vision drift, E1 internal docs, E2 user docs, and F the audit of this plan (`F §5`, `F G-9`). "DA n" is decision area n on the canvas; "P0-n" is one of the audit's three verified P0s (§6.3 W0).
>
> **ID namespaces in §6.3.** Inside the W1 "Chrome & wayfinding" and "Accessibility tier 1" rows, D-16, D-17, D-18, D-20, D-23 and D-38 are the synthesis's §5 deduplicated-defect IDs (D-18 there is the not-found chrome); everywhere else in this doc D-nn is a parity-matrix row (D-18 is the Split Planner entry). D-25 in the W1 Keyboard row is a synthesis ID too. H-5…H-8 and R-1…R-25 in W1 are A2 findings, not Player Hub H-n or Phase D R-n rulings; L-02…L-34 are A3 (Loot) findings, while L-1…L-3 (ENTRY, §5.1) are the landing rulings, and F-Sn A4 (Schedule) findings. S2-n rulings live in the Stage 2 working notes; F-nn (F-01…F-12) are the flow-map rulings.
>
> **Reconciled against the synthesis (2026-09-30).** Two internal inconsistencies are corrected here. (1) Its plan table numbered the decision batches B = #11–#20 and C = #21–#31, but its decision list (§6.5) has B = #11–#27 and C = #28–#31; this doc follows the list, and BETA's "§10 #23" is #29. (2) Accessibility tier 1 claimed ≈185 axe nodes and the fix-order section ≈160: both are right. ≈160 is C2-02 + C2-08 alone, and `Field`/`Checkbox` add ≈25 page nodes (C2 §7 #1–2).

### 6.1 Order now (HS-34)

1. ✅ V1B item 1, #322. ✅ P1, #323.
2. This docs PR, #325: the plan's adoption and the 31 answers (HS-32…HS-35).
3. ✅ **The P0 safety slice** (SEC-1 #329 + #330, LOG-1 #327, RSVP-0 #328 with #324, AUTHZ #332), from W0: SEC-1 (`log_drop` rules, P0-1, to HS-35 #2: 9A plus viewer routes (a)), LOG-1 (the Log Week double-log, P0-2), RSVP-0 (series vs occurrence, the P0-3 mitigation), and AUTHZ (a role audit of every mutation route). #324, the V2 RSVP double toast, may ride along. Its evidence is under W0 below.
4. **Stage 2 co-design, restarting from canvas DA 10** (Progress), not from the old Farms A/B/C question. DA 10 is answered (HS-35 #1 and #3: the Tracks matrix with Farms-B; Objectives to Recruit ▸ Listing and Home), so the session writes the S2a spec against those answers and the synthesis's §8 DA 10 conditions. *(✅ the S2a spec was accepted 2026-10-01, #334; its parity matrix and slice plans are next.)*

In parallel, each in its own worktree, once the P0 slice is under way: the rest of W0, the W1 clusters (their decisions are answered, HS-35), and W2's CC-5 reconciliation PR.

### 6.2 Principles and sizes

This merges the plan audit's revised sequence (F §8) with the audit's findings. Principles: (1) **integrity before parity** — wave 0 needs no design decision and no owner walk; (2) **decisions in batches with defaults**, never one per exchange (F §6); (3) **quality is measured, not felt** — every wave ends with a demonstrable acceptance, and the design-quality gate (Q) sits before Phase P, which becomes the taste pass it was always meant to be; (4) **density rule 11 applies inside the remaining slices** (D §5.4), not after them; (5) **nothing is a release gate unless a user would notice its absence** (S6 actions, F3 hygiene and Admin V2 are not gates).

Sizes: S < 700 lines incl. tests, M < 1,500, L = a slice (F §6's recalibration, adopted for the whole plan by HS-35 #30). "Gate" = required for R2 3.0.0 unless the owner defers it in writing. Acceptance criteria are things a reviewer can *run or see*.

### 6.3 The waves

#### W0 · Safety and correctness (now; parallel; no design decisions)

| Item | Scope | Acceptance (demonstrable) | Size | Depends on | Gate |
|---|---|---|---|---|---|
| **SEC-1** log_drop rules | `log_drop`: self = member; others = lead+; recipient must be a non-viewer member; VIEWER refused. `DELETE …/drops/{id}` (lead or creator) that restores the prior participant state. Self-upsert ignores `priority_rank`/`token_count` from non-leads (DA 10 rules 9A) | pytest: viewer → 403 logging for self and others; member → 403 for others, 201 for self; non-member recipient → 400; delete restores `need`; both shells' clients hide the buttons they can't use | S | — | **Gate** (P0-1) — ✅ #329 (backend, with the three viewer write gaps below) + #330 (both shells' clients) |
| **AUTHZ** route table + tests | One table of every mutation route (145, or 146 with dev-auth, enumerated from the live app; the scan's 142 undercounted, see AUTHZ inputs) with its minimum role and ruled intent; one pytest per route asserting a viewer gets 403 where the table says so; the four viewer-accepting routes ruled (§6.5 #2), which leaves a six-route viewer allowlist (suggestion create, vote, unvote, edit own and delete own, plus card self-release) that the tests assert exactly | Table checked into `backend/tests/authz_matrix.py`; CI fails on a route not in the table | M | SEC-1 | **Gate** — ✅ #332 (169 rows over 146 routes, viewer/member/allowlist/actor probes, the plugin's `xrp_` key contract, two viewer gate fixes); viewers can't duplicate, and linked-only rows don't offer it (owner ruling on #331, 2026-09-30, option 1; B12; HS-37) ✅ #344; every row probed (anonymous, non-admin, lead, outsider, stranger) ✅ #344 |
| **LOG-1** wizard seeding | `LogWeekWizard` seeds from `lootLog`/`materialLog` for `selectedWeek`; logged slots render locked "✓ Ears → Healer Two · logged" and are excluded from submit; confirm step shows "N already logged this week"; ranking calls `buildRecipientEntries` with the same `enhancedActive` gate (L-02) | Vitest: opening the wizard for a week with one logged Ears submits 0 Ears entries; a consistency test asserts wizard #1 == Queues #1 on the DEVTST fixture | S | — | **Gate** (P0-2) — ✅ #327; a floor's books can still double-log → #326 |
| **RSVP-0** interim | Recurring series render one card ("Every Tue · next Oct 6 · applies to every week") until DA 12's schema lands; no RSVP control on non-next occurrences; `countdownLabel` never returns "today" for a past start; RSVP disabled after `endTime`; Played state on past cards | e2e on a seeded Tue/Fri series: one card per series per week; a past session shows "Played · Mon Sep 28" with no RSVP buttons | S | — | **Gate** (P0-3 mitigation) — ✅ #328 (with #324); the e2e (`e2e/schedule-series.spec.ts`) is local-only, since CI has no Playwright job |
| **GUEST-1** | Bell, gear and palette "Open Settings" gated on `user` (as `NonGroupTopBar`); `LoginButton` in the group top bar; Schedule fetches gated on membership with one honest members-only card (Loot reads are public by design); the `by-code` and `GET /static-groups/{id}` payloads omit members' and the owner's Discord identity for non-members (§6.5 #4 → (a)); the auth bootstrap asks `GET /api/auth/session` first, which removed the bootstrap 401s the acceptance counted | Guest e2e: no bell, no gear, Log in visible, no 401s in the console, response body has no `discordUsername` | S | §6.5 #4 | **Gate** — ✅ #343, met on `/` and the four V2 Spine tabs (Home, Roster, Loot, Schedule) only. Identity is removed from `by-code` and `GET /{id}` only; the tier, `/members` and `/linked-players` payloads → GUEST-2. Tracking and Plugin guest 401s and the More ▸ Settings / Integrations cards → GUEST-2. Legacy guest data 401s carried (V1 frozen) |
| **GUEST-2** sibling guest payloads + guest 401s off the Spine | Members' Discord identity (`discordUsername`, `discordId`, `discordAvatar`, `avatarUrl`, `displayName`) stripped when `user_role is None` **exactly**, GUEST-1's builder rule, from `GET …/tiers/{tid}` and `GET …/tiers/{tid}/players` (`players[].linkedUser`, `tiers.py:186-216`), `GET …/members` (`static_groups.py:956`) and `GET …/linked-players` (`:984`); never a broader test, since the plugin reads `…/tiers/{tid}/players` as a member with an `xrp_` key (`RaidPlannerClient.cs:300`). Roster cards in both shells render a guest's view without linked identity (`PlayerCardStatus.tsx:133, :198-204`; `RosterCard.tsx:734-747`), the rendering ruled in its plan. Tracking's objective-goals fetch gated on membership (`ObjectiveGoalsPanel.tsx:173`); Plugin shows a Log in prompt instead of the key manager for guests (`ApiKeyManager.tsx:29`); More ▸ Settings and More ▸ Integrations hidden for guests (`components/group/MorePage.tsx:259-263`, `:198-202`). Both shells, sanctioned V1 (B14). Evidence (GUEST-1 plan): each route returned 3 handles to a guest; Tracking `401 objective-goals` ×2, Plugin `401 auth/api-keys` ×2 | pytest: anonymous and signed-in-outsider bodies on the four routes have no `discordUsername`/`discordId`; member, viewer, admin and a member's `xrp_` key keep them (plugin contract). Guest e2e on Tracking, Plugin and More: no 401s, no Settings or Integrations card. The public privacy release line ships here | S | GUEST-1 | **Gate** — ✅ #347 (2.1.64), completes §6.5 #4. Real scope was **eight** routes, not four: the row's four plus the loot-log, page-ledger (tier and player) and material-log reads, whose `createdByUsername` was the logger's raw Discord handle (R-G2-1); all eight gate on `check_view_permission(...) is not None`, `linked-players` → `[]`, `createdByUsername` → `null`, and a member's `xrp_` key keeps identity. `by-code` and `GET /{id}` also drop an **unlisted** static's recruiting contact from `settings.discovery` (R-G2-12); a listed static keeps it, as the Finder publishes it. One `MembersOnlyCard` serves Tracking and Schedule (Schedule's Log in is its action). Carried: legacy guest 401s on Roster and Schedule (V1 frozen); Settings for a signed-in non-member and its "Members (N)" over an empty list → DA 15 |
| **PROV-1** write provenance (HS-36) | Every new loot, material, book and farm-drop row records how it was logged (`logged_via`: `web` or `api_key`) and which key wrote it (`api_key_id`, B16). Every new loot, material and book row also records whose card it was for (`recipient_user_id`, the claimant at write time), which character, and whether the client sent the character or the server filled in the card's main (`recipient_character_source`: `explicit` or `default`, B15). One migration (`m6n7o8p9q0r1`, 18 nullable columns, no backfill: older rows stay NULL). Backend only, both shells, nothing on screen; no request or response field added (loot's existing character fields now carry the defaulted main). Plan: [`plans/2026-09-30-prov1-provenance.md`](plans/2026-09-30-prov1-provenance.md) | pytest (`test_write_provenance.py`): each of the five creation sites and the two handlers that can move a row has a route test on the stored values, across web and `xrp_` key writes, and the response key sets are unchanged; the AST guard (`test_provenance_coverage.py`) fails on a new creation site, a missing keyword, a bulk or raw write, or a site with no route test; `migration-exec` on Postgres | M | — | S2a-1's prerequisite (HS-36) — ✅ #345 + #346. **Binding on later slices** (the display slice, S2a-1, self-service): **R-PV-1**, the column vocabulary: a writer column is `<verb>_by_user_id`; a channel column is `<verb>_via` `String(10)`, nullable, no CHECK or enum, filled only through `services/provenance.py`'s `logged_via(request)` and its `LOGGED_VIA_*` constants; S2a-1 adds its own columns in its own migration. **R-PV-2**: the channel and key come only from the credential that authenticated the request, never the body or a client header; an unset credential raises. **R-PV-3**: "on behalf" is derived (`created_by_user_id ≠ recipient_user_id`), never a stored flag. **R-PV-4**: the character resolves as the explicit registration, else the explicit name, else the card's main in this static (`default`), else NULL. **R-PV-7**: a PUT never changes how, which key or who logged; only a real recipient change (a different card) re-resolves the claimant and the character. **R-PV-8**: the display slice adds the response fields, optional and additive (plugin contract). **B9**: with no pick, record the card's main. **B10**: label `api_key` rows "Plugin" (display slice). **B11**: a farm drop's character arrives with S2a-1. **B15**: mark a defaulted main. **B16**: store which key wrote the row |
| **ROLE-1** client gating | Hide (not disable) manage-only controls for non-managers: Roster toolbar, "Add session", "Log this week's loot" (members get "View loot priority" → `lview=log` for leads), farm Track/Log Drop, "Manage characters"; leads get edit-others where the API allows | Member screenshots of Home/Roster/Loot/Tracking show no disabled lead controls | S | — | Gate |
| **DEL-1** destructive confirms | `ConfirmModal` on farm delete (visible on `focus-visible`, `aria-label` names the goal); Discord mirror/reminder defaults honest in the V2 session modal (pass `discordDeliverySummary`) | Vitest + e2e | S | — | Gate |
| **HOME-1** session truth | Shared `nextOccurrence(sessions, exceptions)` helper used by Home and Schedule; "Add session" gated on `canManage`; members get "View schedule" (the "View schedule" link ✅ #323) | Home shows a weekly series after its first occurrence | S | — | Gate |
| **KS** kill switch + reversible flip | Server-side default-shell setting (env or admin) honoured by `resolveShell`; R2 migration saves prior `ui_shell` and `alembic downgrade` restores it; one-page runbook | Staging: flip, verify users land on V2, flip back, verify legacy on next load | S | — | **Gate** (F G-9) |
| **T1 + T1b** telemetry | Ship T1 now; add 4–6 shell-tagged task-success events (loot logged, RSVP, BiS import, session created, availability painted, invite sent); gate-2 error rate per active user-day | A readout query of task completions per active static per week by shell | S | — | Gate (≥14 days before R2) |
| **CI-0** quality infra | axe (`wcag2a/2aa/21aa/22aa`) on every V2 route in both themes, `size-limit` per-route budgets, visual baselines per core screen × theme × 1440/390 + key legacy screens, FF/WebKit smoke, `--max-warnings` frozen at today's count, contrast run includes chrome + overlays | CI fails on a new serious/critical axe node, a budget breach or an unapproved pixel diff | M | — | Gate (F G-5/6/10, C2-01) |
| **V1B-1** merge with write-back | Store root cause (`staticGroupStore.ts:101-115`) fixed; §4 V1B item 1 corrected in the same PR | Bad code shows the not-found body with no stale group | S | — | Gate (HS-28) — ✅ #322 |

**P0 evidence** (the synthesis's §2, read on `main` `19026450`; the director re-checked `log_drop` on `301a1b9e` and none of these files changed in between). A fresh worktree can't reach `.superpowers/v2-audit/`; the main checkout has it (`SYNTHESIS.md` §2 and §8, `F-plan.md` G-1, `f/authz_scan.py`).
- **P0-1, farm drops (SEC-1):** `backend/app/routers/collection_goals.py:626-634` — `log_drop` calls `require_membership` with no `min_role`, so a viewer passes (`models/membership.py:23`). `:637-648` writes the `RewardDropLog` for `body.recipient_user_id` without checking the recipient is a member. `:651-661` flips the recipient's participant state from need/want to have. There is no PATCH or DELETE for drops (POST `:621`, GET `:688` only). Same PR: the participant self-upsert at `:458-510` copies `priority_rank`/`token_count` from the body for any member (`:500-503`).
- **P0-2, Log Week double-log (LOG-1):** `frontend/src/components/loot/LogWeekWizard/index.tsx:9-16` documents the duplicate risk; `:79` receives `lootLog` as `_lootLog` and never reads it; `:194-236` (`initFloorData`) fills every slot from `getSuggestedPlayer`/`getSuggestedMaterialPlayer`. No uniqueness constraint on loot-log rows.
- **P0-3, RSVP per series (RSVP-0):** `backend/app/models/schedule.py:77-96` — `ScheduleRsvp` has no occurrence date; `schemas/schedule.py:115-117` `RsvpCreate` carries only status and note; `frontend/src/components/schedule/SessionList.tsx:211-248` renders one `SessionRsvpCard` per occurrence, each calling `onRsvp(session.id, …)`; `scheduleWeek.ts:37-66` expands a series. Related: `ui/SessionRsvpCard.tsx:191` returns "today" for any past start (`diffDays <= 0`).
- **AUTHZ inputs:** `f/authz_scan.py` scans `backend/app/routers/*.py` (not `routers/admin/`): 142 mutation routes, 11 gated only by a plain `require_membership`. Four of those refuse viewers inline or pass the role positionally (`schedule.py` RSVP and availability, `lodestone.py:1825`, `mount_farms.py:433`); `log_drop` is the confirmed gap; four accept viewers: content-suggestion create and vote (D-70 says "every role"), and the participant self-state (`collection_goals.py:458`). HS-35 #2 rules them: viewers may suggest and vote only.
- **2026-09-30, three more viewer write gaps (SEC-1 plan R-P0-6, closed in #329):** `tiers.py` `claim_player` let a viewer claim a player card; `mount_farms.py` `update_mount_farm_progress` let a viewer write their own mount-farm progress, and a lead write a viewer's; `split_clear.py` `mark_split_run_cleared` checked only view permission. Viewers now get 403 on the first two (a lead targeting a viewer gets 400), and `mark-run-cleared` needs a member, which the plugin's member key still is. Self-release (`release_player`) stays open to a viewer.
- **2026-09-30, the route count (AUTHZ, #332):** the live app has 145 mutation routes, or 146 with dev-auth, which mounts only under `DEV_AUTH_MODE`. The scan reported 142 because its regex matched only `@router.` decorators, which missed `player.py`'s two `@plugin_router` routes (`plugin/player/gear-sync` and `batch-gear-sync`), so the audit-time count was 144. #329 then added the drop DELETE. The table is enumerated from the live app (`iter_route_contexts`), not from the scan. Two more viewer gaps closed in #332: `tiers.py` `update_weapon_priorities` and `static_characters.py` create, update, delete and set-primary on a viewer's own card.

**Shared code in W0/W1** (the standing rule in §1): each item's plan labels its edits V2-only or sanctioned V1 by checking importers, as §4 F1–F3 do. Known now: LOG-1 edits `LogWeekWizard`, which both shells mount (`pages/GroupViewContent.tsx:1453`): sanctioned V1, V1-visible, with a release note. SEC-1 (`log_drop`, the participant self-upsert) and GUEST-1's `by-code` payload are backend changes both shells see; neither route is one the Dalamud plugin calls, so they are browser and guest-surface work. AUTHZ audits every mutation route, including the plugin's (CLAUDE.md § Pitfalls lists them): it adds a plugin-contract check that API-key callers keep their access. SEC-1's hidden buttons are in both shells' clients. W1's accessibility tier 1 (the shared `Checkbox`/`Select`/`Input`, the badge token, the global `:focus-visible` token) and the DS primitive fixes change shared primitives: sanctioned V1 with light and dark screenshots.

#### W1 · Quick wins (decisions answered, HS-35; each a small PR; rolling)

| Cluster | Items (finding ids) | Acceptance | Size | Gate |
|---|---|---|---|---|
| Chrome & wayfinding | Page titles + polite route announcer + focus h1 (D-16); positional keys 1–5 in V2 only + keys in spine tooltips (D-17, §6.5 #12); not-found chrome (clear crumb/spine, h1, "Open Static Finder", V1B copy) (D-18); first landing → Home incl. invite accept (D-20); one unread count, drop the avatar badge (D-23); not-found/404 CTAs for guests vs signed-in (A6-33/34); rail initials `aria-hidden` (A6-39); toasts bottom-right, opaque, `status` for info (A1 §11.9) | axe `region`/`page-has-heading-one` zero; e2e: `document.title` per route; KEY 1 → Home | S each | Gate |
| Accessibility tier 1 (C2 §7 #1–3) | Badge colour token ≥ 4.5:1 + `Tag tone` for chips (C2-02); Docs copy button name + focus reveal + focusable `<pre>` (C2-08); `Field` primitive + label-aware `Checkbox/Select/Input/NumberInput/DateTimeInput` (C2-03/04, D-38); one global `:focus-visible` token ≥ 3:1 per theme (C2-06) + restore the mobile user-menu ring (§6.5 #21); modal focus restore on unmount (C2-09); dock interim: focus-in, Esc closes, ×, `Tabs` with names (C2-05, A1 M4); `inert` on collapsed catalog cards (A5-09); `Tag variant="filter"` for catalog chips (A5-08); Finder label contrast (A6-23); Board 10 px → 12 px headers (A2 R-4); sub-12 px sweep in `v2-only` files + `no-tiny-text` ratchet | axe dark/light 1440 app pages: 0 critical, 0 serious on Home/Roster/Loot/Schedule/Hub/Finder; ≈185 of the 439 dark-1440 page nodes removed by the first three items alone (≈160 from C2-02 badge colour + C2-08 copy button, ≈25 from `Field`/`Checkbox`, C2 §7 #1–2; plus ≈10 overlay nodes) | S–M | **Gate** (A11Y floor) |
| Keyboard | Rename in the kebab (A2 R-1); "This is me" on unclaimed cards + Home "Claim your card" row (D-25); picker roving radio + Enter (A3 L-26); wizard `Checkbox` (L-08); availability grid ARIA grid + Space + ≥24 px rows (A6-12); heatmap `role="grid"` roving focus + names in the description (A4 F-S11); Board cell names with player/slot + `<th scope="row">` (C2-22) | Recorded keyboard-only run: rename, claim, assign, paint availability | S–M | Gate |
| Truth & copy | Availability privacy copy V2-gated (A6-13); plugin install steps corrected (A5-26); `ShareStep.tsx:115` shell-aware; Finder/Discover empty-state pointers (E2 F-17); "group" → "static" sweep in FE strings + a string-literal lint (E2 F-19); `toastError(action, err)` on `errorHandler.ts` + lint for bare "Failed to" (E2 F-18); error modal: details behind a disclosure (A1 §11.10); one login verb + one product name (§6.5 #26); `X-Api-Key` line in CLAUDE.md fixed (✅ #325) | grep: 0 "group" in user-facing FE strings; 0 bare "Failed to" toasts | S | Gate |
| Home/Roster quick wins (A2 §14 #1) | H-5 `lview:'log'`; H-6/H-7/H-8; R-9 neutral progress fill; R-13; R-21 4 columns from ~1180; R-25 "Assign" primary; X-2 honour or retire (§6.5 #17); Team Summary + duplicate recruiting strip removed from Home (DA 5 C's two deletions; Home is Team Summary's only V2 mount, `home/Home.tsx:406`, so the PR records a ruled V2 drop in the parity matrix under HS-35 #10, and V1 keeps `TeamSummaryEnhanced` until D1); "You're all caught up" icon; Finder card two-row footer (A6-20), `auth_redirect` on "Log in to join" (A6-22), own-static state (A6-21) | Screenshots; Home ≤ 1,200 px at 1440 after the removals | S | Gate |
| Loot quick wins | L-07 "Skips #1" warning; L-12 one floor order (§6.5 #14); L-18 seed from scope; L-31 Undo toast; L-29 persist the roll + `canEdit`; L-25 helper generated from the configured order; L-24/L-34 plain labels | Vitest on the picker warning | S | — |
| Perf tier 1 (audit §7, C1) | B1, B2, B3, B4, B5, B9, B10 (drop `mode="wait"` + reduced motion), B13, B16, B17, B18, B20, B21 | Re-run `C1work/throttle.cjs`: slow-4G LCP ≤ 4.5 s on Home/Roster/Loot (from 6.1–6.4); cold Home ≤ 24 requests; JSON gzipped | S each | PERF gate via CI-0 |
| DS primitive fixes | `SegmentedToggle` selected state = surface + text, not primary fill (A2 X-3, §6.5 #15); `PageHeader` `color-mix()` (C2-29); `Toggle` tokens; `SectionLabel` primitive + adoption (C2-14); silent no-op token check in CI (C2-11); `z-*` tokens (C2-34); `formatShortcut()` everywhere (C2-33); modal `icon` required (C2-30) | design-system strict + the new checks green; before/after screenshots for the owner (X-3) | S–M | Gate (consistency) |
| Docs mechanics (S5a) | `DocsLayout` + `useDocsScrollSpy` (IO on `#main-content`), per-page titles, 72ch column, CodeBlock fixes, permalinks, prev/next, single `<main>`, sub-12 px removed, FAB "On this page" disclosure on phones | Docs pages: 0 axe critical; hash follows the click, not the load | M | Gate |
| Dead code | B21 list + `CharacterManageBridge` retirement plan recorded | knip 0 unused files in `layout/` | S | — |

#### W2 · Design decisions (the canvas)

| Item | Scope | Acceptance | Size | Depends on | Gate |
|---|---|---|---|---|---|
| **DEC-1** batched rulings — ✅ answered 2026-09-30 (HS-35: every recommendation accepted) | The owner reviews the 18 DA pages on the canvas with the audit's §8 recommendations and answers §6.5 in **three batches** (A: product rulings #1–#10; B: frame, IA and surfaces #11–#27; C: process, plan and release #28–#31), "accept all / amend #n" per batch | Rulings recorded as `HS-35…` in §2 the same day; the CC-5 reconciliation PR opens | — (owner: ≈3 sessions) | canvas mockups | Gate (everything below waits on batch A/B) |
| **CC-5** reconciliation PR | Eight ruling/canon pairs resolved (glossary "Who Needs It"/"Log"/"Goals", DS §3.20, SPEC §7 re-homing rows, F-12/X1, root PRODUCT/DESIGN five tabs, PM:142/DEF-20); S2 rulings committed to `specs/2026-09-30-stage2-rulings.md`; `RULINGS.md` index; new IDs are HS-n only | grep finds no retired term in DS-canonical docs that the UI ships; `check-docs` prototype green | S (docs) | DEC-1 | Gate (E1 M-10) |

#### W3 · Stage 2 as amended (Progress · More dissolution · mobile nav) + palette

| Item | Scope | Acceptance | Size | Depends on | Gate |
|---|---|---|---|---|---|
| **S2a** Progress = Tracks matrix | DA 10 1B + Farms-B with the six conditions; Find mode (DA 11) as the shared catalog browser; split plan as the tier row's detail (4B); Objectives → Recruit ▸ Listing + Home (5B); TrackCard → 8A; Settings ▸ Goals & Farms hidden in V2 (its Suggestions stay, labelled "Suggestions", until W4 HOME: D-70's interim host); dead mount-farm trees deleted; status vocabulary Need · Want · Have · Pass. Spec ✅ accepted 2026-10-01: [`specs/2026-09-30-s2a-progress-design.md`](specs/2026-09-30-s2a-progress-design.md) | Opens on the tier row for DEVTST (never empty); a member changes their own cell inline; a lead logs a drop from the expanded row with #1 preselected; axe clean; `?track=` deep link; desktop only, phones → W7 (S2-15) | L (five slices, ~8 PRs) | DEC-1 A, SEC-1, DA 6 BiS module, PROV-1 (S2a-1) | **Gate** (HS-2, D-18) |
| **PAL-1** palette global navigator | DA 3 Palette-A mounted in `AppChrome`; target groups; labelled search field with `lib/platform.ts` chip; share codes hidden; one-line footer hidden on touch | On `/profile`, `/discover`, `/docs`: ⌘K opens; "recruit", "docs", "hub", "player: Healer Two" all resolve | M | DEC-1 B | **Gate** |
| **S2b** More dissolution + Settings page + Hub Connections | DA 15 Settings page with Members (own row Leave incl. viewers; owner "Make owner…"); Hub ▸ Account (Preferences, Plugin & API keys, Interface/shell switch, Your data stub); DA 17 Hub tabs renamed + Connections + Sync card state machine; More deleted per A5 §4.3; `/docs/plugin`; "Switch to classic UI" reachable on phones and desktop before More dies | Every More card's destination reachable in ≤ 2 clicks from Home; an owner transfers ownership and leaves; a viewer leaves; no "Coming soon" anywhere; the plugin's three steps match the README | L (2–3 PRs) | DEC-1, X1 ruled, M1 spec for "Your data" | **Gate** (HS-3, F-12, X1) |
| **S2c** mobile navigation | DA 4 Mobile-A; `MobileBottomNav` and the Controls sheet removed; phone tier switcher in the context header | At 390: one nav, the static name visible, account menu present, spine hidden; no horizontal scroll on Home/Roster/Loot/Schedule | M | S2a, S2b | Gate |
| **PAL-2** palette actions tranche 1 | Log a drop · RSVP · Jump to player · Switch week (role-gated, with confirms) | Each verb completes end to end from ⌘K in an e2e | S | PAL-1, S2a | **Not a gate** (scheduled; DA 3 note) |
| **DENS** density rule 11 | Adopt: one toolbar row per screen; ≤ 6 Home modules above the fold at 1440×900; a second door for the same verb goes to ⌘K or an overflow, never a second button; applied inside S2a and every W4 slice, with a rollback list (Roster density toggle, Loot material door, Team Summary, fairness placement, recruiting line) | Each W4 PR body counts toolbar controls before/after | — | DEC-1 (§6.5 #16) | Gate (rule) |

#### W4 · Core surface reworks (from the canvas decisions; each a slice with the density rule)

| Item | Scope (DA) | Acceptance | Size | Depends on | Gate |
|---|---|---|---|---|---|
| **FRAME** | DA 1 Context bar: static ▾ / tier ▾ / dated week chip with shared `?week=`; rail 40 px tiles, one "you", "+" tile; guest variant; not-found crumb; DA 3 Inbox-A + Help-A | Top bar, Schedule strip and Loot dropdown show the same week after stepping; a new tier anchors to the reset (§6.5 #5); `?` opens help on every route incl. 390 | M | DEC-1 B | **Gate** |
| **HOME** | DA 5 Home-A (lead + member) with the state-aware session card; BiS module (DA 6 sub-ruling); TrackCard 8A | Home answers all four questions above the fold at 1440×900 in the Q-3 test; ≤ 6 modules; one BiS number that equals the Board's | M–L | DEC-1 A, DA 6 module, S2a | **Gate** |
| **ROSTER** | DA 6 Roster-A: Board default with row expansion + row menu; Cards compact only with the labelled needs row; gear atom = letter cells; Display ▾ toolbar; bulk "Import BiS for everyone"; Import BiS on Board no-BiS rows; "Recruit for this seat" | Toolbar ≤ 5 visible controls; Cards and Board render identical state; 8 players' BiS imported in one flow; keyboard run passes | L | DEC-1 A | **Gate** |
| **LOOT** | DA 7 ranked WNI with Queues folded in + "You" lens; DA 8 inline drop desk with receipts, skip reason, Undo; DA 9 History Rank/Logged columns + Books column + fairness strip; V2 floor log sheet replaces the wizard; Weapons ported; one split primary; History paging (B12) | Raid-night e2e: log a contested drop with a skip reason in ≤ 6 keystrokes; row shows the receipt; a member sees "You · #4"; the wizard is gone from V2; toolbar has one teal per region | L (2–3 PRs) | DEC-1 A, rank-at-award schema | **Gate** (HS-17) |
| **SCHED** | DA 12 Agenda + Planner + quick-create; per-occurrence RSVP with a standing answer (schema + migration); roster attendance grid; Played state; DA 13 shared availability grid in both mounts; D-48/D-49 inside the Planner (P2a); iCal for members; timezone combobox | "Do we have 8?" readable on the Next-up card; "Can't make Oct 6" affects only Oct 6; Best Times windows appear on the heatmap; `Edit week` stopgap deleted | L (2 PRs) | DEC-1 A, H1(1) | **Gate** (P2a, H1) |
| **RECRUIT** | DA 14 Recruit-A: V2 listing editor with autosave + `FinderCard` preview; inline applicant rows with "Accept into slot"; parchment tokens; utility-zone entry + palette | A half-written listing survives a tab switch; accept → slot linked in one step; `DiscoveryTab` no longer mounted in V2 | M | DEC-1 B, DA 10 5B | Gate (RH-5 amended) |
| **FINDER** | DA 16 Finder-A: top filter bar, ranked rows, card states, guest nudge with `auth_redirect`, viewer-local times | ≤ 6 Tab stops to the first result; 0 unnamed controls | M | `Field` (W1) | Gate (SF1 residuals) |
| **HUB** | DA 17 residue after S2b: Privacy single control, setup = 4 required, "Main" tag, Wants feeding Progress, `underline` Tabs, arrows removed, public-profile CTA | Profile setup reaches 100 % for a private user; Hub tab bar and Spine share one component | M | S2b | Gate |
| **ENTRY** | DA 18 Landing-A + dispatcher (L-1…L-3); FirstRun-A on the Hub; A6 D6 focused-entry layout for invite/plugin/callback; 404 CTA | Signed-in `/` → last static Home; a 0-statics user sees two doors + their pending application; an expired invite offers "Find a static", not login | M | DEC-1 B | **Gate** (new L1 item; F-02) |
| **M1** Plan M | Spec now (owner: 5 decisions + privacy AC: PII inventory with export/delete/anonymise per table, OAuth tokens + API keys revoked, audit-log treatment, `PrivacyDocs` updated); build after S2b; ownership-transfer UI is DA 15's | pytest per PII table; a deleted account's tokens fail; Privacy page lists every V2 data category | L | DA 15 | **Gate** (HS-13) |

#### W5 · Design-quality gate Q (rolling from S2c; F §5 as amended here)

| Item | Scope | Acceptance (measurable) | Size | Gate |
|---|---|---|---|---|
| **Q-1 rubric per surface** (pass/fail, scored by an agent as each surface becomes final; the owner walk confirms) | 1 Purpose: the page names its core question and a first-time tester answers it in ≤ 10 s (Q-3). 2 Hierarchy: one primary action per region, visible without scrolling at 1440×900 and 390×844. 3 States: every data region meets the STATES matrix. 4 Consistency: `PageHeader`/`PageShell`, shared toolbars, no retired term or "group" in user copy (grep), zero "Coming soon". 5 Accessibility: axe `wcag2a/2aa/21aa/22aa` **0 critical / 0 serious** per route, both themes; focus visible ≥ 3:1; modal focus restored; targets ≥ 24 px. 6 Responsive: MP acceptance (W7). 7 Performance: per-route `size-limit` budget; slow-4G/4× LCP ≤ 4 s and cable ≤ 2.5 s for Home/Loot/Schedule on the largest prod-copy static; INP ≤ 200 ms. 8 Copy: every error message actionable, no dead ends. 9 Visual: design-system strict clean, light and dark, visual baseline recorded; detector in-page count per page not above its W4 baseline. **Heuristic floor:** every core surface (Home, Roster, Loot, Schedule, Progress, Hub, Finder) re-scored ≥ 28/40 with no heuristic below 2; Consistency & standards ≥ 3 everywhere | Every page passes 3–9; core pages pass 1–2 in Q-3; a failure is a P1 unless the owner defers it in writing | rolling | **Gate** (amends HS-5) |
| **Q-2 cross-page consistency slice** | Inventory every pattern (headers, toolbars, empty/loading/error states, card anatomy, badges, button hierarchy, date/time/week formats, status vocabulary) and converge to one form each; the primitives from C2 §6 (`Field`, `SectionLabel`, `DataTable`, `PageShell`, `useOverlay`, soft-tone tokens, `LoadingBlock`) | One recipe per pattern in the DS; C2's matrices re-run show one row each | L | **Gate** |
| **STATES** | States matrix (every data region × loading/empty/error/partial/no-permission) in DESIGN_SYSTEM; one primitive per state; error-state tests | Matrix has no empty cell for V2 routes | M | Gate (F G-14) |
| **A11Y declaration** | WCAG 2.2 AA target + accessibility statement page; NVDA smoke on Home, Loot ▸ Log, Schedule; keyboard-only recording of 5 core tasks | Statement published; recordings attached to R1 | S | Gate |
| **Q-3 usability test** | 5 raiders (2 leads, 3 members, via Discord), unassisted: next session + RSVP; who gets the next drop; log a drop; set availability; how close is the static; join/find a static | ≥ 80 % task success, no task with > 1 critical error; failures become PP items | S (+ recruiting time) | **Gate** |

#### W6 · Docs, help, onboarding, feedback

| Item | Scope | Acceptance | Size | Depends on | Gate |
|---|---|---|---|---|---|
| **S5b** docs content | E2 §6 rewrite list + §7.1 IA (Start by role · Guides · Concepts · Reference · Project); roles matrix generated from `permissions.ts` with a backend parity test; shortcuts generated from `V2_SHORTCUT_GROUPS`; glossary; `/docs/plugin`; What's new + where-did-it-go map; API docs from OpenAPI; Privacy per-feature table; drift-guard manifest test of UI labels used in docs | Manifest test green; 0 claim rows V1-ONLY/FALSE-BOTH in a re-run of E2's tables on Quick Start/How-To/FAQ | L | S2b, W4 surfaces final | **Gate** (F G-4; amends gate 1) |
| **HELP** | DA 3 Help-A shipped with FRAME; docs link in the landing footer | `?` reachable on every route at 1440 and 390 | (in FRAME) | FRAME | Gate |
| **ON1** first-run / "what moved" | One-time dismissible V2 intro (five tabs, legacy → new-home map, Switch back link; Create/Join/Find for static-less users); the new-member claim prompt after invite accept | Shown once (persisted); keyboard/SR accessible; T1 events shown/dismissed/switched-back | S/M | S2c | **Gate** (F G-3) |
| **FB** feedback channel | "Send feedback about the new UI" in the V2 account menu; switch-back asks one optional reason (logged with T1); `v2-parity` label + intake rule | Feedback lands in the tracker with shell + route | S | T1 | Gate (F G-8) |
| **DOCS-INT** internal docs | E1 §7.7 order: M-1/M-2/M-6/M-7/M-9 fixes and S2 rulings committed before the S2 spec PR; banners + the five archives + `RULINGS.md` + generated slice `INDEX.md` with the S2 spec PR; DS contract sync, one privacy source, `ENFORCEMENT.md`, `check-docs` in CI before Phase P; §4 tracker table | `check-docs` green; §4 has a state per item | M | — | Gate (docs of record) |

#### W7 · Mobile pass (MP; per surface once S2c lands; measurable)

| Scope | Acceptance | Size | Gate |
|---|---|---|---|
| Every V2 route (in-static, Hub, Finder, Recruit, Settings page, notifications, landing, entry pages, docs) at 360–430 px | No horizontal scroll; the primary task of each route completable at 390×844; primary actions ≥ 44 px, all targets ≥ 24 px (Roster's disabled circles gone with DA 6); no chrome overlap; screenshots per route in both themes; axe 390 runs 0 critical/serious | L (rolling) | **Gate** (F G-11; MP acceptance rewritten) |

#### W8 · Phase P (owner taste pass, timeboxed, rolling)

| Scope | Acceptance | Gate |
|---|---|---|
| The owner walks each surface after its Q-1 pre-score with the punch list pre-filed; fixed sessions per week; anything above M goes to "After 3.0.0" unless P0/P1; deferrals recorded by the owner only | Every core page has an owner sign-off line in §4; the "revisit when whole" list (memory) closed or deferred in writing | **Gate** (HS-5 as amended: parity + Q + P) |

#### Release, soak, deletion

| Item | Scope | Acceptance | Gate |
|---|---|---|---|
| **BETA** | Lift the admin gate for opted-in volunteers (a Discord call for statics) for 1–2 weeks with T1 live | ≥ N distinct statics used V2 for 2 raid weeks, where the owner sets N in R1 (the gate can't pass until R1 records it); switch-back reasons collected; every reported P0/P1 fixed or deferred in writing | **Gate** (overturns part of HS-25; §6.5 #29) |
| **R1** release plan | Comms (what's new + where-did-it-go), KS runbook, soak playbook (named reviewer and day; KS triggers e.g. V2 error rate > 2× V1 for 48 h or switch-back > 25 % in week 1; written exit review against gate 2), browser-support statement, plugin deep-link table verified | Documents linked from §4 | Gate |
| **R2 3.0.0** | Reversible flip migration; plugin deep links land on the intended V2 view (table + test per link); `/plugin-auth` works in V2 chrome; rehearsal on the prod DB copy (:5433) | All R2 AC green on staging | Gate |
| **Soak** ≥ 4 weeks | Playbook executed weekly | Exit review signed | Gate for D1 |
| **D1** V1 deletion | New D1 plan written at R2 (the 2026-07-03 plan is history); removes `GroupView`, the legacy host, the V1↔V2 twins (C1 §5), the shared wizard; frees §7 B8 | Bundle: V2 static route ≤ 550 KB gzip; knip clean; the DS/spec archive per E1 §7.5 | — |
| **After 3.0.0 / not a gate** | S6 tranches 2+ (content search); F3 docs/tooling hygiene (jscpd count, FRONTEND_STRUCTURE rows, suppressions count, CLAUDE.md map); Admin V2 (AD2+); plugin off-hand mapping; Ring 2/3; DA 17 Wants-as-side-card; A2 DA-4 B revisit | — | — |

**Net effect vs the plan audit's (F) §8 sequence:** same skeleton, plus a named W0 (safety), the W1 quick-win clusters with acceptance, the DA-driven W4 with per-surface gates, the heuristic floor and detector baseline in Q-1, S5b/HELP/ON1 explicitly gated, and PAL-2 scheduled but un-gated (reconciling D CC-4 with F #3). Estimated PRs to R2: ≈55–70; owner touchpoints ≈45–55 (three decision batches + Phase P walks + R1 sign-off).

### 6.4 How §4's items map onto the waves

| §4 item | Wave | What changes |
|---|---|---|
| H0 this plan | — | ✅ #321 |
| P1 safety + quick parity | W0 | ✅ #323; it shipped HOME-1's "View schedule" link. HOME-1's shared `nextOccurrence` helper and the `canManage` gate on "Add session" remain |
| V1B item 1 | W0 V1B-1 | ✅ #322 |
| V1B items 2–3, X1 | — | Still **not a gate** (HS-28), in parallel |
| S2 Stage 2 | W3 S2a · S2b · S2c, PAL-1, DENS | The spec-first boundary stands; S2a's scope becomes DA 10's answer, S2b adds the Settings page (DA 15) and Hub Connections (DA 17), S2c is DA 4. §4 S2's settled inputs are amended where an HS-35 answer overturns them (noted there) |
| P2a Schedule rows | W4 SCHED | D-48/D-49 land inside DA 12's Planner |
| P2b Home rows | W4 HOME | HS-35 #10: P2b becomes a Home information-hierarchy spec rather than four restored V1 modules |
| M1 Plan M | W4 M1 | Spec now; build after S2b; privacy acceptance added |
| H1 typical-week + H-10 | W4 SCHED (depends on H1(1)), DA 13 | Unchanged dependency: P2a/SCHED waits on H1(1) |
| T1 telemetry | W0 T1 + T1b | Adds 4–6 task-success events |
| S5 docs restyle | W1 docs mechanics (S5a) + W6 S5b | S5b (content) is a gate |
| S6 ⌘K actions | W3 PAL-1 (gate) + PAL-2 (not a gate) | The palette becomes a global navigator first; the four-verb action tranche is scheduled after S2a but doesn't gate the release |
| F1–F3 Phase F | W1 clusters, W5 Q-2 | Items a W1 cluster or Q-2 fixes close there; the rest stay in §4 F1–F3. F3's docs/tooling hygiene isn't a gate (HS-35 #31) |
| MP mobile pass | W7 | Acceptance made measurable |
| PP Phase P | W8 | Walks follow each surface's Q-1 pre-score |
| R1, R2, Soak, D1 | Release | KS (W0) adds a kill switch and a reversible flip; BETA, an invite-only cohort before the flip, is a gate (HS-35 #29) |

New work with no §4 item: SEC-1, AUTHZ, LOG-1, RSVP-0, GUEST-1, GUEST-2, PROV-1, ROLE-1, DEL-1, KS and CI-0 (W0); the W1 clusters; DEC-1 and CC-5 (W2); FRAME, ROSTER, LOOT, RECRUIT, FINDER, HUB and ENTRY (W4); gate Q (W5); HELP, ON1, FB and DOCS-INT (W6); BETA.

### 6.5 Owner decisions (DEC-1)

Batches match §6.3 W2 DEC-1. **All 31 answered 2026-09-30: the owner accepted every recommended answer (HS-35).** Each line's "→" answer is the ruling; cite it as "HS-35 #n". Each line: the question · options · **recommended answer** · what it amends.

#### Batch A — product rulings (unblock W3/W4)

1. **What is Progress?** 1A as ruled (Farms · Split Clears · Objectives, opens on Farms) · 1B Tracks matrix, tier pinned first, Farms as matrix · 1C no tab. **→ 1B with Farms-B.** Overturns S2-1/S2-2; amends F-04, HS-2 wording. (DA 10)
2. **Who may log a farm drop / write status?** 9A self = member, others = lead, recipient must be a member, viewers refused, delete route · 9B lead-only · 9C open + audit. Plus the four viewer-accepting routes (content suggestions, votes, participant self-state): (a) viewers suggest and vote only · (b) fully read-only · (c) as is. **→ 9A now; routes (a).** Resolves X2. (SEC-1/AUTHZ)
3. **Objectives' home.** 5A Progress peer view · 5B Recruit ▸ Listing (edit) + Home (read) · 5C track rows flagged "Listed". **→ 5B now, 5C after release.** New ruling; amends HS-2's list. (DA 10)
4. **Guest payload.** Should an anonymous share-code visitor receive members' Discord usernames/avatars in `by-code`? (a) omit for non-members · (b) keep (Finder/applicants need lead handles) · (c) omit except the owner's handle. **→ (a), with (c) if the Finder needs a contact.** New ruling; privacy. (GUEST-1) (a), ruled R-G1-1 in GUEST-1: nothing a guest uses needs a handle; the Finder uses the listing's opt-in contact. Sibling payloads → GUEST-2. **Complete** with GUEST-2 ✅ #347: the eight sibling reads drop identity for non-members, and an unlisted static's recruiting contact leaves `by-code`/`GET /{id}` (R-G2-12), so the only identity a non-member sees is a contact a lead published in a live listing.
5. **The week's anchor.** (a) re-bucket every static to the Tuesday reset with a migration now · (b) new tiers anchor to the reset by default; existing tiers get a lead "Align week to the reset" action; chip + shared `?week=` ship independently · (c) keep the tier-creation anchor, make it legible. **→ (b).** PRODUCT_MODEL §3.2-level; A4 DA-4 wanted (a). (DA 1)
6. **One BiS definition.** A "complete" everywhere · B two quantities, one bar (done + needs-augment + to-go; "has BiS" = has targets) · C "obtained" (V1). **→ B.** New ruling; feeds Home, Roster, Board, Hub, Progress. (DA 6)
7. **RSVP unit.** A per-occurrence + standing answer (schema) · B per-series with one series card (interim) · C availability-derived + override. **→ A, with B as the interim before 3.0.0 if the schema slips.** Re-opens holistic #34 (U-12). (DA 12)
8. **Loot view structure.** A ranked Who Needs It with Queues folded in + one split "Log M10S ▾" · B floor-first console · C flat five-way. **→ A**, plus the V2 floor log sheet replacing the wizard. Amends R-1/R-3, D-23; resolves HS-17. (DA 7)
9. **Contested-drop moment.** A hardened modal · B inline drop desk row · C docked sheet. **→ B**; needs rank-at-award + skip-reason columns (schema). (DA 8/9)
10. **Home composition.** A week board by floor with a member "You" band · B answer strip · C spec-faithful trim. **→ A**, with C's two removals (Team Summary, duplicate recruiting strip) as a quick win now; P2b becomes a Home information-hierarchy spec, not four restored V1 modules. Amends F-08, D14/R-40 placement, R-RH-P, R-E2-I. (DA 5)

#### Batch B — frame, IA and surfaces

11. **App frame.** A Context bar (static ▾ / tier ▾ / dated week ▾, labelled search, one bell, 40 px rail tiles + "+") · B week pills on the spine + expandable rail · C fix in place. **→ A** (C as the floor if A slips). Amends DS §3.9, §3.20, §3.35. (DA 1)
12. **Tabs and keys.** A five tabs + utility zone (Recruiting, Settings), keys 1–5 positional in V2 · B Recruiting inside Roster · C status quo. **→ A.** Amends DS §3.13; R-D14 shortcut rows. (DA 2)
13. **Palette, inbox, help.** Palette-A global navigator (gate) with the four-verb action tranche scheduled after S2a but not gated · Inbox-A popover with one count · Help-A `?` in both bars + ⌘K Help. **→ all three.** Amends DS §3.10, HS-20, PM §6.2 "Stages 5–6". (DA 3)
14. **Loot floor order.** F1→F4 everywhere (reverses the D3 F4→F1 banding) vs keep two orders. **→ F1→F4.** (A3 L-12)
15. **`SegmentedToggle` selected state.** Change the DS primitive from primary fill to surface + text (before/after shots attached) vs keep. **→ change.** (A2 X-3)
16. **Density rule 11.** Adopt (one toolbar row; ≤ 6 Home modules above the fold; a second door for the same verb → ⌘K/overflow) and apply inside the remaining slices with a rollback list · B per-user Simple/Detailed preference · C keep as built. **→ adopt.** Amends D-01 (partial), D8 R-20/R-26, F-08, D14 R-40, R-RH-P. (D CC-3)
17. **"Hide unclaimed / BiS banners" toggles.** Honour them in V2 vs retire with a ruling. **→ retire** (DA 6's cards no longer show the banners the same way). (A2 X-2)
18. **Roster model.** A sharper roles (Board default with row expansion, compact Cards with a labelled needs row, letter-cell atom, Display ▾ toolbar, no density toggle) · B one table · C status quo + fixes. **→ A.** Overturns D-01, D-10 fold, R-E2-D; retires the circle atom. (DA 6)
19. **Schedule layout.** A Agenda + Planner + quick-create · B week board · C repair. **→ A.** Overturns F6e §2.a in part, §2.f, §2.j.4. (DA 12)
20. **Availability home.** A one grid, two mounts (Schedule Planner + Hub) · B Hub-only · C no heatmap. **→ A.** Amends H-10's home. (DA 13)
21. **Settings.** A page `/group/:code/settings/:section` + Hub ▸ Account; Leave in Members (own row, incl. viewers) and the Hub kebab; owner "Make owner…"; Delete in Danger zone · B fixed dock · C page + popover. **→ A.** Overturns DS §3.14; amends F-12 detail (X1); also re-rule the mobile user-menu focus-ring exception (`UserMenu.tsx:100`) → **restore the ring** (WCAG 2.4.7). (DA 15)
22. **Recruiting.** A keep the route + wayfinding + V2 editor + "Accept into slot" · B fold into Roster · C spine tab. **→ A.** Overturns RH-5; keeps RH-4. (DA 14)
23. **Hub.** A five tabs renamed (Summary · Jobs & BiS · Availability · Wants · Privacy) + Connections with the Sync card state machine · B four tabs · C one page. **→ A.** Overturns H-6 labels only; amends R-PH1-F; refines HS-3. (DA 17)
24. **Finder.** A top filter bar + ranked rows · B left rail + rebuilt card · C grouped by fit tier. **→ A.** (DA 16)
25. **Landing and first run.** Landing-A two doors + FirstRun-A Hub block · Landing-B · FirstRun-B Finder. **→ Landing-A + FirstRun-A**; add "L1 · Landing and entry" to HS §4 as a gate. Builds F-02; supersedes `Layout.tsx:71`; narrows V1B Q2. (DA 18)
26. **Names and verbs.** One product name in-app ("FFXIV Raid Planner") while the plugin listing stays "XIV Raid Planner" as published, or rename the plugin listing too; one login verb "Sign in with Discord". **→ one name in-app now; decide the plugin listing name with the plugin's next release.** (A5-26, A6-31/32)
27. **Vocabulary.** (a) "Floor" (shipped, ~44 hits) vs "Fight" (DS §2.3) → **keep Floor, amend the glossary (U-1)**; (b) keep "Who Needs It" and amend the glossary vs rename the segment "Priority" → **keep Who Needs It** (the owner's headline); (c) farm status = **Need · Want · Have · Pass**; (d) Hub tab "Tracking" → **"Wants"**. Amends DS §2.3 (CC-5 a/b). (E2 F-14, A5-07, A6-16)

#### Batch C — process, plan and release

28. **Quality bar.** Adopt Q (rubric incl. the heuristic floor ≥ 28/40 per core surface, WCAG 2.2 AA axe-zero-critical/serious, perf budgets, consistency slice, 5-user test) as a 3.0.0 criterion. **→ adopt.** Amends HS-5. (F #1, #16) **Answered 2026-09-30: adopted with the plan (HS-32).**
29. **Beta and rollback.** Reinstate a 1–2-week opt-in cohort before the flip (a) opt-in banner for all · (b) invite-only via Discord · (c) skip and rely on KS; and build KS + a reversible migration as a gate-1 prerequisite. **→ (b) + KS.** Overturns part of HS-25. (F #2, #11)
30. **Sequencing and mechanics.** S2a spec/build may start after batch A while B continues (amends §4 S2's spec-ready boundary); T1, M1 spec, AUTHZ, KS, CI-0 and the W1 clusters start now; decision batches with defaults; controller-owned engineering rulings (#6/#7 extraction and slice cut); ceremony by risk tier (A/B/C); HS §4 tracker table; ROLLOUT/V2_COVERAGE/RECONCILIATION frozen as history now and the five foundation docs archived (amends HS-16's timing); new rulings are HS-n only; sizes recalibrated (S < 700, M < 1,500). **→ all.** (F #5, #6, #9, #14, #15; E1 §7)
31. **What is not a gate.** S6 action tranches beyond the four verbs; F3 docs/tooling hygiene; Admin V2; plugin off-hand; content search. **→ confirm not gates**; the four-verb tranche is scheduled after S2a. Amends PM §6.2 gate 1 wording. (F #3, #4; D CC-4)

## 7. Change log
- 2026-09-30: written (session 2). Rulings HS-1…HS-25.
- 2026-09-30: director vet 1 fixes; HS-26…HS-29.
- 2026-09-30: director vet 2 fixes; HS-30, HS-31.
- 2026-09-30: director vet 3 fixes (View-As Leave guard target, `X-View-As` scope, F3 V1 labels).
- 2026-09-30: the V2 audit's plan adopted as §6 (W0–W8 + gate Q; decisions §6.5); HS-32…HS-34; H0 ticked (#321). The owner then accepted all 31 recommended answers (HS-35), with dated notes on HS-2/3/4/5/16/17/20/25. Director vet fixes: gate lists aligned with HS-35 #29/#31, P0 evidence and shared-code labels under W0, ID-namespace key, §4 S2/S6/F3 and §5 notes, stale line references.
- 2026-10-01: the S2a spec accepted by the owner (`specs/2026-09-30-s2a-progress-design.md`); HS-36 (self-service with attribution); §4 S2's acceptance admits S2a's declared V1 deltas; W3 S2a resized to five slices, ~8 PRs, desktop only (phones → W7), depending on PROV-1; matrix §12 A7 closed (#329).
- 2026-10-01: the S2a parity matrix signed by the owner (`specs/2026-09-30-s2a-parity-matrix.md`, 125 rows; G-4 and G-14 designs, G-27's port and the §12 A9 sweep approved). Spec errata in the same PR: the whole Browse Catalog tab, not only Track, is a dated interim row from S2a-2 to S2a-4 (§4, §8), and the ⌘K "Go to Progress" label ships in S2a-2 rather than S2a-5a (§6).
- 2026-10-01: HS-37 (#331: members and up may duplicate a static; linked-only rows don't offer it, B12). §6.3 AUTHZ row: W0 AUTHZ-2 ✅ #344 (the #331 gate, and every AUTHZ row probed, #333).
- 2026-10-01: §6.3 W0 PROV-1 row added, ✅ #345 + #346 (write provenance on loot, material, book and farm-drop rows, HS-36), with the rulings that bind the display slice, S2a-1 and self-service (R-PV-1/2/3/4/7/8; B9–B11, B15, B16).
