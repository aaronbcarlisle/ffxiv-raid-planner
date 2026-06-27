# Plan I — Navigation, Context & Misc Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A batch of navigation/context UX items: retain the active static across contexts, nav renames, hide the week selector on All Weeks, Suggest-Content deep-link + highlight, consolidate the redundant statics selectors + add schedule sub-items, move My Statics into the Player Hub, calmer context/tier transitions, panel header-to-toggle + cleaner slideouts, and a Join-Discord button on Home.

**Architecture:** Mostly localized edits against `Header.tsx` / `ContextSwitcher.tsx` / `Profile.tsx` / `Dashboard.tsx` plus the settings panel. Reuses the `useViewNavigation` highlight pattern for the Suggest button and the `navPreferences`/route-param plumbing already in place.

**Tech Stack:** React 19 + TS, framer-motion, react-router, design-system primitives. Vitest/@testing-library.

> **Line numbers are point-in-time — match on code/strings and verify.**
> **Cross-plan coordination:** §2 renames touch the `AppRail` nav items defined in **Plan A** — if A landed, edit `AppRail` callers; if not, edit `SidebarNav`/`ProfileSidebarNav`. §6/§5 touch the Player Hub rail (Plan A) and the settings Goals tab (Plan C). §8 relates to **Plan B** (RightDockPanel) + the SlideOutPanel.

## Global Constraints

- NEVER add AI attribution to commits/PRs.
- Design system: primitives/tokens only; run `pnpm check:design-system`.
- "static" not "group" in user-facing copy.
- **Release/version — per `docs/superpowers/ROADMAP.md` (one coordinated rollout):** add release-note **entries** to `frontend/src/data/releaseNotes.ts` under the single rollout version **`2.0.0`** (public entry with `description`/`pr`/`prTitle` + full ISO date for user-facing; `internal: true` for non-visible). **Do NOT bump `CURRENT_VERSION`** — only the stack-base branch (Plan A) sets it. This supersedes any per-plan "bump `CURRENT_VERSION`" wording in the steps below.
- Pre-PR gate: `cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test`.

---

# Section 1 — Retain active static across contexts

**Diagnosis:** `Header.tsx` (~218) passes `currentGroup={isGroupRoute ? currentGroup ?? null : null}` to `ContextSwitcher`, so on `/profile` or `/discover` the active static is treated as null even though `staticGroupStore.currentGroup` still holds it. Switching to Player Hub/Finder therefore "loses" the static.

## Task 1.1: Stop clearing the active static off-route

**Files:** Modify `frontend/src/components/layout/Header.tsx`

- [ ] **Step 1:** Change the `ContextSwitcher` prop to `currentGroup={currentGroup ?? null}` (drop the `isGroupRoute ?` conditional). Keep the **Tier Selector** gated on `isGroupRoute && currentGroup && tiers.length > 0` (the tier UI should still only show inside a static).
- [ ] **Step 2: Verify** the Static segment stays pointed at the same static after visiting Player Hub/Finder and back; the `ContextSwitcher`'s `onStatic`/`onHub` active states still reflect the route (they key off `location.pathname`, not `currentGroup`, so they remain correct).
- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/layout/Header.tsx
git commit -m "fix(nav): retain the active static when switching to Player Hub / Static Finder"
```

---

# Section 2 — Nav renames (Loot Log, Tracking)

**Diagnosis:** Static rail items "Gear & Sync" and "Goals & Farms", and Player Hub rail item "Collections & Goals", need renames. Defined in `SidebarNav.tsx` `NAV_ITEMS` (or `AppRail` callers post-Plan A) and `Profile.tsx` `PROFILE_NAV_ITEMS`.

## Task 2.1: Rename labels (keep ids/routes)

**Files:** `SidebarNav.tsx` (or Plan A's `SidebarNav` caller), `pages/Profile.tsx`, and any tab headers/breadcrumbs referencing the old labels.

- [ ] **Step 1:** Static rail: `Gear & Sync` → **`Loot Log`**; `Goals & Farms` → **`Tracking`**. Player Hub rail: `Collections & Goals` → **`Tracking`**. Change only the `label` (and tooltip `description` if it names the old label); keep `id` (`gear`/`goals`/`collections`) and routes/params unchanged to avoid breaking deep links + persistence.
- [ ] **Step 2:** Grep for user-facing occurrences of the old names in page headings/breadcrumbs/empty states and update copy for consistency: `grep -rn "Gear & Sync\|Goals & Farms\|Collections & Goals" src --include=*.tsx`. Leave settings-panel "Goals & Farms" tab per §? (the settings tab is separate — confirm whether the user wants that renamed too; default: rename the **nav** items only, leave the settings tab unless it reads inconsistent — note for review).
- [ ] **Step 3: Verify + commit**

`pnpm build && pnpm test`.
```bash
git add frontend/src/components/layout/SidebarNav.tsx frontend/src/pages/Profile.tsx
git commit -m "polish(nav): rename Gear & Sync→Loot Log and Goals & Farms / Collections & Goals→Tracking"
```

> Note for reviewer: confirm "Tracking" is wanted for **both** the static "Goals & Farms" and the Player Hub "Collections & Goals" (they'll read identically across contexts) — that matched the request.

---

# Section 3 — Hide week selector on All Weeks

**Diagnosis:** `components/history/SectionedLogView.tsx` has `layoutMode: 'grid' | 'split' | 'allWeeks'` (~542). The week selector (`WeekStepper`/`WeekSelector`) renders in the toolbar (~1025) and on mobile (~261) regardless of mode.

## Task 3.1: Gate the week selector on `layoutMode !== 'allWeeks'`

**Files:** Modify `frontend/src/components/history/SectionedLogView.tsx`

- [ ] **Step 1:** Wrap the desktop toolbar week-selector render and the mobile `WeekStepper` render in `{layoutMode !== 'allWeeks' && ( ... )}`. (All-Weeks shows every week, so a single-week selector is meaningless there.)
- [ ] **Step 2: Manual:** switch to All Weeks → week selector hidden; back to grid/split → it returns. No layout gap left behind (collapse the container, not just the control).
- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/history/SectionedLogView.tsx
git commit -m "polish(history): hide the week selector in the All Weeks view"
```

---

# Section 4 — Suggest Content deep-link + highlight

**Diagnosis:** Settings panel Goals & Farms uses `gsub` sub-tab param with a `'suggestions'` value (`SettingsPanel.tsx` ~269) rendering `ContentSuggestionsPanel`, whose "+ Suggest" button is ~line 321. The highlight pattern (scroll-into-view + pulse + auto-clear) lives in `hooks/useViewNavigation.ts`. `SettingsPanel` already supports `highlightCreateInvite` as a precedent.

## Task 4.1: Route Overview's Suggest action to the panel + highlight the button

**Files:** Modify `components/profile/OverviewTab.tsx` (or the static Overview component with the Suggested-farms section), `components/settings/SettingsPanel.tsx`, `components/static-group/ContentSuggestionsPanel.tsx`, and the settings-open dispatcher (GroupView).

- [ ] **Step 1: Add the Overview trigger**

In the Overview "Suggested farms" area, add a "Suggest content" button/link that opens settings to Goals & Farms → Suggestions. Reuse the existing settings-open event (`HEADER_EVENTS.SETTINGS` / `useSettingsPanel` if Plan B landed) with `{ tab: 'goals', gsub: 'suggestions', highlightSuggest: true }`.

- [ ] **Step 2: Thread `highlightSuggest` into the Suggestions panel**

Add a `highlightSuggest?: boolean` prop chain: `SettingsPanel` → `GoalsFarmsTabContent` → `ContentSuggestionsPanel` (mirror `highlightCreateInvite`). Set the Goals sub-tab to `'suggestions'` when requested.

- [ ] **Step 3: Pulse the "+ Suggest" button**

When `highlightSuggest`, apply a temporary accent ring/pulse to the "+ Suggest" button (~321) that auto-clears after ~2.5s (mirror the player-card highlight timing/visual; a `data-highlighted` + a CSS pulse class, or framer `animate`). Scroll it into view if offscreen.

- [ ] **Step 4: Verify + commit**

Manual: Overview → "Suggest content" → settings opens on Goals & Farms → Suggestions with the "+ Suggest" button pulsing.
```bash
git add frontend/src/components/profile/OverviewTab.tsx frontend/src/components/settings/SettingsPanel.tsx frontend/src/components/static-group/ContentSuggestionsPanel.tsx frontend/src/pages/GroupView.tsx
git commit -m "feat(overview): Suggest content deep-links to Suggestions and highlights the Suggest button"
```

---

# Section 5 — Consolidate statics selectors + schedule sub-items

**Diagnosis:** The Player Hub Overview renders `StaticShortcut` ("My Statics (N)" selector, `Profile.tsx` ~269–331, shown ~592) which duplicates the header `ContextSwitcher` Static selector. `StaticShortcut`'s dropdown already nests a per-static "Schedule" sub-item (`?tab=schedule`) — a pattern we can lift into the header.

## Task 5.1: Add schedule sub-items to the header Static dropdown

**Files:** Modify `components/layout/ContextSwitcher.tsx`

- [ ] **Step 1:** In the Static segment dropdown (~148–189), for each listed static add a nested "Schedule" `DropdownItem` linking to `/group/${shareCode}?tab=schedule` (mirror `StaticShortcut`'s pattern at `Profile.tsx` ~323, indented `pl-8 text-xs`, `Calendar` icon). Keep "Find a static" (now its own segment per Plan A — remove if redundant) and "Go to Dashboard" (or "My Statics" per §6).
- [ ] **Step 2: Commit**
```bash
git add frontend/src/components/layout/ContextSwitcher.tsx
git commit -m "feat(nav): header Static dropdown gains per-static Schedule shortcuts"
```

## Task 5.2: Remove the redundant Player Hub Overview statics selector

**Files:** Modify `pages/Profile.tsx`

- [ ] **Step 1:** Remove the `StaticShortcut` render from the Player Hub Overview header (~592 desktop, ~599 mobile) now that the header `ContextSwitcher` (retained active static per §1 + schedule sub-items per §5.1) covers it. Keep `StaticShortcut` component only if still used elsewhere; otherwise delete.
- [ ] **Step 2: Verify** the header selector is the single source for static switching; Player Hub Overview no longer shows the duplicate "My Statics (N)" button.
- [ ] **Step 3: Commit**
```bash
git add frontend/src/pages/Profile.tsx
git commit -m "polish(player-hub): remove redundant Overview statics selector (header covers it)"
```

---

# Section 6 — Move My Statics (Dashboard) into the Player Hub

**Diagnosis:** `pages/Dashboard.tsx` ("My Statics", route `/dashboard`) is reachable via the user menu + ContextSwitcher "Go to Dashboard". The Player Hub rail (`ProfileSidebarNav` / Plan A `AppRail`) is the natural home as a new tab. Keep the user-menu "My Statics" item for now.

## Task 6.1: Add a "My Statics" tab to the Player Hub

**Files:** Modify `pages/Profile.tsx` (nav items + tab body), reuse `pages/Dashboard.tsx` content.

- [ ] **Step 1: Extract Dashboard content into a reusable component**

If `Dashboard.tsx` is a page wrapper, extract its body (the statics grid/list + create wizard + context menu) into `components/dashboard/MyStaticsPanel.tsx` so it can render both at `/dashboard` (keep the route working) and inside the Player Hub tab. Keep behavior identical.

- [ ] **Step 2: Add the Player Hub tab**

Add a `statics` entry to `PROFILE_NAV_ITEMS` (label "My Statics", icon `Shield`/`Users`) and render `<MyStaticsPanel/>` when active. Use the Player Hub's existing tab mechanism (`useUrlTabState`/the profile tab param). Keep `/dashboard` route as an alias (renders the same panel) so existing links/user-menu still work.

- [ ] **Step 3: Verify + commit**

Manual: Player Hub → My Statics tab shows the statics grid; create/duplicate/delete work; `/dashboard` still works; user-menu "My Statics" still navigates (to the tab or the route).
```bash
git add frontend/src/pages/Profile.tsx frontend/src/components/dashboard/MyStaticsPanel.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat(player-hub): My Statics becomes a Player Hub tab (Dashboard reused)"
```

---

# Section 7 — Calmer context / tier-selector transitions

**Diagnosis:** No transitions on context switch or when the Tier Selector appears after selecting a static — content "pops". The breadcrumb (Logo › Static › Tier) mounts/unmounts abruptly.

## Task 7.1: Animate the tier-selector reveal + soften context switches

**Files:** Modify `components/layout/Header.tsx`, `components/layout/ContextSwitcher.tsx`, and the page transition (`components/layout/PageTransition.tsx` if it gates the "pop").

- [ ] **Step 1: Tier selector slide/fade-in**

Wrap the Tier Selector breadcrumb (`isGroupRoute && currentGroup && tiers.length > 0`) in a framer-motion `AnimatePresence` + `motion.div` that fades/slides in (e.g. `initial={{opacity:0, x:-6}} animate={{opacity:1,x:0}} exit={{opacity:0}}`, ~150ms, respecting `prefers-reduced-motion` via `lib/motion.ts`). So selecting a static reveals the tier selector calmly instead of snapping.

- [ ] **Step 2: Soften the context-page swap**

Check `PageTransition.tsx`/route transitions: the "pop" is content rendering before data loads. Add a consistent fade and ensure each context page shows a stable skeleton (reuse `Skeleton`) for its main region while loading, so switching Player Hub ⇄ Static ⇄ Finder cross-fades instead of flashing partial content. Keep it subtle and `prefers-reduced-motion`-safe.

- [ ] **Step 3: Manual + commit**

Switching contexts feels like a calm cross-fade; the tier selector eases in when a static is active.
```bash
git add frontend/src/components/layout/Header.tsx frontend/src/components/layout/ContextSwitcher.tsx frontend/src/components/layout/PageTransition.tsx
git commit -m "polish(nav): calmer context + tier-selector transitions"
```

---

# Section 8 — Panel header-to-toggle + cleaner slideouts

**Diagnosis:** The rail collapse is only via the small chevron button; the settings panel (SlideOutPanel / Plan B RightDockPanel) opens/closes only via the gear. The user wants clicking the **panel header** to toggle it, and smoother slideout animation.

## Task 8.1: Make the panel/rail header a toggle + refine animation

**Files:** Modify `components/layout/SidebarNav.tsx`/`AppRail.tsx` (rail identity header) and `components/ui/SlideOutPanel.tsx` (or Plan B's `RightDockPanel`).

- [ ] **Step 1: Header click toggles**

Rail: make the whole identity header row clickable to toggle collapse (not just the chevron) — keep the chevron as the affordance, add `onClick={toggle}` to the header container, preserve keyboard focus on the button. Settings panel: clicking its title bar toggles it closed (in addition to the gear) — wire the panel header `onClick` to `onClose`/toggle. Don't hijack clicks on interactive children in the header.

- [ ] **Step 2: Smoother slideout**

Standardize the slide/fade easing/duration via `lib/motion.ts` presets (e.g. `ease: [0.4,0,0.2,1]`, ~200ms) for the panel and rail width animations so they feel consistent and calm. Respect `prefers-reduced-motion`.

- [ ] **Step 3: Manual + commit**

Clicking the rail/panel header toggles it; animations are smooth/consistent.
```bash
git add frontend/src/components/layout/SidebarNav.tsx frontend/src/components/ui/SlideOutPanel.tsx
git commit -m "polish(panels): header-click toggle + smoother slideout animations"
```

---

# Section 9 — Join our Discord on Home

**Diagnosis:** `config.ts` exports `DISCORD_INVITE_URL`. `Home.tsx` hero CTA ~151–176.

## Task 9.1: Add a Join-Discord button

**Files:** Modify `pages/Home.tsx`

- [ ] **Step 1:** Add a secondary "Join our Discord" `Button`/anchor in the hero, after the primary CTA (~176), `href={DISCORD_INVITE_URL}` `target="_blank" rel="noopener noreferrer"`, with a Discord icon. Style as a secondary/ghost action so it doesn't compete with login.
- [ ] **Step 2: Commit**
```bash
git add frontend/src/pages/Home.tsx
git commit -m "feat(home): add a Join our Discord button to the hero"
```

---

# Final — Release notes + verification

**Files:** Modify `frontend/src/data/releaseNotes.ts`

- [ ] **Step 1:** Public entries covering: active-static retention, nav renames, All-Weeks week-selector hide, Suggest deep-link, statics-selector consolidation + schedule shortcuts, My Statics in Player Hub, calmer transitions, panel header toggle, Join Discord. `description` + `pr` + `prTitle` + full ISO date; bump `CURRENT_VERSION`.
- [ ] **Step 2:** Full gate — `cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test`; `cd scripts && npm test`.
- [ ] **Step 3:** Commit
```bash
git add frontend/src/data/releaseNotes.ts
git commit -m "docs(release): navigation & context polish"
```

---

## Self-review notes (already applied)

- **Active-static retention** is a one-line Header change (drop the `isGroupRoute ?` clear); Tier Selector stays group-route-gated.
- **Renames** change labels only (ids/routes/params untouched) so deep links + tab persistence don't break; coordinate with Plan A nav definitions.
- **Suggest highlight** reuses the established `useViewNavigation` pulse/scroll pattern + the `highlightCreateInvite` precedent — no new infra.
- **Statics-selector consolidation** depends on §1 (retained static) so the header selector can fully replace the Player Hub Overview one.
- **My Statics move** extracts a `MyStaticsPanel` reused by both `/dashboard` and the Player Hub tab — no behavior change, route preserved.
- **Transitions/animations** route through `lib/motion.ts` + `prefers-reduced-motion`.
- **Cross-plan:** §2/§6/§8 touch Plan A (AppRail) and Plan B (panel); §4/§5 touch Plan C settings — noted at top.
- **Line numbers are point-in-time** — verify before editing.
```
