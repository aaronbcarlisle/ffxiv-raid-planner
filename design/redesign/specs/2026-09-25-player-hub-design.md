# Player Hub (V2) — design

**Status:** approved in brainstorm 2026-09-25 (sections 1–4); this written spec awaits the user's review.
**Roadmap home:** Stage 3 (B2), `ROLLOUT_ROADMAP.md:116-118` — "Player Hub as a real V2 surface … resolves the Stage-1 double-rail".
**Canvas:** `claude.ai/artifact/G5bWkMadnjCmSiUbZ8YMVb`, page "Player Hub" (today + options A/B/C; A chosen).
**Inputs:** `docs/PRODUCT_MODEL.md` §3.1 (two layers), `REDESIGN_SPEC.md` §5.5, `specs/systems-flow-map.md` (F-01, F-02, R1, L-2), `mockups/05-player-hub.html`, `DESIGN_SYSTEM.md` §3.9 (context rail — locked), §3.22 (AttentionRow), CLAUDE.md § UI rules.

## 1. Problem

Under V2 chrome, `/profile` renders V1's `Profile` page unchanged except its footer menu (`Profile.tsx:82-91`). It carries its own 7-item sidebar (`ProfileSidebarNav`, `Profile.tsx:67,307`) inside a centered `max-w-[160rem] mx-auto` container (`:305`), so the page shows **two navigation columns** — the app rail and a floating sub-rail — and reads as an app inside the app. The rail's Player Hub entry uses a **Home** glyph (`pages/chrome/AppChrome.tsx:120-128`), colliding with a static's first tab, also "Home". Mockup 05 had no sub-rail; the shipped page never followed it.

## 2. Rulings (user, 2026-09-25)

- **H-1 (the Hub's job):** glance first — a short "you across your statics" summary, with setup areas as named sections of the same page family. Closes open decision **D6** (`REDESIGN_SPEC.md:398`): the Player Hub is the player's dashboard; it is the landing page only for static-less users (L-2, unchanged).
- **H-2 (entry point):** the rail's first slot becomes **your character portrait** (Lodestone `avatarUrl` of the main character, initials fallback), tooltip "Player Hub". This **amends F-01** (which removed the rail slot; the removal was never built). The Home glyph goes.
- **H-3 (navigation model):** option A — an identity header plus a tab bar, the same pattern as a static. No secondary sidebar; left-aligned on the 120rem cap.
- **H-4 (Overview):** the layout in §4; the **Activity** card is dropped (the notification bell owns events; "Needs you" owns actions).
- **H-5 (slicing):** two slices — PH1 structure (no new API), PH2 "Needs you" (new endpoint).
- **H-6 (tabs):** Overview · Characters & gear · Availability · Tracking · Sharing, mapped per §5.

## 3. Structure

- **Route:** `/profile` stays. Under V2 chrome (`useInV2Chrome()`), `Profile` renders a new V2-native `PlayerHub` page; the V1 path is untouched. One seam, the way the static tabs were switched.
- **Tabs:** `useUrlTabState`, `?tab=overview|characters|availability|tracking|sharing`, default `overview`. Legacy ids redirect (today's map is `Profile.tsx:42-48,106-111`): `sync`, `jobs-gear`, `jobs`, `gear`, `characters` → `characters`; `preview`, `share` → `sharing`; `collections`, `goals` → `tracking`; `statics` → `overview`. `focus=availability` keeps scrolling to the editor. About 25 inbound links (`UserMenu`, `AppChrome`, `ContextSwitcher`, `Home`, `Schedule`, `JoinRequestModal`, `SplitClearAssignmentBoard`, `AvailabilityGrid`, `OverviewTab`, …) keep working without edits.
- **`/dashboard`:** under V2 chrome it redirects to `/profile?tab=overview` (the same `MyStaticsPanel` it renders is folded into Overview). V1 unchanged.
- **Top bar:** breadcrumb `You › {main character name}`.
- **Identity header** (replaces PageHeader on this surface; it holds the page `<h1>`): portrait, character name, home world, a summary line (`N characters · N jobs at max level · member of N statics`), and status chips (Discord linked, plugin synced {relative time}, profile visibility).
- **Rail (H-2):** `AppChrome`'s first entry renders the portrait (`SafeAvatar` + `InitialsAvatar` fallback) with the rail's existing active indicator on `/profile`. The rail needs the main character's `avatarUrl` at app load — one small profile-summary fetch when signed in; guests keep Static Finder only (today's `user &&` gate). The Discord footer menu is unchanged.

## 4. Overview (glance first)

One grid, the same tracks as Home after E2 (`minmax(0,1.15fr) minmax(0,1.15fr) minmax(0,1fr)`), main area spanning two columns:

- **Needs you · across your statics** (PH2): `AttentionRow` rows — what, a detail line, the static tag, one action that deep-links into that static (RSVP → Schedule; you're #1 on a pending drop → Loot). Empty: "Nothing needs you right now." In PH1 the card is absent (not an empty shell).
- **Your statics:** one row per static — initials, name, your role, current tier, member count (PH1; PH2 adds next session, floors cleared, average BiS), **Enter →**, and a kebab with the per-static actions `MyStaticsPanel` offers today (so nothing is dropped). The list ends with **Create or join a static**. With no statics: a prominent empty state with **Create a static** and **Find a static** (the L-2 landing).
- **Side column:** Characters (main + alts, Manage → Characters & gear) · Your availability (one-line summary, Edit → Availability) · Profile setup (progress + the single next step, client-derived as today `Profile.tsx:287-297`; hidden when complete).
- **Removed:** the "Profile status" tile strip, the four "Raider snapshot" cards, Activity.

## 5. Tabs (PH1 moves today's bodies in unchanged)

| Tab | Body (today) | Layout |
|---|---|---|
| Characters & gear | `SyncCenterTab.tsx:66` + `JobsGearTab.tsx:43` | two stacked sections, **Sync** then **Jobs** (no sub-tabs: ≤ 2 levels) |
| Availability | `PlayerAvailabilityTab.tsx:33` (`PersonalAvailabilityEditor`) | as is |
| Tracking | `GoalsTab.tsx:24` + `CollectionsCenterTab.tsx:1` | **Goals** above **Collections**; Collections keeps its own Priorities/Browse toggle (`coll=`) as the second level |
| Sharing | `PreviewShareTab.tsx:38` | as is |

A later slice may merge Sync + Jobs into one card per character; out of scope here.

## 6. Data

- **PH1:** existing stores only — `usePlayerProfileStore` (profile, characters, jobProfiles, gearSnapshots, goals), `usePersonalAvailabilityStore`, `useCollectionIntentStore`, `useStaticGroupStore` (groups). No backend change except, if needed, a lightweight profile summary for the rail (prefer the existing profile fetch).
- **PH2:** `GET /api/player/overview` → `{ statics: [{ id, shareCode, name, role, tierName, memberCount, nextSession?, floorsCleared?, avgBisPct? }], actionItems: [{ type, staticId, staticName, title, detail, href }] }`. Types at launch: `rsvp_pending` (a session in the next 7 days with no RSVP from your linked player in that static) and `loot_priority` (you are #1 on this week's unassigned drop, via the existing priority calculator, `backend/app/services/priority_calculator.py`). Computed per request over the user's memberships; permission-scoped like the static endpoints. **Deferred:** "Your BiS is out of date" — no clean signal for "items obtained since your last import" exists; define the rule before building it.
- Loading, empty and error states follow `ShellContentStates` patterns.

## 7. Acceptance criteria

1. Under V2 chrome `/profile` shows one navigation column (the rail), the identity header, and the five tabs; no `ProfileSidebarNav`. Under V1, `/profile` is byte-identical to today (chrome test pinned both ways, like `Profile.rail.test.tsx`).
2. The rail's first entry is the portrait (or initials), active on `/profile`, with no Home glyph; guests see Static Finder only.
3. Every legacy `?tab=` id and `focus=availability` land on the right tab/section; `/dashboard` under V2 lands on Overview.
4. Overview renders Your statics (with the per-static actions and Create/join), the three side cards, and nothing from §4 "Removed"; the static-less empty state offers Create and Find.
5. Each tab renders today's body with its behavior unchanged (existing body tests stay green unedited).
6. Content is left-aligned on the 120rem cap; headings go h1 (identity) → h2 (cards/sections); light and dark both verified.
7. PH2: the endpoint returns only the caller's statics and items; each action item deep-links correctly; empty and error states render.

## 8. Test plan

- Unit/integration: PlayerHub tab routing + redirects; Overview composition and the static-less state; rail portrait/fallback/active state; `/dashboard` redirect; V1 `Profile` unchanged under V1 chrome.
- Backend (PH2): pytest for the endpoint (permission scoping, `rsvp_pending` window edges, `loot_priority` from the calculator).
- Browser pass per slice (dev-auth → `/profile?shell=v2`), both themes, 1440 and 2560; the L-2 case with a static-less dev user.

## 9. Out of scope / carried

- Merging Sync + Jobs per character; the BiS-staleness rule; mobile (Phase P); Static Finder's rework (Stage 4, B3 — its left-align ships in E2 per U-9).
- `design/redesign/specs/systems-flow-map.md` F-01 is amended by H-2 (write-back when PH1 lands).
