import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrollToGearRow } from './gearRowScroll';

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
});
