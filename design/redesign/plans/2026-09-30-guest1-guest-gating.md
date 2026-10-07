# GUEST-1 · Guest gating (W0)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** a signed-out visitor at a static gets honest chrome, a quiet console and a minimal payload.
- The V2 group top bar shows **Log in**, not a bell or a settings gear, and the command palette offers no "Open Settings". The settings dock never opens for a guest.
- V2 Schedule shows one members-only card to non-members instead of false empty states, and makes no member-only request.
- A guest's page loads log no 401s: the auth bootstrap asks a probe that always answers 200.
- The `by-code` payload (and `GET /static-groups/{id}`, which shares its builder) carries no member's or owner's Discord identity for a caller who isn't a member.

**Spec (binding):** `design/redesign/HOME_STRETCH.md` §6.3 W0, the **GUEST-1** row (`:368`), and §6.5 #4 (`:512`), which HS-35 answered: **(a), with (c) if the Finder needs a contact.** Also binding: `CLAUDE.md` § UI rules, § Product rules ("Viewer read-only via share code") and § Pitfalls (the plugin contract), plus the audit evidence in `.superpowers/v2-audit/` (SYNTHESIS D-05, A1 §5 #5 and §11.7, A4 F-S9, agent B note 7). The owner's Session 5 answers **B13, B14, B18 and B19** (`.superpowers/stage2/working-notes.md` § Session 5, answered 2026-10-01, "all recommended") bind too.

**Slice:** one slice, one PR. Branch `fix/w0-guest1-guest-gating`, worktree `.claude/worktrees/guest1`, base `main` `c8529a26`. 4 tasks, about **960 changed lines**, roughly 60% tests. That is over the row's S band (< 700) because R-G1-3 (the auth bootstrap) wasn't in the row's scope, and the vet folds add about 80 test lines, but it stays under the ~1,000 cap set for this slice. No migration.

Copy `frontend/.npmrc` in before `pnpm -C frontend install` (the worktree already has both). Backend commands run from `<worktree>/backend` with the main checkout's venv: `D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner/backend/venv/Scripts/python.exe`.

**Tech stack:** FastAPI + SQLAlchemy async, pytest + aiosqlite (`backend/tests/`, factories in `tests/factories.py`) · React 19 · Zustand · Vitest + Testing Library · Playwright (local only, against a real backend; CI has no Playwright job).

**Plan-vet:** `xivrp-director`, 2026-09-30 (`.superpowers/stage2/plan-vet-guest1.md`): APPROVE-WITH-FOLDS, 0 Critical. I-1…I-7 and M-1…M-8 are folded below and tagged `(vet I-n)` / `(vet M-n)`. Owner answers are tagged `(B13)` etc. One drafter finding, the shell → person import boundary in TopBar, is tagged `(fold D-1)`.

**Parallel slices (vet M-8).** AUTHZ-2 and PROV-1 run alongside this slice.
- AUTHZ-2 edits `static_groups.py`'s duplicate hunk (`:733-909`; its `:909` call passes `OWNER`). That is separate from R-G1-2's builder, so it is unaffected.
- PROV-1 reads `dependencies.py:127` and `:158`, and this slice doesn't edit that file (vet I-3).
- All three slices edit `frontend/src/data/releaseNotes.ts`, `docs/PRODUCT_MODEL.md:250` and the HOME_STRETCH W0 table. Those edits are this slice's write-backs, so they go **last** (Finish), after a rebase onto any sibling that has merged.

**Tests first:** each implementer writes its task's listed tests first and shows them failing for the right reason before any production edit. Tests marked **(pin)** already pass on `main` by design: they guard behaviour that must not change. Run them, but don't show them failing (vet M-2). The repo's slice-loop has no `test-author` step, and its own agents take precedence over the global default.

**Evidence run (planning, 2026-09-30).** A scratch backend (`:8011`, a migrated copy of the dev DB) and frontend (`:5181`) at `c8529a26`, walked by a Playwright script as a fresh guest context, as the dev-auth applicant (a signed-in non-member), and through raw API calls. The counts in the premises table come from that run.

## Spec premises checked against the code (2026-09-30, `main` `c8529a26`)

| Row / audit cites | Code says | Ruling |
|---|---|---|
| `TopBar.tsx:167-170` renders the bell, theme and gear for everyone | **Confirmed.** `:167` bell, `:168` `ThemeToggle`, `:169` divider, `:170` `SettingsGear`; TopBar never reads `user`. Its only importer is `NewShell.tsx:37,456`, so it is **V2-only**. Probe: a guest on every V2 tab has bell 1, gear 1. **Boundary:** TopBar is in `components/layout/`, the lint's `shell` type, which may not import `components/auth/` (`person`; `eslint.config.js`, the shell rule). TopBar has no suppression for that rule (`eslint-suppressions.json` grandfathers only `Header.tsx`), so it imports page-level fragments instead, as it already does with `TierBreadcrumb` (`TopBar.tsx:30`) (fold D-1). | R-G1-4 |
| "as `NonGroupTopBar` does" (`:177-184`) | **Confirmed.** `user && (bell, divider, gear)` at `:178-183`, theme **before** the bell (`:176`); auth slot `:188` = `AuthSkeleton` (`:111-113`) before hydration, else `LoginButton` for a guest; the mobile row at `:205-219` does the same. TopBar's A12 order differs (bell before theme), so TopBar copies the gates, not the block (vet I-7). | R-G1-4 |
| Palette "Open Settings" | **Confirmed ungated** (`CommandPalette.tsx:156-164`); the palette mounts only in NewShell (`:469`). There are **two further openers the row misses:** More's "Settings" card (`components/group/MorePage.tsx:259-263` → `GroupViewContent.tsx:1181-1183`) and its "Integrations" card (`:198-202` → `GroupViewContent.tsx:1203-1205`, vet M-7). Both are ungated. `V2SettingsHost.tsx:27-44` renders the dock for any loaded group, so a guest who reaches More still gets Members with @handles. | R-G1-5 |
| No Log in in the group top bar | **Confirmed.** The AppRail footer is authed-only (`AppChrome.tsx:231-234`), and its comment defers the guest affordance to the top bar. The only guest "Log In" on a static is `JoinRequestBanner.tsx:72-83`, and only on a discoverable static that is taking requests. `login()` (`authStore.ts:278-295`) sets no `auth_redirect`, so `AuthCallback.tsx:83` lands the guest on `/`, not back on the static. | R-G1-4, R-G1-6 |
| Schedule fetches unconditionally (`Schedule.tsx:129-137`), Person card `:461-466` | **Confirmed; the lines have moved.** Sessions `:130-132`, availability `:134-138`, the batched exceptions fetch `:152-176`; the Person card is now `:464-469`. The schedule store is shell-shared and never cleared (`:127-129`). All of these routes `require_membership` (`schedule.py:770`, `:1455`, `:1932`). Probe: guest → `401 /schedule` ×2, `401 /availability` ×3, plus 2 extra `401 /auth/refresh` from `api.ts`'s reactive retry; signed-in non-member → `403` ×5. `Schedule` is V2-only (`NewShell.tsx:23,125-132`; V1 renders `ScheduleTab`). | R-G1-7 |
| "Schedule/**Loot** fetches gated on membership" | **Wrong for Loot.** Every loot read is optional-auth (`loot_tracking.py:140, :540, :605, :812, :867, :1147, :1183, :1248, :1568, :1631`). Probe: the guest Loot walk had **0** data 4xx. A3 §7 records the guest seeing Priority, Log and History read-only, "consistent with Viewer = read-only". There is nothing to gate. | R-G1-8 |
| Acceptance: "no 401s in the console" | **Not reachable within the row's scope.** On **every** guest page load (`/`, every V2 tab, legacy too) the bootstrap logs `401 GET /api/auth/me` ×2 and `401 POST /api/auth/refresh` ×1, plus three auth-store warnings (`logger.warn`, scope `auth-store`, `authStore.ts:17, :496, :526`). The path is `initializeAuth` → `fetchUser` → refresh (`authStore.ts:483-530, :589-624`; `auth.py:320-324`). Dev's StrictMode doubles the `me` call; production logs 1 + 1. The browser prints "Failed to load resource" for every 4xx, and JS can't suppress it. Agent B note 7 counted the same pattern. | R-G1-3 |
| Frontend and backend ship together | **No.** The frontend deploys on Vercel (`frontend/vercel.json`) and the backend on Railway (`railway.json`), separately. A frontend that probes `/api/auth/session` can go live before the backend serves it and get a 404 (vet I-2). | R-G1-3 |
| `get_current_user_optional` as the probe's reader | **Unsafe for a probe.** It accepts `Authorization: Bearer` and `xrp_` API keys (`dependencies.py:216-245`), and key validation commits `last_used_at` (`:102-112`): a write on a read probe, and a second key-usable whoami beside `/me` (vet I-3). | R-G1-3 |
| `by-code` (`static_groups.py:311-342`) returns `discord_username`/`discord_avatar` (`schemas/static_group.py:324-325`) | **Confirmed, and it carries more than that; the lines have moved** (`:313-344`, eager load `:329`). Each member's `user` also has `discordId`, `avatarUrl` (a CDN URL that embeds the id, `models/user.py:67-70`) and `displayName` (Discord's `global_name`, `auth.py:234, :248`). `owner` carries the owner's handle (`schemas/static_group.py:320-327`). The builder `group_to_response_with_members` (`:158-192`) also serves `GET /static-groups/{id}` (`:581-612`) to the same callers. `membership_to_response(include_user=…)` (`:114-134`) can already omit `user`, and `user`/`owner` are already Optional (`:298`, `:356`). Probe: a guest's `by-code` body has `discordUsername` ×4 (3 members + owner) and `discordId` ×3. | R-G1-1, R-G1-2 |
| "(c) if the Finder needs a contact" | **Nothing a guest uses needs a member's handle.** No surface reads `owner` from this payload: the only reader is `AdminStatics.tsx:414-426`, fed by `/admin/all`. Members' `user` is read only by V2 `Schedule.tsx:189-197` (members-only after this slice) and by V1 `ScheduleTab` → `AvailabilityGrid`, whose names come from availability responses a non-member can't fetch (`availabilityUtils.ts:96-98`). The Finder card shows the listing's opt-in contact (`FinderCard.tsx:99, :168`; `discovery.py:24-27, :99-113`), which `by-code` already ships in `settings.discovery`. Applicants give leads their own handle (`join_request.contact_discord`, `join_requests.py:637`). | R-G1-1 = **(a)** |
| (not in the row) sibling public payloads | **Same leak, more routes.** Probe, guest: `GET …/tiers/{tierId}` → `discordUsername` ×3 (`players[].linkedUser`, `tiers.py:186-216`, a serializer `GET …/tiers/{tierId}/players` (`:712`) shares), `GET …/members` ×3 (`static_groups.py:915-939`), `GET …/linked-players` ×3 (`:942-997`). Roster cards in **both** shells render `linkedUser` names and avatars (`PlayerCardStatus.tsx:133, :198-204`; `RosterCard.tsx:734-747`). The plugin reads `…/tiers/{tid}/players` **as a member** with an `xrp_` key (`RaidPlannerClient.cs:300`). | GUEST-2 (B13) |
| (not in the row) guest 401s off the Spine | Probe, V2: Tracking (`?tab=goals`) → `401 objective-goals` ×2 (`ObjectiveGoalsPanel.tsx:173`); Plugin → `401 auth/api-keys` ×2 (`ApiKeyManager.tsx:29`). Both pages render from `GroupViewContent.tsx:1160, :1241` **in both shells**, and a guest reaches them only through the palette or a typed `?tab=` (the Spine has four tabs, `Spine.tsx:17-21`). Legacy guest: Roster → `401 character-registrations` ×2 and `split-clear` ×2; Schedule → `401 schedule` and `scheduler/settings` ×2. | GUEST-2 (B14); legacy carried |
| Privacy docs name the page-load request | `pages/PrivacyDocs.tsx:543` (route `docs/privacy`, `App.tsx:192`, **both shells**) says "Find the `/api/auth/me` request"; `docs/PRIVACY.md:293` says the same. After R-G1-3 a page load issues `/api/auth/session` instead, so both would describe a request that no longer fires (vet I-4, the latent SHARED-DRIFT). `PrivacyDocs.tsx:431` and `PRIVACY.md:225, :260` name `/me` as an API endpoint and stay true. | R-G1-11 (B18) |
| Plugin contract (`CLAUDE.md` § Pitfalls) | **Untouched.** `RaidPlannerClient.cs` calls `/api/static-groups` (the list) and tier routes, never `by-code` or `/{id}` (`:211-305`). It reads `auth/me` (`Models.cs:13-18`, `discordUsername`), which this slice leaves byte-identical. `/api/auth/session` ignores `xrp_` keys (R-G1-3). | R-G1-3 |
| AUTHZ table | **No row needed.** No mutation route is added or changed: `GET /api/auth/session` is a read, and `authz_matrix.py` lists only POST/PUT/PATCH/DELETE (`:1-5`; `test_authz_matrix.py:69-75`). The completeness test in `test_authz_matrix.py` stays green and proves it. | — |
| Existing guest e2e | `e2e/smoke.spec.ts:581-605` (test 10) walks a guest to V2 Schedule and asserts `schedule-screen`, the "Schedule" heading and no "Add session". It must stay green. Its heading locator (`:598`) is a case-insensitive **substring** match in strict mode, so a second heading containing "schedule" (the `EmptyState` h3, `ui/EmptyState.tsx:28`, beside the `PageHeader` h1, `layout/PageHeader.tsx:38`) would break it (vet I-1). CI runs no Playwright. | R-G1-7, R-G1-9 |

## Owner answers (Session 5, answered 2026-10-01: every recommendation accepted)

- **Q1 → (A), a new W0 row GUEST-2 (B13).** It covers the tier payloads (`GET …/tiers/{tid}` and `…/tiers/{tid}/players`), `GET …/members` and `GET …/linked-players`. GUEST-2 strips identity on `user_role is None` **exactly**, R-G1-2's rule. A broader "not a member" test would break the plugin, which reads tier players as a member with an `xrp_` key (`RaidPlannerClient.cs:300`). Finish writes the row (§ Write-backs).
- **Q2 → yes, folded into GUEST-2 with V1 sanctioned (B14).** It covers the Tracking and Plugin guest 401s and the More ▸ Settings card, plus the More ▸ Integrations card, which the plan's Q2 missed (vet M-7). Both cards become no-ops for guests in V2 once R-G1-5 closes the dock.
- **NQ1 → yes (B18).** The `PrivacyDocs.tsx:543` and `docs/PRIVACY.md:293` text edit ships in this PR (R-G1-11).
- **NQ2 → yes (B19).** A public API-behaviour release line for `by-code` and `{id}`, phrased so it doesn't claim the privacy fix is complete (R-G1-10).

## Rulings (bind every task)

- **R-G1-1 (HS-35 #4 → (a)).** A caller who isn't a member gets **no** member's Discord identity and **no** owner block. (c) isn't needed: nothing a guest uses reads a handle from this payload, and the Finder's contact is the listing's own opt-in field (see the premises row). The row's acceptance ("the body has no `discordUsername`") also rules out (c), since the owner's handle is a `discordUsername`. *Why: owner's answer + evidence.*
- **R-G1-2 (where and for whom).** The rule goes in `group_to_response_with_members` (`static_groups.py:158`), so it covers `by-code` (`:344`) and `GET /{id}` (`:612`) together. The create and duplicate routes pass `OWNER` and are unaffected.
  - `identity = user_role is not None`. That is true for every membership role, **viewers included**, and for admins (`get_user_role_for_response` returns `OWNER` with `is_admin_access`, `permissions.py:242-267`). GUEST-2 reuses this exact test (B13).
  - When `identity` is false: `members = [membership_to_response(m, include_user=False) …]` and `owner = None`.
  - The `members` list itself stays (id, `userId`, role, `joinedAt`): V1 `ScheduleTab` counts it (`ScheduleTab.tsx:144-147`), and a `userId` is an internal UUID.
  - The schema doesn't change. Both fields are already Optional, so OpenAPI and `types/index.ts` (`user?`, `owner?`, `:683`, `:762`) need no edit.
  - A private static still refuses an anonymous caller with 403 in `check_view_permission`, before serialization.
  - *Why: one builder, one viewer rule. Fixing `by-code` alone while `/{id}` serves the same body would be cosmetic.*
- **R-G1-3 (auth bootstrap without 401s).** The acceptance's "no 401s" needs this (see the premises row).
  - **New route `GET /api/auth/session`** in `routers/auth.py`, unauthenticated, always 200, `Cache-Control: no-store`.
    - **It reads the cookie only, inside `auth.py` (vet I-3).** `token = request.cookies.get("access_token")`. If there is none, or it starts with `xrp_`, `user = None`. Otherwise `user = await _validate_jwt(token, session, request)` (imported from `..dependencies`) inside `try/except HTTPException` → `None`.
    - It never uses `get_current_user_optional`, never reads an `Authorization` header, and never validates an API key, so it writes nothing (see the premises row).
    - `dependencies.py` isn't edited: the import is read-only use, and PROV-1 owns `:127/:158`.
    - **It has no rate limit (vet I-3).** The route is undecorated, like `/me` (`auth.py:400`). `main.py:124` registers the limiter with no SlowAPI middleware, so only decorated routes are limited. Never use `RATE_LIMITS["auth"]` (10/min, `rate_limit.py:74`): a 429 would send every client to the fallback below, which is the 401 path.
    - Body: `SessionResponse { user: UserResponse | null, canRefresh: bool }` (`schemas/user.py`). `canRefresh = "refresh_token" in request.cookies` (presence only, never validated here).
    - `UserResponse` is built by one helper shared with `get_current_user_info` (`auth.py:400-420`), and `/me`'s response stays byte-identical. `auth/me` stays as it is (plugin contract).
  - **`initializeAuth`** (`authStore.ts:589-624`) sets `isLoading: true` first, so `ProtectedRoute.tsx:37-41` can't race a `fetchUser`. It then calls `fetch(API_BASE_URL + '/api/auth/session', { credentials: 'include' })`. It calls `storeCSRFTokenFromResponse(response)` (`services/api.ts:35`) on every probe response, as `/me` did through `authRequest` (`authStore.ts:245`) (vet M-1).
    - **A valid answer** is `response.ok`, a body that parses as JSON, and `typeof body.canRefresh === 'boolean'` (vet I-2). Only a valid answer takes the next three branches.
    - `user` → set `user`, `isAuthenticated: true`, then the existing proactive refresh.
    - No user and `canRefresh` → `refreshAccessToken()`. On `true` → `fetchUser()` (`/me` now 200). On `false` → `refreshAccessToken` has already decided the session (cleared on 401/403, kept on transient). Don't add a second proactive refresh on this branch: the auth rate limit is 10/min (`rate_limit.py:74`).
    - No user and no `canRefresh` → `user: null`, `isAuthenticated: false`. A stale persisted user is cleared, which is today's outcome too.
    - **Anything else → today's `fetchUser()` path, unchanged (vet I-2).** That covers any non-2xx (a **404** from a backend that hasn't shipped `/session` yet, or a 429 or 5xx), a body that doesn't parse or lacks a boolean `canRefresh`, and a network rejection. The frontend and backend deploy separately (premises row), so reading a 404 as "no session" would sign every V1 user out until the backend ships. The fallback keeps today's behaviour, including the 429 retention.
    - `isLoading: false` on every branch; `authInitialized: true` in `finally`, as today.
  - `fetchUser` itself, `handleCallback` and `ProtectedRoute` don't change.
  - The route serves both shells' bootstrap, and V1 sees no visible change: one 200 instead of the 401s, and no auth-store warnings for guests. The privacy-docs sentence that names the request is R-G1-11's.
  - *Why: only the server can see the httpOnly refresh cookie. A JS-readable hint cookie fails cross-subdomain in production, which is why `storeCSRFTokenFromResponse` exists.*
- **R-G1-4 (group top bar).** TopBar copies NonGroupTopBar's **gates**, keeping its own A12 **order** (vet I-7).
  - Two separate `user &&` blocks keep the A12 order ⌘K · invite · bell · theme · │ · settings (`TopBar.tsx:167-170`): `{user && <NotificationBell …/>}`, then `<ThemeToggle/>`, then `{user && (<>divider, <SettingsGear/></>)}`. Don't copy NonGroupTopBar's single block (`:176-183`), whose theme comes first.
  - The auth slot sits after the gear: `authLoading && !user ? <AuthSkeleton/> : !user ? <LoginButton redirectTo={pathname + search} className="text-sm px-3 py-1.5"/> : null`, with `authLoading = !useAuthHydrated() || isLoading` (vet I-7).
    - A guest never sees a wrong-affordance flash.
    - A signed-in user with a persisted `user` sees no skeleton on a cold load, so the bar has no icon shift.
    - Declared transient: a persisted user whose cookies have lapsed sees the bell and gear until the probe clears them, then Log in. NonGroupTopBar shows the same today.
  - **Boundary (fold D-1).** The slot lives in a new page-level fragment, `pages/chrome/GroupTopBarAuthSlot.tsx`, which reads the auth store and `useLocation`. TopBar imports it the way it imports `TierBreadcrumb` (`TopBar.tsx:30`). A `shell` file may not import `components/auth/`, and a new edge would fail `pnpm lint` (premises row).
  - `AuthSkeleton` moves from `NonGroupTopBar.tsx:111-113` to `components/auth/AuthSkeleton.tsx` (`data-testid="auth-skeleton"` kept) and is exported from `components/auth/index.ts`. Only `pages/chrome/` files import it (pages are exempt from the boundary rules). V1's `Header` keeps its own inline placeholder.
  - ⌘K and `ThemeToggle` stay for guests (as on NonGroupTopBar). Invite stays `canManageInvitations`-gated.
  - A signed-in user's order is unchanged (the A12 test).
  - The mobile pass is deferred to the end phase (owner rule), so there is no 390 px gate here.
  - *Why: the row says "as NonGroupTopBar", and one gate shape across both bars is easier to review; the order is TopBar's own ruled A12.*
- **R-G1-5 (Settings never opens for a guest).**
  - The palette's `open-settings` command exists only when `user` is set. `CommandPalette` reads `useAuthStore((s) => s.user)` and adds it to the `useMemo` deps.
  - `V2SettingsHost` returns `null` when `!user` (`:33`). That closes every V2 opener at once, including any stale `settingsPanelStore.open`. More's Settings and Integrations cards (`components/group/MorePage.tsx:259-263`, `:198-202`) become no-ops for guests in V2. That is the interim until GUEST-2 hides them (B14, vet M-7).
  - Both files are V2-only (importer: `NewShell.tsx:4, :19`).
  - *Why: defence in depth. The dock is the leak, and its openers are scattered.*
- **R-G1-6 (Log in comes back to the static).**
  - `authStore.login(redirectTo?: string)` writes `sessionStorage['auth_redirect']` **synchronously, before its first `set` or `await`** (vet M-3). It writes only when `redirectTo` is a string that starts with `/` and not `//` (a protocol-relative URL would leave the app) (vet M-3).
  - **Bare `login()` never reads, writes or clears `auth_redirect` (vet I-6).** Three callers set the key themselves and then call bare `login()`, and they rely on it surviving: `InviteAccept.tsx:75-76`, `PluginAuth.tsx:101-102`, and `ProtectedRoute.tsx:46` with its `<LoginButton/>` (`:79`). No caller passes `login` as a bare handler (an event object would arrive as `redirectTo`), and the string check guards that anyway.
  - `LoginButton` gains an optional `redirectTo` and calls `login(redirectTo)`.
  - Every other caller passes nothing, so their render and behaviour are byte-identical (sanctioned-neutral: an additive optional prop) (vet I-6):
    - V1: `Header.tsx:417`, `pages/Home.tsx:174`, `ProtectedRoute.tsx:79`, `JoinRequestBanner.tsx:78`, `GroupView.tsx:307`;
    - shared or V2: `JoinAction.tsx:34`, `Discover.tsx:756`, `ShellContentStates.tsx:165`, `NonGroupTopBar.tsx:188, :219`;
    - set-then-call: `InviteAccept.tsx:76`, `PluginAuth.tsx:102`.
  - The V2 top bar and the Schedule card pass `location.pathname + location.search`.
  - *Why: `AuthCallback.tsx:83` would otherwise drop the guest on `/`; precedent `InviteAccept.tsx:75`. The Finder's own case (A6-22) stays in W1.*
- **R-G1-7 (Schedule, members only; V2-only).**
  - `const isMember = group.userRole != null`. That matches `require_membership`: viewers and admins pass.
  - The sessions, availability and exceptions effects return early when `!isMember`, and so does the edit-close refetch (it can't be reached, but guard it).
  - After all hooks, `!isMember` renders `<div data-testid="schedule-screen">` with the existing `PageHeader` (smoke test 10 keeps passing) and **one** `EmptyState` (`components/ui/EmptyState.tsx`, `Lock` icon) in place of the strip and dashboard. Proposed copy, editable at PR review as long as the heading never contains "schedule":
    - heading: **"Members only"**. It has no "schedule" substring, so smoke test 10's `getByRole('heading', { name: 'Schedule' })` (`smoke.spec.ts:598`) still matches only the `PageHeader` h1 (vet I-1). `smoke.spec.ts` isn't edited.
    - guest: "Sessions and availability are shared with members of {static}. Log in to ask to join.", with the action **"Login with Discord"**, `LoginButton.tsx:30`'s label, so the top bar and the card show one label (vet M-6) → `login(pathname + search)`;
    - signed-in non-member: "Sessions and availability are shared with members of {static}. Ask a lead for an invite, or send a join request if the static is recruiting.", with no action (NewShell's `JoinRequestBanner` above it carries the request path).
  - A viewer keeps today's full screen.
  - *Why: A4 F-S9's recommendation, which needs no design decision; one card, not three false empties.*
- **R-G1-8 (Loot).** No change. Every loot read is public by design (the premises row). The e2e still walks Loot to pin it. *Why: the row's premise is wrong for Loot.*
- **R-G1-9 (acceptance scope, and what CI proves).**
  - **The e2e (local only):** `frontend/e2e/guest.spec.ts` walks `/` and the four Spine tabs (Home, Roster, Loot, Schedule) as a fresh guest context. Those are what a guest reaches from the V2 chrome. Tracking, Plugin and More are palette- or URL-only for guests and belong to GUEST-2 (B14).
  - **Baseline on `main` (vet M-5):** a guest on V2 Home and Roster makes 0 data 4xx, and Loot 0; Schedule makes 5, plus the bootstrap's 3 on every load. An empty recorder on Home, Roster and Loot is therefore R-G1-3's work alone, and on Schedule it is R-G1-3 plus R-G1-7.
  - **CI's proxies:**
    - pytest: the payload and `auth/session` contracts;
    - vitest: the top-bar gates, the palette, the host, Schedule's zero calls, and `initializeAuth` making exactly one request for a guest.
  - *Why: CI has no Playwright job, so every e2e assertion has a CI-run twin.*
- **R-G1-10 (release notes; written in Finish, last).**
  - **Version (release rule, vet M-8).** The entry's `version` is the highest `RELEASES[].version` on `origin/main` + 1 patch: **2.1.61 today**. 2.1.60 is #332's internal entry, and `CURRENT_VERSION` is still `'2.1.59'`. Never use "`CURRENT_VERSION` + 1". AUTHZ-2 and PROV-1 may take 2.1.61 first, so Finish re-reads `RELEASES[0].version` on `origin/main` before it writes the entry and again before it marks the PR ready.
  - **The entry is public (B19).** The release-level `internal` stays unset, so `CURRENT_VERSION` moves to the entry's version. The changelog suite requires that when the newest entry is public (`scripts/discord-changelog.test.js:70-79`). It holds one public item and two item-level `internal: true` items; `ReleaseNotes.tsx:90-91` hides the internal ones.
  - Release `title`: `'Static lookup API change for non-members'`. Strings are single-quoted, with `'` escaped as `\'` (Edit tool only). `pr`/`prTitle` are filled after `gh pr create`.
  - **Public `improvement` (B19):**
    - title: 'Static lookups leave out member accounts for non-members';
    - description: 'The API endpoints that look up a static by share code or by ID (GET /api/static-groups/by-code/{shareCode} and GET /api/static-groups/{id}) now return owner and each member\'s user as null when the caller isn\'t a member of the static. Members, viewers and admins, and their API keys, get the same response as before. The API docs describe the change.';
    - `link: { href: '/docs/api', label: 'API docs' }`.
    - The line describes these two endpoints' behaviour and nothing more. It must not say "private", "no longer shares/exposes", or that Discord details are protected: the tier, `/members` and `/linked-players` payloads still carry identity until GUEST-2 (B19). It is `improvement`, not `breaking`, because both fields were already optional in the schema.
  - **Internal `fix`:** "Signed-out visitors no longer trigger failed sign-in checks on every page load: the app asks a new `/api/auth/session` probe, which always answers, before it tries a refresh."
  - **Internal `improvement`:** "V2 preview: at a static, guests see Log in instead of the bell and settings gear, Open Settings leaves their command palette, and Schedule shows one members-only card instead of empty sessions and availability."
  - *Why:* API users (the API Cookbook documents key scripts) need to know two endpoints changed. V2 is admin-gated and the bootstrap is invisible, so those stay internal. The privacy statement ships with GUEST-2, the PR that closes the last payload.
- **R-G1-11 (V1 delta, stated once).**
  - **Backend:** for non-members, `members[].user` and `owner` become `null`. No V1 surface renders either for a non-member (the premises row), so the **V1-visible delta is none**. Members, viewers and admins get an identical payload.
  - **`authStore`/`LoginButton`:** these are shared. The visible delta is none (R-G1-3, R-G1-6).
  - **`ApiDocs.tsx`**, the public API docs page rendered on its own route (`docs/api`): the `by-code` and `/{id}` cards (`:601-621`, `:623-646`) gain one sentence, "`owner` and each member's `user` are `null` when the caller isn't a member." That is a sanctioned docs-accuracy edit.
  - **Privacy docs (vet I-4, B18).** These are sanctioned docs-accuracy edits, V1-visible, and the only V1-visible text change in this slice:
    - `pages/PrivacyDocs.tsx:543` (route `docs/privacy`, both shells): "Find the `/api/auth/me` request." → "Find the `/api/auth/session` request." The `<code>` styling and the next sentence ("The response should NOT contain an "email" field.") stay.
    - `docs/PRIVACY.md:293`: `# Find the /api/auth/me request` → `# Find the /api/auth/session request`.
    - `PrivacyDocs.tsx:431` and `PRIVACY.md:225, :260` name `/me` as an API endpoint and stay as they are.
  - Everything else is V2-only by importer.

## Review Focus

- **Bootstrap (Task 2):**
  - a guest makes exactly one request and logs no 401;
  - an expired access cookie with a valid refresh cookie signs in without a 401;
  - a persisted user whose cookies are gone is cleared;
  - any non-2xx (404 during deploy skew, 429, 5xx), a malformed body or a rejected probe falls back to `fetchUser()` and never logs anyone out (vet I-2);
  - the probe stores the CSRF header (vet M-1);
  - `isLoading` is true from the first tick, so `ProtectedRoute` doesn't fire a parallel `fetchUser`;
  - `authInitialized` is always set;
  - no double refresh on the `canRefresh` branch;
  - bare `login()` leaves `auth_redirect` alone, and `login(path)` writes it before any await (vet I-6, M-3).
- **Payload (Task 1):**
  - the gate is `user_role is not None`, so viewers and admins keep identity;
  - `/me` is byte-identical;
  - `auth/session` never 401s, even with a garbage access cookie;
  - it reads only the `access_token` cookie (no header, no `xrp_` key, no write) and has no `@limiter.limit` (vet I-3). The test conftest disables the limiter (`conftest.py:36`), so check this one in the diff.
- **Chrome (Task 3):**
  - no pre-hydration flash either way, and no skeleton for a persisted signed-in user (vet I-7);
  - the A12 order is unchanged for signed-in users;
  - no V2 opener reaches the dock for a guest;
  - TopBar adds no `components/auth` import (fold D-1).
- **Schedule (Task 4):**
  - no member-only request fires for a non-member on mount or on a week step, even with stale recurring sessions in the shared store (vet M-4);
  - a viewer still fetches;
  - the card heading has no "schedule" substring, so smoke test 10 stays green (vet I-1).
- **V1:**
  - `Header`, the landing page, `ProtectedRoute`, `JoinRequestBanner` and `GroupView` call `login()` exactly as before;
  - the privacy-docs sentence is the only V1-visible text change (B18).

## Task 1 — `by-code` identity rule + `GET /api/auth/session` (`xivrp-implementer`)

**Files.** Create `backend/tests/test_guest_payload.py` and `backend/tests/test_auth_session.py`. Modify `backend/app/routers/static_groups.py`, `backend/app/routers/auth.py` (it imports `_validate_jwt`; **`dependencies.py` isn't edited**, vet I-3) and `backend/app/schemas/user.py`.
**Interfaces produced:** `GET /api/auth/session` → `{ user: User | null, canRefresh: boolean }` (camelCase).

1. **Tests first:**
   - `test_guest_payload.py`. World: a **public** static with owner, lead, member and viewer, each with a distinct `discord_username` and `discord_avatar`, plus an outsider user and an admin user (`user.is_admin = True`, the pattern in `test_admin_auth.py:54-67`). For both `GET /api/static-groups/by-code/{code}` and `GET /api/static-groups/{id}`:
     - anonymous → 200; `owner` is `None`; every `members[i].user` is `None`; `len(members) == 4` with roles intact; **the raw body contains none of** `discordUsername`, `discordId`, `discordAvatar`, `avatarUrl` (the acceptance string check);
     - a signed-in outsider → the same as anonymous;
     - **(pin)** viewer, member and owner → `owner.discordUsername` and every `members[i].user.discordUsername` present;
     - **(pin)** admin (not a member) → identity present and `isAdminAccess` true;
     - **(pin)** a **private** static, anonymous → 403 (unchanged);
     - **(pin)** `POST /api/static-groups` (create) as owner → identity present.
   - `test_auth_session.py`:
     - no cookies → 200 `{"user": None, "canRefresh": False}` and `Cache-Control` contains `no-store`;
     - a `refresh_token` cookie only (`create_refresh_token`) → `canRefresh` true, `user` null;
     - a valid `access_token` cookie → `user.id` matches and the keys equal `/api/auth/me`'s keys;
     - a garbage access cookie → 200 with user null (never 401);
     - (vet I-3) `Authorization: Bearer xrp_…`, a real key created as `test_api_keys.py:16` does, with no cookie → 200 with `user` null, and the key's `last_used_at`, read from the DB before and after, is unchanged;
     - (vet I-3) an `access_token` **cookie** whose value is that `xrp_` key → `user` null, and `last_used_at` is unchanged;
     - (vet I-3) `Authorization: Bearer <valid access JWT>` with no cookie → `user` null (cookie only);
     - **(pin)** `/api/auth/me` with the same valid cookie → the same body as before the change (pin the key set).
   - Show both files' non-pin tests failing (`by-code` returns identity; `/session` 404).
2. Implement R-G1-2 and the backend half of R-G1-3.
3. **Gates.** From `<worktree>/backend`:
   - `<venv python> -m pytest tests/test_guest_payload.py tests/test_auth_session.py tests/test_static_groups.py tests/test_httponly_cookies.py tests/test_api_keys.py tests/test_authz_matrix.py -q`, then `-m pytest tests/ -q` (paste the count);
   - `venv/Scripts/ruff.exe check` on the touched files (0 new).

**Acceptance:** the anonymous `by-code` body has no `discordUsername`; `/session` is 200 for every cookie state, ignores headers and keys, and writes nothing; the authz completeness test is green with no new row.

## Task 2 — auth bootstrap + `login(redirectTo)` (RISKIEST · `xivrp-implementer-deep`, `model: fable`)

**Files.** Modify `frontend/src/stores/authStore.ts`, `frontend/src/components/auth/LoginButton.tsx` and `frontend/src/stores/authStore.initializeAuth.test.ts`. That test file is pre-authorized: its three existing tests mock `/api/auth/me` as the first fetch, so they are rewritten for the probe-first sequence, each keeping its intent (cookie session hydrates; no session still initializes; 429 retains a persisted user). The third (`:125-157`) becomes the `canRefresh` + refresh-429 case below (vet M-2). Create `frontend/src/components/auth/LoginButton.test.tsx` and `frontend/src/stores/authStore.login.test.ts`.
**Consumes:** Task 1's `/api/auth/session`. **Produces:** `login(redirectTo?)` and `<LoginButton redirectTo?>`.

1. **Tests first** (fetch stubbed, fake timers as in the existing file):
   - **Guest:** the session probe returns `{user:null, canRefresh:false}` → `fetch` is called **exactly once**, with `/api/auth/session`; never with `/api/auth/me` or `/api/auth/refresh`. Then `user` null, `isAuthenticated` false, `authInitialized` true.
   - **Cookie session:** the probe returns a user → user set, then the one proactive refresh (2 calls total, the second `/api/auth/refresh`).
   - **Expired access:** the probe returns `{null, canRefresh:true}` → refresh 200 → `/me` 200 → user set; **no `/me` call precedes the refresh**, and there is no third refresh.
   - **Lapsed refresh:** `canRefresh:true`, refresh 401 → user cleared.
   - **Refresh rate-limited (vet M-2), the successor of `:125-157`:** a persisted user, then the probe returns `{null, canRefresh:true}` and the refresh returns 429. The persisted user is kept, `isLoading` is false, `authInitialized` is true, and there are exactly 2 calls (`/session`, `/refresh`).
   - **A persisted user, no cookies:** the probe returns `{null,false}` → the persisted user is cleared.
   - **Deploy skew (vet I-2):** the probe returns **404**, then `/me` 200 → the user is set (a signed-in user survives a frontend that ships first). A second case: the probe 404s with a persisted user, `/me` 401s and the refresh 429s → the persisted user is kept.
   - **Malformed answer (vet I-2):** the probe returns 200 with `{}` (no `canRefresh`), and separately 200 with a non-JSON body → both fall back to `/me`.
   - **The probe 429s or rejects** → falls back to `/me` (today's path), and the 429-retention case keeps the persisted user.
   - **CSRF (vet M-1):** the guest probe's response carries `X-CSRF-Token: t1` → afterwards `getCSRFToken()` (`services/api.ts`) returns `t1` (jsdom has no csrf cookie).
   - **(pin)** `isLoading` is true synchronously after `initializeAuth()` starts (true on `main` through `fetchUser`, `authStore.ts:485`; it must stay true).
   - **`authStore.login.test.ts`** tests the store directly; a mocked `login` never writes `sessionStorage` (vet M-3). Leave the `/api/auth/discord` fetch pending:
     - `login('/group/ABC?tab=schedule')` → `sessionStorage.auth_redirect` equals it **synchronously**, asserted before any `await`;
     - `login('https://evil.example/x')` and `login('//evil.example')` → `auth_redirect` is not written;
     - (vet I-6) `auth_redirect` preset to `/invite/XYZ`, then bare `login()` → it is still `/invite/XYZ`.
   - **`LoginButton`** (store mocked): with `redirectTo="/group/ABC?tab=schedule"`, a click calls `login` with that string. **(pin)** Without the prop, a click calls `login` with no argument (V1 parity).
2. Implement R-G1-3 (frontend) and R-G1-6.
3. **Gates:**
   - `pnpm -C frontend test src/stores/authStore src/components/auth`, then the full `pnpm -C frontend test`;
   - `pnpm -C frontend build`;
   - `pnpm -C frontend lint` (0 errors; warnings ≤ main's).

**Ad hoc mutation checks (execute and paste):**
- Route the guest branch through `fetchUser()` → the guest test fails (it sees `/me`).
- Drop the `canRefresh` branch → the expired-access test fails (the user stays null).
- Treat a non-OK probe as "no session" → the 429-retention test **and** the 404 deploy-skew test fail (vet I-2).
- Drop the `typeof canRefresh === 'boolean'` check → the `{}`-body test fails (vet I-2).
- Make bare `login()` remove `auth_redirect` → the preset test fails (vet I-6).

**Acceptance:** a guest's bootstrap is one 200 request in vitest, a 404 or malformed probe changes nothing for anyone, and every pre-existing intent of the initializeAuth suite still holds.

## Task 3 — V2 chrome: top bar, palette, settings host (`xivrp-implementer`)

**Files.**
- Create `frontend/src/components/auth/AuthSkeleton.tsx` and export it from `components/auth/index.ts`.
- Create `frontend/src/pages/chrome/GroupTopBarAuthSlot.tsx`, R-G1-4's slot (fold D-1).
- Modify `components/layout/TopBar.tsx` (it imports the slot from `pages/chrome/`, never `components/auth`), `pages/chrome/NonGroupTopBar.tsx` (import only), `components/layout/CommandPalette.tsx` and `pages/V2SettingsHost.tsx`.
- Tests: extend `components/layout/TopBar.test.tsx`, `components/layout/CommandPalette.test.tsx` and `pages/V2SettingsHost.test.tsx`.
- **Pre-authorized test edits** (set a signed-in user in setup only, assertions unchanged): `TopBar.test.tsx`'s shared render helper (the tests at `:112` and `:130` assert bell and gear); `CommandPalette.test.tsx` T3-a2 (`:318-328`, which relies on "settings" matching "Open Settings" while the suite's `beforeEach` sets `user: null` at `:76`).

All edits are **V2-only** by importer: TopBar, CommandPalette and V2SettingsHost are imported only by NewShell; NonGroupTopBar only by AppChrome; the new slot only by TopBar.

1. **Tests first:**
   - TopBar, guest (hydrated, `user: null`): no `/^Notifications/` button, no "Settings" button, a "Login with Discord" button inside the header, ⌘K and "Toggle theme" present.
   - **(pin)** TopBar, signed-in: bell and gear present, no Login, and the A12 order is unchanged.
   - TopBar, pre-hydration or `isLoading`, with `user: null` **set explicitly** (vet I-7): `auth-skeleton` present, with neither Login nor bell/gear.
   - TopBar, pre-hydration or `isLoading`, with a persisted `user` (vet I-7): bell and gear present in A12 order, **no** `auth-skeleton`, no Login.
   - TopBar, guest Login click: `login` receives the rendered route's path + search (MemoryRouter `initialEntries`). If the test uses the real store with `fetch` left pending, it may assert `sessionStorage.auth_redirect` instead; never assert `sessionStorage` behind a mocked `login` (vet M-3).
   - CommandPalette: a guest typing "settings" gets "No commands found."; a signed-in user gets "Open Settings".
   - V2SettingsHost with `user: null` renders nothing, even with `settingsPanelStore` open.
   - `Layout.chrome.test.tsx` and `pages/chrome/NonGroupTopBar.test.tsx` stay green (NonGroupTopBar's `auth-skeleton` testid is unchanged).
2. Implement R-G1-4 and R-G1-5.
3. **Gates:**
   - `pnpm -C frontend test src/components/layout src/pages/V2SettingsHost.test.tsx src/pages/chrome`, then the full suite;
   - `pnpm -C frontend build`;
   - `pnpm -C frontend lint`: 0 errors, and no new `boundaries/dependencies` error or suppression (fold D-1);
   - `pnpm -C frontend check:design-system:strict`.

**Acceptance:** a guest's V2 group top bar has Log in and no bell, gear or Settings path. A signed-in user's bar is unchanged, cold load included.

## Task 4 — V2 Schedule members-only card, guest e2e, API and privacy docs (`xivrp-implementer`)

**Files.**
- Modify `components/schedule/Schedule.tsx` (+ `Schedule.test.tsx`) and `pages/ApiDocs.tsx` (R-G1-11's sentence on two cards).
- Modify `pages/PrivacyDocs.tsx:543` and `docs/PRIVACY.md:293` (R-G1-11, vet I-4, B18; text only).
- Create `frontend/e2e/guest.spec.ts`.
- **Not** `data/releaseNotes.ts`: the release entry is a Finish write-back (R-G1-10, vet M-8).

Schedule is V2-only.

1. **Tests first** (`Schedule.test.tsx`; the fixture at `:92` is `userRole: 'owner'`, so the existing tests stay as they are):
   - **Seed first (vet M-4).** Before render, put a stale recurring session (`isRecurring: true` with a `recurrenceRule`) in the schedule store. The store is shell-shared and never cleared (`Schedule.tsx:127-129`). Without the seed the exceptions effect returns early on zero recurring ids (`:152-176`), and the `fetchExceptions` assertion passes trivially.
   - `{...group, userRole: null}` with `currentUserId: null`:
     - `fetchSessions`, `fetchAvailability` and `fetchExceptions` are **never** called (spies on the store actions, after `await` of queued work);
     - `schedule-screen` and the "Schedule" `PageHeader` heading render;
     - the heading "Members only" renders;
     - **exactly one** heading matches `/schedule/i`, the CI twin of smoke test 10's strict-mode locator (vet I-1);
     - a "Login with Discord" button renders (vet M-6);
     - there is no "Add session", no heatmap and no "Your availability".
   - Clicking the guest's "Login with Discord" calls `login` with the path + search.
   - `userRole: null` with a `currentUserId` (a signed-in non-member), same seed → the same card with **no** action button, and still zero fetches.
   - **(pin)** `userRole: 'viewer'` → `fetchSessions` and `fetchAvailability` are called, as today.
   - **`e2e/guest.spec.ts`** (local). Its header comment says: "CI has no Playwright job; run against dev-auth servers". It also states R-G1-9's `main` baseline (vet M-5).
     1. A throwaway context calls `loginAsOwner`, so DEVTST is public.
     2. A fresh guest context records every response with status 401 or 403. It also records every console `error` that mentions 401, 403, Unauthorized or `auth-store`, and every console `warning` that mentions `auth-store` (the bootstrap's `logger.warn` lines, `authStore.ts:496, :526`) (vet M-5).
     3. It visits `/`, then `/group/DEVTST?shell=v2` and `switchTab` Home → Roster → Loot → Schedule.
     4. Inside `chrome-topbar-slot`: "Login with Discord" is visible, and there is no `/^Notifications/` and no "Settings".
     5. It opens the palette with `page.keyboard.press('ControlOrMeta+K')` or a click on the "Command palette" button (vet M-5), types "settings" and sees "No commands found."
     6. Schedule shows "Members only".
     7. At the end, both recorders are **empty**.
     8. `guestCtx.request.get(API_BASE + '/api/static-groups/by-code/DEVTST')`: the body text has no `discordUsername` and no `discordId`. The owner context's same request **does** contain `discordUsername` (members keep it).
     9. Run it against local servers and paste the output, along with `smoke.spec.ts` test 10.
2. Implement R-G1-7, then the ApiDocs sentence, then the PrivacyDocs and `PRIVACY.md` text (R-G1-11).
3. **Gates:**
   - `pnpm -C frontend test src/components/schedule`, then the full suite;
   - `pnpm -C frontend build`;
   - `pnpm -C frontend lint`;
   - `pnpm -C frontend check:design-system:strict`;
   - `pnpm -C frontend test:e2e -- e2e/guest.spec.ts e2e/smoke.spec.ts` (local, paste);
   - `git grep -n "auth/session" -- frontend/src/pages/PrivacyDocs.tsx docs/PRIVACY.md` shows both edits.

**Acceptance (the row's):**
- Guest e2e: no bell, no gear, Log in visible, no 401s in the console, and the `by-code` body has no `discordUsername`.
- CI twins: Tasks 1–4 vitest/pytest.

## Finish (controller)

- **Browser walk** (dev-auth; recipe in memory `feedback_browser_validation_process`). The servers are background tasks per `CLAUDE.md` § Commands. Use DevTools' console and network panels.
  - **Guest:** a fresh profile on `/`, then `/group/DEVTST?shell=v2` and all four Spine tabs. Expect 0 × 4xx and no auth-store warnings. Expect Log in in the top bar. On Schedule, expect the card. After Log in → Discord, expect to return to the static. Dev-auth can't follow the OAuth leg, so check that `auth_redirect` is set.
  - **Signed-in non-member:** `/api/dev-auth/login/2`, the applicant. V2 Schedule shows the card with no action and fires no 403s. Bell and gear are present, per R-G1-4's `user` rule.
  - **Member:** `/login/1`, in V2 and legacy. Bell, gear and Schedule are unchanged, and the `by-code` response in the network panel still carries `discordUsername`. Then block `/api/auth/session` in DevTools' request blocking and reload: the member stays signed in through the fallback (vitest covers the 404 case) (vet I-2).
  - **Legacy guest:** the bootstrap 401s are gone. Legacy's own data 401s (`character-registrations`, `split-clear`, `schedule`, `scheduler/settings`) remain and are recorded in the PR body as carried (V1 is frozen).
  - **Privacy docs:** `/docs/privacy` names `/api/auth/session`, and that request is in the network panel (B18).
  - Shots go to `docs/redesign/pr-shots/guest1-*`, shrunk: the guest top bar, the guest Schedule card, the non-member Schedule card and the member top bar (unchanged). There are no token changes, so dark mode only.
- **Then, in this order (write-backs last, vet M-8):**
  1. `git fetch origin`. If AUTHZ-2 or PROV-1 has merged since `c8529a26`, rebase onto `origin/main` and re-run the slice-loop §5 gates.
  2. `pr-checklist`, then the release entry per R-G1-10. Its version is the highest `RELEASES[].version` on `origin/main` + 1 patch, and `CURRENT_VERSION` is set to the same string. Then run `npm test` in `scripts/` (the changelog suite).
  3. The slice-loop §5 gates, then `gh pr create --draft`, then the release note's `pr`/`prTitle`. The PR body lists R-G1-1…R-G1-11, the evidence run, the folds (vet I-1…I-7, M-1…M-8, D-1, B13/B14/B18/B19) and the carried items below.
  4. The write-backs below, in one commit.
  5. Before marking ready: `git fetch` and re-read `RELEASES[0].version` on `origin/main`. If a sibling has taken the version, rebase, renumber the entry and `CURRENT_VERSION`, re-run the changelog suite, and re-check the HOME_STRETCH and PRODUCT_MODEL rows for conflicts.

## Write-backs (one commit on the draft, after `gh pr create`)

These are **unconditional** (vet I-5). They record GUEST-1's real scope, and they never mark it wider than the text below.

- **HOME_STRETCH §6.3 W0, the GUEST-1 row (`:368`).** Replace the Scope and Gate cells with the text below. The Acceptance cell stays as it is; the Gate cell records how far it was met.

  ```
  Scope: Bell, gear and palette "Open Settings" gated on `user` (as `NonGroupTopBar`); `LoginButton` in the group top bar; Schedule fetches gated on membership with one honest members-only card (Loot reads are public by design); the `by-code` and `GET /static-groups/{id}` payloads omit members' and the owner's Discord identity for non-members (§6.5 #4 → (a)); the auth bootstrap asks `GET /api/auth/session` first, which removed the bootstrap 401s the acceptance counted

  Gate: **Gate** — ✅ #<n>, met on `/` and the four V2 Spine tabs (Home, Roster, Loot, Schedule) only. Identity is removed from `by-code` and `GET /{id}` only; the tier, `/members` and `/linked-players` payloads → GUEST-2. Tracking and Plugin guest 401s and the More ▸ Settings / Integrations cards → GUEST-2. Legacy guest data 401s carried (V1 frozen)
  ```
- **HOME_STRETCH §6.3 W0: add the GUEST-2 row directly under GUEST-1 (B13, B14).** Paste it verbatim:

  ```
  | **GUEST-2** sibling guest payloads + guest 401s off the Spine | Members' Discord identity (`discordUsername`, `discordId`, `discordAvatar`, `avatarUrl`, `displayName`) stripped when `user_role is None` **exactly**, GUEST-1's builder rule, from `GET …/tiers/{tid}` and `GET …/tiers/{tid}/players` (`players[].linkedUser`, `tiers.py:186-216`), `GET …/members` (`static_groups.py:915-939`) and `GET …/linked-players` (`:942-997`); never a broader test, since the plugin reads `…/tiers/{tid}/players` as a member with an `xrp_` key (`RaidPlannerClient.cs:300`). Roster cards in both shells render a guest's view without linked identity (`PlayerCardStatus.tsx:133, :198-204`; `RosterCard.tsx:734-747`), the rendering ruled in its plan. Tracking's objective-goals fetch gated on membership (`ObjectiveGoalsPanel.tsx:173`); Plugin shows a Log in prompt instead of the key manager for guests (`ApiKeyManager.tsx:29`); More ▸ Settings and More ▸ Integrations hidden for guests (`components/group/MorePage.tsx:259-263`, `:198-202`). Both shells, sanctioned V1 (B14). Evidence (GUEST-1 plan): each route returned 3 handles to a guest; Tracking `401 objective-goals` ×2, Plugin `401 auth/api-keys` ×2 | pytest: anonymous and signed-in-outsider bodies on the four routes have no `discordUsername`/`discordId`; member, viewer, admin and a member's `xrp_` key keep them (plugin contract). Guest e2e on Tracking, Plugin and More: no 401s, no Settings or Integrations card. The public privacy release line ships here | S | GUEST-1 | **Gate** (P0 privacy, completes §6.5 #4; owner 2026-10-01) |
  ```
- **HOME_STRETCH §6, "New work with no §4 item" (`:501`):** add GUEST-2 after GUEST-1.
- **HOME_STRETCH §6.5 #4 (`:512`):** append "(a), ruled R-G1-1 in GUEST-1: nothing a guest uses needs a handle; the Finder uses the listing's opt-in contact. Sibling payloads → GUEST-2."
- **`docs/PRODUCT_MODEL.md` §6.1, the W0 row (`:250`).** Insert before "the rest ⬜": "GUEST-1 (guest top bar and palette, the V2 Schedule members-only card, the `/api/auth/session` bootstrap, member identity off `by-code`/`{id}`) ✅ #<n>, with GUEST-2 (the sibling payloads and the guest 401s off the Spine) ⬜;". AUTHZ-2 and PROV-1 edit this row too, so rebase first (Finish step 1).

## Carried, not GUEST-1

- **GUEST-2** (B13, B14): the row Finish writes. It covers the tier/members/linked-players identity, the Tracking and Plugin guest 401s, and More ▸ Settings and More ▸ Integrations for guests. The public privacy release line ships with it.
- **The legacy guest data 401s** listed in Finish: V1 is frozen. They go away with V1 at R2, unless the owner sanctions a V1 fix.
- **Who sees static Settings when signed in but not a member:** the row gates the gear on `user`, which matches V1. DA 15's Settings page ("guests see none") is where that is decided.
- **The Finder's "Log in to join" return (A6-22):** W1.
- **The group top bar with Log in at 390 px:** the end-phase mobile pass.
