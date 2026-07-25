# F3 — Component Contracts + Illegal-States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make illegal UI states uncompilable on the high-value existing shared primitives (Button's decorative trailing arrow and unlabeled icon-only button become type errors), reconcile `DESIGN_SYSTEM.md` to the components that actually ship (bless, don't purge), and fold in the cheap token-AA fixes F2 logged.

**Architecture:** Surgical, type-first changes to `Button`/`IconButton` + doc reconciliation in `DESIGN_SYSTEM.md` + verify (not rebuild) the already-constrained primitives + two light-token AA edits. `tsc -b` is the primary gate; new guarantees are proven by `@ts-expect-error` type-tests. No `assertNever` ceremony (the codebase uses exhaustive `Record<Variant, T>` lookups that already make a missing variant a compile error). No variant purges, no consumer-cascading refactors, no `/docs/design-system` page rebuild.

**Tech Stack:** TypeScript 5.9 (strict, `tsc -b` project build), React 19, Vitest, Tailwind 4, the F1 token pipeline (`tokens.json`/`tokens.light.json` → `pnpm tokens:build` → `tokens.generated.css`, guarded by `pnpm tokens:check`).

## Global Constraints

- **No AI attribution** in commits or PRs — no "Co-Authored-By", no "Generated with". Absolute. (`CLAUDE.md`)
- **Bless, don't purge** — all 8 Button variants and 4 IconButton variants are in real use; reconcile the contract *to* them. Never remove a variant (consumer cascade + visual change).
- **No `assertNever` ceremony** — exhaustiveness is already enforced by `Record<Variant, string>`; prove it with a type-test, don't convert Records to switches.
- **Bounded migrations only** — the trailing-element change is 9 sites; the children-required change is sized by `tsc -b` and falls back to a lint-warn if it exceeds ~15.
- **Branch:** `redesign/f3-component-contracts` off `redesign/foundation` @ `2ffde63`; PR into foundation, squash-merge. Nothing targets `main`.
- **CI gates this PR** (F2 added `redesign/**` triggers) — every task leaves the tree green under `pnpm build && pnpm lint && pnpm check:design-system:strict && pnpm test && pnpm tokens:check`.
- **`tsc -b` ≠ `tsc --noEmit`** — verify with `pnpm build` (project build mode), which is stricter.
- **Release-notes rule:** the type/contract work is `{ internal: true }`; the token-AA fix (Task 5) is user-visible → a public item + `CURRENT_VERSION` bump. Do **not** touch the frozen F1 parity baseline (`scripts/__parity__/index.baseline.css`).
- **No `/docs/design-system` page rebuild, no unbuilt-component contracts** (those are F6/post-F6).

**Authority:** `design/redesign/specs/2026-06-28-f3-component-contracts-design.md` (the spec), `design/redesign/DESIGN_SYSTEM.md` (the canon being reconciled), `FOUNDATION_ROADMAP.md` (F3 in context).

---

## File Structure

| File | Responsibility |
|---|---|
| `frontend/src/components/primitives/Button.tsx` | Add lexicon-bound `trailing` prop (replaces `rightIcon`); require `children` (Task 3). |
| `frontend/src/components/primitives/Button.type-test.tsx` | `@ts-expect-error` assertions: non-lexicon trailing fails; childless Button fails; missing Record variant fails. |
| `frontend/src/components/primitives/Button.test.tsx` | Behavioral: `trailing="chevron"`/`"external"` render the right glyph. |
| `frontend/src/components/primitives/IconButton.tsx` | No code change (verify exhaustive Record + required aria-label). |
| ~9 call sites (see Task 2) | Migrate `rightIcon=` → `trailing=` or remove decorative arrow. |
| childless-Button call sites (Task 3, `tsc`-enumerated) | Migrate icon-only → `IconButton`, or add a visible label. |
| `frontend/src/components/ui/{Tag,Tabs,LinkText,TriStateToggle}.tsx` | Verify type-safety; minimal fix only if unsafe. |
| `frontend/src/components/ui/Tag.type-test.tsx` | `@ts-expect-error`: `variant="label"` + `onClick` fails; `LinkText` `href`+`onClick` fails. |
| `frontend/tokens/tokens.light.json` | Light `membership-owner`/`gear-tome` → AA; default/hover accent distinction. |
| `frontend/src/styles/tokens.generated.css` | Regenerated (build artifact; via `pnpm tokens:build`). |
| `design/redesign/DESIGN_SYSTEM.md` | §3.1 blessed Button set; new IconButton contract; Tag/Tabs documented as DU exemplars. |
| `frontend/src/data/releaseNotes.ts` | Internal entry (type/contract) + public item (token-AA) + version bump. |

---

## Task 1: Reconcile contracts in DESIGN_SYSTEM.md + exhaustiveness type-test

**Files:**
- Modify: `design/redesign/DESIGN_SYSTEM.md` (§3.1 Button, add IconButton contract, note Tabs)
- Create: `frontend/src/components/primitives/Button.type-test.tsx` (the exhaustiveness assertion only; trailing/children assertions are added in Tasks 2–3)

**Interfaces:**
- Produces: an updated §3.1 that lists the 8 blessed Button variants grouped (intent/status/other), a new IconButton contract subsection, and a type-test file proving the Record pattern is exhaustive. Tasks 2–3 append to `Button.type-test.tsx`.

- [ ] **Step 1: Update DESIGN_SYSTEM.md §3.1 Button — bless the real variant set.** Replace the "Variants (the only legal set)" line so it documents all 8 shipped variants, grouped, with a note that the set is intentionally broader than v2's 4:

```markdown
- **Variants (the blessed set — all in real use, reconciled from the shipped component):**
  - **Intent:** `primary` (one accent-filled per region) · `secondary` (interactive surface) · `ghost` (text + hover overlay)
  - **Status:** `danger` (destructive) · `warning` · `success`
  - `accent-subtle` (low-emphasis accent) · `link` (inline text link affordance)
  *(All eight have live consumers; the contract is reconciled to the component, not the reverse. Exhaustiveness is compiler-enforced by the `Record<ButtonVariant, string>` style map — adding a variant without a style is a build error.)*
```

- [ ] **Step 2: Add an IconButton contract subsection** to DESIGN_SYSTEM.md (after §3.1, renumber nothing — insert as a labeled block under §3.1 or a new §3.1a). Content:

```markdown
### 3.1a IconButton

- **Anatomy:** square tap target (44×44 min on touch), single icon, no visible label.
- **Variants (blessed set):** `default` · `primary` · `ghost` · `danger`. Sizes `sm|md|lg`.
- **Required by type:** `aria-label: string` and `icon: ReactNode` are mandatory props — an unlabeled icon button cannot be constructed. This is the canonical home for icon-only actions; a `Button` must carry a visible text label (see §3.1).
- **Exhaustiveness:** compiler-enforced via `Record<IconButtonVariant, string>`.
```

- [ ] **Step 3: Note Tabs in §2.4 / §3** as a constrained primitive (no `href` API by design). Add one line where tab patterns are described:

```markdown
`Tabs` is an **in-surface view switch only** — it has no `href`/route API by construction, so a tab can never masquerade as navigation (route changes use `LinkText`/`NavRow`). It is a discriminated-union exemplar alongside `Tag`.
```

- [ ] **Step 4: Create the exhaustiveness type-test.** Create `frontend/src/components/primitives/Button.type-test.tsx`:

```tsx
/**
 * Type-level tests for Button's compile-time guarantees. This file is never
 * imported at runtime; `tsc -b` (pnpm build) type-checks it. Each
 * `@ts-expect-error` MUST error — if the guarantee regresses, the unused
 * directive makes the build fail.
 *
 * eslint-disable is fine here: these are deliberately ill-typed snippets.
 */
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment */
import type { ButtonVariant } from './Button';

// Exhaustiveness: a Record over the variant union must list every member.
// Omitting one is a compile error (proving the Record enforces exhaustiveness).
// @ts-expect-error - 'link' (and others) intentionally omitted -> missing keys
const _incompleteVariantMap: Record<ButtonVariant, string> = {
  primary: '', secondary: '', ghost: '', danger: '', warning: '', success: '', 'accent-subtle': '',
};

export {};
```

> If `ButtonVariant` is not exported from `Button.tsx`, export it (`export type ButtonVariant = …` — it already is per the current file). Confirm in Step 5.

- [ ] **Step 5: Verify the type-test is checked and behaves.**

Run: `cd frontend && pnpm build`
Expected: build PASSES — the `@ts-expect-error` is *consumed* (the incomplete Record genuinely errors, so the directive is valid). To confirm it's actually being type-checked (not silently skipped), temporarily complete the Record (add `link: ''`) and re-run `pnpm build`: it must now FAIL with "Unused '@ts-expect-error'". Revert.

- [ ] **Step 6: Lint.**

Run: `cd frontend && pnpm lint`
Expected: clean (the type-test file's eslint-disable covers its deliberate issues).

- [ ] **Step 7: Commit.**

```bash
git add design/redesign/DESIGN_SYSTEM.md frontend/src/components/primitives/Button.type-test.tsx
git commit -m "docs(design-system): bless real Button/IconButton variant sets + exhaustiveness type-test"
```

---

## Task 2: Constrain Button's trailing element to the glyph lexicon

**Files:**
- Modify: `frontend/src/components/primitives/Button.tsx`
- Modify (migrate `rightIcon=` → `trailing=` or remove): `src/components/schedule/ScheduleTab.tsx:1037`, `src/components/static-group/ObjectiveCommandCenter.tsx:208`, `src/components/wizard/steps/ShareStep.tsx:95`, `src/components/wizard/WizardNavigation.tsx:51` & `:80`, `src/pages/DesignSystem.tsx:860,1740,1764,1788`
- Modify: `frontend/src/components/primitives/Button.type-test.tsx` (append trailing assertion)
- Test: `frontend/src/components/primitives/Button.test.tsx`

**Interfaces:**
- Consumes: nothing from Task 1 except the file existing.
- Produces: `Button` accepts `trailing?: 'chevron' | 'external'` and no longer accepts `rightIcon`. `trailing="chevron"` renders a `ChevronDown` (the canonical disclosure glyph); `trailing="external"` renders an `ExternalLink`. `leftIcon` is unchanged.

- [ ] **Step 1: Write the behavioral test.** Create/extend `frontend/src/components/primitives/Button.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from './Button';

describe('Button trailing element', () => {
  it('renders a chevron glyph for trailing="chevron"', () => {
    const { container } = render(<Button trailing="chevron">Open</Button>);
    expect(container.querySelector('svg.lucide-chevron-down')).toBeTruthy();
  });
  it('renders an external glyph for trailing="external"', () => {
    const { container } = render(<Button trailing="external">Docs</Button>);
    expect(container.querySelector('svg.lucide-external-link')).toBeTruthy();
  });
  it('renders no trailing glyph by default', () => {
    const { container } = render(<Button>Save</Button>);
    expect(container.querySelector('svg.lucide-chevron-down,svg.lucide-external-link')).toBeNull();
  });
});
```

> Lucide adds `lucide-<name>` classes to its SVGs; if the project's Lucide version uses a different class scheme, assert on a `data-testid` you add to the rendered glyph instead (decide in Step 3 after seeing the render).

- [ ] **Step 2: Run it — verify it fails.**

Run: `cd frontend && pnpm vitest run src/components/primitives/Button.test.tsx`
Expected: FAIL (no `trailing` prop yet).

- [ ] **Step 3: Implement the constrained prop in `Button.tsx`.** Replace `rightIcon?: ReactNode` in `ButtonProps` with `trailing?: 'chevron' | 'external'`; import the two glyphs; render the mapped glyph in the trailing slot:

```tsx
import { ChevronDown, ExternalLink } from 'lucide-react';
// ...in ButtonProps: remove `rightIcon?: ReactNode;` and add:
  /** Trailing affordance, lexicon-bound: 'chevron' = disclosure/opens-in-place, 'external' = leaves the app. */
  trailing?: 'chevron' | 'external';
// ...in the destructure: replace `rightIcon` with `trailing`
// ...in the JSX trailing slot, replace `{!loading && rightIcon}` with:
        {!loading && trailing === 'chevron' && <ChevronDown className="w-4 h-4" aria-hidden />}
        {!loading && trailing === 'external' && <ExternalLink className="w-4 h-4" aria-hidden />}
```

- [ ] **Step 4: Run the behavioral test — verify it passes.**

Run: `cd frontend && pnpm vitest run src/components/primitives/Button.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Migrate the 9 call sites.** Per the spec §4.3 dispositions:
  - **External (mechanical → `trailing="external"`):** `ScheduleTab.tsx:1037`, `ShareStep.tsx:95`, `WizardNavigation.tsx:51` — replace `rightIcon={<ExternalLink … />}` with `trailing="external"` (remove the now-unused `ExternalLink` import if it has no other use in the file).
  - **Chevron demos (mechanical → `trailing="chevron"`):** `DesignSystem.tsx:1740,1764,1788` — replace `rightIcon={<ChevronDown … />}` with `trailing="chevron"`.
  - **ChevronRight (JUDGMENT — read each site):** `ObjectiveCommandCenter.tsx:208` and `WizardNavigation.tsx:80`. Read the surrounding code: if the chevron indicates **disclosure / opens-in-place** → `trailing="chevron"`; if it's a **decorative "next/forward"** arrow → **remove it entirely** (no trailing), per §4.1's removal of decorative directional arrows. State your determination for each in the report.
  - **USD demo (rework):** `DesignSystem.tsx:860` — `rightIcon={<span>USD</span>}` is a showcase of an input-adornment, not a Button trailing meaning. Rework that demo (e.g. show it as a `NumberInput`/input-group adornment) or remove the demo line. Do **not** add `USD` to the lexicon.

- [ ] **Step 6: Append the trailing type-test** to `Button.type-test.tsx`:

```tsx
import { Button } from './Button';
import { createElement } from 'react';
// A non-lexicon trailing value is a type error (decorative arrows unrepresentable).
// @ts-expect-error - 'arrow' is not in the 'chevron' | 'external' lexicon
const _badTrailing = createElement(Button, { trailing: 'arrow' }, 'x');
// `rightIcon` no longer exists on Button.
// @ts-expect-error - rightIcon was removed in favor of the constrained `trailing`
const _noRightIcon = createElement(Button, { rightIcon: null }, 'x');
```

- [ ] **Step 7: Full build + tests + lint.**

Run: `cd frontend && pnpm build && pnpm vitest run src/components/primitives && pnpm lint`
Expected: all green; no remaining `rightIcon=` on `Button` anywhere — confirm:
Run: `cd frontend && grep -rn "rightIcon=" src --include=*.tsx`
Expected: no output (all migrated).

- [ ] **Step 8: Commit.**

```bash
git add frontend/src/components/primitives/Button.tsx frontend/src/components/primitives/Button.test.tsx frontend/src/components/primitives/Button.type-test.tsx src/components/schedule/ScheduleTab.tsx src/components/static-group/ObjectiveCommandCenter.tsx src/components/wizard frontend/src/pages/DesignSystem.tsx
git commit -m "feat(button): lexicon-bound trailing prop (chevron|external) replaces free rightIcon"
```

> If `git add` paths differ (monorepo root vs frontend), add with `git add -A frontend/src && git add design/redesign` style; verify `git status` shows only the intended files.

---

## Task 3: Require a visible label on Button (icon-only → IconButton)

**Files:**
- Modify: `frontend/src/components/primitives/Button.tsx` (make `children` required)
- Modify: the `tsc`-enumerated childless-Button call sites
- Modify: `frontend/src/components/primitives/Button.type-test.tsx` (append childless assertion)
- *(fallback)* Modify: `frontend/eslint-design-system-plugin.js` + `eslint.config.js` if the count exceeds the threshold

**Interfaces:**
- Consumes: `Button` from Task 2.
- Produces: `Button` requires `children` (a visible label); icon-only buttons must use `IconButton`. OR (fallback) a `design-system/button-needs-label` lint warning if the migration is too large.

- [ ] **Step 1: Make `children` required.** In `ButtonProps`, change the implicit optional `children` to required. Since `ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>` (where `children?` is optional), add an explicit required override:

```tsx
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visible text label — required. Icon-only actions use <IconButton>. */
  children: ReactNode;
  // ...rest unchanged
}
```

- [ ] **Step 2: Enumerate the violations with the compiler.**

Run: `cd frontend && pnpm build 2>&1 | grep -A1 "children" | grep -E "\.tsx" | sort -u`
(Or just `pnpm build` and read every error about a missing `children` on a `Button`.)
Expected: a list of N call sites that construct `<Button>` with no children. **Record N.**

- [ ] **Step 3: Decide the path by N (the size gate).**
  - **N == 0:** no migration needed — the requirement is free. Skip to Step 5.
  - **N ≤ 15:** migrate each. For each violation, read the site:
    - **Truly icon-only** (only a `leftIcon`, no text intended) → convert `<Button leftIcon={<X/>} … />` to `<IconButton icon={<X/>} aria-label="…" … />` (IconButton already requires the label; choose an accurate label). Map `variant`/`size` to IconButton's set (`default|primary|ghost|danger`, `sm|md|lg`).
    - **Should have a visible label** → add the text child.
  - **N > 15:** do NOT absorb the cascade. Revert Step 1 (make `children` optional again). Instead add a lint rule `design-system/button-needs-label` at **warn** that flags a `<Button>` with no text child, and a one-line note in `eslint.config.js` + DESIGN_SYSTEM.md that the type-level enforcement is deferred. Document N and the decision in the report.

- [ ] **Step 4: Apply the chosen migration** (Step 3's icon-only→IconButton / add-label edits, OR the lint-warn fallback).

- [ ] **Step 5: Append the childless type-test** (only if the type requirement landed — skip if you took the lint-warn fallback). In `Button.type-test.tsx`:

```tsx
// A Button with no visible label is a type error (use IconButton for icon-only).
// @ts-expect-error - children is required
const _noLabel = createElement(Button, { leftIcon: null });
```

- [ ] **Step 6: Build + tests + lint + design-system.**

Run: `cd frontend && pnpm build && pnpm test && pnpm lint && pnpm check:design-system:strict`
Expected: all green. (`pnpm test` ensures the icon-only→IconButton migrations didn't break component tests.)

- [ ] **Step 7: Commit.**

```bash
git add -A frontend/src
git commit -m "feat(button): require a visible label; icon-only actions migrate to IconButton"
```

(If the lint-warn fallback was taken, the message is `feat(lint): warn on label-less Button (type enforcement deferred, N>15)` and include the eslint files.)

---

## Task 4: Verify the constrained primitives (no rebuild)

**Files:**
- Read/verify: `frontend/src/components/ui/Tag.tsx`, `Tabs.tsx`, `LinkText.tsx`, `TriStateToggle.tsx`
- Create: `frontend/src/components/ui/Tag.type-test.tsx`
- Modify (only if genuinely unsafe): the relevant primitive
- Modify: `design/redesign/DESIGN_SYSTEM.md` (§3.3 confirm; cross-link Tag/Tabs as exemplars)

**Interfaces:**
- Produces: confirmation (and a type-test) that the constrained primitives enforce their semantics; documentation of Tag + Tabs as the DU exemplars.

- [ ] **Step 1: Read each primitive and confirm its type-safety.** For each of `Tag`, `Tabs`, `LinkText`, `TriStateToggle`: confirm illegal prop combinations are unrepresentable. Expected findings (verify against the code):
  - `Tag`: `variant: 'label' | 'filter' | 'nav'` with `onClick?: never`/`href?: never`/`pressed?: never` guards — a label tag can't take `onClick`; a nav tag requires `href` xor `onNavigate`. ✓ exemplar.
  - `Tabs`: no `href` API; controlled `value`/`onChange`; `role="tablist"`/`tab`. ✓
  - `LinkText`/`NavRow`: `{ href; onClick?: never } | { href?: never; onClick }` xor union. ✓
  - `TriStateToggle`: `TriState` union + `Record<TriState, string>` labels. ✓ exhaustive.
  Document in the report what you verified. Apply a **minimal** fix only if something is actually unsafe; otherwise change no component code.

- [ ] **Step 2: Create the type-test** `frontend/src/components/ui/Tag.type-test.tsx`:

```tsx
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment */
import { createElement } from 'react';
import { Tag } from './Tag';
import { LinkText } from './LinkText';

// A label tag cannot be clickable.
// @ts-expect-error - onClick is `never` on variant="label"
const _labelClick = createElement(Tag, { variant: 'label', onClick: () => {} }, 'x');
// A nav tag must have a destination.
// @ts-expect-error - variant="nav" requires href or onNavigate
const _navNoDest = createElement(Tag, { variant: 'nav' }, 'x');
// LinkText cannot be both href and onClick.
// @ts-expect-error - href xor onClick
const _bothLink = createElement(LinkText, { href: '/x', onClick: () => {} }, 'x');

export {};
```

> Adjust prop names to the real exports if they differ (e.g. `LinkText`'s exact prop shape — confirm against the file read in Step 1).

- [ ] **Step 3: Build + lint.**

Run: `cd frontend && pnpm build && pnpm lint`
Expected: green; the `@ts-expect-error`s are all consumed (each illegal combo genuinely errors). If any `@ts-expect-error` reports "unused", that combo is NOT actually guarded → either the primitive is unsafe (fix it, minimally) or the assertion is wrong (fix the assertion). Resolve and note which.

- [ ] **Step 4: Document the exemplars** in DESIGN_SYSTEM.md §3.3 (Tag) — add a sentence that Tag and Tabs are the canonical discriminated-union exemplars, and that `*.type-test.tsx` files lock the guarantees.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/components/ui/Tag.type-test.tsx design/redesign/DESIGN_SYSTEM.md
git commit -m "test(ui): type-tests lock Tag/LinkText DU guarantees; document exemplars"
```

(If Step 1 required a minimal safety fix to a component, add that file and reflect it in the message.)

---

## Task 5: Token-AA fixes (light membership-owner / gear-tome / accent hover)

**Files:**
- Modify: `frontend/tokens/tokens.light.json`
- Modify: `frontend/src/styles/tokens.generated.css` (via `pnpm tokens:build`)

**Interfaces:**
- Produces: light `--color-membership-owner`, `--color-gear-tome` at WCAG AA; a perceptibly distinct light `--color-accent-hover`.

- [ ] **Step 1: Find the three light values in `tokens.light.json`.** Current generated light values: `--color-membership-owner: #0f9688`, `--color-gear-tome: #0f9688`, `--color-accent: #0c7d71`, `--color-accent-hover: #0d7a6e`. Locate their source entries in `tokens.light.json` (membership + gear roles; `semantic.color.accent.hover`).

- [ ] **Step 2: Fix membership-owner + gear-tome.** Set both light values from `#0f9688` to **`#0c7d71`** (the AA-compliant accent the F2 fix established — `#0f9688` fails AA as text on light, `#0c7d71` passes at ~4.65:1). Add a `$description` noting the F3 AA lift.

- [ ] **Step 3: Fix the accent hover distinction.** Light `--color-accent: #0c7d71` (rgb 12,125,113) and `--color-accent-hover: #0d7a6e` (rgb 13,122,110) are near-identical. Set hover to a perceptibly darker teal — start with **`#0a6b60`** (rgb 10,107,96): clearly darker than default, lighter than `accent-muted` (#0a5c58), preserving the teal hue. (Hover-as-text on light is darker → contrast only improves, stays ≥AA.) Add a `$description`.

- [ ] **Step 4: Regenerate + check drift.**

Run: `cd frontend && pnpm tokens:build && pnpm tokens:check`
Expected: `tokens.generated.css` updates the three light vars; `tokens:check` exits 0 (generated matches source, committed).

- [ ] **Step 5: Verify AA + no contrast regression.** Confirm `#0c7d71` and `#0a6b60` on the light surfaces meet AA (4.5:1 for normal text) — compute the ratios against `#f5f5f8`/`#ffffff` (membership/gear are normal-weight text). Then re-run the F2 contrast harness to ensure no asserted view regressed:

Run: `cd frontend && pnpm test:contrast` *(requires the dev stack on :5174/:8001; if not running, note it and rely on the manual ratio check)*
Expected: the asserted views (landing dark+light) stay green.

- [ ] **Step 6: Build + lint.**

Run: `cd frontend && pnpm build && pnpm lint`
Expected: green.

- [ ] **Step 7: Commit.**

```bash
git add frontend/tokens/tokens.light.json frontend/src/styles/tokens.generated.css
git commit -m "fix(tokens): light membership-owner/gear-tome + accent hover to WCAG AA / distinct hover"
```

---

## Task 6: Release note + final verification + branch wrap

**Files:**
- Modify: `frontend/src/data/releaseNotes.ts`

**Interfaces:** none (verification only). **Do not push or open a PR** — that follows the final whole-branch review.

- [ ] **Step 1: Add the release-notes entries.** Read `releaseNotes.ts` (current `CURRENT_VERSION` and the latest entry shape — F2 left it at `2.0.1`). Add a new entry (bump to the next patch, e.g. `2.0.2`) with:
  - A **public** `improvement` item for the token-AA fix — description like: "Owner/tome role colors and the accent hover state now meet WCAG AA contrast in light mode." Use real commit SHAs or omit `commits` (never `hash: 'pending'`).
  - An **`internal: true`** item for the type/contract hardening — description like: "Button trailing element constrained to the icon lexicon, Button now requires a visible label (icon-only → IconButton), and the design-system contracts were reconciled with type-tests."
  - Set `CURRENT_VERSION` to the new version (the discord-changelog test requires it equal the latest non-internal entry version).

- [ ] **Step 2: Full local gate.**

Run:
```bash
cd frontend
pnpm build
pnpm lint
pnpm check:design-system:strict
pnpm test
pnpm tokens:check
pnpm dupes
```
Then from repo root: `git diff --check`.
Expected: every command green; no whitespace errors.

- [ ] **Step 3: Verify the release-notes tests pass.**

Run: `cd frontend && pnpm vitest run src/data && cd ../scripts && npm test`
Expected: green (CURRENT_VERSION matches the latest non-internal entry).

- [ ] **Step 4: Confirm scope discipline.**

Run: `cd "D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner" && git diff --stat 2ffde63..HEAD`
Expected: changes confined to the target primitives, their type-tests/tests, the ~9+childless migration sites, `tokens.light.json`/generated CSS, `DESIGN_SYSTEM.md`, `releaseNotes.ts`. No `/docs/design-system` rebuild, no new unbuilt-component contracts, no variant removed from any `*Variant` union.

- [ ] **Step 5: Summarize for the final review.** Confirm spec §9 success criteria: variants blessed (none removed); trailing lexicon-bound + 9 sites migrated; children required (or lint-warn fallback documented with N); Records exhaustive + type-tests present; constrained primitives verified; token-AA met + parity baseline untouched; all gates green; release note added; no AI attribution.

---

## Self-Review

**Spec coverage:**
- §4.1 bless variants → Task 1 Step 1. ✓
- §4.2 exhaustiveness via Records + type-test (no assertNever) → Task 1 Steps 4–5. ✓
- §4.3 trailing lexicon constraint + 9-site migration (incl. 2 judgment + USD demo) → Task 2. ✓
- §4.4 require children, compiler-gated with ≤15/lint-warn fallback → Task 3. ✓
- §5 IconButton contract entry (no code change) → Task 1 Step 2. ✓
- §6 verify constrained primitives + Tag/Tabs exemplars → Task 4. ✓
- §7 token-AA (membership-owner/gear-tome + hover) → Task 5. ✓
- §8 testing (tsc -b gate, @ts-expect-error, behavioral) → Tasks 1–4 type-tests + Task 2 behavioral. ✓
- §9 success criteria → Task 6 Step 5. ✓

**Placeholder scan:** No "TBD"/"similar to Task N". The judgment points each carry a decision rule + the command to gather facts: the 2 ChevronRight sites (Task 2 Step 5 — read-and-decide), the children-required size gate (Task 3 Step 3 — N-based branch), the Lucide class-name assertion (Task 2 Step 1 note — fall back to data-testid). ✓

**Type/name consistency:** `trailing?: 'chevron' | 'external'` is identical across Task 2 (impl), its type-test, and §9. `children: ReactNode` required is consistent in Task 3 + its type-test. `Button.type-test.tsx` is appended-to across Tasks 1→2→3 (one file, growing). Token values (`#0c7d71`, `#0a6b60`) consistent in Task 5 + criteria. ✓

**Known judgment points flagged for the executor:** (a) Task 2 — the 2 `ChevronRight` sites (disclosure vs decorative) and the USD demo rework; (b) Task 3 — the `tsc`-measured N drives migrate-vs-lint-warn; (c) Task 2 Step 1 — Lucide SVG class scheme may need a `data-testid` fallback; (d) Task 5 — `#0a6b60` hover is a starting value, verify the luminance delta reads as distinct.
