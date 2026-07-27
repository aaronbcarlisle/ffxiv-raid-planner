// `@testing-library/user-event` is not a dependency of this project (not in
// package.json / pnpm-lock.yaml, and the task scope forbids touching other
// files to add it) — every existing test in this codebase drives clicks via
// `fireEvent` instead (see e.g. `components/layout/AppRail.test.tsx`), so we
// follow that established convention here.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RosterToolbar } from './RosterToolbar';

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

    // The Board has its own fixed ordering — no sort axis.
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

  it('disables Separate Subs until Show Subs is on (v2 rule — fixes the v1 defect)', () => {
    // v1 lets both toggle independently, so "separate" silently applies to a
    // section that is hidden. In v2 the dependent control is inert until its
    // parent is on.
    render(<RosterToolbar {...baseProps} subsHidden />);
    expect(screen.getByRole('switch', { name: /separate subs/i })).toBeDisabled();
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
});
