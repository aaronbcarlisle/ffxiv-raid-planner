# FFXIV Raid Planner — Product Core Model

**Status:** Canonical source of truth for what this app *is*. Read this before adding any feature, page, or nav item.
**Last updated:** 2026-06-27
**Supersedes as the "why":** the scattered roadmap in `CONSOLIDATED_STATUS.md` (now an *inventory* that feeds this model) and the bottom-up A–M UI plans (which become *execution* against this model, not the vision itself).

---

## 1. What this app is

> **The home base for a FFXIV static — and the raiders in it.**
>
> It is a **progression tool**: it keeps a static aligned on **what they're working on, when they play, who earns the next drop, and how close everyone is to their goal** — every part of running a raid group, in one place built for it.

Everything else the app does earns its place by **making that progression loop better**, or by **helping run the group that runs the loop.** If a feature does neither, it doesn't belong.

### The one sentence to keep us honest
*A static opens this app to answer: "What are we working on, when do we play, who gets the next drop, and how close are we to done?"* Design every screen to answer one of those faster.

---

## 2. Who it's for

Two audiences, **not** in competition — they live at different altitudes:

- **The raid lead / officer** — sets up the static, manages the roster, runs loot, picks raid times, recruits. The daily power operator of a *Static*.
- **The member / raider** — checks their gear and priority, RSVPs, sets availability, sees what's next. Belongs to one or more statics.

Lead vs. member is a **role inside a static**, resolved by permissions (Owner > Lead > Member > Viewer) — **never** by building two apps. Same UI, progressively more controls.

### Non-goals (what this app is *not*)
- ❌ **A social network.** Discord and the game already own chat, voice, and community. We do not build feeds, DMs, or social profiles.
- ❌ **A generic player profile / collection site.** Personal data exists *to serve the static* (your gear, your availability, the right group for you) — not as an end in itself.
- ❌ **A swiss-army knife of equal features.** There is a protected core and concentric rings; features are not peers.

---

## 3. How everything nests

The whole product is **two layers**, a **weekly-loop spine**, **one progress engine** with **content tracks**, and **concentric rings** — fed by **cross-cutting integrations**, sitting on a **platform**.

### 3.1 Two layers

```
PERSON layer  (you, across everything)
   identity · characters & alts · personal availability · the statics you're in
   · recruitment profile (what you're looking for) · plugin/API keys · account data
            │  feeds ▼            ▲ aggregates into
STATIC layer (a group's shared workspace, role-scoped)
   roster · schedule · loot · progress/tracks · recruitment listing · settings
```

**The rule:** personal inputs flow *up* into static views; static activity flows *down* to the people in it. (Example: you set your availability once in the Person layer; every static you're in reads it into its scheduling heatmap.)

This layering directly resolves a known modeling tension: **mount/collection ownership is character-level (Person) data that aggregates into Static views** — not duplicated per group.

### 3.2 The spine — a static's week

The core is not four equal tabs; it's **one weekly loop on a clock:**

```
   THE STATIC'S WEEK  (the unit everything is organized by)
 ┌────────────────────────────────────────────────────────────┐
 │  ROSTER ──▶ SCHEDULE ──▶ [ RAID ] ──▶ LOOT ──▶ PROGRESS      │
 │   who         when /        clear      who gets   how far    │
 │               who's in                 the drop   toward goal│
 └────────────────────────────────────────────────────────────┘
        ▲ personal availability feeds the schedule
        ▲ priority + the gear board feed loot & progress
```

The app **already** runs on "Week 1 / 2 / 3" for loot. That *is* a schedule concept. We unify them: **one "week" is both the loot-tracking unit and the raid-session unit.** That is why scheduling is *foundational* (it's the clock), not a bolt-on tab.

### 3.3 The Progress Engine — one engine, many tracks

There is **one** concept of progress: *a target + per-member status.* The current **savage tier is its flagship, richest instance** (BiS + loot priority + the full loop). Everything else is a **lighter track on the same engine:**

```
 PROGRESS ENGINE  (target → per-member status)
  ├─ Savage tier (M9S–M12S)  ← FLAGSHIP track: BiS + loot priority + weekly loop
  ├─ Ultimate                ← track: per-member clear/prog status (no loot priority)
  ├─ Mount farm              ← track: per-member mount/totem counts
  ├─ Extreme / criterion     ← track: per-member clears
  └─ Gear funnel / alts      ← track: who's funneling what to whom
```

This is why "goals / content tracking" stops being a vague junk drawer: it's the **same engine**, and adding content is **"add a track,"** not "build a new subsystem." A "tier" is simply the default savage track.

### 3.4 The rings — protected core, scalable expansion

```
   RING 3 · Long game        ultimates · mounts · alts · gear funneling
    RING 2 · Intelligence     FFLogs / performance analytics
     RING 1 · Coordination     schedule depth · availability · recruitment(match) · strats
      RING 0 · THE CORE LOOP    Roster → Schedule(week) → Loot → Progress (savage)
                                 ↑ the reason the app exists; ship flawless first
```

- **Ring 0 — Core loop (protect it):** roster, the week/session backbone, loot (priority + logging + books), the savage gear board. Nothing ships until this is clean.
- **Ring 1 — Coordination:** rich scheduling (availability heatmap, recurring windows, Discord reminders), **recruitment-as-matching** (right group for the content/vibe — *not* socializing), strat references.
- **Ring 2 — Intelligence:** FFLogs / analytics that explain performance.
- **Ring 3 — Long game:** additional content tracks beyond the current tier.

### 3.5 Cross-cutting integrations (feed the rings, owned by neither)

- **Dalamud plugin** — in-game companion: priority overlay, gear sync, loot detection, mount/totem sync. *Feeds* Ring 0 (gear, loot) and Ring 3 (mounts). Configured in Person/Static settings; it is **setup**, not a daily destination.
- **Discord** — OAuth identity, schedule/loot webhooks, future bot. Notification + auth transport.
- **Lodestone / Tomestone** — equipped-gear verification that feeds the gear board.

### 3.6 Platform (invisible foundation)
Design system + tokens + theming, auth/security, error reporting, **admin/ops analytics** (distinct from Ring 2's static-facing FFLogs analytics), mobile/PWA. Serves everything; surfaced to users only as polish.

---

## 4. The scalability rule — "where does this go?"

Every proposed feature must answer **three questions** before it ships. If it can't, it doesn't ship.

1. **Which layer?** Person or Static.
2. **Which ring / is it a track?** Ring 0–3, or a content track on the Progress Engine.
3. **Woven or parked?** Is it *threaded into the spine* (appears where the user already is) or *a separate place to visit*? Prefer woven. A feature that can only be a standalone tab is a yellow flag.

This is the contributor's contract: a new feature has an obvious home and obvious boundaries, so adding it doesn't require touching six other screens. It is also the **engineering** boundary — Person-domain vs Static-domain, core module vs ring modules behind stable interfaces.

---

## 5. The feature inventory, mapped onto the model

Every shipped/planned capability from `CONSOLIDATED_STATUS.md`, placed. **Verdict** = how it fits (✅ keep as-is · ♻️ keep but re-home/re-wire · 🆕 planned · ⚠️ misplaced today).

### Ring 0 — Core loop (Static)
| Capability | Spine slot | Verdict |
|---|---|---|
| Player cards, jobs, positions, tank role | Roster | ✅ |
| BiS import (XIVGear/Etro/Balance presets) + item icons/stats | Roster→Gear | ✅ |
| Gear status circles, iLv calc, gear categories | Progress (savage) | ✅ |
| Multi-BiS / BiS target sets | Progress (savage) | ♻️ needs backend persistence (localStorage today) |
| Weapon priority system (ties, reorder, main job) | Loot | ✅ |
| Loot logging + week navigation + All Weeks | Loot | ✅ |
| Book/page ledger | Loot | ✅ |
| Priority engine (auto/manual/disabled, per-job/player modifiers, drought, fair-share) | Loot | ✅ keep; expose settings inline, not in a parallel panel |
| Log Week wizard + quick drop | Loot | ♻️ consolidate the 3 logging surfaces into one model |
| Reset gear options | Roster→Gear | ✅ |
| Tier snapshots + rollover | = the savage **track** instance | ♻️ reframe "tier" as the flagship track |
| Roster adjustments (loot/page) for mid-tier joins | Loot fairness | ✅ |

### Content tracks — Progress Engine (Static, mostly Ring 3)
| Capability | Verdict |
|---|---|
| Savage tier | ✅ flagship track |
| Mount Farm Tracker (ownership, totems, recommendations) | ♻️ becomes a **track**; ownership is Person/character data aggregated to Static (resolves the documented "character-vs-group" P2) |
| Collection Goals (mount/token/minion/orchestrion/glam/custom) | ♻️ unify with mount tracker under one **tracks** surface, not a separate "Goals" system |
| Ultimates, extreme/criterion | 🆕 lighter tracks on the same engine |
| Gear funnel / alts | 🆕 track dimension; alts are Person-layer characters |

### Ring 1 — Coordination (Static)
| Capability | Verdict |
|---|---|
| Raid sessions + RSVPs | ♻️ unify session-week with loot-week (one clock) |
| Availability heatmap (When2Meet), recurring/typical week | ♻️ availability is a **Person** input aggregated to Static |
| Schedule event categories (raid/farm/reclear/prog/social) | ✅ |
| Discord webhooks (session lifecycle, schedule links, reminders) | ✅ cross-cutting |
| Find a Static (discovery board, filters) | ♻️ **recruitment-as-matching** (Person↔Static), not a social surface |
| Listing setup + preview, join requests + applicant inbox | ✅ keep; live in static settings + a clean applicant inbox |
| Strats reference (per-fight links) | 🆕 not built; Ring 1 reference |

### Ring 2 — Intelligence (Static)
| Capability | Verdict |
|---|---|
| FFLogs integration (gear verification, profile links, fight data) | 🆕 planned; the canonical Ring 2 |

### Person layer
| Capability | Verdict |
|---|---|
| Player Hub (solo profile) + public profile | ♻️ becomes the **personal front door** (your statics + what needs you), not a parallel profile site |
| Discord OAuth, multi-static membership, player ownership linking | ✅ identity/binding |
| Personal availability, characters & alts | ✅ Person inputs feeding statics |
| Recruitment profile (what I'm looking for) | ✅ feeds matching |
| API keys, plugin sign-in | ✅ Person settings (setup) |
| Account data export/delete, leave static (Plan M) | 🆕/♻️ Person settings; some are stubbed today — wire them |

### Cross-cutting & platform
| Capability | Verdict |
|---|---|
| Dalamud plugin (overlay, gear/loot/mount sync) | ✅ integration that *feeds* Ring 0/3; configured in settings |
| Lodestone/Tomestone sync | ✅ feeds gear board |
| Discord webhooks / future bot | ✅ transport |
| Design system + tokens + light/dark theme | ✅ platform — **keep and enforce** (the system is good; conformance is the gap) |
| Keyboard shortcuts | ♻️ promote into a command palette (the power layer) |
| Admin system, View As, admin analytics | ✅ **separate admin area** (platform ops) — not part of the static product |
| Notifications, mobile/PWA, security | ✅ platform |

### ⚠️ Misplaced today → the fix
| Today | Problem | Fix under this model |
|---|---|---|
| **"More" page** (grid of nav cards + danger zone) | Junk drawer — admission the IA had no home for these | **Delete it.** Each item gets a real home (settings, a track, a Person-layer action). |
| **"Overview" / Static Home** as a catch-all | Vague; overlaps Roster | Becomes the **weekly-loop dashboard**: next session, this week's loot status, what needs you. |
| **"Tracking" tab** (mounts + goals) | Disconnected from the gear board it duplicates | Folds into the **Progress Engine tracks** surface. |
| **Settings slide-out** with Priority/Goals/Members tabs | Parallel app that overlaps nav | **Role-scoped settings** that configure, never duplicate, the job pages. |
| **3-deep tabs** (`tab→sub→subtab`, ~9 URL params) | "Who needs this drop" is 3 clicks deep | Flatten to **≤2 levels**; core actions first-class. |
| **Dual selectors / dual roster jumps / 2 catalog browsers / 2 availability editors / recipient picker forked across modals** | "Update one, miss six" | **One owned component per task**; the recipient picker, availability editor, and catalog browser each become a single shared unit. |

### Also placed (cross-checked against `OUTSTANDING_WORK.md`)
| Capability | Verdict |
|---|---|
| Static Overview / Command Brief / Raid-Prep rows | ♻️ this *is* the weekly-loop dashboard (the static home) — keep, make it the loop view |
| Recent Activity feed + activity privacy model (visibility/actor) | ♻️ part of the static home ("what happened this week" — fairness/transparency, **not** a social feed); privacy is a Person/Static setting |
| Notification model (join requests, sessions; read/unread) | ✅ platform/cross-cutting (Person), needs DB-backed read state |
| Webhook delivery-status surfacing | ✅ Discord cross-cutting polish (Ring 1) |
| Ariyala BiS source | ✅ a source option under Ring 0 BiS import (or deprecate for Etro/XIVGear) |
| Tech-debt / lint cleanup, migration round-trip tests, page-layout consistency | ✅ platform conformance — folds into "enforce the design system" (§7 step 1) |

**Net:** the model has a home for ~everything already built or planned, *re-homes* the scattered pieces, and *resolves* two standing architectural tensions (mount ownership; goals-vs-gear). Very little is cut — the value was real; the wiring wasn't.

---

## 6. Where we are now

- **Ring 0 is strong** and is the genuine moat: gear tracking, BiS import, the priority engine, loot logging, books. This is what replaced the sheet and what nothing else does as well.
- **Rings 1 & 3 are largely built but parked beside the core, not woven into it** — scheduling re-implements when2meet as an island; mounts/goals re-implement progress-tracking as a vaguer parallel to the gear board. *(This is exactly why they "feel like added complexity.")*
- **The design system (visual identity) is good; conformance is poor** — ~460 arbitrary text sizes, ~181 inline colors bypassing tokens, raw elements. The look is an asset; enforcement is the gap.
- **The IA has fragmented**: four parallel navigation systems, a "More" junk drawer, 3-deep tabs, and duplicated components. This is the root cause of "10 ways to the roster / 16 ways to log loot."

## 7. Where we're going (core-anchored roadmap)

The enabling move is a **navigation re-architecture**: one context rail (Person layer) + a jobs-based in-static nav (the spine) + a command palette (the power fast-path), every page ≤2 levels deep. Then we build outward, ring by ring:

1. **Foundation:** lock this model; re-architect the IA; keep + *enforce* the design system (tokens, type scale, constrained primitives, lint-as-error per area).
2. **Ring 0 flawless on the new IA:** the weekly loop — roster, the unified week/session clock, loot (one logging model, one recipient picker), the savage gear board. Consolidate every duplicated component into one owned unit.
3. **Ring 1 woven in:** scheduling as the clock (availability as a Person input → Static heatmap), recruitment-as-matching, strat references.
4. **Ring 2:** FFLogs intelligence.
5. **Ring 3:** additional content tracks (ultimates, mounts unified, funneling) on the Progress Engine.

Every future request is now triaged by §4: *which layer, which ring/track, woven or parked?* That is the long-term clarity — the roadmap is "make the core flawless, then deepen each ring," and the backlog sorts itself.

---

## 8. How this relates to the other docs

- **`CONSOLIDATED_STATUS.md`** → demoted to a **feature inventory / changelog**. It records *what exists*; this doc decides *where it belongs and why.*
- **A–M UI plans + `ROADMAP.md`** → re-scoped as **execution detail**. The enforcement philosophy (Plan L), design-system standardization (F), recipient consolidation (H), and account controls (M) survive and feed §7. The *structural* plans (rail/settings/nav renames A/B/C/I) are superseded by the IA re-architecture, which is designed top-down here rather than shuffled.
- **The redesign spec + mockups** (next deliverables) derive *from* this doc. If a mockup contradicts this model, the model wins or the model is changed deliberately — not by drift.
