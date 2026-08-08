# Off-Hand Slot Support — Design

**Date:** 2026-08-08
**Origin:** User bug report (Discord, 2026-08-08): PLD gear sync shifts every accessory slot by one — shield stored as Earring, earring as Necklace, etc. Reporter also noted the shield is missing from Player Hub job comparison entirely.
**Status:** Approved by owner (rulings recorded below). Bugfix PR queued behind PR #236 merge.

---

## 1. Background & Root Cause

### The bug (active data corruption)

`TOMESTONE_GEAR_POSITION_SLOTS` (`backend/app/services/tomestone_provider.py`) maps Tomestone's positional gear list assuming a fixed 12-entry shape with **no off-hand position**:

```
[MainHand, Head, Body, Hands, Legs, Feet, Earrings, Necklace, Bracelets, Ring1, Ring2, SoulCrystal]
```

For a job with an off-hand equipped (PLD always), Tomestone's list contains the shield — screenshot evidence places it at position 6 (Lodestone display order: right column starts with off-hand after Feet). Every accessory then shifts by one:

| Position | Contains | Stored as |
|---|---|---|
| 6 | Shield | Earrings |
| 7 | Earrings | Necklace |
| 8 | Necklace | Bracelets |
| 9 | Bracelets | Ring1 |
| 10 | Ring1 | Ring2 |
| 11 | Ring2 | **dropped** (assumed Soul Crystal position) |

Six corrupted slots per sync. The existing Soul Crystal guard skips by `categoryName`; shields pass through. The test fixture that validated this shape (`backend/tests/test_lodestone.py`, `_TOMESTONE_REAL_SHAPE_PAYLOAD`) was built from a character without an off-hand, so the assumption was never exercised against a shield job.

**Blast radius:** manual web sync, auto-sync (safety gates don't catch it — job matches, and the shield's iLv *raises* the average), and Player Hub job syncs (`player.py` reuses the same pipeline). The Dalamud plugin is NOT affected (fixed in-game container indices, off-hand deliberately skipped). The Lodestone/XIVAPI name-keyed path is not affected.

### The model gap

The app has no off-hand concept anywhere: backend slot maps, xivgear/etro BiS import maps (`bis.py` — a PLD set's OffHand is silently dropped on import), the 11-slot frontend `GearSlot` model, and the plugin. A PLD's real gear is 12 pieces; the app tracks 11.

### Game research (verified 2026-08-08)

- **Every character has an off-hand equipment slot** (equipped-items container index 1, directly after main hand). At endgame, exactly one raid job uses it: **Paladin** (shield — full gear piece with VIT/STR/substats + block, counted in the game's average item level; the game's formula spans 13 slots, counting main-hand twice for jobs without an off-hand).
- **Legacy cases:** base classes (GLA/CNJ/THM) and WHM/BLM wearing ARR/HW-era one-handed wands can equip shields. Never part of endgame BiS, but sync can encounter it.
- **Out of scope:** Beastmaster (limited job — no savage), crafter/gatherer off-hand tools (not raid jobs).
- **Loot economy (key simplification):** since patch 6.2, sword + shield are bundled — a weapon coffer opened by a PLD grants both pieces in one drop. The shield is never an independent drop, so floor loot tables, priority weights, and loot-log flows need **no changes**. Off-hand is a *tracking* slot, not a *loot* slot.

---

## 2. Owner Rulings

1. **Display gating = data-driven, no setting.** The slot always exists in the model; the row renders when the job is in a hard-coded `OFFHAND_JOBS` list (`['PLD']`) **or** the slot has data (a BiS target or a synced item). Covers legacy shield syncs automatically; synced data is never invisible; zero settings surface.
2. **Both shells.** The V1 (legacy) player card gets the row too, as a data-correctness exception to the legacy freeze — real PLD users are on the default shell.
3. **Sequencing:** the Tomestone bugfix PR ships first, starting from `main` after PR #236 merges. The feature slice follows separately.

---

## 3. Deliverable 1 — Bugfix PR: Tomestone accessory-shift corruption

Small, independent, urgent. No model changes.

- **Step zero (verification):** capture the reporter's actual PLD payload (Lodestone ID 50121304; requires `TOMESTONE_API_TOKEN` re-enabled in dev `.env`) to confirm the off-hand's list position and whether non-shield jobs truly omit the entry (fixture evidence says yes: 12 entries, no off-hand).
- **Fix:** the parser detects whether the list contains an off-hand entry (scan for Shield-category item, mirroring the Soul Crystal guard) and applies the shifted position map when present. Skipping the shield alone is insufficient — all positions after it shift.
- **Behavior in this PR:** the shield entry is detected and **skipped** (not stored); accessories map to their correct slots. Corrupted players self-heal on their next sync.
- **Tests:** PLD-shaped positional payload fixture (13 entries with shield) alongside the existing no-off-hand fixture; assert correct accessory mapping and Ring2 retention.

## 4. Deliverable 2 — Feature slice: first-class `offhand` slot

### Model
- Add `'offhand'` to the `GearSlot` union and `GEAR_SLOTS` display order (immediately after `'weapon'`) in `frontend/src/types/index.ts`; mirror in backend constants.
- **No DB migration** — gear is a JSON column. The slot is normalized in (inserted when absent) wherever stored gear is read/synced: roster players (`SnapshotPlayer.gear`) and Player Hub snapshots (`PlayerGearSnapshot.gear`).

### Ingestion
- Tomestone positional parser: map the detected shield → `offhand` (upgrades Deliverable 1's skip).
- `LODESTONE_SLOT_MAP` (both copies — `lodestone.py` and `tomestone_provider.py`): add off-hand keys.
- BiS import (`bis.py`): xivgear `OffHand` → `offhand`; etro `offHand` → `offhand`. (Both silently dropped today.)

### Loot & math
- **Excluded** from `FLOOR_GEAR_DROPS`, `SLOT_VALUE_WEIGHTS`, upgrade-material maps, and loot-log slot pickers (bundled with weapon since 6.2).
- `hasItem`/`isAugmented` stay independent per slot — sync sets the shield's state. Auto-marking the shield when a PLD weapon drop is logged is a possible later nicety, explicitly out of scope.
- Average iLv includes the off-hand once equipped data exists.
- BiS-matched denominators change from hard-coded 11 to *count of slots with a BiS target configured* — PLD reads /12, all other jobs stay /11.

### Display (per ruling 1)
- `OFFHAND_JOBS = ['PLD']` lives in `frontend/src/gamedata/jobs.ts` beside `HEALER_TYPES`.
- Row renders on player cards in **both shells** when `job ∈ OFFHAND_JOBS` OR the slot has data (BiS target or equipped item). Hidden otherwise.

### Plugin follow-up (separate repo/release — XIVRaidPlannerPlugin)
- Map equipped-container index 1 → `offhand` in `GearsetService.GearsetSlotToSlotName` and `InventoryService.EquipSlotToGearSlot`.
- Backend PUT gear endpoint accepts the `offhand` slot name regardless, so older plugin versions keep working (they simply don't send it).

### Testing
- Sync fixtures (PLD Tomestone payload → correct 12-slot state), BiS import with OffHand entries, denominator math (PLD /12 vs others /11), card render gating (PLD shows row; non-off-hand job with synced shield data shows row; others hide it), normalization of legacy 11-slot stored gear.

---

## 5. Verify-in-game / open items

- Real PLD Tomestone payload shape (bugfix step zero).
- Tome vendor sword+shield bundling (same 6.2-era change; confirm the purchase is a single bundle and how solvent augmentation applies to the pair).
- Relic weapon pairing — the reporter's PLD runs a relic BiS (Phantom weapon); confirm how the relic shield is acquired/represented so the BiS-source tagging for `offhand` is sensible.

## 6. Explicitly out of scope

- Loot-priority participation for the off-hand (bundled drop — no independent priority).
- A settings toggle for off-hand visibility (ruled out; data-driven gating instead).
- Crafter/gatherer/limited-job off-hand support.
- Weapon-drop → shield auto-marking coupling.
