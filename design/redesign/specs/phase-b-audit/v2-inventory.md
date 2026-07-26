# V2 Shell Affordance Inventory (Phase B) — agent report, persisted verbatim

Mount path confirmed: `frontend/src/pages/NewShell.tsx` → `ShellContent()` builds `overview`/`roster`/`gear`/`schedule` slots (NewShell.tsx:60-117) and passes them into `<GroupViewContent slots={...}>` (NewShell.tsx:161-165); `GroupViewContent.tsx` renders `slots?.[mode] ?? <legacy body>` per tab (GroupViewContent.tsx:900,940,977,1087) — `goals`/`more`/`plugin` tabs and the mobile bottom nav have **no slot check** and render the same body/component in both shells (GroupViewContent.tsx:1140-1245).

## V2 Home (`components/home/**`, slot: `overview`)

| ID | Affordance | Where (file:line) | Interaction & what it does | Permission notes |
|---|---|---|---|---|
| V2H-01 | "This week" page header, dynamic subtitle | `frontend/src/components/home/Home.tsx:152-183,276` | Subtitle assembles next-session day/time · floors-left-to-clear · "loot logged through {day}" from schedule/loot store state; no interaction | none |
| V2H-02 | Hero next-session card / RSVP strip | `frontend/src/components/home/Home.tsx:256-272,280`; `frontend/src/components/ui/SessionRsvpCard.tsx:1-270` | Shows next upcoming session (day/time/tz, RSVP avatar stack, N-in/M-tentative counts) with a 3-button RSVP strip ("I'm in" / "Tentative" / "Can't make it") wired to `submitRsvp`; if no session, renders `EmptyStateInvite` with an "Add session" CTA that navigates to Schedule | RSVP strip renders regardless of role; button click calls `submitRsvp` unconditionally (no `canManage` gate observed here) |
| V2H-03 | "This week's loot" summary card | `frontend/src/components/home/WeeklyLootSummaryCard.tsx:37-82` | Per-fight cleared/drop-count bars (from `useWeeklyLootSummary`) + "Log this week's loot" primary button → `onNavigate('gear')` (opens v2 Loot) | none (button always visible; no canEdit prop) |
| V2H-04 | Roster readiness card | `frontend/src/components/home/RosterReadinessCard.tsx:37-74` | Display-only: avg iLvl / % BiS / raider-count stat strip, one "BiS complete" progress bar, "N/M BiS slots obtained · K need setup" footer | display only |
| V2H-05 | "Needs your attention" list | `frontend/src/components/home/Home.tsx:187-254,290-310` | Up to 3 rows each for: (a) claimed raiders missing BiS → "Import BiS" button (`onNavigate('roster')`); (b) unclaimed configured seats → "Assign" button (manage-only, `onNavigate('roster')`); (c) pending join requests → "Review" button (manage-only, `onOpenRequests`). Empty → "You're all caught up" | (b) and (c) rows/actions gated on `canManage`; (a) shown to everyone |
| V2H-06 | BiS-by-role card | `frontend/src/components/home/RoleBisCard.tsx:38-72` | Display-only: one role-colored progress bar per role (Tanks/Healers/Melee/Ranged/Caster) with obtained/total, plus a gear-source legend (`ProgressBarLegend`) | display only |
| V2H-07 | Recent activity feed | `frontend/src/components/home/StaticActivityFeed.tsx:56-100` | Merges mount-farm + loot + material activity (privacy-filtered via `deriveActivityItems`/`deriveLootActivityItems`), sorted by recency, top 5 rows with source-icon badge + relative time; no click targets; empty → "No recent activity yet" | display only (privacy filter honors `user.activityDisplayMode`) |
| V2H-08 | Track card (mount farm) | `frontend/src/components/home/TrackCard.tsx:21-56` | Display-only: lead non-flagship track name, "N of M have it" + a "Ring 3" `Tag` badge, progress bar. Renders nothing if no track data. No click target (detail view deferred) | display only |
| V2H-09 | Mount-loading data fetches | `frontend/src/components/home/Home.tsx:101-135` | On mount (membership-gated): fetches sessions, mount-farm progress, loot log + page ledger (Promise.all, one error toast on failure), material log (swallowed on failure); join-requests fetched only when `canManage` | fetch gated on `group.userRole` (membership) / `canManage` for join-requests |
| V2H-10 | "Schedule farm" cross-nav (via `StaticHomeTab`, legacy Overview only) | N/A — **not present in v2 Home** (`Home.tsx` has no `onScheduleFarm` prop; compare legacy `GroupViewContent.tsx:914-932`) | — | — |

## V2 Roster (`components/roster/**`, slot: `roster`)

| ID | Affordance | Where (file:line) | Interaction & what it does | Permission notes |
|---|---|---|---|---|
| V2R-01 | Cards ⇄ Board segmented toggle | `frontend/src/components/roster/RosterToolbar.tsx:23-26,65-70`; URL-backed via `rview` in `Roster.tsx:148` | Switches the whole roster body between the card grid and the gear-matrix table | always available |
| V2R-02 | Grouping dropdown (Standard comp / Light Party) | `frontend/src/components/roster/RosterToolbar.tsx:74-84` | Cards-only dropdown toggling `groupView` (flat grid vs G1/G2/Unassigned sections) | Cards view only; not gated by role |
| V2R-03 | "Show subs" toggle | `frontend/src/components/roster/RosterToolbar.tsx:86-93` | Cards-only chip, shown only when substitutes exist; toggles `subsHidden` (persisted `roster-hide-subs`) | Cards view only |
| V2R-04 | "Reorder" toggle button | `frontend/src/components/roster/RosterToolbar.tsx:99-110` | Toggles drag-to-reorder mode on the card grid; `disabled={!canManage}` | `canManage` (roster-manage) |
| V2R-05 | "Add player" button | `frontend/src/components/roster/RosterToolbar.tsx:112-120`; wired via shared `AddPlayerModal` flow, `Roster.tsx:385,414` | Opens the shared add-player modal (creates + configures atomically); `disabled={!canManage}` | `canManage` |
| V2R-06 | "Manage characters" button | `frontend/src/components/roster/CharacterManageBridge.tsx:15-35`; header action in `Roster.tsx:393-399` | Opens a Modal hosting `RosterCharacterPanel` (character registry, bridge component pending Person-layer rehome) | `canEdit` passed through to the panel |
| V2R-07 | Party-grouped sections (G1/G2/Unassigned/Substitutes) with aggregate BiS bar | `frontend/src/components/roster/RosterCards.tsx:224-248,361-416` | Header row per party: tag + label + aggregate obtained/total BiS progress bar (omitted for Substitutes) | display; grouping controlled by V2R-02 |
| V2R-08 | Open-seat "Configure" inline form | `frontend/src/components/roster/OpenSeatCard.tsx:100-126` | Name input + `JobPicker`; Save disabled until name+job set; submits via `onConfigurePlayer(seatId, name, job, roleFromJob)` | gated `canManage` |
| V2R-09 | Open-seat "Remove" | `frontend/src/components/roster/OpenSeatCard.tsx:88-98` | Direct remove (no confirm) of that exact seat id, bound per-seat via `actionsForPlayer(player).onRemove` | gated `canManage` |
| V2R-10 | Player card inline rename | `frontend/src/components/roster/RosterCard.tsx:191-221,334-342` | Double-click name → inline `Input`; Enter commits, Escape cancels | gated `canEdit` (per-player `canEditPlayer`) |
| V2R-11 | Tank-role / Position inline selectors | `frontend/src/components/roster/RosterCard.tsx:344-362` | `TankRoleSelector` (tank role only) and `PositionSelector` render inline on every card, calling `actions.onUpdate` | each selector applies its own internal permission check |
| V2R-12 | "Change job" icon button + inline `JobPicker` popover | `frontend/src/components/roster/RosterCard.tsx:364-383` | Opens an inline job-picker dropdown; picking a different job opens the job-change confirm modal | shown only `canEdit` |
| V2R-13 | Job-change confirm modal (keep/unlink BiS) | `frontend/src/components/roster/RosterCard.tsx:450-496` | Radio choice "Keep current BiS setup" vs "Unlink BiS on change" before committing `{job, role, bisLink?}` | reachable only via V2R-12 |
| V2R-14 | Kebab menu (⋮ / right-click) — full action set | `frontend/src/components/roster/RosterCard.tsx:311,393-399,498-505`; items built in `frontend/src/hooks/useRosterCardActions.tsx:172-357` | Opens via icon button or right-click context menu. Sections: **BiS & Gear** — Import/Update BiS, Unlink BiS (if linked), BiS Targets, Weapon Priorities, Track/Stop Tracking Tome Weapon, Reset Gear (3-mode radio: progress-only / unlink-BiS / everything). **Player Management** — Take Ownership, Release Ownership/Unlink User, Flex Roles, Mark as Sub/Main, Assign User (owner) / Assign User (Admin). **Clipboard** — Copy, Copy URL, Paste (disabled w/o clipboard), Duplicate. **Danger Zone** — Remove Player (confirm modal) | each item individually gated (`editPermission`/`rosterPermission`/`resetPermission`/`isAdminAccess`/claim-visibility booleans) — see `useRosterCardActions.tsx:406-425` |
| V2R-15 | Gear pip strip (read-only) | `frontend/src/components/roster/RosterCard.tsx:419-431` | 11-slot `GearStatusCircle` row rendered `disabled` with a no-op `onChange` — display only on the card | not editable from Cards (Board is the edit surface) |
| V2R-16 | BiS progress line + inline status CTA | `frontend/src/components/roster/RosterCard.tsx:277-306,404-416` | Progress bar + "no BiS"/"needs N"/"BiS set" text; inline "Assign" (unclaimed+canManage) or "Import" (no BiS+canEdit) button reuses the kebab's own action | see gating above |
| V2R-17 | Character sync status line | `frontend/src/components/roster/RosterCard.tsx:252-260,434-441` | "Linked · synced Xm ago" / "Linked" / "Not synced" derived from `lastSync`/Lodestone identity; display only | display only |
| V2R-18 | Drag-to-reorder (cross-group swap/insert) | `frontend/src/components/roster/RosterCards.tsx:59-216,349-357` | When Reorder mode is on, cards become dnd-kit draggable/droppable with swap/insert-before/after visual feedback; suppressed while any card modal is open | per-card droppable/draggable `disabled={!canManage}` |
| V2R-19 | Deep-link highlight + scroll (`?player=`) | `frontend/src/components/roster/Roster.tsx:247-285`; anchors in `RosterCards.tsx:304,338` | Highlights and (via the shared `GroupViewContent` effect) scrolls to the matching card; auto-clears after 2.5s | none |
| V2R-20 | "Copy URL" deep-link | `frontend/src/components/roster/Roster.tsx:291-299` | Also reachable via kebab "Copy URL" (V2R-14); writes a `?tab=roster&player=` link to clipboard | none |
| V2R-21 | Board view: gear matrix table | `frontend/src/components/roster/GearBoard.tsx:81-201` | Party-grouped rows × 11 slot columns + BiS summary column; sticky header; clicking a cell cycles obtained/augmented state via the shared gear state machine | per-row edit gated by V2R-22 |
| V2R-22 | Board per-row gear-edit gate | `frontend/src/components/roster/GearBoard.tsx:47-61,146-176` | Editability computed per player row via `canEditGear(userRole, player, currentUserId, isAdminAccess)` — owner/lead/admin rows all editable; a member's own claimed row is editable; other rows/viewers are inert | replaces a screen-wide gate; see file-head comment |
| V2R-23 | Board next-upgrade priority glyph (●) | `frontend/src/components/roster/GearBoardCell.tsx:76-93`; computed in `Roster.tsx:205-213` via `computeNextUpgradePriorities` | Needed cells that are the player's next Loot-queue upgrade render a dashed, role-colored "●" instead of the plain need dot — agrees live with the Loot priority queues (same loot log + real clock week) | Board view only |
| V2R-24 | Gear-source legend | `frontend/src/components/roster/Roster.tsx:73-79,452-454` | Footer legend: raid(R)/tome(T)/augmented(A)/empty swatches + "● next upgrade" swatch (Board); default `ProgressBarLegend` on Cards | display only |

## V2 Loot (`components/loot/**`, slot: `gear`, screen title "Loot")

| ID | Affordance | Where (file:line) | Interaction & what it does | Permission notes |
|---|---|---|---|---|
| V2L-01 | Priority ⇄ History segmented toggle | `frontend/src/components/loot/Loot.tsx:171,349-361`; `LootToolbar.tsx:14-16,39-40` | URL-backed (`lview`), default **`priority`**. NOTE: the default "Priority" view is **not** the legacy `WhoNeedsItMatrix` component — it is per-floor `FloorCard` ranked queues (see V2L-08); `WhoNeedsItMatrix` (`frontend/src/components/loot/WhoNeedsItMatrix.tsx`) is imported only by the legacy `LootPriorityPanel.tsx:29,715` and does not appear in the v2 tree | none |
| V2L-02 | Week-scope pill (Priority view) | `frontend/src/components/loot/WeekScopeControl.tsx:81-131` | Dropdown of weeks (with date range + loot/books/mats type dots) to view; separate from the real clock | editors (`canEdit`) additionally see the mutation items below |
| V2L-03 | "Start next week" / "Revert week" | `frontend/src/components/loot/WeekScopeControl.tsx:57-79,115-129,133-151` | Advances/reverts the shared week clock via confirm modals ("Advance the week clock…" / "Move the clock back…") | `canEdit`; Revert disabled at Week 1 |
| V2L-04 | History filters (Week / Player / Source pills) | `frontend/src/components/loot/HistoryFilters.tsx:33-97` | Three independent dropdown filters shown in the History view's toolbar slot | none |
| V2L-05 | Reset menu (History-only) | `frontend/src/components/loot/LootResetMenu.tsx:26-61` | Ghost dropdown: Reset week loot / week books / week data, and (separator) Reset ALL loot / ALL books / ALL data — routes to a `ResetConfirmModal` (type-to-confirm) | `canEdit` (menu only rendered then) |
| V2L-06 | "Adjustments" toolbar button | `frontend/src/components/loot/Loot.tsx:384-388,525-530`; `LootAdjustmentsModal.tsx` | Opens a per-player modal combining `lootAdjustment` (fair-share weight) + `priorityModifier` (flat score offset) into one editable table, saved via `Promise.allSettled` | `canEdit`-gated cluster |
| V2L-07 | "Rules" toolbar button | `frontend/src/components/loot/Loot.tsx:230-232,388` | Opens Settings ▸ Priority tab (`useSettingsPanelStore.open({tab:'priority'})`) | `canEdit`-gated cluster |
| V2L-08 | Per-floor `FloorCard` (Priority view) | `frontend/src/components/loot/FloorCard.tsx:50-157` | 4 cards (Floor 4→1): header shows floor name/number, cleared/in-progress + drop labels, pending/logged chip; body lists gear rows then material rows, each a ranked recipient queue (`PriorityRow`); auto-collapses when the scoped week is fully logged ("Show" re-expands); weapon-priority bridge sits in the Floor 4 footer | header/body display; Assign buttons below gated `canEdit` |
| V2L-09 | Floor-row "Assign" button | `frontend/src/components/loot/FloorDropRow.tsx:30-60` | Opens `RecipientPicker` in `mode="assign"`, fixed to that gear slot / material | `canEdit` (button only rendered then); material row additionally disabled if roster is empty |
| V2L-10 | "Log a drop" toolbar button | `frontend/src/components/loot/Loot.tsx:385,469-492` | Opens `RecipientPicker` in `mode="log"` — free-form fight+slot selectors, not fixed to a floor row | `canEdit`-gated cluster |
| V2L-11 | RecipientPicker (assign/log/edit) | `frontend/src/components/loot/RecipientPicker.tsx:1-260+` | Unified modal: scope toggle (By priority / All members / Off-spec-free), search, ranked recipient list (radio rows), method (drop/tome/purchase/book), week, "extra/free" checkbox, notes, character-registration auto-pick; submits via `logLootAndUpdateGear`/`updateLootAndSyncGear` | reachable only from `canEdit` affordances (V2L-09/10/edit) |
| V2L-12 | "Log this week's loot" toolbar button | `frontend/src/components/loot/Loot.tsx:386,494-507` | Opens the shared `LogWeekWizard` (multi-item, week-scoped batch logger) | `canEdit`-gated cluster |
| V2L-13 | Weapon Priorities bridge | `frontend/src/components/loot/WeaponPriorityBridge.tsx:24-97` | Collapsible "Weapon priorities" link under the Floor-4 card; expands the legacy `WeaponPriorityList` (per-job funneling, ties/rolls) with per-row "Log" buttons opening `QuickLogWeaponModal` | log buttons gated `canEdit` |
| V2L-14 | Fairness summary strip (History view) | `frontend/src/components/loot/FairnessSummary.tsx:30-61` | 4 stat cards: drops-this-tier, most/fewest recipients, distribution (Even/Uneven vs ±2 band), this-week count/pending — display only | display only |
| V2L-15 | Book Ledger card | `frontend/src/components/loot/BookLedgerCard.tsx:104-244` | "This week / All time" scope `SegmentedToggle`; per-cell click opens `EditBookBalanceModal` to adjust a player's Book I–IV balance; per-row ledger icon opens `PlayerLedgerModal`; "Mark floor cleared" button opens `MarkFloorClearedModal` | cell edit: `canEdit` OR the viewer's own row (member-own-row exception); "Mark floor cleared" gated `canEdit` |
| V2L-16 | Loot History table (week-grouped) | `frontend/src/components/loot/LootHistoryTable.tsx:47-148` | Groups filtered loot+material entries by week (current-week tag); supports `?entry=&entryType=` deep-link scroll+highlight (2.5s, self-clearing) | display grouping; row actions below |
| V2L-17 | History row kebab (Edit / Copy link / Delete) | `frontend/src/components/loot/LootEntryRow.tsx:143-158` | Dropdown per entry: "Edit" (loot rows only, `canEdit`) opens RecipientPicker `mode="edit"`; "Copy link" always available, builds a `?tab=gear&lview=history&entry=` URL; "Delete" (`canEdit`) opens a delete-confirm modal | Edit/Delete gated `canEdit`; Copy link always shown |
| V2L-18 | Delete-entry confirm modals | `frontend/src/components/loot/Loot.tsx:535-571` | Loot rows reuse legacy `DeleteLootConfirmModal` (gear-revert checkbox); material rows use a lightweight `ConfirmModal` (revert always on) | reachable only from `canEdit` (V2L-17) |
| V2L-19 | Reset confirm modal | `frontend/src/components/loot/Loot.tsx:573-580` | `ResetConfirmModal` — type-to-confirm gate before executing a Reset-menu selection (V2L-05) | reachable only from `canEdit` (V2L-05) |
| V2L-20 | Material quick-log modal | `frontend/src/components/loot/Loot.tsx:509-523` | `QuickLogMaterialModal` opened from a material row's Assign (V2L-09), pre-suggesting the top-ranked/first roster player | reachable only from `canEdit` (V2L-09) |
| V2L-21 | Week indicator (chrome, not in-body) | see V2K-09 | "Week N" is shown in the v2 TopBar, not inside the Loot body itself | n/a |

## V2 Schedule (`components/schedule/Schedule.tsx`, slot: `schedule`)

| ID | Affordance | Where (file:line) | Interaction & what it does | Permission notes |
|---|---|---|---|---|
| V2S-01 | Week navigator strip | `frontend/src/components/schedule/WeekNavigatorStrip.tsx:71-104` | Prev/next-week `IconButton`s (disabled on a null-anchor tier or bounds), "Week N · this week" label + date range + tier label, recurring-summary tag, "Add session" primary button | Add-session button gated `canManage` |
| V2S-02 | Session RSVP strip (per session card) | `frontend/src/components/schedule/SessionList.tsx:240-248`; `SessionRsvpCard.tsx` variant `later`/`next` | Member-grid RSVP detail + inline RSVP buttons ("I'm in"/"Tentative"/"Can't make it") calling `onRsvp` | shown only when `canRsvp` (member with a non-viewer role) |
| V2S-03 | Session kebab menu | `frontend/src/components/schedule/SessionList.tsx:250-277` | Edit (`canManage`) / Share (native share-sheet → clipboard fallback) / Copy for Discord (formatted message + link) / Manage occurrences (recurring + `canManage`) / separator / Delete (`canManage`, danger) | see per-item gates above |
| V2S-04 | Empty-week state | `frontend/src/components/schedule/SessionList.tsx:182-207` | "No sessions this week" + "Add session" CTA (`canManage`); if a future session exists, a "Next session: … — Week N" jump button (`onJumpToWeek`) | Add-session CTA gated `canManage` |
| V2S-05 | Create/Edit session modal | `frontend/src/components/schedule/Schedule.tsx:297-351,470-480` | `CreateSessionModal`, opened for create / edit / "propose" (pre-filled draft from a heatmap or best-times click) | create/edit reachable only via `canManage` affordances |
| V2S-06 | Delete flow — recurring choice | `frontend/src/components/schedule/Schedule.tsx:353-397,505-527` | Deleting a recurring occurrence opens "Cancel just this occurrence" vs "Delete entire series"; either path routes to a final danger `ConfirmModal` | `canManage` |
| V2S-07 | Manage occurrences modal | `frontend/src/components/schedule/Schedule.tsx:399-400,541-554`; `OccurrenceListModal.tsx` | Per-recurring-session occurrence list/management surface | `canManage` |
| V2S-08 | Team availability heatmap | `frontend/src/components/schedule/AvailabilityHeatmap.tsx:113-219` | 7×8 density grid (color-mix steps) aggregated from member availability; scheduled slots get a ring indicator; when `canManage`, clicking/Enter-Space on a cell proposes a 2h session at that slot (`onProposeSession`) | click-to-propose gated `canManage` |
| V2S-09 | "Edit week" button (availability) | `frontend/src/components/schedule/AvailabilityHeatmap.tsx:117-128`; modal at `Schedule.tsx:482-503` | Opens a Modal hosting the legacy `AvailabilityGrid` editor (Task 10 stopgap import) so the viewer can paint their own week | shown when `canRsvp` |
| V2S-10 | Best times card | `frontend/src/components/schedule/BestTimesCard.tsx:30-95` | Session-length `Select` (1h–3h) + ranked availability-window rows with a proportion bar; when `canManage`, each row is a button that proposes that session (`onProposeSession`) | proposing gated `canManage`; duration selector always available |
| V2S-11 | Person-layer entry point | `frontend/src/components/schedule/PersonLayerEntryPoint.tsx:14-41`; used at `Schedule.tsx:460-465` | "Your availability" card, "Edit" button navigates to `/profile?tab=availability` | none |
| V2S-12 | `?sessionId=` deep-link highlight + scroll | `frontend/src/components/schedule/Schedule.tsx:219-283` | Resolves a linked session (incl. recurring, via computed next occurrence), scopes the week, scrolls + 5s-pulses the card | none |
| V2S-13 | Shared week clock with Loot | `frontend/src/components/schedule/Schedule.tsx:93-97,404-408` | Schedule's scoped week uses the same `useWeekClock` instance/derivation as Loot ("the same week drives loot") | n/a |

## V2 Settings host

| ID | Affordance | Where (file:line) | Interaction & what it does | Permission notes |
|---|---|---|---|---|
| V2ST-01 | V2SettingsHost mount | `frontend/src/pages/V2SettingsHost.tsx:18-34`; mounted `NewShell.tsx:303` | Renders the **same** `StaticSettingsHost`/`SettingsPanel` components the legacy shell uses ("pure reuse … `StaticSettingsHost` is unchanged") inside the v2 tree, gated on `currentGroup` | n/a |
| V2ST-02 | SettingsGear (TopBar) toggle | `frontend/src/components/layout/SettingsGear.tsx:21-53`; placed `TopBar.tsx:169` | IconButton in the TopBar affordance cluster toggles `settingsPanelStore` open/close (icon swaps Settings⇄PanelRightClose) | v2-only entry point (legacy uses `Header`'s own gear, not this component) |
| V2ST-03 | Docked vs slideout container | `frontend/src/components/settings/StaticSettingsHost.tsx:23-55` | Desktop: docks to the right edge via `RightDockPanel`; mobile: full-screen slideout overlay | responsive, not role-based |
| V2ST-04 | Settings tabs | `frontend/src/components/settings/SettingsPanel.tsx:36-69` | General (all), Static (managers), Priority (managers + members, hidden from viewers), Goals & Farms (all, with Overview/Objectives/Farms/Suggestions sub-nav), Recruitment (managers, with Overview/Listing/Requests/Invitations sub-nav), Integrations (managers), Members (all) | per-tab `visible(role, isAdmin)` predicate, `SettingsPanel.tsx:52-64` |
| V2ST-05 | Recruitment ▸ Requests deep-open | opened from Home V2H-05(c) (`NewShell.tsx:66-68`), MorePage "Requests" card (`MorePage.tsx:87-118`), TopBar invite fallback (`TopBar.tsx:100-106`) | Each caller calls `useSettingsPanelStore.getState().open({tab:'recruitment', section:'requests'|'invitations', ...})` to deep-link straight into the Requests/Invitations sub-section | managers-only tab |
| V2ST-06 | Priority tab deep-open ("Rules") | see V2L-07 | Loot's "Rules" button opens Settings ▸ Priority directly | managers + members |
| V2ST-07 | CommandPalette "Open Settings" | see V2K-03 | Palette row opens the panel via the same `settingsPanelStore.open()` call as V2ST-02 | n/a |
| V2ST-08 | MorePage settings cards | `frontend/src/components/group/MorePage.tsx:87-144,254-275` | "Requests" (managers) and "Lead Tools"/"Settings" (managers / all) `DashboardCard`s route into `onOpenSettings('recruitment'|'general')` | see individual card gates |

## V2 More page (see also the M- table in legacy-schedule-settings-goals-plugin.md)

| ID | Affordance | Where | Live/stub | Permission notes |
|---|---|---|---|---|
| V2M-01 | Requests card | `MorePage.tsx:86-118` | Live | `canManage`-only card |
| V2M-02 | Lead Tools card | `MorePage.tsx:120-144` | Live | `canManage`-only |
| V2M-03 | Loot History card | `MorePage.tsx:146-170` | Live (v2: sets `lview=history`, `GroupViewContent.tsx:1164-1173`) | all roles |
| V2M-04 | Split Planner card | `MorePage.tsx:172-189`; gate `GroupViewContent.tsx:1174-1180` | **Not rendered in v2** (v2 omits `onOpenSplitPlanner`) | legacy-shell-only |
| V2M-05 | Integrations card | `MorePage.tsx:191-226` | Live | all view; managers edit |
| V2M-06 | Dalamud Plugin card | `MorePage.tsx:228-251` | Live | all roles |
| V2M-07 | Settings card | `MorePage.tsx:253-275` | Live | all roles |
| V2M-08 | Exports card | `MorePage.tsx:285-295` | **Stub "Coming soon"** | n/a |
| V2M-09 | Activity Log card | `MorePage.tsx:297-307` | **Stub "Coming soon"** | n/a |
| V2M-10 | Session History card | `MorePage.tsx:309-321` | Live | all roles |
| V2M-11 | "Interface" — Switch to classic UI | `MorePage.tsx:326-347`; wired `NewShell.tsx:58,164`, `GroupViewContent.tsx:1181` | Live, v2-only; on mobile this is the only reachable v2→legacy affordance | all viewports |
| V2M-12 | Danger Zone — Leave Static | `MorePage.tsx:349-406` | Live | non-owner members only; suppressed under admin View-As (`GroupViewContent.tsx:1186-1211`) |
| V2M-13 | Danger Zone — Delete Static | `MorePage.tsx:349,379-386` | Live → Settings ▸ Static | owner only |

## CommandPalette (⌘K), TopBar, Spine, mobile bottom nav (V2K-)

| ID | Affordance | Where (file:line) | Interaction & what it does | Permission notes |
|---|---|---|---|---|
| V2K-01 | ⌘K / Ctrl-K global open | `frontend/src/pages/NewShell.tsx:262-275`; trigger button `TopBar.tsx:146-154` | Keyboard shortcut or TopBar icon opens `CommandPalette` (v2-scoped) | v2-only surface |
| V2K-02 | Palette: Go to Home/Roster/Loot/Schedule/Tracking/Plugin/More | `frontend/src/components/layout/CommandPalette.tsx:94-135` | Each row calls `setPageMode(...)` then closes | none |
| V2K-03 | Palette: Open Settings | `CommandPalette.tsx:137-145` | Calls `settingsPanelStore.open()` | none |
| V2K-04 | Palette: Switch static (one row per group) | `CommandPalette.tsx:151-163` | Navigates via `buildStaticNavHref`, restoring target static's saved tab if remember-on | needs ≥1 other static |
| V2K-05 | Palette: search filter + shortcuts reference | `CommandPalette.tsx:168-176,256-282` | Free-text filter; footer lists every `SHORTCUT_GROUPS` entry | none |
| V2K-06 | TopBar: StaticPicker (breadcrumb + switch dropdown) | `frontend/src/components/layout/StaticPicker.tsx:115-166` | Static name/role badge; ▾ dropdown of other statics (+ "Go to My Statics") | dropdown only `isMember` |
| V2K-07 | TopBar: Tier breadcrumb | `frontend/src/pages/TierBreadcrumb.tsx:78-91` | `› [TierSelector]` switches `currentTier` | n/a |
| V2K-08 | TopBar: Tier kebab — Create/Rollover/Delete | `frontend/src/pages/TierBreadcrumb.tsx:43-74,86-88` | "Create New Tier" (Alt+Shift+N), "Copy to New Tier"/rollover (Alt+Shift+R), "Delete Tier" (danger), each with disable conditions | menu rendered `canEdit` |
| V2K-09 | TopBar: Week indicator | `frontend/src/components/layout/TopBar.tsx:49-59,134-139` | Display-only "Week N" from `lootTrackingStore.currentWeek`; desktop-only (`hidden sm:flex`) | display only |
| V2K-10 | TopBar: Invite members | `TopBar.tsx:89-107,155-165` | Copies active invite link, else opens Settings ▸ Recruitment ▸ Invitations | `canManageInvitations` |
| V2K-11 | TopBar: Notification bell | `frontend/src/components/layout/NotificationBell.tsx:40-91` | Opens app-level center; badge = server unread + synthetic + (in-static) pending join requests | join-request term gated `canManageInvitations` |
| V2K-12 | TopBar: Theme toggle | `TopBar.tsx:167` | Light/dark | none |
| V2K-13 | TopBar: Settings gear | see V2ST-02 | — | — |
| V2K-14 | Spine tabs (desktop primary nav) | `frontend/src/components/layout/Spine.tsx:12-93` | 4 tabs: Home/Roster/Loot/Schedule with roving-tabindex keyboard nav; **Goals/More/Plugin have no Spine entry** — ⌘K or mobile nav only | none |
| V2K-15 | Mobile bottom nav | `frontend/src/components/ui/MobileBottomNav.tsx:35-141`; mounted both shells `GroupViewContent.tsx:1239-1245` | 6 tabs Overview/Roster/Schedule/Goals/Gear/More + "Controls" bottom sheet; swipe switches tabs (<640px) | identical both shells |
| V2K-16 | Mobile controls sheet | `frontend/src/pages/GroupViewContent.tsx:1247-1444` | Tier selector always; Roster/Gear tab-specific controls only when `!slots?.roster`/`!slots?.gear` (suppressed on v2) | reset actions gated `canManageRoster` |
| V2K-17 | Admin/Join-request banners | `frontend/src/pages/NewShell.tsx:129-155` | AdminBanners + JoinRequestBanner via banners slot; "Exit admin mode" refetches | `isAdminAccess` / non-member discoverable |
| V2K-18 | Rail "Switch to classic UI" (UserMenu) | `frontend/src/components/auth/UserMenu.tsx:70,368-370` | Desktop-rail UserMenu item `switchShell('legacy')` | hidden below `sm` |

## V2-only affordances (no legacy counterpart)

| ID | Affordance | Evidence |
|---|---|---|
| NEW-01 | Global Command Palette (⌘K) — navigate + settings + static-switch + shortcuts in one keyboard-first surface | `CommandPalette.tsx:4` "Scope: v2 shell only"; legacy chrome has no command surface |
| NEW-02 | Roster **Board** view — roster-wide gear matrix (party rows × 11 slots + BiS column) | `GearBoard.tsx:1-22`; legacy `GearTable.tsx` is per-player inside expanded card only |
| NEW-03 | Board live next-upgrade glyph (●) computed against the Loot priority queue | `GearBoard.tsx:65-66`; `GearBoardCell.tsx:76-93`; `Roster.tsx:185-213` |
| NEW-04 | Board per-row gear-edit permission model (`canEditGear` per row) | `GearBoard.tsx:50-61` — "wrongly locked members out of their own gear" fixed |
| NEW-05 | Recurring-session delete cancels the RENDERED occurrence (legacy: next occurrence) | `Schedule.tsx:365-366` comment |
| NEW-06 | "Switch to classic UI" as a first-class More-page section | `MorePage.tsx:23-31,326-347` — v2-exclusive prop |

---

## ⚠ CORRECTION NOTE (appended 2026-07-26, director completeness sweep)

The V2R table above **omits two affordances that exist at HEAD**. Both were verified in code during
the Phase-B parity-matrix sweep, after the matrix's first draft inherited the omission as two false
"LOST" claims (matrix D-10, D-11 — since corrected):

| Missing ID | Affordance | Where (file:line) | Note |
|---|---|---|---|
| **V2R-25** | Roster card **average iLvl readout** — the player's average item level rendered on the card under an "iLvl" label | `frontend/src/components/roster/RosterCard.tsx:250,389-391` | The number survives from legacy R-075; what does **not** survive is legacy's per-slot "Now vs BiS" hover/long-press breakdown, nor R-074's `ProgressRing` |
| **V2R-26** | Roster card **role-colour accent edge** — the 3px role-coloured left border | `frontend/src/components/roster/RosterCard.tsx:313-318` | Direct equivalent of legacy R-064; the matrix moved R-064 to its KEPT ledger |

**Consumer guidance:** this inventory is authoritative where it makes a *positive* statement (e.g.
V2L-01's "`WhoNeedsItMatrix` … does not appear in the v2 tree", V2R-15's "rendered `disabled` with a
no-op `onChange`"). Where it is merely **silent**, absence is not evidence — spot-check the
component before recording anything as LOST. Row IDs V2R-25/V2R-26 are assigned here so downstream
documents can cite them; the V2R subtotal becomes 26 and the body-row total 91.
