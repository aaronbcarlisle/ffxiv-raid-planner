/**
 * shellPreference — persisted dual-shell preference + resolution precedence.
 * Phase R (ROLLOUT_ROADMAP §2): ?shell= URL param → stored preference → default legacy.
 * The URL param NEVER writes the preference (support/deep-link override only).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useShellPreferenceStore, useResolvedShell, SHELL_STORAGE_KEY } from './shellPreference';

function resolveAt(url: string) {
  return renderHook(() => useResolvedShell(), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>,
  });
}

beforeEach(() => {
  localStorage.clear();
  useShellPreferenceStore.setState({ preference: null });
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
