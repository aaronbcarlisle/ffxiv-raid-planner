/**
 * @vitest-environment jsdom
 */

import { renderHook, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAltHeld } from './useAltHeld';

describe('useAltHeld', () => {
  it('is false initially and true while Alt is down', () => {
    const { result } = renderHook(() => useAltHeld());
    expect(result.current).toBe(false);
    act(() => { fireEvent.keyDown(window, { key: 'Alt' }); });
    expect(result.current).toBe(true);
    act(() => { fireEvent.keyUp(window, { key: 'Alt' }); });
    expect(result.current).toBe(false);
  });

  it('ignores non-Alt keys', () => {
    const { result } = renderHook(() => useAltHeld());
    act(() => { fireEvent.keyDown(window, { key: 'Shift' }); });
    expect(result.current).toBe(false);
  });

  it('resets on window blur (Alt+Tab cannot strand held=true)', () => {
    const { result } = renderHook(() => useAltHeld());
    act(() => { fireEvent.keyDown(window, { key: 'Alt' }); });
    expect(result.current).toBe(true);
    act(() => { fireEvent(window, new Event('blur')); });
    expect(result.current).toBe(false);
  });

  it('removes listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useAltHeld());
    unmount();
    const removed = removeSpy.mock.calls.map((c) => c[0]);
    expect(removed).toEqual(expect.arrayContaining(['keydown', 'keyup', 'blur']));
    removeSpy.mockRestore();
  });
});
