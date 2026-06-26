/**
 * Unit tests for useUrlTabState — the URL-derived tab-state hook that backs
 * every sub-tab in the app.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { useUrlTabState, clearRegisteredTabParams } from './useUrlTabState';

const VALUES = ['a', 'b', 'c'] as const;

function setup(initialPath: string, history?: 'push' | 'replace') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => {
      const [searchParams] = useSearchParams();
      const [value, setValue] = useUrlTabState('tab', VALUES, 'a', history ? { history } : undefined);
      return { value, setValue, search: searchParams.toString() };
    },
    { wrapper },
  );
}

describe('useUrlTabState', () => {
  it('derives the value from the URL param', () => {
    const { result } = setup('/?tab=b');
    expect(result.current.value).toBe('b');
  });

  it('falls back to the default when the param is absent', () => {
    const { result } = setup('/');
    expect(result.current.value).toBe('a');
  });

  it('falls back to the default when the param value is invalid', () => {
    const { result } = setup('/?tab=zzz');
    expect(result.current.value).toBe('a');
  });

  it('setting a non-default value writes the param', () => {
    const { result } = setup('/');
    act(() => result.current.setValue('c'));
    expect(result.current.value).toBe('c');
    expect(result.current.search).toContain('tab=c');
  });

  it('setting the default value omits the param from the URL', () => {
    const { result } = setup('/?tab=b&keep=1');
    act(() => result.current.setValue('a'));
    expect(result.current.value).toBe('a');
    expect(result.current.search).not.toContain('tab=');
    // unrelated params are preserved
    expect(result.current.search).toContain('keep=1');
  });

  it('clearRegisteredTabParams deletes registered sub-tab params but leaves others', () => {
    const params = new URLSearchParams('rsub=characters&keep=1');
    clearRegisteredTabParams(params);
    expect(params.has('rsub')).toBe(false);
    expect(params.get('keep')).toBe('1');
  });

  it('clears a known sub-tab param even if its view never mounted this session', () => {
    // Regression: a deep-linked ?goal=farms must be cleared on a primary-tab
    // switch (Remember sub-tabs off) even though no useUrlTabState('goal')
    // rendered here. The seeded registry covers it; unrelated params survive.
    const params = new URLSearchParams('goal=farms&stab=availability&keep=1');
    clearRegisteredTabParams(params);
    expect(params.has('goal')).toBe(false);
    expect(params.has('stab')).toBe(false);
    expect(params.get('keep')).toBe('1');
  });

  it('never clears the protected primary tab / settings params, even when registered', () => {
    // setup() mounts useUrlTabState('tab') and the app mounts
    // useUrlTabState('settings'); both register on render but must survive a
    // sub-tab reset (otherwise the navigated tab / open settings panel resets).
    setup('/');
    const reg = renderHook(() => useUrlTabState('settings', ['general', 'recruitment'] as const, 'general'), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    reg.unmount();
    const params = new URLSearchParams('tab=gear&settings=recruitment&rsub=characters');
    clearRegisteredTabParams(params);
    expect(params.get('tab')).toBe('gear');
    expect(params.get('settings')).toBe('recruitment');
    expect(params.has('rsub')).toBe(false); // sub-tab still cleared
  });
});
