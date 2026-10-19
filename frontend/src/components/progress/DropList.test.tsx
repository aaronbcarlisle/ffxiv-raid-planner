/**
 * DropList, "Last drops" (S2a-3a·G3 Task TG5; D-15, R-S3-9, R-S3-12, vet M-4): the three newest
 * drops and their lines, the recipient's name, the empty and loading lines, and a failed load
 * with Retry, alone and inside the real panel (whose other parts still render).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/api')>()),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from '../../services/api';
import type { RewardDrop } from '../../stores/collectionGoalStore';
import { apiDrop, farmRowOf, goal } from './__fixtures__/progressFixtures';
import { DropList } from './DropList';
import { FarmExpansion } from './FarmExpansion';
import type { DropsStatus } from './useDrops';

/** Week 1 starts 1 Sep; the clock reads week 3. */
const CLOCK = { currentWeek: 3, weekStartDate: '2026-09-01T00:00:00Z' };

function drop(id: string, droppedAt: string, overrides: Partial<RewardDrop> = {}): RewardDrop {
  return {
    id, goalId: 'wings', staticGroupId: 'g1', recipientUserId: 'u1', createdById: 'u1', quantity: 1, droppedAt, notes: null,
    createdAt: droppedAt, recipientDisplayName: 'Melee 1', recipientCharacterName: null, recipientPriorState: null, ...overrides,
  };
}

function renderList(drops: RewardDrop[], status: DropsStatus = 'loaded', onRetry = vi.fn()) {
  render(<DropList drops={drops} status={status} onRetry={onRetry} clock={CLOCK} />);
  return { onRetry, lines: () => screen.queryAllByRole('listitem').map((li) => li.textContent) };
}

describe('DropList lines', () => {
  it('shows the three newest, newest first, as "{week} · {name} · ×{n} · {note}"', () => {
    const { lines } = renderList([
      drop('d1', '2026-09-09T10:00:00Z', { notes: 'first clear' }),
      drop('d2', '2026-09-02T10:00:00Z'),
      drop('d3', '2026-09-16T10:00:00Z', { quantity: 2 }),
      drop('d4', '2026-09-15T10:00:00Z', { recipientUserId: null, recipientDisplayName: null }),
    ]);
    expect(lines()).toEqual(['Week 3 · Melee 1 · ×2', 'Week 3 · Nobody · ×1', 'Week 2 · Melee 1 · ×1 · first clear']);
  });

  it('names the recipient: the display name, else the character, else "Unknown member", with the character only when it differs', () => {
    const at = '2026-09-09T10:00:00Z';
    const cases: [Partial<RewardDrop>, string][] = [
      [{ recipientDisplayName: 'Melee 1', recipientCharacterName: 'Aria Moon' }, 'Melee 1 (Aria Moon)'],
      [{ recipientDisplayName: 'Aria Moon', recipientCharacterName: 'Aria Moon' }, 'Aria Moon'],
      [{ recipientDisplayName: null, recipientCharacterName: 'Aria Moon' }, 'Aria Moon'],
      [{ recipientDisplayName: null, recipientCharacterName: null }, 'Unknown member'],
      [{ recipientUserId: null, recipientDisplayName: 'Ghost', recipientCharacterName: 'Aria Moon' }, 'Nobody'],
    ];
    for (const [overrides, name] of cases) {
      const { lines } = renderList([drop('d1', at, overrides)]);
      expect(lines()).toEqual([`Week 2 · ${name} · ×1`]);
      document.body.replaceChildren();
    }
    // A V1-shaped drop with no character field at all reads the display name alone.
    const v1Shaped = drop('d1', at, { recipientCharacterName: 'unused' });
    delete v1Shaped.recipientCharacterName;
    expect('recipientCharacterName' in v1Shaped).toBe(false);
    expect(renderList([v1Shaped]).lines()).toEqual(['Week 2 · Melee 1 · ×1']);
  });

  it('reads "No drops logged yet." with none, and a loading line while the first load runs', () => {
    renderList([]);
    expect(screen.getByText('No drops logged yet.')).toBeInTheDocument();
    document.body.replaceChildren();
    renderList([], 'loading');
    expect(screen.getByRole('status')).toHaveTextContent('Loading drops…');
  });

  it('reads "Couldn\'t load drops" with a Retry Button on a failed load', () => {
    const { onRetry } = renderList([], 'failed');
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load drops");
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('DropList in the panel', () => {
  const DROPS = '/api/static-groups/g1/collection-goals/wings/drops';

  it('keeps the rest of the panel on a failed load, and Retry loads the drops again', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce([apiDrop('d1', 'u1', { recipient_display_name: 'Melee 1', dropped_at: '2026-09-09T10:00:00Z' })]);
    render(
      <table>
        <tbody>
          <FarmExpansion
            row={farmRowOf([{ id: 'u1', cell: { state: 'need', tokenCount: 4 } }], goal('wings', { title: 'Wings', summary: 'Tuesdays' }), 'member')}
            finished={false}
            canManage={false}
            userRole="member"
            currentUserId="me"
            groupId="g1"
            onClose={vi.fn()}
            id="progress-expansion-wings"
            spanAll={3}
            clock={CLOCK}
          />
        </tbody>
      </table>,
    );
    const drops = screen.getByTestId('progress-expansion-drops');
    expect(await within(drops).findByText("Couldn't load drops")).toBeInTheDocument();
    expect(within(screen.getByTestId('progress-expansion-queue')).getByText('u1 · Need 4/99')).toBeInTheDocument();
    expect(within(screen.getByTestId('progress-expansion-about')).getByText('Tuesdays')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy plan' })).toBeInTheDocument();

    fireEvent.click(within(drops).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(within(drops).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Week 2 · Melee 1 · ×1']));
    expect(vi.mocked(api.get).mock.calls).toEqual([[DROPS], [DROPS]]);
  });
});
