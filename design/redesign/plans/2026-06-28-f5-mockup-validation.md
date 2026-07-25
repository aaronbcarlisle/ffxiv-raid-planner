# F5 — Mockup Validation Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the **screen→components map** — a page-by-page, element-by-element validation of the redesign mockups against the now-real design system, tagging every element existing/refine/new with a real migration link, as the build manifest F6 consumes.

**Architecture:** Seven independent "implementer" passes (one per element set: Shell + Home + Roster Cards/Board + Loot Priority/History + Schedule) each produce a table fragment in the **session scratchpad**; a deferred-screens pass covers Player Hub/Finder/flow-map lightly; a synthesis pass assembles the single committed artifact `f5-screen-components-map.md` (all tables + new-component catalog + cross-screen consolidation map). Every tag is verified against actual code by an xhigh `redesign-reviewer` before acceptance.

**Tech Stack:** Markdown docs only. No application code, no file moves, no DS contracts. Inputs: `design/redesign/mockups/*.html`, `design/redesign/DESIGN_SYSTEM.md`, `design/redesign/REDESIGN_SPEC.md`, the live `frontend/src/components/` tree.

## Global Constraints

Every task implicitly includes this section.

- **Doc-only.** F5 changes nothing under `frontend/src/` or `backend/app/`. The only repo files the whole plan creates are `design/redesign/specs/f5-screen-components-map.md` (Task 9) and edits to this plan/spec. No code, no file moves, no DS contracts written (those are F6).
- **Branch:** all work on `redesign/f5-mockup-validation` (already created off `redesign/foundation` `b573525`; spec committed at `5250a32`).
- **No AI attribution** in commits or PRs (project rule, absolute — no `Co-Authored-By`, no "Generated with", nothing).
- **Release notes:** none required (the gate fires only on `frontend/src`/`backend/app`, which F5 doesn't touch). If a stray src file is ever touched, add `{ internal: true }` with no version bump.
- **Source of truth = the spec:** `design/redesign/specs/2026-06-28-f5-mockup-validation-design.md`. The rubric (§3), scope (§4), schema (§5.1), watchlist (§5.2), catalog rule (§6), consolidation map (§7) are authoritative. This plan operationalizes it.
- **Scratchpad fragment dir:** screen tasks write to `<SCRATCH>/f5-fragments/` where `<SCRATCH>` = `C:\Users\aaron\AppData\Local\Temp\claude\D--FFXIV-Dev-xrp-dev-ffxiv-raid-planner\1c0f3196-6449-4e30-be18-6bfff89bcfe8\scratchpad`. Fragments are **never committed**; synthesis reads them and writes the single map. This keeps the repo diff to exactly the two doc files.

### The shared table schema (every table, exactly these columns, this order)

```
| Element | Tag | Target component | Consolidates | DS ref | Notes |
```

- **Element** — concrete name of the mockup element (e.g. "Next-session RSVP card").
- **Tag** — `existing` \| `refine` \| `new` (see rubric below). Filler/retired-IA rows use the escape, not a tag.
- **Target component** — the owned component this becomes in F6: a real `components/…` path for `existing`/`refine`, a catalog name for `new`.
- **Consolidates** — current component(s) this replaces/absorbs (migration link), or `—`.
- **DS ref** — governing `DESIGN_SYSTEM.md §` / token, or catalog entry.
- **Notes** — the specific refinement / conformance gap / build note, one line.

### The rubric (from spec §3 — apply to every element)

- **existing** — a built component already covers it AND conforms to `DESIGN_SYSTEM.md`. Row MUST cite the real `components/…` path.
- **refine** — a real component exists but needs change (token fix, API change, or fork-consolidation). Row MUST cite the path(s) + the specific change.
- **new** — nothing covers it; F6 builds it. Row MUST cite the catalog name.
- **Grounding (non-negotiable):** validate against BOTH `DESIGN_SYSTEM.md` AND the real `frontend/src/components/` tree. Every `existing`/`refine` path must actually exist (verify with the file system). "Looks new" ≠ "is new" — check for a precursor first. Migration link mandatory on every replacing row.
- **Filler escape:** mockups carry placeholder visuals — "treat layout as the signal, filler as noise." Decorative filler / placeholder data / one-off layout scaffolding → **skip, do not tag, do not catalogue.** When unsure, write a `filler? — confirm` note instead of minting a `new`.
- **Retired-IA escape:** an element from the retired IA (Gear tab, "Loot Log," "More," "Overview," "Who Needs It") → no tag; record `retired-IA — no home, drop`. Never promote it.

### The recurring-component watchlist (canonical names — use these, never invent a synonym)

When an element matches one of these, tag it with this exact name so synthesis dedups mechanically. (Full table with "seen on" + precursor hints in spec §5.2.) `RecipientPicker`, `PriorityRow`, `PlayerIdentity`, `TwoRegionDashboard`, `CardShell`, `SegmentedToggle`, `AttentionRow`, `TrackCard`, `ProgressBarLegend`, `EmptyStateInvite`, `SessionRsvpCard`, `AvailabilityHeatmap`. Precursor hints are hints, not verdicts — confirm against real code and record the actual tag.

---

## Per-screen task contract (Tasks 1–7 all follow this)

Each screen task is one implementer pass producing one fragment. The unique inputs (mockup, set name, inspect-these dirs, known consolidations) are in each task; everything else is the Global Constraints above. Each fragment is reviewed by `redesign-reviewer` (xhigh) before acceptance — the reviewer re-checks each tag against actual code, so an `existing` path that doesn't exist or a missed precursor is a rejection.

**Every screen task has these five steps** (shown in full in Task 1; later tasks state only their unique inputs + the same five steps by reference to "the per-screen task contract"):

1. **Read inputs** — the mockup HTML, `DESIGN_SYSTEM.md`, the relevant `REDESIGN_SPEC.md §5.x/§7` rows, and the listed component dirs.
2. **Walk every element** top-to-bottom; for each, apply the rubric + watchlist + filler/retired escapes.
3. **Write the fragment** `<SCRATCH>/f5-fragments/NN-<set>.md` — an `## <Set name>` heading + one schema table.
4. **Self-verify** (the gate): columns match the schema exactly; every `existing`/`refine` path resolves to a real file; every `new` cites a watchlist/catalog name; every replacing row has a migration link; no filler rows minted as components; retired-IA elements flagged not tagged.
5. **Report** the fragment path + a 3-line summary (counts: existing/refine/new, any flagged ambiguities for synthesis). No commit (fragment is scratchpad).

---

### Task 1: Shell chrome table (element set 0)

**Files:**
- Read: `design/redesign/DESIGN_SYSTEM.md` (esp. §2.1 layout, §3.9 rail LOCKED, §4.1 lexicon), the top-bar/spine as rendered across `design/redesign/mockups/01-static-home.html` (and any mockup's chrome), `REDESIGN_SPEC.md §3` (the three nav surfaces).
- Inspect: `frontend/src/components/layout/` (note `AppRail.tsx`, `ContextSwitcher.tsx`, `Header.tsx`, `TabNavigation.tsx`, `SidebarNav.tsx`, `PageHeader.tsx`, `railTypes.ts`), `frontend/src/components/ui/` (`ThemeToggle.tsx`, `KeyboardShortcutsHelp.tsx`, `Tabs.tsx`, `MobileBottomNav.tsx`).
- Write: `<SCRATCH>/f5-fragments/00-shell.md`.

**Interfaces:**
- Produces: fragment `00-shell.md` — `## Shell chrome` + one schema table covering: context rail (locked §3.9), top bar (static·track·week switcher, ⌘K affordance, notifications, settings gear, theme toggle), in-static spine (4-tab horizontal), ⌘K palette overlay.

**Unique grounding notes for this set:** real precursors exist — `AppRail.tsx` and `SidebarNav.tsx` (rail), `ContextSwitcher.tsx` (the static/track/week switch), `Header.tsx` (top bar), `TabNavigation.tsx`/`ui/Tabs.tsx` (spine). So most chrome is likely `refine` (restyle/restructure to the locked §3.9 standard + the §3.1 three-surface model), NOT pure `new`. The ⌘K palette has no real component (today shortcuts hide in `KeyboardShortcutsHelp.tsx`) → likely `new` (`CommandPalette`); cite that as the migration link. Verify each against the actual files.

- [ ] **Step 1: Read inputs** — the DS sections, the mockup chrome, the spec §3, and every file in `layout/` named above. Confirm which precursors exist.
- [ ] **Step 2: Walk every chrome element** — rail (each rail item + active/hover/focus states per §3.9), top bar (each control), spine (the 4 tabs + active state), ⌘K (affordance + overlay). Apply rubric; for the rail use the LOCKED §3.9 contract as the conformance bar.
- [ ] **Step 3: Write the fragment** to `<SCRATCH>/f5-fragments/00-shell.md` with the `## Shell chrome` heading and the schema table.
- [ ] **Step 4: Self-verify** per the contract gate (paths resolve, migration links present, no filler, schema columns exact).
- [ ] **Step 5: Report** path + counts + any ambiguities (e.g. "is `AppRail` close enough to §3.9 to be refine, or a rebuild?").

---

### Task 2: Home table (element set 1)

Follow the **per-screen task contract** (5 steps). Unique inputs:

**Files:**
- Read: `design/redesign/mockups/01-static-home.html`, `DESIGN_SYSTEM.md`, `REDESIGN_SPEC.md §5.1` (Home) + §7.
- Inspect: `frontend/src/components/dashboard/` (`MyStaticsPanel.tsx`), `ui/DashboardCard.tsx`, `ui/ProgressRing.tsx`, `player/PlayerSetupBanner.tsx`, `schedule/ScheduleUpcomingPanel.tsx` (if present) / `schedule/`, `mount-farms/`.
- Write: `<SCRATCH>/f5-fragments/01-home.md` → `## Home`.

**Unique grounding notes:** the spec (§5.1) calls out new components here — `TwoRegionDashboard` (layout, likely new), `AttentionRow` (consolidates `player/PlayerSetupBanner` + the "More" drawer requests), `TrackCard` ("also tracking" — assess `mount-farms/` UI). `CardShell` recurs (no shared shell exists — `ui/DashboardCard` + bespoke `*Card` family → consolidate/new). Readiness/BiS-by-role bars → `ProgressBarLegend` (assess existing bars). Next-session card → `SessionRsvpCard` (shared with Schedule).

---

### Task 3: Roster — Cards table (element set 2)

Follow the **per-screen task contract**. Unique inputs:

**Files:**
- Read: `design/redesign/mockups/02-roster-cards.html`, `DESIGN_SYSTEM.md`, `REDESIGN_SPEC.md §5.2` + §3.3 + §7.
- Inspect: `frontend/src/components/player/` (`PlayerCard.tsx`, `PlayerGrid.tsx`, `PlayerSetupBanner.tsx`, `JobPicker`, `PositionSelector`), `roster/`, `ui/SafeAvatar.tsx`, `ui/GroupViewToggle.tsx`, `ui/ViewModeToggle.tsx`, `wizard/`, `dnd/`.
- Write: `<SCRATCH>/f5-fragments/02-roster-cards.md` → `## Roster — Cards`.

**Unique grounding notes:** `SegmentedToggle` (the Cards⇄Board switch) has real precursors `ui/GroupViewToggle.tsx` + `ui/ViewModeToggle.tsx` → `refine`/consolidate, NOT new. `PlayerIdentity` (role-colored card identity) recurs — assess `player/` + `ui/SafeAvatar`. Woven-in setup (empty card invites setup) vs. the old wizard banner: note the consolidation (`wizard/` + `PlayerSetupBanner` → inline). "One player context menu" — today overlapping menus (`ui/ContextMenu` + per-card menus); note the consolidation.

---

### Task 4: Roster — Board table (element set 3)

Follow the **per-screen task contract**. Unique inputs:

**Files:**
- Read: `design/redesign/mockups/02-roster-board.html`, `DESIGN_SYSTEM.md`, `REDESIGN_SPEC.md §5.2` + §3.3 + §7.
- Inspect: `frontend/src/components/team/` (`TeamSummary.tsx`, `TeamSummaryEnhanced.tsx` — the gear table), `player/` gear table components, `ui/GearStatusCircle.tsx`, `split-clear/` (`SplitClearPlanner.tsx` et al — Split Planner becomes a Board mode), `group/GearSyncDashboard.tsx`.
- Write: `<SCRATCH>/f5-fragments/03-roster-board.md` → `## Roster — Board`.

**Unique grounding notes:** the Board is the re-homed "Gear." Big consolidation (spec §5.2/§7): Roster Board ← Gear tab + Loot-Log→Sync gear view (`group/GearSyncDashboard.tsx`) + Team Summary gear table (`team/TeamSummaryEnhanced.tsx`) + Split Planner (`split-clear/SplitClearPlanner.tsx`, becomes a Board *mode* not a separate surface). `GearStatusCircle` (`ui/`) is the kept gear atom → `existing`. The gear-board cell is a new component (`GearBoardCell`?) — assess vs. `GearStatusCircle`. Watch for retired-IA: a literal "Gear tab" label rendered in filler = retired-IA flag.

---

### Task 5: Loot — Priority table (element set 4)

Follow the **per-screen task contract**. Unique inputs:

**Files:**
- Read: `design/redesign/mockups/03-loot-priority.html` AND `design/redesign/mockups/03-loot-priority-with-picker.html`, `DESIGN_SYSTEM.md` (esp. §3.6 PopoverSelect + recipient picker), `REDESIGN_SPEC.md §5.3` + §3.4 + §7 + §9.3.
- Inspect: `frontend/src/components/priority/` (editors, `ModeSelector`, `PresetSelector`), `loot/` (`LootPriorityPanel.tsx`, `FloorSelector.tsx`, `QuickLogDropModal.tsx`, `WhoNeedsItMatrix.tsx`), `primitives/PopoverSelect.tsx` + `popoverSelectHelpers.ts`.
- Write: `<SCRATCH>/f5-fragments/04-loot-priority.md` → `## Loot — Priority`.

**Unique grounding notes:** the headline consolidation — `RecipientPicker` ← `loot/QuickLogDropModal` + `history/AddLootEntryModal` (the forked picker, the recurring "can't select that player" bug), with `primitives/PopoverSelect` (§3.6) as the precursor → `refine`/specialize. `PriorityRow` (who's-up-next per slot) — assess `priority/` + `loot/LootPriorityPanel`. `WhoNeedsItMatrix.tsx` is the retired "Who Needs It" 3-deep view → its capability becomes first-class Priority; tag the *new* priority surface, flag the old matrix as `retired-IA — no home, drop` if it appears as filler. `FloorSelector` → likely `refine`.

---

### Task 6: Loot — History table (element set 5)

Follow the **per-screen task contract**. Unique inputs:

**Files:**
- Read: `design/redesign/mockups/03-loot-history.html`, `DESIGN_SYSTEM.md`, `REDESIGN_SPEC.md §5.3` + §7 + the glossary §10 ("Log" is a verb).
- Inspect: `frontend/src/components/history/` (`WeeklyLootGrid.tsx`, `SectionedLogView.tsx`, `HistoryView.tsx`, `AllWeeksView.tsx`, `AddLootEntryModal.tsx`, `LogFloatingActions.tsx`, `WeekStepper.tsx`, `LogLayoutToggle.tsx`), `loot/LogWeekWizard/`.
- Write: `<SCRATCH>/f5-fragments/05-loot-history.md` → `## Loot — History`.

**Unique grounding notes:** "Log a drop" / "Log this week" are **action buttons** here (the verb) — `Button` (existing) wired to the `RecipientPicker` (shared, defined in Task 5 — same canonical name, no new entry) and the Log-Week flow (`loot/LogWeekWizard/` → assess refine/consolidate). The record grid → assess `history/WeeklyLootGrid` + `SectionedLogView` (likely `refine`). `SegmentedToggle` recurs if History has a layout toggle (`history/LogLayoutToggle.tsx`) → same canonical name as Roster. `WeekStepper` (§3.5) → likely `existing`/`refine`. The shared `RecipientPicker`/`PlayerIdentity` rows MUST reuse the canonical names, not coin new ones.

---

### Task 7: Schedule table (element set 6)

Follow the **per-screen task contract**. Unique inputs:

**Files:**
- Read: `design/redesign/mockups/04-schedule.html`, `DESIGN_SYSTEM.md`, `REDESIGN_SPEC.md §5.4` + §7 + §9.2 (the week as the shared clock).
- Inspect: `frontend/src/components/schedule/` (`ScheduleTab`, `AvailabilityGrid`, `CreateSessionModal`, `SessionCard`, and the rest of the dir).
- Write: `<SCRATCH>/f5-fragments/06-schedule.md` → `## Schedule`.

**Unique grounding notes:** `SessionRsvpCard` (session + per-member RSVP) — shared with Home's next-session card (same canonical name); precursor `schedule/SessionCard.tsx` → assess refine. `AvailabilityHeatmap` (aggregated availability the lead reads) — precursor `schedule/AvailabilityGrid.tsx` → `refine`/assess. The calendar for recurring sessions → assess existing schedule calendar. Reinforce the §9.3 invariant: the **week** object here is the same week Loot uses — note any element implying a parallel week concept as a consolidation, not a new thing.

---

### Task 8: Deferred screens (Player Hub · Static Finder · flow-map)

**Files:**
- Read: `design/redesign/mockups/05-player-hub.html`, `design/redesign/mockups/06-static-finder.html`, `design/redesign/mockups/00-flow-map.html`, `REDESIGN_SPEC.md §5.5/§5.6` + §9.1.
- Inspect (light): `frontend/src/components/profile/`, `dashboard/MyStaticsPanel.tsx`, `static-group/`, `collections/`.
- Write: `<SCRATCH>/f5-fragments/07-deferred.md`.

**Interfaces:**
- Produces: `07-deferred.md` — three short subsections (`### Player Hub (deferred)`, `### Static Finder (deferred)`, `### Flow-map (not a screen)`), NOT full tables. Each: one paragraph confirming it was reviewed, a bullet list of the obvious new components it implies (cross-listed into the catalog ONLY IF shared with a Ring-0 screen, using the canonical watchlist names), and the line "re-validate when its ring is built."

- [ ] **Step 1: Read** the three mockups + spec sections.
- [ ] **Step 2: For each**, identify only the *structural* new components (skip filler), noting which (if any) are already on the Ring-0 catalog (e.g. `AvailabilityHeatmap` appears in Player Hub too — reuse the name, don't re-mint).
- [ ] **Step 3: Write** the three deferred subsections to the fragment.
- [ ] **Step 4: Self-verify** — no full tables (deferred = light), shared components use canonical names, each ends with the re-validate line.
- [ ] **Step 5: Report** path + the cross-listed shared components found.

---

### Task 9: Synthesis — assemble `f5-screen-components-map.md`

**Files:**
- Read: all eight fragments in `<SCRATCH>/f5-fragments/` (`00`–`07`), `design/redesign/specs/2026-06-28-f5-mockup-validation-design.md` (§6 catalog rule, §7 consolidation map), `DESIGN_SYSTEM.md §3.8` (new components list) + §7 (open gaps), `REDESIGN_SPEC.md §7` (re-homing map).
- Create: `design/redesign/specs/f5-screen-components-map.md`.
- Write: scratchpad fragments are discarded (not committed).

**Interfaces:**
- Consumes: the eight fragments (seven schema tables + the deferred subsections).
- Produces: the committed map with this structure — (1) header/legend (the 3-tag rubric + filler/retired escapes restated as a legend), (2) the seven element-set tables verbatim from fragments, (3) the three deferred subsections, (4) **New-component catalog** (§6 rule: one entry per distinct not-yet-single owned shared component, from `new` rows + consolidating `refine` rows, deduped via watchlist; each = name + one-line purpose + element sets that use it + consolidates + "contract deferred to F6"), (5) **Cross-screen consolidation map** (§7: the "many predecessors → one owned component" table covering the `REDESIGN_SPEC §7` re-homings + any surfaced), (6) **DS §7 gap reconciliation** (each open gap → resolved-into-catalog-entry or explicitly-carried-to-F6).

- [ ] **Step 1: Assemble** — create `f5-screen-components-map.md`; paste the header/legend, the seven tables, the deferred subsections in order.
- [ ] **Step 2: Build the catalog** — scan all `new` rows + consolidating `refine` rows across the seven tables; dedup by canonical watchlist name (every `RecipientPicker`/`PlayerIdentity`/etc. collapses to ONE entry); write each catalog entry. Verify a pure token-fix `refine` did NOT produce a catalog entry.
- [ ] **Step 3: Build the consolidation map** — one row per "predecessors → one component," cross-checked against `REDESIGN_SPEC §7` (every ♻️/🔀 row in §7 must appear or be consciously N/A).
- [ ] **Step 4: Reconcile DS §7 gaps** — list each gap from `DESIGN_SYSTEM.md §7`; mark resolved-into-catalog or carried-to-F6.
- [ ] **Step 5: Self-verify against spec §9 done-criteria** — seven tables present, schema-conformant; catalog deduped with no orphan `new`; consolidation map covers §7; deferred subsections present; gaps reconciled; diff is docs-only.
- [ ] **Step 6: Commit**

```bash
git add design/redesign/specs/f5-screen-components-map.md
git commit -m "docs(redesign): F5 screen→components map — element validation + new-component catalog"
```

---

### Task 10: Whole-branch review + PR

**Files:** none created; review + PR only.

- [ ] **Step 1: Whole-branch review** — dispatch `redesign-reviewer` (xhigh) over the full branch diff (`git diff redesign/foundation...HEAD`) with the spec's §9 done-criteria as the rubric. Focus: (a) spot-check that `existing`/`refine` component paths actually exist and conform; (b) catalog has no duplicate entries and no orphaned `new` tags; (c) consolidation map covers `REDESIGN_SPEC §7`; (d) no filler-born or retired-IA entries leaked into the catalog; (e) docs-only diff.
- [ ] **Step 2: Address findings** — fix inline, re-commit as needed.
- [ ] **Step 3: Push + open PR**

```bash
git push -u origin redesign/f5-mockup-validation
gh pr create --base redesign/foundation --title "F5 — Mockup validation pass (screen→components map)" --body "<summary: deliverable, scope, doc-only, links spec + roadmap F5 row>"
```

- [ ] **Step 4: pr-review-loop** — run the `pr-review-loop` skill; address Bugbot/Copilot/CI findings until clean.
- [ ] **Step 5: Squash-merge** into `redesign/foundation`; verify foundation head advanced; update `FOUNDATION_ROADMAP.md`/`HANDOFF.md`/`SESSION_HANDOFF.md` + project memory to mark F5 done / F6 next (separate doc commit on foundation, the F2–F4 pattern).

---

## Self-Review

**Spec coverage:** spec §2 (two files) → Tasks 9 creates the map, the design spec already exists. §3 rubric → embedded in Global Constraints + applied every screen task. §4 scope (7 element sets + deferred) → Tasks 1–8. §5.1 schema → Global Constraints + every fragment. §5.2 watchlist → Global Constraints + per-task grounding notes. §6 catalog → Task 9 Step 2. §7 consolidation map → Task 9 Step 3. §8 execution (fan-out → review → synthesis → whole-branch → PR) → Tasks 1–8 (fan-out, each reviewed), 9 (synthesis), 10 (whole-branch + PR). §9 done-criteria → Task 9 Step 5 + Task 10 Step 1 rubric. Covered.

**Placeholder scan:** no TBD/TODO; each screen task names its exact mockup, inspect-dirs, and known consolidations; the shared 5-step contract is spelled out in full in Task 1 and the contract block (not "similar to"); the schema/rubric/watchlist are stated verbatim in Global Constraints so every task is self-contained.

**Type consistency:** canonical component names are fixed by the watchlist (`RecipientPicker`, `PlayerIdentity`, `SegmentedToggle`, `SessionRsvpCard`, `AvailabilityHeatmap`, `CardShell`, etc.) and reused identically across Tasks 2–8 and the Task 9 catalog — the cross-screen reuse instruction is explicit in Tasks 5/6 (RecipientPicker), 2/7 (SessionRsvpCard), 3/2 (SegmentedToggle), 8 (AvailabilityHeatmap). Fragment filenames `00-shell`…`07-deferred` are consistent between the producing tasks and Task 9's consume list.
