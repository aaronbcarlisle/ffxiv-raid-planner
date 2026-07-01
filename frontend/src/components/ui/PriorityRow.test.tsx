import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriorityRow } from './PriorityRow';

const entries = [
  { playerId: 'a', name: 'Caster One', role: 'caster', rank: 1 },
  { playerId: 'b', name: 'Melee One', role: 'melee', rank: 2 },
  { playerId: 'c', name: 'Ranged One', role: 'ranged', rank: 3 },
  { playerId: 'd', name: 'Tank One', role: 'tank', rank: 4 },
  { playerId: 'e', name: 'Healer One', role: 'healer', rank: 5 },
];

describe('PriorityRow', () => {
  it('renders up to maxVisible chips + overflow count', () => {
    render(<PriorityRow entries={entries} />);
    expect(screen.getByText('Caster One')).toBeInTheDocument();
    expect(screen.getByText('Ranged One')).toBeInTheDocument();
    expect(screen.queryByText('Tank One')).not.toBeInTheDocument();
    expect(screen.getByText('+2 eligible')).toBeInTheDocument();
  });

  it('marks the first chip as top priority', () => {
    render(<PriorityRow entries={entries} />);
    const list = screen.getByRole('list', { name: 'Priority queue' });
    const items = list.querySelectorAll('li');
    expect(items[0].textContent).toContain('#1');
    expect(items[0].getAttribute('data-top')).toBe('true');
  });

  it('renders the empty label when no one needs it', () => {
    render(<PriorityRow entries={[]} emptyLabel="no one needs this" />);
    expect(screen.getByText('no one needs this')).toBeInTheDocument();
  });
});
