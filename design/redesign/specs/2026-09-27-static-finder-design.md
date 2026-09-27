# Static Finder (V2) — design

**Status:** SF1 built — SF1a #309, SF1b #310, SF1c #311. Stage 4 stays open for the lead-side home (§9); `RECONCILIATION.md` B3 is `[PARTIAL]`.
**Roadmap home:** Stage 4 (B3), `V2_COVERAGE_PLAN.md:122-124`: "Same discipline per §5.6 + mockup-06 re-validation; unifies Discover + recruitment settings + invitations (recruitment-as-matching, Ring 1)."
**Inputs:**
- `REDESIGN_SPEC.md` §5.6 (`:211-215`), recruitment as *matching*.
- `docs/PRODUCT_MODEL.md` Ring 1 (recruitment(match), not a social surface).
- `RECONCILIATION.md:80-82` (B3 `[NEVER-BUILT]`).
- `mockups/06-static-finder.html`.
- The Player Hub spec §10 (`specs/2026-09-25-player-hub-design.md`), whose PH3 availability pipe this reuses.
- CLAUDE.md § UI rules.

## 1. Problem

`/discover` renders inside V2 chrome, but its body is still V1's `Discover` page (`pages/Discover.tsx:237`, 894 lines; chrome since Stage 1, left-aligned by E2 U-9). It already ranks listings by a fit summary (`services/fit_score.py`), but that fit falls short of §5.6's promise in three ways:

- **Schedule fit is day overlap only.** `_compute_schedule_fit` (`fit_score.py:159`) compares the *days* in your personal template with the listing's `scheduleDays`, ignoring times and both timezones. A static raiding Fri 8–11 PM "fits" someone free only on Friday mornings. Mockup 06 promises "Raids Fri/Sat 8PM — you're free both".
- **Role fit misses role-level needs.** `_compute_job_fit` (`fit_score.py:119`) matches your jobs against `neededJobs` (or a `recruitingJobs` key nothing writes, `:131`). The listing form stores `recruitingRoles: {role, priority, jobs}` and derives `neededJobs` from it (`components/settings/DiscoveryTab.tsx` save, `types/index.ts:674`). So a role listed with no specific jobs ("a melee") matches nobody, and needed versus nice-to-have is ignored.
- **The page body is V1.** Mockup 06's filter rail, match summary, explained cards and "Post a listing" entry were never built.

## 2. Rulings (user, 2026-09-27; SF-7 at spec review)

- **SF-1 Goal:** better matches plus a V2 body. Stage 4 is centred on a real matching upgrade and a V2-native Finder body built to mockup 06. The lead-side home (listing management, invitations and join requests moving out of Settings) is **not** in this stage (§9).
- **SF-2 Schedule fit = per-night coverage.**
  - A night is `full` when you are free for the whole raid window, `part` when you are free for some of it, and `none` otherwise.
  - The listing is `match` when every night is full, `partial` when any night is full or part, and `conflict` when no slot is free.
  - It is `unknown` when you have no typical week, or the listing has no days.
- **SF-3 Role need = your Hub jobs plus a filter override.**
  - Your Hub job list is used main first.
  - Your main filling a *needed* role is a full fit. That includes any job of the role when the listing names no jobs.
  - An alt, or a *nice-to-have* role, is partial.
  - The "My role" chips default to your main's role and let you search as another role.
- **SF-4 The badge is a tier label with reasons, not a percentage.** Strong / Good / Partial / Weak / Not enough info, explained by explicit reason rows. Best match sorts by tier, then by the number of fully matching rows. This deliberately deviates from mockup 06's "match %".
- **SF-5 Architecture is approach A:** a backend-first, additive engine upgrade on the existing endpoint. V1 keeps today's `fit` fields and semantics, and the V2 body opts into a new `fitV2` object. Rejected: fit computed in the browser (it duplicates the engine and breaks server-side sort and filter), and a separate V2-only endpoint (two engines that drift).
- **SF-6 Actions keep V1's semantics.**
  - **View** goes to `/group/:shareCode`.
  - **Request to join** reuses `JoinRequestModal` with the pending (cancel), accepted and declined states. The wording stays "Request to join" rather than the mockup's "Apply", because it is a request.
  - **"Leading a static?"** routes to that static's Settings → Recruitment.
- **SF-7 Day groups use the viewer's calendar.**
  - Weekends are Sat–Sun and weeknights are Mon–Fri.
  - A raid night counts by the **local day it starts on in the viewer's zone** (`fitV2.schedule.nights[].localDay`), not the static's. A static's Fri 8 PM New York raid is a Saturday-morning raid for a viewer in Sydney.
  - A listing that can't be placed on a clock (`basis: 'day'`, §3.1) falls back to its own `scheduleDays`.
  - The filter is the only consumer; it doesn't affect tiers, sort or reasons.
  - **Amended at plan review (owner, 2026-09-27):** the viewer's zone is the zone of their newest typical-week row whose zone loads, else the browser zone the V2 Finder sends (`viewerTz`, §4), else UTC. A viewer with no typical week still gets local times and day groups from the browser zone; their schedule fit stays `unknown`.

## 3. Engine (SF1a, backend)

All of this lives in `services/fit_score.py` as pure functions with no database access, beside the existing ones. The viewer's inputs are loaded once per request in `routers/discovery.py`.

### 3.1 Schedule, per night

- **Listing side:** `timezone` (IANA), `scheduleDays`, `scheduleStartTime` and `scheduleEndTime` (`HH:MM`, 30-minute steps from the listing form's `Select`). An end at or before the start **crosses midnight**.
- **Your side:** `PersonalAvailabilityTemplate` rows (`models/personal_availability.py:15`): a `day_of_week`, local `HH:MM` 30-minute `slots`, and an IANA `timezone`.
- **Per listed night:**
  1. Place the window on that weekday's **next occurrence** from today, in the listing's zone, so DST applies as it will on raid night.
  2. Convert both ends to UTC, then into the viewer's zone. Use the PH3 helpers in `services/availability_layering.py`: `_load_zone`, the slot parsing and the weekday codes. Share them rather than copy them.
  3. Test every 30-minute slot of the converted window against the template for its **local** day. The converted window may span two local days (midnight crossing, or a zone offset), and each slot checks its own day.
  4. The night is `full` if every slot is free, `part` if some are, and `none` if none are.
- **Listing status:** as SF-2.
- **Fallbacks:**
  - If the listing has days but no start time, or no timezone, or a zone that doesn't load, the window can't be placed. The status falls back to today's day-level overlap with `basis: 'day'`, and the card says "no time listed".
  - If the viewer's zone doesn't load, treat it as UTC, as `availability_layering` already does, with a warning log.

### 3.2 Role

- **Listing entries:** `recruitingRoles`. When that is absent, legacy `neededRoles`/`neededJobs` are mapped to entries the way `initRecruitingRoles` does in `DiscoveryTab.tsx` (each needed role gets its matching jobs, and an orphan job gets its own role entry, priority `needed`). The dead `recruitingJobs` read stays (plan-vet fold, 2026-09-27): `fit_score.py` is read-only in SF1 (plan R-SF-R), so V1's read at `fit_score.py:131` is untouched. The V2 engine never reads the key.
- **Your jobs:** `PlayerJobProfile` in priority order, as today (`discovery.py:257-268`); the first is your main.
- **A hit:** a job hits an entry when the entry's `jobs` includes it, **or** the entry's `jobs` is empty and the job's role equals `entry.role`. Roles use the app's five keys: tank / healer / melee / ranged / caster.
- **Status:** `match` if your main hits a `needed` entry. `partial` if an alt hits a `needed` entry, or any job hits a `nice_to_have` one. `none` if no job hits. `unknown` if the listing has no entries or you have no jobs.
- **`asRole` override:** the viewer is treated as "any job of that role". A `needed` entry for the role gives `match`, a `nice_to_have` one gives `partial`, anything else gives `none`.

### 3.3 Tier, reasons, sort

- **Tier:** today's `_compute_overall` rules (`fit_score.py:260`), fed by the new role and schedule statuses. Any conflict, including role `none`, makes it `weak`. After that come `strong`, `good`, `partial` and `unknown`, as the function already orders them.
  - **Amended at plan review (owner, 2026-09-27):** in fitV2, schedule `partial` caps the tier at `partial`; V1 unchanged.
- **Reasons:** an ordered `reasons[]` of `{kind, status, params}`, one row per resolved component: role, schedule, goals, comms and BiS. The rows carry **no English**; the frontend owns the copy.
- **Best match:** order by tier rank, then by the number of `match` reasons, then by recency.

## 4. API (SF1a)

The endpoint stays `GET /api/discovery/statics` (`routers/discovery.py:167`). It already builds the whole filtered list in memory before sorting and slicing (`:379-382`), so fit-based sort and counts are computed on the server.

**New optional query parameters.** V1 sends none of them.

| Param | Meaning |
|---|---|
| `fitV2=true` | Compute `fitV2` for the signed-in viewer. Ignored for guests. |
| `asRole` | One of the five role keys. It needs `fitV2`, and changes only role fit. |
| `sort=best` | Adds a value to `SortOption` (`:35`). Guests, or requests without `fitV2`, fall back to `recent`. |
| `scheduleOverlap=true` | Existing flag. With `fitV2` it filters on the new status (`match`/`partial`); without it, the behaviour is unchanged. |
| `dayGroup=weeknights\|weekends` | Keeps a listing with at least one raid night in the group: weekends are Sat–Sun, weeknights are Mon–Fri (SF-7). |
| `goalCategory` | Also accepts a comma-separated list, where any one matches. A single value behaves exactly as before. |
| `viewerTz` | The viewer's browser IANA zone, which the V2 Finder sends with `fitV2`. It is the fallback display and day-group zone when no typical-week row has a zone that loads (SF-7). An invalid or missing value is ignored, with no 422. Amended at plan review (owner, 2026-09-27). |

**Additive response fields.**

```
DiscoveryListItem.fitV2: {            // null for guests or without the flag
  tier: 'strong' | 'good' | 'partial' | 'weak' | 'unknown',
  missing: ('template' | 'jobs')[],   // drives the Hub nudge
  role:     { status, matchedJob?, matchedRole?, priority?, isMain, asRole? },
  schedule: { status, basis: 'time' | 'day',
              nights: [{ day, localDay, localStart, localEnd, coverage: 'full' | 'part' | 'none' | null }] },
  reasons:  [{ kind: 'role' | 'schedule' | 'goals' | 'comms' | 'bis', status, params }]
}
FinderListItem.id: string             // subclass of DiscoveryListItem; only with fitV2 and a signed-in caller (see below)
DiscoveryListResponse.fitCounts: { strong, good, partial, weak, unknown } | null   // whole filtered set, before pagination; null without fitV2
DiscoveryListResponse.viewer: { mainJob, mainRole, missing: ('template' | 'jobs')[] } | null   // the viewer's own fit inputs; null without fitV2 or for guests
```

**As built** (`schemas/discovery.py`):

- **`id`.** Emitted only when `fitV2` is on **and** the caller is signed in. It lands on a separate subclass, `FinderListItem(DiscoveryListItem)`, which the router instantiates only on that path; `DiscoveryListResponse.items` is typed `list[SerializeAsAny[DiscoveryListItem]]` so a plain item serializes with **no `id` key at all** (not `null`) and a `FinderListItem` keeps its `id`. Guests and V1 requests always get the plain shape. This is a deliberate flip of the endpoint's "no internal IDs" guard (`tests/test_discovery.py:270,281`), scoped to signed-in V2 viewers only.
- **`viewer` (`FitViewer`).** The signed-in viewer's own `mainJob`/`mainRole` and `missing` (`template`/`jobs`), independent of any one listing — the Finder's nudge and role-chip default read it once instead of re-deriving it per card. `null` without `fitV2` or for a guest.
- **`fitCounts` (`FitCounts`).** Tier counts over the whole filtered set, before pagination. `null` without `fitV2`.
- **`viewerTz`.** A request parameter only (§4 table), not a response field: the viewer's browser IANA zone, used solely as the display/day-group zone fallback when no typical-week row's zone loads (SF-7). It never appears in the response.
- **`nights[].coverage` (nullable).** `'full' | 'part' | 'none'` when the viewer has a typical week to test that night against; `null` when they don't (no typical week at all, or `basis: 'day'` with nothing to compare). `FitV2Schedule.basis` separately names *how* coverage was judged (`'time'` per 30-minute slot, `'day'` by weekday only) — `basis` is never itself `null`; only a night's `coverage` can be.
- **The `nights` contract, settled in review (#309).** `nights` is populated whenever the listing has days, one entry per listed day, regardless of whether local times could be placed. `localDay`/`localStart`/`localEnd` are additionally present whenever the listing has times (a start, an end, and a loadable listing zone) — in the **display zone**: the newest typical-week row's zone, else the request's `viewerTz`, else UTC. They are `null` only when the window can't be placed on a clock (no start time, no zone, or an unloadable zone), in which case the card falls back to day-level text.

**Contracts.** Without the new parameters, the response is byte-identical apart from the new nullable fields (`fitV2`, `fitCounts`, `viewer`) and the absent `id` key. The existing `fit` object keeps today's semantics. The Dalamud plugin calls none of these routes.

## 5. UI (SF1b, V2 only)

- **Seam:** a single `useInV2Chrome()` branch at the top of `Discover` renders `StaticFinder`, the same pattern as `Profile` → `PlayerHub`. The V1 body is untouched. New code goes in `frontend/src/components/finder/`.
- **Layout:** left-aligned inside the 120rem shell, with nothing sticky. A `PageHeader` ("Static Finder" / "Find a static that fits your content, schedule and role.") sits above a filter column and the results. (Plan-vet fold, 2026-09-27: the subtitle says "static", since user-facing copy never says "group".)
- **Filters:** all sync to the URL using the existing parameter names, so V1 links keep working.
  - **Search:** `q`.
  - **Content:** a `Checkbox` per goal category, writing the comma-separated `goalCategory`.
  - **My role:** `Tag variant=filter` chips for the five roles. The default is your main job's role, marked "as you". Choosing another sets `asRole`.
  - **Schedule:** a "Fits my typical week" `Checkbox` (`scheduleOverlap`), plus Weeknights and Weekends chips (`dayGroup`).
  - **Vibe:** `intensity` chips.
  - **More filters:** collapsed by default. V1's data center, server, language and recruitment status, each confirmed or dropped in the parity matrix (§6).
- **Summary bar:** driven by `fitCounts`, for example "3 statics are a strong fit for your melee opening and schedule". A `Select` for sort defaults to **Best match**; Recent, Members and Name stay available.
- **Nudge:** when any item's `fitV2.missing` includes `template`, one inline line says "Add your typical week on the Hub to match schedules", with a `LinkText` to `/profile?tab=availability`. For `jobs` it says "Add your jobs…" and links to `/profile?tab=characters`.
- **Card:**
  - **Header:** name, DC/server, objective tags (no progress data), and the tier `Tag` (semantic status tokens).
  - **Reason rows:** each has a match, partial, conflict or unknown icon, with copy built from `reasons`. For example:
    - "Needs a tank — your WAR (main)"
    - "Fri 8–11 PM ✓ · Sat 8–11 PM partly free", in your local time
    - "Schedule: Fri/Sat, no time listed"
    - Goals and comms rows
  - **Footer:** members filled (for example 6/8), **View**, and **Request to join** with V1's request states (SF-6).
- **"Leading a static?" row:**
  - If you own or lead one static, it routes to its Settings → Recruitment.
  - If you lead several, a picker.
  - If you lead none, the existing Create-a-static flow.
  - The settings panel opens through its Zustand store, not the URL (memory `project_settings_panel_store`). The plan settles the hand-off.
- **States:** skeleton cards while loading. "No statics match" with Clear filters. An inline retry when loading fails.
- **Guests (plan-vet fold, 2026-09-27):** guests do reach the V2 Finder. `Layout.tsx:71` turns V2 chrome on from the shell alone, with no auth check, so `?shell=v2` or a persisted `ui-shell` works logged out (`V2_COVERAGE_PLAN.md:100`). The first draft's "guests can't enter V2 (D7)" was false. Guests get a guest branch: no fit, tier or reason rows, a plain count, and V1's "Log in to join" (plan R-SF-N).
- **Out of reach:** mobile is deferred to the end-phase pass.

## 6. Closing SF1 (SF1c)

**Plan-vet fold, 2026-09-27:** SF1c closes the Finder, not Stage 4. `V2_COVERAGE_PLAN.md:124` scopes Stage 4 as "unifies Discover + recruitment settings + invitations", and SF-1 keeps the lead-side home out of SF1 (§9). So Stage 4 stays open after SF1c, and `RECONCILIATION.md` B3 becomes `[PARTIAL]`, not built.

- **Parity matrix:** every V1 Discover affordance marked keep, fold or drop, with the user's sign-off, as Stage 3 did.
- **Mockup-06 re-validation:** light and dark shots in `docs/redesign/pr-shots/`, with the deliberate deviations listed: the tier badge instead of a %, and "Request to join".
- **Browser validation** of the touched surfaces (the dev-auth recipe).
- **Write-backs:** V2_COVERAGE_PLAN Stage 4 status, and this spec's status line.
- **Hub:** "Find a static" keeps linking to `/discover` (`YourStaticsCard.tsx:251,260`), which now lands on the V2 Finder.

## 7. Acceptance criteria

1. With `fitV2=true`, a viewer whose template covers the whole converted window on every listed night gets `schedule.status = 'match'`. That includes a listing in another zone, a window crossing midnight, and a DST-transition week. Removing one slot gives `partial`.
2. A listing with `recruitingRoles: [{role: 'melee', priority: 'needed', jobs: []}]` gives `match` for a viewer whose main is any melee job, and `partial` when the melee job is an alt.
3. `asRole=tank` changes only role fit, and `fitCounts` reflects it.
4. `sort=best` orders by tier, then by the number of match reasons. `fitCounts` counts the whole filtered set, not the page.
5. `dayGroup=weekends` keeps a Fri 8 PM America/New_York listing for a viewer in Australia/Sydney, whose local start day is Saturday, and drops it for a viewer in New York. **Amended at plan review (owner, 2026-09-27):** this holds for a Sydney viewer with no typical week too, through the `viewerTz` fallback (SF-7).
6. Without the new parameters, the old fields in the response equal today's output (snapshot test).
7. Under V2 chrome, `/discover` renders `StaticFinder`; under V1, `Discover` renders unchanged.
8. Every card shows a tier and reason rows, with times in the viewer's zone. The nudge appears only when `missing` is non-empty.
9. Request to join, cancel, and the accepted and declined states behave as in V1.

## 8. Test plan

- **pytest (`fit_score` + discovery router):**
  - The coverage matrix: same zone; cross zone; midnight crossing; two-day span; the DST week; no time or no zone falling back to day level; an unloadable zone.
  - The role matrix: main/alt × needed/nice × `asRole`, plus the legacy `neededJobs` mapping.
  - Tier and sort order; `fitCounts` counted before pagination; `dayGroup` judged on the viewer's local start day (a Fri-evening New York listing is a weekend night for a Sydney viewer) with the `basis: 'day'` fallback; the comma-separated `goalCategory`.
  - A V1 snapshot.
- **vitest:**
  - Reason copy, including local times.
  - Filters to the URL and to request parameters.
  - The role-chip default and override.
  - Nudge visibility.
  - The join-request states.
  - The Post-a-listing branches: one static, several, none.
  - The seam: V2 renders `StaticFinder`, V1 renders `Discover`.
- **Browser:** the Finder at DEVTST with a seeded listing and a typical week in another zone.

## 9. Out of scope / carried

- **The lead-side home.** Listing management, invitations and join requests stay in Settings → Recruitment (`RecruitmentTab`). §5.6's "replaces … the recruitment settings tab + the invitations modal, unified" is carried to a later Ring-1 slice.
- **Player↔static discovery the other way round** (leads browsing matching players). Mockup 06's CTA copy hints at it; carried.
- **The static typical-week template as a matching input** (carried from PH3 §9 too).
- **Logged-out V2,** which waits for the un-gate (D7). (Plan-vet fold, 2026-09-27: guests can already reach the V2 Finder, and SF1 gives them a guest branch, §5. What waits for the un-gate is a logged-out *entry* into V2.)
- **Mobile,** deferred to the end-phase pass.

## 10. Delivery

- **Three stacked PRs:**
  - **SF1a:** the engine and API, backend only, and the riskiest (§3–4).
  - **SF1b:** the V2 Finder body (§5).
  - **SF1c:** parity, mockup-06 re-validation and write-backs (§6).
- **Process:** each is run with the `slice-loop` skill, from a plan in `design/redesign/plans/`, with a director plan-vet first.
