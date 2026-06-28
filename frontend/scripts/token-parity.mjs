// Parity harness: compares CSS custom-property values between a baseline CSS
// file and a candidate, for both the dark scope (:root / @theme) and the
// [data-theme="light"] scope. Whitespace + trailing semicolons are normalized
// so formatting differences never cause false failures; only VALUE changes fail.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const norm = (v) => v.trim().replace(/\s+/g, ' ').replace(/;$/, '').trim();

// Extract the body of the FIRST balanced block whose header matches `headerRe`.
function blockBody(css, headerRe) {
  const m = headerRe.exec(css);
  if (!m) return '';
  let i = css.indexOf('{', m.index);
  if (i < 0) return '';
  let depth = 0, start = i + 1;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') { depth--; if (depth === 0) return css.slice(start, i); }
  }
  return '';
}

function varsFromBody(body) {
  const map = new Map();
  // strip /* ... */ comments
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /(--[A-Za-z0-9-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(clean))) map.set(m[1], norm(m[2]));
  return map;
}

export function parseThemeVars(css) {
  // Dark scope lives in @theme { } (Tailwind) and/or :root { }; merge both.
  const dark = new Map([
    ...varsFromBody(blockBody(css, /@theme[^{]*/)),
    ...varsFromBody(blockBody(css, /:root\b[^{]*/)),
  ]);
  const light = varsFromBody(blockBody(css, /\[data-theme=["']light["']\][^{]*/));
  return { dark, light };
}

export function diffVarMaps(baseline, candidate) {
  const changed = [], missing = [];
  for (const [k, v] of baseline) {
    if (!candidate.has(k)) missing.push(k);
    else if (candidate.get(k) !== v) changed.push({ key: k, was: v, now: candidate.get(k) });
  }
  const extra = [...candidate.keys()].filter((k) => !baseline.has(k));
  return { changed, missing, extra };
}

function report(scope, d) {
  const lines = [];
  if (d.changed.length) {
    lines.push(`  CHANGED (${d.changed.length}) [FAIL]:`);
    for (const c of d.changed) lines.push(`    ${c.key}: "${c.was}" -> "${c.now}"`);
  }
  if (d.missing.length) lines.push(`  MISSING (${d.missing.length}) [FAIL]: ${d.missing.join(', ')}`);
  if (d.extra.length) lines.push(`  EXTRA (${d.extra.length}) [ok, additive]: ${d.extra.join(', ')}`);
  return `[${scope}]\n${lines.length ? lines.join('\n') : '  clean'}`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , basePath, candPath] = process.argv;
  const base = parseThemeVars(readFileSync(basePath, 'utf8'));
  const cand = parseThemeVars(readFileSync(candPath, 'utf8'));
  const dd = diffVarMaps(base.dark, cand.dark);
  const dl = diffVarMaps(base.light, cand.light);
  console.log(report('dark', dd));
  console.log(report('light', dl));
  const fail = dd.changed.length + dd.missing.length + dl.changed.length + dl.missing.length;
  if (fail) { console.error(`\nPARITY FAIL: ${fail} changed/missing value(s).`); process.exit(1); }
  console.log('\nPARITY OK.');
}
