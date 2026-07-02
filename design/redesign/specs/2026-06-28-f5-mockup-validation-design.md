# F5 — Mockup Validation Pass (design spec)

> **Phase:** F5 of the foundation roadmap (`FOUNDATION_ROADMAP.md §2`). Depends on F3 (component contracts) + F4 (frontend structure). Unblocks F6 (build Ring-0 screens).
> **Status:** spec for review · 2026-06-28 · branch `redesign/f5-mockup-validation` off `redesign/foundation` (`b573525`).
> **Authority:** derives from `REDESIGN_SPEC.md` (§5 screen blueprint, §7 re-homing map, §8 mockup fidelity, §12 deliverables), `DESIGN_SYSTEM.md` (component contracts + §7 open gaps), and the mockups under `design/redesign/mockups/`.

---

## 1. What F5 is (and is not)

**Is:** a page-by-page, element-by-element validation of the mockups against the *now-real* design system — both the `DESIGN_SYSTEM.md` contracts **and** the actual built components in `frontend/src/components/`. Every mockup element is tagged **existing / refine / new** and linked to the current component(s) it consolidates. The output is the **screen→components map** — the migration-grade build input F6 consumes.

**Is not:** writing code, moving files, or authoring full DS contracts for the new components. Per the roadmap's explicit F3→F6 deferral and `REDESIGN_SPEC.md §8` ("formalize after IA is locked; the component & states sheet comes after the screen set is approved"), F5 **names and catalogs** new components — it does not spec their props/states. That is F6 work, written with each component.

**Doc-only.** F5 touches nothing under `frontend/src/` or `backend/app/` — pure analysis under `design/redesign/`. Consequence: the release-notes CI gate (which fires on `frontend/src`/`backend/app`) does **not** trigger; no release note is required unless a stray src file is touched, in which case add an `{ internal: true }` entry with no version bump (F4 precedent).

---

## 2. Deliverable — two files

Mirrors F4's spec + measured-artifact split (`f4-frontend-structure-design.md` + `f4-import-inventory.md`):

1. **`specs/2026-06-28-f5-mockup-validation-design.md`** — this file. The rubric, method, scope, format, and how the map feeds F6.
2. **`specs/f5-screen-components-map.md`** — **the deliverable.** Per-element tables (one per element set, §4), the consolidated **new-component catalog** (§6), and the cross-screen **consolidation map** (§7).

---

## 3. Classification rubric (the heart of F5)

Every element gets exactly **one** tag, and every tag must be **grounded in the real codebase**. A row tagged `existing`/`refine` with no real component path, or `new` with no catalog entry, is an **invalid row** — the unverified-claim defect the reviewer rejects (this is the F3-`createElement` lesson: a green-looking artifact that asserts something untrue).

| Tag | Means | The row MUST cite |
|---|---|---|
| **existing** | A built component already covers this element **and** conforms to `DESIGN_SYSTEM.md` (tokens, vocabulary, the relevant §3 contract). Drops in as-is. | the component path (`components/…`) |
| **refine** | A real component exists but needs change before it's drop-in: token/conformance fix, prop/API change, or **fork-consolidation** (two forks collapse to one). | in-place single-component: path(s) + the specific change; consolidating/renamed (see §6): catalog NAME + the change |
| **new** | No component covers it; F6 builds it. | the new-component catalog name (§6) |

**Grounding rules (non-negotiable, this is what makes the map trustworthy):**

- Validate against **both** sources of truth: the `DESIGN_SYSTEM.md` contract **and** the actual `frontend/src/components/` tree. `UI_COMPONENTS.md` is a finding aid — cross-check it, never trust it blind (it can be stale).
- "Looks new" ≠ "is new." Check for a precursor first. Known traps surfaced while scoping: the Cards⇄Board **segmented toggle** already exists (`components/ui/GroupViewToggle.tsx`, `components/ui/ViewModeToggle.tsx`) → likely `refine`; the **unified recipient picker** has a precursor (`components/primitives/PopoverSelect.tsx` + `DESIGN_SYSTEM §3.6`) → `refine`/specialize, not `new`; **dashboard cards** exist (`components/ui/DashboardCard.tsx`, `components/dashboard/`) → `refine`; **empty states** exist (`components/ui/EmptyState.tsx`). Defaulting these to `new` is a classification error.
- The **migration link** is mandatory on every `refine`/`new` row that replaces something: name the current component(s) it consolidates (e.g. the recipient picker replaces both `components/loot/QuickLogDropModal.tsx` **and** `components/history/AddLootEntryModal.tsx`). F6 needs the *predecessors*, because each F6 screen "consolidates its duplicated predecessors into one owned component." A map that says "new: recipient picker" without naming the two forks it kills is half-useless.
- **Filler is noise, not a component.** The mockups "contain placeholder/filler visuals — treat layout as the signal, filler as noise" (`HANDOFF.md`). Tag only real *structural* elements. Decorative filler, placeholder copy/data, and one-off layout scaffolding are **skipped — not tagged, not catalogued.** Never mint a catalog entry from a mockup's fake content; that is exactly how the catalog becomes a junk drawer. When unsure whether something is structure or filler, leave a "filler? — confirm" note rather than minting a `new`.
- **Retired-IA elements have no home — flag, don't tag.** If a mockup happens to render an element from the retired IA (a Gear tab, "Loot Log," "More," "Overview," "Who Needs It," etc.), do **not** give it an existing/refine/new tag. Record it as a one-line `retired-IA — no home, drop` note so it's visible to the reviewer but never promoted into the build manifest.
- Tags are claims about the codebase; the reviewer **re-verifies each one against actual code**, not against the agent's prose.

---

## 4. Scope — element sets (the pseudo-screens)

Full-depth, element-by-element tables for the **shell chrome + the Ring-0 spine + Schedule** — exactly what F6 builds next. Seven element sets:

| # | Element set | Mockup source | Notes |
|---|---|---|---|
| 0 | **Shell chrome** | `DESIGN_SYSTEM §2.1/§3.9`, top-bar/spine across all mockups | Context rail · top bar (static·track·week switcher + ⌘K affordance + notifications + settings gear + theme) · in-static spine (4 tabs) · ⌘K palette overlay. Wraps every screen; not itself a screen. Rail is LOCKED (`§3.9`). |
| 1 | **Home** | `01-static-home.html` | The two-region weekly-loop dashboard. |
| 2 | **Roster — Cards** | `02-roster-cards.html` | Party-grouped player cards + woven-in setup. |
| 3 | **Roster — Board** | `02-roster-board.html` | The re-homed gearsheet matrix. |
| 4 | **Loot — Priority** | `03-loot-priority.html`, `03-loot-priority-with-picker.html` | Includes the recipient-picker flow. |
| 5 | **Loot — History** | `03-loot-history.html` | The chronological record + Log action buttons. |
| 6 | **Schedule** | `04-schedule.html` | Sessions + RSVP + availability heatmap. |

**Lighter "noted-and-deferred" treatment** (a short subsection each, no full table — they belong to later rings and the map would go stale before F6 touches them): **Player Hub** (`05-player-hub.html`, Person layer), **Static Finder** (`06-static-finder.html`, Ring-1 recruitment), **flow-map** (`00-flow-map.html`, not a screen). Each gets: one paragraph noting it was reviewed, the obvious new components it implies (cross-listed into the catalog if shared), and "re-validate when its ring is built."

---

## 5. The two pinned instruments (every per-screen brief carries these)

To make a fan-out of independent agents compose into one clean catalog, each per-screen brief is pinned with the same two instruments. This is the mechanism that turns synthesis from guesswork into a mechanical merge.

### 5.1 Shared table schema (identical columns for every element set)

Every table uses **exactly** these columns, in this order:

| Column | Contents |
|---|---|
| **Element** | The mockup element, named concretely (e.g. "Next-session RSVP card", "per-slot gear pip row"). |
| **Tag** | `existing` \| `refine` \| `new`. |
| **Target component** | The owned component this becomes in F6 — real `components/…` path for `existing` and for a `refine` that fixes a single component in-place; owned catalog NAME (§6) for `new` and for a `refine` that consolidates/renames across forks (see §6 for the distinction between in-place and consolidating refines). |
| **Consolidates** | Current component(s) this replaces/absorbs (the migration link), or "—". |
| **DS ref** | The governing `DESIGN_SYSTEM.md` section / token, or the catalog entry. |
| **Notes** | The specific refinement, conformance gap, or build note. One line. |

No agent adds, renames, or reorders columns. Tables concatenate directly in synthesis.

### 5.2 Recurring-component watchlist (canonical names — use these, don't invent)

A pre-seeded list of components that appear on multiple screens. When an agent encounters one of these, it **must tag it with the canonical name below**, not a screen-local coinage — so synthesis dedups to one catalog entry instead of reconciling six labels for the same thing. (Seed list; agents may flag additions for synthesis, but may not rename these.)

| Canonical name | What it is | Seen on (expected) | Likely precursor |
|---|---|---|---|
| `RecipientPicker` | unified eligible-player picker, priority-ordered | Loot-Priority, Loot-History | `components/primitives/PopoverSelect.tsx` (`§3.6`) → refine |
| `PriorityRow` | one player's priority standing for a slot | Loot-Priority, Home | `components/priority/` panels → assess |
| `PlayerIdentity` | role-colored name/avatar/job treatment | Roster-Cards, Roster-Board, Loot, Schedule | `components/player/`, `components/ui/SafeAvatar.tsx` → assess |
| `TwoRegionDashboard` | actionable-left / ambient-right layout | Home (others reusable) | layout — likely new |
| `CardShell` | `surface-card` + radius + uppercase section header | every screen | **no shared shell exists** — `components/ui/DashboardCard.tsx` + a ~25-strong bespoke `*Card` family (`PlayerCard`, `SessionCard`, `CharacterCard`, …) → consolidate/new, **not** refine-a-primitive |
| `SegmentedToggle` | Cards⇄Board / view switch | Roster, Loot | `components/ui/GroupViewToggle.tsx`,`components/ui/ViewModeToggle.tsx` → refine/consolidate |
| `AttentionRow` | one prioritized "needs you" action item | Home (Static Finder) | `components/player/PlayerSetupBanner.tsx` → consolidates |
| `TrackCard` | a Progress-Engine track summary | Home ("also tracking") | `components/mount-farms/` UI → assess |
| `ProgressBarLegend` | gear-source-colored bar + once-per-screen legend | Home, Roster, Loot | existing bars → assess |
| `EmptyStateInvite` | empty state that invites the next action | Roster, Loot, Schedule | `components/ui/EmptyState.tsx` → refine |
| `SessionRsvpCard` | session + per-member RSVP state | Schedule, Home (next session) | `components/schedule/` → assess |
| `AvailabilityHeatmap` | aggregated availability grid | Schedule | `components/schedule/AvailabilityGrid.tsx` → refine/assess |

"Likely precursor" is a **hint, not a verdict** — each agent confirms or overrides it against real code and records the actual tag.

---

## 6. New-component catalog (synthesis output)

One consolidated list of every **distinct owned shared component the map calls for that does not yet exist as a single component**, deduped via the watchlist. That set is sourced from two kinds of rows (no fourth tag): `new` rows (built fresh in F6), and `refine` rows whose **target is a consolidated/renamed shared component** (e.g. `SegmentedToggle` collapsing `GroupViewToggle` + `ViewModeToggle`). A `refine` that only fixes tokens on an already-single component does **not** earn a catalog entry. Each entry — **name + one-line purpose + element sets that use it + current component(s) it consolidates + "contract deferred to F6"**. This is F6's build manifest. No props, no state tables (that's F6). Seeded by `DESIGN_SYSTEM §3.8` ("new components the redesign introduces") and `§7` (open gaps) — F5 reconciles that list against what the mockups actually demand and against what already exists.

---

## 7. Cross-screen consolidation map (synthesis output)

The explicit "many predecessors → one owned component" table that F6 executes. Rows are the consolidations called out in `REDESIGN_SPEC.md §5/§7` and any the pass surfaces, e.g.:

- `RecipientPicker` ← `QuickLogDropModal` + `AddLootEntryModal` (+ Log-Week loot step)
- Roster Board ← Gear tab + Loot-Log→Sync gear view + Team Summary gear table + Split Planner
- `AttentionRow` ← `PlayerSetupBanner` + "More" drawer requests

This is the most load-bearing artifact for F6 — it's the dedup contract.

---

## 8. Execution shape

Same proven subagent-driven flow as F2–F4, adapted for analysis:

1. **Fan-out (parallel):** one implementer agent per element set (0–6, seven agents). Each receives: its mockup HTML path, `DESIGN_SYSTEM.md`, `REDESIGN_SPEC.md §5/§7`, the §5.1 schema, the §5.2 watchlist, and read access to `frontend/src/components/`. Output: that set's filled table, every tag grounded in a real path or catalog name.
2. **Review each (xhigh):** `redesign-reviewer` re-verifies each table's tags **against actual code** — spot-checking that `existing` components really exist and conform, that `refine` changes are real, that no precursor was missed. Cheap implementers, deep reviewers (the standing reviewer-effort convention).
3. **Synthesis (one agent):** merge the seven tables into `f5-screen-components-map.md`; build the new-component catalog (§6) and consolidation map (§7); dedup via the watchlist; write the three deferred subsections (Player Hub / Finder / flow-map).
4. **Final whole-branch review (xhigh):** catalog completeness, watchlist-dedup correctness (no duplicate catalog entries, no orphaned `new` tags), consolidation-map coverage vs. `§7` re-homing.
5. **PR** into `redesign/foundation` → pr-review-loop → **squash-merge**.

The SDD progress ledger lives at `.superpowers/sdd/progress.md` (git-ignored).

---

## 9. Done criteria

- [ ] Seven element-set tables (Shell + Home + Roster×2 + Loot×2 + Schedule), every row using the §5.1 schema, every tag grounded in a real component path or a catalog entry.
- [ ] New-component catalog: every distinct not-yet-single owned shared component (from `new` rows + consolidating `refine` rows) present exactly once, deduped via the watchlist, each with purpose + users + consolidates + "contract deferred to F6."
- [ ] Cross-screen consolidation map covering the `REDESIGN_SPEC §7` re-homings plus any the pass surfaced.
- [ ] Player Hub / Static Finder / flow-map deferred subsections present.
- [ ] `DESIGN_SYSTEM §7` open-gaps list reconciled (each gap either resolved into a catalog entry or explicitly carried to F6).
- [ ] No code, no file moves, no DS contracts written. Docs-only diff under `design/redesign/`.
- [ ] Reviewed (per-table + whole-branch, xhigh), PR'd, squash-merged into `foundation`.
```
