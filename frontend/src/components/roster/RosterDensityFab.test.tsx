import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RosterDensityFab } from './RosterDensityFab';

describe('RosterDensityFab', () => {
  it('switches density from the inactive button and marks the active one pressed', () => {
    const onDensityChange = vi.fn();
    render(<RosterDensityFab density="compact" onDensityChange={onDensityChange} />);

    expect(screen.getByRole('button', { name: 'Compact cards' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expanded cards' }));
    expect(onDensityChange).toHaveBeenCalledWith('expanded');
  });

  it('routes a re-click of the active Expanded button to onReselect (R-023, phone leg)', () => {
    const onDensityChange = vi.fn();
    const onReselect = vi.fn();
    render(
      <RosterDensityFab density="expanded" onDensityChange={onDensityChange} onReselect={onReselect} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expanded cards' }));
    expect(onReselect).toHaveBeenCalledWith('expanded');
    expect(onDensityChange).not.toHaveBeenCalled();
  });

  it('keeps an active-Compact re-click a no-op (legacy wired only the Expanded leg)', () => {
    const onDensityChange = vi.fn();
    const onReselect = vi.fn();
    render(
      <RosterDensityFab density="compact" onDensityChange={onDensityChange} onReselect={onReselect} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Compact cards' }));
    expect(onDensityChange).not.toHaveBeenCalled();
    expect(onReselect).not.toHaveBeenCalled();
  });
});
