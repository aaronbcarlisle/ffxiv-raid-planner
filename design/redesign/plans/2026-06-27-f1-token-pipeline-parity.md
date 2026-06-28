# F1 — Token Pipeline + Parity Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the redesign's `tokens.json` into the real app as the single source of truth — generating the CSS + Tailwind 4 `@theme` from tokens, at **full parity** with the current hand-written `frontend/src/index.css` (zero visual change), with a CI guard that keeps generated CSS from drifting from source.

**Architecture:** A generator (Style Dictionary v5 *or* Terrazzo, chosen in Task 2 by an objective parity test) reads `frontend/tokens/tokens.json` + `tokens.light.json` and emits `frontend/src/styles/tokens.generated.css` (containing the `@theme` block + the `[data-theme="light"]` semantic overrides). `index.css` `@import`s that generated file instead of hand-defining the block. A **parity harness** (`frontend/scripts/token-parity.mjs`) diffs the resolved CSS-variable values of the frozen pre-change `index.css` baseline against the generated output; the cutover is correct iff there are **zero changed/missing** values (pure additions allowed). Tokens are expanded category-by-category until the harness is clean.

**Tech Stack:** Node ESM scripts, Style Dictionary v5 **or** Terrazzo (`@terrazzo/cli` + `@terrazzo/plugin-tailwind`), Tailwind CSS 4 (CSS-first `@theme`, no `tailwind.config`), Vite 7, pnpm, Vitest.

## Global Constraints

- **No AI attribution in commits or PRs** — no "Co-Authored-By", no "Generated with". Absolute. (CLAUDE.md)
- **Atoms are byte-for-byte from `index.css`** — colors, type, spacing, radii values are preserved verbatim; only structure is additive. Parity = **zero unexpected value changes**.
- **Exactly one `@theme` block** must exist after cutover. Two would reintroduce drift.
- **Light theme overrides the SEMANTIC tier only** — primitives/components don't change across themes.
- **Token tiers reference inward only**: component → semantic → primitive; never skip; never raw literals in component tier. (DESIGN_SYSTEM.md §1)
- **Readable floor is 12px** (`text-xs`); 9px is allowed **only** for badge counts. (Corrects the redesign docs' "9px floor" wording — see Task 14.)
- **Release-notes rule:** any PR touching `frontend/src/` must add/update an entry in `frontend/src/data/releaseNotes.ts`. Token plumbing with no visible change uses `{ internal: true, ... }` and does **not** bump `CURRENT_VERSION`. (CLAUDE.md)
- **Branch:** all work on `redesign/foundation` (the integration base) or a child `redesign/f1-tokens` PR'd into it.
- **Verify with `pnpm build`** (`tsc -b && vite build`) — stricter than `tsc --noEmit`.
- **Container tier values** (the one intentional, expected diff): `data 2160 / standard 1760 / focus 1100 / doc 960`, replacing `data 2560 / wide 1920 / focus 1280 / narrow / compact`.

**Authority:** `design/redesign/specs/2026-06-27-design-token-parity-wiring-design.md` (the spec), `design/redesign/FOUNDATION_ROADMAP.md` (F1 in context), `DESIGN_SYSTEM.md` (token architecture). The locked tier-mapping for every token category is in the spec §3.

---

## File Structure

| File | Responsibility |
|---|---|
| `frontend/tokens/tokens.json` | DTCG source of truth (moved from `design/redesign/mockups/theme/`), expanded to full parity. |
| `frontend/tokens/tokens.light.json` | Semantic-tier light overrides, expanded to full parity. |
| `frontend/scripts/token-parity.mjs` | Parity harness: parse two CSS files → `{var: value}` maps for dark + light → diff (changed/missing/extra). |
| `frontend/scripts/__parity__/index.baseline.css` | Frozen copy of the pre-change `index.css` — the parity target. |
| `frontend/scripts/build-tokens.mjs` *(or SD/Terrazzo config)* | The generator behind `pnpm tokens:build`. |
| `frontend/src/styles/tokens.generated.css` | Generated `@theme` + `[data-theme="light"]` block. Build artifact; never hand-edited. |
| `frontend/src/index.css` | Loses its hand-written `@theme`/light block; `@import`s the generated file. |
| `frontend/src/components/layout/PageContainer.tsx` | Container `variant` prop renamed to the new tiers. |
| `frontend/package.json` | Adds `tokens:build`, `tokens:parity`, `tokens:check` scripts. |
| `.github/workflows/*` | The generated-matches-source CI guard. |
| `frontend/src/data/releaseNotes.ts` | Internal release-note entry. |

---

## Task 1: Parity harness + frozen baseline

**Files:**
- Create: `frontend/scripts/token-parity.mjs`
- Create: `frontend/scripts/__parity__/index.baseline.css` (copy of current `index.css`)
- Modify: `frontend/package.json` (add `tokens:parity` script)
- Test: `frontend/scripts/token-parity.test.mjs`

**Interfaces:**
- Produces: a CLI `node scripts/token-parity.mjs <baselineCssPath> <candidateCssPath>` that exits `0` when no `changed`/`missing` vars and non-zero otherwise, printing a categorized report. Also exports `parseThemeVars(cssText) → { dark: Map, light: Map }` and `diffVarMaps(baseline, candidate) → { changed, missing, extra }` for the unit test.

- [ ] **Step 1: Freeze the baseline.** Copy the current file verbatim so later tasks diff against the pre-change truth.

```bash
cd frontend
mkdir -p scripts/__parity__
cp src/index.css scripts/__parity__/index.baseline.css
```

- [ ] **Step 2: Write the harness.** Create `frontend/scripts/token-parity.mjs`:

```javascript
// Parity harness: compares CSS custom-property values between a baseline CSS
// file and a candidate, for both the dark scope (:root / @theme) and the
// [data-theme="light"] scope. Whitespace + trailing semicolons are normalized
// so formatting differences never cause false failures; only VALUE changes fail.
import { readFileSync } from 'node:fs';

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

if (import.meta.url === `file://${process.argv[1]}`) {
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
```

- [ ] **Step 3: Write the unit test.** Create `frontend/scripts/token-parity.test.mjs`:

```javascript
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
```

- [ ] **Step 4: Add the script.** In `frontend/package.json` `"scripts"`, add:

```json
"tokens:parity": "node scripts/token-parity.mjs scripts/__parity__/index.baseline.css src/styles/tokens.generated.css"
```

- [ ] **Step 5: Run the unit test — verify it passes.**

Run: `cd frontend && pnpm vitest run scripts/token-parity.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 6: Sanity-check the harness against reality.** Prove it reports clean when a file is compared to itself.

Run: `cd frontend && node scripts/token-parity.mjs scripts/__parity__/index.baseline.css scripts/__parity__/index.baseline.css`
Expected: `[dark] clean`, `[light] clean`, `PARITY OK.`

- [ ] **Step 7: Commit.**

```bash
git add frontend/scripts/token-parity.mjs frontend/scripts/token-parity.test.mjs frontend/scripts/__parity__/index.baseline.css frontend/package.json
git commit -m "test(tokens): parity harness + frozen index.css baseline"
```

---

## Task 2: Stand up the generator behind `pnpm tokens:build`

**Files:**
- Create: `frontend/tokens/tokens.json` (moved from `design/redesign/mockups/theme/tokens.json`)
- Create: `frontend/tokens/tokens.light.json` (moved)
- Create: `frontend/scripts/build-tokens.mjs` *(if Style Dictionary)* or `frontend/terrazzo.config.js` *(if Terrazzo)*
- Create: `frontend/src/styles/tokens.generated.css` (generated output)
- Modify: `frontend/package.json` (add `tokens:build`, deps)

**Interfaces:**
- Produces: `pnpm tokens:build` → writes `frontend/src/styles/tokens.generated.css` containing an `@theme { … }` block (the dark/base namespaced tokens) and a `[data-theme="light"] { … }` block (semantic overrides). Every later task depends ONLY on this script + that output path, never on the tool internals.

**Decision rule (resolve the tool here, objectively):** Implement the generator with **Style Dictionary v5 + a small custom `@theme` format** first. Run the parity harness (Step 6). If the SD output reproduces the existing atoms with **zero `changed` values** on tokens that already exist in `tokens.json` (only `missing` for not-yet-added orphan categories), keep SD. If SD's composite/format handling produces value mismatches that take more than ~30 min to resolve, switch to **Terrazzo** (`@terrazzo/plugin-tailwind`, which emits `@theme` directly) and re-run the harness. Record the choice in a one-line comment at the top of the generator file. Do **not** proceed to Task 3 until Step 6 passes with zero `changed`.

- [ ] **Step 1: Move the token files into the app.**

```bash
cd "D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner"
mkdir -p frontend/tokens
git mv design/redesign/mockups/theme/tokens.json frontend/tokens/tokens.json
git mv design/redesign/mockups/theme/tokens.light.json frontend/tokens/tokens.light.json
```

- [ ] **Step 2: Install the generator.** (Style Dictionary path.)

```bash
cd frontend
pnpm add -D style-dictionary@^5
```

- [ ] **Step 3: Write the generator.** Create `frontend/scripts/build-tokens.mjs`. It registers a custom format that emits Tailwind's `@theme` block for the base/dark tokens plus a `[data-theme="light"]` block from the light file. (Namespaces: colors → `--color-*`, type sizes → `--text-*`, font families → `--font-*`, weights → `--font-weight-*`, radii → `--radius-*`, spacing → `--spacing-*`, container widths → `--container-*`, shadows → `--shadow-*`, easings → `--ease-*`, durations → kept as plain `--duration-*` in the block.) Map each DTCG token's resolved value to the exact CSS variable name the current app uses (e.g. `semantic.color.surface.card` → `--color-surface-card`). Composite handling: expand `typography` field-by-field; emit `shadow`/`cubicBezier` as single values; emit `gradient` as a plain var.

> **Implementation note for the engineer:** the variable NAME each token must produce is dictated by `scripts/__parity__/index.baseline.css` — that file is the contract for names + values. Use it as the checklist. SD's `name/kebab` transform plus an explicit `nameMap` for the handful of tokens whose DTCG path doesn't kebab to the legacy name (e.g. `accent.on-accent` → `--color-accent-contrast`, `accent.hover` already matches) keeps names aligned. Keep a `// chosen: style-dictionary v5` (or Terrazzo) comment at the top.

- [ ] **Step 4: Add the build script.** In `frontend/package.json` `"scripts"`:

```json
"tokens:build": "node scripts/build-tokens.mjs"
```

- [ ] **Step 5: Generate.**

Run: `cd frontend && pnpm tokens:build`
Expected: `frontend/src/styles/tokens.generated.css` is written with an `@theme { … }` block and a `[data-theme="light"] { … }` block.

- [ ] **Step 6: Run the parity harness — the tool-decision gate.**

Run: `cd frontend && pnpm tokens:parity`
Expected at THIS stage: **zero `CHANGED`** in both scopes (every token already present in `tokens.json` reproduces its `index.css` value exactly). `MISSING` is expected and large (all the orphan categories not yet added — shadows, motion, gradients, toggle-orb, parchment, brand, material, badge-text, overlay, layout, legacy aliases). If any `CHANGED` appears, fix the generator (or switch to Terrazzo per the decision rule) until zero.

- [ ] **Step 7: Commit.**

```bash
git add frontend/tokens frontend/scripts/build-tokens.mjs frontend/src/styles/tokens.generated.css frontend/package.json frontend/pnpm-lock.yaml
git commit -m "build(tokens): generator emits @theme from tokens.json (atoms at parity)"
```

---

## Tasks 3–10: Parity expansion by category

> **Pattern for every task below (the rhythm):** add the category to `frontend/tokens/tokens.json` (and `tokens.light.json` where it has light values) per the tier-mapping in the spec §3 → `pnpm tokens:build` → `pnpm tokens:parity` → confirm those vars moved from `MISSING` to clean (zero `CHANGED`) → commit. **Values are copied verbatim from `scripts/__parity__/index.baseline.css`** (dark) and its `[data-theme="light"]` block (light). The harness is the authority on completeness — work each category until its vars no longer appear under `MISSING`.

### Task 3: Shadows (semantic, role-named, + light)

**Files:** Modify `frontend/tokens/tokens.json`, `frontend/tokens/tokens.light.json`, `frontend/scripts/build-tokens.mjs` (route `semantic.shadow.*` → `--shadow-*`).

**Interfaces:** Produces CSS vars `--shadow-sm --shadow-md --shadow-lg --shadow-xl --shadow-glow` (dark + light). Per spec §3, shadows are **semantic** with light overrides; named by the existing keys to preserve the var names.

- [ ] **Step 1: Add `semantic.shadow` to `tokens.json`** with the dark values from the baseline:

```json
"shadow": {
  "sm":   { "$type": "shadow", "$value": "0 1px 2px rgba(0, 0, 0, 0.3)" },
  "md":   { "$type": "shadow", "$value": "0 4px 6px rgba(0, 0, 0, 0.4)" },
  "lg":   { "$type": "shadow", "$value": "0 10px 15px rgba(0, 0, 0, 0.5)" },
  "xl":   { "$type": "shadow", "$value": "0 20px 25px rgba(0, 0, 0, 0.6)" },
  "glow": { "$type": "shadow", "$value": "0 0 20px rgba(20, 184, 166, 0.15)" }
}
```

- [ ] **Step 2: Add the light overrides to `tokens.light.json`** (`semantic.shadow`): `sm 0 1px 2px rgba(0,0,0,0.06)` · `md 0 4px 6px rgba(0,0,0,0.08)` · `lg 0 10px 15px rgba(0,0,0,0.1)` · `xl 0 20px 25px rgba(0,0,0,0.12)` · `glow 0 0 20px rgba(15,150,136,0.1)`.

- [ ] **Step 3: Route in the generator** so `semantic.shadow.*` emits `--shadow-*` into `@theme` (dark) and `[data-theme="light"]`.

- [ ] **Step 4: Build + parity.**

Run: `cd frontend && pnpm tokens:build && pnpm tokens:parity`
Expected: the 5 `--shadow-*` no longer appear under `MISSING` in either scope; zero `CHANGED`.

- [ ] **Step 5: Commit.**

```bash
git add frontend/tokens frontend/scripts/build-tokens.mjs frontend/src/styles/tokens.generated.css
git commit -m "feat(tokens): shadows as semantic role tokens (dark+light) at parity"
```

### Task 4: Motion — primitive durations + easings → semantic roles

**Files:** Modify `tokens.json`, `build-tokens.mjs`.

**Interfaces:** Produces `--duration-fast --duration-normal --duration-slow` (parity) **plus** additive `--ease-standard --ease-decelerate --ease-accelerate` and semantic motion roles (additive — allowed as `EXTRA`). Per spec §3, durations/easings are **primitive**, composed into **semantic** motion roles. `index.css` only has the 3 durations; easings + roles are new (additive, not a parity requirement).

- [ ] **Step 1: Add `primitive.duration`** to `tokens.json`: `fast 150ms`, `normal 200ms`, `slow 300ms` (`$type: duration`).
- [ ] **Step 2: Add `primitive.easing`** (`$type: cubicBezier`): `standard [0.2, 0, 0, 1]`, `decelerate [0, 0, 0, 1]`, `accelerate [0.3, 0, 1, 1]`.
- [ ] **Step 3: Add `semantic.motion`** roles referencing them: `hover {duration: fast, easing: standard}`, `popover-enter {duration: normal, easing: decelerate}`, `toggle-slide {duration: normal, easing: standard}`, `tab-switch {duration: fast, easing: standard}`.
- [ ] **Step 4: Route the generator** so durations emit `--duration-fast|normal|slow` (preserving the existing names) and easings emit `--ease-*`.
- [ ] **Step 5: Build + parity.**

Run: `cd frontend && pnpm tokens:build && pnpm tokens:parity`
Expected: `--duration-*` gone from `MISSING`; `--ease-*` appear under `EXTRA` (additive, ok); zero `CHANGED`.

- [ ] **Step 6: Commit.**

```bash
git add frontend/tokens frontend/scripts/build-tokens.mjs frontend/src/styles/tokens.generated.css
git commit -m "feat(tokens): motion — durations at parity + new easing/role tokens"
```

### Task 5: Gradient-rail (component) + overlay-raise (semantic), both + light

**Files:** Modify `tokens.json`, `tokens.light.json`, `build-tokens.mjs`.

**Interfaces:** Produces `--gradient-rail` and `--color-overlay-raise` (dark + light).

- [ ] **Step 1:** Add `component.nav.rail-bg` (`$type: gradient` or string) = `linear-gradient(180deg, #0c0c14 0%, #090910 60%, #07070e 100%)`; light = `linear-gradient(180deg, #f3f4f8 0%, #eceef4 60%, #e7e9f1 100%)`.
- [ ] **Step 2:** Add `semantic.interaction.raise-haze` = `rgba(255, 255, 255, 0.03)`; light = `rgba(0, 0, 0, 0.03)`.
- [ ] **Step 3:** Route generator: `component.nav.rail-bg` → `--gradient-rail`; `semantic.interaction.raise-haze` → `--color-overlay-raise`.
- [ ] **Step 4: Build + parity.** Expected: both vars leave `MISSING` (dark + light); zero `CHANGED`.

Run: `cd frontend && pnpm tokens:build && pnpm tokens:parity`

- [ ] **Step 5: Commit.**

```bash
git add frontend/tokens frontend/scripts/build-tokens.mjs frontend/src/styles/tokens.generated.css
git commit -m "feat(tokens): rail gradient + overlay-raise (dark+light) at parity"
```

### Task 6: Toggle-orb (component, + light)

**Files:** Modify `tokens.json`, `tokens.light.json`, `build-tokens.mjs`.

**Interfaces:** Produces `--color-toggle-orb-on-start --color-toggle-orb-on-end --color-toggle-orb-off-start --color-toggle-orb-off-end` (dark + light).

- [ ] **Step 1:** Add `component.toggle.orb.{on-start,on-end,off-start,off-end}` — dark: `#1a1f28 / #0a0a0f / #1e1e26 / #121218`; light: `#d1d5db / #9ca3af / #e5e7eb / #d1d5db`.
- [ ] **Step 2:** Route generator → `--color-toggle-orb-*`.
- [ ] **Step 3: Build + parity.** Expected: the 4 vars leave `MISSING` (both scopes); zero `CHANGED`.

Run: `cd frontend && pnpm tokens:build && pnpm tokens:parity`

- [ ] **Step 4: Commit.**

```bash
git add frontend/tokens frontend/scripts/build-tokens.mjs frontend/src/styles/tokens.generated.css
git commit -m "feat(tokens): toggle-orb component tokens (dark+light) at parity"
```

### Task 7: Parchment / seal (semantic decorative surface, + light)

**Files:** Modify `tokens.json`, `tokens.light.json`, `build-tokens.mjs`.

**Interfaces:** Produces `--color-parchment-bg --color-parchment-raised --color-parchment-text --color-parchment-border --color-seal` (dark + light).

- [ ] **Step 1:** Add `semantic.surface.parchment.{bg,raised,text,border}` + `semantic.accent.seal` — dark: `#2d1e13 / #3d2a1a / #e8d9b8 / #b8933a` + seal `#8b6914`; light: `#f5ede0 / #e8d9b8 / #5a4422 / #b8933a` + seal `#8b6914`.
- [ ] **Step 2:** Route generator → `--color-parchment-*`, `--color-seal`.
- [ ] **Step 3: Build + parity.** Expected: 5 vars leave `MISSING` (both scopes); zero `CHANGED`.

Run: `cd frontend && pnpm tokens:build && pnpm tokens:parity`

- [ ] **Step 4: Commit.**

```bash
git add frontend/tokens frontend/scripts/build-tokens.mjs frontend/src/styles/tokens.generated.css
git commit -m "feat(tokens): parchment/seal decorative surface (dark+light) at parity"
```

### Task 8: Discord brand (primitive) + material exposure (semantic) + badge-text (semantic, light-only)

**Files:** Modify `tokens.json`, `tokens.light.json`, `build-tokens.mjs`.

**Interfaces:** Produces `--color-discord --color-discord-hover` (dark + light), `--color-material-{twine,glaze,solvent,tomestone}` (dark + light — `tokens.json` already has `primitive.color.material`; this exposes it at semantic so utilities generate), and `--color-gear-raid-text --color-gear-crafted-text --color-gear-augmented-text` (light-only).

- [ ] **Step 1:** Add `primitive.brand.{discord,discord-hover}` = `#5865F2 / #4752C4`; light override in `tokens.light.json` (discord `#5865F2`/hover `#4752C4` — confirm against baseline light block; if unchanged in light, still emit so the var exists). Expose `semantic.color.brand.{discord,discord-hover}` → primitive.
- [ ] **Step 2:** Add `semantic.color.material.{twine,glaze,solvent,tomestone}` referencing the existing `primitive.color.material.*`; add the light overrides to `tokens.light.json` (`#2563eb / #7c3aed / #ca8a04 / #ea580c`).
- [ ] **Step 3:** Add `semantic.color.text.{on-gear-raid,on-gear-crafted,on-gear-augmented}` — **light-only** in `tokens.light.json` = `#b91c1c / #9a3412 / #92400e`. (No dark value exists in the baseline; emit only under `[data-theme="light"]`.)
- [ ] **Step 4:** Route the generator → `--color-discord`, `--color-discord-hover`, `--color-material-*`, `--color-gear-raid-text`, `--color-gear-crafted-text`, `--color-gear-augmented-text`.
- [ ] **Step 5: Build + parity.** Expected: discord + material leave `MISSING` (dark + light); badge-text leave `MISSING` in **light** scope; zero `CHANGED`.

Run: `cd frontend && pnpm tokens:build && pnpm tokens:parity`

- [ ] **Step 6: Commit.**

```bash
git add frontend/tokens frontend/scripts/build-tokens.mjs frontend/src/styles/tokens.generated.css
git commit -m "feat(tokens): discord brand, material + badge-text exposure at parity"
```

### Task 9: Layout dimensions (primitive) + breakpoint

**Files:** Modify `tokens.json`, `build-tokens.mjs`.

**Interfaces:** Produces `--header-height --bottom-nav-height --layout-chrome --breakpoint-3xl`.

- [ ] **Step 1:** Add `primitive.size.{header,bottom-nav}` = `56px / 56px`; add `primitive.breakpoint.3xl` = `1400px`.
- [ ] **Step 2:** Route generator → `--header-height`, `--bottom-nav-height`, `--breakpoint-3xl`. Emit `--layout-chrome: calc(var(--header-height) + var(--bottom-nav-height))` as a literal derived line (matches baseline; it's a `calc()` of the two, not a token value).
- [ ] **Step 3: Build + parity.** Expected: all 4 leave `MISSING`; zero `CHANGED`.

Run: `cd frontend && pnpm tokens:build && pnpm tokens:parity`

- [ ] **Step 4: Commit.**

```bash
git add frontend/tokens frontend/scripts/build-tokens.mjs frontend/src/styles/tokens.generated.css
git commit -m "feat(tokens): layout dimensions + breakpoint at parity"
```

### Task 10: Legacy-alias shim (@deprecated) → zero parity

**Files:** Modify `build-tokens.mjs` (emit a clearly-marked deprecated alias block).

**Interfaces:** Produces the remaining legacy vars as aliases referencing semantic vars: `--color-bg-primary|secondary|card|elevated|hover` (dark + light), `--color-source-raid|tome|crafted|augmented`, `--color-accent-bright` (dark + light). After this task the parity harness must be **fully clean**.

- [ ] **Step 1:** In the generator, after the token-derived vars, emit a labeled block (a `/* @deprecated legacy aliases — remove as components migrate */` comment) with the exact alias lines from the baseline, e.g. `--color-bg-primary: var(--color-surface-base);`, `--color-source-raid: var(--color-gear-raid);`, `--color-accent-bright: #2dd4bf;` (dark) / `#0d7a6e` (light), etc. Copy each alias verbatim from `scripts/__parity__/index.baseline.css` (dark) and its light block.
- [ ] **Step 2: Build + FULL parity.**

Run: `cd frontend && pnpm tokens:build && pnpm tokens:parity`
Expected: **`[dark] clean` and `[light] clean`, `PARITY OK.`** — zero `CHANGED`, zero `MISSING`. (Only `EXTRA` additive tokens like `--ease-*` / motion roles remain, which is allowed.)

- [ ] **Step 3: Commit.**

```bash
git add frontend/scripts/build-tokens.mjs frontend/src/styles/tokens.generated.css
git commit -m "feat(tokens): legacy-alias shim — full parity reached"
```

---

## Task 11: Cut over `index.css` to the generated tokens

**Files:**
- Modify: `frontend/src/index.css` (remove the hand-written `@theme` + `[data-theme="light"]` blocks; `@import` the generated file)
- Modify: `frontend/scripts/__parity__/index.baseline.css` is **unchanged** (still the frozen target)

**Interfaces:** Consumes `frontend/src/styles/tokens.generated.css` (from Tasks 2–10). After this task, the app's resolved variables equal the baseline.

- [ ] **Step 1: Re-confirm full parity before touching `index.css`.**

Run: `cd frontend && pnpm tokens:build && pnpm tokens:parity`
Expected: `PARITY OK.` (If not, stop — a prior task is incomplete.)

- [ ] **Step 2: Edit `index.css`.** Replace the hand-written `@theme { … }` block AND the `[data-theme="light"] { … }` overrides with a single import at the top, immediately after `@import "tailwindcss";`:

```css
@import "tailwindcss";
@import "./styles/tokens.generated.css";
```

Keep everything else in `index.css` (the non-`@theme` rules: scrollbar styles, `.stagger-children`, base element styles, light-mode scrollbar overrides, etc.). Only the token-definition blocks move out. **Confirm exactly one `@theme` exists in the codebase afterward** (it now lives in the generated file).

- [ ] **Step 3: Verify exactly one `@theme`.**

Run: `cd frontend && grep -rn "@theme" src/ | grep -v tokens.generated.css`
Expected: no output (the only `@theme` is in the generated file).

- [ ] **Step 4: Parity against the LIVE index.css resolution.** Point the harness at the post-cutover `index.css` (which now imports the generated file). Since the harness reads a single file, verify instead that the generated file still matches the baseline AND the import is wired:

Run: `cd frontend && pnpm tokens:parity && grep -n "tokens.generated.css" src/index.css`
Expected: `PARITY OK.` and the import line present.

- [ ] **Step 5: Build the app — strict.**

Run: `cd frontend && pnpm build`
Expected: `tsc -b` clean, `vite build` succeeds with no Tailwind/`@theme` errors.

- [ ] **Step 6: Lint + design-system gate.**

Run: `cd frontend && pnpm lint && pnpm check:design-system`
Expected: both pass (no new violations).

- [ ] **Step 7: Visual spot-check (manual).** Start the dev server, load the app in dark and light, eyeball Home, Roster, a modal, the JoinRequest parchment scroll, and the Toggle orb. Confirm **no visible change**.

Run: `cd frontend && pnpm dev` (then open the app; toggle theme)
Expected: pixel-identical to before; no console errors about missing CSS vars.

- [ ] **Step 8: Commit.**

```bash
git add frontend/src/index.css
git commit -m "refactor(tokens): index.css imports generated @theme — single source of truth"
```

---

## Task 12: Rename `PageContainer` tiers to the rail-derived set

**Files:**
- Modify: `frontend/src/components/layout/PageContainer.tsx` (and its barrel `index.ts` if present)
- Modify: all call sites using the old `variant` values
- Modify: `frontend/src/pages/DesignSystem.tsx` (the Container System section, ~lines 2154–2159)
- Test: `frontend/src/components/layout/PageContainer.test.tsx` (create if absent)

**Interfaces:**
- Consumes: the new container tokens `--container-data|standard|focus|doc` (already in `tokens.json`).
- Produces: `PageContainer` accepts `variant: 'data' | 'standard' | 'focus' | 'doc'`. Old names `'wide' | 'narrow' | 'compact'` are accepted as **deprecated aliases** mapping to the nearest new tier (`wide → standard`, `narrow → focus`, `compact → doc`) so no call site breaks at once.

- [ ] **Step 1: Read the current component** to learn its exact prop shape and width mapping.

Run: `cat frontend/src/components/layout/PageContainer.tsx`
Expected: see the `variant` union + width class map.

- [ ] **Step 2: Write the failing test.** Create/extend `frontend/src/components/layout/PageContainer.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PageContainer } from './PageContainer';

describe('PageContainer tiers', () => {
  it('applies the new standard tier width', () => {
    const { container } = render(<PageContainer variant="standard">x</PageContainer>);
    expect(container.querySelector('.max-w-standard')).toBeTruthy();
  });
  it('maps the deprecated "wide" alias to standard', () => {
    const { container } = render(<PageContainer variant={'wide' as never}>x</PageContainer>);
    expect(container.querySelector('.max-w-standard')).toBeTruthy();
  });
});
```

(If the component applies inline `max-width` rather than a utility class, assert on the resolved style instead — adjust to the actual implementation seen in Step 1.)

- [ ] **Step 3: Run it — verify it fails.**

Run: `cd frontend && pnpm vitest run src/components/layout/PageContainer.test.tsx`
Expected: FAIL (no `standard` variant yet).

- [ ] **Step 4: Implement the rename.** Update the `variant` union to `'data' | 'standard' | 'focus' | 'doc'`; map each to the new container utility/width (`max-w-data` 2160 / `max-w-standard` 1760 / `max-w-focus` 1100 / `max-w-doc` 960). Add an internal alias map `{ wide: 'standard', narrow: 'focus', compact: 'doc' }` applied before lookup, with a `// deprecated alias` comment.

- [ ] **Step 5: Run the test — verify it passes.**

Run: `cd frontend && pnpm vitest run src/components/layout/PageContainer.test.tsx`
Expected: PASS.

- [ ] **Step 6: Migrate call sites.** Find and update them to the new names.

Run: `cd frontend && grep -rn "variant=\"\(data\|wide\|focus\|narrow\|compact\)\"" src --include=*.tsx | grep -i PageContainer` (and also check `PageContainer` usages without explicit variant)
Then change `wide→standard`, `narrow→focus`, `compact→doc` at each site (leave `data`/`focus` as-is).

- [ ] **Step 7: Update the DesignSystem Container System section** (`src/pages/DesignSystem.tsx` ~2154–2159) to list the new 4 tiers + values (`data 2160 / standard 1760 / focus 1100 / doc 960`) and drop the stale `wide/narrow/compact` rows and the `2560` figure.

- [ ] **Step 8: Build + test + lint.**

Run: `cd frontend && pnpm build && pnpm vitest run src/components/layout && pnpm lint`
Expected: all pass.

- [ ] **Step 9: Commit.**

```bash
git add frontend/src/components/layout frontend/src/pages/DesignSystem.tsx
git commit -m "refactor(layout): rename PageContainer tiers to rail-derived set (data/standard/focus/doc)"
```

---

## Task 13: CI guard — generated CSS must match source

**Files:**
- Modify: `frontend/package.json` (add `tokens:check`)
- Modify: the CI workflow that runs frontend checks (e.g. `.github/workflows/<frontend-ci>.yml`)
- Modify: `frontend/src/data/releaseNotes.ts` (internal entry)

**Interfaces:** Produces `pnpm tokens:check` = regenerate + fail on drift, runnable locally and in CI.

- [ ] **Step 1: Add the check script.** In `frontend/package.json` `"scripts"`:

```json
"tokens:check": "node scripts/build-tokens.mjs && git diff --exit-code -- src/styles/tokens.generated.css"
```

- [ ] **Step 2: Verify it passes on a clean tree.**

Run: `cd frontend && pnpm tokens:check`
Expected: exit 0, no diff.

- [ ] **Step 3: Verify it FAILS on drift (negative test).**

```bash
cd frontend
printf '\n/* drift */\n' >> src/styles/tokens.generated.css
pnpm tokens:check; echo "exit=$?"   # expect nonzero
git checkout -- src/styles/tokens.generated.css   # restore
```
Expected: nonzero exit on the drifted file, then restored.

- [ ] **Step 4: Wire into CI.** In the frontend CI workflow, add a step before/with the existing checks:

```yaml
      - name: Token source/output sync
        run: pnpm --filter ./frontend tokens:check
```

(Match the repo's actual workflow structure — locate the job that runs `check:design-system` and add the step alongside it. If it writes to PRs, the fork guard isn't needed here since this is read-only.)

- [ ] **Step 5: Add the internal release note.** In `frontend/src/data/releaseNotes.ts`, add to the latest entry's items (do **not** bump `CURRENT_VERSION`):

```ts
{ internal: true, category: 'chore', title: 'Tokenize the theme', description: 'Generate the app @theme from tokens.json with a CI drift guard; no visual change.' }
```

- [ ] **Step 6: Build + verify.**

Run: `cd frontend && pnpm build && pnpm tokens:check`
Expected: pass.

- [ ] **Step 7: Commit.**

```bash
git add frontend/package.json frontend/src/data/releaseNotes.ts .github/workflows
git commit -m "ci(tokens): guard generated @theme against source drift"
```

---

## Task 14: Reconcile doc-wording conflicts

**Files:**
- Modify: `design/redesign/DESIGN_SYSTEM.md`
- Modify: `design/redesign/REDESIGN_SPEC.md`

**Interfaces:** None (docs only). Aligns the redesign docs with what CI actually enforces.

- [ ] **Step 1: Fix the readable-floor wording.** In both docs, replace every "9px readable floor" / "9px floor" phrasing with: **"12px readable floor (`text-xs`); 9px is the hard floor for badge counts only."** (Matches `eslint-design-system-plugin.js` `no-tiny-text` and CLAUDE.md.) Locations: `DESIGN_SYSTEM.md §1.1` and the type-ramp note; `REDESIGN_SPEC.md §4.1` ("Readable floor: no text below 9px").

- [ ] **Step 2: Note the `surface-elevated` intent change.** In `DESIGN_SYSTEM.md §4.1`/§2.1 where surfaces are described, add a one-line note that **inputs now map to `surface-interactive`** (`#1e1e26`); `surface-elevated` (`#121218`) is for popovers/elevated cards (the value is unchanged; only the documented role moved).

- [ ] **Step 3: Note the container-width change.** Where either doc lists container tiers, confirm they read `data 2160 / standard 1760 / focus 1100 / doc 960` and that the old `2560/1920/1280` figures are gone (the spec §2.2 already says this; just verify no stale figure remains).

- [ ] **Step 4: Commit.**

```bash
git add design/redesign/DESIGN_SYSTEM.md design/redesign/REDESIGN_SPEC.md
git commit -m "docs(redesign): align floor (12px), surface-elevated intent, container tiers with enforcement"
```

---

## Task 15: Final verification + branch wrap

**Files:** none (verification only).

- [ ] **Step 1: Full parity, build, lint, tests, token-check — all green.**

Run:
```bash
cd frontend
pnpm tokens:build && pnpm tokens:parity   # PARITY OK.
pnpm tokens:check                          # no drift
pnpm build                                 # tsc -b + vite build clean
pnpm lint && pnpm check:design-system      # clean
pnpm vitest run                            # full suite green (incl. parity + PageContainer tests)
```
Expected: every command passes.

- [ ] **Step 2: Confirm single `@theme` + no stray hardcoded blocks.**

Run: `cd frontend && grep -rn "@theme" src | grep -v tokens.generated.css`
Expected: no output.

- [ ] **Step 3: `git diff --check`** for whitespace errors.

Run: `git diff --check`
Expected: no output.

- [ ] **Step 4: Summarize for review.** Confirm the spec §10 success criteria are all met: tokens model everything index.css had; generated `@theme` replaces the hand block (single `@theme`); parity diff zero unexpected changes; build/lint/design-system green; `PageContainer` migrated; doc-wording fixed; legacy aliases preserved as deprecated; CI rejects generated-vs-source drift.

---

## Self-Review

**Spec coverage (`specs/2026-06-27-...` + roadmap F1):**
- §3 token-tier mapping → Tasks 3–10 (every category placed per the locked tiers). ✓
- §4 build pipeline (SD v5 / Terrazzo, single `@theme`, generated-matches-source guard) → Tasks 2, 11, 13. ✓
- §5 light-gap closure → the `tokens.light.json` steps in Tasks 3,5,6,7,8 + the harness's light scope. ✓
- §6 in-scope sub-items (PageContainer rename, doc-wording, legacy-alias shim) → Tasks 12, 14, 10. ✓
- §7 verification / no-regression gate → Tasks 1 (harness), 11 (cutover gate), 15 (final). ✓
- §10 success criteria → Task 15 Step 4 checklist. ✓
- Container-tier change (the one expected diff) → Task 12; not a parity failure because container vars are additive/renamed, not in the 157-var baseline under old names. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". The one deliberate judgment point — SD vs Terrazzo — is resolved by an objective rule + gate in Task 2, not left open. Orphan-category values are given verbatim; the harness is the completeness authority. ✓

**Type/name consistency:** `pnpm tokens:build` → `frontend/src/styles/tokens.generated.css` and `pnpm tokens:parity` are referenced identically across Tasks 2–15. `PageContainer` variant union `'data'|'standard'|'focus'|'doc'` consistent in Task 12. CSS var names are pinned to `scripts/__parity__/index.baseline.css` throughout. ✓

**Known judgment points flagged for the executor:** (a) Task 2 tool choice (rule + gate provided); (b) Task 12 assertion style depends on whether `PageContainer` uses utility classes vs inline width (Step 1 reads the real component first); (c) Task 13 CI step must match the repo's actual workflow file (located at execution).
