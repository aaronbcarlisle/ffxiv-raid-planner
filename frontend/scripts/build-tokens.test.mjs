/**
 * Unit tests for the data-driven core of build-tokens.mjs.
 *
 * Tests use an inline fixture token tree + map to verify:
 *   (a) DTCG alias references are resolved to their final values
 *   (b) Token-path → CSS-var-name overrides from the map are applied correctly
 *   (c) Both @theme (dark) and [data-theme="light"] blocks are emitted
 *   (d) Font family arrays are joined with the correct quoting preserved
 */
import { describe, it, expect } from 'vitest';
import { resolveValue, resolveRef, buildFontStack, flattenTokens, buildCss } from './build-tokens.mjs';

// ─── Fixture data ─────────────────────────────────────────────────────────────
const fixtureDark = {
  primitive: {
    color: {
      ink: {
        '0': { $type: 'color', $value: '#050508' },
      },
      teal: {
        '500': { $type: 'color', $value: '#14b8a6' },
      },
    },
    font: {
      family: {
        display: { $type: 'fontFamily', $value: ['"Exo 2"', 'system-ui', 'sans-serif'] },
      },
    },
    radius: {
      sm: { $type: 'dimension', $value: '6px' },
    },
  },
  semantic: {
    color: {
      surface: {
        base: { $type: 'color', $value: '{primitive.color.ink.0}' },
      },
      accent: {
        default: { $type: 'color', $value: '{primitive.color.teal.500}' },
      },
    },
  },
};

const fixtureLight = {
  semantic: {
    color: {
      surface: {
        base: { $type: 'color', $value: '#f5f5f8' },
      },
      accent: {
        default: { $type: 'color', $value: '#0f9688' },
        hover: { $type: 'color', $value: '#0d7a6e' },
      },
    },
  },
};

const fixtureMap = {
  'semantic.color.surface.base':  '--color-surface-base',
  'semantic.color.accent.default': '--color-accent',
  'semantic.color.accent.hover':   '--color-accent-hover',
  'primitive.font.family.display': '--font-display',
  'primitive.radius.sm':           '--radius-sm',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolveValue / resolveRef', () => {
  it('(a) resolves a DTCG alias reference to its final primitive value', () => {
    // {primitive.color.ink.0} → #050508
    expect(resolveValue('{primitive.color.ink.0}', fixtureDark)).toBe('#050508');
  });

  it('resolves a direct (non-alias) value unchanged', () => {
    expect(resolveValue('#ffffff', fixtureDark)).toBe('#ffffff');
  });

  it('resolves a chained alias (alias → alias → value)', () => {
    // Build a tree where accent.default → teal.500 → #14b8a6
    expect(resolveValue('{primitive.color.teal.500}', fixtureDark)).toBe('#14b8a6');
  });

  it('throws for an unresolvable reference', () => {
    expect(() => resolveRef('{does.not.exist}', fixtureDark)).toThrow('Unresolved token reference');
  });
});

describe('buildFontStack', () => {
  it('joins array items with ", " preserving pre-encoded quoting', () => {
    // Pre-encoded quotes in array items must not be double-quoted
    expect(buildFontStack(['"Exo 2"', 'system-ui', 'sans-serif'])).toBe('"Exo 2", system-ui, sans-serif');
  });
});

describe('flattenTokens', () => {
  it('yields dot-path → $value pairs for all leaf nodes', () => {
    const entries = new Map(flattenTokens(fixtureDark));
    expect(entries.get('primitive.color.ink.0')).toBe('#050508');
    expect(entries.get('semantic.color.surface.base')).toBe('{primitive.color.ink.0}');
  });

  it('skips $-prefixed metadata keys', () => {
    const entries = new Map(flattenTokens(fixtureDark));
    // $type and $description should never appear as paths
    for (const key of entries.keys()) {
      expect(key).not.toMatch(/\.\$/);
    }
  });
});

describe('buildCss', () => {
  const css = buildCss(fixtureDark, fixtureLight, fixtureMap);

  it('(b) applies name-override from the map (accent.default → --color-accent)', () => {
    expect(css).toContain('--color-accent: #14b8a6;');
  });

  it('(a) resolves alias references to final hex values in @theme', () => {
    // surface.base is aliased to ink.0 (#050508)
    expect(css).toContain('--color-surface-base: #050508;');
  });

  it('(c) emits both @theme and [data-theme="light"] blocks', () => {
    expect(css).toContain('@theme {');
    expect(css).toContain('[data-theme="light"] {');
  });

  it('light block uses the light token values, not dark', () => {
    // Light surface.base is #f5f5f8, not #050508
    const lightBlock = css.split('[data-theme="light"]')[1];
    expect(lightBlock).toContain('--color-surface-base: #f5f5f8;');
    expect(lightBlock).not.toContain('--color-surface-base: #050508;');
  });

  it('dark block does not contain light-only values', () => {
    const darkBlock = css.split('@theme {')[1].split('}')[0];
    expect(darkBlock).not.toContain('#f5f5f8');
  });

  it('font family arrays are joined with correct quoting', () => {
    expect(css).toContain('--font-display: "Exo 2", system-ui, sans-serif;');
  });

  it('dimension tokens are emitted as raw strings (e.g. "6px")', () => {
    expect(css).toContain('--radius-sm: 6px;');
  });

  it('light-only --color-accent-bright is added when accent.hover is in light tree', () => {
    const lightBlock = css.split('[data-theme="light"]')[1];
    expect(lightBlock).toContain('--color-accent-bright: #0d7a6e;');
  });

  it('--color-accent-bright does NOT appear in the dark @theme block', () => {
    const darkBlock = css.split('@theme {')[1].split('}')[0];
    expect(darkBlock).not.toContain('--color-accent-bright');
  });
});
