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
H  Feedback loop → flip default to v2 (3.0.0) → criteria sunset → delete legacy
→  Rings 1–3 per PRODUCT_MODEL §7 (Person layer, tracks, More dissolution)
```

Phases B–F land as normal PRs to `main` after G. Order within B–F is flexible; C is the
highest user-priority item after A.

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

## 3. Phase A — v2 flip-debt fixes (pre-merge requirement)

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
- [ ] Local `smoke` + `smoke-legacy` + `contrast` runs attached to the PR
- [ ] One manual mobile-viewport pass (both shells, four Ring-0 screens)
- [ ] Migration rehearsal + prod-data testing against a **Railway DB copy**
- [ ] Release notes: public entry "Try the new UI (opt-in beta)" + `CURRENT_VERSION`
      → **2.1.0** (3.0.0 is reserved for the v2-default flip in Phase H)
- [ ] Ratify list in the PR body (D-P3 decisions incl. SplitClearPlanner/TeamSummary
      drops — note both are recoverable and Phase B may resurrect their capabilities)
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
  ledger (D-P3-3 gap), edit-flow affordances, materials summary.
- **E — Polish:** the ~20 mechanical holistic items (a11y: GearBoardCell/palette
  arrow-keys/books table; RecipientPicker rank-chip contrast; copy pass [static vocab,
  TrackCard model-vocab leak, edit-mode picker copy]; memoization; tooltips; heatmap
  name-list titles; next-card title; subtitle-vs-toggle) + **impeccable-assisted pass**:
  install `pbakaus/impeccable`, `/impeccable init` pointed at
  `design/redesign/DESIGN_SYSTEM.md` (product mode — inherit, never impose), run
  `/detect` across the four v2 screens, `/polish` per surface, everything as reviewable
  diffs gated by the existing lint/CI. Screenshots rule applies to every PR.
- **F — Seam mitigation:** light docs restyle (tokens/typography alignment, consistent
  PageHeader — full non-group v2 chrome remains Ring 1); retarget user-menu items where
  v2 equivalents exist; dead-code sweep (knip: 24 files/168 exports — hold anything
  Phase B might restore); doc updates (CLAUDE.md Key Files/Component Reference,
  UI_COMPONENTS.md, PRODUCT_MODEL §6, REDESIGN_SPEC §7 drop corrections, broken
  REDESIGN_SPEC link).

## 8. Phase H — Default flip → sunset (criteria, proposed)

- **Flip v2 to default (3.0.0)** when ALL of: parity matrix 100% resolved (every row
  restore/drop/redesign executed) · Phases C+D+E shipped · v2 opt-in available ≥4 weeks ·
  opt-in cohort shows no unresolved parity complaints · toggle telemetry healthy.
- **Sunset (delete legacy again)** when: v2 default ≥4 weeks · trailing-2-week opt-out
  rate <10% (tune with real data) · zero open parity-tagged issues. Deletion re-runs the
  P3 checklist — this time WITH the §6 verification steps actually executed.
- **Standing rule (permanent):** no surface gets replaced without an affordance-parity
  matrix reviewed by the user first. Byte-for-byte legacy freeze: bugfix-only until
  sunset.

## 9. Process notes

- SDD cadence unchanged (spec → user skim → plan → implement w/ redesign-reviewer per
  task → whole-branch review → browser validation → PR w/ screenshots → review loop →
  merge). Implementers sonnet by default; opus/fable for Phase R reconciliation.
- NO AI attribution anywhere (absolute).
- Effort: ultracode for specs/adjudication, high for implement loops (per memory
  `feedback-effort-allocation`).
- After G, release notes go back to normal public-entry discipline per CLAUDE.md.
