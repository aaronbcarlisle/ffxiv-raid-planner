# Phase C — Roster Card Rebuild: Execution Plan

**Status: DRAFT — awaiting user approval of the slice plan.** The *what* is already ruled — this
plan does not re-litigate any decision. Inputs: `v1-v2-parity-matrix.md` §1 (D-01…D-20 rulings,
user checkpoint 2026-07-26), `systems-flow-map.md` (F-05/F-04 homes + §2.2 shared-surface rules),
`ROLLOUT_ROADMAP.md` §6 (Phase C definition), and `phase-b-audit/legacy-roster.md` (the R-row →
component/line evidence implementers restore from).

**Vet record:** director plan-vet 2026-07-26 → GAPS-FOUND (2 blockers · 5 major · 10 minor) —
all folded into this revision. Two findings also corrected the ruled matrix itself (D-20 already
shipped in v2; the `V`/`G`/`S` shortcut-liveness claims were wrong) — corrections filed in
`v1-v2-parity-matrix.md` with dated ⚠ notes, same PR.

**One sentence:** restore the legacy expanded gear-table card into v2 — restyled with v2 tokens,
wired through the shared gear state machine, gated per-player — and return the roster toolbar's
lost controls, in 8 reviewable slices.

---

## 1. Scope (ruled — not revisited here)

### In scope — RESTORE rulings (matrix §1)

| Unit | What returns | Slice |
|---|---|---|
| D-01 | Expanded ⇄ compact card axis: both densities, per-card expand, re-click-expand-all, `V` shortcut (v2-side binding — §2.1), mobile density affordance, expanded-only "active BiS target" chip | C1 (+chip in C5) |
| D-02 | On-card gear editing: click-to-cycle per slot + hover item card + status tooltip | C2 |
| D-03 | Per-slot BiS-source assignment: R/T/C/BT popover, per-slot "Fix", bulk-correct banner | C3 |
| D-04 | Tome-weapon sub-row with its own 3-state circle + material-entry jump | C4 |
| D-05 | Gear → ledger jumps: Alt+Click, right-click "Jump to entry", kebab "Edit Books" | C7 |
| D-06 | Sort-preset selector in the v2 roster toolbar **+ v2-side per-tier preset hydration** (vet finding: the `sort-preset-{tierId}` hydration exists only in legacy hosts — v2 currently *ignores* the stored preset) | C6 |
| D-07 | Visible "Separate Subs" toggle **+ a v2-side `S` binding** (the shared `S` handler mutates a hook instance v2's Roster doesn't read — §2.1) | C6 |
| D-08 | Per-section collapse chevrons, persisted per static+tier | C6 |
| D-09 | Card badge row: SUB, BiS-link, "You", linked-user avatar, "+N" weapon priorities | C5 |
| D-10 | Progress ring + per-slot "Now vs BiS" hover breakdown | C5 |
| D-15 | Job-change confirm regains "Change Job **and Update BiS**" → straight into import | C7 |
| ~~D-20~~ | ~~Static/tier error modal~~ **ALREADY SHIPPED in v2** (`ShellContentStates.tsx:215-273`: details block, 2-s Copy confirm, Report Bug → Discord; v2-only mount `NewShell.tsx:128`) — matrix correction filed; the Phase-C closeout **verifies** it (incl. no double-modal) instead of building it | closeout |
| D-55 *(roster half)* | R-062 Shift+Click copies the card deep link · R-076 the kebab hint tooltip that teaches the modifier-clicks — the ruled shortcuts/right-click pattern on the rebuilt card (Phase D closes D-55's loot half) | C7 |

### In scope — REDESIGN rulings

| Unit | Ruling | Slice |
|---|---|---|
| D-11 | Card identity returns **selectively** (lean: portrait + title on the expanded card); per-element calls made at slice time via PR screenshots | C5 |
| D-12 *(rider)* | **R-072 sync-line detail** — character/server + job-mismatch warning return to the card's sync line, **independent of C8's timing** (the rider is explicit in the matrix rows D-12 and §1.K) | C5 |
| D-12 *(flow)* | Lodestone search→preview→sync flow re-homed to the Characters path (no card kebab) — **shared-surface exception** (flow map §2.2: `RosterCharacterPanel` mounts in both shells). **C8 is the "Phase-D design" moment the flow map §2.2 row points to** — the mount decision is made when C8 opens | C8 |

### Standing riders

- **Ex-D-56 mobile rider:** every restored desktop control (D-01 axis, D-06 sort, D-07 subs)
  ships with a phone-width equivalent in the same slice. Note: legacy's mobile FAB is suppressed
  for v2 by a gate *inside shared* `GroupViewContent.tsx` (`:1231-1236`) — the v2 replacement
  must be a v2-tree affordance, not a change to that gate.
- **Screenshots rule:** every slice PR embeds before/after screenshots (light + dark on any
  token-visible change).
- **Browser validation:** every slice runs the live chrome-devtools pass (dev backend :8001 +
  dev-auth → `/group/DEVTST?shell=v2`) before its PR opens — including a 390 px mobile pass.

### Explicitly OUT of Phase C

| Item | Why out | Where it goes |
|---|---|---|
| D-18 Split Planner wiring | Entry point is ⏸ F-04, deferred into Phase-D design | **Recorded in `ROLLOUT_ROADMAP.md` §7-D scope** (this PR) |
| F-05(b) Team Gear-Sync dashboard → Roster area | The move only matters when PluginPage dissolves | **Recorded as Stage-2 scope in `ROLLOUT_ROADMAP.md`** (this PR) |
| D-13 / D-14 / D-16 / D-17 / D-19 | Ruled KEEP V2 — no work | — |
| Board changes | Board is ruled the roster-wide matrix view as-is; C only touches Cards | — |
| Loot-triad targets for D-05 jumps | The Log view doesn't exist yet | C7 targets today's History deep-link; retarget recorded in §7-D scope |

---

## 2. Architecture decisions

### 2.1 Fork the *shells*, share the *leaves* and the logic

**Legacy stays byte-frozen.** V2 gets its own card **layout shells** under `components/roster/`
forked from the legacy `PlayerCard`/`GearTable` tree and restyled with v2 tokens. But the fork is
**not a whole-tree copy** — a blocking CI gate forbids it:

- **`pnpm dupes` (jscpd) is a blocking CI step** (`ci.yml:69-70`; threshold 5 %, current corpus
  at 3.76 % lines / 4.18 % tokens). Duplicating ~2,700 lines of card markup blows the budget on
  C1 alone. Therefore: **leaf components** (badge chips, gear cell, hover item card, status
  circle, selector popovers) are **shared single components** consumed by both shells — presentation
  differences expressed via existing tokens/props, never by copy — and only the card/table
  **layout shells** fork. Any leaf that cannot be shared without a legacy-visible change gets a
  named exception in that slice's PR body.
- **Shared logic:** all mutations through `computeGearSlotUpdate` / `getNextGearState`
  (`utils/calculations.ts` — consumed today by legacy `PlayerCard.tsx:192` and v2
  `GearBoard.tsx:98`) and `usePlayerActions` — one mutation path for Cards AND Board. No new
  gear-mutation logic, **and no emit/instrumentation added inside the shared path** (see C2).
- **Shared modals** (BiSImportModal, WeaponPriorityModal, AssignUserModal, BiSTargetManagerModal)
  are reached as the same instances (§1.K).

**Shortcut/view-state mechanism (vet blocker, decided here):** `useGroupViewState` is
**per-instance** `useState` — the shared keyboard hook mutates the `GroupViewContent` instance
(`GroupViewContent.tsx:487`), which v2's Roster (own instance, `Roster.tsx:122-132`) observes
only via URL on remount. So "consume the already-live state" is not implementable, and the ruled
matrix's liveness claims for `V`/`G`/`S` are corrected (dated ⚠ notes, this PR).
**Decision: v2-local view state + v2-side key bindings** — C1 introduces a v2-scoped density
state and binds `V` (and C6 binds `S`/`G` equivalents) **inside the v2 roster tree**: zero
shared-file edits, legacy untouched. The alternative (lifting the four view fields out of
`useGroupViewState` into a store) is explicitly rejected for Phase C — it edits a file legacy
imports (`GroupView.tsx:134`) and needs its own SHARED-DRIFT review; revisit at Phase H when
legacy dies.
Two obligations ride this decision: the v2 density toggle **must keep emitting
`view_mode_change`** (the matrix's most load-bearing datapoint) with a shell discriminator
field, and C1 must **choose its persistence key deliberately** — reusing legacy's
`party-view-mode` key makes a v2 toggle change what legacy renders next visit (a V1-visible
effect with zero file diff); a v2-scoped key keeps the freeze strict. Slice-time user call,
recorded in the C1 PR.

**Design-system reality (vet correction):** `check:design-system:strict` counts raw HTML +
hardcoded colors only — it does **not** catch legacy's `text-[10px]`-class violations, and
`no-tiny-text` is error-locked only for `primitives/**` and `ui/**`. The token restyle therefore
needs a real gate: **C1 adds `src/components/roster/**` to the eslint error-locked block**
(v2-tree-only change), and each slice's director change-review runs a `git grep "text-\["`
assert over the new files.

### 2.2 Gating

Plain statement (vet correction — no invented third gate): gear cells use `canEditGear`
(`permissions.ts:107-118`, a gear-messaging wrapper over `canEditPlayer`) exactly as legacy's
GearTable (`GearTable.tsx:472`) and the Board (`GearBoard.tsx:149`) already do; card-level edits
use `canEditPlayer` (`permissions.ts:73`). Owner/lead edit-all, member own-card — restoring the
member gear-edit capability the holistic review flagged as a top loss.

---

## 3. The slices (8 PRs)

**Dependency graph (corrected):** C1 → {C2 → C3, C2 → C4}; C1 → C5; C6 independent; C7 after C1
(D-15, D-55 half) with its slot-level jumps after C2; C8 severable, last.

Each slice: fresh implementation session · director change-review before PR (incl. the
`text-\[` assert and a shared-file hunk review) · full local gate (`pnpm build` + lint +
design-system strict + **`pnpm dupes`** + **`pnpm tokens:check`** + tests) · browser validation
(desktop + 390 px) · e2e/smoke pin updates wherever the slice changes a pinned flow ·
static-not-"group" vocabulary check on all new copy · screenshots in PR · release-note entry
(`internal: true` while v2 stays admin-gated dark).

| # | Slice | Contents | Restores | Notes |
|---|---|---|---|---|
| **C1** | Card chassis: the density axis | v2-scoped expanded ⇄ compact state (persistence key = slice-time user call, §2.1) + per-card override, v2-side `V` binding, re-click-expand-all, `view_mode_change` emit with shell field, mobile density affordance (v2-tree), eslint error-lock for `components/roster/**`, expanded body mounts the **read-only** gear-table shell (shared leaves, real item icons, iLv detail, tome/BiS glyphs) | D-01 (most) | The riskiest slice visually — screenshot checkpoint with the user before C2 proceeds |
| **C2** | On-card gear editing | Click-to-cycle per slot via the shared state machine, hover item card, Status-column tooltip, `canEditGear`/`canEditPlayer` gating; **keyboard-operable and announced** (cells focusable, Enter/Space cycles, state announced) — not mouse-only | D-02 | Analytics: `player_gear_changed` emit is **not wired without an explicit emit-site decision** (vet finding 8). If ruled yes: emit from the **v2 card component only**, never from the shared mutation path (a shared emit would make frozen V1 start POSTing analytics), with a shell discriminator |
| **C3** | BiS-source tools | R/T/C/BT selector popover (+ reset-warning confirm), per-slot "Fix", "N slots need BiS source updates" banner; keyboard-operable + announced | D-03 | `BiSSourceSelector` exists (`components/player/BiSSourceSelector.tsx`) — shared-leaf remount + restyle |
| **C4** | Tome-weapon sub-row | Weapon-row "+" toggle renders the sub-row with its own 3-state circle + material-entry jump; kebab toggle stays in sync | D-04 | Jump target verified live (`LootHistoryTable.tsx:69-103` handles `entryType=material`); jump must also set the Loot tab + `lview=history` |
| **C5** | Metrics, badges, identity | Progress ring, per-slot Now-vs-BiS hover panel, badge row (SUB / BiS-link / You / avatar / +N), **R-072 sync-line detail** (character/server + job-mismatch — the D-12 rider, C8-independent), expanded-only active-BiS-target chip, D-11 selective identity (lean: portrait + title) | D-09, D-10, D-11, D-12 rider, D-01 chip | **Chip data reality (vet finding 7):** `useSharedBisStore` is populated only when BiSTargetManagerModal opens — no roster-level prefetch exists, and the endpoint is per-owner. **Slice-time choice:** inherit that latency (chip appears after the modal has run; demo scripted accordingly) or add a fetch — naming the cost (N per-player calls, or a new batched endpoint = backend scope). Default: inherit; no silent backend work |
| **C6** | Toolbar restorations | `SortModeSelector` returns **+ v2-side `sort-preset-{tierId}` hydration** (follows tier switches), visible Separate-Subs toggle **+ v2-side `S` binding**, per-section collapse chevrons with persistence — each with its phone-width equivalent (rider). Decide: does the subs toggle inherit the `hasSubstitutes` gate (shared hook `:128`) or render disabled? Default: inherit the gate | D-06, D-07, D-08 | Kills the actual D-06 defect (corrected: v2 *ignores* the stored preset today) |
| **C7** | Flows + superuser affordances | Job-change → BiS-import hand-off (3rd option); gear→ledger jumps (Alt+Click / right-click / kebab) → today's History deep-links **+ tab & `lview=history` setting**; **"Edit Books" leg is new navigation work** (no book deep-link exists — param + anchor scroll + highlight, `Loot.tsx:44-46`); **D-55 roster half**: R-062 Shift+Click copy-URL + R-076 the teaching tooltip | D-15, D-05, D-55(roster) | D-20 struck (already shipped — closeout verifies). Superuser affordances follow the ruled D-55 pattern: shortcuts/right-click, not buttons |
| **C8** | Lodestone re-home | `LodestoneSearchModal` gets its Characters-path entry (per D-12 redesign); **slice opens with the §2.2 shared-surface decision** (v2-only mount vs explicit user-approved V1 delta — `RosterCharacterPanel` renders in both shells); **V1 guard = `smoke-legacy` #14** (`e2e/smoke-legacy.spec.ts:670`, the Lodestone search→preview→sync pin) must stay green untouched | D-12 flow | Severable; may slide to Stage 3 (Player Hub) — decision at slice time |

---

## 4. Definition of done (phase level)

1. Every §1 in-scope unit demonstrably restored **in the running app** (director change-review
   per slice + a final Phase-C matrix sweep over D-01…D-20 — the sweep also *verifies* D-20's
   already-shipped modal, including that no second modal stacks).
2. Cards and Board mutate gear through one shared path — verified by test, not inspection.
3. A member-role account can edit their own card's gear in the live app.
4. Mobile: every restored control reachable at 390 px (rider), validated in the browser pass.
5. **V1 safety, two-part assert (vet-corrected definition):** (a) `git diff --stat` over
   legacy-only paths is empty per slice, **and** (b) every hunk in a *shared* file is enumerated
   in the PR body with the exact V1 render path it reaches and carries director SHARED-DRIFT
   sign-off. C8's approved-V1-delta option is the only allowed exception. (A legacy-only-paths
   assert alone cannot catch the real risk class — shared files like `useGroupViewState.ts`,
   `calculations.ts`, `analytics.ts`, `GroupViewContent.tsx`.)
6. No cross-shell preference bleed without a recorded decision (C1 storage key).
7. Release notes: internal entries per slice; `CURRENT_VERSION` untouched until un-gate.

---

## 5. Open items carried INTO slices (decided during, not before)

| Item | Where decided | Default if user is silent |
|---|---|---|
| C1 density persistence key (shared `party-view-mode` = cross-shell continuity, V1-visible · v2-scoped key = strict freeze) | C1 PR | v2-scoped key |
| D-11 identity elements (portrait / title / note / flex chips) | C5 PR screenshots | Lean only: portrait + title |
| C5 chip data (inherit modal-populated latency vs add fetch/backend) | C5 PR | Inherit; no backend work |
| `player_gear_changed` analytics wiring | C2 PR — **explicit emit-site decision required; no silent default to wiring** | Not wired |
| C6 subs-toggle `hasSubstitutes` gating | C6 PR | Inherit the gate |
| C8 shared-surface handling (v2-only mount vs V1 delta) | C8 slice open | v2-only mount |
| C8 timing (Phase C vs Stage 3) | C8 slice open | Stays in Phase C |
