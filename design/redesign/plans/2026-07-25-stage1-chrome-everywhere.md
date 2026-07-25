# Stage 1 Implementation Plan — V2 App Chrome on Every Route (B8)

**Date:** 2026-07-25 · **Branch base:** `main` (931de82, contains dual-shell + D7 launch gate + Stage 0) · **Acceptance contract:** `design/redesign/specs/stage1-chrome-parity-matrix.md` (every row H1–H15, P1–P5, A1–A3, G3/G5, §1 host contract + z-order + structural guarantees) plus `V2_COVERAGE_PLAN.md` Stage-1 requirements 1–12 and rulings D1–D7 / M1–M4 / G1–G2 / G4–G5.

**Status: REVISED 2026-07-25 — director plan vet returned DRIFT with RC1–RC8; all folded in below (portals replace element-slots; RC1 was blocking: element-passing slots resolve context at host position, so TopBar→TierBreadcrumb→useGroupActions would throw and the app ErrorBoundary would swallow the whole v2 group route, invisible to the existing suites which mock that path). Ready for implementation.**

## 0. Baseline facts the plan builds on (verified in code)

- `Layout.tsx:26` suppresses `Header`/`SettingsDockToggle` only for `isGroupV2Shell = pathname.startsWith('/group/') && resolvedShell === 'v2'`; NewShell renders **inside** Layout's padded `<main>` → the v2 rail currently sits inside `PageTransition` and inside Layout's `pt-1 pb-3` padding.
- `NewShell.tsx` owns AppRail (logo is a bare `<img>`, `NewShell.tsx:353`), group TopBar, Spine, `#main-content`, CommandPalette + mod-K, a NotificationCenter mount (line 365 — duplicated by `UserMenu.tsx:342`), and passes `currentParams` to `buildStaticNavHref` **unconditionally** (`NewShell.tsx:343`) — safe only because NewShell mounts solely on `/group/*` today.
- `UserMenu.tsx:309` gates "Switch to classic UI" on `isGroupRoute && resolvedShell === 'v2'` — the exact gate G2 replaces (a bare `resolvedShell` check would leak the item into the legacy Header's UserMenu on `/`, which renders Header for v2-resolved users).
- `CommandPalette` and `useGroupViewState` call `useParams`/route-scoped hooks — they **cannot be hoisted** above the route element (Layout's route context has no `:shareCode`). `TopBar` and `Spine` need only stores/`useSearchParams`/props — they **can** render at Layout level if their props are supplied by NewShell. This drives the slots mechanism below.
- Boundary rules (`frontend/eslint.config.js:117-121`): `shell` (components/layout|dnd|docs) must not import `person` (components/profile|auth|dashboard) — so anything mounting `UserMenu`/`LoginButton` must live in `src/pages/**` (exempt). Precedent already exists in the required direction: `TopBar.tsx:29` (shell) imports `pages/TierBreadcrumb`. Layout (shell) importing a pages-hosted chrome component is boundary-legal and precedented.
- `TryNewUiBanner` is already admin-gated on main (D7 launch gate, `TryNewUiBanner.tsx:35`). `redesign/v2-nav-entry` is **unmerged**, based on `835e24a` (pre-Stage-0), and touches `UserMenu.tsx`, `shellPreference.ts`, `useShellToggle.ts`, `Layout.tsx` — all files Stage 1 also touches. Its S1 item does **not** yet carry the D7 admin gate. Its five docs commits duplicate content already on main.
- e2e: `smoke.spec.ts:677-678` (Lodestone flow) does `goto('/profile')` with **no shell pin** — after Stage 1 the chrome it gets depends on the dev owner's account-mirrored `ui_shell` (the Phase-R contamination vector). `e2e/helpers/auth.ts` pins `?shell=v2` / `?shell=legacy` for group navigation only.

## 1. The v2-nav-entry branch — relationship and recommended order

**Recommendation: land it first, as PR-0, before any Stage-1 code.** Rationale:

1. **File collision.** S1/S2 edit `UserMenu.tsx`, `shellPreference.ts`, `Layout.tsx` — the three most-touched Stage-1 files. Rebasing an 8-commit branch over a finished Stage 1 is strictly harder than the reverse.
2. **S2 is load-bearing for Stage-1 validation.** Without session-sticky `?shell=`, a guest/incognito tester of "chrome everywhere" drops back to legacy on the first param-less navigation — exactly the flow Stage-1 live validation must exercise. With S2, one `?shell=v2` entry makes the whole tab v2, which is also the cleanest per-suite e2e shell-pin mechanism (see §6).
3. **Resolver stability.** Stage 1's Layout branch keys on `useResolvedShell()`; S2 changes that resolver's internals (adds the sessionOverride tier). Landing S2 first means Stage-1 characterization tests pin the *final* resolver, not an intermediate.

**PR-0 contents:** rebase `redesign/v2-nav-entry` onto `main`. Director verified the actual conflict surface: main has NOT touched any of the branch's code files since merge-base `835e24a`; three of the five docs commits are byte-identical on main (rebase to nothing); only real conflicts are `releaseNotes.ts` (main 69 lines ahead) and `RECONCILIATION.md` (5 lines). Keep the branch's release-note entry `internal: true`, no `CURRENT_VERSION` bump. Add the **D7 admin gate to S1's "Try the new UI" item** (`user?.isAdmin` alongside `isGroupRoute && resolvedShell === 'legacy'`, mirroring `TryNewUiBanner.tsx:35`, with a matching test row); keep S2's `useShellParamPersistence` mounted once in Layout **above** the branch point Stage 1 later introduces. S1's group-route gate stays (extending the legacy-side entry off-group is D2, deferred).

## 2. Chrome-host architecture

### New files (all v2-owned)

| File | Role |
|---|---|
| `frontend/src/lib/chromeContext.tsx` | **The G2 chrome-context signal.** `V2ChromeContext = createContext(false)` + `useInV2Chrome()`. Lives in `lib/` (boundary-unrestricted; consumed by `person` UserMenu, `page` Profile/AdminLayout, and the host — same placement logic as `shellPreference.ts`). The provider is mounted **only** by `AppChrome`, which is mounted **only** by Layout's v2 branch → structurally unreachable (provably false) on every legacy render path and on `/`. |
| `frontend/src/pages/chrome/AppChrome.tsx` | **The single chrome host** (pages = boundary-exempt, per the director ruling). Renders: `V2ChromeContext.Provider` → flex row: `AppRail` (app-wide entries, logo-link, `UserMenu variant="rail" collapsed` footer gated on `user`) + column: `{topBar slot ?? <NonGroupTopBar/>}` + `{spine slot}` + `<main id="main-content" className="min-h-0 flex-1 overflow-y-auto …">{children}</main>`. Also owns: the authed-gated `fetchGroups()` cold-fetch (moved from NewShell — guest 401 guard preserved verbatim, see `NewShell.tsx:226-236` comment), rail-entry construction with **real `isActive`** (`pathname === '/profile'` for Player Hub, `'/discover'` for Static Finder, `matchPath('/group/:shareCode')` for avatars), the **§1 host contract** (`currentParams` passed to `buildStaticNavHref` *only when already on `/group/*`* — `ContextSwitcher.tsx:116` semantics, fixing the `NewShell.tsx:343` unconditional pass before it becomes a leak), G5 divider suppression when `groups.length === 0`, and guest rail (logo + Static Finder only). |
| `frontend/src/pages/chrome/chromeSlots.tsx` | Slot-registration context: `{ setSlots(slots: { topBar: ReactNode; spine: ReactNode } | null) }` + `useRegisterChromeSlots(slots)` (registers in `useLayoutEffect`, clears on unmount — no paint-visible flash). |
| `frontend/src/pages/chrome/NonGroupTopBar.tsx` | The **slim TopBar** (≥sm) + **v2 mobile top bar** (<sm) — one file, two responsive rows, because they share the auth slot and matrix rows. Desktop row: page-identity left · Discord/GitHub (`DISCORD_INVITE_URL`/`GITHUB_REPO_URL` from config, `DiscordIcon`/`GitHubIcon` from ui) · `ThemeToggle` · `NotificationBell` · `SettingsGear` (G1) · **auth slot**. Mobile row: logo/home · `NotificationBell` · `SettingsGear` (opens `GlobalSettingsPanel`, which Layout's v2 branch still mounts) · `UserMenu` avatar / auth slot. Auth slot (both rows): `!useAuthHydrated() || isLoading` → the `Header.tsx:407-408` pulse skeleton; else `user ? <UserMenu/> (mobile only; desktop UserMenu lives in the rail footer) : <LoginButton/>` (H12/H13). Sticky `top-0 z-40 h-14`, matching group TopBar — slots into the documented z-stack without touching AdminSidebar FAB `z-50`, docs overlay `z-50`, ProfileBottomNav `z-[50]`/sheet `z-[55]` (all bottom-anchored or above). |

### Slots mechanism — **PORTALS, not element registration (RC1/RC2, director-mandated)**

The group TopBar needs `onOpenPalette` (CommandPalette state) and Spine needs `gv.pageMode/setPageMode` — both owned by NewShell, and **not reconstructible at Layout level** (`useGroupViewState`/`CommandPalette` use `useParams`, empty above the route).

**RC1 (blocking, fixed):** element-passing slots are WRONG here — React context is positional, and `TopBar` unconditionally renders `TierBreadcrumb` (`TopBar.tsx:129`, CSS-hidden but always mounted), which calls `useGroupActions()` (`TierBreadcrumb.tsx:32`) that **throws** without a `GroupActionModals` provider (`groupActionsContext.tsx:65-68`). The provider lives in NewShell — *below* the host — so a slot element rendered by AppChrome has no provider ancestor → throw → the app ErrorBoundary swallows the v2 group route. Invisible to `NewShell.rail.test.tsx:96` (stubs TopBar) and `TopBar.test.tsx:19-21` (mocks useGroupActions).

**The mechanism:** `AppChrome` renders host-owned DOM containers `<div ref={topBarSlotRef}/>` / `<div ref={spineSlotRef}/>` in the chrome column and publishes the two nodes via a stable-identity context; `NewShell` renders `createPortal(<TopBar …/>, topBarEl)` / `createPortal(<Spine …/>, spineEl)`. Portal children remain React-tree children of NewShell — `GroupActionModals` and every future provider resolve correctly — while the DOM position is the host's. Do **not** hoist `GroupActionModals` into AppChrome instead (it would mount AddPlayerModal/CreateTierModal/RolloverDialog app-wide and its `onTierCreated` needs route-scoped `setPageMode`).

**RC2 (fixed by construction):** the rejected registration design also re-rendered the whole app tree on every query-param write (`setSearchParams` gets a new identity per URL change in react-router 7.12 → new slot object → ancestor `setSlots` setState). Portals have no ancestor state: only the portal contents re-render. This is exactly the vetted wording — "the group route supplies TopBar+Spine slots" — with one host, zero duplicated chrome logic. During NewShell's lazy-chunk Suspense window on `/group/*`, the host renders an **empty h-14 placeholder bar** (keyed on `matchPath('/group/:shareCode')`) instead of NonGroupTopBar, so no wrong-affordance flash and no layout shift. CommandPalette, mod-K listener, `V2SettingsHost`, `GroupActionModals`, all cold-fetch/tier effects, `useViewAsUrlSync`, `useStaticNavMemory`, and `data-testid="new-shell"` **stay in NewShell** (the e2e mount sentinel keeps working).

### Layout restructure

Hooks (`useGlobalKeyboardShortcuts`, shortcuts-event listener, `useShellParamPersistence` from S2, `useResolvedShell`) stay unconditional above the return. Then:

```tsx
const chromeActive = resolvedShell === 'v2' && location.pathname !== '/';
```

- `chromeActive === false` → **the exact current legacy return, byte-identical** (Header, padded `<main>` + PageTransition, `SettingsDockToggle` with its existing guard, GlobalSettingsPanel, etc.). Legacy/no-param users and everyone on `/` never enter the new branch.
- `chromeActive === true` → `<ViewAsBanner/>` (kept above the chrome, matching today's v2-group stacking) → `<AppChrome><PageTransition/></AppChrome>` → `SettingsPanelController` + `GlobalSettingsPanel` + `KeyboardShortcutsHelp` (Stage-1 req 5). **No** `SettingsDockToggle` in this branch (G1: re-homed to the NonGroupTopBar SettingsGear; group v2 already had its own gear). Chrome is outside `PageTransition` (req 7); `#main-content` lives on AppChrome's `<main>` on every v2-chromed route (req 6) and NewShell's inner `id` is removed (single skip-link target).

Route scope falls out by construction: Person + Discovery + Admin + Docs + `/dashboard` + the `*` 404 (G3) are all Layout children; `/` is excluded by the pathname check; the 3 bare routes are outside Layout entirely.

### G2 consumer

`UserMenu.tsx:309` becomes `useInV2Chrome() && (…Switch to classic UI…)`. Legacy Header's UserMenu (including on `/` for v2-resolved users) has no provider → item hidden (D2 stays deferred); every AppChrome-hosted UserMenu (rail footer, mobile top bar) shows it (H14).

## 3. Task breakdown (dependency order; each independently implementable + reviewable)

### T0 — Land `redesign/v2-nav-entry` (rebase + D7 gate) — PR-0
**Files:** `UserMenu.tsx` (S1 item + `isAdmin` gate), `shellPreference.ts` (+ test), `useShellToggle.ts`, `Layout.tsx` (S2 hook mount), `UserMenu.shellToggle.test.tsx`, `releaseNotes.ts`; drop duplicated docs commits.
**Matrix rows:** none (pre-req). **Rulings:** D7.
**Legacy-owned edits:** `UserMenu.tsx` (S1's own sanctioned justification already written in `bc4a9ba`; extend it for the admin gate — legacy-visible only to admins, mirrors the banner gate).

### T1 — Chrome-context signal + UserMenu seams (G2 rekey, M2 items) — PR-1
- New `lib/chromeContext.tsx`. NewShell wraps its **current** tree in the provider (temporary, removed in T3 when AppChrome takes over) so the escape item never disappears from group v2 mid-stack.
- `UserMenu.tsx`: (a) "Switch to classic UI" gate → `useInV2Chrome()` (H14/G2); (b) add Discord + GitHub `DropdownItem`s gated on `useInV2Chrome()` (M2 — appears in group-v2 menus immediately, additive; covers mobile v2 everywhere once T4 lands).
**Matrix rows:** H14/G2, H8/H9-mobile (M2).
**Tests:** `UserMenu.shellToggle.test.tsx` rewritten to provider-keying: renders with provider on any route; absent without provider even when `resolvedShell === 'v2'` on `/` (**pins the G2 no-leak explicitly**); toggle still fires telemetry + preference + `?shell=` strip. New rows for the Discord/GitHub items (present with provider, absent without).
**Legacy-owned edits:** `UserMenu.tsx` — sanctioned-edit justification: all three changes are keyed on a context whose provider exists only inside v2 chrome; legacy menu output is byte-identical (assert via the without-provider tests).

### T2 — NotificationCenter single-mount (Stage-1 req 10) — PR-1
- `stores/notificationStore.ts`: add `centerOpen / openCenter / closeCenter` (UI open-state joins the domain store; no new store, no store→store edge).
- `UserMenu.tsx`: Notifications item → `openCenter()`; **delete** its self-mounted `NotificationCenter` (line 342) and `notificationsModal`.
- `App.tsx`: mount a single `<NotificationCenterHost/>` (tiny pages/ or components/auth component subscribing to the store) next to `ToastContainer` — serves both shells and every route.
- `NewShell.tsx`: delete its NotificationCenter mount + `notifications` modal; `TopBar`'s `onOpenNotifications` → `openCenter` (prop kept; `NotificationBell` unchanged).
**Matrix rows:** structural guarantee "NotificationCenter deduped to a single mount".
**Tests:** new `NotificationCenter.singleMount.test.tsx` (exactly one instance in a v2-group render; UserMenu item and bell both open it); update any NewShell test asserting the old mount.
**Legacy-owned edits:** `UserMenu.tsx` (behavior-preserving; justification: same item, same panel, one mount — Stage-1 req 10), `App.tsx` (additive mount; self-gates on `user`, verify no render on bare routes matters).

### T3 — AppChrome host + hoist group chrome (pure refactor, group scope only) — PR-2
- New `pages/chrome/AppChrome.tsx`, `pages/chrome/chromeSlots.tsx`. Host implements: rail entries + real `isActive`, **M1 logo link** (`Link to={user ? '/profile' : '/'}` with matching accessible name "Player Hub" / "FFXIV Raid Planner — home"), §1 host contract for `buildStaticNavHref`, G5 divider suppression, guest rail, footer gating on `user`, guest-guarded `fetchGroups` (moved from NewShell), group-route placeholder bar.
- `Layout.tsx`: introduce the branch with `chromeActive = isGroupV2Shell` (**same route set as today** — no scope change yet); v2 branch per §2.
- `NewShell.tsx`: sheds AppRail/TopBar/Spine/`#main-content` wrapper/provider (from T1)/cold `fetchGroups`; adds `useRegisterChromeSlots`; keeps everything route-coupled.
**Matrix rows:** §1 host contract, structural guarantees (chrome outside PageTransition, `#main-content`), M1/H1, G5, "Group TopBar + Spine — hoist only".
**Tests:** `NewShell.rail.test.tsx` → retargeted as `AppChrome.test.tsx` (entries, isActive per route, logo link authed/guest + accessible name, **the matrix's exact leak case**: rail avatar clicked from `/profile?tab=jobs-gear` yields `/group/CODE` with no foreign params); `NewShell.authGuard.test.tsx` **moves** with the fetch (same assertions, new home); `GroupRoute.test`, slot/banner/roster/gear/schedule NewShell suites unchanged; new slot-registration test (slots render in host; cleared on unmount → placeholder).
**Legacy-owned edits:** `Layout.tsx` — justification: legacy return path byte-identical (diff shows only the added branch); the suppressed-Header condition set is unchanged in this PR.
**RC3 (director):** AppChrome's `<main>` must own the padding/scrollbar decision explicitly — Layout's legacy `<main>` carries `pt-1 pb-3 md:py-2` + `scrollbar-gutter: stable` (`Layout.tsx:60`); the matrix's "bodies unchanged" premise means the v2 `<main>` REPRODUCES both (padding + gutter) for hosted legacy bodies; any deliberate deviation is decided per route class and screenshotted.
**RC7 (director):** add one integration-shaped test — real AppChrome + real TopBar portal inside a real `GroupActionModals` — asserting the tier kebab renders (the exact surface RC1 would have killed; both existing suites mock it away).
**RC8 (director):** the host-contract leak test must set `tabPersistence: 'reset'` on the mocked user — `buildStaticNavHref` only consults `currentParams` on the non-remember branch, so the default-preference test would pass vacuously.
**Scope note (director E-table):** moving `fetchGroups` to AppChrome converts a group-only fetch into a cold fetch on every v2-chromed route for authed users and can race Profile's own `fetchGroups` on cold `/profile` (both guard on `groups.length === 0`) — dedupe via an in-flight guard or accept + document the double request.
**Bundle note:** Layout is eagerly imported, so AppChrome/AppRail/NonGroupTopBar/UserMenu move from the lazy NewShell chunk into the main bundle — expected, state it in the PR. `chromeSlots.tsx` must split provider/hook files (or carry the same react-refresh suppression `groupActionsContext.tsx` has) to keep the zero-new-suppressions claim honest.
**Live check before merge:** group v2 both viewports, before/after screenshots (the rail now reaches viewport edges and TopBar is truly top-fixed — expected, improvement-class delta; Stage-0 mobile TopBar fix must survive); **tier kebab (Create/Rollover/Delete) fired live** — the RC1 surface.

### T4 — Coverage flip: NonGroupTopBar + route scope + G1 — PR-3
- New `pages/chrome/NonGroupTopBar.tsx` (per §2, H7–H13, G1).
- `Layout.tsx`: `chromeActive = resolvedShell === 'v2' && pathname !== '/'`.
- `NotificationBell.tsx` (v2-only file): gate the `pendingCount` badge contribution **on the route** (`pathname.startsWith('/group/')`, matching `Header.tsx:60` / `GlobalSettingsPanel.tsx:25`) — **RC5:** gating on `currentGroup` is ineffective because the store never clears it off-route, so the stale badge H7 ruled out would still render after any static visit. Director confirmed this stays within H7's ruling, no new user flag.
- **RC4 (director):** the guest branch gates `NotificationBell` AND `SettingsGear`, not just the auth slot — V1 gates both (`Header.tsx:331` `user && !isHomePage`; `SettingsDockToggle`/`GlobalSettingsPanel` return null for guests). A guest bell/gear would be new dead affordances V1 never had. Guest rows show: identity + Discord/GitHub + ThemeToggle + LoginButton only.
- **M2 duplication decision:** the chrome-context-gated Discord/GitHub UserMenu items would ALSO show on desktop non-group v2 (where the slim TopBar already carries them) — add `sm:hidden` to the two items so they serve only M2's mobile intent.
**Matrix rows:** H2, H3, H7 (gear kept / badge dropped), H8, H9, H10, H12, H13, H15/G1, G3, §4 rows (PublicProfile/Discover/Dashboard — guest branch load-bearing on PublicProfile), §6 docs row, §7 shortcuts note.
**Tests:** new `Layout.chrome.test.tsx` — the route × shell × auth characterization matrix: no-param default → Header everywhere; v2 + `/profile|/discover|/docs|/dashboard|404` → rail + NonGroupTopBar, no Header, no SettingsDockToggle; v2 + `/` → Header (exclusion); legacy + `/group` → Header; guest v2 → LoginButton; pre-hydration → skeleton (H13). New `NonGroupTopBar.test.tsx` (cluster contents, gear toggles settingsPanelStore, guest/authed/loading branches).
**Legacy-owned edits:** `Layout.tsx` only (same justification pattern as T3).

### T5 — Legacy-file seams: Profile P4/M4 + AdminLayout A3 — PR-3 (same PR as T4; the seams are dead until the scope flip and P4 would otherwise ship a double-UserMenu `/profile`)
- `Profile.tsx`: `const inV2Chrome = useInV2Chrome();` → `ProfileSidebarNav` footer becomes `inV2Chrome ? undefined : (collapsed) => <UserMenu variant="rail" collapsed={collapsed}/>` (pass a `footer` override prop through `ProfileSidebarNav` or gate inside it — keep the edit at the `Profile.tsx:87` seam the matrix names). Everything else (7 entries, shortcuts, collapse persistence, ProfileBottomNav) untouched (P1/P2/P3/P5 KEPT).
- `AdminLayout.tsx`: `inV2Chrome ? 'min-h-[calc(100vh-3.5rem)]' : 'min-h-[calc(100vh-4rem)]'` and render the nested `<main>` as `<div>` under v2 chrome (AppChrome owns the page's one `<main id="main-content">`); legacy branch literals unchanged.
**Matrix rows:** P4/M4 (incl. owning the cosmetic collapsed-menu delta), A1–A3.
**Tests:** Profile: with provider → exactly one UserMenu in the tree (the rail's); without provider → footer UserMenu present (pins legacy). AdminLayout: class/element assertions per branch.
**Legacy-owned edits (the two sanctioned seams the matrix pre-authorizes):** `Profile.tsx` (M4) and `AdminLayout.tsx` (A3) — each PR description carries the required justification + the "gate provably false on every legacy render path" argument (provider only exists inside Layout's v2 branch; default context value is `false`).

### T6 — e2e retargets + live validation + docs closeout — PR-3
- `e2e/helpers/auth.ts`: add `pinShell(page, shell)` — navigate once with `?shell=…` (S2 makes it tab-sticky; the account mirror can never out-resolve a pinned session since hydration only writes `preference`). Defensive reset: **normalize `ui_shell` in `dev_auth.py` alongside the existing `tab_persistence`/`is_admin` normalizations** (director: fixes every suite at one point; a per-suite PATCH would need the CSRF header forwarded like `setStaticPublic` does or it fails silently-then-flakily).
- `smoke.spec.ts:677`: Lodestone flow → `goto('/profile?shell=v2')` (suite's v2 family) — the 'Sync & Gear' sidebar click **still works** because P1 keeps ProfileSidebarNav; assert the v2 chrome sentinel (rail present) so the test pins chrome+flow. `smoke-legacy.spec.ts` gets the legacy pin on any non-group navigations it makes; verify test 13's `name: 'Settings'` selectors stay unambiguous.
- Docs: `V2_COVERAGE_PLAN.md` Stage-1 status cell moves **only after** the live demo; release-notes internal entry; matrix rows become the director change-review checklist — **re-anchor the matrix's drifted line cites at PR-3 review time** (director G: Layout.tsx:82→77, Header.tsx:405-406→407-408, :415→417, :329-365→331-367, ContextSwitcher.tsx:117→114) so the per-row sweep reads against real lines.

## 4. Test strategy summary

**Must NOT change (pin V1 + resolution invariants):** `GroupRoute.test.tsx`, `shellPreference.test.tsx` (post-T0 form), `Header.avatar.test.tsx`, `Header.settings.test.tsx`, `TryNewUiBanner.test.tsx`, `App.test.tsx` (A7), NewShell slot/banners/roster/gear/schedule suites, `smoke-legacy.spec.ts` (selector-neutral pin additions only).
**Updated/retargeted:** `UserMenu.shellToggle.test.tsx` (T0 + T1), `NewShell.rail.test.tsx` → `AppChrome.test.tsx` (T3), `NewShell.authGuard.test.tsx` moves with the fetch (T3), `UserMenu.railfooter.test.tsx` (only if the footer-override prop touches it).
**New:** `Layout.chrome.test.tsx` (the branch matrix — this is the single most important V1 guard), `NonGroupTopBar.test.tsx`, `AppChrome.test.tsx`, slot-registration test, `NotificationCenter.singleMount.test.tsx`, Profile/AdminLayout seam tests, chromeContext leak test.
Every PR: full vitest + `pnpm build` + design-system check + boundaries lint (new files must introduce zero new suppressions).

## 5. Live-validation checklist (before "done" is claimed; screenshots in PRs)

Personas: **admin (dev owner) · non-admin member · guest**. Shells: legacy (no-param **and** explicit) · v2. Viewports: desktop ≥sm · mobile <sm.

1. Legacy/no-param: `/`, `/profile`, `/discover`, `/docs`, `/admin`, `/group/:code`, 404 — byte-identical chrome (Header, dock toggle, avatar gating per `Header.avatar` rules); no "Switch to classic UI" anywhere.
2. v2 authed desktop: every route class shows rail + correct top bar; Player Hub/Static Finder `aria-current`; rail avatar from `/profile?tab=jobs-gear` navigates clean (host contract) and honors tab-memory both preference states; logo → `/profile`; skip-link lands on `#main-content`; escape item present in rail UserMenu on every v2-chromed route; SettingsGear opens GlobalSettingsPanel; SettingsDockToggle absent; Discord/GitHub in top bar; rail does **not** fade on navigation (PageTransition check).
3. v2 on `/`: legacy Header renders; **no escape item in its UserMenu** (G2 leak check).
4. v2 mobile: mobile top bar on non-group routes (bell, gear→GlobalSettingsPanel, avatar menu with Discord/GitHub/theme/escape items); group routes keep group TopBar (Stage-0 overlap fix intact); AdminSidebar FAB+drawer, docs FAB+slide-out, ProfileBottomNav + More sheet all layer correctly over/under the bar.
5. Guest: `?shell=v2` on `/docs`, `/discover`, `/profile/:shareCode`, 404 → guest rail (logo→`/`, Static Finder only, no dangling divider, no footer border), LoginButton in top bar, **no auth-flash on throttled cold load** (H13); S2 keeps the tab in v2 across clicks.
6. Cross-cutting: Shift+S / Ctrl+Shift+S / Shift+? land v2-chromed; ViewAsBanner during admin View-As in v2; notifications open from bell **and** menu item with a single center instance; zero-statics account rail (G5); admin non-admin bounce `/admin`→`/dashboard` stays chromed; `/dashboard` chromed; logout from v2 → `/` (legacy Header, correct).

## 6. Risk register — top 5 ways this breaks V1 or v2-in-static

| # | Risk | Guard |
|---|---|---|
| R1 | Layout branch condition regression — Header lost/doubled on a legacy route, or `/` accidentally chromed | `Layout.chrome.test.tsx` route×shell×auth matrix incl. no-param default and `/`; legacy return path byte-identical by diff construction; `smoke-legacy` suite; App.test A7 |
| R2 | Shared-file seams (UserMenu ×3 edits, Profile P4, AdminLayout A3) leak into legacy renders | Context-keyed seams: provider exists only inside Layout's v2 branch (default `false`); per-file provably-false argument in PR body; without-provider unit tests. **RC6 exception, stated honestly: T2's NotificationCenter dedupe is an UNCONDITIONAL legacy-path edit** (legacy Header renders UserMenu on every route) — it is NOT provably inert and instead carries an explicit V1 characterization test (legacy route → Notifications item opens the single center, closes, badge unchanged) + a legacy live check |
| R3 | NotificationCenter dedupe kills the legacy menu item (dead click) or regresses open behavior | Store-level tests + single-mount test + both-shells live check; change is mechanical (modal state → store) with no render-path change |
| R4 | Group-v2 hoist regressions: scroll/sticky restructure, ⌘K lost, slot flash, tab-memory misfires, `GroupActionModals` context break | Route-coupled pieces deliberately stay in NewShell; `useLayoutEffect` registration + placeholder bar; retargeted AppChrome/NewShell suites; v2 e2e smoke; before/after screenshots at T3 review |
| R5 | e2e cross-run contamination via account `ui_shell` mirroring (dev owner dogfoods v2 → legacy-assuming specs flip) | Per-suite `pinShell` (S2 session-stickiness) + explicit `?shell=` on `smoke.spec.ts:677` + defensive API reset in suite setup — Stage-1 req 12 |

(Watch-item beyond the five: the `buildStaticNavHref` currentParams leak is R4-adjacent and carries its own dedicated unit test — the matrix's `/profile?tab=jobs-gear` example.)

## 7. PR shape — recommendation

**Stacked slices, four PRs** (D1: slices land as PRs to main; hard-gate 2 gives each a director change-review):

- **PR-0** — v2-nav-entry rebase + D7 admin gate (T0). Small, unblocks everything.
- **PR-1** — seams + dedupe (T1+T2). No legacy-visible change; v2-group gains M2 items.
- **PR-2** — AppChrome host + group hoist (T3). Refactor-shaped, group-v2-only blast radius; its review is where the hoist screenshots land.
- **PR-3** — the coverage flip (T4+T5+T6). The matrix sweep happens at this change-review: every row H1–H15/P1–P5/A1–A3/G3/G5 + §1 items checked off, both-shell screenshots embedded, live-validation checklist executed.

A single PR is rejected: it would mix a refactor (hoist) with behavior (scope flip) across ~25 files including four legacy-owned seams — unreviewable against a per-row contract. Either way **the matrix is the stage-level acceptance contract**; PR-3's review is the gate that closes it, and Stage-1 "done" additionally requires the running-app demo (plan §5.3). Note: un-gating the D7 launch gate is **not** part of Stage 1 — it is a separate user decision once Stage 1 is demonstrated and the Ring-0 blemishes are confirmed closed.
