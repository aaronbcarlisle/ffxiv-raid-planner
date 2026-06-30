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
  });

  it('renders no border when role is absent', () => {
    const { container } = render(<PlayerIdentity name="Unknown" />);
    const ring = container.querySelector('[data-testid="player-identity-ring"]') as HTMLElement;
    // No inline borderColor when role is omitted
    expect(ring.style.borderColor).toBe('');
  });
});
