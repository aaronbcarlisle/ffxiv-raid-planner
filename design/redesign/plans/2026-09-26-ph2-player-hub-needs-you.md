# Stage 3 · PH2 — Player Hub "Needs you" (`GET /api/player/overview`)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** the Hub's Overview starts answering "what do I need to do, across my statics?". One new read-only endpoint, `GET /api/player/overview`, computes per request, over the caller's memberships, a short summary per static (current tier, next session, floors cleared this week, average BiS) and a list of action items of two types: `rsvp_pending` and `loot_priority`. The Overview gains a **Needs you · across your statics** card (`AttentionRow` rows, each deep-linking into that static), and the Your statics rows gain a one-line summary. It:
- adds `backend/app/services/player_overview.py` + `schemas/player_overview.py` + one route on the existing `/api/player` router; nothing else in the API changes shape;
- moves four priority-input helpers out of the plugin-facing loot router into a service module (a pure move; the router keeps importing them under their old names, so the plugin's `priority` endpoint is byte-identical);
- adds a Hub-local `usePlayerOverview` hook, a `NeedsYouCard`, and a summary line on `YourStaticsCard` rows. No V1-reached frontend file changes.

**Architecture:**
- **Task 1:** the endpoint, its schema, the static summaries (tier, next session, floors, average BiS), membership scoping, and the helper move. Backend only.
- **Task 2 (riskiest):** the two action-item builders, `rsvp_pending` (the recurrence-aware 7-day window) and `loot_priority` (the priority calculator's #1 on an unlogged drop). Backend only.
- **Task 3:** the frontend: `usePlayerOverview`, `NeedsYouCard`, `overviewFormat.ts`, the `YourStaticsCard` summary line, and the `HubOverview` grid change.

**PR split (planned now; the PH1 estimates ran ~2× on tests, PH1 plan Outcome):** three stacked draft PRs, one per task, as PH1 shipped. **PH2a** = this plan + Task 1 (backend). **PH2b** = Task 2 (backend). **PH2c** = Task 3 (frontend) + the write-back. PH2a and PH2b are additive and independently mergeable, since no UI calls the endpoint until PH2c. At Finish, the controller measures each task's diff and collapses adjacent PRs whose combined size is ≤ ~1,500 changed lines, then ledgers the result. One whole-branch review covers the slice (the last head vs `main`).

**Tech stack:** FastAPI (async SQLAlchemy, `CamelModel` schemas) · pytest + aiosqlite · React 19 · TypeScript · Vitest + Testing Library · ESLint 9 (boundaries: `profile/` = person layer; person → `ui/`, `services/`, `gamedata/`, `utils/` allowed).

**Spec (binding):** `design/redesign/specs/2026-09-25-player-hub-design.md` §4 (Needs you), §6 (PH2 data), §7 item 7, §8 (backend tests). Also `design/redesign/DESIGN_SYSTEM.md` §3.22 (`AttentionRow`: composed inside a `CardShell`, action `Button` with no trailing glyph, icon `aria-hidden`), `CLAUDE.md` § UI rules and § Pitfalls (plugin contract), and the PH1 plan's Outcome rulings (`plans/2026-09-26-ph1-player-hub-structure.md:137`).

**Plan-vet:** `xivrp-director`, 2026-09-26: **READY-WITH-FOLDS** (DRIFT). It raised 3 Majors, 10 minors and 1 OWNER, all folded in place:
- F1: the calculator gets the settings the client ranks with, not the raw blob (R-PH2-G).
- F2: the batched inputs cover the whole material log and a loot-log existence check (R-PH2-D).
- F3: the loot `href` carries no `week=` (premises row 8, R-PH2-G).
- F4: "logged" matches `lootFairness.ts` (any method).
- F5: the "from the calculator" test uses hand-computed ranks, plus a raw-settings mutation.
- F6: explicit lower bound; naive or unparseable starts are handled; `startsAt` is aware UTC.
- F7: Queues, not Who Needs It, shows the ranking (browser pass; carried deep link).
- F8: three PRs.
- F9: the rate limiter.
- F10: the `Profile.v2seam.test.tsx` hook mock; the PH1 negative assertions are kept.
- F11: the cold first frame.
- F12: unknown tiers skip floors and loot.
- F13: non-`/group/` items are filtered, not rendered dead.

F14 (OWNER) was ruled by the controller and ledgered; the PR body puts it to the owner (R-PH2-G skips, R-PH2-L copy). The citations were verified except rows 4 and 8, which are corrected below.

## Spec premises checked against the code

| Spec line | Code | Ruling |
|---|---|---|
| §6 `statics[].tierName` | The backend has no tier display names. `TierSnapshot.tier_id` is a slug (`models/tier_snapshot.py`), and the only names live in `frontend/src/gamedata/raid-tiers.ts` (`RAID_TIERS[].name`, `getTierById` `:208`). The backend already keeps one hand-synced mirror of that file (`TIER_FLOOR_NAMES`, `routers/loot_tracking.py:1606-1614`, "must match frontend") | **`tierId` replaces `tierName`.** The frontend resolves the name with `getTierById(tierId)?.name`, so the gamedata stays the single source and no second backend mirror is added |
| §6 `rsvp_pending`: "no RSVP from your linked player in that static" | `ScheduleRsvp` is keyed to `(session_id, user_id)` (`models/schedule.py:77-100`), not to a `SnapshotPlayer`. It is stored per **series** (no occurrence column). Viewers are never expected to RSVP (`_create_initial_rsvps` excludes them, `routers/schedule.py:679-700`). Sessions with `track_availability = false` are "fixed sessions where availability does not need to be collected" (`CreateSessionModal.tsx:646-649`) | "Your linked player" reads as **you, as a non-viewer member**. Pending = no `ScheduleRsvp` row for `(session.id, caller)`, any status, on a session with `track_availability` true whose next occurrence falls in the window. An RSVP on a recurring series covers every occurrence (the data model's meaning) |
| §6 "a session in the next 7 days" | Sessions store ISO text times. Recurring series expand on read (`services/recurrence.py` `next_occurrence` `:367`, which handles one-off sessions, RRULE series, `ScheduleException` cancellations and edits, and `after=` strictly-after). The one existing "next session" query (`routers/objective_goals.py:560-571`) ignores recurrence and cancellations | Both `nextSession` and `rsvp_pending` use `next_occurrence(after=now, exceptions=…, timezone_name=session.timezone)`. The window is **`now < start ≤ now + 7 days`**. `objective_goals.py` is not touched |
| §6 `loot_priority`: "#1 on this week's unassigned drop, via the existing priority calculator" | There is no unassigned-drop row: `LootLogEntry.recipient_player_id` is non-nullable. The calculator (`services/priority_calculator.py`, `calculate_floor_priority` `:517`) ranks needers per floor drop, but **omits two things the Loot tab applies**. (a) Enhanced scoring (drought/balance): the Loot tab adds it when `settings.enableEnhancedScoring === true && !isPriorityDisabled(settings) && lootLog.length > 0` (`FloorCard.tsx:86`, `RecipientPicker.tsx:221`). (b) Weapon priority lists (`_player_to_dict` docstring, `loot_tracking.py:1617-1622`). Also, in `disabled`/`manual-planning` modes every score is 0 (`priority_calculator.py:261-263`). **Settings (director F1):** the Loot tab ranks with `{...DEFAULT_SETTINGS, ...group.settings}` (`Loot.tsx:387`, `utils/constants.ts:26-40`). `group.settings` is what the API serializes: `settings_to_schema` → `None` for an empty blob, else `StaticSettingsSchema(**raw)` with schema defaults filled (`static_groups.py:102-106`). New statics store no settings (`staticGroupStore.ts:126`). The schema's own `loot_priority` default (melee, **ranged, caster**, tank, healer — `schemas/static_group.py:172-173`) differs from the client's (melee, **caster, ranged**, …). The plugin endpoint passes the raw blob, which yields an empty role order (`priority_calculator.py:300`, `loot_tracking.py:1688`). The Loot tab counts a drop as logged by **any** row for that slot at that week and floor (`utils/lootFairness.ts:30-44`; rings match `RING_SLOTS`; materials match `materialType`) | An "unassigned drop" is a floor drop with no log row of any method at the current week (the `lootFairness` rule, so the Hub and the floor's pending chip agree). The calculator gets the **client-effective settings** (R-PH2-G), never the raw blob. The Hub claims "#1" only where the backend's ranking **must** match the Loot tab's Queues view: never with enhanced scoring active, never in disabled or manual-planning mode, never for the floor-4 weapon, never on a tier missing from `TIER_FLOOR_NAMES`, and only when the caller is **strictly** first (a tie is not #1, since the tie order isn't guaranteed to match). Everything skipped is disclosed in the PR body and the write-back. The plugin endpoint's raw-settings divergence is **not** fixed here (the contract is frozen); it is carried as a ticket |
| §4 static rows: "floors cleared" | No cleared flag exists. V2's static Home counts a floor as cleared when an `earned` `PageLedgerEntry` exists for it at the week (`hooks/useWeeklyLootSummary.ts:28-40`). `mark-floor-cleared` writes exactly those rows (`loot_tracking.py:726-804`). Current week = `calculate_week_number(tier)` (`loot_tracking.py:106-112`) | `floorsCleared` = the number of distinct tier floors with an `earned` ledger row at the current week. That is the same rule as the static Home, so the two never disagree. `null` unless the active tier's `content_type == 'savage'` |
| §4 static rows: "average BiS" | No backend helper exists. V2's static Home footer uses `bisSlotTotals` (`utils/rosterReadiness.ts:59-68`): the active roster is configured and not a substitute; BiS slots have a non-null `bisSource`; obtained slots have `hasItem` | `avgBisPct = round(100 × obtained / total)` under exactly `bisSlotTotals`' rule; `null` when `total == 0` or there is no active tier. Python `round` is banker's rounding, so use `floor(x + 0.5)` to match JS `Math.round` |
| §6 "Loading, empty and error states follow `ShellContentStates` patterns" | `pages/ShellContentStates.tsx` is page-scoped and reads static/tier stores; nothing in `profile/hub/` can reuse it. The Hub precedent is `YourStaticsCard`'s inline skeleton / error banner / empty state (PH1) | The pattern is followed, not the component: a skeleton while loading with no data, an inline error with **Retry**, and `EmptyStateInvite` for empty (Home's attention card, `Home.tsx:345-365`) |
| §4 "RSVP → Schedule; #1 on a pending drop → Loot" | Session deep link: `/group/{code}?tab=schedule&sessionId={id}` (`SessionCard.tsx:116`, `SessionList.tsx:127`). The Loot tab is `tab=gear` (`useGroupViewState.ts:30-41`); its `lview` defaults to `priority` (`Loot.tsx:433`). The Priority view always uses the clock week, so **`?week=` does nothing there** (`Loot.tsx:29-31`, `:1504`). It would also pin the Log's override on first load (`useLogWeek.ts:307`) and leak into legacy History (`HistoryView.tsx:105,122`). Priority's sub-view (Who Needs It / Queues) is saved per user (`Loot.tsx:132,485`), and only **Queues** shows the ranking (`needMatrixData.ts:1-10`). There is **no `floor=` or Queues param** (director F3, F7) | `rsvp_pending.href = /group/{code}?tab=schedule&sessionId={id}` · `loot_priority.href = /group/{code}?tab=gear` (no `week=`, default `lview`). There is no floor or Queues deep link; both are carried |

## Rulings (bind every task)

- **R-PH2-A (scope = memberships).** The endpoint covers exactly the statics returned by `get_user_static_groups(session, user.id)` (`permissions.py:369-386`, membership rows, every role including viewer), in that helper's order. **Linked-only statics** (`get_user_linked_static_groups`, `permissions.py:389-408`: a `SnapshotPlayer.user_id` link without a membership) are **excluded** from `statics` and `actionItems`, because a non-member may not be able to view a private static; their Hub rows keep PH1's content. Admin owner-access (`isAdminAccess`) is not a membership, so it adds nothing here. Every query is filtered by the static-id set from that helper. No endpoint input is trusted, since the route takes none. `role` = the membership's role string; `memberCount` = `StaticGroup.member_count` (it needs `memberships` eager-loaded, as the helper already does).
- **R-PH2-B (helper move, plugin contract frozen).** Move `TIER_FLOOR_NAMES`, `calculate_week_number`, `_player_to_dict` and `_material_entry_to_dict` from `routers/loot_tracking.py` to a new `services/loot_context.py`. Add the public names `tier_floor_names(tier_id) -> list[str]` (the existing `F1S…F4S` fallback, `loot_tracking.py:1694`), `player_to_priority_dict`, `material_entry_to_priority_dict` and `calculate_week_number`. `loot_tracking.py` imports them back under the **old names** (`from ..services.loot_context import calculate_week_number, TIER_FLOOR_NAMES, player_to_priority_dict as _player_to_dict, material_entry_to_priority_dict as _material_entry_to_dict`), so every call site in the router is unedited. Bodies move verbatim. `test_priority.py`, `test_week_management.py` and every loot test stay green **unedited**. `priority_calculator.py` gains exactly one public wrapper, `get_effective_priority_mode(settings) -> str` (returns `_get_effective_priority_mode(settings)`), and is otherwise unchanged. No plugin-contract endpoint changes behavior.
- **R-PH2-C (response contract).** `schemas/player_overview.py`, all `CamelModel` (imported from `schemas/user.py`, as `schemas/player.py:5` does):
  - `OverviewNextSession { session_id: str, title: str, starts_at: str }` (`starts_at` = the occurrence's ISO start as `next_occurrence` returns it)
  - `OverviewStatic { id, share_code, name, role: str, tier_id: str | None, member_count: int, next_session: OverviewNextSession | None, floors_cleared: int | None, avg_bis_pct: int | None }`
  - `OverviewActionItem { type: Literal['rsvp_pending', 'loot_priority'], static_id, static_name, title, detail, href, starts_at: str | None }` (`starts_at` is set only for `rsvp_pending`)
  - `PlayerOverviewResponse { statics: list[OverviewStatic], action_items: list[OverviewActionItem] }`

  The wire JSON is camelCase (`shareCode`, `tierId`, `nextSession.startsAt`, `actionItems[].staticName`, …). `startsAt` on items is additive to spec §6 (the frontend formats times in the viewer's locale; the backend never formats a time into `detail`).
- **R-PH2-D (service shape and query budget).** `services/player_overview.py` exports `async def build_player_overview(session: AsyncSession, user_id: str, now: datetime) -> PlayerOverviewResponse`, with `now` timezone-aware UTC. The route passes `datetime.now(timezone.utc)`; tests pass fixed instants (the suite has no clock freezing). Queries are **batched over the static-id set**: a fixed number per request regardless of how many statics. The batches:
- membership + groups (the helper);
- active tiers (`is_active`);
- sessions, exceptions, and the caller's RSVPs for those sessions;
- players of the active tiers;
- `earned` ledger rows at the current week of each active tier;
- **the whole material log** of the active tiers (the calculator's input, `loot_tracking.py:1679-1685`);
- **a per-tier loot-log existence check** across all weeks (the enhanced-scoring gate);
- loot-log rows at each tier's current week (the "logged" check).

The week filter is applied in Python per tier, or with an `OR` of `(tier_snapshot_id, week_number)` pairs. There is no per-static query loop. The priority calculation runs in Python per tier.
- **R-PH2-E (static summaries, Task 1).** For each static: the **active tier** = the one `TierSnapshot` with `is_active` (none → `tier_id`, `floors_cleared` and `avg_bis_pct` all `null`). **`next_session`** = the earliest `next_occurrence(after=now)` over all the static's sessions (regardless of `track_availability`), skipping a `None` result. `session_id` = the series id, `title` = the occurrence's title (edits applied). **`floors_cleared`** and **`avg_bis_pct`** per the premises table. `floors_cleared` is also `null` when `tier.tier_id` is not a key of `TIER_FLOOR_NAMES`: the `F1S…` fallback never matches logged floor names (director F12). Current week = `calculate_week_number(tier)`, the same number the Loot tab and the plugin use. It reads the **wall clock** (`loot_tracking.py:110`), not `now`, so tests seed ledger and log rows at `calculate_week_number(tier)` and use the fixed `NOW` only for session windows. `next_session.starts_at` is normalized as in R-PH2-F.
- **R-PH2-F (`rsvp_pending`, Task 2).** For each static where `role != 'viewer'`, and for each session with `track_availability` true: take the occurrence `occ = next_occurrence(after=now, …)`. Emit an item when all three hold:
- `occ` is not `None`;
- **`now < occ.start ≤ now + 7 days`**. Both bounds are explicit: an `edited` override can move the next occurrence into the past, because `recurrence.py:311` filters on the slot, not on the override start (director F6);
- no `ScheduleRsvp(session_id, user_id=caller)` exists (any status).

**Parsing (shared with R-PH2-E):** one helper parses `occ.start_time` to an aware datetime. A naive value is read as UTC. A value that doesn't parse skips that session (logged at `warning`), and the endpoint never 500s (`start_time`/`override_start_time` are unvalidated strings, `schemas/schedule.py:74,165`). Comparisons use datetimes, never ISO strings. `starts_at` on the wire is that datetime converted to UTC `isoformat()` (always offset-aware, so `new Date()` reads it right). One item per session. Fields:
  - `title` = `RSVP for {occ.title}`
  - `detail` = `No response yet`
  - `starts_at` = `occ.start_time`
  - `href` = `/group/{share_code}?tab=schedule&sessionId={session.id}`
- **R-PH2-G (`loot_priority`, Task 2).** **Effective settings (director F1).** The service ranks with the settings the client ranks with: `effective = {**CLIENT_DEFAULT_PRIORITY_SETTINGS, **served}`.
  - `served` is what the API sends as `group.settings`: `{}` when the raw blob is empty or `None`, else `StaticSettingsSchema(**raw).model_dump(by_alias=True)`, with the same `None` handling the static-group response serializes (check that response's `exclude_none` behavior and mirror it).
  - `CLIENT_DEFAULT_PRIORITY_SETTINGS` is a module constant in `services/loot_context.py` mirroring the priority-relevant keys of `frontend/src/utils/constants.ts` `DEFAULT_SETTINGS` (`lootPriority` = melee, caster, ranged, tank, healer; `priorityMode`; and every other key `priority_calculator.py` reads that `DEFAULT_SETTINGS` sets). Its comment says "must match `frontend/src/utils/constants.ts` DEFAULT_SETTINGS", in `TIER_FLOOR_NAMES`' style.
  - The plugin endpoint keeps passing the raw blob; it is not touched (carried as a ticket).

  For each static whose active tier has `content_type == 'savage'` **and** a `tier_id` in `TIER_FLOOR_NAMES` (director F12), skip the static when any of these holds:
  - no `SnapshotPlayer` in that tier has `user_id == caller`, `configured` and not `is_substitute` (the caller's players; normally one);
  - `get_effective_priority_mode(effective)` is `disabled` or `manual-planning`;
  - enhanced scoring is active, meaning the frontend's condition: `effective["enableEnhancedScoring"] is True` and the tier has ≥ 1 loot-log row in any week.

  Otherwise, build the calculator inputs the way the plugin `priority` endpoint does (`loot_tracking.py:1647-1721`): configured, non-substitute players via `player_to_priority_dict` and the tier's **whole** material log via `material_entry_to_priority_dict`, but with **`effective`**, not the raw blob. Call `calculate_floor_priority(players, floor, settings, material_log)` for **floors 1–3** (floor 4 is the weapon, whose lists the calculator does not model). A drop key counts when all three hold:
  - its list is non-empty;
  - `entries[0]["playerId"]` is one of the caller's players;
  - the caller is strictly first: `len(entries) == 1 or entries[0]["score"] > entries[1]["score"]`.

  It is **unlogged** when no row of **any method** at `(tier, current week, floor name)` records it, which is the `utils/lootFairness.ts:30-44` rule (director F4). For gear, that is a `LootLogEntry` whose `item_slot` equals the key; `ring` matches every slot in the frontend's `RING_SLOTS` (read its definition and mirror it). For materials, it is a `MaterialLogEntry` whose `material_type` equals the key. Floor names come from `tier_floor_names(tier.tier_id)[floor - 1]`. One item per static, when ≥ 1 drop counts:
  - `title` = `You're first in line for {N} drop` / `drops`
  - `detail` = up to three `{floor} {label}` joined by ` · `, in floor order then the calculator's drop order, plus ` · +{N-3} more`. Labels: `earring` Earring, `necklace` Necklace, `bracelet` Bracelet, `ring` Ring, `head` Head, `hands` Hands, `feet` Feet, `body` Body, `legs` Legs, `glaze` Glaze, `twine` Twine, `solvent` Solvent, `universal_tomestone` Universal Tomestone.
  - `href` = `/group/{share_code}?tab=gear` (no `week=`, per premises row 8)
  - `starts_at` = `None`
- **R-PH2-H (item order).** `rsvp_pending` items by `starts_at` ascending, then `loot_priority` items by `static_name` (case-insensitive). No cap.
- **R-PH2-I (frontend data: a Hub-local hook, no store).** `components/profile/hub/usePlayerOverview.ts` exports the wire types (`PlayerOverview`, `OverviewStatic`, `OverviewActionItem`) and `usePlayerOverview(): { data: PlayerOverview | null; isLoading: boolean; error: string | null; retry: () => void }`. **It starts with `isLoading: true`** so the cold first frame is a skeleton, never the empty state (director F11; the PH1 Outcome's cold-frame lesson). It fetches `api.get<PlayerOverview>('/api/player/overview')` (the path style `personalAvailabilityStore.ts:35` uses) on mount and on `retry`, and ignores a response that lands after unmount or after a newer request (a request counter). The data is **component state, not a Zustand store**: it is time-sensitive, only the Overview reads it, and a store would need the signed-in-user guard PH1 had to add to `AppChrome` (Outcome ruling). `HubOverview` calls the hook once and passes the data down as props. `types/index.ts` is not touched.
- **R-PH2-J (Needs you card, Task 3).** `NeedsYouCard.tsx` = `CardShell title="Needs you"` with `icon` = the lucide `BellRing` (14 px) and `headerRight` = `<span className="text-xs text-text-muted">Across your statics</span>`. Rows are `AttentionRow`s in a `flex flex-col divide-y divide-border-subtle` list (Home's markup, written fresh, not imported from `home/`, per ring 0):
  - icon: `CalendarClock` (rsvp) / `Gem` (loot)
  - `title`: `<>{item.title} <Tag variant="label">{item.staticName}</Tag></>` (the static tag)
  - `meta`: rsvp → `{formatSessionStart(startsAt)} · {detail}`; loot → `{detail}`
  - `action`: `{ label: 'RSVP' | 'View loot', onClick }`

  `onClick` calls `navigate(item.href)`. Items whose `href` doesn't start with `/group/` are **filtered out before rendering**, so no dead action button ever shows (director F13; `AttentionRow` requires an `action`). The backend only builds `/group/…`, so the filter is defensive. If every item is filtered out, the empty state shows. States:
  - `!data && !error` (loading, including the cold first frame) → two skeleton rows (`animate-pulse`, as `YourStaticsCard`);
  - `error && !data` → a one-line `text-sm text-text-secondary` "Couldn't load what needs you." + `Button size="sm" variant="secondary"` **Retry** (`retry`);
  - `data.actionItems.length === 0` → `EmptyStateInvite` with the `BellRing` icon, title `Nothing needs you right now.` and description `Session RSVPs and loot you're first in line for show up here.`;
  - `error` with stale `data` → keep the rows (a refetch that fails does not blank the card).
- **R-PH2-K (Overview grid, Task 3).** In `HubOverview`, the main-area wrapper becomes one `div` with `min-[1181px]:col-span-2 self-start flex flex-col gap-4` holding **`NeedsYouCard` then `YourStaticsCard`**. The side stack (column 3) and the grid class string are unchanged. `NeedsYouCard` renders only when `groups.length > 0` from `useStaticGroupStore` (a static-less user sees PH1's L-2 empty state alone). In `HubOverview.test.tsx:94-100`, only the "no Needs you" expectation is replaced. Its "Profile status", "Raider Snapshot" and Activity negatives stay (spec §7 item 4). Together with R-PH2-N's mock, these are the only PH1 test edits.
- **R-PH2-L (Your statics summary line, Task 3).** `YourStaticsCard` takes an optional `overviewById?: ReadonlyMap<string, OverviewStatic>`. Under a row's existing name/role/count block it adds one `text-xs text-text-muted` line joining, with ` · `, only the parts present:
  - the tier name: `getTierById(tierId)?.name`; an unknown id → part omitted;
  - `Next {formatSessionStart(nextSession.startsAt)}`;
  - `{floorsCleared}/{getTierById(tierId)?.floors.length ?? 4} floors this week`;
  - `{avgBisPct}% of BiS slots` (`0%` renders; guard with `!= null`, never `&&`). The copy is deliberate: it is a share of BiS slots, not the static Home's "At full BiS" share of raiders (`RosterReadinessCard.tsx:39`). Director F14 flags this for the owner, and the PR body asks.

  No parts, or no entry for the row → no line (loading, error and linked-only rows look exactly like PH1). The rows still come from `useStaticGroupStore` (kebab, Enter and order unchanged).
- **R-PH2-M (formatting, one copy).** `components/profile/hub/overviewFormat.ts` exports `formatSessionStart(iso: string): string` = `Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))`. Both cards use it. Tests normalize U+202F (narrow no-break space) before comparing (memory `reference_intl_narrow_nbsp`), or build the expectation with the same `Intl` call.
- **R-PH2-N (V1 and shared scope).** No V1-reached frontend file changes. Frontend files touched: `components/profile/hub/{HubOverview,YourStaticsCard}.tsx` + tests, and the new `usePlayerOverview.ts`, `NeedsYouCard.tsx`, `overviewFormat.ts` + tests. Also `pages/Profile.v2seam.test.tsx`, pre-authorized for **one** addition only: a `vi.mock` of `usePlayerOverview` returning `{ data: null, isLoading: false, error: null, retry }`. That test renders the real `HubOverview`, so the hook would otherwise make an unmocked `api.get` (director F10). If any other test that mounts `HubOverview` makes a real call, add the same mock there and list it in the report. **Read-only:** `components/ui/*`, `components/primitives/*`, `components/home/*`, stores, `gamedata/*`, `services/api.ts`. Backend files touched: the new service/schema modules, `routers/player.py` (one route), `routers/loot_tracking.py` (R-PH2-B import swap only), `services/priority_calculator.py` (the one wrapper), and `tests/factories.py` (new factories). Any other file needs a NEEDS_CONTEXT report. `backend/app/database.py`: untouched (owner approval rule).
- **R-PH2-O (no clones).** jscpd runs at `minTokens: 50, minLines: 5`. Never copy a block from `Home.tsx`, `YourStaticsCard.tsx`, `loot_tracking.py` (the helper move is a move, not a copy; the old bodies are deleted) or `objective_goals.py`. Every task report pastes the `pnpm -C frontend dupes` count, which stays **≤ 326**.

## Review Focus

- R-PH2-A: can any byte of a non-member's static reach the response (a linked-only static, another user's static, a static you left)? Is every query filtered by the membership id set?
- R-PH2-B: is the move byte-identical in behavior? Diff the moved bodies, and check that `test_priority.py` and the loot tests are unedited and green.
- R-PH2-F: the window edges (`now` exclusive, `now + 7d` inclusive), recurring series with a past base start, cancelled/edited occurrences, `track_availability`, viewers, and RSVP of any status.
- R-PH2-G: can the Hub say "#1" when the Loot tab's Queues view shows someone else first? Check that the effective settings mirror the client for a `None`, a partial and a full blob, plus enhanced scoring, ties, modes, the weapon and unknown tiers. Can it miss a logged drop (ring slots, any method)?
- R-PH2-J/K/L: states (loading / error / empty / stale-on-error), the href guard, `0%` rendering, and the static-less case.

## Task 1 — Endpoint, static summaries, scoping, helper move (`xivrp-implementer`, sonnet)

Files: `backend/app/services/loot_context.py` (new), `backend/app/routers/loot_tracking.py` (import swap), `backend/app/services/priority_calculator.py` (the one wrapper), `backend/app/services/player_overview.py` (new), `backend/app/schemas/player_overview.py` (new), `backend/app/routers/player.py` (the route), `backend/tests/factories.py` (add `create_schedule_session`, `create_schedule_exception`, `create_schedule_rsvp`, `create_page_ledger_entry`, `create_material_log_entry` where missing), `backend/tests/test_player_overview.py` (new).

1. **Move (R-PH2-B).** Move first and run `pytest tests/test_priority.py tests/test_week_management.py` plus every `tests/test_loot*.py`, unedited. Paste the result line.
2. **Schema + route (R-PH2-C).** `@router.get("/overview", response_model=PlayerOverviewResponse)` in `routers/player.py`, with `@limiter.limit(RATE_LIMITS["general"])` and a `request: Request` parameter as every player route has (director F9), and `Depends(get_current_user)` and `Depends(get_session)` as `GET /profile` (`player.py:299-309`). It returns `await build_player_overview(session, current_user.id, datetime.now(timezone.utc))`. In this task `build_player_overview` returns `action_items=[]`.
3. **Summaries (R-PH2-A, D, E).** Tests in `test_player_overview.py`. Service-level tests call `build_player_overview(session, user.id, NOW)` with a fixed aware `NOW`; route-level tests use `client` + `auth_headers` (`conftest.py:237-241`).
   - unauthenticated → 401;
   - only the caller's membership statics appear: another user's static with a tier, sessions and players is absent; a linked-only static (a `SnapshotPlayer.user_id` link, no membership) is absent; a viewer membership is present with `role == 'viewer'`;
   - `memberCount`;
   - `tierId` from the active tier only (an inactive tier is ignored); no tier → `tierId`, `floorsCleared`, `avgBisPct` all `null`;
   - `nextSession`:
     - a one-off future session;
     - a past one-off → `null`;
     - a weekly series whose base start is two weeks before `NOW` → the next occurrence after `NOW`;
     - that occurrence cancelled via `ScheduleException` → the one after;
     - two sessions → the earlier;
   - `floorsCleared`: `earned` rows at `calculate_week_number(tier)` on two floors (two rows on one floor count once) → 2; `spent` rows and other weeks ignored; `content_type='ultimate'` → `null`; a `tier_id` not in `TIER_FLOOR_NAMES` → `null`;
   - `nextSession.startsAt` is offset-aware UTC; a naive stored `start_time` is read as UTC; an unparseable one is skipped and the endpoint still returns 200;
   - `avgBisPct`: a two-player roster with hand-computed slots (e.g. 5 of 8 BiS slots → 63). A substitute and an unconfigured player are excluded; a slot with `bisSource: None` is not counted; `total == 0` → `null`; 62.5 rounds to 63 (the `floor(x + 0.5)` rule);
   - the wire JSON is camelCase (`shareCode`, `nextSession.startsAt`, `actionItems`).
4. **Query budget (R-PH2-D).** One test creates three statics and asserts, via a SQLAlchemy `before_cursor_execute` event counter on the test engine, that the statement count is the same for one static and for three.

Size: ~550–650 lines incl. tests.

## Task 2 — Action items: `rsvp_pending`, `loot_priority` (RISKIEST · `xivrp-implementer-deep`, `model: fable`)

Files: `backend/app/services/player_overview.py`, `backend/app/services/loot_context.py` (add `CLIENT_DEFAULT_PRIORITY_SETTINGS` and the effective-settings helper), `backend/tests/test_player_overview.py` (a new `TestRsvpPending` / `TestLootPriority` pair), and `backend/tests/factories.py` if a factory is missing.

1. **`rsvp_pending` (R-PH2-F).** Each test uses one member and a fixed `NOW`.
   - Session starts:
     - `NOW + 1h` → one item;
     - exactly `NOW` → none (the lower bound is exclusive);
     - `NOW − 1 min` → none;
     - `NOW + 7d − 1 min` → item;
     - exactly `NOW + 7d` → item;
     - `NOW + 7d + 1 min` → none.
   - RSVPs and settings:
     - an existing RSVP by the caller in each of `available`, `tentative` and `unavailable` → none;
     - another user's RSVP → the caller's item is still present;
     - `track_availability=False` → none;
     - a viewer membership → none.
   - Recurrence:
     - a weekly series with a past base start whose next occurrence is `NOW + 2d` → one item with `startsAt` = that occurrence;
     - that occurrence cancelled (the one after is `NOW + 9d`) → none;
     - an `edited` exception moving it to `NOW + 8d` → none;
     - an `edited` exception moving it to `NOW − 1h` → none;
     - a daily series → exactly one item (the next occurrence).
   - Scope and shape:
     - a session in a static the caller is not a member of → none;
     - `href` and `title` exactly as ruled;
     - order by `startsAt` across two statics.
2. **`loot_priority` (R-PH2-G).** Fixture: a savage tier (a tier id in `TIER_FLOOR_NAMES`), a roster where the caller's configured player needs floor-1 `earring` and floor-2 `head`, and a second player with a lower score for both. Seed log rows at `calculate_week_number(tier)`, which reads the wall clock.
   - The item lists `M9S Earring · M10S Head`.
   - **Ranks are hand-computed, never re-derived from the calculator (director F5):** each test states the expected first player from the fixture's role order and gear, and the comments show the arithmetic.
   - **`settings = None` (the common case, director F1):** a caster caller against a ranged player with equal gear need. The client default order (melee, caster, ranged, …) makes the caster strictly first, so the item is present. Under the schema default (ranged before caster) or the raw `{}` blob, the order would differ or tie.
   - **A partial blob** (e.g. only `{"hideSetupBanners": true}`): the schema defaults fill it exactly as the API serves it, and the test states the resulting order.
   - Any-method logging: an earring row at the current week (`drop` and, separately, `book`) → earring no longer listed; the same row at the previous week → still listed.
   - A ring row logged as `ring1` (and one as `ring2`) → the ring is no longer listed.
   - A `tier_id` not in `TIER_FLOOR_NAMES` → none.
   - A tie at the top → none.
   - Another player strictly first → none.
   - `manual-planning` and `disabled` modes → none.
   - `enableEnhancedScoring: True`: with ≥ 1 loot-log row → none; with no rows → the item is present.
   - The caller's player is a substitute or unconfigured → none.
   - No linked player → none.
   - `content_type='ultimate'` → none.
   - A floor-4 weapon need never appears.
   - More than three drops → `· +N more`; `N drop`/`drops` pluralization.
   - `href` is exactly `/group/{code}?tab=gear` (no `week=`).
3. **Order (R-PH2-H).** Two rsvp items and two loot items across statics named `beta` and `Alpha` → the rsvp items first by time, then `Alpha`'s loot item, then `beta`'s.

**Mutation check (slice-loop rule 6, riskiest task only):** three single mutations, each reverted after its run:
- flip the window comparison to `<` at the upper edge;
- drop the strict-first check;
- pass the raw `group.settings` blob instead of `effective`.

Run the edge test, the tie test and the `settings = None` test, and paste all three failures in the report.

Task-scoped `redesign-reviewer` pass after this task (slice-loop §1.4). Size: ~550–650 lines incl. tests.

## Task 3 — Frontend: hook, Needs you card, row summary (`xivrp-implementer`, sonnet)

Files: `frontend/src/components/profile/hub/usePlayerOverview.ts` (new), `NeedsYouCard.tsx` (new), `overviewFormat.ts` (new), `HubOverview.tsx`, `YourStaticsCard.tsx`, and tests: `usePlayerOverview.test.ts`, `NeedsYouCard.test.tsx`, `overviewFormat.test.ts`, `HubOverview.test.tsx`, `YourStaticsCard.test.tsx`. `services/api` is mocked with `vi.mock`, as the repo does (no MSW).

1. **Hook (R-PH2-I).**
   - Calls `api.get('/api/player/overview')` once on mount.
   - `isLoading` is true on the **first render** (before the effect runs), then data.
   - A rejection sets `error` and leaves `data` as it was.
   - `retry` refetches.
   - A response resolving after unmount sets nothing (no act warning).
   - An older response resolving after a newer one is ignored.
2. **Card (R-PH2-J).**
   - Loading skeleton; error + Retry calls `retry`; empty → `Nothing needs you right now.`.
   - Rows: title text, the static `Tag`, the rsvp meta (the formatted start + ` · No response yet`) and the loot meta.
   - Action labels `RSVP` / `View loot`.
   - Clicking each action calls `navigate` with **exactly** the item's `href` (one test per type).
   - An item whose href doesn't start with `/group/` is not rendered; if it is the only item, the empty state shows.
   - `{ data: null, error: null, isLoading: false }` (a cold frame) → the skeleton, never the empty state.
   - `error` with stale data keeps the rows.
   - The icon slot is `aria-hidden`; the action is a real `button`.
3. **Grid + rows (R-PH2-K, L).**
   - `HubOverview.test.tsx`: with statics, the main-area column holds "Needs you" above "Your statics" (DOM order), and the side stack is unchanged; with zero statics, there is no "Needs you"; the PH1 negatives for "Profile status", "Raider Snapshot" and Activity still pass.
   - `Profile.v2seam.test.tsx` and every other suite that mounts `HubOverview`: green with the hook mocked, and no real `api.get` (R-PH2-N).
   - `YourStaticsCard.test.tsx`: all four parts in order; partial parts; `avgBisPct: 0` renders `0% BiS`; an unknown `tierId` omits the tier part; no `overviewById` entry → no summary line and the PH1 row unchanged.
   - `overviewFormat.test.ts`: one fixed ISO string against the same `Intl` options, with U+202F normalized.

Size: ~500–600 lines incl. tests.

## Finish (controller)

1. **Browser pass.** Start the backend per `SESSION_HANDOFF.md`, then dev-auth → `/profile?shell=v2`. Seed through the UI or the API as the dev user, not the DB: an upcoming session with no RSVP, and a roster where the dev user's player is strictly first on a floor-1 drop. Check 1440×900 and 2560×1440 in both themes:
   - the card with rows, the empty state (after RSVPing), and the error state (stop the backend, then Retry);
   - both actions land on the right tab (Schedule with the session open; the Loot tab's Priority view);
   - **the Hub's "#1" claim matches the Loot tab's Queues view** for the same drops, both on a static with saved settings and on one with **no saved settings** (director F7, F1);
   - the Your statics summary line;
   - the static-less dev user (no card).
   - V1 (`?shell=legacy`) `/profile` and `/dashboard` unchanged; 0 console errors.
2. **Shots** → `docs/redesign/pr-shots/ph2-*.webp` (light + dark: the card with rows, the empty state, the summary line), shrunk per `pr-checklist`.
3. **Write-back (once):**
   - spec §6: `tierId` for `tierName`, `startsAt`, the membership-only scope, the `rsvp_pending` and `loot_priority` definitions including every skip condition;
   - spec §4: the card and summary line as built;
   - spec §9: the carried items below;
   - `ROLLOUT_ROADMAP.md` §7: PH2 status + carried;
   - `V2_COVERAGE_PLAN.md` Stage 3: what PH2 did.
4. `pr-checklist` skill: the release note (the skill decides public vs `internal: true`), `git diff --check`, gates, draft PR(s) per the split rule above, ready once each. The PR body discloses every `loot_priority` skip condition and the membership-only scope.

**Carried out of PH2 (homes):** "Your BiS is out of date" (the rule is undefined, spec §6) → a later Stage-3 slice once defined. `loot_priority` under enhanced scoring and for weapons (needs the backend calculator to port drought/balance and weapon priorities, or a parity suite) → a later slice with the plugin's priority work. A `floor=` / Queues deep link into the Loot tab → Loot polish. The plugin `priority` endpoint ranks with the raw settings blob, so a static with no saved settings gets an empty role order, which diverges from the Loot tab (director F1). That goes to a plugin-contract ticket; it isn't fixed here because the contract is frozen. The `objective_goals.py` next-session query that ignores recurrence and cancellations → a backend bug ticket (not touched here).

**Gates (on the branch, pasted into the PR body):**
- `pnpm -C frontend build` ✓
- `pnpm -C frontend lint`: 0 errors, warnings ≤ 809
- `pnpm -C frontend check:design-system:strict` ✓
- `pnpm -C frontend test`: all green (≥ 3,584 + the new tests)
- `pnpm -C frontend deadcode` ≤ 8 files / 179 exports / 139 types
- `pnpm -C frontend dupes` ≤ 326 clones
- backend `pytest tests/ -q`: all green, with `test_priority.py` and the loot tests unedited
- `ruff check` on the touched backend files: no new F-errors
- V1 `/profile` + `/dashboard` unchanged
- light + dark shots of every touched surface

**Budget:** ~1,600–1,900 changed lines (code + tests) + docs across the slice at plan estimates, or ~3,000+ at PH1's measured 2×. Planned as three stacked PRs, one per task (PH2a ~550–650 est., PH2b ~550–650, PH2c ~500–600), each under the ~1,500 cap even at 2×. Adjacent PRs collapse at Finish when their measured sum is ≤ ~1,500.

## Outcome (2026-09-26)

- **Size and split.** Measured: plan +279; Task 1 +1,042/−52; Task 2 +834/−29; Task 3 +635/−7; the fix wave +114/−54 (backend +53/−8, frontend +61/−46). No adjacent pair fits under ~1,500, so the stack stays at three PRs, each with its own `internal: true` release note (2.1.40–2.1.42):
  - **PH2a** #286 = this plan + Task 1;
  - **PH2b** #287 = Task 2 + the backend fix-wave commit;
  - **PH2c** #288 = Task 3 + the frontend fix-wave commit + this write-back + the shots.
- **Rulings that bind later slices:**
  - A backend echo of a Loot-tab ranking ranks with the **client-effective** settings (`effective_priority_settings` in `services/loot_context.py`: the client `DEFAULT_SETTINGS` mirror with the served settings on top), never the raw blob. The two diverge for a static with no saved settings.
  - "Logged" means logged by any method (`utils/lootFairness.ts`).
  - Where the backend port cannot reproduce the client's ranking, the item is suppressed, never guessed: enhanced scoring, ties, the weapon, and the `disabled` and `manual-planning` modes.
- **Reviews:**
  - Task 2, task-scoped: 0 C / 0 I / 5 M.
  - Whole branch: 0 C / 0 I / 8 M, spec compliant on all three tasks.
  - One fix wave, which the owner asked for. It addressed 7 of 8. The residual Minors are in the PR bodies: a still-maskable `aria-hidden` assertion, the material-log test's setup, one comment's wording, the mount request id, and the hook's now-unread `isLoading`.
- **Browser pass: PASS** at 1440 and 2560, in both themes.
  - The Hub's #1 matched the Loot tab's Queues view on a static with saved settings, and on one without, where the client and schema default role orders disagree.
  - An RSVP and two skip paths (the disabled mode, an unclaimed player) cleared their items live.
  - Error with Retry, the static-less user, and V1 `/profile` + `/dashboard` all checked out, with 0 console errors.
  - On an exact tie, Queues shows a tiebroken #1 while the Hub stays silent. That goes to the owner as part of F14.
