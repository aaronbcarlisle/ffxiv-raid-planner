# F2 — Anti-Regression Scaffolding · Design Spec

> **Phase:** F2 of the redesign foundation (`FOUNDATION_ROADMAP.md §2`).
> **Status:** design approved (2026-06-28); implementation plan to follow under `design/redesign/plans/`.
> **Authority:** `FOUNDATION_ROADMAP.md` (F2 scope + §0 reframe + §3 adopt/defer), `DESIGN_SYSTEM.md` (the canon being enforced), `CLAUDE.md` (CI rules, release-notes rule, no-AI-attribution).

## 1. Goal

Stand up the **machine-enforcement layer** the roadmap §0 names as the missing two-thirds of the foundation: tokens (F1) prevent nothing on their own; durable anti-drift needs *enforcement that runs without a second reviewer*. F2 installs that enforcement and — critically — **makes it actually gate the phase PRs that follow** (F3–F6 land into `redesign/foundation`, which today runs zero checks).

F2 is **scaffolding + enforcement, not a refactor.** It does not dedupe existing clones, does not clean the legacy color/tiny-text backlog, and does not touch surfaces F6 will rebuild. The one bounded exception is a justified cleanup of the **shared layer's own** violations (§7), because a design system whose primitives violate its rules cannot credibly lock anything.

## 2. Non-goals (deferred, with pointers)

- **Dedupe of existing duplication** → F3/F4/F6, where the duplicated components are rebuilt. F2 only *measures* and *fails-on-new*.
- **Ring-aware import boundary graph** (Ring-0 imports inward only, etc.) → F4, where the feature-slice structure is designed. F2 ships only the one rule that is already true (§5.3).
- **Legacy color/tiny-text cleanup** (638 violations across `static-group/`, `profile/`, `schedule/`, `split-clear/`, …) → resolved at F6 rebuild. F2 leaves these at `warn`.
- **Dead code on F6-doomed screens** (`MorePage`, Loot Log, old Schedule) → left untouched; deleted when the screen is. F2 *baselines* the findings but does not delete.
- **Visual-regression testing**, **Storybook**, **full a11y automation** → roadmap §3 "skip / adopt later."

## 3. Git & workflow

- Branch `redesign/f2-anti-regression` off `redesign/foundation` @ `4da1ec6`.
- PR into `redesign/foundation` → review-loop → **squash-merge**. Nothing targets `main` until `foundation → main` at the end.
- **No AI attribution** in commits/PRs (absolute, `CLAUDE.md`).
- Release-notes rule: this PR touches `frontend/` → add an `{ internal: true, category: 'chore', … }` entry to `releaseNotes.ts`; **do not** bump `CURRENT_VERSION`.

## 4. The CI-gating premise (load-bearing — read first)

`ci.yml` today triggers only on `push`/`pull_request` to `main`. Therefore **PRs into `redesign/foundation` currently run no checks** — F3–F6 would land ungated exactly when enforcement matters most. Fixing this is the first F2 deliverable, not an afterthought.

**Change:** add `redesign/**` alongside `main` to both the `push` and `pull_request` `branches` filters in `ci.yml`.

**Self-gating consequence (verified against GitHub semantics):** for **same-repo** `pull_request` events, the `branches:` filter matches on the PR's **base** (target) branch, and the workflow *definition* used is the one **on the PR head branch**. So once the F2 branch carries the `redesign/**` trigger and the PR targets `redesign/foundation`, **the full suite runs on the F2 PR itself.** F2 self-gates.

This flips the verification premise: F2 is **designed to be green under its own new checks**, not "verified locally only." Local verification still happens (nothing runs until first push), but day-one-green under CI is a hard requirement of this phase — including the new jscpd/knip/boundaries/a11y steps and the ratcheted lint.

> Fork-PR note: the new steps are read-only (no PR writes), so no fork guard is required. `pnpm` stays pinned to v9 per existing CI.

## 5. Workstreams

### 5.1 jscpd — duplication finder (baseline + fail-on-new)

- Add `jscpd` (dev dep) + `.jscpd.json` scoped to `frontend/src/`, excluding tests, `gamedata/`, generated CSS, and `*.stories`/fixtures.
- Script `pnpm dupes`. CI step runs jscpd in **threshold mode**: a committed baseline captures the current clone count; the gate fails only on duplication **above** that baseline. The existing backlog never fails CI; *new* copy-paste does.
- Output: a committed baseline report (the "update one, miss six" debt as a number). No source edits — dedupe is F3/F4/F6.

### 5.2 knip — dead-code finder (baseline + conservative deletion)

- Add `knip` (dev dep) + `knip.json` declaring entry points (`src/main.tsx`, `vite.config.ts`, `eslint.config.js`, `scripts/*.mjs`, test setup) and project globs.
- Script `pnpm deadcode`. CI step runs knip in **report-only** mode (no gate — knip's dead-code signal is noisier than jscpd's count, so a blocking gate would cause false-fail churn; revisit gating in a later phase).
- **Baseline all findings** to a committed report.
- **Conservative deletion pass:** delete only code that is **truly app-orphaned** (unused export/file with no consumer anywhere). **Do not delete** code that is dead only because it lives on an F6-doomed screen (`MorePage`, Loot Log, old Schedule) — same logic as duplication; it goes away when the screen does. Every deletion verified by `pnpm build` staying green.

### 5.3 eslint-plugin-boundaries — the one durable rule

- Install `eslint-plugin-boundaries`; declare element types for the layers.
- **One enforced rule at `error`:** files in `components/primitives/**` and `components/ui/**` may **not** import from feature/domain folders (`components/player/`, `loot/`, `schedule/`, `static-group/`, `history/`, `priority/`, `roster/`, …, plus `pages/`, `stores/`, `services/`). The shared layer stays leaf-level.
- The Ring-aware graph is **explicitly out of scope** (F4). A fixture test proves the rule fires on a violating import and passes on a legal one.

### 5.4 jsx-a11y + axe contrast scan

- Add `eslint-plugin-jsx-a11y`; enable the **recommended** set at `warn` globally (gradual-migration posture matching the design-system rules).
- **Shared-layer a11y lock (verify-then-assert):** the plan must first *measure* `primitives/**` + `ui/**` against the recommended set (cannot be measured until the plugin is installed). Fix the few genuine violations on these surviving components (LongPressTooltip's non-interactive `onClick` is the prime suspect — likely needs a real interactive element or a justified disable). **Then** add an override setting jsx-a11y recommended to `error` for `primitives/**` + `ui/**`. No `error` lock is written before the surface is observed clean.
- **Contrast harness:** a Playwright spec using `@axe-core/playwright` that loads views via the existing **dev-auth seed** (`/api/dev-auth/login/0` → DEVTST static) and asserts **zero `color-contrast` violations**.
  - **Verify-then-assert (hard gate):** the first axe task scans the candidate views and codifies an assertion **only for views observed green**. The harness — not the view list — is the durable deliverable; the list is revised in F6.
  - **Anchors (expected green):** Login, `/docs/design-system` (the most stable surface). **Risk view:** GroupView / Home in **light mode** — this is exactly where the known hardcoded-dark-card conformance debt lives (`FOUNDATION_ROADMAP.md §3.1`: GearSyncDashboard, ScheduleUpcomingPanel, MorePage). If Home scans clean it is included (dark + light); if it has a real light-mode contrast violation it is **scoped to dark-only or swapped** for another clean view — never asserted red.

### 5.5 Design-system lint ratchet (warn → error, honest scope)

Current backlog (measured): `no-tiny-text` 404, `no-arbitrary-color` 234, `no-noninteractive-onclick` 27, `no-raw-label` 21, `no-raw-button` 13, `no-cursor-pointer-without-role` 13, `no-raw-input` 9, `no-raw-select` 1 (test file only), `no-raw-textarea` 0.

- **Test-file exclusion fix:** align `eslint.config.js` to exclude `**/*.test.{ts,tsx}` (and `**/__tests__/**`) from the design-system rules, matching `check-design-system.sh`'s existing exclusion. The two enforcement surfaces must agree on scope. This clears the lone `no-raw-select` (a `WorldSelect.test.tsx` fixture) and prevents future test false-positives.
- **Globally → `error`:** `no-raw-textarea` (0) and `no-raw-select` (0 after the test-file fix).
- **Shared-layer → `error` (all design-system rules)** for `components/primitives/**` + `components/ui/**`, after the §6 cleanup makes them clean.
- **Everything else stays `warn`** — the 638 legacy violations are on F6-doomed surfaces; ratcheting them now is churn on doomed code. A comment in `eslint.config.js` records the per-area ratchet plan for F6.

## 6. Shared-layer cleanup (the bounded, in-scope exception)

Locking `primitives/`+`ui/` at `error` requires them to be clean; they currently carry **13 design-system violations** across 6 surviving components. Because these are the design system itself (reused everywhere, **not** F6-doomed), fixing them is high-leverage "improve the code you're working in," categorically different from the legacy backlog. It also guards F3, which rewrites these exact files.

| Rule | Files | Disposition |
|---|---|---|
| `no-tiny-text` | ItemHoverCard ×2, MobileBottomNav ×2, ViewModeToggle ×2 | **Per-case** (see caveat) |
| `no-arbitrary-color` | MobileBottomNav ×3, NumberInput ×2 | Replace hex with semantic token |
| `no-noninteractive-onclick` | LongPressTooltip ×2 | Real interactive element or justified `design-system-ignore`/disable |
| `no-raw-input` | SearchableSelect ×1 | Use `Input` or justified ignore (Radix/search constraint) |

**Caveat — `no-tiny-text` is a visual-change judgment, handled per-case, not blanket:**
- Genuinely readable text below the 12px floor → **fix it** (bump to `text-xs`). This is a small, *intentional* appearance change.
- Legitimate badge/count text → keep at 9px via the badge exception with `design-system-ignore: <reason>`.

**Therefore F2 is explicitly NOT "zero visual change"** — it makes a few small intentional appearance tweaks in ItemHoverCard / MobileBottomNav / ViewModeToggle. This is in-scope and expected (contrast with F1, which was strict parity).

## 7. Testing & verification

- **jscpd:** runs clean against the committed baseline; a deliberately-injected new clone fails the gate (negative test).
- **knip:** report generated; deletions each verified by `pnpm build` green.
- **boundaries:** fixture test — violating import errors, legal import passes; `pnpm lint` clean on real source.
- **jsx-a11y / axe:** shared layer measured + cleaned before the `error` lock; axe spec green on all asserted views (anchors + Home iff verified) in dark **and** light.
- **ratchet:** `pnpm lint` green at the new error levels (shared layer + the two global rules); legacy stays warn.
- **whole phase:** `pnpm build` (`tsc -b && vite build`), full `pnpm lint`, `pnpm check:design-system:strict`, `pnpm test`, `pnpm tokens:check` all green — locally **and** on the self-gating F2 PR.
- **release note:** `{ internal: true }` entry added; `CURRENT_VERSION` unchanged.
- **git diff --check** clean (no whitespace errors).

## 8. Success criteria

1. `ci.yml` runs the full suite on PRs targeting `redesign/**` (verified by the F2 PR itself executing CI).
2. jscpd installed, baselined, fails-on-new-above-baseline.
3. knip installed, all findings baselined; only truly-orphaned code deleted; doomed-screen dead code untouched.
4. `eslint-plugin-boundaries` enforces the shared-layer import rule at `error` with a passing fixture test.
5. `jsx-a11y` recommended at `warn` globally + `error` on a verified-clean shared layer; axe contrast harness green on every asserted view in both themes.
6. Design-system lint: test files excluded; `no-raw-textarea` + `no-raw-select` global `error`; all design-system rules `error` on the cleaned shared layer; legacy at `warn` with a documented F6 ratchet plan.
7. The 13 shared-layer violations fixed (with the per-case `no-tiny-text` dispositions documented).
8. Build/lint/design-system/test/tokens all green; internal release note added; no `CURRENT_VERSION` bump; no AI attribution.
