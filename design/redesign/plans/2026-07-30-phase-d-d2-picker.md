# Phase D — Slice D2: Picker + Explanation Leaf — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Vet record:** `xivrp-director` plan-vet 2026-07-30 → APPROVED-WITH-CORRECTIONS (1 blocker ·
3 major · 6 minor). All findings folded into this revision: the "This will:" preview now mirrors
`lootCoordination.ts`'s exact predicates and shares one diff derivation with submit (F1); the
leaf no longer claims D-25 (F2); gear-sync gating is justified from the live coordination gate
and the checkbox disables rather than vanishes (F3); R-24 is marked a new capability with a ⚠
mechanism correction for the design record (F4); test snippets use the suite's real harness (F5,
F6); warnings are an explicit picker layer (F7); the prefill prop is union-scoped (F8); the
confidence mapping documents its gaps (F9); write-backs name what R-6 dropped (F10).

**Goal:** Rebuild `RecipientPicker`'s consequence surface (R-12 "This will:" + promoted acquired
checkbox + `Options` rename), give assign mode the full method/notes body (R-24 — a **new
capability**, see the ⚠ note), add the R-4 recipient prefill capability, land the D-36 "no one
needs this" hint, and build the **v2-owned** R-6 ranking-explanation leaf (derivation util +
presentation component) that the picker consumes now and D3's queue rows / matrix cells consume next.

**Architecture:** Two net-new v2-owned files (`utils/rankingExplanation.ts`,
`components/loot/RankingExplanation.tsx`) plus edits confined to `RecipientPicker.tsx` — a
**v2-only** component (sole importer `Loot.tsx:68`; `Loot`'s sole importer is the v2 shell
`NewShell.tsx:13`). The ranking *order* stays owned by `utils/recipientRanking.ts` (not edited);
the new leaf derives the **caution layer** (does the loot log / weapon-priority record disagree
with the ranking?) and the confidence read, mirroring `lootRecommendationService.ts`'s cutoffs
**by reading, never editing** (phase plan §5 default, ruled).

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library (**`fireEvent`, not
`user-event` — that package is not a dependency and must not become one**), design-system
primitives (`Tag`, `Checkbox`, `RadioGroup`, `TextArea`, `LinkText`).

## Global Constraints

- **Frozen / read-only (no edit, verbatim):** `loot/LootRecommendationCandidates.tsx`,
  `utils/priorityEntries.ts`, `utils/lootRecommendationService.ts`, `utils/recipientRanking.ts`,
  `utils/lootCoordination.ts`, everything under `components/history/`. Importing/typing from them
  is fine; editing is not.
- **No §2.1 shared-file touches** (phase-d-loot-plan.md): this slice's files are v2-only. If any
  task seems to require editing a shared/legacy file, STOP and report — do not improvise.
- **No AI attribution anywhere** — commits, PR, **and code comments** (D1 lesson: repo rule covers comments).
- Design system: no raw `<button>/<input>/<select>/<label>/<textarea>`; semantic color tokens only;
  `text-xs` (12px) floor for readable text; `design-system-ignore: <reason>` only with justification.
- Copy: say **"static"**, never "group"; "All members" wording stays.
- Release note: `internal: true`, `CURRENT_VERSION` (2.1.1) untouched.
- Gates before PR: `pnpm build` (tsc -b), `pnpm lint`, `pnpm check:design-system:strict`,
  `pnpm test`, `pnpm dupes`, `pnpm tokens:check`, `pnpm deadcode` (vs baseline).
- Commits: conventional (`feat(loot): …`), no attribution trailers.
- All commands from `frontend/` unless stated. Tests are colocated (`X.test.ts[x]` beside `X.ts[x]`).

---

## Ruling → Task map

| Ruling | Task |
|---|---|
| R-6 derivation (v2-owned, net-new) | 1 |
| R-6 presentation leaf | 2 |
| R-24 method (drop/book/tome/purchase) + notes in assign · R-12 checkbox promotion · `Details`→`Options` | 3 |
| R-12 live "This will:" · D-36 hint | 4 |
| R-6 picker consumption (rows + confidence header) | 5 |
| R-4 recipient prefill (`initialRecipientId`) | 6 |
| Release note + parity-matrix write-backs (D-28, D-36) + design-record ⚠ note (R-24) | 7 |
| Gates, browser validation, screenshots, director review, PR | 8 (orchestrator) |

## Named decisions (defaults taken in-slice; user can overrule at PR-screenshot time)

1. **Acquired checkbox under tome/purchase (create modes): DISABLED with caption, not hidden.**
   `lootCoordination.ts:78` refuses gear sync for those methods; hiding the checkbox would
   contradict R-12's "renders in assign mode", so it renders disabled
   (`checked={gearSyncEligible && updateGear}`) with the caption
   "Gear sync applies to drops and books." Alternative (hide it entirely) stated for overrule.
2. **D-25 (score breakdown + adjustments-active badge) is NOT built by this leaf** — `RecipientEntry`
   carries no breakdown (`recipientRanking.ts:83-86` discards it). Where D-25 lands (surfacing
   `breakdown`/`enhancedScore` through v2-only `recipientRanking`, or elsewhere) is an **open user
   ruling**, surfaced in the PR body. Nothing in D2 may claim D-25.
3. **Preview truthfulness depth:** the "This will:" gear line also mirrors the data-level
   refinement (`lootCoordination.ts:93-111` — ring resolution, raid-BiS check), not just the
   toggle gates, so a manually-picked recipient whose slot BiS is tome never sees a false promise.

---

### Task 1: `utils/rankingExplanation.ts` — the R-6 derivation

**Files:**
- Create: `frontend/src/utils/rankingExplanation.ts`
- Test: `frontend/src/utils/rankingExplanation.test.ts`

**Interfaces:**
- Consumes: `RecipientEntry` from `utils/recipientRanking` (type-only import), `LootLogEntry`,
  `SnapshotPlayer`, `GearSlot`, `GEAR_SLOT_NAMES` from `../types`.
- Produces (Tasks 2/5 rely on these exact names):
  - `interface CandidateExplanation { reasons: string[]; warnings: string[]; wouldAdvanceBis: boolean }`
  - `type RankingConfidence = 'high' | 'medium' | 'low'`
  - `function explainCandidate(entry: RecipientEntry, slot: GearSlot | 'ring', ctx: { lootLog: LootLogEntry[] }): CandidateExplanation`
  - `function deriveRankingConfidence(explained: CandidateExplanation[]): RankingConfidence`
    (argument = the **priority-scope (needers) list in rank order**, already explained)

**Design (locked here so the implementer doesn't re-derive it):**
- The ranking *order* and the per-row *reason* line stay `recipientRanking`'s job — `reasons`
  is `[entry.reason]`. The leaf's added value is the **warning layer**: cross-checks of the loot
  log and weapon-priority record against the ranking, mirroring the taxonomy in
  `lootRecommendationService.ts` (READ it; NEVER edit it):
  1. **Already received** — mirror `playerAlreadyReceivedSlot` (`lootRecommendationService.ts:103-122`):
     entries where `e.recipientPlayerId === entry.player.id` and slot matches — `'ring'` matches
     itemSlot `'ring' | 'ring1' | 'ring2'`; `'weapon'` matches `e.itemSlot === 'weapon' && e.weaponJob === entry.player.job`;
     any other slot matches `e.itemSlot === slot`. The weapon job-strictness rationale to state in
     the comment: **the read matches what the picker itself writes** — submit sets
     `weaponJob = recipient?.job` (`RecipientPicker.tsx:318`), so read and write agree; entries
     logged without `weaponJob` don't match, same as v1's strict branch. Warning:
     `` `Already received ${label} in Week ${earliest}` `` where `earliest` = the lowest
     `weekNumber` among matches (v1 `:119-121`). Sets `wouldAdvanceBis` false (v1 `:207,246`).
  2. **Weapon-priority record** (only when `slot === 'weapon'`): let
     `wp = (entry.player.weaponPriorities ?? []).find((w) => w.job === entry.player.job)`.
     `wp?.received` → warning `'Weapon already marked received in the priority list'` and
     `wouldAdvanceBis` false (v1 `:178-182`). `!wp` → warning `'Not on the weapon priority list'` (v1 `:166-168`).
- `wouldAdvanceBis` starts as `entry.needsItem` (needers by construction have raid-BiS missing;
  v1's `'unknown'` grade collapses to `false` — safe because confidence is only ever derived over
  needers, who are never `'unknown'`) and is forced `false` by warning 1 or the `wp.received` case.
- Gear-state cautions ("already has the slot", "not raid BiS") are **deliberately absent** — the
  ranking's own reason strings already say those for non-needers; duplicating them would print the
  same fact twice on one row.
- `deriveRankingConfidence` mirrors `computeConfidence` (`lootRecommendationService.ts:405-427`)
  cutoff-for-cutoff, translated to v2's needers-only pool (document this mapping in the file header):
  - `explained.length === 0` → `'low'` (v1 `:409`)
  - top's `wouldAdvanceBis === false` → `'low'` (v1 `:414-415` — both v1 cutoffs collapse here,
    since the already-received warning forces the flag false)
  - top's `warnings.length > 1` → `'low'` (v1 `:419`). **Note in the header:** through
    `explainCandidate` this branch is unreachable (two warnings imply a `wouldAdvanceBis=false`
    case that short-circuits one line earlier) — it is kept as a contract guard for future
    warning kinds, and its test is a contract test, not live behaviour.
  - top `wouldAdvanceBis && warnings.length === 0` **and** (`explained.length === 1` or every
    other element has `warnings.length >= 1`) → `'high'` — the translation of v1's
    `scoreDelta >= 40` (`:423`): with `exactBisNeed = 60` dominant, a ≥40 delta means the runner-up
    is penalized or not a needer; in a needers-only pool that is exactly "sole needer or every
    rival carries a warning"
  - otherwise `'medium'`
  - Two v1 cutoffs have **no v2 analogue — say so in the header**: `:417` (all `player_fallback` →
    low; this ranking does not read character registrations) and `:424` (weapon-coffer
    `priorityRank === 1` → high; v2's weapon ranking comes from `getPriorityForItem`, not the
    weapon-priority list).

- [ ] **Step 1: Write the failing tests**

`frontend/src/utils/rankingExplanation.test.ts` — read
`frontend/src/utils/recipientRanking.test.ts` first and reuse its fixture-building style (player
factory shape, LootLogEntry shape) rather than inventing a new harness. The cases to cover:

```ts
import { describe, it, expect } from 'vitest';
import { explainCandidate, deriveRankingConfidence } from './rankingExplanation';
import type { RecipientEntry } from './recipientRanking';
import type { SnapshotPlayer, LootLogEntry } from '../types';

// Fixtures: adapt the factories from recipientRanking.test.ts so these
// type-check with no `any`.
function player(over: Partial<SnapshotPlayer>): SnapshotPlayer { /* per suite convention */ }
function entry(p: SnapshotPlayer, over: Partial<RecipientEntry> = {}): RecipientEntry {
  return { player: p, rank: 1, needsItem: true, needTag: 'bis', reason: 'Head is BiS · 0 drops this tier', ...over };
}
function logEntry(over: Partial<LootLogEntry>): LootLogEntry { /* per suite convention */ }

describe('explainCandidate', () => {
  it('carries the ranking reason through and stays clean with an empty log', () => {
    const ex = explainCandidate(entry(player({})), 'head', { lootLog: [] });
    expect(ex.reasons).toEqual(['Head is BiS · 0 drops this tier']);
    expect(ex.warnings).toEqual([]);
    expect(ex.wouldAdvanceBis).toBe(true);
  });

  it('warns with the EARLIEST week when the log already has this slot for the player', () => {
    const log = [
      logEntry({ id: 'a', itemSlot: 'head', weekNumber: 3 }),
      logEntry({ id: 'b', itemSlot: 'head', weekNumber: 2 }),
    ];
    const ex = explainCandidate(entry(player({})), 'head', { lootLog: log });
    expect(ex.warnings).toEqual(['Already received Head in Week 2']);
    expect(ex.wouldAdvanceBis).toBe(false);
  });

  it("does not warn about another player's entries or another slot", () => {
    const log = [
      logEntry({ recipientPlayerId: 'p2', itemSlot: 'head' }),
      logEntry({ id: 'e2', itemSlot: 'body' }),
    ];
    const ex = explainCandidate(entry(player({})), 'head', { lootLog: log });
    expect(ex.warnings).toEqual([]);
  });

  it('ring matches ring, ring1 and ring2 itemSlots', () => {
    for (const itemSlot of ['ring', 'ring1', 'ring2'] as const) {
      const ex = explainCandidate(
        entry(player({})), 'ring',
        { lootLog: [logEntry({ itemSlot, weekNumber: 4 })] },
      );
      expect(ex.warnings).toEqual(['Already received Ring in Week 4']);
    }
  });

  it('weapon log match is job-strict (read agrees with the picker write)', () => {
    const p = player({ job: 'WAR' });
    const mine = explainCandidate(entry(p), 'weapon',
      { lootLog: [logEntry({ itemSlot: 'weapon', weaponJob: 'WAR', weekNumber: 1 })] });
    expect(mine.warnings).toContain('Already received Weapon in Week 1');
    const other = explainCandidate(entry(p), 'weapon',
      { lootLog: [logEntry({ itemSlot: 'weapon', weaponJob: 'DRG', weekNumber: 1 })] });
    expect(other.warnings).toEqual(expect.not.arrayContaining(['Already received Weapon in Week 1']));
  });

  it('flags a received weapon-priority row and a missing one', () => {
    const received = explainCandidate(
      entry(player({ job: 'WAR', weaponPriorities: [/* WAR row, received: true — per types */] })),
      'weapon', { lootLog: [] },
    );
    expect(received.warnings).toContain('Weapon already marked received in the priority list');
    expect(received.wouldAdvanceBis).toBe(false);

    const missing = explainCandidate(entry(player({ job: 'WAR', weaponPriorities: [] })), 'weapon', { lootLog: [] });
    expect(missing.warnings).toContain('Not on the weapon priority list');
  });

  it('a non-needer never claims to advance BiS', () => {
    const ex = explainCandidate(
      entry(player({}), { needsItem: false, needTag: 'minor', reason: 'Not raid BiS in this slot', rank: null }),
      'head', { lootLog: [] },
    );
    expect(ex.wouldAdvanceBis).toBe(false);
    expect(ex.reasons).toEqual(['Not raid BiS in this slot']);
  });
});

describe('deriveRankingConfidence', () => {
  const clean = { reasons: ['r'], warnings: [], wouldAdvanceBis: true };
  const warned = (n: number) => ({ reasons: ['r'], warnings: Array.from({ length: n }, (_, i) => `w${i}`), wouldAdvanceBis: true });

  it('empty pool → low', () => expect(deriveRankingConfidence([])).toBe('low'));
  it('top does not advance BiS → low', () =>
    expect(deriveRankingConfidence([{ ...clean, wouldAdvanceBis: false }, clean])).toBe('low'));
  // Contract test: unreachable through explainCandidate today (see header note) —
  // pins the v1 `warnings.length > 1` cutoff for future warning kinds.
  it('top with two warnings → low', () =>
    expect(deriveRankingConfidence([warned(2), clean])).toBe('low'));
  it('sole clean needer → high', () => expect(deriveRankingConfidence([clean])).toBe('high'));
  it('clean top and every rival warned → high', () =>
    expect(deriveRankingConfidence([clean, warned(1), warned(1)])).toBe('high'));
  it('clean top with a clean rival → medium', () =>
    expect(deriveRankingConfidence([clean, clean])).toBe('medium'));
  it('top with exactly one warning → medium (mirrors v1 "> 1" cutoff)', () =>
    expect(deriveRankingConfidence([warned(1)])).toBe('medium'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/utils/rankingExplanation.test.ts`
Expected: FAIL — module `./rankingExplanation` not found.

- [ ] **Step 3: Implement `rankingExplanation.ts`**

```ts
/**
 * Ranking explanation — Phase D R-6's v2-owned derivation (D-29's
 * reasons/warnings/confidence layer; D-25's score breakdown is NOT carried
 * here — RecipientEntry has no breakdown, and where D-25 lands is an open
 * ruling).
 *
 * One caution layer for every surface that shows a ranking (picker candidates
 * now; D3 wires queue rows + matrix cells). The ranking ORDER and per-row
 * reason line stay utils/recipientRanking's job — this module answers the
 * question that module can't: does the RECORD (loot log, weapon-priority
 * list) disagree with the ranking?
 *
 * Mirrors utils/lootRecommendationService.ts BY READING (that file is
 * V1-reachable and frozen — phase-d-loot-plan.md §2.1): the warning taxonomy
 * follows playerAlreadyReceivedSlot, and deriveRankingConfidence translates
 * computeConfidence's cutoffs (:405-427) to v2's needers-only pool — v1's
 * `scoreDelta >= 40` (exactBisNeed 60 dominant) becomes "sole needer, or
 * every rival carries a warning". Two v1 cutoffs have no analogue here:
 * all-player_fallback → low (:417; this ranking reads no character
 * registrations) and weapon-coffer priorityRank 1 → high (:424; v2's weapon
 * ranking comes from getPriorityForItem, not the weapon-priority list).
 * The `warnings.length > 1` → low branch is a contract guard: today's two
 * warning kinds that could co-occur both force wouldAdvanceBis=false first.
 *
 * Weapon log matching is job-strict — the read matches what the picker
 * writes (weaponJob = recipient's job at submit), so read and write agree.
 */
import type { LootLogEntry, GearSlot } from '../types';
import { GEAR_SLOT_NAMES } from '../types';
import type { RecipientEntry } from './recipientRanking';

export interface CandidateExplanation {
  /** Why this candidate ranks where it does — the ranking's own reason line. */
  reasons: string[];
  /** Record cross-checks — already received, weapon-priority conflicts. */
  warnings: string[];
  /** Would giving them this item advance their raid BiS? */
  wouldAdvanceBis: boolean;
}

export type RankingConfidence = 'high' | 'medium' | 'low';

function slotLabel(slot: GearSlot | 'ring'): string {
  return slot === 'ring' ? 'Ring' : (GEAR_SLOT_NAMES[slot] ?? slot);
}

function matchesSlot(e: LootLogEntry, slot: GearSlot | 'ring', playerJob: string): boolean {
  if (slot === 'ring') {
    return e.itemSlot === 'ring' || e.itemSlot === 'ring1' || e.itemSlot === 'ring2';
  }
  if (slot === 'weapon') {
    return e.itemSlot === 'weapon' && e.weaponJob === playerJob;
  }
  return e.itemSlot === slot;
}

export function explainCandidate(
  entry: RecipientEntry,
  slot: GearSlot | 'ring',
  ctx: { lootLog: LootLogEntry[] },
): CandidateExplanation {
  const warnings: string[] = [];
  let wouldAdvanceBis = entry.needsItem;
  const label = slotLabel(slot);

  const received = ctx.lootLog.filter(
    (e) => e.recipientPlayerId === entry.player.id && matchesSlot(e, slot, entry.player.job),
  );
  if (received.length > 0) {
    const earliest = received.reduce((a, b) => (a.weekNumber < b.weekNumber ? a : b));
    warnings.push(`Already received ${label} in Week ${earliest.weekNumber}`);
    wouldAdvanceBis = false;
  }

  if (slot === 'weapon') {
    const wp = (entry.player.weaponPriorities ?? []).find((w) => w.job === entry.player.job);
    if (wp?.received) {
      warnings.push('Weapon already marked received in the priority list');
      wouldAdvanceBis = false;
    } else if (!wp) {
      warnings.push('Not on the weapon priority list');
    }
  }

  return { reasons: [entry.reason], warnings, wouldAdvanceBis };
}

export function deriveRankingConfidence(explained: CandidateExplanation[]): RankingConfidence {
  if (explained.length === 0) return 'low';
  const top = explained[0];
  if (!top.wouldAdvanceBis) return 'low';
  if (top.warnings.length > 1) return 'low';
  const rivals = explained.slice(1);
  if (
    top.warnings.length === 0 &&
    (rivals.length === 0 || rivals.every((c) => c.warnings.length >= 1))
  ) {
    return 'high';
  }
  return 'medium';
}
```

Adjust the exact `SnapshotPlayer`/`LootLogEntry` field usage to the real types in
`frontend/src/types/index.ts` (read them; e.g. the `weaponPriorities` element shape) — the test
fixtures must type-check without `any`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/utils/rankingExplanation.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/rankingExplanation.ts frontend/src/utils/rankingExplanation.test.ts
git commit -m "feat(loot): R-6 ranking-explanation derivation (v2-owned)"
```

---

### Task 2: `loot/RankingExplanation.tsx` — the R-6 presentation leaf

**Files:**
- Create: `frontend/src/components/loot/RankingExplanation.tsx`
- Test: `frontend/src/components/loot/RankingExplanation.test.tsx`

**Interfaces:**
- Consumes: `CandidateExplanation` from `../../utils/rankingExplanation` (Task 1).
- Produces: `function RankingExplanation({ explanation, showWarnings }: { explanation: CandidateExplanation; showWarnings?: boolean }): JSX.Element`
  — `showWarnings` **defaults to `false`**: R-6 rules warnings as the *picker's* layered extra,
  so the picker opts in explicitly (Task 5) and D3's queue/matrix consumption decides for itself
  rather than inheriting a pre-decision. **Do NOT export it from `loot/index.ts`** — D3 imports
  the sibling directly; a barrel line is an unused export today (`pnpm deadcode` noise) and a V1
  door tomorrow (`GroupViewContent.tsx:38` imports the barrel).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RankingExplanation } from './RankingExplanation';

describe('RankingExplanation', () => {
  it('renders the reason line', () => {
    render(<RankingExplanation explanation={{ reasons: ['Head is BiS · 2 drops this tier'], warnings: [], wouldAdvanceBis: true }} />);
    expect(screen.getByText('Head is BiS · 2 drops this tier')).toBeInTheDocument();
  });

  it('renders warnings only when opted in', () => {
    const explanation = { reasons: ['r'], warnings: ['Already received Head in Week 2'], wouldAdvanceBis: false };
    const { rerender } = render(<RankingExplanation explanation={explanation} />);
    expect(screen.queryByText('Already received Head in Week 2')).not.toBeInTheDocument();
    rerender(<RankingExplanation explanation={explanation} showWarnings />);
    const w = screen.getByText('Already received Head in Week 2');
    expect(w.className).toContain('text-status-warning');
  });

  it('renders no icon markup when there are no warnings', () => {
    const { container } = render(
      <RankingExplanation explanation={{ reasons: ['r'], warnings: [], wouldAdvanceBis: true }} showWarnings />,
    );
    expect(container.querySelectorAll('svg').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/loot/RankingExplanation.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
/**
 * RankingExplanation — Phase D R-6's one presentation for "why is this ranked
 * here" (D-29's reasons/warnings layer; D-25's score breakdown is NOT carried
 * here). Renders a CandidateExplanation: the ranking's reason line, plus the
 * record cross-check warnings when the consumer opts in — R-6 rules warnings
 * as the PICKER's layered extra, so surfacing them elsewhere (D3's queue rows
 * / matrix cells) is that slice's decision, not this component's default.
 */
import { AlertTriangle } from 'lucide-react';
import type { CandidateExplanation } from '../../utils/rankingExplanation';

export function RankingExplanation({
  explanation,
  showWarnings = false,
}: {
  explanation: CandidateExplanation;
  showWarnings?: boolean;
}) {
  return (
    <span className="block min-w-0">
      {explanation.reasons.map((r) => (
        <span key={r} className="block truncate text-xs text-text-tertiary">{r}</span>
      ))}
      {showWarnings && explanation.warnings.map((w) => (
        <span key={w} className="flex items-start gap-1 text-xs text-status-warning">
          <AlertTriangle aria-hidden className="mt-0.5 h-3 w-3 flex-none" />
          {w}
        </span>
      ))}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/loot/RankingExplanation.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/loot/RankingExplanation.tsx frontend/src/components/loot/RankingExplanation.test.tsx
git commit -m "feat(loot): R-6 ranking-explanation presentation leaf"
```

---

### Task 3: RecipientPicker — R-24 method + notes in assign, R-12 checkbox promotion, `Options` rename

**Files:**
- Modify: `frontend/src/components/loot/RecipientPicker.tsx`
- Test: `frontend/src/components/loot/RecipientPicker.test.tsx` (extend — read its existing
  helpers/fixtures first and reuse them; the suite uses `fireEvent` and addresses SegmentedToggle
  options as `getByRole('button', { name: … })` with `aria-pressed` — follow that)

**Interfaces:**
- Consumes: nothing new.
- Produces (Task 4 relies on these): local const `METHOD_OPTIONS` (4 entries), local
  `gearSyncEligible: boolean` (`method === 'drop' || method === 'book'`), the acquired checkbox
  living in the **modal body** above the disclosure, disclosure labels `Options`/`Hide options`.

**Ruling detail being implemented:**
- R-24: the method RadioGroup drops its `mode !== 'assign'` gate (`RecipientPicker.tsx:536`) and
  offers the full `LootMethod` set — `drop / book / tome / purchase` (`types/index.ts:1231`).
  The notes field drops its `mode !== 'assign'` gate (`:584`). Both stay inside the (renamed)
  disclosure — R-12 promotes **only** the acquired checkbox.
  **⚠ R-24 is a NEW CAPABILITY, not a restore** (director plan-vet F4): no legacy modal ever
  offered tome or purchase — `AddLootEntryModal.tsx:472-475` builds only Drop/Book radios and
  `QuickLogDropModal.tsx:148` hard-sets `method: 'drop'`. The ruling's four-method list stands on
  its own text (and the parity matrix's method-superset description, `v1-v2-parity-matrix.md:226,262`);
  its "legacy full choice" rationale is a mechanism error, corrected in the design record (Task 7).
- **Gear-sync gating — justified by the live gate, not legacy:** `lootCoordination.ts:78` refuses
  gear sync unless `method === 'drop' || 'book'` (and `!isExtra`); `:124` same method gate for
  weapon priority. The picker's submit options are left UNCHANGED (`{ updateGear, … }`) — adding
  `gearSyncEligible &&` there would be a no-op the util already enforces. What changes is the
  **checkbox affordance** (named decision 1): in create modes it renders
  `checked={gearSyncEligible && updateGear}` and `disabled={!gearSyncEligible}`, with the caption
  `Gear sync applies to drops and books.` shown only while disabled.
  **Edit mode is untouched**: checkbox always enabled, submit keeps `{ syncGear: updateGear }`.
  (A tome/purchase edit's sync refusal is pre-existing v2 behaviour — `lootCoordination.ts:186`
  gates on the ORIGINAL method — and Task 4's preview is what makes it honest.)
- Rename: `Details`/`Hide details` → `Options`/`Hide options` (`:519-521`).
- Method RadioGroup `onChange` cast widens: `(v) => setMethod(v as LootMethod)` (the
  `as 'drop' | 'book'` cast at `:542` is now wrong).

- [ ] **Step 1: Write the failing tests**

Add to `RecipientPicker.test.tsx`, using the suite's existing render helper and `fireEvent`.
Query the acquired checkbox the way the primitive actually renders (`ui/Checkbox.tsx`: a
`<label>` wrapping a `div role="checkbox"`; no `aria-label` unless passed — query by role +
accessible name from the label text, e.g. `screen.getByRole('checkbox', { name: /as acquired/ })`,
and verify against the primitive first):

```tsx
describe('R-24 method + notes in assign mode', () => {
  it('assign mode offers all four methods and the notes field inside Options', () => {
    renderPicker({ mode: 'assign' });
    fireEvent.click(screen.getByText('Options'));            // disclosure starts closed in assign
    for (const m of ['Drop', 'Book', 'Tome', 'Purchase']) {
      expect(screen.getByRole('radio', { name: m })).toBeInTheDocument();
    }
    expect(screen.getByPlaceholderText('Optional notes…')).toBeInTheDocument();
  });

  it('choosing Tome disables the acquired checkbox with the caption, and submit still logs', () => {
    renderPicker({ mode: 'assign' });
    fireEvent.click(screen.getByText('Options'));
    fireEvent.click(screen.getByRole('radio', { name: 'Tome' }));
    expect(screen.getByRole('checkbox', { name: /as acquired/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Gear sync applies to drops and books.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Assign to/ }));
    // adapt to the suite's mock style for logLootAndUpdateGear:
    expect(logLootMock).toHaveBeenCalledWith(
      expect.anything(), expect.anything(),
      expect.objectContaining({ method: 'tome' }),
      expect.anything(),
    );
  });
});

describe('R-12 checkbox promotion + Options rename', () => {
  it('assign mode shows the acquired checkbox without opening the disclosure', () => {
    renderPicker({ mode: 'assign' });
    expect(screen.getByRole('checkbox', { name: /as acquired/ })).toBeInTheDocument();
    expect(screen.getByText('Options')).toBeInTheDocument();
    expect(screen.queryByText('Details')).not.toBeInTheDocument();
  });
});
```

(If the primitive's rendered roles differ from the above, fix the QUERY to match the primitive —
never the primitive to match the query. In log/edit mode the disclosure starts open — assert
`Hide options` there; update any existing `Details` assertions.)

- [ ] **Step 2: Run to verify the new tests fail**

Run: `pnpm vitest run src/components/loot/RecipientPicker.test.tsx`
Expected: new cases FAIL (no Tome radio, checkbox still in disclosure, label still `Details`);
pre-existing cases PASS.

- [ ] **Step 3: Implement in `RecipientPicker.tsx`**

```tsx
// Near SCOPE_OPTIONS:
const METHOD_OPTIONS: { value: LootMethod; label: string }[] = [
  { value: 'drop', label: 'Drop' },
  { value: 'book', label: 'Book' },
  { value: 'tome', label: 'Tome' },
  { value: 'purchase', label: 'Purchase' },
];

// In the component, after `effectiveExtra`:
// Gear/weapon-priority sync applies only to drop/book — mirrors the
// coordination gates (lootCoordination.ts:78,:124) so the checkbox can't
// promise a write the util refuses.
const gearSyncEligible = method === 'drop' || method === 'book';
```

- Method RadioGroup: remove the `mode !== 'assign' && (` wrapper; `options={METHOD_OPTIONS}`;
  `onChange={(v) => setMethod(v as LootMethod)}`.
- Notes block: remove its `mode !== 'assign' && (` wrapper.
- Acquired checkbox: move the `<Checkbox … label={`Mark ${label} as acquired`} />` JSX out of the
  disclosure `div` to directly ABOVE the `<LinkText …>` disclosure toggle:

```tsx
<div>
  <Checkbox
    checked={mode === 'edit' ? updateGear : (gearSyncEligible && updateGear)}
    onChange={setUpdateGear}
    disabled={mode !== 'edit' && !gearSyncEligible}
    label={`Mark ${label} as acquired`}
  />
  {mode !== 'edit' && !gearSyncEligible && (
    <p className="mt-1 text-xs text-text-muted">Gear sync applies to drops and books.</p>
  )}
</div>
```

- Submit paths: **unchanged** (see Ruling detail — the util already gates).
- LinkText: `{showDetails ? 'Hide options' : 'Options'}`.
- Update the component's header comment (`RecipientPicker.tsx:1-16`) to name the Phase-D R-12/R-24
  behavior instead of describing the pre-D2 body.

- [ ] **Step 4: Run the full picker suite**

Run: `pnpm vitest run src/components/loot/RecipientPicker.test.tsx`
Expected: PASS (new + pre-existing, with `Details`→`Options` label updates applied).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/loot/RecipientPicker.tsx frontend/src/components/loot/RecipientPicker.test.tsx
git commit -m "feat(loot): R-24 method+notes in assign; R-12 acquired promotion + Options rename"
```

---

### Task 4: RecipientPicker — R-12 "This will:" live preview + D-36 hint

**Files:**
- Modify: `frontend/src/components/loot/RecipientPicker.tsx`
- Test: `frontend/src/components/loot/RecipientPicker.test.tsx` (extend)

**Interfaces:**
- Consumes: Task 3's `gearSyncEligible`.
- Produces (Task 5 reuses these):
  - `needers: RecipientEntry[]` — memo of `buildRecipientEntries({ players, slot, scope: 'priority', settings, lootLog, currentWeek, enhancedActive })` for the CURRENT slot (independent of the scope toggle).
  - `computeEditUpdates(...)` — module-level pure function, the ONE edit-diff derivation
    (signature below), used by BOTH the preview and `handleSubmit`.

**Ruling detail (vet-corrected, F1):**
- The static footer line (`RecipientPicker.tsx:381-383`) is REPLACED by a live "This will:" list
  naming the recipient, the week, and each side effect the current toggles will actually cause.
  **"Actually" is enforced by mirroring `lootCoordination.ts`'s predicates exactly:**
  - Gear mark (`:78` + `:93-111`): requires `updateGear && gearSyncEligible && !effectiveExtra`
    **and** the data-level refinement — for `'ring'`: recipient needs ring1 or ring2
    (raid-BiS + !hasItem); otherwise: the recipient's slot gear has `bisSource === 'raid'`.
  - Weapon priority (`:124`, `:129-137`): requires `isWeapon && gearSyncEligible` and the
    recipient having a weapon-priority row for their job (`targetJob` resolves to the recipient's
    job — the picker submits `weaponJob = recipient?.job`).
  - Edit sync (`:186-187`, `:194-195`): requires `updateGear && (editEntry.method === 'drop' || 'book')
    && !editEntry.isExtra` and (recipient changed or slot changed) — the picker never diffs
    `isExtra`, so the extra-transition clause reduces to `!editEntry.isExtra`.
- **One edit-diff derivation.** `handleSubmit`'s inline diff block (`:289-299`, including the
  weaponJob backfill at `:297-299`) is HOISTED into `computeEditUpdates` and both call it. The
  backfill fires with zero user edits on a weapon entry lacking `weaponJob` — the preview must
  show `Record it as a {job} weapon`, not `No changes yet.`, in exactly the cases submit would write.
- D-36: when **no one needs the current slot** (`needers.length === 0`), create modes show the
  hint — success tone, same block as "This will:". Copy:
  `No one needs this item for BiS — assigning it counts as a free roll.`
- No `METHOD_NOUN` map — the `method` value already reads as a noun; interpolate it directly.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('R-12 "This will:" live preview', () => {
  it('names the recipient, week and gear side effect, and tracks toggles live', () => {
    renderPicker({ mode: 'assign' });           // fixture where P1 tops the ranking, raid-BiS head
    expect(screen.getByText('This will:')).toBeInTheDocument();
    expect(screen.getByText(/Log Head \(drop\) for Tank One in Week 3/)).toBeInTheDocument();
    expect(screen.getByText(/Mark Head as acquired on Tank One's gear/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /as acquired/ }));
    expect(screen.queryByText(/Mark Head as acquired/)).not.toBeInTheDocument();
  });

  it('does not promise a gear write for an extra-loot weapon or a tome method', () => {
    renderPicker({ mode: 'assign', item: weaponItem });
    fireEvent.click(screen.getByText('Options'));
    fireEvent.click(screen.getByRole('checkbox', { name: /Extra loot/ }));
    expect(screen.queryByText(/as acquired/)).toBeInTheDocument();       // checkbox still there…
    expect(screen.queryByText(/Mark Weapon as acquired/)).not.toBeInTheDocument(); // …but no promise
  });

  it('promises the weapon-priority update only for drop/book methods', () => {
    renderPicker({ mode: 'assign', item: weaponItem });                  // recipient has a WP row
    expect(screen.getByText(/weapon priority/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Options'));
    fireEvent.click(screen.getByRole('radio', { name: 'Tome' }));
    expect(screen.queryByText(/weapon priority/)).not.toBeInTheDocument();
  });

  it('edit mode lists pending changes and says so when there are none', () => {
    renderPicker({ mode: 'edit', editEntry: completeEditEntry });        // weaponJob present → truly no diff
    expect(screen.getByText('No changes yet.')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Optional notes…'), { target: { value: 'changed' } });
    expect(screen.getByText(/Update the notes/)).toBeInTheDocument();
  });

  it('edit mode surfaces the weaponJob backfill it will write', () => {
    renderPicker({ mode: 'edit', editEntry: weaponEntryWithoutJob });
    expect(screen.getByText(/Record it as a WAR weapon/)).toBeInTheDocument();
    expect(screen.queryByText('No changes yet.')).not.toBeInTheDocument();
  });
});

describe('D-36 no-one-needs-this hint', () => {
  it('shows the hint when the slot has no needers', () => {
    renderPicker({ mode: 'assign', players: noNeedersRoster });
    expect(screen.getByText(/No one needs this item for BiS/)).toBeInTheDocument();
  });
  it('does not show the hint when someone needs the slot', () => {
    renderPicker({ mode: 'assign' });
    expect(screen.queryByText(/No one needs this item/)).not.toBeInTheDocument();
  });
});
```

(Adapt fixture names to the suite's existing fixtures; `completeEditEntry` must include
`weaponJob` or be a non-weapon slot so the backfill can't fire.)

- [ ] **Step 2: Run to verify the new tests fail**

Run: `pnpm vitest run src/components/loot/RecipientPicker.test.tsx`
Expected: new cases FAIL (`This will:` absent).

- [ ] **Step 3: Implement**

Module-level, above the component (types from the file's existing imports):

```tsx
// The ONE edit-diff derivation — handleSubmit submits exactly this object and
// the "This will:" preview renders exactly this object, so they cannot drift.
function computeEditUpdates(args: {
  editEntry: LootLogEntry;
  slot: GearSlot | 'ring';
  floorName: string;
  week: number;
  method: LootMethod;
  notes: string;
  recipientPlayerId: string;
  recipientJob: string | undefined;
}): LootLogEntryUpdate {
  const { editEntry, slot, floorName, week, method, notes, recipientPlayerId, recipientJob } = args;
  const itemSlot = slot === 'ring'
    ? (editEntry.itemSlot === 'ring2' ? 'ring2' : 'ring1')
    : slot;
  const updates: LootLogEntryUpdate = {};
  if (week !== editEntry.weekNumber) updates.weekNumber = week;
  if (floorName !== editEntry.floor) updates.floor = floorName;
  if (itemSlot !== editEntry.itemSlot) updates.itemSlot = itemSlot;
  if (recipientPlayerId !== editEntry.recipientPlayerId) updates.recipientPlayerId = recipientPlayerId;
  if (method !== editEntry.method) updates.method = method;
  if (notes !== (editEntry.notes ?? '')) updates.notes = notes || undefined;
  if (itemSlot === 'weapon' && !editEntry.weaponJob && recipientJob) {
    updates.weaponJob = recipientJob;
  }
  return updates;
}
```

`handleSubmit`'s edit branch replaces its inline block (`:285-299`) with a call
(`recipientJob: recipient?.job`) and keeps everything else identical.

Inside the component:

```tsx
// Needers for the CURRENT slot regardless of the scope toggle — D-36's hint
// and the R-6 confidence header both read the priority pool even while the
// user is browsing All members.
const needers = useMemo(
  () => buildRecipientEntries({ players, slot, scope: 'priority', settings, lootLog, currentWeek, enhancedActive }),
  [players, slot, settings, lootLog, currentWeek, enhancedActive],
);

// Live consequences — each line mirrors the exact predicate of the write it
// names (lootCoordination.ts:78,:93-111,:124,:186-187); stating a side effect
// the util would refuse is the bug R-12 exists to prevent.
const consequences = useMemo<string[]>(() => {
  if (!selected) return [];
  const name = selected.player.name;
  if (mode === 'edit') {
    const updates = computeEditUpdates({
      editEntry, slot, floorName, week, method, notes,
      recipientPlayerId: selected.player.id, recipientJob: selected.player.job,
    });
    const out: string[] = [];
    if (updates.weekNumber !== undefined) out.push(`Move it to Week ${updates.weekNumber}`);
    if (updates.floor !== undefined || updates.itemSlot !== undefined) out.push(`Change the item to ${floorName} · ${label}`);
    if (updates.recipientPlayerId !== undefined) out.push(`Reassign it to ${name}`);
    if (updates.method !== undefined) out.push(`Set the method to ${method}`);
    if (updates.notes !== undefined || (notes === '' && (editEntry.notes ?? '') !== '')) out.push('Update the notes');
    if (updates.weaponJob !== undefined) out.push(`Record it as a ${updates.weaponJob} weapon`);
    const syncFires = updateGear
      && (editEntry.method === 'drop' || editEntry.method === 'book')
      && !editEntry.isExtra
      && (updates.recipientPlayerId !== undefined || updates.itemSlot !== undefined);
    if (syncFires) out.push(`Sync gear to match`);
    return out;
  }
  const out = [`Log ${label} (${method}) for ${name} in Week ${week}`];
  const gearWillMark = slot === 'ring'
    ? selected.player.gear.some((g) =>
        (g.slot === 'ring1' || g.slot === 'ring2') && g.bisSource === 'raid' && !g.hasItem)
    : selected.player.gear.find((g) => g.slot === slot)?.bisSource === 'raid';
  if (updateGear && gearSyncEligible && !effectiveExtra && gearWillMark) {
    out.push(`Mark ${label} as acquired on ${name}'s gear`);
  }
  if (isWeapon && gearSyncEligible
      && (selected.player.weaponPriorities ?? []).some((w) => w.job === selected.player.job)) {
    out.push(`Update ${name}'s weapon priority`);
  }
  if (effectiveExtra) out.push('Count it as extra loot (outside BiS priority)');
  return out;
}, [selected, mode, editEntry, slot, week, floorName, label, method, notes, updateGear, gearSyncEligible, isWeapon, effectiveExtra]);
```

(`updates.notes` carries `undefined` as a *cleared* value — the `notes === ''` clause keeps the
preview honest for note-clearing; verify against `computeEditUpdates`' behaviour in the test.)

Footer JSX — replace the static `<p>` (`:381-383`):

```tsx
const footer = (
  <div className="space-y-3">
    {mode !== 'edit' && needers.length === 0 && (
      <p className="text-xs text-status-success">
        No one needs this item for BiS — assigning it counts as a free roll.
      </p>
    )}
    {selected && (
      <div className="text-xs text-text-tertiary">
        <span className="font-semibold text-text-secondary">This will:</span>
        {mode === 'edit' && consequences.length === 0 ? (
          <span className="ml-1">No changes yet.</span>
        ) : (
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {consequences.map((c) => <li key={c}>{c}</li>)}
          </ul>
        )}
      </div>
    )}
    {/* existing Cancel/submit row unchanged */}
  </div>
);
```

TypeScript narrowing: guard `mode === 'edit'` before touching `editEntry` (the union already
types it); `editEntry` in the dep array is a stable `undefined` in create modes.

- [ ] **Step 4: Run the picker suite**

Run: `pnpm vitest run src/components/loot/RecipientPicker.test.tsx`
Expected: PASS. If a pre-existing test asserted the old footer line
("Logging marks the drop…"), update it to the new preview.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/loot/RecipientPicker.tsx frontend/src/components/loot/RecipientPicker.test.tsx
git commit -m "feat(loot): R-12 live 'This will:' preview + D-36 empty-queue hint"
```

---

### Task 5: RecipientPicker — R-6 consumption (rows + confidence header)

**Files:**
- Modify: `frontend/src/components/loot/RecipientPicker.tsx`
- Test: `frontend/src/components/loot/RecipientPicker.test.tsx` (extend)

**Interfaces:**
- Consumes: `explainCandidate` / `deriveRankingConfidence` (Task 1), `RankingExplanation` with
  `showWarnings` (Task 2), `needers` memo (Task 4).
- Produces: nothing downstream in this slice.

**Ruling detail:** picker rows render the shared explanation with `showWarnings` — warnings are
the picker's layered extra per R-6; the list header carries the high/medium/low confidence read
for the **priority ranking**, shown only in priority scope (in All/Off-spec the list is not a
ranking; the frozen v1 leaf's tone mapping high→success · medium→accent · low→warning carries
over via `Tag` tones).

- [ ] **Step 1: Write the failing tests**

```tsx
describe('R-6 explanation + confidence in the picker', () => {
  it('a row with log history shows the received warning', () => {
    renderPicker({ mode: 'assign', lootLog: [headDropForP1Week2] });
    expect(screen.getByText('Already received Head in Week 2')).toBeInTheDocument();
  });

  it('priority scope shows the confidence header', () => {
    renderPicker({ mode: 'assign' });      // sole clean needer fixture
    expect(screen.getByText('High confidence')).toBeInTheDocument();
  });

  it('All-members scope hides the confidence header', () => {
    renderPicker({ mode: 'assign' });
    fireEvent.click(screen.getByRole('button', { name: 'All members' }));  // SegmentedToggle = buttons + aria-pressed
    expect(screen.queryByText(/confidence/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `pnpm vitest run src/components/loot/RecipientPicker.test.tsx`
Expected: new cases FAIL.

- [ ] **Step 3: Implement**

```tsx
import { explainCandidate, deriveRankingConfidence, type RankingConfidence } from '../../utils/rankingExplanation';
import { RankingExplanation } from './RankingExplanation';

const CONFIDENCE_TONE: Record<RankingConfidence, 'success' | 'accent' | 'warning'> = {
  high: 'success', medium: 'accent', low: 'warning',
};
const CONFIDENCE_LABEL: Record<RankingConfidence, string> = {
  high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence',
};

// Inside the component:
const explanations = useMemo(
  () => new Map(entries.map((e) => [e.player.id, explainCandidate(e, slot, { lootLog })])),
  [entries, slot, lootLog],
);
const confidence = useMemo(
  () => deriveRankingConfidence(needers.map((e) => explainCandidate(e, slot, { lootLog }))),
  [needers, slot, lootLog],
);
```

- List header (`:445`) becomes a flex row:

```tsx
<div className="flex items-center justify-between gap-2">
  <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">{listLabel}</span>
  {scope === 'priority' && (
    <Tag variant="label" tone={CONFIDENCE_TONE[confidence]}>{CONFIDENCE_LABEL[confidence]}</Tag>
  )}
</div>
```

- Row subtitle (`:503`): replace
  `<span className="block truncate text-xs text-text-tertiary">{entry.reason}</span>` with
  `<RankingExplanation showWarnings explanation={explanations.get(entry.player.id) ?? { reasons: [entry.reason], warnings: [], wouldAdvanceBis: entry.needsItem }} />`
  (the fallback object is unreachable in practice — `explanations` is keyed from the same
  `entries` — but keeps the render total without a non-null assertion).

- [ ] **Step 4: Run the picker suite**

Run: `pnpm vitest run src/components/loot/RecipientPicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/loot/RecipientPicker.tsx frontend/src/components/loot/RecipientPicker.test.tsx
git commit -m "feat(loot): R-6 explanations + confidence header in RecipientPicker"
```

---

### Task 6: RecipientPicker — R-4 recipient prefill

**Files:**
- Modify: `frontend/src/components/loot/RecipientPicker.tsx`
- Test: `frontend/src/components/loot/RecipientPicker.test.tsx` (extend)

**Interfaces:**
- Consumes: nothing new.
- Produces (D3's matrix cells will pass this): optional prop `initialRecipientId?: string` on the
  **`assign` union member only** — `initialRecipientId?: never` on the `log` and `edit` members
  (the union exists precisely so mode-specific inputs can't be silently accepted-and-ignored;
  see the comment at `RecipientPicker.tsx:52-54`. R-4's consumer is the matrix cell → assign
  mode; log mode's prefill would test membership against a placeholder slot,
  `firstSlotForFloor(1)`, which is meaningless). Semantics: on open in assign mode, pre-select
  that player — priority scope if they are in the slot's priority pool, otherwise `all` scope
  (the edit-mode visibility guarantee, applied to prefill). The ranked list still renders and
  stays freely switchable. Ignored when absent/unknown/unconfigured.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('R-4 initialRecipientId prefill', () => {
  it('pre-selects a prefilled needer inside the priority ranking', () => {
    renderPicker({ mode: 'assign', initialRecipientId: 'p2' });   // p2 ranked #2
    expect(screen.getByRole('radio', { name: /Tank Two/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Tank One/ })).toBeInTheDocument(); // list still renders
  });

  it('falls back to All members when the prefilled player is not a needer', () => {
    renderPicker({ mode: 'assign', initialRecipientId: 'p9' });   // p9 does not need the slot
    expect(screen.getByRole('radio', { name: /Player Nine/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'All members' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('stays freely switchable after prefill', () => {
    renderPicker({ mode: 'assign', initialRecipientId: 'p2' });
    fireEvent.click(screen.getByRole('radio', { name: /Tank One/ }));
    expect(screen.getByRole('radio', { name: /Tank One/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('an unknown id falls back to the default top-ranked selection', () => {
    renderPicker({ mode: 'assign', initialRecipientId: 'nope' });
    expect(screen.getByRole('radio', { name: /Tank One/ })).toHaveAttribute('aria-checked', 'true');
  });
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `pnpm vitest run src/components/loot/RecipientPicker.test.tsx`
Expected: FAIL — prop unknown / default selection asserted.

- [ ] **Step 3: Implement**

- Union members (NOT the base props):

```tsx
export type RecipientPickerProps = RecipientPickerBaseProps & (
  | {
      mode: 'assign';
      item: DropItemContext;
      editEntry?: never;
      /**
       * R-4 (D-22): pre-select this player on open — a matrix-cell click is a
       * shortcut into the normal flow, not a second flow. The ranked list
       * still renders and stays switchable. Unknown/unconfigured ids are
       * ignored.
       */
      initialRecipientId?: string;
    }
  | { mode: 'log'; item?: DropItemContext; editEntry?: never; initialRecipientId?: never }
  | { mode: 'edit'; editEntry: LootLogEntry; item?: never; initialRecipientId?: never }
);
```

- In the open-effect's create branch (after `initialEntries` is computed), replace the two
  `setScope(initialScope); setSelectedId(initialEntries[0]?.player.id ?? null);` lines with:

```tsx
        const prefill = initialRecipientId
          ? players.find((p) => p.id === initialRecipientId && p.configured)
          : undefined;
        if (prefill) {
          // Visibility guarantee (mirrors the edit branch above): a prefilled
          // player outside the priority pool is only selectable under 'all'.
          const inPriority = priorityEntries.some((e) => e.player.id === prefill.id);
          setScope(inPriority ? 'priority' : 'all');
          setSelectedId(prefill.id);
        } else {
          setScope(initialScope);
          setSelectedId(initialEntries[0]?.player.id ?? null);
        }
```

- Add `initialRecipientId` to the destructured props and the effect dependency array (safe: the
  effect body is `wasOpenRef`-guarded, so a dep change while open is a no-op).

- [ ] **Step 4: Run the picker suite**

Run: `pnpm vitest run src/components/loot/RecipientPicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/loot/RecipientPicker.tsx frontend/src/components/loot/RecipientPicker.test.tsx
git commit -m "feat(loot): R-4 recipient prefill capability (initialRecipientId)"
```

---

### Task 7: Release note + write-backs + design-record ⚠ correction

**Files:**
- Modify: `frontend/src/data/releaseNotes.ts`
- Modify: `design/redesign/specs/v1-v2-parity-matrix.md` (rows D-28, D-36 only)
- Modify: `design/redesign/specs/phase-d-loot-design.md` (R-24 section — ⚠ mechanism note only)

**Interfaces:** none.

- [ ] **Step 1: Release note entry**

Read the top of `releaseNotes.ts` and mirror the D1 internal entry's exact shape (same fields,
same ordering). Add a new entry ABOVE it (newest first), `internal: true`, `CURRENT_VERSION`
untouched, `prTitle: 'feat(loot): Phase D slice D2 — picker consequences + ranking explanations'`
and **no `pr` yet** (backfilled when the PR number exists — orchestrator's Task 8). Items along
the lines of:

- Picker states its consequences up front: live "This will:" preview mirroring the real write
  path, acquired checkbox in the modal body, `Details` → `Options` (R-12 / D-28)
- Assign mode gains the full method choice (drop/book/tome/purchase) and notes (R-24)
- "No one needs this item" hint restored (D-36)
- One shared ranking explanation + confidence read (R-6, picker half — queues/matrix consume in D3)
- Recipient prefill capability for D3's matrix cells (R-4)

- [ ] **Step 2: Parity-matrix write-backs**

In `v1-v2-parity-matrix.md`: update ONLY rows **D-28** and **D-36** — their "V2 today" columns
now reflect the shipped behavior (D-28: consequences stated without a disclosure click; D-36:
hint present in the v2 picker). Follow the exact editing style D1 used for D-24/D-26 (see git log
`3fc81595` — the write-back commit). Do NOT touch D-22/D-25/D-29 — those complete in D3, **and
D2's contribution to D-29 is deliberately partial**: reasons, warnings, the received fact and the
confidence header are built; the Main/Alt/Player source badges and show-more/fewer from
`LootRecommendationCandidates.tsx:36-59` are consciously NOT restored (R-6 narrowed D-29 to
warnings + confidence). If either write-back row needs a caveat to stay truthful, write this one.
**D-25 is not touched by D2 at all** (named decision 2 — the leaf carries no score breakdown).

- [ ] **Step 3: Design-record ⚠ note (R-24 mechanism correction)**

In `phase-d-loot-design.md`, R-24's *Why* paragraph: append a ⚠ correction in the established
style (the R-38 precedent — correct the mechanism, never the ruling):

> ⚠ *Corrected at D2 build (director plan-vet): this paragraph's "legacy's empty-cell click
> opened `AddLootEntryModal` with the full choice" is a mechanism error — that modal offers only
> Drop/Book (`AddLootEntryModal.tsx:472-475`), and no legacy modal ever offered tome or purchase.
> R-24's four-method list stands on its own text: it is a **new capability**, not a restore.*

- [ ] **Step 4: Commit**

```bash
git add frontend/src/data/releaseNotes.ts design/redesign/specs/v1-v2-parity-matrix.md design/redesign/specs/phase-d-loot-design.md
git commit -m "docs(loot): D2 release note, D-28/D-36 write-backs, R-24 mechanism correction"
```

---

### Task 8 (orchestrator, NOT a subagent): gates, browser validation, screenshots, director review, PR

- [ ] Full local gate from `frontend/`: `pnpm build && pnpm lint && pnpm check:design-system:strict && pnpm test && pnpm dupes && pnpm tokens:check` and `pnpm deadcode` compared against the pre-slice baseline.
- [ ] Live browser validation (`?shell=v2`, desktop): assign flow from a FloorDropRow **Assign**
  button (This will: / Options / method / hint / confidence header), log flow from the toolbar,
  edit flow from History → kebab → Edit (incl. a weaponJob-backfill case if the dev data allows);
  light + dark screenshots of the picker states; copy into `docs/redesign/pr-shots/` as `d2-*.png`.
- [ ] `xivrp-director` change-review of the full diff (plan-fidelity + V1-safety two-part assert:
  no legacy-path diffs, no §2.1 files touched).
- [ ] `pr-checklist` skill, then PR with embedded screenshots; PR body carries: named decision 1
  (disabled-vs-hidden checkbox) and named decision 2 (D-25 open ruling) as explicit user
  decision points; backfill the release-note `pr` number; `pr-review-loop` to green.

---

## Self-review record

- **Spec coverage:** R-12 (Task 3 promotion/rename + Task 4 preview), R-24 (Task 3), R-4 prefill
  (Task 6), R-6 derivation/presentation/consumption (Tasks 1/2/5 — D-29's
  reasons/warnings/confidence layer only; D-25 explicitly NOT claimed), D-36 (Task 4),
  write-backs + internal note + ⚠ correction (Task 7). D2 row of `phase-d-loot-plan.md` fully
  mapped; nothing else pulled in.
- **Frozen-file check:** every Create/Modify path is v2-only; `recipientRanking` and
  `lootCoordination` consumed read-only; no `history/`, no §2.1 file appears in any task's Files
  block; no `loot/index.ts` change.
- **Type consistency:** `CandidateExplanation`/`RankingConfidence`/`explainCandidate`/
  `deriveRankingConfidence`/`needers`/`gearSyncEligible`/`computeEditUpdates`/
  `initialRecipientId`/`showWarnings` names are identical across Tasks 1–6.
- **Vet findings:** F1–F10 all addressed (see Vet record at top).
