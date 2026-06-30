# Foundation Roadmap — Redesign Implementation Sequence

> **Status:** In execution · updated 2026-06-30 · integration base `redesign/foundation` (head `c95db5d`)
> **Progress:** **F0 ✅ · F1 ✅ · F2 ✅ · F3 ✅ · F4 ✅ · F5 ✅ — all merged into `redesign/foundation`** (F0 #157, F1 #155, F2 #158 `2ffde63`, F3 #159 `ee03eab`, F4 #160 `2e26e02`, F5 #162 `5195d45`). **F6 is now under way as shell-first slices (§2.1): F6a ✅ merged (#163, squash `c95db5d`) — F6b (Home) is NEXT.** Each phase = a branch off `redesign/foundation` → PR → squash-merge into foundation; `foundation → main` lands everything at the end. Release notes are at **v2.0.2** (F4/F5/F6a were doc-only/internal, no bump).
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
| **F0 — Lock remaining decisions** | Finalize 3 open items in the canonical docs: **nav-rail visual standard** (research-backed: 72px, recessed one tonal step darker, 1px border / no shadow, rail-owns-corner, filled-icon + pill active, a11y), **icon lexicon as a glyph-morpheme table** (each glyph one fixed meaning, used only & always for it — `↗`=leaves app, magnifier=search, chevron=disclosure, kebab=overflow, drag-handle=reorder), **goals/progression/content/raids → Track-centric: Track / Tier / Fight / Prog-as-status / "Goals" retired.** | docs only | ✅ **DONE** — locked in `DESIGN_SYSTEM.md §3.9` (rail), `§4.1` (lexicon), `§2.3` (vocab) and `REDESIGN_SPEC.md §10` (glossary) |
| **F1 — Token pipeline + parity** | Wire `tokens.json` → app via a **custom data-driven generator** (`frontend/scripts/build-tokens.mjs`; Style Dictionary v5 and Terrazzo were evaluated and **rejected** — neither emits the exact legacy CSS) + a single Tailwind 4 `@theme`; **full parity** with the live `index.css`; parity harness + `pnpm tokens:check` CI drift guard; `PageContainer` tier rename. See `specs/2026-06-27-design-token-parity-wiring-design.md` + PR #155. | F0 doc-fixes (folded in); otherwise independent | ✅ **DONE** — merged via #155 (2026-06-28) |
| **F2 — Anti-regression scaffolding** | `git diff --exit-code` generated-matches-source CI guard (pairs with F1) · **`jscpd`** (find existing duplicates — the literal "update one, miss six") + **`knip`** (delete stale copies) · **`eslint-plugin-boundaries`** (UI/primitives never import features; Ring-0 never imports outward) · **`jsx-a11y`** recommended + a small **`@axe-core/playwright`** scan on 3–5 key views (the contrast net jsdom can't see) · ratchet the existing design-system lint **warn→error** per area. | F1 (guard), F4 boundary rules can co-land | ✅ **DONE** — merged via #158 (`2ffde63`). Shipped: `ci.yml` gates `redesign/**` PRs (CI now self-runs on every phase PR); jscpd fail-on-new + knip baseline (+17 orphan files deleted); boundaries **v6** (`boundaries/dependencies`, needs `import/resolver` node-extensions or it silently no-ops on `.tsx`); jsx-a11y warn-global/error-on-clean-shared-layer; design-system lint test-exclusion + global `no-raw-select/textarea` + shared-layer 4-rule lock. **Surfaced a WCAG AA token-debt fix (v2.0.1):** light accent `#0f9688`→`#0c7d71`, dark muted `#52525b`→`#8a8a94`. |
| **F3 — Component contracts + illegal-states** | **(Scoped down from the original bullet, per session decisions.)** Discriminated-union/illegal-states type-safety on the **high-value existing primitives** (Button) + reconcile `DESIGN_SYSTEM.md` to the **real** variant set (**bless, don't purge**) + cheap token-AA pickups. **Deferred:** contracts for *unbuilt* components (rail/top-bar/spine/⌘K/recipient-picker/etc.) → **F6** (written with each component); the **`/docs/design-system` page rebuild** → **post-F6** (the markdown `DESIGN_SYSTEM.md` is the build canon; the page is the showroom and can lag); `nav.*`/motion/density token gaps → later. | F1, F0 (icon lexicon, rail standard) | ✅ **DONE** — merged via #159 (`ee03eab`). Shipped: Button `rightIcon`→lexicon-bound `trailing?: 'chevron'\|'external'` (decorative arrows uncompilable); Button `children` required (icon-only→IconButton; N=0, free); all 8 Button + 4 IconButton variants **blessed** (none purged — all in real use); IconButton contract added; Tag/Tabs documented as DU exemplars; `@ts-expect-error` type-tests lock the guarantees. **No `assertNever`** — codebase uses exhaustive `Record<Variant,string>` lookups (no switches) which already make a missing variant a compile error; the type-test proves it. token-AA (v2.0.2): light `membership-owner`/`gear-tome` `#0f9688`→`#0c7d71`, accent hover `#0d7a6e`→`#0a6b60`. |
| **F4 — Frontend structure** | Document + enforce the **feature-slice + shared-layer** model: promotion rule ("≥2 features use it → it moves to shared, behind a public API"), Ring-mapping (Ring-0 core slices stable; rings depend inward only), **one Zustand store per domain/ring** (cross-store coordination via explicit utilities, never store-reaching-into-store), Person/Static module boundary mirrored frontend (stores) + backend (routers/`permissions.py`). FSD-*lite* — adopt the two load-bearing ideas, skip the full taxonomy. **Note:** F2 already shipped the leaf-level boundary rule (shared layer ✗ imports features) via `eslint-plugin-boundaries`; F4 extends it to the full Ring-aware graph. | F2 (boundary lint) | ✅ **DONE** — merged via #160 (`2e26e02`). Shipped: `design/redesign/FRONTEND_STRUCTURE.md` (taxonomy/promotion rule/one-store-per-domain/three-tier Ring map/Person↔Static); 11-element Ring-aware `boundaries/elements` + store rules at error (store✗store w/ one inline exception `viewAsStore→authStore`; store✗component **value-only** via `dependency:{kind:'value'}`; shared✗store/page/service restored); ring-inward rules at error + **28-edge `eslint-suppressions.json`** (per-file net-new fail-on-new); `no-restricted-imports` closes the `@`-alias bypass in components/stores; `backend/ARCHITECTURE.md` doc-only Person↔Static note. **NO file moves** (F6 rebuilds Ring-0). `checkInternals:true` global (no same-type disallow); `admin` exempt as importer only (ring→admin disallowed). Internal release note, no version bump. |
| **F5 — Mockup validation pass** | Page-by-page, element-by-element, against the now-real DS standard; tag each element **existing / refine / new**; produce the screen→components map. | F3, F4 | ✅ **DONE** — merged via #162 (`5195d45`). Shipped: `specs/f5-screen-components-map.md` — 7 element-set tables (shell chrome + Home/Roster-Cards/Roster-Board/Loot-Priority/Loot-History/Schedule), every element tagged existing/refine/new and grounded against a real `frontend/src/components/` path or a catalogued name; a **27-entry new-component catalog** + an explicit predecessors→one-owned-component consolidation map; a recurring-component watchlist (canonical names) so synthesis dedups mechanically. Player Hub / Static Finder / flow-map light-passed (Ring-1, deferred). Doc-only, no version bump. |
| **F6 — Build Ring 0 on the foundation** | Rail → app shell (top bar + spine) → Home → Roster (Cards⇄Board) → Loot (Priority + **unified recipient picker** + History) → Schedule. Each screen **consolidates** its duplicated predecessors into one owned component. Consumes F5's screen→components map as the build manifest (27-component catalog + consolidation map). **Decomposed into shell-first vertical slices F6a–F6e (§2.1).** | F3, F4, F5 | **in progress — F6a ✅ merged (#163 `c95db5d`); F6b next** |

Then Rings 1→3 per `PRODUCT_MODEL.md §7`.

---

## 2.1 F6 sub-phases (shell-first vertical slices)

F6 is too large for one spec, so it runs as a **mini-roadmap of vertical slices** — each its own spec → plan → subagent-driven execution → PR → squash-merge, exactly like F1–F5. Watchlist shared components (CardShell, PlayerIdentity, SegmentedToggle, ProgressBar, EmptyStateInvite…) are built **into `shared/` the first time a slice consumes them** — F5's whole-screen validation is the promotion evidence, so this is not speculative. The 4-tab spine (**Home · Roster · Loot · Schedule**) is locked; **Schedule stays a spine tab** (not woven into Home).

| Slice | Scope | Depends on | Status |
|---|---|---|---|
| **F6a — Shell** | 72px Person-layer rail + top bar + 4-tab spine + ⌘K (affordance + navigate-only) + skip link, mounted at a **parallel `/v2` route** (`?shell=v2`) so the live `GroupView` is untouched. Enabling refactor: extract GroupView's 7 inline `{pageMode===x}` tab blocks into importable components (preserve legacy `?tab=` aliases; fix the `goToTestStatic` selector bug during Roster extraction). Define `nav.*` + `surface.nav` + `motion.nav-pill` tokens; write CommandPalette (minimal)/SkipLink/NotificationBell contracts. Week clock = top bar (minimal); Settings = top-bar gear only. | F5 | ✅ **DONE** — #163, squash `c95db5d` (built via SDD: `GroupRoute` gate · `GroupViewContent` shared-content+slots · `GroupActionsContext`/`GroupActionModals` · 72px `AppRail` · 4-tab `Spine` · `TopBar`(StaticPicker+TierBreadcrumb+read-only week+`NotificationBell`+`SettingsGear`+ThemeToggle) · navigate-only `CommandPalette`+⌘K · `SkipLink` · `nav.*`/`surface.nav`/`motion` tokens). **MUST-RESOLVE before `?shell=v2` is exposed: mount the static settings panel in v2** (gear + palette "Open Settings" toggle `settingsPanelStore` but no host mounts in `NewShell`). |
| **F6b — Home** | Weekly-loop dashboard (`TwoRegionDashboard`); SessionRsvpCard (next-session), WeeklyLootSummaryCard, RosterReadinessCard, AttentionRow, StaticActivityFeed, TrackCard. Wired by passing `<Home/>` as the `overview` slot to `GroupViewContent` (slots architecture from F6a); legacy `StaticHomeTab` stays the fallback. Resolve the v2 settings-host mount here (pre-exposure). | F6a | **next** |
| **F6c — Roster** | Cards ⇄ Board (`SegmentedToggle`); CardShell, PlayerIdentity, ProgressBar(+Legend); GearBoard + GearBoardCell (re-homed gearsheet matrix / Split Planner). | F6a (Cards⇄Board axis shared w/ Loot) | pending |
| **F6d — Loot** | Priority · History; **unified `RecipientPicker`** (kills `QuickLogDropModal`+`AddLootEntryModal` forks); FloorCard/FloorDropRow/PriorityRow, FairnessSummary, WeekGroupHeader; **full week-clock semantics** (first real consumer of the shell week object). | F6a, F6c (PlayerIdentity, SegmentedToggle) | pending |
| **F6e — Schedule** | Sessions + RSVP (`SessionRsvpCard`, shared w/ Home) + `AvailabilityHeatmap` (read-only aggregate; per-member editing re-homed to Person layer via `PersonLayerEntryPoint`); WeekNavigatorStrip. | F6a, F6b (SessionRsvpCard), F6d (week clock) | pending |

As each slice rebuilds a Ring-0 domain, its entries are pruned from `frontend/eslint-suppressions.json` (`--prune-suppressions`) and the contrast harness is re-enabled on that screen. When all five slices have merged and the `/v2` route is at parity, flip it to the default route and delete the legacy `GroupView` chrome.

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

## 3.2 Follow-ups carried forward (after F2/F3) — pick up when relevant

- **Contrast harness is a LOCAL net, not CI-wired** (`frontend/e2e/contrast.spec.ts`, `pnpm test:contrast`, needs the dev stack on :5174/:8001). It asserts zero color-contrast on **landing** (dark+light); **design-system page + GroupView are `test.skip`** with documented residual page-level/§3.1 debt → re-enable as F6 rebuilds those screens. The a11y *CI* gate is the `jsx-a11y` lint.
- **`/docs/design-system` page rebuild (post-F6).** ~4,500-line hand-maintained showroom; rebuild to render *from* tokens once F6 has built the final components. Cosmetic vestige logged: a `grid-cols-2` with one child after F3 removed the USD demo.
- **Unbuilt-component contracts (F6).** Rail (locked in `DESIGN_SYSTEM.md §3.9`), top bar, spine, ⌘K palette, unified recipient picker, gear-board cell, track card, attention row, NavRow — write each contract *with* its component. `nav.*` component-tier tokens + motion + density tokens land here too. **F5's `specs/f5-screen-components-map.md` is the build manifest** — its 27-entry catalog names each unbuilt component (purpose + precursors + consolidation mandate) and each `refine` row names a specific change to a real component; F6 writes the full props/state contract per catalog entry as it builds.
- **Light role-color AA (partial).** F3 fixed `membership-owner`/`gear-tome`. If other light role/status tokens are used as normal-weight text on light surfaces, audit them for AA (same pattern as the accent fix).
- **`goToTestStatic` e2e helper is broken** (`frontend/e2e/helpers/auth.ts`): a `GroupView.tsx` substitutes-toggle `aria-label` "Show substitutes with main roster" matches `/Roster/i` in strict mode → breaks all smoke tests. **Pre-existing, not an F2/F3 regression** (confirmed at base). Needs its own ticket — disambiguate the selector or the aria-label.
- **Type-test gotcha (reusable).** `createElement(C, props, ...children)` type-checks the props object **separately** from positional children — so a `@ts-expect-error` test that passes children positionally is masked by a "children missing" error once `children` is required (fires for the wrong reason). Put `children` *inside* the props object (or use `Parameters<typeof C>[0]` direct assignment / JSX), and **toggle-verify** each (make legal → expect `TS2578` unused-directive). Green build is the false signal.

---

## 4. Git base (settled 2026-06-27)

`redesign/foundation` **is** the single integration base = `main` + the full former #146–#154 PR stack (linear, in order) + the redesign doc commits. No fork/merge needed. The 9 stacked PRs were **closed as superseded**; `feat/plugin-browser-auth` deleted (merged via #89); `feature/solo-player-profile` left untouched (contributor's, merged via #129). All redesign work builds on `redesign/foundation`; it lands in `main` via **one** PR when ready (optionally per-phase child branches PR'd into `redesign/foundation` first).

---

## 5. Open sequencing note

**F1 is independent of F0's structural decisions** (parity ports atoms that already exist; the rail/icon/vocabulary calls feed F3). So F1 can begin immediately; F0's three decisions are locked alongside/just-ahead of F3 when they're actually consumed. The only F0 item F1 touches is the doc-wording fix, which F1 already carries.
