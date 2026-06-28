# FFXIV Raid Planner — Frontend Structure

**Phase:** F4 of the redesign foundation (`FOUNDATION_ROADMAP.md §2`).
**Authority:** [`docs/PRODUCT_MODEL.md`](../../docs/PRODUCT_MODEL.md) (§3.1 layers, §3.4 rings, §4 "where does this go?", §5 feature inventory) · [`design/redesign/specs/2026-06-28-f4-frontend-structure-design.md`](specs/2026-06-28-f4-frontend-structure-design.md) (F4 spec).
**Governing principle:** document + enforce **in place** — no file moves this phase. F4 makes the target model legible and adds lint enforcement over the tree as it sits today. F6 rebuilds Ring-0 screens into the final slice shape and physically relocates files.

---

## §1 The Layer/Ring Taxonomy

The frontend is organized into a strict hierarchy of **layers and rings**, innermost to outermost.

**Cardinal rule: imports may only point inward.** An element may import its own tier, any inner ring, the Person layer, the shell, and shared — never an outer ring.

```
shared  ←  shell  ←  person  ←  Ring 0  ←  Ring 1  ←  Ring 2  ←  Ring 3
                                (core loop) (coord)   (intel)   (tracks)

admin-ops = a separate platform surface, OUTSIDE the ring graph (may reach across rings)
```

| Tier | Contents |
|---|---|
| **shared** | `primitives/`, `ui/` — design-system components; no domain knowledge |
| **shell** | `layout/`, `dnd/`, `docs/`; platform stores (`dragStore`, `settingsPanelStore`, `toastStore`, `viewAsStore`) |
| **person** | `profile/`, `auth/`; Person-layer stores (`authStore`, `playerProfileStore`, `personalAvailabilityStore`, `staticCharacterStore`, `notificationStore`, `apiKeyStore`, `collectionIntentStore`) |
| **Ring 0** | Roster · loot · gear/progress — the static's core loop |
| **Ring 1** | Scheduling depth · availability · recruitment/matching |
| **Ring 2** | Intelligence — FFLogs/analytics (reserved; no component dirs yet) |
| **Ring 3** | Long game — mounts, ultimates, alt content tracks |
| **admin** | Platform-ops surface — exempt from ring rules; see §1.1 |

An element importing from its own tier is **same-tier** (legal). An element importing from an inner tier is **inward** (legal). Importing from any outer tier is an **outward edge** (violation).

### §1.1 admin-ops

`admin/` is a **distinct lint element**, permanently outside the ring graph. It is a platform-ops surface (see `PRODUCT_MODEL.md §5` — "separate admin area, not part of the static product"). It legitimately reaches across rings (e.g., admin dashboards reading Ring-0/1/3 data, `admin/` → `viewAsStore`). Ring-inward rules are **never applied** to `admin/` — it is not legacy and it is not exempt by oversight; it is architecturally distinct.

The exemption applies **as an importer only**. `admin/` is a **disallowed import target** for product-ring code — a `ring → admin` import is a violation (admin-ops must not leak into product rings). `history/AllWeeksView` → `admin/SortableHeader` + `admin/sortUtils` is the current example of grandfathered ring0→admin debt (2 edges, baselined in `frontend/eslint-suppressions.json`).

---

## §2 The Promotion Rule

**When ≥ 2 features import the same helper, it moves to `shared/` behind a public API.**

A helper used by exactly one feature stays in that feature. The *second consumer* is the trigger to promote — not speculation, not anticipated reuse. This is the deliberate-reuse governance. The jscpd check (added in F2) already flags accidental copy-paste; this rule governs the deliberate case.

Shared modules expose a public API via an `index.ts` barrel. Features import the barrel — **never deep paths**:

```typescript
// correct
import { GearStatusCircle } from '../../../components/ui';

// wrong — deep path, bypasses the public API contract
import { GearStatusCircle } from '../../../components/ui/GearStatusCircle';
```

---

## §3 One Store per Domain

Each domain owns exactly **one** Zustand store.

**A store must not import another store.** Cross-store coordination goes through explicit utilities in `utils/` or `lib/`. The existing `utils/lootCoordination.ts` is the canonical pattern — state readers passed in as arguments, not store-to-store imports.

**A store must not import a component.** The data layer does not depend on the view layer.

The **component → store** direction (a feature reading its data layer) is normal and allowed. The inversion — a store importing a component — is the dependency smell the rule catches.

### §3.1 Documented exception

`viewAsStore` → `authStore` is the **single allowlist entry**. The reason is encoded inline at the lint rule:

> *Impersonation is inherently auth-coupled — view-as reads the real admin identity (`isAuthenticated` / `user.isAdmin`) to impersonate from; verified a runtime identity read, not a type import.*

Any second store → store import must add its own justified entry. The rule makes the *second* such coupling visible — that is the design working correctly.

---

## §4 The Ring Map

Existing dirs were built bottom-up; several mix rings or are old-IA. The map has **three cleanliness tiers**. Enforcement strictness follows the tier.

> **Terminology note:** The clean/mixed/legacy verdict is an *outward-edge-count* verdict (clean = 0 outward edges originating from the dir). A domain can be *structurally* multi-ring — containing components tagged to different rings, or imported by higher-tier consumers — yet still be edge-count-clean. Do not conflate "structurally spans rings" with "has outward violations." `static-group/` is the key example: it is a multi-ring *target* but emits 0 outward edges itself.

### §4.1 Clean — zero outward edges (ratchet candidates)

These domains import only same-tier or inward elements. They are candidates to ratchet from `warn` to `error` at F6 rebuild (or sooner if independently confirmed).

| Domain / stores | Ring / layer |
|---|---|
| `roster/` `player/` `bis/` `loot/` `priority/` `weapon-priority/` `wizard/` `team/` | **Ring 0** |
| `tierStore` `lootTrackingStore` `staticGroupStore` `sharedBisStore` | **Ring 0** stores |
| `lodestoneStore` | **Ring 0** — *cross-cutting integration seam* (see §4.1.1) |
| `schedule/` `split-clear/` | **Ring 1** |
| `scheduleStore` `availabilityStore` `invitationStore` `joinRequestStore` `contentSuggestionStore` `splitClearStore` | **Ring 1** stores |
| `mount-farms/` `collections/` | **Ring 3** |
| `mountFarmStore` `collectionGoalStore` `objectiveGoalStore` `objectiveCommandStore` | **Ring 3** stores |
| `auth/` | **Person** |
| `authStore` `playerProfileStore` `personalAvailabilityStore` `staticCharacterStore` `notificationStore` `apiKeyStore` `collectionIntentStore` | **Person** stores |
| `dnd/` `docs/` | **Shell** |
| `dragStore` `settingsPanelStore` `toastStore` `viewAsStore` | **Shell** stores |
| `primitives/` `ui/` | **shared** |

*`dashboard/` (§4.3) is old-IA, not a ratchet candidate; has 1 grandfathered outward edge (MyStaticsPanel → wizard). `history/` (§4.2) has 2 ring0→admin edges and `layout/` (§4.2) has 7 shell→outer edges — neither is a ratchet candidate.*

#### §4.1.1 `lodestoneStore` — cross-cutting integration seam

`lodestoneStore` handles Lodestone/Tomestone equipped-gear verification that feeds the gear board (`PRODUCT_MODEL.md §3.5`). It lives with Ring-0's data layer but is **explicitly tagged a cross-cutting integration seam** — not a ring breach. When Person-layer or Ring-3 surfaces also read gear data through it, the lint allowlist (and a contributor reading this doc) sees a labeled seam, not a stray violation. Label in the lint config: `// cross-cutting integration seam (PRODUCT_MODEL §3.5) — not a ring breach`.

### §4.2 Mixed / Structural Multi-Ring — tag by primary; fail-on-new for outward edges

This tier has two sub-types: **structurally multi-ring** (a domain whose *contents* span multiple rings but which emits 0 outward edges itself) and **spanner** (a domain that actively *imports* from outer rings and has measured outward edges).

The baseline grandfathers *existing* outward edges. A **new** outward edge fails immediately, even into an already-spanner dir. The mess is frozen at today's size — the baseline licenses existing debt, not new debt.

#### `static-group/` — Ring 0 primary, structurally multi-ring, **0 outward edges**

Contains components from multiple rings: `CreateTierModal`/`DeleteTierModal` (Ring 0) + `InvitationsPanel`/`ContentSuggestionsPanel` (Ring 1) + `CreateCollectionGoalModal`/`GoalAlignmentSummary` (Ring 3). **Primary tag: Ring 0.**

`static-group/` itself emits **0 outward edges** — no suppressions needed. The cross-ring surface area is expressed as inbound imports *into* `static-group/` from higher-tier consumers (e.g., `settings/` imports `static-group/ContentSuggestionsPanel`). Those outward edges are counted against the importer (`settings/`), not against `static-group/`. This dir will be split at F6 as the spine is rebuilt.

#### `settings/` — Person primary, **12 outward edges**

Aggregates Ring-0 priority panels (`priority/ModeSelector`, `priority/RoleBasedEditor`, `priority/JobBasedEditor`, `priority/PlayerBasedEditor`, `priority/AdvancedOptions`) and Ring-1 recruitment panels (`static-group/InvitationsPanel`, `static-group/JoinRequestsPanel`, `static-group/ContentSuggestionsPanel`, `static-group/ObjectiveGoalsPanel`) plus Ring-0 static management panels (`static-group/MembersPanel`, `static-group/CreateCollectionGoalModal`), and a Ring-0 player component (`player/WorldSelect`). This is structural: a settings aggregator by design. To be re-homed into the spine at F6.

#### `profile/` — Person primary, **5 outward edges** (measured in Task 1; "surprise")

`profile/` was expected clean but measured 5 outward edges:
- `CharacterLinkModal` → `player/WorldSelect` (Ring 0)
- `ManageBiSModal` → `bis/BiSTargetManagerModal` (Ring 0)
- `PersonalAvailabilityEditor` → `schedule/availabilityUtils` (Ring 1)
- `CollectionsTab` → `mount-farms/FarmProgress` + `mount-farms/farmProgressUtils` (Ring 3)

Structurally equivalent to `settings/` (a Person-layer surface pulling in ring content). All 5 are suppressible and will be re-homed at F6.

#### `layout/` — Shell primary, **7 outward edges** (shell → outer)

`layout/` wires the application shell — header, navigation rail, global settings panel, settings dock toggle, settings panel controller, and sidebar nav. Six files import from tiers outer than shell (auth, settings, static-group, admin):

- `GlobalSettingsPanel.tsx` — 1 edge
- `Header.tsx` — 2 edges
- `Layout.tsx` — 1 edge
- `SettingsDockToggle.tsx` — 1 edge
- `SettingsPanelController.tsx` — 1 edge
- `SidebarNav.tsx` — 1 edge

These are genuine shell→outer violations: the shell wires auth/settings/static-switching directly rather than through page-level orchestration. All 7 are grandfathered in `frontend/eslint-suppressions.json`. The coupling lifts to page-level at F6 when the navigation rail is rebuilt.

#### `history/AllWeeksView.tsx` — Ring 0, **2 outward edges** (ring0 → admin)

`history/AllWeeksView.tsx` imports `admin/SortableHeader` and `admin/sortUtils`. These are `ring0 → admin` violations — `admin/` is a **disallowed import target** for product-ring code (see §1.1). Both edges are grandfathered in `frontend/eslint-suppressions.json`.

### §4.3 Legacy / Transitional — old-IA; frozen, never ratcheted, deleted at F6

Baselined as-is. **Still fail-on-new** — frozen does not mean open. Never ratcheted to `error` because there is no point tightening a dir slated for deletion.

| Domain | Primary tag | Outward edges | Notes |
|---|---|---|---|
| `group/` | Ring 0 | 1 | `GoalsPage` → `collections/CollectionsHub`; contains `MorePage` (slated for deletion per `PRODUCT_MODEL.md §5`), `GoalsPage`, `PluginPage`, `GearSyncDashboard` |
| `dashboard/` | Person | 1 | `MyStaticsPanel` → `wizard/` (Ring 0); old-IA "my statics" surface; removed at F6 |

`admin/` is **not** legacy. It is a permanent platform-ops surface handled as its own lint element (§1.1), outside the ring graph.

---

## §5 Person ↔ Static Boundary (Frontend)

**The deciding test** (from `PRODUCT_MODEL.md §3.1`):
> *If leaving a static erases it → Static-layer. If it survives → Person-layer.*

Example: you set your personal availability once; every static you're in reads it into its scheduling heatmap. A tier snapshot belongs to the static — it is erased when you leave the static. This layering is also the engineering boundary: Person-domain modules must not be entangled with Static-domain modules.

The Person layer sits **inward** of the rings in the import hierarchy (see §1 diagram). The lint partially enforces this boundary: a ring-layer element importing a person-layer element is a legal inward import; a person-layer element importing a ring-layer element is an outward violation (baselined for `settings/` and `profile/` today; tightens at F6).

### §5.1 Person-layer (survives leaving a static)

| Domain / store | Kind | What it holds |
|---|---|---|
| `auth/` | Component domain | Login button, user menu, protected-route wrapper, notification center |
| `profile/` | Component domain (mixed spanner — §4.2) | Character linking, BiS management, personal availability editor, collections tab |
| `authStore` | Store | Discord OAuth identity, session state, admin flag |
| `playerProfileStore` | Store | Personal character and profile data |
| `personalAvailabilityStore` | Store | Availability defaults fed into static scheduling heatmaps |
| `staticCharacterStore` | Store | Character linking/sync (Lodestone identity binding) |
| `notificationStore` | Store | Cross-static notifications (join requests, sessions, etc.) |
| `apiKeyStore` | Store | Dalamud plugin / REST API keys |
| `collectionIntentStore` | Store | Personal collection/mount intent (aggregated into Static tracks) |

*Legacy Person-layer domain: `dashboard/` (slated for deletion at F6) — see §4.3.*

### §5.2 Static-layer (erased when leaving the static)

All Ring-0, Ring-1, and Ring-3 component domains and their stores describe the state of a specific static and are scoped to it.

| Domain / store | Ring | Why Static |
|---|---|---|
| `roster/` `player/` `bis/` `loot/` `priority/` `weapon-priority/` `history/` `wizard/` `team/` `static-group/` | Ring 0 | Roster, gear board, loot loop — all scoped to the static |
| `tierStore` `lootTrackingStore` `staticGroupStore` `sharedBisStore` | Ring 0 stores | Tier/loot/BiS state for this static's current savage track |
| `schedule/` `split-clear/` | Ring 1 | The static's session clock and split-clear planner |
| `scheduleStore` `availabilityStore` `invitationStore` `joinRequestStore` `contentSuggestionStore` `splitClearStore` | Ring 1 stores | Sessions, RSVPs, availability aggregated to the static's heatmap, recruitment state |
| `mount-farms/` `collections/` | Ring 3 | Farm and collection goal progress for this static |
| `mountFarmStore` `collectionGoalStore` `objectiveGoalStore` `objectiveCommandStore` | Ring 3 stores | Track progress scoped to the static |

*Legacy Static-layer domain: `group/` (old-IA, rebuilt/deleted at F6) — see §4.3.*

### §5.3 Shell / platform (neither layer — cross-cutting)

`layout/`, `dnd/`, `docs/`; `dragStore`, `settingsPanelStore`, `toastStore`, `viewAsStore` serve all surfaces and belong to neither layer. `settings/` is Person-primary (configures the session operator) but currently aggregates Ring-0/1 panels — the boundary tightens as panels are re-homed at F6.

---

## §6 Enforcement Mechanism

The layer/ring taxonomy above is **machine-checked** by `frontend/eslint.config.js` using the `eslint-plugin-boundaries` package (introduced in F2).

### §6.1 What the lint encodes

| Rule | Severity | Scope |
|---|---|---|
| Store must not import another store | `error` | All stores; one documented allowlist entry: `viewAsStore` → `authStore` (§3.1) |
| Store must not import a component | `error` | All stores; two `import type`-only violations resolved at F4 by moving the 3 types to `src/types/` |
| Ring-inward-only (cardinal rule) | `warn` + fail-on-new | All ring/layer elements except `admin` |

Store-boundary rules land at `error` because the tree is already clean (after the §6.2 type tidy). The ring-inward rule lands at `warn` because the tree has baselined outward edges in the mixed and legacy tiers.

### §6.2 How debt is managed

Existing grandfathered cross-ring violations are captured in `frontend/eslint-suppressions.json` (ESLint 9 native bulk suppressions). The F4 baseline contains **28 grandfathered edges across 17 files** — contributors: `settings/` (12), `profile/` (5), `layout/` (7, shell→outer), `history/AllWeeksView` (2, ring0→admin), `dashboard/MyStaticsPanel` (1, person→ring0), `group/GoalsPage` (1, ring0→ring3). `frontend/eslint-suppressions.json` is the authoritative live source; it supersedes any counts cited in design docs. The baseline freezes the mess at its current size.

**Fail-on-new is mandatory**, including for the mixed dirs (`settings/`, `profile/`, `static-group/`). Adding a new outward import into any dir — even one already in the baseline — **fails immediately**. The baseline licenses existing debt, not new debt. Without this constraint, "it's already mixed" would turn the spanner dirs into dumping grounds for the entire F4→F6 window.

### §6.3 Ratchet path

As F6 rebuilds each Ring-0 screen:
1. Its ring rule flips from `warn` to `error`.
2. Its baseline entries are pruned with `--prune-suppressions`.
3. The domain graduates to "ratcheted clean" and is noted in the F6 PR.

The ratchet is per-domain and incremental — the whole tree does not need to be clean before the first domain graduates.

### §6.4 Permanent exceptions

Three distinct mechanisms handle the cases that should never appear in `eslint-suppressions.json`:

**1. Permanent-by-design store exception — inline disable at the import site.**
`viewAsStore` → `authStore` is handled with an `eslint-disable-next-line boundaries/dependencies` comment directly in `frontend/src/stores/viewAsStore.ts`, not a config allowlist entry:

```typescript
// eslint-disable-next-line boundaries/dependencies -- impersonation is inherently auth-coupled: view-as reads the real admin identity (isAuthenticated / user.isAdmin) to impersonate from. The second store wanting auth must add its own justified entry.
import { useAuthStore } from './authStore';
```

**2. `admin/` exemption — structural (no `from` rule applied).**
`admin` is a distinct `boundaries/elements` type with no inward-only disallow rule applied to it. It sits outside the ring graph by construction (§1.1), so there is nothing to exempt — the rule simply does not exist for `admin` as an origin. This is not an allowlist entry; it is the absence of a rule.

**3. Grandfathered cross-ring debt — `frontend/eslint-suppressions.json`.**
Existing outward edges in the mixed and legacy tiers are captured in `frontend/eslint-suppressions.json` (ESLint 9.39 native bulk suppressions). This is the mechanism described in §6.2. As F6 rebuilds each domain, its entries are pruned with `--prune-suppressions` and the rule ratchets to `error`.
