/**
 * JobPicker — dismissal-ownership unit tests (feedback-polish Task 2).
 *
 * RosterCard now hosts JobPicker inside a Radix Popover (portal escape from
 * CardShell's `overflow-hidden`). JobPicker's OWN document-level
 * mousedown-outside (`:171-186`) and Escape (`:202-214`) listeners — plus the
 * search input's own Escape branch (`handleSearchKeyDown`) — would otherwise
 * race Radix's own dismissal (the Popover trigger sits OUTSIDE the portaled
 * content, so JobPicker's "outside click" fires on every trigger click,
 * closing then Radix's own toggle reopens it). `hostControlsDismissal` lets a
 * host suppress JobPicker's own auto-dismiss paths while leaving the
 * selection-commit close (`handleJobClick` → `onRequestClose`) untouched.
 *
 * These tests exercise JobPicker directly (not through RosterCard) so the
 * call counts on `onRequestClose` are unambiguous — RosterCard's own
 * `overlayOpen` effect bails out on a same-value state transition, which
 * would mask a redundant (but same-value) internal call.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { JobPicker } from './JobPicker';

describe('JobPicker — hostControlsDismissal (default false, byte-for-byte unchanged)', () => {
  it('an outside mousedown closes the picker via onRequestClose (existing behavior)', () => {
    const onRequestClose = vi.fn();
    render(
      <div>
        <JobPicker selectedJob="PLD" onJobSelect={vi.fn()} onRequestClose={onRequestClose} />
        <button>outside</button>
      </div>
    );
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('a document Escape closes the picker via onRequestClose (existing behavior)', () => {
    const onRequestClose = vi.fn();
    render(<JobPicker selectedJob="PLD" onJobSelect={vi.fn()} onRequestClose={onRequestClose} />);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('an Escape from inside the focused search input closes the picker via onRequestClose (existing behavior — the input keydown branch AND the bubbled document listener both fire, a pre-existing double-call that is harmless standalone but is exactly what hostControlsDismissal fixes when Radix-hosted)', () => {
    const onRequestClose = vi.fn();
    render(<JobPicker selectedJob="PLD" onJobSelect={vi.fn()} onRequestClose={onRequestClose} />);
    fireEvent.keyDown(screen.getByPlaceholderText('Search jobs...'), { key: 'Escape' });
    expect(onRequestClose).toHaveBeenCalledTimes(2);
  });
});

describe('JobPicker — hostControlsDismissal={true} (Radix-Popover-hosted)', () => {
  it('does NOT call onRequestClose on an outside mousedown (the host owns it)', () => {
    const onRequestClose = vi.fn();
    render(
      <div>
        <JobPicker
          selectedJob="PLD"
          onJobSelect={vi.fn()}
          onRequestClose={onRequestClose}
          hostControlsDismissal
        />
        <button>outside</button>
      </div>
    );
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it('does NOT call onRequestClose on a document Escape (the host owns it)', () => {
    const onRequestClose = vi.fn();
    render(
      <JobPicker
        selectedJob="PLD"
        onJobSelect={vi.fn()}
        onRequestClose={onRequestClose}
        hostControlsDismissal
      />
    );
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it('does NOT call onRequestClose on an Escape from inside the search input (the host owns it, no double-close race)', () => {
    const onRequestClose = vi.fn();
    render(
      <JobPicker
        selectedJob="PLD"
        onJobSelect={vi.fn()}
        onRequestClose={onRequestClose}
        hostControlsDismissal
      />
    );
    fireEvent.keyDown(screen.getByPlaceholderText('Search jobs...'), { key: 'Escape' });
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it('STILL calls onRequestClose after a selection commit (the close-on-select path is unaffected)', () => {
    const onRequestClose = vi.fn();
    const onJobSelect = vi.fn();
    render(
      <JobPicker
        selectedJob="PLD"
        onJobSelect={onJobSelect}
        onRequestClose={onRequestClose}
        hostControlsDismissal
      />
    );
    fireEvent.click(screen.getByText('WAR'));
    expect(onJobSelect).toHaveBeenCalledWith('WAR');
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('still focuses the search input on mount (unaffected by the dismissal flag)', () => {
    render(
      <JobPicker selectedJob="PLD" onJobSelect={vi.fn()} onRequestClose={vi.fn()} hostControlsDismissal />
    );
    expect(screen.getByPlaceholderText('Search jobs...')).toHaveFocus();
  });
});
