/**
 * useTrackParam — the open Progress farm row in the URL (S2a-3a·G2 Task TG3; R-S3-3, D-8).
 * `?track=<goal id>` names the one open row. It is written in place (history replace), so
 * Back leaves the page instead of stepping through rows; `null` removes it.
 *
 * `useUrlTabState` cannot hold it (that hook takes a fixed value list, and a goal id is not
 * one), but `track` sits in its `SEEDED_TAB_PARAMS`, so it behaves like every sub-tab param:
 * a primary-tab switch keeps it under the default 'remember' tab memory and clears it under
 * 'reset' (`clearRegisteredTabParams`). What the id means is `ProgressPage`'s: it drops an
 * id that matches no goal once the goals have loaded, and clears it when the static changes.
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const PARAM = 'track';

export function useTrackParam(): [string | null, (id: string | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(PARAM);
  const track = raw !== null && raw !== '' ? raw : null;

  const setTrack = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (id === null) params.delete(PARAM);
          else params.set(PARAM, id);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return [track, setTrack];
}
