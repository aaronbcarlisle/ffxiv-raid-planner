# Phase A — v2 Flip-Debt Fixes (Design Spec)

> **Status:** SPEC — awaiting user async skim (AUTONOMOUS_RUN §4 pause).
> **Inputs:** ROLLOUT_ROADMAP §3 (the 12 verified fixes + 2 user quick wins + 3 Phase-R
> follow-ups) · holistic review 2026-07-11 (memory `project-holistic-review-2026-07`) ·
> a 13-investigator grounding pass against head `810a48d` (every finding re-verified on
> current code; all 17 premises CONFIRMED — several with corrections, folded in below).
> **Branch:** `redesign/phase-a-flip-debt` → PR into `redesign/foundation`, squash-merge.
> **Gate to Phase G:** this phase is the last pre-merge requirement before the
> user-owned foundation→main merge (ROLLOUT_ROADMAP §4).

---

## 1. Goal · shape · non-goals

**Goal:** clear the flip debt so v2 has no capability dead-ends or correctness traps,
and close the three Phase-R follow-ups. One slice, one PR, ~13 SDD tasks (all
independent; sizes S/M — no L). Legacy stays frozen; the handful of legacy-shared file
edits below are **bugfixes**, each individually justified in the PR body.

**Non-goals (explicitly out of scope):**
- Phase C material: expanded/collapsed card axis, on-card gear editing, restored
  GearTable. (A3 ships a *toggle-only* interim affordance — see A3.)
- Plan M §2/§3 (account deletion / data export) — only Plan M §1 leave-static lands.
- Archive Static semantics (button is removed; feature needs its own spec — §4).
- Frozen-file void'd-promise fixes (SplitClearPlanner, LodestoneSearchModal — §4).
- `discord_webhook._next_occurrence_iso` (third recurrence engine, RSVP message text
  only — §4).
- Any design-taste polish beyond the two named quick wins (Phase E owns polish).

**Freeze/shared-file rules for this slice (recap):**
- Byte-frozen (f45a241-restored) files: NOT touched by any task. Reference-only files
  named per item. The freeze-check loop (Phase R plan Task 10) re-runs at PR time.
- Hand-reconciled/shared files touched here (`GroupViewContent.tsx`, `MorePage.tsx`,
  `Header.tsx`, `CreateSessionModal.tsx`, `utils/recurrence.ts`,
  `ScheduleIntegrationsPanel.tsx`, `stores/authStore.ts`, `App.tsx`,
  `backend/app/routers/dev_auth.py`): every edit is a bugfix or an additive optional
  prop; both smoke suites must stay green in one run; each edit gets a PR-body
  justification line.
- Internal release note (`{ internal: true }`), NO version bump (Phase G ships the
  public entry — its copy should mention Leave Static, a real prod request).
- NO AI attribution. PR embeds screenshots (mobile viewport included for A5c; light +
  dark for A12).

---

## 2. The fixes

### A1 — Add-player dead-end (CRITICAL) — size M

**Verified:** `Roster.tsx:321-323` wires BOTH the toolbar Add-player button
(`RosterToolbar.tsx:112-120`) and every open-seat card CTA (`RosterCards.tsx:333-358`)
to `void playerActions.handleAddPlayer()` → raw `tierStore.addPlayer` → a blank
`configured:false` slot with **no configure or remove affordance** (unconfigured
players never mount `RosterCard`, so the kebab's Remove is unreachable). The correct
flow already exists and is already mounted above `<Roster/>`:
`useGroupActions().onAddPlayer` → `AddPlayerModal` → create + configure atomically
(`groupActionsContext.tsx:147,169-215`). Legacy's open-seat affordances
(`EmptySlotCard`/`InlinePlayerEdit` via `PlayerGrid.tsx:192-206,258-264`) have no v2
equivalent; `editingPlayerId` is plumbed into Roster but never read. Backend DELETE
(`tiers.py:1020-1047`) already removes unconfigured players — no backend work.

**Fix:**
1. `Roster.tsx`: the toolbar's `onAddPlayer` → `useGroupActions().onAddPlayer`
   (opens `AddPlayerModal`; provider is already an ancestor). No raw blank-slot path
   remains on any visible button. `usePlayerActions.handleAddPlayer` stays as the
   internal primitive (duplicate-player still uses it).
2. `RosterCards.tsx` open-seat branch (`!player.configured`): per-seat **Configure**
   and **Remove** affordances scoped to that player id. Configure = a small inline v2
   form on the card (name `Input` + `JobPicker` — same import-only reuse as
   `RosterCard`'s inline job picker at :349-368), submitting via the existing
   `playerActions.handleConfigurePlayer(player.id, {name, job, role})` (sets
   `configured:true` on THAT id). Remove = `actionsForPlayer(player).onRemove()`
   (already wired at `Roster.tsx:311`); `actionsForPlayer` must now also be invoked
   for unconfigured players. Do NOT extend `AddPlayerModal` with an edit mode (shared
   legacy component; keep it create-only).
3. Both affordances gated on the same roster-manage permission the legacy
   EmptySlotCard uses.
4. **DEVTST orphan cleanup:** during browser validation, delete the 6 orphan slots via
   the NEW v2 Remove affordance (validates the fix live). No script/migration.

**Files:** `Roster.tsx`, `RosterCards.tsx` (+ possibly a small new
`components/roster/OpenSeatCard.tsx`), tests (`Roster.test.tsx` re-targets the
add-player assertion to `useGroupActions().onAddPlayer`; `RosterCards.test.tsx` gains
configure/remove coverage). All v2-only.

### A2 — Member gear self-edit on the Board — size S

**Verified:** `GearBoard.tsx` gates all editing on one screen-wide `canManage`
(roster-management, from `NewShell.tsx:80-90`) at :79/:158/:159; it never imports
`canEditGear`. `GearBoardCell` is already per-cell generic (`disabled`/`onCycle`).
Legacy's per-player pattern: `GearTable.tsx:472` (frozen, reference only).

**Fix:** replace GearBoard's `canManage` prop with `userRole` / `currentUserId` /
`isAdminAccess` (the exact trio `Roster.tsx:372-374` already passes to RosterCards);
compute `canEditGear(...).allowed` once per player row; per-row `disabled`/`onCycle`
(withhold `onCycle` entirely for non-editable rows — matches the existing pattern).
`canManage` is removed from GearBoard's props (no remaining use). Blocked-cell
tooltip/reason = polish, deferred (§4).

**Files:** `GearBoard.tsx`, `Roster.tsx` (call site), `GearBoard.test.tsx` (all 8
tests re-propped + a new same-render own-row-editable/other-row-inert test — the test
that proves the bug dead). All v2-only.

### A3 — Tome-weapon interim affordance — size S

**Verified:** the pursuing toggle lives only in frozen legacy
(`WeaponBiSSelector`, `GearTable.tsx:301-427`); `BiSSourceSelector` has exactly 1
importer (frozen `GearTable`) — **do not delete or modify it**. v2 has zero
`tomeWeapon` references. The mutation is just the generic
`onUpdate({ tomeWeapon: {...} })` (PlayerCard.tsx:198-200 precedent) — v2's
`actions.onUpdate` already resolves to the same store path.

**Fix:** one direct-action kebab item in `useRosterCardActions.tsx` "BiS & Gear"
section (adjacent to Weapon Priorities): label
`Track Tome Weapon` ⇄ `Stop Tracking Tome Weapon`, onClick
`actions.onUpdate({ tomeWeapon: { ...player.tomeWeapon, pursuing: !pursuing } })`,
gated `editPermission` (already computed in the hook). Distinct icon (not `Swords`,
which the adjacent item uses — implementer picks, e.g. `BookMarked`/`Coins`).
**Interim = toggle-only, deliberately:** the tome weapon's have/augmented states stay
legacy-only until Phase C restores the GearTable — the dual shell is the escape hatch
meanwhile. Test fixture `makePlayer()` gains a default `tomeWeapon`.

**Files:** `useRosterCardActions.tsx` (+ its test). v2-only.

### A4 — Danger Zone (Delete · Leave · Archive) — size M

**Verified (corrects the roadmap's framing):** MorePage renders in **BOTH shells**
(GVC `pageMode==='more'` has no slot gate) — this fix reaches legacy too, as a
bugfix. All three buttons call `onOpenSettings('danger')` (`MorePage.tsx:308-356`);
`'danger'` is not a `SettingsTab`, so `SettingsPanel.tsx:365` silently falls back to
General — Delete Static is unreachable from here, Leave/Archive never act. The REAL
delete flow works in the `static` tab (`StaticTab.tsx:305-314`). **Leave Static is
NOT unimplemented**: backend self-leave exists with owner-guard + `unlink_players`
(`static_groups.py:1110-1143`), and `staticGroupStore.removeMember` (:364-370) calls
it with **zero call sites** — the capability is fully built and dead. Archive has no
backend/model/endpoint anywhere.

**Fix (three sub-fixes):**
1. **Delete Static:** button passes `'static'` (the real tab). One-line retarget.
2. **Leave Static (Plan M §1 — implement now):** wire the button to a real handler —
   `ConfirmModal` (lighter than delete's type-the-name flow; leaving is reversible by
   re-invite) with copy stating claimed players will be unlinked → 
   `removeMember(groupId, currentUserId)` (backend default `unlink_players=true`, no
   toggle exposed) → success toast → `navigate('/profile?tab=statics')` (StaticTab
   delete precedent). Requires threading `groupId`/`currentUserId`/handler into
   MorePage via GVC (additive optional props; legacy + v2 both get it — the button is
   equally broken in both shells today, and this is the real prod request from the
   Grimm report). Owner never sees Leave (existing `isOwner` branching stays).
3. **Archive Static:** remove the button outright. No "Coming soon" badge — archive
   semantics are an undecided product question; a placeholder implies roadmap
   commitment. Goes on the revisit list (§4).

**Files:** `MorePage.tsx` (shared, both shells — bugfix), `GroupViewContent.tsx`
(prop threading; shared), `staticGroupStore.ts` (no change expected — method exists),
`MorePage.test.tsx` (danger zone currently has ZERO coverage — new tests for all
three behaviors), `GroupViewContent.slots.test.tsx` (prop wiring). Backend: none.

### A5 — Shell/nav trio: rail stubs · rail-less UserMenu · mobile shell toggle — size M

**(a) Rail stubs — verified:** `NewShell.tsx:309,317` onSelect bodies are comment-only
no-ops; the comments name routes (`/player-hub`, `/find-static`) that **don't exist**.
Real routes: `/profile`, `/discover`. `navigate` is already bound at :177.
**Fix:** `() => navigate('/profile')` / `() => navigate('/discover')`; correct the
stale comments. `isActive` stays hardcoded false — NewShell only renders on group
routes, so these entries can never be active; wiring it would be dead code.

**(b) Rail-less UserMenu — verified:** `Header.tsx:66`
`railPresent = !!user || isGroupRoute` is consumed only inside the `user ?` branch
(:401-412) — the `!!user` term makes it ALWAYS true there, so the header UserMenu is
`sm:hidden` on every route for every signed-in user; `/discover`, `/docs*`,
`/dashboard`, `/admin*`, `/profile/:shareCode`, `/` have no rail → no sign-out.
`Header.avatar.test.tsx:39-50` currently asserts the bug as correct.
**Fix:** predicate becomes "route renders its own rail+UserMenu" =
`isGroupRoute || pathname === '/profile'` (exact match — `/profile/:shareCode` is
PublicProfile, no rail). Flip/extend the test (`/dashboard`, `/discover`, `/docs`,
`/profile` vs `/profile/:code`). Implementer confirms `DesignSystem.tsx` doesn't
mount a real rail UserMenu (only page found un-inspected in the audit).

**(c) Mobile shell toggle — verified:** legacy banner is wrapped `hidden sm:block`
(`Header.tsx:315-321`); v2's only toggle lives in the rail UserMenu and
`AppRail.tsx:141` is `hidden sm:flex` — on mobile NEITHER direction is reachable,
while a desktop v2 opt-in mirrors to `User.ui_shell` and traps a phone in v2 (only
per-load `?shell=legacy` escapes). `MobileBottomNav` renders in both shells and its
More tab reaches MorePage — the natural v2 mobile home.
**Fix (two one-way affordances):**
1. Legacy→v2: make `TryNewUiBanner` reachable below `sm` — a compact mobile row in
   the Header (placement finalized at implementation; PR screenshots at mobile
   viewport are the review surface, per the screenshots rule). Same dismiss
   persistence + telemetry as desktop.
2. v2→legacy: "Switch to classic UI" entry on the v2 MorePage — new **optional**
   `onSwitchToClassicUi?: () => void` MorePage prop (mirrors the `onOpenSplitPlanner`
   optional-prop precedent), threaded from `ShellContent` (NewShell) through GVC;
   legacy never passes it → renders only in v2, **at all viewports** (harmless
   desktop redundancy; More is a natural settings-ish home). Fires
   `useShellToggle` with a new surface literal `'v2-more-page'` (widen the union in
   `useShellToggle.ts:13`).

**Files:** `NewShell.tsx`, `Header.tsx` (shared — sanctioned edit, both fixes b+c),
`Header.avatar.test.tsx`, `TryNewUiBanner.tsx` (responsive tweaks if needed),
`MorePage.tsx` + `GroupViewContent.tsx` (additive optional prop), `useShellToggle.ts`,
tests (`NewShell.rail.test.tsx` nav assertions; MorePage/GVC slots tests for the new
prop; banner mobile visibility).

### A6 — Home activity feed: loot fold — size M

**Verified (corrects the finding's framing):** `deriveActivityItems`
(`utils/staticActivity.ts:62-207`) is mount-farm/plugin-only — and **legacy's feed
never showed loot either** (backend `StaticActivityLog` event types are mount-farm
only; `StaticHomeTab` falls back to the same util). So this is a v2-side improvement,
not a parity restore. `StaticActivityFeed` is v2-only (sole importer `Home.tsx`).
`Home.tsx` already fetches `lootLog`; nothing fetches `materialLog` in the v2 path.
Loot entries carry `recipientPlayerName` unconditionally and are already shown by
name to all members in Loot History — no new privacy exposure.

**Fix (additive-only; zero edits to the shared util or frozen StaticHomeTab):**
1. New util (new file, e.g. `utils/lootActivity.ts`):
   `deriveLootActivityItems(lootLog, materialLog)` with its **own** item/icon type
   union — never widen `StaticActivityItem` (frozen StaticHomeTab keys an exhaustive
   `Record` on its icon union; widening breaks `tsc -b`). Labels terse, mount-row
   style: loot `{recipient} received {slot/item} — {fight}`, material
   `{recipient} received {material}`; method distinction deferred to polish. Reuse
   `relativeTime` (pure, untouched).
2. `StaticActivityFeed.tsx`: read `lootLog`/`materialLog` from `useLootTrackingStore`,
   merge both derivations into a local render type, sort by `createdAt` desc, slice 5
   (pure recency — a big raid night dominating the feed IS the recent activity).
   Two new icon badges (loot, material) in the component-local map.
3. `Home.tsx`: add `fetchMaterialLog(group.id, tierId)` to the existing
   membership-gated mount effect (mirrors `fetchLootLog`).

**Files:** new `utils/lootActivity.ts` (+test), `StaticActivityFeed.tsx` (+test w/
lootTrackingStore mock), `Home.tsx` (+test). `staticActivity.test.ts` must pass
UNMODIFIED (freeze-proof for the legacy fallback path). All v2-only.

### A7 — 404 catch-all route — size S

**Verified:** react-router v7 `<Routes>` in `App.tsx` has no `path="*"` anywhere; an
unknown URL matches nothing, so even Layout never mounts — truly blank page. No
NotFound component exists. `EmptyState` (`components/ui/EmptyState.tsx`) is the
established both-shell empty-state primitive (Discover, ShellContentStates).

**Fix:** new lazy `pages/NotFound.tsx` composed from `EmptyState` (icon `Compass`,
heading "Page not found", one-line description, CTA button → `navigate('/')` — the
index route already handles auth-state routing). Register
`<Route path="*" element={<NotFound />} />` as the LAST child **inside** the Layout
route so Header/nav mount around it. No second top-level wildcard. Invalid
`/group/:shareCode` keeps its existing shell-internal not-found handling (out of
scope). Test: NotFound unit test + an App-level MemoryRouter test at an unmatched
path asserting NotFound content AND Header chrome (proves Layout mounted).

**Files:** `App.tsx` (shared — additive route), new `pages/NotFound.tsx` (+tests).

### A8 — Auth 429 false-logout — size S

**Verified:** `authStore.ts` `refreshAccessToken` (:425-470) throws status-less on
any `!response.ok` and one catch clears `user`/`isAuthenticated` for 401/429/5xx/
network alike (backend refresh is rate-limited 10/min — `rate_limit.py:74`,
`auth.py:302`). **Second site:** `fetchUser`'s else-branch (:513-520) force-clears on
ANY refresh-false — must also be fixed or the symptom survives. `services/api.ts`
needs no change (it never clears auth state itself).

**Fix:**
1. `refreshAccessToken`: branch on `response.status` — 401/403 → cancel scheduled
   refresh, clear user, return false (real auth failure). Anything else non-ok
   (429/5xx) AND fetch rejection (network) → return false **without touching state or
   the scheduled refresh** (the un-cancelled proactive timer + the reactive 401 retry
   in api.ts are the retry story; no new backoff logic).
2. `fetchUser` else-branch: stop clearing — set `isLoading:false` only;
   refreshAccessToken has already decided (cleared for 401/403, kept for transient).
3. Out of scope, noted §4: the retry-catch branch (:503-511) — can't 429 today
   (no rate limit on `/me`), needs an authRequest status refactor to fix properly.

**Tests:** new `authStore.refreshAccessToken.test.ts` (401 clears · 403 clears ·
429 keeps · 500 keeps · network keeps; mirrors initializeAuth test scaffolding) +
third initializeAuth case (me→401, refresh→429 ⇒ user retained, authInitialized
true) + keep the existing 401-then-401 logout case green. `authStore.ts` is
core-shared (never restored/frozen) — both shells benefit identically.

### A9 — BYDAY=SA recurrence divergence — size M

**Verified:** frontend `utils/recurrence.ts` `computeNextOccurrence` has a
single-BYDAY "fast path" (:221-243) that **never reads the BYDAY value** — it
advances from DTSTART's weekday; only the multi-BYDAY branch (:245-279) honors days.
Backend `services/recurrence.py` honors BYDAY unconditionally (`_advance`/
`_advance_local`/`generate_occurrences`) — the surfaces disagree exactly when a
single BYDAY ≠ DTSTART's weekday. The picker guarantees that mismatch:
`CreateSessionModal.tsx:75-80` hardcodes the default to `{'SA'}` regardless of the
picked date, and `handleStartChange` (:266-278) never re-seeds. (A third naive engine
exists in `discord_webhook.py` — RSVP message text only; out of scope, §4.)

**Fix (both parts — seeding alone can't fix existing/edited sessions):**
1. **Picker seeding (roadmap ask):** new-session default derives from the chosen
   `startTime`'s weekday (fallback only while startTime is blank); re-seed on
   startTime change while the picker is untouched (dirty flag — first manual
   `toggleDay` stops re-seeding). Multi-day selection stays free-form; edit flow
   keeps rule-derived days (user intent) — no hard constraint, no edit re-seed.
2. **Engine fix (full closure):** the single-BYDAY path honors `rule.byday` like the
   multi-day branch and the backend. Keep the O(1) `advanceWeeks` path when byday is
   empty OR `byday[0]` already equals DTSTART's weekday; day-scan only on divergence.
   This is a deliberate **cross-shell bugfix to a shared util** (frozen `SessionCard`
   imports it): existing mismatched sessions change to match what Discord/backend
   already does — that is the correct direction. PR-body justification + new
   `recurrence.test.ts` cases (single BYDAY ≠ DTSTART weekday, ± timezone), pinned
   against the backend engine's semantics as oracle (`backend/tests/test_recurrence`
   checked/extended as the reference).

**Files:** `CreateSessionModal.tsx` (shared, not frozen — additive UX logic, both
shells), `utils/recurrence.ts` (shared bugfix), both test files
(+`CreateSessionModal.test.tsx` new-session seeding case). Backend: reference only.

### A10 — Void'd-promise sweep — size M

**Verified sweep (exhaustive, cross-referenced against store re-throw behavior):**
- **Group A — 14 v2-only live bugs:** `Roster.tsx` :193/:194 (mount fetches),
  :285-286 (**the lying "Link copied" toast** — success fires before/regardless of
  the write), :291-299, :322 (superseded by A1's rewiring); `RosterCard.tsx`
  :200/:227; `useRosterCardActions.tsx` :447/:632; `Loot.tsx` :187-190/:202.
- **Group B — 7 legacy-shared live bugs** in `ScheduleIntegrationsPanel.tsx`
  (:503/:510/:523-525/:753/:902/:925/:934) — the same file already contains the
  correct try/catch pattern 3× (its own precedent). Rendered by frozen ScheduleTab
  AND SettingsPanel (both shells).
- **Group C — verified NOT bugs** (non-re-throwing stores or already guarded) —
  enumerated in the grounding record; do not "fix".
- **Group D — frozen-file findings (report-only, §4):** `SplitClearPlanner.tsx` 4
  sites (confirmed re-throwing — live bug class) + `LodestoneSearchModal.tsx` 12
  sites (unverified).

**Fix — apply the two existing precedent shapes verbatim:**
- Mutations: `await` in try/catch + `toast.error` (in-file precedent:
  ScheduleIntegrationsPanel's own guarded handlers; F6d precedent).
- Clipboard: `try { await writeText(...); toast.success } catch { toast.error }`
  (SessionList.tsx:139-146 / ShellContentStates.tsx:114-127 precedent) — success
  toast NEVER before the write resolves.
- Mount fetches: `.catch(() => {})` **only if** the store's `error` state is rendered
  on that screen; otherwise `.catch` + `toast.error` (implementer checks per site —
  failures must not become fully silent). Legacy precedent: ScheduleTab.tsx:75-76.
- **Group B is fixed in this slice** — pure bugfix matching in-file precedent, not a
  surface replacement; PR-body justification; both smoke suites green.

**Tests:** per-site reject-path tests asserting `toast.error` (mutation/clipboard) and
no unhandled rejection (mount fetches — Vitest fails on genuine unhandled rejections,
a free regression guard). Extend the existing suites for each touched component.

### A11 — Assign-anyway — size S

**Verified:** two sub-bugs. (1) `FloorCard.tsx:142` disables the material row's
Assign when the priority queue is empty AND :143's handler no-ops on empty. Gear-row
Assign is never disabled, but (2) `RecipientPicker.tsx:216` always opens on
`scope='priority'` — empty pool ⇒ "No players match." + permanently disabled submit
until the user discovers the All-members toggle. `QuickLogMaterialModal` already
handles no-needers gracefully once given any `suggestedPlayer`.

**Fix:**
1. `FloorCard.tsx`: drop `disableAssign={!row.top}`; handler always fires with
   `row.top ?? players[0]` as the suggested recipient (modal's own Select allows
   immediate reassignment; `players` is already a FloorCard prop).
2. `RecipientPicker.tsx` non-edit open branch: if the priority-scope entries are
   empty, open on `scope='all'` (guaranteed non-empty while any player is configured,
   `recipientRanking.ts:90-101`) with the first entry pre-selected. Applies to the
   shared non-edit branch (both `assign` and `log` modes) — the picker should never
   open into an empty list; users can re-toggle freely.

**Tests:** REPLACE `FloorCard.test.tsx:95-124` (currently asserts the buggy disable);
keep the non-empty top-priority case untouched. New RecipientPicker test: empty
priority pool ⇒ All-members pressed, list non-empty, submit enabled with a named
recipient; plus a regression pin that a non-empty pool still opens on priority.
Legacy `LootPriorityPanel` has its own independent gating — out of scope (§4 flag).
All v2-only.

### A12 — Quick wins: initials centering · TopBar order — size S

**(a) Centering — verified root cause:** the initials chips use flex centering with
no line-height collapse (Inter's ascent/descent offsets the glyph ink in the default
`text-xs` line box). The codebase's own convention for this exact chip shape is
`leading-none` (UserMenu badges, OverviewTab, RosterCard:372, DashboardCard) — these
sites just don't follow it: `AppRail.tsx` RailAvatarItemButton fallback span
(:111-126), `PlayerIdentity.tsx` rsvp-row (:104-112) + inline (:159-167) fallbacks,
**and `PriorityRow.tsx:49-59`** (same defect class, same one-line fix — folded in;
noted in the PR body as a scope +1). The Exo-2 hypothesis was ruled out (these spans
render in Inter). Fix: add `leading-none`; verify live with 'DT'/'TE' initials at
both chip sizes, both themes (screenshots).

**(b) TopBar order — verified current:** ⌘K · invite · bell · **settings · theme**
(`TopBar.tsx:132-157`). Target: ⌘K · invite · bell · **theme · │ · settings**. Fix:
swap SettingsGear/ThemeToggle, insert the established inline divider
(`<span className="w-px h-4 bg-border-subtle flex-shrink-0" aria-hidden />` —
ContextSwitcher.tsx:165 precedent; no new primitive — §4 notes the design-system debt).
Give ThemeToggle's IconButton an explicit `size="md"` if IconButton's default differs
from its new md-sized neighbors. All v2-only; no order-dependent test assertions
exist (re-run the four suites to confirm).

### A13 — Phase-R follow-ups: splitClear slot-gate · dev_auth normalization — size S

**(a) splitClear fetch — verified:** `GroupViewContent.tsx` fires
`fetchSplitClear` on the roster tab unconditionally in two effects (:331-335 mount,
:340-344 visibility-refresh) — pure waste + guest 403 noise in v2. `!slots?.roster`
is already the file's canonical legacy-roster predicate (:713, :1162-1168, :1196).
**Fix:** add `!slots?.roster` to both trigger conditions + dependency arrays + the
one-line gate comment (mirror :710-712 style). Cleanup effect stays unconditional.
Test: hoist the `useSplitClearStore` mock in `GroupViewContent.rosterSlot.test.tsx`
to a shared `vi.fn()`; assert legacy (no slots) fetches, v2 (`slots.roster`) doesn't.

**(b) dev_auth — verified (corrects the roadmap's guess):** `tab_persistence` is a
**`users`** column (`user.py:40-45`, default `'remember'`), not static_groups. The
`is_public` normalization precedent is `dev_auth.py:418-429`. Drift scenario: a
manual Settings toggle PATCHes the dev user to `'reset'`, silently changing
tab-restore behavior under smoke-legacy.
**Fix:** in `dev_login`, before commit: normalize the **resolved logging-in `user`**
to `tab_persistence='remember'` (each suite self-restores its own login's
preconditions; no 3-user sweep), with the mirror-comment citing the is_public
precedent. Test: function-level pytest in `test_dev_auth.py` seeding
`tab_persistence='reset'` and asserting the flip (settings monkeypatch for dev mode
— first dev_login coverage in the suite; backend pytest is CI-required).

---

## 3. Task slicing (for the plan)

Thirteen independent tasks, T1–T13 ≈ A1–A13 (A5 may split a/b vs c if the plan
prefers). Suggested implementer models per the cost pins: sonnet-5 default
throughout; **no task here is flagged riskiest** (no opus/fable needed — the two
shared-file tasks with both-shell blast radius, A4 and A9-engine, get the
redesign-reviewer's extra attention instead). Known overlaps the plan must sequence:
- A1 supersedes void-site `Roster.tsx:322` (A10 must not double-fix).
- A4 and A5c both thread new optional props through `GroupViewContent.tsx` → MorePage;
  A5b and A5c both edit `Header.tsx` — sequence or co-task to avoid conflicts.
- A12a and A2 both touch GearBoard-adjacent files only in tests — no real overlap.

## 4. Deferred / reported (feeds Phase E · parity matrix · ratify list)

- **Frozen-file void'd promises:** `SplitClearPlanner.tsx` (4 confirmed re-throwing
  sites — live bug) + `LodestoneSearchModal.tsx` (12 unverified sites). Bugfix-only
  micro-slice candidate AFTER Phase A; not folded in (keeps this slice's freeze
  surface clean).
- `discord_webhook._next_occurrence_iso` — third recurrence engine, ignores BYDAY
  (RSVP message text only). Reconcile when schedule work next opens.
- `fetchUser` retry-catch branch (`authStore.ts:503-511`) — same clear-on-any-failure
  shape; needs authRequest status surfacing; cannot 429 today.
- GearBoard blocked-cell reason tooltip (legacy `disabledTooltip` parity) — Phase E.
- Archive Static — product decision + own spec if wanted; button removed (ratify).
- Vertical-divider design-system primitive (6+ inline copies now) — Phase E debt note.
- Legacy `LootPriorityPanel` assign-gating parity with A11 — parity-matrix row.
- Rail entries' `isActive` — dead in NewShell context; revisit if the rail ever
  renders outside group routes (Ring 1).

## 5. Exit gate

- Full CI gate green: `pnpm build` · `pnpm lint` (0 err) · `check:design-system:strict`
  · `pnpm test` · `tokens:check` · `git diff --check` · backend pytest.
- **Both smoke suites green in one run** (shared-file edits: A4/A5/A7/A8/A9/A10-B/A13a).
- Freeze-check loop passes (all f45a241-restored files still byte-identical).
- Browser validation, both shells where shared surfaces changed: add-player round-trip
  (create→configure→remove; DEVTST orphans deleted live), member gear self-edit as
  user 2, tome toggle, Leave Static (non-owner) + Delete retarget, rail nav, sign-out
  on /discover, mobile toggle both directions (mobile viewport), activity feed with
  loot rows, /nonexistent-url 404, assign-with-no-needers, TopBar order, initials
  centering. Screenshots embedded in the PR (mobile + light/dark where relevant).
- Internal release note; no version bump; releaseNotes entry references `pr:` + title.

## 6. ❓ Skim list (defaults adopted — veto anything here)

1. **Leave Static ships now** (Plan M §1; backend + store method already exist) with
   a lightweight ConfirmModal, `unlink_players=true` (no toggle), redirect to
   `/profile?tab=statics`. **Archive button removed outright** (no Coming-soon).
2. **BYDAY engine fix included** (not just picker seeding) — existing mismatched
   sessions change to match the backend/Discord truth; cross-shell by design.
3. **ScheduleIntegrationsPanel (legacy-shared) void fixes included** as a pure bugfix;
   **frozen-file** void bugs (SplitClearPlanner/Lodestone) deferred to their own
   bugfix-only slice.
4. **Tome-weapon interim is toggle-only** — no v2 have/augmented editing for the tome
   weapon until Phase C (legacy shell covers it meanwhile).
5. v2 More-page "Switch to classic UI" renders at **all viewports** (not mobile-only).
6. **PriorityRow folded into the centering fix** (same defect, +1 file beyond the
   user's named surfaces).
7. NotFound CTA goes to `/` unconditionally.
8. Add-player: open-seat configure is a **new inline v2 form** (AddPlayerModal stays
   create-only, unmodified); toolbar Add always opens the full modal (no raw
   blank-slot path anywhere).
