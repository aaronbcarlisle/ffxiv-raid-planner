/**
 * Unit tests for the useSwipe hook
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSwipe } from './useSwipe';

// Helper to create mock touch start event
const createTouchStartEvent = (clientX: number, clientY: number) => ({
  touches: [{ clientX, clientY }],
});

// Helper to create mock touch end event
const createTouchEndEvent = (clientX: number, clientY: number) => ({
  changedTouches: [{ clientX, clientY }],
});

describe('useSwipe', () => {
  it('should detect left swipe', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, onSwipeRight }));

    act(() => {
      result.current.onTouchStart(createTouchStartEvent(200, 100) as unknown as React.TouchEvent);
    });

    act(() => {
      result.current.onTouchEnd(createTouchEndEvent(100, 100) as unknown as React.TouchEvent);
    });

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('should detect right swipe', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, onSwipeRight }));

    act(() => {
      result.current.onTouchStart(createTouchStartEvent(100, 100) as unknown as React.TouchEvent);
    });

    act(() => {
      result.current.onTouchEnd(createTouchEndEvent(200, 100) as unknown as React.TouchEvent);
    });

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('should ignore swipe below minSwipeDistance', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, onSwipeRight, minSwipeDistance: 50 }));

    act(() => {
      result.current.onTouchStart(createTouchStartEvent(100, 100) as unknown as React.TouchEvent);
    });

    act(() => {
      // Only 30px movement, less than 50px threshold
      result.current.onTouchEnd(createTouchEndEvent(130, 100) as unknown as React.TouchEvent);
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('should trigger swipe at exact minSwipeDistance', () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeRight, minSwipeDistance: 50 }));

    act(() => {
      result.current.onTouchStart(createTouchStartEvent(100, 100) as unknown as React.TouchEvent);
    });

    act(() => {
      // Exactly 50px movement
      result.current.onTouchEnd(createTouchEndEvent(150, 100) as unknown as React.TouchEvent);
    });

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('should ignore vertical scrolling', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() =>
      useSwipe({ onSwipeLeft, onSwipeRight, maxVerticalDistance: 100 })
    );

    act(() => {
      result.current.onTouchStart(createTouchStartEvent(100, 100) as unknown as React.TouchEvent);
    });

    act(() => {
      // Large vertical movement (150px) exceeds maxVerticalDistance (100px)
      result.current.onTouchEnd(createTouchEndEvent(200, 250) as unknown as React.TouchEvent);
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('should allow swipe with small vertical movement', () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() =>
      useSwipe({ onSwipeRight, maxVerticalDistance: 100 })
    );

    act(() => {
      result.current.onTouchStart(createTouchStartEvent(100, 100) as unknown as React.TouchEvent);
    });

    act(() => {
      // Small vertical movement (50px) within maxVerticalDistance (100px)
      result.current.onTouchEnd(createTouchEndEvent(200, 150) as unknown as React.TouchEvent);
    });

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('should use default minSwipeDistance of 50', () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeRight }));

    act(() => {
      result.current.onTouchStart(createTouchStartEvent(100, 100) as unknown as React.TouchEvent);
    });

    act(() => {
      // 40px movement, less than default 50px
      result.current.onTouchEnd(createTouchEndEvent(140, 100) as unknown as React.TouchEvent);
    });

    expect(onSwipeRight).not.toHaveBeenCalled();

    // Reset and try with 60px
    act(() => {
      result.current.onTouchStart(createTouchStartEvent(100, 100) as unknown as React.TouchEvent);
    });

    act(() => {
      result.current.onTouchEnd(createTouchEndEvent(160, 100) as unknown as React.TouchEvent);
    });

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('should use default maxVerticalDistance of 100', () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeRight }));

    act(() => {
      result.current.onTouchStart(createTouchStartEvent(100, 100) as unknown as React.TouchEvent);
    });

    act(() => {
      // Vertical movement of 110px, exceeds default 100px
      result.current.onTouchEnd(createTouchEndEvent(200, 210) as unknown as React.TouchEvent);
    });

    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('should handle missing touch start', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, onSwipeRight }));

    // Call touchEnd without touchStart
    act(() => {
      result.current.onTouchEnd(createTouchEndEvent(200, 100) as unknown as React.TouchEvent);
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('should work with only onSwipeLeft callback', () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeLeft }));

    act(() => {
      result.current.onTouchStart(createTouchStartEvent(200, 100) as unknown as React.TouchEvent);
    });

    act(() => {
      result.current.onTouchEnd(createTouchEndEvent(100, 100) as unknown as React.TouchEvent);
    });

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('should work with only onSwipeRight callback', () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeRight }));

    act(() => {
      result.current.onTouchStart(createTouchStartEvent(100, 100) as unknown as React.TouchEvent);
    });

    act(() => {
      result.current.onTouchEnd(createTouchEndEvent(200, 100) as unknown as React.TouchEvent);
    });

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple swipes in sequence', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, onSwipeRight }));

    // First swipe right
    act(() => {
      result.current.onTouchStart(createTouchStartEvent(100, 100) as unknown as React.TouchEvent);
    });
    act(() => {
      result.current.onTouchEnd(createTouchEndEvent(200, 100) as unknown as React.TouchEvent);
    });

    // Second swipe left
    act(() => {
      result.current.onTouchStart(createTouchStartEvent(200, 100) as unknown as React.TouchEvent);
    });
    act(() => {
      result.current.onTouchEnd(createTouchEndEvent(100, 100) as unknown as React.TouchEvent);
    });

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('should return stable handler references', () => {
    const onSwipeLeft = vi.fn();
    const { result, rerender } = renderHook(() => useSwipe({ onSwipeLeft }));

    const handlers1 = result.current;
    rerender();
    const handlers2 = result.current;

    expect(handlers1.onTouchStart).toBe(handlers2.onTouchStart);
    expect(handlers1.onTouchEnd).toBe(handlers2.onTouchEnd);
  });
});
