# F4 Cross-Ring Import Inventory (Baseline Measurement)

> **Purpose:** Ground-truth data for Task 2 (ESLint boundary map) and Task 4 (suppressions baseline).  
> **Scope:** `frontend/src/components/**` — component-to-component imports only.  
> **Date:** 2026-06-28  
> **Method:** `grep -rnoE "from '(\.\.?\/)+[a-z-]+\/" src/components` (relative sibling form) + `from '(@/components)/[a-z-]+/'` (alias form — produced zero matches; codebase uses relative imports only).

---

## 1. Ring-Tag Map

> Verbatim from spec §6. Judgment calls noted inline.

| Domain | Ring Tag | Notes |
|--------|----------|-------|
| `primitives` | shared | innermost |
| `ui` | shared | innermost |
| `layout` | shell | |
| `dnd` | shell | |
| `docs` | shell | |
| `profile` | person | |
| `auth` | person | **Not listed in brief's 24-domain count** (25 dirs total on disk); classified as `person` — contains LoginButton, UserMenu, ProtectedRoute, NotificationCenter (all Person-layer surface) |
| `dashboard` | person | "my statics" panel; legacy |
| `settings` | person | **primary tag; spans R0/R1 — mixed** |
| `roster` | ring0 | |
| `player` | ring0 | |
| `bis` | ring0 | |
| `loot` | ring0 | |
| `priority` | ring0 | |
| `weapon-priority` | ring0 | |
| `history` | ring0 | |
| `wizard` | ring0 | |
| `team` | ring0 | |
| `static-group` | ring0 | **primary tag; spans R1/R3 — mixed** |
| `group` | ring0 | **legacy; GearSyncDashboard-dominant; slated for deletion at F6** |
| `schedule` | ring1 | |
| `split-clear` | ring1 | |
| `mount-farms` | ring3 | |
| `collections` | ring3 | |
| `admin` | admin | **EXEMPT — outside ring graph; never counted as from-violator or to-target** |

**Tier order (innermost → outermost):** shared(0) ← shell(1) ← person(2) ← ring0(3) ← ring1(4) ← ring3(6)

**Violation rule:** `importer_tier < imported_tier` → outward (illegal) edge.  
**Legal:** same-tier and inward (importer_tier ≥ imported_tier).

---

## 2. Outward Component Import Edge Table

18 outward violations found. All are in `settings/` (person-tier), `profile/` (person-tier), and `group/` (ring0) — the expected spanners.

| # | from-file | from-ring | to-file | to-ring | violation type |
|---|-----------|-----------|---------|---------|----------------|
| 1 | `settings/SettingsPanel.tsx` | person | `static-group/MembersPanel.tsx` | ring0 | person → ring0 |
| 2 | `settings/SettingsPanel.tsx` | person | `static-group/ObjectiveGoalsPanel.tsx` | ring0 | person → ring0 |
| 3 | `settings/SettingsPanel.tsx` | person | `static-group/ContentSuggestionsPanel.tsx` | ring0 | person → ring0 |
| 4 | `settings/SettingsPanel.tsx` | person | `static-group/CreateCollectionGoalModal.tsx` | ring0 | person → ring0 |
| 5 | `settings/RecruitmentTab.tsx` | person | `static-group/InvitationsPanel.tsx` | ring0 | person → ring0 |
| 6 | `settings/RecruitmentTab.tsx` | person | `static-group/JoinRequestsPanel.tsx` | ring0 | person → ring0 |
| 7 | `settings/PriorityTab.tsx` | person | `priority/ModeSelector.tsx` | ring0 | person → ring0 |
| 8 | `settings/PriorityTab.tsx` | person | `priority/RoleBasedEditor.tsx` | ring0 | person → ring0 |
| 9 | `settings/PriorityTab.tsx` | person | `priority/JobBasedEditor.tsx` | ring0 | person → ring0 |
| 10 | `settings/PriorityTab.tsx` | person | `priority/PlayerBasedEditor.tsx` | ring0 | person → ring0 |
| 11 | `settings/PriorityTab.tsx` | person | `priority/AdvancedOptions.tsx` | ring0 | person → ring0 |
| 12 | `settings/DiscoveryTab.tsx` | person | `player/WorldSelect.tsx` | ring0 | person → ring0 |
| 13 | `profile/CharacterLinkModal.tsx` | person | `player/WorldSelect.tsx` | ring0 | person → ring0 |
| 14 | `profile/ManageBiSModal.tsx` | person | `bis/BiSTargetManagerModal.tsx` | ring0 | person → ring0 |
| 15 | `profile/PersonalAvailabilityEditor.tsx` | person | `schedule/availabilityUtils.ts` | ring1 | person → ring1 |
| 16 | `profile/CollectionsTab.tsx` | person | `mount-farms/FarmProgress.tsx` | ring3 | person → ring3 |
| 17 | `profile/CollectionsTab.tsx` | person | `mount-farms/farmProgressUtils.ts` | ring3 | person → ring3 |
| 18 | `group/GoalsPage.tsx` | ring0 | `collections/CollectionsHub.tsx` | ring3 | ring0 → ring3 |

### Store-boundary facts (pre-measured, per brief)

These are included for completeness — not component→component edges but noted for Task 4:

- `stores/viewAsStore.ts` → `stores/authStore.ts` (value import)
- `stores/dragStore.ts` → `components/dnd/collisionDetection` (`import type`, DropMode only)
- `stores/settingsPanelStore.ts` → `components/settings` (`import type`, SettingsTab + RecruitmentSection only)

---

## 3. Per-Domain Verdict

**Verdict legend:** The clean/mixed/legacy verdict is an **outward-edge-count** verdict; a domain can be *structurally* multi-ring (spanning multiple rings as an import target) yet still be edge-count-clean—`static-group` exemplifies this.

| Domain | Ring | Verdict | Outward edges |
|--------|------|---------|---------------|
| `primitives` | shared | **clean** | 0 |
| `ui` | shared | **clean** | 0 (intra-shared imports from primitives are same-tier = legal) |
| `layout` | shell | **clean** | 0 |
| `dnd` | shell | **clean** | 0 |
| `docs` | shell | **clean** | 0 |
| `auth` | person | **clean** | 0 |
| `dashboard` | person | **clean** | 0 |
| `settings` | person | **mixed/legacy** | 12 (expected — settings aggregates ring0 panels by design) |
| `profile` | person | ⚠️ **surprise** | 5 (see note below) |
| `roster` | ring0 | **clean** | 0 |
| `player` | ring0 | **clean** | 0 |
| `bis` | ring0 | **clean** | 0 |
| `loot` | ring0 | **clean** | 0 |
| `priority` | ring0 | **clean** | 0 |
| `weapon-priority` | ring0 | **clean** | 0 |
| `history` | ring0 | **clean** | 0 (imports from `admin/` are admin-exempt) |
| `wizard` | ring0 | **clean** | 0 |
| `team` | ring0 | **clean** | 0 |
| `static-group` | ring0 | **clean (0 outward edges)** — structurally multi-ring (spans R0/R1/R3 as an import target), no suppressions needed | (inbound edges from person/settings are counted against settings) |
| `group` | ring0 | **legacy** | 1 (GoalsPage → collections; expected for a legacy "catch-all" page) |
| `schedule` | ring1 | **clean** | 0 |
| `split-clear` | ring1 | **clean** | 0 |
| `mount-farms` | ring3 | **clean** | 0 |
| `collections` | ring3 | **clean** | 0 |
| `admin` | admin | **exempt** | — |

### Surprise: `profile/` has 5 outward edges

`profile` is tagged `person` (tier 2). The violations are functional:
- `profile/CharacterLinkModal.tsx` → `player/WorldSelect` — embeds a ring0 reusable component
- `profile/ManageBiSModal.tsx` → `bis/BiSTargetManagerModal` — re-surfaces the ring0 modal
- `profile/PersonalAvailabilityEditor.tsx` → `schedule/availabilityUtils` — uses ring1 utility logic
- `profile/CollectionsTab.tsx` → `mount-farms/FarmProgress` + `mount-farms/farmProgressUtils` — renders ring3 farm progress within a person-layer tab

These were not explicitly called out as "known spanners" in the brief, but are structurally equivalent to the `settings` violations (a person-layer surface pulling in ring-content). They will be suppressed in the Task 4 baseline alongside settings.

---

## 4. Sanity Check

- **Total outward edges:** 18
- **Scale:** "tens, not hundreds" ✓
- **Concentration:** `settings/` (12) + `profile/` (5) + `group/` (1) = 18 — concentrated in the expected spanners ✓
- **All ring3/ring1/ring0 pure dirs:** clean ✓ (ring3 → shared, ring0 → shared/person/shell are all legal inward imports)
- **`@/components/` alias form:** zero matches — codebase uses only relative imports ✓
- **`../../components/` deep-relative form:** 1 match (`collections/CatalogBrowse.tsx` → `ui/Input`), classified legal (ring3 → shared) ✓

---

## 5. Additional Observations

- `history/AllWeeksView.tsx` imports `admin/SortableHeader` and `admin/sortUtils` (ring0 → admin). Not counted — admin is exempt as a to-target per spec.
- `primitives/Button.tsx` imports `ui/Spinner` (shared → shared, same tier). Legal but worth noting: within the shared tier, primitives reaching into ui is unusual. Not a ring violation; may be flagged separately in F4's boundary refinement.
- `split-clear/SplitClearAssignmentBoard.tsx` imports `player/WorldSelect` (ring1 → ring0). Legal inward import.
- `roster/AddManualCharacterModal.tsx` and `wizard/RosterSlot.tsx` both import from `player/` (ring0 → ring0, same tier). Legal.
