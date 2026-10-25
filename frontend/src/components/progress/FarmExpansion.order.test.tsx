/**
 * Change order inside the open farm row's panel (S2a-3c·C3 Task TC3; design D-5, E-7, E-8, §3.3;
 * R-C-6, R-C-8): FarmExpansion passes `canOrder` (a lead on an active row), `groupId` and
 * `onLeave` (Copy plan); an Escape in the editor is prevented, so the panel's filter leaves the
 * panel open; Log drop's main part follows the saved order after the refresh. The REAL store runs
 * over a mocked `api` (fake drops and queue-order routes); the refresh spy re-renders the panel
 * with the refreshed ranks.
 */
import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/api')>()),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../services/api';
import type { MemberRole } from '../../types';
import { serveDrops } from './__fixtures__/dropServer';
import { installPanelStore, restorePanelStore } from './__fixtures__/panelHarness';
import { farmRowOf, goal, type ColumnSpec } from './__fixtures__/progressFixtures';
import { liveSpecs, serveQueueOrder, type LiveSpecs } from './__fixtures__/queueOrderServer';
import { stubCanHover } from './__fixtures__/tooltipEnv';
import { FarmExpansion } from './FarmExpansion';

const WINGS = goal('wings', { title: 'Wings' });

const need = (tokenCount: number | null, priorityRank: number | null = null) => ({ state: 'need' as const, tokenCount, priorityRank });

// Automatic: Bea (10), Ann (60), Cy (90).
const THREE: ColumnSpec[] = [
  { id: 'Ann', cell: need(60) },
  { id: 'Bea', cell: need(10) },
  { id: 'Cy', cell: need(90) },
];
const PINNED: ColumnSpec[] = [
  { id: 'Ann', cell: need(60, 1) },
  { id: 'Bea', cell: need(10, 2) },
  { id: 'Cy', cell: need(90) },
];

interface Opts {
  role?: MemberRole;
  canManage?: boolean;
  finished?: boolean;
  g?: typeof WINGS;
}

function Panel({ live, opts, onClose }: { live: LiveSpecs; opts: Opts; onClose: () => void }) {
  const specs = live.useSpecs();
  const role = opts.role ?? 'lead';
  return (
    <table>
      <tbody>
        <FarmExpansion
          row={farmRowOf(specs, opts.g ?? WINGS, role)}
          finished={opts.finished ?? false}
          canManage={opts.canManage ?? role === 'lead'}
          userRole={role}
          currentUserId="me"
          groupId="g1"
          onClose={onClose}
          id="progress-expansion-wings"
          spanAll={5}
        />
      </tbody>
    </table>
  );
}

const refresh = vi.fn();
let server: ReturnType<typeof serveQueueOrder>;

function renderPanel(specs: ColumnSpec[], opts: Opts = {}) {
  stubCanHover();
  const live = liveSpecs(specs);
  server = serveQueueOrder(api, refresh, live);
  const onClose = vi.fn();
  const view = render(<Panel live={live} opts={opts} onClose={onClose} />);
  return { ...view, onClose, queue: () => within(screen.getByTestId('progress-expansion-queue')) };
}

const query = (name: string) => screen.queryByRole('button', { name });
const settled = () => waitFor(() => expect(screen.queryByText('Loading drops…')).not.toBeInTheDocument());

beforeEach(() => {
  vi.clearAllMocks();
  serveDrops(api);
  installPanelStore(refresh);
});

afterEach(restorePanelStore);

describe('FarmExpansion passes canOrder (R-C-6, D-5)', () => {
  it('a lead on an active row gets Change order in Next in line; a finished row, a member and a viewer do not', async () => {
    const lead = renderPanel(PINNED);
    await settled();
    expect(lead.queue().getByRole('button', { name: 'Change order' })).toBeInTheDocument();
    expect(lead.queue().getByRole('button', { name: 'Back to automatic' })).toBeInTheDocument();
    lead.unmount();

    const finished = renderPanel(PINNED, { finished: true });
    await settled();
    expect(finished.queue().getByText('Manual order')).toBeInTheDocument();
    expect(query('Change order')).not.toBeInTheDocument();
    expect(query('Back to automatic')).not.toBeInTheDocument();
    finished.unmount();

    const member = renderPanel(PINNED, { role: 'member', canManage: false });
    await settled();
    expect(member.queue().getByText('Manual order')).toBeInTheDocument();
    expect(query('Change order')).not.toBeInTheDocument();
    expect(query('Back to automatic')).not.toBeInTheDocument();
    member.unmount();

    // A demoted viewer may still hold canManage: the viewer rule wins.
    renderPanel(PINNED, { role: 'viewer', canManage: true });
    await settled();
    expect(screen.queryByText('Manual order')).not.toBeInTheDocument();
    expect(query('Change order')).not.toBeInTheDocument();
    expect(query('Back to automatic')).not.toBeInTheDocument();
  });
});

describe('FarmExpansion: Escape in the editor (E-7)', () => {
  it('cancels the editor and leaves the panel open; the next Escape closes the panel', async () => {
    const { onClose, queue } = renderPanel(THREE);
    await settled();
    fireEvent.click(queue().getByRole('button', { name: 'Change order' }));
    const target = screen.getByRole('button', { name: 'Move Ann up' });
    const escape = createEvent.keyDown(target, { key: 'Escape' });
    fireEvent(target, escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('list', { name: 'Queue order' })).not.toBeInTheDocument();
    expect(screen.getByTestId('progress-expansion')).toBeInTheDocument();
    const change = queue().getByRole('button', { name: 'Change order' });
    await waitFor(() => expect(document.activeElement).toBe(change));
    fireEvent.keyDown(change, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('FarmExpansion: after a write (R-C-8, §3.3)', () => {
  it('Back to automatic with one queued, so no Change order, hands focus to Copy plan', async () => {
    const { queue } = renderPanel([{ id: 'Ann', cell: need(5, 1) }, { id: 'Bea', cell: { state: 'have', priorityRank: 2 } }]);
    await settled();
    fireEvent.click(queue().getByRole('button', { name: 'Back to automatic' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Copy plan' })));
    expect(server.sent()).toEqual([[]]);
  });

  it('Log drop\'s main part follows the saved order after the refresh', async () => {
    const { queue } = renderPanel(THREE);
    await settled();
    expect(screen.getByRole('button', { name: 'Log drop for Bea' })).toBeInTheDocument();
    fireEvent.click(queue().getByRole('button', { name: 'Change order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Ann up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save order' }));
    expect(await screen.findByRole('button', { name: 'Log drop for Ann' })).toBeInTheDocument();
    expect(query('Log drop for Bea')).not.toBeInTheDocument();
    expect(server.sent()).toEqual([['Ann', 'Bea', 'Cy']]);
  });
});
