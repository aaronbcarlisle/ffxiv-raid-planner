# FFXIV Raid Planner — Product Core Model

**Status:** Canonical source of truth for what this app *is*. Read this before adding any feature, page, or nav item.
**Last updated:** 2026-09-30 *(§6 rewritten as the canonical current state + definition of done; §7–§8 statuses verified against git)*
**Where things stand:** [§6](#6-current-state-and-definition-of-done) — the one canonical status and definition of done.
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
| Listing setup + preview, join requests + applicant inbox | ✅ keep; listing setup + applicant inbox + invites live in the static's Recruiting page (V2); V1 keeps them in static settings |
| Strats reference (per-fight links) | 🆕 not built; Ring 1 reference |

### Ring 2 — Intelligence (Static)
| Capability | Verdict |
|---|---|
| FFLogs integration (gear verification, profile links, fight data) | 🆕 planned; the canonical Ring 2 |

### Person layer
| Capability | Verdict |
|---|---|
| Player Hub (solo profile) + public profile | ♻️ the **player's dashboard** (glance first: your statics, characters, availability, setup; then Characters & gear · Availability · Tracking · Sharing tabs), accessed via the **user menu** and the rail's first slot — your character portrait; its front-door role survives only as the landing surface for static-less users *(refined 2026-07-26 by the ruled `design/redesign/specs/systems-flow-map.md`, delta R1 — was "personal front door"; amended 2026-09-25 by the Player Hub spec H-1/H-2, V2 built in PH1 2026-09-26)* |
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
| **"Overview" / Static Home** as a catch-all | Vague; overlaps Roster | Becomes the **shared informational hub** for the whole static (the weekly loop read-only: next session, this week's loot status, what needs you — lead signals as a role-adaptive section). *(Relabelled 2026-07-26 per flow-map delta R3 — "dashboard" is now reserved for operator instruments like the Player Hub.)* |
| **"Tracking" tab** (mounts + goals) | Disconnected from the gear board it duplicates | Folds into the **Progress Engine tracks** surface. |
| **Settings slide-out** with Priority/Goals/Members tabs | Parallel app that overlaps nav | **Role-scoped settings** that configure, never duplicate, the job pages. |
| **3-deep tabs** (`tab→sub→subtab`, ~9 URL params) | "Who needs this drop" is 3 clicks deep | Flatten to **≤2 levels**; core actions first-class. |
| **Dual selectors / dual roster jumps / 2 catalog browsers / 2 availability editors / recipient picker forked across modals** | "Update one, miss six" | **One owned component per task**; the recipient picker, availability editor, and catalog browser each become a single shared unit. |

### Also placed (cross-checked against `OUTSTANDING_WORK.md`)
| Capability | Verdict |
|---|---|
| Static Overview / Command Brief / Raid-Prep rows | ♻️ this *is* the static Home — the **shared informational hub** reading the weekly loop (relabelled 2026-07-26 per delta R3) — keep, make it the loop view |
| Recent Activity feed + activity privacy model (visibility/actor) | ♻️ part of the static home ("what happened this week" — fairness/transparency, **not** a social feed); privacy is a Person/Static setting |
| Notification model (join requests, sessions; read/unread) | ✅ platform/cross-cutting (Person), needs DB-backed read state |
| Webhook delivery-status surfacing | ✅ Discord cross-cutting polish (Ring 1) |
| Ariyala BiS source | ✅ a source option under Ring 0 BiS import (or deprecate for Etro/XIVGear) |
| Tech-debt / lint cleanup, migration round-trip tests, page-layout consistency | ✅ platform conformance — folds into "enforce the design system" (§7 step 1) |

**Net:** the model has a home for ~everything already built or planned, *re-homes* the scattered pieces, and *resolves* two standing architectural tensions (mount ownership; goals-vs-gear). Very little is cut — the value was real; the wiring wasn't.

---

## 6. Current state and definition of done

> **This is the one canonical statement of where the redesign stands and what "done" means.** Other docs link here instead of restating it. Verified 2026-09-30 against `main` `301a1b9e` (2.1.56 then; the version source of truth is `CURRENT_VERSION` in `frontend/src/data/releaseNotes.ts`). When you change the state, change it here, with PR numbers.

### 6.1 Where we are now

**Two shells.** Legacy V1 is the default for everyone. V2 is a preview only admins can enter: the "Try the new UI" banner is gated on `isAdmin` (`TryNewUiBanner.tsx`), and `?shell=v2` stays a power-user escape hatch. V1 is frozen (bugfix-only) until it is deleted.

| Area | State | Evidence |
|---|---|---|
| Foundation F0–F6 + the first flip | ✅ built, then the hard cutover was reversed | F1–F6 #155–#170; flip P1–P3 #171–#173; reversal by Phase R |
| Phase R — restore the dual shell | ✅ | #174 |
| Phase A — V2 flip-debt fixes | ✅ | #175; the A3 void fix in #176 |
| Phase G — dual shell to `main` (2.1.0) | ✅ | #161, 2026-07-25 |
| Coverage Stage 0 (hygiene) + Stage 1 (V2 chrome on every route) | ✅ | #176–#181 |
| Phase B — V1→V2 affordance-parity matrix, all 68 units ruled | ✅ | #183, #184; flow map #185 |
| Phase C — roster rework | ✅ | C1–C8 #187–#201; closeout #202 |
| Phase D — loot / history rework | ✅ except **D-18** (Split Planner entry, waits on the Progress home) | D0–D14b #223–#273; carried follow-ups #274 |
| Phase E — polish | ✅ | E1 #275; E2 #276, #277 |
| Off-hand slot (both shells) | ✅ | #238, #240 |
| Stage 3 — Player Hub | ✅ except H-10 (V2 availability exceptions editor) and the static typical-week layer | PH1 #280–#282; PH2 #286–#288; PH3 #304–#306 |
| Stage 4 — Static Finder + Recruit home | ✅ | SF1 #308–#311; RH1 #312–#316 (#308 and #312 are the spec+plan PRs) |
| **Stage 2 — in-static IA collapse** | 🟡 S2a spec accepted 2026-10-01 ([`2026-09-30-s2a-progress-design.md`](../design/redesign/specs/2026-09-30-s2a-progress-design.md)) and its parity matrix signed 2026-10-01 ([`2026-09-30-s2a-parity-matrix.md`](../design/redesign/specs/2026-09-30-s2a-parity-matrix.md)); slice plans next, starting with S2a-1 once PROV-1 merges; no code yet | `Spine.tsx` has 4 tabs (Home/Roster/Loot/Schedule); More still has "Coming soon" stubs (`MorePage.tsx`); `MobileBottomNav` still renders under V2 |
| Stage 5 — docs and admin fit-and-finish | ◐ docs and admin are V2-chromed since Stage 1; the docs light restyle ⬜ | `V2_COVERAGE_PLAN.md` Stage 5 |
| Stage 6 — ⌘K actions | ⬜ | `CommandPalette.tsx` is navigate-only |
| Phase F — chrome seams + carried items | ⬜ | carried list in `ROLLOUT_ROADMAP.md` §7, itemised in `HOME_STRETCH.md` §4 F1–F3 |
| Parity rows still owed | ⬜ no slice yet: D-48, D-49, D-63, D-65, D-66, D-70 (D-50 and D-58 ✅ shipped in P1 #323, 2026-09-30). Ruled with a named home: D-44 → mobile pass, D-60 → Phase P, D-52 → Stage 2, D-67/D-68 → Stage 2, D-18 above | `specs/v1-v2-parity-matrix.md`; each checked absent in code 2026-09-30. All of them gate the 3.0.0 release (HS-4); sequenced in [`HOME_STRETCH.md`](../design/redesign/HOME_STRETCH.md) §4 P1/P2a/P2b/S2 |
| Mobile pass (before Phase P) | ⬜ | deferred out of every slice by ruling; `HOME_STRETCH.md` §4 MP |
| Phase P — beta polish walkthrough with the owner | ⬜ | process in `HOME_STRETCH.md` §5 |
| Admin V2 | AD1a #241, AD1b #317/#318 ✅; AD2+ parked | **Blocks nothing** (a separate gated area; HS-14) |
| Account delete / export (old Plan M) | ⬜ never built | no endpoint in `backend/app/routers`; a 3.0.0 prerequisite (HS-13), `HOME_STRETCH.md` §4 M1 |
| V2 holistic audit (2026-09-30) | ✅ delivered; its revised plan **adopted in full** (HS-32) | 13 agent reports, 3 verified P0s, 31 owner decisions; the plan is [`HOME_STRETCH.md` §6](../design/redesign/HOME_STRETCH.md#6-the-w-plan-v2-audit-adopted-2026-09-30) |
| W0 — safety and correctness | ◐ V1B-1 ✅ #322; the "View schedule" part of HOME-1 ✅ #323; LOG-1 (Log Week double-log) ✅ #327, its books follow-up #326 ⬜; RSVP-0 (series vs occurrence) ✅ #328, with the V2 RSVP double toast #324; SEC-1 (farm-drop authorization, plus three more viewer write gaps) ✅ #329 + #330; AUTHZ (every mutation route under a checked role table, plus the plugin's key contract) ✅ #332, with the viewer-duplicate question #331 ⬜; GUEST-1 (guest top bar and palette, the V2 Schedule members-only card, the `/api/auth/session` bootstrap, member identity off `by-code`/`{id}`) ✅ #343, with GUEST-2 (the sibling payloads and the guest 401s off the Spine) ⬜; the rest ⬜ | `HOME_STRETCH.md` §6.3 W0; the P0 safety slice (HS-34) is complete |
| W2 — the 31 owner decisions (DEC-1) | ✅ answered 2026-09-30: every recommended answer accepted (HS-35); the CC-5 reconciliation PR that carries them into the canonical docs ⬜ | `HOME_STRETCH.md` §6.5; Stage 2 restarts from canvas DA 10 (HS-35 #1, #3) |

**What remains, in order, with sizes, dependencies and acceptance criteria:** [`design/redesign/HOME_STRETCH.md`](../design/redesign/HOME_STRETCH.md). **The order is its §6, [the W-plan](../design/redesign/HOME_STRETCH.md#6-the-w-plan-v2-audit-adopted-2026-09-30)** (waves W0–W8 plus design-quality gate Q, adopted in full 2026-09-30, HS-32): the P0 safety slice first, then Stage 2 co-design from canvas DA 10 (HS-34). The same day the owner accepted the recommended answer to all 31 of the plan's decisions (HS-35, `HOME_STRETCH.md` §6.5); no earlier ruling was off-limits (HS-33), and each answer names the rulings it overturns. Session 2 (2026-09-30) settled every open owner question as rulings HS-1…HS-25, and the same day the owner ruled HS-26…HS-31 on questions the plan's two director vets raised; all are recorded there. In short: the spine is five tabs, with Progress as the tracks surface (F-03, reaffirmed; "prog" stays the status word, HS-29); Plugin setup lives in Player Hub, its guide in Docs and the team Gear-Sync dashboard in Roster (F-05, reaffirmed); every owed parity row gates the release; the un-gate and 3.0.0 merge into one release; and a legacy→V2 entry stays for everyone after it (HS-26).

### 6.2 Definition of done

Two gates, in order. *(Ratified 2026-09-30, HS-6; merged into two gates by HS-25. The 2026-07-11 proposal had three: un-gate, 3.0.0, V1 deletion.)*

1. **Release 3.0.0: V2 is the default for everyone.** Every user is flipped to V2: the shell choice made before the release isn't migrated, and a switch-back made after it persists (HS-23). The way back is "Switch back to legacy UI" in the user menu or Settings, reachable on mobile (HS-24). `TryNewUiBanner` is deleted; the legacy user-menu item that enters V2 stays for everyone, without its `isAdmin` gate and renamed, so switching back is never a one-way door (HS-26). Requires every build item in `HOME_STRETCH.md` §4 that isn't marked *not a gate* (HS-28; HS-14 for admin-only items), and every item §6 (the W-plan) marks as a gate unless the owner defers it in writing (HS-32):
   - W0 safety and correctness: the three P0s, the mutation-route authorization table, guest and role gating, the kill switch with a reversible flip, and CI quality infrastructure (axe, bundle budgets, visual baselines);
   - the W1 quick-win clusters marked as gates, including the accessibility floor;
   - the reconciliation PR that carries the owner's 31 answers (HS-35) into the canonical docs;
   - the W4 surface reworks, each as its §6.5 decision rules;
   - **design-quality gate Q** (W5): the per-surface rubric with a heuristic floor, WCAG 2.2 AA with zero critical or serious axe findings, performance budgets, the cross-page consistency slice, the states matrix, an accessibility statement, and a 5-raider usability test;
   - docs content, help, first-run onboarding and a feedback channel (W6);
   - every parity-matrix row executed;
   - the not-found fix (V1B item 1; broken in V2 too, HS-28) — ✅ #322;
   - Stage 2, Stage 5, the ⌘K palette as a global navigator (S6's action tranche is scheduled but isn't a gate) and Phase F (not its F3 docs/tooling hygiene) (HS-35 #31);
   - an invite-only beta cohort before the flip, and a kill switch with a reversible flip migration (HS-35 #29);
   - H-10 and the typical-week layer;
   - account delete and export (Plan M);
   - shell-switch telemetry;
   - the mobile pass;
   - Phase P;
   - the owner-signed release plan.

   The beta cohort is volunteer statics invited via Discord for 1–2 weeks with telemetry live; it overturns HS-25's "no opt-in window" and keeps the two gates. Phase P follows each surface's Q-1 pre-score (HS-32). Phase P is done when every V2 surface (in-static screens, non-static routes, mobile variants, guest views) has been walked with the owner, and every punch-list item is either fixed and re-demonstrated before the next page, or explicitly deferred by the owner. A page is accepted when the owner says "next". Admin V2 is not a prerequisite (HS-14).
2. **V1 deleted.** Requires all of:
   - V2 the default for at least 4 weeks;
   - a trailing-2-week switch-back rate under 10% (tune with real data; defined in `HOME_STRETCH.md` §4 T1);
   - V2's error-log rate no higher than V1's (V1's is the baseline T1 records before the release);
   - zero open parity-tagged issues.

   Deletion re-runs the flip-P3 legacy-deletion checklist (`design/redesign/plans/2026-07-03-flip-p3-legacy-deletion.md`; the deletion inventory is §6 of `specs/2026-07-03-parity-flip-design.md`), corrected for what has changed since and with its verification steps actually executed.

**Standing rule (permanent):** no surface is replaced without an affordance-parity matrix the owner has reviewed first. Detail on each phase and its rulings lives in [`ROLLOUT_ROADMAP.md`](../design/redesign/ROLLOUT_ROADMAP.md); per-stage detail in [`V2_COVERAGE_PLAN.md`](../design/redesign/V2_COVERAGE_PLAN.md).

### 6.3 Where we started (June 2026, kept for the rationale)

The redesign began from this diagnosis. V2 addresses each point; V1 still carries them until it is deleted.

- **Ring 0 is strong** and is the genuine moat: gear tracking, BiS import, the priority engine, loot logging, books. This is the part of the product nothing else does as well — its own thing, judged on its own terms.
- **Rings 1 & 3 are largely built but parked beside the core, not woven into it** — scheduling re-implements when2meet as an island; mounts/goals re-implement progress-tracking as a vaguer parallel to the gear board. *(This is exactly why they "feel like added complexity.")*
- **The design system (visual identity) is good; conformance is poor** — ~460 arbitrary text sizes, ~181 inline colors bypassing tokens, raw elements. The look is an asset; enforcement is the gap.
- **The IA has fragmented**: four parallel navigation systems, a "More" junk drawer, 3-deep tabs, and duplicated components. This is the root cause of "10 ways to the roster / 16 ways to log loot."

## 7. Where we're going (core-anchored roadmap)

The enabling move is a **navigation re-architecture**: one context rail (Person layer) + a jobs-based in-static nav (the spine) + a command palette (the power fast-path), every page ≤2 levels deep. Then we build outward, ring by ring:

1. **Foundation:** lock this model; re-architect the IA; keep + *enforce* the design system (tokens, type scale, constrained primitives, lint-as-error per area). *(✅ F0–F6, #155–#170. The IA re-architecture finishes with Stage 2.)*
2. **Ring 0 flawless on the new IA:** the weekly loop — roster, the unified week/session clock, loot (one logging model, one recipient picker), the savage gear board. Consolidate every duplicated component into one owned unit. *(✅ in V2 via Phases C–E; D-18 waits on Stage 2.)*
3. **Ring 1 woven in:** scheduling as the clock (availability as a Person input → Static heatmap), recruitment-as-matching, strat references. *(Availability pipe ✅ PH3 #304/#305; recruitment-as-matching ✅ Stage 4 #309–#316; strat references ⬜ not built.)*
4. **Ring 2:** FFLogs intelligence. *(⬜ not built, not yet scheduled.)*
5. **Ring 3:** additional content tracks (ultimates, mounts unified, funneling) on the Progress Engine. *(Stage 2 gives Progress its in-static home as the fifth spine tab (F-03, reaffirmed HS-2); new tracks ⬜ not yet scheduled, and may start after the release (HS-15).)*

Steps 1–3 are the redesign; §6 tracks them to done. Every future request is now triaged by §4: *which layer, which ring/track, woven or parked?* That is the long-term clarity — the roadmap is "make the core flawless, then deepen each ring," and the backlog sorts itself.

---

## 8. How this relates to the other docs

- **§6 is the only place that states current redesign status and the definition of done.** Other docs link to it rather than restating either. `HOME_STRETCH.md` §4's ticks are subordinate to §6.1: a tick records that an item shipped, and if a tick and §6.1 disagree, §6.1 wins and the tick is corrected.
- **The redesign docs** (`design/redesign/`) derive *from* this doc: [`REDESIGN_SPEC.md`](../design/redesign/REDESIGN_SPEC.md) (IA, visual language, flows, with mockups), [`HOME_STRETCH.md`](../design/redesign/HOME_STRETCH.md) (the sequenced plan from now to V1 deletion, with the session-2 rulings; its §6 is the adopted W-plan from the 2026-09-30 V2 audit), [`ROLLOUT_ROADMAP.md`](../design/redesign/ROLLOUT_ROADMAP.md) (phases R→H and their rulings; frozen as history by HS-35 #30, with `V2_COVERAGE_PLAN.md` and RECONCILIATION: the plan of record is `HOME_STRETCH.md`), [`V2_COVERAGE_PLAN.md`](../design/redesign/V2_COVERAGE_PLAN.md) (coverage Stages 0–6), and per-slice specs and plans under `specs/` and `plans/`. If a mockup or spec contradicts this model, the model wins or the model is changed deliberately — not by drift.
- **`CONSOLIDATED_STATUS.md`, `OUTSTANDING_WORK.md`, the A–M UI plans and `ROADMAP.md`** are archived in `docs/archive/2026-06-27-pre-redesign/`. They record what existed before the redesign. The enforcement philosophy (Plan L), design-system standardization (F) and recipient consolidation (H) were carried into the redesign; account controls (Plan M) were never built (§6.1). The structural plans (rail/settings/nav renames A/B/C/I) were superseded by the IA re-architecture.
- **The changelog** is `frontend/src/data/releaseNotes.ts` (CI-enforced), which is also the version source of truth.
