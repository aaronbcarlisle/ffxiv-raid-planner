import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRosterDensity, ROSTER_DENSITY_KEY } from './useRosterDensity';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import { analytics } from '../../services/analytics';

vi.mock('../../services/analytics', () => ({
  analytics: { track: vi.fn() },
}));

const trackMock = vi.mocked(analytics.track);

/** Dispatch a keydown from body so window is an ANCESTOR (capture precedes bubble). */
function pressV(init: KeyboardEventInit = {}) {
  act(() => {
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'v', bubbles: true, cancelable: true, ...init }),
    );
  });
}

function renderDensity(opts?: Partial<Parameters<typeof useRosterDensity>[0]>) {
  return renderHook(
    (props: Parameters<typeof useRosterDensity>[0]) => useRosterDensity(props),
    { initialProps: { shortcutsDisabled: false, active: true, ...opts } },
  );
}

beforeEach(() => {
  localStorage.clear();
  trackMock.mockClear();
  useSettingsPanelStore.setState({ isOpen: false });
});

describe('useRosterDensity', () => {
  it('defaults to compact and honors a stored expanded density', () => {
    const { result } = renderDensity();
    expect(result.current.density).toBe('compact');

    localStorage.setItem(ROSTER_DENSITY_KEY, 'expanded');
    const { result: restored } = renderDensity();
    expect(restored.current.density).toBe('expanded');
  });

  it('setDensity persists to the v2-scoped key and emits view_mode_change with the shell field', () => {
    const { result } = renderDensity();
    act(() => result.current.setDensity('expanded'));

    expect(result.current.density).toBe('expanded');
    expect(localStorage.getItem(ROSTER_DENSITY_KEY)).toBe('expanded');
    // Never legacy's key — a v2 toggle must not change what legacy renders.
    expect(localStorage.getItem('party-view-mode')).toBeNull();
    expect(trackMock).toHaveBeenCalledWith('feature', 'view_mode_change', {
      mode: 'expanded',
      shell: 'v2',
    });
  });

  it('per-card override inverts one card against the global density and toggles back', () => {
    const { result } = renderDensity();
    expect(result.current.cardDensity('a')).toBe('compact');

    act(() => result.current.toggleCardOverride('a'));
    expect(result.current.cardDensity('a')).toBe('expanded');
    expect(result.current.cardDensity('b')).toBe('compact');

    act(() => result.current.toggleCardOverride('a'));
    expect(result.current.cardDensity('a')).toBe('compact');
  });

  it('a global density change clears per-card overrides', () => {
    const { result } = renderDensity();
    act(() => result.current.toggleCardOverride('a'));
    act(() => result.current.setDensity('expanded'));
    // No stale inversion: 'a' follows the new global mode.
    expect(result.current.cardDensity('a')).toBe('expanded');
  });

  it('re-click-expand-all: clears overrides when any exist, else collapses every card (R-023)', () => {
    const { result } = renderDensity();
    act(() => result.current.setDensity('expanded'));

    // One collapsed card → re-click re-expands all.
    act(() => result.current.toggleCardOverride('a'));
    act(() => result.current.handleExpandedReselect(['a', 'b', 'c']));
    expect(result.current.cardDensity('a')).toBe('expanded');
    expect(result.current.cardDensity('b')).toBe('expanded');

    // Everything expanded → re-click collapses all.
    act(() => result.current.handleExpandedReselect(['a', 'b', 'c']));
    expect(result.current.cardDensity('a')).toBe('compact');
    expect(result.current.cardDensity('c')).toBe('compact');
  });

  it('V toggles the density and swallows the event before bubble-phase listeners', () => {
    const bubbleListener = vi.fn();
    window.addEventListener('keydown', bubbleListener);
    const { result } = renderDensity();

    pressV();
    expect(result.current.density).toBe('expanded');
    // The frozen shared hook listens at bubble phase on window — it must never
    // see a V handled here (it would emit shell-less + write party-view-mode).
    expect(bubbleListener).not.toHaveBeenCalled();

    pressV();
    expect(result.current.density).toBe('compact');
    window.removeEventListener('keydown', bubbleListener);
  });

  it('ignores V with a modifier held (paste et al. reach their targets)', () => {
    const bubbleListener = vi.fn();
    window.addEventListener('keydown', bubbleListener);
    const { result } = renderDensity();

    pressV({ ctrlKey: true });
    expect(result.current.density).toBe('compact');
    expect(bubbleListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', bubbleListener);
  });

  it('ignores V while typing in an input (shared-hook guard parity)', () => {
    const { result } = renderDensity();
    const input = document.createElement('input');
    document.body.appendChild(input);

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', bubbles: true }));
    });
    expect(result.current.density).toBe('compact');
    input.remove();
  });

  it('still swallows but does not toggle while a modal is open or on the Board view', () => {
    const bubbleListener = vi.fn();
    window.addEventListener('keydown', bubbleListener);

    const { result, rerender } = renderDensity({ shortcutsDisabled: true });
    pressV();
    expect(result.current.density).toBe('compact');
    expect(bubbleListener).not.toHaveBeenCalled();

    rerender({ shortcutsDisabled: false, active: false });
    pressV();
    expect(result.current.density).toBe('compact');
    expect(bubbleListener).not.toHaveBeenCalled();
    window.removeEventListener('keydown', bubbleListener);
  });

  it('is inert (swallowed, density unchanged) while the settings panel is open', () => {
    // Density must not flip behind the panel — and the event still must not
    // reach the frozen shared handler (it would write party-view-mode).
    const bubbleListener = vi.fn();
    window.addEventListener('keydown', bubbleListener);
    const { result } = renderDensity();
    act(() => useSettingsPanelStore.setState({ isOpen: true }));

    pressV();
    expect(result.current.density).toBe('compact');
    expect(bubbleListener).not.toHaveBeenCalled();

    act(() => useSettingsPanelStore.setState({ isOpen: false }));
    pressV();
    expect(result.current.density).toBe('expanded');
    window.removeEventListener('keydown', bubbleListener);
  });

  it('stops intercepting V once unmounted', () => {
    const bubbleListener = vi.fn();
    window.addEventListener('keydown', bubbleListener);
    const { unmount } = renderDensity();
    unmount();

    pressV();
    expect(bubbleListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', bubbleListener);
  });
});
