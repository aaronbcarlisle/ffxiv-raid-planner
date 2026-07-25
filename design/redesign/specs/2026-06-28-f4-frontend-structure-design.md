# F4 — Frontend Structure (Feature-Slice + Shared-Layer Model) · Design Spec

> **Phase:** F4 of the redesign foundation (`FOUNDATION_ROADMAP.md §2`).
> **Status:** design approved (2026-06-28); implementation plan to follow under `design/redesign/plans/`.
> **Authority:** `FOUNDATION_ROADMAP.md` (F4 scope + §0 reframe — structure is the third anti-drift leg), `PRODUCT_MODEL.md` (the layer/ring/track model F4 makes machine-checked — §3.1 layers, §3.4 rings, §4 the "where does this go?" contract, §5 feature→ring inventory), `DESIGN_SYSTEM.md` (the shared layer F4 extends from), `CLAUDE.md` (CI rules, release-notes rule, no-AI-attribution). Continues the F2 enforcement surface (`eslint.config.js` `boundaries/*`).

## 1. Goal

Make the foundation's **structure** pillar (roadmap §0.3 — "a structure where every job has exactly one home") *explicit and machine-checked*. F4 converts the `PRODUCT_MODEL.md` layer/ring model — today an implicit idea — into (a) a written, contributor-facing structure doc, (b) a **Ring map** that places every existing frontend domain and store into a layer/ring, and (c) **lint enforcement** that extends F2's single shared-layer rule into the full Ring-aware import graph plus store-boundary rules.

**The governing principle: document + enforce in place — no file moves.** F4 does not physically reorganize `components/` or `stores/`. F6 rebuilds the Ring-0 screens into the final slice shape; moving files now would re-move the same files twice and conflict with F5/F6. F4 makes the *target model* legible and adds *teeth* over the tree as it sits today, with the existing bottom-up debt honestly baselined rather than hidden or churned away.

This mirrors F2/F3's proven discipline: **bless-don't-purge** (here: tag the dirs that exist, don't relocate them) and **baseline-then-ratchet** (here: warn + fail-on-new for the ring graph, ratcheting to error per-screen as F6 rebuilds).

## 2. Non-goals (deferred, with pointers)

- **Physical file moves / dir restructuring** — none, this phase. The slice shape lands when F6 rebuilds each Ring-0 screen and consolidates its duplicated predecessors into one owned component. F4 documents *where things will go*; F6 moves them.
- **Resolving the mixed dirs** (`static-group/`, `settings/` span rings) — not split this phase. Tagged by primary purpose, spanners baselined (see §6). Re-homed during F6's spine rebuild.
- **Deleting legacy/old-IA dirs** (`group/`, `dashboard/`) — F4 tags them transitional and freezes them; they are deleted/rebuilt in F6 (`MorePage` is already slated for deletion per `PRODUCT_MODEL.md §5`).
- **Backend enforcement** — backend is not CI-gated (a lint rule there would be theater). F4 ships a **doc-only** backend Person↔Static architecture note (§7); no backend code or check.
- **Refactoring the one legitimate store coupling** — `viewAsStore→authStore` is kept as a single documented allowlist entry (§5.2), not refactored. Building a coordination util for N=1 caller is speculative; the allowlist makes the *second* such coupling visible, which is the rule working as designed.
- **Ratcheting the ring graph to `error` now** — that is per-screen at F6. F4 lands the rule at `warn` + fail-on-new baseline.
- **New stores, store consolidation, or Zustand selector work** — out of scope; F4 documents the one-store-per-domain rule, it does not reorganize the 28 existing stores.

## 3. Git & workflow

- Branch `redesign/f4-frontend-structure` off `redesign/foundation` @ `0303caa`.
- PR into `redesign/foundation` → review-loop → **squash-merge** (same as F1/F2/F3). Nothing targets `main` until the whole foundation lands.
- **No AI attribution** in commits/PRs (absolute, `CLAUDE.md`).
- **CI gates this PR** (F2 added `redesign/**` triggers) — design for day-one-green under the full suite (`tsc -b` → lint → `check:design-system:strict` → test → build). The new lint rules must be green-on-land: `error`-tier rules only where the tree is already clean; the ring rule at `warn` so legacy debt does not fail CI.
- Release-notes rule: this PR touches `frontend/` (lint config + docs; no `frontend/src/` runtime change is *required*, but the eslint config and any type-only import tidy count) → add a release-notes entry. The work is **`{ internal: true }`** (structure/tooling, no user-visible change). **Do not bump `CURRENT_VERSION`.**

## 4. Deliverable 1 — `design/redesign/FRONTEND_STRUCTURE.md` (the structure doc)

The canonical contributor-facing answer to `PRODUCT_MODEL.md §4`'s "where does this go?", scoped to the frontend. Sections:

### 4.1 The layer/ring taxonomy
The import-direction model, innermost → outermost, with the cardinal rule **imports may only point inward** (a ring may import its own tier, any inner ring, the Person layer, the shell, and shared — never an outer ring):

```
shared (primitives/ui)  ←  shell/platform  ←  Person layer  ←  Ring 0  ←  Ring 1  ←  Ring 2  ←  Ring 3
                                                                    (core loop)  (coord)  (intel)  (tracks)
admin-ops = a separate platform surface, OUTSIDE the ring graph (may reach across rings; §6.3)
```

### 4.2 The promotion rule
"**≥2 features import it → it moves to `shared/` behind a public API.**" A helper used by one feature stays in that feature. The second consumer is the trigger to promote — not speculation. (jscpd from F2 already flags the copy-paste case; the promotion rule is the human-side governance for the deliberate case.) Shared modules expose a public API (an `index.ts` barrel); features import the barrel, never deep paths.

### 4.3 One store per domain
Each domain owns exactly **one** Zustand store. **A store must not import another store** — cross-store coordination goes through explicit utilities in `utils/`/`lib/` (the existing `utils/lootCoordination.ts` is the pattern), never store-reaching-into-store. One documented exception (§5.2). The component→store direction (a feature reading its data layer) is *normal and allowed*; the inversion (a store importing a component) is the smell.

### 4.4 The Ring map
The full table (§6) — every `components/*` domain and every `stores/*` store, tagged by layer/ring **and by cleanliness tier** (clean / mixed / legacy), with the *why* for each non-clean entry and *when it tightens* (F6).

### 4.5 Person↔Static module boundary (frontend)
Which stores/domains are Person-layer (survive leaving a static) vs Static-layer (erased on leave), per `PRODUCT_MODEL.md §3.1`'s ownership rule. The boundary is documented, and partially enforced by the layer lint (Person layer is inward of the rings).

## 5. Deliverable 2 — Lint enforcement (`eslint.config.js`)

Extends F2's `boundaries/*` block (which today defines 3 elements — `shared`/`feature`/`app` — and one rule: shared ✗ imports feature|app). F4 replaces the coarse `feature` element with the layer/ring element set and adds the rules below.

### 5.1 `boundaries/elements` — the ring/layer element set
Path-based classification (the dirs do not move; only their *labels* are added):

| element | pattern (illustrative) |
|---|---|
| `shared` | `src/components/(primitives\|ui)/**` |
| `shell` | `src/components/(layout\|dnd\|docs)/**` + shell stores |
| `person` | `src/components/(profile\|auth)/**` + Person stores |
| `ring0` | `src/components/(roster\|player\|bis\|loot\|priority\|weapon-priority\|history\|wizard\|team)/**` + Ring-0 stores |
| `ring1` | `src/components/(schedule\|split-clear)/**` + Ring-1 stores |
| `ring2` | *(reserved — no built dirs yet)* |
| `ring3` | `src/components/(mount-farms\|collections)/**` + Ring-3 stores |
| `admin` | `src/components/admin/**` *(distinct element — outside the ring graph; §6.3)* |
| `app` | `src/pages/**`, `src/services/**`, `src/stores/**` *(stores further classified by ring for §5.3)* |

Exact glob membership for mixed dirs (§6.2) is "tag by primary purpose"; the precise patterns are settled during implementation by reading each file, but the *primary tag* is fixed here.

### 5.2 Store-boundary rules — **`error` now** (tree already clean)
- **A store must not import another store.** Measured: only `viewAsStore→authStore` violates this today. Kept as a **single allowlist entry with the reason written inline** at the allow-rule: *impersonation is inherently auth-coupled — view-as reads the real admin identity (`isAuthenticated`/`user.isAdmin`) to impersonate from; verified a runtime identity read, not a type import.* Any *second* store→store import must add its own justified entry (the rule working as designed).
- **A store must not import a component.** Measured: 2 violations, both **`import type`** only (`dragStore`←`components/dnd/collisionDetection#DropMode`, `settingsPanelStore`←`components/settings#SettingsTab,RecruitmentSection`). Resolve by moving those 3 types to `src/types/` (cleanest — types have no ring) **or** an explicit `import type` carve-out. Implementation picks one; default = move the types (small, zero runtime effect).

### 5.3 Ring-inward-only rule — **`warn` + fail-on-new baseline**
The cardinal rule from §4.1 applied across feature/ring elements: an element may import inward (own tier, inner rings, person, shell, shared) but **not outward**. Lands at `warn` with a captured baseline of current violations (the F2 jscpd/knip pattern). The mixed (§6.2) and legacy (§6.3) tiers populate the baseline.

**Fail-on-new is mandatory, including for the mixed dirs.** The baseline grandfathers *existing* spanners at their current count; a **new** cross-ring import — into `settings/`, `static-group/`, or anywhere — still fails. The baseline freezes the mess at today's size; it must not license growth. (Without this, "it's already mixed" turns the two spanner dirs into dumping grounds for the whole F4→F6 window.)

Ratchet path: as F6 rebuilds each clean-tier Ring-0 screen, flip that dir's rule to `error` and drop its baseline entries.

### 5.4 `admin` is exempt from ring-inward rules
`admin` is a **distinct lint element**, not a ring. It is a platform-ops surface (per `PRODUCT_MODEL.md §5` — "separate admin area, not part of the static product"). It legitimately reaches across product rings (e.g. `admin/`→`viewAsStore`, admin dashboards reading Ring-0/1/3 data). The ring-inward rule must **not** measure `admin` against ring tiers; encode it so admin→{shell, any ring, shared} is allowed and admin is never a false positive.

## 6. The Ring map (the crux)

Existing dirs were built bottom-up; several mix rings or are old-IA. The map therefore has **three cleanliness tiers**, and the enforcement strictness follows the tier.

### 6.1 Clean tier — one ring/layer, ratchet candidates
| domain / stores | bucket |
|---|---|
| `roster/` `player/` `bis/` `loot/` `priority/` `weapon-priority/` `history/` `wizard/` `team/`; `tierStore` `lootTrackingStore` `staticGroupStore` `sharedBisStore` | **Ring 0** |
| `schedule/` `split-clear/`; `scheduleStore` `availabilityStore` `invitationStore` `joinRequestStore` `contentSuggestionStore` `splitClearStore` | **Ring 1** |
| `mount-farms/` `collections/`; `mountFarmStore` `collectionGoalStore` `objectiveGoalStore` `objectiveCommandStore` | **Ring 3** |
| `profile/` `auth/`; `authStore` `playerProfileStore` `personalAvailabilityStore` `staticCharacterStore` `notificationStore` `apiKeyStore` `collectionIntentStore` | **Person** |
| `layout/` `dnd/` `docs/`; `dragStore` `settingsPanelStore` `toastStore` `viewAsStore` | **Shell** |

These can ratchet to `error` early (at F6 rebuild, or sooner if a dir proves clean).

### 6.2 Mixed tier — spans rings; tag by primary, baseline the rest, **fail-on-new**
- **`static-group/`** — `CreateTierModal`/`DeleteTierModal` (R0) + `InvitationsPanel`/`ContentSuggestionsPanel` (R1) + `CreateCollectionGoalModal`/`GoalAlignmentSummary` (R3). **Primary tag: Ring 0.** R1/R3 imports baselined; split at F6.
- **`settings/`** — `ApiKeyManager`/`GeneralTab` (Person) + `PriorityTab` (R0) + `DiscoveryTab`/`RecruitmentTab` (R1). **Primary tag: Person.** R0/R1 imports baselined; re-homed into the spine at F6.

### 6.3 Legacy / transitional tier — old-IA, slated for delete/rebuild in F6
- **`group/`** (`MorePage` → deleted, `GoalsPage`, `PluginPage`, `GearSyncDashboard`), **`dashboard/`** (`MyStaticsPanel`). Baselined, **never ratcheted** (no point tightening a dir headed for deletion), removed at F6 rebuild. Still fail-on-new — they are frozen, not open.
- **`admin/`** — *not* legacy; a permanent platform surface, handled as its own element (§5.4), outside the ring graph.

### 6.4 Cross-cutting integration seams (labeled, not breaches)
- **`lodestoneStore`** — equipped-gear verification (Lodestone/Tomestone) that *feeds the gear board* (`PRODUCT_MODEL.md §3.5`). Lives with Ring-0's data layer but is **explicitly tagged a cross-cutting integration seam**, so when Person/Ring-3 surfaces also read gear data through it, the linter's allow-list (and a contributor) sees a labeled seam, not a stray ring breach.

## 7. Deliverable 3 — `backend/ARCHITECTURE.md` Person↔Static note (doc-only)

A backend architecture note mirroring the frontend model — **documentation only, no code, no enforcement** (backend is not CI-gated). Content:
- Which routers/models/`permissions.py` helpers are **Person-domain** vs **Static-domain**, mapped from `PRODUCT_MODEL.md §3.1` and the existing 14 routers / ~23 models.
- The **ownership rule** verbatim as the deciding test: *"if leaving a static erases it → Static-layer; if it survives → Person-layer"* (`PRODUCT_MODEL.md §3.1`/roadmap §1) — e.g. availability is a Person default with an optional per-membership override; a tier snapshot is Static-layer.
- An explicit "no enforcement here, by decision" note pointing back to this spec, so a future reader knows it is deliberate, not an omission.

## 8. Testing & verification

F4 is config + docs, so verification is about *the lint behaving correctly* and *CI staying green*, not runtime tests.

1. **The new rules catch what they should.** Add a temporary fixture import that violates each new rule (outward ring import; store→store; store→component) and confirm eslint flags it at the intended severity (`error` for store rules, `warn` for the ring rule); revert the fixture. (Same toggle-verify discipline as F3's type-tests — prove each rule load-bearing, don't trust a green run.)
2. **Baseline is honest.** The captured ring-violation baseline equals the *current* count; re-running with no source change is green; adding a new outward import fails (fail-on-new proven, including into a mixed dir).
3. **Clean rules are truly clean.** The `error`-tier store rules pass on the unmodified tree (after the §5.2 type tidy / allowlist) — no `eslint-disable` escapes introduced.
4. **`admin` exemption proven.** `admin/`→`viewAsStore` and an admin→Ring-0 read are *not* flagged.
5. **Full CI suite green** on the branch (`tsc -b`, lint, `check:design-system:strict`, test, build) — the whole point of F2's `redesign/**` gating.
6. **Docs self-consistent.** `FRONTEND_STRUCTURE.md`'s map matches the `boundaries/elements` patterns exactly (no domain tagged one ring in the doc and another in the lint).

## 9. Success criteria

- [ ] `design/redesign/FRONTEND_STRUCTURE.md` exists: taxonomy, promotion rule, one-store-per-domain rule, the three-tier Ring map, Person↔Static frontend boundary.
- [ ] `eslint.config.js` extends `boundaries/elements` to the ring/layer set + `admin` distinct element; adds store-boundary rules at `error` (one documented allowlist entry, reason inline) and the ring-inward rule at `warn` + fail-on-new baseline.
- [ ] The 2 `store→component` type-only inversions resolved (types moved or carved out) — store rules land with no new disables.
- [ ] `admin` exempt from ring rules; `lodestoneStore` tagged as an integration seam.
- [ ] `backend/ARCHITECTURE.md` Person↔Static note added (doc-only).
- [ ] Each new rule toggle-verified load-bearing; baseline fail-on-new proven (incl. mixed dirs).
- [ ] Release-notes `{ internal: true }` entry; **no** `CURRENT_VERSION` bump.
- [ ] Full CI green; nothing targets `main`; no AI attribution.

## 10. Open implementation details (settled during planning/execution, not blockers)

- Exact `boundaries/elements` glob strings (esp. mixed-dir file-level patterns) and the chosen baseline mechanism (eslint-plugin-boundaries has no native baseline — likely a per-dir rule list, or a small generated allow-list comment block, mirroring how F2 baselined jscpd/knip). The plan picks the lowest-ceremony mechanism that gives fail-on-new.
- Whether the §5.2 type tidy moves 3 types to `src/types/` (default) or uses an `import type` carve-out.
- The precise Person vs Static classification of each backend router/model in the §7 note (mechanical, from reading the routers).
