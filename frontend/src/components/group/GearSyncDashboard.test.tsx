/**
 * GearSyncDashboard — Team Summary shortcut guard (flip-P3 Task 3).
 *
 * `onViewStats` used to always route to the legacy stats sub-tab; that target
 * is gone. The "Team Summary" card must only render when a caller actually
 * wires a destination — otherwise it's a dead control that looks clickable
 * ("Open Team Summary →") but does nothing.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { SnapshotPlayer } from '../../types';
import { GearSyncDashboard } from './GearSyncDashboard';

describe('GearSyncDashboard — Team Summary shortcut', () => {
  it('renders the Team Summary shortcut and fires onViewStats when a handler is provided', () => {
    const onViewStats = vi.fn();
    render(<GearSyncDashboard players={[] as SnapshotPlayer[]} onViewStats={onViewStats} />);

    expect(screen.getByText('Team Summary')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/open team summary/i));
    expect(onViewStats).toHaveBeenCalledTimes(1);
  });

  it('hides the Team Summary shortcut entirely when onViewStats is not provided', () => {
    render(<GearSyncDashboard players={[] as SnapshotPlayer[]} />);

    expect(screen.queryByText('Team Summary')).not.toBeInTheDocument();
    expect(screen.queryByText(/open team summary/i)).not.toBeInTheDocument();
  });
});
