# Foundation Roadmap — Redesign Implementation Sequence

> **Status:** In execution · updated 2026-06-28 · integration base `redesign/foundation`
> **Progress:** F1 ✅ complete (merged into `redesign/foundation` via PR #155). F2 / F0 are next. Each phase = a branch off `redesign/foundation` → PR → squash-merge into foundation; `foundation → main` lands everything at the end.
> **What this is.** The dependency-ordered plan of attack for the redesign's **foundation** — the phases that must land before Ring-0 screens are built. It exists because the original app's failure was *not* the visuals; it was the **absence of a scalable implementation discipline** underneath them. This roadmap sequences that discipline.
> **Authority.** Derives from `PRODUCT_MODEL.md` (vision), `REDESIGN_SPEC.md` (IA/flow), `DESIGN_SYSTEM.md` (atoms/contracts), and a confidence audit grounded in 2025–2026 best-practice research (§"Affirmation" below). Per-phase implementation plans are written separately (writing-plans) as each phase begins.

---

## 0. The reframe that drives the sequence

The diagnosis that reorders everything: **tokens alone never prevent regression.** For a solo maintainer the binding constraint is *review* — there is no second person to catch the 7th copy of a button or a contrast regression. So durable anti-drift lives in three things tokens don't provide, and they must be **first-class foundation phases, not afterthoughts:**

1. **Types that refuse to compile the bad state** — discriminated-union component props (illegal UI unrepresentable).
2. **Machine enforcement that runs without you** — lint ratcheting warn→error, a generated-matches-source CI guard, import-boundary rules, duplication finders.
3. **A structure where every job has exactly one home** — feature slices + a shared layer with an enforced promotion rule.

The design-system rebuild (tokens + contracts) is **necessary but only ~⅓ of the real foundation.** This roadmap makes the other ⅔ explicit.

---

## 1. Affirmation — the foundation is sound (confidence: HIGH)

A research-backed stress-test of the four pillars (full citations in the session record; key sources noted):

- **Product/domain model — SOUND.** Person↔Static with **role-on-membership** is the textbook multi-tenant SaaS shape (Linear/Notion/Figma/WorkOS). Two sharp edges to encode in `PRODUCT_MODEL.md`:
  - *Progress Engine must stay thin* — build the savage flagship as a concrete rich subsystem; extract only the shared spine (`target + per-member status + rollup`) as a **discriminated union**, not a generic engine with `if (track==='savage')` branches or a plugin registry (Sandi Metz, "The Wrong Abstraction"). Inline back the moment shared code grows a flagship branch.
  - *Person↔Static data-ownership ambiguity* — model dual-owned data (availability, character-in-this-static) as **`person default + optional per-membership override`** now, before a retrofit forces a migration. Rule: "if leaving a static erases it → Static-layer; if it survives → Person-layer."
- **IA / flow map — SOUND.** Shallow depth, visible tabs > hamburger, 4 destinations = sweet spot, ⌘K as accelerator. Guardrails (already consistent with the spec): actions aren't tabs ("log loot" is a button + ⌘K); the rail stays one contextual level; ⌘K never the only path + needs a visible affordance.
- **Theme / design-system approach — SOUND**, with the §0 reframe: tokens are right but insufficient; enforcement + types + structure are what prevent regression.
- **Mockups — SOUND as scaffolds.** Structure/flow authoritative; filler is noise; atoms drop in from the DS. The page-by-page validation comes *after* the DS atoms/contracts are locked (F5).

**Verdict:** not over-engineered overall; an appropriately-scoped application of mainstream patterns. The one place to actively *resist* over-engineering is the Progress Engine.

**Top 3 risks to watch:** (1) Progress-Engine generality creep; (2) Person↔Static ownership ambiguity; (3) "one component per job" decaying without machine enforcement.

---

## 2. The phases (dependency-ordered)

| Phase | Scope | Depends on | Status |
|---|---|---|---|
| **F0 — Lock remaining decisions** | Finalize 3 open items in the canonical docs: **nav-rail visual standard** (research-backed: 72px, recessed one tonal step darker, 1px border / no shadow, rail-owns-corner, filled-icon + pill active, a11y), **icon lexicon as a glyph-morpheme table** (each glyph one fixed meaning, used only & always for it — `↗`=leaves app, magnifier=search, chevron=disclosure, kebab=overflow, drag-handle=reorder), **goals/progression/content/raids → "Raids → tier → fights; Prog = a status, not a page."** Plus doc-wording fixes (9px→12px floor; `surface-elevated` intent; container widths). | docs only | pending |
| **F1 — Token pipeline + parity** | Wire `tokens.json` → app via a **custom data-driven generator** (`frontend/scripts/build-tokens.mjs`; Style Dictionary v5 and Terrazzo were evaluated and **rejected** — neither emits the exact legacy CSS) + a single Tailwind 4 `@theme`; **full parity** with the live `index.css`; parity harness + `pnpm tokens:check` CI drift guard; `PageContainer` tier rename. See `specs/2026-06-27-design-token-parity-wiring-design.md` + PR #155. | F0 doc-fixes (folded in); otherwise independent | ✅ **DONE** — merged via #155 (2026-06-28) |
| **F2 — Anti-regression scaffolding** | `git diff --exit-code` generated-matches-source CI guard (pairs with F1) · **`jscpd`** (find existing duplicates — the literal "update one, miss six") + **`knip`** (delete stale copies) · **`eslint-plugin-boundaries`** (UI/primitives never import features; Ring-0 never imports outward) · **`jsx-a11y`** recommended + a small **`@axe-core/playwright`** scan on 3–5 key views (the contrast net jsdom can't see) · ratchet the existing design-system lint **warn→error** per area. | F1 (guard), F4 boundary rules can co-land | **next** |
| **F3 — Component contracts + illegal-states** | Convert primitives (Button, etc.) to **discriminated-union props** + `assertNever` exhaustiveness · write component **contracts** (anatomy/variants/states) in `DESIGN_SYSTEM.md` · **rebuild `/docs/design-system`** to render *from* tokens (keep/rewrite/delete/add triage already done — see token spec §9) · write contracts for the new components (rail, top bar, spine, ⌘K, unified recipient picker, gear-board cell, track card, attention row). | F1, F0 (icon lexicon, rail standard) | pending |
| **F4 — Frontend structure** | Document + enforce the **feature-slice + shared-layer** model: promotion rule ("≥2 features use it → it moves to shared, behind a public API"), Ring-mapping (Ring-0 core slices stable; rings depend inward only), **one Zustand store per domain/ring** (cross-store coordination via explicit utilities, never store-reaching-into-store), Person/Static module boundary mirrored frontend (stores) + backend (routers/`permissions.py`). FSD-*lite* — adopt the two load-bearing ideas, skip the full taxonomy. | F2 (boundary lint) | pending |
| **F5 — Mockup validation pass** | Page-by-page, element-by-element, against the now-real DS standard; tag each element **existing / refine / new**; produce the screen→components map. | F3 | pending |
| **F6 — Build Ring 0 on the foundation** | Rail → app shell (top bar + spine) → Home → Roster (Cards⇄Board) → Loot (Priority + **unified recipient picker** + History) → Schedule. Each screen **consolidates** its duplicated predecessors into one owned component. | F3, F4, F5 | pending |

Then Rings 1→3 per `PRODUCT_MODEL.md §7`.

**Throughline:** F1 (tokens) + F2 (enforcement) + F3 (types/contracts) + F4 (structure) together *are* the scalable foundation — no single one suffices. F5/F6 build on bedrock.

---

## 3. Adopt-now vs defer (solo-maintainer scaling)

Research was explicit that fixed-cost infra only pays off across a team. For this project:

- **Adopt now (highest leverage):** `jscpd` once + `knip`; TS discriminated-union props; the `git diff --exit-code` token guard; `jsx-a11y` + a small `@axe-core/playwright` contrast scan; `eslint-plugin-boundaries`.
- **Adopt later, scoped:** visual-regression testing — when reached, prefer **Vitest 4 `toMatchScreenshot`** (reuses the existing runner; baselines generated CI-only in a pinned Playwright Docker image) or **Chromatic free tier** (5k snaps/mo, zero local-vs-CI font flake); scope to `primitives/`+`ui/`, never pixel-gate full pages.
- **Skip at this scale:** Storybook (the in-app `/docs/design-system` route already documents contracts and *can't* drift from production) — reconsider only as a delivery vehicle for VRT/a11y later; multi-brand theming infra; a published DS package; 100% a11y automation; custom transforms for composite token types not in use.

---

## 3.1 Known conformance debt (surfaced during F1 visual check)

F1's manual visual check surfaced existing **light-mode conformance bugs**: several cards render with hardcoded dark backgrounds that ignore `[data-theme="light"]` — e.g. `MorePage.tsx:307` (`rgba(14,8,8,1)` gradient), and the cards in `GearSyncDashboard.tsx` (Loot Log → Sync) and `ScheduleUpcomingPanel.tsx` (Schedule). These are **pre-existing, not F1 regressions** — F1 touched none of these components, and the parity harness proved every token value unchanged; they are exactly the *"~181 inline hardcoded colors bypassing tokens"* debt this initiative targets. **Resolution:** F2's `no-inline-color` lint ratchet (warn→error) + a conformance sweep will catch them, and most live on **old-IA pages slated for replacement** (`More` is deleted, `Loot Log`/`Schedule` rebuilt in F6) — so they largely resolve at rebuild. Do **not** fix piecemeal now; that's wasted effort on pages headed for replacement.

---

## 4. Git base (settled 2026-06-27)

`redesign/foundation` **is** the single integration base = `main` + the full former #146–#154 PR stack (linear, in order) + the redesign doc commits. No fork/merge needed. The 9 stacked PRs were **closed as superseded**; `feat/plugin-browser-auth` deleted (merged via #89); `feature/solo-player-profile` left untouched (contributor's, merged via #129). All redesign work builds on `redesign/foundation`; it lands in `main` via **one** PR when ready (optionally per-phase child branches PR'd into `redesign/foundation` first).

---

## 5. Open sequencing note

**F1 is independent of F0's structural decisions** (parity ports atoms that already exist; the rail/icon/vocabulary calls feed F3). So F1 can begin immediately; F0's three decisions are locked alongside/just-ahead of F3 when they're actually consumed. The only F0 item F1 touches is the doc-wording fix, which F1 already carries.
