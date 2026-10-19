/**
 * useVisibleWidth — the visible width of the matrix's scroll container (S2a-3a·G2b fix). The open
 * farm's panel is one cell spanning the whole table, which is wider than the view, so its own
 * layout must follow this width and not the table's. Null until measured (and in an environment
 * with no layout), which leaves the panel unconstrained.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

export function useVisibleWidth<T extends HTMLElement>(): [RefObject<T | null>, number | null] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth > 0 ? el.clientWidth : null);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
