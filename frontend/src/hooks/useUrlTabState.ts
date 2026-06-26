/**
 * useUrlTabState
 *
 * One hook for any tab / sub-tab / segmented-control selection that should live
 * in the URL. The URL is the single source of truth, so you get three things
 * for free with zero per-component boilerplate:
 *   1. Deep-linking — copy/paste the URL and land on the same sub-tab.
 *   2. Reload-safe — the selection survives a refresh.
 *   3. Browser back/forward — because the value is *derived* from the URL,
 *      a history pop re-renders with the popped value automatically.
 *
 * Usage:
 *   const VIEWS = ['members', 'characters', 'split-planner'] as const;
 *   const [view, setView] = useUrlTabState('rsub', VIEWS, 'members');
 *
 * The default value is omitted from the URL to keep links clean. Pass
 * `{ history: 'replace' }` for selections that shouldn't add a history entry
 * (e.g. a minor filter you don't want back/forward to step through).
 */

import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

interface UrlTabStateOptions {
  /** 'push' (default) adds a history entry so back/forward steps through the
   *  selection; 'replace' updates the URL in place without new history. */
  history?: 'push' | 'replace';
}

export function useUrlTabState<T extends string>(
  /** The URL query-param key (e.g. 'rsub', 'goal', 'settings'). */
  param: string,
  /** Allowed values; anything else in the URL falls back to defaultValue. */
  values: readonly T[],
  /** Value when the param is absent/invalid; also omitted from the URL. */
  defaultValue: T,
  options?: UrlTabStateOptions,
): [T, (next: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const history = options?.history ?? 'push';

  const raw = searchParams.get(param);
  const value = (raw && (values as readonly string[]).includes(raw) ? raw : defaultValue) as T;

  const setValue = useCallback(
    (next: T) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === defaultValue) params.delete(param);
          else params.set(param, next);
          return params;
        },
        history === 'replace' ? { replace: true } : undefined,
      );
    },
    [setSearchParams, param, defaultValue, history],
  );

  return [value, setValue];
}
