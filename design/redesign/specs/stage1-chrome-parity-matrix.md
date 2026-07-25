# Stage-1 Chrome Affordance-Parity Matrix (D5 gate)

**Status: SIGNED OFF 2026-07-25 — user approved all seven OPEN items (M1–M4, G1, G2, G4) as recommended ("approve all"). Gate D5 of `V2_COVERAGE_PLAN.md` §6 is SATISFIED. This matrix is now the binding chrome contract for Stage-1 implementation, which remains gated on Phase G (PR #161) per D1. Director-verified draft v2 (completeness sweep found 5 missing rows + 4 accuracy errors; all folded in before sign-off).**

Scope: what happens to every **chrome-level** affordance on non-group routes when a v2-opted user gets V2 chrome (AppRail + slim TopBar) instead of the legacy `Header`. Page **bodies** render unchanged (body-level parity by construction). Legacy/no-param users are untouched on every row.

Legend: **KEPT** = same affordance, same place-or-equivalent · **RE-HOMED** = same capability, new location · **DROPPED** = capability intentionally removed (justification required) · **OPEN (M#/G#)** = needs user ruling at sign-off (§9).

---

## 1. New v2 chrome surfaces Stage 1 introduces (the mapping targets)

| Surface | Where | Contents (proposed) |
|---|---|---|
| **AppRail** (exists; extended app-wide) | desktop ≥sm, every v2-chromed route | Logo (becomes a link — M1, with a matching accessible name), Player Hub entry (real `isActive`), Static Finder entry (real `isActive`), static avatars, footer `UserMenu variant="rail"` |
| **Slim TopBar** (new) | desktop ≥sm, non-group v2 routes | Page identity (left) · right cluster: Discord link, GitHub link, ThemeToggle, NotificationBell, SettingsGear (G1), **LoginButton when logged out** (auth branch gated on `useAuthHydrated` + `isLoading`, `Header.tsx:51-55` semantics — H13) |
| **v2 mobile top bar** (new) | <sm, non-group v2 routes (rail is `hidden sm:flex`) | Logo/home · NotificationBell · account-settings gear (opens `GlobalSettingsPanel`) · UserMenu avatar / LoginButton (guest, same hydration gate). Theme stays in the user menu (mirrors legacy mobile). |
| Group TopBar + Spine | `/group/*` (unchanged) | No Stage-1 changes beyond hoisting into the single chrome host |

Structural guarantees carried from the plan: `#main-content` on every v2-chromed route (SkipLink target); chrome outside `PageTransition`; the v2 Layout branch still mounts `ViewAsBanner`, `SettingsPanelController`, `GlobalSettingsPanel`, `KeyboardShortcutsHelp` (and disposes `SettingsDockToggle` per G1); NotificationCenter deduped to a single mount.

**Host contract (from H4):** the chrome host applies `buildStaticNavHref` itself and passes `currentParams` **only when already on `/group/*`** (`ContextSwitcher.tsx:114-116` semantics). Copying pre-hoist `NewShell.tsx:343`'s unconditional pass would leak foreign params — e.g. a rail avatar clicked from `/profile?tab=jobs-gear` navigating to `/group/CODE?tab=jobs-gear`.

**Z-order (one line so it isn't discovered as three bugs):** legacy `Header` and v2 `TopBar` both `sticky top-0 z-40`; must coexist with AdminSidebar drawer `z-40`/FAB `z-50`, docs NavSidebar overlay+panel `z-50`, `ProfileBottomNav` `z-[50]`/More sheet `z-[55]`, `SettingsDockToggle` `z-40`. The v2 mobile top bar must slot into this stack without occluding the FABs/sheets.

**⌘K off-group: out of scope for Stage 1.** The palette is v2-group-only (`NewShell.tsx:298-307`, `TopBar.tsx:134-142`); off-group it simply doesn't exist yet. No V1 parity loss (legacy has none); app-wide ⌘K is Stage 6 / B1.

---

## 2. Legacy `Header` (`Header.tsx`) — the surface being replaced on non-group routes

Group-only affordances (tier selector/kebab `:250`, Invite `:274`, TipsCarousel `:313`, TryNewUiBanner desktop `:321` + mobile `:442`, mobile StaticSwitcher row `:421`) are all `isGroupRoute && currentGroup`-gated — verified N/A on non-group routes.

| # | Affordance (source) | Visibility today | Disposition | Destination / notes |
|---|---|---|---|---|
| H1 | Logo → `/` (`Header.tsx:218`, tooltip "Return to home page" `:210-215`) | always | **RE-HOMED + OPEN (M1)** | AppRail logo becomes a link. Proposal: authed → `/profile`, guest → `/`. **Consequences owned:** (1) the logo's accessible name must change to match its target — today's v2 rail logo is a bare `<img>` (`NewShell.tsx:353`); (2) `/` becomes chrome-unreachable for authed v2 users (typing the URL, the 404 CTA, or logout) — dropping `/`'s share-code lookup ("view a public static by share code", `Home.tsx:200-217`) and recent-statics tiles from chrome reach; justification: authed users' statics live in the rail, share-code viewing is a guest/onboarding flow; restoration path = a "Home page" item in the v2 UserMenu if missed; (3) stated D6 assumption: the Person-layer landing is **not** `/` (consistent with the ratified `/`-exclusion; reversible). |
| H2 | ContextSwitcher · Player Hub segment → `/profile` (`ContextSwitcher.tsx:159`) | authed, desktop | **KEPT** | AppRail Player Hub entry (gains real `isActive`) |
| H3 | ContextSwitcher · Static Finder segment → `/discover` (`ContextSwitcher.tsx:169`) | authed, desktop | **KEPT** | AppRail Static Finder entry (gains real `isActive`) |
| H4 | ContextSwitcher · Static segment (`ContextSwitcher.tsx:178-243`: name link `:182-195` → `/group/{code}`, ▾ dropdown `:198-242`) | authed, desktop | **KEPT** | AppRail static avatars, navigation via `buildStaticNavHref` under the §1 host contract |
| H4b | Static segment: selected static **name + membership role badge** in-surface (`ContextSwitcher.tsx:188-194`, dropdown badges `:221-225`) | authed, desktop | **DROPPED off-group + OPEN (G4)** | AppRail avatars carry initials + tooltip label only — no in-surface name/role. Justification: "which static / what am I there" is fully answered in-static (StaticPicker, `StaticPicker.tsx:118-125`) and on Profile → My Statics; restoration path = StaticPicker in the slim TopBar if missed. |
| H5 | ContextSwitcher dropdown · per-static Schedule shortcut → `/group/{code}?tab=schedule` (`ContextSwitcher.tsx:229`) | authed, desktop | **DROPPED + OPEN (M3)** | Reachable via rail avatar → Spine Schedule (2 clicks). Qualifier: tab memory returns you to Schedule **only when** `tabPersistence !== 'reset'` (`navPreferences.ts:87-93`); reset-preference users always pay the 2 clicks, and there is no off-group ⌘K fast path yet. Restoration path = rail-avatar context menu (Ring-1 polish). |
| H6 | ContextSwitcher dropdown · "Go to My Statics" → `/profile?tab=statics` (`ContextSwitcher.tsx:237`) | authed, desktop | **KEPT** | v2 `UserMenu` My Statics item, Shift+S (`UserMenu.tsx:141-151`, verified present in the rail variant); also the Profile sidebar entry once on `/profile` |
| H7 | Mobile settings gear (`Header.tsx:331-367`) → account settings; **pending-join-request badge** (`:359-363`) | authed, <sm | gear **KEPT**; badge **DROPPED off-group** | Gear → v2 mobile top bar → same `GlobalSettingsPanel`. Badge: the fetch is group-gated (`:113-118`) but `pendingCount` is global store state that is **never reset** (`joinRequestStore.ts:27-101`), so legacy shows a **stale-but-visible** badge off-group — and its tap promise (`tab: 'recruitment'`) can't be fulfilled there anyway (`GlobalSettingsPanel` is account-only, `GlobalSettingsPanel.tsx:25-29`). Dropping the off-group badge removes a stale, unfulfillable affordance; the badge continues to work in-static (v2 group chrome). |
| H8 | Discord link (external, `Header.tsx:372`; **no `sm:` gate — renders on legacy mobile**) | always (non-`/`) | **KEPT (desktop) + OPEN (M2) (mobile)** | Desktop: slim TopBar right cluster. Mobile: recommend **RE-HOMED** to the v2 UserMenu (two `DropdownItem`s; the mobile top bar reaches it via the avatar) — a bare "accept desktop-only" would be an unjustified drop. |
| H9 | GitHub link (external, `Header.tsx:383`) | always (non-`/`) | **KEPT (desktop) + OPEN (M2) (mobile)** | Same as H8 |
| H10 | ThemeToggle (desktop `Header.tsx:394-397`; mobile lives in UserMenu) | always (non-`/`) | **KEPT** | Slim TopBar (desktop); UserMenu (mobile) — identical split to legacy |
| H11 | UserMenu (desktop `Header.tsx:408-413`; on `/profile` mobile-only via `hasOwnRailUserMenu` `:70`) | authed | **KEPT** | AppRail footer (desktop) / v2 mobile top bar avatar (<sm) |
| H12 | **LoginButton** (guest, `Header.tsx:417`) | logged-out, every non-`/` route | **KEPT** | Slim TopBar + v2 mobile top bar guest branch. Guests *can* be v2-resolved — `useResolvedShell` has no user check (`shellPreference.ts:91-101`). Mandatory row. |
| H13 | Auth-loading skeleton (`Header.tsx:407-408`) | pre-hydration | **KEPT** | The v2 auth slot must gate on `!useAuthHydrated() \|\| isLoading` exactly as `Header.tsx:51-55` does — `UserMenu` returning null for falsy `user` is not sufficient and would flash `LoginButton` for a frame on every cold load. |
| H14 | **v2→legacy escape** ("Switch to classic UI", `UserMenu.tsx:324` — currently `isGroupRoute`-gated) | v2 users, group routes only today | **KEPT (extended) + OPEN (G2)** | Without extension, Stage 1 traps v2 users off-group (rail → Player Hub → no in-chrome way back to legacy). Must render on **every route rendered inside v2 chrome**, keyed on a chrome-context signal (prop/context from the host), **not** on `resolvedShell` alone — a naive `resolvedShell === 'v2'` check would leak the item into the legacy Header's UserMenu on `/` (excluded route). v2-side change only; V1 menu untouched (D2 remains deferred). |
| H15 | **Desktop account-settings access: `SettingsDockToggle`** (`Layout.tsx:137`, renders on every legacy-branch route; the Header gear is mobile-only) | authed, desktop | **RE-HOMED + OPEN (G1)** | Recommend: slim TopBar gets a `SettingsGear` (the v2 group pattern, `TopBar.tsx:157`) and `SettingsDockToggle` is shell-suppressed on non-group v2 (extending the existing `!isGroupV2Shell` gate). Alternative (KEPT unchanged) works only by the coincidence that its `top: var(--header-height)` = 56px equals the v2 TopBar's `h-14` (`SettingsDockToggle.tsx:36-41`, `tokens.generated.css:94`, `TopBar.tsx:113`) — fragile, and two chrome idioms on one screen. Legacy rendering untouched either way. |

Guest rail: guests see logo + Static Finder only (Player Hub requires auth — `Profile.tsx` redirects unauthed; legacy ContextSwitcher is `user &&`-gated too, so guest-v2 ≥ guest-V1). No static avatars.

**Authed-with-zero-statics (G5, cosmetic row):** legacy shows a non-interactive "No static" placeholder (`ContextSwitcher.tsx:244-249`). The v2 rail would show Player Hub + Static Finder + a dangling divider (`NewShell.tsx:329` renders it unconditionally) — suppress the divider when the statics list is empty. No capability at stake, but this is every brand-new user's first screen; the missing static-creation entry in v2 chrome is already tracked in the plan (§1.3) and lands with Stage 3's My Statics absorption.

---

## 3. `/profile` (Player Hub) — extra chrome beyond the Header

| # | Affordance (source) | Disposition | Destination / note |
|---|---|---|---|
| P1 | `ProfileSidebarNav` — 7 entries: Overview, Sync & Gear, Jobs & Gear, Tracking, Availability, Share, **My Statics** (`Profile.tsx:57-63`, `?tab=` deep-linkable) | **KEPT (all 7)** | Renders unchanged inside v2 chrome. Accepted temporary double-rail (AppRail 72px + Profile sidebar 208/56px), resolved at Stage 3 — ratified plan Stage-1 req 3. |
| P2 | Sidebar identity header (character name) + keyboard shortcuts (`` ` ``,1–6) | **KEPT** | Unchanged |
| P3 | Sidebar collapse + persistence (`profile-sidebar-collapsed`) | **KEPT** | Unchanged |
| P4 | Sidebar footer `UserMenu` (`Profile.tsx:87` — the footer contains nothing else) | **RE-HOMED + OPEN (M4)** | AppRail footer carries the identical menu; shell-gate the Profile-rail footer off under v2 chrome to avoid double UserMenu + double NotificationCenter. Cosmetic delta to own: the AppRail footer menu is hardcoded `collapsed` (`NewShell.tsx:355`), so the expanded footer's display name (`UserMenu.tsx:113-117`) is not shown. **Legacy-file seam:** this edit lands in `Profile.tsx` — requires the sanctioned-edit justification per plan §5.4 and a gate condition provably false on every legacy render path. |
| P5 | `ProfileBottomNav` (mobile): 4 primary + 2 "More" tabs + "My Static ← Back" link (`ProfileBottomNav.tsx:24-36,65-76`) | **KEPT** | Unchanged in Stage 1 (pre-existing gap: no My Statics entry — legacy-inherited, resolved at Stage 3, not a Stage-1 regression). |

## 4. `/profile/:shareCode` (PublicProfile), `/discover`, `/dashboard`

No chrome of their own (verified: Discover has none; Dashboard is a 37-line auth gate + `MyStaticsPanel`; PublicProfile's only control is a body-level back button) — §2 rows cover them fully. PublicProfile is a public share target, so the guest branch (H12) is load-bearing there. `/dashboard` is effectively unlinked from the primary IA (two inbound edges remain: the backend notification href — D3 removes it — and `AdminLayout.tsx:24`'s non-admin bounce); chrome applies meanwhile, absorbed at Stage 3.

## 5. `/admin/*`

| # | Affordance | Disposition | Note |
|---|---|---|---|
| A1 | `AdminSidebar` — Overview / Statics / Usage Analytics / Error Log + unreviewed-errors badge (`AdminSidebar.tsx:22-27,78-82`) | **KEPT** | Content-level; renders unchanged inside v2 chrome |
| A2 | AdminSidebar mobile FAB toggle + overlay (`:93-107`) | **KEPT** | Unchanged; §1 z-order line applies |
| A3 | AdminLayout sizing (`min-h-[calc(100vh-4rem)]`, nested `<main>`, `AdminLayout.tsx:43-45`) | fitting work | Shell-gated adjustment for the v2 top bar height (plan Stage-1 req 8). **Legacy-file seam:** same sanctioned-edit + provably-inert-on-legacy requirement as P4. |

## 6. `/docs/*` and the 404

Docs `NavSidebar` is an **in-page section scroller** (`NavSidebar.tsx:67-71`) — content, not chrome: **KEPT unchanged**, including its mobile FAB + slide-out (§1 z-order line applies). The UserMenu docs links stay full-reload `<a href>` in Stage 1 (ratified — the reload lands back in v2 chrome).

**`*` catch-all (G3):** `NotFound` mounts inside Layout precisely so chrome wraps it (`App.tsx:191-196`); its only affordance is "Back to Home" → `/` (`NotFound.tsx:28`). Disposition: **v2-chromed like Docs** (recommended) — chrome-less it's a dead end, legacy-chromed it's an unannounced shell flip.

## 7. Keyboard shortcuts (behavior note)

Shift+S (`/profile?tab=statics`) and Ctrl/Cmd+Shift+S (`/admin/statics`) keep working and now land v2-chromed — bindings live in `useGlobalKeyboardShortcuts` mounted by Layout (`Layout.tsx:51-55`), independent of the Header. `KeyboardShortcutsHelp` still mounts (plan Stage-1 req 5).

## 8. Verified non-rows

`ViewAsBanner` self-contains both its affordances and is mounted by Layout above `<main>` — Header replacement cannot orphan it. Toasts + TooltipProvider live outside Layout (`App.tsx:153,205`). `TryNewUiBanner` is group-gated in both its mounts — no non-group row. `/` exclusion is coherent: the legacy Header self-strips everything but logo + auth there, and `SettingsDockToggle` returns null on `/`.

---

## 9. Rulings — all approved as recommended (user, 2026-07-25: "approve all")

| # | Question | Ruling |
|---|---|---|
| M1 | Rail logo target + the `/` consequences (H1) | ✅ **Authed → `/profile`, guest → `/`**, with the accessible-name change, the share-code-lookup drop owned as stated, and the "Person landing ≠ `/`" assumption recorded |
| M2 | Discord/GitHub on mobile v2 (H8/H9) | ✅ **RE-HOMED into the v2 UserMenu** (two items; no drop) |
| M3 | Drop the ContextSwitcher per-static Schedule shortcut (H5) | ✅ **Dropped**, with the `tabPersistence: 'reset'` qualifier recorded |
| M4 | Suppress Profile-rail footer UserMenu under v2 chrome only (P4) | ✅ **Approved**, with the sanctioned-edit seam requirement |
| G1 | Desktop account settings off-group (H15) | ✅ **RE-HOMED to a slim-TopBar SettingsGear**; `SettingsDockToggle` suppressed on non-group v2 |
| G2 | v2→legacy escape off-group (H14) | ✅ **"Switch to classic UI" extends to all v2-chromed routes**, keyed on chrome context (not route, not bare `resolvedShell`) |
| G4 | Static name + role badge off-group (H4b) | ✅ **Dropped off-group** (in-static StaticPicker + Profile My Statics cover it; restoration = StaticPicker in slim TopBar) |

Also folded (no ruling needed): H7 badge drop w/ stale-store evidence, H13 hydration gate, H4 host contract, G3 404 chroming, G5 divider fix, z-order line, ⌘K out-of-scope note, `/dashboard` wording, P4/A3 seam requirements.

**D5 is satisfied.** Stage-1 implementation waits only on Phase G (PR #161) per D1; when it starts, this matrix is the acceptance contract — every row above is a checklist item for the Stage-1 change review.
