/**
 * PluginPage — flip-P3 Task 3 (re-home GearSyncDashboard, spec §5.3).
 *
 * GearSyncDashboard's old home (the legacy Gear→Sync sub-tab) was deleted in
 * Task 2, leaving it with zero importers. This pins the new contract: the
 * Plugin tab renders it (fed by the tier store's players selector) alongside
 * the existing install-steps + API-key content, positioned after the install
 * steps and before the API key manager — without wiring the deleted
 * `onViewStats` target.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SnapshotPlayer } from '../../types';

const mocks = vi.hoisted(() => ({
  players: [] as SnapshotPlayer[],
  gearSyncSpy: vi.fn(),
}));

vi.mock('../../stores/tierStore', () => ({
  useTierPlayers: () => mocks.players,
}));
vi.mock('./GearSyncDashboard', () => ({
  GearSyncDashboard: (props: { players: SnapshotPlayer[]; onViewStats?: () => void }) => {
    mocks.gearSyncSpy(props);
    return <div data-testid="gear-sync-dashboard" />;
  },
}));
vi.mock('../settings/ApiKeyManager', () => ({
  ApiKeyManager: () => <div data-testid="api-key-manager" />,
}));

import { PluginPage } from './PluginPage';

function player(partial: Partial<SnapshotPlayer>): SnapshotPlayer {
  return {
    id: 'p',
    tierSnapshotId: 't',
    name: 'Player',
    job: 'WAR',
    role: 'tank',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {} as SnapshotPlayer['tomeWeapon'],
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

beforeEach(() => {
  mocks.players = [];
  mocks.gearSyncSpy = vi.fn();
});

describe('PluginPage', () => {
  it('renders the Gear Sync dashboard alongside the existing install steps and API key content', () => {
    render(<PluginPage />);

    expect(screen.getByText('Installation steps')).toBeInTheDocument();
    expect(screen.getByText(/install the dalamud launcher/i)).toBeInTheDocument();

    expect(screen.getByText('Gear Sync')).toBeInTheDocument();
    expect(screen.getByText('Plugin sync status for this tier.')).toBeInTheDocument();
    expect(screen.getByTestId('gear-sync-dashboard')).toBeInTheDocument();

    expect(screen.getByText('Your API keys')).toBeInTheDocument();
    expect(screen.getByTestId('api-key-manager')).toBeInTheDocument();
  });

  it('feeds GearSyncDashboard from the tier store players selector and does not pass onViewStats', () => {
    const players = [player({ id: 'p1' }), player({ id: 'p2' })];
    mocks.players = players;
    render(<PluginPage />);

    expect(mocks.gearSyncSpy).toHaveBeenCalledTimes(1);
    const props = mocks.gearSyncSpy.mock.calls[0][0];
    expect(props.players).toBe(players);
    expect(props.onViewStats).toBeUndefined();
  });

  it('positions Gear Sync after the install steps and before the API key manager (DOM order)', () => {
    render(<PluginPage />);

    const installSteps = screen.getByText('Installation steps');
    const gearSync = screen.getByTestId('gear-sync-dashboard');
    const apiKeyManager = screen.getByTestId('api-key-manager');

    expect(
      installSteps.compareDocumentPosition(gearSync) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      gearSync.compareDocumentPosition(apiKeyManager) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
