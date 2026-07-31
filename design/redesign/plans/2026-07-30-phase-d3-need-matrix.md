# Phase D — Slice D3: v2's Need Matrix + Queues Wiring — Implementation Plan (REV 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Vet record:** `xivrp-director` plan-vet 2026-07-30 → APPROVED-WITH-CORRECTIONS (2 blockers · 6 major · 8 minor) — ALL folded into this revision. V1-freeze claim VERIFIED CLEAN by the director (no touched file is legacy-reachable; no §2.1 file appears). Two findings escalated to the user and RULED: matrix rows band **F4→F1** (M-2), and D-25's badge takes the **restore-both** branch (M-1): the surface-level "Loot history adjustments active" line returns under the enhanced-scoring gate AND the per-row Adjusted tag ships as an addition.

**Goal:** Build v2's own Need matrix (R-48) as the Priority landing view (R-1), wire its cells into D2's prefilled RecipientPicker (R-4), and make the queue rows consume D2's explanation leaf (R-6) — carrying the D3 kickoff rulings (2026-07-30): D-25's score breakdown + adjustments signals land in the why-popover and picker; the why popover shows reasons **and** warnings; the D-36 hint suppresses the confidence pill when it shows.

**Architecture:** A new presentational `NeedMatrix` over a new `needMatrixData` derivation module whose gear membership comes from the SAME pools the queues and picker use (`getPriorityForItem`/`getPriorityForRing`) — the R-6 "can never disagree" invariant by construction. Material counts are a v2-local re-expression of the pool functions' eligibility math, consistency-tested against them. FloorCard's gear queues switch to `buildRecipientEntries` (the picker's derivation) so queue rows carry rank+reason+breakdown, and a new `QueueWhy` tooltip content component renders the R-6/D-25 layer per row.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS 4 semantic tokens, Radix Tooltip (via `primitives/Tooltip`), Vitest + @testing-library/react (jsdom).

## Global Constraints

Every task implicitly includes all of these. Violations are review-rejections.

1. **Frozen files — never edit:** `components/loot/WhoNeedsItMatrix.tsx`, `components/loot/FilterBar.tsx`, anything under `components/history/`, `utils/priority.ts`, `utils/priorityEntries.ts`, `utils/lootRecommendationService.ts`, `components/ui/PriorityRow.tsx`. Read-only REUSE (imports, incl. type-only) of these is allowed and expected. Removing any existing export from `components/loot/index.ts` is a V1 edit — don't. New components are sibling-imported, NOT barrel-exported (the `RankingExplanation` precedent).
2. **Colors:** semantic tokens only. Floor color = `FLOOR_TEXT_CLASS` from `components/loot/floorClasses.ts`. Role color = `var(--color-role-${role}, var(--color-text-muted))` inline style (the PriorityRow/RecipientPicker pattern). NEVER `FLOOR_COLORS[n].hex`, never a hex/rgb literal, never raw Tailwind palette classes.
3. **Contrast rule (recorded oklab blindspot):** role color as a **ring/border, never a fill behind text**. A number inside a dot gets a role-colored ring + neutral fill (`bg-surface-interactive`) + `text-text-primary` number — mirrors `PriorityRow.tsx:49-59`. (Deliberate deviation from the mockup's filled dot; disclosed in the PR body.)
4. **Design system:** no raw `<button>`/`<input>`/`<select>` — use `Button`/`IconButton`/`Tag`/etc. No `design-system-ignore` without a real justification. Text ≥ `text-xs` (12px).
5. **Copy:** "static", never "group", in user-facing text. No copy references "8 players" — R-11's whole point.
6. **Tests:** `fireEvent` from `@testing-library/react` — **`userEvent` is NOT installed** (D2 lesson). Run per-file with `cd frontend && pnpm vitest run <path>` (Bash) before the full suite.
7. **Gates (Task 6 runs all):** `pnpm build` (= `tsc -b && vite build`; `tsc --noEmit` is NOT equivalent), `pnpm lint`, `pnpm check:design-system:strict`, `pnpm dupes`, `pnpm tokens:check`, `pnpm deadcode` (vs the captured main baseline), `pnpm test` — all from `frontend/`.
8. **Commits:** one per task, `feat(loot): …`/`test(loot): …` style. **NO AI attribution of any kind** — no Co-Authored-By, no "Generated with", nothing. Absolute repo rule.
9. **Branch:** all work on `phase-d/d3-matrix` (created from `main` before Task 1; the primary session captures the `pnpm deadcode` baseline on `main` first).
10. Legacy shell parity: nothing here may change what V1 renders. Director-verified: no file in this plan's table is legacy-reachable. If you find yourself editing a file not listed in a task's **Files** block, STOP and report.
11. **Release notes:** D3 is a NEW entry `version: '2.1.8'`, `internal: true` (top of `RELEASES`), following the 2.1.6/2.1.7 shape exactly. `CURRENT_VERSION` stays **`2.1.5`** — it tracks the latest *public* release (`releaseNotes.ts:12,49-57`). (Director B-2: the phase plan's "2.1.1" note is stale; Task 6 fixes that doc line.)

**Binding rulings implemented here (do not re-litigate):** R-1 (Matrix = landing view), R-2/R-10 (one pill scope; per-view defaults until first explicit pick: Matrix→All, Queues→newest-in-progress; first pick is global), R-4 (cell → RecipientPicker prefilled, ranked list stays rendered/switchable), R-6 (one explanation derivation+presentation; queue rows consume it), R-8/R-9 (floor color on the gear NAME, neutral icon, kept in the all-floors view), R-11 (Need denominator = rendered roster), R-48 (net-new component; `WhoNeedsItMatrix`+`FilterBar` frozen), kickoff rulings 1–3, and the vet-round rulings: **rows band F4→F1** (Weapon first, matching Queues' newest-first; user-ruled 2026-07-30) and **adjustments restore-both** (surface line under the enhanced gate + per-row Adjusted tag).

**Named non-goals / disclosures (put ALL of these in the PR body):**
- Material queue rows get NO why popover — the R-6 leaf's taxonomy is gear-shaped, and materials log through `QuickLogMaterialModal`, which has no leaf either. Deferred with rationale.
- Breakdown tooltip and why-popover are hover/focus-only (legacy D-25 was hover-only); on touch devices `Tooltip` renders children bare (`Tooltip.tsx:44-47`), so both are dead there — **explicit Phase-P ledger item**, per the standing mobile deferral.
- Ring-count dot uses ring+neutral-fill+primary-text, not the mockup's filled dot (Global Constraint 3).
- Gear Need cells show a FREE Tag at zero needers (legacy-faithful; the mockup always prints `count/8`) — mockup delta.
- Need-column tone is two-step (warning at ≥ half the roster, muted below), not legacy's three-step error/warning/muted — simplification, disclosed.
- Pre-existing D2 disclosure (not introduced here): a matrix ring-cell click for a ring2-only needer logs `itemSlot: 'ring1'` in the record (`RecipientPicker.tsx:543` maps `'ring' → 'ring1'` unconditionally); the *gear mark* still lands on the right ring (`lootCoordination.ts:92-106` re-resolves). v1's matrix resolved the record slot. Behavior correct, record imprecise — disclosed, follow-up left to a later slice if the user wants record parity.
- R-9's premise line gets a ⚠ correction in the design record (Task 6): the legacy/mockup order was anatomical, never floor-sorted; banding is NEW, user-ruled at D3 build.

**D3b split boundary (pre-declared per kickoff ruling 1):** if `git diff --stat main..HEAD` at Task 6 lands the slice materially over the ~1,500-line PR budget, the D-25 half splits off as D3b = Task 4 (minus the pill-suppression change, which stays in D3) + Task 5's breakdown/Adjusted/score lines in `QueueWhy` (QueueWhy itself, with reasons+warnings, stays in D3). The split is two PRs from one branch history, not a redesign.

---

## File structure (locked by this plan)

| File | Status | Responsibility |
|---|---|---|
| `frontend/src/components/loot/needMatrixData.ts` | **create** | Pure derivation: position sort, floor-banded gear rows (pool membership), material rows (v2-local counts) |
| `frontend/src/components/loot/needMatrixData.test.ts` | **create** | Consistency proofs vs the shared pools; ordering; count math |
| `frontend/src/components/loot/NeedMatrix.tsx` | **create** | Presentational matrix: table, dots, Need column, legend, empty state |
| `frontend/src/components/loot/NeedMatrix.test.tsx` | **create** | Render/interaction tests incl. R-11 denominator + canEdit gating |
| `frontend/src/components/loot/ScoreBreakdown.tsx` | **create** | D-25 leaf: score line + component lines (sibling-import only) |
| `frontend/src/components/loot/ScoreBreakdown.test.tsx` | **create** | Line rendering, zero-suppression, signs, fractional formatting |
| `frontend/src/components/loot/QueueWhy.tsx` | **create** | Why-popover content: per-candidate rank/name/explanation/breakdown/Adjusted + surface adjustments line |
| `frontend/src/components/loot/QueueWhy.test.tsx` | **create** | Content tests (rendered directly, not through Radix hover) |
| `frontend/src/components/loot/RecipientPicker.type-test.tsx` | **create** | Compile-time: `initialRecipientId` is assign-only (Button.type-test.tsx pattern) |
| `frontend/src/utils/recipientRanking.ts` | modify | `RecipientEntry` gains optional `score`/`breakdown`/`droughtBonus`/`balancePenalty` (needers only) |
| `frontend/src/utils/recipientRanking.test.ts` | modify | Breakdown presence rules + the unmocked order-identity proof for Task 5's swap |
| `frontend/src/utils/rankingExplanation.ts` | modify | Doc header only: D-25 clause now false — update (director m-3) |
| `frontend/src/components/loot/RankingExplanation.tsx` | modify | Doc header only: same (director m-3) |
| `frontend/src/components/loot/Loot.tsx` | modify | `'matrix'` view (landing), per-view scope default, NeedMatrix mount + R-4 wiring |
| `frontend/src/components/loot/Loot.test.tsx` | modify | New tests + repair of ~13 fresh-mount tests that assumed a Queues landing |
| `frontend/src/components/loot/RecipientPicker.tsx` | modify | Pill suppression (hint-gated); rank-badge breakdown tooltip; Adjusted tag; surface adjustments line |
| `frontend/src/components/loot/RecipientPicker.test.tsx` | modify | Pill suppression, Adjusted tag, surface line |
| `frontend/src/components/loot/FloorCard.tsx` | modify | Gear queues via `buildRecipientEntries`; pass `why` to rows |
| `frontend/src/components/loot/FloorCard.test.tsx` | modify | Why-presence rules (order-identity proof lives in recipientRanking.test.ts — this file's `priorityEntries` mock would defeat it, director M-5) |
| `frontend/src/components/loot/FloorDropRow.tsx` | modify | Export `MATERIAL_TOKEN` (Task 2); optional `why` prop → Tooltip-wrapped info IconButton (Task 5) |
| `frontend/src/data/releaseNotes.ts` | modify | New `2.1.8` internal entry; `CURRENT_VERSION` untouched at `2.1.5` |
| `design/redesign/specs/phase-d-loot-design.md` | modify | Task 6: ⚠ R-9 premise correction + D3 build rulings recorded |
| `design/redesign/specs/phase-d-loot-plan.md` | modify | Task 6: one-line fix of the stale "`CURRENT_VERSION` is `2.1.1`" note |

---

### Task 1: `needMatrixData` derivation module

**Files:**
- Create: `frontend/src/components/loot/needMatrixData.ts`
- Test: `frontend/src/components/loot/needMatrixData.test.ts`

**Interfaces:**
- Consumes: `getPriorityForItem`, `getPriorityForRing`, `getPriorityForUpgradeMaterial`, `getPriorityForUniversalTomestone` from `../../utils/priority` (READ-ONLY imports); `requiresAugmentation` from `../../utils/calculations`; `FLOOR_LOOT_TABLES`, `UPGRADE_MATERIAL_SLOTS`, `UPGRADE_MATERIAL_DISPLAY_NAMES`, `getFloorForUpgradeMaterial`, `type FloorNumber`, `type UpgradeMaterialType` from `../../gamedata/loot-tables`; `GEAR_SLOT_NAMES` from `../../types`.
- Produces (Tasks 2–3 rely on these exact names):
  - `sortByPosition(players: SnapshotPlayer[]): SnapshotPlayer[]`
  - `interface GearMatrixRow { kind: 'gear'; slot: GearSlot | 'ring'; label: string; floorNumber: FloorNumber; needers: Set<string> }`
  - `interface MaterialMatrixRow { kind: 'material'; material: UpgradeMaterialType; label: string; floorNumbers: FloorNumber[]; counts: Map<string, number>; totalNeeded: number }`
  - `buildGearMatrixRows(players: SnapshotPlayer[], settings: StaticSettings): GearMatrixRow[]`
  - `buildMaterialMatrixRows(players: SnapshotPlayer[], materialLog: MaterialLogEntry[]): MaterialMatrixRow[]`
  - `materialNeedCount(player: SnapshotPlayer, material: UpgradeMaterialType, materialLog: MaterialLogEntry[]): number`

- [ ] **Step 1: Write the failing tests**

Create `needMatrixData.test.ts`. Build fixtures with a `makePlayer` helper modeled on `recipientRanking.test.ts`'s fixture style (read that file first — `id`, `name`, `role`, `position`, `job`, `configured: true`, `isSubstitute: false`, `gear: [{ slot, bisSource, hasItem, isAugmented, itemName }...]`, optional `tomeWeapon`). Coverage spec (write real tests for each):

```ts
// 1. sortByPosition: T1,T2,H1,H2,M1,M2,R1,R2 order; players with no/unknown
//    position sort last, original relative order preserved among them.

// 2. Row order is floor-banded F4→F1 (user-ruled 2026-07-30): exactly
//    ['weapon','body','legs','head','hands','feet','earring','necklace','bracelet','ring']
//    with floorNumbers [4,3,3,2,2,2,1,1,1,1] (ring1 collapses to slot 'ring',
//    label 'Ring'). Derive the EXPECTED sequence from FLOOR_LOOT_TABLES in the
//    test so tier-data changes don't silently break the premise.

// 3. Membership consistency (the R-6 invariant): for every gear row,
//    row.needers equals new Set(pool.map(e => e.player.id)) where pool is
//    getPriorityForRing(players, settings) for 'ring' and
//    getPriorityForItem(players, row.slot, settings) otherwise.
//    Fixture: 4 players — one needs the slot (raid BiS, !hasItem), one has it,
//    one tome-BiS in that slot, one needs only ring2.

// 4. Ring semantics: the ring2-only needer IS in the 'ring' row's needers.

// 5. materialNeedCount, twine: gear slot in UPGRADE_MATERIAL_SLOTS.twine with
//    bisSource 'tome' + hasItem + !isAugmented + augmenting itemName ('Aug. X')
//    → counts 1; hasItem:false → 0; bisSource 'raid' → 0; isAugmented → 0;
//    non-augmenting itemName (base-tome BiS, 'Quetzalli Coat') → 0.

// 6. Received subtraction, twine: a materialLog entry {materialType:'twine',
//    recipientPlayerId, slotAugmented: null} subtracts 1; an entry WITH
//    slotAugmented set does NOT subtract (mirrors priority.ts:417-431).

// 7. Solvent is POOL-faithful and therefore ADDITIVE (director B-1 — this is
//    the real delta vs the LEGACY matrix, which used if/else and capped at 1):
//    a player with a tome-BiS weapon gear row ('Aug.'-named, hasItem,
//    !isAugmented) AND a tomeWeapon {pursuing, hasItem, !isAugmented} counts
//    2 — and IS in getPriorityForUpgradeMaterial(players,'solvent',settings,[]).
//    A player with ONLY the tomeWeapon path counts 1. (priority.ts:441 reads
//    the weapon GEAR row via UPGRADE_MATERIAL_SLOTS.solvent = ['weapon'], and
//    :452-455 ADDS the tomeWeapon increment.)

// 8. universal_tomestone: {pursuing:true, hasItem:false} → 1; a materialLog
//    entry of that type subtracts regardless of slotAugmented (mirrors
//    getPriorityForUniversalTomestone's counting); not pursuing → 0.

// 9. Pool consistency (load-bearing property test): for each of the four
//    materials and every player in a mixed fixture,
//    materialNeedCount(p, m, log) > 0 ⟺ p appears in the corresponding pool
//    (getPriorityForUpgradeMaterial for twine/glaze/solvent with the same
//    log; getPriorityForUniversalTomestone for universal_tomestone).

// 10. buildMaterialMatrixRows: order twine, glaze, solvent, universal_tomestone;
//     counts map holds only >0 entries; totalNeeded = sum;
//     floorNumbers === getFloorForUpgradeMaterial(material).
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/components/loot/needMatrixData.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `needMatrixData.ts`**

```ts
/**
 * needMatrixData — v2 Need-matrix derivation (Phase-D D3; R-48/R-9/R-11).
 *
 * Gear membership comes from the SAME pools the queue rows and picker use
 * (getPriorityForItem / getPriorityForRing), so a matrix dot can never
 * disagree with the queue or the picker (R-6's invariant) — a re-expression,
 * not a transcription, of the frozen WhoNeedsItMatrix (jscpd gate).
 *
 * Material counts re-express the eligibility math inside
 * getPriorityForUpgradeMaterial / getPriorityForUniversalTomestone (the
 * pools expose only {player, score}); consistency tests assert
 * count>0 ⟺ pool membership so the two can't drift.
 *
 * Deliberate deltas vs the LEGACY matrix (all pool-faithful — matching the
 * pool is the point; the legacy matrix disagreed with its own panel's pools):
 *   - solvent is ADDITIVE: the pool reads the weapon GEAR row
 *     (UPGRADE_MATERIAL_SLOTS.solvent = ['weapon'], priority.ts:441) AND adds
 *     the tomeWeapon increment (:452-455), so a player on both paths counts 2
 *     where legacy's if/else capped at 1;
 *   - requiresAugmentation gates twine/glaze/solvent counts (legacy applied
 *     no such gate — base-tome-BiS slots never need materials);
 *   - the material-log subtraction applies (legacy's matrix ignored the log).
 *
 * Rows band by floor F4→F1 (Weapon first, matching the Queues stack's
 * newest-first order) — user-ruled 2026-07-30 at D3 build.
 */
```

Then implementation exactly as follows:

```ts
import {
  getPriorityForItem, getPriorityForRing,
} from '../../utils/priority';
import { requiresAugmentation } from '../../utils/calculations';
import {
  FLOOR_LOOT_TABLES, UPGRADE_MATERIAL_SLOTS, UPGRADE_MATERIAL_DISPLAY_NAMES,
  getFloorForUpgradeMaterial, type FloorNumber, type UpgradeMaterialType,
} from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES } from '../../types';
import type { SnapshotPlayer, StaticSettings, MaterialLogEntry, GearSlot } from '../../types';

const POSITION_ORDER = ['T1', 'T2', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2'];
const MATERIAL_ORDER: UpgradeMaterialType[] = ['twine', 'glaze', 'solvent', 'universal_tomestone'];

export function sortByPosition(players: SnapshotPlayer[]): SnapshotPlayer[] {
  return [...players].sort((a, b) => {
    const ai = a.position ? POSITION_ORDER.indexOf(a.position) : -1;
    const bi = b.position ? POSITION_ORDER.indexOf(b.position) : -1;
    return (ai === -1 ? POSITION_ORDER.length : ai) - (bi === -1 ? POSITION_ORDER.length : bi);
  });
}

export interface GearMatrixRow {
  kind: 'gear';
  slot: GearSlot | 'ring';
  label: string;
  floorNumber: FloorNumber;
  needers: Set<string>;
}

export function buildGearMatrixRows(players: SnapshotPlayer[], settings: StaticSettings): GearMatrixRow[] {
  const rows: GearMatrixRow[] = [];
  for (const floorNumber of [4, 3, 2, 1] as FloorNumber[]) {
    for (const tableSlot of FLOOR_LOOT_TABLES[floorNumber].gearDrops) {
      const item = tableSlot === 'ring1'
        ? { slot: 'ring' as const, label: 'Ring' }
        : { slot: tableSlot, label: GEAR_SLOT_NAMES[tableSlot] };
      const pool = item.slot === 'ring'
        ? getPriorityForRing(players, settings)
        : getPriorityForItem(players, item.slot, settings);
      rows.push({ kind: 'gear', ...item, floorNumber, needers: new Set(pool.map((e) => e.player.id)) });
    }
  }
  return rows;
}

/**
 * How many of this material the player still needs — the eligibility math of
 * getPriorityForUpgradeMaterial / getPriorityForUniversalTomestone, exposed
 * as a count (the pools only expose membership).
 */
export function materialNeedCount(
  player: SnapshotPlayer, material: UpgradeMaterialType, materialLog: MaterialLogEntry[],
): number {
  if (material === 'universal_tomestone') {
    const need = player.tomeWeapon?.pursuing && !player.tomeWeapon?.hasItem ? 1 : 0;
    const received = materialLog.filter(
      (e) => e.materialType === 'universal_tomestone' && e.recipientPlayerId === player.id,
    ).length;
    return Math.max(0, need - received);
  }
  let need = player.gear.filter(
    (g) => UPGRADE_MATERIAL_SLOTS[material].includes(g.slot)
      && g.bisSource === 'tome' && g.hasItem && !g.isAugmented && requiresAugmentation(g),
  ).length;
  if (material === 'solvent'
    && player.tomeWeapon?.pursuing && player.tomeWeapon?.hasItem && !player.tomeWeapon?.isAugmented) {
    need++;
  }
  // Entries WITH slotAugmented were already applied to gear (isAugmented=true
  // above), so only slot-less entries count against the remaining need.
  const received = materialLog.filter(
    (e) => e.materialType === material && e.recipientPlayerId === player.id && !e.slotAugmented,
  ).length;
  return Math.max(0, need - received);
}

export interface MaterialMatrixRow {
  kind: 'material';
  material: UpgradeMaterialType;
  label: string;
  floorNumbers: FloorNumber[];
  counts: Map<string, number>;
  totalNeeded: number;
}

export function buildMaterialMatrixRows(
  players: SnapshotPlayer[], materialLog: MaterialLogEntry[],
): MaterialMatrixRow[] {
  return MATERIAL_ORDER.map((material) => {
    const counts = new Map<string, number>();
    for (const p of players) {
      const n = materialNeedCount(p, material, materialLog);
      if (n > 0) counts.set(p.id, n);
    }
    return {
      kind: 'material' as const,
      material,
      label: UPGRADE_MATERIAL_DISPLAY_NAMES[material],
      floorNumbers: getFloorForUpgradeMaterial(material),
      counts,
      totalNeeded: [...counts.values()].reduce((a, b) => a + b, 0),
    };
  });
}
```

Before writing, READ `utils/priority.ts:409-560` and the `UPGRADE_MATERIAL_SLOTS`/`getFloorForUpgradeMaterial` definitions in `gamedata/loot-tables.ts` to confirm field names (`slotAugmented`, `tomeWeapon.pursuing`, return types). If any name differs, follow the code and say so in your report.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/components/loot/needMatrixData.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/loot/needMatrixData.ts frontend/src/components/loot/needMatrixData.test.ts
git commit -m "feat(loot): D3 need-matrix derivation — pool-consistent gear membership + material counts"
```

---

### Task 2: `NeedMatrix` component

**Files:**
- Create: `frontend/src/components/loot/NeedMatrix.tsx`
- Modify: `frontend/src/components/loot/FloorDropRow.tsx` — ONLY to add `export` to the existing `MATERIAL_TOKEN` const (director M-6: FloorDropRow is v2-only, so exporting beats a fourth copy)
- Test: `frontend/src/components/loot/NeedMatrix.test.tsx`

**Interfaces:**
- Consumes (Task 1): `sortByPosition`, `buildGearMatrixRows`, `buildMaterialMatrixRows`. Also `GearSlotIcon` from `../ui/GearSlotIcon`, `JobIcon` from `../ui/JobIcon`, `Tag` from `../ui`, `Tooltip`, `IconButton` from `../primitives`, `FLOOR_TEXT_CLASS` from `./floorClasses`, `MATERIAL_TOKEN` from `./FloorDropRow`, `getValidRole` from `../../gamedata`, `type FloorScope` from `./priorityScope`.
- Produces (Task 3 relies on):

```ts
export interface NeedMatrixProps {
  /** Main roster (configured, non-substitute) — any order; sorted by position inside. */
  players: SnapshotPlayer[];
  floors: string[];
  floorScope: FloorScope;
  materialLog: MaterialLogEntry[];
  settings: StaticSettings;
  canEdit: boolean;
  onLogGear: (item: { slot: GearSlot | 'ring'; label: string; floorNumber: FloorNumber }, playerId: string) => void;
  onLogMaterial: (material: UpgradeMaterialType, player: SnapshotPlayer) => void;
}
export function NeedMatrix(props: NeedMatrixProps): JSX.Element
```

- [ ] **Step 1: Write the failing tests**

`NeedMatrix.test.tsx`, using `render`/`screen`/`fireEvent`. Fixture: 3 players (T1 tank needs Ring; H1 healer has everything; M1 melee needs Ring + Weapon and needs 2 twine via two tome slots w/ `Aug.` names). Coverage spec:

```ts
// 1. Columns: one <th scope="col"> per player with position + name; a table
//    caption exists (accessible name mentioning who needs each drop).
// 2. R-11: the Ring row's Need cell reads "2/3" — denominator is the rendered
//    roster, never 8.
// 3. FREE: a zero-needer gear row renders a "FREE" Tag in its Need cell.
// 4. canEdit=true → the Ring×T1 cell is a button with accessible name
//    "Log Ring for <T1 name>"; clicking fires onLogGear with
//    ({ slot: 'ring', label: 'Ring', floorNumber: 1 }, '<t1-id>').
// 5. canEdit=false → NO buttons anywhere; needer dots still render AND each
//    needed cell carries sr-only text "<player> needs <label>" (director m-5 —
//    a viewer must not get a table of unlabelled dots).
// 6. Scoping: floorScope=2 renders only floor-2 gear rows (Head/Hands/Feet)
//    and only materials whose floorNumbers include 2; 'all' renders all ten.
// 7. Material cell: M1's twine cell shows "2"; click fires
//    onLogMaterial('twine', <M1 player object>); its Need cell shows the bare
//    total (no "/3" — R-11's internal-consistency note).
// 8. Empty roster: players=[] renders the no-players message and no <table>.
// 9. Warning tone: 2-of-3 needers (2 ≥ ceil(3/2)) → Need cell has class
//    'text-status-warning'; a 1-needer row does not.
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/components/loot/NeedMatrix.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `NeedMatrix.tsx`**

Component doc header:

```tsx
/**
 * NeedMatrix — v2's Who-Needs-It matrix (Phase-D D3; R-48). Net-new per R-48:
 * legacy WhoNeedsItMatrix is frozen and V1-only. Differences from legacy are
 * ruled, not accidental: R-8/R-9 floor-coloured names + neutral slot icons
 * (always, not only when scoped), R-11 roster-size Need denominator, rows
 * band by floor F4→F1 (user-ruled at D3 build), scoping FILTERS rows (the D1
 * pill row is the scope control — R-48 rules FilterBar out), cells route
 * through the picker (R-4) instead of writing directly, and the ring row
 * hands the picker slot 'ring' (it resolves ring1/ring2 itself).
 */
```

Structure (tokens/classes named in Global Constraints are mandatory; **do not structurally copy `WhoNeedsItMatrix.tsx` blocks — jscpd is a blocking gate and that file is its nearest neighbor**):

- `const sorted = useMemo(() => sortByPosition(players), [players])`; gear rows `useMemo(() => buildGearMatrixRows(sorted, settings), [sorted, settings])`; material rows `useMemo(() => buildMaterialMatrixRows(sorted, materialLog), [sorted, materialLog])`.
- Scope filter: gear row visible iff `floorScope === 'all' || row.floorNumber === floorScope`; material row iff `floorScope === 'all' || row.floorNumbers.includes(floorScope)`.
- Empty roster guard: `if (players.length === 0)` → card div with `<p className="text-sm text-text-muted">No configured players on the roster yet.</p>`.
- Card: `<div className="overflow-hidden rounded-lg border border-border-default bg-surface-card">` → `<div className="overflow-x-auto">` → `<table className="w-full text-sm">` with `<caption className="sr-only">Who needs each drop — one column per roster player</caption>`.
- **Header row — re-expressed, NOT the legacy stack** (director M-6). Per player, a `<th scope="col" className="px-2 py-2.5 text-center align-bottom">` containing a single-line flex: `<JobIcon job={player.job} size="sm" />` then the position `<span className="text-sm font-bold" style={{ color: roleVar(player) }}>{player.position ?? '?'}</span>`, and BELOW it the first name in `<span className="block truncate text-xs text-text-muted" title={player.name}>` — use the native `title` attr here instead of legacy's `Tooltip` wrapper (different structure, same affordance; jsdom-testable). `roleVar(p) = 'var(--color-role-' + getValidRole(p.role) + ', var(--color-text-muted))'` — define once at module level.
- Slot cell: `<th scope="row" className="px-3 py-2 text-left font-medium">` with `<GearSlotIcon slot={row.slot} size={18} />` in a `text-text-secondary` span + name `<span className={\`text-sm font-semibold ${FLOOR_TEXT_CLASS[row.floorNumber]}\`}>` (R-9: floor-colored ALWAYS).
- Needer cell, `canEdit`: `Tooltip` (`content={\`Log ${row.label} for ${player.name}\`}`) wrapping `<IconButton variant="ghost" size="sm" aria-label={\`Log ${row.label} for ${player.name}\`} icon={<NeedDot roleVar={roleVar(player)} />} onClick={() => onLogGear({ slot: row.slot, label: row.label, floorNumber: row.floorNumber }, player.id)} />`.
- Needer cell, `!canEdit`: `<NeedDot roleVar={...} />` plus `<span className="sr-only">{player.name} needs {row.label}</span>` (director m-5 — no Tooltip dependence; `Tooltip` renders nothing extra on touch and only-while-open elsewhere).
- `NeedDot` (file-local): `<span aria-hidden className="grid h-6 w-6 place-items-center rounded-full border-2 bg-surface-interactive" style={{ borderColor: roleVar }}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: roleVar }} /></span>`.
- Non-needer cell: `<span aria-hidden className="mx-auto block h-6 w-6 rounded-full border border-border-subtle bg-surface-interactive" />`.
- Need cell (gear): 0 → `<Tag variant="label" tone="success">FREE</Tag>`; else `<span className={count >= Math.ceil(sorted.length / 2) ? 'text-status-warning font-medium' : 'text-text-muted'}>{count}/{sorted.length}</span>`.
- Materials separator row: `<th colSpan={sorted.length + 2} scope="colgroup" className="px-3 pt-3 pb-1 text-left"><span className="text-xs font-bold uppercase tracking-wider text-text-muted">Materials</span></th>`.
- Material slot cell: 24px letter square using `MATERIAL_TOKEN[row.material]` (imported from `./FloorDropRow`): `style={{ backgroundColor: \`color-mix(in srgb, ${MATERIAL_TOKEN[row.material]} 22%, transparent)\`, color: MATERIAL_TOKEN[row.material] }}`, first letter, then label `<span className="text-sm font-semibold text-text-primary">` (materials keep material identity, NOT floor color — R-8/R-19).
- Material count cell: same `Tooltip`/`IconButton`/sr-only semantics as gear cells, aria-label `Log ${row.label} for ${player.name}`, `onClick={() => onLogMaterial(row.material, player)}`; the dot is `<span className="grid h-6 w-6 place-items-center rounded-full border-2 bg-surface-interactive text-xs font-bold text-text-primary" style={{ borderColor: roleVar }}>{count}</span>` (Global Constraint 3).
- Material Need cell: 0 → FREE Tag; else `Tooltip`-wrapped `<span className="text-text-muted">{row.totalNeeded}</span>` with content `${row.counts.size} player${row.counts.size === 1 ? '' : 's'} need ${row.totalNeeded} total`.
- Legend footer (inside the card, under the table): flex-wrap `text-xs text-text-muted` row: NeedDot sample + "Needs this slot"; neutral dot + "Has it, or not in their BiS"; count-dot sample ("2") + "Material — number is how many"; FREE Tag + "No one needs it"; when `canEdit`: `<span className="text-text-tertiary">Click a dot to log it</span>`. Samples use a fixed `var(--color-role-tank)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/components/loot/NeedMatrix.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + design-system + dupes check, then commit**

Run: `cd frontend && pnpm lint && pnpm check:design-system:strict && pnpm dupes`
Expected: no NEW findings attributable to the new files; `pnpm dupes` green (if it flags a NeedMatrix↔WhoNeedsItMatrix clone, re-express the flagged block — never add an ignore).

```bash
git add frontend/src/components/loot/NeedMatrix.tsx frontend/src/components/loot/NeedMatrix.test.tsx frontend/src/components/loot/FloorDropRow.tsx
git commit -m "feat(loot): D3 NeedMatrix — v2's own who-needs-it matrix (R-48/R-8/R-9/R-11)"
```

---

### Task 3: `Loot.tsx` wiring — matrix landing view + R-4 cell → prefilled picker

**Files:**
- Modify: `frontend/src/components/loot/Loot.tsx` (view type ~116, `readStoredPriorityView` ~129, stale comment block ~44-47, scope derivation ~257, switcher options ~511, view body ~615, `PickerState` ~181, assign render branch ~650)
- Modify: `frontend/src/components/loot/Loot.test.tsx` (new tests AND the landing-flip repair below)
- Create: `frontend/src/components/loot/RecipientPicker.type-test.tsx`

**Interfaces:**
- Consumes: `NeedMatrix`/`NeedMatrixProps` (Task 2); `RecipientPicker`'s existing assign-only `initialRecipientId` prop (D2); `getFloorForUpgradeMaterial`, `type UpgradeMaterialType` from `../../gamedata/loot-tables`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Repair plan for the existing suite (director M-3 — do this FIRST, it is the largest work item)**

`Loot.test.tsx:158` runs `localStorage.clear()` per test, so every existing fresh-mount test currently lands on Queues and asserts `floor-card` presence — at minimum the tests at `:211, :221, :229, :263, :290, :310, :317, :340, :410, :455, :529`. After the flip they land on Matrix. Repair rule:
- Tests ABOUT Queues/FloorCard/scope behavior: seed the view in their setup — `localStorage.setItem('v2-loot-priority-view', 'queues')` (add a tiny `seedQueuesView()` helper beside the existing harness helpers) — do NOT rewrite their assertions.
- The test at `:300-306` ("falls back to Queues when the stored sub-view is the not-yet-built 'matrix'") is now WRONG by design: rewrite it to assert stored `'matrix'` renders the matrix (and keep a sibling asserting stored garbage falls back to `'matrix'`, the new default).
- Add a `NeedMatrix` mock to the harness, exactly in the house style (director-confirmed shape of the file):

```tsx
const matrixCalls: Record<string, unknown>[] = [];
vi.mock('./NeedMatrix', () => ({
  NeedMatrix: (props: Record<string, unknown>) => {
    matrixCalls.push(props);
    return (
      <div data-testid="need-matrix" data-scope={String(props.floorScope)}>
        <button onClick={() => (props.onLogGear as (i: unknown, p: string) => void)({ slot: 'ring', label: 'Ring', floorNumber: 1 }, 'p1')}>
          mock-log-gear
        </button>
        <button onClick={() => (props.onLogMaterial as (m: unknown, p: unknown) => void)('twine', { id: 'p1' })}>
          mock-log-material
        </button>
      </div>
    );
  },
}));
```

(clear `matrixCalls` in the same `beforeEach` that clears the other call arrays.)

- [ ] **Step 2: Write the new failing tests**

```ts
// 1. R-1 landing: fresh mount → 'need-matrix' testid present, no 'floor-card';
//    the Priority-view toggle renders options in order Queues | Matrix | Weapons
//    (assert via getAllByRole on the toggle's buttons/labels).
// 2. Stored 'queues' → floor-cards render, no need-matrix (regression pin).
// 3. R-10 per-view defaults: fresh mount (matrix) → last matrixCalls entry has
//    floorScope 'all'. Switch to Queues (no pill click) → floorCardCalls show
//    the newest-in-progress single-floor default (reuse the existing D1 scope
//    assertions' technique). Switch back to Matrix → floorScope 'all' again.
// 4. R-10.3: click pill F2 while on Matrix → matrixCalls floorScope 2; switch
//    to Queues → only the F2 floor-card renders (pick is global and sticky).
// 5. R-4 wiring: click the mock's 'mock-log-gear' → last pickerCalls entry has
//    mode 'assign', initialRecipientId 'p1', and item
//    { slot: 'ring', label: 'Ring', floorNumber: 1, floorName: <floors[0]> }.
//    (Component-level prefill behavior is already covered by
//    RecipientPicker.test.tsx:840-889 — the Loot-level contract is the props.)
// 6. Material cell: click 'mock-log-material' → 'material-modal' testid
//    appears (QuickLogMaterialModal stub receives isOpen) with floorName
//    derived from twine's home floor.
```

Create `RecipientPicker.type-test.tsx` following the `Button.type-test.tsx` pattern EXACTLY (read it first — exported consts via `createElement` so `noUnusedLocals` can't suppress the errors; director M-4):

```tsx
/**
 * Compile-time contract tests for RecipientPicker's discriminated props.
 * Variables are exported so `noUnusedLocals` doesn't suppress errors.
 * R-4/D2 carry-forward: initialRecipientId is assign-only.
 */
import { createElement } from 'react';
import { RecipientPicker } from './RecipientPicker';
// ...common props const built from the real types (mirror Button.type-test.tsx's style)...

export const assignAcceptsInitialRecipient = createElement(RecipientPicker, {
  ...common, mode: 'assign', item: dropItem, initialRecipientId: 'p1',
});
// @ts-expect-error — initialRecipientId is not accepted in log mode
export const logRejectsInitialRecipient = createElement(RecipientPicker, {
  ...common, mode: 'log', initialRecipientId: 'p1',
});
// @ts-expect-error — initialRecipientId is not accepted in edit mode
export const editRejectsInitialRecipient = createElement(RecipientPicker, {
  ...common, mode: 'edit', editEntry: entry, initialRecipientId: 'p1',
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/components/loot/Loot.test.tsx`
Expected: the six new tests FAIL (no matrix view exists); repaired tests still pass (they seed 'queues').

- [ ] **Step 4: Implement the wiring**

```ts
type PriorityView = 'queues' | 'matrix' | 'weapons';

function readStoredPriorityView(): PriorityView {
  // R-1: Matrix is the landing view — unset/unknown lands there. 'queues' /
  // 'weapons' persist a user's explicit choice (D1 wrote only on user action).
  try {
    const v = localStorage.getItem(PRIORITY_VIEW_KEY);
    return v === 'weapons' || v === 'queues' ? v : 'matrix';
  } catch {
    return 'matrix';
  }
}
```

Rewrite the stale halves of the `Loot.tsx:44-47` comment block ("Matrix lands in D3") and the `PriorityView` type comment (~113-116) to describe the shipped model. Scope derivation (replaces ~257):

```ts
const queuesLanding = landingScope ?? preSettleScope;
// R-10.2: until the user states a scope, each view opens at its own default —
// Matrix → All (the whole-tier read is its purpose), Queues → the newest
// in-progress floor. The first pill click (pickedScope) is global — R-10.3.
const floorScope: FloorScope = pickedScope ?? (priorityView === 'matrix' ? 'all' : queuesLanding);
```

Switcher options: `[{ value: 'queues', label: 'Queues' }, { value: 'matrix', label: 'Matrix' }, { value: 'weapons', label: 'Weapons' }]`.

`PickerState` assign arm: `{ mode: 'assign'; item: DropItemContext; initialRecipientId?: string }`; the assign render branch adds `initialRecipientId={pickerState.initialRecipientId}`.

View body — matrix branch between `history` and `weapons`:

```tsx
) : priorityView === 'matrix' ? (
  <NeedMatrix
    players={mainRosterPlayers}
    floors={floors}
    floorScope={floorScope}
    materialLog={materialLog}
    settings={settings}
    canEdit={canEdit}
    onLogGear={(item, playerId) =>
      setPickerState({
        mode: 'assign',
        item: { ...item, floorName: floors[item.floorNumber - 1] ?? `Floor ${item.floorNumber}` },
        initialRecipientId: playerId,
      })
    }
    onLogMaterial={(material, player) => {
      // The matrix has no per-floor card context — derive the material's home floor.
      const f = getFloorForUpgradeMaterial(material)[0];
      setMaterialState({ material, floorName: floors[f - 1] ?? `Floor ${f}`, suggested: player });
    }}
  />
) : priorityView === 'weapons' ? (
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/components/loot/Loot.test.tsx && pnpm vitest run src/components/loot`
Expected: PASS, including all repaired tests and sibling suites.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/loot/Loot.tsx frontend/src/components/loot/Loot.test.tsx frontend/src/components/loot/RecipientPicker.type-test.tsx
git commit -m "feat(loot): D3 wire NeedMatrix as the Priority landing view (R-1/R-4/R-10)"
```

---

### Task 4: D-25 restore — breakdown plumbing + `ScoreBreakdown` leaf + picker changes

**Files:**
- Modify: `frontend/src/utils/recipientRanking.ts` (interface ~19, needers map ~83)
- Modify: `frontend/src/utils/recipientRanking.test.ts`
- Modify: `frontend/src/utils/rankingExplanation.ts` — doc header ONLY (the "D-25 … is NOT carried here / open ruling" clauses are now false; state where D-25 landed — director m-3)
- Modify: `frontend/src/components/loot/RankingExplanation.tsx` — doc header ONLY (same)
- Create: `frontend/src/components/loot/ScoreBreakdown.tsx`
- Create: `frontend/src/components/loot/ScoreBreakdown.test.tsx`
- Modify: `frontend/src/components/loot/RecipientPicker.tsx` (confidence pill ~697, list header ~693-699, ranked row ~729-762)
- Modify: `frontend/src/components/loot/RecipientPicker.test.tsx`

**Interfaces:**
- Consumes: `EnhancedPriorityEntry`'s `score`, `breakdown?`, `droughtBonus?`, `balancePenalty?` (read-only via `buildRecipientEntries`'s existing `enhancePriorityEntries` call); `PriorityScoreBreakdown` = `{ score, rolePriority, weightedNeed, weightedNeedBonus, lootAdjustmentBonus, jobModifier, playerModifier }` (`utils/priority.ts:119-127`). Sign convention (director-verified): `score = round(base + droughtBonus − balancePenalty)` (`lootCoordination.ts:535`) — both stored as positive magnitudes, possibly fractional.
- Produces (Task 5 relies on):
  - `RecipientEntry` gains `score?: number; breakdown?: PriorityScoreBreakdown; droughtBonus?: number; balancePenalty?: number` — populated on priority-ranked needers only.
  - `ScoreBreakdown`: `({ breakdown, score, droughtBonus, balancePenalty }: { breakdown: PriorityScoreBreakdown; score?: number; droughtBonus?: number; balancePenalty?: number }) => JSX.Element`
  - `hasAdjustments(breakdown: PriorityScoreBreakdown): boolean` — `lootAdjustmentBonus !== 0 || playerModifier !== 0` — exported from `ScoreBreakdown.tsx`.

- [ ] **Step 1: Write the failing tests**

`recipientRanking.test.ts` additions:

```ts
// 1. Needers (scope 'priority') carry score + a breakdown object with the
//    documented keys; rank-null rows in scope 'all' and every 'offspec' row
//    have breakdown === undefined.
// 2. Order-identity proof for Task 5's FloorCard swap (director M-5 — lives
//    HERE because FloorCard.test.tsx mocks priorityEntries, which would
//    defeat it): with enableEnhancedScoring ON and a non-trivial lootLog,
//    buildRecipientEntries({scope:'priority',...}).map(e => e.player.id)
//    equals enhancePriorityEntries(getPriorityForItem(pool, slot, settings),
//    {settings, lootLog, currentWeek, averageDrops: calculateAverageDrops(
//    poolIds, lootLog), active: true}).map(e => e.player.id) — same pools,
//    same gate, same week ⇒ same order.
```

`ScoreBreakdown.test.tsx` (direct render):

```ts
// 1. One line per NONZERO component with its label: breakdown {score: 75,
//    rolePriority: 40, weightedNeed: 2, weightedNeedBonus: 20,
//    lootAdjustmentBonus: 0, jobModifier: 0, playerModifier: 15},
//    droughtBonus 6, balancePenalty 0 → "Role priority +40", "Need +20",
//    "Player modifier +15", "Drought bonus +6"; "Job modifier" and
//    "Loot adjustment" ABSENT.
// 2. Signs: playerModifier -10 → "−10"; balancePenalty 8 → "Balance penalty −8"
//    (a penalty subtracts — lootCoordination.ts:535).
// 3. Fractional: droughtBonus 4.5 renders "+4.5" (no float noise).
// 4. score prop present → lead line "Priority score 75"; absent → no lead line.
// 5. All-zero components → the single "Base score only" line (never empty).
// 6. hasAdjustments: true for lootAdjustmentBonus 5 or playerModifier -5;
//    false when both 0 (droughtBonus alone does NOT make it true — it has its
//    own surface-level signal, the "adjustments active" line).
```

`RecipientPicker.test.tsx` additions:

```ts
// 1. Kickoff ruling 3 (as corrected by director m-1 — suppress ONLY when the
//    hint shows): assign mode, empty needers → the "no one needs" hint renders
//    and NO confidence Tag renders. EDIT mode, empty needers → the hint does
//    NOT render (its own mode gate, RecipientPicker.tsx:616) and the
//    confidence Tag DOES render (Low).
// 2. Needers present → confidence Tag renders (regression).
// 3. Adjusted tag: a needer with priorityModifier ≠ 0 shows Tag "Adjusted" on
//    their row; a clean player's row doesn't.
// 4. M-1 restore-both: with enableEnhancedScoring ON + non-empty lootLog +
//    priority scope, the list header area renders "Loot history adjustments
//    active"; with it OFF, it doesn't.
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/utils/recipientRanking.test.ts src/components/loot/ScoreBreakdown.test.tsx src/components/loot/RecipientPicker.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`recipientRanking.ts` — interface + needers map:

```ts
import type { PriorityScoreBreakdown } from './priority'; // type-only read of a frozen file — allowed

export interface RecipientEntry {
  player: SnapshotPlayer;
  rank: number | null;
  needsItem: boolean;
  reason: string;
  needTag: NeedTag;
  /** D-25 score transparency — present on priority-ranked needers only. */
  score?: number;
  breakdown?: PriorityScoreBreakdown;
  droughtBonus?: number;
  balancePenalty?: number;
}

const needers: RecipientEntry[] = ranked.map((entry, i) => ({
  player: entry.player, rank: i + 1, needsItem: true, needTag: 'bis' as const,
  reason: `${label} is BiS · ${dropsPhrase(entry.player.id, lootLog, currentWeek)}`,
  score: entry.score, breakdown: entry.breakdown,
  droughtBonus: entry.droughtBonus, balancePenalty: entry.balancePenalty,
}));
```

`ScoreBreakdown.tsx`:

```tsx
/**
 * ScoreBreakdown — D-25's score-transparency leaf (Phase-D D3): the priority
 * score and its components, one line per nonzero part. Signs follow
 * lootCoordination.ts:535 (score = base + drought − balance; both stored as
 * positive magnitudes). Sibling-import only, like RankingExplanation.
 */
import type { PriorityScoreBreakdown } from '../../utils/priority';

export function hasAdjustments(breakdown: PriorityScoreBreakdown): boolean {
  return breakdown.lootAdjustmentBonus !== 0 || breakdown.playerModifier !== 0;
}

// Fractional drought/balance render at one decimal, integers stay bare.
const num = (n: number) => (Number.isInteger(n) ? String(Math.abs(n)) : Math.abs(n).toFixed(1));
const fmt = (n: number) => (n < 0 ? `−${num(n)}` : `+${num(n)}`);

export function ScoreBreakdown({ breakdown, score, droughtBonus, balancePenalty }: {
  breakdown: PriorityScoreBreakdown;
  score?: number;
  droughtBonus?: number;
  balancePenalty?: number;
}) {
  const lines: Array<[string, number]> = [
    ['Role priority', breakdown.rolePriority],
    ['Need', breakdown.weightedNeedBonus],
    ['Job modifier', breakdown.jobModifier],
    ['Player modifier', breakdown.playerModifier],
    ['Loot adjustment', breakdown.lootAdjustmentBonus],
    ['Drought bonus', droughtBonus ?? 0],
    ['Balance penalty', -(balancePenalty ?? 0)], // a penalty subtracts
  ].filter((l): l is [string, number] => l[1] !== 0);
  return (
    <span className="block min-w-0">
      {score !== undefined && (
        <span className="block text-xs font-semibold text-text-secondary">Priority score {score}</span>
      )}
      {lines.length === 0 ? (
        <span className="block text-xs text-text-tertiary">Base score only</span>
      ) : (
        lines.map(([label, value]) => (
          <span key={label} className="block text-xs text-text-tertiary">
            {label} <span className="font-semibold text-text-secondary">{fmt(value)}</span>
          </span>
        ))
      )}
    </span>
  );
}
```

`RecipientPicker.tsx`:
1. Confidence pill: `{scope === 'priority' && !(mode !== 'edit' && noOneNeeds) && (<Tag …confidence…/>)}` — comment: `D3 ruling: the D-36 hint owns the empty-pool message when it renders; suppressing the pill only then (in edit mode the hint is gated off, so the pill stays).`
2. **Surface adjustments line (M-1 restore-both):** in the list-header block (~693-699), when `scope === 'priority' && enhancedActive` (the component's existing `enhancedActive` const at ~242), render `<span className="text-xs text-text-tertiary">Loot history adjustments active</span>` — the v1 badge's semantics (`LootPriorityPanel.tsx:588-591`), announcing drought/balance are shaping this ranking.
3. Rank badge: wrap the existing `#{entry.rank}` span in `Tooltip` when `entry.breakdown` exists — `content={<ScoreBreakdown breakdown={entry.breakdown} score={entry.score} droughtBonus={entry.droughtBonus} balancePenalty={entry.balancePenalty} />}`. Hover-only like legacy D-25 (a11y-ledger item, disclosed).
4. Beside the needTag Tag: `{entry.breakdown && hasAdjustments(entry.breakdown) && (<Tag variant="label" tone="accent">Adjusted</Tag>)}`.
5. Update the two doc headers (`rankingExplanation.ts`, `RankingExplanation.tsx`): replace the "D-25 … NOT carried here / open ruling" clauses with "D-25's score breakdown lives in the sibling `ScoreBreakdown` leaf (D3); this module stays reasons/warnings/confidence."

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/utils/recipientRanking.test.ts src/components/loot/ScoreBreakdown.test.tsx src/components/loot/RecipientPicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/recipientRanking.ts frontend/src/utils/recipientRanking.test.ts frontend/src/utils/rankingExplanation.ts frontend/src/components/loot/RankingExplanation.tsx frontend/src/components/loot/ScoreBreakdown.tsx frontend/src/components/loot/ScoreBreakdown.test.tsx frontend/src/components/loot/RecipientPicker.tsx frontend/src/components/loot/RecipientPicker.test.tsx
git commit -m "feat(loot): D3 D-25 restore — score breakdown leaf, adjustments signals, empty-pool pill ruling"
```

---

### Task 5: Queue rows consume the leaf — `QueueWhy` + FloorCard/FloorDropRow

**Files:**
- Create: `frontend/src/components/loot/QueueWhy.tsx`
- Create: `frontend/src/components/loot/QueueWhy.test.tsx`
- Modify: `frontend/src/components/loot/FloorCard.tsx` (gear derivation ~89-101, `toRowEntries` ~58-62, row render ~138-150)
- Modify: `frontend/src/components/loot/FloorCard.test.tsx`
- Modify: `frontend/src/components/loot/FloorDropRow.tsx` (props + render)

**Interfaces:**
- Consumes: `buildRecipientEntries` + `RecipientEntry` (Task 4 fields) from `../../utils/recipientRanking`; `explainCandidate` from `../../utils/rankingExplanation`; `RankingExplanation` from `./RankingExplanation`; `ScoreBreakdown`, `hasAdjustments` from `./ScoreBreakdown`; `Tooltip`, `IconButton` from `../primitives`; `Info` from `lucide-react`.
- Produces:
  - `QueueWhy`: `({ entries, slot, lootLog, enhancedActive, maxCandidates = 3 }: { entries: RecipientEntry[]; slot: GearSlot | 'ring'; lootLog: LootLogEntry[]; enhancedActive?: boolean; maxCandidates?: number }) => JSX.Element`
  - `FloorDropRow` gains optional `why?: ReactNode` — rendered between the queue and the Assign button.

- [ ] **Step 1: Write the failing tests**

`QueueWhy.test.tsx` (direct render — Radix hover is deliberately NOT tested; content is):

```ts
// Fixture: three RecipientEntry needers (ranks 1-3) for slot 'ring'; one with
// breakdown {playerModifier: 10, ...} (→ Adjusted), one with a lootLog ring
// receipt (→ warning line via explainCandidate).
// 1. Rank + name render for each candidate up to maxCandidates (default 3; a
//    4th entry is absent).
// 2. The receipt player's block contains "Already received" (warnings ARE
//    shown — kickoff ruling 2).
// 3. The adjusted player's block contains the "Adjusted" Tag; others don't.
// 4. Breakdown lines render for entries carrying one ("Role priority",
//    "Priority score").
// 5. enhancedActive=true renders the footer line "Loot history adjustments
//    active"; false/absent renders none (M-1 restore-both, queue half).
```

`FloorCard.test.tsx` additions (this file mocks `priorityEntries` — the order-identity proof lives in `recipientRanking.test.ts`, Task 4):

```ts
// 1. Every gear row with a non-empty queue renders a "Why this order…"
//    button; an empty-queue gear row doesn't; material rows never do.
// 2. canEdit=false still renders the why button (transparency, not mutation).
// 3. Queue chips still render name+rank through the swap (smoke — the mock
//    passthrough keeps entries flowing).
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/components/loot/QueueWhy.test.tsx src/components/loot/FloorCard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`QueueWhy.tsx`:

```tsx
/**
 * QueueWhy — the queue row's "why this order" content (Phase-D D3): R-6's
 * queue-row consumption of the explanation leaf, plus D-25's breakdown and
 * Adjusted badge (kickoff ruling 1) with warnings shown (ruling 2 — an
 * intentional hover/focus is the same consent as opening the picker), and
 * the surface-level "adjustments active" line (M-1 restore-both).
 * Renders INSIDE a Tooltip; sibling-import only.
 */
import { Tag } from '../ui';
import { RankingExplanation } from './RankingExplanation';
import { ScoreBreakdown, hasAdjustments } from './ScoreBreakdown';
import { explainCandidate } from '../../utils/rankingExplanation';
import type { RecipientEntry } from '../../utils/recipientRanking';
import type { GearSlot, LootLogEntry } from '../../types';

export function QueueWhy({ entries, slot, lootLog, enhancedActive, maxCandidates = 3 }: {
  entries: RecipientEntry[];
  slot: GearSlot | 'ring';
  lootLog: LootLogEntry[];
  /** FloorCard's legacy-gate expression — renders the surface "adjustments active" line. */
  enhancedActive?: boolean;
  /** Keep in sync with PriorityRow's default maxVisible — the popover explains the visible chips. */
  maxCandidates?: number;
}) {
  return (
    <span className="block w-72 space-y-2">
      {entries.slice(0, maxCandidates).map((e) => (
        <span key={e.player.id} className="block">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            {e.rank !== null && <span className="font-display">#{e.rank}</span>}
            <span className="truncate">{e.player.name}</span>
            {e.breakdown && hasAdjustments(e.breakdown) && (
              <Tag variant="label" tone="accent">Adjusted</Tag>
            )}
          </span>
          <RankingExplanation showWarnings explanation={explainCandidate(e, slot, { lootLog })} />
          {e.breakdown && (
            <ScoreBreakdown
              breakdown={e.breakdown} score={e.score}
              droughtBonus={e.droughtBonus} balancePenalty={e.balancePenalty}
            />
          )}
        </span>
      ))}
      {enhancedActive && (
        <span className="block text-xs text-text-tertiary">Loot history adjustments active</span>
      )}
    </span>
  );
}
```

`FloorCard.tsx` — gear derivation swap (material rows stay EXACTLY as they are):

```ts
import { buildRecipientEntries } from '../../utils/recipientRanking';
import { QueueWhy } from './QueueWhy';

// R-6 (D3): gear queues use the PICKER's own derivation, so the chips, the
// why popover and the modal can never disagree. Equivalence proven in
// recipientRanking.test.ts's order-identity case: same pools, same enhanced
// gate (enhancedActive already folds in lootLog.length > 0), same week
// (enhanceWeek), and mainRosterPlayers is a fixed point of its
// configured/!isSubstitute filter.
const gearRows = gearItems.map((item) => ({
  ...item,
  entries: buildRecipientEntries({
    players, slot: item.slot, scope: 'priority', settings, lootLog,
    currentWeek: enhanceWeek, enhancedActive,
  }),
}));
```

`toRowEntries` becomes structural (director m-4 — the material call site still passes `EnhancedPriorityEntry[]`, which has no `rank`):

```ts
function toRowEntries(entries: Array<{ player: SnapshotPlayer; rank?: number | null }>): PriorityRowEntry[] {
  return entries.map((e, i) => ({
    playerId: e.player.id, name: e.player.name, role: e.player.role, rank: e.rank ?? i + 1,
  }));
}
```

Gear row render gains:

```tsx
why={row.entries.length > 0
  ? <QueueWhy entries={row.entries} slot={row.slot} lootLog={lootLog} enhancedActive={enhancedActive} />
  : undefined}
```

Keep `averageDrops`/`enhance` — material rows still use them. Remove `getPriorityForItem`/`getPriorityForRing` imports only if genuinely unused after the swap (they will be — verify with a grep before deleting).

`FloorDropRow.tsx` — props gain `why?: ReactNode`; render between `PriorityRow` and the Assign block:

```tsx
{why !== undefined && (
  <div className="flex-none">
    <Tooltip content={why} side="left">
      {/* No onClick by design: Radix opens on hover AND focus, and a click
          focuses. Dead on touch — recorded Phase-P item (mobile deferral). */}
      <IconButton
        variant="ghost"
        size="sm"
        aria-label={`Why this order for ${label}`}
        icon={<Info className="h-3.5 w-3.5" aria-hidden />}
      />
    </Tooltip>
  </div>
)}
```

(imports: `Tooltip`, `IconButton` from `../primitives`; `Info` from `lucide-react`; `type ReactNode` from `react`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/components/loot/QueueWhy.test.tsx src/components/loot/FloorCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full loot + utils suites, then commit**

Run: `cd frontend && pnpm vitest run src/components/loot src/utils`
Expected: PASS.

```bash
git add frontend/src/components/loot/QueueWhy.tsx frontend/src/components/loot/QueueWhy.test.tsx frontend/src/components/loot/FloorCard.tsx frontend/src/components/loot/FloorCard.test.tsx frontend/src/components/loot/FloorDropRow.tsx
git commit -m "feat(loot): D3 queue rows consume the explanation leaf — QueueWhy popover (R-6, D-25)"
```

---

### Task 6: Release note + doc corrections + full gate run

**Files:**
- Modify: `frontend/src/data/releaseNotes.ts`
- Modify: `design/redesign/specs/phase-d-loot-design.md`
- Modify: `design/redesign/specs/phase-d-loot-plan.md`

- [ ] **Step 1: Release-note entry**

New entry at the TOP of `RELEASES`, copying the 2.1.7 (D2) entry's exact shape: `version: '2.1.8'`, current ISO date, `title: 'Phase D slice D3 — Need matrix + queue explanations (v2 preview)'`, one `improvement` item describing: the v2 Priority tab's new Matrix landing view (R-1/R-48) with roster-size Need column (R-11), floor-banded floor-coloured rows (R-8/R-9), cell-click → prefilled RecipientPicker (R-4), queue-row "why" popovers with reasons/warnings/score breakdown (R-6, D-25 restore incl. the adjustments-active line), and the empty-pool hint/pill ruling; `prTitle: 'feat(loot): Phase D slice D3 — v2 Need matrix + queue explanations'` (no `pr` yet — added at PR time per pr-checklist), `internal: true` as the LAST field. **`CURRENT_VERSION` stays `2.1.5`.**

- [ ] **Step 2: Design-record corrections (both ruled, both small)**

1. `phase-d-loot-design.md`, R-9 section (~153-159): append a ⚠ paragraph in the record's own convention: R-9's premise line ("the slots already sit in floor order") was false — legacy/mockup order was anatomical (`WhoNeedsItMatrix.tsx:57`); v2 rows band **F4→F1** (Weapon first, matching Queues' newest-first), **user-ruled 2026-07-30 at D3 build**, which is what makes the kept colours actually read as bands.
2. `phase-d-loot-plan.md:129`: the line "`CURRENT_VERSION` is `2.1.1` today." is stale (D0's public bump made it `2.1.5`) — rewrite to "`CURRENT_VERSION` tracks the latest public release (2.1.5 after D0); internal slices add entries without bumping it."

- [ ] **Step 3: Full gate run**

From `frontend/`, each to completion:

```bash
pnpm build                       # tsc -b && vite build
pnpm lint
pnpm check:design-system:strict
pnpm dupes
pnpm tokens:check
pnpm deadcode                    # compare against the main baseline captured pre-branch
pnpm test
```

Expected: all green; `pnpm deadcode` shows NO new dead exports vs the baseline (the slice adds exported symbols — `sortByPosition`, `materialNeedCount`, `hasAdjustments`, etc. — every one must have a real importer or be a type consumed across files; if knip flags one, wire or inline it, don't ignore it). Record the diff size: `git diff --stat main..HEAD | tail -1` — if materially over ~1,500 lines, STOP and report for the D3b split decision (boundary pre-declared in the header).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/data/releaseNotes.ts design/redesign/specs/phase-d-loot-design.md design/redesign/specs/phase-d-loot-plan.md
git commit -m "chore(release-notes): D3 internal entry + design-record corrections (R-9 ⚠, stale version note)"
```

---

## Self-review record

- **Spec coverage:** R-1 → T3; R-2/R-10/R-10.3 → T3; R-4 → T3 (props-level) + existing `RecipientPicker.test.tsx:840-889` (component-level); R-6 queue consumption → T5; R-8/R-9 → T1 (banding, user-ruled)/T2; R-11 → T1/T2; R-48 → net-new files + freeze list; kickoff 1 (D-25) → T4/T5 incl. M-1 restore-both; kickoff 2 → T5 `showWarnings`; kickoff 3 → T4 (m-1-corrected gate); D2 carry-forwards: type-test → T3 (M-4 pattern), a11y caption + sr-only cells → T2; two-part assert part (b) → PR body states "no §2.1 file touched; hunk enumeration empty"; DoD 4 knip baseline → Constraint 9 + T6; DoD 5 grep → no `FLOOR_COLORS` anywhere in new code; DoD 6 dupes → T2 step 5 + T6.
- **Director findings ledger:** B-1 ✅ (T1 doc + test 7 rewritten, impl unchanged) · B-2 ✅ (2.1.8/2.1.5, Constraint 11, T6) · M-1 ✅ restore-both (T4 picker line, T5 QueueWhy footer) · M-2 ✅ user-ruled F4→F1 + T6 record correction · M-3 ✅ (T3 step 1 repair plan + mock-props tests) · M-4 ✅ (type-test file, Button pattern) · M-5 ✅ (order-identity in recipientRanking.test.ts) · M-6 ✅ (header re-expressed, MATERIAL_TOKEN exported) · m-1 ✅ (hint-gated suppression + edit-mode test) · m-2 ✅ (score carried, lead line) · m-3 ✅ (doc headers in T4 Files) · m-4 ✅ (structural toRowEntries) · m-5 ✅ (sr-only cells, Tooltip content specified) · m-6 ✅ (Phase-P ledger disclosure, comment at the trigger) · m-7 ✅ (tokens:check + deadcode in T6; assert (b) in PR body) · m-8 ✅ (D3b boundary pre-declared; disclosure list in header; fractional formatting in ScoreBreakdown).
- **Type consistency:** `onLogGear` item `{slot,label,floorNumber}` (T2) matches T3's spread into `DropItemContext` (+`floorName`); `RecipientEntry` optional fields consistent T4→T5; `QueueWhy` props match T5's call site incl. `enhancedActive`; `toRowEntries` structural param accepts both `RecipientEntry[]` and `EnhancedPriorityEntry[]`; `FloorScope` from `./priorityScope` everywhere.

## After the tasks (primary session, not subagents)

1. Final whole-branch review: `redesign-reviewer` over `main..phase-d/d3-matrix`.
2. `xivrp-director` change-review (plan fidelity + V1 safety: `git diff --stat main..HEAD` shows only this plan's table; no §2.1 file).
3. Live browser validation (`?shell=v2`, DEVTST, desktop): matrix landing, pills + per-view defaults, cell → prefilled picker, why popover (check w-72 truncation), Adjusted tag + adjustments-active line, empty-pool hint without pill. **Known DEVTST limits (D2): no empty-needer slot and near-empty weaponPriorities — the D-36/pill ruling is demonstrated by unit test; SAY SO in the PR body rather than faking it.**
4. Screenshots embedded in the PR (copy out of scratchpad first), pr-checklist skill, PR (body carries the full disclosure list from the header), pr-review-loop. Merge always awaits the user.
