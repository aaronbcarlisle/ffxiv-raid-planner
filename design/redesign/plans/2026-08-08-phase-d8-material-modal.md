# Phase D — Slice D8: The Material Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Vet record:** `xivrp-director` plan-vet 2026-08-08 → **APPROVE-WITH-CHANGES** (4 blockers ·
5 majors · 11 minors) — **all folded into this revision.** Two decision points were ruled by the
user 2026-08-08 during the vet fold: **(R-a) subs widening restored** — non-pinned modes gain an
"Include substitutes" checkbox with full-roster reach (D-37's ruled text; the V1-rendered pinned
door keeps its current filter), and **(R-b) "Log a drop" + "Log material" live on all three Loot
views** (the D4 precedent; the two actions never diverge). Both are recorded in the PR body and
written back to the design record in Task 7.

**Goal:** Grow `QuickLogMaterialModal` into v2's one owned material component — floor + material
selectors (free-form entry, R-26), a notes field (R-26), subs widening (D-37/R-a), and edit mode
with old-vs-new augmentation reconciliation (R-21) — and land D4's carried **"Log material"**
toolbar action (R-20 build note), targeting the displayed week.

**Architecture:** The modal's props become a three-branch discriminated union — `pinned` (today's
exact contract; V1's door and v2's matrix-cell door), `freeform` (selectors render; D8's toolbar
door), and `edit` (an existing `MaterialLogEntry`; R-21). V1's call site
(`LootPriorityPanel.tsx:770`) type-checks against the `pinned` branch **unchanged** and renders
**byte-identically** — a branch-complete characterization suite written against the pre-D8
component guards that, and its committed snapshot file must be **byte-unchanged in the final
diff** (DoD 1). The internal refactor (props→locals + consolidating the triplicated slot-init
logic) is *allowed* but lands as its **own pure-refactor task (3A)** so its hunk is reviewable in
isolation. Edit-mode gear reconciliation lives in a new additive export
`updateMaterialAndReconcileGear` in `utils/materialCoordination.ts`. Edit mode ships as **tested
capability without a live consumer** (D5/D11 are its ruled consumers) — Task 7 writes that debt
into `phase-d-loot-plan.md` §5 as a named carry-forward, not just the PR body.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, Zustand stores, Tailwind 4 +
design-system primitives (`Tag`, `TextArea`, `NumberInput`, `Select`, `RadioGroup`, `Checkbox`,
`Modal`, `Button`).

## Global Constraints

- **D8 is the phase's highest freeze risk** (`phase-d-loot-plan.md` §6): `QuickLogMaterialModal`
  is V1-live via `LootPriorityPanel.tsx:28,770` ← `GroupViewContent.tsx:38,1017`. Every new input
  **optional and off by default**; V1's fixed-`floor`/`material` call site renders byte-identically.
  Two-part assert mandatory: (a) `git diff --stat` over legacy-only paths empty; (b) every hunk in
  a shared file enumerated in the PR body with its V1 render path, carrying director SHARED-DRIFT
  sign-off — **plus** (director B4) the committed characterization snapshot file byte-unchanged in
  the final diff, and a **V1 legacy-shell browser validation** of the modal (light+dark
  screenshots beside the v2 ones).
- **Never edit:** anything under `components/history/` (`LogMaterialModal.tsx` is *reference
  only*), `LootPriorityPanel.tsx`, `WhoNeedsItMatrix.tsx`, `loot/FilterBar.tsx`,
  `utils/priorityEntries.ts`, `utils/lootRecommendationService.ts`, `loot/index.ts` exports,
  `stores/lootTrackingStore.ts` (M5's week-data refresh lives in the new coordinator, not the store).
- **Shared-file honesty (director M3):** `ui/Tag.tsx`, `types/index.ts`,
  `utils/materialCoordination.ts` are touched **additively only** (verified: `Tag.tsx:19` is the
  tree's only exhaustive `Tone` map; `MaterialLogEntryUpdate` is forwarded, never narrowed).
  `loot/QuickLogMaterialModal.tsx` is **not** additive — it is **grown by ruled rewrite (R-26)
  with a frozen pinned branch**, and the evidence for the freeze is the snapshot identity + the
  branch-complete baseline, not the word "additive."
- **Re-express, don't transcribe** (§2.2): `pnpm dupes` (jscpd `threshold: 5`, `minLines: 5`,
  `minTokens: 50`; `**/*.test.tsx` ignored) is blocking CI. Legacy's `LogMaterialModal` proves the
  mechanics; v2 re-derives them (floor *numbers* not names, `Tag` pills not raw buttons, a
  coordination function not 90 inline lines).
- **No `FLOOR_COLORS`** in any hunk this slice adds (DoD 5). Floor color = `Tag tone="floor-N"` /
  `FLOOR_TEXT_CLASS`. Material color = the semantic `material-*` tokens — **not** `MATERIAL_INFO`'s
  `text-blue-400`-era strings.
- **Design system:** no raw HTML controls; 12px text floor; `static` not "group" in user-facing copy.
- **Keyboard shortcuts are OUT** (verified: Alt+U/Alt+L legacy-gated at
  `useGroupViewKeyboardShortcuts.ts:139-199`; R-42's set is D14). D8 ships toolbar buttons only.
- **Wire contracts (backend-verified, `loot_tracking.py:1496-1514` + `schemas/loot_tracking.py:193-194`):**
  `notes: ""` clears (won't 422); `null`/absent no-ops. `slot_augmented`: only `""` clears; `null`
  silently ignored — legacy's edit path sends `null` (`LogMaterialModal.tsx:322-324,341`), a live
  V1 no-op bug we do **not** replicate. v2 sends `''` sentinels. No backend edits; the
  `notes: null` contract is a named follow-up Task 7 writes into `phase-d-loot-plan.md` §5.
- **Refactor guard-rails (director M2), binding on Tasks 3A/3B/6:** base props stay **destructured
  with their existing defaults** (`settings = DEFAULT_SETTINGS` at `QuickLogMaterialModal.tsx:51`
  feeds `sortedRecipients` → priority calls at `:238`); only the union-discriminated props are read
  off `props`. `initialGearSelection`'s callers preserve today's lookup asymmetry: the mount init
  (`:62`) and reset effect (`:128`) keep the `allPlayers.find(...) || suggestedPlayer` fallback;
  `handleRecipientChange` (`:160`) deliberately has none. The reset effect keeps **exactly** its
  pinned-mode dependency array `[isOpen, suggestedPlayer, maxWeek, material, allPlayers]` — adding
  or removing a dep changes live V1 re-run cadence.
- Gates before PR: `pnpm build` (**`tsc -b`**), `lint`, `check:design-system:strict`, `dupes`,
  `tokens:check`, `deadcode` (vs captured baseline), `test`. Browser validation **both shells**.
  Release note `internal: true`, no `CURRENT_VERSION` bump. No AI attribution. Merge awaits the user.
- Branch: `phase-d/d8-material-modal` off `main`. SDD ledger:
  `.superpowers/sdd/2026-08-08-phase-d8-material-modal/progress.md`.

---

## File structure

| File | Status | Responsibility in this slice |
|---|---|---|
| `frontend/src/components/loot/QuickLogMaterialModal.tsx` | **grow — ruled rewrite, frozen pinned branch** | 3A refactor; 3B union+selectors+widening; 4 notes; 6 edit mode |
| `frontend/src/components/loot/QuickLogMaterialModal.test.tsx` | **new** | Branch-complete V1 baseline (Task 1) + all new-mode tests |
| `frontend/src/components/loot/QuickLogMaterialModal.type-test.tsx` | **new** | Compile-time union assertions (Button/Tag/RecipientPicker precedent) |
| `frontend/src/components/ui/Tag.tsx` | grow (shared, **additive**) | Four `material-*` tones (D0 floor-tone precedent) |
| `frontend/src/components/ui/Tag.test.tsx` | extend | One render assert per new tone |
| `frontend/src/utils/materialCoordination.ts` | grow (shared, **additive export**) | `updateMaterialAndReconcileGear` + exported `UpdateMaterialOptions` |
| `frontend/src/utils/materialCoordination.test.ts` | extend | Reconciliation matrix (stateful store mocks) |
| `frontend/src/types/index.ts` | grow (shared, **additive**) | `MaterialLogEntryUpdate.slotAugmented` gains `''` + wire comment |
| `frontend/src/components/loot/LootToolbar.tsx` | grow (v2-only) | `onLogMaterial` prop + "Log material" button |
| `frontend/src/components/loot/Loot.tsx` | grow (v2-only) | `MaterialState` union, toolbar wiring, mounts (incl. cell-door `initialWeek`) |
| `frontend/src/components/loot/Loot.test.tsx` | extend | Prop-capturing modal mock; toolbar/week-targeting tests |
| `frontend/src/data/releaseNotes.ts` | extend | Internal entry |
| `design/redesign/specs/phase-d-loot-plan.md` | extend (§5) | Task 7 carry-forwards: R-21 demo debt → D5/D11; `notes: null` follow-up; DoD-2 enumeration test → D14 |
| `design/redesign/specs/phase-d-loot-design.md` | extend (R-26 build note) | Record rulings R-a (subs widening) + R-b (button home) |

**Not touched:** `LootPriorityPanel.tsx`, `components/history/**`, `loot/index.ts` (the modal is
not in the barrel — both consumers sibling-import it — and stays out), `stores/**`, backend.

---

### Task 1: Branch + branch-complete V1 characterization baseline (director B2/B4)

**Files:**
- Create: `frontend/src/components/loot/QuickLogMaterialModal.test.tsx`

**Interfaces:**
- Consumes: today's props (`QuickLogMaterialModal.tsx:27-39`).
- Produces: the freeze suite every later task keeps green **unedited**, its committed snapshot
  file (byte-unchanged through the whole slice = DoD 1's first clause), and fixture helpers
  `makeGear`/`makePlayer` (modeled on `materialCoordination.test.ts:19-64`) reused by all later
  describe blocks.

- [ ] **Step 1: Branch** — `git checkout main; git pull; git checkout -b phase-d/d8-material-modal`
- [ ] **Step 2: Write the characterization suite.** Header comment: *"The `V1 freeze baseline`
  describe block was written against the pre-D8 component and MUST NOT be edited in this slice —
  it is the two-part assert's teeth. If a D8 task needs to change one of these tests, the task is
  wrong."* Partial-mock `logMaterialAndUpdateGear` (keep the pure helpers real); copy
  `Loot.test.tsx`'s matchMedia stub.

  **One fixture per pinned render branch** (each with render asserts + a `baseElement` snapshot):

  1. **Twine, slots eligible** (`p1` head tome/hasItem/unaugmented): title `Log Twine`; static
     `Floor:`/`Material:` rows (no `role="group"` selectors); week `NumberInput` = `maxWeek`;
     "Also mark gear as augmented…" checkbox + slot `Select`; no textarea; no `Select player…`.
  2. **Universal Tomestone, tome weapon needed** (`tomeWeapon.pursuing` w/o item): the
     `canMarkTomeWeaponHave` checkbox path (`QuickLogMaterialModal.tsx:342-348`).
  3. **Solvent, tome + slots** (weapon slot tome/hasItem/unaugmented AND
     `needsTomeWeaponAugmentation` true): the dual `Select` with `Tome Weapon` option
     (`:351-380`) — the branch whose init ordering (`slots[0]` before the tome check) is the one
     asymmetric case in Task 3A's consolidation (`:73-79` tests `slots.length === 0 && needs…`).
  4. **Solvent, tome-only** (no eligible slots): the bare `Tome Weapon` text (`:381-383`).
  5. **No eligible options** (all-raid player): the entire gear block absent (`:339`).

  **Interaction characterizations** (twine fixture):

  - **Recipient change** (the third slot-init copy, `:156-187`): switch recipient to a player
    whose eligible slots differ → slot `Select` re-inits to *their* first slot; submit payload
    carries the new `recipientPlayerId` + `slotToAugment`.
  - **Submit, gear on**: exact args — `['g1','t1']`,
    `objectContaining({ weekNumber: 3, floor: 'M11S', materialType: 'twine', recipientPlayerId,
    method: 'drop' })`, **`not.toHaveProperty('notes')`**, options
    `objectContaining({ updateGear: true, slotToAugment: 'head' })`.
  - **Submit, `updateGear` unchecked**: options `updateGear: false`, `slotToAugment: undefined`.

- [ ] **Step 3: Run** — `pnpm --dir frontend test QuickLogMaterialModal` → all PASS (green against
  the unchanged component = honest baseline). Run **twice**; if any snapshot differs between runs,
  drop only the snapshots, keep the enumerated asserts, record the substitution in the SDD ledger —
  **and the PR-body hunk enumeration for the modal then becomes mandatory-per-hunk (B4 fallback).**
- [ ] **Step 4: Commit** — `test(loot): branch-complete characterization of QuickLogMaterialModal's V1 contract`

---

### Task 2: Tag material tones (shared, additive)

**Files:** `frontend/src/components/ui/Tag.tsx` (`Tone` at `:15-17`, map at `:24-31`) · `Tag.test.tsx`

**Interfaces:** `Tone` gains `'material-twine' | 'material-glaze' | 'material-solvent' |
'material-tomestone'`; Task 3B consumes via `MATERIAL_TONE`.

- [ ] **Step 1: Failing test** —

```tsx
it.each([
  ['material-twine', 'text-material-twine'],
  ['material-glaze', 'text-material-glaze'],
  ['material-solvent', 'text-material-solvent'],
  ['material-tomestone', 'text-material-tomestone'],
] as const)('renders the %s tone with its material token', (tone, cls) => {
  render(<Tag variant="label" tone={tone}>x</Tag>);
  expect(screen.getByText('x').className).toContain(cls);
});
```

- [ ] **Step 2: Run → FAIL** (type error).
- [ ] **Step 3: Implement** — under the floor-tone block, copying its comment discipline:

```ts
// Phase-D R-26 material tones (semantic material tokens). Additive: only v2
// loot surfaces pass these — no legacy call site does, so V1 renders unchanged.
'material-twine': 'bg-material-twine/10 text-material-twine border-material-twine/30',
'material-glaze': 'bg-material-glaze/10 text-material-glaze border-material-glaze/30',
'material-solvent': 'bg-material-solvent/10 text-material-solvent border-material-solvent/30',
'material-tomestone': 'bg-material-tomestone/10 text-material-tomestone border-material-tomestone/30',
```

  (Tokens verified present in the generated `@theme` block — `tokens.generated.css:90-93,184-187` —
  so the `/10` utilities generate. Note for screenshots: `Tag.tsx:68` drops `tone` when unpressed,
  so material color shows on the **selected** pill only — intended.)
- [ ] **Step 4: Run tests + `pnpm --dir frontend build`.**
- [ ] **Step 5: Commit** — `feat(ui): Tag material tones for the D8 material modal (additive)`

---

### Task 3A: Pure refactor — slot-init consolidation + locals (director M1; zero new props)

**Files:**
- Modify: `frontend/src/components/loot/QuickLogMaterialModal.tsx`

**Interfaces:**
- Produces: file-local `initialGearSelection(player, material)` (Task 6 adds a caller);
  locals `material`/`floorName` (trivially `props.material`/`props.floor` in this task) that 3B
  reroutes. **No props change, no render change, no new tests** — Task 1's suite green on both
  sides of the commit is the whole point.

- [ ] **Step 1: Extract the helper** (the triplicated logic at `:61-71`, `:130-151`, `:159-186`):

```ts
/** One place that answers: given this player and material, what does the gear
 *  checkbox pre-select? (Was triplicated pre-D8; edit mode would have made four.) */
function initialGearSelection(
  player: SnapshotPlayer | undefined,
  material: MaterialType,
): { slot: GearSlot | null; augmentTome: boolean } {
  if (!player || material === 'universal_tomestone') return { slot: null, augmentTome: false };
  const slots = getEligibleSlotsForAugmentation(player, material);
  if (slots.length > 0) return { slot: slots[0], augmentTome: false };
  if (material === 'solvent' && needsTomeWeaponAugmentation(player)) return { slot: null, augmentTome: true };
  return { slot: null, augmentTome: false };
}
```

  ⚠ Ordering note (baseline fixture 3 guards it): the lazy init at `:73-79` reads
  `slots.length === 0 && needsTomeWeaponAugmentation(player)` — the helper's
  `slots.length > 0` early-return is the same decision inverted. Callers per the M2 guard-rails:
  mount init + reset effect keep `|| suggestedPlayer`; `handleRecipientChange` passes its bare
  `find` result. Reset-effect dep array **unchanged**.
- [ ] **Step 2: Introduce the locals** — `const material = props.material; const floorName =
  props.floor;` (destructuring adjusted so `floor`/`material` are no longer destructured) and
  substitute through `eligibleOptions`, `sortedRecipients`, `handleSubmit`, JSX. All other props
  stay destructured with existing defaults.
- [ ] **Step 3: Run** — full modal suite green, **snapshots identical** (`git status` shows no
  `.snap` change); `pnpm --dir frontend build && pnpm --dir frontend dupes`.
- [ ] **Step 4: Commit** — `refactor(loot): consolidate QuickLogMaterialModal slot-init (behavior-frozen, pre-union)`
  — this commit's `git show` is the §2.1 evidence that the refactor is behavior-preserving.

---

### Task 3B: Free-form mode — union, selectors, auto-recipient, subs widening (R-a)

**Files:**
- Modify: `frontend/src/components/loot/QuickLogMaterialModal.tsx`
- Create: `frontend/src/components/loot/QuickLogMaterialModal.type-test.tsx`
- Test: extend `QuickLogMaterialModal.test.tsx`

**Interfaces:**
- Consumes: Task 2's tones, 3A's helper/locals, `FLOOR_LOOT_TABLES`/`parseFloorName`/
  `UPGRADE_MATERIAL_DISPLAY_NAMES`/`getFloorForUpgradeMaterial` (gamedata), `Tag`, `Checkbox`.
- Produces: the union below (Task 6 appends `edit`; Task 7 mounts `freeform` and passes the
  pinned door's new `initialWeek`).

**The props union (exact — director M4 folded: `initialWeek` allowed on pinned):**

```ts
interface QuickLogMaterialModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  tierId: string;
  /** Upper bound for the week input. */
  maxWeek: number;
  allPlayers: SnapshotPlayer[];
  settings?: StaticSettings;
  onSuccess?: () => void;
}

type QuickLogMaterialModalProps = QuickLogMaterialModalBaseProps & (
  | {
      /** Pinned — V1's exact contract (LootPriorityPanel.tsx:770) and v2's matrix-cell door. */
      floor: string;
      material: MaterialType;
      suggestedPlayer: SnapshotPlayer;
      /** D8, v2-only: show the notes field. V1 never passes it → render unchanged. */
      showNotes?: boolean;
      /** D8, v2-only: initial week (R-20 coherence; D5's Log cells need it on this door).
       *  Absent → maxWeek, exactly the pre-D8 default — V1 never passes it. */
      initialWeek?: number;
      floors?: never; editEntry?: never;
    }
  | {
      /** Free-form — R-26/R-20: floor + material selectors; the Log toolbar's door. */
      floors: string[];
      /** R-20: the write targets the displayed week (Loot's `writeWeek`). Required — explicit. */
      initialWeek: number;
      floor?: never; material?: never; suggestedPlayer?: never; showNotes?: never; editEntry?: never;
    }
  // Task 6 appends the `edit` branch (no initialWeek — the week comes from the entry).
);
```

**Internal derivations (exact):**

```ts
type ModalMode = 'pinned' | 'freeform';           // Task 6 widens with 'edit'
const mode: ModalMode = props.floor != null ? 'pinned' : 'freeform';

const MATERIAL_FLOORS = ([1, 2, 3, 4] as FloorNumber[])
  .filter((n) => FLOOR_LOOT_TABLES[n].upgradeMaterials.length > 0);   // [2, 3] today

function materialsForFloorNumber(n: FloorNumber): MaterialType[] {
  return FLOOR_LOOT_TABLES[n].upgradeMaterials as MaterialType[];
}

const MATERIAL_TONE = {
  twine: 'material-twine', glaze: 'material-glaze',
  solvent: 'material-solvent', universal_tomestone: 'material-tomestone',
} as const satisfies Record<MaterialType, Tone>;
```

State: `pickedFloorNumber`/`pickedMaterial` (freeform init: `MATERIAL_FLOORS[0] ?? 2` + its first
material); 3A's locals become
`const material = mode === 'pinned' ? props.material : pickedMaterial;` and
`const floorName = mode === 'pinned' ? props.floor : (props.floors[pickedFloorNumber - 1] ?? \`Floor ${pickedFloorNumber}\`);`
Week: `useState(props.initialWeek ?? maxWeek)` (pinned without the prop = `maxWeek`, byte-identical).
The reset-on-open effect is **mode-gated**: the pinned block keeps today's body and dep array
verbatim; a separate freeform block resets pickedFloor/material/week/notes/`userPickedRecipient`.

**Subs widening (R-a, D-37):** state `const [includeSubs, setIncludeSubs] = useState(false)`
(reset on open). The recipient pool: pinned keeps today's filter **verbatim**
(`configured && !isSubstitute`, `:226-230` — V1's render); non-pinned modes use
`configured && (includeSubs || !p.isSubstitute)`. The checkbox renders beside the Recipient label
in non-pinned modes only (legacy affordance: `LogMaterialModal.tsx:673`; re-expressed, not copied):

```tsx
{mode !== 'pinned' && (
  <Checkbox checked={includeSubs} onChange={setIncludeSubs} label="Include substitutes" className="text-xs" />
)}
```

Auto-recipient (freeform only; never clobbers a user pick):

```ts
const userPickedRecipient = useRef(false);   // reset on open; set true in handleRecipientChange
useEffect(() => {
  if (mode !== 'freeform' || !isOpen || userPickedRecipient.current) return;
  setRecipientPlayerId(sortedRecipients[0]?.player.id ?? '');
}, [mode, isOpen, sortedRecipients]);
```

**Any material change** (from `pickMaterial` or `pickFloor`'s cascade when the old material isn't
in the new floor's table) resets `userPickedRecipient.current = false` (stale ranking) and
re-derives gear selection via `initialGearSelection`; a floor change that keeps the material
resets neither.

**Free-form JSX** (replaces the pinned info box in freeform only; **group labeling per D1's
shipped pattern** — inline span inside the group, `aria-label` carries the name; no `<Label>`
double-labeling — director m3):

```tsx
<div role="group" aria-label="Floor" className="flex flex-wrap items-center gap-1.5">
  <span className="text-xs uppercase tracking-wide text-text-tertiary">Floor</span>
  {MATERIAL_FLOORS.map((n) => (
    <Tag key={n} variant="filter" tone={`floor-${n}` as Tone}
         pressed={pickedFloorNumber === n} onClick={() => pickFloor(n)}>
      {props.floors[n - 1] ?? `Floor ${n}`}
    </Tag>
  ))}
</div>
<div role="group" aria-label="Material" className="flex flex-wrap items-center gap-1.5">
  <span className="text-xs uppercase tracking-wide text-text-tertiary">Material</span>
  {materialsForFloorNumber(pickedFloorNumber).map((m) => (
    <Tag key={m} variant="filter" tone={MATERIAL_TONE[m]}
         pressed={pickedMaterial === m} onClick={() => pickMaterial(m)}>
      {UPGRADE_MATERIAL_DISPLAY_NAMES[m]}
    </Tag>
  ))}
</div>
<div className="flex items-center justify-between text-sm">
  <Label htmlFor="material-week" className="mb-0">Week</Label>
  {/* `v ?? selectedWeek`: the row is shared with edit mode (no initialWeek there). */}
  <NumberInput value={selectedWeek} onChange={(v) => setSelectedWeek(v ?? selectedWeek)}
               min={1} max={maxWeek} size="sm" />
</div>
```

Title in free-form: **`Log Material`** (director m5 — pinned's `Log {name}` presumes a chosen
material; legacy's copy, `LogMaterialModal.tsx:602`). Recipient `Select` gains a leading
`{ value: '', label: 'Select player…' }` only when non-pinned and `recipientPlayerId === ''`;
submit already disables on `!recipientPlayerId`.

**Type-test** (follow `Tag.type-test.tsx` conventions):

```tsx
// V1's call-site shape (LootPriorityPanel.tsx:770) must stay assignable, verbatim:
({ ...base, floor: 'M11S', material: 'twine', suggestedPlayer: player }) satisfies Props;
// Pinned may now name its week (D5's Log-cell door):
({ ...base, floor: 'M11S', material: 'twine', suggestedPlayer: player, initialWeek: 2 }) satisfies Props;
({ ...base, floors: ['a', 'b', 'c', 'd'], initialWeek: 2 }) satisfies Props;
// @ts-expect-error — floor without material is not a mode
({ ...base, floor: 'M11S', suggestedPlayer: player }) satisfies Props;
// @ts-expect-error — free-form must name its week (R-20: displayed week, explicit)
({ ...base, floors: ['a'] }) satisfies Props;
```

- [ ] **Step 1 (director m6): land the union as a type-only commit** — props union + `mode`
  derivation + type-test file; freeform renders nothing new yet (mode gates in place, pinned
  path byte-identical). Run: build + full modal suite green, snapshots unchanged. Commit —
  `feat(loot): QuickLogMaterialModal props become a pinned/freeform union (type-only)`.
- [ ] **Step 2: Write the failing behavior tests** — describe `'free-form mode (R-26)'`:
  floor pills = the two material floors labeled from `floors`; material pills follow the picked
  floor (F2 → Glaze + Universal Tomestone; pick F3 → Twine + Solvent, first auto-picked);
  auto-recipient = top-priority needer, re-ranks on material change, does NOT clobber a manual
  pick on a floor-only change (assert both directions); week shows `initialWeek`; **subs
  widening** — an `Include substitutes` checkbox appears, off by default subs absent from the
  `Select`, checked → a needing sub appears and can receive the submit payload; submit sends
  `floor: floors[n-1]`, picked material, picked week. Run → **FAIL** honestly (behavior missing,
  types compile).
- [ ] **Step 3: Implement** per the shapes above.
- [ ] **Step 4: Run** — full suite green (baseline untouched, snapshots unchanged); build; dupes.
- [ ] **Step 5: Commit** — `feat(loot): free-form material logging — selectors, auto-recipient, subs widening (R-26, D-37)`

---

### Task 4: The notes field

**Files:** `QuickLogMaterialModal.tsx` · extend `QuickLogMaterialModal.test.tsx`

**Interfaces:** consumes `TextArea` (`value`/`onChange(string)`, barrel `ui/index.ts:60`);
produces `notes` state (Task 6 submit) + the `showNotes` pinned prop (Task 7 cell door).

- [ ] **Step 1: Failing tests** — pinned default: no textarea (baseline already pins it; add the
  positive `showNotes` case); pinned+`showNotes`: textarea present; freeform: always present;
  typed note reaches the create payload **trimmed**; whitespace-only → the `notes` key **absent**
  (create has no clearing semantics).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — `const [notes, setNotes] = useState('')` (reset on open); render
  gated `mode !== 'pinned' || props.showNotes`:

```tsx
<div>
  <Label htmlFor="material-notes">Notes (optional)</Label>
  <TextArea id="material-notes" value={notes} onChange={setNotes} rows={2} placeholder="Add a note…" />
</div>
```

  Submit adds `...(notes.trim() ? { notes: notes.trim() } : {})` to the create data — key absent
  otherwise, keeping the baseline's `not.toHaveProperty('notes')` true.
- [ ] **Step 4: Run → PASS.** **Step 5: Commit** — `feat(loot): notes on the material modal, v2 modes only (R-26)`

---

### Task 5: `updateMaterialAndReconcileGear` + the `''` wire sentinel

**Files:** `utils/materialCoordination.ts` (additive export) · `types/index.ts:1327-1335` ·
extend `utils/materialCoordination.test.ts`

**Interfaces:**
- Consumes: `useLootTrackingStore.getState().updateMaterialEntry` (PUT, `lootTrackingStore.ts:407`)
  **and the same week-data refresh the create/delete store paths run** (`:383`/`:399` — director
  M5: an edit can move an entry across weeks; `WeekScopeControl`'s dots must not go stale; copy
  the exact store call those lines use, from the coordinator, **not** by editing the store);
  `useTierStore.getState().updatePlayer/fetchTier`; the eligibility helpers.
- Produces (Task 6 calls this exact signature; the modal **imports `UpdateMaterialOptions`** to
  type its options object — that makes the export knip-visible, director m9):

```ts
export interface UpdateMaterialOptions {
  updateGear?: boolean;
  slotToAugment?: GearSlot;
  augmentTomeWeapon?: boolean;
}

export async function updateMaterialAndReconcileGear(
  groupId: string,
  tierId: string,
  oldEntry: MaterialLogEntry,
  newData: {
    weekNumber: number;
    floor: string;
    materialType: MaterialType;
    recipientPlayerId: string;
    method: LootMethod;
    /** Already trimmed. '' clears — backend applies any non-None string (loot_tracking.py:1513-1514). */
    notes: string;
  },
  options: UpdateMaterialOptions = {},
): Promise<void>
```

**Types widening (exact hunk):**

```ts
  /**
   * Wire contract (backend loot_tracking.py:1496-1514): the PUT clears
   * slot_augmented only on the literal '' — null is silently ignored, and
   * notes clear on '' the same way. v2's edit path sends '' sentinels.
   */
  slotAugmented?: GearSlot | 'tome_weapon' | '' | null;
```

**Reconciliation semantics (R-21's old-vs-new table — each row is a test):**
`GearEffect = { kind: 'tome_item' } | { kind: 'tome_aug' } | { kind: 'slot'; slot: GearSlot } | null`.
Old effect from `oldEntry` (UT → `tome_item`; `slotAugmented === 'tome_weapon'` → `tome_aug`;
a slot → that slot; else null). New effect from `newData.materialType` + `options` (the
`logMaterialAndUpdateGear:194-202` mapping, plus UT+updateGear → `tome_item`).

1. **PUT first** (data-integrity precedent `materialCoordination.ts:179-182`), payload
   `{...newData, slotAugmented: slot | 'tome_weapon' | ''}` — `''` clears, never `null`. Then the
   week-data refresh (M5).
2. Same recipient, effect unchanged → **zero** gear calls (week/notes-only edits are silent).
3. Same recipient, effect changed → revert old (guards on current state: slot → `isAugmented:
   false`; `tome_aug` → `tomeWeapon.isAugmented: false`; `tome_item` → `hasItem: false` **only**,
   NOT `isAugmented` — the legacy *edit* precedent `LogMaterialModal.tsx:356-363`, deliberately
   unlike the delete path), then apply new (guards as `logMaterialAndUpdateGear:225-260`),
   re-reading `getState()` between.
4. Recipient changed → old recipient untouched (legacy ruling `LogMaterialModal.tsx:366-368`);
   apply new effect to the new recipient only.
5. Missing player → PUT still lands; gear step returns early (`:223` guard pattern).

Row 3 with a **material** change (UT → twine) reverts systematically — legacy skipped it (its UT
branch never falls through, `:348`); named v2-improves-legacy delta in the PR body.

- [ ] **Step 1: Failing tests** — module-level store mocks with a **stateful** `updatePlayer`
  (merges `gear`/`tomeWeapon` payloads into the fixture player, so revert→apply reads fresh state
  as the real store would):

```ts
vi.mock('../stores/lootTrackingStore', () => ({ useLootTrackingStore: { getState: vi.fn() } }));
vi.mock('../stores/tierStore', () => ({ useTierStore: { getState: vi.fn() } }));
```

  Rows: head→body move · slot→none (`updateGear: false` → payload `slotAugmented: ''`, head
  reverted) · none→slot · solvent tome_aug→weapon slot · recipient change (zero old-recipient
  calls) · UT kept (idempotent) · UT unchecked (`hasItem: false` only) · UT→twine material change ·
  notes `''`/value passthrough · week-only edit (PUT + week-data refresh, zero gear calls) ·
  **the week-data refresh fires after every PUT** (M5).
- [ ] **Step 2: Run → FAIL** (export missing). **Step 3: Implement.** Existing exports untouched.
- [ ] **Step 4: Run** — green; build green (the `''` widening compiles V1's `null` writers
  unchanged — verified: `MaterialLogEntryUpdate` is only ever forwarded).
- [ ] **Step 5: Commit** — `feat(loot): updateMaterialAndReconcileGear — R-21 old-vs-new reconciliation`

---

### Task 6: Edit mode in the modal

**Files:** `QuickLogMaterialModal.tsx` · `QuickLogMaterialModal.type-test.tsx` · extend the test file

**Interfaces:** consumes Task 5's coordinator (mocked like `logMaterialAndUpdateGear`); produces
the `edit` union branch D5/D11 will mount:

```ts
  | {
      /** Edit — R-21. Selectors + notes render; submit reconciles old-vs-new. */
      floors: string[];
      editEntry: MaterialLogEntry;
      /** No initialWeek: the week comes from the entry. */
      floor?: never; material?: never; suggestedPlayer?: never; showNotes?: never; initialWeek?: never;
    }
```

Mode: `props.editEntry ? 'edit' : props.floor != null ? 'pinned' : 'freeform'`; every
`mode !== 'pinned'` gate from 3B/4 (selectors, week row, notes, placeholder, subs checkbox)
already covers `edit`.

**Edit-specific behavior (exact):**
- Open-reset from the entry: material `editEntry.materialType`; recipient
  `editEntry.recipientPlayerId`; week `editEntry.weekNumber`; method `editEntry.method || 'drop'`;
  notes `editEntry.notes ?? ''`; `includeSubs` = recipient's `isSubstitute` (legacy `:218`), so a
  sub's entry shows its recipient. **Floor (director m4):** `parseFloorName(editEntry.floor)`,
  but when that floor's table lacks the entry's material (parse fallback = 1; floors 1/4 carry
  none), prefer `getFloorForUpgradeMaterial(editEntry.materialType)[0]` — never an empty pill row
  with nothing pressed.
- Gear init: `'tome_weapon'` → augmentTome; a slot → that slot; UT →
  `updateGear = recipient ? hasTomeWeaponItem(recipient) : false` (`LogMaterialModal.tsx:220-226`);
  slot materials → `updateGear = !!editEntry.slotAugmented`; no slot recorded → `initialGearSelection`.
- Eligibility includes the original slot (one pure helper, not a fourth memo fork):

```ts
/** Edit mode: the entry's own slot stays offered even though it is currently augmented. */
function withOriginalSlot(slots: GearSlot[], original: MaterialLogEntry['slotAugmented']): GearSlot[] {
  if (!original || original === 'tome_weapon' || slots.includes(original)) return slots;
  return [original, ...slots];
}
```

  applied in `eligibleOptions` when `mode === 'edit' && editEntry.recipientPlayerId ===
  recipientPlayerId`; a `'tome_weapon'` original forces `canAugmentTomeWeapon`;
  `hasEligibleOptions` gains `|| (mode === 'edit' && !!props.editEntry.slotAugmented)`.
- Recipient injection: entry's recipient missing from the pool → prepend
  `{ value: id, label: editEntry.recipientPlayerName }`.
- Chrome: title `Edit Material Entry` + `Pencil` icon; submit `Save Changes`; toast
  `Material entry updated`.
- Preview states the reconciliation: `~ Update {name} entry for {recipient} (Week {N})`; on an
  effect change `− Un-mark {old} as augmented` / `+ Mark {new} as augmented` (`obtained` for UT);
  on a recipient change, the `+` line for the new recipient **plus** (director m2)
  `· {OldName} keeps their augmented {Slot}` — the non-move is a consequence the block must state.
- Submit: `updateMaterialAndReconcileGear(groupId, tierId, props.editEntry, { weekNumber,
  floor: floorName, materialType: material, recipientPlayerId, method, notes: notes.trim() },
  options)` with `options` typed `UpdateMaterialOptions` (m9).

**Type-test additions:**

```tsx
({ ...base, floors: ['a'], editEntry: entry }) satisfies Props;
// @ts-expect-error — an edit cannot carry a pinned floor/material
({ ...base, floors: ['a'], editEntry: entry, floor: 'M11S', material: 'twine' }) satisfies Props;
// @ts-expect-error — an edit's week comes from the entry
({ ...base, floors: ['a'], editEntry: entry, initialWeek: 2 }) satisfies Props;
```

- [ ] **Step 1: Failing tests** — prefill (all six fields + includeSubs-for-sub-recipient);
  original slot present in the Select; out-of-pool recipient injected by name; m4 floor fallback
  (entry floor "M9S" + twine → floor pills land on twine's home floor); preview `−`/`+` on
  head→body; preview `· keeps their augmented` on recipient change; submit args (oldEntry
  identity, trimmed notes incl. `''` when cleared, options triple); UT-uncheck case.
- [ ] **Step 2: Run → FAIL.** **Step 3: Implement.**
- [ ] **Step 4: Run** — full file green (baseline untouched, snapshots unchanged); build; dupes.
- [ ] **Step 5: Commit** — `feat(loot): material modal edit mode with old-vs-new reconciliation (R-21)`

---

### Task 7: Toolbar action + Loot wiring + write-backs + release note

**Files:** `LootToolbar.tsx` · `Loot.tsx` · extend `Loot.test.tsx` · `releaseNotes.ts` ·
`design/redesign/specs/phase-d-loot-plan.md` (§5) · `design/redesign/specs/phase-d-loot-design.md`
(R-26 build note)

**Interfaces:** consumes 3B/4's `freeform` branch + `showNotes` + pinned `initialWeek`;
`writeWeek` (`Loot.tsx:511-517`). Produces `LootToolbarProps.onLogMaterial: () => void`.

- [ ] **Step 1: Failing tests** — upgrade the modal mock (today captures nothing, `Loot.test.tsx:79-82`):

```tsx
const materialModalCalls: Record<string, unknown>[] = [];   // reset in beforeEach
vi.mock('./QuickLogMaterialModal', () => ({
  QuickLogMaterialModal: (props: { isOpen: boolean; floor?: string }) => {
    materialModalCalls.push(props);
    return props.isOpen ? (
      <div data-testid="material-modal" data-floor={props.floor ?? ''}
           data-mode={props.floor != null ? 'pinned' : 'freeform'} />
    ) : null;
  },
}));
```

  Tests (reuse `renderLoot`/`viewButton`/`setLogWeek`): toolbar "Log material" → freeform props
  (`floors`, `initialWeek === clock.currentWeek` on Priority, no `floor`/`material`/
  `suggestedPlayer`, **full-roster `allPlayers`** incl. subs — R-a); on Log with `setLogWeek(2)` →
  `initialWeek: 2`; `canEdit: false` → button absent; matrix cell → pinned props **now with
  `showNotes: true` and `initialWeek === writeWeek`** (M4 coherence — the cell door leaves its
  pre-D8 `maxWeek` default).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** `LootToolbar.tsx`: required `onLogMaterial` beside `onLogDrop`;
  button between "Log a drop" and the wizard (order per the design record's toolbar sketch);
  doc-comment action list updated:

```tsx
<Button variant="secondary" size="sm"
        leftIcon={<Gem className="h-3.5 w-3.5" aria-hidden />}
        onClick={onLogMaterial}>
  Log material
</Button>
```

  `Loot.tsx`:

```ts
type MaterialState =
  | { mode: 'cell'; material: MaterialType; floorName: string; suggested: SnapshotPlayer }
  | { mode: 'freeform' }
  | null;
```

  cell setters (`:727`, `:772`) gain `mode: 'cell'`; toolbar
  `onLogMaterial={() => setMaterialState({ mode: 'freeform' })}` (comment: R-20 displayed-week +
  the 2026-08-08 R-b ruling); mounts:

```tsx
{materialState?.mode === 'cell' && (
  <QuickLogMaterialModal isOpen onClose={() => setMaterialState(null)}
    groupId={group.id} tierId={tier.tierId}
    floor={materialState.floorName} material={materialState.material}
    maxWeek={clock.maxWeek} initialWeek={writeWeek}   /* M4: every v2 write targets writeWeek */
    suggestedPlayer={materialState.suggested}
    allPlayers={mainRosterPlayers} settings={settings}
    showNotes            /* R-26: v2's cell door gains notes; V1's door passes neither prop */
    onSuccess={refresh} />
)}
{materialState?.mode === 'freeform' && (
  <QuickLogMaterialModal isOpen onClose={() => setMaterialState(null)}
    groupId={group.id} tierId={tier.tierId}
    floors={floors} initialWeek={writeWeek}
    maxWeek={clock.maxWeek}
    allPlayers={players}   /* R-a: full roster — the modal's includeSubs gate does the widening */
    settings={settings}
    onSuccess={refresh} />
)}
```

- [ ] **Step 4: Run** — `pnpm --dir frontend test Loot` green, then the full local gate
  (`build` · `lint` · `check:design-system:strict` · `dupes` · `tokens:check` · `test` ·
  `deadcode` vs a baseline captured on `main`).
- [ ] **Step 5: Write-backs (director B3/m7/m11 + the two rulings):**
  - `phase-d-loot-plan.md` §5 additions: **R-21 is unit-proven only at D8** — its browser
    demonstration is a named DoD item on whichever of D5/D11 lands first (same for the
    reconciliation matrix); the **`notes: null` backend contract** follow-up (named, no longer
    PR-body-only); **phase DoD 2's call-site enumeration test does not exist yet — D14 writes it.**
  - `phase-d-loot-design.md` R-26 build note: rulings R-a (subs widening restored in non-pinned
    modes; pinned/V1 door keeps its filter) and R-b (both toolbar actions on all three views,
    D4 precedent; they move together or not at all).
- [ ] **Step 6: Release note** — next internal entry (`internal: true`, `CURRENT_VERSION`
  untouched, `prTitle` + `pr: 0` per the `pr-checklist` skill): *"V2 preview: the material modal
  grows floor + material selectors, notes, subs widening, and edit mode (R-26/R-21/D-37); Log's
  toolbar gains 'Log material' targeting the displayed week (R-20)."*
- [ ] **Step 7: Commit** — `feat(loot): Log material toolbar action + wiring, rulings written back (R-20/R-26)`

---

## Definition of done (slice)

1. **The committed Task 1 snapshot file is byte-unchanged in the final diff** (`git diff --stat`
   shows no `.snap` churn) and the baseline block is unedited — B4's first clause. If snapshots
   were dropped for nondeterminism, the widened enumerated asserts stand in AND the modal's PR
   hunk enumeration is mandatory-per-hunk.
2. PR body carries the §2.1 hunk enumeration for the four shared files — three claimed (and
   verified) additive; the modal claimed honestly as *ruled rewrite with a frozen pinned branch* —
   each hunk with its V1 reach path.
3. `git diff --stat` over `components/history/`, `LootPriorityPanel.tsx`, `loot/index.ts`,
   `stores/` = empty.
4. One logging model: `logMaterialAndUpdateGear`'s v2-subtree call-site set unchanged;
   `updateMaterialAndReconcileGear` has exactly one caller (the modal). Phase DoD 2's enumeration
   *test* is explicitly deferred to D14 (written into §5 by Task 7).
5. Full local gate green; screenshots embedded: free-form modal light+dark, the toolbar, a pinned
   cell open showing notes, **and the V1 legacy-shell modal light+dark** (legacy → Gear → Loot
   Priority → material Assign) proving the frozen door — B4's second clause.
6. Browser validation (DEVTST): toolbar → free-form Glaze log on a back-dated displayed week;
   floor-pill switch re-filtering materials; subs widening reaching a substitute; matrix cell →
   pinned modal with notes; the V1 path above. **Edit mode is unit-proven only** — recorded in the
   PR body as a data limit AND carried forward in §5 (B3).
7. Release note internal, no version bump; no AI attribution; merge awaits the user.

## Deltas + decisions ledger (PR body copies this)

- **RULED 2026-08-08 (user):** R-a subs widening in non-pinned modes (D-37's text honored;
  pinned/V1 frozen) · R-b both quick-log actions on all three Loot views (D4 precedent; never diverge).
- `''` wire sentinels for clearing notes/slotAugmented (backend-verified; legacy V1's null-based
  clear stays a live no-op bug there, untouched).
- Systematic edit reconciliation incl. material-change reverts (legacy skipped them); recipient
  change leaves the old recipient's gear (legacy ruling) and the preview says so.
- v2's cell door gains notes (`showNotes`) and `initialWeek={writeWeek}` (M4 coherence — was
  implicitly `maxWeek`; every other v2 write targets `writeWeek`).
- Free-form floor pills render only material-dropping floors (`[2,3]`) — v1 offered a full floor
  Select + empty state; named user-visible improvement (m8).
- Edit-mode floor fallback prefers the material's home floor over a parse-failure floor (m4).
