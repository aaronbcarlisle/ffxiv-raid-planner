# F6b — Home (weekly-loop dashboard) — Design Spec

> **Status:** approved in brainstorm 2026-06-30 · branch `redesign/f6b-home` off `redesign/foundation` (`15be433`) · PR → squash-merge into `redesign/foundation`. Implementation plan written separately (writing-plans) from this spec.
>
> **Authority docs:** `docs/PRODUCT_MODEL.md` (vision), `design/redesign/REDESIGN_SPEC.md` §4.2/§5.1/§7/§11 (IA + Home blueprint + re-home map), `design/redesign/DESIGN_SYSTEM.md` (atoms/contracts/§3 component style/§4.1 lexicon), `design/redesign/specs/f5-screen-components-map.md` (the Home element table + 27-entry catalog — this slice's build manifest), `design/redesign/FOUNDATION_ROADMAP.md` §2.1 (F6b row). The F6a spec/plan (`specs/2026-06-29-f6a-shell-design.md`, `plans/2026-06-29-f6a-shell.md`) is the template for how a slice is specced/executed.

---

## 1. Goal & scope

Build the **redesigned Home** — the weekly-loop dashboard that answers *"what's up with my static this week?"* in one glance and routes to the next action — and wire it in behind `?shell=v2` as the `overview` slot on `GroupViewContent`. F6b is the **first redesigned content slice** (F6a built the shell chrome around empty slots). It is also the slice that **resolves the pre-exposure must-do**: mounting the static-settings panel in the v2 shell.

**In scope (the full mocked Home — `mockups/01-static-home.html`):** page header ("This week" + dynamic subtitle); a 3-card **hero** (Next session + RSVP · This week's loot · Roster readiness); a two-region **dashboard** (left/actionable: Needs-your-attention list + BiS-by-role bars; right/ambient: Recent activity + a Track card); the settings-host mount.

**Out of scope (deferred, with explicit homes):** the per-track *detail view* (Ring 3 — the Track card is display-only here); the unified loot-logging UX (F6d — the "Log this week's loot" CTA *routes to* Loot); the redesigned Roster/Loot/Schedule tab bodies (F6c–F6e — those tabs still render their legacy bodies under v2); `?shell=v2` exposure to users (stays a flag).

**Non-negotiable constraints (carried from F6a):**
- **Legacy `/group/:shareCode` (no `?shell=v2`) stays byte-for-byte.** The slot mechanism guarantees this: the legacy path passes no slots, so `GroupViewContent` renders the legacy `StaticHomeTab` exactly as today. We do **not** modify `StaticHomeTab` or any shared legacy component.
- **No new `eslint-suppressions.json` entries** (F4 baseline = 17 files / 28 edges). Component placement (§4) is engineered to hold this.
- **No AI attribution** in commits/PRs (absolute).
- **Internal release note** (`{ internal: true }`), **no `CURRENT_VERSION` bump** (the shell is still flag-gated, no user-facing change).
- **Design system is law:** no raw color (tokens only), 12px readable floor (`text-xs`; 9px for badge counts only), shared interactions use the shared component. `pnpm check:design-system:strict` gates the PR; the new `components/ui/` components are held to the shared-layer **error**-level DS rules.

---

## 2. Locked decisions (from the 2026-06-30 brainstorm)

1. **Settings-host timing — fold into F6b** (its first task). Mount the existing `StaticSettingsHost` in `NewShell`; it's a reuse, not a modification.
2. **Slice scope — the full mocked Home, one slice** (≈14–16 SDD tasks), built shells-first. Split at the hero/dashboard seam only if it crosses ~16.
3. **Track card — display-only** (no click target). The per-track detail view is deferred (Ring 3, `REDESIGN_SPEC §11.7`); no stopgap navigation.
4. **Cross-screen shared components — build only the variants Home needs, but design the prop API for the F5-catalogued future variants** so F6c/d/e drop them in without breaking changes (YAGNI on implementation, forward-compatible on API).
5. **`REDESIGN_SPEC §11` Home-relevant items are settled:** #5 (Schedule stays a spine tab; Home carries only the next-session glance + inline RSVP); #7 (non-flagship tracks are Home cards, no nav entry). #4 (Loot tab label) and #8 (PR #154 policy) do not gate Home.

---

## 3. Architecture

### 3.1 The overview slot (the seam, unchanged from F6a)

`GroupViewContent.tsx:867` already chooses `slots?.overview ?? (<PageHeader/> + <StaticHomeTab/>)`. F6b makes `NewShell` pass a slot:

```tsx
// NewShell.tsx (v2 path only)
<GroupViewContent
  slots={{ overview: <Home group={currentGroup} tier={currentTier}
                          canManage={canManageRoster(userRole).allowed}
                          onNavigate={navigateTab} onOpenRequests={openRequests} /> }}
  actions={useGroupActions()}
/>
```

- **Legacy is untouched:** `GroupView.tsx` keeps calling `<GroupViewContent actions={useGroupActions()} />` with **no `slots`**, so the legacy overview renders `StaticHomeTab` byte-for-byte. Only `NewShell` (the `?shell=v2` chrome) injects `<Home/>`.
- The new `<Home/>` **replaces both** the legacy `PageHeader title="Overview"` and `StaticHomeTab` in v2 — Home renders its own "This week" page header.
- The other three tabs (`roster`/`gear`/`schedule`) still fall through to their legacy bodies in v2 (F6c–F6e replace them).

### 3.2 Settings-host mount (the pre-exposure fix, Task 1)

Today in v2 the `SettingsGear` and palette "Open Settings" toggle `settingsPanelStore`, but no host renders the panel (`GlobalSettingsPanel` returns `null` on `/group/*`; `StaticSettingsHost` is only mounted in legacy `GroupView`). Fix: render `StaticSettingsHost` in `NewShell`, inside the existing `<GroupActionModals>` provider.

- **Props:** `group` (`useStaticGroupStore`), `tierId` (`currentTier?.tierId`), `isAdmin` (`user?.isAdmin ?? false`), `onAddToRoster` (the existing `useGroupAddToRoster()` context hook), and `players` = a derived **`mainRosterPlayers`** memo (`configured && !isSubstitute`, sorted by the active preset — logic replicated from `GroupView.tsx:284–291`, not moved out of it).
- **No double-mount:** in v2 the legacy `GroupView` is not rendered; `GlobalSettingsPanel` already returns `null` on `/group/*`; `SettingsDockToggle` is already suppressed in v2 (F6a final fix). So the v2 host is the only one.
- **Reuse, not modify:** `StaticSettingsHost` and its subtree are unchanged — legacy keeps its own `ConnectedSettingsHost`. Byte-for-byte holds.
- **Boundary:** `StaticSettingsHost` lives in `components/settings/` (element `settings`); `NewShell` is `pages/` (no from-rule). The replicated `mainRosterPlayers` derivation imports `SORT_PRESETS`/`DEFAULT_SETTINGS`/`sortPlayersByRole` from `utils/` (not ring-typed). **No suppression.** Prefer extracting the derivation into `hooks/useSortedMainRosterPlayers.ts` so `GroupView` and `NewShell` share one copy (optional; only if it reads cleanly).

### 3.3 The `<Home/>` component & data access

`<Home/>` is a Ring-0 composition. It takes the legacy body's prop contract (`group`, `tier`, `canManage`, `onNavigate`, `onOpenRequests`) and reads the rest from stores directly (the loot summary needs `lootTrackingStore`, which the legacy body never received). `useGroupActions()` is already in scope under `NewShell`/`GroupActionModals` for actions like add-player. Home owns: its page header, the hero grid, and the `TwoRegionDashboard` assembly.

---

## 4. Component inventory & placement (boundary-safe)

The F4 element graph governs placement. Pattern recap (`eslint.config.js`): `shared` = `components/(primitives|ui)/**`; `ring0` = `components/(roster|player|bis|loot|priority|weapon-priority|history|wizard|team|static-group|group)/**`; `ring1` = `components/(schedule|split-clear)/**`; `ring3` = `components/(mount-farms|collections)/**`; `store`/`page` are file-mode. **Ring-0 must not import a ring1/ring3 *component*** (value or type). Stores are not ring-typed, and `ring0 → store` is allowed.

### 4.1 Shared — `components/ui/` (presentational, props-in / callbacks-out, **no store imports**)

These are shared *because* Home (ring0), Schedule (ring1), and Player Hub (person) all consume them — only the shared layer is importable across rings. They must be fully token-clean (the shared layer locks DS color/type/interaction rules at **error**).

| Component | Purpose | Consolidates (F5) |
|---|---|---|
| `CardShell` | `surface-card` + radius + optional uppercase section header (icon + title + right slot) + children | `ui/DashboardCard.tsx` + the bespoke `*Card` family |
| `ProgressBar` | configurable linear bar (color = accent \| role \| gear-source \| success \| warning) | inline bars in `PlayerCard`, `LightPartyHeader`, `StaticHomeTab` `WeeklyProgressModule` |
| `ProgressBarLegend` | once-per-screen gear-source legend (raid / tome-aug / augmented / needed) | `WeeklyProgressModule` legend + `PlayerCardGear` inline legend |
| `PlayerIdentity` | role-colored avatar + name + job/role/position identity unit | inline identity in `PlayerCardHeader` (`:237–419`); reuses `ui/SafeAvatar` + `ui/JobIcon` |
| `SessionRsvpCard` | session + RSVP roster + inline RSVP buttons | `schedule/SessionCard` + `ScheduleUpcomingPanel` + `StaticHomeTab` `NextRaidModule` |
| `EmptyStateInvite` | empty state that invites the next action | `ui/EmptyState` + `player/EmptySlotCard` + in-card `PlayerSetupBanner` + the `ScheduleTab` bespoke block |
| `AttentionRow` | one prioritized "needs you" action item (icon + title/tag + meta + action button) | `PlayerSetupBanner` + `MorePage` join-requests + `StaticHomeTab` `NotificationsModule` + `JoinRequestReviewModal` (the *trigger*) |
| `TwoRegionDashboard` | actionable-left (1.85fr) / ambient-right (1fr) layout; collapses ≤1180px | — (no layout wrapper exists; `.dash` is mockup-only CSS) |

### 4.2 Ring-0 — new `components/home/` (store-fed; composes the shared set)

| Component | Purpose | Reads |
|---|---|---|
| `Home` | the assembly: page header + hero grid + `TwoRegionDashboard` | stores + props |
| `WeeklyLootSummaryCard` | per-fight progress (cleared / drops this week) + one "Log this week's loot" CTA | `lootTrackingStore` + tier fights |
| `RosterReadinessCard` | avg iLvl · % BiS · raider count + single BiS-complete bar | `tierStore` players |
| `RoleBisCard` | BiS-by-role bars (one `ProgressBar` per role, role-colored) + `ProgressBarLegend` | `tierStore` players |
| `StaticActivityFeed` | recent loot/material/mount activity rows (privacy-filtered) | `mountFarmStore` + activity util |
| `TrackCard` | display-only non-flagship track summary (icon + name + Ring chip + bar) | `mountFarmStore` |

The "Needs your attention" card is `CardShell` wrapping a list of `AttentionRow`s, composed **inside `Home`** (no separate component). Adding `home` requires one line in the `boundaries/elements` ring0 pattern (`…|group|home`).

### 4.3 The boundary strategy (zero new suppressions)

1. **Home reads stores for data; never imports a ring1/ring3 component.** `TrackCard`/`StaticActivityFeed` read `mountFarmStore` (a `store`, allowed) — never `components/mount-farms/**` (ring3). `SessionRsvpCard` lives in `ui/` (shared) so both Home (ring0) and Schedule (ring1, F6e) import it without crossing a ring edge.
2. **Cross-ring shared things go in `ui/` as presentational.** Anything Home shares with Schedule/Player-Hub (`SessionRsvpCard`, `PlayerIdentity`, `TwoRegionDashboard`, `EmptyStateInvite`, `AttentionRow`) must be store-free shared components, fed by their ring-owning parent.
3. **The activity derivation moves to `utils/`** (e.g. `utils/staticActivity.ts`, from `StaticHomeTab.deriveActivityItems` `:160–305`) — `utils/` is not ring-typed, so any ring may import it; mount-farm *types* come from `types/`/the store file, never a ring3 component.
4. **`home` is classified, not suppressed.** Adding `home` to the ring0 pattern keeps it governed (it inherits the ring0 outward-import ban). This is the one config change; the PR body documents it as classification-not-suppression so review bots don't misread it.

---

## 5. Component contracts

Concise per-component contracts (anatomy · props · variants/states · a11y · notes). Final prop names may refine during the plan; the shapes here are the contract. All examples token-only.

### 5.1 `CardShell` (shared)
- **Anatomy:** rounded `surface-card` container, optional header row (`icon?` + uppercase `text-xs` tertiary `title` + `headerRight?` slot), `children` body.
- **Props:** `{ title?: string; icon?: ReactNode; headerRight?: ReactNode; children: ReactNode; className?: string; as?: 'section'|'div' }`.
- **States:** none (empty content is `EmptyStateInvite`'s job). **a11y:** header is a real heading when `title` set.

### 5.2 `ProgressBar` (shared)
- **Anatomy:** track (`surface-interactive`) + fill.
- **Props:** `{ value: number; /* 0..1 */ color?: 'accent'|'role-tank'|'role-healer'|'role-melee'|'role-ranged'|'role-caster'|'gear-raid'|'gear-tome'|'gear-augmented'|'success'|'warning'; ariaLabel?: string }`. Color maps to a semantic token; no raw color.
- **a11y:** `role="progressbar"` with `aria-valuenow/min/max` when `ariaLabel` given. **Future variant:** value-as-`current/max` convenience — not built now, API leaves room.

### 5.3 `ProgressBarLegend` (shared)
- **Props:** `{ items?: Array<{ label: string; token: string /* gear-source token */ }> }` (defaults to the 4 gear-source swatches: raid / tome-aug / augmented / needed). Board's 5th "priority" swatch is a future item entry — not built now.

### 5.4 `PlayerIdentity` (shared)
- **Anatomy:** role-colored avatar (reuse `SafeAvatar`/`JobIcon`) + name + optional job/role/position subtitle.
- **Props:** `{ name: string; job?: string; role?: Role; position?: string; subtitle?: ReactNode; avatarUrl?: string; variant?: 'inline' }`. F6b builds `'inline'` (avatar + name + meta) used in attention/activity rows. **Future variants** (`'board-cell'`, `'rsvp-row'`) are documented in the contract but not built (F6c/d/e).
- **a11y:** role conveyed by more than color (the job/role text label).

### 5.5 `SessionRsvpCard` (shared)
- **Anatomy:** `CardShell` + day/time (display font) + tz line ("8 PM EST → your time 5 PM") + countdown chip + role-colored RSVP avatar stack + "N in · M tentative" + RSVP button strip (I'm in / Tentative / Can't make it).
- **Props:** `{ session: Session; currentUserRsvp?: RsvpStatus; onRsvp?: (status: RsvpStatus) => void; variant?: 'next'|'later'; onManage?: () => void }`. F6b builds `'next'`; `'later'` (neutral border, ghost buttons) is API-reserved for F6e.
- **Behavior:** inline RSVP is a **real action** — Home wires `onRsvp` to `scheduleStore`'s RSVP mutation. Avatar stack derives from `session.rsvps` (role-colored by player role). Empty/no-session → Home renders `EmptyStateInvite` instead of this card.
- **a11y:** RSVP buttons are real `Button`s; the active RSVP is `aria-pressed`.

### 5.6 `EmptyStateInvite` (shared)
- **Props:** `{ icon?: ReactNode; title: string; description?: string; action?: { label: string; onClick: () => void; variant?: ButtonVariant } }`. Used for "no upcoming session" / "no activity yet". Action button per §4.1 lexicon (no trailing arrow).

### 5.7 `AttentionRow` (shared)
- **Anatomy:** leading status icon (warning/person/inbox) + grow region (`title` with optional inline `Tag`, `meta` line) + trailing action `Button`.
- **Props:** `{ icon: ReactNode; title: ReactNode; meta?: string; action: { label: string; onClick: () => void; variant?: ButtonVariant } }`. No trailing glyph on the action (§4.1).
- **Home's three kinds:** (a) no-BiS → "Import BiS" → `onNavigate('roster')` focused on that player; (b) unclaimed slot → "Assign" → `onNavigate('roster')` / assign flow; (c) join request → "Review" → `onOpenRequests()` (now live via the settings host). Ordering: BiS-blocking first, then unclaimed, then join requests.

### 5.8 `TwoRegionDashboard` (shared)
- **Props:** `{ main: ReactNode; side: ReactNode }`. Grid `minmax(0,1.85fr) minmax(0,1fr)`, gap 18px, collapses to one column ≤1180px. Pure layout, no store.

### 5.9 `WeeklyLootSummaryCard` (ring0 `home/`)
- **Anatomy:** `CardShell` ("This week's loot" + "N drops logged"); per-fight rows (fight label + `ProgressBar` + status text); full-width "Log this week's loot" `Button` (primary).
- **Data:** fights from the tier (`tier.fights` / gamedata raid-tier); per fight — `dropCount` = `lootLog` entries with `weekNumber === currentWeek` and that floor; `cleared` = an `'earned'` page-ledger entry exists for that floor in `currentWeek` (the same signal `useWeekSummary` uses for `floorsCleared`, aggregated static-wide). Implemented as a new `hooks/useWeeklyLootSummary.ts` (static-wide sibling of the per-player `useWeekSummary`) for testability.
- **Bar semantics (honest to the data):** cleared → full fill, `success` color, "cleared · N drops"; not cleared → neutral/empty fill, "in progress" (+ "N drops" if any). No fabricated percentage.
- **CTA:** "Log this week's loot" → `onNavigate('gear')` (Loot tab). The unified log UX is F6d; F6b routes, it does not re-wire the `LogWeekWizard`.

### 5.10 `RosterReadinessCard` (ring0 `home/`)
- **Anatomy:** `CardShell` ("Roster readiness"); stat strip (avg iLvl / % BiS / raider count, with dividers); single BiS-complete `ProgressBar`; footer "K / M BiS slots obtained · N members need setup".
- **Data:** reuse `rosterAvgIlv` + the BiS-count derivation from `StaticHomeTab` (promote both to `utils/` so Home and the legacy tab can share — legacy import path preserved). "needs setup" = unconfigured / no-BiS players.

### 5.11 `RoleBisCard` (ring0 `home/`)
- **Anatomy:** `CardShell` ("BiS progress by role" + "to current tier"); one labeled `ProgressBar` per role (Tanks/Healers/Melee/Ranged/Caster), role-colored, with `X/Y` count; `ProgressBarLegend` (gear-source) once at the bottom.
- **Data:** **new per-role aggregation** over `tier.players` — per role, sum obtained BiS slots / total BiS slots (using each player's `gear` with `bisSource` set and `hasItem`). Computed in a `useMemo`/small util; testable in isolation.

### 5.12 `StaticActivityFeed` (ring0 `home/`)
- **Anatomy:** `CardShell` ("Recent activity" + "this week"); rows = source badge (`JobIcon` / role dot / material dot) + text ("**Body** → Tank One · M12S") + relative timestamp.
- **Data:** `utils/staticActivity.ts` (moved from `StaticHomeTab.deriveActivityItems`), reading `mountFarmStore` + (optionally) loot/material logs; **preserve the privacy model verbatim** (manual = named, plugin = anonymized "A member…", system = aggregate; visibility filter to static/public; honor `user.activityDisplayMode`). Empty → `EmptyStateInvite` ("No activity yet this week").

### 5.13 `TrackCard` (ring0 `home/`)
- **Anatomy:** `CardShell`/row — track icon (membership-linked tint) + name + Ring chip ("Ring 3") + "K of N have it · same Progress Engine, no loot priority" + `ProgressBar` (membership-linked fill). **Display-only** (not clickable).
- **Data:** `mountFarmStore` (mount-farm track summary). Renders nothing if no non-flagship track exists.

### 5.14 `Home` (ring0 `home/`)
- **Anatomy:** page header (`PageHeader` reuse — "This week" + dynamic subtitle: next-session day/time · floors-left · loot-logged-through); hero `grid` (`SessionRsvpCard` 'next' | `WeeklyLootSummaryCard` | `RosterReadinessCard`); `TwoRegionDashboard` — `main` = attention `CardShell`(`AttentionRow[]`) + `RoleBisCard`; `side` = `StaticActivityFeed` + `TrackCard`.
- **Props:** `{ group: StaticGroup; tier: TierSnapshot | null; canManage: boolean; onNavigate: (tab: PageMode, extra?) => void; onOpenRequests: () => void }`. Reads `scheduleStore`, `lootTrackingStore`, `tierStore`, `joinRequestStore`, `mountFarmStore`, `authStore` as needed (mirrors what `StaticHomeTab` already fetches; reuse the same fetch-on-mount effect set, gated by membership/permission as today).
- **Permissions:** `canManage` gates the join-request `AttentionRow` action and any manage-only affordance; non-managers see the read-only readiness/activity.

---

## 6. Data flow, derivations & the re-home ledger

**New derivations (no precursor):**
- `useWeeklyLootSummary` (static-wide per-fight cleared + drop counts for `currentWeek`) — built from `lootTrackingStore` + tier fights, mirroring `useWeekSummary`'s `'earned'`-entry cleared logic.
- per-role BiS aggregation (`RoleBisCard`) over `tier.players` gear.

**Promoted to `utils/` (shared by new Home + legacy tab):** `rosterAvgIlv`, `playerGearReadiness`/BiS-count helper, and `deriveActivityItems` → `utils/staticActivity.ts`. (Promotion keeps the legacy `StaticHomeTab` working via the new import path — a pure move, no behavior change; legacy stays byte-for-byte in *render*, its imports just repoint. If repointing legacy is deemed a legacy-touch risk, copy into `utils/` and leave the legacy local copy — decide in the plan; default is promote-and-repoint since it's a non-visual refactor.)

**Re-home ledger (dropped from Home → still reachable):**

| Current `StaticHomeTab` module | F6b disposition |
|---|---|
| `NextRaidModule` | → `SessionRsvpCard` (hero) |
| `WeeklyProgressModule` (overall + per-player dots) | → `RosterReadinessCard` (hero) + `RoleBisCard` (dashboard) |
| `GroupHeroPanel` stat strip | → `RosterReadinessCard` |
| `NotificationsModule` + `PlayerSetupBanner` + join requests | → attention list (`AttentionRow`) |
| `RecentActivityModule` / `deriveActivityItems` | → `StaticActivityFeed` |
| `BestNextFarmModule` / mount-farm summary | → `TrackCard` |
| `CommandBriefModule` (parchment dossier) | dropped from Home → the join-request `AttentionRow` + Settings ▸ Recruitment ▸ Requests |
| `GoalsFarmsModule` (Objectives / Farms / Suggestions tri-pane) | → **Settings ▸ Goals & Farms** (now mountable in v2 via the settings-host) |
| `SplitClearReadinessCard` | → Roster **Board** (F6c) |
| `RosterPresenceModule` | folded into readiness / Roster |

No capability is lost in v2: settings-hosted surfaces (Goals & Farms, Recruitment) are reachable via the gear/palette now that Task 1 mounts the host; gear/board content arrives in F6c.

---

## 7. Tokens

Expectation: **no new tokens** beyond F6a's `nav.*`/`surface.nav`/`motion`. The Home uses existing semantic tokens — `surface-card`/`border-subtle` (CardShell), role colors (`role-*`), gear-source (`gear-raid`/`gear-tome`/`gear-augmented`), `status-success`/`status-warning`, `membership-linked` (Track card), `accent`. The plan's first step confirms via `pnpm tokens:check` that no card needs a new token; if a genuinely new component-tier token surfaces (unlikely), it's added data-driven (`tokens.json` + `tokens.light.json` + the `ID_TO_CSS_VAR` map + regenerate) per the F1 pipeline, never as raw color.

---

## 8. Testing & conformance

- **Per-component Vitest** for every new component: shared `ui/` components — render + each built variant + props + a11y (roles/labels); `ProgressBar` color→token mapping; `AttentionRow` action fires; `SessionRsvpCard` `onRsvp` fires + active state. Ring0 `home/` components — render from mocked stores; `useWeeklyLootSummary` + the per-role aggregation tested as pure functions against fixture data (cleared/not-cleared, drop counts, mixed roles).
- **`Home` assembly test:** renders the hero + dashboard from mocked stores; the attention list orders correctly; empty states swap in (`EmptyStateInvite`) when no session/activity.
- **Slot/legacy guard:** with `slots={{ overview: <Home/> }}` the overview renders `<Home/>`; without slots (legacy path) it still renders `StaticHomeTab` — a regression lock that legacy is untouched.
- **Settings-host test:** in v2, `SettingsGear`/palette "Open Settings" → `StaticSettingsHost` renders the panel; legacy path unaffected.
- **Gate (CI-equivalent, all green on land):** `pnpm build` (`tsc -b && vite build`) → `pnpm lint` (0 error) → `pnpm check:design-system:strict` → `pnpm test` → `pnpm tokens:check`; `git diff --check`. **`eslint-suppressions.json` unchanged.** Dev-server check: legacy `/group/DEVTST` Home identical; `/group/DEVTST?shell=v2` renders the new Home; settings reachable in v2.
- **Reviewer:** `subagent_type: redesign-reviewer` (effort:xhigh) per task **and** the final whole-branch review. Implementers on sonnet; opus for the riskiest store-aggregation/assembly tasks (`useWeeklyLootSummary`, per-role aggregation, `Home` assembly).

---

## 9. Risks & spec-time confirmations

- **`SessionRsvpCard` RSVP write:** confirm the `scheduleStore` RSVP mutation signature during the plan; if RSVP-from-Home has any side effect the legacy path lacks, keep it behaviorally identical to `SessionCard`.
- **Activity-util promotion vs legacy-touch:** promoting `deriveActivityItems` to `utils/` repoints a legacy import. It's a non-visual move, but the plan must verify the legacy render is byte-for-byte after repointing (or fall back to copy-not-move). Flag for the reviewer.
- **Shared-component API churn:** F6c/d/e add `PlayerIdentity`/`SessionRsvpCard`/`ProgressBar` variants. Mitigated by designing the documented future variants into the prop API now (decision 4) — but the contracts here are the commitment; later slices extend, never break.
- **`home` element-pattern change** will draw bot/reviewer attention — documented in the PR body as classification (keeps `home/` governed as ring0), explicitly **not** a suppression.
- **Hero is 3 cards above a 2-region grid** (not a single TwoRegionDashboard) — the F5 map's "Two-region layout" row is the *dashboard* region; the hero is a separate 3-col `grid` above it. The plan must build both (hero grid + `TwoRegionDashboard`), matching the mockup.

---

## 10. Self-review

- **Placeholders:** none — every component has a contract; the loot-summary and per-role aggregations are grounded in real store data (`useWeekSummary`/`lootTrackingStore`); no "TBD".
- **Internal consistency:** placement (§4) ↔ boundary strategy (§4.3) ↔ contracts (§5) agree; the shared/ring0 split is the same in every section; the re-home ledger (§6) matches the dropped-modules list in §1/§2.
- **Scope:** one slice, one screen, one PR; deferrals (track detail, log UX, other tabs) have explicit homes. Sized ~14–16 tasks with a named split point.
- **Ambiguity:** the "in progress" bar is defined as no-fabricated-percentage (cleared=full/success, else neutral + text); the Track card is unambiguously display-only; the CTA routes to Loot (not the wizard). The one deliberately deferred-to-plan call (promote-vs-copy the activity util) is named with a default (promote-and-repoint).
