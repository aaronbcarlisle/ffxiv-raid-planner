/**
 * PlayerCardHeader tests
 *
 * Regression coverage for inline name editing. The player card spreads
 * dnd-kit's keyboard sensor (onKeyDown) onto a wrapper around the name input;
 * that sensor starts a keyboard drag on Space, which used to blur the input
 * mid-edit. The name field must swallow every keystroke so none reach the
 * drag listeners.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerCardHeader } from './PlayerCardHeader';
import { TooltipProvider } from '../primitives/Tooltip';
import type { SnapshotPlayer } from '../../types';

beforeEach(() => {
  // jsdom has no matchMedia; emulate a desktop/hover environment so useDevice
  // (via Tooltip) reports canHover=true — the realistic case where the card's
  // drag listeners are live and this regression actually bites.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('hover: hover'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makePlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Old Name',
    job: 'DRG',
    role: 'melee',
    configured: true,
    sortOrder: 0,
    gear: [],
    isSubstitute: false,
    ...overrides,
  } as SnapshotPlayer;
}

function renderHeader(extraProps: Record<string, unknown> = {}) {
  const onNameChange = vi.fn();
  const parentKeyDown = vi.fn();
  const player = makePlayer();

  render(
    // The wrapper stands in for the card div that carries the drag listeners.
    <TooltipProvider>
      <div onKeyDown={parentKeyDown} data-testid="drag-wrapper">
        <PlayerCardHeader
          job={player.job}
          name={player.name}
          role={player.role}
          position={null}
          completedSlots={0}
          totalSlots={0}
          player={player}
          tierId="t1"
          userRole="owner"
          onJobChange={vi.fn()}
          onNameChange={onNameChange}
          onPositionChange={vi.fn()}
          {...extraProps}
        />
      </div>
    </TooltipProvider>
  );

  // Enter edit mode via the always-visible pencil button.
  fireEvent.click(screen.getByLabelText('Edit player name'));
  const input = screen.getByDisplayValue('Old Name') as HTMLInputElement;

  return { input, onNameChange, parentKeyDown };
}

describe('PlayerCardHeader inline name edit', () => {
  it('does not let Space reach the card drag listeners while editing', () => {
    const { input, parentKeyDown } = renderHeader();

    fireEvent.keyDown(input, { key: ' ', code: 'Space' });

    // Space must stay in the text field, never bubbling to the drag wrapper.
    expect(parentKeyDown).not.toHaveBeenCalled();
  });

  it('still saves on Enter without bubbling to drag listeners', () => {
    const { input, onNameChange, parentKeyDown } = renderHeader();

    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onNameChange).toHaveBeenCalledWith('New Name');
    expect(parentKeyDown).not.toHaveBeenCalled();
  });

  it('saves a name containing spaces end to end', () => {
    // The user-facing contract: a space-containing name must survive the edit.
    const { input, onNameChange } = renderHeader();

    fireEvent.change(input, { target: { value: 'Some Body' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onNameChange).toHaveBeenCalledWith('Some Body');
  });

  it('cancels on Escape without saving or bubbling', () => {
    const { input, onNameChange, parentKeyDown } = renderHeader();

    fireEvent.change(input, { target: { value: 'Discarded' } });
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

    expect(onNameChange).not.toHaveBeenCalled();
    expect(parentKeyDown).not.toHaveBeenCalled();
  });

  it('saves the trimmed name on blur', () => {
    // Clicking away (blur) is the other commit path and shares the trim guard.
    const { input, onNameChange } = renderHeader();

    fireEvent.change(input, { target: { value: '  Trimmed Name  ' } });
    fireEvent.blur(input);

    expect(onNameChange).toHaveBeenCalledWith('Trimmed Name');
  });
});
