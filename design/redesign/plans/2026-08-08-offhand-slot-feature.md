# Off-Hand Slot Feature (Deliverable 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `offhand` a first-class gear slot — synced from Tomestone/Lodestone, importable from xivgear/etro, rendered on player cards in BOTH shells — gated data-driven (shown for `OFFHAND_JOBS` or when the slot has data), with zero impact on the loot economy.

**Spec:** `design/redesign/specs/2026-08-08-offhand-slot-design.md` §4 (Deliverable 2). Owner rulings: data-driven display, no settings toggle, both shells, loot untouched.

**Spec amendment (encode in the spec in this branch's first commit — director-approved, no owner ruling needed):** §4 "BiS-matched denominators" changes from *count of slots with a BiS target configured* to **relevant-slot count** — `gear` entries excluding an irrelevant `offhand` (irrelevant = job not in `OFFHAND_JOBS` AND the slot has no data). Rationale: configured-count would shrink existing `X/11` badges for any player with partially-configured BiS, changing displays the ruling never intended; the spec's premise ("hard-coded 11") was also false for V1, which already uses `player.gear.length`. Scope precisely: the amendment governs the two v2 constants (`RosterCard.tsx:92`, `GearBoard.tsx:46`) and V1's `gear.length` denominators (`PlayerCard.tsx:170-171`, `calculations.ts` completion). `LodestoneSearchModal.tsx:173-176` is ALREADY configured-count and already yields PLD +1 / others unchanged — zero changes there. The approved outcome (PLD /12, others /11) is unchanged, and holds only together with the read-projection in Task 4 (a stored 11-entry array must never render 12 rows against an 11 denominator).

**Director vet (2026-08-08): APPROVED-WITH-CHANGES — all findings incorporated below.** B-1 (frontend `|| 1` falsy-zero priority leak → explicit skips + frontend equality test), B-2/B-3 (avg-iLv pollution; `job` parameter threading), B-4 (read-projection in response builders), B-5 (`BOOK_TYPE_FOR_SLOT` numeric), B-6 (shield-skip tests flip; position-0 rule stated), B-7 (four `isWeapon` copies), R-1..R-6, doc-drift sweep, cut line.

**Architecture:** `'offhand'` joins the universal slot model (`GEAR_SLOTS`, minted into default gear with `bisSource: null` for every job); rendering, completion math, and denominators filter it through one shared relevance predicate. Backend lazily normalizes stored 11-entry gear on every read-for-merge path. Ingestion maps gain off-hand keys; the Tomestone parser upgrades its shield-skip to a mapping. Loot/cost tables gain **inert** off-hand entries (0-cost/0-weight) plus explicit call-site skips — the shield is bundled with the weapon since patch 6.2 and never drops or gets purchased independently.

**Tech Stack:** React 19 + TS (frontend), FastAPI (backend), vitest + pytest.

## Global Constraints

- **NEVER add AI attribution to commits or PRs.** Absolute repo rule.
- Branch: `feat/offhand-slot` off `main` (after the `fix/v1-loot-edit-bugs` PR merges — it touches `tomestone_provider.py`'s neighborhood and `test_lodestone.py`).
- Every commit must stay green: the pre-commit hook runs whole-project `tsc -b` on staged frontend TS.
- `src/components/roster/**`, `src/components/ui/**`, `src/components/primitives/**` are under the **strict** design-lint ratchet (`error`); `src/components/player/**` and `profile/**` are legacy warn-level. No raw elements, no arbitrary colors, `text-xs`+ floor.
- Loot-domain sets stay untouched: `VALID_AUGMENT_SLOTS`, `VALID_SLOTS` (weekly assignments), `FLOOR_LOOT_TABLES`/`FLOOR_GEAR_DROPS`, `UPGRADE_MATERIAL_SLOTS` (both language copies), `WhoNeedsItMatrix.tsx:57`, every loot modal slot picker (they derive from closed loot tables — Task 9 asserts this).
- Release note: public, `pr`/`prTitle`, `CURRENT_VERSION` bump — via the `pr-checklist` skill at PR time. UI change ⇒ **screenshots required in the PR** (both shells; light+dark for the V1 door since tokens aren't touched, dark at minimum for v2).
- Verified payload facts (do not re-derive): shield job = 13-entry Tomestone list, off-hand inserted at position 6, `categoryId: 11` (= FFXIV `ItemUICategory` "Shield"); non-shield job = 12 entries, off-hand omitted entirely; sword+shield drop bundled since 6.2.

---

### Task 1: Frontend substrate — type, lists, records, relevance predicate

**Files:**
- Modify: `frontend/src/types/index.ts` (:12 union, :470 `GEAR_SLOTS`, :485 `GEAR_SLOT_NAMES`, :502 `GEAR_SLOT_ICONS`, :518 `GEAR_SLOT_FILLED_ICONS`)
- Modify: `frontend/src/gamedata/costs.ts` (4 `Record<GearSlot, number|string>` tables)
- Modify: `frontend/src/gamedata/jobs.ts` (add `OFFHAND_JOBS`)
- Create: `frontend/src/utils/offhand.ts` (relevance predicate + relevant-gear filter)
- Test: `frontend/src/utils/offhand.test.ts`

**Interfaces (produced — later tasks consume these exact names):**
```ts
// gamedata/jobs.ts — beside HEALER_TYPES
/** Jobs whose kit includes an off-hand item (endgame: PLD's shield). */
export const OFFHAND_JOBS: ReadonlySet<string> = new Set(['PLD']);

// utils/offhand.ts
import { OFFHAND_JOBS } from '../gamedata/jobs';
import type { GearSlotStatus } from '../types';

/** True when the offhand slot entry carries any real data. */
export function offhandSlotHasData(slot: GearSlotStatus | undefined): boolean {
  if (!slot) return false;
  return Boolean(
    slot.bisSource || slot.hasItem || slot.isAugmented ||
    slot.itemId || slot.itemName || slot.equippedItemId || slot.equippedItemName
  );
}

/** Data-driven display ruling: job uses an off-hand OR the slot has data. */
export function isOffhandRelevant(job: string | undefined, gear: GearSlotStatus[]): boolean {
  // Case-normalize: backend job validation circulates lowercase ("pld").
  if (job && OFFHAND_JOBS.has(job.toUpperCase())) return true;
  return offhandSlotHasData(gear.find((g) => g.slot === 'offhand'));
}

/** Gear entries minus an irrelevant offhand — THE denominator/completion basis. */
export function relevantGear(job: string | undefined, gear: GearSlotStatus[]): GearSlotStatus[] {
  if (isOffhandRelevant(job, gear)) return gear;
  return gear.filter((g) => g.slot !== 'offhand');
}
```

- [ ] **Step 1: types/index.ts** — add `| 'offhand'` to the `GearSlot` union directly after `'weapon'`; insert `'offhand'` into `GEAR_SLOTS` after `'weapon'`; add `offhand: 'Off Hand'` to `GEAR_SLOT_NAMES`; add `offhand: '/images/gear-slots/white/offhand.png'` to `GEAR_SLOT_ICONS` and the filled equivalent to `GEAR_SLOT_FILLED_ICONS` (asset arrives in Task 2 — path is fixed here).
- [ ] **Step 2: costs.ts** — add inert entries to keep the `Record<GearSlot, …>` types total WITHOUT loosening to `Partial` (the 6 direct index sites at `costs.ts:89,97`, `calculations.ts:237-238`, `priority.ts:211,305,576` stay safe): `BOOK_COSTS: { …, offhand: 0 }`, `TOMESTONE_COSTS: { …, offhand: 0 }`, `SLOT_VALUE_WEIGHTS: { …, offhand: 0 }`, `BOOK_TYPE_FOR_SLOT: { …, offhand: 4 }` (**numeric** — the record is `Record<GearSlot, FloorNumber>` where `FloorNumber = 1|2|3|4`; re-verify all four value types at implementation time). Comment each: `// bundled with weapon since 6.2 — no independent cost/priority`. ⚠ **The inert 0 weight is NOT sufficient on the frontend** — `priority.ts:211`/`:305` compute `SLOT_VALUE_WEIGHTS[g.slot] || 1` and `0 || 1 === 1`, so a minted incomplete off-hand would add +1 weighted need for every player (and shift PLD ordering relative to peers). Task 3 adds the explicit skips; do not rely on the 0 alone, and do NOT change `||` to `??` (the next zero-weight slot would re-break it).
- [ ] **Step 3: jobs.ts + utils/offhand.ts** — as in the Interfaces block above.
- [ ] **Step 4: tests** — `offhand.test.ts`: PLD job → relevant even with empty slot; non-PLD + empty slot → irrelevant and `relevantGear` drops it; non-PLD + any data field (each of bisSource/hasItem/equippedItemId/itemName individually) → relevant; missing offhand entry entirely → `relevantGear` returns input unchanged.
- [ ] **Step 5:** `pnpm build` (expect compile errors ONLY where `Record<GearSlot,…>` totality bites — fix ALL by adding offhand keys, never by loosening types; `gearDefaults.ts getDefaultBisSource` has a `default:` arm returning null, confirm offhand falls into it). `pnpm vitest run src/utils/offhand.test.ts`. Commit: `feat(gear): offhand joins the slot model — types, inert cost entries, relevance predicate`.

### Task 2: Off-hand icon assets

**Files:**
- Create: `frontend/public/images/gear-slots/white/offhand.png` (+ the filled-variant directory used by `GEAR_SLOT_FILLED_ICONS` — mirror where the other 11 live)

- [ ] **Step 1:** Read `frontend/scripts/colorize-gear-icons.py` to learn the pipeline the existing icons used. **Corrected premises (R-2):** only `public/images/gear-slots/white/` needs a real file (it holds 10 PNGs today — `ring.png` serves both rings); `GEAR_SLOT_FILLED_ICONS` values are REMOTE `https://xivapi.com/i/060000/*.png` URLs, so the offhand filled entry is just the URL `https://xivapi.com/i/060000/060110.png` — no local filled asset.
- [ ] **Step 2:** Source the shield glyph (ItemUICategory-11 icon, `https://xivapi.com/i/060000/060110.png`, verified this workstream) and produce `white/offhand.png`. ⚠ `GearSlotIcon.tsx:39-41,55-56` consumes it as a **CSS mask** — the file must be a clean alpha silhouette (transparent background, opaque glyph), not merely white-on-transparent that looks right in an `<img>`. Match the alpha treatment of the existing 10 by inspecting one (e.g. `head.png`) with PIL.
- [ ] **Step 3:** Visual sanity in the running app once Task 6 wires a row (mask renders in both themes). Commit: `feat(gear): off-hand slot icon asset`.

### Task 3: Frontend math — completion, priority skips, avg-iLv, cost-loop guards

**Files:**
- Modify: `frontend/src/utils/calculations.ts` (:174 `calculatePlayerCompletion`, :262-291 `calculateTeamSummary`, :208 materials loop, :237-240 books loop, :451 `calculateAverageItemLevel`, :464/:494 `isWeapon` iLv inference)
- Modify: `frontend/src/utils/priority.ts` (:210/:304 weighted-need filters — **B-1, the loot-untouched linchpin**)
- Modify: `frontend/src/utils/rosterReadiness.ts` (:46 `bisCompleteCount`'s `gear.every` — switch to `relevantGear`; `rosterAvgIlv` :29-31 verified untouched — filters on `equippedItemLevel ?? itemLevel`)
- Modify: `frontend/src/components/player/PlayerCardHeader.tsx` (:32-36 `getSlotItemLevel` — the 4th `isWeapon` copy)
- Test: `frontend/src/utils/calculations.test.ts`, `frontend/src/utils/priority.test.ts` (extend existing)

**Interfaces:** consumes Task 1's `relevantGear`/`isOffhandRelevant`. **Signature changes (B-3):** `calculatePlayerCompletion(gear: GearSlotStatus[], job?: string)` and `calculateAverageItemLevel(gear, tierId, job?: string)` gain an optional trailing `job` — callers thread it: `TeamSummaryEnhanced.tsx:222` (completion), `PlayerCardHeader.tsx:129`, `RosterCard.tsx:485`, `GearBoard.tsx:156` (avg-iLv); grep for any other callers and thread all. When `job` is undefined, `relevantGear` still drops a NO-DATA offhand (predicate needs no job for the has-data arm), so untouched callers stay correct.

- [ ] **Step 1: failing tests**
  - Completion: non-PLD with a minted empty offhand → denominator 11 (not 12); PLD → 12.
  - **Priority equality (B-1, frontend twin of Task 4's backend test):** `calculatePriorityScore` over an 8-player roster produces IDENTICAL scores and ordering with and without minted offhand entries, across all three priority modes. RED first: pre-fix, the `|| 1` leak makes this fail — paste the failure.
  - **Avg-iLv (B-2):** a non-PLD's minted offhand (no item, no bisSource) contributes NOTHING to `calculateAverageItemLevel` — no phantom "crafted" 12th slot, no weapon bonus. A PLD offhand WITH data prices on the WEAPON ladder (795/790/785).
  - Materials/books: PLD offhand `bisSource:'tome', hasItem:true, isAugmented:false` contributes nothing (no solvent, **no `getUpgradeMaterialForSlot` throw**); `bisSource:'raid', hasItem:false` adds NO books/tomestones.
- [ ] **Step 2: implement** — completion/team-summary/avg-iLv operate on `relevantGear(job, gear)`; `priority.ts:210`/`:304` filters gain `g.slot !== 'offhand'` explicitly; materials loop (`:208` region) and books loop (`:237-240`) get `if (slot.slot === 'offhand') continue;` FIRST; all FOUR `isWeapon` copies become weapon-or-offhand (`calculations.ts:464`, `:494`, `PlayerCardHeader.tsx:36`, `NowVsBisPanel.tsx:31` — the last lands in Task 7 but is listed here for the enumeration); `rosterReadiness.ts:46` uses `relevantGear`.
- [ ] **Step 3:** run the suites + full `pnpm test`. Commit: `feat(gear): completion/priority/iLv math treat offhand as bundled and relevance-gated`.

### Task 4: Backend substrate — defaults, lazy normalization, priority skip

**Files:**
- Modify: `backend/app/constants.py` (:20 `DEFAULT_GEAR_SLOTS`, :47 `create_default_gear`)
- Modify: `backend/app/routers/lodestone.py` (:1150 `_normalize_player_gear`)
- Modify: `backend/app/routers/tiers.py` (:1112-1131 BiS-claim merge, :1141-1159 snapshot merge)
- Modify: `backend/app/routers/player.py` (:268-291 `_propagate_gear_to_rosters`)
- Modify: `backend/app/services/priority_calculator.py` (:31 weights + the `.get(…, 1)` default at :309-315)
- Test: `backend/tests/test_lodestone.py`, `backend/tests/test_priority.py`

**Interfaces (produced):**
```python
# constants.py
DEFAULT_GEAR_SLOTS = ["weapon", "offhand", "head", ...]  # offhand second

def ensure_offhand_slot(gear: list) -> list:
    """Lazily add the offhand entry to stored 11-slot gear (bisSource None).

    Stored player gear predating the offhand slot never gains entries from
    sync (sync iterates the STORED list) — normalize here so every
    read-for-merge path sees 12 slots. Idempotent; preserves order (offhand
    inserted after weapon when possible, else appended).
    """
```
- `create_default_gear()` gives offhand `{"slot": "offhand", "bisSource": None, "hasItem": False, "isAugmented": False}` — **not** the blanket `"raid"` the other slots get (a default raid shield target for 19 non-shield jobs would be a phantom).

- [ ] **Step 1: failing tests** — `_normalize_player_gear` on a legacy 11-entry list returns 12 with offhand after weapon, `bisSource is None`; idempotent on 12; tolerates `[]` and JSON-string input (existing behaviors pinned). **Read-projection (B-4):** `GET` a player whose STORED gear is a legacy 11-entry array → the response carries 12 slots (offhand `bisSource: null`) WITHOUT a DB write; same for the plugin's gear read. Priority: `calculate_priority_score` on a player dict with the offhand entry equals the same dict without it (role-based mode is the only gear-summing mode — `priority_calculator.py:311-315`; state that in the test docstring).
- [ ] **Step 2: implement** — `ensure_offhand_slot` in constants.py; call it (a) at the tail of `_normalize_player_gear` (covers `gear_sync.py:104` + `lodestone.py:1620` free), (b) at the top of the three merge loops over stored gear: `tiers.py:1115`, `tiers.py:1144`, `player.py:272`, and (c) **as a read-only projection in the response builders — `tiers.py:170` (`player_to_response`) and `tiers.py:871` (`get_player_gear`, the plugin's read)** — so every client always sees 12 slots while persistence stays on write paths. Without (c), existing PLDs keep 11-entry arrays until their next sync and: V1's `GearTable.tsx:474-479` synthesizes the missing row with `bisSource: 'raid'` (a phantom raid shield target), editing that row is a silent no-op (`computeGearSlotUpdate` maps existing entries only — `calculations.ts:137`), and the ring reads x/11 under 12 rendered rows. `create_default_gear`/`create_default_gear_ring2_tome` mint the None-source offhand. Priority: add `"offhand": 0.0` to the py `SLOT_VALUE_WEIGHTS` (the `.get(slot, 1)` default is safe backend-side — explicit 0.0 wins; the frontend `|| 1` twin is Task 3's B-1).
- [ ] **Step 3:** full `python -m pytest tests/test_lodestone.py tests/test_priority.py`, then whole suite. **Expect `test_gear_sync_safety.py`'s NINE 11-slot fixture lists (:46,182,206,317,349,607,637,663) to break on length-sensitive asserts** — update to the normalized 12th slot (mechanical; keep every behavioral assertion). Also record (R-3, verified by director): the plugin's `BuildGearUpdate` iterates the SERVER's gear list (`InventoryService.cs:257-306`), so 12 slots round-trip through `tiers.py:996`'s wholesale gear replace safely; older plugin builds cannot destroy the offhand entry. Commit: `feat(gear): backend offhand substrate — default gear, lazy normalization + read projection, zero loot weight`.

### Task 5: Backend ingestion — sync maps, import maps, diagnostics exemption

**Files:**
- Modify: `backend/app/services/tomestone_provider.py` (:79 skip set, :68 category map, :84 name map, :32 alias map, comment at :59-67)
- Modify: `backend/app/routers/lodestone.py` (:51 `LODESTONE_SLOT_MAP`, :417 `classify_current_source`)
- Modify: `backend/app/services/gear_sync.py` (:238-242 missing-slot accounting)
- Modify: `backend/app/routers/bis.py` (:121/:136 import maps, :657-704 `determine_source`, :857-900 xivgear build, :1105-1167 etro loop)
- Modify: `backend/app/routers/bis_targets.py` (:381-427 duplicated etro loop)
- Test: `backend/tests/test_lodestone.py`, `backend/tests/test_bis_xivgear_import.py`

- [ ] **Step 0 (R-4): verify the external slot keys LIVE before writing any map** — fetch one public PLD sheet from xivgear and one from etro; confirm the off-hand key spelling (`"OffHand"` / `"offHand"` are asserted, not verified — the Tomestone facts got live verification, these must too). Record the captured key names in the commit message.
- [ ] **Step 1: failing tests**
  - Tomestone: the existing 13-entry PLD fixture now yields `gear["OffHand"]["ID"] == 49679` (Kite Shield); the accessory-slot assertions from the bugfix PR still hold; `len(gear) == 12`. **THREE assertions from the bugfix PR encode the old skip and must FLIP (B-6):** `test_lodestone.py:1455` and `:1466` (`all(slot["ID"] != 49679 …)` → the shield now appears exactly once, in `OffHand`), and `test_tomestone_shield_at_position_zero_is_skipped` (:1502-1505). **Position-0 rule:** with category 11 now a KNOWN mapped category, the `is_known_gear_category` guard means a shield at position 0 maps to **OffHand** (not MainHand, not skipped) — rewrite that test to pin exactly this.
  - Lodestone name-keyed path: a `GearSet.Gear` dict containing an `"OffHand"` key lands in the `offhand` slot.
  - `classify_current_source("offhand", 795, …)` classifies on the WEAPON iLv ladder (a 795 shield = savage-track, not crafted).
  - Missing-slot protection: a non-shield sync (no upstream offhand) does NOT increment `missing_slot_count` for offhand and emits no `missing_upstream_slots` warning; a genuinely missing HEAD still does.
  - xivgear import: a PLD payload with an `OffHand` item maps it to `offhand`; a non-shield payload WITHOUT one produces an offhand entry with `source=None`/no placeholder — **assert no `source: "raid"` phantom** (`bis.py:898` placeholder emission must special-case offhand). Mirror for etro in BOTH copies (`bis.py` + `bis_targets.py` — they are duplicated loops; a fix in one is not a fix in the other).
- [ ] **Step 2: implement** — remove `11` from `TOMESTONE_SKIPPED_CATEGORY_IDS` (keep 62), add `11: "OffHand"` to `TOMESTONE_CATEGORY_SLOTS` and `"shield": "OffHand"` to the name-fallback map; refresh the stale comment block. `LODESTONE_SLOT_MAP` (+ the alias copy in tomestone_provider :32) gain offhand keys. `classify_current_source` and `determine_source`: offhand joins the `weapon` ladder branch. `gear_sync.py:238`: `if not equipped and slot_name != "offhand"` for the counter (the clear-on-manual-sync behavior for a truly absent offhand is correct and stays). Import loops: map the slot; skip the empty-slot placeholder for offhand only.
- [ ] **Step 3:** full backend suite. Commit: `feat(gear): offhand flows through Tomestone/Lodestone sync and xivgear/etro import`.

### Task 6: V1 card surfaces (data-correctness exception to the freeze — user-ruled)

**Files:**
- Modify: `frontend/src/components/player/GearTable.tsx` (:630 rows loop, :540/:539 compact `grid-cols-11` branch)
- Modify: `frontend/src/components/player/PlayerCardGear.tsx` (:17 `SLOT_ORDER`, :87 loop)
- Modify: `frontend/src/components/player/PlayerCard.tsx` (:170-171 denominators)
- Modify: `frontend/src/components/player/PlayerCardHeader.tsx` (:448/:481 tooltip loops, :426 ring max)
- Test: **Create `frontend/src/components/player/GearTable.test.tsx` (R-5 — it does not exist).** V1 is the default shell; the row, the gate, and the `grid-cols-12` branch get a real test file, not just the browser pass.

- [ ] **Step 1: failing tests** — render a PLD player: GearTable shows an "Off Hand" row directly under Weapon; render a non-PLD with empty minted offhand: NO row, ring reads `x/11`; non-PLD whose offhand has synced data: row appears.
- [ ] **Step 2: implement** — in each `GEAR_SLOTS`-driven loop: `if (slot === 'offhand' && !isOffhandRelevant(player.job, player.gear)) return null;` (GearTable `:630`, PlayerCardHeader `:448`/`:481`; PlayerCardGear switches its private `SLOT_ORDER` to `GEAR_SLOTS` and applies the same gate — deleting the duplicate list). GearTable renders offhand as a NORMAL slot row (`SlotRow`, not `WeaponSlotRow` — no tome sub-row mechanics). Compact branch: `grid-cols-11` → conditional `grid-cols-12` when relevant (both literals exist as class strings — Tailwind needs them statically, so write the ternary with both full class names). `PlayerCard.tsx:170-171`: `const rGear = relevantGear(player.job, player.gear); completedSlots = rGear.filter(isSlotComplete).length; totalSlots = rGear.length;`.
- [ ] **Step 3:** run affected suites (`GroupViewContent.gearSlot.test.tsx` guards the row-id contract — offhand row gets `gear-row-${playerId}-offhand` for free; assert no loot-jump affordance points at it). Commit: `feat(gear): V1 card renders the off-hand row (data-driven) — ruled freeze exception`.

### Task 7: V2 card surfaces (strict lint area)

**Files:**
- Modify: `frontend/src/components/roster/RosterGearTable.tsx` (:106 props — add `job?: string`; :221 loop; :222-227 synthesized fallback)
- Modify: `frontend/src/components/roster/RosterCard.tsx` (:92 `TOTAL_SLOTS`, :477-478, :945 badge, :1039-1084 pip strip, pass `job` to `RosterGearTable`)
- Modify: `frontend/src/components/roster/GearBoard.tsx` (:41 `SLOT_ORDER`, :45 `SLOT_HEADS`, :46 `TOTAL`, :139/:167 `colSpan`, :188-195 per-row summary)
- Modify: `frontend/src/components/roster/NowVsBisPanel.tsx` (:30 iLv special-case, :66 loop)
- Test: `frontend/src/components/roster/RosterCard.test.tsx`, `GearBoard.test.tsx`

- [ ] **Step 1: failing tests** — RosterCard expanded (PLD): off-hand row after weapon with a plain `BiSSourceSelector` (NEVER `WeaponBiSSelector` — that leaf hard-codes the fixed-R+tome story); badge `x/12`. Non-PLD: no row, badge `x/11`, pip strip 11 pips. GearBoard: roster of 8 non-PLD → 11 columns exactly as today (byte-stable snapshot if one exists); roster containing a PLD → 12 columns, non-PLD cells in the offhand column render the `null` branch, `colSpan` tracks.
- [ ] **Step 2: implement** — `RosterGearTable`: new optional `job` prop; loop gate identical to Task 6's; offhand row uses the always-returned-Fragment pattern (`:475-479` comment — remount/focus rule) but with NO sub-row. `RosterCard`: delete `TOTAL_SLOTS`; denominators via `relevantGear`; pip strip iterates `relevantGear(player.job, player.gear)`. `GearBoard`: `SLOT_ORDER`/`SLOT_HEADS`/`TOTAL` become derived — `const showOffhand = players.some(p => isOffhandRelevant(p.job, p.gear)); const slotOrder = showOffhand ? WITH_OFFHAND : BASE;` (build the two arrays from `GEAR_SLOTS` + the gate, deleting the third hand-rolled copy); per-row summary denominator = that player's `relevantGear` length. `NowVsBisPanel:30`: offhand joins the weapon iLv category; `:66` loop gets the gate.
- [ ] **Step 3:** strict-lint check (`pnpm lint` — zero NEW errors in roster/), suites, commit: `feat(gear): v2 roster surfaces render the off-hand slot data-driven`.

### Task 8: Player Hub labels + full-suite sweep

**Files:**
- Modify: `frontend/src/components/profile/JobProfileCard.tsx` (:26) and `frontend/src/components/profile/GearSnapshotView.tsx` (:13) — add `offhand: 'Off Hand'` to BOTH duplicated `SLOT_LABELS` maps (do not refactor the duplication in this PR)
- Modify: any test from the recon's baked-11 list still red: `GearBoard.test.tsx:6,34`, `RosterCard.test.tsx:79,149,865,942`, `needMatrixData.test.ts:15-17` (the last must stay 10-slot — it pins loot-table derivation, only touch if the suite says so)

- [ ] **Step 1:** add the two label keys (the Hub renders snapshot-driven rows — the backend's normalized 12th entry appears automatically; empty for non-PLD is acceptable here per the data-driven ruling since Hub rows are `snapshot.gear`-driven and the backend mints `bisSource: None`... **verify**: if empty offhand rows clutter non-PLD hub cards, apply the same `isOffhandRelevant` gate — job is available as `snapshot.job`).
- [ ] **Step 2 (doc drift):** `frontend/src/pages/GearMathDocs.tsx:1092,1375,1395,1415` renders the literal source of `TOMESTONE_COSTS`/`SLOT_VALUE_WEIGHTS`/`BOOK_COSTS` as in-app documentation, and `:461` shows the `|| 1` weighted-need expression — update all five to match Task 1/Task 3's real code (stale in-app docs are exactly the drift class this build line polices).
- [ ] **Step 3 (pin, from the vet):** `rosterLedgerJumps.ts:96` now iterates offhand — benign by construction (no loot entry can carry `itemSlot: 'offhand'`, no material entry `slotAugmented: 'offhand'`, given the untouched validation sets), but add the pin: `targets['offhand']` is never populated. Also note `WhoNeedsItMatrix`'s `getFloorForSlot` throw site (`loot-tables.ts:96`) stays unreachable from offhand only because its hand-rolled 10-slot list is untouched — leave a comment on `GEAR_SLOT_ORDER` saying so.
- [ ] **Step 4:** `pnpm build && pnpm lint && pnpm test` + `python -m pytest` — full green. Commit: `feat(gear): player hub labels, doc sync + suite sweep for the off-hand slot`.

### Task 9: Loot-exclusion assertion tests (the "untouched" proof)

**Files:**
- Test: `frontend/src/components/loot/needMatrixData.test.ts` (extend), `backend/tests/test_priority.py` (extend), one new frontend test file if needed

- [ ] **Step 1:** add the explicit exclusion pins: NeedMatrix gear rows for every floor contain no `offhand`; `AddLootEntryModal`/`LogMaterialModal`/`QuickLogMaterialModal` slot pickers offer no Off Hand option when rendering a PLD recipient with a fully-relevant offhand (fixture PLD with offhand bisSource raid + shield equipped); backend: material-log create with `slotAugmented: "offhand"` is rejected/ignored exactly like any invalid slot (pins `VALID_AUGMENT_SLOTS` untouched); priority scores byte-identical with/without offhand entries (Task 4's test — extend to a full 8-player roster if cheap).
- [ ] **Step 2:** run, commit: `test(gear): pin the off-hand loot-economy exclusion`.

### Task 10: Browser validation, screenshots, release note, PR

- [ ] **Step 1:** backend + frontend dev servers as background tasks (memory: dev.ps1 can't launch frontend; start both as bg tasks); dev-auth `/api/dev-auth/login/0` → DEVTST.
- [ ] **Step 2:** DEVTST has no PLD — set one roster player's job to PLD (or use an existing tank card), sync/import to light the row up. Validate BOTH shells: V1 card (row under weapon, ring x/12, tooltip shows off-hand), v2 expanded + compact + Board (column logic), Hub if a snapshot exists. Light + dark screenshots per the PR-screenshots rule; copy OUT of session scratchpad into `docs/redesign/pr-shots/`.
- [ ] **Step 3:** `pr-checklist` skill → public release-note entry (next version above the V1-bugs PR's), `CURRENT_VERSION` bump.
- [ ] **Step 4:** push, `gh pr create` (body: spec link, the spec amendment note, screenshots, loot-exclusion proof pointer), watch CI, verify real review comments exist, `pr-review-loop` to green. **Merge awaits the user.**

---

## Overrun cut line (director-prescribed — use ONLY if the PR exceeds budget)

The split is NOT backend/frontend — backend-first alone is the corruption case (the instant the backend mints a 12th entry, V1's `PlayerCard.tsx:171` reads x/12 for every job, 1,389 users, no UI change needed to trigger). The only safe cut:
- **PR 1 (inert):** Tasks 1,2,3,5,6,7,8,9 — all display/math/ingestion plumbing, `ensure_offhand_slot` DEFINED but called nowhere, `create_default_gear` unchanged. No stored array gains an entry; every denominator byte-identical; PLD ingestion is the only offhand-data source (UI already handles it). Must contain the B-1 and B-2 fixes.
- **PR 2 (the flip):** wire `ensure_offhand_slot` into the write paths + the two response projections, and mint the None-source slot in the default-gear factories.

## Self-review notes (post-director-vet)

- **Spec coverage:** §4 model ✓ (T1/T4), ingestion ✓ (T5 + live key verification), loot exclusion ✓ (inert entries T1 + explicit priority/materials/books skips T3 + pins T9 + frontend equality test), math ✓ (T3 incl. avg-iLv gating and all four `isWeapon` copies), display ruling ✓ (T6/T7 + read-projection T4 keeping rows and denominators consistent), Hub ✓ (T8), plugin follow-up explicitly out (separate repo; round-trip safety recorded in T4).
- **All 7 director blocking findings incorporated:** B-1 (T1 warning + T3 skips + equality tests), B-2/B-3 (T3 job-threading), B-4 (T4 response-builder projection), B-5 (T1 numeric), B-6 (T5 test flips + position-0 rule), B-7 (T3 enumeration). R-1..R-6 landed in T1/T2/T4/T5/T6 + anchors corrected throughout.
- **The two recon-flagged crashes** (`getUpgradeMaterialForSlot` throw via `calculations.ts:208`; books tally corruption at `:237`) closed by T3's explicit skips, tested RED-first.
- **The import phantom** (`source: "raid"` placeholder for 19 jobs) closed in T5 with a both-copies etro reminder; its read-path twin (`GearTable.tsx:474` synthesis) closed by T4's projection.
- **Type totality:** all 7 `Record<GearSlot,…>` sites get keys in T1; no `Partial` loosening anywhere.
