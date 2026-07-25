# F6e — Schedule (Sessions + RSVP · Availability) — Design Spec

> **Status:** authored by the autonomous run 2026-07-02 · **awaiting async user skim (AUTONOMOUS_RUN §4 pause)** · **one PR** — `redesign/f6e-schedule` off `redesign/foundation`, branched **after `redesign/f6d-history` merges** (F6e consumes F6d's `useWeekClock`). Implementation plan written separately (writing-plans) from this spec.
>
> **Authority docs:** `docs/PRODUCT_MODEL.md` (§3.1 Person→Static availability flow; §3.2 one week = loot unit + session unit; §3.4 rings; §5 Ring-1 schedule inventory), `design/redesign/REDESIGN_SPEC.md` §5.4 (Schedule blueprint) + §7 (re-home map) + §9 (week-object invariant), `design/redesign/specs/f5-screen-components-map.md` (Schedule element table `:173-190`, catalog #4/#5/#10/#24/#25/#26), `design/redesign/FOUNDATION_ROADMAP.md` §2.1 (F6e row `:65`), mockup `design/redesign/mockups/04-schedule.html` (visual target). Research dossiers: `.superpowers/sdd/f6e-research-design.md` + `f6e-research-legacy.md` (all `file:line` citations below spot-verified against branch head).
>
> **Doc-drift caveat:** `DESIGN_SYSTEM.md` §3 contracts stop at §3.23 (F6b) — F6c/F6d components were never contracted there, and §3.19/§3.23 reservation notes are stale. Every interface in this spec is pinned to **shipped code**, not DESIGN_SYSTEM.md (see §12 for the housekeeping disposition).

---

## 1. Goal & scope

Build the **redesigned Schedule screen** — "*find raid time and RSVP — and be the app's clock*" (REDESIGN_SPEC §5.4) — as a **single always-visible two-region page**: sessions + RSVP on the left (actionable), the availability aggregate on the right (ambient). Wire it behind `?shell=v2` as the **`schedule` slot** on `GroupViewContent` — the slot is **already typed and mounted** (`GroupTab` includes `'schedule'` at `GroupViewContent.tsx:78`; the body renders `slots?.schedule ?? (legacy)` at `:1060`). This is the last Ring-0 screen slice before the parity flip.

**Roadmap scope (binding, FOUNDATION_ROADMAP §2.1 F6e row):** Sessions + RSVP (shared `SessionRsvpCard`, implementing the reserved `'later'` variant) + `AvailabilityHeatmap` (**read-only aggregate**; per-member availability **editing** re-homed to the Person layer via a `PersonLayerEntryPoint` affordance) + `WeekNavigatorStrip`. Depends on F6a (shell), F6b (`SessionRsvpCard`), F6d (week clock).

**NO enabling refactor.** Unlike F6c/F6d, zero legacy-file edits are needed: the `??` fallback at `GroupViewContent.tsx:1060-1110` wraps the *entire* legacy schedule body (PageHeader + Upcoming|Calendar switcher + `ScheduleUpcomingPanel` + `ScheduleTab`), `preventPageScroll` has no schedule condition (`:679` keys only on gear), the mobile Controls Sheet special-cases only roster/gear (`:1186-1189`), and there are no schedule keyboard shortcuts (legacy dossier §4). **This slice sanctions ZERO legacy edits and ZERO promote-and-repoints** — the one reusable logic module (`availabilityUtils.ts`) is already a pure standalone file importable as-is (design dossier §9 / legacy dossier §1).

**In scope:** the `WeekNavigatorStrip` (shared-clock stepper + Add session CTA); session cards for the scoped week (`next`/`later` variants, RSVP member grid, RSVP strip, session kebab: Edit / Share / Copy for Discord / Manage occurrences / Delete incl. recurring choice); `?sessionId=` deep-link highlight parity; `AvailabilityHeatmap` (read-only aggregate, hourly prime-window cells, session marks, legend) + `BestTimesCard` (compact recommendations with duration select + propose-session); `PersonLayerEntryPoint`; `EmptyStateInvite` empty state; reuse of `CreateSessionModal` / `OccurrenceListModal` / `ConfirmModal` import-only; housekeeping (contrast harness on the v2 schedule screen, suppressions verify, DESIGN_SYSTEM.md contracts for what F6e builds, internal release note).

**Out of scope (each with an explicit home — see the feature-identity audit §6.2 for the full ledger):** per-member availability **editing** (drag-paint grid, typical-week templates, quick-fill) — Person layer / legacy-until-flip with a **recorded flip blocker**; the Integrations panel (Discord webhooks/reminders/iCal/guild link/mirror sync) — Settings re-home at flip, legacy until then (**flip blocker**); per-session Discord mirror-status chips (rides integrations; also sheds the N+1 fetch at `ScheduleTab.tsx:189-208`); typical-week template recommendations; session history (§2.e); mount-farm→schedule draft handoff (emitter has no v2 surface yet); the tile/list session view toggle and the Upcoming|Calendar/`stab` tab layers (retired IA); `?shell=v2` exposure (stays a flag).

**Non-negotiable constraints (carried from F6a–F6d, all binding):**
- **BYTE-FOR-BYTE legacy** `/group/:shareCode` — this slice edits no legacy file at all (see above); legacy modals/components are reused **import-only**, unmodified. The only shared-file edits are to **v2-owned** `ui/` components (`SessionRsvpCard`, `PlayerIdentity` — additive, existing-consumer-safe, test-locked).
- **NO new `eslint-suppressions.json` entries.** New components live in `components/schedule/` (ring1) and `ui/` (shared); `pages/NewShell.tsx` composes them (pages are boundary-exempt, `eslint.config.js:114`); ring1 may import shared/stores/hooks freely. No reclassification of the `schedule/` ring is needed for this slice (§3.2).
- **Tokens only, 12px floor**, design-system primitives; `check:design-system:strict` gates the PR.
- **NO AI attribution.** Internal release note (`{internal:true}`, `pr` backfilled), **no `CURRENT_VERSION` bump**.
- **Contrast harness** re-enabled scoped to the v2 schedule screen (both themes) — F6c/F6d pattern; §3.1 debt note: verify `ScheduleUpcomingPanel`'s light-mode bug is *bypassed* (its replacement doesn't inherit it), per `FOUNDATION_ROADMAP.md` §3.1.
- **Suppressions prune:** verified **no-op** — `frontend/eslint-suppressions.json` contains zero entries for `components/schedule/` (the legacy files' debt is inline `eslint-disable` comments, which stay with the legacy files until flip-time deletion). The one availability-adjacent ledger entry, `src/components/profile/PersonalAvailabilityEditor.tsx:62-66`, is Person-layer and out of F6e scope — it stays.
- **Browser validation** (dev-auth → `/group/DEVTST?shell=v2`, schedule tab) after first slot mount + final pre-PR pass; **PR screenshots embedded** (light + dark).

---

## 2. Locked decisions (autonomous, per doctrine — the six flagged items + the stances the user skims for)

### 2.a `WeekNavigatorStrip` is a NEW component; "week" on this screen = the raid week from `useWeekClock`

The deeper question first: legacy Schedule has **no week concept at all** — sessions are absolute datetimes, and the availability grid uses a rolling window of today+6 days (`getNextNDates(7)`, `availabilityUtils.ts:129-140`), while `useWeekClock` is the tier-relative raid week anchored at `weekStartDate` (`useWeekClock.ts:1-7`). PRODUCT_MODEL §3.2 is unambiguous: "**one 'week' is both the loot-tracking unit and the raid-session unit**", and REDESIGN_SPEC §9's invariant forbids parallel week concepts. **Decision: the v2 Schedule week IS the raid week.** The strip scopes both regions: sessions shown = occurrences inside `rangeOfWeek(scopedWeek)`; availability fetched/aggregated for the same 7 dates. This *replaces* the rolling-7-day model on this screen (the rolling model survives only inside the legacy editor until flip).

**Honest dependency adjudication:** the F6d dependency is **real but read-only and partial**. F6e consumes `currentWeek`, `maxWeek`, `rangeOfWeek`, `isCurrent`, `weekStartDate` — the strip's "Week 3 · this week" and "Jun 24 – Jun 30" labels come straight from the clock, so it is not nominal. But F6e ignores `weeksWithData`/`weekDataTypes` (loot-entry-specific) and **does not surface `startNextWeek`/`revertWeek`** — week mutations stay in Loot's `WeekScopeControl`, the clock's single mutation host (F6d spec §2.3). One clock, one mutation host, two presentations.

**Component decision: build `WeekNavigatorStrip` as its own presentational component** (in `components/schedule/`), NOT a generalization of `WeekScopeControl`. They share the *state object* (`clock: WeekClock` prop — the same pattern as `WeekScopeControlProps`, `WeekScopeControl.tsx:1-27`) but nothing else: one is a toolbar scope-dropdown + mutation host, the other is a page-level prev/next stepper with date range and CTAs. The §9.3 invariant is about the week **object**, not the widget. Retrofitting a dual-presentation prop onto `WeekScopeControl` would couple two screens' toolbars for zero shared anatomy. (F5 catalog #25 lists "Shell, Loot, Schedule" as consumers of one entry — in practice that entry resolved into three thin consumers of one hook: TopBar `WeekIndicator`, `WeekScopeControl`, and now this strip. The catalog entry is satisfied at the hook level.)

**Null-anchor fallback:** `weekStartDate` is null until the first loot entry/week action sets it. The strip then renders a degenerate "This week" scope — rolling today→+6d range, prev/next disabled, no week number — and upgrades to the raid-week stepper automatically once the anchor exists. Stepping bounds: prev floor week 1; next soft cap `currentWeek + 12` (sessions are planned ahead; schedule looks forward, unlike loot history).

### 2.b `TwoRegionDashboard` ratio: adopt the shipped `1.85fr` as-is; no `ratio` prop

The mockup's `.sched` grid uses `1.7fr` (`04-schedule.html:501`); the shipped component encodes `1.85fr` (`TwoRegionDashboard.tsx:24`) and its own usage rule says it encodes *the* Home/Schedule proportion (DESIGN_SYSTEM §3.21). A 0.15fr delta is mockup filler, not design intent — shipped idioms win. Adding a prop would fork the "one shared unit" for nothing.

### 2.c Heatmap Ring-0/Ring-1 tension: the roadmap wins — the read-only aggregate ships in F6e

PRODUCT_MODEL §3.4 places "availability heatmap, recurring windows" at Ring 1, but its own §3.1 example is "you set your availability once in the Person layer; **every static you're in reads it into its scheduling heatmap**" — the *read* is the Static-layer half of the loop the lead needs to pick times (Ring-0 spine support); the *editing/recurring-window depth* is the Ring-1 half. **Decision: the read-only aggregate display ships in F6e (roadmap row is explicit); editing is Person-layer, deferred.** Cell-click **propose-a-session** (mockup note `:574`) is included — it's a create-CTA, not availability editing, and reuses the existing `onCreateSessionDraft` prefill pattern (`AvailabilityGrid.tsx:43-52`).

**`PersonLayerEntryPoint` — what it does BEFORE a Player Hub v2 exists:** its Edit action navigates to the **existing** personal availability editor at `/profile?tab=availability` (`components/profile/PersonalAvailabilityCard.tsx` + `PersonalAvailabilityEditor.tsx` — real, shipped, backed by `personal_availability_templates`; the legacy grid already links there, `AvailabilityGrid.tsx:648-653`). It is a real destination, not a stub. **Honesty constraint on copy:** the mockup's "it feeds every static you're in" (`:618`) is **not true today** — `PersonalAvailabilityTemplate` is a separate table that only reaches the static's grid via the manual quick-fill import (legacy dossier §3). F6e's heatmap aggregates the **existing static-scoped data** (`UserAvailability` via `useAvailabilityStore.data`). The card copy is therefore adjusted to describe the present ("Your typical week lives on your profile — leads pull it into this static's grid") until the Person→Static pipe lands. **Flip blocker recorded (§6.3):** at flip, availability editing must be reachable — either the backend Person→Static aggregation pipe (Ring 1) or a re-hosted week editor — before legacy chrome is deleted.

### 2.d `AvailabilityGrid` survival: nothing is extracted from it; the v2 heatmap derives from the same store data via the already-pure utils

The F5 note "extract read-only heat-cell rendering from `AvailabilityGrid`" turns out to be already done by the legacy code's own structure: everything reusable is in the pure module `availabilityUtils.ts` (no React/store imports — `buildHeatMap`, `computeAvailabilityRecommendations`, `getScheduleReferenceTimezone`, `TIME_SLOTS`, `TIME_PRESETS`; verified `availabilityUtils.ts:8-344`). `AvailabilityHeatmap` **imports those utils as-is** (same-directory ring1 import, zero file edits) and renders fresh read-only cells. `AvailabilityGrid.tsx` itself is **not edited, not extracted from, and survives untouched** as the legacy editor until flip; its final disposition (deleted vs. reshaped into the Person-layer editor) is the flip blocker's problem, not F6e's.

### 2.e Session history: OUT of F6e

REDESIGN_SPEC §7 (`:251`) re-homes "Session History" to "Schedule (Session history)", but no mockup element, no F5 Schedule row, and — decisive — **no session-history UI exists on the legacy schedule tab today** (it's part of the legacy Exports/Activity surface). There is nothing to preserve at flip; it's a net-new future capability. **Deferred post-flip**, recorded in §12 so the re-home table row isn't silently dropped.

### 2.f `SegmentedToggle`: NOT used on this screen (explicit)

Every other F6c/F6d screen used it; Schedule does not. The two-region layout is always-on — no sub-view survives to toggle (the legacy `sched=upcoming|calendar` and `stab=sessions|availability|integrations` tab layers are retired IA, and the tile/list session toggle is dropped: one session-card layout). Consequently the v2 Schedule has **no view URL state at all**; the only URL surface kept is `?sessionId=` highlight parity (§5.6).

### 2.g Timezone stance — one display rule per surface (three legacy models → two, explicitly assigned)

Legacy runs three timezone models at once (legacy dossier §7): (a) session-fixed TZ with local secondary, (b) browser-local grid axis with UTC storage, (c) a derived "reference timezone" (majority of session TZs) on recommendation cards. **v2 rules:**

| Surface | Rule |
|---|---|
| Session cards (`SessionRsvpCard`) | **Session's own fixed TZ primary, viewer-local secondary** when they differ — the shipped F6b idiom (`SessionRsvpCard.tsx:194-201`), unchanged. A session is an appointment; its authored zone is the truth. |
| Week strip date range | Viewer-local rendering of `rangeOfWeek` dates (pure calendar dates; no TZ label shown). |
| Heatmap grid + `BestTimesCard` | **Viewer-local, everywhere** — the aggregate answers "when is everyone free, on MY clock" (When2Meet semantics; matches the storage model: UTC slots converted per-viewer, `availabilityUtils.ts:156-170`). |
| Reference-timezone model (c) | **RETIRED from v2 display.** It existed to caption recommendation cards and Discord-proposal text; the v2 best-times rows sit directly under a viewer-local grid and must agree with it. It survives only inside legacy components until flip. |

### 2.h RSVP avatar coloring: status-colored, NOT role-colored (F6b deliberate deviation carried forward)

The mockup's `.rmember` avatars are role-colored (`04-schedule.html:518-525`) — **the spec explicitly diverges**: `ScheduleRsvp` carries no role field (`types/index.ts:1446-1454`), and the F6b decision (DESIGN_SYSTEM §3.23; `SessionRsvpCard.tsx:24-29`) colors rings by RSVP **status** via `STATUS_TOKEN`. F6e keeps that decision — adding a role field to `ScheduleRsvp` is backend scope this UI slice doesn't take. The member-grid rows carry the status **glyph as text** (✓ / ? / ·) so status is never color-only. If role lands later, `PlayerIdentity`'s `role` prop is the ready seam (§2.i).

### 2.i `PlayerIdentity` `rsvp-row`: implemented minimal — identity only; status stays parent-owned

The reserved variant (`PlayerIdentity.tsx:80-86`, renders `null` + DEV warning today) is implemented as a **compact identity row**: 24px avatar (initials fallback) + `text-xs` name, single line. It does NOT take RSVP status — status is schedule-domain, not identity-domain; `SessionRsvpCard` composes `PlayerIdentity variant="rsvp-row"` + its own status ring/glyph around it. This honors the F5 catalog reservation (one identity unit everywhere) without polluting the shared identity component with RSVP semantics, and leaves the `role` prop as the zero-change seam for future role-coloring.

### 2.j Other locked decisions

1. **One PR** (§10) — the evidence says one coherent screen: 2 genuinely-net-new small components + 1 new composite + 2 additive `ui/` changes + assembly; no enabling refactor; comparable to `f6d-history` alone.
2. **Session actions get a v2 home:** a kebab (`IconButton` → `ContextMenu`) per session card — Edit (reuse `CreateSessionModal` edit mode), Share, Copy for Discord, Manage occurrences (reuse `OccurrenceListModal`), Delete (recurring sessions get the cancel-occurrence/delete-series choice, then `ConfirmModal`). Share/Copy/delete-choice handlers are thin fresh-audited rewrites (~30 lines each; the legacy versions are `SessionCard`-inline and can't be imported) with `?sessionId=` deep-link parity (`SessionCard.tsx:93-120, 206-231`).
3. **v2 fixes the fetch topology for its own surface:** the `Schedule` assembly is the single fetcher (`fetchSessions` + `fetchAvailability` per scoped week); children are presentational. It does **not** call `clearSessions()` on unmount (the legacy quirk that wipes Home's copy of the shared store, `ScheduleTab.tsx:126-128` — harmless to keep data warm). The legacy triple-fetch (legacy dossier, Other Findings #1) is untouched on the legacy route.
4. **Heatmap granularity:** hourly display rows over the **prime window** (18:00→02:00 viewer-local, from `TIME_PRESETS.prime` — 8 rows; the mockup's 5 rows 6P–10P is filler), aggregating the 30-min store slots conservatively: an hour's count = members free for **both** half-slots. No preset switcher in v2 (the full 24h/30-min resolution lives in the editor, which is Person-layer). Flagged for ratification (§12).
5. **"Recurring: Tue/Fri 8PM" strip chip is display-only** (`Tag variant="label"`), derived from recurring sessions' recurrence rules — the mockup renders it as a ghost button with no destination; a button with no action is illegal by the DS behavioral lexicon.
6. **`trackAvailability === false` parity:** the RSVP strip is replaced by a muted "Availability not required" note (legacy behavior, `SessionCard.tsx:476-480`) — carried into `SessionRsvpCard`.

---

## 3. Architecture

### 3.1 The `schedule` slot (the seam — already built)

`GroupViewContent` renders `{pageMode === 'schedule' && (slots?.schedule ?? (…legacy…))}` (`GroupViewContent.tsx:1060`). `NewShell`'s `ShellContent` adds the fourth slot, mirroring Loot:

```tsx
// ShellContent (v2 path only) — NewShell.tsx
const schedule = currentGroup ? (
  <Schedule group={currentGroup} tier={currentTier}
            canManage={canManageSchedule}    // owner | lead | isAdminAccess
            currentUserId={effectiveUserId} />
) : undefined;
return <GroupViewContent actions={...} slots={{ overview, roster, gear: loot, schedule }} />;
```

Legacy route passes no `slots` → schedule body byte-for-byte (no guard work needed; the fallback wraps everything).

### 3.2 Boundary placement (zero suppressions)

- `components/schedule/` is **ring1** (`eslint.config.js:50`). Ring1 may import `shared`/stores/hooks (only ring3/admin disallowed, `:133-135`); `pages/` (NewShell) is exempt from from-rules (`:114`) and composes the assembly. **All new Schedule-only components live in `components/schedule/`** alongside the legacy files they'll replace at flip — no reclassification, no new dirs, no suppressions. (PRODUCT_MODEL's "Schedule → Ring 0" is a *conceptual* spine statement; the eslint ring taxonomy doesn't need to move for this slice, and nothing ring0 imports the v2 Schedule.)
- Cross-screen shared pieces (`SessionRsvpCard`, `PlayerIdentity`) are already in `ui/` — F6e's changes there are additive and consumer-safe (Home keeps rendering identically by default).
- `WeekNavigatorStrip` takes `clock: WeekClock` as a prop (the `WeekScopeControl` pattern) — presentational, no store import; the `WeekClock` type import from `hooks/` is fine in ring1.

---

## 4. Component inventory & placement

### 4.1 Shared — `components/ui/` (additive edits to v2-owned components; both test-locked for existing consumers)

| Component | Change | Purpose |
|---|---|---|
| `SessionRsvpCard` | **implement `'later'`** + additive props (§5.2) | `next` = accent-bordered hero (Home + Schedule top card); `later` = neutral border, ghost RSVP buttons. Gains: day-pill, member grid mode, no-answer counts, actions slot, `trackAvailability` note. Home unchanged by default. |
| `PlayerIdentity` | **implement `'rsvp-row'`** (§2.i, §5.3) | compact avatar+name identity row; replaces the reserved `null`+warn branch. |

### 4.2 Ring-1 — `components/schedule/` (new files; compose shared + reuse legacy modals import-only)

| Component | Purpose | Reads / reuses |
|---|---|---|
| `Schedule` | assembly: `PageHeader` ("Schedule" + "This week's sessions and when everyone's free · the same week drives loot") + `WeekNavigatorStrip` + `TwoRegionDashboard`; owns fetches, scoped week, modal state, `?sessionId=` highlight | `useScheduleStore`, `useAvailabilityStore`, `useWeekClock`, `CreateSessionModal`, `OccurrenceListModal`, `ConfirmModal` |
| `WeekNavigatorStrip` | the shared-clock stepper: ‹ / "Week N · this week" + date range + tier label / › + recurring-summary `Tag` + "Add session" `Button` | `clock` prop (from `useWeekClock`) |
| `SessionList` (thin) | scoped-week session cards: first upcoming in current week = `next`, rest `later`; kebab per card; `EmptyStateInvite` when none | `SessionRsvpCard`, `sessionOccurrencesInRange` |
| `AvailabilityHeatmap` | read-only aggregate: `CardShell` "Team availability" + note + 7-day × prime-hour grid (density scale, session marks, counts) + legend; cell-click proposes a session (canManage) | `availabilityUtils` (`buildHeatMap`, `TIME_PRESETS`), store data via props |
| `BestTimesCard` | compact ranked windows: when + mini `ProgressBar` + n/N (+ "· scheduled" note); duration `Select` (60–180); row-click proposes (canManage) | `computeAvailabilityRecommendations` |
| `PersonLayerEntryPoint` | link-card: medallion + "Your availability" + honest transition copy + Edit `Button` (ghost sm, **no trailing arrow**) → `/profile?tab=availability` | react-router navigate |

**New utils (small, testable):** `components/schedule/scheduleWeek.ts` — `sessionOccurrencesInRange(sessions, range): Array<{ session; occursAt: string }>` (non-recurring: `startTime` within range; recurring: expand via `utils/recurrence.ts` helpers, honoring cancelled exceptions per the `SessionCard` pattern) and `deriveHourlyHeatCells(heatMap, dates, presetHours)` (30-min → hourly conservative aggregation, §2.j.4).

**Reused unmodified (import-only, the F6c kebab doctrine):** `CreateSessionModal` (F5: "existing — no changes"; its `design-system-ignore`d datetime-local inputs stay as-is), `OccurrenceListModal`, `ConfirmModal`, `EmptyStateInvite`, `TwoRegionDashboard`, `CardShell`, `Tag`, `ProgressBar`, `Select`, `IconButton`, `ContextMenu`, `availabilityUtils.ts`.

---

## 5. Component contracts (code-real; signatures pinned to shipped code)

### 5.1 `WeekNavigatorStrip`

- **Props:** `{ clock: WeekClock; scopedWeek: number; onScopedWeekChange: (week: number) => void; tierLabel?: string; recurringSummary?: string | null; canManage: boolean; onAddSession: () => void }` — `WeekClock` per `useWeekClock.ts:13-23` (verified verbatim).
- **Anatomy:** `IconButton` ‹ (disabled at week 1) · label block — "**Week {n}**" (display font, accent when `isCurrent(scopedWeek)`) + "· this week" suffix when current; second line `rangeOfWeek(scopedWeek)` as "Jun 24 – Jun 30" + `tierLabel` · `IconButton` › (disabled at `currentWeek + 12`) · spacer · `Tag variant="label"` recurring summary (when ≥1 recurring session) · "Add session" `Button` primary sm (canManage).
- **Null anchor (`weekStartDate === null`):** label "This week", range = today→+6d, both steppers disabled (§2.a).
- **a11y:** steppers labeled ("Previous week"/"Next week"); week + range as text.

### 5.2 `SessionRsvpCard` (shared; additive — existing props verified at `SessionRsvpCard.tsx:41-55`)

- **New/changed props (all optional — Home compiles and renders identically without them):**
```ts
{
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
- **`'next'` variant:** accent border + "Next session" header (existing) — gains the accent-border differentiation the DS contract reserved. **`'later'` variant:** neutral `border-border-default`, header = weekday/title (no "Next session" label, no accent), RSVP buttons ghost when unanswered (mockup `:539-567`).
- **Member grid (`memberDetail='grid'`):** responsive columns of rows — status-ringed 24px avatar (`STATUS_TOKEN`, `SessionRsvpCard.tsx:58-62`; no-answer = `border-border-default`) wrapping `PlayerIdentity variant="rsvp-row"` + trailing status glyph as text (`✓`/`?`/`·` with `sr-only` expansion). Counts line becomes "N in · M tentative · K no answer" when `members` is provided.
- **Contextual note:** when any RSVP is `tentative`/`unavailable`, a tertiary `text-xs` note names them ("{name} tentative — sub may be needed") — **role-free copy** (mockup's "Healer Two" phrasing implies role data that doesn't exist; §2.h). Polish candidate → holistic.
- **`trackAvailability === false`:** RSVP strip replaced by muted "Availability not required" (§2.j.6).
- **a11y:** unchanged contract — buttons `aria-pressed`; grid statuses as text glyphs + sr-only labels, never color-only.

### 5.3 `PlayerIdentity` `rsvp-row` (shared)

- Renders: 24px `SafeAvatar` (initials fallback; role ring **only if** `role` passed — RSVPs won't pass it today) + `text-xs font-medium` name, one line, `min-w-0 truncate`. No subtitle, no JobIcon (no job data on RSVPs). Replaces the `null`+DEV-warn branch (`PlayerIdentity.tsx:80-86`); existing `inline`/`board-cell` snapshots must not change.

### 5.4 `AvailabilityHeatmap` + `BestTimesCard`

```ts
interface AvailabilityHeatmapProps {
  data: AvailabilityDateSummary[];          // useAvailabilityStore.data (types/index.ts:1673-1676)
  members: Membership[];                    // tracked (non-viewer) members
  weekDates: string[];                      // 7 × 'YYYY-MM-DD' from the scoped week (or rolling fallback)
  sessions: Array<{ session: ScheduleSession; occursAt: string }>; // scoped occurrences → session marks
  canManage: boolean;
  onProposeSession?: (draft: ScheduleSessionCreate) => void; // prefilled start/end; opens CreateSessionModal
}
```
- **Anatomy:** `CardShell` title "Team availability", `headerRight` "{N} raiders" (`text-xs`, not the mockup's 11px); note line; grid = corner + 7 day headers + per-hour rows (prime window, §2.j.4): each cell background = density step `color-mix(in srgb, var(--color-accent) {8|16|28|45|70}%, var(--color-surface-card))` (token-based color-mix — the F1/F6d-sanctioned pattern; no new tokens), full-count cells show the number; cells overlapping a scoped session occurrence get an inset accent ring ("scheduled" mark). Legend: density swatches "Fewer free → All {N}" + scheduled swatch.
- **Interaction:** when `canManage`, each cell is a real button (`aria-label` "Tuesday 8 PM — 6 of 8 free"; click → `onProposeSession` with that start + 2h default); otherwise cells are inert with `title` name lists (hover parity with legacy). Read-only with respect to availability **data** in all cases.
- **`BestTimesCard` props:** `{ recommendations: AvailabilityRecommendation[] /* availabilityUtils.ts:8-17 */; durationMinutes: number; onDurationChange: (m: number) => void; scheduledSlotIds?: Set<string>; canManage: boolean; onProposeSession?: (rec: AvailabilityRecommendation) => void }`. Rows: viewer-local "Tue 8:00 PM" + `ProgressBar` + "n/N" (+ "· scheduled" tertiary when matching a session). Duration `Select` (60/90/120/150/180 — legacy parity, DS `Select` like `AvailabilityRecommendations.tsx`). Confidence labels + "Copy proposal to Discord" **dropped** from v2 (§6.2 row 13).

### 5.5 `PersonLayerEntryPoint`

- **Props:** `{ title: string; description: string; actionLabel: string; onAction: () => void; icon?: ReactNode }` — generic link-card (F5 #26 anticipates reuse for other Person-layer re-homes). Schedule instance: "Your availability" / honest transition copy (§2.c) / "Edit" (ghost sm, **no `→`**, per DS §4.1) → `navigate('/profile?tab=availability')`.

### 5.6 `Schedule` assembly

- **Props:** `{ group: StaticGroup; tier: TierSnapshot | null; canManage: boolean; currentUserId: string | null }`.
- **State/effects:** `useWeekClock(group.id, tier?.tierId)`; local `scopedWeek` (default `currentWeek`; **not URL-synced** — no legacy week param existed); fetch `fetchSessions(group.id)` on mount + `fetchAvailability(group.id, start, end)` on scoped-week change (`availabilityStore.ts` actions, legacy dossier §2); no `clearSessions` on unmount (§2.j.3). `canRsvp` = viewer-excluded membership (backend enforces regardless, `schedule.py` endpoint 5). RSVP submit → `submitRsvp(group.id, sessionId, status)` (store upserts locally).
- **`?sessionId=` parity:** on mount, if present and the session's occurrence is in a reachable week, scope to that week, scroll + highlight the card (legacy: `ScheduleTab.tsx:155-179`; share links embed it, `SessionCard.tsx:116`).
- **Empty week:** `EmptyStateInvite` ("No sessions this week" + "Add session" action when canManage; description points members at the RSVP loop).

---

## 6. Data flow, the feature-identity audit & the re-home ledger

### 6.1 Reused (no new backend, no new aggregation)

`useScheduleStore` (`fetchSessions`/`createSession`/`updateSession`/`deleteSession`/`submitRsvp`/`fetchOccurrences`/`createException`/`deleteException`/`fetchExceptions` — legacy dossier §2), `useAvailabilityStore` (`fetchAvailability`), `useWeekClock` (F6d), `availabilityUtils.ts` pure fns, `utils/recurrence.ts` (`computeNextOccurrence`, `getOccurrenceDateKey*`, `addWeeksInTimezoneWallClock` — `recurrence.ts:121-195`), the three reused modals. **Zero backend changes** (F6d's `weekStartDate` field already ships everything the strip needs).

### 6.2 Feature-identity audit — every legacy schedule capability, dispositioned

| # | Legacy capability (citation) | Disposition |
|---|---|---|
| 1 | Sessions list + per-session display (`SessionCard`, list/tiles) | **keep-in-v2 (rebuilt):** `SessionRsvpCard` next/later + member grid |
| 2 | RSVP submit (status-only; `submitRsvp`) + per-RSVP notes display (`SessionCard.tsx:492-504`) | **keep-in-v2:** strip in card; notes surface as row `title` (polish → holistic) |
| 3 | Create/edit session (all fields incl. recurrence, banners, Discord overrides) | **reuse-import-only:** `CreateSessionModal` (F5: no changes) |
| 4 | Delete + recurring cancel-occurrence/delete-series choice (`SessionCard.tsx:158-164`) | **keep-in-v2:** kebab items + `ConfirmModal`; thin fresh-audited handlers |
| 5 | Occurrence management (`OccurrenceListModal`) | **reuse-import-only:** kebab "Manage occurrences" |
| 6 | Share session / Copy for Discord (`SessionCard.tsx:93-120, 206-231`) | **keep-in-v2:** kebab items, fresh-audited, `?sessionId=` link parity |
| 7 | `?sessionId=` scroll-highlight deep link (`ScheduleTab.tsx:155-179`) | **keep-in-v2** (§5.6) |
| 8 | Upcoming⇄Calendar switcher + `ScheduleUpcomingPanel` (`GroupViewContent.tsx:1060-1110`) | **retired-IA:** two-region replaces; its Recurring-Series card → strip chip; Discord-sync card → integrations (row 17); plugin card → not schedule-domain |
| 9 | `stab` sub-tabs sessions/availability/integrations (`ScheduleTab.tsx:106`) | **retired-IA** (always-visible two-region) |
| 10 | Availability drag-paint editor, this-week (`AvailabilityGrid` core) | **re-home → Person layer** via `PersonLayerEntryPoint`; editing stays on legacy until flip; **FLIP BLOCKER** (§6.3) |
| 11 | Typical-week template editor + `TemplateRecommendations` | **defer-to-legacy-until-flip** (Person-layer follow-up rides the same blocker) |
| 12 | Quick-fill (personal template / static typical week imports, `QuickFillHelper`) | follows the editor (rows 10/11) |
| 13 | This-week recommendations (`AvailabilityRecommendations`) | **keep-in-v2 (rebuilt compact):** `BestTimesCard` — duration select + propose kept; confidence labels + Discord-proposal copy **dropped** (holistic may restore) |
| 14 | Create-session-from-recommendation / propose-from-slot | **keep-in-v2** (heatmap cell-click + best-times row, canManage) |
| 15 | Availability stats row ("Your Slots / Members Tracked / Shared Windows", `AvailabilityGrid.tsx:578-614`) | **retired:** editor chrome; "{N} raiders" header covers the ambient need |
| 16 | Time presets prime/evening/full (`TIME_PRESETS`) | **partially kept:** v2 renders the prime window fixed (§2.j.4); full-resolution view stays with the editor |
| 17 | Integrations panel (webhooks, reminders, iCal, Discord guild link, mirror sync — `ScheduleTab.tsx:607+`) | **re-home → Settings at flip** (F5 retired note); legacy until then; **FLIP BLOCKER** (§6.3). The `MorePage` deep link (`GroupViewContent.tsx:1143`) keeps working on the legacy route |
| 18 | Per-session Discord mirror-status chips (+ N+1 fetch, `ScheduleTab.tsx:189-208`) | **defer-to-legacy:** rides row 17; v2 sheds the N+1 |
| 19 | Mount-farm → schedule draft (event bus, `ScheduleTab.tsx:109-116`) | **not wired in v2:** the emitter (Tracking/goals) has no v2 surface; revisit with Tracking's disposition |
| 20 | Tile⇄list session view toggle (`ScheduleTab.tsx:100-103`, raw buttons `:541,549`) | **dropped:** one layout (mockup) |
| 21 | Bespoke empty state (`ScheduleTab.tsx:527-534`) | **keep-in-v2 (rebuilt):** `EmptyStateInvite` |

No capability is silently dropped: every row is a rebuild, an import-only reuse, an explicit re-home with a surviving affordance, or a named flip-time obligation.

### 6.3 Flip-blocker ledger (F6e appends; the parity-flip spec must clear these)

1. **Availability editing** — deleting legacy chrome orphans the only editor feeding the static heatmap (`UserAvailability`). Before flip: land the Person→Static aggregation pipe (backend, Ring 1) **or** re-host a static-week editor (e.g. on the Player Hub). Until then the v2 heatmap reads data edited on the legacy route.
2. **Integrations panel** — must re-home into the Settings panel (its natural host; `ScheduleSettings.can_manage` gating already matches) before legacy deletion.
3. (Carried from F6d, unchanged: `Sync` sub-tab disposition.)

---

## 7. Tokens

**No new tokens.** Density scale = accent `color-mix` steps against `surface-card` (§5.4 — the sanctioned pattern); session marks = `accent`/`accent-hover` inset ring; RSVP rings = `status-success/warning/error` (existing `STATUS_TOKEN`); strip/pills = `surface-*`/`border-*`/`accent`; role tokens unused on this screen (§2.h). The mockup's raw `#0a0a0f` in the entry-point medallion (`:615`) maps to `var(--color-surface-base)` mix. `pnpm tokens:check` gates the PR.

**Mockup fidelity divergences (shipped idioms + accepted deviations win — each deliberate):** role-colored RSVP avatars → status-colored (§2.h); "Edit →" → no trailing glyph (DS §4.1); 11px texts ("8 raiders", "· scheduled") → `text-xs` 12px floor; `1.7fr` → `1.85fr` (§2.b); recurring-summary ghost button → inert label `Tag` (§2.j.5); heatmap 5 rows 6P–10P → prime window 6P–1A (§2.j.4); role-implying warning copy → name-based (§5.2); mockup `<span class="btn">` → real `Button`/`IconButton` primitives.

---

## 8. Testing & conformance

- **Per-component Vitest:** `WeekNavigatorStrip` (labels/range from clock, current-week accent, null-anchor degradation, stepper bounds, canManage CTA gating); `SessionRsvpCard` (**existing Home rendering unchanged with no new props** — regression lock; `later` neutral/ghost styling; member grid + no-answer derivation from `members` minus `rsvps`; `trackAvailability=false` note; actions slot); `PlayerIdentity` (`rsvp-row` renders name+avatar; `inline`/`board-cell` snapshots unchanged; DEV-warn branch removed); `sessionOccurrencesInRange` (non-recurring in/out of range, recurring expansion across the range, cancelled-exception exclusion, DST wall-clock weeks via `addWeeksInTimezoneWallClock`); `deriveHourlyHeatCells` (both-half-slots rule, prime-window cross-midnight rows); `AvailabilityHeatmap` (density steps from counts, session marks, cell-button vs inert by `canManage`, aria-labels); `BestTimesCard` (ranking order preserved from util, scheduled annotation, duration change refetches recs); `PersonLayerEntryPoint` (navigation target); `Schedule` assembly (fetch-per-scoped-week, `?sessionId=` highlight, empty-state, viewer `canRsvp=false`).
- **Slot/legacy guard:** `NewShell.schedule.test.tsx` mirroring the roster/gear slot tests — with `slots.schedule` the v2 screen renders and the legacy switcher/`ScheduleTab` are absent; without slots, byte-for-byte legacy (no legacy file changed this slice, so this is a pure regression lock).
- **Gate (all green on land):** `pnpm build` · `pnpm lint` (0 err) · `pnpm check:design-system:strict` · `pnpm test` · `pnpm tokens:check` · `git diff --check` · scripts changelog test.
- **Housekeeping:** contrast harness re-enabled scoped to the v2 schedule screen (both themes); suppressions prune = **verified no-op** (§1); `DESIGN_SYSTEM.md` gains contracts for what F6e builds (§12.6); internal release note.
- **Browser validation (both passes):** dev-auth `/api/dev-auth/login/0` → `/group/DEVTST?shell=v2` → Schedule: strip steps weeks + ranges match Loot's `WeekScopeControl` for the same week number; RSVP round-trips (button → grid ring/glyph + counts update); add-session → appears in list + heatmap session mark; heatmap counts match painted legacy availability; entry point lands on `/profile?tab=availability`; `?sessionId=` deep link highlights; legacy `/group/DEVTST` schedule byte-for-byte; 0 console errors. **PR screenshots embedded, light + dark.**
- **Reviewer:** `redesign-reviewer` per task + final whole-branch. Implementers sonnet-5; **opus/fable flagged riskiest:** `sessionOccurrencesInRange` (recurrence/DST math), the `SessionRsvpCard` additive change (shared component, Home regression surface), the `Schedule` assembly.

---

## 9. PR split & pre-authorized cut order

**One PR: `redesign/f6e-schedule`.** Evidence: no enabling refactor (§1), zero legacy edits, 2 net-new small components + 1 composite + 2 additive `ui/` changes + assembly + housekeeping ≈ the size of `f6d-history` alone (~10–11 tasks). A split would leave either a session list with no clock or a clock with nothing to scope — no clean seam exists.

**Pre-authorized cut order if it overruns (cut from the top):**
1. Heatmap cell-click + best-times **propose-session** wiring (heatmap ships purely ambient; "Add session" CTA covers creation) — follow-up task.
2. `BestTimesCard` entirely (heatmap alone ships; recommendations stay legacy-reachable until flip).
3. Session kebab **Share / Copy for Discord** items (defer to legacy until flip; Edit/Delete/occurrences are NOT cuttable — capability parity).
4. Recurring-summary strip chip.

**Never cut:** sessions + RSVP (both variants), `WeekNavigatorStrip`, read-only heatmap, `PersonLayerEntryPoint`, empty state, housekeeping.

---

## 10. Risks & plan-time confirmations

- **Recurrence expansion is the slice's hardest derivation** — legacy only ever computes the *next* occurrence (`computeNextOccurrence`); a per-week window expansion is new math over the same helpers. Mitigation: unit-lock DST/cross-midnight/cancelled-exception cases; opus implementer. **Confirm at plan time:** whether cancelled-exception fetching is per-recurring-session on mount (the `SessionCard.tsx:132-142` pattern) or batched via `fetchExceptions` per visible session — pick at plan time, both are existing endpoints.
- **`SessionRsvpCard` is live on Home** — every addition must be default-off. Mitigation: the "no new props → identical render" regression test is written FIRST (§8).
- **Week-scoping sessions changes what members see** vs. legacy's flat "all upcoming" list — a session 3 weeks out is only visible by stepping forward. Mitigation: the strip's forward stepping + (plan-time option) a small "next: {date}" hint on the empty state pointing at the week containing the next session. Flag in the PR body.
- **Null-anchor statics** (no loot logged yet) get the degraded non-stepping strip (§2.a) — acceptable for a flag-period surface; the anchor exists for any static that has used Loot. Verify with a fresh static during browser validation.
- **Heatmap data freshness:** v2 shows aggregate data edited elsewhere (legacy grid / quick-fill) — a static that never used the legacy availability tab shows an empty heatmap. The empty-data state must invite, not confuse: the heatmap note + `PersonLayerEntryPoint` carry the "where does this come from" story. Confirm empty-state copy at plan time.

---

## 11. Decisions to ratify (holistic checkpoint — append to SESSION_HANDOFF list)

1. Week-scoped session list (§2.a) vs. a flat "all upcoming" list — the clock invariant says scoped; confirm the feel once real data flows.
2. Status-colored RSVP avatars remain (mockup shows role) — ratify, or fund the `ScheduleRsvp.role` backend field post-flip (§2.h).
3. Heatmap fixed prime window + hourly aggregation (§2.j.4) — enough resolution for the ambient aside?
4. `BestTimesCard` drops confidence labels + Discord-proposal copy (§6.2 row 13) — restore at holistic if missed.
5. `PersonLayerEntryPoint` honest transition copy (§2.c) — replace with the mockup's aspirational copy only when the Person→Static pipe ships.
6. **Doc-drift disposition:** F6e adds `DESIGN_SYSTEM.md` contracts **only for what it builds/changes** (`WeekNavigatorStrip`, `AvailabilityHeatmap`+`BestTimesCard`, `PersonLayerEntryPoint`, `SessionRsvpCard` `later` update, `PlayerIdentity` `rsvp-row` update — fix-what-you-touch); the **F6c/F6d contract backfill (§3.24+) is an explicit out-of-scope handoff to parity-flip housekeeping** — ratify that placement.
7. Session history on Schedule (§2.e) — post-flip net-new; ratify or drop from the re-home table.
8. Flip blockers §6.3 (availability-editing pipe; integrations→Settings) — these gate the flip go/no-go.
9. RSVP-note display (title-attr only) and the name-based warning copy — polish candidates.

---

## 12. Verified interface facts (seed list for the implementation plan)

- `GroupViewContent.tsx:78` — `GroupTab = 'overview' | 'roster' | 'gear' | 'schedule'`; `:1060` — `{pageMode === 'schedule' && (slots?.schedule ?? (…entire legacy body incl. PageHeader + switcher…))}`; `:679` — `preventPageScroll` keys only on gear; `:326` — legacy `useUrlTabState('sched', SCHEDULE_VIEWS, 'upcoming')`.
- `hooks/useWeekClock.ts:13-27` — `WeekClock { currentWeek; maxWeek; weekStartDate: string | null; weeksWithData; weekDataTypes; rangeOfWeek(week): WeekRange | null; isCurrent(week); startNextWeek(); revertWeek() }`; `useWeekClock(groupId: string | undefined, tierId: string | undefined)`.
- `components/loot/WeekScopeControl.tsx:20-26` — `{ clock: WeekClock; scopedWeek: number; onScopedWeekChange: (week: number) => void; canEdit: boolean }` (the prop pattern to mirror).
- `components/ui/SessionRsvpCard.tsx:41-55` — current props `{ session; currentUserRsvp?; onRsvp?; variant?: 'next'|'later'; viewerTimezone? }`; `:58-62` `STATUS_TOKEN`; `:188-193` — `variant` currently **destructured out and unused** (no branch in body); `:145-173` `RsvpAvatar` (status ring, aria-hidden stack).
- `components/ui/PlayerIdentity.tsx:14` — variant union incl. `'rsvp-row'`; `:80-86` — reserved branch renders `null` + DEV warn; `:16-37` current props.
- `components/ui/TwoRegionDashboard.tsx:3-10, 24` — `{ main; side; className? }`, grid `min-[1181px]:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] gap-[18px]`.
- `types/index.ts:1443-1483` — `RsvpStatus = 'available'|'unavailable'|'tentative'`; `ScheduleRsvp { id; sessionId; userId; username: string | null; status; note; updatedAt }` (**no role field**); `ScheduleSession` (incl. `timezone: string`, `isRecurring`, `recurrenceRule`, `trackAvailability?`, `rsvps: ScheduleRsvp[]`); `:1564-1584` `ScheduleSessionCreate`; `:1673-1699` `AvailabilityDateSummary { date; responses }` / `AvailabilityTemplateDaySummary`.
- `stores/scheduleStore.ts` — `fetchSessions(groupId)`, `createSession(groupId, data)` (appends + re-sorts), `updateSession`, `deleteSession`, `submitRsvp(groupId, sessionId, status, note?)` (upserts by `userId`), `fetchOccurrences(groupId, sessionId, count=20)`, `createException`/`deleteException`/`fetchExceptions`; **`clearSessions()` wipes the shared store** (v2 must not call it on unmount).
- `stores/availabilityStore.ts` — `fetchAvailability(groupId, startDate, endDate)`, `data: AvailabilityDateSummary[]` (UTC slots; caller computes the date range).
- `components/schedule/availabilityUtils.ts` — pure module, no React/store imports: `TIME_PRESETS.prime = { start: 18, end: 2, crossesMidnight: true }` (`:26-30`); `buildHeatMap(data): Map<'localDate|HH:MM', { count; names }>` (`:172`, converts UTC→viewer-local); `computeAvailabilityRecommendations(data, members, dates, durationMinutes, now?)` → `AvailabilityRecommendation[]` (`:254`, `:8-17`); `getScheduleReferenceTimezone(sessions, fallback)` (`:233` — retired from v2 display); `getNextNDates(count)` (`:129` — null-anchor fallback source).
- `utils/recurrence.ts:121-195` — `addWeeksInTimezoneWallClock(iso, weeks, tz)`, `getOccurrenceDateKey(iso, tz)`, `getOccurrenceDateKeysForMatching`, `computeNextOccurrence(…)`.
- `eslint.config.js:49-50` — `ring0` pattern excludes `schedule`; `ring1 = src/components/(schedule|split-clear)/**`; `:114` — admin/**page**/service have no from-rule (NewShell composes freely); `:128-135` — ring0 ✗→ ring1; ring1 ✗→ ring3/admin only.
- `frontend/eslint-suppressions.json:62-66` — sole availability-adjacent entry is `src/components/profile/PersonalAvailabilityEditor.tsx` (Person layer; stays). Zero `components/schedule/` entries.
- Backend `schedule.py` (legacy dossier §3): RSVP endpoint blocks viewers explicitly; session create/update/delete = `require_can_manage_members` (lead/owner); availability GET/PUT = membership + viewer block on PUT. No backend change needed this slice.
