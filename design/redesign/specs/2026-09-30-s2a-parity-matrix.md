# S2a Progress · affordance-parity matrix (spec §8 gate)

**Status: SIGNED 2026-10-01** by the owner, every item as recommended. Drafted 2026-10-01 against `b70d24bb`; director vet APPROVE-WITH-FOLDS, folds applied. No S2a code until this matrix is signed (S2a spec §8; `HOME_STRETCH.md:125`). Signing means ticking every box in §15. A row the owner rules differently is edited in place and re-dated.

**Owner sign-off:** the owner · date: 2026-10-01 (every §15 box ticked)

**Spec:** [`2026-09-30-s2a-progress-design.md`](2026-09-30-s2a-progress-design.md), accepted 2026-10-01. Rulings are cited `S2-n :line` (the spec's line). Structure follows [`stage1-chrome-parity-matrix.md`](stage1-chrome-parity-matrix.md); verdicts use the PH1 vocabulary (`plans/2026-09-26-ph1-player-hub-structure.md:38`).
**Paths:** files under `frontend/src/components/` are written from the component folder (`collections/RewardGoalCard.tsx:189`); `pages/`, `hooks/`, `gamedata/`, `utils/` from `frontend/src/`; `backend/…` from the repo root. Every cite was opened at `b70d24bb`.
**Scope:** every V2-reachable affordance of `GoalsPage` and its modals, Settings ▸ Goals & Farms and its Add Farm wizard, Home's TrackCard, the Split Planner's entries and ⌘K, plus the code S2a-5b deletes. V1 is unchanged except spec §7's declared deltas.

**Legend.** **KEPT** same affordance, same place or an equivalent one. **RE-HOMED** same capability, new place or form. **RETIRED-SPEC** removed by an accepted S2a ruling (cited). **RETIRED-ACK** removed with no ruling that covers it; the owner signs it off. **DEFERRED** has a named home outside S2a. Suffix **INTERIM**: a dated interim row. The affordance is out of V2 from the S2a-2 merge to the S2a-4 merge and reachable meanwhile through the classic view (UserMenu "Switch to classic UI", `auth/UserMenu.tsx:370`). The owner signs each one (spec §4 :168). **OPEN — owner** (none left after sign-off): the spec gave no home; §14 records the owner's answer. The slice after "·" is where the V2 home ships.

## 0. How V2 reaches `PageMode 'goals'` today

V2 passes four slots, `{ overview, roster, gear: loot, schedule }` (`pages/NewShell.tsx:182`), so `goals` renders the shared body: the page header "Tracking" (`pages/GroupViewContent.tsx:1163`), then `GoalsPage` (`:1164-1171`). The Spine has no goals tab (`layout/Spine.tsx:17-22`), and V2 Home never links to it: `home/Home.tsx` navigates only to roster, schedule and gear (`:267,291,348,356,373`). V2 reaches it through:
1. ⌘K "Go to Tracking" (`layout/CommandPalette.tsx:137-142`). The palette mounts only in V2 (`pages/NewShell.tsx:469-473`).
2. Key `3` (`hooks/useGroupViewKeyboardShortcuts.ts:96`), which the shared body mounts for both shells (`pages/GroupViewContent.tsx:506`).
3. Phones: `MobileBottomNav` "Goals" (`ui/MobileBottomNav.tsx:26,39`; mounted when a tier exists, `pages/GroupViewContent.tsx:1260-1266`) and the content swipe (`:178-191,733`).
4. URLs: `?tab=goals`, `mount-farms` and `collections` (`hooks/useGroupViewState.ts:30-40`), a recalled `goals` tab (`:205-209`), and the sub-tab params `?goal=` (`group/GoalsPage.tsx:24`) and `?farm=` (`collections/CollectionsHub.tsx:70`).
5. The `suggestion_vote` notification, which links `?tab=goals` (`backend/app/routers/content_suggestions.py:371`).

Settings ▸ Goals & Farms is reached from the settings gear or ⌘K "Open Settings" through `pages/V2SettingsHost.tsx:41`, which hides only Recruitment (`:25`). Every role sees the tab (`settings/SettingsPanel.tsx:61`).

## 1. Entry points, URLs and the page

| ID | V1 affordance | V1 source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| P-01 | ⌘K "Go to Tracking" (V2-only palette) | `layout/CommandPalette.tsx:137-142` | KEPT | Relabelled "Go to Progress" (S2-14 :144) · S2a-2 | Controller ruling 2026-10-01: relabel ships with the seam in S2a-2 (spec §6 :200,:203 amended in this PR) |
| P-02 | Key `3` → goals ("Tracking tab" in shortcut help) | `hooks/useGroupViewKeyboardShortcuts.ts:96` | KEPT | Opens Progress; key 5 once W1 lands (§4 :171) · S2a-2 | Shared with V1; text unchanged |
| P-03 | `MobileBottomNav` "Goals" | `ui/MobileBottomNav.tsx:26,39` | KEPT | Opens Progress: the desktop matrix, scrolling sideways (S2-15 :147) · S2a-2 | Label stays "Goals" (shared with V1); the bar goes in S2c |
| P-04 | Phone content swipe across tabs, `goals` included | `pages/GroupViewContent.tsx:178-191,733` | KEPT | Lands on Progress through the per-`PageMode` seam (§4 :164) · S2a-2 | Not named in the spec (§13 D-1); goes with S2c |
| P-05 | `?tab=goals` and a recalled `goals` tab | `hooks/useGroupViewState.ts:32,205-209` | KEPT | Resolve to Progress; V2 writes `?tab=progress` (§4 :169) · S2a-2 | V1 delta (d) |
| P-06 | Aliases `?tab=mount-farms`, `?tab=collections` | `hooks/useGroupViewState.ts:38` | KEPT | Resolve to Progress (§4 :169) · S2a-2 | |
| P-07 | `?goal=objectives` (GoalsPage's default) | `group/GoalsPage.tsx:6,24` | RE-HOMED | Lead → Recruit ▸ Listing, member → Home (§4 :170) · S2a-5a | Until S2a-5a, `?goal=` is ignored and the link lands on Progress like `?tab=goals` (§4 :169). Once the seam is live, no V2 surface writes it. |
| P-08 | `?goal=farms` | `group/GoalsPage.tsx:24` | KEPT | Lands on Progress (§4 :170) · S2a-2 | |
| P-09 | `?farm=suggested\|active\|catalog` | `collections/CollectionsHub.tsx:16,70` | KEPT | Lands on Progress (§4 :170) · S2a-2; `suggested` and `catalog` open Find (`?pview=find`) from S2a-4 | |
| P-10 | `suggestion_vote` notification → `?tab=goals` | `backend/app/routers/content_suggestions.py:371` | KEPT | Lands on Progress (§4 :169) · S2a-2 | Already mis-targeted today: it lands on Objectives, which doesn't show the suggestion either. Retarget with D-70 in W4 HOME |
| P-11 | Page header "Tracking" + subtitle | `pages/GroupViewContent.tsx:1163` | RE-HOMED | Header "Every track {static} is working on, the tier first · Week n" (§3 :151) · S2a-2 | |
| P-12 | Objectives ⇄ Farms switcher (G-1) | `group/GoalsPage.tsx:28-44` | RETIRED-SPEC | No segmented control (S2-3 :16); Objectives leave Progress (S2-13) · S2a-2 | |
| P-13 | Farms tabs Suggested · Active Farms (n) · Browse Catalog, default Suggested (G-3) | `collections/CollectionsHub.tsx:70,117-144` | RE-HOMED | Toolbar Tracks ⇄ Find; Active → Tracks (the default), Suggested and Catalog → Find (S2-3, S2-11) · S2a-2 | Find's half is INTERIM (§6, §7) |
| P-14 | "Custom Goal" (leads) → RewardGoalModal create (G-4) | `collections/CollectionsHub.tsx:146-150,265-270` | RE-HOMED | Find's last row: a custom track (S2-11 :116) · S2a-4 | Design §12.1. S2a-2 → S2a-4: Settings' Add Farm creates (S2-3 :16), so no gap |
| P-15 | Stats strip: Active farms · Still needed · Completed goals · Can buy now (G-5) | `collections/CollectionsHub.tsx:94-106,154-176` | RETIRED-ACK | — | Q-4 |
| P-16 | Active-tab empty state + View Suggestions · Browse Catalog · Custom Goal (G-6) | `collections/CollectionsHub.tsx:200-216` | RETIRED-SPEC | The matrix is never empty: the tier row is always first (S2-3 :16, S2-6 :37) · S2a-2 | Its CTAs → P-13, P-14 |
| P-17 | "Active (n)" and "Completed (n)" card grids | `collections/CollectionsHub.tsx:218-259` | RE-HOMED | Farm rows by need, then "Finished (n)" collapsed (S2-5 :30-32) · S2a-2 | A finished row expands like any farm row (who has it, drops, Copy plan), with no Log a drop (as `RewardGoalCard.tsx:192`). |

## 2. Farms ▸ Active: the farm card (`collections/RewardGoalCard.tsx`)

| ID | V1 affordance | V1 source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| P-18 | Card name and type icon | `:76-82` | RE-HOMED | A farm row (S2-3, S2-5) · S2a-2 | |
| P-19 | Status chip, type, content type, priority-mode labels | `:83-104` | RE-HOMED | The row: a farm row reads "{title} · {type}" plus a Wanted or Scheduled tag; the expansion shows content, priority mode and notes, read-only, to every role (Q-3); S2-5's status column stays the have-count (S2-5 :31) · S2a-2 | |
| P-20 | Need · Want · Have counts | `:109-136` | RE-HOMED | One cell per player plus "{n} of {m} have it" (S2-4, S2-5 :31) · S2a-2 | |
| P-21 | Token bar "{token}: n / cost" + "Can buy" badge | `:139-169` | RE-HOMED | Each player's own count in their cell, "Need 62/99" (S2-7 :44) · S2a-2 | The bar shows the creator's count to everyone (`:141`, A5-04): fixed. Badge: Q-4 |
| P-22 | "Next priority: {name} ({n} tokens)" | `:65-67,172-180` | RE-HOMED | The queue's top four in the expansion (S2-8, S2-9 :62); TrackCard "is next" (S2-12) · S2a-3a | Order becomes Need, then fewest totems |
| P-23 | Summary note (`goal.summary`) | `:183-185` | RE-HOMED | Edit's Notes (S2-9 :68); shown read-only in the expansion (Q-3) · S2a-3a | |
| P-24 | View → RewardGoalDetailModal | `:189-191` | RE-HOMED | Click the row or `?track=<goalId>`; one open at a time (S2-9 :60) · S2a-3a | |
| P-25 | Log Drop (not for viewers or finished farms) | `:192-196` | RE-HOMED | Lead "Log a drop", member "I got it" (S2-9 :64) · S2a-3a | |
| P-26 | Copy farm plan (Discord text) | `:197-207`; text `collections/CollectionsHub.tsx:19-56` | RE-HOMED | "Copy plan" in the expansion, same text (S2-9 :66) · S2a-3a | |

## 3. The farm detail: `RewardGoalDetailModal`, `ParticipantsPanel`, `DropHistoryPanel`

| ID | V1 affordance | V1 source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| P-27 | Detail modal: name and summary | `collections/RewardGoalDetailModal.tsx:61-71` | RE-HOMED | Level 2, the expanded row (S2-9): name on the row, summary read-only in the expansion (Q-3) · S2a-3a | |
| P-28 | Edit (leads) → RewardGoalModal edit (G-14) | `collections/RewardGoalDetailModal.tsx:75-79` | RE-HOMED | Row menu Edit, inline (S2-9 :68) · S2a-3a | Design §12.2 |
| P-29 | Delete (leads) + ConfirmModal "Delete Goal" | `collections/RewardGoalDetailModal.tsx:80-87,134-142` | RE-HOMED | Row menu Delete with ConfirmModal (S2-9 :68, DEL-1) · S2a-3a | |
| P-30 | Sub-tabs "Who needs it?" · "Drop history" | `collections/RewardGoalDetailModal.tsx:93-109` | RE-HOMED | One expansion: the queue, then the last drops (S2-9) · S2a-3a | |
| P-31 | My status Need · Want · Have · Pass, not for viewers (G-10) | `collections/ParticipantsPanel.tsx:77-92`; `RewardGoalDetailModal.tsx:119` | RE-HOMED | Own-cell picker: saves on pick, Undo toast, plus own totem count (S2-7 :44-45) · S2a-2 | Have and the count also write the character record (S2-10, S2a-1a) |
| P-32 | "No one has set their status yet." + Need · Want · Pass | `collections/ParticipantsPanel.tsx:51-71` | RE-HOMED | Blank cells and the own-cell picker (S2-4, S2-7) · S2a-2 | |
| P-33 | Lists by state with "#rank" and "(you)" (G-11) | `collections/ParticipantsPanel.tsx:95-123` | RE-HOMED | Player columns in Board order: job, position, name in role colour (S2-4 :20); rank in the queue (S2-8) · S2a-2 | Replaces Discord handles (§1 :11) |
| P-34 | Each person's token count "{n}t" | `collections/ParticipantsPanel.tsx:124-128` | RE-HOMED | Cell count; viewers see none; a member may hide theirs (S2-7 :46) · S2a-2 | The gate ships in S2a-1b (V1 delta i) |
| P-35 | Source badge "Synced from {source}" | `collections/ParticipantsPanel.tsx:129-135` | RE-HOMED | Cell provenance on hover and focus (S2-7 :47) · S2a-2 | V1 badge unchanged (delta c) |
| P-36 | Drop list: recipient, notes, ×quantity, date; "No drops logged yet." | `collections/DropHistoryPanel.tsx:67-110` | RE-HOMED | The last three drops, week-labelled (S2-9 :63), with "Show all" under them; each drop keeps its notes and ×quantity (Q-1) · S2a-3a | |
| P-37 | Delete a drop (lead any, member own, viewer none) + confirm naming the prior state | `collections/DropHistoryPanel.tsx:49-54,79,97-105,116-124` | RE-HOMED | Undo of a just-logged drop through #329's route (S2-9 :65), plus each listed drop's delete with today's rule and confirm (`DropHistoryPanel.tsx:79`) (Q-1) · S2a-3a | |

## 4. `LogDropModal` (`collections/LogDropModal.tsx`)

| ID | V1 affordance | V1 source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| P-38 | Recipient: Need/Want by rank, else everyone; non-leads only themselves; no viewers | `:29-51,79-85` | RE-HOMED | Lead logs for anyone with #1 preselected, none under `free_roll`; member "I got it", self only (S2-8 :54, S2-9 :64) · S2a-3a | |
| P-39 | "No specific recipient" | `:41` | RE-HOMED | The lead's Log a drop: a "Nobody" choice, which `free_roll` preselects (S2-8 :54) (Q-2) · S2a-3a | "I got it" stays one click |
| P-40 | Hint: the drop sets the recipient to "have" | `:86-90` | RE-HOMED | Behaviour kept; your own drop also writes your character record (S2-9 :64) · S2a-3a | Copy unspecified |
| P-41 | Notes (optional) | `:93-100` | RE-HOMED | The lead's Log a drop: an optional note (Q-2) · S2a-3a | "I got it" takes no note |
| P-42 | Cancel · Log Drop | `:102-109` | RE-HOMED | Inline action with Undo, no modal (S2-9) · S2a-3a | |

## 5. `RewardGoalModal`, field by field (`collections/RewardGoalModal.tsx`): create mode → G-4 (§12.1), edit mode → G-14 (§12.2)

| ID | V1 affordance | V1 source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| P-43 | Title * | `:131-139` | RE-HOMED | Edit's Title; on create, the search text (S2-9 :68, S2-11 :116) · S2a-3a | |
| P-44 | Type (10 options) | `:12-23,142-149` | RE-HOMED | Edit's Type (S2-9 :68) · S2a-3a | |
| P-45 | Status Wanted · Farming · Scheduled; create default Farming | `:25-28,66,150-157` | RE-HOMED | Edit's Status (S2-9 :68) · S2a-3a | A custom track's status: §12.1 |
| P-46 | Status "Complete" | `:29` | RE-HOMED | Mark finished; Reopen sets Farming (S2-5 :32, S2-9 :68) · S2a-3a | |
| P-47 | Content Type (10 options) | `:41-52,161-168` | RE-HOMED | Edit's Content (S2-9 :68) · S2a-3a | 6 of the 10 fail with 422 (§13 D-3) |
| P-48 | Content Key (optional) | `:169-176` | RE-HOMED | Edit's Content (S2-9 :68) · S2a-3a | §12.2: the content field's text half |
| P-49 | Priority Mode (6, none included) | `:32-39,179-186` | RE-HOMED | Edit's Priority mode (S2-9 :68) · S2a-3a | |
| P-50 | Notes (writes `summary`) | `:188-195` | RE-HOMED | Edit's Notes (S2-9 :68) · S2a-3a | Edits `summary`. Edit replaces RewardGoalModal's edit (S2-9 :68), which writes `summary` (`RewardGoalModal.tsx:104`). `note` stays as data and in Copy plan (`CollectionsHub.tsx:54`). |
| P-51 | Cancel · Save Changes / Create Goal | `:197-204` | RE-HOMED | Edit's Save and Cancel; a custom track is created on click (S2-9, S2-11) · S2a-3a | |

## 6. Farms ▸ Suggested (INTERIM, except P-53 and P-57)

| ID | V1 affordance | V1 source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| P-52 | Suggested tab, the default farm view (G-15) | `collections/CollectionsHub.tsx:179-188`; `collections/SuggestedFarmsTab.tsx:120-159` | RE-HOMED INTERIM | Find: "Wanted by your static (n)" first, live from Hub wants (S2-11 :110-111) · S2a-4 | |
| P-53 | Refresh (header, empty state) | `collections/SuggestedFarmsTab.tsx:95-97,131-133` | RETIRED-ACK | — | Find is built live (S2-11 :111) |
| P-54 | Source and privacy notes ("Shared with statics" or higher) | `collections/SuggestedFarmsTab.tsx:123-144` | RE-HOMED INTERIM | Find never shows a private want (S2-11 :111) · S2a-4 | Copy unspecified |
| P-55 | Empty state "No suggestions yet" (G-16) | `collections/SuggestedFarmsTab.tsx:84-100` | RE-HOMED INTERIM | Find's wanted section (S2-11 :110) · S2a-4 | Copy unspecified |
| P-56 | Duty cards: expand, content badge, expansion, Active badge, reward chips, team bar (G-17) | `collections/DutyFarmCard.tsx:100-120,261-343` | RE-HOMED INTERIM | Find rows, one ~56 px row component (S2-11 :110) · S2a-4 | |
| P-57 | "Copy Plan" for an untracked duty (G-17) | `collections/DutyFarmCard.tsx:345-355` | RETIRED-ACK | — | Tracked farms keep Copy plan (P-26) |
| P-58 | Reward row body: members as Owned · Hunting · Interested · Missing · Unknown, count, can-buy mark, "+n more" (G-19) | `collections/DutyFarmCard.tsx:148-217` | RE-HOMED INTERIM | A Find row's body: the member list, with counts gated by B1 (S2-7 :46) · S2a-4 | |
| P-59 | Make Active Farm (leads) (G-18) | `collections/DutyFarmCard.tsx:233-241`; `collections/SuggestedFarmsTab.tsx:46-58` | RE-HOMED INTERIM | Find's Track, seeded from wants, records and plugin (S2-11 :113) · S2a-4 | No-signal members start blank (B5, V1 delta g). Then opens `?track=<id>`, as `CollectionsHub.tsx:184-187` does. |
| P-60 | View Farm, already tracked (G-18) | `collections/DutyFarmCard.tsx:221-231` | RE-HOMED INTERIM | "Tracking ✓", which opens `?track=<id>` (S2-11 :115, S2-9 :60) · S2a-4 | |

## 7. Farms ▸ Catalog and `TrackFromCatalogModal` (INTERIM, except P-72, P-73, P-74 and P-76)

| ID | V1 affordance | V1 source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| P-61 | Browse Catalog tab (G-20) | `collections/CollectionsHub.tsx:189-193`; `collections/CatalogBrowse.tsx:53-324` | RE-HOMED INTERIM | Find's "All farm sources (n)" (S2-11 :110) · S2a-4 | |
| P-62 | Search + clear ✕ | `collections/CatalogBrowse.tsx:168-186` | RE-HOMED INTERIM | Find's search (S2-11 :110) · S2a-4 | |
| P-63 | Category chips with counts: All, Mounts, Music, Trial Minions, Ultimate Weapons, Rare | `collections/CatalogBrowse.tsx:37-43,214-248` | RE-HOMED INTERIM | Find's filter tags, `Tag variant="filter"` (S2-11 :110) · S2a-4 | Tag set unspecified |
| P-64 | Source-type and expansion chips | `collections/CatalogBrowse.tsx:251-294` | RE-HOMED INTERIM | Find's filter tags (S2-11 :110) · S2a-4 | |
| P-65 | "{n} farm sources · {m} rewards · {k} showing" + Clear | `collections/CatalogBrowse.tsx:189-211` | RE-HOMED INTERIM | "All farm sources (n)" (S2-11 :110) · S2a-4 | |
| P-66 | No-match state + Clear filters | `collections/CatalogBrowse.tsx:297-308` | RE-HOMED INTERIM | Find (S2-11) · S2a-4 | Copy unspecified |
| P-67 | Fallback banner (built-in curated farms) + Retry; Track hidden meanwhile | `collections/CatalogBrowse.tsx:145-165,317` | RE-HOMED INTERIM | Find keeps the fallback banner and Retry, and hides Track while the built-in list shows (`CatalogBrowse.tsx:145-165,317`) · S2a-4 | |
| P-68 | Source card: expand, source badge, expansion, reward pills, token pill, Need/Want/Have dots, patch line | `collections/SourceFarmCard.tsx:239-333,405-415` | RE-HOMED INTERIM | A Find source row (S2-11 :110) · S2a-4 | |
| P-69 | Track per reward → TrackFromCatalogModal (G-21) | `collections/SourceFarmCard.tsx:72-90` | RE-HOMED INTERIM | Lead: Track; member: "I want this" (S2-11 :113-114) · S2a-4 | Every role sees it today; the API has refused non-leads since #329 (`backend/app/routers/collection_goals.py:217`) |
| P-70 | "Tracking" badge | `collections/SourceFarmCard.tsx:70-71` | RE-HOMED INTERIM | "Tracking ✓" (S2-11 :115) · S2a-4 | |
| P-71 | Plugin-ready mark per mount | `collections/SourceFarmCard.tsx:65-69` | RE-HOMED INTERIM | A row tag · S2a-4 | |
| P-72 | "Static Members" for tracked rewards: worst state, Plugin/Hub badge, count | `collections/SourceFarmCard.tsx:95-123,372-391` | RE-HOMED | Tracked farms are matrix rows (S2-3, S2-4) · S2a-2 | |
| P-73 | Smart suggestions: Hunting · Suggested · Can buy · Passed · Missing sync (G-23) | `collections/SmartSuggestionsPanel.tsx:49-114`; `SourceFarmCard.tsx:394-402` | RE-HOMED | Cells, provenance and the queue (S2-4, S2-7, S2-8) · S2a-3a | "Can buy": Q-4 |
| P-74 | "Copy plan" for an untracked source | `collections/SourceFarmCard.tsx:416-424` | RETIRED-ACK | — | Tracked farms keep Copy plan (P-26) |
| P-75 | Track modal: name, duty, exchange (G-22) | `collections/TrackFromCatalogModal.tsx:70-82` | RE-HOMED INTERIM | A Find row (S2-11 :110) · S2a-4 | |
| P-76 | Priority mode select, default Everyone gets one | `collections/TrackFromCatalogModal.tsx:28,84-94` | RE-HOMED | Track sets no mode; null queues as Everyone gets one, the modal's default (S2-8 :54; `TrackFromCatalogModal.tsx:28`); change it in Edit (S2-9 :68) · S2a-3a | |
| P-77 | Track this farm · Cancel | `collections/TrackFromCatalogModal.tsx:43-64,96-101` | RE-HOMED INTERIM | Find's Track, one click (S2-11 :113) · S2a-4 | Uses the seeding route, the only one that seeds (S2-11 :113, §5 :182; `collection_goals.py:263-440`). It sends `status: "farming"` (`schemas/collection_goals.py:47`) to match §12.1 and `TrackFromCatalogModal.tsx:49`, then opens `?track=<id>` as `CollectionsHub.tsx:184-187` does. The route sets no linked duty and no note. |

## 8. Objectives (`static-group/ObjectiveGoalsPanel.tsx`)

Mounted by GoalsPage (`group/GoalsPage.tsx:46-48`, V2's default view today) and by Settings (`settings/SettingsPanel.tsx:292-296`). The S2a-2 seam takes GoalsPage out of V2. Until S2a-5a, Settings ▸ Goals & Farms ▸ Objectives hosts both the editor and the members' read (S2-13 :129). The editor then moves whole.

| ID | V1 affordance | V1 source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| P-78 | Objective list: category, priority, title, description, every role (G-2) | `:297-315` | RE-HOMED | Members: Home's "Objectives" card, hidden when there are none (S2-12 :123); leads: Recruit ▸ Listing (S2-13 :127) · S2a-5a | Not D-66's ship marker. D-66 (V1 Home's objectives module, with its empty state and "+N more") is still owed in P2b (`HOME_STRETCH.md:143`). |
| P-79 | Add Static Goal (leads) (ST-27) | `:227-236` | RE-HOMED | A section of Recruit ▸ Listing (`recruit/ListingTab.tsx`) (S2-13 :127) · S2a-5a | |
| P-80 | Form: Category, Priority, Title, Description; Cancel · Save | `:95-151` | RE-HOMED | Moves with the editor (S2-13) · S2a-5a | W4 RECRUIT restyles it |
| P-81 | Edit (pencil); Delete (trash) + ConfirmModal "Remove Objective" | `:316-336,342-354` | RE-HOMED | Moves with the editor (S2-13) · S2a-5a | |
| P-82 | "No objectives set" (+ Add for leads); load error + Retry (ST-28) | `:250-275` | RE-HOMED | Moves with the editor; members' card is hidden instead (S2-12 :123) · S2a-5a | |

## 9. Settings ▸ Goals & Farms (`settings/SettingsPanel.tsx`) and its Add Farm wizard

The whole tab stays in V2, unchanged, until S2a-5a (S2-14 :136). The verdicts give the state after S2a-5a. V1 keeps all of it.

| ID | V1 affordance | V1 source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| P-83 | Tab "Goals & Farms", every role (ST-25) | `:61` | KEPT | Labelled "Suggestions" in V2 by the host, as it sets `hiddenTabs` (`:333-338`) (S2-14 :136) · S2a-5a | Hidden when W4 HOME restores D-70 (B7) |
| P-84 | Sub-nav Overview · Objectives · Farms · Suggestions (`?gsub=`) | `:37,70-75,281-285` | RETIRED-SPEC | V2 keeps only Suggestions (S2-14 :136) · S2a-5a | |
| P-85 | Overview cards Objectives · Active Farms · Open Suggestions + Manage/View links (ST-26) | `:79-138` | RETIRED-SPEC | (S2-14 :136) · S2a-5a | Its Active Farms count omits Wanted (`:89`), unlike S2-5 |
| P-86 | Objectives section (ST-27, ST-28) | `:292-296` | RE-HOMED | §8 (S2-13) · S2a-5a | |
| P-87 | Farms list "Collection Goals": each farm's name and status | `:170-242` | RE-HOMED | Progress's farm rows (S2-5); goal status as the Wanted or Scheduled tag (Q-3) · S2a-5a | S2-5's status column is the have-count, not the goal status |
| P-88 | Each farm's "current/target" | `:226-228` | RETIRED-ACK | — | Q-6 |
| P-89 | New Farm (header), Start Tracking (empty), Add Farm (footer), leads → wizard (ST-29, ST-31) | `:176-185,202-212,243-254,259-263` | RE-HOMED | "Track a farm" opens Find (S2-3 :16, S2-11) · S2a-5a | V2's create path until S2a-4 (S2-3 :16) |
| P-90 | Per-row Delete with no confirm (ST-30) | `:231-240` | RE-HOMED | Row menu Delete with ConfirmModal (S2-9 :68) · S2a-5a | Gains the confirm |
| P-91 | Empty state "No active farms" | `:194-213` | RETIRED-SPEC | The matrix is never empty (S2-14 :136) · S2a-5a | |
| P-92 | Suggestions: Suggest, status filter (ST-33) | `static-group/ContentSuggestionsPanel.tsx:318-335` | KEPT | The Suggestions tab (S2-14 :136) · S2a-5a | Home takes it at W4 HOME (D-70) |
| P-93 | Vote bar (ST-34) | `static-group/ContentSuggestionsPanel.tsx:68-115` | KEPT | Same · S2a-5a | |
| P-94 | Expand, Promote, Close, Delete + PromoteToGoalModal, ConfirmModal (ST-35, ST-37) | `static-group/ContentSuggestionsPanel.tsx:186-223,383-405` | KEPT | Same · S2a-5a | Promote creates an objective; from S2a-5a it is edited in Recruit |
| P-95 | SuggestContentModal: Category, Title, Description (ST-36) | `static-group/SuggestContentModal.tsx:58-88` | KEPT | Same · S2a-5a | |
| P-96 | Wizard step 1, Content type: 7 cards, Next (ST-32) | `static-group/CreateCollectionGoalModal.tsx:23-31,106,245-272` | RE-HOMED | Catalog farms: Find's filter tags (S2-11 :110); custom: Edit's Content (S2-9 :68) · S2a-4 | |
| P-97 | Step 2, Duty: 7 Ultimates + "Other / not listed", or a free-text duty name; Back, Next/Skip; skipped for Other/Custom | `static-group/CreateCollectionGoalModal.tsx:39-47,195,274-336` | RE-HOMED | Catalog: Find's search (S2-11 :110); custom: Edit's Content text (§12.2) · S2a-4 | |
| P-98 | Step 3, Reward type: 10 cards | `static-group/CreateCollectionGoalModal.tsx:49-60,338-368` | RE-HOMED | Custom: Edit's Type (S2-9 :68); catalog: the seeding route takes the item's type (`collection_goals.py:299`) · S2a-4 | |
| P-99 | Step 4, Status: 4 options, default Wanted | `static-group/CreateCollectionGoalModal.tsx:62-67,370-399` | RE-HOMED | Edit's Status; Complete → Mark finished (S2-9 :68) · S2a-3a | |
| P-100 | Step 5, Goal name: suggested, editable | `static-group/CreateCollectionGoalModal.tsx:69-102,404-416` | RE-HOMED | A custom track's title is the search (S2-11 :116); then Edit's Title · S2a-4 | Auto-naming dropped (§12.1) |
| P-101 | Step 5, Target and Current count (Token type only) | `static-group/CreateCollectionGoalModal.tsx:419-435` | RETIRED-ACK | — | Q-6 |
| P-102 | Step 5, "Internal note (optional, lead-only)" | `static-group/CreateCollectionGoalModal.tsx:437-442` | RETIRED-ACK | — | `note` stays as data (P-50). The label is false: `note` is in every member's response (`backend/app/schemas/collection_goals.py:91`) |
| P-103 | Step 5 summary, errors, Back · Cancel · Create Goal; step progress bar | `static-group/CreateCollectionGoalModal.tsx:237-243,444-484` | RE-HOMED | Find's Track or the custom track (S2-11) · S2a-4 | |

## 10. Home's pointers and the Split Planner's entries

| ID | V1 affordance | V1 source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| P-104 | V2 Home TrackCard: the mount-farm store's first trial, "{n} of {m} have it", bar, "Mount farm" tag, no link (V2H-08) | `home/TrackCard.tsx:21-53`; `home/Home.tsx:425` | KEPT | Reworked: reads farm goals, shows the top active farm by S2-5's rule, opens `?tab=progress&track=<id>`, hidden with no active farm; viewers see no count and no "next" (S2-12 :121) · S2a-4 | D-67 ship marker |
| P-105 | O-39: farms empty-state copy, which D-67 returned button-less on the card's empty form (`v1-v2-parity-matrix.md:486`) | V1 `static-group/StaticHomeTab.tsx:1224-1245` | RETIRED-SPEC | The card is hidden when no farm is active (S2-12 :121) · S2a-4 | V1 unchanged |
| P-106 | D-67: V1 Home's Active Farms list (O-38, O-42), absent from V2 | `static-group/StaticHomeTab.tsx:1216-1368` | RE-HOMED | One TrackCard; the full list is Progress (S2-12, F-10) · S2a-4 | V1 unchanged |
| P-107 | D-68: V1 Home's Split Clears card (O-47): "Alts assigned x/y", "{n} need attention", Open Split Planner | `static-group/StaticHomeTab.tsx:1591-1626,1770-1776` | RE-HOMED | A Home split row carrying D-68's two facts, "Alts assigned x/y" and "{n} need attention" (`StaticHomeTab.tsx:1601-1613`). It shows when `splitClearData?.enabled` and opens `?track=tier` (S2-12 :122). F-11 folds D-68's readiness into a row (`v1-v2-parity-matrix.md:488`) · S2a-4 | V1's button lands on Roster (`:1618`, A13); V2's opens the plan |
| P-108 | Roster ▸ Split Planner sub-tab, `?rsub=split-planner` (V1 only, D-18) | `pages/GroupViewContent.tsx:74,749-753,976-984` | RE-HOMED | The tier row's expansion, `?track=tier` (S2-6 :41) · S2a-3b | D-18 ship marker |
| P-109 | More ▸ Split Planner quick action (classic shell only) | `pages/GroupViewContent.tsx:1195-1201` | RE-HOMED | Same · S2a-3b | |
| P-110 | Split Planner body: board, draft review, run panel, reset | `split-clear/SplitClearPlanner.tsx:23-217` | RE-HOMED | Moved unchanged into the tier row (S2-6 :41) · S2a-3b | GET filtered to the active tier (V1 delta f) |
| P-111 | Split planning off: "Enable split planning" for leads, nothing for members | `split-clear/SplitClearPlanner.tsx:29-62` | RE-HOMED | Lead sees "Turn on split clears"; a member gets no expand control (S2-6 :41) · S2a-3b | |

## 11. Code S2a-5b deletes (S2-14 :137-143)

| File | Lines | Importers at `b70d24bb` (grep of `frontend/src`, `frontend/e2e`) | Orphaned? |
|---|---|---|---|
| `mount-farms/index.ts` | 1 | none | yes |
| `mount-farms/MountFarmTab.tsx` | 616 | `mount-farms/index.ts:1` only | yes |
| `mount-farms/MountFarmSummary.tsx` | 160 | `MountFarmTab.tsx:8`; `gamedata/mount-farms.test.ts:14` | yes (the test changes) |
| `mount-farms/MountFarmDetail.tsx` | 260 | `MountFarmSummary.tsx:6` | yes |
| `mount-farms/FarmProgress.tsx` | 130 | `MountFarmDetail.tsx:11`; `MountFarmSummary.tsx:7`; `profile/CollectionsTab.tsx:25` | yes |
| `mount-farms/farmProgressUtils.ts` | 22 | `FarmProgress.tsx:13`; `profile/CollectionsTab.tsx:29` | yes |
| `profile/CollectionsTab.tsx` + test | 499 + 99 | its test only (`CollectionsTab.test.tsx:7`) | yes |
| `collections/CatalogFarmRow.tsx` | 290 | none | yes |
| `collections/SuggestionFarmCard.tsx` | 271 | none | yes |
| `static-group/ObjectiveCommandCenter.tsx` + test | 279 + 238 | its test only (`ObjectiveCommandCenter.test.tsx:7`) | yes |
| **Total** | **2,865** | the tree is 1,189 | matches S2-14 :137-140 exactly |

`gamedata/mount-farms.test.ts` (256 lines) is edited, not deleted: its import (`:14`) and its two `MountFarmSummary` tests (`:188-255`) go. Non-import references the deletion must also clear: `frontend/eslint-suppressions.json:52-56` (CollectionsTab's entry) and `frontend/README.md:48` (lists the tree). Deleting ObjectiveCommandCenter orphans `stores/objectiveCommandStore.ts`. S2a-5b deletes it unless P2b's D-66 has adopted it by then. This brings forward the F3 knip sweep that `HOME_STRETCH.md:219` names for the store, and that sweep's item closes with it. `StaticHomeTab.tsx:1442` is a V1 file, so its comment stays (criterion 11). These comments name the deleted files: `home/TrackCard.tsx:10`, `home/Home.tsx:17-19`, `home/StaticActivityFeed.tsx:14`, `collections/SourceFarmCard.tsx:4`, `utils/collectionBadgeConfig.ts:6`, `static-group/StaticHomeTab.tsx:1442`. `knip.json` names none of them. None of the deleted files is reachable in either shell, so retiring them removes nothing a user can reach. G-27 is the exception the spec calls out (§12 A9).

| ID | V1 affordance | V1 source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| P-112 | G-24: static-wide / My Progress view toggle (`?mf=`) | `mount-farms/MountFarmTab.tsx:61-62,319-339` | RETIRED-SPEC | Deleted (S2-14 :138) · S2a-5b | |
| P-113 | G-24: expansion tabs and completion bar | `mount-farms/MountFarmTab.tsx:343-374,407-418` | RETIRED-SPEC | Deleted (S2-14 :138) · S2a-5b | |
| P-114 | G-24: My Progress cards Rewards Obtained · Wanted · Ready · Last Sync | `mount-farms/MountFarmTab.tsx:376-385` | RETIRED-SPEC | Deleted (S2-14 :138) · S2a-5b | |
| P-115 | G-24: filters All · Needs reward · Wanted · Can buy · Complete; no-match + Clear filter | `mount-farms/MountFarmTab.tsx:170-176,386-445` | RETIRED-SPEC | Deleted (S2-14 :138) · S2a-5b | |
| P-116 | G-24: Needs attention; Recent Activity (collapsible) | `mount-farms/MountFarmTab.tsx:459-465,506-616` | RETIRED-SPEC | Deleted (S2-14 :138) · S2a-5b | |
| P-117 | G-25: "Best next farm" + Schedule / Schedule Farm (leads) | `mount-farms/MountFarmTab.tsx:281-315` | RETIRED-SPEC | Deleted (S2-14 :138) · S2a-5b | Nearest live analogues, not ports: Find's footer line (S2-11 :117), Schedule a farm night (S2-9 :67) |
| P-118 | G-26: per-trial rows (expand) + Schedule icon | `mount-farms/MountFarmSummary.tsx:44-160` | RETIRED-SPEC | Deleted (S2-14 :138) · S2a-5b | |
| P-119 | G-27: each member's Has and Wants checkboxes and currency count; a lead edits any row, a member their own | `mount-farms/MountFarmDetail.tsx:64-85,160-250` | RE-HOMED | The lead's Edit statuses plus the member's own cell with totem count (S2-7 :48) · S2a-2 | Owner signs before S2a-5b (§15) |
| P-120 | G-27: source badge (plugin/manual, sync time), manual-override marker | `mount-farms/MountFarmDetail.tsx:30-54,180-188` | RE-HOMED | Cell provenance (S2-7 :47) · S2a-2 | |
| P-121 | G-28: plugin onboarding banner (dismissible, README link), sync-status strip | `mount-farms/MountFarmTab.tsx:87-95,180-260` | RETIRED-SPEC | Deleted (S2-14 :138) · S2a-5b | |
| P-122 | Profile `CollectionsTab`: Owned · Wanted · Can buy · Farming metrics, sort, Owned/Want checkboxes, dismiss | `profile/CollectionsTab.tsx:127-499` | RETIRED-SPEC | Deleted (S2-14 :139) · S2a-5b | V1 Profile ▸ Collections is `CollectionsCenterTab` (`pages/Profile.tsx:517`), untouched |
| P-123 | `CatalogFarmRow`: per-reward row, expand, Track | `collections/CatalogFarmRow.tsx:49-290` | RETIRED-SPEC | Deleted (S2-14 :140) · S2a-5b | Superseded by SourceFarmCard (`SourceFarmCard.tsx:4`) |
| P-124 | `SuggestionFarmCard`: Make Active Farm, View Farm, Copy Plan | `collections/SuggestionFarmCard.tsx:125-271` | RETIRED-SPEC | Deleted (S2-14 :140) · S2a-5b | Superseded by DutyFarmCard |
| P-125 | `ObjectiveCommandCenter`: per-objective cards, next action → Roster, Schedule, `goals`/`farms` | `static-group/ObjectiveCommandCenter.tsx:71-95,225-279` | RETIRED-SPEC | Deleted (S2-14 :140) · S2a-5b | |

## 12. G-4 and G-14: designs, signed 2026-10-01 (S2-9 :68, S2-11 :116, §8 :267)

### 12.1 G-4 · Track a custom farm (replaces "Custom Goal" and RewardGoalModal's create mode)
- **Slice:** S2a-4, with Find.
- **Who:** leads (owner and lead; admins through owner access). Members and viewers never see the row: it is hidden, not disabled (ROLE-1). The server already refuses non-leads (`backend/app/routers/collection_goals.py:217`).
- **What the lead sees:** in Find (`?pview=find`), the last row of the ranked list reads `Track "{search}" as a custom farm` (S2-11 :116). With an empty search the row stays, disabled, and reads "Type a name to track a custom farm".
- **On click:** the existing create route (`POST …/collection-goals`, `:205-217`) makes the track. Title is the trimmed search (1–200 characters, `backend/app/schemas/collection_goals.py:30`). The search input caps at 200 characters, so the click never sends a title the API rejects. Type is Custom reward, status is Farming (RewardGoalModal's create default, `RewardGoalModal.tsx:66`), and content, priority mode, notes and catalog item are all empty. A null mode queues as Everyone gets one (S2-8 :54). No participant rows are seeded, so every cell starts blank (B5). Progress then switches to Tracks and opens the new row (`?track=<id>`) in Edit (§12.2), with Title focused. A toast confirms it. To remove the track, use Delete in the row menu.
- **RewardGoalModal (create) coverage:** Title comes from the search. Type, Status, Content Type, Content Key, Priority Mode and Notes are set in Edit right after (P-43…P-51). The click replaces Create Goal; Cancel is simply not clicking. It also replaces the Custom Goal CTA in the Active-tab empty state (P-16). From S2a-5a it replaces Settings' Add Farm for farms outside the catalog (P-89).
- **Dropped:** the modal; filling in fields before the track exists; the wizard's auto-name (`CreateCollectionGoalModal.tsx:83-102`).
- [x] Owner sign-off (G-4) — date: 2026-10-01

### 12.2 G-14 · Inline Edit, Mark finished and Reopen (replaces RewardGoalModal's edit mode)
- **Slice:** S2a-3a, stacked on S2a-2; the two merge together (§4 :166).
- **Who:** leads. Members and viewers see no row menu.
- **Where:** an active farm row's menu holds Edit · Mark finished · Delete (S2-9 :68). A finished row, under "Finished (n)", holds Reopen · Delete (S2-5 :32). A finished row expands like any farm row (who has it, drops, Copy plan), with no Log a drop (as `RewardGoalCard.tsx:192`).
- **Edit:** opens that row's expansion, closing any other (S2-9 :60), with an edit block at the top. The queue, drops and actions stay below it. Save goes through the update route (`PUT …/collection-goals/{id}`, `collection_goals.py:443-473`) and shows a toast. Escape cancels. There is no modal.

| RewardGoalModal field | Edit control | Change |
|---|---|---|
| Title `:131-139` | Input, required | Save stays disabled while it is blank (as `:201`) |
| Type `:142-149` | Select, the same 10 (`:12-23`) | none |
| Status `:150-157` | Select Wanted · Farming · Scheduled | Complete becomes Mark finished |
| Content Type `:161-168` | Select: None + the server's 7 (`backend/app/schemas/collection_goals.py:12-15`), labelled as `CreateCollectionGoalModal.tsx:23-31` | Drops the 6 options the API rejects with 422 (`RewardGoalModal.tsx:45-48,50-51`) |
| Content Key `:169-176` | Input "Duty or key (optional)", ≤ 50 characters (`schemas/collection_goals.py:29`) | Same field (the wizard stores the duty name there, `CreateCollectionGoalModal.tsx:170`) |
| Priority Mode `:179-186` | Select, the same 6 | A help line says what each does to the queue (S2-8 :54) |
| Notes `:188-195` | Input, writes `summary` | `note` untouched |
| Cancel · Save Changes `:197-204` | Cancel · Save | none |

- **Mark finished:** sets `complete`, and the server stamps `completed_at` (`collection_goals.py:461-462`). The row moves to "Finished (n)". There is no confirm, because Reopen undoes it. The same action is offered as "Everyone has it · Mark finished" (S2-5 :32).
- **Reopen:** sets `farming` (S2-5 :32), and the server clears `completed_at` (`:463-464`).
- **Dropped:** the modal; Complete as a status choice; six content types that cannot save today.
- [x] Owner sign-off (G-14) — date: 2026-10-01

## 13. Spec discrepancies (recorded; only D-6 is fixed in the spec, in this PR)

- **D-1** §1 :11 says V2 reaches Tracking "only through ⌘K, a number key or the phone bar", and S2-15 :147 names only `MobileBottomNav`. Code has three more paths: the phone swipe (`pages/GroupViewContent.tsx:178-191,733`), URLs and the recalled tab (`hooks/useGroupViewState.ts:30-40,205-209`), and the `suggestion_vote` notification (`backend/app/routers/content_suggestions.py:371`).
- **D-2** S2-14 :136 and §8 :256 cite Add Farm as `SettingsPanel.tsx:246-259`. The button is `:243-254` and the modal mount is `:259-263`. The empty state's Start Tracking (`:202-212`) is a third opener the cite leaves out.
- **D-3** S2-9 :68 lists Edit's "content" without a value set. RewardGoalModal offers 10 content types (`:41-52`); the API rejects 6 of them (`backend/app/schemas/collection_goals.py:12-15`), and the modal's cast (`:102`) hides that from the type checker. §12.2 proposes the server's 7.
- **D-4** S2-9 :68 says "notes", but a goal has two text fields, `summary` and `note` (`backend/app/models/collection_goal.py:51,69`). RewardGoalModal edits `summary`; the wizard and catalog Track write `note`. Settled by P-50: Edit writes `summary`.
- **D-5** §4 :170 sends `?goal=objectives` to Recruit ▸ Listing or Home with no date. Recruit gets the editor only in S2a-5a, but the seam is live from S2a-2. Settled by P-07: until S2a-5a the link lands on Progress.
- **D-6** §4 :168 and §8 :254 date only "Catalog Track and Suggested". The S2a-2 seam takes the whole Catalog tab out of V2, so its browsing, search, filters and fallback rows are INTERIM too (P-61…P-71, P-75). Fixed in the spec in this PR.
- **D-7 (minor)** The ParticipantsPanel cites `:124-126` and `:129-132` stop short of `:124-128` and `:129-135`. Outside the spec, the repo matrix §6 cites the goals mount as `GroupViewContent.tsx:1140-1152`; it is now `:1160-1172`.
- **Confirmed:** ≈2,865 is exact; every "orphaned" claim holds; `CollectionsTab.tsx:25,29` and `mount-farms.test.ts:14` are right; `RewardGoalModal.tsx:25-29,66,124-206` and `CreateCollectionGoalModal.tsx:106` are right.

## 14. Owner questions (answered 2026-10-01: every recommendation accepted)

- **Q-1 Older drops (P-36, P-37).** The spec shows the last three plus Undo. *Rec:* a "Show all" under them, as the queue has. Each drop keeps its notes, ×quantity and delete (lead any, member own, viewer none: today's rule, `DropHistoryPanel.tsx:79`) with today's confirm.
- **Q-2 Log a drop: no recipient, notes (P-39, P-41).** *Rec:* keep both in the lead's Log a drop: a "Nobody" choice (what `free_roll` preselects, S2-8 :54) and an optional note. "I got it" stays one click, with no note.
- **Q-3 What a farm row shows besides its name (P-19, P-23, P-27, P-87).** *Rec:* the row reads "{title} · {type}", the pattern S2-12 gives TrackCard, with a Wanted or Scheduled tag when the farm isn't Farming. The expansion shows content, priority mode and notes, read-only, to every role.
- **Q-4 Aggregates and can-buy marks (P-15, P-21's badge, P-58's mark, P-73's list).** *Rec:* RETIRED-ACK. The status column, "Finished (n)" and cells such as "Need 99/99" carry them. Copy plan keeps its "Can buy now" line (`CollectionsHub.tsx:50-51`).
- **Q-6 A static-wide target/current count (P-88, P-101).** *Rec:* RETIRED-ACK in V2, because per-player counts replace it (S2-7). The columns stay, and V1 keeps showing them.
- **Q-8 Find retirements (P-53, P-57, P-74).** *Rec:* Refresh and Copy plan for untracked farms are RETIRED-ACK. Tracked farms keep Copy plan (P-26).

Q-5, Q-7 and Q-9…Q-12 were already answered by the spec or the code; the director's vet folded each answer into its rows (F-1: P-01, P-07, P-09, P-10, P-50, P-58, P-59, P-60, P-67, P-71, P-76, P-77, P-107). The remaining numbers keep their IDs.

## 15. Owner sign-off list

- [x] G-4 custom track, §12.1 (P-14, P-43, P-51) — date: 2026-10-01
- [x] G-14 inline Edit, Mark finished, Reopen, §12.2 (P-28, P-43…P-51) — date: 2026-10-01
- [x] G-27 port (P-119, P-120), signed before S2a-5b deletes `MountFarmDetail` (§12 A9) — date: 2026-10-01
- [x] Sweep: S2a-5b deletes the rest of §11 (P-112…P-118, P-121…P-125; 2,865 lines; §12 A9 "ask before sweeping") — date: 2026-10-01
- [x] §14 answers Q-1, Q-2, Q-3, Q-4, Q-6, Q-8, as recommended or as amended in place — date: 2026-10-01

INTERIM rows: out of V2 from the S2a-2 merge (filled in by the merging PR) to the S2a-4 merge (filled in by the merging PR), reached through the classic view meanwhile.
- [x] P-52 Suggested tab
- [x] P-54 Suggested source and privacy notes
- [x] P-55 Suggested empty state
- [x] P-56 Duty cards
- [x] P-58 Reward row body
- [x] P-59 Make Active Farm
- [x] P-60 View Farm
- [x] P-61 Browse Catalog tab
- [x] P-62 Catalog search
- [x] P-63 Category chips
- [x] P-64 Source-type and expansion chips
- [x] P-65 Result line + Clear
- [x] P-66 No-match state
- [x] P-67 Fallback banner + Retry
- [x] P-68 Source card
- [x] P-69 Catalog Track
- [x] P-70 "Tracking" badge
- [x] P-71 Plugin-ready mark
- [x] P-75 Track modal summary
- [x] P-77 Track this farm

RETIRED-ACK rows (accepted 2026-10-01; each follows its question):
- [x] P-15 Stats strip (Q-4)
- [x] P-21 "Can buy" badge only (Q-4)
- [x] P-53 Suggested Refresh (Q-8)
- [x] P-57 Copy Plan, untracked duty (Q-8)
- [x] P-74 Copy plan, untracked source (Q-8)
- [x] P-88 Settings "current/target" (Q-6)
- [x] P-101 Wizard Target/Current count (Q-6)
- [x] P-102 Wizard Internal note (`note` stays as data; P-50)

## 16. Summary

| Verdict | Rows | of which OPEN — owner | of which INTERIM |
|---|---|---|---|
| KEPT | 15 | 0 | 0 |
| RE-HOMED | 85 | 0 (P-19, P-23, P-27, P-36, P-37, P-39, P-41, P-87 answered 2026-10-01) | 20 |
| RETIRED-SPEC | 18 | 0 | 0 |
| RETIRED-ACK | 7 (plus P-21's badge) | 0 (each signed in §15) | 0 |
| DEFERRED | 0 | — | — |
| **Total** | **125** (P-01…P-125) | **0** | **20** |

DEFERRED is empty. What S2a leaves for other waves sits in the Notes column: W4 HOME's D-70 hand-off of Suggestions (P-83, P-92), W1's key 5 (P-02) and S2c's removal of the phone bar (P-03, P-04).

| Slice where the V2 home ships | Rows |
|---|---|
| S2a-1a · S2a-1b (backend) | 0: their V1-visible effects are spec §7's deltas (a), (b), (g)–(j), noted on P-31, P-34, P-59 |
| S2a-2 | 26 |
| S2a-3a | 28 |
| S2a-3b | 4 |
| S2a-4 | 30 |
| S2a-5a | 18 |
| S2a-5b | 12 |
| No V2 home (the RETIRED-ACK rows) | 7 |
| **Total** | **125** |

## Change log

- 2026-10-01 · director vet APPROVE-WITH-FOLDS; F-1…F-9 applied; ⌘K relabel moved to S2a-2 (controller)
- 2026-10-01 · owner sign-off: every §15 box ticked, Q-1/Q-2/Q-3/Q-4/Q-6/Q-8 as recommended; the 8 OPEN rows resolved in place
