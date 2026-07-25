/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TwoRegionDashboard } from './TwoRegionDashboard';

describe('TwoRegionDashboard', () => {
  it('renders both regions', () => {
    render(<TwoRegionDashboard main={<div>MAIN</div>} side={<div>SIDE</div>} />);
    expect(screen.getByText('MAIN')).toBeInTheDocument();
    expect(screen.getByText('SIDE')).toBeInTheDocument();
  });

  it('applies a forwarded className without trailing space', () => {
    const { container } = render(
      <TwoRegionDashboard main={<div>M</div>} side={<div>S</div>} className="mt-4" />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('mt-4');
    expect(wrapper.className).not.toMatch(/\s$/);
  });

  it('renders without a className when none is supplied', () => {
    const { container } = render(<TwoRegionDashboard main={<div>M</div>} side={<div>S</div>} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).not.toMatch(/\s$/);
  });
});
