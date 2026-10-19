/**
 * The open farm row's panel test harness (S2a-3a·G4, from the G3 review): the real
 * `FarmExpansion` in a table, and the store set-up the drop tests share. The REAL store runs over
 * the test's mocked `api` (see `serveDrops`); its legacy refetches are stubbed and
 * `refreshGoalProgress` is the caller's spy. Each test file keeps its own `vi.mock` of the api
 * (hoisted per file).
 */
import { render, screen } from '@testing-library/react';
import { vi, type Mock } from 'vitest';
import { api } from '../../../services/api';
import { useCollectionGoalStore, type CollectionGoal } from '../../../stores/collectionGoalStore';
import { useToastStore } from '../../../stores/toastStore';
import type { MemberRole } from '../../../types';
import type { WeekClock } from '../../../utils/dropWeek';
import type { FarmRow } from '../../../utils/progressModel';
import { FarmExpansion } from '../FarmExpansion';
import { farmRowOf, goal, type ColumnSpec } from './progressFixtures';
import { stubCanHover } from './tooltipEnv';

export interface PanelOptions {
  /** The row itself, or the columns and goal to build it from. */
  row?: FarmRow;
  specs?: ColumnSpec[];
  g?: CollectionGoal;
  userRole?: MemberRole;
  canManage?: boolean;
  finished?: boolean;
  currentUserId?: string;
  onClose?: () => void;
  spanAll?: number;
  viewWidth?: number | null;
  clock?: WeekClock;
}

export function renderPanel({
  row,
  specs = [],
  g = goal('wings', { title: 'Wings' }),
  userRole = 'member',
  canManage = false,
  finished = false,
  currentUserId = 'me',
  onClose = vi.fn(),
  spanAll = 5,
  viewWidth,
  clock,
}: PanelOptions = {}) {
  // The panel's delete confirm is a Modal, whose useDevice reads matchMedia (jsdom has none).
  stubCanHover();
  const view = render(
    <table>
      <tbody>
        <FarmExpansion
          row={row ?? farmRowOf(specs, g, userRole)}
          finished={finished}
          canManage={canManage}
          userRole={userRole}
          currentUserId={currentUserId}
          groupId="g1"
          onClose={onClose}
          id="progress-expansion-wings"
          spanAll={spanAll}
          viewWidth={viewWidth}
          clock={clock}
        />
      </tbody>
    </table>,
  );
  return { ...view, onClose, panel: screen.getByTestId('progress-expansion') };
}

const real = useCollectionGoalStore.getState();

/** `beforeEach`: no drops, the legacy refetches stubbed, `refreshGoalProgress` the given spy, no toasts. */
export function installPanelStore(refresh: Mock) {
  refresh.mockResolvedValue(undefined);
  useCollectionGoalStore.setState({
    drops: {},
    dropsLoading: {},
    fetchParticipants: vi.fn().mockResolvedValue(undefined),
    fetchGoals: vi.fn().mockResolvedValue(undefined),
    refreshGoalProgress: refresh as unknown as typeof real.refreshGoalProgress,
  });
  useToastStore.getState().clearAll();
}

/** `afterEach`: the store's own actions back. */
export function restorePanelStore() {
  useCollectionGoalStore.setState({
    fetchParticipants: real.fetchParticipants,
    fetchGoals: real.fetchGoals,
    refreshGoalProgress: real.refreshGoalProgress,
    logDrop: real.logDrop,
    deleteDrop: real.deleteDrop,
    drops: {},
  });
}

export const posts = () => vi.mocked(api.post).mock.calls;
export const toasts = () => useToastStore.getState().toasts.map((t) => [t.type, t.message, t.action?.label ?? null]);
