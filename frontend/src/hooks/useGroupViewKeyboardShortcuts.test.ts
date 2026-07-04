/**
 * useGroupViewKeyboardShortcuts — Mod+[/] static-switch navigation tests.
 *
 * Verifies that the Mod+[/] shortcuts navigate to a plain `/group/<code>`
 * path (no query string appended).
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGroupViewKeyboardShortcuts } from './useGroupViewKeyboardShortcuts';
import type { GroupViewShortcutParams } from './useGroupViewKeyboardShortcuts';
import type { StaticGroup } from '../types';

// ── Stub context dependencies ──────────────────────────────────────────────

vi.mock('./useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('../components/layout/Header', () => ({
  HEADER_EVENTS: { SETTINGS: 'header:settings' },
}));

vi.mock('../pages/groupActionsContext', () => ({
  useGroupActions: () => ({
    onTierChange: vi.fn(),
    onAddPlayer: vi.fn(),
    onNewTier: vi.fn(),
    onRollover: vi.fn(),
    onDeleteTier: vi.fn(),
  }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

import { useKeyboardShortcuts } from './useKeyboardShortcuts';

const mockedUseKeyboardShortcuts = vi.mocked(useKeyboardShortcuts);

/** Extract the action registered for a given key + modifier from the latest call. */
function getAction(key: string, opts: { requireMod?: boolean; requireAlt?: boolean } = {}) {
  const calls = mockedUseKeyboardShortcuts.mock.calls;
  const lastCall = calls[calls.length - 1][0];
  return lastCall.shortcuts.find(
    (s) =>
      s.key === key &&
      Boolean(s.requireMod) === Boolean(opts.requireMod) &&
      Boolean(s.requireAlt) === Boolean(opts.requireAlt),
  );
}

function makeGroup(overrides: Partial<StaticGroup> & Pick<StaticGroup, 'id' | 'name' | 'shareCode'>): StaticGroup {
  return {
    isPublic: false,
    ownerId: 'u1',
    memberCount: 8,
    isAdminAccess: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeGroups(): StaticGroup[] {
  return [
    makeGroup({ id: 'g1', name: 'Alpha', shareCode: 'ALPHA01', userRole: 'owner' }),
    makeGroup({ id: 'g2', name: 'Beta',  shareCode: 'BETA002', userRole: 'member' }),
    makeGroup({ id: 'g3', name: 'Gamma', shareCode: 'GAMMA03', userRole: 'member' }),
  ];
}

function makeParams(overrides: Partial<GroupViewShortcutParams> = {}): GroupViewShortcutParams {
  const noop = vi.fn();
  return {
    pageMode: 'overview',
    setPageMode: noop,
    gearSubTab: 'priority',
    setGearSubTab: noop,
    viewMode: 'compact',
    setViewMode: noop,
    groupView: false,
    setGroupView: noop,
    subsView: false,
    setSubsView: noop,
    hasSubstitutes: false,
    canEdit: true,
    currentTier: null,
    groups: makeGroups(),
    currentGroup: makeGroups()[1], // start at 'g2' (middle)
    tiers: [],
    navigate: noop,
    setEditingPlayerId: noop,
    setHighlightedPlayerId: noop,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useGroupViewKeyboardShortcuts — Mod+[ / Mod+] static navigation', () => {
  beforeEach(() => {
    mockedUseKeyboardShortcuts.mockClear();
  });

  it('navigates to previous static with a plain /group/<code> path', () => {
    const navigate = vi.fn();
    renderHook(() =>
      useGroupViewKeyboardShortcuts(makeParams({ navigate }), false),
    );

    const prevAction = getAction('[', { requireMod: true });
    expect(prevAction).toBeDefined();
    prevAction!.action();

    // currentGroup is g2 (index 1); previous is g1 (ALPHA01)
    expect(navigate).toHaveBeenCalledWith('/group/ALPHA01');
  });

  it('navigates to next static with a plain /group/<code> path', () => {
    const navigate = vi.fn();
    renderHook(() =>
      useGroupViewKeyboardShortcuts(makeParams({ navigate }), false),
    );

    const nextAction = getAction(']', { requireMod: true });
    expect(nextAction).toBeDefined();
    nextAction!.action();

    // currentGroup is g2 (index 1); next is g3 (GAMMA03)
    expect(navigate).toHaveBeenCalledWith('/group/GAMMA03');
  });

  it('does not navigate when already at the first static (Mod+[)', () => {
    const navigate = vi.fn();
    const groups = makeGroups();
    renderHook(() =>
      useGroupViewKeyboardShortcuts(
        makeParams({ navigate, currentGroup: groups[0] }),
        false,
      ),
    );

    const prevAction = getAction('[', { requireMod: true });
    prevAction!.action();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not navigate when already at the last static (Mod+])', () => {
    const navigate = vi.fn();
    const groups = makeGroups();
    renderHook(() =>
      useGroupViewKeyboardShortcuts(
        makeParams({ navigate, currentGroup: groups[2] }),
        false,
      ),
    );

    const nextAction = getAction(']', { requireMod: true });
    nextAction!.action();

    expect(navigate).not.toHaveBeenCalled();
  });
});

// ── Removed dead-flag bindings (flip-P3 whole-branch fix) ──────────────────
// Alt+L/U/B used to open the deleted HistoryView log modals, and Shift+?
// used to set a GVC-local `showKeyboardHelp` flag with no renderer (the real
// shortcuts modal is owned by Layout.tsx via the always-mounted
// useGlobalKeyboardShortcuts). None of the four had a renderer left after
// flip-P3's cascade deletion, so setting them left `isAnyModalOpen` latched
// true with no way to clear it (Alt+L/U/B) or duplicated global behavior
// (Shift+?). Pin that the registry no longer contains any of them.
describe('useGroupViewKeyboardShortcuts — dead-flag bindings removed', () => {
  beforeEach(() => {
    mockedUseKeyboardShortcuts.mockClear();
  });

  it('does not register Alt+L / Alt+U / Alt+B (deleted log-modal openers)', () => {
    renderHook(() => useGroupViewKeyboardShortcuts(makeParams(), false));

    expect(getAction('l', { requireAlt: true })).toBeUndefined();
    expect(getAction('u', { requireAlt: true })).toBeUndefined();
    expect(getAction('b', { requireAlt: true })).toBeUndefined();
  });

  it('does not register a Shift+? binding (global shortcut owns the real modal)', () => {
    renderHook(() => useGroupViewKeyboardShortcuts(makeParams(), false));

    expect(getAction('?', { requireAlt: false })).toBeUndefined();
  });

  it('pressing Alt+L (canEdit) no longer disables subsequent shortcuts via isAnyModalOpen', () => {
    // Regression guard for the latch: `isAnyModalOpen` is now driven entirely
    // by the caller (GroupViewContent), not by any state this hook sets. The
    // hook has no bearing on `disabled` beyond echoing the flag it's given.
    renderHook(() => useGroupViewKeyboardShortcuts(makeParams({ canEdit: true }), false));
    const lastCall = mockedUseKeyboardShortcuts.mock.calls.at(-1)![0];
    expect(lastCall.disabled).toBe(false);
  });

  it('Escape only clears editing/highlight state — no keyboard-help setter call', () => {
    const setEditingPlayerId = vi.fn();
    const setHighlightedPlayerId = vi.fn();
    renderHook(() =>
      useGroupViewKeyboardShortcuts(
        makeParams({ setEditingPlayerId, setHighlightedPlayerId }),
        false,
      ),
    );

    const escapeAction = getAction('Escape');
    expect(escapeAction).toBeDefined();
    // Must not throw (would if it still referenced a removed setter) and
    // must still clear the live edit/highlight state.
    expect(() => escapeAction!.action()).not.toThrow();
    expect(setEditingPlayerId).toHaveBeenCalledWith(null);
    expect(setHighlightedPlayerId).toHaveBeenCalledWith(null);
  });
});
