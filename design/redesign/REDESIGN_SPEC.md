# REDESIGN_SPEC.md

**XIV Raid Planner — Information Architecture, Design Language & UX Flow**
**Tier-1 canonical · pairs with `PRODUCT_MODEL.md`**

> **Status:** Draft for review · 2026-06-27
> **Authority:** This document is the canonical source of truth for *how the app is structured, how it looks, and how a user moves through it*. `PRODUCT_MODEL.md` owns *what the app is and why*; this owns *the shape of the experience*. Where the two ever conflict, `PRODUCT_MODEL.md` wins on vision, this wins on structure.
> **Scope:** Information architecture, navigation model, design language/tokens, component conventions, the per-screen blueprint, and the end-to-end UX flow graph. The phased build sequence lives in the roadmap (separate doc); the atomic component API stays in the design system.

---

## 0. How to read this

The spec is organized outside-in: principles → the model in one diagram → the navigation backbone → the design language → each screen → the flows that connect them → what's new vs. reused → the open decisions. If you only read three things, read **§2 (the model in one picture)**, **§3 (the navigation backbone)**, and **§9 (the UX flow graph)** — those three carry the redesign.

A short vocabulary note, because precise words are half the fix (see the glossary, §10): **Static** = a raid group. **Track** = something a static is progressing through (the savage **Tier** is the flagship track). **Loot** = the domain of distributing drops. **Log** = a *verb*, never a place. **Week** = the unit the whole loop runs on.

---

## 1. Design principles (the bar every screen must clear)

These are the existing design-system principles (*Data First, Quiet Confidence, Clear Hierarchy, Consistent Language*) made operational as **ten rules**, each tied to a real failure in the current app. A screen that violates one of these is wrong even if it looks fine.

1. **IA mirrors jobs-to-be-done, not the data model.** Users think *"set up the roster," "who gets this drop," "when do we raid"* — not `TierSnapshot` / `loot-log` / `page-ledger`. Nav labels name jobs.
2. **One home per task; one canonical way to do it.** Power gets a *fast path* (⌘K), never a *second place*. This is the single rule that kills "10 ways to the roster, 16 ways to log loot."
3. **≤2 levels of navigation depth.** The current "who needs this drop" lives at *Loot Log → Priority → Who Needs It* — three clicks. The core action must be first-class.
4. **Information scent.** A label predicts what's behind it. "Loot Log," "Tracking," "More," and "Overview" all fail this today.
5. **Recognition over recall; honest affordances.** Clickable looks clickable; text never secretly navigates.
6. **Progressive disclosure.** Simple by default, power on demand. This is *the* lever for "easy for a new member, powerful for a veteran lead."
7. **Feedback & forgiveness.** Clear state, undo, confirm-before-destroy. (The current double-click-confirm is good — keep it.)
8. **Speed for experts.** A command palette + surfaced shortcuts beat redundant buttons.
9. **One design system, enforced.** Tokens are law; illegal UI is unrepresentable; the lint guard stays.
10. **Components are owned, reusable units.** A contributor adds a feature in *one* place, not six. (The forked recipient picker — `QuickLogDropModal` vs `AddLootEntryModal` — is the cautionary tale.)

---

## 2. The model in one picture

The app is a **progression tool**, structured as a static's **weekly loop**, powered by **one Progress Engine**, served at **two layers** with roles, and growing in **concentric rings**. Everything below is just this diagram made navigable.

```
  PERSON LAYER  (your front door — identity, characters, availability, the statics you're in)
        │  you enter a static ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  STATIC LAYER  (a shared workspace · lead/member/viewer = roles, not apps)│
  │                                                                           │
  │     THE WEEKLY LOOP  (the week is the clock everything runs on)           │
  │   ┌───────────────────────────────────────────────────────────────────┐  │
  │   │  ROSTER ──▶ SCHEDULE ──▶ [ RAID ] ──▶ LOOT ──▶ PROGRESS            │  │
  │   │   who         when         clear      who gets   how close to BiS  │  │
  │   └───────────────────────────────────────────────────────────────────┘  │
  │                                                                           │
  │     ONE PROGRESS ENGINE  (target → per-member status), many TRACKS:       │
  │        • Savage Tier  → flagship track: full BiS board + loot priority    │
  │        • Ultimate     → lighter track: per-member clears                  │
  │        • Mount farm   → lighter track: per-member count                   │
  │        • Gear funnel  → lighter track: who's funnelling to whom           │
  └─────────────────────────────────────────────────────────────────────────┘

   Rings (roadmap order, not nav order):
     Ring 0  core loop (protect & perfect)   Ring 2  intelligence (FFLogs)
     Ring 1  coordination (schedule, recruit, strats)   Ring 3  long game (mounts, ults, alts)
```

**The scalability contract (from `PRODUCT_MODEL.md`, restated here because the IA enforces it):** every new feature declares **(a) its layer** — Person or Static — **(b) its ring/track**, and **(c) woven-or-parked** — is it threaded into the spine, or a place you visit. If it can't declare all three, it doesn't ship. *This is what stops the swiss-army-knife sprawl.*

---

## 3. The navigation backbone

**Decision (locked): Jobs nav + ⌘K command palette + a layered simple→power UI.** One structure, power layered *onto* the clean default, never bolted beside it. Rejected alternatives and rationale live in the brainstorm transcript; this section is the build target.

### 3.1 Three navigation surfaces — and *only* three

The current app has **four** competing nav systems (left rail, header context-switcher, settings slide-out, and the "More" card grid). The redesign has exactly three, each owning a distinct altitude:

| Surface | Altitude | Owns | Persistence |
|---|---|---|---|
| **Context rail** (left, ~72px) | Person layer | *Where am I / who am I* — personal home, Player Hub, Static Finder, the statics you're in, you | Always present |
| **Top bar** (inside a static) | Static context | *Which static / which track / which week* + ⌘K + notifications + settings + theme | Present inside a static |
| **In-static spine** (horizontal tabs) | The jobs | *The weekly loop* — **Home · Roster · Loot · Schedule** | Present inside a static |

There is **no fourth surface.** The "More" page is deleted; its contents are re-homed (§7). Settings is reachable one way (top-bar gear, role-scoped). Recruitment, plugin, history, split planner each get exactly one home.

### 3.2 The spine: four tabs, not five

```
   Home  ·  Roster  ·  Loot  ·  Schedule
```

**"Gear" is not a tab.** It was a fourth view of data that already lives in Roster, Loot, and Home — the textbook "label with no scent / no unique home." Its content is re-homed into three purposeful places (§3.3). **"Log" is not a tab** either — it's a verb, expressed as action buttons inside Loot. Each remaining tab owns one job, with a verb you can say aloud:

| Tab | Owns | Say it as | Default sub-view |
|---|---|---|---|
| **Home** | this week at a glance | "check what's up this week" | the weekly-loop dashboard |
| **Roster** | the people + their gear toward BiS | "set up players / see who needs what" | **Cards** (toggle to **Board**) |
| **Loot** | distributing drops: priority + logging + history | "see who's up next / record a drop" | **Priority** (tabs: Priority · History) |
| **Schedule** | when you raid + availability | "find raid time / RSVP" | this week's session |

Depth budget: **≤2 levels.** Tab → at most one sub-view (a toggle or a segmented control). Anything deeper is a design smell.

### 3.3 Where the old "Gear" content goes

| Old gear content | New home | Why |
|---|---|---|
| The gearsheet matrix (rows = players, cols = slots) | **Roster → Board** view (toggle from Cards) | Gear *is* the roster's state; this is the bird's-eye power view, kept and loved |
| "Who needs this slot" for a drop | **Loot → Priority** (first-class) | It's a distribution question, ≤2 deep |
| At-a-glance BiS readiness | **Home** readiness card | It's a summary — exactly why it isn't its own tab |
| Per-member BiS detail | **Roster → player detail** | Lives with the person it belongs to |

### 3.4 The command palette (⌘K)

The single power fast-path. It is an *additive* layer — every action in it has a real home in the UI; ⌘K is the shortcut, never the only route (rule 2). Scope: **go anywhere** (jump to any tab/screen/player), **do anything** (log a drop, log the week, RSVP, who-needs-X), **switch context** (static, track, week). A persistent `⌘K` affordance lives in the top bar so it's discoverable, not buried (the current keyboard-shortcuts help modal is where shortcuts go to hide).

---

## 4. Design language

**Verdict: keep the visual identity, enforce it.** The diagnosis was never the look — the dark theme, teal accent, FFXIV role colors, and Exo 2 / Inter type are a coherent asset. The disease is IA + component ownership + *conformance* (≈460 arbitrary `text-[Npx]`, ≈181 inline hardcoded colors bypassing tokens). So: **new skeleton, same skin, enforced.**

### 4.1 Foundations (verbatim from `frontend/src/index.css`, mirrored in `design/mockups/tokens.css`)

**Surfaces — a six-step depth ladder** (everything sits on exactly one of these; no ad-hoc grays):

| Token | Dark | Role |
|---|---|---|
| `--color-surface-base` | `#050508` | app background |
| `--color-surface-raised` | `#0a0a0f` | rails, top bar |
| `--color-surface-card` | `#0e0e14` | cards |
| `--color-surface-elevated` | `#121218` | elevated cards / popovers |
| `--color-surface-overlay` | `#18181f` | modals, menus |
| `--color-surface-interactive` | `#1e1e26` | inputs, hover targets |

**Accent — teal, used sparingly** (*Quiet Confidence*): `--color-accent #14b8a6`, hover `#2dd4bf`, deep `#0891b2`, dim `rgba(20,184,166,.15)` for active backgrounds, contrast `#052e2b` for text-on-accent. Accent marks *the one primary action / the active nav item* — not decoration.

**Role colors (FFXIV standard)** — the app's most recognizable signal, used for player identity, party grouping, and progress bars:

| Role | Token | Hex |
|---|---|---|
| Tank | `--color-role-tank` | `#5a9fd4` |
| Healer | `--color-role-healer` | `#5ad490` |
| Melee | `--color-role-melee` | `#d45a5a` |
| Ranged | `--color-role-ranged` | `#d4a05a` |
| Caster | `--color-role-caster` | `#b45ad4` |

**Gear-source colors** (the legend on every gear/progress bar): raid `#f87171` · tome `#2dd4bf` · base-tome `#60a5fa` · augmented `#fcd34d` · crafted `#fb923c`.
**Membership** (who-can-do-what at a glance): owner `#14b8a6` · lead `#a855f7` · member `#3b82f6` · viewer `#71717a` · linked `#f59e0b`.
**Status:** success `#22c55e` · warning `#eab308` · error `#ef4444` · info `#3b82f6`.

**Type:** display **Exo 2** (600–800, headings/numbers, tight `-0.01em`), body **Inter** (400–700), mono JetBrains for IDs/keys. **Readable floor: 12px (`text-xs`); 9px is the hard floor for badge counts only** — the lint rule (`no-tiny-text`) is law; the sub-9px badges in PR #154 were the last offenders.

**Radii:** `sm 6 · base 8 · lg 12 · xl 16 · pill 999`. **Light theme** is a full token override under `[data-theme="light"]` — every color above has a light counterpart; light mode is a first-class citizen, not an afterthought.

### 4.2 Layout system

- **Width:** the app's DNA is *wide* (old layout used 120rem). Content centers within `min(94vw, 2160px)` so ultrawide reads as *designed*, not as a narrow column floating in dead space.
- **The two-region dashboard pattern** (used on Home, reusable elsewhere): an **actionable** zone (left, ~1.85fr — things that need a decision) and an **ambient** zone (right, ~1fr — things you passively consume). Collapses to a single column below 1180px → mobile-ready by construction.
- **Spacing rhythm:** 8px base grid; card gaps 14px; section margins 8–18px. Consistency here is what makes screens feel like one app.

### 4.3 The conformance contract

Three guarantees, all CI-enforced (this is Plan L's philosophy, kept): **(1)** colors come only from tokens — no inline hex; **(2)** text never goes below the 12px readable floor (`text-xs`); 9px is the hard floor for badge counts only; **(3)** shared interactions use the shared component — one `Select`, one `Button`, one recipient picker. `pnpm check:design-system` is the gate.

---

## 5. The screen blueprint

Each screen below is specified as: **job it owns · what's on it · what it replaces · new components it introduces.** The Home screen is built (`design/mockups/01-static-home.html`); the rest are specified here for the mockup pass.

### 5.1 Home — the weekly-loop dashboard ✅ *(mockup built)*

- **Job:** answer *"what's up with my static this week?"* in one glance, and route to the next action.
- **On it:** **Next session** (RSVP in one tap) · **This week's loot** (per-floor progress + a *single* "Log this week's loot" CTA — not three logging surfaces) · **Roster readiness** (avg iLvl, % BiS, raider count) · **Needs your attention** (the prioritized action list that replaces the `PlayerSetupBanner` chaos *and* the "More" drawer: no-BiS, unclaimed sub, join request) · **BiS progress by role** · **Recent activity** (fairness/transparency — who got what — explicitly *not* a social feed) · **Also tracking** (a Ring-3 track card, e.g. Mount Farm, proving the engine scales).
- **Replaces:** the catch-all "Overview" + the "More" hub + the setup-banner pile-up.
- **New components:** the two-region dashboard, the attention-list row, the track card.

### 5.2 Roster — Cards ⇄ Board

- **Job:** *who's in the static and where their gear stands.*
- **Cards view (default):** player cards grouped by party (Light Party 1 / 2 / Substitutes), each showing job, role color, iLvl, BiS %, and per-slot gear pips. **One** player context menu (today there are overlapping menus). Setup (add player, link character, import BiS) is *woven in* — an empty card invites setup inline, no separate wizard banner.
- **Board view (toggle):** the classic gearsheet matrix — rows = players, columns = slots, cells = have/need/source-colored. The power view, kept verbatim in capability, restyled to tokens. This is the re-homed "Gear."
- **Replaces:** Roster (Members/Characters/Split Planner sub-tabs) + the Gear tab + the Loot Log → Sync gear view + Team Summary's gear table. Split Planner becomes a Board mode, not a separate tab.
- **New components:** the Cards⇄Board segmented toggle, the gear-board cell.

### 5.3 Loot — Priority · History

- **Job:** *distribute drops fairly and record them.*
- **Priority (default):** "who's up next" by the fairness rules, per slot — the in-raid moment, first-class (today it's 3 deep at Loot Log → Priority → Who Needs It). A drop happens → pick the slot → the **unified recipient picker** shows eligible players in priority order → confirm. One picker, everywhere (kills the recurring "can't select that player" bug from the forked `QuickLogDropModal`/`AddLootEntryModal`).
- **History:** the chronological record — what dropped, who got it, which week. "Log a drop" and "Log this week" are **action buttons** here (the verb "Log," with no "Log" tab in sight).
- **Replaces:** Loot Log (Log/Priority/Sync/Summary sub-tabs) + the two separate log-loot/log-material modals + the Log Week wizard's loot step.
- **New components:** the **unified recipient picker** (the single most bug-killing consolidation in the redesign), the priority-row.

### 5.4 Schedule — sessions + availability

- **Job:** *find raid time and RSVP* — and be the app's clock.
- **On it:** this week's session(s) with RSVP state per member; an availability heatmap (aggregated from each member's Person-layer availability) the lead uses to pick times; the calendar for recurring sessions. The **week** here is the *same* week the loot loop runs on — one unit, two uses.
- **Replaces:** Schedule + Schedule-Calendar sub-tabs + the disconnected "Week 1/2/3" loot concept (unified into one clock) + the standalone when2meet-style availability.
- **New components:** the availability heatmap, the session/RSVP card.

### 5.5 Player Hub — the Person-layer home

- **Job:** *you, across all your statics.* The front door when you log in (you land here, then *enter* a static).
- **On it:** your characters/jobs/gear (follows you between statics), your availability (set once, feeds every static's schedule), the statics you're in + what needs you across them, your share profile.
- **Replaces:** the seven scattered Player Hub sub-views (Overview/Sync/Jobs/Tracking/Availability/Share/My Statics) consolidated into a coherent person home + the standalone Dashboard.

### 5.6 Static Finder — recruitment as *matching*

- **Job:** *the right group for the right content/vibe* — not socializing (Discord owns social).
- **On it:** browse/post a listing; match on content, schedule fit (uses your availability), and role need. Recruitment is a Ring-1 coordination feature, not a top-level peer.
- **Replaces:** Discover/Static Finder (logged-out + authed) + the recruitment settings tab + the invitations modal, unified.

### 5.7 ⌘K command palette — the power overlay

Specified in §3.4. An overlay, not a screen; available everywhere.

---

## 6. Component conventions

The mockup expresses these; the **design system remains the authority** for their atomic specs (§8 draws the line precisely).

- **Cards** sit on `surface-card`, 12px radius, `border-subtle`; section headers are uppercase 11px tertiary labels with an icon. (Quiet, data-first.)
- **Primary action:** one per region, accent-filled. **Secondary:** ghost/outline on `surface-interactive`. Never two primaries competing.
- **Player identity** always carries its role color (left border, avatar ring, or dot) so a member is recognizable in any context — card, board cell, priority row, RSVP list.
- **Progress bars** use gear-source colors with the legend present once per screen.
- **Modals** open on `surface-overlay` with a contextual icon + Title-Case header (the standardization PR #154 already started — it survives as execution).
- **Empty states** invite the next action ("No BiS imported — Import BiS") rather than dead-ending ("Not Shared").
- **Destructive actions** confirm; danger styling reserved for genuinely irreversible operations.

---

## 7. Re-homing map — every current surface, placed

The deletion of "More" and the four-nav collapse means every existing destination needs an explicit new home. This table is the migration contract (✅ keep · ♻️ re-home · 🔀 merge · 🗑️ delete-as-surface).

| Current surface | Disposition | New home |
|---|---|---|
| Overview tab | ♻️ | **Home** (weekly-loop dashboard) |
| Roster: Members / Characters / Split Planner | 🔀 | **Roster** (Cards + Board; Split = Board mode) |
| **Gear** (as concept) | ♻️ | Roster Board · Loot Priority · Home readiness |
| Loot Log: Log / Priority / Sync / Summary | 🔀 | **Loot** (Priority · History) + Roster Board (Sync/gear) |
| Tracking / Goals & Farms | ♻️ | **tracks on the Progress Engine** (Home "also tracking" + per-track view) |
| Schedule / Calendar | 🔀 | **Schedule** |
| Plugin tab | ♻️ | Player Hub / Settings (it's setup, not a daily job) |
| **More hub** | 🗑️ | deleted — contents below |
| ↳ Requests | ♻️ | Home attention list + Static Finder |
| ↳ Lead Tools / Settings | ♻️ | top-bar gear (role-scoped Settings) |
| ↳ Loot History | ♻️ | Loot → History |
| ↳ Split Planner | ♻️ | Roster → Board mode |
| ↳ Integrations / Dalamud | ♻️ | Settings |
| ↳ Exports / Activity Log / Session History | ♻️ | Settings (Exports), Recent Activity (Home), Schedule (Session history) |
| ↳ Danger Zone (Archive/Delete) | ♻️ | Settings → Static |
| Settings slide-out (6 tabs) | ✅ | top-bar gear, role-scoped, kept |
| Header context switcher | ♻️ | split: static/track/week → top bar; Player Hub/Finder → context rail |
| Admin (Overview/Statics/Usage/Errors) | ✅ | separate admin area, gated |

---

## 8. Mockup fidelity — what's authoritative

So no one over- or under-reads the mockups:

| Layer | Authoritative? | Owner |
|---|---|---|
| Structure & flow (what's on each screen, nav, journey) | **Yes** | this spec + mockups |
| Visual-language direction (theme, accent, role colors, density, hierarchy) | **Directionally yes** — uses real tokens | this spec + design system |
| Atomic component specs (exact padding, states, component API) | **No** | the design system |

Mockups are standalone HTML on `tokens.css` — they *express* the design system, never fork it. New UI they introduce — **context rail, ⌘K palette, unified recipient picker, gear-board cell, track card, Cards⇄Board toggle, availability heatmap** — are *proposals* to be formalized into the design system **after IA is locked**. A dedicated component & states sheet (every variant + hover/focus/disabled) comes after the screen set is approved, not before. Each mockup element will be tagged **existing / refine / new** in the screen→components map (produced with the mockup pass).

---

## 9. The UX flow graph

How every screen and action connects. Three views: the macro journey, the weekly loop in motion, and the cross-cutting fast paths.

### 9.1 Macro journey — login to work

```
                         ┌──────────────┐
   (logged out) ───────▶ │ Landing /    │ ──Login with Discord──┐
                         │ public view  │                       ▼
                         └──────────────┘            ┌────────────────────┐
                                                     │   PLAYER HUB       │  ◀── the front door
                                                     │  (Person layer)    │      (you, across statics)
                                                     │  • your statics    │
                                                     │  • what needs you  │
                                                     │  • characters/avail │
                                                     └─────────┬──────────┘
                              enter a static ◀──┐               │
                                                │     ┌─────────┴─────────┐
                          ┌─────────────────────▼─────▼──┐                │
                          │      STATIC (workspace)       │         ┌──────▼───────┐
                          │  top bar: static·track·week   │         │ STATIC FINDER │
                          │  spine: Home·Roster·Loot·Sched │         │ (recruit/match)│
                          └───────────────┬───────────────┘         └───────────────┘
                                          │
                       ┌──────────┬───────┴────┬───────────┐
                       ▼          ▼            ▼           ▼
                    ┌──────┐  ┌────────┐   ┌──────┐   ┌──────────┐
                    │ HOME │  │ ROSTER │   │ LOOT │   │ SCHEDULE │
                    └──────┘  └────────┘   └──────┘   └──────────┘
```

### 9.2 The weekly loop in motion (the spine, as a clock)

```
   ┌─────────── ONE WEEK (the unit everything shares) ───────────┐
   │                                                              │
   │  ROSTER ───────▶ SCHEDULE ───────▶  RAID  ───────▶  LOOT ───▶ PROGRESS
   │  set who's in    pick the time     (offline)     who gets   readiness
   │  + their BiS     from availability   clear        the drop   updates
   │     ▲               ▲                              │            │
   │     │               │                              ▼            ▼
   │     │          availability                  "Log this week" ──▶ Home
   │     │          (Person layer,                 updates loot +    "this week's
   │     │           feeds every static)           progress in one   loot" + readiness
   │     │                                          action            reflect instantly
   │     └──────────────────── next week rolls ◀───────────────────────┘
   │                                                              │
   └──────────────────────────────────────────────────────────────┘

   Reads on Home at a glance:  Next session · This week's loot · Needs your attention · Readiness
```

### 9.3 Cross-cutting fast paths (⌘K + entry points)

```
   ⌘K  ──▶  jump to: any tab · any player · any track
        ──▶  do:     Log a drop · Log this week · Who needs <slot> · RSVP
        ──▶  switch: static · track · week

   "Needs your attention" (Home)  ──▶  Import BiS (Roster) · Assign sub (Roster) · Review request (Finder)
   A drop happens                 ──▶  Loot ▸ Priority ▸ recipient picker ▸ confirm   (≤2 levels, one picker)
   New member joins               ──▶  invite/accept ▸ lands in Roster as a card to set up
```

**Flow invariants** (the rules the graph must always satisfy): every action reachable from ⌘K is *also* reachable by direct navigation (rule 2); no core action is >2 levels deep (rule 3); the same **week** object is shared by Schedule and Loot (no parallel week concepts); the same **recipient picker** serves every "assign to a player" moment.

---

## 10. Glossary (canonical vocabulary)

UI copy uses these words and *only* these words for these concepts (rule 4 / *Consistent Language*).

| Term | Definition | Never call it |
|---|---|---|
| **Static** | a raid group | "group," "team" |
| **Track** | something a static is progressing through; the savage Tier is the flagship | "goal" (loosely) |
| **Tier** | the current savage raid tier (a track) | — |
| **Roster** | the people in the static + their gear toward BiS | — |
| **BiS** | the best-in-slot target set for a job | — |
| **Loot** | the domain of distributing drops (priority + log + history) | "gear" (for the domain) |
| **Drop** | one piece of loot that dropped | — |
| **Priority** | who's next in line for a slot, by the fairness rules | — |
| **Log (v.)** | to record a drop or a week — an action | a tab/place |
| **Book / Page** | clear currency used to buy gear | — |
| **Week** | the unit the loop runs on — one raid week = one loot week | — |
| **Lead / Member / Viewer** | roles inside a static (permissions) | a separate app/mode |

---

## 11. Open decisions (need your call before mockup pass)

1. **Tab wording — "Loot" vs "Loot & Priority":** the tab owns priority + logging + history. Is "Loot" enough scent, or label it to surface priority? *(Spec assumes "Loot," with Priority as the default sub-view.)*
2. **Schedule as a tab vs. woven into Home:** scheduling is foundational *because* it's the clock. Does it warrant a full tab, or is "Next session + RSVP on Home + an availability view" enough, with the deep calendar one level down? *(Spec keeps it a tab; it's a distinct job.)*
3. **Player Hub vs. personal Home:** is the Person-layer landing the Player Hub itself, or a lighter "your statics + what needs you" home that *contains* the Hub? *(Spec treats Player Hub as the front door.)*
4. **Tracks surfacing:** do non-flagship tracks (mounts, ultimates) each get a nav entry inside a static, or live only as cards on Home + a track detail view? *(Spec: cards on Home + detail, no nav entry — preserves the 4-tab spine.)*
5. **PR #154 / Plan F:** keep merging the standardization stack (it's pure conformance work the redesign *wants*), or freeze it to avoid churn on screens about to be restructured? *(Recommend: keep the token/lint/shared-component work, pause the per-screen restyling of screens being replaced.)*

---

## 12. What this unlocks (next deliverables, in order)

1. **Mockup pass** — Roster (Cards⇄Board), Loot (Priority + recipient picker), Schedule, ⌘K, Player Hub — at normal + widescreen, on this spec.
2. **Screen→components map** — every element tagged existing / refine / new, formalizing the new components into the design system.
3. **Roadmap re-scope** — map the A–M plans + open PRs onto the rings: enforcement/F/H/M survive as execution; structural nav plans are superseded by this IA. Ring 0 ships first.
4. **Component & states sheet** — after the screen set is approved.

> **Review checklist for this doc:** Is the 4-tab spine right (§3.2)? Do the re-homings (§7) all feel correct? Any flow in §9 that doesn't match how you'd actually use the app? Answer the five open decisions (§11) and I'll lock the spec and start the mockup pass.
