# Session Handoff — 2026-09-17 (D7a finish chain closed; D7a is MERGED)

## Summary

**Phase D slice D7a is finished, shipped and MERGED — `main` is now `087c97c2` (PR #257,
squash-merged 2026-09-17T20:06Z).** The previous handoff described D7a as "built but not shipped"
on a local-only branch; that is now obsolete in every particular — the branch was merged with
`origin/main`, the full gate re-run, both reviews completed and their findings fixed, a live
browser pass performed, screenshots committed, and the PR opened and merged with 13/13 checks
green. **Correction to carry forward: the finish chain expected "14/14 checks"; this repo actually
runs 13 on a PR of this shape** — do not wait for a 14th. The next block of v2 redesign work is
**D7b** (D7 plan Tasks 4–6: Books card re-home to Log, column/row kebabs, `?book=` jump retarget),
which the D7 plan rules must happen in a **fresh session**; then D9a per the phase dependency
graph.

## Task Context

- **Original request:** "Read SESSION_HANDOFF.md and continue the work from where we left off …
  The next task is finishing Phase D slice D7a on the local-only branch `phase-d/d7a-log-resets`
  … Done = PR open, checks green, a real `claude[bot]` review comment present, and the review loop
  clean; merging is the user's call."
- **Status:** **Complete, and then some** — the user merged PR #257 during the session, so D7a is
  not merely open-and-green but landed on `main`.
- **Repo:** this checkout of `ffxiv-raid-planner` (the web app). The workspace root one level up
  holds the Dalamud plugin as a separate repo.
- **Branch:** this file lands from a short-lived `chore/session-handoff-d7a-merged` cut from
  `origin/main`. The D7a feature branch `phase-d/d7a-log-resets` still exists **locally**; its
  remote counterpart was auto-deleted on merge.
- **Remote:** `origin` = `aaronbcarlisle/ffxiv-raid-planner`, default branch `main`
  (`origin/main` = `087c97c2`, the D7a squash).

## Read These First

1. `design/redesign/specs/phase-d-loot-plan.md` §3 (slice table) + the dependency graph at ~:163 —
   **the binding order for what comes next**: after D7 → D9a → D9b → D10 → D11 → D12; D13 → D14.
2. `design/redesign/plans/2026-08-24-phase-d7-books-and-resets.md` — **the binding D7 plan**, now
   tracked on `main`. Tasks 1–3 + 7a shipped as D7a; **Tasks 4, 5, 6 + the D7b half of Task 7 are
   what D7b builds.** Its "Definition of done (slice level)" §2 is the browser-pass script, and the
   parts of it D7a could not exercise (Books card position, row/column kebabs, Mark-floor-cleared
   default, roster `?book=` jump) are exactly D7b's checklist.
3. `design/redesign/specs/phase-d-loot-design.md` — R-14 (the Books re-home D7b implements),
   R-16/R-22/R-25 (R-16 and R-25 carry dated D7a build notes, extended this session).
4. PR #257 on GitHub — its body is the surviving record of D7a's evidence, disclosures and review
   record. `.superpowers/` is git-ignored, so the SDD ledger will not exist in a fresh clone.
5. `CLAUDE.md` (repo) + `.claude/skills/pr-checklist/SKILL.md` — CI-enforced PR rules; **no AI
   attribution in commits or PR bodies, ever.**
6. `.claude/agents/` — `xivrp-implementer`, `xivrp-implementer-deep`, `redesign-reviewer`,
   `xivrp-director` are the pinned implement/review roles, with the roster table in `CLAUDE.md`.

## Work Completed

All of it on the D7a branch, now squashed into `main` as `087c97c2`:

- Merged `origin/main` into the branch (0 conflicts), reinstalled, **re-ran the full gate** against
  merged main including the `@dnd-kit/sortable` 8→10 major.
- Committed the previously-untracked D7 plan file so the slice's DoD ships with the code.
- **Live browser pass** on `?shell=v2` with the displayed week driven away from the clock week, and
  two resets actually **executed** with the API diffed before/after (see Measured Results). Also
  verified: floor kebab ≡ right-click menu; R-22 clock-divergence notice intact; viewer sees no
  reset affordances; History unchanged; light-mode spot-check; console clean.
- 11 `docs/redesign/pr-shots/d7a-*.png` committed and SHA-pinned into the PR body.
- **Whole-branch `redesign-reviewer` review** → Approve-with-changes, **no Must-fix**.
- **`xivrp-director` change-review** → Approve-with-changes, **zero code-level findings**.
- Fixed every finding from both (all were records or tests claiming more than the code did) — see
  Key Decisions.
- Ran the `pr-checklist` skill, opened PR #257 against the repo's PR template, backfilled
  `pr: 257`, ran the review loop to a clean bill. User merged.
- Updated the project memory entry for Phase D to the shipped state.

## Work Remaining

- [ ] **(NEXT) D7b — D7 plan Tasks 4, 5, 6 + the D7b half of Task 7, in a FRESH session.**
      Done = a PR to `main`, CI-green on every check, with embedded SHA-pinned `d7b-*.png`
      screenshots and its own internal release-note entry (`pr:` backfilled from 0,
      `CURRENT_VERSION` untouched). Scope:
  - [ ] **Task 4** — re-home `BookLedgerCard` from the v2 History view to the v2 **Log** view at
        `logWeek.week` (R-14), restoring the per-row `JobIcon`. Per **R-D7c** the card sits **after
        the fairness block, ungated**, and the fresh-static render must be preserved and
        screenshotted. Feeding `logWeek.week` re-points its scope toggle, its `adjustBookBalance`
        write and its `MarkFloorClearedModal` default at once. Its `?book=` consumption effect has
        no `lview` gate of its own, so it re-mounts under Log with zero consumer changes.
        **F-1 convention: `BookLedgerCard` renders REAL in `Loot.test.tsx` — never `vi.mock` it.**
  - [ ] **Task 5** — Books column and row kebabs that **follow the toggle** (one item each, unlike
        the floor kebab's two), using the same `ui/ContextMenu` two-trigger pattern D7a shipped.
        Labels per **R-D7d**: column `Reset Floor {F} books (Week {N})`, row
        `Reset {playerName}'s Week {N} books`, all-time items keep the `Reset ALL …` shape.
        **R-D7f** scope-toggle label — `This week (Week N)` when displayed = clock, `Week {N}` when
        diverged — is Task 5's, and is the one ruling D7a deliberately did not implement.
  - [ ] **Task 6** — retarget `RosterCard.tsx`'s `?book=` jump from `lview=history` to `lview=log`.
  - [ ] **Task 7 (D7b half)** — R-14 build note, the **D-38/D-39 parity-matrix rewrites**, own
        release note. Note D7a already corrected three *other* parity-matrix lines it invalidated
        (see Key Decisions); D-38/D-39 are still owed.
  - [ ] The planner and confirm gate already exist and need no changes: `deletePlayerLedger` and
        `clearPlayerWeekPageLedger` are wired through `resolveResetActions` but **unreachable until
        D7b's row kebab makes them so.** `ui/ResetConfirmModal.tsx` already has branches for the
        player-scoped configs.
- [ ] **D9a** (History table) next per the dependency graph, then D9b → D10 → D11 → D12.
- [ ] **Housekeeping (small, not blocking):** delete the local `phase-d/d7a-log-resets` branch.
      Because #257 was **squash**-merged, its commits are not ancestors of `main`, so `git branch -d`
      will refuse — `git branch -D` is required and is safe here (everything is in `087c97c2`).
- [ ] **Standing phase-level queue (do not pick up inside D7b):** narrow the `index.css`
      aria-hidden rule; Tooltip disabled-trigger keyboard gap; `ui/Select` effect-ordering race;
      deadcode always-red baseline chore; Modal focus-restore; `eslint.config.js`
      `a11yRecommendedWarn` mapping; the pre-existing unsuppressed
      `jsx-a11y/no-static-element-interactions` warning at `LogWeekGrid.tsx:481`.
- [ ] **New to the queue from D7a's review round:** the unconditional
      `await fetchPageLedger(groupId, tierId)` after every reset (`Loot.tsx`, pre-existing on main
      since before D7a). Copilot flagged it on #257; it was **refuted as a finding against that PR
      and queued instead** — see Key Decisions. The fix shape is gating it on
      `plan.bookOp.kind !== 'none'`, and the existing `Loot.test.tsx` assertion on the call would
      need updating in the same change.
- [ ] **Three a11y gaps named in the R-D7b interim**, for the kebab-family queue: `ui/ContextMenu`
      has no `aria-expanded`, no focus-restore-on-close, closes on scroll, and **mis-anchors a
      keyboard-invoked context menu** (Shift+F10 bubbles to the header div, so the menu lands at
      the bar's far left instead of at the kebab). Enter/Space on the kebab is unaffected.

## Measured Results

Every number below was produced this session by the command named, against the branch **after**
merging `origin/main`. Nothing is carried forward from the 2026-08-24 build session.

| Measurement | Value | Command |
|---|---|---|
| Merge conflicts merging `origin/main` into the branch | 0 | `git merge origin/main` |
| Build | clean | `pnpm build` (`tsc -b` + vite) |
| Lint | **0 errors**, 903 warnings (all pre-existing) | `pnpm lint` |
| Design-system strict | no violations | `pnpm check:design-system:strict` |
| Duplication (jscpd, `history/` in scope) | **4.02%** tokens / 3.58% lines, 322 clones over 527 files — threshold is 5% | `pnpm dupes` |
| Token drift | none | `pnpm tokens:check` |
| Dead code vs main baseline | **+1 line** (`BookResetOp`, part of `ResetActionPlan`'s public shape); 378 vs 377 lines, exit 1 both | `pnpm deadcode`, diffed against a knip run with the branch's loot files reverted to main |
| Frontend tests | 234 files / **2924** tests pass (2923 before the review round added one) | `pnpm test` |
| Changelog script tests | **139/139** | `npm test` in `scripts/` |
| V1 safety: `history/` diff | **empty** | `git diff --stat origin/main...HEAD -- frontend/src/components/history/` |
| V1 safety: `ResetConfirmModal.tsx` diff | **empty** (consumed only) | same, on that path |
| PR #257 checks | **13/13 pass** (not 14 — see Summary) | `gh pr checks 257` |
| Branch diff at merge | 23 files, +1601 / −177 | `git diff --stat origin/main...HEAD` |

**Browser pass, displayed Week 3 vs clock Week 9 — floor reset on M9S (confirm copy: "Floor 1 in
Week 3"):**

| Bucket | Before | After | |
|---|---|---|---|
| Loot W3/M9S | 2 | **0** | the target scope |
| Loot W3/M11S | 1 | 1 | survives — other floor, same week |
| **Loot W2/M9S** | 1 | 1 | survives — **same floor, other week** |
| Loot W2/M12S | 1 | 1 | survives |
| Materials W3/M10S, W2/M10S | 2, 2 | 2, 2 | survive |

**Then the toolbar's "Reset Week 3 loot":** loot W3/M11S 1→**0** and materials W3/M10S 2→**0**,
while W2/M9S, W2/M12S and materials W2/M10S were untouched. Week 3 swept, Week 2 intact, clock
week 9 never consulted.

## Key Decisions Made

| Ruling | Rationale | Risk if wrong |
|---|---|---|
| **RETIRED: "D7a is built but not shipped."** | The previous handoff's central claim. D7a is now merged as `087c97c2`; that handoff is superseded in full by this file. | None — the correction is this document |
| **RETIRED: "14/14 checks green" as the acceptance bar** | Measured: this PR ran **13** checks, all green. The 14 was an expectation, not an observation. | Low — a future session could stall waiting for a check that never runs |
| Prove the destructive path by **executing** resets against a diverged week and diffing the API, not by reading labels | Labels and confirm copy can be right while the handler is wrong. Driving displayed W3 / clock W9 and watching **W2/M9S survive an M9S reset** proves floor *and* week scoping in one observation. | None — this is the technique that produced the evidence |
| **Mutation-test any arg-order assertion whose two values could coincide** | The reviewer found a vacuous test: `clearFloorPageLedger` was asserted at floor 1 / week 1, so `(…, 1, 1)` passed whether or not the production arg order was right. Fixed to floor 2 and verified by swapping the args in `Loot.tsx` (test fails) and reverting (test passes). | None — now a load-bearing assertion |
| Two legacy-identical planner edges **recorded, not hardened** | (a) `{scope:'week'}` with no `week` sweeps the tier — but the shared confirm copy honestly promises a tier-wide wipe for that config, so failing closed would make the modal lie and then no-op. (b) An unknown tier id makes a floor reset a silent no-op — under-delete, not over-delete. Both unreachable from any UI; both now named in the `resetActions.ts` docblock so it stops reading as "every omission is caught". | Low — if either becomes reachable, the docblock says exactly what happens |
| Copilot's `fetchPageLedger` finding **refuted against #257, queued instead** | The observation is correct on its merits, but the two lines are **verbatim pre-existing on `main`** (`git show origin/main:…/Loot.tsx` at `:773-774`). Editing them would be an unrelated behavior change on a destructive path in the one PR whose point is that the destructive path is provable. Evidence posted on the PR. | Low — it is a redundant GET on a type-RESET-to-confirm flow, and over-fetching cannot show a stale ledger |
| Director's five doc findings fixed rather than deferred | All were records outrunning code: the release note claimed History "keeps only its per-entry actions" (false — `BookLedgerCard` + `FairnessSummary` still mount there until D7b/D14) and that all six reset options follow the displayed week (only the three week-scoped ones do); three `v1-v2-parity-matrix.md` lines still placed the menu in the History toolbar. | None — this is the exact drift class that produced this branch |
| D7b stays a fresh session (the 2026-08-24 split ruling stands) | Sizing ≈2,250 lines for one PR busts the ~1,500-line budget. | None new |
| `SESSION_HANDOFF.md` is always tracked, lives on `main`, lands via a docs-only `chore/*` PR | User ruling 2026-09-17. `main` is protected by six required checks, so a direct push is rejected. Never commit it to a feature branch. | None |

## Files Modified

**This session** (`git diff --stat 8df80700..82efe4c4`, excluding the dependency churn the
`origin/main` merge brought in):

| File | Change |
|---|---|
| `design/redesign/plans/2026-08-24-phase-d7-books-and-resets.md` | newly tracked — the binding D7 plan, previously untracked |
| `docs/redesign/pr-shots/d7a-*.png` | 11 new browser-pass screenshots |
| `design/redesign/specs/phase-d-loot-design.md` | R-16 build note: present-tense mechanism split, duty-vs-position vocabulary, materials-ride-with-loot, third a11y gap |
| `design/redesign/specs/v1-v2-parity-matrix.md` | three lines corrected from History toolbar → Log |
| `frontend/src/components/loot/resetActions.ts` | docblock narrowed; two legacy-identical edges named (+18) |
| `frontend/src/components/loot/resetActions.test.ts` | added the case pinning playerId over **floor** (+11) |
| `frontend/src/components/loot/Loot.test.tsx` | vacuous arg-order assertion made load-bearing (+10/−) |
| `frontend/src/data/releaseNotes.ts` | 2.1.21 corrected, dated to ship day, `pr: 257` backfilled |

**Inherited from the 2026-08-24 build session** and merged with the rest: `loot/resetActions.ts`
(new planner), `loot/resetActions.test.ts` (new suite), `loot/Loot.tsx` (handler rewrite + slot
move + floor wiring), `loot/Loot.test.tsx`, `loot/LogWeekGrid.tsx` (floor kebab conversion),
`loot/LogWeekGrid.test.tsx`, `loot/LootResetMenu.tsx`, `loot/LootToolbar.tsx`.

## Important Context

- ⚠️ **`tsc --noEmit` ≠ `tsc -b`.** Run `pnpm build` from `frontend/`, not a bare typecheck. CI runs
  `tsc -b`.
- ⚠️ **Green-commit hook:** `.claude/hooks/pre_bash_guard.py` runs whole-project `tsc -b` on any
  commit with staged frontend TS. Every commit must build.
- ⚠️ **`pnpm deadcode` (knip) always exits 1 locally**; CI runs it `continue-on-error`. The gate is
  a before/after diff against a baseline, not the exit code. **Recipe that worked:** `git checkout
  origin/main -- <changed paths>`, move any *new* files aside, run knip, restore, diff the two
  outputs.
- ⚠️ **jscpd is blocking CI** at a 5% threshold with `components/history/` in scope. D7a sat at
  4.02% tokens; D7b adds more re-expressions of frozen legacy code, so **watch this number**.
- ⚠️ **A green `claude-review` check is NOT a review.** Confirm a real comment from `claude[bot]` or
  Copilot exists. On #257 both posted for real.
- ⚠️ **`prTitle` in `releaseNotes.ts` is the PR title**, not a commit subject (two bots have flagged
  this). `pr: 0` is the placeholder; backfill it the moment the PR opens.
- ⚠️ **Internal release entries must NOT bump `CURRENT_VERSION`.** It must equal the latest
  **non-internal** entry's version — currently `2.1.17`, because 2.1.18–2.1.21 are all internal.
  `scripts/discord-changelog.test.js` enforces this.
- ⚠️ **Dependabot clobbers uv `--universal` markers** on backend bumps. If
  `backend/requirements.txt` shows fewer than 6 `;` markers, that is the cause.
- ⚠️ **GitHub auto-merge silently stalls on this repo.** Merge explicitly after verifying checks.
- **Browser validation recipe (worked end to end this session):** start the backend as a background
  task — `backend/venv/Scripts/uvicorn.exe app.main:app --port 8001` — and the frontend with
  `pnpm dev --port 5174 --strictPort` from `frontend/`; `dev.ps1` cannot launch the frontend
  (pnpm `.cmd`), and a foreground-started backend dies when the tool call returns. Sign in by
  navigating to `http://localhost:8001/api/dev-auth/login/0`, then
  `http://localhost:5174/group/DEVTST?shell=v2`.
  - To test as a **read-only viewer**: the auth cookie is httpOnly, so clearing cookies from JS
    does not work. POST `/api/auth/logout` with the `csrf_token` cookie echoed in an `X-CSRF-Token`
    header, then revisit the group URL — the share-code path renders anonymously.
  - The frontend dev server does **not** proxy `/api`; call `http://localhost:8001/api/...` with
    `credentials: 'include'` when reading state from the page.
  - **DEVTST fixture state changed:** the two executed resets really deleted the static's Week 3
    loot and material entries. Week 2 data survives. Re-seed if a future slice needs Week 3 rows.
- **Dev servers may still be running** from this session on :8001 and :5174.
- Windows: timestamp-ordering tests can flake locally (15.6 ms clock tick), never in Linux CI.

## Blockers / Issues

- **Blocking:** none. D7a is merged; D7b can start immediately in a fresh session.
- **Open (not blocking) — screenshot convention vs practice.** The pr-shots convention says shots
  are "netted out before merge", but the 11 `d7a-*.png` landed on `main` in the squash, alongside 9
  `d5-*` and 8 `d6a-*` from earlier slices (only D6b's were actually netted out).
  `docs/redesign/pr-shots/` is now **52.8 MB across 179 files** on `main`. Either the convention
  should be retired as not-what-we-do, or a cleanup sweep is owed — worth a ruling before D7b adds
  more.
- **Open (not blocking):** the local `phase-d/d7a-log-resets` branch needs `git branch -D` (see
  Work Remaining).

## Continuation Prompt

```
Read SESSION_HANDOFF.md and continue the work from where we left off. Start by summarizing what was done and what remains, then proceed with the next task.

The next task is Phase D slice D7b — D7 plan Tasks 4, 5 and 6 plus the D7b half of Task 7 — in this fresh session, off a new branch cut from main (`087c97c2`, the D7a squash): re-home BookLedgerCard from v2 History to v2 Log at `logWeek.week` with per-row JobIcons, placed after the fairness block and ungated per R-D7c (render REAL in Loot.test.tsx, never vi.mock it); add Books column and row kebabs that follow the toggle, one item each, using the ui/ContextMenu two-trigger pattern D7a shipped, with R-D7d labels (`Reset Floor {F} books (Week {N})`, `Reset {playerName}'s Week {N} books`, all-time keeps `Reset ALL …`); implement R-D7f's scope-toggle label (`This week (Week N)` when displayed = clock, `Week {N}` when diverged); retarget RosterCard.tsx's `?book=` jump from `lview=history` to `lview=log`; then the R-14 build note, the D-38/D-39 parity-matrix rewrites and an internal release note. Follow the same finish chain D7a used: director plan-vet → build → full local gate (build, lint 0 errors, check:design-system:strict, `pnpm dupes` under the 5% jscpd threshold — D7a measured 4.02%, deadcode vs baseline, tokens:check, `pnpm test`) with `git diff --stat origin/main...HEAD -- frontend/src/components/history/` EMPTY → whole-branch redesign-reviewer + xivrp-director change-review → live browser pass with displayed week ≠ clock week, proving scoping by executing a reset and diffing the API before/after → commit d7b-*.png screenshots → pr-checklist → PR. Done = PR open, every check green (this repo runs 13, not 14), a real claude[bot] review comment present, review loop clean; merging is the user's call.
```
