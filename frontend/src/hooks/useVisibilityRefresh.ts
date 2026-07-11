import { useEffect, useRef } from 'react';

/**
 * Calls `callback` when the document becomes visible after being hidden for
 * at least `minHiddenMs` milliseconds. Useful for silently re-fetching data
 * when the user returns from another tab (e.g. after linking characters in
 * the profile page the split-clear board refreshes automatically).
 */
export function useVisibilityRefresh(callback: () => void, minHiddenMs = 2000) {
  const callbackRef = useRef(callback);
  useEffect(() => { callbackRef.current = callback; }, [callback]);

  useEffect(() => {
    let hiddenAt: number | null = null;

    const handle = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null) {
        if (Date.now() - hiddenAt >= minHiddenMs) callbackRef.current();
        hiddenAt = null;
      }
    };

    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [minHiddenMs]);
}
