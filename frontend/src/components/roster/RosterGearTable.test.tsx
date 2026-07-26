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

    it('the weapon row keeps its static raid glyph (the weapon selector is C4 scope)', () => {
      renderTable([slot({ slot: 'weapon', bisSource: 'raid', hasItem: false })], {
        editable: true,
        onSourceChange: vi.fn(),
      });
      const weaponRow = screen.getByRole('rowheader', { name: /^Weapon/ }).closest('tr')!;
      expect(within(weaponRow).queryByRole('button')).not.toBeInTheDocument();
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
