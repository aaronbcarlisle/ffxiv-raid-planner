import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

  describe('keyboard (R-E1-E)', () => {
    it.each([['T2-a1', ' '], ['T2-a2', 'Enter']])('%s: %j cycles the slot', (_id, key) => {
      const onCycle = vi.fn();
      render(<GearBoardCell slot={s({ slot: 'legs' })} onCycle={onCycle} />);
      expect(fireEvent.keyDown(screen.getByRole('checkbox'), { key })).toBe(false); // defaultPrevented
      expect(onCycle).toHaveBeenCalledTimes(1);
      expect(onCycle).toHaveBeenCalledWith('legs');
    });

    it('T2-a3: a disabled cell ignores Space and Enter', () => {
      const onCycle = vi.fn();
      render(<GearBoardCell slot={s({})} onCycle={onCycle} disabled />);
      const cell = screen.getByRole('checkbox');
      fireEvent.keyDown(cell, { key: ' ' });
      fireEvent.keyDown(cell, { key: 'Enter' });
      expect(onCycle).not.toHaveBeenCalled();
    });

    it('T2-a4: an inert-but-enabled cell (no onCycle) is aria-disabled and out of the Tab sequence', () => {
      render(<GearBoardCell slot={s({})} />);
      const cell = screen.getByRole('checkbox');
      expect(cell).toHaveAttribute('aria-disabled', 'true');
      expect(cell).toHaveAttribute('tabindex', '-1');
    });

    it('routes an unmodified arrow to onNavigate and preventDefaults only when it returns true', () => {
      const onNavigate = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
      render(<GearBoardCell slot={s({})} onCycle={vi.fn()} onNavigate={onNavigate} />);
      const cell = screen.getByRole('checkbox');
      expect(fireEvent.keyDown(cell, { key: 'ArrowRight' })).toBe(false);
      expect(fireEvent.keyDown(cell, { key: 'ArrowUp' })).toBe(true);
      expect(onNavigate.mock.calls).toEqual([['ArrowRight'], ['ArrowUp']]);
    });

    it('leaves a modified arrow alone (Alt+Left is browser Back) and never preventDefaults it', () => {
      const onNavigate = vi.fn().mockReturnValue(true);
      render(<GearBoardCell slot={s({})} onCycle={vi.fn()} onNavigate={onNavigate} />);
      const cell = screen.getByRole('checkbox');
      expect(fireEvent.keyDown(cell, { key: 'ArrowLeft', altKey: true })).toBe(true);
      expect(fireEvent.keyDown(cell, { key: 'ArrowDown', shiftKey: true })).toBe(true);
      expect(fireEvent.keyDown(cell, { key: 'ArrowDown', ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(cell, { key: 'ArrowDown', metaKey: true })).toBe(true);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('isTabStop=false keeps an interactive cell focusable but out of the Tab sequence; the default is in', () => {
      const { rerender } = render(<GearBoardCell slot={s({})} onCycle={vi.fn()} isTabStop={false} />);
      expect(screen.getByRole('checkbox')).toHaveAttribute('tabindex', '-1');
      rerender(<GearBoardCell slot={s({})} onCycle={vi.fn()} />);
      expect(screen.getByRole('checkbox')).toHaveAttribute('tabindex', '0');
    });

    it('fires onFocus only while interactive', () => {
      const onFocus = vi.fn();
      const { rerender } = render(<GearBoardCell slot={s({})} onCycle={vi.fn()} onFocus={onFocus} />);
      act(() => screen.getByRole('checkbox').focus());
      expect(onFocus).toHaveBeenCalledTimes(1);
      act(() => screen.getByRole('checkbox').blur());
      rerender(<GearBoardCell slot={s({})} onCycle={vi.fn()} onFocus={onFocus} disabled />);
      act(() => screen.getByRole('checkbox').focus());
      expect(document.activeElement).toBe(screen.getByRole('checkbox'));
      expect(onFocus).toHaveBeenCalledTimes(1);
    });
  });
});
