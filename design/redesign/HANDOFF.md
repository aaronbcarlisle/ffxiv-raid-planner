# HANDOFF — Redesign context for Claude Code

> **What this is.** A redesign of XIV Raid Planner's UX/IA and design system. This file orients you (a fresh Claude Code instance) to the artifacts, what's decided, what's open, and where execution stands. **Read the files referenced below before acting — they are the source of truth, this is just the map.**

## Current status & how to resume (updated 2026-06-28)

**The live phase tracker is [`FOUNDATION_ROADMAP.md`](./FOUNDATION_ROADMAP.md) — read it first for where we are.** It defines the dependency-ordered foundation phases **F0–F6** and their status.

- **Done:** **F1 — token pipeline** (`tokens.json` → generated Tailwind `@theme`, parity-proven zero visual change, CI drift guard, PageContainer rename). Merged into `redesign/foundation` via **PR #155**.
- **Next:** **F2** (anti-regression scaffolding) and **F0** (lock the three open decisions below). F0 is doc-only/light; F2 is multi-task.

**Dev workflow (standing):** `redesign/foundation` is the integration base (= `main` + the superseded #146–#154 stack). Each phase = a branch off `foundation`'s head → PR into `foundation` → review-loop until clean → **squash-merge** into `foundation` → next phase branches off the new head. Nothing targets `main` until the whole foundation is done, then `foundation → main` lands it in one reviewed PR. **No AI attribution in commits/PRs** (absolute).

**Key F1 decision (don't re-open):** the token generator is a small **custom data-driven script** (`frontend/scripts/build-tokens.mjs`). Style Dictionary v5 and Terrazzo were both evaluated and **rejected** — neither emits the app's exact legacy CSS (legacy var names, resolved hex, `rgba()`). Adding a token category = edit `tokens.json` + the `ID_TO_CSS_VAR` map.

## The artifacts (read in this order)

1. **`PRODUCT_MODEL.md`** — *what the app is and why.* The progression-tool vision, the Person↔Static two-layer model, the weekly loop, "one Progress Engine, many tracks," the concentric rings. Tier-1 canonical. **The canonical copy lives at `docs/PRODUCT_MODEL.md`** (CLAUDE.md references it as READ-FIRST).
2. **`REDESIGN_SPEC.md`** — *the IA and per-screen scaffolding.* The 4-tab spine (Home · Roster · Loot · Schedule), the re-homing map for every current surface, the UX flow graph, the glossary, open decisions. Tier-1 canonical.
3. **`DESIGN_SYSTEM.md`** — *the atoms + structural rules + component contracts + governance.* Supersedes the old `docs/design-system` rendered page as the source of truth for design decisions.
4. **`tokens.json` / `tokens.light.json`** — *W3C DTCG design tokens*, three tiers (primitive → semantic → component). **As of F1 these are live in the app at `frontend/tokens/`** (the copies under `mockups/theme/` are historical). Source of truth for all theme values; generated into `frontend/src/styles/tokens.generated.css` by `frontend/scripts/build-tokens.mjs`, guarded by `pnpm tokens:check` in CI. *(The old `mockups/theme/generate_css.py`/`gen_tailwind.py` were reference-only and are superseded.)*
5. **`RESEARCH_UX_BEST_PRACTICES.md`** — *external research* grounding the nav-rail standard, icon lexicon, token tooling, and vocabulary decisions in current (2025–2026) industry practice. Reference, not canon.
6. **Mockups** (`00-flow-map.html`, `01`–`06`*.html) — *visual scaffolds* for each screen. Authoritative for **structure + flow + visual-language direction**, NOT for atomic component specs (those live in the design system). They use real tokens but contain placeholder/filler visuals — treat layout as the signal, filler as noise.

## What's decided (don't re-litigate)

- **Navigation:** left context rail (Person layer) + top bar (static·track·week) + 4-tab spine (Home·Roster·Loot·Schedule). No "More" tab, no "Gear" tab, no "Loot Log."
- **"Log" is a verb,** never a tab — it's action buttons inside Loot. The record is "History."
- **Roster = Cards ⇄ Board** (Board is the re-homed gearsheet matrix). **Loot = Priority · History** with a unified recipient picker.
- **Tokens are three-tier W3C DTCG.** Atoms (colors/type/spacing/widgets) preserved verbatim from the old `index.css`; structure (layout/width/vocabulary/nav) rewritten.
- **Vocabulary is canonical** (see `REDESIGN_SPEC.md §10` + `DESIGN_SYSTEM.md §2.3`): Static (never "group"), Track, Loot, Drop, Priority, Log (v.), Week. Retired: Gear-tab, Loot Log, Overview, More.

## What's still OPEN (needs decisions before/while building)

These were in flight when the planning session paused — confirm with the user before locking:

1. **Navigation rail visual standard** — width (72px recommended), surface tier (recommended: recessed, one tonal step darker than app bg, 1px border, no shadow), active/hover/focus states, corner ownership (recommended: rail-owns-corner). The rail was previously slotted in without integration; this is the main open structural task. See `RESEARCH_UX_BEST_PRACTICES.md` Topic 1 + Stage 1.
2. **Icon lexicon** — one glyph = one meaning (↗ = leaves app, magnifier = search, chevron = disclosure, kebab = overflow, etc.). Needs to become a canonical table in `DESIGN_SYSTEM.md §3.1/§4`. The mockups currently overuse a decorative trailing `→`; per the new rule, decorative glyphs must carry defined meaning or be removed. See `RESEARCH_UX_BEST_PRACTICES.md` Topic 2 + Stage 2.
3. **Vocabulary: goals / progression / content / raids** — these four conflate one concept. The current "Goals page" is really a selectable list of raid content to track progress on. Resolve into one term per concept (research recommends: top-level "Raids" → grouped by tier → fights; "Progress/Prog" as a status, not a page). Adopt FFXIV community lexicon verbatim. See `RESEARCH_UX_BEST_PRACTICES.md` Topic 4.
4. **Design-system gaps surfaced** (`DESIGN_SYSTEM.md §7`): decorative-arrow audit, unify ad-hoc gear pips onto GearStatusCircle, formalize the recipient picker as one PopoverSelect specialization, platform-correct ⌘K/Ctrl-K affordance, **motion tokens (undefined)**, **density tokens (undefined)**, and tokenizing the new components (rail, top bar, spine, palette, heatmap, RSVP row, attention row).

## What's next (see `FOUNDATION_ROADMAP.md` for live status)

**F1 (token pipeline) is done.** Remaining phases, in dependency order:
- **F0** — lock the three OPEN decisions above (rail standard, icon lexicon, goals/raids vocabulary). Doc-only; unblocks F3.
- **F2** — anti-regression scaffolding: `jscpd` (find existing duplicates) + `knip` (dead code), `eslint-plugin-boundaries`, `jsx-a11y` + a small `@axe-core/playwright` contrast scan, ratchet design-system lint **warn→error**. *(This is what actually prevents future regression — the F1 reframe: tokens alone aren't enough; enforcement + types + structure are.)*
- **F3** — component contracts + **discriminated-union props** (illegal states unrepresentable); rebuild `/docs/design-system` to render FROM tokens.
- **F4** — frontend structure (feature-slices + enforced shared layer); **F5** — mockup validation pass; **F6** — build Ring-0 screens (Home/Roster/Loot/Schedule) on the foundation.

The full F1 spec + plan are under `design/redesign/specs/` and `design/redesign/plans/` as the template for how each phase is specced and executed.

## Guardrails

- The mockups are scaffolds, not pixel specs. When a mockup detail conflicts with `DESIGN_SYSTEM.md`, the design system wins.
- Don't reintroduce retired vocabulary or the old IA (Gear tab, Loot Log, More).
- Preserve the governance philosophy: no raw hex in components, **12px readable floor (`text-xs`); 9px hard floor for badge counts only**, shared interactions use the shared component, illegal UI unrepresentable.
- When something here is ambiguous, ask the user rather than guessing — several structural decisions (§"still OPEN") are genuinely undecided.
