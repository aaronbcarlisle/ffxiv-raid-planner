# HANDOFF — Redesign context for Claude Code

> **What this is.** A redesign of XIV Raid Planner's UX/IA and design system. This file orients you (a fresh Claude Code instance) to the artifacts, what's decided, what's open, and where execution stands. **Read the files referenced below before acting — they are the source of truth, this is just the map.**

## Current status & how to resume (updated 2026-06-29)

**The live phase tracker is [`FOUNDATION_ROADMAP.md`](./FOUNDATION_ROADMAP.md) — read it first for where we are** (it has the per-phase scope, status, and the §3.2 follow-ups list). It defines the dependency-ordered foundation phases **F0–F6**.

- **Done & merged into `redesign/foundation` (head `5195d45`):** **F0** (locked decisions, #157) · **F1** (token pipeline, #155) · **F2** (anti-regression scaffolding, #158 `2ffde63`) · **F3** (component contracts + illegal-states, #159 `ee03eab`) · **F4** (frontend structure, #160 `2e26e02`) · **F5** (mockup validation pass, #162 `5195d45`). Release notes at **v2.0.2** (F4/F5 were internal/doc-only).
- **Next:** **F6 — build Ring 0 on the foundation** (rail → app shell → Home/Roster/Loot/Schedule; each screen consolidates its duplicated predecessors into one owned, contracted component). See `FOUNDATION_ROADMAP.md` F6 row. *(F5 shipped the build manifest: `specs/f5-screen-components-map.md` — 7 element-set tables tagging every Ring-0 element existing/refine/new against real component paths, a 27-entry new-component catalog, and the predecessors→one-owned-component consolidation map. F4 shipped the feature-slice + shared-layer model: `FRONTEND_STRUCTURE.md`, the Ring-aware `eslint-plugin-boundaries` graph + 28-edge suppressions baseline, and the backend Person↔Static note.)*
- **How a phase runs (proven over F1–F3):** brainstorm → write spec (`design/redesign/specs/`) → write plan (`design/redesign/plans/`) → execute subagent-driven (fresh implementer + independent reviewer per task, then a final whole-branch review) → PR into `foundation` → squash-merge. The `superpowers` skills drive this; the SDD progress ledger lives at `.superpowers/sdd/progress.md` (git-ignored scratch).
- **Reviewer effort (standing):** dispatch the SDD **task reviewer** and the **final whole-branch reviewer** via `subagent_type: redesign-reviewer` (`.claude/agents/redesign-reviewer.md`) — it pins `effort: xhigh`. Keep **implementers** on cheap/standard models per the skill's Model Selection; concentrate the deep reasoning on review, since that's where the subtle defects surface (F3's `createElement` type-test masking bug was caught only at final review). This is the surgical way to apply xhigh to review without paying for it on every implementer dispatch — the Agent tool has no per-call effort knob, so the frontmatter agent is the mechanism.

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

Items 1–3 below are **resolved and locked** as of F0 (2026-06-28). Item 4 remains open.

1. ✅ **Navigation rail visual standard — RESOLVED.** Locked in `DESIGN_SYSTEM.md §3.9`: 72px, icon-only, recessed surface (`surface-raised`, 1px border right, no shadow), rail owns top-left corner, active = filled icon + accent + left-edge pill, inactive = outlined + muted, hover/pressed = surface-overlay, focus = focus-ring. A11y: `<nav aria-label>`, sr-only labels, tooltip on hover+focus, 44px touch target, skip link. Remaining gaps (component-tier tokens, motion) are scoped to F3.
2. ✅ **Icon lexicon — RESOLVED.** Canonical glyph-lexicon table locked in `DESIGN_SYSTEM.md §4.1`: one glyph = one meaning (magnifier=search, `↗`=external/leaves app, chevron=disclosure, caret=dropdown/sort, kebab=overflow-vertical, meatball=overflow-horizontal, drag-handle=reorder). Decorative trailing `→` is removed. §3.1 trailing-element rules cross-reference §4.1 as authority.
3. ✅ **Vocabulary: goals / progression / content / raids — RESOLVED.** Track-centric model locked in `DESIGN_SYSTEM.md §2.3` and `REDESIGN_SPEC.md §10`: Track (abstraction) / Tier (flagship savage track) / Fight (named encounter) / Prog = a status never a page / "add a track" for non-savage content / "Goals" and "Content" retired. `REDESIGN_SPEC.md §11` updated to mark these as done.
4. **Design-system gaps** (`DESIGN_SYSTEM.md §7`): gear-cell duplication (unify on GearStatusCircle), recipient picker formalization (one PopoverSelect specialization), platform-correct ⌘K/Ctrl-K affordance, **motion tokens (undefined)**, **density tokens (undefined)**, and tokenizing the new components (top bar, spine, palette, heatmap, RSVP row, attention row). These remain open — scoped to F3 and the validation pass.

## What's next (see `FOUNDATION_ROADMAP.md` for live status)

**F0–F5 are done and merged** (token pipeline, anti-regression scaffolding, component contracts, frontend structure, mockup validation). The only remaining foundation phase is:

- **F6 — build Ring-0 screens on the foundation.** Rail → app shell (top bar + spine) → Home → Roster (Cards⇄Board) → Loot (Priority + unified recipient picker + History) → Schedule. Each screen **consolidates its duplicated predecessors into one owned, contracted component**, and writes the component contract alongside it. Deferred items from earlier phases land here: unbuilt-component contracts, `nav.*`/motion/density tokens, the per-domain suppression ratchet (`--prune-suppressions`), and re-enabling the contrast harness on rebuilt screens. The `/docs/design-system` page rebuild is **post-F6**.
- **F6's build manifest is `specs/f5-screen-components-map.md`** — the 27-entry catalog (each unbuilt component's purpose + precursors + consolidation mandate) and every `refine` row's specific change to a real component. Likely wants sub-phasing (shell first, then one screen at a time) rather than one mega-branch.

Each phase's spec + plan under `design/redesign/specs/` and `design/redesign/plans/` are the template for how a phase is specced and executed (the F1–F5 set are worked examples).

## Guardrails

- The mockups are scaffolds, not pixel specs. When a mockup detail conflicts with `DESIGN_SYSTEM.md`, the design system wins.
- Don't reintroduce retired vocabulary or the old IA (Gear tab, Loot Log, More).
- Preserve the governance philosophy: no raw hex in components, **12px readable floor (`text-xs`); 9px hard floor for badge counts only**, shared interactions use the shared component, illegal UI unrepresentable.
- When something here is ambiguous, ask the user rather than guessing — several structural decisions (§"still OPEN") are genuinely undecided.
