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

    // ROLE-1 (R-R1-7): the page-ledger write is lead-only on the server today,
    // so the jump follows it. HS-36's member books return with W4 LOOT.
    it('stays hidden for a member on their OWN claimed card (the books write is lead-only)', () => {
      const { result } = renderHook(() =>
        useRosterCardActions({
          ...withJump({ userRole: 'member', currentUserId: 'u1' }),
          player: makePlayer({ userId: 'u1' }),
        }),
      );
      expect(result.current.menuItems.map(labelOrHeader)).not.toContain('Edit Books');
    });

    it('appears for a lead on any card', () => {
      const { result } = renderHook(() =>
        useRosterCardActions({
          ...withJump({ userRole: 'lead', currentUserId: 'u1' }),
          player: makePlayer({ userId: 'u9' }),
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

  // ROLE-1 (R-R1-5): role-gated items are omitted, never disabled.
  it('omits the management items for a member (Remove Player, Duplicate, Mark as Sub)', () => {
    const { result } = renderHook(() =>
      useRosterCardActions({ ...base, userRole: 'member', player: makePlayer() }),
    );
    const labels = result.current.menuItems.map(labelOrHeader);
    expect(labels).not.toContain('Remove Player');
    expect(labels).not.toContain('Duplicate');
    expect(labels).not.toContain('Mark as Sub');
  });

  it('omits the edit items for a viewer (Import BiS)', () => {
    const { result } = renderHook(() =>
      useRosterCardActions({ ...base, userRole: 'viewer', player: makePlayer() }),
    );
    expect(result.current.menuItems.map(labelOrHeader)).not.toContain('Import BiS');
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

  it('hides Take Ownership from a viewer who holds no card, but keeps Release on their own card', () => {
    const claim = {
      ...base,
      userRole: 'viewer' as const,
      currentUserId: 'u1',
      userHasClaimedPlayer: false,
    };
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...claim,
        player: makePlayer({ userId: undefined }),
        actions: { onUpdate: vi.fn(), onCopy: vi.fn(), onDuplicate: vi.fn(), onClaimPlayer: vi.fn() },
      }),
    );
    expect(result.current.menuItems.map(labelOrHeader)).not.toContain('Take Ownership');

    const { result: own } = renderHook(() =>
      useRosterCardActions({
        ...claim,
        player: makePlayer({ userId: 'u1' }),
        actions: { onUpdate: vi.fn(), onCopy: vi.fn(), onDuplicate: vi.fn(), onReleasePlayer: vi.fn() },
      }),
    );
    expect(own.current.menuItems.map(labelOrHeader)).toContain('Release Ownership');
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

  it('omits the tome-weapon toggle for a viewer (R-R1-5)', () => {
    const { result } = renderHook(() =>
      useRosterCardActions({ ...base, userRole: 'viewer', player: makePlayer() }),
    );
    const labels = result.current.menuItems.map(labelOrHeader);
    expect(labels).not.toContain('Track Tome Weapon');
    expect(labels).not.toContain('Stop Tracking Tome Weapon');
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

// ROLE-1 (W0): hide, never disable, on role (R-R1-0). A role-gated item is
// omitted (R-R1-5), the section it would have filled goes with it, and a
// separator never leads, trails, doubles up or hugs a header (vet F6). Take
// Ownership needs raid membership (R-R1-6); "Edit Books" follows the server's
// lead-only ledger write (R-R1-7). State-gated disables stay.
describe('useRosterCardActions — ROLE-1 role gating', () => {
  type Shape =
    | { kind: 'header'; label: string }
    | { kind: 'separator' }
    | { kind: 'item'; label: string; disabled: boolean };

  /** Kinds + labels + the disabled flag: what the menu will actually render. */
  function shape(items: ContextMenuItem[]): Shape[] {
    return items.map((i) => {
      if ('separator' in i && i.separator) return { kind: 'separator' };
      if ('sectionHeader' in i && i.sectionHeader) return { kind: 'header', label: i.sectionHeader };
      return { kind: 'item', label: i.label ?? '', disabled: !!i.disabled };
    });
  }

  /** No empty section; no leading, trailing, doubled or header-adjacent separator. */
  function expectWellFormed(items: ContextMenuItem[]) {
    const s = shape(items);
    s.forEach((cur, idx) => {
      const next = s[idx + 1];
      const prev = s[idx - 1];
      if (cur.kind === 'header') {
        expect(next, `empty section "${cur.label}" at ${idx}`).toBeDefined();
        expect(next?.kind, `section "${cur.label}" is followed by a ${next?.kind}`).toBe('item');
      }
      if (cur.kind === 'separator') {
        expect(prev?.kind, `separator at ${idx} after a ${prev?.kind ?? 'start'}`).toBe('item');
        expect(next?.kind, `separator at ${idx} before a ${next?.kind ?? 'end'}`).toBe('item');
      }
    });
  }

  /** Every handler the hook can advertise an item for. */
  const everyAction = () => ({
    onUpdate: vi.fn(),
    onCopy: vi.fn(),
    onCopyUrl: vi.fn(),
    onDuplicate: vi.fn(),
    onPaste: vi.fn(),
    onRemove: vi.fn(),
    onResetGear: vi.fn(),
    onClaimPlayer: vi.fn(),
    onReleasePlayer: vi.fn(),
    onOwnerAssignPlayer: vi.fn(),
    onAdminAssignPlayer: vi.fn(),
    onEditBooks: vi.fn(),
  });

  const labelsOf = (items: ContextMenuItem[]) => items.map(labelOrHeader);
  const itemsOf = (items: ContextMenuItem[]) =>
    items.filter((i): i is Extract<ContextMenuItem, { label: string }> => 'label' in i && !!i.label);

  it("member on another's claimed card: exactly BiS Targets, Copy and Copy URL under their headers, none disabled", () => {
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        userRole: 'member',
        currentUserId: 'u1',
        userHasClaimedPlayer: true,
        player: makePlayer({ userId: 'u9', bisLink: 'https://xivgear.app/#/x' }),
        actions: everyAction(),
      }),
    );
    const items = result.current.menuItems;
    expect(shape(items)).toEqual([
      { kind: 'header', label: 'BiS & Gear' },
      { kind: 'item', label: 'BiS Targets', disabled: false },
      { kind: 'header', label: 'Clipboard' },
      { kind: 'item', label: 'Copy', disabled: false },
      { kind: 'item', label: 'Copy URL', disabled: false },
    ]);
    expect(itemsOf(items).filter((i) => i.disabled)).toEqual([]);
    expectWellFormed(items);
  });

  it('member on their OWN card: keeps every own-card item; Mark as Sub, Duplicate, Remove Player and Edit Books are absent', () => {
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        userRole: 'member',
        currentUserId: 'u1',
        clipboardPlayer: makePlayer({ id: 'p2', name: 'Copied' }),
        player: makePlayer({ userId: 'u1' }),
        actions: everyAction(),
      }),
    );
    const items = result.current.menuItems;
    const labels = labelsOf(items);
    for (const kept of [
      'Import BiS',
      'BiS Targets',
      'Weapon Priorities',
      'Track Tome Weapon',
      'Reset Gear',
      'Release Ownership',
      'Flex Roles',
      'Copy',
      'Copy URL',
      'Paste',
    ]) {
      expect(labels, kept).toContain(kept);
    }
    for (const gone of ['Mark as Sub', 'Duplicate', 'Remove Player', 'Edit Books', 'Take Ownership']) {
      expect(labels, gone).not.toContain(gone);
    }
    expect(itemsOf(items).filter((i) => i.disabled)).toEqual([]);
    expectWellFormed(items);
  });

  it('signed-in non-member (userRole null) on an unclaimed card: no Take Ownership and no edit items (R-R1-6)', () => {
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        userRole: null,
        currentUserId: 'u1',
        userHasClaimedPlayer: false,
        player: makePlayer({ userId: undefined }),
        actions: everyAction(),
      }),
    );
    const items = result.current.menuItems;
    expect(itemsOf(items).map((i) => i.label)).toEqual(['BiS Targets', 'Copy', 'Copy URL']);
    expectWellFormed(items);
  });

  it('viewer on an unclaimed card: no Take Ownership, no edit items; self-Release stays (R-R1-6)', () => {
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        userRole: 'viewer',
        currentUserId: 'u1',
        userHasClaimedPlayer: false,
        player: makePlayer({ userId: undefined }),
        actions: everyAction(),
      }),
    );
    expect(itemsOf(result.current.menuItems).map((i) => i.label)).toEqual(['BiS Targets', 'Copy', 'Copy URL']);

    const { result: own } = renderHook(() =>
      useRosterCardActions({
        ...base,
        userRole: 'viewer',
        currentUserId: 'u1',
        player: makePlayer({ userId: 'u1' }),
        actions: everyAction(),
      }),
    );
    expect(itemsOf(own.current.menuItems).map((i) => i.label)).toEqual([
      'BiS Targets',
      'Release Ownership',
      'Copy',
      'Copy URL',
    ]);
    expectWellFormed(own.current.menuItems);
  });

  it('pin: a member on an unclaimed card who holds no card gets Take Ownership', () => {
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        userRole: 'member',
        currentUserId: 'u1',
        userHasClaimedPlayer: false,
        player: makePlayer({ userId: undefined }),
        actions: everyAction(),
      }),
    );
    const take = itemsOf(result.current.menuItems).find((i) => i.label === 'Take Ownership');
    expect(take).toBeDefined();
    expect(take?.disabled).toBeFalsy();
  });

  // Today's full owner list, in order. Take shows because the card is
  // unclaimed and the owner holds no card; Paste is enabled because the
  // clipboard holds a player.
  const OWNER_FULL = [
    'BiS & Gear',
    'Import BiS',
    'BiS Targets',
    'Weapon Priorities',
    'Edit Books',
    'Track Tome Weapon',
    'Reset Gear',
    'Player Management',
    'Take Ownership',
    'Flex Roles',
    'Mark as Sub',
    'Assign User',
    'Clipboard',
    'Copy',
    'Copy URL',
    'Paste',
    'Duplicate',
    '__sep__',
    'Remove Player',
  ];

  const fullParams = (role: RosterCardActionParams['userRole'], isAdminAccess = false) => ({
    ...base,
    userRole: role,
    isAdminAccess,
    currentUserId: 'u1',
    userHasClaimedPlayer: false,
    clipboardPlayer: makePlayer({ id: 'p2', name: 'Copied' }),
    player: makePlayer({ userId: undefined }),
    actions: everyAction(),
  });

  it("pin: the owner keeps today's full list, every item enabled", () => {
    const { result } = renderHook(() => useRosterCardActions(fullParams('owner')));
    expect(labelsOf(result.current.menuItems)).toEqual(OWNER_FULL);
    expect(itemsOf(result.current.menuItems).filter((i) => i.disabled)).toEqual([]);
    expectWellFormed(result.current.menuItems);
  });

  it("pin: a lead keeps today's full list (minus the owner-only Assign User), every item enabled", () => {
    const { result } = renderHook(() => useRosterCardActions(fullParams('lead')));
    expect(labelsOf(result.current.menuItems)).toEqual(OWNER_FULL.filter((l) => l !== 'Assign User'));
    expect(itemsOf(result.current.menuItems).filter((i) => i.disabled)).toEqual([]);
    expectWellFormed(result.current.menuItems);
  });

  it("pin: admin access (userRole 'owner') keeps the owner list with the admin Assign variant", () => {
    const { result } = renderHook(() => useRosterCardActions(fullParams('owner', true)));
    expect(labelsOf(result.current.menuItems)).toEqual(
      OWNER_FULL.map((l) => (l === 'Assign User' ? 'Assign User (Admin)' : l)),
    );
    expect(itemsOf(result.current.menuItems).filter((i) => i.disabled)).toEqual([]);
  });

  it('pin: Paste with an empty clipboard stays, disabled, with "No player copied" (a state, R-R1-0)', () => {
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        userRole: 'member',
        currentUserId: 'u1',
        clipboardPlayer: null,
        player: makePlayer({ userId: 'u1' }),
        actions: everyAction(),
      }),
    );
    const paste = itemsOf(result.current.menuItems).find((i) => i.label === 'Paste');
    expect(paste).toBeDefined();
    expect(paste?.disabled).toBe(true);
    expect(paste?.tooltip).toBe('No player copied');
  });

  it('pin: Reset Gear without a host handler stays, disabled, with "Feature not available" (a state)', () => {
    const { result } = renderHook(() =>
      useRosterCardActions({
        ...base,
        userRole: 'owner',
        player: makePlayer(),
        actions: { ...everyAction(), onResetGear: undefined },
      }),
    );
    const reset = itemsOf(result.current.menuItems).find((i) => i.label === 'Reset Gear');
    expect(reset?.disabled).toBe(true);
    expect(reset?.tooltip).toBe('Feature not available');
  });
});
