# Stage 5 · AD1b — Wave-1 audit emits + Logs read API

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** every wave-1 admin verb and destructive static operation writes one `audit_log` row in the same transaction as the mutation it records, and admins can read the log through `GET /api/admin/logs`. The privacy page discloses the log. No V2 UI (the Logs tab is AD3).

**Architecture:**
- **Task 1 (riskiest):** the `admin_override` seam in `permissions.py` plus the admin-verb emits: error review ×3, catalog sync/seed, admin-assign.
- **Task 2:** the product-router destructive emits: static update/delete/transfer/duplicate, member add/remove/role-change (`static_groups.py`), tier delete and player delete (`tiers.py`), week revert (`loot_tracking.py`).
- **Task 3:** `GET /api/admin/logs`: new `routers/admin/audit.py` + `schemas/audit_log.py`, mounted in `main.py`.
- **Task 4:** the `PrivacyDocs.tsx` rider and the dated cross-reference notes in `V2_COVERAGE_PLAN.md` and `ROLLOUT_ROADMAP.md`.

One PR, estimated ~1,300 changed lines (Task 1 ~350, Task 2 ~500, Task 3 ~350, Task 4 ~80).

**Out of this slice (OWNER-2, 2026-09-29):** the `import-verified-ids` missing-commit fix and its `catalog.ids_imported` emit ship in their **own small PR** after AD1b (R-AD-D).

**Tech stack:** FastAPI + async SQLAlchemy, `CamelModel` schemas (`schemas/tier_snapshot.py:8-21`), pytest + aiosqlite (fixtures in `tests/conftest.py`; Bearer-JWT `auth_headers*`, `client` shares the test `session`), React 19 for the one page.

**Spec (binding):** `design/redesign/specs/2026-08-08-admin-v2-spec.md` §3.1–§3.4, §10 (V1-safety assert), R1/R8. Workstream plan: `design/redesign/plans/2026-08-08-admin-v2-plan.md` § AD1b and § Global constraints. AD1a contract: `backend/app/services/audit.py` (verb catalog in its docstring, hazards list).

**Plan-vet:** `xivrp-director`, 2026-09-29: **NOT READY (SHARED-DRIFT)** on the first draft — 2 OWNER, 3 Major, 6 Minor. Owner answered both on 2026-09-29: **OWNER-1** → R-AD-A "access only via admin"; **OWNER-2** → R-AD-D split to its own PR. Majors: #1 (`require_membership` returns the virtual row for every admin, `permissions.py:246-247`) → R-AD-A helper + real-owner-admin tests in Task 2; #4 (PrivacyDocs row shape) → Task 4 rewritten; #5 (demo) → Finish step 1 rewritten. Fold-check (director, 2026-09-29): **READY** after New-1 (literal card version, fixed) and two one-clause adds (raw-`+` test URL, `target_user_id` capture), all folded. Minors #6–#11 folded: secret test via `settings.discovery` + camelCase keys (Task 2 step 1), `static.updated` values from the group (R-AD-G), date/prefix rules (R-AD-H), side effects in admin-assign / member removal (R-AD-E/F), duplicate scoped to the source (R-AD-G), V1-safety file list + legacy-only check (Global constraints), success-branch commit (R-AD-C).

## Global constraints (verbatim from the workstream plan, the ones that bind AD1b)

- PR ≤ ~1,500 changed lines.
- **Two-part V1-safety assert** (spec §10): (1) legacy-only paths untouched — for this slice, `git diff --stat main -- frontend/` lists only `src/pages/PrivacyDocs.tsx`, its test and `src/data/releaseNotes.ts` (no frozen V1 component, store, hook or page changes); (2) every hunk in a shared file enumerated in the PR body with the exact V1 render path it reaches. Shared files here: `backend/app/permissions.py`, `backend/app/main.py`, `backend/app/services/audit.py` (only if Task 2 step 1 needs the camelCase extension), `backend/app/routers/{analytics,collection_catalog,static_groups,tiers,loot_tracking}.py`, `frontend/src/pages/PrivacyDocs.tsx`, `frontend/src/data/releaseNotes.ts`.
- `releaseNotes.ts` entry — `pr-checklist` before the PR. The privacy disclosure is user-visible, so its item is public (Ruling in the ledger); the audit plumbing is `internal: true`.
- **Backend-only slices demonstrate "done" with request/response transcripts against the dev server** — a green pytest is not a demo.
- Audit-ordering tests: `sleep(0.02)` between writes or an injected clock (Windows 15.6 ms tick).
- "Static" not "group" in user-facing text (the PrivacyDocs rider).
- No IP/UA in audit rows (R8); never secrets in `old_values`/`new_values` (the helper strips them — do not bypass it).
- Plugin contract (`CLAUDE.md` § Pitfalls): request/response shapes of every touched route stay byte-compatible. Adding `request: Request` to a route signature is invisible to callers.

## Spec premises checked against the code (2026-09-29, main `3e34b7c2`; director-confirmed)

| Spec / plan says | Code says | Ruling |
|---|---|---|
| "thread `admin_override` flag out of `create_admin_membership`" | `create_admin_membership` (`permissions.py:24`) returns an unpersisted `Membership` with `id = f"admin-virtual-{user_id}-{group_id}"` (`:40`), no flag. `require_membership` returns it for **every** admin before looking for a real row (`:246-247`), so every `require_*` hands an admin the virtual row even when they own the static. Only `check_view_permission` prefers the real row (`:309-311`). `add_member`/`update_member_role`/`remove_member` branch on `actor_membership.role` (`static_groups.py:1006,1075,1143`). | R-AD-A. `require_membership` is **not** changed (an admin-lead would change V1 powers). |
| Wave-1 emits "with old/new diffs" | No wave-1 route takes `request: Request`; `Request` isn't imported in `static_groups.py`, `tiers.py`, `loot_tracking.py`, `collection_catalog.py`. | Every emitting route gains `request: Request` and passes it. |
| Catalog sync/seed emit | Both services commit internally (`catalog_import_service.py:59`, `:271`); sync's router swallows exceptions and returns `synced_from_api=False`. | R-AD-C |
| Catalog import-verified-ids emit | Nothing commits (`collection_catalog.py:142-150`, `catalog_id_import_service.py:102` flush only, `database.py:82-95` no auto-commit). Persisting would switch on mount/token matching in plugin collection sync (`plugin_collection_sync_service.py:62-77,109-113`). | R-AD-D: own PR (OWNER-2). |
| Admin-assign emit | The commit lives in `_assign_player_impl` (`tiers.py:~1350-1425`), shared with `owner_assign_player` (`require_owner`, `:1457`); `create_membership_for_assignment` (`:1395`) can `session.rollback()`, expiring every loaded object (`permissions.py:100-103`). The impl can create a membership and unlink another card (`tiers.py:1379-1395`). | R-AD-E |
| Member remove | Two commit paths: self-leave (`static_groups.py:~1131`) and manager removal (`:~1153`); both unlink the user's player cards (`:1128-1129`, `:1149-1150`). | R-AD-F |
| `GET /api/admin/logs → {items, total, page, page_size}` | Repo responses are `CamelModel` (camelCase out); precedent `ErrorGroupListResponse` (`analytics.py:432-547`) ships `pageSize`. | Response keys `items`, `total`, `page`, `pageSize`. Query params stay snake_case as the contract writes them. |
| Mount the logs router | `routers/admin/` holds only `__init__.py` + `deps.py`; `main.py:185-216` mounts routers with `include_router`. | Task 3 mounts `routers/admin/audit.py` in `main.py`. |
| Settings secrets are stripped | `StaticSettingsSchema` has no `discord` field (`schemas/static_group.py:169-231`, unknown keys dropped); the only free-form dict is `discovery` (`:224`). Stored settings are camelCase (`static_groups.py:633`); `_is_secret_key` only knows snake_case (`audit.py:49-65`). | Task 2 step 1 tests via `settings.discovery` with both key styles; extend the helper if camelCase leaks. |

## Rulings (bind every task)

- **R-AD-A (admin_override = access only via admin; OWNER-1).** In `permissions.py`, `ADMIN_VIRTUAL_ID_PREFIX = "admin-virtual-"` (used by `create_admin_membership` to build the id) and:
  ```python
  def is_admin_override(membership: Membership | None) -> bool:
      """True when the membership is the admin virtual-owner row."""
      return membership is not None and membership.id.startswith(ADMIN_VIRTUAL_ID_PREFIX)


  async def admin_override_for(
      session: AsyncSession,
      user_id: str,
      group_id: str,
      membership: Membership | None,
      min_role: MemberRole | None,
  ) -> bool:
      """True when the action was allowed only by admin status: the actor holds the
      virtual row AND either has no real membership or a real role below min_role."""
      if not is_admin_override(membership):
          return False
      real = await get_user_membership(session, user_id, group_id)
      if real is None:
          return True
      if min_role is None:
          return False
      return real.role_level < ROLE_HIERARCHY.get(min_role, 0)
  ```
  One extra query, only when the actor is an admin. Each emitting route passes the membership its `require_*` returned and **the same `min_role` that check used**: `require_owner` → `OWNER`; `require_can_manage_members` / `require_can_edit_roster` → `LEAD`. `update_static_group` uses whichever branch ran (`static_groups.py:~623-625`). `duplicate_group` has no `require_*`: `admin_override = user_is_admin and membership is None` from its locals. `admin_assign_player` (admin-only, no role check of its own; its non-admin twin `owner_assign_player` needs `require_owner`): `admin_override = await admin_override_for(session, current_user.id, group_id, create_admin_membership(current_user.id, group_id), MemberRole.OWNER)` — True unless the admin is the static's real owner. Error and catalog verbs are not static-scoped: `admin_override=False`. `require_membership` is untouched.
- **R-AD-B (placement).** One `await audit(...)` per mutation, after the last call that can raise or roll back and immediately before the route's own `commit()`. Never after the commit. A request that ends in 4xx writes no row. Old values are read into locals right after the target loads (before any call that can roll back). Reads, logging calls and response shapes are unchanged.
- **R-AD-C (catalog sync/seed).** On the success branch only (never in a `finally` or the `except`): emit after the service returns, with the counts in `new`, then `await session.commit()`. The service's commit and the audit commit are two transactions; a crash between them loses the audit row (it never records an action that didn't happen). Sync's failure path (`synced_from_api=False`) writes no row and does not commit.
- **R-AD-D (import-verified-ids — deferred, OWNER-2).** Not touched in AD1b. A follow-up PR adds the router commit and the `catalog.ids_imported` emit (`new = {"updated", "already_set", "skipped", "errors": len(errors)}`, emitted even when `updated == 0`), with a public release item and a plugin-impact note. The `audit.py` verb catalog keeps listing it.
- **R-AD-E (admin-assign).** `_assign_player_impl` gains keyword-only `audit_actor: User | None = None, request: Request | None = None, admin_override: bool = False`. Right after the player loads (`tiers.py:~1354-1357`) it captures `old_user_id = player.user_id` and `player_name = player.name` into locals, and `target_user_id = target_user.id` before `create_membership_for_assignment` (its `rollback()` expires `target_user` too). When `audit_actor` is set, it emits `player.admin_assigned` after the `create_membership_for_assignment` branch and before `flush()/commit()`, `old={"user_id": old_user_id}`, `new={"user_id": <after>, "membership_created": bool, "unlinked_player_id": <id or None>}`. `owner_assign_player` passes nothing (wave 2 owns it).
- **R-AD-F (member remove).** Both paths emit `member.removed`, target = the removed user, `old={"role": <role>, "unlinked_player_count": n}` (count the cards before `_unlink_user_players` runs). Self-leave reads as `actor_user_id == target_id`; no separate verb.
- **R-AD-G (target conventions).** `static_group_id` is set on every static-scoped row (it survives static deletion — no FK).

  | action | target_type / target_id / target_label | old / new |
  |---|---|---|
  | `error.reviewed`, `error.unreviewed` | `error` / fingerprint / first `ErrorReport` message for it, ≤200 chars (one `select … limit(1)`, fingerprint if none) | `new={"is_reviewed": bool, "rows": rowcount}` |
  | `error.batch_reviewed` | `error` / first fingerprint / `f"{n} error groups"` | `new={"action", "fingerprints", "rows"}` |
  | `catalog.synced` / `catalog.seeded` | `catalog` / `collection-catalog` / `Collection catalog` | `new=` counts (R-AD-C) |
  | `static.updated` | `static` / group.id / group.name (after) | keys from `data.model_dump(exclude_unset=True)`, **values read from `group`** before and after the update block (`static_groups.py:628-639`), including the server-forced `settings` changes; no emit when nothing changed |
  | `static.deleted` | `static` / group.id / group.name | `old={"name", "share_code", "is_public"}` |
  | `static.ownership_transferred` | `static` / group.id / group.name | `old={"owner_id"}`, `new={"owner_id"}` |
  | `static.duplicated` | `static` / **new** group id / new name; `static_group_id` = **source** id | `new={"source_group_id", "name"}` |
  | `member.added` / `member.removed` / `member.role_changed` | `user` / member user id / that user's `effective_name` (`session.get(User, id)`, id if missing) | added: `new={"role"}`; removed: R-AD-F; role: `old/new={"role"}` |
  | `tier.deleted` | `tier` / snapshot id / snapshot `tier_id` | `old={"tier_id", "is_active"}` |
  | `player.deleted` | `player` / player id / player name | `old={"name", "job", "user_id"}` |
  | `week.reverted` | `tier` / snapshot id / snapshot `tier_id` | `old={"week": <before>}`, `new={"week": <after>}` |
  | `player.admin_assigned` | `player` / player id / player name | R-AD-E |
- **R-AD-H (logs API semantics).** `from` inclusive, `to` exclusive. Parse with `datetime.fromisoformat` (accepts `Z`, offsets, date-only); a naive result gets `.replace(tzinfo=timezone.utc)` (never `.astimezone()` — it reads naive as local time); then `.astimezone(timezone.utc).isoformat()` before the text comparison with `created_at`. Unparseable → 422. `action` is lowercased, then prefix-matched with `startswith(action, autoescape=True)` so `%`/`_` are literal (SQLite LIKE is case-insensitive, Postgres is not; catalogued actions are lowercase). `credential` is `Literal["cookie", "api_key", "system"]`. `page ≥ 1` (default 1), `1 ≤ page_size ≤ 100` (default 50); out of range → 422. Order `created_at desc, id desc`. `require_admin` (JWT-only).
- **R-AD-I (no test-author).** Tests are written by the implementer test-first, as every prior slice here; the slice-loop skill is the repo's process.

## Review Focus

- An admin who is not a member, or holds only a `member` seat, deletes/updates a static or removes a member → `admin_override=True`; an admin who IS the real owner (or a real lead doing a lead action) → `False` (Task 1 step 1, Task 2 steps 1–3).
- A mutation that fails (remove the owner → 400, transfer to a non-member → 404, revert at week 1 → 400, review an unknown fingerprint → 404) leaves zero audit rows (Tasks 1–2).
- A caller using an xrp_ key (the plugin) on a wave-1 route that accepts keys, e.g. a member role change → `credential == "api_key"` (Task 2 step 2).
- A static update whose `settings.discovery` carries `webhook_url` / `webhookUrl` → neither appears in the row nor in the Logs API response (Task 2 step 1, Task 3 step 1).
- The Logs API with `to=…Z`, an offset (`%2B05:30`), a date-only value, a raw unencoded `+`, and `action=err%` / `action=static_` / `action=STATIC.` → correct rows, no wildcard leak; garbage → 422, never 500 (Task 3 step 1).

## Task 1 — `admin_override` seam + admin-verb emits (RISKIEST · `xivrp-implementer-deep`, `model: fable`)

**Files.** Modify `backend/app/permissions.py`, `backend/app/routers/analytics.py`, `backend/app/routers/collection_catalog.py` (sync, seed only), `backend/app/routers/tiers.py` (`_assign_player_impl`, `admin_assign_player` only). Create `backend/tests/test_audit_emits_admin.py`.

**Interfaces produced:** `permissions.ADMIN_VIRTUAL_ID_PREFIX`, `permissions.is_admin_override(membership) -> bool`, `permissions.admin_override_for(session, user_id, group_id, membership, min_role) -> bool` (async); `_assign_player_impl(..., *, audit_actor=None, request=None, admin_override=False)`.

1. **Seam, test-first.** `is_admin_override`: `None` → False; a real `Membership(id=<uuid>)` → False; `create_admin_membership(u, g)` → True. `admin_override_for` with an admin user: not a member → True; real `member` seat, `min_role=LEAD` → True; real `lead`, `min_role=LEAD` → False; real `lead`, `min_role=OWNER` → True; real owner, `min_role=OWNER` → False; real member, `min_role=None` → False; a non-virtual membership → False without querying. Implement per R-AD-A.
2. **Error verbs, test-first** (admin via a local fixture like `test_admin_auth.py:53-68`; seed `ErrorReport` rows via the ORM): review → one row `error.reviewed`, `target_id == fingerprint`, `credential == "cookie"`, `request_id` non-null, `admin_override is False`; unreview → `error.unreviewed`; batch → one `error.batch_reviewed` row with `new["rows"]`; unknown fingerprint → 404 and zero rows.
3. **Catalog verbs, test-first.** seed → `catalog.seeded` with counts; sync with `sync_from_ffxiv_collect` monkeypatched to return counts → `catalog.synced`; monkeypatched to raise → 200 `syncedFromApi: false` and zero rows. Implement per R-AD-C. `import_catalog_verified_ids` is not edited (R-AD-D).
4. **Admin-assign, test-first.** Admin not a member assigns `test_user_2` to an unclaimed player → `player.admin_assigned`, `old["user_id"] is None`, `new["user_id"] == test_user_2.id`, `new["membership_created"] is True`, `admin_override is True`, `static_group_id == group.id`; admin who is the group's real owner → `admin_override is False`; admin with a real `lead` seat → `True`; `owner-assign` by the owner → zero rows. Implement per R-AD-E.
5. **Gates:** `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -q` (paste count), `venv/Scripts/ruff.exe check` on the touched files (0 new errors), `git diff --check`. Unedited and green: `test_admin_auth.py`, `test_audit_helper.py`, `test_catalog_id_import.py`, `test_player_assignment.py`.

**Ad hoc mutation checks (execute, paste):** make `admin_override_for` return `is_admin_override(membership)` → the real-owner admin-assign test fails; drop the `min_role` comparison → the real-lead-with-OWNER test fails; move the admin-assign emit above `create_membership_for_assignment` → report whether any test fails (placement is otherwise a review item).

## Task 2 — Product-router destructive emits (`xivrp-implementer`, sonnet)

**Files.** Modify `backend/app/routers/static_groups.py` (7 routes), `backend/app/routers/tiers.py` (`delete_tier_snapshot`, `delete_snapshot_player`), `backend/app/routers/loot_tracking.py` (`revert_week`); `backend/app/services/audit.py` only per step 1's camelCase rule. Create `backend/tests/test_audit_emits_static.py`.

**Consumes:** `admin_override_for`, `is_admin_override` (Task 1).

1. **Static verbs, test-first** (`test_group` owned by `test_user`; admin fixtures: admin non-member, admin who is the real owner of a second static, admin with a `member` seat): update name + `is_public` by owner → `static.updated`, only changed keys, values as stored on the group; an update that changes nothing → zero rows; update whose `settings.discovery` carries both `webhook_url` and `webhookUrl` → neither key in either side of the row (if `webhookUrl` leaks, extend `_is_secret_key` to also test the camel→snake form of the key, `re.sub(r"(?<!^)(?=[A-Z])", "_", key).lower()`, with a unit test in `test_audit_helper.py`); update by admin non-member → `admin_override is True`; update and delete by the admin real owner → `False`; delete by the admin `member`-seat → `True`; delete → `static.deleted` and the row still exists with `static_group_id == group.id` after the group is gone; transfer to a member → `static.ownership_transferred` old/new owner ids; transfer to a non-member → 404 and zero rows; duplicate → `static.duplicated` with `target_id` = new group, `static_group_id` = source, `new["source_group_id"]` = source.
2. **Member verbs, test-first:** add → `member.added` (use the add payload the existing tests use); role change → old/new role; the same role change sent with an xrp_ key (mint as `test_admin_auth.py:70`, for a lead user) → `credential == "api_key"`; manager removes a member who has one linked card → `member.removed`, `old == {"role": "member", "unlinked_player_count": 1}`; member leaves (self) → `member.removed` with `actor_user_id == target_id`; the admin real owner removes a member → `admin_override is False`; removing the owner → 400, zero rows.
3. **Tier / player / week, test-first:** delete tier → `tier.deleted`; delete player → `player.deleted` with `old["name"]`; delete tier by the admin real owner → `admin_override is False`; start-next-week then revert → `week.reverted` with `old["week"] == 2`, `new["week"] == 1`; revert at week 1 → 400, zero rows. `sleep(0.02)` between writes wherever a test asserts order.
4. Implement per R-AD-A/B/F/G; every route gains `request: Request` and captures its permission check's membership.
5. **Gates:** full backend pytest (paste count), ruff on touched files, `git diff --check`. Unedited and green: `test_static_groups.py`, `test_permissions.py`, `test_duplicate_group.py`, `test_week_management.py`, `test_weekly_assignments.py`, `test_tier_deactivation.py`, `test_static_characters.py`, `test_pr_integration.py`.

**Ad hoc mutation check (execute, paste):** pass `is_admin_override(m)` instead of `admin_override_for(...)` in `delete_static_group` → the admin-real-owner delete test fails.

## Task 3 — `GET /api/admin/logs` (`xivrp-implementer`, sonnet)

**Files.** Create `backend/app/routers/admin/audit.py`, `backend/app/schemas/audit_log.py`, `backend/tests/test_audit_log_api.py`. Modify `backend/app/main.py` (one import + one `include_router`), `backend/app/schemas/__init__.py` only if the package re-exports schemas.

**Contract:** `GET /api/admin/logs?actor&action&target_type&target_id&static_id&credential&from&to&page&page_size` → `AuditLogListResponse{items: list[AuditLogEntry], total, page, pageSize}`. `AuditLogEntry` (CamelModel, `from_attributes=True`) = every `AuditLog` column (`id, createdAt, actorUserId, actorLabel, credential, impersonatingUserId, adminOverride, action, targetType, targetId, targetLabel, staticGroupId, oldValues, newValues, requestId`). `from` is a Python keyword: `from_: str | None = Query(None, alias="from")`.

1. **Tests first.** Rows inserted through the ORM with fixed `created_at` strings in the helper's own form (`datetime(..., tzinfo=timezone.utc).isoformat()`, i.e. `+00:00`, never `Z` — `Z` sorts after `+` in text) unless noted. Non-admin → 403; admin xrp_ key → 403; no filters → all rows, `created_at desc, id desc` (two rows sharing a `created_at` come back higher id first); each filter alone (`actor`, `target_type`+`target_id`, `static_id`, `credential`); `action=static.` returns `static.deleted`/`static.updated` and not `statics.x` or `member.added`; `action=STATIC.` returns the same; `action=err%` and `action=static_` return nothing; `from` inclusive / `to` exclusive at an exact row timestamp; `to=2026-09-29T00:00:00Z`, `to=2026-09-29T05:30:00%2B05:30` and `to=2026-09-29` select the same rows; `to=2026-09-29T05:30:00+05:30` sent raw in a literal URL string, not via `params=` (httpx encodes `+` as `%2B`), so the `+` decodes to a space → 422; `from=garbage` → 422; `page_size=101` and `page=0` → 422; `credential=cookiex` → 422; `total` independent of `page`; an audited static update whose `settings.discovery` carried a webhook secret → the API response has no secret key; end-to-end: delete a static through the API, then find its row via `static_id`.
2. Implement per R-AD-H. Count with `select(func.count()).select_from(<filtered subquery>)`, the `analytics.py:511-514` idiom.
3. **Gates:** full backend pytest, ruff on touched files, `git diff --check`.

## Task 4 — Privacy disclosure + cross-reference notes (`xivrp-implementer`, sonnet)

**Files.** Modify `frontend/src/pages/PrivacyDocs.tsx`, `design/redesign/V2_COVERAGE_PLAN.md`, `design/redesign/ROLLOUT_ROADMAP.md`. Test: extend or create `frontend/src/pages/PrivacyDocs.test.tsx` (check for an existing one first).

1. **PrivacyDocs, test-first:** a render test asserts the text "Admin Action Log" and "No IP addresses" appear. Then:
   - Add a row to the `DataTable()` data (`:75-85`, rows are `{ field, collected, purpose }`, three columns at `:93-95`): `{ field: 'Admin Action Log', collected: true, purpose: 'A record of administrative and destructive actions (deleting a static, removing a member, changing a role, an admin reviewing error reports): who acted, when, what changed, and whether it came from the website or the plugin. Visible only to site admins and kept indefinitely. No IP addresses, browser details or secrets.' }`. Mind the single-quote escaping rule if the copy changes.
   - Add a new card to the privacy-changes section (`:455-490`), in the same markup as the existing "v1.11.1 - Email Removal / January 2026" card (`:467-468`), placed above it: heading `v2.1.52 - Admin Action Log` as a **literal string** (the AD1b release entry's version; `CURRENT_VERSION` would drift on the next release — do not import it), date "September 2026", body: *"We added an admin action log. It records administrative and destructive actions — who acted, when and what changed — so site admins can see what happened when something goes wrong. It records actions, not browsing, and does not record IP addresses, browser details or secrets such as webhook URLs or tokens."*
   - No new components; design-system rules apply; "static" never "group".
2. **Cross-reference notes** (intent only, no status changes): in `V2_COVERAGE_PLAN.md` § Stage 5 (`:128-130`) append: *"2026-09-29: Admin runs as its own workstream — spec `specs/2026-08-08-admin-v2-spec.md`, plan `plans/2026-08-08-admin-v2-plan.md` (AD1a #241 merged; AD1b = wave-1 audit emits + Logs API, plan `plans/2026-09-29-ad1b-audit-emits.md`)."* In `ROLLOUT_ROADMAP.md` § 9 Process notes (`:424`) append the same line prefixed "Admin V2 (off the ring roadmap):".
3. **Gates:** `pnpm -C frontend test PrivacyDocs`, `pnpm -C frontend lint` (0 errors), `pnpm -C frontend check:design-system:strict`, `pnpm -C frontend build`.

## Finish (controller)

1. **Demo transcripts** against the dev server (`:8001`), dev-auth logins (DevOwner is an admin and DEVTST's real owner, `dev_auth.py:406-407,450-452`):
   - (a) DevOwner cookie `PUT /api/static-groups/{DEVTST id}` rename → `GET /api/admin/logs?static_id=…` shows `static.updated` with the name diff, `credential: "cookie"`, **`adminOverride: false`**. Rename back.
   - (a2) dev user 1 creates a scratch static; DevOwner renames it → the row shows **`adminOverride: true`**; DevOwner deletes it → `static.deleted` still listed under its `static_id`.
   - (b) a member role change on DEVTST sent with an xrp_ key → `credential: "api_key"`; change it back.
   - (c) `GET /api/admin/logs` with an xrp_ key → 403; `?from=garbage` → 422.
   Paste into the PR body.
2. Screenshot of the PrivacyDocs row and the new history card → `docs/redesign/pr-shots/`.
3. Plan write-back once (rulings that bind AD2+/AD8: R-AD-A seam, R-AD-B placement, R-AD-G conventions, R-AD-H semantics), memory note update, `pr-checklist`, gates, draft PR with the V1-safety enumeration (every hunk in the shared-file list above, with the V1 path each reaches). File the R-AD-D follow-up as the next PR.

## Outcome (2026-09-30): what binds AD2+ / AD3 / AD8

AD1b shipped as two stacked PRs: A (plan + Tasks 1–2) and B (Tasks 3–4). Tasks 1–2 alone came to ~1,640 lines against the ~1,500 cap. The whole-branch review found C/I/M = 0/0/6 and ruled the slice spec-compliant.

- **R-AD-A, B, G and H hold as written.** Every later emit uses `admin_override_for(session, user.id, group_id, <membership the require_* returned>, <that check's min_role>)`, placed per R-AD-B, with R-AD-G's target conventions. Old and new value keys are snake_case (`share_code`, `is_public`), as the table prescribes. The API's column keys are camelCase.
- **AD8 (permission layer):**
  - An admin in a real lead seat who promotes someone to lead records `adminOverride: false`: the check's `min_role` is LEAD, even though the promotion itself needs owner rank. R-AD-A prescribes this. Revisit if AD8 moves the role check into the permission layer.
  - `create_admin_membership` logs `admin_access_granted` every time it is called. That includes the call made only to feed `admin_override_for` in admin-assign (`tiers.py`), which also runs for real-owner admins. A log-free constructor belongs with AD8.
- **AD3 (the admin Logs UI):**
  - An invalid `from`/`to` returns 422 with `{"detail": "<string>"}`. FastAPI's own 422s (`page`, `page_size`, `credential`) return `{"detail": [...]}`. Handle both shapes.
  - Request query params are snake_case (`page_size`, `target_type`, `static_id`, …) while response keys are camelCase (`pageSize`, `targetType`, …); an empty-string filter is treated as unset.
  - `new_values` can omit a key whose value is `None` when the old side lacks it (e.g. `unlinked_player_id`). Treat value keys as optional.
  - The `action` filter lowercases the input. SQLite tests can't prove this, because LIKE is case-insensitive there.
- **Latent bugs found and fixed:**
  - `transfer_ownership` 500'd after committing on main (`member_count` lazy-load → `MissingGreenlet`). Fixed with `load_memberships=True`; PR A has a public release line for it.
  - `CatalogSyncResult.counts` was too narrow for the real sync shape. Widened to `dict[str, Any]`.
- **Still open:** R-AD-D (import-verified-ids never commits) is its own follow-up PR.
