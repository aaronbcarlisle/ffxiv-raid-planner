/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tag } from './Tag';

describe('Tag', () => {
  it('label variant is non-interactive (no button/link)', () => {
    render(<Tag variant="label" tone="success">Owned</Tag>);
    expect(screen.getByText('Owned')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('filter variant reflects pressed and fires onClick', () => {
    const onClick = vi.fn();
    render(<Tag variant="filter" pressed onClick={onClick}>Tanks</Tag>);
    const btn = screen.getByRole('button', { name: /Tanks/ });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('nav variant with href renders an anchor', () => {
    render(<Tag variant="nav" href="/discover">Find</Tag>);
    expect(screen.getByText('Find').closest('a')).toHaveAttribute('href', '/discover');
  });

  it('nav variant with onNavigate renders a button that fires', () => {
    const onNavigate = vi.fn();
    render(<Tag variant="nav" onNavigate={onNavigate}>Go</Tag>);
    fireEvent.click(screen.getByRole('button', { name: /Go/ }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('floor tones map to the R-45 floor tokens (Phase-D; additive — legacy passes none of these)', () => {
    render(<Tag variant="filter" tone="floor-2" pressed onClick={() => {}}>M10S</Tag>);
    const btn = screen.getByRole('button', { name: /M10S/ });
    expect(btn.className).toContain('text-floor-2');
    expect(btn.className).toContain('border-floor-2/30');
  });

  it.each([
    ['material-twine', 'text-material-twine'],
    ['material-glaze', 'text-material-glaze'],
    ['material-solvent', 'text-material-solvent'],
    ['material-tomestone', 'text-material-tomestone'],
  ] as const)('renders the %s tone with its material token', (tone, cls) => {
    render(<Tag variant="label" tone={tone}>x</Tag>);
    expect(screen.getByText('x').className).toContain(cls);
  });
});
