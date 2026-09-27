/**
 * usePlayerOverview — Hub-local data hook for GET /api/player/overview (R-PH2-I).
 *
 * Component state, not a Zustand store: only the Overview tab reads this, and
 * it is time-sensitive (next session, this week's drops). Starts with
 * `isLoading: true` so the cold first frame renders a skeleton, never the
 * empty state (director F11).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../services/api';

interface OverviewNextSession {
  sessionId: string;
  title: string;
  startsAt: string;
}

export interface OverviewStatic {
  id: string;
  shareCode: string;
  name: string;
  role: string;
  tierId: string | null;
  memberCount: number;
  nextSession: OverviewNextSession | null;
  floorsCleared: number | null;
  avgBisPct: number | null;
}

export type OverviewActionItemType = 'rsvp_pending' | 'loot_priority';

export interface OverviewActionItem {
  type: OverviewActionItemType;
  staticId: string;
  staticName: string;
  title: string;
  detail: string;
  href: string;
  startsAt: string | null;
}

export interface PlayerOverview {
  statics: OverviewStatic[];
  actionItems: OverviewActionItem[];
}

interface UsePlayerOverviewResult {
  data: PlayerOverview | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

export function usePlayerOverview(): UsePlayerOverviewResult {
  const [data, setData] = useState<PlayerOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guards two races: a response landing after unmount, and an older
  // request's response landing after a newer one already settled.
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // No setState here: the mount effect below calls this with state already
  // in its initial shape (isLoading true, error null), so nothing needs
  // resetting on that first call. `retry` resets state itself before calling in.
  const fetchOverview = useCallback((requestId: number) => {
    api
      .get<PlayerOverview>('/api/player/overview')
      .then((response) => {
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        setData(response);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchOverview(requestIdRef.current);
  }, [fetchOverview]);

  const retry = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    fetchOverview(requestId);
  }, [fetchOverview]);

  return { data, isLoading, error, retry };
}
