# Phase D — user-feedback polish slice (2026-08-21)

**Branch:** `phase-d/feedback-polish` (off main `5dab6705`). One PR.
**Origin:** the post-D8 user-feedback queue, scoped and approved by the owner in-session
2026-08-21 (co-design per the Phase D process ruling). Two items carry full triage records
from 2026-08-08 (roster reorder; JobPicker clipping); the rest were clarified directly with
the owner, including a screenshot showing off-center initials-avatar text.

## Owner rulings (2026-08-21)

- **R-P1** — v2 "Matrix" sub-view is renamed **"Who Needs It"** — label AND persisted value.
  No backwards-compat shim: v2 is pre-release with zero users; uniform-and-correct wins.
- **R-P2** — Need Matrix cells use **V1-style status circles** (the `GearStatusCircle` look),
  replacing the current dot/progress-ring cell rendering.
- **R-P3** — Floor pills on the Matrix view **highlight, don't hide**: all rows stay visible,
  rows relevant to the selected floor are highlighted, the rest dimmed — like V1. Queues and
  Weapons keep their current isolate behavior.
- **R-P4** — The off-center initials problem is **v2-wide** (owner: "All icons in V2 … don't
  have centered graphics/text", screenshot shows left-rail static chips + Queues recipient
  chips). Fix by extracting one avatar primitive and sweeping call sites. Where a rendering
  is shared with V1, the centering fix applies to both shells — cosmetic-defect exception to
  the V1 freeze, owner-approved in the design conversation.
- **PR #203 stays parked** — out of scope; separate revival decision after this slice.

## Global constraints

1. **V1 freeze:** no legacy-surface behavior changes. Sole exception: R-P4's centering fix on
   genuinely shared renderings. The PR's V1-safety assert must show the legacy-only diff is
   empty apart from that exception.
2. **Design system:** primitives only (no raw `<button>`/`<input>`), semantic color tokens
   only, 12px text floor. `pnpm check:design-system` and lint must stay clean.
3. **Every commit green:** `.claude/hooks/pre_bash_guard.py` runs whole-project `tsc -b` on
   any commit with staged frontend TS.
4. **Deletion-trace discipline (binding, from the D4 lesson):** for each behavioral test,
   EXECUTE the mutation (delete the guarded branch / hardcode the predicate) and paste the
   failing output in the task report. A test that survives the feature's deletion is a
   defect. Watch for vacuous assertions where values coincide by default.
5. User-facing text says **"static"**, never "group".
6. TDD: failing test first for behavioral changes.

## Tasks

### Task 1 — Roster reorder teaching affordances

The v2 reorder flow works as designed (transient enter→drag→exit mode, parity matrix D-19,
triage 2026-08-08) but shipped with zero teaching affordances. Add three:

1. **Tooltip on the Reorder button** in `frontend/src/components/roster/RosterToolbar.tsx`,
   following the same ShortcutHint/tooltip pattern the adjacent Light Party button uses
   (copy the mechanism, not a new one). Copy direction (implementer may tune wording, keep
   meaning): "Drag cards to reorder or swap players. Click again to finish." Note
   `SORT_PRESETS.custom` in `frontend/src/utils/constants.ts` already contains a
   "Drag to reorder" description that never surfaces — reuse or align wording.
2. **Cursor affordance:** when `reorderMode` is active, RosterCard root gets
   `cursor-grab active:cursor-grabbing` (legacy PlayerCard has the precedent pattern).
3. **Active-mode signal:** the Reorder button must look visibly "on" while the mode is
   active (pressed-state treatment on the existing Button usage; `aria-pressed` wiring
   already exists — make the visual match it).

Tests: tooltip renders on the button; card root carries grab-cursor classes only when
`reorderMode` is true; button pressed state reflects mode. Deletion-trace each.

### Task 2 — JobPicker clipping fix (portal)

Root cause (triage 2026-08-08): `RosterCard.tsx` CardShell uses `overflow-hidden` (since
commit `1f42a860`, even-card-heights); the JobPicker mounts in-flow in an absolute-positioned
`div` (around lines 820–827 — verify, lines drift) and gets clipped; the in-flow wrapper also
causes the header left-shift when open. `JobPicker.tsx` itself has no portal.

Fix: replace the conditional inline mount with the **Radix Popover Portal pattern already
used by `PositionSelector.tsx` and `TankRoleSelector.tsx` on the same card**
(Popover/PopoverTrigger/PopoverContent via `frontend/src/components/primitives/Popover.tsx`).
JobPicker component itself stays portal-free (wizard `RosterSlot` and `AddPlayerModal`
already wrap it in their own portals — do not double-portal them).

Also fix the two other vulnerable in-flow mounts found in triage:
- `OpenSeatCard.tsx` (CardShell `overflow-hidden border-dashed`, templateRole path)
- `AddManualCharacterModal.tsx` in-flow mount (~line 171) — assess first: if the modal
  container cannot clip it, record that finding in the report and leave it; otherwise apply
  the same pattern.

Tests: picker content mounts outside the card subtree (portal escape assertable in jsdom via
`document.body` containment); job selection round-trip still updates the player; open state
adds no in-flow sibling into the card header (the left-shift regression pin).

### Task 3 — "Matrix" → "Who Needs It" (label + value)

In `frontend/src/components/loot/Loot.tsx`: switcher option label `'Matrix'` →
`'Who Needs It'` and value `'matrix'` → `'who-needs-it'`, including the sub-view type union,
the R-1 landing-default logic, and every comparison site. Per **R-P1** there is NO migration
shim for the `v2-loot-priority-view` localStorage key — but an unrecognized stored value
(e.g. stale `'matrix'`) must fall back to the default landing view without crashing (that
default IS Who Needs It per R-1, so stale keys self-heal).

Naming guard: the v2 component file `NeedMatrix.tsx` KEEPS its name — V1's frozen
`WhoNeedsItMatrix.tsx` already owns the other name and a collision/rename of frozen code is
out of bounds. Update user-facing copy/aria strings that say "Matrix" on v2 surfaces
(inventory them; V1 strings untouched).

Tests: switcher renders Queues / Who Needs It / Weapons; explicit choice persists as
`'who-needs-it'`; stale `'matrix'` stored value lands on the default view, no crash.

### Task 4 — V1-style circle cells in the Need Matrix

Replace `NeedMatrix.tsx`'s dot/progress-ring cell rendering with the familiar V1
`GearStatusCircle` look (component: `frontend/src/components/ui/GearStatusCircle.tsx` —
consume it as-is, do NOT modify it; V1's `WhoNeedsItMatrix.tsx` is the rendering reference).
Preserve NeedMatrix's existing interactive vs read-only cell semantics and its current
accessibility contract (aria labels keep stating the have/missing/augmented state). Per-cell
state mapping must be identical to what the dots/rings expressed — this is a re-skin, not a
semantics change.

Tests: cells render GearStatusCircle with the correct state per fixture (have / missing /
augmented at minimum); read-only mode still renders non-interactive. Deletion-trace: break
the state mapping (swap two states) and paste the failure.

### Task 5 — Floor pills: highlight, don't hide (Who Needs It view only)

Current behavior: selecting a floor pill filters non-relevant rows out of the matrix. Per
**R-P3**: keep ALL rows rendered; rows whose slot drops on the selected floor get a highlight
treatment, all other rows dim (e.g. reduced opacity + the floor-accent edge — match V1's
treatment where sensible; use semantic floor tokens, no hex). `All` renders exactly as today.
Queues and Weapons floor behavior UNCHANGED.

Tests: with a floor selected, the full row set is still in the DOM; relevant rows carry the
highlight marker, others the dimmed marker. **Pin the predicate** (D4 lesson): hardcoding the
relevance predicate to `true` AND to `false` must each fail the suite — paste both failures.

### Task 6 — InitialsAvatar primitive + centering sweep

Per **R-P4**: the two-letter initials circles across v2 (left-rail static chips, Queues
recipient chips / `PriorityRow`, `RecipientPicker`, `UserMenu`, `NeedMatrix` player headers,
`SessionRsvpCard`, roster/card renderings — inventory ALL of them, this list is a starting
point not a bound) render their text off-center. There is no shared avatar component; the
circles are inline-styled per site.

1. Extract **`InitialsAvatar`** into `frontend/src/components/ui/` (follow the repo's
   primitive conventions + UI_COMPONENTS.md registration): props for size variant, color
   (semantic token / role color), and the initials text; optically centered content —
   flex centering + `leading-none` (+ any font-metric compensation the display font needs;
   verify visually, the root cause is line-height inside the circle).
2. Sweep call sites onto it. Where a rendering is shared with V1, the swap applies to both
   shells (owner-approved defect exception — record each shared site in the report).
3. Add the component to `docs/UI_COMPONENTS.md`.

Tests: InitialsAvatar renders initials with centering classes; at least one representative
call-site test per surface family (rail chip, recipient chip) asserting the primitive is
used. Report must list every call site swapped and every one deliberately left.

## Post-task wave (controller-owned, after Task 6)

- Release note via `pr-checklist` skill (public entry, `CURRENT_VERSION` bump rules).
- Live browser validation both shells (dev servers as background tasks; dev-auth
  `/api/dev-auth/login/0`, DEVTST static) + screenshots for the PR (embed per the standing
  screenshots rule; light+dark not required — no token changes — but both themes if cheap).
- Final whole-branch review (redesign-reviewer) + xivrp-director change-vet.
- V1-safety assert: legacy-only path diff empty except R-P4 shared-site swaps.
