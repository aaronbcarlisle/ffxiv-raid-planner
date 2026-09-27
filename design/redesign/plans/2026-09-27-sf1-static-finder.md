# Stage 4 · SF1 — Static Finder: recruitment as matching

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** the Static Finder ranks public listings by how well they fit the signed-in player, and it explains every fit. It checks each raid night against the player's Hub typical week, in the player's time zone, and the role need against the player's Hub jobs. The page is a V2-native body built to mockup 06, and V1 Discover stays unchanged.

**Architecture:**
- **Task 1 (the riskiest):** the engine and API, backend only.
  - A pure module `services/finder_fit.py`: per-night schedule coverage through the PH3 zone helpers, role fit from `recruitingRoles`, and the tier, reasons and sort key.
  - Wired into `GET /api/discovery/statics` behind `fitV2`, with `asRole`, `dayGroup`, `viewerTz`, `sort=best` and a comma-separated `goalCategory`.
  - Additive response fields; `id` only for a signed-in `fitV2` caller.
  - It also fixes the listing autofill, which reads session times in UTC.
- **Task 2:** the V2 data layer and page frame.
  - The seam in `Discover`, V2 types, and a `useFinderQuery` hook (URL ↔ request, with a stale-response guard).
  - The `StaticFinder` page with its header, filter column, summary bar, sort and loading/empty/error states, plus minimal cards (name, location, tier).
- **Task 3:** the card body and entry points.
  - Reason copy, per-night local times, objective tags and members.
  - View and Request to join with its request states.
  - The Hub nudge, and the "Leading a static?" row (one static, several, or none).
  - The guest branch (R-SF-N).

**PR split (planned now):** a docs PR first, then three stacked draft PRs, one per task.
- **Docs PR** = the spec + this plan. It opens and merges alone, before any code (memory `project_static_finder_stage4`: vet, owner review, one docs PR, then the loop). Folding it into SF1a would put ~1,800 changed lines in one PR (m11).
- **SF1a** = Task 1 only. It is additive and mergeable alone: nothing sends `fitV2` until SF1b.
- **SF1b** = Task 2.
- **SF1c** = Task 3 + the stage write-backs (Finish).
- **SF1b and SF1c merge together** (m14): SF1b alone would ship V2 cards with no View or Join button.
- At Finish the controller measures each task's diff and collapses adjacent PRs whose combined size is ≤ ~1,500 changed lines. One whole-branch review covers the slice.

**Tech stack:** FastAPI (async SQLAlchemy, `CamelModel` schemas) · Python `zoneinfo` (`tzdata` pinned) · pytest + aiosqlite (`count_statements` fixture, `tests/conftest.py:282-306`) · React 19 · TypeScript · Zustand · Vitest + Testing Library · ESLint 9 boundaries (`eslint.config.js:50-145`).

**Spec (binding):** `design/redesign/specs/2026-09-27-static-finder-design.md`: §2 (SF-1…SF-7), §3–§6, §7 (criteria 1–9), §8, §9. Also `CLAUDE.md` § UI rules and § Pitfalls (plugin contract, `n > 0 &&`, LF, `releaseNotes.ts` quoting).

**Plan-vet:** `xivrp-director`, 2026-09-27: **NOT READY (PARITY-GAP)** on the first draft: 2 OWNER, 7 Major, 16 minor, plus 3 additions to the queued sign-offs. F1–F7 and m1–m16 are folded in this revision. OWNER-1/2/3 were answered by the owner on 2026-09-27 and are folded, as are the owner's sign-offs on the parity table and R-SF-K, so the verdict is **READY** after the folds (the director: "folded verbatim, it needs no re-vet"). One addition the director didn't see as written: OWNER-2 adds the `viewerTz` parameter.
- **OWNER-1** (tier) → a V2-only cap: schedule `partial` caps the tier at `partial` (R-SF-G, R-SF-P summary; Task 1 steps 3–4; Task 3 step 6; spec §3.3).
- **OWNER-2** (the viewer's zone) → `viewerTz`, the browser zone, as the fallback display and day-group zone (premises; R-SF-A, B, C, F, O, P; Task 1 steps 3–4; Task 2 step 3; spec SF-7, §4, §7.5).
- **OWNER-3** (`id`) → only with `fitV2` and a signed-in caller, named as a flip (premises; R-SF-A; Task 1 steps 1 and 4; spec §4).
- **Sign-offs:** the parity table and R-SF-K, recorded on both.
- **F1** guests reach the V2 Finder → a premises row; the guest branch (R-SF-N, I, J, O, P); "Log in to join" → keep; spec §5 and §9.
- **F2** V1 affordances missing from the parity table → seven rows (plus two found while folding: Your Goal Match and "No details yet"), R-SF-N/P, Task 2 step 5 and Task 3 step 2 tests.
- **F3** golden test → Task 1 step 1 (a pinned fixture, four captures with statement counts), R-SF-E, R-SF-R.
- **F4** → R-SF-F, Task 1 step 4. **F5** → R-SF-N, spec §5. **F6** → Finish step 1, spec §6. **F7** → Task 3 step 6.
- **m1** → R-SF-P. **m2** and the R-SF-K refinements → the premises row, R-SF-K, Task 1 step 5. **m3** → R-SF-P, Task 3 step 2. **m4**, **m5** → R-SF-C.
- **m6** → Task 1 steps 3–4. **m7** → R-SF-D. **m8** → R-SF-O, the parity table, Task 2 steps 3 and 5. **m9** → R-SF-M, the parity table. **m10** → R-SF-O, R-SF-P, Task 2 step 5.
- **m11**, **m14** → PR split, Finish step 4. **m12** → the Task 1 header. **m13** → spec §3.2. **m15** → Task 3 step 1. **m16** → the mockup-06 table.
- **Citations corrected:** `tests/factories.py:410,457` (vet: `:408,456`); `Discover.tsx:224,247-249` (vet: `:245-247`); `services/discord_guild_events.py:266-267` (the vet gave no directory); the form's four statuses are `DiscoveryTab.tsx:45,56-88` (`:149` is the normaliser); the plain `<a>` is `components/ui/LinkText.tsx:43-44`.
- **Found while folding:** `objectiveCategories` is built from a set (`discovery.py:328`), so its order is a second golden flake (Task 1 step 1).

## Spec premises checked against the code

| Spec line | Code | Ruling |
|---|---|---|
| §3.1 listing `scheduleDays` | The listing form stores **long names** from `RAID_DAYS` (`gamedata/worlds.ts:91`, `DiscoveryTab.tsx:1090`). Templates store iCal `MO…SU` (`models/personal_availability.py:38`). `fit_score._normalise_day` accepts both, but not `Mon` (`fit_score.py:65-69`) | **R-SF-B:** `listing_day_codes()` maps long names (any case) and iCal codes to iCal. Anything else is dropped |
| §3.1 times | `scheduleStartTime`/`EndTime` are `HH:MM` in 30-minute steps (`worlds.ts:105-110`). `timezone` is IANA from `TIMEZONES` | Parsed with `parse_slot`; a zone that doesn't load triggers the day-basis fallback |
| §3.1 "Use the PH3 helpers" | `_parse_slot` (`availability_layering.py:54-64`) and `_load_zone` (`:67-77`, no logging) are private. `expand_personal_templates` (`:80-145`) already converts each template row from **its own** timezone, with a UTC fallback and warnings | **R-SF-C:** rename them `parse_slot`/`load_zone` (only this module uses them). The viewer's free time is built with `expand_personal_templates`, so per-row zones, DST and bad rows behave exactly as the PH3 pipe does |
| Autofill of the listing's times | `GET /static-groups/{id}/discovery/suggestions` (`routers/static_groups.py:1241-1374`) takes the weekday and `HH:MM` from the session's **UTC** ISO start and end (`:1289-1294`), then suggests the sessions' majority timezone beside them (`:1277`). So a Thu 19:00 America/New_York session autofills as `Friday` `00:00` | **R-SF-K (Owner sign-off 2026-09-27):** read a naive start or end as UTC, then convert both into the **suggested** majority zone (UTC when it doesn't load) before `strftime`. This changes what V1's autofill suggests, and makes it correct. Listings already saved keep their stored values, since the app can't tell autofilled times from typed ones |
| §3.2 "Your jobs" | `PlayerJobProfile.role` is stored and validated against `tank/healer/melee/ranged/caster` (`models/player_job_profile.py:53`, `routers/player.py:75,1194-1198`). The endpoint orders jobs with `priority_order` (`discovery.py:256-268`) | Viewer jobs come from these rows in that order. `role` comes from the row, with `role_for_job` as the fallback |
| §3.2 legacy mapping | The backend has no job→role key map. `services/discord_webhook.py:68-82` has `job_category()` (Tank / Pure Healer / Shield Healer / Melee / Physical Ranged / Caster) | **R-SF-D:** `role_for_job()` in `finder_fit.py` maps `job_category()` onto the five role keys. It is used only for the legacy mapping and for the fallback on a job row with no role |
| §4 viewer inputs | Profile, goals, jobs, BiS and templates load **only if** `PlayerProfile.visibility == "discoverable"` (`discovery.py:225-294`). Private profiles get no fit. `user_languages` and `user_comms` are never populated (`:216-222`), so comms fit resolves only as `unknown` on the player side | **R-SF-E:** with `fitV2`, the viewer's own inputs load **whatever the visibility**, because only the viewer sees their own fit. V1's `fitSummary` keeps its discoverable-only gate (checked in Python after one profile load). Comms stays as today, and an `unknown` comms reason is omitted (R-SF-G) |
| §4 "byte-identical apart from two new nullable fields" | `DiscoveryListItem` has no group id (`schemas/discovery.py:93-120`), and a test guards that on this public, unauthenticated endpoint: "must not leak internal IDs", `assert "id" not in item` (`tests/test_discovery.py:270,281`). V1 matches a join request by **name** (`Discover.tsx:545`), so two statics with the same name share a state. `JoinRequest.staticGroupId` exists (`types/index.ts:972-973`) | **R-SF-A (owner, 2026-09-27, OWNER-3):** `id` is emitted **only** with `fitV2` and a signed-in caller. This is a deliberate flip: signed-in V2 viewers now receive internal static ids; guests and V1 do not, and `test_discovery.py:281` keeps passing unedited. V2 matches by `staticGroupId === item.id`. Spec §4 is amended at Finish: `id`, `fitV2`, `fitCounts`, `viewer`, `viewerTz` |
| §3.3 "today's `_compute_overall` rules" | `_compute_overall` (`fit_score.py:260-312`) makes role `match` alone Strong (`:298-299`), and schedule or role `partial` alone Good (`:301-310`). Partial comes only from a comms (or BiS) `partial`. So a listing where one of two nights is free is Strong or Good | **R-SF-G (owner, 2026-09-27, OWNER-1):** a V2-only cap, where schedule `partial` caps the tier at `partial`. V1's `fitSummary` is unchanged. Spec §3.3 amended |
| SF-7 "the viewer's zone" | The spec never defines it. The first draft used the newest template row's zone, so a viewer with no typical week got no local times, and `dayGroup` judged them on the static's calendar (a Sydney viewer with no template lost §7.5) | **R-SF-C (owner, 2026-09-27, OWNER-2):** a new optional `viewerTz` (the browser zone) is the fallback display and day-group zone. Spec SF-7, §4 and §7.5 amended |
| §5 "Out of reach: guests can't enter V2 (D7)" | `Layout.tsx:71` turns V2 chrome on with `resolvedShell === 'v2' && pathname !== '/'` and no auth check, and `App.tsx:160` doesn't guard `/discover`. `?shell=v2` or a persisted `ui-shell` works for a guest and survives logout; "guests *can* be on v2" (`V2_COVERAGE_PLAN.md:100`) | **F1:** the V2 Finder has a guest branch (R-SF-N), and "Log in to join" is kept. Spec §5 and §9 written back |
| §5 "the default is your main job's role" | The response doesn't carry the viewer's main job; the frontend profile store would mean an extra fetch (`playerProfileStore.ts:180`) | **R-SF-A:** with `fitV2`, the response carries `viewer: {mainJob, mainRole, missing}`, or `null` for guests |
| §5 card "content progress" | The listing has no progress data. It has `objectiveCategories` (`schemas/discovery.py:117`) | Cards show objective tags instead. Spec write-back |
| §5 "More filters … V1's data center, server, language and recruitment status" | V1 also filters by `role`, `job`, `timezone`, `hideConflicts` and `hideGoalConflicts` (`Discover.tsx:224,424-499`) | Every V1 affordance is settled in the parity table below (Owner sign-off 2026-09-27) |
| §5 seam "at the top of `Discover`" | `Discover` runs about 15 hooks (`:238-354`) before its JSX (`:356`), including the fetch effect. `react-hooks` is on (`eslint.config.js:3,29`) | **R-SF-H:** rename the body `LegacyDiscover` (unexported). `export function Discover()` calls `useInV2Chrome()` and returns `<StaticFinder />` or `<LegacyDiscover />`. No hook-order problem, no V1 fetch under V2, and V1's markup is unchanged |
| §5 "Leading a static? routes to Settings → Recruitment" | `useSettingsPanelStore.getState().open({ tab, section })` (`stores/settingsPanelStore.ts:16-20,43-49`). Off `/group/*`, the global host shows General only, and the clamp is **display-only** (`SettingsPanel.tsx:360-365`: `effectiveTab`, and the store is never written). The store doesn't reset on navigation. No code today navigates and then opens | **R-SF-J:** in one click handler, `navigate(`/group/${shareCode}`)` then `open({ tab: 'recruitment', section: 'listing' })`. Browser-verified (Task 3, step 6). If the panel doesn't land on Recruitment → Listing, report NEEDS_CONTEXT; don't invent a URL mechanism (memory `project_settings_panel_store`) |
| §5 "Request to join … V1's states" | V1 handles `pending`, `accepted` and `declined`; `under_review` and `cancelled` fall through to "Request to Join" (`Discover.tsx:545,792-811`). V1's "Pending" button cancels without saying so | **R-SF-I:** V2 treats `pending` and `under_review` as pending, and shows the text "Request pending" plus a separate `Cancel request` button. `cancelled` shows Request to join again |
| Component boundaries | `components/finder/` matches no element pattern (`eslint.config.js:50-61`) | **R-SF-L:** add `finder` to the **ring1** pattern (Ring 1 = recruitment). It may then import ring0 (`static-group`, `wizard`), ring1 (`schedule`) and person, but not ring3 or admin |
| Filter option lists | V1 keeps its own local option consts (`Discover.tsx:106-224`) | **R-SF-M:** the lists V2 needs move to `components/finder/discoveryOptions.ts` **byte-for-byte** (values, labels, order), and `Discover.tsx` imports them. That is the only other edit to V1's file. It avoids jscpd clones. Recruitment status is the exception: V2 gets its own list (m9) |

## V1 Discover parity (Owner sign-off 2026-09-27)

| V1 affordance (`pages/Discover.tsx`) | V2 | Disposition |
|---|---|---|
| Search `q` (`:377`) | Search input | keep |
| Sort recent / members / name (`:129-133`) | Sort `Select`: Best match (default), Recent, Members, Name. Guests: no Best match, Recent by default | keep + `best` |
| `role` filter: statics needing a role (`:424`) | "My role" chips set `asRole`. Best match ranks role fits first; a role miss makes a listing Weak. A V1 link's `role` is read as `asRole` (R-SF-O) | **fold.** A default chip that also *filtered* would hide every listing with no roles set |
| `job` filter (`:426`) | More filters | keep |
| `intensity` (`:428`) | Vibe chips | keep |
| `recruitmentStatus` (`:430`) | More filters, with V2's own list: the form's four statuses `open`, `selective`, `paused`, `closed` (`DiscoveryTab.tsx:45,56-88`). V1's list (`Discover.tsx:122-127`) lacks `selective` and `paused`; that gap stays in frozen V1 | keep, corrected in V2 (m9) |
| `goalCategory` single select (`:448`) | Content checkboxes (multi) | keep, widened |
| `hideConflicts`: legacy public-goal alignment (`:450-477`, `discovery.py:336-348`) | Not offered. `hideGoalConflicts` covers the same intent from the fit engine, and a V1 link's `hideConflicts=true` is read as `hideGoalConflicts=true` (R-SF-O) | **drop** |
| `hideGoalConflicts` | "Hide goal conflicts" checkbox (Content group); works for private profiles too (R-SF-F) | keep |
| `scheduleOverlap` | "Fits my typical week" checkbox (per-night status); disabled with no typical week (R-SF-P) | keep, upgraded |
| The three fit checkboxes are signed-in only (`:450`) | The two V2 checkboxes are hidden for guests (R-SF-N) | keep |
| `dataCenter` / `server` (server disabled until a DC is chosen) / `timezone` / `language` (`:486-499`) | More filters, same behaviour | keep |
| Filters panel toggle (`showFilters`, `:247`), opened on load when a filter key is in the URL (`:224,247-249`) | The filter column is always shown; More filters collapses, and opens on load when any of its keys is in the URL (R-SF-O) | fold |
| **Clear all** beside the results when filters or a search are set (`:408-413`) | `Clear all` in the filter-column header when `hasFilters` (R-SF-N) | keep |
| Opt-in privacy line (`:368`) | The same line under the page header (R-SF-N) | keep |
| Empty state with no filters (`:535`, "…list their group…") | `No statics are recruiting yet` with "static" wording (R-SF-P) | keep, reworded |
| Card: fit tokens (`FitSummarySection`, `:836-892`) | Tier tag + reason rows | fold |
| Card: Your Goal Match counts (`:692-710`) | The goals reason row (R-SF-G carries the four counts) | fold |
| Card: **Looking For**, the needed roles and jobs (`:658-676`) | A tag row from `recruitingRoles`, needed and nice-to-have, with your fit marked (mockup-06's "Melee — your fit / Healer open"; R-SF-P) | keep |
| Card: description, schedule text, intensity, recruitment status, languages, contact method/value, member count | Card body. Members shown only when `memberCount > 0`, i.e. the lead opted in (`discovery.py:148`) | keep |
| Card: Show more / Show less over 120 characters (`:575,717-735`) | The same toggle, as a `LinkText` (R-SF-P) | keep |
| Card: "No details yet" with no description or contact (`:756-760`) | The same line (R-SF-P) | keep |
| Card: Updated {date} (`:772-776`) | The same footer text (R-SF-P) | keep |
| Card: Copy listing link (`:577-586,779-790`) | `IconButton` in the footer (R-SF-P) | keep |
| Card: View Static (`:812`) | View static | keep |
| Card: Request to Join / Pending / Accepted / Declined | R-SF-I states | keep, clarified |
| Card: "Log in to join" (guests, `:565,807-810`) | The guest branch's join slot: guests do reach V2 (F1, premises) | **keep** |

### Mockup-06 re-validation (m16)

The Finish write-back lists these, as PH3c listed mockup-05's.

| Mockup-06 element (`mockups/06-static-finder.html`) | Disposition |
|---|---|
| Title and subtitle (`:447-448`) | built; the subtitle says "static" and drops "— ranked by match" (F5) |
| Filters: Content, My role need, Schedule fit (Match my availability, Weeknights, Weekends), Vibe (`:455-477`) | built; "Fits my typical week" for the availability box; Vibe uses V1's intensity values |
| Summary headline (`:485`) | built with the R-SF-P summary copy |
| Summary subline "Ranked by fit · uses your Player Hub availability (Mon/Tue/…)" (`:486`) | built without the day list, which the response doesn't carry (R-SF-P) |
| Sort: Best match (`:488`) | built |
| Match % (`:495`) | deviated: tier tag (SF-4) |
| Initials badge (`:497`) | dropped: decorative, with no data behind it |
| Meta line "content · 2/4 · prog" (`:498`) | deviated: objective tags (no progress data) |
| Tag row "Melee — your fit" / "Healer open" / vibe (`:500-503`, `:546-549`) | built as the Looking For row plus the intensity tag |
| Reason rows: role and schedule (`:505-506`) | built (R-SF-P) |
| Reason row "Prog-friendly — matches your vibe" (`:507`) | deviated, not built: the engine has no vibe input for the viewer; the intensity tag stays |
| Footer "Fri/Sat 8:00 PM EST · 7/8 filled" (`:510`) | built as the listing's own schedule text + members; no "/8" (no capacity field) |
| View / Apply (`:511-512`) | View static built; Apply deviated to "Request to join" (SF-6) |
| "Leading a static instead?" + Post a listing (`:568-571`) | built with R-SF-J's copy |

## Rulings (bind every task)

- **R-SF-A (API, additive).**
  - **Parameters.** `list_discoverable_statics` (`routers/discovery.py:167`) gains:
    - `fit_v2: bool = Query(False, alias="fitV2")`
    - `as_role: Literal["tank","healer","melee","ranged","caster"] | None = Query(None, alias="asRole")`
    - `day_group: Literal["weeknights","weekends"] | None = Query(None, alias="dayGroup")`
    - `viewer_tz: str | None = Query(None, alias="viewerTz")`: the viewer's browser IANA zone (owner, 2026-09-27, OWNER-2). No `max_length` or pattern, so no value can 422.
    - `SortOption` (`:35`) gains `"best"`.
  - **Rules.**
    - `asRole` and `sort=best` take effect only when `fitV2` is on and the caller is signed in. Otherwise `asRole` is ignored and `best` sorts as `recent`.
    - `viewerTz` is used only with `fitV2` and a signed-in caller, and only when `load_zone` accepts it. An invalid or missing value is ignored, as if not sent (R-SF-C).
    - `goalCategory` splits on `,`, strips each value and drops empties. A listing passes when **any** value is in its categories. The comparison stays case-sensitive exact, as today (`:327-332`), so a single value behaves exactly as before.
  - **`id` (owner, 2026-09-27, OWNER-3).** Emitted only when `fitV2` is on and the caller is signed in. **This flips a privacy guard on a public endpoint** (`tests/test_discovery.py:270,281`, "must not leak internal IDs"): signed-in V2 viewers now receive internal static ids; guests and V1 do not. For guests and for requests without `fitV2` the key is **absent**, not `null`, so `test_discovery.py:281` keeps passing unedited.
  - **Schemas** (`schemas/discovery.py`):
    - `DiscoveryListItem` gains `fit_v2: FitV2 | None = None`.
    - A subclass `FinderListItem(DiscoveryListItem)` adds `id: str`; the router builds it only when `id` is emitted. `DiscoveryListResponse.items` becomes `list[SerializeAsAny[DiscoveryListItem]]` (pydantic 2.13), so a `FinderListItem` keeps its `id` and a plain item has no `id` key.
    - `DiscoveryListResponse` gains `fit_counts: FitCounts | None = None` and `viewer: FitViewer | None = None`.
    - The new models:
      ```python
      class FitNight(CamelModel):
          day: str                      # listing's iCal code
          local_day: str | None         # viewer's iCal code of the raid start; None when the window isn't placed (R-SF-C)
          local_start: str | None       # "HH:MM" in the viewer's display zone
          local_end: str | None
          coverage: Literal["full", "part", "none"] | None  # None: no typical week to test (R-SF-C)

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
  - **V1 parity.** Without the new parameters, every existing field keeps its value, `fitV2`, `fitCounts` and `viewer` are `null`, and there is no `id` key.
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
  def viewer_display_zone(rows: list[tuple[str, str]], viewer_tz: str | None) -> str | None: ...  # (timezone, updated_at) per template row; see R-SF-C
  def compute_schedule_fit(template_days: list[TemplateDay], listing: dict, *, now: datetime, display_zone: str | None) -> dict: ...
  def compute_fit_v2(*, role_fit: dict, schedule_fit: dict, goal_counts: dict, comms_fit: dict, bis_fit: dict, missing: list[str]) -> dict: ...
  def best_match_key(tier: str, reasons: list[dict]) -> tuple[int, int]: ...  # (TIER_RANK[tier], -#match reasons)
  def in_day_group(day_group: str, codes: list[str]) -> bool: ...
  ```
- **R-SF-C (schedule, per night).**
  - **Days.** `codes = listing_day_codes(listing.get("scheduleDays"))`. With no codes, the result is `{status: "unknown", basis: "day", nights: []}`.
  - **Placing the window.** `start = parse_slot(listing.get("scheduleStartTime"))`, `end = parse_slot(listing.get("scheduleEndTime"))`, `tz = listing.get("timezone")` and `zone = load_zone(tz) if isinstance(tz, str) and tz else None` (m5). Read the listing with `.get()`: a missing key raises `KeyError`, and `ZoneInfo(None)` raises `TypeError`, which `load_zone` doesn't catch (`availability_layering.py:74-77`). The window is **placed** when all three are set. For each code, in listing order:
    1. `occ` = the first date ≥ `now.astimezone(zone).date()` whose `weekday_code` equals the code.
    2. `s = datetime.combine(occ, start, tzinfo=zone)` and `e = datetime.combine(occ, end, tzinfo=zone)`. If `e <= s`, add one day to `e`.
    3. `local_day`, `local_start` and `local_end` come from `s` and `e` converted to the display zone (`"UTC"` when `display_zone` is `None`).
  - **No typical week** (no template day with a valid slot): `status: "unknown"`, `basis: "day"`. When the window is placed **and** `display_zone` is not `None` (a row with only empty slots still gives its zone; else `viewerTz`), there is one night per code carrying the `local_*` fields with `coverage: None` (owner, 2026-09-27, OWNER-2). Otherwise `nights: []`.
  - **Viewer free set.** Build it with `expand_personal_templates(days=template_days, start=min_occurrence - 1 day, end=max_occurrence + 2 days)` for the one synthetic user. That gives UTC `(date, "HH:MM")` pairs. Floor every minute to `00` or `30` on both sides, so :15 and :45 zone offsets still compare.
  - **Time basis** (a typical week and a placed window). For each placed night:
    1. Step in **UTC**: `t = s.astimezone(UTC) + k·30min` while `t < e.astimezone(UTC)`. Each `t` is free when `(t.date().isoformat(), floor(t).strftime("%H:%M"))` is in the free set.
    2. The night's coverage is `full` (all free), `part` (some) or `none`.
  - **Day basis** (a typical week, but the window isn't placed). A night per code: `full` if the template has a day with that code and at least one valid slot, otherwise `none`. The `local_*` fields are `None`.
  - **Status** (SF-2): `match` if every night is `full`. `partial` if any night is `full` or `part`. `conflict` otherwise.
  - **Display zone** (owner, 2026-09-27, OWNER-2). `viewer_display_zone` returns, in order:
    1. the timezone of the template row with the newest `updated_at` whose zone loads (ties go to the first row in input order);
    2. else `viewer_tz`, when `load_zone` accepts it;
    3. else `None`, which the time basis reads as `"UTC"`.
    - The display zone drives every `local_*` field and, through `local_day`, `dayGroup` (R-SF-F).
  - **Determinism.** `now` is injected; the router passes `datetime.now(UTC)` (`from datetime import UTC, datetime`). Inside `list_discoverable_statics` the `timezone` query parameter (`discovery.py:175`) shadows `datetime.timezone`, so `datetime.now(timezone.utc)` would raise (m4).
- **R-SF-D (role).**
  - **`recruit_entries`.**
    - Use `recruitingRoles` when it is a non-empty list. Drop an entry whose `role` isn't one of `ROLE_KEYS`. A `priority` other than `"nice_to_have"` counts as `"needed"`. Jobs are upper-cased.
    - Otherwise map the legacy fields the way `initRecruitingRoles` does (`DiscoveryTab.tsx:157-182`): one needed entry per `neededRoles` value, holding the `neededJobs` whose `role_for_job` equals that role. A job whose role isn't listed joins the entry for its role, or starts a new needed entry.
  - **Hit.** `hit(job, role, entry) = (entry.jobs and job in entry.jobs) or (not entry.jobs and role == entry.role)`.
  - **Without `as_role`:**
    - `unknown` when there are no entries, or no jobs.
    - `match` (`is_main=True`) when the main hits a needed entry.
    - Otherwise `partial` (`priority "needed"`) for the first **alt**, in priority order, that hits a needed entry.
    - Else `partial` (`priority "nice_to_have"`) for the first job, main included, in priority order, that hits a nice-to-have entry (m7).
    - Otherwise `none`.
  - **With `as_role`:** `match` when a needed entry has `role == as_role`, `partial` when a nice-to-have entry does, `none` otherwise, and `unknown` with no entries. `matched_role = as_role` and `matched_job = None`.
  - The main job is the first `ViewerJob` after the `priority_order` sort (`discovery.py:266-267`).
- **R-SF-E (viewer inputs).**
  - With `fitV2` and a signed-in caller, the endpoint loads the profile **without** the visibility filter. Its jobs, public goals and public BiS are loaded as today. Templates are loaded by `user_id` even with no profile.
  - V1's `fit_summary` is computed only when `profile.visibility == "discoverable"`, as today.
  - **Statement budget.**
    - For a discoverable viewer, `fitV2` on adds **0** statements over `fitV2` off.
    - The count is independent of the number of listings (1 vs 5).
    - With `fitV2` off, every golden capture's count equals the base commit's (Task 1 step 1): discoverable, private, guest, and the filtered request. So with `fitV2` off a private viewer's jobs, goals, BiS and templates are **not** loaded.
  - **`missing`:** `"jobs"` when there are no job rows, and `"template"` when no template row has a valid slot.
- **R-SF-F (filters with fitV2).**
  - `scheduleOverlap` keeps listings whose V2 schedule status is `match` or `partial`. Without `fitV2` it keeps today's code path.
  - `hideGoalConflicts` (F4): without `fitV2`, unchanged, so it applies only to a discoverable viewer (`discovery.py:352,367`). With `fitV2` it drops listings whose V2 goal counts have `conflicts > 0`, whatever the visibility. The default visibility is `"private"` (`models/player_profile.py:39-41`), so without this the V2 checkbox would do nothing for most viewers.
  - `dayGroup` (SF-7):
    - When the nights carry `local_day` (a placed window with a display zone from a template row or `viewerTz`, R-SF-C), test `in_day_group` on those.
    - Otherwise test it on `listing_day_codes(scheduleDays)`.
    - A listing with no days is dropped whenever `dayGroup` is set.
  - `fitCounts` counts tiers across the **filtered** list, before pagination.
- **R-SF-G (tier, reasons, sort).**
  - **Tier** (owner, 2026-09-27, OWNER-1).
    - `base = _compute_overall(goal_counts, {"status": role_status}, {"status": schedule_status}, comms_fit, bis_fit)` (`fit_score.py:260`), unchanged. It is imported, not copied.
    - **The V2-only cap:** when `schedule_status == "partial"` and `base` is `strong` or `good`, the tier is `partial`. Otherwise the tier is `base`. A schedule `conflict` still gives `weak` through `_compute_overall`.
    - Why: `_compute_overall` alone makes role `match` Strong (`:298-299`) and schedule `partial` Good (`:301-310`), whatever the nights.
    - V1's `fit`/`fitSummary` is unchanged; the golden test guards it.
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
  - `useJoinRequestStore` (`stores/joinRequestStore.ts`): call `fetchMyRequests()` on mount **when signed in** (never for a guest, F1).
  - Guests: the join slot is V1's `Button variant="ghost" size="sm"` `Log in to join`, calling `useAuthStore`'s `login()` (`Discover.tsx:565,807-810`).
  - For each card, take the newest request with `staticGroupId === item.id` (`id` is present for every signed-in `fitV2` response, R-SF-A):
    - `pending` or `under_review`: the text "Request pending" plus a `Button variant="ghost" size="sm"` labelled `Cancel request`. It calls `cancelRequest(id)`; on failure, `toast.error('Couldn\'t cancel the request')`.
    - `accepted`: `Tag variant="label" tone="success"` "Accepted".
    - `declined`: `Tag variant="label" tone="error"` "Declined".
    - Anything else: `Button variant="primary" size="sm"` "Request to join", which opens `JoinRequestModal` with `shareCode`, `staticName`, `neededJobs`, `neededRoles` and `recruitmentStatus`. There is one modal per page, not per card.
- **R-SF-J (Leading a static?).**
  - The row renders only when signed in. For a guest it is hidden and `fetchGroups()` is never called (F1).
  - `led = groups.filter(g => g.userRole === 'owner' || g.userRole === 'lead')` from `useStaticGroupStore`, calling `fetchGroups()` on mount if `groups` is empty.
  - **Copy:** the heading `Leading a static?` and the body `Post a recruitment listing so matching players can find you.`
  - **One static:** `Button` "Post a listing" → the handler in the premises (navigate, then `open({ tab: 'recruitment', section: 'listing' })`).
  - **Several:** a `Select` with placeholder "Choose a static" listing the led statics' names. Choosing one runs the same handler.
  - **None:** `Button` "Create a static" opens `SetupWizard` (`components/wizard`), with `onComplete={(_id, shareCode) => navigate(`/group/${shareCode}`)}` as in `PlayerHub.tsx:221-228`.
- **R-SF-K (the autofill fix; Owner sign-off 2026-09-27).** In `routers/static_groups.py:1289-1294` (m2):
  - A naive `start_dt` or `end_dt` (no offset) is read as UTC first: `replace(tzinfo=timezone.utc)`, the `services/discord_guild_events.py:266-267` pattern. `astimezone` would otherwise read it as the server's local time.
  - Convert both into the **suggested** zone, `load_zone(suggestions["timezone"]) or timezone.utc`, before `strftime("%A")` and `strftime("%H:%M")`. That is the majority zone that labels the suggestion (`:1277`), not each session's own zone, so the days and times always agree with the zone printed beside them.
  - The rest of the endpoint is untouched. Existing tests that encode the UTC reading get their expected values corrected, each with a one-line comment citing R-SF-K.
  - **Residual, carried:** `DiscoveryTab.tsx:819` fills `timezone` only when the form's is empty, so a form already set to another zone still labels the converted times with its own zone. The form is V1 and read-only here; the PR body and the Outcome carry it.
- **R-SF-L (boundaries).** Add `finder` to the ring1 element pattern in `eslint.config.js:50-61`. Components use relative imports (`:278-290`).
- **R-SF-M (the option lists).** Create `components/finder/discoveryOptions.ts` exporting the V1 option lists V2 needs:
  - job options
  - intensity
  - goal category (with labels)
  - the data-center, server, timezone and language option builders

  They are moved from `Discover.tsx:106-224` with the same values, labels and order. `Discover.tsx` imports them, and `git diff` on the file shows only the moves, the import and the seam.
  - The file opens with the header comment `// Imported by legacy pages/Discover.tsx: edits here change V1.` (m9).
  - **Recruitment status is not moved.** V1's `RECRUITMENT_OPTIONS` (`Discover.tsx:122-127`: `open`, `limited`, `closed`) lacks the `selective` and `paused` the form writes (`DiscoveryTab.tsx:45,56-88`). It stays in `Discover.tsx`, and `discoveryOptions.ts` gains V2's own `FINDER_RECRUITMENT_OPTIONS`: `Any status`, then the form's four values and labels in the form's order (`Open`, `Selective`, `Paused`, `Closed`). The parity table records V1's gap.
- **R-SF-N (the V2 page).** New files under `frontend/src/components/finder/`: `types.ts`, `discoveryOptions.ts`, `useFinderQuery.ts`, `StaticFinder.tsx`, `FinderFilters.tsx`, `FinderSummary.tsx`, `FinderCard.tsx`, `reasonCopy.ts`, `JoinAction.tsx`, `LeadingStaticRow.tsx`, `FinderNudge.tsx`, and tests beside them.
  - **Layout:** left-aligned; the container matches `PlayerHub`'s outer classes; nothing sticky.
  - **Header:** `PageHeader` with title `Static Finder` and subtitle `Find a static that fits your content, schedule and role.` (F5: "static", never "group", in user-facing copy; spec §5 written back). Under it, V1's opt-in line verbatim in `text-xs text-text-muted`: `All listings are opt-in. Only public details chosen by the static lead are shown.` (`Discover.tsx:368`).
  - **Two columns at `lg`:** the filters, then the results. The filter column's header carries `Clear all` (`Button variant="ghost" size="sm"`, calling `clearFilters`) when `hasFilters`, as V1 does beside its results (`Discover.tsx:408-413`).
  - **Guest branch (`!user`, F1).** Guests reach this page (premises row, §5 "Out of reach"):
    - no `fetchMyRequests` and no `fetchGroups`;
    - no tier tag, reason rows, local-times line or nudge (`fitV2` and `viewer` are `null`);
    - the summary reads `{total} statics` (`1 static`);
    - hidden: the role chips and their caption, the `Fits my typical week` and `Hide goal conflicts` checkboxes (V1 shows its fit checkboxes only when signed in, `Discover.tsx:450`), and the Leading row;
    - the sort `Select` has no Best match and defaults to Recent;
    - the join slot is `Log in to join` (R-SF-I).
  - Mobile is out of scope.
- **R-SF-O (the query hook).**
  - `useFinderQuery()` owns the URL ↔ state ↔ request loop:
    - It reads and writes the URL keys `q`, `sort`, `asRole`, `dayGroup`, `goalCategory` (comma-separated), `scheduleOverlap`, `hideGoalConflicts`, `job`, `intensity`, `recruitmentStatus`, `dataCenter`, `server`, `timezone` and `language`.
    - The default sort is `best` when signed in and `recent` for a guest. It omits `sort` from the URL when it equals that default, and uses `setSearchParams(…, { replace: true })`.
    - `q` is debounced 350 ms (`useDebounce`).
    - Choosing a data center resets `server`, as V1 does.
  - **V1 links keep working** (spec §5; m8):
    - On read, `role` maps to `asRole` and `hideConflicts=true` to `hideGoalConflicts=true`, and the URL is rewritten to the new keys.
    - An `asRole`, `dayGroup` or `sort` value outside its `Literal` (R-SF-A) is dropped before the request. Otherwise the API answers 422 and the page shows its error state.
    - More filters opens expanded when any of its keys (`job`, `recruitmentStatus`, `dataCenter`, `server`, `timezone`, `language`) is in the URL, as V1 does (`Discover.tsx:224,247-249`).
  - Every request sends `fitV2=true`, `viewerTz` and `sort` through `authRequest<FinderResponse>('/api/discovery/statics?…')`. `viewerTz` is `getBrowserTimezone()` (`utils/timezone.ts:73-75`, i.e. `Intl.DateTimeFormat().resolvedOptions().timeZone`; owner, 2026-09-27, OWNER-2). It is never written to the URL.
  - **No typical week** (m10): while the latest response's `viewer.missing` includes `template`, the request omits `scheduleOverlap`, though the URL keeps it. Otherwise it would hide every listing. The checkbox is disabled (R-SF-P).
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
    - `start` and `end` use `formatTimeLabel` from `components/schedule/availabilityUtils.ts:121` (m1).
    - `state` is `free` (full), `partly free` (part) or `busy` (none).
  - **Local times without a typical week** (OWNER-2): when `schedule.status` is `unknown` and the nights carry `localStart`, the card shows one muted line `Your time: {Ddd} {start}–{end}`, with nights joined by ` · `, formatted as above. It has no state and no icon, since coverage is unknown.
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
  - **Summary:** `{n} of {total} statics are a good fit for you`, plus ` as a {role}` when a role is known, where `n = strong + good`. A listing capped by R-SF-G counts as `partial`, so it leaves `n`. When `n == 0`: `No strong matches yet — try another role or loosen your filters.` Guests: `{total} statics` (`1 static`).
  - **Summary subline** (m16): with Best match and no `template` in `viewer.missing`, `Ranked by fit · uses your Player Hub typical week`.
  - **Nudge:**
    - template: `Add your typical week on the Hub to match raid times.` + `LinkText` `Set your typical week` → `/profile?tab=availability`.
    - jobs: `Add your jobs on the Hub to match open roles.` + `LinkText` `Add jobs` → `/profile?tab=characters`.
    - Both lines render when both are missing.
    - Every in-app `LinkText` here, and `View static`, uses `onClick={() => navigate(…)}` (the `HubSideCards.tsx:124` pattern). `LinkText href` renders a plain `<a>` (`components/ui/LinkText.tsx:43-44`), so it would reload the page, where V1 used `<Link>` (m3).
  - **Fits my typical week, no template** (m10): the `Checkbox` is disabled, with the caption `Set your typical week on the Hub to use this.`
  - **Card, V1 affordances** (F2):
    - **Looking for:** one `Tag variant="label"` per recruiting entry, from `recruitingRoles` (needed first). A needed entry reads `{Chip} open` and a nice-to-have one `{Chip} (nice to have)`. The entry whose role is `fitV2.role.matchedRole`, when the role status is `match` or `partial`, reads `{Chip} — your fit`. The entry's jobs follow as tags. A listing with no `recruitingRoles` shows V1's `neededRoles` and `neededJobs` tags.
    - **Copy link:** an `IconButton` in the footer, `aria-label` `Copy listing link` (`Link copied` for 2 s), writing `${window.location.origin}/group/${shareCode}` (`Discover.tsx:577-586`).
    - **Updated:** `Updated {new Date(lastUpdated).toLocaleDateString()}` in the footer.
    - **Show more:** a description over 120 characters clamps to three lines, with a `LinkText` toggle `Show more` / `Show less`.
    - **No details:** with no description and no contact, `No details yet. Open the listing to learn more.`
  - **Role chip caption:** with no `asRole` and a known main, `Matching as your {mainJob}`. With `asRole`, `LinkText` `Match as your {mainJob} again`, which clears it.
  - **Empty:** `EmptyState` with heading `No statics match` and description `Try another role or loosen your filters.`, plus a `Clear filters` action when `hasFilters`. With no filters: heading `No statics are recruiting yet` and description `Static leads can post a listing from Settings → Recruitment.` (V1's `Discover.tsx:535` says "group").
  - **Error:** `Couldn't load statics.` + `Button` `Retry`.
  - **Loading:** three `CardSkeleton`s.
- **R-SF-Q (budgets and gates).**
  - jscpd **≤ 343** clones; ESLint **0 errors, ≤ 809 warnings** (both measured 2026-09-27 on `main`'s tree @ `e7de1f4c`).
  - `deadcode` unchanged; `build` (`tsc -b`) clean; `check:design-system:strict` clean.
  - Backend `pytest tests/ -q` green. `test_discovery.py` and `test_fit_score.py` stay green. `test_discovery.py` is edited only for R-SF-K; its `id` guard (`:281`) stays unedited (OWNER-3). `test_fit_score.py` is unedited.
  - Release notes: one entry per PR that touches `frontend/src` or `backend/app`, `internal: true`, matching PH3's V2-preview entries (`releaseNotes.ts` 2.1.45/2.1.46). `CURRENT_VERSION` is not bumped. Single quotes are escaped as `\'`, and the file is edited with Edit/Write only.
- **R-SF-R (files and scope).**
  - **Task 1:** `routers/discovery.py`, `schemas/discovery.py`, new `services/finder_fit.py`, `services/availability_layering.py` (the two renames only), `routers/static_groups.py` (R-SF-K lines only), `tests/factories.py` (`create_player_profile` gains `visibility: str = "private"`, today hardcoded at `:410`; `create_player_job_profile` gains `role: str | None = None` and `priority: str = "flex"`, where `role=None` means today's `"melee"`, hardcoded at `:457`), new `tests/test_finder_fit.py`, new `tests/test_discovery_fit_v2.py`, new `tests/golden/discovery_v1.json` (F3), and `tests/test_discovery.py` (R-SF-K only).
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
  - A listing zone `"America"`, a missing `timezone` key or a non-string zone → day basis, no 500.
  - Only empty template rows → `unknown` with `missing: ["template"]`.
  - No template with a valid `viewerTz` → local times with `coverage: None`; an invalid `viewerTz` → ignored, no 422.
- **R-SF-D:** a role-only entry (`jobs: []`); a nice-to-have entry; a legacy listing with only `neededJobs`; an unknown role string; `asRole` for a role the listing only lists specific jobs under.
- **R-SF-G:** the schedule-`partial` cap (strong → partial, good → partial, weak stays weak) and its effect on `fitCounts`.
- **R-SF-A/E:** does any existing field change value for a V1 request (golden test)? Is `id` absent for guests and without `fitV2`? Does a private-profile viewer get a V2 fit but no V1 fit? Is the statement delta 0, and does every golden capture keep its count?
- **R-SF-H/M:** does V1's rendered markup change (the unedited `Discover.test.tsx` plus the option-list byte check)? Does V1 fetch under V2 chrome?
- **R-SF-I/J/N:** two statics with the same name and different requests; `under_review`; a failing cancel; zero, one and two led statics; the settings panel landing on Recruitment → Listing after navigation (browser); the guest branch.

## Task 1 — Engine and API, backend (RISKIEST · `xivrp-implementer-deep`, `model: fable`)

Files: per R-SF-R, Task 1.

Dispatch with `model: fable` on the call. SF1a gets the slice's one task-scoped `redesign-reviewer` review before it is marked ready (slice-loop `SKILL.md:33,53`; m12).

1. **The golden V1 capture, first, on the base commit.** Write `tests/test_discovery_fit_v2.py::test_v1_response_unchanged` (F3):
   - **Fixture, deterministic:**
     - Three public listings with varied discovery settings (copy the call shape of `_discovery_settings`, `test_discovery.py:10-44`), plus one listing with only `recruitingRoles` and no `neededRoles`/`neededJobs` (V1's `fit.jobs` must stay `unknown`) and one with iCal day codes (`["FR", "SA"]`).
     - Each listing passes a fixed `share_code=` and gets a fixed ISO `updated_at` string after the factory call. Otherwise `factories.py:69,73` makes one random and the other `now`, and the golden JSON changes on every run.
     - `StaticObjectiveGoal` rows on the listings (the `_create_static_objective` shape, `test_fit_score.py:142-159`), so `objectiveCategories`, `goalAlignment` and the goal counts are exercised. `objectiveCategories` is built from a set (`discovery.py:328`), so its order changes with string-hash randomisation between processes; the comparison sorts that list on both sides.
     - A discoverable viewer with two job profiles (`main` DRG, `flex` WHM), two template days, a public goal and a public BiS set.
   - **Captures**, each with its `count_statements` total (`tests/conftest.py:282-306`):
     - (a) the discoverable viewer, `?sort=name`;
     - (b) a second viewer whose profile is `private` (`fitSummary` and `goalAlignment` null);
     - (c) a guest;
     - (d) the discoverable viewer with `?scheduleOverlap=true&hideGoalConflicts=true&hideConflicts=true&goalCategory=savage_bis`.
   - Commit them as `tests/golden/discovery_v1.json` (one entry per capture: response + statement count) **before any production edit**.
   - The test then asserts, per capture, that the response equals the golden one after removing the keys `fitV2`, `fitCounts` and `viewer` (so an `id` key would fail it, OWNER-3), and that the statement count is equal. Paste the base-commit run.
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
   - **Viewer east, next local day:** the listing is Fri 20:00–23:00 New York, and the viewer in `Asia/Tokyo` has `SA 09:00…11:30` → `match`, `local_day "SA"`. The window falls wholly on Saturday in Tokyo.
   - **Two-day span** (m6): the listing is Fri 18:00–21:00 New York, and the viewer's London template is `FR 23:00, 23:30` + `SA 00:00…01:30` → `match`, `local_day "FR"`, `local_start "23:00"`, `local_end "02:00"`.
   - **DST:** `now = 2026-03-04`. The listing is Fri 20:00 New York, whose next occurrence 2026-03-06 is before the 03-08 switch, and the London viewer's template is `SA 01:00…03:30` → `match`. With `now = 2026-03-10` (New York on EDT, London still GMT until 03-29), the same template → `partial`, because the raid is now 00:00–03:00 London.
   - **Nepal** (m6): template `SA 05:30…08:30` in `Asia/Kathmandu` against Fri 20:00–23:00 New York → `match`, `local_start "05:45"`, `local_end "08:45"`, no exception. Without the minute floor it is `conflict`.
   - **Two zones:** a `FR` row in New York and a `SA` row in London → each converts in its own zone. The display zone is the newer row's.
   - **Day basis:** a listing with no `scheduleStartTime` → `basis "day"`, `local_*` `None`. A listing zone of `"America"`, a listing with no `timezone` key, and one whose `timezone` is `None` or `5` → day basis, no exception (m5).
   - Only empty template rows → `unknown`.
   - **Display zone** (OWNER-2): `viewer_display_zone` → the newest loadable template zone beats a valid `viewer_tz`; an unloadable template zone falls through to `viewer_tz`; with no rows, `"Australia/Sydney"` → `"Australia/Sydney"`, and `"Not/AZone"` or `None` → `None`.
   - **No template, local times** (OWNER-2): `display_zone="Australia/Sydney"` and a listing Fri 19:00–22:00 New York → `status "unknown"`, `basis "day"`, one night with `local_day "SA"`, `local_start "09:00"`, `local_end "12:00"`, `coverage None`. With `display_zone=None` → `nights []`.
   - `in_day_group("weekends", ["FR"]) is False`; `in_day_group("weeknights", ["FR"]) is True`.
   - `compute_fit_v2`:
     - Tier parity with `_compute_overall` on six hand-built inputs whose schedule isn't `partial`.
     - The cap (OWNER-1), with schedule `partial`: inputs that give `strong` → `partial`; inputs that give `good` → `partial`; a role `none` → still `weak`.
     - Reason order and omission, per R-SF-G.
     - `best_match_key` ordering.
4. **Endpoint (R-SF-A, E, F, G).** Tests in `tests/test_discovery_fit_v2.py` use the route-level `client`/auth-header pattern (`test_fit_score.py:376+`):
   - `fitV2` off → the golden test passes; the new fields are `null`; no item has an `id` key, signed in or not.
   - **`id`** (OWNER-3): with `fitV2`, a signed-in viewer's items carry `id` equal to the static's id, and a guest's items have no `id` key.
   - `fitV2` on, discoverable viewer → `fitV2` on every item, plus `viewer.mainJob == "DRG"`, `viewer.mainRole == "melee"` and `fitCounts` summing to `total`.
   - A **private** profile with `fitV2` on → `fitV2` present, and `fitSummary` still `null`.
   - A guest with `fitV2` → every `fitV2` `null`, `viewer` `null`, `sort=best` behaving as `recent`.
   - `asRole=tank` changes only `fitV2.role` and `fitCounts`.
   - `sort=best` over three listings (strong, weak, good) → strong, good, weak. Ties break on recency.
   - **The cap** (OWNER-1): the viewer (main DRG, flex WHM) has a New York template covering Fri 20:00–23:00 only.
     - Listing A needs a melee (`recruitingRoles` melee needed, `jobs: []`) and raids Fri/Sat 20:00–23:00 New York. Role `match` alone would make it strong; one of two nights is free → `tier "partial"`.
     - Listing B would like a healer (healer `nice_to_have`) and raids Fri/Sat 20:00–23:00 New York. Role `partial` would make it good → `tier "partial"`.
     - Control C is A with Friday only: every night free → `tier "strong"`.
     - `fitCounts` over the three → `strong: 1, partial: 2`, so the summary's `n` (strong + good) is 1.
   - `fitCounts` before pagination: 5 listings with `limit=2` → the counts sum to 5.
   - `scheduleOverlap=true` + `fitV2` → only `match`/`partial` listings.
   - `hideGoalConflicts` (F4): a **private** viewer with a public goal that conflicts with a listing's objective. `fitV2=true&hideGoalConflicts=true` drops it; the same request without `fitV2` keeps it (today's discoverable gate).
   - `dayGroup=weekends` (spec §7.5; m6) → the Fri-evening New York listing:
     - is kept for a Sydney viewer, seeded with an `Australia/Sydney` template row holding a valid slot (without one, the listing would drop on the day-basis fallback, for the wrong reason);
     - is dropped for a New York viewer with a New York template row.
     - A listing with no days is dropped.
   - **`viewerTz`** (OWNER-2):
     - A Sydney viewer with **no** template and `viewerTz=Australia/Sydney`: a Fri 19:00–22:00 New York listing is kept by `dayGroup=weekends`, and its night reads `localDay "SA"` with `coverage` `null`. The schedule status stays `unknown`.
     - The same viewer with `viewerTz=Not/AZone` → 200 (no 422), `nights` `[]`, and `dayGroup=weekends` drops the listing (its own `FR`).
   - `goalCategory=savage_bis,ultimate_clear` → the union. The single value `savage_bis` → the same result as today.
   - Statements (R-SF-E): off vs on for a discoverable viewer → delta 0. One listing vs five → the same count.
5. **Autofill (R-SF-K).** Tests, each a recurring session in `America/New_York` unless stated:
   - EST: `start_time "2026-02-27T00:00:00.000Z"`, `end_time "2026-02-27T03:00:00.000Z"` → suggestions `scheduleDays == ["Thursday"]`, `scheduleStartTime == "19:00"`, `scheduleEndTime == "22:00"`.
   - EDT: `"2026-07-03T23:00:00.000Z"`–`"2026-07-04T02:00:00.000Z"` → `["Friday"]`, `"19:00"`, `"22:00"`.
   - Naive: `"2026-02-27T00:00:00"`–`"2026-02-27T03:00:00"` (no offset) → the same as EST.
   - Majority zone: two New York sessions and one `Europe/London` session, all at the EST times → `timezone == "America/New_York"`, `["Thursday"]`, `"19:00"`. Converting each session into its own zone would add London's `Friday` and `"00:00"`.
   - Correct any existing assertion that encodes the UTC reading, with a comment.
6. **Gates.** `pytest tests/ -q` (paste the line), and `ruff check` on the touched files, with no new findings.

Size: ~1,000–1,300 lines including tests and the golden file.

**Ad hoc mutation checks (execute and paste):**
- (a) Skip the `astimezone` into UTC when stepping → the cross-zone test fails.
- (b) Drop the `e <= s` day roll → the midnight test fails.
- (c) Use the listing's calendar day for `local_day` → the Sydney `dayGroup` test fails.
- (d) Reinstate the visibility filter on the `fitV2` path → the private-profile test fails.
- (e) Count `fitCounts` after slicing → the pagination test fails.
- (f) Remove the minute floor → the Nepal test fails (`conflict`).
- (g) Revert R-SF-K → the autofill tests fail.
- (h) Drop the schedule-`partial` cap → the cap tests fail (listing A `strong`, B `good`).

## Task 2 — V2 data layer and page frame (`xivrp-implementer`, sonnet)

Files: per R-SF-R, Task 2.

1. **Boundaries and options (R-SF-L, R-SF-M).** Move the option lists. `pnpm -C frontend test src/pages/Discover.test.tsx` unedited; paste. Paste `git diff --stat -- frontend/src/pages/Discover.tsx`.
2. **Types (`finder/types.ts`).** `FinderItem` (the V1 item fields plus `id?` (absent for guests, R-SF-A), `recruitingRoles`, `communicationStyle`, `objectiveCategories`, `fitV2`), `FitV2`, `FitNight` (`coverage` nullable), `FitReason`, `FitCounts`, `FitViewer` and `FinderResponse`, mirroring R-SF-A in camelCase.
3. **Hook (R-SF-O)**, `useFinderQuery.test.tsx` (mock `../../services/api` the way `Discover.test.tsx:33-38` does, and mock `getBrowserTimezone` to return `Australia/Sydney` so the value differs from the UTC test pin):
   - (a) First load, signed in → a request with `fitV2=true&sort=best&viewerTz=Australia%2FSydney`, and neither `sort` nor `viewerTz` in the URL.
   - (b) URL `?asRole=tank&dayGroup=weekends&goalCategory=savage_bis,ultimate_clear&scheduleOverlap=true` → the request carries each value.
   - (c) Setting a data center clears `server`.
   - (d) Two requests resolving out of order → the state holds the later one.
   - (e) `clearFilters` empties the URL except `sort`.
   - (f) An error → `error` set; `retry` refetches.
   - (g) V1 link `?role=tank&hideConflicts=true` → the request carries `asRole=tank&hideGoalConflicts=true`, and the URL is rewritten to those keys (m8).
   - (h) `?asRole=dps&dayGroup=never&sort=oldest` → the request carries neither `asRole` nor `dayGroup`, its `sort` is the default `best`, and `error` stays `null` (m8).
   - (i) A response whose `viewer.missing` includes `template` → the next request omits `scheduleOverlap`, and the URL keeps it (m10).
   - (j) A guest → `sort=recent` by default, with no `sort` in the URL (F1).
4. **The seam (R-SF-H).** `pages/Discover.v2seam.test.tsx` uses the `Profile.v2seam.test.tsx:90-137` pattern:
   - Without the provider, V1's heading renders and `static-finder` is absent.
   - With it, `data-testid="static-finder"` renders, and V1's request URL (no `fitV2`) is never called.
5. **The page frame (R-SF-N, P):** `StaticFinder`, `FinderFilters`, `FinderSummary`, and a minimal `FinderCard` (name, DC/server, tier `Tag`). Tests:
   - Role chips: the main's chip is `pressed` with the caption. Clicking `Tank` sets `asRole=tank`, and the caption becomes the reset `LinkText`. Clicking it clears `asRole`.
   - Content checkboxes build the CSV.
   - `Fits my typical week` and `Hide goal conflicts` checkboxes; Weeknights and Weekends are exclusive toggles; the Vibe chips are exclusive.
   - More filters starts collapsed (`aria-expanded="false"`); expanding it shows the job, recruitment status (V2's five options, R-SF-M), data center, server, timezone and language `Select`s. `?server=Tonberry` → it starts expanded (m8).
   - The header: the subtitle `Find a static that fits your content, schedule and role.` and the opt-in line (F2, F5).
   - `Clear all` appears in the filter-column header only when `hasFilters`, and calls `clearFilters` (F2).
   - With `viewer.missing` including `template`, `Fits my typical week` is disabled with its caption (m10).
   - The summary string for `fitCounts {strong: 2, good: 1, …}` with total 7 → `3 of 7 statics are a good fit for you as a melee DPS`. `n == 0` → the no-match string. The subline shows with Best match and a template, and not without a template.
   - The sort `Select` has four options, defaulting to Best match.
   - States: three skeletons while loading; the empty state with Clear filters; with no filters, the `No statics are recruiting yet` state; the error with Retry.
   - **Guest branch** (F1; `authStore` user `null`): with total 5 the summary reads `5 statics`, and with total 1 `1 static`; no role chips, fit checkboxes or tier tags; the sort `Select` has three options, defaulting to Recent.
6. **Design system.** No raw elements; `text-xs` is the floor; `check:design-system:strict` clean.
7. **Gates (R-SF-Q):** `build`, `lint`, `check:design-system:strict`, `test`, `dupes` (≤ 343), `deadcode`. Paste each line.

Size: ~650–850 lines including tests.

**Ad hoc mutation checks:**
- (a) Return `<LegacyDiscover />` unconditionally → the seam test fails.
- (b) Remove the request sequence → hook test (d) fails.
- (c) Default `sort` to `recent` → hook test (a) fails.

## Task 3 — Card body and entry points (`xivrp-implementer`, sonnet)

Files: per R-SF-R, Task 3.

1. **`reasonCopy.ts`**, pure, with `reasonCopy.test.ts`:
   - Every row of R-SF-P: role (five cases × with/without `asRole`), schedule time basis (two nights: `Fri {formatTimeLabel('20:00')}–{formatTimeLabel('23:00')} free · Sat … partly free`, with `formatTimeLabel` from `components/schedule/availabilityUtils.ts:121`), day basis (three statuses), goals (`1 goal in common`, `2 goals in common`), comms, BiS, and the `Your time:` line for unknown-coverage nights.
   - The role labels.
   - An unknown `kind` → `null`, not a throw.
   - The file runs under `vi.hoisted(() => vi.stubEnv('TZ', 'America/Los_Angeles'))` with `afterAll(() => vi.unstubAllEnvs())`, the `WeekNavigatorStrip.test.tsx:14-18` pattern (m15). The vitest config pins UTC (`vitest.config.ts:9`), which would hide any conversion done in the browser.
2. **`FinderCard` body:**
   - Objective tags (`Tag variant="label"`).
   - Description, the schedule text in the listing's own terms (the V1 string), intensity, recruitment status, languages and contact.
   - Members only when `memberCount > 0`.
   - Reason rows with icons and `aria-label`s, and the `Your time:` line when coverage is unknown (R-SF-P, OWNER-2).
   - The F2 affordances of R-SF-P: the Looking for tags, Copy link, Updated, Show more / Show less, and "No details yet".
   - `View static` → `LinkText onClick={() => navigate(`/group/${shareCode}`)}` (m3).
   - Tests: the reason rows render in API order; members are hidden at 0; the tier tag has its tone; nights with `coverage: null` render the `Your time:` line and no reason row; the Looking for tags (a needed entry, a nice-to-have one, the `— your fit` mark, and the legacy fallback); Copy link writes the `/group/` URL (mocked `navigator.clipboard`) and flips its label; the Updated text; the Show more toggle at 121 characters and none at 120; the "No details yet" line; `View static` calls `navigate` and renders no `<a href>`.
3. **`JoinAction` (R-SF-I)**, tests (mock `joinRequestStore`):
   - `pending` and `under_review` → "Request pending" + `Cancel request`, which calls `cancelRequest(id)`. A rejected cancel → a toast.
   - `accepted` and `declined` tags.
   - No request → `Request to join` opens the modal with the item's `shareCode` and `name`.
   - **Two items with the same `name` and different `id`s,** one with a pending request → only that card shows pending.
   - A guest → `Log in to join`, which calls `login()`; `fetchMyRequests` is never called (F1).
4. **`FinderNudge`:** `viewer.missing` `['template']`, `['jobs']`, both, or none → the exact lines, and each `LinkText` calls `navigate` with its path (m3). `viewer` `null` (a guest) → nothing.
5. **`LeadingStaticRow` (R-SF-J)**, tests (mock `staticGroupStore`, `settingsPanelStore` and `useNavigate`):
   - Zero led → `Create a static` opens `SetupWizard`.
   - One led → `Post a listing` calls `navigate('/group/ABC')` and then `open({ tab: 'recruitment', section: 'listing' })`.
   - Two led → the `Select` lists both, and choosing one runs the same calls.
   - A `member`-only group isn't listed.
   - A guest → the row isn't rendered, and `fetchGroups` is never called (F1).
6. **Browser pass** (slice § 2), in a non-UTC timezone (`America/New_York`):
   - Seed two public listings in DEVTST-style statics: one in `Europe/London` on Fri/Sat 20:00–23:00 that needs a melee (`recruitingRoles: [{role: 'melee', priority: 'needed', jobs: []}]`), and one with no times.
   - Seed DevMember's jobs explicitly (main `DRG`), and a typical week in `America/New_York` that covers London Fri 20:00–23:00 (Fri 15:00–18:00 New York), but not Saturday.
   - `/discover?shell=v2` → the London card reads `Fri 3:00 PM–6:00 PM free · Sat 3:00 PM–6:00 PM busy` (time format per `formatTimeLabel`) with a **Partial fit** tag: role `match` gives `strong`, and the schedule-`partial` cap makes it `partial` (R-SF-G, OWNER-1). The no-time card shows the day-basis row.
   - The chips, `asRole`, Weekends and the summary work.
   - Request to join → pending → cancel.
   - As DevOwner, **Post a listing** lands on the static with Settings → Recruitment → Listing open.
   - The nudge for a user with no template, with `Your time:` lines on the London card in the browser's zone (OWNER-2).
   - Logged out, with `?shell=v2`: the guest branch, with no tiers or reason rows and `Log in to join` (F1).
   - **V1 still works** (F7):
     - `/discover?shell=legacy` renders V1 unchanged, and its `/api/discovery/statics` request carries no `fitV2` or `viewerTz` (network panel).
     - As DevOwner in V1 (`?shell=legacy`), open Settings → Recruitment → Listing on a static with a recurring `America/New_York` session and empty listing times and zone (Auto-fill fills only empty fields, `DiscoveryTab.tsx:819-830`). **Auto-fill** shows the session's New York day and times (R-SF-K). Shot `sf1-autofill-v1.png`.
   - Both themes, at 1440 and 2560. Shots to `docs/redesign/pr-shots/sf1-*.png`, shrunk per `pr-checklist`.
7. **Gates (R-SF-Q)**, each line pasted.

Size: ~650–850 lines including tests.

**Ad hoc mutation checks:**
- (a) Match requests by name → the same-name test fails.
- (b) Drop `under_review` from pending → its test fails.
- (c) Open the panel before `navigate` → the order assertion fails. Assert call order with a shared `vi.fn` log.

## Finish (controller)

1. **Write-backs, once, on SF1c:**
   - Spec §4: `id` (with `fitV2` and a signed-in caller only; guests and V1 get no `id` key), `viewer`, `fitCounts`, `viewerTz` and the nullable `coverage`, as built.
   - Spec §5: objective tags instead of "content progress".
   - Spec status line: SF1 built; Stage 4 stays open for the lead-side home.
   - `V2_COVERAGE_PLAN.md` Stage 4 (`:122-124`), F6: "Stage 4: Finder built (SF1 #…); lead-side home carried per SF-1, Stage 4 stays open." Stage 4 is scoped as "unifies Discover + recruitment settings + invitations" (`:124`; `REDESIGN_SPEC.md:215`, "unified"), so SF1 doesn't close it. Mockup-06 re-validation is closed, with the dispositions from the mockup-06 table above (built, deviated, dropped).
   - `RECONCILIATION.md:80-82`: B3 → `[PARTIAL]` (the lead-side home is carried).
   - This plan: an Outcome section with PRs, sizes, rulings, loop numbers, and the R-SF-K residual (`DiscoveryTab.tsx:819`).
2. `pr-checklist` skill: release notes (R-SF-Q), screenshots shrunk, `git diff --check`, no workflow changes.
3. Gates on each head, with the counts pasted into each PR body.
4. Draft → ready once per PR. Merge bottom-first per `slice-loop` § Stacked PRs, polling for the restack. The docs PR has already merged, and SF1b and SF1c merge together (m14).
5. The final message per the skill, then rewrite `SESSION_HANDOFF.md`.

## Outcome

- **PRs:**
  - Docs #308 (merged, `cd63abd1`).
  - SF1a #309 (merged, `30a4756d`): +2,901/− at review, 889 of the insertions the golden fixture.
  - SF1b #310 (+1,721/−67).
  - SF1c #311 (+1,301/−36, including this write-back; the number is to be confirmed).
- **Rulings that bind later slices only:**
  - V2 recruitment statuses are a separate list from V1's (m9 gap: a V1 link with `recruitmentStatus=limited` shows "Any status" in V2 while still filtering).
  - `hideConflicts` is V1-only; V2 uses `hideGoalConflicts`.
  - No `displayZone` field. Add one additively if a later slice needs a zone label.
  - `dayGroup` with no known zone is judged on the UTC day (API-only edge).
- **Carried follow-ups:**
  - (a) The R-SF-K residual: `DiscoveryTab.tsx:819` fills `timezone` only when it's empty, so a form already set to another zone still mislabels the auto-filled times.
  - (b) The "Post a listing" root cause: `openSettings({section})` → the `initialSection` handoff loses to same-commit URL writes (`hooks/useGroupViewState.ts`, `components/settings/RecruitmentTab.tsx`, read-only this slice). SF1c works around it by seeding `?rcsub=listing` in the navigated URL.
  - (c) The lead-side recruitment home (SF-1), reverse matching, logged-out polish and mobile (spec §9).
- **Loop numbers:**
  - 3 tasks.
  - Reviews: 1 task-scoped (SF1a) + 1 whole-branch (SF1b+c), each followed by one fix wave with a re-review.
  - Plus one PR-bot fix on #309 (Copilot: 2.1.48 made a public release for the auto-fill fix; claude-review: the `nights` contract).
  - 0 Critical findings; Important findings: 1 (SF1a) and 3 (SF1b+c).
  - About 11 commits across the three PRs.
  - SDD artifacts about 366 KB, of which about 314 KB are review diff packages.
  - Wall clock about 3.5 h, from the golden capture to the fix wave.
  - D12's baseline was 8 tasks / 8 rounds / 30 commits / 838 KB / ~12 h.
- **Plan-vet:** the loop didn't overrule any fold, but it did settle the `nights` contract after vet, at the SF1a review (§4, above).
