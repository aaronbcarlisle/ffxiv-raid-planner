# Flip P1 — Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every hard parity gap that would be silent breakage the moment v2 becomes the default group route (parity-flip spec §3–§5), while legacy remains the default — zero user-visible change this PR.

**Architecture:** All fixes are v2-side additions or **sanctioned promote-and-repoint extractions** (behavior-neutral verbatim moves out of legacy files, test-locked — the F6b/F6c precedent class). Legacy stays the default; `?shell=v2` still gates. P2 (the actual `GroupRoute` inversion + smoke-suite migration) is a separate follow-up plan.

**Tech Stack:** React 19 + TS, Zustand, Vitest + Testing Library (**fireEvent, NOT user-event**), Tailwind semantic tokens. No backend changes.

**Spec:** `design/redesign/specs/2026-07-03-parity-flip-design.md` (§3 gap list, §4 slotless tabs, §5 blocker dispositions, §7 housekeeping). User approved 2026-07-03: flip now; nothing merges to `main` until the whole redesign is done; production-data testing at the end via a Railway DB copy.

## Global Constraints

- **Branch:** `redesign/flip-p1-readiness` off foundation `fac89d0`. One commit per task. One PR into `redesign/foundation`.
- **Legacy behavior must not change.** Sanctioned legacy edits are ONLY the promote-and-repoint extractions named in Tasks 1, 7, 9 (verbatim moves, repoint-only at the origin, characterization-locked). Any other legacy edit → STOP, NEEDS_CONTEXT.
- NO new `eslint-suppressions.json` entries. Tokens only; 12px floor (`text-xs` min); no cn/clsx; no trailing whitespace.
- Tests: fireEvent; Radix menus open via `fireEvent.keyDown(trigger, { key: 'Enter' })`, menu items query `screen` (portal), never `within(row)`; components that fetch on mount get store fetch ACTIONS stubbed.
- NO AI attribution in commits. Internal release note only (`{ internal: true }`, `pr: 0` → backfill), NO CURRENT_VERSION bump (stays 2.0.2).
- Gate (Task 11): `pnpm build` · `pnpm lint` (0 err) · `pnpm check:design-system:strict` · `pnpm test` · `pnpm tokens:check` · `git diff --check` · `cd scripts && npm test`.
- Stage specific files only, never `git add -A` (untracked session docs exist).

**Verified interface facts (line-checked at `fac89d0` — do not re-derive):**
- `GroupView.tsx:143-167` — three viewAs effects: param-sync (guard `user?.isAdmin`; starts when `viewAsUserId && currentGroup?.id && user?.isAdmin` and the store value differs; stops when param absent but store set), clear-on-group-mismatch, stop-on-unmount (empty-dep, lint-disabled). `viewAsStore` actions: `startViewAs(groupId: string, userId: string): Promise<void>`, `stopViewAs(): void`; `startViewAs` re-validates admin internally.
- `GroupViewContent.tsx:234-257` — `?player=` effect: finds player in `currentTier.players`, `setPageMode('roster')`, sets `highlightedPlayerId` (local `useGroupViewState` state — **never reaches slots**), scrolls `player-card-${id}` at 100ms, clears highlight + strips the param at 2500ms. The strip belongs to this shared effect — v2 must NOT also strip.
- Invite (legacy `Header.tsx:123-150`): if `invitations.find(inv => inv.isActive)` → copy `${origin}/invite/${inv.code}` to clipboard (+"copied" feedback); else `dispatchHeaderEvent(HEADER_EVENTS.OPEN_SETTINGS_INVITATIONS)` → `SettingsPanelController` runs `useSettingsPanelStore.getState().open({ tab: 'recruitment', section: 'invitations', highlightCreateInvite: true })`. `settingsPanelStore.open(opts?: { tab?; section?; highlightCreateInvite? })`. **Implementer: read Header.tsx:123-150 for the exact invitation-store selector + copy-feedback pattern before writing Task 5.**
- `AdminBanners` props `{ isAdminAccess: boolean; onExitAdminMode?: () => void }` — self-contained, renders null unless admin access. `JoinRequestBanner` props `{ shareCode; staticName; groupId; settings?; userRole?: string | null }` — fetches its own data, renders null for members/non-discoverable. Legacy render site `GroupView.tsx:414-436`.
- Nav memory (`GroupView.tsx:184-212`): `recent-statics` = JSON array of shareCodes, MRU-first, cap 10; `static-nav-${shareCode}` = full `searchParams.toString()` minus `TRANSIENT_NAV_PARAMS` (`lib/navPreferences.ts:16-20` = player/viewAs/adminMode/showSettings/settings/gsub/psub/rcsub). Restore: `ContextSwitcher.tsx:109-130` `buildStaticHref` (gated on `prefRememberTabs(user)` reading `user.tabPersistence`). v2 `StaticPicker.tsx:89` currently navigates bare `` `/group/${shareCode}?shell=v2` ``.
- Integrations sub-tab (`ScheduleTab.tsx`): JSX block `:606-1222` gated `activeSubTab === 'integrations'`; store deps destructured `:50-73` (`settings, isLoadingSettings, error, updateSettings, sendTestReminder, postSessionPreview, regenerateCalendar, revokeCalendar, createDiscordInstallClaim, fetchDiscordLink, disconnectDiscordLink, syncAllDiscordMirrors, fetchDiscordMirrors`); ~21 local `useState`s `:77-99`; handlers `:303-412`; discord-mirror polling effect `:181-208` (reads `sessions`). Sub-tab param `?stab=` via `useUrlTabState('stab', SCHED_SUB_TABS, 'sessions')`.
- `AvailabilityGrid` props `{ groupId; canSubmit; canCreateSession; sessions: ScheduleSession[]; members: Membership[]; staticName; shareCode; onCreateSessionDraft(draft: ScheduleSessionCreate) }` — fetches its own availability via `useAvailabilityStore`; `QuickFillHelper` renders inside it (no wiring needed).
- Settings registry (`SettingsPanel.tsx`): `SettingsTab` union `:35` = `'general'|'static'|'priority'|'goals'|'recruitment'|'members'`; `ALL_TABS: TabItem[]` `:56-63` (`{ id, label, icon, visible: (role, adminAccess) => boolean }`); tab-content switch `:420-462`. Active tab lives in `settingsPanelStore.tab`, NOT the URL.
- CommandPalette (`CommandPalette.tsx`): `PaletteCommand { id; label; sub?; icon: ReactNode; onSelect(): void }`; nav entries `:87-110` call `setPageMode('overview'|'roster'|'gear'|'schedule')` from the palette's own `useGroupViewState()`; `handleClose()` after.
- `AppRail.tsx:139-143` root: `<nav aria-label="Primary navigation" className="w-[72px] shrink-0 flex flex-col border-r border-border-default" …>`. Legacy precedent `SidebarRail.tsx:42` = `hidden sm:flex …`. `MobileBottomNav` renders from shared `GroupViewContent.tsx:1173-1179` and self-gates via `useDevice().isSmallScreen` — serves v2 already.
- v2 data states: `NewShell.tsx:172-176` fetches via `fetchGroupByShareCode(shareCode)`; store fields `staticGroupStore` = `currentGroup / isLoading / error / clearError` (**no notFound field** — legacy infers not-found as `!currentGroup` after load). Legacy states verbatim: private/error page `GroupView.tsx:338-369` (`error && !currentGroup`; private = `error.toLowerCase().includes('private')`; copy "Private Static" / "This static is private. Please log in to view it." / `Log In with Discord` / `Go to My Statics` → `/profile?tab=statics`); not-found `:372-381` ("Group Not Found" / "The static group you're looking for doesn't exist."); no-tiers `:402-411` ("No Raid Tiers" / "Create your first tier snapshot to start tracking gear progress." + `canEdit`-gated Create First Tier button calling `useGroupActions().onNewTier()`); error-with-content modal `:462-528`.
- `useUrlTabState.ts:37-39` `SEEDED_TAB_PARAMS = ['rsub','sched','stab','goal','farm','coll','gsub','psub','rcsub','avail','mf']`.
- `useStaticPermissions()` → `{ canEdit: canManage, userRole, isAdminAccess }` (NewShell already consumes it).
- v2 Schedule (`components/schedule/Schedule.tsx`): modal-host + `setCreateDraft`/`createModal.open()` propose path; `useAvailabilityStore().fetchAvailability(groupId, startDate, endDate)`; `weekDates` + `getUtcDateRange` in scope. `AvailabilityHeatmap` card header currently `headerRight = {members.length} raiders`.

---

### Task 1: `useViewAsUrlSync` — promote-and-repoint the viewAs effects [sonnet]

Admin "View As" is inert in v2 (spec §3.1): only `GroupView` runs the `?viewAs=` side effects. Hoist all three effects into one shared hook; repoint `GroupView`; consume in `NewShell`.

**Files:**
- Create: `frontend/src/hooks/useViewAsUrlSync.ts`
- Create: `frontend/src/hooks/useViewAsUrlSync.test.tsx`
- Modify: `frontend/src/pages/GroupView.tsx` (:143-167 → one hook call; SANCTIONED repoint)
- Modify: `frontend/src/pages/NewShell.tsx` (add the hook call in `NewShell`, after the group fetch effect)

**Interfaces:**
- Produces: `export function useViewAsUrlSync(currentGroupId: string | undefined): void` — moves the three `GroupView.tsx:143-167` effects VERBATIM (param-sync incl. the `user?.isAdmin` guard and differs-check; clear-on-group-mismatch; stop-on-unmount with its existing lint-disable comment). Internals read `useSearchParams`, `useAuthStore((s) => s.user)`, and `useViewAsStore` (viewAsUser/startViewAs/stopViewAs) exactly as the originals do.

- [ ] **Step 1: Write the failing tests** (`useViewAsUrlSync.test.tsx`, `renderHook` with a `MemoryRouter` wrapper `initialEntries`):
  1. `?viewAs=u9` + admin user + groupId `g1` + empty store → `startViewAs('g1','u9')` called once.
  2. Same but store already `{ userId: 'u9', groupId: 'g1' }` → NOT called again.
  3. No param + store set → `stopViewAs()` called.
  4. `?viewAs=u9` + NON-admin user → `startViewAs` never called.
  5. Store `{ groupId: 'g1' }` + hook re-rendered with `currentGroupId='g2'` → `stopViewAs()` (group-mismatch effect).
  6. Unmount → `stopViewAs()`.
  Stub stores via `useAuthStore.setState`/`useViewAsStore.setState` with `vi.fn()` actions.
- [ ] **Step 2: Verify RED** — `pnpm -C frontend test -- --run useViewAsUrlSync` → FAIL (module not found).
- [ ] **Step 3: Implement** — verbatim move of the three effect bodies into the hook (keep comments); then in `GroupView.tsx` delete :143-167 and replace with `useViewAsUrlSync(currentGroup?.id);` (imports pruned); in `NewShell.tsx` add `useViewAsUrlSync(currentGroup?.id);` inside `NewShell` next to the existing tier-sync effects.
- [ ] **Step 4: Verify GREEN** — hook test + `pnpm -C frontend test -- --run "GroupView|NewShell"` all green (repoint is behavior-neutral; existing GroupView tests must not notice).
- [ ] **Step 5: Commit** — `git commit -m "feat(shell): viewAs URL sync shared hook — v2 View As works (promote-and-repoint)"`

---

### Task 2: v2 `?player=` deep link — anchor + highlight in Roster [sonnet]

Spec §3.2. The shared `GroupViewContent` effect already tab-switches and strips the param (:234-257) but its highlight state never reaches the `roster` slot. v2 `Roster` handles its own read-scroll-highlight (the F6e `?sessionId=` pattern) and **must NOT strip the param** (the shared effect strips at 2500ms — pin this interplay in a comment).

**Files:**
- Modify: `frontend/src/components/roster/RosterCards.tsx` (or wherever the per-player card wrapper renders — implementer verifies; the card wrapper gains `id`/highlight)
- Modify: `frontend/src/components/roster/Roster.tsx` (param effect)
- Modify/append tests: `frontend/src/components/roster/Roster.test.tsx` (or the RosterCards test file — match existing structure)

**Behavior contract:**
- Card wrapper: `id={`player-card-${player.id}`}` on every card (matches the legacy DOM id the shared effect scrolls to — the 100ms scroll in `GroupViewContent` then works for v2 unmodified) + `highlight-pulse rounded-lg` class when `player.id === highlightedPlayerId` (Roster-local state).
- `Roster.tsx` effect (mirror `Schedule.tsx`'s deep-link shape): read `searchParams.get('player')`; bail unless present, resolvable in the roster players, and `handledRef.current !== playerParam`; mark handled; set local highlight; clear highlight after 2500ms via its own effect keyed on the highlighted id (the F6e timer-ownership pattern — do NOT put the timer in the resolving effect's cleanup); **do not touch the URL** (comment: the shared `GroupViewContent.tsx:248-255` effect owns the strip).
- No scroll call in Roster — the shared effect's `getElementById` scroll now finds the v2 card (same id). Assert this in the test via the id's presence, not a scroll spy.

- [ ] **Step 1: Failing tests:** (a) render Roster with `?player={id}` (MemoryRouter) → the matching card wrapper has the `player-card-{id}` id AND `highlight-pulse`; other cards have ids but no highlight; (b) fake timers: after 2500ms the class is removed; (c) unresolvable id → no highlight, no crash; (d) the URL still contains `player` after handling (no strip).
- [ ] **Step 2: RED** → **Step 3: Implement** per contract → **Step 4: GREEN** (`pnpm -C frontend test -- --run Roster`) → **Step 5: Commit** — `git commit -m "feat(roster): v2 player deep link — card anchors + highlight (shared effect owns scroll/strip)"`

---

### Task 3: v2 load / error / empty states [opus]

Spec §3.3 — v2 currently renders a blank content area for every non-happy state. Build a v2 states component rendered by `ShellContent` BEFORE `GroupViewContent`, with the legacy copy verbatim. The shell chrome (rail/topbar/spine) stays mounted; states fill the content area.

**Files:**
- Create: `frontend/src/pages/ShellContentStates.tsx`
- Create: `frontend/src/pages/ShellContentStates.test.tsx`
- Modify: `frontend/src/pages/NewShell.tsx` (`ShellContent` renders states first)

**Interfaces:**
- Produces: `export function ShellContentStates(props: { children: ReactNode }): JSX.Element` — reads `useStaticGroupStore` (`currentGroup, isLoading, error, clearError`), `useTierStore` (`tiers, isLoading` — implementer verifies the tier store's loading field name), `useAuthStore((s) => s.user)`, `useAuthStore login` (implementer verifies the login action used by `GroupView.tsx:355`), `useGroupActions().onNewTier`, `useStaticPermissions().canEdit`. Renders, in precedence order:
  1. `isLoading && !currentGroup` → `<PageSkeleton />` (existing `components/ui/Skeleton`).
  2. `error && !currentGroup` → the private/error page: heading `Private Static`/`Error` (private = `error.toLowerCase().includes('private')`), copy `This static is private. Please log in to view it.` or the raw error; buttons `Log In with Discord` (private && !user) + `Go to My Statics` → `navigate('/profile?tab=statics')` (variants per `GroupView.tsx:354-364`).
  3. `!currentGroup` (load finished, no error) → `Group Not Found` / `The static group you're looking for doesn't exist.`
  4. `currentGroup && tiers.length === 0 && !tiersLoading` → `No Raid Tiers` / `Create your first tier snapshot to start tracking gear progress.` + `canEdit`-gated `<Button onClick={() => onNewTier()}>Create First Tier</Button>`.
  5. Otherwise → `{children}`, PLUS when `error && currentGroup` an overlaying error `Modal` (title `Something went wrong` — implementer mirrors `GroupView.tsx:462-528`: message, Technical Details copy-to-clipboard block, Report Bug link to the existing `DISCORD_BUG_REPORT_URL` const — import it from where GroupView gets it, promote to a shared const ONLY if it's currently GroupView-local [that promotion is sanctioned]), `onClose={clearError}`.
- All markup NEW v2 JSX (CardShell/Button/Modal primitives; tokens only); the COPY is verbatim legacy. `data-testid="shell-state-{loading|error|not-found|no-tiers}"` per state for tests/harness.

- [ ] **Step 1: Failing tests** — one per state with store fixtures (`useStaticGroupStore.setState` etc.; stub `fetchGroupByShareCode`-class actions), asserting the testid + exact copy + button wiring (`onNewTier` spy via a `GroupActionsContext` test provider — copy the provider pattern from an existing groupActionsContext consumer test; `navigate` via MemoryRouter + a probe route); precedence test (error+group renders children AND the modal; clearError on close).
- [ ] **Step 2: RED** → **Step 3: Implement** → **Step 4: GREEN** (`pnpm -C frontend test -- --run ShellContentStates`, then `--run NewShell` — existing slot tests must stay green: their fixtures set a currentGroup+tier so states pass through to children) → **Step 5: Commit** — `git commit -m "feat(shell): v2 load/error/not-found/no-tiers states (legacy copy, new chrome)"`

---

### Task 4: JoinRequestBanner + AdminBanners in the v2 shell [sonnet]

Spec §3.4 — direct reuse (import-only; both are self-contained). Render inside `ShellContent` above `ShellContentStates`' children region — exactly where legacy mounts them relative to content (`GroupView.tsx:414-436`).

**Files:**
- Modify: `frontend/src/pages/NewShell.tsx`
- Create: `frontend/src/pages/NewShell.banners.test.tsx`

**Contract:** In `ShellContent`, above the slotted content: `<AdminBanners isAdminAccess={isAdminAccess} onExitAdminMode={() => { if (shareCode) fetchGroupByShareCode(shareCode); }} />` and `{currentGroup && <JoinRequestBanner shareCode={currentGroup.shareCode} staticName={currentGroup.name} groupId={currentGroup.id} settings={currentGroup.settings} userRole={userRole ?? undefined} />}` — `isAdminAccess`/`userRole` from the existing `useStaticPermissions()` call; verify the exact prop-type of `userRole` against `JoinRequestBanner` and coerce as needed.

- [ ] **Step 1: Failing tests** (copy the NewShell slot-test scaffold — mock both banner modules to testid stubs): admin fixture → `admin-banners` stub present; non-admin → absent; discoverable group + `userRole: null` (viewer share-code visit) → `join-request-banner` stub present with the right props (assert via mock capture).
- [ ] **Step 2: RED** → **Step 3: Implement** → **Step 4: GREEN** (`--run "NewShell"` sweep) → **Step 5: Commit** — `git commit -m "feat(shell): join-request + admin banners mounted in v2"`

---

### Task 5: TopBar invite affordance [sonnet]

Spec §3.5 (recommendation ratified by default: TopBar icon-button). Fresh-audited port of legacy `handleInviteMembers` (`Header.tsx:123-150`).

**Files:**
- Modify: `frontend/src/components/layout/TopBar.tsx`
- Modify/append: the TopBar test file (implementer locates it; create `TopBar.invite.test.tsx` if none)

**Contract:**
- `IconButton aria-label="Invite members" variant="ghost" size="sm" icon={<UserPlus size={16} />}` rendered in the TopBar action cluster (before the NotificationBell), gated exactly as the legacy button (implementer reads `Header.tsx:269-304` for the gate — mirror it; likely `canEdit`/manager).
- onClick (fresh-audited port of `:123-150`): read the invitation store the same way legacy does; if an active invitation exists → `navigator.clipboard.writeText(`${origin}/invite/${code}`)` wrapped in try/catch with `toast.success('Invite link copied')` on fulfillment / `toast.error('Failed to copy')` on rejection (the F6d/F6e clipboard rule — legacy's inline "copied" feedback becomes a toast; deliberate, document in PR body); else `useSettingsPanelStore.getState().open({ tab: 'recruitment', section: 'invitations', highlightCreateInvite: true })`.
- If the invitation store isn't already fetched in v2 (legacy Header fetched it — implementer verifies), fetch on TopBar mount with the store's existing action (stubbed in tests).

- [ ] **Step 1: Failing tests:** active invitation in store → click writes the URL + success toast, settings store NOT opened; no active invitation → `open` called with exactly `{ tab: 'recruitment', section: 'invitations', highlightCreateInvite: true }`; clipboard rejection → error toast, no success toast; gate: non-manager fixture → button absent.
- [ ] **Step 2: RED** → **Step 3: Implement** → **Step 4: GREEN** → **Step 5: Commit** — `git commit -m "feat(shell): invite affordance in v2 TopBar (copy active link / open recruitment settings)"`

---

### Task 6: mobile chrome — hide the AppRail below `sm` [sonnet]

Spec §3.6. Mirror the legacy rail's `hidden sm:flex` so small viewports get MobileBottomNav (already served by shared `GroupViewContent`) without a stacked 72px rail. The Spine stays at all sizes (deliberate — it is the only in-shell tab affordance if `useDevice`'s threshold and the `sm` breakpoint ever disagree; document in the PR body). Update the DS contract line.

**Files:**
- Modify: `frontend/src/components/layout/AppRail.tsx` (`className="w-[72px] shrink-0 flex flex-col …"` → `"hidden sm:flex w-[72px] shrink-0 flex-col …"` — note `flex` must move into the `sm:flex` variant; keep everything else byte-identical)
- Modify: `design/redesign/DESIGN_SYSTEM.md` §3.9 (one clause: hidden below `sm`, MobileBottomNav serves small screens until the Ring-1 mobile pass)
- Append test: the AppRail test file (class assertion `hidden` + `sm:flex` present, `flex` absent as a bare class)

- [ ] **Step 1: Failing test** → **Step 2: RED** → **Step 3: Implement** → **Step 4: GREEN** (`--run AppRail`, plus the NewShell sweep) → **Step 5: Commit** — `git commit -m "fix(shell): AppRail hidden below sm — no stacked mobile nav (legacy rail parity)"`

---

### Task 7: nav memory — `useStaticNavMemory` + StaticPicker restore [sonnet]

Spec §3.7. Two promote-and-repoints: (a) the two `GroupView.tsx:184-212` localStorage effects → shared hook consumed by both chromes; (b) `ContextSwitcher.tsx:109-130`'s `buildStaticHref` core → pure util in `lib/navPreferences.ts`, repointed in ContextSwitcher and used by v2 `StaticPicker` (which currently drops saved tabs).

**Files:**
- Create: `frontend/src/hooks/useStaticNavMemory.ts` + `useStaticNavMemory.test.tsx`
- Modify: `frontend/src/lib/navPreferences.ts` (+ its test file, append)
- Modify: `frontend/src/pages/GroupView.tsx` (:184-212 → hook call; SANCTIONED), `frontend/src/pages/NewShell.tsx` (hook call), `frontend/src/components/layout/ContextSwitcher.tsx` (repoint to the util; SANCTIONED), `frontend/src/components/layout/StaticPicker.tsx` (use the util + `shell=v2`)

**Interfaces:**
- `export function useStaticNavMemory(shareCode: string | undefined): void` — verbatim move of both effects (recent-statics MRU write, cap 10; `static-nav-${shareCode}` = current params minus `TRANSIENT_NAV_PARAMS`).
- `export function buildStaticNavHref(shareCode: string, opts: { remember: boolean; currentParams?: URLSearchParams; extraParams?: Record<string, string> }): string` — the `ContextSwitcher.tsx:109-130` logic verbatim (remember → saved params minus transient; else current params minus transient minus `tier`), then `extraParams` appended (v2 passes `{ shell: 'v2' }`). ContextSwitcher repoints with `extraParams` empty (byte-identical output — characterization-test the repoint against the old inline logic for both remember states).
- `StaticPicker.tsx:89` → `navigate(buildStaticNavHref(shareCode, { remember: prefRememberTabs(user), currentParams: searchParams, extraParams: { shell: 'v2' } }))`.

- [ ] **Step 1: Failing tests:** hook — visiting writes MRU (existing entry moves to front; cap 10) and writes `static-nav-*` without transient params; util — remember=true restores saved params + appends shell; remember=false carries current minus transient minus tier; no saved state → bare href + extras; StaticPicker — navigates to the restored href (mock localStorage seeded).
- [ ] **Step 2: RED** → **Step 3: Implement + repoints** → **Step 4: GREEN** (`--run "useStaticNavMemory|navPreferences|ContextSwitcher|StaticPicker|GroupView"`) → **Step 5: Commit** — `git commit -m "feat(shell): static nav memory in v2 — recent statics + per-static tab restore (promote-and-repoint)"`

---

### Task 8: CommandPalette entries for Tracking / Plugin / More [haiku]

Spec §4 — the three slotless tabs get explicit v2 entry points. `setPageMode('goals'|'plugin'|'more')` renders their legacy bodies via the slotless `GroupViewContent` fallback inside the v2 shell (works today by URL; the Spine shows no active tab for them — accepted, documented).

**Files:**
- Modify: `frontend/src/components/layout/CommandPalette.tsx` (three `PaletteCommand` entries after `go-schedule`: `go-goals` label `Go to Tracking` icon `Target`, `go-plugin` label `Go to Plugin` icon `Plug`, `go-more` label `Go to More` icon `MoreHorizontal` — each `onSelect: () => { setPageMode('goals'|'plugin'|'more'); handleClose(); }`)
- Append test: the CommandPalette test file

- [ ] **Step 1: Failing test** (palette lists the three labels; selecting fires setPageMode with the right mode + closes) → **Step 2: RED** → **Step 3: Implement** → **Step 4: GREEN** → **Step 5: Commit** — `git commit -m "feat(shell): palette entries for Tracking/Plugin/More (slotless fallback surfaces)"`

---

### Task 9: `ScheduleIntegrationsPanel` extraction + Settings Integrations tab [opus]

Spec §5.2. The Discord-integrations panel must survive legacy deletion. Extract `ScheduleTab.tsx:606-1222` (+ its ~21 local states, handlers `:303-412`, and the mirror-polling effect `:181-208`) VERBATIM into a self-contained component; repoint `ScheduleTab`; host it as a new Settings tab. This is the largest, riskiest move in P1 — the extraction must be character-faithful (only self-containment edits: the states/handlers/effect move in; `sessions` comes from the component's own `useScheduleStore()` subscription — verify the parent's `sessions` source is the same store slice so behavior is identical; `groupId`/`canManage` become props).

**Files:**
- Create: `frontend/src/components/schedule/ScheduleIntegrationsPanel.tsx` + `ScheduleIntegrationsPanel.test.tsx`
- Modify: `frontend/src/components/schedule/ScheduleTab.tsx` (block → `<ScheduleIntegrationsPanel groupId={groupId} canManage={canManage} />`; delete the moved states/handlers/effect; SANCTIONED repoint — the file must retain identical behavior for sessions/availability sub-tabs)
- Modify: `frontend/src/components/settings/SettingsPanel.tsx` (union + `ALL_TABS` entry `{ id: 'integrations', label: 'Integrations', icon: Webhook, visible: (r, a) => isManager(r, a) }` + switch case rendering the panel with the group id/canManage the SettingsPanel already has)
- Append tests: SettingsPanel test (tab appears for managers, absent for members; renders the panel stub)

**Interfaces:**
- Produces: `export function ScheduleIntegrationsPanel(props: { groupId: string; canManage: boolean }): JSX.Element` — owns its `useScheduleStore()` subscription (settings/actions/sessions) and, on mount, calls the store's settings-fetch action if settings are absent (implementer verifies which action `ScheduleTab` uses to load settings and mirrors it — the panel must work when mounted from Settings without `ScheduleTab` ever mounting).

- [ ] **Step 1: Characterization tests FIRST** (the repoint lock): with the schedule store seeded (settings + stubbed actions), render the panel and assert the load-bearing anatomy — webhook URL input reflects `settings`, save calls `updateSettings` with the assembled payload, test-reminder button calls `sendTestReminder`, calendar regenerate/revoke call their actions, Discord connect flow calls `createDiscordInstallClaim`, disabled states for `canManage=false`. (Pick ~8 assertions that pin the panel's contract; the block is too big to snapshot.)
- [ ] **Step 2: RED** (component absent) → **Step 3: Extract verbatim + repoint + Settings tab** → **Step 4: GREEN** — panel tests + `pnpm -C frontend test -- --run "ScheduleTab|SettingsPanel|schedule"` (every existing ScheduleTab test untouched and green) + `pnpm build`.
- [ ] **Step 5: Commit** — `git commit -m "feat(settings): Integrations tab — ScheduleIntegrationsPanel extracted from ScheduleTab (promote-and-repoint)"`

---

### Task 10: availability-editor stopgap — legacy grid in a v2 modal [sonnet]

Spec §5.1 disposition (c): keep the only availability editor reachable from v2 until the Ring-1 Person→Static pipe. `AvailabilityGrid` is reused import-only inside a Modal hosted by the v2 `Schedule` assembly.

**Files:**
- Modify: `frontend/src/components/schedule/Schedule.tsx` (modal host + open affordance)
- Modify: `frontend/src/components/schedule/AvailabilityHeatmap.tsx` (optional `onEditWeek?: () => void` prop → when set, `headerRight` becomes `<div className="flex items-center gap-2"><span …>{members.length} raiders</span><Button variant="ghost" size="sm" onClick={onEditWeek}>Edit week</Button></div>`; default render unchanged — additive, existing tests untouched)
- Append tests: `Schedule.test.tsx` + `AvailabilityHeatmap.test.tsx`

**Contract (Schedule side):**
- `const editModal = useModal();` heatmap gets `onEditWeek={canRsvp ? editModal.open : undefined}` (any non-viewer member can paint their own week — mirror `AvailabilityGrid`'s own `canSubmit` semantics: implementer verifies what legacy passes for `canSubmit` at `ScheduleTab.tsx:593-602` and mirrors it).
- `{editModal.isOpen && (<Modal isOpen onClose={handleEditClose} title="Edit availability" size="xl"><AvailabilityGrid groupId={group.id} canSubmit={…legacy-mirrored…} canCreateSession={canManage} sessions={sessions} members={members} staticName={group.name} shareCode={group.shareCode} onCreateSessionDraft={(draft) => { editModal.close(); handlePropose(draft); }} /></Modal>)}` — conditional mount; verify `Modal`'s actual size prop API and pick the widest.
- `handleEditClose`: close + re-fire the scoped-week availability fetch (`fetchAvailability(group.id, startDate, endDate)` with the existing `getUtcDateRange(weekDates)` values) so the heatmap reflects edits immediately.
- PR-body note: this is a stopgap; the grid's own rolling-window/this-week semantics are legacy-as-is (deliberate); Ring-1 replaces it with the Person→Static pipe.

- [ ] **Step 1: Failing tests:** heatmap — `onEditWeek` set → "Edit week" button renders and fires; unset → header unchanged (regression pin); Schedule — open → `AvailabilityGrid` stub mounted with the right props (mock the module); close → `fetchAvailability` re-fired with the current week range; draft callback → closes the edit modal and opens the create modal with the draft (assert via the CreateSessionModal stub's `initialDraft`).
- [ ] **Step 2: RED** → **Step 3: Implement** → **Step 4: GREEN** (`--run "Schedule\.test|AvailabilityHeatmap"`) → **Step 5: Commit** — `git commit -m "feat(schedule): availability editing reachable from v2 — legacy grid hosted in a modal (Ring-1 stopgap)"`

---

### Task 11: housekeeping — SEEDED params, fixture time-bombs, release note, gate [sonnet]

**Files:**
- Modify: `frontend/src/hooks/useUrlTabState.ts` (`SEEDED_TAB_PARAMS` += `'rview', 'lview'` — closes the recorded deep-link staleness gap)
- Modify: `frontend/src/components/schedule/SessionList.test.tsx` (the real-timer fixtures pinned to 2026-07-07 dates — move to far-future dates (2036) or fake timers so `next`-variant coverage doesn't silently decay after the date passes; keep every assertion meaning-identical)
- Modify: `frontend/src/data/releaseNotes.ts` (append to the UNRELEASED items):
```ts
      {
        internal: true,
        category: 'improvement',
        title: 'Flip readiness — v2 shell parity gaps closed',
        description:
          'View As, player deep links, load/error/empty states, join-request and admin banners, invite affordance, mobile rail behavior, per-static tab memory, Tracking/Plugin/More palette entries, a Settings Integrations tab, and in-app availability editing now all work under ?shell=v2 — clearing the road to making v2 the default.',
        pr: 0,
        prTitle: 'feat(redesign): flip-p1 — v2 shell readiness (parity gaps closed)',
      },
```
- Possibly touched: fold-ins routed by per-task reviews.

- [ ] **Step 1: SEEDED params + a test** (existing useUrlTabState test file: `rview`/`lview` now cleared by `clearRegisteredTabParams` before their owners mount — follow the file's existing seeded-param test idiom).
- [ ] **Step 2: Fixture sweep** — run `pnpm -C frontend test -- --run SessionList` before/after; identical pass count, no assertion weakened.
- [ ] **Step 3: Release note** (no CURRENT_VERSION change).
- [ ] **Step 4: Full gate** — `pnpm build` · `pnpm lint` (0 errors) · `pnpm check:design-system:strict` · `pnpm test` · `pnpm tokens:check` · `git diff --check` · `cd scripts && npm test` — ALL green.
- [ ] **Step 5: Commit** — `git commit -m "chore(flip-p1): seeded view params, fixture future-proofing, internal release note"`

---

## Post-plan process (orchestrator, not tasks)

**Browser validation (after Task 10, and final pre-PR):** dev-auth `/api/dev-auth/login/0` → `/group/DEVTST?shell=v2`: `?viewAs=` round-trip as admin (banner appears via ViewAsBanner, roles reflect target; exit works); `?player={id}` deep link scrolls + highlights a v2 card; fresh static with zero tiers shows No Raid Tiers + Create First Tier works; bogus share code shows Group Not Found INSIDE the v2 chrome; logged-out private static shows the login state; join-request banner on a discoverable static as a non-member; TopBar invite copies/opens recruitment settings; palette → Tracking/Plugin/More render their legacy bodies in-shell; Settings → Integrations tab renders the panel (webhook fields present); heatmap "Edit week" opens the grid, painting updates the heatmap on close; narrow viewport (devtools emulate) shows no AppRail + MobileBottomNav present; **legacy `/group/DEVTST` byte-for-byte** (repoints invisible: viewAs works, tab memory works, ContextSwitcher hrefs unchanged, ScheduleTab integrations sub-tab renders identically); 0 console errors.

**PR body must document:** the three sanctioned promote-and-repoints (viewAs hook, nav-memory hook + buildStaticNavHref, ScheduleIntegrationsPanel) each characterization-locked · invite copy-feedback becomes a toast (legacy inline feedback) · Spine stays visible on mobile (deliberate; MobileBottomNav covers tab nav; Ring-1 mobile pass owns the real design) · slotless Tracking/Plugin/More get palette entries, no Spine tab (deliberate; Rings 1–3 re-home them) · availability modal = §5.1 stopgap, Ring-1 pipe is the real fix · `rview`/`lview` now seeded · fixture future-proofing.

**Decisions to ratify (append to handoff list):** invite = TopBar icon-button · Spine-on-mobile interim · integrations tab visibility = managers-only · availability modal gating (non-viewer members) · P3 (legacy deletion) deferred until after the user's holistic review.

## Self-review (done at write time)

- **Spec §3 coverage:** 3.1→T1, 3.2→T2, 3.3→T3, 3.4→T4, 3.5→T5, 3.6→T6, 3.7→T7, 3.8 (param degradation) → no task needed (v2 Schedule already ignores `sched=`; the slotless tabs keep their params via §4/T8). **§4**→T8 (+keep-list untouched). **§5.1**→T10, **§5.2**→T9, **§5.3** (GearSync via Plugin tab) → covered by T8's `go-plugin` entry — no extra work. **§7 P1 items**: SEEDED params + fixtures → T11; DESIGN_SYSTEM backfill + LEGACY_ROLE_BADGE excludes + scaffold consolidation stay P3 per spec.
- **Placeholder scan:** T2/T5/T9/T10 carry implementer-verify points on facts that live inside large legacy files (invite gate, tier-store loading field, settings-fetch action, canSubmit semantics) — each names the exact file:line to read; no TBDs.
- **Type consistency:** `useViewAsUrlSync(currentGroupId)` matches both call sites; `buildStaticNavHref` signature consistent between T7's util/ContextSwitcher/StaticPicker; `ScheduleIntegrationsPanel { groupId, canManage }` matches T9's two hosts; `onEditWeek?: () => void` additive on `AvailabilityHeatmapProps`.
