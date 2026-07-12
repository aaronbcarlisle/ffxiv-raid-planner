# Phase R — Restore the Dual Shell (Design Spec)

> **Status:** APPROVED (2026-07-11 user skim — no notes; all §11 recommendations stand:
> C1/C2/C3 ratified, backend mirror in scope, `ui_shell_banner_dismiss` included,
> banner copy via PR screenshots). Executes ROLLOUT_ROADMAP §2 (plan of
> record, user decisions locked 2026-07-11). Base: `redesign/foundation` @ `09ec09b`.
> Restore source: `f45a241` (P2-final tree = `cf25c92^`).
>
> Everything here was verified against the actual `f45a241..cf25c92` diff (76 deleted /
> 56 modified / 13 added files, frontend-only) — not against the parity-flip spec's §6
> prose, which `cf25c92` deviated from in places (D-P3-1: Header/SettingsDockToggle/
> SettingsPanelController were kept, not deleted).

---

## 1. Goal · shape · non-goals

**Goal:** both shells live behind a **persisted user preference**; legacy back at its P2
state (+ P3's keeper fixes), **default legacy**; explicit toggle UX in both directions
with `ui_shell_toggle` telemetry from day one; legacy e2e coverage resurrected and
un-rotted. Exit = ROLLOUT_ROADMAP §2's exit gate.

**Non-goals:** none of Phase A's 12 fixes or quick wins land here (next slice — keeps
this PR reviewable as pure restoration + gate); no feature backports into legacy; no
Phase B matrix work; no `main` interaction. Public release note waits for Phase G
(internal entry only, no version bump).

**Shape:** one slice branch (`redesign/phase-r-dual-shell`) → PR into
`redesign/foundation` with screenshots (both shells × both themes + toggle evidence).

---

## 2. Restoration mechanics — the rule, then the exceptions

The P3 squash bundled deletions WITH keeper changes, so neither a blind revert nor a
blind file-restore is correct. The rule:

- **Deleted files (76):** `git checkout f45a241 -- <path>` — restored **byte-for-byte**,
  immediately re-frozen (bugfix-only). List = `git diff f45a241 cf25c92
  --diff-filter=D --name-only`. Covers: `GroupView.tsx`, `GroupRoute.test.tsx`,
  the 4 legacy `GroupViewContent.*.test.tsx` suites, `SidebarNav`(+test), player-card
  chain (`PlayerCard`/`PlayerGrid`/`GearTable`/`PlayerSetupBanner`/
  `LodestoneSearchModal`/…), history tree (`HistoryView`/`SectionedLogView`/
  `AllWeeksView`/`WeeklyLootGrid`/…), loot tree (`LootPriorityPanel`/
  `QuickLogDropModal`/`WhoNeedsItMatrix`/`FloorSelector`/`SummaryPanel`/…),
  legacy schedule (`ScheduleTab`/`ScheduleUpcomingPanel`/`SessionCard`/`index.ts` —
  no name collisions with the v2 files in the same dir; the barrel only exports
  `ScheduleTab`), split-clear subtree + `splitClearStore` + `splitClear*` utils +
  `lootRecommendationService`(+tests), `StaticHomeTab`(+test), `TeamSummaryEnhanced`,
  `flip.spec.ts` is **NOT restored** (its subject was the P2 gate; §3's new gate gets
  its own test).
- **Added files (13):** all keepers, untouched (`PluginPage.test`, `GearSyncDashboard.test`,
  `MorePage.test`, `GroupViewContent.slots.test` [reconciled, §7], `newShellTestScaffold`,
  `dragTypes.ts`/`syncStatus.ts` extractions, P3 plan doc, pr-shots).
- **Modified files (56): default = keep HEAD** (keepers preserved by construction).
  Exceptions below — files where P3 deleted legacy-load-bearing code out of shared
  modules. **The implementation plan MUST hunk-audit all 56** (classify every hunk
  keeper vs legacy-supporting); the enumerated set from my audit:

| File | Disposition |
|---|---|
| `pages/GroupViewContent.tsx` | **Hand reconciliation — riskiest task (§7).** |
| `hooks/useGroupViewState.ts` | Restore legacy state surface: `gearSubTab`/`lootSubTab` (+parsers, defaults, `navigationType` reconciliation), log-modal state, `LogWeekWizard` state, keyboard-help state. P3's diff here is deletion-only → effectively revert. See correction C1. |
| `hooks/useGroupViewKeyboardShortcuts.ts` + `ui/keyboardShortcutGroups.ts` (+tests) | Restore Alt+L/U/B and legacy shortcut groups (fix-wave removed the "dead-flag latch" — dead only in a v2-only world). |
| `components/group/MorePage.tsx` | Keep HEAD (lview Loot-History card, Integrations→Settings). Restore the **Split Planner card** behind a now-**optional** `onOpenSplitPlanner` prop — rendered only when provided (§6 C2). |
| `App.tsx` | New `GroupRoute` element on `group/:shareCode` (§3); lazy-NewShell moves inside it. |
| `components/layout/Layout.tsx` | Suppression predicate `!isGroupRoute` → "not (group route ∧ resolved shell = v2)" via the shared hook (§3). Header + SettingsDockToggle return on legacy group routes. |
| `lib/navPreferences.ts` | Restore `'shell'` to `TRANSIENT_NAV_PARAMS` + its hazard comment (updated: the silent-flip hazard is worse now that a *preference* exists). |
| `eslint-suppressions.json` | Re-add exactly the entries the restored files carried at `f45a241` (P3 pruned `SidebarNav`×1, `AllWeeksView`×2). No new suppressions. |
| `data/releaseNotes.ts` | Append a new internal entry; keep P3's entry as history. |
| `components/wizard/SetupWizard.tsx` + steps + types | Restore the split-clear wizard toggle hunks (§6 C2 — capability exists on main). |
| `hooks/navParsers.test.ts`, `useGroupViewKeyboardShortcuts.test.ts`, `useStaticNavMemory.test.tsx`, `lib/navPreferences.test.ts` | Restore expectations for restored behavior (hunk-level). |
| Minor audit set: `TipsCarousel` (−7), `Home.tsx` (±4), `useVisibilityRefresh` (±4), `useStaticNavMemory` (±2), `useViewAsUrlSync` (±2), `StaticPicker`, `SidebarRail`, `NotificationBell`, `railTypes`, `CharacterLinkModal`, `CharacterSyncBadge`, `RosterCard(s)`, `DesignSystem.tsx`, `V2SettingsHost`, `CommandPalette` (±7) | Expected keep-HEAD (comment/import repoints); hunk audit confirms each. Restore any legacy-referencing tip/entry only if it targets a restored surface. |

Restored `GroupView.tsx` calls `useViewAsUrlSync` and NewShell also mounts it — the
gate renders exactly one of them, so the single-mount contract holds.

**Mechanical safety nets:** `tsc -b` (the restored tree must compile against HEAD-state
shared modules — this is the detector for any missed hunk), restored legacy unit suites,
both smoke suites, browser validation both shells.

---

## 3. The shell gate

New module `lib/shellPreference.ts` + tiny Zustand store (settingsPanelStore precedent):

- `type Shell = 'legacy' | 'v2'`; localStorage key **`ui-shell`**.
- `useShellPreferenceStore`: `{ preference, setPreference }` — hydrated from
  localStorage at module init; `setPreference` writes store + localStorage + (authed)
  fire-and-forget backend mirror (§4). Analytics fires at the call sites (§5), not here.
- `useResolvedShell(): Shell` — precedence: `?shell=` URL param (`legacy`/`v2` only;
  anything else ignored) → store preference → **default `legacy`**. The URL param NEVER
  writes the preference (it's the support/deep-link override).
- **One resolver, two consumers:** new `pages/GroupRoute.tsx` (`v2` → lazy `NewShell`,
  else `GroupView`) and `Layout`'s suppression predicate both call `useResolvedShell()`
  — no duplicated precedence logic. Store subscription makes toggles take effect
  without a reload (shell remounts in place).
- New `GroupRoute.test.tsx` covers the 3-way precedence (param beats preference beats
  default) — not the restored P2 test, which asserted a v2 default.

---

## 4. Preference persistence (backend mirror — cheap, in scope)

`User.tab_persistence` (String(20), server_default) is the exact precedent, so the
"when cheap" condition in the roadmap is met:

- Backend: `ui_shell` column (`String(10)`, default + server_default `'legacy'`) +
  alembic migration; expose in `/api/auth/me`; accept in the same user-preference
  update path `tab_persistence` uses (plan verifies the exact endpoint).
- Frontend hydration rule: **backend wins at auth hydration** (store + localStorage
  updated from `/me`); localStorage covers guests, pre-hydration paint, offline.
  Cross-device divergence therefore resolves to the last device that toggled; the
  one-time shell remount when hydration changes the value is accepted (identical to
  clicking the toggle).
- Guests: localStorage only.

Droppable to localStorage-only without blocking the phase if the skim says trim (❓4).

---

## 5. Toggle UX + telemetry

- **Legacy → v2:** dismissible "✨ Try the new UI" banner in the legacy `Header`,
  rendered when: group route ∧ resolved shell `legacy` ∧ not dismissed
  (localStorage `ui-shell-banner-dismissed`). Sanctioned edit to the live shared
  `Header.tsx` (roadmap-mandated entry point; documented in PR body). Design-system
  primitives only; placement/copy finalized during implementation — PR screenshots
  are the review surface (❓6).
- **v2 → legacy:** "Switch to classic UI" item in the shared `UserMenu` (it already
  hosts preference toggles), gated: group route ∧ resolved shell `v2`.
- **Both actions:** `analytics.track('navigation', 'ui_shell_toggle', { direction:
  'to-v2' | 'to-legacy', surface: 'legacy-banner' | 'v2-user-menu' })` →
  `setPreference(...)` → strip any `?shell=` param from the URL (else the override
  would immediately defeat the toggle).
- Banner dismissal fires `ui_shell_banner_dismiss` (recommended extra — sunset
  telemetry wants opt-in *and* refusal signals; ❓5).

---

## 6. Corrections to ROLLOUT_ROADMAP §2 (ratify via this skim)

- **C1 — "gearSubTab removal end-to-end" cannot survive as written.** P3 removed that
  state from the *shared* `useGroupViewState`, and legacy's Gear tab (sub-tabs
  sync/priority/history/stats, its History body, `TeamSummaryEnhanced` via `stats`)
  is built on it. Corrected keeper: **v2 stays gearSubTab-free** (its Loot `lview`
  param and the MorePage lview card stand); the hook's legacy surface + legacy URL
  params return. `GroupView.tsx` restores byte-for-byte only under this correction.
- **C2 — split-clear + TeamSummaryEnhanced return.** Both **exist on `main`** (verified
  `git ls-tree main`), so their deletion is a v1-capability regression the dual shell
  exists to prevent — D-P3-2/D-P3-3 stand only as *v2-side* dispositions (Phase B
  decides v2's version). Restoration is automatic (they're in the D-list; GVC's roster
  fallback renders `SplitClearPlanner`; `stats` renders TeamSummary). Reachability
  restored legacy-only: MorePage Split Planner card renders only when GVC passes the
  handler, and GVC passes it only in legacy context (`!slots?.roster`). The wizard
  split-clear toggle returns (it's shared, but the capability it configures is
  main-parity).
- **C3 — the v2 smoke suite cannot stay literally untouched.** With default = legacy,
  `goToTestStatic`'s bare navigation would land on legacy and every v2 assertion
  fails. Fix: the v2 helper + `contrast.spec.ts` URLs pin `?shell=v2` (mirror of P2's
  legacy pinning, inverted). **Assertions untouched**; navigation lines only.

---

## 7. `GroupViewContent.tsx` reconciliation ⚠️ riskiest task

Current HEAD is 437 lines with `slots` **required**; `f45a241` is 1410 lines with
optional `slots` + fallbacks. The P3 delta is ~1109 changed lines of which only ~dozens
are keepers → **start from the `f45a241` body and re-apply HEAD's keeper hunks**, not
the other way around:

1. `PageSkeleton` tier-snapshot-fetch window (P3 keeper; import + render branch).
2. `onOpenLootHistory` MorePage handler — becomes **shell-aware inside GVC**: v2
   context (`slots?.gear` present) → the HEAD lview behavior; legacy context →
   `setPageMode('gear', { sub: 'history' })` (the f45a241 behavior). MorePage keeps
   ONE prop; GVC owns the branch.
3. `onOpenSplitPlanner` passed only when `!slots?.roster` (C2).
4. Anything else the hunk audit surfaces (audit is mandatory, not optional).

Contract restored: `slots?.x ?? <legacy body>` per pageMode; split-clear fetch/clear
effects return; sticky roster toolbar + mobile legacy controls return. NewShell still
passes all four slots unconditionally — **zero v2 behavior change**, proven by the
existing NewShell suites.

Tests: the 4 restored `GroupViewContent.*.test.tsx` suites (fallback characterization)
must pass as restored; `GroupViewContent.slots.test.tsx` is reconciled to the
optional-slots contract (its v2-slot assertions stay; its "slots required" framing goes).

**Implementer: fable/opus** (per roadmap §9) + redesign-reviewer. All other tasks
default sonnet-5.

---

## 8. Legacy e2e — `smoke-legacy.spec.ts` resurrection + the 6 rot fixes

New file `frontend/e2e/smoke-legacy.spec.ts` = `f45a241:frontend/e2e/smoke.spec.ts`
(14 scenarios), renamed, plus a new additive helper `goToTestStaticLegacy` in
`helpers/auth.ts` (pins `?shell=legacy`, waits on legacy header affordances —
replicating P2's pinning). The v2 `smoke.spec.ts` keeps its own helper (pinned per C3).

The 6 rots (all test drift, not product bugs — proven pre-existing in the P2 PR against
a `0139de2` worktree) and their fixes:

| # | Test | Rot | Fix |
|---|---|---|---|
| 1 | 2 — Schedule tab loads | Legacy schedule copy drifted during F6 | Re-assert against the restored `ScheduleTab`'s actual heading/copy |
| 2 | 10 — guest cannot access private schedule | dev-auth flips DEVTST `is_public=True` on every login | `setStaticPublic(false)` (helper already at HEAD) + `freshContext` + `try/finally` restore — the P3-proven pattern |
| 3 | 11 — owner opens settings panel | Settings modal→slide-out migration renamed the trigger | Update to the live legacy trigger selector (identified with servers running) |
| 4 | 12 — guest sees Private Static wall | Same cause as #2 | Same fix as #2 |
| 5 | 13 — settings panel has management tabs | Same cause as #3 | Same fix as #3 |
| 6 | 14 — Lodestone mock from PlayerCard | Mock-status endpoint semantics drifted | Keep the `isLodestoneMockEnabled` guard; fix detection per `GET /api/lodestone/status` → `{mockMode:true,…}`/404; drives the restored `LodestoneSearchModal` |

Both suites live in `e2e/` (playwright `testDir` picks both up); both must pass in the
same run (watch for shared-DEVTST state interference; the existing cleanup patterns +
`try/finally` restores cover it).

---

## 9. Process · gates · freeze

- Full CI gate: `pnpm build` (`tsc -b`) · `pnpm lint` (0 err) ·
  `check:design-system:strict` · `pnpm test` · `tokens:check` · `git diff --check`.
  Restored files re-enter lint with their f45a241 suppression entries only.
- Browser validation (dev-auth `/api/dev-auth/login/0` → `/group/DEVTST`): bare URL →
  legacy renders; banner click → v2 mounts in place; user-menu → back to legacy;
  `?shell=` overrides both directions; preference survives reload; both themes; both
  shells' four main tabs render. Screenshots embedded in the PR (both shells × both
  themes + banner + menu item).
- Freeze discipline: restored D-files byte-for-byte frozen at merge (baseline =
  f45a241 content); reconciled shared files documented as sanctioned edits in the PR
  body with per-file rationale.
- Internal release note; no `CURRENT_VERSION` bump. NO AI attribution.
- After merge: SESSION_HANDOFF + ledger + memory bookkeeping, then Phase A.

## 10. Exit gate (= ROLLOUT_ROADMAP §2)

Both shells render `/group/DEVTST` correctly · toggle round-trips and persists (incl.
backend mirror if in scope) · `smoke-legacy` AND `smoke` suites green in one run ·
full CI gate green · browser validation both shells, both themes.

---

## 11. ❓ Skim list

1. **C1** (gearSubTab keeper corrected: legacy surface returns, v2 stays free of it) — accept?
2. **C2** (split-clear + TeamSummary + wizard toggle return; Split Planner card legacy-only via optional prop) — accept?
3. **C3** (v2 smoke helper + contrast URLs pin `?shell=v2`; assertions untouched) — accept?
4. Backend mirror in scope (`ui_shell` column, backend-wins hydration) — or trim to localStorage-only?
5. `ui_shell_banner_dismiss` extra event — include?
6. Banner placement/copy settled at implementation, reviewed via PR screenshots — OK?
