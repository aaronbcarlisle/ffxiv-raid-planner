# Design: Global app rail + docked settings panel

**Date:** 2026-06-26
**Status:** Approved (brainstorm complete) — implementation pending
**Branch context:** follows `feature/ui-polish-pass`

## Summary

Move the app from a header-driven control layout to a **left/right side-panel chrome**:

1. **Global left rail** — consolidate the two duplicated sidebars (`SidebarNav` and
   Player Hub's `ProfileSidebarNav`) into one shared `AppRail` shell. The active
   header context segment (Player Hub / Static Finder / Static) defines the rail's
   nav items. The **user menu moves to the rail's bottom**, opening upward.
2. **Docked settings panel** — the static Settings panel stops overlaying the header
   and instead docks to the right edge, pushing the header's right cluster left so the
   gear icon stays visible and acts as a true open/close toggle, with an animated
   gear → panel-close glyph.

3. **Generalized settings + tab persistence** (Plan C) — turn the static-only Settings
   panel into a role-aware **Settings** panel (Members get read-only Priority/Members; the
   static config tab is renamed General → **Static**), add a new **General** tab holding
   *user* settings, and add a synced `tab_persistence` user preference that controls whether
   navigational tabs are **remembered** (per static) or **reset to default** site-wide.

4. **Listing builder sub-tabs** (Plan D) — redesign the cramped 6-section Static Finder
   listing editor (`DiscoveryTab`) from one long scroll into sticky sub-tabs with completion
   dots, a persistent preview drawer, and an optional pop-out to a wide modal.

Plans A → B → C are sequenced (B/C share the header gear + SettingsPanel). Plan D is
independent and can land any time.

This design is **compatible with but separate from** `LAYOUT_FULL_CHROME_INSET_PLAN.md`
(flush-left rail + inset content cap). That work is not folded in here.

## Current state (verified against code)

- **One shared `<Layout>`** (`components/layout/Layout.tsx`) wraps every route: a single
  global `<Header>` plus one scrollable `<main>` rendering `<PageTransition>`. Routing
  in `App.tsx` nests all pages under the `/` Layout route.
- **`SidebarNav.tsx`** — left rail rendered **only inside `GroupView`**, `hidden sm:flex`
  (desktop only), collapses 208px ⇄ 56px (localStorage `sidebar-collapsed`). Items:
  Overview, Schedule, Roster, Goals & Farms, Gear & Sync, More. Has an identity header
  (static name) and a **Plugin footer button**.
- **`ProfileSidebarNav`** (inside `pages/Profile.tsx`) — a **near-identical duplicate**
  of `SidebarNav`: same widths, identity header, collapse logic (localStorage
  `profile-sidebar-collapsed`), gradient, and Plugin footer. Items: Overview, Sync & Gear,
  Jobs & Gear, Collections & Goals, Availability, Share.
- **`Header.tsx`** — global. Left: logo, `ContextSwitcher` (Player Hub ⇄ Static segments),
  tier breadcrumb. Right cluster: Invite, **Settings gear** (dispatches
  `header:settings`), Globe "Find a static" link, Discord, GitHub, ThemeToggle,
  **`UserMenu`** avatar (far right).
- **`ContextSwitcher.tsx`** — segmented control: `[Player Hub] | [Static ▾]`. Falls back to
  a "Find a static" link only when the user has no statics. The Static dropdown also
  contains a redundant "Find a static" item.
- **`SettingsPanel.tsx`** — right-side slide-out via `SlideOutPanel` (a pure fixed overlay
  with backdrop). Tabs: General, Priority, Goals & Farms, Recruitment, Members. Opened by
  the header gear and `Alt+G`.
- **`UserMenu.tsx`** — Radix dropdown opening **downward** (`align="end"`), avatar trigger.
  Contains My Statics, Player Hub, Admin, Documentation, API Keys, Notifications,
  Shortcuts, theme + anonymous toggles, Logout.

## Design decisions (settled)

- **Rail gate:** the rail is present when the user is **signed in** OR is **viewing a
  static** (signed-out share-link viewer). Otherwise (signed-out home/docs/discover) →
  header-only, no rail. This preserves today's public-static nav and frees the signed-out
  homepage for a hero/login layout.
- **User-menu home:** wherever the rail is present on **desktop** (`sm+`), the user menu
  lives in the **rail footer** and the **header shows no avatar**. On **mobile**, or on
  pages with **no rail**, the user menu stays in the **header** (unchanged). The Header
  computes the same gate it already has access to (`user || isGroupRoute`), so no
  cross-component plumbing is needed.
- **Consolidation:** full — extract one `AppRail`; refactor both static and Player Hub to
  use it; delete the duplicate.
- **Plan split:** two sequenced plans (rail/header first, settings dock second).
- **Mobile is unchanged** — bottom nav stays; all rail work is `sm:` and up.

---

## Plan A — Global rail, user-menu relocation, header segments, Plugin move

### A1. Shared `AppRail` shell

New component `components/layout/AppRail.tsx` that owns the chrome currently duplicated in
`SidebarNav` and `ProfileSidebarNav`:

- **Identity header** — configurable `{ icon, label }` (static name, or "Player Hub").
- **Nav item list** — caller supplies items
  `{ id, label, description, shortcut?, icon, onSelect, isActive }`. Renders the existing
  active-state styling (the `motion` active bg + left bar, `LayoutGroup`), tooltips, and
  collapsed/expanded layout. The `LayoutGroup` id must be unique per context (e.g.
  `sidebar-${context}-nav`) so the static and Hub active bars don't share a layout id.
- **Collapse** — preserve current behavior. Keep the two existing localStorage keys, or
  unify to one `app-rail-collapsed` (decide in plan; unifying is preferred since one rail
  shell now exists). Mobile hidden (`hidden sm:flex`).
- **Footer** — pinned `UserMenu` cluster (see A2). Replaces the Plugin footer entirely; the
  Plugin entry becomes a nav item (see A4).

`SidebarNav.tsx` and `ProfileSidebarNav` become thin callers (or are replaced inline) that
pass their item lists to `AppRail`. The duplicate copy is deleted.

### A2. User menu in the rail footer

- Render `UserMenu` in `AppRail`'s footer. When expanded: avatar + display name + chevron;
  when collapsed: avatar only.
- The dropdown must open **upward and to the right** so it does not clip below the viewport:
  `side="top"` (and appropriate align) on the Radix content. Verify against the bottom edge
  in both collapsed and expanded rail states.
- `Header.tsx`: hide the desktop avatar when the rail is present — i.e. render the header
  `UserMenu` only when `!railPresent` **or** below `sm`. `railPresent = !!user || isGroupRoute`
  (Header already derives `user` and `isGroupRoute`). The mobile header avatar path is
  unchanged.

### A3. Header context segments — add Static Finder

- `ContextSwitcher.tsx`: make it a **three-segment** control
  `[Player Hub] | [Static Finder] | [Static ▾]`. Static Finder navigates to `/discover`
  and is active on `/discover`.
- Remove the right-cluster Globe "Find a static" link from `Header.tsx`.
- Remove the redundant "Find a static" item inside the Static dropdown (now its own segment).
- Static segment fallback when the user has no statics: show it muted/disabled (or omit the
  ▾), since Static Finder now owns the "go find one" affordance. Decide exact empty-state in
  the plan.
- **Static Finder rail contents:** Discover may supply its own rail items (filters/categories)
  or a minimal identity + user-menu rail. Exact items deferred to implementation; not an
  architectural blocker.

### A4. Plugin nav item

- Remove the Plugin **footer** button from the rail (its slot is now the user menu).
- Add **Plugin** as a regular nav item in the **static** rail, positioned **directly above
  "More"**, matching the other items' icon/text styling (`PlugZap` icon). It triggers the
  same action as today (`onTabChange('more')` / opens the plugin/integrations view — confirm
  the exact target in the plan).
- Player Hub already exposes plugin via its "Sync & Gear" item, so its footer simply becomes
  the user menu (no new Plugin item needed there unless desired).

### A Checkpoint
Rail renders per the gate on every relevant page via the shared shell; user menu sits at the
rail bottom on desktop and opens upward without clipping; header right cluster no longer shows
the avatar on desktop rail pages; `Player Hub | Static Finder | Static ▾` segments work; Plugin
is a nav item above More; mobile unchanged. Duplicate sidebar code deleted.

---

## Plan B — Docked settings panel + animated toggle

### B1. Right-dock panel behavior

Replace the pure-overlay behavior for the Settings panel so that, when open:

- The panel docks to the **right edge** beneath the header band; **`<main>` content is
  overlaid** (optional backdrop covering only the content area, click-to-close).
- The **header sits above the panel** in z-order and receives **right padding equal to the
  panel width** while open, so the header's right cluster (incl. the gear) slides left of the
  panel edge and **stays visible/clickable**.
- This likely needs a right-dock panel variant (or a new lightweight `RightDockPanel`) rather
  than the existing fixed-overlay `SlideOutPanel`; `SlideOutPanel` stays as-is for other
  callers. Decide reuse-vs-new in the plan.

### B2. Gear becomes a persistent toggle with animated icon

- The header gear no longer just opens the panel — it **toggles** it. `Alt+G` toggles too.
- Animate the icon: **`Settings` (gear, closed) ⇄ `PanelRightClose` (open)** via a ~150ms
  crossfade (alternative: gear → `X`; chosen default is the panel glyph for clearer
  affordance).
- Reflect open state with `aria-expanded` / `aria-pressed` and tooltip copy ("Open/Close
  static settings").

### B Checkpoint
Opening settings pushes the header right cluster left without hiding the gear; the gear icon
animates to the panel-close glyph; clicking the gear (or `Alt+G`) closes it; content is
overlaid; no header occlusion at any panel width.

---

---

## Plan C — Generalized settings + role-aware tabs + site-wide tab persistence

Full task breakdown in `docs/superpowers/plans/2026-06-26-settings-generalization-and-tab-persistence.md`. Key decisions (settled):

- **Storage:** new `tab_persistence` column on `User` (`'remember'` default | `'reset'`),
  exposed via the existing `PATCH /api/auth/me/preferences` endpoint (mirrors
  `activity_display_mode`). Syncs across devices. `UserResponse` is built in two places in
  `routers/auth.py` — both updated.
- **Role → tab matrix:** General (user) = all; Static/Priority/Recruitment = managers only,
  except **Priority is read-only for members**; Goals & Farms = all (edit gated); Members =
  all but read-only below manager. Gear opens for any **signed-in** static member.
- **Tab persistence:** a `lib/tabMemory.ts` (`recallTab`/`rememberTab`/`tabKey`) gates the
  navigational tab keys (`group-view-tab`, `gear-subtab`, `loot-priority-subtab`) on the
  preference, keyed per-static by the `:shareCode` route param. View-mode/sort/expanded/week
  state is intentionally **excluded** (preferences, not tabs). URL-based `useUrlTabState`
  selections already reset on fresh visits, so they need no change.

## Verification (each plan)

From `frontend/`:
```
pnpm tsc --noEmit   # plus pnpm build (tsc -b) before PR
pnpm lint
pnpm check:design-system
pnpm test
pnpm build
```
Plus manual passes: desktop wide + mid + narrow, mobile (no rail / bottom nav), signed-out
home (no rail), signed-out static viewer (rail with group nav, Sign-in in footer), rail
collapse/expand, user-menu upward open at the viewport bottom edge, settings toggle
open/close with header visible.

Per repo rules: any `frontend/src` change requires a `releaseNotes.ts` entry (bump
`CURRENT_VERSION` for user-facing). Keep each plan as its own PR/commit set.

## Guardrails

- Don't change mobile / bottom-nav behavior.
- Use design-system primitives/tokens; run `pnpm check:design-system`.
- Keep rail collapse/width behavior identical to today (only the footer changes).
- Don't fold in the `LAYOUT_FULL_CHROME_INSET_PLAN` width-cap work.
