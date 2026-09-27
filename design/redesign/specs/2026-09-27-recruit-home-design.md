# Recruiting home (V2, lead side) — design

**Status:** spec approved in brainstorm 2026-09-27; plan pending. Closes Stage 4 once RH1a–RH1c merge; `RECONCILIATION.md` B3 then moves from `[PARTIAL]` to built.
**Roadmap home:** Stage 4 (B3), `V2_COVERAGE_PLAN.md:122-126`: "unifies Discover + recruitment settings + invitations (recruitment-as-matching, Ring 1)". The Finder half shipped as SF1 (#309–#311); this spec is the lead-side half carried by SF-1.
**Inputs:**
- `specs/2026-09-27-static-finder-design.md` (SF-1…SF-7, the `fitV2` engine and contract this reuses).
- `REDESIGN_SPEC.md` §5.6 (`:211-215`): "replaces … the recruitment settings tab + the invitations modal, unified"; recruitment is "a Ring-1 coordination feature, not a top-level peer".
- `docs/PRODUCT_MODEL.md:164`: "Listing setup + preview, join requests + applicant inbox — keep; live in static settings + a clean applicant inbox". RH-1 amends the "in static settings" half for V2.
- The V1 surface being re-homed: `components/settings/RecruitmentTab.tsx` (sub-tabs `overview | listing | requests | invitations`, `?rcsub=`), `DiscoveryTab.tsx`, `JoinRequestsPanel` + `JoinRequestReviewModal`, `static-group/InvitationsPanel.tsx`.
- CLAUDE.md § UI rules and § Product rules.

There is no mockup for this surface. Mockup 06 covers the Finder only; mockup 01's rail item reads "Static Finder — find a group / recruit".

## 1. Problem

A lead's recruiting is an active loop (post a listing, watch who asks, accept or invite, close when full), but in V2 it lives inside Settings, which is V1's body under V2 chrome (`pages/V2SettingsHost.tsx` mounts `StaticSettingsHost` unchanged):

- **The inbox is a settings sub-tab.** Pending requests reach a lead as a badge on the gear, a bell count on `/group/*` routes, and up to three attention rows on Static Home, all of which end in Settings → Recruitment → Requests.
- **Applicant fit is a stale snapshot.** `static_join_requests.fit_snapshot` is written at apply time. The SF1 engine, which explains fit with tier and reason rows, is never run from the applicant's side, so the lead sees less than the applicant saw on the Finder.
- **Listing status is cosmetic.** Discoverable means `is_public && discovery.enabled` (`routers/discovery.py:73-79`, `routers/join_requests.py:47-56`). `paused` and `closed` listings still appear in the Finder and still accept join requests, while the editor promises "Closed: hidden from Static Finder" (`DiscoveryTab.tsx:84`). The V1 overview's `STATUS_LABEL` (`RecruitmentTab.tsx:123-127`) knows only `open | limited | closed`, so `selective` and `paused` display as "Closed".
- **Section handoff races.** `openSettings({tab: 'recruitment', section})` loses to same-commit URL writes, which is why SF1c's "Post a listing" seeds `?rcsub=listing` as well (SF1 carried item b).

## 2. Rulings (owner, 2026-09-27)

- **RH-1 Home = a Recruit area inside the static.** One V2 surface holds the listing, the applicant inbox and invites. V2 Settings loses the Recruitment tab. Rejected: an inbox-only surface with the listing left in Settings (the product-model wording), and a lead mode on the Finder page.
- **RH-2 Applicants first.** Pending join requests are the headline block, each with the SF1 tier and reasons computed for the applicant. Listing state and invites sit behind it. Reverse matching (browsing players who fit) stays carried (§9).
- **RH-3 Listing status is enforced, as a public V1 fix.** `paused` and `closed` hide the listing from the Finder and reject new join requests. Existing requests are untouched. Ships in the same public release note as the `STATUS_LABEL` fix.
- **RH-4 Own route, no spine tab.** `/group/:shareCode/recruit`, reached from Static Home, the attention rows, Roster and TopBar "Invite members", the Finder's "Post a listing" and the bell. The spine stays Home · Roster · Loot · Schedule (§5.6: not a top-level peer). Rejected: a fifth manager-only spine tab (Stage 2 IA territory), and a redesigned body inside the Settings dock (still "in Settings").
- **RH-5 Approach A: re-home, reuse the editor.** The inbox, the status card and the invites block are V2-native. The listing editor is the existing `DiscoveryTab` body hosted inside the V2 page, the same seam pattern V2 Settings uses. Rejected: a V2-native editor rewrite (roughly doubles the stage, no mockup, forks editor bugs across shells).
- **RH-6 Live fit; applying is consent.** The row shows current fit from the applicant's availability template and job profiles, not the apply-time snapshot. Applicants already hand over an availability summary and a job by applying, so no visibility gate. `fit_snapshot` stays as the historical record.
- **RH-7 One redirect seam.** Under V2, every `openSettings({tab: 'recruitment', …})` call lands on the recruit route with the matching tab instead of opening the dock. The `new_application` notification href stays `/group/{code}` for V1 parity. No new notification types and no Discord webhook.
- **RH-8 Three stacked slices** (§10), run with `slice-loop`.

## 3. Page (RH1b frame, RH1c fill)

- **Route:** `/group/:shareCode/recruit`, a child of the V2 group route (`App.tsx:170`), V2 only. Managers only (`canManage`, owner or lead); a member or viewer is replaced-navigated to `/group/:shareCode`. Under V1 the path is not registered, so V1 is untouched. Admin View As follows the usual rules.
- **Header:** `PageHeader` "Recruiting". Subtitle is the listing state: "Live · Open · 3 waiting", "Live · Paused · 2 still waiting", "Listing off". A status `Select` (open / selective / paused / closed) sits in the header and saves `settings.discovery.recruitmentStatus` through `updateGroup`, so a lead can flip status without entering the editor. Legacy `limited` reads as `selective`.
- **Tabs:** `Tabs` with `useUrlTabState('rtab', ['applicants', 'listing', 'invites'], 'applicants')`. `rtab` joins the URL-param list in `navPreferences.ts`. V1's `rcsub` sections map onto them: `requests → applicants`, `listing → listing`, `invitations → invites`, `overview → applicants`.
- **Applicants tab** (§4).
- **Listing tab:** a status card on top: Live/Hidden, the status `Select` mirrored, the completion count from `CompletionChecklist` (8 items), and "Fill from current schedule" (`GET /api/static-groups/{id}/discovery/suggestions`). Beneath it `DiscoveryTab` hosted as-is, with its save, preview and checklist. Any editor fix lands in `DiscoveryTab` and reaches both shells.
- **Invites tab:** V2-native, on `stores/invitationStore.ts` and the existing `/api/static-groups/{id}/invitations` endpoints. The list shows code, role, uses (`use_count / max_uses` or unlimited), expiry, and Copy link (`/invite/{code}`). Revoke is a double-click confirm. The create form has role (`lead` offered to the owner only, matching `routers/invitations.py:115-121`), expires in 1–30 days or never, max uses 1–100 or unlimited. `?create=1` opens the form on arrival, replacing `highlightCreateInvite`. Link codes are the whole model; no email or user-targeted invites.
- **Empty states:** listing live and no requests: "No one has asked yet" with a link to the static's own Finder card. Listing off, paused or closed: the inbox says which and offers the status `Select`, since after RH-3 those states genuinely stop requests. No listing saved at all: the Applicants tab points at the Listing tab.
- **Width and mobile:** the page uses the 120rem layout, left-aligned. No mobile pass this stage, but the route must render at phone width with no horizontal scroll.

## 4. Applicants (RH1b)

Data: `GET /api/static-groups/{id}/join-requests?include_resolved=1&fit=1` (§5). Pending and `under_review` first, newest on top; a collapsed "Resolved" list (accepted, declined, cancelled) below.

A row shows:

- **Identity:** character name, job and role applied for (`selected_job` / `selected_role`, falling back to `job_interest` / `role_interest`), world, applied time. "View profile" appears when the applicant's profile visibility is `shareable` or `discoverable`.
- **Fit:** the tier `Tag` (strong / good / partial / weak / unknown) and the Finder's reason rows (role, schedule, goals, comms, bis), reusing the SF1 reason-row component rather than a copy. Times in the reason rows are in the static's listing zone, because the lead is the reader. `missing` renders the same hints as the Finder nudge ("no typical week", "no jobs").
- **Their words:** `message`, `availability_note`, `contact_discord`.
- **Actions:** Accept, Decline (double-click confirm), Mark under review. Accept keeps today's semantics (`POST /api/join-requests/{id}/accept`: membership as `member`, message fields nulled); the row then offers "Link to roster slot" (`/link-roster`), as `JoinRequestReviewModal` does today. No modal.
- **Errors:** a 409 on accept (already a member) shows the reason inline and refetches. A request resolved elsewhere disappears on the next refetch. Closing the listing with requests waiting keeps them, and the header says "2 still waiting".

## 5. Backend (RH1a)

- **Status enforcement (RH-3).** One shared `is_discoverable(group)` in `services/` replaces the two copies in `routers/discovery.py:73` and `routers/join_requests.py:47`: public, `discovery.enabled`, and `recruitmentStatus in {open, selective}` (`limited` counts as `selective`; a missing status counts as `open`, which is today's default). `POST /api/static-groups/{share_code}/join-requests` returns 409 with a plain reason for paused and closed listings. `GET /api/discovery/statics` drops them in both shells. The `recruitmentStatus` filter param keeps working on what remains.
- **Applicant fit (RH-6).** Extract the viewer-input loader from `routers/discovery.py` (roughly `:323-430`: job profiles, availability template rows, public goals, public BiS, display zone) into a `finder_fit` helper that takes a `user_id` and returns the inputs `compute_fit_v2` needs. The Finder keeps calling it for the caller. `GET /api/static-groups/{group_id}/join-requests` gains `fit: bool = False`; when set, each item carries `fit: FitV2` (the SF1 schema: `tier`, `reasons[]`, `missing[]`, `role`, `schedule`) computed for the applicant's user against this static's listing, with `asRole` = the role applied for. Coverage is still judged in the applicant's template zone (SF-2), but the helper takes a display-zone override and the join-request path forces it to the listing zone, so reason-row times read in the static's own clock (§4). OWNER-1's partial cap applies. Requests whose user has no template or no jobs get `unknown` with `missing`. Requires `require_can_manage_members`, as the list already does. `fit_snapshot` is not written.
- **Player Hub item.** `OverviewActionItem.type` (`schemas/player_overview.py:34`) gains `join_requests`. `services/player_overview.py` emits one per static the caller leads (owner or lead) with a non-zero pending-or-under-review count: title "N join requests waiting", detail the static name, href `/group/{shareCode}/recruit`. `NeedsYouCard.tsx` gains the label and icon entry (RH1c renders it).
- **V1 label fix.** `RecruitmentTab.tsx` `STATUS_LABEL` gains `selective: 'Selective'` and `paused: 'Paused'`.
- **Untouched:** invitation semantics, accept/decline/under-review/link-roster, notification types and hrefs, `discord_webhook.py`, the plugin endpoints. The listing stays JSON in `settings.discovery`, so `StaticGroupResponse.settings` is unchanged for the plugin.
- **Release note:** public, one entry: closed and paused listings now leave the Finder and stop requests; the overview status label is fixed. `CURRENT_VERSION` bumps per the `pr-checklist` rules.

## 6. Entry points and the Settings seam (RH1b seam, RH1c entry points)

- **The seam (RH-7).** In the V2 shell, a subscriber on `settingsPanelStore` (or a guard in `V2SettingsHost`) intercepts `open({tab: 'recruitment', section, highlightCreateInvite})`: it closes the store and navigates to `/group/:shareCode/recruit?rtab=<mapped section>` (`&create=1` when `highlightCreateInvite`). All current openers go through it unchanged: `NewShell.tsx:67,83`, `GroupViewContent.tsx:917`, `TopBar.tsx:90-107`, `SettingsPanelController.tsx:38` (`OPEN_SETTINGS_INVITATIONS`), `MorePage.tsx:97`, `Header.tsx:352`, `useGroupViewKeyboardShortcuts.ts:220`, `LeadingStaticRow.tsx:34-43`. A `?rcsub=` param arriving on a V2 group route is mapped and redirected the same way, then stripped. V1 sees none of this.
- **V2 Settings hides Recruitment.** `SettingsPanel` takes a shell-gated `hiddenTabs` (or equivalent) that V2 passes as `['recruitment']`; V1 passes nothing. The gear badge count moves with it; the bell's pending count on `/group/*` routes stays.
- **Static Home:** managers get one Recruiting line under the attention rows: listing state, waiting count, "Manage" → the route. The per-request attention rows keep Review, now landing on Applicants.
- **Roster and TopBar:** "Invite members" keeps copy-link when a valid invite exists; otherwise it lands on the Invites tab with `create=1`. Roster's review action lands on Applicants.
- **Finder:** `LeadingStaticRow` "Post a listing" navigates to `/group/{code}/recruit?rtab=listing` directly and drops the `?rcsub=listing` seed.
- **Notifications:** `new_application` keeps `href=/group/{share}`. When the V2 bell opens one, it opens the route's Applicants tab.
- **Naming:** "Recruiting" is the page title, `recruit` the route segment. User-facing text says "static", never "group".

## 7. Acceptance criteria

1. A `paused` or `closed` listing is absent from `GET /api/discovery/statics` for guests, V1 and V2 callers, and `POST …/join-requests` against it returns 409. An `open` or `selective` listing behaves as today; a listing with no status behaves as `open`.
2. `?fit=1` on the group join-request list returns a `FitV2` per item that equals what the applicant would get on the Finder for this listing with the same role, and `unknown` with `missing` for an applicant with no template or jobs. Without `fit=1` the response equals today's (snapshot test).
3. `GET /api/player/overview` for a lead with two waiting requests in one static contains one `join_requests` item with that count and the recruit href; a member of the same static gets none.
4. Under V2, `/group/:code/recruit` renders for owner and lead, replace-navigates a member to `/group/:code`, and does not exist under V1.
5. The three tabs are URL-synced under `rtab`; `?rcsub=requests` on a V2 group route lands on Applicants.
6. Every `openSettings({tab: 'recruitment'})` caller lands on the route under V2 and opens the dock under V1. The V2 Settings dock shows no Recruitment tab; V1's shows it with its badge.
7. An applicant row shows tier, reason rows, message and the three actions; Accept then shows Link to roster; Decline needs a second click.
8. The header status `Select` saves and the Finder reflects it on the next query.
9. Invites: create, copy and revoke work end to end; `lead` is offered to the owner only; `?create=1` opens the form.
10. Static Home shows the Recruiting line to managers only; the Needs-you card renders the new item type.
11. V1 tests for `DiscoveryTab`, `SettingsPanel.roles`, `JoinRequestReviewModal` and the legacy e2e smoke pass unchanged.

## 8. Test plan

- **pytest:** `test_discovery.py` and `test_join_requests_v2.py` for the status matrix (open, selective, limited, paused, closed, missing) on the finder list and on create; `test_discovery_fit_v2.py` for the applicant-side fit including `unknown`, the partial cap and role override; a no-`fit` snapshot; `test_player_overview.py` for the new item and its role gating; `test_permissions.py` unchanged.
- **vitest:** the route guard and V1 absence; `useUrlTabState` under `rtab` and the `rcsub` mapping; the seam for every opener (one table test); `SettingsPanel` with and without `hiddenTabs`; applicant row rendering and actions; header status save; Invites tab create/copy/revoke and owner-only `lead`; Home Recruiting line; `NeedsYouCard` new type; `LeadingStaticRow` new target; `TopBar.invite` both branches.
- **e2e:** one V2 recruit smoke walking the three tabs as a manager; `smoke.spec.ts:651-656` (V1 Settings tabs) stays.
- **Browser:** the route at DEVTST with a seeded listing, one applicant with a typical week and one without, light and dark shots for the PR.

## 9. Out of scope / carried

- **Reverse matching** (leads browsing players who fit), carried from SF1 §9.
- **Email or user-targeted invites;** link codes only.
- **A Discord webhook for applications;** `discord_webhook.py` stays schedule-only.
- **The static typical-week template as a matching input** (SF1 §9, PH3 §9).
- **Player-side language and voice preferences** (`user_languages` / `user_comms` are never loaded, `discovery.py:327-328`), so comms fit stays listing-only.
- **A V2-native listing editor** (RH-5); `DiscoveryTab` is hosted, not rebuilt.
- **Mobile,** deferred to the end-phase pass.
- **SF1 carried items (a), (c), (d)** stay on the SF1 list; only (b), the section-handoff race, closes here for V2.

## 10. Delivery

- **Three stacked PRs (RH-8):**
  - **RH1a:** backend only: status enforcement, the viewer-input extraction and applicant fit, the overview item, the V1 label fix, the public release note (§5).
  - **RH1b:** the route, guard, header, Tabs, Applicants tab, the redirect seam and the hidden V2 Settings tab (§3 frame, §4, §6 seam).
  - **RH1c:** Listing tab (status card + hosted editor), Invites tab, Static Home line, TopBar/Roster/Finder rewiring, Needs-you rendering, doc status flips (`V2_COVERAGE_PLAN.md` Stage 4 closed, `RECONCILIATION.md` B3 built, `PRODUCT_MODEL.md:164` wording).
- **Process:** each from a plan in `design/redesign/plans/`, director plan-vet first, run with `slice-loop`; PRs opened with `/ship` after the slice review, with light and dark screenshots.
- **Done for Stage 4:** all three merged; a manager in V2 recruits end to end without opening Settings; V1 changes only by the two public fixes.
