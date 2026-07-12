# Phase R — Dual-Shell Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the legacy shell (P2 state + P3 keeper fixes) behind a persisted
user preference with default `legacy`, an explicit toggle UX in both directions with
`ui_shell_toggle` telemetry, a backend `ui_shell` mirror, and a resurrected + un-rotted
legacy e2e suite — per the APPROVED spec
`design/redesign/specs/2026-07-11-phase-r-dual-shell-restore.md` (all §11 skim
recommendations ratified: C1/C2/C3, backend mirror in scope, banner-dismiss event in,
banner copy via PR screenshots).

**Architecture:** Restore source = `f45a241` (P2-final tree, `cf25c92^`). 73 deleted
files return byte-for-byte; 21 modified files are pure `git checkout f45a241` reverts;
`GroupViewContent.tsx` is hand-reconciled from the f45a241 body + HEAD's keeper hunks;
a new `GroupRoute` gate resolves `?shell=` param → persisted preference → default
`legacy`. Everything else at HEAD stays untouched.

**Tech Stack:** React 19 + TS + Zustand 5 + react-router 7 (frontend), FastAPI +
SQLAlchemy + Alembic (backend), Vitest + Playwright (tests).

## Global Constraints

- **NO AI attribution** on any commit or PR — absolute, non-negotiable.
- **Never touch `main`.** Branch `redesign/phase-r-dual-shell`, PR into `redesign/foundation`.
- **Byte-for-byte freeze**: every file restored from `f45a241` must be byte-identical
  to `git show f45a241:<path>` at PR time (verified in Task 10), except the enumerated
  hand-edits (`navPreferences.ts` comment). Restored files are frozen (bugfix-only) at merge.
- **Commit guard**: a PreToolUse hook blocks `git commit` when staged frontend `.ts/.tsx`
  fail `tsc -b`. Tasks 3–4 leave the tree deliberately red (expected-error set is
  enumerated in each task) — they DEFER their commits; Task 5 makes the tree green and
  commits the whole restoration wave. All other tasks commit normally.
- **Design system**: new UI (banner, menu item) uses primitives (`Button`, `IconButton`,
  `DropdownItem`) + semantic tokens only. User-facing copy says "static", never "group".
- **Release note**: ONE internal entry (`internal: true`), NO `CURRENT_VERSION` bump —
  added during the PR task (needs the PR number for `pr`/`prTitle`).
- **Full CI gate before PR**: `pnpm build` · `pnpm lint` (0 errors) ·
  `pnpm check:design-system:strict` · `pnpm test` · `pnpm tokens:check` · `git diff --check`.
- Frontend commands run from `frontend/` with pnpm. Backend tests: `cd backend`,
  activate venv, `pytest tests/ -q`.
- Implementer model: **sonnet-5 for every task except Task 5 (GroupViewContent
  reconciliation), which is fable/opus** per spec §7. Reviewer: `redesign-reviewer`
  after every task and at whole-branch.

---

## The M-file hunk audit (spec §2 mandate — dispositions for all 56)

Legend: **KEEP** = keep HEAD untouched · **REVERT** = `git checkout f45a241 -- <path>`
(P3 diff verified to contain no HEAD-side keepers) · **EDIT** = hand-modified in a task.

| # | File | Disposition |
|---|---|---|
| 1 | `design/redesign/DESIGN_SYSTEM.md` | KEEP (docs) |
| 2 | `frontend/e2e/contrast.spec.ts` | EDIT Task 9 — re-pin `?shell=v2&` in the 3 `page.goto` URLs (C3); assertions/comments untouched |
| 3 | `frontend/e2e/helpers/auth.ts` | EDIT Task 9 — `goToTestStatic` pins `?shell=v2` (C3); ADD `goToTestStaticLegacy` + `switchTabLegacy` (f45a241 bodies, renamed); keep HEAD keepers (`stubAuthRefresh`, `setStaticPublic`, retrying v2 `switchTab`) |
| 4 | `frontend/e2e/smoke.spec.ts` | EDIT Task 9 — keep HEAD v2 rewrite; pin the one bare goto (line ~586) with `?shell=v2`; fix the now-false "escape hatch is gone" comment in nothing here (that comment lives in helpers) |
| 5 | `frontend/eslint-suppressions.json` | REVERT Task 3 — re-adds exactly `AllWeeksView` (2) + `SidebarNav` (1); P3 diff had no other change |
| 6 | `frontend/src/App.tsx` | EDIT Task 6 — route element `NewShell` → new `GroupRoute`; lazy-NewShell moves inside GroupRoute |
| 7 | `components/group/GearSyncDashboard.tsx` | KEEP (optional `onViewStats` render is a keeper; legacy GVC passes it → card returns, PluginPage doesn't → hidden) |
| 8 | `components/group/MorePage.tsx` | EDIT Task 5 — keep HEAD (`onOpenLootHistory`, Integrations); restore Split Planner card behind optional `onOpenSplitPlanner?` prop, rendered only when provided (C2) |
| 9 | `components/group/PluginPage.tsx` | KEEP (GearSync re-home keeper) |
| 10 | `components/home/Home.tsx` | KEEP (comment-only P3 change, still accurate) |
| 11–12 | `components/layout/CommandPalette.tsx` + `.test.tsx` | KEEP — deliberate: in-app static-switch nav no longer re-appends `?shell=v2`; the persisted preference (not the URL param) is the dual-shell mechanism, and `shell` is transient (see disposition note in PR body) |
| 13 | `components/layout/Layout.tsx` | EDIT Task 6 — suppression predicate becomes "group route ∧ `useResolvedShell()==='v2'`"; Header + SettingsDockToggle return on legacy group routes |
| 14 | `components/layout/NotificationBell.tsx` | KEEP (comment-only) |
| 15 | `components/layout/SidebarRail.tsx` | REVERT Task 3 (comment-only; f45a241 comment re-mentions SidebarNav, accurate again) |
| 16–17 | `components/layout/StaticPicker.tsx` + `.test.tsx` | KEEP (same deliberate disposition as CommandPalette) |
| 18–19 | `components/layout/TopBar.invite.test.tsx`, `TopBar.test.tsx` | KEEP (bare MemoryRouter entries; TopBar mounts directly) |
| 20 | `components/layout/railTypes.ts` | REVERT Task 3 (comment-only) |
| 21 | `components/loot/Loot.tsx` | REVERT Task 3 — restores the `url.searchParams.set('shell', 'v2')` line in the copied history deep-link (without it a legacy-preference recipient lands on the legacy gear tab with no `entry` highlight); P3 diff was this single line |
| 22 | `components/loot/index.ts` | REVERT Task 3 — f45a241 GVC does `import { LootPriorityPanel, LogWeekWizard } from '../components/loot'` (verified), so the pruned barrel exports must return |
| 23 | `components/profile/CharacterLinkModal.tsx` | KEEP (e2e `data-testid` keeper) |
| 24 | `components/roster/CharacterSyncBadge.tsx` | KEEP (imports from `./syncStatus` extraction; restored `splitClearScoringService` re-exports the same fns — no conflict) |
| 25 | `components/roster/Roster.test.tsx` | KEEP |
| 26–27 | `components/roster/RosterCard.tsx`, `RosterCards.tsx` | KEEP (`./dragTypes` extraction keeper; restored `DroppablePlayerCard` still exports its own types — no conflict) |
| 28 | `components/ui/TipsCarousel.tsx` | REVERT Task 3 — the 5 pruned tips reference restored legacy shortcuts; sole consumer is the legacy `Header` (verified) → zero v2 impact |
| 29 | `components/ui/keyboardShortcutGroups.ts` | REVERT Task 3 — legacy groups return verbatim (spec §2). Known accepted inaccuracy: v2's CommandPalette absorbs these and will list legacy-only shortcuts, exactly as it did at f45a241; deferred to Phase B/E (note in PR body) |
| 30–33 | `components/wizard/SetupWizard.tsx`, `steps/ReviewStep.tsx`, `steps/StaticDetailsStep.tsx`, `types.ts` | REVERT Task 3 — split-clear wizard toggle returns (C2); P3 diffs were pure removals |
| 34 | `data/releaseNotes.ts` | EDIT PR task — append new internal entry; keep P3 entries as history |
| 35 | `hooks/navParsers.test.ts` | REVERT Task 3 — f45a241 suites exercise the restored `gearSubFromParam`/`lootSubFromParam` |
| 36 | `hooks/useGroupViewKeyboardShortcuts.test.ts` | EDIT Task 4 — keep HEAD suites (they pin absence WITHOUT the legacy surface — still true); add legacy-surface suites |
| 37 | `hooks/useGroupViewKeyboardShortcuts.ts` | EDIT Task 4 — HEAD base + optional `legacyLootSurface` param gating the restored bindings (presence-gated to avoid re-introducing the v2 dead-flag latch). `shellParam` + `Shift+?`/`setShowKeyboardHelp` NOT restored (deliberate: bare static-switch nav; the global shortcut owns the help modal — both were bugs/dead at f45a241) |
| 38 | `hooks/useGroupViewState.ts` | REVERT Task 3 — P3 diff is deletion-only + comment tweaks (verified); full legacy surface returns (C1). v2 stays gearSubTab-free at its call sites |
| 39 | `hooks/useStaticNavMemory.test.tsx` | REVERT Task 3 (shell-strip test returns with `'shell'` transient) |
| 40 | `hooks/useStaticNavMemory.ts` | REVERT Task 3 (comment-only; "both GroupView and NewShell call it" true again) |
| 41 | `hooks/useViewAsUrlSync.ts` | REVERT Task 3 (comment-only, same reason) |
| 42 | `hooks/useVisibilityRefresh.ts` | REVERT Task 3 (comment-only; split-clear example true again) |
| 43 | `lib/navPreferences.test.ts` | REVERT Task 3 (TRANSIENT shell test + flip-safety test return) |
| 44 | `lib/navPreferences.ts` | REVERT + EDIT Task 3 — checkout f45a241, then update the `'shell'` hazard comment (spec: the silent-flip hazard is worse now that a preference exists) |
| 45 | `pages/DesignSystem.tsx` | KEEP (TierSelector snippet is fine, no restored-file dependency) |
| 46 | `pages/NewShell.authGuard.test.tsx` | KEEP (scaffold keeper) |
| 47 | `pages/NewShell.banners.test.tsx` | KEEP |
| 48 | `pages/NewShell.gear.test.tsx` | EDIT Task 5 — re-add the `splitClearStore` mock (reconciled GVC imports it again); everything else HEAD |
| 49 | `pages/NewShell.rail.test.tsx` | KEEP |
| 50 | `pages/NewShell.roster.test.tsx` | EDIT Task 5 — re-add `splitClearStore` mock (+ legacy leaf stubs ONLY if the test run demands them) |
| 51 | `pages/NewShell.schedule.test.tsx` | EDIT Task 5 — re-add `splitClearStore` mock (same rule) |
| 52 | `pages/NewShell.slot.test.tsx` | KEEP |
| 53 | `pages/NewShell.tsx` | EDIT Task 5 — code KEEP (unconditional slots is a keeper; no `extraParams: {shell}` restore); fix the two now-false comments ("the legacy fallback was removed in flip-P3") |
| 54 | `pages/ShellContentStates.test.tsx` | REVERT Task 3 (comment-only) |
| 55 | `pages/V2SettingsHost.tsx` | REVERT Task 3 (comment-only; legacy `ConnectedSettingsHost` exists again) |
| 56 | `pages/GroupViewContent.tsx` | EDIT Task 5 — hand reconciliation, f45a241 body + HEAD keeper hunks (spec §7) |

**D-files (76):** all restored byte-for-byte in Task 3 EXCEPT `pages/GroupRoute.tsx` +
`pages/GroupRoute.test.tsx` (replaced by new implementations in Task 6 — the P2 gate
asserted a v2 default) and `frontend/e2e/flip.spec.ts` (NOT restored — its subject was
the P2 gate; the new gate has its own test). That leaves **73 checkout restores**.

**A-files (13):** all keepers, untouched — except `pages/GroupViewContent.slots.test.tsx`
(reconciled in Task 5 to the optional-slots contract).

**Verified plan facts** (recon 2026-07-11): preference endpoint =
`PATCH /api/auth/me/preferences` (`UserPreferencesUpdate`, camelCase via `CamelModel`);
`/api/auth/me` returns `UserResponse` (2 construction sites, both in `auth.py`);
alembic chain is single-linear, head = `e6f7a8b9c0d1` (the `tab_persistence` migration);
frontend caller = `authStore.updatePreferences` (`authStore.ts:205,523`); playwright
`testDir: './e2e'` picks up both smoke suites; the commit guard hook runs `tsc -b` on
staged frontend TS.

---

### Task 1: Branch + plan-of-record docs commit

**Files:**
- Commit (already in working tree, untracked): `design/redesign/ROLLOUT_ROADMAP.md`,
  `design/redesign/specs/2026-07-11-phase-r-dual-shell-restore.md`, this plan file.
- Do NOT commit: `SESSION_HANDOFF.md`, `design/redesign/AUTONOMOUS_RUN.md` (session artifacts).

**Interfaces:** Produces the working branch every later task commits to.

- [ ] **Step 1: Create the branch off foundation**

```bash
git -C "D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner" checkout -b redesign/phase-r-dual-shell
git rev-parse --abbrev-ref HEAD   # expect: redesign/phase-r-dual-shell
git log --oneline -1               # expect: 09ec09b
```

- [ ] **Step 2: Commit the docs (no frontend TS staged → guard no-op)**

```bash
git add design/redesign/ROLLOUT_ROADMAP.md "design/redesign/specs/2026-07-11-phase-r-dual-shell-restore.md" "design/redesign/plans/2026-07-11-phase-r-dual-shell-restore.md"
git commit -m "docs(redesign): phase-r dual-shell spec (approved) + rollout roadmap + implementation plan"
```

---

### Task 2: Shell preference module (`lib/shellPreference.ts`) — TDD

**Files:**
- Create: `frontend/src/lib/shellPreference.ts`
- Test: `frontend/src/lib/shellPreference.test.tsx` (`.tsx` — the wrapper uses JSX)

**Interfaces:**
- Consumes: nothing (self-contained; Zustand `create`, react-router `useSearchParams`).
- Produces (Tasks 6/7/8 rely on these exact names):
  - `type Shell = 'legacy' | 'v2'`
  - `SHELL_STORAGE_KEY = 'ui-shell'` (exported const)
  - `useShellPreferenceStore`: Zustand store `{ preference: Shell | null; setPreference: (shell: Shell) => void }`
  - `useResolvedShell(): Shell` — precedence `?shell=` (valid values only) → store preference → `'legacy'`

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/lib/shellPreference.test.ts
/**
 * shellPreference — persisted dual-shell preference + resolution precedence.
 * Phase R (ROLLOUT_ROADMAP §2): ?shell= URL param → stored preference → default legacy.
 * The URL param NEVER writes the preference (support/deep-link override only).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useShellPreferenceStore, useResolvedShell, SHELL_STORAGE_KEY } from './shellPreference';

function resolveAt(url: string) {
  return renderHook(() => useResolvedShell(), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>,
  });
}

beforeEach(() => {
  localStorage.clear();
  useShellPreferenceStore.setState({ preference: null });
});

describe('useShellPreferenceStore', () => {
  it('setPreference writes the store AND localStorage', () => {
    act(() => useShellPreferenceStore.getState().setPreference('v2'));
    expect(useShellPreferenceStore.getState().preference).toBe('v2');
    expect(localStorage.getItem(SHELL_STORAGE_KEY)).toBe('v2');
  });
});

describe('useResolvedShell precedence', () => {
  it('defaults to legacy with no param and no preference', () => {
    expect(resolveAt('/group/ABC').result.current).toBe('legacy');
  });
  it('uses the stored preference when no param is present', () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    expect(resolveAt('/group/ABC').result.current).toBe('v2');
  });
  it('?shell=legacy beats a v2 preference (support override)', () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    expect(resolveAt('/group/ABC?shell=legacy').result.current).toBe('legacy');
  });
  it('?shell=v2 beats the legacy default', () => {
    expect(resolveAt('/group/ABC?shell=v2').result.current).toBe('v2');
  });
  it('ignores an unrecognized ?shell= value', () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    expect(resolveAt('/group/ABC?shell=bogus').result.current).toBe('v2');
  });
  it('reacts to a preference change without remount (in-place toggle)', () => {
    const { result } = resolveAt('/group/ABC');
    expect(result.current).toBe('legacy');
    act(() => useShellPreferenceStore.getState().setPreference('v2'));
    expect(result.current).toBe('v2');
  });
});
```

Note: the test file needs JSX → name it `shellPreference.test.tsx` if the repo's vitest
config doesn't transform `.ts` JSX (it does not — use `.test.tsx`).

- [ ] **Step 2: Run to verify failure**

Run: `pnpm -C frontend exec vitest run src/lib/shellPreference.test.tsx`
Expected: FAIL — module `./shellPreference` not found.

- [ ] **Step 3: Implement**

```ts
// frontend/src/lib/shellPreference.ts
/**
 * shellPreference — the dual-shell gate state (Phase R, ROLLOUT_ROADMAP §2).
 *
 * Which chrome renders /group/:shareCode is a PERSISTED USER PREFERENCE:
 *   resolution precedence = `?shell=` URL param (support/deep-link override,
 *   never written back) → stored preference → default 'legacy'.
 *
 * Zustand-outside-the-URL for the same reason as settingsPanelStore: toggling
 * must remount the shell in place without a reload, and the preference must
 * never leak into per-static tab memory (navPreferences keeps 'shell' in
 * TRANSIENT_NAV_PARAMS). localStorage covers guests + pre-auth paint; the
 * authed backend mirror (User.ui_shell) hydrates over it on login (Task 8).
 */
import { create } from 'zustand';
import { useSearchParams } from 'react-router-dom';

export type Shell = 'legacy' | 'v2';

export const SHELL_STORAGE_KEY = 'ui-shell';

function readStoredPreference(): Shell | null {
  try {
    const v = localStorage.getItem(SHELL_STORAGE_KEY);
    return v === 'legacy' || v === 'v2' ? v : null;
  } catch {
    return null;
  }
}

interface ShellPreferenceState {
  /** null = user has never chosen; resolution falls through to the default. */
  preference: Shell | null;
  setPreference: (shell: Shell) => void;
}

export const useShellPreferenceStore = create<ShellPreferenceState>((set) => ({
  preference: readStoredPreference(),
  setPreference: (shell) => {
    set({ preference: shell });
    try {
      localStorage.setItem(SHELL_STORAGE_KEY, shell);
    } catch {
      // Private-mode localStorage failures degrade to session-only preference.
    }
  },
}));

/** Resolve which shell should render right now. One resolver, two consumers
 *  (GroupRoute + Layout's Header suppression) — precedence lives ONLY here. */
export function useResolvedShell(): Shell {
  const [searchParams] = useSearchParams();
  const preference = useShellPreferenceStore((s) => s.preference);
  const param = searchParams.get('shell');
  if (param === 'legacy' || param === 'v2') return param;
  return preference ?? 'legacy';
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm -C frontend exec vitest run src/lib/shellPreference.test.tsx`
Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/shellPreference.ts frontend/src/lib/shellPreference.test.tsx
git commit -m "feat(redesign): shell preference store + resolver (ui-shell, default legacy)"
```

---

### Task 3: Restoration wave — 73 D-files byte-for-byte + 21 pure-revert M-files

**Files:**
- Restore (checkout from `f45a241`): the 73 D-files (list below) + these 21 M-files:
  `frontend/src/hooks/useGroupViewState.ts`, `frontend/src/hooks/navParsers.test.ts`,
  `frontend/src/hooks/useStaticNavMemory.ts`, `frontend/src/hooks/useStaticNavMemory.test.tsx`,
  `frontend/src/hooks/useViewAsUrlSync.ts`, `frontend/src/hooks/useVisibilityRefresh.ts`,
  `frontend/src/lib/navPreferences.ts`, `frontend/src/lib/navPreferences.test.ts`,
  `frontend/src/components/ui/TipsCarousel.tsx`, `frontend/src/components/ui/keyboardShortcutGroups.ts`,
  `frontend/src/components/loot/index.ts`, `frontend/src/components/loot/Loot.tsx`,
  `frontend/src/components/layout/SidebarRail.tsx`, `frontend/src/components/layout/railTypes.ts`,
  `frontend/src/components/wizard/SetupWizard.tsx`, `frontend/src/components/wizard/steps/ReviewStep.tsx`,
  `frontend/src/components/wizard/steps/StaticDetailsStep.tsx`, `frontend/src/components/wizard/types.ts`,
  `frontend/src/pages/ShellContentStates.test.tsx`, `frontend/src/pages/V2SettingsHost.tsx`,
  `frontend/eslint-suppressions.json`
- Modify (after checkout): `frontend/src/lib/navPreferences.ts` (hazard comment only)

**Interfaces:**
- Produces: the full legacy component tree + `useGroupViewState` legacy surface
  (`gearSubTab`, `setGearSubTab`, `lootSubTab`, `setLootSubTab`, `showKeyboardHelp`,
  `showLogLootModal`/`setShowLogLootModal`, `showLogMaterialModal`/`setShowLogMaterialModal`,
  `showMarkFloorClearedModal`/`setShowMarkFloorClearedModal`, `showLogWeekWizard` +
  floor/week state, exported `gearSubFromParam`/`lootSubFromParam`) that Tasks 4–6 build on.

- [ ] **Step 1: Restore the 73 D-files**

```bash
cd "D:/FFXIV/Dev/xrp-dev/ffxiv-raid-planner"
git diff f45a241 cf25c92 --diff-filter=D --name-only \
  | grep -v -e '^frontend/e2e/flip.spec.ts$' -e '^frontend/src/pages/GroupRoute.tsx$' -e '^frontend/src/pages/GroupRoute.test.tsx$' \
  > /tmp/restore-list.txt
wc -l /tmp/restore-list.txt        # expect: 73
git checkout f45a241 -- $(cat /tmp/restore-list.txt)
```

- [ ] **Step 2: Restore the 21 pure-revert M-files**

```bash
git checkout f45a241 -- \
  frontend/src/hooks/useGroupViewState.ts frontend/src/hooks/navParsers.test.ts \
  frontend/src/hooks/useStaticNavMemory.ts frontend/src/hooks/useStaticNavMemory.test.tsx \
  frontend/src/hooks/useViewAsUrlSync.ts frontend/src/hooks/useVisibilityRefresh.ts \
  frontend/src/lib/navPreferences.ts frontend/src/lib/navPreferences.test.ts \
  frontend/src/components/ui/TipsCarousel.tsx frontend/src/components/ui/keyboardShortcutGroups.ts \
  frontend/src/components/loot/index.ts frontend/src/components/loot/Loot.tsx \
  frontend/src/components/layout/SidebarRail.tsx frontend/src/components/layout/railTypes.ts \
  frontend/src/components/wizard/SetupWizard.tsx frontend/src/components/wizard/steps/ReviewStep.tsx \
  frontend/src/components/wizard/steps/StaticDetailsStep.tsx frontend/src/components/wizard/types.ts \
  frontend/src/pages/ShellContentStates.test.tsx frontend/src/pages/V2SettingsHost.tsx \
  frontend/eslint-suppressions.json
```

- [ ] **Step 3: Update the navPreferences hazard comment (the ONE hand-edit)**

In `frontend/src/lib/navPreferences.ts`, the restored comment above `TRANSIENT_NAV_PARAMS`
explains why `shell` is stripped. Replace the f45a241 wording of that comment block with:

```ts
/** URL params that are transient/modal and should not be persisted, restored,
 *  or carried across a static switch. `shell` is included so the shell gate is
 *  never baked into per-static tab memory. This hazard is WORSE now that the
 *  shell is a persisted user preference (Phase R): if `shell` leaked into
 *  `static-nav-{code}` memory, a remembered-tab navigation would silently
 *  override the user's chosen shell — the URL param must stay a one-shot
 *  support/deep-link override, never a sticky one. */
```

(Only the comment changes — the array contents are exactly f45a241's, including `'shell'`.)

- [ ] **Step 4: Verify the restoration is exact**

```bash
for f in $(cat /tmp/restore-list.txt); do git diff --quiet f45a241 -- "$f" || echo "DRIFT: $f"; done
# expect: no output
git diff f45a241 -- frontend/src/lib/navPreferences.ts   # expect: comment-only hunk
```

- [ ] **Step 5: Confirm the EXPECTED tsc breakage (and nothing else)**

Run: `pnpm -C frontend exec tsc -b 2>&1 | head -50`
Expected: errors ONLY in (a) the 4 restored `GroupViewContent.*.test.tsx` suites +
restored `GroupView.tsx`/GVC-adjacent files complaining against HEAD's
`GroupViewContent.tsx` (required `slots`) and HEAD's keyboard-hook signature, and
(b) possibly `GroupViewContent.slots.test.tsx`. If errors appear in ANY other area
(e.g. a restored file importing something deleted at HEAD), STOP — that is a missed
hunk; report it rather than patching ad hoc.

**NO COMMIT** (tree is deliberately red; the guard would block it). Task 5 commits the wave.

---

### Task 4: Keyboard hook — legacy surface behind a presence-gated param

**Files:**
- Modify: `frontend/src/hooks/useGroupViewKeyboardShortcuts.ts`
- Test: `frontend/src/hooks/useGroupViewKeyboardShortcuts.test.ts`

**Interfaces:**
- Consumes: `GearSubTab` from `../types` (unchanged at HEAD).
- Produces (Task 5's GVC call site relies on this): `GroupViewShortcutParams` gains
  ONE optional field:

```ts
  /** Legacy gear-tab surface — pass ONLY when the legacy gear body can render
   *  (`!slots?.gear` in GroupViewContent). Presence gates the legacy sub-tab /
   *  quick-action bindings: in v2 those modals and sub-tabs have no renderer,
   *  so registering them would re-introduce the flip-P3 dead-flag latch
   *  (isAnyModalOpen stuck true with no way to clear it). */
  legacyLootSurface?: {
    gearSubTab: GearSubTab;
    setGearSubTab: (tab: GearSubTab) => void;
    setShowLogLootModal: (show: boolean) => void;
    setShowLogMaterialModal: (show: boolean) => void;
    setShowMarkFloorClearedModal: (show: boolean) => void;
  };
```

**Deliberate non-restorations** (state in code comments): `shellParam` (Mod+[/] navigates
bare — the preference resolves the shell), `Shift+?`/`setShowKeyboardHelp` (dead flag
with no renderer even at f45a241 — the global shortcut owns the modal), `lootSubTab`
params (unused `_`-prefixed even at f45a241).

- [ ] **Step 1: Write the failing tests** — append to the existing HEAD test file
  (keep every HEAD suite: they pin absence when `legacyLootSurface` is NOT passed):

```ts
// ── Legacy surface present (dual-shell restore, Phase R) ────────────────────
// With `legacyLootSurface` passed (GroupViewContent does this only when the
// legacy gear body can render, i.e. !slots?.gear), the f45a241 bindings return.
describe('useGroupViewKeyboardShortcuts — legacy surface bindings', () => {
  const legacySurface = () => ({
    gearSubTab: 'history' as const,
    setGearSubTab: vi.fn(),
    setShowLogLootModal: vi.fn(),
    setShowLogMaterialModal: vi.fn(),
    setShowMarkFloorClearedModal: vi.fn(),
  });

  beforeEach(() => { mockedUseKeyboardShortcuts.mockClear(); });

  it('registers Alt+L / Alt+U / Alt+B when the legacy surface is passed', () => {
    renderHook(() => useGroupViewKeyboardShortcuts(
      makeParams({ legacyLootSurface: legacySurface() }), false));
    expect(getAction('l', { requireAlt: true })).toBeDefined();
    expect(getAction('u', { requireAlt: true })).toBeDefined();
    expect(getAction('b', { requireAlt: true })).toBeDefined();
  });

  it('Alt+L (canEdit) routes to gear/history and opens the log-loot modal', () => {
    const surface = legacySurface();
    const setPageMode = vi.fn();
    renderHook(() => useGroupViewKeyboardShortcuts(
      makeParams({ canEdit: true, setPageMode, legacyLootSurface: surface }), false));
    getAction('l', { requireAlt: true })!.action();
    expect(setPageMode).toHaveBeenCalledWith('gear');
    expect(surface.setGearSubTab).toHaveBeenCalledWith('history');
    expect(surface.setShowLogLootModal).toHaveBeenCalledWith(true);
  });

  it('Alt+L without canEdit is a no-op', () => {
    const surface = legacySurface();
    renderHook(() => useGroupViewKeyboardShortcuts(
      makeParams({ canEdit: false, legacyLootSurface: surface }), false));
    getAction('l', { requireAlt: true })!.action();
    expect(surface.setShowLogLootModal).not.toHaveBeenCalled();
  });

  it('registers Alt+1/2/3 sub-tab switchers and Alt+←/→ week nav', () => {
    renderHook(() => useGroupViewKeyboardShortcuts(
      makeParams({ legacyLootSurface: legacySurface() }), false));
    expect(getAction('1', { requireAlt: true })).toBeDefined();
    expect(getAction('2', { requireAlt: true })).toBeDefined();
    expect(getAction('3', { requireAlt: true })).toBeDefined();
    expect(getAction('ArrowLeft', { requireAlt: true })).toBeDefined();
    expect(getAction('ArrowRight', { requireAlt: true })).toBeDefined();
  });

  it("'v' on gear/history dispatches log:toggle-expand-all (legacy history body)", () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    renderHook(() => useGroupViewKeyboardShortcuts(
      makeParams({ pageMode: 'gear', legacyLootSurface: legacySurface() }), false));
    getAction('v')!.action();
    expect(spy.mock.calls.map((c) => (c[0] as CustomEvent).type)).toEqual(['log:toggle-expand-all']);
    spy.mockRestore();
  });

  it("'g' on gear/history dispatches log:toggle-layout (legacy grid/list toggle)", () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    renderHook(() => useGroupViewKeyboardShortcuts(
      makeParams({ pageMode: 'gear', legacyLootSurface: legacySurface() }), false));
    getAction('g')!.action();
    expect(spy.mock.calls.map((c) => (c[0] as CustomEvent).type)).toEqual(['log:toggle-layout']);
    spy.mockRestore();
  });
});
```

(Reuse the file's existing `makeParams`/`getAction` helpers; extend `makeParams`'
`Partial<GroupViewShortcutParams>` typing if needed.)

- [ ] **Step 2: Run to verify the new suites fail**

Run: `pnpm -C frontend exec vitest run src/hooks/useGroupViewKeyboardShortcuts.test.ts`
Expected: HEAD suites pass; new suites FAIL (bindings absent / param unknown).

- [ ] **Step 3: Implement** — in the hook, destructure `legacyLootSurface` and:
  1. Re-add the f45a241 binding bodies for **Alt+1/2/3**, **Alt+←/→**, **Alt+L/U/B**
     (exact f45a241 logic — see `git show f45a241:frontend/src/hooks/useGroupViewKeyboardShortcuts.ts`
     lines ~106–200 — with `gearSubTab`/`setGearSubTab`/modal setters read from
     `legacyLootSurface`), each spread-guarded so they are only in the registry when
     `legacyLootSurface` is provided (e.g. build them into a
     `...(legacyLootSurface ? [ /* bindings */ ] : [])` segment of the shortcuts array).
  2. `'v'` binding: keep the roster branch; gear branch becomes
     `if (pageMode === 'gear') { if (legacyLootSurface && legacyLootSurface.gearSubTab === 'history') { dispatch log:toggle-expand-all } else if (!legacyLootSurface || legacyLootSurface.gearSubTab === 'priority') { dispatch loot:toggle-expand-all } }`
     — v2 (no surface) keeps HEAD's unconditional `loot:toggle-expand-all`; legacy
     reproduces f45a241's sub-tab-gated behavior.
  3. `'g'` binding: keep roster branch; add
     `if (pageMode === 'gear' && legacyLootSurface?.gearSubTab === 'history') { dispatch log:toggle-layout }`.
  4. Do NOT re-add `shellParam`, `Shift+?`, or `setShowKeyboardHelp` — add a short
     comment at each former site naming the deliberate omission.

- [ ] **Step 4: Run the full test file**

Run: `pnpm -C frontend exec vitest run src/hooks/useGroupViewKeyboardShortcuts.test.ts`
Expected: ALL suites pass (HEAD absence suites + new presence suites).

**NO COMMIT** (tree still red from Task 3's GVC test suites). Task 5 commits.

---

### Task 5: `GroupViewContent.tsx` reconciliation ⚠️ riskiest — **implementer: fable/opus**

**Files:**
- Rewrite: `frontend/src/pages/GroupViewContent.tsx` (start from
  `git show f45a241:frontend/src/pages/GroupViewContent.tsx`, re-apply HEAD keepers)
- Modify: `frontend/src/components/group/MorePage.tsx` (optional Split Planner card)
- Modify: `frontend/src/pages/NewShell.tsx` (2 stale comments only)
- Modify: `frontend/src/pages/GroupViewContent.slots.test.tsx` (optional-slots contract)
- Modify: `frontend/src/pages/NewShell.gear.test.tsx`, `NewShell.roster.test.tsx`,
  `NewShell.schedule.test.tsx` (re-add `splitClearStore` mocks)

**Interfaces:**
- Consumes: Task 3's restored legacy components + `useGroupViewState` legacy surface;
  Task 4's `legacyLootSurface` param.
- Produces: `GroupViewContentProps.slots?: Partial<Record<GroupTab, React.ReactNode>>`
  (OPTIONAL again — f45a241 contract); every pageMode renders `slots?.[mode] ?? <legacy body>`.
  `MorePageProps` gains `onOpenSplitPlanner?: () => void` (card renders only when provided).

- [ ] **Step 1: Reconstruct GVC from the f45a241 body.** Write the f45a241 content to
  the file (`git show f45a241:frontend/src/pages/GroupViewContent.tsx > frontend/src/pages/GroupViewContent.tsx`),
  then apply EXACTLY these keeper edits (each is a HEAD hunk that must survive — the
  current HEAD file is 437 lines and every keeper is visible in it):

  1. **Props type**: `slots` becomes optional (`slots?: ...` — f45a241 shape), KEEP
     HEAD's `GroupActions`/`actions` prop contract (f45a241 already had it — verify;
     if the f45a241 signature differs, HEAD's wins for anything NewShell passes today).
  2. **PageSkeleton tier-fetch window** (HEAD lines 287–298): the
     `if (!currentGroup || !currentTier) return <div data-testid="content-tier-loading"><PageSkeleton /></div>`
     guard + the `PageSkeleton` import from `../components/ui`. Place it where HEAD has
     it (immediately before the main return) and delete any f45a241-era equivalent
     null-render so the skeleton is the single loading path.
  3. **MorePage handler block** (HEAD lines 350–364 pattern): MorePage keeps ONE
     history prop — GVC owns the shell branch:
     ```tsx
     onOpenLootHistory={() => {
       if (slots?.gear) {
         // v2 Loot reads the lview URL param (flip-P3 keeper — More-page lview fix)
         setPageMode('gear', { lview: 'history' });
       } else {
         // f45a241 behavior: legacy gear tab on its History sub-tab
         setGearSubTab('history');
         setPageMode('gear');
       }
     }}
     ```
     and `onOpenSplitPlanner` passed ONLY in legacy context:
     ```tsx
     {...(!slots?.roster ? { onOpenSplitPlanner: () => { /* f45a241 body: switch to roster + open split planner exactly as f45a241 line ~1137 did */ } } : {})}
     ```
     (use f45a241's exact handler body for the legacy branch; keep HEAD's
     `onOpenSettings`/`onOpenIntegrations` settingsPanelStore forms).
  4. **Keyboard hook call**: f45a241 param set, minus `setShowKeyboardHelp`, minus
     `shellParam`, minus flat `gearSubTab`/`setGearSubTab`/`lootSubTab`/`setLootSubTab`/
     modal setters — those now travel via the Task 4 param, gated on the gear slot:
     ```tsx
     legacyLootSurface: slots?.gear ? undefined : {
       gearSubTab, setGearSubTab,
       setShowLogLootModal, setShowLogMaterialModal, setShowMarkFloorClearedModal,
     },
     ```
     Keep f45a241's `isAnyModalOpen` composition (it includes `showKeyboardHelp` — the
     restored state field exists and is permanently false; keep the line to minimize
     drift from f45a241, and note it).
  5. **Anything else the diff surfaces**: after steps 1–4 run
     `git diff cf25c92 -- frontend/src/pages/GroupViewContent.tsx` — wait, compare
     against HEAD: `git diff HEAD -- frontend/src/pages/GroupViewContent.tsx` and
     against f45a241: every hunk vs f45a241 must be one of the keepers above (or the
     hook-call reshape); every hunk vs HEAD must be restored-legacy. Anything that
     fits neither list is a mistake.

- [ ] **Step 2: MorePage optional Split Planner card.** In `MorePage.tsx`: add
  `onOpenSplitPlanner?: () => void;` to `MorePageProps` (with a doc comment: "Legacy
  shell only — v2 dropped the card (D-P3-2); rendered only when the caller wires it"),
  restore the f45a241 Split Planner `DashboardCard` block (the exact JSX is in the P3
  diff / `git show f45a241:frontend/src/components/group/MorePage.tsx`) wrapped in
  `{onOpenSplitPlanner && ( ... )}`, and re-add the `Sword`/`ExternalLink` icon imports.

- [ ] **Step 3: NewShell comment fixes.** In `NewShell.tsx` replace the two comments
  claiming the legacy fallback "was removed in flip-P3" with dual-shell truth, e.g.
  "the legacy route renders GroupViewContent with no slots, so its restored fallback
  bodies serve the classic UI (Phase R)". No code changes.

- [ ] **Step 4: Test reconciliation.**
  - `GroupViewContent.slots.test.tsx`: update the framing — slots are optional again;
    KEEP every assertion that v2 slots render and legacy leaves do NOT when slots are
    passed; drop/replace any assertion that the props type REQUIRES slots.
  - Re-add to `NewShell.gear.test.tsx` / `NewShell.roster.test.tsx` /
    `NewShell.schedule.test.tsx` the f45a241 mock (visible in the P3 diff):
    ```ts
    vi.mock('../stores/splitClearStore', () => ({
      useSplitClearStore: () => ({ fetchData: vi.fn(), clearData: vi.fn() }),
    }));
    ```
    If the run then still fails on legacy leaf imports, re-add the f45a241 leaf stubs
    (`PlayerGrid`, `RosterDragOverlay`, `SplitClearPlanner`, `ScheduleUpcomingPanel`,
    schedule barrel) to the failing file — smallest set that goes green.

- [ ] **Step 5: The wave gate — everything must now compile and pass**

```bash
pnpm -C frontend exec tsc -b          # expect: clean
pnpm -C frontend test                  # expect: ALL suites green, including the 4 restored
                                       # GroupViewContent.*.test.tsx characterization suites
```
The 4 restored suites passing UNMODIFIED is the proof the fallback contract is back;
`NewShell.*` suites passing unmodified (bar mocks) is the proof of zero v2 change.

- [ ] **Step 6: Commit the whole restoration wave (Tasks 3+4+5)**

```bash
git add -A
git commit -m "feat(redesign): phase-r — restore legacy shell tree + GroupViewContent slot fallbacks (f45a241 keepers preserved)"
```

---

### Task 6: The shell gate — `GroupRoute` + `App` + `Layout`

**Files:**
- Create: `frontend/src/pages/GroupRoute.tsx`, `frontend/src/pages/GroupRoute.test.tsx`
- Modify: `frontend/src/App.tsx` (route element), `frontend/src/components/layout/Layout.tsx` (predicate)

**Interfaces:**
- Consumes: `useResolvedShell` (Task 2), restored `GroupView` (Task 3), `NewShell` (HEAD).
- Produces: `/group/:shareCode` renders exactly one shell per resolution; Header +
  SettingsDockToggle render on legacy group routes.

- [ ] **Step 1: Write the failing gate test**

```tsx
// frontend/src/pages/GroupRoute.test.tsx
/**
 * GroupRoute — the Phase R dual-shell gate (3-way precedence).
 * Replaces the P2 gate test, which asserted a v2 default; the dual-shell
 * default is LEGACY (ROLLOUT_ROADMAP §2, user decision 2026-07-11).
 */
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupRoute } from './GroupRoute';
import { useShellPreferenceStore } from '../lib/shellPreference';

vi.mock('./GroupView', () => ({ GroupView: () => <div data-testid="legacy-shell" /> }));
vi.mock('./NewShell', () => ({ NewShell: () => <div data-testid="new-shell-mock" /> }));

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/group/:shareCode" element={<GroupRoute />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useShellPreferenceStore.setState({ preference: null });
});

describe('GroupRoute precedence', () => {
  it('bare URL + no preference → legacy (the default)', () => {
    renderAt('/group/ABC');
    expect(screen.getByTestId('legacy-shell')).toBeInTheDocument();
  });
  it('preference v2 → NewShell', async () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    renderAt('/group/ABC');
    expect(await screen.findByTestId('new-shell-mock')).toBeInTheDocument();
  });
  it('?shell=legacy beats a v2 preference', () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    renderAt('/group/ABC?shell=legacy');
    expect(screen.getByTestId('legacy-shell')).toBeInTheDocument();
  });
  it('?shell=v2 beats the legacy default', async () => {
    renderAt('/group/ABC?shell=v2');
    expect(await screen.findByTestId('new-shell-mock')).toBeInTheDocument();
  });
  it('unrecognized ?shell= falls through to the preference', async () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    renderAt('/group/ABC?shell=classic');
    expect(await screen.findByTestId('new-shell-mock')).toBeInTheDocument();
  });
  it('a preference change remounts the shell in place (no reload)', async () => {
    renderAt('/group/ABC');
    expect(screen.getByTestId('legacy-shell')).toBeInTheDocument();
    act(() => useShellPreferenceStore.getState().setPreference('v2'));
    expect(await screen.findByTestId('new-shell-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy-shell')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm -C frontend exec vitest run src/pages/GroupRoute.test.tsx`
Expected: FAIL (`./GroupRoute` not found).

- [ ] **Step 3: Implement GroupRoute** (P2's shape, new resolver):

```tsx
// frontend/src/pages/GroupRoute.tsx
/**
 * GroupRoute — the dual-shell gate (Phase R, ROLLOUT_ROADMAP §2).
 *
 * Renders exactly ONE shell for /group/:shareCode, resolved by
 * useResolvedShell(): `?shell=` param → persisted preference → default legacy.
 * GroupView (the classic chrome, restored at its f45a241 state) loads eagerly
 * as the default experience; NewShell stays code-split. Subscribing to the
 * preference store means the "Try the new UI" / "Switch to classic UI" toggles
 * remount the shell in place — no reload. The single-mount contract holds:
 * both shells call useViewAsUrlSync/useStaticNavMemory, but only one renders.
 */
import { Suspense, lazy } from 'react';
import { GroupView } from './GroupView';
import { PageSkeleton } from '../components/ui/Skeleton';
import { useResolvedShell } from '../lib/shellPreference';

const NewShell = lazy(() => import('./NewShell').then(m => ({ default: m.NewShell })));

export function GroupRoute() {
  const shell = useResolvedShell();
  if (shell === 'v2') {
    return <Suspense fallback={<PageSkeleton />}><NewShell /></Suspense>;
  }
  return <GroupView />;
}
```

- [ ] **Step 4: Repoint App.tsx** — replace the P3 lines:

```tsx
const GroupRoute = lazy(() => import('./pages/GroupRoute').then(m => ({ default: m.GroupRoute })));
// ...
<Route path="group/:shareCode" element={<GroupRoute />} />
```
(delete the `const NewShell = lazy(...)` App-level import — it lives in GroupRoute now).

- [ ] **Step 5: Layout predicate.** In `Layout.tsx`, replace the P3 `isGroupRoute`
  suppression with the shared resolver (mirror of the HEAD structure — only the
  predicate changes):

```tsx
import { useResolvedShell } from '../../lib/shellPreference';
// ...
// The v2 shell renders its own TopBar, so the app-wide Header (and the
// settings dock toggle) are suppressed ONLY when the group route resolves to
// the v2 shell. Legacy group routes render <Header/> exactly as before the
// flip; all non-group routes always render it. Same resolver as GroupRoute —
// precedence lives in ONE place (lib/shellPreference).
const location = useLocation();
const resolvedShell = useResolvedShell();
const isGroupV2Shell = location.pathname.startsWith('/group/') && resolvedShell === 'v2';
```
and use `{!isGroupV2Shell && <Header />}` / `{!isGroupV2Shell && <SettingsDockToggle />}`.

- [ ] **Step 6: Run tests + tsc**

```bash
pnpm -C frontend exec vitest run src/pages/GroupRoute.test.tsx   # green
pnpm -C frontend exec tsc -b                                      # clean
pnpm -C frontend test                                             # full suite green
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/GroupRoute.tsx frontend/src/pages/GroupRoute.test.tsx frontend/src/App.tsx frontend/src/components/layout/Layout.tsx
git commit -m "feat(redesign): phase-r — GroupRoute shell gate (param > preference > legacy default) + Layout header suppression via shared resolver"
```

---

### Task 7: Toggle UX + telemetry (banner ↔ user-menu)

**Files:**
- Create: `frontend/src/hooks/useShellToggle.ts`,
  `frontend/src/components/layout/TryNewUiBanner.tsx`,
  `frontend/src/components/layout/TryNewUiBanner.test.tsx`
- Modify: `frontend/src/components/layout/Header.tsx` (mount banner — SANCTIONED edit,
  roadmap-mandated entry point), `frontend/src/components/auth/UserMenu.tsx`
  ("Switch to classic UI" item)

**Interfaces:**
- Consumes: `useShellPreferenceStore`/`useResolvedShell`/`Shell` (Task 2),
  `analytics.track(category, name, data)` (`services/analytics.ts:67`).
- Produces: `useShellToggle(surface: 'legacy-banner' | 'v2-user-menu'): (target: Shell) => void`.
- localStorage: dismiss flag key `ui-shell-banner-dismissed` = `'true'`.
- Events: `analytics.track('navigation', 'ui_shell_toggle', { direction: 'to-v2' | 'to-legacy', surface })`;
  `analytics.track('navigation', 'ui_shell_banner_dismiss', {})`.

- [ ] **Step 1: `useShellToggle`** (hooks layer — it imports `services/analytics`,
  which `lib/` must not):

```ts
// frontend/src/hooks/useShellToggle.ts
/**
 * useShellToggle — the ONE path both toggle affordances use to switch shells.
 * Fires the ui_shell_toggle analytics event (sunset telemetry — Phase H's
 * criteria depend on it existing from day one), persists the preference, and
 * strips any ?shell= URL override (otherwise the param would immediately
 * defeat the toggle on the very next resolution).
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { analytics } from '../services/analytics';
import { useShellPreferenceStore, type Shell } from '../lib/shellPreference';

export function useShellToggle(surface: 'legacy-banner' | 'v2-user-menu') {
  const [searchParams, setSearchParams] = useSearchParams();
  const setPreference = useShellPreferenceStore((s) => s.setPreference);
  return useCallback((target: Shell) => {
    analytics.track('navigation', 'ui_shell_toggle', {
      direction: target === 'v2' ? 'to-v2' : 'to-legacy',
      surface,
    });
    setPreference(target);
    if (searchParams.has('shell')) {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.delete('shell');
        return params;
      }, { replace: true });
    }
  }, [surface, setPreference, searchParams, setSearchParams]);
}
```

- [ ] **Step 2: Failing banner tests**

```tsx
// frontend/src/components/layout/TryNewUiBanner.test.tsx
/**
 * TryNewUiBanner — legacy→v2 opt-in entry point (Phase R §5).
 * Shown only on a legacy-resolved group route, dismissible with persistence,
 * and its CTA must fire telemetry + preference + strip ?shell=.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TryNewUiBanner } from './TryNewUiBanner';
import { useShellPreferenceStore } from '../../lib/shellPreference';

const track = vi.fn();
vi.mock('../../services/analytics', () => ({ analytics: { track: (...a: unknown[]) => track(...a) } }));

function renderAt(url = '/group/ABC') {
  return render(<MemoryRouter initialEntries={[url]}><TryNewUiBanner /></MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  track.mockClear();
  useShellPreferenceStore.setState({ preference: null });
});

describe('TryNewUiBanner', () => {
  it('renders the CTA on a legacy group route', () => {
    renderAt();
    expect(screen.getByRole('button', { name: /try the new ui/i })).toBeInTheDocument();
  });
  it('does not render when the shell resolves to v2', () => {
    useShellPreferenceStore.setState({ preference: 'v2' });
    renderAt();
    expect(screen.queryByRole('button', { name: /try the new ui/i })).toBeNull();
  });
  it('does not render when previously dismissed', () => {
    localStorage.setItem('ui-shell-banner-dismissed', 'true');
    renderAt();
    expect(screen.queryByRole('button', { name: /try the new ui/i })).toBeNull();
  });
  it('CTA click fires telemetry, sets the preference, and strips ?shell=', () => {
    renderAt('/group/ABC?shell=legacy');
    fireEvent.click(screen.getByRole('button', { name: /try the new ui/i }));
    expect(track).toHaveBeenCalledWith('navigation', 'ui_shell_toggle',
      { direction: 'to-v2', surface: 'legacy-banner' });
    expect(useShellPreferenceStore.getState().preference).toBe('v2');
  });
  it('dismiss hides it, persists, and fires ui_shell_banner_dismiss', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('button', { name: /try the new ui/i })).toBeNull();
    expect(localStorage.getItem('ui-shell-banner-dismissed')).toBe('true');
    expect(track).toHaveBeenCalledWith('navigation', 'ui_shell_banner_dismiss', {});
  });
});
```

- [ ] **Step 3: Run to verify failure** — `pnpm -C frontend exec vitest run src/components/layout/TryNewUiBanner.test.tsx`

- [ ] **Step 4: Implement the banner** (design-system primitives; final placement/copy
  is screenshot-reviewed at PR — this is the starting point):

```tsx
// frontend/src/components/layout/TryNewUiBanner.tsx
/**
 * TryNewUiBanner — the legacy shell's opt-in entry to the v2 UI (Phase R §5).
 * Rendered by the legacy Header on group routes; self-gates on the resolved
 * shell + a persisted dismissal, so mounting it unconditionally is safe.
 */
import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button, IconButton } from '../primitives';
import { analytics } from '../../services/analytics';
import { useResolvedShell } from '../../lib/shellPreference';
import { useShellToggle } from '../../hooks/useShellToggle';

const DISMISS_KEY = 'ui-shell-banner-dismissed';

function readDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === 'true'; } catch { return false; }
}

export function TryNewUiBanner() {
  const resolvedShell = useResolvedShell();
  const toggle = useShellToggle('legacy-banner');
  const [dismissed, setDismissed] = useState(readDismissed);

  if (resolvedShell !== 'legacy' || dismissed) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 pl-2.5 pr-1 py-1">
      <Sparkles size={14} className="text-accent flex-shrink-0" aria-hidden />
      <Button variant="ghost" size="sm" onClick={() => toggle('v2')}>
        Try the new UI
      </Button>
      <IconButton
        icon={<X size={13} />}
        aria-label="Dismiss new UI banner"
        size="sm"
        variant="ghost"
        onClick={() => {
          try { localStorage.setItem(DISMISS_KEY, 'true'); } catch { /* session-only */ }
          analytics.track('navigation', 'ui_shell_banner_dismiss', {});
          setDismissed(true);
        }}
      />
    </div>
  );
}
```
(Adjust `Button`/`IconButton` props to the primitives' real APIs — check
`components/primitives/Button.tsx` / `IconButton.tsx` prop names before writing; the
dismiss button's accessible name must match `/dismiss/i`.)

- [ ] **Step 5: Mount in Header.** In `Header.tsx`, next to the existing
  `{isGroupRoute && currentGroup && (<TipsCarousel .../>)}` center block (~line 308),
  add the banner into the RIGHT-side cluster (before the settings/auth controls),
  desktop-visible:

```tsx
{/* Phase R: legacy→v2 opt-in entry (self-gates on resolved shell + dismissal).
    Sanctioned Header edit — ROLLOUT_ROADMAP §2 mandates this entry point. */}
{isGroupRoute && currentGroup && (
  <div className="hidden sm:block">
    <TryNewUiBanner />
  </div>
)}
```

- [ ] **Step 6: UserMenu "Switch to classic UI".** In `UserMenu.tsx`, after the
  "Anonymous activity" row (~line 298) and before the `<DropdownSeparator />`, add:

```tsx
{/* Phase R: v2→legacy return path. Only meaningful where a shell is being
    rendered (group routes) AND the v2 shell is active. */}
{isGroupRoute && resolvedShell === 'v2' && (
  <DropdownItem
    icon={<ArrowLeftRight className="w-4 h-4" />}
    onSelect={() => switchShell('legacy')}
  >
    Switch to classic UI
  </DropdownItem>
)}
```
with, at the top of the component:
```tsx
const location = useLocation();
const isGroupRoute = location.pathname.startsWith('/group/');
const resolvedShell = useResolvedShell();
const switchShell = useShellToggle('v2-user-menu');
```
(`ArrowLeftRight` from lucide-react; `useLocation` from react-router-dom. If UserMenu
already derives the route elsewhere, reuse it.) Extend
`UserMenu.railfooter.test.tsx`'s mocks only if the new hooks break it (MemoryRouter
is likely already present; add a `vi.mock` for `../../services/analytics` if needed).

- [ ] **Step 7: Full check + commit**

```bash
pnpm -C frontend exec vitest run src/components/layout/TryNewUiBanner.test.tsx src/components/auth
pnpm -C frontend exec tsc -b && pnpm -C frontend test
git add -A && git commit -m "feat(redesign): phase-r — shell toggle UX (Try-the-new-UI banner + Switch-to-classic menu item) with ui_shell_toggle telemetry"
```

---

### Task 8: Backend mirror (`User.ui_shell`) + auth hydration

**Files:**
- Modify: `backend/app/models/user.py` (column), `backend/app/schemas/user.py`
  (`UserResponse`, `UserPreferencesUpdate`), `backend/app/routers/auth.py`
  (both `UserResponse` construction sites + the PATCH branch)
- Create: `backend/alembic/versions/g7h8i9j0k1l2_add_ui_shell_preference.py`
- Test: extend `backend/tests/test_user_preferences.py`
- Modify (frontend): `frontend/src/types/index.ts` (`User.uiShell`),
  `frontend/src/stores/authStore.ts` (`updatePreferences` prefs type),
  `frontend/src/lib/shellPreference.ts` (backend mirror + sync hook),
  `frontend/src/App.tsx` (mount sync hook)
- Test: extend `frontend/src/lib/shellPreference.test.tsx`

**Interfaces:**
- Consumes: `PATCH /api/auth/me/preferences` (`auth.py:422`), `tab_persistence`
  precedent (`models/user.py:43`, `schemas/user.py:34,52`, migration `e6f7a8b9c0d1`).
- Produces: `GET /api/auth/me` → `uiShell: 'legacy' | 'v2'` (camelCase automatic);
  `useShellPreferenceSync()` hook (mounted once in `App`).

- [ ] **Step 1: Failing backend test** — append to `test_user_preferences.py`
  (mirror the file's existing `test_patch_tab_persistence` style exactly — same
  client/auth fixtures):

```python
    async def test_patch_ui_shell(self, client, auth_headers):
        """PATCH updates ui_shell and echoes it back (camelCase)."""
        resp = await client.patch(
            "/api/auth/me/preferences", json={"uiShell": "v2"}, headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["uiShell"] == "v2"
        # /me reflects it
        me = await client.get("/api/auth/me", headers=auth_headers)
        assert me.json()["uiShell"] == "v2"

    async def test_ui_shell_defaults_to_legacy(self, client, auth_headers):
        me = await client.get("/api/auth/me", headers=auth_headers)
        assert me.json()["uiShell"] == "legacy"

    async def test_ui_shell_rejects_unknown_value(self, client, auth_headers):
        resp = await client.patch(
            "/api/auth/me/preferences", json={"uiShell": "classic"}, headers=auth_headers
        )
        assert resp.status_code == 422
```

- [ ] **Step 2: Run to verify failure** — `cd backend && pytest tests/test_user_preferences.py -q`
Expected: new tests FAIL (422/KeyError `uiShell`).

- [ ] **Step 3: Implement backend.**
  - `models/user.py` — next to `tab_persistence` (line 43), same style:
    ```python
    ui_shell: Mapped[str] = mapped_column(
        String(10), nullable=False, default="legacy", server_default="legacy"
    )
    ```
    (copy `tab_persistence`'s exact `mapped_column` argument shape — match its
    `server_default` form verbatim).
  - `schemas/user.py`: `UserResponse` gains `ui_shell: str = "legacy"`;
    `UserPreferencesUpdate` gains
    `ui_shell: str | None = Field(default=None, pattern=r"^(legacy|v2)$")`.
  - `auth.py`: add `ui_shell=user.ui_shell` / `ui_shell=current_user.ui_shell` to BOTH
    `UserResponse(...)` constructions (lines ~405, ~441) and a PATCH branch:
    ```python
    if body.ui_shell is not None:
        current_user.ui_shell = body.ui_shell
        changed = True
    ```
  - Migration `backend/alembic/versions/g7h8i9j0k1l2_add_ui_shell_preference.py`:
    mirror `e6f7a8b9c0d1_collapse_nav_prefs_into_tab_persistence.py`'s structure —
    `revision = "g7h8i9j0k1l2"`, `down_revision = "e6f7a8b9c0d1"`, upgrade =
    `batch_op.add_column(sa.Column("ui_shell", sa.String(length=10), nullable=False, server_default="legacy"))`
    on `users`, downgrade = `batch_op.drop_column("ui_shell")`. Then verify:
    `python scripts/check_migration_heads.py` → single chain, head `g7h8i9j0k1l2`.

- [ ] **Step 4: Backend green** — `pytest tests/ -q` (full suite).

- [ ] **Step 5: Frontend wiring.**
  - `types/index.ts` `User` (near `tabPersistence`, line ~597): `uiShell?: 'legacy' | 'v2';`
  - `authStore.ts` `updatePreferences` prefs type (line ~205): add `uiShell?: 'legacy' | 'v2';`
  - `lib/shellPreference.ts` — two additions:
    ```ts
    import { useEffect } from 'react';
    import { useAuthStore } from '../stores/authStore';
    // (tabMemory.ts already imports authStore from lib/ — no boundary violation)
    ```
    In `setPreference`, after the localStorage write:
    ```ts
    // Authed users mirror the preference server-side (cross-device). Fire and
    // forget: a failed PATCH must not block the local toggle.
    const { user, updatePreferences } = useAuthStore.getState();
    if (user) void updatePreferences({ uiShell: shell }).catch(() => {});
    ```
    New hook:
    ```ts
    /** Backend-wins hydration (Phase R §4): when /me delivers a uiShell, adopt
     *  it into the store + localStorage so subsequent paints agree. setState
     *  (not setPreference) on purpose — hydration must never PATCH back. */
    export function useShellPreferenceSync(): void {
      const uiShell = useAuthStore((s) => s.user?.uiShell);
      useEffect(() => {
        if (uiShell !== 'legacy' && uiShell !== 'v2') return;
        if (useShellPreferenceStore.getState().preference !== uiShell) {
          useShellPreferenceStore.setState({ preference: uiShell });
          try { localStorage.setItem(SHELL_STORAGE_KEY, uiShell); } catch { /* noop */ }
        }
      }, [uiShell]);
    }
    ```
  - `App.tsx`: call `useShellPreferenceSync()` at the top of the `App` component
    (import from `./lib/shellPreference`).
  - Extend `shellPreference.test.tsx`: mock `../stores/authStore`
    (`useAuthStore` as a callable selector mock with `getState`), assert
    (a) `setPreference` calls `updatePreferences({ uiShell })` when a user exists and
    skips it when not; (b) `useShellPreferenceSync` adopts the user's `uiShell` into
    store + localStorage and never calls `updatePreferences`.

- [ ] **Step 6: Green + commit**

```bash
pnpm -C frontend exec tsc -b && pnpm -C frontend test
cd backend && pytest tests/ -q && cd ..
git add -A && git commit -m "feat(redesign): phase-r — User.ui_shell backend mirror + backend-wins auth hydration"
```

---

### Task 9: e2e — smoke-legacy resurrection + the 6 rot fixes + v2 pinning (C3)

Requires live dev servers (backend :8001, frontend :5174 — start via background tasks;
see memory `project_dev_server_startup`: start each as a background task, NOT foreground).

**Files:**
- Modify: `frontend/e2e/helpers/auth.ts`, `frontend/e2e/contrast.spec.ts`,
  `frontend/e2e/smoke.spec.ts`
- Create: `frontend/e2e/smoke-legacy.spec.ts`

**Interfaces:**
- Consumes: `setStaticPublic`, `stubAuthRefresh` (HEAD helpers); restored legacy UI.
- Produces: `goToTestStaticLegacy(page, waitForAuth?)`, `switchTabLegacy(page, tabName)`.

- [ ] **Step 1: Helpers.**
  - `goToTestStatic`: goto becomes `` `/group/${DEV_SHARE_CODE}?shell=v2` `` and the
    P3 comment is replaced with: "Phase R: the default shell is legacy again; this v2
    suite pins `?shell=v2` (mirror of P2's legacy pinning, inverted). Assertions untouched."
  - ADD `goToTestStaticLegacy` = the f45a241 `goToTestStatic` body verbatim
    (`git show f45a241:frontend/e2e/helpers/auth.ts`), renamed — it already pins
    `?shell=legacy` and waits on the legacy Roster button + UserMenu hydration.
  - ADD `switchTabLegacy` = the f45a241 `switchTab` body verbatim, renamed
    (`page.getByRole('button', { name: new RegExp(\`^${tabName}$\`, 'i') }).click()`).
- [ ] **Step 2: contrast.spec.ts** — the 3 `page.goto` URLs regain `shell=v2&`
  (e.g. `?shell=v2&tab=roster`). Nothing else.
- [ ] **Step 3: smoke.spec.ts** — the single bare inline goto (~line 586)
  becomes `` `/group/${DEV_SHARE_CODE}?shell=v2` ``. Nothing else.
- [ ] **Step 4: smoke-legacy.spec.ts** — start from
  `git show f45a241:frontend/e2e/smoke.spec.ts`, then:
  1. Rename imports/usages: `goToTestStatic` → `goToTestStaticLegacy`,
     `switchTab` → `switchTabLegacy`. Retitle the suite "Legacy shell smoke".
  2. Sweep for any other bare `/group/` gotos and pin `?shell=legacy`.
  3. Apply the 6 rot fixes (spec §8 — all test drift, not product bugs):

| Test | Fix |
|---|---|
| 2 — Schedule tab loads | Run it; re-assert against the restored `ScheduleTab`'s ACTUAL heading/copy (read the restored component if unclear) |
| 10 — guest cannot access private schedule | `setStaticPublic(page, false)` after owner login + fresh browser context for the guest + `try/finally` restore `setStaticPublic(page, true)` (P3-proven pattern, helper already at HEAD) |
| 11 — owner opens settings panel | With servers running, identify the LIVE legacy settings trigger (desktop = `SettingsDockToggle` docked at the right edge; check its aria-label in `components/layout/SettingsDockToggle.tsx`) and update the selector |
| 12 — guest sees Private Static wall | Same fix as 10 |
| 13 — settings panel has management tabs | Same fix as 11 |
| 14 — Lodestone mock from PlayerCard | Keep the `isLodestoneMockEnabled` guard; fix detection to `GET /api/lodestone/status` → body `{mockMode: true, ...}` = enabled, 404 = disabled; the flow drives the restored `LodestoneSearchModal` |

- [ ] **Step 5: Run BOTH suites in one run** (spec exit gate — shared-DEVTST state
  must not interfere):

```bash
cd frontend && pnpm exec playwright test e2e/smoke.spec.ts e2e/smoke-legacy.spec.ts
```
Expected: all green. If cross-suite interference appears, fix with the existing
cleanup/`try/finally` patterns — never by serializing assertions away.

- [ ] **Step 6: Also run contrast** — `pnpm exec playwright test e2e/contrast.spec.ts`
(needs both themes; all green).

- [ ] **Step 7: Commit**

```bash
git add frontend/e2e && git commit -m "test(redesign): phase-r — resurrect smoke-legacy (6 rot fixes), pin v2 suites to ?shell=v2"
```

---

### Task 10: Full gate + freeze verification

**Files:** none new (fallout fixes only).

- [ ] **Step 1: Freeze check** — every restored file byte-identical to f45a241:

```bash
for f in $(cat /tmp/restore-list.txt); do git diff --quiet f45a241 -- "$f" || echo "DRIFT: $f"; done
# expect: no output. (navPreferences.ts is EXPECTED to differ — comment edit; it is not in the list.)
```

- [ ] **Step 2: Full CI gate**

```bash
cd frontend
pnpm build                          # tsc -b && vite build — must be clean
pnpm lint                           # 0 errors (warnings only in restored files per their f45a241 suppressions)
pnpm check:design-system:strict
pnpm test
pnpm tokens:check
git diff --check
cd ../backend && pytest tests/ -q
```

- [ ] **Step 3: Fix any fallout** (each fix stays within the audit's dispositions —
  a restored file may NOT be edited to fix lint; suppressions or the shared-file side
  carry the fix), commit:

```bash
git add -A && git commit -m "chore(redesign): phase-r — full-gate fallout"
```
(Skip the commit if there was no fallout.)

---

## Post-task pipeline (execution session drives these; not subagent tasks)

1. **Whole-branch review** — `redesign-reviewer` over `git diff 09ec09b..HEAD` with the
   spec + this plan; adjudicate findings (ultracode effort per memory).
2. **Browser validation** (spec §9): dev-auth `/api/dev-auth/login/0` → `/group/DEVTST`:
   bare URL → legacy renders (Header + SidebarNav + tabs) · banner click → v2 mounts
   in place, no reload · user-menu → back to legacy · `?shell=` overrides BOTH
   directions · preference survives reload · all four main tabs render in BOTH shells ·
   BOTH themes. Capture screenshots (chrome-devtools MCP), copy out of scratchpad into
   `docs/redesign/pr-shots/phase-r-*.png`, commit.
3. **PR** into `redesign/foundation`: embed screenshots (both shells × both themes +
   banner + menu item + toggle evidence); body documents every sanctioned shared-file
   edit with per-file rationale (the audit table above is the source), the deliberate
   dispositions (no `?shell=` re-append on in-app nav; keyboardShortcutGroups verbatim
   restore → v2 palette lists legacy shortcuts, deferred to Phase B/E; Shift+?/
   shellParam non-restorations), and the C1/C2/C3 ratifications. THEN append the
   release-note entry (now the PR number exists):
   ```ts
   {
     internal: true,
     category: 'improvement',
     title: 'Dual shell restored — classic UI is the default again',
     description: 'The classic group UI is back as the default experience, with the redesigned v2 shell available behind a persisted "Try the new UI" opt-in (and a "Switch to classic UI" path back). Shell choice syncs to your account and both directions emit telemetry.',
     pr: <PR#>, prTitle: '<the PR title>',
   },
   ```
   push, ensure CI green. NO AI attribution anywhere.
4. **pr-review-loop** until clean → squash-merge (guard requires checks green) →
   delete branch.
5. **Bookkeeping**: SESSION_HANDOFF.md, memory (`project_redesign_execution` etc.),
   then Phase A (ROLLOUT_ROADMAP §3).

## Self-review notes (spec → plan coverage)

- Spec §2 restoration mechanics → Tasks 3+5 (73 byte-for-byte + audit table for all 56 M).
- Spec §3 gate → Tasks 2+6 (one resolver, two consumers; 3-way precedence test).
- Spec §4 backend mirror → Task 8 (backend-wins hydration; guests localStorage-only).
- Spec §5 toggle UX + telemetry (incl. ❓5 dismiss event) → Task 7.
- Spec §6 C1 → Tasks 3 (hook state) + 5 (v2 stays lview-based); C2 → Tasks 3 (wizard,
  split-clear subtree) + 5 (MorePage optional prop, `!slots?.roster` gate); C3 → Task 9.
- Spec §7 GVC reconciliation → Task 5 (fable/opus; keeper hunks enumerated).
- Spec §8 smoke-legacy + 6 rots → Task 9. Spec §9 gates/freeze → Task 10 + pipeline.
- Audit deltas found beyond the spec's table (Loot.tsx deep-link `shell=v2`, loot
  barrel restore, NewShell-test splitClearStore mocks, keyboard latch gating,
  `switchTabLegacy` helper) are all captured in tasks with rationale.
