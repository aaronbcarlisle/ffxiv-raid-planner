# F2 — Anti-Regression Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the machine-enforcement layer of the redesign foundation — duplication/dead-code visibility, an import boundary, a11y/contrast netting, and a ratcheted design-system lint — and make `ci.yml` actually gate phase PRs into `redesign/foundation`.

**Architecture:** Tooling + ESLint config changes + one bounded shared-layer cleanup. Each tool lands as its own reviewable task: install → configure → script → baseline/gate. The design-system lint ratchets only where the surface is already clean (or made clean): two rules globally, four color/typography/interaction rules on the shared layer. Existing duplication and the 638-violation legacy backlog are baselined, not fixed (they belong to F6 rebuilds).

**Tech Stack:** pnpm, ESLint 9 flat config, `jscpd`, `knip`, `eslint-plugin-boundaries`, `eslint-plugin-jsx-a11y`, `@axe-core/playwright` (+ existing `@playwright/test`), Vite 7, GitHub Actions.

## Global Constraints

- **No AI attribution** in commits or PRs — no "Co-Authored-By", no "Generated with". Absolute. (`CLAUDE.md`)
- **Branch:** all work on `redesign/f2-anti-regression` (already created off `redesign/foundation` @ `4da1ec6`); PR into `redesign/foundation`, squash-merge. Nothing targets `main`.
- **F2 self-gates:** for same-repo `pull_request` events GitHub uses the workflow on the **PR head branch** and filters on the **base** branch, so once Task 1 lands the trigger, the full CI suite runs on the F2 PR itself. Every task must leave the tree green under `pnpm build && pnpm lint && pnpm check:design-system:strict && pnpm test && pnpm tokens:check`.
- **F2 is NOT "zero visual change"** — Task 7 makes a few small *intentional* appearance tweaks (bumping sub-12px readable text to the `text-xs` floor) in `ItemHoverCard`, `MobileBottomNav`, `ViewModeToggle`. Legitimate badge/count text keeps 9px via `design-system-ignore: <reason>`.
- **Conservative cleanup only:** delete/fix code on **surviving** surfaces. Never clean dead code or violations that exist only because they live on an F6-doomed screen (`MorePage`, Loot Log, old Schedule) — baseline and leave them.
- **Release-notes rule:** this PR touches `frontend/` → add an `{ internal: true }` entry to `releaseNotes.ts`; do **not** bump `CURRENT_VERSION`. (`CLAUDE.md`)
- **Verify with `pnpm build`** (`tsc -b && vite build`) — stricter than `tsc --noEmit`.
- **pnpm pinned to v9** in CI (existing `pnpm/action-setup` version).

**Authority:** `design/redesign/specs/2026-06-28-f2-anti-regression-scaffolding-design.md` (the spec), `FOUNDATION_ROADMAP.md §2/§3` (F2 scope + adopt/defer), `DESIGN_SYSTEM.md` (the canon being enforced).

---

## File Structure

| File | Responsibility |
|---|---|
| `.github/workflows/ci.yml` | Add `redesign/**` to push + PR triggers; add jscpd gate + knip (report-only) steps. |
| `frontend/.jscpd.json` | jscpd config: scope `src/`, exclusions, pinned `threshold`. |
| `frontend/knip.json` | knip config: entry points + project globs. |
| `frontend/eslint.config.js` | Add boundaries plugin+rule, jsx-a11y (warn global / error shared), test-file exclusion, design-system ratchet. |
| `frontend/package.json` | Add `dupes`, `deadcode`, `test:contrast` scripts + dev deps. |
| `frontend/e2e/contrast.spec.ts` | Local axe contrast harness (reuses `e2e/helpers/auth.ts`). |
| `frontend/src/components/{ui,primitives}/*` | The 13 shared-layer violation fixes (Task 7). |
| `design/redesign/baselines/F2-jscpd.md` | Committed duplication baseline (the debt as a number). |
| `design/redesign/baselines/F2-knip.md` | Committed dead-code baseline. |
| `frontend/src/data/releaseNotes.ts` | Internal release-note entry. |

---

## Task 1: Gate phase PRs — `ci.yml` runs on `redesign/**`

**Files:**
- Modify: `.github/workflows/ci.yml:3-7`

**Interfaces:**
- Produces: CI triggers on `push` and `pull_request` to `main` **and** `redesign/**`. Later tasks add steps into the existing `frontend` job.

- [ ] **Step 1: Read the current triggers.**

Run: `sed -n '1,9p' .github/workflows/ci.yml`
Expected: `branches: [main]` under both `push` and `pull_request`.

- [ ] **Step 2: Widen both branch filters.** Replace lines 3–7:

```yaml
on:
  push:
    branches: [main, 'redesign/**']
  pull_request:
    branches: [main, 'redesign/**']
```

- [ ] **Step 3: Validate YAML.**

Run: `cd frontend && npx js-yaml ../.github/workflows/ci.yml > /dev/null && echo OK`
Expected: `OK` (parses cleanly). If `js-yaml` isn't available, run `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('OK')"` from the repo root.

- [ ] **Step 4: Commit.**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run the suite on PRs targeting redesign/** so phase PRs are gated"
```

---

## Task 2: jscpd — duplication baseline + fail-on-new gate

**Files:**
- Create: `frontend/.jscpd.json`
- Create: `design/redesign/baselines/F2-jscpd.md`
- Modify: `frontend/package.json` (`dupes` script + dev dep)
- Modify: `.github/workflows/ci.yml` (jscpd step in `frontend` job)

**Interfaces:**
- Produces: `pnpm dupes` → runs jscpd over `frontend/src`, fails if duplication exceeds the pinned `threshold`. The committed baseline records the current percentage.

- [ ] **Step 1: Install jscpd.**

Run: `cd frontend && pnpm add -D jscpd`
Expected: added to `devDependencies`.

- [ ] **Step 2: Measure current duplication.**

Run: `cd frontend && npx jscpd src --reporters console --ignore "**/*.test.ts,**/*.test.tsx,**/__tests__/**,src/gamedata/**,src/styles/tokens.generated.css" --gitignore`
Expected: a summary table ending with a clones/percentage line, e.g. `(X.XX%)`. **Record the reported percentage** — call it `P`.

- [ ] **Step 3: Write `.jscpd.json`.** Pin `threshold` to `ceil(P)` (the smallest whole percent ≥ current, so the existing backlog passes but new duplication above it fails). Create `frontend/.jscpd.json`:

```json
{
  "threshold": 0,
  "minLines": 5,
  "minTokens": 50,
  "reporters": ["console"],
  "gitignore": true,
  "absolute": true,
  "ignore": [
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/__tests__/**",
    "src/gamedata/**",
    "src/styles/tokens.generated.css",
    "e2e/**"
  ]
}
```

Set `"threshold"` to the `ceil(P)` value from Step 2 (e.g. if `P = 2.3`, use `3`). If `P` rounds to `0`, leave `0` (any new clone fails).

- [ ] **Step 4: Add the `dupes` script.** In `frontend/package.json` `"scripts"`:

```json
"dupes": "jscpd src"
```

- [ ] **Step 5: Verify it passes on the current tree.**

Run: `cd frontend && pnpm dupes`
Expected: exit 0 — current duplication is at or below the pinned threshold.

- [ ] **Step 6: Negative test — a new clone fails the gate.** Temporarily duplicate a sizable block:

```bash
cd frontend
cp src/config.ts src/__dup_probe_a.ts
cp src/config.ts src/__dup_probe_b.ts
pnpm dupes; echo "exit=$?"   # expect nonzero if config.ts is >minLines
rm src/__dup_probe_a.ts src/__dup_probe_b.ts
```
Expected: nonzero exit while the probes exist, then removed. (If `config.ts` is too small to trip `minLines`, duplicate a larger file such as `src/components/ui/SearchableSelect.tsx`.)

- [ ] **Step 7: Write the baseline record.** Create `design/redesign/baselines/F2-jscpd.md`:

```markdown
# F2 duplication baseline (jscpd)

- Captured: 2026-06-28 on `redesign/f2-anti-regression`.
- Scope: `frontend/src` (excludes tests, gamedata, generated CSS, e2e).
- Current duplication: **P%** (pinned `threshold` in `frontend/.jscpd.json` = ceil(P)).
- Policy: gate fails on duplication ABOVE the threshold (new copy-paste). The
  existing backlog is intentionally not deduped here — dedupe happens at F3/F4/F6
  when the duplicated components are rebuilt.
```

Replace `P%` and `ceil(P)` with the measured values.

- [ ] **Step 8: Wire the CI gate.** In `.github/workflows/ci.yml`, in the `frontend` job after the `Build` step, add:

```yaml
      - name: Duplication check (jscpd)
        run: pnpm dupes
```

- [ ] **Step 9: Commit.**

```bash
git add frontend/.jscpd.json frontend/package.json frontend/pnpm-lock.yaml design/redesign/baselines/F2-jscpd.md .github/workflows/ci.yml
git commit -m "ci(dupes): jscpd baseline + fail-on-new-above-threshold gate"
```

---

## Task 3: knip — dead-code baseline (report-only)

**Files:**
- Create: `frontend/knip.json`
- Create: `design/redesign/baselines/F2-knip.md`
- Modify: `frontend/package.json` (`deadcode` script + dev dep)
- Modify: `.github/workflows/ci.yml` (knip report step, non-blocking)

**Interfaces:**
- Produces: `pnpm deadcode` → runs knip; lists unused files/exports/deps. CI runs it `continue-on-error: true` (report-only — knip's signal is noisier than a count gate).

- [ ] **Step 1: Install knip.**

Run: `cd frontend && pnpm add -D knip`
Expected: added to `devDependencies`.

- [ ] **Step 2: Write `knip.json`.** Create `frontend/knip.json`:

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": [
    "src/main.tsx",
    "vite.config.ts",
    "eslint.config.js",
    "eslint-design-system-plugin.js",
    "scripts/*.{mjs,ts}",
    "e2e/**/*.spec.ts"
  ],
  "project": ["src/**/*.{ts,tsx}"],
  "ignore": ["src/gamedata/**", "src/styles/tokens.generated.css"]
}
```

- [ ] **Step 3: Add the `deadcode` script.** In `frontend/package.json` `"scripts"`:

```json
"deadcode": "knip"
```

- [ ] **Step 4: Run it and capture the report.**

Run: `cd frontend && pnpm deadcode | tee /tmp/knip-report.txt; echo "exit=$?"`
Expected: a report of unused files / exports / dependencies. Non-zero exit is expected (knip exits non-zero when it finds anything) — that's why CI runs it non-blocking.

- [ ] **Step 5: Write the baseline record.** Create `design/redesign/baselines/F2-knip.md` summarizing the counts from Step 4:

```markdown
# F2 dead-code baseline (knip)

- Captured: 2026-06-28 on `redesign/f2-anti-regression`.
- Unused files: N · unused exports: N · unused deps: N · unlisted deps: N.
- Policy: report-only in CI (`continue-on-error`). Truly app-orphaned code is
  deleted in the next task; dead code that exists only because it lives on an
  F6-doomed screen (MorePage, Loot Log, old Schedule) is NOT deleted — it goes
  away when the screen is rebuilt (F6).

## Findings (raw)

<paste the knip report here>
```

Fill in the real counts and paste the report under "Findings (raw)".

- [ ] **Step 6: Wire the non-blocking CI step.** In `.github/workflows/ci.yml`, in the `frontend` job after the jscpd step, add:

```yaml
      - name: Dead-code report (knip, non-blocking)
        continue-on-error: true
        run: pnpm deadcode
```

- [ ] **Step 7: Commit.**

```bash
git add frontend/knip.json frontend/package.json frontend/pnpm-lock.yaml design/redesign/baselines/F2-knip.md .github/workflows/ci.yml
git commit -m "ci(deadcode): knip config + committed baseline + report-only CI step"
```

---

## Task 4: knip — conservative deletion of truly-orphaned code

**Files:**
- Delete/modify: source files knip flags as unused — **only those that are app-orphaned and NOT on F6-doomed screens**.

**Interfaces:**
- Consumes: the `pnpm deadcode` report from Task 3.
- Produces: a smaller tree with no behavior change; `pnpm build` + `pnpm test` stay green.

- [ ] **Step 1: Re-run knip and triage each "unused files" / "unused exports" entry.**

Run: `cd frontend && pnpm deadcode`
For each finding, classify:
- **DELETE** — an export/file with no consumer anywhere in `src/` or `e2e/`, on a **surviving** surface.
- **KEEP (doomed)** — dead only because its screen is F6-doomed (`MorePage`, `GearSyncDashboard`/Loot Log, `ScheduleUpcomingPanel`/old Schedule). Leave it.
- **KEEP (false positive)** — referenced dynamically, via barrel, or by config/tooling knip can't see (e.g. lazy `import()`, test-only util). Leave it; if noisy, add to `knip.json` `ignore`.

- [ ] **Step 2: Verify each DELETE candidate has zero real references before removing.** For each, confirm:

Run: `cd frontend && grep -rn "<exportName>" src e2e --include=*.ts --include=*.tsx | grep -v "<the-defining-file>"`
Expected: no output (truly orphaned) → safe to delete. Any hit → KEEP.

- [ ] **Step 3: Delete the confirmed-orphaned code.** Remove the dead exports/files identified in Steps 1–2. Make one logical change at a time.

- [ ] **Step 4: Rebuild + test after deletions.**

Run: `cd frontend && pnpm build && pnpm test`
Expected: `tsc -b` clean (no "cannot find module"), vite build succeeds, tests green.

- [ ] **Step 5: Re-run knip to confirm the deleted items are gone and nothing new broke.**

Run: `cd frontend && pnpm deadcode`
Expected: the deleted entries no longer listed; no new unused exports introduced by the deletions.

- [ ] **Step 6: Update the knip baseline counts** in `design/redesign/baselines/F2-knip.md` to reflect the post-deletion state (note what was deleted vs. deliberately kept-doomed).

- [ ] **Step 7: Commit.**

```bash
git add -A
git commit -m "refactor(deadcode): delete truly-orphaned exports/files (doomed-screen code left for F6)"
```

> If Step 1 finds **no** safely-deletable code (all findings are doomed-screen or false positives), record that in the baseline and skip Steps 3–7 with an empty commit-free note — the task still passes; the conservative policy means zero deletions is a valid outcome.

---

## Task 5: eslint-plugin-boundaries — shared layer must not import features

**Files:**
- Modify: `frontend/eslint.config.js`
- Modify: `frontend/package.json` (dev dep)

**Interfaces:**
- Produces: `boundaries/element-types` rule at `error` — files in `components/primitives/**` + `components/ui/**` may not import from feature/domain dirs, `pages/`, `stores/`, or `services/`.

- [ ] **Step 1: Install the plugin.**

Run: `cd frontend && pnpm add -D eslint-plugin-boundaries`
Expected: added to `devDependencies`.

- [ ] **Step 2 (if the installed major ≠ 5): confirm flat-config syntax via context7.** Fetch current `eslint-plugin-boundaries` docs (settings keys `boundaries/elements`, `boundaries/include`, rule `boundaries/element-types`) and adjust Step 3 to match the installed version. For v5 the config below is correct.

- [ ] **Step 3: Add the plugin, settings, and rule to `eslint.config.js`.** Add the import at the top:

```js
import boundaries from 'eslint-plugin-boundaries'
```

In the main `files: ['**/*.{ts,tsx}']` config object, add `boundaries` to `plugins`, add a `settings` block, and add the rule:

```js
    plugins: {
      'design-system': designSystemPlugin,
      boundaries,
    },
    settings: {
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'shared', pattern: 'src/components/(primitives|ui)/**' },
        { type: 'feature', pattern: 'src/components/!(primitives|ui)/**' },
        { type: 'app', pattern: '(src/pages|src/stores|src/services)/**' },
      ],
    },
    rules: {
      // ...existing rules unchanged...
      'boundaries/element-types': ['error', {
        default: 'allow',
        rules: [
          {
            from: ['shared'],
            disallow: ['feature', 'app'],
            message:
              'Shared layer (primitives/ui) must not import from ${dependency.type} modules. Keep the shared layer leaf-level; the Ring-aware graph lands in F4.',
          },
        ],
      }],
    },
```

- [ ] **Step 4: Lint the real tree — expect clean.**

Run: `cd frontend && pnpm lint`
Expected: no `boundaries/element-types` errors (the shared layer should not currently import features). If any fire, they are real violations — fix the import (move the shared usage down, or relocate the file out of the shared layer) and note it; do **not** weaken the rule.

- [ ] **Step 5: Negative test — prove the rule fires.** Temporarily add a feature import to a shared file:

```bash
cd frontend
# pick any real feature export; PlayerCard is under components/player (feature)
printf "\nimport { PlayerCard } from '../player/PlayerCard'\nvoid PlayerCard\n" >> src/components/ui/Skeleton.tsx
pnpm lint 2>&1 | grep "boundaries/element-types"; echo "saw-error=$?"
git checkout -- src/components/ui/Skeleton.tsx
```
Expected: the grep matches a `boundaries/element-types` error (`saw-error=0`), then the file is restored.

- [ ] **Step 6: Build to confirm no type/config breakage.**

Run: `cd frontend && pnpm build`
Expected: clean.

- [ ] **Step 7: Commit.**

```bash
git add frontend/eslint.config.js frontend/package.json frontend/pnpm-lock.yaml
git commit -m "lint(boundaries): shared layer (primitives/ui) cannot import features (error)"
```

---

## Task 6: Design-system lint — exclude tests + global ratchet

**Files:**
- Modify: `frontend/eslint.config.js`

**Interfaces:**
- Produces: design-system rules are **off** in test files; `no-raw-textarea` + `no-raw-select` are global `error`.

- [ ] **Step 1: Add a test-file exclusion block.** Append a config object to the array in `eslint.config.js` that turns the design-system rules off for tests (mirrors `check-design-system.sh`'s test exclusion):

```js
  // Test files exercise raw elements and arbitrary values as fixtures; the
  // design-system rules target shipped UI, not test scaffolding. (Matches the
  // exclusion already in scripts/check-design-system.sh.)
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
    rules: {
      'design-system/no-raw-button': 'off',
      'design-system/no-raw-input': 'off',
      'design-system/no-raw-select': 'off',
      'design-system/no-raw-label': 'off',
      'design-system/no-raw-textarea': 'off',
      'design-system/no-arbitrary-color': 'off',
      'design-system/no-tiny-text': 'off',
      'design-system/no-noninteractive-onclick': 'off',
      'design-system/no-cursor-pointer-without-role': 'off',
    },
  },
```

- [ ] **Step 2: Ratchet the two clean rules to `error` globally.** In the main config object's `rules`, change:

```js
      'design-system/no-raw-select': 'error',
      'design-system/no-raw-textarea': 'error',
```

(Leave `no-raw-button`, `no-raw-input`, `no-raw-label` at `warn` — they still have legacy violations. The primitive-file off-block already overrides these for `primitives/**`.)

- [ ] **Step 3: Lint — expect green.**

Run: `cd frontend && pnpm lint`
Expected: no `no-raw-select` / `no-raw-textarea` errors (the only `no-raw-select` was in `WorldSelect.test.tsx`, now excluded; `no-raw-textarea` had zero).

- [ ] **Step 4: Commit.**

```bash
git add frontend/eslint.config.js
git commit -m "lint(design-system): exclude test files; ratchet no-raw-select/textarea to error"
```

---

## Task 7: Shared-layer cleanup + design-system error lock

**Files:**
- Modify: `frontend/src/components/ui/ItemHoverCard.tsx` (no-tiny-text ×2)
- Modify: `frontend/src/components/ui/MobileBottomNav.tsx` (no-arbitrary-color ×3, no-tiny-text ×2)
- Modify: `frontend/src/components/ui/ViewModeToggle.tsx` (no-tiny-text ×2)
- Modify: `frontend/src/components/ui/NumberInput.tsx` (no-arbitrary-color ×2)
- Modify: `frontend/src/components/ui/SearchableSelect.tsx` (no-raw-input ×1)
- Modify: `frontend/src/components/primitives/LongPressTooltip.tsx` (no-noninteractive-onclick ×2)
- Modify: `frontend/eslint.config.js` (shared-layer error override)

**Interfaces:**
- Produces: zero design-system violations in `primitives/**` + `ui/**` for the four color/typography/interaction rules; those rules locked to `error` for the shared layer.

> **Scope note:** the lock covers `no-arbitrary-color`, `no-tiny-text`, `no-noninteractive-onclick`, `no-cursor-pointer-without-role` — **not** the raw-element rules. Primitives legitimately use raw elements (the existing off-block), so raw-element rules must stay as configured. The 13 violations all fall under the four locked rules (plus one `no-raw-input` in `SearchableSelect`, fixed below).

- [ ] **Step 1: List the exact violations to fix.**

Run: `cd frontend && npx eslint src/components/primitives src/components/ui --format stylish 2>/dev/null | grep -A0 "design-system/"`
Expected: the 13 lines (ItemHoverCard, MobileBottomNav, ViewModeToggle, NumberInput, SearchableSelect, LongPressTooltip). Use this as the checklist.

- [ ] **Step 2: Fix `no-arbitrary-color` (MobileBottomNav ×3, NumberInput ×2).** For each flagged line, replace the hardcoded color with the matching semantic token utility (`text-accent`, `bg-surface-*`, `text-role-*`, etc. — see the map in `scripts/check-design-system.sh`). Read the line, identify the hex, swap to the token. If a color genuinely has no token, add `// design-system-ignore: <reason>` with justification.

- [ ] **Step 3: Fix `no-tiny-text` PER-CASE (ItemHoverCard ×2, MobileBottomNav ×2, ViewModeToggle ×2).** For each:
  - **Readable text below 12px** → bump the class to `text-xs` (12px floor). This is a small intentional appearance change — allowed.
  - **Legitimate badge/count** → keep the small size and add `// design-system-ignore: small badge count, 9px floor exception`.

  Read each line to decide which case applies; do not blanket-bump.

- [ ] **Step 4: Fix `no-raw-input` (SearchableSelect ×1).** Replace the raw `<input>` with the `Input` component if it fits the search field, OR add `// design-system-ignore: <reason>` if Radix/search behavior requires the native element (read the surrounding code to decide).

- [ ] **Step 5: Fix `no-noninteractive-onclick` (LongPressTooltip ×2).** A non-interactive element has an `onClick`. Either move the handler to a real interactive element (`button`/`IconButton`) or, if the element must stay non-interactive (e.g. a wrapper capturing long-press), add the appropriate role/keyboard handler or a justified `// design-system-ignore: <reason>`. Read the component to choose.

- [ ] **Step 6: Confirm the shared layer is clean.**

Run: `cd frontend && npx eslint src/components/primitives src/components/ui --format stylish 2>/dev/null | grep "design-system/" ; echo "remaining=$?"`
Expected: no output (`remaining=1` from grep = no matches). Zero design-system violations in the shared layer.

- [ ] **Step 7: Add the shared-layer error lock.** Append a config object to `eslint.config.js` (after the existing primitive off-block so it takes precedence for these four rules):

```js
  // Shared layer is the design system's own surface — lock the color/type/
  // interaction rules at error so it cannot regress (F3 rewrites these files).
  // Raw-element rules are intentionally NOT locked here: primitives use raw
  // elements by design (see the off-block above).
  {
    files: ['src/components/primitives/**/*.{ts,tsx}', 'src/components/ui/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'design-system/no-arbitrary-color': 'error',
      'design-system/no-tiny-text': 'error',
      'design-system/no-noninteractive-onclick': 'error',
      'design-system/no-cursor-pointer-without-role': 'error',
    },
  },
```

- [ ] **Step 8: Lint + build + test + design-system check.**

Run: `cd frontend && pnpm lint && pnpm check:design-system:strict && pnpm build && pnpm test`
Expected: all green; the shared-layer rules now error but the surface is clean.

- [ ] **Step 9: Commit.**

```bash
git add frontend/src/components frontend/eslint.config.js
git commit -m "fix(ui): clean 13 shared-layer design-system violations + lock primitives/ui at error"
```

---

## Task 8: jsx-a11y — recommended at warn, error on the clean shared layer

**Files:**
- Modify: `frontend/eslint.config.js`
- Modify: `frontend/package.json` (dev dep)
- Possibly modify: a few `primitives/**` / `ui/**` files (only if they have real a11y violations)

**Interfaces:**
- Produces: `eslint-plugin-jsx-a11y` recommended rules at `warn` globally; the same set at `error` for `primitives/**` + `ui/**` (after verifying/clearing that surface).

- [ ] **Step 1: Install the plugin.**

Run: `cd frontend && pnpm add -D eslint-plugin-jsx-a11y`
Expected: added to `devDependencies`.

- [ ] **Step 2: Add the plugin with recommended-at-warn globally.** Add the import:

```js
import jsxA11y from 'eslint-plugin-jsx-a11y'
```

Near the top of the config module (after imports), compute a warn-mapped copy of the recommended set:

```js
// jsx-a11y recommended, downgraded to warn for the legacy backlog. The shared
// layer re-locks these to error below (it is small and clean).
const a11yRecommendedWarn = Object.fromEntries(
  Object.keys(jsxA11y.flatConfigs.recommended.rules).map((rule) => [rule, 'warn']),
)
```

In the main `files: ['**/*.{ts,tsx}']` object: add `'jsx-a11y': jsxA11y` to `plugins`, and spread `...a11yRecommendedWarn` at the **top** of `rules` (so the explicit design-system entries that follow are unaffected).

- [ ] **Step 3: Measure the shared layer against the recommended set.**

Run: `cd frontend && npx eslint src/components/primitives src/components/ui --format stylish 2>/dev/null | grep "jsx-a11y/"`
Expected: a (likely short) list — `LongPressTooltip` is the prime suspect. Record each.

- [ ] **Step 4: Fix the real shared-layer a11y violations.** For each finding on these surviving components, apply the correct fix (add `aria-*`, a role, keyboard handler, or `alt`; or a justified `// eslint-disable-next-line jsx-a11y/<rule> -- <reason>` only where the lint is a genuine false positive). These are reused everywhere, so fixing them is high-leverage.

- [ ] **Step 5: Confirm the shared layer is a11y-clean.**

Run: `cd frontend && npx eslint src/components/primitives src/components/ui --format stylish 2>/dev/null | grep "jsx-a11y/"; echo "remaining=$?"`
Expected: no output (`remaining=1`).

- [ ] **Step 6: Lock jsx-a11y to error on the shared layer.** Extend the Task 7 shared-layer override block's `rules` with the recommended set at error:

```js
      // jsx-a11y locked on the shared layer (verified clean in F2).
      ...jsxA11y.flatConfigs.recommended.rules,
```

(Add this inside the existing `files: ['src/components/primitives/**', 'src/components/ui/**']` override from Task 7, alongside the four design-system rules.)

- [ ] **Step 7: Lint + build.**

Run: `cd frontend && pnpm lint && pnpm build`
Expected: green; jsx-a11y warns across legacy, errors only on the (clean) shared layer.

- [ ] **Step 8: Commit.**

```bash
git add frontend/eslint.config.js frontend/package.json frontend/pnpm-lock.yaml frontend/src/components
git commit -m "lint(a11y): jsx-a11y recommended at warn; error-locked on the clean shared layer"
```

---

## Task 9: axe contrast harness (local) — verify-then-assert

**Files:**
- Create: `frontend/e2e/contrast.spec.ts`
- Modify: `frontend/package.json` (`test:contrast` script + dev dep)

**Interfaces:**
- Consumes: existing `e2e/helpers/auth.ts` (`loginAsOwner`, `goToTestStatic`, `FRONTEND_BASE`).
- Produces: `pnpm test:contrast` → Playwright spec asserting zero `color-contrast` violations on views **observed green**. Local harness (like `smoke.spec.ts`); not wired into CI (the a11y CI gate is the jsx-a11y lint).

> **Prereqs (documented in the spec file header, matching `smoke.spec.ts`):** backend on `:8001` with `DEV_AUTH_MODE=true` + frontend on `:5174`. Theme is forced via `localStorage['theme']` (`'dark'`/`'light'`; the app reads `STORAGE_KEY='theme'` and sets `data-theme` on `<html>` — see `src/hooks/useTheme.ts`).

- [ ] **Step 1: Install `@axe-core/playwright`.**

Run: `cd frontend && pnpm add -D @axe-core/playwright`
Expected: added to `devDependencies`.

- [ ] **Step 2: Add the `test:contrast` script.** In `frontend/package.json` `"scripts"`:

```json
"test:contrast": "playwright test e2e/contrast.spec.ts"
```

- [ ] **Step 3: Write the harness.** Create `frontend/e2e/contrast.spec.ts`:

```ts
/**
 * Contrast net (local). Asserts zero WCAG color-contrast violations on the
 * most stable surfaces, in both themes. Durable deliverable = the harness;
 * the view list is revised in F6 as screens are rebuilt.
 *
 * Prerequisites (same as smoke.spec.ts):
 *   1. Backend on :8001 with DEV_AUTH_MODE=true  (only needed for seeded views)
 *   2. Frontend on :5174
 * Run: pnpm test:contrast
 */
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { FRONTEND_BASE, loginAsOwner, goToTestStatic } from './helpers/auth'

const THEMES = ['dark', 'light'] as const

async function forceTheme(page: import('@playwright/test').Page, theme: string) {
  await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme)
}

async function contrastViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withRules(['color-contrast'])
    .analyze()
  return results.violations
}

// Anchor: the design-system reference page — no auth/data, the most stable surface.
for (const theme of THEMES) {
  test(`design-system page has zero contrast violations (${theme})`, async ({ page }) => {
    await forceTheme(page, theme)
    await page.goto(`${FRONTEND_BASE}/docs/design-system`)
    await page.waitForLoadState('networkidle')
    const violations = await contrastViolations(page)
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
  })
}

// Anchor: the pre-auth landing/login surface — no seeded data required.
for (const theme of THEMES) {
  test(`landing page has zero contrast violations (${theme})`, async ({ page }) => {
    await forceTheme(page, theme)
    await page.goto(`${FRONTEND_BASE}/`)
    await page.waitForLoadState('networkidle')
    const violations = await contrastViolations(page)
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
  })
}

// Risk view: Home/GroupView (seeded). Home in LIGHT mode is where the known
// hardcoded-dark-card debt lives (FOUNDATION_ROADMAP §3.1). Verify-then-assert:
// run it; if a theme is red due to that pre-existing debt, narrow this block to
// the green theme(s) and leave a comment pointing at §3.1 + F6 — never assert red.
for (const theme of THEMES) {
  test(`group view has zero contrast violations (${theme})`, async ({ page, context }) => {
    await forceTheme(page, theme)
    await loginAsOwner(page, context)
    await goToTestStatic(page)
    await page.waitForLoadState('networkidle')
    const violations = await contrastViolations(page)
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
  })
}
```

> Confirm the `loginAsOwner` / `goToTestStatic` signatures against `e2e/helpers/auth.ts` in Step 4 and adjust the call shape if they differ (e.g. `loginAsOwner(page)` vs `(page, context)`).

- [ ] **Step 4: Read the auth helper to match signatures.**

Run: `cd frontend && grep -n "export" e2e/helpers/auth.ts`
Expected: the exported helper names + signatures. Adjust the GroupView test's calls to match exactly.

- [ ] **Step 5: Start the dev stack, then run the harness (verify-then-assert).**

Start backend + frontend (`./dev.ps1` from the repo root, or the user's running stack), then:
Run: `cd frontend && pnpm test:contrast`
Expected: the two anchor surfaces (design-system, landing) pass in both themes. For the GroupView tests: **observe the result.**
- All green → keep all four GroupView assertions.
- A theme is red **only** due to the §3.1 pre-existing hardcoded-dark-card debt → restrict the GroupView loop to the green theme(s) and add a comment: `// Home light-mode contrast deferred: pre-existing §3.1 debt, resolved at F6 rebuild.`
- A theme is red for a **new** reason F2 introduced → fix it (it's a regression).

Codify the spec to assert only what was observed green. Never commit a spec that asserts a red view.

- [ ] **Step 6: Final harness run — all asserted tests green.**

Run: `cd frontend && pnpm test:contrast`
Expected: PASS for every test the committed spec contains.

- [ ] **Step 7: Commit.**

```bash
git add frontend/e2e/contrast.spec.ts frontend/package.json frontend/pnpm-lock.yaml
git commit -m "test(a11y): axe contrast harness on stable surfaces (verify-then-assert)"
```

---

## Task 10: Release note + final verification + branch wrap

**Files:**
- Modify: `frontend/src/data/releaseNotes.ts`

**Interfaces:** none (verification only).

- [ ] **Step 1: Add the internal release note.** In `frontend/src/data/releaseNotes.ts`, add to the latest entry's items (do **not** bump `CURRENT_VERSION`):

```ts
{ internal: true, category: 'chore', title: 'Anti-regression scaffolding', description: 'jscpd duplication gate, knip dead-code baseline, import-boundary lint, jsx-a11y + axe contrast net, and a ratcheted design-system lint on the shared layer; phase PRs now run CI.' }
```

(Match the exact item shape used by neighboring entries — read the file first.)

- [ ] **Step 2: Full local gate — everything green.**

Run:
```bash
cd frontend
pnpm build                          # tsc -b + vite build
pnpm lint                           # incl. boundaries + jsx-a11y + ratcheted design-system
pnpm check:design-system:strict     # shell gate
pnpm test                           # unit/component suite
pnpm tokens:check                   # F1 drift guard still clean
pnpm dupes                          # at/below threshold
```
Expected: every command passes.

- [ ] **Step 3: Confirm the CI workflow has all F2 steps + the widened trigger.**

Run: `grep -nE "redesign/\*\*|jscpd|knip" .github/workflows/ci.yml`
Expected: the `redesign/**` triggers (push + PR), the `Duplication check (jscpd)` step, and the non-blocking `knip` step.

- [ ] **Step 4: `git diff --check`** for whitespace errors.

Run: `git diff --check`
Expected: no output.

- [ ] **Step 5: Commit + push + open the PR.**

```bash
git add frontend/src/data/releaseNotes.ts
git commit -m "docs(release-notes): internal entry for F2 anti-regression scaffolding"
git push -u origin redesign/f2-anti-regression
```
Open a PR **into `redesign/foundation`** (not `main`). Confirm CI runs on the PR (self-gating) and is green. No AI attribution in the PR body.

- [ ] **Step 6: Summarize for review.** Confirm the spec §8 success criteria are all met: ci.yml gates redesign PRs · jscpd baselined + fail-on-new · knip baselined + conservative deletion · boundaries rule at error w/ negative test · jsx-a11y warn global + error on clean shared layer · axe harness green on asserted views · design-system test-exclusion + global ratchet + shared-layer lock · 13 shared violations fixed · internal release note, no version bump, no AI attribution.

---

## Self-Review

**Spec coverage (`specs/2026-06-28-...`):**
- §4 CI gating → Task 1 (trigger) + jscpd/knip steps in Tasks 2–3; self-gating premise in Global Constraints + Task 10 Step 5. ✓
- §5.1 jscpd → Task 2 (baseline + fail-on-new + negative test). ✓
- §5.2 knip → Task 3 (baseline, report-only) + Task 4 (conservative deletion, doomed-screen exclusion). ✓
- §5.3 boundaries → Task 5 (one rule at error + negative test; Ring graph deferred). ✓
- §5.4 jsx-a11y + axe → Task 8 (lint, verify-then-assert shared-layer lock) + Task 9 (axe harness, verify-then-assert, local like smoke). ✓
- §5.5 ratchet + test-file fix → Task 6 (exclusion + global) + Task 7 (shared-layer lock). ✓
- §6 shared-layer cleanup (13, per-case no-tiny-text, NOT zero-visual-change) → Task 7. ✓
- §7/§8 verification + success criteria → Task 10. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". The judgment points (knip triage, no-tiny-text per-case, axe verify-then-assert, SearchableSelect/LongPressTooltip fix choice) each carry an explicit decision rule + the command to gather the facts, not a hand-wave. The one library-version dependency (boundaries flat-config syntax) is gated on context7 in Task 5 Step 2 with a concrete v5 default. ✓

**Type/name consistency:** `pnpm dupes` / `pnpm deadcode` / `pnpm test:contrast` referenced identically across tasks + Task 10. The shared-layer override `files` glob (`src/components/primitives/**`, `src/components/ui/**`) is the same in Tasks 7 and 8 (Task 8 extends the same block). The four locked design-system rules are the same list in §6/Task 7. axe helper names (`loginAsOwner`, `goToTestStatic`, `FRONTEND_BASE`) match `e2e/helpers/auth.ts` (verified in recon; re-confirmed in Task 9 Step 4). ✓

**Known judgment points flagged for the executor:** (a) jscpd threshold = ceil(measured P) — Task 2 Step 2/3; (b) knip deletion may be empty (valid outcome) — Task 4 note; (c) axe GroupView light-mode may hit §3.1 debt → narrow, never assert red — Task 9 Step 5; (d) boundaries syntax vs installed major — Task 5 Step 2.
