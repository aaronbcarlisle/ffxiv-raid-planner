# SESSION HANDOFF — Phase C slice C8 (Lodestone re-home)

**Delete this file before opening the C8 PR.**

Branch `phase-c/c8-lodestone` is created off `main` at `629d1d9` (= C7 / PR #200, merged).
Nothing but this file is committed on it. Start here.

**C8 is the last Phase-C slice.** When it merges, Phase C closes — which means this slice also
owns the phase-level closeout (§7).

---

## 1. What C8 is

Plan: `design/redesign/specs/phase-c-roster-plan.md` — slice row **C8** (line 168).
Matrix: `design/redesign/specs/v1-v2-parity-matrix.md` row **D-12** (line 155).
Flow map: `design/redesign/specs/systems-flow-map.md` §2.2 (line 100) + §3 (line 134).

**The loss:** legacy's whole Lodestone character-sync flow — search → preview → sync → compare —
is reachable from exactly one place in the app: the PlayerCard kebab (`PlayerCard.tsx:357-363`).
v2 has no card kebab entry for it, and the fact-check (`phase-b-audit/ambiguity-factcheck.md` Q3)
confirmed `RosterCharacterPanel` has **no** Lodestone search of its own. So in v2's in-static
surfaces the flow is currently **unreachable**. That is why D-12 was re-classified CHANGED → LOST.

**The units this slice restores** (`phase-b-audit/legacy-roster.md`):

| Unit | What it is |
|---|---|
| **R-041** | The entry point itself — kebab item, label flips on linked state, gated on `editPermission.allowed` |
| R-132 | Character search (name + server, Enter-to-search, results list) |
| R-133 | Dev mock-mode quick search (non-production only) |
| R-134 | Manual Lodestone URL / raw ID paste |
| R-135 | Linked-character panel (Preview / Force refresh) |
| R-136 | Equipped-gear preview grid (avg iLv current vs BiS, per-slot match badges) |
| R-137 | Sync button |
| R-138 | Pre-sync overwrite warning (`computeSyncWarnings`) |
| R-139 | "Link identity only" fallback |
| R-140 | Post-sync compare panel |
| R-141 | Job-mismatch / stale-data notices |

**R-132…R-141 all live inside `LodestoneSearchModal` and are already built.** They are LOST only
because nothing in v2 opens the modal. **The deliverable is the entry point (R-041), not the
flow.** Do not rebuild the modal.

The D-12 **rider** (R-072, the card's sync status line) already shipped in C5 — the matrix row
records it. C8 owns the flow only.

---

## 2. The two rulings that opened this slice (2026-07-27) — do not re-litigate

Both were the plan's §5 silent defaults; the user ruled them explicitly.

### Ruling 1 — timing: **C8 stays in Phase C, built now.**
Not slid to Stage 3. The Characters surface remains a declared bridge
(`CharacterManageBridge.tsx:1` says so in its own header comment); when Stage 3 re-homes the
character registry to Player Hub, the flow moves with it.

### Ruling 2 — mount: **the v2-owned wrapper. No shared-file edit, no shell gating.**
The §2.2 shared-surface exception is resolved by **structure, not by a gate**:

- `RosterCharacterPanel` and `RosterCharacterMemberCard` mount in **both** shells
  (legacy `GroupViewContent.tsx:948`, v2 `CharacterManageBridge.tsx:31`) — **do not touch them.**
- `CharacterManageBridge.tsx` is **v2-only** (`components/roster/CharacterManageBridge.tsx`,
  mounted at `Roster.tsx:478` in the `PageHeader` actions slot, and nowhere else — verified).
  The entry goes **there**.
- Consequence: zero V1 impact *by construction*. The V1-safety assert (plan §4.5) is satisfied by
  part (a) alone — the legacy-only-paths diff is empty and there are **no shared-file hunks to
  enumerate**. If the implementation starts wanting a shared-file edit, that is a signal the
  design drifted from the ruling — stop and surface it, don't add an "additive, DOM-identical"
  prop on the shared panel without a fresh user ruling.

The third option (explicit V1-visible delta, like the approved Danger-Zone one) was **rejected**:
legacy already reaches the flow from its kebab, so a shared-panel entry would add a redundant
second V1 entry that fixes nothing there.

---

## 3. Recon already done — verified in the source, do not re-derive

### The modal's contract (`components/player/LodestoneSearchModal.tsx:941-985`)

```tsx
<LodestoneSearchModal
  isOpen={...} onClose={...}
  groupId={string}
  playerId={string}
  playerName={string}
  tierId={string | undefined}
  currentLodestoneId={string | null | undefined}
/>
```

It owns its own reset (`useLodestoneStore.resetState` on `isOpen`/`playerId`/`currentLodestoneId`)
and re-keys its body on `${playerId}:${currentLodestoneId}`. So mounting **one** modal instance in
the bridge and swapping which player it targets is safe — no per-player instance needed.

### What the bridge has and what it lacks

`CharacterManageBridge` receives `groupId`, `players: SnapshotPlayer[]`, `canEdit`
(`Roster.tsx:478`). Everything the modal needs is on `SnapshotPlayer` — `lodestoneId`
(`types/index.ts:840`), `name`, `id` — **except `tierId`**, which is available at
`Roster.tsx:197` (`tier?.tierId`) and must be threaded in as a new prop.

### ⚠ The permission trap — `canEdit` here is NOT legacy's gate

`Roster.tsx:478` passes `canEdit={canManage}` (owner/lead). Legacy's R-041 is gated on
`editPermission.allowed` = **`canEditPlayer`** (`utils/permissions.ts:73`), which is **per-player**:
*a member can sync their own claimed player.* Reusing the bridge's roster-level `canEdit` for the
Lodestone entry would silently drop that capability — the exact class of loss the holistic review
flagged and C2 restored for gear editing (`canEditGear`/`canEditPlayer`, member-own-card, live-proven).

**Compute `canEditPlayer` per player for this entry**, independent of the bridge's `canEdit`
(which stays what it is for the shared panel's create/link/delete actions). A member who can edit
exactly one player should see exactly one enabled Lodestone entry — demonstrate that live, as C2 did.

### Copy — legacy is the source of truth for a restore (user ruling, C7)

`PlayerCard.tsx:358`: `player.lodestoneId ? 'Re-sync Lodestone' : 'Lodestone Sync'`. Use those two
strings verbatim. Vocabulary check still applies to any *new* framing copy the bridge needs
("static", never "group").

### Post-sync refresh

The sync mutates the player's gear and sync fields. Confirm the roster reflects it **without a
manual reload** — the C5 sync line (`lastSync`, job-mismatch glyph) and the gear table both read
from the tier snapshot. Check what the modal already does on success before adding any refresh of
your own; if it only updates a store legacy re-reads differently, that's a real finding, not a
detail. Verify live, not by inspection.

### Where the entry actually goes — an open shape question for the implementing session

The ruling fixes the *file*, not the pixels. The bridge today is a single "Manage characters"
button opening a modal titled "Characters" that renders the shared panel. Candidate shapes, all
inside the bridge:

- a v2-owned per-player row list **above** the shared panel inside the same modal (a compact
  player list with the Lodestone entry per row);
- a player selector + one Lodestone entry;
- an entry in the modal header when the flow targets a single player.

Do **not** duplicate the shared panel's registration-row rendering — `pnpm dupes` is a gate
(3.69% at C7's head) and a fork of those rows would drift. Screenshot the chosen shape in the PR;
if none of the shapes reads well, say so rather than shipping an awkward one.

---

## 4. The V1 guard — non-negotiable

`e2e/smoke-legacy.spec.ts:670` (test **#14**, "DEV_LODESTONE_MOCK search, preview, and sync work
from PlayerCard") pins the legacy card-kebab → modal flow end to end, including the exact testids
(`lodestone-dev-mock-hint`, `lodestone-mock-search-mock-raider`, `lodestone-search-result-910001`,
`lodestone-preview-card`, `lodestone-sync-button`, `lodestone-sync-confirm-overwrite`).

**It must stay green and stay untouched.** If C8 needs to edit that spec, the mount decision was
violated. (Historical note: this test has a known fixture-drift flake on "Tank One" — see the
Phase-G record — but the flow assertions themselves are stable.)

A v2 e2e for the new entry is welcome as an *addition*.

---

## 5. Doc surfaces this slice must flip (in-slice, like C4–C7)

Director change-review has caught doc drift in every recent slice — do these as part of the work,
not after.

1. **Matrix `v1-v2-parity-matrix.md:155` (D-12)** — the row currently ends *"The flow re-home
   itself remains C8."* Flip it: what shipped, where it mounts, and both rulings. Record any
   deviation from legacy behaviour as an explicit delta (C3/C4 precedent).
2. **Matrix R-041 + R-132…R-141 status** — mark them restored via the new entry, and be precise
   that R-132…R-141 were never rebuilt.
3. **Plan `phase-c-roster-plan.md:200-201`** — the §5 open-items table has two C8 rows
   ("shared-surface handling", "timing"). Replace the "default if silent" with the actual ruling
   and its date.
4. **Plan `phase-c-roster-plan.md:168`** — the C8 slice row gets its shipped state.
5. **Flow map `systems-flow-map.md:100`** (§2.2 exceptions table, the D-12 row: *"Phase-D design
   must pick a v2-only mount or declare the V1 delta"*) — the pick is made; record it. Also §3's
   Lodestone row (line 134).
6. **`CharacterManageBridge.tsx:1`** — the bridge's header comment claims it's a deliberately
   temporary surface re-homing to Player Hub at Stage 3. Still true; extend it to say the
   Lodestone entry rides along, so Stage 3 doesn't strand it.

---

## 6. Lessons from C5/C6/C7 that apply here

Bought the hard way, all in-scope for this slice:

- **`aria-label` on a wrapper REPLACES the content it wraps.** If the entry gets a tooltip or an
  icon-only form, the accessible name must still contain the visible words (WCAG 2.5.3
  Label-in-Name). Pattern that survived C5: `tabIndex={0}` + `sr-only` framing *alongside* content.
- **JSX strips newline-only whitespace** between a text node and an element — every `sr-only`
  expansion needs an explicit `{' '}` or a leading space inside the span.
- **React bubbles synthetic events through the REACT tree, not the DOM tree** (C7). Anything
  portalled — `Modal`, `ContextMenu` — is still a React child of its mount point, so ancestor
  click handlers fire on it. The bridge lives in `PageHeader`'s actions slot; check nothing above
  it swallows or double-handles.
- **Radix parks focus back on the trigger when a Select closes** (C6) — relevant if any keyboard
  binding is added near a combobox.
- **A URL-param/state-driven highlight must not start its clear timer before its data arrives** (C7).
- **The Settings slide-out stays MOUNTED as a `[role=dialog]` even closed** — in browser
  validation always disambiguate dialogs by their `h2` text, and never reuse an a11y-snapshot uid
  across a re-render.
- **Never predict the PR number** — #190 and #192 were both taken between prediction and push.
  Check `gh pr list` immediately before pushing, and fix the release note if it moved.
  **Invoke the `pr-checklist` skill before opening the PR.**

---

## 7. Phase-C closeout this slice also owns

C8 is the last slice, so the plan's phase-level definition of done (`phase-c-roster-plan.md`
§4) comes due here:

- **A final Phase-C matrix sweep over D-01…D-20**, including *verifying* D-20's already-shipped
  error modal (that it exists and that no second modal stacks) — it was struck from C7 on the
  promise of this check.
- Confirm §4's other clauses still hold at the phase head: one shared gear-mutation path (test,
  not inspection); a member account editing its own card live; no cross-shell preference bleed
  beyond the recorded C1 decision.
- Mobile stays deferred to the consolidated end-phase pass (user ruling, 2026-07-26) — do **not**
  add per-slice mobile affordances or gates.

---

## 8. Gate before the PR (same as every slice)

`pnpm build` · `pnpm lint` (0 errors) · `pnpm check:design-system:strict` · `pnpm dupes` ·
`pnpm tokens:check` · full test suite (**2323 tests / 203 files** at C7's head — re-count on your
head commit; stale PR-body totals get flagged as a review finding) · contrast e2e ·
**`smoke-legacy` #14 green** · browser validation desktop (owner **and** an isolated member
session, 0 console errors) · screenshots committed to `docs/redesign/pr-shots/c8-*` and embedded
in the PR body as **commit-SHA-pinned raw URLs** (branch-relative URLs break when the branch is
deleted post-merge — learned on #199/#200) · release note entry `internal: true` (v2 is still
admin-gated dark; `CURRENT_VERSION` untouched) · **director change-review before the PR**, then
the `pr-review-loop` skill until convergence.

Any data mutated during live validation must be restored server-side and verified restored —
and leave the user's DEVTST drift alone.
