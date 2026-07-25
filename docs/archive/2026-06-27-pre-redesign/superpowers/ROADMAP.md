# UI Overhaul — Execution Roadmap (Plans A–L)

**Context:** A large UI/UX overhaul captured in 12 plans (A–L). Rollout strategy: **one coordinated release** — nothing merges to `main` until *all* work is done, even though it spans many branches/PRs. Work is based on the current branch (`feature/ui-polish-pass`), which must merge to `main` first; the overhaul rebases onto `main` once it does.

**Goal of this doc:** the optimal order to build, what can run in parallel, where the conflict hotspots are, and the branching/release mechanics.

---

## Guiding principle: Foundation → Structure → Features → Conformance

Because nothing ships incrementally, we build in dependency order so we never conform a moving target or rework a foundation:

1. **Foundation** — the vocabulary + guardrails + shell everything hangs off (tokens, typography scale, constrained primitives, enforcement-as-warn, the global rail).
2. **Structure** — the big structural features built on the shell (settings dock, role-aware settings, navigation/IA, world dropdowns, modal standardization).
3. **Features & fixes** — feature behavior + bug fixes layered on the structure (polish batches, recipient dropdown, reuse).
4. **Conformance** — the audit sweeps that bring the *finished* feature set up to the enforced standard, flipping lint `warn → error` as each area clears.

Conformance is last on purpose: the semantics/IA/header/tab/color/typography/theme sweeps run **once** over the final UI instead of chasing in-flight changes.

---

## Dependency graph (what blocks what)

```
L Phase 0–1 (enforcement + constrained primitives) ─┐
F §5-doc (typography scale)  ──┐                     │
J Task 1 (theme tokens)      ──┤ FOUNDATION VOCAB    ├─► everything conforms to these
K primitives (JobSelector,   ──┘                     │
  TriStateToggle)                                    │
A (global AppRail + user menu) ──────────────────────┘  (nav shell)

A ─► I (renames, context switcher, More-tab, active static)   [Header/rail/ContextSwitcher]
A ─► J Task 2 (rail gradient token)                            [rail]
A ─► B (docked settings)  ─► C (role-aware settings + tab persist)   [Header gear + SettingsPanel]
B ─► C ─► I §4/§5 (Suggest deep-link, schedule sub-items)      [SettingsPanel]
F §1 WorldSelect ─► F §2 (Add Char), F §4 (Split Planner), E §4.2 (Lodestone)
F §4.1 (Select portal) ─► H (recipient dropdown menu)
K primitives ─► L Phase 1 (canonical components) ; K bugs are independent (can go early)
C must RECONCILE with existing lib/navPreferences.ts (other session)   ⚠
L Phase 2–6 conformance ◄── runs after the feature set is complete (E, F, G, H, I, K landed)
J Tasks 2–4 (offender conversion) + F §5.3 (typography) + G §5 (tooltips) ◄── conformance, with L sweeps
```

Independent / can start anytime (isolated, low-conflict): **K §1 + §3 bug fixes**, **M §1 (Leave Static fix — production defect, prioritize)**, **E §2/§4/§6/§7/§8/§9 bug fixes**, **H character-field**, **D (listing sub-tabs)**, **G §1/§4 (divider, visibility rename)**.

---

## Waves (recommended execution order)

### Wave 1 — Foundation  *(serialize the shared-infra track; A runs parallel)*
Two parallel sub-tracks:

- **Track 1A — Vocabulary & enforcement (serialize; touches index.css + lint plugin + primitives):**
  1. F §5 Task 5.1 — document the typography scale + floor.
  2. J Task 1 — add theme tokens (rail gradient, overlay, parchment).
  3. K Task 4.1 (`TriStateToggle`) + K Task 2.1 (`JobSelector`) — reusable primitives.
  4. L Phase 0 (enforcement audit) → L Phase 1.1 (constrained primitives: `Tag`/`Tabs`/`LinkText`/`PageHeader`, token-only props) → L Phase 1.2 (extend ESLint plugin **as warn** + CI gate; fold in J/F color+size rules here, do it **once**) → L Phase 1.3 (CLAUDE.md + `/docs/design-system` + PR checklist).
- **Track 1B — App shell (parallel, low conflict with 1A):**
  5. A — global `AppRail`, user-menu-to-rail-footer, Static Finder segment, Plugin nav item.

> After Wave 1: there is one enforced vocabulary (warn), the canonical primitives exist, and the nav shell is in place. Everything downstream targets these.

### Wave 2 — Structure  *(order the Header/SettingsPanel cluster; F/D parallel)*
- **Track 2A — Header/Settings/Nav (serialize — all touch Header.tsx / SettingsPanel.tsx):**
  1. B — docked settings panel + animated gear toggle.
  2. C — role-aware settings + tab persistence. **First reconcile `lib/navPreferences.ts`** (back it with the synced `tab_persistence` pref; don't ship two systems).
  3. I — active-static retention, renames (Loot Log/Tracking), context switcher polish, schedule sub-items, My Statics → Player Hub, panel header-toggle, Join Discord. (Renames touch A's `AppRail` items.)
- **Track 2B — Design-system components (parallel):**
  4. F §1 `WorldSelect` → F §2 (Add Character modal) → F §4 (Split Planner) ; F §3 (modal header sweep).
  5. D — listing builder sub-tabs + pop-out (independent).

### Wave 3 — Features & fixes  *(highly parallel)*
- E — polish batch 2 (catalog banners, overview highlight, **Lodestone** [diagnose early], player-card menu, availability stabilization/clear/hover/counter).
- G — polish batch 3 (divider, search icons, filter dropdowns, Visibility rename). *(Tooltips §5 deferred to Wave 4.)*
- H — unified recipient dropdown (**coordinate the Select menu with F §4.1**) + character-field automation.
- K §1/§3 (bug fixes — can land as early as Wave 1/2), K §2.2 (Add Job adopts `JobSelector`), K §4.2 (Ownership adopts `TriStateToggle`).
- **M — self-service leave + account data controls.** **M §1 (Leave Static actually leaves — production defect) is independent and prioritized; land it as early as Wave 1/2** (handled in `MorePage`, off the `SettingsPanel` hotspot). M §2–3 (account deletion endpoint + Data & Privacy surface) are features for Wave 3; M §2's owner Delete-Static wiring coordinates with the B→C→I danger-zone owner.

### Wave 4 — Conformance  *(runs over the finished UI; ratchet lint warn→error)*
- L Phase 2 (interaction-semantics) → L Phase 3 (IA/redundancy consolidation) → L Phase 4 (headers→`PageHeader`) → L Phase 5 (tabs→`Tabs`) → L Phase 6 (color).
- J Tasks 2–4 (convert theme offenders) + J Task 5 (lint→error) — fold into L's color/enforcement passes.
- F §5.3 (typography hotspot normalization) — fold into L's pass.
- G §5 (comprehensive tooltips) — fold into L Phase 2 (it surfaces missing-affordance elements anyway).
- Per-directory: flip the Wave-1 lint rules from `warn → error` as each area is cleaned.

---

## Conflict hotspots — order to avoid rework

| Shared file | Plans touching it | Rule |
|---|---|---|
| `Header.tsx` | A, B, C, I | Serialize A→B→C→I (Track 2A). One owner at a time. |
| `SettingsPanel.tsx` | B, C, I §4 | Same track, same order. |
| `index.css` | J Task 1, F §5, L Phase 1 | Do token + scale work in Wave 1 Track 1A only. |
| ESLint plugin / `check:design-system` | F §5, J Task 5, L Phase 1.2/7 | Add ALL rules once in Wave 1 (warn); ratchet to error in Wave 4. |
| `ui/Select.tsx` | F §4.1, H | F §4.1 first; H inherits the portal fix. |
| `AppRail`/`SidebarNav` | A, I (renames), J (gradient) | A first; I/J edit after. |
| `ContextSwitcher.tsx` | A (Finder seg), I (active static, schedule items) | A first, then I. |
| `CollectionsCenterTab`/`CatalogBrowse` | G, K §4.2, E §1 | Coordinate; K's TriStateToggle lands before G's filter row work. |
| Availability grids | E §6/§7/§8/(6.4) | Single owner; do 6→6.4→7→8 in order. |

---

## Branching & release mechanics — **stacked chain**

The work is a **linear stack of branches**, each built off the previous one in dependency order. Nothing merges to `main` (and the current branch does **not** merge) until the whole overhaul is done; then PRs merge **sequentially in dependency order, current branch first**.

- **Base of the stack:** `feature/ui-polish-pass` (the current branch). It merges to `main` **last-but-first-in-order** — i.e. it's the first PR merged when the rollout ships, and everything else stacks on top of it.
- **Stack order = dependency order** (the waves below): each plan branch is cut from the **tip of the previous plan branch**, so later work sees and builds on earlier work.
  ```
  feature/ui-polish-pass            (base — merges first at rollout)
   └─ ui/A-rail                     (Wave 1)
       └─ ui/wave1-enforcement      (L Phase 0–1, tokens, primitives, lint-warn)
           └─ ui/B-settings-dock    (Wave 2)
               └─ ui/C-settings-roles
                   └─ ui/I-nav-context
                       └─ ui/F-design-system
                           └─ … (D, E, G, H, K)
                               └─ ui/L-conformance   (Wave 4, last)
  ```
- **Parallelism (limited but possible):** strictly stacking is linear. Truly independent plans (e.g. **D**, the isolated **K/E bug fixes**) may fork off a shared ancestor and be slotted anywhere after their dependencies in the final merge order — but prefer the linear stack for the hotspot clusters (A→B→C→I, F §4.1→H) so there are no rebases.
- **Keep the stack rebased:** if `feature/ui-polish-pass` changes, rebase `ui/A-rail` onto it and ripple up the stack. Do this often to keep drift small.
- **Final rollout:** merge the chain in order — `feature/ui-polish-pass` → A → enforcement → B → C → I → F → … → L — into `main`. One coordinated release.

### ✅ Release-notes / version coordination (simplified by the stack)
Because the branches are **stacked (linear), not parallel**, there is **no `CURRENT_VERSION` merge conflict** — each branch already contains the previous branch's bump.
- **Bump once, at the bottom of the overhaul stack** (the first overhaul branch, `ui/A-rail`): set `CURRENT_VERSION` to the single rollout version — **recommend `2.0.0`** given the scope.
- **Every subsequent stacked branch adds its release-note entries at that same `2.0.0` version** (not a new bump). The `scripts/discord-changelog.test.js` gate stays green because `CURRENT_VERSION` (`2.0.0`) always equals the latest non-internal entry's version (`2.0.0`).
- **Therefore:** in each plan's "Final — release notes" task, **do not introduce a new version** — add entries under `2.0.0`. Only `ui/A-rail` performs the actual `CURRENT_VERSION` change. (This supersedes the per-plan "bump `CURRENT_VERSION`" wording in the individual plan files.)
- Result: one "What's new in 2.0" for users — matching the "roll it out in one go" goal.

---

## Decision: keep all 12 plans separate (robustness over fewer moving parts)

Confirmed approach — **do NOT fold F/G/J into L.** They remain independent plans, coordinated by this roadmap. Rationale (regression mitigation is the priority for a change this large):
- **Small blast radius per PR** — each plan is scoped + independently reviewable; a problem is contained to one plan's surface.
- **Independent green gate** — every plan branch passes the full gate (`build`/`lint`/`check:design-system`/`test`) on its own before merging into `epic/`.
- **Easy revert** — one plan can be backed out of `epic/` without unwinding the others.
- **Clear ownership** — parallel sessions/agents each own one plan branch; the hotspot table prevents collisions.

L still *defines and enforces* the standard (Wave 1) and *sweeps* for conformance (Wave 4); F/G/J/E/K *execute* concrete fixes against it. The roadmap — not a merged mega-plan — is the coordination layer.

## Robustness practices (apply to every plan branch)

- **Per-task TDD/verification** as written in each plan; never claim done without the gate output.
- **Per-PR full gate** into `epic/` (frontend build+lint+design-system+test; backend pytest where touched; `scripts` changelog test).
- **Manual smoke per wave:** toggle **light/dark**, walk the touched surfaces, and exercise the core flows (log loot, edit roster, schedule/availability, settings) — catches the cross-cutting regressions unit tests miss.
- **Enforcement ratchet, not flag day:** Wave 1 ships lint rules as `warn`; flip to `error` per directory only in Wave 4 as each area is cleaned — so foundations never block feature work mid-stream.
- **Keep `epic/` rebased** onto the current branch (then `main` once it merges) frequently, so integration drift stays small.
- **Conformance last:** the audit sweeps (Wave 4) run over the finished UI once — no chasing moving targets.

## Sizing & recommendation

- **Wave 1 is the unlock** — do it first and do it carefully; it's the smallest wave by surface but the highest leverage (every later plan targets it). Starting anywhere else risks rework.
- Waves 2–3 are the bulk and parallelize well across sessions (Track 2A serialized, everything else concurrent).
- Wave 4 is large but mechanical and *safer last* (it's conforming finished code, not designing).
- Rough order of magnitude: Wave 1 small-but-critical; Wave 2 large; Wave 3 large; Wave 4 large-but-mechanical. Plan for a multi-week program; the wave/track structure is what keeps many sessions/agents working without colliding.

**Start here:** Wave 1, Track 1A step 1 (typography-scale doc) + Track 1B (Plan A) in parallel.
