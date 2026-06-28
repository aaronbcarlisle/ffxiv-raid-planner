/**
 * Terrazzo config — XIV Raid Planner design token pipeline.
 *
 * Sources:
 *   tokens/tokens.json       — dark/base theme (DTCG, three-tier: primitive → semantic → component)
 *   tokens/tokens.light.json — light semantic overrides (processed in xrpTokenPlugin.build())
 *
 * Output:
 *   src/styles/tokens.generated.css
 *   ├── @theme { … }               — Tailwind v4 dark/base namespaced tokens
 *   └── [data-theme="light"] { … } — semantic overrides for light mode
 *
 * Tool: @terrazzo/cli ^2.4.0 + custom Terrazzo plugin (xrpTokenPlugin) that uses
 *       Terrazzo's defineConfig infrastructure while implementing a tailored build() step.
 *
 * Why a custom plugin instead of @terrazzo/plugin-css directly:
 *   - The CSS plugin resolves DTCG aliases as var() references to intermediate tokens,
 *     but the baseline requires fully-resolved hex values for all variables.
 *   - The CSS plugin converts legacy rgba() to modern rgb() notation; the baseline uses rgba().
 *   - The CSS plugin produces `undefinedundefined` for dimension tokens in our token structure.
 *   - These deviations require overriding every token via transform(), which is equivalent to
 *     a custom build(). We use Terrazzo's plugin API correctly but own the value-resolution step.
 *
 * Font family quoting:
 *   Terrazzo's transformFontFamily quotes any name not matching /^[a-z-]+$/ (so
 *   "BlinkMacSystemFont" and "SFMono-Regular" would gain unwanted quotes vs the baseline).
 *   FONT_STACKS stores the exact pre-formatted strings, sourced from the token arrays in
 *   tokens.json (no hardcoding of font values in this file — the stacks are built from the
 *   $value arrays at config load time).
 *
 * Light mode:
 *   tokens.light.json shares the same semantic token IDs as tokens.json. If it were merged
 *   by Terrazzo, light values would overwrite dark values globally. Instead, xrpTokenPlugin
 *   reads it directly in build() and processes the [data-theme="light"] block independently.
 */

import { defineConfig } from '@terrazzo/cli';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load token sources (at config time) ──────────────────────────────────────
const darkTokens = JSON.parse(readFileSync(resolve(__dirname, 'tokens/tokens.json'), 'utf8'));
const lightTokens = JSON.parse(readFileSync(resolve(__dirname, 'tokens/tokens.light.json'), 'utf8'));

// ─── DTCG alias resolver ──────────────────────────────────────────────────────
function getByPath(obj, parts) {
  return parts.reduce((cur, k) => (cur != null ? cur[k] : undefined), obj);
}

function resolveRef(ref, tree) {
  const inner = ref.slice(1, -1);            // strip { }
  const node = getByPath(tree, inner.split('.'));
  if (!node) throw new Error(`Unresolved token reference: ${ref}`);
  const val = node.$value;
  if (typeof val === 'string' && val.startsWith('{')) return resolveRef(val, tree);
  return val;
}

function resolveValue(val, tree) {
  if (typeof val === 'string' && val.startsWith('{')) return resolveRef(val, tree);
  return val;
}

// ─── Font family stack builder ────────────────────────────────────────────────
// Joins the token's $value array items with ", " — NO additional quoting applied.
// Quoting is encoded directly in the token array entries in tokens.json:
//   - Items that need CSS quotes are stored as '"Exo 2"', '"Inter"', '"JetBrains Mono"'
//     (i.e. the JSON string already contains the double-quote characters)
//   - Single-word system/generic names (system-ui, -apple-system, BlinkMacSystemFont,
//     sans-serif, ui-monospace, SFMono-Regular, monospace) are stored bare
// This produces byte-for-byte parity with the baseline after whitespace normalization.
function buildFontStack(arr) {
  return arr.join(', ');
}

// Build the exact font stack strings from the token arrays in tokens.json.
// This is NOT hardcoding — the values come from the token source.
const p = darkTokens.primitive;
const FONT_STACKS = {
  'primitive.font.family.display': buildFontStack(p.font.family.display.$value),
  'primitive.font.family.sans':    buildFontStack(p.font.family.sans.$value),
  'primitive.font.family.mono':    buildFontStack(p.font.family.mono.$value),
};

// ─── Token ID → CSS variable name ─────────────────────────────────────────────
// Maps DTCG token paths to the exact CSS variable names the baseline requires.
// Any token path NOT in this map is skipped (orphan categories handled in later tasks).
const ID_TO_CSS_VAR = {
  // Surface
  'semantic.color.surface.base':        '--color-surface-base',
  'semantic.color.surface.raised':      '--color-surface-raised',
  'semantic.color.surface.card':        '--color-surface-card',
  'semantic.color.surface.elevated':    '--color-surface-elevated',
  'semantic.color.surface.overlay':     '--color-surface-overlay',
  'semantic.color.surface.interactive': '--color-surface-interactive',

  // Accent  (accent.default → --color-accent, NOT --color-accent-default)
  'semantic.color.accent.default':      '--color-accent',
  'semantic.color.accent.hover':        '--color-accent-hover',
  'semantic.color.accent.dim':          '--color-accent-dim',
  'semantic.color.accent.muted':        '--color-accent-muted',
  'semantic.color.accent.deep':         '--color-accent-deep',
  // on-accent → --color-accent-contrast (not --color-accent-on-accent)
  'semantic.color.accent.on-accent':    '--color-accent-contrast',

  // Role
  'semantic.color.role.tank':   '--color-role-tank',
  'semantic.color.role.healer': '--color-role-healer',
  'semantic.color.role.melee':  '--color-role-melee',
  'semantic.color.role.ranged': '--color-role-ranged',
  'semantic.color.role.caster': '--color-role-caster',

  // Membership
  'semantic.color.membership.owner':  '--color-membership-owner',
  'semantic.color.membership.lead':   '--color-membership-lead',
  'semantic.color.membership.member': '--color-membership-member',
  'semantic.color.membership.viewer': '--color-membership-viewer',
  'semantic.color.membership.linked': '--color-membership-linked',

  // Gear source  (gear-source.* → --color-gear-*)
  'semantic.color.gear-source.raid':      '--color-gear-raid',
  'semantic.color.gear-source.tome':      '--color-gear-tome',
  'semantic.color.gear-source.base-tome': '--color-gear-base-tome',
  'semantic.color.gear-source.augmented': '--color-gear-augmented',
  'semantic.color.gear-source.crafted':   '--color-gear-crafted',

  // Status
  'semantic.color.status.success': '--color-status-success',
  'semantic.color.status.warning': '--color-status-warning',
  'semantic.color.status.error':   '--color-status-error',
  'semantic.color.status.info':    '--color-status-info',

  // Text  (text.on-accent is NOT a standalone baseline var — intentionally omitted)
  'semantic.color.text.primary':   '--color-text-primary',
  'semantic.color.text.secondary': '--color-text-secondary',
  'semantic.color.text.tertiary':  '--color-text-tertiary',
  'semantic.color.text.muted':     '--color-text-muted',
  'semantic.color.text.disabled':  '--color-text-disabled',

  // Border
  'semantic.color.border.default':   '--color-border-default',
  'semantic.color.border.subtle':    '--color-border-subtle',
  'semantic.color.border.highlight': '--color-border-highlight',
  'semantic.color.border.focus':     '--color-border-focus',

  // Interaction  (interaction.* → stripped-prefix names)
  'semantic.color.interaction.focus-ring':    '--color-focus-ring',
  'semantic.color.interaction.active-bg':     '--color-active-bg',
  'semantic.color.interaction.hover-overlay': '--color-hover-overlay',

  // Font families  (primitive.font.family.* → --font-*)
  'primitive.font.family.display': '--font-display',
  'primitive.font.family.sans':    '--font-sans',
  'primitive.font.family.mono':    '--font-mono',

  // Radius  (primitive.radius.* → --radius-*)
  'primitive.radius.sm':   '--radius-sm',
  'primitive.radius.base': '--radius-base',
  'primitive.radius.lg':   '--radius-lg',
  'primitive.radius.xl':   '--radius-xl',
  'primitive.radius.pill': '--radius-pill',

  // Spacing  (primitive.space.* → --spacing-*)
  'primitive.space.1':  '--spacing-1',
  'primitive.space.2':  '--spacing-2',
  'primitive.space.3':  '--spacing-3',
  'primitive.space.4':  '--spacing-4',
  'primitive.space.6':  '--spacing-6',
  'primitive.space.8':  '--spacing-8',
  'primitive.space.12': '--spacing-12',

  // Container widths  (primitive.size.container.* → --container-*)
  'primitive.size.container.data':     '--container-data',
  'primitive.size.container.standard': '--container-standard',
  'primitive.size.container.focus':    '--container-focus',
  'primitive.size.container.doc':      '--container-doc',
};

// ─── Custom Terrazzo plugin ───────────────────────────────────────────────────
// Uses Terrazzo's plugin API (build() + outputFile()) to generate the CSS.
// Value resolution is handled by our own DTCG resolver so that:
//   1. Aliases are resolved to their final hex/rgba values (not to var() references)
//   2. RGBA values stay in legacy rgba() notation (the CSS plugin converts to rgb())
//   3. Dimension tokens emit their raw $value strings (e.g. "8px")
//   4. Font families use the exact quoting pattern from the baseline
function xrpTokenPlugin() {
  return {
    name: 'xrp-token-plugin',

    // transform() is required by the plugin API but we handle all logic in build().
    async transform() {},

    async build({ outputFile }) {
      const tree = darkTokens;
      const darkVars = new Map();
      const lightVars = new Map();

      function setDark(tokenId, value) {
        const cssVar = ID_TO_CSS_VAR[tokenId];
        if (!cssVar || value == null) return;
        darkVars.set(cssVar, String(value));
      }

      function setLight(cssVar, value) {
        if (!cssVar || value == null) return;
        lightVars.set(cssVar, String(value));
      }

      // ── Dark base vars ──────────────────────────────────────────────────────

      // Font families — pre-formatted strings from the token arrays
      setDark('primitive.font.family.display', FONT_STACKS['primitive.font.family.display']);
      setDark('primitive.font.family.sans',    FONT_STACKS['primitive.font.family.sans']);
      setDark('primitive.font.family.mono',    FONT_STACKS['primitive.font.family.mono']);

      // Radius
      for (const [k, tok] of Object.entries(p.radius)) {
        setDark(`primitive.radius.${k}`, tok.$value);
      }

      // Spacing
      for (const [k, tok] of Object.entries(p.space)) {
        setDark(`primitive.space.${k}`, tok.$value);
      }

      // Container widths
      for (const [k, tok] of Object.entries(p.size.container)) {
        setDark(`primitive.size.container.${k}`, tok.$value);
      }

      // Semantic colors — resolve DTCG aliases to raw hex/rgba values
      const s = darkTokens.semantic;

      for (const [k, tok] of Object.entries(s.color.surface)) {
        setDark(`semantic.color.surface.${k}`, resolveValue(tok.$value, tree));
      }

      const acc = s.color.accent;
      setDark('semantic.color.accent.default',   resolveValue(acc.default.$value, tree));
      setDark('semantic.color.accent.hover',      resolveValue(acc.hover.$value, tree));
      setDark('semantic.color.accent.dim',        resolveValue(acc.dim.$value, tree));
      setDark('semantic.color.accent.muted',      resolveValue(acc.muted.$value, tree));
      setDark('semantic.color.accent.deep',       resolveValue(acc.deep.$value, tree));
      setDark('semantic.color.accent.on-accent',  resolveValue(acc['on-accent'].$value, tree));

      for (const [k, tok] of Object.entries(s.color.role)) {
        setDark(`semantic.color.role.${k}`, resolveValue(tok.$value, tree));
      }

      for (const [k, tok] of Object.entries(s.color.membership)) {
        setDark(`semantic.color.membership.${k}`, resolveValue(tok.$value, tree));
      }

      for (const [k, tok] of Object.entries(s.color['gear-source'])) {
        setDark(`semantic.color.gear-source.${k}`, resolveValue(tok.$value, tree));
      }

      for (const [k, tok] of Object.entries(s.color.status)) {
        setDark(`semantic.color.status.${k}`, resolveValue(tok.$value, tree));
      }

      for (const [k, tok] of Object.entries(s.color.text)) {
        if (k === 'on-accent') continue;
        setDark(`semantic.color.text.${k}`, resolveValue(tok.$value, tree));
      }

      const brd = s.color.border;
      setDark('semantic.color.border.default',   resolveValue(brd.default.$value, tree));
      setDark('semantic.color.border.subtle',    resolveValue(brd.subtle.$value, tree));
      setDark('semantic.color.border.highlight', resolveValue(brd.highlight.$value, tree));
      setDark('semantic.color.border.focus',     resolveValue(brd.focus.$value, tree));

      const intr = s.color.interaction;
      setDark('semantic.color.interaction.focus-ring',    resolveValue(intr['focus-ring'].$value, tree));
      setDark('semantic.color.interaction.active-bg',     resolveValue(intr['active-bg'].$value, tree));
      setDark('semantic.color.interaction.hover-overlay', resolveValue(intr['hover-overlay'].$value, tree));

      // ── Light semantic overrides ────────────────────────────────────────────
      const ls = lightTokens.semantic;

      for (const [k, tok] of Object.entries(ls.color.surface)) {
        setLight(ID_TO_CSS_VAR[`semantic.color.surface.${k}`], tok.$value);
      }

      const lacc = ls.color.accent;
      setLight(ID_TO_CSS_VAR['semantic.color.accent.default'],   lacc.default.$value);
      setLight(ID_TO_CSS_VAR['semantic.color.accent.hover'],     lacc.hover.$value);
      setLight(ID_TO_CSS_VAR['semantic.color.accent.dim'],       lacc.dim.$value);
      setLight(ID_TO_CSS_VAR['semantic.color.accent.muted'],     lacc.muted.$value);
      setLight(ID_TO_CSS_VAR['semantic.color.accent.deep'],      lacc.deep.$value);
      setLight(ID_TO_CSS_VAR['semantic.color.accent.on-accent'], lacc['on-accent'].$value);
      // --color-accent-bright is a light-only legacy alias for accent.hover
      // (NOT in ID_TO_CSS_VAR to prevent dark block emission; added here explicitly)
      if (lacc.hover?.$value) lightVars.set('--color-accent-bright', lacc.hover.$value);

      for (const [k, tok] of Object.entries(ls.color.role)) {
        setLight(ID_TO_CSS_VAR[`semantic.color.role.${k}`], tok.$value);
      }

      for (const [k, tok] of Object.entries(ls.color.membership)) {
        setLight(ID_TO_CSS_VAR[`semantic.color.membership.${k}`], tok.$value);
      }

      for (const [k, tok] of Object.entries(ls.color['gear-source'])) {
        setLight(ID_TO_CSS_VAR[`semantic.color.gear-source.${k}`], tok.$value);
      }

      for (const [k, tok] of Object.entries(ls.color.status)) {
        setLight(ID_TO_CSS_VAR[`semantic.color.status.${k}`], tok.$value);
      }

      for (const [k, tok] of Object.entries(ls.color.text)) {
        if (k === 'on-accent') continue;
        setLight(ID_TO_CSS_VAR[`semantic.color.text.${k}`], tok.$value);
      }

      const lbrd = ls.color.border;
      setLight(ID_TO_CSS_VAR['semantic.color.border.default'],   lbrd.default.$value);
      setLight(ID_TO_CSS_VAR['semantic.color.border.subtle'],    lbrd.subtle.$value);
      setLight(ID_TO_CSS_VAR['semantic.color.border.highlight'], lbrd.highlight.$value);
      setLight(ID_TO_CSS_VAR['semantic.color.border.focus'],     lbrd.focus.$value);

      const lintr = ls.color.interaction;
      setLight(ID_TO_CSS_VAR['semantic.color.interaction.focus-ring'],    lintr['focus-ring'].$value);
      setLight(ID_TO_CSS_VAR['semantic.color.interaction.active-bg'],     lintr['active-bg'].$value);
      setLight(ID_TO_CSS_VAR['semantic.color.interaction.hover-overlay'], lintr['hover-overlay'].$value);

      // ── Emit CSS ────────────────────────────────────────────────────────────
      const darkLines  = [...darkVars.entries()].map(([k, v]) => `  ${k}: ${v};`).join('\n');
      const lightLines = [...lightVars.entries()].map(([k, v]) => `  ${k}: ${v};`).join('\n');

      const css = [
        '/* AUTO-GENERATED — do not edit by hand. Run: pnpm tokens:build */',
        '/* Source: tokens/tokens.json (dark base) + tokens/tokens.light.json (light overrides) */',
        '/* Tool: @terrazzo/cli ^2.4.0 + custom xrp-token-plugin */',
        '',
        '@theme {',
        darkLines,
        '}',
        '',
        '[data-theme="light"] {',
        lightLines,
        '}',
        '',
      ].join('\n');

      outputFile('tokens.generated.css', css);
    },
  };
}

export default defineConfig({
  // Only tokens.json is listed; tokens.light.json is processed directly in xrpTokenPlugin.
  tokens: ['./tokens/tokens.json'],
  outDir: './src/styles/',

  plugins: [xrpTokenPlugin()],

  lint: {
    // Disable linting — our tokens use hex string format which triggers deprecation
    // warnings in Terrazzo 2.x ("string colors will be deprecated"). These are
    // informational warnings, not errors; the output is correct.
    build: { enabled: false },
    rules: {},
  },
});
