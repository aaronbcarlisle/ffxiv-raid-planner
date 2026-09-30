# Documentation

This folder is intentionally small. It holds the **source of truth** for what the app is, plus a few durable references. Everything else (old plans, audits, session handoffs) lives in [`archive/`](./archive/).

> **New here? Read [`PRODUCT_MODEL.md`](./PRODUCT_MODEL.md) first.** It answers what the app is, who it's for, how everything nests, what fits inside it, and where it's going. Every other doc and every feature decision derives from it.

## Source of truth

| Doc | What it is |
|---|---|
| **[PRODUCT_MODEL.md](./PRODUCT_MODEL.md)** | The canonical model — vision, the Person↔Static layers, the weekly-loop spine, the Progress Engine + content tracks, the rings, the "where does it go?" rule, the full feature inventory, and the roadmap. **Read first.** |
| **[PRODUCT_MODEL.md §6](./PRODUCT_MODEL.md#6-current-state-and-definition-of-done)** | **Where the redesign stands and what "done" means** (release 3.0.0 → V1 deletion; two gates since 2026-09-30, when HS-25 merged the old un-gate into 3.0.0). The only place status is stated; everything else links here. |

## The redesign (`design/redesign/`)

| Doc | What it is |
|---|---|
| [REDESIGN_SPEC.md](../design/redesign/REDESIGN_SPEC.md) | The IA, navigation, visual language, and core user flows that realize the model — with coded mockups. |
| [HOME_STRETCH.md](../design/redesign/HOME_STRETCH.md) | **What is left, in order:** every item from now to V1 deletion, with sizes, acceptance criteria and the owner rulings (HS-1…HS-31). |
| [ROLLOUT_ROADMAP.md](../design/redesign/ROLLOUT_ROADMAP.md) | The plan of record: the dual-shell rollout, phases R→H, and their rulings. |
| [V2_COVERAGE_PLAN.md](../design/redesign/V2_COVERAGE_PLAN.md) | Coverage Stages 0–6: taking every route and surface to V2. |
| [RECONCILIATION.md](../design/redesign/RECONCILIATION.md) | The 2026-07-23 intent-vs-built audit; still the register for the B1–B9 IDs the roadmaps cite. |
| [FRONTEND_STRUCTURE.md](../design/redesign/FRONTEND_STRUCTURE.md) · [DESIGN_SYSTEM.md](../design/redesign/DESIGN_SYSTEM.md) | The frontend ring/feature structure; the V2 visual system. |
| [`specs/`](../design/redesign/specs/) · [`plans/`](../design/redesign/plans/) | Per-phase and per-slice specs and plans (dated). The parity matrix is `specs/v1-v2-parity-matrix.md`. |

Superseded but kept in place for the dated plans that link them (each carries a banner): `FOUNDATION_ROADMAP.md` (F0–F6, complete), `HANDOFF.md` (frozen at F6b), `RESEARCH_UX_BEST_PRACTICES.md` (conclusions locked into `DESIGN_SYSTEM.md`).

## Living references

| Doc | What it is |
|---|---|
| [UI_COMPONENTS.md](./UI_COMPONENTS.md) | Component inventory — **read before any UI work**. Quick Reference + decision tree; per-category detail in [`ui-components/`](./ui-components/). |
| [DESIGN_SYSTEM_SUMMARY.md](./DESIGN_SYSTEM_SUMMARY.md) | Design-system integration quick reference. |
| [DESIGN_SYSTEM_ENFORCEMENT.md](./DESIGN_SYSTEM_ENFORCEMENT.md) | How the design system is enforced (lint, CI). |
| [audits/enforcement.md](./audits/enforcement.md) | The current enforcement surface. |
| [CODING_STANDARDS.md](./CODING_STANDARDS.md) | Code style and patterns. |
| [GEARING_REFERENCE.md](./GEARING_REFERENCE.md) · [GEARING_MATH.md](./GEARING_MATH.md) | FFXIV gearing domain facts. |
| [DOCS_STYLE_GUIDE.md](./DOCS_STYLE_GUIDE.md) | Tone/formatting for the in-app `/docs` user pages. |
| [PRIVACY.md](./PRIVACY.md) | Privacy policy content. |

The **changelog** is `frontend/src/data/releaseNotes.ts` (CI-enforced). The live, interactive design-system reference is the in-app page at `/docs/design-system`.

## Archive

[`archive/`](./archive/) holds superseded material kept for history: completed feature plans, the security/perf audit sessions, the prior UI-overhaul plans (A–M) and roadmap, UX/parity implementation docs, mobile plans, and the old `CONSOLIDATED_STATUS.md` / `OUTSTANDING_WORK.md` inventories. It records *what was done*; `PRODUCT_MODEL.md` decides *what belongs and why*. The `2026-06-27-pre-redesign/` subfolder is the batch archived when the top-down redesign began.
