# Phase D — user-feedback polish slice (2026-08-21)

**Branch:** `phase-d/feedback-polish` (off main `5dab6705`). One PR.
**Origin:** the post-D8 user-feedback queue, scoped and approved by the owner in-session
2026-08-21 (co-design per the Phase D process ruling). Tasks 1–2 implement the 2026-08-08
triage records (roster reorder; JobPicker clipping); the rest were clarified directly with
the owner, including a screenshot showing off-center initials-avatar text.
**Vet:** xivrp-director plan-vet 2026-08-21 — APPROVED-WITH-CHANGES; all 17 required
changes are incorporated below. Controller rulings R-V1..R-V4 (see ledger) resolve the
points the vet flagged for decision.

## Owner rulings (2026-08-21)

- **R-P1** — v2 "Matrix" sub-view is renamed **"Who Needs It"** — label AND persisted value.
  No backwards-compat shim: v2 is pre-release with zero users; uniform-and-correct wins.
  (Vet-verified safe: sub-view is not URL-backed; `v2-loot-priority-view` has no legacy
  reader; unknown stored values already fall back to the matrix landing default.)
- **R-P2** — Need Matrix gear cells adopt **V1's Who Needs It cell visuals** (the
  role-colored ring + tint + inner-dot treatment of `WhoNeedsItMatrix.tsx:379-405`),
  replacing the current NeedDot/EmptyDot rendering. Controller ruling R-V1: the rendering
  reference is V1's `WhoNeedsItMatrix`, NOT the `GearStatusCircle` component (the two were
  conflated in the clarifying question's option text; the owner chose "the familiar look
  from V1's Who Needs It"). The **material progress rings stay** — they already restore
  V1's pie treatment and are publicly release-noted.
- **R-P3** — Floor pills on the Who Needs It view **highlight, don't hide**: all rows stay
  visible, rows relevant to the selected floor are highlighted, the rest dimmed — like V1.
  Dimmed rows also **disable** their log affordances, matching V1 (`WhoNeedsItMatrix.tsx:391,480`)
  — controller ruling R-V4. Queues and Weapons keep their current behavior.
- **R-P4** — Off-center initials circles are fixed v2-wide via one primitive + a sweep.
  The V1-freeze exception is **bounded** (vet change 1-2): a shared site may change ONLY if
  its V1 output changes in glyph centering and nothing else (no size, color, font, radius,
  or letter-count change). Out of bounds by name: `layout/SidebarRail.tsx` (byte-for-byte
  V1 rail), `history/LootCountBar.tsx`, legacy `player/` avatar renderings, and
  `releaseNotes.ts` historical entries. `static-group/MembersPanel.tsx:206,320` is
  genuinely shared (settings bridge mounts in both shells): eligible ONLY as a
  centering-only change under the owner's cosmetic-defect approval, enumerated in the PR
  (controller ruling R-V2).
- **PR #203 stays parked** — out of scope; separate revival decision after this slice.

## Global constraints

1. **V1 freeze:** no legacy-surface behavior changes. Sole exception: R-P4's bounded list.
   The PR's V1-safety assert must show the legacy-only diff is empty apart from that list.
2. **Design system:** primitives only, semantic color tokens only, 12px text floor.
   `pnpm check:design-system` and lint stay clean.
3. **Every commit green:** `.claude/hooks/pre_bash_guard.py` runs whole-project `tsc -b` on
   any commit with staged frontend TS.
4. **Deletion-trace discipline (binding, from the D4 lesson):** for each behavioral test,
   EXECUTE the mutation and paste the failing output in the task report. Watch for
   assertions that hold vacuously because values coincide by default.
5. User-facing text says **"static"**, never "group".
6. TDD: failing test first for behavioral changes.

## Tasks

### Task 1 — Roster reorder teaching affordances

The v2 reorder flow works as designed (transient enter→drag→exit mode, parity matrix D-19)
but shipped with zero teaching affordances. Add three:

1. **Tooltip on the Reorder button** in `frontend/src/components/roster/RosterToolbar.tsx`
   (button at ~`:207-218`). Use a plain `Tooltip` — NOT `ShortcutHint` (that renders a
   `<kbd>` and there is no reorder shortcut; `useGroupViewKeyboardShortcuts.ts:274`'s `r`
   is "Copy to New Tier"). The button is `disabled={!canManage}`, so wrap the trigger in
   `<span className="inline-flex">` per the existing precedent at `RosterToolbar.tsx:189-199`
   so the tooltip still fires when disabled. Copy direction (tune wording, keep meaning):
   "Drag cards to reorder or swap players. Click again to finish."
   `SORT_PRESETS.custom.description` ('Drag to reorder', `utils/constants.ts:65`) is
   **read-only reference for wording alignment — do NOT edit `utils/constants.ts`** (frozen
   shared file, V1 consumers).
2. **Cursor affordance:** when `reorderMode` is active, RosterCard root gets
   `cursor-grab active:cursor-grabbing` (precedent: `player/PlayerCard.tsx:885`).
3. **Active-mode signal:** the Reorder button must look visibly "on" while the mode is
   active (`aria-pressed={reorderMode}` is already wired at `RosterToolbar.tsx:207-218`;
   the button is `variant="ghost"` with no pressed treatment — add the visual).

Tests: tooltip renders on the button (incl. disabled state via the span wrapper); card root
carries grab-cursor classes only when `reorderMode` is true; button pressed visual reflects
mode. Deletion-trace each.

### Task 2 — JobPicker clipping fix (RosterCard portal)

Root cause (triage 2026-08-08, vet-confirmed on `5dab6705`): `RosterCard.tsx:700` CardShell
uses `overflow-hidden`; the JobPicker mounts non-portaled at `:823-831` inside an
absolute-positioned wrapper and gets clipped at the card boundary. `JobPicker.tsx` itself
has no portal.

Fix: replace the conditional mount with the **Radix Popover Portal pattern used by
`PositionSelector.tsx` and `TankRoleSelector.tsx` on the same card**
(Popover/PopoverTrigger/PopoverContent via `frontend/src/components/primitives/Popover.tsx` —
its `:88` wraps content in `PopoverPrimitive.Portal`). Requirements beyond the mount swap
(vet changes 9-12):

- **Drop the redundant wrapper chrome.** The current wrapper at `RosterCard.tsx:824`
  carries `w-72 rounded-lg border … bg-surface-raised p-2 shadow-lg` and JobPicker's own
  panel is already decorated (`JobPicker.tsx:347`, `w-80`). After the swap, `PopoverContent`
  is the ONLY decoration layer — no triple-nesting, and resolve the w-72/w-80 width clash.
- **Dismissal ownership.** JobPicker installs its own document-level mousedown outside-close
  (`JobPicker.tsx:148-162`) and Escape (`:177-188`) handlers firing `onRequestClose`. Under
  Radix these double up (trigger click = "outside" for JobPicker → close-then-reopen).
  Decide the ownership explicitly (e.g. suppress JobPicker's own handlers when
  popover-hosted, or drive open state solely from the Popover) and test it.
- **Focus.** `Popover.tsx:108` suppresses `onOpenAutoFocus`; JobPicker's search-input focus
  (`JobPicker.tsx:165-167`) must still land inside the portal.
- **JobPicker component itself stays portal-free** — wizard `RosterSlot.tsx:316` and
  `AddPlayerModal.tsx:219` already own portals; do not double-portal them.
- **OpenSeatCard is OUT of scope** (controller ruling R-V3): its JobPicker is an inline
  form field (`OpenSeatCard.tsx:113-117`), not a dropdown — the Popover pattern does not
  apply, and what clips there is JobPicker's internal panel. Deferred with its own design
  question. `AddManualCharacterModal.tsx` (~`:171`): assess only; if its modal container
  cannot clip, record that in the report and leave it.

Tests: picker content mounts outside the card subtree (DOM-containment assertion — the
"left-shift" claim is a layout question and belongs to the browser pass, not jsdom);
job selection round-trip still updates the player; Escape closes exactly once; outside
click closes exactly once; clicking the trigger while open closes and does NOT reopen;
search input receives focus when opened.

### Task 3 — "Matrix" → "Who Needs It" (label + value)

In `frontend/src/components/loot/Loot.tsx`: switcher option (`:629`) label `'Matrix'` →
`'Who Needs It'` and value `'matrix'` → `'who-needs-it'`; update the `PriorityView` union
(`:175`), the R-1 landing default (`readStoredPriorityView`, `:190-197`), and every
comparison site. Per **R-P1** no migration shim — stale `'matrix'` keys self-heal to the
default landing (which IS this view).

Vet-verified: `Loot.tsx:629` is the ONLY user-facing v2 "Matrix" string; V1's
(`LootPriorityPanel.tsx:525,712`) stay untouched. `NeedMatrix.tsx` KEEPS its file name
(V1's frozen `WhoNeedsItMatrix.tsx` owns the other name). Historical release-note entries
(`releaseNotes.ts:200,202`) are records of what shipped — do NOT rewrite them.

Tests: switcher renders Queues / Who Needs It / Weapons; explicit choice persists as
`'who-needs-it'` (existing round-trip pin at `Loot.test.tsx:376` re-pointed); stale
`'matrix'` stored value **must not render Queues** (vet change 17: the "lands on default"
assertion is vacuity-prone — the mutation "always return default" must fail this test;
pick assertions that kill it).

### Task 4 — V1-style cells in the Who Needs It matrix

Re-skin `NeedMatrix.tsx`'s **gear** cells (`NeedDot` `:39-45` / `EmptyDot` `:84-86`) to
V1's cell visuals: role-colored ring (2px), role-tint fill, inner role dot — reference
`WhoNeedsItMatrix.tsx:379-405`. Build the cell **v2-owned**, following the
`GearBoardCell.tsx:1-13` precedent ("derived from the state machine, rendered as its own
cell") — do **NOT** consume the `GearStatusCircle` component inside the cell: its
unconditional `stopPropagation` (`GearStatusCircle.tsx:88`) would kill the cell's
`IconButton` click, it renders a focusable `role="checkbox"` (illegal inside a button),
and it colors by bisSource, not role (ruling R-V1).

Scope facts (vet-corrected):
- The **material progress rings stay as-is** (`MaterialProgressRing`, `NeedMatrix.tsx:59-81`)
  — they already restore V1's pie treatment and are publicly release-noted
  (`releaseNotes.ts:202`). Update the legend (`NeedMatrix.tsx:288-290`) only if the gear-cell
  visuals make its wording stale.
- The cells' real states are **needs / doesn't-need** (binary, `row.needers.has(player.id)`
  at `:149`) plus material needed-of-total — there is no have/missing/augmented state here.
  Existing aria labels (`:159` "Log X for Y", `:173` "Y needs X", `:243,254` material
  "needs N") keep their meaning.
- Interactive vs read-only cell semantics unchanged — re-skin, not a semantics change.

Tests: needer cells render the role-colored ring treatment (per-role assertion for at least
two roles); non-needer cells render the empty treatment; read-only mode stays
non-interactive; material cells unchanged. Deletion-trace: swap the needs/doesn't-need
mapping and paste the failure.

### Task 5 — Floor pills: highlight, don't hide (Who Needs It view only)

Current behavior (vet-verified): floor selection filters rows out (`NeedMatrix.tsx:103-106`).
Per **R-P3**: keep ALL rows rendered; rows whose slot drops on the selected floor get a
highlight treatment; all other rows **dim AND disable their log affordances** (ruling R-V4,
matching V1: `WhoNeedsItMatrix.tsx:358,446` opacity, `:391,480` disabled). Use the semantic
floor tokens in `loot/floorClasses.ts` (`FLOOR_TEXT_CLASS`, `FLOOR_ACCENT_CLASS`) — no hex.
`All` renders exactly as today. Queues (`Loot.tsx:758-760`) and Weapons unchanged.

Also update the stale contract comment at `NeedMatrix.tsx:7` ("scoping FILTERS rows") to
the new highlight semantics (vet change 16, code half).

Tests: with a floor selected, the full row set is still in the DOM; relevant rows carry the
highlight marker; others carry the dimmed marker AND their log buttons are disabled.
**Pin the predicate**: hardcoding relevance to `true` AND to `false` must each fail — paste
both failures. The two existing tests encoding filter behavior — `NeedMatrix.test.tsx:133`
("scopes rows to the selected floor") and `:146` (Materials separator absent under
floorScope 1) — must be **re-pointed to the new semantics, not deleted**.

### Task 6 — InitialsAvatar: diagnose, then bounded sweep

The off-center-initials defect is real (owner screenshot: left-rail static chips + Queues
recipient chips) but its mechanism is NOT the assumed line-height — `AppRail.tsx:112-114`
already has flex centering + `leading-none` and still renders off-center (vet F2). Likely
candidates: Exo 2/Inter font-metric optical centering, and/or the 1px↔2px active-border
swap at `AppRail.tsx:104-107,118-120` shifting the content box. Therefore:

1. **Diagnose first, on ONE site** (`layout/AppRail.tsx` chip — v2-only, legacy uses
   `SidebarRail`): reproduce in the browser (dev servers + chrome-devtools), identify the
   actual cause, demonstrate the fix visually, and record cause + fix in the report BEFORE
   touching any other file.
2. **Extract `InitialsAvatar`** into `frontend/src/components/ui/` embodying the proven
   fix (size variant, semantic color prop, initials text). **Fold
   `ui/PlayerIdentity.tsx:51-55,145,164` into the decision** — it already renders an
   initials avatar (with SafeAvatar fallback) consumed by `PriorityRow`, `SessionRsvpCard`,
   `RecipientPicker`, `RosterCard`, `GearBoard`, `LootEntryRow`. Either extract the shared
   circle from it or state in the report why not; two competing primitives is a defect.
   Address `ui/PriorityRow.tsx:51`'s `design-system-ignore` (10px initials in a 22px glyph)
   explicitly: the primitive must not silently resize it nor re-violate the 12px floor
   without carrying the justified ignore forward.
3. **Bounded sweep.** Produce the call-site inventory as a report table (site, shell(s),
   swapped/left + why) BEFORE swapping. Eligibility per R-P4: v2-only sites swap freely;
   a shared site swaps ONLY if its V1 output changes in glyph centering and nothing else.
   **Out of bounds by name:** `layout/SidebarRail.tsx`, `history/LootCountBar.tsx:102`,
   legacy `player/` avatar renderings, `releaseNotes.ts`. `static-group/MembersPanel.tsx:206,320`
   is eligible as centering-only (ruling R-V2). NeedMatrix player headers are NOT initials
   avatars (`NeedMatrix.tsx:123-133` renders JobIcon + name) — not in the inventory.
4. Register the component in `docs/UI_COMPONENTS.md`.

Tests: InitialsAvatar renders initials with the proven centering treatment; representative
call-site test per surface family (rail chip, recipient chip) asserting the primitive is
used. Report must contain the diagnosis evidence and the full inventory table.

### Task 7 — Spec write-back (docs only)

Write R-P1..R-P4 back into `design/redesign/specs/phase-d-loot-design.md` where its
vocabulary is now stale — the vet names R-1, R-2, R-3, R-10.2, R-11, R-48 (all say
"Matrix") — as dated amendments, not silent rewrites (match the spec's existing amendment
style). Do NOT touch `releaseNotes.ts` historical entries. (`NeedMatrix.tsx:7`'s contract
comment is Task 5's job.)

> ⚠ **Amended 2026-08-22 by controller ruling R-T7b (execution):** R-P4 was deliberately
> NOT written into the loot spec — it is not loot-spec vocabulary and maps to no ruling in
> that file; its durable record is this plan's header, `docs/UI_COMPONENTS.md`'s
> InitialsAvatar registration, and the PR body. R-11 was verified not-stale and left
> unamended. The delivered amendments cover R-P1..R-P3 across every stale-vocabulary site
> (the vet's six named rulings plus the additional sites found during the sweep).

## Post-task wave (controller-owned, after Task 7)

- Release note via `pr-checklist` skill (public entry, `CURRENT_VERSION` bump rules).
- Live browser validation both shells (dev servers as background tasks; dev-auth
  `/api/dev-auth/login/0`, DEVTST static) + screenshots for the PR — this pass carries the
  layout claims jsdom can't (Task 2 left-shift, Task 6 centering before/after).
- Final whole-branch review (redesign-reviewer) + xivrp-director change-vet.
- V1-safety assert: legacy-only path diff empty except the R-P4 enumerated list.
