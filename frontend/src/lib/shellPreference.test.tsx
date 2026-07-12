/**
 * shellPreference — persisted dual-shell preference + resolution precedence.
 * Phase R (ROLLOUT_ROADMAP §2): ?shell= URL param → stored preference → default legacy.
 * The URL param NEVER writes the preference (support/deep-link override only).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  useShellPreferenceStore,
  useResolvedShell,
  useShellPreferenceSync,
  SHELL_STORAGE_KEY,
} from './shellPreference';

// Callable selector mock with `.getState()` (mirrors NewShell.authGuard.test.tsx's
// authStore mock pattern). `mocks.user` is mutated per-test to control whether a
// PATCH mirror should fire; `mocks.authInitialized` controls whether the sync
// hook may trust `user` (false = still the stale zustand-persisted snapshot).
const mocks = vi.hoisted(() => ({
  user: null as { uiShell?: 'legacy' | 'v2' } | null,
  authInitialized: true,
  updatePreferences: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../stores/authStore', () => {
  const authState = () => ({
    user: mocks.user,
    authInitialized: mocks.authInitialized,
    updatePreferences: mocks.updatePreferences,
  });
  const useAuthStoreMock = (sel?: (s: ReturnType<typeof authState>) => unknown) => {
    const state = authState();
    return sel ? sel(state) : state;
  };
  useAuthStoreMock.getState = () => authState();
  return { useAuthStore: useAuthStoreMock };
});

function resolveAt(url: string) {
  return renderHook(() => useResolvedShell(), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>,
  });
}

beforeEach(() => {
  localStorage.clear();
  useShellPreferenceStore.setState({ preference: null });
  mocks.user = null;
  mocks.authInitialized = true;
  mocks.updatePreferences.mockClear();
});

describe('useShellPreferenceStore', () => {
  it('setPreference writes the store AND localStorage', () => {
    act(() => useShellPreferenceStore.getState().setPreference('v2'));
    expect(useShellPreferenceStore.getState().preference).toBe('v2');
    expect(localStorage.getItem(SHELL_STORAGE_KEY)).toBe('v2');
  });
});

describe('useResolvedShell precedence', () => {
  it('defaults to legacy with no param and no preference', () => {
    expect(resolveAt('/group/ABC').result.current).toBe('legacy');
  });
  it('uses the stored preference when no param is present', () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    expect(resolveAt('/group/ABC').result.current).toBe('v2');
  });
  it('?shell=legacy beats a v2 preference (support override)', () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    expect(resolveAt('/group/ABC?shell=legacy').result.current).toBe('legacy');
  });
  it('?shell=v2 beats the legacy default', () => {
    expect(resolveAt('/group/ABC?shell=v2').result.current).toBe('v2');
  });
  it('ignores an unrecognized ?shell= value', () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    expect(resolveAt('/group/ABC?shell=bogus').result.current).toBe('v2');
  });
  it('reacts to a preference change without remount (in-place toggle)', () => {
    const { result } = resolveAt('/group/ABC');
    expect(result.current).toBe('legacy');
    act(() => useShellPreferenceStore.getState().setPreference('v2'));
    expect(result.current).toBe('v2');
  });
});

describe('setPreference backend mirror (Task 8)', () => {
  it('PATCH-mirrors uiShell when a user is authenticated', () => {
    mocks.user = { uiShell: 'legacy' };
    act(() => useShellPreferenceStore.getState().setPreference('v2'));
    expect(mocks.updatePreferences).toHaveBeenCalledTimes(1);
    expect(mocks.updatePreferences).toHaveBeenCalledWith({ uiShell: 'v2' });
  });

  it('skips the PATCH mirror for guests (no user)', () => {
    mocks.user = null;
    act(() => useShellPreferenceStore.getState().setPreference('v2'));
    expect(mocks.updatePreferences).not.toHaveBeenCalled();
  });
});

describe('useShellPreferenceSync (backend-wins hydration)', () => {
  it('adopts the authed user\'s uiShell into the store + localStorage', () => {
    mocks.user = { uiShell: 'v2' };
    renderHook(() => useShellPreferenceSync());
    expect(useShellPreferenceStore.getState().preference).toBe('v2');
    expect(localStorage.getItem(SHELL_STORAGE_KEY)).toBe('v2');
  });

  it('never calls updatePreferences (hydration must not PATCH back)', () => {
    mocks.user = { uiShell: 'v2' };
    renderHook(() => useShellPreferenceSync());
    expect(mocks.updatePreferences).not.toHaveBeenCalled();
  });

  it('does nothing when there is no authed user', () => {
    mocks.user = null;
    renderHook(() => useShellPreferenceSync());
    expect(useShellPreferenceStore.getState().preference).toBeNull();
    expect(localStorage.getItem(SHELL_STORAGE_KEY)).toBeNull();
  });

  it('does not clobber an existing matching preference (no redundant write)', () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    mocks.user = { uiShell: 'v2' };
    const setSpy = vi.spyOn(useShellPreferenceStore, 'setState');
    renderHook(() => useShellPreferenceSync());
    expect(setSpy).not.toHaveBeenCalled();
    setSpy.mockRestore();
  });

  it('adopts NOTHING before authInitialized (stale persisted snapshot must not override the local choice)', () => {
    // Cold load: `user` is the zustand-persisted snapshot, potentially staler
    // than localStorage's ui-shell (e.g. a toggle whose PATCH mirror failed).
    mocks.authInitialized = false;
    mocks.user = { uiShell: 'legacy' };
    useShellPreferenceStore.setState({ preference: 'v2' });
    localStorage.setItem(SHELL_STORAGE_KEY, 'v2');
    renderHook(() => useShellPreferenceSync());
    expect(useShellPreferenceStore.getState().preference).toBe('v2');
    expect(localStorage.getItem(SHELL_STORAGE_KEY)).toBe('v2');
  });

  it('adopts the /me uiShell once authInitialized flips true', () => {
    mocks.authInitialized = true;
    mocks.user = { uiShell: 'legacy' };
    useShellPreferenceStore.setState({ preference: 'v2' });
    localStorage.setItem(SHELL_STORAGE_KEY, 'v2');
    renderHook(() => useShellPreferenceSync());
    expect(useShellPreferenceStore.getState().preference).toBe('legacy');
    expect(localStorage.getItem(SHELL_STORAGE_KEY)).toBe('legacy');
  });
});
