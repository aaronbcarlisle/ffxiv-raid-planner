# Phase D — Loot Rework: Execution Plan

**Status: REVISED after director plan-vet — ready to build.** The *what* is already ruled and is
**not re-litigated here**. Inputs: [`phase-d-loot-design.md`](./phase-d-loot-design.md) (R-1…R-48,
the binding co-design record), `v1-v2-parity-matrix.md` (D-05, D-22…D-44, D-54, D-55, D-72),
`systems-flow-map.md` (F-03, F-04, F-06, F-07, F-08), `ROLLOUT_ROADMAP.md` §7-D, and
[`phase-c-closeout.md`](./phase-c-closeout.md) (which hands this phase D-18 and `roster-hide-subs`).

**Vet record:** `xivrp-director` plan-vet 2026-07-30 → **SHARED-DRIFT** (4 blockers · 7 major ·
8 minor). All folded into this revision; every code claim below re-verified independently against
`main` at `3922f1af`. Three findings correct the **design record itself** and are marked ⚠ — they
are factual corrections to a mechanism or a false premise, never to a ruling's substance.

**One sentence:** build the Loot triad — rebuild Priority around the Matrix, **create the Log tab
that v2 has never had**, and rebuild History as a flat searchable table — in 16 reviewable slices,
without editing a line the legacy shell renders except where explicitly approved.

**Why a slice plan and not a step-by-step plan:** Phase D spans four independent surfaces plus a
shared-leaf foundation. Each slice below is its own subsystem, produces working software on its own,
and gets its **own detailed implementation plan written at build time in a fresh session** — the
Phase-C cadence (`phase-c-roster-plan.md` §3), which held for eight slices.

---

## 1. Scope (ruled — not revisited here)

| Ruling | What gets built | Slice |
|---|---|---|
| R-45 | `--color-floor-1…4` semantic tokens **through the token pipeline** (§2.6) | **D0** |
| R-46 | `ui/SortableHeader` — keyboard-first; `admin/SortableHeader` untouched | **D0** |
| R-44 | `getResetDescription`'s "Week undefined" + wrong blast-radius strings — **approved V1-visible delta** | **D0** |
| R-8 (icon), R-39 | `ui/GearSlotIcon` — monochrome generic slot glyph, shared by Matrix · Log · History | **D0** |
| R-1, R-2, R-3, R-5, R-7, R-10 | Queues ⇄ Matrix ⇄ Weapons switcher · `All + F1–F4` pill row · scope model · "Log floor" | **D1** |
| R-8 (Queues half) | `FloorDropRow`'s coloured letter squares → neutral icon + floor-coloured name; `FloorCard`'s header accent | **D1** |
| R-12, R-24, R-4 (prefill), R-6, D-36 | Picker: live "This will:", promoted acquired checkbox, `Details`→`Options`, method + notes in assign, recipient prefill, the **v2-owned** ranking-explanation leaf, "no one needs this" hint | **D2** |
| R-48, R-8, R-9, R-11, R-4 (wiring), R-6 (Queues consumption) | **v2's own** Need matrix; queue rows consume D2's leaf | **D3** |
| R-13, R-15, R-20, R-22 | The Log tab: `lview=log`, Log owns the week, `scopedWeekOverride` deleted, chevrons + go-to-current, revert data-summary, toolbar actions, **wizard week-target split** | **D4** |
| R-17, R-19 | Grid chassis: four floor sections, cells → picker / material modal, floor accent + `Floor N · Book {I–IV}` | **D5** |
| R-18, R-23, R-25, R-27 | Grid affordances: click/Shift/Alt/kebab, `useAltHeld`, `×N` popover, count bar **+ legend**, "Log floor" on the floor kebab, teaching tooltip, badge hover-`×` | **D6** |
| R-14, R-16 | Books card re-homes to Log; **all four** bulk-reset entry points with real floor/player scoping | **D7** |
| R-21, R-26 | `QuickLogMaterialModal` grows floor + material selectors, notes, edit mode | **D8** |
| R-29 (table), R-33, R-38, R-39 | History as a flat sortable table on `ui/SortableHeader`; floor chip on tokens; weapon's job icon; slot icon | **D9a** |
| R-29 (separators), R-34 | Week separators under week sort; stats count; filtered-vs-empty; `slotAugmented` in Type; **the `?entry=` highlight preserved** | **D9b** |
| R-30, R-36, R-37, R-47 | v2's **own** query parser; pills write tokens; session-local | **D10** |
| R-31, R-32, R-35 | Row click edits · Shift copies · Alt jumps · kebab · material Edit · `Ctrl+Shift+F` | **D11** |
| R-18 (destination), R-28 | `RosterGearTable` slot anchors + pulse; the gear-slot jump splits Log / History / Books | **D12** |
| **D-42** | **Team Summary restored to static Home** (F-08's home) — see §2.7 | **D13** |
| R-40, R-42, §9 | `FairnessSummary` → Home beside it · the D-54 shortcut set · `v2-roster-hide-subs` · matrix write-backs | **D14** |

### Explicitly OUT of Phase D

| Item | Why out | Where it goes |
|---|---|---|
| **R-41 / D-18 Split Planner entry** | **BLOCKED — its home does not exist.** R-41 puts it on the Progress tab; F-03's Progress tab is unbuilt (`NewShell.tsx:38,72,88,106`). No regression: Split Clears is already unreachable in v2 — `onOpenSplitPlanner` is wired only under `!slots?.roster` (`GroupViewContent.tsx:1174-1180`) | Ships with the Progress tab. D14 re-asserts the blocker so the ledger cannot mark D-18 done |
| **D-44 mobile** | Standing ruling — one consolidated pass | Phase P |
| `Alt+1/2/3`, `v`, `g` | Ruled **dropped** (R-35, R-42) — surface death, not deferral | — |
| Legacy `AddLootEntryModal` / `LogMaterialModal` | Ruled not restored (R-17, R-26) | — |

---

## 2. Architecture decisions

### 2.1 The corrected shared-layer inventory

R-43 enumerated which rulings reach V1. Building the plan against the real import graph found
**five reach paths it does not list**, in four different layers. This table supersedes the plan's
first draft, which wrongly asserted the `loot/` barrel was V1's only door into that tree.

⚠ **There are two V1 doors into `loot/`, not one:**
1. the barrel — `GroupViewContent.tsx:38` → `import { LootPriorityPanel, LogWeekWizard } from '../components/loot'`
2. **a direct sibling import from frozen `history/`** — `history/AddLootEntryModal.tsx:25` →
   `import { LootRecommendationCandidates } from '../loot/LootRecommendationCandidates'`

| Ruling | Component | Reach into V1 | Requirement |
|---|---|---|---|
| **R-6** | `loot/LootRecommendationCandidates.tsx` | **YES** — `history/AddLootEntryModal.tsx:25`, V1-live via `LootLogModals.tsx:15,178` ← `SectionedLogView.tsx:17,1794`; also `QuickLogDropModal.tsx:17` ← V1's `LootPriorityPanel.tsx:26` | R-6's confidence/warning treatment exists **only** here today. D2 builds a **v2-owned, net-new** leaf; this file is **frozen** |
| **R-6** | `utils/priorityEntries.ts`, `utils/lootRecommendationService.ts` | **YES** — `priorityEntries` ← V1's `LootPriorityPanel.tsx:21`; `lootRecommendationService` ← V1's `AddLootEntryModal.tsx:24` | **Read-only reuse or v2-local re-derivation. No edit.** If an edit proves unavoidable it takes the R-44 treatment (named delta + public note), never an implementer's default |
| **R-35 / R-42** | `ui/keyboardShortcutGroups.ts`, `ui/KeyboardShortcutsHelp.tsx`, `layout/CommandPalette.tsx`, `hooks/useGroupViewKeyboardShortcuts.ts` | **YES** — the help modal and palette render in **both** shells; the dropped `Alt+1-3` / `V` / `G` rows are still live in V1 under `legacyLootSurface` (`GroupViewContent.tsx:510`) | The help modal must stay truthful for two shells → **shell-aware groups** (§5 open item). Editing the shared hook is a V1 reach in itself |
| **R-45** | `tokens/tokens.json`, `tokens/tokens.light.json`, `scripts/build-tokens.mjs`, `styles/tokens.generated.css` | **YES** — the generated stylesheet is imported by `index.css:2`, which both shells load | Additive only: new semantic aliases; V1 keeps `FLOOR_COLORS` untouched (§2.6) |
| **R-3** | `loot/WeaponPriorityList.tsx` (1,170 lines) | **YES** — V1's `LootPriorityPanel.tsx:25` (sibling import; the barrel export at `index.ts:9` is a second, unused path) **and** v2's `WeaponPriorityBridge.tsx:9` ← `Loot.tsx:63` | R-3 re-homes the **bridge**, not the list. `WeaponPriorityList` is **not edited** |
| **R-48** | `loot/FilterBar.tsx` | **YES** — V1's `LootPriorityPanel.tsx:24`, plus `WeaponPriorityList.tsx:16`, `WhoNeedsItMatrix.tsx:26` | D3's matrix does **not** import it; D1's pill row is its scope control |
| **R-1/R-2** | `loot/index.ts` (barrel) | **YES** | Adding exports is safe; **removing an exported name is a V1 edit** — the line goes with the file |
| **R-26** | `loot/QuickLogMaterialModal.tsx` | **YES** — `LootPriorityPanel.tsx:28,770` | Every new input **optional and off by default** (R-43). Two-part assert mandatory |
| **R-16** | `ui/ResetConfirmModal.tsx` | **YES** — `LootLogModals.tsx:20` ← `SectionedLogView.tsx:17,1794` | R-44's fix, the one **approved delta** |
| **R-8/R-9/R-11** | `loot/WhoNeedsItMatrix.tsx` | **YES, and V1-only** | **Frozen** — R-48 |
| **R-29** | `admin/SortableHeader.tsx` | **YES** — `AllWeeksView.tsx:13` + `AdminErrors.tsx:15`, `AdminOverview.tsx:26`, `AdminUsage.tsx:24` | **Frozen** — R-46 |
| **R-6/R-23** | `history/EntryPopover.tsx`, `LootFairnessLegend` (exported from `history/WeeklyLootGrid.tsx`) | frozen `history/` | Import-vs-fork is ruled **in the slice row**, not at build time (D6) |

**Dead-code evidence (verified on `main` at `3922f1af`):** `loot/FloorSelector.tsx`'s only reference
is `loot/index.ts:2`. `loot/SummaryPanel.tsx`'s only reference is `loot/index.ts:8` — **but see §2.7:
it is the sole mount of `team/TeamSummary.tsx`, so it is not deleted until D13 rules that component's
fate.**

### 2.2 v2 owns its Log; `history/` is read-only reference

Per R-48: `history/WeeklyLootGrid.tsx`, `history/LootCountBar.tsx`,
`history/RevertWeekConfirmModal.tsx` and `AllWeeksView`'s parser are **reference, not dependencies**.
The invariant is *don't edit* `history/`, not *don't import* it — `BookLedgerCard.tsx:21-23` already
imports three legacy modals unmodified.

**⚠ The duplication gate makes "reference" harder than it sounds.** `pnpm dupes` (jscpd over `src`)
is a **blocking** CI step (`ci.yml:73-74`), and D3, D5, D9a and D10 are each "v2 ships its own X
modelled on v1's X". The usual escape — extract a shared helper — is unavailable because `history/`
may not be edited. **Those slices must re-express, not transcribe**, and each must run `pnpm dupes`
locally before its PR.

### 2.3 Storage keys — v2-namespaced, legacy-readable

`v2-history-week-{groupId}-{tierId}` (R-15) and `v2-roster-hide-subs` (§9) take the C6
`useRosterSortPreset` shape: **read legacy's key as a fallback, write v2-only.** The Priority
sub-view and the R-10 scope are new state with no legacy counterpart → fresh keys, no fallback read.

### 2.4 `lview` gains a third value — v2-local, verified

`lview` is declared `['priority','history']` at `Loot.tsx:174`. Adding `'log'` is **v2-local**:
**one reader** (`Loot.tsx:174`) and **four writers**, all on v2 branches — `Loot.tsx:254` (copyLink),
`RosterCard.tsx:286,304`, and `GroupViewContent.tsx:1164-1167` (the More-page card's v2 branch). The
shared `useUrlTabState.ts:38` whitelist already contains `lview`, so no shared file changes.

### 2.5 Release notes — two slices are public, not one

Every slice is `internal: true` with `CURRENT_VERSION` untouched (v2 is admin-gated dark) **except**:

- **D0** — R-44 changes copy a V1 user reads today (`ResetConfirmModal.tsx:47-61` ← `LootLogModals.tsx:20` ← `SectionedLogView.tsx:17,1794`).
- **D14** — R-42's drops and rebinds change rows in the shared `Shift+?` help and the command palette,
  both of which V1 renders. If §5's shell-aware default is taken the *V1-visible* change is nil and
  the entry may stay internal; **that is a slice-time determination, not an assumption.**

`CURRENT_VERSION` tracks the latest public release (2.1.5 after D0); internal slices add entries
without bumping it.

### 2.6 ⚠ R-45's mechanism — corrected

The design record says "New tokens in `index.css`" (`phase-d-loot-design.md:948-949`). That is the
wrong file and would fail CI. The real pipeline: `index.css:2` imports `./styles/tokens.generated.css`,
which is **generated** by `scripts/build-tokens.mjs` from `tokens/tokens.json` + `tokens.light.json`
via the `ID_TO_CSS_VAR` map (`build-tokens.mjs:30`; the material tokens at `:163-167` are the
precedent). `pnpm tokens:check` runs the generator and then `git diff --exit-code` on the generated
file — a **blocking** CI step (`ci.yml:58-59`), so the regenerated CSS must be committed.

Materially: `tokens/tokens.json:69-74` **already defines** `primitive.color.floor.1…4` at exactly the
`FLOOR_COLORS` hexes — but there is **no semantic alias**, and `grep -c floor src/styles/tokens.generated.css`
returns **0**. D0's job is the alias layer plus the map entry, then regenerate and commit.
**R-45's substance is untouched:** semantic tokens, consumed by v2 only, V1 keeps `FLOOR_COLORS`.

### 2.7 ⚠ R-40's premise is false in code — D-42 is real work

R-40 homes `FairnessSummary` "beside the Team Summary that F-08 already put there"
(`phase-d-loot-design.md:817`). **There is no Team Summary on Home.** `home/Home.tsx:26-38` renders
none; V1's is `TeamSummaryEnhanced` (`GroupViewContent.tsx:39,1076`); and the plain
`team/TeamSummary.tsx` is mounted only by dead `loot/SummaryPanel.tsx:7,92`.

D-42 ("Team Summary restore") is listed in Phase D's own coverage table
(`phase-d-loot-design.md:30`) and named in `ROLLOUT_ROADMAP.md:232-233`. It is a **restore, not a
rider** — so it takes its own slice (**D13**), landing before D14 drops `FairnessSummary` next to it.
Which component is the reference — `TeamSummaryEnhanced` (what V1 actually renders) or the plain
`TeamSummary` — is a D13 decision; `loot/SummaryPanel.tsx` survives until then (§5).

---

## 3. The slices (16 PRs)

**Dependency graph (vet-corrected — five edges added):**
```
D0 ──┬─→ D1 ──────────────→ D3
     ├─→ D2 ──┬─→ D3
     │        └─→ D5                (empty cells must log a book: method is
     ├─→ D4 ─→ D5 ─→ D6 ─┐           hard-set to 'drop' until D2 — RecipientPicker.tsx:237)
     │         └─→ D7    │
     ├─→ D8 ──┬─→ D5     ├─→ D12    (D8 before D5/D11: material cells and
     │        └─→ D11    │           R-32's material Edit both need R-21)
     └─→ D9a ─→ D9b ─→ D10 ─→ D11 ─┘
                  └──────────────→ D12   (R-28 targets the History row D9 rebuilds)
D13 (D-42) ─→ D14   (R-40 needs something to sit beside)
```

Each slice: fresh implementation session · `xivrp-director` change-review before the PR (including
the §2.1 shared-file hunk enumeration and the hardcoded-colour assert) · full local gate
(`pnpm build` — **`tsc -b`, not `--noEmit`** — plus `lint`, `check:design-system:strict`,
`pnpm dupes`, `pnpm tokens:check`, `pnpm deadcode`, tests) · live browser validation
(`?shell=v2`, desktop; mobile → Phase P) · static-not-"group" vocabulary check on all new copy ·
screenshots embedded in the PR.

| # | Slice | Contents | Notes |
|---|---|---|---|
| **D0** | Foundations + the V1 delta | R-45 via the **token pipeline** (§2.6: semantic alias in `tokens.json` + `tokens.light.json`, `ID_TO_CSS_VAR` entry, regenerate **and commit** `tokens.generated.css`); `ui/SortableHeader` (real `<button>` in the `<th>`, `aria-sort`, key handling); `ui/GearSlotIcon`; R-44's reset-copy fix | **Public release note + `CURRENT_VERSION` bump** (§2.5). Name R-44 in the PR body as the approved delta. `SummaryPanel` is **not** deleted here (§2.7) |
| **D1** | Priority chrome + entry visuals | Queues ⇄ Matrix ⇄ Weapons switcher (lands on Matrix, persisted); `All + F1–F4` pills on D0's tokens; R-10's per-view default → global-on-first-click; R-7's "Log floor"; R-5's label swap; **R-8's Queues half** — `FloorDropRow.tsx:34-46`'s 34 px letter square → neutral icon + floor-coloured name, and `FloorCard.tsx:100-110` gains the header accent it has never had; delete orphan `FloorSelector` + its barrel line | Weapons segment **mounts** `WeaponPriorityList` via the existing bridge — no edit (§2.1) |
| **D2** | The picker + the explanation leaf | R-12, R-24, R-4's recipient prefill (list stays rendered and switchable), D-36's hint; **R-6's derivation and presentation are v2-owned and net-new** — `LootRecommendationCandidates`, `priorityEntries.ts` and `lootRecommendationService.ts` are read-only (§2.1) | `RecipientPicker` itself is v2-only (`Loot.tsx:64` sole importer). The V1 reach in this slice is R-6's, not the picker's |
| **D3** | v2's Need matrix + Queues wiring | Net-new matrix per R-48; R-8 language; R-9; R-11 (`sortedPlayers.length`); R-4 cell → D2's prefilled picker; **queue rows consume D2's explanation leaf** | `WhoNeedsItMatrix` and `FilterBar` stay frozen. Two-part assert |
| **D4** | The Log tab | `lview` gains `'log'` (§2.4) + the F-06 triad; R-15 (`scopedWeekOverride` deleted at `Loot.tsx:170-171,326,377,441,505`; new storage key; **the `Loot.tsx:20-53` comment block is rewritten, not left describing a dead model**); R-22 (chevrons, go-to-current, revert/start-next-week stay **clock**-bound and name the week they act on, v2-owned data-summary modal); **R-20's gear half only** — "Log a drop" + the wizard, incl. **the wizard's week-target split** (Priority → clock, Log → displayed); **R-20's "Log material" carries to D8** (build note, ruled 2026-07-31: `QuickLogMaterialModal`'s fixed floor/material props are exactly what R-26 replaces, so the button can't honestly work before then) | Makes the tab exist; D5 fills it |
| **D5** | Grid chassis | v2-owned weekly grid: four floor sections, loot cells → picker (assign/edit), material cells → D8's modal; R-19's accent + `Floor N · Book {I–IV}` | Needs D2 (book method) and D8 (material modal). Re-express, don't transcribe (§2.2) |
| **D6** | Grid affordances | R-18 (click never navigates · Shift copies · Alt jumps · kebab/right-click), the Alt-held cursor swap, `×N` popover; R-23 count bar **+ legend**; R-25 "Log floor" on the floor kebab; R-27 tooltip + badge hover-`×` | **Rule in-slice:** `EntryPopover` and `LootFairnessLegend` import-vs-fork (§2.1). `useAltHeld` is a file-local function at `RosterGearTable.tsx:66`, not a hook — extract to `hooks/` (no V1 consumer) or duplicate; extraction touches the file D12 edits. **The Alt-jump destination arrives in D12** — state the interim (card-level `?player=`, `Roster.tsx:359,388`) so this doesn't ship a dead affordance |
| **D7** | Books + every bulk reset | R-14 (card re-homes to Log, takes the **displayed** week, row + column kebabs, `JobIcon`); R-16's four entry points with **real** floor/player scoping — today `Loot.tsx:279` destructures only `{scope,target,week}` and `:290-292` filters week-or-all, so a floor-scoped config would delete everything; `LootResetMenu` follows the displayed week (`Loot.tsx:384`); retarget `?book=` to `lview=log`; History loses its books card | Reference: `SectionedLogView.tsx:450-538`. **Store work is nil** — every method exists (`lootTrackingStore.ts:84-89`, impls `:495,507,531,549,614,683`); this is wiring plus a heavy test surface |
| **D8** | Material modal | R-26 (floor + material selectors, notes) + R-21 (edit mode, old-vs-new augmentation reconciliation); **receives D4's carried "Log material" toolbar action** — once the floor + material selectors exist, Log's toolbar gains the button D4 deferred (build note, ruled 2026-07-31) | **Highest freeze risk in the phase.** Every new input optional and off by default so V1's fixed-`floor`/`material` call site (`LootPriorityPanel.tsx:764-767`) renders byte-identically |
| **D9a** | History table | Flat sortable table on D0's header; `createdAt` desc tiebreak (**not** v1's comparator — that would regress what ships); R-33 floor chip **on tokens**; R-38 `weaponJob`; R-39 slot icon; the eighth kebab column | Pre-declared split (§4 sizing). `AllWeeksView.tsx` = reference |
| **D9b** | Separators + states | R-29's week separators **only under week sort**, carrying the current-week marker and its measured `text-accent-hover` token; R-34's stats count, filtered-vs-empty, `slotAugmented` in the Type column; **the `?entry=`/`?entryType=` highlight + scroll + 2.5 s self-clear preserved** (`LootHistoryTable.tsx:69-103`) | That highlight is **live v2 behaviour** and the destination of shipped C7 roster jumps (`RosterCard.tsx:281-297`) — it must keep resolving against the **unfiltered** logs (`Loot.tsx:39-43`), with a test |
| **D10** | History search | v2's **own** parser: R-47 aliases, R-36 comma alternation + `source:`, `player:"Tank One"` quoting, neutral trailing colon, surfaced unknown key; pills write tokens and light **only on exact equality**; R-37 session-local + `copyLink` strips it | `HistoryFilters` / `DEFAULT_HISTORY_FILTERS` dissolve into the query string |
| **D11** | History row affordances | R-31 (click edits; cursor **only** when `canEdit`; text selectable; `Alt+Enter`/`Shift+Enter`; the `tabIndex` `<tr>` gets a `role`); R-32 (kebab incl. **View week N in Log**; material Edit → D8's modal; `jumpMenuAnchor` from `rosterLedgerJumps.ts:75-83`, not raw `clientX/clientY`); R-35 `Ctrl+Shift+F` with a focus/modal guard **and** a registry entry | The registry is shared (§2.1) — the `Shift+?` entry must not change V1's help |
| **D12** | The jumps | R-18's destination: `RosterGearTable` gains `gear-row-{playerId}-{slot}` anchors + `highlightedSlot` pulse (net-new — legacy's live only in frozen `GearTable.tsx:324,659`); R-28's split (displayed week → Log cell · older → History row · books → Books row); retarget `RosterCard.tsx:281-297` | A material jump whose `slotAugmented` is null (universal tomestone) lands on the card, not a row |
| **D13** | **Team Summary → Home (D-42)** | Restore the tier-wide Team Summary onto static Home per F-08. **Opens with the reference decision:** `TeamSummaryEnhanced` (what V1 renders, `GroupViewContent.tsx:1076`) vs the plain `team/TeamSummary.tsx`. Resolve `loot/SummaryPanel.tsx` in the same slice — it is that component's only mount | §2.7. Without this, D14's R-40 drops `FairnessSummary` beside nothing |
| **D14** | Elsewhere, shortcuts, write-backs | R-40 `FairnessSummary` → Home (drop the `Loot.tsx:396-404` mount); R-42's shortcut set with **shell-aware** help/palette groups (§5); §9 `v2-roster-hide-subs`; **write-backs**: D-23, D-27, D-38, D-39, D-40, D-42, D-43, D-54, D-72, D-37 — and D-18 explicitly **left open** with R-41's blocker restated | Closes the Phase-C closeout's last DoD item |

---

## 4. Definition of done (phase level)

1. Every §1 ruling demonstrably built **in the running app** — director change-review per slice, plus
   a final Phase-D sweep over D-05, D-22…D-44, D-54, D-55, D-72 in the browser.
2. **One logging model — asserted by enumeration, not by claim.** Within **v2's Loot subtree**:
   `logLootAndUpdateGear` has exactly two call sites (`RecipientPicker`, `LogWeekWizard`),
   `logMaterialAndUpdateGear` exactly two (`QuickLogMaterialModal`, `LogWeekWizard`), and books mutate
   only through `adjustBookBalance` / `MarkFloorClearedModal`. A test asserts that exact set.
   *(The tree-wide count is much larger — `QuickLogDropModal`, `QuickLogWeaponModal`,
   `SectionedLogView`, `LootLogPanel`, `UnifiedWeekOverview`, `LogMaterialModal` all call it — which is
   why the assert must be scoped and enumerated, as Phase C's was.)*
3. **V1 safety, two-part assert across D0…D14 as a set:** (a) `git diff --stat` over legacy-only paths
   is empty per slice, **and** (b) every hunk in a file listed in **§2.1** is enumerated in the PR body
   with the exact V1 render path it reaches, carrying director SHARED-DRIFT sign-off. Part (b) is
   **mandatory for every slice touching any §2.1 file** — part (a) passes trivially for this phase's
   real hazards, all of which live in shared files, not legacy-only paths. **R-44 is the one approved
   exception**, named as such in D0's body.
4. `pnpm deadcode` (knip) shows no new dead exports, compared against a **captured baseline report** —
   CI runs it `continue-on-error: true` (`ci.yml:76-78`), so it is claimable unless the before/after is
   attached.
5. No `FLOOR_COLORS[n].hex` in any v2 file (`check:design-system:strict` + an explicit grep assert),
   and `pnpm tokens:check` green with the regenerated stylesheet committed.
6. `pnpm dupes` green on every slice — with the §2.2 constraint understood, not waived.
7. Release notes: `internal: true` per slice; public entries only where §2.5 requires.
8. Mobile deferred to Phase P by standing ruling — recorded, not silently skipped.

---

## 5. Open items carried INTO slices (decided during, not before)

| Item | Where decided | Default if the user is silent |
|---|---|---|
| Do the R-45 semantic aliases re-use the existing floor hues, or get re-picked for contrast? R-8 puts them on gear **names** — body text at scale | D0 PR screenshots | Keep the hues; adjust lightness only where AA fails |
| **How the `Shift+?` help and command palette stay truthful for two shells** (B4) | D14 — **explicit decision required, no silent default** | **Shell-aware groups** (V1's rows stay, v2's reflect the new set) — so no V1 copy change and the entry stays internal |
| **D13's Team Summary reference:** `TeamSummaryEnhanced` vs plain `TeamSummary`, and whether `SummaryPanel` dies with it | D13 slice open | `TeamSummaryEnhanced` (it is what V1 actually renders); `SummaryPanel` deleted once its mount is superseded |
| Does the Weapons segment keep `WeaponPriorityList` verbatim, or does v2 fork it? | D1 PR screenshots | Keep verbatim (§2.1) — a fork is a second 1,170-line file |
| R-6's confidence thresholds — mirror v1's cutoffs or re-derive? | D2 | **Mirror by reading, never by editing** `priorityEntries.ts` / `lootRecommendationService.ts` (§2.1) |
| `EntryPopover` / `LootFairnessLegend`: import the frozen leaf or fork? | D6 row, not build time | Import — but note `WeeklyLootGrid` uses `FLOOR_COLORS[...].hex` (`:515,522,524`), so DoD 5's grep must scope to v2-authored files |
| Priority sub-view persistence: localStorage or the backend user setting? | D1 | localStorage, v2-namespaced |
| **R-21's browser demonstration is deferred at D8** — the modal's edit mode (and its old-vs-new reconciliation matrix) ships unit-proven only (component + coordination tests); D8 has no real week/history context to click it through live | D8 Task 7 | Demonstrate in the running app — the edit door plus the reconciliation matrix — as a named DoD item on **whichever of D5 or D11 lands first** (both mount the material modal's `editEntry` door for the first time: D5's grid material cells, D11's History kebab) |
| **R-21's edit door carries three mount obligations for whichever of D5/D11 lands first** (beside the deferred-demo row above) — (a) **full roster:** the mounting slice must pass the edit door `allPlayers`, not `mainRosterPlayers`; R-a's "Include substitutes" checkbox has nothing to widen from otherwise, and the R-26 build note only promises the full roster to the free-form door, not edit; (b) **referential stability:** the `allPlayers` array passed must be **stable** across renders — the edit reset effect keys on its identity, so a new array each render re-clobbers in-progress edits. PR #236 round 16 sharpened this: per-render stability is NOT sufficient, because `tier?.players` turns over identity on any background `fetchTier`/`updatePlayer` while the modal is open, and the reset effect then re-applies the entry over the user's in-progress edits (typed note, changed week, picked material, manual slot — silent snap-back, no error). The robust fix belongs in the modal itself when the door mounts: make the edit rehydration run once per open (previous-`isOpen` ref, or keying the modal instance on `editEntry.id`), with a regression test that rerenders with a new `allPlayers` identity after typing a note; (c) ~~copy fix: the UT preview's noun/verb pairing~~ **resolved in D8's own review loop** ("keeps their {noun} marked as {verb}" — PR #236 round 4); (d) **first-paint initializers:** edit mode currently renders one pre-effect frame with free-form defaults (floor/material pills, week, method) before the open-reset effect applies the entry — harmless while nothing mounts the door, visible once something does; fix = lazy `useState` initializers branching on `mode === 'edit'`, the exact pattern `recipientPlayerId`/`selectedSlot` already use (D8 final-review Minor + PR #236 Copilot round 6). Round 7 adds a free-form sibling to this same persistent-mount family: the auto-recipient effect now early-returns when the auto-pick doesn't move (so a subs toggle can't clobber a manual slot pick — PR #236 round 7), which means a consumer that keeps the modal MOUNTED across opens can't rely on that effect to re-derive gear state on reopen; today's doors conditionally mount (fresh lazy seeds per open), and any future persistent-mount consumer must reset/re-derive gear state on open explicitly | D8 final review (F-5) | The mounting slice (D5 or D11) states (a), (b) and (d) as explicit line items in its plan/PR body — not silently inherited from the modal's existing contract |
| **The `notes: null` backend contract** — the PUT silently ignores a literal `null` for `notes`, the same wire quirk `MaterialLogEntryUpdate.slotAugmented`'s comment already documents for that field (`types/index.ts:1333-1338`, `loot_tracking.py:1496-1514`). v2's edit path is unaffected (it always sends `''` to clear, per the deltas ledger); legacy V1's edit path sends `null` and so has a live no-op "clear notes" bug. Previously named only in a PR body (Task 5/6 review rounds) — recorded here so it isn't lost | D8 Task 7 | No fix this phase — a named, tracked follow-up; V1's bug stays untouched (deltas ledger) |
| **Phase DoD 2's call-site enumeration test doesn't exist yet** — DoD item 2 requires "a test asserts that exact set" (the `logLootAndUpdateGear`/`logMaterialAndUpdateGear`/books enumeration), but through D8 no such test has been written | D8 Task 7 | **D14** writes it, alongside its other already-assigned write-backs |
| **Radix Select effect-ordering race in the material modal (PRE-EXISTING + V1-LIVE, surfaced by D8's characterization)** — changing the recipient can clobber the slot `Select` back to placeholder: the hidden native-`<select>` bubble-input's value-sync effect races `onNativeOptionAdd`'s native-option re-render, so the `.value` assignment no-ops against the stale (pre-swap) option set and the dispatched change event's value is `''`. The unguarded `onChange` handlers (`QuickLogMaterialModal.tsx:734,760,783`) let that `''` clobber the just-computed slot, so submit sends `slotToAugment: undefined` and the gear augmentation silently skips. Root-cause trace: `QuickLogMaterialModal.test.tsx:311-367`. v2's free-form/edit doors inherit it — D8's lazy seed removed only the mount-time instance | D8 Task 1 characterization; recorded here D8 final review (F-3) | Follow-up ticket against `ui/Select.tsx` (fix applies to both shells — V1 and v2 share the component); no fix this phase. Manual browser-pass case owed: switch recipient between two players who BOTH have eligible slots |

---

## 6. Risks

- **D8 is the freeze risk.** `QuickLogMaterialModal` is the one component this phase grows that V1
  renders on its main Loot tab. If the optional-props discipline slips, every V1 user sees it.
- **R-6 is the subtler freeze risk.** Its derivation and its presentation both already exist in files
  V1 renders, reached through a door R-43 never listed. The temptation to "just extend" them is
  exactly the drift §2.1 exists to stop.
- **D4 deletes `scopedWeekOverride`**, which five call sites read. Correct — R-15 removes the bug it
  works around structurally — but it is the phase's one deletion of live v2 behaviour, and the
  30-line comment block documenting that model must be rewritten with it.
- **The duplication gate versus the freeze** (§2.2). Four slices re-express frozen components with no
  shared-helper escape. This is the constraint most likely to force a rewrite late in a slice.
- **Sizing.** Expect **D6** (~1,000) and **D7** (900–1,400 — the plan's most under-sized row, heavier
  than D3) to sit near the budget; **D9 was pre-split** into D9a/D9b rather than discovered oversized
  at review. D3 fits (~900–1,300) **provided D2 genuinely owns the prefill**. D5/D6 must not merge.
