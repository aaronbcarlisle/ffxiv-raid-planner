import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWeekClock } from './useWeekClock';
import { useLootTrackingStore } from '../stores/lootTrackingStore';

describe('useWeekClock', () => {
  beforeEach(() => {
    useLootTrackingStore.setState({
      currentWeek: 3, maxWeek: 4, weekStartDate: '2026-06-10T00:00:00Z',
      weeksWithEntries: new Set([1, 3]),
    });
  });

  it('exposes the clock state', () => {
    const { result } = renderHook(() => useWeekClock('g1', 't1'));
    expect(result.current.currentWeek).toBe(3);
    expect(result.current.maxWeek).toBe(4);
    expect(result.current.isCurrent(3)).toBe(true);
    expect(result.current.isCurrent(2)).toBe(false);
  });

  it('rangeOfWeek maps week N to anchor + (N-1)*7d .. +6d', () => {
    const { result } = renderHook(() => useWeekClock('g1', 't1'));
    const r1 = result.current.rangeOfWeek(1)!;
    expect(r1.start.toISOString().slice(0, 10)).toBe('2026-06-10');
    expect(r1.end.toISOString().slice(0, 10)).toBe('2026-06-16');
    const r3 = result.current.rangeOfWeek(3)!;
    expect(r3.start.toISOString().slice(0, 10)).toBe('2026-06-24');
  });

  it('rangeOfWeek is null without an anchor', () => {
    useLootTrackingStore.setState({ weekStartDate: null });
    const { result } = renderHook(() => useWeekClock('g1', 't1'));
    expect(result.current.rangeOfWeek(1)).toBeNull();
  });
});
