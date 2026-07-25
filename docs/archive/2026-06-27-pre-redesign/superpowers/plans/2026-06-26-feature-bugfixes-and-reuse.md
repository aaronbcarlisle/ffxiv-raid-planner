# Plan K — Feature Bugfixes + Component Reuse + Item-UI Consistency

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two reactivity bugs (character-removal empties Jobs & Gear; new tasks/filters don't refresh), extract the better Weapon-Priorities job selector into a reusable `JobSelector` used by Add Job, and turn the ad-hoc Ownership ✓/✗/? control into a labeled design-system tri-state — used to standardize the collection item rows.

**Architecture:** The two bugs share a root cause: components read from a **prop** instead of subscribing to the store, so store updates don't re-render them. Fix by subscribing directly and not conflating "no main character" with "empty". Extract `JobSelector` + `TriStateToggle` as reusable primitives.

**Tech Stack:** React 19 + TS, Zustand, design-system primitives. Vitest/@testing-library.

> **Line numbers are point-in-time — verify before editing.** This plan feeds **Plan L** (design language): `JobSelector` and `TriStateToggle` become canonical components there.

## Global Constraints

- NEVER add AI attribution to commits/PRs.
- Design system: primitives/tokens only; run `pnpm check:design-system`.
- "static" not "group" in user-facing copy.
- **Release/version — per `docs/superpowers/ROADMAP.md` (one coordinated rollout):** add release-note **entries** to `frontend/src/data/releaseNotes.ts` under the single rollout version **`2.0.0`** (public entry with `description`/`pr`/`prTitle` + full ISO date for user-facing; `internal: true` for non-visible). **Do NOT bump `CURRENT_VERSION`** — only the stack-base branch (Plan A) sets it. This supersedes any per-plan "bump `CURRENT_VERSION`" wording in the steps below.
- Pre-PR gate: `cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test`.

---

# Section 1 — Fix: removing a linked character empties Jobs & Gear

**Diagnosis:** `CharacterCard.handleUnlink` (~54) → `playerProfileStore.unlinkCharacter` (~302) deletes + `fetchProfile()`. `JobsGearTab` (~52) renders from the `profile.characters` **prop** and treats `characters.length === 0` as a full empty state (~71), hiding the still-existing `jobProfiles`. So after removing the (only/linked) character the page looks empty until a hard refresh re-seeds props.

## Task 1.1: Subscribe to the store + decouple jobs from "has a character"

**Files:** Modify `frontend/src/components/profile/JobsGearTab.tsx`, `frontend/src/components/profile/CharacterCard.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment jsdom */
// Render JobsGearTab with a profile that has jobProfiles but 0 characters;
// assert the job profiles still render (not the blanket "Link a character first" empty state),
// and that after unlinkCharacter resolves the component reflects the store without a remount.
it('keeps job profiles visible after the last character is unlinked', () => {
  // mock usePlayerProfileStore to return { jobProfiles: [drk], characters: [] }
  // render <JobsGearTab .../>; expect DRK job row present
});
```

- [ ] **Step 2: Run test to verify it fails** — `cd frontend && pnpm test -- JobsGearTab` → FAIL.

- [ ] **Step 3: Fix the data source + empty-state logic**

In `JobsGearTab`, read `characters`/`jobProfiles` from the store (`usePlayerProfileStore(s => s.jobProfiles)` etc.) instead of (only) the prop, so `unlinkCharacter`'s `fetchProfile()` update re-renders it live. Separate the empty states: show "Link a character first" only for the **character-linking** area; keep rendering `jobProfiles` independently (jobs can exist without a currently-linked character). Ensure no derived list throws when `linkedCharacterId` points at a removed character (guard the lookup).

- [ ] **Step 4: Run test to verify it passes** — PASS. Manual: unlink the character → page stays populated (job profiles remain), no refresh needed.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/profile/JobsGearTab.tsx frontend/src/components/profile/CharacterCard.tsx
git commit -m "fix(player-hub): unlinking a character no longer empties Jobs & Gear until refresh"
```

---

# Section 2 — Reusable `JobSelector` (Add Job adopts the Weapon-Priorities UX)

**Diagnosis:** Two job pickers exist: `JobProfileModal` (Add Job — `Set<string>`, role-filter chips, "Select all synced", flat grid) and `weapon-priority/JobSelectorPanel` (role-grouped TANK/HEALER/…, numbered selection badges, "Select All (N)", "Add Selected (N)") — the latter is the nicer UX. Extract it; use it in Add Job.

## Task 2.1: Extract `JobSelector`

**Files:** Create `frontend/src/components/player/JobSelector.tsx` (+ test); refactor `weapon-priority/JobSelectorPanel.tsx` to use it.

**Interfaces:**
- `JobSelector` props: `{ selectedJobs: string[]; onChange: (jobs: string[]) => void; existingJobs?: string[]; showRoleFilters?: boolean; showOrderBadges?: boolean; syncedJobs?: string[]; }`.
  - Role-grouped grid (TANK/HEALER/MELEE/RANGED/CASTER). `showOrderBadges` → numbered position badges (weapon-priority behavior). `showRoleFilters` → the All/Tanks/… filter chips (Add Job behavior). `syncedJobs` → enables a "Select all synced (N)" action.

- [ ] **Step 1: Write the failing test** — selecting jobs calls `onChange` with the ordered list; `existingJobs` render as already-selected; `showOrderBadges` shows numbers.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** by lifting `JobSelectorPanel`'s role-grouped grid + badge logic into `JobSelector`, adding the optional role-filter + synced-select features from `JobProfileModal`. Then make `JobSelectorPanel` a thin wrapper (`showOrderBadges`, no role filters) so weapon-priority behavior is unchanged.

- [ ] **Step 4: Run → PASS.** Commit
```bash
git add frontend/src/components/player/JobSelector.tsx frontend/src/components/player/JobSelector.test.tsx frontend/src/components/weapon-priority/JobSelectorPanel.tsx
git commit -m "feat(player): extract reusable JobSelector from the weapon-priorities picker"
```

## Task 2.2: Add Job modal uses `JobSelector`

**Files:** Modify `frontend/src/components/profile/JobProfileModal.tsx`

- [ ] **Step 1:** Replace the bespoke job grid + filter chips + "Select all synced" + selected display (~140–214) with `<JobSelector selectedJobs={[...selectedJobs]} onChange={...} existingJobs={existingJobs} showRoleFilters showOrderBadges={false} syncedJobs={syncedJobs} />`. Keep Priority / Gear Readiness / Notes sections + the "Add N Jobs" footer. Convert the `Set<string>` state to an array (or adapt at the boundary).
- [ ] **Step 2: Verify** Add Job looks/behaves like the Weapon Priorities selector (role groups, consistent chips), synced-select still works, jobs add correctly. Commit
```bash
git add frontend/src/components/profile/JobProfileModal.tsx
git commit -m "feat(player): Add Job modal uses the shared JobSelector (consistent with Weapon Priorities)"
```

---

# Section 3 — Fix: Tasks & Goals list doesn't refresh on add / filter

**Diagnosis:** `GoalsTab` (~24) derives `personalGoals`/`filteredGoals` from a **`goals` prop** (~21), not the store. `createGoal`/`updateGoal` (`playerProfileStore` ~410) update the store, but `GoalsTab` only re-renders when the parent re-passes the prop (i.e., on tab switch). Switching `statusFilter` to completed/paused and back to All shows nothing because the underlying prop list is stale.

## Task 3.1: Subscribe `GoalsTab` to the store

**Files:** Modify `frontend/src/components/profile/GoalsTab.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment jsdom */
// render GoalsTab; via the mocked store, add a goal AFTER mount; assert it appears without a remount.
// set statusFilter to 'completed' then back to 'all'; assert active goals reappear.
```

- [ ] **Step 2: Run → FAIL** (stale prop list).

- [ ] **Step 3: Fix**

Read goals from the store directly: `const goals = usePlayerProfileStore(s => s.goals)` (drop the prop, or keep the prop only as an initial fallback). Recompute `personalGoals`/`filteredGoals` from the store value so a `createGoal` re-renders live. Ensure the `statusFilter` derivation always re-derives from the current store list (no cached array). Verify switching filters back to "All" shows everything.

- [ ] **Step 4: Run → PASS.** Manual: add a task → appears immediately; toggle filters → list stays correct. Commit
```bash
git add frontend/src/components/profile/GoalsTab.tsx
git commit -m "fix(player-hub): Tasks & Goals list updates live on add and filter changes"
```

---

# Section 4 — `TriStateToggle` for Ownership (and standardize the item rows)

**Diagnosis:** Ownership in `CollectionsCenterTab` (~462–485) is three raw `<button>`s showing only `✓`/`✗`/`?` (have/missing/unknown) — no labels, no segmented styling, no aria. Unclear what they do.

## Task 4.1: Build a design-system `TriStateToggle`

**Files:** Create `frontend/src/components/ui/TriStateToggle.tsx` (+ test).

**Interfaces:**
- `{ value: 'have'|'missing'|'unknown'; onChange: (v) => void; labels?: Record<state,string>; disabled?: boolean }` — a segmented pill (unified border) with icon + label per segment, `aria-pressed`/`aria-label`, status-colored active state (have=success, missing=error, unknown=muted).

- [ ] **Step 1: Write the failing test** — renders three labeled segments; clicking fires `onChange`; active segment has `aria-pressed`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** as a proper segmented control (one bordered group, not three loose buttons), each segment `icon + label` ("Have"/"Missing"/"Unknown") with a tooltip explaining it ("Have — you own this", etc.).
- [ ] **Step 4: Run → PASS.** Commit
```bash
git add frontend/src/components/ui/TriStateToggle.tsx frontend/src/components/ui/TriStateToggle.test.tsx
git commit -m "feat(ui): TriStateToggle segmented control (have/missing/unknown)"
```

## Task 4.2: Adopt `TriStateToggle` + standardize the collection item-row controls

**Files:** Modify `frontend/src/components/profile/CollectionsCenterTab.tsx` (and `components/collections/CatalogBrowse.tsx` / `SourceFarmCard.tsx` rows if they share the controls).

- [ ] **Step 1:** Replace the raw Ownership buttons with `<TriStateToggle>`. While here, make the item row's other controls consistent and self-explanatory: **Intent** (None/Hunting/Interested/Pass/Hidden) is a single-select → render as one segmented control or a `Select` (not loose chips that look like toggles), with labels; **Visibility** stays a `Select`; ensure nothing in the row is a "tag that secretly navigates" (defer the broad semantics audit to Plan L, but fix this row now). Add tooltips to each control.
- [ ] **Step 2: Verify** the Browse Catalog / My Priorities item rows read clearly (what's a toggle vs a select), Ownership is labeled, tooltips present. Commit
```bash
git add frontend/src/components/profile/CollectionsCenterTab.tsx frontend/src/components/collections/CatalogBrowse.tsx
git commit -m "feat(collections): labeled Ownership tri-state + consistent item-row controls"
```

---

# Final — Release notes + verification

**Files:** Modify `frontend/src/data/releaseNotes.ts`

- [ ] **Step 1:** Public entries: Jobs & Gear removal fix, Tasks & Goals refresh fix, unified Add Job/Weapon job picker, clearer Ownership control. `description`/`pr`/`prTitle`/ISO date; bump `CURRENT_VERSION`.
- [ ] **Step 2:** Full gate — `cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test`; `cd scripts && npm test`.
- [ ] **Step 3:** Commit
```bash
git add frontend/src/data/releaseNotes.ts
git commit -m "docs(release): feature bugfixes + component reuse"
```

---

## Self-review notes (already applied)

- **Both bugs share one root cause** (prop instead of store subscription) → fixed the same way; tests added so they don't regress.
- **Character removal** also decouples "no linked character" from "no jobs" so the page never blanks.
- **`JobSelector`/`TriStateToggle`** are extracted as reusable primitives (feed Plan L's design-language componentization).
- **Item-row standardization** is scoped to the collections rows here; the broad "tags that navigate / buttons that toggle" semantics audit is **Plan L**.
- **Line numbers are point-in-time** — verify before editing.
```
