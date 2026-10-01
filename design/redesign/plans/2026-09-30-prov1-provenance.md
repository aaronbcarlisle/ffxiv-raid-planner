# PROV-1 · Write provenance (W0, HS-36)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo.

**Goal:** from this PR on, every new loot, material, book (page-ledger) and farm-drop row records how it was logged and which API key wrote it. Every new loot, material and book row also records whose card it was for, which character, and whether that character was sent or defaulted. Backend only. Nothing changes on screen in either shell, and no request or response changes shape (vet M-6).
- `logged_via` says `web` or `api_key` (the plugin's credential), taken from the credential that authenticated the request.
- `api_key_id` names the key that wrote the row, and is NULL for a web write (B16).
- `recipient_user_id` is the card's claimant when the row was written. "On behalf" is then `created_by_user_id ≠ recipient_user_id`.
- Material and book rows gain loot's character pair, `recipient_character_registration_id` and `recipient_character_name`. All three tables fill it the same way.
- `recipient_character_source` says `explicit` (the client sent the character) or `default` (the server filled in the card's main) (B15).
- Existing rows stay NULL, which means "unknown origin".
- **One value change on the wire (vet M-6).** When no character is sent, loot POST, PUT and GET now return the card's main in `recipientCharacterRegistrationId`/`recipientCharacterName`, where they returned null (`loot_tracking.py:179-180`, `:381-382`, `:485-486`). Both fields already exist and are nullable, so the shape is unchanged.

**Spec (binding):** the owner's ruling **HS-36** (2026-09-30). A later docs PR records it in `design/redesign/HOME_STRETCH.md` §2, together with a PROV-1 row in §6.3 W0. Until then this paragraph is the record:
- Self-service with attribution: members will edit and log their own gear, books, totems, mounts, drops and purchases. They never touch other members' data without the role, and viewers never write.
- Every write records who, how (website, plugin, or a lead on someone's behalf), where (static, tier, week, floor) and which character, and the UI will show it.
- Facts are per character (alts, split clears).
- History can't be backfilled, so recording starts now, before the features that use it.

**PROV-1 scope (binding):** backend only, invisible to users, both shells. Out of scope, for later slices: where it was earned (static clear vs PF), self-logging permissions, the once-per-week rule, any UI (including B10's "Plugin" label), a character on farm drops (B11, S2a-1), and gear-edit history. Also binding: the owner's answers B9–B11, B15 and B16 (below), and `CLAUDE.md` § Pitfalls and § CI (the plugin contract, the release note, the migration checks). `backend/app/database.py` gets no edits without owner approval: PV-1 edits `backend/app/dependencies.py`, which is a different file and allowed.

**Plugin contract (binding, `CLAUDE.md` § Pitfalls).** The Dalamud plugin POSTs `loot-log` (drops and purchases), `material-log` and `mark-floor-cleared` with `Authorization: Bearer xrp_…`, camelCase JSON and no CSRF header, and it reads only the status code (`RaidPlannerClient.cs:258-280`, `:357-365`, `PostAsync` `:508`). It never calls `log_drop`. PROV-1 adds no request field and no response field. Every new value is server-derived, so the plugin's requests stay valid byte for byte. `_validate_api_key` gains one `request.state` assignment and nothing else. Any later field on these payloads (the display slice, the plugin's character) must be optional on the request and additive on the response.

**Size.** One slice, one PR, three tasks, about 1,230 changed lines of code and tests, plus this plan (~330). See R-PV-12 for the cap.

| Slice | Branch · worktree | Tasks | Est. lines | Base |
|---|---|---|---|---|
| **PROV-1** | `feat/w0-prov1-provenance` · `.claude/worktrees/prov1` | PV-1 (~520), PV-2 (~450), PV-3 (~260) | ~1,230 + plan | `main` `c8529a26` |

Backend commands use the main checkout's venv (`D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner/backend/venv/Scripts/python.exe`), run from `<worktree>/backend`. The worktree has no venv of its own. PV-3 edits `releaseNotes.ts`, so copy `frontend/.npmrc` into the worktree before `pnpm -C frontend install`.

**Tech stack:** FastAPI + SQLAlchemy async (2.0.51), alembic, pytest + aiosqlite (`backend/tests/`, factories in `tests/factories.py`).

**Plan-vet:** run 2026-09-30 by `xivrp-director`: APPROVE-WITH-FOLDS, 0 Critical, Important I-1…I-4, Minor M-5…M-10 (`.superpowers/stage2/plan-vet-prov1.md`). Folded 2026-10-01 together with the owner's answers B9–B11, B15 and B16 (Session 5, "all recommended"). Each fold is tagged inline, for example `(vet I-1)` or `(B16)`.

**Tests first:** each implementer writes its task's listed tests first and shows them failing for the right reason before any production edit. The slice-loop has no `test-author` step, and the repo's own agents take precedence over the global default. A new module gets stub signatures that raise `NotImplementedError` first, so the tests fail on behaviour, not on import.

**Siblings (W0, parallel).** AUTHZ-2 edits `tests/factories.py`, `tests/authz_matrix.py` and `tests/test_authz_matrix.py`. GUEST-1 edits `routers/auth.py`, `routers/static_groups.py` and `schemas/user.py`. PROV-1 touches none of them. Neither sibling plan edits `dependencies.py` or `tests/conftest.py`, and neither adds a migration. All three edit `releaseNotes.ts` (R-PV-13).

## Spec premises checked against the code (2026-09-30, `main` `c8529a26`; re-checked 2026-10-01)

| The brief / HS-36 says | Code says | Ruling |
|---|---|---|
| "How" comes from the request's auth type; `dependencies.py` routes `xrp_` Bearer tokens to API-key auth | **Confirmed, and the request already carries it.** `_validate_api_key` sets `request.state.auth_credential = "api_key"` (`dependencies.py:127`). `_validate_jwt` sets `"cookie"` (`:158`) for cookie and header JWTs alike. `get_current_user` sends `xrp_` tokens to the key path (`:182`). The cookie is read first (`:33`), so a request that carries both records the cookie, which is the credential that authenticated it. `services/audit.py:139` already reads the value into `AuditLog.credential` (`String(10)`, `'cookie'\|'api_key'\|'system'`, `models/audit_log.py:35-36`). No test overrides `get_current_user` (checked with a grep for `dependency_overrides`), so every authenticated test request sets the state. | R-PV-1, R-PV-2 |
| Which key wrote a row (B16) | **Not on `request.state` today.** `_validate_api_key` has the `ApiKey` row in hand (`dependencies.py:57`) and saves `user_id` before its throttled commit (`:87`), but sets only `auth_credential`. The API never deletes a key: `DELETE /api-keys/{id}` revokes it (`api_keys.py:152-169`, `is_active = False`). The dev merge re-points keys (`dev_auth.py:139-143`). A key row goes only when its user is deleted (`api_key.py:30`, CASCADE). | R-PV-1, R-PV-2 |
| "Plugin" = the `xrp_` path | **Not exactly.** Keys come from two places: Settings, where the user names them (`api_keys.py:94-103`), and the plugin's browser sign-in, which names them "Plugin browser sign-in" (`:346-355`). The API Cookbook documents scripts that use keys (`frontend/src/pages/ApiCookbook.tsx:1201-1400`). The plugin sends only `Authorization` (`RaidPlannerClient.cs:54`), with no User-Agent and no client header. | R-PV-1 stores `api_key` and `api_key_id`; B10 |
| Loot, material and book rows carry `created_by_user_id`, `tier_snapshot_id`, `week_number` and `floor`. Loot also has the character pair and a `method`. None has a source. Material and book rows have no character. | **Confirmed.** Loot: `models/loot_log_entry.py:23-46`. Material: `models/material_log_entry.py:19-39` (`method` at `:32-36`). Book: `models/page_ledger_entry.py:20-33`. None has a source column. "Where" (static via tier, week, floor) is already complete on all three. | R-PV-1, R-PV-4 |
| A second FK to `users` on the three tier tables | **Breaks every endpoint unless the relationships name their column** (vet I-1). `created_by = relationship("User")` has no `foreign_keys` at `loot_log_entry.py:51`, `material_log_entry.py:44` and `page_ledger_entry.py:38`. With `recipient_user_id` added, SQLAlchemy 2.0.51 raises `AmbiguousForeignKeysError` at mapper configuration, so every endpoint 500s in both shells (the director's scratch repro). The precedent fix is `loot_log_entry.py:52-54`. `User` has no back-references to these tables, and every `join(User, …)` names its on-clause (grep). | R-PV-3 |
| `RewardDropLog` has `created_by_id`, `recipient_user_id` and `static_group_id` | **Confirmed** (`models/reward_drop_log.py:25-33`), plus P0a's `recipient_prior_state` (`:40`) and `recipient_prior_state_at` (`:44`). Both user FKs already name their columns (`:51-52`). Its recipient is a user, not a roster card, so "on behalf" can already be derived from it. | R-PV-3; B11 |
| "On behalf" is derivable (creator ≠ the recipient's user) | **Only at write time.** The three tier tables point at a roster card (`recipient_player_id` / `player_id` → `SnapshotPlayer`). The card's `user_id` (`models/snapshot_player.py:38`) changes on claim (`tiers.py:1214`), on release (`:1298`), on admin assign and in the dev-auth merge (`dev_auth.py:164-168`). Deriving "on behalf" later from the card would rewrite history. | R-PV-3 stores `recipient_user_id` |
| Every creation path (web routes, plugin routes, Log Week's bulk path, any service or import) | **5 constructor sites, all in request handlers:**<ul><li>`create_loot_log_entry` (`loot_tracking.py:198`, row at `:286`)</li><li>`create_page_ledger_entry` (`:660`, `:690`)</li><li>`mark_floor_cleared` (`:727`, loop at `:788`)</li><li>`create_material_log_entry` (`:1303`, `:1371`)</li><li>`log_drop` (`collection_goals.py:691`, `:735`)</li></ul>No `insert()`, `bulk_*`, `add_all`, `merge` or `make_transient`, and no raw `INSERT`, touches these tables in `app/` or `scripts/`. Tier and static duplication copy none of them. `dev_auth.py:145-162` re-points `created_by_user_id`, which isn't a creation. Two update handlers can move a row to another card: `update_loot_log_entry` (`:397`, assignment at `:443`) and `update_material_log_entry` (`:1478`, assignment at `:1524`). | R-PV-5…R-PV-7; PV-3's guard |
| Plugin routes such as the `loot-log`/`material-log` purchase writes | **The plugin calls the web handlers; it has no routes of its own for these.** It calls `loot-log` for drops (`RaidPlannerClient.cs:258-264`) and purchases (`:357-365`), `material-log` (`:266-272`) and `mark-floor-cleared` (`:274-280`). Its request models carry no character (`Models.cs:67-98`). `mark-run-cleared` (`:396-404`) only sets `run_a_cleared`/`run_b_cleared` (`split_clear.py:405-409`) and writes no log row. Plugin purchases get the note "Auto-logged via Dalamud plugin" (`:363`), which is editable text. | The previous row covers them; R-PV-10 |
| The Log Week bulk path | **There is no bulk route.** The wizard and Loot's log grid post one row at a time through `lootTrackingStore`: `:330` loot, `:381` material, `:434/:479/:590/:659/:717` page-ledger, `:455` mark-floor-cleared. Those are the four tier handlers above. | The creation-path row covers it |
| Mirror how loot sets the character | **Loot create validates an optional client registration** (`loot_tracking.py:253-282`) and snapshots its name: the manual name, else the linked `PlayerCharacter.name`. When none is sent it stores NULL, and NULL is what the plugin and Log Week send today.<br>Every loot picker preselects the card's primary registration (`RecipientPicker.tsx:411`, `QuickLogDropModal.tsx:111,120`, `AddLootEntryModal.tsx:339`). No UI renders `recipientCharacterName`. The readers only seed edit state (`AddLootEntryModal.tsx:110`, `RecipientPicker.tsx:346`), and the primary auto-select effects overwrite it (`AddLootEntryModal.tsx:335-341`, `RecipientPicker.tsx:411-415`).<br>V1's edit modals re-send the unchanged `recipientPlayerId` and, for loot, the registration and its name on every save (`AddLootEntryModal.tsx:409-420`, `LogMaterialModal.tsx`).<br>Each card keeps one primary through `_demote_existing_primary` (`static_characters.py:263-264`), not through a constraint. Listings order by `is_primary_for_static desc, created_at asc` (`:190-193`).<br>Loot PUT has two stale cases (`:455-473`): it keeps the old character when the recipient changes without a registration, and it keeps the old name when a new registration arrives without one. | R-PV-4, R-PV-7; B9, B15 |
| Migrations follow the repo's conventions | **Head is `l5m6n7o8p9q0`** (P0a, `alembic heads`; no child). Its idempotent add-column guard is the pattern to follow. The precedent for an FK column is `a9b0c1d2e3f4_add_character_fields_to_loot_log.py`. Dev SQLite adds missing model columns by itself (`database.py:56-79`, which gets no edits), so the guards matter. The venv's SQLite 3.49 refuses to drop an indexed column, and drops an FK column once its index is gone (scratch checks, 2026-09-30, re-run by the director). CI's `migration-exec` job runs the chain on Postgres, then `check_model_tables.py`. `.githooks/pre-push` runs `check_migration_heads.py` and `check_migration_dialect.py`. | R-PV-9 |
| Response schemas, and the plugin contract | **All five POSTs return their row.** The plugin's `PostAsync` reads only the status code. No response gains a field (R-PV-8). Loot's existing character fields carry a value more often (vet M-6). | R-PV-8 |
| AUTHZ | **No new route.** The five routes already have rows (`tests/authz_matrix.py:368-404, 467-476`). | none |
| Test infrastructure | **All present:**<ul><li>`_mint_api_key` mints a real key (`test_audit_emits_static.py:60-66`), and the create response also carries the key's `id`;</li><li>`count_statements` (`conftest.py:282-306`) counts every statement, so PV-2 gives it an optional filter (vet I-2);</li><li>a factory for every table, plus `create_static_character_registration(..., is_primary_for_static=)` (`factories.py:508`);</li><li>the dev-merge test at `test_dev_auth.py:30`.</li></ul>`test_loot_tracking.py:64-82` asserts a NULL character for a card with no registration, and stays green. | — |

## Rulings (bind every task)

- **R-PV-1 (`logged_via`, `api_key_id`, and the column vocabulary).**
  - **`logged_via`.** One nullable column `logged_via String(10)` on `loot_log_entries`, `material_log_entries`, `page_ledger_entries` and `reward_drop_log`. It has no server default, no CHECK and no Postgres enum type.
  - **Values.** `"web"` or `"api_key"`, as constants `LOGGED_VIA_WEB`, `LOGGED_VIA_API_KEY` and `LOGGED_VIA_VALUES` in `services/provenance.py`. NULL means the row predates PROV-1.
  - **`api_key_id` (B16).** `api_key_id String(36)`, FK `api_keys.id` `ondelete="SET NULL"`, nullable and not indexed, on the same four tables. It holds the authenticating key's id for an `api_key` write, and NULL for a web write. No relationship is declared, because nothing reads it until the display slice.
    - Not indexed: nothing queries by it, and the display slice joins on `api_keys.id`, the primary key.
    - `SET NULL` is enough: a key row goes only when its user is deleted (premises), and `logged_via` still says `api_key` then.
  - **Why `String(10)` and no CHECK.** `AuditLog.credential` is the precedent. SQLite can't add a CHECK without rebuilding the table. A Postgres enum needs the `create_type=False` dance (`lootmethod`) for a value set that may grow (`plugin`, B10).
  - **Why `api_key` and not `plugin`.** Keys also power scripts (see the premises), so `api_key` is the true value. The display slice labels `api_key` rows "Plugin" (B10). `api_key_id` lets it confirm the label from the key's origin, a plugin-minted key named "Plugin browser sign-in", with no plugin release.
  - **Column vocabulary (binding on S2a and every later provenance column; vet #9).**
    - A writer column is `<verb>_by_user_id`, FK `users.id`.
    - A channel column is `<verb>_via` `String(10)`, nullable, with no CHECK or enum. It's filled only from the `LOGGED_VIA_*` constants through `logged_via(request)`.
    - PROV-1's channel column is `logged_via`. Its writer is the existing `created_by_user_id` on the three tier tables and `created_by_id` on `reward_drop_log`, both kept as they are: they predate the rule, and the API returns them.
    - S2a-1's writer and channel columns (spec-vet-1 #6: the farm row and the character record) follow the pattern with their own verb and reuse PROV-1's constants and helper. S2a adds its columns in its own migration and never has to alter PROV-1's.
  - **Mapping to `AuditLog` (vet M-9).** The service's module docstring records it: `AuditLog.credential` `cookie` ↔ `logged_via` `web`, and `api_key` ↔ `api_key`. AuditLog's `system` has no `logged_via` value, because no system path writes these rows (R-PV-2 raises instead).
- **R-PV-2 (where `logged_via` and `api_key_id` come from).**
  - `logged_via(request)` maps `request.state.auth_credential`: `"cookie"` → `"web"`, `"api_key"` → `"api_key"`. Anything else, including unset, raises `RuntimeError("write provenance: request has no auth credential")`.
  - `request_api_key_id(request)` returns `request.state.api_key_id` when the credential is `"api_key"`, and `None` for `"cookie"`. A key credential without a key id raises the same kind of `RuntimeError` (B16).
  - **The key id's source (B16).** `_validate_api_key` reads `key_id = api_key.id` beside `user_id` (`dependencies.py:87`), before its throttled commit, and sets `request.state.api_key_id = key_id` beside `:127`. That's the only edit to `dependencies.py`. `_validate_jwt` doesn't change.
  - Neither helper reads the body or any client header.
  - Why raise: every creation route depends on `get_current_user`, which always sets the state (`dependencies.py:127,158`), so an unset value is a wiring bug. A silent NULL would look like a legacy row.
- **R-PV-3 ("on behalf" is derived, not stored as a flag).**
  - **Columns.** `recipient_user_id String(36)`, FK `users.id` `ondelete="SET NULL"`, nullable and indexed, on the three tier tables. It holds the card's `user_id` at write time, and NULL for an unclaimed card.
  - **Relationships (vet I-1).** The new FK is a second path to `users`. PV-1 adds `foreign_keys=[created_by_user_id]` to `created_by` in all three tier models (`loot_log_entry.py:51`, `material_log_entry.py:44`, `page_ledger_entry.py:38`), as `loot_log_entry.py:52-54` does for the registration. Without it, mapper configuration raises `AmbiguousForeignKeysError` and every endpoint 500s. No `recipient_user` relationship is added.
  - **Derivation.** On behalf = `created_by_user_id ≠ recipient_user_id`. A NULL means the row was logged for an unclaimed card.
  - **Drops.** `RewardDropLog` already stores both ids (`created_by_id`, `recipient_user_id`), so it gets only `logged_via` and `api_key_id` here.
  - Why: the card's claimant changes over time (see the premises), and a stored user id answers more than a boolean. It says whose fact it is, which the self-service rules will need.
- **R-PV-4 (the character).** Material and book rows get loot's pair: `recipient_character_registration_id String(36)`, FK `static_character_registrations.id` `ondelete="SET NULL"`, nullable and indexed, and `recipient_character_name String(100)`, a snapshot of the name. All three tier tables also get `recipient_character_source String(10)`, nullable, with no CHECK (B15). Every tier row, **loot included**, resolves the three in this order:
  1. An explicit registration. Only loot sends one today. It's validated as now (`loot_tracking.py:255-268`, 400 with today's detail text when it isn't this card's in this static). The name is the explicit name if sent, else the registration's name. Source `explicit`.
  2. An explicit name with no registration (loot only). The name is stored and the registration stays NULL, as today. Source `explicit`.
  3. **Otherwise, the card's primary registration in this static** (`is_primary_for_static`; when there are several, the earliest `created_at`, then the lowest `id`) and its name. Source `default`. *This is the owner's answer B9 (Q1(a)).*
  4. Otherwise NULL, NULL and NULL.
  - **The name** is `manual_character_name`, else the linked `PlayerCharacter.name`. That's the logic at `loot_tracking.py:269-282`, moved verbatim into the service.
  - **Static.** The static is `tier.static_group_id`.
  - **`recipient_character_source` (B15).** Constants `CHARACTER_SOURCE_EXPLICIT = "explicit"`, `CHARACTER_SOURCE_DEFAULT = "default"` and `CHARACTER_SOURCE_VALUES` in `services/provenance.py`. Only steps 1–3 set it. It stays NULL with step 4 and on rows that predate PROV-1.
    - `explicit` means the client sent the character. Both shells' loot pickers preselect the main (premises), so a web loot row whose user accepted the preselect reads `explicit`: the server can't tell an accepted preselect from a pick. The owner accepted this meaning on 2026-10-01; telling them apart would need a client change.
    - `default` means the server filled in the card's main. Today that's the plugin, Log Week, books and mark-floor-cleared.
- **R-PV-5 (one service).** Create `backend/app/services/provenance.py` with:
  - `logged_via(request) -> str` and `request_api_key_id(request) -> str | None` (R-PV-2).
  - `@dataclass(frozen=True) class EntryProvenance` with the fields `logged_via`, `api_key_id`, `recipient_user_id`, `recipient_character_registration_id`, `recipient_character_name` and `recipient_character_source`.
  - `async def resolve_entry_provenance(db, request, *, static_group_id, player, registration_id=None, character_name=None) -> EntryProvenance`, which applies R-PV-4 steps 1–4.
  - `async def resolve_batch_provenance(db, request, *, static_group_id, players) -> dict[str, EntryProvenance]`, keyed by player id, which applies steps 3–4 only.
  - The batch call costs a fixed number of SELECTs, however many players: at most one for registrations and one for `PlayerCharacter` names. The single call goes through the batch one when nothing explicit is sent.
- **R-PV-6 (explicit keywords at every site).** Each constructor call passes every provenance field as an explicit keyword: `logged_via=prov.logged_via, api_key_id=prov.api_key_id, recipient_user_id=prov.recipient_user_id, …, recipient_character_source=prov.recipient_character_source`. No `**` expansion, so PV-3's AST guard can check each site.
- **R-PV-7 (updates).**
  - `logged_via`, `api_key_id` and `created_by_user_id` never change on PUT. They are facts about the creation, and edit attribution is a later slice.
  - **A recipient change** is `data.recipient_player_id is not None and data.recipient_player_id != stored`, where `stored` is read **before** the handler assigns the new recipient (today's assignments are `loot_tracking.py:443` and `:1524`). Keying on `data.recipient_player_id is not None` alone would stamp a legacy row with today's claimant whenever V1 re-sends the unchanged card, which is the history rewrite R-PV-3 exists to prevent (vet I-3).
  - **On a recipient change**, `recipient_user_id` follows the new card, and the character re-runs R-PV-4 steps 1–4 for the new card (vet M-7): the explicit registration (loot), else the explicit name (loot), else the new card's main, else NULL. `recipient_character_source` goes with it. A stale character never survives a reassignment.
  - **Without a recipient change** (absent, or the same card), `recipient_user_id` is untouched, including a legacy row's NULL. On loot, a sent registration or name that differs from the stored pair is validated and stored as today. A registration sent without a name takes that registration's name, and `recipient_character_source` becomes `explicit`. A sent pair equal to the stored pair changes nothing, including the source. Material PUT sends no character, so its character columns are untouched.
  - Both fix today's stale cases (see the premises).
- **R-PV-8 (no shape change; vet M-6).** No request or response schema gains or loses a field.
  - Why: nothing reads the new columns until the display slice, which adds response fields (optional and additive, per the plugin contract) together with the UI that reads them.
  - The one value change: loot's existing character fields now carry the defaulted main where they were null (Goal). The plugin reads no response body on these routes, and no UI renders the fields (premises).
  - Tests read the stored rows from the database, and assert that the response key sets are unchanged, `log_drop`'s `RewardDropResponse` included.
- **R-PV-9 (one migration).**
  - **The file.** `backend/alembic/versions/m6n7o8p9q0r1_add_log_entry_provenance.py`, with `down_revision = "l5m6n7o8p9q0"`. It adds 18 columns: `logged_via` ×4, `api_key_id` ×4 (B16), `recipient_user_id` ×3, `recipient_character_source` ×3 (B15), and the character pair on material and book (×2 tables).
  - **No server defaults.** All 18 columns are nullable with no server default, so the `sa.false()`-style convention for new non-null columns doesn't come up, and `check_migration_dialect.py` has nothing to flag.
  - **Guards.** It uses the idempotent add-column guard from `l5m6n7o8p9q0` and an index guard (`sa.inspect(bind).get_indexes`).
  - **Index names.** SQLAlchemy's defaults (`ix_<table>_<column>`), so `create_all` and the chain build the same names. That makes 5 indexes: `recipient_user_id` ×3 and the registration ×2. `api_key_id` and `recipient_character_source` aren't indexed.
  - **Downgrade.** It drops each index before its column, because SQLite refuses to drop an indexed column.
  - **Checks.** `check_migration_heads.py` and `check_migration_dialect.py` must pass. They're PV-1's gates, and `.githooks/pre-push` runs the same two.
  - **Heads.** If another slice lands a migration first, rebase and re-point `down_revision`. `check_migration_heads.py` catches a second head.
- **R-PV-10 (no backfill).** Existing rows stay NULL, per HS-36. That includes plugin purchases carrying the "Auto-logged via Dalamud plugin" note: that note is editable text, and a partial backfill would make NULL mean two things.
- **R-PV-11 (dev-auth merge).** `_merge_duplicate_dev_users` re-points `recipient_user_id` on the three tier tables, the same way it re-points `created_by_user_id` (`dev_auth.py:145-162`). Otherwise a merged dev user's own rows would read as logged on their behalf. `api_key_id` needs nothing, because the merge re-points keys rather than deleting them (`dev_auth.py:139-143`).
- **R-PV-12 (three tasks, the 3–4 rule's floor, so it complies; vet M-10).** One concern. Splitting the router wiring further would only add hand-offs.
  - **The cap.** About 1,230 changed lines of code and tests plus this plan (~330) is about 1,560, near `CLAUDE.md`'s ~1,500.
  - At Finish, run `git diff --stat origin/main...HEAD`. If the total is over ~1,600, PV-3 ships as a PR stacked on PV-2's branch (slice-loop § Stacked PRs). Don't trim tests to fit.
- **R-PV-13 (release note).**
  - **Where it goes.** One `improvement` item with `internal: true`, inside a release with `internal: true`. `CURRENT_VERSION` doesn't move: it tracks the latest public release, whatever that is on `origin/main` at merge (it was `'2.1.59'` at plan time), per the 2.1.60 precedent.
  - **Version rule.** Use the highest `RELEASES[].version` on `origin/main` + 1 patch: 2.1.61 at plan time, because #332 took 2.1.60. Don't use `CURRENT_VERSION` + 1. Re-read `RELEASES[0].version` on `origin/main` at Finish, because the sibling W0 PRs (AUTHZ-2, GUEST-1) may take 2.1.61 first.
  - **Strings.** Single-quoted, with `'` escaped as `\'`, written with the Edit tool. `pr`/`prTitle` are filled in after `gh pr create`.
  - **Title:** "Loot, books and farm drops record how they were logged".
  - **Description:** "New loot, material, book and farm-drop entries now record whether they came from the website or an API key such as the plugin's, and which key, whose card they were logged for, and, for loot, materials and books, which character and whether it was picked or filled in as the main. Nothing changes on screen yet, and older entries stay unmarked."

## Owner answers (binding, Session 5, 2026-10-01: "all recommended")

1. **B9 (Q1): with no pick, record the card's main for this static.** That's R-PV-4 step 3, source `default`. It applies to the plugin, Log Week, books and mark-floor-cleared. The cost is accepted: until a picker (or the plugin) sends the character, an alt's split-clear books or materials read as the main's. B15's `default` marks them.
2. **B10 (Q2): label `api_key` rows "Plugin".** **Out of scope here:** it's a later UI slice, the display slice (Carried). PROV-1 stores the true values `api_key` and `api_key_id` either way, and no PROV-1 code changes.
3. **B11 (Q3): farm drops are per character, from S2a-1, not here.** The home is the S2a-1 row of the S2a spec (`design/redesign/specs/2026-09-30-s2a-progress-design.md:148`, branch `docs/s2a-progress-spec`). **The boundary:** PROV-1 gives `reward_drop_log` only `logged_via` and `api_key_id`, with no character column, no registration lookup and no change to `RewardDropCreate`. S2a-1 adds the drop's character in its own migration, using R-PV-1's vocabulary. Drops logged before S2a-1 have no character, and that can't be backfilled.
4. **B15 (vet Q4): mark a defaulted main.** That's `recipient_character_source` `explicit|default` on the three tier tables (R-PV-4).
5. **B16 (vet Q5): store which key wrote the row.** That's `api_key_id`, a nullable FK to `api_keys` with `SET NULL`, on the four written tables (R-PV-1, R-PV-2).

## Review Focus

- **Completeness.** Every creation site is covered, and PV-3's guard demonstrably fails when a site drops a keyword, when a new site appears (including through an alias or a module attribute), and when a site loses its last route test (all pasted). Nothing writes these tables through `insert()`, `bulk_*`, `merge` or raw SQL.
- **Mappers (vet I-1).** All three `created_by` relationships name `created_by_user_id`. Mapper configuration succeeds, and the three GET log routes return 200.
- **`logged_via` and `api_key_id`.**
  - They come only from `request.state` (R-PV-2), never from the body or a header.
  - A request that carries a cookie and an `xrp_` header records `web` and no key, matching the credential that authenticated it.
  - A key request records the minted key's id.
  - A key request with no CSRF header still gets 201, which is the plugin contract.
- **The character.**
  - The default never overrides an explicit registration or an explicit name, and `recipient_character_source` says which path ran.
  - mark-floor-cleared reads registrations and character names with the same number of SELECTs for 1 card and for 3 (vet I-2).
  - A PUT that changes the recipient leaves no stale character, and an explicit name sent with the change survives (vet M-7).
  - V1's full edit payload on a legacy row leaves its NULLs (vet I-3).
- **The migration.** The head, the guards, the downgrade order, and the FKs on Postgres. Both check scripts pass, and so does the upgrade → downgrade → upgrade run.
- **No visible change.**
  - Response key sets are unchanged and `authz_matrix` is untouched.
  - `test_loot_tracking.py` passes **unedited**: the loot character code moved without changing behaviour.

## Task PV-1 — columns, migration, the provenance service (`xivrp-implementer`)

**Files.**
- Create `backend/alembic/versions/m6n7o8p9q0r1_add_log_entry_provenance.py`, `backend/app/services/provenance.py` and `backend/tests/test_provenance_service.py`.
- Modify `backend/app/models/{loot_log_entry,material_log_entry,page_ledger_entry,reward_drop_log}.py`, `backend/app/dependencies.py` (one line plus the `key_id` read, B16), `backend/app/routers/dev_auth.py` and `backend/tests/test_dev_auth.py`.
- Never `backend/app/database.py`. That needs owner approval, and the dev SQLite column sync (`:56-79`) needs no change.

**Interfaces produced:** the R-PV-5 service (`logged_via`, `request_api_key_id`, `EntryProvenance`, `resolve_entry_provenance`, `resolve_batch_provenance`), the `LOGGED_VIA_*` and `CHARACTER_SOURCE_*` constants, `request.state.api_key_id`, and the 18 columns. This task wires no router.

1. **Tests first** (`test_provenance_service.py`). Build the requests the way `test_audit_helper.py:147` does: a starlette `Request` with a `state` in its scope.
   - **Mappers (vet I-1).**
     - `sqlalchemy.orm.configure_mappers()` succeeds.
     - For each tier model, `Model.created_by.property.local_columns == {Model.__table__.c.created_by_user_id}`.
     - With a seeded row in each table, the three GET log routes (`loot-log`, `material-log`, `page-ledger`) return 200 with `createdByUsername` set. They `joinedload(...created_by)` at `loot_tracking.py:155`, `:620` and `:1263`.
     - Run these against the new columns before adding `foreign_keys=`: they fail with `AmbiguousForeignKeysError`. That's the right reason.
   - **`logged_via` and `request_api_key_id`.**
     - `cookie` → `"web"` and key id `None`;
     - `api_key` with a key id → `"api_key"` and that id;
     - `api_key` with no key id → `RuntimeError`;
     - no `auth_credential` → `RuntimeError`.
   - **`_validate_api_key` (B16).** Mint a key through `POST /api/auth/api-keys` to get the raw key and its `id`. Then call `_validate_api_key(raw, session, request)` directly: `request.state.api_key_id` equals that `id`.
   - **`resolve_entry_provenance` on one card:**
     - **A claimed card** with a primary manual registration "Main Name" and an alt → `recipient_user_id` is the claimant, the registration is the primary, the name is "Main Name", and the source is `default`.
     - **A primary linked to a Player Hub character** with no manual name → that `PlayerCharacter.name`, source `default`.
     - **Nothing to resolve:** only an alt → NULL/NULL/NULL; no registration → NULL/NULL/NULL; an unclaimed card → `recipient_user_id` NULL.
     - **Two primaries**, inserted directly past the demote → the earlier `created_at` wins. With equal timestamps, the lower `id` wins.
     - **A primary row whose `static_group_id` is another static** → ignored.
     - **Explicit values (source `explicit` in each case):**
       - an explicit alt registration → the alt, which beats the primary, with the alt's name;
       - an explicit registration plus a name → that name;
       - an explicit name only → registration NULL, name kept;
       - another card's registration → `HTTPException` 400 with today's detail text.
   - **`resolve_batch_provenance`** on three cards (primary / none / unclaimed) returns all three, with sources `default`/NULL/NULL. Under `count_statements`, three cards cost the same number of statements as one. This is the fixed-cost check: the batch resolver issues only SELECTs (vet I-2).
   - **`test_dev_auth.py:30` (extended):** a loot, a material and a book row whose `recipient_user_id` is the duplicate end up pointing at the canonical user.
2. **Implement**, in this order:
   - the models: R-PV-1, R-PV-3 (with `foreign_keys=[created_by_user_id]`, vet I-1) and R-PV-4;
   - R-PV-9 (the migration);
   - R-PV-2 (with the `dependencies.py` key id, B16), R-PV-4 and R-PV-5 (the service);
   - R-PV-11 (dev-auth).
3. **Gates.** From `<worktree>/backend`:
   - `<venv python> -m pytest tests/test_provenance_service.py tests/test_dev_auth.py tests/test_loot_tracking.py tests/test_audit_emits_static.py -q`, then `-m pytest tests/ -q` (paste the count);
   - `<venv python> scripts/check_migration_heads.py && <venv python> scripts/check_migration_dialect.py`, the same two checks the `.githooks/pre-push` hook runs. Both must pass;
   - with `DATABASE_URL` pointing at a scratch SQLite file in the session scratchpad (never `backend/*.db`), run `alembic upgrade head`, then `alembic downgrade -1`, then `alembic upgrade head`, and paste the output;
   - `ruff check` on the touched files (0 new).

**Ad hoc mutation check (execute, paste, revert):** remove `foreign_keys=[created_by_user_id]` from `page_ledger_entry.py`, and the mapper tests fail with `AmbiguousForeignKeysError`.

## Task PV-2 — wire loot, material and book writes (RISKIEST · `xivrp-implementer-deep`, `model: fable`)

**Files.** Modify `backend/app/routers/loot_tracking.py` and `backend/tests/conftest.py`. In `conftest.py`, `count_statements` gains an optional `match: Callable[[str], bool] | None = None` filter on the statement text. Its default counts every statement, so existing callers don't change. Create `backend/tests/test_write_provenance.py`.

**Interfaces produced (vet I-4):** in `test_write_provenance.py`, a decorator `covers(handler: str)` and the registry it fills, `COVERED: dict[str, list[str]]` (handler name → the test functions decorated with it). The decorator records the decorated function's name at import and returns the function unchanged. Every route test in the file carries exactly one `@covers("<handler>")`. PV-3's guard reads `COVERED`, so a handler counts as covered only when a test function exists for it, never by a label alone.

1. **Tests first** (`test_write_provenance.py`). Build a fixture world:
   - an owner O;
   - a member M, whose card PM has a primary manual registration R1 "Main Name" and an alt R2;
   - a member M2, whose card PM2 has no registration;
   - an unclaimed card PU.

   JWT requests use the `Authorization` header from `create_access_token`, as in the conftest. One case uses a real `access_token` cookie. Key requests mint a key through `POST /api/auth/api-keys` (as `_mint_api_key` does, keeping the response's `id`) and send no CSRF header. Every case reads the stored row from the database. Every key case asserts `api_key_id` is the minted key's id, and every web case asserts it's NULL (B16).
   - **`create_loot_log_entry`:**
     - O by JWT logs a drop for PM → `web`, `recipient_user_id` M, R1, "Main Name", source `default`.
     - The same with a cookie → `web`.
     - The cookie plus an `xrp_` header → `web` and no key.
     - O by key → `api_key`.
     - M by key logs a purchase for PM → `api_key`, with `recipient_user_id` = `created_by` = M (self).
     - O with an explicit R2 → R2 is kept, source `explicit`.
     - O for PU → `recipient_user_id` NULL, no character, source NULL.
   - **`create_material_log_entry`:** O by JWT for PM → `web`, M, R1, `default`. M by key, a purchase for PM → `api_key`.
   - **`create_page_ledger_entry`:** O by JWT, a `spent` row for PM → `web`, M, R1, `default`.
   - **`mark_floor_cleared`:** O by key for `[PM, PM2, PU]` → three `api_key` rows, with users M / M2 / NULL, characters R1 / NULL / NULL and sources `default` / NULL / NULL.
     - **Statement budget (vet I-2):** count only SELECTs that read `static_character_registrations` or `player_characters`, with `count_statements(engine, match=...)`. Three cards cost the same as one.
     - Don't compare total statement counts: the ORM issues one INSERT per row on aiosqlite, and `_validate_api_key` writes `last_used_at` only on the first key request per interval (`dependencies.py:89-112`). A total count fails both before and after the change.
   - **`update_loot_log_entry`:**
     - moving a PM row to PM2 with no registration → `recipient_user_id` M2, the character cleared, source NULL;
     - moving a PM row to PM2 with only `recipientCharacterName` "Typed Name" → name kept, registration NULL, source `explicit` (vet M-7);
     - sending R2 with no name on a PM row → R2, R2's name, source `explicit`;
     - **the full V1 payload on a legacy row (vet I-3):** seed a pre-PROV-1 row directly, with every provenance column NULL and R1/"Main Name" as V1's picker stored it. PUT a superset of any shell's loot edit (`AddLootEntryModal.tsx:409-420` is V1's create payload; V1 and V2 loot edits send only changed fields, `:375-395`): the unchanged `recipientPlayerId`, week, floor, slot, method, weapon job, R1 and its name, and new notes. Notes change. `recipient_user_id`, `logged_via`, `api_key_id` and `recipient_character_source` stay NULL;
     - `logged_via` and `api_key_id` never change.
   - **`update_material_log_entry`:**
     - moving to PM2 → M2 and the character cleared;
     - **the full V1 payload on a legacy row (vet I-3):** the unchanged `recipientPlayerId` plus what V1's `LogMaterialModal` edit sends → `recipient_user_id`, `logged_via`, `api_key_id`, the character and its source stay NULL.
   - **No shape change (R-PV-8):** the JSON key sets of the four POST responses and the two PUT responses equal literal sets copied from the HEAD schemas.

   Today every provenance assertion fails on missing columns or NULL values. That's the right reason. The legacy-row cases pass today and must stay green: their mutation check below proves they bite.
2. **Implement.**
   - Add `request: Request` to the six handlers. Resolve with the service, and pass the explicit keywords (R-PV-6).
   - Loot create's character block (`:253-282`) becomes the `resolve_entry_provenance` call. Behaviour is preserved, and `test_loot_tracking.py` stays green **unedited**.
   - Apply R-PV-7 in the two PUTs. Read the stored recipient before the assignment at `:443`/`:1524`.
   - `mark_floor_cleared` uses `resolve_batch_provenance` once.
3. **Gates.**
   - `<venv python> -m pytest tests/test_write_provenance.py tests/test_loot_tracking.py tests/test_purchase_flow.py tests/test_week_management.py tests/test_authz_matrix.py tests/test_priority.py tests/test_pagination.py -q`, plus every other `count_statements` caller (`grep -l count_statements tests/`: `test_player_overview.py`, `test_availability_layering.py`, `test_discovery_fit_v2.py`, `test_join_requests_fit.py` and `test_audit_emits_admin.py` today), because the fixture gains a parameter;
   - the full suite (paste the count);
   - `ruff check` on the touched files.

**Ad hoc mutation checks (execute, paste, revert):**
- Remove `logged_via=` from `mark_floor_cleared`: its case fails.
- Skip the re-resolve on a loot PUT recipient change: the stale-character case fails.
- Let step 3 run before step 1: the explicit-R2 case fails.
- Key "recipient change" on `data.recipient_player_id is not None` (or compare after the assignment): both legacy-row cases fail (vet I-3).

## Task PV-3 — farm drops, the completeness guard, the release note (`xivrp-implementer`)

**Files.** Modify `backend/app/routers/collection_goals.py`, `backend/tests/test_write_provenance.py` (the drop cases) and `frontend/src/data/releaseNotes.ts`. Create `backend/tests/test_provenance_coverage.py`.

1. **Tests first.**
   - **Drop cases**, each `@covers("log_drop")`:
     - M by JWT logs their own drop → `web`, `api_key_id` NULL.
     - M by key → `api_key`, with the minted key's id.
     - A lead by JWT for M → `web`, with `created_by_id` the lead and `recipient_user_id` M. "On behalf" can be derived without any new column.
     - The `RewardDropResponse` key set equals a literal set copied from HEAD (vet M-6).
   - **The completeness guard** (`test_provenance_coverage.py`). It parses with `ast`, walking `backend/app` and `backend/scripts`.
     - **The model set (vet M-5).** `PROVENANCE_MODELS`, a named module constant: `{"LootLogEntry": "loot_log_entries", "MaterialLogEntry": "material_log_entries", "PageLedgerEntry": "page_ledger_entries", "RewardDropLog": "reward_drop_log"}`. `TIER_MODELS` is the first three. S2a-1 extends the constant with its own tables.
     - **Name resolution (vet M-5).** Per module, resolve `import … as X` and `from … import … as Y` aliases. A call is a model call when its callee is a `Name` that resolves to a model, or an `Attribute` whose last part is a model name (`models.LootLogEntry(...)`, `m.LootLogEntry(...)`).
     - (a) The set of `(module, enclosing function)` for every model call equals `EXPECTED_SITES`, the five sites in the premises.
     - (b) Every such call passes `logged_via=` and `api_key_id=` as explicit keywords, and `logged_via`'s value isn't the constant `None`. The three tier models also pass `recipient_user_id=`, `recipient_character_registration_id=`, `recipient_character_name=` and `recipient_character_source=`. None of these calls uses `**`.
     - (c) No bulk or raw write path touches a model (vet M-5):
       - no `insert(<model>)` or `insert(<model>.__table__)`, and no `<model>.__table__.insert()`;
       - no call to `bulk_insert_mappings`, `bulk_save_objects`, `merge` or `make_transient` in a module that imports a model (none today);
       - no string literal, f-string parts included, matches the case-insensitive regex `\binsert\s+(or\s+\w+\s+)?into\s+\W?(<the four table names>)\b`, where `\W?` allows an optional quote.
     - (d) `set(COVERED)` (imported from `tests.test_write_provenance`) equals the function names in `EXPECTED_SITES`, and every list in it is non-empty (vet I-4). A label can't satisfy it: only a decorated test function adds an entry.
     - Before the wiring, (b) fails and names `log_drop`. That's the right reason.
2. **Implement.**
   - `log_drop` gains `request: Request` and passes `logged_via=logged_via(request), api_key_id=request_api_key_id(request)`.
   - Then write the R-PV-13 release note with the Edit tool. Take the version from the R-PV-13 rule, not from `CURRENT_VERSION`.
3. **Gates.**
   - `<venv python> -m pytest tests/test_provenance_coverage.py tests/test_write_provenance.py tests/test_collection_goals.py tests/test_farm_drop_authz.py -q`, then the full suite (paste the count);
   - `pnpm -C frontend build`, then `pnpm -C frontend test src/data/releaseNotes.test.ts`;
   - `npm test` in `scripts/` (the changelog suite);
   - `ruff check` on the touched files.

**Ad hoc mutation checks (execute, paste, revert):**
- Remove `logged_via=` from `log_drop`: guard (b) and the drop case fail.
- Add a throwaway function that builds a `MaterialLogEntry(...)` with every keyword: guard (a) fails. Repeat it through `from app.models import MaterialLogEntry as M` and through `models.MaterialLogEntry(...)`: (a) fails both times (vet M-5).
- Add a string literal `"insert into material_log_entries ..."`: guard (c) fails (vet M-5).
- Delete the `@covers("log_drop")` tests: guard (d) fails (vet I-4).

## Finish (controller)

- **Live check instead of a browser walk.** No V2 or V1 surface changes, so slice-loop §2's walk becomes a check against the live API:
  - Start the worktree's dev servers (CLAUDE.md § Commands) and log in through dev-auth as the owner.
  - Log one loot drop from V2 Loot (`/group/DEVTST?shell=v2`) and one from the legacy shell.
  - Mint a key, then `curl` `mark-floor-cleared` with `Authorization: Bearer xrp_…` and no CSRF header.
  - Query the worktree's dev database, and paste the rows: `logged_via` `web`/`api_key`, `api_key_id`, `recipient_user_id`, the character and `recipient_character_source`.
  - Confirm the Loot page and the log look unchanged.
  - The PR has no screenshots. Its body says "backend only, no UI change", and names the plugin contract as unchanged (no request or response field added).
- **Before pushing:**
  - Run `git fetch` and `git log HEAD..origin/main -- backend/alembic/versions`. If a migration has landed, rebase and re-point `down_revision` (R-PV-9), then rerun the two check scripts.
  - Check the size (R-PV-12).
- Run `pr-checklist`, then the slice-loop §5 gates (backend `pytest`, `pnpm build`, `pnpm lint`, `pnpm test`), then `gh pr create --draft`, then the release note's `pr`/`prTitle`. The PR body lists B9–B11, B15 and B16 with the owner's answers (2026-10-01).
- **Release version (R-PV-13).** Re-read `RELEASES[0].version` on `origin/main` before pushing and again before merge. If AUTHZ-2 or GUEST-1 has taken 2.1.61, rebase onto them and take the next free patch. Rebase after each sibling merges.

## Write-backs (last: after `gh pr create`, and after any sibling W0 PR that touches the same lines has merged and this branch is rebased)

- **If the docs PR that records HS-36 has merged:**
  - its PROV-1 row in HOME_STRETCH §6.3 W0 → `✅ #<n>`;
  - `docs/PRODUCT_MODEL.md` §6.1, W0 row (`:250`), adds "PROV-1 (how, which key, whose card and character on loot, material and book; how and which key on farm drops) ✅ #<n>" (vet M-8).

  **If it hasn't,** the PR body carries both lines for that docs PR.
- **Rulings that bind later slices:** R-PV-1 (with the column vocabulary), R-PV-2, R-PV-3, R-PV-4, R-PV-7, R-PV-8 and the owner's answers B9–B11, B15 and B16. They go in the PROV-1 row's note, or in the docs PR, so the display, S2a-1 and self-service slices start from them.

## Carried, not PROV-1

- **Showing it** (who, how, which key, on behalf, which character, picked or defaulted). The display slice adds the response fields (R-PV-8, optional and additive) and labels `api_key` rows "Plugin" (B10). The HS-36 docs PR names its slice; this list is its home until then.
- **A character picker** for material and books in both shells.
- **The plugin sending the logged-in character, and an identifying client header.** That's a plugin-repo release. The plugin is behind; see `CLAUDE.md` § Pitfalls. Any new request field is optional.
- **A character on farm drops** (B11): S2a-1, the S2a spec's S2a-1 row (`:148`).
- **The other HS-36 items:** where an item was earned (static clear vs PF), self-logging permissions, the once-per-week rule, gear-edit history, and attribution of edits and deletes (who changed a row, and how). `AuditLog` emits could serve here.
- **Provenance for the other self-service writes:** mount-farm progress and farm participant states (both carry a `*_source` of manual or plugin, but not who), split-clear run flags, and gear writes. They use R-PV-1's vocabulary.
