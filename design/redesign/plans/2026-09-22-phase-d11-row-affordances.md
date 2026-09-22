# Phase D · D11 — History row affordances

**Branch:** `phase-d/d11-row-affordances` off `main` @ `3253d858`
**Binding authority:** `specs/phase-d-loot-plan.md:198` (the D11 row)
**Rulings implemented:** R-31, R-32, R-35 (and the D9a-k carry-forward)
**Status:** vetted — `xivrp-director` plan-vet 2026-09-22 → **APPROVE-WITH-REQUIRED-CHANGES**
(1 blocker · 6 major · 5 minor · 3 nits · 3 design-record corrections). All 15 dispositioned in
§2a; every citation below re-verified against `main` @ `3253d858` after the vet found systematic
drift in the first draft.

---

## 0. Opening position — what this slice makes honest

D9a and D9b built History's table; D10 built its search. Through all three the **row itself has
been inert** (`LootHistoryTable.tsx`'s docblock: "Rows are inert — the kebab is the only control",
D9a-i) while the tab it lives on is the one whose entire identity is *find the thing that
happened, then fix it*. D11 is the slice where a row becomes a control.

The failure this slice must not commit is the one R-31 was written against. V1 **already** has a
clickable History row, and it advertises itself dishonestly: `cursor-pointer` and `tabIndex={0}`
unconditionally (`history/AllWeeksView.tsx:551-552`) while the click is gated on `canEdit`
(`:326`) — so a viewer's rows say "activate me" eight times over and mean it zero times. It also
sets `select-none` on every row (`:551`), on the one screen whose job is reading text back. A port
of that row is a regression dressed as parity; D-55's C7 refinement is the standing rule and R-31
restates it in three numbered qualifications.

So the acceptance question for D11 is not "does the row click work" but **"does the row's
appearance predict its behaviour for both permission levels"** — and, second, whether the kebab
grew the two items R-32 names (View week N in Log · material Edit) without the menu family
splitting into two shapes.

**What exists to build on, verified on `main` @ `3253d858`:**

| Need | Already shipped | Where |
|---|---|---|
| Menu family (one items list, two triggers) | D6a/D6b/D7a/D7b | `LogWeekGrid.tsx:716-740,796,831-845`, `BookLedgerCard.tsx:160-167,396-403` |
| Keyboard-safe menu anchoring | PR #200 | `roster/rosterLedgerJumps.ts:75-83` (`jumpMenuAnchor`) |
| Alt-held cursor truthfulness | PR #191 / D6 Task 3 | `hooks/useAltHeld.ts`; one instance per grid at `LogWeekGrid.tsx:795`, consumed at `:416` |
| Material **edit** door | D5 + D8 | `Loot.tsx:1155` → `materialState.mode === 'edit'` → `QuickLogMaterialModal` (`Loot.tsx:1368-1384`) |
| Recipient jump | D6a | `Loot.tsx:681-691` (`jumpToRecipient`) |
| Log-side `?entry=` landing (week correction → scroll → pulse → self-clear) | D6a | `Loot.tsx:718-832`; the correction itself at `:797-799` |
| Shortcut guards (input focus + modal) | pre-existing | `hooks/useKeyboardShortcuts.ts:34-43,70,82` |
| Focus-ring idiom for a clickable cell in a clipped card | V1's own grid | `history/WeeklyLootGrid.tsx:577,708` |
| Search box + its own ref | D10 | `HistorySearch.tsx:120-124,133-151` |

**Nothing in this slice needs a store method, an API change or a new URL param.** It is wiring,
one menu conversion, and one shortcut registration — plus a heavy test surface, because every
line of it is a permission-shaped or modifier-shaped branch.

---

## 1. Scope

In:

- `components/loot/LootHistoryTable.tsx` — row interactivity (R-31), kebab → two-trigger
  `ui/ContextMenu` (R-32), three new props.
- `components/loot/HistorySearch.tsx` — optional `inputRef`, the `(^⇧F)` hint from §6's sketch,
  docblock.
- `components/loot/Loot.tsx` — `Ctrl+Shift+F` registration (R-35), `editMaterialFromHistory`,
  `viewWeekInLog`, the new wiring, docblock.
- `components/ui/keyboardShortcutGroups.ts` — **additive** `V2_SHORTCUT_GROUPS` export;
  `SHORTCUT_GROUPS` byte-identical.
- `components/ui/KeyboardShortcutsHelp.tsx` — one optional prop, default `[]`.
- `components/layout/Layout.tsx` — the **v2 branch's** help mount only (`:97-101`).
- `components/layout/CommandPalette.tsx` — the shortcut reference list (v2-only file, see R-D11-I).
- Tests: `LootHistoryTable.test.tsx`, `HistorySearch.test.tsx`, `Loot.test.tsx`,
  `Layout.chrome.test.tsx`, `KeyboardShortcutsHelp.test.tsx` (new), plus a checked-in mutation
  battery.
- `data/releaseNotes.ts` — one **internal** entry; `CURRENT_VERSION` unchanged (§2.5 makes D0 and
  D14 the public slices, not this one).
- Docs: this plan, `DESIGN_SYSTEM.md` §3.36/§3.37, the D11 row → BUILT, R-31/R-32/R-35 build
  notes, R-34's "half" row closed, and three design-record corrections (§2a, D-REC-1…3).

Out, explicitly:

- **The jump's destination** — R-31's Alt+Click lands **card-level** (`?player=`, the shipped
  `jumpToRecipient`) while V1's History Alt+Click is **slot-level** (`AllWeeksView.tsx:322` passes
  `row.slotRaw`/`row.slotAugmented`). R-28's slot-level anchors are **D12**. Stated, not silently
  inherited: D6 had to state the same interim for the same reason.
- `Alt+L` / `Alt+U` / `Alt+←→` / `Alt+B` and the shell-aware help/palette **split** — R-42, D14.
  D11 ships the one binding R-35 names and the minimal seam that keeps V1's help unchanged.
- Mobile affordances (long-press for the row menu, tap targets) — Phase P, standing ruling.
- `FairnessSummary`'s move Home (R-40, D14), so §6's sketch still renders one card higher than
  drawn. Unchanged by this slice.

---

## 2. Rulings taken this slice

Every row is tagged **(USER)** — ruled by the user at plan time, 2026-09-22 — or **(plan)**, which
means it falls out of a user ruling or a spec ruling and is the author's reading. In a co-design
phase the difference is load-bearing: a director re-opens a `(plan)` row, never a `(USER)` one.

| # | Ruling | Rationale |
|---|---|---|
| **R-D11-A** (USER) | **"View week N in Log" carries the entry, not just the week**: the item writes `lview=log` + `entry` + `entryType` | R-32 calls the item a cross-tab jump — "History finds the entry, Log shows its week in context". Landing on the week with the entry's own cell pulsing IS that sentence; landing on the week alone hands the user back the search they just did. V1 only changed week + layout (`SectionedLogView.tsx:1087-1090`), so this is a deliberate improvement on parity, not a port |
| **R-D11-B** (plan) | The item writes **no `?week=`** and calls **no** `logWeek.setWeek` — D6a's out-of-week correction owns the week | Two independent reasons, and the second is the stronger. **(1)** `useLogWeek` resolves `?week=` on **mount only** (`useLogWeek.ts:22-40`, and `:291,299`'s `isFirstResolve ? urlWeek : null`) and `Loot` mounts un-keyed (`NewShell.tsx:92-98`) with `lview` derived, not a key (`Loot.tsx:413`) — so a `?week=` written here is inert on the only path that would write it. **(2)** Calling `logWeek.setWeek` instead would fire a **second `setSearchParams` in the same handler**, and react-router's functional updater is bound to the `searchParams` its own reference closed over — not a live re-read (the hazard `Loot.tsx:441-465` documents at length). The two writes would build from the same snapshot and the last would clobber the first. D6a's correction (`Loot.tsx:797-799`) runs in an **effect**, a separate tick, which is why it composes. **⚠ Disclosed residual — see R-D11-N** |
| **R-D11-N** (plan) | The F2 provisional-clock guard can swallow this jump. **Disclosed, tested at the normal path, not fixed here** | `unresolvedByClock` (`Loot.tsx:772-780`) is true when `clockCeiling === 1 && foundEntryWeek !== logWeek.week`. On a genuine week-1 tier that is reachable in-app: `resolveOverride` accepts a stale `?week=5` or storage value **unclamped by design** (`useLogWeek.ts:62-72`), so the Log can display week 5 while every entry is week 1 → the highlight never resolves → no correction, no pulse, **and no self-clear**, because the 2.5s clear timer lives inside the same skipped effect (`Loot.tsx:819-826`; `:750-751` states the "params linger" consequence outright). It self-heals on a return to History, whose own highlight effect is not `lview`-gated (`LootHistoryTable.tsx:423-433`). Narrowing it means touching D6a's guard, which exists to stop a far worse clobber (the provisional-clock sentinel write) — so this joins the standing queue rather than being patched under a different slice's name |
| **R-D11-C** (USER) | The help entry ships as an **additive `V2_SHORTCUT_GROUPS`** consumed through a new optional `extraGroups` prop that only `Layout.tsx`'s v2 mount passes | R-35 requires a registry entry; the D11 row requires V1's `Shift+?` help to be unchanged; §5's open item makes the shell-aware **split** an explicit D14 decision whose default is "no V1 copy change". `Layout.tsx` already mounts the help modal **twice** — `:97-101` (v2 branch) and `:140-144` (legacy branch) — so the seam is a prop, not a mechanism. **Two interims recorded, not glossed:** (a) an append-only prop cannot express D14's stated default ("V1's rows stay, v2's reflect the new set"), so **D14 decides whether to generalise or replace it**; (b) v2's help is a **mixed-truth list** the day this lands — `Alt+1-3`, `V`, `G` (`keyboardShortcutGroups.ts:26,41-42`) are still rendered there and R-35/R-42 dropped all three for v2. D11 does not make that worse (those rows render in v2 today) but it does add one authoritative row beside them. (c) `chromeActive` excludes `/` (`Layout.tsx:70`), so a v2-resolved user on `/` takes the legacy mount and sees no History group — correct, since there is no Loot screen there, but "the v2 mount" is the accurate phrase, not "v2 users" |
| **R-D11-D** (USER) | The kebab **converts** to the two-trigger `ui/ContextMenu`, upholding D9a-k | D9a-k pre-ruled it: "D11 converts to the two-trigger `ContextMenu` + right-click + View week N in Log + material Edit under R-32; converting here would be converting twice." One items list, two triggers, one mount — the `LogWeekGrid`/`BookLedgerCard` shape. **Interim cost, named:** `ui/ContextMenu` has no focus-restore-on-close and no `aria-expanded`, and closes on scroll; R-D7b booked exactly these three for the Books kebabs (`phase-d-loot-design.md:559-562,603`) and D11 joins the same standing queue — with the honest note that a table multiplies them by row count |
| **R-D11-E** (plan) | Row interactivity is **permission-shaped**: `tabIndex={0}` + `role="button"` + `aria-label` only when `canEdit`. Shift/Alt pointer modifiers stay live for **everyone**; the kebab is a viewer's complete keyboard/AT route | R-31 q1 forbids advertising an activation that will not fire — and a focused row whose plain Enter does nothing is that violation with a keyboard instead of a cursor. That the modifiers stay live for viewers is R-31's own premise: "pointer only when `canEdit`, **plus R-18's Alt-held swap**" is vacuous otherwise, because an editor's row is already `cursor-pointer`. **The honest delta, stated rather than argued away:** a V1 viewer *can* focus a row and press `Shift+Enter`/`Alt+Enter` today (`AllWeeksView.tsx:311-325` handles both **before** the `canEdit` gate at `:326`, and `:555-559` routes the keyboard through). D11 does not carry that row-level **gesture**; every **capability** survives on the kebab (Copy link · Jump · View week N in Log), which R-32 already names "the keyboard and AT route". Affordance parity with a mapped home — not a silent drop. **Second divergence, recorded:** D6-l ruled v2's Log grid cells **inert** for viewers (`phase-d-loot-plan.md:243`) while History's stay modifier-live, so the two v2 surfaces differ for read-only users. Defensible (different rulings own them) but it qualifies §0's "one mental model", so it is written down rather than left to be re-discovered |
| **R-D11-F** (plan) | `cursor-pointer` iff `canEdit \|\| (altHeld && canJump)`. **ONE** `useAltHeld()` at the table top level | The second clause is the whole content of "R-18's Alt-held swap" on this surface, and `LogWeekGrid.tsx:416` (`altHeld && jump ? ' cursor-pointer' : ''`) is the exact precedent. One hook instance per table, never per row — D6 Task 3's rule, stated there because the naive shape is one per cell |
| **R-D11-G** (plan) | A plain click that **completes a text selection** does not open the editor | R-31 q2 makes the text selectable on purpose. A drag-select that ends in a modal takes the affordance back on mouseup, which is worse than `select-none` because it reads as a bug rather than a policy. Read `window.getSelection()?.toString()`; Shift+Click keeps V1's `removeAllRanges()` guard (`AllWeeksView.tsx:315`) so copying leaves no selection artifact |
| **R-D11-H** (plan) | A material row's **Edit** opens D8's modal through the **existing** `materialState.mode === 'edit'` door (`Loot.tsx:1155,1368-1384`) — no new modal, no new state shape | R-32 names this as net-new for v2 and D-37 restores it. D8's §5 mount obligations (full roster, referential stability, lazy edit initializers) were discharged in D5 **for this same mount**, and D11 adds a second *caller*, not a second mount — so the contract is inherited satisfied. Stated rather than assumed, because §5 requires whichever of D5/D11 lands first to state it, and D5 did |
| **R-D11-I** (plan) | **§2.1's claim that the command palette "renders in both shells" is wrong on `main`** and is corrected, not inherited | `CommandPalette` has exactly **one** production mount: `NewShell.tsx:4,330` (v2). Every other reference is a test, a `vi.mock`, a comment or a release note — verified independently by the director. Editing it is therefore not a V1 reach. The help modal's dual-shell reach is real and unchanged |
| **R-D11-J** (plan) | The `(^⇧F)` hint renders **in the search row** (§6's sketch, `phase-d-loot-design.md:1582`), not in the placeholder; R-D10-P's prohibition is **discharged** | R-D10-P banned it *because the binding did not exist yet*. It does now, so the reason is spent — but the placeholder already carries four keys of syntax teaching (R-D10-P's other job), and §6 draws the hint at the right-hand end of the search row. Same place, less crowding |
| **R-D11-K** (plan) | **D9a-i is superseded.** Its "inert row" test suite is **rewritten**, not deleted | The suite (`LootHistoryTable.test.tsx:829-838`) asserts precisely what R-31 reverses. Deleting it silently would leave the diff looking like coverage loss; replacing it in place, with the supersession named, is the D9b/D10 convention for a ruling that ages out |
| **R-D11-L** (plan) | `role="button"` on a `<tr>` costs the row its `row` semantics; the `aria-label` therefore carries the whole row's content (V1's `:553` shape) | Recorded trade, not a discovery. R-31's implementation note demands a role and the row genuinely is the control; the mitigation is that AT announces "Loot: Body — Aria, Week 2, button" instead of a headers-associated cell walk. The seven data cells stay plain `<td>`s, so a viewer's un-roled table is unaffected |
| **R-D11-M** (plan) | The menu keeps the family's **separator before Delete**, though R-32's item list does not draw one | `buildEntryMenuItems` (`LogWeekGrid.tsx:738-739`) and V1's own History menu (`AllWeeksView.tsx:392-393`) both separate the destructive item. R-32 lists items, not chrome; matching the family is the lower-surprise reading |

## 2a. Director verdict disposition

Plan vetted **before** implementation; verdict **APPROVE-WITH-REQUIRED-CHANGES**. All 15 findings
plus 3 design-record corrections dispositioned below. **Three were re-verified by the controller
against the code before acceptance rather than taken on report** — the blocker's lint probe (run
independently through `npx eslint` on a scratch file, deleted after), six of the nine drifted
citations, and `setWeek`'s URL write (`useLogWeek.ts`'s `writeWeekParam` is *not* gated on
`mirrorToUrl`, which is what makes the R-D11-B rewrite's second leg true).

| # | Finding | Disposition |
|---|---|---|
| **B1** | **The plan's own eslint prediction was wrong in both halves.** `<tr role="button" tabIndex={0}>` lints **clean** (a `<tr>` resolves to role `row`, which jsx-a11y treats as interactive, so neither named rule applies), and this repo reports **unused disable directives as warnings** — so the two pre-authorised disables would have made it 905 against a 903 ceiling the plan itself calls a failed gate | **Accepted, controller-verified.** Probe: both the editor and viewer `<tr>` shapes → 0 problems; a pre-emptive `no-noninteractive-tabindex` disable → `warning Unused eslint-disable directive`. §3.1 rewritten: **no pre-authorised disables**, and the rule is stated as "measured, never predicted" |
| **M1** | R-D11-B's three legs are true, but the F1/F2 guard can swallow the jump and the plan was silent | **Accepted** → **R-D11-N** (new ruling, disclosed residual with the observable failure named) + **T-26** pins the normal path. The rewrite also gained a *stronger* second leg the vet surfaced indirectly (the same-handler `setSearchParams` clobber) |
| **M2** | The `inputRef` fallback as written would break D10's clear-focus restore for the one caller that passes a ref, and T-16/T-17 were blind to exactly that case | **Accepted** → §3.4 names one resolved `ref` used by **both** the `<Input>` and `clearSearch`; **T-18** is the paired case, mutation-verified by reverting `clearSearch` to the internal ref |
| **M3** | The slice makes rows focusable and specified no focus indicator, on a table whose own docblock records that ring rendering here is non-obvious | **Accepted** → §3.1 pins the exact idiom V1's clickable grid cells already use in the same clipped-card situation (`WeeklyLootGrid.tsx:577,708`), and §5's browser pass gains the case |
| **M4** | The live pass demonstrated the mouse half of a slice whose headline ruling is about the keyboard | **Accepted** → §5 gains an owner keyboard walk (tab → ring → Enter/Shift+Enter/Alt+Enter/Space) and a **viewer** keyboard walk, which is the evidence R-D11-E's "complete keyboard/AT route" claim rests on |
| **M5** | `Layout.tsx` holds both shells, so DoD 3 part (a) passes trivially for the one file where the V1 hazard actually lives; T-26 (component-level) would sail past a mutation adding `extraGroups` to the **legacy** mount | **Accepted** → **T-29** in the existing `Layout.chrome.test.tsx` (which already parametrises both branches at `:130`/`:139`), listed in the mutation battery |
| **M6** | "A viewer loses nothing" is the author grading their own work — a V1 viewer *can* `Shift+Enter`/`Alt+Enter` a row today | **Accepted** → R-D11-E rewritten: capability parity with a mapped home, **gesture** deliberately not carried, plus the D6-l cross-surface divergence recorded |
| **m1** | `HistorySearch.tsx:26-28`'s docblock becomes false in this slice and §3.6 didn't list it — the phase's #1 repeat finding, in the file §3.4 edits | **Accepted** → §3.6 |
| **m2** | "D14 generalises it" is optimistic; an append-only prop cannot express D14's default, and v2's help becomes a mixed-truth list | **Accepted** → R-D11-C carries all three sub-points, including the `/` route caveat |
| **m3** | `buildRowMenuItems` cannot be both module-level-exported and unit-tested: `react-refresh/only-export-components` is an **error** here (D9a-m already recorded this for `isLootSlot`) | **Accepted** → §3.2: stays **unexported**, exercised through the table. No unit test was listed for it anyway |
| **m4** | The mechanism keeping a kebab click from also firing the row's `onClick` was unstated (T-10 pinned only the outcome) | **Accepted** → §3.2 names `stopPropagation`, and why `LogWeekGrid.tsx:471-479` didn't need it (no ancestor `onClick` there — exactly what changes here) |
| **m5** | The ruling ledger didn't mark which rows are user rulings | **Accepted** → every §2 row tagged `(USER)` / `(plan)` |
| **n1** | Nine citations drifted 1–3 lines (comment line cited instead of code) | **Accepted** → all fixed; six spot-checked by the controller. **This is the finding to feel worst about** — the phase's #1 failure mode, in the plan written to avoid it |
| **n2** | `Ctrl+Shift+F` is `preventDefault`ed on all three Loot views, not just History; and `disabled` covers only Loot-owned modals | **Accepted** → both stated in §3.3 |
| **n3** | `viewWeekInLog` omits `params.set('tab','gear')` that both `RosterCard` siblings set | **Accepted** → noted in §3.3 as correct-and-deliberate (same-tab jump), so a reviewer doesn't read it as an omission |
| **D-REC-1** | §2.1's "the help modal **and palette** render in both shells" is factually wrong | **Confirmed** by the director's independent grep → corrected in place (R-D11-I) |
| **D-REC-2** | §2.1 omits `layout/Layout.tsx`, the highest-reach file in this slice's diff and the one where DoD 3 part (a) passes trivially | **Accepted** → a §2.1 row is added naming the file, its reach (V1 on every route) and the M5 test as its guard |
| **D-REC-3** | §2.1's eslint follow-up row cites `LogWeekGrid.tsx:246` (which is `GridCellProps.altHeld`); the real targeted disable is `:625`, and `:586` is a different rule | **Accepted** → corrected in the phase plan. The D11 draft had inherited the bad pair as its precedent, which is how B1's wrong prediction got its confidence |

---

## 3. Implementation

### 3.1 `components/loot/LootHistoryTable.tsx` — the row (R-31)

**Props added** (beside the existing `canEdit`/`onEdit`/`onCopyLink`/`onDelete`, `:124-127`):

```ts
onEditMaterial: (entry: MaterialLogEntry) => void;   // R-D11-H
onJumpToPlayer: (playerId: string) => void;          // card-level until D12
onViewWeekInLog: (item: HistoryItem) => void;        // R-D11-A
```

All three are **required**, following `LogWeekGridProps`' own reasoning (`LogWeekGrid.tsx:706-713`):
an optional callback would make a menu item's presence a function of the caller rather than of the
data, and this table has exactly one mount.

**One activation handler**, called by both `onClick` and `onKeyDown` so R-31 q3's modifiers are
designed rather than inherited from a cast:

```
activate(mods: { shiftKey, altKey }, item)
  shift → onCopyLink(item); getSelection()?.removeAllRanges()      // V1 :315
  alt   → canJump ? onJumpToPlayer(recipientId) : (no-op)          // gate = playersById.has()
  plain → !canEdit            → no-op                              // R-D11-E
          selectionActive()   → no-op                              // R-D11-G
          kind === 'loot'     → onEdit(entry)
          kind === 'material' → onEditMaterial(entry)               // R-D11-H
```

`onKeyDown` handles `Enter` and `Space` (V1 `:555-559` handles both), `preventDefault()`s, and
passes the event's own `shiftKey`/`altKey` — so `Alt+Enter` and `Shift+Enter` carry. It is attached
only on the `canEdit` branch, where the row is focusable.

**The `<tr>` (`:611`)** gains, in the `canEdit` case only: `tabIndex={0}`, `role="button"`,
`aria-label` in V1's shape (`{Loot|Material}: {slot} — {player}, Week {n}`), `onKeyDown`, and the
focus treatment below. In **both** cases: `onClick`, `onContextMenu`, and `hover:bg-surface-raised`
+ `cursor-pointer` iff `canEdit || (altHeld && canJump)` (R-D11-F) + the existing `highlight-pulse`.
**No `select-none` anywhere** (R-31 q2).

**Focus indicator (M3).** The row must show a keyboard ring, and `index.css:264-269` only *removes*
rings for non-`:focus-visible` focus — nothing adds one. Use the idiom V1's own clickable grid cells
use in the same situation (a ring inside a clipped card):
`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset`
(`history/WeeklyLootGrid.tsx:577,708`). **Inset matters here**: the card is `overflow-clip`
(`:554`) and the pulse already had to become an `inset` ring for that reason (`:44-47`) — an outset
ring would be clipped on the first and last rows.

**On lint: measure, never predict.** The first draft of this plan pre-authorised two `jsx-a11y`
disables for this `<tr>`. Both were wrong — the shape lints **clean** (a `<tr>` carries role `row`,
which jsx-a11y treats as interactive, so `no-noninteractive-element-to-interactive-role` and
`no-noninteractive-tabindex` never apply), and this repo reports **unused disable directives as
warnings**, so each pre-authorised disable would itself have cost a warning against the ceiling.
**Add a disable only after seeing the rule actually fire**, with the reason inline
(`LogWeekGrid.tsx:625` is the real precedent — `control-has-associated-label`, which the
`a11yRecommendedWarn` mapping at `eslint.config.js:13-15` re-enables from upstream-off). Never edit
the shared config; that mapping is a phase-level follow-up (§5 of the phase plan).

### 3.2 `components/loot/LootHistoryTable.tsx` — the menu (R-32, R-D11-D)

`renderActionsCell` (`:370-394`) loses its Radix `Dropdown` and becomes a trigger:

- `IconButton` keeps its row-specific `aria-label` (`{slot} entry actions — {player}`, unchanged so
  D9a's two naming tests keep their assertions) and gains `aria-haspopup="menu"` (R-D7b's shape).
  `onClick` opens the menu anchored at its **own** rect (`r.left`, `r.bottom`) —
  `LogWeekGrid.tsx:471-479`'s `openKebabMenu` — and **calls `stopPropagation`**, which that
  precedent did not need because no ancestor there carries an `onClick`. In D11 the ancestor `<tr>`
  does, so without it one kebab click both opens the menu and opens the editor (m4; T-10 pins it).
- The `<tr>`'s `onContextMenu` `preventDefault()`s and anchors through
  `jumpMenuAnchor(e, e.currentTarget.getBoundingClientRect())` (`rosterLedgerJumps.ts:75-83`), so a
  keyboard-invoked context menu — Shift+F10 / the menu key, both coordinates `0` — lands on the row
  instead of the page corner (R-32 implementation note 2; the PR #200 fix).
- **ONE** `ContextMenu` mount at the table root with **one** `menu` state (`{ x, y, item }`), never
  per row — `LogWeekGrid.tsx:796,831-838`.
- `buildRowMenuItems(item, ctx): ContextMenuItem[]` — module-level and **not exported**:
  `react-refresh/only-export-components` is an **error** in this repo, and D9a-m already recorded
  that for `isLootSlot` (`2026-09-18-phase-d9a-history-table.md:281`). It is exercised through the
  table, which is where its permission and kind branches are observable anyway.

| Item | Gate | Wire |
|---|---|---|
| `Edit` | `canEdit` | loot → `onEdit(entry)` · material → `onEditMaterial(entry)` |
| `Copy link` | always | `onCopyLink(item)` |
| `Jump to {name}` | the id resolves in `playersById` | `onJumpToPlayer(id)` |
| `View week {n} in Log` | always | `onViewWeekInLog(item)` |
| separator + `Delete` (danger) | `canEdit` | `onDelete(item)` |

No icons — `buildEntryMenuItems` (`LogWeekGrid.tsx:723-740`) carries none for the entry family, and
one menu growing icons its twin lacks is the drift this phase keeps catching. The name comes from
the roster (`recipientNameOf`), the same resolution the Player cell and the kebab's own label
already use, so a renamed player reads consistently in all three.

The docblock's "Rows are inert — the kebab is the only control" and the "Later slices: D11 …" line
are **rewritten**, not appended to (the D10 lesson: a docblock describing the superseded mechanism
is the single most-repeated review finding of this phase).

### 3.3 `components/loot/Loot.tsx` — wiring and the shortcut (R-35)

**Two new callbacks**, beside the existing `openEdit`/`copyLink`/`requestDelete`/`jumpToRecipient`
(`:647-691`):

```ts
const editMaterialFromHistory = useCallback(
  (entry: MaterialLogEntry) => setMaterialState({ mode: 'edit', editEntry: entry }), []);  // = :1155's door

const viewWeekInLog = useCallback((item: HistoryItem) => {
  setSearchParams((prev) => {
    const params = new URLSearchParams(prev);
    params.set('lview', 'log');
    params.set('entry', String(item.entry.id));
    params.set('entryType', item.kind);
    params.delete('book');            // mutually-exclusive highlights, jumpToRecipient's rule
    return params;                    // NO 'week' (R-D11-B), and NO second setSearchParams call
  });
}, [setSearchParams]);
```

**ONE** `setSearchParams` call, deliberately (R-D11-B leg 2). No `params.set('tab','gear')` either,
unlike both `RosterCard` siblings (`RosterCard.tsx:285,303`) — this is a same-tab jump, so setting
it would be noise; noted because `RosterCard.tsx:281-296` is otherwise this callback's exact
precedent, down to the `delete('book')` rule and its own silence on `week` (n3).

`jumpToRecipient` is passed straight through as `onJumpToPlayer` — it already deletes
`entry`/`entryType`/`book` so a History-originated highlight cannot follow the user to the roster
(director F-18).

**The shortcut**, registered v2-locally through the **shared hook** — importing
`useKeyboardShortcuts` is not editing it (`pages/Profile.tsx:244` is the standing precedent for a
component-local registration), so the §2.1 row for `useGroupViewKeyboardShortcuts.ts` stays
untouched:

```ts
const historySearchRef = useRef<HTMLInputElement>(null);
const anyModalOpen =
  pickerState !== null || wizardState !== null || materialState !== null ||
  adjustmentsOpen || deleteTarget !== null || resetConfig !== null;      // :518-524

useKeyboardShortcuts({
  disabled: anyModalOpen,
  shortcuts: [{
    key: 'f', requireMod: true, requireShift: true,
    description: 'Search history',
    action: () => { if (lview === 'history') historySearchRef.current?.focus(); },
  }],
});
```

Three gates — R-35's "focus/modal guard" plus the one it could not know about:

1. **Focus** — the hook already returns early when the event target is an
   `input`/`textarea`/`select`/`contenteditable` (`useKeyboardShortcuts.ts:34-43,70`). V1's bare
   `document` listener (`AllWeeksView.tsx:111-120`) has no such guard.
2. **Modal** — `disabled` (`:82`), fed by Loot's own modal state. This is what V1's listener lacks
   on a screen that mounts `RecipientPicker` and `LogWeekWizard` above it, which is the sentence
   R-35's implementation note actually writes. **It covers Loot-owned modals only** — child-owned
   ones (`WeekScopeControl`'s summary, `BookLedgerCard`'s two) are not in the boolean, which is
   harmless *only because* gate 3 confines the action to History, where none of them mount (n2).
3. **View** — `lview === 'history'`; there is no box to focus on Priority or Log. Checked **inside**
   `action` rather than by conditionally building the array, so the hook's registration is stable
   across view switches. **Consequence to be honest about:** the hook `preventDefault()`s on any
   *match*, before running `action` (`:82-84`), so `Ctrl+Shift+F` is swallowed on all three Loot
   views — the browser's own binding never fires there, even where the action no-ops (n2).

The `action` is a no-op rather than a view switch: `Ctrl+Shift+F` is "focus the search", and
silently changing tabs under a focus shortcut is a different feature nobody asked for.

### 3.4 `components/loot/HistorySearch.tsx` — the ref and the hint

- `HistorySearchProps` gains `inputRef?: RefObject<HTMLInputElement | null>`. **One resolved ref,
  read by both consumers** — `const ref = inputRef ?? internalRef;` used by the `<Input ref={ref}>`
  **and** by `clearSearch`. The naive shape (attach the resolved ref, leave `clearSearch` on the
  internal one) silently reopens the N5 hole D10 closed: with a caller-supplied ref the internal one
  is never attached, so clearing drops focus to `<body>` for the only caller that exists (M2).
  Optional because every test that renders the control bare must keep working unchanged.
- The `(^⇧F)` hint (R-D11-J): a `text-xs text-text-tertiary` span after the clear `IconButton`,
  `aria-hidden="true"`, rendered **unconditionally** (the clear ✕ is conditional on a non-empty
  query; the shortcut is not). Plain inline span — `index.css:239-243` reverts `display` on any
  `aria-hidden` element, so it must not depend on a flex/grid display of its own (the F-4 hazard
  `LootHistoryTable.tsx:237-238` documents).
- The placeholder (`:59`) is **unchanged**; the docblock at `:26-28`, which explains why it omits
  the shortcut "because that binding belongs to D11", is rewritten (m1 — the reason is spent, and a
  reader meeting it after this slice would conclude the hint shouldn't exist).

### 3.5 The help entry (R-D11-C) — the shared-layer hunks

| File | Hunk | V1 render path it reaches |
|---|---|---|
| `ui/keyboardShortcutGroups.ts` | **+** `V2_SHORTCUT_GROUPS: ShortcutGroup[]` — one group, `{ title: 'History', shortcuts: [{ key: 'Ctrl+Shift+F', description: 'Search history' }] }`. `SHORTCUT_GROUPS` (`:21-86`) **byte-identical** | none — a new export nothing legacy imports |
| `ui/KeyboardShortcutsHelp.tsx` | **+** `extraGroups?: ShortcutGroup[]` defaulting to `[]`; the `useMemo` (`:26-31`) maps `[...SHORTCUT_GROUPS, ...extraGroups]` | **YES** — `Layout.tsx:140-144`. With the default the rendered output is identical to today's (T-27) |
| `layout/Layout.tsx` | the **v2** mount (`:97-101`) gains `extraGroups={V2_SHORTCUT_GROUPS}`. The legacy mount (`:140-144`) and the whole legacy `return` block (`:106-146`) are **untouched** | **YES — this file renders the V1 shell on every route.** The two branches are physically separate JSX, so the hunk is v2-only; **T-29 is what proves it**, because part (a) cannot (D-REC-2) |
| `layout/CommandPalette.tsx` | `:262` renders `[...SHORTCUT_GROUPS, ...V2_SHORTCUT_GROUPS]` | **none — v2-only file** (R-D11-I): sole mount `NewShell.tsx:4,330` |

`git diff --stat` over legacy-only paths stays empty (part a) — but note that `Layout.tsx` is **not**
a legacy-only path, so part (a) passes trivially for the one file that matters. **T-29 is the
failing-capable guard**; part (b) is this table, carried into the PR body verbatim with director
SHARED-DRIFT sign-off.

### 3.6 Docs re-derived, not patched

`DESIGN_SYSTEM.md` §3.36 (the table: the row is a control; the menu's item list and both triggers)
and §3.37 (`HistorySearch`: the `inputRef` seam and the hint). `HistorySearch.tsx:26-28`'s docblock
(m1) and `LootHistoryTable.tsx`'s "rows are inert" paragraph, both rewritten at the source.
`phase-d-loot-plan.md`: the D11 row → **✅ BUILT**; §2.1's palette claim corrected (D-REC-1); a
`layout/Layout.tsx` row added (D-REC-2); the eslint follow-up row's citation fixed to
`LogWeekGrid.tsx:625` (D-REC-3). `phase-d-loot-design.md`: a build note under R-31/R-32/R-35
recording what shipped, including R-D11-E's V1-gesture delta and R-D11-N's residual; R-34's ⚠
**half** row (`:1514`) flipped to complete; R-D7b's kebab-a11y queue note (`:559-562`) gains D11's
rows. R-D10-P marked **discharged** in the D10 build note, where a reader will meet it.

---

## 4. Tests

Every new test states the ruling it pins. The mutation battery
(`scripts/d11-mutation-battery.py`, the `d9b` script's shape) asserts each anchor **present AND
unique**, restores in a `finally`, diffs byte-identical afterwards, and reports
`INVALID MUTANT (did not compile)` — all three lessons are from D10 rounds 5 and 7, and a mutation
that kills 0 is first evidence about the *mutation*.

**`LootHistoryTable.test.tsx`**

| # | Test | Pins |
|---|---|---|
| T-1 | plain click on a loot row → `onEdit(entry)`; on a material row → `onEditMaterial(entry)` | R-31, R-D11-H |
| T-2 | `Shift`+click → `onCopyLink(item)` only — `onEdit` not called | R-31 |
| T-3 | `Alt`+click → `onJumpToPlayer(id)` only; with an unresolvable recipient → **nothing** fires | R-31, the jump gate |
| T-4 | `canEdit: false` → plain click fires nothing; Shift and Alt still fire | R-D11-E |
| T-5 | `canEdit: false` → the `<tr>` has no `tabindex`, no `role`, no `aria-label`; `canEdit: true` → all three, and the label names slot, player and week | R-D11-E, R-D11-L, **replaces the D9a-i suite** (R-D11-K) |
| T-6 | no row carries `select-none`, either permission | R-31 q2 |
| T-7 | a plain click while a selection is live fires nothing; after `removeAllRanges` the same click edits | R-D11-G |
| T-8 | `Enter` edits · `Shift+Enter` copies · `Alt+Enter` jumps · `Space` edits | R-31 q3 |
| T-9 | cursor: editor → `cursor-pointer`; viewer → none; viewer with Alt **held** and a resolvable player → `cursor-pointer`; viewer with Alt held and an unresolvable one → still none | R-D11-F (the last case is the anti-vacuous half) |
| T-10 | the editable row carries the `focus-visible` inset-ring classes; the viewer row does not | M3, R-D11-E |
| T-11 | clicking the kebab does **not** also fire the row's plain-click handler | m4 (`stopPropagation`) |
| T-12 | kebab click and row right-click open the **same items in the same order** | R-32, R-D11-D |
| T-13 | item set by permission and kind: viewer → Copy link · Jump · View week; editor loot → + Edit + Delete; editor material → Edit present (was absent pre-D11) | R-32, R-D11-H, **inverts one D9a assertion** |
| T-14 | `View week 2 in Log` → `onViewWeekInLog({kind,entry})`; the label carries the row's own week, not a constant | R-D11-A (anti-vacuous: two rows, two weeks) |
| T-15 | right-click at `clientX/clientY = 0,0` anchors to the **row's** rect, not `0,0` | R-32 note 2 |
| T-16 | the kebab keeps its row-specific name and gains `aria-haspopup="menu"` | R-D7b shape |

**`HistorySearch.test.tsx`** — T-17 a passed `inputRef` reaches the input and `.focus()` moves focus
there; **T-18** with a passed `inputRef`, clicking clear restores focus **to that input** (M2's
failing case — mutation-verified by reverting `clearSearch` to the internal ref); T-19 with **no**
`inputRef` the D10 clear-restore still works; T-20 the `(^⇧F)` hint renders, is `aria-hidden`, and
survives the F-4 sweep; T-21 the placeholder is unchanged.

**`Loot.test.tsx`** — T-22 `Ctrl+Shift+F` on History focuses the search box; T-23 it does nothing on
Priority or Log; T-24 it does nothing while a modal is open; T-25 it does nothing while focus is in
a text input (the hook's guard, asserted here because R-35 names it); **T-26** "View week N in Log"
sets exactly `lview=log`, `entry`, `entryType`, removes `book`, **does not set `week`** (R-D11-B),
**and** the Log then displays the entry's week via D6a's correction — the normal path R-D11-N's
residual is the exception to; T-27 a History row's `Edit` on a material opens
`QuickLogMaterialModal` in **edit** mode with that entry.

**`KeyboardShortcutsHelp.test.tsx`** (new) — T-28 with no `extraGroups` the rendered group titles and
rows are exactly `SHORTCUT_GROUPS` and `Ctrl+Shift+F` is **absent**; T-28b `adminOnly` filtering
still applies across both lists.

**`Layout.chrome.test.tsx`** — **T-29**, the V1-unchanged assert that can actually fail: the legacy
branch's help renders **no** History group and no `Ctrl+Shift+F`; the v2 branch's does. The file
already parametrises both shells (`:130` legacy, `:139` v2), and the mutation is "add
`extraGroups` to the legacy mount" (M5).

**Existing tests converted, not deleted** — the `openKebab` helper (`:131-133`) moves from
`fireEvent.keyDown(…, Enter)` (Radix) to `fireEvent.click` (`ui/ContextMenu`'s trigger); the
`inert row (D9a-i)` suite (`:829-838`) is replaced by T-5/T-6/T-9/T-10 with the supersession named
in a comment; the "hides Edit for a material row" case inverts into T-13 with R-32 cited. Each
conversion is listed in the PR body so the diff's red lines are accounted for.

---

## 5. Gates

Baselines measured **on this branch before any code**, not carried from the handoff (2026-09-22):

| Gate | `main` @ `3253d858` | D11 | Δ |
|---|---|---|---|
| `pnpm test` | 235 files / **3078** | — | must rise |
| `pnpm lint` | **0 errors / 903 warnings** | — | **0** |
| `pnpm knip` — unused exported types | **140** | — | **+0** |
| `pnpm knip` — unused exports | **181** | — | **+0** |
| `pnpm build` (`tsc -b && vite build`) | clean | — | — |
| `pnpm check:design-system:strict` | clean | — | — |
| `pnpm dupes` | green — 322 clones | — | — |

`V2_SHORTCUT_GROUPS` has two consumers on the day it lands, so knip stays flat; a rise of one means
a consumer was not wired. **`pnpm build` is the typecheck gate — `vitest` does not typecheck** (D10
shipped a fixture `tsc -b` rejected after vitest passed it). **A new lint warning is a failed gate**
— including one from an unused `eslint-disable` (B1).

**Live browser pass** at `?shell=v2` → Loot → History, 1440×1100, zero console errors, as an owner
**and** as a viewer — the permission split is half this slice's content, so a one-role pass would
demonstrate half of it.

- *Pointer, owner:* plain / Shift / Alt click on a loot row and on a material row · right-click and
  kebab producing the same menu · material Edit opening D8's modal seeded on first paint ·
  "View week 2 in Log" landing with the cell pulsing and the week corrected.
- *Keyboard, owner (M4):* tab to a row → **see the focus ring** → `Enter` edits · `Shift+Enter`
  copies · `Alt+Enter` jumps · `Space` edits.
- *Keyboard, viewer (M4):* rows are not in the tab order; tab reaches the **kebab**, and Copy link /
  Jump / View week N in Log are all operable from there. This is the evidence R-D11-E's "complete
  keyboard/AT route" claim rests on — without it the ruling is an assertion.
- *Pointer, viewer:* no pointer cursor at rest; **hold Alt** → the cursor appears on rows whose
  recipient resolves, and only those.
- *Shortcut:* `Ctrl+Shift+F` from the table, from inside a modal (no-op), and on Log (no-op).
- *V1 evidence:* `Shift+?` in **both** shells, screenshotted side by side.
- *Text selection:* drag-select a player name, release — no modal (R-D11-G).

Screenshots shrunk with `scripts/shrink-pr-shots.py` under CI's 120 KB/file.

DoD 2's enumeration test stays D14's. DoD 3's two-part assert is §3.5's table plus an empty
legacy-path `git diff --stat`, **with T-29 supplying what part (a) structurally cannot**. Mobile is
Phase P.

---

## 6. Measured results

All run from `frontend/` **by the controller**, on the branch tip — not taken from a task report.
Baselines were measured on this branch before any code was written.

| Gate | `main` @ `3253d858` | D11 | Δ |
|---|---|---|---|
| `pnpm test` | 235 files / **3078** | 236 files / **3113** | **+1 file / +35** |
| `pnpm lint` | 0 errors / 903 warnings | 0 errors / **903** | **0** |
| `pnpm knip` — unused exported types | 140 | **140** | **+0** |
| `pnpm knip` — unused exports | 181 | **181** | **+0** |
| `pnpm build` (`tsc -b && vite build`) | clean | clean | — |
| `pnpm check:design-system:strict` | clean | clean | — |
| `pnpm dupes` | green — 322 clones | green — **322** | **0** |

**Test accounting.** +35 = +19 (`LootHistoryTable.test.tsx`, T-1…T-16 plus the replaced D9a-i
suite) +7 (`Loot.test.tsx`: T-22…T-27, with T-26 split in two) +6 (`HistorySearch.test.tsx`,
T-17…T-21) +2 (`Layout.chrome.test.tsx`, T-29) +4 (`KeyboardShortcutsHelp.test.tsx`, new file —
the +1 test file). **The lint ceiling held at exactly 903**, which is the number B1 was about: the
first draft of this plan would have shipped 905 by pre-authorising two disables the code never
needed.

**knip holding rather than rising is the expected result:** `V2_SHORTCUT_GROUPS` landed with two
consumers the same day (`Layout.tsx`'s v2 mount and `CommandPalette.tsx`). A rise of one would have
meant a consumer was never wired.

### Mutation battery (`scripts/d11-mutation-battery.py`, run by the controller)

Each mutation asserts its anchor **present AND unique**, restores in a `finally`, and the restore is
verified **by SHA-1** before the next row runs — D9b's harness plus the byte-identity check, because
a `finally` that copies back is only as good as the bytes it copies.

| Mutation | Kills |
|---|---|
| kebab click no longer stops propagation (one click opens the menu AND edits) | **1** |
| focus ring loses `ring-inset` | **1** |
| Alt-held pointer drops the jump-target gate (`canEdit \|\| altHeld`) | **1** |
| row is focusable+roled for EVERYONE (V1's lying row restored) | **1** |
| menu Edit ungated from `canEdit` (a viewer gets an Edit item) | **2** |
| jump handler also writes `?week=` (the inert param R-D11-B rejects) | **1** |
| gate 3 removed: `lview` check dropped from the action | **0 — expected, see below** |
| gate 2 removed: the modal guard (`disabled`) switched off | **1** |
| gate 1 removed **in the shared hook**: typing in an input stops suppressing shortcuts | **1** |
| `clearSearch` reverts to the internal ref (M2's defect reintroduced) | **1** |
| legacy help mount ALSO receives `extraGroups` (V1's `Shift+?` changes) | **1** |

**The 0 is the finding, and it is correct.** Off History `HistorySearch` is unmounted, so React has
already nulled `historySearchRef` and `?.focus()` cannot fire — the optional chain is the
load-bearing gate and the `lview` check is defence in depth. It is **kept** rather than deleted,
with the reasoning at the call site: unlike R-D10-F's `params.delete('q')`, it guards a state that
is not structurally impossible, only unbuilt (a future refactor that hides the History subtree
instead of unmounting it). The battery row is labelled `expected 0` so a later reader does not read
it as a coverage hole — and a row reporting >0 there would mean the ref survives unmount, which is
worth knowing immediately.

### Live browser pass

`?shell=v2` → Loot → History, DEVTST, 1440×1100, **zero console errors or warnings** (checked with
preserved messages across every navigation in the pass).

**As owner:** row is `tabindex=0` + `role="button"` + `aria-label="Material: Twine — Tank Two,
Week 3"`, `cursor-pointer`, focus-ring classes present, **no `select-none` on any row** · kebab
menu = **Edit · Copy link · Jump to Ranged One · View week 3 in Log · Delete** · a plain click on a
material row opens **"Edit Material Entry"** (R-34's last ⚠half row, closed live) · `Ctrl+Shift+F`
focused the box from the table, and did **nothing** with the material modal open (box still mounted
behind it) or on Log (no box to focus).

**"View week 3 in Log" (R-D11-A/B), the whole chain observed:** URL became
`…&lview=log&entry=72&entryType=loot&week=3`, the Log grid mounted, and `log-cell-loot-72` carried
`highlight-pulse`. **`week=3` was written by `useLogWeek`'s mirror via D6a's correction effect, not
by the handler** — which is exactly R-D11-B's predicted division of labour, observed rather than
argued (DEVTST's clock is on week 10, so the correction had real work to do).

**As viewer (DevMember):** every row has **no** `tabindex`, **no** `role`, **no** `aria-label` and
**no** `cursor-pointer`; a plain click changes nothing; the kebab menu is **Copy link · Jump to
Ranged One · View week 3 in Log** — no Edit, no Delete. **The Alt-held swap, live: 0 pointer rows →
hold Alt → 17 → release → 0.** Keyboard: rows are not in the tab order, the kebab is, and Enter on
it opens the full viewer menu.

**R-D11-G, live, with its control:** with "Tank Two" selected in the Player cell, a plain row click
opened nothing; clearing the selection and clicking the same row opened "Edit Material Entry". The
guard is real, not vacuous.

**V1 unchanged, the evidence pair:** `Shift+?` in **v2** renders 10 groups including **History /
`Ctrl+Shift+F`**; `Shift+?` in **legacy** renders 9 groups with **no History group and no
`Ctrl+Shift+F`** anywhere in the modal. Screenshots `d11-05` / `d11-06`.

⚠ **One finding the pass produced, recorded not fixed** — the History row kebab opened with
**Enter** does not move focus into the menu (no `focusin` fires at all), while the same component
opened by **mouse** focuses the first item at the second animation frame, and D7's `M9S actions`
kebab *does* move focus on Enter. Usage-specific, not component-wide. The menu stays operable
(`ArrowDown` enters it; roving `tabindex` measured correct at `0, -1, -1`), so it costs a keypress
and an announcement, not access. Not chased further inside D11: the fix belongs in
`ui/ContextMenu`, which three shipped surfaces share, so it goes to the standing kebab-a11y queue
**with the D7-vs-D11 reproduction attached** — that comparison is the part that makes it
actionable. It also corrected a claim this slice had already written into `DESIGN_SYSTEM.md` from
reading the source ("it does focus its first item on mount"), which is the phase's own #1 failure
mode caught on itself.

Screenshots: `docs/redesign/pr-shots/d11-01…07`, shrunk with `scripts/shrink-pr-shots.py`
(347 KB → **168 KB**; largest file 32 KB against CI's 120 KB per-file budget).

**Dev DB untouched.** The pass opened the material edit modal but never saved; nothing was logged or
deleted. D9a's seed (loot 63–72, materials 24/25/27) is still there and still dirty.
