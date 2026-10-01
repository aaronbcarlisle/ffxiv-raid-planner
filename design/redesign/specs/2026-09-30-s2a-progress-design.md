# Stage 2a · Progress, the Tracks matrix (V2) — design

**Status:** co-designed with the owner 2026-09-30 (home-stretch session 4); every decision below was accepted in conversation. Director spec-vet 1 (C1–C4, I5–I10, M11–M12) and the owner's answers B1–B8 and B11 (2026-10-01, all as recommended) are folded in; inline tags such as `(vet C1, B6)` mark where. The director's fold-check (NEW-C and asks #2–#14) is folded as `(fold-2 …)`, and its re-check's four one-sentence folds as `(fold-3)`. Where a fold answers an owner question, the director's recommended design is written in and tagged `(owner Q, accepted)`. **The owner reviewed this spec on 2026-10-01 and accepted every such design as recommended**, including the call-out that a plugin sync re-raises a person's un-Have (S2-10). No code until this spec, its owner-signed parity matrix and the slice plans exist (`HOME_STRETCH.md` §4 S2, spec-ready boundary).
**Roadmap home:** `HOME_STRETCH.md` §6.3 W3 **S2a** (gate: HS-2, D-18), §6.1 item 4.
**Canvas:** DA 10 `progress` on the V2 audit canvas (`claude.ai/artifact/FSew85ViFxg3ERcBAbkAQP`): pages "Progress · 1B Tracks matrix" and "1B farm row expanded (lead edit)". §3 lists where this spec departs from them.
**Inputs:** `docs/PRODUCT_MODEL.md` §3.1 (two layers; collection ownership is character data, not copied per static) and §3.3 (the Progress Engine: one target + per-member status, the savage tier as the flagship); HS-2, HS-29, HS-36; **HS-35** #1 (Tracks matrix with Farms-B), #2 (9A), #3 (Objectives' home), #6 (one BiS definition), #12 (keys), #16 (density rule 11), #23 (Hub tabs), #27 (Need · Want · Have · Pass), #30 (controller-owned extraction and slice cut); PROV-1 (W0: `logged_via`); the audit's DA 10 and DA 11 (`SYNTHESIS.md` §8) and A5 §4.2's six Farms-B conditions; F-10, F-11; D-18, D-67, D-68, D-70; CLAUDE.md § UI rules.
**Supersedes:** S2-1 and S2-2 (Stage 2 session 3: "Farms · Split Clears · Objectives, opens on Farms"), overturned by HS-35 #1. New Stage 2 rulings continue the numbering at S2-3.

## 1. Problem

Progress is the fifth spine tab (HS-2), and nothing in V2 answers its question, "how far along are we?". Today V2 reaches a "Tracking" page only through ⌘K, a number key or the phone bar (`Spine.tsx:17-22` has four tabs). That page is V1's `GoalsPage` unchanged: Objectives by default (empty for DEVTST), then Farms, then Suggested · Active · Catalog, three navigation levels deep. It identifies people by Discord handle, shows the goal creator's token count to everyone (A5-04), has four ways to create a farm and three status vocabularies, and leaves out the static's flagship track, the savage tier. Home's TrackCard reads a different data model (`mountFarmStore`'s alphabetically first trial) and links nowhere (A5-19). Split planning is unreachable in V2 (D-18).

## 2. Rulings

### S2-3 · **Progress is one Tracks matrix** (HS-35 #1, DA 10 1B)
Rows are tracks, columns are the roster's players, and each cell is that player's status on that track. There is no segmented control. Level 1 is the matrix; level 2 is one expanded row (S2-9). The toolbar is one row: **Tracks ⇄ Find** (S2-11), and for leads **Edit statuses** and **Track a farm**. "Track a farm" opens Find, so it is absent until S2a-4; until then Settings ▸ Goals & Farms' Add Farm is V2's create path (fold-2 #11). The page opens on the matrix, which is never empty because the tier row is always there (bare from S2a-2, full from S2a-3b; vet C4).
*Why:* it draws PRODUCT_MODEL §3.3 literally, uses the Roster Board's grammar (players across, things down), and the cross-farm question ("which duty is worth running tonight?") needs every farm visible at once.

### S2-4 · **Columns are the current tier's roster; status stays per user** (owner, 2026-09-30)
- Columns follow Roster ▸ Board order, subs last, each with the job icon, position and name in the role colour.
- A claimed player's cells show their user's farm status (`RewardParticipantState`, keyed goal + user), merged with their character's record (S2-10).
- An unclaimed player is a dim, empty column marked "Claim to track". It can't hold a status.
- A static member who has a farm status but no player in this tier gets a trailing column marked "Not on the roster", so no data disappears. It reads their main character (S2-10).
- Status stays keyed by user: no re-key. S2a-1 adds only the writer and channel columns (S2-10) and a state timestamp (S2-9's Undo) (vet I6, I7).

*Why:* farms outlive tiers, and roster players are per tier, so player-keyed statuses would reset at every new tier. The plugin syncs per user. Overturns the mockup's "Set unclaimed to Need".

### S2-5 · **Rows: the tier first, then active farms by need** (owner, 2026-09-30)
- Row 1 is the current savage tier (S2-6), always.
- Active farms (goal status `wanted`, `farming` or `scheduled`) follow, ordered by the number of players who still need them, then by name (fold-2 #5). Home's TrackCard uses the same rule (S2-12), so the card and the first farm row always agree.
- A farm row's status column reads "{n} of {m} have it", where m counts this tier's claimed players not on Pass. "Not on the roster" columns show but count in neither n nor m (vet M12).
- Finished farms (goal status `complete`) collapse into "Finished (n)" below. A lead marks a farm finished from its row menu, and **Reopen** on a finished row sets it back to `farming` (fold-2 #5). When every non-Pass column has it, the lead sees "Everyone has it · Mark finished".
- An ultimate weapon is an ordinary farm row with one cell per player.
- There is no "ultimate prog" row: no phase concept exists anywhere in the data, so it would be a new feature. Ultimate progression tracking and per-job ultimate weapons go to "After 3.0.0".

### S2-6 · **The tier row** (HS-35 #6, D-18)
- **Bare first (vet C4):** S2a-2 ships the row with its name, "Week n" and **Open board**, so the matrix is never empty for a static with no active farm (DEVTST has none). S2a-3b adds the rest below.
- **Cells** use the one BiS definition (HS-35 #6, B): "6/11" over a three-part bar of done, needs augment and to go, in the player's role colour. A player with no BiS targets shows "No BiS set".
- **One helper:** S2a builds that calculation as a shared selector. Home and Roster ▸ Board adopt it in their own W4 reworks, so the three numbers agree.
- **Status column:** "23/77 BiS slots · Week 11 · 0 of 4 floors cleared".
- **Actions:** "Open board" goes to Roster ▸ Board. Expanding the row (`?track=tier`) shows the **split plan**, the existing Split Planner moved into V2 as the tier's detail (D-18 ships here). When split clears are off (`settings.splitClearMode`), a lead sees "Turn on split clears" and a member sees no expand control. The split-clear GET gets the active-tier filter its docstring promises (`split_clear.py:222-227` filters by static only): V1 delta (f), §7.

### S2-7 · **Editing: your own cell inline; leads get an edit mode** (owner 2026-09-30; amends HS-35 #2 9A)
- **A member** clicks their own cell to open a small **Need · Want · Have · Pass** picker plus their totem count when the farm has a token. It saves on pick and shows an Undo toast. No modal (CLAUDE.md: never modals for quick edits). Glyph plus text in every state: "✓ Have", "Need 62/99", "★ Want", "– Pass". Never colour alone.
- **Members set their own totem count.** This amends HS-35 #2 9A, which ignored a member's `token_count`. The manual queue order (`priority_rank`) stays lead-only. Have (and un-Have) and the count go to the member's character record; Need, Want and Pass stay on this static's row (S2-10).
- **Who sees counts (B1):** the static's members see every count. Viewers see the state only ("Need", "★ Want"), with no count and no queue order. A member can hide their own counts from their statics with a Hub privacy setting. The server enforces both (S2-10).
- **Every cell shows where its value came from** on hover and focus: "you", "self-reported", "plugin, 2 days ago" or "set by {lead}", read from the writer and channel columns (S2-10; vet I6, B2). An `api_key` write reads "plugin" (B10).
- **A lead** turns on **Edit statuses**: every claimed cell and totem count becomes editable, with one bulk action, "Mark everyone without a status as Need", and "Done" to leave the mode. A lead's edit is that static's correction only, un-Have included (S2-10). The bulk action is new and works because Track leaves members with no signal blank (S2-11, B5). Legacy's G-27 (`MountFarmDetail`'s per-member editing, own currency included) ports as this mode plus the member's own cell, not as the bulk action (vet I9).
- **Viewers** see the matrix read-only. A member sees no lead controls: hidden, not disabled (ROLE-1).

### S2-8 · **The queue: Need before Want, then fewest totems** (owner, 2026-09-30)
- Automatic order: Need before Want; within each, the fewest totems first; drop-only farms fall back to roster order. Have, Pass and unclaimed are out of the queue.
- **A hidden count (B1) ranks as unknown**, after the known counts in its state, so hiding gains nothing and reveals nothing. The Hub toggle's copy says so. Nothing changes until that toggle ships, because counts are shown by default (owner Q, accepted; fold-2 #4).
- **The farm's `priority_mode` decides whether there is a queue (B3,** `schemas/collection_goals.py:16-18`**):** `free_roll` shows no queue and Log a drop preselects nobody; `desired_only` queues Need only; `everyone_gets_one`, `priority_order` and `custom` use the rule above. So does a null mode, the default (`models/collection_goal.py:59`, fold-2 #9).
- A lead's **Change order** pins a manual order (`priority_rank`), and **Back to automatic** clears it.
- **Self-reported counts (B2):** under-reporting would climb a fewest-first queue. The order ranks counts as they are; every count says where it came from (S2-7: "self-reported" or "plugin"); the lead's pin is the correction.
- *Why fewest first:* the drop should go to whoever is furthest from buying it; the player on 98 buys it next week anyway. The mockup said "most totems", which finishes the farm in more runs. Today `list_participants` orders by `priority_rank`, then `updated_at`, and legacy's card picks the next Need by `priorityRank` (`RewardGoalCard.tsx:65-67`, vet M11). Need-then-fewest is new, V2-only and computed client-side.

### S2-9 · **The expanded row (level 2)** (owner, 2026-09-30)
- One row is open at a time, opened by a click or by `?track=<goalId>` (or `?track=tier`), which also scrolls it into view.
- A farm row's expansion holds:
  - **the queue** (top four, then "Show all"; none under `free_roll`, S2-8);
  - **the last three drops**, labelled with the raid week derived from the drop date ("Week 10"); drops from before the current tier show a date. Drops store only a timestamp, so the label is display-only;
  - **Log a drop:** a lead logs for anyone, with #1 preselected; a member gets **"I got it"** for themselves only (9A). The drop records the recipient's character (S2-10, B11). **A member's own "I got it" also writes their character record**, so their other statics stop queueing them for it (`PRODUCT_MODEL.md:56`). A lead's drop logged for someone else stays on this static's row, labelled "set by {lead}", like any lead correction (S2-10) (owner Q, accepted; fold-2 #12). A drop whose recipient is the logger, a lead logging their own, writes the record too (fold-3);
  - **Undo**, through the drop delete route #329 added, which restores the row as it was before the drop. It checks a new `state_changed_at` that only state changes bump. When "I got it" wrote the record, Undo reverts the record too, but only while the record's `state_changed_at` hasn't changed since the drop (fold-2 #12). Today's check reads `last_synced_at` (`collection_goals.py:876-879`), which every plugin token sync bumps (`plugin_collection_sync_service.py:359-360`), so Undo stopped restoring after any sync (vet I7);
  - **Copy plan** (the Discord text legacy's farm page already builds);
  - **Schedule a farm night:** opens Schedule's add-session with the farm prefilled, for leads. If that needs Schedule-side changes, it waits for W4 SCHED (D-65); until then the action is absent, not a stub (vet M12).
- Leads get a row menu: **Edit** (title, type, status (Wanted · Farming · Scheduled; finishing is Mark finished), content, priority mode and notes, edited inline in the expansion; this replaces `RewardGoalModal`'s edit, G-14, vet I9; owner Q, accepted, signed in §8's matrix, fold-2 #5, #14), **Mark finished**, **Delete** (with `ConfirmModal`, DEL-1).

### S2-10 · **Totems and mount ownership belong to the character; farm rows read through it** (HS-36; vet C1, C2, I5–I8; B6, B8, B11)
- **One record per character per collection item** holds whether the character owns it and how many tokens it holds. It is `PlayerCollectionSnapshot` (today per profile, `player_collection_snapshot.py:33`), which keeps `profile_id` and gains a nullable `character_id` (fold-2 NEW-C). There is no per-static copy: PRODUCT_MODEL §3.1 makes ownership character data that aggregates into static views, not duplicated per static (vet I8).
- **Profiles with no character keep a profile-level row (fold-2 NEW-C).** A row with `character_id` NULL serves a profile with no character. Hub writes auto-create such profiles (`player_collection.py:353,437-439`), and V1 Profile ▸ Collections writes to them (`CollectionsCenterTab.tsx:766,772`). The profile's first character adopts its profile-level rows.
- **The main character** is the first of `profile.characters` in the model's order (`player_profile.py:70`: `is_main` first, then the oldest). `is_main` is neither unique nor guaranteed: it defaults to true and can be cleared (`player_character.py:46`, `player.py:840-841`) (fold-2 NEW-C).
- **The server merges in `list_participants`** (`collection_goals.py:496-527`, which V1 reads raw today), per field (fold-2 #2):
  - **State:** a Pass the member set; otherwise Have when the record says owned and is newer than the row's `state_changed_at`; otherwise the row's state. A row's Have that a lead didn't set (by correction or by a drop for someone else) yields to a newer un-Have on the record, so a member's un-Have reaches the rows today's plugin sync marked Have in every static (`plugin_collection_sync_service.py:275-310`) (fold-3).
  - **Count:** the newest write, the row's or the record's.
  - **`source`** maps onto its three existing values.
  - **Only a person lowers ownership.** A member's own un-Have writes the record; a lead's un-Have is that static's correction.
  The per-static values are a lead's correction, a lead's drop for someone else (S2-9) and an unresolved sync's write (B6). Only you, or your plugin, change your data in other statics.
- **Which character a static reads (vet C2):**
  1. the member's claimed player in the static's **active** tier → its registrations, primary first, then in the `static_characters.py:190-194` order (oldest first) when none is primary (fold-2 #8) → the first that resolves: a linked Hub character, or a manual registration (name and world only, `static_character_registration.py:60-62`) matched by name and world among the member's own characters;
  2. otherwise (no card this tier, which is the "Not on the roster" column; no registration; or none resolves) → the member's main character (above);
  3. otherwise (no character on file) → the profile-level row, and with no profile the farm row keeps its own values, as today.
- **Who writes the record.** The member writes Have, un-Have and the count from their Progress cell, their own "I got it" (S2-9), or the Hub. The Hub's character picker defaults to the main (B8); S2a-1a adds the API parameter, defaulting to the main. V1 Profile ▸ Collections writes the main, or the profile-level row. The plugin writes it through both syncs.
- **Matching a plugin sync (vet C1).** The plugin sends `characterName` only. `characterWorld` is declared (`XIVRaidPlannerPlugin/Api/Models.cs:204-205,299-300`), but neither sync sets it (`Services/MountFarmService.cs:119-126`, `Services/CollectionSyncService.cs:136-143`). The name falls back to "Unknown" (`:110`, `:119`), and automatic mount-farm sync is opt-in (`Configuration.cs:106`, default off). The server picks the one character among the user's own whose name matches, and whose world matches when one is sent. A null, "Unknown", unmatched or ambiguous name (two of your characters share it) falls back to today's behaviour: the sync writes the farm rows of every static where you are a non-viewer member (B6). An unresolved sync also writes the main's record, or the profile-level row, as today's collections sync always writes the profile snapshot (`plugin_collection_sync_service.py:152-170`), so V1 Profile ▸ Collections keeps showing plugin values (`CollectionsCenterTab.tsx:325`) (fold-3). Exact keying needs a plugin release that sends the world. That changes the plugin's behaviour, not its request shape (§9).
- **One collision rule for both syncs (vet I7).** Today they differ. Collections sync never lowers ownership, never overwrites a manual Pass and always overwrites tokens (`plugin_collection_sync_service.py:17-20`). Mount-farm sync keeps any manual un-mark, with no recency check (`mount_farms.py:897-905`, fold-2 #10), and reads its own trial catalog (`:848-851`). From S2a-1b both write the record through one service with one rule:
  - a sync only raises ownership; only a person un-marks Have. So the next sync that reports the mount owned re-raises a person's un-Have: the game is the truth for that character's ownership (fold-3; owner Q, accepted);
  - no sync changes a Pass a person set;
  - for token counts, the newest write wins, from any channel.
  `MountFarmProgress` keeps its current write rule, so V1's legacy Home (`StaticHomeTab.tsx:1640`) doesn't change. Game data wins everywhere else, as collections sync already does on the snapshot: it raises ownership over a manual "missing" (`plugin_collection_sync_service.py:264-267`) (fold-2 #10).
- **Attribution in PROV-1's vocabulary (vet I6; plan-vet-prov1 #9).** The character record and the farm row each gain `updated_by_user_id` and `updated_via` (`String(10)`, filled from `logged_via(request)`: `web` or `api_key`). "Set by {lead}" means the writer isn't the row's member; "plugin" means `api_key`. The `source` enum keeps its three values (manual · player_hub · plugin), so V1's "Synced from {source}" shows nothing new (vet C3c).
- **Drops record the character (B11).** `reward_drop_log` gains the recipient's character, resolved by the chain above, in S2a-1a. PROV-1 adds its `logged_via`.
- **Migration attribution (vet I7, fold-2 NEW-C).** Each per-profile snapshot gets the profile's main (above) as its character. When the profile has no character, it stays profile-level. Each `MountFarmProgress` row (per static) goes to the member's character in that static, by the chain. Where one character's sources disagree, ownership is the OR and the token count is the most recently written. Farm rows keep their own values, and the merge above decides what shows. The migration backfills each row's `state_changed_at` from the row's latest timestamp (fold-3).
- **Count visibility (B1) is enforced on every read that carries another member's count (fold-2 #4):**
  - `list_participants` (`collection_goals.py:496-527`) → gated: V1 delta (i);
  - `GET /static-groups/{id}/mount-farms` (`mount_farms.py:250-260`, every member's `totem_count` at `:228`, needs only membership) → gated. V1 Home reads it (`StaticHomeTab.tsx:1640`; its activity items at `:1468-1469`), and so does V2's `StaticActivityFeed.tsx:24`: V1 delta (j);
  - static collection suggestions (`collection_suggestion_service.py:207`, already filtered by want visibility) → also honour the flag;
  - recorded exceptions:
    - the farm recommendations (`mount_farms.py:581-592`) return per-farm aggregates only. Their `members_close_to_target` and `members_can_buy` (`schemas/mount_farms.py:113-114`) are derived from counts and, with one member wanting, reveal that member's range, so they leave out the counts of members who hide them, treated as unknown as S2-8 does (fold-3);
    - the activity log (`mount_farms.py:553-575`) carries labels with no count;
    - Hub reads (`player.py:538-660`; `player_collection.py:156-171,253-322`) return only your own counts;
    - the dossier match (`collection_suggestion_service.py:425`) reads wants only.

  Viewers get states without counts. A member's Hub privacy flag withholds their own counts from their statics. S2a-1b adds the flag (default: shown); its toggle ships with the Hub's Privacy tab (HS-35 #23, §9). No S2a UI exercises the flag, so a pytest per gated read proves it (§7 #12).
- **Tests (vet C2, fold-2 NEW-C):** a pytest for each case: each chain step, each match outcome (one, none, two, "Unknown", null), each collision case, each migration conflict, and the profile cases. Those are: no character (profile-level row), first character adopting it, no `is_main`, and a cleared main.
- *Why:* HS-36 makes these facts per character. One record lets a member's or plugin's write reach every static where that character plays, and a lead's correction stays local. The rule is new. It is not the gear fan-out, which matches user and job across every tier and static with no character (`player.py:260-265`, vet I5).
- The plugin's request and response contracts don't change. Both shells see the change; §7 declares the V1 deltas.

### S2-11 · **Find mode** (DA 11 A, owner 2026-09-30)
- One ranked list: search, labelled filter tags (`Tag variant="filter"`), "Wanted by your static (n)" first, then "All farm sources (n)", one ~56 px row component, and `inert` on collapsed bodies.
- "Wanted by your static" is built live from members' Hub wants, using the existing static collection-suggestions join. A private want never shows.
- Row actions by role:
  - a lead gets **Track**, which seeds the statuses from wants, the character records (S2-10) and plugin data. A member with no signal gets no row and starts blank, so the bulk action has blanks to fill (B5). Today's seed sets them to Want (`collection_goals.py:406-409`): V1 delta (g);
  - a member gets **I want this**, which sets their Hub want and shares it with their statics. The copy says "your statics", because a want's visibility has no per-static option (`player_collection_intent.py:17`). A private want is never flipped silently: the row asks inline first ("Your want is private. Share it with your statics?" Share · Cancel) (B4);
  - a farm already tracked shows **Tracking ✓**;
  - a lead's last row is always **Track "{search}" as a custom farm**, which creates a custom (non-catalog) track and opens its row in Edit (G-4, vet I9; owner Q, accepted, signed in §8's matrix, fold-2 #14).
- On the matrix, a footer line names the top wanted farm ("Caster One and Melee One want Wings of the Knighthood · Find").
- The list is one presentational component with an injected row action. The Hub adopts it in S2b.

### S2-12 · **Home's pointers** (F-10, F-11, HS-35 #3)
- **TrackCard (8A, D-67):** reads the static's farm goals, shows the top active farm by S2-5's rule ("Wings of Resolve · Mount · 2 of 6 have it", role-coloured pips with state glyphs, "Caster One is next (62/99)"; viewers get no count and no "next", B1) and opens `?tab=progress&track=<id>`. It is hidden when no farm is active. 8A is data-gated (HS-35), so it supersedes D-67's "O-39 empty-state copy returns button-less on the card's empty form" (`v1-v2-parity-matrix.md:486`); the parity matrix records O-39 as RETIRED-SPEC (vet I10).
- **Split attention row (F-11, D-68):** a data-gated row on Home that opens the split plan itself (`?track=tier`), not Roster (matrix §12 A13). It uses the same data condition as legacy's `SplitClearReadinessCard`: `splitClearData?.enabled` (`StaticHomeTab.tsx:1770`; the card is defined at `:1591`, vet M11).
- **Objectives card:** a small read-only card titled "Objectives", the word Recruit ▸ Listing uses (vet M12). It lists the objectives and is hidden when there are none (S2-13). It ships in S2a-5.
- W4 HOME places all three inside Home-A later.

### S2-13 · **Objectives leave Progress** (HS-35 #3, 5B)
- The existing objectives editor moves into **Recruit ▸ Listing** as a section. Recruit is lead-only, which matches who edits objectives.
- Members read them on Home (S2-12).
- It ships in S2a-5, with the retirements (vet C4). Until then V2's objectives editor, and the place members read objectives, stays Settings ▸ Goals & Farms ▸ Objectives.
- W4 RECRUIT restyles the editor inside the new listing editor. 5C (track rows flagged "Listed") is after the release.
- *Why now:* S2a-5 removes both of today's V2 hosts (Tracking ▸ Objectives and Settings ▸ Goals & Farms), and objectives feed the Finder's fit score, so V2 must keep an editor.

### S2-14 · **What V2 retires** (DA 10, A5 §6.7)
- Retirements ship last, in S2a-5 (two PRs: S2a-5a moves, S2a-5b deletes), once the matrix, the expanded rows, Find and the pointers exist, so V2 never loses an affordance before its replacement (vet C4, fold-2 #7).
- V2 no longer reaches `GoalsPage`, `CollectionsHub` or their modals. V1 keeps all of them until D1.
- **Settings ▸ Goals & Farms in V2 keeps only its Suggestions section** (`ContentSuggestionsPanel`, `SettingsPanel.tsx:61,304`), V2's only host for members' content suggestions. W4 HOME restores D-70 (Member Interest on Home); then the tab is hidden, as Recruitment is (B7, vet C4). In V2 the tab reads **"Suggestions"**: the host sets that label, as it sets `hiddenTabs` (`SettingsPanel.tsx:334-338`). V1 keeps "Goals & Farms" unchanged (owner Q, accepted; fold-2 #13). Until S2a-5 the tab stays whole in V2, including Add Farm (`SettingsPanel.tsx:177-184,246-259`) (fold-2 #7).
- Deleted, ≈2,865 lines (fold-2 #11):
  - the orphaned mount-farm UI tree, `components/mount-farms/**` (G-24…G-28, 1,189 lines);
  - `components/profile/CollectionsTab.tsx` and its test (499 + 99 lines). Its imports at `:25,:29` reach into that tree, and only its own test imports it (vet I9);
  - `CatalogFarmRow` and `SuggestionFarmCard` (561 lines), and `ObjectiveCommandCenter` with its test (517 lines).
  - `gamedata/mount-farms.test.ts:14` imports `MountFarmSummary` from the tree, so it changes with it.
  - Each importer is checked. Matrix §12 A9 warns against sweeping G-27, which has no live equivalent. S2-7 rules its port, and the owner signs that row in §8's matrix before anything is deleted.
- `mountFarmStore` and the `/mount-farms` API stay, because the plugin calls them. After TrackCard moves, V2 still reads the store in `StaticActivityFeed` (`StaticActivityFeed.tsx:24,62`, vet M11); that reader goes with W4 HOME.
- ⌘K "Go to Tracking" becomes "Go to Progress".

### S2-15 · **Phones: desktop only in S2a** (owner, 2026-09-30; amends W3 S2a's acceptance)
Progress's phone cards move to the mobile pass (W7). V2 still renders `MobileBottomNav` until S2c removes it, and its "Goals" entry opens `PageMode` `'goals'` (`MobileBottomNav.tsx:23-41`), so phones do reach Progress from S2a-2 on. They get the desktop matrix, which scrolls sideways inside its own container, never the page, until W7. S2a adds no phone gate: mobile is one end-phase pass.

## 3. The canvas, and where this spec departs from it

The two DA 10 pages are the visual reference: the five-tab spine, the page header "Every track {static} is working on, the tier first · Week n", the toolbar, the tier row, farm rows with state cells and a status column, and a lead-edit expanded row. Four departures:

| Canvas | This spec | Ruling |
|---|---|---|
| Unclaimed players hold statuses; "Set unclaimed to Need" | Unclaimed columns are dim and empty | S2-4 |
| "Palazzo Diamond Weapons · Prog · Phase 3" | An ultimate weapon is an ordinary farm row; no prog row | S2-5 |
| "Need before Want, then most totems" | Fewest totems first | S2-8 |
| Phones fall back to cards | Phone cards in W7 | S2-15 |

The canvas's context bar (static ▾ / tier ▾ / dated week chip) and "Recruiting · Settings" utility zone are W4 FRAME and HS-35 #12 work, not S2a.

## 4. Structure and navigation (controller rulings, HS-35 #30)

- **One seam:** `PageMode` `'goals'` gets a V2 content slot that renders the new `ProgressPage`, as `gear` did for Loot. V1's `goals` body is untouched.
- **Interim, S2a-2 to S2a-5 (vet C4, fold-2 #7):**
  - S2a-2 and S2a-3a are one stack: S2a-3a sits on S2a-2 and the two merge together, so the seam goes live with drop logging, Edit, Delete and Copy plan. Each PR is demonstrated on its own branch.
  - Settings ▸ Goals & Farms stays whole in V2 (objectives, Add Farm, Suggestions) until S2a-5.
  - The Suggested and Browse Catalog tabs, browsing and Track included, return as Find in S2a-4. Until then they are dated interim rows in the owner-signed parity matrix, reached through the classic view (owner Q, accepted: a temporary loss of a V2 affordance is an owner sign-off; fold-3).
- **URLs:** V2 writes `?tab=progress`; `progress`, `goals`, `mount-farms` and `collections` all resolve to it, so recalled tabs and old links keep working. Level 2 is `?track=<goalId|tier>`; Find is `?pview=find` (default `tracks`, omitted). The parser is shared (`useGroupViewState.ts:30-40`), so V1 also opens Tracking for `?tab=progress`: V1 delta (d).
- **Old deep links:** `?goal=objectives` lands a lead on Recruit ▸ Listing and a member on Home. `?goal=farms` and `?farm=…` land on Progress.
- **Spine:** `Spine.tsx` gains `{ id: 'goals', label: 'Progress' }` as the fifth tab. Keyboard: key 5 once W1's positional keys (D-17, HS-35 #12) land; until then the existing goals key opens Progress. The Spine contract (`design/redesign/DESIGN_SYSTEM.md:284`, §3.13 "4-tab") is updated to five tabs in S2a-2, as Stage 2's acceptance requires (vet I10).
- **Density (rule 11):** one toolbar row with at most four controls; one primary action per region.

## 5. Data

| Need | Today | S2a |
|---|---|---|
| Farm status per user | `RewardParticipantState` (goal, user), Need/Want/Have/Pass; lead and self writes both store `source="manual"` (`collection_goals.py:574,588` vs `:653,667`) | Unchanged keying; adds `updated_by_user_id`, `updated_via` and `state_changed_at` (S2-9, S2-10; vet I6, I7); `list_participants` merges the record per field (fold-2 #2) |
| Member's own totems | Ignored for non-leads (`collection_goals.py:541-554`, #329) | Written to the member's character record, else the profile-level row, else this static's row (S2-7, S2-10); AUTHZ "self" row and probe updated |
| Character's totems and ownership | `PlayerCollectionSnapshot` per profile; `MountFarmProgress` per static; the two plugin syncs write different stores under different rules | `PlayerCollectionSnapshot` keeps `profile_id`, gains nullable `character_id` (fold-2 NEW-C) plus `state_changed_at` (the Undo check in S2-9), `updated_by_user_id` and `updated_via`. Uniqueness moves from `uq_player_collection_snapshot_profile_item` (`profile_id`, `catalog_item_id`; `player_collection_snapshot.py:72-76`) to two partial unique indexes, one row per (`character_id`, item) where `character_id` is set and one per (`profile_id`, item) where it is NULL, declared for both dialects (`postgresql_where` / `sqlite_where`) so `check_migration_dialect.py` passes. Farm rows merge it with a per-static override; one collision rule; migration attributes both stores (S2-10) |
| Count visibility | Every count to every member, viewers included (`list_participants` needs only membership; `ParticipantsPanel.tsx:124-126`; `mount_farms.py:228,260`); suggestions hide counts unless the want is shared (`collection_suggestion_service.py:207`) | Members see all; viewers see states only; a member's Hub flag hides their own counts; every count-carrying read gated or recorded as an exception (B1, fold-2 #4) |
| Track seed | No-signal members seeded Want (`collection_goals.py:406-409`) | No row: they start blank (B5) |
| Roster columns | Client has `useTierPlayers()` and each player's `userId` | Client join, no API change |
| Queue order | `priority_rank`, then `updated_at` | Computed client-side (S2-8; B3's `priority_mode` mapping, null included); `priority_rank` still overrides |
| Drops | `RewardDropLog`: recipient user, timestamp | PROV-1 (W0, merged before S2a-1) adds `logged_via` and `api_key_id`; S2a-1a adds the recipient's character (B11); a member's own drop also writes the record (S2-9) |
| Drop week label | Timestamp only | Derived client-side from the tier's week numbering |
| Wanted by your static | `GET …/collection-suggestions` joins Hub wants (visibility-filtered) | Reused |
| Tier BiS | `bisSlotTotals`, `playerBisProgress`, `calculatePlayerCompletion` disagree | One selector per HS-35 #6 (S2-6) |
| Split plan | `splitClearStore` / `/split-clear`; GET filters by static, not tier (`split_clear.py:222-227`) | Reused; GET filters to the active tier (S2-6, V1 delta (f)) |

The plugin's contract (CLAUDE.md § Pitfalls) is unchanged: both farm syncs keep their request and response shapes. Any new or changed mutation route gets its row in `backend/tests/authz_matrix.py`. The farm mutations' role checks that matrix §12 A7 found missing shipped in #329 (`collection_goals.py:217,287,705-708`), so A7 is closed (vet M12).

## 6. Slice cut (controller ruling, HS-35 #30)

Five slices, ~8 PRs, each under ~1,500 changed lines. This replaces W3's "L (2 PRs)" (vet M12, fold-2 #7). The split points are named now. Retirements come last (vet C4).

| Slice | Contents | Depends on |
|---|---|---|
| **S2a-1** · character records (backend) | **S2a-1a** the record and migration: re-key with the profile-level row, main rule, merge in `list_participants`, attribution columns, `state_changed_at`, the drop's character (B11) and "I got it"'s record write, the Hub API parameter (B8), S2-7's member totem write, B5's blank seed, AUTHZ rows · **S2a-1b** the syncs: match rule and B6 fallback, one service with the collision rule, B1's count gating and privacy flag | PROV-1 (needs `logged_via`; its migration follows PROV-1's head) (fold-2 #11) |
| **S2a-2** · the Progress tab: the matrix | §4 (seam, URLs, the fifth spine tab, the Spine contract), S2-3, S2-4, S2-5's farm rows, the bare tier row (S2-6), S2-7, the ⌘K label 'Go to Progress' (S2-14) | S2a-1 |
| **S2a-3** · level 2: the expanded rows | **S2a-3a** the farm expansion: S2-8, S2-9 (with the inline Edit and Reopen), `?track=<goalId>` · **S2a-3b** the tier row in full: S2-6 (BiS selector, cells, status column, split plan with the tier filter, `?track=tier`, D-18) | S2a-2; S2a-3a stacks on S2a-2 and they merge together (§4) |
| **S2a-4** · Find and Home's pointers | S2-11 (with the custom track), "Track a farm", S2-12's TrackCard and split row | S2a-3 (the pointers open its rows); Find alone needs only S2a-2 |
| **S2a-5** · retirements | **S2a-5a** the moves: S2-13 (Recruit editor and Home's Objectives card), the Suggestions-only Settings tab · **S2a-5b** the deletions (S2-14, ≈2,865 lines) | S2a-3, S2a-4 |

If any plan's estimate still goes over the cap, it splits further at planning time.

## 7. Acceptance criteria

Each criterion and each V1 delta names the slice that demonstrates it (fold-2 #6). S2a-1 ships V1-visible deltas (a), (b), (g), (h), (i) and (j) on merge, with no UI slice of its own. Its PRs therefore show V1's `GoalsPage`, Profile ▸ Collections and Home (for (j)) before and after in the running app, and carry those release notes.

1. **[S2a-2]** `Spine.tsx` renders five tabs and DESIGN_SYSTEM §3.13 says so. Progress opens on the matrix with the tier row first for DEVTST (no active farms) and is never empty (vet C4, I10).
2. **[S2a-1a, S2a-2]** A member changes their own cell inline, and sets their own totem count, with no modal; Undo restores it.
3. **[S2a-1a, S2a-2]** A lead's Edit statuses edits any claimed cell. The bulk action marks only blank cells Need, and a freshly tracked farm leaves members with no signal blank (B5).
4. **[S2a-3a]** A lead logs a drop from an expanded row with #1 preselected (none under `free_roll`). A member logs "I got it" for themselves and nobody else, and their other statics stop queueing them. Undo restores the prior state, including after a plugin token sync, and reverts the record only while its `state_changed_at` is unchanged (vet I7, fold-2 #12).
5. **[S2a-3a, S2a-3b]** `?track=<id>` and `?track=tier` open that row expanded and in view; the tier row's expansion shows the split plan (D-18 ship marker).
6. **[S2a-1b]** A plugin sync whose name matches one of your characters updates that character's cells in every static where it is your character (chain, S2-10). An unmatched, "Unknown", null or ambiguous name writes every non-viewer membership, as today. A lead's correction in one static changes no other. A pytest covers each case (vet C1, C2, B6).
7. **[S2a-4]** Find lists "Wanted by your static" first and never shows a private want. Track seeds statuses. "I want this" never shares a private want without asking (B4).
8. **[S2a-4]** Home's TrackCard and the first farm row name the same farm; the split row opens the split plan (D-67, D-68 ship markers).
9. **[S2a-5]** Objectives are editable in Recruit ▸ Listing and readable on Home. No V2 route reaches `GoalsPage`, `CollectionsHub` or any part of Settings ▸ Goals & Farms except Suggestions, labelled "Suggestions" in V2 only (B7, fold-2 #13).
10. **[each UI slice]** axe: 0 critical / 0 serious on Progress in both themes at 1440; every cell is keyboard-reachable and names its player, track and state; a viewer sees states and no counts (B1).
11. **[each slice]** V1 is byte-identical except the deltas declared below. Each ships with its release note (vet C3).
12. **[S2a-1b]** A pytest per gated read in S2-10 shows the count missing for a viewer and for a member whose privacy flag is set. The recorded exceptions carry no other member's count (fold-2 #4).
13. **[S2a-1a]** A pytest per profile case (fold-2 NEW-C):
    - a profile with no character keeps and serves its profile-level rows;
    - its first character adopts them;
    - a profile with no `is_main`, or a cleared one, resolves its main by the `player_profile.py:70` order;
    - V1 Profile ▸ Collections writes survive the migration.

**Declared V1 deltas** (criterion 11):

| # | Slice | Delta | V1 render path | Release-note line |
|---|---|---|---|---|
| (a) | S2a-1a, S2a-1b | A write to a member's character record now reaches that character's rows in every static that reads it. The writes are a plugin sync, the Hub or V1 Profile ▸ Collections, and the member's own Have from V1 (`RewardGoalDetailModal.tsx:42`) (fold-2 #3). Unresolved plugin names still write every static (S2-10) | `components/group/GoalsPage.tsx` → `collections/ParticipantsPanel.tsx`, `RewardGoalCard.tsx` | "Your mounts and totems now follow your character into every static you play it in." |
| (b) | S2a-1a | The collection record is per character; the readers below each read one character (fold-2 #3) | `pages/Profile.tsx:517` → `profile/CollectionsCenterTab.tsx`; the readers below | "Your collection is now kept per character; Profile ▸ Collections shows your main." |
| (c) | S2a-1a | Designed out: `source` keeps its three values; the channel goes in `updated_via` (S2-10) | `collections/ParticipantsPanel.tsx:129-132` ("Synced from {source}") | None: nothing visible changes. |
| (d) | S2a-2 | `?tab=progress` resolves to Tracking in V1 too (§4) | `hooks/useGroupViewState.ts:30-40` → `GoalsPage.tsx` | "Progress links open Tracking in the classic view." |
| (e) | S2a-2 to S2a-4 | New actions in the shared store; existing actions keep their behaviour | `stores/collectionGoalStore.ts` → `components/collections/*` | Internal line only. |
| (f) | S2a-3b | The split-clear GET returns only the active tier's assignments, so earlier tiers' no longer count as "existing". The plugin's overlay reads the same response; its shape is unchanged (S2-6, fold-2 #3) | `split-clear/SplitClearPlanner.tsx:66-70` (Roster `?rsub=split-planner`); `StaticHomeTab.tsx:1770` readiness card; plugin `Api/RaidPlannerClient.cs:393` → `Windows/SplitClearOverlayWindow.cs:189-199` | "The Split Planner and the plugin's split overlay now show only the current tier's assignments." |
| (g) | S2a-1a | Track leaves members with no signal blank instead of Want (B5) | `GoalsPage.tsx` → `ParticipantsPanel.tsx` | "Newly tracked farms no longer mark everyone as Want; members without a signal start blank." |
| (h) | S2a-1a | A member's own totem count is accepted (S2-7); no V1 control sends one, but V1 shows it | `ParticipantsPanel.tsx:124-126` | "Members can set their own totem counts." |
| (i) | S2a-1b | Viewers get farm states without counts; a member can hide their counts (B1) | `ParticipantsPanel.tsx:124-126` | "Viewers see farm statuses without totem counts." |
| (j) | S2a-1b | The mount-farm GET gates counts the same way, so V1 Home's totem activity drops viewers' view of counts and members who hide theirs (fold-2 #4) | `StaticHomeTab.tsx:1640,1468-1469` → `utils/staticActivity.ts:113,142` | "Totem activity on Home now respects who may see totem counts." |

**Snapshot readers for (b)**, each with the character it reads (fold-2 #3):
- The Hub's own reads and writes (`routers/player_collection.py:156-171`, `:253-322`, `:330-398`) use the main, the picked character (B8), or the profile-level row.
- Static suggestions (`services/collection_suggestion_service.py:295-304`) and the Track seed (`collection_goals.py:340-345`) use each member's character in that static, by the chain.
- `services/player_reward_bridge_service.py:172-282` (write-through from mount-farm edits) uses the member's character in that static, by the chain.
- `services/legacy_mount_farm_bridge.py` reads `MountFarmProgress` only. The snapshot that overrides it (docstring `:13`) is the chain's character.
- The dossier match (`player_collection.py:403-424` → `collection_suggestion_service.py:425`) reads wants only, not snapshots, so it is unchanged.

## 8. Parity

Before any code, an owner-signed matrix (`specs/2026-09-30-s2a-parity-matrix.md`, the Stage 1 / PH1 vocabulary: KEPT · RE-HOMED · RETIRED-SPEC · RETIRED-ACK · DEFERRED) covers every V2-reachable affordance of:
- `GoalsPage` (Objectives; Farms ▸ Suggested · Active · Catalog). The Suggested and Browse Catalog tabs, between S2a-2 and S2a-4, are dated interim rows (fold-2 #7; owner Q, accepted, fold-3).
- `RewardGoalModal`: every field mapped, status included (`RewardGoalModal.tsx:25-29,66`, `:124-206`). G-4's "Custom Goal" → Find's custom track; G-14 → the row's inline Edit plus Mark finished and Reopen (fold-2 #5).
- `CreateCollectionGoalModal`, Settings' Add Farm (`SettingsPanel.tsx:177-184,246-259`): every step of the 5-step wizard mapped (`CreateCollectionGoalModal.tsx:106`: content type, duty, reward type, status, name) (fold-2 #5).
- `RewardGoalDetailModal` (participants, drop history), `LogDropModal` and `TrackFromCatalogModal`.
- Settings ▸ Goals & Farms (Suggestions kept until W4 HOME, B7).
- Home's `TrackCard` (O-39, S2-12).
- The Split Planner's V1 entry (Roster `?rsub=split-planner`, Home's readiness card).
- ⌘K "Go to Tracking".

It also covers the code S2a-5 deletes:
- the orphaned `components/mount-farms/**` tree (G-24…G-28). Matrix §12 A9 says to ask before sweeping. G-27 → Edit statuses plus the member's own cell (S2-7);
- `components/profile/CollectionsTab.tsx` (vet I9).

G-4's custom track and G-14's inline Edit are proposed designs. The owner signs them in this matrix before any code (owner Q, accepted; fold-2 #14).

## 9. Out of scope / carried

- **After 3.0.0:** ultimate progression tracking; per-job ultimate weapons; statuses for unclaimed players; 5C ("Listed" track rows); your character's gear and books following you across statics, alts and split clears (HS-36); the plugin pass (automatic collection sync, plugin-tagged purchase logs, the off-hand mapping, and sending `characterWorld` so a sync keys exactly to one character, S2-10).
- **Other waves:** phone cards (W7); the Hub "Wants" tab and its adoption of the Find list (S2b, HUB); the Hub's character picker for collection writes (B8) and its Privacy toggle for your counts (B1), both on APIs S2a-1 ships (HUB); D-70 Member Interest on Home, with Settings ▸ Suggestions as its V2 host until then (W4 HOME, B7); Schedule a farm night if Schedule needs changes (SCHED, D-65); the context bar and week chip (FRAME); positional keys (W1).
- **Recorded elsewhere:** HS-36 (self-service with attribution) goes into `HOME_STRETCH.md` §2 with this spec's PR. The same PR amends §4 S2's stage acceptance (`HOME_STRETCH.md:134`), "legacy is byte-identical except the approved Danger Zone delta", to add "and S2a's declared deltas (S2a spec §7)" (vet I10). It updates W3's S2a row to "five slices, ~8 PRs" with phones → W7 (S2-15), and marks §12 A7 closed (vet M12, fold-2 #7). Recording *how* entries are logged starts in PROV-1 (W0), whose `logged_via` vocabulary S2-10 adopts. Self-logged drops, books and PF clears with the once-a-week rule and the "Weekly limits lifted" tier toggle are W4 LOOT.
