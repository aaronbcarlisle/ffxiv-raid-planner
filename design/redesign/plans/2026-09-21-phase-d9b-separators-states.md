# Phase D · Slice D9b — Week separators + History states

**Branch:** `phase-d/d9b-separators-states` off `main` @ `257ec940`
**Binding authority:** `design/redesign/specs/phase-d-loot-plan.md:196` (the D9b row)
**Design rulings:** R-29 (separators), R-34 (stats count, filtered-vs-empty)
**Predecessor:** D9a (PR #262) shipped the flat sortable table and *deliberately deferred* all four
items below.

---

## 0. Opening evidence — the `<tr>` `highlight-pulse` ring, finally eyeballed

D9a shipped the deep-link pulse on a `<tr>` inside a `border-collapse: collapse` table and recorded
it as **DOM-evidenced only** — computed style asserted, never looked at. Chrome has historically
dropped `box-shadow` on table rows in the collapsed border model, which would have made the whole
inset-ring design (`index.css:562`, chosen *because* "inset ring + fill render on all four edges
regardless of element type") silently a no-op on this surface.

**Measured 2026-09-21, live, on `main` @ `257ec940`**, DEVTST `loot-entry-69`, viewport 1440x900,
animation frozen at the 0% keyframe (`animation-play-state: paused`) so the ring could be captured:

| Theme | Computed `box-shadow` | Painted? |
|---|---|---|
| dark | `oklab(... / 0.85) 0 0 0 2px inset` + outset glow | **Yes** — 2px ring on all four edges |
| light | `oklab(... / 0.7) 0 0 0 2px inset` + outset glow | **Yes** — 2px ring on all four edges |

`getComputedStyle(table).borderCollapse === 'collapse'` in both. The outset glow is clipped by the
card's `overflow-clip`, exactly as D9a's trade note predicted; the inset ring — the load-bearing
half — is intact. **No fix needed.** This closes the open question, and the claim is now
screenshot-backed rather than inferred.

---

## 1. Scope

Four deliverables, all named in the D9b plan row.

1. **R-29 week separators**, rendered **only while `sort.field === 'week'`**, rebuilt from the
   deleted `WeekGroupHeader` (`3f90d420:frontend/src/components/loot/WeekGroupHeader.tsx`).
2. **R-34's stats count** — `{n} entries` with a `(X gear, Y material)` split.
3. **R-34's filtered-vs-empty split** — two distinct empty messages.
4. **`currentWeek` / `rangeOfWeek` props re-added** (D9a-l), re-consuming
   `hooks/useWeekClock`'s `WeekRange` so `knip` returns to **+0** vs `main`.

Plus the D9b row's explicit test obligation: the `?entry=` highlight resolves against the
**unfiltered** logs, proven under separators.

**Out of scope** (later slices, unchanged): the search box (D10), row click / right-click
`ContextMenu` (D11), gear-row anchors (D12), `FairnessSummary`'s move to Home (D14).

---

## 2. Rulings taken this slice

| # | Ruling | Why | Cost if reversed |
|---|---|---|---|
| **R-D9b-A** | Separator count reads **`{n} entries`**, not the archaeology's `{n} drop(s)` | The §6 sketch says "4 entries", and R-34's stats count on the same screen says "entries" — one screen, one word. The count includes material rows, which are not "drops" in the sense the Type column uses | one string + one test |
| **R-D9b-B** | Current week marked by the tinted pill **and** a visible `· current` | §6 sketch. The archaeology's tint alone is a colour-only signal — inaudible to a screen reader and weak for colourblind users. The measured `text-accent-hover` token is kept **verbatim** per impl note 1 | one span |
| **R-D9b-C** | The stats count sits **inside the table card, above `<thead>`** | User ruling. The count travels with the table it describes rather than with a toolbar row D14 will re-flow. `role="status"` so a filter change announces | one element move |
| **R-D9b-D** | The separator is a **`<tr><td colSpan>`** inside the existing single `<tbody>`, authored **in `LootHistoryTable.tsx`** rather than as a restored `WeekGroupHeader.tsx` | The rebuilt thing is table-coupled now (`colSpan`, row semantics) and has exactly one consumer; a separate file would be a one-import indirection. Impl note 1 preserves the archaeology's *content*, not its file | file move |
| **R-D9b-F** | The pill goes through `Tag variant="label"` (`accent` / `muted` tones), not the archaeology's hand-rolled span; `font-extrabold` is dropped | `Tag`'s `accent` tone IS `bg-accent/15 text-accent-hover` and `muted` IS `bg-surface-elevated text-text-secondary` — the measured-contrast ruling survives exactly, verified live (`#0a6b60` in light). An appended weight utility does not beat `Tag`'s `font-medium` (measured 500), so shipping `font-extrabold` would have been a no-op class | one className |
| **R-D9b-E** | Separators are direction-agnostic — they render under Week **asc** as well as desc | R-29 scopes them to "sorted by week", not to a direction. Ascending week order is still grouped by week, so the separator is still true | one condition |

---

## 3. Implementation

### 3.1 `LootHistoryTable.tsx`

**Props** — re-add the two D9a dropped, restoring the `WeekRange` import:

```ts
  /** pass clock.currentWeek. */
  currentWeek: number;
  /** pass clock.rangeOfWeek. */
  rangeOfWeek: (week: number) => WeekRange | null;
```

**Separator range formatting** — lifted verbatim from the archaeology, comment included:

```ts
/** UTC-pinned so the shown date never shifts a day (WeekScopeControl precedent). */
const RANGE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
```

This is deliberately a *second* formatter beside the existing `DATE_FMT`: the Date **column** is
local time (D9a-o, a logged moment) and the separator **range** is UTC (a lockout boundary). Both
are correct for what they each show; the R-29 build note already records the split.

**Pill** — `Tag variant="label"` with the `accent` / `muted` tones (R-D9b-F, taken during the build
once `Tag`'s tone map was read). Those tones ARE the archaeology's two class pairs, so the
measured-contrast ruling at `3f90d420:.../WeekGroupHeader.tsx:30-36` is preserved exactly; the
reasoning is carried over into a comment beside the component. `font-extrabold` is deliberately not
carried — see the ruling.

**Grouping** — `rows` is already sorted; when the sort is `week`, a separator is emitted whenever
`entry.weekNumber` differs from the previous row's. Counts come from one pass over `rows`.

**Render gate** — `const showSeparators = sort.field === 'week';`

### 3.2 Stats count

```
{total} {total === 1 ? 'entry' : 'entries'}   // always
 (X gear, Y material)                          // only when BOTH > 0
```

R-34 replaces v1's `entryType === 'all'` condition (a state R-30/D10 deletes) with "both kinds are
present in the filtered set". Counted off `rows` — the *filtered* set — so the number always
describes what is on screen.

### 3.3 Filtered-vs-empty

| Condition | Message |
|---|---|
| `lootLog.length + materialLog.length === 0` | `No loot or materials logged this tier.` |
| otherwise, `rows.length === 0` | `No entries match your filters.` |

Both strings are v1's (`AllWeeksView.tsx:530-537`), which is the parity target R-34 names. The
shipped single message (`No entries match — log a drop from the Priority view.`) goes away: its
hint is also stale, since logging now happens from the Log toolbar, not "the Priority view".

### 3.4 `Loot.tsx`

Two props onto the existing mount: `currentWeek={clock.currentWeek}` and
`rangeOfWeek={clock.rangeOfWeek}` — the exact spelling `3f90d420:.../Loot.tsx:998-999` used.

---

## 4. Tests

| # | Test | Proves |
|---|---|---|
| T1 | Week desc: a separator precedes each week's first row, with pill, UTC range and `{n} entries` | R-29 core |
| T2 | Sorting by Player removes every separator | R-29's "only under week sort" |
| T3 | Week **asc** still renders separators | R-D9b-E |
| T4 | The current week's separator carries `· current`; a past week's does not | R-D9b-B |
| T5 | `rangeOfWeek -> null` renders the separator without a range and without a stray `·` | the archaeology's `{range && ...}` |
| T6 | Counts are per week and reflect the active filter | R-29 / R-34 |
| T7 | `12 entries (9 gear, 3 material)` only when both kinds present; `entry` singular at 1 | R-34 stats |
| T8 | Empty logs -> "No loot or materials logged this tier."; non-empty logs filtered to zero -> "No entries match your filters." | R-34 split |
| T9 | **`?entry=` resolves against the UNFILTERED logs**: an entry excluded by the active filter is still "found" (params still self-clear), and one that is visible renders `highlight-pulse` with separators on | the D9b row's named obligation + the C7 jump destination |

T9 is the one the plan row calls out by name, because `RosterCard.tsx:281-297`'s shipped C7 jump
lands here and the user arriving from it has whatever filter they last left behind.

---

## 5. Gates

- `pnpm test` · `pnpm lint` (0 errors, <= 903 warnings) · `pnpm build` (`tsc -b`, **not** `--noEmit`)
- `pnpm check:design-system:strict`
- `pnpm dupes` — no regression against 3.57% lines / 4.01% tokens
- **`pnpm knip` -> Unused exported types 141 -> 140** (`WeekRange` consumed), every other count equal
- Live browser pass at 1440, both themes, plus re-measured table min/max-content widths — the
  separator row adds a `colSpan` cell whose content can widen min-content (D9a's lesson: **a layout
  change invalidates earlier measurements**)
- Screenshots embedded in the PR body (user rule)
- Release note in `releaseNotes.ts` (internal; `CURRENT_VERSION` unchanged)

---

## 5a. Review findings folded in

Both reviewers ran over the finished diff. Verdicts: **change-vet FALSE-DONE** (one line, in the
spec's status text, not the code) and **code review PASS on spec compliance** with 3 Minors.

| # | Finding | Disposition |
|---|---|---|
| **F1** | The R-34 build note said "R-34 is complete". It is not — D9b builds **one** of its four rows | **Fixed.** Replaced with a per-row status table: Loses ✅ D7 · Restores ✅ D9b · Keeps' material-edit half → D11 · Receives → D12 · fairness-block removal → D14. This is the exact drift class the repo has been bitten by, and it was mine |
| **M1** | `tierIsEmpty` asserts "nothing logged this tier" over arrays that are empty only because the fetch hasn't landed — D9b upgraded D9a's neutral message into a false positive claim | **Fixed.** New `logsLoading` prop → a third state, `Loading entries…`. Two tests. The one-frame pre-effect window remains (store flags initialise `false`) and is disclosed rather than papered over |
| **M2** | Nothing proved `currentWeek` comes from `clock` rather than `logWeek.week` — both are numbers in scope and either compiles | **Fixed.** Assembly guard in `Loot.test.tsx` on the D9a precedent: clock week 3, Log pointed at week 2 via `?week=2`, asserts the marker lands on WEEK 3. **Mutation-checked** — wiring it to `logWeek.week` kills exactly that test |
| **M3** | The separator is a `<td colSpan>` in the single `<tbody>`; a screen reader announces it as a data cell, not a group header | **Accepted debt, queued.** One `<tbody>` per week with a `<th>` row is the correct shape; R-D9b-D ruled the single-tbody form and R-34's D9a note already framed the empty row the same way. Recorded in `DESIGN_SYSTEM.md` §3.36 and queued for the **Phase P a11y pass** |
| **N1** | "Only `font-extrabold` is dropped" understated it — `Tag` also adds a 1px border and `px-2` vs `px-2.5`; and the weight change is a *choice*, since `font-extrabold!` would carry | **Fixed.** All three deltas disclosed; the framing corrected from inevitability to trade |
| **N2** | `DESIGN_SYSTEM.md` §3.36 still documented one-card-per-week, `WeekGroupHeader`, `"{count} drop(s)"` and the deleted empty string | **Fixed.** §3.36 rewritten for the shipped table, with a banner that `WeekGroupHeader` no longer exists; §3.35's cross-reference and the §2 index line repointed |
| **N3** | The test helper's UTC comment overclaimed — the guard only bites off UTC | **Fixed.** Comment now says so. Pinning `TZ` in `setup.ts` would make it portable but needs a D9a local-time-test audit first — not this slice |
| **N4** | `toEqual([''])` encoded "no separator" as "the empty row has no span" | **Fixed.** Now asserts the row count and the `colSpan`, which is the load-bearing shape |
| **N5** | The pill test pins `Tag`'s internal class strings | **Kept deliberately.** The plan row makes the measured `text-accent-hover` token binding; pinning it is the point. Reviewer agreed |
| **N6 / F8** | `pr: 0` and the plan-row "✅ BUILT (D9b)" need the PR number | Backfilled at PR open |
| **F9** | §6's ASCII sketch now contradicts the shipped surface (count placement, `· current` position) | **Fixed.** Annotated in place rather than redrawn, so the change stays visible |

### Round 2 — the PR's own bots (`claude[bot]` + Copilot)

Both channels checked, per the #262 lesson: inline threads **and** review bodies. Copilot used inline
threads this time; no review body carried suppressed comments.

| Finding | Verdict | Disposition |
|---|---|---|
| **`statsLabel` isn't gated on `logsLoading`** — while the body reads `Loading entries…` the `role="status"` line reads `0 entries`, and being a live region it *announces* that, then announces the real count (both bots, independently) | **Real.** The same claim-over-unloaded-data as M1, two lines above it, which I missed | **Fixed.** Blank while loading with no rows; the node stays mounted so the live region keeps being tracked. Two tests, including the positive case — a count that IS knowable still renders |
| **A failed load leaves empty arrays with `logsLoading === false`**, so History asserts "No loot or materials logged this tier." over a request that never landed (Copilot) | **Real and reachable** — `fetchLootLog` clears its loading flag on the error path too, and `Loot` only raises a toast | **Fixed.** New `logsFailed` prop → a fourth zero-row state, `Couldn't load this tier's entries.`, with no count either. Scoped with local state set inside the existing `cancelled` latch rather than the store's single shared `error`, which any of its fetches can set. Unit tests + an assembly test with a rejecting `fetchLootLog`, plus a control for succeeded-but-empty. **Mutation-checked** |
| **`logsLoading` is a pair of global booleans**; on a tier switch an old response can clear the flag while the new request is pending, and "with empty arrays at that point" the table calls the new tier loaded (Copilot) | **Premise partly refuted.** The arrays are never emptied — `clearLootTracking` exists with **zero call sites**, and each fetch overwrites on success. A tier switch therefore renders the *previous tier's rows*, never the false-empty claim | **Disclosed, not fixed.** The residual is stale rows, which pre-dates D9b on both shells and is named in the `logsLoading` docblock. Request-scoped loading is a store change and belongs with the standing `fetchPageLedger` gating item |
| **`currentWeek`/`rangeOfWeek` may read a clock still holding the previous tier's values** after a switch (Copilot) | **Real, pre-existing** | **Disclosed.** Every `clock` consumer shares it (`WeekScopeControl` shows the same stale "Week N"). D9b adds a reader, not the behaviour — queued rather than forked into this slice |
| **The plan's gate table said 2989 tests (+17) while the PR body said 2992 (+20)** (Copilot) | **Real** — I updated the PR body and not the plan | **Fixed**; both now read the final count |

### Rounds 3-5 — the bots re-reviewed each fix, and each fix had a flaw

| Finding | Verdict | Disposition |
|---|---|---|
| **`logsFailed` was set from a `Promise.all` catch** that also covers `fetchPageLedger` and `fetchCurrentWeek`, so an unrelated failure would put History into "Couldn't load this tier's entries." while its logs arrived fine | **Real, and pointed** — it is precisely the wrongness I had just argued ruled out the store's shared `error` field, reintroduced one line later through the batch | **Fixed.** `markLogsFailed` is attached **per log promise** and rethrows, so the batch still rejects and the single toast still fires. New assembly test: `fetchPageLedger` rejects, logs succeed → History must still say "No loot or materials logged this tier." **Mutation-checked** — restoring the batch-level catch kills exactly that test |
| **`logsFailed` never clears on a later successful log fetch** (claude[bot]). `setLogsFailed(false)` ran only in the tier effect, but the tier effect is not the only thing that loads the logs — every log mutation refetches them from inside the store, and `refresh` doesn't touch them. So a failed first load kept the error message for the whole tier visit, and a filter matching nothing showed the load error instead of "No entries match your filters." | **Real and reachable** — the same false-claim class the slice exists to remove, with the polarity flipped | **Fixed twice over, deliberately.** (1) A retraction effect keyed on `[lootLog, materialLog]`: a fetch writes a freshly parsed array on success and leaves it untouched on failure, so a changed reference is the one signal the component gets that the logs arrived — including a delete that emptied the tier. (2) `logsFailed` is now gated on `tierIsEmpty` in the table itself: a component HOLDING logs must not claim they failed to load, whatever a stale flag says. Neither mechanism is the only thing between a user and a false claim. Both mutation-checked |
| **The round-4 retraction treated ONE log's success as proof both arrived** (claude[bot]). The effect was keyed on `[lootLog, materialLog]`, but each fetch writes only its own array — so on a partial failure (`/loot-log` 500s, `/material-log` returns `[]`) the material's fresh array retracted the loot log's verdict, and History asserted "No loot or materials logged this tier." over a log that never landed | **Real** — M1 a third time, now reached *through* the fix for its polarity-flipped twin | **Fixed.** Split into `lootLogFailed` / `materialLogFailed`, each latched by its own fetch and retracted by its own array alone; `logsFailed` is their union. **Mutation-checked** — recombining the effects kills exactly the partial-failure test. ⚠ My first draft of that test was **vacuous**: the mock wrote the material array synchronously during `Promise.all` argument evaluation, i.e. *before* the loot rejection latched, so the race never happened and the mutant survived. Rewritten to sequence explicitly — wait for the failure message, then write the material array |
| **`DESIGN_SYSTEM.md` §3.36 was stale again** — it listed three zero-row states and no `logsFailed` prop, having been written before round 2 | **Real** | **Fixed.** Props updated; the states line is now a four-row precedence table that spells out which two withhold a claim and which two assert one |

### Round 6 — and the deliberate stop

Neither bot raised a **Must fix** this round. Two "Consider" items:

| Finding | Disposition |
|---|---|
| **The battery script is Windows-only** — `subprocess.run([...], shell=True)` is Windows-only semantics with a list argv; on POSIX it runs bare `npx`, the summary regex misses, and **every row reports -1**, clean-tree re-check included (claude[bot]) | **Fixed.** It was checked in as *reproducible evidence*, and a script that reports -1 for everything on Linux is worse than no script. `shell=True` dropped, launcher resolved per platform, and a docstring note that it runs from `frontend/`. Re-run after the change — identical numbers |
| **The retraction effects are not tier-scoped**, and (Copilot) the store permits overlapping SAME-TIER fetches too, so an earlier request landing after a later one rejected also clears the verdict | **REMOVED the mechanism** — see below |

**Why the retraction was deleted rather than patched (round 7).** Copilot's version of this finding
widened it past my round-6 read: it is not only a tier-switch race, because the store permits
overlapping *same-tier* fetches (initial load plus mutation refetches) with no generation guard. That
makes the mechanism unfixable at this level rather than merely leaky — `fetchLootLog` writes
`set({ lootLog: response })` with nothing scoping the write to the request that asked for it, so array
identity means "*some* fetch succeeded", never "*this* one did". A generation ref fixes the **latch**
and not the **retraction**, because the component cannot tell which request produced an array it
merely observes.

So the retraction effects are gone. The verdict is now set and cleared by ONE `cancelled`-latched,
per-log code path: the tier effect. The case the retraction existed for — a refetch proving the logs
are fine — is covered better by the table's own `logsFailed && tierIsEmpty` gate, which stops the
message the moment rows exist, without anyone having to observe a fetch land.

This is the "cut it back rather than keep patching" option stated in round 6, and it removes two live
findings plus a whole class of staleness instead of adding a seventh piece of state.

**Residual, disclosed:** a failed load → mutations → deleting back to exactly zero rows still shows
"Couldn't load this tier's entries." The original load *did* fail, so that message is stale rather
than fabricated — strictly less wrong than the races that buying the retraction back would
reintroduce. The real fix is tier/request-scoped fetches in `lootTrackingStore`, queued with the
`fetchPageLedger` gating item.

---

## 6. Measured results (this slice; command named, run from `frontend/`)

| Gate | Result | vs `main` @ `257ec940` |
|---|---|---|
| `pnpm test` | **233 files / 3001 tests passed** | **+29** vs main's 2972, 0 failures |
| `pnpm lint` | **0 errors / 903 warnings** | **equal** — the ceiling, unchanged |
| `pnpm build` (`tsc -b && vite build`) | clean | — |
| `pnpm check:design-system:strict` | clean | — |
| `pnpm knip` | Unused exported types **141 → 140**; every other count identical | **+0** — D9a's disclosed +1 closed |
| `pnpm dupes` | 3.57 % lines / 4.01 % tokens, 322 clones | **equal**, no regression |

**Mutation checks.** Run as one scripted battery via `scripts/d9b-mutation-battery.py`, re-run against
**`f0cc5398`** — the tree this PR actually ships — after round 7 deleted the retraction mechanism and
changed the battery with it. Each mutation is applied alone, its spec run, then the file restored
byte-for-byte; the clean tree is re-checked at the end (both specs 0 failing). **This table is the
script's output, row for row** — if they ever diverge again, the script wins:

| Mutation | Tests killed |
|---|---|
| `?entry=` resolved against the filtered set instead of the raw logs | **1** |
| `timeZone: 'UTC'` dropped from the separator range formatter | **4** |
| `logsFailed` ungated from `tierIsEmpty` in the empty-message ladder | **1** |
| `currentWeek={logWeek.week}` instead of `clock.currentWeek` at the mount | **1** |
| `setFailed(true)` removed from `markFailed` | **3** |
| the per-log-promise catches collapsed to a batch-level catch | **1** |
| an identity-based retraction effect reintroduced (removed in round 7) | **1** |

⚠ **Two ways this table has already been wrong, both caught by review rather than by me.**
(1) The first run reported two false **zeros** — the script's fault, not the tests': a non-unique
anchor mutated `FairnessSummary` instead of the table, and a "batch-level catch" mutation left half
the old behaviour in place. A row reporting 0 means *either* a gap in the tests *or* a mutation that
missed; check the second before believing the first. (2) After round 7 the table still listed eight
rows naming the deleted retraction effects, whose anchors would print `ANCHOR MISSING` rather than a
kill — which is precisely the "reproducible evidence" claim collapsing. The lesson both times: an
audit trail that is not re-derived from the code it describes is decoration.

The `timeZone` row stays local-only — a UTC CI runner cannot distinguish it.

**Live browser pass**, 1440 viewport, DEVTST, both themes, 0 console errors from this surface:

- Separators render under Week desc **and** Week asc; vanish under Player and Date.
- Current-week marker verified against real data by logging one week-10 drop, capturing, then
  **deleting it again** (confirm modal's "also uncheck as acquired" unticked first, so no gear state
  was touched). History returned to 17 entries; the dev DB is no dirtier than it was.
- Light-theme current pill computes `rgb(10, 107, 96)` = `#0a6b60` = `accent-hover`, the exact value
  the archaeology's contrast comment names.
- **Re-measured** (D9a's lesson): min-content **836 px**, max-content **954 px** — +1 px vs D9a's
  835/953. The separator's `colSpan` cell does not move the intrinsic widths.
- The one console warning seen (`aria-hidden` on a focused `input.sr-only`) comes from the **delete
  confirm modal's** checkbox, not from this table — pre-existing, and already on the standing queue
  as the Modal focus-restore / index.css aria-hidden items.
