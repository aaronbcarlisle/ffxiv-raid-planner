# F6d (part 1) — Loot Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v2 Loot screen's **Priority** view (floor cards + ranked queues + the unified `RecipientPicker` + week clock) and wire it behind `?shell=v2` as the `gear` slot — PR 1 of 2 of the F6d slice.

**Architecture:** New ring-0 components in `components/loot/` + one shared `ui/PriorityRow`, assembled by `<Loot/>` and injected via `slots.gear` from `NewShell` (the F6b/F6c seam). Priority math reuses `utils/priority.ts` + a **verbatim promotion** of `LootPriorityPanel.enhanceEntries` → `utils/priorityEntries.ts`. The week clock is a `useWeekClock` hook over `lootTrackingStore` + one **additive** backend field (`weekStartDate` on `GET current-week`). Legacy `/group/:shareCode` stays byte-for-byte (`!slots?.gear` guards).

**Tech Stack:** React 19 + TS, Zustand, Vitest + @testing-library/react (**fireEvent, NOT user-event**), Tailwind semantic tokens, FastAPI + pytest (one endpoint touch).

**Spec:** `design/redesign/specs/2026-07-01-f6d-loot-design.md` (§§ referenced per task). Mockups: `design/redesign/mockups/03-loot-priority.html`, `03-loot-priority-with-picker.html`.

## Global Constraints

- **Branch:** `redesign/f6d-priority` off `redesign/foundation` (head `d8360e3`). One commit per task.
- **BYTE-FOR-BYTE legacy.** The ONLY legacy-file edits in this PR: Task 1 (`LootPriorityPanel` repoint — behavior-neutral, test-locked), Task 2 (`lootTrackingStore` additive `weekStartDate` field + backend additive response field), Task 10 (`GroupViewContent` `!slots?.gear` gates — no-ops when `slots` is undefined). Nothing else in legacy files.
- **NO new `eslint-suppressions.json` entries.** New code lives in `components/ui/` (shared) or `components/loot/` (already ring0 in `eslint.config.js`). Sub-12px text needs an inline `design-system-ignore: <reason>` (GearBoardCell precedent), never a suppressions entry.
- **Tokens only** (no raw hex/rgb; `color-mix(... var(--color-*) ...)` is fine). 12px floor for readable text.
- **NO AI attribution** in any commit message.
- Release note: `{ internal: true }`, `pr: 0` placeholder, **no CURRENT_VERSION bump** (stays 2.0.2).
- Test conventions (f6c lessons): NO `cn`/`clsx` util exists — template literals, no trailing spaces; `@testing-library/user-event` is NOT a dep — use `fireEvent`; import shared ui via the barrel `'../ui'`; Radix dropdowns open on `fireEvent.keyDown(trigger, { key: 'Enter' })`.
- Reviewer: `redesign-reviewer` per task (diff-scoped). Implementers **sonnet-5**; **opus/fable for Tasks 1, 4, 9, 10** (flagged riskiest).
- Gate (Task 11, all green): `pnpm build` · `pnpm lint` (0 err) · `pnpm check:design-system:strict` · `pnpm test` · `pnpm tokens:check` · `git diff --check` · backend `pytest tests/test_week_management.py -q`.

---

### Task 1: Promote `enhanceEntries` → `utils/priorityEntries.ts` (SANCTIONED legacy repoint) [opus]

The enhanced-priority sort (base score + drought bonus − balance penalty, configurable caps) lives as a closure inside `LootPriorityPanel`. Promote it **verbatim** so v2 (`FloorCard`, `RecipientPicker`) shares one implementation. This is one of the two sanctioned legacy edits — the repoint must be behavior-neutral, statement-for-statement.

**Files:**
- Create: `frontend/src/utils/priorityEntries.ts`
- Create: `frontend/src/utils/priorityEntries.test.ts`
- Modify: `frontend/src/components/loot/LootPriorityPanel.tsx` (interface `EnhancedPriorityEntry` at `:36-42`, `enhanceEntries` at `:429-466`, imports at `:10-24`)

**Interfaces (produces):**
```ts
export interface EnhancedPriorityEntry extends PriorityEntry {
  enhancedScore?: number; droughtBonus?: number; balancePenalty?: number;
  breakdown?: PriorityScoreBreakdown;
}
export interface EnhanceContext {
  settings: StaticSettings; lootLog: LootLogEntry[]; currentWeek: number;
  averageDrops: number; active: boolean; // the panel's isEnhancedScoringActive gate
}
export function enhancePriorityEntries(entries: PriorityEntry[], ctx: EnhanceContext): EnhancedPriorityEntry[];
```

- [ ] **Step 1: Write the failing test** (`frontend/src/utils/priorityEntries.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { enhancePriorityEntries } from './priorityEntries';
import { DEFAULT_SETTINGS } from './constants';
import type { SnapshotPlayer, LootLogEntry } from '../types';
import type { PriorityEntry } from './priority';

function makePlayer(id: string, name: string): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: 'PLD', role: 'tank',
    configured: true, sortOrder: 0, isSubstitute: false,
    gear: [], tomeWeapon: {}, weaponPriorities: [],
  } as unknown as SnapshotPlayer;
}
function makeDrop(playerId: string, weekNumber: number): LootLogEntry {
  return {
    id: 1, tierSnapshotId: 't1', weekNumber, floor: 'M9S', itemSlot: 'earring',
    recipientPlayerId: playerId, recipientPlayerName: 'x', method: 'drop',
    isExtra: false, createdAt: '2026-01-01T00:00:00Z',
  } as unknown as LootLogEntry;
}
const settings = { ...DEFAULT_SETTINGS };

describe('enhancePriorityEntries', () => {
  const alice = makePlayer('a', 'Alice');
  const bob = makePlayer('b', 'Bob');
  const entries: PriorityEntry[] = [
    { player: alice, score: 100 },
    { player: bob, score: 100 },
  ];

  it('attaches breakdown and preserves order when inactive', () => {
    const out = enhancePriorityEntries(entries, {
      settings, lootLog: [], currentWeek: 3, averageDrops: 0, active: false,
    });
    expect(out.map((e) => e.player.id)).toEqual(['a', 'b']);
    expect(out[0].breakdown).toBeDefined();
    expect(out[0].enhancedScore).toBeUndefined();
  });

  it('re-sorts by enhanced score when active (drought bonus lifts the dry player)', () => {
    // Alice got a drop in week 3 (current); Bob never did → Bob gets drought bonus.
    const lootLog = [makeDrop('a', 3)];
    const out = enhancePriorityEntries(entries, {
      settings, lootLog, currentWeek: 3, averageDrops: 0.5, active: true,
    });
    expect(out[0].player.id).toBe('b');
    expect(out[0].enhancedScore).toBeGreaterThan(out[1].enhancedScore!);
    expect(out[0].droughtBonus).toBeGreaterThan(0);
  });

  it('breaks enhanced-score ties alphabetically', () => {
    const out = enhancePriorityEntries(entries, {
      settings, lootLog: [], currentWeek: 1, averageDrops: 0, active: true,
    });
    expect(out.map((e) => e.player.name)).toEqual(['Alice', 'Bob']);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm -C frontend test -- --run priorityEntries` → FAIL (module not found).

- [ ] **Step 3: Create `frontend/src/utils/priorityEntries.ts`** — body copied **verbatim** from `LootPriorityPanel.tsx:429-466` (only change: closure vars `settings/lootLog/currentWeek/averageDrops/isEnhancedScoringActive` become `ctx` fields, `isEnhancedScoringActive` → `active`):

```ts
/**
 * Enhanced priority entries — PROMOTED VERBATIM from
 * components/loot/LootPriorityPanel.tsx `enhanceEntries` (F6d Task 1,
 * sanctioned repoint per spec §6.2). One shared implementation for the legacy
 * panel and the v2 Loot surfaces (FloorCard, RecipientPicker). Do not "improve"
 * the logic here — behavior parity with the legacy panel is the contract.
 */
import type { StaticSettings, LootLogEntry } from '../types';
import {
  calculatePriorityScoreWithBreakdown,
  type PriorityEntry,
  type PriorityScoreBreakdown,
} from './priority';
import {
  calculatePlayerLootStats,
  calculateEnhancedScoreWithBreakdown,
} from './lootCoordination';

export interface EnhancedPriorityEntry extends PriorityEntry {
  enhancedScore?: number;
  droughtBonus?: number;
  balancePenalty?: number;
  breakdown?: PriorityScoreBreakdown;
}

export interface EnhanceContext {
  settings: StaticSettings;
  lootLog: LootLogEntry[];
  currentWeek: number;
  averageDrops: number;
  /** The panel's `isEnhancedScoringActive` gate — false ⇒ breakdowns only, no re-sort. */
  active: boolean;
}

export function enhancePriorityEntries(
  entries: PriorityEntry[],
  { settings, lootLog, currentWeek, averageDrops, active }: EnhanceContext,
): EnhancedPriorityEntry[] {
  const entriesWithBreakdown = entries.map((entry) => {
    const breakdown = calculatePriorityScoreWithBreakdown(entry.player, settings);
    return {
      ...entry,
      breakdown,
    };
  });

  if (!active) {
    return entriesWithBreakdown;
  }

  return entriesWithBreakdown.map((entry) => {
    const stats = calculatePlayerLootStats(entry.player.id, lootLog, currentWeek);
    const enhanced = calculateEnhancedScoreWithBreakdown(
      entry.score,
      stats,
      averageDrops,
      settings
    );

    return {
      ...entry,
      enhancedScore: enhanced.score,
      droughtBonus: enhanced.droughtBonus,
      balancePenalty: enhanced.balancePenalty,
    };
  }).sort((a, b) => {
    const scoreA = a.enhancedScore ?? a.score;
    const scoreB = b.enhancedScore ?? b.score;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.player.name.localeCompare(b.player.name);
  });
}
```

- [ ] **Step 4: Run to verify pass** — `pnpm -C frontend test -- --run priorityEntries` → 3 pass.

- [ ] **Step 5: Repoint `LootPriorityPanel.tsx`** (behavior-neutral):
  1. Delete the local `interface EnhancedPriorityEntry` (`:36-42`); add `import { enhancePriorityEntries, type EnhancedPriorityEntry } from '../../utils/priorityEntries';`.
  2. Replace the `enhanceEntries` closure body (`:429-466`) with a thin delegate — **note the existing prop default for `currentWeek` (check the destructuring; QuickLogDropModal uses `currentWeek = 1` — mirror whatever the panel already does, do NOT change it):**
  ```ts
  // Helper to enhance priority entries with loot history and breakdown
  const enhanceEntries = (entries: PriorityEntry[]): EnhancedPriorityEntry[] =>
    enhancePriorityEntries(entries, {
      settings, lootLog, currentWeek, averageDrops, active: isEnhancedScoringActive,
    });
  ```
  3. Remove now-unused imports **only if genuinely unused elsewhere in the file** (`calculatePriorityScoreWithBreakdown`, `calculateEnhancedScoreWithBreakdown`, `calculatePlayerLootStats`, `PriorityScoreBreakdown`) — `calculateAverageDrops` stays (the `averageDrops` memo at `:422-426` uses it). Verify with a file-wide search per symbol before removing.

- [ ] **Step 6: Verify neutrality** — `pnpm -C frontend build` green; `pnpm -C frontend test -- --run` full suite green (any existing LootPriorityPanel/priority tests must pass untouched).

- [ ] **Step 7: Commit** — `git add -A && git commit -m "refactor(loot): promote enhanceEntries to utils/priorityEntries and repoint LootPriorityPanel"`

---

### Task 2: Week clock — backend `weekStartDate` (additive) + store field + `useWeekClock`

The spec's §5.4/§6.3: `GET .../current-week` additionally returns the tier's `week_start_date`; the store keeps it; `useWeekClock` derives week date ranges and exposes the clock actions. **This PR's only backend touch — additive, non-breaking (extra JSON field; plugin DTOs ignore unknowns).**

**Files:**
- Modify: `backend/app/routers/loot_tracking.py:851-855` (the `get_current_week` return dict)
- Modify: `backend/tests/test_week_management.py` (extend existing current-week coverage)
- Modify: `frontend/src/stores/lootTrackingStore.ts` (state interface + initial state near `currentWeek: 1`; `fetchCurrentWeek` at `:293-313`; `clearLootTracking` reset block; export `WeekEntryType` if not already exported at `:28`)
- Create: `frontend/src/hooks/useWeekClock.ts`
- Create: `frontend/src/hooks/useWeekClock.test.ts`

**Interfaces (produces):**
```ts
export interface WeekRange { start: Date; end: Date }
export interface WeekClock {
  currentWeek: number; maxWeek: number; weekStartDate: string | null;
  weeksWithData: Set<number>; weekDataTypes: Map<number, WeekEntryType[]>;
  rangeOfWeek: (week: number) => WeekRange | null;
  isCurrent: (week: number) => boolean;
  startNextWeek: () => Promise<number>; revertWeek: () => Promise<number>;
}
export function useWeekClock(groupId: string | undefined, tierId: string | undefined): WeekClock;
```

- [ ] **Step 1: Backend change** — in `get_current_week` (`loot_tracking.py:805`), extend the return:
```python
    return {
        "currentWeek": calculated_week,
        "maxLoggedWeek": max_logged_week,
        "maxWeek": max_week,
        "weekStartDate": tier.week_start_date.isoformat() if tier.week_start_date else None,
    }
```

- [ ] **Step 2: Backend test** — in `backend/tests/test_week_management.py`, find the existing test that GETs `current-week` (or the module's week-calculation tests) and, using the same client/group/tier fixtures its neighbors use, add a test asserting: (a) the response contains `weekStartDate`; (b) it is `None` before any entry is logged; (c) after logging one loot entry (mirror how a neighboring test creates one), `weekStartDate` is a parseable ISO datetime. Run: `cd backend && venv/Scripts/python.exe -m pytest tests/test_week_management.py -q` → all pass.

- [ ] **Step 3: Store additive field** — in `lootTrackingStore.ts`:
  1. State interface: add `weekStartDate: string | null;` next to `currentWeek: number;`. Initial state: `weekStartDate: null,`.
  2. `fetchCurrentWeek` (`:293-313`): change the response type to `{ currentWeek: number; maxWeek: number; weekStartDate?: string | null }` and the success `set` to also write `weekStartDate: response.weekStartDate ?? null,`.
  3. `clearLootTracking`: add `weekStartDate: null,` to the reset object.
  4. If `WeekEntryType` (`:28`) is not exported, add `export` to it (type-only, additive).
  These are **additive** store edits — document in the PR body alongside the Task 1 repoint.

- [ ] **Step 4: Write the failing hook test** (`frontend/src/hooks/useWeekClock.test.ts`)

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWeekClock } from './useWeekClock';
import { useLootTrackingStore } from '../stores/lootTrackingStore';

describe('useWeekClock', () => {
  beforeEach(() => {
    useLootTrackingStore.setState({
      currentWeek: 3, maxWeek: 4, weekStartDate: '2026-06-10T00:00:00Z',
      weeksWithEntries: new Set([1, 3]),
    });
  });

  it('exposes the clock state', () => {
    const { result } = renderHook(() => useWeekClock('g1', 't1'));
    expect(result.current.currentWeek).toBe(3);
    expect(result.current.maxWeek).toBe(4);
    expect(result.current.isCurrent(3)).toBe(true);
    expect(result.current.isCurrent(2)).toBe(false);
  });

  it('rangeOfWeek maps week N to anchor + (N-1)*7d .. +6d', () => {
    const { result } = renderHook(() => useWeekClock('g1', 't1'));
    const r1 = result.current.rangeOfWeek(1)!;
    expect(r1.start.toISOString().slice(0, 10)).toBe('2026-06-10');
    expect(r1.end.toISOString().slice(0, 10)).toBe('2026-06-16');
    const r3 = result.current.rangeOfWeek(3)!;
    expect(r3.start.toISOString().slice(0, 10)).toBe('2026-06-24');
  });

  it('rangeOfWeek is null without an anchor', () => {
    useLootTrackingStore.setState({ weekStartDate: null });
    const { result } = renderHook(() => useWeekClock('g1', 't1'));
    expect(result.current.rangeOfWeek(1)).toBeNull();
  });
});
```

- [ ] **Step 5: Run to fail** — `pnpm -C frontend test -- --run useWeekClock` → FAIL (module not found).

- [ ] **Step 6: Create `frontend/src/hooks/useWeekClock.ts`**

```ts
/**
 * useWeekClock — the shared week object (F6d, spec §5.4). One clock for the
 * whole shell: Loot consumes it now (WeekScopeControl, floor chips, picker
 * default week); F6e's Schedule/WeekNavigatorStrip reuses it. Weeks are
 * tier-relative integers anchored to the backend's `week_start_date`
 * (7-day buckets — see backend calculate_week_number).
 */
import { useCallback } from 'react';
import { useLootTrackingStore, type WeekEntryType } from '../stores/lootTrackingStore';

export interface WeekRange { start: Date; end: Date }

export interface WeekClock {
  currentWeek: number;
  maxWeek: number;
  weekStartDate: string | null;
  weeksWithData: Set<number>;
  weekDataTypes: Map<number, WeekEntryType[]>;
  rangeOfWeek: (week: number) => WeekRange | null;
  isCurrent: (week: number) => boolean;
  startNextWeek: () => Promise<number>;
  revertWeek: () => Promise<number>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function useWeekClock(groupId: string | undefined, tierId: string | undefined): WeekClock {
  const currentWeek = useLootTrackingStore((s) => s.currentWeek);
  const maxWeek = useLootTrackingStore((s) => s.maxWeek);
  const weekStartDate = useLootTrackingStore((s) => s.weekStartDate);
  const weeksWithData = useLootTrackingStore((s) => s.weeksWithEntries);
  const weekDataTypes = useLootTrackingStore((s) => s.weekDataTypes);
  const storeStartNextWeek = useLootTrackingStore((s) => s.startNextWeek);
  const storeRevertWeek = useLootTrackingStore((s) => s.revertWeek);

  const rangeOfWeek = useCallback((week: number): WeekRange | null => {
    if (!weekStartDate) return null;
    const anchor = new Date(weekStartDate);
    if (Number.isNaN(anchor.getTime())) return null;
    const start = new Date(anchor.getTime() + (week - 1) * 7 * DAY_MS);
    const end = new Date(start.getTime() + 6 * DAY_MS);
    return { start, end };
  }, [weekStartDate]);

  const isCurrent = useCallback((week: number) => week === currentWeek, [currentWeek]);

  const startNextWeek = useCallback(async () => {
    if (!groupId || !tierId) throw new Error('useWeekClock: missing group/tier context');
    return storeStartNextWeek(groupId, tierId);
  }, [groupId, tierId, storeStartNextWeek]);

  const revertWeek = useCallback(async () => {
    if (!groupId || !tierId) throw new Error('useWeekClock: missing group/tier context');
    return storeRevertWeek(groupId, tierId);
  }, [groupId, tierId, storeRevertWeek]);

  return {
    currentWeek, maxWeek, weekStartDate, weeksWithData, weekDataTypes,
    rangeOfWeek, isCurrent, startNextWeek, revertWeek,
  };
}
```
Note: if `startNextWeek`/`revertWeek` in the store return `Promise<number>` already (they do — `lootTrackingStore.ts:738/767`), the types line up; do not wrap their results.

- [ ] **Step 7: Run to pass** — `pnpm -C frontend test -- --run useWeekClock` → 3 pass. `pnpm -C frontend build` green.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(loot): week clock — weekStartDate on current-week (additive) + useWeekClock hook"`

---

### Task 3: `PriorityRow` (shared `ui/`)

The inline ranked chip queue (mockup `.pq`/`.pqchip`) — F5 catalog #19, shared with Home later. Presentational, props-in only.

**Files:**
- Create: `frontend/src/components/ui/PriorityRow.tsx`
- Create: `frontend/src/components/ui/PriorityRow.test.tsx`
- Modify: `frontend/src/components/ui/index.ts` (barrel export)

**Interfaces (produces):**
```ts
export interface PriorityRowEntry { playerId: string; name: string; role: string; rank: number }
export interface PriorityRowProps { entries: PriorityRowEntry[]; maxVisible?: number; emptyLabel?: string }
export function PriorityRow(props: PriorityRowProps): JSX.Element;
```

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriorityRow } from './PriorityRow';

const entries = [
  { playerId: 'a', name: 'Caster One', role: 'caster', rank: 1 },
  { playerId: 'b', name: 'Melee One', role: 'melee', rank: 2 },
  { playerId: 'c', name: 'Ranged One', role: 'ranged', rank: 3 },
  { playerId: 'd', name: 'Tank One', role: 'tank', rank: 4 },
  { playerId: 'e', name: 'Healer One', role: 'healer', rank: 5 },
];

describe('PriorityRow', () => {
  it('renders up to maxVisible chips + overflow count', () => {
    render(<PriorityRow entries={entries} />);
    expect(screen.getByText('Caster One')).toBeInTheDocument();
    expect(screen.getByText('Ranged One')).toBeInTheDocument();
    expect(screen.queryByText('Tank One')).not.toBeInTheDocument();
    expect(screen.getByText('+2 eligible')).toBeInTheDocument();
  });

  it('marks the first chip as top priority', () => {
    render(<PriorityRow entries={entries} />);
    const list = screen.getByRole('list', { name: 'Priority queue' });
    const items = list.querySelectorAll('li');
    expect(items[0].textContent).toContain('#1');
    expect(items[0].getAttribute('data-top')).toBe('true');
  });

  it('renders the empty label when no one needs it', () => {
    render(<PriorityRow entries={[]} emptyLabel="no one needs this" />);
    expect(screen.getByText('no one needs this')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to fail** — `pnpm -C frontend test -- --run PriorityRow` → FAIL.

- [ ] **Step 3: Implement `frontend/src/components/ui/PriorityRow.tsx`**

```tsx
/**
 * PriorityRow — inline ranked priority queue (F6d, spec §5.1; F5 catalog #19).
 * Mockup: 03-loot-priority.html `.pq` — up to N role-colored chips
 * (avatar initials + name + rank, first chip accent-highlighted) with a
 * "+N eligible" overflow. Shared ui/: presentational, no store imports.
 * Consumed by Loot's FloorDropRow now; Home is a future consumer.
 */

export interface PriorityRowEntry {
  playerId: string;
  name: string;
  /** Role slug (tank|healer|melee|ranged|caster) — drives the avatar token. */
  role: string;
  rank: number;
}

export interface PriorityRowProps {
  entries: PriorityRowEntry[];
  /** Chips shown before the "+N eligible" overflow. Default 3. */
  maxVisible?: number;
  emptyLabel?: string;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function PriorityRow({ entries, maxVisible = 3, emptyLabel = 'no one needs this' }: PriorityRowProps) {
  if (entries.length === 0) {
    return <span className="text-xs text-text-muted">{emptyLabel}</span>;
  }
  const visible = entries.slice(0, maxVisible);
  const overflow = entries.length - visible.length;

  return (
    <ul aria-label="Priority queue" className="flex min-w-0 items-center gap-2 overflow-hidden">
      {visible.map((entry, i) => {
        const top = i === 0;
        return (
          <li
            key={entry.playerId}
            data-top={top ? 'true' : undefined}
            className={`flex flex-none items-center gap-1.5 rounded-full border py-0.5 pl-1 pr-2.5 ${
              top ? 'border-accent bg-accent-dim' : 'border-border-subtle bg-surface-interactive'
            }`}
          >
            <span
              aria-hidden
              /* design-system-ignore: 10px initials inside a 22px avatar glyph — decorative, name is adjacent */
              className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: `var(--color-role-${entry.role}, var(--color-text-muted))` }}
            >
              {initials(entry.name)}
            </span>
            <span className="truncate text-xs font-semibold text-text-primary">{entry.name}</span>
            <span className={`font-display text-xs font-extrabold ${top ? 'text-accent' : 'text-text-muted'}`}>
              #{entry.rank}
            </span>
          </li>
        );
      })}
      {overflow > 0 && <li className="flex-none text-xs text-text-tertiary">+{overflow} eligible</li>}
    </ul>
  );
}
```
If `bg-accent-dim` is not an existing utility, use `bg-accent/15` — check with `grep -r "accent-dim" frontend/src/components` and match whatever the F6b/F6c components use for the accent-dim surface.

- [ ] **Step 4: Run to pass** — `pnpm -C frontend test -- --run PriorityRow` → 3 pass.

- [ ] **Step 5: Barrel export** — in `frontend/src/components/ui/index.ts` add (alphabetical near `ProgressBar`): `export { PriorityRow, type PriorityRowProps, type PriorityRowEntry } from './PriorityRow';`

- [ ] **Step 6: DS check + commit** — `pnpm -C frontend check:design-system` clean for the new file; `git add -A && git commit -m "feat(ui): PriorityRow ranked chip queue"`

---

### Task 4: `buildRecipientEntries` + `RecipientPicker` (the unification) [opus]

The single most bug-killing consolidation of the redesign (spec §2.2/§5.3): one modal replaces `QuickLogDropModal` + `AddLootEntryModal` for gear drops. **Payload parity with the legacy modals is the correctness contract** — the picker submits through the SAME `logLootAndUpdateGear` util with the same shapes.

**Files:**
- Create: `frontend/src/utils/recipientRanking.ts`
- Create: `frontend/src/utils/recipientRanking.test.ts`
- Create: `frontend/src/components/loot/RecipientPicker.tsx`
- Create: `frontend/src/components/loot/RecipientPicker.test.tsx`

**Interfaces (consumes):** `enhancePriorityEntries` (Task 1), `getPriorityForItem/Ring` + `calculatePlayerLootStats`/`calculateAverageDrops`, `logLootAndUpdateGear(groupId, tierId, data: LootLogEntryCreate, options)` (`utils/lootCoordination.ts:65`), `useStaticCharacterStore` + `getPrimaryRegistration` (mirror `QuickLogDropModal.tsx:75-121`), `SegmentedToggle` (ui).

**Interfaces (produces):**
```ts
// utils/recipientRanking.ts
export type PickerScope = 'priority' | 'all' | 'offspec';
export type NeedTag = 'bis' | 'minor' | 'free';
export interface RecipientEntry {
  player: SnapshotPlayer; rank: number | null; needsItem: boolean;
  reason: string; needTag: NeedTag;
}
export function buildRecipientEntries(args: {
  players: SnapshotPlayer[]; slot: GearSlot | 'ring'; scope: PickerScope;
  settings: StaticSettings; lootLog: LootLogEntry[]; currentWeek: number; enhancedActive: boolean;
}): RecipientEntry[];

// components/loot/RecipientPicker.tsx
export interface DropItemContext {
  slot: GearSlot | 'ring'; floorName: string; floorNumber: FloorNumber; label: string;
}
export interface RecipientPickerProps {
  isOpen: boolean; onClose: () => void;
  mode: 'assign' | 'log';               // 'edit' is PR2 (additive)
  groupId: string; tierId: string;
  players: SnapshotPlayer[];            // ALL tier players (picker filters per scope)
  settings: StaticSettings;
  floors: string[];                     // tier floor names, for log-mode selectors
  item?: DropItemContext;               // fixed context (assign); initial (log)
  lootLog: LootLogEntry[]; currentWeek: number; maxWeek: number;
  onSuccess?: () => void;
}
```

- [ ] **Step 1: Write the failing ranking tests** (`frontend/src/utils/recipientRanking.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { buildRecipientEntries } from './recipientRanking';
import { DEFAULT_SETTINGS } from './constants';
import type { SnapshotPlayer } from '../types';

function makePlayer(id: string, name: string, opts: {
  sub?: boolean; hasEarring?: boolean; earringSource?: 'raid' | 'tome';
} = {}): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: 'PLD', role: 'tank',
    configured: true, sortOrder: 0, isSubstitute: opts.sub ?? false,
    gear: [{
      slot: 'earring', bisSource: opts.earringSource ?? 'raid',
      hasItem: opts.hasEarring ?? false, isAugmented: false,
    }],
    tomeWeapon: {}, weaponPriorities: [],
  } as unknown as SnapshotPlayer;
}
const settings = { ...DEFAULT_SETTINGS };
const base = { slot: 'earring' as const, settings, lootLog: [], currentWeek: 1, enhancedActive: false };

describe('buildRecipientEntries', () => {
  const needer = makePlayer('a', 'Alice');
  const haver = makePlayer('b', 'Bob', { hasEarring: true });
  const tomeBis = makePlayer('c', 'Cara', { earringSource: 'tome' });
  const sub = makePlayer('d', 'Dana', { sub: true });
  const players = [needer, haver, tomeBis, sub];

  it("scope 'priority' returns ranked main-roster needers only", () => {
    const out = buildRecipientEntries({ ...base, players, scope: 'priority' });
    expect(out.map((e) => e.player.id)).toEqual(['a']);
    expect(out[0]).toMatchObject({ rank: 1, needsItem: true, needTag: 'bis' });
    expect(out[0].reason).toContain('BiS');
  });

  it("scope 'all' includes everyone: needers ranked first, others alphabetical with tags", () => {
    const out = buildRecipientEntries({ ...base, players, scope: 'all' });
    expect(out[0].player.id).toBe('a');                       // needer first
    const ids = out.map((e) => e.player.id);
    expect(ids).toHaveLength(4);                              // subs included
    const bob = out.find((e) => e.player.id === 'b')!;
    expect(bob.needTag).toBe('free');                         // already has raid BiS
    const cara = out.find((e) => e.player.id === 'c')!;
    expect(cara.needTag).toBe('minor');                       // tome BiS in slot
  });

  it("scope 'offspec' returns everyone alphabetical, tagged free", () => {
    const out = buildRecipientEntries({ ...base, players, scope: 'offspec' });
    expect(out.map((e) => e.player.name)).toEqual(['Alice', 'Bob', 'Cara', 'Dana']);
    expect(out.every((e) => e.needTag === 'free' && e.rank === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to fail**, then **implement `frontend/src/utils/recipientRanking.ts`**:

```ts
/**
 * Recipient ranking for the unified RecipientPicker (F6d, spec §5.3).
 * FRESH-AUDITED consolidation of the ranking + visibility logic the two legacy
 * gear-drop modals forked (QuickLogDropModal.tsx:193-235 hardcoded-caps variant,
 * AddLootEntryModal.tsx:203-294 visibility matrix). v2 uses the CONFIGURABLE
 * enhanced scoring (utils/priorityEntries) everywhere — the modals' hardcoded
 * caps 50/45 drift ends here (spec §9 documents the possible v1↔v2 ranking
 * difference under custom caps; the legacy modals were the bug).
 */
import type { SnapshotPlayer, StaticSettings, GearSlot, LootLogEntry } from '../types';
import { GEAR_SLOT_NAMES } from '../types';
import { getPriorityForItem, getPriorityForRing } from './priority';
import { calculatePlayerLootStats, calculateAverageDrops } from './lootCoordination';
import { enhancePriorityEntries } from './priorityEntries';

export type PickerScope = 'priority' | 'all' | 'offspec';
export type NeedTag = 'bis' | 'minor' | 'free';

export interface RecipientEntry {
  player: SnapshotPlayer;
  rank: number | null;
  needsItem: boolean;
  reason: string;
  needTag: NeedTag;
}

function slotLabel(slot: GearSlot | 'ring'): string {
  return slot === 'ring' ? 'Ring' : (GEAR_SLOT_NAMES[slot] ?? slot);
}

function dropsPhrase(playerId: string, lootLog: LootLogEntry[], currentWeek: number): string {
  const drops = calculatePlayerLootStats(playerId, lootLog, currentWeek).totalDrops;
  return `${drops} drop${drops === 1 ? '' : 's'} this tier`;
}

/** Does this player hold the raid-BiS item for the slot (ring = either ring)? */
function slotState(player: SnapshotPlayer, slot: GearSlot | 'ring'): { raidBis: boolean; has: boolean } {
  const slots = slot === 'ring' ? (['ring1', 'ring2'] as const) : ([slot] as const);
  let raidBis = false;
  let hasAll = true;
  for (const s of slots) {
    const g = player.gear.find((x) => x.slot === s);
    if (g?.bisSource === 'raid') {
      raidBis = true;
      if (!g.hasItem) hasAll = false;
    }
  }
  return { raidBis, has: raidBis && hasAll };
}

export function buildRecipientEntries(args: {
  players: SnapshotPlayer[];
  slot: GearSlot | 'ring';
  scope: PickerScope;
  settings: StaticSettings;
  lootLog: LootLogEntry[];
  currentWeek: number;
  enhancedActive: boolean;
}): RecipientEntry[] {
  const { players, slot, scope, settings, lootLog, currentWeek, enhancedActive } = args;
  const configured = players.filter((p) => p.configured);
  const mainRoster = configured.filter((p) => !p.isSubstitute);
  const label = slotLabel(slot);

  if (scope === 'offspec') {
    return [...configured]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((player) => ({
        player, rank: null, needsItem: false, needTag: 'free' as const,
        reason: `Off-spec / free roll · ${dropsPhrase(player.id, lootLog, currentWeek)}`,
      }));
  }

  const pool = scope === 'priority' ? mainRoster : configured;
  const baseEntries = slot === 'ring'
    ? getPriorityForRing(pool, settings)
    : getPriorityForItem(pool, slot, settings);
  const averageDrops = lootLog.length > 0 ? calculateAverageDrops(pool.map((p) => p.id), lootLog) : 0;
  const ranked = enhancePriorityEntries(baseEntries, {
    settings, lootLog, currentWeek, averageDrops, active: enhancedActive && lootLog.length > 0,
  });

  const needers: RecipientEntry[] = ranked.map((entry, i) => ({
    player: entry.player, rank: i + 1, needsItem: true, needTag: 'bis' as const,
    reason: `${label} is BiS · ${dropsPhrase(entry.player.id, lootLog, currentWeek)}`,
  }));
  if (scope === 'priority') return needers;

  const neederIds = new Set(needers.map((e) => e.player.id));
  const rest: RecipientEntry[] = configured
    .filter((p) => !neederIds.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((player) => {
      const { has } = slotState(player, slot);
      return has
        ? { player, rank: null, needsItem: false, needTag: 'free' as const,
            reason: 'Already has this slot · would be free / sell' }
        : { player, rank: null, needsItem: false, needTag: 'minor' as const,
            reason: 'Not raid BiS in this slot' };
    });
  return [...needers, ...rest];
}
```
Run the ranking tests → pass.

- [ ] **Step 3: Write the failing picker tests** (`frontend/src/components/loot/RecipientPicker.test.tsx`). Mock the coordination util and assert **payload parity**:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecipientPicker } from './RecipientPicker';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { SnapshotPlayer } from '../../types';

vi.mock('../../utils/lootCoordination', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/lootCoordination')>();
  return { ...actual, logLootAndUpdateGear: vi.fn().mockResolvedValue(undefined) };
});
import { logLootAndUpdateGear } from '../../utils/lootCoordination';

function makePlayer(id: string, name: string, job: string, opts: { hasWeapon?: boolean; sub?: boolean } = {}): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job, role: 'caster',
    configured: true, sortOrder: 0, isSubstitute: opts.sub ?? false,
    gear: [
      { slot: 'weapon', bisSource: 'raid', hasItem: opts.hasWeapon ?? false, isAugmented: false },
      { slot: 'earring', bisSource: 'raid', hasItem: false, isAugmented: false },
    ],
    tomeWeapon: {}, weaponPriorities: [{ job, priority: 1, received: false }],
  } as unknown as SnapshotPlayer;
}

const caster = makePlayer('c1', 'Caster One', 'BLM');
const melee = makePlayer('m1', 'Melee One', 'SAM');
const players = [caster, melee];
const baseProps = {
  isOpen: true, onClose: vi.fn(), groupId: 'g1', tierId: 't1',
  players, settings: { ...DEFAULT_SETTINGS }, floors: ['M9S', 'M10S', 'M11S', 'M12S'],
  lootLog: [], currentWeek: 3, maxWeek: 3,
};

describe('RecipientPicker (assign mode)', () => {
  beforeEach(() => vi.mocked(logLootAndUpdateGear).mockClear());

  it('lists ranked eligible players with reasons and confirms the top pick', async () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'weapon', floorName: 'M12S', floorNumber: 4, label: 'Weapon' }} />
    );
    expect(screen.getByText(/Assign · Weapon/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Assign to/ }));
    await waitFor(() => expect(logLootAndUpdateGear).toHaveBeenCalledTimes(1));
    const [gid, tid, payload, options] = vi.mocked(logLootAndUpdateGear).mock.calls[0];
    expect(gid).toBe('g1'); expect(tid).toBe('t1');
    expect(payload).toMatchObject({
      weekNumber: 3, floor: 'M12S', itemSlot: 'weapon', method: 'drop', isExtra: false,
    });
    // weapon parity: weaponJob = recipient's main job; weapon-priority sync on
    expect(payload.weaponJob).toBe(payload.recipientPlayerId === 'c1' ? 'BLM' : 'SAM');
    expect(options).toMatchObject({ updateGear: true, updateWeaponPriority: true });
  });

  it('ring context submits itemSlot ring1 (legacy parity)', async () => {
    const ringPlayers = [makePlayer('r1', 'Ring Needer', 'BRD')];
    ringPlayers[0].gear = [
      { slot: 'ring1', bisSource: 'raid', hasItem: false, isAugmented: false },
      { slot: 'ring2', bisSource: 'raid', hasItem: false, isAugmented: false },
    ] as SnapshotPlayer['gear'];
    render(
      <RecipientPicker {...baseProps} players={ringPlayers} mode="assign"
        item={{ slot: 'ring', floorName: 'M9S', floorNumber: 1, label: 'Ring' }} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Assign to/ }));
    await waitFor(() => expect(logLootAndUpdateGear).toHaveBeenCalled());
    expect(vi.mocked(logLootAndUpdateGear).mock.calls[0][2].itemSlot).toBe('ring1');
    // non-weapon: no weapon-priority sync
    expect(vi.mocked(logLootAndUpdateGear).mock.calls[0][3]).toMatchObject({ updateWeaponPriority: false });
  });

  it('off-spec scope forces isExtra', async () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Off-spec / free' }));
    fireEvent.click(screen.getByRole('button', { name: /Assign to/ }));
    await waitFor(() => expect(logLootAndUpdateGear).toHaveBeenCalled());
    expect(vi.mocked(logLootAndUpdateGear).mock.calls[0][2].isExtra).toBe(true);
  });

  it('search filters the rows', () => {
    render(
      <RecipientPicker {...baseProps} mode="assign"
        item={{ slot: 'earring', floorName: 'M9S', floorNumber: 1, label: 'Earring' }} />
    );
    fireEvent.change(screen.getByPlaceholderText('Search players…'), { target: { value: 'Melee' } });
    expect(screen.queryByText('Caster One')).not.toBeInTheDocument();
    expect(screen.getByText('Melee One')).toBeInTheDocument();
  });
});

describe('RecipientPicker (log mode)', () => {
  beforeEach(() => vi.mocked(logLootAndUpdateGear).mockClear());

  it('offers fight + slot selectors and a book method option, and submits the choice', async () => {
    render(<RecipientPicker {...baseProps} mode="log" />);
    // defaults to the first fight's first slot; switch method to book
    fireEvent.click(screen.getByRole('radio', { name: /Book/i }));
    fireEvent.click(screen.getByRole('button', { name: /Assign to|Log drop/ }));
    await waitFor(() => expect(logLootAndUpdateGear).toHaveBeenCalled());
    expect(vi.mocked(logLootAndUpdateGear).mock.calls[0][2].method).toBe('book');
  });
});
```

- [ ] **Step 4: Run to fail**, then **implement `frontend/src/components/loot/RecipientPicker.tsx`**. Contract (spec §5.3, mockup `03-loot-priority-with-picker.html:566-624`):
  - **Modal** (ui `Modal`): title `Assign · {item.label}`, context line under it: `` `${item.floorName} Floor ${item.floorNumber} · ${item.label} slot · raid drop` `` (text-xs text-text-tertiary).
  - **Scope `SegmentedToggle`** (size sm): options `[{value:'priority',label:'By priority'},{value:'all',label:'All members'},{value:'offspec',label:'Off-spec / free'}]`, local state default `'priority'`.
  - **Search `Input`** placeholder `Search players…` (case-insensitive name filter over the built entries).
  - Uppercase list label: `Eligible · ranked by need + council rules` (priority scope) / `All members` / `Off-spec / free` — `text-[10px]`-free: use `text-xs font-bold uppercase tracking-wider text-text-tertiary`.
  - **Rows** from `buildRecipientEntries` (memo over players/slot/scope/settings/lootLog/currentWeek; `enhancedActive` = `settings.enableEnhancedScoring === true && !isPriorityDisabled(settings)`): rank number (accent when 1–2, per mockup `.top`), role-colored avatar (same pattern as `PriorityRow` initials — 30px here), name + role dot, reason line (`text-xs text-text-tertiary`), need `Tag`: `bis` → `<Tag variant="label" tone="success">BiS</Tag>`, `minor` → tone muted `minor`, `free` → tone muted `free` (**read `ui/Tag.tsx` TONE_CLASS first and use real tone values**), selection radio dot.
  - **Row interactivity:** read `components/roster/GearBoardCell.tsx` and `ui/RadioGroup.tsx` FIRST; implement rows with proper radio semantics (`role="radio"` + `aria-checked` + keyboard, the GearBoardCell interactive pattern) OR sr-only `<input type="radio">` inside a `<label>` (LogWeekWizard BooksStep precedent) — whichever passes `pnpm check:design-system:strict` without new suppressions. NO bare `<div onClick>`.
  - **Selection default:** first entry on open (mirror the open-transition-only init from `QuickLogDropModal.tsx:97-115` — a `wasOpenRef`, so store churn can't reset the pick). Auto-select the primary character registration on recipient change (copy `QuickLogDropModal.tsx:117-121`; subscribe `useStaticCharacterStore((s) => s.registrationsByGroup)` slice like `:75-79`).
  - **Details disclosure** (a collapsed `LinkText` "Details" toggling a section): Week `NumberInput` (min 1, max `maxWeek`, default `currentWeek`); `RadioGroup` method Drop|Book (**log mode only**; assign is always `'drop'`); `Checkbox` "Mark {label} as acquired" default true; `Checkbox` "Extra loot (not BiS priority)" shown for weapons (assign) — **forced true + disabled when scope is `offspec`**; character `Select` when the recipient has registrations (mirror `QuickLogDropModal` options); `TextArea` notes (log mode only).
  - **Log mode item selectors** (when `mode === 'log'`): fight `Select` over `floors` (value = floor name, label = floor name) + slot `Select` over `FLOOR_LOOT_TABLES[floorNumber].gearDrops` with `ring1` shown as `Ring` (value `'ring'`); `floorNumber` = index+1 of the selected floor name; slot resets to the floor's first drop when the fight changes (AddLootEntryModal parity).
  - **Footer:** note `Logging marks the drop & updates priority + BiS instantly.` (text-xs text-text-tertiary) + `Button` secondary Cancel + `Button` primary `Assign to {selected.name}` (disabled without a selection, `loading` while saving).
  - **Submit** (exact `QuickLogDropModal.tsx:123-174` parity):
    ```ts
    const isWeapon = slot === 'weapon';
    const recipient = players.find((p) => p.id === selectedId);
    const weaponJob = isWeapon ? recipient?.job : undefined;
    const itemSlot = slot === 'ring' ? 'ring1' : slot;
    await logLootAndUpdateGear(groupId, tierId, {
      weekNumber, floor: floorName, itemSlot, recipientPlayerId: selectedId,
      method, weaponJob, isExtra: scope === 'offspec' ? true : isExtra,
      notes: mode === 'log' ? (notes || undefined)
        : (isWeapon && weaponJob ? `${weaponJob} weapon${isExtra ? ' (extra)' : ''}` : undefined),
      recipientCharacterRegistrationId: characterRegId ?? undefined,
      recipientCharacterName: characterName,
    }, { updateGear, updateWeaponPriority: isWeapon, weaponJob });
    toast.success(...); onSuccess?.(); onClose();
    ```
    with the same try/catch → `toast.error('Failed to log drop')` and `isSaving` guard.
  - File-header doc comment: purpose + "consolidates QuickLogDropModal + AddLootEntryModal (spec §2.2); edit mode is PR2".

- [ ] **Step 5: Run to pass** — `pnpm -C frontend test -- --run RecipientPicker recipientRanking` → all pass. `pnpm -C frontend build` + `pnpm -C frontend check:design-system` clean.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(loot): unified RecipientPicker + recipient ranking (consolidates the two gear-drop modals)"`

---

### Task 5: `deriveFloorWeekStatus` + `FloorCard` / `FloorDropRow`

**Files:**
- Create: `frontend/src/utils/lootFairness.ts` (this task: `deriveFloorWeekStatus` only — `computeTierFairness` is PR2)
- Create: `frontend/src/utils/lootFairness.test.ts`
- Create: `frontend/src/components/loot/FloorDropRow.tsx`
- Create: `frontend/src/components/loot/FloorCard.tsx`
- Create: `frontend/src/components/loot/FloorCard.test.tsx`

**Interfaces (consumes):** `PriorityRow` (Task 3), `enhancePriorityEntries` (Task 1), `getPriorityForItem/Ring/UpgradeMaterial/UniversalTomestone`, `FLOOR_LOOT_TABLES`/`UPGRADE_MATERIAL_DISPLAY_NAMES`/`isSlotAugmentationMaterial` (gamedata), `Tag`/`LinkText` (ui).

**Interfaces (produces):**
```ts
// utils/lootFairness.ts
export interface FloorWeekStatus { loggedCount: number; pendingCount: number; cleared: boolean }
export function deriveFloorWeekStatus(args: {
  floorNumber: FloorNumber; floorName: string; week: number;
  players: SnapshotPlayer[];            // main roster
  settings: StaticSettings;
  lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; pageLedger: PageLedgerEntry[];
}): FloorWeekStatus;

// components/loot/FloorCard.tsx
export interface FloorCardProps {
  floorNumber: FloorNumber; floorName: string;
  players: SnapshotPlayer[]; settings: StaticSettings;
  lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; pageLedger: PageLedgerEntry[];
  scopedWeek: number; canEdit: boolean;
  onAssignGear: (item: { slot: GearSlot | 'ring'; label: string }) => void;
  onAssignMaterial: (material: MaterialType, suggested: SnapshotPlayer) => void;
  footer?: React.ReactNode;             // Task 9 slots the WeaponPriorityBridge in on F4
}
```

- [ ] **Step 1: Write the failing derivation tests** (`lootFairness.test.ts`) — fixtures like Task 4's `makePlayer`; cases:
  1. floor 1, one earring-needer, no entries → `pendingCount ≥ 1`, `loggedCount 0`, `cleared false`.
  2. same + one loot entry `{ weekNumber: 3, floor: 'M9S', itemSlot: 'earring' }` with `week: 3` → that item no longer pending, `loggedCount 1`.
  3. pageLedger entry `{ weekNumber: 3, transactionType: 'earned', bookType: 'I' }` → `cleared true` for floor 1 week 3 (and still `false` for week 2).
  4. ring pending counts ONCE (ring1+ring2 needers, no entry → the consolidated Ring item is 1 pending, and a logged `itemSlot: 'ring1'` OR `'ring'` entry clears it).
  5. no needers at all → `pendingCount 0`.

- [ ] **Step 2: Implement `deriveFloorWeekStatus`:**

```ts
import type { SnapshotPlayer, StaticSettings, GearSlot, LootLogEntry, MaterialLogEntry, PageLedgerEntry, MaterialType } from '../types';
import type { FloorNumber } from '../gamedata/loot-tables';
import { FLOOR_LOOT_TABLES, isSlotAugmentationMaterial } from '../gamedata/loot-tables';
import {
  getPriorityForItem, getPriorityForRing,
  getPriorityForUpgradeMaterial, getPriorityForUniversalTomestone,
} from './priority';

export interface FloorWeekStatus { loggedCount: number; pendingCount: number; cleared: boolean }

const RING_SLOTS = new Set(['ring', 'ring1', 'ring2']);

export function deriveFloorWeekStatus(args: {
  floorNumber: FloorNumber; floorName: string; week: number;
  players: SnapshotPlayer[]; settings: StaticSettings;
  lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; pageLedger: PageLedgerEntry[];
}): FloorWeekStatus {
  const { floorNumber, floorName, week, players, settings, lootLog, materialLog, pageLedger } = args;
  const table = FLOOR_LOOT_TABLES[floorNumber];
  const weekLoot = lootLog.filter((e) => e.weekNumber === week && e.floor === floorName);
  const weekMats = materialLog.filter((e) => e.weekNumber === week && e.floor === floorName);
  const loggedCount = weekLoot.length + weekMats.length;

  let pendingCount = 0;
  for (const slot of table.gearDrops) {
    const isRing = slot === 'ring1';
    const needers = isRing ? getPriorityForRing(players, settings) : getPriorityForItem(players, slot, settings);
    if (needers.length === 0) continue;
    const logged = weekLoot.some((e) => (isRing ? RING_SLOTS.has(e.itemSlot) : e.itemSlot === slot));
    if (!logged) pendingCount += 1;
  }
  for (const material of table.upgradeMaterials) {
    const needers = isSlotAugmentationMaterial(material)
      ? getPriorityForUpgradeMaterial(players, material, settings, materialLog)
      : getPriorityForUniversalTomestone(players, settings, materialLog);
    if (needers.length === 0) continue;
    const logged = weekMats.some((e) => e.materialType === material);
    if (!logged) pendingCount += 1;
  }

  const cleared = pageLedger.some(
    (e) => e.weekNumber === week && e.transactionType === 'earned' && e.bookType === table.bookType,
  );
  return { loggedCount, pendingCount, cleared };
}
```
Run tests → pass.

- [ ] **Step 3: Implement `FloorDropRow`** — one drop row (mockup `.drop`):

```tsx
/**
 * FloorDropRow — one droppable item inside a FloorCard (F6d, spec §5.2).
 * Mockup 03-loot-priority.html `.drop`: item icon + name/slot line +
 * PriorityRow queue + an "Assign" button (canEdit; NO trailing arrow, DS §4.1).
 */
import { Button } from '../primitives';
import { PriorityRow, type PriorityRowEntry } from '../ui';
import type { MaterialType, GearSlot } from '../../types';

export interface FloorDropRowProps {
  kind: 'gear' | 'material';
  label: string;                       // "Weapon" / "Ring" / "Twine"
  subLabel: string;                    // "Weapon · raid" / "Upgrade material"
  slot?: GearSlot | 'ring';
  material?: MaterialType;
  entries: PriorityRowEntry[];
  canEdit: boolean;
  onAssign: () => void;
}

const MATERIAL_TOKEN: Record<string, string> = {
  twine: 'var(--color-material-twine)',
  glaze: 'var(--color-material-glaze)',
  solvent: 'var(--color-material-solvent)',
  universal_tomestone: 'var(--color-material-tomestone)',
};

export function FloorDropRow({ kind, label, subLabel, material, entries, canEdit, onAssign }: FloorDropRowProps) {
  const tone = kind === 'gear' ? 'var(--color-gear-raid)' : MATERIAL_TOKEN[material ?? ''] ?? 'var(--color-accent)';
  return (
    <div className="flex items-center gap-3.5 border-b border-border-subtle px-4 py-3 last:border-b-0">
      <div className="flex w-[230px] flex-none items-center gap-2.5">
        <span
          aria-hidden
          className="grid h-[34px] w-[34px] flex-none place-items-center rounded-lg font-display text-xs font-extrabold"
          style={{
            backgroundColor: `color-mix(in srgb, ${tone} 22%, transparent)`,
            color: tone,
          }}
        >
          {label.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-text-primary">{label}</div>
          <div className="truncate text-xs text-text-tertiary">{subLabel}</div>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <PriorityRow entries={entries} />
      </div>
      {canEdit && (
        <div className="flex-none">
          <Button variant="secondary" size="sm" onClick={onAssign}>Assign</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write failing `FloorCard` tests** — render with fixture players/logs; assert: header shows floor name `Tag` + `Floor N` + drops meta; a needer produces a `PriorityRow` chip; pending chip text `N pending`; fully-logged floor (entries for every needed item this week) renders collapsed (drop rows absent) with a `Show` LinkText that expands on click; `canEdit={false}` hides Assign buttons; material row's Assign calls `onAssignMaterial` with the top-priority player.

- [ ] **Step 5: Implement `FloorCard`** — card (`rounded-lg border border-border-default bg-surface-card overflow-hidden`); header row (`flex items-center gap-3 border-b border-border-default bg-surface-raised px-4 py-3`): `<Tag variant="label" tone="muted">{floorName}</Tag>` + `<span className="font-display text-sm font-bold">Floor {floorNumber}</span>` + meta `<span className="text-xs text-text-tertiary">· {status.cleared ? 'cleared' : 'in progress'} · drops: {dropLabels.join(', ')}</span>` + right chip: `status.pendingCount > 0 ? <Tag variant="label" tone="muted">{pendingCount} items pending</Tag> : <Tag variant="label" tone="success">{loggedCount} logged</Tag>` (**use real Tag tone values from `ui/Tag.tsx`**). Body: gear rows (ring1 → `{slot:'ring', label:'Ring'}`, others `GEAR_SLOT_NAMES[slot]`, subLabel `${label} · raid`) then material rows (`UPGRADE_MATERIAL_DISPLAY_NAMES[material]`, subLabel `Upgrade material`); queues via the SAME derivation as legacy `LootPriorityPanel.tsx:479-500` (`getPriorityForItem/Ring/UpgradeMaterial/UniversalTomestone` → `enhancePriorityEntries` with `active` = the legacy gate expression) mapped to `PriorityRowEntry` (`{playerId: e.player.id, name: e.player.name, role: e.player.role, rank: i+1}`). Collapse: `const [expanded, setExpanded] = useState(false)`; collapsed when `!expanded && pendingCount === 0 && loggedCount > 0` → body hidden, header gains `<LinkText onClick={() => setExpanded(true)}>Show</LinkText>`. `footer` renders below the rows when provided.

- [ ] **Step 6: Run to pass**, DS check, then commit — `git add -A && git commit -m "feat(loot): FloorCard/FloorDropRow with ranked queues + floor week status derivation"`

---

### Task 6: `WeekScopeControl`

The week pill (spec §2.3/§5.4): a scope dropdown fed by the shared clock, hosting the clock mutations.

**Files:**
- Create: `frontend/src/components/loot/WeekScopeControl.tsx`
- Create: `frontend/src/components/loot/WeekScopeControl.test.tsx`

**Interfaces (consumes):** `WeekClock` (Task 2), `Dropdown/DropdownTrigger/DropdownContent/DropdownItem` from `'../primitives/Dropdown'` + `Button` `trailing="chevron"` (exact pattern: `components/roster/RosterToolbar.tsx:74-84`), `ConfirmModal` from `'../ui'`, `toast`.

**Interfaces (produces):**
```ts
export interface WeekScopeControlProps {
  clock: WeekClock;
  scopedWeek: number;
  onScopedWeekChange: (week: number) => void;
  canEdit: boolean;
}
```

- [ ] **Step 1: Write the failing tests** — (open the dropdown with `fireEvent.keyDown(trigger, { key: 'Enter' })` — Radix): trigger label is `This week (Week 3)` when `scopedWeek === clock.currentWeek`, else `Week N`; dropdown lists `Week 1..maxWeek` (descending) with date ranges when `rangeOfWeek` returns them; selecting a week calls `onScopedWeekChange`; `canEdit` shows "Start next week" + "Revert week" items (absent otherwise); clicking "Revert week" opens a ConfirmModal and only calls `clock.revertWeek` on confirm. Build a fake clock object literal (no store needed):
```ts
const clock = {
  currentWeek: 3, maxWeek: 4, weekStartDate: '2026-06-10T00:00:00Z',
  weeksWithData: new Set([1, 3]), weekDataTypes: new Map(),
  rangeOfWeek: (w: number) => ({ start: new Date('2026-06-10'), end: new Date('2026-06-16') }),
  isCurrent: (w: number) => w === 3,
  startNextWeek: vi.fn().mockResolvedValue(4), revertWeek: vi.fn().mockResolvedValue(2),
};
```

- [ ] **Step 2: Implement.** Structure:
  - Trigger: `<Dropdown><DropdownTrigger asChild><Button variant="secondary" size="sm" trailing="chevron">{label}</Button></DropdownTrigger>…`.
  - `DropdownContent align="start"`: weeks `maxWeek → 1`, each `DropdownItem onSelect={() => onScopedWeekChange(n)}` rendering `Week {n}` + (range ? ` · ${fmt(range.start)} – ${fmt(range.end)}` : '') + data dots: tiny spans per `weekDataTypes.get(n)` — loot → `bg-accent`, books → `bg-membership-lead`, mats → `bg-status-warning` (`h-1.5 w-1.5 rounded-full`; wrap in a `aria-hidden` flex — the types are also in the item's `title`). `fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })`.
  - `canEdit`: a separator (check what the Dropdown primitive exports — `DropdownSeparator` if present, else a styled div) then `DropdownItem` "Start next week" and "Revert week".
  - Mutations: "Start next week" → `ConfirmModal` (`variant` info/default): title "Start next week", message `Advance the week clock to Week ${clock.currentWeek + 1}? Logged data is never modified.` → on confirm `await clock.startNextWeek()` + `toast.success('Week advanced')`. "Revert week" → `ConfirmModal` warning: `Move the clock back to Week ${clock.currentWeek - 1}? Entries logged for Week ${clock.currentWeek} will appear as future-week entries.` → `await clock.revertWeek()`. **Read `ui/ConfirmModal.tsx` for the exact prop names before writing.** After either, `onScopedWeekChange(newWeek)`.
  - Doc comment: week pill = local scope control fed by the shared clock + the clock's mutation host (spec §2.3; resolves the F5 §C tension).

- [ ] **Step 3: Run to pass**, DS check, commit — `git commit -m "feat(loot): WeekScopeControl week pill (scope + clock mutations)"`

---

### Task 7: `LootAdjustmentsModal` (the re-homed "Adjust Priority")

**Files:**
- Create: `frontend/src/components/loot/LootAdjustmentsModal.tsx`
- Create: `frontend/src/components/loot/LootAdjustmentsModal.test.tsx`

**Interfaces (produces):**
```ts
export interface AdjustmentUpdate { playerId: string; lootAdjustment: number; priorityModifier: number }
export interface LootAdjustmentsModalProps {
  isOpen: boolean; onClose: () => void;
  players: SnapshotPlayer[];           // main roster
  onSave: (updates: AdjustmentUpdate[]) => Promise<void>;  // Task 9 wires tierStore.updatePlayer
}
```

- [ ] **Step 1: Failing tests** — renders a row per player (JobIcon + name + two NumberInputs); editing one player's loot adjustment and saving calls `onSave` with ONLY the changed player (`[{ playerId, lootAdjustment: 10, priorityModifier: 0 }]`); "Reset all" zeroes both fields for every row (save then includes every player whose stored value was non-zero); no-change save calls `onSave([])` and closes.

- [ ] **Step 2: Implement.** `Modal` title "Player adjustments" (Gauge icon); intro line (text-xs text-text-secondary): "Loot adjustment weights fair-share history (mid-tier joins); priority modifier is a flat score offset." Rows: `flex items-center gap-3` — `JobIcon job size="sm"` + name (flex-1 truncate) + `<Label>`-ed `NumberInput`s: Loot adj (min −100, max 100, step 5 — mirror `PRIORITY_MODIFIER_*` from `utils/constants`, which are −100/100/5) and Priority mod (same range via the constants). Local draft state `Record<playerId, {lootAdjustment, priorityModifier}>` seeded from `player.lootAdjustment ?? 0` / `player.priorityModifier ?? 0` on open (open-transition effect). Footer: "Reset all" ghost + Cancel + Save primary (`loading`); `handleSave` diffs draft vs seed and calls `onSave(changedOnly)`, then `onClose()`; try/catch → keep open + `toast.error('Failed to save adjustments')`.
  Doc comment: re-homes the legacy roster-kebab "Adjust Priority" (`PriorityAdjustModal`, `priorityModifier`) + the settings `PlayerAdjustmentsModal` (`lootAdjustment`) into one Loot-owned surface (spec §2.6); legacy modals untouched, retired at flip.

- [ ] **Step 3: Run to pass**, DS check, commit — `git commit -m "feat(loot): LootAdjustmentsModal (re-homed Adjust Priority + loot adjustments)"`

---

### Task 8: `WeaponPriorityBridge`

**Files:**
- Create: `frontend/src/components/loot/WeaponPriorityBridge.tsx`
- Create: `frontend/src/components/loot/WeaponPriorityBridge.test.tsx`

**Interfaces (consumes):** legacy `WeaponPriorityList` (`components/loot/WeaponPriorityList.tsx:865-873` props: `{ players, settings, showLogButtons?, onLogClick?(weaponJob, player), groupId? }`) and `QuickLogWeaponModal` — copy its mount **verbatim** from `LootPriorityPanel.tsx:793-807` (adjusting only state/prop names).

**Interfaces (produces):**
```ts
export interface WeaponPriorityBridgeProps {
  players: SnapshotPlayer[];           // main roster
  settings: StaticSettings;
  groupId: string; tierId: string;
  floors: string[]; maxWeek: number;
  canEdit: boolean;
  onLogSuccess?: () => void;
}
```

- [ ] **Step 1: Failing tests** — collapsed by default (LinkText "Weapon priorities" visible, no `WeaponPriorityList` content); click expands (mock `./WeaponPriorityList` with a stub to keep the test light: `vi.mock('./WeaponPriorityList', () => ({ WeaponPriorityList: () => <div data-testid="wpl" /> }))`); `canEdit` forwards as `showLogButtons`.

- [ ] **Step 2: Implement** — `useState(false)` expanded; header row: `<LinkText onClick={toggle} icon={<ChevronRight … rotate when open />}>Weapon priorities</LinkText>` + tertiary hint "per-job funneling, ties & rolls"; when expanded render `<WeaponPriorityList players={players} settings={settings} showLogButtons={canEdit} onLogClick={(weaponJob, player) => setWeaponModal({ weaponJob, player })} groupId={groupId} />` + the `QuickLogWeaponModal` mount copied from `LootPriorityPanel.tsx:793-807` (floor = `floors[3]`, `allPlayers={players}`, `onSuccess={onLogSuccess}`).
  Doc comment: **bridge** (CharacterManageBridge precedent) — the legacy job-grouped weapon view survives verbatim inside the F4 card; final form → holistic review (spec §2.8).

- [ ] **Step 3: Run to pass**, commit — `git commit -m "feat(loot): WeaponPriorityBridge (legacy weapon priorities embedded on the F4 card)"`

---

### Task 9: `Loot` assembly + `LootToolbar` [opus]

**Files:**
- Create: `frontend/src/components/loot/LootToolbar.tsx`
- Create: `frontend/src/components/loot/Loot.tsx`
- Create: `frontend/src/components/loot/Loot.test.tsx`

**Interfaces (consumes):** everything above; `PageHeader` (`components/layout/PageHeader.tsx` — usage pattern `Roster.tsx:248-259`); `LogWeekWizard` mount — copy props **verbatim** from `GroupViewContent.tsx:1372-1398`; `QuickLogMaterialModal` (props at `QuickLogMaterialModal.tsx:27-39`); `useSettingsPanelStore.getState().open({ tab: 'priority' })` (valid tab per `SettingsPanel.tsx:35`); `getEffectivePriorityMode`/`isPriorityDisabled`; tier info derivation — **mirror GroupViewContent's** (grep `tierInfo` in `GroupViewContent.tsx`; it resolves the gamedata tier via the current tier) so `floors`/`dutyNames` match legacy; `useTierStore` `fetchTier`, `updatePlayer`.

**Interfaces (produces — the slot contract, mirrors Roster/Home):**
```ts
export interface LootProps {
  group: StaticGroup;
  tier: TierSnapshot | null;
  canEdit: boolean;                    // owner | lead | adminAccess
  onNavigate: (tab: PageMode, extra?: Record<string, string>) => void;  // slot contract; reserved
}
```

- [ ] **Step 1: Failing assembly tests** (`Loot.test.tsx`) — mock heavy children (`vi.mock` FloorCard → capture props, RecipientPicker, LogWeekWizard, QuickLogMaterialModal, WeaponPriorityBridge, WeekScopeControl); seed `useLootTrackingStore.setState` with logs + week state; assert:
  1. `data-testid="loot-screen"` renders; PageHeader title "Loot"; subtitle contains `fairness rules:` and the mode label (role-based default → `role priority + need`).
  2. FOUR FloorCards rendered in order F4→F1 (assert the mocked FloorCard received `floorNumber` 4,3,2,1) with `scopedWeek` = clock currentWeek by default.
  3. Toolbar: "Log a drop" + "Log this week's loot" + "Adjustments" + "Rules" present when `canEdit`, absent when not (WeekScopeControl always present).
  4. Clicking "Log a drop" opens the picker in log mode (mocked picker receives `mode="log"`, `isOpen=true`).
  5. FloorCard `onAssignGear` invocation (call the captured prop) opens the picker in assign mode with the item context.
  6. F4's FloorCard receives a `footer` (the bridge).

- [ ] **Step 2: Implement `LootToolbar`** (flat flex row, RosterToolbar pattern):
```ts
export interface LootToolbarProps {
  weekControl: React.ReactNode;        // <WeekScopeControl/> slotted by Loot
  canEdit: boolean;
  onLogDrop: () => void;
  onLogWeek: () => void;
  onOpenAdjustments: () => void;
  onOpenRules: () => void;
}
```
Render: `<div className="flex flex-wrap items-center gap-2.5">{weekControl}<div className="flex-1" />` + when `canEdit`: `Button` ghost sm "Adjustments" (Gauge icon) · `Button` ghost sm "Rules" (SlidersHorizontal icon) · `Button` variant="secondary" sm "Log a drop" (Scan icon) · `Button` primary sm "Log this week's loot" (CheckSquare icon)`</div>`. (No SegmentedToggle in PR1 — Priority is the only view; the toggle arrives with History in PR2.)

- [ ] **Step 3: Implement `Loot.tsx`.** Skeleton:
  - Derive: `settings = { ...DEFAULT_SETTINGS, ...group.settings }`; `players = tier?.players ?? EMPTY_PLAYERS`; `mainRosterPlayers = players.filter(p => p.configured && !p.isSubstitute)`; `tierInfo` per the GroupViewContent derivation; `floors = tierInfo?.floors ?? []`.
  - Stores: `lootLog/materialLog/pageLedger` + `fetchLootLog/fetchMaterialLog/fetchPageLedger/fetchCurrentWeek/fetchWeekDataTypes` from `useLootTrackingStore` (slice selectors); `fetchTier`, `updatePlayer` from `useTierStore`.
  - Mount fetch effect on `[group.id, tier?.tierId]`: fire all five fetchers (guarded on both ids). GroupViewContent's own effect covers loot/material under `pageMode==='gear'`, but v2 must not depend on legacy chrome ordering — idempotent double-fetch is fine.
  - `clock = useWeekClock(group.id, tier?.tierId)`; `const [scopedWeekOverride, setScopedWeekOverride] = useState<number | null>(null); const scopedWeek = scopedWeekOverride ?? clock.currentWeek;`
  - Modal state: `pickerState: { mode: 'assign' | 'log'; item?: DropItemContext } | null`; `wizardOpen`; `materialState: { material: MaterialType; floorName: string; suggested: SnapshotPlayer } | null`; `adjustmentsOpen`.
  - Subtitle: `` `Who's up next, and the record of what's dropped · fairness rules: ${MODE_LABELS[getEffectivePriorityMode(settings)]}` `` with `MODE_LABELS = { 'role-based': 'role priority + need', 'automatic': 'role priority + need', 'manual': 'role priority + need', 'job-based': 'job priority + need', 'player-based': 'player priority + need', 'manual-planning': 'manual planning', 'disabled': 'equal priority' }`.
  - Render: `<div data-testid="loot-screen">` → `PageHeader` (Shield icon — same icon module the Spine's Loot tab uses) → `LootToolbar` (weekControl = `<WeekScopeControl clock={clock} scopedWeek={scopedWeek} onScopedWeekChange={setScopedWeekOverride} canEdit={canEdit} />`; onLogDrop → `setPickerState({ mode: 'log' })`; onLogWeek → `setWizardOpen(true)`; onOpenAdjustments → `setAdjustmentsOpen(true)`; onOpenRules → `useSettingsPanelStore.getState().open({ tab: 'priority' })`) → `[4,3,2,1].map` FloorCards (`players={mainRosterPlayers}`, logs, `scopedWeek`, `canEdit`, `onAssignGear={(item) => setPickerState({ mode: 'assign', item: { ...item, floorName: floors[n-1], floorNumber: n } })}`, `onAssignMaterial={(material, suggested) => setMaterialState({ material, floorName: floors[n-1], suggested })}`, `footer={n === 4 ? <WeaponPriorityBridge players={mainRosterPlayers} settings={settings} groupId={group.id} tierId={tier!.tierId} floors={floors} maxWeek={clock.maxWeek} canEdit={canEdit} onLogSuccess={refresh} /> : undefined}`) in `className="grid gap-3.5"`.
  - Modals: `RecipientPicker` (`isOpen={!!pickerState}`, mode/item from state, `players={players}` (ALL — picker scopes internally), `lootLog`, `currentWeek={scopedWeek}` (the picker's default week = the scoped week), `maxWeek={clock.maxWeek}`, `onSuccess={refresh}`); `LogWeekWizard` (verbatim GroupViewContent props with `currentWeek={scopedWeek}`, `onSuccess={(w) => { refresh(); setScopedWeekOverride(w); }}`); `QuickLogMaterialModal` (from `materialState`; `floor={materialState.floorName}` — note glaze/tome drop F2 and twine/solvent F3, the floorName passed comes from the row's own card so it is already right; `suggestedPlayer={materialState.suggested}`, `allPlayers={mainRosterPlayers}`, `maxWeek={clock.maxWeek}`, `onSuccess={refresh}`); `LootAdjustmentsModal` (`players={mainRosterPlayers}`, `onSave` = allSettled over `updatePlayer(group.id, tier!.tierId, u.playerId, { lootAdjustment: u.lootAdjustment, priorityModifier: u.priorityModifier })` with per-failure `toast.error(...)` — mirror `PlayerAdjustmentsModal`'s save semantics).
  - `refresh = () => { if (group.id && tier?.tierId) { void fetchTier(group.id, tier.tierId); } }` (store log refetches happen inside the store actions).
  - Guard: `if (!tier) return <div data-testid="loot-screen" />` (empty-tier shell parity — GroupViewContent gates the region on currentTier anyway).

- [ ] **Step 4: Run to pass** — assembly tests + full `pnpm -C frontend test -- --run` + `pnpm -C frontend build` + DS strict clean.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(loot): v2 Loot assembly + toolbar (Priority view)"`

---

### Task 10: Enabling refactor (`!slots?.gear`) + slot wiring [opus]

The highest-risk task: it touches shared `GroupViewContent` on the legacy path. Every gate is a no-op when `slots` is undefined — the regression tests lock this.

**Files:**
- Modify: `frontend/src/pages/NewShell.tsx` (`ShellContent`, `:42-85`)
- Modify: `frontend/src/pages/GroupViewContent.tsx` (`:676-677` preventPageScroll; `:1263` mobile gear view selector; `:1318` mobile gear reset controls)
- Test: extend the existing slot/guard test files (locate with `grep -rl "slots?.roster\|slots={{" frontend/src/pages frontend/src/components --include="*.test.tsx"` — F6b/F6c added slot tests for `overview`/`roster`; mirror their structure for `gear`)

- [ ] **Step 1: Write the failing tests** (in the same file(s) the F6c roster-slot tests live):
  1. **Slot renders:** `GroupViewContent` with `slots={{ gear: <div data-testid="gear-slot" /> }}` and pageMode `gear` → `gear-slot` present; legacy sub-tab labels "Log"/"Priority"/"Sync"/"Summary" ABSENT.
  2. **Legacy byte-for-byte lock:** without `slots` → the four sub-tab buttons present (the legacy gear body renders).
  3. **Mobile chrome gated:** with `slots.gear` + the controls sheet open → "Who Needs It"/"Gear Priority"/"Weapon Priority" buttons and "Reset Loot Log" absent; without slots → present (match however the F6c test drives `showControlsSheet` — mirror it).
  4. **ShellContent wiring:** the existing ShellContent slot test (F6b/F6c) extended: with a current group, `GroupViewContent` receives a `gear` slot (mock `../components/loot/Loot` and assert it mounts on tab gear).

- [ ] **Step 2: `NewShell.tsx` wiring** — add to `ShellContent` after the roster block:
```tsx
  // F6d: in v2 the `gear` tab (Spine label "Loot") is the redesigned <Loot/>
  // screen, injected as the `gear` slot — mirroring `overview`/`roster` above.
  // The legacy route passes no slots, so GroupViewContent renders its legacy
  // gear body byte-for-byte (mobile gear chrome gated on `!slots?.gear`).
  const loot = currentGroup ? (
    <Loot
      group={currentGroup}
      tier={currentTier}
      canEdit={canManage}
      onNavigate={gv.setPageMode}
    />
  ) : undefined;
```
with `import { Loot } from '../components/loot/Loot';` and `slots={currentGroup ? { overview, roster, gear: loot } : undefined}`.

- [ ] **Step 3: `GroupViewContent.tsx` gates** (exact edits):
  1. `:676-677`:
  ```ts
  const preventPageScroll = !slots?.gear && ((pageMode === 'gear' && gearSubTab === 'history') ||
    (isSmallScreen && pageMode === 'gear' && gearSubTab === 'priority'));
  ```
  2. `:1263` — `{pageMode === 'gear' && (` → `{pageMode === 'gear' && !slots?.gear && (`
  3. `:1318` — `{pageMode === 'gear' && gearSubTab === 'history' && canManageRoster(userRole, isAdminAccess).allowed && (` → prepend `!slots?.gear && ` after the pageMode check (same shape as the roster gates at `:694`/`:1206`).
  Each gate gets the one-line comment pattern used at `:691-693` ("Gated on `!slots?.gear` … no-op on legacy").

- [ ] **Step 4: Verify no other gear-only chrome leaks** — `grep -n "pageMode === 'gear'" frontend/src/pages/GroupViewContent.tsx` and confirm every hit is either (a) inside the slot fallback (`:947` block), (b) now gated, or (c) neutral (e.g. the sheet *title* string at `:1184` — leave it; the sheet still opens in v2 for the tier selector). Also `grep -n "showLogWeekWizard\|setShowLogWeekWizard" frontend/src/pages/GroupViewContent.tsx frontend/src/hooks/useGroupViewKeyboardShortcuts.ts` — confirm no keyboard shortcut opens the always-mounted legacy wizard without legacy UI (if one does, gate that handler on `!slots?.gear` and note it in the PR body).

- [ ] **Step 5: Run to pass** — new tests + FULL suite (`pnpm -C frontend test -- --run`) + `pnpm -C frontend build`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(shell): wire v2 Loot as the gear slot; gate legacy gear chrome on !slots.gear"`

> **After this task: BROWSER VALIDATION (first mount)** — orchestrator runs it per the ledger config (backend :8001 from `backend/`, frontend :5174, dev-auth `/api/dev-auth/login/0`, `/group/DEVTST?shell=v2&tab=gear`): floor cards F4→F1 with real queues; Assign → picker → confirm → entry logged + gear flips (check Board `rview=board`) + queue re-ranks; week pill label + ranges; "Log this week's loot" wizard opens; legacy `/group/DEVTST` gear tab byte-for-byte (4 sub-tabs, mobile sheet controls); 0 console errors.

---

### Task 11: Release note + full gate

**Files:**
- Modify: `frontend/src/data/releaseNotes.ts`
- Add: `design/redesign/plans/2026-07-01-f6d-priority.md` (this file rides the branch, f6c precedent)

- [ ] **Step 1: Release note** — copy the shape of the most recent `{ internal: true }` entry (the f6c-board one) and add at the top of the list:
```ts
{
  version: '2.0.2',
  date: '<today ISO, e.g. 2026-07-01T00:00:00Z>',
  internal: true,
  categories: /* match the existing internal-entry structure exactly */
  // item: { category: 'feature', title: 'F6d (part 1) — v2 Loot Priority view behind ?shell=v2',
  //   description: 'Flag-gated redesign slice: floor cards + ranked queues + unified RecipientPicker + week clock. No user-facing change.',
  //   pr: 0, prTitle: 'F6d (part 1) — Loot Priority' }
}
```
(**Read the file first and match the real internal-entry shape** — do NOT bump `CURRENT_VERSION`.) Run `cd scripts && npm test` → changelog suite green.

- [ ] **Step 2: Full gate** —
```
pnpm -C frontend build
pnpm -C frontend lint            # 0 errors
pnpm -C frontend check:design-system:strict
pnpm -C frontend test -- --run
pnpm -C frontend tokens:check
git diff --check
cd backend && venv/Scripts/python.exe -m pytest tests/test_week_management.py tests/test_loot_tracking.py -q
```
All green. Also verify `git diff redesign/foundation... -- frontend/eslint-suppressions.json` is EMPTY.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "chore(release-notes): internal entry for f6d-priority"`

> **Then (orchestrator):** final browser pass → final whole-branch review (`redesign-reviewer`, BASE = foundation head) → push + PR into `redesign/foundation` (backfill `pr: 0` → N; PR body documents: the 2 sanctioned legacy edits [Task 1 repoint + Task 2 store/backend additive], the `!slots?.gear` gates, the picker consolidation + enhanced-caps drift note, deferrals [materials modal reuse, wizard reuse, bridge]) → pr-review-loop → self-squash-merge → bookkeeping.

---

## Self-Review

- **Spec coverage (PR-1 scope):** §3.1 slot (T10) · §3.2 enabling refactor (T10) · §5.1 PriorityRow (T3) · §5.2 FloorCard/FloorDropRow + status derivation (T5) · §5.3 RecipientPicker assign/log (T4; edit = PR2 by design) · §5.4 week clock + WeekScopeControl + backend field (T2, T6) · §2.6 LootAdjustmentsModal (T7) · §2.8 WeaponPriorityBridge (T8) · §5.9 assembly/toolbar/Rules link (T9) · §6.2 promotion (T1) · release note (T11). History/FairnessSummary/BookLedgerCard/need.up/SegmentedToggle/contrast/suppressions-prune = PR2 (`f6d-history`) per spec §1.
- **Placeholders:** none — every step has code or an exact read-then-mirror instruction pinned to a file:line (Tag tones, ConfirmModal props, tierInfo derivation, wizard mount, weapon-modal mount, internal release-note shape). Those are deliberate just-in-time reads of stable in-repo contracts, not TBDs.
- **Type consistency:** `EnhancedPriorityEntry`/`EnhanceContext` (T1) consumed by T4/T5; `WeekClock` (T2) consumed by T6/T9; `PriorityRowEntry` (T3) consumed by T5; `DropItemContext`/`RecipientPickerProps` (T4) consumed by T9; `FloorCardProps.footer` (T5) consumed by T9; `LootProps` (T9) consumed by T10. Names cross-checked.
