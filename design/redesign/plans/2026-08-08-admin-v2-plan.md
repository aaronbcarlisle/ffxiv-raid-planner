# Admin Dashboard V2 — Implementation Plan (Workstream: Stage-5 Admin)

> **For agentic workers:** This is the workstream plan (the `phase-d-loot-plan.md` analog). Each slice below is one PR, implemented in a **fresh session** that authors its own detailed task plan (superpowers:writing-plans → subagent-driven-development) against this doc + the spec. Do not implement multiple slices in one session.

**Goal:** Replace the 4-page admin area with a six-route, design-system-native admin platform: user search/inspection, static↔user cross-lookup, site-wide action log, engagement metrics, and explicit audited admin control verbs.

**Spec:** `2026-08-08-admin-v2-spec.md` (same directory; §-references below point there). Rulings R1–R8 binding. **Director-vetted 2026-08-08 (SHARED-DRIFT findings incorporated; spec §11).**

**Architecture:** Substrate-first — consolidated JWT-only admin backend + `audit_log` table land before any UI; one `ui/DataTable` chassis feeds all list surfaces; entity drawers + deep-linked Logs make every admin object cross-navigable.

**Tech stack:** FastAPI + SQLAlchemy (portable types; alembic per model — CI guard), React 19 + TS + Tailwind 4, `@tanstack/react-table` (new dep, headless), recharts (installed), Zustand where stateful.

## Global constraints (every slice)

- PR ≤ ~1,500 changed lines; splits are pre-declared below, not discovered at review.
- **Two-part V1-safety assert on every slice touching shared code** (spec §10): (1) `git diff --stat` over legacy-only paths empty; (2) every hunk in a shared file enumerated in the PR body with the exact V1 render path it reaches. R3's lighter cadence does not waive this.
- `releaseNotes.ts` entry, `internal: true` — invoke `pr-checklist` skill before opening any PR.
- Screenshots embedded on every UI PR (chrome-devtools; light+dark whenever chart/token colors are touched). **Backend-only slices demonstrate "done" with request/response transcripts against the dev server** — a green pytest is not a demo.
- Gates before push: `pnpm build` (`tsc -b`) · `pnpm dupes` (blocking in CI) · `pnpm deadcode` vs a baseline captured in AD3 · `pnpm tokens:check`.
- Every new model/column ships its alembic migration in the same PR (`server_default=sa.false()` for booleans; idempotency guards — PR #233 lesson). **Single-head discipline:** rebase migration heads in PR-merge order (the three admin migrations collide with each other, not with Phase D, which has shipped zero backend changes).
- Design system: primitives only, semantic tokens, 12px floor; `design-system-ignore` only with justification.
- No AI attribution in commits/PRs. "Static" not "group" in user-facing text (includes the PrivacyDocs rider).
- Audit-ordering tests: sleep(0.02) between writes or injected clock (Windows 15.6 ms tick).
- Boundary lint: shared components go in `components/ui/`, never `components/admin/` (`ring→admin` edges fail-on-new).
- URL params: `useAdminListParams` uses raw `searchParams` (the `AdminStatics.tsx:84-116` approach) — **never** register generic names (`q`/`page`/`sort`/`dir`) into `useUrlTabState`'s module-global registry (wiped by `useGroupViewState.ts:320` / `Profile.tsx:139`).
- Phase-D coordination: `ui/SortableHeader` **first-mover constraint** — AD3 consumes its existing `field/currentField/currentDirection/onSort` API unchanged; any API change is negotiated with the D9a owner before AD3 opens.

## Pre-flight gates

*(Ban-UX ruling RESOLVED 2026-08-08 as spec R9 — minimal lockout screen; AD2 is unblocked and includes that surface.)*

| Gate | Blocks | Action |
|---|---|---|
| **Backup/restore runbook** | AD5, AD6a merge | Verify Railway PG backup/PITR; refresh the prod dump (current one is 2026-07-12); document + test restore (pg_dump flow proven in Phase G). |
| **Affordance-parity matrix sign-off** | AD3+ (any page replacement) | Spec Appendix A — user approves before the first rebuilt page ships. |
| **Director vetting** | AD1a/b, AD5, AD6a/b | xivrp-director vets slice plan pre-implementation + diff post-implementation. **AD6a's seam enumeration is director-vetted before implementation.** Other slices: standard review loop. |

---

## Slice table (12 PRs)

| # | Slice | Contents | Depends on | Est. size |
|---|-------|----------|-----------|-----------|
| AD1a | Admin auth substrate | `routers/admin/` package + `require_admin` JWT-only · lockdown of 11 analytics + 3 static_groups + catalog-audit GET + tiers admin-assign · Forbidden bugfix · `audit_log` model + migration + `services/audit.py` · `request.state.request_id` + `auth_credential` threading | — | ~900 |
| AD1b | Wave-1 emits + Logs API | ~12 wave-1 emit points (admin verbs + destructive ops) w/ old/new diffs + `admin_override` threading · `GET /api/admin/logs` · PrivacyDocs rider · roadmap cross-ref note | AD1a | ~800 |
| AD2 | Users backend | ban columns + enforcement (both validators + refresh) + banned-user surface per ruling · users list/dossier/PATCH · cross-entity search · engagement metrics · admin key revoke | AD1a | ~1,300 |
| AD3 | Table chassis + Logs tab | `@tanstack/react-table` + `ui/DataTable` · `Modal variant="drawer"` (additive) · `useAdminListParams` · `/admin/logs` page + Logs sidebar link · sidebar primitives rebuild (existing 4 links + Logs; no dead nav) · scrollbar fix (`AdminLayout.tsx:60` only) · deadcode baseline capture | AD1b | ~1,400 |
| AD4 | Users tab | `/admin/users` + dossier drawer + mutation UI + key oversight · omnisearch · sidebar Users link · Ctrl+Shift+S retarget · **AssignUserModal untouched** (`admin/all-users` stays; retirement = recorded follow-up) | AD2, AD3 | ~1,300 |
| AD5 | GDPR service | `account_data.py` + export/delete/preview endpoints · orphan test (48 tables) · `ConfirmModal confirmText` (additive) · drawer danger zone · soft-deleted-statics blocker rule | AD2, AD4 | ~1,200 |
| AD6a | Statics backend | `deleted_at` migration · **seam mechanism: single StaticGroup accessor OR failing-test guard** (18 sites / 9 modules — spec §6) · dossier/transfer/delete/restore/preview endpoints | AD1b | ~1,000 |
| AD6b | Statics frontend | `/admin/statics` rebuild on DataTable + StaticDrawer · View As picker rebuild + `useStaticMembersForAdmin` dedupe · type-to-confirm verbs | AD3, AD6a | ~1,100 |
| AD7 | View As enforcement | `X-View-As` header in `services/api.ts` · standalone read-only middleware + telemetry exemptions · `admin.view_as_started` emit · banner hint · **V1-visible: sanctioned-edit justification + release note** · raw-fetch boundary enumerated | AD1a | ~500 |
| AD8a | Emits: waves 2–3 | Static CRUD/membership/invitations/join-requests/roster/claim/release + loot/material/page/gear/BiS/weapon-priorities emit points + shape tests + rollback spot test | AD1b | ~900 |
| AD8b | Emits: waves 4–5 | Schedule/RSVP/settings/player-hub/collections + `auth.login`/key events/PKCE + Logs family-filter chips | AD8a | ~900 |
| AD9a | Overview rebuild | KPI row (AdminKpiCard de-debt + SVG sparklines) + engagement metrics · growth + merged usage modules · theme-aware chart palette (dataviz skill) · range in URL · delete AdminUsage + redirect | AD2, AD3 | ~1,200 |
| AD9b | Errors + Ops + ratchet | Errors rebuild (server sort, drawer, fixed badge, surfaced errors) · `/admin/ops` + sidebar link (catalog sync/seed/audit buttons + job status) · catalog sync/seed → JWT-only · **retire admin's *usage* of `admin/SortableHeader` — files stay (R-46/AllWeeksView)** · lint ratchet warn→error on admin dirs | AD3 | ~1,300 |

Recommended order: AD1a → AD1b → AD2 → AD3 → AD4 → AD7 → AD5 → AD6a → AD6b → AD8a → AD8b → AD9a → AD9b. (AD7 small, unlocks safe impersonation early; AD8a/b can interleave anywhere after AD1b.)

---

## AD1a — Admin auth substrate (director-vetted)

**Files:** Create `backend/app/routers/admin/{__init__,deps}.py`, `backend/app/models/audit_log.py`, `backend/app/services/audit.py`, `backend/alembic/versions/<id>_add_audit_log.py`, `backend/tests/test_admin_auth.py`, `backend/tests/test_audit_helper.py`. Modify `backend/app/dependencies.py` (set `request.state.auth_credential` in `_validate_jwt`/`_validate_api_key` — signature change; callers at :156/:182/:210 already hold `request`), `backend/app/middleware/request_id.py` (**one line: set `request.state.request_id`** — also fixes the latent `exceptions.py:139` always-None bug), `backend/app/routers/analytics.py` + `static_groups.py` (3 admin routes) + `collection_catalog.py` (audit GET; Forbidden→PermissionDenied ×4) + `tiers.py:1426` admin-assign (all → shared `require_admin`), `backend/app/models/__init__.py`.

**Contract (later slices consume):**
- `require_admin` dependency (JWT-only) from `routers/admin/deps.py`.
- `audit(session, *, actor: User, action: str, target_type: str, target_id: str, target_label: str, static_group_id: str | None = None, old: dict | None = None, new: dict | None = None, request: Request | None = None) -> None` — same-session add; caller's commit finalizes. Schema per spec §3.1.

**V1-safety:** `dependencies.py` + `request_id.py` hunks enumerated in PR body (every authenticated request in both shells flows through them; behavior delta = none for non-admins, xrp_ 403 for admin routes only).

**Tests:** xrp_ key → 403 on every locked route; non-admin catalog call → 403 not 500; audit row commits atomically with mutation AND is absent after forced rollback; `request.state.request_id` populated (and error-report context regression). **Demo:** transcripts — xrp_ vs cookie against a locked route.

## AD1b — Wave-1 emits + Logs read API (director-vetted)

**Files:** Create `backend/app/routers/admin/audit.py`, `backend/tests/test_audit_log_api.py`. Modify `backend/app/routers/{analytics,static_groups,tiers,loot_tracking,collection_catalog}.py` (emit points), `backend/app/permissions.py` (thread `admin_override` flag out of `create_admin_membership`), `frontend/src/pages/PrivacyDocs.tsx` (disclosure rider — "static" vocabulary), `design/redesign/V2_COVERAGE_PLAN.md` + `ROLLOUT_ROADMAP.md` (dated cross-ref, intent only, no status changes).

**Wave-1 emit points:** error review/unreview/batch-review; catalog sync/seed/import-verified-ids; static update/delete/transfer_ownership/duplicate; member add/remove/role-change; tier delete; player delete; week revert; admin-assign. Old/new changed-field diffs; `admin_override=True` when access rode the virtual-owner path.

**Contract:** `GET /api/admin/logs?actor&action&target_type&target_id&static_id&credential&from&to&page&page_size` → `{items, total, page, page_size}`, order `created_at desc, id desc`; `action` filter is prefix-match (`static.` = family).

**Tests:** filters (actor/action-prefix/static/time-range); pagination; clock-tick discipline; `admin_override` set on a virtual-owner mutation and NOT set on a real-owner one. **Demo:** transcript of a mutation → its log row via the API.

## AD2 — Users backend

**Files:** Create `backend/app/routers/admin/{users,search,metrics}.py`, `backend/alembic/versions/<id>_add_user_moderation_columns.py`, `backend/app/schemas/admin_users.py`, tests. Modify `backend/app/models/user.py` (+`is_banned`, `banned_reason`, `admin_notes`), `backend/app/dependencies.py` (ban checks in both validators), `backend/app/routers/auth.py` (refresh rejects banned), plus the banned-user lockout surface per spec R9 (`services/api.ts` intercepts 403 `ACCOUNT_DISABLED` → full-screen notice + reason — V1-safety assert).

**Contract:**
- `GET /api/admin/users` — row: id, discord_id, discord_username, display_name, avatar_url, is_admin, is_banned, created_at, last_login_at, ui_shell, membership_count, owned_count, plugin_active. Search: name fields + discord_id + character names (EXISTS over `player_characters.name`, `snapshot_players.name/lodestone_name`, `static_character_registrations.manual_character_name`).
- `GET /api/admin/users/{id}` — dossier per spec §4 (never key hashes).
- `PATCH /api/admin/users/{id}` — `{display_name?, is_admin?, is_banned?, banned_reason?, admin_notes?}`; audited per field (`user.updated`, `user.banned`, `user.unbanned`, `user.admin_granted`, `user.admin_revoked`).
- `GET /api/admin/search?q=` → `{users: [≤8], statics: [≤8]}`.
- `GET /api/admin/metrics/engagement` → `{dau, wau, mau, stickiness, daily_active_series[30], signups_series[30], shell_split, plugin_active_count}` (DNT caveat in schema docstring; >90d from daily aggregates).
- `DELETE /api/admin/api-keys/{key_id}` → `is_active=False`, audited `api_key.admin_revoked`.

**Tests:** banned → 403 on JWT, API-key, and refresh paths; unban restores; next-request effectiveness; character-name search finds owner; dossier shape; metrics math on seeded events; self-admin-revoke allowed + audited. **Demo:** transcripts (ban → next request 403; search).

## AD3 — `ui/DataTable` + Logs tab (parity matrix signed before merge)

**Files:** Create `frontend/src/components/ui/DataTable.tsx` (+test), `frontend/src/hooks/useAdminListParams.ts`, `frontend/src/pages/admin/AdminLogs.tsx`, `frontend/src/components/admin/LogDiff.tsx`. Modify `frontend/package.json` (+`@tanstack/react-table`), `frontend/src/components/ui/Modal.tsx` (**additive `variant="drawer"`** — right-side panel, full-height, focus-trapped; V1-safety assert; `sheet` untouched), `frontend/src/components/admin/AdminSidebar.tsx` (primitives; existing 4 links + Logs — Users/Ops links land with their routes), `frontend/src/pages/AdminLayout.tsx` (**`:60` v2 branch only** — remove inner `overflow-y-auto`; legacy `:62` byte-identical per `AdminLayout.tsx:26`), `frontend/src/App.tsx` (route).

**Contract:**
- `DataTable<T>` props: `columns` (ColumnDef), `data`, `mode: 'client' | 'server'`, server callbacks (`pageCount`, `state`, `onStateChange`), `selection?`, `onRowClick?`, `loading?`, `emptyState?`, `columnVisibility?`. Headers via `ui/SortableHeader` **existing API unchanged** (first-mover constraint). Always `overflow-x-auto`-wrapped.
- `useAdminListParams({defaults})` — raw-`searchParams` sync of `q/page/sort/dir` w/ back/forward reconciliation; NOT registered in `useUrlTabState`'s global registry.
- `/admin/logs`: server-mode DataTable over `GET /api/admin/logs`; filter bar (actor id/text input until AD4 wires the picker — declared degradation; action-family Select; target-type Select; static search; from/to inputs); row → drawer with full context + `LogDiff` (field-level old→new; raw JSON expander). All filters in URL.

**Also:** capture `pnpm deadcode` baseline for the workstream. **Tests:** DataTable client sort/paginate/selection; server-mode callbacks; deep-link hydration; Modal drawer variant a11y (focus trap, esc). Screenshots: logs populated (dev seed), sidebar, scrollbar before/after, drawer variant.

## AD4 — Users tab + drawer

**Files:** Create `frontend/src/pages/admin/AdminUsers.tsx`, `frontend/src/components/admin/UserDrawer.tsx`, `frontend/src/components/admin/AdminOmnisearch.tsx`. Modify `frontend/src/components/admin/AdminSidebar.tsx` (+Users link), `frontend/src/hooks/useGlobalKeyboardShortcuts.ts` (Ctrl+Shift+S → `/admin/users`; V1-safety line — shared hook, key + description unchanged in `keyboardShortcutGroups.ts`).

**AssignUserModal is untouched** (director finding #5): it depends on `admin/all-users`' group-scoped `is_member`/`member_role` (`static_groups.py:581-582`) and full-list picker UX, and renders on V1 PlayerCards. `admin/all-users` stays; its retirement is a recorded follow-up tied to a future AssignUserModal redesign.

**Contents:** server-mode DataTable over AD2's endpoint; row → `UserDrawer` (`Modal variant="drawer"`): identity header (avatar, names, discord id, badges) · memberships (links → static drawer once AD6b lands; plain rows until then — declared degradation) · owned statics · claimed slots · characters · API keys w/ revoke (ConfirmModal) · admin editor (display_name, admin_notes, ban toggle + reason; is_admin toggle w/ warning copy) · "View action log" → `/admin/logs?actor={id}` · recent errors. Omnisearch mounts in the admin header (all pages).

**Tests:** drawer dossier fixture; mutation error surfacing; omnisearch debounce/abort; wires Logs actor filter to the picker. Screenshots.

## AD5 — GDPR service (director-vetted; backup gate)

**Files:** Create `backend/app/services/account_data.py`, `backend/app/routers/admin/account_data.py`, `backend/tests/test_account_data.py`. Modify `frontend/src/components/ui/ConfirmModal.tsx` (**additive `confirmText` prop** — type-to-confirm; V1-safety assert), UserDrawer (danger zone).

**Contract:**
- `export_user_data(session, user_id) -> dict` — JSON bundle per spec §5.
- `delete_preview(session, user_id) -> {blockers: [live owned statics], deletions: {table: count}, anonymizations: {table: count}}` — **soft-deleted owned statics are not blockers; they hard-purge during deletion** (spec §5).
- `delete_user(session, user_id, *, actor)` — refuses while blockers exist; emits `user.deleted` with no PII (target_label = truncated id).
- Orphan test: post-deletion, zero references to the user id across all 48 tables (FK introspection + known non-FK id columns, e.g. `tier_snapshots.weapon_priorities_locked_by`).

**UI:** UserDrawer danger zone: Export (JSON download) → Delete (preview counts + blockers; type-to-confirm with discord_username). Plan-M self-serve wrappers = recorded follow-up PR reusing this service. **Demo:** transcript of preview → export → delete → orphan check on dev seed.

## AD6a — Statics backend: soft delete + verbs (director-vetted; backup gate; seam enumeration vetted PRE-implementation)

**Files:** Create `backend/app/routers/admin/statics.py`, `backend/alembic/versions/<id>_add_static_soft_delete.py`, `backend/tests/test_static_soft_delete.py`. Modify `backend/app/models/static_group.py` (+`deleted_at` Text nullable) and the StaticGroup read paths per the chosen mechanism.

**Seam mechanism (required, not a hand list):** either (a) a single accessor (`get_live_static(session, ...)` / query helper) that all 18 `select(StaticGroup)` sites across 9 modules (`permissions.py`, `static_groups.py`, `join_requests.py`, `player.py`, `schedule.py`, `dev_auth.py`, `services/share_code.py`, `services/discord_guild_events.py`, `tasks/auto_sync.py`) are migrated onto, or (b) a guard test that greps/introspects for unfiltered `select(StaticGroup)` and fails on new ones. Director vets the enumeration + mechanism before implementation begins.

**Contract:** `GET /api/admin/statics/{id}` dossier per spec §4 · `POST .../transfer-ownership {new_owner_user_id}` (member-only; audited w/ old/new owner) · `DELETE` → `deleted_at` set (audited) · `POST .../restore` (audited) · `GET .../delete-preview` → cascade counts (members, tiers, players, loot/material/page rows, sessions).

**Tests:** soft-deleted static invisible via share code, discovery, member lists, non-admin fetch; admin sees w/ `include_deleted`; restore round-trips; transfer validates membership. **Demo:** transcripts.

## AD6b — Statics frontend rebuild (director-vetted)

**Files:** Create `frontend/src/components/admin/StaticDrawer.tsx`, `frontend/src/hooks/useStaticMembersForAdmin.ts`. Modify `frontend/src/pages/admin/AdminStatics.tsx` (rebuild on DataTable + `useAdminListParams`), `frontend/src/components/admin/ViewAsBanner.tsx` (adopt shared hook; de-debt raw buttons).

**Contents:** list + last-activity column + deleted-filter chip; StaticDrawer: members (role + user-drawer links) · tiers + weeks · volume stats · discord/schedule status · join requests · scoped audit deep-link (`/admin/logs?static={id}`) · View As picker (primitives; deduped fetch) · danger zone (transfer/delete/restore, type-to-confirm + preview). Screenshots.

## AD7 — View As enforcement (V1-visible; sanctioned edit + release note)

**Files:** Create `backend/app/middleware/view_as.py`, tests. Modify `backend/app/main.py` (register — **standalone middleware; auth is a route dependency, so this check uses header presence only, needing no identity**), `frontend/src/services/api.ts` (attach header from viewAsStore), `frontend/src/stores/viewAsStore.ts` (fold the `admin.view_as_started` emit into the existing `admin/user-role` GET handler server-side — one fewer endpoint; record this decision), `frontend/src/components/admin/ViewAsBanner.tsx` (read-only hint).

**Contract:** `X-View-As` + method ∈ {POST,PUT,PATCH,DELETE} → 403 `{code:"VIEW_AS_READ_ONLY"}`; exempt `/api/analytics/events`, `/api/analytics/errors`. **PR body:** sanctioned-edit justification (V1-visible behavior change: impersonating admins lose mutations in legacy chrome too — makes `viewAsStore.ts:5`'s docstring true) + release-note entry + raw-fetch boundary enumeration (`stores/authStore.ts`, `pages/PublicProfile.tsx` bypass `authRequest`; neither is a group-scoped mutation) + note retiring the two parked Phase-G decision points.

**Tests:** mutation blocked w/ header; reads pass; telemetry exempt; emit on start. **Demo:** transcript (mutation w/ and w/o header).

## AD8a / AD8b — Emit rollout (product-ring blast radius — own risk framing)

These two PRs edit ~20 **product** routers; the blast radius is the product, not `/admin` (spec §10). Both carry the full V1-safety assert, per-family shape tests, and a rollback-atomicity spot test each. Family lists per spec §3.3 (decorator-site enumeration from recon report §7). Verb catalog maintained in `services/audit.py` docstring — the single source of action names. AD8b adds Logs family-filter chips as families land.

## AD9a — Overview rebuild

**Files:** Modify `frontend/src/pages/admin/AdminOverview.tsx` (rebuild: PageHeader, KPI row w/ engagement metrics + SVG sparklines in de-debted AdminKpiCard, growth charts, merged usage modules w/ paginated top-events table + category breakdown), Create `frontend/src/components/admin/chartPalette.ts` (CSS-var reads; replaces dark-pinned hex + ignores). Delete `frontend/src/pages/admin/AdminUsage.tsx`; `/admin/usage` → redirect. **Load `dataviz` skill before chart code.** Range in URL. Screenshots light + dark (token change).

## AD9b — Errors + Ops + ratchet

**Files:** Modify `frontend/src/pages/admin/AdminErrors.tsx` (rebuild on server-sorted DataTable: filters in URL, detail drawer w/ occurrences + stack/context expanders + user-drawer links, global badge shared w/ sidebar, surfaced mutation errors, batch review via selection). Create `frontend/src/pages/admin/AdminOps.tsx` + sidebar link (catalog sync/seed/audit buttons — first browser callers — + job/retention status). Backend: catalog `sync`/`seed` → `require_admin` JWT-only (**import-verified-ids keeps the permanent carve-out**). **`components/admin/SortableHeader.tsx` + `sortUtils.ts` are NOT deleted** — V1 `AllWeeksView.tsx:13-14` consumes them under R-46; this slice removes only *admin's* remaining usage; file deletion awaits a separate AllWeeksView ruling. Lint ratchet: `components/admin/` + `pages/admin/` warn→error; remove file-level eslint-disables.

---

## Workstream acceptance (done means)

1. All 6 routes live on primitives; zero file-level design-system disables in admin dirs; ratchet at error.
2. Any user findable in <5s by name/discord-id/character; dossier answers "who is this, what statics, what keys, what happened lately" in one drawer.
3. Both cross-lookups: user→statics and static→members(+users), drawer-to-drawer.
4. Logs tab answers "what happened in static X last week" and "what did admin Y do" with deep-linkable filters; every admin verb + wave 2–5 family emits atomically.
5. Ban/unban, admin grant/revoke, name/notes edit, key revoke, static transfer/delete/restore, user export/delete — all live, all audited, destructive ones previewed + type-to-confirm.
6. View As is server-enforced read-only (documented raw-fetch boundary).
7. Admin surface is JWT-only except the **single documented carve-out** (`import-verified-ids`; admin-assign locked in AD1a, catalog POSTs in AD9b).
8. Engagement KPIs (DAU/WAU/MAU/stickiness, shell split, plugin-active) on Overview with theme-correct charts.
9. Plan-M self-serve endpoints remain a recorded follow-up wired to the AD5 service; `admin/all-users` retirement remains a recorded follow-up tied to AssignUserModal.

## Plan self-review record

Spec coverage: R1→AD1b/AD8a/b; R2→AD2/AD4/AD5/AD6a/b; R3→process; R4→AD7; R6→AD3/AD9a/b; R7→AD3 (seam kept, `:60` only); R8→AD1a schema. Appendix-A dispositions land in AD3/AD4/AD6b/AD9a/b. Director's 13 required changes: #1→AD9b (no deletion), #2→first-mover constraint (globals + AD3), #3→AD3 `:60` scoping, #4→AD1a request_id fix, #5→AD4 AssignUserModal untouched, #6→AD7 sanctioned-edit framing, #7→AD6a seam mechanism, #8→global V1-safety assert, #9→AD1a/b + AD6a/b pre-splits, #10→no-dead-nav link ordering, #11→ban-UX pre-flight gate, #12→admin-assign in AD1a + acceptance #7 rewrite, #13→dupes/deadcode/tokens gates. Suggestions adopted: drawer variant (AD3), registry avoidance (globals), AD8 risk framing, transcript demos, soft-deleted-blocker rule (AD5), PrivacyDocs vocabulary. Type/name consistency: `audit()` signature, `require_admin`, DataTable props, endpoint paths quoted identically across slices. No TBDs; declared degradations are labeled (AD3 actor filter, AD4 membership links).
