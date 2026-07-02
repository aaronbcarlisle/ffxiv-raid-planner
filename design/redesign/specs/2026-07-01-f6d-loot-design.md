# F6d — Loot (Priority ⇄ History) — Design Spec

> **Status:** authored by the autonomous run 2026-07-01 · **awaiting async user skim (AUTONOMOUS_RUN §4 pause)** · **two sequential PRs** off `redesign/foundation` (`d8360e3`): `redesign/f6d-priority` → squash-merge, then `redesign/f6d-history` → squash-merge. Implementation plans written separately (writing-plans) per PR from this shared spec.
>
> **Authority docs:** `docs/PRODUCT_MODEL.md` (§3.2 week = both loot + session unit; §5 Ring-0 loot inventory; §7 step 2 "one logging model, one recipient picker"), `design/redesign/REDESIGN_SPEC.md` §5.3 (the Loot blueprint) + §7 (re-home map) + §9.3 (flow invariants) + §10 (glossary), `design/redesign/specs/f5-screen-components-map.md` (Loot-Priority + Loot-History element tables, catalog #18–#23/#25 — this slice's build manifest), `design/redesign/FOUNDATION_ROADMAP.md` §2.1 (F6d row), mockups `03-loot-priority.html` + `03-loot-priority-with-picker.html` + `03-loot-history.html` (visual targets). The F6c spec/plans are the template for how a slice is specced/executed.

---

## 1. Goal & scope

Build the **redesigned Loot screen** — "*who's up next, and the record of what's dropped*" — as **two sub-views on one axis**: **Priority** (default; the in-raid moment, per-floor drop rows with ranked queues) ⇄ **History** (the transparent record, week-grouped, with fairness at a glance). Wire it behind `?shell=v2` as the **`gear` slot** on `GroupViewContent` (the Spine already labels the `gear` PageMode "Loot"), exactly the seam F6b/F6c used. This slice is also the **week-clock owner**: it builds the shared week object (`useWeekClock`) that F6e (Schedule) consumes, and it wires the **`need.up`** priority highlight reserved in f6c-board.

**Two-PR structure (locked):**
- **`f6d-priority`** (~11–12 tasks): the v2 `<Loot/>` assembly + `gear`-slot wiring + the enabling refactor (§3.2); the **Priority** view (`FloorCard`/`FloorDropRow` + shared `PriorityRow`); the **unified `RecipientPicker`** (gear + weapon drop logging); `useWeekClock` + `WeekScopeControl` (+ the one additive backend field, §6.3); the promoted `enhanceEntries` util (sanctioned repoint); `LootAdjustmentsModal` (the re-homed "Adjust Priority"); the F4 `WeaponPriorityBridge`. Ships Priority as the only v2 loot view — **no view toggle yet**.
- **`f6d-history`** (~10–11 tasks): the `SegmentedToggle` (Priority⇄History) + the **History** view (`FairnessSummary`, `LootHistoryTable` = `WeekGroupHeader` + `LootEntryRow`, filter pills) + **`BookLedgerCard`** (the re-homed "Edit Books" home, reusing the three book modals) + `RecipientPicker` edit mode + LogWeekWizard/"Log a drop" toolbar wiring + Reset menu + **`need.up`** (util + GearBoard/Cell/legend wiring) + housekeeping (contrast harness on the loot screen, suppressions prune, release note).

**In scope (the full mocked Loot):** the two-view screen; per-floor cards F4→F1 with drop rows (gear + upgrade materials + ranked queues + Assign); the unified recipient picker (scope tabs · search · ranked reasons · need tags · confirm); the fairness strip; the week-grouped history table with source badges, recipient identity, reason tags, per-row kebab (edit/copy-link/delete); the week clock (current/max week, start-next-week, revert, week date ranges); books (balances table + adjust + player ledger + mark-floor-cleared, by reuse); loot/priority adjustments (canManage); the `need.up` Board highlight + legend swatch.

**Out of scope (deferred, each with an explicit home):**
- **Materials-picker unification** — material drop rows open the existing `QuickLogMaterialModal` (reuse, F6c kebab doctrine). Folding materials into `RecipientPicker` is a follow-up once the gear picker has soaked. (F5 #18 only consolidates the two gear-drop forks.)
- **LogWeekWizard rebuild** — retained as-is and invoked from the toolbar (F5: "wizard retained"; F6b already routes Home's CTA here). GearStep-delegates-to-RecipientPicker is a post-flip refinement.
- **`Sync` sub-tab (`GearSyncDashboard`)** — not loot-domain (plugin gear-sync). Stays reachable on legacy until the flip; **the parity-flip slice must give it a disposition** (recommend the F6c Characters-style temporary bridge, or a Board affordance). Recorded in the re-home ledger (§6.4).
- **`Stats` sub-tab (`TeamSummaryEnhanced`)** — its loot-fairness content is absorbed by `FairnessSummary`; its team-gear content already lives on F6b Home / the F6c Board. Retired at flip; no v2 rebuild.
- **WhoNeedsItMatrix** — retired-IA (F5): the capability ("who needs this slot") is first-class in `FloorCard`+`PriorityRow`+picker.
- **Priority settings editors** (`priority/` Mode/Preset/Role/Job/Player editors + AdvancedOptions) — Settings-domain, already hosted in the settings panel; the v2 toolbar links to them ("Rules"), never re-hosts them.
- **Mobile FABs / LogLayoutToggle / grid⇄split⇄allWeeks layout axis** — dropped; the v2 History has ONE layout (the mockup table). Desktop toolbar buttons + responsive stacking cover mobile.
- **`?shell=v2` exposure** — stays a flag; no user-facing change.

**Non-negotiable constraints (carried from F6a–F6c):** BYTE-FOR-BYTE legacy `/group/:shareCode` (slot mechanism + `!slots?.gear` guards; the ONLY legacy edits are the two sanctioned promote-and-repoints in §6.2, test-locked, PR-body-documented); NO new `eslint-suppressions.json` entries (new code = `components/ui/` or already-ring0 `components/loot/`); NO AI attribution; internal release notes (`{internal:true}`), no `CURRENT_VERSION` bump; design system is law (tokens only, 12px floor, primitives; `check:design-system:strict` gates each PR).

---

## 2. Locked decisions (autonomous, per doctrine — listed in SESSION_HANDOFF "Decisions to ratify")

1. **The v2 Loot = Priority · History only.** The legacy 4-sub-tab surface (Log/Priority/Sync/Stats) collapses per REDESIGN_SPEC §7: Log+Priority → this screen; Stats → absorbed (FairnessSummary/Home/Board); Sync → parity-flip decision (§1). Depth budget ≤2 holds: Loot → Priority → picker.
2. **`RecipientPicker` consolidates exactly the two gear-drop forks** (`QuickLogDropModal` + `AddLootEntryModal`, absorbing `LootRecommendationCandidates`' ranked-reasons presentation). One component, three entry modes (§5.3): `assign` (fixed item context from a drop row), `log` (item pickable — the "Log a drop" toolbar path), `edit` (PR2; prefilled from an entry). Weapon logging goes through it too (weaponJob = recipient's main job; off-spec via the scope tab → `isExtra`), retiring `QuickLogWeaponModal` at flip. Materials reuse `QuickLogMaterialModal` (deferral §1).
3. **Week-clock semantics** (first real consumer of the shell week object): a **`useWeekClock(groupId, tierId)`** hook wraps `lootTrackingStore` — `{ currentWeek, maxWeek, weekStartDate, weeksWithData, weekDataTypes, rangeOfWeek(n), startNextWeek(), revertWeek() }`. **One additive backend field** — `GET .../current-week` also returns `weekStartDate` (already on the tier model; already returned by start/revert) — powers `rangeOfWeek` (the mockup's "Jun 24 – Jun 30"). The TopBar `WeekIndicator` stays read-only (no shell edit); **week mutations live in the Loot toolbar's `WeekScopeControl`** (canEdit-gated, revert double-confirmed). This resolves the F5 §C tension: the toolbar pill is a *local scope control fed by the shared clock* and the clock's mutation host — not a parallel week concept. F6e reuses `useWeekClock` for its WeekNavigatorStrip.
4. **Priority's week pill scopes the logged/pending chips + the picker's default week** — queues themselves are current-gear-state (not week-scoped), exactly like legacy. History's "All weeks ▼" pill is an independent *filter* (default: all).
5. **Books get a first-class v2 home:** `BookLedgerCard` in the History view (below the fairness strip) — players × Books I–IV balances, cell-click adjust (reuse `EditBookBalanceModal`), ledger icon (reuse `PlayerLedgerModal`), "Mark floor cleared" (reuse `MarkFloorClearedModal`), week/all-time scope toggle. Member self-service parity: members edit their own row only. This is where the F6c-re-homed **"Edit Books"** capability lands. *Mockup-plus decision* (the mockup omits books; capability parity requires a home) — documented in the PR body.
6. **"Adjust Priority" lands as `LootAdjustmentsModal`** on the Priority toolbar (canManage): per-player rows with BOTH knobs — `lootAdjustment` (−100..+100, step 5) and `priorityModifier` (−100..+100) — batch-saved via `tierStore.updatePlayer`. New v2 code (legacy `PlayerAdjustmentsModal`/`PriorityAdjustModal` untouched; both retire at flip).
7. **`need.up` = "this player is #1 in the priority queue for that slot's drop."** A tested util derives `Map<playerId, Set<GearSlot>>` from the same client-side priority fns; `GearBoard` (v2 code, freely editable) threads it to `GearBoardCell.priority`; the Board legend gains the reserved priority swatch. Rendered only when priority isn't disabled (`isPriorityDisabled(settings)`).
8. **WeaponPriorityList survives as a bridge** (`WeaponPriorityBridge` — the F6c `CharacterManageBridge` precedent): a collapsed "Weapon priorities" `LinkText` on the F4 FloorCard expands the existing component (per-job cards, tie rolls, received footer — capability preserved verbatim, zero rebuild). Visual-polish/retirement decision → holistic review.
9. **Floor cards render per-floor, F4→F1, no merged "Floors 1–2" card** (mockup simplification); a floor fully logged this week collapses to its header + "Show" `LinkText`. Fight badge = tier fight name ("M12S"); "Floor N" stays as the secondary label (glossary Fight-vs-Floor copy tension → holistic).
10. **Bulk resets are kept** (thin v2 Reset menu in the History toolbar reusing `ResetConfirmModal` + existing store actions/coordination utils) — capability parity; flagged cuttable at plan time if it bloats PR2.
11. **Two sequential PRs** (§1) — the toggle rides `f6d-history` (a toggle needs both destinations real; the F6c precedent).

---

## 3. Architecture

### 3.1 The `gear` slot (the seam, from F6a)

`GroupViewContent` already consults `slots?.gear ??` at the gear body (`GroupViewContent.tsx:947`). `NewShell`'s `ShellContent` adds the third slot, mirroring Roster:

```tsx
// ShellContent (v2 path only) — NewShell.tsx
const loot = currentGroup ? (
  <Loot group={currentGroup} tier={currentTier}
        canEdit={canEditLoot}            // owner | lead | isAdminAccess (useStaticPermissions)
        onNavigate={gv.setPageMode} />
) : undefined;
return <GroupViewContent actions={...} slots={{ overview, roster, gear: loot }} />;
```

- **Legacy untouched:** the legacy route passes no `slots` → the gear region renders exactly as today (sub-tab bar + LootPriorityPanel/HistoryView/Sync/Stats bodies).
- **Prop contract mirrors Roster:** `{ group, tier, canEdit, onNavigate }`. `<Loot/>` reads the rest from stores (`lootTrackingStore`, `tierStore` players, `staticGroupStore` settings) and `useStaticPermissions()` for the member-own-row books exception.

### 3.2 The enabling refactor (zero behavior change on legacy)

The gear body block is already slot-guarded, but gear-tab chrome outside it is not. Gate behind `!slots?.gear`:
- the **mobile controls-sheet gear sections** (`GroupViewContent.tsx:~1263–1315` loot sub-tab selector, `~1318–1367` log reset controls);
- the **`preventPageScroll`** gear conditions (`:676–677`, keyed on `gearSubTab`).
On the legacy route `slots` is undefined → `!slots?.gear === true` → byte-for-byte. The always-mounted `LogWeekWizard` (`:1372–1398`) and keyboard-shortcut modal states stay as-is (legacy-only openers); **v2 `<Loot/>` mounts its own `LogWeekWizard` instance** and owns its own modal state. **Confirm at plan time:** exact line ranges; whether any keyboard-shortcut handler needs a v2 guard.

### 3.3 Two-PR seam

`f6d-priority` lands slot wiring + enabling refactor + Priority (no toggle; `<Loot/>` renders Priority unconditionally). `f6d-history` adds `lview` URL state (`useUrlTabState('lview', ['priority','history'], 'priority')` — registered like `rview`; seeding decision stays deferred with rview's) + the `SegmentedToggle` + History. `f6d-history` branches after `f6d-priority` merges.

---

## 4. Component inventory & placement (boundary-safe)

`components/loot/` is **already ring0** — no eslint boundary change. **All new v2 loot components live in `components/loot/`**, leaving `components/history/` as legacy-only (cleaner flip deletion). Cross-screen atoms → `components/ui/` (shared, error-level DS rules).

### 4.1 Shared — `components/ui/`

| Component | PR | Purpose | Consolidates (F5) |
|---|---|---|---|
| `PriorityRow` | f6d-priority | the inline ranked chip queue (role-colored avatar chip + name + rank; first chip accent; "+N eligible" overflow) | #19 ← file-local `LootPriorityEntry` memo; **shared with Home** (future consumer) |

(`SegmentedToggle`, `PlayerIdentity`, `Tag`, `ProgressBar`, `EmptyState`, `ContextMenu`, `Modal`, `Select`, `NumberInput`, `Checkbox`, `TextArea`, `LinkText` reused as-is.)

### 4.2 Ring-0 — `components/loot/` (store-fed; composes shared + reuses ring0 legacy modals)

| Component | PR | Purpose | Reads / reuses |
|---|---|---|---|
| `Loot` | f6d-priority | assembly: `PageHeader` ("Loot" + per-view subtitle) + `LootToolbar` + active view | props + stores; owns `lview` (PR2), modal state |
| `LootToolbar` | f6d-priority | `SegmentedToggle` (PR2) + `WeekScopeControl` \| history filter pills + spacer + "Log a drop" (ghost) + "Log this week's loot" (primary) + canManage "Adjustments"/"Rules" | `useWeekClock`, settings panel opener |
| `WeekScopeControl` | f6d-priority | the week pill: "This week (Week N) ▾" — dropdown lists weeks (data-dot annotated), jump-to-week, footer actions Start next week / Revert week (canEdit, revert double-confirm) | `useWeekClock` |
| `FloorCard` | f6d-priority | per-floor card: fight badge (`Tag`) + "Floor N" + status meta + logged/pending chip; body = drop rows; collapsed state + "Show" | `FLOOR_LOOT_TABLES`, `utils/lootFairness` floor status |
| `FloorDropRow` | f6d-priority | item icon (gear-source-toned) + name/slot + `PriorityRow` queue + "Assign" `Button` (canEdit) | promoted `enhanceEntries` + `getPriorityForItem/Ring/UpgradeMaterial/UniversalTomestone` |
| `RecipientPicker` | f6d-priority (edit mode PR2) | the unified assign/log modal (§5.3) | `logLootAndUpdateGear`/`updateLootAndSyncGear`, promoted ranking util, `staticCharacterStore` |
| `LootAdjustmentsModal` | f6d-priority | per-player `lootAdjustment` + `priorityModifier` batch editor (canManage) | `tierStore.updatePlayer` (allSettled batch) |
| `WeaponPriorityBridge` | f6d-priority | collapsed F4-card section embedding legacy `WeaponPriorityList` | reuse (bridge; zero rebuild) |
| `FairnessSummary` | f6d-history | 4 stat cards: drops this tier · most/fewest · distribution verdict · this week | `utils/lootFairness` |
| `LootHistoryTable` | f6d-history | the week-grouped record: `WeekGroupHeader` + `LootEntryRow`s (loot + material merged, newest-first) | `lootTrackingStore`, `useWeekClock.rangeOfWeek` |
| `WeekGroupHeader` | f6d-history | week pill (accent when current) + date range + drop count | #23 |
| `LootEntryRow` | f6d-history | source badge (`Tag` R/T/A) + item + → + `PlayerIdentity` + reason tag + floor + when + kebab (Edit/Copy link/Delete, canEdit) | `ContextMenu`, relative-time |
| `BookLedgerCard` | f6d-history | players × Books I–IV + adjust/ledger/mark-cleared + week⇄all-time scope | **reuses** `EditBookBalanceModal`, `PlayerLedgerModal`, `MarkFloorClearedModal` |
| Reset menu (in toolbar) | f6d-history | Reset week/all loot·books·data | **reuses** `ResetConfirmModal` + store actions + `deleteLootAndRevertGear` |

**New utils/hooks (small, testable):** `hooks/useWeekClock.ts`; `utils/lootFairness.ts` (`computeTierFairness`, `deriveFloorWeekStatus`); `utils/nextUpgradePriority.ts` (`computeNextUpgradePriorities → Map<playerId, Set<GearSlot>>`, PR2); `utils/priorityEntries.ts` (§6.2 promotion).

**Boundary strategy (zero new suppressions):** everything is `ui/` or ring0 `loot/`; reused modals are ring0 (`history/`, `loot/`, `player/`); stores allowed. No ring1/ring3 imports. The settings "Rules" link goes through `useSettingsPanelStore.getState().open(...)` (a store, allowed — F6b precedent).

---

## 5. Component contracts

### 5.1 `PriorityRow` (shared, f6d-priority)
- **Anatomy:** horizontal chip queue — up to 3 `pqchip`s (role-colored avatar initials + name + `#rank`; first chip accent-dim bg + accent border + accent rank) + "+N eligible" tertiary text. Empty queue → muted "no one needs this" text.
- **Props:** `{ entries: Array<{ playerId: string; name: string; role: string; rank: number }>; maxVisible?: number /* 3 */; emptyLabel?: string }`. Presentational; no store.
- **a11y:** list semantics; rank + name as text (not color-only).

### 5.2 `FloorCard` + `FloorDropRow` (ring0, f6d-priority)
- **FloorCard anatomy:** card (surface-card/border) with raised header row — `Tag` fight badge ("M12S") + display-font "Floor 4" + tertiary meta ("in progress · drops: weapon" — slot names from `FLOOR_LOOT_TABLES`) + right chip ("N logged" success-toned when all logged / "M pending"). Body = `FloorDropRow` list (gear drops, ring1 consolidated to "Ring", then upgrade materials). Fully-logged-this-week floors render header-only + "Show" `LinkText` (expands).
- **FloorDropRow props:** `{ item: { kind: 'gear'|'material'; slot?: GearSlot|'ring'; material?: MaterialType; name: string }; entries: PriorityEntry[]; canEdit: boolean; onAssign: () => void }`. Item icon toned by gear-source/material token. "Assign" = `Button` subtle sm, **no trailing arrow** (DS §4.1). Materials' `onAssign` opens `QuickLogMaterialModal` (reuse).
- **Status derivations:** `deriveFloorWeekStatus(lootLog, materialLog, pageLedger, week, floor)` → `{ loggedCount, pendingCount, cleared }` (cleared = an `earned` ledger entry for the floor's book this week; pending = droppable items with ≥1 needer and no entry this week).

### 5.3 `RecipientPicker` (ring0; the consolidation)
- **Anatomy (mockup-faithful):** `Modal` — header: item icon + "Assign · {item}" + context line ("M12S Floor 4 · Weapon slot · raid drop") ; **scope mini-`SegmentedToggle`**: `By priority` / `All members` / `Off-spec / free`; search `Input`; label "Eligible · ranked by need + council rules"; ranked rows (rank number, accent for top · role-colored avatar · name + role dot · **reason line** · need `Tag` `BiS`/`minor`/`free` · radio check); **details disclosure** (week `NumberInput` default = clock week; method `drop`/`book` radio [log/edit modes]; "Mark {slot} as acquired" `Checkbox` default on; "Extra loot" `Checkbox` [weapons / off-spec scope]; character `Select` when registrations exist; notes `TextArea` [log/edit]); footer: note "Logging marks the drop & updates priority + BiS instantly." + Cancel + "Assign to {name}" primary.
- **Props:** `{ mode: 'assign' | 'log' | 'edit'; isOpen; onClose; groupId; tierId; players; settings; item?: DropItemContext /* fixed in assign; selectable fight+slot Selects in log */; editEntry?: LootLogEntry /* edit */; onSuccess }`.
- **Behavior:** ranking = promoted `buildRecipientEntries` (base priority + enhanced overlay when active — the configurable-caps `enhanceEntries`, ending the modals' hardcoded-caps drift); **scopes** — `By priority` = ranked needers (main roster); `All members` = everyone incl. subs, alphabetical after needers (absorbs legacy "Include Subs"/"Show all players" checkboxes, killing the "can't select that player" fork bug); `Off-spec / free` = everyone, forces `isExtra` (reason line "would be free / off-spec"). Reasons composed from need state + drop stats ("Weapon is BiS · no raid weapon yet · 0 drops this tier"). Submits via `logLootAndUpdateGear` (create) / `updateLootAndSyncGear` (edit); weapon → `weaponJob` = recipient's main job + `updateWeaponPriority`; ring resolves via `getNeededRingSlot`. Payload parity with the legacy modals is test-locked (§8).
- **a11y:** rows are a radiogroup; reason + need conveyed as text; search labeled.

### 5.4 `WeekScopeControl` + `useWeekClock`
- **`useWeekClock(groupId, tierId)`** → `{ currentWeek, maxWeek, weekStartDate: string | null, weeksWithData: Set<number>, weekDataTypes, rangeOfWeek(n): { start: Date; end: Date } | null, isCurrent(n), startNextWeek(), revertWeek() }`. Pure composition over `lootTrackingStore` (no new fetching paths; `fetchCurrentWeek` already runs in NewShell + GroupViewContent). `rangeOfWeek` = `weekStartDate + (n−1)·7d … +6d`; null when no anchor yet.
- **`WeekScopeControl` anatomy:** filter-pill trigger "This week (Week 3) ▾" (or "Week N" when scoped elsewhere) → dropdown: week list rows (`Week n` + date range + data dots) newest-first, jump on click; footer (canEdit): "Start next week" + "Revert week" (double-click-confirm; itemized-data warning reuses the existing revert-confirm pattern).
- **Backend (additive, the slice's only backend touch):** `CurrentWeekResponse` gains `weekStartDate: datetime | None` (`backend/app/routers/loot_tracking.py` GET current-week + schema); frontend type extended. Non-breaking (extra field); backend test added; documented in the PR body.

### 5.5 `FairnessSummary` (ring0, f6d-history)
- 4 `fcard` stat cards from `computeTierFairness(lootLog, players, currentWeek)`: **Drops this tier** (method='drop' count + "across N raid weeks") · **Most / fewest** (per-player counts, names in detail line) · **Distribution** ("Even" success / "Uneven" warning; spread ≤ 2 threshold, detail explains) · **This week** (count + "N pending" from floor pending sums). Substitutes excluded (legacy `LootCountBar` parity). Absorbs/retires `LootCountBar`.

### 5.6 `LootHistoryTable` + `WeekGroupHeader` + `LootEntryRow` (ring0, f6d-history)
- Card-wrapped list, weeks newest-first, filtered by the toolbar pills (week `all|n` · player · source `raid|tome|book|material`). `WeekGroupHeader`: `wk` pill ("WEEK 3", accent-dim when current, surface-interactive otherwise) + `rangeOfWeek` dates + right count. `LootEntryRow`: 30px source `Tag` (R = gear-raid / T = gear-tome / A = gear-augmented for materials) + item name + slot·source line + → + `PlayerIdentity` (compact inline) + reason `Tag` ("BiS need" success-tinted default; "free / sell" muted when `isExtra`; "aug {slot}" for materials) + floor ("M12S · F4", "—" for non-floor) + relative/short time + kebab `IconButton` → `ContextMenu` (Edit → picker edit mode / Copy link / Delete → confirm; canEdit-gated). Merged loot+material entries.
- Deep-link parity: rows carry `id` anchors; `?entry=`/`?entryType=` highlight honored (same param names as legacy).

### 5.7 `BookLedgerCard` (ring0, f6d-history)
- Card: header ("Books" + week⇄all-time `SegmentedToggle` or `Tag` filter + "Mark floor cleared" `Button` [canEdit && role !== 'member']) + table players × I–IV from `pageBalances` (subs skipped). Cell = balance `Button` (edit affordance when `canEdit || own row`); row ledger `IconButton` → `PlayerLedgerModal`. Row anchor id `book-row-{playerId}` (legacy deep-link parity).
- Reuses `EditBookBalanceModal` (delta adjust vs currently-viewed week), `PlayerLedgerModal`, `MarkFloorClearedModal` — all existing components, unmodified.

### 5.8 `need.up` wiring (PR2; v2 code only)
- `computeNextUpgradePriorities(players, settings, lootLog, materialLog)` → for each droppable gear slot (11, ring via `getPriorityForRing`), the #1 entry's `playerId` marks that `(player, slot)`. Empty map when `isPriorityDisabled(settings)`.
- `GearBoard` accepts `priorities?: Map<string, Set<GearSlot>>` and passes `priority` to `GearBoardCell` (prop exists, reserved); `Roster` computes the map (players + settings + store logs) and adds the **priority legend swatch** to `BOARD_LEGEND_ITEMS`. Cell renders the mockup `need.up` state: role-toned ring + `●` (token-only; the mockup's `role-ranged` mix maps to the player's own role token).

### 5.9 `Loot` assembly + `LootToolbar`
- `PageHeader` "Loot" + per-view subtitle (Priority: "Who's up next, and the record of what's dropped · fairness rules: {mode label}"; History: "Every drop, who received it, and why — the transparent record"). Toolbar per §4.2. `lview` via `useUrlTabState` (PR2). Keyboard: none new (legacy Alt-shortcuts stay legacy-only; holistic pass may re-add).
- **Permissions:** `canEdit` (owner/lead/adminAccess) gates Assign buttons, picker openers, week mutations, resets, mark-cleared, adjustments; books member-own-row exception per §5.7; viewers get the full read-only record (legacy parity).

---

## 6. Data flow, derivations & the re-home ledger

### 6.1 Reused (no new aggregation)
`utils/priority.ts` fns (`getPriorityForItem/Ring/UpgradeMaterial/UniversalTomestone`, `isPriorityDisabled`, `getEffectivePriorityMode`), `utils/lootCoordination.ts` (`logLootAndUpdateGear`, `updateLootAndSyncGear`, `deleteLootAndRevertGear`, `calculatePlayerLootStats`, enhanced-score fns), `utils/materialCoordination.ts`, `gamedata/loot-tables.ts` (`FLOOR_LOOT_TABLES`, `getNeededRingSlot`, `parseFloorName`, `FLOOR_COLORS`), `gamedata/costs.ts`, `lootTrackingStore` actions (incl. week + ledger + resets), the five reused modal components.

### 6.2 Sanctioned legacy edits (promote-and-repoint, test-locked, PR-body-documented)
1. **`enhanceEntries`** (`LootPriorityPanel.tsx:429–466`, the configurable-caps enhanced-priority sort) → promote verbatim to `utils/priorityEntries.ts` as `enhancePriorityEntries` + repoint `LootPriorityPanel` (behavior-neutral; existing tests + new unit tests lock it). v2 (`FloorDropRow`, `RecipientPicker`) consumes the promoted util. The modals' hardcoded-caps copies are **left as-is** (legacy-verbatim; they retire at flip) — the drift is *ended for v2*, not retro-fixed in legacy.
2. *(Conditional, plan-time)* if the recipient-option assembly in `AddLootEntryModal` (:203–294 ranking + visibility matrix) proves promotable verbatim, promote as `buildRecipientEntries`; otherwise v2 writes it fresh (audited, like the F6c kebab) — **decide at plan time, default fresh-audited** (the visibility matrix entangles modal-local state).

### 6.3 Backend additive change
`GET .../current-week` → `+ weekStartDate` (§5.4). No migration (column exists), no behavior change to other consumers (plugin ignores extra fields). Backend test asserts presence + null-before-first-entry.

### 6.4 Re-home ledger (what the legacy loot surfaces become)

| Legacy surface | F6d disposition |
|---|---|
| `gear` sub-tab bar (Log/Priority/Sync/Summary) | → `SegmentedToggle` Priority ⇄ History (Sync/Stats per §1) |
| `LootPriorityPanel` (Gear Priority sub-tab) | → `FloorCard`/`FloorDropRow`/`PriorityRow` |
| `WhoNeedsItMatrix` (Who Needs It) | **retired-IA** — capability in FloorCards + picker |
| `WeaponPriorityList` (Weapon sub-tab) | → `WeaponPriorityBridge` on the F4 card (reuse; holistic decides final form) |
| `QuickLogDropModal` + `AddLootEntryModal` (+ `LootRecommendationCandidates`) | → **`RecipientPicker`** (both forks retire at flip) |
| `QuickLogWeaponModal` | → picker weapon flow + the bridge's per-job flow; retires at flip |
| `QuickLogMaterialModal` / `LogMaterialModal` | **reused** from v2 (unification deferred) |
| `HistoryView`/`SectionedLogView`/`WeeklyLootGrid`/`AllWeeksView`/`LootLogFilters`/`FloorSection`/`LogEntryItems`/`EntryPopover` | → `LootHistoryTable` + `WeekGroupHeader` + `LootEntryRow` + toolbar filter pills (one layout) |
| `LootCountBar` | → absorbed by `FairnessSummary` |
| `WeekStepper` (+ dead `WeekSelector`/`UnifiedWeekOverview`/`LootLogPanel`/`PageBalancesPanel`) | → `WeekScopeControl` (clock) + History week filter; dead files deleted at flip |
| Books sidebar (SectionedLogView inline) | → `BookLedgerCard` (reusing the three book modals) |
| Roster-kebab **Edit Books** (re-homed by F6c) | → `BookLedgerCard` (self-serve home) |
| Roster-kebab **Adjust Priority** (re-homed by F6c) | → `LootAdjustmentsModal` (Priority toolbar, canManage) |
| `LogWeekWizard` | **reused** — "Log this week's loot" mounts it from `<Loot/>` |
| Reset dropdown | → toolbar Reset menu (reuse `ResetConfirmModal` + store actions) |
| Priority settings editors (`priority/*`) | stay in Settings; toolbar "Rules" link opens the panel |
| `Sync` (`GearSyncDashboard`) / `Stats` (`TeamSummaryEnhanced`) | per §1 (parity-flip decision / absorbed) |

No capability is lost in v2: every legacy loot action has a v2 home, a reuse, or an explicit flip-time decision.

---

## 7. Tokens

**No new tokens expected.** Reuses `gear-raid/tome/base-tome/augmented/crafted` (item icons, source badges, `need.up`), `material-*` (material rows), `accent`/`accent-dim` (active chips, week pill, top-rank), `status-success/warning` (logged chips, distribution verdict, need tags), `surface-*`/`border-*`, `membership-linked` (sub tags), role tokens (avatars, `need.up` ring). The mockups' `color-mix` uses map to existing `color-mix(... var(--color-*) ...)` patterns (sanctioned). `pnpm tokens:check` green is a per-PR gate; any genuinely new token goes through the F1 pipeline.

---

## 8. Testing & conformance

- **Per-component Vitest** for every new component/util: `PriorityRow` (ranks, overflow, empty); `FloorCard`/`FloorDropRow` (drops from loot tables, ring consolidation, chips from `deriveFloorWeekStatus`, collapse, canEdit gating); `RecipientPicker` (scope filtering incl. subs/off-spec, ranking order via promoted util, **payload parity**: submitted `LootLogEntryCreate` + coordination options match legacy `QuickLogDropModal`/`AddLootEntryModal` shapes for gear/ring/weapon/isExtra/character cases, edit-mode diffing), `WeekScopeControl` + `useWeekClock` (ranges from `weekStartDate`, null-anchor, jump, mutations call store, confirm gating); `FairnessSummary` (`computeTierFairness` cases incl. sub exclusion, even/uneven threshold); `LootHistoryTable`/`WeekGroupHeader`/`LootEntryRow` (grouping, filters, reason tags, kebab gating, deep-link highlight); `BookLedgerCard` (balances, member-own-row exception, modal wiring, `book-row-` anchors); `LootAdjustmentsModal` (batch save, ranges); `computeNextUpgradePriorities` (top-1 per slot, ring, disabled-mode empty) + `GearBoard`/`GearBoardCell` `need.up` render + legend swatch test (replacing the reserved-prop test).
- **Promotion locks:** `enhancePriorityEntries` unit tests + `LootPriorityPanel` existing tests green (repoint is behavior-neutral).
- **Slot/legacy guard:** with `slots={{ gear: <Loot/> }}` the gear region renders `<Loot/>` and the legacy sub-tab bar + mobile gear chrome are absent; without slots the gear region is **byte-for-byte** (regression lock on the `!slots?.gear` guards).
- **Backend:** pytest for the `weekStartDate` field (run locally — backend suite isn't a CI gate).
- **Gate (per PR, all green on land):** `pnpm build` · `pnpm lint` (0 err) · `pnpm check:design-system:strict` · `pnpm test` · `pnpm tokens:check` · `git diff --check` · scripts changelog test.
- **Housekeeping (f6d-history):** contrast harness re-enabled scoped to the v2 loot screen (both themes, both sub-views); `eslint-suppressions.json` loot/history-domain entries pruned if any exist (plan-time verify — most legacy debt is inline `eslint-disable`, likely another no-op like F6c).
- **Browser validation (per PR):** after first mount + final pre-PR pass — dev-auth `/api/dev-auth/login/0` → `/group/DEVTST?shell=v2&tab=gear` (+ `&lview=history`): floor cards + queues real, picker assigns a drop end-to-end (entry appears in History + gear flips on Board + priority re-ranks), week pill ranges, books adjust persists, `need.up` cells + legend, legacy `/group/DEVTST` byte-for-byte, 0 console errors.
- **Reviewer:** `redesign-reviewer` per task + final whole-branch per PR (diff-scoped dispatches). Implementers sonnet-5; **opus/fable flagged riskiest:** the enabling refactor (legacy byte-for-byte), `RecipientPicker` (consolidation correctness/payload parity), the `enhanceEntries` promotion, `Loot` assembly; haiku for mechanical sweeps.

---

## 9. Risks & spec-time confirmations

- **The enabling refactor touches shared `GroupViewContent`** — same risk class as F6c §3.2; mitigations identical (no-op guard when `slots` undefined, byte-for-byte regression test, opus implementer, PR-body note). **Confirm at plan time:** exact mobile-chrome line ranges; the `preventPageScroll` condition shape; whether `useGroupViewKeyboardShortcuts` fires gear-modal openers under v2 (if so, gate on `!slots?.gear` too).
- **`RecipientPicker` payload parity** is the correctness heart of the slice — the legacy modals encode subtle invariants (ring resolution, weapon `weaponJob`+`updateWeaponPriority`, `isExtra` excluded from gear sync, character snapshot fields, the controlled-Select recipient-injection fix). Mitigation: payload-parity tests enumerate each case against the legacy shapes; opus implementer; the picker submits through the SAME coordination utils as legacy.
- **Week-clock backend field** is the run's first backend touch — additive-only, but validate the plugin path is unaffected (extra JSON field; plugin DTOs ignore unknowns) and dev/prod parity (column exists since the loot feature shipped). Flag prominently in the PR body.
- **Enhanced-scoring duplication drift** (modals' hardcoded caps 50/45 vs configurable util): v2 uses the configurable util everywhere → v2 Priority and v2 picker always agree. The legacy modals keep their drift until flip (byte-for-byte) — a *visible* v1-vs-v2 ranking difference is possible when custom caps are configured; document in the PR body (correctness follows settings, the legacy modals were the bug).
- **Floor "pending" semantics are new derivation** (no legacy equivalent) — keep the definition conservative (§5.2) and unit-locked so the chips can't drift from the queues.
- **PR2 size** — if History + books + need.up + resets overruns, the pre-authorized cut order is: Reset menu (→ follow-up), `RecipientPicker` edit mode (rows fall back to reused `AddLootEntryModal` TEMPORARILY, flagged), week⇄all-time books scope (default all-time only). Decide at plan time.
- **`useGroupViewState` instance-locality:** v2 `<Loot/>` must not depend on GroupViewContent-instance state (wizard/modal openers) — it mounts its own wizard + modals (§3.2). Confirm at plan time that the always-mounted legacy wizard under v2 stays closed (isOpen gating) — no double-open path.

---

## 10. Self-review

- **Placeholders:** none — every component has a contract grounded in real store/util/gamedata shapes; the picker's scopes/fields enumerate the union of both legacy modals' fields; week math is pinned to the backend's anchor semantics (7-day buckets from `week_start_date`).
- **Internal consistency:** placement (§4) ↔ contracts (§5) ↔ re-home ledger (§6.4) ↔ two-PR split (§1/§2.11/§3.3) agree; `need.up` appears identically in §2.7/§5.8/§8; the week clock appears identically in §2.3/§5.4/§6.3.
- **Scope:** one screen, two F6b/F6c-sized PRs; every deferral (materials unification, wizard rebuild, Sync, Stats, matrix, settings editors, mobile FABs, layout axis) has an explicit home; the two F6c re-homed kebab capabilities land (§2.5/§2.6).
- **Ambiguity:** the picker unambiguously replaces the two forks (both retire at flip); the week pill is unambiguously a scope control + clock host (not a parallel week concept); books unambiguously live in History; open items are confined to plan-time confirmations (§9) — none reshape the design.
