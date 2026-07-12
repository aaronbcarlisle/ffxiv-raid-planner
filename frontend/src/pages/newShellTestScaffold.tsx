/**
 * Shared test scaffold for the `NewShell.*.test.tsx` suite family.
 *
 * `NewShell.slot`, `.roster`, `.gear`, and `.schedule` all render (some or all
 * of) the REAL `ShellContent` → `GroupViewContent` chain and therefore share a
 * large, near-identical mock surface: the ~30-field `useGroupViewState()`
 * return value, the core stores (`tierStore`, `staticGroupStore`, `authStore`,
 * `viewAsStore`, `lootTrackingStore`), and a "dual-form" calling convention
 * that mirrors how real Zustand hooks behave — callable with no args
 * (`useStore()` → whole state, as `GroupViewContent`/`ShellContentStates`
 * read them) OR with a selector (`useStore((s) => s.foo)` → `s.foo`, as
 * `ShellContent`/leaf components read them).
 *
 * The dual form matters: `roster`/`gear`/`schedule` used to mock `useTierStore`
 * (and `gear`/`schedule` also `useLootTrackingStore`) as a ZERO-ARG function
 * (`() => ({...})`) that silently returns the whole state object even when
 * called with a selector — masking the fact that a real selector-aware store
 * would only return the selected field. `dualFormStoreMock` retires that
 * foot-gun; use it for every store mock in this suite family instead of
 * hand-rolling the zero-arg shape.
 *
 * ## Hoisting
 *
 * `vi.mock` factories are hoisted above a file's own top-level `import`
 * statements, so they cannot close over bindings imported the normal way.
 * Each `NewShell.*.test.tsx` file still declares its OWN `vi.mock(...)` calls
 * (vitest requires the mock registration to live in the test file, per-file),
 * but factory bodies reach the builders below via a DYNAMIC import:
 *
 * ```ts
 * vi.mock('../stores/tierStore', async () => {
 *   const { makeTierStoreState, dualFormStoreMock } = await import('./newShellTestScaffold');
 *   const state = makeTierStoreState();
 *   return { useTierStore: dualFormStoreMock(state), useCurrentTier: () => state.currentTier };
 * });
 * ```
 *
 * `await import(...)` only runs when the factory is actually invoked (lazily,
 * the first time something imports the mocked module) — by then this module
 * has already loaded normally, so hoisting order is a non-issue.
 *
 * ## What this module provides
 *
 * - `makeGroupViewStateMock` — the full `useGroupViewState()` return shape
 *   (pageMode et al overridable via `overrides`).
 * - `dualFormStoreMock` — wraps a fixed state object in the
 *   `(selector?) => selector ? selector(state) : state` shape. Call it ONCE
 *   per mocked store (capture the returned function), so whole-state and
 *   selector reads within the same render see the identical object/fn
 *   identities — constructing a fresh state object per invocation previously
 *   broke referential stability and could spin mount effects into loops.
 * - `makeTierStoreState` / `makeStaticGroupStoreState` / `makeAuthStoreState`
 *   — default fixture shapes for the three stores every suite in this family
 *   mocks, with per-test overrides.
 *
 * ## What's intentionally NOT here
 *
 * Heavy leaves and small hook mocks that are byte-identical across suites but
 * don't carry meaningful state (so extracting them would trade one line of
 * duplication for one line of indirection): `useStaticPermissions`,
 * `useDragAndDrop`, `useViewNavigation`, `useVisibilityRefresh`,
 * `useUrlTabState`, `../lib/eventBus`, `./groupActionsContext`, the
 * `../components/home/Home` / `../components/admin/AdminBanners` /
 * `../components/static-group/JoinRequestBanner` stubs, the
 * `../components/ui` `MobileBottomNav` override, and the `.getState()`-style
 * `mountFarmStore`/`settingsPanelStore` mocks. Each suite still declares these
 * inline — see `NewShell.roster.test.tsx` for the canonical set.
 */
import { vi } from 'vitest';
import type { UseGroupViewStateReturn } from '../hooks/useGroupViewState';

/** The full `useGroupViewState()` return shape, with sensible defaults (pinned
 *  to the `roster` tab) — pass `overrides` to pin a different `pageMode` etc. */
export function makeGroupViewStateMock(
  overrides?: Partial<UseGroupViewStateReturn>,
): UseGroupViewStateReturn {
  const noop = vi.fn();
  return {
    searchParams: new URLSearchParams(),
    setSearchParams: noop,
    pageMode: 'roster',
    setPageMode: noop,
    gearSubTab: 'sync', setGearSubTab: noop,
    lootSubTab: 'gear', setLootSubTab: noop,
    viewMode: 'compact', setViewMode: noop,
    groupView: false, setGroupView: noop, setGroupViewState: noop,
    subsView: false, setSubsView: noop,
    selectedFloor: 1, setSelectedFloor: noop,
    sortPreset: 'standard', setSortPreset: noop, setSortPresetState: noop,
    editingPlayerId: null, setEditingPlayerId: noop,
    clipboardPlayer: null, setClipboardPlayer: noop,
    showCreateTierModal: false, setShowCreateTierModal: noop,
    showSettingsModal: false, setShowSettingsModal: noop,
    showRolloverDialog: false, setShowRolloverDialog: noop,
    showDeleteTierConfirm: false, setShowDeleteTierConfirm: noop,
    showKeyboardHelp: false, setShowKeyboardHelp: noop,
    showLogLootModal: false, setShowLogLootModal: noop,
    showLogMaterialModal: false, setShowLogMaterialModal: noop,
    showMarkFloorClearedModal: false, setShowMarkFloorClearedModal: noop,
    showLogWeekWizard: false, setShowLogWeekWizard: noop,
    logWeekWizardFloor: null, setLogWeekWizardFloor: noop,
    logWeekWizardWeek: null, setLogWeekWizardWeek: noop,
    playerModalCount: 0, setPlayerModalCount: noop,
    highlightedPlayerId: null, setHighlightedPlayerId: noop,
    highlightedSlot: null, setHighlightedSlot: noop,
    highlightedEntry: null, setHighlightedEntry: noop,
    highlightedBookPlayerId: null, setHighlightedBookPlayerId: noop,
    ...overrides,
  };
}

/** Wraps a fixed `state` object in the dual-form calling convention real
 *  Zustand hooks use: no selector → whole state, selector → `selector(state)`.
 *  Call once per mocked store and reuse the returned function so every reader
 *  (whole-state or selector) shares one stable `state` identity. */
export function dualFormStoreMock<S>(state: S): (selector?: (s: S) => unknown) => unknown {
  return (selector) => (selector ? selector(state) : state);
}

export interface MockTier {
  id: string;
  tierId: string;
  contentType: string;
  players: unknown[];
}

export interface TierStoreState {
  currentTier: MockTier | null;
  tiers: unknown[];
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  errorStack: string | null;
  fetchTier: (...args: unknown[]) => unknown;
  fetchTiers: (...args: unknown[]) => unknown;
  clearTiers: (...args: unknown[]) => unknown;
  clearError: (...args: unknown[]) => unknown;
}

/** Default `tierStore` state — a single savage snapshot, no loading/error. */
export function makeTierStoreState(overrides?: Partial<TierStoreState>): TierStoreState {
  const defaultTier: MockTier = { id: 'snap1', tierId: 'm5s', contentType: 'savage', players: [] };
  return {
    currentTier: defaultTier,
    tiers: [defaultTier],
    isSaving: false,
    isLoading: false,
    error: null,
    errorStack: null,
    fetchTier: vi.fn(),
    fetchTiers: vi.fn(),
    clearTiers: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

export interface MockStaticGroup {
  id: string;
  name: string;
  shareCode: string;
  settings: Record<string, unknown>;
  userRole: string;
  isAdminAccess: boolean;
}

export interface StaticGroupStoreState {
  currentGroup: MockStaticGroup | null;
  groups: unknown[];
}

/** Default `staticGroupStore` state — one owned static, "Test Static". */
export function makeStaticGroupStoreState(overrides?: Partial<StaticGroupStoreState>): StaticGroupStoreState {
  const defaultGroup: MockStaticGroup = {
    id: 'g1', name: 'Test Static', shareCode: 'DEVTST', settings: {},
    userRole: 'owner', isAdminAccess: false,
  };
  return { currentGroup: defaultGroup, groups: [defaultGroup], ...overrides };
}

export interface AuthStoreState {
  user: { id: string; isAdmin: boolean } | null;
}

/** Default `authStore` state — a logged-in, non-admin user. */
export function makeAuthStoreState(overrides?: Partial<AuthStoreState>): AuthStoreState {
  return { user: { id: 'u1', isAdmin: false }, ...overrides };
}
