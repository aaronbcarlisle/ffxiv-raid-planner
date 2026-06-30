/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProgressBar, ProgressBarLegend } from './ProgressBar';

describe('ProgressBar', () => {
  it('clamps width to a percentage of value', () => {
    render(<ProgressBar value={0.56} ariaLabel="BiS complete" />);
    const bar = screen.getByRole('progressbar', { name: 'BiS complete' });
    expect(bar).toHaveAttribute('aria-valuenow', '56');
  });

  it('rounds aria-valuenow to integer for 0.333', () => {
    render(<ProgressBar value={0.333} ariaLabel="one third" />);
    const bar = screen.getByRole('progressbar', { name: 'one third' });
    expect(bar).toHaveAttribute('aria-valuenow', '33');
  });

  it('rounds aria-valuenow to integer for 0.999', () => {
    render(<ProgressBar value={0.999} ariaLabel="almost done" />);
    const bar = screen.getByRole('progressbar', { name: 'almost done' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('sets aria-valuemin=0 and aria-valuemax=100 when accessible', () => {
    render(<ProgressBar value={0.5} ariaLabel="half" />);
    const bar = screen.getByRole('progressbar', { name: 'half' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('renders without a11y role when no ariaLabel (decorative)', () => {
    const { container } = render(<ProgressBar value={1} color="success" />);
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('maps color="membership-linked" to var(--color-membership-linked)', () => {
    const { container } = render(<ProgressBar value={0.5} color="membership-linked" />);
    const fill = container.querySelector('[data-testid="progress-fill"]') as HTMLElement;
    expect(fill.style.background).toBe('var(--color-membership-linked)');
  });

  it('maps color="role-tank" to var(--color-role-tank)', () => {
    const { container } = render(<ProgressBar value={0.5} color="role-tank" />);
    const fill = container.querySelector('[data-testid="progress-fill"]') as HTMLElement;
    expect(fill.style.background).toBe('var(--color-role-tank)');
  });

  it('maps color="gear-raid" to var(--color-gear-raid)', () => {
    const { container } = render(<ProgressBar value={0.5} color="gear-raid" />);
    const fill = container.querySelector('[data-testid="progress-fill"]') as HTMLElement;
    expect(fill.style.background).toBe('var(--color-gear-raid)');
  });

  it('maps default color (accent) to var(--color-accent)', () => {
    const { container } = render(<ProgressBar value={0.5} />);
    const fill = container.querySelector('[data-testid="progress-fill"]') as HTMLElement;
    expect(fill.style.background).toBe('var(--color-accent)');
  });

  it('maps color="success" to var(--color-status-success)', () => {
    const { container } = render(<ProgressBar value={0.5} color="success" />);
    const fill = container.querySelector('[data-testid="progress-fill"]') as HTMLElement;
    expect(fill.style.background).toBe('var(--color-status-success)');
  });

  it('clamps value above 1 to 100%', () => {
    render(<ProgressBar value={2} ariaLabel="over max" />);
    const bar = screen.getByRole('progressbar', { name: 'over max' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('clamps value below 0 to 0%', () => {
    render(<ProgressBar value={-0.5} ariaLabel="under min" />);
    const bar = screen.getByRole('progressbar', { name: 'under min' });
    expect(bar).toHaveAttribute('aria-valuenow', '0');
  });

  it('applies extra className to the track', () => {
    const { container } = render(<ProgressBar value={0.5} className="mt-2" />);
    expect(container.firstChild).toHaveClass('mt-2');
  });
});

describe('ProgressBarLegend', () => {
  it('renders the default gear-source swatches', () => {
    render(<ProgressBarLegend />);
    expect(screen.getByText(/raid/i)).toBeInTheDocument();
    expect(screen.getByText(/augmented/i)).toBeInTheDocument();
  });

  it('renders tome (aug) and needed in default swatches', () => {
    render(<ProgressBarLegend />);
    expect(screen.getByText(/tome \(aug\)/i)).toBeInTheDocument();
    expect(screen.getByText(/needed/i)).toBeInTheDocument();
  });

  it('renders custom items when provided', () => {
    const items = [
      { label: 'Alpha', token: 'var(--color-role-tank)' },
      { label: 'Beta', token: 'var(--color-role-healer)' },
    ];
    render(<ProgressBarLegend items={items} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });
});
