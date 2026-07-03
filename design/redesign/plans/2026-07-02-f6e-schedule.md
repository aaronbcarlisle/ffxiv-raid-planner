# F6e — Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v2 Schedule screen — a single always-visible two-region page (sessions + RSVP left, availability aggregate right) scoped by the shared raid-week clock — and wire it as the `schedule` slot behind `?shell=v2`. Last Ring-0 screen slice before the parity flip.

**Architecture:** All-new code is ring-1 `components/schedule/` (new files beside the legacy files they replace at flip) + two additive shared-`ui/` edits (`SessionRsvpCard` `'later'` variant + new optional props; `PlayerIdentity` `'rsvp-row'` implementation). The assembly (`Schedule`) is the single fetcher (sessions once, availability per scoped week, cancelled exceptions batched per recurring session) and the modal host; children are presentational. Legacy modals (`CreateSessionModal`, `OccurrenceListModal`, `ConfirmModal`, `Modal`) and `availabilityUtils.ts`/`utils/recurrence.ts` are reused **import-only, unmodified**. `NewShell.ShellContent` passes the new `schedule` slot; the legacy route passes no slots → byte-for-byte legacy (the `??` fallback at `GroupViewContent.tsx:1060` wraps the entire legacy schedule body — no legacy edit needed).

**Tech Stack:** React 19 + TS, Zustand, Vitest + @testing-library/react (**fireEvent, NOT user-event**), Tailwind semantic tokens, Playwright + axe (contrast harness). **No backend changes.**

**Spec:** `design/redesign/specs/2026-07-02-f6e-schedule-design.md` (§1 scope, §2 locked decisions, §3 architecture, §5 contracts, §8 tests, §9 cut order). Mockup: `design/redesign/mockups/04-schedule.html`.

## Plan-time confirmations (spec §10 — RESOLVED)

1. **Cancelled-exception fetching → batched from the `Schedule` assembly.** One effect, `Promise.all(fetchExceptions)` over the recurring sessions, producing `Map<sessionId, ReadonlySet<string>>` of cancelled occurrence-date keys, passed into `sessionOccurrencesInRange`. Rationale: the week-window expansion must know cancellations *before* deciding which cards render (a cancelled occurrence must not appear in the scoped week), so the legacy per-card-on-mount pattern (`SessionCard.tsx:132-142`) is too late; the exception set is week-independent, so the effect keys on the recurring-session id list only (no refetch on week stepping).
2. **Empty-heatmap-data copy (exact string):** `No availability marked yet. Set yours via “Your availability” below — the picture fills in as members add theirs.` (Replaces the note line when the aggregate has zero marked slots; the `PersonLayerEntryPoint` below it is the invited action.)
3. **Empty-week "next session" hint → YES.** When the scoped week has zero occurrences and a later week (up to `currentWeek + 12`) has one, the empty state adds a ghost `Button` "Next session: {Fri, Jul 10} — Week {5}" that jumps the scope to that week. Derivation: `findNextSessionWeek` (Task 1) scans weeks `scopedWeek+1 .. currentWeek+12` with `sessionOccurrencesInRange` and returns the first hit. Defuses the week-scoping visibility risk (spec §10 bullet 3) for ~15 lines.

**Plan-time contract refinement (document in the PR body):** spec §5.2 sketched the member-grid row as a "status-ringed avatar *wrapping* `PlayerIdentity variant='rsvp-row'`" — that composition is impossible without duplicating the avatar or leaking RSVP status into the shared identity component (which §2.i forbids). Resolution: the row is `PlayerIdentity variant="rsvp-row"` (identity only; ring transparent — RSVPs carry no role) + a trailing **status glyph as colored text** (`✓`/`?`/`✗`/`·` via `STATUS_TOKEN`, with sr-only labels). This matches the F5 catalog's own wording ("PlayerIdentity + status dot") and keeps status never-color-only. The Home avatar *stack* keeps its status rings unchanged.

## Global Constraints

- **Branch:** `redesign/f6e-schedule` off foundation `aa3c097` (spec already committed `adb8dfb`). One commit per task.
- **ZERO legacy-file edits AND ZERO promote-and-repoints sanctioned this slice.** Only shared-file edits allowed: `ui/SessionRsvpCard.tsx` + `ui/PlayerIdentity.tsx` (additive, existing-consumer-safe, test-locked). Legacy modals (`CreateSessionModal`, `OccurrenceListModal`, `ConfirmModal`) + `availabilityUtils.ts` are imported UNMODIFIED. If a task seems to need any other edit — STOP, NEEDS_CONTEXT.
- NO new `eslint-suppressions.json` entries (new code = `components/schedule/` ring1 + the two `ui/` files).
- Tokens only (color-mix over `var(--color-accent)` sanctioned); 12px floor (`text-xs` minimum).
- NO AI attribution in any commit message.
- Internal release note only; NO CURRENT_VERSION bump (stays 2.0.2).
- Tests: `fireEvent` (no user-event dep); Radix menu items render via portal (never `within(row)`); components that fetch on mount get store fetch ACTIONS stubbed in tests.
- Gate (Task 11): `pnpm build` · `pnpm lint` (0 err) · `pnpm check:design-system:strict` · `pnpm test` · `pnpm tokens:check` · `git diff --check` · `cd scripts && npm test`.
- Reviewer: redesign-reviewer per task, diff-scoped. Implementers sonnet-5; opus for the flagged tasks.
- Pre-authorized cut order (spec §9): propose-session wiring → BestTimesCard → Share/Copy kebab items → recurring chip. Cutting = orchestrator decision logged in the ledger.

**Verified interface facts used throughout (do not re-derive; every line spot-verified against branch head):**
- `useWeekClock(groupId: string | undefined, tierId: string | undefined): WeekClock` — `WeekClock { currentWeek: number; maxWeek: number; weekStartDate: string | null; weeksWithData: Set<number>; weekDataTypes: Map<number, WeekEntryType[]>; rangeOfWeek(week): { start: Date; end: Date } | null; isCurrent(week): boolean; startNextWeek(): Promise<number>; revertWeek(): Promise<number> }` (`hooks/useWeekClock.ts:13-27`). `rangeOfWeek` anchors `new Date(weekStartDate)` + `(week-1)*7d`; `end = start + 6d`; returns null when no anchor. Backed by `useLootTrackingStore` (`currentWeek`, `maxWeek`, `weekStartDate`, `weeksWithEntries`, `weekDataTypes`).
- `WeekScopeControl` UTC-pins week dates: `d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })` (`WeekScopeControl.tsx:36-38`) — mirror for anchored ranges.
- `useScheduleStore` actions: `fetchSessions(groupId)`, `createSession(groupId, ScheduleSessionCreate)` (appends+re-sorts), `updateSession(groupId, sessionId, ScheduleSessionUpdate)`, `deleteSession(groupId, sessionId)`, `submitRsvp(groupId, sessionId, status, note?)` (upserts by userId), `fetchOccurrences(groupId, sessionId, count=20)`, `createException(groupId, sessionId, ScheduleExceptionCreate): Promise<ScheduleException>`, `deleteException(groupId, sessionId, occurrenceDate)`, `fetchExceptions(groupId, sessionId): Promise<ScheduleException[]>`, `clearSessions()` (**v2 must NOT call it on unmount** — it wipes Home's copy of the shared store). Mutating actions rethrow on failure.
- `useAvailabilityStore`: `data: AvailabilityDateSummary[]`, `fetchAvailability(groupId, startDate, endDate)` (UTC date strings; caller computes the range).
- `availabilityUtils.ts` (pure, import-only): `TIME_PRESETS.prime = { start: 18, end: 2, crossesMidnight: true }` (`:26-30`); `buildHeatMap(data): Map<'localDate|HH:MM', { count: number; names: string[] }>` (`:172`, UTC→viewer-local); `computeAvailabilityRecommendations(data, members, dates, durationMinutes, now?)` → `AvailabilityRecommendation[]` sorted count-desc, top 3, skips past windows (`:254-344`); `AvailabilityRecommendation { id: '${date}|${HH:MM}|${duration}'; startIso; endIso; slotKeys; availableCount; totalMembers; availableNames; missingNames }` (`:8-17`); `getNextNDates(count)` (`:129`); `getUtcDateRange(localDates): { startDate; endDate }` (pads ±1 day, `:207-218`); `getNextAvailabilityColumn(column)` (`:66-78`); `localSlotToUtc`/`utcSlotToLocal` (`:156-170`); `formatTimeLabel('20:00') → '8:00 PM'` (`:121-127`); `formatDateHeader('2026-07-07') → { day: 'Tue', date: 'Jul 7' }` (`:142-148`).
- `utils/recurrence.ts`: `computeNextOccurrence(startTimeIso, rruleStr, after = new Date(), cancelledDates?: ReadonlySet<string>, timezone?): Date | null` — returns occurrences **strictly after** `after`, honors cancelled local-date keys, DST-safe when `timezone` passed (`:195-301`); `addWeeksInTimezoneWallClock(iso, weeks, tz)` (`:121-133`); `getOccurrenceDateKey(iso, tz): 'YYYY-MM-DD'` (local-date key used when creating/matching exceptions, `:145-162`).
- Types (`types/index.ts:1443-1699`): `RsvpStatus = 'available'|'unavailable'|'tentative'`; `ScheduleRsvp { id; sessionId; userId; username: string | null; status; note: string | null; updatedAt }` (**no role field**); `ScheduleSession { id; …; startTime; endTime; timezone: string; isRecurring: boolean; recurrenceRule: string | null; trackAvailability?: boolean; category; rsvps: ScheduleRsvp[] }`; `ScheduleSessionCreate { title; description?; startTime; endTime; timezone; isRecurring?; recurrenceRule?; trackAvailability?; … }`; `ScheduleException { occurrenceDate; type: 'cancelled'|'edited'; … }`; `AvailabilityDateSummary { date; responses: UserAvailabilitySlot[] }`; `Membership { id; userId; staticGroupId; role: MemberRole; joinedAt; user?: MemberInfo }` (`:636-643`; display name = `user?.displayName || user?.discordUsername`).
- `SessionRsvpCard` current props `{ session; currentUserRsvp?; onRsvp?; variant?: 'next'|'later'; viewerTimezone? }` (`SessionRsvpCard.tsx:41-55`); `variant` is in the type but **not destructured/branched** (`:188-193`); `STATUS_TOKEN = { available: 'var(--color-status-success)', tentative: 'var(--color-status-warning)', unavailable: 'var(--color-status-error)' }` (`:58-62`); avatar stack wrapper is `aria-hidden` (`:240`); counts line testid `rsvp-counts`; RSVP strip = 3 `Button size="sm"`, active variant per `ACTIVE_VARIANT`, inactive `'secondary'`, `aria-pressed` (`:254-269`); helpers `formatDay`/`formatTime`/`countdownLabel` are tz-robust. Home consumes it with ONLY `session`/`currentUserRsvp`/`onRsvp` (`Home.tsx:243-247`).
- `PlayerIdentity` (`PlayerIdentity.tsx`): variant union includes `'rsvp-row'` (`:14`); reserved branch renders `null` + DEV `console.warn` (`:80-86`); shared derivations `autoSubtitle`/`srRoleLabel`/`getInitials` at `:89-92, :52-58`; ring style `{ borderColor: 'var(--color-role-${role})' }`. Existing test "renders nothing for reserved variants" at `PlayerIdentity.test.tsx:65` must be REPLACED.
- `TwoRegionDashboard { main: ReactNode; side: ReactNode; className? }` — grid `min-[1181px]:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] gap-[18px]` (adopt as-is, spec §2.b).
- `CardShell { title?; icon?; headerRight?; children; className?; as?: 'section'|'div' }` (title renders uppercase `text-xs` `<h3>`; base `bg-surface-card border border-border-subtle rounded-lg p-4`). `EmptyStateInvite { icon?; title; description?; action?: { label; onClick; variant? } }`. `Tag` variants `label|filter|nav`, tones `accent|success|warning|error|muted|info` (label = inert, `onClick` is a type error). `ProgressBar { value: 0–1; color?; ariaLabel?; className? }`. `Select { value: string; onChange(value: string); options: {value,label}[]; 'aria-label'?; … }` (ui/Select — DS conformant). `IconButton { 'aria-label': string; icon: ReactNode; variant?: 'default'|'primary'|'ghost'|'danger'; size?; ...button attrs }`. `Button` variants incl. `primary|secondary|ghost|accent-subtle|success|warning|danger`, `size="sm"`. `PageHeader { title; subtitle?; actions?; icon? }`. Dropdown primitives: `Dropdown/DropdownTrigger(asChild)/DropdownContent/DropdownItem/DropdownSeparator` from `'../primitives/Dropdown'` (WeekScopeControl precedent). `ConfirmModal { isOpen; title; message; variant: 'default'|'warning'|'danger'; confirmLabel; onConfirm; onCancel }` (usage `WeekScopeControl.tsx:133-151`).
- `CreateSessionModal { isOpen; onClose; onSubmit(data: ScheduleSessionCreate): Promise<void>; editSession?: ScheduleSession | null; initialDraft?: ScheduleSessionCreate | null; discordDeliverySummary? }` (`CreateSessionModal.tsx:60-73`) — form state initializes ONCE from `editSession ?? initialDraft` via `useState` initializers (`:110-149`), so **mount it conditionally** (`{isOpen && <CreateSessionModal isOpen …/>}`) to get fresh prefill per open. `OccurrenceListModal { isOpen; onClose; session; groupId; canManage }` (`OccurrenceListModal.tsx:12-18`).
- Legacy parity targets: `?sessionId=` deep link scrolls `schedule-session-{id}` after 50ms, clears highlight after 5000ms, acts once per id via a ref (`ScheduleTab.tsx:154-179`); share/Discord links embed `${origin}/group/${shareCode}?tab=schedule&sessionId=${id}` (`SessionCard.tsx:116, 216`); Share = `navigator.share` → clipboard fallback (`:206-225`); Copy-for-Discord message anatomy at `:93-120`; recurring delete = choice (cancel occurrence via `createException({ occurrenceDate: getOccurrenceDateKey(…), type: 'cancelled' })` / delete series) (`:158-175`); `trackAvailability === false` → "Availability not required" instead of RSVP UI (`:180`, `:476-480`); `canRsvp = authenticated && userRole && userRole !== 'viewer'` (`ScheduleTab.tsx:212`).
- Interactive matrix cells: mirror `GearBoardCell`'s accessible-span pattern (`GearBoardCell.tsx:55-74`) — span + `role` + `tabIndex` + click/Enter/Space keydown; shipped through `check:design-system:strict` in F6c (raw `<button>` would be flagged).
- `NewShell.ShellContent` slot precedent (`NewShell.tsx:43-99`): builds slots from `currentGroup`/`currentTier` + `useStaticPermissions()` (`{ canEdit: canManage, userRole, isAdminAccess }`), passes `slots={{ overview, roster, gear: loot }}`. Slot-wiring test precedent: `NewShell.gear.test.tsx` (pinned `useGroupViewState` mock at `pageMode`, dual-form store mocks, stubbed heavy leaves). Legacy schedule body markers for absence assertions: the raw Upcoming/Calendar switcher buttons (`GroupViewContent.tsx:1066-1087`) + `ScheduleUpcomingPanel` (default `sched='upcoming'` view, `:1089-1096`).
- Screen testid convention: `data-testid="schedule-screen"` on the assembly root (Roster `roster-screen` / Loot `loot-screen` precedent; the contrast harness scopes to it).
- `effectiveUserId` derivation (Roster/Loot precedent, `Loot.tsx:161-163`): `useAuthStore((s) => s.user)` + `useViewAsStore((s) => s.viewAsUser)` → `viewAsUser ? viewAsUser.userId : user?.id`.
- `getTierById(tierId)` from `'../../gamedata/raid-tiers'` → `{ name, floors, … } | null` (Loot.tsx:143 precedent) — the strip's `tierLabel`.

---

### Task 1: `scheduleWeek.ts` utils — occurrence expansion + hourly heat cells [opus]

The slice's hardest derivation (spec §10): expand sessions into a raid-week window honoring cancelled exceptions and DST, and aggregate the 30-min availability heatmap into hourly prime-window cells. Pure module — no React, no store imports. Also hosts three small helpers the assembly needs (`weekOfDate`, `findNextSessionWeek`, `deriveRecurringSummary`, `localSlotKeyOf`).

**Files:**
- Create: `frontend/src/components/schedule/scheduleWeek.ts`
- Create: `frontend/src/components/schedule/scheduleWeek.test.ts`

**Interfaces (produces — later tasks import these exact names):**
```ts
export interface SessionOccurrence { session: ScheduleSession; occursAt: string }
export interface HeatCell { date: string; hour: number; count: number; names: string[] }
export const PRIME_HOURS: number[];   // [18,19,20,21,22,23,0,1] derived from TIME_PRESETS.prime
export function sessionOccurrencesInRange(
  sessions: ScheduleSession[],
  range: { start: Date; end: Date },                       // useWeekClock.rangeOfWeek shape
  cancelledBySession?: Map<string, ReadonlySet<string>>,   // sessionId → cancelled occurrence-date keys
): SessionOccurrence[];
export function deriveHourlyHeatCells(
  heatMap: Map<string, { count: number; names: string[] }>,  // buildHeatMap output
  weekDates: string[],                                        // 7 × 'YYYY-MM-DD'
  presetHours?: number[],                                     // default PRIME_HOURS
): HeatCell[][];                                              // rows = hours, columns = weekDates
export function weekOfDate(weekStartDate: string | null, iso: string): number | null; // pre-anchor → 1
export function findNextSessionWeek(
  sessions: ScheduleSession[],
  rangeOfWeek: (week: number) => { start: Date; end: Date } | null,
  fromWeek: number, maxWeek: number,
  cancelledBySession?: Map<string, ReadonlySet<string>>,
): { week: number; occursAt: string } | null;
export function deriveRecurringSummary(sessions: ScheduleSession[]): string | null;
export function localSlotKeyOf(iso: string): string;  // viewer-local 'YYYY-MM-DD|HH:MM' of an instant
```

**Semantics to pin (write these into doc comments):**
- The week window is **half-open `[range.start, range.start + 7 days)`** — `rangeOfWeek`'s `end` is `start + 6d` (the last day's start), so compute `endMs = range.start.getTime() + 7 * DAY_MS` internally. Matches the backend's 7-day week buckets.
- Non-recurring session: included when `range.start <= startTime < endExclusive`.
- Recurring session: repeated `computeNextOccurrence(session.startTime, session.recurrenceRule, after, cancelled, session.timezone)` starting from `after = new Date(startMs - 1)` (so an occurrence exactly at the window start is included — the fn returns strictly-after), pushing until `null` or `>= endMs`; guard max 8 iterations per session per week. Cancelled dates are the session's set from `cancelledBySession` — a cancelled occurrence is skipped by `computeNextOccurrence` itself, and if the next non-cancelled occurrence falls outside the window the session contributes nothing (assert this).
- Results sorted by `occursAt` ascending (ISO string compare).
- `deriveHourlyHeatCells`: each cell aggregates the two half-slots `HH:00` + `HH:30` **conservatively**: `count = min(a.count, b.count)` (missing entry = 0) and `names` = sorted intersection of both name lists — a member counts only when free for the whole hour. After-midnight prime hours (`hour < presetHours[0]` in a cross-midnight window, i.e. 0 and 1) land on the **next** calendar date of the column via `getNextAvailabilityColumn(dateKey)` (import from `'./availabilityUtils'`). Designed for the prime window — the only preset v2 renders (spec §2.j.4).
- `weekOfDate`: `floor((t - anchor) / 7d) + 1`, clamped to 1 for pre-anchor instants; null when `weekStartDate` is null/unparseable.
- `deriveRecurringSummary`: for each recurring session with a rule, `BYDAY` tokens → `Mon/Tue/…` labels joined `/` (no BYDAY → `Weekly`) + the session's start time formatted `h:mm A` in the **session's own timezone** (try/catch → no-tz fallback); entries joined `' · '`; prefixed `'Recurring: '`; null when no recurring sessions. Example: `Recurring: Tue/Fri 8:00 PM`.
- `localSlotKeyOf`: viewer-local `YYYY-MM-DD|HH:MM` via local getters (used to match sessions to recommendation/heat slots).

- [ ] **Step 1: Write the failing tests** (`scheduleWeek.test.ts`). Timezone-stability rules: recurrence fixtures pass explicit IANA timezones; heat-cell tests construct the `heatMap` **Map literal directly** (keys are already-local `date|HH:MM` — do NOT route through `buildHeatMap`, whose UTC→local conversion would make tests depend on the runner's TZ). Fixture helper:

```ts
import { describe, it, expect } from 'vitest';
import {
  sessionOccurrencesInRange, deriveHourlyHeatCells, weekOfDate,
  findNextSessionWeek, deriveRecurringSummary, localSlotKeyOf, PRIME_HOURS,
} from './scheduleWeek';
import type { ScheduleSession } from '../../types';

const DAY_MS = 86_400_000;
function makeSession(over: Partial<ScheduleSession>): ScheduleSession {
  return {
    id: 's1', staticGroupId: 'g1', createdById: 'u1', title: 'Raid',
    description: null, startTime: '2026-07-07T00:00:00.000Z', endTime: '2026-07-07T02:30:00.000Z',
    timezone: 'UTC', isRecurring: false, recurrenceRule: null,
    category: 'raid', contentId: null, contentName: null, bannerUrl: null,
    createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z', rsvps: [],
    ...over,
  } as ScheduleSession;
}
const range = (startIso: string) => {
  const start = new Date(startIso);
  return { start, end: new Date(start.getTime() + 6 * DAY_MS) };
};

describe('sessionOccurrencesInRange', () => {
  it('includes a non-recurring session inside the window and excludes one outside', () => {
    const inside = makeSession({ id: 'in', startTime: '2026-07-08T19:00:00.000Z' });
    const before = makeSession({ id: 'before', startTime: '2026-07-05T19:00:00.000Z' });
    const daydemo = makeSession({ id: 'day7', startTime: '2026-07-13T00:00:00.000Z' }); // exactly start+7d → next week
    const occ = sessionOccurrencesInRange([inside, before, daydemo], range('2026-07-06T00:00:00.000Z'));
    expect(occ.map((o) => o.session.id)).toEqual(['in']);
    expect(occ[0].occursAt).toBe('2026-07-08T19:00:00.000Z');
  });

  it('expands a weekly recurring session into the window (occurrence ≠ base start)', () => {
    const rec = makeSession({
      id: 'rec', isRecurring: true, recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU',
      startTime: '2026-06-16T20:00:00.000Z', timezone: 'UTC', // Tue 8 PM UTC
    });
    const occ = sessionOccurrencesInRange([rec], range('2026-07-06T00:00:00.000Z')); // wk of Jul 6
    expect(occ).toHaveLength(1);
    expect(occ[0].occursAt).toBe('2026-07-07T20:00:00.000Z'); // Tue Jul 7
  });

  it('excludes a cancelled occurrence and does not pull the next week into this one', () => {
    const rec = makeSession({
      id: 'rec', isRecurring: true, recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU',
      startTime: '2026-06-16T20:00:00.000Z', timezone: 'UTC',
    });
    const cancelled = new Map([['rec', new Set(['2026-07-07'])]]); // local(UTC) date key
    const occ = sessionOccurrencesInRange([rec], range('2026-07-06T00:00:00.000Z'), cancelled);
    expect(occ).toEqual([]);
  });

  it('preserves wall-clock time across a DST boundary (America/New_York)', () => {
    // Weekly Thu 19:00 America/New_York. Base: Thu 2026-02-26 19:00 EST = 2026-02-27T00:00:00Z.
    // Wait — 2026-02-26T19:00 EST is 2026-02-27T00:00:00Z; BYDAY=TH matches the LOCAL Thursday.
    const rec = makeSession({
      id: 'dst', isRecurring: true, recurrenceRule: 'FREQ=WEEKLY;BYDAY=TH',
      startTime: '2026-02-27T00:00:00.000Z', timezone: 'America/New_York',
    });
    // Week containing Thu 2026-03-12 (after spring-forward on 2026-03-08):
    const occ = sessionOccurrencesInRange([rec], range('2026-03-09T00:00:00.000Z'));
    expect(occ).toHaveLength(1);
    // 19:00 EDT (UTC-4) → 23:00Z — wall clock preserved, UTC instant shifted.
    expect(occ[0].occursAt).toBe('2026-03-12T23:00:00.000Z');
  });

  it('sorts merged results ascending by occursAt', () => {
    const a = makeSession({ id: 'a', startTime: '2026-07-09T19:00:00.000Z' });
    const b = makeSession({ id: 'b', startTime: '2026-07-07T19:00:00.000Z' });
    const occ = sessionOccurrencesInRange([a, b], range('2026-07-06T00:00:00.000Z'));
    expect(occ.map((o) => o.session.id)).toEqual(['b', 'a']);
  });
});

describe('deriveHourlyHeatCells', () => {
  const dates = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12'];
  it('exposes the prime window rows 18..23,0,1', () => {
    expect(PRIME_HOURS).toEqual([18, 19, 20, 21, 22, 23, 0, 1]);
  });
  it('counts a member only when BOTH half-slots are free (conservative rule)', () => {
    const heat = new Map([
      ['2026-07-07|19:00', { count: 2, names: ['Alice', 'Bob'] }],
      ['2026-07-07|19:30', { count: 1, names: ['Alice'] }],
      ['2026-07-07|20:00', { count: 1, names: ['Bob'] }], // 20:30 missing → hour 20 = 0
    ]);
    const rows = deriveHourlyHeatCells(heat, dates);
    const hour19 = rows[1][1]; // row index 1 = hour 19, col 1 = Jul 7
    expect(hour19).toEqual({ date: '2026-07-07', hour: 19, count: 1, names: ['Alice'] });
    const hour20 = rows[2][1];
    expect(hour20.count).toBe(0);
    expect(hour20.names).toEqual([]);
  });
  it('rolls after-midnight prime hours to the NEXT calendar date of the column', () => {
    const heat = new Map([
      ['2026-07-08|00:00', { count: 1, names: ['Cara'] }],
      ['2026-07-08|00:30', { count: 1, names: ['Cara'] }],
    ]);
    const rows = deriveHourlyHeatCells(heat, dates);
    const midnight = rows[6][1]; // row 6 = hour 0, column 1 = Jul 7 → actual date Jul 8
    expect(midnight).toEqual({ date: '2026-07-08', hour: 0, count: 1, names: ['Cara'] });
  });
});

describe('weekOfDate / findNextSessionWeek / deriveRecurringSummary / localSlotKeyOf', () => {
  it('weekOfDate maps instants into 7-day buckets, clamps pre-anchor to 1, null without anchor', () => {
    expect(weekOfDate('2026-06-23', '2026-06-23T00:00:00Z')).toBe(1);
    expect(weekOfDate('2026-06-23', '2026-07-07T12:00:00Z')).toBe(3);
    expect(weekOfDate('2026-06-23', '2026-06-01T00:00:00Z')).toBe(1);
    expect(weekOfDate(null, '2026-07-07T12:00:00Z')).toBeNull();
  });
  it('findNextSessionWeek returns the first later week with an occurrence', () => {
    const s = makeSession({ id: 'f', startTime: '2026-07-09T19:00:00.000Z' }); // week 3 of 2026-06-23 anchor
    const anchor = new Date('2026-06-23T00:00:00.000Z');
    const rangeOfWeek = (w: number) => ({
      start: new Date(anchor.getTime() + (w - 1) * 7 * DAY_MS),
      end: new Date(anchor.getTime() + ((w - 1) * 7 + 6) * DAY_MS),
    });
    expect(findNextSessionWeek([s], rangeOfWeek, 1, 14)).toEqual({ week: 3, occursAt: '2026-07-09T19:00:00.000Z' });
    expect(findNextSessionWeek([s], rangeOfWeek, 3, 14)).toBeNull();
  });
  it('deriveRecurringSummary formats BYDAY + session-tz time; null when none', () => {
    const rec = makeSession({
      isRecurring: true, recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU,FR',
      startTime: '2026-07-07T20:00:00.000Z', timezone: 'UTC',
    });
    expect(deriveRecurringSummary([rec])).toBe('Recurring: Tue/Fri 8:00 PM');
    expect(deriveRecurringSummary([makeSession({})])).toBeNull();
  });
  it('localSlotKeyOf emits a viewer-local date|HH:MM key', () => {
    const d = new Date(2026, 6, 7, 20, 0, 0); // constructed IN local time → TZ-independent assertion
    expect(localSlotKeyOf(d.toISOString())).toBe('2026-07-07|20:00');
  });
});
```
(One fixture note for the implementer: the DST test's base instant `2026-02-27T00:00:00.000Z` IS local Thursday 19:00 EST — `computeNextOccurrence`'s multi/single-BYDAY paths match the LOCAL weekday when `timezone` is passed. Do not "fix" the fixture.)

- [ ] **Step 2: Run to verify failure** — `pnpm -C frontend test -- --run scheduleWeek` → FAIL (module not found).

- [ ] **Step 3: Implement** (`scheduleWeek.ts`):

```ts
/**
 * scheduleWeek — pure derivations binding the Schedule screen to the shared
 * raid-week clock (F6e spec §2.a / §4.2). The v2 Schedule week IS the loot
 * week: occurrences are expanded into half-open 7-day windows anchored at
 * useWeekClock's weekStartDate. No React, no store imports.
 */
import { computeNextOccurrence } from '../../utils/recurrence';
import { TIME_PRESETS, getNextAvailabilityColumn } from './availabilityUtils';
import type { ScheduleSession } from '../../types';

export interface SessionOccurrence { session: ScheduleSession; occursAt: string }
export interface HeatCell { date: string; hour: number; count: number; names: string[] }

const DAY_MS = 86_400_000;
const MAX_OCCURRENCES_PER_WEEK = 8;

/** Prime-window display hours: 18:00 → 02:00 (spec §2.j.4). */
export const PRIME_HOURS: number[] = (() => {
  const { start, end } = TIME_PRESETS.prime; // { start: 18, end: 2, crossesMidnight: true }
  const hours: number[] = [];
  for (let h = start; h < 24; h++) hours.push(h);
  for (let h = 0; h < end; h++) hours.push(h);
  return hours;
})();

export function sessionOccurrencesInRange(
  sessions: ScheduleSession[],
  range: { start: Date; end: Date },
  cancelledBySession?: Map<string, ReadonlySet<string>>,
): SessionOccurrence[] {
  // Half-open [start, start+7d): rangeOfWeek's `end` is start+6d (last day's start).
  const startMs = range.start.getTime();
  const endMs = startMs + 7 * DAY_MS;
  const out: SessionOccurrence[] = [];
  for (const session of sessions) {
    if (!session.isRecurring || !session.recurrenceRule) {
      const t = new Date(session.startTime).getTime();
      if (!Number.isNaN(t) && t >= startMs && t < endMs) {
        out.push({ session, occursAt: new Date(t).toISOString() });
      }
      continue;
    }
    const cancelled = cancelledBySession?.get(session.id);
    let after = new Date(startMs - 1); // strictly-after semantics → window start included
    for (let i = 0; i < MAX_OCCURRENCES_PER_WEEK; i++) {
      const next = computeNextOccurrence(
        session.startTime, session.recurrenceRule, after, cancelled, session.timezone,
      );
      if (!next || next.getTime() >= endMs) break;
      out.push({ session, occursAt: next.toISOString() });
      after = next;
    }
  }
  return out.sort((a, b) => a.occursAt.localeCompare(b.occursAt));
}

/**
 * 30-min store slots → hourly display cells, conservatively: a member counts
 * only when free for BOTH half-slots (min count + name intersection). Designed
 * for the cross-midnight prime window: hours below the window start (0,1) land
 * on the NEXT calendar date of the column.
 */
export function deriveHourlyHeatCells(
  heatMap: Map<string, { count: number; names: string[] }>,
  weekDates: string[],
  presetHours: number[] = PRIME_HOURS,
): HeatCell[][] {
  const windowStart = presetHours[0] ?? 0;
  return presetHours.map((hour) =>
    weekDates.map((dateKey) => {
      const date = hour < windowStart ? getNextAvailabilityColumn(dateKey) : dateKey;
      const hh = String(hour).padStart(2, '0');
      const a = heatMap.get(`${date}|${hh}:00`);
      const b = heatMap.get(`${date}|${hh}:30`);
      const count = Math.min(a?.count ?? 0, b?.count ?? 0);
      const bNames = new Set(b?.names ?? []);
      const names = (a?.names ?? []).filter((n) => bNames.has(n)).sort();
      return { date, hour, count, names };
    }),
  );
}

/** Raid week containing an instant. Pre-anchor instants clamp to week 1. */
export function weekOfDate(weekStartDate: string | null, iso: string): number | null {
  if (!weekStartDate) return null;
  const anchor = new Date(weekStartDate).getTime();
  const t = new Date(iso).getTime();
  if (Number.isNaN(anchor) || Number.isNaN(t)) return null;
  if (t < anchor) return 1;
  return Math.floor((t - anchor) / (7 * DAY_MS)) + 1;
}

/** First week after `fromWeek` (≤ maxWeek) containing a session occurrence. */
export function findNextSessionWeek(
  sessions: ScheduleSession[],
  rangeOfWeek: (week: number) => { start: Date; end: Date } | null,
  fromWeek: number,
  maxWeek: number,
  cancelledBySession?: Map<string, ReadonlySet<string>>,
): { week: number; occursAt: string } | null {
  for (let w = fromWeek + 1; w <= maxWeek; w++) {
    const range = rangeOfWeek(w);
    if (!range) return null;
    const occ = sessionOccurrencesInRange(sessions, range, cancelledBySession);
    if (occ.length > 0) return { week: w, occursAt: occ[0].occursAt };
  }
  return null;
}

const BYDAY_LABEL: Record<string, string> = {
  MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun',
};

/** Display-only strip chip text, e.g. "Recurring: Tue/Fri 8:00 PM" (§2.j.5). */
export function deriveRecurringSummary(sessions: ScheduleSession[]): string | null {
  const parts: string[] = [];
  for (const s of sessions) {
    if (!s.isRecurring || !s.recurrenceRule) continue;
    const match = s.recurrenceRule.match(/BYDAY=([A-Z,]+)/);
    const days = match
      ? match[1].split(',').map((d) => BYDAY_LABEL[d] ?? d).join('/')
      : 'Weekly';
    let time: string;
    try {
      time = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', minute: '2-digit', timeZone: s.timezone,
      }).format(new Date(s.startTime));
    } catch {
      time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
        .format(new Date(s.startTime));
    }
    parts.push(`${days} ${time}`);
  }
  return parts.length > 0 ? `Recurring: ${parts.join(' · ')}` : null;
}

/** Viewer-local 'YYYY-MM-DD|HH:MM' key of an instant (heat/rec slot matching). */
export function localSlotKeyOf(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}|${p(d.getHours())}:${p(d.getMinutes())}`;
}
```

- [ ] **Step 4: Run to verify pass** — `pnpm -C frontend test -- --run scheduleWeek` → PASS. Also run `pnpm -C frontend test -- --run recurrence` (existing recurrence tests untouched, still green).
- [ ] **Step 5: Commit** — `git add frontend/src/components/schedule/scheduleWeek.ts frontend/src/components/schedule/scheduleWeek.test.ts && git commit -m "feat(schedule): scheduleWeek utils — week-window occurrence expansion + hourly heat cells"`

---

### Task 2: `PlayerIdentity` `rsvp-row` variant (shared `ui/`)

Implement the reserved variant (spec §2.i/§5.3): a compact identity row — 24px avatar (initials fallback; role ring only if `role` passed, which RSVPs won't today) + `text-xs font-medium` name, one line, truncating. Replaces the `null` + DEV-warn branch at `PlayerIdentity.tsx:80-86`. NO status semantics (status is schedule-domain; the parent renders the glyph). `inline`/`board-cell` rendering must not change.

**Files:**
- Modify: `frontend/src/components/ui/PlayerIdentity.tsx`
- Modify: `frontend/src/components/ui/PlayerIdentity.test.tsx` (REPLACE the reserved-variant test at `:65` "renders nothing for reserved variants"; append an `rsvp-row` describe)

**Interfaces:**
- Consumes: existing `PlayerIdentityProps` (`{ name; job?; role?; position?; subtitle?; avatarUrl?; variant?: 'inline'|'board-cell'|'rsvp-row' }`) — NO prop changes.
- Produces: `variant="rsvp-row"` renders (no longer null). Task 3 composes it.

- [ ] **Step 1: Write/replace the failing tests.** DELETE the `it('renders nothing for reserved variants', …)` case (it asserts `container.firstChild` null + DEV warn). Append:

```tsx
describe('PlayerIdentity rsvp-row variant', () => {
  it('renders a 24px avatar row with the name at text-xs (no null return, no DEV warn)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<PlayerIdentity name="Alice Ray" variant="rsvp-row" />);
    expect(screen.getByText('Alice Ray')).toBeInTheDocument();
    expect(screen.getByText('AR')).toBeInTheDocument(); // initials fallback
    const ring = screen.getByTestId('player-identity-ring');
    expect(ring.className).toContain('h-6');
    expect(ring.className).toContain('w-6');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
  it('applies a role ring via CSS var only when role is passed', () => {
    const { rerender } = render(<PlayerIdentity name="A" variant="rsvp-row" role="caster" />);
    expect(screen.getByTestId('player-identity-ring')).toHaveStyle({ borderColor: 'var(--color-role-caster)' });
    rerender(<PlayerIdentity name="A" variant="rsvp-row" />);
    expect(screen.getByTestId('player-identity-ring').style.borderColor).toBe('');
  });
  it('emits the sr-only role label when role is set with no textual signal', () => {
    render(<PlayerIdentity name="A" variant="rsvp-row" role="tank" />);
    expect(screen.getByText('Tank')).toHaveClass('sr-only');
  });
});
```
(`vi` import may need adding to the test file's vitest import line.)

- [ ] **Step 2: Run to verify failure** — `pnpm -C frontend test -- --run PlayerIdentity` → new cases FAIL (variant renders null); all `inline`/`board-cell` cases still PASS.

- [ ] **Step 3: Implement.** In `PlayerIdentity.tsx`: (a) delete the `variant === 'rsvp-row'` early-return block (`:80-86`); (b) the shared derivations (`autoSubtitle`, `subtitleContent`, `srRoleLabel`, `getInitials`) already sit above the `board-cell` branch — keep them; (c) insert the new branch after them, before the `board-cell` branch:

```tsx
  if (variant === 'rsvp-row') {
    // Compact identity row (F6e): 24px avatar + text-xs name, one line.
    // NO RSVP status here — status is schedule-domain; SessionRsvpCard renders
    // its own status glyph beside this. Role ring only when `role` is passed
    // (RSVPs carry no role today — the ready seam for future role coloring).
    const ringStyle: React.CSSProperties = role
      ? { borderColor: `var(--color-role-${role})` }
      : {};
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <div
          data-testid="player-identity-ring"
          className="relative h-6 w-6 shrink-0 rounded-full border-2 border-transparent"
          style={ringStyle}
        >
          <SafeAvatar
            src={avatarUrl}
            alt={name}
            className="w-full h-full rounded-full object-cover"
            fallback={
              <span
                className="w-full h-full rounded-full bg-surface-interactive flex items-center justify-center text-xs font-medium text-text-secondary"
                aria-hidden="true"
              >
                {getInitials(name)}
              </span>
            }
          />
        </div>
        <span className="min-w-0 truncate text-xs font-medium text-text-primary">{name}</span>
        {srRoleLabel && <span className="sr-only">{srRoleLabel}</span>}
      </div>
    );
  }
```
Update the file's variant-union doc comment (`:9-13` and `:33-36`): `'rsvp-row' — RSVP roster row inside SessionRsvpCard (F6e). BUILT.` (No JobIcon, no subtitle in this variant — RSVPs have no job data.)

- [ ] **Step 4: Run to verify pass** — `pnpm -C frontend test -- --run PlayerIdentity` → ALL green (existing inline/board-cell cases untouched). Then `pnpm -C frontend test -- --run "Home|AttentionRow"` (PlayerIdentity consumers) → green.
- [ ] **Step 5: Commit** — `git commit -m "feat(ui): PlayerIdentity rsvp-row variant — compact identity row"`

---

### Task 3: `SessionRsvpCard` additive change — 'later' variant, member grid, day pill, actions slot [opus]

The shared card is LIVE ON HOME — every addition is default-off; the regression lock is written FIRST. Existing props verified at `SessionRsvpCard.tsx:41-55`; `variant` is currently accepted but unbranched (`:188-193`).

**Two sanctioned default-render deltas (assert them, document in the PR body):**
1. The `'next'` variant (Home's default) gains its DS-contracted accent differentiation — implemented as `ring-1 ring-accent/40` on the CardShell (NOT a border class: CardShell's own `border-border-subtle` would conflict).
2. Sessions with `trackAvailability === false` now show "Availability not required" instead of the RSVP UI (legacy parity, `SessionCard.tsx:476-480`; previously the card wrongly rendered live RSVP buttons for tracking-off sessions).
Everything else is behind new optional props.

**Files:**
- Modify: `frontend/src/components/ui/SessionRsvpCard.tsx`
- Modify: `frontend/src/components/ui/SessionRsvpCard.test.tsx` (append; ALL 14 existing cases stay green)

**Interfaces (produces — the full new props type, character-for-character):**
```ts
export interface SessionRsvpCardProps {
  session: ScheduleSession;                 // existing
  currentUserRsvp?: RsvpStatus;             // existing
  onRsvp?: (status: RsvpStatus) => void;    // existing
  variant?: 'next' | 'later';               // existing — 'later' NOW IMPLEMENTED
  viewerTimezone?: string;                  // existing
  members?: Array<{ userId: string; username: string | null }>; // full roster → enables the
        // member grid + "no answer" derivation (members minus rsvps); omitted = avatar stack (Home)
  memberDetail?: 'stack' | 'grid';          // default 'stack' (Home unchanged); Schedule passes 'grid'
  headerActions?: ReactNode;                // kebab slot (rendered beside the countdown Tag)
  showDayPill?: boolean;                    // default false; Schedule true ("26 / Fri")
}
```

**Behavior contract:**
- **`'next'`:** CardShell title `"Next session"`, `className="ring-1 ring-accent/40"`; inactive RSVP buttons `variant="secondary"` (unchanged). **`'later'`:** CardShell title = `session.title`, no ring class; inactive RSVP buttons `variant="ghost"` (mockup ghost-unanswered).
- **`headerActions`:** CardShell `headerRight` becomes `<div className="flex items-center gap-1.5">{countdown Tag}{headerActions}</div>` (countdown logic unchanged).
- **`showDayPill`:** before the day/time block, a pill (`data-testid="day-pill"`): day-of-month (`font-display text-sm font-extrabold`) over short weekday (`text-xs text-text-tertiary`), both formatted in the SESSION's timezone with the same try/catch tz-robustness as `formatDay` (add a small `formatDayPill(iso, tz): { day: string; weekday: string } | null` helper beside it). Wrap pill + text block in `flex items-center gap-3`.
- **Member grid (`memberDetail === 'grid'` AND `members` provided):** replaces the avatar stack. `const rsvpByUser = new Map(session.rsvps.map(r => [r.userId, r]))`; rows = every member (rsvp'd or not), rendered as `<ul data-testid="rsvp-member-grid" className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">`; each `<li className="flex min-w-0 items-center gap-1.5" title={rsvp?.note ?? undefined}>` containing `PlayerIdentity variant="rsvp-row" name={member.username ?? 'Unknown'}` + trailing status glyph:
```tsx
const GRID_GLYPH: Record<RsvpStatus, { ch: string; cls: string; label: string }> = {
  available:   { ch: '✓', cls: 'text-status-success', label: 'available' },
  tentative:   { ch: '?', cls: 'text-status-warning', label: 'tentative' },
  unavailable: { ch: '✗', cls: 'text-status-error',   label: "can't make it" },
};
// no-answer: { ch: '·', cls: 'text-text-muted', label: 'no answer' }
<span aria-hidden="true" className={`ml-auto text-xs font-bold ${glyph.cls}`}>{glyph.ch}</span>
<span className="sr-only">{glyph.label}</span>
```
(RSVP notes surface as the row `title` — feature-audit row 2 parity; polish → holistic.)
- **Counts line with `members`:** `"N in · M tentative · K no answer"` where `K = members.filter(m => !rsvpByUser.has(m.userId)).length` (same testid `rsvp-counts`; the "no answer" segment renders only when `members` is provided — Home's line unchanged).
- **Contextual note (gated on `members` — Home unchanged):** when `members` is provided and ≥1 RSVP is tentative/unavailable, a `text-xs text-text-tertiary` line (`data-testid="rsvp-warning-note"`): tentative part `"{names} tentative"`, unavailable part `"{names} can't make it"`, joined `' · '`, suffixed `" — sub may be needed"`. Role-free copy (spec §2.h).
- **`trackAvailability === false`:** the avatar stack/grid + counts + RSVP strip are ALL replaced by `<div data-testid="availability-not-required" className="text-xs text-text-tertiary">Availability not required</div>` (legacy hides the whole RSVP pressure UI).
- **Viewer mode:** when `members` is provided AND `onRsvp` is undefined, the RSVP strip is OMITTED (Schedule viewers see no dead buttons). Home (no `members`) keeps the existing inert-render — the existing test at `:126` locks that.
- a11y unchanged: `aria-pressed` on strip buttons; grid statuses = text glyph + sr-only, never color-only.

- [ ] **Step 1: Write the regression lock FIRST** (append; reuse the file's existing `makeSession`-style fixtures/helpers):
```tsx
describe('SessionRsvpCard — F6e regression lock (no new props → Home render)', () => {
  it('renders exactly the F6b anatomy with only the original props', () => {
    render(<SessionRsvpCard session={session} currentUserRsvp="available" onRsvp={vi.fn()} />);
    expect(screen.getByText('Next session')).toBeInTheDocument();
    expect(screen.queryByTestId('day-pill')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rsvp-member-grid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rsvp-warning-note')).not.toBeInTheDocument();
    expect(screen.getByTestId('rsvp-counts').textContent).not.toContain('no answer');
    expect(screen.getAllByTestId('rsvp-avatar').length).toBe(session.rsvps.length); // stack, not grid
    // The ONE sanctioned default delta: the next-variant accent ring.
    expect(document.querySelector('.ring-accent\\/40')).toBeInTheDocument();
  });
});
```
Then the new-behavior cases:
  1. `'later'` — title = session.title, no `.ring-accent\/40`, inactive buttons carry the ghost variant (assert via class difference vs an active button).
  2. member grid — `members` (4 entries, 2 with rsvps) + `memberDetail="grid"` → grid testid present, stack testid absent, 4 rows, counts read `"1 in · 1 tentative · 2 no answer"` (fixture: one available, one tentative), no-answer rows show `·`.
  3. no-answer derivation is members-minus-rsvps (a member with an rsvp never shows `·`).
  4. `trackAvailability: false` → `availability-not-required` testid present; RSVP buttons + counts + grid ABSENT.
  5. `headerActions` — pass `<button data-testid="kebab-probe" />` → rendered in the header row.
  6. `showDayPill` — pill shows the day number + short weekday for `session.startTime` in the session tz.
  7. warning note — tentative RSVP + `members` → note text matches `/Bob tentative — sub may be needed/`; WITHOUT `members` → note absent.
  8. viewer omission — `members` provided + `onRsvp` undefined → no RSVP buttons rendered.
- [ ] **Step 2: Run to verify failures** — `pnpm -C frontend test -- --run SessionRsvpCard` → regression-lock ring assertion + all new cases FAIL; the 14 pre-existing cases PASS.
- [ ] **Step 3: Implement** per the behavior contract. Destructure `variant = 'next'`, `members`, `memberDetail = 'stack'`, `headerActions`, `showDayPill = false`. Keep every existing helper and the avatar-stack/counts/strip code paths byte-compatible for the no-new-props render (aside from the ring class + tracking-off note).
- [ ] **Step 4: Run to verify pass** — full file green (existing + new). Then `pnpm -C frontend test -- --run Home` → green (Home's own tests must not notice the change).
- [ ] **Step 5: Commit** — `git commit -m "feat(ui): SessionRsvpCard later variant, member grid, day pill, actions slot"`

---

### Task 4: `WeekNavigatorStrip`

The page-level week stepper (spec §5.1) — presentational, takes the clock as a prop (the `WeekScopeControlProps` pattern), NO store imports, NO week mutations (`startNextWeek`/`revertWeek` stay in Loot's `WeekScopeControl` — one clock, one mutation host).

**Files:**
- Create: `frontend/src/components/schedule/WeekNavigatorStrip.tsx`
- Create: `frontend/src/components/schedule/WeekNavigatorStrip.test.tsx`

**Interfaces:**
- Consumes: `WeekClock` type from `'../../hooks/useWeekClock'`; `Tag`, `Button`, `IconButton` primitives; `ChevronLeft`/`ChevronRight` from lucide.
- Produces (exact, spec §5.1):
```ts
export interface WeekNavigatorStripProps {
  clock: WeekClock;
  scopedWeek: number;
  onScopedWeekChange: (week: number) => void;
  tierLabel?: string;
  recurringSummary?: string | null;
  canManage: boolean;
  onAddSession: () => void;
}
```

**Rendering contract:**
- Flex row (`flex items-center gap-3 mb-4`, wrapped `flex-wrap`): `IconButton` ‹ (`aria-label="Previous week"`, `variant="ghost" size="sm"`, disabled when `scopedWeek <= 1` OR null anchor) · label block · `IconButton` › (`aria-label="Next week"`, disabled when `scopedWeek >= clock.currentWeek + 12` OR null anchor) · `flex-1` spacer · `{recurringSummary && <Tag variant="label" tone="muted">{recurringSummary}</Tag>}` · `{canManage && <Button variant="primary" size="sm" onClick={onAddSession}>Add session</Button>}`.
- Label block (anchored, `clock.weekStartDate !== null`): line 1 `font-display font-bold` — `Week {scopedWeek}` (`text-accent` when `clock.isCurrent(scopedWeek)`, else `text-text-primary`) + `{clock.isCurrent(scopedWeek) && <span className="text-text-tertiary font-normal"> · this week</span>}`; line 2 `text-xs text-text-tertiary` — `rangeOfWeek(scopedWeek)` formatted `"Jun 24 – Jun 30"` (each date via `toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })` — the `WeekScopeControl.tsx:36-38` UTC pin) + `{tierLabel && ` · ${tierLabel}`}`.
- **Null anchor (`clock.weekStartDate === null`, §2.a):** line 1 `"This week"` (no week number, no accent); line 2 = today → today+6d formatted with plain local `toLocaleDateString('en-US', { month: 'short', day: 'numeric' })` (rolling window derives from `new Date()`, so local is correct); both steppers disabled.
- Stepper clicks call `onScopedWeekChange(scopedWeek ∓ 1)`.

- [ ] **Step 1: Write the failing tests.** Build a fake clock: `const clock = { currentWeek: 3, maxWeek: 3, weekStartDate: '2026-06-23', weeksWithData: new Set(), weekDataTypes: new Map(), rangeOfWeek: (w) => ({ start: new Date(Date.UTC(2026, 5, 23 + (w-1)*7)), end: new Date(Date.UTC(2026, 5, 29 + (w-1)*7)) }), isCurrent: (w) => w === 3, startNextWeek: vi.fn(), revertWeek: vi.fn() } as unknown as WeekClock;` Cases: current week renders `Week 3` + `· this week` + `Jul 7 – Jul 13` range; non-current scoped week (2) has no `· this week` and range `Jun 30 – Jul 6`; ‹ fires `onScopedWeekChange(1)` / › fires `(3)`; ‹ disabled at scopedWeek 1; › disabled at scopedWeek 15 (= currentWeek+12); null-anchor clock (`weekStartDate: null, rangeOfWeek: () => null`) renders `This week`, no `Week` number, both steppers disabled; `recurringSummary="Recurring: Tue/Fri 8:00 PM"` renders the Tag text; `canManage={false}` hides "Add session", true shows it and fires `onAddSession`; `tierLabel="AAC Heavyweight"` appears in line 2.
- [ ] **Step 2: Verify failure** — `pnpm -C frontend test -- --run WeekNavigatorStrip` → FAIL.
- [ ] **Step 3: Implement** per the contract (~90 lines).
- [ ] **Step 4: Verify pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat(schedule): WeekNavigatorStrip — shared-clock week stepper"`

---

### Task 5: `SessionList` — session cards + kebab actions (Share / Copy for Discord fresh-audited)

The scoped week's cards: first upcoming occurrence in the CURRENT week = `next`, all others `later`; kebab per card; empty state with the next-session hint. Share + Copy-for-Discord are thin fresh handlers living HERE (~30 lines each; the legacy versions are `SessionCard`-inline and can't be imported); Edit/Delete/Manage-occurrences bubble up (Task 8 hosts the modals).

**Files:**
- Create: `frontend/src/components/schedule/SessionList.tsx`
- Create: `frontend/src/components/schedule/SessionList.test.tsx`

**Interfaces:**
- Consumes: `SessionRsvpCard` (Task 3 props, incl. `members`/`memberDetail`/`headerActions`/`showDayPill`), `SessionOccurrence` from `'./scheduleWeek'` (Task 1), `EmptyStateInvite`, `IconButton` + Dropdown primitives, `toast` from `'../../stores/toastStore'`.
- Produces:
```ts
export interface SessionListProps {
  occurrences: SessionOccurrence[];          // already scoped + sorted (Task 1)
  isCurrentWeek: boolean;                    // clock.isCurrent(scopedWeek)
  members: Array<{ userId: string; username: string | null }>;
  currentUserId: string | null;
  canManage: boolean;
  canRsvp: boolean;
  shareCode: string;
  staticName: string;
  viewerTimezone?: string;
  highlightedSessionId: string | null;
  nextSessionHint?: { week: number; occursAt: string } | null; // empty-week hint (plan confirmation 3)
  onJumpToWeek: (week: number) => void;
  onRsvp: (sessionId: string, status: RsvpStatus) => void;
  onEdit: (session: ScheduleSession) => void;
  onDelete: (occ: SessionOccurrence) => void;               // Task 8 branches recurring/plain
  onManageOccurrences: (session: ScheduleSession) => void;
  onAddSession: () => void;
}
```

**Behavior contract:**
- **Display session for recurring occurrences:** `SessionRsvpCard` derives day/time from `session.startTime`, so for an occurrence where `occursAt !== session.startTime`, build `displaySession = { ...session, startTime: occursAt, endTime: new Date(new Date(occursAt).getTime() + (end − start)).toISOString() }` (duration preserved). RSVP/kebab callbacks always use the REAL `session`. (Deliberate — document in the PR body.)
- **Variant:** `next` for the FIRST occurrence with `occursAt >= now` when `isCurrentWeek`; everything else `later`.
- Each card wrapped in `<div id={`schedule-session-${session.id}`} className={highlighted ? 'highlight-pulse rounded-lg' : undefined}>` (legacy anchor parity `ScheduleTab.tsx:171`; `highlight-pulse` = the shared highlight class, loot precedent). Stack: `grid gap-3.5`.
- Card props: `members`, `memberDetail="grid"`, `showDayPill`, `viewerTimezone`, `currentUserRsvp` = the viewer's rsvp status from `session.rsvps` by `currentUserId`, `onRsvp` = `canRsvp ? (status) => onRsvp(session.id, status) : undefined` (viewer → strip omitted, Task 3 case 8), `headerActions` = the kebab.
- **Kebab** (`Dropdown` + `DropdownTrigger asChild` wrapping `IconButton aria-label="Session actions" variant="ghost" size="sm" icon={<MoreVertical size={16}/>}`): items in order — `Edit` (canManage) · `Share` (always) · `Copy for Discord` (always) · `Manage occurrences` (only `session.isRecurring && canManage`) · separator · `Delete` (canManage). Radix items render via portal — tests query `screen`, never `within(row)`.
- **`handleShare(occ)`** (fresh, parity with `SessionCard.tsx:206-225`): lines = `[session.title, '{formatInTimezone(occursAt, session.timezone)} ({duration})']`; `+ RSVP: {a} available, {t} tentative` when tracked and non-zero, or `Availability not required` when tracking off; `+ ${window.location.origin}/group/${shareCode}?tab=schedule&sessionId=${session.id}` (the legacy link form — works on the default route until flip; deliberate, document). Try `navigator.share({ title, text })`, fall back to `navigator.clipboard.writeText(text)` + `toast.success('Copied session details')`.
- **`handleCopyDiscord(occ)`** (fresh, parity with `SessionCard.tsx:93-120`): Discord-markdown lines — `**{title}**`; `> {contentName}` if set; `📅 {time} ({duration})`; `🔁 Recurring weekly` if recurring; `👥 {staticName}`; `> {description}` if set; RSVP summary `✅ N │ ❓ M │ ❌ K` (only non-zero parts) or `Availability not required`; the same `?tab=schedule&sessionId=` link. `navigator.clipboard.writeText` + `toast.success('Copied Discord message')`. Local `formatInTimezone`/`getDurationMinutes`/`formatDuration` helpers — copy the 3 tiny fns from `SessionCard.tsx:31-64` into this file (fresh-audited rewrite; the originals are unexported legacy).
- **Empty state** (`occurrences.length === 0`): `EmptyStateInvite` icon `<CalendarPlus className="h-5 w-5"/>`, title `No sessions this week`, description = canManage ? `Add a session so the team can RSVP.` : `Sessions your leads schedule for this week appear here to RSVP.`, action = canManage ? `{ label: 'Add session', onClick: onAddSession }` : undefined. Below it, when `nextSessionHint`: `<Button variant="ghost" size="sm" onClick={() => onJumpToWeek(hint.week)}>Next session: {new Date(hint.occursAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} — Week {hint.week}</Button>` centered.

- [ ] **Step 1: Write the failing tests** (fixtures reuse the Task 1 `makeSession` pattern; wrap nothing in routers — no router use here; stub `navigator.clipboard.writeText` via `Object.assign(navigator, { clipboard: { writeText: vi.fn() } })`): first-upcoming-in-current-week card renders "Next session" title while the second renders its own title (later variant); `isCurrentWeek={false}` → NO "Next session" title anywhere; recurring occurrence displays the occurrence date, not the base start (fixture: base June, occursAt July → assert July text); highlighted id applies `highlight-pulse` on the wrapper with the `schedule-session-{id}` id; kebab opens (fireEvent.click on "Session actions") → `Edit` fires `onEdit(session)`, `Delete` fires `onDelete(occ)`, `Manage occurrences` present only for recurring+canManage; canManage=false hides Edit/Delete but keeps Share/Copy; `Copy for Discord` writes markdown containing `**Raid**` and `?tab=schedule&sessionId=`; Share (no `navigator.share` in jsdom) falls back to clipboard containing the link; empty list renders the invite + hint button firing `onJumpToWeek(3)`; viewer (`canRsvp={false}`) → no RSVP buttons.
- [ ] **Step 2: Verify failure** → **Step 3: Implement** per the contract → **Step 4: Verify pass** (`pnpm -C frontend test -- --run SessionList`) → **Step 5: Commit** — `git commit -m "feat(schedule): SessionList — week-scoped session cards + kebab actions"`

---

### Task 6: `AvailabilityHeatmap` (read-only aggregate)

The right-region ambient grid (spec §5.4): 7 day columns × 8 prime-hour rows, density = accent color-mix steps, session marks, legend; cells are propose-session buttons when `canManage` (GearBoardCell accessible-span pattern — NOT raw `<button>`). Read-only with respect to availability DATA always.

**Files:**
- Create: `frontend/src/components/schedule/AvailabilityHeatmap.tsx`
- Create: `frontend/src/components/schedule/AvailabilityHeatmap.test.tsx`

**Interfaces:**
- Consumes: `buildHeatMap`, `formatTimeLabel`, `formatDateHeader` from `'./availabilityUtils'` (import-only); `deriveHourlyHeatCells`, `PRIME_HOURS`, `localSlotKeyOf`, type `SessionOccurrence` from `'./scheduleWeek'`; `CardShell`.
- Produces (exact, spec §5.4):
```ts
export interface AvailabilityHeatmapProps {
  data: AvailabilityDateSummary[];          // useAvailabilityStore.data
  members: Membership[];                    // tracked (non-viewer) members
  weekDates: string[];                      // 7 × 'YYYY-MM-DD' from the scoped week (or rolling fallback)
  sessions: Array<{ session: ScheduleSession; occursAt: string }>; // scoped occurrences → session marks
  canManage: boolean;
  onProposeSession?: (draft: ScheduleSessionCreate) => void; // prefilled start/end; opens CreateSessionModal
}
```

**Rendering contract:**
- `CardShell as="div" title="Team availability"` with `headerRight` = `<span className="text-xs text-text-tertiary">{members.length} raiders</span>`.
- Note line (`text-xs text-text-tertiary mb-2`): when the derived heat cells are ALL zero-count → the exact empty-data string `No availability marked yet. Set yours via “Your availability” below — the picture fills in as members add theirs.`; otherwise `Aggregated from each member's availability · darker = more free.` + (canManage ? ` Click a slot to propose a session.` : ``).
- Derivation: `const heat = useMemo(() => buildHeatMap(data), [data]); const rows = useMemo(() => deriveHourlyHeatCells(heat, weekDates), [heat, weekDates]);` `total = members.length`.
- Grid: `grid` with `gridTemplateColumns: '44px repeat(7, minmax(0, 1fr))'`; header row = empty corner + 7 `formatDateHeader(date).day` labels (`text-xs text-text-tertiary text-center`); each hour row = `formatTimeLabel(`${hh}:00`)` shortened to e.g. `6 PM` (strip `:00`) + 7 cells.
- **Cell:** density step from `r = total > 0 ? count / total : 0`: `r === 0` → class `bg-surface-card border border-border-subtle`, no inline bg; else inline `style.background = `color-mix(in srgb, var(--color-accent) ${STEP}%, var(--color-surface-card))`` with `STEP` = `r >= 1 ? 70 : r >= 0.75 ? 45 : r >= 0.5 ? 28 : r >= 0.25 ? 16 : 8` (the F1/F6d-sanctioned token color-mix — no new tokens). Full-count cells (`count === total && total > 0`) render the count as `text-xs font-bold text-text-primary` centered; other cells no text. Base classes `h-7 rounded-[4px]`.
- **Session mark:** build `const scheduledKeys = useMemo(() => new Set(sessions.flatMap(({ session, occursAt }) => { /* iterate viewer-local hours from occursAt to session end (duration from session.endTime − session.startTime, cap 12h), emitting localSlotKeyOf of each hour top */ })), [sessions]);` — a cell is marked when `scheduledKeys.has(`${cell.date}|${String(cell.hour).padStart(2,'0')}:00`)`. Marked cells add inline `boxShadow: 'inset 0 0 0 2px var(--color-accent-hover)'` + `data-scheduled="true"`.
- **Interactivity:** when `canManage && onProposeSession` — each cell is an accessible span (GearBoardCell pattern): `role="button"`, `tabIndex={0}`, `onClick` + Enter/Space `onKeyDown`, `className += ' cursor-pointer'`, `aria-label` = `` `${formatDateHeader(cell.date).day} ${formatTimeLabel(hh+':00')} — ${cell.count} of ${total} free` `` (e.g. "Tue 8:00 PM — 6 of 8 free"). Click → `onProposeSession({ title: 'Raid session', startTime, endTime, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, isRecurring: false })` where `startTime` = the cell's viewer-local `date + hour` as ISO (`new Date(y, m-1, d, hour).toISOString()`) and `endTime` = +2h. Otherwise cells are inert `<div>` with `title={cell.names.join(', ') || undefined}` (hover name-list parity with legacy).
- **Legend** (`flex items-center gap-2 mt-2 text-xs text-text-tertiary`): `Fewer free` + 5 density swatches (the same 5 color-mix steps, `h-2.5 w-2.5 rounded-sm`) + `All {total}` + separator + a swatch with the scheduled inset ring + `scheduled`.
- Viewer-local everywhere (§2.g); no timezone label on the grid.

- [ ] **Step 1: Write the failing tests.** TZ-safe seeding: build `data` via `localSlotToUtc` (import from `'./availabilityUtils'` in the TEST) so slots land at known viewer-local hours regardless of the runner's TZ — e.g. `const { utcDate, utcTime } = localSlotToUtc('2026-07-07', '19:00')` (+ the `19:30` sibling) → `data = [{ date: utcDate, responses: [{ id: '1', userId: 'u1', username: 'Alice', date: utcDate, slots: [utcTime, utcTime30] }] }]`. Cases: a cell with both half-slots gets a color-mix background style and its aria/name-list reflects count 1; full-count cell (all members) shows the count number; empty data renders the exact empty-copy string; canManage cells expose `role="button"` with the composed aria-label and click fires `onProposeSession` with a 2h draft (`assert startTime/endTime 2h apart, isRecurring false`); canManage=false renders no `role="button"` cells (inert divs with title); a session occurrence at a known local hour marks the matching cell (`data-scheduled="true"`); legend renders `Fewer free`, `All 1`, `scheduled`.
- [ ] **Step 2: Verify failure** → **Step 3: Implement** → **Step 4: Verify pass** (`pnpm -C frontend test -- --run AvailabilityHeatmap`) → **Step 5: Commit** — `git commit -m "feat(schedule): AvailabilityHeatmap — read-only team availability aggregate"`

---

### Task 7: `BestTimesCard` + `PersonLayerEntryPoint`

The two remaining aside cards (spec §5.4 tail + §5.5). Both presentational.

**Files:**
- Create: `frontend/src/components/schedule/BestTimesCard.tsx`, `frontend/src/components/schedule/PersonLayerEntryPoint.tsx`
- Create: `frontend/src/components/schedule/BestTimesCard.test.tsx` (covers both)

**Interfaces:**
- Consumes: `AvailabilityRecommendation` type from `'./availabilityUtils'` (`{ id: '${date}|${HH:MM}|${duration}'; startIso; endIso; availableCount; totalMembers; … }`), `CardShell`, `ProgressBar`, `Select` (ui), `Button`.
- Produces (exact, spec §5.4/§5.5):
```ts
export interface BestTimesCardProps {
  recommendations: AvailabilityRecommendation[];
  durationMinutes: number;
  onDurationChange: (m: number) => void;
  scheduledSlotIds?: Set<string>;   // viewer-local 'YYYY-MM-DD|HH:MM' start keys of scoped occurrences
  canManage: boolean;
  onProposeSession?: (rec: AvailabilityRecommendation) => void;
}
export interface PersonLayerEntryPointProps {
  title: string; description: string; actionLabel: string; onAction: () => void; icon?: ReactNode;
}
```

**`BestTimesCard` contract:** `CardShell as="div" title="Best times this week"`, `headerRight` = `Select aria-label="Session length"` with options `[{value:'60',label:'1h'},{value:'90',label:'1.5h'},{value:'120',label:'2h'},{value:'150',label:'2.5h'},{value:'180',label:'3h'}]` (legacy `DURATION_OPTIONS` parity, `AvailabilityRecommendations.tsx:10-16`), `value={String(durationMinutes)}`, `onChange={(v) => onDurationChange(Number(v))}`. Body: up to 3 rows (the util already caps at 3); each row `flex items-center gap-2`: when-label `text-xs font-medium text-text-primary w-24 shrink-0` = `new Date(rec.startIso).toLocaleDateString('en-US', { weekday: 'short' })` + `toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })` (**viewer-local** — §2.g; the retired reference-timezone model is NOT used) · `ProgressBar value={rec.availableCount / Math.max(1, rec.totalMembers)} className="flex-1"` · `text-xs text-text-tertiary` `"{n}/{N}"` (+ `<span className="text-xs text-text-tertiary"> · scheduled</span>` when `scheduledSlotIds?.has(rec.id.split('|').slice(0, 2).join('|'))`). When `canManage && onProposeSession`, the row is a full-width ghost `Button size="sm"` wrapping that flex content (`aria-label` = `Propose session {when}`), click → `onProposeSession(rec)`; else a plain `div`. Empty recommendations → `text-xs text-text-tertiary` line `Not enough availability data yet.`. Confidence labels + "Copy proposal to Discord" are DROPPED (spec §6.2 row 13).

**`PersonLayerEntryPoint` contract:** `CardShell as="div"` (no title) wrapping `flex items-center gap-3`: icon medallion `<div aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border-default text-accent" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-base))' }}>{icon ?? <CalendarClock size={16} />}</div>` · text zone (`min-w-0`): `text-sm font-medium text-text-primary` title + `text-xs text-text-tertiary` description · `ml-auto` `Button variant="ghost" size="sm"` with `actionLabel` — **no trailing arrow/glyph** (DS §4.1). Generic — Schedule's instance (Task 8) passes title `Your availability`, the honest transition copy `Your typical week lives on your profile — leads pull it into this static's grid.` (spec §2.c — NOT the mockup's aspirational copy), actionLabel `Edit`, onAction → `/profile?tab=availability`.

- [ ] **Step 1: Write the failing tests:** rows render in the util's given order (fixture recs with counts 8,7,5 → assert DOM order preserved, no re-sorting); `8/8` text + progressbar `aria-valuenow` where labeled (pass ariaLabel? — ProgressBar here is decorative, assert via `progress-fill` width style instead); `· scheduled` renders only for the rec whose `date|HH:MM` prefix is in `scheduledSlotIds`; duration Select change fires `onDurationChange(90)` (number); canManage rows are buttons firing `onProposeSession(rec)`; canManage=false → no row buttons; empty recs → `Not enough availability data yet.`; PersonLayerEntryPoint renders title/description and its button fires `onAction`, and the button text is exactly the actionLabel (no `→`).
- [ ] **Step 2: Verify failure** → **Step 3: Implement** → **Step 4: Verify pass** (`pnpm -C frontend test -- --run BestTimesCard`) → **Step 5: Commit** — `git commit -m "feat(schedule): BestTimesCard + PersonLayerEntryPoint"`

---

### Task 8: `Schedule` assembly — fetch topology, deep link, modals, empty states [opus]

The screen composition (spec §5.6): single fetcher, scoped week, two-region layout, modal host, `?sessionId=` parity. This is the file the slot mounts.

**Files:**
- Create: `frontend/src/components/schedule/Schedule.tsx`
- Create: `frontend/src/components/schedule/Schedule.test.tsx`

**Interfaces:**
- Consumes: Tasks 1/4/5/6/7 components + utils; `SessionRsvpCard` indirectly via SessionList; `useWeekClock`; `useScheduleStore`, `useAvailabilityStore`; `getUtcDateRange`, `getNextNDates`, `computeAvailabilityRecommendations` from `'./availabilityUtils'`; `computeNextOccurrence`, `getOccurrenceDateKey` from `'../../utils/recurrence'`; `CreateSessionModal`, `OccurrenceListModal` (import-only, unmodified); `ConfirmModal`, `Modal` from ui; `TwoRegionDashboard`, `PageHeader`; `getTierById`; `toast`; `useSearchParams`, `useNavigate` (react-router); `useModal`.
- Produces: `export function Schedule(props: ScheduleProps)` with (exact, spec §5.6):
```ts
export interface ScheduleProps {
  group: StaticGroup;
  tier: TierSnapshot | null;
  canManage: boolean;          // owner | lead | adminAccess (session CRUD + propose + occurrences)
  currentUserId: string | null;
}
```

**Behavior contract (implement top to bottom; every point is binding):**
1. **Root:** `<div data-testid="schedule-screen">` wrapping `PageHeader icon={<Calendar size={14} className="text-accent" />} title="Schedule" subtitle="This week's sessions and when everyone's free · the same week drives loot"`, then `WeekNavigatorStrip`, then `TwoRegionDashboard main={<SessionList …/>} side={<div className="grid gap-3.5"><AvailabilityHeatmap …/><BestTimesCard …/><PersonLayerEntryPoint …/></div>}`, then the modals. If `!group` guard is unnecessary (slot only built with a group), but keep `tier` nullable-safe (`tierLabel = tier ? getTierById(tier.tierId)?.name : undefined`).
2. **Clock + scope:** `const clock = useWeekClock(group.id, tier?.tierId);` `const [scopedWeekOverride, setScopedWeekOverride] = useState<number | null>(null); const scopedWeek = scopedWeekOverride ?? clock.currentWeek;` (Loot pattern — follows the clock until the user steps; NOT URL-synced, spec §5.6).
3. **Week dates:** `const range = clock.rangeOfWeek(scopedWeek);` `const weekDates = useMemo(() => range ? Array.from({ length: 7 }, (_, i) => new Date(range.start.getTime() + i * 86_400_000).toISOString().slice(0, 10)) : getNextNDates(7), [range?.start.getTime()]);` — anchored weeks use the UTC calendar dates of the range; null anchor falls back to the rolling window (§2.a).
4. **Fetches (the fixed topology, §2.j.3):** mount/group-change → `void fetchSessions(group.id)`; scoped-week change → `const { startDate, endDate } = getUtcDateRange(weekDates); void fetchAvailability(group.id, startDate, endDate);` (effect deps `[group.id, weekDates.join(','), fetchAvailability]` via a joined key). **NO `clearSessions()` anywhere** (add a comment: legacy's unmount-clear wipes Home's copy of the shared store — deliberately not replicated).
5. **Cancelled exceptions (plan confirmation 1):** `const recurringKey = useMemo(() => sessions.filter(s => s.isRecurring && s.recurrenceRule).map(s => s.id).sort().join(','), [sessions]);` effect on `[group.id, recurringKey]`: when empty → `setCancelledBySession(new Map())`; else `Promise.all(ids.map(async (id) => { try { const ex = await useScheduleStore.getState().fetchExceptions(group.id, id); return [id, new Set(ex.filter(e => e.type === 'cancelled').map(e => e.occurrenceDate))] as const; } catch { return [id, new Set<string>()] as const; } }))` → `setCancelledBySession(new Map(entries))` guarded by an `alive` flag. (`getState()` inside the effect keeps the dep array honest.)
6. **Derivations:** `occurrences = useMemo(() => range ? sessionOccurrencesInRange(sessions, range, cancelledBySession) : sessions.filter(upcoming non-recurring OR recurring-next within today+6d — SIMPLER: for the null-anchor case pass a synthetic range { start: startOfToday, end: +6d } to sessionOccurrencesInRange), …)` — implement the null-anchor case as `sessionOccurrencesInRange(sessions, { start: todayMidnightLocal, end: +6d }, cancelledBySession)` so both paths share one code path. `recurringSummary = deriveRecurringSummary(sessions)`. `nextSessionHint = occurrences.length === 0 && range ? findNextSessionWeek(sessions, clock.rangeOfWeek, scopedWeek, clock.currentWeek + 12, cancelledBySession) : null`. `members = useMemo(() => (group.members ?? []).filter(m => m.role !== 'viewer'), [group.members])`; `gridMembers = members.map(m => ({ userId: m.userId, username: m.user?.displayName ?? m.user?.discordUsername ?? null }))`. `canRsvp = !!currentUserId && !!group.userRole && group.userRole !== 'viewer'` (legacy `ScheduleTab.tsx:212` parity). `scheduledSlotIds = new Set(occurrences.map(o => localSlotKeyOf(o.occursAt)))`. `const [durationMinutes, setDurationMinutes] = useState(120);` `recommendations = useMemo(() => computeAvailabilityRecommendations(data, members, weekDates, durationMinutes), [data, members, weekDates, durationMinutes])`.
7. **RSVP:** `handleRsvp = async (sessionId, status) => { try { await submitRsvp(group.id, sessionId, status); } catch { toast.error('Failed to save RSVP'); } }` (store upserts locally on success).
8. **`?sessionId=` deep link (legacy parity `ScheduleTab.tsx:154-179`):** `const [searchParams] = useSearchParams();` `handledRef = useRef<string | null>(null)`; `[highlightedSessionId, setHighlightedSessionId] = useState<string | null>(null)`. Effect on `[sessions, searchParams, cancelledBySession, clock.weekStartDate, clock.currentWeek]`: read `sessionId`; bail unless present, resolvable in `sessions`, and `handledRef.current !== sessionId`; mark handled; compute the target instant — recurring → `computeNextOccurrence(startTime, recurrenceRule, new Date(), cancelledBySession.get(id), timezone)?.toISOString() ?? startTime`, else `startTime`; `const week = weekOfDate(clock.weekStartDate, instant); if (week != null) setScopedWeekOverride(Math.min(week, clock.currentWeek + 12));` set highlight; `setTimeout(50)` → `document.getElementById(`schedule-session-${sessionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })`; `setTimeout(5000)` → clear highlight (return the cleanup clearing the timer).
9. **Create/edit modal:** `createModal = useModal()`, `[editSession, setEditSession]`, `[createDraft, setCreateDraft]`. Open paths: strip "Add session"/empty-state action → `setEditSession(null); setCreateDraft(null); createModal.open()`; kebab Edit → `setEditSession(session); setCreateDraft(null); createModal.open()`; propose (heatmap cell / best-times row) → `setCreateDraft(draft); setEditSession(null); createModal.open()` — best-times rec converts via `{ title: 'Raid session', description: `${rec.availableCount}/${rec.totalMembers} available in this window.`, startTime: rec.startIso, endTime: rec.endIso, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, isRecurring: false }` (viewer-local one-off — the legacy recurring/reference-tz draft is deliberately not reproduced, §2.g; document). Render **conditionally** — `{createModal.isOpen && (<CreateSessionModal isOpen onClose={closeCreate} onSubmit={handleSubmit} editSession={editSession} initialDraft={createDraft} />)}` — the modal's form state initializes once from props (verified `CreateSessionModal.tsx:110-149`). `handleSubmit = async (data) => { try { if (editSession) { await updateSession(group.id, editSession.id, data); toast.success('Session updated'); } else { await createSession(group.id, data); toast.success('Session created'); } closeCreate(); } catch { toast.error('Failed to save session'); } }` (store rethrows; keep the modal open on failure by only closing in the try).
10. **Delete flow (feature-audit row 4 parity):** `[deleteChoice, setDeleteChoice] = useState<SessionOccurrence | null>(null)` (recurring) + `[confirmDelete, setConfirmDelete] = useState<ScheduleSession | null>(null)`. `handleDelete(occ)` → recurring ? `setDeleteChoice(occ)` : `setConfirmDelete(occ.session)`. Choice UI = `Modal` (ui) titled `Delete recurring session` with two `Button`s: `Cancel just this occurrence` (variant secondary) → `createException(group.id, session.id, { occurrenceDate: getOccurrenceDateKey(occ.occursAt, session.timezone), type: 'cancelled' })` → `toast.success('Occurrence cancelled')` + update `cancelledBySession` locally (clone the map, add the key) + close; `Delete entire series` (variant danger) → `setConfirmDelete(session)` + close choice. `ConfirmModal` (danger, title `Delete session`, message names the session title, confirmLabel `Delete`) → `deleteSession(group.id, id)` + toast + close. **v2 cancels the RENDERED occurrence** (not legacy's "next occurrence") — an improvement; document in PR body.
11. **Manage occurrences:** `[occurrenceSession, setOccurrenceSession]`; kebab → set; render `{occurrenceSession && <OccurrenceListModal isOpen onClose={() => { setOccurrenceSession(null); /* refetch exceptions: bump a refresh counter included in the exceptions-effect deps */ }} session={occurrenceSession} groupId={group.id} canManage={canManage} />}` — on close, re-run the exceptions effect (add a `[exceptionsRefresh, setExceptionsRefresh]` counter to its deps) so cancellations made in the modal reflect in the week list.
12. **Aside instances:** `AvailabilityHeatmap data={data} members={members} weekDates={weekDates} sessions={occurrences} canManage={canManage} onProposeSession={handlePropose}`; `BestTimesCard recommendations={recommendations} durationMinutes={durationMinutes} onDurationChange={setDurationMinutes} scheduledSlotIds={scheduledSlotIds} canManage={canManage} onProposeSession={handleProposeRec}`; `PersonLayerEntryPoint title="Your availability" description="Your typical week lives on your profile — leads pull it into this static's grid." actionLabel="Edit" onAction={() => navigate('/profile?tab=availability')}`.
13. **SessionList instance:** `occurrences`, `isCurrentWeek={clock.isCurrent(scopedWeek)}`, `members={gridMembers}`, `currentUserId`, `canManage`, `canRsvp`, `shareCode={group.shareCode}`, `staticName={group.name}`, `highlightedSessionId`, `nextSessionHint`, `onJumpToWeek={(w) => setScopedWeekOverride(w)}`, `onRsvp={handleRsvp}`, `onEdit`, `onDelete={handleDelete}`, `onManageOccurrences={setOccurrenceSession}`, `onAddSession={openCreate}`.

- [ ] **Step 1: Write the failing tests** (`Schedule.test.tsx`, wrap in `MemoryRouter`; **stub every fetch ACTION** — the CI ECONNREFUSED class):
```tsx
beforeEach(() => {
  useScheduleStore.setState({
    sessions: [/* fixtures */], settings: null, isLoading: false, error: null,
    fetchSessions: vi.fn(), fetchExceptions: vi.fn(async () => []),
    submitRsvp: vi.fn(async () => {}), createSession: vi.fn(async () => {}),
    updateSession: vi.fn(async () => {}), deleteSession: vi.fn(async () => {}),
    createException: vi.fn(async () => ({}) as never),
  } as never);
  useAvailabilityStore.setState({ data: [], fetchAvailability: vi.fn() } as never);
  useLootTrackingStore.setState({ currentWeek: 2, maxWeek: 2, weekStartDate: '2026-06-23' } as never);
});
```
Group fixture: `{ id: 'g1', name: 'Test Static', shareCode: 'DEVTST', settings: {}, userRole: 'owner', members: [{ id: 'm1', userId: 'u1', staticGroupId: 'g1', role: 'owner', joinedAt: '', user: { displayName: 'Alice' } }] }`. Cases:
  - mounts: `schedule-screen` testid, PageHeader subtitle text, `fetchSessions` called once with `'g1'`, `fetchAvailability` called with a padded UTC range around week 2's dates.
  - stepping the week (fireEvent ‹) calls `fetchAvailability` again with week-1 dates (assert the mock's 2nd call args differ).
  - a session inside week 2 renders its card; a session in week 3 does NOT, and the empty state (with the week-3 session as the only session) shows the hint `— Week 3` whose click re-renders with that session's card visible.
  - `?sessionId=` deep link (`initialEntries: ['/?sessionId=s3']`, session s3 in week 3): scoped week jumps (s3's card renders) and its wrapper has `highlight-pulse` (use `vi.useFakeTimers()` for the 5000ms clear if asserted).
  - recurring sessions trigger `fetchExceptions` once per recurring id; non-recurring-only lists trigger none.
  - viewer (`userRole: 'viewer'`, `currentUserId: 'u1'`) → no RSVP buttons; RSVP click as owner calls `submitRsvp('g1', sessionId, 'available')`.
  - `canManage={false}` hides "Add session" (strip + empty state).
  - NO `clearSessions` on unmount: `const clearSessions = vi.fn()` in setState; unmount the render; expect not called.
- [ ] **Step 2: Verify failure** → **Step 3: Implement** per the 13-point contract → **Step 4: Verify pass** — `pnpm -C frontend test -- --run "Schedule\.test"` then the schedule sweep `pnpm -C frontend test -- --run "components/schedule"` (all Task 1–8 files green).
- [ ] **Step 5: Commit** — `git commit -m "feat(schedule): Schedule assembly — two-region screen, fetch topology, deep link, modals"`

---

### Task 9: `schedule` slot wiring in `NewShell` + slot regression test → BROWSER VALIDATION checkpoint

Mirror the F6d gear-slot wiring: `ShellContent` builds the `schedule` slot; `GroupViewContent` already renders `slots?.schedule ?? (legacy)` at `:1060` — **no GroupViewContent edit**. `NewShell.tsx` is v2-owned (pages) — freely editable.

**Files:**
- Modify: `frontend/src/pages/NewShell.tsx`
- Create: `frontend/src/pages/NewShell.schedule.test.tsx`

**Interfaces:**
- Consumes: `Schedule` (Task 8 props `{ group; tier; canManage; currentUserId }`); `useAuthStore`/`useViewAsStore` (effectiveUserId derivation, `Loot.tsx:161-163` precedent).
- Produces: `slots={{ overview, roster, gear: loot, schedule }}`.

- [ ] **Step 1: Write the failing test** — copy `frontend/src/pages/NewShell.gear.test.tsx` as `NewShell.schedule.test.tsx` and adapt: `makeState()` pins `pageMode: 'schedule'` (keep every other key — GroupViewContent reads them); keep ALL existing store/hook/context mocks verbatim; swap the heavy-leaf stubs: keep `Home`/`Roster`/`Loot` stubs, add `vi.mock('../components/schedule/Schedule', () => ({ Schedule: () => <div data-testid="v2-schedule" /> }));` `vi.mock('../components/schedule/ScheduleUpcomingPanel', () => ({ ScheduleUpcomingPanel: () => <div data-testid="legacy-upcoming" /> }));` `vi.mock('../components/schedule', () => ({ ScheduleTab: () => <div data-testid="legacy-schedule-tab" /> }));` (the barrel exports only `ScheduleTab`; `ScheduleUpcomingPanel` is imported by concrete path — mock BOTH paths; verify the actual import specifiers at the top of `GroupViewContent.tsx` with `rg "ScheduleUpcomingPanel|ScheduleTab" frontend/src/pages/GroupViewContent.tsx -n | head -5` and match them). Assertions:
```tsx
it('mounts the v2 <Schedule/> as the schedule slot and hides the legacy switcher', () => {
  renderShell();
  expect(screen.getByTestId('v2-schedule')).toBeInTheDocument();
  // Legacy Upcoming|Calendar switcher + panels absent (the ?? fallback never renders):
  expect(screen.queryByRole('button', { name: 'Upcoming' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Calendar' })).not.toBeInTheDocument();
  expect(screen.queryByTestId('legacy-upcoming')).not.toBeInTheDocument();
  expect(screen.queryByTestId('legacy-schedule-tab')).not.toBeInTheDocument();
});
```
- [ ] **Step 2: Run to verify RED** — `pnpm -C frontend test -- --run NewShell.schedule` → FAIL (legacy-upcoming testid renders; v2 testid absent).
- [ ] **Step 3: Implement** in `NewShell.tsx` `ShellContent`: add imports `import { Schedule } from '../components/schedule/Schedule'; import { useAuthStore } from '../stores/authStore'; import { useViewAsStore } from '../stores/viewAsStore';` then inside `ShellContent`:
```tsx
  // F6e: effective viewer identity for the schedule slot (Roster/Loot precedent).
  const user = useAuthStore((s) => s.user);
  const viewAsUser = useViewAsStore((s) => s.viewAsUser);
  const effectiveUserId = viewAsUser ? viewAsUser.userId : user?.id;

  // F6e: in v2 the `schedule` tab is the redesigned <Schedule/> screen, injected
  // as the `schedule` slot — mirroring overview/roster/gear above. The legacy
  // route passes no slots, so GroupViewContent renders the entire legacy
  // schedule body (switcher + ScheduleUpcomingPanel/ScheduleTab) byte-for-byte.
  const schedule = currentGroup ? (
    <Schedule
      group={currentGroup}
      tier={currentTier}
      canManage={canManage}
      currentUserId={effectiveUserId ?? null}
    />
  ) : undefined;
```
and extend the return: `slots={currentGroup ? { overview, roster, gear: loot, schedule } : undefined}`.
- [ ] **Step 4: Run to verify GREEN** — `pnpm -C frontend test -- --run "NewShell"` (schedule + gear + roster + slot tests ALL green).
- [ ] **Step 5: Commit** — `git commit -m "feat(shell): schedule slot wiring in NewShell + slot regression test"`
- [ ] **Step 6 (orchestrator checkpoint — not an implementer step):** BROWSER VALIDATION pass 1 per the post-plan checklist (backend :8001 + frontend :5174, dev-auth `/api/dev-auth/login/0` → `/group/DEVTST?shell=v2`, Schedule tab). Log findings in the ledger before dispatching Task 10.

---

### Task 10: Contrast harness schedule block + suppressions no-op verify

Re-enable the contrast harness scoped to the v2 schedule screen (spec §1 housekeeping; F6c/F6d pattern). Fix any real failure at the token/class level in v2 files — NEVER by excluding. Also verifies the `ScheduleUpcomingPanel` light-mode debt is *bypassed* (v2 never mounts it — the scoped include can't see it).

**Files:**
- Modify: `frontend/e2e/contrast.spec.ts` (append a schedule block after the loot block)

- [ ] **Step 1: Add the schedule block** — mirror the loot block (`contrast.spec.ts:238-262`) exactly, adjusted: navigate `${FRONTEND_BASE}/group/${DEV_SHARE_CODE}?shell=v2&tab=schedule`; `page.locator('[data-testid="schedule-screen"]').waitFor({ timeout: 15_000 })`; `waitForLoadState('networkidle')` + 300ms settle; single axe pass per theme (`include('[data-testid="schedule-screen"]')`, `withRules(['color-contrast'])`) — the v2 Schedule has NO view toggle (spec §2.f), so unlike Roster/Loot there is no second view click. Both themes via the `for (const theme of THEMES)` loop. Header comment noting: no excludes expected (all-new token-clean code; the harness never opens modals so the reused legacy `CreateSessionModal`/`OccurrenceListModal` surfaces are never in scope; the legacy `ScheduleUpcomingPanel` light-mode debt from FOUNDATION_ROADMAP §3.1 is bypassed — its replacement never mounts it).
- [ ] **Step 2: Run it** — backend :8001 + frontend :5174 running (orchestrator ensures), then `pnpm -C frontend exec playwright test e2e/contrast.spec.ts` → ALL green including the existing roster + loot blocks. If axe flags a real v2 pairing, fix it token/class-level in the Task 4–8 files (mirror the F6d component-level fix pattern documented in the file header) and update any unit test asserting the changed class.
- [ ] **Step 3: Suppressions housekeeping** — `pnpm -C frontend lint` then `git diff --stat frontend/eslint-suppressions.json` → empty. Record for the PR body: zero `components/schedule/` entries existed (the legacy files' debt is inline `eslint-disable` comments that stay with them until flip-time deletion); the one availability-adjacent entry (`src/components/profile/PersonalAvailabilityEditor.tsx`) is Person-layer and stays — the prune is a **verified no-op**.
- [ ] **Step 4: Commit** — `git commit -m "test(e2e): contrast harness re-enabled on the v2 schedule screen (both themes)"`

---

### Task 11: Release note + DESIGN_SYSTEM.md contracts + full gate + fold-ins

**Files:**
- Modify: `frontend/src/data/releaseNotes.ts`
- Modify: `design/redesign/DESIGN_SYSTEM.md`
- Possibly touched by fold-ins: files from earlier tasks

- [ ] **Step 1: Release note** — append to the existing `version: 'UNRELEASED'` entry's `items` array (do NOT create a new version entry, do NOT bump `CURRENT_VERSION` — stays `2.0.2`), matching the F6a/F6b item shape already in the file:
```ts
      {
        internal: true,
        category: 'improvement',
        title: 'F6e — redesigned Schedule (behind ?shell=v2)',
        description:
          'New two-region Schedule: week-scoped sessions with an RSVP member grid on the shared week clock, a read-only team availability heatmap with best-times recommendations, and a Person-layer availability entry point — wired as the v2 schedule slot. Legacy Schedule unchanged.',
        pr: 0,
        prTitle: 'feat(redesign): f6e-schedule — v2 Schedule behind ?shell=v2',
      },
```
(`pr: 0` is backfilled at PR-open time by the orchestrator.)
- [ ] **Step 2: DESIGN_SYSTEM.md contracts (spec §11.6 — ONLY what F6e builds/changes; the F6c/F6d backfill is explicitly out of scope, handed to parity-flip housekeeping):**
  - Insert new sections after §3.23 (before `## 4.` at `:368`), each in the established anatomy/props/states/a11y/usage format: **§3.24 WeekNavigatorStrip — F6e** (props from Task 4; one clock two presentations — mutations stay in `WeekScopeControl`; null-anchor degradation); **§3.25 AvailabilityHeatmap — F6e** (props from Task 6; density = accent color-mix steps 8/16/28/45/70% over `surface-card`; conservative hourly aggregation; cells read-only w.r.t. data, propose-only when canManage; aria-label per cell); **§3.26 BestTimesCard — F6e** (props from Task 7; viewer-local display; confidence labels/Discord copy dropped); **§3.27 PersonLayerEntryPoint — F6e** (generic link-card props; no trailing glyph per §4.1).
  - Update **§3.19 PlayerIdentity**: `'board-cell'` note is stale (BUILT F6c) — fix in passing since the section is already being touched for `'rsvp-row' — BUILT F6e (24px avatar + text-xs name; identity only, status stays parent-owned)`.
  - Update **§3.23 SessionRsvpCard**: `'later'` → BUILT F6e (neutral border, ghost unanswered buttons, title = session title); document the new optional props (`members`/`memberDetail`/`headerActions`/`showDayPill`), the `trackAvailability === false` note, and the members-gated warning note.
  - Update **§3.8** "Still proposals" line (`:210`): remove **availability heatmap** (now contracted §3.25); "match-score listing (Finder)" remains.
- [ ] **Step 3: Cheap fold-ins** (each only if genuinely ≤ ~10 lines; otherwise report as deferred): any Minor the per-task reviews routed here; test-debt one-liners flagged "fold into Task 11 if cheap".
- [ ] **Step 4: Full gate** — from `frontend/`: `pnpm build` · `pnpm lint` (0 errors) · `pnpm check:design-system:strict` · `pnpm test` · `pnpm tokens:check`; repo root: `git diff --check`; `cd scripts && npm test`. ALL green.
- [ ] **Step 5: Commit** — `git commit -m "chore(release-notes): f6e-schedule internal entry + DESIGN_SYSTEM contracts + gate fold-ins"`

---

## Post-plan process (orchestrator, not tasks)

**Browser validation (after Task 9 = first full mount, and again pre-PR; spec §8):** dev-auth `/api/dev-auth/login/0` → `/group/DEVTST?shell=v2` → Schedule tab: strip steps weeks and its date ranges match Loot's `WeekScopeControl` for the same week number; RSVP round-trips (button → grid glyph + counts update, persists on reload); add-session → appears in the list AND as a heatmap session mark; heatmap counts match availability painted on the legacy grid; heatmap cell-click + best-times row prefill `CreateSessionModal` correctly (canManage only); entry point lands on `/profile?tab=availability`; `?sessionId=` deep link scopes + scroll-highlights; kebab Share/Copy produce working links; recurring delete choice cancels the rendered occurrence (it disappears from the week); **fresh/null-anchor static** shows the degraded "This week" strip without errors; legacy `/group/DEVTST` schedule (Upcoming AND Calendar views) byte-for-byte; 0 console errors.

**Screenshots (PR rule — copy out of the session scratchpad, commit under `docs/redesign/pr-shots/`, embed via raw URLs pinned to the commit SHA):** full Schedule two-region view dark + light; the member grid on a next-session card; the heatmap with a session mark + legend (light theme especially); the empty-week state with the next-session hint; the null-anchor strip.

**PR body must document (spec §2 locked decisions + §7 divergences + plan-time deltas):** week-scoped session list = the raid week (§2.a; ratify item 1) with the empty-week hint mitigation; `1.85fr` adopted over the mockup's `1.7fr` (§2.b); heatmap = Ring-0 read-only aggregate, editing deferred to Person layer with the flip blocker (§2.c, §6.3); status-colored RSVP semantics + the plan-time glyph-not-ring refinement (this plan's header); the two sanctioned `SessionRsvpCard` default-render deltas (next-variant accent ring; trackAvailability-off note) and the members-gated viewer strip omission; recurring cancel acts on the RENDERED occurrence (improvement over legacy's next-occurrence); share/Discord links keep the legacy `?tab=schedule&sessionId=` form until flip; propose-session drafts are viewer-local one-offs (reference-timezone model retired, §2.g); confidence labels + Discord-proposal copy dropped from BestTimesCard (§6.2 row 13; ratify item 4); honest PersonLayerEntryPoint copy (§2.c; ratify item 5); the no-`clearSessions` fetch topology (§2.j.3); suppressions prune = verified no-op; mockup fidelity divergences list (spec §7).

**Decisions to ratify (append to the SESSION_HANDOFF holistic list):** spec §11 items 1–9 verbatim, plus plan-time additions: (a) the rsvp-row status-glyph composition, (b) the empty-week next-session hint, (c) the `currentWeek + 12` forward cap.

## Self-review (done at write time)

- **Spec coverage sweep:** §1 scope/slot → T8/T9; §2.a week-is-raid-week + null anchor → T1/T4/T8; §2.b ratio → T8 (TwoRegionDashboard as-is); §2.c heatmap Ring-0 + entry point + honest copy → T6/T7/T8; §2.d availabilityUtils import-only → T1/T6 (zero edits); §2.e session history OUT → no task (deliberate); §2.f no SegmentedToggle/no view URL state → T8 (only `?sessionId=` read); §2.g timezone rules → T3 (session tz), T4 (range), T6/T7 (viewer-local), reference-tz retired → T7/T8; §2.h status-colored → T3; §2.i rsvp-row minimal → T2; §2.j.1 one PR → plan; §2.j.2 kebab → T5/T8; §2.j.3 fetch topology → T8; §2.j.4 hourly prime window → T1/T6; §2.j.5 recurring chip → T1/T4; §2.j.6 trackAvailability note → T3; §5.1–§5.6 contracts → T4/T3/T2/T6+T7/T7/T8 (signatures character-matched); §6.2 rows 1–21 → rebuilt (T3/T5/T8), reused (T8 modals), re-homed (T7 entry point), retired/deferred (no tasks — documented); §8 tests → per-task + T9 slot + T10 harness; §9 cut order → Global Constraints; §12 facts → restated in the header block.
- **Placeholder scan:** Tasks 4–8 use behavior-contract + exact-string style for rendering (every string, class family, threshold, and callback pinned); Tasks 1–3 carry complete code/tests. No TBDs remain.
- **Type consistency:** `SessionOccurrence`/`HeatCell`/`PRIME_HOURS`/`localSlotKeyOf` defined once (T1), consumed by T5/T6/T8; `SessionRsvpCardProps` (T3) matches T5's card usage; `WeekNavigatorStripProps` (T4) matches T8's instance; `AvailabilityHeatmapProps`/`BestTimesCardProps`/`PersonLayerEntryPointProps` (T6/T7) match T8's instances and the spec §5.4/§5.5 signatures character-for-character; `ScheduleProps` (T8) matches T9's call site.
- **Fixed inline during review:** the §5.2 "status-ringed avatar wrapping PlayerIdentity" impossibility → resolved as the header refinement (glyph beside identity); the recurring-occurrence display-time gap (SessionRsvpCard reads `session.startTime`) → the T5 `displaySession` rule; `border-accent` vs CardShell border-class collision → `ring-1 ring-accent/40`; heatmap test TZ-dependence → the `localSlotToUtc` seeding trick; exceptions-effect dep-array hazard → `recurringKey` + `getState()` pattern.
