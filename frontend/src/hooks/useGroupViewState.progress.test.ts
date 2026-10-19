/**
 * useGroupViewState — the Progress tab's URLs (S2a-2·F1 TF2, R-S2-3).
 *
 * `progress`, `goals`, `mount-farms` and `collections` all resolve to the
 * `goals` mode. V2 writes `?tab=progress` for it (setPageMode and the
 * first-render reflect); tab memory keeps `goals`. The legacy shell still
 * writes `tab=goals`, and opens Goals & Farms for `?tab=progress` (V1 delta (d)).
 *
 * The hook runs for real under a MemoryRouter at `/group/:shareCode`; the shell
 * resolves from `?shell=` or the stored preference, as in the app. New cases
 * live here so `useGroupViewState.test.ts` stays unedited (R-S2-2, vet M-2).
 */
import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pageModeFromTabParam, tabParamFor, useGroupViewState } from './useGroupViewState';
import { useShellPreferenceStore } from '../lib/shellPreference';
import { useAuthStore } from '../stores/authStore';

const TAB_KEY = 'group-view-tab:ABC';

function renderAt(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      MemoryRouter,
      { initialEntries: [url] },
      createElement(Routes, null, createElement(Route, { path: '/group/:shareCode', element: children })),
    );
  return renderHook(
    () => ({ gv: useGroupViewState(), location: useLocation(), navigate: useNavigate() }),
    { wrapper },
  );
}

type Rendered = ReturnType<typeof renderAt>;
const tabOf = (r: Rendered) => new URLSearchParams(r.result.current.location.search).get('tab');

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useShellPreferenceStore.setState({ preference: null, sessionOverride: null });
  useAuthStore.setState({ user: null });
  // setPageMode resets the scroll position; jsdom does not implement scrollTo.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

describe('pageModeFromTabParam — the Progress aliases', () => {
  it.each(['progress', 'goals', 'mount-farms', 'collections'])('maps ?tab=%s -> goals', (param) => {
    expect(pageModeFromTabParam(param)).toBe('goals');
  });
});

describe('tabParamFor', () => {
  it('names goals "progress" in V2 only, and every other mode as itself', () => {
    expect(tabParamFor('goals', 'v2')).toBe('progress');
    expect(tabParamFor('goals', 'legacy')).toBe('goals');
    expect(tabParamFor('roster', 'v2')).toBe('roster');
    expect(tabParamFor('gear', 'v2')).toBe('gear');
  });
});

describe('useGroupViewState under ?shell=v2', () => {
  it('setPageMode("goals") writes tab=progress and remembers goals', () => {
    const r = renderAt('/group/ABC?shell=v2&tab=roster');
    expect(r.result.current.gv.pageMode).toBe('roster');
    act(() => r.result.current.gv.setPageMode('goals'));
    expect(r.result.current.gv.pageMode).toBe('goals');
    expect(tabOf(r)).toBe('progress');
    expect(localStorage.getItem(TAB_KEY)).toBe('goals');
  });

  it('setPageMode("roster") still writes tab=roster', () => {
    const r = renderAt('/group/ABC?shell=v2&tab=progress');
    act(() => r.result.current.gv.setPageMode('roster'));
    expect(r.result.current.gv.pageMode).toBe('roster');
    expect(tabOf(r)).toBe('roster');
  });

  it('a recalled goals opens goals, and the first-render reflect writes tab=progress', () => {
    localStorage.setItem(TAB_KEY, 'goals');
    const r = renderAt('/group/ABC?shell=v2');
    expect(r.result.current.gv.pageMode).toBe('goals');
    expect(tabOf(r)).toBe('progress');
  });

  it('the stored V2 preference (no ?shell=) writes tab=progress too', () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    const r = renderAt('/group/ABC?tab=roster');
    act(() => r.result.current.gv.setPageMode('goals'));
    expect(tabOf(r)).toBe('progress');
  });

  it('?tab=progress opens goals and is left as written', () => {
    const r = renderAt('/group/ABC?shell=v2&tab=progress');
    expect(r.result.current.gv.pageMode).toBe('goals');
    expect(tabOf(r)).toBe('progress');
  });

  it('browser back to a tab=progress entry returns to goals', () => {
    const r = renderAt('/group/ABC?shell=v2&tab=progress');
    act(() => r.result.current.gv.setPageMode('roster'));
    expect(r.result.current.gv.pageMode).toBe('roster');
    act(() => { void r.result.current.navigate(-1); });
    expect(tabOf(r)).toBe('progress');
    expect(r.result.current.gv.pageMode).toBe('goals');
  });
});

describe('useGroupViewState under the legacy shell (V1 pin)', () => {
  it('setPageMode("goals") writes tab=goals', () => {
    const r = renderAt('/group/ABC?tab=roster');
    act(() => r.result.current.gv.setPageMode('goals'));
    expect(r.result.current.gv.pageMode).toBe('goals');
    expect(tabOf(r)).toBe('goals');
  });

  it('a recalled goals reflects as tab=goals', () => {
    localStorage.setItem(TAB_KEY, 'goals');
    const r = renderAt('/group/ABC');
    expect(r.result.current.gv.pageMode).toBe('goals');
    expect(tabOf(r)).toBe('goals');
  });

  it('?tab=progress opens goals (delta (d))', () => {
    const r = renderAt('/group/ABC?tab=progress');
    expect(r.result.current.gv.pageMode).toBe('goals');
  });
});
