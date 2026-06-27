# Plan L — Enforced Design Language: Make Drift Structurally Hard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop consistency drift at the source. The existing design-system already holds most of the design-language *intent* — but nothing **enforces** it, so new code branches from it. This plan makes the intended language **the path of least resistance and the only one CI accepts**: constrained component APIs that make illegal UI unrepresentable, lint/CI rules that fail on deviation, and the design-system as the single sanctioned source of building blocks. Then it audits existing code into conformance.

**Core philosophy (why this works where a guide alone failed):**
1. **The design-system is the canon** — not a parallel `DESIGN_LANGUAGE.md` that drifts. We extend the existing components + the `/docs/design-system` reference + the ESLint plugin (the enforcement seam that *already exists* and already blocks raw `<button>/<input>/<select>`). Docs *point at* the system; the system is the truth.
2. **Make illegal states unrepresentable** — a contributor should not be *able* to build the wrong thing easily. A `Tag` requires a `variant: 'label' | 'filter' | 'nav'` (so a tag can't silently navigate while looking inert); `Tabs` cannot navigate routes; color/size props accept only semantic tokens, not arbitrary strings. The API shape carries the rule.
3. **Catch the rest automatically** — extend the ESLint plugin + `check:design-system:strict` (already a required CI gate per CLAUDE.md) to fail on raw hex/inline colors, sub-`xs` text, `onClick` on bare text, `cursor-pointer` without an interactive role, and raw HTML where a primitive exists. Anything not prevented by API is caught by CI.
4. **Steer the next contributor** — `CLAUDE.md` + a short PR checklist point at the system, so humans *and* agents conform by default. (This is exactly what was missing when the new contributor added features.)

**Architecture:** **Phase 0–1 are foundational and land first** (constrained primitives + enforcement) so all in-flight work (Plans A–K) has a target it *can't* miss. **Phases 2–6** are audit-driven sweeps that bring existing code into conformance (each produces a categorized backlog, then fixes in reviewable batches). This plan **subsumes/coordinates** the concrete visual work in Plans F (modals/typography/Split-Planner), G (search/filters/tooltips), I (selectors/renames/More-tab), J (color tokens), K (JobSelector/TriStateToggle) — those execute fixes; L defines + *enforces* the standard and finds the rest.

**Tech Stack:** React 19 + TS (typed component APIs), Tailwind v4 tokens, the design-system ESLint plugin, `check:design-system` CI gate. Vitest.

> **Multi-PR by design.** Land Phase 0–1 before the sweeps. Enforcement starts as `warn` (legacy code remains green) and flips to `error` per-directory as each area is cleaned.

## Global Constraints

- NEVER add AI attribution to commits/PRs.
- All new UI uses the constrained primitives; `pnpm check:design-system` must pass.
- "static" not "group" in user-facing copy.
- **Release/version — per `docs/superpowers/ROADMAP.md` (one coordinated rollout):** add release-note **entries** under the single rollout version **`2.0.0`**, bundled per phase/batch (visible polish → public; audits/docs/enforcement → `internal: true`). **Do NOT bump `CURRENT_VERSION`** — only the stack-base branch (Plan A) sets it. This supersedes any per-plan "bump `CURRENT_VERSION`" wording in the steps below.
- Pre-PR gate: `cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test`.

## Concrete drift the user reported (audit seeds)

- **Appearance ≠ behavior:** "Synced just now" text navigates to Sync & Gear; Browse Catalog tags navigate; collection items mix clickable vs toggleable; buttons act as toggles and vice-versa.
- **Redundant paths (>1 way to do one thing):** delete static in Settings AND "… More"; the "… More" tab is nav cards; two static selectors (header + Player Hub Overview); two jump-to-roster paths on Overview; objective editing in the Overview trashcan flow AND the Objectives page; "Choose static schedule" on Availability silently navigates.
- **Inconsistency:** modals without icons; sentence vs Title case; Player Hub vs Static headers differ; tabs styled per-surface; font sizes; banners; titles waste vertical space; color without consistent meaning.

---

# Phase 0 — Enforcement audit: what's checkable vs API-preventable

## Task 0.1: Inventory the enforcement surface

**Files:** Read `eslint-design-system-plugin.js`, `scripts/check-design-system.*`, `components/ui`, `components/primitives`, `index.css`, the `/docs/design-system` page.

- [ ] **Step 1:** Document (in `docs/audits/enforcement.md`) what the design-system ALREADY enforces (raw element bans), what intent it encodes but doesn't enforce (colors, sizes, interaction semantics, tabs, headers), and for each unenforced rule decide the mechanism: **API-prevent** (constrained prop), **lint** (mechanizable), or **review-only** (document + checklist). This decides Phases 1–7. Commit the audit.
```bash
git add frontend/docs/audits/enforcement.md
git commit -m "docs(design): enforcement-surface audit (API vs lint vs review)"
```

---

# Phase 1 — Foundational enforcement (do BEFORE the sweeps)

## Task 1.1: Constrained primitives — make illegal UI unrepresentable

**Files:** extend/create in `components/ui` / `components/primitives`. Reuse Plan K's `TriStateToggle`/`JobSelector`.

- [ ] **Step 1: Tag with required semantic variant**

Create `Tag` (`{ variant: 'label' | 'filter' | 'nav'; ... }`). `label` = non-interactive (no pointer, no onClick allowed by type), `filter` = pressable toggle, `nav` = renders an affordance (chevron) and *requires* an `href`/`onNavigate`. A bare ambiguous tag is now a type error.

- [ ] **Step 2: `Tabs` that cannot navigate**

Create one `Tabs` component (in-surface view switch only; integrates `useUrlTabState`). It has no `href`/route API — switching routes must use a `Link`/`NavRow`, so tabs can't masquerade as navigation.

- [ ] **Step 3: `LinkText` / `NavRow`**

A styled-as-link text/row component for "navigational text" so things like "Synced just now" are a real, obviously-navigational component — never plain text with an `onClick`.

- [ ] **Step 4: Token-only color/size props**

Where components take color/size, type them to the semantic token union (e.g. `tone: 'accent' | 'success' | 'warning' | 'error' | 'muted'`) instead of `string`, so arbitrary hex can't be passed. `PageHeader` takes a fixed structure (icon + Title Case title + subtitle? + actions) so headers can't diverge.

- [ ] **Step 5:** Tests for each primitive (variant behavior, that disallowed combos are type/behavior-rejected). Commit.
```bash
git add frontend/src/components/ui/Tag.tsx frontend/src/components/ui/Tabs.tsx frontend/src/components/ui/LinkText.tsx frontend/src/components/layout/PageHeader.tsx frontend/src/components/ui/*.test.tsx
git commit -m "feat(ui): constrained design-language primitives (Tag/Tabs/LinkText/PageHeader)"
```

## Task 1.2: Extend the ESLint plugin + CI strict gate

**Files:** `frontend/eslint-design-system-plugin.js`, `scripts/check-design-system.*`

- [ ] **Step 1: Add rules (start `warn`)** for the mechanizable intent the plugin doesn't yet cover:
  - inline hardcoded colors (`style={{ color/background: #hex|rgb(a) }}`) + arbitrary `bg-[#]/text-[#]/border-[#]` (coordinate with Plan J).
  - sub-`xs` arbitrary text sizes `text-[<12px]` (coordinate with Plan F §5).
  - `onClick`/`onKeyDown` on bare `<span>/<p>/<div>` without `role`/link styling (interaction-semantics).
  - `cursor-pointer` on elements without an interactive role.
  - raw HTML where a primitive exists (extend the existing element bans to cover any new gaps).
  Allow `design-system-ignore` with a required justification comment.
- [ ] **Step 2:** Wire the new rules into `check:design-system` and the `:strict` variant used in CI. Keep `warn` globally; the per-area sweeps flip their directories to `error` as they clean.
- [ ] **Step 3:** Commit.
```bash
git add frontend/eslint-design-system-plugin.js frontend/scripts/check-design-system* frontend/eslint.config.*
git commit -m "chore(design): enforce colors/sizes/interaction-semantics via lint + strict CI gate"
```

## Task 1.3: Make the design-system the documented canon + steer contributors

**Files:** the `/docs/design-system` reference page, `DESIGN_SYSTEM_SUMMARY.md`, `CLAUDE.md`, a PR checklist.

- [ ] **Step 1:** Expand the interactive `/docs/design-system` page to show the canonical primitives + their `variant` semantics (Tag kinds, Tabs, LinkText, PageHeader, TriStateToggle) and the color/typography scale — so the *living* reference is the system itself. Add a concise "Design Language" section to `CLAUDE.md` (element-to-component mapping + "the design-system is the source of truth; raw HTML/colors/sizes are lint errors") and a PR checklist item. Keep any `DESIGN_LANGUAGE.md` thin — a pointer to the system, not a parallel spec.
- [ ] **Step 2:** Commit.
```bash
git add frontend/docs CLAUDE.md .github/pull_request_template.md
git commit -m "docs(design): design-system is the canon; contributor + agent guardrails"
```

---

# Phase 2 — Interaction-semantics sweep (appearance must match behavior)

## Task 2.1: Audit → `docs/audits/interaction-semantics.md`

- [ ] **Step 1:** With the new lint rules surfacing candidates, sweep for mismatches: `onClick` on text/tags, `cursor-pointer` on labels, `navigate(`/`href` inside tag/text-styled elements, toggles built as `Button`, buttons holding state. List `{file:line, current look, actual behavior, correct primitive}`. Cover Player Hub Overview ("Synced just now", checklist rows, status tiles), Browse Catalog tags, collection rows, the "… More" cards, schedule/roster/gear toolbars.

## Task 2.2: Fix in batches + flip the directory to `error`

- [ ] **Step 1:** Convert each to the canonical primitive (`Tag variant`, `Toggle`/`TriStateToggle`, `Tabs`, `LinkText`/`NavRow`, `Button`). After an area is clean, set the lint rules to `error` for that directory so it can't regress. Verify: every element looks like what it does.
```bash
git commit -m "fix(semantics): <area> elements match behavior; lint→error for <dir>"
```

---

# Phase 3 — IA / redundancy consolidation (one canonical home per action)

## Task 3.1: Map → `docs/audits/ia-redundancy.md` (decide each canonical home)

- [ ] **Step 1:** For each duplicated action, record the single home + what to remove/redirect. Decisions (seed):
  - **Delete static** → Settings panel only; remove from "… More".
  - **"… More" tab** (nav cards) → fold destinations into the rail/nav (Plan A); don't duplicate navigation as cards.
  - **Static selector** → header `ContextSwitcher` only; remove Player Hub Overview "My Statics" (Plan I §5).
  - **Jump to Roster (Overview)** → keep one affordance, remove the other.
  - **Edit objectives** → Objectives page only; remove the Overview inline trashcan/cancel edit (Overview displays, Objectives edits).
  - **"Choose static schedule" (Availability)** → make the affordance honest (it's navigation) or keep it in-page; pick one.

## Task 3.2: Execute consolidations (one per commit)

- [ ] **Step 1:** Remove the duplicate control, redirect entry points to the canonical home, confirm no lost functionality. Verify exactly one way per action.
```bash
git commit -m "refactor(ia): single canonical home for <action>"
```

---

# Phase 4 — Headers / titles → `PageHeader`

- [ ] **Step 1:** Audit `docs/audits/headers.md` (height, icon, case, subtitle, action placement, Player Hub vs Static divergence, wasted vertical space).
- [ ] **Step 2:** Migrate surfaces to the `PageHeader` primitive (Phase 1) — tight height budget, identical structure across Player Hub and Static. Commit per cluster.
```bash
git commit -m "polish(headers): <surface> adopts standard PageHeader"
```

---

# Phase 5 — Tabs → canonical `Tabs`

- [ ] **Step 1:** Audit `docs/audits/tabs.md` (GroupView, Player Hub, settings, schedule, history, collections, recruitment).
- [ ] **Step 2:** Migrate to the `Tabs` primitive (subsumes Plan E §9 reflow + Plan G tab consistency as the standard); keep URL-sync. Commit per surface.
```bash
git commit -m "polish(tabs): <surface> uses the canonical Tabs"
```

---

# Phase 6 — Color semantics

- [ ] **Step 1:** With Plan J tokens in place, audit `docs/audits/color.md`: accent=action/active, status colors only for status, role/membership consistent; flag misuse.
- [ ] **Step 2:** Fix misuses; with token-only color props (Phase 1) + lint (Phase 1), new misuse is largely prevented. Commit.
```bash
git commit -m "polish(color): consistent semantic color usage"
```

---

# Final — Release notes

- [ ] Per phase: `releaseNotes.ts` (visible polish → public + version bump; audits/docs/enforcement → `internal: true`). Full gate after each phase.

---

## Self-review notes (already applied)

- **Answers the user's point directly:** the gap was *enforcement*, not documentation. Phase 0–1 lead with constrained APIs (illegal UI unrepresentable) + lint/CI (deviations fail automatically) — drift becomes structurally hard, not just discouraged.
- **Design-system is the canon:** we extend the existing components + `/docs/design-system` + the ESLint plugin (the enforcement seam that already exists), not a parallel guide that drifts. Docs point at the system.
- **`warn`→`error` ratchet:** enforcement ships immediately as `warn` (legacy stays green) and flips to `error` per directory as each area is cleaned, so it tightens without a flag day.
- **Foundation-first:** Phase 0–1 land before the sweeps so Plans A–K (and future work) build against an enforced target.
- **Subsumes/coordinates** F/G/I/J/K (they execute concrete fixes; L makes the standard enforceable and finds the rest). Every user-named redundancy has a named canonical home.
- **Steers the next contributor** (CLAUDE.md + PR checklist + the living reference) — the missing guardrail that let the drift happen.
```
