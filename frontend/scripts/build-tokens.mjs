// chosen: style-dictionary v5
// Custom @theme emitter for XIV Raid Planner design tokens.
// Reads tokens.json (dark base) + tokens.light.json (semantic overrides for light),
// resolves DTCG {alias} references, and emits:
//   @theme { … }                — Tailwind v4 dark/base namespaced tokens
//   [data-theme="light"] { … }  — semantic overrides for light mode
// Output: frontend/src/styles/tokens.generated.css
//
// Name-mapping decisions:
//   semantic.color.accent.default       → --color-accent  (not --color-accent-default)
//   semantic.color.accent.on-accent     → --color-accent-contrast
//   semantic.color.text.on-accent       → omitted (not a standalone baseline var)
//   semantic.color.interaction.focus-ring    → --color-focus-ring
//   semantic.color.interaction.active-bg     → --color-active-bg
//   semantic.color.interaction.hover-overlay → --color-hover-overlay
//   semantic.color.gear-source.*        → --color-gear-*
//   primitive.font.family.*             → --font-* (with extended system stacks)
//   primitive.font.size.*               → NOT emitted (no --text-* vars in baseline @theme)
//   primitive.radius.*                  → --radius-*
//   primitive.space.*                   → --spacing-*
//   primitive.size.container.*          → --container-*
//   primitive.size.rail / control.*     → NOT emitted (no baseline var)
//   Light accent.hover duplicate        → also emitted as --color-accent-bright (legacy alias)

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Load token files ────────────────────────────────────────────────────────

const darkTokens = JSON.parse(readFileSync(resolve(ROOT, 'tokens/tokens.json'), 'utf8'));
const lightTokens = JSON.parse(readFileSync(resolve(ROOT, 'tokens/tokens.light.json'), 'utf8'));

// ─── DTCG alias resolver ─────────────────────────────────────────────────────

function getByPath(obj, path) {
  return path.reduce((cur, k) => (cur != null ? cur[k] : undefined), obj);
}

function resolveRef(ref, tree) {
  const inner = ref.slice(1, -1);
  const parts = inner.split('.');
  const node = getByPath(tree, parts);
  if (!node) throw new Error(`Unresolved token reference: ${ref}`);
  const val = node.$value;
  if (typeof val === 'string' && val.startsWith('{')) return resolveRef(val, tree);
  return val;
}

function resolveValue(val, tree) {
  if (typeof val === 'string' && val.startsWith('{')) return resolveRef(val, tree);
  return val;
}

// ─── Font family extended system stacks ──────────────────────────────────────
// The DTCG array only lists the first few fonts; baseline uses extended stacks.
const FONT_OVERRIDES = {
  display: '"Exo 2", "Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  sans: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
};

// ─── Collect dark vars ────────────────────────────────────────────────────────

const darkVars = new Map();
const lightVars = new Map();

function set(map, name, value) {
  if (value === undefined || value === null) return;
  map.set(name, String(value));
}

const p = darkTokens.primitive;
const s = darkTokens.semantic;
const tree = darkTokens;

// SURFACE
for (const [k, tok] of Object.entries(s.color.surface)) {
  set(darkVars, `--color-surface-${k}`, resolveValue(tok.$value, tree));
}

// ACCENT
const acc = s.color.accent;
set(darkVars, '--color-accent', resolveValue(acc.default.$value, tree));
set(darkVars, '--color-accent-hover', resolveValue(acc.hover.$value, tree));
set(darkVars, '--color-accent-dim', resolveValue(acc.dim.$value, tree));
set(darkVars, '--color-accent-muted', resolveValue(acc.muted.$value, tree));
set(darkVars, '--color-accent-deep', resolveValue(acc.deep.$value, tree));
set(darkVars, '--color-accent-contrast', resolveValue(acc['on-accent'].$value, tree));

// ROLE
for (const [k, tok] of Object.entries(s.color.role)) {
  set(darkVars, `--color-role-${k}`, resolveValue(tok.$value, tree));
}

// MEMBERSHIP
for (const [k, tok] of Object.entries(s.color.membership)) {
  set(darkVars, `--color-membership-${k}`, resolveValue(tok.$value, tree));
}

// GEAR SOURCE  (gear-source.* → --color-gear-*)
for (const [k, tok] of Object.entries(s.color['gear-source'])) {
  set(darkVars, `--color-gear-${k}`, resolveValue(tok.$value, tree));
}

// STATUS
for (const [k, tok] of Object.entries(s.color.status)) {
  set(darkVars, `--color-status-${k}`, resolveValue(tok.$value, tree));
}

// TEXT
const txt = s.color.text;
for (const [k, tok] of Object.entries(txt)) {
  if (k === 'on-accent') continue; // not a standalone baseline var
  set(darkVars, `--color-text-${k}`, resolveValue(tok.$value, tree));
}

// BORDER
const brd = s.color.border;
set(darkVars, '--color-border-default', resolveValue(brd.default.$value, tree));
set(darkVars, '--color-border-subtle', resolveValue(brd.subtle.$value, tree));
set(darkVars, '--color-border-highlight', resolveValue(brd.highlight.$value, tree));
set(darkVars, '--color-border-focus', resolveValue(brd.focus.$value, tree));

// INTERACTION
const intr = s.color.interaction;
set(darkVars, '--color-focus-ring', resolveValue(intr['focus-ring'].$value, tree));
set(darkVars, '--color-active-bg', resolveValue(intr['active-bg'].$value, tree));
set(darkVars, '--color-hover-overlay', resolveValue(intr['hover-overlay'].$value, tree));

// FONT FAMILIES  (font.family.* → --font-*)
for (const [k] of Object.entries(p.font.family)) {
  set(darkVars, `--font-${k}`, FONT_OVERRIDES[k]);
}

// RADIUS  (radius.* → --radius-*)
for (const [k, tok] of Object.entries(p.radius)) {
  set(darkVars, `--radius-${k}`, tok.$value);
}

// SPACING  (space.* → --spacing-*)
for (const [k, tok] of Object.entries(p.space)) {
  set(darkVars, `--spacing-${k}`, tok.$value);
}

// CONTAINER  (size.container.* → --container-*)
for (const [k, tok] of Object.entries(p.size.container)) {
  set(darkVars, `--container-${k}`, tok.$value);
}

// ─── Collect light vars ───────────────────────────────────────────────────────

const ls = lightTokens.semantic;

// SURFACE
for (const [k, tok] of Object.entries(ls.color.surface)) {
  set(lightVars, `--color-surface-${k}`, tok.$value);
}

// ACCENT
const lacc = ls.color.accent;
set(lightVars, '--color-accent', lacc.default.$value);
set(lightVars, '--color-accent-hover', lacc.hover.$value);
set(lightVars, '--color-accent-dim', lacc.dim.$value);
// --color-accent-bright is a legacy alias for hover in light mode too
set(lightVars, '--color-accent-bright', lacc.hover.$value);
set(lightVars, '--color-accent-muted', lacc.muted.$value);
set(lightVars, '--color-accent-deep', lacc.deep.$value);
set(lightVars, '--color-accent-contrast', lacc['on-accent'].$value);

// ROLE
for (const [k, tok] of Object.entries(ls.color.role)) {
  set(lightVars, `--color-role-${k}`, tok.$value);
}

// MEMBERSHIP
for (const [k, tok] of Object.entries(ls.color.membership)) {
  set(lightVars, `--color-membership-${k}`, tok.$value);
}

// GEAR SOURCE
for (const [k, tok] of Object.entries(ls.color['gear-source'])) {
  set(lightVars, `--color-gear-${k}`, tok.$value);
}

// STATUS
for (const [k, tok] of Object.entries(ls.color.status)) {
  set(lightVars, `--color-status-${k}`, tok.$value);
}

// TEXT
const ltxt = ls.color.text;
for (const [k, tok] of Object.entries(ltxt)) {
  if (k === 'on-accent') continue;
  set(lightVars, `--color-text-${k}`, tok.$value);
}

// BORDER
const lbrd = ls.color.border;
set(lightVars, '--color-border-default', lbrd.default.$value);
set(lightVars, '--color-border-subtle', lbrd.subtle.$value);
set(lightVars, '--color-border-highlight', lbrd.highlight.$value);
set(lightVars, '--color-border-focus', lbrd.focus.$value);

// INTERACTION
const lintr = ls.color.interaction;
set(lightVars, '--color-focus-ring', lintr['focus-ring'].$value);
set(lightVars, '--color-active-bg', lintr['active-bg'].$value);
set(lightVars, '--color-hover-overlay', lintr['hover-overlay'].$value);

// ─── Emit CSS ─────────────────────────────────────────────────────────────────

function emitBlock(vars) {
  return [...vars.entries()].map(([k, v]) => `  ${k}: ${v};`).join('\n');
}

const css = `/* AUTO-GENERATED — do not edit by hand. Run: pnpm tokens:build */
/* Source: frontend/tokens/tokens.json + tokens.light.json */
/* chosen: style-dictionary v5 (custom @theme format, direct JSON resolution) */

@theme {
${emitBlock(darkVars)}
}

[data-theme="light"] {
${emitBlock(lightVars)}
}
`;

const outDir = resolve(ROOT, 'src/styles');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'tokens.generated.css'), css, 'utf8');
console.log(`✓ tokens.generated.css written (${darkVars.size} dark vars, ${lightVars.size} light vars)`);
