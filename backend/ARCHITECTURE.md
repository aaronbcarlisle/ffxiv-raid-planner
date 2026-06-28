# Backend Architecture Notes

## Person ↔ Static Module Boundary

**Phase:** F4 of the redesign foundation.
**Authority:** [`docs/PRODUCT_MODEL.md §3.1`](../docs/PRODUCT_MODEL.md) (two layers + ownership rule) · [`design/redesign/specs/2026-06-28-f4-frontend-structure-design.md §7`](../design/redesign/specs/2026-06-28-f4-frontend-structure-design.md) (this note's spec) · [`design/redesign/FRONTEND_STRUCTURE.md §5`](../design/redesign/FRONTEND_STRUCTURE.md) (the frontend mirror of this boundary).

---

### The Deciding Test

> **"If leaving a static erases it → Static-layer. If it survives → Person-layer."**
> — `PRODUCT_MODEL.md §3.1`

Example: a player sets their personal availability once; every static they are in reads it into its scheduling heatmap — Person-layer. A tier snapshot belongs to the static's workspace and is gone when the player leaves — Static-layer.

---

### Router Classification

All routers verified against `backend/app/routers/` (27 modules, excluding `__init__.py`).

#### Person-layer (survives leaving a static)

| Router | Why Person |
|---|---|
| `auth` | Discord OAuth identity, session management, user account state — the canonical person record. |
| `player` | Solo player profile, character linking (Lodestone), gear sync, job profiles — all owned by the user independent of any static. |
| `player_bis_targets` | BiS target sets owned by `PlayerJobProfile` entries in the Player Hub — user-owned data, not scoped to a static. |
| `player_collection` | Personal collection intent (`/api/me/collection-intent`), ownership snapshots (`/api/me/collection-snapshots`), public dossier, and recruitment matching. The static-group endpoints (`/collection-suggestions`, `/collection-match`) are read-aggregations of Person data into a static view — they do not create new Static-layer state. Person-primary. |
| `notifications` | In-app notifications keyed to `user_id`; `group_id` is an optional routing field, not an ownership field. Survive leaving a static. |
| `api_keys` | Dalamud plugin / REST API keys owned by the user, not by any static. |

#### Static-layer (erased when leaving the static)

| Router | Why Static |
|---|---|
| `static_groups` | CRUD for the static group itself — its settings, name, discovery listing. |
| `tiers` | Tier snapshots scoped to a specific static. |
| `loot_tracking` | Loot log, material log, page ledger, weekly assignments — all scoped to a static tier. |
| `invitations` | Invitations to join a specific static; scoped to that static. |
| `join_requests` | Join requests for a specific static. |
| `schedule` | Scheduled sessions and RSVPs for a specific static. |
| `mount_farms` | Mount farm progress records per static group. |
| `collection_goals` | Collection goals (mount / rare drop campaigns) for a specific static. |
| `content_suggestions` | Content suggestions and member votes for a specific static; can promote suggestions to `StaticObjectiveGoal`. |
| `objective_goals` | Objective goals (`StaticObjectiveGoal`) for a specific static — raid-prog / long-game objectives. |
| `split_clear` | Split clear planner assignments for a specific static. |
| `static_characters` | `StaticCharacterRegistration` — links a roster slot to a player's character for this static. The registration is per-static and erased on leave; the underlying `PlayerCharacter` is Person-layer (see dual-owned note below). |

#### Dual-owned (boundary runs through the router)

| Router | Why Dual-owned |
|---|---|
| `bis_targets` | Shared CRUD for `BiSTargetSet` using an `owner_type` / `owner_id` pattern. When `owner_type='player_job_profile'` the data is Person-layer (Player Hub BiS planning). When `owner_type='roster_member_job'` the data is Static-layer (roster-slot BiS for a specific tier). The router intentionally serves both contexts from one table — see `models/bis_target_set.py` for the `VALID_OWNER_TYPES` set. |

#### Cross-cutting integration seams (belong to neither layer; feed both)

| Router | Why Cross-cutting |
|---|---|
| `lodestone` | Lodestone / Tomestone equipped-gear verification that feeds the gear board (`PRODUCT_MODEL.md §3.5`). Not Person-owned (the user does not configure it per static) and not Static-owned (the character data is live external data). Mirror of `lodestoneStore` integration-seam tag in `FRONTEND_STRUCTURE.md §4.1.1`. |
| `bis` | Generic BiS import / fetch utility (xivgear, etro) — reads external sources and returns parsed gear sets. Holds no state of its own; serves both Player Hub and roster contexts depending on the caller. |
| `discovery` | Bridges the Person layer (player profile, objectives, availability) with the Static layer (open statics, recruitment listings) for recruitment matching. Neither layer owns the match result. |
| `plugin_collections` | Dalamud plugin → server sync that writes `PlayerCollectionIntent` / `PlayerCollectionSnapshot` (Person-layer models) via plugin credentials. An integration seam: the transport is the plugin; the destination is Person data. |

#### Platform (neither layer — platform/ops)

| Router | Why Platform |
|---|---|
| `analytics` | Admin / ops analytics covering the full application; serves the platform operator, not a user or static. |
| `collection_catalog` | Global, admin-seeded catalog of collectible items (mounts, minions, etc.); read-only reference data. Neither Person nor Static. |
| `discord_interactions` | Receives signed Discord slash-command payloads (e.g. `/xrp link` for PKCE plugin auth). Platform-level integration transport. |
| `dev_auth` | Development / testing authentication shortcut. Platform-only; disabled in production. |

---

### Model Classification

All models verified against `backend/app/models/` (36 model files, excluding `__init__.py`). Applying the same deciding test: "if leaving a static erases it → Static-layer; if it survives → Person-layer."

#### Person-layer models

| Model | File | What it holds |
|---|---|---|
| `User` | `user.py` | Discord identity, session data; the canonical person record. |
| `PlayerProfile` | `player_profile.py` | User-owned profile (visibility, share code, job list); independent of any static. |
| `PlayerCharacter` | `player_character.py` | Linked FFXIV character (Lodestone data, gear snapshots anchor); owned by `PlayerProfile`. |
| `PlayerJobProfile` | `player_job_profile.py` | Per-job tracking (priority level, gear readiness) in the Player Hub; survives leaving. |
| `PersonalAvailabilityTemplate` | `personal_availability.py` | User's typical weekly availability, independent of any static — the **Person default** in the dual-owned availability pair (see below). |
| `Notification` | `notification.py` | In-app notifications keyed to `user_id`; `group_id` is optional routing metadata, not an ownership FK. Survive leaving a static. |
| `ApiKey` | `api_key.py` | Dalamud plugin / REST API keys; owned by user. |
| `PluginAuthCode` | `plugin_auth_code.py` | Transient PKCE auth code for the browser sign-in flow; per-user. |
| `PlayerGearSnapshot` | `player_gear_snapshot.py` | Character-owned gear data per job (one row per character + job); owned by `PlayerCharacter`. |
| `PlayerGoal` | `player_goal.py` | Flexible personal goal / collection tracking linked to `PlayerProfile`; survives leaving any static. |
| `PlayerCollectionIntent` | `player_collection_intent.py` | Personal collection want-list; not static-scoped. |
| `PlayerCollectionSnapshot` | `player_collection_snapshot.py` | Factual collection ownership snapshot per character; not static-scoped. |

#### Static-layer models

| Model | File | What it holds |
|---|---|---|
| `StaticGroup` | `static_group.py` | The static group itself (name, settings, share code, discovery listing). |
| `Membership` | `membership.py` | A user's membership record in a specific static (role, join date); erased on leave. |
| `TierSnapshot` | `tier_snapshot.py` | Tier tracking for a static (content, dates, active flag). |
| `SnapshotPlayer` | `snapshot_player.py` | A roster slot in a tier (job, gear state, BiS link, loot adjustments); erased on leave. |
| `LootLogEntry` | `loot_log_entry.py` | Individual loot drop records for a static tier. |
| `MaterialLogEntry` | `material_log_entry.py` | Material drop records for a static tier. |
| `PageLedgerEntry` | `page_ledger_entry.py` | Book / page economy ledger for a static tier. |
| `WeeklyAssignment` | `weekly_assignment.py` | Weekly loot assignments for a static tier. |
| `Invitation` | `invitation.py` | Invitation to join a specific static; scoped to that static. |
| `JoinRequest` | `join_request.py` | Join request for a specific static. |
| `UserAvailability` | `availability.py` | Per-static-membership dated availability slots (keyed on `static_group_id + user_id + date`); erased on leave — the **Static-specific record** in the dual-owned availability pair (see below). |
| `ScheduleSession` (+ `Rsvp`, etc.) | `schedule.py` | Scheduled raid sessions and RSVPs for a specific static. |
| `MountFarmProgress` | `mount_farm_progress.py` | Mount farm progress per static group; erased on leave. |
| `CollectionGoal` | `collection_goal.py` | A "we're farming this together" goal for a specific static. |
| `RewardDropLog` | `reward_drop_log.py` | Reward drop records for a static collection goal. |
| `RewardParticipantState` | `reward_participant_state.py` | Per-member progress state for a static collection goal. |
| `SplitClearAssignment` | `split_clear.py` | Split clear run assignments for a specific static. |
| `StaticCharacterRegistration` | `static_character_registration.py` | Per-static binding of a roster slot to a player's character; erased on leave. The character itself (`PlayerCharacter`) is Person-layer. |
| `StaticContentSuggestion` (+ vote) | `static_content_suggestion.py` | Content suggestions and member votes for a specific static. |
| `StaticObjectiveGoal` | `static_objective_goal.py` | Objective goals (raid progression, farm milestones) for a specific static. |

#### Platform models (neither layer)

| Model | File | What it holds |
|---|---|---|
| `AnalyticsEvent` / `AnalyticsError` / `DailyActiveUsers` | `analytics.py` | Platform-level usage and error tracking; serves the operator, not users or statics. |
| `ActivityLog` | `activity_log.py` | Audit / activity log across the platform. |
| `CollectionCatalogItem` | `collection_catalog_item.py` | Global, admin-seeded catalog of collectible items (mounts, minions, etc.); read-only reference data shared across all users. |

#### Dual-owned models

| Model | File | Why Dual-owned |
|---|---|---|
| `BiSTargetSet` | `bis_target_set.py` | `owner_type`/`owner_id` indirection — Person-layer when `owner_type='player_job_profile'`, Static-layer when `owner_type='roster_member_job'` or `'static_tier_job'`. See [Dual-owned Cases → BiSTargetSet](#bisTargetSet--player-hub-vs-roster-slot) below. |

---

### Dual-owned Cases

Two domains cannot be cleanly assigned to one layer. Both are deliberate design decisions.

#### Availability — Person default + Static override

The "availability" concept maps to **two separate models** at two different scopes:

| Model | Layer | Scope |
|---|---|---|
| `PersonalAvailabilityTemplate` (`personal_availability.py`) | **Person** | User's typical weekly schedule (day-of-week + time slots), independent of any static. |
| `UserAvailability` (`availability.py`) | **Static** | Dated availability entries for a specific static group (keyed on `static_group_id + user_id + date`); erased on leave. |

The product rule (`PRODUCT_MODEL.md §3.1`): *"you set your availability once in the Person layer; every static you're in reads it into its scheduling heatmap."* The `PersonalAvailabilityTemplate` is the source; `UserAvailability` records specific dated overrides within one static's context. The `schedule` router reads both; the `player` router owns the personal template.

#### BiSTargetSet — Player Hub vs roster slot

`BiSTargetSet` (`bis_target_set.py`) uses an `owner_type` / `owner_id` indirection:

| `owner_type` | Layer | Owned by |
|---|---|---|
| `player_job_profile` | **Person** | A `PlayerJobProfile` in the user's Player Hub; survives leaving any static. |
| `roster_member_job` | **Static** | A `SnapshotPlayer` in a tier roster; erased on leave. |
| `static_tier_job` | **Static** | A static-level tier job target. |

The `bis_targets` router handles both ownership contexts from a single table. The `player_bis_targets` router is the Person-only surface; the `bis_targets` router is the shared (dual-ownership) surface.

#### Static character registration — character (Person) vs registration (Static)

`PlayerCharacter` (`player_character.py`) is Person-layer: it stores the player's Lodestone identity and gear snapshots, and it survives any static membership change.

`StaticCharacterRegistration` (`static_character_registration.py`) is Static-layer: it is the per-static binding that says "this roster slot brings character X to this static." The registration is erased on leave; the character itself is not.

The `static_characters` router manages the Static-layer registrations. Character identity management lives in the `player` router (Person-layer).

---

### No Automated Enforcement — By Decision

> **No automated enforcement here, by decision — the backend is not CI-gated, so a boundary lint would be theater. The boundary is mirrored from the frontend ([`design/redesign/FRONTEND_STRUCTURE.md §5`](../design/redesign/FRONTEND_STRUCTURE.md)) and the F4 spec ([`design/redesign/specs/2026-06-28-f4-frontend-structure-design.md §7`](../design/redesign/specs/2026-06-28-f4-frontend-structure-design.md)); revisit if the backend gains CI.**

The classification above is a contributor-facing map, not an enforced constraint. Its purpose is to make the model legible when adding new routers or models: apply the deciding test first, then place the new code in the matching domain.

If the backend gains a CI lint pass in the future, this document is the authoritative classification to encode into the lint rule.
