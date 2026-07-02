# Plan G — Polish Batch 3 (sticky divider, search icons, filter dropdowns, visibility rename, tooltips)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five polish items: (1) a divider under the sticky header in the Collections & Goals tab, (2) a left Search icon on every search field, (3) convert single-select filter chip rows (Browse Catalog: Reward type / Expansion / Source) to inline dropdowns, (4) rename "Who can see this profile?" → "Visibility", (5) a site-wide tooltips pass for icon-only / unlabeled controls.

**Architecture:** Mostly small, localized edits plus two sweeps. The `Input` primitive already supports `leftIcon`, so the search-icon work is applying a prop consistently. Filter dropdowns reuse the design-system `Select`. The tooltips pass reuses the existing `Tooltip` primitive and is audit-driven.

**Tech Stack:** React 19 + TS, Tailwind v4, design-system `Input`/`Select`/`Tooltip`. Vitest/@testing-library.

> **Line numbers are point-in-time — match on code/strings and verify before editing.**

## Global Constraints

- NEVER add AI attribution to commits/PRs.
- Design system: primitives/tokens only; run `pnpm check:design-system`.
- "static" not "group" in user-facing copy.
- **Release/version — per `docs/superpowers/ROADMAP.md` (one coordinated rollout):** add release-note **entries** to `frontend/src/data/releaseNotes.ts` under the single rollout version **`2.0.0`** (public entry with `description`/`pr`/`prTitle` + full ISO date for user-facing; `internal: true` for non-visible). **Do NOT bump `CURRENT_VERSION`** — only the stack-base branch (Plan A) sets it. This supersedes any per-plan "bump `CURRENT_VERSION`" wording in the steps below.
- Pre-PR gate: `cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test`.

## Verified reference points

- `Input` (`components/ui/Input.tsx`) already has `leftIcon`/`rightIcon` props (with icon-aware padding). Use `leftIcon={<Search className="w-4 h-4" />}`.
- Player Hub catalog: `components/profile/CollectionsCenterTab.tsx` — Browse Catalog search ~line 869 ("Search rewards or duties…", **no icon**); the Reward type / Expansion / Source single-select chip rows are just above it.
- Group catalog: `components/collections/CatalogBrowse.tsx` — already hand-rolls a Search icon (absolute-positioned, ~169) + has the same 3 filter rows.
- Visibility label: `components/profile/PreviewShareTab.tsx:120` — `Who can see this profile?`.
- `Tooltip` (`components/primitives/Tooltip.tsx`): `{ children, content, side?, align?, sideOffset?, delayDuration?, disabled? }`.

---

# Section 1 — Sticky-section divider (Collections & Goals)

**Diagnosis:** In `CollectionsCenterTab.tsx` the stats + filters + search form a sticky header above the scrolling reward list, but there's no visual separation, so content scrolls flush against it.

## Task 1.1: Add a divider under the sticky header

**Files:** Modify `frontend/src/components/profile/CollectionsCenterTab.tsx` (and `components/collections/CatalogBrowse.tsx` if it shares the sticky pattern)

- [ ] **Step 1:** Identify the sticky header wrapper (the element holding the status chips + filter rows + search). Add a bottom border/divider to it so the scrolling list reads as separate — e.g. `border-b border-border-default` on the sticky container, or a subtle shadow when scrolled (`after:` gradient). Prefer a simple `border-b border-border-subtle` plus a tiny `pb-3`/`mb-3` for breathing room. Ensure the divider spans the full content width and stays put while the list scrolls under it.
- [ ] **Step 2: Manual:** scroll the Browse Catalog list — a clean divider separates the sticky controls from the scrolling rewards.
- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/profile/CollectionsCenterTab.tsx
git commit -m "polish(collections): divider under the sticky catalog header"
```

---

# Section 2 — Search icon on every search field

**Diagnosis:** `Input` supports `leftIcon` but most search fields don't pass it; `CatalogBrowse` hand-rolls an absolute-positioned icon (inconsistent). Search inputs found: `CollectionsCenterTab.tsx:869`, `CatalogBrowse.tsx:170` (manual icon), `AdminDashboard.tsx:401`, `admin/AdminStatics.tsx:354`, `history/AllWeeksView.tsx:446`, `Discover.tsx:380`, plus job/searchable selects (`JobPicker`, `SearchableSelect`, `InlinePlayerEdit`) which have their own search affordance.

## Task 2.1: Apply `leftIcon={<Search/>}` to all search Inputs

**Files:** the search-input files above.

- [ ] **Step 1: Sweep**

For each plain search `Input` (placeholder starting with "Search"), add `leftIcon={<Search className="w-4 h-4" />}` (import `Search` from `lucide-react`). For `CatalogBrowse.tsx`, **remove the manual absolute-positioned `<Search>` + `relative` wrapper** and use the `Input` `leftIcon` prop instead (consistency). Leave `SearchableSelect`/`JobPicker` internal search fields as-is if they already show a search affordance — but add the icon if trivially consistent.

- [ ] **Step 2: Verify**

Run: `cd frontend && grep -rn 'placeholder="Search' src --include=*.tsx` and confirm each plain Input now passes `leftIcon`. `pnpm build && pnpm check:design-system`.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/profile/CollectionsCenterTab.tsx frontend/src/components/collections/CatalogBrowse.tsx frontend/src/pages/AdminDashboard.tsx frontend/src/pages/admin/AdminStatics.tsx frontend/src/components/history/AllWeeksView.tsx frontend/src/pages/Discover.tsx
git commit -m "polish(search): consistent left Search icon on all search fields"
```

---

# Section 3 — Single-select filters → inline dropdowns

**Diagnosis:** Browse Catalog's Reward type / Expansion / Source are single-select chip *rows* (3 stacked lines, ~3 chips→8 chips wide). Each is mutually exclusive (only one active), so they're better as compact `Select` dropdowns on one line, saving vertical space.

## Task 3.1: Convert the three filters to a single row of Selects

**Files:** Modify `frontend/src/components/profile/CollectionsCenterTab.tsx` (primary) and `frontend/src/components/collections/CatalogBrowse.tsx` (mirror for consistency)

**Interfaces:** state stays the same (`activeCategory`/`activeExpansion`/`activeSourceType` with an `'all'` sentinel).

- [ ] **Step 1: Replace each chip row with a `Select`**

For each of the three filters, build options from the existing chip data (`[{ value: 'all', label: 'All <type>' }, ...optionsWithCounts]`) and render a `Select` bound to the existing state setter. Lay the three `Select`s on **one line**: `<div className="flex flex-wrap items-center gap-2">` with each `Select` `className="min-w-[9rem]"` and a small leading `Label` or the placeholder conveying the filter name (e.g. "Reward type"). Keep counts in the option labels where they exist (e.g. "Mount 41"). Preserve the "All" reset semantics.

- [ ] **Step 2: Keep a Clear-filters affordance**

If `hasActiveFilters`, show a small "Clear" `Button` (ghost) at the end of the row that calls the existing `clearFilters()`.

- [ ] **Step 3: Verify**

`pnpm build && pnpm test`. Manual: the three filters sit on one row as dropdowns; selecting narrows the list exactly as the chips did; "All" resets; vertical space is reclaimed.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/profile/CollectionsCenterTab.tsx frontend/src/components/collections/CatalogBrowse.tsx
git commit -m "feat(catalog): single-select filters become inline dropdowns"
```

> Note: keep the top status chips (Hunting / Shared / Can buy / Public) as-is — those are status counts, not single-select filters.

---

# Section 4 — Rename "Who can see this profile?" → "Visibility"

**Files:** Modify `frontend/src/components/profile/PreviewShareTab.tsx` (line ~120)

- [ ] **Step 1:** Change the `<Label>` text `Who can see this profile?` → `Visibility`. Keep the control + helper text below it unchanged (the options still explain who sees what).
- [ ] **Step 2: Commit**
```bash
git add frontend/src/components/profile/PreviewShareTab.tsx
git commit -m "polish(profile): rename profile sharing label to Visibility"
```

---

# Section 5 — Site-wide tooltips pass

**Diagnosis:** Many icon-only buttons and terse controls lack tooltips. The `Tooltip` primitive is established and used widely; this is an audit + fill-in, not new infra.

## Task 5.1: Audit unlabeled / icon-only controls

**Files:** Read-only.

- [ ] **Step 1: Enumerate candidates**

Find icon-only / terse interactive elements that lack a `Tooltip` and a clear text label. Useful searches:
- `grep -rn "IconButton" src --include=*.tsx` → IconButtons (many are icon-only).
- `grep -rn "aria-label" src --include=*.tsx` near buttons without an adjacent `<Tooltip>`.
- Walk the key pages/areas: header controls, sidebar/rail items (already tooltipped), Player/Gear cards, loot toolbar, schedule toolbar, split planner, catalog rows (Want/Farming/Have, the chevron), gear status circles, admin tables.
Produce a checklist of `{file:line, control, proposed tooltip copy}`. This checklist IS the task list for 5.2. Prioritize: (a) icon-only buttons, (b) status badges whose meaning isn't obvious (e.g. "Needs alt", role badges, membership badges), (c) truncated text that hides content.

## Task 5.2: Add tooltips per the checklist (commit per area)

**Files:** the components from 5.1.

- [ ] **Step 1: Wrap each flagged control in `<Tooltip content={...}>`**

Use concise, helpful copy (verb + what it does, or what a badge means). For controls that already have an `aria-label`, the tooltip should match/expand it. Follow the existing rich-tooltip pattern where useful (title + small description, like the header/sidebar tooltips). Don't tooltip elements that already have visible labels unless they're truncated.

- [ ] **Step 2: Respect existing patterns**

Reuse `Tooltip` with sensible `side`/`delayDuration`. For dense tables, prefer short single-line tooltips; for primary actions, the title+description style. Verify no tooltip breaks layout or traps focus.

- [ ] **Step 3: Verify + commit per area**

`pnpm build && pnpm check:design-system && pnpm test`. Manual: hover icon-only controls across the audited pages → every one explains itself.
```bash
git add <files for this area>
git commit -m "polish(a11y): add tooltips to icon-only controls (<area>)"
```

> Scope: cover the high-traffic areas (header, cards, loot/schedule/split-planner toolbars, catalog rows, admin) in this plan. Treat truly exhaustive coverage as iterative — the audit checklist makes remaining gaps visible for follow-up.

---

# Final — Release notes + verification

**Files:** Modify `frontend/src/data/releaseNotes.ts`

- [ ] **Step 1:** Add public entries covering: catalog header divider, search icons, inline catalog filter dropdowns, the Visibility rename, and the tooltips pass. `description` + `pr` + `prTitle` + full ISO date; bump `CURRENT_VERSION`.
- [ ] **Step 2:** Full gate — `cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test`; `cd scripts && npm test`.
- [ ] **Step 3:** Commit
```bash
git add frontend/src/data/releaseNotes.ts
git commit -m "docs(release): polish pass batch 3"
```

---

## Self-review notes (already applied)

- **Search icons** reuse the existing `Input.leftIcon` (no new infra) and also de-duplicate `CatalogBrowse`'s hand-rolled icon onto the standard prop.
- **Filter dropdowns** keep the exact existing filter state/semantics (`'all'` sentinel, counts) — only the presentation changes; status chips (Hunting/Shared/…) are intentionally left as counts.
- **Two catalog browsers** exist (`CollectionsCenterTab` Player Hub + `CatalogBrowse` group) — both updated for divider/search/filters so they stay consistent.
- **Tooltips pass is audit-driven** (5.1 → 5.2) and scoped to high-traffic areas with an explicit follow-up note, rather than an unbounded sweep.
- **Visibility rename** changes only the label; the explanatory options/help text stay so meaning isn't lost.
- **Line numbers are point-in-time** — verify before editing.
```
