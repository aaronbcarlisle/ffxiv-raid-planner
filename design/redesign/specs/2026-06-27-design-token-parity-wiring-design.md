# Design Token Parity & Wiring — Design Doc

> **Status:** Approved design · 2026-06-27 · branch `redesign/foundation`
> **Task:** Foundation step 1 of the redesign — wire `tokens.json` into the real app.
> **Authority chain:** Derives from `design/redesign/HANDOFF.md` (suggested first task), `design/redesign/DESIGN_SYSTEM.md` (token architecture + open gaps §7), and `design/redesign/REDESIGN_SPEC.md §4` (design language). Where this doc and those conflict, those win on vision; this owns the *implementation shape* of the token pipeline.

---

## 1. Problem

The redesign produced a clean three-tier W3C DTCG token file (`design/redesign/mockups/theme/tokens.json`) whose atoms are byte-for-byte from the live `frontend/src/index.css`. The HANDOFF's first suggested task is to **wire that token file into the real app** via a generator (Style Dictionary) so CSS, Tailwind `@theme`, and the design-system reference all build from one source and can't drift.

The blocker discovered during exploration: **`tokens.json` is a strict *subset* of what `index.css` actually defines.** The live `@theme` block (and its `[data-theme="light"]` override) carries a substantial set of values that `tokens.json` does not model at all:

- **Shadows** — `--shadow-sm/md/lg/xl/glow` (dark + light variants)
- **Motion** — `--duration-fast/normal/slow` (no easing tokens exist anywhere)
- **Gradients** — `--gradient-rail` (dark + light)
- **Toggle-orb colors** — 4 vars × 2 themes
- **Parchment / seal** — 5 vars × 2 themes (JoinRequest modal aesthetic)
- **Discord brand** — `--color-discord`, `--color-discord-hover`
- **Badge-text-contrast** — `--color-gear-raid-text`, `--color-gear-crafted-text`, `--color-gear-augmented-text` (light-only AA variants)
- **Overlay raise** — `--color-overlay-raise` (dark + light)
- **Layout dimensions** — `--header-height`, `--bottom-nav-height`, `--breakpoint-3xl`, `--layout-chrome`
- **Legacy aliases** — `--color-bg-*`, `--color-source-*`, `--color-accent-bright` (still referenced by components)

Additionally, `tokens.light.json` is **missing several semantic overrides** the live light block has (`gear-crafted`, `text-disabled`, materials, `status-info`, etc.). A naive cutover would **regress light mode** and **drop the values above entirely**.

A second, related discovery: the rendered design-system reference page (`frontend/src/pages/DesignSystem.tsx`) contains **structurally outdated sections** the redesign has already reversed. That page's rebuild is a *separate, later* task; this doc only records the triage so the rebuild has a map (see §9).

---

## 2. Decision

**Approach B — expand `tokens.json` to full parity with `index.css`, then replace the `@theme` block entirely.** One true source immediately; nothing in the live theme remains hand-maintained outside the token pipeline (except a clearly-marked, deprecation-bound legacy-alias shim).

Rejected alternatives:
- **A (generate subset + hand-written supplement):** lower-risk but leaves two sources of truth indefinitely — the exact drift the token system exists to prevent.
- **C (validation-only, don't cut over):** safest but doesn't actually wire tokens into the app this round.

The user chose B and asked that token *homes* be decided by design-token fundamentals rather than ad hoc. §3 is that decision, grounded in current (2025–2026) practice (Material 3 elevation tokens, the DTCG 2025.10 format module, and semantic-naming guidance from EightShapes-lineage sources).

---

## 3. The locked token-tier mapping (the parity target)

**Governing rule (from the tiered model + our theming constraint):**

> What **varies by theme** must live at the **semantic** tier (light mode overrides *only* semantic). What is **theme-invariant and raw** lives at **primitive**. What is **tied to one widget** lives at **component**. Reference direction is always component → semantic → primitive; never skip a tier.

| `index.css` category | Tier | Rationale | Token shape |
|---|---|---|---|
| **Shadows** (`shadow-sm…glow`) | **Semantic**, light-overridden | Shadow values differ fully dark↔light (dark leans on surface tone, light on real shadow). Only semantic is theme-overridable. Name by **role**, not size. | `semantic.shadow.{card,popover,modal,glow}` · `$type: shadow` · light override |
| **Motion** (`duration-*` + new easings) | **Primitive** duration + easing → **Semantic** motion roles | Durations/easings are theme-invariant raw values → primitive. Compose into intent roles. Closes the DESIGN_SYSTEM §7 "motion undefined" gap. | `primitive.duration.{instant,fast,base,slow}` + `primitive.easing.{standard,decelerate,accelerate}` (cubicBezier) → `semantic.motion.{hover,popover-enter,toggle-slide,tab-switch}` |
| **`gradient-rail`** | **Component**, light-overridden | Rail-specific decorative fill that flips per theme. | `component.nav.rail-bg` · `$type: gradient` · light override |
| **Toggle-orb colors** | **Component** | Tied to exactly one widget (Toggle). | `component.toggle.orb.*` · light override |
| **Parchment / seal** | **Semantic** decorative-surface family | Feature-specific but theme-varying *surface roles* (a "skin," not a raw value) → semantic so the light flip works. | `semantic.surface.parchment.*`, `semantic.accent.seal` · light override |
| **Discord brand** | **Primitive** | External fixed brand value, theme-invariant. Exposed via component only where used. | `primitive.brand.{discord,discord-hover}` → `component.button.discord.*` |
| **Badge-text-contrast** (light-only) | **Semantic** | "Readable text *on* a gear color" is an intent/role; exists only for light-mode AA. | `semantic.text.{on-gear-raid,on-gear-crafted,on-gear-augmented}` · light-only override |
| **`overlay-raise`** | **Semantic** | Interaction/feedback role that flips per theme. | `semantic.interaction.raise-haze` · light override |
| **Layout dims** (`header-height`, `bottom-nav-height`, `breakpoint-3xl`) | **Primitive** `size.*` / `breakpoint.*` | Structural, theme-invariant dimensions — same family as the existing `container`/`rail`/`control` sizes. | `primitive.size.{header,bottom-nav}`, `primitive.breakpoint.3xl`; `layout-chrome` stays a CSS `calc()` of the two |
| **Legacy aliases** (`bg-*`, `source-*`, `accent-bright`) | **Not new tokens** — `@deprecated` shim | Aliases are migration debt, not design decisions (Atlassian token-lifecycle practice). Keep them aliasing semantic tokens, flagged for removal as components migrate off. | shim block → references semantic |

**Two consequences captured as explicit decisions:**

1. **Motion is designed, not ported.** `index.css` has three bare durations and *no easing tokens*. We define easing primitives + semantic motion roles so the toggle-orb slide, popover enter/exit, and tab transitions get real tokens. This is intentionally *more* than a 1:1 port.
2. **Density is deferred.** There are **no** density vars in `index.css` to port, and no current consumer. Per YAGNI + the "every token earns its place" governance, density tokens wait until the Roster Board compact mode actually needs them. (Recorded as a known future gap, not built now.)

**Container tiers** are renamed/re-valued as already decided in `DESIGN_SYSTEM.md §2.2` (`data 2160 / standard 1760 / focus 1100 / doc 960`, replacing the live `data 2560 / wide 1920 / focus 1280 / narrow / compact`). This is in `tokens.json` already; the migration cost is the `PageContainer` component (§6).

---

## 4. Build pipeline

```
tokens.json  +  tokens.light.json          (source of truth, DTCG)
        │  Style Dictionary v4 (DTCG-native), run as a pnpm script + CI step
        ▼
  generated CSS  →  :root (semantic+component)  +  [data-theme="light"] (semantic overrides)
                 →  @theme block (Tailwind 4 namespaced vars referencing the semantic layer)
        │  imported by ▼
  frontend/src/index.css   (its hand-written @theme block is REPLACED by generated output)
        │  consumed by ▼
  Tailwind 4 via @tailwindcss/vite (no tailwind.config; @theme is in CSS)
```

- **Generator:** Style Dictionary **v5** (`style-dictionary@^5` — DTCG support matured through v5; v5.3 added DTCG 2025.10 structured color), replacing the Python reference generators (`gen_tailwind.py`, `generate_css.py`) which proved the round-trip but aren't a real build step. Output is a build artifact; the JSON is the source. **(Correction: earlier draft said v4; SD is at v5.)**
- **Tailwind 4 `@theme` output — no first-class format exists.** Style Dictionary has **no built-in Tailwind 4 `@theme` formatter** (the community `sd-tailwindcss-transformer` still emits Tailwind *v3* config objects). Two viable paths, decided at implementation: **(a)** write a ~10-line custom SD format that wraps `formattedVariables` output in `@theme { … }`; or **(b)** use **Terrazzo** (`@terrazzo/plugin-tailwind`, `npx tz build`), which is DTCG-native and emits a `@theme` block directly. *Recommendation: prototype both on our token file; pick by which produces the cleaner round-trip against the existing `@theme`.*
  - **Load-bearing Tailwind 4 rule:** vars in `@theme {}` both create CSS custom properties **and** generate utilities (`bg-*`, `shadow-*`, `ease-*`); vars in plain `:root {}` are inert (usable via `var()` only). So any token that needs a utility must land in `@theme` under the correct namespace (`--color-*`, `--shadow-*`, `--ease-*`, `--font-*`, `--text-*`, `--spacing-*`, `--container-*`). Use `@theme inline` when a theme var references another var (the dark/light semantic indirection).
  - **Composite-type gotchas:** `cubicBezier → --ease-*` and `shadow → --shadow-*` map cleanly (one entry each). A DTCG `typography` composite is **not** one entry — it must be expanded field-by-field to `--text-*`/`--font-*`/`--font-weight-*`/`--leading-*`/`--tracking-*`. `gradient` has **no** Tailwind utility namespace — it falls back to an inert `:root` var consumed via `var()` (fine for `gradient-rail`, which is component-scoped).
- **Source-of-truth location:** the canonical `tokens.json` / `tokens.light.json` move from `design/redesign/mockups/theme/` into a real app location (e.g. `frontend/tokens/`) so they live with the code they generate. (Exact path confirmed during implementation; the mockup copies become references.)
- **Tailwind integration:** the generated `@theme` replaces the existing hand-written block in `index.css`. There must be exactly **one** `@theme` — two would reintroduce drift.
- **CI — generated-matches-source guard:** the build regenerates CSS from the tokens and **`git diff --exit-code`** on the generated file fails the job if it drifts (so anyone editing `tokens.json` must commit the regenerated CSS; hand-edits to generated vars are rejected). Folds under the existing `check:design-system` gate. *(This guard is the F2-phase regression control, pulled forward because it pairs with the generator.)*

---

## 5. Light-theme gap closure

Before cutover, `tokens.light.json` must be expanded to cover **every** semantic override the live `[data-theme="light"]` block defines, so light mode is byte-for-byte unchanged. Known missing today (non-exhaustive; the parity diff in §7 is the real gate): `gear-source.crafted`, `text.disabled`, the material family, `status.info`, the new badge-text-contrast roles, parchment light values, toggle-orb light values, gradient-rail light value, overlay-raise light value, shadow light variants.

---

## 6. In-scope sub-items (beyond the token file itself)

- **`PageContainer` rename.** Update the component's `variant` prop (`data|wide|focus|narrow|compact` → `data|standard|focus|doc`) and every call site to the new container tiers. Provide a transitional alias if needed to stage the migration.
- **Doc-wording reconciliation (the conflict the user approved fixing now).** The redesign docs say "9px readable floor"; the actual lint rule and `CLAUDE.md` define a **12px readable floor with 9px allowed only for badge counts**. Correct the wording in `DESIGN_SYSTEM.md` / `REDESIGN_SPEC.md` to "12px readable floor; 9px hard floor for badge counts" so the design system matches the CI guard it claims to keep. Also note the `surface-elevated` intent change (inputs → `surface-interactive`) and the container-width change where those docs describe them.
- **Legacy-alias shim.** Emit the `@deprecated` alias block (referencing semantic tokens) so no component breaks at cutover; record the alias list for later removal.

---

## 7. Verification (no-visual-regression gate)

The cutover is correct **iff** every CSS custom property the app resolves is identical before and after, in both themes.

1. **Parity diff harness.** Snapshot the resolved values of every `--color-*`, `--font-*`, `--shadow-*`, `--duration-*`, etc. from the current `index.css` (dark and `[data-theme="light"]`). Generate the new CSS from tokens. Diff. **Zero diffs for every value that existed before** is the pass condition. New tokens (easings, semantic motion roles, role-named shadows) are *additions* and are allowed; *changes* to pre-existing values are not (except the deliberately-decided container-tier values, which are listed as expected diffs).
2. **Build + typecheck:** `pnpm build` (runs `tsc -b && vite build`) clean.
3. **Lint/design-system gate:** `pnpm check:design-system` and `pnpm lint` pass.
4. **Visual spot-check:** load the app in dark and light, eyeball Home/Roster/a modal/the JoinRequest parchment/the Toggle — confirm no visible change.

---

## 8. Scope boundaries (explicitly NOT this task)

- **Rebuilding the design-system page** to render from tokens — separate, *depends on* this task. Its triage is recorded in §9.
- **The navigation rail / 4-tab spine / any screen work** — later foundation/Ring-0 steps.
- **Refactoring component props to discriminated unions** — separate DESIGN_SYSTEM follow-up.
- **Actually removing** legacy aliases or migrating components off them — this task only *quarantines* them as deprecated.

---

## 9. Recorded input for the later design-system-page rebuild (not built here)

Triage of `frontend/src/pages/DesignSystem.tsx` (28 sections) against the redesign:

**Outdated — structure the redesign reverses:**
- **`page-layout`** (~lines 2882–3439, largest section): built on the "floating element anti-pattern" and "data pages have **no sidebar**" rule, which `DESIGN_SYSTEM.md v3 §2.1` explicitly **retires** in favor of the rail + top bar + spine. Must be rewritten, not patched.
- **`containers`** (2142): the 5-tier system superseded by the rail-derived 4-tier (§3).
- **`tab-patterns`** (2003): the three patterns survive; the *examples* ("Loot Priority"/"Loot Log") must be re-anchored to Cards⇄Board and Priority·History.
- **Retired-vocabulary offenders** in examples: "Loot Log" (2084), loot-logging FAB (3314), any Overview/More usage (`v3 §2.3`).

**Still valid (atoms kept verbatim):** all color sections, Typography, Spacing, Buttons, Badges, Icon Buttons/Library, Job Icons, Tooltips, Forms & Inputs, Popover, Constrained Primitives, Gear Status Circle, Toggle, Number Input, Week Stepper. *(Buttons needs the trailing-arrow rule added; some need light-mode notes.)*

**Missing (gaps to add when rebuilt):** Shadow/Elevation, Motion, Gradient, Density, and the new components (rail, top bar, spine, ⌘K, heatmap, RSVP row, attention row).

---

## 10. Success criteria

1. `tokens.json` + `tokens.light.json` model **everything** the live `index.css` `@theme`/light block defines, allocated to tiers per §3.
2. Style Dictionary generates the CSS + Tailwind `@theme`; `index.css`'s hand-written block is replaced by generated output; exactly one `@theme` exists.
3. Parity diff shows **zero unexpected value changes** in either theme (only the listed container-tier diffs + pure additions).
4. `pnpm build`, `pnpm lint`, `pnpm check:design-system` all pass.
5. `PageContainer` migrated to the new tiers; no broken call sites.
6. Doc-wording conflicts (9px/12px floor, surface-elevated intent, container widths) corrected in the redesign docs.
7. Legacy aliases preserved as a `@deprecated` shim; nothing visually regresses.
8. A CI check rejects hand-edits to generated token CSS that diverge from the JSON.

---

## 11. Risks

- **Hidden value drift.** A var that looks identical but resolves differently (alias chains, `color-mix`, opacity utilities). *Mitigation:* the §7 parity diff compares **resolved** values, not source strings.
- **Style Dictionary DTCG edge cases** (composite `typography`/`shadow`/`gradient` types, cubicBezier). *Mitigation:* validate each composite type's output against the existing hand-written value during the parity pass; keep the token file lean (research caveat: DTCG modules beyond core are still stabilizing).
- **`PageContainer` call-site sprawl.** *Mitigation:* transitional alias + grep every call site; it's a contained rename.
- **Two `@theme` blocks accidentally coexisting.** *Mitigation:* explicit success criterion (#2) + the CI generated-vs-source check.
