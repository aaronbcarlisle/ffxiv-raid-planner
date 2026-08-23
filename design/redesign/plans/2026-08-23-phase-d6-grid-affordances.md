# Phase D — Slice D6: Grid Affordances — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Vet record:** `xivrp-director` plan-vet 2026-08-23 → **PARITY-GAP → APPROVE-WITH-CHANGES**
(2 blockers · 6 major · 9 minor) — **all folded into this revision**: F-1 Tooltip test harness
(matchMedia stub + `TooltipProvider`), F-2 `logCellDomId` single-authorship, F-3 D6-l §5-row
write-back, F-4 D6-b three-option rewrite, F-5 D6-d citation + checkbox delta, F-7 count-bar
sub-12px disclosure (escalated to ruling D6-n), F-8 signature-preserving extraction, F-9 Radix
dropdown `keyDown Enter` idiom, F-10 cross-type/out-of-week `?entry=` contract, F-11–F-18
minors, F-19 sizing 1,200–1,400 + named pre-split seam.

**USER RULINGS (2026-08-23, all four on the recommendation):**
- **R-D6a · Fork the popover.** The ×N route is the v2-owned `LogCellEntriesMenu`
  (Dropdown-based, loot + material); frozen `EntryPopover` is not imported. Supersedes §5's
  recorded "Import" default for this leaf.
- **R-D6b · Hover/focus-revealed per-cell kebab.** Each filled interactive cell carries a
  kebab revealed on hover/focus (the hover-× reveal pattern), opening the SAME menu right-click
  opens — one items list, two triggers.
- **R-D6n · v2-owned count bar.** R-23's count bar is re-expressed at `text-xs`
  (`loot/WeekCountBar.tsx`); frozen `LootCountBar` is not imported. `LootFairnessLegend` is
  still imported (genuinely clean).
- **R-D6s · Pre-split taken: D6a then D6b, two PRs, D6a first.** See § Slice split.

**Goal:** Layer the ruled affordances onto the shipped D5 weekly Log grid — R-18's modifier
family (plain click edits, `Shift+Click` copies a deep link, `Alt+Click` jumps to the recipient,
right-click/menu-key opens a context menu), the Alt-held cursor swap, the `×N` multi-entry route
(closing F-14i), R-23's count bar + fairness legend, R-25's "Log floor" on a floor-header kebab,
and R-27's teaching tooltip + recipient-badge hover-`×` — without editing a line V1 renders.

**Architecture:** Everything rides on what D5 shipped: `LogWeekGrid`'s `GridCell` stays the one
primary control per cell (a design-system `Button`), and D6 adds *sibling* secondary controls
(the `×N` chip becomes its own labelled trigger button; the hover-`×` is an `IconButton`) so no
button ever nests inside another. The multi-entry route is a v2-owned `Dropdown`-based menu
consuming `cell.entries` directly (no re-derivation). All new doors reuse existing machinery:
the context menu is `ui/ContextMenu` + `jumpMenuAnchor` (the RosterGearTable precedent), delete
routes through `Loot.tsx`'s existing `requestDelete` → confirm modals, "Log floor" opens the one
existing `LogWeekWizard` via `setWizardState({floor})` (`writeWeek` already resolves to the
displayed week while `lview==='log'`), and the jump/copy-link writers follow the RosterCard /
A10-clipboard patterns verbatim. `LootCountBar` + `LootFairnessLegend` are **imported** from
frozen `history/` files unmodified (§2.2's invariant is *don't edit*, not *don't import*).

**Tech Stack:** React 19 + TypeScript, Radix primitives (`primitives/Dropdown`,
`primitives/Tooltip`), `ui/ContextMenu`, `ui/IconButton`, Vitest + RTL, react-router
`useSearchParams`.

**Spec:** `design/redesign/specs/phase-d-loot-design.md` — R-18 (:519-547), R-23 (:612-623),
R-25 (:639-647), R-27 (:684-689), R-28 for the interim statement (:691-698), §4 mockup
(:702-731). Slice row + in-slice ruling mandate: `design/redesign/specs/phase-d-loot-plan.md`
:39, :192, :242. Predecessor record: `design/redesign/plans/2026-08-22-phase-d5-grid-chassis.md`.

---

## Global Constraints

- **V1 safety.** No file in this slice's table is a §2.1 shared file. `LogWeekGrid.tsx`,
  `logWeekGridData.ts`, `Loot.tsx`, `LootToolbar.tsx` are v2-only; `RosterGearTable.tsx` is
  v2-only per the design record's own reach table (`phase-d-loot-design.md:1122` — reached only
  via `RosterCard`→`RosterCards`→`Roster`→`NewShell.tsx:12`; V1's gear table is
  `player/GearTable.tsx`). `hooks/useAltHeld.ts` is net-new with no V1 consumer. **`history/`
  files are imported, never edited** — `git diff --stat` over `frontend/src/components/history/`
  must be empty in the final diff. The PR body still carries the phase-DoD-3(b) statement: "no
  §2.1 file touched," with the file list.
- **The ruled modifier table (R-18) is binding and closed:** Click = log/edit (never a jump) ·
  `Shift+Click` = copy deep link · `Alt+Click` = jump to recipient card · right-click/kebab =
  Edit / Copy link / Jump to {player} / Delete. Pointer cursor **only while Alt is held**
  (`useAltHeld`, the C4 reference). Do not add inputs, do not drop inputs.
- **The C7 cursor ruling applies cleanly:** the app's buttons sit on Tailwind 4's preflight
  `cursor: default` (no global override exists in `index.css` — verified), so grid cells show
  the arrow like every other button, and D6 adds `cursor-pointer` only while Alt is held *and* a
  jump target exists.
- **Green-commit hook:** `.claude/hooks/pre_bash_guard.py` runs whole-project `tsc -b` on any
  commit with staged frontend TS — every commit must stay green. Cross-task prop additions land
  with their wiring in the same commit or with temporarily-optional props tightened in the same
  task (this plan sequences tasks so no shim is needed: grid props tighten to required in
  Task 6, the same commit that wires them).
- **Deletion-trace discipline:** implementers prove each load-bearing assertion by EXECUTING the
  mutation (delete the branch/guard, run the test, paste the failure output, restore) — not by
  argument. Watch the vacuous-coincidence trap: **drive the displayed week apart from the clock
  week** in every test where both exist (D5/D4 precedent: `logWeek.week` and `clock.currentWeek`
  both defaulting to the same number makes week-binding assertions vacuously green).
- **aria-hidden hazard (index.css :239-243):** any decorative `aria-hidden` element that relies
  on flex/grid display MUST carry `role="presentation"`; never place `GearSlotIcon` bare in a
  `<th>`/`<td>` — wrap in an `inline-flex` span. `LogWeekGrid.test.tsx`'s generic sweep test
  (every aria-hidden flex/grid element carries `role="presentation"`) must stay green after
  every task; new lucide icons inside `IconButton`/menu items are fine (the primitives already
  comply).
- **jscpd (blocking CI):** the entries menu, the teaching tooltip, and the Log `?entry=`
  consumption are **re-expressions**, not transcriptions of `history/WeeklyLootGrid.tsx` /
  `history/EntryPopover.tsx` / `LootHistoryTable.tsx`'s effect. Run `pnpm dupes` locally before
  the PR. The imported count bar/legend duplicate nothing by construction.
- **12px floor:** the teaching tooltip's `<kbd>` chips are `text-xs`, NOT legacy's `text-[10px]`
  (a live warn in the frozen file — do not carry it forward).
- **FLOOR_COLORS grep (phase DoD 5) scopes to v2-authored files.** Importing
  `LootFairnessLegend` from `history/WeeklyLootGrid.tsx` makes v2 *depend on* a module that uses
  `FLOOR_COLORS[..].hex` internally — that is the §5 row's anticipated state, not a violation.
  No v2-authored file may contain `FLOOR_COLORS`.
- **Vocabulary:** "static," never "group," in all new user-facing copy.
- **Sizing (director-corrected):** bottom-up estimate is **~1,200–1,400 changed lines** — under
  the 1,500 budget but with no slack (`phase-d-loot-plan.md:265-267` budgeted ~1,000). The
  **pre-split seam is named now** so a split is a decision, not a mid-slice scramble:
  **D6a** = R-18 modifier family + `×N` menu + context menu + `Loot.tsx` wiring + `?entry=`
  consumption (self-contained, demo-able, no dead affordance); **D6b** = R-23 count bar +
  legend, R-25 floor kebab, R-27 teaching tooltip + hover-`×`. D6a lands first (D6b's tooltip
  teaches D6a's modifiers). Whether to split is a **user ruling** (§ Decisions). Release note is
  `internal: true`, `CURRENT_VERSION` untouched, per shipped PR.
- **Test-edit discipline:** `LogWeekGrid.test.tsx` existing tests may change ONLY in these
  sanctioned classes, each named where it happens: (1) multi-entry accessible-name formula
  updates (Task 4); (2) queries that assumed the chip renders inside the cell button (Task 4);
  (3) **the Tooltip harness rewrite** — Task 4's `matchMedia` stub + a `renderGrid()` helper
  wrapping every render in `TooltipProvider` (director F-1: `Tooltip.tsx:43-48` →
  `useDevice()` → `window.matchMedia`, unimplemented in jsdom; Radix throws without a
  provider); (4) **the `baseProps()` extension** when Task 6 tightens five props to required
  (director F-16). Any other existing-assertion edit needs its own justification in the task
  report. New describes append at the end of the file.

---

## Decisions made in this plan

| # | Decision | Status |
|---|---|---|
| **D6-a** | **`EntryPopover`: fork, don't import.** The ×N route is a v2-owned `LogCellEntriesMenu` built on `primitives/Dropdown`, generic over loot AND material entries. This **deviates from §5's recorded default ("Import")** on three verified legs the default predates: legacy `EntryPopover` is `LootLogEntry[]`-only (`EntryPopover.tsx:21` — v2 material cells bucket arrays, so half of D6's need is unmet), it re-derives the ring label v2's data layer already canonicalised (`:100-102` vs `logWeekGridData.ts:122-124`), and it hand-rolls fixed-positioning + three dismissal effects the Radix primitives give for free (`:38-90`); it also carries its own `text-[10px]` (`:145,149`). *(Supporting note, not a disqualifier: it transitively imports legacy-only `lootMethodDisplay.ts` — the plan's own "don't edit ≠ don't import" invariant means that alone would not block an import.)* `LootFairnessLegend` keeps the Import default (genuinely clean — `WeeklyLootGrid.tsx:859-877`, semantic tokens only). The count bar is ruled separately (**D6-n**). | **RULED — see R-D6a/R-D6b/R-D6n in the vet record** |
| **D6-b** | **Where does the cell menu live?** Three real options (director F-4 corrected an earlier false binary): **(1)** a standing visible per-cell kebab (~40 of them competing with the cells — legacy had none; the §4 mockup shows `⋮` on floor headers only); **(2)** a **hover/focus-revealed per-cell kebab** (`opacity-0 focus-visible:opacity-100 group-hover:opacity-100` — the exact reveal pattern the hover-`×` already uses in the same cell), zero standing visual weight, and a real button browse-mode AT users can reach — the strongest reading of R-18's rationale ("the kebab exists so every modifier action has a keyboard and AT route," `phase-d-loot-design.md:532`), since Shift+F10 does not reliably pass through AT virtual cursors; **(3)** right-click + menu-key only (`jumpMenuAnchor` both-zero anchor). Right-click opens the same menu in all three. Current mitigations if (3): `Alt+Enter` jumps, and the teaching tooltip's "Right-click — More options" row. **Recommendation: (2).** | **RULED — see R-D6a/R-D6b/R-D6n in the vet record** |
| D6-c | **`detail === 0` (AT synthetic click) fires the PRIMARY action (edit), not the jump.** Deliberate refinement of the C4 gate: on RosterGearTable's jump spans the *only* action is the jump, so detail-0 maps to it; a grid cell's primary action is edit, and mapping AT activation to a hidden secondary action would violate "appearance must match behavior." The AT route to the jump is the context menu (R-18's own rationale: "the kebab exists so every modifier action has a keyboard and AT route"). `Alt+Enter` also jumps for free — a keyboard-synthesised click carries modifier state. | Director vets |
| D6-d | **Delete routes through `Loot.tsx`'s existing `requestDelete` → confirm modals** (`DeleteLootConfirmModal` with revert-gear checkbox for loot; `ConfirmModal` for material). This is *parity*, not added friction — director-verified end to end: the legacy hover-× calls `onDeleteLoot(entry.id)` (`WeeklyLootGrid.tsx:405-408`) → `handleGridDeleteLoot` (`SectionedLogView.tsx:901-906`) → `handleDeleteLoot` → `setConfirmState` → `deleteLootAndRevertGear(..., { revertGear: true })` (`:262-275`). One named delta: legacy always reverts gear; v2's loot confirm exposes a revert-gear **checkbox** (`Loot.tsx:952-968`) — recorded in Task 7's R-27 build note. | Director-verified ✓ |
| D6-e | **The hover-× gains `focus-visible:opacity-100`** — the frozen implementation is keyboard-reachable but visually invisible when focused (`opacity-0 group-hover:opacity-100` only). Deliberate a11y improvement delta, named in the PR body. | Director vets |
| D6-f | **Material multi-entry cells get the menu too.** Legacy never built a materials popover (its `find()` under-reported double-drop weeks — the exact bug v2's array bucketing fixed); giving materials the same route is the consistent consequence of D5's data model. | Director vets |
| D6-g | **The count bar reads the DISPLAYED week** (`currentWeek={logWeek.week}`). R-23 is "the week's count bar" and it sits under the displayed week's grid. | Director vets |
| D6-h | **Empty-cell clicks with Shift or Alt held are no-ops** — there is no entry to copy/jump to, and opening the log door on a modifier click the user aimed at something else would surprise. | Director vets |
| D6-i | **`useAltHeld` is EXTRACTED to `hooks/useAltHeld.ts`** (not duplicated): exactly one consumer today, file-local, zero V1 reach; a third hand copy (RosterGearTable already has the pattern twice in JSX) is the alternative. Extraction touches `RosterGearTable.tsx` — the file D12 later edits — as an import-swap only. | Director vets |
| D6-j | **Log deep links:** `tab=gear&lview=log&week={displayed}&entry={id}&entryType={loot\|material}` — `entryType` ALWAYS set (R-18 note 1: "not optional"), `week` KEPT (Log has a week axis; History links strip it), `shell` stripped, `tier` preserved (build from `window.location.href`, the A10 clipboard shape). |
| D6-k | **D6 ships the Log-side `?entry=` consumption** (validate → pulse → scroll → 2.5 s self-clear). D5 marked it "D6/D11"; D6 ships the producer (Shift+Click), and a copy affordance whose links land nowhere is a dead affordance by the plan's own standard. **Contract sharpened by director F-10:** (a) validation is per-type — a loot id arriving with `entryType=material` (or vice-versa) yields `highlightEntry === null` (ids are independent sequences, R-18 note 1; `LootHistoryTable.tsx:72-77` is the precedent), with a lookup-swap deletion trace; (b) an entry that resolves but sits in a different week than `logWeek.week` first calls `logWeek.setWeek(entry.weekNumber)` (the wizard `onSuccess` precedent, `Loot.tsx:882`) so the link is never a silent dead scroll; (c) the 2.5 s strip uses the **functional** `setSearchParams(prev => …)` form (`LootHistoryTable.tsx:91-96`) so it cannot clobber `useLogWeek`'s `?week=` mirror. |
| D6-l | **Read-only cells stay non-interactive.** D5 ruled `canEdit=false` cells render no controls; D6 does not add viewer-facing menus/popovers/tooltips to them. **Named parity delta (director F-3):** legacy gates Shift+Click/Alt+Click/`onContextMenu` on entry presence only, NOT `canEdit` (`WeeklyLootGrid.tsx:584-609,621`) — a read-only V1 viewer can copy/jump/menu today, and V1 keeps that (untouched); v2's re-expression drops it for viewers. Durable home: Task 7 adds a **§5 open-item row** to `phase-d-loot-plan.md` ("read-only cells stay inert; viewer copy/jump is a possible follow-up slice") and the PR body's parity statement names it — never only a build note. Read-only multi-entry cells DO get the count folded into their sr-only sentence. |
| **D6-n** | **The count bar: import as-is, or v2-owned re-expression?** R-23 rules `LootCountBar` in; the §2.2 invariant allows importing the frozen file. But the frozen file renders sub-floor text — `text-[10px]` ×3 + `text-[9px]` ×1 (`LootCountBar.tsx:89,99,104,117`) — directly onto v2's Log, under a grid whose own tooltip this slice deliberately raises to `text-xs` (the earlier "lint-clean" claim was **wrong**, director F-7). Options: **(1) Import as-is** — R-23 exactly as ruled, sub-12px text ships as a named, disclosed interim on an imported frozen leaf (follow-up ledgered beside the index.css rule-narrowing item); **(2) v2-owned re-expression** — same layout/thresholds at `text-xs`, ~+150 lines (fits naturally in D6b if the split is taken). | **RULED — see R-D6a/R-D6b/R-D6n in the vet record** |

## Slice split (R-D6s, ruled 2026-08-23)

Two PRs on the director's seam. **This plan is the single source for both**; D6b's execution
session re-reads it and needs no second plan document.

| PR | Scope (task steps as written below) | Branch |
|---|---|---|
| **D6a — modifier family + ×N route + wiring** | Task 1 · Task 2 · Task 3 · Task 4 **minus** the teaching tooltip (its Step 0 harness + tooltip contract item 3 + tooltip tests move to D6b; the R-D6b cell kebab is D6a — it is part of the menu family) · Task 6 **minus** the count bar/legend mount and **minus** `onLogFloor` (that prop + its required-tightening ride with Task 5 in D6b — D6a tightens the other four: `onCopyEntryLink`, `onJumpToPlayer`, `onDeleteEntry`, `highlightEntry`) · Task 7 scoped to D6a's records (R-18 build notes, F-14i closure, §5 D6-l row, release note) | `phase-d/d6a-grid-affordances` |
| **D6b — teaching layer + fairness read + floor kebab** | Task 4's tooltip remainder (incl. the F-1 Step 0 harness) · Task 5 · `loot/WeekCountBar.tsx` (R-D6n, spec below) + `LootFairnessLegend` import + their Task 6 mount/tests · Task 7 remainder (R-23/R-25/R-27 build notes, release note) | `phase-d/d6b-grid-teaching` (fresh session per the slice cadence) |

**`WeekCountBar` spec (R-D6n, built in D6b):** `loot/WeekCountBar.tsx`, props
`{ players: SnapshotPlayer[]; lootLog: LootLogEntry[]; week: number }`. Same semantics as the
frozen reference (re-expressed, never transcribed — jscpd): main-roster players only
(`!isSubstitute`), counts from `lootLog` filtered to `weekNumber === week` by
`recipientPlayerId`, `POSITION_ORDER` (`T1 T2 H1 H2 M1 M2 R1 R2`, unknown last) sort, average
= main-roster total / main-roster count, `null` on an empty main roster; per-player tile =
position label in role color (`getRoleColor`), truncated name, count colored
`var(--color-status-info)` when `> avg+1`, `var(--color-status-warning)` when `< avg-1`, else
`var(--color-text-secondary)`; `Tooltip` per tile (name, "{n} drops this week", "±N.N from
avg" / "At average"); horizontal-scroll container. **Every text node `text-xs` or larger.**
Interim until D6b lands: the Log shows the grid with no fairness read below it — the D5 state,
already recorded; D6a's Task 7 keeps the `Loot.tsx:89-98` comment rows for count bar/legend
(D6b) instead of deleting them.

**The Alt-jump interim (stated per the D6 slice-row mandate):** the `Alt+Click` / "Jump to
{player}" destination in this slice is **card-level** — `tab=roster&player={id}`, the only
`?player=` contract the app consumes today (`Roster.tsx:359,388`; scroll + URL-strip owned by
the shared chrome at `GroupViewContent.tsx:234-257`; `highlight-pulse` applied by
`RosterCards`). Slot-level anchors (`gear-row-{playerId}-{slot}` + `highlightedSlot` pulse in
`RosterGearTable`) and R-28's week-split destination arrive in **D12**, which retargets the same
callback. The affordance renders only when the entry's recipient resolves to a current roster
player (the `rosterLedgerJumps` philosophy: the affordance exists only when the target does).

---

## File structure

| File | Status | Responsibility in this slice |
|---|---|---|
| `frontend/src/hooks/useAltHeld.ts` | Create | The extracted Alt-held hook (verbatim behavior: window keydown/keyup + blur reset) |
| `frontend/src/hooks/useAltHeld.test.ts` | Create | Hook tests: down/up transitions, blur reset, listener cleanup |
| `frontend/src/components/roster/RosterGearTable.tsx` | Modify | Delete the file-local `useAltHeld` (:59-87), import from `hooks/` — zero behavior change |
| `frontend/src/components/loot/RecipientBadge.tsx` | Create | `RecipientBadge` + `resolveRecipient` + the `RecipientLike`/`ResolvedRecipient` interfaces moved out of `LogWeekGrid.tsx` **signature-preserving** (director F-8) so the entries menu can share them without a cycle |
| `frontend/src/components/loot/LootEntryRow.tsx` | Modify | `HistoryItem` becomes a re-export alias of `LogGridEntryRef` (director F-12 — one discriminated ref type, so `deleteFromGrid = requestDelete` is literal wiring, no adapter/cast) |
| `frontend/src/components/loot/LogCellEntriesMenu.tsx` | Create | The v2-owned ×N route (D6-a): Dropdown trigger chip + newest-first entry list, click-to-edit |
| `frontend/src/components/loot/LogCellEntriesMenu.test.tsx` | Create | Menu tests |
| `frontend/src/components/loot/logWeekGridData.ts` | Modify | Export `LogGridEntryRef` (discriminated loot/material entry ref) |
| `frontend/src/components/loot/LogWeekGrid.tsx` | Modify | Cell modifier gates, Alt cursor, context menu, cell anatomy (chip sibling + hover-×), teaching tooltips, accessible-name fold-in, floor-header kebab, highlight pulse ids, new props |
| `frontend/src/components/loot/LogWeekGrid.test.tsx` | Modify | New describes (append); named updates to multi-entry aria-label expectations + chip-location queries |
| `frontend/src/components/loot/Loot.tsx` | Modify | Wiring: copy-link builder, jump writer, delete plumb-through, `onLogFloor` → `setWizardState`, Log `?entry=` consumption, count bar + legend mount, header-comment rewrite |
| `frontend/src/components/loot/Loot.test.tsx` | Modify | Wiring tests (append): URL shapes, displayed-week bindings, highlight self-clear |
| `frontend/src/data/releaseNotes.ts` | Modify | Internal entry, `CURRENT_VERSION` untouched |
| `design/redesign/specs/phase-d-loot-design.md` | Modify (Task 7) | Build notes under R-18/R-23/R-25/R-27; F-14i closure; the interim statement |

**Not touched:** anything under `frontend/src/components/history/` (imported only),
`ui/ContextMenu.tsx`, `primitives/*`, `useGroupViewKeyboardShortcuts.ts` (shortcuts are D14),
`QuickLogMaterialModal.tsx`, `RecipientPicker.tsx`, `useLogWeek.ts`, stores, backend.

---

### Task 1: Extract `useAltHeld` to `hooks/`

**Files:**
- Create: `frontend/src/hooks/useAltHeld.ts`
- Create: `frontend/src/hooks/useAltHeld.test.ts`
- Modify: `frontend/src/components/roster/RosterGearTable.tsx:59-87` (delete local fn, add import)

**Interfaces:**
- Produces: `export function useAltHeld(): boolean` — true while the Alt key is held; resets to
  false on window blur. Consumed by `RosterGearTable.tsx` (existing call site `:179`) and by
  `LogWeekGrid.tsx` (Task 3).

- [ ] **Step 1: Write the failing tests** (`hooks/useAltHeld.test.ts`):

```tsx
import { renderHook, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { useAltHeld } from './useAltHeld';

describe('useAltHeld', () => {
  it('is false initially and true while Alt is down', () => {
    const { result } = renderHook(() => useAltHeld());
    expect(result.current).toBe(false);
    act(() => { fireEvent.keyDown(window, { key: 'Alt' }); });
    expect(result.current).toBe(true);
    act(() => { fireEvent.keyUp(window, { key: 'Alt' }); });
    expect(result.current).toBe(false);
  });

  it('ignores non-Alt keys', () => {
    const { result } = renderHook(() => useAltHeld());
    act(() => { fireEvent.keyDown(window, { key: 'Shift' }); });
    expect(result.current).toBe(false);
  });

  it('resets on window blur (Alt+Tab cannot strand held=true)', () => {
    const { result } = renderHook(() => useAltHeld());
    act(() => { fireEvent.keyDown(window, { key: 'Alt' }); });
    expect(result.current).toBe(true);
    act(() => { fireEvent(window, new Event('blur')); });
    expect(result.current).toBe(false);
  });

  it('removes listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useAltHeld());
    unmount();
    const removed = removeSpy.mock.calls.map((c) => c[0]);
    expect(removed).toEqual(expect.arrayContaining(['keydown', 'keyup', 'blur']));
    removeSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify they fail** — `pnpm vitest run src/hooks/useAltHeld.test.ts`.
  Expected: FAIL (module not found). Paste output.
- [ ] **Step 3: Create the hook** — move the implementation from `RosterGearTable.tsx:59-87`
  verbatim (including the doc comment explaining why global key listeners, not pointermove),
  adding `export`.
- [ ] **Step 4: Swap RosterGearTable to the import** — delete the local function, add
  `import { useAltHeld } from '../../hooks/useAltHeld';`, and update the React import line:
  `useEffect` has no remaining consumer in the file once the hook moves out (`useState` stays,
  `:183`), so `:22` becomes `import { Fragment, useState, type ReactNode } from 'react';` —
  or `tsc -b` (the green-commit hook) fails (director F-11). No other change to the file.
- [ ] **Step 5: Run** `pnpm vitest run src/hooks/useAltHeld.test.ts src/components/roster` —
  all green (RosterGearTable's existing cursor-swap tests are the behavior lock).
- [ ] **Step 6: Deletion-trace (execute, paste output):** comment out the `blur` listener
  registration in the new hook → the blur test must FAIL; restore.
- [ ] **Step 7: Commit** — `refactor(hooks): extract useAltHeld from RosterGearTable (D6 prep)`

---

### Task 2: `RecipientBadge` extraction + `LogCellEntriesMenu` (the ×N route)

**Files:**
- Create: `frontend/src/components/loot/RecipientBadge.tsx` (moved from `LogWeekGrid.tsx:121-142`)
- Create: `frontend/src/components/loot/LogCellEntriesMenu.tsx`
- Create: `frontend/src/components/loot/LogCellEntriesMenu.test.tsx`
- Modify: `frontend/src/components/loot/logWeekGridData.ts` (add `LogGridEntryRef`)
- Modify: `frontend/src/components/loot/LogWeekGrid.tsx` (import `RecipientBadge`/`resolveRecipient` instead of defining them — rendering byte-identical)

**Interfaces:**
- Produces (`logWeekGridData.ts`):

```ts
export type LogGridEntryRef =
  | { kind: 'loot'; entry: LootLogEntry }
  | { kind: 'material'; entry: MaterialLogEntry };
```

  and `LootEntryRow.tsx:16-18`'s identical `HistoryItem` becomes
  `export type HistoryItem = LogGridEntryRef;` (type-only import) — one discriminated ref type
  across the grid, the History rows, and `requestDelete` (director F-12). `Loot.tsx` call sites
  compile unchanged.
- Produces (`RecipientBadge.tsx`) — **signature-preserving move, director F-8**: the exact
  current `RecipientBadge({ color, name, job })` (`LogWeekGrid.tsx:128`),
  `resolveRecipient(entry: RecipientLike, playerMap: Map<string, SnapshotPlayer>)` (`:121`),
  and the `RecipientLike` (`:109-112`) + `ResolvedRecipient` (`:114-118`) interfaces — all
  exported, bodies untouched. The memoized `playerMap` stays the lookup structure; no O(n)
  scans are introduced.
- Produces (`LogCellEntriesMenu.tsx`):

```ts
interface LogCellEntriesMenuProps {
  entryRefs: LogGridEntryRef[];             // newest-first (cell.entries order), length >= 2
  playerMap: Map<string, SnapshotPlayer>;   // the grid's memoized map — one lookup structure (F-8)
  cellLabel: string;                        // the grid's own label — 'Ears', 'Ring', 'Glaze', 'Tome'…
  floorName: string;
  onEdit: (ref: LogGridEntryRef) => void;
}
export function LogCellEntriesMenu(props: LogCellEntriesMenuProps): JSX.Element
```

Renders a `Dropdown` whose trigger is the ×N chip itself — a **`Button size="xs"`**
(`px-2 py-0.5 text-xs`, `Button.tsx:46` — director F-13: `size="sm"` carries `px-3 py-1.5
min-h-[44px]` and same-property utilities resolve by stylesheet order, so className overrides
would silently lose) with `variant="ghost"` plus `rounded bg-accent/20 font-bold text-accent`
to match D5's chip look, and
`aria-label={`${entryRefs.length} entries for ${cellLabel} — ${floorName}`}` (the legacy chip's
label shape, `WeeklyLootGrid.tsx:639`). If the `xs` geometry visibly fails to match the D5 chip,
the D5 F-15 rule applies: a `design-system-ignore`'d raw chip button is permitted only after a
before/after screenshot of the concrete geometry failure is pasted in the ledger. Content:
`DropdownLabel` header (`{n} {cellLabel} entries`), then one `DropdownItem` per ref,
newest-first: `RecipientBadge` + muted secondary text (loot → `entry.method` + `' · extra'`
when `isExtra`; material → `entry.slotAugmented ?? 'no slot'`) + short date
(`new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })`);
`onSelect={() => onEdit(ref)}`.

**Test idiom (director F-9, binding for every dropdown in this slice):** Radix
`DropdownMenuPrimitive.Trigger` opens on pointerdown, which `fireEvent.click` does not
synthesize — jsdom tests open it with `fireEvent.keyDown(trigger, { key: 'Enter' })` then
`await screen.findAllByRole('menuitem')`, the repo's established idiom (`Loot.test.tsx:803-804,
816-817, 843-844`).

- [ ] **Step 1: Move `RecipientBadge`/`resolveRecipient`** into `RecipientBadge.tsx`; update
  `LogWeekGrid.tsx` to import them. Run `pnpm vitest run src/components/loot/LogWeekGrid.test.tsx`
  — must stay green with zero test edits (the lock that the move is behavior-neutral).
- [ ] **Step 2: Write the failing menu tests** (`LogCellEntriesMenu.test.tsx`; fixtures modeled
  on `LogWeekGrid.test.tsx`'s factories):

```tsx
// makePlayer/makeLootEntry/makeMaterialEntry fixture factories as in LogWeekGrid.test.tsx
const refs = (entries: LootLogEntry[]): LogGridEntryRef[] =>
  entries.map((entry) => ({ kind: 'loot', entry }));

it('renders the chip trigger with a count-and-cell accessible name', () => {
  render(<LogCellEntriesMenu entryRefs={refs([e2, e1])} playerMap={playerMap}
    cellLabel="Ears" floorName="M9S" onEdit={vi.fn()} />);
  expect(screen.getByRole('button', { name: '2 entries for Ears — M9S' })).toBeInTheDocument();
});

it('opens (keyDown Enter — the Radix jsdom idiom, Loot.test.tsx:803) and lists entries newest-first', async () => {
  render(/* as above */);
  fireEvent.keyDown(screen.getByRole('button', { name: '2 entries for Ears — M9S' }), { key: 'Enter' });
  const items = await screen.findAllByRole('menuitem');
  expect(items[0]).toHaveTextContent('Healer One');   // e2 newest
  expect(items[1]).toHaveTextContent('Tank One');     // e1 older
});

it('selecting an item calls onEdit with that exact ref', async () => {
  const onEdit = vi.fn();
  render(/* with onEdit */);
  fireEvent.keyDown(screen.getByRole('button', { name: /2 entries/ }), { key: 'Enter' });
  fireEvent.click((await screen.findAllByRole('menuitem'))[1]);
  expect(onEdit).toHaveBeenCalledWith({ kind: 'loot', entry: e1 });
});

it('material refs render the augmented slot and date', async () => { /* slotAugmented + date visible */ });
it('an unresolvable recipient falls back to the stored name', async () => { /* resolveRecipient fallback */ });
```

- [ ] **Step 3: Run to verify they fail** — paste output.
- [ ] **Step 4: Implement `LogCellEntriesMenu`** per the interface above.
- [ ] **Step 5: Run to green.**
- [ ] **Step 6: Deletion-trace (execute, paste output):** (i) reverse the render order (`[...entryRefs].reverse()`) → the newest-first test must FAIL; restore. (ii) call `onEdit` with `entryRefs[0]` regardless of clicked item → the exact-ref test must FAIL; restore.
- [ ] **Step 7: Commit** — `feat(v2): LogCellEntriesMenu — the ×N multi-entry route (D6 Task 2)`

---

### Task 3: Cell modifier layer — Shift/Alt gates, Alt cursor, context menu

**Files:**
- Modify: `frontend/src/components/loot/LogWeekGrid.tsx` (`GridCell` :154-199, cell wiring in the table body :268-306, one `ContextMenu` mount at grid root)
- Modify: `frontend/src/components/loot/LogWeekGrid.test.tsx` (append describes)

**Interfaces:**
- `LogWeekGridProps` gains (OPTIONAL in this task, tightened to required in Task 6 — the same-PR
  green-commit compromise, mirroring D4's shim rule):

```ts
onCopyEntryLink?: (ref: LogGridEntryRef) => void;
onJumpToPlayer?: (playerId: string) => void;
onDeleteEntry?: (ref: LogGridEntryRef) => void;
```

- `GridCell` internally receives `onJumpToPlayer` + the grid's memoized `playerMap`, plus
  per-cell closures `copyLink` and `requestMenu(e)`, and the shared `altHeld` boolean (from ONE
  `useAltHeld()` call at the `LogWeekGrid` top level, passed down — not one hook instance per
  cell). **The jump gate lives in `GridCell`, stated so no implementer guesses (director
  F-15):**

```ts
const jump = newest && onJumpToPlayer && playerMap.has(newest.recipientPlayerId)
  ? () => onJumpToPlayer(newest.recipientPlayerId)
  : null;
```

  This single gate — one `playerMap` lookup, no re-resolution in `FloorSection` — is what makes
  the "affordance exists only when the target does" claim true, matching `Roster.tsx:361`'s own
  `players.some(...)` guard on the consuming side.

**Behavioral contract (filled interactive cells only):**

```tsx
onClick={(e) => {
  if (e.shiftKey) { copyLink(); return; }            // R-18: Shift copies
  if (e.altKey)   { if (jump) jump(); return; }      // R-18: Alt jumps; no target → no-op
  onFilled(newest);                                  // plain + AT (detail===0): edit (D6-c)
}}
onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); requestMenu(e); }}
```

- Cursor: the cell `Button`'s className gains `${altHeld && jump ? 'cursor-pointer' : ''}` — the
  C4 swap, gated on a live target.
- Context menu: ONE `ContextMenu` mount at the grid root, local state
  `{ x: number; y: number; ref: LogGridEntryRef; jumpPlayerId: string | null } | null`; anchor
  computed with `jumpMenuAnchor(e, e.currentTarget.getBoundingClientRect())` (import from
  `components/roster/rosterLedgerJumps`) so Shift+F10/menu-key anchors to the cell. Items, in
  order (R-18): `Edit` → `onFilled(newest)` · `Copy link` → `onCopyEntryLink(ref)` ·
  `Jump to {recipientName}` (only when `jumpPlayerId`) → `onJumpToPlayer(id)` · separator ·
  `Delete` (danger) → `onDeleteEntry(ref)`. All cells with the menu are already `canEdit`-gated
  (interactive branch), so no per-item gating is needed beyond the jump's.
- Empty interactive cells: modifiers are no-ops (D6-h) — `onClick` returns early when
  `e.shiftKey || e.altKey`; no context menu.

- [ ] **Step 1: Write the failing tests** (append `describe('D6 modifier layer')`):

```tsx
// Mouse-path tests PIN detail: 1 (director F-14) — fireEvent.click defaults to detail: 0,
// which is the AT path; the C4 precedent is RosterGearTable.test.tsx:381,523.
it('Shift+Click copies and does NOT open the edit door', () => {
  const onEditGear = vi.fn(); const onCopyEntryLink = vi.fn();
  render(<LogWeekGrid {...baseProps({ lootLog: [ears], onEditGear, onCopyEntryLink })} />);
  fireEvent.click(cellButton('Ears'), { shiftKey: true, detail: 1 });
  expect(onCopyEntryLink).toHaveBeenCalledWith({ kind: 'loot', entry: ears });
  expect(onEditGear).not.toHaveBeenCalled();
});

it('Alt+Click jumps to the recipient and does NOT edit', () => { /* { altKey: true, detail: 1 }; onJumpToPlayer with ears.recipientPlayerId; onEditGear not called */ });

it('Alt+Click is a no-op when the recipient is not on the roster', () => {
  // { altKey: true, detail: 1 } on an entry whose recipientPlayerId matches no player:
  // neither jump nor edit fires
});

it('an unmodified synthetic click (detail: 0, no altKey) edits — the AT route never jumps (D6-c)', () => {
  fireEvent.click(cellButton('Ears'), { detail: 0 });
  expect(onEditGear).toHaveBeenCalledWith(ears);
  expect(onJumpToPlayer).not.toHaveBeenCalled();
});

it('cursor-pointer appears only while Alt is held AND a jump target exists', () => {
  // fireEvent.keyDown(window, {key:'Alt'}) → cellButton class contains cursor-pointer;
  // keyUp → it does not; and an unresolvable-recipient cell never gains it while Alt held
});

it('right-click opens the menu with Edit/Copy link/Jump/Delete and menu-key anchors to the cell', () => {
  fireEvent.contextMenu(cellButton('Ears'));
  expect(screen.getByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: `Jump to ${tankOne.name}` })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
});

it('menu Delete calls onDeleteEntry with the newest ref', () => { /* … */ });
it('the Jump item is absent when the recipient is unresolvable', () => { /* … */ });
it('Shift/Alt clicks on an EMPTY interactive cell are no-ops (D6-h)', () => {
  fireEvent.click(cellButton(/Log Neck/), { shiftKey: true });
  fireEvent.click(cellButton(/Log Neck/), { altKey: true });
  expect(onAssignGear).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify they fail** — paste output.
- [ ] **Step 3: Implement** per the contract. One `useAltHeld()` at `LogWeekGrid` top level.
- [ ] **Step 4: Run to green** — including the F-4 aria-hidden sweep and every pre-existing test.
- [ ] **Step 5: Deletion-trace (execute, paste output):** (i) remove the `e.shiftKey` early
  return → the Shift test must FAIL (edit fires); restore. (ii) change the Alt gate to also
  fire on `detail === 0` (the C4 shape) → the D6-c test must FAIL; restore. (iii) hardcode
  `altHeld` true → the cursor test must FAIL; restore.
- [ ] **Step 6: Commit** — `feat(v2): Log grid cell modifier layer — Shift copy, Alt jump, context menu (D6 Task 3)`

---

### Task 4: Cell anatomy — chip trigger, hover-×, tooltips, accessible names

**Files:**
- Modify: `frontend/src/components/loot/LogWeekGrid.tsx` (`GridCell` markup)
- Modify: `frontend/src/components/loot/LogWeekGrid.test.tsx` (append; NAMED updates to existing multi-entry expectations)

**Interfaces:** consumes Task 2's `LogCellEntriesMenu` and Task 3's handlers. No new grid props.

**Behavioral contract:**

1. **Anatomy.** A filled interactive cell's `<td>` renders:

```tsx
<span className="group flex items-center gap-1">
  <Tooltip content={<CellTeachingTooltip canJump={jump != null} />} delayDuration={400}>
    <Button variant="ghost" size="sm" className="flex-1 justify-start …" aria-label={label} onClick={…} onContextMenu={…}>
      {/* RecipientBadge only — the chip is no longer inside the button */}
    </Button>
  </Tooltip>
  {entries.length > 1 && <LogCellEntriesMenu entryRefs={…} … onEdit={editRef} />}
  <IconButton aria-label={`Delete ${label} entry for ${recipient.name}`}
    icon={<X className="h-3 w-3" />} variant="ghost" size="sm"
    className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
    onClick={() => onDeleteEntry(newestRef)} />
</span>
```

   No button nests inside another; the F-4 sweep must stay green (the wrapper span is not
   aria-hidden). **Per R-D6b (ruled)**, this same sibling row gains a fourth control: a
   hover/focus-revealed kebab `IconButton` (`aria-label={`${label} entry actions`}`, same
   `opacity-0 focus-visible:opacity-100 group-hover:opacity-100` reveal as the ×) opening the
   SAME menu items Task 3's right-click opens — one items list, two triggers, the RosterCard
   `useRosterCardActions` shape in miniature (anchor the kebab-opened menu to the kebab's rect
   via `jumpMenuAnchor`). The kebab ships in **D6a** (menu family); the hover-× ships in D6b. Empty interactive cells keep the single-Button shape + a one-line tooltip
   (`Click to log {label}`). Read-only cells: unchanged, except the sr-only sentence for a
   multi-entry cell becomes `` `${label}: ${recipient.name}, ${n} entries` `` (D6-l).
2. **Accessible-name fold-in (the D5-owed defect):** the main button's `aria-label` for a
   multi-entry cell becomes `` `Edit ${label} for ${recipient.name} — ${floorName} (newest of ${n})` ``;
   single-entry cells keep the exact D5 formula. The ×N count is thereby announced on BOTH
   controls (main button + chip trigger).
3. **Teaching tooltip** (R-27, re-expressed): rows as `<kbd className="rounded bg-surface-base px-1 py-0.5 font-mono text-xs">` +
   muted description — `Click` "Edit entry" · `Shift+Click` "Copy link" · `Alt+Click`
   "Go to player" (only when `canJump`) · `Right-click` "More options".
4. **Hover-× deletes the NEWEST entry** (older entries: via the chip menu → edit door, or
   History — a recorded interim, same shape as D5's edit-newest).

- [ ] **Step 0: Rebuild the test harness FIRST (director F-1 — blocker).**
  `primitives/Tooltip.tsx:43-48` calls `useDevice()` → `window.matchMedia`, which jsdom does
  not implement, and Radix `Tooltip` throws without a `TooltipProvider`. The moment the cell
  `Button` is wrapped in `<Tooltip>`, every existing `LogWeekGrid.test.tsx` test throws. Before
  any new test: (a) add a top-level `beforeEach` matchMedia stub in the **NeedMatrix shape**
  (`NeedMatrix.test.tsx:12-23` — `matches: query === '(hover: hover) and (pointer: fine)'`;
  the `FloorCard.test.tsx:56-62` shape with `matches: false` makes Tooltip a passthrough and
  the hover assertions can never pass); (b) introduce a `renderGrid(props)` helper that wraps
  every render in `<TooltipProvider>` (`NeedMatrix.test.tsx:83-94` precedent) and migrate
  existing renders to it. This is sanctioned test-edit class (3). Run the EXISTING suite green
  under the new harness before writing new tests — that green run is the gate that the harness
  rewrite changed no behavior.

- [ ] **Step 1: Write the failing tests** (append `describe('D6 cell anatomy')`):

```tsx
it('multi-entry: chip is a sibling button, not nested in the edit button', () => {
  render(/* two ears entries */);
  const edit = screen.getByRole('button', { name: 'Edit Ears for Healer One — M9S (newest of 2)' });
  const chip = screen.getByRole('button', { name: '2 entries for Ears — M9S' });
  expect(edit).not.toContainElement(chip);
});

it('multi-entry accessible name folds the count in (D5-owed fix)', () => { /* the name above exists; single-entry name has no suffix */ });
it('chip menu item click opens the edit door for the OLDER entry', async () => {
  // open chip menu, click item 2 → onEditGear called with the older entry object
});
it('hover-× requests deletion of the newest entry and is focus-revealable', () => {
  const del = screen.getByRole('button', { name: 'Delete Ears entry for Healer One' });
  expect(del.className).toContain('focus-visible:opacity-100');
  fireEvent.click(del);
  expect(onDeleteEntry).toHaveBeenCalledWith({ kind: 'loot', entry: newest });
});
it('filled cells carry the teaching tooltip; the Alt row is omitted when no jump target', () => {
  // Radix opens on FOCUS immediately (no delay) — fireEvent.focus(cellButton) then
  // await screen.findByText('Copy link'); mirror NeedMatrix.test.tsx's tooltip idiom.
  // An unresolvable-recipient cell's tooltip lacks 'Go to player'.
});
it('read-only multi-entry sr-only sentence includes the count', () => { /* `Ears: Healer One, 2 entries` */ });
it('the aria-hidden flex/grid sweep still passes over the new anatomy', () => { /* re-run the F-4 generic sweep against a fully-populated grid */ });
```

- [ ] **Step 2: Named existing-test updates ONLY:** (a) multi-entry aria-label string
  expectations gain ` (newest of N)`; (b) any query that located the chip INSIDE the cell button
  now finds it as a sibling. List each edited assertion in the task report. Run the suite —
  new tests FAIL, updated ones documented. Paste output.
- [ ] **Step 3: Implement** per the contract.
- [ ] **Step 4: Run to green.**
- [ ] **Step 5: Deletion-trace (execute, paste output):** (i) revert the fold-in (drop the
  suffix) → the fold-in test must FAIL; restore. (ii) point the hover-× at `entries[entries.length-1]`
  → the newest-ref test must FAIL; restore. (iii) remove `focus-visible:opacity-100` → the
  reveal test must FAIL; restore.
- [ ] **Step 6: Commit** — `feat(v2): Log grid cell anatomy — ×N menu route, hover-×, teaching tooltips (D6 Task 4)`

---

### Task 5: Floor-header kebab — "Log floor"

**Files:**
- Modify: `frontend/src/components/loot/LogWeekGrid.tsx` (`FloorSection` header :226-233)
- Modify: `frontend/src/components/loot/LogWeekGrid.test.tsx` (append)

**Interfaces:**
- `LogWeekGridProps` gains `onLogFloor?: (floor: FloorNumber) => void` (tightened in Task 6).

**Behavioral contract:** when `canEdit && onLogFloor`, the header row gains a right-aligned
(`ml-auto`) kebab: `Dropdown` > `DropdownTrigger` > `IconButton aria-label={`${floorName} actions`}
icon={<MoreVertical className="h-4 w-4" />} variant="ghost" size="sm"` >
`DropdownContent align="end"` > `DropdownItem icon={<ClipboardList …/>} onSelect={() => onLogFloor(floorNumber)}`
with label **`Log floor`** (R-25: not a standing button; D7 adds this floor's resets to this
same menu). No kebab renders read-only.

- [ ] **Step 1: Write the failing tests:** kebab present per floor with the floor-scoped
  accessible name (`'M9S actions'` / `'Floor 3 actions'` fallback); `Log floor` item calls
  `onLogFloor(2)` for floor 2 (drive the floor apart from 1); absent when `canEdit=false`;
  absent when `onLogFloor` not passed. **Open the menu with
  `fireEvent.keyDown(trigger, { key: 'Enter' })` + `await findByRole('menuitem', …)`** — the
  Radix jsdom idiom (director F-9; `Loot.test.tsx:803-804`); `fireEvent.click` does not open a
  Radix dropdown.
- [ ] **Step 2: Run to verify they fail** — paste output.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to green** (incl. the F-4 sweep — `MoreVertical` renders inside `IconButton`,
  already compliant).
- [ ] **Step 5: Deletion-trace (execute, paste output):** hardcode `onLogFloor(1)` → the
  floor-2 test must FAIL; restore.
- [ ] **Step 6: Commit** — `feat(v2): Log grid floor-header kebab with "Log floor" (D6 Task 5)`

---

### Task 6: `Loot.tsx` wiring — links, jumps, delete, highlight, count bar + legend

**Files:**
- Modify: `frontend/src/components/loot/Loot.tsx` (grid mount :734-765, new callbacks, `?entry=` effect, count bar/legend mount)
- Modify: `frontend/src/components/loot/LogWeekGrid.tsx` (props tighten to REQUIRED: `onCopyEntryLink`, `onJumpToPlayer`, `onDeleteEntry`, `onLogFloor`, plus new required `highlightEntry: { kind: 'loot' | 'material'; id: number } | null`)
- Modify: `frontend/src/components/loot/Loot.test.tsx` (append)
- Modify: `frontend/src/components/loot/LogWeekGrid.test.tsx` (highlight-prop describes, append)

**Interfaces:**
- Consumes: Task 3-5 props; `logWeek.week` (displayed), `clock.currentWeek`;
  `requestDelete(item)` (existing, `Loot.tsx:475-477`); `setWizardState({floor})` (existing);
  the A10 clipboard shape; `LootCountBar` (default export, `history/LootCountBar.tsx`) and
  `LootFairnessLegend` (named export, `history/WeeklyLootGrid.tsx`) — **imported unmodified**.
- Produces (`logWeekGridData.ts`) — **the DOM-id contract has ONE author (director F-2,
  blocker):**

```ts
export const logCellDomId = (ref: LogGridEntryRef): string =>
  `log-cell-${ref.kind}-${ref.entry.id}`;
```

  `Loot.tsx`'s scroll effect and `LogWeekGrid`'s cell wrapper BOTH consume this helper — the
  string literal appears in exactly one place. (The shipped History path has the drift-prone
  split this forbids: `LootHistoryTable.tsx:84-85` vs `LootEntryRow.tsx:80` each compose
  `loot-entry-${id}` independently.)

- Produces (`Loot.tsx`): a file-local `buildEntryLink` shared by BOTH copy paths (director
  F-17 — `copyLink` at `:461-473` is refactored onto it; two ~12-line near-clones in one file
  is a drift hazard §2.2's discipline forbids):

```ts
const buildEntryLink = (opts: { lview: 'log' | 'history'; week?: number; ref: LogGridEntryRef }) => {
  const url = new URL(window.location.href);          // keeps ?tier=
  url.searchParams.delete('shell');
  url.searchParams.set('tab', 'gear');
  url.searchParams.set('lview', opts.lview);
  if (opts.week != null) url.searchParams.set('week', String(opts.week));
  else url.searchParams.delete('week');               // History links strip the week (shipped ruling)
  url.searchParams.set('entry', String(opts.ref.entry.id));
  if (opts.lview === 'log' || opts.ref.kind === 'material')
    url.searchParams.set('entryType', opts.ref.kind); // Log: ALWAYS set (R-18 note 1); History keeps its shipped omit-for-loot shape
  else url.searchParams.delete('entryType');
  return url.toString();
};
const copyLogEntryLink = (ref: LogGridEntryRef) => {
  navigator.clipboard.writeText(buildEntryLink({ lview: 'log', week: logWeek.week, ref })).then(
    () => toast.success('Link copied'), () => toast.error("Couldn't copy the link"));
};
const jumpToRecipient = (playerId: string) => setSearchParams((prev) => {
  const params = new URLSearchParams(prev);
  params.set('tab', 'roster'); params.set('player', playerId);
  params.delete('entry'); params.delete('entryType');
  params.delete('book');   // one navigation, one highlight — RosterCard.tsx:289-292 (director F-18)
  return params;
});
const deleteFromGrid = requestDelete;   // literal wiring — LogGridEntryRef IS HistoryItem (F-12), no adapter, no cast
```

- **Log `?entry=` consumption (D6-k, F-10-sharpened):** a `Loot.tsx` effect active only when
  `lview === 'log'`, re-expressing `LootHistoryTable.tsx:60-103`'s contract: parse
  `entry`/`entryType` (default `'loot'`), validate against the UNFILTERED log **matching the
  type** (a loot id arriving as `entryType=material` → `null`, and vice-versa —
  `LootHistoryTable.tsx:72-77`); if the entry resolves but
  `entry.weekNumber !== logWeek.week`, call `logWeek.setWeek(entry.weekNumber)` first (the
  wizard `onSuccess` precedent, `Loot.tsx:882`) so the link never dead-scrolls; then derive
  `highlightEntry`, `setTimeout(100)` →
  `document.getElementById(logCellDomId(ref))?.scrollIntoView({behavior:'smooth', block:'center'})`,
  `setTimeout(2500)` → strip both params via the **functional**
  `setSearchParams(prev => …, { replace: true })` form (`LootHistoryTable.tsx:91-96` — never
  clobbers `useLogWeek`'s `?week=` mirror); both timers cleaned up. `LogWeekGrid`: the cell
  wrapper span holding the highlighted entry gets `id={logCellDomId(ref)}` and
  ` highlight-pulse` appended (the shared class, exact `LootEntryRow.tsx:80-83` idiom).
- **Count bar + legend:** rendered directly below the grid on the log view:
  `<LootCountBar players={players} lootLog={lootLog} currentWeek={logWeek.week} />` then
  `<LootFairnessLegend />` (D6-g; §4 mockup order).
- **Kebab wiring:** `onLogFloor={(floor) => setWizardState({ floor })}` — no new wizard props;
  `writeWeek` (`Loot.tsx:539`) already resolves to `logWeek.week` while `lview==='log'`.

- [ ] **Step 1: Write the failing tests** (`Loot.test.tsx`, prop-capturing `LogWeekGrid` /
  `LogWeekWizard` mocks per the D5 precedent; **drive `logWeek.week` ≠ `clock.currentWeek` in
  every week assertion**):

```tsx
it('copy link builds a Log-shaped URL: lview=log, week=displayed, entryType always set, shell stripped, tier kept', async () => { /* displayed wk 2, clock wk 5; assert exact URL string */ });
it('jump writes tab=roster&player={id} and clears entry params', () => { /* setSearchParams result */ });
it('grid delete routes into the existing requestDelete → confirm modal state', () => { /* deleteTarget set; modal renders */ });
it('kebab Log floor opens the ONE wizard with the DISPLAYED week and that floor', () => {
  // captured LogWeekWizard props: currentWeek === 2 (displayed; clock is 5), initialFloor === 3, singleFloorMode
});
it('?entry= on the log view: valid id → highlightEntry passed down, params self-clear with replace after 2.5s', () => { /* vi.useFakeTimers; assert the strip used the functional form by also asserting ?week= survives */ });
it('?entry= pointing at no known entry passes null and never strips params', () => { /* … */ });
it('CROSS-TYPE: a real loot id arriving with entryType=material yields null — and vice-versa (F-10a)', () => {
  // ids are independent sequences (R-18 note 1); use a loot id that does NOT exist in materialLog
});
it('OUT-OF-WEEK: an entry in week 4 while displaying week 2 calls logWeek.setWeek(4) before highlighting (F-10b)', () => { /* … */ });
it('count bar + legend render under the grid with the displayed week', () => { /* LootCountBar receives currentWeek=2 while clock=5; legend text 'Loot fairness:' present */ });
```

  Plus `LogWeekGrid.test.tsx` (append; `baseProps()` gains the five now-required props incl.
  `highlightEntry: null` — sanctioned edit class 4): `highlightEntry` renders the pulse class
  on the matching cell only; `null` renders neither; and **the cross-file id contract test
  (F-2):** render the real grid with a highlighted ref and assert
  `document.getElementById(logCellDomId(ref))` resolves to the pulsed wrapper — the same
  helper both sides consume.
- [ ] **Step 2: Run to verify they fail** — paste output.
- [ ] **Step 3: Implement**; tighten the five grid props to required (TS enforces every mount
  wires them — the countermeasure to "tests pass with the feature deleted" for wiring).
- [ ] **Step 4: Run the full loot suite to green.**
- [ ] **Step 5: Deletion-trace (execute, paste output):** (i) hardcode the copy-link week to
  `clock.currentWeek` → the URL test must FAIL (weeks were driven apart); restore. (ii) pass
  `clock.currentWeek` to `LootCountBar` → the count-bar test must FAIL; restore. (iii) drop
  `{ replace: true }` from the self-clear → the self-clear test must FAIL; restore.
  (iv) **swap the two validation lookups** (validate loot ids against `materialLog` and
  vice-versa) → the cross-type test must FAIL (F-10a); restore. (v) **change `logCellDomId`'s
  prefix** (`log-cell-` → `log-entry-`) → the cross-file id contract test must FAIL (F-2);
  restore.
- [ ] **Step 6: Commit** — `feat(v2): Log grid affordance wiring — deep links, jumps, delete, count bar (D6 Task 6)`

---

### Task 7: Records, write-backs, release note, gate

**Files:**
- Modify: `frontend/src/components/loot/Loot.tsx` (:89-98 header comment: remove the discharged D6 rows, keep D7/D11/D12)
- Modify: `frontend/src/components/loot/LogWeekGrid.tsx` (header doc comment: F-14i interim removed, affordance layer documented)
- Modify: `design/redesign/specs/phase-d-loot-design.md` (build notes)
- Modify: `frontend/src/data/releaseNotes.ts` (internal entry)

- [ ] **Step 1: Header-comment rewrites** — the two files' doc comments describe the shipped
  affordance layer; no comment may still call the ×N chip a "count with no route."
- [ ] **Step 2: Design-record build notes (dated, under each ruling):** R-18 — shipped; the
  interim card-level destination stated (D12 retargets); D6-c's detail-0 refinement recorded
  (primary-action controls: AT activation = primary action, menu = AT jump route); D6-h
  empty-cell no-ops. F-14i closure note under the re-expression deltas. R-23 — per the D6-n
  ruling: if imported, the count bar's sub-12px text (`LootCountBar.tsx:89,99,104,117` —
  `text-[10px]` ×3, `text-[9px]` ×1) recorded as a **named, disclosed interim** on an imported
  frozen leaf, follow-up ledgered beside the index.css rule-narrowing item; count bar reads the
  displayed week (D6-g). R-25 — kebab-only, wired through the one wizard, displayed-week
  initial (user can still change it in the wizard, same as R-7). R-27 — tooltip at `text-xs`
  (12px-floor correction), hover-× routed through the existing confirm modals (legacy parity,
  `SectionedLogView.tsx:901-906` + `:262-275`), the revert-gear **checkbox** delta named
  (legacy always reverts; v2 offers the choice, `Loot.tsx:952-968`), and the `focus-visible`
  reveal added (D6-e delta). D6-a/D6-b/D6-n rulings recorded with whatever the user decided.
- [ ] **Step 2b: §5 open-item row (director F-3):** add to
  `design/redesign/specs/phase-d-loot-plan.md` §5 the D6-l row — "v2 Log grid read-only cells
  stay inert; legacy grants viewers copy/jump/menu on entry presence alone
  (`WeeklyLootGrid.tsx:584-609,621`); viewer copy/jump is a possible follow-up slice" — so the
  divergence has a durable home beyond this plan and the PR body.
- [ ] **Step 3: Release note** — `internal: true`, `CURRENT_VERSION` untouched, `prTitle` per
  pr-checklist skill (invoke it before opening the PR).
- [ ] **Step 4: Full local gate** — `pnpm build` (tsc -b) · `pnpm lint` ·
  `pnpm check:design-system:strict` · `pnpm dupes` · `pnpm tokens:check` · `pnpm deadcode`
  (vs captured baseline) · `pnpm test`. Plus greps: `FLOOR_COLORS` absent from v2-authored
  files; no `text-[7-11px]` in new code.
- [ ] **Step 5: Commit** — `docs(v2): D6 write-backs — F-14i closed, R-18/23/25/27 build notes`

---

## Definition of done (slice level)

1. All task suites + the full local gate green (commands in Task 7 Step 4).
2. **Live browser demonstration (both shells, `?shell=v2`, desktop), evidence-first:** plain
   click edits · `Shift+Click` → paste the URL into a cold tab → lands on Log, right week,
   cell pulsed, params self-clear · `Alt+Click` → roster card pulse (and Alt+Enter from
   keyboard) · Alt-held cursor swap visible · right-click AND Shift+F10 open the cell menu;
   every item exercised, Delete lands in the confirm modal · ×N chip → menu → editing an OLDER
   entry round-trips · hover-× (mouse) and Tab-focus reveal (keyboard) · floor kebab "Log
   floor" opens the wizard on the **displayed** week (demonstrate with displayed ≠ clock) ·
   count bar + legend under the grid · teaching tooltip renders at 12px+.
3. **V1 safety, two-part:** (a) `git diff --stat` over legacy-only paths (all of
   `components/history/`, `player/GearTable.tsx`, V1 panels) empty; (b) PR-body statement that
   no §2.1 file is touched, with the touched-file list and `RosterGearTable.tsx`'s v2-only
   reach cited as **assertion + evidence** (director F-6): `phase-d-loot-design.md:1122` PLUS
   the verified four-hop chain — `RosterGearTable` ← `RosterCard.tsx` (sole importer) ←
   `RosterCards.tsx:71` ← `Roster.tsx:45` ← `NewShell.tsx:12`; V1's table is
   `player/GearTable.tsx`. The parity statement also names the D6-l viewer-affordance
   divergence (F-3).
4. Screenshots embedded in the PR (dark primary, light spot-check).
5. `pnpm dupes` green; FLOOR_COLORS/tiny-text greps clean over v2-authored files.
6. Release note present (internal); design-record write-backs landed in the same PR; the
   D6-a/D6-b user rulings recorded in this plan's vet record and the PR body.

## Out of scope (named so the ledger cannot drift)

D7 (Books card re-home; floor/player resets joining the floor kebab; `LootResetMenu` on the
displayed week) · D11 (History row affordances; arbitrary-entry delete — the grid's hover-× and
menu delete target the newest entry only, a named interim) · D12 (slot-level anchors,
`highlightedSlot` pulse, R-28's week-split jump destinations — D6's jump is card-level
`?player=` by explicit interim) · D14 (keyboard shortcuts incl. `Alt+L`/`Alt+U`; the shared
help/palette) · Phase P (mobile; legacy's long-press menu route is mobile-only behavior and
lands there) · the index.css aria-hidden rule narrowing (standing follow-up) · extracting the
copy-deep-link clipboard shape into a **cross-file** shared util (ledgered follow-up — the
in-file `buildEntryLink` dedup in `Loot.tsx` IS this slice's scope, director F-17) · the
`ui/Select` effect-ordering race (standing follow-up) · read-only viewer cell affordances
(D6-l divergence — §5 row added in Task 7, possible future slice) · the imported count bar's
sub-12px text remediation if D6-n rules Import (ledgered beside the index.css item) ·
`eslint.config.js` `a11yRecommendedWarn` mapping fix (phase-level chore).
