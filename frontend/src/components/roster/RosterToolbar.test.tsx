// `@testing-library/user-event` is not a dependency of this project (not in
// package.json / pnpm-lock.yaml, and the task scope forbids touching other
// files to add it) — every existing test in this codebase drives clicks via
// `fireEvent` instead (see e.g. `components/layout/AppRail.test.tsx`), so we
// follow that established convention here.
import { render as rtlRender, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RosterToolbar } from './RosterToolbar';
import { TooltipProvider } from '../primitives';

// The toolbar's shortcut hints use the Tooltip primitive, which requires the
// provider App.tsx mounts at the root (same wrapper UserMenu/NotificationCenter
// tests use).
// jsdom also lacks ResizeObserver, which Radix's Tooltip.Content needs once
// it actually opens (useSize) — the reorder tooltip tests below are the
// first in this file to open one for real rather than just checking
// aria-pressed.
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom has no matchMedia; `useDevice` (via the Tooltip primitive) calls it.
// Stubbed locally rather than in the shared setup so no other suite's device
// detection changes underneath it. `hover: hover` reports true so the
// Tooltip primitive's `canHover` gate doesn't short-circuit it to
// `<>{children}</>` — same reorder-tooltip need as above.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('hover: hover'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const render = (ui: React.ReactElement) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

const baseProps = {
  groupView: true,
  onGroupViewChange: vi.fn(),
  subsHidden: false,
  onSubsHiddenChange: vi.fn(),
  subsView: true,
  onSubsViewChange: vi.fn(),
  hasSubstitutes: true,
  reorderMode: false,
  onReorderModeChange: vi.fn(),
  canManage: true,
  onAddPlayer: vi.fn(),
  rosterView: 'cards' as const,
  onRosterViewChange: vi.fn(),
  density: 'compact' as const,
  onDensityChange: vi.fn(),
  sortPreset: 'standard' as const,
  onSortPresetChange: vi.fn(),
  onExpandAllToggle: vi.fn(),
};

describe('RosterToolbar', () => {
  it('renders the grouping toggle, subs toggles, reorder, and add-player controls', () => {
    render(<RosterToolbar {...baseProps} />);
    expect(screen.getByRole('button', { name: /light party/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /show subs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reorder/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add player/i })).toBeInTheDocument();
  });

  it('fires reorder + add-player callbacks', () => {
    const onReorderModeChange = vi.fn();
    const onAddPlayer = vi.fn();
    render(
      <RosterToolbar
        {...baseProps}
        onReorderModeChange={onReorderModeChange}
        onAddPlayer={onAddPlayer}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /reorder/i }));
    expect(onReorderModeChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: /add player/i }));
    expect(onAddPlayer).toHaveBeenCalled();
  });

  it('marks "Reorder" as pressed via aria-pressed when reorder mode is active', () => {
    render(<RosterToolbar {...baseProps} reorderMode />);
    expect(screen.getByRole('button', { name: /reorder/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('hides the "Show subs" toggle when there are no substitutes', () => {
    render(<RosterToolbar {...baseProps} hasSubstitutes={false} />);
    expect(screen.queryByRole('switch', { name: /show subs/i })).not.toBeInTheDocument();
  });

  it('toggles subs visibility via onSubsHiddenChange', () => {
    const onSubsHiddenChange = vi.fn();
    render(
      <RosterToolbar
        {...baseProps}
        subsHidden={false}
        onSubsHiddenChange={onSubsHiddenChange}
      />
    );
    fireEvent.click(screen.getByRole('switch', { name: /show subs/i }));
    expect(onSubsHiddenChange).toHaveBeenCalledWith(true);
  });

  it('disables "Add player" and "Reorder" when the user cannot manage the roster', () => {
    render(<RosterToolbar {...baseProps} canManage={false} />);
    expect(screen.getByRole('button', { name: /add player/i })).toBeDisabled();
    // Reorder is gated too — a non-manager must not enter a mode whose drag
    // affordances are inert underneath (DnD is disabled when !canManage).
    expect(screen.getByRole('button', { name: /reorder/i })).toBeDisabled();
  });

  // ── C6: the sort-vs-grouping split (C1-checkpoint correction (a)) ──
  // The single "Standard comp ⇄ Light Party" dropdown conflated two axes. It is
  // now a plain grouping toggle, and the dropdown slot belongs to sort.

  it('toggles grouping directly, with its state announced', () => {
    const onGroupViewChange = vi.fn();
    render(<RosterToolbar {...baseProps} groupView onGroupViewChange={onGroupViewChange} />);

    const toggle = screen.getByRole('button', { name: /light party/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(onGroupViewChange).toHaveBeenCalledWith(false);
  });

  it('shows grouping as off when the roster is a flat grid', () => {
    render(<RosterToolbar {...baseProps} groupView={false} />);
    expect(screen.getByRole('button', { name: /light party/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('renders the sort-preset selector, labelled, in Cards view only (D-06)', () => {
    const { rerender } = render(<RosterToolbar {...baseProps} />);
    const selector = screen.getByRole('combobox', { name: /sort/i });
    expect(selector).toBeInTheDocument();
    expect(selector).toHaveTextContent(/standard/i);

    // Cards-only, matching every other view control here. (The Board's rows do
    // still follow the preset — it receives the same sorted players — so this
    // is a placement call, not a claim that the Board ignores sorting;
    // recorded as a C6 delta on D-06.)
    rerender(<RosterToolbar {...baseProps} rosterView="board" />);
    expect(screen.queryByRole('combobox', { name: /sort/i })).not.toBeInTheDocument();
  });

  // ── C6: Separate Subs (D-07) ──

  it('renders the Separate Subs toggle and reports its state', () => {
    const onSubsViewChange = vi.fn();
    render(<RosterToolbar {...baseProps} subsView onSubsViewChange={onSubsViewChange} />);

    const toggle = screen.getByRole('switch', { name: /separate subs/i });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(onSubsViewChange).toHaveBeenCalledWith(false);
  });

  it('disables Separate Subs when the subs SECTION is hidden (v2 rule)', () => {
    // Separating is moot while the section it would create is hidden.
    render(<RosterToolbar {...baseProps} subsHidden subsView />);
    expect(screen.getByRole('switch', { name: /separate subs/i })).toBeDisabled();
  });

  it('keeps Separate Subs usable when subs are MERGED, even with Show Subs off', () => {
    // Merged subs render inside the main grid regardless of `subsHidden`, so
    // with the control disabled here the user would be stuck looking at
    // substitutes they had just switched off, with no way back. The gate must
    // only cover the case where separating genuinely does nothing.
    render(<RosterToolbar {...baseProps} subsHidden subsView={false} />);
    expect(screen.getByRole('switch', { name: /separate subs/i })).toBeEnabled();
  });

  it('hides both subs toggles when the roster has no substitutes', () => {
    render(<RosterToolbar {...baseProps} hasSubstitutes={false} />);
    expect(screen.queryByRole('switch', { name: /show subs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /separate subs/i })).not.toBeInTheDocument();
  });

  it('renders the Cards/Board segmented toggle', () => {
    render(<RosterToolbar {...baseProps} />);
    expect(screen.getByRole('group', { name: /view/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cards' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Board' })).toBeInTheDocument();
  });

  it('switches view via the toggle', () => {
    const onRosterViewChange = vi.fn();
    render(<RosterToolbar {...baseProps} onRosterViewChange={onRosterViewChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(onRosterViewChange).toHaveBeenCalledWith('board');
  });

  it('hides Reorder + grouping + Show subs in board mode', () => {
    render(<RosterToolbar {...baseProps} rosterView="board" />);
    expect(screen.queryByRole('button', { name: /reorder/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Show subs')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add player/i })).toBeInTheDocument();
  });

  it('renders the density toggle in Cards view only (the Board has no density axis)', () => {
    const { rerender } = render(<RosterToolbar {...baseProps} />);
    expect(screen.getByRole('group', { name: /card density/i })).toBeInTheDocument();
    rerender(<RosterToolbar {...baseProps} rosterView="board" />);
    expect(screen.queryByRole('group', { name: /card density/i })).not.toBeInTheDocument();
  });

  it('changes density via the toggle', () => {
    const onDensityChange = vi.fn();
    render(<RosterToolbar {...baseProps} density="expanded" onDensityChange={onDensityChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }));
    expect(onDensityChange).toHaveBeenCalledWith('compact');
  });

  it('re-clicking the active Expanded control toggles the sections, not the density (C6)', () => {
    // The C1 checkpoint moved legacy's re-click-Expanded behaviour here: it
    // operates on the light-party SECTIONS, so cards keep their density while
    // a group is folded.
    const onDensityChange = vi.fn();
    const onExpandAllToggle = vi.fn();
    render(
      <RosterToolbar
        {...baseProps}
        density="expanded"
        onDensityChange={onDensityChange}
        onExpandAllToggle={onExpandAllToggle}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expanded' }));
    expect(onExpandAllToggle).toHaveBeenCalledTimes(1);
    expect(onDensityChange).not.toHaveBeenCalled();
  });

  it('re-clicking the active Compact control does nothing (legacy binds this to Expanded)', () => {
    const onExpandAllToggle = vi.fn();
    render(
      <RosterToolbar {...baseProps} density="compact" onExpandAllToggle={onExpandAllToggle} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }));
    expect(onExpandAllToggle).not.toHaveBeenCalled();
  });

  // ── Task 1: reorder teaching affordances — the transient enter→drag→exit
  // flow shipped with zero on-surface hints. These three cover the tooltip,
  // the disabled-tooltip precedent (span wrapper), and the pressed visual.

  it('teaches the Reorder control with a plain tooltip (no shortcut — none exists)', async () => {
    render(<RosterToolbar {...baseProps} />);
    const button = screen.getByRole('button', { name: /reorder/i });
    fireEvent.focus(button);
    expect(
      await screen.findByText('Drag cards to reorder or swap players. Click again to finish.')
    ).toBeInTheDocument();
    // The BUTTON is the Radix trigger when enabled — aria-describedby must sit
    // on the element keyboard users focus, not a wrapping span (PR #242
    // review). Reverting to an unconditional span wrapper fails this.
    expect(button).toHaveAttribute('aria-describedby');
  });

  it('still teaches Reorder via the tooltip when disabled (no manage permission)', async () => {
    render(<RosterToolbar {...baseProps} canManage={false} />);
    const button = screen.getByRole('button', { name: /reorder/i });
    expect(button).toBeDisabled();
    // A disabled button can't receive focus/hover itself — the wrapping span
    // (RosterToolbar.tsx:189-199 precedent) is the actual Radix trigger.
    const wrapper = button.closest('span.inline-flex') as HTMLElement;
    expect(wrapper).toBeInTheDocument();
    fireEvent.focus(wrapper);
    expect(
      await screen.findByText('Drag cards to reorder or swap players. Click again to finish.')
    ).toBeInTheDocument();
  });

  it('gives the Reorder button a visibly "on" treatment while reorder mode is active', () => {
    // Two separate `render()` calls, not `rerender` — the custom wrapper
    // above re-wraps in TooltipProvider on every `render()`, but RTL's
    // `rerender` swaps the tree in place and drops that wrapping, which
    // crashes the toolbar's other always-on tooltips (grouping/subs).
    //
    // Assert the VARIANT swap, not a className addition: a plain className
    // string can't reliably beat `ghost`'s own `bg-transparent` in the
    // cascade (both are equal-specificity utility classes; Tailwind's
    // generated stylesheet order — not JSX/DOM order — decides the winner),
    // so a `toHaveClass('bg-accent/20')`-only check can stay green with zero
    // visible change on screen. `border-accent/30` only exists on the
    // `accent-subtle` variant (Button.tsx) — its presence/absence is a real
    // rendered difference, and `bg-transparent` flipping off proves `ghost`
    // itself was actually swapped out, not just papered over.
    render(<RosterToolbar {...baseProps} reorderMode={false} />);
    const offButton = screen.getByRole('button', { name: /reorder/i });
    expect(offButton).toHaveClass('bg-transparent');
    expect(offButton).not.toHaveClass('border-accent/30');

    cleanup();
    render(<RosterToolbar {...baseProps} reorderMode />);
    const onButton = screen.getByRole('button', { name: /reorder/i });
    expect(onButton).toHaveClass('border-accent/30', 'bg-accent/10');
    expect(onButton).not.toHaveClass('bg-transparent');
  });
});
