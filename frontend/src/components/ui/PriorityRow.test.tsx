import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { PriorityRow } from './PriorityRow';
import { TooltipProvider } from '../primitives';

const entries = [
  { playerId: 'a', name: 'Caster One', role: 'caster', rank: 1 },
  { playerId: 'b', name: 'Melee One', role: 'melee', rank: 2 },
  { playerId: 'c', name: 'Ranged One', role: 'ranged', rank: 3 },
  { playerId: 'd', name: 'Tank One', role: 'tank', rank: 4 },
  { playerId: 'e', name: 'Healer One', role: 'healer', rank: 5 },
];

beforeEach(() => {
  // jsdom has no matchMedia; the name span's Tooltip -> useDevice depends on
  // it. LogWeekGrid.test.tsx / WeekCountBar.test.tsx idiom — always resolve
  // "can hover" so the Tooltip-wrapped span renders normally (not the touch
  // passthrough), which T1-c's tooltip-content assertion needs.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(hover: hover) and (pointer: fine)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  // Radix Popper (the Tooltip's Arrow measurement) needs ResizeObserver,
  // which jsdom lacks — LogWeekGrid.test.tsx precedent.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

function renderRow(props: Partial<ComponentProps<typeof PriorityRow>> = {}) {
  return render(
    <TooltipProvider>
      <PriorityRow entries={entries} {...props} />
    </TooltipProvider>
  );
}

describe('PriorityRow', () => {
  it('renders up to maxVisible chips + overflow count', () => {
    renderRow();
    expect(screen.getByText('Caster One')).toBeInTheDocument();
    expect(screen.getByText('Ranged One')).toBeInTheDocument();
    expect(screen.queryByText('Tank One')).not.toBeInTheDocument();
    expect(screen.getByText('+2 eligible')).toBeInTheDocument();
  });

  it('marks the first chip as top priority', () => {
    renderRow();
    const list = screen.getByRole('list', { name: 'Priority queue' });
    const items = list.querySelectorAll('li');
    expect(items[0].textContent).toContain('#1');
    expect(items[0].getAttribute('data-top')).toBe('true');
  });

  it('renders the empty label when no one needs it', () => {
    renderRow({ entries: [], emptyLabel: 'no one needs this' });
    expect(screen.getByText('no one needs this')).toBeInTheDocument();
  });

  it('renders the default emptyLabel when the prop is omitted', () => {
    renderRow({ entries: [] });
    expect(screen.getByText('no one needs this')).toBeInTheDocument();
  });

  it('does not mark non-top chips with data-top', () => {
    renderRow();
    const items = screen.getByRole('list', { name: 'Priority queue' }).querySelectorAll('li');
    expect(items[1].hasAttribute('data-top')).toBe(false);
  });

  it('renders no "+N eligible" text when entries.length <= maxVisible', () => {
    renderRow({ entries: entries.slice(0, 3) });
    expect(screen.queryByText(/eligible/)).not.toBeInTheDocument();
  });

  it('avatar initials glyph carries leading-none (A12 centering)', () => {
    // A12: grid place-items-center centers the line box, not the glyph ink —
    // leading-none collapses the line box (same fix as AppRail/PlayerIdentity).
    renderRow();
    const initialsSpan = screen.getByText('CO'); // initials('Caster One')
    expect(initialsSpan.className).toContain('leading-none');
  });

  // Task 6: the "Queues" chip must render through the shared InitialsAvatar primitive
  // (not a hand-rolled span) — role="presentation" is InitialsAvatar's signature (the
  // centering fix), so its presence proves the primitive is actually mounted here.
  it('avatar chip renders through the shared InitialsAvatar primitive', () => {
    renderRow();
    const initialsSpan = screen.getByText('CO');
    expect(initialsSpan).toHaveAttribute('role', 'presentation');
    expect(initialsSpan).toHaveAttribute('aria-hidden', 'true');
    // carries the forwarded sub-floor ignore (10px) — unchanged from before extraction
    expect(initialsSpan.className).toContain('text-[10px]');
  });

  // T1-c: the li is flex-none, so without a max-width the truncate span never
  // actually shrinks below the ul's overflow-hidden clip — give it one, and
  // wrap it in the Tooltip primitive so the full name is still reachable.
  it('T1-c: the name span carries a max-width class and its full name is the tooltip content', async () => {
    renderRow();
    const nameSpan = screen.getByText('Caster One');
    expect(nameSpan.className).toContain('max-w-32');
    expect(nameSpan.className).toContain('truncate');
    fireEvent.focus(nameSpan);
    // Radix renders the open content twice (visible popup + visually-hidden
    // aria-describedby copy) — LogWeekGrid.test.tsx / WeekCountBar.test.tsx
    // precedent — so assert via findAllByText rather than a single query.
    expect((await screen.findAllByText('Caster One')).length).toBeGreaterThan(1);
  });
});
