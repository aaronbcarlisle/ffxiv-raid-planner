/**
 * Unit tests for the useLongPress hook
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPress } from './useLongPress';

// Helper to create mock touch events
const createTouchEvent = (clientX: number, clientY: number) => ({
  touches: [{ clientX, clientY }],
  changedTouches: [{ clientX, clientY }],
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
});

const createMouseEvent = () => ({
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
});

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should trigger onLongPress after duration', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    const touchEvent = createTouchEvent(100, 100);

    act(() => {
      result.current.onTouchStart(touchEvent as unknown as React.TouchEvent);
    });

    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('should use custom duration', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, duration: 1000 }));

    const touchEvent = createTouchEvent(100, 100);

    act(() => {
      result.current.onTouchStart(touchEvent as unknown as React.TouchEvent);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('should cancel on touchmove beyond threshold', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    const startEvent = createTouchEvent(100, 100);
    const moveEvent = createTouchEvent(120, 100); // 20px movement > 10px threshold

    act(() => {
      result.current.onTouchStart(startEvent as unknown as React.TouchEvent);
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      result.current.onTouchMove(moveEvent as unknown as React.TouchEvent);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('should not cancel on small movement within threshold', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    const startEvent = createTouchEvent(100, 100);
    const moveEvent = createTouchEvent(105, 105); // 5px movement < 10px threshold

    act(() => {
      result.current.onTouchStart(startEvent as unknown as React.TouchEvent);
    });

    act(() => {
      result.current.onTouchMove(moveEvent as unknown as React.TouchEvent);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('should call onClick on quick tap', () => {
    const onLongPress = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onClick }));

    const touchEvent = createTouchEvent(100, 100);

    act(() => {
      result.current.onTouchStart(touchEvent as unknown as React.TouchEvent);
    });

    act(() => {
      vi.advanceTimersByTime(200); // Less than 500ms
    });

    act(() => {
      result.current.onTouchEnd(touchEvent as unknown as React.TouchEvent);
    });

    expect(onLongPress).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick after long press', () => {
    const onLongPress = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onClick }));

    const touchEvent = createTouchEvent(100, 100);

    act(() => {
      result.current.onTouchStart(touchEvent as unknown as React.TouchEvent);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.onTouchEnd(touchEvent as unknown as React.TouchEvent);
    });

    expect(onClick).not.toHaveBeenCalled();
    expect(touchEvent.preventDefault).toHaveBeenCalled();
    expect(touchEvent.stopPropagation).toHaveBeenCalled();
  });

  it('should not call onClick after touch move beyond threshold', () => {
    const onLongPress = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onClick }));

    const startEvent = createTouchEvent(100, 100);
    const moveEvent = createTouchEvent(150, 100); // Beyond threshold
    const endEvent = createTouchEvent(150, 100);

    act(() => {
      result.current.onTouchStart(startEvent as unknown as React.TouchEvent);
    });

    act(() => {
      result.current.onTouchMove(moveEvent as unknown as React.TouchEvent);
    });

    act(() => {
      result.current.onTouchEnd(endEvent as unknown as React.TouchEvent);
    });

    expect(onLongPress).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('should cleanup timer on unmount', () => {
    const onLongPress = vi.fn();
    const { result, unmount } = renderHook(() => useLongPress({ onLongPress }));

    const touchEvent = createTouchEvent(100, 100);

    act(() => {
      result.current.onTouchStart(touchEvent as unknown as React.TouchEvent);
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('should handle onTouchCancel', () => {
    const onLongPress = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress, onClick }));

    const touchEvent = createTouchEvent(100, 100);

    act(() => {
      result.current.onTouchStart(touchEvent as unknown as React.TouchEvent);
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      result.current.onTouchCancel(touchEvent as unknown as React.TouchEvent);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('should prevent context menu during long press', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    const touchEvent = createTouchEvent(100, 100);
    const contextMenuEvent = createMouseEvent();

    act(() => {
      result.current.onTouchStart(touchEvent as unknown as React.TouchEvent);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      result.current.onContextMenu(contextMenuEvent as unknown as React.MouseEvent);
    });

    expect(contextMenuEvent.preventDefault).toHaveBeenCalled();
    expect(contextMenuEvent.stopPropagation).toHaveBeenCalled();
  });

  it('should not prevent context menu when not long pressing', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    const contextMenuEvent = createMouseEvent();

    act(() => {
      result.current.onContextMenu(contextMenuEvent as unknown as React.MouseEvent);
    });

    expect(contextMenuEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('should return stable handler references', () => {
    const onLongPress = vi.fn();
    const { result, rerender } = renderHook(() => useLongPress({ onLongPress }));

    const handlers1 = result.current;
    rerender();
    const handlers2 = result.current;

    expect(handlers1.onTouchStart).toBe(handlers2.onTouchStart);
    expect(handlers1.onTouchEnd).toBe(handlers2.onTouchEnd);
    expect(handlers1.onTouchMove).toBe(handlers2.onTouchMove);
    expect(handlers1.onTouchCancel).toBe(handlers2.onTouchCancel);
    expect(handlers1.onContextMenu).toBe(handlers2.onContextMenu);
  });
});
