import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRosterViewShortcuts } from './useRosterViewShortcuts';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';

// C6 / D-07 + §2.1. `useGroupViewState` is per-instance, so the frozen shared
// `useGroupViewKeyboardShortcuts` binds `S`/`G` against the GroupViewContent
// instance — which v2's Roster never reads. Under v2 those handlers fire
// INVISIBLY: `G` even writes legacy's `group-view-groups-{id}` localStorage and
// the `groups` URL param. v2 owns both keys at capture phase, exactly as C1
// did for `V`.

function press(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
}

const baseOptions = {
  shortcutsDisabled: false,
  active: true,
  hasSubstitutes: true,
  subsSeparable: true,
};

describe('useRosterViewShortcuts', () => {
  beforeEach(() => {
    useSettingsPanelStore.setState({ isOpen: false });
  });

  it('toggles grouping on G and separate-subs on S', () => {
    const onToggleGrouping = vi.fn();
    const onToggleSubsView = vi.fn();
    renderHook(() =>
      useRosterViewShortcuts({ ...baseOptions, onToggleGrouping, onToggleSubsView })
    );

    press('g');
    press('s');

    expect(onToggleGrouping).toHaveBeenCalledTimes(1);
    expect(onToggleSubsView).toHaveBeenCalledTimes(1);
  });

  it('ignores modified chords so browser shortcuts still work', () => {
    const onToggleGrouping = vi.fn();
    renderHook(() =>
      useRosterViewShortcuts({ ...baseOptions, onToggleGrouping, onToggleSubsView: vi.fn() })
    );

    press('g', { ctrlKey: true });
    press('g', { metaKey: true });
    press('g', { altKey: true });

    expect(onToggleGrouping).not.toHaveBeenCalled();
  });

  it('leaves the sort dropdown its own letter keys (PR #199 review)', () => {
    // The toolbar's sort control is a Radix Select: a `role="combobox"` BUTTON
    // whose open list is a `role="listbox"`. Neither is an <input>, so the
    // plain tag check let `S` through — killing Radix's typeahead ("S" →
    // "Standard") at capture AND flipping Separate Subs behind the open menu.
    const onToggleSubsView = vi.fn();
    renderHook(() =>
      useRosterViewShortcuts({ ...baseOptions, onToggleGrouping: vi.fn(), onToggleSubsView })
    );

    const combobox = document.createElement('button');
    combobox.setAttribute('role', 'combobox');
    document.body.appendChild(combobox);
    const fromTrigger = new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true });
    combobox.dispatchEvent(fromTrigger);

    expect(onToggleSubsView).not.toHaveBeenCalled();
    // Still SWALLOWED, though. Merely declining would hand the key to the
    // frozen handler, whose own guard doesn't recognise a combobox — verified
    // live: the toolbar stayed put but the URL gained `?subs=false`, which a
    // later v2 remount would read back as "merge the substitutes".
    expect(fromTrigger.defaultPrevented).toBe(true);

    // Same for an option inside the open listbox.
    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');
    const option = document.createElement('div');
    option.setAttribute('role', 'option');
    listbox.appendChild(option);
    document.body.appendChild(listbox);
    option.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true }));
    expect(onToggleSubsView).not.toHaveBeenCalled();

    combobox.remove();
    listbox.remove();
  });

  it('does nothing while typing in a field', () => {
    const onToggleGrouping = vi.fn();
    renderHook(() =>
      useRosterViewShortcuts({ ...baseOptions, onToggleGrouping, onToggleSubsView: vi.fn() })
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
    expect(onToggleGrouping).not.toHaveBeenCalled();
    input.remove();
  });

  it('swallows the keys but acts on neither while a card modal is open', () => {
    const onToggleGrouping = vi.fn();
    const onToggleSubsView = vi.fn();
    renderHook(() =>
      useRosterViewShortcuts({
        ...baseOptions,
        shortcutsDisabled: true,
        onToggleGrouping,
        onToggleSubsView,
      })
    );

    const gEvent = new KeyboardEvent('keydown', { key: 'g', bubbles: true, cancelable: true });
    window.dispatchEvent(gEvent);

    expect(onToggleGrouping).not.toHaveBeenCalled();
    expect(onToggleSubsView).not.toHaveBeenCalled();
    // Swallowed: the frozen shared handler must not fire its invisible branch
    // and write legacy's stored grouping behind the modal.
    expect(gEvent.defaultPrevented).toBe(true);
  });

  it('stays inert on the Board, which has neither axis', () => {
    const onToggleGrouping = vi.fn();
    renderHook(() =>
      useRosterViewShortcuts({
        ...baseOptions,
        active: false,
        onToggleGrouping,
        onToggleSubsView: vi.fn(),
      })
    );
    press('g');
    expect(onToggleGrouping).not.toHaveBeenCalled();
  });

  it('does not act while the settings panel covers the roster', () => {
    const onToggleGrouping = vi.fn();
    renderHook(() =>
      useRosterViewShortcuts({ ...baseOptions, onToggleGrouping, onToggleSubsView: vi.fn() })
    );

    useSettingsPanelStore.setState({ isOpen: true });
    press('g');
    expect(onToggleGrouping).not.toHaveBeenCalled();
  });

  it('gates S on there being substitutes at all (legacy parity)', () => {
    const onToggleSubsView = vi.fn();
    renderHook(() =>
      useRosterViewShortcuts({
        ...baseOptions,
        hasSubstitutes: false,
        onToggleGrouping: vi.fn(),
        onToggleSubsView,
      })
    );
    press('s');
    expect(onToggleSubsView).not.toHaveBeenCalled();
  });

  it('gates S on the subs section being shown — the toolbar toggle is disabled there too', () => {
    const onToggleSubsView = vi.fn();
    const onToggleGrouping = vi.fn();
    renderHook(() =>
      useRosterViewShortcuts({
        ...baseOptions,
        subsSeparable: false,
        onToggleGrouping,
        onToggleSubsView,
      })
    );

    press('s');
    expect(onToggleSubsView).not.toHaveBeenCalled();
    // G is unaffected by the subs gate.
    press('g');
    expect(onToggleGrouping).toHaveBeenCalledTimes(1);
  });

  it('unbinds on unmount', () => {
    const onToggleGrouping = vi.fn();
    const { unmount } = renderHook(() =>
      useRosterViewShortcuts({ ...baseOptions, onToggleGrouping, onToggleSubsView: vi.fn() })
    );
    unmount();
    press('g');
    expect(onToggleGrouping).not.toHaveBeenCalled();
  });
});
