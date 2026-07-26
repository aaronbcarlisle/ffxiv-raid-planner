# Phase C — Roster Card Rebuild: Execution Plan

**Status: DRAFT — awaiting user approval of the slice plan.** The *what* is already ruled — this
plan does not re-litigate any decision. Inputs: `v1-v2-parity-matrix.md` §1 (D-01…D-20 rulings,
user checkpoint 2026-07-26), `systems-flow-map.md` (F-05/F-04 homes + §2.2 shared-surface rules),
`ROLLOUT_ROADMAP.md` §6 (Phase C definition), and `phase-b-audit/legacy-roster.md` (the R-row →
component/line evidence implementers restore from).

**One sentence:** restore the legacy expanded gear-table card into v2 — restyled with v2 tokens,
wired through the shared gear state machine, gated per-player — and return the roster toolbar's
lost controls, in 8 reviewable slices.

---

## 1. Scope (ruled — not revisited here)

### In scope — RESTORE rulings (matrix §1)

| Unit | What returns | Slice |
|---|---|---|
| D-01 | Expanded ⇄ compact card axis: both densities, per-card expand, re-click-expand-all, `V` shortcut, mobile density affordance, expanded-only "active BiS target" chip | C1 (+chip in C5) |
| D-02 | On-card gear editing: click-to-cycle per slot + hover item card + status tooltip | C2 |
| D-03 | Per-slot BiS-source assignment: R/T/C/BT popover, per-slot "Fix", bulk-correct banner | C3 |
| D-04 | Tome-weapon sub-row with its own 3-state circle + material-entry jump | C4 |
| D-05 | Gear → ledger jumps: Alt+Click, right-click "Jump to entry", kebab "Edit Books" | C7 |
| D-06 | Sort-preset selector in the v2 roster toolbar (machinery already live) | C6 |
| D-07 | Visible "Separate Subs" toggle (S shortcut stays) | C6 |
| D-08 | Per-section collapse chevrons, persisted per static+tier | C6 |
| D-09 | Card badge row: SUB, BiS-link, "You", linked-user avatar, "+N" weapon priorities | C5 |
| D-10 | Progress ring + per-slot "Now vs BiS" hover breakdown | C5 |
| D-15 | Job-change confirm regains "Change Job **and Update BiS**" → straight into import | C7 |
| D-20 | Static/tier error modal (details + Copy + Report Bug) mounted under v2 | C7 |

### In scope — REDESIGN rulings

| Unit | Ruling | Slice |
|---|---|---|
| D-11 | Card identity returns **selectively** (lean: portrait + title on the expanded card); per-element calls made at slice time via PR screenshots | C5 |
| D-12 | Lodestone search→preview→sync flow re-homed to the Characters path (no card kebab) — **shared-surface exception** (flow map §2.2: `RosterCharacterPanel` mounts in both shells) | C8 |

### Standing riders

- **Ex-D-56 mobile rider:** every restored desktop control (D-01 axis, D-06 sort, D-07 subs)
  ships with a phone-width equivalent in the same slice — v2 suppresses the legacy mobile
  Controls sheet, so nothing inherits mobile access for free.
- **Screenshots rule:** every slice PR embeds before/after screenshots (light + dark on any
  token-visible change), per the standing user rule.
- **Browser validation:** every slice runs the live chrome-devtools pass (dev backend :8001 +
  dev-auth → `/group/DEVTST?shell=v2`) before its PR opens.

### Explicitly OUT of Phase C

| Item | Why out | Where it goes |
|---|---|---|
| D-18 Split Planner wiring | Entry point is ⏸ F-04, deferred into Phase-D design | Phase D |
| F-05(b) Team Gear-Sync dashboard → Roster area | Flow-map home assigned, but the move only matters when PluginPage dissolves | Stage 2 (IA collapse) |
| D-13 / D-14 / D-16 / D-17 / D-19 | Ruled KEEP V2 — no work | — |
| Board changes | Board is ruled the roster-wide matrix view as-is; C only touches Cards | — |
| Loot-triad targets for D-05 jumps | The Log view doesn't exist yet | C7 targets today's History deep-link (`?entry=&entryType=`, V2L-16); retargeted to Loot ▸ Log when Phase D ships it — recorded as a Phase-D checklist item |

---

## 2. Architecture decisions (the two calls that shape every slice)

### 2.1 Fork the presentation, share the logic

**Legacy stays byte-frozen**, so v2 gets its own card internals under `components/roster/`
(sibling files to `RosterCard.tsx`), **forked from** the legacy `PlayerCard`/`GearTable` tree and
restyled with v2 tokens. What is *not* forked:

- **State machine:** all mutations go through the existing shared paths
  (`computeGearSlotUpdate`, `getNextGearState`, `usePlayerActions`) — one mutation path for
  Cards AND Board, exactly as ROLLOUT_ROADMAP §6 requires. No new gear-mutation logic.
- **Pure data helpers:** iLv calc, gear categories, BiS metadata — already shared utils.
- **Modals:** BiSImportModal, WeaponPriorityModal, AssignUserModal etc. are already
  shared-and-KEPT (§1.K) — the new card reaches the same instances.

The forked presentation duplicates markup for one release cycle by design; the legacy copy dies
with Phase H. Fork boundary = anything that renders; share boundary = anything that computes.

Two verified consequences of this boundary (inline vet, 2026-07-26):

- **No shared-file edits for the shortcuts.** The `V` key already toggles `viewMode` under v2 —
  the shared hook is mounted unconditionally and flips it whenever `pageMode === 'roster'`
  (`useGroupViewKeyboardShortcuts.ts:100-103`); v2's single-density card simply never consumed
  the state. C1 *consumes* it (same pattern as D-06's already-live sort machinery). Likewise `S`
  (`:127-130`) and `G` (`:118-121`) already work.
- **The fork is not a copy-paste.** Legacy markup carries design-system violations
  (arbitrary text sizes, inline colors) that `check:design-system:strict` **blocks in CI** — the
  token restyle is mandatory for the build to ship at all, not a polish nicety.

### 2.2 Gating

Per-player edit gating uses the existing `canEditPlayer` shape (owner/lead edit-all, member
own-card) — restoring the member gear-edit capability the holistic review flagged as a top loss.
The Board's stricter-correct `canEditGear` model (NEW-04) is the reference; the card must not be
looser than the Board.

---

## 3. The slices (8 PRs, in order)

Each slice: fresh implementation session · director change-review before PR · full local gate
(`pnpm build` + lint + design-system strict + tests) · browser validation · e2e/smoke pin
updates wherever the slice changes a pinned flow · screenshots in PR · release-note entry
(`internal: true` while v2 stays admin-gated dark — flip to public entries only at un-gate).

| # | Slice | Contents | Restores | Notes |
|---|---|---|---|---|
| **C1** | Card chassis: the density axis | Expanded ⇄ compact state (persisted preference + per-card override), consume the **already-live** `V`-shortcut `viewMode` state (§2.1 — no rebind), re-click-expand-all, mobile density affordance (rider), expanded body mounts the **read-only** restyled gear table fork (real item icons, iLv detail, tome/BiS glyphs) | D-01 (most) | The riskiest slice visually — first look at the restyle; expect a screenshot checkpoint with the user before C2 proceeds |
| **C2** | On-card gear editing | Click-to-cycle per slot via the shared state machine, hover item card (stats/materia/equipped-vs-BiS), Status-column tooltip, `canEditPlayer` gating | D-02 | Optional (flagged for user): emit the dead `player_gear_changed` analytics event here — closes the "gear-edit frequency unanswerable" gap for good |
| **C3** | BiS-source tools | R/T/C/BT selector popover (+ reset-warning confirm), per-slot "Fix", "N slots need BiS source updates" bulk banner | D-03 | `BiSSourceSelector` exists as a shared component — remount + restyle, not rebuild |
| **C4** | Tome-weapon sub-row | Weapon-row "+" toggle renders the sub-row with its own 3-state circle + material-entry jump; kebab toggle stays in sync | D-04 | Jump target verified live: v2's History deep-link already handles `entryType=material` (`LootHistoryTable.tsx:70-79`) — no C7 dependency; retarget note as in §1 |
| **C5** | Metrics, badges, identity | Progress ring, per-slot Now-vs-BiS hover panel, badge row (SUB / BiS-link / You / avatar / +N), expanded-only active-BiS-target chip, D-11 selective identity (lean: portrait + title on expanded card) | D-09, D-10, D-11, D-01 chip | D-11 per-element calls made here via PR screenshots — the user rules each element in review |
| **C6** | Toolbar restorations | `SortModeSelector` returns (already-live machinery), visible Separate-Subs toggle (S stays), per-section collapse chevrons with persistence — each with its phone-width equivalent (rider) | D-06, D-07, D-08 | Kills the "invisible Healer-First preset" defect the matrix documented |
| **C7** | Flows + safety | Job-change → BiS-import hand-off (3rd option), gear→ledger jumps (Alt+Click / right-click / Edit Books kebab → today's History/Books deep-links), static/tier error modal mounted under v2 | D-15, D-05, D-20 | D-05's superuser affordances follow the D-55 pattern (shortcuts/right-click, not buttons) |
| **C8** | Lodestone re-home | `LodestoneSearchModal` gets its Characters-path entry (per D-12 redesign); **slice opens with the §2.2 shared-surface decision**: v2-only mount vs explicit user-approved V1 delta (`RosterCharacterPanel` renders in both shells) | D-12 | If the user prefers, this slice can slide to Stage 3 (Player Hub) where the Characters surface gets rebuilt anyway — decision at slice time, not now |

Sequencing rationale: C1→C2 are strictly ordered (chassis before interactions); C3/C4/C5 stack
on the C2 table but are independent of each other; C6 is independent of everything (toolbar
only) and can interleave; C7 depends on C2 (kebab/slot targets exist); C8 is last and severable.

---

## 4. Definition of done (phase level)

1. Every §1 in-scope unit's matrix row is demonstrably restored **in the running app** (director
   change-review per slice + a final Phase-C matrix sweep over D-01…D-20, same method as the
   Stage-1 closeout).
2. Cards and Board mutate gear through one shared path — verified by test, not inspection.
3. Member-role account can edit their own card's gear in the live app (the holistic review's
   top-3 loss, closed).
4. Mobile: every restored control reachable at phone width (rider), validated in the browser
   pass at 390px.
5. V1 diff = zero bytes (`git diff` scoped assert per slice; the only allowed exception is a
   C8 V1 delta the user explicitly approves under flow-map §2.2).
6. Release notes: internal entries per slice; `CURRENT_VERSION` untouched until un-gate.

---

## 5. Open items carried INTO slices (decided during, not before)

| Item | Where decided | Default if user is silent |
|---|---|---|
| D-11 identity elements (portrait / title / note / flex chips on expanded card) | C5 PR screenshots | Lean only: portrait + title; note + chips stay editor-only |
| `player_gear_changed` analytics wiring | C2 PR | Wire it (cheap, high information value) |
| C8 shared-surface handling (v2-only mount vs V1 delta) | C8 slice open | v2-only mount; no V1 delta without explicit approval |
| C8 timing (Phase C vs Stage 3) | C8 slice open | Stays in Phase C unless the user slides it |
