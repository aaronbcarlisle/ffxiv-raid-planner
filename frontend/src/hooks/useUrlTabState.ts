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

// Every param ever used by this hook is registered here. The "reset sub-tabs to
// default on navigation" preference clears all of these in one shot, so a newly
// added sub-tab is covered automatically as long as it uses this hook — which is
// the standard. See clearRegisteredTabParams().
//
// Registration also happens on render (so anything new is picked up once mounted),
// but the set is SEEDED with the known sub-tab params below. Seeding matters for
// deep-linked / bookmarked URLs: a param like `?goal=farms` can be present before
// the view that owns it has ever mounted this session, so render-time registration
// alone would miss it and the stale value would survive a primary-tab switch even
// with "Remember sub-tabs" off. The seed must NOT include the primary `tab` param
// or the settings-panel `settings` param — clearing those would wipe the tab/panel
// being navigated to.
const SEEDED_TAB_PARAMS = [
  'rsub', 'sched', 'stab', 'goal', 'farm', 'coll', 'gsub', 'psub', 'rcsub', 'avail', 'mf',
] as const;
const registeredTabParams = new Set<string>(SEEDED_TAB_PARAMS);

/** Delete every hook-managed sub-tab param from a URLSearchParams (mutates it). */
export function clearRegisteredTabParams(params: URLSearchParams): void {
  for (const key of registeredTabParams) params.delete(key);
}

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
  /** Value when the param is absent/invalid; also omitted from the URL.
   *  `NoInfer` so a typo here is a compile error instead of silently widening
   *  the union to an unreachable default tab. */
  defaultValue: NoInfer<T>,
  options?: UrlTabStateOptions,
): [T, (next: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const history = options?.history ?? 'push';
  registeredTabParams.add(param);

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
