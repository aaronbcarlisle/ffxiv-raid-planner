/**
 * CellPicker (S2a-2·F5 Task TF7; R-S2-10, R-S2-11): the popover behind a member's own
 * Progress cell. The REAL store runs over a mocked api, and the harness rebuilds the cell
 * from the store on every render, so a pick's merge, the toasts and the Undo round trip
 * are what the page would see.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({}),
      put: vi.fn().mockResolvedValue({}),
      patch: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
});

import { api, ApiError } from '../../services/api';
import { useCollectionGoalStore, type CollectionGoal, type ParticipantStateEntry } from '../../stores/collectionGoalStore';
import { useToastStore } from '../../stores/toastStore';
import type { SnapshotPlayer } from '../../types';
import { cellAccessibleName, cellFor, cellText, type ProgressColumn } from '../../utils/progressModel';
import { goal, row } from './__fixtures__/progressFixtures';
import { stubCanHover } from './__fixtures__/tooltipEnv';
import { CellPicker, type CellWriteTarget } from './CellPicker';

const AYA: ProgressColumn = {
  kind: 'claimed',
  key: 'p1',
  name: 'Aya',
  userId: 'u1',
  player: { id: 'p1', name: 'Aya', job: 'PLD', role: 'tank', userId: 'u1', configured: true } as unknown as SnapshotPlayer,
};

interface HarnessProps {
  goalOverrides?: Partial<CollectionGoal>;
  write?: CellWriteTarget;
}

/** The picker over the store's cell for Aya (u1, a member) on the goal "wings". */
function Harness({ goalOverrides, write }: HarnessProps) {
  const participants = useCollectionGoalStore((s) => s.participants);
  const recordOnly = useCollectionGoalStore((s) => s.recordOnly);
  const g = goal('wings', { title: 'Wings of Resolve', tokenName: null, ...goalOverrides });
  const cell = cellFor(AYA, { participants: participants.wings, recordOnly: recordOnly.wings }, { currentUserId: 'u1', userRole: 'member' });
  const name = cellAccessibleName(cell, g);
  return (
    <CellPicker cell={cell} goal={g} write={write ?? { groupId: 'g1' }} label={`${name} — change your status`}>
      <span>{cellText(cell, g) || 'Set status'}</span>
    </CellPicker>
  );
}

/** The server's row for Aya after a write; `undo_token` as given (absent = null). */
const written = (extra: Record<string, unknown> = {}, undoToken: string | null = 'tok-1') => ({
  id: 'wings-u1', goal_id: 'wings', user_id: 'u1', static_group_id: 'g1', state: 'need', token_count: null, priority_rank: null,
  source: 'manual', last_synced_at: null, notes: null, updated_at: '2026-10-09T00:00:00Z', display_name: 'Aya', member_role: 'member',
  ...extra,
  undo_token: undoToken,
});

function seed(rows: ParticipantStateEntry[]) {
  useCollectionGoalStore.setState({ participants: { wings: rows }, recordOnly: {} });
}

const trigger = () => screen.getByRole('button', { name: /change your status$/ });
const group = () => screen.getByRole('group', { name: 'Status' });
const option = (name: string) => within(group()).getByRole('button', { name });
const toasts = () => useToastStore.getState().toasts;

function open() {
  const t = trigger();
  act(() => t.focus());
  fireEvent.click(t);
  return t;
}

beforeEach(() => {
  vi.clearAllMocks();
  stubCanHover();
});

afterEach(() => {
  vi.unstubAllGlobals();
  useCollectionGoalStore.setState({ participants: {}, recordOnly: {} });
  useToastStore.getState().clearAll();
});

describe('CellPicker: the popover', () => {
  it('opens a popover, not a modal, with four state buttons in a "Status" group and the current one pressed', () => {
    seed([row('wings', 'u1', { state: 'want', tokenCount: 30 })]);
    render(<Harness />);
    open();

    expect(document.querySelector('[data-radix-popper-content-wrapper]')).not.toBeNull();
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
    const buttons = within(group()).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Need', '★ Want', '✓ Have', '– Pass']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false']);
  });

  it('adds a "Totems" NumberInput (min 0) prefilled with the cell\'s count on a token farm', () => {
    seed([row('wings', 'u1', { state: 'need', tokenCount: 62 })]);
    render(<Harness />);
    open();

    const input = screen.getByLabelText('Totems');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveValue(62);
    expect(input).toBeEnabled();
  });

  it('labels the field with the goal\'s token name when it has one', () => {
    seed([row('wings', 'u1', { state: 'need' })]);
    render(<Harness goalOverrides={{ tokenName: 'Tokens' }} />);
    open();
    expect(screen.getByLabelText('Tokens')).toBeInTheDocument();
  });

  it('shows no count field on a farm with no token cost or name', () => {
    seed([row('wings', 'u1', { state: 'need' })]);
    render(<Harness goalOverrides={{ tokenCost: null }} />);
    open();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('disables the count with "Pick a status first" on a blank cell', () => {
    seed([]);
    render(<Harness />);
    open();
    expect(screen.getByLabelText('Totems')).toBeDisabled();
    expect(screen.getByText('Pick a status first')).toBeInTheDocument();
  });

  it('hides the count field when the count is hidden from the reader (View As of a flagged member)', () => {
    seed([row('wings', 'u1', { state: 'need', tokenCount: null, countHidden: true })]);
    render(<Harness write={{ groupId: 'g1', targetUserId: 'u1' }} />);
    open();
    expect(group()).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the cell\'s button', async () => {
    seed([row('wings', 'u1', { state: 'need' })]);
    render(<Harness />);
    const t = open();
    expect(option('Need')).toHaveFocus();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(screen.queryByRole('group', { name: 'Status' })).not.toBeInTheDocument();
    await waitFor(() => expect(t).toHaveFocus());
  });
});

describe('CellPicker: picking a state', () => {
  it('sends the self route with the state and a null count, updates the cell with no goal refetch, closes, and toasts "Need saved" with Undo', async () => {
    seed([row('wings', 'u1', { state: 'want', tokenCount: 30 })]);
    vi.mocked(api.patch).mockResolvedValue(written({ state: 'need', token_count: 30 }));
    render(<Harness />);
    const t = open();

    fireEvent.click(option('Need'));

    expect(api.patch).toHaveBeenCalledWith('/api/static-groups/g1/collection-goals/wings/participants', { state: 'need', token_count: null });
    expect(await screen.findByText('Need 30/99')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Status' })).not.toBeInTheDocument();
    await waitFor(() => expect(t).toHaveFocus());
    expect(api.get).not.toHaveBeenCalled();
    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0]).toMatchObject({ type: 'success', message: 'Need saved' });
    expect(toasts()[0].action?.label).toBe('Undo');
  });

  it('Undo posts the token, refetches, and toasts "Undone"', async () => {
    seed([row('wings', 'u1', { state: 'want' })]);
    vi.mocked(api.patch).mockResolvedValue(written({ state: 'have' }, 'tok-9'));
    vi.mocked(api.post).mockResolvedValue({ restored: 1, skipped: 0 });
    vi.mocked(api.get).mockResolvedValue([{ goal_id: 'wings', participants: [written({ state: 'want' })], record_only: [] }]);
    render(<Harness />);
    open();
    fireEvent.click(option('✓ Have'));
    await waitFor(() => expect(toasts()).toHaveLength(1));

    act(() => toasts()[0].action?.onClick());

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/static-groups/g1/collection-participants/undo', { token: 'tok-9' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/static-groups/g1/collection-participants'));
    expect(await screen.findByText('★ Want')).toBeInTheDocument();
    await waitFor(() => expect(toasts().map((x) => x.message)).toContain('Undone'));
  });

  it('a skipped part toasts "Couldn\'t undo: it changed since"', async () => {
    seed([row('wings', 'u1', { state: 'want' })]);
    vi.mocked(api.patch).mockResolvedValue(written({ state: 'have' }, 'tok-9'));
    vi.mocked(api.post).mockResolvedValue({ restored: 0, skipped: 1 });
    render(<Harness />);
    open();
    fireEvent.click(option('✓ Have'));
    await waitFor(() => expect(toasts()).toHaveLength(1));

    act(() => toasts()[0].action?.onClick());

    await waitFor(() => expect(toasts().map((x) => [x.type, x.message])).toContainEqual(['warning', 'Couldn\'t undo: it changed since']));
  });

  it('toasts "Need saved" with no Undo when the server returned no token', async () => {
    seed([row('wings', 'u1', { state: 'want' })]);
    vi.mocked(api.patch).mockResolvedValue(written({ state: 'need' }, null));
    render(<Harness />);
    open();

    fireEvent.click(option('Need'));

    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0]).toMatchObject({ type: 'success', message: 'Need saved' });
    expect(toasts()[0].action).toBeUndefined();
  });

  it('writes the lead route aimed at the target user when the write names one (View As)', async () => {
    seed([row('wings', 'u1', { state: 'want' })]);
    vi.mocked(api.patch).mockResolvedValue(written({ state: 'pass' }));
    render(<Harness write={{ groupId: 'g1', targetUserId: 'u1' }} />);
    open();

    fireEvent.click(option('– Pass'));

    expect(api.patch).toHaveBeenCalledWith('/api/static-groups/g1/collection-goals/wings/participants/u1', { state: 'pass', token_count: null });
    await waitFor(() => expect(toasts()[0]?.message).toBe('Pass saved'));
  });

  it('leaves the cell as it was and shows nothing optimistic when the PATCH fails, toasting the failure once', async () => {
    seed([row('wings', 'u1', { state: 'need', tokenCount: 62 })]);
    vi.mocked(api.patch).mockRejectedValue(new Error('boom'));
    render(<Harness />);
    open();

    fireEvent.click(option('✓ Have'));

    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0]).toMatchObject({ type: 'error' });
    expect(toasts()[0].message).toContain('boom');
    expect(screen.getByText('Need 62/99')).toBeInTheDocument();
    open();
    expect(option('Need')).toHaveAttribute('aria-pressed', 'true');
    expect(option('✓ Have')).toHaveAttribute('aria-pressed', 'false');
  });

  it('adds no second toast when the api already toasted the failure (a true 403)', async () => {
    seed([row('wings', 'u1', { state: 'need' })]);
    vi.mocked(api.patch).mockRejectedValue(new ApiError(403, 'Forbidden', true));
    render(<Harness />);
    open();

    fireEvent.click(option('✓ Have'));

    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    await act(async () => {});
    expect(toasts()).toHaveLength(0);
    expect(screen.getByText('Need')).toBeInTheDocument();
  });
});

describe('CellPicker: the count', () => {
  const count = () => screen.getByLabelText('Totems');

  it('commits on Enter (the field\'s submit) with the cell\'s current state and toasts "Totems saved"', async () => {
    seed([row('wings', 'u1', { state: 'need', tokenCount: 62 })]);
    vi.mocked(api.patch).mockResolvedValue(written({ state: 'need', token_count: 70 }));
    render(<Harness />);
    open();

    fireEvent.change(count(), { target: { value: '70' } });
    fireEvent.submit(count());

    expect(api.patch).toHaveBeenCalledWith('/api/static-groups/g1/collection-goals/wings/participants', { state: 'need', token_count: 70 });
    expect(await screen.findByText('Need 70/99')).toBeInTheDocument();
    await waitFor(() => expect(toasts()[0]?.message).toBe('Totems saved'));
    expect(toasts()[0].action?.label).toBe('Undo');
    // The field stays open for more: nothing closed.
    expect(group()).toBeInTheDocument();
  });

  it('commits on blur, under the goal\'s token name', async () => {
    seed([row('wings', 'u1', { state: 'want', tokenCount: null })]);
    vi.mocked(api.patch).mockResolvedValue(written({ state: 'want', token_count: 5 }));
    render(<Harness goalOverrides={{ tokenName: 'Tokens' }} />);
    open();

    fireEvent.change(screen.getByLabelText('Tokens'), { target: { value: '5' } });
    fireEvent.blur(screen.getByLabelText('Tokens'));

    expect(api.patch).toHaveBeenCalledWith('/api/static-groups/g1/collection-goals/wings/participants', { state: 'want', token_count: 5 });
    await waitFor(() => expect(toasts()[0]?.message).toBe('Tokens saved'));
  });

  it('sends nothing for an empty or unchanged value, and nothing twice for one value', async () => {
    seed([row('wings', 'u1', { state: 'need', tokenCount: 62 })]);
    vi.mocked(api.patch).mockResolvedValue(written({ state: 'need', token_count: 70 }));
    render(<Harness />);
    open();

    fireEvent.submit(count());
    fireEvent.blur(count());
    fireEvent.change(count(), { target: { value: '' } });
    fireEvent.submit(count());
    expect(api.patch).not.toHaveBeenCalled();

    fireEvent.change(count(), { target: { value: '70' } });
    fireEvent.submit(count());
    fireEvent.blur(count());
    expect(api.patch).toHaveBeenCalledTimes(1);
    await screen.findByText('Need 70/99');
  });

  it('carries a typed count into the pick when focus moved from the field to the status group', async () => {
    seed([row('wings', 'u1', { state: 'need', tokenCount: 62 })]);
    vi.mocked(api.patch).mockResolvedValue(written({ state: 'want', token_count: 70 }));
    render(<Harness />);
    open();

    fireEvent.change(count(), { target: { value: '70' } });
    fireEvent.blur(count(), { relatedTarget: option('★ Want') });
    expect(api.patch).not.toHaveBeenCalled();
    fireEvent.click(option('★ Want'));

    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(api.patch).toHaveBeenCalledWith('/api/static-groups/g1/collection-goals/wings/participants', { state: 'want', token_count: 70 });
    await waitFor(() => expect(toasts()[0]?.message).toBe('Want saved'));
  });

  it('resets the draft to the cell\'s count each time the picker opens', async () => {
    seed([row('wings', 'u1', { state: 'need', tokenCount: 62 })]);
    render(<Harness />);
    const t = open();
    fireEvent.change(count(), { target: { value: '70' } });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(t).toHaveFocus());

    open();
    expect(count()).toHaveValue(62);
    expect(api.patch).not.toHaveBeenCalled();
  });
});
