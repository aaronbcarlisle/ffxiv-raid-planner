import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LogDropModal } from './LogDropModal';
import type { CollectionGoal, ParticipantStateEntry } from '../../stores/collectionGoalStore';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Radix Select can't be opened in jsdom; render its options as a plain list.
vi.mock('../ui/Select', () => ({
  Select: ({ options }: { options: { value: string; label: string }[] }) => (
    <ul aria-label="Recipient options">
      {options.map((o) => (
        <li key={o.value}>{o.label}</li>
      ))}
    </ul>
  ),
}));

const goal = { id: 'goal-1', title: 'Shiny Mount' } as unknown as CollectionGoal;

const entry = (userId: string, name: string, memberRole: string | null): ParticipantStateEntry =>
  ({
    id: `ps-${userId}`,
    goalId: 'goal-1',
    userId,
    staticGroupId: 'g1',
    state: 'need',
    tokenCount: null,
    priorityRank: null,
    source: 'manual',
    lastSyncedAt: null,
    notes: null,
    updatedAt: '2026-09-30T00:00:00Z',
    displayName: name,
    memberRole,
  }) as ParticipantStateEntry;

const participants = [entry('me', 'Me', 'member'), entry('other', 'Other', 'member'), entry('v', 'Viewer', 'viewer')];

function optionLabels(): string[] {
  return screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
}

function renderModal(canManage: boolean, list = participants) {
  return render(
    <LogDropModal
      isOpen
      onClose={vi.fn()}
      goal={goal}
      groupId="g1"
      participants={list}
      currentUserId="me"
      canManage={canManage}
    />,
  );
}

describe('LogDropModal recipients', () => {
  it('offers a non-manager only themselves plus no specific recipient', () => {
    renderModal(false);
    const labels = optionLabels();
    expect(labels).toHaveLength(2);
    expect(labels[0]).toBe('No specific recipient');
    expect(labels[1]).toMatch(/^Me /);
  });

  it('offers a manager every non-viewer member, never a viewer', () => {
    renderModal(true);
    const labels = optionLabels();
    expect(labels).toHaveLength(3);
    expect(labels.some((l) => l.startsWith('Me '))).toBe(true);
    expect(labels.some((l) => l.startsWith('Other '))).toBe(true);
    expect(labels.some((l) => l.startsWith('Viewer'))).toBe(false);
  });

  it('offers a non-manager who is not a participant only no specific recipient', () => {
    renderModal(false, [entry('other', 'Other', 'member')]);
    expect(optionLabels()).toEqual(['No specific recipient']);
  });

  it('excludes participants whose role is unknown (no longer members)', () => {
    renderModal(true, [entry('me', 'Me', 'member'), entry('gone', 'Gone', null)]);
    expect(optionLabels().some((l) => l.startsWith('Gone'))).toBe(false);
  });
});
