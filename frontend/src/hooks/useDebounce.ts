/**
 * useDebounce Hooks
 *
 * Provides debounced values and callbacks for performance optimization.
 *
 * @example Debounced value:
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 300);
 *
 * useEffect(() => {
 *   fetchResults(debouncedSearch);
 * }, [debouncedSearch]);
 * ```
 *
 * @example Debounced callback:
 * ```tsx
 * const saveToServer = useDebouncedCallback(
 *   (data: FormData) => api.save(data),
 *   500
 * );
 *
 * <input onChange={(e) => saveToServer({ name: e.target.value })} />
 * ```
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/**
 * Returns a debounced version of the value that only updates
 * after the specified delay has passed without new updates.
 *
 * @param value The value to debounce
 * @param delay Debounce delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Returns a debounced callback that delays invoking until after
 * the specified delay has passed without new calls.
 *
 * The callback is stable across renders.
 *
 * @param callback The function to debounce
 * @param delay Debounce delay in milliseconds
 * @returns Object with { callback, cancel, flush }
 */
export function useDebouncedCallback<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number
): {
  /** The debounced callback function */
  callback: (...args: Parameters<T>) => void;
  /** Cancel any pending invocation */
  cancel: () => void;
  /** Immediately invoke with most recent args */
  flush: () => void;
} {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const argsRef = useRef<Parameters<T> | null>(null);

  // Update callback ref to avoid stale closures
  useEffect(() => {
    callbackRef.current = callback;
  });

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    cancel();
    if (argsRef.current !== null) {
      const args = argsRef.current;
      argsRef.current = null;
      callbackRef.current(...(args as Parameters<T>));
    }
  }, [cancel]);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      argsRef.current = args;
      cancel();
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
        argsRef.current = null;
      }, delay);
    },
    [delay, cancel]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return useMemo(() => ({
    callback: debouncedCallback,
    cancel,
    flush,
  }), [debouncedCallback, cancel, flush]);
}
