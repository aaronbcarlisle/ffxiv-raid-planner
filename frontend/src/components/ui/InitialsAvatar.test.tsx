/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InitialsAvatar } from './InitialsAvatar';

describe('InitialsAvatar', () => {
  it('renders the given initials text', () => {
    render(<InitialsAvatar initials="TO" size={24} />);
    expect(screen.getByText('TO')).toBeInTheDocument();
  });

  it('carries the proven centering fix: aria-hidden + role="presentation" + flex centering + leading-none', () => {
    // This is the actual bug fix (see InitialsAvatar.tsx docblock): a GLOBAL CSS rule
    // (index.css `[aria-hidden="true"] { display: revert !important }`, added for Radix
    // dropdown-sibling hiding) strips flex/grid centering from ANY aria-hidden element.
    // role="presentation" opts this element out of that rule (the rule's own escape
    // hatch: `:not([role="presentation"])`) so the flex classes actually take effect.
    render(<InitialsAvatar initials="TO" size={24} />);
    const chip = screen.getByText('TO');
    expect(chip).toHaveAttribute('aria-hidden', 'true');
    expect(chip).toHaveAttribute('role', 'presentation');
    expect(chip.className).toContain('flex');
    expect(chip.className).toContain('items-center');
    expect(chip.className).toContain('justify-center');
    expect(chip.className).toContain('leading-none');
  });

  it('sizes the circle from a numeric px size', () => {
    render(<InitialsAvatar initials="AB" size={30} />);
    const chip = screen.getByText('AB');
    expect(chip.style.width).toBe('30px');
    expect(chip.style.height).toBe('30px');
  });

  it('sizes the circle from a raw CSS size expression (AppRail needs the CSS-var form)', () => {
    render(<InitialsAvatar initials="DT" size="var(--nav-item-icon-size, 24px)" />);
    const chip = screen.getByText('DT');
    expect(chip.style.width).toBe('var(--nav-item-icon-size, 24px)');
    expect(chip.style.height).toBe('var(--nav-item-icon-size, 24px)');
  });

  it('applies background/border only when passed (leaves className to drive color otherwise)', () => {
    const { rerender } = render(<InitialsAvatar initials="X" size={24} />);
    let chip = screen.getByText('X');
    expect(chip.style.background).toBe('');
    expect(chip.style.borderStyle).toBe('');
    expect(chip.className).not.toContain('border');

    rerender(
      <InitialsAvatar
        initials="X"
        size={24}
        background="var(--color-accent-dim)"
        borderColor="var(--color-border-default)"
        borderWidth={1}
      />,
    );
    chip = screen.getByText('X');
    expect(chip.style.background).toBe('var(--color-accent-dim)');
    expect(chip.style.borderColor).toBe('var(--color-border-default)');
    expect(chip.style.borderStyle).toBe('solid');
    // width=1 maps to the Tailwind `border` class (not an inline borderWidth)
    // so a pre-existing `toHaveClass('border-2', ...)`-style regression pin
    // elsewhere keeps matching on the class, not just the inline style.
    expect(chip.className.split(/\s+/)).toContain('border');
  });

  it('maps borderWidth=2 to the border-2 class (RecipientPicker/PriorityRow shape)', () => {
    render(<InitialsAvatar initials="X" size={24} borderColor="var(--color-role-tank)" borderWidth={2} />);
    const chip = screen.getByText('X');
    expect(chip.className.split(/\s+/)).toContain('border-2');
    expect(chip.style.borderColor).toBe('var(--color-role-tank)');
  });

  it('defaults to text-xs (12px floor) and carries no design-system-ignore', () => {
    render(<InitialsAvatar initials="AB" size={30} />);
    expect(screen.getByText('AB').className).toContain('text-xs');
  });

  it('supports the sub-floor 2xs size (10px) — the forwarded PriorityRow ignore', () => {
    render(<InitialsAvatar initials="CO" size={22} textSize="2xs" />);
    expect(screen.getByText('CO').className).toContain('text-[10px]');
  });

  it('supports the 14px "sm" size (MembersPanel)', () => {
    render(<InitialsAvatar initials="D" size={32} textSize="sm" />);
    expect(screen.getByText('D').className).toContain('text-sm');
  });

  it('merges caller className (the Tailwind-utility-color escape hatch)', () => {
    render(<InitialsAvatar initials="D" size={32} className="bg-accent/20 text-accent" />);
    const chip = screen.getByText('D');
    expect(chip.className).toContain('bg-accent/20');
    expect(chip.className).toContain('text-accent');
  });

  it('maps fontWeight to a numeric CSS font-weight', () => {
    render(<InitialsAvatar initials="D" size={24} fontWeight="bold" />);
    expect(screen.getByText('D').style.fontWeight).toBe('700');
  });
});
