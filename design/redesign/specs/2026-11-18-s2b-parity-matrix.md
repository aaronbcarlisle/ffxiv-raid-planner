# S2b · affordance-parity matrix (spec §8 gate)

**Status: DRAFT 2026-11-18, not signed.** Drafted against `02993bcb`. No S2b code until the owner signs this matrix (S2b spec §8; `HOME_STRETCH.md:126`). Signing means ticking every box in §9. A row the owner rules differently is edited in place and re-dated.

**Owner sign-off:** ⬜ (pending)

**Spec:** [`2026-11-18-s2b-settings-hub-more-design.md`](2026-11-18-s2b-settings-hub-more-design.md). Rulings are cited `S2-n`. Structure and verdict vocabulary follow [`2026-09-30-s2a-parity-matrix.md`](2026-09-30-s2a-parity-matrix.md).
**Paths:** files under `frontend/src/components/` are written from the component folder (`group/MorePage.tsx:97`); `pages/`, `hooks/`, `stores/`, `lib/` from `frontend/src/`; `backend/…` from the repo root.
**Scope:** every V2-reachable affordance of the More page, `PluginPage`, the static Settings dock, the Hub's tab bar and Sync content, the API-key surfaces and the shell switch. **V1 is unchanged** except delta (n) and the docs pages (S2-24): every row's verdict is about V2 only, and V1 keeps each affordance where it is today until D1.

**Legend.** **KEPT** same affordance, same place or an equivalent one. **RE-HOMED** same capability, new place or form. **NEW** a capability neither shell has today. **RETIRED-SPEC** removed by an accepted ruling (cited). **RETIRED-ACK** removed with no ruling that covers it; the owner signs it off in §9. The slice after "·" is where the V2 change ships (spec §6).

## 0. How V2 reaches these surfaces today

- **More** is `?tab=more` on `/group/:shareCode` (`hooks/useGroupViewState.ts:33,221`), rendered by the shared body (`pages/GroupViewContent.tsx:1178-1236`). V2 reaches it through ⌘K "Go to More" (`layout/CommandPalette.tsx:152-156`), `MobileBottomNav` "More" (`ui/MobileBottomNav.tsx:41`), the phone content swipe (`pages/GroupViewContent.tsx:179`) and the URL. The Spine has no More tab (`layout/Spine.tsx:17-24`).
- **Plugin** is `?tab=plugin` (`pages/GroupViewContent.tsx:1239-1244`). V2 reaches it through ⌘K "Go to Plugin" (`layout/CommandPalette.tsx:146-150`), the More card and the URL. It has no Spine tab and no bottom-nav entry.
- **Settings** is the shared `settings/SettingsPanel.tsx` in a dock, wrapped for V2 by `pages/V2SettingsHost.tsx:35-56`. V2 opens it from `SettingsGear`, ⌘K "Open Settings" (`layout/CommandPalette.tsx:161`) and Alt+G/P/M/I (`hooks/useGroupViewKeyboardShortcuts.ts:203-218`).
- **The Hub** is `/profile` → `pages/PlayerHub.tsx`, tabs from `profile/hub/hubTabs.ts:11-19`.

## 1. More page

| ID | Affordance today | Source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| M-01 | Page "More · Lead tools, requests, and settings." | `pages/GroupViewContent.tsx:1180` | RETIRED-SPEC | None: the page is removed from V2 (S2-25; D-52) · S2b-4 | |
| M-02 | Requests card: pending count, recent applications; opens Recruitment | `group/MorePage.tsx:97-128` | RE-HOMED | Recruit home `/group/:code/recruit` (RH1; `HOME_STRETCH.md:134`); already live. Home's recruiting line is one click away · S2b-4 removes the card | The pending count stays on the Recruit home |
| M-03 | Lead Tools card → Settings ▸ General | `group/MorePage.tsx:131-154` | RETIRED-SPEC | Settings page (A5 §4.3) · S2b-4 | Its "Permissions: Manage" row had nothing behind it |
| M-04 | Loot History card: items logged, last entry | `group/MorePage.tsx:157-180` | RE-HOMED | Loot ▸ History, one click from Home (A5 §4.3) · S2b-4 removes the card | The two counts on the card are not re-homed (§9 A-1) |
| M-05 | Split Planner card | `group/MorePage.tsx:184-199` | n/a | V1 only; V2's home is Progress, shipped in S2a | No V2 change |
| M-06 | Integrations card: Discord status, "Plugin sync: Via API key" | `group/MorePage.tsx:202-238` | RE-HOMED | Settings ▸ Integrations for owners and leads (S2-17) · S2b-1 | Members and viewers lose a card that opened a tab they could not see (§9 A-2) |
| M-07 | Dalamud Plugin card → Plugin page | `group/MorePage.tsx:241-263` | RE-HOMED | Hub ▸ Jobs & BiS ▸ Connections Sync card, and `/docs/plugin` (S2-21, S2-22) · S2b-2, S2b-3 | |
| M-08 | Settings card → Settings ▸ General | `group/MorePage.tsx:266-289` | RE-HOMED | The spine's Settings utility (S2-16) · S2b-1 | Its "Notifications · Configure" row had nothing behind it |
| M-09 | Exports stub, "Coming soon" | `group/MorePage.tsx:300-309` | RETIRED-SPEC | Deleted (`HOME_STRETCH.md:134`, §12 A17) · S2b-4 | A static-data export is "After 3.0.0" |
| M-10 | Activity Log stub, "Coming soon" | `group/MorePage.tsx:312-321` | RETIRED-SPEC | Deleted (same) · S2b-4 | Its later home is Home's view-all (D-63, P2b) |
| M-11 | Session History → Schedule | `group/MorePage.tsx:324-335` | RETIRED-SPEC | Dies; Schedule is one click from Home (HS-27) · S2b-4 | |
| M-12 | Interface: "Switch to classic UI" | `group/MorePage.tsx:345-361` | RE-HOMED | The avatar menu on every width, and Hub ▸ Account ▸ Interface (S2-23) · S2b-3 | Must ship before M-01 (F-12) |
| M-13 | Danger Zone: Leave Static + confirm (non-owner, non-viewer) | `group/MorePage.tsx:365-392,408-420` | RE-HOMED | Settings ▸ Members & roles, own row; Hub ▸ Your statics kebab (S2-19) · S2b-1, S2b-2 | Widened to viewers (H-NEW-2) |
| M-14 | Danger Zone: Delete Static → opens Settings ▸ Static | `group/MorePage.tsx:393-400` | RE-HOMED | Settings ▸ Danger zone (S2-18) · S2b-1 | |
| M-15 | ⌘K "Go to More" | `layout/CommandPalette.tsx:152-156` | RETIRED-SPEC | Row removed (S2-25) · S2b-4 | |
| M-16 | `MobileBottomNav` "More" (shared with V1) | `ui/MobileBottomNav.tsx:41` | RE-HOMED | Under V2 the entry reads "Settings" and opens the Settings page; a guest gets no entry (S2-25) · S2b-4 | The bar itself goes in S2c. V1's entry is unchanged |
| M-17 | Phone swipes reach `more`: the content swipe and the bar's own | `pages/GroupViewContent.tsx:179`, `ui/MobileBottomNav.tsx:52-66` | RETIRED-SPEC | Under V2 both swipe lists drop `more` (S2-25) · S2b-4 | Goes with S2c |
| M-18 | URL `?tab=more`, and `more` recalled as the remembered tab | `hooks/useGroupViewState.ts:33,217-223` | RE-HOMED | Under V2, one `replace` to the static's Home (S2-25) · S2b-4 | V1 unchanged |

## 2. Plugin page

| ID | Affordance today | Source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| G-01 | Page "Plugin · Sync gear and character data from FFXIV." | `pages/GroupViewContent.tsx:1242-1248` | RETIRED-SPEC | Removed from V2 (S2-25; D-52) · S2b-4 | |
| G-02 | Four install steps (static text, out of date) | `group/PluginPage.tsx:15-36,49-87` | RE-HOMED | Sync card state (a): three steps that match the plugin README; the full guide at `/docs/plugin` (S2-21, S2-22) · S2b-2, S2b-3 | V1's text is corrected by W1 Truth & copy, not here |
| G-03 | Gear Sync ▸ Sync Health: status, last sync, members synced, coverage % | `group/GearSyncDashboard.tsx:97` | RE-HOMED | Roster header line "Synced in the last 7 days: n of m · k never synced" (S2-26) · S2b-3 | The coverage % is not re-homed (§9 A-3) |
| G-04 | Gear Sync ▸ BiS Progress | `group/GearSyncDashboard.tsx:132` | RETIRED-SPEC | Dropped in V2 (S2-26); Progress's tier row is the BiS view · S2b-4 | |
| G-05 | Gear Sync ▸ Role Coverage | `group/GearSyncDashboard.tsx:183` | RETIRED-SPEC | Dropped in V2 (S2-26) · S2b-4 | Roster shows roles per card |
| G-06 | Gear Sync ▸ Stale Members (top 3 older than 3 days, or never) | `group/GearSyncDashboard.tsx:212-244` | RE-HOMED | Sync-age badge on each Roster player (S2-26) · S2b-3 | Every player, not the top three |
| G-07 | Gear Sync ▸ Recent Sync Activity (top 5) | `group/GearSyncDashboard.tsx:246` | RE-HOMED | The same per-player badge carries the last sync time (S2-26) · S2b-3 | The list form is not kept (§9 A-3) |
| G-08 | Gear Sync ▸ Team Summary link | `group/GearSyncDashboard.tsx:272-288` | n/a | Never rendered on this page (`group/PluginPage.tsx:90-94` passes no `onViewStats`); HS-35 #10 | |
| G-09 | Your API keys: list, Create (shown once, copy), Revoke | `settings/ApiKeyManager.tsx:90-150,155-215` | RE-HOMED | Sync card, "API key (advanced)" disclosure (S2-21) · S2b-2 | Same component and store |
| G-10 | Guest prompt "Log in to create an API key…" + `LoginButton` | `group/PluginPage.tsx:97-123` | RE-HOMED | `/docs/plugin` is public and carries the sign-in step (S2-22); a guest who opens `?tab=plugin` lands there · S2b-3, S2b-4 | The Hub needs a session |
| G-11 | ⌘K "Go to Plugin" | `layout/CommandPalette.tsx:146-150` | RE-HOMED | Row becomes "Plugin setup" → the Sync card (A5 §4.3) · S2b-4 | |
| G-12 | URL `?tab=plugin`, and `plugin` recalled as the remembered tab | `hooks/useGroupViewState.ts:33,217-223` | RE-HOMED | Under V2, one `replace`: signed in → `/profile?tab=jobs` with Connections open; guest → `/docs/plugin` (S2-25) · S2b-4 | V1 unchanged |
| G-13 | Avatar menu "API Keys" modal | `auth/UserMenu.tsx:249-254,393-395` | RE-HOMED | Under V2 the item navigates to the Sync card (S2-21) · S2b-2 | V1 keeps the modal |
| G-14 | `/plugin-auth` consent page | `pages/PluginAuth.tsx`, `App.tsx:207` | KEPT | Unchanged; outside both shells | Plugin contract |

## 3. Static Settings

| ID | Affordance today | Source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| S-01 | Settings as a right dock / phone overlay | `settings/StaticSettingsHost.tsx:34-65`, `pages/V2SettingsHost.tsx:35-56` | RE-HOMED | A page, `/group/:code/settings/:section` (S2-16) · S2b-1 | V2 mounts no dock inside a static afterwards; off a static see S-22 |
| S-02 | The top bar's gear opens the dock | `layout/TopBar.tsx:179`, `layout/SettingsGear.tsx` | RE-HOMED | The gear navigates to the page and shows active on it (S2-16) · S2b-1 | The Spine's utility zone stays with W4 RECRUIT |
| S-03 | ⌘K "Open Settings" | `layout/CommandPalette.tsx:161` | KEPT | Navigates to the page · S2b-1 | |
| S-04 | Alt+G / P / M / I open a dock tab | `hooks/useGroupViewKeyboardShortcuts.ts:203-218` | KEPT | Under V2 Alt+G / P / M navigate to Static profile / Loot priority / Members & roles; Alt+I keeps going to the Recruit home (S2-16) · S2b-1 | Alt+G no longer means General (S-05). V2 gets its own shortcut-help group; V1's text is unchanged |
| S-05 | General ▸ "Reset tabs to default" toggle | `settings/GeneralTab.tsx:17-33` | RE-HOMED | Hub ▸ Account ▸ Preferences (S2-17, S2-20) · S2b-2 | An account preference. Until S2b-2 it stays reachable in V2 through the off-static gear (S-22) |
| S-06 | Static ▸ name (owner edits) | `settings/StaticTab.tsx:214-218` | KEPT | Static profile (S2-17) · S2b-1 | Save/Cancel bar |
| S-07 | Static ▸ Public toggle (owner) | `settings/StaticTab.tsx:223-227` | KEPT | Static profile · S2b-1 | |
| S-08a | Static ▸ Auto-sync gear and its interval (lead+) | `settings/StaticTab.tsx:232-256` | KEPT | Static profile · S2b-1 | |
| S-08b | Static ▸ Hide unclaimed banners, Hide BiS banners (lead+) | `settings/StaticTab.tsx:232-256` | RETIRED-SPEC | Not on the page (HS-35 #17, `HOME_STRETCH.md:533`) · S2b-1 | Whether V2 still honours a value set in classic is the quick-wins row's call (`HOME_STRETCH.md:400`) |
| S-09 | Static ▸ Share Link + Copy (lead+) | `settings/StaticTab.tsx:282-302` | KEPT | Static profile · S2b-1 | |
| S-10 | Static ▸ Delete Static, type-the-name confirm (owner; hidden under View As) | `settings/StaticTab.tsx:131-198,310-318` | RE-HOMED | Danger zone section (S2-18) · S2b-1 | Same confirm, same gating |
| S-11 | Priority tab (Mode / Advanced); read-only for members, hidden from viewers | `settings/PriorityTab.tsx:226-229`, `settings/SettingsPanel.tsx:63,489-495` | KEPT | Loot priority section · S2b-1 | `psub` kept |
| S-12 | Suggestions-only tab (V2) | `settings/SettingsPanel.tsx:498-502` | KEPT | Suggestions section, until W4 HOME (S2-17; D-70) · S2b-1 | |
| S-13 | Recruitment tab | `settings/RecruitmentTab.tsx:43-47` | n/a | Already hidden in V2 and redirected to the Recruit home (RH1) | The page has no such section; a `settings/recruitment` URL redirects to the Recruit home |
| S-14 | Integrations: Discord link, webhook, mentions, mirrors, iCal (lead+) | `schedule/ScheduleIntegrationsPanel.tsx:63` | KEPT | Integrations section (S2-17) · S2b-1 | |
| S-15 | Members: list with role chips (everyone) | `static-group/MembersPanel.tsx:180-280` | KEPT | Members & roles section · S2b-1 | |
| S-16 | Members: change role (lead+; Lead option owner-only) | `static-group/MembersPanel.tsx:183-189,225-232` | KEPT | Members & roles · S2b-1 | |
| S-17 | Members: remove + "Unlink player card" (lead+) | `static-group/MembersPanel.tsx:106-135,269-275,364-392` | KEPT | Members & roles · S2b-1 | |
| S-18 | Linked Players: Unlink (lead+) | `static-group/MembersPanel.tsx:298,141-150,396-414` | KEPT | Members & roles · S2b-1 | |
| S-19 | Static tab hidden from members and viewers | `settings/SettingsPanel.tsx:62` | RE-HOMED | Members and viewers see Static profile read-only: the name and whether the static is public (S2-17; A1 D4) · S2b-1 | The share link and lead toggles stay lead-only (§9 A-5) |
| S-20 | `?showSettings=true` / `?settings=` URL params | `hooks/useGroupViewState.ts:195,474-494` | RE-HOMED | Under V2 they `replace` to the Settings page (S2-16) · S2b-1 | Dead today: nothing reads them to open the dock. `hub/YourStaticsCard.tsx:237` links here |
| S-21 | Settings invisible to guests | `pages/V2SettingsHost.tsx` | KEPT | No gear; the route redirects a guest, or a signed-in non-member, to the static's Home (S2-16) · S2b-1 | |
| S-22 | Off a static: the gear opens `GlobalSettingsPanel` (General only) | `pages/chrome/NonGroupTopBar.tsx:177,203`, `layout/GlobalSettingsPanel.tsx:18-37`, `layout/Layout.tsx:88-90` | RE-HOMED | The gear opens Hub ▸ Account; the panel is unmounted in V2 (S2-20) · S2b-2 | Kept until then |
| S-23 | Loot's Rules link opens the dock on Priority | `loot/Loot.tsx:817-819` | KEPT | Navigates to `settings/priority` (S2-17) · S2b-1 | Until CC-5 pair (h) rules (§9 C-5) |
| S-24 | Home's "Review" and recruiting-line buttons open Recruitment | `home/Home.tsx:405,560`, `pages/NewShell.tsx:82-88` | KEPT | Recruit home, through the store's V2 redirect (S2-16) · S2b-1 | Same destination as today |
| S-25 | Roster's Requests opens Recruitment | `pages/NewShell.tsx:102-104` | KEPT | Recruit home, same redirect · S2b-1 | |
| S-26 | The top bar's invite fallback opens the dock | `layout/TopBar.tsx:107-111` | KEPT | Same redirect: its tab's section URL, or the Recruit home · S2b-1 | |
| S-27 | Classic opening `/group/:code/settings/*` | `pages/GroupRoute.tsx:28-41` | NEW | Under V1 the route redirects to the static, as `recruit` does (S2-16) · S2b-1 | |

## 4. New capabilities

| ID | Capability | Backend today | Ruling · slice | Notes |
|---|---|---|---|---|
| H-NEW-1 | "Make owner…" on a member's or lead's row (not a viewer's); the owner, or a site admin outside View As; type the static's name; the old owner becomes a lead | `POST /{id}/transfer-ownership` → `require_owner` (`backend/app/routers/static_groups.py:1397`) | S2-19 · S2b-1 | First UI for it; `stores/staticGroupStore.ts:433` has no caller today |
| H-NEW-2 | A viewer leaves a static | `DELETE /{id}/members/{uid}` lets any non-owner remove themselves (`backend/app/routers/static_groups.py:1270,1303-1306`) | S2-19 · S2b-1 | The client withheld it (`group/MorePage.tsx:77,365`) |
| H-NEW-3 | Hub ▸ Your statics kebab: "Leave…" (non-owner), "Transfer ownership…" (owner; opens Members & roles) | same routes | S2-19 · S2b-2 | Delete is already there |
| H-NEW-4 | Hub ▸ Account tab: Preferences, Plugin & API keys (a link), Interface, Your data | `PATCH /api/auth/me/preferences` (`backend/app/routers/auth.py:440`) | S2-20 · S2b-2 | |
| H-NEW-5 | Sync card states: not set up / signed in, no sync yet / connected | key `lastUsedAt` and the sync snapshot, both already served | S2-21 · S2b-2 | |
| H-NEW-6 | `/docs/plugin`, the full guide | none needed | S2-22 · S2b-3 | |
| H-NEW-7 | The avatar menu in a static's top bar below 640px | none needed | S2-23 · S2b-3 | |
| H-NEW-8 | The avatar menu's focus ring, both shells | none needed | S2-23 · S2b-3 | **V1 delta (n)** (HS-35 #21) |

## 5. Player Hub

| ID | Affordance today | Source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| U-01 | Tabs Overview · Characters & gear · Availability · Tracking · Sharing | `profile/hub/hubTabs.ts:11-19` | KEPT | Relabelled Summary · Jobs & BiS · Availability · Wants · Privacy, plus Account (S2-20; HS-35 #23) · S2b-2 | New ids `summary`, `jobs`, `availability`, `wants`, `privacy`, `account`; every old id still resolves. Account gets the next number key and a shortcut-help line (`profile/hub/hubTabs.ts:23-25`) |
| U-02 | Legacy tab-id map | `profile/hub/hubTabs.ts:27-42` | KEPT | Extended with the five old V2 ids · S2b-2 | |
| U-03 | `SyncCenterTab`: plugin status badge, "Get the plugin" (GitHub) / "Refresh status", source info, Link Character | `profile/SyncCenterTab.tsx:159-213,232,262-288` | RE-HOMED | Connections section on Jobs & BiS; the badge and "Get the plugin" become the Sync card's states; source info collapses into "How sync works" (S2-21; DA 17) · S2b-2 | A new V2 Sync card component; `SyncCenterTab` stays for V1 |
| U-04 | Lodestone link and refresh | `profile/CharacterLinkModal.tsx`, `profile/CharacterCard.tsx:108-150` | KEPT | Unchanged · — | |
| U-05 | Plugin sync tag in the identity header | `profile/hub/HubIdentityHeader.tsx:89-92` | KEPT | Unchanged · — | |
| U-06 | Sharing tab: profile sharing toggle, copy link, application preview | `profile/PreviewShareTab.tsx:113-150,168` | KEPT | Same content under the label Privacy · S2b-2 | The single Privacy control is HUB's |
| U-07 | Tracking tab content | `pages/PlayerHub.tsx:140-217` | KEPT | Same content under the label Wants · S2b-2 | Adopting Find's list is HUB's (S2-27) |
| U-08 | Statics list "Settings" item → `?showSettings=true` | `profile/hub/YourStaticsCard.tsx:237` | KEPT | Links to the Settings page · S2b-1 | A dead link today (S-20); S2b-1 fixes it |
| U-09 | Sync Log | `profile/SyncCenterTab.tsx:347-369` | KEPT | Connections (S2-21) · S2b-2 | |
| U-10 | Roster links per static | `profile/SyncCenterTab.tsx:386-406` | RETIRED-SPEC | Dropped (HS-35 #23, DA 17 A) · S2b-2 | Your statics on Summary links to each static |
| U-11 | "Edit manually" | `profile/SyncCenterTab.tsx:211-213` | KEPT | Connections · S2b-2 | |
| U-12 | "View in Jobs & Gear" | `profile/SyncCenterTab.tsx:306-314` | RETIRED-ACK | None: Connections is on Jobs & BiS already (§9 A-6) · S2b-2 | |

## 6. Shell switch

| ID | Affordance today | Source | Verdict | V2 home (ruling · slice) | Notes |
|---|---|---|---|---|---|
| W-01 | Avatar menu "Switch to classic UI" (V2 chrome) | `auth/UserMenu.tsx:362-371` | KEPT | Unchanged on desktop; also reachable below 640px inside a static (S2-23) · S2b-3 | Today the rail that holds it is `hidden sm:flex` (`layout/AppRail.tsx:142`) and the static's top bar shows no menu (`pages/chrome/GroupTopBarAuthSlot.tsx:23`) |
| W-02 | More ▸ Interface | `group/MorePage.tsx:345-361` | RE-HOMED | See M-12 | |
| W-03 | Legacy → V2: `TryNewUiBanner`, avatar menu "Try the new UI" (admin) | `layout/TryNewUiBanner.tsx:29-60`, `auth/UserMenu.tsx:348-356` | KEPT | Unchanged · — | |
| W-04 | `?shell=v2` / `?shell=legacy` | `components/layout/Layout.tsx:31-33` | KEPT | Unchanged · — | |
| W-05 | Avatar menu: theme, anonymous activity, Notifications, Shortcuts, Docs, Log out | `auth/UserMenu.tsx:150-395` | KEPT | Unchanged; theme and anonymous activity also appear in Hub ▸ Account ▸ Preferences (S2-20) · S2b-2 | |

## 7. Tests that move or go

Each slice's plan lists exact edits. The surfaces above are pinned by: `group/MorePage.test.tsx`, `group/PluginPage.test.tsx`, `group/GearSyncDashboard.test.tsx` (all three stay: V1 still renders the components); `pages/GroupViewContent.slots.test.tsx`; `layout/CommandPalette.test.tsx`; `hooks/useGroupViewState.test.ts`, `hooks/navParsers.test.ts`; `auth/UserMenu.shellToggle.test.tsx`; `settings/SettingsPanel.roles.test.tsx`, `.hiddenTabs`, `.suggestionsOnly`; `settings/StaticTab.viewAs.test.tsx`; `static-group/MembersPanel.test.tsx` (role change and remove are untested today; S2b-1 adds them with Leave and Make owner); `pages/V2SettingsHost.test.tsx`, `stores/settingsPanelStore.redirect.test.ts`, `layout/SettingsGear.test.tsx`; `pages/PlayerHub.test.tsx`, `profile/hub/hubTabs.test.ts`; e2e `guest.spec.ts:96-199`, `smoke.spec.ts:606-650`, `settings-suggestions.spec.ts`, `destructive-confirms.spec.ts:70`.

## 8. Code S2b deletes

Nothing shared with V1 is deleted: `MorePage`, `PluginPage`, `GearSyncDashboard`, `SettingsPanel` and `StaticSettingsHost` all still render in V1 and go at D1. S2b-1 deletes `pages/V2SettingsHost.tsx` and replaces `stores/settingsPanelStore.ts`'s `recruitRedirect` with the V2 redirect over `open()` (S2-16). S2b-2 unmounts `GlobalSettingsPanel` from V2's layout; V1 keeps it. `layout/TabNavigation.tsx` looks dead today (exported only from `layout/index.ts:4`); it is carried to F3, not deleted here.

## 9. Owner sign-off

Rows the spec's rulings cover need one tick. The **RETIRED-ACK** rows and the controller's own calls are listed one by one.

- [ ] **§1–§6, every KEPT, RE-HOMED, NEW and RETIRED-SPEC row** as written.
- [ ] **A-1 (M-04)** Loot History's "items logged" and "last entry" figures on the More card are not shown anywhere else in V2. Loot ▸ History shows the entries themselves.
- [ ] **A-2 (M-06)** Members and viewers no longer see an Integrations card. They could never open the tab; it showed them the Discord link status and "Plugin sync: Via API key".
- [ ] **A-3 (G-03, G-07)** The Gear Sync dashboard's data-coverage % and its Recent Sync Activity list are dropped in V2. The Roster header line and per-player badges replace them.
- [ ] **A-4 (S-08b)** "Hide unclaimed banners" and "Hide BiS banners" are not on V2's Settings page (HS-35 #17). Classic keeps them.
- [ ] **A-5 (S-19)** Members and viewers gain a read-only Static profile (the name and Public state) and nothing else from that tab.
- [ ] **A-6 (U-12)** "View in Jobs & Gear" is dropped: the section it sat in now lives on that tab.
- [ ] **C-1 (M-16, M-18, G-12)** Under V2: `more` (URL or recalled) redirects to Home; `plugin` redirects to the Sync card, or `/docs/plugin` for a guest. A guest has no Settings, so under V2 the phone bar shows a guest no fifth entry.
- [ ] **C-2 (spec §6)** Four slices, about eight PRs, not the "2–3 PRs" in the S2b row.
- [ ] **C-3 (S2-18)** The Danger zone is visible to the owner only (and an admin acting as owner, except under View As). Leads do not see the section: static delete is owner-only in the backend.
- [ ] **C-4 (S2-26)** Roster's sync badges read as stale after 7 days, matching the header line (the old dashboard used 3 days), and the lens counts a plugin sync or a Lodestone sync.
- [ ] **C-5 (S-23)** Until CC-5 pair (h) is ruled, Loot's Rules link goes to `settings/priority`.
- [ ] **V1 delta (n) (H-NEW-8)** and the shell-neutral docs pages (H-NEW-6), both already accepted on 2026-11-18.
