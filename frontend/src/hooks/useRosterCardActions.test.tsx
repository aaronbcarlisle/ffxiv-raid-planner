/**
 * useRosterCardActions — audited v2 kebab + reused modal components.
 *
 * These tests assert COMPOSITION, not modal internals: the reused modal
 * components are mocked to lightweight stubs so we can verify the hook wires
 * the right modal to the right menu item. The menu itself is the *audited*
 * one (Lodestone Sync, Adjust Priority, Edit Books are re-homed OUT).
 */
import { renderHook, act, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { SnapshotPlayer } from '../types';
import type { ContextMenuItem } from '../components/ui';

// jsdom has no matchMedia; the reused confirm <Modal> runs useDevice() even
// while closed (before its `if (!isOpen) return null`). Polyfill it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock the 5 reused modal components → assert composition, not their internals.
vi.mock('../components/player/BiSImportModal', () => ({
  BiSImportModal: (p: { isOpen: boolean }) => (p.isOpen ? <div data-testid="bis-import" /> : null),
}));
vi.mock('../components/bis/BiSTargetManagerModal', () => ({
  BiSTargetManagerModal: () => <div data-testid="bis-targets" />,
}));
vi.mock('../components/weapon-priority/WeaponPriorityModal', () => ({
  WeaponPriorityModal: (p: { isOpen: boolean }) => (p.isOpen ? <div data-testid="weapon-priority" /> : null),
}));
vi.mock('../components/player/FlexRolesModal', () => ({
  FlexRolesModal: (p: { isOpen: boolean }) => (p.isOpen ? <div data-testid="flex-roles" /> : null),
}));
vi.mock('../components/player/AssignUserModal', () => ({
  AssignUserModal: () => <div data-testid="assign-user" />,
}));

import { useRosterCardActions, type RosterCardActionParams } from './useRosterCardActions';

const base: Omit<RosterCardActionParams, 'player'> = {
  userRole: 'owner',
  currentUserId: 'u1',
  isAdminAccess: false,
  clipboardPlayer: null,
  groupId: 'g1',
  tierId: 't1',
  contentType: 'savage',
  actions: { onUpdate: vi.fn(), onCopy: vi.fn(), onDuplicate: vi.fn() },
};

const makePlayer = (overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer =>
  ({
    id: 'p1',
    name: 'Aria',
    job: 'PLD',
    role: 'tank',
    gear: [],
    weaponPriorities: [],
    isSubstitute: false,
    ...overrides,
  }) as unknown as SnapshotPlayer;

/** Flatten menu items to their visible text (label | sectionHeader | sentinel). */
function labelOrHeader(i: ContextMenuItem): string {
  if ('separator' in i && i.separator) return '__sep__';
  if ('sectionHeader' in i && i.sectionHeader) return i.sectionHeader;
  if ('label' in i && i.label) return i.label;
  return '__';
}

describe('useRosterCardActions', () => {
  it('builds the audited menu (no Lodestone / Adjust Priority / Edit Books)', () => {
    const { result } = renderHook(() => useRosterCardActions({ ...base, player: makePlayer() }));
    const labels = result.current.menuItems.map(labelOrHeader);

    // Kept
    expect(labels).toContain('Import BiS');
    expect(labels).toContain('BiS Targets');
    expect(labels).toContain('Weapon Priorities');
    expect(labels).toContain('Reset Gear');
    expect(labels).toContain('Remove Player');

    // Re-homed OUT
    expect(labels).not.toContain('Re-sync Lodestone');
    expect(labels).not.toContain('Lodestone Sync');
    expect(labels).not.toContain('Adjust Priority');
    expect(labels).not.toContain('Edit Books');
    expect(labels).not.toContain('Loot Priority');
  });

  it('orders sections BiS & Gear -> Player Management -> Clipboard (audited reorder)', () => {
    const { result } = renderHook(() => useRosterCardActions({ ...base, player: makePlayer() }));
    const headers = result.current.menuItems
      .filter((i): i is Extract<ContextMenuItem, { sectionHeader: string }> => 'sectionHeader' in i && !!i.sectionHeader)
      .map((i) => i.sectionHeader);
    expect(headers).toEqual(['BiS & Gear', 'Player Management', 'Clipboard']);
  });

  it('shows Unlink BiS only when the player has a bisLink', () => {
    const without = renderHook(() => useRosterCardActions({ ...base, player: makePlayer() }));
    expect(without.result.current.menuItems.map(labelOrHeader)).not.toContain('Unlink BiS');

    const withLink = renderHook(() =>
      useRosterCardActions({ ...base, player: makePlayer({ bisLink: 'https://xivgear.app/#/x' }) }),
    );
    expect(withLink.result.current.menuItems.map(labelOrHeader)).toContain('Unlink BiS');
  });

  it('gates management items for a member (Remove Player disabled)', () => {
    const { result } = renderHook(() =>
      useRosterCardActions({ ...base, userRole: 'member', player: makePlayer() }),
    );
    const remove = result.current.menuItems.find((i) => 'label' in i && i.label === 'Remove Player');
    expect(remove && 'disabled' in remove ? remove.disabled : undefined).toBe(true);
  });

  it('gates edit items for a viewer (Import BiS disabled)', () => {
    const { result } = renderHook(() =>
      useRosterCardActions({ ...base, userRole: 'viewer', player: makePlayer() }),
    );
    const importItem = result.current.menuItems.find((i) => 'label' in i && i.label === 'Import BiS');
    expect(importItem && 'disabled' in importItem ? importItem.disabled : undefined).toBe(true);
  });

  it('opens the BiS import modal via its menu item', () => {
    const { result } = renderHook(() => useRosterCardActions({ ...base, player: makePlayer() }));
    const item = result.current.menuItems.find((i) => 'label' in i && i.label === 'Import BiS')!;
    act(() => {
      if ('onClick' in item) item.onClick?.();
    });
    const { getByTestId } = render(<>{result.current.modalsNode}</>);
    expect(getByTestId('bis-import')).toBeInTheDocument();
  });
});
