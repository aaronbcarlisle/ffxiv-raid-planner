# GUEST-2 · Sibling guest payloads + guest 401s off the Spine (W0)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** nobody outside a public static receives its members' Discord identity from any route, and a guest who reaches Tracking, Plugin or More by URL or palette gets honest pages and a quiet console.
- Every guest-reachable GET that carried a member's Discord identity drops it for a caller with no role: the tier and tier-players payloads, `/members`, `/linked-players`, and the four loot-history reads. An unpublished recruiting-listing contact also leaves `by-code` and `GET /{id}` (vet I-1).
- Tracking shows non-members one members-only card and makes no member-only request. Plugin asks a guest to log in instead of loading the key manager. More hides Settings and Integrations from guests.
- The public privacy release line ships. With GUEST-1, §6.5 #4 is complete.

**Spec (binding):** `design/redesign/HOME_STRETCH.md` §6.3 W0, the **GUEST-2** row (`:371`), and §6.5 #4 (`:515`, answered (a)). Also binding: GUEST-1's R-G1-2 builder rule (`static_groups.py:159-187`), `CLAUDE.md` § UI rules, § Product rules and § Pitfalls (the plugin contract), and the owner's Session 5 answers **B13** (the exact `user_role is None` test) and **B14** (both shells, V1 sanctioned) (`.superpowers/stage2/working-notes.md` § Session 5). Owner ruling 2026-10-01 (this session): the #343 residual is resolved by moving Schedule's guest Log in into `EmptyState`'s `action` (R-G2-4).

**Slice:** one slice, one PR. Branch `feat/w0-guest2-guest-payloads`, worktree `.claude/worktrees/guest1` (detached and clean after #343, reused, and no other session uses it), base `main` `def04893`. 3 tasks, about **1,100 changed lines**, roughly 65% tests. That is over the row's S band (< 700) because R-G2-1 folds four loot routes the row missed and R-G2-12 adds the listing contact (vet I-1). It stays under the ~1,500 cap. No migration. The PR body puts R-G2-1 and R-G2-12 first, so the owner can split them out (vet M-15).

Backend commands run from `<worktree>/backend` with the main checkout's venv: `D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner/backend/venv/Scripts/python.exe`. Set `FRONTEND_URL=http://localhost:5174` for the full suite (`test_config_validation`). The frontend's `node_modules` and `.npmrc` are already in place.

**Tech stack:** FastAPI + SQLAlchemy async, pytest + aiosqlite (`backend/tests/`, factories in `tests/factories.py`) · React 19 · Zustand · Vitest + Testing Library · Playwright (local only, against a real backend; CI has no Playwright job).

**Plan-vet:** `xivrp-director`, 2026-10-01: APPROVE-WITH-FOLDS, 0 Critical. I-1, I-2 and M-1…M-15 are folded below and tagged `(vet I-n)` / `(vet M-n)`. I-1 is folded as its option (a), R-G2-12.

**Parallel slices.** None open. PROV-1's #346 merged (`def04893`, 2.1.63, internal) and this branch is fast-forwarded onto it. Its key-set pins include `createdByUsername` (`test_write_provenance.py:79`, `:94`, `:110`), so Task 1's gate runs them (vet M-8). `releaseNotes.ts`, `HOME_STRETCH.md` and `PRODUCT_MODEL.md` are this slice's write-backs and still go **last** (Finish), after merging `origin/main` again if anything has landed.

**Tests first:** each implementer writes its task's listed tests first and shows the non-pin ones failing for the right reason before any production edit. Tests marked **(pin)** already pass on `main` by design and guard behaviour that must not change: run them, but don't show them failing. The repo's slice-loop has no `test-author` step, and its own agents take precedence over the global default.

## Spec premises checked against the code (2026-10-01, `main` `0a3ff5d3`; re-checked on `def04893`, which touched only `collection_goals.py` among the cited code)

| Row / cite | Code says | Ruling |
|---|---|---|
| The four routes leak identity | **Confirmed, and there are 8, not 4.** Every guest-reachable GET was swept (all of `routers/`, plus the `MemberInfo`/`OwnerInfo`/`LinkedUserInfo` builders in `services/`). The row's four: `GET …/tiers/{tid}` (`tiers.py:417`) and `…/tiers/{tid}/players` (`:712`), both through `player_to_response`'s `linked_user` (`:186-196`, called at `:281` and `:756`); `GET …/members` (`static_groups.py:931`, `membership_to_response` `:115-134`); `GET …/linked-players` (`:958-1012`, `LinkedUserInfo` `:1001-1007`). HOME_STRETCH's `:915-939` / `:942-997` predate GUEST-1 (vet M-9). **Four more:** `GET …/tiers/{tid}/loot-log` (`loot_tracking.py:132`, `created_by_username` `:190`), `GET …/tiers/{tid}/page-ledger` (`:637`, `:692`), `GET …/tiers/{tid}/players/{pid}/page-ledger` (`:930`, `:989`), `GET …/tiers/{tid}/material-log` (`:1306`, `:1361`). Each emits `createdByUsername`, which is the logger's **raw `discord_username`**. All eight are `get_current_user_optional` + `check_view_permission`. Everything else a guest can reach is clean: `GET …/tiers` (no players), `…/gear`, `weekly-assignments`, `current-week`, `weeks-*`, `page-balances`, `material-balances`, `priority`, `invitations/{code}`, `discovery/statics`, the player share profile, `character-registrations` (character data only) and `split-clear` (names only). Collection goals, mount farms, schedule, objective goals, suggestions and join requests are all members-only. | R-G2-1 |
| "`user_role is None` **exactly**, GUEST-1's builder rule" | `check_view_permission` (`permissions.py:333-387`) returns a `Membership` for every member (viewers included), a virtual admin membership for admins (`:357-360`), and `None` only for a public static's anonymous or non-member caller. A private static's non-member never gets that far (`:369-384`, 403). Today the eight routes discard that return value (`tiers.py:429`, `:725`; `static_groups.py:953`, `:970`; `loot_tracking.py:148`, `:653`, `:941`, `:1322`). `get_user_role_for_response` (`:242-267`) returns a role for exactly the same callers (membership role, or `OWNER` for an admin). So `membership is not None` ⇔ `user_role is not None`, with no extra query. | R-G2-2 |
| Plugin reads tier players as a member | **Confirmed.** `RaidPlannerClient.cs:300` GETs `…/tiers/{tid}/players`, and `:263`/`:271` **POST** `loot-log`/`material-log`; it never GETs a loot read. `Models.cs:16`'s `discordUsername` belongs to the `auth/me` user model. The plugin's `SnapshotPlayerSummary` reads only `id`, `name` and `userId` (`Models.cs:177-182`), so it reads neither `linkedUser` nor `createdByUsername`, and `userId` stays: **the plugin is unaffected under any gate.** `get_current_user_optional` accepts `Bearer xrp_…` (`dependencies.py:216-245`), so a member's key resolves to that member and keeps identity under R-G2-2. That pin protects API-script consumers (ApiDocs, the API Cookbook), not the plugin (vet). | R-G2-2 |
| Schemas | `MembershipResponse.user` is already Optional (`schemas/static_group.py:298`), and so is `SnapshotPlayerResponse.linked_user`. `LinkedPlayerInfo.user` is **required** (`schemas/tier_snapshot.py:134`). `created_by_username: str` is **required** in three schemas (`schemas/loot_tracking.py:98`, `:133`, `:212`), mirrored as `createdByUsername: string` in `types/index.ts:1295`, `:1312`, `:1343`. **No UI reads `createdByUsername`.** Its only frontend mentions are the types and `ApiDocs.tsx` examples (`:1076-1291`). | R-G2-2 |
| `/members` and `/linked-players` readers | `MembersPanel.tsx:66-67`, `:110` (Settings ▸ Members), `ViewAsBanner.tsx:54-58` (admin, View As) and `AdminStatics.tsx:182-186` (admin). **MembersPanel does run for non-members (vet I-2).** V1 mounts the settings host for anyone viewing the static (`GroupView.tsx:405-406`), the Members tab is `visible: () => true` (`SettingsPanel.tsx:64`), and V2's host checks only `!user` (`V2SettingsHost.tsx:35`). So a V1 guest who opens legacy Settings, and a signed-in outsider in either shell, see every member's handle and avatar today (`MembersPanel.tsx:198-215`). `MembersPanel` skips a member whose `user` is null (`:178-179`), keeps the header count at `members.length` (`:174`), and reads `lp.user.id` unguarded (`:73`, `:111`). | R-G2-2, R-G2-11 |
| `by-code` / `GET /{id}` `settings` (vet I-1) | `settings` is serialized unredacted (`static_groups.py:195`), and `discovery` is an untyped dict (`schemas/static_group.py:224`) holding `contactMethod` and `contactValue`. Method `discord` is labelled "Discord username" (`DiscoveryTab.tsx:124`, saved at `:858`). So a guest gets a lead's Discord contact even while the listing is off. The Finder publishes the contact only for a listed static (`is_discoverable`, `services/discovery_settings.py:49-55`). No guest UI reads the contact from `by-code`: `FinderCard.tsx:99` and `Discover.tsx:686` read the discovery API, and `DiscoveryTab.tsx:748` is leads-only. The other settings fields (loot priority, banners, sync, `split_clear_mode`) carry no identity. | R-G2-12 |
| Roster cards render `linkedUser` (`PlayerCardStatus.tsx:133, :198-204`; `RosterCard.tsx:734-747`) | **Confirmed, moved.** V1 `PlayerCardStatus` (V1 only, via `PlayerCard.tsx:917`): its badge needs `isLinkedToOther && linkedUser` (`:125`, `:197`), so a claimed card with `linkedUser` null shows no badge. V2 `RosterCard.renderClaimStatus` (`:700-770`, V2 only): `!player.userId` → "Unclaimed"; own → "You"; `linkedUser` → avatar + "Claimed by …"; otherwise a muted `Claimed` tag (`:766-770`), the existing fallback for a missing `linked_user`. Every unclaimed check in the app keys on `player.userId`, never on `!linkedUser`. | R-G2-3 |
| Tracking's objective-goals fetch (`ObjectiveGoalsPanel.tsx:173`) | **Confirmed, and Farms also 401s.** `:171-173` fetches unconditionally (`objectiveGoalStore.ts:91`). `objective_goals.py:59-70` requires membership. The Farms sub-tab (`?goal=farms`) mounts `CollectionsHub`, whose `fetchGoals` (`CollectionsHub.tsx:76-77`, `collectionGoalStore.ts:443`) and `fetchParticipants` hit members-only routes (`collection_goals.py:184-187`). Both mount from `GoalsPage.tsx:46-56`, which `GroupViewContent.tsx:1160-1173` renders for `?tab=goals` in **both shells** (titled "Tracking" in V2 and "Goals & Farms" in V1). `GoalsPage` takes no role or name. | R-G2-5 |
| Plugin's key manager (`ApiKeyManager.tsx:29`) | **Confirmed.** `:28-30` → `GET /api/auth/api-keys` (`apiKeyStore.ts:53`), which needs a signed-in user (guest 401; a signed-in non-member gets 200). `PluginPage.tsx:88-99` wraps it in the "Your API keys" box, rendered at `GroupViewContent.tsx:1241-1246` in **both shells**. The page's other parts (install steps, `GearSyncDashboard`) make no authed request. `UserMenu.tsx:50` also mounts `ApiKeyManager`, but only for signed-in users. | R-G2-6 |
| More ▸ Settings / Integrations (`MorePage.tsx:259-263`, `:198-202`) | **Confirmed.** Integrations `:196-222`, Settings `:259+`, both ungated. `MorePage` doesn't read the auth store. It renders only from `GroupViewContent.tsx:1180-1238`, in **both shells**. Danger Zone is already `isMember`-gated (`:357`). After GUEST-1, V2's dock is closed to guests (`V2SettingsHost` returns null for `!user`), so in V2 these cards are dead buttons. In V1 they open the legacy settings for a guest. | R-G2-7 |
| #343 residual (Schedule's Log in) | `Schedule.tsx:433-447`: an `EmptyState` (Lock, "Members only") followed by `{!currentUserId && <div className="flex justify-center -mt-6 pb-8"><LoginButton redirectTo=…/></div>}`. `EmptyState`'s `action` is `{ label: string; onClick: () => void }` and renders `<Button variant="primary" size="md">` (`ui/EmptyState.tsx`), so it carries no Discord glyph. `login(redirectTo?: string)` (`authStore.ts:220`). `Schedule` is V2-only (`NewShell.tsx:23`). | R-G2-4 |
| Lint boundaries | `components/auth/` = `person`, `components/settings/` = `settings`, `components/group/` and `components/static-group/` = `ring0`, `components/schedule/` = `ring1` (`eslint.config.js:51-61`). Neither `person`/`settings` (`:128`) nor `ring0` (`:133`) is barred from importing `person`, so `GoalsPage`, `PluginPage` and `MorePage` may import `../auth/…`. `Schedule.tsx:20` already does. `@/` aliases are banned in `components/` (`:292-300`). | R-G2-4…7 |
| Guest e2e | `e2e/guest.spec.ts` is one test: a fresh guest context, `denied[]` (401/403 responses) and `consoleNoise[]` recorders, `/` then the four Spine tabs via `switchTab`, the top-bar, palette and Schedule checks, then a raw `by-code` body check. Its header defers Tracking, Plugin and More to GUEST-2. Tab ids: `?tab=goals|plugin|more` (`useGroupViewState.ts:207`), sub-tab `?goal=objectives|farms`, shell pin `pinShell(page, 'v2' \| 'legacy', path)` (`e2e/helpers/auth.ts:99`). | R-G2-8 |
| Privacy docs | `docs/PRIVACY.md:201-228` and `pages/PrivacyDocs.tsx:460+` (route `docs/privacy`, both shells) each hold a "Privacy Changes History". Neither says what a share-code visitor sees of members, so nothing becomes false. The history is where a privacy change is announced. | R-G2-9 |
| AUTHZ table | **No row needed.** No mutation route is added or changed (`authz_matrix.py` lists only writes). The completeness test stays green. | — |

## Rulings (bind every task)

- **R-G2-1 (scope: eight routes).** The four loot-history reads are folded in.
  - The row's purpose is to complete §6.5 #4, and its release line is a privacy statement, so it has to be true. `createdByUsername` is a raw Discord handle on routes any share-code visitor can call (premises row).
  - The cost is about 120 lines, mostly tests. Without it, GUEST-2 ships a false statement or a GUEST-3.
  - *Cost if wrong:* the slice runs ~350 lines over S; the owner could re-split at review.
- **R-G2-2 (the rule, and where it goes).**
  - In each of the eight routes: `membership = await check_view_permission(session, group, current_user)`, then `identity = membership is not None`. That is equivalent to R-G1-2's `user_role is not None` (premises row) and costs no query. **Never** a broader test: a member's `xrp_` key must keep identity, for API-script consumers (the plugin reads only `userId` and is unaffected either way; premises row).
  - **Tier payloads.** `player_to_response(player, membership_role=None, *, include_identity: bool = True)`: when `include_identity` is false, `linked_user = None`. `snapshot_to_response_with_players(snapshot, membership_map=None, *, include_identity=True)` forwards it. `GET …/tiers/{tid}` and `GET …/tiers/{tid}/players` pass `include_identity=identity`, and skip the membership-map query when it is false.
    - **`user_id` stays.** It is the claim marker every card keys on (R-G2-3) and an internal UUID (R-G1-2 kept `userId` for the same reason).
    - The write routes (`:325`, `:577`, `:759`, `:918`, `:1213`, `:1297`, `:1516`, `:1554`, `:1573+`) keep the default. Their callers are members.
  - **`GET …/members`:** `membership_to_response(m, include_user=identity)`. The list stays, exactly as R-G1-2 did for `by-code`.
  - **`GET …/linked-players`:** when `identity` is false, return `[]` right after `check_view_permission` and skip the tier query.
    - Every entry *is* a user. `LinkedPlayerInfo.user` is required, and `MembersPanel` reads `lp.user.id` unguarded (premises row). Nulling `user` would need a schema change and break that reader.
    - Which cards are claimed is already public through the tier payloads' `userId`.
    - The schema doesn't change.
  - **The four loot reads:** `created_by_username=entry.created_by.discord_username if identity else None` at `:190`, `:692`, `:989` and `:1361`.
    - The three schemas become `created_by_username: str | None = None` (`schemas/loot_tracking.py:98`, `:133`, `:212`), and `types/index.ts:1295`, `:1312`, `:1343` become `createdByUsername: string | null`.
    - `created_by_user_id` stays (an internal UUID).
    - The write responses (`:378`, `:536`, `:777`, `:1520`, `:1659`) keep the username: members only.
  - A private static still refuses a non-member with 403 in `check_view_permission`, before serialization.
  - *Why: one viewer rule across every public read. `/members` or the tier serializer alone would be cosmetic.*
- **R-G2-3 (roster rendering, both shells: no card change).** A guest's tier payload has `userId` and no `linkedUser`.
  - V2 `RosterCard` shows its existing muted **"Claimed"** tag (`:766-770`): no avatar, no handle, no "Claimed by".
  - V1 `PlayerCardStatus` shows **no badge**, since its badge needs `linkedUser` (`:197`).
  - No card reads as unclaimed, because unclaimed keys on `!userId` everywhere. V2's Assign button stays `canManage`-gated.
  - The V1-visible delta for a guest: the claimed-by badge disappears. That is sanctioned (B14) and is the point of the row.
  - Vitest pins both renderings. *Why: the honest guest view is "this card is someone's", not whose.*
- **R-G2-4 (one members-only card, the Schedule residual).**
  - New `components/auth/MembersOnlyCard.tsx` (`person`), exported from `components/auth/index.ts`: `MembersOnlyCard({ staticName, subject })`.
  - It reads `user`, `isLoading` and `login` from `useAuthStore`, and `useLocation`. It renders `<div data-testid="members-only-card">` wrapping `EmptyState` with `icon={<Lock size={24} />}` and `heading="Members only"`. `EmptyState` is shared with V1 and **isn't edited** (vet M-4).
    - Guest (`!user`): description `` `${subject} are shared with members of ${staticName}. Log in to ask to join.` ``, and `action={{ label: isLoading ? 'Connecting...' : 'Login with Discord', onClick: () => { if (!isLoading) login(pathname + search); } }}`. `EmptyState`'s action can't be disabled, so the guard stops a second click restarting OAuth, which `LoginButton` prevents by disabling itself (`LoginButton.tsx:24`) (vet M-5).
    - Signed-in non-member: `` `${subject} are shared with members of ${staticName}. Ask a lead for an invite, or send a join request if the static is recruiting.` ``, with no action.
  - **Schedule** (`:433-447`) replaces its `EmptyState` and the `-mt-6 pb-8` wrapper with `<MembersOnlyCard staticName={group.name} subject="Sessions and availability" />`. That is the owner's ruling (2026-10-01).
    - The copy is byte-identical to #343's. `schedule-screen` and the `PageHeader` stay, so smoke test 10 and `guest.spec.ts` keep passing.
    - Schedule drops its `LoginButton` import if nothing else uses it.
  - **Disclosed:** the action is a primary `Button` labelled "Login with Discord", without `LoginButton`'s Discord glyph. That is what `EmptyState`'s `action` renders, and it is the trade the owner picked over the margin hack.
  - The heading never contains "schedule" (R-G1-7's smoke-test trap).
  - *Why: two members-only gates (Schedule, Tracking) share one card instead of two copies (jscpd).*
- **R-G2-5 (Tracking, both shells).**
  - `GroupViewContent` passes `isMember={userRole != null}` and `groupName={currentGroup.name}` to `GoalsPage`. Both props are **required**, so `tsc -b` catches a call site that omits one, and a `GroupViewContent` test pins the `userRole != null` line (vet M-2).
  - When `!isMember`, `GoalsPage` renders only `<MembersOnlyCard staticName={groupName} subject="Objectives and farms" />`: no sub-tab switcher, and no `ObjectiveGoalsPanel` or `CollectionsHub`. Nothing mounts, so no objective-goals or collection-goals request fires, for `?goal=farms` either.
  - `userRole != null` matches `require_membership` (viewers and admins pass), so a viewer keeps the full page.
  - The `PageHeader` ("Tracking" / "Goals & Farms") stays.
  - *V1 delta (sanctioned, B14):* a guest or signed-in outsider on Goals & Farms sees the card instead of empty panels behind 401/403s.
- **R-G2-6 (Plugin, both shells).**
  - `PluginPage` reads `user` and `isLoading` from `useAuthStore` and `useAuthHydrated()`, with `authLoading = !hydrated || isLoading` (R-G1-4's shape). The "Your API keys" box (`:93-98`) gets `data-testid="plugin-api-keys"`, because the top bar has its own Log in (vet M-7). Inside it:
    - `authLoading && !user` → `<AuthSkeleton />`;
    - `!user` → `<p className="text-sm text-text-secondary mb-3">Log in to create an API key for the plugin.</p>` + `<LoginButton redirectTo={pathname + search} />`;
    - otherwise `<ApiKeyManager />`, as today.
  - The install steps and `GearSyncDashboard` are unchanged.
  - Signed-in non-members keep the key manager: keys belong to the account, and `/api/auth/api-keys` answers 200 for them.
  - `LoginButton` sits inside the box, not under an `EmptyState`, so it keeps its Discord styling.
  - *Why: the row says "a Log in prompt instead of the key manager for guests".*
- **R-G2-7 (More, both shells).**
  - `MorePage` reads `useAuthStore((s) => s.user)` (the `CommandPalette` precedent, R-G1-5). The Integrations card (`:196-222`) and the Settings card (`:259+`) render only when `user` is set.
    - If a section heading would be left with no cards, hide that heading too.
  - Signed-in non-members keep both cards: Settings for a signed-in non-member is DA 15 (carried).
  - Danger Zone stays `isMember`-gated, and V2SettingsHost's `!user` gate (GUEST-1) stays.
  - *V1 delta (sanctioned, B14):* a V1 guest no longer gets cards that open legacy settings.
- **R-G2-8 (acceptance, and what CI proves).**
  - **The e2e (local only).** Add a new describe to `frontend/e2e/guest.spec.ts`, **"Guest on a public static (GUEST-2)"**, with the same recorders. The existing describe's title says V2, and this one also walks legacy (vet M-12).
    - **V2:** `?tab=goals`, `?tab=goals&goal=farms`, `?tab=plugin`, `?tab=more`. Expect `denied` and `consoleNoise` empty. Tracking shows `members-only-card` on both URLs. Plugin shows "Login with Discord" inside `plugin-api-keys` and no key list. More shows no Settings or Integrations card.
    - **Legacy (`pinShell(page, 'legacy', …)`):** the same four URLs. Expect no 401/403 whose URL contains `objective-goals`, `collection-goals` or `auth/api-keys`. If the measured legacy walk has no 401/403 at all, assert it is fully empty, and say which in the PR body. Legacy's Roster and Schedule 401s are carried (V1 frozen).
    - **API (guest `request` context):** `GET …/tiers/{tid}`, `…/tiers/{tid}/players`, `…/members`, `…/linked-players` and `…/tiers/{tid}/loot-log` for DEVTST. Their raw bodies contain no `discordUsername` and no `discordId`, and every `createdByUsername` in the loot body is null.
    - **Non-vacuity (vet M-6):** the owner's bodies on the tier, players, members and linked-players routes **do** contain `discordUsername` (as GUEST-1 does at `guest.spec.ts:83-84`). The guest's loot-log body is non-empty: if DEVTST has no entry, log one as the owner first.
  - **CI's proxies:** pytest for all eight routes (Task 1); vitest for the card, Tracking's zero fetches, Plugin's unmounted key manager, More's cards and the roster pins (Task 2).
  - *Why: CI has no Playwright job, so every e2e assertion has a CI-run twin.*
- **R-G2-9 (docs; sanctioned V1 docs-accuracy edits).**
  - **`ApiDocs.tsx`:** each card for one of the eight routes gets one sentence. Add none where no card exists, and list the missing ones in the report.
    - tier and players: "`linkedUser` is `null` when the caller isn't a member."
    - members: "each member's `user` is `null` when the caller isn't a member."
    - linked-players: "Returns an empty list when the caller isn't a member."
    - the loot, page-ledger and material logs: "`createdByUsername` is `null` when the caller isn't a member."
  - **Privacy Changes History**, a new top entry in `docs/PRIVACY.md` (`:201`) and `pages/PrivacyDocs.tsx` (`:460+`, matching the existing card markup). Heading: `v<release> - Member accounts hidden from non-members (October 2026)`.
    - What changed: "Someone who isn't a member of a public static — signed out, or signed in to another account — no longer receives members' Discord usernames, IDs, avatars or display names from the static's pages or API. The one exception is the contact a lead publishes in the static's Finder listing, which is visible only while the listing is live. The roster, gear and loot history stay viewable by share code, as before."
    - Why: "Nobody outside a static needs to know which Discord accounts are in it. A recruiting contact is shown only once a lead publishes the listing." (vet I-1)
    - Verification: "Open a public static's share link in a private window, then check DevTools ▸ Network: no response contains `discordUsername`."
    - `<release>` = R-G2-10's version.
- **R-G2-10 (release notes; written in Finish, last).**
  - **Version:** the highest `RELEASES[].version` on `origin/main` + 1 patch, so **2.1.64 today** (#345 took 2.1.63). #346 may take 2.1.64 first, so Finish re-reads `RELEASES[0].version` on `origin/main` before it writes the entry and again before it marks the PR ready. A bump touches the entry and R-G2-9's two history headings.
  - **The entry is public.** The release-level `internal` stays unset, so `CURRENT_VERSION` moves to the entry's version (`scripts/discord-changelog.test.js:70-79`). Strings are single-quoted with `'` escaped as `\'` (Edit tool only). `pr`/`prTitle` are filled after `gh pr create`.
  - Release `title`: `'Member accounts stay inside the static'`.
  - **Public `improvement`** (the privacy line):
    - title: `'Members\' Discord accounts are hidden from non-members'`;
    - description: `'Someone who isn\'t a member of a public static (signed out, or signed in to another account) no longer receives members\' Discord usernames, IDs, avatars or display names from the static\'s pages or API. The one exception is the contact a lead publishes in the static\'s Finder listing, shown only while the listing is live. The roster, gear and loot history stay viewable by share code as before, and members, viewers and admins see what they saw before.'` (vet I-1);
    - `link: { href: '/docs/privacy', label: 'Privacy' }`.
  - **Public `improvement`** (API):
    - title: `'API responses for non-members leave out member accounts'`;
    - description: `'For a caller who isn\'t a member, the tier and players endpoints return linkedUser as null, GET /members returns each member\'s user as null, GET /linked-players returns an empty list, the loot, page and material logs return createdByUsername as null, and the static lookups leave the recruiting contact out of settings.discovery unless the static is listed in the Finder. API keys of members get the same responses as before.'`;
    - `link: { href: '/docs/api', label: 'API docs' }`.
  - **Public `improvement`** (V1-visible; vet M-10):
    - title: `'Clearer pages for visitors who aren\'t members'`;
    - description: `'Goals & Farms shows one members-only card instead of empty panels, claimed player cards no longer say who claimed them, the Plugin page asks you to log in before managing API keys, and More no longer offers Settings or Integrations to signed-out visitors.'`.
  - **Internal `improvement`:** "V2 preview: Tracking shows the members-only card to non-members, and Schedule's card uses the same component, with Log in as the card's action."
  - All three public items are `improvement`, not `breaking`. `createdByUsername` goes from always set to nullable, but only for non-member callers; no UI reads it, and member callers are unchanged. The other changed fields were already optional, or are a list (vet M-1).
- **R-G2-11 (V1 delta, stated once).**
  - Backend: non-members lose identity on the eight routes, and members, viewers, admins and member keys get identical payloads.
  - V1-visible for guests and outsiders: no claimed-by badge (R-G2-3); the Goals & Farms card (R-G2-5); the Plugin Log in prompt (R-G2-6); More without Settings or Integrations (R-G2-7, guests only); and the docs (R-G2-9).
  - **Settings ▸ Members (vet I-2).** A signed-in outsider in either shell, or a V1 guest who opens legacy Settings another way, sees "Members (4)" over an empty list: the count stays and every row is skipped (`MembersPanel.tsx:174`, `:179`). The handles they see today are gone. The empty-list presentation is carried to DA 15 (Settings for a signed-in non-member).
  - A V1 member sees no change. Everything else is V2-only by importer (`Schedule`).
- **R-G2-12 (the unpublished listing contact; vet I-1 (a)).**
  - In `group_to_response_with_members` (`static_groups.py:159`), when `identity` is false **and** `not is_discoverable(group)` (`services/discovery_settings.py:49`), serialize `settings` with `contactMethod` and `contactValue` removed from `settings.discovery`. The rest of `discovery` (status, roles wanted and so on) stays.
  - Copy the dict; never mutate `group.settings`, an ORM-tracked JSON column.
  - A listed static keeps the contact for everyone: the Finder publishes it anyway (`discovery.py:99-113`). Members, viewers and admins always keep it.
  - No guest UI reads the contact from `by-code` (premises row), so the V1-visible delta is none.
  - *Why: with it, the privacy line's only exception is a contact the lead chose to publish, and §6.5 #4 is complete. Cost: ~40 lines.*

## Review Focus

- **Payload (Task 1):**
  - the gate is `check_view_permission(...) is not None` on all eight routes, so viewers, admins and a member's `xrp_` key keep identity, and an outsider's key doesn't;
  - write routes are byte-identical;
  - `userId` and `createdByUserId` stay;
  - `linked-players` is `[]`, not an error;
  - the listing contact goes only for an unlisted static and a no-role caller, and `group.settings` is never mutated (R-G2-12);
  - no extra query is added;
  - the raw-body checks would catch a seeded handle under **any** key.
- **Frontend (Task 2):**
  - no objective-goals, collection-goals or api-keys request for the gated callers, on mount or on a sub-tab switch;
  - a viewer still gets Tracking;
  - a signed-in non-member keeps the key manager and More's cards;
  - no pre-hydration flash on Plugin;
  - Schedule's copy and smoke test 10 are unchanged;
  - no new boundary edge fails `pnpm lint`.
- **V1:** only R-G2-11's list changes, and a V1 member sees nothing new.

## Task 1 — identity rule on the eight guest-reachable reads (RISKIEST · `xivrp-implementer-deep`)

**Files.** Create `backend/tests/test_guest_payload_siblings.py`. Modify `backend/app/routers/tiers.py`, `backend/app/routers/static_groups.py`, `backend/app/routers/loot_tracking.py` and `backend/app/schemas/loot_tracking.py`. `dependencies.py` and `permissions.py` aren't edited.
**Interfaces produced:** for a caller with no role, `players[].linkedUser: null` (with `userId` kept), `members[].user: null`, `linked-players: []` and `createdByUsername: null`.

1. **Tests first.** One `world` fixture, modelled on `tests/test_guest_payload.py:34+`:
   - a **public** static with owner, lead, member and viewer, each with a distinct `discord_username` and `discord_id` (e.g. `g2-owner-handle` / `900000000000000001`);
   - an outsider and an admin (`is_admin = True`, as `test_admin_auth.py:54-67`);
   - one tier whose players are claimed by the owner, member and viewer (one unclaimed);
   - one loot-log entry, one page-ledger entry and one material-log entry **created by the lead** (use the factories or the write routes as the lead);
   - an `xrp_` key for the member and one for the outsider (as `test_api_keys.py:16`).

   A `ROUTES` table parametrizes the eight GETs. Then:
   - anonymous, a signed-in outsider (cookie or Bearer JWT) and the outsider's `xrp_` key → 200, and **the raw body contains none of the seeded handles or Discord ids**, under any key. For each route in turn:
     - tier and players: every claimed player still has `userId`, and `linkedUser` is null;
     - `/members`: 4 entries with roles intact, every `user` null;
     - `/linked-players`: `[]`;
     - the loot reads: every `createdByUsername` is null and `createdByUserId` is present.
   - **(pin)** owner, lead, member, viewer, admin (non-member) and the **member's `xrp_` key** (the plugin path) → identity present: `linkedUser.discordUsername`, `members[].user.discordUsername`, `linked-players` non-empty with `user`, and `createdByUsername == 'g2-lead-handle'`.
   - **(pin)** a private static's tier route, anonymous → 403.
   - **(pin)** a write route as a member (`PUT …/players/{pid}` or `POST …/claim`) → the response carries `linkedUser`.
   - **R-G2-12** (`by-code` and `GET /{id}`; a static whose `settings.discovery` has `contactMethod: 'discord'` and `contactValue: 'g2-lead-contact'`):
     - **unlisted** (listing off), anonymous and outsider → `settings.discovery` has no `contactMethod` or `contactValue`, the other discovery keys stay, and the raw body lacks `g2-lead-contact`;
     - **(pin)** **listed** (`is_discoverable` true), anonymous → the contact is present;
     - **(pin)** unlisted, member → the contact is present;
     - a second anonymous GET after the first → still absent and the member still sees it (the ORM settings weren't mutated).
   - **(pin, vet M-14)** using `count_statements` (`conftest.py:283`): an anonymous `GET …/tiers/{tid}` runs at least one fewer statement than the owner's, because the membership-map query is skipped.
   - Show the non-pin tests failing (identity present today).
2. Implement R-G2-2 and R-G2-12.
3. **Gates.** From `<worktree>/backend`:
   - `<venv python> -m pytest tests/test_guest_payload_siblings.py tests/test_guest_payload.py tests/test_player_assignment.py tests/test_tier_deactivation.py tests/test_loot_tracking.py tests/test_static_groups.py tests/test_api_keys.py tests/test_authz_matrix.py tests/test_write_provenance.py tests/test_provenance_service.py tests/test_provenance_coverage.py -q` (there is no `test_tiers.py`; the provenance files pin `createdByUsername` key sets, vet M-8);
   - then `FRONTEND_URL=http://localhost:5174 <venv python> -m pytest tests/ -q` (paste the count);
   - `venv/Scripts/ruff.exe check` on the touched files (0 new).

**Acceptance:** anonymous and outsider bodies on all eight routes carry no seeded handle or id, and an unlisted static's `by-code` body carries no contact. Member, viewer, admin and member-key bodies are unchanged. The authz completeness test is green with no new row.

## Task 2 — members-only card, Tracking, Plugin, More, roster pins (`xivrp-implementer`)

**Files.**
- Create `frontend/src/components/auth/MembersOnlyCard.tsx` with its test, and `components/group/GoalsPage.test.tsx` beside its component.
- Extend the existing co-located `components/group/MorePage.test.tsx` and `components/group/PluginPage.test.tsx`. Once the cards and the key manager depend on `user`, their current cases (`MorePage.test.tsx:107`, `:127`; `PluginPage.test.tsx:61`, `:86`) fail, because neither file seeds the auth store. **Seed a signed-in user in both files' `beforeEach`**, then add the guest cases (vet M-3).
- Extend `pages/GroupViewContent.canManageRoster.test.tsx` (it already mocks the stores) and the existing `MembersPanel` test, or create one beside it.
- Modify `components/auth/index.ts`, `components/schedule/Schedule.tsx`, `components/group/GoalsPage.tsx`, `components/group/PluginPage.tsx`, `components/group/MorePage.tsx`, `pages/GroupViewContent.tsx` (the two `GoalsPage` props only) and `types/index.ts` (the three `createdByUsername` types).
- `components/ui/EmptyState.tsx` and `MembersPanel.tsx` aren't edited (vet M-4, I-2).

1. **Tests first:**
   - `MembersOnlyCard`:
     - guest → "Members only", the guest copy, and a "Login with Discord" button whose click calls `login('/group/X?tab=goals')`; with `isLoading`, the label is "Connecting...";
     - signed-in → the outsider copy, with no button.
   - `GoalsPage`, with the API module mocked:
     - `isMember={false}` → the card, no "Objectives"/"Farms" switcher, and **zero** calls to the objective-goals and collection-goals fetchers; the same at `?goal=farms`;
     - **(pin)** `isMember` with a viewer → the panels mount.
   - `PluginPage`:
     - hydrated guest → "Log in to create an API key for the plugin.", a Login button, and `ApiKeyManager`'s fetch never called;
     - not hydrated → `auth-skeleton`;
     - **(pin)** signed-in → `ApiKeyManager` mounts.
   - `MorePage`:
     - guest → no Settings or Integrations card;
     - **(pin)** a signed-in non-member and a member → both present.
   - **Schedule** (`components/schedule/__tests__/`): update the GUEST-1 guest test to find the "Login with Discord" **button** inside `members-only-card` and assert its click calls `login(path)`. The copy assertions don't change. **(pin)** a viewer still fetches.
   - **Roster (pin):**
     - V2 `RosterCard` with `userId: 'u-1'`, `linkedUser: null` and `currentUserId: ''` → a "Claimed" tag, no "Claimed by", no avatar;
     - V1 `PlayerCardStatus` with the same → no linked-user badge, and no handle text.
   - **`GroupViewContent` (vet M-2):** `?tab=goals` with `userRole` null → `members-only-card`; with `'viewer'` → no card.
   - **`MembersPanel` (vet I-2):** `/members` answers with every `user` null and `/linked-players` with `[]` → it renders no handle and doesn't throw. This one is a **pin**: it passes on `main` (rows with a null `user` are skipped at `:179`). The test guards the new payload shape.
   - Show the non-pin tests failing.
2. Implement R-G2-3 (pins only), R-G2-4, R-G2-5, R-G2-6, R-G2-7 and R-G2-2's `types/index.ts` edit.
3. **Gates:**
   - `pnpm -C frontend test <each touched test file>`, then `pnpm -C frontend test` (paste the count);
   - `pnpm -C frontend build`;
   - `pnpm -C frontend lint` (0 errors, warnings ≤ main's);
   - `pnpm -C frontend check:design-system:strict`;
   - `pnpm -C frontend deadcode`, unchanged (`LoginButton` must stay used).

**Acceptance:** guests and outsiders make no member-only request on Tracking, and guests none on Plugin. More hides the two cards for guests only. Schedule renders the same copy through the shared card.

## Task 3 — guest e2e, API docs and privacy history (`xivrp-implementer`)

**Files.** Modify `frontend/e2e/guest.spec.ts` (a new test plus a header-comment update), `frontend/src/pages/ApiDocs.tsx`, `frontend/src/pages/PrivacyDocs.tsx` and `docs/PRIVACY.md`.

1. Write R-G2-8's e2e test. Run it locally against real servers (§ Finish's ports) as a fresh guest context and paste the result line.
   - Record a **baseline on `main` first**: check out `def04893` into a scratch worktree, or run the new test with the Task 2 commits reverted locally. Report the 401/403 lines per URL for both shells, so the PR shows before and after.
2. R-G2-9's docs, with `<release>` = 2.1.64 for now (Finish re-checks).
3. **Gates:**
   - `pnpm exec playwright test e2e/guest.spec.ts e2e/smoke.spec.ts -g "Guest on a public|10 "` (from `frontend/`; paste the result, which must list both guest describes, vet M-12);
   - `pnpm -C frontend build`;
   - `pnpm -C frontend lint`;
   - `pnpm -C frontend test`.

**Acceptance:** the guest e2e shows 0 × 401/403 on V2 Tracking (both sub-tabs), Plugin and More, and no Settings or Integrations card. The API bodies carry no `discordUsername`/`discordId`.

## Finish (controller)

1. **Browser validation** (slice-loop §2). Use worktree servers: backend `:8021` and frontend `:5179` with `VITE_API_URL=http://localhost:8021` (5174 may be the main checkout's). Copy the DB, run `alembic upgrade head`, and kill an orphaned `vite.js` by PID.
   - Walk V2 and legacy Tracking, Plugin and More as a guest, a signed-in outsider (dev-auth applicant) and a member.
   - Check a guest's Roster in both shells: "Claimed" (V2) and no badge (V1).
   - Open Settings ▸ Members as the signed-in outsider: no handles, no crash, and the count stays (R-G2-11, vet I-2).
   - Shots go to `docs/redesign/pr-shots/`.
2. **Review once** (`redesign-reviewer`), then one fix wave (slice-loop §3–4).
3. **Release notes (R-G2-10).** `git fetch` and read `RELEASES[0].version` on `origin/main`. If #346 merged, merge `origin/main` first. Dispatch `xivrp-implementer` with `model: haiku` and the complete entry text. Bump R-G2-9's two headings if the version moved.
4. **Write-backs (one commit):**
   - HOME_STRETCH §6.3: the GUEST-2 row → ✅ #PR with its real scope (eight routes, R-G2-1; the listing contact, R-G2-12) and the corrected line cites (vet M-9);
   - HOME_STRETCH §6.5 #4: complete (true only because R-G2-12 shipped);
   - HOME_STRETCH "New work": no change;
   - `docs/PRODUCT_MODEL.md` §6.1 W0 row (`:250`): flip "GUEST-2 (…) ⬜" to "✅ #PR (eight routes + the unlisted contact)" (vet M-11).
5. `pr-checklist`, then the gates with their counts in the PR body, including `npm test` in `scripts/` (the changelog suite, `discord-changelog.test.js:70-79`; run `npm ci` there first, vet M-13). Then `gh pr create --draft`, mark it ready once, and merge when every check is green and every thread is resolved.

## Carried, not GUEST-2

- Legacy guest 401s on Roster (`character-registrations`, `split-clear`) and Schedule (`schedule`, `scheduler/settings`): V1 is frozen.
- Settings for a signed-in non-member (DA 15): whether More's Settings card should also hide for signed-in outsiders, and Settings ▸ Members' "Members (4)" over an empty list (R-G2-11).
- The Finder's "Log in to join" return (A6-22, W1).
- The top bar with Log in at 390 px (the end-phase mobile pass).
