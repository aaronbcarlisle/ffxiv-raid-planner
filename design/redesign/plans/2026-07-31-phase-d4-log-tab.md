# Phase D — Slice D4: The Log Tab — Implementation Plan (REV 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Vet record:** `xivrp-director` plan-vet 2026-07-31 → **PARITY-GAP** (4 blockers · 4 major · 7 minor)
— ALL folded into this revision, every premise re-verified independently against `main` at
`dc3a7a6f`. Three findings correct **this plan's own reasoning** and are marked ⚠. The director's
"verified clean" set is recorded in §Verified so it is not re-litigated: the V1-freeze file
inventory holds, the `useUrlTabState` avoidance is right, the `scopedWeekOverride` read set is
complete, and `LogWeekWizard`'s call-site-prop-only treatment works.

**Goal:** Make Loot a triad. `lview` gains `'log'`, the Log tab becomes a real destination with its
own week, and the week model Priority has been carrying is deleted and re-homed.

Precisely (director B4 — the earlier "implements R-13, R-15, R-20, R-22" overclaimed):

| Ruling | D4 delivers |
|---|---|
| **R-15** | **In full** — Log owns the week; Priority is always the clock; `scopedWeekOverride` deleted |
| **R-20** | **In full for gear** — the wizard's week-target split + "Log a drop" on Log. "Log material" is D8 (user-ruled, below) |
| **R-22** | **In full** — chevrons, go-to-current, clock-bound mutations that name their week, the pre-check, and the v2-owned data-summary modal |
| **R-13** | **Its scope half only** — Log has no floor pill row (and gets it nearly free: the row is already gated on `lview === 'priority'` at `Loot.tsx:515`). R-13's *four floors in one glance* is the D5 grid, per the user's kickoff ruling |

**Parity rows built here:** **D-40** (week stepper → chevrons + go-to-current) and **D-41**
(revert-week safety → pre-check + data-summary modal). Both get `✅ BUILT` write-backs in Task 5,
scoped to what actually shipped.

**Architecture:** A new `useLogWeek` hook owns the displayed week as a *nullable override* over the
shared `WeekClock` — `null` means "follow the clock", which is what makes go-to-current and a
post-mutation reset one operation instead of three. It resolves from `?week=` → `v2-history-week-*`
→ legacy `history-week-*` → the clock, persists v2-only, and mirrors `?week=` so D6/D11's Log deep
links have a week to land on. `WeekScopeControl` grows the R-22 controls and stays the clock's
mutation host; a new v2-owned `RevertWeekSummaryModal` supplies R-22's data summary. `Loot.tsx`
routes three views instead of two and loses `scopedWeek` entirely.

**Tech Stack:** React 19 + TypeScript, react-router `useSearchParams`, Tailwind CSS 4 semantic
tokens, Vitest + @testing-library/react (jsdom).

**User rulings taken at kickoff (2026-07-31) — do not re-litigate:**

1. **Log's body in D4 is an honest placeholder.** The weekly grid is D5 and the Books card is D7.
   D4 ships the real toolbar, the real week model and an empty-state card that names what lands
   next. Merging D5 into D4 (~2,200 lines) or pulling D7's card forward (which would ship it
   clock-bound — the exact bug R-14's first delta exists to fix) were both rejected.
2. **R-20's "Log material" button defers to D8.** Free-form material entry needs R-26's floor +
   material selectors; `QuickLogMaterialModal` today requires fixed `floor`/`material` props
   (`QuickLogMaterialModal.tsx:27-39`), so the button cannot honestly work before D8 grows the
   modal. D4 ships "Log a drop" + the wizard on Log's toolbar.

---

## Global Constraints

Every task implicitly includes all of these. Violations are review-rejections.

1. **Frozen files — never edit:** anything under `components/history/` (incl.
   `RevertWeekConfirmModal.tsx` and `HistoryView.tsx`, this slice's two *references*),
   `components/loot/WhoNeedsItMatrix.tsx`, `components/loot/FilterBar.tsx`,
   `components/loot/LootPriorityPanel.tsx`, `components/loot/WeaponPriorityList.tsx`,
   `components/loot/QuickLogMaterialModal.tsx`, `utils/priority.ts`, `utils/priorityEntries.ts`,
   `utils/lootRecommendationService.ts`. Read-only reuse (imports, incl. type-only) is allowed.
   Removing any existing export from `components/loot/index.ts` is a V1 edit — don't; new components
   are sibling-imported, never barrel-exported (`RankingExplanation` / `QueueWhy` / `ScoreBreakdown`
   precedent).
2. **`hooks/useUrlTabState.ts` is NOT edited, and `week` is NOT registered with it.** Its
   `SEEDED_TAB_PARAMS` (`:38`) feeds `clearRegisteredTabParams` (`:52-57`), called from
   `useGroupViewState.ts:320` inside `setPageMode` — which **both** shells use. Registering `week`
   would make a V1 primary-tab switch (with "remember sub-tabs" off) start wiping legacy
   `HistoryView`'s `?week=`. The Log week uses raw `useSearchParams`, the door legacy itself uses
   (`HistoryView.tsx:129-137`). Director-verified as correctly identified and correctly avoided.
3. **`LogWeekWizard` is shared (`loot/index.ts:5`, V1-live via `LootPriorityPanel.tsx:30,788`).**
   D4 changes the **value passed to its `currentWeek` prop at v2's call site only**. Director-verified
   that `currentWeek` is a re-read-on-open default (`LogWeekWizard/index.tsx:56,87,244`) with
   `onSuccess(selectedWeek)` (`:621`), so R-20's split needs no component edit and no default change.
4. **Colors:** semantic tokens only. Never `FLOOR_COLORS[n].hex`, never a hex/rgb literal, never raw
   Tailwind palette classes.
5. **Design system:** no raw `<button>`/`<input>`/`<select>` — use `Button`/`IconButton`/`Modal`/etc.
   No inline SVG (legacy's warning glyph is an SVG; `loot/` uses lucide). No `design-system-ignore`
   without a real justification. Text ≥ `text-xs` (12px).
6. **Copy:** "static", never "group", in user-facing text.
7. **Tests:** `fireEvent` from `@testing-library/react` — **`userEvent` is NOT installed**. Run
   per-file with `cd frontend && pnpm vitest run <path>` before the full suite.
8. **Gates (Task 5 runs all, from `frontend/`):** `pnpm build` (= `tsc -b && vite build`;
   `tsc --noEmit` is NOT equivalent), `pnpm lint`, `pnpm check:design-system:strict`, `pnpm dupes`,
   `pnpm tokens:check`, `pnpm deadcode` (baseline captured on `main` before Task 1, in the session
   scratchpad), `pnpm test`.
9. **Commits:** one per task, `feat(loot):` / `test(loot):` / `docs(redesign):` style. **NO AI
   attribution of any kind** — no Co-Authored-By, no "Generated with", nothing. Absolute repo rule.
10. **Branch:** `phase-d/d4-log-tab`, already created from `main` at `dc3a7a6f`.
11. **Release notes:** a NEW entry `version: '2.1.9'`, `internal: true`, at the top of `RELEASES`,
    following 2.1.8's shape. `CURRENT_VERSION` stays **`2.1.5`** — it tracks the latest *public*
    release. **The entry must not claim R-13** (B4c) — D4 delivers R-13's scope half only.
12. **V1 safety is asserted over files AND over the shared URL namespace.** Every file this slice
    touches is v2-only or net-new — director-verified on `main` at `dc3a7a6f`: `loot/Loot.tsx` (sole
    non-test importer `pages/NewShell.tsx:13`), `loot/WeekScopeControl.tsx` (sole non-test importer
    `loot/Loot.tsx:66`), `loot/FloorCard.tsx` (sole non-test importer `loot/Loot.tsx:67`),
    `loot/LootToolbar.tsx` (sole importer `loot/Loot.tsx:472`). **No §2.1 shared-layer file appears
    in this slice.** ⚠ **But a file-scoped assert cannot see this slice's real reach** — see
    Constraint 13. If you find yourself editing a file not listed in a task's **Files** block, STOP
    and report.
13. ⚠ **`?week=` is a SHARED URL param, and D4 makes v2 its second writer.** Its only consumer today
    is legacy: `history/HistoryView.tsx:105` (read) and `:132-134` (write), V1-live via
    `GroupViewContent.tsx:40,1049`. The reach: v2 Log writes `?week=4` → `useShellToggle.ts:26-32`
    strips only `shell` and preserves the rest → legacy `HistoryView` initialises `selectedWeek`
    from the param, **overriding the user's own legacy `history-week-{groupId}-{tierId}` value**
    (`HistoryView.tsx:104-115`), and the next legacy week change persists it into that key
    (`:119-125`). This is the class `useRosterSortPreset.ts:22-26` already documents as a freeze
    violation — *"a V1-visible effect with zero file diff"*. The plan namespaces localStorage
    v2-side with care and then does the un-namespaced equivalent in the URL.
    **Not fixable by renaming** — the design record pins `lview=log&week=N&entry=…`
    (`phase-d-loot-design.md:422`), so the param name is ruled. **Blast radius is small and
    self-correcting** (v2 is admin-gated; the semantics are identical; legacy re-syncs for `?entry=`
    deep links via its `targetWeek` effect at `HistoryView.tsx:160-162`). **The required treatment
    is disclosure, not avoidance:** Task 5's assert gains a third part, and the PR body states this
    reach path with the legacy render path above.

**Named non-goals / interims — put ALL of these in the PR body:**

- Log's body is an empty-state placeholder; the weekly grid is **D5**, the Books card and the
  displayed-week-bound reset menu are **D7** (user-ruled).
- "Log material" on Log's toolbar is **D8** (user-ruled).
- ⚠ **D4 deletes live v2 behaviour** — the phase's only such deletion (`phase-d-loot-plan.md:254-256`).
  The PR body carries a **six-row affordance-parity block** mapping every affordance that moves:

  | Affordance (v2 today) | Where it lives after D4 |
  |---|---|
  | Priority's week dropdown (`Loot.tsx:494-499`) | Log only |
  | `Start next week` | Log only, clock-bound |
  | `Revert week` | Log only, clock-bound, now with pre-check + data summary |
  | Priority's back-dated "Log a drop" default (`Loot.tsx:446`) | Gone by ruling — Priority logs to the clock's week (R-15) |
  | Wizard success re-scoping the view to the logged week (`Loot.tsx:726`) | Log only. **A Priority wizard run targeting another week now gives no visual feedback** — named consequence |
  | Reading floor-by-floor completion for a **past** week — pre-D4 the dropdown's `scopedWeek` fed both `FloorCard`'s status chip and its auto-collapse via `deriveFloorWeekStatus` | **Gone until D5's grid.** Priority's `FloorCard`s are pinned to `currentWeek={clock.currentWeek}` (`Loot.tsx:730`) with no override, and Log's body is `LogEmptyState` — there is no v2 surface that can show a past week's floor-by-floor status today |

- `FairnessSummary`, `BookLedgerCard` and `LootResetMenu` stay mounted on **History** in D4 (D7 / D14).
- `RosterCard.tsx:286,304` and `GroupViewContent.tsx:1167` still write `lview=history`. D7 retargets
  the `?book=` jump to `lview=log`.
- `?week=` is written and read, but Log has **no `?entry=` highlight** — cell pulse and deep-link
  landing are D6/D11. A `week` param on Log today positions the week and nothing more.
- The shared-URL-param reach of Constraint 13, stated in full.
- ⚠ **`LogEmptyState`'s lifetime is longer than "until D5"** — the phase dependency graph puts
  **D8 before D5** (`phase-d-loot-plan.md:170`), so the stub survives at least two more slices.
- `Alt+←` / `Alt+→` / `Alt+B` / `Alt+L` bindings are **D14**. D4 ships the controls and does **not**
  touch `useGroupViewKeyboardShortcuts.ts` or the shortcut registry — both shared and V1-live.
- Mobile → Phase P by standing ruling.

---

## File structure (locked by this plan)

| File | Status | Responsibility |
|---|---|---|
| `frontend/src/components/loot/useLogWeek.ts` | **create** | The Log week: nullable override over the clock, resolution order, v2-only persistence, `?week=` mirror, bounds |
| `frontend/src/components/loot/useLogWeek.test.ts` | **create** | Resolution precedence, cold-load, clamping, storage failure, legacy-read/v2-write, tier re-resolve, URL mirror |
| `frontend/src/components/loot/RevertWeekSummaryModal.tsx` | **create** | R-22 / D-41's data summary — what moves when the clock reverts (v2-owned per R-48) |
| `frontend/src/components/loot/RevertWeekSummaryModal.test.tsx` | **create** | Counts, itemisation, scroll container, empty fallback, week naming |
| `frontend/src/components/loot/LogEmptyState.tsx` | **create** | The D4 placeholder body |
| `frontend/src/components/loot/WeekScopeControl.tsx` | modify | R-22: chevrons, go-to-current, clock-vs-displayed naming, revert pre-check → summary modal |
| `frontend/src/components/loot/WeekScopeControl.test.tsx` | modify | New controls + bounds + pre-check + the clock-bound assertions |
| `frontend/src/components/loot/Loot.tsx` | modify | `lview` triad, R-15 deletion, week routing, Log body, comment-block rewrite |
| `frontend/src/components/loot/Loot.test.tsx` | modify | Log-tab tests + repair/removal of Priority tests the R-15 model falsifies |
| `frontend/src/components/loot/LootToolbar.tsx` | modify | ⚠ Comment-only + one optional prop (m2/m3) — doc header describes a two-view axis that D4 falsifies |
| `frontend/src/components/loot/FloorCard.tsx` | modify | Collapse `scopedWeek` + optional `currentWeek` → one `currentWeek` (R-15 makes them the same value) |
| `frontend/src/components/loot/FloorCard.test.tsx` | modify | Prop rename **+ one deliberate test deletion** (M4) |
| `frontend/src/data/releaseNotes.ts` | modify | New `2.1.9` internal entry; `CURRENT_VERSION` untouched |
| `design/redesign/specs/v1-v2-parity-matrix.md` | modify | Task 5: `✅ BUILT` on **D-40** and **D-41**, scoped |
| `design/redesign/specs/phase-d-loot-design.md` | modify | Task 5: record the two D4 build rulings against R-20 |
| `design/redesign/specs/phase-d-loot-plan.md` | modify | Task 5: D4 row note (Log-material carry to D8) |
| `design/redesign/plans/2026-07-31-phase-d4-log-tab.md` | modify | This plan ships with the build (the D2/D3 precedent) |

---

### Task 1: `useLogWeek` — the Log's week model

**Files:** create `frontend/src/components/loot/useLogWeek.ts`, `frontend/src/components/loot/useLogWeek.test.ts`

R-15 makes the week Log's property. The hook is the whole model; `Loot.tsx` holds no week state
after Task 4. Placement follows `roster/useRosterSortPreset.ts` — co-located with its screen, out of
the shared `hooks/` tree.

- [ ] **Shape.** Export `interface LogWeek { week: number; isCurrent: boolean; canPrev: boolean;
      canNext: boolean; setWeek(w: number): void; prev(): void; next(): void; followClock(): void }`
      and `export function useLogWeek(groupId: string | undefined, tierId: string | undefined,
      clock: WeekClock): LogWeek`.
- [ ] **The override, not the number.** Internal state is `override: number | null`; `week =
      override ?? clock.currentWeek`. `null` = follow the clock. This is what makes `followClock()`
      (R-22's go-to-current) a single state clear, and what keeps a freshly-mounted Log correct
      while `fetchCurrentWeek` is still in flight.
- [ ] **Resolution order**, applied on mount and on every `groupId`/`tierId` change:
      `?week=` (integer ≥ 1) → `v2-history-week-{groupId}-{tierId}` → legacy
      `history-week-{groupId}-{tierId}` → `null`. Legacy's key is **read as a fallback and never
      written** (phase plan §2.3, the `useRosterSortPreset` shape). A test asserts the legacy key is
      never written.
- [ ] ⚠ **Do NOT clamp at resolve time — this was REV 1's bug (director B2).** The store initialises
      `currentWeek: 1, maxWeek: 1` (`lootTrackingStore.ts:115-116`) and `fetchCurrentWeek` is
      dispatched from an async effect (`Loot.tsx:301-306`), so at resolution the upper bound is
      **1**. Clamping there would discard every `?week=N` (N > 1) on a cold load — silently breaking
      the deep-link substrate this slice exists to lay — and the ref guard means it would never
      re-resolve. **Resolution accepts any integer ≥ 1**, which is legacy's own rule
      (`HistoryView.tsx:105-109` parses and accepts any `> 0`, deliberately unclamped).
      `NaN`, non-integers and `≤ 0` still fall through to `null`.
- [ ] **Clamping lives on `setWeek` only:** `1 … Math.max(clock.maxWeek, clock.currentWeek)`.
      `canPrev = week > 1`; `canNext = week < max`. Once the clock settles these derive correctly; a
      resolved week beyond the clock's range is simply a week the user can step back from.
- [ ] **Tier re-resolve.** v2 `Loot` mounts un-keyed (`NewShell.tsx`), so a tier switch re-runs
      effects on a live component and a `useState` initializer will not fire again. Re-resolve in an
      effect keyed on `groupId`/`tierId`, guarded by a ref holding the last-resolved key so the
      mount pass and the effect don't double-resolve.
- [ ] **Persistence + URL, one rule:** any target equal to `clock.currentWeek` **clears** the
      override, writes the **`'current'` sentinel** to the v2 storage key and deletes `?week=`; any
      other target writes the number to all three.
      `followClock()` is therefore `setWeek(clock.currentWeek)`.
- [ ] ⚠ **The sentinel is load-bearing — user-ruled 2026-07-31 at Task 1 review.** REV 2 said
      go-to-current *removes* the v2 key. That composes with the legacy fallback read into a loop
      that defeats R-22's headline affordance: legacy `HistoryView.tsx:122` writes
      `history-week-{groupId}-{tierId}` **unconditionally** on every week change, so every migrated
      V1 user has one. Remove the v2 key and the next mount falls straight through to the stale
      legacy week and resurrects it — forever, since v2 never writes that key. Storing `'current'`
      makes resolution stop at the v2 key without ever touching legacy's. Resolution therefore
      reads: `?week=` → v2 key (`'current'` ⇒ follow the clock, a number ⇒ use it) → legacy key →
      `null`. **The legacy key is still never written.**
      *Deliberate delta from legacy,*
      which writes localStorage unconditionally (`HistoryView.tsx:122`) while deleting the URL param
      when equal (`:131-132`): storing "follow the clock" as `null` means a returning user whose
      clock advanced lands on the new current week instead of a stale number. Note it in the doc
      header. (Director: delta sound; REV 1's citation of `:117-121` was off by a line — the write
      is `:122`, inside `:119-125`.)
- [ ] **Storage is guarded.** Safari private mode / blocked-storage embeds throw from the accessor
      itself; every read and write is `try/catch`, degrading to "not persisted" (`Loot.tsx:130-161`).
- [ ] **URL writes** use `useSearchParams`'s functional updater with `{ replace: true }` so other
      params (notably `?tier=`, `?lview=`) survive — legacy's `HistoryView.tsx:129-137` pattern.
      **Do not touch `hooks/useUrlTabState.ts`** (Constraint 2).
- [ ] **Tests** (`useLogWeek.test.ts`, via `renderHook` inside a `MemoryRouter`): each resolution
      precedence step in isolation; **`?week=5` with the store at its `currentWeek:1, maxWeek:1`
      defaults resolves to 5, not 1** (the B2 regression guard — name it as such in the test);
      garbage URL/storage values fall through to the clock; `setWeek` clamps at both ends;
      `prev`/`next` at bounds are no-ops; `followClock` clears storage **and** the param; a week ≠
      current writes both; the legacy key is read but never written; a `groupId`/`tierId` change
      re-resolves; a throwing `localStorage` doesn't take the hook down.

**Verify:** `cd frontend && pnpm vitest run src/components/loot/useLogWeek.test.ts`

---

### Task 2: `RevertWeekSummaryModal` — D-41's data summary

**Files:** create `frontend/src/components/loot/RevertWeekSummaryModal.tsx`, `frontend/src/components/loot/RevertWeekSummaryModal.test.tsx`

- [ ] ⚠ **Why v2 owns this — corrected (director B1).** REV 1 justified the fork with the `pnpm
      dupes` gate. That was wrong twice over: the gate has ~1,200 lines of headroom (tsx duplication
      measures **3.88%** against `.jscpd.json`'s `threshold: 5`), and phase plan §2.2 names D3, D5,
      D9a and D10 as the re-express slices — not D4. The real basis is a **ruling**: R-48 states
      *"v2's Log **builds its own** grid, count bar and revert modal"*
      (`phase-d-loot-design.md:984-986`), with `history/RevertWeekConfirmModal.tsx` as read-only
      reference. Importing the frozen modal would be *permitted* by the freeze
      (`Loot.tsx:85` already imports `history/DeleteLootConfirmModal`) — it is closed by ruling, not
      by the gate. Base the doc header on R-48.
- [ ] ⚠ **NO row cap — REV 1's 5-row cap is dropped (director B1).** D-41 rules a RESTORE of a modal
      *"listing the loot/materials/books that will move"* (`v1-v2-parity-matrix.md:267`); legacy
      lists **all** of them in a scroll container (`RevertWeekConfirmModal.tsx:99` —
      `max-h-64 overflow-y-auto`, items `:101-150`). Truncating to 5 of 12 removes information from
      a warning surface shown before a clock mutation, with no user ruling behind it. Use a scroll
      container. **Keep the counts-summary line** (`3 drops · 2 materials · 4 book entries`) — that
      is a genuine improvement over legacy and stays.
- [ ] **Props:** `{ isOpen, week, lootLog, materialLog, pageLedger, players, isReverting, onConfirm,
      onCancel }`. `week` is **the clock's current week** — the week that actually moves. The caller
      supplies it; the modal never derives it.
- [ ] **Copy names the week explicitly** — title `Revert to Week {week - 1}?`, body states that Week
      `{week}`'s entries are not deleted, they become future-week entries. `Modal` + `Button`,
      `status-warning` tokens, a lucide icon (no inline SVG).
- [ ] **Empty state is a defensive fallback, not the main path.** Task 3's pre-check skips this modal
      entirely for an empty week (legacy's behaviour). Render a one-line "nothing logged for this
      week" with the confirm still enabled, for the case where data disappears between check and
      render.
- [ ] **Tests:** counts line; each of the three groups renders only when non-empty; a long week
      renders **every** row (explicit no-truncation assertion) inside the scroll container; empty
      fallback; the title/body name the right two weeks; `onConfirm`/`onCancel` fire; `isReverting`
      disables cancel and puts the confirm in its loading state.

**Verify:** `cd frontend && pnpm vitest run src/components/loot/RevertWeekSummaryModal.test.tsx && pnpm dupes`

---

### Task 3: `WeekScopeControl` — R-22's controls, still the clock's mutation host

**Files:** modify `frontend/src/components/loot/WeekScopeControl.tsx`, `frontend/src/components/loot/WeekScopeControl.test.tsx`

- [ ] **Props become the R-15 vocabulary:** `{ clock, displayedWeek, onWeekChange, onFollowClock,
      canEdit, lootLog, materialLog, pageLedger, players }`. `scopedWeek` is gone as a name — the
      concept it encoded (a Priority-view override) no longer exists.
- [ ] **Chevrons.** `IconButton` prev/next flanking the dropdown trigger, `ChevronLeft`/
      `ChevronRight`, `aria-label` `Previous week` / `Next week`, `disabled` at the bounds the caller
      passes; they call `onWeekChange(displayedWeek ∓ 1)`. **Follow the existing v2 stepper**
      (`schedule/WeekNavigatorStrip.tsx:73-92`) — same shape, same labels — so the two don't drift.
      Note that Schedule's null-anchor guard (`:42-44`) has no equivalent here; Loot's control
      renders regardless of `weekStartDate`.
- [ ] **Go-to-current.** An `IconButton` (`LocateFixed`) with `aria-label` `Go to the current week
      (Week {clock.currentWeek})`, calling `onFollowClock()`. **Disabled, not hidden**, when already
      current — hiding it moves the two chevrons every time the user steps back to now.
- [ ] ⚠ **Wrap the group.** `WeekScopeControl` currently returns a bare fragment (`:82-152`) rendered
      straight into `LootToolbar`'s `flex flex-wrap items-center gap-2.5` row (`LootToolbar.tsx:39-41`).
      Three new `IconButton`s added as fragment siblings become toolbar flex children at 10 px gaps
      and will not read as flanking the pill. Wrap chevrons + trigger + go-to-current in their own
      tight flex container.
- [ ] **Trigger label is unchanged:** `This week (Week N)` when current, else `Week N`. R-22's
      correction to the D-40 row is binding — the date range and the loot/books/mats dots live on the
      dropdown **items** (`:90-113`), which already have them. Do not add a range to the trigger.
- [ ] **The mutations stay clock-bound and say so.** `Start next week` and `Revert week` continue to
      read `clock.currentWeek`/`maxWeek` and call `clock.startNextWeek()`/`clock.revertWeek()`.
      When `displayedWeek !== clock.currentWeek`, both confirmations gain a line naming the split:
      *"You're viewing Week {displayedWeek}. This acts on the clock — Week {clock.currentWeek}."*
      A user reading week 2 who hits Revert must not revert week 2.
- [ ] ⚠ **Add D-41's pre-check (director B3) — it is half the ruling and REV 1 dropped it.** D-41
      rules *"the pre-check that fetches the latest week and, if anything is logged, shows a
      data-summary modal"* (`v1-v2-parity-matrix.md:267`); R-22 repeats it
      (`phase-d-loot-design.md:466`). Reference: `HistoryView.tsx:206-238`. On Revert click:
      re-entrancy guard → `await Promise.all([fetchLootLog, fetchMaterialLog, fetchPageLedger])`
      (pulled from `useLootTrackingStore.getState()`, the `Loot.tsx:400` pattern — **no new props**)
      → re-check fresh store state for `clock.currentWeek` → data ⇒ open Task 2's modal; none ⇒
      revert directly. A failed fetch toasts and aborts without mutating.
- [ ] **`isReverting` state is created here** (m6 — Task 2 consumes a prop nothing produced).
      `handleRevertWeek` has no in-flight state today (`:69-79`); add it, drive the modal's
      `isReverting`, and guard against double-clicks through both the pre-check and the mutation.
- [ ] **After either mutation succeeds, call `onFollowClock()`**, not `onWeekChange(newWeek)` — the
      clock is what moved, so the Log resumes following it (Task 1's `null` override).
- [ ] **Tests:** chevron bounds (disabled at 1 and at max; handlers fire in between); go-to-current
      disabled when current, fires `onFollowClock` otherwise; the divergence line appears **only**
      when displayed ≠ clock, in both confirmations; **the pre-check refetches and, on an empty
      week, reverts without opening the modal**; on a non-empty week it opens the modal with the
      clock's week; a fetch failure aborts without mutating; a successful mutation calls
      `onFollowClock`; `canEdit={false}` still renders the week controls but no mutation items
      (existing assertion, preserved).
- [ ] ⚠ **Task 3's Files block was widened by ruling (2026-08-07).** This plan scoped Task 3 to
      `WeekScopeControl.*`, but the repo's commit guard (`.claude/hooks/pre_bash_guard.py`) runs a
      whole-project `tsc -b` on any commit that stages frontend TS. Renaming `WeekScopeControl`'s
      props to the R-15 vocabulary without also updating its one call site would have left
      `Loot.tsx` — and the commit — red until Task 4 landed. Ruled: a minimal, mechanical `Loot.tsx`
      call-site shim folds into Task 3's commit as deliberate throwaway (rename the props at the
      call site to the new names; keep the pre-D4 `scopedWeek` local-override model underneath
      unchanged), documented inline and in the task report. The hook was **not** bypassed. Task 4
      deleted the shim exactly as planned, along with `scopedWeekOverride` itself.
- [ ] ⚠ **The revert flow is ONE CONFIRM PER PATH — this task's own bullets contradicted each other,
      resolved 2026-08-07.** "Both confirmations gain a divergence line" (above) implies two
      confirmations exist on the non-empty path; "on an empty week, revert **without opening the
      modal**" (above) implies zero on the other. Ruled at task review (fix round 1): the `Revert
      week` dropdown item fires the pre-check directly, with no confirmation before the fetch. Data
      found ⇒ `RevertWeekSummaryModal` is the ONLY confirmation, itemised, always naming
      `clock.currentWeek`. Nothing found ⇒ a plain `ConfirmModal` is the ONLY confirmation. A revert
      never happens with zero UI — exactly one confirmation on either path. The divergence line
      (`displayedWeek !== clock.currentWeek`) stays conditional, and now appears on
      `RevertWeekSummaryModal` too via a new **optional** `notice?: ReactNode` prop — additive, so
      omitting it reproduces Task 2's original render byte-for-byte. `Start next week`'s confirmation
      and its divergence line are unchanged. This resolves the contradiction; it is not to be
      re-litigated.

**Verify:** `cd frontend && pnpm vitest run src/components/loot/WeekScopeControl.test.tsx`

---

### Task 4: `Loot.tsx` — the triad, and the death of `scopedWeek`

**Files:** modify `frontend/src/components/loot/Loot.tsx`, `frontend/src/components/loot/Loot.test.tsx`, `frontend/src/components/loot/LootToolbar.tsx`, `frontend/src/components/loot/FloorCard.tsx`, `frontend/src/components/loot/FloorCard.test.tsx`; create `frontend/src/components/loot/LogEmptyState.tsx`

- [ ] **`lview` gains `'log'`:** `useUrlTabState('lview', ['priority', 'log', 'history'] as const,
      'priority')`. v2-local — one reader (this line), and every writer is on a v2 branch. The shared
      whitelist already contains `lview` (`useUrlTabState.ts:38`), so **no shared file changes**.
- [ ] **The toggle becomes a triad:** `Priority | Log | History`, in that order.
- [ ] **Subtitle:** add a Log subtitle alongside the existing two, e.g. `The week's record — every
      drop, book and material, floor by floor`. Vocabulary check: "static", never "group".
- [ ] **Delete `scopedWeekOverride` / `scopedWeek`** (`:229-230`) and replace with
      `const logWeek = useLogWeek(group.id, tier?.tierId, clock)`. Director-verified the read set is
      exactly `:230, 446, 496, 497, 661, 720, 726` — all seven re-pointed:
      - `weekControl` slot: `'log'` → `WeekScopeControl` (fed `displayedWeek={logWeek.week}`,
        `onWeekChange={logWeek.setWeek}`, `onFollowClock={logWeek.followClock}`, plus the four data
        props); `'history'` → `HistoryFilters`; **`'priority'` → nothing.** R-13/R-15: Priority has
        no week control at all.
      - `pickerWeek` (`:446`) → `lview === 'log' ? logWeek.week : clock.currentWeek`. The old
        two-branch comment about a stale Priority scope leaking into History describes a model that
        no longer exists — delete it with the code.
      - `LogWeekWizard currentWeek` (`:720`) → the same expression. **This is R-20's week-target
        split**: Priority's run targets the clock, Log's the displayed week.
      - `LogWeekWizard onSuccess` (`:726`) → `(w) => { refresh(); if (lview === 'log')
        logWeek.setWeek(w); }`. On Priority the run already targeted the clock week.
      - `FloorCard scopedWeek` (`:661`) → the prop collapse below.
- [ ] **Collapse `FloorCard`'s two week props into one.** R-15 makes `scopedWeek` and `currentWeek`
      the same value on every render (director-verified), and a prop whose only documented purpose
      was to *differ* from the other is exactly the dead model this slice removes. Rename the
      required `scopedWeek` → `currentWeek`, delete the optional `currentWeek` and the `enhanceWeek =
      currentWeek ?? scopedWeek` indirection (`FloorCard.tsx:41-47,70,74`), update the doc comment,
      fix the call sites.
- [ ] ⚠ **Blast-radius check — REV 1's guard was wrong and would halt you on day one (director M3).**
      A bare `git grep scopedWeek` **does** hit outside `loot/` today: `schedule/Schedule.tsx:96-97,
      103,185,412` and `schedule/WeekNavigatorStrip.tsx` carry an *independent* week-override of the
      same name, and `loot/BookLedgerCard.tsx:82` has an unrelated local. **Schedule is explicitly
      out of scope.** The correct check is FloorCard's importers — director-verified as exactly one
      non-test importer, `loot/Loot.tsx:67`. Proceed; STOP only if that count has changed.
- [ ] ⚠ **Three tests are DELETED, not renamed (director M4; corrected under M3 — this row
      originally said "Two")** — all three are deliberate regression guards for the model R-15
      removes. Name them in the commit body:
      - `FloorCard.test.tsx:190-192` — "defaults the enhance-context week to scopedWeek when
        currentWeek is absent".
      - `Loot.test.tsx:430-452` — "keeps FloorCard currentWeek pinned to the clock while scoping to
        another week", whose own comment reads *"Deleting `currentWeek={clock.currentWeek}` in
        Loot.tsx must fail this test."* R-15 is precisely that deletion, made deliberate.
      - `Loot.test.tsx` — "defaults the picker to the scoped week in Priority view but the clock
        week in History view" — asserts exactly the back-dated Priority default the affordance-parity
        block above declares gone by ruling; replaced by the strictly stronger R-20 split test
        ("targets the displayed week from Log and the clock week everywhere else").
- [ ] **Log's body** renders `<LogEmptyState />` — a single centred card, design-system primitives,
      naming what arrives next ("the weekly grid: four floor rows, one cell per slot"). No fake
      controls, no disabled buttons standing in for D5's cells.
- [ ] **`LootToolbar` (m2/m3):** its doc header and prop comment describe a two-view axis and
      "WeekScopeControl in Priority" (`:5-8,17`) — false after D4. Update them. Also add an optional
      `logWeekLabel?: string` so the primary action can read `Log Week 2 loot` on Log at a past week
      instead of the unconditional "Log this week's loot" (`:70-77`); default keeps today's copy.
      R-22 requires the mutations to name their week; the same honesty applies to a write action.
- [ ] **`copyLink` decides `week`'s fate (m7):** it currently strips `shell` and sets
      `tab`/`lview`/`entry` (`:362-382`). **Strip `week` too** — a History link carries no week axis,
      and leaving it emergent means a link copied from a Log session silently ships the sender's
      week. Log deep links (which *do* carry `week`) are D6/D11.
- [ ] **Rewrite the doc comment block** (`:1-59`). Remove the three `scopedWeek` bullets and the
      Priority⇄History framing; add: the triad, the Log-owns-the-week model with its storage key and
      resolution order, the wizard week-target split, the shared-`?week=` reach (Constraint 13), and
      the D4 interims.
- [ ] **Leave alone, deliberately:** `LootResetMenu` stays History-only on `clock.currentWeek` (D7
      re-homes and rebinds it); `BookLedgerCard` / `FairnessSummary` stay on History (D7 / D14).
- [ ] **Tests** (`Loot.test.tsx`): the toggle renders three options and switches; Log renders the
      week control and the placeholder; **Priority renders no week control** (repairing the existing
      "WeekScopeControl is always present" assertion at `:485`, which R-15 falsifies); History still
      renders `HistoryFilters`; the picker's week is the clock's on Priority and the displayed week
      on Log; the wizard's `currentWeek` follows the same split; `?lview=log` deep links land on Log;
      `copyLink` omits `week`.

**Verify:** `cd frontend && pnpm vitest run src/components/loot/Loot.test.tsx src/components/loot/FloorCard.test.tsx && pnpm build`

---

### Task 5: Release note, doc write-backs, full gate

**Files:** modify `frontend/src/data/releaseNotes.ts`, `design/redesign/specs/v1-v2-parity-matrix.md`, `design/redesign/specs/phase-d-loot-design.md`, `design/redesign/specs/phase-d-loot-plan.md`, `design/redesign/plans/2026-07-31-phase-d4-log-tab.md`

- [ ] **Release note:** new `version: '2.1.9'`, `internal: true`, top of `RELEASES`, 2.1.8's shape,
      `pr` backfilled after the PR opens. `CURRENT_VERSION` stays `2.1.5`. **Must not claim R-13**
      (Constraint 11) — describe the week model, the triad and the R-22 controls, not "the whole
      week in one glance".
- [ ] ⚠ **Parity-matrix write-backs (director B4) — REV 1 omitted the file entirely.** The design
      record's own policy is *"Ruling-driven row rewrites land with the build"*
      (`phase-d-loot-design.md:597`), and D1 (`c8912706`), D2 (`5e0f714f`) and D3 (`dc3a7a6f`) each
      edited this file. Mark **D-40** and **D-41** `✅ BUILT`, each **scoped to what shipped** —
      D-40's chevrons + go-to-current (the sliding 3-dot stepper itself is not restored; the
      dropdown pill stands, per the ruling), D-41's pre-check + data-summary modal in full.
- [ ] **Design-record write-back (`phase-d-loot-design.md`):** under R-20, a build-time note that
      **"Log material" ships in D8**, with the mechanism reason (`QuickLogMaterialModal`'s fixed
      `floor`/`material` props are exactly what R-26 replaces) and the user-ruling date. A **build
      note, not a ruling change** — R-20's substance stands; only its arrival slice moves. Add the
      D4 placeholder-body ruling beside it.
- [ ] **Plan write-back (`phase-d-loot-plan.md`):** amend the D4 row to name the Log-material carry
      to D8, and the D8 row to receive it.
- [ ] **Full gate**, from `frontend/`: `pnpm build`, `pnpm lint`, `pnpm check:design-system:strict`,
      `pnpm dupes`, `pnpm tokens:check`, `pnpm deadcode` (diffed against the captured baseline),
      `pnpm test`. Paste real output — no gate is claimable without it.
- [ ] ⚠ **V1-safety assert is now THREE parts** (director M1): (a) `git diff --stat main..HEAD` over
      legacy-only paths is empty; (b) no §2.1 shared-layer file appears in the diff at all, with the
      file list; (c) **the shared URL-param reach of Constraint 13, stated with its legacy render
      path** — because (a) and (b) reason only over files and structurally cannot see it.

**Verify:** every gate above, green, with output.

---

## After the tasks (primary session, not subagents)

1. **Live browser validation** — `?shell=v2`, desktop, dark **and** light: the triad switches; the
   chevrons step and disable at the bounds; go-to-current returns and disables; the week survives a
   reload (URL + storage) and a tier switch re-resolves; Priority shows no week control; "Log a
   drop" from Log defaults to the displayed week and from Priority to the clock's; the revert
   pre-check refetches, and the summary modal names the clock's week while a different week is
   displayed. Zero console errors.
2. **Screenshots embedded in the PR** (standing rule): Log at current week, Log at a past week with
   the divergence line visible in the revert modal, Priority with no week control.
3. `xivrp-director` change-review over the full diff before the PR.
4. Final `redesign-reviewer` whole-branch review.
5. Open the PR; run `pr-review-loop` to green. **Merge always awaits the user.**

## Self-review record

- Sizing estimate: ~850–1,150 changed lines (roughly 45% tests) after the B3 pre-check and the
  uncapped modal. Inside the ~1,500 budget; no pre-declared split.
- Riskiest task: **Task 4** — it deletes live v2 behaviour and re-points seven reads. Task 1 lands
  the model first so Task 4 is a re-point, not a redesign.
- Second risk: **Task 1's cold-load resolution** (B2). The regression test is named in the task so it
  cannot be quietly dropped.

## Verified clean by the director (do not re-litigate)

`Loot.tsx` / `WeekScopeControl.tsx` / `FloorCard.tsx` / `LootToolbar.tsx` are all v2-only, and no
§2.1 shared-layer file appears in the slice · Constraint 2's `useUrlTabState` avoidance is correct ·
the `scopedWeekOverride` read set is complete at seven sites · `FloorCard`'s two week props resolve
identically post-D4, so the collapse is sound · `LogWeekWizard` works as a call-site prop with no
component edit · `RevertWeekConfirmModal` filters strictly by the week it is handed, which is why
clock-binding matters · R-22's label correction is honoured · a `2.1.9`/internal entry with no
`CURRENT_VERSION` bump is correct and V1-invisible (`ReleaseNotes.tsx:90-91` filters internal
entries at both levels) · hook placement follows `useRosterSortPreset` · nothing from D5–D8 or D14
is pulled forward.
