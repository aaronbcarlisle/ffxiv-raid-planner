/**
 * build-tokens.mjs — Custom data-driven design token generator.
 *
 * Provenance: standalone Node ESM script; no third-party token tooling.
 * Reads tokens/tokens.json (dark/base) + tokens/tokens.light.json (light overrides)
 * and emits src/styles/tokens.generated.css with:
 *   @theme { … }               — Tailwind v4 dark/base vars
 *   [data-theme="light"] { … } — light semantic overrides
 *
 * ─── HOW TO ADD A TOKEN CATEGORY ─────────────────────────────────────────────
 * 1. Add the tokens to tokens/tokens.json (and tokens/tokens.light.json if themed).
 * 2. Add their path→CSS-var-name entries to ID_TO_CSS_VAR below.
 * 3. Run: pnpm tokens:build
 * No other code change is needed. The generic emission loop handles the rest.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Token ID → CSS variable name ────────────────────────────────────────────
// Maps DTCG token paths (dot-separated) to the exact CSS variable names the
// baseline requires. Any token path NOT in this map is skipped; orphan
// categories (shadows, durations, gradients, etc.) are added in later tasks.
export const ID_TO_CSS_VAR = {
  // Surface
  'semantic.color.surface.base':        '--color-surface-base',
  'semantic.color.surface.raised':      '--color-surface-raised',
  'semantic.color.surface.card':        '--color-surface-card',
  'semantic.color.surface.elevated':    '--color-surface-elevated',
  'semantic.color.surface.overlay':     '--color-surface-overlay',
  'semantic.color.surface.interactive': '--color-surface-interactive',

  // Accent  (accent.default → --color-accent, NOT --color-accent-default)
  'semantic.color.accent.default':   '--color-accent',
  'semantic.color.accent.hover':     '--color-accent-hover',
  'semantic.color.accent.dim':       '--color-accent-dim',
  'semantic.color.accent.muted':     '--color-accent-muted',
  'semantic.color.accent.deep':      '--color-accent-deep',
  // on-accent → --color-accent-contrast (not --color-accent-on-accent)
  'semantic.color.accent.on-accent': '--color-accent-contrast',
  // --color-accent-bright is a light-only legacy alias (added explicitly in the
  // light block; omitted here so it never appears in the dark @theme output)

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

  // Shadows  (semantic.shadow.* → --shadow-*)
  'semantic.shadow.sm':   '--shadow-sm',
  'semantic.shadow.md':   '--shadow-md',
  'semantic.shadow.lg':   '--shadow-lg',
  'semantic.shadow.xl':   '--shadow-xl',
  'semantic.shadow.glow': '--shadow-glow',

  // Motion — durations (primitive.duration.* → --duration-*)
  'primitive.duration.fast':   '--duration-fast',
  'primitive.duration.normal': '--duration-normal',
  'primitive.duration.slow':   '--duration-slow',

  // Motion — easings (primitive.easing.* → --ease-*), additive / EXTRA
  'primitive.easing.standard':   '--ease-standard',
  'primitive.easing.decelerate': '--ease-decelerate',
  'primitive.easing.accelerate': '--ease-accelerate',

  // Gradient rail (component.nav.rail-bg → --gradient-rail)
  'component.nav.rail-bg': '--gradient-rail',

  // Overlay raise (semantic.color.interaction.raise-haze → --color-overlay-raise)
  'semantic.color.interaction.raise-haze': '--color-overlay-raise',
};

// ─── DTCG alias resolver ──────────────────────────────────────────────────────
function getByPath(obj, parts) {
  return parts.reduce((cur, k) => (cur != null ? cur[k] : undefined), obj);
}

export function resolveRef(ref, tree) {
  const inner = ref.slice(1, -1); // strip { }
  const node = getByPath(tree, inner.split('.'));
  if (!node) throw new Error(`Unresolved token reference: ${ref}`);
  const val = node.$value;
  if (typeof val === 'string' && val.startsWith('{')) return resolveRef(val, tree);
  return val;
}

export function resolveValue(val, tree) {
  if (typeof val === 'string' && val.startsWith('{')) return resolveRef(val, tree);
  return val;
}

// ─── Font family stack builder ────────────────────────────────────────────────
// Joins the token's $value array with ", " — quoting is pre-encoded in the
// token arrays (e.g. '"Exo 2"' already contains the CSS double-quote chars).
// Single-word names (system-ui, BlinkMacSystemFont, etc.) are stored bare.
export function buildFontStack(arr) {
  return arr.join(', ');
}

// ─── Flatten a token tree into { "dot.path": $value } entries ────────────────
// Walks the DTCG token tree and yields [dotPath, rawValue] pairs for every
// leaf node (node with a $value). Array $values (font families) are preserved
// as arrays; everything else is a string.
export function flattenTokens(obj, prefix = '') {
  const entries = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$')) continue; // skip $schema, $description, etc.
    const path = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && '$value' in val) {
      entries.push([path, val.$value]);
    } else if (val && typeof val === 'object') {
      entries.push(...flattenTokens(val, path));
    }
  }
  return entries;
}

// ─── Core CSS builder (pure, exported for unit tests) ────────────────────────
/**
 * buildCss(darkTokens, lightTokens, map) → CSS string
 *
 * DATA-DRIVEN: iterates ID_TO_CSS_VAR once for dark vars, once for light vars.
 * No per-category code blocks — adding a category means editing data (the map),
 * not adding new code.
 *
 * @param {object} darkTokens  — parsed tokens.json
 * @param {object} lightTokens — parsed tokens.light.json
 * @param {object} map         — token-path → CSS-var-name (defaults to ID_TO_CSS_VAR)
 */
export function buildCss(darkTokens, lightTokens, map = ID_TO_CSS_VAR) {
  // Flatten both token trees into dot-path → raw $value maps
  const darkFlat  = new Map(flattenTokens(darkTokens));
  const lightFlat = new Map(flattenTokens(lightTokens));

  const darkVars  = new Map();
  const lightVars = new Map();

  // ── Single generic loop over the map ─────────────────────────────────────
  // Dark: resolve each token from the dark tree.
  // Light: look up the same token ID in the light tree; skip if not present.
  for (const [tokenId, cssVar] of Object.entries(map)) {
    // ── Dark value ──────────────────────────────────────────────────────────
    if (darkFlat.has(tokenId)) {
      const raw = darkFlat.get(tokenId);
      let value;
      if (Array.isArray(raw)) {
        // cubicBezier arrays (all-numeric) → cubic-bezier(…); font-family
        // arrays (contain strings) → font stack joined with ", ".
        if (raw.every(v => typeof v === 'number')) {
          value = `cubic-bezier(${raw.join(', ')})`;
        } else {
          value = buildFontStack(raw);
        }
      } else {
        value = String(resolveValue(raw, darkTokens));
      }
      darkVars.set(cssVar, value);
    }

    // ── Light value ─────────────────────────────────────────────────────────
    if (lightFlat.has(tokenId)) {
      const raw = lightFlat.get(tokenId);
      let value;
      if (Array.isArray(raw)) {
        if (raw.every(v => typeof v === 'number')) {
          value = `cubic-bezier(${raw.join(', ')})`;
        } else {
          value = buildFontStack(raw);
        }
      } else {
        // Light tokens are semantic overrides — values are direct (no aliases)
        value = String(raw);
      }
      lightVars.set(cssVar, value);
    }
  }

  // ── Light-only extras ───────────────────────────────────────────────────────
  // --color-accent-bright is a legacy alias for accent.hover in the light block
  // only (it MUST NOT appear in the dark @theme — the baseline has it there only
  // because it's a legacy alias that light mode needs to override).
  // We emit it in the light block pointing at the same value as accent.hover.
  const lightAccentHover = lightFlat.get('semantic.color.accent.hover');
  if (lightAccentHover != null) {
    lightVars.set('--color-accent-bright', String(lightAccentHover));
  }

  // ── Emit ────────────────────────────────────────────────────────────────────
  const darkLines  = [...darkVars.entries()].map(([k, v]) => `  ${k}: ${v};`).join('\n');
  const lightLines = [...lightVars.entries()].map(([k, v]) => `  ${k}: ${v};`).join('\n');

  return [
    '/* AUTO-GENERATED — do not edit by hand. Run: pnpm tokens:build */',
    '/* Source: tokens/tokens.json (dark base) + tokens/tokens.light.json (light overrides) */',
    '/* Generator: scripts/build-tokens.mjs (custom data-driven, no third-party token tooling) */',
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
}

// ─── CLI entry point (guarded so imports in tests don't trigger file I/O) ────
// Mirror the pathToFileURL guard pattern used by token-parity.mjs.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const darkTokens  = JSON.parse(readFileSync(resolve(ROOT, 'tokens/tokens.json'), 'utf8'));
  const lightTokens = JSON.parse(readFileSync(resolve(ROOT, 'tokens/tokens.light.json'), 'utf8'));
  const css = buildCss(darkTokens, lightTokens);
  const outDir = resolve(ROOT, 'src/styles');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'tokens.generated.css'), css, 'utf8');
  console.log('tokens.generated.css written.');
}
