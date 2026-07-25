# Design-System Enforcement Surface — Audit

> Phase 0 of Plan L. Inventories what the design system **already enforces**, what intent it
> encodes but **does not enforce**, and the chosen mechanism for each gap. This decides Phases 1–7.

## Mechanisms

- **API-prevent** — a constrained component/prop makes the bad state a *type error* (illegal UI unrepresentable).
- **Lint** — an ESLint rule flags it mechanically (`warn` now, ratchet to `error` per directory).
- **Review-only** — not mechanizable; documented + PR-checklist item.

## What is enforced today

| Surface | Mechanism | Notes |
|---|---|---|
| Raw `<button>` | Lint `design-system/no-raw-button` (**warn**) | Use `Button`/`IconButton`. `design-system-ignore` escape hatch. |
| Raw `<input>` | Lint `no-raw-input` (**warn**) | Use `Input`/`Checkbox`/`NumberInput`. |
| Raw `<select>` | Lint `no-raw-select` (**warn**) | Use `Select`/`SearchableSelect`. |
| Raw `<label>` | Lint `no-raw-label` (**warn**) | Use `Label`. |
| Raw `<textarea>` | Lint `no-raw-textarea` (**warn**) | Use `TextArea`. |
| Raw HTML controls (grep) | `scripts/check-design-system.sh` (**CI-blocking via `--strict`**) | Text-grep backstop, separate from ESLint. |
| Hardcoded colors (grep) | `check-design-system.sh --colors` | Text-grep; coarse, not AST-aware. |
| Color **tokens** exist | `index.css` `@theme` + `[data-theme="light"]` | Comprehensive token set incl. light values. |

Primitive-defining files are excluded from the lint bans in `eslint.config.js` (they legitimately render raw elements).

## What is intended but NOT enforced (the gaps)

| Intent | Today | Decision | Where |
|---|---|---|---|
| **Colors must be tokens** (no inline `#hex`/`rgb()`, no `bg-[#…]`) | Only a coarse grep | **Lint** (AST rule) + keep grep | Phase 1.2 (folds in Plan J) |
| **Type scale floor** (no sub-`xs` arbitrary `text-[Npx]`) | Documented only (Plan F §5.1) | **Lint** | Phase 1.2 (folds in Plan F §5) |
| **Interaction semantics** (`onClick`/`onKeyDown` on bare `<div>/<span>/<p>` w/o `role`) | Nothing | **Lint** + **API-prevent** (`LinkText`/`NavRow`) | Phase 1.1 + 1.2, sweep Phase 2 |
| **`cursor-pointer` only on interactive roles** | Nothing | **Lint** | Phase 1.2 |
| **Tabs can't masquerade as navigation** | Nothing | **API-prevent** (`Tabs` has no `href`/route API) | Phase 1.1, sweep Phase 5 |
| **Tags carry explicit semantics** (label vs filter vs nav) | Nothing | **API-prevent** (`Tag` required `variant`) | Phase 1.1, sweep Phase 2 |
| **Headers don't diverge** (icon + Title Case + actions) | Nothing | **API-prevent** (`PageHeader` fixed structure) | Phase 1.1, sweep Phase 4 |
| **Color/size props can't take arbitrary strings** | `string` props | **API-prevent** (token unions, e.g. `tone`) | Phase 1.1 |
| **IA / redundancy** (one canonical home per surface) | Nothing | **Review-only** + audit doc | Phase 3 |

## Sequencing implication

Phase 1 lands the **constrained primitives** (API-prevent) and the **lint rules as `warn`** (mechanizable
intent) *before* the per-area sweeps (Phases 2–6), so every later plan and future contribution builds
against an enforced target. Lint stays `warn` globally; each sweep flips its own directory to `error`
once cleaned, so foundations never block in-flight feature work.
