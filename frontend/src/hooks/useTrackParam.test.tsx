/**
 * useTrackParam (S2a-3a·G2 Task TG3; R-S3-3, D-8): reads `?track`, writes it in place, and
 * `clearRegisteredTabParams` (the 'reset' tab memory) removes it like any sub-tab param.
 */
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useTrackParam } from './useTrackParam';
import { clearRegisteredTabParams } from './useUrlTabState';

function setup(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
  return renderHook(
    () => {
      const [track, setTrack] = useTrackParam();
      return { track, setTrack, search: useLocation().search, action: useNavigationType(), navigate: useNavigate() };
    },
    { wrapper },
  );
}

describe('useTrackParam', () => {
  it('reads ?track=abc', () => {
    expect(setup('/group/ABC?tab=progress&track=abc').result.current.track).toBe('abc');
  });

  it('reads null when the param is absent or empty', () => {
    expect(setup('/group/ABC?tab=progress').result.current.track).toBeNull();
    expect(setup('/group/ABC?track=').result.current.track).toBeNull();
  });

  it('writes the id in place: a replace, no new history entry, other params kept', () => {
    const { result } = setup('/group/ABC?tab=progress');
    act(() => result.current.setTrack('goal-1'));
    expect(result.current.track).toBe('goal-1');
    expect(new URLSearchParams(result.current.search).get('track')).toBe('goal-1');
    expect(new URLSearchParams(result.current.search).get('tab')).toBe('progress');
    expect(result.current.action).toBe('REPLACE');
    // Back has nothing earlier to step to: the one entry was replaced, so the row stays open.
    act(() => {
      void result.current.navigate(-1);
    });
    expect(new URLSearchParams(result.current.search).get('track')).toBe('goal-1');
  });

  it('replaces one id with another, still in place', () => {
    const { result } = setup('/group/ABC?track=goal-1');
    act(() => result.current.setTrack('goal-2'));
    expect(result.current.track).toBe('goal-2');
    expect(result.current.action).toBe('REPLACE');
  });

  it('removes the param on null and keeps the rest', () => {
    const { result } = setup('/group/ABC?tab=progress&track=goal-1');
    act(() => result.current.setTrack(null));
    expect(result.current.track).toBeNull();
    expect(result.current.search).toBe('?tab=progress');
    expect(result.current.action).toBe('REPLACE');
  });

  it('is cleared by clearRegisteredTabParams, as every sub-tab param is (R-S3-3)', () => {
    const params = new URLSearchParams('tab=progress&track=goal-1&keep=1');
    clearRegisteredTabParams(params);
    expect(params.has('track')).toBe(false);
    expect(params.get('tab')).toBe('progress');
    expect(params.get('keep')).toBe('1');
  });
});
