# Admin Dashboard V2 — Design Spec

**Date:** 2026-08-08 · **Status:** user-approved design; director-vetted (SHARED-DRIFT findings incorporated, see §11) · **Workstream anchor:** V2_COVERAGE_PLAN Stage 5 ("Docs & Admin fit-and-finish") · **Intended repo home:** `design/redesign/specs/2026-08-08-admin-v2-spec.md`

A ground-up upgrade of the site-admin area (`/admin`): user search & inspection, static↔user cross-lookup, a site-wide action log, richer metrics, and explicit admin control verbs — replacing the current four pages with a six-route, design-system-native surface. V2-idiom throughout; no V1 parity obligation for the admin surface itself (shell parity waived; the affordance-parity matrix in Appendix A is still required and user-signed). **Shared code this workstream touches remains under the full two-part V1-safety assert (§10).**

---

## 0. Rulings record (user decisions, 2026-08-08)

| # | Question | Ruling |
|---|----------|--------|
| R1 | Log capture breadth | **Site-wide action log** — all meaningful mutations app-wide, rolled out family-by-family (admin + destructive first) |
| R2 | Admin powers in scope | **All four**: user management (ban/disable, runtime is_admin, edit name) · user deletion + export (absorbs Plan M) · static verbs (transfer, delete w/ preview, soft-delete/restore) · API-key oversight |
| R3 | Sequencing vs Phase D | **Parallel, lighter cadence** — own PR stream in the Stage-5 slot; spec + sliced ≤1,500-line PRs; director vetting reserved for the risky slices. **R3 lightens director cadence only — it does not waive the two-part V1-safety assert (§10)** |
| R4 | View As | **Backend-aware + read-only enforced** (X-View-As header; mutations rejected while present) |
| R5 | Overall approach | **B — Platform rebuild** (substrate-first; A "extend in place" and C "max modern" rejected) |
| R6 | Admin IA | **6 routes, Usage folded into Overview**: Overview · Users · Statics · Logs · Errors · Ops |
| R7 | Shell strategy | **Shell-agnostic bodies** — new pages render in either chrome via the existing AdminLayout seam; built v2-native |
| R8 | Audit row context | **Metadata-lean** — no IP/user-agent; actor + credential + impersonation marker + request_id |
| R9 | Banned-user UX (ruled 2026-08-08) | **Minimal lockout screen** — `services/api.ts` intercepts 403 `ACCOUNT_DISABLED` → full-screen "Account disabled" notice (+ reason); V1-safety asserted, reachable only by banned users |

Carried assumptions (user-notified, unobjected): admin interventions stay **silent** to affected users (audit log records the truth internally); **auth logins are logged, token refreshes are not**; analytics/error telemetry ingestion endpoints are exempt from the View As mutation block.

All rulings resolved — no open questions gate the slice pipeline.

## 1. Context: what exists and what's missing

Current state (verified by 9-agent recon + director spot-checks, 2026-08-08):

- `/admin` = 4 route-pages (Overview/Statics/Usage/Errors) under `AdminLayout` + `AdminSidebar`, v2-chromed since Stage 1 via the sanctioned `inV2Chrome` seam (`AdminLayout.tsx:57-63`). Known carry-forward: spurious ~17px scrollbar under v2 (nested `overflow-y-auto`: `AppChrome.tsx:238-240` + the v2 branch's inner container at `AdminLayout.tsx:60`).
- Backend: exactly 19 admin endpoints; all reads except error-review flips. Three divergent admin-check patterns (`require_admin` local to analytics.py:55 — a plain helper, not a dependency; inline `is_user_admin`; raw `current_user.is_admin`). All accept xrp_ API keys (`get_current_user`).
- Admin mutation power = the **virtual-owner bypass** (`permissions.py:24-46, 245-247`): admins pass every owner check on any static via a never-persisted in-memory Membership. Invisible in responses, logged to stdout only.
- **No audit log** of any kind (~140 mutation endpoints emit nothing; `static_activity_log` is a 12-row mount-farm-only prototype). **No user search/detail endpoints.** **No admin mutations on users or statics.** View As is 100% client-side. `DELETE /api/auth/me`/export (Plan M) unbuilt. No soft-delete anywhere; deletes hard-CASCADE.
- Known bug 1: `collection_catalog.py:85,104,134,155` imports nonexistent `permissions.Forbidden` → non-admin callers get 500 (ImportError) instead of 403 on all 4 catalog admin endpoints.
- Known bug 2 (director-found): `RequestIDMiddleware` (`middleware/request_id.py:21-41`) never sets `request.state.request_id` — it only binds structlog contextvars and the response header. The sole reader, `exceptions.py:139`, **always gets None today**. AD1 fixes this (§3.2).

Prod calibration (railway_prod_copy, snapshot 2026-07-12; live ≈ 4 weeks ahead):

- 1,389 users · 481 statics · 1,261 memberships · whole DB **31 MB**. Exactly **2 admins**. 180 users (13%) active within 30 days.
- ILIKE over users (552 kB) is sub-millisecond → **no search infra** (pg_trgm/FTS/engines rejected). Largest plausible admin list ≈ 9k retention-capped analytics rows → **no virtualization**. Drill-in fan-out tiny (max 7 memberships/user, 12 members/static) → dossiers eager-load everything.
- `analytics_events` already has a working 90-day aggregate-then-delete retention loop (`tasks/analytics_retention.py`) — the template if audit retention is ever needed. Audit volume projection: **<10 MB/year** at generous rates → keep forever.

## 2. Backend platform

### 2.1 Router consolidation + auth lockdown

New package `backend/app/routers/admin/` (`users.py`, `statics.py`, `audit.py`, `metrics.py`, `search.py`, `ops.py`, `deps.py`), mounted under `/api/admin/*`. One shared dependency in `deps.py`:

```python
async def require_admin(user: User = Depends(get_current_user_jwt_only)) -> User:
    # JWT-only: a leaked xrp_ plugin key must never reach the admin surface
    # (today every admin endpoint accepts API keys via get_current_user).
    # No session dep: user.is_admin is on the row the validator just loaded.
    if not user.is_admin: raise PermissionDenied("Admin access required")
    return user
```

Migration of existing endpoints: existing paths **stay stable**; they adopt the shared dependency in AD1a (auth behavior change only). Full relocation into the package happens opportunistically in the slice that rebuilds each page's frontend.

**AD1a lockdown set:** all 11 analytics admin routes + 3 static_groups admin routes + catalog `audit` GET + **`tiers.py:1426` admin-assign** (admin-gated, browser-called; closing it is required for acceptance criterion #7).

**xrp_ carve-out (verified live caller):** `POST /api/admin/collection-catalog/import-verified-ids` keeps xrp_-accepting auth — the Dalamud plugin's `/xrp resolve-ids` posts to it (`RaidPlannerClient.cs:383`), it is is_admin-gated, idempotent, never-overwrites. Documented as the sole permanent xrp_-reachable admin endpoint. `sync`/`seed` currently have **no** browser invocation path (CSRF blocks cookie-POSTs without the header; no frontend caller) — they go JWT-only **in AD9b**, the same slice that gives them Ops-tab buttons.

**Bugfix (AD1a):** replace the four `from ..permissions import Forbidden` imports with `PermissionDenied` → non-admins get 403, not 500.

### 2.2 Ban / disable enforcement

New `users` columns (one migration, `server_default=sa.false()` per repo convention; idempotency guard per the PR #233 lesson):

- `is_banned` Boolean, `banned_reason` Text nullable, `admin_notes` Text nullable.

Enforcement is a row check, not token infrastructure (every request re-loads the User row; JWT carries only id/exp/type):

- `_validate_jwt` and `_validate_api_key` (`dependencies.py`) reject when `user.is_banned` → 403 `ACCOUNT_DISABLED`. Refresh handler (`auth.py:301-378`) rejects likewise. Effect: next-request lockout, including plugin keys (keys stay rows; unban restores everything). **Note:** these validators are shared auth-path code both shells and the plugin flow through — the AD2 PR carries the two-part V1-safety assert (§10) for this edit.
- **Banned-user UX (RULED — R9):** minimal designed surface — `services/api.ts` intercepts `ACCOUNT_DISABLED` and renders a full-screen "Account disabled" notice (+ reason when set). Touches the shared api client (V1-safety assert applies; interception keyed on the error code, so non-banned users are unreachable by construction). Ships in AD2.
- Runtime `is_admin` grant/revoke via `PATCH /api/admin/users/{id}`. `ADMIN_DISCORD_IDS` remains the bootstrap/recovery path (re-grants at next login — self-revoke is recoverable; UI warns anyway). Both directions audited.

## 3. The audit log (site-wide action log)

### 3.1 Schema — `audit_log`

Portable types only (dev = SQLite `create_all`, prod = PG alembic; both must pass — CI enforces the round-trip):

| column | type | notes |
|---|---|---|
| `id` | Integer PK autoincrement | log-table convention |
| `created_at` | Text ISO-8601 UTC, **indexed** | repo convention; lexicographic range queries proven by retention task |
| `actor_user_id` | String(36) FK users SET NULL, indexed | |
| `actor_label` | String(100) | denormalized; survives user deletion |
| `credential` | String(10) | `cookie` \| `api_key` \| `system` — first trustworthy plugin-vs-web attribution |
| `impersonating_user_id` | String(36) nullable | X-View-As target if header present |
| `admin_override` | Boolean default False | action rode the virtual-owner bypass (actor is admin AND not a real member) |
| `action` | String(60), indexed | dot-namespaced: `static.deleted`, `loot.logged`, `user.banned`, `admin.view_as_started` |
| `target_type` / `target_id` / `target_label` | String(30)/String(64)/String(200) | composite index (type, id); target_id is 64 — error-review targets are SHA-256 fingerprints (`error_reports.fingerprint`) |
| `static_group_id` | String(36) nullable, indexed | per-static scoping/filtering |
| `old_values` / `new_values` | sa.JSON nullable | changed fields only on update; full state on create; **never secrets** (deny-list: bot tokens, webhook URLs, key hashes) |
| `request_id` | String(64) nullable | from `request.state.request_id` (§3.2 fix); 64 matches the middleware's inbound X-Request-ID cap so stored value ≡ header/log value |

No IP/user-agent (R8). No FK to static_groups (rows must survive static deletion; id retained for filtering).

### 3.2 Emit semantics

`audit(session, *, actor, action, target, ...)` helper in `backend/app/services/audit.py`:

- **Same-session `session.add()`** — the audit row commits **atomically with the mutation**. Fire-and-forget (the `_capture_error_report` pattern) is explicitly rejected for mutations: it can record actions that rolled back, or lose rows for actions that committed.
- `credential` threaded from the auth path: `_validate_jwt`/`_validate_api_key` set `request.state.auth_credential` (signature change — all three callers at `dependencies.py:156/182/210` already hold `request`; shared-path edit, V1-safety assert applies).
- **`request_id` fix (AD1a):** `RequestIDMiddleware` gains one line setting `request.state.request_id` — a shared middleware edit on every request in both shells (V1-safety assert applies), which also repairs the latent `exceptions.py:139` always-None bug.
- `admin_override` computed where the virtual-owner path grants access (flag threaded from `permissions.create_admin_membership` to the emitting call sites).
- Diff computation: compare dicts, keep changed keys (~15 lines). Raw JSON of both sides available in the UI behind an expander.

### 3.3 Coverage rollout (R1: site-wide, family-by-family)

| Wave | Families | Slice |
|---|---|---|
| 1 | All admin verbs (error review, catalog ops, every new admin mutation) + destructive ops (static delete/transfer, member remove/role change, tier delete, player delete, week revert) | AD1b |
| 2 | Static CRUD, membership/invitations/join-requests, roster/player CRUD, claim/release | AD8a |
| 3 | Loot/material/page ledger, gear edits, BiS targets, weapon priorities | AD8a |
| 4 | Schedule/RSVPs/settings, Player Hub, collections/farming | AD8b |
| 5 | Auth: `auth.login` (OAuth callback), `auth.api_key_created/revoked`, plugin PKCE mint. **Not** refresh. | AD8b |

Skipped by design: reads, notification read-state, telemetry ingestion, dev-auth. **No backfill** — domain log tables (loot/material/page) remain their own history; the Logs tab starts at ship date.

### 3.4 Read API + retention

`GET /api/admin/logs` — server-paginated (the one genuinely unbounded table), filters: `actor` (user id), `action` (prefix match supports family filtering: `static.*`), `target_type`+`target_id`, `static_id`, `credential`, `from`/`to` (ISO strings), `page`/`page_size≤100`. Fixed order `created_at desc, id desc`.

Retention: **keep forever** (projection <10 MB/yr; 2 admins). The analytics retention loop is the ready template if this ever changes. `PrivacyDocs.tsx` gains a disclosure rider (action log exists, what it records, metadata-lean posture) in AD1b — user-facing copy, subject to the "static" not "group" vocabulary rule.

Test discipline: audit-ordering tests use the Windows 15.6 ms clock-tick mitigation (sleep 0.02 between writes or injected clock) — this has bitten the repo twice.

## 4. Admin API surface (new endpoints)

| Endpoint | Shape |
|---|---|
| `GET /api/admin/users` | Paginated (25/50), ILIKE search over `discord_username`/`display_name`/`discord_id` **+ character names** (EXISTS over `player_characters`, `snapshot_players.name/lodestone_name`, `static_character_registrations.manual_character_name`), sort (created_at, last_login_at, username), filters (is_admin, is_banned, plugin-active = key used <7d) |
| `GET /api/admin/users/{id}` | One-call dossier: user fields (incl. ui_shell, last_login_at, is_banned, admin_notes) · memberships w/ role + static name/share-code · owned statics · claimed roster slots (tier + static) · characters · API keys (prefix/name/last_used/expires/active — **never hashes**) · last 10 audit rows · recent error fingerprints · activity summary (last analytics event ts, 30d event count) |
| `PATCH /api/admin/users/{id}` | display_name, is_admin, is_banned(+reason), admin_notes — each change audited with old/new |
| `GET /api/admin/users/{id}/export` | GDPR JSON export (§5) |
| `GET /api/admin/users/{id}/delete-preview` | cascade/anonymize counts + **blockers** (owned statics must be transferred/deleted first) |
| `DELETE /api/admin/users/{id}` | GDPR deletion service (§5); type-to-confirm client-side |
| `DELETE /api/admin/api-keys/{key_id}` | revoke any user's key (`is_active=False`), audited |
| `GET /api/admin/statics/{id}` | dossier: members+roles+linked users · tiers (+current week) · loot/material volume · schedule/discord link status · join-request counts · created/owner · recent audit rows scoped to static |
| `POST /api/admin/statics/{id}/transfer-ownership` | `{new_owner_user_id}` — must be an existing member; audited |
| `DELETE /api/admin/statics/{id}` + `/restore` + `/delete-preview` | soft delete (§6) |
| `GET /api/admin/search?q=` | grouped `{users[≤8], statics[≤8]}` for omnisearch; plain ILIKE |
| `GET /api/admin/metrics/engagement` | DAU/WAU/MAU (distinct `analytics_events.user_id`; 1/7/28d), stickiness, 30d daily sparkline series, shell-adoption split (`ui_shell` counts), plugin activity (keys used <7d), signups series. >90d trends from `analytics_daily_aggregates`. DNT-undercount caveat in response docs |

Existing endpoints retained: `admin/all` statics list (gains last-activity field), error-group family, growth. **`GET /api/static-groups/admin/all-users` stays untouched** — its only consumer is V1-rendered `AssignUserModal` (`AssignUserModal.tsx:126`), which depends on the group-scoped `is_member`/`member_role` fields (`static_groups.py:581-582`) and the full-list picker UX; the AD2 users index does not replace those. Retirement is a recorded follow-up for whenever AssignUserModal itself is redesigned (director finding #5). Inconsistent unreviewed-error denominators (24h rows vs all-time groups) unify on **all-time unreviewed groups** for both KPI and sidebar badge.

## 5. GDPR service (absorbs Plan M §2/§3)

One service layer (`backend/app/services/account_data.py`), exposed twice: admin endpoints now (AD5), self-serve `DELETE /api/auth/me` + `GET /api/auth/me/export` later (thin wrappers, separate small PR — a real prod user request is waiting).

Per-table decision list (full enumeration lives in the service with a test asserting **zero orphaned user references** across all 48 tables):

- **Delete:** users row · memberships · api_keys · plugin_auth_codes · notifications · player_profile cascade (characters, gear/collection snapshots, job profiles, goals, BiS sets, intents) · availability (personal + per-static) · RSVPs · join requests · reward_participant_states
- **Anonymize (keep row, null user ref, relabel):** loot/material/page entries `created_by_user_id` → NULL (history belongs to the static) · `snapshot_players.user_id` → NULL (unclaim; roster row is static property) · analytics_events/error_reports `user_id` → NULL · audit_log `actor_user_id` → NULL + `actor_label` → "Deleted user" · resolved_by/created_by refs SET NULL
- **Blockers:** owned **live** static_groups — preview lists them; transfer or delete first (no silent owner deletion). **Soft-deleted owned statics do NOT block** — user deletion hard-purges them (they are already in the trash; keeping them would orphan the owner FK).
- Export: JSON bundle of everything in the Delete column + the user's authored rows in the Anonymize column. The deletion fulfillment itself is audited **without embedding erased PII** (target_label = truncated user id, no names).

## 6. Destructive-action safety

Friction proportional to blast radius:

- Low-risk verbs: `useDoubleClickConfirm` (existing).
- High-risk (static delete, user delete, ownership transfer): **type-to-confirm** — new `confirmText` prop on `ConfirmModal` (shared V1-rendered primitive: additive, V1-safety assert) — plus **consequence preview** from the `/delete-preview` endpoints ("deletes 8 players, 3 tiers, 214 loot entries").
- **Soft delete for statics only**: `deleted_at` Text nullable on `static_groups`. **Seam discipline (director-required):** there are **18 `select(StaticGroup)` sites across 9 modules** (`permissions.py`, `static_groups.py`, `join_requests.py`, `player.py`, `schedule.py`, `dev_auth.py`, `services/share_code.py`, `services/discord_guild_events.py`, `tasks/auto_sync.py`) plus relationship-loaded paths — a hand-maintained filter list is not acceptable. AD6a must ship **either** a single accessor all StaticGroup reads go through **or** a test that fails on any unfiltered `select(StaticGroup)` query, and the director vets the enumeration **before** implementation. `POST .../restore` un-deletes. No purge job initially (31 MB DB). Blanket soft-delete across 48 tables explicitly rejected.
- User deletion stays hard (GDPR semantics) but is export-prompted first.
- **Pre-flight gate (before AD5/AD6 merge):** verify Railway backup/PITR posture and write the tested restore runbook (pg_dump flow already proven — 2026-07-12 dump + localhost:5433 copy exist; refresh the dump as part of this gate).

## 7. View As — backend-aware, read-only (R4)

- Frontend `services/api.ts` attaches `X-View-As: {userId}` to every request while `viewAsStore` is active. **Stated boundary:** raw `fetch` call sites that bypass `authRequest` (`stores/authStore.ts`, `pages/PublicProfile.tsx`) do not carry the header — none of them are group-scoped mutations, but the enforcement boundary is the api client, not the browser (enumerated in the AD7 PR body).
- New **standalone middleware** (auth is a route *dependency*, not middleware — the chain at `main.py:144-153` terminates at Route; this check needs no identity, only header presence): if `X-View-As` present AND method ∈ {POST, PUT, PATCH, DELETE} → 403 `{code: "VIEW_AS_READ_ONLY"}`. Exempt paths: `/api/analytics/events`, `/api/analytics/errors` (telemetry, not user-data mutations). Safe on header presence alone (only our admin UI sends it; a non-admin sending it merely blocks themselves).
- **This is a V1-visible behavior change** (director finding #6): impersonating admins in the legacy shell also lose mutation ability — which makes `viewAsStore.ts:5`'s currently-false "read-only" docstring true. The AD7 PR carries a sanctioned-edit justification + release-note entry.
- `startViewAs` emits `admin.view_as_started` (actor = admin, target = user, static scoped) — the impersonation session record.
- Retires the two parked Phase-G decision points (View As Leave suppression; impersonated-owner Delete): mutations are blocked wholesale while impersonating, so both questions dissolve.
- UI: existing `ViewAsBanner` kept; gains a "read-only enforced" hint. Member-fetch duplication (`ViewAsBanner` vs `AdminStatics`) collapses into a shared hook during AD6b.

## 8. Frontend

### 8.1 IA — 6 routes (R6)

`/admin/overview` · `/admin/users` (new) · `/admin/statics` · `/admin/logs` (new) · `/admin/errors` · `/admin/ops` (new). Usage dissolves into Overview. `AdminSidebar` rebuilt on primitives (badge = all-time unreviewed groups, refreshed after review actions; mobile pattern kept). **No dead nav:** each sidebar link lands in the slice that ships its route (Logs → AD3; Users → AD4; Ops → AD9b). `Ctrl+Shift+S` retargets `/admin/users` when AD4 lands. Shell-agnostic bodies per R7; the ~17px v2 scrollbar dies in AD3 by removing the inner overflow container **on the v2 branch only (`AdminLayout.tsx:60`)** — the legacy branch (`:62`) keeps its element and class literals verbatim per the standing constraint at `AdminLayout.tsx:26`.

### 8.2 Table chassis

`ui/DataTable` — TanStack Table v8 (`@tanstack/react-table`, headless, ~15 kB) wrapper living in `components/ui/` (boundary rule: `admin/` is banned as an import target; shareable pieces go in `ui/`). Internally renders headers through the Phase-D keyboard-operable `ui/SortableHeader`.

**First-mover constraint (director-required, inverted from the original):** `ui/SortableHeader` currently has zero production consumers — AD3 is its first. `DataTable` consumes the existing `field/currentField/currentDirection/onSort` API **unchanged**; any API change must be negotiated with the D9a owner before AD3 opens (D9a will inherit whatever AD3 shapes).

**`components/admin/SortableHeader.tsx` + `sortUtils.ts` are NOT deleted** (director finding #1): V1's `AllWeeksView.tsx:13-14,520-526` consumes them under the R-46 freeze (`phase-d-loot-plan.md:86`; rationale at `ui/SortableHeader.tsx:4-9` — migrating AllWeeksView would change V1 tab order/focus rings on a frozen shell). This workstream retires **admin's usage** of them; the files themselves outlive it until a separate user ruling on AllWeeksView.

Features: client mode (Users/Statics/Errors at current scale) + server mode (Logs; manualPagination/manualSorting/manualFiltering), column-visibility dropdown, row selection (errors batch review), row-click → drawer, `TableSkeleton` loading, `EmptyState`, `overflow-x-auto` wrapper. No TanStack Query; no virtualization (non-goals).

### 8.3 Drawers, URL state, search

- **Entity drawers**: `Modal variant="sheet"` is a **bottom** sheet (`Modal.tsx:151-156`) — a mobile pattern, wrong for desktop admin dossiers. AD3 adds **`variant="drawer"`** (right-side panel, full-height, focus-trapped) to the shared Modal primitive — additive, V1-safety assert applies. User and static dossiers open in place preserving list position. Cross-links everywhere: log rows → actor/target drawers · error occurrence user-ids become links · drawers deep-link to `/admin/logs` pre-filtered (`?actor=` / `?static=`) · static drawer ↔ member user drawers. `UserStaticsModal` retired (dossier supersedes).
- **URL state**: new shared `useAdminListParams` hook generalizing AdminStatics' q/page/sort/dir sync (raw `searchParams`, back/forward reconciliation). **It must NOT register params into `useUrlTabState`'s module-global registry** (`useUrlTabState.ts:37-40`) — that set is wiped by `useGroupViewState.ts:320` and `Profile.tsx:139`, and registering generic names (`q`, `page`, `sort`, `dir`) plants a collision for future static-side params (director suggestion #2). `useUrlTabState` remains for genuinely enum-valued admin sub-views only, with admin-prefixed param names.
- **Omnisearch** in the admin header: Input-based grouped dropdown (users/statics) over `GET /api/admin/search`, 300 ms debounce, AbortController. **No cmdk dependency** — palette integration is reserved for coverage Stage 6.

### 8.4 Metrics UI

- `AdminKpiCard` upgraded: raw-button debt removed, optional ~20-line hand-rolled SVG sparkline (no chart-lib mount per tile).
- KPI row: total users (+7d), active statics, DAU/WAU/MAU + stickiness, unreviewed errors (fixed denominator), plugin-active users, shell split.
- recharts (installed) for the 2–3 trend charts (signups, DAU, growth) with **theme-aware colors** — a chart-palette module reading CSS custom properties replaces the dark-pinned hex + `design-system-ignore` blocks. Usage modules (top events table, category breakdown) fold in below the fold. **Load the `dataviz` skill before writing any chart code** (repo trigger rule).

### 8.5 Design-system compliance

All primitives (Button/IconButton/Input/Checkbox/Select/Modal/Tag/Tabs/PageHeader/LinkText/Skeleton/EmptyState); kills the file-level `no-raw-button` disables (`ViewAsBanner`, `AdminBanners`, `AdminKpiCard`), raw checkboxes, hand-rolled View As modal, `text-teal-400`; 12px floor; right-click-only affordances replaced with visible actions (context menus kept as accelerators). Final slice (AD9b) ratchets `components/admin/` + `pages/admin/` lint **warn→error**.

## 9. Non-goals (rejected as overkill at 1,389 users — revisit only on order-of-magnitude growth)

TanStack Query · list virtualization · pg_trgm/FTS/external search engines · cohort-retention heatmaps · SSE/websocket live updates · blanket soft-delete · impersonation token infrastructure (act claims, time-boxes, justification prompts) · infra/process-log ingestion (Railway logs stay in Railway; request_id is the bridge) · audit-log query language (discrete filters win) · CSV export (JSON export exists for GDPR; add on demand) · deletion of `components/admin/SortableHeader.tsx`/`sortUtils.ts` (R-46-frozen V1 consumer).

## 10. Slotting, process, risks

- **Anchor:** Stage 5 (V2_COVERAGE_PLAN.md:124-126). Admin is platform (PRODUCT_MODEL §3.6, §5 verdict) — off the ring roadmap, no cross-edits to it. ROLLOUT_ROADMAP/V2_COVERAGE_PLAN get a dated cross-reference note in AD1b (intent only, no status changes).
- **Parallel to Phase D** (R3). Collision surface: `ui/SortableHeader` first-mover constraint (§8.2), `releaseNotes.ts` appends, additive token edits, **alembic single-head sequencing** (the three admin migrations sequence against each other; Phase D has shipped zero backend changes to date).
- **Two-part V1-safety assert (per V2_COVERAGE_PLAN.md:142-146, operationalized as in phase-d-loot-plan.md:216-221) applies to EVERY slice touching shared code:** (1) `git diff --stat` over legacy-only paths is empty; (2) every hunk in a shared file is enumerated in the PR body with the exact V1 render path it reaches. Shared files this workstream touches: `services/api.ts`, `stores/viewAsStore.ts`, `components/ui/ConfirmModal.tsx`, `components/ui/Modal.tsx`, `pages/AdminLayout.tsx`, `hooks/useGlobalKeyboardShortcuts.ts`, `backend/app/dependencies.py`, `backend/app/permissions.py`, `backend/app/middleware/request_id.py`, `frontend/src/pages/PrivacyDocs.tsx`. R3's lighter cadence does not waive this.
- **AD8 risk framing (director suggestion #3):** AD8 is the one part of this workstream whose blast radius is the **product**, not `/admin` — it edits ~20 product-ring backend routers. It carries the V1-safety assert, per-family shape tests, and rollback-atomicity spot tests, and lands as two PRs.
- **Cadence (lighter, R3):** every slice ≤1,500 lines · releaseNotes `internal: true` entries · screenshots on every UI PR · `pnpm build` + `pnpm dupes` + `pnpm deadcode` (vs captured baseline) + `pnpm tokens:check` before push · migration-per-model (CI guard from #233) · director (xivrp-director) vets AD1a/b, AD5, AD6a/b plans + diffs, and the AD6a seam enumeration **pre-implementation** · fresh session per slice. **Backend-only slices (AD1a/b, AD2, AD5-service, AD7-middleware) demonstrate "done" with request/response transcripts against the dev server** — a green pytest is not a demo.
- **Risks:** (1) audit emit points touch ~20 router files over waves 2–5 — mechanical but wide; mitigated by the same-session helper being a one-liner, per-family PRs, and the V1-safety assert. (2) Soft-delete seam coverage — mitigated by the accessor-or-failing-test requirement + pre-implementation director vet (§6). (3) JWT-only lockdown regressing an unknown xrp_ caller — mitigated by the verified-callers sweep (only `import-verified-ids` found) and staged lockdown (AD1a; catalog POSTs in AD9b with the Ops UI). (4) GDPR cascade misses → orphan test across all 48 tables. (5) Shared-primitive edits (Modal drawer variant, ConfirmModal confirmText) regressing V1 — additive-only props + V1-safety assert + existing component tests.

## 11. Director review record (2026-08-08)

Pre-implementation plan vet by xivrp-director: verdict SHARED-DRIFT with 13 required changes + 6 suggestions — all incorporated into this revision. Headline findings: AD9's SortableHeader deletion violated R-46 (V1 AllWeeksView consumer); `ui/SortableHeader` coordination constraint was backwards (zero production consumers — AD3 is first-mover); `request_id` claim was false (middleware never sets `request.state`; latent `exceptions.py:139` bug); `Modal variant="sheet"` is a bottom sheet, not a side drawer; AssignUserModal's `admin/all-users` dependency (group-scoped fields) blocked its retirement; missing two-part V1-safety assert; missing dupes/deadcode/tokens gates; AD1/AD6 pre-splits; dead-nav ordering; admin-assign lockdown gap; ban-UX open ruling.

---

## Appendix A — Affordance-parity matrix (existing 4 pages → new surface)

Standing rule: no surface replacement without a user-reviewed matrix. **KEEP** = same affordance, rebuilt; **MOVE** = lives elsewhere; **REPLACE** = superseded by a better affordance; **FIX** = kept + bug fixed; **DROP** = removed deliberately.

### Overview (`AdminOverview.tsx`)
| Affordance | Disposition |
|---|---|
| 4 KPI cards (users+Δ7d, active statics+Δ7d, avg cards/static, unreviewed 24h) | KEEP + extend (DAU/WAU/MAU, stickiness, plugin-active, shell split); FIX unreviewed denominator → all-time groups |
| KPI click → /admin/errors | KEEP (visible affordance, not bare div) |
| Growth charts w/ 7d/30d/90d/all pills | KEEP; theme-aware colors; range in URL |
| Top users table (client sort) | KEEP as Overview module; rows open user drawer; "view all" → /admin/users |
| Top statics table | KEEP; rows open static drawer |
| Right-click user row → View Statics modal | REPLACE — left-click opens user dossier drawer (UserStaticsModal retired); context menu kept as accelerator |
| Right-click static row → open group | REPLACE — left-click drawer; "Open static (admin mode)" action inside |
| Section skeletons | FIX — failures show ErrorMessage + retry (today: stuck skeletons on growth/top-table failures) |

### Statics (`AdminStatics.tsx`)
| Affordance | Disposition |
|---|---|
| Server search (name/owner ILIKE) | KEEP |
| 6-column server sort, pagination (20) | KEEP via DataTable; page size 25/50 |
| URL state q/page/sort/dir | KEEP → shared `useAdminListParams` |
| Copy share code | KEEP |
| Open group `?adminMode=true` | KEEP (inside static drawer + row action) |
| View As eye → hand-rolled member-picker modal | KEEP flow; REPLACE modal with primitive-based picker in static drawer; member fetch deduped w/ ViewAsBanner |
| Responsive column hiding | REPLACE — column-visibility dropdown + overflow-x |
| — (new) | ADD: static dossier drawer, transfer/delete/restore verbs w/ previews, last-activity column |

### Usage (`AdminUsage.tsx`) — page dissolves into Overview (R6)
| Affordance | Disposition |
|---|---|
| Range pills | MOVE → Overview (shared range) |
| Events bar chart + category donut | MOVE → Overview modules; theme-aware |
| Top events table (client 20-slice) | MOVE → Overview module, full list w/ pagination |
| Retry on fetch error | KEEP |
| Per-tab breakdown (noted "not available yet") | DROP for now — backend per-event-data aggregation remains a gap; recorded as future work |

### Errors (`AdminErrors.tsx`)
| Affordance | Disposition |
|---|---|
| Filters source/severity/status | KEEP; into URL params |
| Pagination (20) | KEEP |
| Client-side sort over current page | REPLACE — server-side sort (today's silently misleading page-slice sort) |
| Expand detail / shift multi-expand | REPLACE — detail drawer w/ occurrences (stack/context expanders KEPT inside) |
| Multi-select (ctrl/shift/select-all) + batch review | KEEP via DataTable selection (real Checkbox primitive) |
| Right-click context menu review/re-open | KEEP as accelerator + visible row actions |
| "N unreviewed" header badge (page-slice bug) | FIX — global count, shared w/ sidebar badge |
| "Caught" column (hardcoded api_error set) | KEEP as-is (note: backend-driven field is future work) |
| Occurrence userId plain text | REPLACE — link to user drawer |
| Silently swallowed mutation failures | FIX — surfaced errors |

### Chrome/global
| Affordance | Disposition |
|---|---|
| Sidebar 4 links + unreviewed badge (mount-only fetch) + mobile FAB | KEEP pattern; links added as routes land (no dead nav); badge global + refreshed after review actions; primitives |
| UserMenu "Admin Dashboard" entry | KEEP |
| Ctrl+Shift+S → /admin/statics | KEEP, retargeted → /admin/users (in AD4) |
| ViewAsBanner (global, both shells) + AdminBanners | KEEP + read-only hint (§7) |
| /admin v2 ~17px scrollbar | FIX (AD3, v2 branch `AdminLayout.tsx:60` only) |

## Appendix B — spec self-review notes

Checked: no TBDs; R1–R8 consistent with sections; scope decomposes into 12 PRs each ≤1,500 lines (plan doc); ambiguities resolved inline (denominator choice, shortcut target, admin/all-users retention, telemetry exemption, catalog lockdown staging, soft-deleted-statics-as-blockers, drawer variant). Ban-UX ruling resolved as R9 (minimal lockout screen). Director findings all incorporated (§11).
