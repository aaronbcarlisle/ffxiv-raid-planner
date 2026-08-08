# Tomestone Off-Hand Accessory-Shift Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the Tomestone gear sync from shifting every accessory slot by one for shield-wearing jobs (PLD), which currently stores the shield as the Earring, the earring as the Necklace, etc., and silently drops Ring2.

**Architecture:** Replace the fixed-position mapping in `_normalize_tomestone_gear_list` (`backend/app/services/tomestone_provider.py`) with category-driven classification. Verified live against Tomestone's API (2026-08-08): non-shield jobs get a 12-entry list with the off-hand omitted entirely; shield jobs get 13 entries with the shield inserted at position 6 (`categoryId: 11`). Every entry carries `categoryId`/`categoryName`, so classifying by category is order-independent and immune to insertions/omissions. The shield is detected and **skipped** in this PR (the planner has no off-hand slot yet — that's Deliverable 2 of the spec).

**Tech Stack:** Python/FastAPI backend; pytest. One frontend file touched (`releaseNotes.ts`).

**Spec:** `design/redesign/specs/2026-08-08-offhand-slot-design.md` (Deliverable 1).

## Global Constraints

- **NEVER add AI attribution to commits or PRs** (no Co-Authored-By, no "Generated with", no session links). Absolute repo rule.
- Branch: `fix/tomestone-offhand-shift` (already created off `main`, spec + this plan committed on it).
- Release notes: this is a user-facing bugfix → **public** entry in `frontend/src/data/releaseNotes.ts` under the `CURRENT_VERSION` rules. Invoke the `pr-checklist` skill before opening the PR — it carries the exact entry format (`pr`/`prTitle` over `commits`).
- `pnpm build` (which runs `tsc -b`) must pass before push — `tsc --noEmit` is NOT equivalent.
- Backend tests: `cd backend && python -m pytest tests/test_lodestone.py -v` (full file), `python -m pytest` for the suite.
- No screenshots needed in the PR (backend fix; no UI change).

---

### Task 1: Category-driven gear-list normalization

**Files:**
- Modify: `backend/app/services/tomestone_provider.py` (replace `TOMESTONE_GEAR_POSITION_SLOTS` + rewrite `_normalize_tomestone_gear_list`, lines ~59-74 and ~418-457)
- Test: `backend/tests/test_lodestone.py` (add PLD fixture + tests near the existing `_TOMESTONE_REAL_SHAPE_PAYLOAD` section, ~line 1303+)

**Interfaces:**
- Consumes: existing `_coerce_int`, `tomestone_profile_to_xivapi_payload` (unchanged signature).
- Produces: `_normalize_tomestone_gear_list(gear_list: list) -> dict[str, dict]` — same signature and return shape as today (keys `MainHand`/`Head`/.../`Ring2`, values `{"ID", "Icon"?, "Name"?, "ItemLevel"?}`). New module constants `TOMESTONE_CATEGORY_SLOTS`, `TOMESTONE_RING_CATEGORY_ID`, `TOMESTONE_SKIPPED_CATEGORY_IDS`, `TOMESTONE_CATEGORY_NAME_SLOTS`. `TOMESTONE_GEAR_POSITION_SLOTS` is **deleted**.

- [ ] **Step 1: Add the PLD fixture and failing tests**

Add to `backend/tests/test_lodestone.py`, after the existing `_TOMESTONE_REAL_SHAPE_PAYLOAD` tests. This fixture is a **real captured payload** (Lodestone 50121304, captured 2026-08-08) — 13 entries, shield at position 6:

```python
# Real PLD payload shape (captured 2026-08-08, Lodestone 50121304): shield jobs
# get a 13-entry list with the off-hand INSERTED at position 6. The old
# fixed-position map shifted every accessory by one (shield stored as Earring,
# Ring2 dropped). Non-shield jobs omit the off-hand entry entirely (12 entries).
_TOMESTONE_PLD_SHIELD_GEAR_LIST = [
    # 0 MainHand
    {"item": {"id": 49658, "name": "Grand Champion's Falchion", "itemLevel": 795, "icon": "https://assets.tomestone.gg/i/030000/030700_hr1.png", "categoryName": "Gladiator's Arm", "categoryId": 2}},
    # 1 Head
    {"item": {"id": 49680, "name": "Grand Champion's Headgear of Fending", "itemLevel": 790, "icon": "https://assets.tomestone.gg/i/056000/056902_hr1.png", "categoryName": "Head", "categoryId": 34}},
    # 2 Body
    {"item": {"id": 49604, "name": "Augmented Bygone Brass Coat of Fending", "itemLevel": 790, "icon": "https://assets.tomestone.gg/i/057000/057337_hr1.png", "categoryName": "Body", "categoryId": 35}},
    # 3 Hands
    {"item": {"id": 49682, "name": "Grand Champion's Gloves of Fending", "itemLevel": 790, "icon": "https://assets.tomestone.gg/i/056000/056411_hr1.png", "categoryName": "Hands", "categoryId": 37}},
    # 4 Legs
    {"item": {"id": 49683, "name": "Grand Champion's Breeches of Fending", "itemLevel": 790, "icon": "https://assets.tomestone.gg/i/057000/057430_hr1.png", "categoryName": "Legs", "categoryId": 36}},
    # 5 Feet
    {"item": {"id": 49607, "name": "Augmented Bygone Brass Greaves of Fending", "itemLevel": 790, "icon": "https://assets.tomestone.gg/i/057000/057930_hr1.png", "categoryName": "Feet", "categoryId": 38}},
    # 6 OFF-HAND — the entry the old position map didn't know about
    {"item": {"id": 49679, "name": "Grand Champion's Kite Shield", "itemLevel": 795, "icon": "https://assets.tomestone.gg/i/030000/030289_hr1.png", "categoryName": "Shield", "categoryId": 11}},
    # 7 Earrings
    {"item": {"id": 49715, "name": "Grand Champion's Ear Cuff of Fending", "itemLevel": 790, "icon": "https://assets.tomestone.gg/i/055000/055564_hr1.png", "categoryName": "Earrings", "categoryId": 41}},
    # 8 Necklace
    {"item": {"id": 49643, "name": "Augmented Bygone Brass Choker of Fending", "itemLevel": 790, "icon": "https://assets.tomestone.gg/i/055000/055111_hr1.png", "categoryName": "Necklace", "categoryId": 40}},
    # 9 Bracelets
    {"item": {"id": 49648, "name": "Augmented Bygone Brass Bracelet of Fending", "itemLevel": 790, "icon": "https://assets.tomestone.gg/i/055000/055909_hr1.png", "categoryName": "Bracelets", "categoryId": 42}},
    # 10 Ring1
    {"item": {"id": 49730, "name": "Grand Champion's Ring of Fending", "itemLevel": 790, "icon": "https://assets.tomestone.gg/i/054000/054760_hr1.png", "categoryName": "Ring", "categoryId": 43}},
    # 11 Ring2
    {"item": {"id": 49653, "name": "Augmented Bygone Brass Ring of Fending", "itemLevel": 790, "icon": "https://assets.tomestone.gg/i/054000/054762_hr1.png", "categoryName": "Ring", "categoryId": 43}},
    # 12 Soul Crystal — skipped
    {"item": {"id": 4542, "name": "Soul of the Paladin", "itemLevel": 30, "icon": "https://assets.tomestone.gg/i/026000/026003_hr1.png", "categoryName": "Soul Crystal", "categoryId": 62}},
]

_TOMESTONE_PLD_SHIELD_PAYLOAD = {
    "name": "Thea Titania",
    "world": "Raiden",
    "profile": {
        "currentGearSetAndAttributes": {
            "gearSet": {"gear": _TOMESTONE_PLD_SHIELD_GEAR_LIST}
        }
    },
}


def test_tomestone_pld_shield_no_accessory_shift():
    """Shield jobs (13-entry list, off-hand at position 6) must not shift accessories.

    Regression test for the live bug: shield stored as Earring, earring as
    Necklace, necklace as Bracelets, bracelets as Ring1, Ring1 as Ring2, and
    the real Ring2 dropped.
    """
    gear = _normalize_tomestone_gear_list(_TOMESTONE_PLD_SHIELD_GEAR_LIST)

    assert gear["MainHand"]["ID"] == 49658
    assert gear["Head"]["ID"] == 49680
    assert gear["Body"]["ID"] == 49604
    assert gear["Hands"]["ID"] == 49682
    assert gear["Legs"]["ID"] == 49683
    assert gear["Feet"]["ID"] == 49607
    # The accessories the old position map corrupted:
    assert gear["Earrings"]["ID"] == 49715
    assert gear["Necklace"]["ID"] == 49643
    assert gear["Bracelets"]["ID"] == 49648
    assert gear["Ring1"]["ID"] == 49730
    assert gear["Ring2"]["ID"] == 49653  # was dropped entirely before
    # The shield (49679) must not occupy ANY slot in this PR (no off-hand slot yet)
    assert all(slot["ID"] != 49679 for slot in gear.values())
    assert len(gear) == 11


def test_tomestone_pld_shield_full_payload_normalization():
    """End-to-end: the full PLD payload converts with correct accessory slots."""
    payload = tomestone_profile_to_xivapi_payload(_TOMESTONE_PLD_SHIELD_PAYLOAD, fallback_lodestone_id=50121304)
    assert payload is not None
    gear = payload["Character"]["GearSet"]["Gear"]
    assert gear["Earrings"]["ID"] == 49715
    assert gear["Ring2"]["ID"] == 49653
    assert all(slot["ID"] != 49679 for slot in gear.values())


def test_tomestone_unknown_category_entries_are_skipped():
    """Entries with unrecognized categories (crafter tools, future slots) are skipped, not misfiled."""
    gear_list = [
        {"item": {"id": 30001, "name": "Some Saw", "itemLevel": 700, "categoryName": "Carpenter's Primary Tool", "categoryId": 12}},
        {"item": {"id": 30002, "name": "Some Hammer", "itemLevel": 700, "categoryName": "Carpenter's Secondary Tool", "categoryId": 13}},
        {"item": {"id": 30003, "name": "Some Hat", "itemLevel": 700, "categoryName": "Head", "categoryId": 34}},
    ]
    gear = _normalize_tomestone_gear_list(gear_list)
    # Position 0 is always the main hand regardless of category
    assert gear["MainHand"]["ID"] == 30001
    # Secondary tool (unknown category, not position 0) is skipped
    assert all(slot["ID"] != 30002 for slot in gear.values())
    assert gear["Head"]["ID"] == 30003
    assert len(gear) == 2
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_lodestone.py -k "pld_shield or unknown_category" -v`

Expected: `test_tomestone_pld_shield_no_accessory_shift` FAILS with `assert gear["Earrings"]["ID"] == 49715` (actual: 49679, the shield) — this is the live bug reproduced. `test_tomestone_pld_shield_full_payload_normalization` fails the same way. `test_tomestone_unknown_category_entries_are_skipped` fails (old code maps by position: 30002 lands in "Head", 30003 in "Body").

- [ ] **Step 3: Replace the position map with category classification**

In `backend/app/services/tomestone_provider.py`, **delete** the `TOMESTONE_GEAR_POSITION_SLOTS` constant (lines ~59-74) and replace it with:

```python
# Tomestone gear entries carry the item's UI category (categoryId/categoryName).
# Armor and accessory categories map 1:1 to slots. Weapon categories vary per
# job ("Gladiator's Arm", "Machinist's Arm", ...) so the main hand is
# recognized by list position 0 instead. Shield and Soul Crystal entries are
# intentionally skipped — the planner has no off-hand slot yet (see
# design/redesign/specs/2026-08-08-offhand-slot-design.md). Verified live
# 2026-08-08: non-shield jobs omit the off-hand entry (12 entries); shield
# jobs insert it at position 6 (13 entries), which is why position-based
# mapping shifted every accessory.
TOMESTONE_CATEGORY_SLOTS: dict[int, str] = {
    34: "Head",
    35: "Body",
    37: "Hands",
    36: "Legs",
    38: "Feet",
    41: "Earrings",
    40: "Necklace",
    42: "Bracelets",
}
TOMESTONE_RING_CATEGORY_ID = 43
TOMESTONE_SKIPPED_CATEGORY_IDS = {11, 62}  # Shield, Soul Crystal

# Fallback when categoryId is absent — same slots, keyed by lowercased categoryName.
TOMESTONE_CATEGORY_NAME_SLOTS: dict[str, str] = {
    "head": "Head",
    "body": "Body",
    "hands": "Hands",
    "legs": "Legs",
    "feet": "Feet",
    "earrings": "Earrings",
    "necklace": "Necklace",
    "bracelets": "Bracelets",
}
```

Then replace the body of `_normalize_tomestone_gear_list` entirely:

```python
def _normalize_tomestone_gear_list(gear_list: list[Any]) -> dict[str, dict[str, Any]]:
    """Convert Tomestone's positional gear list into XIVAPI Gear dict shape.

    Entries are classified by item category rather than list position: shield
    jobs (PLD) get an off-hand entry inserted mid-list, which shifted every
    accessory under the old fixed-position mapping. The main hand is always
    the position-0 entry (weapon categories vary per job). Shield and Soul
    Crystal entries are skipped. Unknown categories (crafter tools, future
    slots) are skipped rather than misfiled.
    """
    normalized: dict[str, dict[str, Any]] = {}
    ring_count = 0

    for position, raw_slot in enumerate(gear_list):
        if not isinstance(raw_slot, dict):
            continue
        item = raw_slot.get("item")
        if not isinstance(item, dict):
            continue
        item_id = _coerce_int(item.get("id") or item.get("itemId") or item.get("item_id"))
        if not item_id:
            continue

        category_id = _coerce_int(item.get("categoryId"))
        category_name = (item.get("categoryName") or "").strip().lower()

        if position == 0:
            slot_name = "MainHand"
        elif category_id in TOMESTONE_SKIPPED_CATEGORY_IDS or category_name in ("shield", "soul crystal"):
            continue
        elif category_id == TOMESTONE_RING_CATEGORY_ID or category_name == "ring":
            ring_count += 1
            if ring_count > 2:
                continue
            slot_name = "Ring1" if ring_count == 1 else "Ring2"
        elif category_id in TOMESTONE_CATEGORY_SLOTS:
            slot_name = TOMESTONE_CATEGORY_SLOTS[category_id]
        elif category_name in TOMESTONE_CATEGORY_NAME_SLOTS:
            slot_name = TOMESTONE_CATEGORY_NAME_SLOTS[category_name]
        else:
            # Unknown category (crafter secondary tools, facewear, future slots)
            continue

        icon = item.get("icon")
        item_name = item.get("name")
        item_level = item.get("itemLevel") or item.get("item_level")
        normalized[slot_name] = {
            "ID": item_id,
            **({"Icon": icon} if icon else {}),
            **({"Name": item_name} if item_name else {}),
            **({"ItemLevel": item_level} if item_level else {}),
        }

    return normalized
```

Also update the stale comment in `test_tomestone_soul_crystal_position_is_skipped` (`backend/tests/test_lodestone.py`, ~line 1385): change `# No Soul Crystal key (position 11 not in TOMESTONE_GEAR_POSITION_SLOTS)` to `# No Soul Crystal key (Soul Crystal category is skipped)`. Verify no other references remain: `grep -rn "TOMESTONE_GEAR_POSITION_SLOTS" backend/` must return nothing after this step.

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_lodestone.py -k "pld_shield or unknown_category" -v`
Expected: 3 PASS.

- [ ] **Step 5: Run the whole Lodestone/Tomestone test file, then the full backend suite**

Run: `cd backend && python -m pytest tests/test_lodestone.py -v` — all existing tests (including the 12-entry `_TOMESTONE_REAL_SHAPE_PAYLOAD` tests and the synthetic soul-crystal test) must still pass; the category classifier handles both shapes.
Then: `cd backend && python -m pytest` — full suite green.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/tomestone_provider.py backend/tests/test_lodestone.py
git commit -m "fix(sync): Tomestone gear list classified by item category — stops PLD off-hand shifting all accessory slots"
```

---

### Task 2: Release notes entry, gates, and PR

**Files:**
- Modify: `frontend/src/data/releaseNotes.ts` (public entry under `CURRENT_VERSION` rules)

**Interfaces:**
- Consumes: Task 1's committed fix (no code interfaces).
- Produces: the open PR.

- [ ] **Step 1: Invoke the `pr-checklist` skill** — it carries the exact release-notes entry format (`pr`/`prTitle` over `commits`, internal-vs-public rules, `CURRENT_VERSION` handling) and the pre-PR audit checklist. Follow it for the entry and checklist; the entry is **public** (user-facing bugfix). Suggested user-facing copy: "Fixed gear sync putting a Paladin's shield in the earring slot and shifting all other accessories — accessory slots now sync correctly for sword-and-shield jobs."

- [ ] **Step 2: Run frontend gates** (releaseNotes.ts is frontend code)

Run: `cd frontend && pnpm build && pnpm lint && pnpm test`
Expected: all green. (`pnpm build` runs `tsc -b` — required; `tsc --noEmit` is not equivalent.)

- [ ] **Step 3: Commit the release note**

```bash
git add frontend/src/data/releaseNotes.ts
git commit -m "docs(release-notes): entry for the PLD off-hand sync fix"
```

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin fix/tomestone-offhand-shift
gh pr create --title "fix(sync): PLD off-hand no longer shifts accessory slots in Tomestone gear sync" --body "<body per pr-checklist skill — root cause summary, link to design/redesign/specs/2026-08-08-offhand-slot-design.md, live-payload verification note, NO AI attribution footer>"
```

PR body must cover: the positional-map root cause, the live-capture verification (13-entry shield-job shape confirmed against Tomestone 2026-08-08), that the shield is skipped pending Deliverable 2 (off-hand slot feature), and that corrupted players self-heal on next sync. **No AI attribution.**

- [ ] **Step 5: Watch CI to green and run the review loop** — confirm an actual review comment exists from `claude[bot]` or Copilot before treating the PR as reviewed (a green `claude-review` check alone is NOT a review). Address feedback via the `pr-review-loop` skill. Merge is the user's call — do not merge.
