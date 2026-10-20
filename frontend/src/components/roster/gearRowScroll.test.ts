import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrollToGearRow, scrollToPlayerRow } from './gearRowScroll';

function mountEl(id: string) {
  const el = document.createElement('div');
  el.id = id;
  el.scrollIntoView = vi.fn();
  document.body.appendChild(el);
  return el;
}

describe('scrollToGearRow', () => {
  beforeEach(() => { vi.useFakeTimers(); document.body.innerHTML = ''; });
  afterEach(() => { vi.useRealTimers(); });

  it('scrolls the gear row as soon as it appears, then re-centers', () => {
    const row = mountEl('gear-row-p1-head');
    scrollToGearRow('p1', 'head');
    expect(row.scrollIntoView).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(220);
    expect(row.scrollIntoView).toHaveBeenCalledTimes(2);
    expect(row.scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('polls until the row mounts (the tab-switch animation)', () => {
    scrollToGearRow('p1', 'head');
    vi.advanceTimersByTime(120);
    const row = mountEl('gear-row-p1-head');
    vi.advanceTimersByTime(40);
    expect(row.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  // R-D12-F: compact density never mounts the table — fall back to the card.
  it('falls back to the player card when the row never mounts', () => {
    const card = mountEl('player-card-p1');
    scrollToGearRow('p1', 'head');
    expect(card.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('gives up silently when neither the row nor the card exists', () => {
    expect(() => {
      scrollToGearRow('p1', 'head');
      vi.advanceTimersByTime(5000);
    }).not.toThrow();
  });

  it('cancel() clears the pending poll so a fast navigate-away leaves nothing queued', () => {
    const cancel = scrollToGearRow('p1', 'head');
    cancel();
    const row = mountEl('gear-row-p1-head');
    vi.advanceTimersByTime(5000);
    expect(row.scrollIntoView).not.toHaveBeenCalled();
  });

  // The precedence above, as an executable claim: card at tick 1 beats a row
  // that mounts later. If this ever flips, the comment is the thing to fix.
  it('scrolls the card, not a later-mounting row, when only the card exists at tick 1', () => {
    const card = mountEl('player-card-p1');
    scrollToGearRow('p1', 'head');
    vi.advanceTimersByTime(39);
    const row = mountEl('gear-row-p1-head');
    vi.advanceTimersByTime(5000);
    expect(card.scrollIntoView).toHaveBeenCalled();
    expect(row.scrollIntoView).not.toHaveBeenCalled();
  });

  // The attempt budget: 24 lookups at t=0 plus 23 × 40ms, so the last is at
  // t=920ms. After that, no timers should be pending.
  it('respects the attempt budget and stops polling when exhausted', () => {
    scrollToGearRow('p1', 'head');
    vi.advanceTimersByTime(920);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancel() suppresses the re-center when called after the row is found', () => {
    const row = mountEl('gear-row-p1-head');
    const cancel = scrollToGearRow('p1', 'head');
    cancel();
    vi.advanceTimersByTime(5000);
    expect(row.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

// S2a-3b·H3b: the Progress jump's landing on the Board. GroupViewContent's own scroll fires 100 ms
// after the URL changes and a jump from another tab has not mounted the Roster by then (measured
// live, ~300 ms), so this poll is the scroll that lands.
describe('scrollToPlayerRow', () => {
  beforeEach(() => { vi.useFakeTimers(); document.body.innerHTML = ''; });
  afterEach(() => { vi.useRealTimers(); });

  it('scrolls the player anchor as soon as it exists, then re-centers', () => {
    const row = mountEl('player-card-p1');
    scrollToPlayerRow('p1');
    expect(row.scrollIntoView).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(220);
    expect(row.scrollIntoView).toHaveBeenCalledTimes(2);
    expect(row.scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it("polls past GroupViewContent's 100 ms scroll until the row mounts", () => {
    scrollToPlayerRow('p1');
    vi.advanceTimersByTime(300);
    const row = mountEl('player-card-p1');
    vi.advanceTimersByTime(40);
    expect(row.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("never scrolls another player's anchor, and cancel() clears the poll", () => {
    const other = mountEl('player-card-p2');
    const cancel = scrollToPlayerRow('p1');
    cancel();
    mountEl('player-card-p1');
    vi.advanceTimersByTime(5000);
    expect(other.scrollIntoView).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

// S2a-3b·H4b: a keyboard jump (Enter on Open on board) unmounts the button that held focus, so focus
// is on <body> when the Board row mounts; the landing hands it to the row.
describe('scrollToPlayerRow focus', () => {
  beforeEach(() => { vi.useFakeTimers(); document.body.innerHTML = ''; });
  afterEach(() => { vi.useRealTimers(); });

  function mountRow(id: string) {
    const row = document.createElement('tr');
    row.id = id;
    row.tabIndex = -1;
    row.scrollIntoView = vi.fn();
    document.body.appendChild(row);
    return row;
  }

  it('focuses the landed row when nothing holds focus, once it mounts', () => {
    scrollToPlayerRow('p1');
    vi.advanceTimersByTime(120);
    const row = mountRow('player-card-p1');
    expect(document.activeElement).toBe(document.body);
    vi.advanceTimersByTime(40);
    expect(row).toHaveFocus();
  });

  it("never takes a focus the user holds elsewhere, and never focuses another player's row", () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const row = mountRow('player-card-p1');
    const other = mountRow('player-card-p2');
    scrollToPlayerRow('p1');
    expect(input).toHaveFocus();
    expect(row.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveFocus();
  });

  it('scrollToGearRow never moves focus', () => {
    const row = mountRow('gear-row-p1-head');
    scrollToGearRow('p1', 'head');
    expect(row.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(row).not.toHaveFocus();
  });
});
