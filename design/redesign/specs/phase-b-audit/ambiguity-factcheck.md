# Phase B — §13.3 Ambiguity Fact-Check Verdicts (code-verified 2026-07-26)

Q1 (D-43) — CERTAIN: legacy `gearSubTab==='sync'` mounts GearSyncDashboard INLINE in GroupViewContent.tsx:1008-1012; PluginPage.tsx:85 mounts a SECOND independent instance (plugin tab unslotted → shared both shells). Both audits were right — two mount points. Stale comment in PluginPage.test.tsx:4 ("deleted in Task 2") — deleted in cf25c92, restored in 9c8a770, live at HEAD.

Q2 (D-56) — CERTAIN: all three mobile reset buttons are inside `pageMode==='gear' && !slots?.gear && gearSubTab==='history' && canManageRoster(...)` (GroupViewContent.tsx:1393-1442) → suppressed whenever v2 supplies the gear slot; never double-rendered.

Q3 (D-12) — CERTAIN: RosterCharacterPanel has NO live Lodestone search — only "Link Player Hub character" (RosterCharacterMemberCard.tsx:85-91 → LinkPlayerHubCharacterModal) + "Add manual character" (:92-101 → AddManualCharacterModal) + passive CharacterSyncBadge (LinkPlayerHubCharacterModal.tsx:133). Mounted legacy GroupViewContent.tsx:948 + v2 CharacterManageBridge.tsx:31.

Q4 (D-21) — CERTAIN: v2 zero-tier state EXISTS — ShellContentStates.tsx:192-203 renders "No Raid Tiers" EmptyState with "Create First Tier" CTA gated `canEdit`.

Q5 (D-53) — CERTAIN: backtick/1-4 shortcuts FIRE under v2 (hook mounted in shared GroupViewContent.tsx:487-517; NewShell renders it with slots). Keys: `` ` ``=overview, 1=schedule, 2=roster, 3=goals, 4=gear (useGroupViewKeyboardShortcuts.ts:93-97). Key 3 (goals) lands on the unslotted shared GoalsPage in both shells.

Q6 (§4.K) — CERTAIN: v2 Schedule "Edit week" modal mounts the FULL AvailabilityGrid (Schedule.tsx:484-501; no mode-lock prop exists — AvailabilityGrid.tsx:43-52). Typical-week toggle (grid :551-568) and QuickFillHelper (:618, this-week + canEditAvailability) both reachable inside the modal.

Q7 (A11) — CERTAIN on gate diff: v2 BookLedgerCard.tsx:120-124 gates "Mark floor cleared" on `canEdit` ONLY; legacy SectionedLogView.tsx:1472 adds `userRole !== 'member'`. Divergence case: site-admin whose static role is 'member' with adminMode on (isAdminAccess=true) → sees the action in v2, not in legacy. (canEdit shapes otherwise identical: useStaticPermissions.ts:57 vs HistoryView.tsx:241.)

Q8 (D-50) — CERTAIN on asymmetry: Leave Static suppressed under View-As (GroupViewContent.tsx:1186-1194 withholds onLeaveStatic when viewAsUser). Delete Static button NOT suppressed — MorePage isOwner uses view-as-ADJUSTED userRole (GroupViewContent.tsx:367,1213; MorePage.tsx:74,379-386), so an impersonated owner sees it. PROBABLE (not certain): downstream StaticTab re-gates via store's group.userRole (V2SettingsHost.tsx:19, StaticTab.tsx:40) which is NOT view-as-adjusted — deeper delete flow likely re-blocks, unverifiable from frontend alone (backend semantics for admin-viewing).
