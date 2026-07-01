# F6c — Roster (Cards ⇄ Board) — Design Spec

> **Status:** approved in brainstorm 2026-07-01 · **two sequential PRs** off `redesign/foundation` (`bd52e74`): `redesign/f6c-cards` → squash-merge, then `redesign/f6c-board` → squash-merge. Implementation plans written separately (writing-plans) per PR from this shared spec.
>
> **Authority docs:** `docs/PRODUCT_MODEL.md` (vision; §3.1 two-layer rule), `design/redesign/REDESIGN_SPEC.md` §5.2/§7 (Roster/Board blueprint + re-home map), `design/redesign/DESIGN_SYSTEM.md` (atoms/contracts/§3 component style/§4.1 lexicon), `design/redesign/specs/f5-screen-components-map.md` (the **Roster-Cards** + **Roster-Board** element tables + the 27-entry catalog — this slice's build manifest), `design/redesign/FOUNDATION_ROADMAP.md` §2.1 (F6c row), `design/redesign/mockups/02-roster-cards.html` + `02-roster-board.html` (the visual targets). The F6b spec/plan (`specs/2026-06-30-f6b-home-design.md`, `plans/2026-06-30-f6b-home.md`) is the **template** for how a slice is specced/executed.

---

## 1. Goal & scope

Build the **redesigned Roster** — the "*who is in this static and how geared are they*" screen — as **two views on one axis**: **Cards** (per-player management cards, the roster-management view) ⇄ **Board** (the re-homed gearsheet matrix, the bird's-eye power view). Wire it behind `?shell=v2` as the **`roster` slot** on `GroupViewContent`, exactly the seam F6b used for the `overview` slot. Both views render the **same data** (`REDESIGN_SPEC §5.2`); the toggle only changes presentation.

**Two-PR structure (locked — §2.5):**
- **`f6c-cards`** (~10–12 tasks): the v2 `<Roster/>` assembly + roster-slot wiring + the enabling refactor (§3.2); the **Cards** view (v2 `RosterCard` grid, party grouping, subs, empty/invite card) with **full interaction parity via reuse** (kebab menu, action flows, permissions, inline edits) + **reorder-as-explicit-mode**; the v2 roster toolbar (grouping pill + subs chip + Reorder + Add player); both **carries** (`canManageRoster` fix, `findPlayerByUserId` util). Ships Cards as the only v2 roster view — **no view toggle yet**.
- **`f6c-board`** (~7–9 tasks): the `SegmentedToggle` (added to the toolbar, flipping Cards⇄Board) + `GearBoard` + `GearBoardCell` + the `PlayerIdentity` `board-cell` variant + the gear-source legend; **housekeeping** (prune Roster-domain `eslint-suppressions.json` entries, re-enable the contrast harness on the roster screen, fix the `goToTestStatic` e2e selector).

**In scope (the full mocked Roster — both mockups):** the two-view screen above, the party-grouped layout (G1/G2/Subs), the per-card BiS bar + compact gear-pip row + reused footer/setup prompt, the gear matrix (rows=players × 11 slot cols + BiS summary col, party-divider rows, the "no BiS imported" spanning-row state), the page header + gear-source legend.

**Out of scope (deferred, each with an explicit home):**
- **The per-card expanded `GearTable`** — the compact⇄expanded **density axis is dropped**; Cards⇄Board *replaces* it (§2.2). The Board is the gear-editing surface.
- **`GearBoardCell` "next-upgrade-priority" highlight** (the `need.up` cell state) — a **loot-priority** signal owned by **F6d**; F6c **reserves the state in the cell API** but renders plain `need`.
- **"All jobs ▾" / "All slots ▾" filters** — new conveniences, no precursor → deferred (the filter-pill *pattern* ships via the grouping pill, so later addition is cheap).
- **Board "Show: current tier ▾"** (cross-tier gear view) — aspirational, no precursor → deferred.
- **"Export"** — wire to an existing export if one exists and it is a one-liner; otherwise defer the button (confirm at plan time).
- **"Split planner" as a native Board mode** — the button **routes to the existing split-planner surface**; a ring0 rebuild of the ring1 `split-clear` feature is **not** in F6c (§2.1, §9).
- **The Characters/Lodestone *registry***  → re-homes to **Player Hub** (Person layer, deferred Ring-1); F6c stacks the per-static character *link* onto the card and keeps a temporary bridge to the existing panel (§2.4, §6).
- **TeamSummaryEnhanced books/mats columns + GearSyncDashboard health cards** — those numbers now live on **F6b Home** (readiness) and are a **Loot** concern; **not** re-absorbed into Roster (§2.1).
- **`?shell=v2` exposure** — stays a flag; no user-facing change this slice.

**Non-negotiable constraints (carried from F6a/F6b):**
- **Legacy `/group/:shareCode` (no `?shell=v2`) stays byte-for-byte.** The slot mechanism + the `!slots?.roster` guard (§3.2) guarantee it: the legacy path passes no slots, so the guard is a no-op and `GroupViewContent` renders the legacy roster chrome + `StaticHomeTab`-era bodies exactly as today. We do **not** modify legacy `PlayerCard`, `PlayerGrid`, `LightPartyHeader`, or any shared legacy component.
- **No new `eslint-suppressions.json` entries** (F4 baseline = 17 files / 28 edges). New roster components live in **`components/roster/`** which is **already classified ring0** — no boundary change needed. F6c *shrinks* the baseline (prune Roster-domain entries).
- **No AI attribution** in commits/PRs (absolute).
- **Internal release note** (`{ internal: true }`), **no `CURRENT_VERSION` bump** (shell still flag-gated) — one entry per PR.
- **Design system is law:** tokens only (no raw color), 12px readable floor, shared interactions use the shared component. `pnpm check:design-system:strict` gates each PR; new `components/ui/` components are held to the shared-layer **error**-level DS rules.

---

## 2. Locked decisions (from the 2026-07-01 brainstorm)

1. **Board scope = the gear matrix, nothing more.** `GearBoard` + `GearBoardCell` reproducing `mockups/02-roster-board.html`. "Split planner" + "Export" are toolbar **buttons routing to existing surfaces**, not rebuilds. **Do not** absorb TeamSummaryEnhanced's books/mats columns or GearSyncDashboard's health cards — they overlap the F6b Home readiness cards (RosterReadinessCard/RoleBisCard) and books/mats are a Loot concern; re-absorbing them would create two homes for the same data.
2. **Density axis dropped; Cards⇄Board replaces compact⇄expanded.** The per-card expanded `GearTable` is **retired in v2**. The **Board is the gear-editing surface** (each `GearBoardCell` is the interactive `GearStatusCircle`: have→need→aug). Cards carry the compact pip summary (optionally click-to-cycle obtained state). **BiS/source-level editing** (import BiS, set BiS target, reset) stays on the **kebab**. The rare *manual per-slot source override* the old GearTable offered is traded for the kebab path / a deferred edge (not load-bearing — most users import BiS).
3. **Card interaction parity = full, via reuse.** The v2 `RosterCard` is a **new** presentational shell (`CardShell` + `PlayerIdentity` + `ProgressBar` + pip row + footer) that **reuses the existing behavior** — `usePlayerActions`, the permission fns, the context-menu items builder, `useDragAndDrop` (hooks/utils, *not* the legacy card, so reuse is not a legacy edit). Kebab menu, action flows, permission gating, and inline field edits (job/position/tank-role/name) all reach parity by reuse. **Reorder is an explicit mode** behind the toolbar "Reorder" button (reusing `useDragAndDrop` so cross-group G1↔G2 swap survives); default cards are static/non-draggable.
4. **Characters/Lodestone registration is NOT a peer view.** Per `PRODUCT_MODEL §3.1` (characters & alts are Person-layer, must aggregate into static views not duplicate per group). The per-static character **link** stacks onto the roster card (link/change-character as a card/kebab action; sync status shown). The character **registry/CRUD** (`RosterCharacterPanel` + `staticCharacterStore`) re-homes to **Player Hub** (deferred Ring-1) — kept reachable as a **temporary flagged bridge** since Player Hub isn't built. F6c decides the UI home, **not** the data-model migration.
5. **Two sequential PRs** — `f6c-cards` → `f6c-board` (§1). The `SegmentedToggle` rides in `f6c-board` (a toggle needs both destinations real).
6. **Deferrals confirmed** (user, 2026-07-01): the jobs/slots filters and the `GearBoardCell` priority-highlight are both deferred; the priority-highlight is API-reserved on the cell.
7. **Carries** (both in `f6c-cards`): the `canManageRoster` bare-truthy fix (`GroupViewContent.tsx:1315` → append `.allowed`) + a test; a shared **`findPlayerByUserId`** util (needed for the role-colored `PlayerIdentity`). The additive `SessionRsvpCard` `rsvpRoles?` prop is **F6e's** to wire (really a Schedule/Home concern) — do it in F6c *only if trivial* once `findPlayerByUserId` exists.

---

## 3. Architecture

### 3.1 The roster slot (the seam, from F6a)

`GroupViewContent` types `GroupTab = 'overview' | 'roster' | 'gear' | 'schedule'` and `slots?: Partial<Record<GroupTab, React.ReactNode>>`, choosing `{pageMode === 'X' && (slots?.X ?? <legacy body>)}`. F6c makes `NewShell` pass the roster slot, mirroring F6b's Home:

```tsx
// NewShell / ShellContent (v2 path only)
const roster = currentGroup ? (
  <Roster group={currentGroup} tier={currentTier}
          canManage={canManageRoster(userRole).allowed}
          onNavigate={gv.setPageMode}
          onOpenRequests={() => useSettingsPanelStore.getState().open({ tab: 'recruitment', section: 'requests' })} />
) : undefined;
return <GroupViewContent actions={useGroupActions()} slots={{ overview, roster }} />;
```

- **Legacy untouched:** `GroupView.tsx` calls `<GroupViewContent actions={…}/>` with **no `slots`** → the roster region renders exactly as today.
- **Prop contract mirrors Home:** `{ group, tier, canManage, onNavigate, onOpenRequests }`. The v2 `<Roster/>` reads the rest from stores directly (`tierStore` players, `staticCharacterStore` for the character link, `authStore`), and `useGroupActions()` is in scope under `NewShell`/`GroupActionModals` for add-player/assign/etc.

### 3.2 The enabling refactor (zero behavior change on legacy)

The roster region is **two separate `pageMode === 'roster' &&` blocks** in `GroupViewContent`: (a) a sticky toolbar (`~691–847`: the `Members/Characters/Split Planner` sub-tabs + member controls — Add Player, `SortModeSelector`, DnD-lock, Show Subs, Separate Subs) and (b) the body (`~907–941`: `PageHeader` + `RosterCharacterPanel` / `SplitClearPlanner` / `rosterDndArea`). There are also **mobile** roster-only chrome blocks (the FAB `~1160`, the controls sheet `~1219–1254`).

Because the slot only swaps the **body**, the v2 Roster would render *under* the legacy toolbar. Fix: **gate every legacy roster-only chrome block behind `!slots?.roster`**, and add `slots?.roster ??` to the body block. On the legacy route `slots` is `undefined`, so `!slots?.roster === true` and `slots?.roster === undefined` → **byte-for-byte identical**; in v2 the legacy chrome drops out and `<Roster/>` (with its own responsive toolbar) owns the entire region. This is the direct analogue of how the `overview` slot replaced `PageHeader`+`StaticHomeTab`.

**Guarded blocks:** sticky toolbar (`~691`), mobile FAB (`~1160`), mobile controls sheet (`~1219`). The `rosterSubView` state (`members/characters/split-planner`, `useUrlTabState('rsub', …)`) is only read by the legacy chrome; v2 does not use it (Cards⇄Board is the v2 axis; Characters/Split are handled per §2.4/§2.1). Leave the legacy state in place (untouched) for the legacy path.

### 3.3 Two-PR seam

`f6c-cards` lands the slot wiring + the enabling refactor + the Cards view; its toolbar has **no** view toggle (Cards is the only v2 roster view). `f6c-board` adds the `SegmentedToggle` to the toolbar and the Board view + the `roster-view` state key. Both PRs branch off `redesign/foundation`; `f6c-board` branches after `f6c-cards` merges (inherits it).

---

## 4. Component inventory & placement (boundary-safe)

The F4 element graph governs placement. `components/roster/` is **already ring0** (it holds `RosterCharacterPanel` today) and `components/player/` / `components/team/` are ring0 — so ring0→ring0 imports are fine and **no `boundaries/elements` change is needed** (contrast with F6b, which had to classify the new `home/` dir). Shared cross-screen atoms go in `components/ui/` (shared).

### 4.1 Shared — `components/ui/` (presentational, props-in / callbacks-out, no store imports)

| Component | PR | Purpose | Consolidates (F5) |
|---|---|---|---|
| `SegmentedToggle` | f6c-board | one segmented view switch; introduces the net-new **Cards⇄Board** axis | `ui/GroupViewToggle` (grouping) + `ui/ViewModeToggle` (density) + `player/RosterViewToggle` (mobile density) — the raw-`<button>` pill pattern unified; also shared with **Loot** (F6d) |
| `PlayerIdentity` **`board-cell`** variant | f6c-board | build the **reserved** `board-cell` variant (compact role-colored job badge + name + `role · iLvl`) for `GearBoard` rows | extends the existing `ui/PlayerIdentity` (`inline` built in F6b; `board-cell` reserved) |

`SegmentedToggle` is genuinely shared (Roster + Loot per F5) → mandatory shared placement. Both are token-clean and presentational (shared-layer error-level DS rules).

### 4.2 Ring-0 — `components/roster/` (store-fed; composes the shared set + reuses ring0 `player/`)

| Component | PR | Purpose | Reads / reuses |
|---|---|---|---|
| `Roster` | f6c-cards | the assembly: page header + toolbar + Cards (f6c-cards) / Board (f6c-board) + legend | props + `tierStore`; composes below |
| `RosterToolbar` | f6c-cards | grouping pill ("Standard comp ▾") + "Show subs" chip + Reorder + Add player; **+ `SegmentedToggle`** (f6c-board) | reuses `groupView`/`subsView` state; `usePlayerActions` |
| `RosterCard` | f6c-cards | v2 player card shell: `CardShell` + `PlayerIdentity` + `ProgressBar` (BiS line) + compact pip row + footer/setup prompt + kebab | **reuses** `usePlayerActions`, permission fns, the context-menu items builder, `player/PlayerCardGear` pip logic, `ui/JobIcon`, `ui/GearStatusCircle` |
| `RosterCards` | f6c-cards | the party-grouped grid (G1/G2/Unassigned/Subs) + empty/invite card; reorder-mode host | reuses `groupPlayersByLightParty`, `useDragAndDrop` (gated by reorder mode), `EmptyStateInvite` |
| `GearBoard` | f6c-board | the gear matrix: party-divider rows × 11 slot cols + BiS summary col + "no BiS" spanning-row state | `tierStore` players' `gear`; reuses `utils/rosterReadiness` for BiS counts |
| `GearBoardCell` | f6c-board | per-slot board cell (have / need / aug; **need.up reserved**), derived from the gear atom | derives from `ui/GearStatusCircle` state machine |

**Boundary strategy (zero new suppressions):** every new component is `components/ui/` (shared) or `components/roster/` (ring0). Roster reads **stores** (allowed) and reuses **ring0** `player/` components — never a ring1 (`schedule`/`split-clear`) or ring3 (`mount-farms`) component. The "Split planner" button routes via `onNavigate`/an action callback (a value, not a component import), so no ring0→ring1 edge. Same discipline F6b used for `mountFarmStore`.

---

## 5. Component contracts

Concise per-component contracts (anatomy · props · variants/states · a11y). Final prop names may refine in the plan; shapes here are the contract. All examples token-only.

### 5.1 `SegmentedToggle` (shared, f6c-board)
- **Anatomy:** `surface-elevated` pill container + 2–N segment options (icon + label); active = `accent` fill + `accent-contrast` text; motion-token pill (v3.1 gap, flagged).
- **Props:** `{ options: Array<{ value: string; label: string; icon?: ReactNode }>; value: string; onChange: (value: string) => void; ariaLabel: string; size?: 'sm'|'md' }`. Generic over the value type (Cards⇄Board here; Priority⇄History for Loot F6d).
- **a11y:** `role="tablist"` semantics or a radio-group; each option keyboard-focusable, `aria-pressed`/`aria-selected`; label text carries meaning (not icon-only).
- **Notes:** replaces the three raw-`<button>` toggle forks; the **density** and **grouping** axes those forks carried are *not* reproduced here (density dropped; grouping → the "Standard comp ▾" pill).

### 5.2 `PlayerIdentity` `board-cell` variant (shared, f6c-board)
- **Anatomy:** compact horizontal cell — role-colored left edge (on the `<td>`) + small `JobIcon` badge + name (display font) + `role · iLvl` subtitle. Denser than `inline`; no avatar image.
- **Props:** existing `PlayerIdentityProps` with `variant: 'board-cell'`; remove the `null`-with-DEV-warn guard for `board-cell`. Role drives the badge/edge color; the subtitle text carries role (not color-only) for a11y.

### 5.3 `GearBoardCell` (ring0, f6c-board)
- **Anatomy:** a 30px rounded cell — source-colored fill + one-letter code (R/T/A/base/craft) for *have*, dashed border + `·` for *need*, **reserved** `need.up` (role-ranged ring + `●`) for next-upgrade-priority.
- **Props:** `{ slot: GearSlotStatus; onCycle?: (slot: GearSlot) => void; disabled?: boolean; priority?: boolean /* reserved, default false → renders plain need */ }`.
- **State machine:** **derive from `GearStatusCircle`** (raid/base_tome/crafted = 2-state missing↔have; tome+requiresAug = 3-state missing→have→augmented). `onCycle` reuses the same `getNextState` transition. Copy `GearStatusCircle`'s `onClick` `stopPropagation` (avoid row-hover/selection conflicts).
- **a11y:** `role="checkbox"`/`aria-checked` like the atom; source conveyed by the letter code + tooltip, not color alone.

### 5.4 `GearBoard` (ring0, f6c-board)
- **Anatomy:** `CardShell`-wrapped `<table>`; sticky `<thead>` (Player | 11 slot cols | BiS); party-divider `<tr>` (Light Party 1 / 2 / Substitutes, `colspan`); player rows (`PlayerIdentity board-cell` + 11 `GearBoardCell` + status-colored `X/11` summary); the **"No BiS imported"** row state (a `colspan` warning spanning the gear cells + "Import BiS" action, per mockup).
- **Data:** `tierStore` players (party-grouped via `groupPlayersByLightParty`); per-player BiS count + the page-head "K / M BiS slots" via **`utils/rosterReadiness`** (reuse — no new aggregation). Density (compact) is DS §7 gap 8, flagged.
- **Notes:** cells reflect `SnapshotPlayer.gear[slot]`; clicking a cell cycles obtained state via `usePlayerActions` (the Board is the gear-editing surface, §2.2). "Split planner"/"Export" are toolbar buttons, not part of the table.

### 5.5 `RosterCard` (ring0, f6c-cards)
- **Anatomy:** `CardShell` (role-colored 3px `accent-edge`) → header (`JobIcon` badge + `PlayerIdentity`-style name + position tag + `Job · Server` subtitle + iLvl + kebab) → BiS line (`ProgressBar` + `X/11 BiS`, `warning` fill when low / "no BiS") → compact 11-slot pip row (reuse `PlayerCardGear` logic / `GearStatusCircle` compact) → footer (link/sync dot + status, or a warning + inline CTA "Import"/"Assign").
- **Props:** `{ player: SnapshotPlayer; canManage: boolean; reorderMode: boolean; onNavigate; …actions }` — but **behavior is reused**: `usePlayerActions`, `canEditPlayer`/`canManageRoster`/`canResetGear`/`canClaimPlayer`, the context-menu items builder, `useDoubleClickConfirm`.
- **Parity:** full kebab menu (BiS & Gear · Loot Priority · Clipboard · Player Management · Danger Zone) + inline job/position/tank-role/name edits + claim/assign/import — all by reuse. **Reorder** only when `reorderMode` (the card wraps in a draggable via `useDragAndDrop`); otherwise static.
- **a11y:** kebab is an `IconButton`; the card is not a button; CTAs are real `Button`s (no trailing-arrow glyph per §4.1 — the mockup's "Import →"/"Assign →" arrows are dropped).

### 5.6 `RosterCards` (ring0, f6c-cards)
- **Anatomy:** party-head rows (G1/G2 badge + name + aggregate BiS `ProgressBar` · Subs head with no bar) + `pcards` grids of `RosterCard`; the empty/setup card = `EmptyStateInvite` ("Open seat · Role" + Add player / Recruit).
- **Data/behavior:** reuse `groupPlayersByLightParty` (grouping via the "Standard comp ▾" pill state) + `subsView`/`subsHidden` (the "Show subs" chip). Reorder mode hosts `useDragAndDrop` (sensors disabled when a modal is open, per existing pattern); cross-group swap preserved.

### 5.7 `RosterToolbar` (ring0)
- **Anatomy (f6c-cards):** "Standard comp ▾" grouping filter pill + "Show subs" chip + spacer + "Reorder" (ghost sm, toggles reorder mode) + "Add player" (primary sm). **+ (f6c-board):** the `SegmentedToggle` (Cards⇄Board) as the leading control; Board mode swaps the trailing actions for "Split planner" + "Export".
- **Responsive:** owns its own mobile treatment (the legacy mobile FAB/controls-sheet are gated off in v2).

### 5.8 `Roster` (ring0, f6c-cards; Board wired in f6c-board)
- **Anatomy:** `PageHeader` ("Roster" + dynamic subtitle: raider count · party grouping · avg iLvl [Cards] / "K / M BiS slots obtained" [Board]) + `RosterToolbar` + the active view (`RosterCards` | `GearBoard`) + gear-source `ProgressBarLegend`.
- **Props:** `{ group, tier, canManage, onNavigate, onOpenRequests }`. Reads `tierStore` (players); owns the `roster-view` state (`cards`|`board`, `useUrlTabState`, f6c-board).
- **Permissions:** `canManage` gates roster-management affordances (Add/Reorder/assign, Board cell editing); non-managers get a read-only Cards/Board.

---

## 6. Data flow, derivations & the re-home ledger

**Reused derivations (no new aggregation):** `groupPlayersByLightParty` (grouping), `utils/rosterReadiness` (per-player BiS count, avg iLvl, "K / M BiS slots" — promoted in F6b), `calculatePlayerNeeds` (footer "needs N"), the context-menu items builder, `usePlayerActions`, `useDragAndDrop`.

**New (small, testable):** `findPlayerByUserId(players, userId): SnapshotPlayer | undefined` (util; also usable as a `usePlayerByUserId` tierStore selector) — powers role-colored identity and, later, the F6e RSVP enrichment.

**Carry fix:** `canManageRoster(userRole)` → `canManageRoster(userRole).allowed` at `GroupViewContent.tsx:1315` (the *only* bare-truthy site; all others already use `.allowed`). It sits in the `gear` pageMode block, so it slightly **tightens a legacy permission gate** (non-managers currently wrongly see the gear-log "Reset Data" controls); backend already validates, so this is a UI-only correctness fix — **documented in the PR body** as a roadmap-sanctioned, intentional deviation from strict byte-for-byte. Add a permissions test.

**Re-home ledger (what the legacy roster surfaces become):**

| Legacy roster surface | F6c disposition |
|---|---|
| `Members` sub-tab (`rosterDndArea` / `PlayerGrid` / `PlayerCard`) | → **Cards** view (v2 `RosterCards` + `RosterCard`) |
| Compact⇄Expanded density (`ViewModeToggle` / per-card `GearTable`) | **dropped**; Cards⇄Board replaces it; gear editing → **Board cells** + kebab |
| `Characters` sub-tab (`RosterCharacterPanel` + `staticCharacterStore`) | per-static character **link** → stacked onto `RosterCard` (link/change-character + sync); **registry/CRUD** → temporary **bridge** flagged for **Player Hub** (Person layer) |
| `Split Planner` sub-tab (`SplitClearPlanner`, ring1) | → "Split planner" **button** routing to the existing surface (no ring0 rebuild) |
| Sticky-toolbar controls (`GroupViewToggle`/`ViewModeToggle`/DnD-lock/Show Subs/Separate Subs) | → `RosterToolbar` (grouping pill + subs chip + Reorder mode + `SegmentedToggle`) |
| Board precursors (`TeamSummaryEnhanced` books/mats, `GearSyncDashboard` health) | **not** re-absorbed — those numbers live on F6b Home (readiness) / belong to Loot |
| Legacy Gear surface / gear matrix | → **`GearBoard`** (the Board view) |

No capability is lost in v2: Characters management stays reachable via the bridge; Split via the button; gear editing via Board cells + kebab.

---

## 7. Tokens

Expectation: **no new tokens.** Roster reuses existing semantics — `surface-card`/`border-*` (CardShell), `role-*` (identity edges, party accents), `gear-raid`/`gear-tome`/`gear-base-tome`/`gear-augmented`/`gear-crafted` (pips + board cells), `status-success`/`status-warning` (BiS bar / summary), `membership-linked` (SUB tag, link dot), `accent`. The mockups' party-header `bg-blue-500/20` (G1) / `bg-red-500/20` (G2) map to existing role/party semantics — **no raw palette**. The plan's first step confirms via `pnpm tokens:check`; any genuinely new component-tier token (unlikely) is added data-driven per the F1 pipeline, never as raw color. The `SegmentedToggle` pill + `GearBoardCell` may want `motion.*` tokens (v3.1 gap) — flagged, not blocking.

---

## 8. Testing & conformance

- **Per-component Vitest** for every new component: `SegmentedToggle` (render + option switch + a11y + `onChange`); `PlayerIdentity board-cell` (render + role color + a11y label); `GearBoardCell` (state machine per source type, `onCycle`, reserved `need.up` renders plain need, `stopPropagation`); `GearBoard` (matrix from mocked players, party dividers, BiS summary, no-BiS row); `RosterCard` (render + BiS bar + pip row + kebab items gated by permission + reorder-mode wrap); `RosterCards` (grouping, subs, empty invite); `RosterToolbar`; `Roster` assembly (Cards/Board switch, subtitle).
- **Reuse-parity tests:** the kebab menu items + permission gating match the legacy set (assert the reused builder output); reorder mode enables DnD and preserves cross-group swap.
- **Carry tests:** `findPlayerByUserId` (hit/miss); `canManageRoster` gate at the fixed site (non-manager → hidden).
- **Slot/legacy guard:** with `slots={{ roster: <Roster/> }}` the roster region renders `<Roster/>` and the legacy toolbar/FAB/controls-sheet are **absent**; **without** slots (legacy path) the roster region is **byte-for-byte** (toolbar + sub-tabs + bodies) — a regression lock on the `!slots?.roster` guard.
- **Gate (CI-equivalent, all green on land, per PR):** `pnpm build` (`tsc -b && vite build`) → `pnpm lint` (0 error) → `pnpm check:design-system:strict` → `pnpm test` → `pnpm tokens:check`; `git diff --check`. **`eslint-suppressions.json` shrinks** (f6c-board prunes Roster-domain entries via `--prune-suppressions`); the **contrast harness** is **re-enabled** on the roster screen (remove the `test.skip` in `frontend/e2e/contrast.spec.ts`) in f6c-board; the `goToTestStatic` e2e selector is fixed (disambiguate the `/Roster/i` match). Dev-server check: legacy `/group/DEVTST` roster identical; `/group/DEVTST?shell=v2&tab=roster` renders the v2 Roster.
- **Reviewer:** `subagent_type: redesign-reviewer` (effort:xhigh) **per task** and the **final whole-branch review** per PR. Implementers on sonnet; **opus** for the riskiest tasks (the enabling refactor + legacy byte-for-byte guard, `GearBoard` assembly, the `RosterCard` parity reuse).

---

## 9. Risks & spec-time confirmations

- **The enabling refactor is the highest-risk change** (it touches shared `GroupViewContent` on the legacy path). Mitigation: the `!slots?.roster` guard is a no-op when `slots` is undefined; a byte-for-byte legacy-render regression test locks it; opus implementer + whole-branch review; PR body flags it as behavior-neutral on legacy. **Confirm at plan time:** the exact line ranges of all roster-only chrome blocks (sticky toolbar, mobile FAB, controls sheet) and that the body block already consults `slots?.roster ??` (add it if F6a wired only `overview`).
- **`RosterCard` parity by reuse** hinges on the context-menu items builder + `usePlayerActions` being cleanly importable without dragging in legacy `PlayerCard` internals. **Confirm at plan time** whether the menu-items builder is already extracted or lives inline in `PlayerCard.tsx` (if inline, extract it as a pure `player/`-owned builder — an F6a-style promote-and-repoint, test-locked — so both legacy and v2 share one copy; do **not** rewrite legacy behavior).
- **Split-clear ring boundary:** the "Split planner" button must route via a callback/`onNavigate` (a value), never import `components/split-clear/*` (ring1). If routing needs split-clear state, read `splitClearStore` (a store, allowed), never the component.
- **`canManageRoster` fix changes legacy gear-tab behavior** (a permission tightening) — intentional, roadmap-sanctioned, backend-validated; documented in the PR body so review bots don't read it as an unwanted legacy change.
- **Manual per-slot source override** is traded away with the expanded `GearTable` (decision §2.2). If it turns out load-bearing during build, the fallback is a small `GearBoardCell` long-press/secondary affordance — **do not** re-introduce the per-card table.
- **Shared-component API churn:** `SegmentedToggle` and `PlayerIdentity board-cell` are consumed by **Loot (F6d)** too — design the `SegmentedToggle` value-generic and the `board-cell` variant to the F5 contract now so F6d drops them in without breaking changes.
- **Reorder-mode UX:** confirm at plan time whether "Reorder" is a persistent toggle (like the legacy DnD-lock) or a transient mode; lean transient (enter → drag → exit) to keep default cards static.

---

## 10. Self-review

- **Placeholders:** none — every component has a contract; the Board/Cards data are grounded in real store shapes (`SnapshotPlayer.gear`, `tierStore`, `utils/rosterReadiness`); no "TBD".
- **Internal consistency:** placement (§4) ↔ boundary strategy (§4.2) ↔ contracts (§5) ↔ re-home ledger (§6) agree; the two-PR split (§1/§2.5/§3.3) is consistent across sections (SegmentedToggle in f6c-board everywhere); the density-drop and Characters decisions appear identically in §2/§6.
- **Scope:** one screen, two PRs, each F6b-sized; every deferral (filters, cross-tier, priority-highlight, Export, Split-as-mode, Characters registry, books/mats/health) has an explicit home.
- **Ambiguity:** the density axis is unambiguously dropped (Board is the editor); Characters is unambiguously not a peer view (link on card + bridge); the "Split planner" button routes (no ring0 rebuild); the priority-highlight is API-reserved but renders plain need. Open items are confined to plan-time confirmations (§9: exact line ranges, menu-builder extraction, reorder-mode persistence) — none reshape the design.
