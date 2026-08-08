# Compact-card gear strip — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or
> `superpowers:executing-plans` to implement task-by-task. Steps use checkbox syntax.

**Goal:** Give the v2 compact roster card one column per gear slot — item icon above, editable
status pip centered beneath — plus a second tome pip under the weapon when pursuing.

**Architecture:** No new mutation paths and no new permission gates. The compact strip switches
from a wrapped pip row to an 11-track grid, gains the icon treatment the expanded table already
uses (extracted so both print the same icon), and un-`disabled`s the pip so it runs C2's existing
`handleSlotChange`. The tome pip runs C4's existing `handleTomeWeaponChange`.

**Tech stack:** React 19 + TypeScript, Tailwind 4, vitest + @testing-library/react (`fireEvent`,
never `user-event` — not a dependency here).

**Spec:** `design/redesign/specs/2026-07-28-compact-card-gear-strip-design.md`

## Global constraints

- **Zero V1 impact.** Every edit lands in `components/roster/**`. `components/player/PlayerCardGear.tsx`
  and every other legacy path stay byte-identical. Assert with a legacy-paths `git diff --stat`.
- **One shared mutation path.** Slot edits go `GearStatusCircle → getNextGearState →
  computeGearSlotUpdate → actions.onUpdate`. Tome edits go through the `tomeWeapon` field spread.
  No fourth route.
- **Analytics:** slot cycles emit `PLAYER_GEAR_CHANGED` `{slot, state, shell:'v2'}` after the save
  resolves. Tome changes emit **nothing** (C2 ruling, C4 negative test).
- **Design system:** no raw `<button>`/`<input>`; semantic tokens only; `text-xs` (12px) floor.
  `components/roster/**` is eslint **error**-locked for these.
- **Copy:** "static", never "group", in any new user-facing string.
- Release note entry is `internal: true`; `CURRENT_VERSION` untouched.

---

### Task 1: Extract the slot-icon treatment so both densities print the same icon

`slotIconClass` and the `itemIcon || GEAR_SLOT_ICONS[slot]` fallback live inside
`RosterGearTable.tsx` today. The compact strip needs both; copying them would duplicate ~15 lines
across two files in the same directory (a `pnpm dupes` hit) and let the two densities drift.

**Files:**
- Create: `frontend/src/components/roster/gearSlotIcon.ts`
- Create: `frontend/src/components/roster/gearSlotIcon.test.ts`
- Modify: `frontend/src/components/roster/RosterGearTable.tsx` (delete the local `slotIconClass`
  at `:47-56`, import instead; replace the inline `iconUrl` at `:229`)

**Interfaces — produced:**
```ts
export function gearSlotIconUrl(slot: GearSlot, status: GearSlotStatus): string;
export function gearSlotIconClass(status: GearSlotStatus, isItemIcon: boolean): string;
export function isRealItemIcon(status: GearSlotStatus): boolean;  // !!status.itemIcon
```

- [ ] **Step 1: Write the failing test** — `gearSlotIcon.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { gearSlotIconUrl, gearSlotIconClass, isRealItemIcon } from './gearSlotIcon';
import { GEAR_SLOT_ICONS, type GearSlotStatus } from '../../types';

const base = (o: Partial<GearSlotStatus> = {}): GearSlotStatus =>
  ({ slot: 'head', bisSource: 'raid', hasItem: false, isAugmented: false, ...o }) as GearSlotStatus;

describe('gearSlotIconUrl', () => {
  it('prefers the real item icon', () => {
    expect(gearSlotIconUrl('head', base({ itemIcon: '/i/123.png' }))).toBe('/i/123.png');
  });
  it('falls back to the slot placeholder', () => {
    expect(gearSlotIconUrl('head', base())).toBe(GEAR_SLOT_ICONS.head);
  });
});

describe('gearSlotIconClass', () => {
  it('greys a missing item icon', () => {
    expect(gearSlotIconClass(base({ itemIcon: '/i/1.png' }), true)).toBe('rounded opacity-50 grayscale');
  });
  it('dims an unaugmented tome item icon', () => {
    expect(gearSlotIconClass(base({ bisSource: 'tome', hasItem: true }), true)).toBe('rounded opacity-75');
  });
  it('leaves a complete item icon untouched', () => {
    expect(gearSlotIconClass(base({ hasItem: true }), true)).toBe('rounded');
  });
  it('inverts a placeholder so it reads on the dark surface', () => {
    expect(gearSlotIconClass(base({ hasItem: true }), false)).toBe('brightness-0 invert opacity-90');
  });
  it('dims a missing placeholder without inverting', () => {
    expect(gearSlotIconClass(base(), false)).toBe('opacity-50');
  });
});

describe('isRealItemIcon', () => {
  it('is true only when the slot carries an item icon', () => {
    expect(isRealItemIcon(base({ itemIcon: '/i/1.png' }))).toBe(true);
    expect(isRealItemIcon(base())).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

`cd frontend && pnpm vitest run src/components/roster/gearSlotIcon.test.ts`
Expected: FAIL — cannot resolve `./gearSlotIcon`.

- [ ] **Step 3: Create the module** by MOVING the existing logic (do not rewrite it — the class
strings are already the expanded table's shipped behaviour and the test above pins them verbatim).
Copy the docblock from `RosterGearTable.tsx:42-46` with it.

- [ ] **Step 4: Point `RosterGearTable` at it** — delete the local function, import the three
helpers, replace `const iconUrl = status.itemIcon || GEAR_SLOT_ICONS[slot]` with
`gearSlotIconUrl(slot, status)` and `slotIconClass(status, !!status.itemIcon)` with
`gearSlotIconClass(status, isRealItemIcon(status))`.

- [ ] **Step 5: Run both suites — the expanded table must not change**

`pnpm vitest run src/components/roster/gearSlotIcon.test.ts src/components/roster/RosterGearTable.test.tsx`
Expected: PASS, with `RosterGearTable.test.tsx` untouched. If it needed editing, the move changed
behaviour — revert and redo as a pure move.

- [ ] **Step 6: Commit** — `refactor(roster): share the gear slot-icon treatment across densities`

---

### Task 2: Compact strip becomes an 11-track grid with icons

**Files:**
- Modify: `frontend/src/components/roster/RosterCard.tsx:1036-1084` (the `: (` branch of the
  density ternary — the `flex flex-wrap gap-1` block)
- Test: `frontend/src/components/roster/RosterCard.test.tsx`

**Interfaces — consumed:** `gearSlotIconUrl`, `gearSlotIconClass`, `isRealItemIcon` (Task 1).

- [ ] **Step 1: Write the failing tests**

```tsx
it('compact renders one column per gear slot, each with an icon above its pip', () => {
  renderCard({ density: 'compact' });
  const strip = screen.getByTestId('compact-gear-strip');
  expect(strip.querySelectorAll('[data-testid="compact-gear-slot"]')).toHaveLength(11);
  // the pip is inside the same column as its icon — this is what "centered
  // under its own icon" means structurally
  const first = strip.querySelectorAll('[data-testid="compact-gear-slot"]')[0];
  expect(first.querySelector('img')).toBeInTheDocument();
  expect(first.querySelector('[role="checkbox"]')).toBeInTheDocument();
});

it('compact shows the real item icon when the slot has one, the placeholder otherwise', () => {
  renderCard({
    density: 'compact',
    player: makePlayer({ gear: [gearSlot({ slot: 'head', itemIcon: '/i/42.png' }), gearSlot({ slot: 'body' })] }),
  });
  const imgs = screen.getByTestId('compact-gear-strip').querySelectorAll('img');
  expect(imgs[0]).toHaveAttribute('src', '/i/42.png');
  expect(imgs[1]).toHaveAttribute('src', GEAR_SLOT_ICONS.body);
});

it('compact icons are decoration, not controls', () => {
  renderCard({ density: 'compact' });
  const img = screen.getByTestId('compact-gear-strip').querySelector('img')!;
  expect(img).toHaveAttribute('aria-hidden', 'true');
  expect(img).not.toHaveAttribute('tabindex');
});
```

- [ ] **Step 2: Run them and watch them fail**

`pnpm vitest run src/components/roster/RosterCard.test.tsx -t compact`
Expected: FAIL — no `compact-gear-strip` testid.

- [ ] **Step 3: Rewrite the compact branch**

```tsx
<div
  data-testid="compact-gear-strip"
  className="mt-3 grid gap-x-1"
  style={{ gridTemplateColumns: `repeat(${player.gear.length}, minmax(0, 1fr))` }}
>
  {player.gear.map((slot) => (
    <div key={slot.slot} data-testid="compact-gear-slot" className="flex flex-col items-center gap-1">
      <img
        src={gearSlotIconUrl(slot.slot, slot)}
        alt=""
        aria-hidden="true"
        width={20}
        height={20}
        className={`w-full max-w-5 ${gearSlotIconClass(slot, isRealItemIcon(slot))}`}
      />
      {/* pip goes here in Task 3 */}
    </div>
  ))}
</div>
```

Keep the existing `LongPressTooltip` + `ItemHoverCard` wrapper, but wrap the **column** rather than
the pip, so hovering the icon or the pip both inspect. Keep the `<div className="flex-1" />`
spacer above the strip (C1's bottom-alignment).

- [ ] **Step 4: Run the tests** — expect PASS, and run the whole `RosterCard.test.tsx` file to
confirm no existing compact assertion broke.

- [ ] **Step 5: Commit** — `feat(roster): compact card gets one column per gear slot`

---

### Task 3: The compact pip becomes a live control

**Files:**
- Modify: `frontend/src/components/roster/RosterCard.tsx` (the column body from Task 2)
- Test: `frontend/src/components/roster/RosterCard.test.tsx`

**Interfaces — consumed:** `handleSlotChange` (`RosterCard.tsx:185`), `canCycleGear`
(`:176`), `gearPermission.reason`.

- [ ] **Step 1: Write the failing tests**

```tsx
it('a compact pip cycles gear state through the same payload the expanded table sends', async () => {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  renderCard({ density: 'compact', actions: { onUpdate } });
  fireEvent.click(within(firstSlot()).getByRole('checkbox'));
  await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  expect(onUpdate.mock.calls[0][0]).toEqual(
    computeGearSlotUpdate(player, 'weapon', { hasItem: true, isAugmented: false }),
  );
});

it('Enter and Space cycle a compact pip', async () => {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  renderCard({ density: 'compact', actions: { onUpdate } });
  const pip = within(firstSlot()).getByRole('checkbox');
  fireEvent.keyDown(pip, { key: 'Enter' });
  await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  fireEvent.keyDown(pip, { key: ' ' });
  await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(2));
});

it('a member can cycle their own compact card but not another player’s', () => {
  renderCard({ density: 'compact', userRole: 'member', currentUserId: 'u1',
              player: makePlayer({ userId: 'u2' }) });
  expect(within(firstSlot()).getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true');
});

it('a compact slot cycle emits player_gear_changed once, with the v2 shell tag', async () => {
  const spy = vi.fn();
  eventBus.on(Events.PLAYER_GEAR_CHANGED, spy);
  renderCard({ density: 'compact', actions: { onUpdate: vi.fn().mockResolvedValue(undefined) } });
  fireEvent.click(within(firstSlot()).getByRole('checkbox'));
  await waitFor(() => expect(spy).toHaveBeenCalledWith({ slot: 'weapon', state: 'have', shell: 'v2' }));
});
```

(`firstSlot()` = `screen.getAllByTestId('compact-gear-slot')[0]`. Mirror the existing expanded-table
assertions in this file for the exact `renderCard` option names.)

- [ ] **Step 2: Run and watch them fail** — the pip is still `disabled`, so no `onUpdate` fires.

- [ ] **Step 3: Wire the pip**

```tsx
<GearStatusCircle
  state={toGearState(slot.hasItem, slot.isAugmented)}
  bisSource={slot.bisSource}
  requiresAugmentation={requiresAugmentation(slot)}
  onChange={(next) => void handleSlotChange(slot.slot, next)}
  disabled={!canCycleGear}
  size="sm"
/>
```

`GearStatusCircle` has **no** `disabledReason` prop (verified — its props are `state`, `bisSource`,
`requiresAugmentation`, `onChange`, `disabled`, `size`, `tooltip`), and it is a shared leaf legacy
renders too, so do not add one. Carry the reason on the column wrapper's `title` instead, exactly
as the expanded table does.

- [ ] **Step 4: Run the tests** — expect PASS.

- [ ] **Step 5: Commit** — `feat(roster): compact gear pips are editable (v2 delta)`

---

### Task 4: Tome weapon as a second pip under the weapon column

**Files:**
- Modify: `frontend/src/components/roster/RosterCard.tsx` (weapon column)
- Test: `frontend/src/components/roster/RosterCard.test.tsx`

**Interfaces — consumed:** `handleTomeWeaponChange` (`RosterCard.tsx:253`),
`player.tomeWeapon: { pursuing, hasItem, isAugmented }`.

- [ ] **Step 1: Write the failing tests**

```tsx
it('renders no tome pip when the player is not pursuing one', () => {
  renderCard({ density: 'compact', player: makePlayer({ tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false } }) });
  expect(screen.queryByTestId('compact-tome-pip')).not.toBeInTheDocument();
});

it('renders the tome pip under the weapon column while pursuing', () => {
  renderCard({ density: 'compact', player: makePlayer({ tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false } }) });
  expect(within(firstSlot()).getByTestId('compact-tome-pip')).toBeInTheDocument();
});

it('the tome pip writes through the tomeWeapon field, never computeGearSlotUpdate', async () => {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  renderCard({ density: 'compact', actions: { onUpdate },
               player: makePlayer({ tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false } }) });
  fireEvent.click(screen.getByTestId('compact-tome-pip').querySelector('[role="checkbox"]')!);
  await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  expect(onUpdate.mock.calls[0][0]).toEqual({ tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false } });
  expect(onUpdate.mock.calls[0][0]).not.toHaveProperty('gear');
});

it('a tome pip change emits NO analytics', async () => {
  const spy = vi.fn();
  eventBus.on(Events.PLAYER_GEAR_CHANGED, spy);
  renderCard({ density: 'compact', actions: { onUpdate: vi.fn().mockResolvedValue(undefined) },
               player: makePlayer({ tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false } }) });
  fireEvent.click(screen.getByTestId('compact-tome-pip').querySelector('[role="checkbox"]')!);
  await waitFor(() => expect(spy).not.toHaveBeenCalled());
});
```

- [ ] **Step 2: Run and watch them fail.**

- [ ] **Step 3: Render the tome pip** inside the weapon column only, after the raid pip:

```tsx
{slot.slot === 'weapon' && player.tomeWeapon.pursuing && (
  <div data-testid="compact-tome-pip" className="-mt-0.5">
    <GearStatusCircle
      state={toGearState(player.tomeWeapon.hasItem, player.tomeWeapon.isAugmented)}
      bisSource="tome"
      requiresAugmentation
      onChange={(next) => void handleTomeWeaponChange(fromGearState(next))}
      disabled={!canCycleGear}
      size="sm"
    />
  </div>
)}
```

`size` accepts only `'sm' | 'md' | 'lg'` (verified), so "smaller than the raid pip" comes from the
wrapper — `scale-75` on the `-mt-0.5` div — not from a new size on the shared leaf.

- [ ] **Step 4: Run the tests** — expect PASS. Re-run C4's tome tests in
`RosterGearTable.test.tsx` to confirm the expanded sub-row is unaffected.

- [ ] **Step 5: Commit** — `feat(roster): compact weapon column carries the tome pip`

---

### Task 5: Records, docs and release note

**Files:**
- Modify: `frontend/src/components/roster/RosterCard.tsx:15-18` (the stale docblock claim)
- Modify: `design/redesign/specs/v1-v2-parity-matrix.md` (D-01, D-02, D-04 delta lines)
- Modify: `design/redesign/specs/2026-07-28-compact-card-gear-strip-design.md` (status → SHIPPED)
- Modify: `frontend/src/data/releaseNotes.ts`

- [ ] **Step 1: Delete the false docblock line.** `RosterCard.tsx:15-16` says the pip strip is
"NON-EDITING, matching legacy's compact view". Replace with what is now true: the strip is one
column per slot, the pip edits through the same shared path as the table, and the icon is
inspect-only decoration.

- [ ] **Step 2: Add the matrix deltas.** D-01 gains "compact density now carries slot icons AND an
editable pip"; D-02 gains "editing is no longer expanded-only — a v2 delta, legacy compact remains
inspect-only"; D-04 gains "the tome sub-row has a compact echo (second pip, `pursuing`-gated)".
Each states it is a **v2 delta, not a restore**, and that legacy is untouched.

- [ ] **Step 3: Flip the spec status** to SHIPPED with the PR number.

- [ ] **Step 4: Release note** — `internal: true`, category `feature`, describing the compact card
gaining gear icons and becoming editable. `CURRENT_VERSION` untouched. Check `gh pr list` for the
real next PR number immediately before pushing; do not predict it.

- [ ] **Step 5: Full gate + live validation**

```bash
cd frontend
pnpm build && pnpm lint && pnpm check:design-system:strict && pnpm dupes && pnpm tokens:check && pnpm test
pnpm test:e2e e2e/contrast.spec.ts
```

Then in the browser, as owner **and** an isolated member session, 0 console errors:
cycle a compact pip and restore it · confirm a member's own card is editable and another's is not ·
confirm the tome pip appears only while pursuing · screenshot compact dark. Assert V1 safety:
`git diff --stat main...HEAD -- frontend/src/components/player/ frontend/src/pages/` → empty.

- [ ] **Step 6: Commit and open the PR** (invoke the `pr-checklist` skill first).

---

## Self-review

- **Spec coverage:** §2.1 → Task 2 · §2.2 → Tasks 1-2 · §2.3 → Tasks 2-3 · §2.4 → Task 3 ·
  §2.5 → Task 4 · §3 → Task 5 · §4 → the test steps in Tasks 1-4 plus Task 5 step 5 · §5 (out of
  scope) → no task touches mobile, the expanded table, legacy, or BiS-source editing.
- **Placeholders:** none — every code step carries real code.
- **Type consistency:** `gearSlotIconUrl` / `gearSlotIconClass` / `isRealItemIcon` are named
  identically in Tasks 1 and 2; `handleSlotChange(slot, next)` and
  `handleTomeWeaponChange(Partial<TomeWeaponStatus>)` match their definitions at `RosterCard.tsx:185`
  and `:253`.
- **Both open questions resolved before hand-off** by reading `components/ui/GearStatusCircle.tsx:19-38`:
  there is no `disabledReason` prop (the reason goes on the column wrapper's `title`) and `size` is
  `'sm' | 'md' | 'lg'` only (the tome pip shrinks via a `scale-75` wrapper). Neither task adds a prop
  to the shared leaf, which legacy also renders.
