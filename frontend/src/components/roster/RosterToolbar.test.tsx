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
  hasSubstitutes: true,
  reorderMode: false,
  onReorderModeChange: vi.fn(),
  canManage: true,
  onAddPlayer: vi.fn(),
};

describe('RosterToolbar', () => {
  it('renders the grouping pill, subs toggle, reorder, and add-player controls', () => {
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

  it('opens the grouping pill menu and switches to Standard comp', async () => {
    const onGroupViewChange = vi.fn();
    render(
      <RosterToolbar {...baseProps} groupView onGroupViewChange={onGroupViewChange} />
    );
    // Radix's DropdownMenuTrigger opens on pointerdown (mouse) or Enter/Space
    // (keyboard) — not a plain `click` — so open it the keyboard-accessible
    // way, which `fireEvent` can drive without a jsdom PointerEvent polyfill.
    fireEvent.keyDown(screen.getByRole('button', { name: /light party/i }), {
      key: 'Enter',
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: /standard comp/i }));
    expect(onGroupViewChange).toHaveBeenCalledWith(false);
  });
});
