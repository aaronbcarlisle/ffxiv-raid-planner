/**
 * Unit tests for the useDebounce hooks
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedCallback } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('does not update immediately when value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });
    expect(result.current).toBe('initial');
  });

  it('updates after delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('updated');
  });

  it('resets timer when value changes during delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'first' });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    rerender({ value: 'second' });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Still showing initial - timer was reset
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Now should show second
    expect(result.current).toBe('second');
  });

  it('works with different types', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 42 } }
    );

    rerender({ value: 100 });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe(100);
  });

  it('works with objects', () => {
    const obj1 = { name: 'Alice' };
    const obj2 = { name: 'Bob' };

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: obj1 } }
    );

    rerender({ value: obj2 });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toEqual({ name: 'Bob' });
  });
});

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call immediately', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 500));

    act(() => {
      result.current.callback('arg1');
    });

    expect(fn).not.toHaveBeenCalled();
  });

  it('calls after delay', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 500));

    act(() => {
      result.current.callback('arg1');
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(fn).toHaveBeenCalledWith('arg1');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets timer on repeated calls', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 500));

    act(() => {
      result.current.callback('first');
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    act(() => {
      result.current.callback('second');
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(fn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(fn).toHaveBeenCalledWith('second');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel prevents invocation', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 500));

    act(() => {
      result.current.callback('arg1');
    });

    act(() => {
      result.current.cancel();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(fn).not.toHaveBeenCalled();
  });

  it('flush invokes immediately with last args', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 500));

    act(() => {
      result.current.callback('first');
      result.current.callback('second');
      result.current.flush();
    });

    expect(fn).toHaveBeenCalledWith('second');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('flush does nothing if no pending call', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 500));

    act(() => {
      result.current.flush();
    });

    expect(fn).not.toHaveBeenCalled();
  });

  it('maintains stable references', () => {
    const fn = vi.fn();
    const { result, rerender } = renderHook(() => useDebouncedCallback(fn, 500));

    const { callback: cb1, cancel: cancel1, flush: flush1 } = result.current;

    rerender();

    const { callback: cb2, cancel: cancel2, flush: flush2 } = result.current;

    expect(cb1).toBe(cb2);
    expect(cancel1).toBe(cancel2);
    expect(flush1).toBe(flush2);
  });

  it('uses latest callback version', () => {
    let counter = 0;
    const { result, rerender } = renderHook(
      ({ fn }) => useDebouncedCallback(fn, 500),
      { initialProps: { fn: () => { counter = 1; } } }
    );

    act(() => {
      result.current.callback();
    });

    rerender({ fn: () => { counter = 2; } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(counter).toBe(2);
  });

  it('cleans up on unmount', () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(fn, 500));

    act(() => {
      result.current.callback('arg1');
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(fn).not.toHaveBeenCalled();
  });
});
