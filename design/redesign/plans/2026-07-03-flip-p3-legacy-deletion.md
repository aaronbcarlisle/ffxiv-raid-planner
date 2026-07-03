# FLIP P3 — Legacy Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the legacy `/group/:code` experience (GroupView chrome + the `?shell=` gate + the escape hatch + every legacy-only tab body), make the v2 slots unconditional, rewrite the e2e smoke suite to v2 selectors, and settle the deletion-riding debt (suppressions, test scaffolds, DESIGN_SYSTEM.md contracts).

**Architecture:** Three-stage deletion respecting the import graph verified 2026-07-03 at `f45a241`: (1) kill the route gate + shell plumbing (GroupView/GroupRoute/SidebarNav die — they are the ONLY files with zero live importers today); (2) gut `GroupViewContent`'s legacy fallback bodies so the ~25 legacy leaf components lose their last importer; (3) delete the now-dead tree. Then test/doc housekeeping. Spec: `design/redesign/specs/2026-07-03-parity-flip-design.md` §6–§7.

**Tech Stack:** React 19 + TS + Vite 7, Vitest, Playwright, ESLint 9 (suppressions baseline), pnpm.

## Spec §6 corrections (inventory verified against HEAD — these OVERRIDE the spec)

1. **`Header.tsx`, `SettingsDockToggle.tsx`, `SettingsPanelController.tsx` are KEEPS.** `Layout.tsx` mounts them on EVERY non-group route (Home/Dashboard/Discover/Profile/docs). Spec §6 wrongly listed them as dying. Only Layout's predicate simplifies. Consequence: `HEADER_EVENTS` stays; `useGroupViewKeyboardShortcuts`' settings dispatch is NOT re-pointed (the Header→SettingsPanelController event bridge is live architecture for surviving routes). Consequence: suppression prune = 2 file entries / 3 edges (`SidebarNav`×1, `AllWeeksView`×2), not the spec's "~9".
2. **Confirmed keeps:** `RosterCharacterPanel` (v2 `CharacterManageBridge` wraps it), `AvailabilityGrid`+`QuickFillHelper` (v2 `Schedule.tsx` hosts the grid in its Edit-availability modal), `WeekStepper` (imported by `DesignSystem.tsx`), `SessionList.tsx` (v2-only; the spec's name-collision warning is stale — only one file exists), `AdminBanners`/`JoinRequestBanner` (NewShell), `ScheduleIntegrationsPanel` (SettingsPanel), `MobileBottomNav`, `GoalsPage`/`PluginPage`/`MorePage` (slotless fallback per spec §4), `BiSImportModal`+`AssignUserModal` (v2 `useRosterCardActions`), `GearSourceBadge` (DesignSystem page), `DashboardCard` (GearSyncDashboard, re-homed).
3. **PlayerCard chain dies (spec never named it):** `PlayerGrid` → `DroppablePlayerCard` → `PlayerCard` → `PlayerCardHeader`/`PlayerCardStatus`/`PlayerCardGear`→`GearTable`/`PlayerSetupBanner`(+utils)/`LodestoneSearchModal`; `RosterDragOverlay` → `DragOverlayCard`. Lodestone Sync was already re-homed out at F6c (see `useRosterCardActions.tsx:12` header comment) — the surviving lodestone-search UI is profile `CharacterLinkModal`.
4. **Decisions (decide+ratify; reversible before main; document in PR body):**
   - **D-P3-1** Header/SettingsDockToggle/SettingsPanelController keep (above).
   - **D-P3-2** `SplitClearPlanner` + its whole subtree/store/utils **DROPPED** (capability removed; self-contained, recoverable from git history at the squash SHA; unroadmapped — Ring-1+ re-home candidate).
   - **D-P3-3** `TeamSummaryEnhanced` **DROPPED** (gear-% subsumed by v2 GearBoard; the per-player Books/Materials balance ledger is a documented capability gap → Ring-1 candidate).
   - **D-P3-4** `GearSyncDashboard` **re-homed to PluginPage** (spec §5.3 recommendation executed; both are Dalamud-facing).
   - **D-P3-5** `flip.spec.ts` deleted wholesale (its subject — the gate — is gone); bare-route-renders-v2 is covered by the rewritten smoke helper.
   - **D-P3-6** Lodestone e2e coverage moves to the profile character-link flow (the F6c re-home decision's surviving UI).
   - **D-P3-7** `GroupRoute.tsx` deleted; `App.tsx` lazy-routes straight to `NewShell`.

## Global Constraints (bind every task)

- **No new `eslint-suppressions.json` entries; no new inline `eslint-disable` comments.** Deleting files removes their entries/disables — prune the baseline in the same commit as the deletion (`SidebarNav` in Task 1, `AllWeeksView` in Task 4).
- **Tokens/12px:** semantic tokens only, no raw hex, `text-xs` floor (only Task 3 adds UI).
- **Vocabulary:** "static" never "group" in NEW user-facing copy (existing verbatim-legacy copy stays as-is).
- **NO AI attribution** in commits, code, or PR.
- **Release note:** internal only (`{ internal: true }`), `pr: 0` placeholder (backfilled at PR open), **`CURRENT_VERSION` stays `2.0.2`**.
- **Stage specific files only** — never `git add -A`.
- **Per-task gate:** focused tests while iterating; full `pnpm test` + `pnpm build` (tsc -b + vite, NOT `tsc --noEmit`) before commit.
- **e2e is NOT in CI** — unit suite + build must be green after every task; the rewritten e2e suite is proven live in Task 5 and re-proven at the land gate.
- v2 shell = default; there is no legacy escape hatch after Task 1. Nothing in this plan may re-introduce a `?shell=` read or write.

---

### Task 1: Kill the gate — delete GroupView/GroupRoute/SidebarNav, simplify Layout, strip shell plumbing

**Files:**
- Delete: `frontend/src/pages/GroupView.tsx`, `frontend/src/pages/GroupRoute.tsx`, `frontend/src/pages/GroupRoute.test.tsx`, `frontend/src/components/layout/SidebarNav.tsx`, `frontend/src/components/layout/SidebarNav.test.tsx`, `frontend/e2e/flip.spec.ts`
- Modify: `frontend/src/App.tsx` (~line 23 + route ~line 164), `frontend/src/components/layout/Layout.tsx` (lines 18-30, 56, 71-79), `frontend/src/hooks/useGroupViewKeyboardShortcuts.ts` (lines 44, 78, 87-91, 226-237), `frontend/src/pages/GroupViewContent.tsx` (line ~492 only), `frontend/src/lib/navPreferences.ts` (line 29 + comment block 17-24), `frontend/src/components/layout/StaticPicker.tsx` (line ~105), `frontend/src/pages/NewShell.tsx` (line ~334), `frontend/src/components/layout/CommandPalette.tsx` (line ~160), `frontend/eslint-suppressions.json` (remove `SidebarNav` entry)
- Modify tests: `frontend/src/lib/navPreferences.test.ts`, `frontend/src/components/layout/StaticPicker.test.tsx`, `frontend/src/components/roster/Roster.test.tsx` (strip `?shell=v2` / `shell` assertions)

**Interfaces:**
- Produces: `App.tsx` renders `NewShell` directly for `group/:shareCode`. `Layout` exposes no shell awareness — new predicate name `isGroupRoute`. `useGroupViewKeyboardShortcuts` loses its `shellParam` option (callers pass nothing).
- Consumed by Task 2: `GroupViewContent` still has its `slots?` optional prop (Task 2 changes it).

**Steps:**

- [ ] **Step 1: Delete the six files** listed above (`git rm`).
- [ ] **Step 2: Re-point App.tsx.** Replace the `GroupRoute` lazy import with:

```tsx
const NewShell = lazy(() => import('./pages/NewShell').then(m => ({ default: m.NewShell })));
```

and the route `<Route path="group/:shareCode" element={<GroupRoute />} />` → `element={<NewShell />}`. GroupRoute was already lazy at the App level, so the existing `Suspense` wrapper covers NewShell; verify a fallback exists (GroupRoute used `PageSkeleton` — if App's Suspense fallback differs, wrap the route element: `<Suspense fallback={<PageSkeleton />}><NewShell /></Suspense>` with imports adjusted).
- [ ] **Step 3: Simplify Layout.** Replace lines 18-30 with:

```tsx
  // The v2 shell renders its own TopBar, so the app-wide Header (and the
  // settings dock toggle) are suppressed on the group route. All non-group
  // routes render them.
  const location = useLocation();
  const isGroupRoute = location.pathname.startsWith('/group/');
```

Drop the `useSearchParams` import (verify no other use). Rename both usages: `{!isGroupRoute && <Header />}` (line 56), `{!isGroupRoute && <SettingsDockToggle />}` (line 79). Update the stale comment at lines 71-72 ("rendered by GroupView" → "rendered by V2SettingsHost") and the SettingsDockToggle comment block (77-78 mentions "v1").
- [ ] **Step 4: Strip shell plumbing.** In `useGroupViewKeyboardShortcuts.ts`: delete the `shellParam?: string` option (line 44), the `groupRoute()` helper (lines 87-91), and make the Mod+[ / Mod+] static-switch shortcuts navigate `` navigate(`/group/${shareCode}`) `` directly. In `GroupViewContent.tsx:492`: remove the `shellParam: searchParams.get('shell') ?? undefined` line. In `navPreferences.ts`: remove `'shell'` from `TRANSIENT_NAV_PARAMS` and rewrite the lines 17-24 explanation comment (the shell rationale is dead; keep the doc for the remaining transient params). In `StaticPicker.tsx:105`, `NewShell.tsx:334`, `CommandPalette.tsx:160`: remove the `extraParams: { shell: 'v2' }` argument (check `buildStaticNavHref`'s signature — if `extraParams` is optional, drop the property/argument entirely; if these were the only `extraParams` users, do NOT remove the parameter from `buildStaticNavHref` itself — that is out of scope).
- [ ] **Step 5: Update tests.** `navPreferences.test.ts`: remove/rewrite the assertions that `shell` is transient (keep the suite testing the remaining transient params round-trip). `StaticPicker.test.tsx` and `Roster.test.tsx`: strip `?shell=v2` from `MemoryRouter` URLs and any expectation strings (`shell=v2` must not appear in expected hrefs). Run each suite as you touch it.
- [ ] **Step 6: Sweep for stragglers.** `rg "shell=|'shell'|\"shell\"|GroupRoute|from './GroupView'|pages/GroupView|SidebarNav" frontend/src frontend/e2e` — the ONLY acceptable remaining hits: `releaseNotes.ts` (historical changelog prose), `smoke.spec.ts`/`helpers/auth.ts` (rewritten in Task 5 — leave broken-at-runtime, they're not in CI), `contrast.spec.ts` (Task 5). Anything else must be fixed now.
- [ ] **Step 7: Prune suppression.** Remove the `src/components/layout/SidebarNav.tsx` entry from `frontend/eslint-suppressions.json`.
- [ ] **Step 8: Gate.** `pnpm test` (full) + `pnpm lint` (0 errors) + `pnpm build` — all green. Note: `GroupViewContent.*.test.tsx` and `NewShell.*.test.tsx` must still pass untouched (they mount GVC/NewShell directly, not via GroupRoute).
- [ ] **Step 9: Commit** (`git add` the specific files) — `feat(redesign): flip-p3 task 1 — delete GroupView/GroupRoute/SidebarNav + shell gate plumbing`.

---

### Task 2: Gut GroupViewContent — slots become unconditional [RISKIEST — fable implementer]

**Files:**
- Modify: `frontend/src/pages/GroupViewContent.tsx` (1410 lines → expect roughly half), `frontend/src/pages/NewShell.tsx` (line ~162 ternary)
- Delete: `frontend/src/pages/GroupViewContent.test.tsx`, `GroupViewContent.canManageRoster.test.tsx`, `GroupViewContent.gearSlot.test.tsx`, `GroupViewContent.rosterSlot.test.tsx`
- Create: `frontend/src/pages/GroupViewContent.slots.test.tsx`

**Interfaces:**
- Produces: `GroupViewContentProps.slots` becomes **required**: `slots: Record<GroupTab, React.ReactNode>` (`GroupTab = 'overview' | 'roster' | 'gear' | 'schedule'`, line 78). `actions: GroupActions` unchanged. NewShell passes `slots={{ overview, roster, gear: loot, schedule }}` unconditionally (drop the `currentGroup ?` ternary — `ShellContentStates` renders children only in its branch 5, where `currentGroup` is truthy and tiers exist; state this in a comment).
- Consumed by Task 4: after this task, the legacy leaf components have zero production importers.

**What to remove (verified guard inventory at HEAD; re-locate by content, not line number):**
- Line ~679: the `!slots?.gear` branch of `preventPageScroll` (legacy internal-scroll gear layout) — slots are always present, so the legacy branch is dead; simplify the expression.
- Lines ~697-854: the legacy sticky roster toolbar (`!slots?.roster`-gated): sub-tab tablist + member controls.
- Fallback bodies: overview ~873-908 (`PageHeader` + `StaticHomeTab`), roster ~913-946 (`RosterCharacterPanel`/`SplitClearPlanner`/rosterDndArea), gear ~950-1056 (sub-tab bar + `GearSyncDashboard`/`LootPriorityPanel`/`HistoryView`/`TeamSummaryEnhanced`), schedule ~1060-1109 (`ScheduleUpcomingPanel`/`ScheduleTab` switcher). Each `slots?.x ?? (<legacy/>)` becomes just `slots.x`.
- Line ~1169: mobile floating `RosterViewToggle` (`!slots?.roster`-gated).
- Lines ~1209-1263 / ~1269-1321 / ~1327-1376: mobile Controls-Sheet legacy sections (roster sort/view controls, gear view selector, gear-history Reset Data) — all `!slots?.x`-gated, never render in v2.
- The split-clear fetch + visibility-refresh effect (~322-340) — its consumer (SplitClearPlanner fallback) is gone. (Files die in Task 4.)
- Every import, state hook, handler, memo, and `useUrlTabState` call whose ONLY consumers were the removed code. Known import prunes: `StaticHomeTab`, `PlayerGrid`, `RosterDragOverlay`, `RosterViewToggle`, `RosterCharacterPanel`, `SplitClearPlanner`, `GearSyncDashboard`, `LootPriorityPanel`, `HistoryView`, `TeamSummaryEnhanced`, `ScheduleTab`, `ScheduleUpcomingPanel`. Trace each piece of local state (e.g. legacy roster sub-view, gear sub-tab, sched sub-tab, DnD sensors/handlers, sort/filter bindings) to its remaining consumers before deleting — some feed the KEEP list below.

**What MUST survive (verify each still works after surgery):**
- Slotless pageModes: goals (~1113-1124), more (~1127-1151), plugin (~1154-1159) render their bodies unconditionally (spec §4).
- `MobileBottomNav` mount.
- Shared effects: `?player=` deep link (~234-257: switches tab to roster, strips param), added-player highlight (~265-285), sort-preset + group-view localStorage loads (~190-229) **if** anything still consumes them (trace; the v2 Roster slot manages its own state via `useGroupViewState` — if these effects only fed legacy fallbacks, they go too, but `useGroupViewState`-owned state consumed by NewShell/slots stays), roster 30s gear poll (~288-299) if the v2 slots rely on store freshness (they do — keep), loot-tracking store init (~313-319).
- `useGroupViewKeyboardShortcuts` wiring (~472-499, minus the `shellParam` line Task 1 removed).
- The `actions: GroupActions` plumbing.

**Steps:**

- [ ] **Step 1: Write the failing test first.** Create `GroupViewContent.slots.test.tsx` pinning the POST-surgery contract (adapt mocks from the old `GroupViewContent.test.tsx` before deleting it — reuse its store/hook mock scaffold):

```tsx
// Cases (all with slots={{ overview: <div data-testid="s-o"/>, roster: <div data-testid="s-r"/>,
//   gear: <div data-testid="s-g"/>, schedule: <div data-testid="s-s"/> }}):
// 1. pageMode overview/roster/gear/schedule → the matching slot testid renders; no legacy
//    leaf text ("Split Planner", "Team Summary", legacy gear sub-tab buttons) anywhere.
// 2. pageMode 'goals' → GoalsPage body renders (mock it; assert mock testid).
// 3. pageMode 'plugin' → PluginPage renders. pageMode 'more' → MorePage renders.
// 4. The legacy sticky roster toolbar is gone: no role=tablist for roster sub-tabs.
```

Run: `pnpm vitest run src/pages/GroupViewContent.slots.test.tsx` → FAILS (component still renders legacy chrome / slots optional).
- [ ] **Step 2: Perform the surgery** per the inventory above. Iterate with the new test file until green.
- [ ] **Step 3: NewShell ternary.** `slots={currentGroup ? {...} : undefined}` → `slots={{ overview, roster, gear: loot, schedule }}` (type now requires it). Run `pnpm vitest run src/pages` — the seven `NewShell.*.test.tsx` suites must stay green (their mocks may reference legacy leaves that still exist on disk until Task 4 — fine).
- [ ] **Step 4: Delete the four old GVC test files.** Confirm nothing else imports them.
- [ ] **Step 5: Sweep.** `rg "StaticHomeTab|PlayerGrid|RosterDragOverlay|RosterViewToggle|SplitClearPlanner|GearSyncDashboard|LootPriorityPanel|HistoryView|TeamSummaryEnhanced|ScheduleUpcomingPanel|'\\.\\./components/schedule'" frontend/src/pages/GroupViewContent.tsx` → zero hits (except `RosterCharacterPanel` must also be gone from GVC; it survives elsewhere).
- [ ] **Step 6: Gate.** Full `pnpm test` + `pnpm lint` + `pnpm build`. No new inline disables; deleting code may orphan existing disables — remove any that ESLint now flags as unused.
- [ ] **Step 7: Commit** — `feat(redesign): flip-p3 task 2 — GroupViewContent slots unconditional, legacy fallbacks removed`.

---

### Task 3: Re-home GearSyncDashboard into PluginPage

**Files:**
- Modify: `frontend/src/components/group/PluginPage.tsx`
- Test: `frontend/src/components/group/PluginPage.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `GearSyncDashboard({ players, onViewStats? })` from `./GearSyncDashboard` (same directory). Players come from the tier store's selector hook (`useTierPlayers` from `../../stores/tierStore` — verify the exact export name in `tierStore.ts`; CLAUDE.md names `useTierPlayers`).
- Produces: PluginPage renders a "Gear Sync" section (GearSyncDashboard) above/below the existing install-steps + ApiKeyManager content (placement: after the install steps, before ApiKeyManager — a status dashboard belongs above key management). Do NOT pass `onViewStats` (its target, the legacy stats sub-tab, is deleted; the prop is optional and the button hides without it — verify that's true in GearSyncDashboard before relying on it; if the button renders regardless, guard it).

**Steps:**

- [ ] **Step 1: Failing test.** `PluginPage.test.tsx`: mock `./GearSyncDashboard` (`vi.mock` → `<div data-testid="gear-sync-dashboard"/>`) and the tier store hook; assert PluginPage renders the mock plus its existing content. Run → FAIL (not rendered).
- [ ] **Step 2: Implement.** Import + render inside PluginPage with `players={useTierPlayers()}` (or the store's actual selector). Match PluginPage's existing section/heading conventions (it uses lucide icons + section blocks); heading copy: "Gear Sync" with a one-line sub-caption such as "Plugin sync status for this tier." (12px floor, tokens only).
- [ ] **Step 3: Green + gate.** Suite green; `pnpm check:design-system` clean on the touched file; full test + build.
- [ ] **Step 4: Commit** — `feat(redesign): flip-p3 task 3 — re-home GearSyncDashboard into PluginPage (spec §5.3)`.

---

### Task 4: Delete the dead legacy tree + prune suppressions/barrels/test-mocks

**Files — Delete (verify each has zero remaining importers FIRST — Step 1):**
- static-group: `StaticHomeTab.tsx`, `StaticHomeTab.test.tsx` (check `components/static-group/index.ts` barrel export)
- player: `PlayerGrid.tsx`, `RosterDragOverlay.tsx`, `RosterViewToggle.tsx`, `DroppablePlayerCard.tsx`, `DragOverlayCard.tsx`, `PlayerCard.tsx`, `PlayerCardHeader.tsx`, `PlayerCardHeader.test.tsx`, `PlayerCardStatus.tsx`, `PlayerCardGear.tsx`, `GearTable.tsx`, `PlayerSetupBanner.tsx`, `PlayerSetupBanner.test.ts`, `playerSetupBannerUtils.ts`, `LodestoneSearchModal.tsx`
- split-clear: the entire `frontend/src/components/split-clear/` directory (Planner, EmptyState, DraftReview, AssignmentBoard, CharacterSelector, RunPanel, tests), `frontend/src/stores/splitClearStore.ts`, `frontend/src/utils/splitClear.ts`, `splitClearSuggestionService.ts`, `splitClearHelpers.ts`, `splitClearScoringService.ts` + all their `.test.ts(x)` files
- team: `TeamSummaryEnhanced.tsx`
- history: everything in `frontend/src/components/history/` EXCEPT `WeekStepper.tsx` (+ its test if one exists): `HistoryView.tsx`, `SectionedLogView.tsx`, `AllWeeksView.tsx`, `WeeklyLootGrid.tsx`, `LootLogFilters.tsx`, `LootLogModals.tsx`, `LootCountBar.tsx`, `FloorSection.tsx`, `LogFloatingActions.tsx`, `LogLayoutToggle.tsx`, `LogEntryItems.tsx`, `RevertWeekConfirmModal.tsx` — list the directory first; anything else in it whose only importers are these files dies too
- loot: `LootPriorityPanel.tsx`, `SummaryPanel.tsx` (pre-existing orphan — zero importers, disclosed in PR body)
- schedule: `ScheduleTab.tsx`, `SessionCard.tsx`, `SessionCard.test.tsx`, `ScheduleUpcomingPanel.tsx`

**Files — Create:** `frontend/src/components/roster/dragTypes.ts`:

```ts
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

/** Drag-handle prop types shared by the v2 roster cards (moved verbatim from
 * the deleted legacy DroppablePlayerCard.tsx). */
export type DragListeners = SyntheticListenerMap | undefined;
export type DragAttributes = DraggableAttributes;
```

**Files — Modify:**
- `frontend/src/components/roster/RosterCard.tsx` (~line 44) + `RosterCards.tsx` (~line 70): re-point `import type { DragAttributes, DragListeners } from '../player/DroppablePlayerCard'` → `from './dragTypes'`. Byte-identical types (verify against the deleted source).
- Barrels: `frontend/src/components/loot/index.ts` (drop `LootPriorityPanel`, `SummaryPanel` exports), `frontend/src/components/schedule/index.ts` (drop `ScheduleTab`, `SessionCard`, `ScheduleUpcomingPanel` exports — verify `ScheduleIntegrationsPanel`'s import path in `SettingsPanel.tsx:27` first; keep whatever it needs), `frontend/src/components/static-group/index.ts` (drop `StaticHomeTab` if exported), any `player/index.ts` barrel similarly.
- `frontend/eslint-suppressions.json`: remove the `src/components/history/AllWeeksView.tsx` entry.
- **Test-mock pruning (REQUIRED — deleted module paths inside `vi.mock` calls throw at resolution):** grep every test file for the deleted paths (`splitClearStore`, `PlayerSetupBanner`, `StaticHomeTab`, `ScheduleTab`, `PlayerGrid`, `HistoryView`, `LootPriorityPanel`, etc.) and remove those `vi.mock` blocks + related stub variables. Known locations: `NewShell.roster.test.tsx`, `NewShell.gear.test.tsx`, `NewShell.schedule.test.tsx`, `NewShell.slot.test.tsx`, `NewShell.banners.test.tsx`, `NewShell.rail.test.tsx`, `NewShell.authGuard.test.tsx`. Do NOT weaken any assertion — only remove mocks of modules that no longer exist.

**Steps:**

- [ ] **Step 1: Verify zero importers per file.** For each deletion candidate: `rg "from '.*<Name>'" frontend/src` (module-path form, not bare word — avoids comment false-positives). Every hit must be inside the deletion set itself. If ANY live file still imports a candidate → STOP, report BLOCKED with the importer (the plan's graph is then stale).
- [ ] **Step 2: Create `dragTypes.ts` + re-point** RosterCard/RosterCards. Run `pnpm vitest run src/components/roster` → green.
- [ ] **Step 3: Delete the files** (`git rm`), update barrels, prune the AllWeeksView suppression entry, prune test mocks.
- [ ] **Step 4: Sweep.** `rg "split-clear|splitClear|StaticHomeTab|PlayerGrid|DroppablePlayerCard|DragOverlayCard|PlayerCardHeader|PlayerCardGear|GearTable|PlayerSetupBanner|LodestoneSearchModal|TeamSummaryEnhanced|HistoryView|SectionedLogView|AllWeeksView|WeeklyLootGrid|LootPriorityPanel|SummaryPanel|ScheduleTab|SessionCard|ScheduleUpcomingPanel|RosterViewToggle|RosterDragOverlay" frontend/src` — acceptable hits ONLY: `WeekStepper` internals, comments in surviving files that merely narrate history (update NewShell/RosterCards comment references to deleted files where trivially misleading), `releaseNotes.ts`, and v2 `SessionList.tsx`/`SessionRsvpCard` (different components whose names substring-match `SessionCard` — check module paths). e2e hits are Task 5's.
- [ ] **Step 5: Gate.** Full `pnpm test` + `pnpm lint` (0 err — expect the warn count to DROP; note the delta for the PR body) + `pnpm check:design-system:strict` + `pnpm build`.
- [ ] **Step 6: Commit** — `feat(redesign): flip-p3 task 4 — delete dead legacy tree (player-card chain, split-clear, history, legacy schedule/loot bodies)`.

---

### Task 5: Rewrite the e2e suite to v2 selectors (un-rot) + contrast cleanup

**Precondition (orchestrator provides):** backend on :8001 (started from `backend/`, venv uvicorn, `DEV_AUTH_MODE` + `DEV_LODESTONE_MOCK=true`) and frontend on :5174 running. The implementer runs specs live while iterating: `pnpm test:e2e -- smoke.spec.ts` etc. from `frontend/`.

**Files:**
- Modify: `frontend/e2e/helpers/auth.ts`, `frontend/e2e/smoke.spec.ts`, `frontend/e2e/contrast.spec.ts`
- Possibly modify (testid additions ONLY, no behavior): `frontend/src/components/profile/CharacterLinkModal.tsx` if role/text queries prove insufficient for the lodestone flow

**Selector ground truth (verified at HEAD — use these exact strings):**
- v2 root: `[data-testid="new-shell"]` (NewShell.tsx:342). Spine: `role=tablist` "Main content sections"; tabs `role=tab` named **Home / Roster / Loot / Schedule** (`aria-selected` marks active). URL: `?tab=overview|roster|gear|schedule`.
- TopBar: static name = plain text in StaticPicker (`getByText('Dev Test Static')`); invite `IconButton[aria-label="Invite members"]`; settings gear `aria-label="Settings"`; palette `aria-label="Command palette"`; picker trigger `aria-label="Switch static"`. User menu lives in the AppRail footer: `aria-label="User menu for ${displayName}"` (unchanged from legacy).
- Settings host (desktop): `role=dialog` `aria-label="Static settings"` (RightDockPanel.tsx:55). Tabs inside are plain buttons named: General, Static, Priority, Goals & Farms, Recruitment, Integrations, Members (role-filtered). "Invitations" is a SECTION inside Recruitment (RecruitmentTab sub-nav: Overview/Listing/Requests/Invitations).
- Schedule: root `[data-testid="schedule-screen"]`; `<h1>Schedule</h1>` (no "Raid Schedule" in v2); add-session = `getByRole('button', { name: 'Add session' })` (WeekNavigatorStrip, `canManage`-gated); session card = CardShell with `<h3>` = session title (occurrence anchor id `schedule-session-{id}`); RSVP buttons by visible text **"I'm in" / "Tentative" / "Can't make it"** with `aria-pressed`; kebab `aria-label="Session actions"` → Edit/Share/Copy for Discord/Manage occurrences/Delete. `CreateSessionModal`/`OccurrenceListModal` are the SAME components legacy used — in-modal selectors from the old tests carry over.
- Availability: heatmap = CardShell `<h3>Team availability</h3>`, button **"Edit week"** → `Modal title="Edit availability"`; inside it `[data-testid="availability-grid"]` and cells `avail-cell-{YYYY-MM-DD}-{HHMM}` (colon stripped: `avail-cell-2026-07-08-1800`). Recommendations: CardShell `<h3>Best times this week</h3>`, propose buttons `aria-label="Propose session {when}"`.
- Roster: root `[data-testid="roster-screen"]`; card anchor DOM id `player-card-{playerId}`; page-header button **"Manage characters"** → `Modal title="Characters"` → RosterCharacterPanel.
- States (ShellContentStates): `shell-state-loading` / `shell-state-error` (heading "Private Static", body "This static is private. Please log in to view it.") / `shell-state-not-found` (heading "Group Not Found") / `shell-state-no-tiers` (heading "No Raid Tiers").
- Backend: dev-auth login flips DEVTST to `is_public=True` + `settings.discovery.enabled=true` on EVERY `/api/dev-auth/login/{n}` call (dev_auth.py:418-429) — this is why the old "guest sees Private Static" tests rotted. `StaticGroupUpdate` accepts camelCase `isPublic`. Lodestone mock: `GET /api/lodestone/status` → `{ mockMode: true, mockSearchNames: [...] }` when enabled, 404 otherwise.

**Steps:**

- [ ] **Step 1: Rewrite `helpers/auth.ts`.**

```ts
export async function goToTestStatic(page: Page, waitForAuth = true): Promise<void> {
  await page.goto(`/group/${DEV_SHARE_CODE}`);
  await page.locator('[data-testid="new-shell"]').waitFor({ timeout: 15_000 });
  if (waitForAuth) {
    await page.getByRole('button', { name: /User menu for/i }).waitFor({ timeout: 15_000 }).catch(() => {});
  }
}

export async function switchTab(page: Page, tabName: 'Home' | 'Roster' | 'Loot' | 'Schedule'): Promise<void> {
  await page.getByRole('tab', { name: tabName, exact: true }).click();
}
```

Keep `loginAsOwner`/`loginAsMember`/`API_BASE`/`FRONTEND_BASE`/`DEV_SHARE_CODE` as-is. Add a helper for the guest-privacy test:

```ts
/** Flip DEVTST's isPublic via the owner's API session (dev-auth re-flips it to
 * public on every login, so tests that need a private static set it explicitly
 * and restore afterwards). */
export async function setStaticPublic(page: Page, isPublic: boolean): Promise<void> {
  const groupRes = await page.request.get(`${API_BASE}/api/static-groups/by-code/${DEV_SHARE_CODE}`);
  const group = await groupRes.json();
  const putRes = await page.request.put(`${API_BASE}/api/static-groups/${group.id}`, { data: { isPublic } });
  if (!putRes.ok()) throw new Error(`setStaticPublic(${isPublic}) failed: ${putRes.status()}`);
}
```

(`page.request` shares the browser context's cookies, so call it from a logged-in owner page. Verify the by-code response shape — if the group is nested under a key, unwrap accordingly.)
- [ ] **Step 2: Rewrite `smoke.spec.ts` test-by-test** (keep the serial structure and describe blocks; keep `isLodestoneMockEnabled` guard):
  1. Login+open: assert `getByText('Dev Test Static')` visible + `getByRole('tab', { name: 'Roster' })` visible.
  2. Schedule loads: `switchTab('Schedule')` → `schedule-screen` visible + `getByRole('heading', { name: 'Schedule' })` + `getByRole('heading', { name: 'Team availability' })`.
  3-5b. Sessions: replace `add-session-btn` with `getByRole('button', { name: 'Add session' })`; in-modal selectors unchanged (same CreateSessionModal); session-card assertions → CardShell heading text; `rsvp-available`→`getByRole('button', { name: "I'm in" })`, `rsvp-unavailable`→`getByRole('button', { name: "Can't make it" })`, assert `aria-pressed="true"` after click; cleanup via `aria-label="Session actions"` kebab → Delete.
  6-9. Availability: navigate Schedule → click "Edit week" → wait for the "Edit availability" dialog → interact with `availability-grid` / `avail-cell-{date}-{HHMM}` (NOTE: strip the colon from times — the old suite's cell-id format had none either, verify while porting drag coords logic unchanged); persist-after-reload re-enters through Edit week; recommendations → "Best times this week" heading.
  10/12 Guest: split into two deterministic tests: (a) *guest on public static is read-only*: fresh context (no login), goto bare group URL → `new-shell` visible, then assert the guest-invisible manager affordances: `aria-label="Invite members"` count 0, "Add session" count 0, "Manage characters" count 0 (also check `aria-label="Settings"` live — if the v2 gear renders for guests, drop that assertion and note it in the report rather than forcing it); (b) *guest sees the private wall*: owner page → `setStaticPublic(page, false)` → new guest context → goto → `shell-state-error` visible + `getByRole('heading', { name: 'Private Static' })` → finally (in a `try/finally`) owner `setStaticPublic(page, true)`.
  11/13 Settings: click `aria-label="Settings"` gear → `role=dialog` `aria-label="Static settings"` visible → assert tab buttons **General / Priority / Members / Recruitment / Integrations** visible (scope queries to the dialog); Invitations: click Recruitment → assert the "Invitations" section button.
  14 Lodestone (mock-gated, keep the skip-guard): rewrite to the surviving lodestone-search UI — the profile character-link flow: `page.goto('/profile')` → read `CharacterLinkModal.tsx` + the profile page source to map the open-affordance and search-input selectors → search a name from `mockSearchNames` → click the result (rows keyed by lodestoneId) → link → assert the linked character appears. Prefer role/text queries; if impossible, ADD `data-testid` attributes to `CharacterLinkModal.tsx` (behavior-neutral, document in the report).
- [ ] **Step 3: Clean `contrast.spec.ts`.** Remove `?shell=v2` from the 3 URLs (keep `&tab=` params → they become `?tab=...`); update the header comment + inline comments that describe the legacy-vs-v2 split (the v2 route is now the only route). Do NOT touch `LEGACY_ROLE_BADGE_SELECTORS` (RosterCard still imports legacy PositionSelector/TankRoleSelector — post-flip polish) or the design-system `test.skip` (F3 rebuild debt, unrelated).
- [ ] **Step 4: Live run.** `pnpm test:e2e -- smoke.spec.ts` → ALL tests pass (14 scenarios incl. the 6 previously rotten). `pnpm test:e2e -- contrast.spec.ts` → passes (or same skips as before). Capture the summary output in the report.
- [ ] **Step 5: Commit** — `test(redesign): flip-p3 task 5 — smoke suite rewritten to v2 selectors; guest tests made deterministic; contrast param cleanup`.

---

### Task 6: Consolidate the NewShell test scaffolds + retire the zero-arg store-mock foot-gun

**Files:**
- Create: `frontend/src/pages/newShellTestScaffold.tsx` (test-only module; name it so vitest doesn't collect it as a suite — no `.test.` segment)
- Modify: `frontend/src/pages/NewShell.slot.test.tsx`, `NewShell.roster.test.tsx`, `NewShell.gear.test.tsx`, `NewShell.schedule.test.tsx` (primary); `NewShell.banners.test.tsx`, `NewShell.rail.test.tsx`, `NewShell.authGuard.test.tsx` (only where they can adopt a factory without restructuring)

**Interfaces:**
- Produces (exact exports — vi.mock factories cannot be imported into the hoisted mock closure, so export BUILDERS the tests call inside their own `vi.mock` blocks):

```tsx
export function makeGroupViewStateMock(overrides?: Partial<GroupViewStateShape>): GroupViewStateShape; // the 30-field state object, pageMode et al overridable
export function dualFormStoreMock<S>(state: S): (selector?: (s: S) => unknown) => unknown; // sel ? sel(state) : state
export function makeTierStoreState(overrides?): TierStoreShape;
export function makeStaticGroupStoreState(overrides?): ...;
export function makeAuthStoreState(overrides?): ...;
// plus the shared heavy-leaf stub list documented in a header comment
```

**Steps:**

- [ ] **Step 1:** Extract the duplicated scaffold from `NewShell.roster.test.tsx` (the most complete copy) into the new module. Every store mock becomes dual-form: `useXStore: (sel?: (s: State) => unknown) => (sel ? sel(state) : state)` — this retires the zero-arg `useTierStore` foot-gun in roster/gear/schedule (currently `() => ({...})`, ignoring selectors).
- [ ] **Step 2:** Refactor `slot`/`roster`/`gear`/`schedule` suites onto the scaffold. RULE: **zero assertion changes** — this is a pure test-infrastructure refactor; each file keeps its own `vi.mock` calls (vitest hoisting) but their factories delegate to the scaffold builders. Also drop any mocks left dead by Tasks 2/4 (already-pruned paths, unused stub vars).
- [ ] **Step 3:** In `banners`/`rail`/`authGuard`: adopt the shared builders ONLY where a mock is verbatim-identical to a scaffold builder; otherwise leave them (they test different surfaces — restructuring is not in scope).
- [ ] **Step 4:** Run all seven suites: `pnpm vitest run src/pages` → identical pass counts to before the refactor (record before/after counts in the report). Full gate: `pnpm test` + `pnpm build`.
- [ ] **Step 5: Commit** — `test(redesign): flip-p3 task 6 — shared NewShell test scaffold, dual-form store mocks`.

---

### Task 7: DESIGN_SYSTEM.md contract backfill (9 components) + §7 ledger honesty pass

**Files:**
- Modify: `design/redesign/DESIGN_SYSTEM.md` (§3 additions 3.28–3.36, §7 items 2/3)

**Steps:**

- [ ] **Step 1:** Read each component source and write a contract in the established §3 format (Anatomy / Props / States / a11y / Usage rules — mirror §3.16 CardShell's structure and depth):
  - 3.28 `SegmentedToggle` — `frontend/src/components/ui/SegmentedToggle.tsx`
  - 3.29 `GearBoard` + `GearBoardCell` — `frontend/src/components/roster/GearBoard.tsx` / `GearBoardCell.tsx` (one combined entry; document the `need.up` priority-highlight contract)
  - 3.30 `RosterCard` — `frontend/src/components/roster/RosterCard.tsx` (note the legacy `PositionSelector`/`TankRoleSelector` imports as disclosed debt)
  - 3.31 `RecipientPicker` — `frontend/src/components/loot/RecipientPicker.tsx`
  - 3.32 `FloorCard` — `frontend/src/components/loot/FloorCard.tsx`
  - 3.33 `PriorityRow` — `frontend/src/components/ui/PriorityRow.tsx`
  - 3.34 `FairnessSummary` — `frontend/src/components/loot/FairnessSummary.tsx`
  - 3.35 `WeekScopeControl` — `frontend/src/components/loot/WeekScopeControl.tsx`
  - 3.36 `LootHistoryTable` + `WeekGroupHeader` — `frontend/src/components/loot/LootHistoryTable.tsx` / `WeekGroupHeader.tsx` (one combined entry)
  Props/types must match the ACTUAL source signatures — no invented props.
- [ ] **Step 2:** §7 ledger items 2/3: annotate each as resolved-in-substance with an honest note — item 2: "`GearBoardCell` (F6c) replaced ad-hoc pips; derives state from the same `toGearState` utilities as GearStatusCircle rather than rendering it — visual unification superseded by the gcell design"; item 3: "`RecipientPicker` (F6d) consolidated the forked modals on `SegmentedToggle`/RadioGroup rather than a PopoverSelect specialization — goal achieved, mechanism differs." Cross-reference the new contract numbers.
- [ ] **Step 3:** Docs-only commit — `docs(redesign): flip-p3 task 7 — DESIGN_SYSTEM contracts for F6c/F6d components; §7 ledger updates`.

---

### Task 8: Internal release note

**Files:**
- Modify: `frontend/src/data/releaseNotes.ts` (append to the UNRELEASED items array, before its closing `]`)

**Steps:**

- [ ] **Step 1:** Append (same shape as the P1/P2 entries; `internal: true` last field of the item per file convention; `CURRENT_VERSION` UNCHANGED at `2.0.2`):

```ts
{
  internal: true,
  category: 'improvement',
  title: 'Flip P3 — legacy group view deleted',
  description:
    'The legacy group view, its ?shell= escape hatch, and every legacy-only tab body are gone; the v2 shell is the only /group experience. The plugin gear-sync dashboard moved to the Plugin tab, and the e2e smoke suite now exercises the v2 interface end to end.',
  pr: 0,
  prTitle: 'feat(redesign): flip-p3 — delete legacy group chrome',
},
```

- [ ] **Step 2:** `cd scripts && npm test` (139 tests — enforces CURRENT_VERSION/latest-public invariant) → green. `pnpm test` in frontend for the releaseNotes suites.
- [ ] **Step 3:** Commit — `docs(redesign): flip-p3 task 8 — internal release note`.

---

## After all tasks (orchestrator)

1. Whole-branch review (`redesign-reviewer`, `f45a241..HEAD`, full review package) — triage/fix wave (ONE fix subagent for all findings).
2. Land gate: `pnpm build` · `pnpm lint` (0 err) · `pnpm check:design-system:strict` · `pnpm test` · `pnpm tokens:check` · `git diff --check` · `cd scripts && npm test`.
3. Live e2e (servers up): `pnpm test:e2e -- smoke.spec.ts contrast.spec.ts` — all green.
4. Browser validation (chrome-devtools, DevOwner/DEVTST): bare `/group/DEVTST` = v2; `?shell=legacy` now renders v2 too (gate gone — expected); palette Tracking/Plugin/More entries work; PluginPage shows Gear Sync section (screenshot); Settings gear → panel; no console errors.
5. PR into `redesign/foundation`: body documents D-P3-1…7 + the spec §6 corrections + suppression delta + capability notes (split-clear, team-summary books/materials ledger, in-static lodestone sync → profile flow) + screenshots. Backfill `pr: 0` → N.
6. pr-review-loop → checks green → self-squash-merge → bookkeeping (ledger, SESSION_HANDOFF, spec status header, memory).
