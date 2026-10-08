# S2a-1 · Character records (backend)

> Run with the `slice-loop` skill (`.claude/skills/slice-loop/`). Never load
> `superpowers:subagent-driven-development` in this repo. Each PR below is one slice-loop run: its own ledger, one whole-branch review against its parent branch, one fix wave.

**Goal:** a member's mount ownership and token counts live on one record per character, and every static's farm rows read through it. Backend only, plus `releaseNotes.ts`. No V2 UI (that's S2a-2).
- The record is `PlayerCollectionSnapshot`, keyed by character, with a profile-level row for a profile with no character.
- `list_participants` and the goal summaries merge each row with the record of the member's character in that static (S2-10's chain).
- The record and the farm row record who wrote them and how (`updated_by_user_id`, `updated_via`), and when the state and the count last changed.
- Members set their own totem count (h). Track leaves members with no signal blank (g). A drop records the recipient's character (B11); a member's own drop also writes their record, and Undo reverts it.
- The plugin's syncs match the synced character by name and world (B6 fallback) and write the record through one service with one collision rule.
- Viewers get farm states without counts, and a member can hide their counts with a Hub flag (B1); the API ships, the toggle is HUB's.

**Spec (binding):** `design/redesign/specs/2026-09-30-s2a-progress-design.md`: S2-4, S2-7, S2-8 (B1, B2), S2-9 (the drop's character, "I got it"'s record write, Undo's `state_changed_at`), **S2-10 in full**, §5, §6's S2a-1 row, §7 criteria 2, 3, 6, 12 and 13, V1 deltas (a), (b), (c), (g), (h), (i), (j) with their release-note lines, and "Snapshot readers for (b)". §7: S2a-1's PRs show V1's `GoalsPage`, Profile ▸ Collections and Home (for (j)) before and after in the running app.

**PROV-1 rulings (binding, `HOME_STRETCH.md` §6.3 W0 PROV-1 row):** **R-PV-1** (a writer column is `<verb>_by_user_id`, FK `users.id`; a channel column is `<verb>_via` `String(10)`, nullable, no CHECK or enum, filled only through `services/provenance.py`'s `logged_via(request)` and its `LOGGED_VIA_*` constants; S2a-1 adds its own columns in its own migration and never alters PROV-1's). **R-PV-2** (the channel comes only from the authenticating credential; unset raises). **R-PV-3** ("on behalf" is derived, never a stored flag). **R-PV-8** (response fields arrive with the display slice, optional and additive). **B11** (the drop's character arrives in S2a-1's migration).

**Scope (binding).** Backend plus `releaseNotes.ts`. `backend/app/database.py` gets no edits (owner approval needed). V1's frontend is not edited: every V1 change is a server response change declared in §7 (or in the owner questions below).

**Plugin contract (binding, `CLAUDE.md` § Pitfalls).** The plugin calls `plugin/collections/sync` and `plugin/mount-farms/{catalog,sync}` with an `xrp_` key and camelCase JSON. No request field is added or changed; no response field is removed or renamed. The sync responses keep their shape. Their counters keep their meaning, farm rows changed (R-S1-17, vet M-6), because the plugin prints `statesUpdated` and `tokenCountsUpdated` in chat (`XIVRaidPlannerPlugin/Services/CollectionSyncService.cs:149-153`). The plugin calls no other route this plan touches. The plugin's request already declares `characterName`/`characterWorld` (`schemas/plugin_collections.py:36-37`, `schemas/mount_farms.py:54-55`); S2a-1b starts reading them, which changes server behaviour, not the contract.

## Size and stack

PROV-1 estimated ~1,230 lines and landed ~2,470 over two PRs (#345 2,060 without its plan, #346 415): tests ran ~65% of the diff. These estimates use that ratio. They give six PRs, not §6's two: §6's last line allows the split, and the W3 row's "~8 PRs" for S2a becomes ~12 (write-back). The director confirmed six as the floor: no two PRs fit together under the cap.

| PR | Slice | Branch · base | Tasks (est. lines, code + tests) | Total |
|---|---|---|---|---|
| 1 | **S2a-1a·1** record foundation (invisible) | `feat/s2a1-character-records` (worktree `.claude/worktrees/s2a1`) · `main` `def04893` | A1 migration + models (~620, **deep**; +90 for vet I-4, I-5, M-10) · A2 chain + main (~480) · A3 record door (~310; +30 for vet I-5) | ~1,410 + plan |
| 2 | **S2a-1a·2** the record per character: Hub, bridge, plugin snapshot, readers | `feat/s2a1a2-record-paths` · PR 1 | B1 Hub routes (B8), adoption, unlink (~480; +40 for vet I-1) · B2 bridge, plugin snapshot, readers via the chain (~450, **deep**) · B3 guard machinery + the record (~520; +90 for vet I-2, M-8) | **~1,450** |
| 3 | **S2a-1a·3** farm rows read through the record | `feat/s2a1a3-farm-rows` · PR 2 | C1 row door + merge + summaries (~600, **deep, `model: fable`**) · C2 self, lead, seed (~400) · C3 remaining row writes routed + AUTHZ (~280) | ~1,280 |
| 4 | **S2a-1a·4** drops | `feat/s2a1a4-drops` · PR 3 | D1 drop character + own-drop record write (~330) · D2 Undo (~430, **deep**; +20 for vet M-10) · D3 guard for rows + drops (~300; +20 for vet I-2) | ~1,060 |
| 5 | **S2a-1b·1** the syncs | `feat/s2a1b1-syncs` · `main` after PR 4 merges | E1 match rule (~260) · E2 collections sync via one service (~580, **deep**) · E3 mount-farm sync writes the record (~400) | ~1,240 |
| 6 | **S2a-1b·2** counts and history | `feat/s2a1b2-counts` · PR 5 | F1 MFP → record backfill + flag column (~570, **deep**; +120 for vet I-4, M-9) · F2 privacy flag API + gate helper (~230) · F3 gated reads (~570) | ~1,370 |

- **Stacks merge together (R-S1-1).** PRs 1–4 merge bottom-first in one session (slice-loop § Stacked PRs), never one alone; so do PRs 5–6. Intermediate states never serve traffic for long.
- **The cap (vet M-7).** At each Finish run `git diff --stat <parent>...HEAD`. Over ~1,500 changed lines (plan excluded, slice-loop's cap) → the last task ships as its own PR stacked on top, as PROV-1 did. Don't trim tests to fit.
  - **PR 2 is the closest, at ~1,450.** If it lands over, B3 (the guard) ships as PR 2b on top of B2's branch, and PR 3 stacks on PR 2b.
  - PR 1 (~1,410) and PR 6 (~1,370) get the same check.
- **S2a-1b follows S2a-1a's merge** (fresh worktree from `main`, e.g. `.claude/worktrees/s2a1b`). It needs PRs 1–4's record, door and merge. A new worktree needs `frontend/.npmrc` copied in before `pnpm -C frontend install`.

Backend commands use the main checkout's venv (`D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner/backend/venv/Scripts/python.exe`, "`<venv python>`" below), run from `<worktree>/backend`. **Tech stack:** FastAPI + SQLAlchemy async 2.0, alembic, pytest + aiosqlite, factories in `tests/factories.py` (`create_player_profile` :415, `create_player_character` :434, `create_static_character_registration` :512, `create_collection_goal` :594, `create_participant_state` :619, `create_catalog_item` :777, `create_api_key` :860).

**Plan-vet:** run 2026-10-01 by `xivrp-director`: DRIFT · APPROVE-WITH-FOLDS, 0 Critical, Important I-1…I-5, Minor M-6…M-11 (`.superpowers/stage2/plan-vet-s2a1.md`). Folded 2026-10-01; each fold is tagged inline, e.g. `(vet I-1)`. The owner answered Q1–Q7 on 2026-10-01: all seven as recommended. **Tests first:** each implementer writes the task's listed tests first and shows them failing for the right reason before any production edit; a new module starts as stubs that raise `NotImplementedError`. The slice-loop has no `test-author` step; the repo's agents take precedence.

**Siblings (2026-10-01).** GUEST-2 (`feat/w0-guest2-guest-payloads`, worktree `.claude/worktrees/guest1`, at `0a3ff5d3`, nothing committed yet; plan `2026-10-01-guest2-guest-payloads.md`) edits `routers/tiers.py`, `routers/static_groups.py`, `routers/loot_tracking.py`, `schemas/loot_tracking.py` and V1/V2 frontend files including `GoalsPage.tsx`. It adds no migration and touches none of this plan's backend files. Shared: `releaseNotes.ts` (GUEST-2 plans 2.1.64), `HOME_STRETCH.md`, `PRODUCT_MODEL.md`. Nothing else in flight edits `collection_goals.py`, `mount_farms.py`, `player_collection.py`, `authz_matrix.py` or adds a migration. Alembic head is `m6n7o8p9q0r1` (single head).

## Spec premises checked against the code (`def04893`, 2026-10-01)

| The spec / brief says | Code says | Ruling |
|---|---|---|
| The snapshot gains a nullable `character_id`; uniqueness moves to two partial unique indexes | **Confirmed.** `player_collection_snapshot.py:33-77`: `profile_id` FK CASCADE, `UniqueConstraint("profile_id","catalog_item_id", name="uq_player_collection_snapshot_profile_item")`, no character. Three write paths: Hub `upsert_snapshot` (`player_collection.py:331-398`), plugin `_upsert_snapshot` (`plugin_collection_sync_service.py:230-272`), bridge `_apply_snapshot` (`player_reward_bridge_service.py:262-309`). `PlayerCharacter` has no relationship to snapshots (`player_character.py:59-70`) | R-S1-2, R-S1-3 |
| Partial indexes "declared for both dialects so `check_migration_dialect.py` passes" | **Wrong premise.** The script's only rejection is a Boolean column with an integer `sa.text()` default (`scripts/check_migration_dialect.py:1-30`). No partial index exists anywhere in `backend/` (no `postgresql_where`, `sqlite_where`, `CREATE UNIQUE INDEX`). `check_model_tables.py` checks tables and columns, not indexes. Dev SQLite's `_add_missing_columns` (`database.py:56-79`) adds columns only: `create_all` skips existing tables with their indexes, and SQLite can't drop the old constraint without a rebuild | R-S1-3 proves the indexes another way |
| `state_changed_at` backfills from "the row's latest timestamp" | **No `created_at`** on `reward_participant_states` (`reward_participant_state.py:20-53`). Timestamps are ISO `Text`, compared through `_parse_ts`/`_is_after` (`collection_goals.py:56-69`), mixed offsets possible | R-S1-4 |
| Count merge: "the newest write, the row's or the record's" | **No per-field timestamp.** `updated_at` moves on every write (state, rank, notes), so a lead's state edit would make a stale row count "newest" | R-S1-7 adds `token_count_updated_at` to both tables |
| `list_participants` merges (V1 reads it raw) | **V1 also reads the goal list's `participant_summary`**, built from raw rows (`_participant_summary` `collection_goals.py:138-147`, called :201 and :473), in `RewardGoalCard.tsx:60`, `CatalogFarmRow.tsx:73`, `CollectionsHub.tsx:158`, `SourceFarmCard.tsx:151`. Unmerged, the card's counts would disagree with its panel | R-S1-9 merges the summaries too |
| Chain step 1: registrations, primary first, then oldest, first that resolves | **Not PROV-1's pick.** `provenance.py:154-167` reads primary registrations only (earliest, lowest id) and returns registrations, not Hub characters. A registration's linked character can belong to a previous claimant: it survives a reclaim, and `_validate_character_belongs_to_player` (`static_characters.py:131-157`) runs only at create | R-S1-5: a distinct, batched resolver that checks ownership |
| Many members resolve at once (list, seed, suggestions, sync fan-out) | `count_statements(engine, match=...)` exists (`conftest.py`, PROV-1). Active tier = `TierSnapshot.is_active` (one per static by app code, `tiers.py:353-357`); one claim per user per tier by app code (`tiers.py:1261-1271`) | R-S1-5 budget |
| Profiles with no character keep a profile-level row; the first character adopts it | Two creation paths: `link_character` (`player.py:731`, row at :775) and `_get_or_provision_plugin_character` (`player.py:1822`, `is_main=not profile.characters` :1850). `unlink_character` deletes (`player.py:870-882`). A `SET NULL` FK would collide with the profile-level index on delete | R-S1-6; owner question Q4 |
| A CASCADE FK removes an alt's records "like its gear snapshots" | **SQLite enforces no FKs here:** no `PRAGMA foreign_keys` in `app/` or `tests/conftest.py`. Gear snapshots go by an ORM `cascade="all, delete-orphan"` (`player_character.py:62-66`), not by the FK. So CASCADE and the drop log's SET NULL act on Postgres only, and an FK-only unlink leaves orphans in tests and dev | R-S1-6: explicit deletes through the door, the FK as a Postgres backstop (vet I-1) |
| CI proves the migration on Postgres | **On an empty database only.** `migration-exec` runs `alembic upgrade head`, then `downgrade base` → `upgrade head`, then `check_model_tables.py` (`.github/workflows/ci.yml:192-222`). Nothing runs the backfill UPDATEs or the downgrade dedupe against rows, and nothing checks `postgresql_where`. Production runs `alembic upgrade head` under `set -e` on every deploy (`backend/start.sh:2,5`). Without `postgresql_where`, the profile-level index is plain unique on (profile, item), so every alt write 500s in production while SQLite tests pass | R-S1-3, R-S1-4: Postgres compile test, migration AST check, scratch-Postgres gate (vet I-4) |
| The dev DB upgrades cleanly | The main checkout's `backend/data/raid_planner.db` is stamped `h1i2j3k4l5m6`, five revisions behind, and `_add_missing_columns` already added later columns. `i2j3k4l5m6n7`, `j3k4`, `k4l5`, `l5m6` and PROV-1 all guard, so `upgrade head` works, but it would find S2a-1's columns already present. A `create_all` DB built from the new model has no old constraint | R-S1-4: backfills run unconditionally and idempotently, and the constraint drop is guarded (vet I-5) |
| The plugin mount-farm sync writes the record (S2-10) | **It writes only `MountFarmProgress` and `PlayerGoal`** (`mount_farms.py:803-1005`; `_bridge_mount_farm_goals` :702). No snapshot, no participant row. Its `now` is the client's `synced_at` (`:815`) | R-S1-18: new behaviour; server clock |
| A lead's mount-farm edit for another member is that static's correction | **The bridge writes the member's snapshot** for a lead's PATCH (`mount_farms.py:343`, bridge call :427) and bulk PUT (`:457`, :505). **No live UI calls either route:** the only caller is `components/mount-farms/MountFarmDetail.tsx:63-85`, an orphaned tree whose only importer, `profile/CollectionsTab.tsx`, is imported only by its own test | R-S1-10: the bridge writes the record only for the member's own edit. API-only change, no V1 delta |
| Suggestions are "already filtered by want visibility" | **Counts leak.** The docstring says counts only when the intent is shared (`collection_suggestion_service.py:204-207`), but the snapshot read filters by profile and item only (:295-306) and counts show regardless (:352-369). Viewers can call it (`player_collection.py:189-190`). V1 renders them (`SuggestionFarmCard.tsx:212`, `DutyFarmCard.tsx:203`) | R-S1-19: behaviour follows B1; docstring fixed |
| Undo's check moves to `state_changed_at` (S2-9) | **Today it reads `last_synced_at`/`last_manual_override_at`** (`collection_goals.py:880-883`); `test_farm_drop_authz.py:429` pins the skip after a sync. V1 deletes drops through the same route, so the switch is a V1 change §7 doesn't list | R-S1-14 ships it in PR 4; owner question Q2 |
| Members' own counts (S2-7, (h)) | **Dropped for non-leads** (`collection_goals.py:553-555`, #329; pinned by `test_farm_drop_authz.py:606-643`). V1 sends `token_count: null` explicitly on every PATCH (`collectionGoalStore.ts:499-530`), so `None` must keep meaning "unchanged" | R-S1-10 |
| Hub writes are a person's writes; "only a person un-marks Have" | **The Hub refuses to lower a plugin Have** and ignores a count on a plugin row (`player_collection.py:382-393`; `test_collections_center.py:388`); the bridge does the same (`test_player_reward_bridge.py:306`, :356). V1 Profile ▸ Collections exposes the ✓/✗/? chips (`CollectionsCenterTab.tsx:466`); its count input is disabled on plugin rows (:501) | Owner question Q1 |
| The drop records the recipient's character (B11) | `reward_drop_log` has the recipient user, PROV-1's `logged_via`/`api_key_id`, no character (`reward_drop_log.py:17-59`). `RewardDropResponse`'s key set is pinned (`test_write_provenance.py:851-863`). `RewardDropCreate` takes no character | R-S1-13 |
| The privacy flag (B1) | **No home.** No privacy column on `User` or `PlayerProfile`; `PUT /api/player/profile` writes `visibility`, `bio`, `share_enabled` (`player.py:324-366`, `schemas/player.py:34-39`) and already has a `self` AUTHZ row | R-S1-19 |
| Count-carrying reads | Every count reader: `collection_goals.py` (list, summaries), `mount_farms.py` (GET `totem_count` :228 and `members_can_buy` :309; recommendations :594-658), suggestions, Hub own reads (`player_collection.py`, `player.py:538-660`). GET mount-farms' `members_can_buy` renders in V1 (`GroupViewContent.tsx:937`) and so does recommendations' (`StaticHomeTab.tsx:982`) | R-S1-19; Q5 amends (i)/(j)'s render paths |
| A record write reaches "that character's rows" | `list_participants` lists rows only (:501-528). A Hub or V1 Profile write creates no row, today or after | R-S1-9: the record reaches existing rows; a member with no row stays blank (carried to S2a-2) |
| The guard covers S2a-1's tables | `test_provenance_coverage.py` checks constructor calls only (:174-199). The record and row are mostly written in place. Tracked names are assigned only at `collection_goals.py:582-590,661-669,734,885`, `plugin_collection_sync_service.py:266-271,315-320,359-360`, `player_collection.py:379-393` and `player_reward_bridge_service.py:297-307`. `setattr` appears only at `collection_goals.py:468`, `schedule.py:918,1226` and `split_clear.py:348`. **`token_count`, `state` and `priority_rank` are also farm-row names, unrouted until PR 3.** PROV-1's registry self-test pins `set(COVERED) == set(HANDLERS)` and looks names up in its own `globals()` (`test_write_provenance.py:258-263`) | R-S1-15: PR 2 tracks only the record's names, and the new tests keep their own registry (vet I-2) |
| The plugin's sync counters | **Today they count farm rows only.** `statesUpdated`, `tokenCountsUpdated` and `skippedLocked` are set at `plugin_collection_sync_service.py:95-141`; `_sync_snapshots` (:146) counts nothing | R-S1-17: rows only (vet M-6) |
| V1 changes beyond §7's list (criterion 11) | Four more:<ul><li>V1's "My status" buttons (`ParticipantsPanel.tsx:77-92`) send Need/Want, which under R-S1-10 un-Haves the record, so their Have rows in other statics read Want and Profile ▸ Collections shows ✗.</li><li>Viewers lose `priority_rank`, and with it V1's "#n" badge (`ParticipantsPanel.tsx:119-121`) and the card's next-up line (`RewardGoalCard.tsx:66-67`).</li><li>E2's wider Pass lock keeps a seeded `player_hub` Pass that a sync would flip to Have today.</li><li>F1's backfill turns V1 panels to Have for members whose legacy Home tracker says has-mount.</li></ul> | R-S1-20 and Q2, Q5, Q6 declare them; every PR body lists them (vet I-3) |
| AUTHZ | **No new route.** The Hub PUT gains a query parameter; the privacy flag rides `PUT /api/player/profile`. The self PATCH row's intent and build change (S2-7). | R-S1-16 |

## Rulings (bind every task)

- **R-S1-1 (stacks).** PRs 1–4 (S2a-1a) are one stack and merge together; PRs 5–6 (S2a-1b) likewise, after S2a-1a. Each PR is a slice-loop run with its own review. If a stack must pause, it pauses with nothing merged.
- **R-S1-2 (columns, R-PV-1 vocabulary).** All nullable, no server default, no CHECK, no enum.
  - `player_collection_snapshots`: `character_id String(36)` FK `player_characters.id` **`ondelete="CASCADE"`** (R-S1-6); `updated_by_user_id String(36)` FK `users.id` `SET NULL`, not indexed; `updated_via String(10)`; `state_changed_at Text`; `token_count_updated_at Text`.
  - `reward_participant_states`: `updated_by_user_id`, `updated_via`, `state_changed_at`, `token_count_updated_at` (same types).
  - `reward_drop_log`: `recipient_character_id String(36)` FK `player_characters.id` `SET NULL`, indexed; `recipient_character_name String(100)`; `recipient_character_source String(10)`; `recipient_record_prior_state String(10)`; `recipient_record_prior_at Text`; `recipient_record_prior_changed_at Text` (R-S1-13, R-S1-14; vet M-10).
  - **FK actions are Postgres-only here (vet I-1).** SQLite runs without `PRAGMA foreign_keys` (none in `app/` or `tests/conftest.py`), so CASCADE and SET NULL never fire in tests or dev. Every delete these FKs would cover is done explicitly in code (R-S1-6), and the FK action is the production backstop.
  - No relationship is added. `RewardParticipantState.user` and both `RewardDropLog` user relationships already name `foreign_keys` (`reward_participant_state.py:48`, `reward_drop_log.py:58-59`), so the second FK to `users` can't make them ambiguous; `configure_mappers()` is tested anyway (PROV-1's I-1 lesson).
  - Existing rows keep NULL writer and channel: "unknown origin" (R-PV-10).
- **R-S1-3 (uniqueness).** The model drops the `UniqueConstraint` and declares `Index("uq_pcs_character_item", "character_id", "catalog_item_id", unique=True, postgresql_where=text("character_id IS NOT NULL"), sqlite_where=text("character_id IS NOT NULL"))` and `Index("uq_pcs_profile_item_no_character", "profile_id", "catalog_item_id", unique=True, postgresql_where=text("character_id IS NULL"), sqlite_where=text("character_id IS NULL"))`. The migration builds the same two with `op.create_index(..., unique=True, postgresql_where=..., sqlite_where=...)`.

Proof, since the dialect script proves nothing here:
- **SQLite:** a pytest inserts the duplicates both ways (`create_all` from the model) and gets `IntegrityError` for each, and none for one character row plus one profile-level row of one item. The scratch `alembic upgrade head` gate dumps `sqlite_master` and shows both `WHERE` clauses and no old constraint.
- **Postgres, model side (vet I-4):** a pytest compiles `CreateIndex(<each index>)` for `sqlalchemy.dialects.postgresql.dialect()` and asserts its `WHERE character_id IS [NOT] NULL`.
- **Postgres, migration side (vet I-4):** an AST check on the migration file asserts that both `op.create_index` calls pass `unique=True`, `postgresql_where=` and `sqlite_where=`.
- **Postgres with data (vet I-4):** the scratch-Postgres gate (R-S1-4) pastes `pg_indexes` for the table. CI's `migration-exec` runs only an empty database.

**Dev DBs must run `alembic upgrade head`** after PR 1: the column sync would leave the old constraint and no partial indexes. The PR body and the handoff say so.
- **R-S1-4 (the S2a-1a migration).** `backend/alembic/versions/n7o8p9q0r1s2_add_character_records.py`, `down_revision = "m6n7o8p9q0r1"`, with PROV-1's idempotent add-column and index guards (`m6n7o8p9q0r1:21-24`).
  - **Structure.** The columns above. The constraint is dropped in `batch_alter_table` (precedent `a7b8c9d0e1f2:71-74`), **only when `sa.inspect(bind).get_unique_constraints("player_collection_snapshots")` lists it**: a `create_all` DB built from the new model has none (vet I-5). Then both partial indexes and `ix_reward_drop_log_recipient_character_id`, each created only when `get_indexes` lacks it.
  - **Backfills, as module-level functions taking a sync `Connection`** so a pytest can run them through `conn.run_sync` after importing the module with `importlib`. Each carries a frozen copy of `_parse_ts` and the main rule; it imports nothing from `app`.
    - **Unconditional and idempotent (vet I-5).** They run after the column guards on every upgrade, never inside them. Each touches only rows still unset (`WHERE character_id IS NULL`, `WHERE state_changed_at IS NULL`, `WHERE token_count_updated_at IS NULL`). A dev DB whose columns `_add_missing_columns` already added gets backfilled too, and a second run changes nothing.
    - `_backfill_snapshot_characters`: each profile's rows get the profile's main (R-S1-5); a profile with no character stays profile-level.
    - `_backfill_snapshot_timestamps`: `state_changed_at` = the latest of `last_synced_at`, `updated_at` when `ownership_state != 'unknown'`, else NULL; `token_count_updated_at` = the same latest when `token_count IS NOT NULL`.
    - `_backfill_participant_timestamps`: `state_changed_at` = the latest of `updated_at`, `last_synced_at`, `last_manual_override_at` (by parsed value; the original string is stored); `token_count_updated_at` = the same when `token_count IS NOT NULL`.
  - **Downgrade (lossy, documented).** Drop the indexes; keep one row per (profile, item): the main's, else the newest `updated_at`; delete the rest; restore the constraint in batch mode; drop each index before its column (SQLite refuses an indexed column).
  - **Scratch-Postgres gate (vet I-4).** Restore `D:/FFXIV/Dev/xrp-dev/db-backups/railway-prod-2026-07-12.dump` into a throwaway database on a local Postgres with `pg_restore`, never a shared one. Run `upgrade head` → `downgrade -1` → `upgrade head`, and paste:
    - `pg_indexes` for `player_collection_snapshots`;
    - the backfill row counts (rows given a character, rows left profile-level, timestamps set);
    - the downgrade's dedupe count.

    This is the only run of the backfills and the dedupe against real rows on Postgres.
  - **`MountFarmProgress` attribution moves to PR 6** (F1), next to the mount-farm sync's own record write (R-S1-18). Nothing in S2a-1a reads it, and it is S2-10's "Migration attribution", not a criterion.
  - **Heads.** If a migration lands on `main` first, rebase and re-point `down_revision`; `check_migration_heads.py` catches a second head.
- **R-S1-5 (the main and the chain; distinct from R-PV-4).** In `backend/app/services/collection_records.py`.
  - **Main:** the first of a profile's characters by `is_main` desc, `created_at` asc, then `id` asc (the model's order, `player_profile.py:66-71`, plus a tiebreak).
  - **Chain for (static, user):** (1) the user's claimed `SnapshotPlayer` in the static's active tier (with several active tiers, the newest `created_at`) → its registrations in this static by `is_primary_for_static` desc, `created_at` asc, `id` asc → the first that resolves: a linked `PlayerCharacter` whose `profile_id` is the user's profile, or a manual registration whose `manual_character_name` and `manual_world` match exactly one of the user's characters (`name`/`server`, compared `.lower().strip()` as `player.py:760-764` does for plugin-provisioned characters); (2) else the main; (3) else the profile-level row; with no profile, no target.
  - **Interface:** `RecordTarget(user_id, profile_id, character_id, character_name, step)` with `step` in `card|main|profile|none`; `resolve_record_targets(db, pairs) -> dict[(static_group_id, user_id), RecordTarget]`; `resolve_main_targets(db, user_ids) -> dict[user_id, RecordTarget]` (steps 2–3); `main_character(characters)`.
  - **Budget:** at most five SELECTs however many pairs (active tiers, claimed players, registrations, profiles, characters), proved with `count_statements(engine, match=lambda s: s.lstrip().upper().startswith("SELECT"))` at 1 pair and at 6.
  - `provenance.py` is not edited: its pick serves log rows (R-PV-4) and stays pinned by PROV-1's tests.
- **R-S1-6 (profile-level rows, adoption, character delete).**
  - A profile with no character reads and writes its profile-level rows.
  - **Eager adoption:** both creation paths call `adopt_profile_rows(db, profile_id=, character_id=)` when the profile had no character; it sets `character_id` on every profile-level row.
  - **Defensive adoption in the door:** a write whose target is a profile's main finds no character row but a profile-level row for that item → it adopts that row (covers a race with first-character creation).
  - **Main-aimed reads fall back too (vet I-5).** `load_records` serves a `main` target's profile-level row for an item when the main has no character row for it, as the write door adopts it. A dev DB that skipped the backfill, and the window with PR 1 alone, would otherwise show an empty Profile ▸ Collections.
  - **Delete (vet I-1).** `unlink_character` (`player.py:870-882`) calls a door function before `session.delete(character)`:
    - for an alt, or a main with siblings: `delete_character_records(db, character_id=)` deletes the character's rows explicitly. The FK's CASCADE is only the Postgres backstop: SQLite enforces no FKs, and gear snapshots go by an ORM cascade (`player_character.py:62-66`), so the earlier "like its gear snapshots" didn't hold;
    - for a profile's **last** character: `release_last_character_rows(db, profile_id=, character_id=)` turns its rows profile-level, so unlink-then-relink keeps them. It first deletes any stray profile-level row for the same item (the character's row wins), so the release can't hit `uq_pcs_profile_item_no_character` and 500.

    Owner question Q4.
- **R-S1-7 (the record door and the one collision rule).** `write_record(db, target, catalog_item_id, *, actor_user_id, via, mode, now, ownership=None, token_count=None, source, confidence) -> RecordWrite(record, prior_ownership, state_changed, count_changed)` is the only code that constructs or assigns a record (R-S1-15). `prior_ownership` is `None` when no record existed.
  - `mode="person"` (Hub, own cell, own drop, a member's own mount-farm edit): ownership is set as given, so a person can lower a plugin Have (Q1); a count is set when given (newest write wins).
  - `mode="sync"` (plugin): ownership only rises to `have`, never lowers; a count is set when given; `source="plugin"`, `last_synced_at = now`. This is today's `_upsert_snapshot` rule, so PR 2 changes no sync behaviour.
  - **Timestamps:** `state_changed_at = now` when the stored ownership changes, or on create with an explicit ownership (a token-only create leaves it NULL); `token_count_updated_at = now` whenever a count is given, changed or not; `updated_at = now`; `updated_by_user_id = actor_user_id`; `updated_via = via`. `now` is the server clock everywhere, never the plugin's `synced_at`. One exception: an optional `restore_state_changed_at=` sets `state_changed_at` to a stored value instead of `now`. Only Undo's record revert passes it (R-S1-14, vet M-10).
  - **Rows (PR 3):** `write_row(db, *, row, goal_id, static_group_id, user_id, actor_user_id, via, now, state=UNSET, token_count=UNSET, priority_rank=UNSET, notes=UNSET, source=UNSET, last_synced_at=UNSET, last_manual_override_at=UNSET) -> RowWrite`. It sets only what it's given, bumps `state_changed_at` when the state value changes (or on create), and `token_count_updated_at` when a non-None count is given. It decides nothing: each caller keeps its rule.
- **R-S1-8 (attribution).** The writer is the authenticated user; the channel is `logged_via(request)`. Services take `actor_user_id` and `via` as required keyword-only parameters; routes compute them.
  - **Own vs correction (derived, R-PV-3):** a row value is the member's own when `updated_by_user_id == user_id` (the self route, a lead's route aimed at themselves, the member's plugin, their own drop); a **correction** when `updated_by_user_id` is set and differs (a lead's edit, a lead's drop for someone else, a restore by someone else).
  - **Derived rows:** Track's seed copies the member's own signals, so its rows record `updated_by_user_id = NULL` and `updated_via = logged_via(request)`. NULL writer with a channel means "derived"; NULL with NULL means "predates S2a-1". Recording the lead would make every seeded Have a correction that a member's later un-Have can't reach (S2-10), and label every seeded cell "set by {lead}". The goal's `created_by_id` records who tracked it.
    - **Vetted:** the director agreed (plan-vet). **Recorded edge:** `updated_by_user_id` is `SET NULL` on user delete (Postgres), so a deleted lead's corrections then read as derived and yield to a newer un-Have. That's accepted: the corrections' author is gone.
  - **`source` keeps its three values** (delta (c)); the merge never emits another.
- **R-S1-9 (the merge).** `merge_participant(row, record) -> MergedParticipant(state, token_count, source, state_from_record, count_from_record)`, a pure function, plus `merged_participants(db, *, static_group_id, rows)` (as built it also takes `catalog_item_by_goal`; see As built), batched: one chain resolution and one record SELECT for all rows of all goals.
  - **No record** (goal without `catalog_item_id`, no target, no record row): the row as stored.
  - **State.** `newer` = the record's `state_changed_at` is set and later than the row's (or the row's is NULL).
    1. A Pass that isn't a correction → Pass. This keeps a seeded `player_hub` Pass over a newer record Have, where V1 shows Have today. It is declared with (a) (vet I-3).
    2. The record says `have` and is `newer` → Have.
    3. The row says Have, isn't a correction, and the record says `missing` or `unknown` and is `newer` → **Want** (Q3).
    4. Otherwise the row's state.
  - **Count:** the record's when the row's is NULL; the row's when the record's is NULL; otherwise the later `token_count_updated_at` (a NULL time loses; a tie goes to the record).
  - **`source`:** the side the state came from.
  - **Where:** `list_participants`, every participant response (the two PATCH routes), and the goal summaries (`list_collection_goals`, `update_collection_goal`, the seed's response). `list_collection_goals` reads all rows in one SELECT instead of one per goal.
  - **Budget:** `list_participants` and `list_collection_goals` issue the same number of SELECTs for 1 member as for 6 (`count_statements`).
  - **Response (optional, additive; snake_case on the wire).** `ParticipantStateResponse` gains the row's `updated_by_user_id`, `updated_via`, `state_changed_at`, `token_count_updated_at`, plus `state_from_record` and `count_from_record` (default `false`), and `record: ParticipantRecordView | None`. The view has the record's `character_id`, `ownership_state`, `token_count`, `source`, `updated_by_user_id`, `updated_via`, `state_changed_at`, `token_count_updated_at` and `last_synced_at`. S2a-2 labels cells from these (S2-7, B2, B10); `state`, `token_count` and `source` carry the merged values.
    - **R-PV-8 doesn't bar them (vet M-11).** R-PV-8 governs PROV-1's log-row fields (loot, material, book, drop). These participant fields are additive and optional, and no plugin route reads `list_participants`.
  - **Rows only.** A record reaches existing rows; it never creates one, as today. A member with a record but no row stays blank (carried to S2a-2).
- **R-S1-10 (who writes the record).** The target is the member's character in this static by the chain, and the goal must have a `catalog_item_id`.
  - **The self route** (`upsert_participant_state`, and the lead route when the target is the caller):
    - the row gets `state`, `notes`, and `priority_rank` for leads only (as today), with `source="manual"` and `last_manual_override_at` (as today);
    - `have` → the record rises to `have`;
    - `need`/`want` while the record says `have` → the record goes to `missing` (an un-Have). V1's "My status" buttons (`ParticipantsPanel.tsx:77-92`) send this, so their Have rows in other statics read Want and Profile ▸ Collections shows ✗. Declared with (a), per Q6 (owner, 2026-10-01; vet I-3);
    - `pass` → the record is untouched;
    - **a count from anyone (delta (h))** → the record, else (no profile, or a goal without a catalog item) the row. `None` means unchanged; a count can't be cleared, as today.
  - **A lead's route for another member:** the row only, a correction (as today, plus attribution).
  - **The member's own drop:** R-S1-13.
  - **The Hub:** R-S1-11.
  - **The bridge (mount-farm PATCH and bulk PUT):** the member's record, by the chain in that static, only when `target_user_id == user.id`, in `person` mode with `source="player_hub"`. A lead's edit for someone else still writes `MountFarmProgress` and the intent as today, but not the record. No live UI calls these routes (premises), so V1 doesn't change.
  - **Never:** a lead's correction, a viewer.
- **R-S1-11 (Hub parameter, B8).** `GET /api/me/collection-snapshots`, `GET /api/me/collection-catalog` and `PUT /api/me/collection-snapshot/{catalog_item_id}` take an optional query `character_id`.
  - It must be one of the caller's characters, else 404 "Character not found" and nothing is written.
  - Default: the main; a profile with no character reads and writes its profile-level row.
  - `CollectionSnapshotResponse` gains `character_id: str | None = None`. `CatalogPlayerEntry` is unchanged and reads the chosen target's record.
  - The PUT takes `request` for the channel. A profile is still auto-created on write (`player_collection.py:353`).
- **R-S1-12 (Track seed, B5).** `create_goal_from_suggestion` reads each non-viewer member's record by the chain (batched).
  - A member with no signal (no record value, no shared intent, no legacy signal) gets **no row** (delta (g)). The summary counts only the rows created.
  - Seeded rows are derived (R-S1-8): `state_changed_at = now`, and `token_count_updated_at = now` when a count is copied. The priority order of signals is unchanged.
- **R-S1-13 (the drop's character, B11).**
  - `log_drop` resolves the recipient's chain target in this static. A character → `recipient_character_id`, `recipient_character_name` (its `name` at write time) and `recipient_character_source = CHARACTER_SOURCE_DEFAULT`, reusing PROV-1's constant: the server filled it in, since no client sends one. No character, no recipient, or no profile → three NULLs.
  - **The member's own drop** (recipient == caller, including a lead's own) with a target and a catalog item, while the record isn't `have`: the record rises to `have` (`person` mode, `source="manual"`). The drop stores three values:
    - `recipient_record_prior_state`: the prior ownership; `"unknown"` when no record existed;
    - `recipient_record_prior_at = now`: equals the record's new `state_changed_at`;
    - `recipient_record_prior_changed_at`: the record's `state_changed_at` before the raise; NULL when it had none or no record existed (vet M-10).
  - A lead's drop for someone else changes only this static's row, as a correction.
  - **No response change** (R-PV-8): `RewardDropResponse` and `DROP_KEYS` (`test_write_provenance.py:851-863`) stay as they are. The display slice shows the character.
- **R-S1-14 (Undo; ships in PR 4, not S2a-3a).** The column and the record write ship in S2a-1a, and V1's drop delete already exercises both. Leaving the old check would keep a dead column. Leaving out the record revert would let a V1 Undo restore one static while the member's other statics keep the Have. S2a-3a demonstrates criterion 4 in V2. Owner question Q2 declares the V1 change.
  - **Restore check:** skip when the row's `state_changed_at` is after `prior_at`; a plugin token sync no longer blocks Undo. The restore is a row state write by the deleter (`write_row`).
  - **The record prior** (all three values) hands off between this goal's drops exactly as the row prior does (`collection_goals.py:854-868`, with `recipient_record_prior_at` as its time).
  - **Record revert:** when the last drop for the recipient on this goal goes, revert only if:
    - the deleter is the recipient (a lead's delete stays this static's correction);
    - the record's `state_changed_at` equals `recipient_record_prior_at` (compared parsed);
    - the record says `have`.

    The revert sets the prior ownership in `person` mode with `restore_state_changed_at = recipient_record_prior_changed_at` (vet M-10). It doesn't read as a new un-Have, so another static's non-lead Have from before the drop doesn't yield to Want.
  - **Vetted:** a lead's delete restores only this static's row. The director agreed: S2-10 keeps a lead's action local, and Undo is the member's own action.
  - **Accepted edge:** an "I got it" for the same item in two statics isn't cross-checked. A mount drops once per player, so this is a data error, recorded.
- **R-S1-15 (the completeness guard).** `backend/tests/test_provenance_coverage.py` grows. PR 2 builds the machinery with `PlayerCollectionSnapshot`; PR 4 adds `RewardParticipantState` and the drop's keywords.
  - **Models:** `PROVENANCE_MODELS` gains `"PlayerCollectionSnapshot": "player_collection_snapshots"` (PR 2) and `"RewardParticipantState": "reward_participant_states"` (PR 4). `REQUIRED_KEYWORDS` becomes a per-model map:
    - log tables as today;
    - the record: `updated_by_user_id`, `updated_via`, `state_changed_at`, `token_count_updated_at`, `character_id`;
    - the row: the same four, without `character_id`;
    - `RewardDropLog` adds `DROP_KEYWORDS = {recipient_character_id, recipient_character_name, recipient_character_source, recipient_record_prior_state, recipient_record_prior_at, recipient_record_prior_changed_at}` (the last per vet M-10). **Yes, they join** (brief's question): `log_drop` is the one site, and the rule stops a later edit from dropping B11.
    - `updated_via` is never the constant `None`, as `logged_via`.
  - **(a) Sites.** `EXPECTED_SITES` gains `("app/services/collection_records.py", "write_record")` and (PR 4) `("…", "write_row")`. No other function may construct either model.
  - **(c) Bulk and raw writes** extend to these tables and gain update forms: `update(<model>)` under any import name (e.g. `from sqlalchemy import update as sa_update`), `<model>.__table__.update()`, and raw `UPDATE <table>`, bare, quoted, schema-qualified or lowercase. New fixtures go into `WRITE_FORMS` and `OTHER_TABLE_WRITES`.
  - **(e) One door for in-place writes (new).** The tracked attributes are added in two steps (vet I-2). Until PR 3 routes the farm rows, `token_count`, `state` and `priority_rank` are still assigned on rows outside the door (`collection_goals.py:582-590,661-669,734,885`; `plugin_collection_sync_service.py:315-320,359-360`). So:
    - **PR 2:** `TRACKED = {ownership_state, character_id, updated_by_user_id, updated_via, state_changed_at, token_count_updated_at}`, the record's names that no row code assigns;
    - **PR 4 (D3):** adds `{state, token_count, priority_rank}`, once C1–D2 have routed every row write.

    The rules:
    - Every Assign, AugAssign or AnnAssign whose target, or any element of a tuple target, is an `Attribute` with `attr in TRACKED`, and every `setattr(x, "<tracked>", v)`, anywhere in `app/` and `scripts/`, must sit in a function of `DOOR_FUNCTIONS`, all in `collection_records.py`. The set of enclosing functions equals `DOOR_FUNCTIONS` exactly.
    - **A non-constant `setattr` fails in every module (vet M-8)** unless its function is in `DYNAMIC_SETATTR_OK`, each entry with a reason. Today's four sites:
      - `collection_goals.py:update_collection_goal` (:468, CollectionGoal fields);
      - `schedule.py:update_schedule_session` (:918);
      - `schedule.py:update_schedule_settings` (:1226);
      - `split_clear.py:upsert_split_clear_assignment` (:348).
    - **Any call to `set_attribute`** (SQLAlchemy's `orm.attributes.set_attribute`, none in `app/` today) fails (vet M-8).
    - `request.state.x = …` doesn't match: its attribute is `x`.
  - **(f) The door stamps.** Each `DOOR_FUNCTIONS` member that assigns a fact attribute (`state`, `token_count`, `ownership_state`, `priority_rank`) on a name also assigns `<name>.updated_by_user_id` and `<name>.updated_via` in the same function. Adoption and release assign only `character_id`, so (f) doesn't apply to them.
  - **(g) Door callers.** Every call of a door entry point (`write_record`, `write_row`) passes `actor_user_id=` and `via=` explicitly, with no `**`.
    - **`via` is never a constant** (vet M-8): neither `None` nor a string literal such as `"web"`. It comes from `logged_via(request)` or a parameter that carried it (R-PV-1).
    - `actor_user_id` is the constant `None` only at `DERIVED_CALLERS = {("app/routers/collection_goals.py", "create_goal_from_suggestion")}` (R-S1-8).
    - The set of calling (module, function) pairs equals `EXPECTED_DOOR_CALLERS`.
  - **(d) Coverage.** The handlers are the non-door `EXPECTED_SITES` functions, `MOVE_HANDLERS`, and the functions in `EXPECTED_DOOR_CALLERS`.
    - **Two registries (vet I-2).** PROV-1's registry self-test pins `set(COVERED) == set(HANDLERS)` and looks each name up in its own `globals()` (`test_write_provenance.py:258-263`), so new tests can't register there.
    - `tests/test_record_provenance.py` gets its own `RECORD_COVERED` registry, a `covers_record(<function>)` decorator, and a twin self-test against its own handler list.
    - (d) checks `set(COVERED) | set(RECORD_COVERED)` against the handlers, with no empty lists. `test_write_provenance.py` is not edited for this.
    - A test passes the label only if it exercises that function: route tests read the stored writer and channel.
  - **Self-tests (vet M-8):** one snippet per form that (c), (e), (f) or (g) must refuse, and one each that must pass:
    - **(e):**
      - `row.ownership_state = "have"` outside the door (PR 2) and `row.state = "have"` (PR 4);
      - `a.ownership_state, b = …`;
      - `row.state_changed_at: str = now` (AnnAssign);
      - `row.token_count += 1` (PR 4);
      - `setattr(row, "ownership_state", v)`;
      - `setattr(row, name, v)` in an unlisted function;
      - `set_attribute(row, "state", v)`;
    - **(f):** a door function assigning `ownership_state` with no stamp, and with both stamps → passes;
    - **(g):** `write_record(..., via=None)`, `via="web"`, `actor_user_id=None` outside `DERIVED_CALLERS`, `**kwargs`, and a missing `via=`;
    - **(c):**
      - `update(PlayerCollectionSnapshot)`;
      - aliased `sa_update(PlayerCollectionSnapshot)`;
      - `PlayerCollectionSnapshot.__table__.update()`;
      - `text('UPDATE "player_collection_snapshots" SET …')`;
      - lowercase `text("update reward_participant_states set …")`;
    - **must pass:** `request.state.auth_credential = "x"` and `update(OtherModel)`.
- **R-S1-16 (AUTHZ).** No mutation route is added, so `test_route_table_is_complete` stays green.
  - The self row (`authz_matrix.py:515-517`) becomes "set your own status and totem count (S2-7)", with build `{"state": "want", "token_count": 3}`.
  - A direct test proves that a member's count is stored and that `priority_rank` is still dropped.
  - The Hub PUT row stays `CALLER_SCOPED`. B1 adds a test that another user's `character_id` returns 404 and writes nothing.
  - `PUT /api/player/profile` keeps its row; F2 adds a test that the flag changes only the caller's profile.
- **R-S1-17 (the syncs, S2a-1b·1).**
  - **Match (E1):** `match_sync_character(characters, name, world) -> (PlayerCharacter | None, reason)`, with `reason` in `matched|null|unknown|unmatched|ambiguous`. Comparison is `.lower().strip()`; `"unknown"` in any case counts as no name; the world narrows only when it's sent and non-empty.
  - **Matched character C:**
    - the record is C's (`sync` mode);
    - rows are written only in the non-viewer statics whose chain resolves to C;
    - the other statics read C's record only where it is their character, so a lead's correction in one static changes no other (criterion 6).
  - **Unresolved (B6):**
    - rows in every non-viewer static, as today;
    - the record is the main's, else the profile-level row, as today's `_sync_snapshots` writes the profile;
    - no profile → no record, as today (`plugin_collection_sync_service.py:165-171`).
  - **One rule for rows and records, in the door:**
    - syncs only raise to Have;
    - syncs never change a Pass: every Pass row came from a person (the member, their shared want, or a lead), because the plugin never writes Pass;
    - a count is the newest write.

    This widens today's lock (`plugin_collection_sync_service.py:310-311`, `manual` Passes only) to seeded `player_hub` Passes, as S2-10 states. V1 then shows Pass where it shows Have today; this is declared with (a) (vet I-3).
  - **Counters (vet M-6):** `statesUpdated`, `statesUnchanged`, `tokenCountsUpdated` and `skippedLocked` count farm rows only, as today (`plugin_collection_sync_service.py:95-141`; `_sync_snapshots` :146 counts nothing). Record writes aren't counted. The shapes are unchanged.
- **R-S1-18 (mount-farm sync, S2a-1b·1).**
  - `plugin_sync_mount_farms` keeps its `MountFarmProgress` rule exactly (V1 Home unchanged) and its `PlayerGoal` bridge.
  - **New:** it writes the record through the same service. The target is the matched character, else the main or profile-level row. It maps a trial to catalog items the way `player_reward_bridge_service.py:73-79` does (`source_duty_key`, category `mount`, `is_active`). Owned mounts raise; totem counts are the newest write.
  - It writes no participant rows (the merge reads the record), and it uses the server clock.
  - **History (PR 6, F1):** a data migration attributes each existing `MountFarmProgress` row to the member's chain target in that static.
    - Where sources disagree, ownership is the OR and the count is the most recent. The migration's writer and channel are NULL (unknown origin). No profile → skipped.
    - **It carries a frozen copy of the whole chain (vet M-9):** active tier, claimed player, registration order, the ownership check, the manual match and the main rule. The main rule alone isn't enough, and it imports nothing from `app`.
    - **Its timestamps come from the MFP rows (vet M-9):** `state_changed_at` and `token_count_updated_at` are the latest of the row's `last_plugin_sync_at`, `last_manual_override_at`, `last_imported_at` and `updated_at`, never the migration clock. A backfill stamped "now" would beat every real write in the merge.
    - It runs unconditionally and idempotently, as R-S1-4's backfills do (vet I-5), and passes the same scratch-Postgres gate (vet I-4).
    - **V1 change (vet I-3):** V1 panels turn Have for members whose legacy Home tracker says has-mount. This is declared with (a).
- **R-S1-19 (count visibility, B1; S2a-1b·2).**
  - **The flag:** `player_profiles.hide_collection_counts` Boolean, not null, `server_default=sa.false()` (the dialect script's convention), in F1's migration. `PlayerProfileUpdate` gains `hide_collection_counts: bool | None = None`; `PlayerProfileResponse` gains `hide_collection_counts: bool = False` (camelCase on the wire). No new route.
  - **The rule:** `count_visibility(db, *, static_group_id, viewer_user_id, viewer_role, user_ids) -> set[str]`. A viewer sees no counts; anyone else sees every count except those of members whose flag is set; a caller always sees their own.
  - **Gated reads:**
    - `list_participants` and every participant response: `token_count` and `record.token_count` null. For viewers, `priority_rank` is null too, since "no queue order" (S2-7). That removes V1's "#n" badge (`ParticipantsPanel.tsx:119-121`) and the card's next-up line (`RewardGoalCard.tsx:66-67`) for viewers, so (i)'s line names queue order (vet I-3);
    - GET mount-farms: per-member `totem_count` null. The schema becomes `int | None`; V1's `> 0` tests treat null as no count (`staticActivity.ts:113,142`). `members_can_buy` leaves out hidden members' counts;
    - suggestions: a member's `token_count` and `can_buy` withheld, and a hidden count scores as unknown. The docstring is rewritten to B1;
    - recommendations: per-farm aggregates only, hidden members counted as unknown (the recorded exception).
  - **Viewers keep per-farm aggregates** (`members_can_buy` on the mount-farm GET and recommendations), as the spec's recorded exception, per Q7 (owner, 2026-10-01).
  - **Exceptions, tested:** the activity log carries no count, Hub reads return only the caller's own, and the dossier match reads wants only.
  - Hidden counts are hidden from leads too.
- **R-S1-20 (release notes; `pr-checklist`).** S2a-1a's deltas change what V1 shows, so they're **public** items: `CURRENT_VERSION` moves to the release's version once it holds a public item. Plumbing items are `internal: true`.
  - **One release per stack:** S2a-1a's version is the highest `RELEASES[].version` on `origin/main` + 1, read at PR 1's Finish (2.1.65 if GUEST-2 takes 2.1.64). PR 1 creates it internal; PR 2 adds the first public item, removes the release-level `internal: true` and sets `CURRENT_VERSION`; PRs 3–4 add items. S2a-1b takes the next free version the same way.
  - **Format:** single-quoted strings, `'` escaped as `\'`, written with the Edit tool; `pr`/`prTitle` filled after `gh pr create`.
  - **Lines:**
    - PR 1 internal: "Collection records can be kept per character".
    - PR 2 public (b): "Your collection is now kept per character; Profile ▸ Collections shows your main." Plus Q1's and Q4's lines if accepted.
    - PR 3 public: (a) "Your mounts and totems now follow your character into every static you play it in." (g) "Newly tracked farms no longer mark everyone as Want; members without a signal start blank." (h) "Members can set their own totem counts."
    - PR 4 public: Q2's line; internal: the drop's character.
    - PR 5 public: (a)'s second half, "When the plugin's character name matches one of your characters, a sync updates only the statics where you play that character."
    - PR 6 public: (i) "Viewers see farm statuses without totem counts or queue order." (vet I-3) (j) "Totem activity on Home now respects who may see totem counts." Internal: the flag API.
  - **(a)'s write list, as amended (vet I-3; Q2, Q6):** the plugin, the Hub, V1 Profile ▸ Collections, the member's own Have from V1, **their own drop, their own Need/Want over a Have (an un-Have), seeded `player_hub` Passes kept against syncs and the merge, and the legacy tracker's has-mount via F1**. Each PR body lists the V1 changes it ships, with their render paths.
- **R-S1-21 (siblings and heads).** Before each push, `git fetch` and `git log HEAD..origin/main -- backend/alembic/versions frontend/src/data/releaseNotes.ts`. On a new migration: rebase and re-point `down_revision`. On a release: renumber per R-S1-20.

## Owner answers already given (binding)

- **B1** members see every count; viewers states only; a Hub flag hides your own (R-S1-19). **B2** counts are ranked as given and labelled by origin (R-S1-9's response fields). **B5** no-signal members start blank (R-S1-12). **B6** an unresolved sync writes every non-viewer static (R-S1-17). **B8** Hub writes target a picked character, default main; S2a-1a ships the parameter (R-S1-11). **B11** drops record the character (R-S1-13). B3, B4 and B7 bind S2a-2…S2a-5, not this plan.
- **Owner Q, accepted (spec):** a hidden count ranks as unknown (client-side, S2a-2; the server withholds it); a member's own "I got it" writes the record, a lead's drop for someone else stays local, and Undo reverts the record only while its `state_changed_at` is unchanged (R-S1-13, R-S1-14); a sync re-raises a person's un-Have (R-S1-17).

## Owner questions (answered 2026-10-01: all seven as recommended; binding)

The plan is written to each recommendation, and the owner accepted all seven. The "If declined" lines are kept as the record of what each answer ruled out.

1. **Q1 · A person's un-Have and count on a plugin-synced record.** S2-10 says only a person un-marks Have and a count is the newest write. Today the Hub and the bridge refuse both on plugin rows (`player_collection.py:382-393`).
   - Applying the one rule changes V1: Profile ▸ Collections' ✗ and ? now take effect on a plugin-synced mount until the next sync reports it. Through the merge (PR 3), the change also reaches the member's statics.
   - The count input stays disabled on plugin rows in V1, so only the API changes there. `test_collections_center.py:388` and `test_player_reward_bridge.py:306,356` flip.
   - **Recommend: apply the one rule, and declare it under (b)** with "Marking a plugin-synced mount as missing in Profile ▸ Collections now sticks until your next plugin sync, in your statics too." The director agrees and added "in your statics too".
   - *If declined:* `person` mode keeps today's plugin protection for Hub and bridge writes. The three tests stay. The Progress cell's un-Have (S2a-2) can't lower a plugin Have either.
2. **Q2 · Undo in V1 and the own drop.** Two §7 additions; the director agrees with both.
   - Undo now restores after a plugin token sync. V1's drop delete gets the fix; `test_farm_drop_authz.py:429` flips. **Recommend: declare delta (k)** with "Removing a farm drop now restores the member's earlier status even after a plugin sync" and ship it in PR 4.
   - **Recommend: amend (a)'s write list** with "and their own drop", and with Q6's un-Have from Need/Want (vet I-3).
   - *If declined:* D2's restore check keeps `last_synced_at`/`last_manual_override_at` until S2a-3a; `:429` stays. The record revert still ships, since it needs only `state_changed_at` on the record. (a)'s list loses the own drop, and D1 stops writing the record on own drops.
3. **Q3 · What a yielding Have shows.** S2-10 says a row's Have that no lead set yields to a newer un-Have on the record, but not to what. **Recommend: Want**, the seed's mapping of a `missing` record (`collection_goals.py:403-406`). The director agrees.
   - *If declined:* R-S1-9's case 3 maps to the owner's choice (e.g. Need); C1's table changes one row.
4. **Q4 · Deleting a character.** The director agrees, with vet I-1's explicit deletes. **Recommend:**
   - an alt's records go with it, deleted explicitly, with CASCADE as the Postgres backstop;
   - the last character's records return to the profile, so unlink-then-relink keeps them;
   - deleting a main that has siblings removes the main's records, and Profile ▸ Collections then shows the new main's;
   - **changing your main changes which collection Profile ▸ Collections shows** (`update_character` sets `is_main`, `player.py:826-841`).

   Declare under (b): "Removing a character from your profile permanently removes its collection; removing your last character keeps it on your profile. Changing your main changes which collection Profile ▸ Collections shows."

   *If declined (keep records):* `delete_character_records` releases them to profile-level instead, merging into any existing profile-level row by the collision rule, and the FK becomes SET NULL plus that code path. B1's unlink tests change.
5. **Q5 · Render paths of (i) and (j).** The director amended it. Count gating also reaches:
   - for (i): V1's Suggested cards (`SuggestionFarmCard.tsx:212`, `DutyFarmCard.tsx:203`), and **viewers' queue order**: the "#n" badge (`ParticipantsPanel.tsx:119-121`) and the card's next-up line (`RewardGoalCard.tsx:66-67`). (i)'s line becomes "…without totem counts or queue order" (vet I-3);
   - for (j): the mount-farm GET's `membersCanBuy` (`GroupViewContent.tsx:937`) and recommendations' (`StaticHomeTab.tsx:982`). These change only for members who set the flag, and nobody can until HUB ships the toggle. **That "flag-only" note holds only if Q7 = keep.**

   **Recommend: add these paths to (i) and (j), with (i)'s amended line.**

   *If declined (viewers keep queue order):* F3 leaves `priority_rank` ungated for viewers, and (i)'s line stays as the spec wrote it.
6. **Q6 · V1's Need/Want over a Have un-Haves the character's record (vet NQ1, from I-3).** Under R-S1-10, V1's "My status" Need or Want (`ParticipantsPanel.tsx:77-92`) on an item the record says you own marks the record `missing`. Your Have rows in other statics then read Want, and Profile ▸ Collections shows ✗.
   - **Recommend: yes**, declared under (a). It's S2-7's "Have (and un-Have) … go to the member's character record" and S2-10's "a member's own un-Have writes the record".
   - *If declined:* Need/Want write only this static's row. The record's un-Have comes only from the Hub and V1 Profile ▸ Collections, and S2a-2's cell would need an explicit un-Have action. C2's un-Have test inverts.
7. **Q7 · Viewers keep per-farm aggregates (vet NQ2).** `members_can_buy` on the mount-farm GET, and `members_can_buy` and `members_close_to_target` on recommendations, are aggregates derived from counts.
   - **Recommend: keep them for viewers**, as the spec's recorded exception for recommendations. Hidden members still count as unknown.
   - *If declined:* F3 zeroes those aggregates for viewers. V1 viewers' `membersCanBuy` (`GroupViewContent.tsx:937`, `StaticHomeTab.tsx:982`) changes as soon as PR 6 merges, so (j)'s render paths gain those viewer paths and (j)'s note is no longer flag-only.

**Drafter rulings the director vetted (agreed; not owner questions):**
- seeded rows record a NULL writer (R-S1-8). Recorded edge: under SET NULL a deleted lead's corrections read as derived;
- a lead's delete of a member's own drop restores only this static's row (R-S1-14).

## Review Focus

- **The guard bites.** (e), (f) and (g) fail on an in-place write outside the door, a door write without a stamp, a caller passing `via=None` or a literal `via`, a new caller with no `@covers_record` test, an unlisted dynamic `setattr`, `set_attribute`, and an `update()` or raw `UPDATE`. Every failure is pasted.
  - PR 2's `TRACKED` holds only the record's names, and PR 4 adds the row's (vet I-2).
  - PROV-1's registry self-test passes unedited (vet I-2, M-8).
- **The merge (C1).** Each of R-S1-9's four state cases and three count cases, with legacy rows (NULL writer). The response's `source` stays in the three values. Fixed SELECT counts on both reads. V1's goal summary agrees with its panel.
- **The chain.** Each step and each fallthrough: a reclaimed card's foreign linked character is skipped; a manual registration matches by name and world, and an ambiguous one is skipped; no active tier; several active tiers. Five SELECTs at most.
- **The profile cases (criterion 13):** no character, first character adopts, no `is_main`, cleared main, last-character unlink. V1 Profile ▸ Collections shows the same values before and after the migration.
- **Deletes are explicit (vet I-1).** On SQLite, which enforces no FKs, unlinking an alt deletes its records. A last-character release over a stray profile-level row doesn't 500. No test relies on CASCADE or SET NULL firing.
- **The migration.**
  - The constraint swap in batch mode, guarded by `get_unique_constraints`.
  - Both partial indexes: SQLite by inserts; Postgres by the compile test, the migration AST check and the scratch-Postgres `pg_indexes` (vet I-4).
  - The backfills (main, timestamps): unconditional, idempotent, run twice with no change (vet I-5).
  - A lossy but working downgrade; upgrade → downgrade → upgrade on SQLite and on the restored prod dump.
- **Main-aimed reads** serve a profile-level row when the main has none (vet I-5).
- **Undo's revert** restores the record's prior `state_changed_at`, so other statics' pre-drop Haves stand (vet M-10).
- **Attribution.** Every write records the actor and channel from `request.state`; seed rows record a NULL writer; a lead's correction never writes the record; the bridge writes only the member's own edit.
- **V1 deltas only as declared** (vet I-3). `test_write_provenance.py`'s `DROP_KEYS` is unedited. Every changed old test is listed in the PR body with the delta it implements. So are the four vet I-3 changes:
  - the un-Have from Need/Want;
  - viewers' queue order;
  - the seeded `player_hub` Pass;
  - F1's legacy has-mount.
- **The plugin contract.** Both sync requests work byte for byte with a bare key; the response key sets are unchanged. The counters count farm rows only (vet M-6).

## PR 1 · S2a-1a·1 — record foundation (invisible)

### Task A1 — migration and models (RISKIEST in PR 1 · `xivrp-implementer-deep`)

**Files.** Create `backend/alembic/versions/n7o8p9q0r1s2_add_character_records.py` and `backend/tests/test_character_records_schema.py`. Modify `backend/app/models/{player_collection_snapshot,reward_participant_state,reward_drop_log}.py`. Not `database.py`.

**Interfaces produced:** R-S1-2's columns; R-S1-3's two indexes; the migration's three `_backfill_*` functions (R-S1-4).

1. **Tests first.**
   - `configure_mappers()` succeeds.
   - On the model schema:
     - two profile-level rows of one (profile, item) → `IntegrityError`;
     - two rows of one (character, item) → `IntegrityError`;
     - one profile-level row and one character row of the same (profile, item) → both insert;
     - two characters of one profile, same item → both insert.
   - **Postgres side (vet I-4):**
     - `str(CreateIndex(idx).compile(dialect=postgresql.dialect()))` contains `WHERE character_id IS NOT NULL` for `uq_pcs_character_item` and `WHERE character_id IS NULL` for `uq_pcs_profile_item_no_character`;
     - an `ast` walk of the migration file finds both `op.create_index` calls for those names, each with `unique=True`, `postgresql_where=` and `sqlite_where=`.
   - **Backfills.** Load the migration with `importlib.util.spec_from_file_location`, seed rows in the pre-migration shape (`character_id` NULL), and run each `_backfill_*` through `conn.run_sync`:
     - a profile with characters "Alt" (`is_main` false, older) and "Main" (`is_main` true) → its rows get "Main";
     - with no `is_main` → the oldest; equal `created_at` → the lower `id`;
     - no character → stays NULL;
     - snapshot timestamps per R-S1-4, including `unknown` → `state_changed_at` NULL;
     - a participant row whose `last_manual_override_at` is the latest, with a `+00:00` vs `Z` mix → that string is stored;
     - **idempotent (vet I-5):** a second run of each backfill changes no row; a row already holding a value (e.g. `state_changed_at` set) keeps it.
   - The new drop column `recipient_record_prior_changed_at` exists (vet M-10).
2. **Implement** R-S1-2, R-S1-3, R-S1-4, with the backfills outside the column guards and the constraint drop guarded by `get_unique_constraints` (vet I-5).
3. **Gates.**
   - `<venv python> -m pytest tests/test_character_records_schema.py tests/test_collections_center.py tests/test_farm_drop_authz.py tests/test_plugin_collection_sync.py -q`, then the full suite (paste the count).
   - `<venv python> scripts/check_migration_heads.py && <venv python> scripts/check_migration_dialect.py`.
   - With `DATABASE_URL` at a scratch SQLite file in the session scratchpad: `alembic upgrade head`, then `downgrade -1`, then `upgrade head`. Paste the output and `SELECT name, sql FROM sqlite_master WHERE tbl_name='player_collection_snapshots' AND type='index'`.
   - **The dev DB (vet I-5):** copy the main checkout's `backend/data/raid_planner.db` (stamped `h1i2j3k4l5m6`) to the scratchpad. Run `alembic upgrade head` on the copy, and paste the head, the index dump, and the count of rows given a character.
   - **Scratch Postgres (vet I-4):** R-S1-4's gate on the restored prod dump. Paste `pg_indexes`, the backfill counts and the downgrade's dedupe count. If no local Postgres is reachable, stop and say so: this gate isn't optional.
   - `ruff check` on the touched files.

**Ad hoc mutation checks (execute, paste, revert):**
- Drop `sqlite_where` from the profile-level index. The duplicate-character-rows-of-one-profile case fails.
- Drop `postgresql_where` from the model's profile-level index. The compile test fails (vet I-4).
- Move a backfill inside the add-column guard. The dev-DB copy leaves rows unbackfilled (vet I-5).

### Task A2 — the chain and the main (`xivrp-implementer`)

**Files.** Create `backend/app/services/collection_records.py` (chain section) and `backend/tests/test_collection_records_chain.py`.

**Interfaces produced:** `RecordTarget`, `main_character`, `resolve_record_targets`, `resolve_main_targets` (R-S1-5).

1. **Tests first,** one per case (criterion 13 and S2-10's tests line):
   - **Step 1:**
     - a primary linked registration → that character, `card`;
     - no primary → the oldest that resolves;
     - a linked character on another user's profile, as after a reclaim → skipped;
     - a manual registration matching one character by name and world in a different case → it;
     - a manual registration matching two → skipped;
     - a registration in another static → ignored;
     - a card in a non-active tier → step 2.
   - **Step 2:**
     - the main, `main`: "Not on the roster" (no card), no registration, nothing resolves;
     - no `is_main` → the oldest;
     - main cleared (`is_main=False` on all) → the oldest.
   - **Step 3:** a profile with no character → `profile`.
   - **No profile:** `none`.
   - **Budget:** one pair vs six pairs across two statics → the same SELECT count, at most five.
2. **Implement** R-S1-5.
3. **Gates:** the new file plus the full suite; `ruff`.

**Ad hoc mutation check:** drop the profile-ownership check on linked characters. The reclaim case fails.

### Task A3 — the record door (`xivrp-implementer`)

**Files.** Modify `collection_records.py` (door section); create `backend/tests/test_collection_records_door.py`.

**Interfaces produced:** `write_record`, `RecordWrite`, `RECORD_WRITE_PERSON`, `RECORD_WRITE_SYNC`, `load_records(db, targets, catalog_item_ids)`. `load_records` is one SELECT: `character_id IN (…)` OR (`profile_id IN (…)` AND `character_id IS NULL`). For a `main` target, it serves the profile-level row for an item the main has no row for (vet I-5). It also covers the defensive adoption on write (R-S1-6). `write_record` takes the optional `restore_state_changed_at=` (vet M-10). Nothing calls the door yet.

1. **Tests first** (R-S1-7):
   - **`person` mode:**
     - `have` over a plugin `have` → `have`;
     - `missing` over a plugin `have` → `missing`, with `state_changed_at` moved (Q1);
     - a count over a plugin count → set, with `token_count_updated_at` moved;
     - the same ownership twice → `state_changed_at` unchanged.
   - **`sync` mode:**
     - `missing` never written;
     - `have` over `missing` → raised;
     - a token-only create → `unknown`, `state_changed_at` NULL;
     - a count → set, `last_synced_at` set.
   - **Every write:** `updated_by_user_id`, `updated_via` and `updated_at` set.
   - **Targets:** a profile-level target writes the profile-level row; a main target with only a profile-level row adopts it; an alt target with only a profile-level row creates its own.
   - **`load_records`:**
     - one SELECT for mixed targets;
     - a `main` target with only a profile-level row gets that row; an alt target doesn't (vet I-5).
   - **`restore_state_changed_at`:** the stored `state_changed_at` equals the passed value, not `now` (vet M-10).
2. **Implement.**
3. **Gates:** new file plus the full suite; `ruff`.

**Ad hoc mutation check:** drop the main fallback from `load_records`. The main-with-profile-level-row case fails.

**Finish for PR 1:** R-S1-20's internal line. No UI and no live walk. Paste the dev-DB copy's rows after `upgrade head` (A1's gate): a profile with characters now keyed to its main. Paste the scratch-Postgres gate's output too. Body: "backend only, no visible change".

## PR 2 · S2a-1a·2 — the record per character (Hub, bridge, plugin snapshot, readers)

### Task B1 — Hub routes (B8), adoption, unlink (`xivrp-implementer`)

**Files.** Modify `routers/player_collection.py` (three routes, plus `request`), `schemas/player_collection.py`, `routers/player.py` (`link_character`, `_get_or_provision_plugin_character`, `unlink_character`) and `collection_records.py` (`adopt_profile_rows`, `release_last_character_rows`, `delete_character_records`; vet I-1). Create `tests/test_record_provenance.py` with its own `RECORD_COVERED` registry, the `covers_record` decorator and its twin registry self-test (vet I-2), and this task's `@covers_record("upsert_snapshot")` tests. Extend `tests/test_collections_center.py`.

1. **Tests first:**
   - **PUT** with no `character_id` → the main's row; with the alt's id → the alt's row, and the main's is unchanged; with another user's character → 404 and nothing written; with no character on file → the profile-level row.
   - **Both GETs** return the picked target's values.
   - **Attribution:** writer = the caller, channel `web` with a cookie and `api_key` with a key (`_mint` as PROV-1).
   - **Q1:** ✗ over a plugin Have → `missing`; the flipped `test_collections_center.py:388` says so.
   - **Criterion 13:** a profile-level row survives `link_character` and is adopted, and so on through the plugin-provision path; unlinking the last character turns its rows profile-level.
   - **Unlink on SQLite, no FK help (vet I-1):**
     - unlinking an alt deletes its rows (assert by query: SQLite enforces no FKs, so only the explicit delete passes);
     - unlinking the main of a profile with an alt deletes the main's rows and keeps the alt's;
     - unlinking the last character while a stray profile-level row exists for one of its items → 204, one profile-level row for that item (the character's), no `IntegrityError`.
   - **Main fallback (vet I-5):** a profile with a character and only a profile-level row (an un-backfilled dev DB): both GETs serve that row, and the PUT adopts it.
   - **(b) survives:** `GET /api/me/collection-catalog` returns the same ownership and counts before and after `_backfill_snapshot_characters`.
2. **Implement** R-S1-6, R-S1-11, plus `person` mode with `source="manual"`, `confidence="medium"` (as today).
3. **Gates:** `test_collections_center.py`, `test_record_provenance.py`, `test_authz_matrix.py`, `test_player_profile.py`, `test_player_smart_sync.py`, then the full suite; `ruff`.

**Mutation checks:**
- Skip adoption in the plugin-provision path. The second adoption case fails.
- Drop `delete_character_records` and rely on the FK. The alt-unlink case fails on SQLite (vet I-1).

### Task B2 — bridge, plugin snapshot write, readers via the chain (RISKIEST in PR 2 · `xivrp-implementer-deep`)

**Files.** Modify:
- `services/player_reward_bridge_service.py`: both write-throughs gain `group_id`, `actor_user_id`, `via`; `_apply_snapshot`/`_write_snapshot` go through the door;
- `routers/mount_farms.py`: PATCH and bulk pass them and take `request`;
- `services/plugin_collection_sync_service.py`: `_sync_snapshots`/`_upsert_snapshot` use the door with `resolve_main_targets` and `sync` mode, taking `actor_user_id` and `via` from `routers/plugin_collections.py`, which takes `request`;
- `services/collection_suggestion_service.py`: snapshot reads by the chain;
- `routers/collection_goals.py`: the seed's snapshot read by the chain, nothing else yet.

Extend `test_player_reward_bridge.py`, `test_plugin_collection_sync.py`, `test_smart_collection_suggestions.py`, `test_goal_from_suggestion.py` and `test_record_provenance.py`.

1. **Tests first:**
   - **Bridge, the member's own PATCH** with a card registration on the alt → the alt's record, writer = member, `player_hub`.
   - **Bridge, a lead's PATCH for the member** → `MountFarmProgress` and the intent as today, and **no record write** (R-S1-10).
   - **Bulk PUT** with the lead's own row and a member's row → only the lead's record.
   - **Q1:** `test_player_reward_bridge.py:306,356` flip.
   - **Plugin collections sync** with no profile → no record, as today; with characters → the main's record, `sync` mode, channel `api_key`.
   - **Suggestions and seed:** a member whose card resolves to the alt reads the alt's record, not the main's.
   - **Budget:** suggestions issue a fixed SELECT count for 2 vs 6 members.
2. **Implement.**
3. **Gates:** the five files, `test_authz_matrix.py` (the plugin rows with a bare key), then the full suite; `ruff`.

**Mutation checks:**
- Remove the `target_user_id == user.id` check. The lead case fails.
- Give suggestions `resolve_main_targets` instead of the chain. The alt case fails.

### Task B3 — guard machinery, the record model, release note (`xivrp-implementer`)

**Files.** Modify `tests/test_provenance_coverage.py` and `frontend/src/data/releaseNotes.ts`. `tests/test_write_provenance.py` is not edited (vet I-2).

1. **Tests first** (R-S1-15):
   - the self-test snippets for (c), (e), (f) and (g) with `PlayerCollectionSnapshot` in the model set and PR 2's narrow `TRACKED` (vet I-2);
   - every form vet M-8 lists: AnnAssign, tuple target, constant and dynamic `setattr`, `set_attribute`, a literal `via`, `actor_user_id=None`, `**`, a missing keyword, and each `update` form (aliased, `__table__.update()`, quoted, lowercase).

   Then run the guard on the tree: it passes only after B1 and B2. Before them, it names `upsert_snapshot`, `_upsert_snapshot` and `_apply_snapshot`.
2. **Implement** the guard, with (d) reading `COVERED | RECORD_COVERED` and `DYNAMIC_SETATTR_OK` holding today's four sites (vet M-8). `EXPECTED_DOOR_CALLERS` lists:
   - `player_collection.py:upsert_snapshot`;
   - the bridge's write-through functions;
   - `plugin_collection_sync_service.py:_upsert_snapshot`.

   Then the release-note items (R-S1-20): (b), Q1 and Q4 if accepted.
3. **Gates:**
   - `test_provenance_coverage.py`, `test_write_provenance.py` (its registry self-test passes unedited), `test_record_provenance.py`, then the full suite;
   - `pnpm -C frontend build`, then `pnpm -C frontend test src/data/releaseNotes.test.ts`;
   - `npm test` in `scripts/`.

**Mutation checks (execute, paste, revert):**
- Add `snapshot.ownership_state = "have"` to a throwaway function in `player_collection.py`. (e) fails (vet I-2: `token_count` isn't tracked until PR 4).
- Delete the `updated_via` stamp in `write_record`. (f) fails.
- Pass `via="web"` in the Hub route. (g) fails (vet M-8).
- Remove `@covers_record("_apply_snapshot")`. (d) fails.

**Finish for PR 2:** V1 Profile ▸ Collections before and after, shrunk shots per `pr-checklist`: the main's values, an alt pick through the API, and ✗ on a plugin mount (Q1).

## PR 3 · S2a-1a·3 — farm rows read through the record

### Task C1 — row door, merge, summaries (RISKIEST of S2a-1 · `xivrp-implementer-deep`, `model: fable`)

**Files.** Modify `collection_records.py` (`write_row`, `RowWrite`, `merge_participant`, `merged_participants`), `routers/collection_goals.py` (`list_participants`, `_participant_to_response`, `_participant_summary`, `list_collection_goals`, `update_collection_goal`) and `schemas/collection_goals.py` (`ParticipantRecordView`, the new optional fields). Create `tests/test_participant_merge.py`.

1. **Tests first:**
   - **Pure `merge_participant` table:** each of R-S1-9's state cases 1–4 and count cases, legacy rows (NULL writer) included.
   - **Edge cases:**
     - a lead's Pass vs a newer record Have → Have;
     - a lead's Have vs a newer record `missing` → Have;
     - the member's Have vs a newer `missing` → Want;
     - a token-only `unknown` record with NULL `state_changed_at` → the row;
     - a goal without a catalog item → the row.
   - **Route:**
     - a member in two statics whose cards resolve to the same character: a record `have` shows Have in both;
     - a static whose card resolves to the alt doesn't;
     - the goal list's summary counts match the panel.
   - **A seeded `player_hub` Pass** (NULL writer) vs a newer record Have → Pass, the declared V1 change (vet I-3).
   - **Response shape:** the new keys are present and the old keys unchanged; `source` ∈ `PARTICIPANT_SOURCES` for every merged row. The new fields are additive and outside R-PV-8 (vet M-11).
   - **Budget:** `list_participants` and `list_collection_goals` issue the same SELECT count for 1 vs 6 members (and 1 vs 3 goals).
2. **Implement** R-S1-9 and `write_row` (R-S1-7). The merge reads only; this task routes no writer.
3. **Gates:** the new file, `test_collection_goals.py`, `test_farm_drop_authz.py`, `test_goal_from_suggestion.py`, then the full suite; `ruff`. The review is task-scoped for this task (slice-loop §1.4).

**Mutation checks:**
- Drop "isn't a correction" from case 3. The lead's-Have case fails.
- Compare counts by `updated_at`. The stale-count case fails: a lead's state edit on a row holding an old count.
- Read summaries raw. The summary-agrees case fails.

### Task C2 — self route (h), lead route, Track seed (B5) (`xivrp-implementer`)

**Files.** Modify `routers/collection_goals.py` (`upsert_participant_state`, `upsert_participant_state_for_user`, `create_goal_from_suggestion`, plus `request` on each) and `tests/authz_matrix.py` (the self row, R-S1-16). Extend `tests/test_farm_drop_authz.py` (`:606-643` flip to (h)), `tests/test_goal_from_suggestion.py` (`:296` flips to B5), `tests/test_collection_goals.py` and `tests/test_record_provenance.py`.

1. **Tests first:**
   - **A member's count:**
     - goes to the record, and the response shows it, `count_from_record`;
     - no profile → the row;
     - a goal without a catalog item → the row;
     - `priority_rank` is still dropped for members.
   - **A member's state:**
     - `have` → record `have` plus the row;
     - `need` while the record is `have` → record `missing` (un-Have) and the other static's plugin Have row now merges to Want (Q3). This is what V1's "My status" buttons send (`ParticipantsPanel.tsx:77-92`), so the PR body lists it under (a), per Q6 (vet I-3);
     - `pass` → the record is untouched.
   - **A lead for another member** → the row only, writer = lead (correction); the member's record is unchanged. A lead's route aimed at themselves writes their record.
   - **Seed:** a no-signal member gets no row; seeded rows have writer NULL and channel `web`; a member whose alt card holds the record seeds from the alt.
   - **AUTHZ:** the matrix with the new self row passes.
2. **Implement** R-S1-10's route rules and R-S1-12.
3. **Gates:** the touched test files, `test_authz_matrix.py`, then the full suite; `ruff`.

**Mutation check:** let the lead's route write the record for another member. The correction case fails.

### Task C3 — remaining row writes routed; release note (`xivrp-implementer`)

**Files.** Modify `services/plugin_collection_sync_service.py` (`_upsert_state`, `_update_token_count` through `write_row` with `actor_user_id` and `via`, rules unchanged) and `routers/collection_goals.py` (`log_drop`'s flip and `delete_drop`'s restore through `write_row`, rules unchanged; the restore check is still the old one until D2). Also `frontend/src/data/releaseNotes.ts` and `tests/test_record_provenance.py`.

1. **Tests first:**
   - The plugin sync's rows record writer = member and channel `api_key`.
   - The drop flip records writer = logger, and `state_changed_at` moves.
   - The restore records writer = deleter.
   - `test_plugin_collection_sync.py` and `test_farm_drop_authz.py` pass **unedited** except PR 3's listed flips.
2. **Implement**, then the release items (a), (g), (h).
3. **Gates:**
   - the full suite;
   - `pnpm -C frontend build`, the releaseNotes test and `scripts` `npm test`.

**Finish for PR 3:** V1 `GoalsPage` before and after, shrunk shots:
- (a): a Profile ▸ Collections Have shows in two statics' panels and their goal cards; a "My status" Need over a Have turns the other static's Have to Want (vet I-3, Q6);
- (g): a fresh Track leaves a member blank;
- (h): a member's count set with `curl` shows in `ParticipantsPanel`.

## PR 4 · S2a-1a·4 — drops

### Task D1 — the drop's character and the own-drop record write (`xivrp-implementer`)

**Files.** Modify `routers/collection_goals.py` (`log_drop`). Extend `tests/test_write_provenance.py` (new `@covers("log_drop")` cases in PROV-1's own registry, whose handler `log_drop` already is; `DROP_KEYS` untouched) and `tests/test_record_provenance.py` (`@covers_record("log_drop")` for the record write; vet I-2).

1. **Tests first** (R-S1-13):
   - The member's own drop → `recipient_character_*` = the chain's character and source `default`. The record goes to `have`, and the drop stores:
     - `recipient_record_prior_state` = the prior (`missing`, or `unknown` when absent);
     - `recipient_record_prior_at` = the record's new `state_changed_at`;
     - `recipient_record_prior_changed_at` = its `state_changed_at` before the raise (vet M-10).
   - The record already `have` → no prior.
   - A lead's own drop → its record is written.
   - A lead's drop for a member → the character is recorded, the record untouched, and the row's writer is the lead.
   - No recipient → NULLs.
   - No profile → character NULL, no record write.
   - The response key set still equals `DROP_KEYS`.
2. **Implement.**
3. **Gates:** `test_write_provenance.py`, `test_farm_drop_authz.py`, `test_record_provenance.py`, then the full suite.

### Task D2 — Undo (RISKIEST in PR 4 · `xivrp-implementer-deep`)

**Files.** Modify `routers/collection_goals.py` (`delete_drop`). Extend `tests/test_farm_drop_authz.py`: `:429` flips to "restores after a token sync", and `_STATE_WRITE_COLUMNS` (`:487`) becomes a state write through the route.

1. **Tests first** (R-S1-14):
   - Restore after a plugin token sync.
   - Skip after a later state write: by the member, by the plugin raising Have, by a lead.
   - Hand-off order A-then-B and B-then-A for the record prior, as the row's tests do.
   - Record revert:
     - only when the deleter is the recipient;
     - not after a later ownership change: the plugin re-raised it, or the Hub edited it;
     - a lead's delete of a member's own drop restores the row and leaves the record;
     - a revert to `unknown` when the drop created the record;
     - the revert restores the record's `state_changed_at` to `recipient_record_prior_changed_at` (vet M-10).
   - The other static's merged state follows the revert.
   - **A pre-drop Have stands (vet M-10).** Static B's row is a non-lead Have, written before the drop and after the record's prior `state_changed_at`. After the member logs "I got it" in static A and Undoes it, B still shows Have, not Want.
2. **Implement.**
3. **Gates:** `test_farm_drop_authz.py`, `test_collection_goals.py`, then the full suite. The review is task-scoped for this task.

**Mutation checks:**
- Keep `last_synced_at` in the restore check. The sync case fails.
- Revert on a lead's delete. That case fails.
- Skip the record hand-off. B-then-A fails.
- Stamp the revert with `now` instead of the prior `state_changed_at`. The pre-drop-Have case fails (vet M-10).

### Task D3 — guard for rows and drops; release note (`xivrp-implementer`)

**Files.** Modify `tests/test_provenance_coverage.py` (R-S1-15's PR 4 part) and `frontend/src/data/releaseNotes.ts` (Q2's line if accepted; the internal drop-character item).

1. **Tests first:**
   - the guard with `RewardParticipantState`, `DROP_KEYWORDS` (including `recipient_record_prior_changed_at`, vet M-10), and `TRACKED` widened by `{state, token_count, priority_rank}` (vet I-2), failing on the tree until C1–D2 have landed;
   - self-tests: a tuple-target `state` write, a `setattr` with a constant `"state"`, and **`snapshot.token_count = 1` outside the door, refused now that `token_count` is tracked** (vet I-2).
2. **Implement.** `EXPECTED_DOOR_CALLERS` adds the two participant routes, the seed (in `DERIVED_CALLERS`), `log_drop`, `delete_drop`, `_upsert_state` and `_update_token_count`; their `@covers_record` tests already exist (C2, C3, D1, D2).
3. **Gates:** the guard, the full suite, `pnpm -C frontend build`, the releaseNotes test, `scripts` `npm test`.

**Mutation checks:**
- Write `participant.state = "have"` in `log_drop`, outside the door. (e) fails.
- Drop `recipient_character_name=` from `log_drop`. (b) fails.
- Pass `actor_user_id=None` in `upsert_participant_state`. (g) fails.

**Finish for PR 4:** in V1, log your own drop, run a plugin token sync with `curl`, Undo, and show the status restored in both statics; shots. Then merge PRs 1–4 together (R-S1-1).

## PR 5 · S2a-1b·1 — the syncs

### Task E1 — the match rule (`xivrp-implementer`)

**Files.** Modify `collection_records.py` (`match_sync_character`); create `tests/test_sync_character_match.py`.

1. **Tests first** (criterion 6's cases):
   - one match;
   - none;
   - two characters with the same name and no world (ambiguous);
   - the same two disambiguated by world;
   - `"Unknown"` and `"unknown"`;
   - null;
   - whitespace and case differences.
2. **Implement** R-S1-17's match. **Gates:** the file, then the full suite.

### Task E2 — collections sync through one service (RISKIEST in PR 5 · `xivrp-implementer-deep`)

**Files.** Modify `services/plugin_collection_sync_service.py`: `sync_collection_states` gains `actor_user_id` and `via`, and its row and record writes go through one `apply_sync` service in `collection_records.py` with R-S1-17's rule. Rewrite the module docstring's rules (`:17-20`). Extend `tests/test_plugin_collection_sync.py` and `tests/test_record_provenance.py`.

1. **Tests first:**
   - A matched name updates the character's record, and rows only in statics whose chain is that character. A third static, where the card is the alt, is unchanged.
   - Each of `null`, `"Unknown"`, unmatched and ambiguous writes rows in every non-viewer static plus the main's record (B6).
   - A Pass row is never changed, `player_hub` Passes included: V1 shows Pass where it showed Have, and the PR body lists it under (a) (vet I-3).
   - The sync re-raises a member's un-Have.
   - A count is the newest write over a lead's older count.
   - A lead's correction in one static isn't touched in another by a matched sync.
   - **The counters count farm rows only (vet M-6):** a matched sync that writes the record and one static's row reports `statesUpdated == 1`; a record-only change reports 0.
   - The authz plugin row works with a bare key (`characterName: "Member Card"` → unresolved).
2. **Implement.** **Gates:** the files, `test_authz_matrix.py`, then the full suite. The review is task-scoped for this task.

**Mutation check:** write rows in every static even when matched. The third-static case fails.

### Task E3 — the mount-farm sync writes the record; release note (`xivrp-implementer`)

**Files.** Modify `routers/mount_farms.py` (`plugin_sync_mount_farms`: `request`, plus the record write through `apply_sync` with the trial → catalog map) and `frontend/src/data/releaseNotes.ts`. Extend `tests/test_mount_farms.py` and `tests/test_record_provenance.py`.

1. **Tests first:**
   - An owned mount raises the matched character's record; a totem count is set; the main's record when unresolved.
   - `MountFarmProgress` rows equal today's for the same payload (snapshot the rows before and after).
   - The server clock, not `synced_at`, stamps the record.
   - The response key set is unchanged.
2. **Implement** R-S1-18's sync part and PR 5's release item.
3. **Gates:** the full suite, `pnpm -C frontend build`, the releaseNotes test, `scripts` `npm test`.

**Finish for PR 5:** `curl` both syncs with a matching `characterName`, and show V1 `GoalsPage` in two statics (one with the card on that character, one with an alt); shots.

## PR 6 · S2a-1b·2 — counts and history

### Task F1 — MFP attribution and the flag column (RISKIEST in PR 6 · `xivrp-implementer-deep`)

**Files.** Create `backend/alembic/versions/o8p9q0r1s2t3_add_collection_count_privacy_and_mfp_records.py` (`down_revision` = PR 1's) and `tests/test_mfp_record_backfill.py`. Modify `models/player_profile.py`.

1. **Tests first**, through `run_sync` as A1:
   - An MFP `has_mount` row raises the chain target's record. A card on the alt attributes to the alt, not the main: the frozen chain, not only the main rule (vet M-9).
   - Two statics whose cards are the same character with different counts → the most recent count.
   - The OR of `has_mount`.
   - An existing record `have` is kept.
   - No profile → skipped.
   - Writer and channel NULL.
   - **Timestamps from the MFP row (vet M-9):** `state_changed_at` and `token_count_updated_at` equal the latest of its `last_plugin_sync_at`, `last_manual_override_at`, `last_imported_at` and `updated_at`, never the migration's clock.
   - Idempotent: a second run changes nothing (vet I-5).
   - The flag defaults false.
2. **Implement** R-S1-18's history part and R-S1-19's column. The downgrade drops the column and leaves the backfilled records (documented).
3. **Gates:**
   - as A1, plus the dialect script on `sa.false()`;
   - **A1's scratch-Postgres gate on the restored prod dump (vet I-4).** Paste the count of MFP rows attributed (to a card character, to a main, to a profile-level row, skipped) and the dev-DB copy run.
   - **V1 change (vet I-3):** paste the members whose V1 panel turns Have because their legacy tracker says has-mount. The PR body lists them under (a).

**Mutation check:** replace the frozen chain with the main rule. The alt-card case fails (vet M-9).

### Task F2 — the privacy flag and the gate helper (`xivrp-implementer`)

**Files.** Modify `schemas/player.py`, `routers/player.py` (`update_profile`, `_profile_to_response`) and `collection_records.py` (`count_visibility`). Create `tests/test_count_visibility.py`.

1. **Tests first:**
   - `PUT /api/player/profile` with `hideCollectionCounts` sets only the caller's flag.
   - `count_visibility`: viewer, member, lead, owner, admin and self cases, each with the flag on and off.
2. **Implement.** **Gates:** the files, `test_authz_matrix.py`, then the full suite.

### Task F3 — gated reads and exceptions; release note (`xivrp-implementer`)

**Files.** Modify `routers/collection_goals.py` (the participant responses), `routers/mount_farms.py` (GET, `_build_member_progress`, recommendations), `schemas/mount_farms.py` (`totem_count: int | None`), `services/collection_suggestion_service.py` (counts, `can_buy`, scoring, docstring) and `frontend/src/data/releaseNotes.ts`. Extend `tests/test_count_visibility.py`.

1. **Tests first,** one pytest per gated read (criterion 12):
   - `list_participants`, a PATCH response, GET mount-farms (per member and `members_can_buy`), suggestions (`token_count`, `can_buy`, score with a hidden count = unknown) and recommendations;
   - each with a viewer and with a member whose flag is set: the count is missing, a viewer gets no `priority_rank` (V1's "#n" and next-up line, declared in (i), vet I-3), and the caller's own count shows;
   - **viewers keep the per-farm aggregates** (`members_can_buy`, `members_close_to_target`), with hidden members counted as unknown (Q7).
   - **Exceptions:** the activity log has no count field; `/api/me/collection-catalog` and `/api/player/collection-suggestions` return only the caller's; the dossier match carries no count.
2. **Implement** R-S1-19's reads, then PR 6's release items.
3. **Gates:** the full suite, `pnpm -C frontend build`, the releaseNotes test, `scripts` `npm test`.

**Mutation check:** gate viewers only. Each flag case fails.

**Finish for PR 6:** V1 Home's totem activity and `GoalsPage`'s panel for a viewer and for a member, before and after, with a flagged member set by `curl` ((i), (j)); shots. Then merge PRs 5–6 together.

## Finish (each PR)

- Run `git fetch`, then R-S1-21's check, the size check, `pr-checklist`, and the slice-loop §5 gates (backend `pytest`, `pnpm build`, `pnpm lint`, `pnpm check:design-system:strict`, `pnpm test`). Then `gh pr create --draft --base <parent branch>`, then the release note's `pr`/`prTitle`.
- **The live check:** the worktree's dev servers (CLAUDE.md § Commands) on a **copy** of the dev DB, after `alembic upgrade head` (R-S1-3). Then dev-auth and the per-PR walk above.
- **The PR body:**
  - the plugin contract unchanged (no request or response field removed);
  - every flipped old test with the delta it implements;
  - **every V1 change the PR ships, with its render path** (vet I-3). PR 3: the un-Have from Need/Want. PR 5: the seeded `player_hub` Pass. PR 6: viewers' queue order and F1's legacy has-mount. Plus the spec's deltas;
  - the owner's answers to Q1–Q7. A PR that implements an answer the owner hasn't given yet stays draft.

## As built (S2a-1a, 2026-10-07)

S2a-1a is done: PRs 1–4 landed as eight PRs, #348 (·1), #349 (·1b), #351 (·2), #352 (·2b), #353 (·2c), #357 (·3), #358 (·3b), #359 (·4), released as 2.1.67 and merged bottom-first (R-S1-1). S2a-1b (PR 5 syncs, PR 6 counts and history) is not built.
- **Estimates ran 1.7–2× and the cap split three PRs.** PR 1 came in at ~2,430 changed lines (est. ~1,410): it split into #348 (A1) and #349 (A2 + A3). PR 2 came in at ~2,880 (est. ~1,450): #351 (B1), #352 (B2), #353 (B3). PR 3 came in at ~2,260 (est. ~1,280): #357 (C1), #358 (C2 + C3). PR 4 came in at ~1,290 (est. ~1,060) and didn't split. PR 5 (~1,240) and PR 6 (~1,370) are estimated at that same ratio, so check each at Finish.
- **`merged_participants` takes `catalog_item_by_goal`.** As built: `merged_participants(db, *, static_group_id, rows, catalog_item_by_goal: Mapping[str, str | None])`. The caller supplies each goal's `catalog_item_id`; the function resolves the chain once and issues one record SELECT, and none when no row's goal has an item. `MergedParticipant` also carries `record` (the record applied, or `None`), which feeds the response's `record` view.
- **`_write_own_state` is the door caller for both PATCH routes.** `upsert_participant_state` and `upsert_participant_state_for_user` (a lead aimed at themselves) share it. `EXPECTED_DOOR_CALLERS` and `DOOR_CALLER_ROUTES` (`tests/test_provenance_coverage.py`) list `_write_own_state` once, with both routes. They also list the `write_row` callers `upsert_participant_state_for_user`, `create_goal_from_suggestion`, `_upsert_state` and `_update_token_count`, because `write_row` is in `DOOR_ENTRY_POINTS`.
- **A token-only plugin sync restamps the row's writer as the member** (R-S1-7: one writer column per row). A lead's correction then reads "own" and the merge can flip. A known consequence, not a bug; S2a-2's labels must know it.
- **Undo re-resolves the chain** rather than preferring the drop's stored `recipient_character_id` (R-S1-14). A card or main change between drop and Undo gives `skipped`, never the wrong record. S2a-1b or S2a-3a may prefer the stored id.
- **Plugin-sync row stamps are route-tested.** The ledger parked this as untested, but it already is. The AST guard enforces the writer and channel keywords. `test_record_provenance.py::test_plugin_sync_rows_record_the_member_and_the_api_key_channel` reads the writer and channel of a created, a raised and a recounted `RewardParticipantState` row after a plugin sync. The record writes carry `@covers_record("plugin_sync_collections")`. Nothing carries to PR 5.
- **Other disclosed residuals.**
  - A lead-logged drop for the member inherits the member's own-drop record prior, and a lead's delete never reverts the record.
  - A write that keeps the value moves neither clock, so Undo still reverts over it.
  - Undo's restore survives a value-keeping manual edit, and an own Undo flips Profile ▸ Collections.
  - (k) holds fully only for flips after the migration (the backfill).
  - A manual un-Have over a plugin Have writes the record's source `manual`, so Profile ▸ Collections' count input unlocks until the next sync (PR 2 review I-1; its release line says so).

## Write-backs (once per stack, after its PRs merge)

**Applied for S2a-1a (2026-10-07):** spec §6's S2a-1 row and status paragraph; §7's (a), (b), (i), (j) amendments, delta (k), and the rulings R-S1-8, -9, -10, -14, -19; `HOME_STRETCH.md` W3 S2a and the dated log; `PRODUCT_MODEL.md` §6's Stage 2 row. `backend/ARCHITECTURE.md:96` already says "per character" and isn't hedged, so it is unchanged. **S2a-1b's write-back** repeats this section for PRs 5–6 (the (i)/(j) shipped state, the sync-test addition, R-S1-19 as built).

- **Spec §6's S2a-1 row:** the six-PR cut, with MountFarmProgress attribution in S2a-1b·2.
- **Spec §7, as answered:**
  - (a)'s amended write list (R-S1-20, vet I-3);
  - (b)'s Q1 and Q4 lines;
  - delta (k);
  - (i)'s "or queue order" and its extra render paths;
  - (j)'s render paths, and its viewer paths if Q7 is declined.
- **`HOME_STRETCH.md`:** W3 S2a → "~12 PRs", and the S2a-1 status.
- **`PRODUCT_MODEL.md` §6:** the matching row. `backend/ARCHITECTURE.md:96` ("per character") becomes true.
- **Rulings that bind S2a-2…S2a-4:**
  - R-S1-8: own, correction and derived;
  - R-S1-9: the merge, the response fields, rows only;
  - R-S1-10: who writes the record;
  - R-S1-14: Undo;
  - R-S1-19: what viewers get.

## Carried, not S2a-1

- **S2a-2:**
  - whether the matrix shows record values for a claimed member with no row (needs an additive API field);
  - Undo can't clear a count, or restore a record to "absent" (`None` means unchanged; V1 sends `null`);
  - the bulk "Mark everyone without a status as Need" (per-member PATCHes, or a new route with its AUTHZ row).
- **HUB:**
  - the character picker and the privacy toggle, on R-S1-11's and R-S1-19's APIs;
  - `/api/player/collection-suggestions` (`player.py:538-660`) reads the caller's raw rows;
  - a lead's mount-farm edit still raises the member's Hub intent (`_apply_intent`).
- **The display slice:** the drop's character and B10's "Plugin" label.
- **The plugin pass:** sending `characterWorld`, which turns name-only matching into exact keying.
- **Accepted edges:**
  - legacy rows (NULL writer) aren't protected as corrections, and neither are a deleted lead's corrections once `SET NULL` clears their writer (Postgres);
  - historical lead-for-member bridge writes already on the record;
  - "I got it" for one item in two statics.
