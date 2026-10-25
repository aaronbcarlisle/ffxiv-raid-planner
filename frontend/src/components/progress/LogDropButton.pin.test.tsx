/**
 * LogDropButton with a lead's pin (S2a-3c·C2 Task TC2; design D-2, E-5, R-C-4): the main part
 * names the pinned #1, since it reads the same `queueFor` as Next in line. Rendered alone; no
 * click, so no request is made (the log path is `LogDropButton.test.tsx`'s).
 */
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/api')>()),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../services/api';
import { farmRowOf, goal, type ColumnSpec } from './__fixtures__/progressFixtures';
import { LogDropButton } from './LogDropButton';

const WINGS = goal('wings', { title: 'Wings' });

afterEach(() => vi.clearAllMocks());

describe('LogDropButton with a pin (D-2)', () => {
  it('reads "Log drop for {the pinned #1}", not the automatic #1', () => {
    // Automatic: Bea (Need 10) first. Pinned: Dax (Need 30, #1) first; a pinned Want never leads.
    const specs: ColumnSpec[] = [
      { id: 'Cid', cell: { state: 'want', tokenCount: 0, priorityRank: 1 } },
      { id: 'Bea', cell: { state: 'need', tokenCount: 10 } },
      { id: 'Dax', cell: { state: 'need', tokenCount: 30, priorityRank: 1 } },
    ];
    render(<LogDropButton row={farmRowOf(specs, WINGS, 'lead')} groupId="g1" />);
    const group = screen.getByRole('group', { name: 'Log a drop' });
    expect(within(group).getByRole('button', { name: 'Log drop for Dax' })).toBeInTheDocument();
    expect(within(group).queryByRole('button', { name: 'Log drop for Bea' })).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
});
