/**
 * useProgressView — the Progress view in the URL (S2a-4a·A2 Task TA2; R-F-3, E-1, D-9).
 *
 * `?pview=find` is the Find view; Tracks is the default and is omitted. `track` and `edit` ride
 * along because a view change usually moves them too. `setProgressView(patch)` writes every param
 * in the patch in ONE `setSearchParams(prev => …, { replace: true })`: React Router 7 builds each
 * write from the render-time params, so two writes in one handler would lose the first (R-D11-B).
 * `null` deletes a param and `pview: 'tracks'` deletes `pview`. `farm: null` drops V1's
 * `?farm=` once the page has mapped it to Find.
 *
 * The router's setter changes with every URL change, so it is read through a latest-setter ref: a
 * write after an `await`, or from a stale closure, still builds on the params as they are now.
 * `useTrackParam` stays as it is for other callers; the Progress page writes through this hook.
 */
import { useCallback, useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export type ProgressViewName = 'tracks' | 'find';

export interface ProgressViewPatch {
  pview?: ProgressViewName;
  track?: string | null;
  edit?: string | null;
  /** Only ever cleared: V1's `?farm=` is mapped to `pview=find` by the page. */
  farm?: null;
}

function readParam(params: URLSearchParams, key: string): string | null {
  const raw = params.get(key);
  return raw !== null && raw !== '' ? raw : null;
}

export function useProgressView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const pview: ProgressViewName = searchParams.get('pview') === 'find' ? 'find' : 'tracks';
  const track = readParam(searchParams, 'track');
  const edit = readParam(searchParams, 'edit');

  const latest = useRef(setSearchParams);
  useLayoutEffect(() => {
    latest.current = setSearchParams;
  }, [setSearchParams]);

  const setProgressView = useCallback((patch: ProgressViewPatch) => {
    latest.current(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (patch.pview !== undefined) {
          if (patch.pview === 'find') params.set('pview', 'find');
          else params.delete('pview');
        }
        for (const key of ['track', 'edit'] as const) {
          const value = patch[key];
          if (value === undefined) continue;
          if (value === null) params.delete(key);
          else params.set(key, value);
        }
        if (patch.farm === null) params.delete('farm');
        return params;
      },
      { replace: true },
    );
  }, []);

  return { pview, track, edit, setProgressView };
}
