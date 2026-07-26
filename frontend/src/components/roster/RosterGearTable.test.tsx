import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RosterGearTable } from './RosterGearTable';
import { TooltipProvider } from '../primitives';
import type { GearSlotStatus, TomeWeaponStatus } from '../../types';

beforeEach(() => {
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
