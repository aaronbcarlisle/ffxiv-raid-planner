# F4 — Frontend Structure (Feature-Slice + Shared-Layer Model) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `PRODUCT_MODEL.md` layer/ring model machine-checked — a contributor-facing structure doc + a Ring-aware ESLint import graph + store-boundary rules — without moving any files.

**Architecture:** Extend F2's `eslint-plugin-boundaries` block from 3 elements / 1 rule into a Ring-aware element set with inward-only dependency rules and store-boundary rules. Existing bottom-up cross-ring debt is grandfathered via ESLint 9.39 **native bulk suppressions** (`eslint-suppressions.json`), so the rules land at `error` (per-edge fail-on-new) yet CI is green on day one. The one permanent-by-design store coupling gets an inline `eslint-disable` with a reason; type-only store→component imports are permitted by the selector-level `dependency: { kind: 'value' }` filter (the rule restricts *value* imports only — the deprecated rule-level `importKind` form fails the v6.0.2 schema, so `dependency.kind` is used). A doc-only backend note mirrors the boundary. No file moves — F6 rebuilds Ring-0 into the final slice shape.

**Tech Stack:** ESLint 9.39 (flat config + bulk suppressions), `eslint-plugin-boundaries` ^6.0.2, TypeScript, Zustand, React 19, pnpm, Vitest.

## Global Constraints

- **Branch:** `redesign/f4-frontend-structure` off `redesign/foundation` @ `0303caa` (already created; spec committed at `3098530`). PR into `redesign/foundation` → squash-merge. **Nothing targets `main`.**
- **No AI attribution** in any commit or PR (absolute — `CLAUDE.md`).
- **Document + enforce in place — NO file moves / dir restructuring.** The slice shape lands at F6.
- **Bless-don't-purge / baseline-then-ratchet** — grandfather existing debt, fail on new; never churn code to satisfy the linter.
- **CI gates this PR** (F2 added `redesign/**` triggers). Full suite must be green on land: `pnpm build` (`tsc -b && vite build`) → `pnpm lint` → `pnpm check:design-system:strict` → `pnpm test`. New `error`-tier rules must be green-on-land (clean dirs verified clean; debt suppressed).
- **Release notes:** add an entry to `frontend/src/data/releaseNotes.ts` with `internal: true`. **Do NOT bump `CURRENT_VERSION`.**
- **Run all `pnpm`/`git` commands from `frontend/`** unless a path says otherwise. Dates in release notes are full ISO 8601.
- **Authority docs** (read if context is thin): `design/redesign/specs/2026-06-28-f4-frontend-structure-design.md` (this plan's spec), `docs/PRODUCT_MODEL.md` (§3.1 layers, §3.4 rings, §4 "where does this go?", §5 feature→ring inventory), `FOUNDATION_ROADMAP.md` (F4 row + §0 reframe).

---

### Task 1: Cross-ring import inventory (measurement)

Produce the ground-truth data that drives the suppressions baseline and confirms which dirs are genuinely clean. Everything downstream depends on this being accurate.

**Files:**
- Create: `design/redesign/specs/f4-import-inventory.md` (committed analysis artifact)

**Interfaces:**
- Produces: a table of every **outward / cross-ring** component import edge (`from-file → to-file`, with from-ring and to-ring), plus the confirmed ring tag for each of the 24 `components/*` domains. Tasks 2 and 4 consume this — Task 2 to write the map's cleanliness tiers accurately, Task 4 to know exactly which edges the suppressions file must contain.

- [ ] **Step 1: Define the ring tag for every component domain**

Use this mapping (from spec §6; primary-tag for mixed dirs). Record it verbatim at the top of the inventory file:

```
shared  : primitives, ui
shell   : layout, dnd, docs
person  : profile, auth, dashboard          (dashboard = "my statics", Person-layer; legacy)
ring0   : roster, player, bis, loot, priority, weapon-priority, history, wizard, team,
          static-group (primary tag; spans R1/R3 — mixed),
          group (legacy; GearSyncDashboard-dominant — slated for deletion at F6)
ring1   : schedule, split-clear
ring3   : mount-farms, collections
admin   : admin                              (distinct element; outside ring graph)
```
`settings/` is **person** primary (spans R0/R1). Note `static-group`, `settings`, `group`, `dashboard` as the mixed/legacy dirs whose outward edges will be suppressed.

- [ ] **Step 2: Build the cross-ring import edge list**

From `frontend/`, enumerate every import from one component domain to another and keep only the **outward** ones (per the inward-only rule: a ring may import inner rings + person + shell + shared; never an outer ring; person/shell never import rings; admin is exempt). Run:

```bash
cd frontend
# All cross-domain component→component imports (relative ../ and @/ alias forms):
grep -rnoE "from '(\.\.?\/)+components\/[a-z-]+\/" src/components \
  | grep -vE "\.test\." \
  > /tmp/f4-edges-raw.txt
wc -l /tmp/f4-edges-raw.txt
```

Then for each edge, classify `from-ring`→`to-ring` using the Step-1 map, and **keep only outward edges** (the violations). Also capture the two known store-boundary facts (already measured): `stores/viewAsStore.ts → stores/authStore.ts` (value), and the 2 type-only `stores → components` imports (`dragStore`←`dnd/collisionDetection#DropMode`, `settingsPanelStore`←`settings#SettingsTab,RecruitmentSection`).

- [ ] **Step 3: Record the inventory**

Write `design/redesign/specs/f4-import-inventory.md` with: (a) the ring-tag map from Step 1; (b) a table of outward component edges `from-file | from-ring | to-file | to-ring`; (c) a per-domain "clean / mixed / legacy" verdict — **clean = produced zero outward edges**. Flag any surprise (a dir tagged clean in the spec that actually has outward edges) explicitly; it will become a suppressed edge, not a blocker.

- [ ] **Step 4: Sanity-check the count**

Run: the edge table should be small (tens, not hundreds — most imports are inward or same-domain). If it is implausibly large, re-check the from/to ring classification before trusting it.
Expected: a finite, reviewable list of outward edges concentrated in `static-group/`, `settings/`, `group/` (the known spanners).

- [ ] **Step 5: Commit**

```bash
cd /d/FFXIV/Dev/xrp-dev/ffxiv-raid-planner
git add design/redesign/specs/f4-import-inventory.md
git commit -m "docs(redesign): F4 cross-ring import inventory (baseline measurement)"
```

---

### Task 2: Write `FRONTEND_STRUCTURE.md` (the structure doc)

The canonical contributor-facing "where does this go?" for the frontend.

**Files:**
- Create: `design/redesign/FRONTEND_STRUCTURE.md`

**Interfaces:**
- Consumes: Task 1's ring-tag map + cleanliness verdicts.
- Produces: the doc that the lint config (Tasks 3–4) must stay consistent with (same ring membership, same element names).

- [ ] **Step 1: Write the doc**

Create `design/redesign/FRONTEND_STRUCTURE.md` with these sections (content per spec §4, sharpened by Task 1's data):

1. **Header** — phase pointer, authority (`PRODUCT_MODEL.md`, the F4 spec), "document + enforce in place; F6 moves files."
2. **§1 The layer/ring taxonomy** — the inward-only diagram:
   ```
   shared ← shell ← person ← Ring0 ← Ring1 ← Ring2 ← Ring3
   (cardinal rule: imports point inward only)
   admin-ops = separate platform surface, OUTSIDE the ring graph (may reach across rings)
   ```
   State the rule: an element may import its own tier, any inner tier, person, shell, and shared — never an outer ring.
3. **§2 The promotion rule** — "≥2 features import it → it moves to `shared/` behind a public API (`index.ts` barrel); features import the barrel, not deep paths." jscpd (F2) catches accidental copy-paste; this is the deliberate-reuse governance.
4. **§3 One store per domain** — a store must not import another store; cross-store coordination via `utils/`/`lib/` (pattern: `utils/lootCoordination.ts`). Component→store (reading the data layer) is normal/allowed; store→component is the inversion. The single documented exception: `viewAsStore→authStore` (impersonation is inherently auth-coupled — view-as reads the real admin identity to impersonate from).
5. **§4 The Ring map (three cleanliness tiers)** — paste Task 1's confirmed table, grouped:
   - **Clean** (ratchet candidates): list dirs with zero outward edges.
   - **Mixed** (`static-group/`→R0 primary, `settings/`→person primary): which rings each spans, why permissive now, tightens at F6.
   - **Legacy** (`group/`, `dashboard/`): old-IA, frozen, deleted/rebuilt at F6.
   - Note `admin/` (distinct, exempt) and `lodestoneStore` (cross-cutting integration seam feeding the gear board — labeled, not a breach).
6. **§5 Person↔Static boundary (frontend)** — which stores/domains are Person-layer (survive leaving a static) vs Static-layer (erased on leave), per `PRODUCT_MODEL.md §3.1`. Person: `authStore`, `playerProfileStore`, `personalAvailabilityStore`, `staticCharacterStore`, `notificationStore`, `apiKeyStore`, `collectionIntentStore`, `profile/`, `auth/`. Static: `tierStore`, `lootTrackingStore`, `staticGroupStore`, `scheduleStore`, `availabilityStore`, etc. + all Ring-0/1/3 component domains.
7. **§6 Enforcement mechanism** — the lint encodes this; debt is grandfathered via `eslint-suppressions.json` (ratcheted with `--prune-suppressions` at F6); permanent exceptions use inline `eslint-disable` + reason. Per-edge fail-on-new. Point to `eslint.config.js`.

- [ ] **Step 2: Consistency check**

Run: re-read §4/§5 against Task 1's map and the spec §6. Confirm no domain is tagged one ring here and another in Task 1. Fix inline.
Expected: identical ring membership in doc, inventory, and (after Task 3) lint config.

- [ ] **Step 3: Commit**

```bash
cd /d/FFXIV/Dev/xrp-dev/ffxiv-raid-planner
git add design/redesign/FRONTEND_STRUCTURE.md
git commit -m "docs(redesign): F4 FRONTEND_STRUCTURE — layer/ring taxonomy, promotion + store rules, Ring map"
```

---

### Task 3: Boundaries elements + store-boundary rules (the clean `error` tier)

Expand `boundaries/elements` to the Ring-aware set and add the store rules that the tree already satisfies. **No suppressions yet** — this task must be green on the unmodified tree (store rules), proving the clean part stands on its own.

**Files:**
- Modify: `frontend/eslint.config.js` (the `settings['boundaries/elements']` array + the `boundaries/dependencies` rule, currently lines ~44–78)
- Modify: `frontend/src/stores/viewAsStore.ts:10` (inline disable + reason)

**Interfaces:**
- Consumes: Task 1's ring tags.
- Produces: the element set + store rules that Task 4's ring-inward rules extend. Element type names: `shared`, `shell`, `person`, `ring0`, `ring1`, `ring3`, `admin`, `store`, `page`, `service`.

- [ ] **Step 1: Replace `boundaries/elements`**

In `frontend/eslint.config.js`, replace the current 3-element array with:

```js
'boundaries/elements': [
  { type: 'shared',  pattern: 'src/components/(primitives|ui)/**' },
  { type: 'shell',   pattern: 'src/components/(layout|dnd|docs)/**' },
  { type: 'person',  pattern: 'src/components/(profile|auth|dashboard)/**' },
  { type: 'ring0',   pattern: 'src/components/(roster|player|bis|loot|priority|weapon-priority|history|wizard|team|static-group|group)/**' },
  { type: 'ring1',   pattern: 'src/components/(schedule|split-clear)/**' },
  { type: 'ring3',   pattern: 'src/components/(mount-farms|collections)/**' },
  { type: 'admin',   pattern: 'src/components/admin/**' },
  { type: 'settings', pattern: 'src/components/settings/**' }, // mixed, person-primary; separate so its debt is visible
  { type: 'store',   pattern: 'src/stores/**', mode: 'file' },
  { type: 'page',    pattern: 'src/pages/**', mode: 'file' },
  { type: 'service', pattern: 'src/services/**', mode: 'file' },
],
```

> Note: `settings/` gets its own element (person-primary in spirit) so its spanning edges are legible in suppressions; it is treated as `person`-tier for the inward rule (Task 4). `static-group`/`group` fold into `ring0` per their primary/dominant tag.

- [ ] **Step 2: Replace the `boundaries/dependencies` rule with the store-boundary rules**

Replace the current single-rule `boundaries/dependencies` block with (ring rules added in Task 4 — this step adds only the shared-leaf carry-over + store rules):

```js
'boundaries/dependencies': ['error', {
  default: 'allow',
  rules: [
    // F2 carry-over: shared leaf imports nothing outward.
    {
      from: { type: 'shared' },
      disallow: { to: { type: ['shell', 'person', 'ring0', 'ring1', 'ring3', 'admin', 'settings'] } },
      message: 'Shared layer (primitives/ui) must not import feature/app modules. Keep it leaf-level.',
    },
    // One store per domain: a store must not import another store.
    {
      from: { type: 'store' },
      disallow: { to: { type: 'store' } },
      message: 'One store per domain: a store must not import another store. Coordinate via utils/ (see utils/lootCoordination.ts). Single documented exception: viewAsStore→authStore.',
    },
    // Data layer must not depend on the view layer — value imports only.
    // Type-only imports erase at runtime (no coupling) and are permitted.
    {
      from: { type: 'store' },
      disallow: { to: { type: ['shared', 'shell', 'person', 'ring0', 'ring1', 'ring3', 'admin', 'settings'] }, importKind: 'value' },
      message: 'A store (data layer) must not import a component (view layer). Type-only imports are allowed.',
    },
  ],
}],
```

> **`importKind` verification:** confirm the exact v6 key/placement for type-vs-value selection against the plugin docs (Context7: `eslint-plugin-boundaries`, or `node_modules/eslint-plugin-boundaries/README.md`). If `importKind` on the `to` selector is unsupported in 6.0.2, fall back to: keep the rule without `importKind` and add an inline `// eslint-disable-next-line boundaries/dependencies -- type-only import, no runtime coupling` at `dragStore.ts:14` and `settingsPanelStore.ts:14`. Either way: zero file moves.

- [ ] **Step 3: Add the inline exception at viewAsStore**

In `frontend/src/stores/viewAsStore.ts`, change line 10 to:

```ts
// eslint-disable-next-line boundaries/dependencies -- impersonation is inherently auth-coupled: view-as reads the real admin identity (isAuthenticated / user.isAdmin) to impersonate from. The second store wanting auth must add its own justified entry.
import { useAuthStore } from './authStore';
```

- [ ] **Step 4: Write the failing fixtures, verify each store rule fires**

Temporarily add to `frontend/src/stores/toastStore.ts` (a leaf store) two probe imports:

```ts
import { useAuthStore as _probe } from './authStore'; // store→store probe
import { Button as _probeC } from '../components/primitives/Button'; // store→component value probe
```

Run: `cd frontend && pnpm lint 2>&1 | grep -E "boundaries/dependencies"`
Expected: TWO `boundaries/dependencies` errors on `toastStore.ts` — one "must not import another store", one "must not import a component". (If `importKind` works, the value import of `Button` errors; a `import type` of a component type would NOT.)

- [ ] **Step 5: Verify the type-only carve-out (if importKind used)**

Change the component probe to type-only: `import type { ButtonProps as _t } from '../components/primitives/Button';`
Run: `pnpm lint 2>&1 | grep "toastStore"`
Expected: only the store→store error remains; the type-only import is NOT flagged. (Skip this step if you took the inline-disable fallback in Step 2.)

- [ ] **Step 6: Remove the probes, confirm green**

Delete both probe lines from `toastStore.ts`. Run: `cd frontend && pnpm lint`
Expected: **zero `boundaries/dependencies` errors** — the store rules pass on the real tree (viewAsStore's lone coupling is inline-disabled; the 2 type-only store→component imports are permitted/disabled). Note: ring-inward violations don't exist yet (rules added in Task 4).

- [ ] **Step 7: Type-check + commit**

Run: `cd frontend && pnpm build`
Expected: `tsc -b && vite build` clean (no file moved; only a comment + config changed).

```bash
cd /d/FFXIV/Dev/xrp-dev/ffxiv-raid-planner
git add frontend/eslint.config.js frontend/src/stores/viewAsStore.ts
git commit -m "feat(lint): F4 Ring-aware boundary elements + store-boundary rules (error)"
```

---

### Task 4: Ring-inward rule + ESLint bulk-suppressions baseline (fail-on-new)

Add the inward-only ring rules at `error`, then grandfather the existing cross-ring debt into `eslint-suppressions.json` so CI is green today while any new outward import fails.

**Files:**
- Modify: `frontend/eslint.config.js` (extend the `boundaries/dependencies` `rules` array)
- Create: `frontend/eslint-suppressions.json` (generated, committed)
- Modify: `frontend/package.json` (only if the lint script needs the suppressions location flag — verify in Step 4)

**Interfaces:**
- Consumes: Task 3's element set; Task 1's outward-edge inventory (the expected suppressions contents).
- Produces: the green-on-land, fail-on-new ring graph.

- [ ] **Step 1: Add the ring-inward rules**

Append to the `boundaries/dependencies` `rules` array (after the store rules) in `frontend/eslint.config.js`:

```js
    // Inward-only ring graph. shell/person are inner of the product rings.
    {
      from: { type: 'shell' },
      disallow: { to: { type: ['person', 'ring0', 'ring1', 'ring3', 'admin', 'settings'] } },
      message: 'Shell/platform imports inward only (shared). It must not import Person or product-ring features.',
    },
    {
      from: { type: ['person', 'settings'] }, // settings is person-primary (mixed)
      disallow: { to: { type: ['ring0', 'ring1', 'ring3', 'admin'] } },
      message: 'Person layer must not import product-ring features (rings depend on Person, not the reverse).',
    },
    {
      from: { type: 'ring0' },
      disallow: { to: { type: ['ring1', 'ring3', 'admin'] } },
      message: 'Ring 0 (core loop) must not import outer rings or admin-ops.',
    },
    {
      from: { type: 'ring1' },
      disallow: { to: { type: ['ring3', 'admin'] } },
      message: 'Ring 1 must not import Ring 3 or admin-ops.',
    },
    {
      from: { type: 'ring3' },
      disallow: { to: { type: ['admin'] } },
      message: 'Product rings must not import the admin-ops surface.',
    },
```

> `admin` has **no** `from` rule — it is exempt (platform surface, may reach across rings). `page`/`service` have no `from` rule — composition roots, allowed to import anything.

- [ ] **Step 2: Observe the raw violations (pre-suppression)**

Run: `cd frontend && pnpm lint 2>&1 | grep -c "boundaries/dependencies"`
Expected: a NON-zero count matching Task 1's outward-edge inventory (the grandfathered debt — mostly `static-group/`, `settings/`, `group/` reaching outer rings). Spot-check 2–3 reported files against the inventory; if a dir the spec called "clean" appears here, that's the Task 1 surprise — fine, it gets suppressed, but note it in `FRONTEND_STRUCTURE.md`'s map.

- [ ] **Step 3: Generate the suppressions baseline**

Run: `cd frontend && pnpm exec eslint . --suppress-rule boundaries/dependencies`
This writes `frontend/eslint-suppressions.json` capturing exactly the current `boundaries/dependencies` violations. The inline-disabled viewAsStore edge and the type-only store→component imports are NOT in it (they aren't violations).

- [ ] **Step 4: Confirm CI's lint command consumes the suppressions automatically**

Run: `cd frontend && pnpm lint`
Expected: **clean exit (0 errors)** — ESLint auto-loads `eslint-suppressions.json` from cwd. If it does NOT (non-zero exit with the grandfathered violations still firing), update `frontend/package.json` `"lint"` to `"eslint . --suppressions-location eslint-suppressions.json"` and re-run until green. Record which was needed.

- [ ] **Step 5: Prove fail-on-new (per-edge)**

Add a NEW outward import into a clean Ring-0 file — e.g. in `frontend/src/components/loot/` pick any `.tsx` and add `import { ScheduleTab as _probe } from '../schedule/ScheduleTab';` (ring0→ring1, an edge NOT in the baseline).
Run: `cd frontend && pnpm lint 2>&1 | grep "boundaries/dependencies"`
Expected: **a NEW error** for that import (not suppressed — it's a new edge). This proves the baseline freezes debt at current size and new cross-ring imports fail, including the mixed-dir guardrail (a new edge into `settings/`/`static-group/` would likewise fire).
Then remove the probe import; re-run `pnpm lint`; expected clean.

- [ ] **Step 6: Prove the admin exemption + a mixed-dir new-edge**

Confirm no `admin/` file appears in the violations, and (optional) add a temporary `ring3`→`settings` probe import to confirm a new edge INTO a person/mixed dir from an outer ring fires; remove it.
Run: `cd frontend && pnpm lint 2>&1 | grep "admin"`
Expected: no admin violations.

- [ ] **Step 7: Full verification + commit**

Run: `cd frontend && pnpm build && pnpm lint && pnpm test`
Expected: build clean, lint clean (suppressions honored), tests pass (~503).

```bash
cd /d/FFXIV/Dev/xrp-dev/ffxiv-raid-planner
git add frontend/eslint.config.js frontend/eslint-suppressions.json frontend/package.json
git commit -m "feat(lint): F4 ring-inward-only rules + bulk-suppressions baseline (fail-on-new at error)"
```

---

### Task 5: Backend Person↔Static architecture note (doc-only)

Mirror the boundary on the backend as documentation. **No code, no enforcement** (backend isn't CI-gated).

**Files:**
- Create or Modify: `backend/ARCHITECTURE.md` (create if absent; else append a "Person↔Static module boundary" section)

**Interfaces:**
- Consumes: `PRODUCT_MODEL.md §3.1` ownership rule; the existing routers/models.

- [ ] **Step 1: Inventory the backend domains**

Run: `cd backend && ls app/routers app/models`
Read enough of each router/model name to classify it Person-domain vs Static-domain.

- [ ] **Step 2: Write the note**

Add a "Person↔Static module boundary" section to `backend/ARCHITECTURE.md` with:
- The deciding test verbatim: *"If leaving a static erases it → Static-layer. If it survives → Person-layer."* (`PRODUCT_MODEL.md §3.1`).
- A table classifying each router (`auth`, `static_groups`, `tiers`, `loot_tracking`, `bis`, `invitations`, `join_requests`, `discovery`, `schedule`, `lodestone`, `mount_farms`, `api_keys`, `analytics`, `dev_auth`) and the key models (User, StaticGroup, Membership, TierSnapshot, Availability, ApiKey, …) as **Person** or **Static**, with the dual-owned cases (availability = Person default + optional per-membership override) called out.
- An explicit note: *"No automated enforcement here, by decision — the backend is not CI-gated, so a boundary lint would be theater. The boundary is mirrored from the frontend (`design/redesign/FRONTEND_STRUCTURE.md`) and the F4 spec; revisit if backend gains CI."*

- [ ] **Step 3: Commit**

```bash
cd /d/FFXIV/Dev/xrp-dev/ffxiv-raid-planner
git add backend/ARCHITECTURE.md
git commit -m "docs(backend): Person↔Static module boundary note (doc-only, mirrors F4 frontend structure)"
```

---

### Task 6: Release notes + whole-branch verification

**Files:**
- Modify: `frontend/src/data/releaseNotes.ts`

- [ ] **Step 1: Add the internal release-notes entry**

In `frontend/src/data/releaseNotes.ts`, add to the latest release's items (do NOT bump `CURRENT_VERSION`):

```ts
{ internal: true, category: 'improvement', title: 'F4 — frontend structure: Ring-aware import boundaries', description: 'Documented the feature-slice + shared-layer model and added ESLint Ring-aware import-boundary + store-boundary rules (fail-on-new via bulk suppressions). Internal structure/tooling; no user-visible change.', pr: 0, prTitle: 'F4 — Frontend structure (feature-slice + shared-layer model)' },
```

Backfill the real PR number into `pr:` when the PR is opened (Task: at PR creation).

- [ ] **Step 2: Verify release-notes test passes**

Run: `cd scripts && npm test` (the `discord-changelog` suite enforces `CURRENT_VERSION` ↔ latest non-internal entry; an `internal: true` entry must not trip it).
Expected: PASS — `CURRENT_VERSION` unchanged, internal entry ignored by the version check.

- [ ] **Step 3: Pre-PR audit (CLAUDE.md checklist)**

Run from repo root:
```bash
cd /d/FFXIV/Dev/xrp-dev/ffxiv-raid-planner
git diff redesign/foundation --name-only | grep -E "frontend/src|backend/app" || echo "no src runtime change"
git diff redesign/foundation --name-only | grep "releaseNotes.ts"
git diff --check
```
Expected: `releaseNotes.ts` present; `git diff --check` clean (no whitespace errors). (No `.github/workflows` change → fork-guard check N/A.)

- [ ] **Step 4: Full suite green on the branch**

Run: `cd frontend && pnpm build && pnpm lint && pnpm check:design-system:strict && pnpm test`
Expected: all green. This is the same gate CI runs (F2's `redesign/**` trigger).

- [ ] **Step 5: Commit + push**

```bash
cd /d/FFXIV/Dev/xrp-dev/ffxiv-raid-planner
git add frontend/src/data/releaseNotes.ts
git commit -m "docs(release-notes): F4 frontend-structure internal entry"
git push -u origin redesign/f4-frontend-structure
```

- [ ] **Step 6: Open the PR + backfill the PR number**

Open a PR `redesign/f4-frontend-structure` → `redesign/foundation` (title: `F4 — Frontend structure (feature-slice + shared-layer model)`; body summarizing the 3 deliverables; **no AI attribution**). Then set `pr:` in the release-notes entry to the real number and amend/commit + push.

---

## Self-Review

**Spec coverage (spec §1–§10 → tasks):**
- §4 Deliverable 1 (`FRONTEND_STRUCTURE.md`) → **Task 2**. ✓
- §5 Deliverable 2 (lint): elements + store rules → **Task 3**; ring-inward + baseline → **Task 4**. ✓
- §5.2 store rules at error, 1 inline exception, type-only carve-out → **Task 3** (Steps 2–6). ✓
- §5.3 ring rule + fail-on-new baseline → **Task 4** (realized at `error` via ESLint bulk suppressions — a refinement of the spec's "warn + baseline," same intent, stronger teeth, green today; noted in plan Architecture). ✓
- §5.4 admin exempt → **Task 4** Step 1 note + Step 6. ✓
- §6 three-tier Ring map + §6.4 lodestone seam → **Task 1** (data) + **Task 2** (doc). ✓
- §7 backend note (doc-only) → **Task 5**. ✓
- §8 verification (toggle-verify each rule, fail-on-new, admin exemption, full CI) → **Task 3** Steps 4–6, **Task 4** Steps 5–7, **Task 6** Step 4. ✓
- §3 release notes `internal: true`, no version bump → **Task 6**. ✓
- §10 open details: importKind syntax (Task 3 Step 2 decision rule), baseline mechanism (settled: ESLint suppressions, Task 4), backend classification (Task 5). ✓

**Placeholder scan:** No "TBD/TODO/handle appropriately." The two genuinely deferred micro-decisions (importKind key placement; whether the lint script needs `--suppressions-location`) each have an explicit in-step decision rule + verification, not a placeholder. `pr: 0` is intentional with a named backfill step.

**Type/name consistency:** Element type names (`shared`/`shell`/`person`/`ring0`/`ring1`/`ring3`/`admin`/`settings`/`store`/`page`/`service`) are identical across Task 3 Step 1, Task 3 Step 2, and Task 4 Step 1. `eslint-suppressions.json` named consistently in Task 4 + Architecture. Ring-tag map identical in Task 1 Step 1 and Task 3 Step 1.

**Note on a spec refinement (flag for reviewer):** the spec said the ring rule lands at **`warn`**; this plan lands it at **`error` + bulk suppressions** because ESLint 9.39 makes per-edge fail-on-new native and green-on-land — a strictly better realization of the spec's stated *intent* (don't break existing, break new). Same behavior the spec wanted; better teeth. Called out here so it's a conscious acceptance, not a drift.
