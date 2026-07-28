# Compact card: gear icons + editable status pips

**Status: ✅ SHIPPED (PR #203).** User-approved 2026-07-28, implemented the same day, then
**REVISED the same day after live use** — see §6. Authored 2026-07-28, off `main` after the Phase-C
closeout (PR #202). Post-Phase-C polish on the roster card; not part of any C-slice.

---

## 1. Why

The two shells solved the compact card differently and each kept half the story:

- **v1 compact** (`components/player/PlayerCardGear.tsx:105-180`) renders a row of 11 **icons** —
  the real item icon when the slot has one, the slot placeholder otherwise — encoding state through
  opacity/grayscale plus a green/amber corner dot. Inspect-only.
- **v2 compact** (`components/roster/RosterCard.tsx:1036-1060`) renders a wrapped row of
  `GearStatusCircle` **pips** — the same control the expanded table uses, but `disabled`.
  Inspect-only.

So v2 lost the at-a-glance "what gear is this" read that the icons gave, and neither shell lets you
*change* anything without expanding the card first.

This design merges the two and makes the compact strip editable.

---

## 2. What ships

### 2.1 Layout — one column per slot

The strip becomes an **11-track grid**, one track per gear slot, each track a centered vertical
stack: icon on top, pip directly beneath. Equal tracks distribute the slots evenly across the card;
centering within each track keeps every pip under its own icon at any width.

```
  weapon head  body  hands legs  feet  earr  neck  brac  ring1 ring2
   [▓]   [▓]   [▓]   [▓]   [▓]   [▓]   [▓]   [▓]   [▓]   [▓]   [▓]
    ●     ●     ○     ●     ○     ●     ●     ○     ●     ●     ○
```

(The eleven of `GEAR_SLOTS`, `types/index.ts:470-482`, in that order.)

Replaces today's `flex flex-wrap gap-1`. The strip **never wraps and never scrolls horizontally**:
the tracks divide the available width evenly and the icons scale down inside them, so eleven
columns always fit on one line at every desktop card width the responsive grid produces (1 / 2 / 3 /
4-up).

### 2.2 The icon carries identity, not state twice

Real item icon when the slot has one, slot placeholder (`GEAR_SLOT_ICONS`, inverted white) when it
doesn't — matching v1. Dimmed/grayscaled when the slot isn't obtained, so the row still scans
without reading the pips.

**v1's green/amber corner dot is dropped.** The pip beneath now carries that, and stating the same
fact twice per slot is what makes a dense row hard to read.

### 2.3 The pip is the control

The same `GearStatusCircle` compact renders today, minus `disabled`:

- click cycles; **Enter/Space** cycle (C2's keyboard path);
- it carries the accessible name and the announced state;
- BiS-source tint and the `requiresAugmentation` treatment are unchanged.

**The icon is not a second control.** It stays decoration plus hover-inspect (`ItemHoverCard` via
`LongPressTooltip`, which compact already shows). One control per slot, so a click is never
ambiguous.

### 2.4 Editing reuses C2 exactly

No new mutation path:

```
GearStatusCircle → getNextGearState → computeGearSlotUpdate → actions.onUpdate
```

— the same chain the expanded table and the Board already run, pinned by
`calculations.gearUpdate.test.ts`. The `player_gear_changed` analytics emit (C2's ruling: v2 card
only, `{slot, state, shell:'v2'}`, after the save resolves) fires from compact too, since it is the
same card component emitting for the same 11 slots. (An explicit reading of the C2 ruling, which pinned
the emit *site* — "the v2 card only, never the shared mutation path" — not the density.)

**Permissions** are `canEditGear` per player — owners/leads edit anyone, a member edits their own
card, a viewer gets disabled pips with the reason. Identical to the expanded table; no new gate.

### 2.5 Tome weapon — a second pip under the weapon column

The interim tome weapon is not a 12th slot; it is a second state of the weapon slot. When
`player.tomeWeapon.pursuing` is true, the weapon column gains a **smaller, tome-tinted pip beneath
its raid pip** — the compact echo of C4's indented sub-row:

```
   wpn   head  body
   [▓]   [▓]   [▓]
    ●     ●     ○      ← raid pips
    ◦                  ← tome pip: smaller, tome tint, only when pursuing
```

It mutates through **C4's path**, not `computeGearSlotUpdate`: `tomeWeapon` is its own player field,
written with the legacy spread (`RosterGearTable.tsx:133` documents the split). Per the C2 ruling,
tome changes emit **no** analytics — C4 pins that with a negative test, and this must not break it.

Not pursuing → nothing renders, and the column is the same height as the rest.

**Accepted cost:** while pursuing, the weapon column is taller than the other ten. The compact strip
sits after a `flex-1` spacer (bottom-aligned, C1's equal-height scheme), so that card's strip shifts
up by roughly one small pip. Without the expanded view's `└` glyph, the second pip relies on its
tome tint and size to read as the tome one.

---

## 3. What this changes about the model — record, don't bury

1. **This is a v2 delta, not a restore.** Neither shell permits compact editing today and v1's
   compact row has no pips at all. Legacy stays byte-frozen; matrix **D-01** (density axis),
   **D-02** (gear editing) and **D-04** (tome sub-row) each gain a recorded delta.
2. **Density stops gating capability.** After this, compact vs expanded is a *detail* axis only —
   the same actions are available in both, you just see less. This is a deliberate improvement over
   both shells, and it changes what the toggle means.
3. **`RosterCard`'s docblock is now wrong** where it says the pip strip is "NON-EDITING, matching
   legacy's compact view" (`RosterCard.tsx:15-16`). That line goes.

---

## 4. Testing

Red-first, in `RosterCard.test.tsx` unless noted:

| Test | Pins |
|---|---|
| compact renders 11 icon+pip columns | the layout contract |
| the icon is the item icon when present, the slot placeholder otherwise | §2.2 |
| a compact pip click cycles through the same states as the expanded table, with an identical `onUpdate` payload | §2.4 — the one-shared-path guarantee, by test not inspection |
| Enter and Space cycle a compact pip | keyboard parity with C2 |
| a member sees their own card's pips enabled and another player's disabled with the reason | the `canEditGear` gate |
| the tome pip renders only when `pursuing`, and writes through the `tomeWeapon` field | §2.5 |
| a tome pip change emits **no** analytics; a slot pip change emits one | keeps C4's negative test honest |
| the icon is not a control (no click handler, not in the tab order) | §2.3 — prevents the two-target regression |

Plus the standing gate: `build` · `lint` · `check:design-system:strict` · `dupes` · `tokens:check` ·
full suite · contrast e2e · live validation as owner **and** an isolated member, 0 console errors ·
screenshots.

---

## 5. Out of scope

- **Mobile / 390 px** — deferred to the consolidated Phase-P pass, per the standing ruling.
- **The expanded table** — untouched.
- **Legacy's compact row** — untouched, and its icon treatment is the reference, not a target for
  edits.
- ~~**BiS-source editing in compact**~~ — **REVERSED in §6.** Compact now edits target state too.

---

## 6. Revision (same day, after live use)

Three things surfaced once the strip was in the browser. All three are user-ruled.

### 6.1 The pip needed its own tooltip

The hover card wrapped the whole **column**, so hovering the pip explained the *item* rather than
the control. Now the **icon** owns the item card and the **pip** owns the cycle hint
(`cycleHint()`, extracted from the expanded table into `gearCycleHint.tsx` so both densities share
one copy). The tome pip's hint is specialized — "Tome weapon status … empty → base obtained (ring)
→ augmented (filled)" — so the augment step is stated rather than inferred.

### 6.2 The source was invisible, and the fix is a third row

Diagnosis first: the pip *does* tint by source, but only in the have/complete states —
`GearStatusCircle`'s missing state is a flat gray circle with no source tint
(`GearStatusCircle.tsx:164-166`). Early in a tier most slots are missing, so compact read as
sourceless.

Each column gains a **third row: the BiS-source badge**, and it is the same `BiSSourceSelector` the
expanded table's BiS column uses — so compact can **retarget** a slot, not just record progress.
This reverses §5's out-of-scope line, deliberately.

### 6.3 The tome weapon became a column, not a stacked pip

§2.5's second pip cost a whole row for one control. It is now a **twelfth column** immediately
after the weapon, with its own icon, pip and a static `T` badge — the expanded card's sub-row,
rotated. The user's framing: *"the behavior of the compacted card functions exactly like the
expanded cards, just horizontally instead."*

**No `+` on the strip.** The expanded row has horizontal room for one; a ~36px column does not —
two controls there would be ~17px each. The kebab's existing **Track/Stop tome weapon** item adds
and removes the column, writing the same store field (C4 proved the two stay in sync).

**Measured, not assumed:** at the 4-up breakpoint the strip is 436px → 36px per column with twelve,
against a 28px badge. No overflow at any card width the responsive grid produces.
