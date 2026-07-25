# Documentation

This folder is intentionally small. It holds the **source of truth** for what the app is, plus a few durable references. Everything else (old plans, audits, session handoffs) lives in [`archive/`](./archive/).

> **New here? Read [`PRODUCT_MODEL.md`](./PRODUCT_MODEL.md) first.** It answers what the app is, who it's for, how everything nests, what fits inside it, and where it's going. Every other doc and every feature decision derives from it.

## Source of truth

| Doc | What it is |
|---|---|
| **[PRODUCT_MODEL.md](./PRODUCT_MODEL.md)** | The canonical model — vision, the Person↔Static layers, the weekly-loop spine, the Progress Engine + content tracks, the rings, the "where does it go?" rule, the full feature inventory, and the roadmap. **Read first.** |
| **[REDESIGN_SPEC.md](./REDESIGN_SPEC.md)** | The IA, navigation, visual language, and core user flows that realize the model — with coded mockups. *(In progress.)* |

## Living references

| Doc | What it is |
|---|---|
| [UI_COMPONENTS.md](./UI_COMPONENTS.md) | Component inventory — **read before any UI work**. |
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
