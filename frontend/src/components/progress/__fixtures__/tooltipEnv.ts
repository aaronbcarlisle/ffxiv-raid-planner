/**
 * What a Progress cell's tooltip needs in a test: jsdom has no `matchMedia`, which
 * `Tooltip` → `useDevice` reads, and Radix wants the app-root `TooltipProvider`.
 * `stubCanHover()` goes in a `beforeEach`; `TooltipWrapper` is RTL's `wrapper`.
 */
import { createElement, type ReactNode } from 'react';
import { vi } from 'vitest';
import { TooltipProvider } from '../../primitives';

/** Resolves every media query as a hover-capable desktop, so Tooltip renders and opens, and stubs ResizeObserver. */
export function stubCanHover(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(hover: hover) and (pointer: fine)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  // An open Radix tooltip measures its content; jsdom has no ResizeObserver.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}

export const TooltipWrapper = ({ children }: { children: ReactNode }) =>
  createElement(TooltipProvider, { delayDuration: 0, children });
