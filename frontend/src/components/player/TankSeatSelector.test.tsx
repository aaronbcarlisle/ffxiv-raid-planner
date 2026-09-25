import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TankSeatSelector } from './TankSeatSelector';
import { TooltipProvider } from '../primitives';
import type { SnapshotPlayer } from '../../types';

beforeEach(() => {
  // Radix Popper needs ResizeObserver; the Tooltip's useDevice needs
  // matchMedia (emulate a hover-capable desktop). jsdom has neither.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
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

const player = { id: 'p1', userId: 'u1', role: 'tank', job: 'PLD' } as unknown as SnapshotPlayer;

function renderChip(overrides: Partial<Parameters<typeof TankSeatSelector>[0]> = {}) {
  const onTankRoleSelect = vi.fn();
  const onPositionSelect = vi.fn();
  render(
    <TooltipProvider>
      <TankSeatSelector
        tankRole="MT"
        position="T1"
        onTankRoleSelect={onTankRoleSelect}
        onPositionSelect={onPositionSelect}
        player={player}
        userRole="owner"
        currentUserId="u1"
        {...overrides}
      />
    </TooltipProvider>
  );
  return { onTankRoleSelect, onPositionSelect };
}

const trigger = () => screen.getByRole('button', { name: /^Tank role/ });
const roleGroup = () => screen.getByRole('group', { name: 'Tank role' });
const positionGroup = () => screen.getByRole('group', { name: 'Position' });

describe('TankSeatSelector (E2, R-E2-D)', () => {
  it('reads "MT · T1" and names both halves for AT', () => {
    renderChip();
    expect(trigger()).toHaveTextContent('MT · T1');
    expect(trigger()).toHaveAccessibleName('Tank role MT, position T1');
  });

  it('shows an unset half as "--", in the label and the accessible name', () => {
    renderChip({ position: null });
    expect(trigger()).toHaveTextContent('MT · --');
    expect(trigger()).toHaveAccessibleName('Tank role MT, position not set');
  });

  it('takes the tank-role color when set and the muted chip when both halves are unset', () => {
    renderChip({ tankRole: null, position: null });
    expect(trigger()).toHaveTextContent('-- · --');
    expect(trigger()).toHaveClass('bg-surface-interactive', 'text-text-muted');
    expect(trigger()).not.toHaveClass('text-role-tank');
  });

  it('opens ONE popover with a labelled Tank role row and a Position row', () => {
    renderChip();
    fireEvent.click(trigger());
    expect(within(roleGroup()).getAllByRole('button', { pressed: false }).map((b) => b.textContent)).toEqual(['OT']);
    expect(within(roleGroup()).getByRole('button', { name: 'MT' })).toHaveAttribute('aria-pressed', 'true');
    // PositionSelector's options, the tank's suggestions first.
    expect(
      within(positionGroup())
        .getAllByRole('button')
        .filter((b) => b.hasAttribute('aria-pressed'))
        .map((b) => b.textContent)
    ).toEqual(['T1', 'T2', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2']);
  });

  it('picking a role or a position calls its handler and leaves the popover open', () => {
    const { onTankRoleSelect, onPositionSelect } = renderChip();
    fireEvent.click(trigger());

    fireEvent.click(within(roleGroup()).getByRole('button', { name: 'OT' }));
    expect(onTankRoleSelect).toHaveBeenCalledWith('OT');
    expect(roleGroup()).toBeInTheDocument();

    fireEvent.click(within(positionGroup()).getByRole('button', { name: 'T2' }));
    expect(onPositionSelect).toHaveBeenCalledWith('T2');
    expect(positionGroup()).toBeInTheDocument();
  });

  it('each row clears its own half, and offers Clear only when set', () => {
    const { onTankRoleSelect, onPositionSelect } = renderChip();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('button', { name: 'Clear tank role' }));
    expect(onTankRoleSelect).toHaveBeenCalledWith(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Clear position' }));
    expect(onPositionSelect).toHaveBeenCalledWith(undefined);
    expect(onTankRoleSelect).toHaveBeenCalledTimes(1);
    expect(onPositionSelect).toHaveBeenCalledTimes(1);
  });

  it('offers no Clear for an unset half', () => {
    renderChip({ tankRole: null });
    fireEvent.click(trigger());
    expect(screen.queryByRole('button', { name: 'Clear tank role' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear position' })).toBeInTheDocument();
  });

  it('focuses the selected tank-role option on open (keyboard path into the rows)', () => {
    renderChip({ tankRole: 'OT' });
    fireEvent.click(trigger());
    expect(within(roleGroup()).getByRole('button', { name: 'OT' })).toHaveFocus();
  });

  it('closes on Escape', () => {
    renderChip();
    fireEvent.click(trigger());
    expect(roleGroup()).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Tank role' })).not.toBeInTheDocument();
  });

  it('without edit permission: disabled, dimmed, never opens, and says why', async () => {
    renderChip({ userRole: 'member', currentUserId: 'someone-else' });
    expect(trigger()).toBeDisabled();
    expect(trigger()).toHaveClass('opacity-50', 'cursor-not-allowed');

    fireEvent.click(trigger());
    expect(screen.queryByRole('group', { name: 'Tank role' })).not.toBeInTheDocument();

    // The Tooltip wraps the span around the (disabled) button, as in the originals.
    fireEvent.focus(trigger().parentElement!);
    expect(
      (await screen.findAllByText('Members can only edit their own claimed cards')).length
    ).toBeGreaterThan(0);
  });
});
