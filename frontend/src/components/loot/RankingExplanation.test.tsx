import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RankingExplanation } from './RankingExplanation';

describe('RankingExplanation', () => {
  it('renders the reason line', () => {
    render(<RankingExplanation explanation={{ reasons: ['Head is BiS · 2 drops this tier'], warnings: [], wouldAdvanceBis: true }} />);
    expect(screen.getByText('Head is BiS · 2 drops this tier')).toBeInTheDocument();
  });

  it('renders warnings only when opted in', () => {
    const explanation = { reasons: ['r'], warnings: ['Already received Head in Week 2'], wouldAdvanceBis: false };
    const { rerender } = render(<RankingExplanation explanation={explanation} />);
    expect(screen.queryByText('Already received Head in Week 2')).not.toBeInTheDocument();
    rerender(<RankingExplanation explanation={explanation} showWarnings />);
    const w = screen.getByText('Already received Head in Week 2');
    expect(w.className).toContain('text-status-warning');
  });

  it('renders no icon markup when there are no warnings', () => {
    const { container } = render(
      <RankingExplanation explanation={{ reasons: ['r'], warnings: [], wouldAdvanceBis: true }} showWarnings />,
    );
    expect(container.querySelectorAll('svg').length).toBe(0);
  });
});
