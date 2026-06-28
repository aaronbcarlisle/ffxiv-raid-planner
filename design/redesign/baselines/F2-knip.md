# F2 dead-code baseline (knip)

- Captured: 2026-06-28 on `redesign/f2-anti-regression`.
- **Post-Task-4 (2026-06-28):** Unused files: 11 · unused exports: 186 · unused exported types: 115 · duplicate exports: 24 · unused deps: 2 · unlisted deps: 0.
- Pre-Task-4 snapshot: Unused files: 28 · unused exports: 186 · unused exported types: 115 · duplicate exports: 24 · unused deps: 2.
- Policy: report-only in CI (`continue-on-error`). Truly app-orphaned code is
  deleted in Task 4; dead code that exists only because it lives on an
  F6-doomed screen (MorePage, Loot Log, old Schedule) is NOT deleted — it goes
  away when the screen is rebuilt (F6).

## Task 4 deletion summary

17 files deleted in commit `b21b0e0` (refactor(deadcode): delete truly-orphaned exports/files):

| Deleted file | Reason |
|---|---|
| `src/components/dnd/EdgeDropZone.tsx` | zero references; replaced by newer dnd approach |
| `src/components/dnd/index.ts` | barrel with no importer; removed alongside EdgeDropZone |
| `src/components/player/AddSlotCard.tsx` | zero references anywhere |
| `src/components/player/BiSTargetPanel.tsx` | zero references outside bisTargetStore |
| `src/components/player/index.ts` | barrel with no importer (all player imports are direct) |
| `src/components/priority/ManualPlanningEditor.tsx` | zero references outside priority folder |
| `src/components/priority/index.ts` | barrel with no importer |
| `src/components/profile/ReadinessChecklist.tsx` | zero references anywhere |
| `src/components/team/index.ts` | barrel with no importer |
| `src/components/ui/GearStatusCheckbox.tsx` | zero references anywhere |
| `src/components/weapon-priority/WeaponJobSelector.tsx` | only used by WeaponPriorityEditor (also deleted) |
| `src/components/weapon-priority/WeaponPriorityEditor.tsx` | zero external references; replaced by WeaponPriorityGrid |
| `src/components/weapon-priority/WeaponPriorityListItem.tsx` | only used by WeaponPriorityEditor (also deleted) |
| `src/hooks/useLootActions.ts` | zero references anywhere |
| `src/hooks/useWeeklyAssignments.ts` | only used by ManualPlanningEditor (also deleted) |
| `src/pages/AdminDashboard.tsx` | not in router; replaced by pages/admin/* sub-pages |
| `src/stores/bisTargetStore.ts` | only imported by BiSTargetPanel (also deleted) |

## Remaining 11 unused files (deliberate keeps)

| File | Keep reason |
|---|---|
| `src/components/collections/CatalogFarmRow.tsx` | Collections feature in active development; stores exist; no doomed classification |
| `src/components/collections/SuggestionFarmCard.tsx` | Same — comment reference in collectionBadgeConfig.ts confirms planned use |
| `src/components/history/DeleteLootConfirmModal.tsx` | F6-doomed (Loot Log screen rebuild) |
| `src/components/history/LootLogPanel.tsx` | F6-doomed (Loot Log screen rebuild) |
| `src/components/history/PageBalancesPanel.tsx` | F6-doomed (Loot Log screen rebuild) |
| `src/components/history/UnifiedWeekOverview.tsx` | F6-doomed (Loot Log screen rebuild) |
| `src/components/history/WeekSelector.tsx` | F6-doomed (Loot Log screen rebuild) |
| `src/components/layout/index.ts` | False-positive: DesignSystem.tsx imports PageContainer via barrel path |
| `src/components/mount-farms/index.ts` | F6-doomed (Mount Farms screen rebuild) |
| `src/components/mount-farms/MountFarmTab.tsx` | F6-doomed (Mount Farms screen rebuild) |
| `src/components/profile/GearSnapshotView.tsx` | vi.mock reference in JobsGearTab.test.tsx; conservative keep |

## Notes on findings

- **Unused deps**: `@radix-ui/react-dialog` and `tailwindcss` are flagged — both
  are actively used (tailwindcss via Vite plugin, react-dialog via Radix
  imports). These are knip false-positives for Vite/CSS-in-JS packages.
- **Unused exports (186 + 115 types)**: Predominantly barrel re-exports that
  have no importer in the current entry-point graph, utility types for
  documentation/future use, and store selectors/hooks not yet wired to the new
  nav-rail surfaces. Not targeted for deletion in this task — most are
  false-positives or doomed-surface code.
- **Configuration hints**: knip suggests removing `src/styles/tokens.generated.css`
  from ignore and some redundant entry patterns (`src/main.tsx`, `vite.config.ts`,
  `eslint.config.js`); kept as-is to be explicit.

## Findings (raw)

```
> frontend@0.0.0 deadcode
> knip

Unused files (28)
src/components/collections/CatalogFarmRow.tsx
src/components/collections/SuggestionFarmCard.tsx
src/components/dnd/EdgeDropZone.tsx
src/components/dnd/index.ts
src/components/history/DeleteLootConfirmModal.tsx
src/components/history/LootLogPanel.tsx
src/components/history/PageBalancesPanel.tsx
src/components/history/UnifiedWeekOverview.tsx
src/components/history/WeekSelector.tsx
src/components/layout/index.ts
src/components/mount-farms/index.ts
src/components/mount-farms/MountFarmTab.tsx
src/components/player/AddSlotCard.tsx
src/components/player/BiSTargetPanel.tsx
src/components/player/index.ts
src/components/priority/index.ts
src/components/priority/ManualPlanningEditor.tsx
src/components/profile/GearSnapshotView.tsx
src/components/profile/ReadinessChecklist.tsx
src/components/team/index.ts
src/components/ui/GearStatusCheckbox.tsx
src/components/weapon-priority/WeaponJobSelector.tsx
src/components/weapon-priority/WeaponPriorityEditor.tsx
src/components/weapon-priority/WeaponPriorityListItem.tsx
src/hooks/useLootActions.ts
src/hooks/useWeeklyAssignments.ts
src/pages/AdminDashboard.tsx
src/stores/bisTargetStore.ts
Unused dependencies (2)
@radix-ui/react-dialog  package.json:41:6
tailwindcss             package.json:58:6
Unused exports (186)
AdminSidebar                               src/components/admin/index.ts:2:10
AdminKpiCard                               src/components/admin/index.ts:3:10
ProtectedRoute                             src/components/auth/index.ts:6:10
ProtectedRoute                   function  src/components/auth/ProtectedRoute.tsx:26:17
calculateDropMode                function  src/components/dnd/collisionDetection.ts:17:17
createSwapInsertCollision        function  src/components/dnd/collisionDetection.ts:34:17
getDropModeForDroppable          function  src/components/dnd/collisionDetection.ts:52:17
DualCodeBlock                    function  src/components/docs/CodeBlock.tsx:174:17
DualCodeBlock                              src/components/docs/index.ts:5:21
default                          function  src/components/history/FloorSection.tsx:160:16
default                          function  src/components/history/LootCountBar.tsx:127:16
default                          function  src/components/history/WeekStepper.tsx:379:16
ROLE_FILTERS                               src/components/loot/FilterBar.tsx:24:14
default                          function  src/components/loot/FilterBar.tsx:152:16
FloorSelector                    function  src/components/loot/FloorSelector.tsx:11:17
FilterBar                                  src/components/loot/index.ts:1:10
ROLE_FILTERS                               src/components/loot/index.ts:1:21
FloorSelector                              src/components/loot/index.ts:2:10
QuickLogDropModal                          src/components/loot/index.ts:4:10
QuickLogWeaponModal                        src/components/loot/index.ts:5:10
RoleSection                                src/components/loot/index.ts:7:10
ROLE_SECTION_CONFIGS                       src/components/loot/index.ts:7:23
getRoleSectionConfig                       src/components/loot/index.ts:7:45
SummaryPanel                               src/components/loot/index.ts:8:10
WeaponPriorityList                         src/components/loot/index.ts:9:10
WhoNeedsItMatrix                           src/components/loot/index.ts:10:10
ROLE_SECTION_CONFIGS                       src/components/loot/RoleSection.tsx:144:14
getRoleSectionConfig             function  src/components/loot/RoleSection.tsx:155:17
default                          function  src/components/loot/RoleSection.tsx:159:16
SummaryPanel                     function  src/components/loot/SummaryPanel.tsx:21:17
WeaponPriorityCard                         src/components/loot/WeaponPriorityList.tsx:112:14
default                          function  src/components/loot/WhoNeedsItMatrix.tsx:687:16
default                          function  src/components/player/AddPlayerModal.tsx:301:16
default                          function  src/components/player/GearSourceBadge.tsx:62:16
default                          function  src/components/player/LightPartyHeader.tsx:135:16
DropdownCheckboxItem                       src/components/primitives/index.ts:9:3
PopoverClose                               src/components/primitives/index.ts:20:19
createRoleColorClasses                     src/components/primitives/index.ts:23:3
createColoredTriggerClasses                src/components/primitives/index.ts:25:3
VisuallyHidden                             src/components/primitives/index.ts:29:10
PopoverClose                               src/components/primitives/Popover.tsx:129:14
createRoleColorClasses           function  src/components/primitives/popoverSelectHelpers.ts:19:17
createColoredTriggerClasses      function  src/components/primitives/popoverSelectHelpers.ts:93:17
getVisibilityLabel               function  src/components/profile/jobGearUtils.ts:130:17
START_HOUR                                 src/components/schedule/availabilityUtils.ts:20:14
END_HOUR                                   src/components/schedule/availabilityUtils.ts:21:14
RAID_HOURS_START                           src/components/schedule/availabilityUtils.ts:22:14
RAID_HOURS_END                             src/components/schedule/availabilityUtils.ts:23:14
generateTimeSlots                function  src/components/schedule/availabilityUtils.ts:109:17
TIME_SLOTS                                 src/components/schedule/availabilityUtils.ts:119:14
localSlotToUtc                   function  src/components/schedule/availabilityUtils.ts:156:17
utcSlotToLocal                   function  src/components/schedule/availabilityUtils.ts:164:17
ApiKeyManager                              src/components/settings/index.ts:1:10
StaticTab                                  src/components/settings/index.ts:5:10
GeneralTab                                 src/components/settings/index.ts:6:10
PriorityTab                                src/components/settings/index.ts:7:10
MembersPanel                               src/components/static-group/index.ts:6:10
JoinRequestModal                           src/components/static-group/index.ts:8:10
JoinRequestsPanel                          src/components/static-group/index.ts:9:10
JoinRequestReviewModal                     src/components/static-group/index.ts:10:10
InlineError                      function  src/components/ui/ErrorMessage.tsx:129:17
InputGroup                                 src/components/ui/index.ts:7:10
ItemHoverCard                              src/components/ui/index.ts:8:10
InlineError                                src/components/ui/index.ts:16:24
ProgressRing                               src/components/ui/index.ts:18:10
ResetConfirmModal                          src/components/ui/index.ts:20:10
SettingsPopover                            src/components/ui/index.ts:23:10
SlideOutPanel                              src/components/ui/index.ts:24:10
Skeleton                                   src/components/ui/index.ts:27:3
PlayerCardSkeleton                         src/components/ui/index.ts:28:3
PlayerGridSkeleton                         src/components/ui/index.ts:29:3
TableRowSkeleton                           src/components/ui/index.ts:30:3
TableSkeleton                              src/components/ui/index.ts:31:3
ListItemSkeleton                           src/components/ui/index.ts:32:3
ListSkeleton                               src/components/ui/index.ts:33:3
CardSkeleton                               src/components/ui/index.ts:34:3
PageSkeleton                               src/components/ui/index.ts:35:3
StaticCardSkeleton                         src/components/ui/index.ts:36:3
StaticListItemSkeleton                     src/components/ui/index.ts:38:3
SpinnerOverlay                             src/components/ui/index.ts:41:19
TabNavigation                              src/components/ui/index.ts:43:10
ThreeStateCheckbox                         src/components/ui/index.ts:46:10
Toast                                      src/components/ui/index.ts:48:10
ToastContainer                             src/components/ui/index.ts:49:10
default                          variable  src/components/ui/Input.tsx:141:16
default                          function  src/components/ui/InputGroup.tsx:70:16
default                          function  src/components/ui/Label.tsx:66:16
default                          variable  src/components/ui/NumberInput.tsx:279:16
default                          function  src/components/ui/ProgressRing.tsx:136:16
default                          function  src/components/ui/RadioGroup.tsx:145:16
default                          function  src/components/ui/SearchableSelect.tsx:451:16
default                          function  src/components/ui/Select.tsx:262:16
SettingsPopover                  function  src/components/ui/SettingsPopover.tsx:36:17
PlayerCardSkeleton               function  src/components/ui/Skeleton.tsx:27:17
PlayerGridSkeleton               function  src/components/ui/Skeleton.tsx:59:17
TableRowSkeleton                 function  src/components/ui/Skeleton.tsx:72:17
TableSkeleton                    function  src/components/ui/Skeleton.tsx:87:17
ListItemSkeleton                 function  src/components/ui/Skeleton.tsx:113:17
ListSkeleton                     function  src/components/ui/Skeleton.tsx:129:17
CardSkeleton                     function  src/components/ui/Skeleton.tsx:142:17
StaticCardSkeleton               function  src/components/ui/Skeleton.tsx:189:17
StaticListItemSkeleton           function  src/components/ui/Skeleton.tsx:229:17
default                          function  src/components/ui/SlideOutPanel.tsx:278:16
SpinnerOverlay                   function  src/components/ui/Spinner.tsx:47:17
TabNavigation                    function  src/components/ui/TabNavigation.tsx:31:17
default                          variable  src/components/ui/TextArea.tsx:85:16
toThreeState                     function  src/components/ui/ThreeStateCheckbox.tsx:103:17
fromThreeState                   function  src/components/ui/ThreeStateCheckbox.tsx:110:17
Toast                            function  src/components/ui/Toast.tsx:10:17
default                          variable  src/components/ui/Toggle.tsx:158:16
WizardProgress                             src/components/wizard/index.ts:6:10
WizardNavigation                           src/components/wizard/index.ts:7:10
RosterSlot                                 src/components/wizard/index.ts:8:10
StaticDetailsStep                          src/components/wizard/index.ts:11:10
RosterSetupStep                            src/components/wizard/index.ts:12:10
ReviewStep                                 src/components/wizard/index.ts:13:10
ShareStep                                  src/components/wizard/index.ts:14:10
INITIAL_ROSTER                             src/components/wizard/index.ts:18:10
STEP_TITLES                                src/components/wizard/index.ts:18:26
isBrowser                                  src/config.ts:12:14
hostname                                   src/config.ts:13:14
SHORTCUTS_ENABLED_KEY                      src/hooks/useKeyboardShortcuts.ts:46:14
useWeekSummary                   function  src/hooks/useWeekSummary.ts:61:17
formatMaterials                  function  src/hooks/useWeekSummary.ts:154:17
formatBookChange                 function  src/hooks/useWeekSummary.ts:170:17
fadeIn                                     src/lib/motion.ts:19:14
slideUp                                    src/lib/motion.ts:25:14
scaleIn                                    src/lib/motion.ts:31:14
pageTransition                             src/lib/motion.ts:60:14
springTransition                           src/lib/motion.ts:109:14
smoothTransition                           src/lib/motion.ts:115:14
prefTabPersistence               function  src/lib/navPreferences.ts:28:17
SEEN_RELEASES_KEY                          src/lib/syntheticNotifications.ts:5:14
subscribeSyntheticNotifications  function  src/lib/syntheticNotifications.ts:16:17
getSyntheticUnreadCount          function  src/lib/syntheticNotifications.ts:64:17
checkHealth                      function  src/services/api.ts:275:23
debounce                         function  src/services/api.ts:411:17
useSharedBisTargets              function  src/stores/sharedBisStore.ts:126:17
useSharedBisActiveTarget         function  src/stores/sharedBisStore.ts:130:17
IMPORT_STATUS_LABELS                       src/stores/sharedBisStore.ts:165:14
useCurrentTier                             src/stores/tierStore.ts:821:14
useCurrentTierId                           src/stores/tierStore.ts:826:14
useTiers                                   src/stores/tierStore.ts:831:14
useTierIsLoading                           src/stores/tierStore.ts:850:14
useTierIsSaving                            src/stores/tierStore.ts:855:14
useTierError                               src/stores/tierStore.ts:860:14
usePlayer                                  src/stores/tierStore.ts:865:14
usePlayerByPosition                        src/stores/tierStore.ts:871:14
useConfiguredPlayers                       src/stores/tierStore.ts:878:14
usePlayersByGroup                          src/stores/tierStore.ts:885:14
useWeaponPrioritySettings                  src/stores/tierStore.ts:900:14
useEffectiveRole                 function  src/stores/viewAsStore.ts:86:17
useEffectiveUserId               function  src/stores/viewAsStore.ts:100:17
useIsViewingAs                   function  src/stores/viewAsStore.ts:113:17
BIS_SOURCE_COLORS                          src/types/index.ts:48:14
BIS_SOURCE_BG_COLORS                       src/types/index.ts:56:14
GEAR_SLOT_FILLED_ICONS                     src/types/index.ts:518:14
CONTEXT_MENU_ICONS                         src/types/index.ts:533:14
calculateTeamSummary             function  src/utils/calculations.ts:183:17
RAID_JOBS                                  src/utils/constants.ts:10:3
ROLE_CONFIG                                src/utils/constants.ts:11:3
JOB_DISPLAY_NAMES                          src/utils/constants.ts:12:3
getRoleForJob                              src/utils/constants.ts:13:3
getJobDisplayName                          src/utils/constants.ts:14:3
getCurrentTier                             src/utils/constants.ts:15:3
RAID_TIERS                                 src/utils/constants.ts:16:3
GEAR_SLOTS                                 src/utils/constants.ts:19:10
GEAR_SLOT_NAMES                            src/utils/constants.ts:19:22
DEFAULT_DISPLAY_ORDER                      src/utils/constants.ts:23:14
DEFAULT_LOOT_PRIORITY                      src/utils/constants.ts:26:14
RAID_FLOORS                                src/utils/constants.ts:71:14
getDefaultBisSource              function  src/utils/gearDefaults.ts:22:17
createDefaultGear                function  src/utils/gearDefaults.ts:42:17
getPrioritySuggestionsForSlot    function  src/utils/lootCoordination.ts:404:17
canViewRequests                  function  src/utils/permissions.ts:245:17
canActOnRequests                 function  src/utils/permissions.ts:272:17
getEffectivePriorityMode         function  src/utils/priority.ts:38:17
getDefaultPositionForRole        function  src/utils/priority.ts:610:17
getPublicAppUrl                  function  src/utils/publicUrl.ts:30:17
formatRunSlot                    function  src/utils/splitClearHelpers.ts:42:17
getRunSlotTone                   function  src/utils/splitClearHelpers.ts:48:17
SPLIT_SCORING_WEIGHTS                      src/utils/splitClearScoringService.ts:12:14
isSyncRecent                     function  src/utils/splitClearScoringService.ts:31:17
scoreRunPair                     function  src/utils/splitClearScoringService.ts:59:17
resolveCharacterForPlayer        function  src/utils/staticCharacterContextService.ts:27:17
getAllWeaponPriorities           function  src/utils/weaponPriority.ts:139:17
Unused exported types (115)
EnhancedCollision            interface  src/components/dnd/collisionDetection.ts:6:18
CodeLanguage                 type       src/components/docs/CodeBlock.tsx:87:13
CodeLanguage                 type       src/components/docs/index.ts:6:15
NavGroup                     type       src/components/docs/index.ts:9:15
NavItem                      type       src/components/docs/index.ts:9:25
NavItem                      interface  src/components/docs/NavSidebar.tsx:16:18
NavGroup                     interface  src/components/docs/NavSidebar.tsx:21:18
ContainerVariant             type       src/components/layout/PageContainer.tsx:21:13
RoleFilter                   interface  src/components/loot/FilterBar.tsx:14:18
RoleFilter                   type       src/components/loot/index.ts:1:40
RoleSectionConfig            type       src/components/loot/index.ts:7:72
SlotEntry                    interface  src/components/loot/LogWeekWizard/types.ts:15:18
RoleSectionConfig            interface  src/components/loot/RoleSection.tsx:20:18
TieStyle                     type       src/components/loot/WeaponPriorityList.tsx:87:13
BadgeVariant                 type       src/components/primitives/Badge.tsx:7:13
ButtonVariant                type       src/components/primitives/Button.tsx:8:13
ButtonSize                   type       src/components/primitives/Button.tsx:9:13
ButtonVariant                type       src/components/primitives/index.ts:6:23
ButtonSize                   type       src/components/primitives/index.ts:6:43
PopoverSelectOption          type       src/components/primitives/index.ts:21:30
PopoverSelectProps           type       src/components/primitives/index.ts:21:56
PopoverSelectOption          interface  src/components/primitives/PopoverSelect.tsx:39:18
ActivityItemType             type       src/components/profile/ActivityFeed.tsx:21:13
ProfileDataDomain            type       src/components/profile/profileSyncDomains.ts:8:13
ProfileDomainStatus          type       src/components/profile/profileSyncDomains.ts:18:13
ProfileDomainSource          type       src/components/profile/profileSyncDomains.ts:19:13
SettingsSubNavItem           interface  src/components/settings/SettingsSubNav.tsx:13:18
GameIconName                 type       src/components/ui/GameIcon.tsx:76:15
GameIconSize                 type       src/components/ui/GameIcon.tsx:76:34
InputProps                   type       src/components/ui/index.ts:6:22
LabelProps                   type       src/components/ui/index.ts:11:22
ErrorMessageProps            type       src/components/ui/index.ts:16:52
ErrorBoxProps                type       src/components/ui/index.ts:16:76
NumberInputProps             type       src/components/ui/index.ts:17:28
RadioGroupProps              type       src/components/ui/index.ts:19:27
RadioOption                  type       src/components/ui/index.ts:19:49
SelectProps                  type       src/components/ui/index.ts:21:23
SearchableSelectProps        type       src/components/ui/index.ts:22:33
GroupConfig                  type       src/components/ui/index.ts:22:61
SpinnerSize                  type       src/components/ui/index.ts:41:40
SpinnerColor                 type       src/components/ui/index.ts:41:58
TextAreaProps                type       src/components/ui/index.ts:45:25
TabItem                      type       src/components/ui/index.ts:50:21
Tone                         type       src/components/ui/index.ts:51:20
ToggleProps                  type       src/components/ui/index.ts:53:23
RadioOption                  interface  src/components/ui/RadioGroup.tsx:20:18
ResetScope                   type       src/components/ui/ResetConfirmModal.tsx:16:13
ResetTarget                  type       src/components/ui/ResetConfirmModal.tsx:19:13
SpinnerSize                  type       src/components/ui/Spinner.tsx:7:13
SpinnerColor                 type       src/components/ui/Spinner.tsx:8:13
TabItem                      interface  src/components/ui/Tabs.tsx:10:18
Tone                         type       src/components/ui/Tag.tsx:15:13
WizardState                  type       src/components/wizard/index.ts:17:15
WizardPlayer                 type       src/components/wizard/index.ts:17:28
WizardStep                   type       src/components/wizard/index.ts:17:42
CommitInfo                   interface  src/data/releaseNotes.ts:16:18
MaterialEntry                interface  src/hooks/useWeekSummary.ts:18:18
PlayerWeekSummary            interface  src/hooks/useWeekSummary.ts:24:18
EventName                    type       src/lib/eventBus.ts:148:13
Logger                       type       src/lib/logger.ts:147:13
ScopedLogger                 type       src/lib/logger.ts:148:13
HealthResponse               interface  src/services/api.ts:267:18
DebouncedFn                  type       src/services/api.ts:402:13
ParticipantSummary           interface  src/stores/collectionGoalStore.ts:101:18
ParticipantStateUpsert       interface  src/stores/collectionGoalStore.ts:185:18
RewardDropCreate             interface  src/stores/collectionGoalStore.ts:192:18
IntentPriority               type       src/stores/collectionIntentStore.ts:7:13
DossierHuntingEntry          interface  src/stores/collectionIntentStore.ts:45:18
CollectionSnapshotUpsert     interface  src/stores/collectionIntentStore.ts:72:18
CollectionIntentUpsert       interface  src/stores/collectionIntentStore.ts:77:18
VoteSummary                  interface  src/stores/contentSuggestionStore.ts:11:18
RosterReadiness              interface  src/stores/objectiveCommandStore.ts:13:18
GoalAlignmentSummary         interface  src/stores/objectiveCommandStore.ts:18:18
BiSReadiness                 interface  src/stores/objectiveCommandStore.ts:24:18
LinkedCollectionGoal         interface  src/stores/objectiveCommandStore.ts:29:18
NextSession                  interface  src/stores/objectiveCommandStore.ts:36:18
GoalAlignmentItem            interface  src/stores/objectiveGoalStore.ts:24:18
JobPriority                  type       src/stores/playerProfileStore.ts:98:13
GearReadiness                type       src/stores/playerProfileStore.ts:99:13
GoalStatus                   type       src/stores/playerProfileStore.ts:100:13
ToastAction                  interface  src/stores/toastStore.ts:11:18
Job                          type       src/types/index.ts:9:15
Role                         type       src/types/index.ts:9:20
JobInfo                      type       src/types/index.ts:9:26
PriorityMode                 type       src/types/index.ts:315:13
RoleBasedConfig              interface  src/types/index.ts:351:18
AuthTokens                   interface  src/types/index.ts:604:18
GroupSource                  type       src/types/index.ts:623:13
OwnerInfo                    interface  src/types/index.ts:646:18
PageAdjustments              interface  src/types/index.ts:861:18
RolloverRequest              interface  src/types/index.ts:869:18
JoinRequestStatus            type       src/types/index.ts:929:13
RequesterInfo                interface  src/types/index.ts:931:18
AvailabilitySnapshotSummary  interface  src/types/index.ts:952:18
BiSGearSlotData              interface  src/types/index.ts:1081:18
BiSCategory                  type       src/types/index.ts:1126:13
BisTargetSource              type       src/types/index.ts:1136:13
BisTargetSet                 interface  src/types/index.ts:1207:18
TransactionType              type       src/types/index.ts:1229:13
WeeklyAssignment             interface  src/types/index.ts:1382:18
WeeklyAssignmentCreate       interface  src/types/index.ts:1399:18
WeeklyAssignmentUpdate       interface  src/types/index.ts:1410:18
WeeklyAssignmentBulkItem     interface  src/types/index.ts:1418:18
WeeklyAssignmentBulkCreate   interface  src/types/index.ts:1427:18
WeeklyAssignmentBulkDelete   interface  src/types/index.ts:1434:18
DiscordInstallClaimStatus    type       src/types/index.ts:1485:13
DiscordLinkStatus            type       src/types/index.ts:1486:13
ExceptionType                type       src/types/index.ts:1620:13
UserAvailabilitySlot         interface  src/types/index.ts:1665:18
AvailabilityTemplateSlot     interface  src/types/index.ts:1683:18
AvailabilityTemplateSubmit   interface  src/types/index.ts:1696:18
PrioritySuggestion           interface  src/utils/lootCoordination.ts:49:18
DropType                     type       src/utils/lootRecommendationService.ts:30:13
RunPairScore                 interface  src/utils/splitClearScoringService.ts:54:18
DraftSourceSummary           interface  src/utils/splitClearSuggestionService.ts:43:18
Duplicate exports (24)
FloorSection|default      src/components/history/FloorSection.tsx
LootCountBar|default      src/components/history/LootCountBar.tsx
WeekStepper|default       src/components/history/WeekStepper.tsx
FilterBar|default         src/components/loot/FilterBar.tsx
RoleSection|default       src/components/loot/RoleSection.tsx
WhoNeedsItMatrix|default  src/components/loot/WhoNeedsItMatrix.tsx
AddPlayerModal|default    src/components/player/AddPlayerModal.tsx
GearSourceBadge|default   src/components/player/GearSourceBadge.tsx
LightPartyHeader|default  src/components/player/LightPartyHeader.tsx
Input|default             src/components/ui/Input.tsx
InputGroup|default        src/components/ui/InputGroup.tsx
Label|default             src/components/ui/Label.tsx
NumberInput|default       src/components/ui/NumberInput.tsx
ProgressRing|default      src/components/ui/ProgressRing.tsx
RadioGroup|default        src/components/ui/RadioGroup.tsx
SearchableSelect|default  src/components/ui/SearchableSelect.tsx
Select|default            src/components/ui/Select.tsx
SlideOutPanel|default     src/components/ui/SlideOutPanel.tsx
TextArea|default          src/components/ui/TextArea.tsx
Toggle|default            src/components/ui/Toggle.tsx
DesignSystem|default      src/pages/DesignSystem.tsx
Discover|default          src/pages/Discover.tsx
DocsIndex|default         src/pages/DocsIndex.tsx
PrivacyDocs|default       src/pages/PrivacyDocs.tsx
Configuration hints (4)
src/styles/tokens.generated.css    knip.json  Remove from ignore
src/main.tsx                       knip.json  Remove redundant entry pattern
vite.config.ts                     knip.json  Remove redundant entry pattern
eslint.config.js                   knip.json  Remove redundant entry pattern
```
