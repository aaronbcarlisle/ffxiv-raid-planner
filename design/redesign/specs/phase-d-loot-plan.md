# Phase D — Loot Rework: Execution Plan

**Status: DRAFT — awaiting user approval of the slice plan.** The *what* is already ruled and is
**not re-litigated here**. Inputs: [`phase-d-loot-design.md`](./phase-d-loot-design.md) (R-1…R-48,
the binding co-design record), `v1-v2-parity-matrix.md` (D-05, D-22…D-44, D-54, D-55, D-72),
`systems-flow-map.md` (F-04, F-06, F-07, F-08), `ROLLOUT_ROADMAP.md` §7-D, and
[`phase-c-closeout.md`](./phase-c-closeout.md) (which hands this phase D-18 and `roster-hide-subs`).

**One sentence:** build the Loot triad — rebuild Priority around the Matrix, **create the Log tab
that v2 has never had**, and rebuild History as a flat searchable table — in 14 reviewable slices,
without editing a line the legacy shell renders except one approved delta.

**Why a slice plan and not a step-by-step plan:** Phase D spans four independent surfaces plus a
shared-leaf foundation. Each slice below is its own subsystem, produces working software on its own,
and gets its **own detailed implementation plan written at build time in a fresh session** — the
Phase-C cadence (`phase-c-roster-plan.md` §3), which held for eight slices.

---

## 1. Scope (ruled — not revisited here)

| Ruling | What gets built | Slice |
|---|---|---|
| R-45 | `--color-floor-1…4` semantic tokens; `FLOOR_COLORS[n].hex` never used in v2 | **D0** |
| R-46 | `ui/SortableHeader` — keyboard-first; `admin/SortableHeader` untouched | **D0** |
| R-44 | `getResetDescription`'s "Week undefined" + wrong blast-radius strings — **approved V1-visible delta** | **D0** |
| R-8 (icon half), R-39 | `ui/GearSlotIcon` — monochrome generic slot glyph, shared by Matrix · Log · History | **D0** |
| R-1, R-2, R-3, R-5, R-7, R-10 | Queues ⇄ Matrix ⇄ Weapons switcher · `All + F1–F4` pill row · scope model · "Log floor" | **D1** |
| R-12, R-24, R-4 (prefill), R-6, D-36 | Picker: live "This will:", promoted acquired checkbox, `Details`→`Options`, method + notes in assign, recipient prefill, the shared ranking explanation, "no one needs this" hint | **D2** |
| R-48, R-8, R-9, R-11, R-4 (wiring) | **v2's own** Need matrix — floor-coloured names, neutral icons, roster denominator, cell → picker | **D3** |
| R-13, R-15, R-20, R-22 | The Log tab: `lview=log`, Log owns the week, `scopedWeekOverride` deleted, chevrons + go-to-current, revert data-summary, toolbar actions | **D4** |
| R-17, R-19 | The weekly grid chassis: four floor sections, cells → picker / material modal, floor accent + `Floor N · Book {I–IV}` | **D5** |
| R-18, R-23, R-25, R-27 | Grid affordances: click/Shift/Alt/kebab, `useAltHeld` cursor, `×N` popover, count bar **+ legend**, "Log floor" on the floor kebab, teaching tooltip, badge hover-`×` | **D6** |
| R-14, R-16 | Books card re-homes to Log (displayed week, row + column kebabs, `JobIcon`); **all four** bulk-reset entry points with real floor/player scoping | **D7** |
| R-21, R-26 | `QuickLogMaterialModal` grows floor + material selectors, notes, edit mode | **D8** |
| R-29, R-33, R-34, R-38, R-39 | History as a flat sortable table: week separators under week sort, floor chip, weapon's job icon, slot icon, stats count, filtered-vs-empty | **D9** |
| R-30, R-36, R-37, R-47 | v2's **own** query parser: aliases, comma alternation, `source:`, quoting, neutral trailing colon, surfaced unknown key; pills write tokens; session-local | **D10** |
| R-31, R-32, R-35 | Row click edits · Shift copies · Alt jumps · kebab (incl. "View week N in Log") · material Edit · `Ctrl+Shift+F` with a guard | **D11** |
| R-18 (destination), R-28 | `RosterGearTable` slot anchors + pulse; the gear-slot jump splits Log / History / Books | **D12** |
| R-40, R-42, §9 | `FairnessSummary` → static Home · the D-54 shortcut set · `v2-roster-hide-subs` · matrix write-backs | **D13** |

### Explicitly OUT of Phase D

| Item | Why out | Where it goes |
|---|---|---|
| **R-41 / D-18 Split Planner entry** | **BLOCKED — its home does not exist.** R-41 puts it on the Progress tab; F-03's Progress tab is unbuilt (v2's spine is Home/Roster/Loot/Schedule, `NewShell.tsx:38,72,88,106`). Causes no regression: Split Clears is already unreachable in v2 (`MorePage.tsx:172-186` is legacy-only) | Ships with the Progress tab. Recorded in `ROLLOUT_ROADMAP.md` §7 and re-asserted in D13's write-backs so the parity ledger cannot mark D-18 done |
| **D-44 mobile** | Standing ruling — one consolidated pass, not per-slice affordances | Phase P |
| `Alt+1/2/3`, `v`, `g` | Ruled **dropped** (R-35, R-42) — surface death, not deferral | — |
| Legacy `AddLootEntryModal` / `LogMaterialModal` | Ruled not restored (R-17, R-26) | — |

---

## 2. Architecture decisions

### 2.1 Shared-layer reach — three corrections to R-43's table

R-43 enumerated which rulings reach V1. Building the plan against the real import graph found
**three reach paths it does not list.** All three run through the `loot/` barrel, which is the
single V1 entry point into this tree: `GroupViewContent.tsx:38` →
`import { LootPriorityPanel, LogWeekWizard } from '../components/loot'`.

| Ruling | Component | Reach | Requirement |
|---|---|---|---|
| **R-3** | `loot/WeaponPriorityList.tsx` (1,170 lines) | **YES** — `LootPriorityPanel.tsx` (V1, via the barrel) **and** `WeaponPriorityBridge.tsx:9` ← `Loot.tsx:63` (v2) | R-3 re-homes the **bridge**, not the list. `WeaponPriorityList` is **not edited**: the Weapons segment mounts it exactly as `WeaponPriorityBridge` does today. If the segment needs a different shape, v2 forks — it does not restyle in place |
| **R-48** | `loot/FilterBar.tsx` | **YES** — `LootPriorityPanel.tsx` (V1) + `WhoNeedsItMatrix.tsx` + `WeaponPriorityList.tsx` | v2's new matrix (D3) does **not** import `FilterBar`; the D1 pill row is its scope control |
| **R-1/R-2** | `loot/index.ts` (the barrel) | **YES** — it is V1's only door into `loot/` | Adding exports is safe; **removing or renaming an exported name is a V1 edit.** D1 deletes `FloorSelector` (orphan, R-2's note) and D0 deletes `SummaryPanel` — both are dead, verified below, and both require the barrel line to go with them |

**Dead-code evidence (verified 2026-07-30 on `main` at `3922f1af`):** `loot/FloorSelector.tsx` has
zero importers. `loot/SummaryPanel.tsx` has exactly one reference in the tree — its own barrel
export at `loot/index.ts:8` — and it imports `LootPriorityPanel`, so removing it also drops a
phantom V1-facing edge. Confirm with `pnpm knip` in-slice before deleting either.

### 2.2 v2 owns its Log; `history/` is read-only reference

Per R-48's ownership paragraph: `history/WeeklyLootGrid.tsx`, `history/LootCountBar.tsx`,
`history/RevertWeekConfirmModal.tsx` and `history/AllWeeksView.tsx`'s parser are **reference, not
dependencies**. The invariant is *don't edit* `history/`, not *don't import* it — `BookLedgerCard.tsx:21-23`
already imports three legacy modals unmodified, which is fine and stays fine.

### 2.3 Storage keys — v2-namespaced, legacy-readable

Two keys, both the C6 `useRosterSortPreset` shape (**read legacy's as a fallback, write v2-only**):
`v2-history-week-{groupId}-{tierId}` (R-15) and `v2-roster-hide-subs` (§9). The Priority
sub-view (Queues/Matrix/Weapons) and the R-10 scope are new state with no legacy counterpart, so
they take fresh v2 keys with no fallback read.

### 2.4 `lview` gains a third value — v2-local, verified

`lview` is declared `['priority','history']` at `Loot.tsx:174`. Adding `'log'` is **v2-local**: the
only readers are `Loot.tsx` itself and `RosterCard.tsx:286,304` (both v2); the shared
`useUrlTabState.ts:38` param whitelist already contains `lview`, so no shared file changes. No
legacy component reads it.

### 2.5 Release notes — D0 is the exception

Every slice is `internal: true` with `CURRENT_VERSION` untouched (v2 is admin-gated dark) —
**except D0**, whose R-44 fix changes copy a V1 user reads today. That slice takes a **public**
entry and bumps `CURRENT_VERSION` (currently `2.1.1`), per the pr-checklist rule.

---

## 3. The slices (14 PRs)

**Dependency graph:**
```
D0 ──┬─→ D1 ─→ D3            (D3 also needs D2's picker prefill)
     ├─→ D2 ─→ D3
     ├─→ D4 ─→ D5 ─→ D6 ─→ D12
     │         └─→ D7
     ├─→ D8   (independent; D5/D7 consume it)
     └─→ D9 ─→ D10 ─→ D11
D13 last (D12 must land first — R-42 rebinds to surfaces D4/D7 create)
```

Each slice: fresh implementation session · `xivrp-director` change-review before the PR (including
the shared-file hunk enumeration and the `text-[` / hardcoded-colour assert) · full local gate
(`pnpm build` — **`tsc -b`, not `--noEmit`** — plus lint, `check:design-system:strict`, `pnpm dupes`,
`pnpm tokens:check`, tests) · live browser validation (`?shell=v2`, desktop; mobile → Phase P) ·
static-not-"group" vocabulary check on all new copy · screenshots embedded in the PR.

| # | Slice | Contents | Notes |
|---|---|---|---|
| **D0** | Foundations + the V1 delta | R-45 floor tokens (light + dark, contrast measured once); `ui/SortableHeader` (real `<button>` in the `<th>`, `aria-sort`, key handling); `ui/GearSlotIcon`; R-44's reset-copy fix; delete dead `loot/SummaryPanel.tsx` | **Only slice with a public release note** (§2.5). R-44 changes V1 copy — enumerate it in the PR body as the approved delta, per R-43/F-12 precedent |
| **D1** | Priority chrome | Queues ⇄ Matrix ⇄ Weapons switcher (lands on Matrix, persisted); `All + F1–F4` pill row on R-45 tokens; R-10's per-view default → global-on-first-click; R-7's "Log floor" following the pill, standing aside for the wizard on `All`; R-5's label swap in Weapons; delete orphan `FloorSelector` | Weapons segment **mounts** `WeaponPriorityList` via the existing bridge — no edit (§2.1). Queues (`FloorCard`) answers to the pill scope |
| **D2** | The picker | R-12 (live "This will:", acquired checkbox out of the disclosure, `Details`→`Options`), R-24 (method + notes in assign mode), R-4's recipient prefill (list stays rendered and switchable), R-6's shared ranking derivation + presentation leaf, D-36's "no one needs this" hint | `RecipientPicker` is v2-only (`Loot.tsx:64` sole importer) — no V1 reach. R-6's leaf is exported for D3 and the Queues rows |
| **D3** | v2's Need matrix | Net-new component per R-48; R-8 visual language (neutral slot icon + floor-coloured gear name); R-9 (colours kept); R-11 (`sortedPlayers.length`, not a literal 8); R-4 cell → D2's prefilled picker | `WhoNeedsItMatrix` and `FilterBar` stay **frozen** (§2.1). Two-part assert: v2 renders the new matrix, V1's `LootPriorityPanel` render is unchanged |
| **D4** | The Log tab | `lview` gains `'log'` (§2.4) + the F-06 triad switcher; R-15 (Log owns the week, `scopedWeekOverride` deleted at `Loot.tsx:170-171,326,377,441,505`, new storage key); R-22 (chevrons, go-to-current, revert/start-next-week stay **clock**-bound and name the week they act on, v2-owned data-summary modal); R-20 (`Alt+L`, `Alt+U`); R-13 (no pill row) | The slice that makes the tab exist. Ships with an empty-ish body; D5 fills it |
| **D5** | Grid chassis | v2-owned weekly grid: four floor sections, loot cells → picker (assign/edit), material cells → D8's modal; R-19's floor accent + `Floor N · Book {I–IV}` line | `history/WeeklyLootGrid.tsx` = reference only (§2.2) |
| **D6** | Grid affordances | R-18 (click never navigates · `Shift` copies · `Alt` jumps · kebab/right-click), `useAltHeld` cursor swap (C4 reference), `×N` → `EntryPopover`; R-23 count bar **+ `LootFairnessLegend`**; R-25 "Log floor" on the floor kebab; R-27 teaching tooltip + badge hover-`×` | The Alt-jump *destination* is D12; D6 wires the source. Deep link = `lview=log&week=N&entry=<id>&entryType=loot\|material` |
| **D7** | Books + every bulk reset | R-14 (card re-homes History → Log, takes the **displayed** week, row + column kebabs, `JobIcon` returns); R-16's four entry points with **real** floor/player scoping — today `Loot.tsx:279` destructures only `{scope,target,week}` and `:290-292` filters week-or-all, so a floor-scoped config would delete everything; `LootResetMenu` follows the displayed week, not `clock.currentWeek` (`Loot.tsx:384`); retarget the `?book=` jump to `lview=log`; History loses its books card | Reference implementation: `SectionedLogView.tsx:450-538`, incl. `clearFloorPageLedger` / `clearAllFloorPageLedger` / `clearPlayerWeekPageLedger` / `deletePlayerLedger` (`:491-511`). Consumes D0's R-44 fix |
| **D8** | Material modal | R-26 (floor + material selectors, notes) + R-21 (edit mode with old-vs-new augmentation reconciliation) | **Highest shared-layer risk in the phase.** R-43: every new input **optional and off by default** so V1's fixed-`floor`/`material` call site (`LootPriorityPanel.tsx:764-767`) renders byte-identically. Two-part assert mandatory |
| **D9** | History table | R-29 (flat + sortable on D0's header; week separators only under week sort, carrying the current-week marker and its measured `text-accent-hover` token; `createdAt` desc tiebreak — **not** v1's comparator, which would regress what ships); R-33 floor chip **on tokens**; R-38 `weaponJob`; R-39 slot icon; R-34 (stats count, filtered-vs-empty, `slotAugmented` in the Type column, eighth kebab column) | v1's `AllWeeksView.tsx` = reference. Sort/filter state session-local |
| **D10** | History search | v2's **own** parser (R-43 — editing v1's would silently change legacy search): R-47 `type:` aliases, R-36 comma alternation + `source:`, `player:"Tank One"` quoting, trailing colon neutral, unknown key surfaced; pills write tokens and light **only on exact equality**; R-37 session-local + `copyLink` strips it | `HistoryFilters` / `DEFAULT_HISTORY_FILTERS` dissolve into the query string. Protects the `Loot.tsx:39-43` deep-link invariant |
| **D11** | History row affordances | R-31 (click edits; cursor **only** when `canEdit`; text stays selectable; `Alt+Enter`/`Shift+Enter`; the `tabIndex` `<tr>` gets a `role`); R-32 (kebab: Edit · Copy link · Jump to {player} · **View week N in Log** · Delete; material Edit → D8's modal; `jumpMenuAnchor` from `rosterLedgerJumps.ts:75-83`, not raw `clientX/clientY`); R-35 `Ctrl+Shift+F` with a focus/modal guard **and** a `ui/keyboardShortcutGroups.ts` entry | Without the registry entry the shortcut never appears in `Shift+?` |
| **D12** | The jumps | R-18's destination: `RosterGearTable` gains `gear-row-{playerId}-{slot}` anchors + `highlightedSlot` pulse (net-new — legacy's live only in frozen `GearTable.tsx:324,659`); R-28's split (displayed week → Log cell · older → History row · books → Books row); retarget `RosterCard.tsx:281-297`'s hard-coded `lview=history` | A material jump whose `slotAugmented` is null (universal tomestone) lands on the card, not a row |
| **D13** | Elsewhere, shortcuts, write-backs | R-40 `FairnessSummary` → static Home (drop the `Loot.tsx:397` mount); R-42's shortcut set (`Alt+←/→` + `Alt+B` rebound to Log; `Alt+1/2/3` dropped); §9 `v2-roster-hide-subs`; **matrix write-backs**: D-23, D-27, D-38, D-39, D-40, D-43, D-54, D-72, D-37 — and D-18 explicitly **left open** with R-41's blocker restated | Closes the Phase-C closeout's last DoD item |

---

## 4. Definition of done (phase level)

1. Every §1 ruling demonstrably built **in the running app** — director change-review per slice,
   plus a final Phase-D sweep over D-05, D-22…D-44, D-54, D-55, D-72 in the browser.
2. **One logging model, five entry points** — a test asserts loot routes only through
   `RecipientPicker` and materials only through `QuickLogMaterialModal`; no second write path exists.
3. **V1 safety, two-part assert across D0…D13 as a set** (the Phase-C definition): (a) `git diff --stat`
   over legacy-only paths is empty per slice, **and** (b) every hunk in a *shared* file is enumerated
   in the PR body with the exact V1 render path it reaches, carrying director SHARED-DRIFT sign-off.
   **R-44 is the one approved exception** and must be named as such in D0's body.
4. `pnpm knip` shows no new dead exports, and the two deletions (§2.1) are gone from the barrel.
5. No `FLOOR_COLORS[n].hex` in any v2 file (`check:design-system:strict` + an explicit grep assert).
6. Release notes: `internal: true` per slice; `CURRENT_VERSION` bumped **only** by D0 (§2.5).
7. Mobile deferred to Phase P by standing ruling — recorded, not silently skipped.

---

## 5. Open items carried INTO slices (decided during, not before)

| Item | Where decided | Default if the user is silent |
|---|---|---|
| Do the R-45 floor tokens re-use the existing green/blue/purple/amber hues, or get re-picked for contrast on body text (R-8 puts them on gear **names**)? | D0 PR screenshots | Keep the hues; adjust lightness only where AA fails |
| Does the Weapons segment keep `WeaponPriorityList` verbatim, or does v2 fork it? | D1 PR screenshots | Keep verbatim (§2.1) — a fork is a second 1,170-line file |
| R-6's confidence thresholds (high/medium/low) — restore v1's cutoffs or re-derive? | D2 | Restore v1's |
| `LootFairnessLegend` — v2-owned copy or import the legacy leaf? | D6 | Import (§2.2 permits it; it is presentational and stable) |
| Priority sub-view persistence: per-user (R-1 says "persists per user") — localStorage or the backend user setting? | D1 | localStorage, v2-namespaced |
| Whether D5/D6 stay two slices or merge | D5 review | Two — the grid is the largest net-new surface in the phase |

---

## 6. Risks

- **D8 is the freeze risk.** `QuickLogMaterialModal` is the one component this phase grows that V1
  renders on its main Loot tab. If the optional-props discipline slips, every V1 user sees it.
- **D4 deletes `scopedWeekOverride`**, which five call sites read. It exists as a *workaround* for the
  bug R-15 removes structurally, so deleting it is correct — but it is the phase's one deletion of
  live v2 behaviour, and the `Loot.tsx:20-53` comment block must be rewritten with it, not left
  describing a model that no longer exists.
- **D3 + D9 are net-new rebuilds of 687- and 655-line components.** Both are the slices most likely to
  breach the ~1,500-line budget; if either does, it splits at the review checkpoint rather than shipping
  oversized (the mega-PR history in CLAUDE.md is the reason).
