# Rollout Roadmap — Dual-Shell Parity Restoration → v2 Default → Sunset

> **Status:** Canonical plan of record from 2026-07-11. Supersedes the parity-flip spec's
> end-state (hard cutover) — the user's holistic review found real capability regressions
> and chose a **dual-shell A/B rollout** instead. Written after the 2026-07-11 holistic
> review (13-auditor workflow, 164 findings, 15/15 high-severity claims verified; report
> artifact linked in memory `project-holistic-review-2026-07`).
>
> **User decisions locked 2026-07-11:**
> 1. **Restore legacy; v1 is the default on main** + "Try the new UI" opt-in.
> 2. **Legacy is FROZEN** (bugfix-only, zero feature backports) with **criteria-based sunset**.
> 3. **Expanded roster card = restore + restyle** legacy GearTable/PlayerCard internals.
> 4. **Merge foundation→main EARLY** (after Phases R+A), v1-default; later phases land as
>    normal PRs to main.

---

## 0. Why this plan exists (root cause, stated honestly)

The F1–F6+flip run built v2 faithfully **to its specs** — every per-slice review verified
spec-conformance. Nothing ever verified **v1-affordance-conformance**: no inventory of
every user-visible affordance in legacy existed, so spec-level simplifications (read-only
cards, canManage-gated Board, "no one needs it" disabling Assign, dropped
expanded/collapsed axis, dropped QoL like gear-icon editing) compounded silently, and the
P3 deletion removed the escape hatch before the holistic review happened. **The
correction:** restore the dual shell, run a systematic affordance-parity audit (Phase B),
and never again replace a surface without an affordance inventory signed off first
(standing rule §8).

## 1. The target state, in order

```
R  Restore dual shell (legacy back, user-facing toggle, v1 default)   ← unblocks everything
A  v2 flip-debt fixes (capability/correctness, 12 items + quick wins)
G  MERGE foundation→main (v1 default, "Try the new UI" opt-in)        ← user-owned
B  v1→v2 affordance-parity matrix (user reviews → restoration backlog)
C  Roster rework (expanded/collapsed cards, gear icons, on-card editing)
D  Loot/History QoL restoration (scope = Phase B decisions)
E  Polish pass (holistic-review mechanical items + impeccable-assisted)
F  Chrome-seam mitigation (user menu, docs light pass, rail-less UserMenu)
P  Beta polish walkthrough (page-by-page UX/styling audit, stepped WITH the user)
⚑  UN-GATE the v2 opt-in (D7) — deliberately the LAST step before H
H  Feedback loop → flip default to v2 (3.0.0) → criteria sunset → delete legacy
→  Rings 1–3 per PRODUCT_MODEL §7 (Person layer, tracks, More dissolution)
```

Phases B–F land as normal PRs to `main` after G. Order within B–F is flexible; C is the
highest user-priority item after A.

> **2026-07-25 re-sequencing (ratified):** the trailing "→ Rings 1–3" line is superseded
> for its Person-layer portion — the user's 100%-V2-coverage directive pulls **B8 (v2
> chrome on all routes)** forward, per `RECONCILIATION.md` §"Next moves" item 4 and the
> staged plan in `V2_COVERAGE_PLAN.md` (Stage 1 lands after Phase G; the chrome
> affordance-parity matrix is a user-signed pre-code gate). Everything else in this phase
> order is unchanged.
>
> **2026-07-25 launch gate (user decision):** Phase G's opt-in ships **dark** — the
> "Try the new UI" banner is admin-gated (`TryNewUiBanner.tsx`), so the merge delivers
> the dual-shell code while regular users and guests cannot enter v2; admins dogfood in
> production and `?shell=v2` remains a deliberate power-user escape hatch. Un-gate when
> `V2_COVERAGE_PLAN.md` Stage 1 lands ("anything reachable from v2 stays in v2" + the
> Ring-0 blemishes). Consequently Phase H's sunset inputs ("v2 opt-in available ≥4
> weeks", opt-in cohort telemetry) start their clock at **un-gate**, not at the G merge,
> and G's release-note entry reads "limited preview" rather than "opt-in beta".
>
> **2026-07-25 (post-Stage-1) un-gate re-sequencing (user ruling):** Stage 1 landed and
> the un-gate criterion above is **superseded** — the un-gate now moves to the **very
> end** of the build sequence: after Phases B–F, coverage Stages 2–6, and a **new
> Phase P — beta polish walkthrough**: a page-by-page UX/styling audit stepped through
> one-by-one WITH the user, addressing any changes they want before real users can
> opt in. Rationale (user's words): first-time users should get the best possible
> initial experience. Until then v2 stays admin-gated; `?shell=v2` remains the
> power-user escape hatch; admins keep dogfooding in prod. Phase H's opt-in clock now
> starts at that final un-gate.

---

## 2. Phase R — Restore the dual shell ✅ COMPLETE (2026-07-11, PR #174 → foundation `329c394`)

> Executed per `specs/2026-07-11-phase-r-dual-shell-restore.md`; all exit-gate clauses
> verified (both smoke suites in one run, full CI gate, byte-freeze loops, live browser
> validation both shells × both themes). Restored files are back under the byte-for-byte
> freeze (baseline = f45a241). Follow-up candidates surfaced by review are listed at the
> end of §3.

**Goal:** both shells live again behind a **persisted user preference** (not just a URL
param), legacy byte-for-byte at its P2 state + P3's keeper fixes, v1 default.

**Restoration mechanics (do not blind-revert):**
- Restore source = `f45a241` (the P2-final tree; `cf25c92^`). The P3 squash `cf25c92`
  bundled deletions WITH keeper changes that must survive: More-page Loot-History card →
  `lview` fix, `gearSubTab` removal end-to-end, tier-snapshot-fetch skeleton,
  GearSyncDashboard→PluginPage re-home + PluginPage vertical restructure, suppression
  prunes, smoke.spec v2 rewrite, lodestone e2e retarget.
- Method: `git checkout f45a241 -- <deleted-file-list>` (deletion inventory = parity-flip
  spec §6 "Dies at P3" list) to resurrect files; **reconcile `GroupViewContent.tsx` by
  hand** — current head made slots unconditional; the resurrected legacy `GroupView.tsx`
  needs the `!slots?.x` fallback logic back, while keeping P3's keeper edits. This
  reconciliation is the riskiest task → opus/fable implementer + redesign-reviewer.
- Reinstate the route gate (P2's `GroupRoute` pattern) reading, in precedence order:
  `?shell=` URL param (support/links) → persisted preference → default `legacy`.
- **Toggle UX:** preference in localStorage (`ui-shell`) + mirrored to a backend user
  setting when cheap (cross-device). Entry points: a dismissible "✨ Try the new UI"
  banner/button in the legacy Header + "Switch to classic UI" in the v2 user menu.
  Both fire an analytics event (`ui_shell_toggle`, direction + surface) — **the sunset
  criteria depend on this telemetry existing from day one.**
- **Legacy e2e:** resurrect P2's legacy-pinned smoke as `smoke-legacy.spec.ts` and FIX the
  6 known selector/data rots (they are test drift, not product bugs — settings-button
  selector, guest "Private Static" data-state, Schedule copy, Lodestone mock). Keep the
  v2 `smoke.spec.ts` untouched. Both suites must pass before G.
- Re-freeze discipline: legacy files back under the byte-for-byte contract
  (bugfix-only; any edit needs the sanctioned-edit justification in the PR body).

**Exit gate:** both shells render `/group/DEVTST` correctly; toggle round-trips and
persists; both smoke suites green; full CI gate green; browser validation both shells,
both themes.

## 3. Phase A — v2 flip-debt fixes ✅ COMPLETE — 16/17 (item 10 partial) (2026-07-12, PR #175 → foundation `6c9da75`)

> **16 of 17 items fully landed** as 13 tasks; **item 10 (void'd-promise sweep) is partial** — a bugfix-only micro-slice remains (see below). Spec: `specs/2026-07-11-phase-a-flip-debt-fixes.md`
> (status header carries the merge record + the View-As/Leave decision point). Deferred
> follow-ups from the branch: frozen-file void sites (SplitClearPlanner ×4,
> LodestoneSearchModal ×12) + remaining `actionsForPlayer` bindings
> (claim/release/reset/duplicate, same dropped-rejection class) + Home.tsx unguarded
> mount fetches → one bugfix-only micro-slice; the rest in spec §4.
> **NEXT = Phase G (§4, USER-OWNED).**

From the verified holistic-review list + the user's review. All v2-side; legacy's return
lowers the stakes but every one is still required before v2 can ever become default:

1. **Add-player dead-end** — wire toolbar + open-seat buttons to `AddPlayerModal`; add
   configure/remove affordances on open-seat cards; clean the 6 orphan DEVTST slots.
2. **Member gear self-edit** — Board cells gated per-row (`canEditPlayer`), not
   screen-level `canManage`. (Full member editing UX arrives with Phase C cards.)
3. **Tome-weapon affordance** — interim kebab item if Phase C is far; otherwise C covers
   it via the restored GearTable (which contains the pursuing toggle). Do NOT delete
   `BiSSourceSelector` before this lands.
4. **Danger Zone** — point Delete at the real settings tab; hide Leave/Archive until
   implemented, or implement Plan M leave (it is a real prod request).
5. **Wire rail stubs** — Player Hub → `/profile`, Static Finder → `/discover`
   (`NewShell.tsx:307,315`).
6. **Home activity feed** — fold lootLog/materialLog rows into `deriveActivityItems`
   (respect the privacy model); "who got what" must be answerable.
7. **404 catch-all route** (styled NotFound; `App.tsx` has none — blank page today).
8. **Auth 429 false-logout** — `refreshAccessToken` clears user only on 401/403;
   429/5xx/network = transient.
9. **BYDAY=SA** — seed the recurrence day-picker from the chosen start date's weekday
   (in-app engine and Discord backend currently disagree).
10. **Void'd-promise sweep** — ~10 v2 call sites + Roster's lying "Link copied" toast.
11. **UserMenu on rail-less pages** — fix the `railPresent` predicate (no sign-out on
    /discover, /docs today).
12. **Assign-anyway** (user request) — remove `disableAssign={!row.top}`
    (`FloorCard.tsx:142`); RecipientPicker opens on All-members scope when the priority
    list is empty. Loot that drops must always be assignable.

**User-reported quick wins (fold in, they're tiny):**
- Avatar/initials centering (rail static avatars, card identity avatars — visibly
  off-center at DT/TE and card icons).
- TopBar icon order → `⌘K · invite · bell · theme │ settings` (settings far-right with a
  vertical divider to its left; theme moves left of the divider).

**Phase R follow-up candidates (surfaced by the #174 review; fold in where cheap):**
- **Mobile shell toggle** — neither toggle affordance is reachable on mobile (banner is
  `hidden sm:block`; v2's UserMenu lives in the desktop-only rail). A desktop v2 opt-in
  mirrors server-side, so a phone then hydrates v2 with only the per-load `?shell=legacy`
  escape. Add a mobile-reachable toggle (e.g. v2 More-page entry + mobile banner row).
- **Slot-gate the v2 splitClear fetch** — restored GVC fires the legacy split-clear fetch
  on the roster tab even in v2 (contained: store-local error, nothing renders it; wasted
  GET + guest 403 noise). Gate on `!slots?.roster`.
- **dev_auth normalizes `tab_persistence` on login** (the `is_public` precedent) — the
  legacy e2e run surfaced drifted dev-DB state; make suite preconditions self-restoring.

## 4. Phase G — Merge foundation→main (user-owned, EARLY)

Gate = R + A complete. Checklist (user executes):
- [x] Local `smoke` + `smoke-legacy` + `contrast` runs attached to the PR
- [x] One manual mobile-viewport pass (both shells, four Ring-0 screens) — `25de30e`
- [x] Migration rehearsal + prod-data testing against a **Railway DB copy**
- [x] Release notes: public 2.1.0 entries (now "limited preview" + self-service leave,
      per the 2026-07-25 launch gate) + `CURRENT_VERSION`
      → **2.1.0** (3.0.0 is reserved for the v2-default flip in Phase H) — `71b854f`
- [ ] Ratify list in the PR body (D-P3 decisions incl. SplitClearPlanner/TeamSummary
      drops — note both are recoverable and Phase B may resurrect their capabilities) — **awaits user ruling on the 2 decision points**
- [ ] User reviews + merges; main's 5 required checks + reviews stand

After G, `main` is live with v1 unchanged for users + opt-in v2. Branch freeze ends;
B–F land as normal PRs.

## 5. Phase B — v1→v2 affordance-parity matrix

**Method (the missing artifact from the original run):**
0. **Mine prod usage analytics first (user decision 2026-07-11).** The analytics system
   already records what the matrix needs: every event carries `page_url` (legacy URLs
   encode tab/sub-tab params → tab-level usage ranking), plus workflow events wired via
   the event bus (`services/analytics.ts:50-58`): `player_gear_changed` (on-card gear
   editing frequency — directly informs the Phase C card design), `loot_logged`/
   `loot_deleted`, `modal_open`/`modal_close` with payload (which editing modals users
   actually open), `tier_changed`, `player_update`. Pull via the admin analytics API
   (`GET /api/admin/analytics/{usage|overview|top-statics}`) as the admin user, or
   read-only SQL against the **Railway DB copy** (make the copy once — it also serves
   Phase G's migration rehearsal). READ-ONLY; never write to prod. Caveats to state in
   the deliverable: DNT-respecting client (undercounts), payload richness varies per
   event, check `AnalyticsDailyAggregate` retention before trusting long windows.
   Output: a usage ranking per page/tab/workflow, annotated onto every matrix row so
   restore/drop decisions are data-informed rather than memory-informed.
1. Enumerate EVERY user-visible affordance per legacy surface, from the restored code:
   roster (PlayerCard expanded/collapsed, GearTable, InlinePlayerEdit, sort presets,
   setup banners), loot log/history (SectionedLogView, WeeklyLootGrid, AllWeeksView,
   filters, Alt-shortcuts, quick-log paths, edit affordances, TeamSummary ledger),
   schedule, settings, More-page capabilities.
2. Classify each: **KEPT** (v2 equivalent exists) / **LOST** / **CHANGED** (different
   interaction for the same job).
3. Deliverable: `design/redesign/specs/v1-v2-parity-matrix.md`.
4. **⏸ USER CHECKPOINT:** user marks each LOST/CHANGED row `restore` / `drop` /
   `redesign`. That marked matrix is the binding backlog for Phases C/D.

## 6. Phase C — Roster rework (restore + restyle) — top user priority

- **Expanded ⇄ collapsed card axis returns** (persisted preference, like legacy).
  Collapsed = current v2 compact card. Expanded = restored legacy GearTable/PlayerCard
  internals **restyled with v2 tokens**: real gear item icons, click-to-cycle
  have/augmented per slot, tome-weapon pursuing toggle, iLvl detail.
- Wire through the existing shared state machine (`computeGearSlotUpdate`,
  `getNextGearState`) — one mutation path for cards AND Board.
- Per-player edit gating (`canEditPlayer`) so members manage their own card.
- Board stays as the roster-wide matrix view; Cards become the daily driver again.
- Resolves holistic items 1/2/3 per the user's stated preference.

## 7. Phases D/E/F — QoL restoration · polish · seam

- **D — Loot/History QoL:** scope = Phase B matrix decisions. Known candidates: AllWeeks
  spreadsheet view, weekly-grid density, Alt-shortcuts, TeamSummary books/materials
  ledger (D-P3-3 gap), edit-flow affordances, materials summary. **Received from the
  Phase-C plan (2026-07-26):** D-18 Split Planner wiring (ruled RESTORE; entry point per
  flow-map F-04, deferred into this phase's design), retargeting the D-05 gear→ledger
  jumps from the History deep-links to Loot ▸ Log once the triad ships, and D-55's loot
  half (grid-cell / table-row modifier-clicks).
  **Stage-2 receiving note (same date):** the F-05(b) Team Gear-Sync dashboard moves from
  PluginPage into the Roster area when Stage 2 dissolves the More/Plugin destinations.
  **✅ Status (D14b, 2026-09-25): Phase D complete except D-18 (R-41: no Progress tab yet).** Shipped
  as D0 #223 · D1 #224 · D2 #225 · D3 #226 · D4 #235 · D8 #236 · feedback polish #242 · D5 #243 ·
  D6a #244 · D6b #245 · D7a #257 · D7b #261 · D9a #262 · D9b #264 · D10 #265 · D11 #266 (+ #268) ·
  D12 #269 · D13 #271 · D14a #272 · D14b #273. Mobile work, including D13's Team Summary collapse,
  is Phase P's (§7b).
- **E — Polish:** the ~20 mechanical holistic items (a11y: GearBoardCell/palette
  arrow-keys/books table; RecipientPicker rank-chip contrast; copy pass [static vocab,
  TrackCard model-vocab leak, edit-mode picker copy]; memoization; tooltips; heatmap
  name-list titles; next-card title; subtitle-vs-toggle) + **impeccable-assisted pass**:
  install `pbakaus/impeccable`, `/impeccable init` pointed at
  `design/redesign/DESIGN_SYSTEM.md` (product mode — inherit, never impose), run
  `/detect` across the four v2 screens, `/polish` per surface, everything as reviewable
  diffs gated by the existing lint/CI. Screenshots rule applies to every PR.
  **✅ Status (E1, 2026-09-25): the mechanical half shipped (#275).** Board roving focus + arrow keys;
  the palette combobox + one shortcut label; loot/books a11y and copy; Home/Schedule copy per U-2/U-3;
  heatmap manager names; v2 delete-flow tests. The six design calls were ruled: U-1 Floor-first is
  prominence, not text order (R-E1-J); U-2 TrackCard tags "Mount farm"; U-3 the next-session card gets
  a "Next session" eyebrow + real title; U-4 the roster subtitle describes the static, no change; U-5
  R-D14-B's fairness placement/title confirmed as built; U-6 the first-paint week order confirmed.
  **✅ Status (E2, 2026-09-25): ran, ships as two stacked PRs (E2a + E2b), in review.** E2a = the
  plan + Task 1 (RSVP glyph, tz line, heading levels) + Task 3 (Home grid, StatCell, labels, the
  V1-authorized TierSelector/light muted token/Discover fixes) + Task 4 (loot fixes). E2b = Task 2
  (the roster card header on one line, the job badge, the shared BiS-progress helper) — split out
  because the U-8/R-E2-D 2b ruling (`plans/2026-09-25-phase-e2-visual-polish.md` "Outcome") tripled
  its size past the ~1,500-line PR budget.
- **F — Seam mitigation:** light docs restyle (tokens/typography alignment, consistent
  PageHeader — full non-group v2 chrome remains Ring 1); retarget user-menu items where
  v2 equivalents exist; dead-code sweep (knip: 8 files / 179 exports / 139 types as of DC — hold
  anything Phase B might restore); doc updates (CLAUDE.md Key Files/Component Reference,
  UI_COMPONENTS.md, PRODUCT_MODEL §6, REDESIGN_SPEC §7 drop corrections, broken
  REDESIGN_SPEC link). **Received from E1:** the share-code not-found gap, the `fetchCurrentWeek`
  stale-response race and the `no-tiny-text`/const-string enforcement gap — see "Carried out of E1"
  below.

**Carried out of Phase D** (open at the D14b close; **closed by DC #274 except R-D12-F cause 5**, which is re-carried below; detail in `specs/phase-d-loot-plan.md` §5 and its
D12 row):
- `ui/Select`'s effect-ordering race — changing the recipient can clobber the slot `Select` back to
  placeholder, in both shells; the two-eligible-needers browser case is still owed.
  **✅ CLOSED (DC, 2026-09-25).** The Radix race itself was already fixed in #239 (`ui/Select.tsx:147-160`
  drops the phantom `''`). What D5 saw live was a **different** bug — `QuickLogMaterialModal`'s edit
  door re-deriving the slot on every recipient/material change instead of consulting the entry —
  fixed in DC Task 3 (`fix(v2): DC Task 3`) and demonstrated live (away-and-back restores the recorded
  slot, no phantom gear line).
- Legacy V1's no-op "clear notes": the PUT ignores a literal `notes: null`.
  **✅ CLOSED — already fixed in #239.** `backend/app/routers/loot_tracking.py:449` (loot-log) and
  `:1518` (material-log) honour `model_fields_set`. Regression tests:
  `backend/tests/test_loot_tracking.py:427-520` (six notes tests). This entry only needed the doc
  update; see R-DC-G.
- `eslint.config.js`'s `a11yRecommendedWarn` mapping flips upstream-off `jsx-a11y` rules to `warn` and
  strips their options — a dedicated chore, not per-call-site patches.
  **✅ CLOSED (DC Task 2).** Lint warnings 903 → 812 across DC (Task 1's deletions −10, the mapping −81), no jsx-a11y rule rose; two v2 directives freed by
  the fix (`LogWeekGrid.tsx:593,632`) were deleted.
- D12's three disclosed residuals: R-D12-C (a week-1 tier with no stored week routes to History),
  R-D12-H (the ring one-to-many / one-to-first asymmetry), R-D12-F cause 4 (Board view renders no
  anchor; user-ruled out of scope).
  **R-D12-C ✅ CLOSED (DC Task 4).** A keyed `weekClockKey` (R-DC-E) distinguishes a genuinely
  week-1 tier from an unfetched clock; `RosterCard` routes on a key match. Demonstrated live on a
  week-1 tier (Alt+Click a card jumps to the Log with the pulse).
  **R-D12-H and R-D12-F cause 4 → accepted and pinned (R-DC-F), no code.** H is inherent to the data
  (no stored left/right ring), pinned by `rosterLedgerJumps.test.ts:81-93` (outbound) and `:177-182`
  (inbound). F cause 4 was ruled out of scope by the user, pinned by `Roster.test.tsx:823-831`.
  **R-D12-F cause 5 is still open, re-carried:** a folded section or hidden substitutes renders no
  anchor at all (`specs/phase-d-loot-design.md:1095-1100`). It was never carried to this list before —
  the design doc names four residuals against this list's three. D14b's persisted
  `v2-roster-hide-subs` makes it more reachable.
- Delete the orphaned `components/history/{LootLogPanel,PageBalancesPanel,UnifiedWeekOverview}.tsx` —
  zero importers in `frontend/src`, listed in knip's unused files.
  **✅ CLOSED (DC Task 1).** The three files are deleted; knip's unused files 15 → 8.

**Carried out of E1** (`plans/2026-09-25-phase-e1-mechanical-polish.md`'s status-check table has the
41-item detail; new items below):
- Holistic / Phase P (design calls). **✅ Shipped in E2 (U-12):** #5 spacing nit, #36 ultra-wide glyph
  adjacency (E2a Task 1), #7 Board denominator vs color, #12 search-hidden selection, #13 adjustments
  close-on-failure, #14 subs in adjustments (E2a Task 4 / E2b Task 2 per component). **Carried, with
  homes:** #3 card richness → the Player Hub (spec approved 2026-09-25, PH1 next); #8 two "no BiS"
  signals and #32 membership intersection → Phase F; #20 materials-picker unification and #22
  accent-tint idiom → their own slices; #34 rsvp-row role seam → deferred. R-E1-J's compact
  fight-only controls (the floor pills, "Log floor — M12S", the picker's "Fight" Select — accepted
  as-built, U-1).
- Phase P (mobile): #11 SegmentedToggle 44 px touch target.
- Phase F (semantics / shared store / enforcement / backend): #9 `currentSource` recalc · #24's
  remaining whole-store destructures (`LogWeekWizard/index.tsx:96`, `QuickLogMaterialModal.tsx:333`) ·
  #27 `clearAllPageLedger` player set · #38 boundary-evening week · #11 Split planner/Export re-home ·
  #11 `Badge.tsx` contrast-harness exclusion · the `fetchCurrentWeek` stale-response race (declined on
  #274, user-approved 2026-09-25 to carry).
  **New from E1:**
  - **Needs explicit V1 authorization:** a bad share code never reaches "Static Not Found" in either
    shell — `staticGroupStore.fetchGroupByShareCode` sets `error` but never clears a stale
    `currentGroup`, and `ShellContentStates.tsx:145` precedes `:175` (frozen `GroupView.tsx` has the
    same shape); pre-existing on `main`; ~60–90 lines across the store and both shells.
  - `no-tiny-text` doesn't reach a class string held in a const (found via `GearBoardCell.tsx`'s
    `BASE`).
- Next mechanical slice: #40 null-anchor strip (`WeekNavigatorStrip.tsx:49-53,66`).
- Holistic (new from E1, un-homed items surfaced but not fixed). **✅ Shipped in E2a (R-E2-N):** the
  Book-method delete-confirm revert checkbox (`DeleteLootConfirmModal.tsx`, now default-checked for
  `drop` OR `book`, matching legacy — `specs/phase-d-loot-design.md:781-788`). **✅ Closed in E2a
  (R-E2-H):** FairnessSummary's empty-roster state no longer leaves an empty grid cell at `≥ sm`.
  **Still carried:** PriorityRow's tooltip trigger is a non-focusable span, so keyboard users can't
  reveal a truncated name.

**Carried out of E2** (2026-09-25):
- The V1-shared skipped-heading h3s R-E2-A left parked because the files are frozen legacy/V1-shared
  (`schedule/AvailabilityGrid.tsx:531`, `TemplateRecommendations.tsx:48`, `loot/LootPriorityPanel.tsx:509`)
  → fix whenever V1 is authorized for that file.
- D1: a partial adjustments failure also opens the shell error overlay — `tierStore.updatePlayer`
  (V1-shared) sets the global `error` on any failed update and both shells render the overlay by
  design → the holistic review (mutation- vs load-error surfacing policy).
- D3: the delete-confirm modal's initial focus lands on `Checkbox`'s `sr-only` input
  (`Modal.tsx:106-125` always prefers the first `INPUT`; `Modal`/`Checkbox` are V1-shared) → the
  holistic a11y pass.
- D4: the Board's per-player BiS column (`playerBisProgress`) vs. the `bisSlotTotals` aggregates
  feeding the Cards group bar (`RosterCards.tsx:288`) and Home readiness → Phase F, with #8 (unifying
  the aggregate entangles the no-BiS denominator semantics #8 owns).
- Lint's "warnings ≤ N" gate is not CI-enforced (`eslint .` has no `--max-warnings` in `ci.yml`) →
  repo setup.

## 7b. Phase P — Beta polish walkthrough (added 2026-07-25, user ruling)

The last build phase, immediately before the un-gate. A **page-by-page UX/styling
audit stepped through one-by-one WITH the user**: every v2 surface (in-static screens,
non-group chromed routes, mobile variants, guest views) gets a live walkthrough; the
user calls out any UX/styling change they want; each page's punch-list is fixed and
re-demonstrated before moving to the next page. Essentially the initial beta polish —
the bar is "a first-time user's first impression," not "passes the parity matrix."
Process: same SDD gates (screenshots per change, director on anything touching shared
code), but the *acceptance* on each page is the user saying "next." Exit = every page
walked, every punch-list item fixed or explicitly deferred by the user → **then the
D7 un-gate ships** (remove `isAdmin` from `TryNewUiBanner` + the S1 UserMenu item
together).

**Consolidated mobile pass (user ruling at the C1 checkpoint, 2026-07-26):** ALL v2
mobile work is deferred out of the build slices into ONE dedicated pass here, before
(or as the opening leg of) the Phase-P walkthrough — the app sees little mobile use
and per-slice mobile affordances were taxing every step. Per-slice phone equivalents
(the ex-D-56 rider) and 390 px browser-pass legs are dropped; the mobile pass designs
the phone experience holistically (density affordance, toolbar reachability, the
legacy MobileBottomNav still rendering under v2, breadcrumb overlap, etc.). Carried in
from slices: **Team Summary mobile collapse** (D-42's V1 collapse-on-phone, deferred by
D13's R-D13-E, #271).

## 8. Phase H — Default flip → sunset (criteria, proposed)

- **Flip v2 to default (3.0.0)** when ALL of: parity matrix 100% resolved (every row
  restore/drop/redesign executed) · Phases C+D+E shipped · **Phase P walkthrough
  complete and the un-gate shipped** · v2 opt-in available ≥4 weeks (clock starts at
  the post-P un-gate, per the §1 re-sequencing note) · opt-in cohort shows no
  unresolved parity complaints · toggle telemetry healthy.
- **Sunset (delete legacy again)** when: v2 default ≥4 weeks · trailing-2-week opt-out
  rate <10% (tune with real data) · zero open parity-tagged issues. Deletion re-runs the
  P3 checklist — this time WITH the §6 verification steps actually executed.
- **Standing rule (permanent):** no surface gets replaced without an affordance-parity
  matrix reviewed by the user first. Byte-for-byte legacy freeze: bugfix-only until
  sunset.

## 9. Process notes

- SDD cadence (**trimmed 2026-09-23**, see CLAUDE.md § Slice loop and the `slice-loop` skill): spec → user skim →
  plan (3–4 tasks) → implement all tasks → ONE whole-branch redesign-reviewer pass →
  one fix wave (Minors batched, never their own round) → browser validation → draft PR
  w/ screenshots → mark ready once (bots fire on ready) → merge. The per-task reviewer
  step and the per-ruling mutation battery are retired — D12 measured them as the
  slice's cost, not the bots. Implementers sonnet by default; opus/fable for the
  riskiest task only.
- NO AI attribution anywhere (absolute).
- Effort: ultracode for specs/adjudication, high for implement loops (per memory
  `feedback-effort-allocation`).
- After G, release notes go back to normal public-entry discipline per CLAUDE.md.
