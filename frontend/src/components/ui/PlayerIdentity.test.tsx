/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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

  it('inline avatar fallback initials carry leading-none (A12 centering)', () => {
    // A12: flex centers the line box, not the glyph ink — leading-none collapses
    // the line box so initials sit optically centered in the 32px chip.
    render(<PlayerIdentity name="Healer Two" job="WHM" role="healer" />);
    expect(screen.getByText('HT').className).toContain('leading-none');
  });

  // Task 6: the fallback avatar must render through the shared InitialsAvatar
  // primitive (not a hand-rolled span) — role="presentation" is InitialsAvatar's
  // signature (the centering fix), so its presence proves the primitive is
  // actually mounted here.
  it('inline avatar fallback renders through the shared InitialsAvatar primitive', () => {
    render(<PlayerIdentity name="Healer Two" job="WHM" />);
    const chip = screen.getByText('HT');
    expect(chip).toHaveAttribute('role', 'presentation');
    expect(chip).toHaveAttribute('aria-hidden', 'true');
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

  it('renders no border when role is absent', () => {
    const { container } = render(<PlayerIdentity name="Unknown" />);
    const ring = container.querySelector('[data-testid="player-identity-ring"]') as HTMLElement;
    // No inline borderColor when role is omitted
    expect(ring.style.borderColor).toBe('');
  });
});

describe('PlayerIdentity board-cell variant', () => {
  it('renders the name and caller subtitle (no null return)', () => {
    render(<PlayerIdentity variant="board-cell" name="Tank One" job="PLD" role="tank" subtitle="MT · 740" />);
    expect(screen.getByText('Tank One')).toBeInTheDocument();
    expect(screen.getByText('MT · 740')).toBeInTheDocument();
  });

  it('emits an sr-only role label when no textual role signal is present', () => {
    const { container } = render(<PlayerIdentity variant="board-cell" name="Solo" role="healer" />);
    expect(container.querySelector('.sr-only')?.textContent).toBe('Healer');
  });

  it('still renders the inline variant', () => {
    render(<PlayerIdentity variant="inline" name="Inline Guy" job="WHM" role="healer" />);
    expect(screen.getByText('Inline Guy')).toBeInTheDocument();
  });
});

describe('PlayerIdentity rsvp-row variant', () => {
  it('renders a 24px avatar row with the name at text-xs (no null return, no DEV warn)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<PlayerIdentity name="Alice Ray" variant="rsvp-row" />);
    expect(screen.getByText('Alice Ray')).toBeInTheDocument();
    expect(screen.getByText('AR')).toBeInTheDocument(); // initials fallback
    const ring = screen.getByTestId('player-identity-ring');
    expect(ring.className).toContain('h-6');
    expect(ring.className).toContain('w-6');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
  it('applies a role ring via CSS var only when role is passed', () => {
    const { rerender } = render(<PlayerIdentity name="A" variant="rsvp-row" role="caster" />);
    expect(screen.getByTestId('player-identity-ring').style.borderColor).toBe('var(--color-role-caster)');
    rerender(<PlayerIdentity name="A" variant="rsvp-row" />);
    expect(screen.getByTestId('player-identity-ring').style.borderColor).toBe('');
  });
  it('emits the sr-only role label when role is set with no textual signal', () => {
    render(<PlayerIdentity name="A" variant="rsvp-row" role="tank" />);
    expect(screen.getByText('Tank')).toHaveClass('sr-only');
  });
  it('rsvp-row avatar fallback initials carry leading-none (A12 centering)', () => {
    render(<PlayerIdentity name="Alice Ray" variant="rsvp-row" />);
    expect(screen.getByText('AR').className).toContain('leading-none');
  });

  it('rsvp-row avatar fallback renders through the shared InitialsAvatar primitive', () => {
    render(<PlayerIdentity name="Alice Ray" variant="rsvp-row" />);
    const chip = screen.getByText('AR');
    expect(chip).toHaveAttribute('role', 'presentation');
    expect(chip).toHaveAttribute('aria-hidden', 'true');
  });
});
