# FLIP P2 — Invert the Default (v2 becomes the group route) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the v2 `NewShell` the default `/group/:code` experience, with `?shell=legacy` as an escape hatch that keeps the legacy `GroupView` reachable through the soak window — reversibly, without breaking any deep link in circulation.

**Architecture:** Invert the two render gates that key on the `shell` param (`GroupRoute` chooses the shell; `Layout` suppresses the legacy header when v2), landing them atomically. Keep the legacy Playwright smoke suite as the soak-window characterization of the still-shipping legacy surface by pinning it to `?shell=legacy`; add a new `flip.spec.ts` that proves the gate itself. Everything stays flag-reachable and one-line-revertible; nothing is deleted (deletion is P3).

**Tech Stack:** React 19 + react-router-dom (`useSearchParams`), Vitest + Testing Library (unit/component), Playwright (`@playwright/test` 1.60, chromium-only, no `webServer`), TypeScript (`tsc -b`).

**Source spec:** `design/redesign/specs/2026-07-03-parity-flip-design.md` — this plan implements the **P2** row of §1's three-PR shape, plus §2/§3.33-34 (gate mechanics), §7 (URL policy, release, tests). Two spec deviations are decided below (D1, D3) and go on the ratify list.

## Global Constraints

- **The only "legacy" edits allowed are the two sanctioned flip gates** — `frontend/src/pages/GroupRoute.tsx` and `frontend/src/components/layout/Layout.tsx`'s `isGroupV2Shell` predicate. These ARE P2's deliverable per spec §2/§3. **No legacy body** (`GroupView`, `Header` content, `ScheduleTab`, tab bodies, modals) may be touched. The byte-for-byte contract still holds for every legacy *surface*.
- **No deletions.** `GroupView`, legacy chrome, the `shell=v2` URL-builders, `TRANSIENT_NAV_PARAMS['shell']`, and `?shell=v2` parsing all stay. Deletion + the deep v2 smoke rewrite are P3.
- **`?shell=v2` must remain a working no-op alias** so circulating links (F6a–F6e release notes, shared deep links, `contrast.spec.ts`) still render v2.
- **No new `eslint-suppressions.json` entries and no new inline `eslint-disable`.** Task 5 *removes* one inline disable; nothing adds any.
- **Semantic tokens only; 12px text floor.** (No visual/token work in P2 — the flip changes which component renders, not its styling.)
- **Release note is `internal: true`; do NOT bump `CURRENT_VERSION`** (stays `'2.0.2'`). Backfill `pr: 0` → the real number after the PR opens. (D3: spec §7's "public entry + version bump at P2" is superseded by the user's FLIP GO — nothing is user-facing until foundation→main.)
- **NO AI attribution** in any commit or the PR body.
- **Land gate (must all be green before merge):** `pnpm build` · `pnpm lint` (0 errors) · `pnpm check:design-system:strict` · `pnpm test` · `pnpm tokens:check` · `git diff --check` · `cd scripts && npm test`. (Playwright e2e is NOT in CI — it is validated live by the orchestrator in the browser-validation phase, see "Post-plan process".)

---

## Decisions baked into this plan (do not relitigate — ratify at the P2 pause)

- **D1 — e2e smoke disposition (RATIFY).** Spec §7 says "P2 must include the smoke-suite migration (legacy header tabs → Spine; availability-grid drag retargets §5.1)." This plan instead: (a) **pins `smoke.spec.ts` to `?shell=legacy`** so its 14 proven flow-tests keep characterizing the legacy surface that still ships during soak; (b) **adds `flip.spec.ts`** proving the gate (bare→v2, `?shell=legacy`→legacy, `?shell=v2`→v2); (c) **defers the deep v2-selector rewrite to P3**, coupled to legacy deletion (the same moment §7 already deletes the `GroupViewContent.*` unit suites and consolidates the NewShell slot-test scaffolds). Rationale: v2's Schedule IA genuinely differs from legacy (no `schedule-subtab-*`; Integrations moved to Settings; session/RSVP/availability affordances are different elements), so a faithful P2 rewrite is large and would *discard live legacy-soak coverage before the surface is gone*. e2e is not a CI gate; the flip's regression safety is the 1776-test Vitest suite (incl. v2 Schedule/Roster/NewShell) + the new `flip.spec.ts` + live e2e run. Fully reversible; P3 does the rewrite regardless.
- **D2 — atomic two-gate flip.** `GroupRoute` and `Layout.isGroupV2Shell` land in ONE task (Task 1). Flipping only `GroupRoute` renders a double top bar on the bare route; flipping only `Layout` suppresses the legacy header on a legacy-rendering route. They are one logical change.
- **D3 — internal release note, no version bump** (see Global Constraints). The public flip release + version decision moves to the eventual foundation→main PR.
- **Redundant `shell=v2` URL-builders stay.** `StaticPicker.tsx:105`, `CommandPalette.tsx:160`, `NewShell.tsx:334`, `Loot.tsx:238` keep hardcoding `shell=v2`; post-flip that is a harmless no-op alias (renders the new default). Removing them expands the diff into P1's nav code and churns `navPreferences.test.ts` — P3 removes them with the gate.

---

## File map

| File | Task | Change |
|---|---|---|
| `frontend/src/pages/GroupRoute.tsx` | 1 | Invert the gate: `shell === 'legacy'` → GroupView, else NewShell. |
| `frontend/src/pages/GroupRoute.test.tsx` | 1 | Assert bare→v2, `?shell=v2`→v2 (alias), `?shell=legacy`→legacy. |
| `frontend/src/components/layout/Layout.tsx` | 1 | `isGroupV2Shell` predicate `shell === 'v2'` → `shell !== 'legacy'` + comment. |
| `frontend/e2e/helpers/auth.ts` | 2 | `goToTestStatic` navigates `/group/{code}?shell=legacy`. |
| `frontend/e2e/smoke.spec.ts` | 2 | Two bare `page.goto('/group/…')` (lines 467, 500) → `?shell=legacy`. |
| `frontend/e2e/flip.spec.ts` | 3 | **New** — 3 gate tests. |
| `frontend/src/data/releaseNotes.ts` | 4 | Append one `internal: true` UNRELEASED item; no version bump. |
| `frontend/src/components/layout/TopBar.tsx` | 5 | Remove the invitations-effect `exhaustive-deps` inline disable by fixing deps. |
| `frontend/src/components/layout/TopBar.invite.test.tsx` | 5 | Add: manager fetch-once-on-mount; stable across unrelated re-render. |

---

## Task 1: Invert the flip gate (GroupRoute + Layout, atomic)

**Files:**
- Modify: `frontend/src/pages/GroupRoute.tsx:10`
- Test: `frontend/src/pages/GroupRoute.test.tsx` (rewrite the two assertions + add one)
- Modify: `frontend/src/components/layout/Layout.tsx:18-27`

**Interfaces:**
- Consumes: `useSearchParams()` (react-router), `GroupView` (eager), `NewShell` (lazy), `PageSkeleton`.
- Produces: the new URL contract — bare/`?shell=v2`/any-other → `NewShell`; `?shell=legacy` → `GroupView`. `Layout` suppresses the legacy `Header`+`SettingsDockToggle` for any `/group/*` route that is NOT `?shell=legacy`.

- [ ] **Step 1: Rewrite the GroupRoute test to the flipped contract**

Replace the two `it(...)` lines in `frontend/src/pages/GroupRoute.test.tsx` (keep the imports/mocks/`at` helper at the top unchanged):

```tsx
it('renders NewShell by default (bare route, no ?shell)', async () => {
  at('/group/ABC');
  expect(await screen.findByTestId('v2')).toBeInTheDocument();
});
it('renders NewShell for ?shell=v2 (no-op alias survives)', async () => {
  at('/group/ABC?shell=v2');
  expect(await screen.findByTestId('v2')).toBeInTheDocument();
});
it('renders legacy GroupView for ?shell=legacy (escape hatch)', () => {
  at('/group/ABC?shell=legacy');
  expect(screen.getByTestId('legacy')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd frontend && pnpm test -- GroupRoute.test.tsx`
Expected: FAIL — the bare-route case now expects `v2` but the current gate returns `legacy`.

- [ ] **Step 3: Invert the GroupRoute gate**

In `frontend/src/pages/GroupRoute.tsx`, change line 10 from:

```tsx
  if (searchParams.get('shell') !== 'v2') return <GroupView />;
```

to:

```tsx
  // FLIP P2: v2 NewShell is the default group experience. `?shell=legacy` is the
  // soak-window escape hatch back to GroupView; `?shell=v2` stays a no-op alias.
  if (searchParams.get('shell') === 'legacy') return <GroupView />;
```

(Leave lines 1-9, 11-12 unchanged: `GroupView` stays eager, `NewShell` stays lazy behind `Suspense`. Reverting the flip is this one line back to `!== 'v2'`.)

- [ ] **Step 4: Run the test — verify it passes**

Run: `cd frontend && pnpm test -- GroupRoute.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Flip the Layout suppression predicate**

In `frontend/src/components/layout/Layout.tsx`, replace lines 18-27 (the comment block + predicate). Change the comment to describe the flipped default and change the predicate's right-hand side from `=== 'v2'` to `!== 'legacy'`:

```tsx
  // The v2 shell (F6a) renders its own TopBar, so suppress the legacy Header for
  // the group route by default. FLIP P2: v2 is now the default, so suppression
  // applies to every /group/ route EXCEPT the `?shell=legacy` escape hatch, which
  // still renders <Header /> exactly as before (byte-for-byte). All non-group
  // routes always render <Header />.
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // `startsWith('/group/')` is intentionally broad (matches any share code); the
  // `shell !== 'legacy'` gate on the right-hand side scopes suppression to the v2
  // default (bare + ?shell=v2), leaving the legacy escape hatch its Header.
  const isGroupV2Shell =
    location.pathname.startsWith('/group/') && searchParams.get('shell') !== 'legacy';
```

(Lines 53 `{!isGroupV2Shell && <Header />}` and 76 `{!isGroupV2Shell && <SettingsDockToggle />}` are unchanged — they consume the predicate.)

- [ ] **Step 6: Type-check + lint the touched files**

Run: `cd frontend && pnpm build && pnpm lint`
Expected: build exit 0; lint 0 errors on `GroupRoute.tsx` and `Layout.tsx`. (Layout's predicate has no unit harness — its cross-stack behavior is proven by `flip.spec.ts` in Task 3 and the browser-validation pass; this is intentional, extracting the inline predicate is out of P2 scope.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/GroupRoute.tsx frontend/src/pages/GroupRoute.test.tsx frontend/src/components/layout/Layout.tsx
git commit -m "feat(redesign): flip-p2 — invert group route default to v2 NewShell (?shell=legacy escape hatch)"
```

---

## Task 2: Pin the legacy smoke suite to the escape hatch

**Files:**
- Modify: `frontend/e2e/helpers/auth.ts` (`goToTestStatic`, ~line 60)
- Modify: `frontend/e2e/smoke.spec.ts:467` and `:500` (the two bare guest `page.goto`)

**Interfaces:**
- Consumes: `DEV_SHARE_CODE` (already imported in both files).
- Produces: after this task, every `smoke.spec.ts` navigation lands on the legacy `GroupView` via `?shell=legacy`, so all 14 existing tests keep passing unchanged against the still-shipping legacy surface.

- [ ] **Step 1: Point `goToTestStatic` at the escape hatch**

In `frontend/e2e/helpers/auth.ts`, change the navigation line inside `goToTestStatic` (currently `await page.goto(`/group/${DEV_SHARE_CODE}`);`) to:

```ts
  // FLIP P2: v2 is now the default group route. This smoke suite characterizes the
  // LEGACY surface, which still ships behind the `?shell=legacy` escape hatch through
  // the soak window, so pin it there. The v2-selector rewrite of these flows lands in
  // P3, coupled to legacy deletion (when the escape hatch is removed).
  await page.goto(`/group/${DEV_SHARE_CODE}?shell=legacy`);
```

(Leave the two `waitFor` blocks below it unchanged — under `?shell=legacy` the legacy header still renders the `role="button"` `Roster` tab and the `User menu for …` button, so both waits resolve as today.)

- [ ] **Step 2: Point the two guest tests at the escape hatch**

In `frontend/e2e/smoke.spec.ts`, the two unauthenticated tests navigate the bare route directly. Change both:
- Line ~467 (test 10): `await page.goto(`/group/${DEV_SHARE_CODE}`);` → `await page.goto(`/group/${DEV_SHARE_CODE}?shell=legacy`);`
- Line ~500 (test 12): `await page.goto(`/group/${DEV_SHARE_CODE}`);` → `await page.goto(`/group/${DEV_SHARE_CODE}?shell=legacy`);`

These assert the legacy "Private Static" wall + legacy-only hidden testids (`schedule-tab`, `add-session-btn`, `Static settings` button); keeping them on legacy preserves those assertions verbatim.

- [ ] **Step 3: Type-check the e2e helper + spec**

Run: `cd frontend && pnpm exec tsc -p tsconfig.json --noEmit` (or `pnpm build`)
Expected: exit 0 (string-only edits; no type surface changes).

Note: the live run of `pnpm test:e2e -- smoke.spec.ts` requires backend `:8001` + frontend `:5174` and is executed by the orchestrator in the browser-validation phase (see "Post-plan process"), not in this task's loop.

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/helpers/auth.ts frontend/e2e/smoke.spec.ts
git commit -m "test(e2e): pin legacy smoke suite to ?shell=legacy (soak-window coverage; v2 rewrite → P3)"
```

---

## Task 3: New `flip.spec.ts` — prove the gate end-to-end

**Files:**
- Create: `frontend/e2e/flip.spec.ts`

**Interfaces:**
- Consumes: `loginAsOwner`, `DEV_SHARE_CODE`, `FRONTEND_BASE` from `./helpers/auth`.
- Produces: cross-stack proof of the Task 1 gate + Layout predicate: bare → `[data-testid="new-shell"]` present and legacy header absent; `?shell=legacy` → legacy header present and `new-shell` absent; `?shell=v2` → `new-shell` present.

Facts this relies on (verified against the branch base): v2 root is `<div data-testid="new-shell">` (`NewShell.tsx:342`); the v2 Spine renders `Roster` as `role="tab"` (`Spine.tsx:65-88`), so `getByRole('button', { name: 'Roster' })` matches ONLY the legacy header; DEVTST is private, so `loginAsOwner` must run first for the shell to mount.

- [ ] **Step 1: Write the spec**

Create `frontend/e2e/flip.spec.ts`:

```ts
/**
 * FLIP P2 — GroupRoute gate proof.
 *
 * After the flip, the bare /group/:code route renders the v2 NewShell; `?shell=legacy`
 * is the soak-window escape hatch back to legacy GroupView; `?shell=v2` stays a
 * no-op alias that still renders v2. Legacy flow coverage lives in smoke.spec.ts
 * (pinned to ?shell=legacy); this file only proves which shell each URL selects.
 *
 * Prereqs: backend :8001 (DEV_AUTH_MODE=true) + frontend :5174. Run: pnpm test:e2e
 */
import { test, expect } from '@playwright/test';
import { loginAsOwner, DEV_SHARE_CODE } from './helpers/auth';

// The v2 shell root; present only when NewShell mounts.
const V2_ROOT = '[data-testid="new-shell"]';
// The legacy header renders the Roster tab as a role=button; the v2 Spine renders it
// as role=tab. So a role=button match named "Roster" is a legacy-only signal.
const legacyRosterButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Roster', exact: true });

test.describe('FLIP P2 — group route shell selection', () => {
  test('bare /group/:code renders the v2 NewShell (no legacy header)', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(`/group/${DEV_SHARE_CODE}`);
    await expect(page.locator(V2_ROOT)).toBeVisible({ timeout: 15_000 });
    // v2 Roster is a role=tab, so the legacy role=button Roster must be absent.
    await expect(legacyRosterButton(page)).toHaveCount(0);
  });

  test('?shell=legacy renders the legacy GroupView (escape hatch)', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(`/group/${DEV_SHARE_CODE}?shell=legacy`);
    await expect(legacyRosterButton(page).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(V2_ROOT)).toHaveCount(0);
  });

  test('?shell=v2 still renders the v2 NewShell (no-op alias)', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(`/group/${DEV_SHARE_CODE}?shell=v2`);
    await expect(page.locator(V2_ROOT)).toBeVisible({ timeout: 15_000 });
  });
});
```

- [ ] **Step 2: Type-check + lint the new spec**

Run: `cd frontend && pnpm exec tsc -p tsconfig.json --noEmit && pnpm lint frontend/e2e/flip.spec.ts`
Expected: exit 0; 0 lint errors.

Note: the live run (`pnpm test:e2e -- flip.spec.ts`, servers up) is executed by the orchestrator in the browser-validation phase — it is the primary RED/GREEN evidence for Task 1's gate + Layout predicate.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/flip.spec.ts
git commit -m "test(e2e): add flip.spec — prove GroupRoute selects v2 by default, legacy via ?shell=legacy"
```

---

## Task 4: Internal release note (no version bump)

**Files:**
- Modify: `frontend/src/data/releaseNotes.ts` (append one item to the UNRELEASED `items` array)

**Interfaces:**
- Consumes: the `ReleaseItem` shape (`internal?: boolean` last field). `CURRENT_VERSION` stays `'2.0.2'`.
- Produces: satisfies the CI release-note requirement for a `frontend/src` change while remaining hidden from users; `scripts/discord-changelog.test.js`'s `CURRENT_VERSION == latest-public-version` invariant is unaffected (this entry is internal, and the UNRELEASED block is already `internal: true`).

- [ ] **Step 1: Append the internal entry**

In `frontend/src/data/releaseNotes.ts`, inside the UNRELEASED block's `items` array, add this object immediately AFTER the existing "Flip readiness — v2 shell parity gaps closed" item (currently ending at line ~137, before the array's closing `]` at line ~138):

```ts
      {
        internal: true,
        category: 'improvement',
        title: 'Flip — v2 shell is now the default group experience',
        description:
          'The redesigned v2 shell now renders by default at /group/:code; the legacy view remains reachable at ?shell=legacy as a soak-window escape hatch, and ?shell=v2 stays a working alias. No public-facing release yet — this ships to users only when the redesign branch merges to main.',
        pr: 0,
        prTitle: 'feat(redesign): flip-p2 — invert group route default to v2',
      },
```

- [ ] **Step 2: Verify CURRENT_VERSION is untouched and the changelog test passes**

Run: `cd scripts && npm test`
Expected: PASS (139+ tests). `CURRENT_VERSION` must still equal `'2.0.2'` (line 12) — do NOT bump it. `git diff frontend/src/data/releaseNotes.ts` should show ONLY the added object (no `version:`/`CURRENT_VERSION` change).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/data/releaseNotes.ts
git commit -m "docs(release): internal note — v2 shell is now the default group route (no version bump)"
```

---

## Task 5: Prune the TopBar invitations-effect exhaustive-deps disable

**Files:**
- Modify: `frontend/src/components/layout/TopBar.tsx:74-79`
- Test: `frontend/src/components/layout/TopBar.invite.test.tsx`

**Interfaces:**
- Consumes: `fetchInvitations` is extracted via `useInvitationStore((s) => s.fetchInvitations)` (`TopBar.tsx:69`) — a Zustand store action, so its reference is **stable across renders**. Adding it to the effect deps cannot cause a refetch loop.
- Produces: the invitations mount-fetch effect with a lint-clean dependency array and no inline `eslint-disable`.

Context — the current effect (`TopBar.tsx:74-79`) reads `currentGroup` in the body but lists only `currentGroup?.id` in deps, and omits the stable `fetchInvitations`, hence the disable. The fix captures the primitive id and lists the real deps.

- [ ] **Step 1: Add a test pinning the effect's fetch behavior**

In `frontend/src/components/layout/TopBar.invite.test.tsx`, add a test that a manager triggers exactly one `fetchInvitations(groupId)` on mount and does not refetch on an unrelated re-render. Match the file's existing render/mock harness (it already renders `TopBar` at `/group/ABC?shell=v2` with mocked stores/permissions — reuse that setup; stub `useInvitationStore`'s `fetchInvitations` with a `vi.fn()` and assert call count). Concretely:

```tsx
it('fetches invitations once on mount for a manager and not again on unrelated re-render', () => {
  const fetchInvitations = vi.fn();
  // Reuse this file's existing manager/permission + store mocks; point the
  // invitation store's fetchInvitations at the spy (see the file's mock block).
  const { rerender } = renderTopBar({ canManageInvitations: true, fetchInvitations, groupId: 'g-1' });
  expect(fetchInvitations).toHaveBeenCalledTimes(1);
  expect(fetchInvitations).toHaveBeenCalledWith('g-1');
  rerender(); // same group, unrelated re-render
  expect(fetchInvitations).toHaveBeenCalledTimes(1);
});
```

(Adapt `renderTopBar`/the mock wiring to whatever helper this file already uses — do not invent a new harness; if the file renders inline, inline this the same way. The assertion that matters: one call on mount, no second call when `currentGroup?.id` is unchanged.)

- [ ] **Step 2: Run the test — verify it passes against current code (characterization)**

Run: `cd frontend && pnpm test -- TopBar.invite.test.tsx`
Expected: PASS (the current disabled-deps effect already fetches once on mount; this test locks that behavior BEFORE the deps change so the refactor is proven behavior-neutral).

- [ ] **Step 3: Fix the deps and remove the inline disable**

In `frontend/src/components/layout/TopBar.tsx`, replace the effect at lines 74-79:

```tsx
  useEffect(() => {
    if (canManageInvitations && currentGroup) {
      fetchInvitations(currentGroup.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageInvitations, currentGroup?.id]);
```

with:

```tsx
  const currentGroupId = currentGroup?.id;
  useEffect(() => {
    if (canManageInvitations && currentGroupId) {
      fetchInvitations(currentGroupId);
    }
  }, [canManageInvitations, currentGroupId, fetchInvitations]);
```

(`fetchInvitations` is a stable Zustand action; `currentGroupId` is a primitive. The effect now lists every value it reads, so the `exhaustive-deps` disable is gone with no behavior change — fetch still fires once per `(canManageInvitations, groupId)`.)

- [ ] **Step 4: Run the test + lint — verify pass and no disable**

Run: `cd frontend && pnpm test -- TopBar.invite.test.tsx && pnpm lint frontend/src/components/layout/TopBar.tsx`
Expected: test PASS (unchanged behavior); lint 0 errors with NO `eslint-disable` remaining in the file for this effect (`grep -n exhaustive-deps frontend/src/components/layout/TopBar.tsx` → no match).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/TopBar.tsx frontend/src/components/layout/TopBar.invite.test.tsx
git commit -m "refactor(topbar): drop invitations-effect exhaustive-deps disable (stable Zustand action in deps)"
```

---

## Self-review (completed against the spec)

- **Spec coverage:** §2/§3.33 gate mechanics → Task 1 (GroupRoute). §3.34 Layout branch → Task 1 (predicate). §7 URL policy (`?shell=legacy` renders GroupView; `?shell=v2` no-op alias) → Task 1 + Task 3 asserts all three. §7 tests (smoke suite must not break post-flip) → Task 2 (pin) + Task 3 (gate) + D1 (deep rewrite → P3). §7 release/version → Task 4 (internal, no bump, per D3). P1-tracked-to-P2 TopBar disable → Task 5. **P1's NewShell zero-arg store-mock foot-gun is intentionally NOT here** — its natural home is P3's NewShell slot-test scaffold consolidation (spec §7), reconciling the P1 review's "→P2" note with §7's P3 placement.
- **Placeholder scan:** every code step shows the actual edit; Task 5 Step 1's `renderTopBar` is explicitly "adapt to the file's existing harness" (the harness exists — this is wiring guidance, not a TODO).
- **Type consistency:** `isGroupV2Shell` name unchanged (only its RHS); `V2_ROOT`/`legacyRosterButton` local to `flip.spec.ts`; `fetchInvitations`/`currentGroupId` match `TopBar.tsx` symbols.

---

## Post-plan process (orchestrator — after Task 5 review closes clean)

1. **Whole-branch review** (`redesign-reviewer`, `0139de2..head`, full review-package diff): confirm the 6 hard contracts (only-sanctioned-gate legacy edits; no new suppressions — Task 5 removes one; tokens/12px moot; no AI attribution; internal note pr:0 + CURRENT_VERSION 2.0.2; test discipline).
2. **Full land gate green:** `pnpm build` · `lint` (0 err) · `check:design-system:strict` · `test` · `tokens:check` · `git diff --check` · `cd scripts && npm test`.
3. **Live e2e validation** (the primary evidence for the flip): start backend `:8001` (from `backend/`, venv `python -m uvicorn app.main:app --port 8001`, `DEV_AUTH_MODE=true`) + frontend `:5174` as background tasks, then run `cd frontend && pnpm test:e2e -- flip.spec.ts smoke.spec.ts`. Expected: `flip.spec.ts` 3/3 green; `smoke.spec.ts` unchanged green (legacy via escape hatch). `contrast.spec.ts` is unaffected (drives `?shell=v2` explicitly) — spot-run if time allows.
4. **Browser validation** (chrome-devtools, DevOwner/DEVTST): `/group/DEVTST` (NO param) → v2 shell, single top bar, no legacy header; `/group/DEVTST?shell=legacy` → legacy header + tabs; `/group/DEVTST?shell=v2` → v2. 0 app console errors.
5. **Screenshots** (user rule — this is a user-visible default change): capture `/group/DEVTST` now-v2 and `/group/DEVTST?shell=legacy` still-legacy; commit under `docs/redesign/pr-shots/` and embed via raw URLs pinned to the shots commit SHA.
6. **PR into `redesign/foundation`**; body = the 5-task table + D1/D2/D3 decisions + the 2 ratify items carried from P1 + review/validation record + screenshots; backfill `pr: 0` → N in `releaseNotes.ts`; push.
7. **pr-review-loop** → `gh pr checks <n> --watch` all green → **self-squash-merge** (`gh pr merge --squash`).
8. **Bookkeeping:** foundation doc commit (roadmap/spec status), memory, `SESSION_HANDOFF.md`, progress ledger. Then **⏸ HARD PAUSE** — offer the user: holistic review on the now-default v2 (items 1–41 + this run's deferred list), P3 (legacy deletion) go-ahead, and ratify the P1 items (suppression 4→5; legacy-visible Integrations tab) + D1/D3. **Never touch `main`. P3 does not start without the user's go-ahead.**
