# Plan J — Theme / Light-Mode Accessibility

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make light mode correct across the whole app by converting hardcoded inline colors/gradients to theme tokens, adding the few missing gradient/parchment tokens, and adding enforcement so new sections can't silently ship dark-only colors again.

**Architecture:** The token system is already complete — dark tokens in `@theme {}` and a full `[data-theme="light"]` override set in `index.css`. The defect is purely **implementation**: ~181 inline `style={{ background: rgba(...) / linear-gradient(...) }}` and arbitrary `bg-[#hex]` declarations bypass the tokens, so they don't switch in light mode. Fix = convert offenders to tokens (via `var(--token)` / `color-mix()`), add gradient + parchment tokens for the cases tokens don't cover yet, and add a lint rule catching inline hardcoded colors.

**Tech Stack:** Tailwind v4 + CSS custom properties, `color-mix()`, the `data-theme` switch in `hooks/useTheme.ts`. ESLint (`eslint-design-system-plugin.js`).

> **Line numbers are point-in-time — match on code/strings and verify.** Coordinate with Plan F §5 (typography) — both touch `index.css` + the lint plugin; land one then rebase the other.

## Global Constraints

- NEVER add AI attribution to commits/PRs.
- Use semantic tokens (`var(--color-*)`) and `color-mix(in srgb, var(--color-accent) X%, transparent)` for tints — never raw hex/rgba in `style` or `bg-[#...]`.
- "static" not "group" in user-facing copy.
- **Release/version — per `docs/superpowers/ROADMAP.md` (one coordinated rollout):** add release-note **entries** under the single rollout version **`2.0.0`** (light-mode users WILL see this → prefer a public entry with `description`/`pr`/`prTitle` + full ISO date; `internal: true` only for the lint/audit steps). **Do NOT bump `CURRENT_VERSION`** — only the stack-base branch (Plan A) sets it. This supersedes any per-plan "bump `CURRENT_VERSION`" wording in the steps below.
- Pre-PR gate + **manual light-mode toggle on every touched page**.

## Verified reference points

- Theme switch: `hooks/useTheme.ts` sets `data-theme` on `<html>` + `colorScheme`. FOUC guarded by an inline script in `index.html`.
- Tokens: `index.css` — dark in `@theme {}` (~4–161), light in `[data-theme="light"] { }` (~167–260) + light-only rules (~276–399). Surfaces (5), accent (7), text (5), borders (4), role/membership/gear/status/material, shadows.
- **Missing tokens:** no gradient tokens (sidebar gradient + accent gradients are hardcoded in both themes); no light values for the JoinRequest gold/amber "parchment" palette.
- Lint: `eslint-design-system-plugin.js` enforces no-raw-elements + (per the color audit) no-hardcoded-hex in className, but does **NOT** check inline `style` colors or `bg-[#...]` arbitrary classes → the loophole.

## Offender inventory (from audit — grouped)

- **Sidebar dark gradient (no light variant) — CRITICAL:** `SidebarNav.tsx:53`, parallel in `Profile.tsx` (`ProfileSidebarNav`). `linear-gradient(180deg,#0c0c14,#090910,#07070e)`.
- **Accent `rgba(20,184,166,…)` tints/gradients (~140+):** `SidebarNav.tsx:67,83,157–168`, `PageHeader.tsx:17,26,35`, `GearSyncDashboard.tsx:74,86,116,134,143,171`, `OverviewTab.tsx` (multiple 115,287–294,348,550,553), `Profile.tsx:121,136,553,558,684`, `MobileBottomNav.tsx:74,113`, `GroupView.tsx:963,976`, `StaticHomeTab.tsx:748–763,823`, `PreviewShareTab.tsx:189,332`.
- **JoinRequest parchment hex (~100, gold/amber, no light values):** `JoinRequestModal.tsx`, `JoinRequestReviewModal.tsx` (`#b8933a`,`#8b6914`,`#2d1e13`,`#e8d9b8`,`#f5ede0`,…).
- **White low-opacity overlays (invisible on light):** `GearSyncDashboard.tsx:171`, `GoalsPage.tsx:28`, `OverviewTab.tsx:115,550`, `GroupView.tsx:976,1302`.
- **Pure-black bg:** `GearMathDocs.tsx:132` (`rgba(6,6,8,1)`).

### User-reported in Wave 1 smoke (2026-06-26) — confirm these are covered

Surfaces that stay dark in light mode and must be tokenized in this sweep:
- **Schedule page cards:** the "recurring series", "Discord sync", and "Dalamud plugin" panels (`components/schedule/*` — `ScheduleUpcomingPanel.tsx` and the recurring/integration cards). Same dark card style recurs on the Gear & Sync page.
- **`PluginPage.tsx`** (new — plugin setup moved here from `GearSyncDashboard` in `ui/nav-shell-fixes`): install-step medallions + API-key panel use `rgba(20,184,166,…)` / `rgba(255,255,255,0.02)` — tokenize (accent via `color-mix`, raise via `--color-overlay-raise`).
- **`MorePage.tsx`** card sections.
- **Rail gradient:** ✅ already done — `AppRail.tsx` now uses `var(--gradient-rail)` (Task 2 of this plan can be marked covered for the rail; `Profile.tsx` `ProfileSidebarNav` now routes through `AppRail` too, so both rails are tokenized).

---

## Task 1: Add the missing tokens (gradients + parchment + overlay)

**Files:** Modify `frontend/src/index.css`

- [ ] **Step 1: Sidebar gradient tokens**

Add a `--gradient-rail` token defined per theme:
```css
@theme { --gradient-rail: linear-gradient(180deg, #0c0c14 0%, #090910 60%, #07070e 100%); }
[data-theme="light"] { --gradient-rail: linear-gradient(180deg, #f3f4f8 0%, #eceef4 60%, #e7e9f1 100%); }
```
(Pick light values that match the light surface scale; verify contrast with rail text/active states.)

- [ ] **Step 2: Accent-tint helper convention (no token needed)**

Standardize accent tints on `color-mix(in srgb, var(--color-accent) X%, transparent)` so they track the themed `--color-accent` automatically. Document this in `DESIGN_SYSTEM_SUMMARY.md` as the replacement for `rgba(20,184,166,X)`.

- [ ] **Step 3: Overlay tokens**

Add `--color-overlay-raise` (the "white haze") per theme: dark = `rgba(255,255,255,0.03)`, light = `rgba(0,0,0,0.03)` so the subtle raise is visible in both.

- [ ] **Step 4: Parchment/seal tokens for JoinRequest**

Add a small `--color-parchment-*` / `--color-seal-*` set with dark AND light values (the scroll aesthetic should read on both), OR decide to reskin those modals onto the accent system. Record the chosen approach. (Define tokens here; apply in Task 4.)

- [ ] **Step 5: Commit**
```bash
git add frontend/src/index.css frontend/docs/DESIGN_SYSTEM_SUMMARY.md
git commit -m "feat(theme): add rail-gradient, overlay, and parchment tokens with light values"
```

---

## Task 2: Convert the CRITICAL sidebar gradients

**Files:** `SidebarNav.tsx` (or Plan A `AppRail.tsx`), `pages/Profile.tsx`

- [ ] **Step 1:** Replace `style={{ background: 'linear-gradient(180deg,#0c0c14…)' }}` with `style={{ background: 'var(--gradient-rail)' }}` in the rail(s). If Plan A's `AppRail` already centralizes the rail, change it once there.
- [ ] **Step 2: Manual:** toggle light mode — the rail is light (not a dark slab) and rail text/active states are legible.
- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/layout/SidebarNav.tsx frontend/src/pages/Profile.tsx
git commit -m "fix(theme): rail uses themed gradient token (light mode no longer dark)"
```

---

## Task 3: Convert accent `rgba`/gradients + white overlays (by area, one commit each)

**Files:** the accent-tint + overlay offenders above (do a few files per commit).

- [ ] **Step 1: Mechanical replace per file**

Replace each `rgba(20,184,166,X)` → `color-mix(in srgb, var(--color-accent) {X*100}%, transparent)`; accent gradients → gradients built from `var(--color-accent)` + `color-mix`; `rgba(255,255,255,0.0X)` raise → `var(--color-overlay-raise)`; `GearMathDocs` black bg → `var(--color-surface-base)`. Keep the visual weight the same in dark mode (verify the `color-mix` percentage matches the old alpha).

- [ ] **Step 2: Per-area verification + commit**

After each cluster (e.g. header/rail, gear-sync, overview/profile, mobile-nav), toggle light mode on those pages and confirm the elements are visible and on-theme; dark mode unchanged.
```bash
git add <files in this cluster>
git commit -m "fix(theme): tokenize accent tints/overlays in <area> for light mode"
```

---

## Task 4: Reconcile the JoinRequest parchment modals

**Files:** `components/static-group/JoinRequestModal.tsx`, `JoinRequestReviewModal.tsx`

- [ ] **Step 1:** Apply the Task 1 parchment/seal tokens (or the accent reskin) to every hardcoded hex in these two files, so the scroll/parchment aesthetic has proper dark AND light renderings (legible text + borders in both).
- [ ] **Step 2: Manual:** open both modals in light and dark — readable, on-theme, no blended-out text.
- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/static-group/JoinRequestModal.tsx frontend/src/components/static-group/JoinRequestReviewModal.tsx
git commit -m "fix(theme): JoinRequest modals render correctly in light mode"
```

---

## Task 5: Enforcement — lint rule for inline hardcoded colors

**Files:** Modify `frontend/eslint-design-system-plugin.js`

- [ ] **Step 1: Add a `no-inline-hardcoded-color` rule**

Flag JSX `style={{ ... }}` values containing hex (`#xxxxxx`) or `rgb(a)(...)` color literals, and `className` arbitrary color classes `bg-[#...]` / `text-[#...]` / `border-[#...]`. Allow an opt-out via a `design-system-ignore` comment for the rare justified case. Start as **warn** (legacy sites remain) then flip targeted directories to error once cleared.

- [ ] **Step 2: Verify** `pnpm lint` surfaces remaining offenders without blocking CI (warn). Confirm the converted files are clean.

- [ ] **Step 3: Commit**
```bash
git add frontend/eslint-design-system-plugin.js
git commit -m "chore(theme): lint warn on inline hardcoded colors so light mode can't regress"
```

---

## Task 6: Release note + full light-mode verification

**Files:** Modify `frontend/src/data/releaseNotes.ts`

- [ ] **Step 1:** Public entry: "Light mode polish — fixed sections and panels that stayed dark when switching to light theme." `pr`/`prTitle`/ISO date; bump `CURRENT_VERSION`.
- [ ] **Step 2: Full gate + manual sweep**

`cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test`. Then toggle light mode and walk every major surface (home, rail, header, overview, gear/sync, schedule, roster, collections, settings panel, join-request modals, admin, docs) confirming nothing stays dark/illegible.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/data/releaseNotes.ts
git commit -m "docs(release): light-mode accessibility pass"
```

---

## Self-review notes (already applied)

- **Root cause is implementation, not design:** light tokens already exist and are comprehensive — the work is converting ~181 inline hardcoded colors/gradients to tokens, plus adding the 2 token gaps (rail gradient, parchment) and an overlay token.
- **`color-mix(var(--color-accent))`** replaces `rgba(20,184,166,X)` so tints follow the themed accent automatically — fixes the largest offender class in one pattern.
- **Enforcement closes the loophole:** the existing plugin ignores inline `style` colors; Task 5 adds that check (warn) so new sections inherit theme correctness by default — directly addressing "easier to integrate new sections without missing the theme logic".
- **Critical-first:** the sidebar gradient (Task 2) is the most visible breakage; JoinRequest parchment (Task 4) is the largest single cluster.
- **Coordinate with Plan F §5** (both edit `index.css` + the lint plugin).
- **Line numbers are point-in-time** — verify before editing.
```
