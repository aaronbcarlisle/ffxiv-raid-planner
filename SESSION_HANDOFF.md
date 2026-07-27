# SESSION HANDOFF — Phase C slice C6 (toolbar restorations)

**Delete this file before opening the C6 PR.**

Branch `phase-c/c6-toolbar` is created off `main` at `25b64f7` (= C5 / PR #193, merged).
Nothing is committed on it yet. Start here.

---

## 1. What C6 is

Plan: `design/redesign/specs/phase-c-roster-plan.md` — slice table row **C6** (line ~166),
unit rows **D-06 / D-07 / D-08** (lines 31-33). Matrix: `design/redesign/specs/v1-v2-parity-matrix.md`.

Four things ship:

| # | Unit | What returns |
|---|---|---|
| 1 | **D-06** | `SortModeSelector` returns to the v2 toolbar **+ v2-side `sort-preset-{tierId}` hydration that follows tier switches** |
| 2 | **D-07** | Visible **Separate Subs** toggle **+ a v2-side `S` binding** |
| 3 | **D-08** | **Per-section collapse chevrons**, persisted per static+tier |
| 4 | C1 carry-over | **Re-click-Expanded = section expand/collapse-all** (moved out of C1 at the checkpoint) |

Plus two C1-checkpoint corrections that reshape the toolbar itself:

- **(a) sort-vs-grouping split.** Today's "Standard comp ⇄ Light Party" dropdown conflates two
  axes. The dropdown becomes the **sort-preset selector** (reorders cards *within* their groups;
  sorts the flat grid when ungrouped); **grouping on/off becomes a distinct G1/G2-style toggle**
  (v1 parity).
- **(c) Show Subs gates Separate Subs.** Separate Subs renders **disabled** until Show Subs is on.
  This is a deliberate **v2 behaviour rule** that fixes a v1 defect (v1 lets both toggle
  independently) — record it as a matrix delta.

**Slice-time decision with a default** (plan §5): does the subs toggle inherit the
`hasSubstitutes` gate, or render disabled? **Default: inherit the gate** — the existing v2
toolbar already does this (`RosterToolbar.tsx:110`). Confirm with the user in the PR body.

---

## 2. Recon already done — verified at the source, do not re-derive

### D-06: the defect is real, and here is exactly where it lives

`useGroupViewState` is **per-instance `useState`**. Its `sortPreset` initializer
(`src/hooks/useGroupViewState.ts:259-265`) is **URL param → `'standard'`**, and carries the
comment *"Will be overwritten by tier-specific localStorage in useEffect."*

That useEffect exists **only in the legacy hosts** — `GroupViewContent.tsx:205-215` and
`GroupView.tsx:174` — and it calls the raw `setSortPresetState`, which writes **no URL param**.
So there is no cross-instance channel.

v2's `Roster` calls its **own** `useGroupViewState()` (`Roster.tsx:123-133`) and sorts by that
instance's `sortPreset` (`Roster.tsx:197-200`). **Result: v2 ignores the stored preset unless
`?sort=` happens to be in the URL.** The plan's vet finding is confirmed.

> ⚠ **Verify the mount premise before you build.** C4's review round 3 produced a record
> correction because a handoff asserted a "gap" that did not exist — `GroupViewContent` turned
> out to fetch for **both** shells. Same trap here: even if `GroupViewContent` *is* mounted under
> v2, its hydration writes a **different hook instance** than the one `Roster` reads, so the
> defect stands — but say that precisely rather than "the effect never runs."

**Design constraint for the v2-side hydration:** it must key on the tier and **follow tier
switches** (the plan's words), and it must not write the URL in a way that fights legacy's
`setSortPreset` (which *does* write both localStorage and the URL). Read `setSortPreset`
(`useGroupViewState.ts:394-410`) before choosing where v2 writes.

### Current v2 toolbar

`src/components/roster/RosterToolbar.tsx` (+ `RosterToolbar.test.tsx`). Today: view
`SegmentedToggle` (Cards/Board) · density `SegmentedToggle` (C1) · grouping `Dropdown`
("Standard comp"/"Light Party") · "Show subs" `Toggle` (gated on `hasSubstitutes`) · spacer ·
"Reorder" · "Add player". The grouping `Dropdown` at `:98-108` is what splits in (a).

### Other live wiring

- `subsHidden` is **not** in the hook — `Roster.tsx:137-143` replicates GroupViewContent's
  local state against the **same** `roster-hide-subs` key.
- `subsView` **is** in the hook (this is the "Separate Subs" axis; D-07). `RosterCards.tsx:396`
  and `:435` compute `showSubs = subsView && !subsHidden && …` — so the gate in (c) already has
  its data shape.
- `hasSubstitutes` is derived in `Roster.tsx:239`.
- Density lives in `useRosterDensity` (C1, v2-scoped key `v2-roster-density`, capture-phase `V`).
  **Copy this hook's shape for the `S` binding and the section-collapse persistence** — it is the
  sanctioned v2-local pattern and it already solves the "shared handler mutates an instance v2
  never reads" problem.
- Legacy `SortModeSelector` (`src/components/ui/SortModeSelector.tsx`) is a thin `Select`
  wrapper — a **shared leaf**, so remount it rather than forking (C3 precedent). Check whether
  its `w-36` wrapper suits the v2 toolbar before deciding.

---

## 3. Process — non-negotiable, this is how C1-C5 shipped

1. **Invoke the `pr-checklist` skill** before opening or finalizing the PR (it now owns the
   release-note rules that used to live in CLAUDE.md).
2. **TDD red-first.** Watch every test fail for the intended reason before implementing.
3. **Legacy stays byte-frozen.** Keep the `frontend/src` diff inside `components/roster/**`
   (+ `data/releaseNotes.ts`). Any other file is an **enumerated exception** justified in the PR
   body (C5 shipped two: `LinkText.tsx`, `freshness.ts`). Fork-and-restyle if a shared leaf
   cannot remount; share the leaf if it can.
4. **Full gate from `frontend/`:** `pnpm build` · `pnpm lint` (**0 errors**) ·
   `pnpm check:design-system:strict` · `pnpm test` · `npx playwright test e2e/contrast.spec.ts`.
   Re-count suite totals **on the head commit** each time you cite them.
5. **Live browser validation**, desktop, **owner + member** contexts, 0 console errors.
   Dev-auth `/api/dev-auth/login/0` (owner) and `/1` (member, Melee One), static `DEVTST`,
   `?shell=v2`. **The user's DEVTST data drift is theirs — leave it** (Tank Two `pursuing=true`,
   material entries 10 & 16). Anything you mutate for a screenshot, **restore**.
6. **Matrix un-drift in-slice**: flip D-06/D-07/D-08 with recorded deltas — including the (c)
   Show-Subs-gates-Separate-Subs v2 behaviour rule and the (a) toolbar split.
7. **`xivrp-director` change-review BEFORE the PR**, all findings folded. It returned FALSE-DONE
   on C5 and caught a record correction; budget for a real round.
8. **Screenshots committed + embedded** in the PR body (`docs/redesign/pr-shots/c6-*`).
9. **Internal release note** in `releaseNotes.ts` — verify the PR number **before and after**
   `gh pr create`. This has now bitten twice (#190, #192 taken between prediction and push).
10. **NO AI attribution** anywhere in commits or the PR. Absolute.
11. After opening: run the **`pr-review-loop`** skill until a post-push review generates no new
    comments, then **stop — the user merges**.

### What the C5 review loop taught (10 rounds — apply these up front)

- **Never put an `aria-label` on a container whose contents are the information.** It *replaces*
  them. Use `tabIndex={0}` for the focus path + `sr-only` framing text alongside.
- **JSX strips newline-only whitespace**, so `Label\n<span class="sr-only">(x)</span>` announces
  as `Label(x)`. Every sr-only expansion needs an explicit `{' '}`.
- **`{/* eslint-disable-next-line */}` in JSX covers the next LINE**, not the next element — put
  the attribute on the directive's line or the rule fires *and* the directive reports unused.
- **Radix wires tooltip content as `aria-describedby`** — content that merely repeats the
  trigger's name is announced twice; wrap it in `<span aria-hidden="true">`.
- A control's accessible name must **contain its visible label** (WCAG 2.5.3) — voice control
  matches on the visible word.
- `claude-review` **now posts real findings** (fixed in #194-#198) and reviews on every push.

---

## 4. Start-of-session checklist

```bash
git branch --show-current            # phase-c/c6-toolbar
curl -s localhost:8001/health        # backend; start as a BACKGROUND task if down
curl -s localhost:5174 >/dev/null    # frontend; same
```

Read, in order: this file → `phase-c-roster-plan.md` row C6 + §2.1 + §5 → matrix D-06/D-07/D-08
→ `RosterToolbar.tsx` → `Roster.tsx:121-260` → `useRosterDensity.ts` (the pattern to copy).

Housekeeping: the merged `phase-c/c5-badges` local branch still exists — the user deletes
branches, so leave it unless they say otherwise.
