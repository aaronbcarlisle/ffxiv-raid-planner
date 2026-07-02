import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GearBoardCell } from './GearBoardCell';
import type { GearSlotStatus } from '../../types';

function s(over: Partial<GearSlotStatus>): GearSlotStatus {
  return { slot: 'head', bisSource: 'raid', hasItem: false, isAugmented: false, ...over } as GearSlotStatus;
}

describe('GearBoardCell', () => {
  it('shows the source letter when obtained (raid=R, tome=T, base_tome=BT, crafted=C)', () => {
    render(<GearBoardCell slot={s({ bisSource: 'raid', hasItem: true })} />);
    expect(screen.getByText('R')).toBeInTheDocument();
  });

  it('shows A for an augmented tome slot', () => {
    render(<GearBoardCell slot={s({ slot: 'legs', bisSource: 'tome', hasItem: true, isAugmented: true, itemName: 'Aug. Legs' })} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('shows a dashed "need" dot when missing', () => {
    render(<GearBoardCell slot={s({ bisSource: 'raid', hasItem: false })} />);
    expect(screen.getByText('·')).toBeInTheDocument();
  });

  it('shows an em-dash for an unset BiS source', () => {
    render(<GearBoardCell slot={s({ bisSource: null })} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders the next-upgrade glyph in the player role color when priority && !obtained', () => {
    render(<GearBoardCell slot={s({ bisSource: 'raid', hasItem: false })} priority role="caster" />);
    const cell = screen.getByText('●');
    expect(cell).toBeInTheDocument();
    expect(cell.getAttribute('aria-label')).toMatch(/— next upgrade priority$/);
    expect(cell.getAttribute('style')).toContain('var(--color-role-caster)');
    // The plain need dot is replaced, not rendered alongside.
    expect(screen.queryByText('·')).not.toBeInTheDocument();
  });

  it('ignores priority for an OBTAINED slot (renders the normal source letter)', () => {
    render(<GearBoardCell slot={s({ bisSource: 'raid', hasItem: true })} priority role="caster" />);
    expect(screen.getByText('R')).toBeInTheDocument();
    expect(screen.queryByText('●')).not.toBeInTheDocument();
  });

  it('renders the priority glyph without a role (no style crash)', () => {
    render(<GearBoardCell slot={s({ bisSource: 'raid', hasItem: false })} priority />);
    const cell = screen.getByText('●');
    expect(cell).toBeInTheDocument();
    expect(cell.getAttribute('style')).toBeFalsy();
  });

  it('calls onCycle with the slot and stops propagation on click', () => {
    const onCycle = vi.fn();
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <GearBoardCell slot={s({ slot: 'body', bisSource: 'raid', hasItem: false })} onCycle={onCycle} />
      </div>,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCycle).toHaveBeenCalledWith('body');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('does not call onCycle when disabled', () => {
    const onCycle = vi.fn();
    render(<GearBoardCell slot={s({ hasItem: false })} onCycle={onCycle} disabled />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCycle).not.toHaveBeenCalled();
  });
});
