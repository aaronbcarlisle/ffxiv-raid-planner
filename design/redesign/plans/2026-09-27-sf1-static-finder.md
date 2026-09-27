# Stage 4 · SF1 — Static Finder: recruitment as matching

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** the Static Finder ranks public listings by how well they fit the signed-in player, and it explains every fit. It checks each raid night against the player's Hub typical week, in the player's time zone, and the role need against the player's Hub jobs. The page is a V2-native body built to mockup 06, and V1 Discover stays unchanged.

**Architecture:**
- **Task 1 (the riskiest):** the engine and API, backend only.
  - A pure module `services/finder_fit.py`: per-night schedule coverage through the PH3 zone helpers, role fit from `recruitingRoles`, and the tier, reasons and sort key.
  - Wired into `GET /api/discovery/statics` behind `fitV2`, with `asRole`, `dayGroup`, `sort=best` and a comma-separated `goalCategory`.
  - Additive response fields.
  - It also fixes the listing autofill, which reads session times in UTC.
- **Task 2:** the V2 data layer and page frame.
  - The seam in `Discover`, V2 types, and a `useFinderQuery` hook (URL ↔ request, with a stale-response guard).
  - The `StaticFinder` page with its header, filter column, summary bar, sort and loading/empty/error states, plus minimal cards (name, location, tier).
- **Task 3:** the card body and entry points.
  - Reason copy, per-night local times, objective tags and members.
  - View and Request to join with its request states.
  - The Hub nudge, and the "Leading a static?" row (one static, several, or none).

**PR split (planned now):** three stacked draft PRs, one per task.
- **SF1a** = this plan + Task 1. It is additive and mergeable alone: nothing sends `fitV2` until SF1b.
- **SF1b** = Task 2.
- **SF1c** = Task 3 + the stage write-backs (Finish).
- At Finish the controller measures each task's diff and collapses adjacent PRs whose combined size is ≤ ~1,500 changed lines. One whole-branch review covers the slice.

**Tech stack:** FastAPI (async SQLAlchemy, `CamelModel` schemas) · Python `zoneinfo` (`tzdata` pinned) · pytest + aiosqlite (`count_statements` fixture, `tests/conftest.py:282-306`) · React 19 · TypeScript · Zustand · Vitest + Testing Library · ESLint 9 boundaries (`eslint.config.js:50-145`).

**Spec (binding):** `design/redesign/specs/2026-09-27-static-finder-design.md`: §2 (SF-1…SF-7), §3–§6, §7 (criteria 1–9), §8, §9. Also `CLAUDE.md` § UI rules and § Pitfalls (plugin contract, `n > 0 &&`, LF, `releaseNotes.ts` quoting).

**Plan-vet:** pending (`xivrp-director`).

## Spec premises checked against the code

| Spec line | Code | Ruling |
|---|---|---|
| §3.1 listing `scheduleDays` | The listing form stores **long names** from `RAID_DAYS` (`gamedata/worlds.ts:91`, `DiscoveryTab.tsx:1090`). Templates store iCal `MO…SU` (`models/personal_availability.py:38`). `fit_score._normalise_day` accepts both, but not `Mon` (`fit_score.py:65-69`) | **R-SF-B:** `listing_day_codes()` maps long names (any case) and iCal codes to iCal. Anything else is dropped |
| §3.1 times | `scheduleStartTime`/`EndTime` are `HH:MM` in 30-minute steps (`worlds.ts:105-110`). `timezone` is IANA from `TIMEZONES` | Parsed with `parse_slot`; a zone that doesn't load triggers the day-basis fallback |
| §3.1 "Use the PH3 helpers" | `_parse_slot` (`availability_layering.py:54-64`) and `_load_zone` (`:67-77`, no logging) are private. `expand_personal_templates` (`:80-145`) already converts each template row from **its own** timezone, with a UTC fallback and warnings | **R-SF-C:** rename them `parse_slot`/`load_zone` (only this module uses them). The viewer's free time is built with `expand_personal_templates`, so per-row zones, DST and bad rows behave exactly as the PH3 pipe does |
| Autofill of the listing's times | `GET /static-groups/{id}/discovery/suggestions` (`routers/static_groups.py:1241-1300`) takes the weekday and `HH:MM` from the session's **UTC** ISO start and end, then suggests the sessions' timezone beside them. So a Thu 19:00 America/New_York session autofills as `Friday` `00:00` | **R-SF-K (owner flag at plan review):** convert each session's start and end into `load_zone(s.timezone)` (UTC when it doesn't load) before `strftime`. This changes what V1's autofill suggests, and makes it correct. Listings already saved keep their stored values, since the app can't tell autofilled times from typed ones |
| §3.2 "Your jobs" | `PlayerJobProfile.role` is stored and validated against `tank/healer/melee/ranged/caster` (`models/player_job_profile.py:53`, `routers/player.py:75,1194-1198`). The endpoint orders jobs with `priority_order` (`discovery.py:256-268`) | Viewer jobs come from these rows in that order. `role` comes from the row, with `role_for_job` as the fallback |
| §3.2 legacy mapping | The backend has no job→role key map. `services/discord_webhook.py:68-82` has `job_category()` (Tank / Pure Healer / Shield Healer / Melee / Physical Ranged / Caster) | **R-SF-D:** `role_for_job()` in `finder_fit.py` maps `job_category()` onto the five role keys. It is used only for the legacy mapping and for the fallback on a job row with no role |
| §4 viewer inputs | Profile, goals, jobs, BiS and templates load **only if** `PlayerProfile.visibility == "discoverable"` (`discovery.py:225-294`). Private profiles get no fit. `user_languages` and `user_comms` are never populated (`:216-222`), so comms fit resolves only as `unknown` on the player side | **R-SF-E:** with `fitV2`, the viewer's own inputs load **whatever the visibility**, because only the viewer sees their own fit. V1's `fitSummary` keeps its discoverable-only gate (checked in Python after one profile load). Comms stays as today, and an `unknown` comms reason is omitted (R-SF-G) |
| §4 "byte-identical apart from two new nullable fields" | `DiscoveryListItem` has no group id (`schemas/discovery.py:93-120`). V1 matches a join request by **name** (`Discover.tsx:545`), so two statics with the same name share a state. `JoinRequest.staticGroupId` exists (`types/index.ts:972-973`) | **R-SF-A:** add `id: str` to `DiscoveryListItem` (UUIDs are less sensitive than the `shareCode` it already carries) and match by `staticGroupId === item.id` in V2. Spec §4 is amended at Finish: `id`, `fitV2`, `fitCounts`, `viewer` |
| §5 "the default is your main job's role" | The response doesn't carry the viewer's main job; the frontend profile store would mean an extra fetch (`playerProfileStore.ts:180`) | **R-SF-A:** with `fitV2`, the response carries `viewer: {mainJob, mainRole, missing}`, or `null` for guests |
| §5 card "content progress" | The listing has no progress data. It has `objectiveCategories` (`schemas/discovery.py:117`) | Cards show objective tags instead. Spec write-back |
| §5 "More filters … V1's data center, server, language and recruitment status" | V1 also filters by `role`, `job`, `timezone`, `hideConflicts` and `hideGoalConflicts` (`Discover.tsx:224,424-499`) | Every V1 affordance is settled in the parity table below, for the owner's sign-off at plan review |
| §5 seam "at the top of `Discover`" | `Discover` runs about 15 hooks (`:238-354`) before its JSX (`:356`), including the fetch effect. `react-hooks` is on (`eslint.config.js:3,29`) | **R-SF-H:** rename the body `LegacyDiscover` (unexported). `export function Discover()` calls `useInV2Chrome()` and returns `<StaticFinder />` or `<LegacyDiscover />`. No hook-order problem, no V1 fetch under V2, and V1's markup is unchanged |
| §5 "Leading a static? routes to Settings → Recruitment" | `useSettingsPanelStore.getState().open({ tab, section })` (`stores/settingsPanelStore.ts:16-20,43-49`). Off `/group/*`, the global host shows General only, and the clamp is **display-only** (`SettingsPanel.tsx:360-365`: `effectiveTab`, and the store is never written). The store doesn't reset on navigation. No code today navigates and then opens | **R-SF-J:** in one click handler, `navigate(`/group/${shareCode}`)` then `open({ tab: 'recruitment', section: 'listing' })`. Browser-verified (Task 3, step 6). If the panel doesn't land on Recruitment → Listing, report NEEDS_CONTEXT; don't invent a URL mechanism (memory `project_settings_panel_store`) |
| §5 "Request to join … V1's states" | V1 handles `pending`, `accepted` and `declined`; `under_review` and `cancelled` fall through to "Request to Join" (`Discover.tsx:545,792-811`). V1's "Pending" button cancels without saying so | **R-SF-I:** V2 treats `pending` and `under_review` as pending, and shows the text "Request pending" plus a separate `Cancel request` button. `cancelled` shows Request to join again |
| Component boundaries | `components/finder/` matches no element pattern (`eslint.config.js:50-61`) | **R-SF-L:** add `finder` to the **ring1** pattern (Ring 1 = recruitment). It may then import ring0 (`static-group`, `wizard`), ring1 (`schedule`) and person, but not ring3 or admin |
| Filter option lists | V1 keeps its own local option consts (`Discover.tsx:106-224`) | **R-SF-M:** the lists V2 needs move to `components/finder/discoveryOptions.ts` **byte-for-byte** (values, labels, order), and `Discover.tsx` imports them. That is the only other edit to V1's file. It avoids jscpd clones |

## V1 Discover parity (owner signs off at plan review)

| V1 affordance (`pages/Discover.tsx`) | V2 | Disposition |
|---|---|---|
| Search `q` (`:377`) | Search input | keep |
| Sort recent / members / name (`:129-133`) | Sort `Select`: Best match (default), Recent, Members, Name | keep + `best` |
| `role` filter: statics needing a role (`:424`) | "My role" chips set `asRole`. Best match ranks role fits first; a role miss makes a listing Weak | **fold.** A default chip that also *filtered* would hide every listing with no roles set |
| `job` filter (`:426`) | More filters | keep |
| `intensity` (`:428`) | Vibe chips | keep |
| `recruitmentStatus` (`:430`) | More filters | keep |
| `goalCategory` single select (`:448`) | Content checkboxes (multi) | keep, widened |
| `hideConflicts`: legacy public-goal alignment (`:450-477`, `discovery.py:336-348`) | Not offered. `hideGoalConflicts` covers the same intent from the fit engine | **drop** |
| `hideGoalConflicts` | "Hide goal conflicts" checkbox (Content group) | keep |
| `scheduleOverlap` | "Fits my typical week" checkbox (per-night status) | keep, upgraded |
| `dataCenter` / `server` (server disabled until a DC is chosen) / `timezone` / `language` (`:486-499`) | More filters, same behaviour | keep |
| Filters panel toggle (`showFilters`, `:247`) | The filter column is always shown; More filters collapses | fold |
| Card: fit tokens (`FitSummarySection`, `:836-892`) | Tier tag + reason rows | fold |
| Card: description, schedule text, intensity, recruitment status, languages, contact method/value, member count | Card body. Members shown only when `memberCount > 0`, i.e. the lead opted in (`discovery.py:148`) | keep |
| Card: View Static (`:812`) | View static | keep |
| Card: Request to Join / Pending / Accepted / Declined | R-SF-I states | keep, clarified |
| Card: "Log in to join" (guests) | Unreachable: guests can't enter V2 (D7) | drop (V1 keeps it) |

## Rulings (bind every task)

- **R-SF-A (API, additive).**
  - **Parameters.** `list_discoverable_statics` (`routers/discovery.py:167`) gains:
    - `fit_v2: bool = Query(False, alias="fitV2")`
    - `as_role: Literal["tank","healer","melee","ranged","caster"] | None = Query(None, alias="asRole")`
    - `day_group: Literal["weeknights","weekends"] | None = Query(None, alias="dayGroup")`
    - `SortOption` (`:35`) gains `"best"`.
  - **Rules.**
    - `asRole` and `sort=best` take effect only when `fitV2` is on and the caller is signed in. Otherwise `asRole` is ignored and `best` sorts as `recent`.
    - `goalCategory` splits on `,`, strips each value and drops empties. A listing passes when **any** value is in its categories. The comparison stays case-sensitive exact, as today (`:327-332`), so a single value behaves exactly as before.
  - **Schemas** (`schemas/discovery.py`):
    - `DiscoveryListItem` gains `id: str` and `fit_v2: FitV2 | None = None`.
    - `DiscoveryListResponse` gains `fit_counts: FitCounts | None = None` and `viewer: FitViewer | None = None`.
    - The new models:
      ```python
      class FitNight(CamelModel):
          day: str                      # listing's iCal code
          local_day: str | None         # viewer's iCal code of the raid start; None on basis "day"
          local_start: str | None       # "HH:MM" in the viewer's display zone
          local_end: str | None
          coverage: Literal["full", "part", "none"]

      class FitV2Role(CamelModel):
          status: Literal["match", "partial", "none", "unknown"]
          matched_job: str | None = None
          matched_role: str | None = None
          priority: Literal["needed", "nice_to_have"] | None = None
          is_main: bool = False
          as_role: str | None = None

      class FitV2Schedule(CamelModel):
          status: Literal["match", "partial", "conflict", "unknown"]
          basis: Literal["time", "day"]
          nights: list[FitNight] = Field(default_factory=list)

      class FitReason(CamelModel):
          kind: Literal["role", "schedule", "goals", "comms", "bis"]
          status: Literal["match", "partial", "conflict"]
          params: dict[str, Any] = Field(default_factory=dict)

      class FitV2(CamelModel):
          tier: Literal["strong", "good", "partial", "weak", "unknown"]
          missing: list[Literal["template", "jobs"]] = Field(default_factory=list)
          role: FitV2Role
          schedule: FitV2Schedule
          reasons: list[FitReason] = Field(default_factory=list)

      class FitCounts(CamelModel):
          strong: int = 0; good: int = 0; partial: int = 0; weak: int = 0; unknown: int = 0

      class FitViewer(CamelModel):
          main_job: str | None
          main_role: str | None
          missing: list[Literal["template", "jobs"]] = Field(default_factory=list)
      ```
  - **V1 parity.** Without the new parameters, every existing field keeps its value and the new fields are `null`, apart from the new `id`.
- **R-SF-B (the pure module).** A new `backend/app/services/finder_fit.py` with no session and no I/O:
  ```python
  ROLE_KEYS = ("tank", "healer", "melee", "ranged", "caster")
  WEEKENDS = frozenset({"SA", "SU"}); WEEKNIGHTS = frozenset({"MO", "TU", "WE", "TH", "FR"})

  def role_for_job(job: str | None) -> str | None: ...          # job_category(): Tank→tank, Pure/Shield Healer→healer, Melee→melee, Physical Ranged→ranged, Caster→caster
  def listing_day_codes(days: list[str] | None) -> list[str]: ... # "Monday"/"monday"/"MO" → "MO"; unknown dropped; order kept; de-duplicated

  @dataclass(frozen=True)
  class ViewerJob: job: str; role: str | None; is_main: bool

  @dataclass(frozen=True)
  class RecruitEntry: role: str | None; priority: str; jobs: tuple[str, ...]   # priority "needed" | "nice_to_have"; jobs upper-case

  def recruit_entries(listing: dict) -> list[RecruitEntry]: ...
  def compute_role_fit(jobs: list[ViewerJob], entries: list[RecruitEntry], as_role: str | None) -> dict: ...
  def viewer_display_zone(rows: list[tuple[str, str]]) -> str: ...  # (timezone, updated_at) per template row; see R-SF-C
  def compute_schedule_fit(template_days: list[TemplateDay], listing: dict, *, now: datetime, display_zone: str) -> dict: ...
  def compute_fit_v2(*, role_fit: dict, schedule_fit: dict, goal_counts: dict, comms_fit: dict, bis_fit: dict, missing: list[str]) -> dict: ...
  def best_match_key(tier: str, reasons: list[dict]) -> tuple[int, int]: ...  # (TIER_RANK[tier], -#match reasons)
  def in_day_group(day_group: str, codes: list[str]) -> bool: ...
  ```
- **R-SF-C (schedule, per night).**
  - **Days.** `codes = listing_day_codes(listing["scheduleDays"])`. With no codes, or no template day with a valid slot, the result is `{status: "unknown", basis: "day", nights: []}`.
  - **Viewer free set.** Build it with `expand_personal_templates(days=template_days, start=min_occurrence - 1 day, end=max_occurrence + 2 days)` for the one synthetic user. That gives UTC `(date, "HH:MM")` pairs. Floor every minute to `00` or `30` on both sides, so :15 and :45 zone offsets still compare.
  - **Time basis.** `start = parse_slot(listing["scheduleStartTime"])`, `end = parse_slot(listing["scheduleEndTime"])` and `zone = load_zone(listing["timezone"])`. If any of the three is `None`, use the **day basis** below. For each code, in listing order:
    1. `occ` = the first date ≥ `now.astimezone(zone).date()` whose `weekday_code` equals the code.
    2. `s = datetime.combine(occ, start, tzinfo=zone)` and `e = datetime.combine(occ, end, tzinfo=zone)`. If `e <= s`, add one day to `e`.
    3. Step in **UTC**: `t = s.astimezone(UTC) + k·30min` while `t < e.astimezone(UTC)`. Each `t` is free when `(t.date().isoformat(), floor(t).strftime("%H:%M"))` is in the free set.
    4. The night's coverage is `full` (all free), `part` (some) or `none`.
    5. `local_day`, `local_start` and `local_end` come from `s` and `e` converted to `display_zone`.
  - **Day basis.** A night per code: `full` if the template has a day with that code and at least one valid slot, otherwise `none`. The `local_*` fields are `None`.
  - **Status** (SF-2): `match` if every night is `full`. `partial` if any night is `full` or `part`. `conflict` otherwise.
  - **Display zone.** `viewer_display_zone` returns the timezone of the template row with the newest `updated_at` whose zone loads, and `"UTC"` otherwise. Ties go to the first row in input order.
  - **Determinism.** `now` is injected; the router passes `datetime.now(timezone.utc)`.
- **R-SF-D (role).**
  - **`recruit_entries`.**
    - Use `recruitingRoles` when it is a non-empty list. Drop an entry whose `role` isn't one of `ROLE_KEYS`. A `priority` other than `"nice_to_have"` counts as `"needed"`. Jobs are upper-cased.
    - Otherwise map the legacy fields the way `initRecruitingRoles` does (`DiscoveryTab.tsx:157-182`): one needed entry per `neededRoles` value, holding the `neededJobs` whose `role_for_job` equals that role. A job whose role isn't listed joins the entry for its role, or starts a new needed entry.
  - **Hit.** `hit(job, role, entry) = (entry.jobs and job in entry.jobs) or (not entry.jobs and role == entry.role)`.
  - **Without `as_role`:**
    - `unknown` when there are no entries, or no jobs.
    - `match` (`is_main=True`) when the main hits a needed entry.
    - Otherwise `partial` when the first job, in priority order, hits a needed entry. Then `partial` when the first job hits a nice-to-have entry.
    - Otherwise `none`.
  - **With `as_role`:** `match` when a needed entry has `role == as_role`, `partial` when a nice-to-have entry does, `none` otherwise, and `unknown` with no entries. `matched_role = as_role` and `matched_job = None`.
  - The main job is the first `ViewerJob` after the `priority_order` sort (`discovery.py:266-267`).
- **R-SF-E (viewer inputs).**
  - With `fitV2` and a signed-in caller, the endpoint loads the profile **without** the visibility filter. Its jobs, public goals and public BiS are loaded as today. Templates are loaded by `user_id` even with no profile.
  - V1's `fit_summary` is computed only when `profile.visibility == "discoverable"`, as today.
  - **Statement budget.**
    - For a discoverable viewer, `fitV2` on adds **0** statements over `fitV2` off.
    - The count is independent of the number of listings (1 vs 5).
    - With `fitV2` off and no auth, the count equals today's.
  - **`missing`:** `"jobs"` when there are no job rows, and `"template"` when no template row has a valid slot.
- **R-SF-F (filters with fitV2).**
  - `scheduleOverlap` keeps listings whose V2 schedule status is `match` or `partial`. Without `fitV2` it keeps today's code path.
  - `hideGoalConflicts` is unchanged.
  - `dayGroup` (SF-7):
    - With a computed time-basis fit, test `in_day_group` on the nights' `local_day`s.
    - Otherwise test it on `listing_day_codes(scheduleDays)`.
    - A listing with no days is dropped whenever `dayGroup` is set.
  - `fitCounts` counts tiers across the **filtered** list, before pagination.
- **R-SF-G (tier, reasons, sort).**
  - **Tier.** `tier = _compute_overall(goal_counts, {"status": role_status}, {"status": schedule_status}, comms_fit, bis_fit)` (`fit_score.py:260`), unchanged. It is imported, not copied.
  - **Reasons**, in this order, only when resolved:
    - role: `match`/`partial` → same; `none` → `conflict`; params = the `FitV2Role` fields.
    - schedule: the status; params `{basis}`.
    - goals: `conflict` if `conflicts > 0`, else `match` if `aligned > 0`, else `partial` if `partial > 0`, else omitted; params = the four counts.
    - comms: `match`, `partial` or `conflict`; omitted when `unknown`.
    - bis: `ready` → `match`, `partial` → `partial`; omitted when `unknown`.
  - **Sort `best`.** Sort stably by `last_updated` descending, then stably by `best_match_key`, where `TIER_RANK = {strong: 0, good: 1, partial: 2, unknown: 3, weak: 4}`.
- **R-SF-H (the seam).**
  - `pages/Discover.tsx`: rename the current `export function Discover()` to `function LegacyDiscover()` (unexported), and add:
    ```tsx
    // Stage-4 SF1 — SANCTIONED legacy-file seam: V2 chrome renders the Static Finder.
    // Provably false on every legacy render path (no V2ChromeContext provider).
    export function Discover() {
      const inV2Chrome = useInV2Chrome();
      return inV2Chrome ? <StaticFinder /> : <LegacyDiscover />;
    }
    ```
    `export default Discover` is unchanged. The option-list move (R-SF-M) is the only other edit to this file.
  - `pages/Discover.test.tsx` stays **unedited** and green.
- **R-SF-I (join requests, V2).**
  - `useJoinRequestStore` (`stores/joinRequestStore.ts`): call `fetchMyRequests()` on mount.
  - For each card, take the newest request with `staticGroupId === item.id`:
    - `pending` or `under_review`: the text "Request pending" plus a `Button variant="ghost" size="sm"` labelled `Cancel request`. It calls `cancelRequest(id)`; on failure, `toast.error('Couldn\'t cancel the request')`.
    - `accepted`: `Tag variant="label" tone="success"` "Accepted".
    - `declined`: `Tag variant="label" tone="error"` "Declined".
    - Anything else: `Button variant="primary" size="sm"` "Request to join", which opens `JoinRequestModal` with `shareCode`, `staticName`, `neededJobs`, `neededRoles` and `recruitmentStatus`. There is one modal per page, not per card.
- **R-SF-J (Leading a static?).**
  - `led = groups.filter(g => g.userRole === 'owner' || g.userRole === 'lead')` from `useStaticGroupStore`, calling `fetchGroups()` on mount if `groups` is empty.
  - **Copy:** the heading `Leading a static?` and the body `Post a recruitment listing so matching players can find you.`
  - **One static:** `Button` "Post a listing" → the handler in the premises (navigate, then `open({ tab: 'recruitment', section: 'listing' })`).
  - **Several:** a `Select` with placeholder "Choose a static" listing the led statics' names. Choosing one runs the same handler.
  - **None:** `Button` "Create a static" opens `SetupWizard` (`components/wizard`), with `onComplete={(_id, shareCode) => navigate(`/group/${shareCode}`)}` as in `PlayerHub.tsx:221-228`.
- **R-SF-K (the autofill fix).** In `routers/static_groups.py:1283-1293`, convert `start_dt` and `end_dt` into `load_zone(s.timezone) or timezone.utc` before `strftime("%A")` and `strftime("%H:%M")`. The rest of the endpoint is untouched. Existing tests that encode the UTC reading get their expected values corrected, each with a one-line comment citing R-SF-K.
- **R-SF-L (boundaries).** Add `finder` to the ring1 element pattern in `eslint.config.js:50-61`. Components use relative imports (`:278-290`).
- **R-SF-M (the option lists).** Create `components/finder/discoveryOptions.ts` exporting the V1 option lists V2 needs:
  - job options
  - intensity
  - recruitment status
  - goal category (with labels)
  - the data-center, server, timezone and language option builders

  They are moved from `Discover.tsx:106-224` with the same values, labels and order. `Discover.tsx` imports them, and `git diff` on the file shows only the moves, the import and the seam.
- **R-SF-N (the V2 page).** New files under `frontend/src/components/finder/`: `types.ts`, `discoveryOptions.ts`, `useFinderQuery.ts`, `StaticFinder.tsx`, `FinderFilters.tsx`, `FinderSummary.tsx`, `FinderCard.tsx`, `reasonCopy.ts`, `JoinAction.tsx`, `LeadingStaticRow.tsx`, `FinderNudge.tsx`, and tests beside them.
  - **Layout:** left-aligned; the container matches `PlayerHub`'s outer classes; nothing sticky.
  - **Header:** `PageHeader` with title `Static Finder` and subtitle `Find a group that fits your content, schedule and role.`
  - **Two columns at `lg`:** the filters, then the results.
  - Mobile is out of scope.
- **R-SF-O (the query hook).**
  - `useFinderQuery()` owns the URL ↔ state ↔ request loop:
    - It reads and writes the URL keys `q`, `sort`, `asRole`, `dayGroup`, `goalCategory` (comma-separated), `scheduleOverlap`, `hideGoalConflicts`, `job`, `intensity`, `recruitmentStatus`, `dataCenter`, `server`, `timezone` and `language`.
    - It omits `sort` from the URL when it is `best`, and uses `setSearchParams(…, { replace: true })`.
    - `q` is debounced 350 ms (`useDebounce`).
    - Choosing a data center resets `server`, as V1 does.
  - Every request sends `fitV2=true` and `sort` through `authRequest<FinderResponse>('/api/discovery/statics?…')`.
  - A per-hook request sequence drops a superseded response.
  - **It returns** `{ state, setters, items, total, fitCounts, viewer, loading, error, retry, clearFilters, hasFilters }`.
- **R-SF-P (copy, exact).**
  - **Tiers:**

    | Tier | Label | Tone |
    |---|---|---|
    | strong | `Strong fit` | success |
    | good | `Good fit` | info |
    | partial | `Partial fit` | warning |
    | weak | `Weak fit` | error |
    | unknown | `Not enough info` | muted |

  - **Role labels:** tank → `tank`, healer → `healer`, melee → `melee DPS`, ranged → `physical ranged DPS`, caster → `caster`. Chip labels: `Tank`, `Healer`, `Melee`, `Ranged`, `Caster`.
  - **Role reasons:**

    | Case | Copy |
    |---|---|
    | match, own job | `Needs a {role} — your {job} (main)` |
    | match, `asRole` | `Needs a {role}` |
    | partial, needed | `Needs a {role} — your {job} (alt)` |
    | partial, nice-to-have | `Would like a {role} — your {job}` (with `asRole`: `Would like a {role}`) |
    | conflict | `Not recruiting your role` (with `asRole`: `Not recruiting a {role}`) |

  - **Schedule reason, time basis:** the nights joined by ` · `, each as `{Ddd} {start}–{end} {state}`.
    - `Ddd` is the short name of `localDay` (`Mon`…`Sun`).
    - `start` and `end` use `formatTimeLabel` from `components/schedule/scheduleWeek.ts`.
    - `state` is `free` (full), `partly free` (part) or `busy` (none).
  - **Schedule reason, day basis:** `Raids {Ddd/Ddd} — no time listed` followed by:
    - match: `, you're free those days`
    - partial: `, you're free some of those days`
    - conflict: `, not on your free days`
  - **Goals:** match `{n} goal{s} in common`; partial `Goals partly overlap`; conflict `Goals conflict with yours`.
  - **Comms:** match `Comms match`; partial `Comms partly match`; conflict `Needs voice chat`.
  - **BiS:** match `Your BiS is ready to share`; partial `Your BiS is partly set`.
  - **Reason icons** (lucide, 14 px, with an `aria-label` of the status word):
    - match: `Check`, `text-status-success`
    - partial: `CircleDot`, `text-status-warning`
    - conflict: `X`, `text-status-error`
  - **Summary:** `{n} of {total} statics are a good fit for you`, plus ` as a {role}` when a role is known, where `n = strong + good`. When `n == 0`: `No strong matches yet — try another role or loosen your filters.`
  - **Nudge:**
    - template: `Add your typical week on the Hub to match raid times.` + `LinkText` `Set your typical week` → `/profile?tab=availability`.
    - jobs: `Add your jobs on the Hub to match open roles.` + `LinkText` `Add jobs` → `/profile?tab=characters`.
    - Both lines render when both are missing.
  - **Role chip caption:** with no `asRole` and a known main, `Matching as your {mainJob}`. With `asRole`, `LinkText` `Match as your {mainJob} again`, which clears it.
  - **Empty:** `EmptyState` with heading `No statics match` and description `Try another role or loosen your filters.`, plus a `Clear filters` action when `hasFilters`.
  - **Error:** `Couldn't load statics.` + `Button` `Retry`.
  - **Loading:** three `CardSkeleton`s.
- **R-SF-Q (budgets and gates).**
  - jscpd **≤ 343** clones; ESLint **0 errors, ≤ 809 warnings** (both measured 2026-09-27 on `main`'s tree @ `e7de1f4c`).
  - `deadcode` unchanged; `build` (`tsc -b`) clean; `check:design-system:strict` clean.
  - Backend `pytest tests/ -q` green. `test_discovery.py` and `test_fit_score.py` stay green; they are edited only for R-SF-K and the new `id` field.
  - Release notes: one entry per PR that touches `frontend/src` or `backend/app`, `internal: true`, matching PH3's V2-preview entries (`releaseNotes.ts` 2.1.45/2.1.46). `CURRENT_VERSION` is not bumped. Single quotes are escaped as `\'`, and the file is edited with Edit/Write only.
- **R-SF-R (files and scope).**
  - **Task 1:** `routers/discovery.py`, `schemas/discovery.py`, new `services/finder_fit.py`, `services/availability_layering.py` (the two renames only), `routers/static_groups.py` (R-SF-K lines only), `tests/factories.py` (`create_player_profile` gains `visibility: str = "private"`; `create_player_job_profile` gains `role: str | None = None` and `priority: str = "flex"`, where `role=None` means today's `"melee"`), new `tests/test_finder_fit.py`, new `tests/test_discovery_fit_v2.py`, and `tests/test_discovery.py` (R-SF-K and `id` only).
  - **Task 2:** `pages/Discover.tsx` (R-SF-H, R-SF-M only), `eslint.config.js` (R-SF-L), and the `components/finder/` files for types, options, the hook, `StaticFinder`, `FinderFilters`, `FinderSummary` and a minimal `FinderCard`, plus tests.
  - **Task 3:** `components/finder/` (`FinderCard`, `reasonCopy`, `JoinAction`, `LeadingStaticRow`, `FinderNudge`, `StaticFinder` wiring) and tests.
  - **Read-only:** every model, `backend/app/database.py`, `fit_score.py` (import only), `routers/join_requests.py`, `components/ui/*`, `components/primitives/*`, `components/static-group/*`, `components/settings/*`, `components/wizard/*`, `stores/*`, `components/schedule/*` (import only), and `pages/Discover.test.tsx`.
  - Any other file needs a NEEDS_CONTEXT report.

## Review Focus

- **R-SF-C:**
  - A window that crosses midnight.
  - A viewer east of the listing whose raid night starts on the next local day.
  - A DST week: the listing zone switches while the viewer's doesn't.
  - A Nepal viewer (UTC+5:45): minutes floor to :30.
  - Template rows in two different zones.
  - A listing with times but no zone → day basis.
  - A listing zone `"America"` → day basis, no 500.
  - Only empty template rows → `unknown` with `missing: ["template"]`.
- **R-SF-D:** a role-only entry (`jobs: []`); a nice-to-have entry; a legacy listing with only `neededJobs`; an unknown role string; `asRole` for a role the listing only lists specific jobs under.
- **R-SF-A/E:** does any existing field change value for a V1 request (golden test)? Does a private-profile viewer get a V2 fit but no V1 fit? Is the statement delta 0?
- **R-SF-H/M:** does V1's rendered markup change (the unedited `Discover.test.tsx` plus the option-list byte check)? Does V1 fetch under V2 chrome?
- **R-SF-I/J:** two statics with the same name and different requests; `under_review`; a failing cancel; zero, one and two led statics; the settings panel landing on Recruitment → Listing after navigation (browser).

## Task 1 — Engine and API, backend (RISKIEST · `xivrp-implementer-deep`)

Files: per R-SF-R, Task 1.

1. **The golden V1 capture, first, on the base commit.** Write `tests/test_discovery_fit_v2.py::test_v1_response_unchanged`:
   - Fixture:
     - Three public listings with varied discovery settings (reuse `_discovery_settings` from `test_discovery.py:10-44` by copying its call shape).
     - A discoverable viewer with two job profiles (`main` DRG, `flex` WHM), two template days, a public goal and a public BiS set.
   - Call `GET /api/discovery/statics?sort=name` authenticated, and dump the JSON. Commit the result as `tests/golden/discovery_v1.json` **before any production edit**.
   - The test then asserts the response equals the golden file after removing the keys `id`, `fitV2`, `fitCounts` and `viewer`. Paste the base-commit run.
2. **Renames (R-SF-C premise).** `parse_slot`/`load_zone` in `availability_layering.py`, and their internal callers. `pytest tests/test_availability_layering.py -q` unedited; paste.
3. **The module, test-first** (`tests/test_finder_fit.py`, no session, `now = datetime(2026, 6, 3, 12, tzinfo=UTC)`, a Wednesday):
   - `listing_day_codes(["Friday", "saturday", "SU", "Mon", "Friday"]) == ["FR", "SA", "SU"]`.
   - `role_for_job`: `"war"` → `"tank"`, `"SGE"` → `"healer"`, `"VPR"` → `"melee"`, `"DNC"` → `"ranged"`, `"PCT"` → `"caster"`, `"XYZ"` → `None`.
   - `recruit_entries`:
     - `recruitingRoles` wins over the legacy fields.
     - Legacy `neededRoles=["melee"]` + `neededJobs=["DRG", "WHM"]` → `[melee needed (DRG), healer needed (WHM)]`.
     - An entry with role `"dps"` is dropped.
     - Priority `"whatever"` → `"needed"`.
   - `compute_role_fit`, over entries `[melee needed ()]`, `[melee needed (DRG)]` and `[healer nice ()]`:
     - A main DRG → `match`, `is_main`, `matched_job "DRG"`.
     - A main WHM with a DRG alt → `partial` (needed).
     - A main WHM against `healer nice` → `partial`, `priority "nice_to_have"`.
     - Main PLD → `none`.
     - No entries → `unknown`; no jobs → `unknown`.
     - `as_role="melee"` against `[melee needed (DRG)]` → `match`.
     - `as_role="tank"` → `none`.
   - `compute_schedule_fit`: the listing is Fri 20:00–23:00 `America/New_York`, and the viewer's template is in `America/New_York`:
     - Template `FR 20:00…22:30` → `match`, one night `full`, `local_day "FR"`, `20:00`–`23:00`.
     - Drop `22:30` → `partial`, `part`.
     - A template only on `MO` → `conflict`, `none`.
   - **Cross zone:** the viewer is in `Europe/London` (BST) with template `SA 01:00…03:30` → `match`, `local_day "SA"`, `local_start "01:00"`.
   - **Midnight crossing:** the listing is Fri 22:00–01:00 New York; the viewer's New York template has `FR 22:00…23:30` and `SA 00:00, 00:30` → `match`.
   - **Two-day span with the viewer east:** the listing is Fri 20:00–23:00 New York, and the viewer in `Asia/Tokyo` has `SA 09:00…11:30` → `match`, `local_day "SA"`.
   - **DST:** `now = 2026-03-04`. The listing is Fri 20:00 New York, whose next occurrence 2026-03-06 is before the 03-08 switch, and the London viewer's template is `SA 01:00…03:30` → `match`. With `now = 2026-03-10` (New York on EDT, London still GMT until 03-29), the same template → `partial`, because the raid is now 00:00–03:00 London.
   - **Nepal:** a viewer in `Asia/Kathmandu` → the minute floor holds, and there's no exception.
   - **Two zones:** a `FR` row in New York and a `SA` row in London → each converts in its own zone. The display zone is the newer row's.
   - **Day basis:** a listing with no `scheduleStartTime` → `basis "day"`, `local_*` `None`. A listing zone of `"America"` → day basis.
   - Only empty template rows → `unknown`.
   - `in_day_group("weekends", ["FR"]) is False`; `in_day_group("weeknights", ["FR"]) is True`.
   - `compute_fit_v2`:
     - Tier parity with `_compute_overall` on six hand-built inputs.
     - Reason order and omission, per R-SF-G.
     - `best_match_key` ordering.
4. **Endpoint (R-SF-A, E, F, G).** Tests in `tests/test_discovery_fit_v2.py` use the route-level `client`/auth-header pattern (`test_fit_score.py:376+`):
   - `fitV2` off → the golden test passes; `id` is present; the new fields are `null`.
   - `fitV2` on, discoverable viewer → `fitV2` on every item, plus `viewer.mainJob == "DRG"`, `viewer.mainRole == "melee"` and `fitCounts` summing to `total`.
   - A **private** profile with `fitV2` on → `fitV2` present, and `fitSummary` still `null`.
   - A guest with `fitV2` → every `fitV2` `null`, `viewer` `null`, `sort=best` behaving as `recent`.
   - `asRole=tank` changes only `fitV2.role` and `fitCounts`.
   - `sort=best` over three listings (strong, weak, good) → strong, good, weak. Ties break on recency.
   - `fitCounts` before pagination: 5 listings with `limit=2` → the counts sum to 5.
   - `scheduleOverlap=true` + `fitV2` → only `match`/`partial` listings.
   - `dayGroup=weekends` → the Fri-evening New York listing is kept for a Sydney viewer and dropped for a New York viewer (spec §7.5). A listing with no days is dropped.
   - `goalCategory=savage_bis,ultimate_clear` → the union. The single value `savage_bis` → the same result as today.
   - Statements (R-SF-E): off vs on for a discoverable viewer → delta 0. One listing vs five → the same count.
5. **Autofill (R-SF-K).** Test: a recurring session `start_time "2026-02-27T00:00:00.000Z"`, `end_time "2026-02-27T03:00:00.000Z"`, `timezone "America/New_York"` → suggestions `scheduleDays == ["Thursday"]`, `scheduleStartTime == "19:00"`, `scheduleEndTime == "22:00"`. Correct any existing assertion that encodes the UTC reading, with a comment.
6. **Gates.** `pytest tests/ -q` (paste the line), and `ruff check` on the touched files, with no new findings.

Size: ~900–1,100 lines including tests.

**Ad hoc mutation checks (execute and paste):**
- (a) Skip the `astimezone` into UTC when stepping → the cross-zone test fails.
- (b) Drop the `e <= s` day roll → the midnight test fails.
- (c) Use the listing's calendar day for `local_day` → the Sydney `dayGroup` test fails.
- (d) Reinstate the visibility filter on the `fitV2` path → the private-profile test fails.
- (e) Count `fitCounts` after slicing → the pagination test fails.
- (f) Remove the minute floor → the Nepal test fails, or raises.
- (g) Revert R-SF-K → the autofill test fails.

## Task 2 — V2 data layer and page frame (`xivrp-implementer`, sonnet)

Files: per R-SF-R, Task 2.

1. **Boundaries and options (R-SF-L, R-SF-M).** Move the option lists. `pnpm -C frontend test src/pages/Discover.test.tsx` unedited; paste. Paste `git diff --stat -- frontend/src/pages/Discover.tsx`.
2. **Types (`finder/types.ts`).** `FinderItem` (the V1 item fields plus `id`, `recruitingRoles`, `communicationStyle`, `objectiveCategories`, `fitV2`), `FitV2`, `FitNight`, `FitReason`, `FitCounts`, `FitViewer` and `FinderResponse`, mirroring R-SF-A in camelCase.
3. **Hook (R-SF-O)**, `useFinderQuery.test.tsx` (mock `../../services/api` the way `Discover.test.tsx:33-38` does):
   - (a) First load → a request with `fitV2=true&sort=best`, and no `sort` in the URL.
   - (b) URL `?asRole=tank&dayGroup=weekends&goalCategory=savage_bis,ultimate_clear&scheduleOverlap=true` → the request carries each value.
   - (c) Setting a data center clears `server`.
   - (d) Two requests resolving out of order → the state holds the later one.
   - (e) `clearFilters` empties the URL except `sort`.
   - (f) An error → `error` set; `retry` refetches.
4. **The seam (R-SF-H).** `pages/Discover.v2seam.test.tsx` uses the `Profile.v2seam.test.tsx:90-137` pattern:
   - Without the provider, V1's heading renders and `static-finder` is absent.
   - With it, `data-testid="static-finder"` renders, and V1's request URL (no `fitV2`) is never called.
5. **The page frame (R-SF-N, P):** `StaticFinder`, `FinderFilters`, `FinderSummary`, and a minimal `FinderCard` (name, DC/server, tier `Tag`). Tests:
   - Role chips: the main's chip is `pressed` with the caption. Clicking `Tank` sets `asRole=tank`, and the caption becomes the reset `LinkText`. Clicking it clears `asRole`.
   - Content checkboxes build the CSV.
   - `Fits my typical week` and `Hide goal conflicts` checkboxes; Weeknights and Weekends are exclusive toggles; the Vibe chips are exclusive.
   - More filters starts collapsed (`aria-expanded="false"`); expanding it shows the job, recruitment status, data center, server, timezone and language `Select`s.
   - The summary string for `fitCounts {strong: 2, good: 1, …}` with total 7 → `3 of 7 statics are a good fit for you as a melee DPS`. `n == 0` → the no-match string.
   - The sort `Select` has four options, defaulting to Best match.
   - States: three skeletons while loading; the empty state with Clear filters; the error with Retry.
6. **Design system.** No raw elements; `text-xs` is the floor; `check:design-system:strict` clean.
7. **Gates (R-SF-Q):** `build`, `lint`, `check:design-system:strict`, `test`, `dupes` (≤ 343), `deadcode`. Paste each line.

Size: ~600–750 lines including tests.

**Ad hoc mutation checks:**
- (a) Return `<LegacyDiscover />` unconditionally → the seam test fails.
- (b) Remove the request sequence → hook test (d) fails.
- (c) Default `sort` to `recent` → hook test (a) fails.

## Task 3 — Card body and entry points (`xivrp-implementer`, sonnet)

Files: per R-SF-R, Task 3.

1. **`reasonCopy.ts`**, pure, with `reasonCopy.test.ts`:
   - Every row of R-SF-P: role (five cases × with/without `asRole`), schedule time basis (two nights: `Fri {formatTimeLabel('20:00')}–{formatTimeLabel('23:00')} free · Sat … partly free`), day basis (three statuses), goals (`1 goal in common`, `2 goals in common`), comms, BiS.
   - The role labels.
   - An unknown `kind` → `null`, not a throw.
2. **`FinderCard` body:**
   - Objective tags (`Tag variant="label"`).
   - Description, the schedule text in the listing's own terms (the V1 string), intensity, recruitment status, languages and contact.
   - Members only when `memberCount > 0`.
   - Reason rows with icons and `aria-label`s.
   - `View static` → `LinkText href={`/group/${shareCode}`}`.
   - Tests: the reason rows render in API order; members are hidden at 0; the tier tag has its tone.
3. **`JoinAction` (R-SF-I)**, tests (mock `joinRequestStore`):
   - `pending` and `under_review` → "Request pending" + `Cancel request`, which calls `cancelRequest(id)`. A rejected cancel → a toast.
   - `accepted` and `declined` tags.
   - No request → `Request to join` opens the modal with the item's `shareCode` and `name`.
   - **Two items with the same `name` and different `id`s,** one with a pending request → only that card shows pending.
4. **`FinderNudge`:** `viewer.missing` `['template']`, `['jobs']`, both, or none → the exact lines and hrefs.
5. **`LeadingStaticRow` (R-SF-J)**, tests (mock `staticGroupStore`, `settingsPanelStore` and `useNavigate`):
   - Zero led → `Create a static` opens `SetupWizard`.
   - One led → `Post a listing` calls `navigate('/group/ABC')` and then `open({ tab: 'recruitment', section: 'listing' })`.
   - Two led → the `Select` lists both, and choosing one runs the same calls.
   - A `member`-only group isn't listed.
6. **Browser pass** (slice § 2), in a non-UTC timezone (`America/New_York`):
   - Seed two public listings in DEVTST-style statics: one in `Europe/London` on Fri/Sat 20:00–23:00, and one with no times.
   - Seed a typical week for DevMember in `America/New_York` that covers London Fri 20:00–23:00 (Fri 15:00–18:00 New York), but not Saturday.
   - `/discover?shell=v2` → the London card reads `Fri 3:00 PM–6:00 PM free · Sat 3:00 PM–6:00 PM busy` (time format per `formatTimeLabel`) with a **Partial fit** tag. The no-time card shows the day-basis row.
   - The chips, `asRole`, Weekends and the summary work.
   - Request to join → pending → cancel.
   - As DevOwner, **Post a listing** lands on the static with Settings → Recruitment → Listing open.
   - The nudge for a user with no template.
   - Both themes, at 1440 and 2560. Shots to `docs/redesign/pr-shots/sf1-*.png`, shrunk per `pr-checklist`.
7. **Gates (R-SF-Q)**, each line pasted.

Size: ~550–700 lines including tests.

**Ad hoc mutation checks:**
- (a) Match requests by name → the same-name test fails.
- (b) Drop `under_review` from pending → its test fails.
- (c) Open the panel before `navigate` → the order assertion fails. Assert call order with a shared `vi.fn` log.

## Finish (controller)

1. **Write-backs, once, on SF1c:**
   - Spec §4: `id`, `viewer` and `fitCounts` as built.
   - Spec §5: objective tags instead of "content progress".
   - Spec status line: built.
   - `V2_COVERAGE_PLAN.md` Stage 4: status, with mockup-06 re-validation closed and its deviations (tier instead of %, "Request to join", objective tags instead of progress).
   - `RECONCILIATION.md:80-82`: B3 built.
   - This plan: an Outcome section with PRs, sizes, rulings and loop numbers.
2. `pr-checklist` skill: release notes (R-SF-Q), screenshots shrunk, `git diff --check`, no workflow changes.
3. Gates on each head, with the counts pasted into each PR body.
4. Draft → ready once per PR. Merge bottom-first per `slice-loop` § Stacked PRs, polling for the restack.
5. The final message per the skill, then rewrite `SESSION_HANDOFF.md`.
