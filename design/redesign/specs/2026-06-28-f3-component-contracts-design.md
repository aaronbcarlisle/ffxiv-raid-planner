# F3 — Component Contracts + Illegal-States · Design Spec

> **Phase:** F3 of the redesign foundation (`FOUNDATION_ROADMAP.md §2`).
> **Status:** design approved (2026-06-28); implementation plan to follow under `design/redesign/plans/`.
> **Authority:** `FOUNDATION_ROADMAP.md` (F3 scope + §0 reframe), `DESIGN_SYSTEM.md` (the contracts being reconciled — the markdown is the real canon for F6), `CLAUDE.md` (CI rules, release-notes rule, no-AI-attribution).

## 1. Goal

Convert the foundation's **load-bearing type-safety** pillar (roadmap §0.1 — "types that refuse to compile the bad state") into reality on the *high-value existing* shared primitives, and reconcile `DESIGN_SYSTEM.md` to the components that actually ship.

**The governing principle: bless, don't purge.** Reconciliation means bending the *contract* to the real, legitimately-used component surface — not bending the code to an idealized contract. The illegal-states win comes from **discriminated-union types** (a decorative trailing arrow is unrepresentable; an unlabeled button doesn't compile), *not* from minimizing the variant count. Those are decoupled: F3 takes the type-safety (cheap, bounded, high-leverage) and explicitly avoids any consumer-cascading variant purge or visual change.

F3 targets only the primitives where types actually prevent misuse, and only bounded, grep/compiler-sized migrations. It does **not** rebuild components that already enforce their semantics, does **not** author contracts for unbuilt components, and does **not** rebuild the `/docs/design-system` page.

## 2. Non-goals (deferred, with pointers)

- **Variant purges / consumer-wide refactors** — never. All 8 Button variants and all 4 IconButton variants are in real use (measured); the contract is reconciled *to* them.
- **Contracts for not-yet-built components** (top bar, spine, ⌘K palette, availability heatmap, RSVP row, attention-list row, match-score listing, gear-board cell, track card, NavRow) → **F6**, written with each component as it's built. The markdown `DESIGN_SYSTEM.md §3.8` keeps them as proposals.
- **`/docs/design-system` page rebuild** (~4,500 lines) → **post-F6**. It should render the *final* F6 components; rebuilding it now documents a moving target. `DESIGN_SYSTEM.md` (markdown) is the real canon F6 builds from; the page is the showroom and may lag.
- **`§7` token-gap work that only supports unbuilt components** — `nav.*` component-tier tokens, motion tokens, density tokens → later (they serve the rail/overlays/Board built in F6).
- **Sweeping a11y or lint cleanup** beyond the bounded migrations the type changes force.

## 3. Git & workflow

- Branch `redesign/f3-component-contracts` off `redesign/foundation` @ `2ffde63`.
- PR into `redesign/foundation` → review-loop → **squash-merge** (same as F1/F2). Nothing targets `main`.
- **No AI attribution** in commits/PRs (absolute, `CLAUDE.md`).
- **CI now gates this PR** (F2 added `redesign/**` triggers) — design for day-one-green under the full suite.
- Release-notes rule: this PR touches `frontend/src/` → add a release-notes entry. The type/contract work is `{ internal: true }`. The token-AA fix (§7) is user-visible → a public item + `CURRENT_VERSION` bump (like F2's v2.0.1).

## 4. Button (the core)

### 4.1 Bless the real variant set
`DESIGN_SYSTEM.md §3.1` currently declares 4 legal variants; the component ships 8, **all in real use** (measured: `ghost` 150, `secondary` 127, `danger` 32, `primary` 31, `warning` 17, `success` 13, `accent-subtle` 12, `link` 5). Reconcile §3.1 to document the real set, grouped by role:
- **Intent:** `primary` · `secondary` · `ghost`
- **Status:** `danger` · `warning` · `success`
- `accent-subtle` · `link`

No variant is removed. The `ButtonVariant` union in code is unchanged in membership.

### 4.2 Exhaustiveness — already enforced by the Record pattern (no `assertNever` ceremony)
**Correction to the brainstorm (verified against the code):** every target primitive resolves its variant via an exhaustive `Record<Variant, string>` (e.g. `variantStyles: Record<ButtonVariant, string>`), and there are **no `switch`/`if`-chains** on these unions anywhere. The Record pattern *already* makes a missing variant a **compile error** (add a variant to the union without a Record entry → `tsc` fails). Converting these safe Records into `switch` statements just to call `assertNever` would be a clarity regression for zero safety gain — so F3 does **not** add `assertNever`. Instead it **proves the existing guarantee** with a type-test: a static assertion (e.g. a `// @ts-expect-error` on an incomplete Record, or a `satisfies` check) demonstrating that an unhandled variant fails to compile. Exhaustiveness is a kept guarantee, documented — not new ceremony.

### 4.3 Constrain the trailing element to the glyph lexicon
Replace the free-form `rightIcon?: ReactNode` with a discriminated, lexicon-bound prop:

```ts
// §4.1 glyph lexicon: chevron = disclosure/opens-in-place, external = leaves app.
// A decorative trailing arrow is now unrepresentable.
trailing?: 'chevron' | 'external'
```

The component renders **one canonical disclosure glyph** for `trailing="chevron"` (a down-chevron `⌄`, `ChevronDown`) and `ExternalLink` for `trailing="external"` — the prop carries the *meaning*; the component owns the glyph. **Migration (9 sites, bounded — mostly mechanical, two judgment calls):**
- **3 `ExternalLink`** (`ScheduleTab`, `ShareStep`, `WizardNavigation`) → `trailing="external"` — mechanical.
- **3 `ChevronDown` demos** (`DesignSystem.tsx` ×3) → `trailing="chevron"` — mechanical.
- **2 `ChevronRight`** (`ObjectiveCommandCenter:208`, `WizardNavigation:80`) → **judgment call** (same as §4.1's decorative-arrow rule): if it's *disclosure / opens-in-place* → `trailing="chevron"` (renders the down-chevron); if it's a *decorative "next/forward"* arrow → **remove it** (no trailing element), per §4.1's removal of decorative directional arrows. Read each site to decide.
- **1 outlier** (`DesignSystem.tsx:860`, `<span>USD</span>`) is a **showcase-page demo**, not a real product trailing meaning (it's an input-adornment pattern). Rework or remove that demo; **do not** extend the lexicon for it.

`leftIcon?: ReactNode` is kept (leading icons are unconstrained by the lexicon).

### 4.4 Require a visible label (icon-only → IconButton)
An unlabeled icon-only `Button` is an a11y bug and is currently representable. The clean rule (leveraging the existing `IconButton`, which already requires `aria-label`): **`Button` requires `children`** (a visible label); icon-only is `IconButton`'s job.

**Compiler-sized migration (the gate):** make `children: ReactNode` required, run `tsc -b`, and triage the exact childless set the compiler reports:
- **0 childless** → done, free.
- **≤ ~15** → migrate each: truly icon-only → `IconButton` (already enforces the label); should-have-a-label → add the visible label.
- **> ~15** → back off the type requirement to a `design-system` lint **warn** + a follow-up note (don't absorb an unbounded cascade in F3).

The threshold call is made at implementation from the real `tsc` count. (Regex can't detect icon-only Buttons reliably — false-matches inner `<Icon />`; the compiler is the accurate enumerator.)

## 5. IconButton

Already type-safe on the key rule (`aria-label: string` required, `icon: ReactNode` required) and variant-exhaustive via its `Record<IconButtonVariant, string>`. F3:
- Writes its **contract entry** in `DESIGN_SYSTEM.md` (it currently has none) documenting anatomy, the 4 blessed variants (`default` · `primary` · `ghost` · `danger`), sizes, and the required-label rule.
- No behavior or variant change. (No `assertNever` — the Record is already exhaustive, per §4.2.)

## 6. Verify the constrained primitives (no rebuild)

`Tag`, `Tabs`, `LinkText`, `TriStateToggle` already live in `components/ui/`. `Tag` is an **exemplary discriminated union** (`variant: 'label' | 'filter' | 'nav'` with `onClick?: never`/`href?: never` guards making illegal combinations uncompilable; `tone` is a semantic-token union, never an arbitrary color). F3:
- **Verifies** each enforces its semantics by type (Tag's `variant` union with `never` guards; `Tabs` deliberately has no `href` API so it can't masquerade as navigation; `LinkText`/`NavRow` use an `href` xor `onClick` union). Applies a **minimal** fix only where something is genuinely unsafe (else verify-and-document only — no rebuild, no `assertNever`, since these are Record/union-based and already exhaustive per §4.2).
- Documents `Tag` (and `Tabs`) in `DESIGN_SYSTEM.md` as the **canonical discriminated-union exemplars** the rest of the system follows.

## 7. Cheap token-AA pickups (folded from F2 follow-ups)

Small source-token edits on the design-system surface, related and cheap (logged during F2's contrast work):
- Light **`membership-owner`** and **`gear-tome`** are still `#0f9688` (the old accent), which fails WCAG AA as normal-weight text on light surfaces. Move them to an AA-compliant teal aligned with the new accent family (`#0c7d71`-class), verified against contrast like F2's accent fix.
- Make the light **default vs hover accent** meaningfully distinguishable (currently near-identical luminance).
- Regenerate via `pnpm tokens:build`; `pnpm tokens:check` stays clean. Do **not** touch the frozen F1 parity baseline (intentional post-F1 divergence; CI uses `tokens:check`, not `tokens:parity`).

## 8. Testing & verification

- **`tsc -b` is the primary gate** — illegal states must fail to compile. Add a small set of **`@ts-expect-error` assertions** proving the new guarantees, e.g.: a `Button` with no `children` is an error (if §4.4 lands as a type); a `Button` with a non-lexicon `trailing` value is an error; a `Tag variant="label"` with `onClick` is an error. These live next to the components (a `*.type-test.ts(x)` or inline) so a regression in the types is caught.
- **Behavioral tests** for any component whose runtime changed (Button trailing render: `trailing="chevron"` renders the chevron glyph; `trailing="external"` renders the external glyph).
- **Full local gate:** `pnpm build` (`tsc -b && vite build`), `pnpm lint`, `pnpm check:design-system:strict`, `pnpm test`, `pnpm tokens:check` — all green, locally and on the self-gating PR.
- **Token-AA:** the §7 colors verified to meet AA (contrast harness / manual ratio check) before asserting; the F2 axe harness (`pnpm test:contrast`) still green on its asserted views.
- **Release note** added; `CURRENT_VERSION` bumped only for the public token-AA item; no AI attribution; `git diff --check` clean.

## 9. Success criteria

1. `DESIGN_SYSTEM.md §3.1` documents the 8 blessed Button variants (grouped); IconButton has a contract entry; `Tag` is documented as the DU exemplar. No variant removed from code.
2. `Button` trailing element is a lexicon-bound discriminated prop (`'chevron' | 'external'`); all 9 `rightIcon` sites migrated; the demo outlier reworked; a decorative trailing arrow is uncompilable (`@ts-expect-error` proves it).
3. `Button` requires a visible label per §4.4 (or, if the `tsc` count exceeded the threshold, a documented lint-warn fallback with a deferral note) — childless icon-only Buttons migrated to `IconButton`.
4. `Button` and `IconButton` variant resolution is exhaustive via the `Record<Variant, T>` pattern, with a type-test proving an unhandled variant fails to compile (no `assertNever` ceremony added).
5. `Tag`/`Tabs`/`LinkText`/`TriStateToggle` verified type-safe (minimal fixes only where unsafe); `Tag` + `Tabs` documented as the DU exemplars.
6. Light `membership-owner`/`gear-tome` and default/hover accent meet AA; `tokens:check` clean; parity baseline untouched.
7. Build/lint/design-system/test/tokens:check all green; type-test `@ts-expect-error` assertions present; internal release note (+ public token-AA item with version bump); no AI attribution.
8. No consumer-cascade variant purge; no unbuilt-component contracts authored; no `/docs/design-system` page rebuild.
