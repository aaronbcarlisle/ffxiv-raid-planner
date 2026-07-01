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

  it('reserved priority renders plain need (no priority glyph) — F6d owns need.up', () => {
    render(<GearBoardCell slot={s({ hasItem: false })} priority />);
    expect(screen.getByText('·')).toBeInTheDocument();
    expect(screen.queryByText('●')).not.toBeInTheDocument();
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
