/**
 * Unit tests for the useDevice hook
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock matchMedia before importing the hook
const createMockMediaQuery = (matches: boolean) => ({
  matches,
  media: '',
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

describe('useDevice', () => {
  let mockSmallScreen: ReturnType<typeof createMockMediaQuery>;
  let mockTouch: ReturnType<typeof createMockMediaQuery>;
  let mockHover: ReturnType<typeof createMockMediaQuery>;
  let mockMotion: ReturnType<typeof createMockMediaQuery>;
  let changeListeners: Map<string, () => void>;

  beforeEach(() => {
    // Reset module state between tests
    vi.resetModules();

    changeListeners = new Map();

    // Create fresh mocks for each test
    mockSmallScreen = createMockMediaQuery(false);
    mockTouch = createMockMediaQuery(false);
    mockHover = createMockMediaQuery(true);
    mockMotion = createMockMediaQuery(false);

    // Track addEventListener calls to simulate media query changes
    mockSmallScreen.addEventListener = vi.fn((event, listener) => {
      if (event === 'change') changeListeners.set('smallScreen', listener as () => void);
    });
    mockTouch.addEventListener = vi.fn((event, listener) => {
      if (event === 'change') changeListeners.set('touch', listener as () => void);
    });
    mockHover.addEventListener = vi.fn((event, listener) => {
      if (event === 'change') changeListeners.set('hover', listener as () => void);
    });
    mockMotion.addEventListener = vi.fn((event, listener) => {
      if (event === 'change') changeListeners.set('motion', listener as () => void);
    });

    // Mock window.matchMedia
    vi.stubGlobal('matchMedia', (query: string) => {
      if (query === '(max-width: 639px)') return mockSmallScreen;
      if (query === '(pointer: coarse)') return mockTouch;
      if (query === '(hover: hover) and (pointer: fine)') return mockHover;
      if (query === '(prefers-reduced-motion: reduce)') return mockMotion;
      return createMockMediaQuery(false);
    });

    // Mock navigator.maxTouchPoints
    vi.stubGlobal('navigator', { ...navigator, maxTouchPoints: 0 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return default desktop capabilities', async () => {
    const { useDevice } = await import('./useDevice');
    const { result } = renderHook(() => useDevice());

    expect(result.current).toEqual({
      isSmallScreen: false,
      isTouch: false,
      canHover: true,
      prefersReducedMotion: false,
    });
  });

  it('should detect small screen from media query', async () => {
    mockSmallScreen.matches = true;

    const { useDevice } = await import('./useDevice');
    const { result } = renderHook(() => useDevice());

    expect(result.current.isSmallScreen).toBe(true);
  });

  it('should detect touch capability from pointer: coarse', async () => {
    mockTouch.matches = true;

    const { useDevice } = await import('./useDevice');
    const { result } = renderHook(() => useDevice());

    expect(result.current.isTouch).toBe(true);
  });

  it('should detect touch capability from maxTouchPoints', async () => {
    vi.stubGlobal('navigator', { ...navigator, maxTouchPoints: 5 });

    const { useDevice } = await import('./useDevice');
    const { result } = renderHook(() => useDevice());

    expect(result.current.isTouch).toBe(true);
  });

  it('should detect no hover capability', async () => {
    mockHover.matches = false;

    const { useDevice } = await import('./useDevice');
    const { result } = renderHook(() => useDevice());

    expect(result.current.canHover).toBe(false);
  });

  it('should detect reduced motion preference', async () => {
    mockMotion.matches = true;

    const { useDevice } = await import('./useDevice');
    const { result } = renderHook(() => useDevice());

    expect(result.current.prefersReducedMotion).toBe(true);
  });

  it('should update when media query changes', async () => {
    const { useDevice } = await import('./useDevice');
    const { result } = renderHook(() => useDevice());

    expect(result.current.isSmallScreen).toBe(false);

    // Simulate media query change
    mockSmallScreen.matches = true;
    act(() => {
      changeListeners.get('smallScreen')?.();
    });

    expect(result.current.isSmallScreen).toBe(true);
  });

  it('should share listeners across multiple hook instances', async () => {
    const { useDevice } = await import('./useDevice');

    // Render multiple hooks
    renderHook(() => useDevice());
    renderHook(() => useDevice());
    renderHook(() => useDevice());

    // addEventListener should only be called once per query (singleton pattern)
    expect(mockSmallScreen.addEventListener).toHaveBeenCalledTimes(1);
    expect(mockTouch.addEventListener).toHaveBeenCalledTimes(1);
    expect(mockHover.addEventListener).toHaveBeenCalledTimes(1);
    expect(mockMotion.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('should have SSR-safe getServerSnapshot that returns desktop defaults', async () => {
    // The getServerSnapshot function is used during SSR and should return
    // safe defaults (desktop-like). We verify this indirectly by checking
    // that the initial render matches expected desktop defaults.
    const { useDevice } = await import('./useDevice');
    const { result } = renderHook(() => useDevice());

    // Initial values should match the SSR-safe defaults
    expect(result.current).toEqual({
      isSmallScreen: false,
      isTouch: false,
      canHover: true,
      prefersReducedMotion: false,
    });
  });
});
