# Plan F — Design-System Standardization (world dropdowns, modals, Split Planner, typography)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five standardization sections: (1) reusable World/Data-Center dropdown + convert all world/server/DC text fields, (2) Add Character modal overhaul (JobPicker, dropdowns, icon, Title Case, no wrap), (3) modal header sweep (Icon | Title, Title Case, no-wrap), (4) Split Planner fixes (dropdown-open content shift, World/Alt-World dropdowns, verify standard primitives), (5) typography scale + normalize tiny/inconsistent text.

**Architecture:** Extract DiscoveryTab's DC→World cascade into a reusable `WorldSelect`; use it everywhere. Standardize modal headers against the existing `Modal`/`ConfirmModal` pattern. Fix the Split Planner `Select` portal/scroll behavior. Document a typography scale + floor and normalize the worst offenders.

**Tech Stack:** React 19 + TS, Tailwind v4, Radix Select/Dropdown, Zustand; Vitest/@testing-library.

> **Line numbers are point-in-time — match on code/strings and verify before editing.**
> **Overlap with Plan E:** Plan E §4.2 converts the Lodestone Server field to a DC/World dropdown. If Plan F §1 lands first, Plan E §4.2 should consume `WorldSelect`; if Plan E lands first, §1 retrofits the Lodestone field to the shared component. Coordinate to avoid two implementations.

## Global Constraints

- NEVER add AI attribution to commits/PRs.
- Design system mandatory: primitives/tokens only; preserve existing `design-system-ignore` comments; run `pnpm check:design-system`.
- "static" not "group" in user-facing copy. Titles use **Title Case**.
- **Release/version — per `docs/superpowers/ROADMAP.md` (one coordinated rollout):** add release-note **entries** to `frontend/src/data/releaseNotes.ts` under the single rollout version **`2.0.0`** (public entry with `description`/`pr`/`prTitle` + full ISO date for user-facing; `internal: true` for non-visible). **Do NOT bump `CURRENT_VERSION`** — only the stack-base branch (Plan A) sets it. This supersedes any per-plan "bump `CURRENT_VERSION`" wording in the steps below.
- Pre-PR gate: `cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test`.

## Reference data (verified)

- Worlds/DC: `gamedata/worlds.ts` → `DC_NAMES`, `getWorldsForDC(dc)`, `getDCForWorld(world)` (exported via `gamedata/index.ts`). Full list, 12 DCs.
- Cascade reference: `components/settings/DiscoveryTab.tsx` (DC `Select` + World `Select`, `handleDCChange` resets world when DC changes).
- `Modal` (`components/ui/Modal.tsx`): `title: ReactNode`, sizes `sm|md|lg|xl|2xl|3xl|4xl|5xl`, no auto-icon. `ConfirmModal` auto-adds icons by variant. Correct header: `title={<span className="flex items-center gap-2"><Icon className="w-5 h-5"/>Title</span>}`.
- `JobPicker` (`components/player/JobPicker.tsx`): `{ selectedJob, onJobSelect, onRequestClose?, templateRole?, reverseLayout? }` (see `AddPlayerModal` usage).

---

# Section 1 — Reusable `WorldSelect` + convert world/server/DC text fields

**Inventory of text fields to convert:**
- `components/roster/AddManualCharacterModal.tsx` — World (~125), Data Center (~129) → handled in §2.
- `components/split-clear/SplitClearAssignmentBoard.tsx` — Main World (~254), Alt World (~277), + mobile (~483, ~504) → handled in §4.
- `components/player/LodestoneSearchModal.tsx` — Server (~406) → Plan E §4.2 (use `WorldSelect`).
- `components/profile/CharacterLinkModal.tsx` — Server (~99) → §1.3.

## Task 1.1: Build `WorldSelect`

**Files:**
- Create: `frontend/src/components/player/WorldSelect.tsx`
- Test: `frontend/src/components/player/WorldSelect.test.tsx`

**Interfaces:**
- Produces: `WorldSelect` with two modes:
  - `{ world: string; onWorldChange: (w: string) => void; dataCenter?: string; onDataCenterChange?: (dc: string) => void; showDataCenter?: boolean; disabled?; allowAny?: boolean; layout?: 'row' | 'stack' }`.
  - When `showDataCenter`, renders DC `Select` + World `Select` (cascade: changing DC resets world). When not, renders a single World `Select` whose options are all worlds grouped by DC (or filtered by an externally-provided `dataCenter`). `allowAny` adds an "Any" empty option.

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorldSelect } from './WorldSelect';

describe('WorldSelect', () => {
  it('changing data center resets the world', () => {
    const onWorld = vi.fn();
    const onDc = vi.fn();
    render(<WorldSelect showDataCenter dataCenter="Aether" world="Gilgamesh"
      onDataCenterChange={onDc} onWorldChange={onWorld} />);
    // pick a different DC → world cleared
    // (drive the DC Select to 'Primal'); assert onDc('Primal') and onWorld('') both fired
    // ...mirror how Select is exercised in existing Select tests
    expect(onDc).toHaveBeenCalled();
    expect(onWorld).toHaveBeenCalledWith('');
  });
});
```
(Read an existing `Select` test to drive the Radix select correctly in jsdom.)

- [ ] **Step 2: Run test to verify it fails** — `pnpm test -- WorldSelect` → FAIL (module missing).

- [ ] **Step 3: Implement** (port the DiscoveryTab cascade into a reusable component)

```tsx
import { Select } from '../ui';
import { DC_NAMES, getWorldsForDC } from '../../gamedata';

interface WorldSelectProps {
  world: string;
  onWorldChange: (w: string) => void;
  dataCenter?: string;
  onDataCenterChange?: (dc: string) => void;
  showDataCenter?: boolean;
  disabled?: boolean;
  allowAny?: boolean;
  layout?: 'row' | 'stack';
}

export function WorldSelect({
  world, onWorldChange, dataCenter = '', onDataCenterChange,
  showDataCenter = true, disabled, allowAny = true, layout = 'row',
}: WorldSelectProps) {
  const dcOptions = [
    ...(allowAny ? [{ value: '', label: 'Select data center' }] : []),
    ...DC_NAMES.map(dc => ({ value: dc, label: dc })),
  ];
  const worldOptions = dataCenter
    ? [...(allowAny ? [{ value: '', label: 'Any world' }] : []), ...getWorldsForDC(dataCenter).map(w => ({ value: w, label: w }))]
    : [{ value: '', label: 'Select a data center first' }];

  const handleDc = (dc: string) => { onDataCenterChange?.(dc); if (dc !== dataCenter) onWorldChange(''); };

  return (
    <div className={layout === 'row' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
      {showDataCenter && (
        <Select aria-label="Data center" value={dataCenter} onChange={handleDc} options={dcOptions} disabled={disabled} />
      )}
      <Select aria-label="World" value={world} onChange={onWorldChange} options={worldOptions} disabled={disabled || (showDataCenter && !dataCenter)} />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes** — PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/player/WorldSelect.tsx frontend/src/components/player/WorldSelect.test.tsx
git commit -m "feat(ui): reusable WorldSelect (data-center + world dropdown cascade)"
```

## Task 1.2: Refactor DiscoveryTab to use `WorldSelect` (dogfood)

**Files:** Modify `frontend/src/components/settings/DiscoveryTab.tsx`

- [ ] **Step 1:** Replace the inline DC/Server `Select` pair (~1079–1085) with `<WorldSelect showDataCenter dataCenter={dataCenter} onDataCenterChange={setDataCenter} world={server} onWorldChange={setServer} disabled={!canEdit} />`. Remove now-dead `dcOptions`/`serverOptions`/`handleDCChange` if unused.
- [ ] **Step 2:** `pnpm test -- DiscoveryTab && pnpm build` → green. Manual: listing DC/World still cascades + saves.
- [ ] **Step 3:** Commit
```bash
git add frontend/src/components/settings/DiscoveryTab.tsx
git commit -m "refactor(recruitment): DiscoveryTab uses shared WorldSelect"
```

## Task 1.3: CharacterLinkModal server → World dropdown

**Files:** Modify `frontend/src/components/profile/CharacterLinkModal.tsx`

- [ ] **Step 1:** Replace the Server text `Input` (~99) with `WorldSelect` (single-world mode or DC+World, matching what the link flow needs). Map the chosen world to the existing `server` value.
- [ ] **Step 2:** `pnpm build`; manual link flow works. Commit
```bash
git add frontend/src/components/profile/CharacterLinkModal.tsx
git commit -m "feat(profile): CharacterLinkModal uses WorldSelect"
```

---

# Section 2 — Add Character modal overhaul

**Diagnosis (`components/roster/AddManualCharacterModal.tsx`):** title `\`Add manual character — ${playerName}\`` (sentence case, no icon, `size="sm"` → wraps on long names); World/DC are text Inputs (~125/129); Job is a text Input with placeholder "DRK" (~155).

## Task 2.1: Rework the modal

**Files:** Modify `frontend/src/components/roster/AddManualCharacterModal.tsx`

- [ ] **Step 1: Title — icon + Title Case + no wrap**

Change the title to an icon + concise static title, and move the player name into the body (not the header) to kill wrapping:
```tsx
import { UserPlus } from 'lucide-react';
// title:
title={<span className="flex items-center gap-2"><UserPlus className="w-5 h-5" />{editing ? 'Edit Character' : 'Add Character'}</span>}
```
Render `for {playerName}` as a subtitle line inside the modal body (e.g. a `text-sm text-text-muted` line under the header). Bump `size="sm"` → `size="md"`.

- [ ] **Step 2: World/DC → `WorldSelect`**

Replace the World + Data Center text Inputs with `<WorldSelect showDataCenter dataCenter={dataCenter} onDataCenterChange={setDataCenter} world={world} onWorldChange={setWorld} />` (Section 1).

- [ ] **Step 3: Job → JobPicker**

Replace the Job text `Input` with the `JobPicker` flow used by `AddPlayerModal` (a button showing the selected job that opens `JobPicker`; `onJobSelect` sets `job`). Keep "Job (optional)" semantics — allow clearing.

- [ ] **Step 4: Verify + commit**

`pnpm test -- AddManualCharacterModal && pnpm build`. Manual: modal has the UserPlus icon, "Add Character" title (no wrap), DC/World dropdowns cascade, Job uses the picker.
```bash
git add frontend/src/components/roster/AddManualCharacterModal.tsx
git commit -m "feat(roster): Add Character modal — icon, Title Case, World/Job pickers, no title wrap"
```

---

# Section 3 — Modal header standardization sweep

**Diagnosis:** `Modal` has no auto-icon; the standard is `title={<span className="flex items-center gap-2"><Icon/>Title</span>}`. Flagged modals **missing an icon** and/or **sentence-case** titles:
- `BiSTargetManagerModal.tsx` (no icon), `RewardGoalModal.tsx` (no icon), `JobProfileModal.tsx` (no icon), `CharacterLinkModal.tsx` (no icon), `SuggestContentModal.tsx` (no icon), `RewardGoalDetailModal.tsx` (no icon), `FlexRolesModal.tsx` (verify), `LogMaterialModal.tsx` (verify), `LodestoneSearchModal.tsx` (verify).
- Sentence-case → Title Case: `LinkPlayerHubCharacterModal.tsx` ("Link Player Hub character"), and any others found.

## Task 3.1: Audit + produce the fix list

**Files:** Read-only.

- [ ] **Step 1: Enumerate every modal title**

Run: `cd frontend && grep -rn "title=" src/components --include=*.tsx | grep -iE "Modal|useModal" -n` and `grep -rln "<Modal" src`. For each modal, record: file, current title, has-icon?, Title-Case?, dynamic/long?. Produce a checklist (this is the source of truth for Step-by-step fixes below). Include `ConfirmModal` consumers — those already auto-icon, skip.

## Task 3.2: Apply icons + Title Case (one commit per cluster)

**Files:** the flagged modal components.

- [ ] **Step 1: Add a contextual icon to each iconless modal**

For each, wrap the title with a fitting lucide icon (examples): BiS Targets → `Target`; Collection Goal → `Trophy`; Job Profile → `Swords`/`Crosshair`; Character Link → `Link`; Suggest Content → `Lightbulb`; Delete Goal → use `ConfirmModal`/`Trash2`; Flex Roles → `Shuffle`; Log Material → `Boxes`; Lodestone → `Globe`. Pattern: `title={<span className="flex items-center gap-2"><Icon className="w-5 h-5" />Title</span>}`.

- [ ] **Step 2: Convert sentence-case titles to Title Case**

"Link Player Hub character" → "Link Player Hub Character", "Edit character" → "Edit Character", etc. Keep dynamic suffixes but move very long dynamic names into the body where wrap risk is high (same approach as §2).

- [ ] **Step 3: Verify + commit (group logically)**

`pnpm build && pnpm check:design-system && pnpm test`. Manual spot-check a few modals.
```bash
git add frontend/src/components/**/<modals>
git commit -m "fix(ui): standardize modal headers (icon + Title Case) across the app"
```

> Keep this sweep mechanical and reviewable; if it's large, split into 2–3 commits by area (gear/collections/roster).

---

# Section 4 — Split Planner fixes

**Diagnosis (`components/split-clear/SplitClearAssignmentBoard.tsx`, `components/ui/Select.tsx`):**
- LOOT/RUNS dropdowns already use the design-system `Select`; checkboxes already use the design-system `Checkbox`. So "not standard" is mostly **visual jank**, not the wrong primitive.
- **Content shift root cause:** `Select` deliberately renders its content **without a Portal** and **overrides Radix scroll-lock** (`usePreventScrollLock`) to avoid breaking sticky nav. Inline-rendered menu expands content height → the page gains a scrollbar → everything shifts left.
- World/Alt-World are text `Input`s (~254/277 desktop, ~483/504 mobile).

## Task 4.1: Fix the dropdown-open content shift

**Files:** Modify `frontend/src/components/ui/Select.tsx` (and/or the Split Planner container)

- [ ] **Step 1: Reproduce + confirm the mechanism**

Open a LOOT dropdown on the Split Planner; confirm a vertical scrollbar appears and content shifts. Confirm in `Select.tsx` the `{/* No Portal ... */}` content + `usePreventScrollLock` override.

- [ ] **Step 2: Stabilize**

Preferred fix: make the Select content not change page scroll geometry. Options, pick the one that holds across the app (Select is shared):
- **A (recommended):** Re-introduce a `SelectPrimitive.Portal` so the menu renders in an overlay (not inline-expanding the scroll container), AND fix the original sticky-nav scroll-lock problem properly — keep `usePreventScrollLock` but also set `scrollbar-gutter: stable` on `<body>`/the scroll container so re-adding scroll-lock doesn't shift. Verify the sticky header/nav no longer jumps (the reason portal was removed).
- **B:** Keep inline, but reserve the scrollbar gutter at the page level while any Select is open (add a `scrollbar-gutter: stable` to the actual scroll container that gains the scrollbar, or compensate width) so opening a menu can't introduce a new scrollbar.

Since `Select` is shared, regression-check other heavy Select users (DiscoveryTab, forms) after the change.

- [ ] **Step 3: Verify + commit**

Manual: open LOOT/RUNS dropdowns on Split Planner — no scrollbar pop, no content shift; sticky header/nav still stable elsewhere; other Selects unaffected.
```bash
git add frontend/src/components/ui/Select.tsx frontend/src/index.css
git commit -m "fix(ui): Select no longer shifts page content when opened"
```

## Task 4.2: World / Alt-World → dropdowns

**Files:** Modify `frontend/src/components/split-clear/SplitClearAssignmentBoard.tsx`

- [ ] **Step 1:** Replace the Main World and Alt World text `Input`s (desktop ~254/277 and mobile ~483/504) with a compact `WorldSelect` (single-world mode — `showDataCenter={false}` to fit the narrow column, or a DC-aware variant if space allows). Preserve the `onBlur`/save semantics (Select fires `onChange` — wire it to the same `saveOnBlur`-equivalent persistence the inputs used).
- [ ] **Step 2:** Manual: pick worlds from dropdowns; values persist. Commit
```bash
git add frontend/src/components/split-clear/SplitClearAssignmentBoard.tsx
git commit -m "feat(split-planner): World / Alt World use dropdowns"
```

## Task 4.3: Polish dropdown/checkbox sizing in the board

**Files:** Modify `frontend/src/components/split-clear/SplitClearAssignmentBoard.tsx`

- [ ] **Step 1:** The Selects/Checkboxes use the design-system components but at cramped `text-xs`/`w-20` sizes. Normalize them to comfortable sizes consistent with other tables (see §5 typography floor) and confirm the Checkbox `A`/`B` labels render with the standard look. No primitive swap needed — confirm and adjust classes only.
- [ ] **Step 2:** Commit
```bash
git add frontend/src/components/split-clear/SplitClearAssignmentBoard.tsx
git commit -m "polish(split-planner): consistent dropdown/checkbox sizing"
```

---

# Section 5 — Typography scale + normalization

**Diagnosis:** No documented font-size scale; ESLint/`check:design-system` don't enforce sizes; **460 arbitrary `text-[Npx]`** usages (1×7px, 2×8px, 53×9px, 292×10px, 95×11px, …). Hotspots: `StaticHomeTab` (28), `CollectionsCenterTab` (21), `SplitClearAssignmentBoard` (19), `DiscoveryTab` (19), `WeeklyLootGrid` (12), `Discover` (10), `SessionCard` (10). Worst: `UserMenu` badge `text-[7px]`, `CharacterRoleBadge` `text-[8px]`.

## Task 5.1: Document the scale + floor

**Files:** Modify `frontend/docs/DESIGN_SYSTEM_SUMMARY.md` (and add a short note to `CODING_STANDARDS.md`)

- [ ] **Step 1: Write the standard**

Document the semantic scale and the floor:
- `text-xs` (12px): captions, badges, dense metadata — **the floor for any text users read**.
- `text-sm` (14px): body, form labels, table cells.
- `text-base` (16px): primary content.
- `text-lg`+ : headings.
- **Floor rule:** no `text-[Npx]` below `text-xs` for readable text. The only allowed sub-12px is a numeric **badge count**, and never below `text-[9px]`. No `text-[7px]`/`text-[8px]` anywhere.
Map arbitrary → semantic: `text-[10px]`/`text-[11px]`/`text-[12px]` → `text-xs`; `text-[13px]` → `text-sm`; `text-[9px]` → `text-xs` unless it's a badge count.

- [ ] **Step 2: Commit**
```bash
git add frontend/docs/DESIGN_SYSTEM_SUMMARY.md frontend/docs/CODING_STANDARDS.md
git commit -m "docs(design-system): document the typography scale and minimum size floor"
```

## Task 5.2: Fix the critical sub-9px offenders

**Files:** `components/auth/UserMenu.tsx`, `components/auth/NotificationCenter.tsx`, `components/roster/CharacterRoleBadge.tsx`

- [ ] **Step 1:** Bump `text-[7px]`/`text-[8px]` badge text up to `text-[9px]` minimum (or restructure the badge so the count fits at `text-[9px]`). Verify badges still fit their dots.
- [ ] **Step 2:** Commit
```bash
git add frontend/src/components/auth/UserMenu.tsx frontend/src/components/auth/NotificationCenter.tsx frontend/src/components/roster/CharacterRoleBadge.tsx
git commit -m "fix(a11y): raise sub-9px badge text to the readable floor"
```

## Task 5.3: Normalize hotspot files to the scale

**Files:** the hotspot components (do a few per commit): `StaticHomeTab.tsx`, `CollectionsCenterTab.tsx`, `SplitClearAssignmentBoard.tsx`, `DiscoveryTab.tsx`, `WeeklyLootGrid.tsx`, `Discover.tsx`, `SessionCard.tsx`, `DutyFarmCard.tsx`.

- [ ] **Step 1: Replace arbitrary sizes per the mapping**

In each file, replace `text-[10px]`/`text-[11px]`/`text-[12px]` → `text-xs` and `text-[13px]` → `text-sm` **where the text is read by users** (labels, values, metadata, timestamps). Leave genuine badge counts at `text-[9px]`+ if shrinking them would break layout, but prefer `text-xs`. Also fix inline `style={{ fontSize: '10px' }}` (e.g. `StaticHomeTab` last-modified) to a class. Visually verify each file doesn't overflow after the bump (tighten padding/width if needed rather than reverting the size).

- [ ] **Step 2: Commit per cluster**
```bash
git add <files in this cluster>
git commit -m "polish(typography): normalize <area> text to the semantic scale"
```

> Scope: do the listed hotspots in this plan. A full 460-site sweep is a follow-up; this plan establishes the scale + clears the worst offenders so new code has a documented target.

## Task 5.4 (optional): Lint guard for tiny text

**Files:** Modify `frontend/eslint-design-system-plugin.js`

- [ ] **Step 1:** Add a rule that **warns** on `className` containing `text-[7px]`/`text-[8px]` (error) and `text-[9px]`/`text-[10px]`/`text-[11px]` (warn → suggest `text-xs`). Keep it `warn` so it doesn't block CI on the remaining legacy sites; teams clear them over time.
- [ ] **Step 2:** `pnpm lint` runs clean (warnings allowed). Commit
```bash
git add frontend/eslint-design-system-plugin.js
git commit -m "chore(design-system): warn on sub-xs arbitrary text sizes"
```

---

# Final — Release notes + verification

**Files:** Modify `frontend/src/data/releaseNotes.ts`

- [ ] **Step 1:** Add public entries covering: world/server dropdowns, Add Character modal redesign, modal header consistency, Split Planner dropdown fix, and the typography pass. `description` + `pr` + `prTitle` + full ISO date; bump `CURRENT_VERSION`.
- [ ] **Step 2:** Full gate — `cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test`; `cd scripts && npm test`.
- [ ] **Step 3:** Commit
```bash
git add frontend/src/data/releaseNotes.ts
git commit -m "docs(release): design-system standardization pass"
```

---

## Self-review notes (already applied)

- **Reuse:** one `WorldSelect` (ported from DiscoveryTab's proven cascade) feeds AddCharacter, CharacterLink, Split Planner, and (cross-plan) Lodestone — no duplicated DC/World logic.
- **Split Planner reality check:** dropdowns/checkboxes already use design-system components; the real defect is `Select`'s no-portal + scroll-lock override causing the content shift — §4.1 fixes that at the shared component (regression-check other Select users).
- **Modal sweep is audit-driven** (§3.1 produces the list) so no modal is missed; `ConfirmModal` consumers are correctly skipped (already auto-iconed).
- **Title wrap fix:** move dynamic names into the body + bump `sm`→`md` rather than just widening, so long names never wrap the header.
- **Typography is scoped:** document the scale + floor, clear the worst (sub-9px) and the hotspot files, add a non-blocking lint warn — full 460-site normalization is an explicit follow-up, not a single mega-PR.
- **Cross-plan coordination** with Plan E §4.2 (Lodestone server dropdown) is called out to avoid two implementations.
- **Line numbers are point-in-time** — every task says verify before editing.
```
