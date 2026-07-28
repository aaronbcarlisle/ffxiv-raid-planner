# Phase C — closeout verification

**Status: COMPLETE with 2 findings (1 fixed in this pass, 1 awaiting a user ruling).**
Run 2026-07-28 against `main` at `ccc1374` (C8 / PR #201 merged).

Phase C's eight slices (C1→C8) are all merged. This pass discharges the **phase-level**
definition of done in `phase-c-roster-plan.md` §4 — a verification pass, not more building.
It was kept out of the C8 PR deliberately (director ruling): bundling a twenty-unit audit into
a feature diff would have buried C8's own parity work.

---

## 1. DoD §4 item-by-item

| # | Requirement | Result |
|---|---|---|
| 1 | Every §1 in-scope unit demonstrably restored **in the running app** | ✅ §2 below — all 20 units accounted for, 14 exercised live |
| 2 | Cards and Board mutate gear through one shared path — **by test, not inspection** | ✅ `calculations.gearUpdate.test.ts` 5/5; `computeGearSlotUpdate` has exactly three call sites (`PlayerCard.tsx:192` legacy, `GearBoard.tsx:99`, `RosterCard.tsx:187/218/228`) and no fourth mutation route exists |
| 3 | A member-role account can edit their own card's gear in the live app | ✅ re-verified in an isolated member session during C8; the same `canEditPlayer` gate now also drives the Lodestone entry |
| 4 | Mobile: every restored control reachable at 390 px | ⏸ **SUPERSEDED, not skipped** — the user's 2026-07-26 ruling defers all mobile work to one consolidated pass at Phase P. Recorded here rather than silently dropped |
| 5 | V1 safety, two-part assert, **across C1…C8 as a set** | ✅ §3 below |
| 6 | No cross-shell preference bleed without a recorded decision | ⚠️ **Finding 2** — one bleed exists (`roster-hide-subs`), pre-dates Phase C, unrecorded |
| 7 | Release notes internal per slice; `CURRENT_VERSION` untouched | ✅ eight `internal: true` entries (C1…C8); `CURRENT_VERSION` still `2.1.1` |

---

## 2. D-01…D-20 sweep

Live checks ran against the v2 shell as owner (`DEVTST`), plus an isolated member session and
the legacy shell for the comparisons. 0 console errors throughout.

| Unit | Ruling | Verified how |
|---|---|---|
| **D-01** density axis | RESTORE | ✅ live — Compact ⇄ Expanded present; C1's re-click-to-fold and `V` binding shipped |
| **D-02** on-card gear editing | RESTORE | ✅ **live mutation** — Head slot cycled `Complete → Missing → Complete` and left restored |
| **D-03** BiS-source tools | RESTORE | ✅ live — per-slot source button (`BiS source: Raid`) renders in the expanded table |
| **D-04** tome sub-row | RESTORE | ✅ live — the Tome Weapon sub-row renders under Weapon |
| **D-05** gear → ledger jumps | RESTORE | ✅ **live behaviour** — plain click did **not** navigate; Alt+Click produced `tab=gear&lview=history&entry=44&entryType=loot` |
| **D-06** sort preset control | RESTORE | ✅ live — the preset selector renders and hydrates per tier |
| **D-07** Separate Subs toggle | RESTORE | ✅ live |
| **D-08** section collapse | RESTORE | ✅ live — per-section toggles present |
| **D-09** badges | RESTORE | ✅ live — SUB and BiS-link render |
| **D-10** card metrics | RESTORE | ✅ live — iLvl readout + the "average item level breakdown" panel |
| **D-11** identity | RESTORE (lean) | ✅ live — job · server identity line |
| **D-12** Lodestone sync | REDESIGN | ✅ live — sync line on the card; the re-homed flow (C8) demonstrated end to end, including a real sync |
| **D-13** PlayerSetupBanner | **KEEP V2** | ✅ v2 answer confirmed — no legacy banner; inline claim/assign affordances instead |
| **D-14** open-seat configure form | **KEEP V2** | ⚠️ **not demonstrable live** — the dev static has no unconfigured seat, and Phase A's A1 fix means "Add player" creates *and* configures atomically, so a blank seat can no longer be produced through the UI. Unit-covered by `OpenSeatCard.test.tsx` |
| **D-15** job change → BiS import | RESTORE | ✅ **live** — three options present; selecting "Update BiS for the new job" flips the action button to **"Change Job & Update BiS"**, matching the user's copy ruling exactly. Cancelled without committing |
| **D-16** per-card Adjust Priority | **KEEP V2** | ✅ confirmed absent from the card; the centralized Adjustments table stands |
| **D-17** roster sub-tab axis | **KEEP V2** | ✅ live — Cards ⇄ Board + "Manage characters" modal; no Split Planner peer tab |
| **D-18** Split Clear Planner | **RESTORE** | ⏸ **NOT DELIVERED IN PHASE C — by design.** Confirmed unreachable anywhere in v2. Flow-map **F-04 deferred the entry point to Phase-D design** (candidates on record: inside the Progress tab, or from Roster). Phase C never carried a D-18 slice; this is an accounting note, not a regression |
| **D-19** drag-reorder details | **KEEP V2** | ✅ live — Reorder mode present; whole-card grab accepted at ruling time |
| **D-20** error modal | ALREADY SHIPPED | ⚠️ **Finding 1** — shipped, but was unreachable in one state. Fixed in this pass; see below |

**Tally:** 14 verified live · 2 confirmed-by-absence (D-16, D-17) · 1 unit-covered only (D-14) ·
1 deferred by ruling (D-18) · 1 defect found and fixed (D-20) · 1 finding awaiting a ruling.

---

## 3. V1 safety across C1…C8 as a set

Base = `1fbdede` (the Phase-C plan merge, immediately before C1). Head = `ccc1374`.

**Part (a) — legacy-only paths.** `git diff --stat 1fbdede..ccc1374` over
`pages/GroupViewContent.tsx`, `pages/GroupView.tsx`, `components/player/`, `components/group/`,
`components/gear/`, `hooks/useGroupViewState.ts`, `hooks/usePlayerActions.ts`, `utils/`,
`stores/`, `gamedata/` and all of `backend/` → **empty**.

**Part (b) — every shared-file hunk enumerated.** Phase C touched 46 files. Outside
`components/roster/**` and tests, that is eight files, and only four are reachable from a legacy
render path:

| File | Slice | Why it is V1-safe |
|---|---|---|
| `ui/SegmentedToggle.tsx` | C1 | `+onReselect`, called as `onReselect?.()` in a branch that previously did nothing. Omitted → identical DOM and behaviour |
| `ui/LinkText.tsx` | C5 | `+external`, `+aria-label`. `external` omitted → `{...{}}` spread adds nothing; `aria-label={undefined}` is not emitted by React |
| `ui/SortModeSelector.tsx` | C6 | `+aria-label` only, same reasoning |
| `profile/freshness.ts` | C5 | seven **new keys** in `SOURCE_LABELS`; no existing key changed. Verified the only consumer of `formatSource` in the whole tree is v2's `RosterCard.tsx` — the profile components import other helpers from this module, not this one. Unreachable from legacy |
| `loot/Loot.tsx`, `loot/BookLedgerCard.tsx`, `hooks/useRosterCardActions.tsx` | C7 | v2-only files (no legacy importer) |
| `data/releaseNotes.ts` | all | eight `internal: true` entries, filtered at both levels in `ReleaseNotes.tsx:90-91` |

---

## 4. Finding 1 — D-20 was unreachable in the no-tiers state *(FIXED in this pass)*

**The defect.** A failing tier fetch sets an error **and** leaves the tier list empty. v2's
`ShellContentStates` returned early at its no-tiers branch, so the error modal — which lived only
in the final content branch — was never reached. The user saw a bare "No Raid Tiers" panel and
**no indication that anything had failed**. Legacy renders its no-tiers panel and the modal in the
*same* return (`GroupView.tsx:354-362` and `:415-416`), so it shows both.

**Proven, not inferred.** Both shells were driven against an identical simulated `500` on the
tier fetch:

- legacy → "No Raid Tiers" **+** the Error modal (message, TECHNICAL DETAILS, Copy, Report Bug)
- v2 → "No Raid Tiers" only; the error was swallowed

**The fix.** The overlay is hoisted to a `const errorOverlay` and rendered in every
`currentGroup`-truthy branch, which is what legacy's structure amounts to. Red-first test
`ShellContentStates.test.tsx` 4d. Re-verified live: the same simulated failure now shows the panel
**and** the modal, exactly one error dialog.

**D-20's own contract, verified while the modal was up:** message ✓ · TECHNICAL DETAILS block ✓ ·
Copy → "Copied!" → reverts after ~2 s ✓ · Report Bug → `https://discord.com/channels/…` ✓ ·
**no second modal stacks** ✓ (exactly one error dialog; `GroupRoute.tsx:20-24` renders exactly one
shell, so legacy's modal and v2's can never coexist by construction).

---

## 5. Finding 2 — one cross-shell preference bleed, unrecorded *(needs a ruling)*

DoD item 6 allows preference bleed only with a **recorded decision**. There is one, and it has no
ruling behind it:

**`roster-hide-subs`** is read and written by *both* v2's `Roster.tsx:143,147` and legacy's
`GroupViewContent.tsx:534,538` — the same key, no namespace. Toggling "Show subs" in one shell
changes the other.

- **It pre-dates Phase C.** Present in v2 at the Phase-C base commit; it came from F6c, where the
  code comment describes it as deliberate byte-for-byte replication of legacy's local state.
- **It is the same class as the defect the C6 director review caught** (drag-reorder writing
  legacy's `sort-preset-{tierId}`), which *was* fixed — that one was introduced by a slice, so it
  got caught; this one predates the slices and never came up for review.
- **Blast radius is small:** a view preference, not data. But it is a V1-visible write from v2,
  and C1 set the precedent of v2-scoped keys (`v2-roster-density`).

**Options:** (a) namespace it v2-side like the density key, accepting that the two shells then
remember "show subs" independently; (b) keep the shared key and record it as a deliberate
cross-shell continuity decision. Not fixed in this pass — it is a behaviour choice, not a bug.

---

## 6. Debts carried out of Phase C

| Debt | Owner |
|---|---|
| The rest of the `roster/Character*` eslint carve-out (shared leaves legacy mounts) | Dies when the character registry re-homes to Player Hub at **Stage 3** |
| Shared-leaf contrast slice — axe-core cannot resolve Tailwind-4 `oklab(… / α)` tints, so tinted badges pass the contrast gate blind | Queued since C3, unscheduled |
| D-18 Split Clear Planner entry point | **Phase D** (flow-map F-04) |
| `roster-hide-subs` (Finding 2) | Awaiting a user ruling |

---

## 7. Verdict

**Phase C is complete** — its eight slices are merged, its twenty units are accounted for, the V1
freeze held across the whole set, and the one defect this pass surfaced is fixed with a test that
would have caught it. Two items leave the phase openly rather than silently: D-18 by prior ruling,
and Finding 2 pending yours.
