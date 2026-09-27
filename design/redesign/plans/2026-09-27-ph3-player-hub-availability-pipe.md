# Stage 3 · PH3 — Player Hub availability pipe + `bis_stale`

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** a player's typical week, set once on the Hub, feeds every static's schedule heatmap, and the Hub's Needs you card tells a player when their own BiS set is older than loot they have since received. Two independent changes:
- the availability range endpoint learns to **layer** each member's dated rows over the member's personal template, converted from the template's saved timezone to UTC per date, at read time, behind an opt-in flag that only V2 sends (spec §10.1–§10.2, H-9, H-10). This closes the F6e §6.3 flip-blocker item 1 (`specs/2026-07-02-f6e-schedule-design.md:248-250`): the legacy grid is no longer the only editor feeding the heatmap;
- the player overview endpoint gains a third action item, **`bis_stale`** (spec §10.3, H-8 as amended), and the Needs you card renders it.

Nothing is written by either change. No V1-reached frontend file changes behavior. The plugin contract (`auth/me`, `static-groups`, tier `priority`, gear, `loot-log`, `material-log`, `mark-floor-cleared`, `plugin/collections/sync`) is untouched.

**Architecture:**
- **Task 1 (riskiest):** the pipe, backend. A pure layering + conversion module, wired into `list_availability` behind `include_templates`; the `source` field; two factories; tests. Backend only.
- **Task 2:** the pipe, frontend. The store's flag writing a separate `layeredData`, V2's two fetch sites and its one read site, the widened TS type, the Hub copy behind a V2-only prop; browser pass in a non-UTC timezone. No V1-reached behavior change (two mutation checks prove it).
- **Task 3:** `bis_stale`, backend + frontend. The context loads the caller's active Hub BiS sets and their roster players' loot-log timestamps in two batched queries; the builder, the sort, the schema type; the card's label, icon, key, href filter and empty-state copy; tests.

**PR split (planned now):** three stacked draft PRs, one per task, as PH1 and PH2 shipped. **PH3a** = this plan + Task 1. **PH3b** = Task 2 **+ the pipe write-backs** (F6e §6.3 item 1 closed, `V2_COVERAGE_PLAN.md:120`, `ROLLOUT_ROADMAP.md:362`), so the flip-blocker closes only in the PR that completes the pipe. **PH3c** = Task 3 + its own write-backs (`ROLLOUT_ROADMAP.md:377`, spec §9). PH3a is additive and independently mergeable (no UI sends the flag until PH3b). PH3c does not depend on PH3a/b and may be re-based onto `main` if the pipe stalls; doing so closes nothing about the pipe. At Finish the controller measures each task's diff and collapses adjacent PRs whose combined size is ≤ ~1,500 changed lines, then ledgers the result. One whole-branch review covers the slice (the stack's head vs `main`).

**Tech stack:** FastAPI (async SQLAlchemy, `CamelModel` schemas) · Python `zoneinfo` (`tzdata==2026.4` is pinned, `backend/requirements.txt:118`) · pytest + aiosqlite · React 19 · TypeScript · Zustand · Vitest + Testing Library · ESLint 9 boundaries (`profile/` = person layer; person must not import `schedule/` (ring1) — `eslint.config.js:127-131`).

**Spec (binding):** `design/redesign/specs/2026-09-25-player-hub-design.md` §2 (H-7…H-10, as amended 2026-09-27), §6 (PH3 line), §7 items 8–10, §8 (PH3 tests), §9 (carried), **§10**. Also `CLAUDE.md` § UI rules and § Pitfalls (plugin contract, `n > 0 &&`, LF), and the PH2 plan's rulings R-PH2-A/D/G/H/I/J/O (`plans/2026-09-26-ph2-player-hub-needs-you.md:52-128`), which keep binding the overview endpoint and the Hub. **R-PH2-N's read-only list is superseded here only for `stores/availabilityStore.ts` and `types/index.ts`.**

**Plan-vet:** `xivrp-director`, 2026-09-27: **NOT READY (SHARED-DRIFT)** on the first draft — 2 OWNER, 6 Major, 8 minor — all resolved in this revision:
- OWNER-1 (timezones: dated rows are UTC, templates local) → the owner chose server-side conversion of the personal template and dropped the static template from the pipe (H-9 amended, R-PH3-B).
- OWNER-2 (the roster `BiSTargetSet` is lead-managed and not what priority reads) → the owner chose the Hub's own per-job set (H-8 amended, R-PH3-G); the copy drops "priority may be wrong"; `href` → the Hub's Characters & gear tab.
- F1 the Hub tab renders under V1 → a V2-only prop (R-PH3-F). F4 `?tab=gear` is Loot → superseded by OWNER-2's href. F5 pipe write-backs on a re-basable PR → PH3b (PR split). F6 the shared store leaks layered rows into the legacy grid → `layeredData` (R-PH3-F). F7 statement count → one joined members statement, count asserted as a delta (R-PH3-D). F8 flag-off order within a date is unspecified → the parity test sorts by `userId`. F9 viewer exclusion confirmed against every heatmap denominator (`Schedule.tsx:188`, `availabilityUtils.ts:101`, `AvailabilityGrid.tsx:156-159`); spec §10.1 corrected now. F10 `id: null` is safe (nothing reads the row id); the PUT response also gains `source` (R-PH3-A). F11 viewers can claim a roster player → skipped like `_build_rsvp_items` (R-PH3-G). F12 the savage gate had no reason → gate on an active tier only. F13 untested promises → set-active route test, Task 3 browser pass, the empty-state copy, the side card's no-link. F14 tile copy → exact strings (R-PH3-F). F15 eight citations corrected. F16 Task 2 mutation checks added.
**Re-vet, 2026-09-27: READY-WITH-FOLDS** (4 Major, 7 minor, 1 OWNER), folded in place: M1 the de-dup case is the spring-forward gap, not the fall-back (test + mutation check e); M2 bad template rows (zone `"America"`, slots like `"25:00"`) must not 500 (R-PH3-B, tests, mutation check f); M3 the `Schedule.tsx:462` copy (R-PH3-F); M4 the Hub set is edited through `routers/bis_targets.py` and the set-active route is `/api/bis-targets/{id}/set-active` (premises, Task 3); m1 the delta is 1 with no members (unreachable, R-PH3-D); m2 the four `Schedule.tsx` read lines, a conflicting-fixture Best Times assertion and two stale comments (Task 2); m3 the tighter `/profile` filter (R-PH3-H); m4 the browser seed needs the timezone (Task 2 step 6); m5 factory facts (Task 3); m6 spec §9 wording; m7 roadmap `:362` wording and PH3c's coverage-plan write-back (Finish). **OWNER O1:** a painted local day writes two UTC dates for a non-UTC player and hides the neighbouring template day's early or late slots on them; the owner **accepted** it (recorded in spec §9; the carried exceptions editor stores the painter's timezone and fixes it). Verified by the re-vet: every Task 1 expected value, the ±1-day window for UTC−12…+14, `fold=0` parity with JS, the `layeredData` reader set, `profile_id` always set on Hub sets, nothing else depending on `/group/` hrefs, sizing.

## Spec premises checked against the code

| Spec line | Code | Ruling |
|---|---|---|
| §10.1 "Off: byte-identical to today's" (first draft) | `UserAvailabilityResponse` (`schemas/schedule.py:213`) is the schema for every row, and for the PUT response (`schedule.py:1571`); a new field appears in the JSON whether or not the flag is set | **Corrected in the spec:** flag off = the same rows and values plus the additive `source: "dated"`; the PUT response gains it too. TS types are structural, so V1's consumers ignore it |
| §10.1 "copied 1:1" (first draft) | The grid converts local slots to UTC on save (`availabilityUtils.ts:156-170` `localSlotToUtc`, `:220-231` `localSlotsToUtcMap`; `AvailabilityGrid.tsx:304-305`) and the heatmap converts back (`utcSlotToLocal`, `availabilityUtils.ts:172-189,254-344`). The personal editor saves local `HH:MM` slots plus `getBrowserTimezone()` (`PersonalAvailabilityEditor.tsx:36,185`; `utils/timezone.ts:73-75`, IANA). The static template saves local keys with no timezone (`AvailabilityGrid.tsx:283-297`) | **H-9 amended (owner):** the server converts personal-template slots with `zoneinfo`; the static template leaves the pipe (carried). R-PH3-B mirrors `localSlotToUtc` exactly: local wall time on the local date → UTC date + `HH:MM`, rollover implicit |
| §10.1 weekday mapping | `PersonalAvailabilityTemplate.day_of_week` is iCal `MO…SU` (`models/personal_availability.py`, `String(2)`); the frontend maps a date with `getUTCDay()` of `d + 'T12:00:00Z'` (`quickFillUtils.ts:25-29`), i.e. the calendar weekday of the ISO date | Server: `date.weekday()` → index into `("MO","TU","WE","TH","FR","SA","SU")`, applied to the **local** date being expanded |
| §10.1 "Members: every role" (first draft) | Viewers cannot submit availability (`schedule.py:1538,1643`; `test_viewer_cannot_submit_availability`), get no RSVPs (`_create_initial_rsvps`), and every denominator excludes them (`Schedule.tsx:188`, `availabilityUtils.ts:101`, `AvailabilityGrid.tsx:156-159`, `schedule.py:135-143`); derived viewer rows would push `count` above `total` (`AvailabilityHeatmap.tsx:66,142-143`). Today's endpoint returns dated rows of users who have since left (`schedule.py:1482-1492`) | **Corrected in the spec:** templates layer for **current non-viewer members** only. Dated rows stay exactly as today for any user |
| §10.1 derived rows `id: null` | Nothing on the frontend reads the row id: the grid uses `user.id` (`AvailabilityGrid.tsx:128,135,464,620`), the store and quick-fill merge by `userId` (`availabilityStore.ts:64`) | `id: str \| None` / `id: string \| null`; no behavior change anywhere |
| §10.1 template rows with empty slots | `PersonalAvailabilityEditor.tsx:174-185` saves each **dirty** day, so a cleared day persists as a row with `[]` | **R-PH3-C:** a dated row's existence decides (H-9); a template day with `[]` produces no slots and therefore no derived row. Dated rows are emitted exactly as today, empty or not |
| §10.2 "the legacy grid never shows derived rows" (first draft) | `useAvailabilityStore.data` is one field read by `Schedule.tsx:91`, `AvailabilityGrid.tsx:126-154` and `QuickFillHelper.tsx:31,57,95`; the grid seeds `committedSlotsRef` from it on mount, before its own unflagged fetch (`:121`) returns, and saves from it (`:265-316`) | **R-PH3-F:** the flagged fetch writes `layeredData`, read only by `Schedule.tsx`; `data` is never layered. Spec §10.2 corrected |
| §10.2 Hub copy | V1 renders `PlayerAvailabilityTab` too (`pages/Profile.tsx:525-527`, below the `inV2Chrome` seam at `:311`); V2 mounts it at `pages/PlayerHub.tsx:185-187` with `primaryStatic` and `staticGroups`. Tiles at `PlayerAvailabilityTab.tsx:81-100`: "Used by schedule quick fill / Fills empty This Week days only.", "Private by default / Not shown on public profile yet.", "Schedule matching / Used later for schedule matching." Tests pin `/Set your usual raid times once/i` (`PlayerAvailabilityTab.test.tsx:48-51`) and the side-card summary regex (`HubSideCards.test.tsx:132-150`) | **R-PH3-F:** a `layeredSchedule` prop, passed only by `PlayerHub`; V1 copy byte-identical, pinned by a test |
| §10.3 "the active Hub BiS set for that job" | Hub sets are created with `owner_type="player_job_profile"`, `owner_id=job_profile_id`, `profile_id`, `job_profile_id`, `job` (`player_bis_targets.py:116-134`); `set_bis_target_active` selects by `profile_id + job` and activates exactly one (`:227-239`); `PlayerProfile.user_id` is unique (`models/player_profile.py:33-36`); `PlayerJobProfile.profile_id` (`models/player_job_profile.py:46-49`). `updated_at` bumps in that router: PUT `:185`, set-active `:239`, import `:295,303`. **But the Characters & gear tab edits Hub sets through `routers/bis_targets.py`** (`/api/bis-targets`; `sharedBisStore.ts:58-119`, `JobProfileCard.tsx:14,65`), which also sets `profile_id` (`bis_targets.py:142-146`) and bumps `updated_at` at `:304,472,480,514`; `player_bis_targets.py` (`/api/player/jobs`) has no frontend caller | **R-PH3-G:** the set = `owner_type == "player_job_profile"`, `profile_id == the caller's PlayerProfile.id`, `job == player.job`, `is_active`; several → the newest `updated_at`. A failed import also clears the item (it is still "I looked at it") |
| §10.3 "priority may be wrong" (first draft) | Priority reads `SnapshotPlayer.gear[].bisSource`/`hasItem` (`priority_calculator.py:128-161,378-403`); the Hub set reaches the roster only through `_auto_link_bis_from_hub` on claim/release (`tiers.py:1055-1092`, called at `:1227,1399`) | **Corrected in the spec:** the copy makes no claim about priority |
| §10.3 href | The Hub's Characters & gear tab id is `characters` (`hubTabs.ts:15`); `NeedsYouCard.tsx:47` filters items to `href.startsWith('/group/')` | `href = "/profile?tab=characters"`; the filter accepts `/group/` or `/profile` (R-PH3-H) |
| §10.3 "one item per stale player" | `NeedsYouCard.tsx:72` keys rows by `item.href`; two stale players in one static share the href | **R-PH3-H:** key = `${type}:${href}:${index}`; the detail carries the player's name when the caller has more than one player in that roster |
| §10.3 timestamps | `LootLogEntry.created_at` is `Text`, written as `datetime.now(timezone.utc).isoformat()` (`loot_tracking.py:293`); `BiSTargetSet.updated_at` likewise. `player_overview.py:120` already has `_parse_occurrence_start` (naive → UTC, unparseable → `None` + warning) | One generic helper `_parse_iso_utc(value) -> datetime \| None`; `_parse_occurrence_start` calls it. Comparisons on datetimes, strict `>` |
| §10.3 "one aggregate query" | Timestamps are `Text`, so the count must happen after parsing | **Corrected:** raw `(recipient_player_id, created_at)` rows over the caller's player ids, counted in Python; still one statement |
| §8 "browser: Needs you with a stale set" | The first draft's Task 3 had no browser step | Task 3 step 4 |

## Rulings (bind every task)

- **R-PH3-A (flag and parity).** `list_availability` (`routers/schedule.py:1449`) gains `include_templates: bool = Query(False)`. With it false the code path is today's: the same query, the same rows, in the same order; each row carries `source="dated"`. The only other response that changes is `submit_availability`'s (`:1571`), which shares the schema and gains the same additive field. `MAX_AVAILABILITY_RANGE_DAYS` (62, `schedule.py:87`) is unchanged and applies to both paths. `submit_availability`'s logic, the template endpoints and `require_membership` are untouched.
- **R-PH3-B (the layering module is pure).** New module `backend/app/services/availability_layering.py`:
  ```python
  WEEKDAY_CODES = ("MO", "TU", "WE", "TH", "FR", "SA", "SU")  # date.weekday() → iCal BYDAY

  @dataclass(frozen=True)
  class TemplateDay:
      user_id: str
      day_of_week: str          # "MO".."SU"
      slots: tuple[str, ...]    # local "HH:MM", already json-parsed
      timezone: str             # IANA name from the row; unknown → UTC

  def weekday_code(day: date) -> str: ...

  def expand_personal_templates(
      *, days: list[TemplateDay], start: date, end: date
  ) -> dict[tuple[str, str], list[str]]:
      """(user_id, utc_iso_date) → sorted, de-duplicated UTC "HH:MM" slots inside [start, end]."""

  def layer_availability(
      *,
      dates: list[str],                                  # every ISO date in the range, ascending
      members: list[tuple[str, str | None]],             # (user_id, username), current non-viewer memberships, endpoint order
      dated_rows: list[UserAvailability],                # today's query result, any user
      personal: dict[tuple[str, str], list[str]],        # expand_personal_templates()'s result
  ) -> dict[str, list[UserAvailabilityResponse]]: ...
  ```
  **Conversion** (`expand_personal_templates`) mirrors `localSlotToUtc`: for each `TemplateDay`, for each local date `L` from `start - 1 day` to `end + 1 day` whose `weekday_code(L)` equals `day_of_week`, for each slot `HH:MM`: `local = datetime.combine(L, time(HH, MM), tzinfo=ZoneInfo(timezone))`, `utc = local.astimezone(timezone.utc)`, key `(user_id, utc.date().isoformat())`, value `utc.strftime("%H:%M")`. Keep only keys whose date lies in `[start, end]`. Sort each list and drop duplicates (the spring-forward gap: a nonexistent local time and the hour after it map to one UTC slot; the fall-back hour does **not** duplicate under `fold=0`). `ZoneInfo(name)` failing (`ZoneInfoNotFoundError`, `ValueError`, **`OSError`** — `ZoneInfo("America")` raises `PermissionError` on Windows and `IsADirectoryError` on Linux) → UTC, logged at `warning` once per name per call. A slot that is not `HH:MM` with 0 ≤ HH < 24 and 0 ≤ MM < 60 is skipped, one `warning` per (user_id, day_of_week): template `slots` and `timezone` are never validated on write (`schemas/schedule.py:252-255`, `routers/player.py:1777-1801`), and a read endpoint every member uses must never 500 on one bad row (`player_overview.py:123-127` is the precedent). A nonexistent local time is whatever `zoneinfo` returns for `fold=0`, which matches JS `new Date(local)` (verified for a skipped and a repeated hour). `layer_availability` returns `by_date` in the shape the endpoint builds today (`schedule.py:1494-1505`): for each date, first every dated row (`source="dated"`, `id=row.id`, input order, the endpoint's `json.loads` guard), then, for each member **in `members` order** with no dated row on that date and a non-empty `personal[(user_id, date)]`, one derived row (`id=None`, `source="personal_template"`, `username` from `members`). The module touches no session and is unit-tested directly.
- **R-PH3-C (existence decides, empties are not emitted).** A dated row with `[]` is emitted (parity) and blocks the template. A template day with `[]` yields no slots, hence no derived row.
- **R-PH3-D (members and query budget).** With the flag on, the endpoint adds exactly **two** statements (one when `member_ids` is empty, which is unreachable while the owner membership exists, `tests/factories.py:72-80`; not tested): `select(Membership.user_id, User.discord_username).join(User, User.id == Membership.user_id).where(Membership.static_group_id == group_id, Membership.role != MemberRole.VIEWER.value).order_by(Membership.joined_at, Membership.user_id)` (one statement; fixes the members order), and `select(PersonalAvailabilityTemplate).where(PersonalAvailabilityTemplate.user_id.in_(member_ids))` (skipped, with `personal = {}`, when `member_ids` is empty). No per-member or per-date statements. The test asserts `count(flag on) − count(flag off) == 2` on a static with two members and on one with five, each with dated rows present (today's path is two statements when rows exist: the rows and the `selectinload(user)`).
- **R-PH3-E (schema, wire).** `UserAvailabilityResponse` (`schemas/schedule.py:213`): `id: str | None`, plus `source: Literal["dated", "personal_template"] = "dated"`. camelCase on the wire as today. `AvailabilityDateSummary` unchanged. Frontend `UserAvailabilitySlot` (`types/index.ts:1680-1686`): `id: string | null`, `source?: 'dated' | 'personal_template'` (optional, so fixtures need no edits).
- **R-PH3-F (frontend: `layeredData`, V2 only; Hub copy behind a prop).**
  - `stores/availabilityStore.ts`: new state `layeredData: AvailabilityDateSummary[]` (initial `[]`, cleared by `clearAvailability`). `fetchAvailability(groupId, startDate, endDate, options?: { includeTemplates?: boolean })`: with `includeTemplates` it appends `&include_templates=true` and writes **`layeredData`, not `data`**; without it, today's behavior (`data`). `isLoading`/`error` are shared as today. `submitAvailability`'s merge into `data` (`:64`) is unchanged.
  - `components/schedule/Schedule.tsx`: the two fetches (`:135`, `:294`) pass `{ includeTemplates: true }`; the one read (`:91`) switches from `data` to `layeredData`. `AvailabilityGrid.tsx`, `QuickFillHelper.tsx` and their tests are **read-only**; they keep `data`.
  - `components/schedule/Schedule.tsx:462` copy → `Your typical week lives on your profile and fills this schedule for any week you haven't painted.` (the old sentence, "leads pull it into this static's grid", becomes false on the pipe's own surface), asserted in `Schedule.test.tsx`. The stale comments at `:285-289` ("until … pipe replaces it") and `:493-497` are rewritten: the grid's fetch no longer feeds the heatmap; the close-refetch stays so newly painted rows show.
  - `PlayerAvailabilityTab` gains `layeredSchedule?: boolean` (default `false`). Only `pages/PlayerHub.tsx:186` passes `layeredSchedule`. With it **false, the rendered markup is byte-identical to today's** (V1). With it true, exact strings: intro `:57` → `Set your usual raid times once. Every static's schedule uses it for any week you haven't painted; paint a week in that static's schedule to make an exception.`; tile 1 body `:87` → `Paints a specific week in a static's schedule when you want an exception.`; tile 3 body `:98` → `Fills every static's schedule automatically.`; tile titles and tile 2 unchanged.
  - `HubSideCards.tsx` `AvailabilityCard` (V2-only file): under the summary `<p>`, one `<p className="text-xs text-text-muted mb-2">Fills every static's schedule unless you paint a week.</p>`; the summary line and **Edit →** unchanged; no new link.
- **R-PH3-G (`bis_stale`, backend).** `_OverviewContext` (`services/player_overview.py:97-117`) gains `hub_bis_set_by_job: dict[str, BiSTargetSet]` and `loot_created_at_by_player_id: dict[str, list[str]]`. `_load_context` fills them in **two** batched statements: `select(BiSTargetSet).join(PlayerProfile, PlayerProfile.id == BiSTargetSet.profile_id).where(PlayerProfile.user_id == user_id, BiSTargetSet.owner_type == "player_job_profile", BiSTargetSet.is_active.is_(True))` (keyed by `job`; on duplicates keep the newest `updated_at`), and `select(LootLogEntry.recipient_player_id, LootLogEntry.created_at).where(LootLogEntry.recipient_player_id.in_(caller_player_ids))` where `caller_player_ids` = the caller's configured, non-substitute players across the active tiers (the R-PH2-G population, computed once by `_caller_roster`, R-PH3-L). With no caller players the loot statement is skipped (`if ids:`). New builder:
  ```python
  def _build_bis_stale_items(ctx: _OverviewContext, group: StaticGroup, membership: Membership) -> list[OverviewActionItem]: ...
  ```
  Skip the static when `membership.role == "viewer"` (as `_build_rsvp_items` does, `:353`) or it has no active tier (any `content_type`). For each caller player in the roster (sort order): `bis = ctx.hub_bis_set_by_job.get(player.job)`; none → skip. `updated = _parse_iso_utc(bis.updated_at)`; `None` → skip with a warning naming the set id. `n = sum(1 for raw in ctx.loot_created_at_by_player_id.get(player.id, []) if (c := _parse_iso_utc(raw)) is not None and c > updated)`. `n == 0` → skip. Else one item: `type="bis_stale"`, `static_id=group.id`, `static_name=group.name`, `title="Your BiS may be out of date"`, `detail=f"{n} item{'' if n == 1 else 's'} logged since your BiS was last updated"`, prefixed with `f"{player.name or player.job} · "` when the caller has more than one player in that roster; `href="/profile?tab=characters"`; `starts_at=None`.
- **R-PH3-H (order, type, card).** `build_player_overview` (`:487-522`) appends the `bis_stale` items after the loot items, sorted by `(static_name.casefold(), detail)`. `OverviewActionItem.type` → `Literal["rsvp_pending", "loot_priority", "bis_stale"]`. Frontend `OverviewActionItemType` adds `'bis_stale'`; `ACTION_LABEL.bis_stale = 'Review BiS'`; `itemIcon` returns lucide `Shirt` (18 px) for it; the href filter (`NeedsYouCard.tsx:47`) becomes `href.startsWith('/group/') || href === '/profile' || href.startsWith('/profile?')` (tight, so no dead button can render — PH2's F13), and the comment at `:45-46` is updated; the row key becomes `` `${item.type}:${item.href}:${index}` ``; the empty-state description (`:66`) becomes `Session RSVPs, loot you're first in line for and out-of-date BiS show up here.`. `itemMeta` unchanged.
- **R-PH3-I (parsing).** `services/player_overview.py` gains `_parse_iso_utc(value: str) -> datetime | None` (fromisoformat; naive → UTC; `.astimezone(timezone.utc)`; `ValueError`/`TypeError` → `None`). `_parse_occurrence_start` (`:120`) delegates to it and keeps its own warning with the session id.
- **R-PH3-J (files, scope).** Task 1: `routers/schedule.py` (`list_availability` only), `schemas/schedule.py` (R-PH3-E), new `services/availability_layering.py`, `tests/factories.py` (`create_user_availability`, `create_personal_availability_template`), new `tests/test_availability_layering.py`. Task 2: `stores/availabilityStore.ts`, `components/schedule/Schedule.tsx`, `types/index.ts`, `components/profile/PlayerAvailabilityTab.tsx`, `pages/PlayerHub.tsx` (one prop), `components/profile/hub/HubSideCards.tsx`, and tests (`Schedule.test.tsx`, `PlayerAvailabilityTab.test.tsx`, `HubSideCards.test.tsx`, a new `availabilityStore.test.ts` if none exists). Task 3: `services/player_overview.py`, `schemas/player_overview.py`, `tests/factories.py` (`create_player_profile` exists at `:396`; no job-profile or BiS-set factory exists — add `create_player_job_profile`, which must set `role` (NOT NULL, `player_job_profile.py:53`), and `create_hub_bis_target_set`; add `created_at: str | None = None` to `create_loot_log_entry`, which hardcodes it at `:197`), `tests/test_player_overview.py`, `components/profile/hub/{usePlayerOverview.ts,NeedsYouCard.tsx}`, `NeedsYouCard.test.tsx`. **Read-only:** `AvailabilityGrid.tsx`, `QuickFillHelper.tsx`, `quickFillUtils.ts`, `AvailabilityHeatmap.tsx`, `BestTimesCard.tsx`, `scheduleWeek.ts`, `availabilityUtils.ts`, `components/ui/*`, `components/primitives/*`, `routers/loot_tracking.py`, `routers/bis_targets.py`, `routers/player_bis_targets.py`, `routers/tiers.py`, every model, `backend/app/database.py`. Any other file needs a NEEDS_CONTEXT report.
- **R-PH3-K (budgets and gates).** jscpd **≤ 343** clones; ESLint **0 errors, ≤ 809 warnings** (both measured on `main` @ `2f67ef7a`, 2026-09-27); `pnpm -C frontend deadcode` unchanged; `pnpm -C frontend build` (`tsc -b`) clean; `check:design-system:strict` clean. Backend `pytest tests/ -q` green; `test_schedule.py`'s availability tests (`:592-874`) stay green **unedited**. Release note: one entry in `releaseNotes.ts`, matching the visibility PH2 chose (`git log -p -1 --format= -- frontend/src/data/releaseNotes.ts` on `main`); single quotes escaped as `\'`; Edit/Write only.
- **R-PH3-L (no clones).** One row-building copy: the endpoint calls `layer_availability` in both flag states (flag off → `members=[]`, `personal={}`), and the old `by_date` loop is deleted. `_caller_roster(ctx, tier) -> tuple[list[SnapshotPlayer], set[str]]` is extracted from `_build_loot_item` (`:412-422`) and used by both builders.

## Review Focus

- R-PH3-A/B/C: with the flag off, can any byte differ from today's rows and values other than the added `source`? With it on: a member with a dated Monday and a template Monday (dated wins, one row); an **empty** dated row (emitted empty, no derived row); a template day with `[]` (nothing); a user who left the static but has dated rows (rows present, no derived rows); a viewer with a template (nothing); a slot that crosses midnight (lands on the next UTC date, and on the previous one for an eastern zone); a range whose first UTC date receives slots from the local day before `start`; slots converted to a date outside the range (dropped); DST on both sides of a transition; an unknown zone (UTC, warning); a duplicate after fall-back (one slot).
- R-PH3-D: is the delta exactly two, for two and five members, with and without any template rows?
- R-PH3-F: does any V1-reached file send the flag, read `layeredData`, or render different markup without the prop?
- R-PH3-G: strict `>` at equal timestamps; naive `updated_at`; an unparseable `updated_at` or `created_at` never 500s; a Hub set for another job; two configured caller players in one static; a viewer caller with a claimed player (none); a substitute player (none); a caller with no `PlayerProfile` (none, no error).
- R-PH3-H: two items with the same href both render; a `/profile` href passes the filter; the order (rsvp, loot, bis) holds on the wire and in the card.

## Task 1 — The pipe, backend (RISKIEST · `xivrp-implementer-deep`)

Files: `backend/app/services/availability_layering.py` (new), `backend/app/routers/schedule.py` (`list_availability` only), `backend/app/schemas/schedule.py` (`UserAvailabilityResponse`), `backend/tests/factories.py`, `backend/tests/test_availability_layering.py` (new).

1. **Factories.** `create_user_availability(session, static_group, user, *, date: str, slots: list[str]) -> UserAvailability`; `create_personal_availability_template(session, user, *, day_of_week: str, slots: list[str], timezone: str = "UTC") -> PersonalAvailabilityTemplate`. `slots` stored as `json.dumps(slots)`; `updated_at` = `datetime.now(timezone.utc).isoformat()` where the model has it.
2. **Schema (R-PH3-E).** Widen `id`, add `source` with default `"dated"`.
3. **Module (R-PH3-B, R-PH3-C).** Unit tests first, no session:
   - `weekday_code(date(2026, 6, 1)) == "MO"`, `date(2026, 6, 7) == "SU"`, `date(2026, 6, 30) == "TU"`, `date(2026, 7, 1) == "WE"`;
   - `expand_personal_templates`: `TemplateDay(u, "MO", ("20:00", "20:30"), "UTC")`, range 2026-06-01..07 → `{(u, "2026-06-01"): ["20:00", "20:30"]}`;
   - `"America/New_York"` (UTC−4 in June), `MO ("20:00", "23:30")` → `(u, "2026-06-02")`: `["00:00", "03:30"]` and nothing on `06-01`;
   - `"Asia/Tokyo"` (UTC+9), `TU ("08:00",)` → `(u, "2026-06-01")`: `["23:00"]` (the local Tuesday 2026-06-02 08:00 is Monday 23:00 UTC);
   - range edges: `"Asia/Tokyo"`, `MO ("08:00",)`, range 2026-06-01..07 → exactly `{(u, "2026-06-07"): ["23:00"]}` (local Monday 06-08 08:00 is Sunday 06-07 23:00 UTC, inside; local Monday 06-01 08:00 is 05-31 23:00 UTC, **dropped**); and `"America/New_York"`, `SU ("23:30",)`, same range → exactly `{(u, "2026-06-01"): ["03:30"]}` (local Sunday 05-31 feeds the first date; local Sunday 06-07 lands on 06-08, dropped);
   - `"Europe/London"`: `MO ("09:00",)` → `08:00` UTC on 2026-06-01 and `09:00` UTC on 2026-01-05 (BST vs GMT);
   - spring-forward de-dup: `"Europe/London"`, `SU ("01:30", "02:30")`, range 2026-03-29..29 → exactly `{(u, "2026-03-29"): ["01:30"]}`; fall-back: `SU ("01:00", "01:30")`, range 2026-10-25..25 → `["00:00", "00:30"]` (first occurrence, as JS);
   - bad rows never raise: timezone `"America"` → treated as UTC plus one warning; slots `("25:00", "abc", "20:00:00", "20:00")` → only `20:00`, one warning;
   - unknown zone `"Mars/Olympus"` → treated as UTC, one warning (`caplog`);
   - `layer_availability`: dated row present → emitted with `source="dated"`, its `id`, and no derived row; dated `[]` → emitted empty, no derived row; no dated row + personal slots → `source="personal_template"`, `id=None`, `username` from `members`; a member absent from `personal` → nothing; a user in `dated_rows` not in `members` → rows emitted, no derived; order within a date = dated (input order) then derived (`members` order); a date with nothing → no `by_date` entry.
4. **Endpoint (R-PH3-A, R-PH3-D, R-PH3-L).** Add the parameter; keep the existing query; when the flag is on run the two statements and `expand_personal_templates`; call `layer_availability` in both states. Route-level tests (the `client`/`member_headers` pattern of `test_schedule.py:592-604`):
   - flag off, two members with dated rows → today's rows, each `source == "dated"`, no `null` ids; the comparison sorts each date's `responses` by `userId` (today's within-date order is unspecified, `schedule.py:1490`);
   - flag on: two members, one with a dated Monday and a template Monday, one with a template only, in `"America/New_York"` → the expected rows per UTC date, `username` on derived rows, `id` `null`;
   - flag on, a viewer membership with a personal template → no derived rows for the viewer; the viewer can still call the endpoint and sees the others' rows;
   - flag on, a non-member caller → 403 as today;
   - malformed/inverted/oversized ranges → the existing errors, with the flag on;
   - the PUT response carries `source == "dated"`;
   - the statement delta (R-PH3-D): two members vs five, each with dated rows and templates → delta 2 both times; a static whose members have no templates → delta 2.
5. **Gates.** `pytest tests/ -q`; paste the result line; `git diff --stat -- backend/tests/test_schedule.py` empty.

Size: ~500–600 lines incl. tests.

**Ad hoc mutation checks (execute and paste):** (a) skip the `astimezone` conversion → the New York test fails; (b) emit derived rows for members with dated rows → the "dated wins" test fails; (c) drop the viewer filter from the members statement → the viewer test fails; (d) drop the `[start, end]` filter → the "dropped outside" test fails; (e) drop the de-dup → the spring-forward test fails; (f) remove the slot guard → the bad-rows test raises.

## Task 2 — The pipe, frontend + Hub copy (`xivrp-implementer`, sonnet)

Files: `frontend/src/stores/availabilityStore.ts`, `frontend/src/components/schedule/Schedule.tsx` (`:91`, `:135`, `:294`), `frontend/src/types/index.ts` (`:1680-1686`), `frontend/src/components/profile/PlayerAvailabilityTab.tsx`, `frontend/src/pages/PlayerHub.tsx` (`:186`), `frontend/src/components/profile/hub/HubSideCards.tsx`, and tests: `Schedule.test.tsx`, `PlayerAvailabilityTab.test.tsx`, `HubSideCards.test.tsx`, `availabilityStore.test.ts` (create if absent; `vi.mock('../services/api')` as `stores/lootTrackingStore.test.ts` does).

1. **Types (R-PH3-E).** Widen `id`, add optional `source`. `pnpm -C frontend build` must pass with no other edit (premises: nothing reads the row id).
2. **Store (R-PH3-F).** `layeredData` + the options parameter. Tests: (a) no options → the URL has no `include_templates`, `data` is set, `layeredData` untouched; (b) `{ includeTemplates: true }` → the URL has it, **`layeredData` is set and `data` is untouched**; (c) `clearAvailability` empties both.
3. **Schedule (R-PH3-F).** The fetches at `:135` and `:294` pass the option; the reads at `:91`, `:206`, `:207` and `:444` switch to `layeredData` (the file never reads `isLoading`/`error`). In `Schedule.test.tsx` (it mocks the store action, `:115,123`), assert the fourth argument `{ includeTemplates: true }` on mount and after the edit modal closes; seed the mocked store with a `data` fixture that **conflicts** with `layeredData` and assert that both the heatmap and one Best Times recommendation come from `layeredData` (Best Times is otherwise never asserted, spec §7.9). Assert the new `:462` copy.
4. **Hub copy (R-PH3-F).** The prop, the exact strings, the one `PlayerHub` call site. Tests: `PlayerAvailabilityTab.test.tsx` — **V1 pin:** without the prop, `/copies into that static's week/` and `/Fills empty This Week days only\./` are present and `/uses it for any week you haven't painted/` is absent; with `layeredSchedule`, the reverse, and `/Fills every static's schedule automatically\./` present; the existing `/Set your usual raid times once/i` assertion stays. `HubSideCards.test.tsx` — one assertion for `Fills every static's schedule unless you paint a week.`; the summary regex and the Edit click test unedited.
5. **Design system.** No new primitives; `text-xs` is the floor; `check:design-system:strict` clean.
6. **Browser pass (slice § 2), in a non-UTC timezone** (set the OS or the DevTools sensor timezone to `America/New_York`): as a member with only a personal template (`PUT /api/player/availability/template` **with `"timezone": "America/New_York"`** — the API defaults it to UTC, `schemas/schedule.py:255` — or the Hub editor with the browser in New York) saying Monday 20:00–21:30, open a V2 static's Schedule and confirm the heatmap and Best Times show that member at **20:00 local on Monday**; open the stopgap modal and confirm the grid shows no painted cells for that member; close it and confirm the heatmap is restored. Then `/profile?shell=v2` Availability tab and Overview side card copy, both themes, 1440 and 2560. Shots to `docs/redesign/pr-shots/ph3b-*.png`, shrunk per `pr-checklist`.
7. **Gates (R-PH3-K).** `build`, `lint`, `check:design-system:strict`, `test`, `dupes` (≤ 343), `deadcode`; paste each line.

Size: ~250–350 lines incl. tests.

**Ad hoc mutation checks (execute and paste):** (a) pass `layeredSchedule` unconditionally inside `PlayerAvailabilityTab` → the V1 pin test fails; (b) write the flagged fetch into `data` → store test (b) fails.

## Task 3 — `bis_stale`, backend + card (`xivrp-implementer`, sonnet)

Files: `backend/app/services/player_overview.py`, `backend/app/schemas/player_overview.py`, `backend/tests/factories.py` (`create_player_job_profile(session, profile, *, job: str) -> PlayerJobProfile` if missing; `create_hub_bis_target_set(session, profile, job_profile, *, is_active: bool = True, updated_at: str | None = None) -> BiSTargetSet` with `owner_type="player_job_profile"`, `owner_id=job_profile.id`, `profile_id=profile.id`, `job_profile_id=job_profile.id`, `job=job_profile.job`, `name="Test BiS"`, `items_json=None`; `created_at: str | None = None` on `create_loot_log_entry`, defaulting to now), `backend/tests/test_player_overview.py`, `frontend/src/components/profile/hub/usePlayerOverview.ts`, `frontend/src/components/profile/hub/NeedsYouCard.tsx`, `frontend/src/components/profile/hub/NeedsYouCard.test.tsx`.

1. **Refactor first (R-PH3-I, R-PH3-L).** `_parse_iso_utc`; `_parse_occurrence_start` delegates. `_caller_roster(ctx, tier)` extracted from `_build_loot_item` (`:412-422`); `_build_loot_item` uses it. `pytest tests/test_player_overview.py -q` unedited; paste the line.
2. **Context + builder (R-PH3-G, R-PH3-H).** The two batched loads; `_build_bis_stale_items`; the assembly and sort; the schema `Literal`. Tests, each with the fixed `NOW`, an active tier, the caller's configured `DRG` player (`user_id` set as the loot tests do), a `PlayerProfile` + `PlayerJobProfile("DRG")` for the caller:
   - Hub set `updated_at = NOW − 2d`, one entry `created_at = NOW − 1d` → one item: `type == "bis_stale"`, the exact `title`, `detail == "1 item logged since your BiS was last updated"`, `href == "/profile?tab=characters"`, `starts_at is None`;
   - three newer entries → `"3 items logged …"`;
   - entry `created_at == updated_at` → none (strict);
   - entry older → none;
   - no `PlayerProfile` → none, 200; no job profile → none; an inactive set → none; an active set for `PLD` only → none;
   - two active sets for `DRG` (two job profiles) → the newest `updated_at` decides;
   - a naive `updated_at` is read as UTC and still detected against an aware newer entry;
   - `updated_at = "garbage"` → no item, 200, one warning (`caplog`);
   - a substitute player → none; a viewer caller with a claimed, configured player → none; an ultimate tier with a stale set → the item **is** built (no content-type gate);
   - two configured caller players in one static, both stale → two items, each `detail` prefixed `"{name} · "`; one stale player → no prefix;
   - **set-active bump (route):** a stale set, then `POST /api/bis-targets/{target_id}/set-active` (`bis_targets.py:487`, the call `sharedBisStore.ts:114` makes; the Characters & gear tab edits Hub sets through `routers/bis_targets.py`, and `player_bis_targets.py` has no frontend caller) as the caller → no item;
   - order: an RSVP item, a loot item and a bis item together → wire order `rsvp_pending`, `loot_priority`, `bis_stale`; two bis items across statics "Beta" and "Alpha" → Alpha first;
   - the statement counter: one static vs three, same count.
3. **Card (R-PH3-H).** Type union, label, icon, key, href filter, empty-state copy. Tests in `NeedsYouCard.test.tsx`: a `bis_stale` fixture (`href: '/profile?tab=characters'`) renders its title, static tag, `detail` as meta and a **Review BiS** button that navigates with exactly the href; two `bis_stale` items with the same href both render (two buttons); the empty-state description is the new string; the existing rsvp/loot tests stay unedited.
4. **Browser pass.** Dev-auth as a user with a Hub BiS set older than one of their loot-log entries: `/profile?shell=v2` shows the item; **Review BiS** lands on the Characters & gear tab; both themes. Shot `docs/redesign/pr-shots/ph3c-*.png`, shrunk.
5. **Gates (R-PH3-K).** Backend `pytest tests/ -q`; frontend `build`, `lint`, `check:design-system:strict`, `test`, `dupes`, `deadcode`; paste each line.

Size: ~450–550 lines incl. tests.

## Finish (controller)

1. **Write-backs, one commit per PR that completes a change (spec §10.4):** on **PH3b** — `specs/2026-07-02-f6e-schedule-design.md` §6.3 item 1 → closed by PH3 (link this plan); `V2_COVERAGE_PLAN.md:120` Stage 3 status → the pipe built, what remains owed; `ROLLOUT_ROADMAP.md:362` → "pipe ✅ PH3b (link); analytics pass retired (H-7)" (the line also lists the retired pass, so a bare "done" would overclaim). On **PH3c** — `ROLLOUT_ROADMAP.md:377` → done; `V2_COVERAGE_PLAN.md:120` → "Your BiS is out of date" built and mockup-05 re-validation closed per H-7, with the ph3c screenshot beside `mockups/05-player-hub.html:498` as evidence; spec §9/§10 → rulings from the ledger that bind a later slice only. Update this plan's **Plan-vet** line if the loop overrules a fold and add an **Outcome** section (PR numbers, sizes, rulings, measured loop numbers).
2. `pr-checklist` skill: release note (R-PH3-K), screenshots shrunk, `git diff --check`, no workflow changes.
3. Gates on the head, counts pasted into each PR body.
4. Draft → ready once per PR; merge bottom-first per `slice-loop` § Stacked PRs.
5. Final message per the skill; rewrite `SESSION_HANDOFF.md`.

## Outcome (2026-09-27)

**Shipped as three PRs, as first planned.**
- **#304 PH3a:** Task 1, the pipe backend. +932/−26. The owner merged it alone as `e147aa05`. Copilot reported no findings and `claude[bot]` found nothing blocking.
- **#305 PH3b:** Task 2, the pipe frontend and Hub copy, plus the fix wave's pipe-side tests, the pipe write-backs and the shots. +361/−87.
- **#306 PH3c:** Task 3, `bis_stale`, plus the fix wave's overview-side tests, its write-backs, spec §9 and the shots. +721/−39.

The Finish collapse rule was applied once and then overtaken. The controller had ruled to fold Task 2 into #304 (a+b = 1,234 lines), but the owner merged #304 alone first. The loop then restacked #305 and #306 onto `main` and restored #304's release note to its merged text. No plan-vet fold was overruled.

**Reviews.**
- Task 1 riskiest-task review: 0 Critical / 0 Important / 2 Minor.
- Whole-branch review (Tasks 1–3 against `main`): spec-compliant on all three tasks, V1-safe on every shared hunk, 0 Critical / 1 Important / 5 Minor. The Important was the release note, which the collapse would have made false.
- One fix wave: M1 (a vacuous heatmap half-assertion, now a real `aria-label` check with an executed mutation trace), M2, M3, M4 (one `count_statements` fixture in `backend/tests/conftest.py`) and Task 1's ruff Minor.
- The re-review found everything addressed, plus one new Minor, which is parked.

**Rulings that bind later work** are in spec §9's PH3 write-back:
- the Hub tile 1 title against its new body goes to the holistic review;
- the stdlib log lines go to logging unification.

**Parked, disclosed in the PR bodies:**
- `Schedule.test.tsx:353-354` claimed the assertion is independent of the host's timezone. It held only for hosts at UTC−5…UTC+3, which covers CI and the owner's machine. Fixed in the bot triage: the comment now says so.
- A corrupt `slots` row would 500 through `json.loads`. The PUT schema makes this unreachable.

**Post-ready bot triage:** Copilot raised 4 threads (#305: 3, #306: 1) and claude[bot] raised none. Fixed: the V2 pipe copy now says "every static you raid with", since viewer memberships aren't layered (R-PH3-D); `fetchAvailability` drops a response from a superseded request; an unparseable loot `created_at` is skipped with a warning.

**Browser pass:** one live walk in `America/New_York`, 13 of 13 steps passing, 0 console errors. Shots are `docs/redesign/pr-shots/ph3b-*` and `ph3c-*`.

**Loop numbers (D12 in brackets):**

| Measure | PH3 | D12 |
|---|---|---|
| Tasks | 3 | 8 |
| Fix waves | 1 | 8 rounds |
| Commits | 10 (2 squashed in #304, 4 in #305, 4 in #306) | 30 |
| Workspace artifacts | ~290 KB | 838 KB |
| Wall clock | ~1 h 45 m (05:02–06:47 EDT) from branch to ready | ~12 h |
| Reviewer dispatches | 3 (riskiest task, whole branch, fix-wave re-review) | — |
| Implementer dispatches | 4 (3 tasks + 1 wave) | — |
| Browser dispatches | 1 | — |
