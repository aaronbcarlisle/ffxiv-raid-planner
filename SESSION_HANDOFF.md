# SESSION HANDOFF — Phase C slice C7 (flows + superuser affordances)

**Delete this file before opening the C7 PR.**

Branch `phase-c/c7-flows` is created off `main` at `38358e0` (= C6 / PR #199, merged).
Nothing but this file is committed on it. Start here.

---

## 1. What C7 is

Plan: `design/redesign/specs/phase-c-roster-plan.md` — slice row **C7** (line ~167) + unit
rows **D-05** (line 30), **D-15** (line 36), **D-55 roster half** (line 38).
Matrix: `design/redesign/specs/v1-v2-parity-matrix.md` rows D-05 (:148), D-15 (:158), D-55 (:512).

Three legs, independent of each other:

| Leg | Unit | What ships |
|---|---|---|
| 1 | **D-15** | Job-change confirm regains the third option — "Change Job **& Update BiS**" → straight into the BiS import |
| 2 | **D-05** | Gear → ledger jumps: **Alt+Click** a gear slot → its loot entry · **right-click** a slot → "Jump to Loot/Material Entry" · kebab **"Edit Books"** → the Books panel row |
| 3 | **D-55 (roster half)** | **R-062** Shift+Click the card copies its deep link · **R-076** the kebab hint tooltip that teaches the modifier-clicks |

`D-20` was struck from this slice (already shipped) — the closeout just verifies it.

### The binding ruling C7 inherits (do not re-litigate)

The user ruled this on PR #191 (C4) and it is **binding for every C7 jump**:

- **Alt+Click ONLY.** A plain mouse click must never navigate — "forcing the alt modifier makes
  it an intentional action."
- Keyboard **Enter** and **detail-0** activation (assistive tech) ride the same affordance.
- **The cursor reflects the modifier**: default arrow normally, pointer *only while Alt is held*,
  so an icon never advertises a plain click it won't honor.
- Superuser affordances are **shortcuts / right-click, not buttons** — deliberately discovered
  over time, not prominent controls.

---

## 2. Recon already done — verified in the source, do not re-derive

### The C4 reference implementation (copy this shape)

- **Jump URL** — `RosterCard.tsx:264-279` (`handleTomeMaterialJump`): same-route
  `setSearchParams` with `tab=gear` · `lview=history` · `entry={id}` · `entryType=material`.
  `LootHistoryTable` consumes those (scroll + pulse, self-clearing after 2.5s).
  It deliberately bypasses `setPageMode` — that would run `clearRegisteredTabParams` and wipe
  `lview` (director-verified in C4).
- **Alt-held cursor** — `useAltHeld()` at `RosterGearTable.tsx:63-83`. Global `keydown`/`keyup`
  + `blur` reset (a modifier pressed over a stationary cursor fires no pointer event).
- The C4 sub-row icon is the family's first shipped instance; C7 generalises it to the 11 gear
  slots and adds the right-click and Books legs.

### D-15 — legacy's three-option confirm

`components/player/PlayerCard.tsx:800-840` renders the modal; `confirmJobChange(updateBiS: boolean)`
is at `:233`. The buttons are **"Change Job & Update BiS"** (`:825`), "Change Job Only" (`:833`),
and cancel. v2's equivalent is a **two-option radio**: `type JobChangeMode = 'keep' | 'unlink'`
(`components/roster/RosterCard.tsx:136`), applied at `:390`. So the third option is a new mode
plus a hand-off into the import modal (the kebab already exposes `Import BiS` / `Update BiS` —
`useRosterCardActions.tsx:196` — so the modal exists; C5's `getMenuAction('Import BiS')` pattern
is how the card reaches it without duplicating state).

⚠ Note the wording differs: legacy says "**&**", the plan says "**and**". Pick one deliberately
and record it.

### D-05 — the Books leg is genuinely new navigation work

`components/loot/Loot.tsx:44-46` documents it: *"BookLedgerCard anchors rows (`id="book-row-…"`)
but no v2 navigation produces a book highlight yet."* So "Edit Books" needs a **param + anchor
scroll + highlight**, not just a link — budget for it. The loot/material jumps, by contrast,
reuse machinery that already works.

> ⚠ **Verify the premise before building.** C4's review produced a record correction because a
> handoff asserted a gap that didn't exist. Re-read `Loot.tsx` and `LootHistoryTable` before
> claiming what does or doesn't exist.

### D-55 — Shift+Click and the teaching tooltip

The kebab already has **"Copy URL"** (`useRosterCardActions.tsx:326`), which is exactly the
"dedicated button" the ruling says to de-emphasize — decide (and record) whether Shift+Click
*replaces* it or joins it. R-076 is the tooltip that teaches the modifiers; it has no v2
equivalent yet.

---

## 3. Process — non-negotiable, this is how C1–C6 shipped

1. **Invoke the `pr-checklist` skill** before opening or finalizing the PR.
2. **TDD red-first.** Watch every test fail for the intended reason first.
3. **Legacy byte-frozen.** Keep the `frontend/src` diff inside `components/roster/**`
   (+ `data/releaseNotes.ts`). Anything else is an **enumerated exception** justified in the PR
   body with its V1 render path (C5 shipped two, C6 one).
4. **Full gate from `frontend/`:** `pnpm build` · `pnpm lint` (**0 errors**) ·
   `pnpm check:design-system:strict` · `pnpm test` · `npx playwright test e2e/contrast.spec.ts` ·
   `pnpm dupes` (<5%). Re-count suite totals **on the head commit** whenever you cite them.
5. **Live browser validation**, desktop, **owner + member**, 0 console errors. Dev-auth
   `/api/dev-auth/login/0` (owner) and `/1` (member, Melee One), static `DEVTST`, `?shell=v2`.
   **The user's DEVTST data drift is theirs — leave it** (Tank Two `pursuing=true`, material
   entries 10 & 16). Restore anything you mutate, and verify it afterwards.
   *Jumps especially need live proof — the C4/C6 reviews both turned on behaviour jsdom can't show.*
6. **Matrix un-drift in-slice**: flip D-05 / D-15 / D-55-roster with recorded deltas.
7. **`xivrp-director` change-review BEFORE the PR**, all findings folded. It returned FALSE-DONE
   on both C5 and C6 — budget a real round, and expect it to check claims, not just code.
8. **Screenshots committed + embedded** (`docs/redesign/pr-shots/c7-*`).
9. **Internal release note**; verify the PR number **before and after** `gh pr create` (this has
   bitten three times: #190, #192, and the C6 prediction only held by luck).
10. **NO AI attribution** anywhere. Absolute.
11. After opening: run the **`pr-review-loop`** skill until a post-push review generates no new
    comments, then **stop — the user merges**.

### Hard-won lessons that apply directly to C7

- **A capture-phase key owner must SWALLOW, not decline.** The frozen
  `useGroupViewKeyboardShortcuts` shares `useKeyboardShortcuts`' tag-based guard and never checks
  `defaultPrevented`, so declining a key hands it over and it mutates an instance v2 never reads
  (C6 round 2: the URL gained `?subs=false` invisibly). Guards live in
  `components/roster/rosterShortcutGuards.ts`; `ownsLetterKeys` is scoped to an **open** listbox
  because Radix parks focus on the trigger after a selection (C6 round 3).
- **Never put an `aria-label` on a container whose contents are the information** — it replaces
  them. Use `tabIndex={0}` + `sr-only` framing text alongside (C5 round 8).
- **JSX strips newline-only whitespace**, so `Label\n<span class="sr-only">(x)</span>` announces
  as `Label(x)` — every sr-only expansion needs an explicit `{' '}`.
- A control's accessible name must **contain its visible label** (WCAG 2.5.3).
- **Radix wires tooltip content as `aria-describedby`** — content that merely repeats the
  trigger's name is announced twice; wrap it in `<span aria-hidden="true">`.
- Tests that render `Tooltip` need a `TooltipProvider` wrapper and a local `matchMedia` stub
  (see `RosterToolbar.test.tsx` for the pattern; keep the stub local, not in `src/test/setup.ts`).

---

## 4. Start-of-session checklist

```bash
git branch --show-current            # phase-c/c7-flows
curl -s localhost:8001/health        # backend; start as a BACKGROUND task if down
curl -s localhost:5174 >/dev/null    # frontend; same
```

Read, in order: this file → `phase-c-roster-plan.md` row C7 + §5 → matrix D-05 / D-15 / D-55 →
`RosterCard.tsx:264-279` + `RosterGearTable.tsx:63` (the jump pattern) →
`player/PlayerCard.tsx:800-840` (what D-15 restores) → `loot/Loot.tsx:40-50` (the Books gap).

After C7, one slice remains: **C8 — Lodestone re-home** (severable; §5 leaves both its scope and
its timing open).
