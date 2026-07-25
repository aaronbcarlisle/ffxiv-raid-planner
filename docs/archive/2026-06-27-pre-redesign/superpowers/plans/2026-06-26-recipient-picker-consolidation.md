# Plan H — Unified Recipient Dropdown (merge Recommendation + Recipient)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the redundant **Recommendation panel** and **Recipient `<Select>`** in the loot modals into a single rich, dedicated recipient dropdown that shows **every** player (priority, subs, and everyone else), with priority players emphasized and unimportant ones dimmed — removing the separate Recommendation section and the `Include Subs` / `Show all players` checkboxes. The selection invariant from the original bug fix is preserved so any player (priority or fallback) is always selectable and never snaps back.

**Architecture:** `useRecipientSelection` owns selection state + the invariant (`options ⊇ candidates ∪ allPlayers ∪ {selection}`) and emits **enriched options** (rank, job, badges, warnings, alreadyReceived, isSub, emphasized). A dedicated `RecipientSelect` combobox (Radix Select) renders those enriched options as rich rows — reusing the `CandidateRow` visual vocabulary from `LootRecommendationCandidates` — with non-priority rows dimmed. Both loot modals drop the Recommendation panel + checkboxes + plain Select and render `RecipientSelect`.

**Tech Stack:** React 19 + TS, `@radix-ui/react-select` (via the existing `Select` infra), Vitest/@testing-library.

> **Background (the bug this must not reintroduce):** each modal kept a SEPARATE recipient `<Select>` whose options were a narrower set than the recommendation; clicking a fallback candidate (`priorityRank: null`, `source: 'player_fallback'`) set an id with no matching `<option>` → the controlled Select rejected it → a reset effect snapped back to the top recipient. Making the dropdown the ONLY way to pick makes the invariant non-negotiable.

## Global Constraints

- NEVER add AI attribution to commits/PRs.
- Design system: build on the existing Radix `Select` infra / primitives; run `pnpm check:design-system`. The rich rows need custom item content — keep that contained in `RecipientSelect` (do NOT bloat the shared `components/ui/Select.tsx`).
- "static" not "group" in user-facing copy.
- **Release/version — per `docs/superpowers/ROADMAP.md` (one coordinated rollout):** this is user-facing (Recommendation panel removed, dropdown redesigned) → add a public `releaseNotes.ts` **entry** under the single rollout version **`2.0.0`** (`description`/`pr`/`prTitle` + full ISO date). **Do NOT bump `CURRENT_VERSION`** — only the stack-base branch (Plan A) sets it. This supersedes any per-plan "bump `CURRENT_VERSION`" wording in the steps below.
- Pre-PR gate: `cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test`.

## Verified reference points

- `RankedCandidate` (`utils/lootRecommendationService.ts:48`): `{ rosterPlayerId; characterRegistrationId: string|null; priorityRank: number|null; source: 'character_registration'|'player_fallback'; playerName; characterName?; job?; reasons: string[]; warnings: string[]; alreadyReceivedRelevantLoot?: boolean }`. `recommendation.rankedCandidates` is the full sorted list (no truncation) over the eligible mains; `recommendation.confidence` ∈ high|medium|low.
- `LootRecommendationCandidates` (`components/loot/LootRecommendationCandidates.tsx`) — the visual source for rows: rank badge (gold #1), `JobIcon`, name + character sub-name, `Main`/`Alt`/`Player` `RoleBadge`, ⚠ warnings tooltip, "Received" chip. **Reuse these row visuals; this panel component is removed from the modals after migration.**
- Consumers:
  - `components/loot/QuickLogDropModal.tsx` — `eligiblePlayers` excludes subs (`p.configured && !p.isSubstitute`, ~177); Recommendation panel ~302; `recipientOptions` memo ~242; recipient `<Select>` ~315; `Include Subs` / `Show all players` checkboxes near the Recipient label.
  - `components/history/AddLootEntryModal.tsx` — `visibleRecipients` + clobbering reset effect ~L312; its own Recommendation panel + Select + checkboxes.
- Subs come from the full player list (`allPlayers`, where `p.isSubstitute === true`).

---

## File Structure

- **Create** `frontend/src/hooks/useRecipientSelection.ts` — selection state + invariant + enriched options.
- **Create** `frontend/src/hooks/useRecipientSelection.test.ts` — locks the invariant + enrichment.
- **Create** `frontend/src/components/loot/RecipientSelect.tsx` — dedicated rich combobox (rows + dimming + sub badges).
- **Create** `frontend/src/components/loot/RecipientSelect.test.tsx`.
- **Modify** `frontend/src/components/loot/QuickLogDropModal.tsx` — remove Recommendation panel + checkboxes + plain Select → `RecipientSelect`.
- **Modify** `frontend/src/components/history/AddLootEntryModal.tsx` — same.
- **Delete usage** of `LootRecommendationCandidates` from the modals (keep the file only if still referenced elsewhere; otherwise remove it in the final cleanup step).

---

## Task 1: `useRecipientSelection` hook (invariant + enriched options)

**Files:**
- Create: `frontend/src/hooks/useRecipientSelection.ts`
- Test: `frontend/src/hooks/useRecipientSelection.test.ts`

**Interfaces:**
```ts
interface RecipientPlayerLite { id: string; name: string; job?: string; isSubstitute?: boolean }
interface RecipientOption {
  value: string;                 // rosterPlayerId
  playerName: string;
  characterName?: string;
  job?: string;
  characterRegistrationId: string | null;
  rank: number | null;           // priorityRank from the candidate (null = no priority)
  source: 'character_registration' | 'player_fallback' | 'roster';
  reasons: string[];
  warnings: string[];
  alreadyReceived: boolean;
  isSub: boolean;
  emphasized: boolean;           // rank != null && !alreadyReceived  → bright; else dimmed
}
interface UseRecipientSelectionArgs {
  candidates: RankedCandidate[];        // recommendation.rankedCandidates
  players: RecipientPlayerLite[];       // ALL players (mains + subs) so everyone is selectable
  initialPlayerId?: string;
}
interface UseRecipientSelection {
  selectedPlayerId: string;
  selectedCharacterRegistrationId: string | null;
  select: (playerId: string, characterRegistrationId?: string | null) => void;
  options: RecipientOption[];           // GUARANTEED ⊇ candidates ∪ players ∪ {selection}
}
```
- **Invariant:** for any `select()` sequence, the selection always has a matching option; every `candidate.rosterPlayerId` and every `players[i].id` is present exactly once. Candidates appear first (rank order), then remaining players.

- [ ] **Step 1: Write the failing test**

```ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useRecipientSelection } from './useRecipientSelection';
import type { RankedCandidate } from '../utils/lootRecommendationService';

const cand = (id: string, source: RankedCandidate['source'] = 'character_registration', rank: number | null = 1): RankedCandidate => ({
  rosterPlayerId: id, characterRegistrationId: source === 'character_registration' ? `${id}-reg` : null,
  priorityRank: rank, source, playerName: id.toUpperCase(), reasons: [], warnings: [], alreadyReceivedRelevantLoot: false,
} as RankedCandidate);

describe('useRecipientSelection', () => {
  const players = [
    { id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' },
    { id: 'sub1', name: 'Sub1', isSubstitute: true }, { id: 'px', name: 'PX' },
  ];

  it('selecting a fallback candidate keeps it valid (no snap-back)', () => {
    const { result } = renderHook(() => useRecipientSelection({
      candidates: [cand('p1'), cand('p2', 'player_fallback', null)], players,
    }));
    act(() => result.current.select('p2', null));
    expect(result.current.selectedPlayerId).toBe('p2');
    expect(result.current.options.some(o => o.value === 'p2')).toBe(true);
  });

  it('every candidate and every player appears exactly once', () => {
    const { result } = renderHook(() => useRecipientSelection({ candidates: [cand('p1')], players }));
    for (const id of ['p1', 'p2', 'sub1', 'px']) {
      expect(result.current.options.filter(o => o.value === id).length).toBe(1);
    }
  });

  it('emphasized=true only for ranked, not-yet-received; subs are flagged', () => {
    const received = { ...cand('p2'), alreadyReceivedRelevantLoot: true } as RankedCandidate;
    const { result } = renderHook(() => useRecipientSelection({ candidates: [cand('p1'), received], players }));
    const byId = (id: string) => result.current.options.find(o => o.value === id)!;
    expect(byId('p1').emphasized).toBe(true);
    expect(byId('p2').emphasized).toBe(false);  // already received → dimmed
    expect(byId('px').emphasized).toBe(false);  // no priority → dimmed
    expect(byId('sub1').isSub).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `cd frontend && pnpm test -- useRecipientSelection` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
import { useMemo, useState } from 'react';
import type { RankedCandidate } from '../utils/lootRecommendationService';

export interface RecipientPlayerLite { id: string; name: string; job?: string; isSubstitute?: boolean }
export interface RecipientOption {
  value: string; playerName: string; characterName?: string; job?: string;
  characterRegistrationId: string | null; rank: number | null;
  source: 'character_registration' | 'player_fallback' | 'roster';
  reasons: string[]; warnings: string[]; alreadyReceived: boolean; isSub: boolean; emphasized: boolean;
}

export function useRecipientSelection({ candidates, players, initialPlayerId }: {
  candidates: RankedCandidate[]; players: RecipientPlayerLite[]; initialPlayerId?: string;
}) {
  const first = initialPlayerId ?? candidates[0]?.rosterPlayerId ?? players[0]?.id ?? '';
  const [selectedPlayerId, setSelectedPlayerId] = useState(first);
  const [selectedCharacterRegistrationId, setSelectedReg] = useState<string | null>(
    candidates.find(c => c.rosterPlayerId === first)?.characterRegistrationId ?? null,
  );

  const select = (playerId: string, characterRegistrationId?: string | null) => {
    setSelectedPlayerId(playerId);
    setSelectedReg(characterRegistrationId !== undefined
      ? characterRegistrationId
      : candidates.find(c => c.rosterPlayerId === playerId)?.characterRegistrationId ?? null);
  };

  const options = useMemo<RecipientOption[]>(() => {
    const subById = new Map(players.map(p => [p.id, p]));
    const map = new Map<string, RecipientOption>();
    for (const c of candidates) {
      const p = subById.get(c.rosterPlayerId);
      const alreadyReceived = c.alreadyReceivedRelevantLoot === true;
      map.set(c.rosterPlayerId, {
        value: c.rosterPlayerId, playerName: c.playerName, characterName: c.characterName, job: c.job,
        characterRegistrationId: c.characterRegistrationId, rank: c.priorityRank, source: c.source,
        reasons: c.reasons, warnings: c.warnings, alreadyReceived,
        isSub: !!p?.isSubstitute, emphasized: c.priorityRank != null && !alreadyReceived,
      });
    }
    for (const p of players) {
      if (map.has(p.id)) continue;
      map.set(p.id, {
        value: p.id, playerName: p.name, job: p.job, characterRegistrationId: null, rank: null,
        source: 'roster', reasons: [], warnings: [], alreadyReceived: false,
        isSub: !!p.isSubstitute, emphasized: false,
      });
    }
    if (selectedPlayerId && !map.has(selectedPlayerId)) {
      const p = subById.get(selectedPlayerId);
      map.set(selectedPlayerId, {
        value: selectedPlayerId, playerName: p?.name ?? selectedPlayerId, job: p?.job,
        characterRegistrationId: selectedCharacterRegistrationId, rank: null, source: 'roster',
        reasons: [], warnings: [], alreadyReceived: false, isSub: !!p?.isSubstitute, emphasized: false,
      });
    }
    return [...map.values()];
  }, [candidates, players, selectedPlayerId, selectedCharacterRegistrationId]);

  return { selectedPlayerId, selectedCharacterRegistrationId, select, options };
}
```

- [ ] **Step 4: Run test to verify it passes** — PASS (3 tests).

- [ ] **Step 5: Commit**
```bash
git add frontend/src/hooks/useRecipientSelection.ts frontend/src/hooks/useRecipientSelection.test.ts
git commit -m "feat(loot): useRecipientSelection — invariant options with priority/sub/dim metadata"
```

---

## Task 2: `RecipientSelect` dedicated rich combobox

**Files:**
- Create: `frontend/src/components/loot/RecipientSelect.tsx`
- Test: `frontend/src/components/loot/RecipientSelect.test.tsx`

**Interfaces:**
- Consumes: `useRecipientSelection` (Task 1). Reuses the row visuals from `LootRecommendationCandidates` (extract a shared `RecipientRow` or copy the JSX — rank badge, `JobIcon`, name + sub-name, `RoleBadge`, ⚠ tooltip, Received chip).
- Produces: `RecipientSelect` props =
  `{ recommendation: LootRecommendation; players: RecipientPlayerLite[]; value: string; onChange: (playerId: string, characterRegistrationId: string | null) => void; disabled?: boolean }`.
  - **Trigger:** rich — rank badge + job icon + selected name + priority label (e.g. "Top Priority", or "Rank 3", or no label for non-priority) + Main/Sub badge.
  - **Menu:** all options in order; **emphasized rows bright**, **non-emphasized (no priority / already received / extra roster) dimmed** (`opacity-60`); subs show a `Sub` badge; #1 shows a `Recommended` tag; ⚠ warnings tooltip retained. Confidence shown as a small menu-header caption.

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecipientSelect } from './RecipientSelect';
// recommendation with a #1 priority + a fallback (rank null); players includes a sub
it('selecting a dimmed fallback player reports it and it sticks', () => {
  const onChange = vi.fn();
  // render <RecipientSelect recommendation={rec} players={players} value={rec.rankedCandidates[0].rosterPlayerId} onChange={onChange} />
  fireEvent.click(screen.getByRole('button')); // open
  fireEvent.click(screen.getByText(/FallbackName/i));
  expect(onChange).toHaveBeenCalledWith('fallback-id', null);
});
it('marks the #1 candidate as Recommended and dims non-priority rows', () => {
  // assert a "Recommended" tag on rank 1 and an opacity/dim class on a no-priority row
});
```
(Drive the Radix Select open in jsdom the way existing `Select` tests do.)

- [ ] **Step 2: Run test to verify it fails** — `pnpm test -- RecipientSelect` → FAIL.

- [ ] **Step 3: Implement**

Build on the Radix Select primitives used by `components/ui/Select.tsx` (custom `SelectItem` content is allowed). Wire `value`/`onChange` to the parent but use the hook internally for `options` + `select`. Render each `SelectItem` as a `RecipientRow` (extract from `LootRecommendationCandidates` into a shared `RecipientRow.tsx`, or import the row component). Apply `opacity-60` (or a `text-text-muted` treatment) to rows where `!option.emphasized`; show `Recommended` on `rank === 1`; show a `Sub` badge when `isSub`; keep the ⚠ tooltip. Menu header: `confidence` caption + (optional) a search input. On change: `select(id, reg); onChange(id, reg)`.

Keep the portal/scroll behavior consistent with the rest of the app (note Plan F §4.1 fixes Select's portal/scroll — coordinate so the recipient menu doesn't reintroduce the shift; if Plan F landed, inherit it).

- [ ] **Step 4: Run test to verify it passes** — PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/loot/RecipientSelect.tsx frontend/src/components/loot/RecipientSelect.test.tsx frontend/src/components/loot/RecipientRow.tsx
git commit -m "feat(loot): RecipientSelect — rich recipient dropdown (priority emphasized, others dimmed)"
```

---

## Task 3: Migrate `QuickLogDropModal`

**Files:** Modify `frontend/src/components/loot/QuickLogDropModal.tsx`

- [ ] **Step 1: Remove the redundant UI**

Delete: the `<LootRecommendationCandidates>` Recommendation panel (~302), the `Include Subs` / `Show all players` checkboxes + their state, the `recipientOptions` memo (~242) and the plain recipient `<Select>` (~315), and any open-reset effect that snapped the selection.

- [ ] **Step 2: Render `RecipientSelect`**

Pass `players` = all configured players **including subs** (so subs appear dimmed-with-badge instead of behind a checkbox): e.g. `allPlayers.filter(p => p.configured)`. Wire `value={recipientPlayerId}` and `onChange={(pid, reg) => { setRecipientPlayerId(pid); setSelectedCharRegId(reg); }}`. Keep the `recommendation` memo feeding it. Everything else (week, count, method, mark-acquired, notes) unchanged.

- [ ] **Step 3: Verify the bug is gone + subs reachable**

`pnpm test -- QuickLogDropModal` + loot recommendation tests. Manual: open Log Loot Drop — one dropdown; #1 tagged Recommended; lower/fallback players selectable and they stick; subs appear dimmed with a `Sub` badge and are selectable; no separate Recommendation panel or checkboxes.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/loot/QuickLogDropModal.tsx
git commit -m "refactor(loot): QuickLogDropModal uses unified RecipientSelect (drop panel + checkboxes)"
```

---

## Task 4: Migrate `AddLootEntryModal`

**Files:** Modify `frontend/src/components/history/AddLootEntryModal.tsx`

- [ ] **Step 1: Remove the redundant UI + patch**

Delete its Recommendation panel, the `Include Subs` / `Show all players` checkboxes, the `visibleRecipients` construction, the clobbering reset effect (~L312), and the plain recipient `<Select>`.

- [ ] **Step 2: Render `RecipientSelect`**

Pass all configured players (incl. subs), wire `value`/`onChange` to this modal's recipient + character-registration state. Preserve **edit-mode prefill** by passing the existing recipient as `value` (the hook seeds it into options so it's always representable).

- [ ] **Step 3: Verify**

`pnpm test -- AddLootEntryModal`. Manual: add + edit flows — every player (priority, dimmed, sub, fallback) selectable and sticks; editing preserves the existing recipient.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/history/AddLootEntryModal.tsx
git commit -m "refactor(loot): AddLootEntryModal uses unified RecipientSelect (drop panel + checkboxes)"
```

---

## Task 4b: Automate the "Character (optional)" field

**Diagnosis:** `AddLootEntryModal.tsx` already auto-selects the recipient's **primary** character registration when the recipient changes (~334–341), with a `Character (optional)` `Select` (~569) built from `playerRegistrations[recipientPlayerId]` (`useStaticCharacterStore`). `QuickLogDropModal.tsx` lacks the field entirely. The field only matters when a player has **2+** linked characters; otherwise it's noise.

**Files:** Modify `frontend/src/components/loot/QuickLogDropModal.tsx`, `frontend/src/components/history/AddLootEntryModal.tsx`

- [ ] **Step 1: Auto-select + conditionally hide**

In both modals, when the recipient changes, auto-select that recipient's **primary** registration (reuse `getPrimaryRegistration`). Render the `Character (optional)` `Select` **only when the recipient has ≥2 registrations** — when they have 0 or 1, hide it (the single/none case is fully determined, so the field is redundant). When hidden, still submit the resolved primary registration id.

- [ ] **Step 2: Add the field to QuickLogDropModal**

QuickLogDropModal currently has no character field — add the same conditional `Character` Select (≥2 regs only), wired to the recipient chosen via `RecipientSelect`. Since `RecipientSelect`/`useRecipientSelection` already carries `characterRegistrationId` for the *recommended* character, default to that when present, else the primary.

- [ ] **Step 3: Verify + commit**

Manual: pick a single-character recipient → no Character field, logs their character; pick a multi-character recipient → field appears defaulted to primary/recommended, changeable. Both modals consistent.
```bash
git add frontend/src/components/loot/QuickLogDropModal.tsx frontend/src/components/history/AddLootEntryModal.tsx
git commit -m "feat(loot): auto-select recipient character; hide the Character field unless 2+ exist"
```

---

## Task 5: Cleanup + release note + verification

**Files:** `frontend/src/components/loot/LootRecommendationCandidates.tsx` (conditional), `frontend/src/data/releaseNotes.ts`

- [ ] **Step 1: Retire the standalone panel if now unused**

Run: `cd frontend && grep -rn "LootRecommendationCandidates" src`. If the only references were the two modals (now migrated), delete `LootRecommendationCandidates.tsx` (its visuals now live in `RecipientRow`/`RecipientSelect`). If still used elsewhere, leave it.

- [ ] **Step 2: Public release note + version bump**

Add a public `releaseNotes.ts` entry: title "Streamlined loot recipient picker", description: "Logging loot now uses a single recipient dropdown that shows everyone — priority players highlighted, subs badged, and less-relevant players dimmed — replacing the separate recommendation list and visibility checkboxes." Include `pr`, `prTitle`, full ISO date. **Bump `CURRENT_VERSION`** to match.

- [ ] **Step 3: Full gate + commit**

```bash
cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test
cd ../scripts && npm test
```
```bash
git add frontend/src/components/loot/ frontend/src/data/releaseNotes.ts
git commit -m "feat(loot): unify recommendation + recipient into one dropdown"
```

---

## Self-review notes (already applied)

- **Direction (user-chosen):** show *everyone* in one dropdown, **dim** the unimportant (no priority / already received / extra roster), badge subs, tag #1 Recommended — remove the Recommendation panel AND the `Include Subs`/`Show all players` checkboxes. Build a **dedicated** `RecipientSelect` (don't bloat the shared `Select`).
- **Bug stays fixed:** the invariant lives in `useRecipientSelection` with a locking test; making the dropdown the only picker is exactly why the invariant is mandatory. Fallback/dimmed/sub players are all guaranteed-selectable.
- **Subs:** sourced from `allPlayers` (`isSubstitute`) and shown dimmed-with-badge by default, replacing the `Include Subs` toggle.
- **Visual reuse:** row vocabulary extracted from `LootRecommendationCandidates` into a shared `RecipientRow` so the dropdown matches today's recommendation styling; the standalone panel file is removed if unreferenced.
- **Coordinate with Plan F §4.1** (Select portal/scroll fix) so the rich menu doesn't reintroduce the page-shift; with Plan E §5 (player-card menu) only loosely (different surface).
- **User-facing** → public release note + `CURRENT_VERSION` bump (changed from the earlier internal-only framing, since the modal UI visibly changes).
- **Line numbers are point-in-time** — verify before editing.
```
