# Phase D — Slice D5: The Grid Chassis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Vet record:** `xivrp-director` plan-vet 2026-08-22 → **APPROVE-WITH-CHANGES (PARITY-GAP)**
(1 blocker · 6 major · 8 minor) — all folded into this revision. Three decision points were
**ruled by the user 2026-08-22 during the vet fold** (co-design rule): **(R-D5a)** grid material
cells reach substitutes via an optional `allowSubs` on the modal's pinned branch — off by
default, V1 byte-identical, the D8 optional-props discipline; the matrix/queues cell doors keep
R-a's main-roster inheritance (F-1). **(R-D5b)** the grid's floor header matches `FloorCard`'s
shipped treatment — accent stripe + floor-coloured "Floor N · Book {I–IV}" metadata + duty name
as muted `Tag`, **no tint band**, `FLOOR_TINT_CLASS` not added (F-6). **(R-D5c)** the
material-cell suggestion runs against the clock's current week ("who is up next now"), disclosed
in the R-17 build note; the write still targets the displayed week (F-7). All three are recorded
in the PR body and written back to the design record in Task 6.

**Goal:** Build v2's own weekly grid on the Log tab — four floor sections, loot cells routing to
`RecipientPicker` (assign/edit) and material cells to `QuickLogMaterialModal` (create/**edit** —
R-21's first live mount), with R-19's floor accent + `Floor N · Book {I–IV}` headers — replacing
D4's `LogEmptyState` placeholder.

**Architecture:** A pure data module (`logWeekGridData.ts`, the `needMatrixData.ts` precedent)
buckets the week's `lootLog`/`materialLog` entries into per-floor cell models derived from
`FLOOR_LOOT_TABLES` (never a transcribed inline config — §2.2 re-express). A presentation
component (`LogWeekGrid.tsx`) renders one `<table>` per floor section and calls up through four
callbacks; `Loot.tsx` owns all modal state, exactly as it does for `NeedMatrix`/`FloorCard`.
Mounting the material modal's **edit door for the first time** triggers the §5 mount obligations:
(a) full-roster `allPlayers`, (b) rehydrate-once-per-open fixed **in the modal**, (d) lazy
`useState` initializers — (b)/(d) are Task 1, before any door mounts. The slice also carries the
binding D5 carry-forward: the `NewShell.tsx` tier-selection effect restructure (stable tier
identity), Task 5.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, Zustand stores, Tailwind 4 +
design-system primitives (`Button`, `IconButton`, `Tag`, `Tooltip`, `JobIcon`, `GearSlotIcon`,
`Modal`).

**Spec:** `design/redesign/specs/phase-d-loot-plan.md` (D5 row, §2.2, §5 mount-obligation rows) +
`design/redesign/specs/phase-d-loot-design.md` (R-17, R-19, R-21; R-18/R-27 define what D6 adds
*later*, i.e. what D5 must NOT ship). Memory `project_phase_d_execution.md` "BINDING D5
CARRY-FORWARDS" is binding input.

## Global Constraints

- **The one §2.1 shared file this slice edits is `loot/QuickLogMaterialModal.tsx`** (V1-live via
  `LootPriorityPanel.tsx:765-784` ← `GroupViewContent.tsx`). Every hunk stays inside edit-mode
  branches, OR is a lazy initializer whose non-edit arm computes verbatim-today's value, OR is an
  R-D5a `allowSubs` addition whose off-state (`undefined` — what V1 and the matrix/queues doors
  pass) is value-identical; the D8 characterization suite passes **unedited** and its committed
  snapshot file is **byte-unchanged in the final diff**.
  **Test-file landmine (director F-10):** `QuickLogMaterialModal.test.tsx:144` — "Append new
  describe blocks AFTER this one — snapshots embed useId sequences." Every new describe this
  slice adds goes at the END of the file, or the byte-unchanged snapshot DoD breaks for reasons
  unrelated to the change.
  Two-part assert mandatory: (a) `git diff --stat` over legacy-only paths empty; (b) every hunk in
  the modal enumerated in the PR body with its V1 render path, carrying director SHARED-DRIFT
  sign-off. **The pinned-mode reset effect's dependency array is untouchable** (D8 guard-rail:
  `[isOpen, suggestedPlayer, maxWeek, material, allPlayers]`-era cadence must not change —
  current form `[mode, isOpen, suggestedPlayer, maxWeek, material, allPlayers, props.initialWeek]`
  at `QuickLogMaterialModal.tsx:426`).
- **Never edit:** anything under `components/history/` (`WeeklyLootGrid.tsx` is *reference only*),
  `LootPriorityPanel.tsx`, `WhoNeedsItMatrix.tsx`, `loot/FilterBar.tsx`, `utils/priorityEntries.ts`,
  `utils/lootRecommendationService.ts`, `utils/priority.ts`, `utils/recipientRanking.ts` (read-only
  reuse), `stores/lootTrackingStore.ts`, `loot/index.ts` exported names (additions ok; LogEmptyState
  is NOT in the barrel — verify before deleting), backend. **`GroupViewContent.tsx:693`'s skeleton
  gate is load-bearing for `useLogWeek`'s mount-only rule — do not touch it.**
- **Re-express, don't transcribe** (§2.2): `pnpm dupes` (jscpd, blocking CI) runs against
  `history/WeeklyLootGrid.tsx`. The grid derives columns from `FLOOR_LOOT_TABLES`
  (`gamedata/loot-tables.ts:32-61`), uses table semantics (legacy uses flex divs), design-system
  primitives (legacy has `eslint-disable no-raw-button` + raw `<button>`s), and token classes
  (legacy uses `${hex}10` alpha suffixes). Run `pnpm dupes` locally before the PR.
- **No `FLOOR_COLORS`** in any hunk this slice adds (phase DoD 5). Floor color =
  `FLOOR_TEXT_CLASS` / `FLOOR_ACCENT_CLASS` / new `FLOOR_TINT_CLASS` (`loot/floorClasses.ts`,
  v2-only) and `Tag tone="floor-N"`. Material label color = `var(--color-material-*)` semantic
  tokens. Role color = the `roleVar()` pattern (`NeedMatrix.tsx:46`).
- **The index.css hazard:** any decorative `aria-hidden` element that relies on flex/grid display
  MUST carry `role="presentation"` (the app-wide
  `[aria-hidden="true"]:not([role="presentation"])` display-revert rule at `index.css:239-243`;
  mechanism documented at `NeedMatrix.tsx:55-61`). Narrowing the rule itself is out of scope.
  **⚠ `GearSlotIcon`'s decorative branch is ITSELF a match for the rule** (director F-4):
  `GearSlotIcon.tsx:61-66` renders `aria-hidden="true"` with no `role` on an `inline-block` span
  whose box depends on inline width/height — the rule reverts it to `inline`, killing the size.
  It survives only under a flex/grid parent that blockifies it. **Never place it bare in a
  `<th>`/`<td>`** — wrap it in an `inline-flex`/`grid place-items-center` span (the wrapper is
  not aria-hidden, so no role needed). Do NOT fix this by editing `ui/GearSlotIcon.tsx` (shared,
  not in this slice's file table).
- **Design system:** no raw HTML controls without a justified `design-system-ignore`; 12px text
  floor (**legacy's `text-[10px]` labels are not reproducible — use `text-xs`**); clickable must
  look and announce clickable; "static" never "group" in user-facing copy.
- **D6 affordances are OUT** (ship none of them): Shift/Alt modifier clicks, `useAltHeld` cursor
  swap, kebab/right-click menus, `EntryPopover` (the ×N **count** renders; its click-to-popover
  does not), per-cell teaching tooltips, badge hover-`×`, count bar + `LootFairnessLegend`,
  "Log floor" on the floor header, `?entry=` highlight on Log (D6/D11), R-28 jumps (D12).
  Keyboard shortcuts are D14.
- **Week model:** the grid renders `logWeek.week` (the displayed week) and every write from it
  targets `writeWeek` — which on Log **is** `logWeek.week` (`Loot.tsx:531`). Do not thread
  `clock.currentWeek` into any grid cell path.
- **Green-commit constraint:** `.claude/hooks/pre_bash_guard.py` runs whole-project `tsc -b` on
  any commit with staged frontend TS — every commit must stay green (D4 precedent).
- **Deletion-trace discipline (binding, from the phase memory):** implementers prove each
  load-bearing assertion by EXECUTING the mutation (delete the branch/guard, run the test, paste
  the failure output, restore) — not by argument. Watch the vacuous-coincidence trap: drive test
  values apart wherever two week/player values would coincide by default.
- Gates before PR: `pnpm build` (**`tsc -b`**), `lint`, `check:design-system:strict`, `dupes`,
  `tokens:check`, `deadcode` (vs captured baseline), `test`. Browser validation both shells,
  including the **named DoD item: R-21's edit door demonstrated live** (see DoD). Release note
  `internal: true`, no `CURRENT_VERSION` bump. No AI attribution. Merge awaits the user.
- Branch: `phase-d/d5-grid-chassis` off `main`. SDD ledger:
  `.superpowers/sdd/2026-08-22-phase-d5-grid-chassis/progress.md`.

---

## File structure

| File | Status | Responsibility in this slice |
|---|---|---|
| `frontend/src/components/loot/QuickLogMaterialModal.tsx` | **edit (§2.1 shared — freeze-guarded)** | Task 1: §5(d) lazy edit-mode initializers + §5(b) once-per-open edit rehydration + R-D5a `allowSubs` on the pinned branch |
| `frontend/src/components/loot/QuickLogMaterialModal.test.tsx` | extend (append-only) | Task 1: identity-churn clobber regression + first-frame seed tests + allowSubs widening tests |
| `frontend/src/components/loot/QuickLogMaterialModal.type-test.tsx` | extend | Task 1: pinned+`allowSubs` compiles; V1 shape without it compiles |
| `frontend/src/components/loot/logWeekGridData.ts` | **new** | Task 2: pure cell-bucketing model from `FLOOR_LOOT_TABLES` |
| `frontend/src/components/loot/logWeekGridData.test.ts` | **new** | Task 2: bucketing/ordering/ring/fallback tests |
| `frontend/src/components/loot/materialSuggestion.ts` | **new** | Task 2: `suggestedMaterialRecipient` (one derivation for FloorCard + grid) |
| `frontend/src/components/loot/materialSuggestion.test.ts` | **new** | Task 2: suggestion parity tests |
| `frontend/src/components/loot/LogWeekGrid.tsx` | **new** | Task 3: presentation — sections, headers, cells, badges |
| `frontend/src/components/loot/LogWeekGrid.test.tsx` | **new** | Task 3: render/a11y/callback tests |
| `frontend/src/components/loot/FloorCard.tsx` | edit (v2-only) | Task 2: consume `suggestedMaterialRecipient` (behavior-identical refactor) |
| `frontend/src/components/loot/Loot.tsx` | edit (v2-only) | Task 4: mount grid, `MaterialState` edit arm + edit-door mount, header-comment rewrite |
| `frontend/src/components/loot/Loot.test.tsx` | extend | Task 4: wiring tests (prop-capturing grid mock) |
| `frontend/src/components/loot/LogEmptyState.tsx` + `.test.tsx` | **delete** | Task 4: superseded by the grid |
| `frontend/src/pages/NewShell.tsx` | edit (v2-only) | Task 5: tier-selection effect — stable identity restructure |
| `frontend/src/pages/NewShell.tierSelection.test.tsx` | **new** | Task 5: refetch-cadence + back/forward tests |
| `frontend/src/data/releaseNotes.ts` | extend | Task 6: internal entry |
| `design/redesign/specs/phase-d-loot-design.md` | edit (build notes) | Task 6: D5 build note under R-17 (interims + R-D5a/b/c) |
| `design/redesign/specs/phase-d-loot-plan.md` | edit (§5) | **Task 7 — only after the live browser demo:** close the R-21-demo + mount-obligation rows with evidence anchors |

**Not touched:** `components/history/**`, `LootPriorityPanel.tsx`, `stores/**`, `useLogWeek.ts`,
`WeekScopeControl.tsx`, `LootToolbar.tsx`, `GroupViewContent.tsx`, `useUrlTabState.ts`, tokens
pipeline (no new tokens — floor tokens exist since D0), backend.

---

### Task 1: Material modal — §5(d) lazy edit initializers + §5(b) once-per-open rehydration + R-D5a `allowSubs`

**Files:**
- Modify: `frontend/src/components/loot/QuickLogMaterialModal.tsx`
- Test: `frontend/src/components/loot/QuickLogMaterialModal.test.tsx` (extend — **append new
  describe blocks at the END of the file only**, per the `:144` snapshot landmine; do NOT edit
  existing describe blocks — the D8 characterization suite must stay unedited)
- Test: `frontend/src/components/loot/QuickLogMaterialModal.type-test.tsx` (extend)

**Interfaces:**
- Consumes: the existing edit-door props (`floors: string[]`, `editEntry: MaterialLogEntry`,
  base props at `QuickLogMaterialModal.tsx:37-47`); `editGearSelection` (`:154-169`); module-scope
  test helpers `makePlayer`/`makeGear`/`checkboxByLabelText` (the edit fixtures `EDIT_FLOORS`/
  `editFixturePlayers`/`editEntryFixture`/`renderEdit` at `:905-983` are describe-scoped and NOT
  reachable — the new describe defines its own local `makeMaterialEntry` + floors fixture).
- Produces: the props union grown by ONE optional field on the pinned branch:
  `allowSubs?: boolean` (**R-D5a**, user-ruled 2026-08-22 — default off; V1's door and the
  matrix/queues cell doors never pass it, so their filter stays R-a's main-roster-only verbatim).
  Behavioral contract for Task 4's mount: a conditionally-mounted edit door seeds every field
  from `editEntry` on the **first frame** (no free-form flash); an in-progress edit survives
  `allPlayers`/`editEntry` **identity** churn (same `id`) while open; a pinned door opened with
  `allowSubs` renders the "Include substitutes" checkbox and widens `eligiblePlayers` exactly as
  the non-pinned modes do.

**Why first:** D5 mounts the edit door for the first time (Loot.tsx conditional mount). Without
(d), the first frame renders free-form defaults (floor 2 / glaze / week=maxWeek / method=drop)
before the effect corrects it; without (b), any background `fetchTier` → new `tier.players`
identity re-clobbers in-progress edits (typed note, changed week, picked slot — silent
snap-back). Both verified live in the modal today: non-lazy `useState` at `:279, :280, :310,
:311, :313, :315, :319`; edit reset effect deps `[mode, isOpen, editEntry, allPlayers]` at
`:452-480`.

- [ ] **Step 1: Write the failing regression tests** (new describe block
  `'D5 §5 mount obligations — edit-door stability'`, APPENDED at the end of the file; it defines
  a local `makeMaterialEntry(overrides): MaterialLogEntry` and a local 4-name floors array —
  module-scope `makePlayer` is reusable, the edit-describe's fixtures are not):

```tsx
// (b) identity churn must not clobber an in-progress edit
it('preserves an in-progress edit when allPlayers identity churns', async () => {
  const entry = makeMaterialEntry({ id: 7, materialType: 'twine', weekNumber: 2, notes: '' });
  const players = [makePlayer({ id: 'p1' }), makePlayer({ id: 'p2' })];
  const { rerender } = render(
    <QuickLogMaterialModal isOpen onClose={vi.fn()} groupId="g" tierId="t"
      floors={D5_FLOORS} editEntry={entry} maxWeek={4} allPlayers={players} />,
  );
  await userEvent.type(screen.getByLabelText(/notes/i), 'split with alt');
  // background fetchTier: same content, NEW array + object identities
  rerender(
    <QuickLogMaterialModal isOpen onClose={vi.fn()} groupId="g" tierId="t"
      floors={D5_FLOORS} editEntry={{ ...entry }} maxWeek={4}
      allPlayers={players.map((p) => ({ ...p }))} />,
  );
  expect(screen.getByLabelText(/notes/i)).toHaveValue('split with alt');
});
```

  **(d) needs a mechanism that can observe render #1** (director F-2: RTL's `render()` is
  `act()`-wrapped and flushes passive effects, so a post-render DOM assert is vacuous — the
  existing `:986` edit test already asserts the post-effect values and is green today). Use a
  props-recording passthrough mock of the week `NumberInput`: `vi.mock` the module with
  `importActual`, render the REAL component but push each received `value` into a module-scope
  `recordedWeekValues` array (cleared in `beforeEach`). Every other test renders identical DOM
  (passthrough), so the snapshot stays byte-identical. Then:

```tsx
// (d) first frame is entry-seeded, not free-form-default
it('seeds the week from the entry on the FIRST render, not via the effect', () => {
  const entry = makeMaterialEntry({ id: 8, materialType: 'solvent', weekNumber: 3, method: 'purchase' });
  render(<QuickLogMaterialModal isOpen onClose={vi.fn()} groupId="g" tierId="t"
    floors={D5_FLOORS} editEntry={entry} maxWeek={4} allPlayers={[makePlayer({ id: 'p1' })]} />);
  expect(recordedWeekValues[0]).toBe(3);   // pre-fix: 4 (maxWeek) on render #1
  // + same-shape first-render asserts for the floor/material pills (pressed-state
  //   props) and the method RadioGroup value, via the same recording technique
});
```

// (R-D5a) pinned door + allowSubs widens; without it, verbatim-today
```tsx
it('pinned door with allowSubs offers and applies the subs checkbox', async () => {
  const sub = makePlayer({ id: 'p9', isSubstitute: true });
  render(<QuickLogMaterialModal isOpen onClose={vi.fn()} groupId="g" tierId="t"
    floor="M10S" material="glaze" suggestedPlayer={makePlayer({ id: 'p1' })}
    maxWeek={4} allPlayers={[makePlayer({ id: 'p1' }), sub]} allowSubs />);
  await userEvent.click(checkboxByLabelText(/include substitutes/i));
  // sub now selectable in the recipient Select
});
it('pinned door WITHOUT allowSubs renders no subs checkbox (R-a preserved)', () => { /* absent */ });
```

- [ ] **Step 2: Run them to verify they fail** — paste the failure output into the ledger.
  Expected: (b) fails with notes reset to `''`; (d) fails with `recordedWeekValues[0] === 4`;
  the allowSubs widening test fails (checkbox absent). The R-a-preserved test PASSES already
  (it pins current behavior). If (d) passes immediately, the recording mock is wrong — fix the
  test, not the claim. **This RED output is a hard gate — no argument substitutes for it.**

- [ ] **Step 3: Implement (d) — lazy initializers branching on edit mode.** Extract one pure
  seed helper so the initializers and the rehydration effect cannot drift:

```ts
/** Field seed for edit mode — single source for lazy initializers AND reopen rehydration. */
function editEntrySeed(entry: MaterialLogEntry) {
  // Floor fallback moved VERBATIM from the reset effect (QuickLogMaterialModal.tsx:459-462) —
  // the table-membership test, not a re-derivation (director F-9: getFloorForUpgradeMaterial
  // only coincidentally agrees with FLOOR_LOOT_TABLES today; don't create a second source).
  const parsedFloorNum = parseFloorName(entry.floor);
  const floorNumber = FLOOR_LOOT_TABLES[parsedFloorNum].upgradeMaterials.includes(entry.materialType)
    ? parsedFloorNum
    : getFloorForUpgradeMaterial(entry.materialType)[0];
  return {
    floorNumber,
    material: entry.materialType,
    week: entry.weekNumber,
    method: entry.method || 'drop',
    notes: entry.notes ?? '',
  } as const;
}
```

Then branch each non-lazy `useState` (`:279, :280, :310, :311, :319`, plus `updateGear`/
`includeSubs` at `:313`/`:315`) into a lazy initializer whose **non-edit arm computes exactly
today's value**, e.g.:

```ts
const [selectedWeek, setSelectedWeek] = useState(() =>
  mode === 'edit' ? editEntrySeed(editEntry!).week : (props.initialWeek ?? maxWeek));
const [method, setMethod] = useState<LootMethod>(() =>
  mode === 'edit' ? editEntrySeed(editEntry!).method : 'drop');
const [includeSubs, setIncludeSubs] = useState(() =>
  mode === 'edit'
    ? (allPlayers.find((p) => p.id === editEntry!.recipientPlayerId)?.isSubstitute ?? false)
    : false);
const [updateGear, setUpdateGear] = useState(() =>
  mode === 'edit'
    ? editGearSelection(editEntry!.materialType, editEntry!.slotAugmented,
        allPlayers.find((p) => p.id === editEntry!.recipientPlayerId)).updateGear
    : true);
```
(`recipientPlayerId`/`selectedSlot`/`augmentTomeWeapon` already lazy-branch — `:296-309`,
`:324-340` — leave them.) The edit rehydration effect (`:452-480`) then reuses `editEntrySeed`
for its floor/material/week/method/notes lines so the two paths stay identical.

- [ ] **Step 4: Implement (b) — gate the EDIT rehydration to open-edge / entry change.** Only the
  edit effect changes; **pinned (`:426`) and free-form (`:442`) effects stay byte-identical**:

```ts
// §5(b): rehydrate once per open (or when a different entry opens on a persistent
// mount) — NEVER on allPlayers/editEntry identity churn mid-edit, which re-applied
// the entry over the user's in-progress edits (typed note, changed week — silent
// snap-back). allPlayers stays in the dep array for lint; the seed guard makes it inert.
const seededForRef = useRef<number | null>(null);
useEffect(() => {
  if (mode !== 'edit' || !isOpen) { seededForRef.current = null; return; }
  if (seededForRef.current === editEntry!.id) return;
  seededForRef.current = editEntry!.id;
  /* existing body, floor/material/week/method/notes lines now via editEntrySeed */
}, [mode, isOpen, editEntry, allPlayers]);
```

- [ ] **Step 5: Implement R-D5a — `allowSubs` on the pinned branch.** (i) The union's pinned
  branch (`QuickLogMaterialModal.tsx:50-61`) gains `allowSubs?: boolean` with a doc comment
  naming its one consumer (v2's Log-grid cell door) and the R-a preservation (matrix/queues/V1
  never pass it). (ii) The `eligiblePlayers` memo (`:591-597`) becomes:

```ts
allPlayers.filter((p) => mode === 'pinned'
  ? (p.configured && (allowSubs ? (includeSubs || !p.isSubstitute) : !p.isSubstitute))
  : (p.configured && (includeSubs || !p.isSubstitute)))
```
  with `allowSubs` added to the memo deps (a `useMemo`, not a reset effect — the D8 dep-array
  guard-rail protects the **effects**, which do not change here). (iii) The checkbox render gate
  (`:733-740`) becomes `mode !== 'pinned' || allowSubs`. With `allowSubs` undefined every
  expression is value-identical to today. Type-test: pinned + `allowSubs` compiles; the V1 shape
  (no `allowSubs`) compiles unchanged.

- [ ] **Step 6: Run the new tests — all pass.** Then the **full existing file suite unedited**:
  `pnpm test QuickLogMaterialModal` — every D8 characterization + edit/free-form test green;
  both type-tests compile.

- [ ] **Step 7: Deletion-trace (execute, paste output):** (i) revert the `seededForRef` guard
  (make the effect body unconditional again) → test (b) must FAIL; restore. (ii) change
  `selectedWeek`'s lazy initializer edit arm back to `props.initialWeek ?? maxWeek` → test (d)
  must FAIL; restore. (iii) hardcode `allowSubs` to `false` in the filter → the widening test
  must FAIL while the R-a-preserved test stays green; restore. Paste all three failure outputs
  into the ledger.

- [ ] **Step 8: Freeze evidence:** `git diff` the file and confirm every hunk is inside
  `mode === 'edit'` branches, a lazy initializer whose non-edit arm is verbatim-today, or an
  R-D5a `allowSubs` expression whose off-state is value-identical; confirm `git status` shows
  `__snapshots__/` untouched. Record the hunk list in the ledger for the PR body's §2.1
  enumeration.

- [ ] **Step 9: Commit** — `fix(loot): material modal — first-frame edit seeds, once-per-open rehydration, allowSubs cell door (D5 §5 b/d + R-D5a)`

---

### Task 2: `logWeekGridData.ts` + `materialSuggestion.ts` — the pure model

**Files:**
- Create: `frontend/src/components/loot/logWeekGridData.ts`, `.../logWeekGridData.test.ts`
- Create: `frontend/src/components/loot/materialSuggestion.ts`, `.../materialSuggestion.test.ts`
- Modify: `frontend/src/components/loot/FloorCard.tsx:113-119, :180` (consume the helper)

**Interfaces:**
- Consumes: `FLOOR_LOOT_TABLES`, `UPGRADE_MATERIAL_DISPLAY_NAMES`, `isSlotAugmentationMaterial`,
  `FloorNumber` (`gamedata/loot-tables.ts`); `GEAR_SLOT_NAMES`, `LootLogEntry`,
  `MaterialLogEntry`, `MaterialType`, `GearSlot`, `SnapshotPlayer`, `StaticSettings` (`types`);
  read-only: `getPriorityForUpgradeMaterial`, `getPriorityForUniversalTomestone`,
  `isPriorityDisabled` (`utils/priority` — FloorCard's exact import), `enhancePriorityEntries`
  (`utils/priorityEntries`), `calculateAverageDrops` (`utils/lootCoordination`).
- Produces (Task 3/4 rely on these exact names):

```ts
export interface LogGridGearCell {
  slot: GearSlot | 'ring';          // picker vocabulary — floor 1's ring1 collapses to 'ring'
  label: string;                    // 'Ring' | GEAR_SLOT_NAMES[slot]
  entries: LootLogEntry[];          // this week+floor+slot, createdAt DESC (newest first)
}
export interface LogGridMaterialCell {
  material: MaterialType;
  label: string;                    // UPGRADE_MATERIAL_DISPLAY_NAMES[material]
  entries: MaterialLogEntry[];      // createdAt DESC
}
export interface LogGridFloor {
  floorNumber: FloorNumber;
  floorName: string;                // floors[n-1] ?? `Floor ${n}`
  bookNumeral: string;              // FLOOR_LOOT_TABLES[n].bookType — 'I'…'IV'
  gearCells: LogGridGearCell[];
  materialCells: LogGridMaterialCell[];
}
export function buildLogWeekGrid(args: {
  floors: string[]; week: number;
  lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[];
}): LogGridFloor[];                 // always length 4, floor 1 → 4 (ascending — §4 mockup order, ruled)

// One derivation for FloorCard's queue rows AND the grid's cell suggestion
// (director F-13: returning only `top` would run the base + enhance pass twice
// per FloorCard material row and recompute averageDrops outside its memo).
export function materialPriorityEntries(args: {
  material: MaterialType; players: SnapshotPlayer[]; settings: StaticSettings;
  lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; currentWeek: number;
  /** Pass a precomputed value to keep the caller's memo (FloorCard.tsx:87-90); computed when omitted. */
  averageDrops?: number;
}): PriorityEntry[];                 // enhanced, ranked; [0]?.player is the suggestion

export function suggestedMaterialRecipient(
  args: Parameters<typeof materialPriorityEntries>[0],
): SnapshotPlayer | undefined;       // = materialPriorityEntries(args)[0]?.player
```

**Bucketing rules (each is a test):**
1. Columns derive from `FLOOR_LOOT_TABLES[n].gearDrops` / `.upgradeMaterials` —
   `ring1 → { slot: 'ring', label: 'Ring' }` (the `FloorCard.tsx:95-97` mapping), others
   `GEAR_SLOT_NAMES[slot]`. Material column labels are the SHORT forms — Twine / Glaze /
   Solvent / **Tome** (`universal_tomestone` is 'Tome', matching the §4 mockup column
   (`phase-d-loot-design.md:663`) and the legacy grid's own column label; the long
   `UPGRADE_MATERIAL_DISPLAY_NAMES` form stays for modals/History — director F-14ii, recorded
   in Task 6's build note).
2. An entry lands in floor *n*'s bucket iff `entry.weekNumber === week` AND
   `entry.floor === (floors[n-1] ?? 'Floor ' + n)`. Entries store floor **names**; the fallback
   matches what v2 *writes* for an unnamed tier (`Loot.tsx:740` et al.) — NOT a legacy-lookup
   parity claim: legacy's lookup path has no fallback (`WeeklyLootGrid.tsx:348,:354,:366`; only
   its display config has `|| 'Floor N'`) — director F-8.
3. The `'ring'` cell buckets `itemSlot ∈ {'ring','ring1','ring2'}` — current v2 writers produce
   `'ring1'` (`RecipientPicker.tsx:521`, wizard), but historical/legacy entries can carry `'ring'`
   or `'ring2'` (`utils/lootCoordination.ts:89-106` tolerates all three). The legacy grid keyed
   raw `itemSlot` and silently dropped `'ring'`/`'ring2'` entries — a quirk we do NOT reproduce.
4. Every other gear cell buckets by exact `itemSlot` match; material cells by exact
   `materialType` match.
5. Cell entries sort `createdAt` DESC (newest first — the displayed badge); ties break by `id`
   DESC. **Materials bucket symmetrically to loot** (array, not `find`) — the legacy grid showed
   only one material entry per cell, which under-reports a double-solvent week; deliberate
   re-expression delta, recorded in Task 6's build note.
6. Entries matching no cell (unknown slot, `floor: 'Adjustment'` page-ledger echoes, week
   mismatch) are silently excluded — assert none throw.
7. `materialPriorityEntries` mirrors `FloorCard.tsx:85-93 + :113-118` exactly: enhanced gate =
   `settings.enableEnhancedScoring === true && !isPriorityDisabled(settings) && lootLog.length > 0`;
   base = `isSlotAugmentationMaterial(material) ? getPriorityForUpgradeMaterial(players, material,
   settings, materialLog) : getPriorityForUniversalTomestone(players, settings, materialLog)`;
   enhanced via `enhancePriorityEntries(entries, { settings, lootLog, currentWeek, averageDrops,
   active })` with `averageDrops` computed only when not passed in.
   `suggestedMaterialRecipient` is the thin `[0]?.player` wrapper.

**Steps:**

- [ ] **Step 1:** Write `logWeekGridData.test.ts` covering rules 1–6 (RED). Fixtures: minimal
  entry factories local to the test (the repo has no shared loot fixtures — check
  `QuickLogMaterialModal.test.tsx`'s helpers for the shape; do not import another test's
  helpers). Include: a week-2 grid ignores week-3 entries; ring bucketing across all three
  spellings; two same-cell entries ordered newest-first; empty `floors` array still yields 4
  floors with fallback names; floor-4 has exactly one gear cell (`weapon`) and zero material
  cells.
- [ ] **Step 2:** Run — all fail (module missing).
- [ ] **Step 3:** Implement `buildLogWeekGrid` (pure, no React). Index entries once
  (`Map<string, …[]>` keyed `floorName + ':' + slotOrMaterial`), then map floors — do not
  re-scan the logs per cell.
- [ ] **Step 4:** Run — green.
- [ ] **Step 5:** Write `materialSuggestion.test.ts` (RED): ranked-entries shape, top-needer
  selection, universal tomestone branch, enhanced-vs-disabled gate, `averageDrops` passthrough
  (spy that `calculateAverageDrops` is NOT called when the arg is supplied), empty-pool →
  `undefined` from the wrapper. Then implement `materialPriorityEntries` +
  `suggestedMaterialRecipient` per rule 7.
- [ ] **Step 6:** Refactor `FloorCard.tsx:113-119` to build `materialRows` from ONE
  `materialPriorityEntries(...)` call per material (passing its memoized `averageDrops` from
  `:87-90`), keeping `entries: toRowEntries(entries)` and `top: entries[0]?.player` — no double
  derivation (director F-13) — and keep `?? players[0]` at the call site `:180` (the A11
  fallback stays FloorCard's). Behavior-identical: run `pnpm test FloorCard` — the existing
  suite green, unedited.
- [ ] **Step 7: Deletion-trace (execute, paste):** (i) in `buildLogWeekGrid`, drop the
  week-number filter → week-isolation test FAILS; restore. (ii) narrow ring bucketing to
  `'ring1'` only → ring test FAILS; restore.
- [ ] **Step 8: Commit** — `feat(loot): D5 grid data model — floor cell bucketing + shared material suggestion`

---

### Task 3: `LogWeekGrid.tsx` — the chassis

**Files:**
- Create: `frontend/src/components/loot/LogWeekGrid.tsx`, `.../LogWeekGrid.test.tsx`

**Interfaces:**
- Consumes: `buildLogWeekGrid` + the Task-2 types; `FLOOR_TEXT_CLASS`, `FLOOR_ACCENT_CLASS`
  (`floorClasses.ts` — unchanged; R-D5b dropped the tint); `GearSlotIcon` (`ui/GearSlotIcon.tsx`
  — default size 16, `'ring'`-tolerant, **must be wrapped per the Global-Constraints F-4 rule**);
  `JobIcon`; `Tag` (`ui/Tag.tsx` — duty-name chip, R-D5b); `getRoleColor`/`getValidRole` via the
  `roleVar` pattern (`NeedMatrix.tsx:46`); `Button` (`primitives/Button.tsx`).
- Produces (Task 4 relies on these exact props):

```ts
export interface LogWeekGridProps {
  floors: string[];
  week: number;
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  players: SnapshotPlayer[];        // badge job/role/name lookups (full roster incl. subs —
                                    // a sub who received loot must still render)
  canEdit: boolean;
  canAssignMaterial: boolean;       // false on a degenerate empty roster — empty material
                                    // cells render read-only instead of a silently dead
                                    // button (director F-12; FloorCard.tsx:174-180 precedent)
  onAssignGear: (item: { slot: GearSlot | 'ring'; label: string; floorNumber: FloorNumber }) => void;
  onEditGear: (entry: LootLogEntry) => void;
  onAssignMaterial: (material: MaterialType, floorNumber: FloorNumber) => void;
  onEditMaterial: (entry: MaterialLogEntry) => void;
}
export function LogWeekGrid(props: LogWeekGridProps): JSX.Element;
```

**Rendering contract (each line is a test target):**

1. **Card + sections:** one wrapper `div` (`rounded-lg border border-border-default
   bg-surface-card overflow-hidden`, `data-testid="log-week-grid"`), four floor sections in
   **ascending** order (Floor 1 → 4 — the §4 mockup's order; FloorCard's Queues run 4→1, but the
   Log reads as a record top-to-bottom).
2. **Section header (R-19 + R-D5b, user-ruled):** match `FloorCard`'s shipped treatment
   (`FloorCard.tsx:126-133`) — `FLOOR_ACCENT_CLASS[n]` (the 3px left stripe), **no tint band**,
   the duty name as `Tag variant="label" tone="muted"` (when `floors[n-1]` exists), and
   `Floor {n} · Book {bookNumeral}` with "Floor {n}" in
   `font-display text-sm font-bold ${FLOOR_TEXT_CLASS[n]}` and `· Book {bookNumeral}` in
   `text-xs text-text-muted` (interpunct `·`). Floor color appears ONLY here — cells stay
   neutral.
3. **Table semantics:** each floor section is a real `<table class="w-full text-sm">` inside its
   own `overflow-x-auto` scroller: a `<caption class="sr-only">` naming the floor + week
   (`"{floorName} — Floor {n}, Book {bookNumeral}, week {week} record"`); a `<thead>` row of
   column headers — `<th scope="col">` per cell with `GearSlotIcon` **inside an
   `inline-flex items-center gap-1` wrapper span** (F-4: never bare in a `<th>` — the
   aria-hidden icon's inline-block is reverted to inline outside a blockifying parent) or a
   material label colored `var(--color-material-*)` via inline style, plus the cell label text;
   one `<tbody>` row of `<td>` cells, led by a `<th scope="row">` reading `Loot`
   (`text-xs uppercase tracking-wide text-text-muted` — the legacy grid's sticky "Loot" row
   label, re-expressed). Column count varies per floor (F1: 4 gear · F2: 3 gear + 2 mats ·
   F3: 2 gear + 2 mats · F4: 1 gear); material columns get the differentiated treatment
   `border-l border-border-default bg-surface-base` on both `<th>` and `<td>` (legacy
   `WeeklyLootGrid.tsx:708` re-expressed).
4. **Cell body:** min-height reserved (`min-h-7` on the badge area) so empty↔filled toggles do
   not shift layout (legacy's fixed-28px rationale, `WeeklyLootGrid.tsx:374-376`).
   - **Empty:** an em-dash `—` (`text-text-muted italic`).
   - **Filled:** a `RecipientBadge` (file-local component): `inline-flex items-center gap-1
     rounded px-2 py-1 text-xs font-semibold`, inline style `color: roleVar(player)`,
     `backgroundColor: color-mix(in srgb, {roleVar} 15%, transparent)`, `border: 1px solid
     color-mix(in srgb, {roleVar} 30%, transparent)` — with `<JobIcon job={player.job}
     size="xs" />` + the player name. Unknown `recipientPlayerId` → fall back to
     `entry.recipientPlayerName` with `var(--color-text-secondary)` (players leave rosters;
     the record survives them).
   - **Multi-entry:** newest entry's badge + a static count chip `×{n}` (`text-xs font-bold
     rounded bg-accent/20 text-accent px-1`) when `entries.length > 1`. The chip is **not**
     interactive (`EntryPopover` is D6); it is plain text, NOT aria-hidden.
5. **Interactivity (R-17):** when `canEdit`, the whole cell body is ONE interactive control:
   `Button variant="ghost" size="sm"` with `className="w-full justify-start"` wrapping the badge
   area, `aria-label` = `Log {label} — {floorName}` (empty) / `Edit {label} for {name} —
   {floorName}` (filled; newest entry). Clicks: empty gear → `onAssignGear({slot,label,
   floorNumber})`; filled gear → `onEditGear(entries[0])`; empty material →
   `onAssignMaterial(material, floorNumber)`; filled material → `onEditMaterial(entries[0])`.
   Editing older same-cell entries arrives with D6's popover (Task 6 records the interim).
   **The primitive comes first** (director F-15): build with `Button`; `IconButton` already
   lives inside a `<td>` on the peer surface (`NeedMatrix.tsx:206-219`). A
   `design-system-ignore`'d file-local raw `<button>` is permitted ONLY after a before/after
   screenshot of the concrete geometry failure is pasted in the SDD ledger — never on
   aesthetic preference; if taken, it is a named line in the PR body.
   When `!canEdit`: no button — the badge/em-dash renders bare with an `sr-only` sentence per
   cell (`"{label}: {name or 'not logged'}"`), the NeedMatrix read-only pattern
   (`NeedMatrix.tsx:226-229`). When `canEdit && !canAssignMaterial`: empty MATERIAL cells take
   the read-only branch too (F-12 — no enabled button whose handler cannot act); filled material
   cells stay editable (the edit door needs no suggestion pool).
6. **The index.css hazard:** any decorative aria-hidden wrapper using flex/grid carries
   `role="presentation"` (Global Constraints). `GearSlotIcon` handles its own `aria-hidden`;
   only wrappers need care.
7. **No week/`—`-count claims in copy** beyond the caption; no "group" in any string.

**Steps:**

- [ ] **Step 1:** Write `LogWeekGrid.test.tsx` (RED) covering: four sections ascending with
  R-19 header content (accent class + `Floor 2 · Book II` text); per-floor column sets (F1
  4 columns, F2 5, F3 4, F4 1); empty cell renders `—` and an assign button with the right
  aria-label; filled cell renders badge (name + job icon) and an edit button; multi-entry cell
  shows `×2` and edit targets the NEWEST entry (drive `createdAt` apart — no coincident values);
  material cell fires `onAssignMaterial`/`onEditMaterial` with material + floorNumber; ring cell
  buckets a `'ring2'` entry; `canEdit={false}` renders zero buttons but still shows badges;
  `canAssignMaterial={false}` renders no button on empty material cells while filled material
  cells keep their edit button (F-12); every `GearSlotIcon` in a `<th>` sits inside an
  `inline-flex` wrapper (structural assert — jsdom can't compute the CSS, the browser pass
  verifies the render, F-4); unknown recipient falls back to `recipientPlayerName`;
  `role="presentation"` present on any aria-hidden flex wrapper the implementation adds.
- [ ] **Step 2:** Run — fail (module missing).
- [ ] **Step 3:** Implement per the rendering contract. Derive rows via
  `useMemo(() => buildLogWeekGrid(...), [floors, week, lootLog, materialLog])`; player lookup
  via a `useMemo` `Map` over `players`.
- [ ] **Step 4:** Run — green. Then `pnpm lint` on the new files (design-system plugin) and fix
  or justify every warning.
- [ ] **Step 5: Deletion-trace (execute, paste):** (i) swap `entries[0]` → `entries[entries.length-1]`
  in the edit handler → newest-entry test FAILS (proves the ordering assertion bites); restore.
  (ii) remove `canEdit` gating → read-only test FAILS; restore.
- [ ] **Step 6: Commit** — `feat(loot): D5 LogWeekGrid chassis — floor sections, R-19 headers, cells`

---

### Task 4: Wire the grid into `Loot.tsx` + the R-21 edit door + delete `LogEmptyState`

**Files:**
- Modify: `frontend/src/components/loot/Loot.tsx` (`:89-96` comment block, `:123` import,
  `:258-261` MaterialState, `:726-729` body, `:849+` modal mounts)
- Delete: `frontend/src/components/loot/LogEmptyState.tsx`, `.../LogEmptyState.test.tsx`
- Test: `frontend/src/components/loot/Loot.test.tsx` (extend)

**Interfaces:**
- Consumes: `LogWeekGrid` (Task 3 props), `suggestedMaterialRecipient` (Task 2), the fixed edit
  door (Task 1), existing `PickerState` (`Loot.tsx:250-254`), `writeWeek` (`:531`),
  `getFloorForUpgradeMaterial`.
- Produces: the Log tab's real body; `MaterialState` gains
  `{ mode: 'edit'; editEntry: MaterialLogEntry }`.

**Steps:**

- [ ] **Step 1:** Write the failing wiring tests in `Loot.test.tsx`, using a prop-capturing mock
  of `LogWeekGrid` (the D8 modal-mock precedent in this file):
  - on `lview=log`, `LogWeekGrid` mounts with `week === logWeek.week` — **drive the displayed
    week away from the clock week first** (set a `?week=` param ≠ clock week; the two coincide
    by default — the vacuous-assert trap from the phase memory).
  - captured `onAssignGear({slot:'ring',label:'Ring',floorNumber:1})` →
    `RecipientPicker` mounts `mode="assign"` with `item.floorName === floors[0]` and
    `currentWeek === logWeek.week`.
  - captured `onEditGear(entry)` → picker `mode="edit"` with that `editEntry`.
  - captured `onAssignMaterial('glaze', 2)` → material modal pinned door with
    `floor === floors[1]`, `material === 'glaze'`, `initialWeek === logWeek.week`, `showNotes`,
    **`allowSubs === true` and `allPlayers === players` (the full roster — R-D5a: the checkbox
    widens from it; asserted on identity against a fixture containing a substitute)**, and a
    `suggestedPlayer` (mock `suggestedMaterialRecipient` to a known player and assert it
    arrives; also assert the `?? mainRosterPlayers[0]` fallback when it returns undefined).
  - the matrix/FloorCard cell doors still mount WITHOUT `allowSubs` and with
    `allPlayers === mainRosterPlayers` (R-a preserved — pin it so a refactor can't silently
    widen them).
  - captured `onEditMaterial(entry)` → material modal EDIT door with `editEntry === entry`,
    `floors`, and **`allPlayers === players` (the FULL roster, not `mainRosterPlayers`)** —
    §5(a), asserted on identity against a fixture whose roster contains a substitute.
  - `LogEmptyState` no longer renders (`log-empty-state` testid absent on `lview=log`).
- [ ] **Step 2:** Run — fail.
- [ ] **Step 3:** Implement:

```tsx
// MaterialState (:258-261) gains the R-21 edit arm; the cell arm gains R-D5a's rider —
// only the GRID's door sets it; the matrix/FloorCard doors keep R-a's inheritance:
type MaterialState =
  | { mode: 'cell'; material: MaterialType; floorName: string; suggested: SnapshotPlayer;
      allowSubs?: boolean }
  | { mode: 'freeform' }
  | { mode: 'edit'; editEntry: MaterialLogEntry }
  | null;

// Log body (replaces <LogEmptyState /> at :726-729):
<LogWeekGrid
  floors={floors}
  week={logWeek.week}
  lootLog={lootLog}
  materialLog={materialLog}
  players={players}
  canEdit={canEdit}
  canAssignMaterial={mainRosterPlayers.length > 0}
  onAssignGear={(item) =>
    setPickerState({ mode: 'assign',
      item: { ...item, floorName: floors[item.floorNumber - 1] ?? `Floor ${item.floorNumber}` } })}
  onEditGear={(entry) => setPickerState({ mode: 'edit', editEntry: entry })}
  onAssignMaterial={(material, floorNumber) => {
    // R-D5c (user-ruled): the suggestion is CLOCK-week priority — "who is up next now" —
    // even when back-logging; the write itself targets the displayed week (initialWeek).
    const suggested = suggestedMaterialRecipient({
      material, players: mainRosterPlayers, settings, lootLog, materialLog,
      currentWeek: clock.currentWeek,
    }) ?? mainRosterPlayers[0];
    if (!suggested) return; // unreachable behind canAssignMaterial — TS narrowing only
    setMaterialState({ mode: 'cell', material,
      floorName: floors[floorNumber - 1] ?? `Floor ${floorNumber}`, suggested,
      allowSubs: true /* R-D5a: the grid door reaches subs */ });
  }}
  onEditMaterial={(entry) => setMaterialState({ mode: 'edit', editEntry: entry })}
/>

// The existing cell-door mount (:849-867) forwards the rider — allPlayers widens to the
// full roster ONLY when the door allows subs (the checkbox needs them in the pool):
//   allowSubs={materialState.allowSubs}
//   allPlayers={materialState.allowSubs ? players : mainRosterPlayers}

// New conditional mount beside the cell/freeform doors (:849+):
{materialState?.mode === 'edit' && (
  <QuickLogMaterialModal
    isOpen
    onClose={() => setMaterialState(null)}
    groupId={group.id}
    tierId={tier.tierId}
    floors={floors}
    editEntry={materialState.editEntry}
    maxWeek={clock.maxWeek}
    allPlayers={players}
    /* §5(a): FULL roster — the entry's recipient may be a substitute, and the
       "Include substitutes" checkbox widens from here. §5(b)'s mid-edit identity
       churn is neutralized modal-side (Task 1). */
    settings={settings}
    onSuccess={refresh}
  />
)}
```
  The modal's `initialWeek` for the CELL door stays `writeWeek` (already wired at `:858`).
  Delete the `LogEmptyState` import + files. Rewrite the header-comment "D4 interims" block
  (`Loot.tsx:89-96`) — the grid is here; the still-open interims are Books card +
  displayed-week reset menu (D7), Log's `?entry=` highlight (D6/D11), count bar/legend (D6) —
  **and remove `LogEmptyState` from the boundary-discipline sibling list at `Loot.tsx:12-16`**
  (director F-11: the header must not describe a deleted file).
- [ ] **Step 4:** Run the Loot suite + full `pnpm test` — green. `pnpm build` green.
- [ ] **Step 5: Deletion-trace (execute, paste):** change the edit-door mount's `allPlayers`
  to `mainRosterPlayers` → the §5(a) identity test FAILS; restore. Change `week={logWeek.week}`
  to `clock.currentWeek` → the displayed-week test FAILS (proves Step 1 drove them apart);
  restore.
- [ ] **Step 6: Commit** — `feat(loot): D5 — weekly grid on Log; material edit door first mount; LogEmptyState retired`

---

### Task 5: `NewShell.tsx` tier-selection effect — stable tier identity (binding carry-forward)

**Files:**
- Modify: `frontend/src/pages/NewShell.tsx:231-260`
- Test: create `frontend/src/pages/NewShell.tierSelection.test.tsx`

**Interfaces:**
- Consumes: the existing effect body (fetchTiers → resolve URL/localStorage/active →
  `fetchTier` + `fetchCurrentWeek` + `?tier=` mirror).
- Produces: identical selection behavior with the refetch storm removed — the effect re-runs
  ONLY on group change or a real `?tier=` value change, never on unrelated URL writes (`lview`
  switches, `useLogWeek`'s `?week=` mirror — the exact writes D5's grid multiplies).

**Refuted shapes (do NOT reintroduce — phase memory):** a run-key guard (round 3, reverted
round 4 — turned an interrupted cold load into a permanent abort with `currentTier` stuck null);
dep-narrowing alone (react-router ≥7.18's `setSearchParams` identity churns per URL write, so it
stays a churning dep); a render-phase ref (`react-hooks/refs` is `error` in `src/pages`).

**The fix shape (all three legs, together):**
1. Read the tier param as a string at component level: `const urlTierId = searchParams.get('tier');`
2. Stabilize the writer with an effect-updated ref (lint-legal — the ban is render-phase writes):

```ts
const setSearchParamsRef = useRef(setSearchParams);
useEffect(() => { setSearchParamsRef.current = setSearchParams; });
```
3. The tier effect keeps its exact body (including the `cancelled` cleanup — the self-healing
   restart property the round-4 revert protected) but reads `urlTierId` instead of
   `searchParams.get('tier')`, writes via `setSearchParamsRef.current`, **guards the mirror**
   (director F-5) — `if (urlTierId !== activeTier.tierId) setSearchParamsRef.current(…)` — and
   its deps become `[currentGroup?.id, urlTierId, fetchTiers, fetchTier, fetchCurrentWeek]`.
   Without the guard, a no-`?tier=` mount writes the param, flips `urlTierId` `null → id`, and
   re-runs the whole chain once (`fetchTiers` ×2) before converging — the guard removes that
   second run AND a redundant `replace` history write.

Tier switching stays correct on both paths: the breadcrumb's `onTierChange` calls `fetchTier`
itself (`pages/groupActionsContext.tsx:129-145`) and its `?tier=` write re-runs the effect —
that path intentionally still yields `fetchTier` twice (its own call + the effect's idempotent
re-run; stated, not hidden — collapsing it is out of scope). Browser back/forward changes
`urlTierId` → the effect re-runs and loads that tier.

**Steps:**

- [ ] **Step 1:** Write the failing cadence tests (mock the three store fetchers as spies;
  render `NewShell` inside a `MemoryRouter` — follow `NewShell.banners.test.tsx`'s existing
  harness for providers/fixtures). **Two mount baselines, asserted EXACTLY** (F-5): a mount
  WITH `?tier=` in the initial URL settles at `fetchTiers` ×1; a mount WITHOUT it settles at
  `fetchTiers` ×1 **only because of the mirror guard** (pre-fix it is ×2 — assert the exact
  count, never `>=`):
  - **the storm (RED today):** after either mount settles, push an unrelated param (`?week=3`)
    via the router → `fetchTiers`/`fetchTier` call counts DO NOT increase.
  - **back/forward:** change `?tier=` to another tier in the URL → `fetchTier` called with the
    new tierId.
  - **mirror preserved:** on mount with no `?tier=`, the URL gains `tier=<selected>` (replace),
    exactly once.
- [ ] **Step 2:** Run — the storm test FAILS on current code (counts increase). Paste output.
- [ ] **Step 3:** Implement the three-leg fix. Keep the selection-precedence block verbatim
  (URL > localStorage > isActive > first).
- [ ] **Step 4:** Run the new file + the full NewShell suite — green. `pnpm build` green.
- [ ] **Step 5: Deletion-trace (execute, paste):** re-add `searchParams` to the dep array → the
  storm test FAILS again; restore.
- [ ] **Step 6: Commit** — `fix(v2): tier-selection effect keyed on stable tier identity — no refetch on unrelated URL writes (D5 carry-forward)`

---

### Task 6: Release note, design-record build note, full gate run

**Files:**
- Modify: `frontend/src/data/releaseNotes.ts` (internal entry, `CURRENT_VERSION` untouched)
- Modify: `design/redesign/specs/phase-d-loot-design.md` (R-17 build note)

**NOT in this task (director F-3):** the `phase-d-loot-plan.md` §5 discharge rows — they claim
a live demonstration and land ONLY after it exists (Task 7).

**Steps:**

- [ ] **Step 1:** Release note: `internal: true`, `prTitle` for this slice, no version bump
  (§2.5 — v2 is admin-gated dark). Follow the pr-checklist skill's current rules at PR time.
- [ ] **Step 2:** `phase-d-loot-design.md` — a dated **Build note (D5)** under R-17 recording
  the user rulings and interims, write-back policy §4: **R-D5a** (grid cell door reaches subs
  via the pinned branch's optional `allowSubs`; matrix/queues doors keep R-a's inheritance);
  **R-D5b** (header matches FloorCard's treatment — no tint band); **R-D5c** (suggestion =
  clock-week priority, write = displayed week); filled-cell click edits the **newest** entry
  until D6's `×N` popover disambiguates — the `×N` chip is a count with no route to the
  counted items until then, a known interim (F-14i); material cells bucket symmetrically to
  loot (the legacy grid's single-`find` under-reported multi-material weeks); material column
  labels use the short forms incl. 'Tome' (mockup + legacy column precedent, F-14ii); the
  floor-name fallback matches what v2 writes, not a legacy-lookup parity claim (F-8).
- [ ] **Step 3:** The `pnpm deadcode` baseline from `main` is already captured (session
  scratchpad, `deadcode-baseline-main-6b41c1aa.txt`); run the full gate on the branch:
  `pnpm build && pnpm lint && pnpm check:design-system:strict && pnpm dupes &&
  pnpm tokens:check && pnpm deadcode && pnpm test`. Attach before/after deadcode reports;
  `dupes` must be green with the grid in place (§2.2 — if jscpd flags the grid against
  `WeeklyLootGrid.tsx`, restructure the flagged block, do not waive).
- [ ] **Step 4:** Grep asserts (paste outputs): `rg "FLOOR_COLORS" frontend/src/components/loot/LogWeekGrid.tsx
  frontend/src/components/loot/logWeekGridData.ts` → no matches; `rg "text-\[1?[0-9]px\]"` over
  the new files → no matches; `rg "group" LogWeekGrid.tsx` → no user-facing "group" copy.
- [ ] **Step 5: Commit** — `docs(redesign): D5 release note + R-17 build note`

---

### Task 7: §5 discharge write-backs — ONLY after the live browser demo (director F-3)

**Files:**
- Modify: `design/redesign/specs/phase-d-loot-plan.md` §5

**Precondition (hard):** DoD 2's browser demonstration has RUN and its evidence (screenshot
sequence + observed PUT + gear reconciliation) is pasted into the SDD ledger. This task's
commit message links that ledger entry. A status row claiming a demo that has not happened is
the exact failure this build line exists to prevent.

**Steps:**

- [ ] **Step 1:** Edit the two §5 rows in place, dated: the **R-21 browser-demonstration row**
  gains "✅ Discharged in D5 — demonstrated live (grid material cell → edit door → old-vs-new
  reconciliation → PUT + gear reconcile), evidence in the D5 PR screenshots + SDD ledger"; the
  **mount-obligations row** gains "✅ (a)/(b)/(d) shipped in D5: (a) full-roster edit mount in
  `Loot.tsx`, (b) once-per-open rehydration + identity-churn regression test, (d) lazy edit
  initializers — D11 inherits a satisfied contract". Add one new §5 row ONLY if a real new
  deferral emerged during the build (e.g. the design-system-ignore fallback was taken, or the
  NeedMatrix `<th>` icon check found a real defect deferred to a follow-up).
- [ ] **Step 2: Commit** — `docs(redesign): discharge §5 R-21 rows with demo evidence (D5)`

---

## Definition of done (slice level)

1. Every Task-1…6 suite green; full local gate green (`build` = `tsc -b`, `lint`,
   `check:design-system:strict`, `dupes`, `tokens:check`, `deadcode` vs baseline, `test`).
2. **Named DoD item (inherited from D8): R-21's edit door demonstrated live in the running
   app** — in the browser, on the v2 Log grid: click a filled material cell → the modal opens
   in edit mode seeded from the entry → change recipient AND material → the reconciliation
   preview lines update truthfully → submit → the PUT lands, the grid re-renders, gear state
   reconciles (old recipient reverted / new applied). Screenshot sequence embedded in the PR.
   A second pass covers the §5-owed manual case: switch recipient between two players who BOTH
   have eligible slots (the Radix Select race watch — `phase-d-loot-plan.md` §5, F-3).
3. Live browser validation, both shells, desktop (mobile → Phase P): v2 — grid renders all four
   floors with R-D5b headers; the `<th>` `GearSlotIcon`s render at size (the F-4 wrapper works —
   and while there, the 30-second check of `NeedMatrix.tsx:198-199`'s row-header icons, which
   the director's static analysis predicts may be broken by the same index.css rule: if
   confirmed, record as a named follow-up or one-line rider, ruled at the review gate); empty
   gear cell → assign door prefilled floor+slot, targeting the **displayed** week (validate on
   a non-current week); filled gear cell → picker edit; empty material cell → pinned door with
   suggestion AND the "Include substitutes" checkbox (R-D5a — check it, log for a sub,
   round-trip); ring cell round-trip; `lview` switches and week chevrons no longer refetch
   tiers (Task 5 — verify in the network panel). V1 legacy shell — Loot tab renders unchanged;
   the priority-panel material modal (pinned door) opens with NO subs checkbox and logs exactly
   as before.
4. **V1 safety, two-part:** (a) `git diff --stat` over legacy-only paths empty; (b) every
   `QuickLogMaterialModal.tsx` hunk enumerated in the PR body with its V1 render path
   (`LootPriorityPanel.tsx:765-784`), director SHARED-DRIFT sign-off; D8 characterization suite
   unedited + snapshot file byte-unchanged in the final diff.
5. Screenshots embedded in the PR (dark primary; light spot-check of the grid — floor tints and
   material tokens are theme-split).
6. `pnpm dupes` green with §2.2 understood, not waived; no `FLOOR_COLORS` / sub-12px text in
   new v2 files (grep asserts pasted).
7. Release note internal; the R-17 build note landed (Task 6); the §5 discharge rows landed
   AFTER the demo, citing its evidence (Task 7 — ordering is itself a DoD requirement); this
   plan + PR body record the Button-vs-ignore cell-control decision wherever the fallback was
   taken, and the three user rulings R-D5a/b/c.

## Out of scope (named so the ledger cannot drift)

D6's affordance layer (modifiers, kebabs, popover click, tooltips, count bar + legend,
"Log floor" kebab, hover-`×`, Alt cursor), D7 (Books card, bulk resets, displayed-week reset
menu), Log `?entry=` highlight (D6/D11), R-28 jumps (D12), keyboard shortcuts (D14), the
index.css aria-hidden rule narrowing (queued follow-up), the feedback-polish follow-up queue,
PR #203 revival, mobile (Phase P).
