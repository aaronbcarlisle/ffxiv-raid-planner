import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RosterGearTable } from './RosterGearTable';
import { TooltipProvider } from '../primitives';
import type { GearSlotStatus, TomeWeaponStatus } from '../../types';

beforeEach(() => {
  // Radix Popper (BiSSourceSelector's popover) needs ResizeObserver, which
  // jsdom lacks.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  // jsdom has no matchMedia; emulate a desktop/hover environment so useDevice
  // (via Tooltip/LongPressTooltip) resolves without throwing.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('hover: hover'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function slot(overrides: Partial<GearSlotStatus> & { slot: GearSlotStatus['slot'] }): GearSlotStatus {
  return {
    bisSource: 'raid',
    hasItem: false,
    isAugmented: false,
    ...overrides,
  } as GearSlotStatus;
}

const emptyTome: TomeWeaponStatus = { pursuing: false, hasItem: false, isAugmented: false };

function renderTable(
  gear: GearSlotStatus[],
  extra: Partial<Parameters<typeof RosterGearTable>[0]> = {}
) {
  return render(
    <TooltipProvider>
      <RosterGearTable gear={gear} tomeWeapon={emptyTome} {...extra} />
    </TooltipProvider>
  );
}

/** The status circle inside a named slot row. */
function circleIn(rowName: RegExp) {
  return within(screen.getByRole('rowheader', { name: rowName }).closest('tr')!).getByRole(
    'checkbox'
  );
}

describe('RosterGearTable — C2 editing', () => {
  it('editable: clicking a raid slot circle reports the 2-state cycle', () => {
    const onSlotChange = vi.fn();
    renderTable([slot({ slot: 'head', bisSource: 'raid', hasItem: false })], {
      editable: true,
      onSlotChange,
    });

    fireEvent.click(circleIn(/^Head/));
    expect(onSlotChange).toHaveBeenCalledWith('head', 'have');
  });

  it('editable: a tome slot needing augment cycles have → augmented', () => {
    const onSlotChange = vi.fn();
    // No itemName → requiresAugmentation defaults to true for tome.
    renderTable([slot({ slot: 'legs', bisSource: 'tome', hasItem: true })], {
      editable: true,
      onSlotChange,
    });

    fireEvent.click(circleIn(/^Legs/));
    expect(onSlotChange).toHaveBeenCalledWith('legs', 'augmented');
  });

  it('editable: the weapon row cycles as 2-state raid', () => {
    const onSlotChange = vi.fn();
    renderTable([slot({ slot: 'weapon', bisSource: 'raid', hasItem: false })], {
      editable: true,
      onSlotChange,
    });

    fireEvent.click(circleIn(/^Weapon/));
    expect(onSlotChange).toHaveBeenCalledWith('weapon', 'have');
  });

  it('editable: Enter on a focused circle cycles (keyboard-operable)', () => {
    const onSlotChange = vi.fn();
    renderTable([slot({ slot: 'hands', bisSource: 'raid', hasItem: true })], {
      editable: true,
      onSlotChange,
    });

    const circle = circleIn(/^Hands/);
    expect(circle).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(circle, { key: 'Enter' });
    expect(onSlotChange).toHaveBeenCalledWith('hands', 'missing');
  });

  it('editable: Space on a focused circle cycles too', () => {
    const onSlotChange = vi.fn();
    renderTable([slot({ slot: 'earring', bisSource: 'raid', hasItem: false })], {
      editable: true,
      onSlotChange,
    });

    fireEvent.keyDown(circleIn(/^Ears/), { key: ' ' });
    expect(onSlotChange).toHaveBeenCalledWith('earring', 'have');
  });

  it('editable without an onSlotChange handler renders inert (no hints, disabled circles)', () => {
    // The editing affordances must track actual interactivity: `editable`
    // with no handler would otherwise advertise a cycle that persists nothing.
    renderTable([slot({ slot: 'feet', bisSource: 'raid', hasItem: false })], { editable: true });

    const circle = circleIn(/^Feet/);
    expect(circle).toHaveAttribute('aria-disabled', 'true');
    expect(circle).not.toHaveAttribute('data-state');
  });

  it('read-only (C1 default): circles are disabled and clicks report nothing', () => {
    const onSlotChange = vi.fn();
    renderTable([slot({ slot: 'head', bisSource: 'raid', hasItem: false })], { onSlotChange });

    const circle = circleIn(/^Head/);
    expect(circle).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(circle);
    fireEvent.keyDown(circle, { key: 'Enter' });
    expect(onSlotChange).not.toHaveBeenCalled();
  });

  it('editable circles carry the status-tooltip wiring; read-only circles do not', () => {
    // Radix stamps its Trigger (asChild → the circle itself) with data-state;
    // tooltip-open behavior itself is Radix's and is verified in the browser pass.
    const { unmount } = renderTable([slot({ slot: 'feet', bisSource: 'raid', hasItem: false })], {
      editable: true,
      onSlotChange: vi.fn(),
    });
    expect(circleIn(/^Feet/)).toHaveAttribute('data-state');
    unmount();

    renderTable([slot({ slot: 'feet', bisSource: 'raid', hasItem: false })]);
    expect(circleIn(/^Feet/)).not.toHaveAttribute('data-state');
  });

  // ── BiS-source tools (Phase C C3, D-03) ──
  describe('BiS-source tools', () => {
    function bisTrigger(rowName: RegExp) {
      return within(screen.getByRole('rowheader', { name: rowName }).closest('tr')!).getByRole(
        'button',
        { name: /BiS source/ }
      );
    }

    it('interactive: the BiS cell mounts the shared source selector and reports a selection', () => {
      const onSourceChange = vi.fn();
      renderTable([slot({ slot: 'head', bisSource: 'raid', hasItem: false })], {
        editable: true,
        onSourceChange,
      });

      fireEvent.click(bisTrigger(/^Head/));
      // No item data on the slot → no reset-warning confirm, straight through.
      fireEvent.click(screen.getByRole('button', { name: /^Tome:/ }));
      expect(onSourceChange).toHaveBeenCalledWith('head', 'tome');
    });

    it('a slot with imported item data gets the reset-warning confirm before the change', () => {
      const onSourceChange = vi.fn();
      renderTable(
        [
          slot({
            slot: 'head',
            bisSource: 'raid',
            hasItem: true,
            itemName: 'Test Helm',
            itemLevel: 730,
          }),
        ],
        { editable: true, onSourceChange }
      );

      fireEvent.click(bisTrigger(/^Head/));
      fireEvent.click(screen.getByRole('button', { name: /^Crafted:/ }));
      // The shared leaf's ConfirmModal intercepts; nothing reported yet.
      expect(onSourceChange).not.toHaveBeenCalled();
      expect(screen.getByText(/will clear the current gear data/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Change' }));
      expect(onSourceChange).toHaveBeenCalledWith('head', 'crafted');
    });

    it('read-only: the selector renders disabled and opens nothing', () => {
      const onSourceChange = vi.fn();
      renderTable([slot({ slot: 'head', bisSource: 'raid', hasItem: false })], { onSourceChange });

      const trigger = bisTrigger(/^Head/);
      expect(trigger).toBeDisabled();
      fireEvent.click(trigger);
      expect(screen.queryByRole('button', { name: /^Tome:/ })).not.toBeInTheDocument();
      expect(onSourceChange).not.toHaveBeenCalled();
    });

    it('a miscategorized slot gets the per-slot Fix button; correct slots do not', () => {
      const onSourceFix = vi.fn();
      renderTable(
        [
          // Crafted-pattern name at crafted iLv but marked raid → fixable.
          slot({
            slot: 'head',
            bisSource: 'raid',
            hasItem: true,
            itemName: 'Archeo Kingdom Coat of Fending',
            itemLevel: 770,
          }),
          slot({ slot: 'body', bisSource: 'raid', hasItem: false }),
        ],
        { editable: true, onSourceChange: vi.fn(), onSourceFix }
      );

      const fix = screen.getByRole('button', { name: 'Fix BiS source to Crafted' });
      fireEvent.click(fix);
      expect(onSourceFix).toHaveBeenCalledWith('head', 'crafted');
      expect(screen.getAllByRole('button', { name: /^Fix BiS source/ })).toHaveLength(1);
    });

    it('no Fix affordance when read-only', () => {
      renderTable(
        [
          slot({
            slot: 'head',
            bisSource: 'raid',
            hasItem: true,
            itemName: 'Archeo Kingdom Coat of Fending',
            itemLevel: 770,
          }),
        ],
        { onSourceFix: vi.fn() }
      );
      expect(screen.queryByRole('button', { name: /^Fix BiS source/ })).not.toBeInTheDocument();
    });

    it('the weapon row mounts the weapon selector (C4), never the R/T/C/BT source popover', () => {
      renderTable([slot({ slot: 'weapon', bisSource: 'raid', hasItem: false })], {
        editable: true,
        onSourceChange: vi.fn(),
        onTomeWeaponChange: vi.fn(),
      });
      const weaponRow = screen.getByRole('rowheader', { name: /^Weapon/ }).closest('tr')!;
      expect(within(weaponRow).queryByRole('button', { name: /BiS source/ })).not.toBeInTheDocument();
      expect(within(weaponRow).getByRole('button', { name: '+' })).toBeInTheDocument();
    });
  });

  it('slots with item data get the hover item-card wiring; bare slots do not', () => {
    renderTable([
      slot({ slot: 'head', bisSource: 'raid', hasItem: true, itemName: 'Test Helm', itemLevel: 730 }),
      slot({ slot: 'body', bisSource: 'raid', hasItem: false }),
    ]);

    const headRow = screen.getByRole('rowheader', { name: /^Head/ });
    const bodyRow = screen.getByRole('rowheader', { name: /^Body/ });
    expect(headRow.querySelector('[data-state]')).not.toBeNull();
    expect(bodyRow.querySelector('[data-state]')).toBeNull();
  });
});

// ── Tome-weapon sub-row (Phase C C4, D-04) ──
describe('RosterGearTable — C4 tome-weapon sub-row', () => {
  const weaponGear = [slot({ slot: 'weapon', bisSource: 'raid', hasItem: false })];
  const pursuingTome: TomeWeaponStatus = { pursuing: true, hasItem: false, isAugmented: false };

  function weaponRow() {
    return screen.getByRole('rowheader', { name: /^Weapon/ }).closest('tr')!;
  }

  it('interactive: the weapon BiS cell mounts the shared selector; + reports pursuing', () => {
    const onTomeWeaponChange = vi.fn();
    renderTable(weaponGear, { editable: true, onTomeWeaponChange });

    fireEvent.click(within(weaponRow()).getByRole('button', { name: '+' }));
    expect(onTomeWeaponChange).toHaveBeenCalledWith({ pursuing: true });
  });

  it('the + toggle reports pursuing:false when already tracking', () => {
    const onTomeWeaponChange = vi.fn();
    renderTable(weaponGear, { editable: true, onTomeWeaponChange, tomeWeapon: pursuingTome });

    fireEvent.click(within(weaponRow()).getByRole('button', { name: '+' }));
    expect(onTomeWeaponChange).toHaveBeenCalledWith({ pursuing: false });
  });

  it('read-only: the + toggle renders disabled and reports nothing', () => {
    const onTomeWeaponChange = vi.fn();
    renderTable(weaponGear, { onTomeWeaponChange });

    const plus = within(weaponRow()).getByRole('button', { name: '+' });
    expect(plus).toBeDisabled();
    fireEvent.click(plus);
    expect(onTomeWeaponChange).not.toHaveBeenCalled();
  });

  it('editable without an onTomeWeaponChange handler renders the toggle inert', () => {
    // Affordance-tracks-handler (C2/C3 rule): `editable` alone must not
    // advertise a toggle that persists nothing.
    renderTable(weaponGear, { editable: true, onSlotChange: vi.fn() });
    expect(within(weaponRow()).getByRole('button', { name: '+' })).toBeDisabled();
  });

  it('the sub-row renders only while pursuing', () => {
    const { unmount } = renderTable(weaponGear);
    expect(screen.queryByRole('rowheader', { name: /Tome Weapon/ })).not.toBeInTheDocument();
    unmount();

    renderTable(weaponGear, { tomeWeapon: pursuingTome });
    expect(screen.getByRole('rowheader', { name: /Tome Weapon/ })).toBeInTheDocument();
  });

  it('interactive: the sub-row circle runs the 3-state tome cycle and reports hasItem/isAugmented', () => {
    const onTomeWeaponChange = vi.fn();
    renderTable(weaponGear, {
      editable: true,
      onTomeWeaponChange,
      tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false },
    });

    // have → augmented (tome + requiresAugmentation = the 3-state machine).
    fireEvent.click(circleIn(/Tome Weapon/));
    expect(onTomeWeaponChange).toHaveBeenCalledWith({ hasItem: true, isAugmented: true });
  });

  it('the sub-row circle is keyboard-operable (Enter cycles)', () => {
    const onTomeWeaponChange = vi.fn();
    renderTable(weaponGear, { editable: true, onTomeWeaponChange, tomeWeapon: pursuingTome });

    const circle = circleIn(/Tome Weapon/);
    expect(circle).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(circle, { key: 'Enter' });
    expect(onTomeWeaponChange).toHaveBeenCalledWith({ hasItem: true, isAugmented: false });
  });

  it('read-only: the sub-row circle is disabled and reports nothing', () => {
    const onTomeWeaponChange = vi.fn();
    renderTable(weaponGear, { onTomeWeaponChange, tomeWeapon: pursuingTome });

    const circle = circleIn(/Tome Weapon/);
    expect(circle).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(circle);
    expect(onTomeWeaponChange).not.toHaveBeenCalled();
  });

  it('the jump lives on the sub-row icon: Alt+Click follows it, a plain mouse click never does', () => {
    const onTomeMaterialJump = vi.fn();
    const { unmount } = renderTable(weaponGear, {
      tomeWeapon: pursuingTome,
      hasTomeMaterialEntry: true,
      onTomeMaterialJump,
    });

    const link = screen.getByRole('link', { name: /Tome Weapon/ });
    // User ruling on PR #191 (the C7/D-55 jump family): a real mouse click
    // (detail >= 1) without Alt must NOT navigate — an accidental icon click
    // would teleport the user to the Loot tab with no explanation.
    fireEvent.click(link, { detail: 1 });
    expect(onTomeMaterialJump).not.toHaveBeenCalled();
    fireEvent.click(link, { altKey: true, detail: 1 });
    expect(onTomeMaterialJump).toHaveBeenCalledTimes(1);
    unmount();

    // No material entry → the icon stays, but with no link semantics.
    onTomeMaterialJump.mockClear();
    renderTable(weaponGear, { tomeWeapon: pursuingTome, onTomeMaterialJump });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Tome Weapon'), { altKey: true, detail: 1 });
    expect(onTomeMaterialJump).not.toHaveBeenCalled();
  });

  it('AT synthetic activation (a detail-0 click) follows the jump', () => {
    // Screen-reader browse-mode activation dispatches a click with detail 0
    // (no physical press count) — the Alt gate must not reject it (director
    // F3, reconciled with the Alt-only mouse ruling via this discriminator).
    const onTomeMaterialJump = vi.fn();
    renderTable(weaponGear, {
      tomeWeapon: pursuingTome,
      hasTomeMaterialEntry: true,
      onTomeMaterialJump,
    });

    fireEvent.click(screen.getByRole('link', { name: /Tome Weapon/ }), { detail: 0 });
    expect(onTomeMaterialJump).toHaveBeenCalledTimes(1);
  });

  it('the jump icon invites a click only while Alt is held (cursor swap)', () => {
    // User ruling on PR #191: a persistent hand cursor advertises a plain
    // click the icon won't honor — the cursor must reflect the modifier
    // (default arrow normally, pointer only while Alt is down).
    renderTable(weaponGear, {
      tomeWeapon: pursuingTome,
      hasTomeMaterialEntry: true,
      onTomeMaterialJump: vi.fn(),
    });

    const link = screen.getByRole('link', { name: /Tome Weapon/ });
    expect(link.className).toContain('cursor-default');
    fireEvent.keyDown(window, { key: 'Alt' });
    expect(link.className).toContain('cursor-pointer');
    fireEvent.keyUp(window, { key: 'Alt' });
    expect(link.className).toContain('cursor-default');
  });

  it('the sub-row carries the indented weapon slot icon in both jump states', () => {
    // User ruling on PR #191: the sub-row gets the weapon slot icon (indented
    // under the main rows' icons) so the jump affordance has the same visual
    // home as every other C7 slot jump.
    function tomeRow() {
      return screen.getByRole('rowheader', { name: /Tome Weapon/ }).closest('tr')!;
    }
    const { unmount } = renderTable(weaponGear, {
      tomeWeapon: pursuingTome,
      hasTomeMaterialEntry: true,
      onTomeMaterialJump: vi.fn(),
    });
    expect(tomeRow().querySelector('img')).not.toBeNull();
    unmount();

    renderTable(weaponGear, { tomeWeapon: pursuingTome });
    expect(tomeRow().querySelector('img')).not.toBeNull();
  });

  it('keeps focus on the + toggle across the pursuing flip (stable row structure)', () => {
    // Director F1: flipping pursuing must not change the weapon row's element
    // type (tr ↔ Fragment at the same index remounts the subtree and drops
    // keyboard focus from the very button that caused the flip).
    const { rerender } = render(
      <TooltipProvider>
        <RosterGearTable
          gear={weaponGear}
          tomeWeapon={emptyTome}
          editable
          onTomeWeaponChange={vi.fn()}
        />
      </TooltipProvider>
    );
    const plus = within(weaponRow()).getByRole('button', { name: '+' });
    plus.focus();
    expect(document.activeElement).toBe(plus);

    rerender(
      <TooltipProvider>
        <RosterGearTable
          gear={weaponGear}
          tomeWeapon={pursuingTome}
          editable
          onTomeWeaponChange={vi.fn()}
        />
      </TooltipProvider>
    );
    expect(screen.getByRole('rowheader', { name: /Tome Weapon/ })).toBeInTheDocument();
    expect(document.activeElement).toBe(within(weaponRow()).getByRole('button', { name: '+' }));
  });

  it('the jump label is announced and keyboard-operable (role link, Enter jumps)', () => {
    // Design-system rule: appearance must match behavior — the label with a
    // live jump announces itself (role=link) and Enter follows it, closing
    // the keyboard gap legacy's mouse-only Alt+Click left open.
    const onTomeMaterialJump = vi.fn();
    renderTable(weaponGear, {
      tomeWeapon: pursuingTome,
      hasTomeMaterialEntry: true,
      onTomeMaterialJump,
    });

    const link = screen.getByRole('link', { name: /Tome Weapon/ });
    expect(link).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(link, { key: 'Enter' });
    expect(onTomeMaterialJump).toHaveBeenCalledTimes(1);
  });
});
