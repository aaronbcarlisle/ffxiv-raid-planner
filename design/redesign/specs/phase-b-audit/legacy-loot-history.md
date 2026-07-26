# Legacy V1 Loot + History Affordance Enumeration (Phase B)

| ID | Affordance | Where (file:line) | Interaction & what it does | Permission notes |
|---|---|---|---|---|
| L-01 | Gear tab sub-tab bar: Sync / BiS / Jobs / History | frontend/src/pages/GroupViewContent.tsx:982-1005 | Click a pill button to switch `gearSubTab` (`sync`\|`priority`\|`stats`\|`history`); persists to URL `?sub=` + localStorage per static | All roles can view; content behind each sub-tab has its own gating |
| L-02 | BiS (Priority) sub-tab mount | GroupViewContent.tsx:1016-1044 | Mounts `<LootPriorityPanel>` when `gearSubTab==='priority'` and roster non-empty; passes `showLogButtons={canEdit}` | `showLogButtons` = owner/lead/admin only |
| L-03 | Loot Log (History) sub-tab mount | GroupViewContent.tsx:1047-1072 | Mounts `<HistoryView>` when `gearSubTab==='history'`; wires deep-link props (`highlightedEntry`, `wizardTargetWeek`, modal-open flags) | userRole/isAdmin passed through for per-row gating |
| L-04 | Jobs/Summary sub-tab mount | GroupViewContent.tsx:1075-1082 | Mounts `<TeamSummaryEnhanced>` when `gearSubTab==='stats'` and roster non-empty | No explicit gate beyond roster non-empty; renders for all roles |
| L-05 | "No content" silent gap on empty roster | GroupViewContent.tsx:1016-1082 | If `mainRosterPlayers.length===0`, none of BiS/History/Jobs panels render any fallback UI — blank content area | n/a |
| L-06 | More page onOpenLootHistory wiring | GroupViewContent.tsx:1164-1173 | Clicking More page "Loot History" card sets `gearSubTab('history')` + `setPageMode('gear')` (legacy) in one navigation | Card itself always visible on More page |
| L-07 | Mobile Controls Sheet — Gear tab view selector | GroupViewContent.tsx:1335-1387 | 3 stacked buttons ("Who Needs It"/"Gear Priority"/"Weapon Priority") call `setLootSubTab`; only rendered when `pageMode==='gear' && !slots?.gear` | All roles see the selector |
| L-08 | Mobile Controls Sheet — Reset Loot Log button | GroupViewContent.tsx:1400-1412 | Dispatches `window` CustomEvent `log:reset-loot`, closes sheet | Only rendered when `canManageRoster(userRole, isAdminAccess).allowed` (owner/lead/admin) |
| L-09 | Mobile Controls Sheet — Reset Book Balances button | GroupViewContent.tsx:1413-1425 | Dispatches `log:reset-books` | Same gate as L-08 |
| L-10 | Mobile Controls Sheet — Reset All Data button | GroupViewContent.tsx:1426-1438 | Dispatches `log:reset-all` | Same gate as L-08 |
| L-11 | Log Week Wizard bottom-level mount | GroupViewContent.tsx:1447-1473 | Renders `<LogWeekWizard>` controlled by `showLogWeekWizard`/`logWeekWizardFloor`/`logWeekWizardWeek`; on success sets `wizardTargetWeek` to jump History's week selector | Only opened via canEdit-gated triggers (Log Week/Log Floor buttons, Alt+shortcuts) |
| L-12 | Roster gear-slot → "Jump to loot entry" cross-nav | frontend/src/hooks/useViewNavigation.ts:147-181 | From elsewhere (e.g. Roster gear slot context menu), navigates to Gear tab / History sub-tab, highlights + scrolls to the matching `loot-entry-{id}` row for 2.5s | n/a (navigation only) |
| L-13 | Roster gear-slot → "Jump to material entry" cross-nav | useViewNavigation.ts:184-206 | Same pattern for `material-entry-{id}` | n/a |
| L-14 | Roster player → "Jump to Books panel" cross-nav | useViewNavigation.ts:209-223 | Switches to History sub-tab, highlights `book-row-{playerId}` in the Books sidebar | n/a |
| L-15 | LootPriorityPanel header — responsive title | frontend/src/components/loot/LootPriorityPanel.tsx:508-515 | Mobile shows current sub-tab name; desktop shows static "Loot Priority" | n/a |
| L-16 | LootPriorityPanel sub-tab button: "Who Needs It" (+ Alt+1 tooltip) | LootPriorityPanel.tsx:517-540 | Click sets `activeSubTab('matrix')`; tooltip advertises `Alt+1` shortcut | n/a |
| L-17 | LootPriorityPanel sub-tab button: "Gear Priority" (+ Alt+2 tooltip) | LootPriorityPanel.tsx:541-563 | Click sets `activeSubTab('gear')`; tooltip advertises `Alt+2` | n/a |
| L-18 | LootPriorityPanel sub-tab button: "Weapon Priority" (+ Alt+3 tooltip) | LootPriorityPanel.tsx:564-586 | Click sets `activeSubTab('weapon')`; tooltip advertises `Alt+3` | n/a |
| L-19 | Note: Alt+1/2/3 tooltips do not match the actual global binding | LootPriorityPanel.tsx:518-586 vs frontend/src/hooks/useGroupViewKeyboardShortcuts.ts:144-163 | The panel advertises Alt+1/2/3 for matrix/gear/weapon, but the registered global shortcut instead switches the outer Gear-tab sub-tab (Priority/History/Stats) and, when on History, the log view/entry-type; no listener exists for the panel's internal `matrix/gear/weapon` sub-tab | n/a |
| L-20 | "Loot history adjustments active" badge | LootPriorityPanel.tsx:589-593 | Static text (with title tooltip) shown only when enhanced scoring is active; not clickable | n/a |
| L-21 | Sub-tab swipe (mobile) | LootPriorityPanel.tsx:316-334 | Swipe left/right over content area cycles matrix→gear→weapon | n/a |
| L-22 | Sub-tab default/persistence (uncontrolled fallback) | LootPriorityPanel.tsx:296-314 | Local state defaults via `recallTab('loot-priority-subtab', …, 'matrix')`; in practice always overridden because GroupViewContent passes `activeSubTab`/`onSubTabChange` (controlled) | n/a |
| L-23 | Gear-tab-switch resets Loot sub-tab default to "Gear Priority", not "Who Needs It" | frontend/src/hooks/useGroupViewState.ts:330-333 | When tab-persistence pref is "reset", `setPageMode` forces `lootSubTab` back to `'gear'` (not the documented default `'matrix'`) on every primary-tab switch | n/a |
| L-24 | Gear Priority sub-tab: floor selector | LootPriorityPanel.tsx:605-613 (via FilterBar) | Floor pill buttons (F1-F4, no "All") change `selectedFloor`; syncs matrix floor too | n/a |
| L-25 | Gear Priority sub-tab: "+ Log Floor" button | LootPriorityPanel.tsx:614-622 | Opens `LogWeekWizard` in single-floor mode for `selectedFloor` | Only rendered when `showLogButtons && groupId && tierId` (owner/lead/admin) |
| L-26 | Gear Priority sub-tab: per-slot "Log" button | LootPriorityPanel.tsx:645-654 (PriorityList) | Click opens `QuickLogDropModal` pre-filled for that slot/player | Button only rendered when `canShowLogButtons` |
| L-27 | Gear Priority sub-tab: score badge w/ breakdown tooltip | LootPriorityPanel.tsx:181-190, 50-125 | Hover shows priority-score breakdown (role/need/job/player/loot-adjust/drought/balance) | n/a |
| L-28 | Gear Priority sub-tab: per-material "Log" button | LootPriorityPanel.tsx:681-691 | Opens `QuickLogMaterialModal` pre-filled | Same gate as L-26 |
| L-29 | Weapon Priority sub-tab mount | LootPriorityPanel.tsx:700-710 | Renders `<WeaponPriorityList>` | n/a |
| L-30 | Who Needs It Matrix sub-tab mount | LootPriorityPanel.tsx:712-725 | Renders `<WhoNeedsItMatrix>` with `selectedFloor='all'` default (uncontrolled local state) | n/a |
| L-31 | Quick Log Drop Modal mount | LootPriorityPanel.tsx:728-745 | Conditionally mounted when `canShowLogButtons && modalState.player` | n/a |
| L-32 | Quick Log Weapon Modal mount | LootPriorityPanel.tsx:747-762 | Floor is hard-coded to `floors[3]` ("Weapons always drop from floor 4") | n/a |
| L-33 | Quick Log Material Modal mount | LootPriorityPanel.tsx:764-784 | Floor derived from `getFloorForUpgradeMaterial` | n/a |
| L-34 | Log Floor Wizard mount (from Gear Priority "+Log Floor") | LootPriorityPanel.tsx:786-806 | Separate `LogWeekWizard` instance in `singleFloorMode` | Only when `canShowLogButtons` |
| L-35 | Floor filter buttons (shared FilterBar, floor type) | frontend/src/components/loot/FilterBar.tsx:60-103 | Used by Gear Priority & Who Needs It Matrix; "All" option toggled per caller | n/a |
| L-36 | Role filter buttons (shared FilterBar, role type) | FilterBar.tsx:114-150 | Used by Weapon Priority "Show:" toggles (Tanks/Healers/Melee/Ranged/Casters) | n/a |
| L-37 | Who Needs It — floor filter tabs (All/F1-F4) | frontend/src/components/loot/WhoNeedsItMatrix.tsx:300-311 | Controls both gear-slot and material rows' active/dim state | n/a |
| L-38 | Who Needs It — desktop table gear-need dot cell | WhoNeedsItMatrix.tsx:366-408 | Click a colored dot to open QuickLogDropModal for that player+slot (ring cells resolve ring1/ring2 via `getNeededRingSlot`) | `disabled={!showLogButtons \|\| !isActiveSlot}` — owner/lead/admin only |
| L-39 | Who Needs It — "FREE"/count column | WhoNeedsItMatrix.tsx:410-422 | Read-only status badge ("FREE" or `count/8`, color-coded by count) | n/a |
| L-40 | Who Needs It — desktop material pie-donut cell | WhoNeedsItMatrix.tsx:455-496 | Click segmented donut (`MaterialPieIndicator`) to open QuickLogMaterialModal | Same gate as L-38 |
| L-41 | Who Needs It — mobile card view, gear slot chips | WhoNeedsItMatrix.tsx:520-585 | Per-slot card lists player chips who need it; click chip to log | Same gate as L-38 |
| L-42 | Who Needs It — mobile card view, material chips w/ ×N counter | WhoNeedsItMatrix.tsx:588-655 | Chip shows `×N` needed count; click to log | Same gate as L-38 |
| L-43 | Who Needs It — static legend | WhoNeedsItMatrix.tsx:658-682 | Non-interactive key explaining dot/pie/FREE symbols | n/a |
| L-44 | Weapon Priority — role section "Show:" toggle chips | frontend/src/components/loot/WeaponPriorityList.tsx:1076-1084 | Toggles `visibleSections`; syncs to URL `weaponSections` param | n/a |
| L-45 | Weapon Priority — Expand All/Collapse All via `V` key | WeaponPriorityList.tsx:921-944 | Global `V` keydown (outside inputs) dispatches `loot:toggle-expand-all`, toggling all role sections | n/a |
| L-46 | Weapon Priority — per-section expand/collapse persisted | WeaponPriorityList.tsx:892-919 | Saved to localStorage `weapon-priority-expanded` | n/a |
| L-47 | Weapon Priority — mobile flat card grid | WeaponPriorityList.tsx:1096-1124 | Renders `WeaponPriorityCard` per job, ungrouped by role | n/a |
| L-48 | Weapon Priority — desktop collapsible role sections | WeaponPriorityList.tsx:1126-1166 | Wraps job cards in `<RoleSection>` per role | n/a |
| L-49 | Weapon Priority — character-registration badge | WeaponPriorityList.tsx:29-51, 667-671 | Shows resolved character name next to a player entry (when static-character registrations exist) | n/a |
| L-50 | Weapon Priority — empty state "No configured players yet." | WeaponPriorityList.tsx:1064-1069 | Shown when `allJobs.size===0` | n/a |
| L-51 | Weapon Priority — empty state "No role sections selected." | WeaponPriorityList.tsx:1089-1093 | Shown when `visibleSections.size===0` (all role toggles off) | n/a |
| L-52 | RoleSection — click header to expand/collapse | frontend/src/components/loot/RoleSection.tsx:96-123 | Toggles a single role group | n/a |
| L-53 | RoleSection — right-click → Expand All / Collapse All context menu | RoleSection.tsx:70-89, 130-138 | Only shown if `onExpandAll`/`onCollapseAll` provided | n/a |
| L-54 | WeaponPriorityCard (border style) — Roll/Reroll button for tied players | WeaponPriorityList.tsx:292-300 | Randomly rolls 1-100 per tied entry, sorts winner first | Not gated by `showLogButtons` — clickable regardless of role |
| L-55 | WeaponPriorityCard (border style) — per-entry "Log" button | WeaponPriorityList.tsx:352-367, 421-436 | Opens QuickLogWeaponModal for that job/player | `showLogButtons && onLogClick` — owner/lead/admin only |
| L-56 | WeaponPriorityCard (connector style) — click tie-group header to expand tied players | WeaponPriorityList.tsx:489-523 | Toggles per-tie-group expansion | n/a |
| L-57 | WeaponPriorityCard (connector style) — winner "Log" button after roll | WeaponPriorityList.tsx:524-536 | Appears in the group header once a roll has a winner | owner/lead/admin only |
| L-58 | WeaponPriorityCard (connector style) — Roll/Reroll button | WeaponPriorityList.tsx:537-546 | Same as L-54 for connector layout | Not gated — any role |
| L-59 | WeaponPriorityCard — score badge tooltip breakdown | WeaponPriorityList.tsx:54-67 (rendered throughout, e.g. 690-697) | Hover shows main-job bonus / role score / rank score | n/a |
| L-60 | WeaponPriorityCard — "Received players" footer | WeaponPriorityList.tsx:832-849 | Read-only list of players who already received this weapon, with Drop/Coffer badge | n/a |
| L-61 | QuickLogDropModal — Week NumberInput | frontend/src/components/loot/QuickLogDropModal.tsx:290-297 | Adjusts target week, clamped 1..maxWeek | n/a |
| L-62 | QuickLogDropModal — LootRecommendationCandidates panel | QuickLogDropModal.tsx:300-310 | Recommendation UI (see L-68-72) | n/a |
| L-63 | QuickLogDropModal — Recipient select | QuickLogDropModal.tsx:312-321 | Priority-labeled dropdown ("Top Priority"/"2nd"/"3rd") | n/a |
| L-64 | QuickLogDropModal — "Mark X as acquired" checkbox | QuickLogDropModal.tsx:324-328 | Defaults checked; controls whether gear state updates | n/a |
| L-65 | QuickLogDropModal — "Extra loot (not BiS priority)" checkbox (weapon only) | QuickLogDropModal.tsx:330-337 | Only shown for weapon slot | n/a |
| L-66 | QuickLogDropModal — "This will:" preview list | QuickLogDropModal.tsx:339-351 | Read-only summary of pending actions | n/a |
| L-67 | QuickLogDropModal — Cancel / Log Drop buttons | QuickLogDropModal.tsx:353-365 | Submit disabled until recipient chosen | n/a |
| L-68 | LootRecommendationCandidates — candidate row click | frontend/src/components/loot/LootRecommendationCandidates.tsx:61-133, 171-179 | Click a ranked candidate to fill recipient + character-registration selection; tooltip lists reasons/warnings | Used from both QuickLogDropModal and AddLootEntryModal |
| L-69 | LootRecommendationCandidates — Role badge (Main/Alt/Player) | LootRecommendationCandidates.tsx:36-59 | Read-only chip describing candidate source | n/a |
| L-70 | LootRecommendationCandidates — "Already received" warning chip | LootRecommendationCandidates.tsx:124-129 | Read-only flag | n/a |
| L-71 | LootRecommendationCandidates — Show more/fewer toggle | LootRecommendationCandidates.tsx:182-197 | Expands beyond top-3 candidates | n/a |
| L-72 | LootRecommendationCandidates — confidence header (high/medium/low) | LootRecommendationCandidates.tsx:150-158 | Read-only label + color | n/a |
| L-73 | QuickLogWeaponModal — Weapon/Floor/Week header block | frontend/src/components/loot/QuickLogWeaponModal.tsx:177-200 | Week is a Select (not NumberInput, unlike drop modal) | n/a |
| L-74 | QuickLogWeaponModal — Recipient select | QuickLogWeaponModal.tsx:202-211 | Priority-labeled, flags "(Main)" for main-job matches | n/a |
| L-75 | QuickLogWeaponModal — "Mark weapon as acquired" checkbox | QuickLogWeaponModal.tsx:213-218 | Default checked | n/a |
| L-76 | QuickLogWeaponModal — "Via weapon coffer" checkbox | QuickLogWeaponModal.tsx:220-225 | Controls `obtainedVia` | n/a |
| L-77 | QuickLogWeaponModal — "Extra loot" checkbox w/ auto-detect | QuickLogWeaponModal.tsx:61-71, 227-237 | Auto-toggles when recipient's job differs from weapon job; shows "(auto-detected: off-job)" hint | n/a |
| L-78 | QuickLogWeaponModal — preview + Cancel/Log Weapon buttons | QuickLogWeaponModal.tsx:239-265 | Same pattern as drop modal | n/a |
| L-79 | QuickLogMaterialModal — Week/Floor/Material header | frontend/src/components/loot/QuickLogMaterialModal.tsx:290-310 | Week is NumberInput | n/a |
| L-80 | QuickLogMaterialModal — Recipient select | QuickLogMaterialModal.tsx:312-321 | Priority-labeled | n/a |
| L-81 | QuickLogMaterialModal — Method RadioGroup (Drop/Book) | QuickLogMaterialModal.tsx:323-336 | n/a | n/a |
| L-82 | QuickLogMaterialModal — gear-update checkbox + slot/tome-weapon select | QuickLogMaterialModal.tsx:338-422 | Branches by material type (universal_tomestone / solvent / twine-glaze) | n/a |
| L-83 | QuickLogMaterialModal — preview + Cancel/Log Material buttons | QuickLogMaterialModal.tsx:424-454 | n/a | n/a |
| L-84 | LogWeekWizard — modal shell w/ Week NumberInput in title | frontend/src/components/loot/LogWeekWizard/index.tsx:743-763 | Clamped 1..effectiveMaxWeek | n/a |
| L-85 | LogWeekWizard — step progress indicator (Gear/Books/Confirm) | LogWeekWizard/index.tsx:685-741 | Read-only visual stepper | n/a |
| L-86 | LogWeekWizard — Back/Next/Cancel/Submit buttons | LogWeekWizard/index.tsx:830-869 | Submit label switches "Log Week N" vs "Log <floor>" (single-floor mode); disabled while `summary.total===0` | n/a |
| L-87 | LogWeekWizard — partial-failure retry handling | LogWeekWizard/index.tsx:610-656 | On partial submit failure, resets only failed entries to `didNotDrop:true` so a retry resubmits just those | n/a |
| L-88 | LogWeekWizard — three distinct mount points | GroupViewContent.tsx:1447-1473 (multi-floor "Log Week"), LootPriorityPanel.tsx:786-806 ("+Log Floor" single-floor), SectionedLogView.tsx (via `onLogFloor`, WeeklyLootGrid per-floor "Log Floor") | Same component reused across 3+ entry points | Reachable only via canEdit-gated triggers |
| L-89 | GearStep — floor tabs (multi-floor mode) w/ per-floor include checkbox | frontend/src/components/loot/LogWeekWizard/GearStep.tsx:54-121 | Click tab body to select floor (only if included); separate checkbox toggles `clearedFloors` inclusion; badge shows assigned-item count | n/a |
| L-90 | GearStep — "No Drops"/"Restore All" toggle | GearStep.tsx:136-146 | Bulk-marks/unmarks every gear+material slot on the current floor as "did not drop" | n/a |
| L-91 | GearStep — per-slot recipient select + "drop occurred" Toggle | GearStep.tsx:149-184 | Toggle off marks `didNotDrop`, disabling the Select | n/a |
| L-92 | GearStep — per-material recipient select + augmentation-target select + drop Toggle | GearStep.tsx:201-263 | Target select only shown when multiple eligible slots/tome-weapon options exist | n/a |
| L-93 | BooksStep — "Select All Floors"/"Clear All Floors" (multi-floor mode) | frontend/src/components/loot/LogWeekWizard/BooksStep.tsx:42-87 | Bulk book-clear selection across all floors | n/a |
| L-94 | BooksStep — per-floor "Select All"/"Clear" | BooksStep.tsx:108-125 | n/a | n/a |
| L-95 | BooksStep — per-player checkbox chip | BooksStep.tsx:128-156 | Toggles that player as having cleared the floor's books this week | n/a |
| L-96 | ConfirmStep — summary stat bar (Gear/Materials/Books/Total) | frontend/src/components/loot/LogWeekWizard/ConfirmStep.tsx:27-50 | Read-only counts | n/a |
| L-97 | ConfirmStep — per-floor detail cards | ConfirmStep.tsx:53-186 | Lists each pending gear/material/book assignment; shows "+gear"/"+aug" badges when gear will update | n/a |
| L-98 | ConfirmStep — "Skipped" floors notice | ConfirmStep.tsx:189-196 | Read-only warning listing excluded floors | n/a |
| L-99 | ConfirmStep — "No entries to log" warning | ConfirmStep.tsx:198-205 | Shown when `summary.total===0` | n/a |
| L-100 | HistoryView — mobile-only week stepper row + "Log Week" button | frontend/src/components/history/HistoryView.tsx:259-278 | Duplicate of desktop toolbar's week selector for mobile | "Log Week" only if `canEdit && onLogWeek` |
| L-101 | HistoryView — SectionedLogView mount | HistoryView.tsx:282-305 | Passes `canEdit = ['owner','lead'].includes(userRole) \|\| isAdmin` down | Central canEdit definition for the whole tab |
| L-102 | HistoryView — RevertWeekConfirmModal mount | HistoryView.tsx:309-318 | n/a | n/a |
| L-103 | HistoryView — "Start Next Week" handler | HistoryView.tsx:169-181 | Advances `currentWeek` via store, then snaps selector to new week | Exposed to `weekSelectorProps.onStartNextWeek` only when `canEdit` |
| L-104 | HistoryView — "Revert Week" handler w/ pre-check | HistoryView.tsx:183-238 | Fetches latest week data first; if any loot/materials/books exist for the current week, shows `RevertWeekConfirmModal`; otherwise reverts directly | Exposed only when `canEdit` |
| L-105 | SectionedLogView — LootLogFilters toolbar mount | frontend/src/components/history/SectionedLogView.tsx:1024-1044 | n/a | n/a |
| L-106 | SectionedLogView — mobile panel tabs (Loot Log / Books) | SectionedLogView.tsx:1048-1069 | n/a | n/a |
| L-107 | SectionedLogView — All Weeks View mount (desktop) | SectionedLogView.tsx:1073-1095 | n/a | n/a |
| L-108 | SectionedLogView — Grid layout mount + fairness legend | SectionedLogView.tsx:1117-1147 | n/a | n/a |
| L-109 | SectionedLogView — List(split) header: By Floor/Timeline toggle (+ Alt+1/Alt+2 tooltip) | SectionedLogView.tsx:1150-1203 | Tooltip advertises `Alt+1`/`Alt+2`, matching the actual `log:set-view` custom-event dispatch pattern from the keyboard hook | n/a |
| L-110 | SectionedLogView — List header floor filter chips | SectionedLogView.tsx:1206-1229 | Invisible (not unmounted) when in Timeline mode to avoid layout shift | n/a |
| L-111 | SectionedLogView — List floor-grouped entries | SectionedLogView.tsx:1236-1285 | Wraps `LootLogEntryItem`/`MaterialLogEntryItem` in `FloorSection` | n/a |
| L-112 | SectionedLogView — List chronological entries | SectionedLogView.tsx:1286-1319 | Flat combined sort by createdAt desc | n/a |
| L-113 | SectionedLogView — Books sidebar Week/All Time toggle | SectionedLogView.tsx:1330-1356 | Persisted to URL `bookView` param | n/a |
| L-114 | SectionedLogView — Books sidebar collapse/expand button | SectionedLogView.tsx:1358-1367 | Persisted to localStorage `books-sidebar-collapsed` | n/a |
| L-115 | SectionedLogView — Books sidebar per-cell click-to-edit | SectionedLogView.tsx:1416-1441 | Opens `EditBookBalanceModal` for that player/book | `canEditThisRow = canEdit \|\| (userRole==='member' && isOwnRow)`; viewer never editable |
| L-116 | SectionedLogView — Books sidebar "View book history" icon button | SectionedLogView.tsx:1443-1457 | Opens `PlayerLedgerModal` | Same `canEditThisRow` gate as L-115 |
| L-117 | SectionedLogView — Books column header right-click → reset context menu | SectionedLogView.tsx:1380-1385, 404-424 | "Reset Floor N Books" (week-scoped) or "Reset All Floor N Books" (all-time, when on All Time tab) | `onContextMenu` handler only attached when `canEdit` |
| L-118 | SectionedLogView — Books row right-click → reset context menu | SectionedLogView.tsx:1407-1408, 427-447 | "Reset [Player]'s W{n} Books" or "Reset All [Player]'s Books" | Same gate as L-117 |
| L-119 | SectionedLogView — "Mark Floor Cleared" sticky sidebar button (+ Alt+B tooltip) | SectionedLogView.tsx:1467-1490 | Opens `MarkFloorClearedModal` | `canEdit && userRole !== 'member'` (explicit member exclusion even though canEdit already excludes plain members) |
| L-120 | SectionedLogView — Mobile Loot panel (LootCountBar + Grid/List/AllWeeks) | SectionedLogView.tsx:1502-1678 | Mirrors desktop content in a swipeable panel | n/a |
| L-121 | SectionedLogView — Mobile Books panel + "Mark Floor Cleared" | SectionedLogView.tsx:1681-1776 | Table without column/row context menus (mobile) | Footer button same gate as L-119 |
| L-122 | SectionedLogView — mobile swipe between Loot/Books panels | SectionedLogView.tsx:1000-1015 | Swipe left → Books, right → Loot | n/a |
| L-123 | SectionedLogView — LogLayoutToggle mount (mobile floating) | SectionedLogView.tsx:1780-1784 | n/a | n/a |
| L-124 | SectionedLogView — LogFloatingActions mount (mobile FABs) | SectionedLogView.tsx:1787-1791 | Only `visible` when `canEdit` | owner/lead/admin |
| L-125 | SectionedLogView — LootLogModals composite mount | SectionedLogView.tsx:1794-1842 | Wires all modal state (loot/material/floor-cleared/book-balance/ledger/reset/confirm/context-menu) | n/a |
| L-126 | SectionedLogView — Books column/row context menu render | SectionedLogView.tsx:1845-1862 | n/a | n/a |
| L-127 | SectionedLogView — List-view entry right-click context menu | SectionedLogView.tsx:928-995 | Edit / Copy URL / "Jump to {player}" / Delete | Edit & Delete items only pushed when `canEdit`; Copy URL & Jump-to-Player always present |
| L-128 | SectionedLogView — deep-link entry highlight & scroll (URL `entry`/`entryType`) | SectionedLogView.tsx:628-680 | Reading `?entry=&entryType=` scrolls to and pulses the matching row for 2.5s, then strips the params | n/a |
| L-129 | SectionedLogView — reset confirmation orchestration | SectionedLogView.tsx:449-538 | Single `handleResetConfirm` executes floor/week/all-scope loot+book resets depending on `resetConfig`; refreshes loot/material/balance/week-type data after | Only reachable via canEdit-gated triggers |
| L-130 | SectionedLogView — global custom-event listeners | SectionedLogView.tsx:753-809 | `log:set-view`, `log:set-layout`, `log:toggle-expand-all`, `log:toggle-layout`, `log:prev-week`, `log:next-week`, `log:reset-loot`, `log:reset-books`, `log:reset-all` | n/a |
| L-131 | SectionedLogView — layoutMode persistence | SectionedLogView.tsx:542-572 | URL `logLayout` + localStorage `log-layout-mode`; default `grid` | n/a |
| L-132 | SectionedLogView — lootViewMode persistence | SectionedLogView.tsx:596-618 | URL `logView` param (`timeline` vs default `byFloor`) | n/a |
| L-133 | SectionedLogView — bookViewMode persistence | SectionedLogView.tsx:158-179 | URL `bookView` param; default `allTime` | n/a |
| L-134 | SectionedLogView — expandedFloors persistence | SectionedLogView.tsx:700-747 | localStorage `log-floor-expanded`; default all 4 expanded | n/a |
| L-135 | SectionedLogView — booksSidebarCollapsed persistence | SectionedLogView.tsx:574-594 | localStorage `books-sidebar-collapsed` | n/a |
| L-136 | LootLogFilters — Grid/List/All Weeks layout toggle | frontend/src/components/history/LootLogFilters.tsx:84-160 | 3-way segmented control; hidden on mobile (FAB used instead) | n/a |
| L-137 | LootLogFilters — Reset dropdown | LootLogFilters.tsx:165-277 | Week-scoped (Loot/Books/Data) + all-time (Loot/Books/All Data) reset items | Entire dropdown only rendered when `canEdit` |
| L-138 | LootLogFilters — "Log Week" button | LootLogFilters.tsx:291-303 | n/a | Only rendered when `canEdit && onLogWeek` |
| L-139 | LootLogFilters — "+ Log Loot" button (+ Alt+L tooltip) | LootLogFilters.tsx:305-321 | Opens `AddLootEntryModal` blank | Only in the `canEdit` action-button block |
| L-140 | LootLogFilters — "+ Log Material" button (+ Alt+M tooltip) | LootLogFilters.tsx:323-339 | Opens `LogMaterialModal` blank | Same as L-139 |
| L-141 | WeeklyLootGrid — floor header right-click context menu | frontend/src/components/history/WeeklyLootGrid.tsx:101-153 | "Log Floor Loot" / "Reset {floor} Loot" / "Reset {floor} Books" | Log item only if `canEdit && onLogFloor`; reset items only if `canEdit` |
| L-142 | WeeklyLootGrid — floor header "Log Floor" button | WeeklyLootGrid.tsx:531-547 | Opens `LogWeekWizard` single-floor mode | `canEdit && onLogFloor` |
| L-143 | WeeklyLootGrid — gear cell click (empty → log, filled → edit) | WeeklyLootGrid.tsx:572-628 | Edit takes priority over log when both possible | Both branches require `canEdit` |
| L-144 | WeeklyLootGrid — gear cell Shift+Click → copy entry URL | WeeklyLootGrid.tsx:578-596 | Copies deep link, clears text selection | Available to all roles (not canEdit-gated) |
| L-145 | WeeklyLootGrid — gear cell Alt+Click → navigate to player + highlight slot | WeeklyLootGrid.tsx:597-602 | `onNavigateToPlayer(recipientPlayerId, itemSlot)` | Available to all roles |
| L-146 | WeeklyLootGrid — gear cell right-click → context menu | WeeklyLootGrid.tsx:621, 233-311 | Edit / Copy URL / "Jump to {player}" / Delete | Edit/Delete require `canEdit`; Copy URL/Jump-to-Player always present |
| L-147 | WeeklyLootGrid — gear cell long-press (touch, 500ms) → context menu | WeeklyLootGrid.tsx:174-230, 622-625 | Touch-equivalent of right-click; suppresses the following tap | Same as L-146 |
| L-148 | WeeklyLootGrid — gear cell multi-entry "×N" badge → EntryPopover | WeeklyLootGrid.tsx:629-644 | Shown when more than 1 entry exists for that floor+slot this week | n/a |
| L-149 | WeeklyLootGrid — gear/material cell hover-tooltip listing shortcut hints | WeeklyLootGrid.tsx:650-681, 773-800 | Lists Click/Shift+Click/Alt+Click/Right-click meanings | n/a |
| L-150 | WeeklyLootGrid — recipient badge inline delete (×) on hover | WeeklyLootGrid.tsx:402-433 | Small × button appears on badge hover, deletes without opening edit modal | `canEdit && onDeleteLoot`/`onDeleteMaterial` |
| L-151 | WeeklyLootGrid — material cell click/Shift+Click/Alt+Click/right-click/long-press | WeeklyLootGrid.tsx:704-813 | Mirrors L-143-149 for material columns | Same gating pattern |
| L-152 | WeeklyLootGrid — static loot-fairness legend | WeeklyLootGrid.tsx:859-877 | Read-only key (Most/Average/Least drops) | n/a |
| L-153 | EntryPopover — entry-list click-to-edit | frontend/src/components/history/EntryPopover.tsx:92-98, 120-155 | Only clickable rows if `onEdit` provided | Effectively `canEdit`-gated by caller |
| L-154 | EntryPopover — dismiss on outside click / Escape / scroll / resize | EntryPopover.tsx:39-70 | n/a | n/a |
| L-155 | AllWeeksView — search input w/ structured filter syntax | frontend/src/components/history/AllWeeksView.tsx:213-268, 440-458 | Supports `slot:` `player:` `type:` `floor:` `method:` `week:` `job:` tokens plus free text, debounced 200ms | n/a |
| L-156 | AllWeeksView — Ctrl+Shift+F focuses search | AllWeeksView.tsx:111-120 | Global keydown listener | n/a |
| L-157 | AllWeeksView — clear-search (X) button | AllWeeksView.tsx:449-458 | n/a | n/a |
| L-158 | AllWeeksView — entry-type toggle (All/Gear/Materials) + Alt+1/2/3 custom event | AllWeeksView.tsx:122-131, 463-479 | Listens for `log:set-entry-type` custom event dispatched by the keyboard hook | n/a |
| L-159 | AllWeeksView — floor filter chips | AllWeeksView.tsx:482-503 | n/a | n/a |
| L-160 | AllWeeksView — sortable column headers | AllWeeksView.tsx:520-526 | Week/Floor/Slot/Player/Method/Date/Type, toggling asc/desc | n/a |
| L-161 | AllWeeksView — row click → edit | AllWeeksView.tsx:311-333, 554-560 | n/a | Requires `canEdit` |
| L-162 | AllWeeksView — row Shift+Click → copy URL | AllWeeksView.tsx:312-318 | n/a | Available to all roles |
| L-163 | AllWeeksView — row Alt+Click → navigate to player | AllWeeksView.tsx:319-324 | n/a | Available to all roles |
| L-164 | AllWeeksView — row right-click → context menu | AllWeeksView.tsx:335-414, 561 | Edit / Copy URL / "Jump to {player}" / "View Week N in Grid" / "View Week N in List" / Delete | Edit & Delete require `canEdit`; the rest always present |
| L-165 | AllWeeksView — stats footer (entry counts) | AllWeeksView.tsx:505-511 | n/a | n/a |
| L-166 | AllWeeksView — empty state text (filtered vs none-logged) | AllWeeksView.tsx:530-537 | No CTA button, text only | n/a |
| L-167 | LogEntryItems — loot row click/Shift+Click/Alt+Click | frontend/src/components/history/LogEntryItems.tsx:66-80 | Same triple-modifier pattern as grid | Shift/Alt available to all; plain click is a no-op (edit happens via icon buttons here, not row click) |
| L-168 | LogEntryItems — loot row inline Copy/Edit/Delete icon buttons | LogEntryItems.tsx:122-154 | n/a | Edit/Delete only rendered when `canEdit`; Copy always shown |
| L-169 | LogEntryItems — material row equivalent | LogEntryItems.tsx:187-267 | n/a | Same gating as L-168 |
| L-170 | FloorSection (list view) — click header to expand/collapse | frontend/src/components/history/FloorSection.tsx:116-138 | n/a | n/a |
| L-171 | FloorSection (list view) — right-click → Expand All/Collapse All | FloorSection.tsx:65-84, 147-155 | n/a | n/a |
| L-172 | LogFloatingActions — mobile FAB "Log Material" | frontend/src/components/history/LogFloatingActions.tsx:23-29 | n/a | Only `visible` when `canEdit` |
| L-173 | LogFloatingActions — mobile FAB "Log Loot" | LogFloatingActions.tsx:31-37 | n/a | Same as L-172 |
| L-174 | LogLayoutToggle — mobile floating Grid/List/All Weeks buttons | frontend/src/components/history/LogLayoutToggle.tsx:24-79 | n/a | n/a |
| L-175 | LootLogModals — composite modal mount | frontend/src/components/history/LootLogModals.tsx:176-283 | Mounts AddLootEntryModal, LogMaterialModal, MarkFloorClearedModal, EditBookBalanceModal, PlayerLedgerModal, ResetConfirmModal, ConfirmModal, ContextMenu as siblings | n/a |
| L-176 | AddLootEntryModal — Week/Floor fields | frontend/src/components/history/AddLootEntryModal.tsx:490-508 | n/a | n/a |
| L-177 | AddLootEntryModal — Item Slot select (filtered by floor) | AddLootEntryModal.tsx:511-522 | n/a | n/a |
| L-178 | AddLootEntryModal — recommendation panel (add mode only) | AddLootEntryModal.tsx:524-535 | Reuses `LootRecommendationCandidates` | n/a |
| L-179 | AddLootEntryModal — Recipient select + "Include Subs"/"Show all players" checkboxes | AddLootEntryModal.tsx:538-567 | Filter logic: neither = needs-only main roster; Include Subs = needs+subs fallback; Show all = everyone; both = everyone | n/a |
| L-180 | AddLootEntryModal — "No one needs this item! Enable 'Show all players' to assign anyway." hint | AddLootEntryModal.tsx:562-566 | Text-only hint pointing at the checkbox, not a button | n/a |
| L-181 | AddLootEntryModal — character selector (add mode, optional) | AddLootEntryModal.tsx:569-580 | Only shown when registrations exist for the recipient | n/a |
| L-182 | AddLootEntryModal — Method RadioGroup (Drop/Book) | AddLootEntryModal.tsx:583-592 | n/a | n/a |
| L-183 | AddLootEntryModal — "Also mark X as acquired" checkbox (add mode only) | AddLootEntryModal.tsx:594-601 | n/a | n/a |
| L-184 | AddLootEntryModal — Notes textarea | AddLootEntryModal.tsx:603-612 | n/a | n/a |
| L-185 | AddLootEntryModal — Cancel / Log Loot / Save Changes buttons | AddLootEntryModal.tsx:614-626 | Label switches by edit vs add mode | n/a |
| L-186 | AddLootEntryModal — edit mode preserves original recipient even if not "needed" | AddLootEntryModal.tsx:120-152, 270-294 | Ensures controlled Select never receives an option-less value | n/a |
| L-187 | LogMaterialModal — Week/Floor fields | frontend/src/components/history/LogMaterialModal.tsx:607-626 | n/a | n/a |
| L-188 | LogMaterialModal — material type button group | LogMaterialModal.tsx:628-665 | Twine/Glaze/Solvent/Universal Tomestone, filtered to what the floor drops | n/a |
| L-189 | LogMaterialModal — Recipient select + Include Subs/Show all players checkboxes | LogMaterialModal.tsx:667-697 | Same filter semantics as L-179 | n/a |
| L-190 | LogMaterialModal — "No one needs this material! Enable..." hint | LogMaterialModal.tsx:692-696 | n/a | n/a |
| L-191 | LogMaterialModal — Method RadioGroup (Drop/Book) | LogMaterialModal.tsx:699-712 | n/a | n/a |
| L-192 | LogMaterialModal — gear-update checkbox + slot/tome-weapon select | LogMaterialModal.tsx:714-801 | Mode-dependent (universal_tomestone/solvent/twine-glaze); edit mode also reconciles old-vs-new augmentation | n/a |
| L-193 | LogMaterialModal — Notes textarea | LogMaterialModal.tsx:803-812 | n/a | n/a |
| L-194 | LogMaterialModal — Cancel / Log Material / Save Changes buttons | LogMaterialModal.tsx:816-833 | n/a | n/a |
| L-195 | MarkFloorClearedModal — Week/Floor fields | frontend/src/components/history/MarkFloorClearedModal.tsx:125-144 | n/a | n/a |
| L-196 | MarkFloorClearedModal — player checklist + Select All/Clear | MarkFloorClearedModal.tsx:147-186 | Defaults to all configured main-roster players selected | n/a |
| L-197 | MarkFloorClearedModal — Notes textarea | MarkFloorClearedModal.tsx:189-197 | n/a | n/a |
| L-198 | MarkFloorClearedModal — Cancel / "Mark N Player(s)" submit | MarkFloorClearedModal.tsx:200-211 | Disabled when 0 players selected | n/a |
| L-199 | EditBookBalanceModal — Current (disabled) / New Balance inputs | frontend/src/components/history/EditBookBalanceModal.tsx:73-90 | n/a | n/a |
| L-200 | EditBookBalanceModal — adjustment preview (+/- delta) | EditBookBalanceModal.tsx:93-101 | Read-only, color-coded | n/a |
| L-201 | EditBookBalanceModal — Notes textarea | EditBookBalanceModal.tsx:104-112 | n/a | n/a |
| L-202 | EditBookBalanceModal — Cancel / Save buttons | EditBookBalanceModal.tsx:115-126 | Save disabled if `adjustment===0` | n/a |
| L-203 | PlayerLedgerModal — ledger history table | frontend/src/components/history/PlayerLedgerModal.tsx:111-168 | Date/Week/Floor/Book/Type/Qty/Notes columns, color-coded by transaction type | n/a |
| L-204 | PlayerLedgerModal — "Clear History" double-click-confirm button | PlayerLedgerModal.tsx:57-89, 183-205 | First click arms ("Confirm?"), second click executes `deletePlayerLedger` | Requires the general `canEdit` prop passed by SectionedLogView (owner/lead/admin), independent of the per-row `canEditThisRow` that let a member open their own ledger in the first place |
| L-205 | PlayerLedgerModal — Close button | PlayerLedgerModal.tsx:207-209 | n/a | n/a |
| L-206 | RevertWeekConfirmModal — data summary (Loot/Materials/Books lists) | frontend/src/components/history/RevertWeekConfirmModal.tsx:98-154 | Read-only preview of what will "move" after revert | n/a |
| L-207 | RevertWeekConfirmModal — Cancel / "Revert Week" buttons | RevertWeekConfirmModal.tsx:163-170 | n/a | Only reachable via canEdit-gated Revert trigger |
| L-208 | WeekStepper — Revert Week button | frontend/src/components/history/WeekStepper.tsx:182-216 | Tooltip explains behavior; disabled when `calculatedCurrentWeek<=1` | `onRevertWeek` only supplied when `canEdit` |
| L-209 | WeekStepper — Prev/Next week chevrons | WeekStepper.tsx:222-234, 297-309 | n/a | Available to all roles (read-only navigation) |
| L-210 | WeekStepper — week dot stepper (click a dot to jump) | WeekStepper.tsx:236-294 | Sliding 3-dot window centered on current week; tooltip lists logged entry types per week | Available to all roles |
| L-211 | WeekStepper — status dots (loot/books/mats logged indicator) | WeekStepper.tsx:43-80, 320 | Read-only 3-dot indicator per week | n/a |
| L-212 | WeekStepper — "Go to Current Week" target button | WeekStepper.tsx:322-342 | Jumps selector back to `calculatedCurrentWeek` | Available to all roles |
| L-213 | WeekStepper — "Start Next Week" button | WeekStepper.tsx:344-374 | n/a | `onStartNextWeek` only supplied when `canEdit` |
| L-214 | TeamSummaryEnhanced — "Mains only" toggle | frontend/src/components/team/TeamSummaryEnhanced.tsx:361-368 | Only shown if any character registrations exist; filters table to main-role characters | n/a |
| L-215 | TeamSummaryEnhanced — mobile collapse/expand stats toggle | TeamSummaryEnhanced.tsx:370-381 | n/a | n/a |
| L-216 | TeamSummaryEnhanced — per-player row (gear %, books I-IV, materials T/G/S) | TeamSummaryEnhanced.tsx:70-151 | Read-only, current/needed cells, Main/Alt/Sub role chip | n/a |
| L-217 | TeamSummaryEnhanced — aggregate stat cards (Players/BiS/Books/Materials) | TeamSummaryEnhanced.tsx:401-498 | Read-only | n/a |
| L-218 | TeamSummaryEnhanced — Team Total footer row | TeamSummaryEnhanced.tsx:525-559 | Read-only | n/a |
| L-219 | TeamSummaryEnhanced — legend footer | TeamSummaryEnhanced.tsx:563-572 | Read-only | n/a |
| L-220 | TeamSummaryEnhanced — empty state "No configured players to display" | TeamSummaryEnhanced.tsx:341-347 | No CTA button, text only | n/a |
| L-221 | Settings Priority tab — Mode/Advanced sub-nav | frontend/src/components/settings/PriorityTab.tsx:222-236 | Advanced sub-tab disabled (with tooltip) when mode is `disabled` | n/a |
| L-222 | Settings Priority tab — permission warning banner | PriorityTab.tsx:241-246 | "Only owners and leads can modify priority settings." | Shown when `!canEdit` |
| L-223 | Settings Priority tab — Priority Mode selector | frontend/src/components/priority/ModeSelector.tsx:55-77; mounted PriorityTab.tsx:255-262 | Dropdown: Role Based / Job Based / Player Based / Manual Planning / Disabled, each with description | `disabled={!canEdit}` |
| L-224 | Settings Priority tab — Role-based drag-reorder list | frontend/src/components/priority/RoleBasedEditor.tsx:148-183; mounted 265-274 | dnd-kit sortable list of 5 roles with computed "+N priority" hint | `disabled={!canEdit}` |
| L-225 | Settings Priority tab — Role-based "Reset to Default" button | RoleBasedEditor.tsx:171-180 | Disabled when already default order | n/a |
| L-226 | Settings Priority tab — Job-based tree editor | frontend/src/components/priority/JobBasedEditor.tsx:760-940; mounted 276-286 | Drag jobs between/within groups, drag-reorder groups, rename/delete/move-up/move-down groups, per-job priority offset, "In Use" badge | `disabled` prop cascades to all controls |
| L-227 | Settings Priority tab — Job-based "Show priority values" toggle | JobBasedEditor.tsx:764-770 | n/a | n/a |
| L-228 | Settings Priority tab — Job-based "Add Group"/"Reset" buttons | JobBasedEditor.tsx:772-791 | n/a | n/a |
| L-229 | Settings Priority tab — Job-based V key expand/collapse-all groups | JobBasedEditor.tsx:732-758 | Ignored while focus is in an input/textarea | n/a |
| L-230 | Settings Priority tab — Player-based tree editor | frontend/src/components/priority/PlayerBasedEditor.tsx:767-958; mounted 288-298 | Same drag/group semantics as Job-based, but per-player instead of per-job | Same gating as L-226 |
| L-231 | Settings Priority tab — Player-based empty state | PlayerBasedEditor.tsx:807-811 | "No configured players in the roster. Configure players first..." | n/a |
| L-232 | Settings Priority tab — Manual Planning mode info note | PriorityTab.tsx:300-307 | Static text, no in-panel config UI | n/a |
| L-233 | Settings Priority tab — Disabled mode info note | PriorityTab.tsx:309-316 | Static text | n/a |
| L-234 | Settings Priority tab (Advanced) — Calculation Preset selector | frontend/src/components/priority/PresetSelector.tsx:50-72 + AdvancedOptions.tsx:158-179 | Balanced / Strict Fairness / Gear Need Focus / Custom | n/a |
| L-235 | Settings Priority tab (Advanced) — "Show priority scores" toggle | frontend/src/components/priority/AdvancedOptions.tsx:184-203 | n/a | n/a |
| L-236 | Settings Priority tab (Advanced) — "Use weighted need" toggle | AdvancedOptions.tsx:209-225 | Weapon/Body/Legs weighted higher than accessories | n/a |
| L-237 | Settings Priority tab (Advanced) — "Enable player loot adjustments" toggle + "Edit Values" + Adjustment Multiplier input | AdvancedOptions.tsx:230-306 | Only shown when `players.length>0 && groupId && tierId` | n/a |
| L-238 | Player Adjustments Modal — per-player NumberInput, "Reset All", Cancel/Save | frontend/src/components/priority/PlayerAdjustmentsModal.tsx:101-170 | Save disabled unless changed vs stored `lootAdjustment` values | n/a |
| L-239 | Settings Priority tab (Advanced) — "Enable enhanced fairness" toggle + Drought Bonus/Cap + Balance Penalty/Cap inputs | AdvancedOptions.tsx:309-431 | n/a | n/a |
| L-240 | Settings Priority tab (Advanced) — "Enable priority multipliers" toggle + Role/Gear Need multiplier inputs | AdvancedOptions.tsx:437-511 | n/a | n/a |
| L-241 | Settings Priority tab — sticky "Save Changes" footer button | PriorityTab.tsx:335-346 | Disabled until `hasChanges` | Only rendered when `canEdit` |
| L-242 | Settings Priority tab — info-icon hover tooltips throughout | AdvancedOptions.tsx:36-60, used pervasively | Explains each setting's formula/effect | n/a |
| L-243 | Settings panel — Priority tab visibility gate | frontend/src/components/settings/SettingsPanel.tsx:57-65, 431-439 | `visible: (r,a) => isManager(r,a) \|\| isMemberRole(r)` — tab entirely absent for viewer | Owner/Lead/Admin: editable; Member: visible read-only (`readOnly={!canManage}`); Viewer: tab not rendered at all |
| L-244 | More page — "Loot History" DashboardCard | frontend/src/components/group/MorePage.tsx:146-170 | Shows items-logged count + last-entry date; click navigates to Gear/History sub-tab | Visible to all roles (read stats), navigation always allowed |
| L-245 | Keyboard: 4 key opens Loot Log tab | frontend/src/hooks/useGroupViewKeyboardShortcuts.ts:97 | Sets `pageMode('gear')` | n/a |
| L-246 | Keyboard: v key toggles expand/collapse (context-dependent) | useGroupViewKeyboardShortcuts.ts:100-117 | On legacy History sub-tab dispatches `log:toggle-expand-all`; on Priority sub-tab (or no legacy surface) dispatches `loot:toggle-expand-all` | Only registered when `legacyLootSurface` present (`!slots?.gear`) |
| L-247 | Keyboard: g key toggles grid/list layout on Loot Log sub-tab | useGroupViewKeyboardShortcuts.ts:118-126 | Dispatches `log:toggle-layout` | Same gate as L-246; distinct from Alt+G (Settings: General) |
| L-248 | Keyboard: Alt+1/Alt+2/Alt+3 switch Gear sub-tab (Priority/History/Stats) + History view/entry-type combo | useGroupViewKeyboardShortcuts.ts:144-163 | On History sub-tab also dispatches `log:set-view`/`log:set-entry-type` | Only registered when `legacyLootSurface` present |
| L-249 | Keyboard: Alt+ArrowLeft/Alt+ArrowRight for prev/next week | useGroupViewKeyboardShortcuts.ts:166-175 | Only active on Loot Log sub-tab; dispatches `log:prev-week`/`log:next-week` | Same gate as L-246 |
| L-250 | Keyboard: Alt+L opens Log Loot | useGroupViewKeyboardShortcuts.ts:178-184 | Switches to Gear/History, opens Log Loot modal | Requires `canEdit`; only registered when `legacyLootSurface` present |
| L-251 | Keyboard: Alt+U opens Log Material | useGroupViewKeyboardShortcuts.ts:185-191 | Same pattern as L-250 | Same gates |
| L-252 | Keyboard: Alt+B opens Mark Floor Cleared | useGroupViewKeyboardShortcuts.ts:192-198 | Same pattern | Same gates |
| L-253 | Keyboard: Alt+P opens Settings Priority tab | useGroupViewKeyboardShortcuts.ts:208-212 | `alwaysEnabled: true` (works even while another modal open) | Requires `canEdit` |
| L-254 | Dead/unmounted: FloorSelector.tsx | frontend/src/components/loot/FloorSelector.tsx:11-36 | Exported from `components/loot/index.ts` but not imported by any legacy mount point (superseded by FilterBar) — not user-reachable | n/a |
| L-255 | Dead/unmounted: SummaryPanel.tsx | frontend/src/components/loot/SummaryPanel.tsx | Exported from barrel but never imported elsewhere — not user-reachable | n/a |
| L-256 | Dead/unmounted: WeekSelector.tsx | frontend/src/components/history/WeekSelector.tsx:46 | No importers found anywhere in frontend/src — not user-reachable (superseded by WeekStepper) | n/a |
| L-257 | Dead/unmounted: UnifiedWeekOverview.tsx | frontend/src/components/history/UnifiedWeekOverview.tsx:225 | No importers found — not user-reachable | n/a |
| L-258 | Dead/unmounted (in legacy scope): PageBalancesPanel.tsx | frontend/src/components/history/PageBalancesPanel.tsx:43 | Only referenced by V2-only BookLedgerCard.tsx and the also-dead UnifiedWeekOverview.tsx — not reachable from the legacy path | n/a |
| L-259 | Dead/unmounted (in legacy scope): LootLogPanel.tsx | frontend/src/components/history/LootLogPanel.tsx:28 | No importers in the legacy GroupViewContent chain | n/a |
| L-260 | Dead/unmounted (in legacy scope): DeleteLootConfirmModal.tsx | frontend/src/components/history/DeleteLootConfirmModal.tsx:22 | Only used by V2-only Loot.tsx and dead LootLogPanel.tsx; the legacy SectionedLogView uses the generic ConfirmModal instead | n/a |
| P-01 | Permission diff — LootPriorityPanel "Log" buttons (gear & material lists) | LootPriorityPanel.tsx:1028 (`showLogButtons={canEdit}`), 645-654, 681-691 | Owner/Lead/Admin: buttons render and open Quick Log modals. Member/Viewer: buttons absent entirely (read-only priority list) | — |
| P-02 | Permission diff — "+ Log Floor" button (Gear Priority sub-tab) | LootPriorityPanel.tsx:614-622 | Owner/Lead/Admin only; Member/Viewer never see it | — |
| P-03 | Permission diff — Who Needs It Matrix dots/pies clickability | WhoNeedsItMatrix.tsx:388, 477 | Owner/Lead/Admin: colored dots/pies are clickable buttons. Member/Viewer: same dots render but `disabled`, cursor-default (visible, not clickable) | — |
| P-04 | Permission diff — WeaponPriorityCard "Log" buttons | WeaponPriorityList.tsx:352-367, 421-436, 524-536, 674-689, 802-816 | Owner/Lead/Admin only | — |
| P-05 | Permission diff — WeaponPriorityCard "Roll"/"Reroll" buttons | WeaponPriorityList.tsx:292-300, 537-546, 791-801 | NOT gated by `showLogButtons` — Member and Viewer can roll dice to break weapon-priority ties, same as Owner/Lead | — |
| P-06 | Permission diff — Quick Log modals never mount for non-editors | LootPriorityPanel.tsx:729, 748, 765 (`canShowLogButtons` gate) | Owner/Lead/Admin only; Member/Viewer clicking anywhere in priority views can never open QuickLogDropModal/QuickLogWeaponModal/QuickLogMaterialModal | — |
| P-07 | Permission diff — History/Loot Log editing actions | SectionedLogView.tsx (canEdit prop throughout) | Owner/Lead/Admin: Log Loot/Log Material/Log Week buttons, Reset dropdown, grid click-to-log/edit, delete buttons, context-menu Edit/Delete all present. Member/Viewer: none of these render | — |
| P-08 | Permission diff — Shift+Click (copy URL) / Alt+Click (navigate to player) | WeeklyLootGrid.tsx:578-602, 722-733; AllWeeksView.tsx:312-324 | Available to ALL roles including Viewer — these are read-only actions not gated by `canEdit` | — |
| P-09 | Permission diff — right-click context menu item split | WeeklyLootGrid.tsx:233-311; AllWeeksView.tsx:340-414 | "Copy URL" and "Jump to {player}" items shown to all roles; "Edit" and "Delete" items only pushed when `canEdit` | — |
| P-10 | Permission diff — Books sidebar per-cell edit | SectionedLogView.tsx:1398-1400, 1418-1441 | Owner/Lead/Admin: can edit any player's book cell. Member: can edit only their OWN row (`isOwnRow` via `player.userId===currentUserId`). Viewer: cannot edit any row | — |
| P-11 | Permission diff — Books sidebar "View book history" button | SectionedLogView.tsx:1443-1457 | Same per-row rule as P-10 (uses `canEditThisRow`) | — |
| P-12 | Permission diff — PlayerLedgerModal "Clear History" | PlayerLedgerModal.tsx:183-205; SectionedLogView.tsx:1826 (`canEdit={canEdit}` passed, not per-row) | A Member who opened their own ledger via P-10/P-11 still cannot see "Clear History" — it requires the general (owner/lead/admin) `canEdit`, not the per-row `canEditThisRow` | — |
| P-13 | Permission diff — "Mark Floor Cleared" button | SectionedLogView.tsx:1472, 1765 (`canEdit && userRole !== 'member'`) | Explicitly excludes `userRole==='member'` even though the `canEdit` set already excludes plain members — a deliberate double-gate per inline comment ("this button awards books to ALL players") | — |
| P-14 | Permission diff — Books column/row header context menus | SectionedLogView.tsx:1383-1384, 1408 | `onContextMenu` handler only attached (menu only openable) when `canEdit` is true; Member/Viewer rows have no context-menu affordance at all | — |
| P-15 | Permission diff — Mobile Controls Sheet reset buttons | GroupViewContent.tsx:1393 (`canManageRoster(userRole, isAdminAccess).allowed`) | Owner/Lead/Admin only — same role set as `canEdit` | — |
| P-16 | Permission diff — Settings Priority tab visibility | SettingsPanel.tsx:60, 431-439 | Owner/Lead/Admin: full edit access. Member: tab visible but every control `disabled` (`readOnly={!canManage}`). Viewer: tab entirely absent from Settings nav | — |
| P-17 | Permission diff — Settings Priority "Save Changes" footer | PriorityTab.tsx:335, 88 (`canEdit = (group.userRole==='owner'||'lead') && !readOnly`) | Rendered only for Owner/Lead; note this local `canEdit` check is derived from `readOnly` (which does fold in `isAdmin` via SettingsPanel's `canManage`) rather than checking `isAdmin` directly itself | — |
| P-18 | Permission diff — LogWeekWizard reachability | GroupViewContent.tsx:1447-1473; LootPriorityPanel.tsx:786-806; WeeklyLootGrid.tsx:531-547 | Every entry point into the wizard (Log Week, +Log Floor, floor-header Log Floor) is itself canEdit-gated, so Member/Viewer can never open it | — |
| P-19 | Permission diff — MarkFloorClearedModal reachability | SectionedLogView.tsx:1483, 1768; useGroupViewKeyboardShortcuts.ts:192-198 | Both the sidebar button and the Alt+B shortcut require `canEdit && userRole!=='member'`, so only Owner/Lead/Admin can ever open this modal | — |
