/**
 * useRosterCardActions — audited v2 kebab + reused modal components.
 *
 * These tests assert COMPOSITION, not modal internals: the reused modal
 * components are mocked to lightweight stubs so we can verify the hook wires
 * the right modal to the right menu item. The menu itself is the *audited*
 * one (Lodestone Sync, Adjust Priority, Edit Books are re-homed OUT).
 */
import { renderHook, act, render, fireEvent, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SnapshotPlayer } from '../types';
import type { ContextMenuItem } from '../components/ui';
import { useToastStore } from '../stores/toastStore';

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
const { bisImportPropsLog } = vi.hoisted(() => ({
  bisImportPropsLog: [] as Array<Record<string, unknown>>,
}));
vi.mock('../components/player/BiSImportModal', () => ({
  BiSImportModal: (p: { isOpen: boolean } & Record<string, unknown>) => {
    bisImportPropsLog.push(p);
    return p.isOpen ? <div data-testid="bis-import" /> : null;
  },
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
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    ...overrides,
  }) as unknown as SnapshotPlayer;

beforeEach(() => {
  bisImportPropsLog.length = 0;
  useToastStore.setState({ toasts: [] });
});

/** Flatten menu items to their visible text (label | sectionHeader | sentinel). */
function labelOrHeader(i: ContextMenuItem): string {
  if ('separator' in i && i.separator) return '__sep__';
  if ('sectionHeader' in i && i.sectionHeader) return i.sectionHeader;
  if ('label' in i && i.label) return i.label;
  return '__';
}

describe('useRosterCardActions', () => {
  it('builds the audited menu (no Lodestone / Adjust Priority; no Edit Books without a host handler)', () => {
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
    // Books EDITING stayed re-homed (BookLedgerCard owns it); C7 adds only a
    // NAVIGATION item, and only when the host supplies its handler.
    expect(labels).not.toContain('Edit Books');
    expect(labels).not.toContain('Loot Priority');
  });

  // ── C7 (D-05): the "Edit Books" jump ──
  // F6c re-homed the books EDITING surface out of the kebab (BookLedgerCard is
  // its home, Loot §5.7) — that stands. What legacy's item actually did was
  // NAVIGATE to that home's row (`PlayerCard.tsx:388-398` →
  // `handleNavigateToBooksPanel`), and D-05 (ruled 2026-07-26) restores the
  // jump. Its gate is legacy's: owner/lead/admin on any card, a member on
  // their own.
  describe('Edit Books jump (C7, D-05)', () => {
    const withJump = (extra: Partial<typeof base> = {}) => ({
      ...base,
      ...extra,
      actions: { ...base.actions, onEditBooks: vi.fn() },
    });

    it('appears for an owner and calls the navigation handler', () => {
      const params = withJump();
      const { result } = renderHook(() => useRosterCardActions({ ...params, player: makePlayer() }));
      const item = result.current.menuItems.find((i) => 'label' in i && i.label === 'Edit Books');

      expect(item).toBeDefined();
      act(() => {
        (item as Extract<ContextMenuItem, { label: string }>).onClick?.();
      });
      expect(params.actions.onEditBooks).toHaveBeenCalledTimes(1);
    });

    it("stays hidden for a member on someone else's card", () => {
      const { result } = renderHook(() =>
        useRosterCardActions({
          ...withJump({ userRole: 'member', currentUserId: 'u1' }),
          player: makePlayer({ userId: 'u9' }),
        }),
      );
      expect(result.current.menuItems.map(labelOrHeader)).not.toContain('Edit Books');
    });

    it('appears for a member on their OWN claimed card (legacy self-service parity)', () => {
      const { result } = renderHook(() =>
        useRosterCardActions({
          ...withJump({ userRole: 'member', currentUserId: 'u1' }),
          player: makePlayer({ userId: 'u1' }),
        }),
      );
      expect(result.current.menuItems.map(labelOrHeader)).toContain('Edit Books');
    });

    it('stays hidden for a viewer', () => {
      const { result } = renderHook(() =>
        useRosterCardActions({
          ...withJump({ userRole: 'viewer' }),
          player: makePlayer(),
        }),
      );
      expect(result.current.menuItems.map(labelOrHeader)).not.toContain('Edit Books');
    });
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

  it('shows Take Ownership present + ENABLED for a logged-in member on an unclaimed card', () => {
    // Regression: the hook must NOT gate Take/Release via canClaimPlayer (which
    // early-returns disabled without a hasMembership arg). Legacy inline
    // visibility: unclaimed card + logged-in user + handler + !userHasClaimedPlayer.
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        userRole: 'member',
        currentUserId: 'u1',
        userHasClaimedPlayer: false,
        player: makePlayer({ userId: undefined }),
        actions: { onUpdate: vi.fn(), onCopy: vi.fn(), onDuplicate: vi.fn(), onClaimPlayer: vi.fn() },
      }),
    );
    const take = result.current.menuItems.find((i) => 'label' in i && i.label === 'Take Ownership');
    expect(take).toBeDefined();
    expect(take && 'disabled' in take ? take.disabled : undefined).toBeFalsy();
  });

  it('shows Release Ownership present + ENABLED on a card claimed by the current user', () => {
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        userRole: 'member',
        currentUserId: 'u1',
        player: makePlayer({ userId: 'u1' }),
        actions: { onUpdate: vi.fn(), onCopy: vi.fn(), onDuplicate: vi.fn(), onReleasePlayer: vi.fn() },
      }),
    );
    const release = result.current.menuItems.find(
      (i) => 'label' in i && i.label === 'Release Ownership',
    );
    expect(release).toBeDefined();
    expect(release && 'disabled' in release ? release.disabled : undefined).toBeFalsy();
  });

  it('hides Take Ownership when the current user has already claimed another card', () => {
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        userRole: 'member',
        currentUserId: 'u1',
        userHasClaimedPlayer: true,
        player: makePlayer({ userId: undefined }),
        actions: { onUpdate: vi.fn(), onCopy: vi.fn(), onDuplicate: vi.fn(), onClaimPlayer: vi.fn() },
      }),
    );
    expect(result.current.menuItems.map(labelOrHeader)).not.toContain('Take Ownership');
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

  it('adds the tome-weapon toggle to BiS & Gear, directly after Weapon Priorities', () => {
    const { result } = renderHook(() => useRosterCardActions({ ...base, player: makePlayer() }));
    const labels = result.current.menuItems.map(labelOrHeader);

    expect(labels).toContain('Track Tome Weapon');
    // Inside the BiS & Gear section (before the next section header)…
    const idx = labels.indexOf('Track Tome Weapon');
    expect(idx).toBeGreaterThan(labels.indexOf('BiS & Gear'));
    expect(idx).toBeLessThan(labels.indexOf('Player Management'));
    // …immediately after its weapon-slot sibling.
    expect(labels[labels.indexOf('Weapon Priorities') + 1]).toBe('Track Tome Weapon');
  });

  it('flips the label to Stop Tracking Tome Weapon while pursuing', () => {
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        player: makePlayer({ tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false } }),
      }),
    );
    const labels = result.current.menuItems.map(labelOrHeader);
    expect(labels).toContain('Stop Tracking Tome Weapon');
    expect(labels).not.toContain('Track Tome Weapon');
  });

  it('disables the tome-weapon toggle for a viewer', () => {
    const { result } = renderHook(() =>
      useRosterCardActions({ ...base, userRole: 'viewer', player: makePlayer() }),
    );
    const item = result.current.menuItems.find(
      (i) => 'label' in i && i.label === 'Track Tome Weapon',
    );
    expect(item).toBeDefined();
    expect(item && 'disabled' in item ? item.disabled : undefined).toBe(true);
  });

  it('onClick toggles pursuing via actions.onUpdate (spread of the existing status)', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        player: makePlayer(),
        actions: { onUpdate, onCopy: vi.fn(), onDuplicate: vi.fn() },
      }),
    );
    const item = result.current.menuItems.find(
      (i) => 'label' in i && i.label === 'Track Tome Weapon',
    );
    expect(item).toBeDefined();
    act(() => {
      if (item && 'onClick' in item) item.onClick?.();
    });
    expect(onUpdate).toHaveBeenCalledWith({
      tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false },
    });
  });

  it('preserves hasItem/isAugmented through the flip (spread, not clobber)', () => {
    // The all-true fixture distinguishes the real `...player.tomeWeapon` spread
    // from a mutant that hardcodes hasItem/isAugmented false — and pins the
    // true→false pursuing direction at the same time.
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        player: makePlayer({ tomeWeapon: { pursuing: true, hasItem: true, isAugmented: true } }),
        actions: { onUpdate, onCopy: vi.fn(), onDuplicate: vi.fn() },
      }),
    );
    const item = result.current.menuItems.find(
      (i) => 'label' in i && i.label === 'Stop Tracking Tome Weapon',
    );
    expect(item).toBeDefined();
    act(() => {
      if (item && 'onClick' in item) item.onClick?.();
    });
    expect(onUpdate).toHaveBeenCalledWith({
      tomeWeapon: { pursuing: false, hasItem: true, isAugmented: true },
    });
  });
});

// A10: both sites void'd actions.onUpdate, which re-throws (tierStore rollback
// contract) — a rejected import/unlink escaped as an unhandled rejection.
describe("useRosterCardActions — A10 void'd-promise fixes", () => {
  it('BiS import onImport: a rejected onUpdate surfaces an error toast instead of an unhandled rejection', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('import failed'));
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        player: makePlayer(),
        actions: { onUpdate, onCopy: vi.fn(), onDuplicate: vi.fn() },
      }),
    );
    render(<>{result.current.modalsNode}</>);
    // BiSImportModal renders unconditionally (isOpen-gated internally), so its
    // props — including onImport — are captured without opening the modal.
    const props = bisImportPropsLog[bisImportPropsLog.length - 1];
    await act(async () => {
      await (props.onImport as (u: { gear: never[]; bisLink?: string }) => Promise<void> | void)({
        gear: [],
        bisLink: 'https://xivgear.app/#/x',
      });
    });
    expect(onUpdate).toHaveBeenCalledWith({ gear: [], bisLink: 'https://xivgear.app/#/x' });
    expect(useToastStore.getState().toasts.some(
      (t) => t.type === 'error' && t.message === 'import failed',
    )).toBe(true);
  });

  it('Unlink BiS confirm: a rejected onUpdate surfaces an error toast (and still fired the update)', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('unlink failed'));
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        player: makePlayer({ bisLink: 'https://xivgear.app/#/x' }),
        actions: { onUpdate, onCopy: vi.fn(), onDuplicate: vi.fn() },
      }),
    );
    const item = result.current.menuItems.find((i) => 'label' in i && i.label === 'Unlink BiS')!;
    act(() => {
      if ('onClick' in item) item.onClick?.();
    });
    render(<>{result.current.modalsNode}</>);
    fireEvent.click(screen.getByRole('button', { name: 'Unlink BiS' }));
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === 'unlink failed',
      )).toBe(true);
    });
    expect(onUpdate).toHaveBeenCalledWith({ bisLink: '' });
  });
});

// Whole-branch review Finding 1: the tome-toggle and Mark-as-Sub/Main items'
// onClick handed a bare `() => actions.onUpdate(...)` promise straight to
// ContextMenuItem.onClick (`() => void`), dropping it — a rejection (onUpdate
// re-throws per the tierStore rollback contract) escaped as an unhandled
// rejection instead of surfacing an error toast.
describe('useRosterCardActions — whole-branch review: kebab direct-action guards', () => {
  it('tome-weapon toggle: a rejected onUpdate surfaces an error toast instead of an unhandled rejection', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('tome toggle failed'));
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        player: makePlayer(),
        actions: { onUpdate, onCopy: vi.fn(), onDuplicate: vi.fn() },
      }),
    );
    const item = result.current.menuItems.find(
      (i) => 'label' in i && i.label === 'Track Tome Weapon',
    )!;
    await act(async () => {
      if ('onClick' in item) await item.onClick?.();
    });
    expect(onUpdate).toHaveBeenCalledWith({
      tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false },
    });
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === 'tome toggle failed',
      )).toBe(true);
    });
  });

  it('Mark as Sub: onClick toggles isSubstitute via actions.onUpdate', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        player: makePlayer({ isSubstitute: false }),
        actions: { onUpdate, onCopy: vi.fn(), onDuplicate: vi.fn() },
      }),
    );
    const item = result.current.menuItems.find((i) => 'label' in i && i.label === 'Mark as Sub')!;
    act(() => {
      if ('onClick' in item) item.onClick?.();
    });
    expect(onUpdate).toHaveBeenCalledWith({ isSubstitute: true });
  });

  it('Mark as Sub/Main: a rejected onUpdate surfaces an error toast instead of an unhandled rejection', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('sub status failed'));
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        player: makePlayer({ isSubstitute: false }),
        actions: { onUpdate, onCopy: vi.fn(), onDuplicate: vi.fn() },
      }),
    );
    const item = result.current.menuItems.find((i) => 'label' in i && i.label === 'Mark as Sub')!;
    await act(async () => {
      if ('onClick' in item) await item.onClick?.();
    });
    expect(onUpdate).toHaveBeenCalledWith({ isSubstitute: true });
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some(
        (t) => t.type === 'error' && t.message === 'sub status failed',
      )).toBe(true);
    });
  });
});
