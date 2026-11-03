/**
 * useProgressView (S2a-4a·A2 Task TA2; R-F-3, E-1): the Progress view in the URL. `pview` is
 * `tracks` (omitted) or `find`; `setProgressView(patch)` writes every param in the patch in ONE
 * `setSearchParams(prev => …, { replace: true })`, where `null` deletes a param and
 * `pview: 'tracks'` deletes `pview`; the setter is held in a latest-setter ref, so a call after an
 * `await` (or from a stale closure) builds on the params as they are now. Every assertion reads
 * the router's FINAL location through `LocationProbe`: React Router 7 builds each write from the
 * render-time params, so an implementation that writes twice loses the first write (R-D11-B).
 * Also: `pview` is a seeded sub-tab param, so a sub-tab reset deletes it and leaves `tab` alone.
 */
import { act, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { clearRegisteredTabParams } from '../../hooks/useUrlTabState';
import { LocationProbe } from './__fixtures__/LocationProbe';
import { useProgressView } from './useProgressView';

function renderView(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>
      {children}
      <LocationProbe />
    </MemoryRouter>
  );
  return renderHook(() => ({ view: useProgressView(), params: useSearchParams() }), { wrapper });
}

const search = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');
const actionOf = () => screen.getByTestId('location').getAttribute('data-action');

describe('useProgressView: reading the URL', () => {
  it('reads tracks with no track or edit on a bare URL', () => {
    const { result } = renderView('/?tab=progress');
    expect(result.current.view.pview).toBe('tracks');
    expect(result.current.view.track).toBeNull();
    expect(result.current.view.edit).toBeNull();
  });

  it('reads pview=find, track and edit', () => {
    const { result } = renderView('/?tab=progress&pview=find&track=hot&edit=hot');
    expect(result.current.view.pview).toBe('find');
    expect(result.current.view.track).toBe('hot');
    expect(result.current.view.edit).toBe('hot');
  });

  it.each(['bogus', 'FIND', '', 'tracks'])('reads pview=%s as tracks', (value) => {
    const { result } = renderView(`/?pview=${value}`);
    expect(result.current.view.pview).toBe('tracks');
  });

  it('reads an empty track as no track', () => {
    const { result } = renderView('/?track=');
    expect(result.current.view.track).toBeNull();
  });
});

describe('useProgressView: setProgressView is one write', () => {
  it('leaves both pview and track in the final URL from one { pview, track } call', () => {
    const { result } = renderView('/?tab=progress');
    act(() => result.current.view.setProgressView({ pview: 'find', track: 'hot' }));
    expect(search().get('pview')).toBe('find');
    expect(search().get('track')).toBe('hot');
    expect(search().get('tab')).toBe('progress');
    expect(result.current.view.pview).toBe('find');
    expect(result.current.view.track).toBe('hot');
  });

  it('sets pview=find and clears track and edit in the same call', () => {
    const { result } = renderView('/?tab=progress&track=hot&edit=hot&sched=week');
    act(() => result.current.view.setProgressView({ pview: 'find', track: null, edit: null }));
    expect(search().get('pview')).toBe('find');
    expect(search().has('track')).toBe(false);
    expect(search().has('edit')).toBe(false);
    // Params outside the patch survive.
    expect(search().get('tab')).toBe('progress');
    expect(search().get('sched')).toBe('week');
  });

  it('deletes pview for tracks while setting track and edit in the same call', () => {
    const { result } = renderView('/?tab=progress&pview=find');
    act(() => result.current.view.setProgressView({ pview: 'tracks', track: 'calm', edit: 'calm' }));
    expect(search().has('pview')).toBe(false);
    expect(search().get('track')).toBe('calm');
    expect(search().get('edit')).toBe('calm');
  });

  it('leaves params absent from the patch untouched', () => {
    const { result } = renderView('/?pview=find&track=hot&edit=hot');
    act(() => result.current.view.setProgressView({ edit: null }));
    expect(search().get('pview')).toBe('find');
    expect(search().get('track')).toBe('hot');
    expect(search().has('edit')).toBe(false);
  });

  it('writes in place (history replace)', () => {
    const { result } = renderView('/?tab=progress');
    act(() => result.current.view.setProgressView({ pview: 'find' }));
    expect(actionOf()).toBe('REPLACE');
  });

  it('round-trips a track id with URL-special and unicode characters', () => {
    const id = 'a&b=c d%2F?é雪🐉\\"\'$';
    const { result } = renderView('/?tab=progress');
    act(() => result.current.view.setProgressView({ track: id }));
    expect(search().get('track')).toBe(id);
    expect(search().get('tab')).toBe('progress');
    expect(result.current.view.track).toBe(id);
  });
});

describe('useProgressView: the latest-setter ref', () => {
  it('a write after an await keeps the params set in between', async () => {
    const { result } = renderView('/?tab=progress');
    // Captured before the URL moves on: a stale closure, as an async handler holds it.
    const stale = result.current.view.setProgressView;
    act(() =>
      result.current.params[1]((prev) => {
        const next = new URLSearchParams(prev);
        next.set('sched', 'week');
        return next;
      }),
    );
    expect(search().get('sched')).toBe('week');

    await act(async () => {
      await Promise.resolve();
      stale({ pview: 'find', track: null });
    });
    expect(search().get('sched')).toBe('week');
    expect(search().get('tab')).toBe('progress');
    expect(search().get('pview')).toBe('find');
  });

  it('a stale setter after its own earlier write keeps that write', async () => {
    const { result } = renderView('/');
    const stale = result.current.view.setProgressView;
    act(() => stale({ track: 'hot' }));
    await act(async () => {
      await Promise.resolve();
      stale({ edit: 'hot' });
    });
    expect(search().get('track')).toBe('hot');
    expect(search().get('edit')).toBe('hot');
  });
});

describe('pview is a seeded sub-tab param (E-1)', () => {
  it('is deleted by a sub-tab reset, which keeps tab and settings', () => {
    const params = new URLSearchParams('tab=progress&pview=find&settings=general');
    clearRegisteredTabParams(params);
    expect(params.has('pview')).toBe(false);
    expect(params.get('tab')).toBe('progress');
    expect(params.get('settings')).toBe('general');
  });
});
