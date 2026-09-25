import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCell } from './StatCell';

describe('StatCell', () => {
  it('renders value, label, and an optional detail node', () => {
    render(<StatCell value="733" label="Avg iLvl" detail={<span>4/5 obtained</span>} />);
    expect(screen.getByText('733')).toBeInTheDocument();
    expect(screen.getByText('Avg iLvl')).toBeInTheDocument();
    expect(screen.getByText('4/5 obtained')).toBeInTheDocument();
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
