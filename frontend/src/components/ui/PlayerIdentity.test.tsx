/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PlayerIdentity } from './PlayerIdentity';

describe('PlayerIdentity', () => {
  it('renders name and a non-color role label (a11y: role not by color alone)', () => {
    render(<PlayerIdentity name="Caster One" job="BLM" role="caster" position="R2" />);
    expect(screen.getByText('Caster One')).toBeInTheDocument();
    // job/position text present so role isn't conveyed by color alone
    expect(screen.getByText(/BLM/)).toBeInTheDocument();
    expect(screen.getByText(/R2/)).toBeInTheDocument();
  });

  it('renders without optional props (name only)', () => {
    render(<PlayerIdentity name="Tank One" />);
    expect(screen.getByText('Tank One')).toBeInTheDocument();
  });

  it('shows initials fallback when no avatarUrl', () => {
    render(<PlayerIdentity name="Healer Two" job="WHM" role="healer" />);
    // Initials derived from name ("HT") appear in the avatar fallback
    expect(screen.getByText('HT')).toBeInTheDocument();
  });

  it('renders job and position subtitle together', () => {
    render(<PlayerIdentity name="Melee One" job="DRG" position="M1" />);
    expect(screen.getByText(/DRG/)).toBeInTheDocument();
    expect(screen.getByText(/M1/)).toBeInTheDocument();
  });

  it('renders a custom subtitle when provided', () => {
    render(<PlayerIdentity name="Ranged One" subtitle={<span>Custom label</span>} />);
    expect(screen.getByText('Custom label')).toBeInTheDocument();
  });

  it('applies role border color via CSS var, not hardcoded hex', () => {
    const { container } = render(
      <PlayerIdentity name="Tank Two" role="tank" />,
    );
    const ring = container.querySelector('[data-testid="player-identity-ring"]') as HTMLElement;
    expect(ring.style.borderColor).toBe('var(--color-role-tank)');
    // a11y §5.4: role must not be conveyed by color alone — when no job/position/subtitle
    // is present the component must expose a textual role label for screen readers.
    expect(screen.getByText('Tank')).toBeInTheDocument();
  });

  it('exposes sr-only role text when role set without job, position, or subtitle', () => {
    // Regression: color-only role signal must be closed — screen reader must find role label.
    render(<PlayerIdentity name="Tank Two" role="tank" />);
    const srLabel = screen.getByText('Tank');
    expect(srLabel).toBeInTheDocument();
    expect(srLabel).toHaveClass('sr-only');
  });

  it('does NOT render a duplicate sr-only label when job or position already present', () => {
    // When job/position appear in the subtitle, no extra sr-only label should be added.
    render(<PlayerIdentity name="Tank Two" role="tank" job="WAR" />);
    // "WAR" appears in the subtitle; 'Tank' (exact) should NOT appear as a standalone label.
    expect(screen.queryByText('Tank')).not.toBeInTheDocument();
  });

  it('renders nothing for reserved variants', () => {
    // 'board-cell' is documented as reserved (F6c); the component must return null
    // so callers that accidentally pass it get a no-op rather than a crash.
    const { container } = render(
      <PlayerIdentity name="X" variant="board-cell" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders no border when role is absent', () => {
    const { container } = render(<PlayerIdentity name="Unknown" />);
    const ring = container.querySelector('[data-testid="player-identity-ring"]') as HTMLElement;
    // No inline borderColor when role is omitted
    expect(ring.style.borderColor).toBe('');
  });
});
