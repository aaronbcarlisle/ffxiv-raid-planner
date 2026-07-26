# V2 Coverage Plan — audit + staged plan to 100% V2 UI coverage

**Status: RATIFIED 2026-07-25 — user agreed to all recommendations (rulings recorded in §6). Per D1, Stage 0–1 implementation begins after Phase G (PR #161) merges; the Stage-1 parity matrix (D5) may be prepared beforehand (docs-only). No status cell in any other doc moves until stages are demonstrated in the running app.**

**Execution status (2026-07-25): Stage 0 ✅ COMPLETE (PRs #176/#177 — D3 notif href, A3 void-fix, mobile TopBar overlap, doc-cite fixes). Stage 1 ✅ COMPLETE (four stacked PRs, all user-merged: #178 S1+S2 nav entry w/ D7 gate · #179 chrome-context/G2/M2 seams + NotificationCenter single-mount · #180 AppChrome host + portal slots + group hoist · #181 the coverage flip: NonGroupTopBar + route scope + Profile/AdminLayout seams + e2e pins). Acceptance: director row-by-row sweep of the signed parity matrix (all rows satisfied), plan-§5 live-validation checklist executed in the running app (three personas × both shells × both viewports, 0 console errors). The user's 100% chrome-coverage metric is met: nothing clickable in V2 lands in V1 chrome. The v2 opt-in remains DARK behind the D7 admin gate — un-gating is a separate user decision (§6 D7). Known cosmetic carry-forwards: /admin v2 spurious ~17px scrollbar (legacy ~9px, same class; Stage-5 admin fit) · M6 desktop pre-hydration skeleton sits in the top bar while the authed menu resolves to the rail footer.**

Produced 2026-07-25 from a three-track audit (route/shell inventory · V2 exit-affordance sweep · sanctioned-plan docs review) plus an `xivrp-director` plan vet (verdict: **PARITY-GAP — approve with required changes**; every required change is folded in below and marked `[DIR]`).

---

## 0. Directive & success metric

User (2026-07-25): everything inside the static works in V2; everything outside lands in V1. Success metric: **"anything that can be clicked, navigated to, or reached via V2 should have 100% coverage of V2 versions of all navigation, pages, etc."** This directive resolves the previously-deferred S3/Person-layer decision in favor of coverage-first (see §4 re-sequencing record).

Standing constraints that bind every stage: **zero V1 impact** (legacy byte-for-byte frozen, bugfix-only); **no surface replacement without a user-reviewed affordance-parity matrix** (ROLLOUT_ROADMAP §8, permanent); no "Coming soon" stubs; "done" = demonstrated in the running app.

---

## 1. Audit — where V2 ends today

### 1.1 Route inventory

29 routes total (`App.tsx:156-197`). **Exactly 1** can render V2: `/group/:shareCode` via `GroupRoute`. 26 always render legacy `Layout`; 3 are bare/chrome-less (`/auth/callback`, `/invite/:inviteCode`, `/plugin-auth`). There are **no nested routes** under `/group` — every sub-view is a query param (`?tab=`, `?sub=`, …). Layout wraps V2 too: `NewShell` renders inside Layout's `<main>`, with only `Header` + `SettingsDockToggle` suppressed (`Layout.tsx:26,57,82`).

| Route class | Routes | Shell today |
|---|---|---|
| Static | `/group/:shareCode` | dual (GroupRoute) |
| Person | `/profile`, `/profile/:shareCode`, `/dashboard` (dead/unlinked) | legacy always |
| Discovery | `/discover` | legacy always |
| Admin | `/admin` + 4 children | legacy always |
| Docs | `/docs` + 11 pages + 5 redirects (+ duplicate `/design-system` mount) | legacy always |
| Marketing | `/` | legacy always |
| Bare | `/auth/callback`, `/invite/:code`, `/plugin-auth` | none |

### 1.2 The exit affordances (37 sites → 12 destinations)

Every affordance below leaves `/group/…` and therefore lands in V1 chrome, regardless of shell preference:

| Destination | Sites (source) |
|---|---|
| `/profile` (Player Hub) | AppRail entry (`NewShell.tsx:311`), UserMenu item, JoinRequestModal ×4 (new-tab, incl. `?tab=sync\|share\|availability`) |
| `/profile?tab=statics` (My Statics) | StaticPicker footer (`StaticPicker.tsx:158`), UserMenu Shift+S item, ShellContentStates error CTA, Leave-Static redirect (`GroupViewContent.tsx:1193`), Delete-Static redirect (`StaticTab.tsx:132`), 2 keyboard bindings (Shift+S) |
| `/profile?tab=availability` | Schedule "Your availability → Edit" (`Schedule.tsx:460`), AvailabilityGrid modal link (`:648`), QuickFillHelper (`:157`) |
| `/profile/:shareCode` | JoinRequestsPanel + JoinRequestReviewModal (new-tab) |
| `/discover` (Static Finder) | AppRail entry (`NewShell.tsx:321`) |
| `/admin`, `/admin/statics` | UserMenu item, Ctrl+Shift+S |
| `/dashboard` | backend notification href (`join_requests.py:749` — inconsistent with `:587` which uses `/group/{code}`) |
| `/docs*` ×10 | UserMenu docs section — raw `<a href>` full reloads (`Dropdown.tsx:183`, deliberate for middle-click) |
| `/docs/release-notes` | synthetic "What's new" notification |
| `/` | logout (intentional) |
| `/invite/:code` | copied invite link (bare route — fine) |

### 1.3 In-V2 holes (not exits, but coverage gaps)

- **Spine covers 4 of 7 PageModes** — `goals`/`plugin`/`more` reachable only via ⌘K, deep-link, or mobile bottom nav (sanctioned fix = B4/B5/B6/B7 re-homing, not nav additions).
- **`MobileBottomNav` is not shell-gated** (`GroupViewContent.tsx:1238`) — the legacy 6-tab nav renders inside V2 on mobile today.
- **AppRail is `hidden sm:flex`** — mobile V2 has no user menu; the More page's "Switch to classic UI" is the only mobile escape (load-bearing for B4).
- NewShell logo is not a link (no home affordance); no static-creation wizard entry exists in V2.
- Copy-link inconsistency: `Loot.tsx:246` pins `shell=v2`, `Roster.tsx:291` doesn't (see D4 — with S2 session-stickiness, pinning now captures the recipient's whole tab).
- `NotificationCenter` is mounted twice (`NewShell.tsx:365` + `UserMenu.tsx:357`).
- Doc-path drift: `CLAUDE.md` + `docs/README.md` + director charter cite `docs/REDESIGN_SPEC.md`; the file lives at `design/redesign/REDESIGN_SPEC.md`.

---

## 2. Ownership boundary (the "copy V1" question, answered)

A wholesale V1→V2 fork was considered and rejected: it duplicates bugfix maintenance, makes silent divergence the default (the exact failure the July pivot corrected), and buys no progress — the rework per surface is identical either way. Instead the boundary is explicit and one-directional:

1. **Shared forever:** stores, hooks, lib, gamedata, primitives/design system. One behavior layer, two skins.
2. **Legacy-owned, frozen:** legacy chrome + not-yet-reworked page bodies. V2 may *host* them (Stage 1) but never edits them beyond shell-gated seams with sanctioned-edit justification.
3. **V2-owned:** chrome + slot surfaces — grows one surface at a time (the slot pattern *is* "copy then rework," done lazily). End state = Phase H deletes legacy files outright.

The "missing nothing" guarantee comes from inventories (this doc §1 + per-surface parity matrices), not from a copied folder. Standing debt note: `GroupViewContent`'s `!slots?.X` conditionals are the messiest V1↔V2 tie (the MobileBottomNav leak is its product); as Stages 2–4 rework surfaces, V2 stops consuming its legacy body paths and a V2-own content host gets extracted when the conditionals shrink (tracked in Stage 2).

---

## 3. The plan

**Design principle:** don't retarget 37 links — make their destinations render V2. One chrome, all routes; the exit list collapses to zero by construction, and pages keep full function (no stubs, body-level parity by construction).

### Stage 0 — decisions + hygiene (small, parallel)

- **D1 ruling (default: after Phase G).** ROLLOUT_ROADMAP §1 says B–F land as PRs to main after G; PR #161 is open with 2 unchecked user-owned gates. Stacking more on foundation grows an already-huge diff — requires explicit user override. `[DIR]`
- **D3 ruling:** backend accepted-notification href `/dashboard` → `/group/{share_code}` (`join_requests.py:749`). **V1-visible** — needs ruling + release-note entry; not a silent "data fix". `[DIR]`
- **D4 ruling (recommended: strip):** shared copy-links strip `shell` — align `Loot.tsx:246` **down** to Roster's behavior. With S2 landed, a pinned `shell=v2` link session-sticks the recipient's entire tab. `[DIR]`
- Ring-0 owed items run as parallel micro-slices per RECONCILIATION "Next moves": A3 void-fix, mobile TopBar overlap.
- Fix stale `REDESIGN_SPEC.md` path cites (CLAUDE.md, docs/README.md, director charter).

### Stage 1 — V2 App Chrome on every route (B8 completion; the coverage move)

When `resolvedShell === 'v2'`: all Layout-hosted routes render V2 chrome — AppRail (real `isActive` for Player Hub/Static Finder; logo becomes a home link) + a slim non-group TopBar — hosting the **existing page bodies unchanged**. Legacy/no-param users stay byte-identical.

**Pre-code hard gate `[DIR-1]`: a chrome affordance-parity matrix, per route class, user-reviewed before any implementation.** Rows: legacy `Header` desktop + mobile (incl. Discord link `Header.tsx:372`, GitHub link `:383`, ContextSwitcher Player-Hub⇄Static segments `:236`, mobile settings gear + join-request badge `:329`), `ProfileSidebarNav` 7 entries + collapse key + UserMenu footer, `ProfileBottomNav`, `AdminSidebar`, docs `NavSidebar`, and a guest/logged-out row. Every row KEPT / RE-HOMED / DROPPED with destination.

Scope & structure requirements (all `[DIR]`):

1. **Single chrome host** with slots, living in `src/pages/**` (boundary-legal: `components/layout/**` is `shell` type and must not import `person`/UserMenu; pages are exempt). `NewShell`'s rail/TopBar hoist **into** it; the group route supplies `TopBar`+`Spine` slots. Two parallel hosts are forbidden (the "update one, miss six" failure).
2. **Route-class scope:** v2-chromed = Person + Discovery + Admin + Docs + `/dashboard`. **Excluded:** `/` (marketing — legacy Header already self-strips there; no coverage benefit) and the 3 bare routes.
3. **Profile keeps `ProfileSidebarNav` in Stage 1** (accepted temporary double-rail, resolved at Stage 3). Suppressing it drops 7 destinations incl. My Statics — the founding complaint. No suppression without re-presentation.
4. **Guest branch:** slim TopBar renders `LoginButton` for logged-out users (UserMenu returns `null` for guests; V1's Header shows login on every non-`/` route; guests *can* be on v2 — TryNewUiBanner has no auth gate).
5. **The v2 Layout branch must still mount** `ViewAsBanner`, `SettingsPanelController`, `GlobalSettingsPanel`, `KeyboardShortcutsHelp` (silent loss here is type-invisible).
6. **`#main-content` exists on every v2-chromed route** (AppRail's SkipLink targets it; today it exists only in NewShell).
7. **Chrome sits outside `PageTransition`** (else the rail fades on every navigation).
8. **Admin fitting work:** `AdminLayout.tsx:43` hardcodes `min-h-[calc(100vh-4rem)]` (legacy header height) and nests a second `<main>` — must be shell-gated-adjusted for the `h-14` v2 TopBar.
9. **Mobile:** a slim v2 mobile top bar for non-group routes (rail is desktop-only) — also gives mobile V2 a user menu. In-static mobile nav (the MobileBottomNav leak) is deferred to Stage 2/B7, since removing it without a designed v2 mobile nav removes mobile nav entirely.
10. **NotificationCenter single-mount** — dedupe before the rail mounts UserMenu app-wide.
11. **Deferred out of Stage 1:** the `Dropdown.tsx` `<a href>`→SPA change (frozen primitive, deliberate middle-click support; a full reload now lands in v2 chrome anyway) and the legacy-UserMenu `isGroupRoute` relaxation (D2 ruling — V1-visible).
12. **e2e gate additions:** retarget `smoke.spec.ts:677-679` (Lodestone flow clicks Profile's sidebar), and add a per-suite `ui_shell` reset for the dev owner (account-level shell mirroring is a cross-run contamination vector — Phase R precedent).

**Result:** the user's 100% metric is met at chrome level — nothing clickable in V2 lands in V1 chrome. Page bodies are honest legacy bodies pending their per-surface rework.

### Stage 2 — in-static IA collapse (B4→B7, sanctioned order resumes)

B5 Goals→Progress-Engine tracks · B6 Plugin→Settings/Player Hub · B4 More dissolution (**first** re-homing the mobile classic-UI escape and Exports/Activity-Log) · B7 remove off-spine reachability + replace `MobileBottomNav` with a v2 4-tab mobile nav (fixes the leak). Standing item: begin V2 content-host extraction as `GroupViewContent` conditionals shrink (§2).

### Stage 3 — Player Hub as a real V2 surface (B2)

Close REDESIGN_SPEC §11 open decision #6 with the user (front-door vs light personal home) · analytics pass on profile-tab usage (roadmap §5.0 pattern) · full affordance-parity matrix for Profile's 7 sub-views + Dashboard/`MyStaticsPanel` · build per REDESIGN_SPEC §5.5 with mockup-05 re-validation · absorbs My Statics + `/dashboard` (route → redirect) · resolves the Stage-1 double-rail. **The availability flip-blocker + one-editor mandate land here** (re-hosted week editor or the Person→Static aggregation pipe).

### Stage 4 — Static Finder (B3)

Same discipline per §5.6 + mockup-06 re-validation; unifies Discover + recruitment settings + invitations (recruitment-as-matching, Ring 1).

### Stage 5 — Docs & Admin fit-and-finish

Docs: light restyle inside v2 chrome (pulls Phase F's docs scope in). Admin: **stays a separate gated area** (PRODUCT_MODEL §5 — no port mandate) but v2-chromed from Stage 1; deeper restyle optional; admin boundary-lint constraints noted (ring→admin edges are fail-on-new).

### Stage 6 — ⌘K actions (B1)

Unchanged, last.

---

## 4. Re-sequencing record

Stage 1 deliberately pulls **B8 (chrome everywhere) ahead of B4–B7 (IA collapse)**, justified by the user's coverage metric; Stages 2+ restore the RECONCILIATION ring order (IA collapse → B2/B3 → B1). ROLLOUT_ROADMAP's "Person layer after Phase H" line is *intent, not status*, and is superseded by the user's 2026-07-25 directive. On ratification, RECONCILIATION "Next moves" + ROLLOUT_ROADMAP get a dated re-sequencing note pointing here — intent only, no status changes. `[DIR]`

---

## 5. Hard gates (every stage)

1. Zero V1 impact: legacy/no-param path byte-identical; full suites + `pnpm build` + design-system check green.
2. `xivrp-director` change-review on every slice (plan-fidelity + parity).
3. Live browser smoke in both shells before "done" is claimed; screenshots embedded in PRs with UI changes.
4. V1-visible edits (frozen files, backend hrefs) each carry a sanctioned-edit justification + release-note entry.
5. Parity matrices are user-reviewed **before** implementation, per the permanent standing rule.

---

## 6. Decision log — rulings recorded 2026-07-25 (user: "I agree with your recommendations")

| # | Decision | Ruling |
|---|---|---|
| D1 | Where coverage work lands | **After Phase G merge** — Stage 0–1 implementation waits for PR #161; slices land as PRs to main |
| D2 | Relax legacy UserMenu `isGroupRoute` gate ("Try the new UI" on non-group V1 routes) | **Deferred** (V1-visible; revisit only if wanted) |
| D3 | Backend notification href `/dashboard` → `/group/{share_code}` | **Approved** — lands post-G with sanctioned-edit justification + release note |
| D4 | Shared copy-links and `shell` param | **Strip `shell`** (align `Loot.tsx:246` down to Roster) — post-G |
| D5 | Stage-1 chrome parity matrix | **SATISFIED 2026-07-25** — `specs/stage1-chrome-parity-matrix.md` director-verified and user-signed ("approve all": M1–M4, G1, G2, G4 approved as recommended) |
| D6 | (Stage 3) REDESIGN_SPEC §11 open decision #6: Player Hub as front door vs light personal home | **Open** — decide at Stage-3 kickoff |
| D7 | Launch gate (added 2026-07-25, user-approved) | **The Phase-G merge ships the v2 opt-in DARK**: `TryNewUiBanner` is admin-gated so regular users/guests can't enter v2 pre-coverage; admins dogfood in prod; `?shell=v2` stays as a power-user escape hatch. **Un-gate criterion = Stage 1 landed** ("anything reachable from v2 stays in v2") **+ the Ring-0 blemishes** (A3 void-fix, mobile TopBar overlap). Phase H's opt-in-availability clock starts at un-gate. When `redesign/v2-nav-entry` merges, S1's user-menu "Try the new UI" item gets the same gate. |

The §2 ownership boundary (no wholesale V1 fork; shared behavior layer / frozen legacy-owned / growing V2-owned) is ratified alongside.
