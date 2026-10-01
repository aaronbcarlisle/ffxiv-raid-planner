# AUTHZ-2 · Viewers can't duplicate a static (#331), and the AUTHZ table's hardening (#333)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** close the two AUTHZ follow-ups that #332 left open.
- A viewer can no longer duplicate a static. The API refuses it, and neither shell offers it (#331, owner ruling 2026-09-30: option 1). Neither shell offers it on a linked-only row either, which the API already refuses with 404 (B12).
- Every row of `backend/tests/authz_matrix.py` is probed, not only the static-scoped ones (#333):
  - anonymous callers get 401;
  - non-admins get 403 on the admin rows;
  - a lead gets 403 on the owner-only rows;
  - an authenticated non-member (the `outsider`) gets 403 or 404 on every static-scoped row of a **public** static (B17);
  - another user gets 403 or 404 on the `self` rows that target an object the caller owns.
- Guards in the well-formed test catch a misfiled row before it can skip its probes.

**Spec (binding):**
- `gh issue view 331`, with the owner's ruling (option 1: `min_role = member`, the UI hides Duplicate for viewers, the strict xfail flips to a pass).
- `gh issue view 333`: every item in it.
- The owner's answers of 2026-10-01 (`.superpowers/stage2/working-notes.md` § Session 5, "all recommended"): **B12** (hide Duplicate on linked-only statics too: gate `owner|lead|member`) and **B17** (add the `outsider` probe to Task 2).
- HS-35 #2 (a): the viewer allowlist stays **exactly six** routes.
- The P0 plan's table conventions: R-P0-7, R-P0-8 and its gap rule (`design/redesign/plans/2026-09-30-p0-safety.md`).
- HOME_STRETCH §1, the standing rule (V1 labels, release notes), and §6.3 W0's Shared-code block.
- `CLAUDE.md`: § UI rules, § Product rules ("Viewer read-only via share code"), and § Pitfalls (the plugin contract; `xrp_` key access stays intact).

**Not this slice:** HS-36 (2026-09-30: members will edit or log their **own** books, totems and drops) is a later slice. **No row's `min_role` changes here, except the duplicate row's.**

| Slice | Branch · worktree | Items | Tasks | Est. lines | Base |
|---|---|---|---|---|---|
| **AUTHZ-2** | `fix/w0-authz2-viewer-duplicate` · `.claude/worktrees/authz2` | #331, #333 | 3 | ~650 incl. tests (vet: ~600, plus the B12, B17 and M-1 tests) | `main` `c8529a26` |

**Setup:**
- Copy `frontend/.npmrc` into the worktree before `pnpm -C frontend install`.
- Run backend commands from `<worktree>/backend` with the main checkout's venv: `D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner/backend/venv/Scripts/python.exe`.
- Task headings are `### Task N`, so `task-brief PLAN N` finds them. Task 3's brief runs to the end of the file; its last line marks where the controller's sections start.

**Tech stack:** FastAPI + SQLAlchemy async · pytest + aiosqlite (`tests/conftest.py` `CSRFAwareClient`; factories in `tests/factories.py`) · React 19 · Zustand · Vitest + Testing Library.

**Plan-vet:** run 2026-09-30 (`xivrp-director`: ALIGNED, **APPROVE-WITH-FOLDS**, 0 Critical; `.superpowers/stage2/plan-vet-authz2.md`). Folded 2026-10-01: I-1, I-2 and M-1…M-6, each tagged inline `(vet I-n)` / `(vet M-n)`, plus the owner's answers B12 and B17, tagged `(B12)` / `(B17)`. Every vet file:line was re-checked against `c8529a26` before folding.

**Tests first:** each implementer writes the task's listed tests first and shows them failing for the right reason before any production or table edit. Some tests are guards or probes that pass on today's code because no bug exists. For those, "failing first" means a one-line throwaway edit makes the test fail; the implementer pastes the failure and reverts the edit. The repo's slice-loop has no `test-author` step, and its own agents take precedence.

**Baseline** (`c8529a26`, `pytest tests/test_authz_matrix.py -q`): **338 passed, 1 xfailed, 35.5 s.**

## Spec premises checked against the code (2026-09-30, `main` `c8529a26`)

Scratch probes ran these against the live app with the table's own `build_world` and `CSRFAwareClient`. They lived in the session scratchpad and were not committed.

| Issue cites | Code says | Ruling |
|---|---|---|
| #331: a viewer duplicating gets 201 | **Confirmed.** `static_groups.py:733-750`: `is_user_admin` + `get_user_membership`. A non-member who isn't an admin gets `NotFound` (404). There is no role check. The table row (`authz_matrix.py:263-267`) carries the strict viewer xfail. | R-A2-1 |
| #331 option 1: "`require_membership(min_role=MEMBER)` on the route, a one-line gate" | **That one-liner would change two pinned behaviours.** (1) A non-member would get 403, not 404, and `test_duplicate_group.py:325-345` asserts 404. (2) `require_membership` returns the admin virtual-owner row, but the route's audit flag reads its own locals (`:871-873`, `admin_override = user_is_admin and membership is None`, R-AD-A). With that change an admin non-member would log `admin_override=False`. The same minimum role is enforced inline instead. | R-A2-1 |
| "The UI offers Duplicate to every role (`MyStaticsPanel.tsx:309`, `YourStaticsCard.tsx:231`)" | **Confirmed, and those are the only two entry points.** `duplicateGroup` (`staticGroupStore.ts:190`) has only those two callers. The roster's "Duplicate" (`useRosterCardActions.tsx:359`) and "Duplicate Player" (`PlayerCard.tsx:425`) items call POST players, a lead route, and are already disabled without roster permission. **Also:** both menus offer Duplicate on **linked-only** rows (`source: 'linked'`, `userRole` unset, `static_groups.py:237-252`), and the API answers those with 404 today. | R-A2-2 (B12: hidden there too) |
| Which shell renders each menu | `MyStaticsPanel` is **V1-only**: `Dashboard.tsx:41` (V2 redirects to `/profile` at `:30`) and the legacy Profile ▸ Statics tab `Profile.tsx:533` (V2 returns `PlayerHub` at `:312`). `YourStaticsCard` is **V2-only**: `HubOverview.tsx:12` ← `PlayerHub.tsx:13` ← `Profile.tsx:315`, inside `if (inV2Chrome)`. | R-A2-3 |
| #333: "52 non-static rows have no `build`" (self 32, user 6, public 5, admin 4, admin_or_key 2, optional 2, dev 1) | **Confirmed.** 169 rows. 57 are non-static, and 5 of those have a build (4 plugin rows plus `[leave]`). | — |
| #333: the anonymous probe "needs no body when the auth dependency runs first" | **Confirmed.** All **161** rows that are not `public`/`optional`/`dev`, static-scoped ones included, answer **401**. The probe sent no credentials, no body, and every path param `"1"`, through the CSRF client's verbs. | R-A2-5 |
| #333: a non-admin probe for the admin rows | **Confirmed.** All 7 `admin`/`admin_or_key` rows answer 403 to the static's (non-admin) owner, both by JWT and by that owner's `xrp_` key. The 4 `admin` rows refuse **any** key, the admin's own included ("API keys cannot access this endpoint"), so `admin` vs `admin_or_key` is a real distinction, but no test asserts it today. | R-A2-6 |
| #333: "builds plus actor probes for the `self`/`user` rows" | **20 of the 32 build-less `self` rows target an object the caller owns:** api-key revoke, notification read, character ×3, personal goal ×2, job ×2, job BiS ×5, and profile BiS ×5 (the POST carries the owner id in its body). Join-request cancel brings the count to 20. In the scratch probe, the static's owner as a **stranger** got 404 on 19 and 403 on cancel, and the owning user got 2xx or a domain 4xx on all 20. **No IDOR found.** `characters/{id}/sync-gear` reaches xivapi (`player.py:964`, `lodestone._fetch_character_payload`), so its actor needs a stub. The other 12 `self` rows have no target id: they act on the caller by construction. The 6 `user` rows have no target beyond capability codes (`invite_code`, `share_code`). | R-A2-7 … R-A2-9 |
| #333: pin the plugin rows by `row.id` or by count (11) | **Confirmed residual.** `test_plugin_rows_match_the_client` (`test_authz_matrix.py:423-454`) compares `(method, path)`, so un-flagging `loot-log [purchase]` while `[drop]` stays flagged passes. There are 11 plugin rows. | R-A2-10 |
| #333: the `{group_id}` guard: "today only `DELETE …/members/{user_id} [leave]` qualifies" | **Wrong.** `POST …/players/{player_id}/admin-assign` (`authz_matrix.py:330`, `admin`) also has `{group_id}` in its path and isn't static-scoped, so the exceptions set has **two** entries. **Vet M-6:** a static addressed by share code is still a static. `POST /api/static-groups/{share_code}/join-requests` (`authz_matrix.py:281`, `user`) is the only `{share_code}` mutation row, so the guard covers both placeholders and the set gets a **third** entry. | R-A2-11 |
| #333: owner-only rows have no lead probe (5) | **Confirmed.** The lead gets 403 on four of them. On `DELETE …/claim [other]` the lead gets **200**, because the row's build targets the **lead's own** card (`authz_matrix.py:341-342`). That is a self-release, which `tiers.py:1330-1336` allows. **It is a build artifact, not an authorization bug.** | R-A2-12 |
| #333: the extra well-formed checks | Feasible as stated. Gap probe names in use today: `viewer`, `member`, `allowed`, `actor`. | R-A2-13 |
| Vet I-1: "`CURRENT_VERSION` + 1 patch" | **Picks a taken number.** `CURRENT_VERSION = '2.1.59'` (`releaseNotes.ts:12`), but `RELEASES[0]` is #332's internal `2.1.60` (`:63`). No test catches a duplicate: the order check uses `toBeGreaterThanOrEqual` (`releaseNotes.test.ts:50`), and the version check compares `CURRENT_VERSION` only with the latest public release (`:21-24`). Internal sibling entries (PROV-1, GUEST-1) never move `CURRENT_VERSION`, so a Finish re-check of it can't see them. | R-A2-4 (vet I-1), R-A2-18 |
| Vet I-2: how the admin probe sends each row | **Confirmed.** `import-verified-ids` takes a required body (`mappings`, `collection_catalog.py:141`) and checks `is_admin` inline, inside the handler, so the owner with no body gets **422** before the admin check. The other admin rows refuse first: `require_admin` (a dependency) on the three error-review rows (`analytics.py:580-584`, body or not), and the inline check on the body-less `seed`/`sync` (`collection_catalog.py:81-86`, `:191-196`). | R-A2-6 (vet I-2) |
| B17 (the vet's Q2): no probe covers an authenticated non-member | **Confirmed.** The viewer and member probes (`test_authz_matrix.py:331-334`) send static members only. The world static is private: `create_static_group` defaults `is_public=False` (`factories.py:70`), and `build_world` doesn't set it (`test_authz_matrix.py:141`). The world already has an `outsider` user with no membership (`:53`). P0 found this class live: `mark-run-cleared` accepted any logged-in non-member of a public static (`2026-09-30-p0-safety.md:58`). A non-member gets 403 from `require_membership` (`permissions.py:298-308`) and 404 from an inline membership lookup (`static_groups.py:747-750`). | R-A2-17 (B17) |
| Vet M-4: hub objects can change the plugin probes | **Confirmed.** The plugin sync routes find the profile's character by name + world, or create one (`player.py:1836-1856`). The plugin builds send `Member Card` / `Tonberry` (`authz_matrix.py:204`, `:212`, `:221`), so a hub character with that identity would turn their create path into a find. | R-A2-8 (vet M-4) |

**No item in #333 turned out to be a real authorization bug.** If an implementer's probe finds one anyway, R-A2-15 applies.

## Rulings (bind every task)

- **R-A2-1 (the duplicate gate; #331 option 1).** In `duplicate_group` (`static_groups.py:747-750`), keep the 404 for non-members and add a role check after it:
  ```python
  member_level = ROLE_HIERARCHY[MemberRole.MEMBER]
  if membership and not user_is_admin and membership.role_level < member_level:
      raise PermissionDenied("Viewers can't duplicate a static")
  ```
  - At `:871-873`: `admin_override = user_is_admin and (membership is None or membership.role_level < member_level)`. This is `admin_override_for`'s definition with `min_role=MEMBER`: an admin holding a viewer seat passes, but only because they are an admin. Import `ROLE_HIERARCHY` from `..models`.
  - **Why inline:** it enforces the issue's minimum role while keeping the pinned 404 and the R-AD-A audit locals (see the premises). Cost if wrong: none for viewers; only the 403's text differs from `require_membership`'s.
  - **Plugin:** this isn't a plugin route. `get_current_user` is unchanged, so a member's `xrp_` key keeps working.
  - **Table:** the row loses its `gaps`. Its intent becomes `"copy the static into a new one the caller owns (members and up, #331)"`. `VIEWER_ALLOWLIST` stays at six (HS-35 #2 (a)).
- **R-A2-2 (the clients hide it; both menus; B12).** Duplicate renders only when the row's `userRole` is `owner`, `lead` or `member` (B12, 2026-10-01). That hides it from viewers (#331) and on **linked-only** rows (`source: 'linked'`, `userRole` null, `static_groups.py:237-252`), where the API already answers 404 because the caller isn't a member.
  - `MyStaticsPanel.tsx`: in `getContextMenuItems` (`:297-325`), next to `isOwner` (`:300`).
  - `YourStaticsCard.tsx`: next to `isOwner` (`:189`).
  - **Hidden, not disabled:** the owner's ruling says "hides", and both menus already hide Settings/Delete from non-owners the same way.
  - An admin's own linked-only row loses Duplicate too, although the API would let an admin through. Accepted: the menu follows the row's role, as Settings and Delete already do.
- **R-A2-3 (V1 labels; HOME_STRETCH §1).** The PR body copies this table.

  | File | Label | Importer evidence |
  |---|---|---|
  | `backend/app/routers/static_groups.py` (`duplicate_group`) | V1-visible, sanctioned (W0 AUTHZ, #331 ruling) | the API serves both shells; not a plugin route |
  | `components/dashboard/MyStaticsPanel.tsx` (one menu condition) | V1-visible, sanctioned (W0 AUTHZ, #331: "the UI hides Duplicate for viewers"; B12, 2026-10-01: on linked-only rows too (vet M-3); R-P0-5 precedent: the client hides what the API refuses) | `Dashboard.tsx:41` (legacy only; V2 redirects at `:30`), `Profile.tsx:533` (legacy tab; V2 returns at `:312`) |
  | `components/profile/hub/YourStaticsCard.tsx` (one condition: viewer and linked-only rows, B12) | V2-only | `HubOverview.tsx:12` ← `PlayerHub.tsx:13` ← `Profile.tsx:315` (inside `if (inV2Chrome)`) |
  | `frontend/src/data/releaseNotes.ts` | release note | R-A2-4 |
  | `backend/tests/*`, `*.test.tsx` | tests | — |
- **R-A2-4 (release note).** One **public** `fix` entry, because the change is V1-visible:
  - Title: `Viewers can no longer duplicate a static`.
  - Description (vet M-3, B12): `A static\'s viewers no longer see Duplicate Static in My Statics, and the server refuses a duplicate request from a viewer. Statics you\'re only linked to through a card no longer offer it either, since the server never allowed that copy. Members, leads and owners can still duplicate.`
  - Strings are single-quoted, with `'` escaped as `\'`. Edit the file with Edit/Write only.
  - **Version (vet I-1):** the release version is the **highest `RELEASES[].version` on `origin/main` + 1 patch**: 2.1.61 at plan time, because #332 took 2.1.60 as an internal entry while `CURRENT_VERSION` stayed `'2.1.59'`. `CURRENT_VERSION` is set to the same number (this entry is public). Never derive it from `CURRENT_VERSION`: internal entries don't move it.
  - At Finish, the controller re-reads `RELEASES[0].version` on `origin/main` (`git show origin/main:frontend/src/data/releaseNotes.ts`), because the sibling W0 PRs (GUEST-1, PROV-1) may take 2.1.61 first. If they did, the entry moves to the new highest + 1 patch and `CURRENT_VERSION` follows (R-A2-18). The same rule binds PROV-1 R-PV-13 and GUEST-1 R-G1-10.
  - `pr`/`prTitle` are filled after `gh pr create`.
  - #333 is test-only and gets no entry.
- **R-A2-5 (the anonymous probe).** `ANON_REFUSED = [r for r in ROUTES if r.min_role not in ("public", "optional", "dev")]` (161 rows).
  - Each row is sent with the `client` fixture's own verbs, so CSRF is injected: no `Authorization` header, no body, no query, and every path param `"1"`. It needs no world. The test asserts **401**, and that `_error_code(resp) != CSRF_ERROR`.
  - **Why no builds:** the premise run shows every auth dependency answers before validation. A future route that validates first fails loudly with a 422, which is the outcome we want.
  - Gap probe name: `anon`.
- **R-A2-6 (the non-admin probe).** `ADMIN_ROWS = [r for r in ROUTES if r.min_role in ("admin", "admin_or_key")]` (7 rows). Each is sent as the world's **owner**: the strongest non-admin, and the owner of the static that `admin-assign` targets. Two credentials:
  - by JWT;
  - by the owner's minted `xrp_` key, sent bare (`_mint_key`, `_send_bare`).
  - **How each row is sent (vet I-2).** A row **with a build** sends that build, built as `row.actor` (`send(client, row, world, "owner", as_=row.actor)`), with the probing credential. The key variant formats the same build's path and query (as `test_plugin_mutation_works_with_a_bare_key` does) and sends its body through `_send_bare`. A **build-less** row sends every path param as `"1"` and **no body**. The rule covers the JWT and key variants and the admin-key check below. Today the rows with builds are `import-verified-ids` and, after this task, `admin-assign`. Without its build, `import-verified-ids` answers 422 before its inline admin check, so a test that accepted `in (403, 422)` would be vacuous.
  - Both assert **exactly 403**, never a set, and not the CSRF error. Gap probe name: `nonadmin`.
  - **Also,** for the 4 `admin` rows (JWT-only by intent), the **admin's** own minted key gets exactly 403, sent by the same rule (vet I-2). This makes the table's `admin` vs `admin_or_key` split asserted instead of documentation.
  - `admin-assign` gets a build, `_r(_card(w, w.card["open"]), None, {"userId": w.u["member2"].id})`, and `actor="admin"`, so the actor probe proves an admin reaches past validation. The other 6 admin rows stay build-less: their depends/inline admin gate answers first (premise). The error-review and catalog seed/sync handlers would need fixtures or the network to reach a 2xx.
- **R-A2-7 (`owned` rows and the stranger probe).**
  - `AuthzRoute` gains `owned: bool = False`: "the build targets an object the actor owns". It is set on the **20** rows in the premises (list in Task 3).
  - Those rows get builds that resolve through `w.my_hub` (R-A2-8), or `w.join_request` for cancel. Their actor is `member`, or `applicant` for cancel.
  - The stranger probe uses `STRANGER = "owner"`: the static's owner shares a static with the victim and holds the highest non-admin role, so it is the strongest stranger. It sends the row's request **built as the actor** (the victim's object) with the stranger's JWT, and asserts **403 or 404** and not the CSRF error.
  - The probe accepts 404 because these routes hide whether an object exists. A broken build can't hide behind that 404: the committed actor probe (R-P0-8.5), which rejects 404, runs the same build as the actor.
  - `send()` gains `as_: str | None = None`. The build runs as `world.as_(as_ or caller)`, and the token is always `caller`'s. It lands in **Task 2**, which needs it for R-A2-6 (vet I-2) and R-A2-17 (B17); Task 3 uses it.
  - Gap probe name: `stranger`.
- **R-A2-8 (world additions).**
  - `tests/factories.py` gains three missing helpers, modelled on the local copies in `test_fit_score.py:94`, `test_plugin_auth.py:277` and the notification model:
    - `create_player_goal(session, profile, *, title="Probe goal", goal_type="custom")`;
    - `create_notification(session, user, *, title="Probe")`;
    - `create_api_key(session, user, *, name="Probe key")`, which takes a dummy `key_hash` (sha256 of a uuid) and `key_prefix="xrp_test"`. Revocation looks the key up only by `id` and `user_id` (`api_keys.py:152-166`).
  - `World` gains `hub: dict[str, HubObjects]`, built for `member` only. `HubObjects` is a frozen dataclass of `profile, character, job, bis, goal, notification, api_key`, and `World.my_hub` returns `self.hub[self.caller]`.
  - The character uses `lodestone_id="12345678"`, because `sync-gear` calls `int()` on it (`player.py:961`).
  - Its name and world are `Hub Probe` / `Ravana`, never the plugin builds' `Member Card` / `Tonberry` (`authz_matrix.py:204`, `:212`, `:221`). The three plugin sync rows then keep exercising find-or-create's **create** path (`player.py:1836-1856`). If any existing row changes status once the hub exists (the plugin-contract, actor or viewer probes), the report names it (vet M-4).
  - `no_network` also stubs `app.routers.lodestone._fetch_character_payload` to raise `HTTPException(409, "AUTHZ probe: Lodestone stubbed")`.
    - The import inside the handler (`player.py:953-959`) reads the module attribute at call time.
    - 409 is a domain 4xx, so the actor probe accepts it. The ownership lookup (`_get_own_character`, `:951`) runs before the stub.
    - If another row's actor or a lodestone row changes status because of the stub, the report says so.
- **R-A2-9 (rows that keep no build).**
  - The 12 caller-only `self` rows, the 3 plugin `self` rows and `[leave]` act on the caller by construction. A stranger can't name another user's object through them (`[leave]`'s other-target twin is the `[remove]` row, which is already probed). They are listed in `CALLER_SCOPED`, an explicit set of 16 row ids.
  - The well-formed test asserts that every `self` row is either `owned` or in `CALLER_SCOPED`, and that `CALLER_SCOPED` holds no stale ids. `owned` implies `min_role == "self"` and a build.
  - The 6 `user` rows get **no builds**: authentication is their only gate, and the anonymous probe covers it. Cost if wrong: a `user` row that grows a target id goes unprobed until someone retypes it, but the `{group_id}` guard (R-A2-11) still catches the static-scoped case.
- **R-A2-10 (pin the plugin rows by id).** `PLUGIN_MUTATIONS` (the `(method, path)` pairs) is replaced by `PLUGIN_ROW_IDS`, the **11** `row.id` strings, and `test_plugin_rows_match_the_client` compares `{r.id for r in PLUGIN_ROWS}` to it. Un-flagging one variant of a pair now fails. The transcription comment (`:420-422`) stays.
- **R-A2-11 (the static-path guard: `{group_id}` and `{share_code}`).** `GROUP_PATH_EXCEPTIONS` holds three row ids, each with a reason comment:
  - `DELETE …/members/{user_id} [leave]`: self, any role but the owner;
  - `POST …/admin-assign`: admin; the R-A2-6 probe covers it;
  - `POST /api/static-groups/{share_code}/join-requests`: user; the caller applies as a non-member by design (vet M-6).

  The well-formed test asserts that every row with `"{group_id}"` or `"{share_code}"` in `row.path` and not `row.static_scoped` is in that set (vet M-6), and that every id in the set exists in `ROUTES`.
- **R-A2-12 (the lead probe).** `LEAD_DENIED = [r for r in ROUTES if r.min_role == "owner"]` (5 rows), sent as the lead, asserts 403 and not the CSRF error. Gap probe name: `lead`.
  - `DELETE …/claim [other]` targets a **caller-relative** card through a new `World.other_card`: the lead's card, or the member's card when the caller is the lead. The viewer and member probes still hit the lead's card, and the owner actor still gets 200 on the lead's card. Why: one build serves four callers, and none of them may hit their own card.
- **R-A2-13 (well-formed additions)** to `test_route_table_rows_are_well_formed`:
  - `plugin_body` appears only on `plugin` rows;
  - every `plugin` row has a build;
  - `PROBES: dict[str, list[AuthzRoute]]` maps every gap probe name (`viewer member lead allowed actor anon nonadmin outsider stranger`; `outsider` per B17) to its row list, and each `(name, _)` in a row's `gaps` names a key whose list contains that row;
  - the guards of R-A2-9 and R-A2-11.
- **R-A2-14 (where the sets live).** `CALLER_SCOPED`, `GROUP_PATH_EXCEPTIONS` and `PLUGIN_ROW_IDS` live in `test_authz_matrix.py`, beside `VIEWER_ALLOWLIST`. Reclassifying a row then takes a deliberate edit in both files, which is the point of an allowlist.
- **R-A2-15 (if a new probe exposes a real gap).** The R-P0-8 gap rule applies, with no silent fixes. A gate fix of five lines or fewer that matches the row's ruled intent may land with a ledger `Ruling:` and a release note. Anything larger becomes a `gaps` strict xfail plus a new issue. Either way the PR body names it.
- **R-A2-16 (the split).** Three tasks:
  - the behaviour change (#331), with its UI and release note;
  - the cheap #333 probes and guards;
  - the `owned` rows, which need world objects.

  Task 3 is the riskiest, because a vacuous stranger probe is the classic trap. Cost if wrong: none; the slice stays under the S cap (< 700 lines) at about 650 with the B12, B17 and M-1 folds. The outsider probe (B17) goes in Task 2, as the owner ruled.
- **R-A2-17 (the outsider probe; B17, the vet's Q2).** `OUTSIDER_DENIED = [r for r in ROUTES if r.static_scoped]` (**112** rows: viewer 6, member 20, lead 81, owner 5). Each is sent as the world's `outsider`, an authenticated user with no membership, against a **public** copy of the world static.
  - `build_world(session, *, public: bool = False)` passes `is_public=public` to `create_static_group`. A `public_world` fixture calls it with `public=True`. Every other probe keeps the private world, and each test still builds its own (V6c).
  - Each row is sent as `send(client, row, public_world, "outsider", as_=row.actor)`. The outsider holds no card, so a build that reads `w.my_card` would raise `KeyError` as the outsider. The build runs as the row's actor, and the token is the outsider's.
  - It asserts **403 or 404**, and not the CSRF error: `require_membership` refuses a non-member with 403, and inline membership lookups answer 404 (premises). The 404 can't hide a broken build, because the actor probe (R-P0-8.5), which rejects 404, runs the same build as the same actor. The public flag adds or removes no object.
  - The viewer rows are included: the allowlist admits a static's viewers, never a non-member (HS-35 #2 (a)).
  - Gap probe name: `outsider`. A refusal it finds missing falls under R-A2-15.
- **R-A2-18 (shared lines go last; vet I-1, cross-cutting W0).** Three edits touch lines that the sibling W0 PRs (GUEST-1, PROV-1) also edit:
  - the release entry and `CURRENT_VERSION` in `releaseNotes.ts`;
  - the W0 row at `docs/PRODUCT_MODEL.md:250`;
  - `design/redesign/HOME_STRETCH.md` (the §6.3 AUTHZ row at `:365`, and the next free HS number).

  They go **last**. Task 1 writes the release entry at the version free at that moment, so the gates and the review see it. At Finish, once any sibling W0 PR has merged, the controller rebases onto `origin/main`, renumbers the entry (R-A2-4), and only then makes the doc write-backs. A conflict at the head of `RELEASES` resolves by version order, highest first. If a sibling merges after this PR opens, the controller rebases again and repeats the renumber and the write-back check before the merge.

## Review Focus

- **#331:** a non-member still gets 404, a viewer gets 403, and a member, a lead and an admin with or without a viewer seat get 201. Both admin audit rows have `admin_override=True`; the owner's has `False` (vet M-1). `VIEWER_ALLOWLIST` is still six. No other route's gate changed.
- **Clients:** Duplicate is hidden for viewers and on linked-only rows (B12); owner, lead and member keep it. `check:design-system:strict` is clean.
- **Probes:** none of the new probes can pass on a CSRF 403. The anonymous probe sends no credential of any kind: no `Authorization` header and no auth cookie. Every admin-row request follows R-A2-6's send rule, and every admin assertion is exactly 403 (vet I-2). The outsider probe runs on a public static and builds as the row's actor (B17). The outsider's and the stranger's 404s are each backed by the same build passing the actor probe. `[claim other]` is caller-relative.
- **Guards:** each new guard is shown failing on a throwaway edit (pasted in the reports).
- **Runtime:** the AUTHZ file's wall time is reported. Expect about 70 s, since the outsider probe adds 112 worlds (B17). Past ~80 s, report it and keep worlds per test (V6c).

## Questions for the owner

None open. The owner answered both on 2026-10-01 ("all recommended"; `.superpowers/stage2/working-notes.md` § Session 5):

1. **Q1 → B12. Linked-only rows.** Hide Duplicate there too: gate on `userRole` being `owner`, `lead` or `member`, with a linked-row test in each file. Folded into R-A2-2, R-A2-3, R-A2-4 (vet M-3) and Task 1.
2. **The vet's Q2 → B17. The outsider probe.** Add an authenticated non-member against every static-scoped row on a public copy of the world static, in Task 2. Folded as R-A2-17.

## Slice AUTHZ-2

### Task 1 — #331: viewers can't duplicate; both clients hide it; release note (`xivrp-implementer`)

**Files.**
- Backend: modify `backend/app/routers/static_groups.py` (`duplicate_group` only).
- Backend tests: modify `backend/tests/test_duplicate_group.py`, `backend/tests/test_audit_emits_static.py` (`TestDuplicateEmits`) and `backend/tests/authz_matrix.py` (the duplicate row).
- Frontend: modify `frontend/src/components/dashboard/MyStaticsPanel.tsx`, `frontend/src/components/profile/hub/YourStaticsCard.tsx` and `frontend/src/data/releaseNotes.ts`.
- Frontend tests: create `frontend/src/components/dashboard/MyStaticsPanel.test.tsx` (mock the stores the way `YourStaticsCard.test.tsx:9-47` does), and modify `frontend/src/components/profile/hub/YourStaticsCard.test.tsx`.

**Tests first** (each shown failing for the stated reason, pasted):
1. `test_duplicate_group.py`:
   - `test_viewer_cannot_duplicate`: a viewer member gets **403**. Fails today with 201.
   - `test_member_can_duplicate`: a plain member gets 201. Passes today; it guards against over-gating.
   - `test_lead_can_duplicate` (vet M-1): a lead gets 201. Passes today. After step 1, a throwaway that raises the gate's level to `ROLE_HIERARCHY[MemberRole.OWNER]` makes it fail with 403. Paste it and revert.
   - `test_duplicate_group_requires_membership` (`:325-345`) is unchanged and must stay green: a non-member gets 404.
2. `test_audit_emits_static.py` `TestDuplicateEmits`:
   - `test_admin_with_viewer_seat_duplicate_is_override`. An admin holding a viewer seat gets 201 and the row has `admin_override is True`. Fails today on the flag: `membership is None` is False for them.
   - `test_admin_without_seat_duplicate_is_override` (vet M-1): an admin with no membership gets 201 and `admin_override is True`. This pins the rewritten flag's no-seat branch, which nothing pins today (`:354-373` covers the owner only, `False`). Passes today. After step 1, a throwaway flag `user_is_admin and membership is not None and membership.role_level < member_level` (the no-seat branch dropped) makes it fail on the flag. Paste it and revert.
3. `test_authz_matrix.py`: with only the backend gate in place, `test_viewer_is_refused[POST …/duplicate]` reports **XPASS(strict)** → FAILED. Paste it. Then remove the row's `gaps` (R-A2-1).
4. `YourStaticsCard.test.tsx`:
   - `kebab hides Duplicate for a viewer`: open the kebab, `await findByRole('menuitem', { name: 'Open' })`, then `queryByRole('menuitem', { name: 'Duplicate' })` is null. Fails today.
   - `kebab hides Duplicate on a linked-only row` (B12): `makeGroup({ source: 'linked', userRole: undefined })`, built as at `:98-99`, and the same assertions. Fails today.
   - `kebab keeps Duplicate for owner, lead and member` (`it.each`). Passes today.
5. `MyStaticsPanel.test.tsx`: `fireEvent.contextMenu` on a static card. The viewer row has no `Duplicate Static` (fails today). The **linked-only** row (`source: 'linked'`, no `userRole`) has no `Duplicate Static` (B12; fails today). The member row has it.

**Steps.**
1. Apply R-A2-1 in `duplicate_group`, then the row edit of step 3.
2. Apply R-A2-2 in both files (B12): `const canDuplicate = <row>.userRole === 'owner' || <row>.userRole === 'lead' || <row>.userRole === 'member'` (or a module-level role set), spread or `&&` exactly like the neighbouring `isOwner` items.
3. Add R-A2-4's release entry (Edit only) at the highest `RELEASES[].version` on `origin/main` + 1 patch (2.1.61 at plan time), and set `CURRENT_VERSION` to the same number (vet I-1). Finish may renumber it (R-A2-18).

**Gates (paste result lines):**
- `<venv python> -m pytest tests/test_duplicate_group.py tests/test_audit_emits_static.py tests/test_authz_matrix.py -q` (expect 0 xfailed in the AUTHZ file, which now reads 339 passed);
- `pnpm -C frontend test src/components/dashboard/MyStaticsPanel.test.tsx src/components/profile/hub/YourStaticsCard.test.tsx src/data/releaseNotes.test.ts` (the release-notes test added per vet I-1);
- `pnpm -C frontend build`, `pnpm -C frontend lint`, `pnpm -C frontend check:design-system:strict`.

**Acceptance.**
- A viewer gets 403 and a non-member gets 404. A member, a lead, the owner and an admin (with or without a seat) get 201. The override flag is `True` for both admin cases and `False` for the owner (vet M-1).
- The strict xfail is gone, and the table has no other `min_role` edit.
- Neither shell shows Duplicate to a viewer or on a linked-only row (B12).
- The release entry is public `fix`, single-quoted and escaped, at the version R-A2-4 picks, and `CURRENT_VERSION` equals it (vet I-1).

### Task 2 — #333: anonymous, non-admin, lead and outsider probes; plugin pin; well-formed guards (`xivrp-implementer`)

**Files.** Modify `backend/tests/authz_matrix.py` (the `[claim other]` build, the `admin-assign` build and actor, and the docstring's probe list) and `backend/tests/test_authz_matrix.py` (`send(as_=…)` and the build-less path helper, `build_world(public=…)` and the `public_world` fixture, plus the sets and probes below). No production file changes; every throwaway is reverted.

**Tests first.** These probes pass on today's code, because the premises found no bug. Show each one non-vacuous with a throwaway edit, paste the failure, and revert (`git diff --stat` clean afterwards):
1. **The anonymous probe (R-A2-5).** Throwaway (vet M-2): delete the `_user: User = Depends(get_current_user)` parameter of `logout` (`auth.py:382-385`). The anonymous probe then fails on that row with 200. Don't retype `POST /api/analytics/events` to `user`: its auth stays optional and it requires a `batch` body (`analytics.py:105`), so the probe would fail on a 422, not on a 2xx.
2. **The lead probe (R-A2-12).** First run it **before** adding `World.other_card`: `[claim other]` fails with 200 (the self-release premise). That is the build artifact; fix it with `other_card`. Throwaway: retype `PUT G [settings]` to `owner`, and the lead probe fails with 200.
3. **The non-admin probe (R-A2-6), JWT and key.** Throwaway: retype `POST /api/notifications/read-all` to `admin`, and the owner gets 200.
   - **The admin-key check:** throwaway retype of `import-verified-ids` from `admin_or_key` to `admin`. The admin's key, sending the row's build (vet I-2), gets a 2xx there (the plugin-contract test already proves it), so the check fails.
   - **The send rule (vet I-2):** a throwaway that sends `import-verified-ids` build-less shows the owner getting 422, not 403. Paste it; it is why rows with a build send it.
4. **The plugin pin (R-A2-10).** Throwaway: drop `plugin=True` from `loot-log [purchase]`. The new pin fails; paste it, and note the old `(method, path)` pin passed on this edit.
5. **The well-formed guards (R-A2-11, R-A2-13).** One throwaway each:
   - `plugin_body` on a non-plugin row;
   - the build removed from a **non-static** plugin row, `POST /api/plugin/collections/sync` (`authz_matrix.py:202`). On a static plugin row the existing check at `test_authz_matrix.py:362` fires first, so the new guard would go unshown (vet M-2);
   - `gaps=(("lead", "x"),)` on a `member` row;
   - a `{group_id}` row retyped to `self` (e.g. `POST …/schedule/{session_id}/rsvp`);
   - the `{share_code}` join-requests id dropped from `GROUP_PATH_EXCEPTIONS` (vet M-6).
6. **The outsider probe (R-A2-17, B17).** Throwaway: in `mark_split_run_cleared` (`split_clear.py:398-399`), replace the `require_membership(..., min_role=MemberRole.MEMBER)` call with `check_view_permission(session, group, current_user)` on the group it loads: the gap P0a closed (`2026-09-30-p0-safety.md:58`). The outsider then gets a 2xx on the public static. If the probe instead finds a refusal missing on today's code, R-A2-15 applies (no silent fix).

**Steps.**
1. Add `World.other_card` and re-point `[claim other]` at it.
2. Add the `admin-assign` build and `actor="admin"`. Update `build_world`'s comment on `u["admin"]` (`:140`), which says only the admin-key plugin row uses them.
3. Add `send(..., as_=None)` (R-A2-7, moved here) and one path helper for build-less rows, every `{param}` → `"1"` with no body. The anonymous probe and both credentials of the non-admin probe use them (vet I-2).
4. Add `build_world(session, *, public=False)` and the `public_world` fixture (R-A2-17, B17).
5. Add `ANON_REFUSED`, `LEAD_DENIED`, `ADMIN_ROWS`, `OUTSIDER_DENIED`, `PROBES`, `PLUGIN_ROW_IDS` and `GROUP_PATH_EXCEPTIONS`, and the probe tests:
   - `test_anonymous_is_refused`;
   - `test_lead_is_refused`;
   - `test_non_admin_is_refused`, parametrized over the rows × `("jwt", "key")`, plus `test_admin_key_is_refused_on_jwt_only_rows`, both by R-A2-6's send rule and asserting exactly 403 (vet I-2);
   - `test_outsider_is_refused` (B17).
6. Extend the well-formed test (R-A2-13: the `stranger` key enters `PROBES` in Task 3).

**Gates:** `<venv python> -m pytest tests/test_authz_matrix.py -q`. Paste the pass and xfail counts and the wall time. Expect 636 passed and 0 xfailed: Task 1's 339, plus anon 161, lead 5, nonadmin 14, admin key 4, outsider 112 (B17) and one actor probe (`admin-assign`), unless R-A2-15 adds a `gaps` xfail. Then the full backend suite.

**Acceptance.**
- The 161 anonymous rows answer 401, the 5 owner rows refuse the lead, and the 7 admin rows refuse the non-admin owner by JWT and by key, each with exactly 403 under R-A2-6's send rule (vet I-2).
- The 4 `admin` rows refuse the admin's key.
- `admin-assign` passes its actor probe as the admin.
- The 112 static-scoped rows refuse the outsider (403 or 404) on a public static (B17).
- The plugin pin is by id (11), and every guard is demonstrated red.

### Task 3 — #333: `owned` self rows, the stranger probe and the caller-scoped guard (RISKIEST · `xivrp-implementer-deep`)

**Files.** Modify `backend/tests/factories.py` (three new helpers, R-A2-8), `backend/tests/authz_matrix.py` (`owned` field, docstring, builds and actors on the 20 rows) and `backend/tests/test_authz_matrix.py` (`HubObjects`, `World.hub`/`my_hub`, `build_world`, the `no_network` stub, `OWNED`, `STRANGER`, `CALLER_SCOPED`, the stranger probe, `PROBES["stranger"]`, the self guard). `send(as_=…)` already exists from Task 2 (R-A2-7). The hub character is `Hub Probe` / `Ravana` (R-A2-8, vet M-4).

**The 20 `owned` rows** (`actor="member"` unless noted). Builds use `w.my_hub`:
- `DELETE /api/auth/api-keys/{key_id}`
- `PATCH /api/notifications/{notification_id}/read`
- `PUT|DELETE /api/player/characters/{character_id}`, `POST …/{character_id}/sync-gear`
- `PUT|DELETE /api/player/goals/{goal_id}`
- `PUT|DELETE /api/player/jobs/{job_profile_id}`, and `POST …/bis-targets`, `PUT|DELETE …/bis-targets/{target_id}`, `POST …/{target_id}/import`, `POST …/{target_id}/set-active`
- `POST /api/bis-targets [profile]`: body `{"ownerType": "player_job_profile", "ownerId": w.my_hub.job.id, "name": "Profile BiS 2"}`
- `PATCH|DELETE /api/bis-targets/{target_id} [profile]`, `POST …/import [profile]`, `POST …/set-active [profile]`
- `POST /api/join-requests/{request_id}/cancel`: `actor="applicant"`, build `_r({"request_id": w.join_request.id})`

Minimal bodies that reached past validation in the premise run: character PUT `{}`, goal PUT `{"title": …}`, job PUT `{}`, BiS PUT/PATCH `{"name": …}`. Imports answer 400 "No external URL configured", a domain 4xx that the actor probe accepts.

**Tests first:**
1. Write `test_stranger_is_refused` and the self guard **before** the builds. The guard fails and names all 20 build-less id-bearing `self` rows (none is `owned` or in `CALLER_SCOPED` yet). Paste it.
2. After the builds, the actor probe (R-P0-8.5) passes on all 20 new `WITH_BUILD` rows, `sync-gear` included through the stub, and the stranger probe passes.
3. **Ad hoc checks** (executed, pasted and reverted; `git diff --stat` clean afterwards):
   - Drop `ApiKey.user_id == current_user.id` from `revoke_api_key` (`api_keys.py:159-163`). The stranger probe fails with 204.
   - Point one `owned` build at a random uuid. The **actor** probe fails with 404, which proves the stranger's 404 can't be vacuous.
   - Set `owned=False` on `DELETE /api/player/goals/{goal_id}`. The self guard fails.
   - Remove the Lodestone stub. `sync-gear`'s actor probe fails with "AUTHZ probe tried the network".

**Gates:** `<venv python> -m pytest tests/test_authz_matrix.py -q` (paste the counts and the wall time; expect 676 passed: Task 2's 636 plus 20 actor and 20 stranger probes), then the full backend suite. Name any existing row whose status changed once the hub exists (vet M-4).

**Acceptance.**
- All 20 `owned` rows refuse the stranger (403/404) and admit their actor.
- The three plugin sync rows still pass the plugin contract through find-or-create's create path (vet M-4).
- Every `self` row is `owned` or in `CALLER_SCOPED`.
- No `min_role` changed, and no production file changed.

*(Task 3 ends here. The sections below are the controller's.)*

## Finish (controller)

- **Browser walk** (slice-loop §2; dev-auth recipe in memory `feedback_browser_validation_process`). As a **viewer** of DEVTST (demote a dev user with the owner account; P0 confirmed the demotion survives a re-login, `dev_auth.py:338-357`):
  - V1: `/dashboard`, right-click the static: no "Duplicate Static".
  - V2: `/profile?shell=v2`, the static's kebab: no "Duplicate".
  - Then as a **member**: both menus offer Duplicate, and it creates "(Copy)".
  - A **linked-only** static (a card linked to a dev user who isn't a member): neither menu offers Duplicate (B12). If DEVTST has no such row, link a card in a second static to the dev user and leave them out of its members.
  - Shots go to `docs/redesign/pr-shots/authz2-*`, shrunk.
- **Rebase (R-A2-18):** once any sibling W0 PR (GUEST-1, PROV-1) has merged, rebase on `origin/main` before ready and before the steps below. Parallel slices (HS-36) also edit `authz_matrix.py` rows, and the plugin `test_*` section may conflict.
- **Release version (vet I-1, R-A2-4):** re-read `RELEASES[0].version` on `origin/main`, not `CURRENT_VERSION`. If a sibling took the entry's number, move the entry to the highest + 1 patch, set `CURRENT_VERSION` to match, and re-run `pnpm -C frontend test src/data/releaseNotes.test.ts`.
- `pr-checklist` → gates (`pnpm build`, `lint` with 0 errors and warnings ≤ main's, `check:design-system:strict`, `test`, `deadcode` unchanged, backend `pytest`) → `gh pr create --draft` → the release note's `pr`/`prTitle`.
- **#331 ruling comment (vet M-5):** after `gh pr create`, post a comment on #331 that records the ruling, so the issue the PR closes carries it. Write the body to a scratchpad file with Write, then `gh issue comment 331 --body-file <file>`. The body says:
  - owner ruling 2026-09-30, option 1: members and up may duplicate, a viewer gets 403, and the UI hides Duplicate for viewers;
  - owner answer B12, 2026-10-01: both menus also hide Duplicate on linked-only rows, where the caller isn't a member and the API already answers 404;
  - non-members keep the 404 (the pinned `test_duplicate_group_requires_membership`), and the gate is inline so the R-AD-A audit flag stays right (R-A2-1);
  - the HS number from the write-backs below, and "implemented in #<n>".
- **The PR body:**
  - R-A2-3's label table;
  - the AUTHZ counts by probe (anon, viewer, member, lead, nonadmin, outsider, allowed, actor, stranger, plugin) and by `min_role`;
  - the file's wall time;
  - `Fixes #331` and `Fixes #333`.

## Write-backs (once, on the draft after `gh pr create`, and last: R-A2-18)

These are the branch's last commits. They go after the rebase onto any merged sibling W0 PR (GUEST-1, PROV-1), because those PRs edit the same rows and the same HS numbering. Re-read each target line on `origin/main` before editing it.

- **`docs/PRODUCT_MODEL.md` §6.1, the W0 row (`:250`):** "the viewer-duplicate question #331 ⬜" → "#331 ✅ #<n> (viewers can't duplicate)". Add "AUTHZ hardening #333 ✅ #<n>".
- **`design/redesign/HOME_STRETCH.md` §6.3, the AUTHZ row (`:365`):** "a viewer duplicating a static is a strict xfail pending #331" → "viewers can't duplicate, and linked-only rows don't offer it (owner ruling on #331, 2026-09-30, option 1; B12) ✅ #<n>; every row probed (anonymous, non-admin, lead, outsider, stranger) ✅ #<n>".
- **Number the #331 ruling (vet M-5).** HS-35 #30 says new rulings are HS-n only, so the #331 ruling (option 1 + B12) takes an HS number in §2/§7, cited in both rows and in the #331 comment.
  - `origin/main` stops at HS-35 today. **HS-36 is already claimed:** it lands through the S2a spec PR (working-notes `:85`; the draft `.claude/worktrees/s2spec/design/redesign/specs/2026-09-30-s2a-progress-design.md` uses it), and PROV-1's plan cites it.
  - Before numbering, read `origin/main`'s HOME_STRETCH §2/§7, the s2spec draft or PR, and the open W0 PRs (GUEST-1, PROV-1). Take the next number none of them uses: HS-37 at plan time, if no one has claimed it by then.

## Carried, not this slice

- HS-36 (members log or edit their own books, totems and drops) moves rows' `min_role`. It is its own slice, and the probes added here cover it automatically.
- Moving inline gates into `Depends(require_role(...))` (carried from the P0 plan).
