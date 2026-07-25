import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedToggle } from './SegmentedToggle';

const OPTS = [
  { value: 'cards', label: 'Cards' },
  { value: 'board', label: 'Board' },
] as const;

describe('SegmentedToggle', () => {
  it('renders each option label inside a labelled group', () => {
    render(<SegmentedToggle options={OPTS as never} value="cards" onChange={() => {}} ariaLabel="Roster view" />);
    expect(screen.getByRole('group', { name: 'Roster view' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cards' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Board' })).toBeInTheDocument();
  });

  it('marks the active option with aria-pressed', () => {
    render(<SegmentedToggle options={OPTS as never} value="board" onChange={() => {}} ariaLabel="Roster view" />);
    expect(screen.getByRole('button', { name: 'Board' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the option value when an inactive option is clicked', () => {
    const onChange = vi.fn();
    render(<SegmentedToggle options={OPTS as never} value="cards" onChange={onChange} ariaLabel="Roster view" />);
    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(onChange).toHaveBeenCalledWith('board');
  });

  it('does not call onChange when the already-active option is clicked', () => {
    const onChange = vi.fn();
    render(<SegmentedToggle options={OPTS as never} value="cards" onChange={onChange} ariaLabel="Roster view" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cards' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
