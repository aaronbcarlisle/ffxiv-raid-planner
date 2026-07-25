/**
 * shellPreference — persisted dual-shell preference + resolution precedence.
 * Phase R (ROLLOUT_ROADMAP §2): ?shell= URL param → stored preference → default legacy.
 * The URL param NEVER writes the preference (support/deep-link override only).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import {
  useShellPreferenceStore,
  useResolvedShell,
  useShellPreferenceSync,
  useShellParamPersistence,
  SHELL_STORAGE_KEY,
  SESSION_STORAGE_KEY,
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
  sessionStorage.clear();
  useShellPreferenceStore.setState({ preference: null, sessionOverride: null });
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

// ── S2: session-sticky ?shell= override (per browser-tab) ──

describe('useResolvedShell — session-override tier', () => {
  it('resolves the session override when no param and no preference', () => {
    useShellPreferenceStore.setState({ sessionOverride: 'v2' });
    expect(resolveAt('/group/ABC').result.current).toBe('v2');
  });
  it('an explicit ?shell= param beats the session override', () => {
    useShellPreferenceStore.setState({ sessionOverride: 'v2' });
    expect(resolveAt('/group/ABC?shell=legacy').result.current).toBe('legacy');
  });
  it('the session override beats the stored preference', () => {
    useShellPreferenceStore.setState({ sessionOverride: 'v2', preference: 'legacy' });
    expect(resolveAt('/group/ABC').result.current).toBe('v2');
  });
  it('parity: no param + no session + no preference still resolves legacy', () => {
    expect(resolveAt('/group/ABC').result.current).toBe('legacy');
  });
});

describe('setSessionOverride', () => {
  it('writes the store AND sessionStorage', () => {
    act(() => useShellPreferenceStore.getState().setSessionOverride('v2'));
    expect(useShellPreferenceStore.getState().sessionOverride).toBe('v2');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe('v2');
  });
});

describe('setPreference clears the session override', () => {
  it('an explicit toggle wipes any session override (store + sessionStorage) so it cannot be defeated', () => {
    useShellPreferenceStore.setState({ sessionOverride: 'legacy' });
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'legacy');
    act(() => useShellPreferenceStore.getState().setPreference('v2'));
    expect(useShellPreferenceStore.getState().sessionOverride).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});

describe('useShellParamPersistence (companion write effect)', () => {
  function persistAt(url: string) {
    return renderHook(() => useShellParamPersistence(), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>,
    });
  }
  it('persists ?shell=v2 into the session override (store + sessionStorage)', () => {
    persistAt('/group/ABC?shell=v2');
    expect(useShellPreferenceStore.getState().sessionOverride).toBe('v2');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe('v2');
  });
  it('persists ?shell=legacy too (symmetric opt-out sticks)', () => {
    persistAt('/group/ABC?shell=legacy');
    expect(useShellPreferenceStore.getState().sessionOverride).toBe('legacy');
  });
  it('leaves the session override untouched when no param is present', () => {
    useShellPreferenceStore.setState({ sessionOverride: 'v2' });
    persistAt('/group/ABC');
    expect(useShellPreferenceStore.getState().sessionOverride).toBe('v2');
  });
  it('ignores an unrecognized ?shell= value', () => {
    persistAt('/group/ABC?shell=bogus');
    expect(useShellPreferenceStore.getState().sessionOverride).toBeNull();
  });
});

describe('S2 end-to-end: a ?shell=v2 deep-link stays sticky across param-less navigation', () => {
  function StickyHarness() {
    useShellParamPersistence();
    const shell = useResolvedShell();
    const navigate = useNavigate();
    return (
      <>
        <div data-testid="shell">{shell}</div>
        <button type="button" onClick={() => navigate('/group/ABC')}>go-plain</button>
      </>
    );
  }
  it('resolves v2 after navigating to a URL with no ?shell= param', () => {
    render(
      <MemoryRouter initialEntries={['/group/ABC?shell=v2']}>
        <StickyHarness />
      </MemoryRouter>
    );
    expect(screen.getByTestId('shell').textContent).toBe('v2');
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'go-plain' })); });
    // Without the session tier this would fall back to legacy; with it, v2 sticks.
    expect(screen.getByTestId('shell').textContent).toBe('v2');
  });
});
