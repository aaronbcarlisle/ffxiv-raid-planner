import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreBreakdown, hasAdjustments } from './ScoreBreakdown';
import type { PriorityScoreBreakdown } from '../../utils/priority';

function bd(overrides: Partial<PriorityScoreBreakdown> = {}): PriorityScoreBreakdown {
  return {
    score: 0,
    rolePriority: 0,
    weightedNeed: 0,
    weightedNeedBonus: 0,
    lootAdjustmentBonus: 0,
    jobModifier: 0,
    playerModifier: 0,
    ...overrides,
  };
}

// Label + value render as separate text nodes (label text, then a nested
// <span> holding the value) — the classic RTL "text split across nodes"
// case. Pick the most specific element whose OWN full textContent matches,
// so we land on the per-line <span> rather than its value-only child or the
// outer container (whose text is every line concatenated).
function getLine(text: string): HTMLElement {
  return screen.getByText((_, element) => {
    if (!element) return false;
    const own = (element.textContent ?? '').replace(/\s+/g, ' ').trim() === text;
    const childAlsoMatches = Array.from(element.children).some(
      (c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim() === text,
    );
    return own && !childAlsoMatches;
  });
}

describe('ScoreBreakdown', () => {
  it('renders one line per nonzero component with its label, omitting zero components', () => {
    render(
      <ScoreBreakdown
        breakdown={bd({ rolePriority: 40, weightedNeed: 2, weightedNeedBonus: 20, playerModifier: 15 })}
        droughtBonus={6}
        balancePenalty={0}
      />,
    );
    expect(getLine('Role priority +40')).toBeInTheDocument();
    expect(getLine('Need +20')).toBeInTheDocument();
    expect(getLine('Player modifier +15')).toBeInTheDocument();
    expect(getLine('Drought bonus +6')).toBeInTheDocument();
    expect(screen.queryByText(/Job modifier/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Loot adjustment/)).not.toBeInTheDocument();
  });

  it('signs: a negative playerModifier renders with a minus, a positive balancePenalty subtracts', () => {
    render(
      <ScoreBreakdown breakdown={bd({ playerModifier: -10 })} balancePenalty={8} />,
    );
    expect(getLine('Player modifier −10')).toBeInTheDocument();
    expect(getLine('Balance penalty −8')).toBeInTheDocument();
  });

  it('renders a fractional drought bonus at one decimal with no float noise', () => {
    render(<ScoreBreakdown breakdown={bd()} droughtBonus={4.5} />);
    expect(getLine('Drought bonus +4.5')).toBeInTheDocument();
  });

  it('shows the "Priority score" lead line only when the score prop is passed', () => {
    const { rerender } = render(<ScoreBreakdown breakdown={bd({ rolePriority: 40 })} score={75} />);
    expect(screen.getByText('Priority score 75')).toBeInTheDocument();

    rerender(<ScoreBreakdown breakdown={bd({ rolePriority: 40 })} />);
    expect(screen.queryByText(/Priority score/)).not.toBeInTheDocument();
  });

  it('renders "Base score only" (never empty) when every component is zero', () => {
    render(<ScoreBreakdown breakdown={bd()} />);
    expect(screen.getByText('Base score only')).toBeInTheDocument();
  });
});

describe('hasAdjustments', () => {
  it('is true when lootAdjustmentBonus is nonzero', () => {
    expect(hasAdjustments(bd({ lootAdjustmentBonus: 5 }))).toBe(true);
  });

  it('is true when playerModifier is nonzero', () => {
    expect(hasAdjustments(bd({ playerModifier: -5 }))).toBe(true);
  });

  it('is false when both are zero — drought bonus alone does not count (it has its own surface signal)', () => {
    expect(hasAdjustments(bd())).toBe(false);
  });
});
