/**
 * FarmPips (S2a-4b·B1 Task TB1; R-F-10, D-11, S-7): the card's pips. One accessible image that
 * names the members by state, and a role-coloured dot carrying a glyph for each, so colour is
 * never the only signal.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PIP_GLYPH } from '../../utils/progressState';
import { FarmPips } from './FarmPips';

type Pip = Parameters<typeof FarmPips>[0]['pips'][number];

const pip = (name: string, state: Pip['state'], role = 'tank'): Pip => ({ name, role, state });

const ALL: Pip[] = [
  pip('A', 'need'),
  pip('B', 'need', 'healer'),
  pip('C', 'want', 'melee'),
  pip('D', 'have', 'ranged'),
  pip('E', 'none', 'caster'),
];

describe('FarmPips', () => {
  it('is one image named by state', () => {
    render(<FarmPips pips={ALL} />);
    expect(screen.getByRole('img', { name: 'Need: A, B; Want: C; Have: D; No status: E' })).toBeInTheDocument();
  });

  it('groups by state in the fixed order, whatever the column order, keeping column order inside a group', () => {
    render(<FarmPips pips={[pip('E', 'none'), pip('D', 'have'), pip('B', 'need'), pip('C', 'want'), pip('A', 'need')]} />);
    expect(screen.getByRole('img', { name: 'Need: B, A; Want: C; Have: D; No status: E' })).toBeInTheDocument();
  });

  it('leaves out a state nobody holds', () => {
    render(<FarmPips pips={[pip('D', 'have'), pip('E', 'none')]} />);
    expect(screen.getByRole('img', { name: 'Have: D; No status: E' })).toBeInTheDocument();
  });

  it('draws one pip per member, in column order', () => {
    render(<FarmPips pips={ALL} />);
    const pips = screen.getAllByTestId('farm-pip');
    expect(pips.map((el) => el.textContent?.trim())).toEqual([
      PIP_GLYPH.need,
      PIP_GLYPH.need,
      PIP_GLYPH.want,
      PIP_GLYPH.have,
      PIP_GLYPH.none,
    ]);
  });

  it('gives every state its own visible mark, no-status included, so colour is not the only signal', () => {
    render(<FarmPips pips={ALL} />);
    for (const el of screen.getAllByTestId('farm-pip')) {
      expect(el.textContent?.trim()).not.toBe('');
    }
    const marks = screen.getAllByTestId('farm-pip').map((el) => el.textContent?.trim());
    expect(new Set(marks).size).toBe(4);
  });

  it.each(['tank', 'healer', 'melee', 'ranged', 'caster'])('colours a %s pip with its role token', (role) => {
    render(<FarmPips pips={[pip('A', 'need', role)]} />);
    expect(screen.getByTestId('farm-pip').outerHTML).toContain(`--color-role-${role}`);
  });

  it('does not throw on a role the game data does not know', () => {
    expect(() => render(<FarmPips pips={[pip('A', 'need', '')]} />)).not.toThrow();
    expect(screen.getByRole('img', { name: 'Need: A' })).toBeInTheDocument();
  });

  it('keeps a name with quotes, a backslash, a dollar and non-Latin text as it is', () => {
    const name = `O'Neil "$&" \\u0041 ひかり`;
    render(<FarmPips pips={[pip(name, 'want')]} />);
    expect(screen.getByRole('img', { name: `Want: ${name}` })).toBeInTheDocument();
  });

  it('does not throw with no pips', () => {
    expect(() => render(<FarmPips pips={[]} />)).not.toThrow();
    expect(screen.queryAllByTestId('farm-pip')).toHaveLength(0);
  });
});
