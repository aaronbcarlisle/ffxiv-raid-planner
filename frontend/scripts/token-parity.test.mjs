import { describe, it, expect } from 'vitest';
import { parseThemeVars, diffVarMaps } from './token-parity.mjs';

describe('token-parity', () => {
  it('parses dark (@theme) and light scopes', () => {
    const css = `@theme { --color-x: #111; /* c */ --font-y: "A", "B"; }
      [data-theme="light"] { --color-x: #fff; }`;
    const { dark, light } = parseThemeVars(css);
    expect(dark.get('--color-x')).toBe('#111');
    expect(dark.get('--font-y')).toBe('"A", "B"');
    expect(light.get('--color-x')).toBe('#fff');
  });
  it('flags a changed value and ignores additive extras', () => {
    const base = parseThemeVars(`@theme { --a: 1px; --b: red; }`).dark;
    const cand = parseThemeVars(`@theme { --a: 2px; --b: red; --c: new; }`).dark;
    const d = diffVarMaps(base, cand);
    expect(d.changed).toEqual([{ key: '--a', was: '1px', now: '2px' }]);
    expect(d.missing).toEqual([]);
    expect(d.extra).toEqual(['--c']);
  });
  it('normalizes whitespace so formatting is not a failure', () => {
    const base = parseThemeVars(`@theme { --a:  red ; }`).dark;
    const cand = parseThemeVars(`@theme { --a: red; }`).dark;
    expect(diffVarMaps(base, cand).changed).toEqual([]);
  });
});
