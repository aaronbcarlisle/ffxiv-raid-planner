import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCell } from './StatCell';

describe('StatCell', () => {
  it('renders value, label, and an optional detail node', () => {
    render(<StatCell value="733" label="Avg iLvl" detail={<span>4/5 obtained</span>} />);
    expect(screen.getByText('733')).toBeInTheDocument();
    expect(screen.getByText('Avg iLvl')).toBeInTheDocument();
    expect(screen.getByText('4/5 obtained')).toBeInTheDocument();
  });

  // E2 review I-1: `detail` is a block slot — FairnessSummary passes two
  // `<div>` lines. A `<p>` wrapper made React 19 log "In HTML, <div> cannot
  // be a descendant of <p>" on every Home render with a roster.
  it('takes a block detail without an invalid-nesting console.error', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <StatCell
          value="3 / 1"
          label="Most / fewest"
          detail={
            <>
              <div>Most: Alice</div>
              <div>Fewest: Bob</div>
            </>
          }
        />
      );
      expect(screen.getByText('Most: Alice')).toBeInTheDocument();
      expect(screen.getByText('Most: Alice').closest('p')).toBeNull();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('omits the detail line when none is passed', () => {
    render(<StatCell value="733" label="Avg iLvl" />);
    expect(screen.queryByText(/obtained/)).not.toBeInTheDocument();
  });

  it('centers by default and left-aligns with align="start"', () => {
    const { rerender } = render(<StatCell value="1" label="X" />);
    expect(screen.getByText('X').parentElement).toHaveClass('text-center');

    rerender(<StatCell value="1" label="X" align="start" />);
    expect(screen.getByText('X').parentElement).toHaveClass('text-left');
  });

  it('applies text-text-primary to the value only when no valueClassName is passed', () => {
    render(<StatCell value="1" label="X" />);
    expect(screen.getByText('1')).toHaveClass('text-text-primary');
  });

  it('does not apply text-text-primary when valueClassName is passed', () => {
    render(<StatCell value="1" label="X" valueClassName="text-status-success" />);
    const value = screen.getByText('1');
    expect(value).toHaveClass('text-status-success');
    expect(value).not.toHaveClass('text-text-primary');
  });
});
