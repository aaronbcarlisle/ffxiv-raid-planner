/**
 * R-E2-N: the revert checkbox and the "This will:" preview line share ONE
 * condition — `(entry.method === 'drop' || entry.method === 'book') &&
 * !entry.isExtra` (the exact condition `lootCoordination.ts`'s
 * `deleteLootAndRevertGear` reverts on). Legacy always reverts
 * (phase-d-loot-design.md:781-788), so the checkbox defaults to CHECKED for
 * both drop and book — a deliberate destructive-default change for books.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { DeleteLootConfirmModal } from './DeleteLootConfirmModal';
import type { LootLogEntry } from '../../types';

beforeEach(() => {
  // jsdom has no matchMedia; Modal -> useDevice depends on it.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

function makeEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: 1,
    tierSnapshotId: 't1',
    weekNumber: 3,
    floor: 'M12S',
    itemSlot: 'body',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Alice',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-06-24T12:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'alice',
    ...overrides,
  };
}

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  playerName: 'Alice',
};

describe('DeleteLootConfirmModal — R-E2-N (Book revert)', () => {
  it('a drop entry shows the revert checkbox, checked by default', () => {
    render(
      <DeleteLootConfirmModal {...baseProps} entry={makeEntry({ method: 'drop' })} onConfirm={vi.fn()} />,
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  it('a book entry ALSO shows the revert checkbox, checked by default (the changed destructive default)', () => {
    render(
      <DeleteLootConfirmModal {...baseProps} entry={makeEntry({ method: 'book' })} onConfirm={vi.fn()} />,
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  it('an extra-loot drop shows NO checkbox and NO revert line in "This will:"', () => {
    render(
      <DeleteLootConfirmModal
        {...baseProps}
        entry={makeEntry({ method: 'drop', isExtra: true })}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Uncheck .* on Alice's player card/)).not.toBeInTheDocument();
    // The base removal line is still there.
    expect(screen.getByText(/Remove .* from Week 3 loot log/)).toBeInTheDocument();
  });

  it('an extra-loot book also shows no checkbox and no revert line', () => {
    render(
      <DeleteLootConfirmModal
        {...baseProps}
        entry={makeEntry({ method: 'book', isExtra: true })}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Uncheck .* on Alice's player card/)).not.toBeInTheDocument();
  });

  it('a tome/purchase entry (neither drop nor book) shows no checkbox and no revert line', () => {
    render(
      <DeleteLootConfirmModal {...baseProps} entry={makeEntry({ method: 'tome' })} onConfirm={vi.fn()} />,
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Uncheck .* on Alice's player card/)).not.toBeInTheDocument();
  });

  it('the preview line agrees with the checkbox: present while checked, gone when unchecked', () => {
    render(
      <DeleteLootConfirmModal {...baseProps} entry={makeEntry({ method: 'book' })} onConfirm={vi.fn()} />,
    );
    expect(screen.getByText(/Uncheck .* on Alice's player card/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.queryByText(/Uncheck .* on Alice's player card/)).not.toBeInTheDocument();
  });

  it('confirm passes revertGear=true through by default for a book', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <DeleteLootConfirmModal {...baseProps} entry={makeEntry({ method: 'book' })} onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete Entry' }));
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it('unchecking the box passes revertGear=false through on confirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <DeleteLootConfirmModal {...baseProps} entry={makeEntry({ method: 'drop' })} onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Entry' }));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it('an extra-loot entry (no checkbox at all) confirms with revertGear=false', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <DeleteLootConfirmModal
        {...baseProps}
        entry={makeEntry({ method: 'drop', isExtra: true })}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete Entry' }));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });
});
