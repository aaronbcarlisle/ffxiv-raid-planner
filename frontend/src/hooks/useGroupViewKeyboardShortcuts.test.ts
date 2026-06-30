/**
 * useGroupViewKeyboardShortcuts — Mod+[/] static-switch navigation tests.
 *
 * Verifies that:
 *   - When shellParam is present (e.g. "v2"), the navigate target keeps
 *     `?shell=v2` so the shell gate is not dropped.
 *   - When shellParam is absent (legacy caller), navigate is called with a
 *     plain `/group/<code>` path (no query string appended).
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
    lootSubTab: 'gear',
    setLootSubTab: noop,
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
    setShowKeyboardHelp: noop,
    setEditingPlayerId: noop,
    setHighlightedPlayerId: noop,
    setShowLogLootModal: noop,
    setShowLogMaterialModal: noop,
    setShowMarkFloorClearedModal: noop,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useGroupViewKeyboardShortcuts — Mod+[ / Mod+] static navigation', () => {
  beforeEach(() => {
    mockedUseKeyboardShortcuts.mockClear();
  });

  it('navigates to previous static with ?shell=v2 when shellParam is "v2"', () => {
    const navigate = vi.fn();
    renderHook(() =>
      useGroupViewKeyboardShortcuts(makeParams({ navigate, shellParam: 'v2' }), false),
    );

    const prevAction = getAction('[', { requireMod: true });
    expect(prevAction).toBeDefined();
    prevAction!.action();

    // currentGroup is g2 (index 1); previous is g1 (ALPHA01)
    expect(navigate).toHaveBeenCalledWith('/group/ALPHA01?shell=v2');
  });

  it('navigates to next static with ?shell=v2 when shellParam is "v2"', () => {
    const navigate = vi.fn();
    renderHook(() =>
      useGroupViewKeyboardShortcuts(makeParams({ navigate, shellParam: 'v2' }), false),
    );

    const nextAction = getAction(']', { requireMod: true });
    expect(nextAction).toBeDefined();
    nextAction!.action();

    // currentGroup is g2 (index 1); next is g3 (GAMMA03)
    expect(navigate).toHaveBeenCalledWith('/group/GAMMA03?shell=v2');
  });

  it('navigates without query param when shellParam is absent (legacy path)', () => {
    const navigate = vi.fn();
    // No shellParam — simulates legacy GroupView caller
    renderHook(() =>
      useGroupViewKeyboardShortcuts(makeParams({ navigate }), false),
    );

    const prevAction = getAction('[', { requireMod: true });
    expect(prevAction).toBeDefined();
    prevAction!.action();

    expect(navigate).toHaveBeenCalledWith('/group/ALPHA01');
    // Confirm no shell param was appended
    expect(navigate.mock.calls[0][0]).not.toContain('shell');
  });

  it('navigates without query param when shellParam is undefined (explicit undefined)', () => {
    const navigate = vi.fn();
    renderHook(() =>
      useGroupViewKeyboardShortcuts(makeParams({ navigate, shellParam: undefined }), false),
    );

    const nextAction = getAction(']', { requireMod: true });
    expect(nextAction).toBeDefined();
    nextAction!.action();

    expect(navigate).toHaveBeenCalledWith('/group/GAMMA03');
    expect(navigate.mock.calls[0][0]).not.toContain('shell');
  });

  it('does not navigate when already at the first static (Mod+[)', () => {
    const navigate = vi.fn();
    const groups = makeGroups();
    renderHook(() =>
      useGroupViewKeyboardShortcuts(
        makeParams({ navigate, shellParam: 'v2', currentGroup: groups[0] }),
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
        makeParams({ navigate, shellParam: 'v2', currentGroup: groups[2] }),
        false,
      ),
    );

    const nextAction = getAction(']', { requireMod: true });
    nextAction!.action();

    expect(navigate).not.toHaveBeenCalled();
  });
});
