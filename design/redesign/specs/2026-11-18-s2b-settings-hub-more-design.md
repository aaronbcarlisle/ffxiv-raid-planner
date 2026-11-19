# Stage 2b · Settings page, Hub Account and Connections, More dissolved (V2) — design

**Status:** ACCEPTED 2026-11-18; the parity matrix was signed the same day, every item as written. Co-designed with the owner on 2026-11-18: the owner chose S2b as the next step and answered twelve design questions, every one as recommended. Director spec-vet 1 (APPROVE-WITH-FOLDS: C1, C2, I1–I10 and the minors) is folded in, tagged `(vet …)` (tagged `(owner, 2026-11-18)` below). Calls the controller made alone are tagged `(controller)` and are listed for sign-off in the parity matrix §9. No code until the slice plans exist; this spec and its owner-signed [parity matrix](2026-11-18-s2b-parity-matrix.md) are done (`HOME_STRETCH.md` §4 S2, spec-ready boundary).
**Roadmap home:** `HOME_STRETCH.md` §6.3 W3 **S2b** (gate: HS-3, F-12, X1).
**Inputs:** HS-35 #10 (no Team Summary in V2), #12 (five tabs + a utility zone), #21 (DA 15 A: Settings is a page), #23 (DA 17 A: Hub tabs renamed, Connections, the Sync card), #26 (product names), #27(d) ("Wants"); HS-3, HS-24, HS-27, HS-30, HS-33; F-05, F-12 (`specs/systems-flow-map.md:213-224`); the More dissolution table (`specs/systems-flow-map.md:192-205`) as corrected by `HOME_STRETCH.md:134`; RH1 (`plans/2026-09-28-rh1-recruit-home.md:260`); D-52, D-70; the audit's DA 15, DA 17, A1 D4 and A5 §4.3 (local `.superpowers/v2-audit/`, published as the V2 audit synthesis linked from `HOME_STRETCH.md`); CLAUDE.md § UI rules.
**Numbering:** Stage 2 rulings continue from S2a's S2-15.

## 1. Problem

V2 has three leftovers from V1's navigation that nothing in the five-tab spine reaches:

- **More** (`?tab=more`) is a page of cards that mostly open something else. Two are "Coming soon" stubs, two open a Settings tab that holds one toggle, and one (Integrations) is shown to people who cannot open its target. It is also the only place a member can leave a static, and on a phone the only way back to the classic UI from inside a static.
- **Plugin** (`?tab=plugin`) has no V2 entry besides ⌘K and the More card. Its setup steps are out of date: they skip the custom repository and the browser sign-in that the plugin's README treats as the main path.
- **Settings** is a dock shared with V1. Account preferences sit in it next to static settings.

Two capabilities are missing in both shells. An owner cannot transfer ownership (the route exists, `backend/app/routers/static_groups.py:1397`, and no UI calls it), so an owner cannot leave: the backend answers "Transfer ownership first." A viewer cannot leave either, although the backend allows it.

S2b gives each of these a home, then removes More and Plugin from V2.

## 2. Rulings

### S2-16 · **Settings is a page** (HS-35 #21, DA 15 A)

- Route `/group/:shareCode/settings/:section`. `/settings` alone opens the first section the reader may see. The entry is the top bar's gear (`layout/TopBar.tsx:179`), shown as active while on the page. The Spine has no utility zone yet (`layout/Spine.tsx:17-24`); HS-35 #12's zone stays with W4 RECRUIT (`HOME_STRETCH.md:434`). *(vet I2)*
- Layout: a 240px section list on the left and the section's content beside it, left-aligned inside the standard page width. The list is navigation (`NavRow`), not `Tabs`: each section is a URL.
- Toggles save at once with a toast. A form with typed fields (the static's name) gets a Save/Cancel bar in the section, never sticky, and a guard on leaving with unsaved text.
- Under V2 nothing opens the dock inside a static. Every V2 caller of `settingsPanelStore.open()` keeps calling it, and S2b-1 swaps the store's `recruitRedirect` for one V2 redirect over `open()`: a settings tab goes to its section URL, and recruitment goes to the Recruit home as today. The seam stays until D1. That covers the gear, ⌘K "Open Settings", Alt+G/P/M, Loot's Rules link, Home's "Review" and recruiting-line buttons, Roster's Requests and the top bar's invite fallback (matrix S-02…S-04, S-23…S-26). `pages/V2SettingsHost.tsx` is deleted. *(vet C1)*
- Alt+I keeps going to the Recruit home. V2 gets its own shortcut-help group so V1's help text stays as it is. *(vet I1)*
- The Hub's "Settings" item links to the page. Its `?showSettings=true` target has no reader today, so the link is dead; S2b-1 fixes it. `?settings=` is treated the same way.
- A guest has no gear, and the route sends a guest to the static's Home. A signed-in non-member is treated as a guest. *(vet I4)*
- Under V1, `GroupRoute` redirects `/group/:code/settings/*` to the static, as it does `recruit` (`pages/GroupRoute.tsx:28-41`). *(vet I10)*
- Phones: the section list becomes a `Select` above the content. Polish waits for W7.

### S2-17 · **Sections** (owner, 2026-11-18; DA 15 A, A1 D4)

| Section (`:section`) | Holds | Who sees it |
|---|---|---|
| Static profile (`profile`) | Name, Public, Auto-sync gear and its interval, the share link | Owner and lead edit as today. Members and viewers see the name and Public state, read-only |
| Loot priority (`priority`) | Today's Priority tab | Owner and lead edit; members read-only; viewers do not see it (as today, `settings/SettingsPanel.tsx:63`) |
| Integrations (`integrations`) | Today's Integrations tab: Discord, webhook, mentions, mirrors, iCal | Owner, lead |
| Members & roles (`members`) | Today's Members tab, plus S2-19 | Everyone |
| Suggestions (`suggestions`) | Today's V2 Suggestions tab | Everyone. Interim, until W4 HOME re-homes it (D-70) |
| Danger zone (`danger`) | Delete static | S2-18 |

- "Discord" in DA 15 is named **Integrations**, because it also holds iCal and the mirrors.
- "Hide unclaimed banners" and "Hide BiS banners" are not on the page: HS-35 #17 retires them in V2 (`HOME_STRETCH.md:533`). *(vet I3)*
- **General is not a section.** Its one toggle, "Reset tabs to default", is an account preference and moves to Hub ▸ Account (S2-20).
- Recruitment is not a section. V2's recruiting lives on the Recruit home (RH1); `settings/recruitment` redirects there.
- An unknown or forbidden `:section` falls back to the reader's first section, by `replace`.
- Until CC-5 pair (h) rules otherwise, Loot's Rules link (`loot/Loot.tsx:817-819`) navigates to `settings/priority`, the page form of what it opens today. *(vet C1; controller, matrix C-5)*

### S2-18 · **Danger zone** (HS-35 #21; controller for the lead case)

- Holds Delete static with today's type-the-name confirm (`settings/StaticTab.tsx:131-198`), moved out of Static profile.
- Visible to the owner, and to an admin acting as owner. Hidden under View As (HS-30, D-50). Leads do not see the section: delete is `require_owner` in the backend. *(controller; matrix C-3)*
- The section label is error-tinted. Leave is not here: it sits on the reader's own Members row (S2-19).

### S2-19 · **Leave and Make owner** (owner, 2026-11-18; HS-35 #21, A5 DA 7)

- **Leave.** In Members & roles the reader's own row carries "Leave static…" for every non-owner, viewers included. Confirm copy: "Leave {static}? You'll be removed from the roster and your claimed players unlinked. You can rejoin with a new invite." After leaving, a toast and `/profile` (as today). Hidden under View As.
- **Make owner.** The owner, and a site admin outside View As, see "Make owner…" on every member and lead row. Viewer rows do not carry it: change the viewer's role first. *(owner, 2026-11-18)* The confirm asks the owner to type the static's name and says: "{name} becomes the owner. You become a lead." It calls the existing route; the backend already makes the old owner a lead. Hidden under View As. After it succeeds the page re-reads roles, so the former owner now has Leave on their own row.
- **The owner's own row** shows no Leave. It shows the line "Make someone else the owner before you leave."
- **Hub ▸ Your statics kebab** gains "Leave…" for non-owners (same confirm) and "Transfer ownership…" for the owner, which opens that static's Members & roles. Delete stays as it is.
- The FAQ's sentence about transferring ownership (`FAQDocs.tsx:353-355`) is checked against the shipped flow and corrected if it differs.

### S2-20 · **Hub tabs, and the Account tab** (owner, 2026-11-18; HS-35 #23, #27(d); DA 15)

- V2's Hub tabs read **Summary · Jobs & BiS · Availability · Wants · Privacy · Account**. This amends HS-35 #23's "five tabs" to six. Account gets the next number key and a line in V2's shortcut help. The first five are today's five, relabelled, with new ids `summary`, `jobs`, `availability`, `wants`, `privacy`; every older id still resolves. Account is the sixth, `account`.
- **Account** holds four short sections:
  - **Preferences:** "Reset tabs to default" (from Settings ▸ General), theme, anonymous activity. The avatar menu keeps its theme and anonymity items; both places write the same preference.
  - **Plugin & API keys:** one link row into the Sync card (S2-21). Keys have one home.
  - **Interface:** "Switch to classic UI", the same action as the avatar menu's. The label stays until R1 rules the final wording.
  - **Your data:** S2-28.
- Off a static, V2's gear opens `GlobalSettingsPanel`, a dock holding only General (`layout/GlobalSettingsPanel.tsx:18-37`, mounted at `layout/Layout.tsx:88-90`). S2b-2 points that gear at Hub ▸ Account and unmounts the panel in V2. Until then it stays, so the toggle is never out of reach in V2. *(vet C2)*
- V1's profile tabs are unchanged.

### S2-21 · **Connections and the Sync card** (owner, 2026-11-18; HS-3, HS-35 #23, DA 17 A, A5 DA 6)

Jobs & BiS gains a collapsed **Connections** section holding the Sync card, the character sources and the key manager. The Sync card is a new V2 component; `profile/SyncCenterTab.tsx` stays for V1. It has three states, read from the `lastUsedAt` of the key the browser sign-in mints (named "Plugin browser sign-in", `backend/app/routers/api_keys.py:351`) and the plugin sync snapshot. A key made by hand for another tool does not count as "signed in". *(vet minor)*

1. **Not set up.** Three steps: "Add our plugin repository" (the repository URL in a copy field), "Install XIV Raid Planner", "Sign in from the game" (`/xrp config` ▸ Connection ▸ Sign in with browser). Below them, a `LinkText` "Full plugin guide" → `/docs/plugin` and a disclosure "API key (advanced)".
2. **Signed in, no sync yet.** "Plugin signed in {when} — waiting for your first gear sync. Open a gearset in game, or run `/xrp sync`."
3. **Connected.** "Plugin connected · last gear sync {when}" with Refresh, and "API keys (n)".

- The three steps match the plugin README's Install and Setup sections (`../XIVRaidPlannerPlugin/README.md:21-32,46-53`). The listing name is "XIV Raid Planner"; the app is "FFXIV Raid Planner" (HS-35 #26).
- **API keys live here and nowhere else in V2.** "API key (advanced)" and "API keys (n)" open today's `ApiKeyManager`. Under V2 the avatar menu's "API Keys" item navigates here instead of opening its modal.
- Today's Sources, Coverage and Privacy notes collapse into one disclosure, "How sync works". The Sync Log and "Edit manually" stay in Connections; the Roster links are dropped (HS-35 #23, DA 17 A). *(vet I5)*
- `/profile?tab=jobs&connections=open` opens the section, so links can land on the card.

### S2-22 · **`/docs/plugin`, complete** (owner, 2026-11-18)

A public docs page with: install (the custom repository URL under Dalamud Settings ▸ Experimental, then `/xlplugins`); sign in with the browser; choosing a static and linking players; the commands (`/xrp`, `bis`, `priority`, `split`, `sync`, `gearsync`, `mountsync`, `config`); what syncs and what does not; the API-key path as "Advanced"; troubleshooting. It gets a card on the docs index. S5b may extend it and does not need to finish it.

### S2-23 · **The way back to classic on a phone** (owner, 2026-11-18; F-12, HS-24)

- Below 640px a static's top bar shows the avatar menu, as non-static pages already do (`pages/chrome/NonGroupTopBar.tsx:214`). That makes "Switch to classic UI", the Hub and Log out reachable on a phone inside a static.
- The menu's trigger gets its focus ring back in both shells (HS-35 #21; WCAG 2.4.7). This is S2b's one declared V1 delta, **(n)**, continuing the S2a spec's lettering. *(owner, 2026-11-18)*
- This ships in S2b-3, before S2b-4 removes More. S2c's mobile nav may re-home it.

### S2-24 · **V1 is untouched** (owner, 2026-11-18)

Classic keeps its dock, More, Plugin, Leave and Delete as they are until D1. The stage acceptance line "legacy is byte-identical except the approved Danger Zone delta" (`HOME_STRETCH.md:136`) loses that exception: F-12 approved it when Settings was a shared dock, and the page is V2-only.

Two things do show in classic, both accepted by the owner:
- **Delta (n):** the avatar menu's focus ring (S2-23).
- **Docs are shell-neutral:** `/docs/plugin`, its card on the docs index and the corrected FAQ sentence appear in both shells.

Shared files the slices edit, each behind a V2 condition or prop so V1 renders as before: `MembersPanel`, `StaticTab`, `UserMenu`, `MobileBottomNav`, `CommandPalette`, `useGroupViewState`, `useGroupViewKeyboardShortcuts`, `keyboardShortcutGroups`, `GroupRoute`, `settingsPanelStore`, `hubTabs`. Each PR lists its shared-file edits. *(vet I6)*

### S2-25 · **More and Plugin leave V2** (D-52; controller for the redirects)

- V2 renders neither page. The ⌘K "Go to More" row is removed; "Go to Plugin" becomes "Plugin setup" and opens the Sync card.
- Under V2, `more` redirects to the static's Home, and `plugin` redirects to the Sync card, or to `/docs/plugin` for a guest. Both by `replace`. The redirect covers the URL param and a tab recalled from the per-static memory (`hooks/useGroupViewState.ts:217-223`). *(controller; matrix C-1; vet I8)*
- Until S2c replaces the phone bar, its fifth entry reads "Settings" under V2 and opens the Settings page *(owner, 2026-11-18)*; a guest does not get the entry *(controller)*. Both swipe lists drop `more` under V2 (`pages/GroupViewContent.tsx:179`, `ui/MobileBottomNav.tsx:52-66`). Classic's bar is unchanged.
- No "Coming soon" text remains reachable in V2.

### S2-26 · **Roster's sync lens** (owner, 2026-11-18; F-05, A5 6A)

- Roster's header gains one line: "Synced in the last 7 days: {n} of {m} · {k} never synced".
- Each Roster player shows a sync-age badge ("Synced 2h ago", "Synced 9d ago", "Never synced"). A badge reads as stale after 7 days, the same window as the header line, so the two never disagree. *(controller; matrix C-4. The dashboard's own threshold is 3 days.)*
- Both read `SnapshotPlayer.lastSync`, which a plugin sync and a Lodestone sync both set. The lens counts either. *(controller; matrix C-4)*
- `GearSyncDashboard` does not move into V2. Its BiS Progress and Role Coverage cards are dropped there (Progress's tier row is the BiS view), and it has no Team Summary link (HS-35 #10). This amends F-05(b), the "moves into the Roster area" wording in `HOME_STRETCH.md:134` and `:278`, and the Phase B matrix's KEPT P-2…P-7 (`specs/v1-v2-parity-matrix.md:397`).

### S2-27 · **Wants is a rename only** (owner, 2026-11-18)

S2b relabels the Tracking tab. Adopting Find's list on Wants, and "Wants feeding Progress", stay with the HUB slice (`HOME_STRETCH.md:436`). This corrects the S2a spec's line "The Hub adopts it in S2b" (§2 S2-11) and its §9 line that homes the adoption in "S2b, HUB".

### S2-28 · **Your data: a real pointer** (owner, 2026-11-18)

Account ▸ Your data says what the app stores, with a link to the Privacy page, and how to ask for an export or for deletion today, using the route the Privacy page already gives (`pages/PrivacyDocs.tsx:438-444`). It makes no promise about a future feature. M1 replaces it with real controls (HS-13).

## 3. Structure and navigation

- The Settings page is a V2 route beside `group/:shareCode/recruit` (`App.tsx:173`) and renders inside V2's static chrome. `PriorityTab`, `MembersPanel`, `ScheduleIntegrationsPanel` and the suggestions list are reused as section bodies.
- Static profile is a **new V2 section component**, not `StaticTab` with props: `StaticTab` saves everything from one footer, holds Delete in that footer and has no read-only mode (`settings/StaticTab.tsx:307-336`). The delete confirm is extracted so both can use it. *(vet I7)*
- `stores/settingsPanelStore.ts` stays for both shells; V2's redirect over `open()` replaces `recruitRedirect` (S2-16).
- The Hub's tab ids change in `profile/hub/hubTabs.ts`; the legacy map there grows.
- The order of extraction from `GroupViewContent` (HS-35 #30, controller-owned): S2b removes the V2 paths into its `more` and `plugin` branches and leaves the branches for V1.

## 4. Data

No schema change and no migration. No new backend route is expected: transfer, self-removal, API keys and preferences all exist. Each plan confirms two reads before building on them: that the sync snapshot and key `lastUsedAt` are enough to tell the Sync card's three states apart, and that per-player sync age is already in the Roster's data. If either needs a backend change, it ships alone first, as S2a's backend PRs did, and keeps the plugin contract (CLAUDE.md § Pitfalls).

## 5. Dependencies

- **DEC-1:** answered (HS-35).
- **X1** (Stage 2 working note "Leave Static has nowhere to go"): ruled by HS-35 #21 and S2-19 here.
- **M1 spec:** not written. S2b needs only S2-28's pointer, so the S2b row's "M1 spec for Your data" dependency (`HOME_STRETCH.md:420`) is dropped.
- **CC-5** (the reconciliation PR for the canonical docs): not done. This spec's write-back carries the S2b rulings into `HOME_STRETCH.md` and `PRODUCT_MODEL.md` §6.

## 6. Slice cut (controller ruling, HS-35 #30)

Four slices, each under the 1,500-line cap per PR, run with the `slice-loop` skill. The S2b row's "2–3 PRs" undercounts (matrix C-2).

| Slice | What | Rough PRs |
|---|---|---|
| **S2b-1** Settings page | The route and host, six sections, every V2 opener retargeted, Leave on the own row (viewers included), Make owner, the Danger zone, `V2SettingsHost` deleted | 2–3 |
| **S2b-2** Hub | Tabs relabelled, the Account tab, Connections and the Sync card, the kebab's Leave and Transfer, the avatar menu's "API Keys" retargeted | 2–3 |
| **S2b-3** Guide, Roster lens, phone menu | `/docs/plugin`; Roster's header line and badges; the avatar menu in a static's top bar on phones | 2 |
| **S2b-4** Removal and proof | More and Plugin out of V2, the redirects, the palette rows, e2e proof of §7, write-backs | 1–2 |

S2b-2 lands after S2b-1: the kebab's "Transfer ownership…" opens S2b-1's page. S2b-3 depends on neither. S2b-4 needs all three before it. *(vet I9)*

## 7. Acceptance criteria

1. **[S2b-4]** From a static's Home in V2, every surviving More destination is reachable in two clicks or fewer: Recruit home, Settings, Integrations, Loot ▸ History, Schedule, plugin setup. The three retired cards (Exports, Activity Log, Session History) have no destination.
2. **[S2b-1]** An owner makes another member the owner, becomes a lead, and then leaves. An e2e covers the whole sequence, and a pytest pins the role change.
3. **[S2b-1]** A viewer leaves from their own Members row.
4. **[S2b-1]** Leave, Make owner and Delete are absent under View As.
5. **[S2b-1]** No V2 control opens the settings dock; each role sees exactly S2-17's sections; a guest sees none.
6. **[S2b-2]** The Sync card shows each of its three states (a vitest per state from fixture data, and an e2e for the not-set-up state), and its three steps match the plugin README.
7. **[S2b-2]** API keys can be created and revoked from the Sync card; V2's avatar menu opens no key modal.
8. **[S2b-2]** Every old Hub tab id, V1's and V2's, resolves to the right tab.
9. **[S2b-3]** At 390px, inside a static in V2, "Switch to classic UI" works from the avatar menu before More is removed.
10. **[S2b-4]** No V2 route or control reaches More or `PluginPage`; `?tab=more` and `?tab=plugin` redirect as S2-25 says.
11. **[S2b-4]** No "Coming soon" string is reachable in V2.
12. **[each UI slice]** axe runs clean in both themes on each new surface. Any excluded node is named in the PR and in this section, with its issue.
13. **[each slice]** V1 is unchanged except delta (n) and the docs pages: `e2e/smoke-legacy.spec.ts` passes and every shared file's edit is listed in the PR (S2-24).
14. **[S2b-4]** D-52 gets its ship marker; RECONCILIATION B4 and B6 are closed; `DESIGN_SYSTEM`'s Spine contract, `HOME_STRETCH.md` and `PRODUCT_MODEL.md` §6 are updated.

## 8. Parity

The [parity matrix](2026-11-18-s2b-parity-matrix.md) lists every affordance of More, Plugin, the Settings dock, the Hub's tab bar and Sync content, the key surfaces and the shell switch, with its verdict and V2 home. The owner signs it before any code. Its §9 holds the removals no ruling covers and the controller's calls.

## 9. Out of scope / carried

- **S2c:** the V2 mobile nav; removing the phone bar and swipe.
- **HUB (W4):** the single Privacy control, setup = 4 required, the "Main" tag, Wants adopting Find's list, the tab bar sharing the Spine's component.
- **M1:** account export and deletion.
- **W4 HOME:** re-homing Suggestions (D-70).
- **R1 / R2:** the shell switch's final label and placement.
- **W1 Truth & copy:** correcting V1's plugin steps.
- **W7:** phone polish of the Settings page and the Account tab.
- **D1:** deleting `MorePage`, `PluginPage`, `GearSyncDashboard`, `SettingsPanel` and the dock.
- **F3:** `layout/TabNavigation.tsx`, which looks unused.
- **CC-5 pair (h):** whether Loot ▸ Priority links to `settings/priority`.
