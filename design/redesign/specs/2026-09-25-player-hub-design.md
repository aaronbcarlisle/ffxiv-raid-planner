# Player Hub (V2) — design

**Status:** approved in brainstorm 2026-09-25 (sections 1–4); written spec approved by the user 2026-09-25. **PH1 built** 2026-09-26 (plan `plans/2026-09-26-ph1-player-hub-structure.md`, three stacked PRs PH1a/b/c). **PH2 built** 2026-09-27 (plan `plans/2026-09-26-ph2-player-hub-needs-you.md`, PRs #286–#288). **PH3 designed** 2026-09-27 (§10, rulings H-7…H-10; the availability pipe and the BiS-staleness item); plan next. Lines marked *(PH1 write-back)* / *(PH2 as built)* record what the build ruled against the code.
**Roadmap home:** Stage 3 (B2), `ROLLOUT_ROADMAP.md:116-118` — "Player Hub as a real V2 surface … resolves the Stage-1 double-rail".
**Canvas:** `claude.ai/artifact/G5bWkMadnjCmSiUbZ8YMVb`, page "Player Hub" (today + options A/B/C; A chosen).
**Inputs:** `docs/PRODUCT_MODEL.md` §3.1 (two layers), `REDESIGN_SPEC.md` §5.5, `specs/systems-flow-map.md` (F-01, F-02, R1, L-2), `mockups/05-player-hub.html`, `DESIGN_SYSTEM.md` §3.9 (context rail — locked), §3.22 (AttentionRow), CLAUDE.md § UI rules.

## 1. Problem

Under V2 chrome, `/profile` renders V1's `Profile` page unchanged except its footer menu (`Profile.tsx:82-91`). It carries its own 7-item sidebar (`ProfileSidebarNav`, `Profile.tsx:67,307`) inside a centered `max-w-[160rem] mx-auto` container (`:305`), so the page shows **two navigation columns** — the app rail and a floating sub-rail — and reads as an app inside the app. The rail's Player Hub entry uses a **Home** glyph (`pages/chrome/AppChrome.tsx:120-128`), colliding with a static's first tab, also "Home". Mockup 05 had no sub-rail; the shipped page never followed it.

## 2. Rulings (user, 2026-09-25)

- **H-1 (the Hub's job):** glance first — a short "you across your statics" summary, with setup areas as named sections of the same page family. Closes open decision **D6** (`REDESIGN_SPEC.md:398`): the Player Hub is the player's dashboard; it is the landing page only for static-less users (L-2, unchanged).
- **H-2 (entry point):** the rail's first slot becomes **your character portrait** (Lodestone `avatarUrl` of the main character, initials fallback), tooltip "Player Hub". This **amends F-01** (which removed the rail slot; the removal was never built). The Home glyph goes.
- **H-3 (navigation model):** option A — an identity header plus a tab bar, the same pattern as a static. No secondary sidebar; left-aligned on the 120rem cap.
- **H-4 (Overview):** the layout in §4; the **Activity** card is dropped (the notification bell owns events; "Needs you" owns actions).
- **H-5 (slicing):** two slices — PH1 structure (no new API), PH2 "Needs you" (new endpoint).
- **H-6 (tabs):** Overview · Characters & gear · Availability · Tracking · Sharing, mapped per §5.

**PH3 rulings (user, 2026-09-27)** — the third slice, built from what Stage 3 still owed (`V2_COVERAGE_PLAN.md:120`); detail in §10.

- **H-7 (PH3 scope):** the Person→Static availability pipe and the "Your BiS is out of date" item. Mockup-05 re-validation closes with the slice (the BiS row was its only unbuilt element). The profile-tab analytics pass is **retired**: its purpose was to rank Profile's tabs before pruning them, and PH1 already re-presented every destination in five tabs under a signed parity matrix, so no data is left to decide anything.
- **H-8 (BiS-staleness rule):** any loot-log entry for one of the player's roster players newer than the last update of **the player's own Hub BiS set for that job** (the `player_job_profile` set the Characters & gear tab edits) makes it stale; a re-import or any edit there (both bump `updated_at`) clears it. Tome purchases and books count like drops. *(Amended 2026-09-27 at plan-vet: the roster `BiSTargetSet` is lead-managed, invisible to members unless public, and not what priority reads, so it cannot be the clock; the item's action opens the Hub's Characters & gear tab and the copy makes no claim about priority.)*
- **H-9 (pipe rule):** a static's heatmap layers, per member and date, **dated rows, then the member's personal template converted from its saved timezone to UTC per date**, computed at read time in the range endpoint — no materialized copies. A dated row wins even when its slots are empty: clearing a week is an explicit answer. *(Amended 2026-09-27 at plan-vet: dated rows are stored in UTC and the personal template in local time with a timezone, so a 1:1 copy was wrong; the static's own typical-week template has no timezone and stays out of the pipe, carried in §9.)*
- **H-10 (exceptions editor):** the V2 Schedule stopgap modal that hosts the legacy `AvailabilityGrid` stays as the only V2 place to paint a specific week. A V2-native exceptions editor is carried.

## 3. Structure

- **Route:** `/profile` stays. Under V2 chrome (`useInV2Chrome()`), `Profile` renders a new V2-native `PlayerHub` page; the V1 path is untouched. One seam, the way the static tabs were switched.
- **Tabs:** `useUrlTabState`, `?tab=overview|characters|availability|tracking|sharing`, default `overview`. Legacy ids redirect (today's map is `Profile.tsx:42-48,106-111`): `sync`, `jobs-gear`, `jobs`, `gear`, `characters` → `characters`; `preview`, `share` → `sharing`; `collections`, `goals` → `tracking`; `statics` → `overview`. `focus=availability` lands on the Availability tab (and wins when `tab` is absent) *(PH1 write-back: V1 never scrolled — `focusAvailability` only highlighted a chip, `OverviewTab.tsx:318` — so there is no scroll)*. The primary `tab` is hand-rolled rather than `useUrlTabState` (the hook can't map legacy ids, would flash Overview for one render, and doesn't clear sub-tab params — the reasons `useGroupViewState` hand-rolls it too); the `coll` sub-tab uses the hook. About 25 inbound links (`UserMenu`, `AppChrome`, `ContextSwitcher`, `Home`, `Schedule`, `JoinRequestModal`, `SplitClearAssignmentBoard`, `AvailabilityGrid`, `OverviewTab`, …) keep working without edits.
- **`/dashboard`:** under V2 chrome it redirects to `/profile` — Overview, the default tab, omitted from the URL *(PH1 write-back; was `/profile?tab=overview`)* (the same `MyStaticsPanel` it renders is folded into Overview). V1 unchanged.
- **Top bar:** breadcrumb `You › {main character name}`.
- **Identity header** (replaces PageHeader on this surface; it holds the page `<h1>`): portrait, character name, home world, a summary line (`N characters · N jobs · member of N statics` — *PH1 write-back: "at max level" dropped, `PlayerJobProfile` carries no level*), and status chips (Discord linked, plugin synced {relative time}, profile visibility).
- **Rail (H-2):** `AppChrome`'s first entry renders the portrait (`SafeAvatar` + `InitialsAvatar` fallback) with the rail's existing active indicator on `/profile`. The rail needs the main character's `avatarUrl` at app load — one small profile-summary fetch when signed in; guests keep Static Finder only (today's `user &&` gate). The Discord footer menu is unchanged.

## 4. Overview (glance first)

One grid, the same tracks as Home after E2 (`minmax(0,1.15fr) minmax(0,1.15fr) minmax(0,1fr)`), main area spanning two columns:

- **Needs you · across your statics** (PH2): `AttentionRow` rows — what, a detail line, the static tag, one action that deep-links into that static (RSVP → Schedule; you're #1 on a pending drop → Loot). Empty: "Nothing needs you right now." In PH1 the card is absent (not an empty shell). *(PH2 as built, `plans/2026-09-26-ph2-player-hub-needs-you.md`: `NeedsYouCard`, a `CardShell` titled "Needs you" with a `BellRing` icon and "Across your statics" on the right, above Your statics in the main area; only for a user with ≥ 1 static. Rows: the title with the static as a `Tag`; meta = the session start in the viewer's locale · "No response yet" (RSVP), or up to three `{floor} {slot}` drops · +N more (loot); actions **RSVP** → `?tab=schedule&sessionId=` and **View loot** → `?tab=gear`, the Priority view. States: a skeleton on the cold first frame, a one-line error with **Retry**, and stale rows kept when a refetch fails.)*
- **Your statics:** one row per static — initials, name, your role, member count (PH1; PH2 adds current tier, next session, floors cleared, average BiS — *PH1 write-back: the static-list payload has no tier field, so tier moved to PH2's endpoint*; *PH2 as built: one muted `text-xs` line under the row, `{tier} · Next {start} · {n}/{floors} floors this week · {p}% of BiS slots`, only the parts present. "% of BiS slots" is a share of slots, deliberately not Home's "At full BiS" share of raiders*), **Enter →**, and a kebab with the per-static actions `MyStaticsPanel` offers today (so nothing is dropped). The list ends with **Create or join a static**. With no statics: a prominent empty state with **Create a static** and **Find a static** (the L-2 landing).
- **Side column:** Characters (main + alts, Manage → Characters & gear) · Your availability (one-line summary, Edit → Availability) · Profile setup (progress + the single next step, client-derived as today `Profile.tsx:287-297`; hidden when complete).
- **Removed:** the "Profile status" tile strip, the four "Raider snapshot" cards, Activity.

## 5. Tabs (PH1 moves today's bodies in unchanged)

| Tab | Body (today) | Layout |
|---|---|---|
| Characters & gear | `SyncCenterTab.tsx:66` + `JobsGearTab.tsx:43` | two stacked sections, **Sync** then **Jobs** (no sub-tabs: ≤ 2 levels) |
| Availability | `PlayerAvailabilityTab.tsx:33` (`PersonalAvailabilityEditor`) | as is |
| Tracking | `GoalsTab.tsx:24` + `CollectionsCenterTab.tsx:1` | **Goals** above **Collections**; Collections keeps its own Priorities/Browse toggle (`coll=`) as the second level |
| Sharing | `PreviewShareTab.tsx:38` | as is |

A later slice may merge Sync + Jobs into one card per character; out of scope here.

## 6. Data

- **PH1:** existing stores only — `usePlayerProfileStore` (profile, characters, jobProfiles, gearSnapshots, goals), `usePersonalAvailabilityStore`, `useCollectionIntentStore`, `useStaticGroupStore` (groups). No backend change except, if needed, a lightweight profile summary for the rail (prefer the existing profile fetch).
- **PH2:** `GET /api/player/overview` → `{ statics: [{ id, shareCode, name, role, tierName, memberCount, nextSession?, floorsCleared?, avgBisPct? }], actionItems: [{ type, staticId, staticName, title, detail, href }] }`. Types at launch: `rsvp_pending` (a session in the next 7 days with no RSVP from your linked player in that static) and `loot_priority` (you are #1 on this week's unassigned drop, via the existing priority calculator, `backend/app/services/priority_calculator.py`). Computed per request over the user's memberships; permission-scoped like the static endpoints. **Deferred:** "Your BiS is out of date" — no clean signal for "items obtained since your last import" exists; define the rule before building it.
  - *PH2 as built (`plans/2026-09-26-ph2-player-hub-needs-you.md`, rulings R-PH2-A…O):*
    - **Wire.** `statics[]` carries `tierId`, not `tierName`: the client resolves the name from gamedata. It also carries `nextSession { sessionId, title, startsAt }`, `floorsCleared` and `avgBisPct`, all nullable. Each item in `actionItems[]` adds `startsAt`, set for RSVP items only: an aware UTC ISO string that the client formats in the viewer's locale.
    - **Scope.** Memberships only (`get_user_static_groups`, every role including viewer). Statics linked only through a claimed player are excluded, and admin owner-access adds nothing. Every query is batched over the membership's static ids.
    - **`rsvp_pending`.** For each session that tracks availability, take the next occurrence. The item appears when `now < start ≤ now + 7 days` and the caller has no RSVP of any status. RSVPs are per user and per series, not per linked player. Viewers get none.
    - **`loot_priority`.** The calculator's **strict** #1 (no tie) for one of the caller's configured, non-substitute players, on a floor-1–3 drop of the active tier's current week that no log entry of any method records (`ring` covers both ring slots).
      - It ranks with the **client-effective** settings: the client's `DEFAULT_SETTINGS` with the saved settings merged on top. A static with no saved settings therefore ranks melee → caster → ranged, as the Loot tab does.
      - It is skipped under enhanced scoring once the tier has a log entry, under the `disabled` and `manual-planning` modes, on ties, for the weapon floor, for non-savage or unknown tiers, and when a saved settings blob fails validation (logged).
- **PH3:** no new endpoint. The availability range endpoint gains an opt-in layering flag and a `source` field; the overview endpoint gains the `bis_stale` item type. Detail in §10.
- Loading, empty and error states follow `ShellContentStates` patterns.

## 7. Acceptance criteria

1. Under V2 chrome `/profile` shows one navigation column (the rail), the identity header, and the five tabs; no `ProfileSidebarNav`. Under V1, `/profile` is byte-identical to today (chrome test pinned both ways, like `Profile.rail.test.tsx`).
2. The rail's first entry is the portrait (or initials), active on `/profile`, with no Home glyph; guests see Static Finder only.
3. Every legacy `?tab=` id and `focus=availability` land on the right tab/section; `/dashboard` under V2 lands on Overview.
4. Overview renders Your statics (with the per-static actions and Create/join), the three side cards, and nothing from §4 "Removed"; the static-less empty state offers Create and Find.
5. Each tab renders today's body with its behavior unchanged (existing body tests stay green unedited).
6. Content is left-aligned on the 120rem cap; headings go h1 (identity) → h2 (cards/sections); light and dark both verified.
7. PH2: the endpoint returns only the caller's statics and items; each action item deep-links correctly; empty and error states render.
8. PH3: with the layering flag, the range endpoint returns a row for every non-viewer member and UTC date that has a dated row or personal-template slots converted from the member's timezone, dated first, each tagged with its `source`; without the flag it returns today's rows and values plus the additive `source` field, and V1's grid and heatmap behave as before. A template slot lands on the same local hour in the heatmap for a viewer in the template's timezone.
9. PH3: a V2 static's heatmap and Best Times reflect a member's personal template with no per-static action from that member; the Hub's Availability tab and side card say so under V2 only, and V1's Availability tab copy is unchanged.
10. PH3: a player whose active Hub BiS set for a job predates one of their roster player's loot-log entries gets one `bis_stale` item per such player, deep-linked to the Hub's Characters & gear tab; a player with no Hub set, or whose set was updated after their newest entry, gets none.

## 8. Test plan

- Unit/integration: PlayerHub tab routing + redirects; Overview composition and the static-less state; rail portrait/fallback/active state; `/dashboard` redirect; V1 `Profile` unchanged under V1 chrome.
- Backend (PH2): pytest for the endpoint (permission scoping, `rsvp_pending` window edges, `loot_priority` from the calculator).
- Browser pass per slice (dev-auth → `/profile?shell=v2`), both themes, 1440 and 2560; the L-2 case with a static-less dev user.
- Backend (PH3): pytest for the layering precedence (dated > converted personal template), the timezone conversion (a slot crossing midnight lands on the next UTC date; DST; an unknown zone read as UTC), the empty-dated-row override, viewers excluded, the flag-off path unchanged, the `source` tag, and the staleness edges (no job profile / no active set, entry older than / equal to / newer than `updated_at`, several configured players in one static, the set-active bump). Frontend (PH3): the store passes the flag only under V2 and keeps layered rows out of the legacy grid's data; `NeedsYouCard` renders the `bis_stale` kind; the Hub copy under V2 only. Browser, in a non-UTC timezone: a V2 static's Schedule heatmap with one member who only has a personal template, the slot on the same local hour; the Hub's Needs you with a stale set.

## 9. Out of scope / carried

- Merging Sync + Jobs per character; the BiS-staleness rule; mobile (Phase P); Static Finder's rework (Stage 4, B3 — its left-align ships in E2 per U-9).
- `design/redesign/specs/systems-flow-map.md` F-01 is amended by H-2 (written back with PH1).
- *(PH1 write-back)* Carried out of PH1: the availability flip-blocker + one-editor mandate and the profile-tab analytics pass (`V2_COVERAGE_PLAN.md` Stage 3) → a later Stage-3 slice; swipe + mobile tab nav → Phase P; heading-level skips inside the V1-shared tab bodies → whenever V1 is authorized. Four V1 affordances were retired in V2 with the user's sign-off (plan § parity matrix, RETIRED-ACK).
- *(PH2 write-back)* Carried out of PH2:
  - "Your BiS is out of date" (the rule is still undefined) → a later Stage-3 slice.
  - `loot_priority` under enhanced scoring and for the weapon → with the plugin priority work. It needs a backend port of the drought/balance and weapon priorities, or a parity suite.
  - A Queues / `floor=` deep link into Loot → Loot polish.
  - The plugin `priority` endpoint ranks with the raw settings blob, so a static with no saved settings gets an empty role order. There is also the `roleOrder == []` `||`/`or` gap. Both → a plugin-contract ticket.
  - The next session in `objective_goals.py` ignores recurrence and cancellations → a backend bug ticket.
- *(PH3 design, 2026-09-27)* Retired: the profile-tab analytics pass (H-7). Carried out of PH3:
  - A V2-native per-week exceptions editor on the Availability tab, replacing the Schedule stopgap modal (H-10); it should also style template-derived cells, which the legacy grid shows as painted.
  - Timezones *(corrected at plan-vet)*: dated rows are **UTC** (`AvailabilityGrid.tsx` converts on save, the heatmap converts back on read); the personal template is **local time plus a saved timezone**; the static's typical-week template is local time with **no** timezone. The pipe converts the personal template properly (H-9). Carried: the static template as a pipe layer (it needs a timezone column first) and the quick-fill's 1:1 copy, which has the same latent bug.
  - The pipe under V1 (the flag stays off there until V1 is authorized or deleted).
  - "Only slots that differ from BiS" as a sharper staleness rule needs BiS slots keyed to loot items (a migration); H-8's timestamp rule ships first.

## 10. PH3 — the availability pipe and BiS staleness

Built from the Stage 3 items still owed after PH2 (`V2_COVERAGE_PLAN.md:120`, `ROLLOUT_ROADMAP.md:362,377`). The flip-blocker it closes is F6e §6.3 item 1 (`specs/2026-07-02-f6e-schedule-design.md:248-250`): the legacy static grid was the only editor feeding the heatmap. After PH3 the Hub's template editor feeds it too, which is the "aggregation pipe" arm of the either/or at `V2_COVERAGE_PLAN.md:118`.

### 10.1 The pipe (backend)

- **Where:** `GET /api/static-groups/{group_id}/availability` (`backend/app/routers/schedule.py:1449`, `list_availability`). It already takes `start_date`/`end_date` and walks every date in the range, so the layering lives inside it; no new endpoint.
- **Flag:** the query parameter `include_templates` (boolean, default false). Off: the same rows and values as today; the only difference is the additive `source: "dated"` field on each row *(plan correction: "byte-identical" was wrong, since the field is on the schema)*. V1 never sends it.
- **Precedence per member and UTC date (H-9):** a `UserAvailability` row for that date (even with empty slots) → else the member's personal-template slots that fall on that UTC date after conversion → else no row. Conversion: for each local day the range can touch, take the member's `PersonalAvailabilityTemplate` row for that weekday (`day_of_week` MO…SU, the same codes the quick-fill maps at `quickFillUtils.ts:25-29`), interpret each `HH:MM` slot as local wall time on that local date in the row's saved `timezone`, and convert to a UTC date and slot; slots may land on the neighbouring UTC date. An unknown timezone name is read as UTC.
- **Members:** the static's **non-viewer** memberships *(plan-vet correction to "every role": viewers cannot submit availability and every heatmap denominator excludes them)*. Dated rows are returned as today for any user, member or not. Templates are loaded in one batched query over the member ids, not per member.
- **Wire:** `UserAvailabilityResponse` gains `source: "dated" | "personal_template"`; derived rows have `id: null`. Additive, so every existing consumer keeps working; the PUT response shares the schema and gains the same field.
- **Static typical-week template:** not a pipe layer (no timezone; carried, §9). The heatmap keeps reading it separately for recommendations, as today.
- **Nothing is written.** Template edits show in every static's next fetch; no cascade, nothing to go stale.

### 10.2 The pipe (frontend, V2 only)

- `useAvailabilityStore.fetchAvailability` takes the flag and, when set, writes a **separate `layeredData` field** that only V2's `Schedule.tsx` reads *(plan-vet: the store's single `data` field is shared with the legacy grid and the quick-fill, which seed their editing state from it; a shared field would let derived slots be painted back as dated rows)*. `AvailabilityHeatmap` and `BestTimesCard` (both presentational) see derived rows with no change of their own. `AvailabilityGrid` and `QuickFillHelper` keep reading `data` and never send the flag.
- Hub copy, **V2 only**: `PlayerAvailabilityTab` renders under V1 too (`pages/Profile.tsx:525`), so its new copy is gated by a prop only the V2 `PlayerHub` passes; V1's tab is unchanged. Under V2 the tab's intro and its info tiles describe the pipe, and the Overview's "Your availability" side card gains one line saying the template fills every static's schedule unless a specific week is painted. The tab's existing link to a static's Schedule is the exceptions entry point; the side card gets no new link.
- H-10 in practice *(plan correction)*: the legacy grid inside V2's stopgap modal runs its own fetch (`AvailabilityGrid.tsx:121`) **without** the flag and reads `data`, so it shows only painted rows; the quick-fill remains the explicit way to copy a template into dated rows. When the modal closes, `Schedule.tsx` refetches `layeredData`. Styling derived cells stays carried with the exceptions editor.

### 10.3 `bis_stale` (backend + frontend)

- **Endpoint:** the existing `GET /api/player/overview` (`backend/app/services/player_overview.py`), a third `OverviewActionItem.type`.
- **Rule (H-8, amended):** for each membership static (non-viewer) and each of the caller's configured, non-substitute players there (the population `loot_priority` already uses), take the caller's **Hub BiS set** for that player's job: the active `BiSTargetSet` owned by the caller's `PlayerJobProfile` for that job (`owner_type="player_job_profile"`, `is_active`; the set the Characters & gear tab edits through `routers/player_bis_targets.py`). Count `LootLogEntry` rows with `recipient_player_id` = that roster player and `created_at` > the set's `updated_at`, both parsed as aware UTC datetimes (both are ISO strings written with `datetime.now(timezone.utc)`; naive strings are treated as UTC). Any count → one item. No job profile, no active set, or no newer entry → none. The roster `BiSTargetSet` (`roster_member_job`) is **not** consulted *(plan-vet: lead-managed, `is_public`-gated for members, not what the priority calculator reads)*.
- **Why `updated_at` is the right clock:** the Hub set's import, any edit and set-active all bump it (`player_bis_targets.py`), and the player can do all three themselves, so the item is theirs to clear.
- **Item:** `title` "Your BiS may be out of date"; `detail` "{n} item(s) logged since your BiS was last updated" (mockup-05 `:498`, without "priority may be wrong": priority reads the roster's gear slots, not this set); when the caller has more than one configured player in that static the detail is prefixed with the player's name. `href` → the Hub's Characters & gear tab (`/profile?tab=characters`); `starts_at` null. Sort: after the RSVP and loot items, by `static_name.casefold()`, one item per stale player.
- **Card:** `NeedsYouCard` maps the new type to a **Review BiS** button and a gear-ish icon, allows `/profile` hrefs beside `/group/` ones, keys rows by type + href + index (two stale players share an href), and the empty-state copy mentions BiS; `usePlayerOverview` widens the type union. No layout change.
- **Batched:** one query for the caller's job profiles + active Hub sets, one query for the caller's players' loot-log timestamps; no per-player round trips.

### 10.4 Delivery

Three stacked PRs under the slice loop: **PH3a** the pipe backend (endpoint flag, layering with timezone conversion, schema field, pytest); **PH3b** the pipe frontend (store `layeredData`, V2 fetch, Hub copy behind the V2 prop, browser pass) **plus the pipe write-backs** (F6e §6.3 item 1 closed, `V2_COVERAGE_PLAN.md` Stage 3 status, `ROLLOUT_ROADMAP.md:362`) — they ride the PR that completes the pipe, never a later one; **PH3c** `bis_stale` end to end plus its own write-backs (`ROLLOUT_ROADMAP.md:377`, spec §9). PH3c is independent of the pipe and may be re-based to `main` if PH3a/b stall without closing the flip-blocker early.
