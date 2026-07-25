# DESIGN_SYSTEM.md

**XIV Raid Planner — Design System Contract**
**Tier-1 canonical · the atom + structure source of truth**

> **Status:** v3 draft · 2026-06-27 · supersedes the rendered `docs/design-system` reference page
> **Relationship to other docs:** `PRODUCT_MODEL.md` owns *what the app is*. `REDESIGN_SPEC.md` owns *the IA and per-screen scaffolding*. **This** owns *the atoms* (tokens, components) **and the structural rules** (layout, width, vocabulary, governance) that every screen is built from. Where this and `REDESIGN_SPEC.md` overlap on structure, they are kept in sync; this doc is the lower-level authority on tokens/components, the spec on screen composition.
> **Source of truth for values:** `tokens.json` (W3C format). This document *describes* tokens; `tokens.json` *defines* them and generates the CSS/Tailwind. If a hex appears here and disagrees with `tokens.json`, the JSON wins.

---

## 0. What changed in v3 (and why)

The previous design system was a **rendered reference page** — excellent at cataloguing atoms, but it baked the *old structure* into its examples (Gear-as-tab, "Loot Log → Who Needs It," "no-sidebar data pages," the floating-element argument). The redesign moved the app to a **left context rail + 4-tab spine**, which invalidates the structural half.

v3 **keeps every atom** (colors, type, spacing, and the widget logic — GearStatusCircle, the toggle, PopoverSelect, etc.) and **rewrites every structural rule** (layout, width, vocabulary, tab taxonomy, nav). It also restructures the system itself from a styleguide into a **tiered token + component-contract model**, so it's something a developer or Claude Code builds *against* without improvising.

| Layer | v2 (old) | v3 (now) |
|---|---|---|
| Atoms (color/type/widgets) | solid | **kept verbatim** |
| Token structure | flat CSS vars | **3-tier: primitive → semantic → component** (W3C `tokens.json`) |
| Layout | no-sidebar, floating-element anti-pattern | **rail + top bar + spine** |
| Width | data 160rem / no rail | **re-derived for the rail layout** |
| Vocabulary | Gear/Loot Log/Log | **Static/Track/Loot/Log-as-verb** (kill Gear-tab, Loot Log) |
| Tabs | 3 patterns, old examples | **3 patterns, re-anchored examples** |
| Delivery | styleguide page | **`tokens.json` + this contract + a styleguide that renders FROM tokens** |

---

## 1. Token architecture (the tiered model)

Tokens live in `tokens.json` in three tiers. **The rule: each tier may only reference the tier above it.** A component never reaches past its tier to a raw hex.

```
  PRIMITIVE        raw values, named by what they ARE
  teal.500 #14b8a6 · ink.2 #0e0e14 · space.4 16px
        │ referenced only by ▼
  SEMANTIC         intent, named by what they MEAN   ◀── light theme overrides ONLY this tier
  accent.default · surface.card · text.primary
        │ referenced only by ▼
  COMPONENT        per-component, named by WHERE used
  button.primary.bg · card.radius · tag.selected-bg-opacity
        │ consumed by ▼
  THE APP (CSS / Tailwind / Figma — all generated from tokens.json)
```

**Why this matters concretely:**
- *Rebrand* (teal → another hue) = change `primitive.color.teal.*` once; everything downstream follows.
- *Re-theme* (dark → light, or a future high-contrast mode) = override the **semantic** tier (plus a few select **component** tokens that have no semantic home, e.g. `nav.rail-bg`, `toggle.orb`). `tokens.light.json` does exactly this.
- *Retune one component* = change its `component.*` tokens without touching anything global.
- *Tailwind/CSS never drift* because they're generated from the token files by `frontend/scripts/build-tokens.mjs`, and a CI guard (`pnpm tokens:check`) fails the build if the committed `tokens.generated.css` diverges from the source.

**Governance:** raw hex/px in component code is a lint error (see §6). Components consume `--component-*` or `--semantic-*` vars, never primitives directly, never literals.

### 1.1 The atoms (unchanged from v2 — see `tokens.json` for values)

Surfaces (6-step ink ladder), accent (teal), text (5-step), borders, **role colors** (tank/healer/melee/ranged/caster), **gear-source** (raid/tome/base-tome/augmented/crafted), **membership** (owner/lead/member/viewer/linked), **status**, **materials** (twine/glaze/solvent/tomestone), **floor** colors. Type: Exo 2 display / Inter body / JetBrains mono, weights 400–800, size ramp 30→12px with a **12px readable floor (`text-xs`); 9px is the hard floor for badge counts only**. Spacing: 4px grid. Radii: 6/8/12/16/pill. All verbatim from `frontend/src/index.css`.

---

## 2. The structural layer (rewritten for the redesign)

This is the half that was stale. It is now defined by the redesign.

### 2.1 Layout architecture — rail + top bar + spine

The old "data pages have no sidebar" rule is **retired**. The app now has a persistent **context rail**, and the structural model is three fixed regions (mirrors `REDESIGN_SPEC.md §3.1`):

```
┌──────┬──────────────────────────────────────────────┐
│      │  TOP BAR   static · track · week · ⌘K · ⚙    │  ← static context
│ RAIL ├──────────────────────────────────────────────┤
│ 72px │  SPINE    Home · Roster · Loot · Schedule     │  ← the jobs (in-static only)
│      ├──────────────────────────────────────────────┤
│ you  │                                              │
│ ↕    │   CONTENT  (centered within a width ceiling) │
│      │                                              │
└──────┴──────────────────────────────────────────────┘
```

- **Rail** = Person layer (you, Player Hub, Static Finder, your statics). Always present. `72px`.
- **Top bar** = static/track/week context + global actions. Present inside a static.
- **Spine** = the 4 job tabs. Present inside a static. The Person layer has **no spine** (Player Hub/Finder are railed, tabless).
- **No fourth nav surface.** "More" is deleted. Settings is one place (top-bar gear).

**Visual containment principle (kept, re-stated):** regions must read as defined zones, not elements floating on one identical background. Rail and top bar sit on `surface-raised`; content on `surface-base`; cards on `surface-card`. Depth = hierarchy.

**Corner ownership (locked):** the rail owns the top-left corner — it runs full height; the top bar sits to the rail's right, not spanning above it. This is the Discord/Slack model. The layout diagram above reflects this.

### 2.2 Width ceilings (re-derived for the rail)

The rail lives *outside* these; they cap the **content column**. (The old 2560px "data, no-sidebar" tier is replaced.)

| Token | Width | Use |
|---|---|---|
| `size.container.data` | 2160px | data-dense spine pages (Roster, Loot) on ultrawide |
| `size.container.standard` | 1760px | Home, Schedule (dashboards) |
| `size.container.focus` | 1100px | Player Hub, settings, forms |
| `size.container.doc` | 960px | docs / reading |

Content centers within `min(94vw, <ceiling>)` so ultrawide reads as designed.

### 2.3 Vocabulary (canonical — enforced in all UI copy)

Drawn from and kept in sync with `REDESIGN_SPEC.md §10`. The full glossary (with "never call it" column) lives there; this is the quick-reference enforcement list.

**Canonical terms:**
- **Static** (never "group") — a raid group
- **Track** — the abstraction a static progresses through (one Progress Engine, many tracks); adding non-savage content = "add a track"
- **Tier** — the flagship savage track (e.g. "AAC Heavyweight"), containing its **fights** (e.g. M9S–M12S)
- **Fight** — one named encounter inside a Tier (replaces "floor" in user-facing copy)
- **Prog / Progress** — a *status*, never a page or noun-tab (say "Floor 3 prog," not "Progress page")
- **Roster** · **BiS** · **Loot** (the distribution domain) · **Drop** · **Priority**
- **Log (v.)** — an action, never a tab; the record is "History"
- **Book / Page** · **Week** · **Lead / Member / Viewer** (roles, not apps)

**Retired terms (never use in UI copy):**
- "Gear" as a tab or section name
- "Loot Log" (say "Loot → History")
- "Who Needs It," "Overview," "More"
- "Goals" as a page/concept — reframe as "the tracks this static is progressing"
- "Content" (vague) — say "track" or name the specific tier/fight

### 2.4 Tab taxonomy (3 patterns kept; examples re-anchored)

The v2 three-pattern model was sound; only its examples referenced the old IA. Re-anchored:

| Pattern | What it does | New canonical example |
|---|---|---|
| **Content-variant tabs** | same data, different visualization; live in the section header | Roster **Cards ⇄ Board** |
| **Layout-mode toggle** | fundamentally different layout; top-level | (rare; e.g. a future calendar month/week view) |
| **View/filter subtabs** | sort/group/filter within one layout; smaller, inside content | Loot **Priority · History** |

Hard rule retained: **Tabs switch in-surface views; they never route.** Routing is the rail/spine, which are `NavRow`/`LinkText`, not tabs.

`Tabs` is an **in-surface view switch only** — it has no `href`/route API by construction, so a tab can never masquerade as navigation (route changes use `LinkText`/`NavRow`). It is a discriminated-union exemplar alongside `Tag`.

---

## 3. Component contracts

Each component is specified as a **contract**: anatomy · variants (the finite legal set) · states · slots · usage rules. This replaces "here's a screenshot." Values come from `tokens.json`; this is the behavior + rules.

### 3.1 Button

- **Anatomy:** `[ optional leading icon · label · optional trailing element ]`, height `control.sm|base|lg`, radius `button.radius`.
- **Variants (the blessed set — all in real use, reconciled from the shipped component):**
  - **Intent:** `primary` (one accent-filled per region) · `secondary` (interactive surface) · `ghost` (text + hover overlay)
  - **Status:** `danger` (destructive) · `warning` · `success`
  - `accent-subtle` (low-emphasis accent) · `link` (inline text link affordance)
  *(All eight have live consumers; the contract is reconciled to the component, not the reverse. Exhaustiveness is compiler-enforced by the `Record<ButtonVariant, string>` style map — adding a variant without a style is a build error.)*
- **States:** default · hover · focus (focus-ring) · disabled (text-disabled, no hover) · loading (spinner replaces leading icon, label stays).
- **Trailing element — DEFINED MEANINGS (this was previously undefined and misused):**
  - **none** — default. Most buttons have no trailing element.
  - **chevron `›`** — opens a menu/popover *in place* (disclosure).
  - **external `↗`** — leaves the app (new tab/site).
  - **No trailing arrow `→` as decoration.** A plain action ("Apply", "Save", "Assign") gets **no** trailing glyph. *(This corrects the mockups: the "Apply →" / "Enter →" / "Assign →" arrows are removed unless the action literally navigates the user to a different screen, in which case the chevron/disclosure rules above apply. "Submit and stay" = no arrow.)*
  - **Source of truth for glyph meanings:** see §4 icon lexicon. The trailing-element rules here are a subset of that table; §4 is the authority if there is ever a conflict.
- **Usage rules:** never two `primary` in one region; destructive actions use `danger` + confirm; icon-only buttons require an `aria-label` and a tooltip.

### 3.1a IconButton

- **Anatomy:** square tap target (44×44 min on touch), single icon, no visible label.
- **Variants (blessed set):** `default` · `primary` · `ghost` · `danger`. Sizes `sm|md|lg`.
- **Required by type:** `aria-label: string` and `icon: ReactNode` are mandatory props — an unlabeled icon button cannot be constructed. This is the canonical home for icon-only actions; a `Button` must carry a visible text label (see §3.1). Type-enforced: `children` is required (an empty `<Button/>` won't compile), but `children: ReactNode` admits an icon child, so icon-only actions must use `IconButton` — that rule is enforced by `IconButton`'s required `aria-label` and review, not by the `Button` type alone.
- **Exhaustiveness:** compiler-enforced via `Record<IconButtonVariant, string>`.

### 3.2 Card

- **Anatomy:** container on `card.bg`, `card.radius` (12px), `border.default`; optional uppercase `section-label` header with leading icon; body; optional footer divided by `border.subtle`.
- **Variants:** `default` · `accent` (highlight border — the "primary/next" card) · `empty` (dashed border, centered call-to-action).
- **Rule:** a card is a *defined region*, not a floating box — it must sit on a surface one step darker than itself.

### 3.3 Tag (constrained primitive — variant carries semantics)

The v2 rule, kept verbatim because it's excellent: a `Tag` **must declare its kind**, and the kind dictates behavior:

| Variant | Behavior | Affordance |
|---|---|---|
| `label` | inert, display-only | none |
| `filter` | toggles a filter | `aria-pressed`; solid bg when on (`tag.selected-bg-opacity:1`), 20% tint when off |
| `nav` | navigates | chevron + real `href`/`onNavigate` (required by type) |

Illegal-by-construction: a label tag can't have an onClick; a nav tag can't exist without a destination.

`Tag` and `Tabs` are the canonical discriminated-union exemplars in this design system; their compile-time guarantees are locked by `frontend/src/components/ui/Tag.type-test.tsx` (`@ts-expect-error` assertions that fail the build if any guarantee regresses).

### 3.4 GearStatusCircle (kept — the gear atom)

Target-style indicator. **Raid slots: 2-state** (missing ⇄ complete). **Tome slots: 3-state** (missing → have → augmented). Sizes sm/md/lg. Special states: disabled, no-BiS-set. This is the canonical gear cell — the Roster **Board** uses it; the Cards gear strip is a compact derivative of the same states. *(Validation note: the mockups' ad-hoc gear pips should be replaced with this component.)*

### 3.5 Toggle (Recessed-Orb), Number Input (Capsule), Week Stepper

Kept as-is from v2 — premium, already standardized. Toggle: dark sphere inset, teal track on / dark off. Number input: teal +/- on capsule sides, recessed value center. Week Stepper: dot-stepper, current week as expanded pill, status dots for weeks with data. **The Week Stepper is the canonical control for the "week" clock** in the top bar and Schedule.

### 3.6 PopoverSelect & the unified recipient picker

PopoverSelect (badge-style, the documented `bg-{color}` selected / `bg-{color}/20` suggested / grayed-out-when-not-eligible standard) is the atom. **The Loot recipient picker is a PopoverSelect specialization** — same selected/suggested/grayed grammar, plus the reason string + scope tabs (By priority / All members / Off-spec). *(Validation note: formalize the recipient picker as one component so the two old forked modals collapse into it.)*

### 3.7 Inputs, Select, Searchable Select, Checkbox

Kept from v2: text input (default/error/disabled, sizes, with-icon, input-group), Select, SearchableSelect (filterable, categorized with colored sticky headers), checkbox. All consume `component.input.*` tokens. **Surface note:** inputs map to `surface-interactive` (`#1e1e26`); `surface-elevated` (`#121218`) is for popovers/elevated cards (value unchanged; documented role moved).

### 3.8 New components the redesign introduces

**Built in F6a (contracted §3.9–3.15):** context rail → `AppRail` (§3.9); top bar → `TopBar` composition of `StaticPicker` + tier breadcrumb + `NotificationBell` + `SettingsGear`; 4-tab spine → `Spine` (§3.13); ⌘K palette → `CommandPalette` (§3.10); skip link → `SkipLink` (§3.11); notification bell → `NotificationBell` (§3.12); settings gear → `SettingsGear` (§3.14); static picker → `StaticPicker` (§3.15).

**Built in F6b (contracted §3.16–3.23):** `CardShell` (§3.16); `ProgressBar` (§3.17) + `ProgressBarLegend` (§3.18); `PlayerIdentity` (§3.19, `inline` variant — `board-cell`/`rsvp-row` built later, F6c/F6e); `EmptyStateInvite` (§3.20); `TwoRegionDashboard` (§3.21); `AttentionRow` (§3.22); `SessionRsvpCard` (§3.23, `next` variant — `later` built F6e). Ring-0 `home/` compositions (`Home`, `WeeklyLootSummaryCard`, `RosterReadinessCard`, `RoleBisCard`, `StaticActivityFeed`, `TrackCard`) are screen-specific, not design-system atoms — not contracted here.

**Built in F6e (contracted §3.24–3.27):** `WeekNavigatorStrip` (§3.24); `AvailabilityHeatmap` (§3.25); `BestTimesCard` (§3.26); `PersonLayerEntryPoint` (§3.27). `PlayerIdentity`'s `rsvp-row` variant and `SessionRsvpCard`'s `later` variant also ship in F6e (folded into their existing §3.19/§3.23 entries above).

**Built in F6c (contracted §3.28–3.30):** `SegmentedToggle` (§3.28, shared `ui/` — value-generic, reused by Loot's Priority⇄History and `RecipientPicker`'s scope switch); `GearBoard` + `GearBoardCell` (§3.29, the Roster Board gear-editing matrix); `RosterCard` (§3.30, Roster Cards view).

**Built in F6d (contracted §3.31–3.36):** `RecipientPicker` (§3.31, unified assign/log/edit surface — kills the `QuickLogDropModal`+`AddLootEntryModal` forks); `FloorCard` (§3.32); `PriorityRow` (§3.33, shared `ui/`); `FairnessSummary` (§3.34); `WeekScopeControl` (§3.35, the shared week-clock's mutation host); `LootHistoryTable` + `WeekGroupHeader` (§3.36).

*(These nine — §3.28–3.36 — were backfilled after the fact; F6c/F6d shipped ahead of their contracts. No behavior changed to write them; see §7 items 2/3 for the two ledger items this resolves.)*

**Still proposals (not yet contracted):** **match-score listing** (Finder). Each gets a contract entry as it's built.

### 3.9 Context rail (Person-layer nav) — LOCKED

The nav rail is now fully specified. This is the build target; F3 formalizes the tokenized component against this contract.

- **Width:** `72px`, icon-only. No label text visible in the rail itself (labels appear only in tooltips — see a11y below).
- **Surface:** `surface.nav` semantic token (`--color-surface-raised`, one tonal step darker than the app background `surface.base`). `1px border` on the right edge (`border.default`). **No drop shadow** — shadows are reserved for overlays and menus only.
- **Corner ownership:** the rail runs full height and owns the top-left corner. The top bar sits to the rail's right, not above it. (Mirrored in §2.1.)
- **Item states:**
  - **Inactive:** outlined (stroke-only) icon + `text.muted` color token.
  - **Active:** filled icon + `accent.default` color token + a left-edge **pill indicator** (a 3–4px tall accent pill flush to the left edge of the rail, centered on the item).
  - **Hover / pressed:** surface-overlay token over the item background; icon color shifts toward `text.primary`.
  - **Focus:** visible focus ring using `focus-ring` token, visually distinct from the hover state (a ring, not a fill).
- **Accessibility (required — not optional):**
  - Wrap in `<nav aria-label="Primary navigation">` (or a locale-appropriate label).
  - Every item carries a **visually-hidden text label** (`sr-only`) for screen readers.
  - Every item also shows a **WAI-ARIA tooltip** on hover AND on keyboard focus; tooltip dismisses on `Esc`.
  - Minimum touch target: **44×44px** (the icon is 24px centered in a 44px tap zone).
  - Provide a **skip link** (`#main-content`) that allows keyboard users to skip past the rail to the content area.
- **Token gaps (F3):** `surface.nav` and the pill-indicator size/color need component-tier tokens (`nav.item-active-indicator`, `nav.item-bg-hover`, etc.). These are scoped to F3's component-tokenization work.
- **Motion gap (v3.1):** enter/exit animation for the pill indicator and hover state are not yet specified — flagged under §7 (motion tokens).
- **Built F6a (Task 7):** Delivered as `AppRail` (`frontend/src/components/layout/AppRail.tsx`) against this spec. Tokens scoped in Task 1 (`nav.*` / `surface.nav` / `motion.nav-pill`); hover/pressed state + SPA static-switch landed in the Task 7 review fixes. Motion (pill enter/exit) deferred to v3.1 per the gap above.
- **Responsive (flip-p1 Task 6):** hidden below the `sm` breakpoint (`hidden sm:flex`, mirroring the legacy rail) — `MobileBottomNav` serves small viewports until the Ring-1 mobile pass gives the rail its own collapsed/narrow treatment.

### 3.10 CommandPalette — F6a

- **Anatomy:** `Modal` (size `2xl`, `hideDefaultHeader`) containing:
  - search row `[ magnifier glyph (aria-hidden) · borderless inline input · platform-aware <kbd> badge ]`
  - `role="listbox"` command list of `role="option"` rows (full-row, keyboard-navigable)
  - keyboard-shortcuts reference panel (inline footer, pulled from `SHORTCUT_GROUPS`)
- **Variants:** navigate-only (current); action commands (log a drop, assign loot, etc.) are **deferred** — not built, not wired.
- **States:** open (modal visible, focus trapped) | closed (no DOM presence).
- **Platform label:** `⌘K` on Mac/iOS, `Ctrl K` on Windows/other — computed at render time from `navigator.platform` so tests can stub it; never a bare glyph that breaks without a font.
- **Trigger:** top-bar `⌘K` `IconButton` affordance (labelled "Command palette", always visible in the v2 TopBar) **and** the platform-aware global keyboard shortcut (`⌘K` on Mac, `Ctrl K` on Windows/other) — both open the palette.
- **Magnifier glyph:** purely decorative (`aria-hidden`). Per §4.1 glyph lexicon, the magnifier means "search" — it is the visual cue only, not an interactive element.
- **Usage rules:**
  - Built on `Modal` (not a raw `<div>` overlay) — inherits focus trap, `Esc`-close, and z-index management.
  - Mounted from `NewShell` (v2 shell only). Not present on the legacy route.
  - Navigate commands only: spine tab switch, settings open, static switch. Action commands are future scope (F6b+).
  - The inline `<input>` uses a `design-system-ignore` comment (the palette surface IS the input field; a standard `Input` wrapper would add unwanted chrome in this zero-chrome overlay).

### 3.11 SkipLink — F6a

- **Anatomy:** single `<a href="#targetId">Skip to content</a>`.
- **States:** visually hidden by default (`sr-only`); on keyboard focus becomes absolutely positioned at `top-2 left-2` with `surface-raised` background, focus ring, `z-50`.
- **Usage rules:**
  - Always the **first focusable element** in the DOM — rendered as the first child inside `AppRail`.
  - The target (`id="main-content"` by default) must exist on the main content wrapper before the link is useful. `targetId` prop is configurable; don't add overrides without a real landmark to target.
  - Never decorative; always the first keyboard stop. Required for a11y compliance per §3.9 rail spec.

### 3.12 NotificationBell — F6a

- **Anatomy:** `Tooltip` wrapping `IconButton (ghost, md, Bell icon)`; absolute badge overlay when `total > 0`.
- **Badge:** `-top-1 -right-1`, min `18×18px`, `bg-status-error` red, `text-white`, count capped at `'99+'`. Badge text is `aria-hidden`; the count is surfaced in the `IconButton`'s `aria-label` (`"Notifications, N unread"`).
- **Unread total:** `notificationStore.unreadCount` + `useSyntheticUnreadCount()` (release notes) + `joinRequestStore.pendingCount` (manager-gated).
- **Variants:** no badge (`total === 0`) | with badge (`total > 0`).
- **Usage rules:**
  - Prop-driven: receives `onOpen: () => void`; parent (`NewShell`) hosts `<NotificationCenter />`. Keeps shell→person boundary clean.
  - Join-request fetch replicates `Header.tsx:107-113` because the legacy `Header` is suppressed for `?shell=v2`. When the legacy Header resumes (F6b+), this side-effect should be removed from this component.
  - Structure-only for F6a — `NotificationCenter` itself is the legacy component, unchanged.

### 3.13 Spine (4-tab in-surface tab bar) — F6a

- **Anatomy:** `div[role="tablist" aria-label="Main content sections"]` containing 4 fixed `button[role="tab"]` entries (Home · Roster · Loot · Schedule). Active tab has an accent bottom-border underline (`::after`); icon fades to 45% opacity when inactive.
- **Tabs (fixed, non-dynamic):** `overview` → Home, `roster` → Roster, `gear` → Loot, `schedule` → Schedule. These map to `PageMode` ids.
- **States:** active (accent underline + full-opacity icon) | inactive (secondary text, 45% icon opacity, hover shifts to primary text) | focused (browser focus ring on the button).
- **Keyboard navigation:** `ArrowLeft`/`ArrowRight` cycle; `Home`/`End` jump to first/last. Focus follows the newly activated tab (roving `tabIndex`).
- **Analytics:** every tab switch fires `analytics.track('navigation', 'tab_switch', { tab, surface: 'spine' })`.
- **Usage rules:**
  - In-surface view switch only — calls `setPageMode`, never `navigate()`. Same discriminated-union rule as the generic `Tabs` primitive (§2.4): tabs switch content, the rail/spine switches context.
  - Present inside a static only (below the top bar in the v2 shell). Not present on Person-layer screens.
  - Do not add dynamic or role-conditional tabs — the 4-tab set is locked per the redesign spec.

### 3.14 SettingsGear — F6a

- **Anatomy:** `Tooltip` wrapping a single `IconButton (ghost, md)`. Icon toggles between `Settings` (closed) and `PanelRightClose` (open).
- **States:** open (`aria-expanded={true}`, `aria-pressed={true}`, `PanelRightClose` icon) | closed (`aria-expanded={false}`, `aria-pressed={false}`, `Settings` icon).
- **Usage rules:**
  - Single responsibility: toggle `settingsPanelStore`. No inline action logic.
  - Top-bar-only. Do not place in rail items or other chrome.
  - Badge/notification counts belong to `NotificationBell`, not here.

### 3.15 StaticPicker — F6a

- **Anatomy:** `[ Shield icon · static name (truncated, responsive max-width) · optional role badge · optional ChevronDown IconButton → Dropdown list ]`.
- **Role badge:** semantic membership tokens only (`bg-membership-{role}/20 text-membership-{role}`) — zero hardcoded colors.
- **Variants:** with switcher (`isMember` true, has statics) | without switcher (no statics: renders "No static" fallback).
- **States:** closed | open (dropdown visible, list lazy-fetched).
- **Usage rules:**
  - Top-bar-only (v2 shell). The legacy `ContextSwitcher` is its peer — `StaticPicker` covers the static segment only; the rail handles Player Hub and Static Finder routing.
  - `useNavigate` with `?shell=v2` preserved on switch — no full-page reload.
  - Lazy-fetch: `onFetchGroups()` called only when the dropdown opens (parity with `ContextSwitcher`).
  - Static switch fires `navigate()` only when already on a `/group/` route (`onStatic` guard).

### 3.16 CardShell — F6b

- **Anatomy:** `surface-card` + `border-subtle` rounded container (`rounded-lg`, `p-4`); optional header row — leading `icon?` (aria-hidden, `text-text-tertiary`) + uppercase `text-xs` `<h3>` `title` + right-aligned `headerRight?` slot (`ml-auto`); `children` body.
- **Props:** `{ title?: string; icon?: ReactNode; headerRight?: ReactNode; children: ReactNode; className?: string; as?: 'section'|'div' }`. Defaults `as='section'`; use `'div'` when the card is nested inside another landmark (e.g. inside a `<section>`).
- **States:** none (empty-content use case: render `EmptyStateInvite` as `children` — not the card's own responsibility).
- **a11y:** when `title` is set it renders as a real `<h3>` heading element; the icon slot is `aria-hidden`.
- **Usage rules:** supersedes the legacy `DashboardCard.tsx` (inline-hex debt). A card must sit on a surface one step darker than itself (`surface-base` under `surface-card`). Token-only: `bg-surface-card`, `border-border-subtle`, `text-text-tertiary`. No raw hex.

### 3.17 ProgressBar — F6b

- **Anatomy:** full-width track (`bg-surface-interactive`, `h-2`, `rounded-full`) + fill div sized by inline `width: {pct}%` with `background: var(--color-*)`.
- **Props:** `{ value: number; color?: ProgressBarColor; ariaLabel?: string; className?: string }`. `value` is `[0, 1]` (clamped). `color` union: `'accent' | 'role-tank' | 'role-healer' | 'role-melee' | 'role-ranged' | 'role-caster' | 'gear-raid' | 'gear-tome' | 'gear-augmented' | 'success' | 'warning' | 'membership-linked'`. Each key resolves to the matching CSS var token via the `COLOR_TOKEN` record — no hex literals.
- **States:** decorative (no `ariaLabel`) | accessible (`role="progressbar"` with `aria-label`, `aria-valuenow` 0–100 rounded integer, `aria-valuemin=0`, `aria-valuemax=100` when `ariaLabel` is set).
- **Usage rules:** never pass a raw color. Supply `ariaLabel` on user-facing bars; omit only for purely decorative fills. Fill transition: `duration-300 ease-out`.

### 3.18 ProgressBarLegend — F6b

- **Anatomy:** `flex flex-wrap` row of swatch + label pairs. Swatch is a 10×10px `rounded-sm` square with `border-border-default`; `transparent` swatch (border only) represents "needed."
- **Props:** `{ items?: LegendItem[] }`. `LegendItem = { label: string; token: string }` — `token` is a CSS var string (e.g. `'var(--color-gear-raid)'`) or `'transparent'`. Defaults to the 4 standard gear-source swatches: raid / tome (aug) / augmented / needed.
- **States:** none (static display only).
- **a11y:** wrapper has `aria-label="Gear source legend"`; individual swatches are `aria-hidden`.
- **Usage rules:** render once per screen, not once per bar. Pass custom `items` only when the legend context is non-gear-source. The default 4-swatch set is the canonical gear-source legend; do not inline a custom legend for the standard case.

### 3.19 PlayerIdentity — F6b

- **Anatomy (inline variant):** 32px role-ringed avatar (`border-2`, `border-color: var(--color-role-*)` via inline style) wrapping `SafeAvatar` (with initials fallback) + `JobIcon` badge overlaid at bottom-right (`-bottom-0.5 -right-0.5`) + text zone: `text-sm font-medium` name + optional `text-xs text-text-tertiary` subtitle (auto-generated as `"job · position"` when not supplied).
- **Props:** `{ name: string; job?: string; role?: Role; position?: string; subtitle?: ReactNode; avatarUrl?: string; variant?: 'inline'|'board-cell'|'rsvp-row' }`. `Role = 'tank'|'healer'|'melee'|'ranged'|'caster'`.
- **Variants:** `'inline'` — avatar + name + meta row. **BUILT F6b.** `'board-cell'` — compact cell for Roster Board (job icon + name + subtitle, no avatar ring). **BUILT F6c.** `'rsvp-row'` — RSVP roster row inside `SessionRsvpCard`: 24px avatar + `text-xs` name, one line. **BUILT F6e.** Identity only — RSVP status is schedule-domain and stays parent-owned (`SessionRsvpCard` renders its own status glyph beside this row; see §3.23).
- **States:** none (controlled by parent).
- **a11y:** role is never conveyed by color alone. The avatar ring is decorative reinforcement; the job/position subtitle carries the textual role label. When `role` is set but no job/position/subtitle is present, a `sr-only` role label (`"Tank"`, etc.) is injected to satisfy the requirement.
- **Usage rules:** presentational — no store imports. Avatar ring uses `var(--color-role-*)` via inline `borderColor` style (not a Tailwind class), because Tailwind cannot generate arbitrary ring colors at shared-layer error rules.

### 3.20 EmptyStateInvite — F6b

- **Anatomy:** centered flex column (`flex-col items-center gap-2 py-6 px-4 text-center`) — optional `aria-hidden` icon + `text-sm font-medium` title + optional `text-xs text-text-tertiary` description + optional action `Button (size sm)`.
- **Props:** `{ icon?: ReactNode; title: string; description?: string; action?: { label: string; onClick: () => void; variant?: ButtonVariant } }`.
- **States:** none (always renders a static invitation).
- **Usage rules:** default action variant `'accent-subtle'`. Action button carries no trailing glyph (§4.1 lexicon — empty-state actions are neither disclosures nor external links). Consolidates: legacy `EmptyState`, `EmptySlotCard`, in-card `PlayerSetupBanner` fallback, and the `ScheduleTab` bespoke empty block.

### 3.21 TwoRegionDashboard — F6b

- **Anatomy:** CSS grid — `main` (left actionable column, `1.85fr`) and `side` (right ambient column, `1fr`); `18px` gap via `gap-[18px]`; `items-start` so columns don't stretch. Collapses to a single column at ≤1180px via `min-[1181px]:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]`.
- **Props:** `{ main: ReactNode; side: ReactNode; className?: string }`. Pure layout — no store, no color, no business logic.
- **States:** two-column (≥1181px viewport width) | single-column (≤1180px — `side` stacks below `main`).
- **Usage rules:** placed in `ui/` (shared) because both Home (ring-0) and Schedule (ring-1) consume it — only the shared layer is importable by both. `main` = primary/actionable content; `side` = ambient/glanceable. Do not use for non-dashboard layouts; this component encodes the Home/Schedule-specific proportions.

### 3.22 AttentionRow — F6b

- **Anatomy:** `flex items-center gap-3 py-2` — leading status icon (`shrink-0 text-status-warning`, `aria-hidden`) + grow region (`flex-1 min-w-0`: `text-sm font-medium text-text-primary` title + optional `text-xs text-text-tertiary` `<p>` meta) + trailing `Button (size sm, shrink-0)`.
- **Props:** `{ icon: ReactNode; title: ReactNode; meta?: string; action: { label: string; onClick: () => void; variant?: ButtonVariant } }`. All four top-level props are required except `meta`.
- **States:** none (fully controlled by parent).
- **Usage rules:** default action variant `'accent-subtle'`. Action Button carries no trailing glyph (§4.1 lexicon). Icon slot is `aria-hidden`; status meaning is conveyed by the `title`/`meta` text. In Home, `AttentionRow` instances are composed inside a `CardShell` (not used as a standalone card). Ordering in Home: BiS-blocking first → unclaimed slots → join requests.

### 3.23 SessionRsvpCard — F6b / F6e

- **Anatomy (next variant):** `CardShell` ("Next session" + countdown `Tag` variant `label` tone `accent` in `headerRight`) wrapping: day/time line (`font-display text-lg font-semibold`) + timezone line (`text-xs text-text-tertiary` — session tz + optional viewer tz when they differ); RSVP avatar stack (one `SafeAvatar` per `rsvp`, ring colored by RSVP **status** via `STATUS_TOKEN`); `"N in · M tentative"` count line; 3-button RSVP strip (I'm in / Tentative / Can't make it).
- **Anatomy (later variant, F6e):** same `CardShell` skeleton, but titled with the session's own title (not "Next session"), **no accent ring** (`ring-1 ring-accent/40` omitted), and inactive RSVP buttons render `ghost` instead of `secondary`. Adds, when `members`/`memberDetail="grid"` are supplied: an optional day-pill (`showDayPill`) before the day/time block, a `PlayerIdentity` `'rsvp-row'`-keyed member grid (2–3 cols, one row per member with a text status glyph — ✓/?/✗/· — never color-only) replacing the avatar stack, a `"N no answer"` count segment, and a contextual warning note (`"{tentative names} tentative · {unavailable names} can't make it — sub may be needed"`) when any member is tentative/unavailable.
- **Props:** `{ session: ScheduleSession; currentUserRsvp?: RsvpStatus; onRsvp?: (status: RsvpStatus) => void; variant?: 'next'|'later'; viewerTimezone?: string; members?: { userId: string; username: string | null }[]; memberDetail?: 'stack'|'grid'; headerActions?: ReactNode; showDayPill?: boolean }`.
- **Variants:** `'next'` — prominent next-session card (accent header, avatar stack). **BUILT F6b.** `'later'` — neutral border, ghost RSVP buttons, session-title header (Schedule list view). **BUILT F6e.**
- **New props (F6e):** `members` — full roster; when provided (with `memberDetail="grid"`) it enables the member grid, the "no answer" count, and the warning note. Omitted (Home) → unchanged avatar-stack render. `memberDetail` — `'stack'` (default, Home) vs `'grid'` (Schedule). `headerActions` — kebab/action slot rendered beside the countdown `Tag` in the header row (Schedule mounts its "Session actions" dropdown here). `showDayPill` — day-of-month + weekday pill before the day/time block (default `false`, Schedule-only).
- **`trackAvailability === false` note:** when the session opts out of availability tracking, the whole RSVP-pressure UI (grid/stack, counts, warning note, button strip) is replaced by a single `"Availability not required"` line — legacy parity, not a new state to design around.
- **Members-gated warning note:** the tentative/unavailable roll-up line only ever renders when `members` is supplied (Schedule) — Home's card (no `members`) is unchanged and never shows it.
- **Avatar-ring color decision (deliberate):** `ScheduleRsvp` carries no member `role` field. Rings are colored by RSVP **status** via status tokens (`available → var(--color-status-success)`, `tentative → var(--color-status-warning)`, `unavailable → var(--color-status-error)`). If a role field is later added to `ScheduleRsvp`, switch to `var(--color-role-*)`. Role-coloring is explicitly deferred, not forgotten.
- **a11y:** RSVP buttons are real `Button`s; the active RSVP has `aria-pressed={true}`. Avatar ring status is conveyed by the `title` attribute (`"Name — status"`) — not by color alone. Grid-mode status glyphs are text (✓/?/✗/·) with an `sr-only` label — never color-only. The RSVP strip is omitted entirely (not just disabled) for a Schedule viewer who has `members` but no `onRsvp` callback, so no dead controls are left in the tab order.
- **Usage rules:** presentational — no store imports. Parent (Home) wires `onRsvp` to `scheduleStore`'s RSVP mutation; parent (Schedule) wires `onRsvp` + `members` + `headerActions`. No session → parent renders `EmptyStateInvite` instead of this card.

### 3.24 WeekNavigatorStrip — F6e

- **Anatomy:** a stepper row — `IconButton` (`ChevronLeft`, `aria-label="Previous week"`) + a centered two-line block (line 1: `"Week N"` in `text-accent` when current + a `" · this week"` suffix, else `text-text-primary`; line 2: UTC-pinned date range, `+ tierLabel` when supplied) + `IconButton` (`ChevronRight`, `aria-label="Next week"`) + a flexible spacer + an optional recurring-summary `Tag` (`variant="label" tone="muted"`) + an optional `canManage`-gated "Add session" `Button` (`variant="primary" size="sm"`).
- **Props:** `{ clock: WeekClock; scopedWeek: number; onScopedWeekChange: (week: number) => void; tierLabel?: string; recurringSummary?: string | null; canManage: boolean; onAddSession: () => void }`.
- **States:** anchored week (`"Week N"` + UTC date range) | current week (accent text + `" · this week"` suffix) | **null-anchor degradation:** `clock.weekStartDate === null` → line 1 reads `"This week"`, line 2 is a local (not UTC) rolling 7-day range from `new Date()`, and both steppers are disabled — the strip never throws or blanks for a fresh static with no anchor. | boundary-disabled (Prev disabled at `scopedWeek <= 1`; Next disabled at `scopedWeek >= clock.currentWeek + 12`).
- **One clock, two presentations:** this component reads the shared `WeekClock` but never mutates it — `startNextWeek`/`revertWeek` stay homed exclusively in Loot's `WeekScopeControl` (one clock, one mutation host). `scopedWeek`/`onScopedWeekChange` is Schedule's own local override state (`Schedule.tsx`'s `scopedWeekOverride`), independent of the clock's own `currentWeek`.
- **a11y:** both steppers are real `IconButton`s with descriptive `aria-label`s, using the native `disabled` attribute at the boundaries (not a visual-only style).
- **Usage rules:** presentational only — no store imports; `clock` and the scoped-week override both arrive as props from `Schedule.tsx`. Do not add a third mutation path for the clock here — stepping only ever changes the *local* scope, never the shared `currentWeek`.

### 3.25 AvailabilityHeatmap — F6e

- **Anatomy:** `CardShell` (`as="div"`, title "Team availability", `headerRight` = `"{N} raiders"`) wrapping a note line (empty-state copy pointing at "Your availability" when all cells are zero, else `"Aggregated from each member's availability · darker = more free."` + a conditional `" Click a slot to propose a session."` when `canManage`) + a CSS grid (44px hour-label column × 7 day columns, day headers above) of 8 prime-hour rows + a bottom legend (`"Fewer free"` → 5 density swatches → `"All {total}"` → a separate ring swatch labeled `"scheduled"`).
- **Props:** `{ data: AvailabilityDateSummary[]; members: Membership[]; weekDates: string[]; sessions: Array<{ session: ScheduleSession; occursAt: string }>; canManage: boolean; onProposeSession?: (draft: ScheduleSessionCreate) => void }`.
- **Density:** zero-count cells render untinted `bg-surface-card` + `border-border-subtle` (no inline background); counts ≥ 1 use accent color-mix steps — **8/16/28/45/70%** — selected by the count/total ratio (`<25%→8, <50%→16, <75%→28, <100%→45, 100%→70`), via `color-mix(in srgb, var(--color-accent) N%, var(--color-surface-card))`. Same formula as the F1/F6d gear-board density steps — no new tokens introduced.
- **Aggregation:** conservative hourly rollup — a member counts toward an hour cell only when free for BOTH constituent 30-minute store slots (name-intersection, `deriveHourlyHeatCells`). The cross-midnight prime window (18:00→02:00) maps hours before the window start to the next calendar date's column.
- **States:** read-only w.r.t. availability data, always (cells never mutate availability) | propose-only when `canManage && onProposeSession` — the cell becomes an accessible `span[role="button"]` | plain display otherwise (`div`, free-members list in a `title` tooltip) | scheduled-cell ring overlay (`inset 0 0 0 2px var(--color-accent-hover)`) on hours a rendered occurrence overlaps | all-zero empty state.
- **a11y:** interactive cells are `span[role="button"] tabIndex={0}` with `aria-label="{day} {time} — {count} of {total} free"` and Enter/Space keydown handling — the GearBoardCell accessible-span pattern, never a raw `<button>`. Non-interactive cells carry no ARIA role and rely on a `title` tooltip only (decorative for sighted users — the interactive variant's `aria-label` is the a11y channel that matters for `canManage` viewers).
- **Usage rules:** Ring-0 read-only aggregate — this component accepts no fetch/store dependency; `data`/`members`/`weekDates`/`sessions` all arrive as props from `Schedule.tsx`. Editing availability itself is out of scope here and deferred to the Person layer (§3.27) — a documented flip blocker (spec §6.3), not an oversight.

### 3.26 BestTimesCard — F6e

- **Anatomy:** `CardShell` (`as="div"`, title "Best times this week", `headerRight` = a session-length `Select`) wrapping either an empty-state paragraph (`"Not enough availability data yet."`) or a vertical list of recommendation rows — each: a weekday+time label (`text-xs font-medium w-24 shrink-0`) + `ProgressBar` (`availableCount / totalMembers`) + a `"N/M"` count with an optional `" · scheduled"` suffix.
- **Props:** `{ recommendations: AvailabilityRecommendation[]; durationMinutes: number; onDurationChange: (m: number) => void; scheduledSlotIds?: Set<string>; canManage: boolean; onProposeSession?: (rec: AvailabilityRecommendation) => void }`.
- **Display:** viewer-local — `formatWhenLabel` uses `toLocaleDateString`/`toLocaleTimeString` with no explicit timezone, so every row reads in the viewer's own clock. No reference-timezone model (that pattern is retired slice-wide per spec §2.g).
- **States:** empty (no recommendations) | canManage row (`Button variant="ghost"` wrapping the whole row, `aria-label="Propose session {when}"`) | view-only row (plain `div`, non-interactive) | scheduled row (the slot-key prefix of `rec.id` matches an entry in `scheduledSlotIds` → appends `" · scheduled"` as text, not color-only).
- **Dropped from the mockup:** confidence labels and the Discord-proposal copy action are **not** built here (spec §6.2 row 13; ratified deletion) — this card is availability-ranking + propose only.
- **a11y:** the duration `Select` carries `aria-label="Session length"`; propose rows are real `Button`s (not `div onClick`), so they're keyboard-operable and screen-reader-actionable without extra wiring.
- **Usage rules:** presentational — `durationMinutes`/`onDurationChange` are controlled by the parent (`Schedule.tsx`'s own `useState`); this card never derives its own duration state.

### 3.27 PersonLayerEntryPoint — F6e

- **Anatomy:** `CardShell` (`as="div"`, no title — the row supplies its own heading) wrapping a single row: an `aria-hidden` accent icon tile (`CalendarClock` default, 36×36px, `color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-base))` background) + a text stack (`text-sm font-medium` title + `text-xs text-text-tertiary` description) + a trailing `Button` (`variant="ghost" size="sm"`) action.
- **Props:** `{ title: string; description: string; actionLabel: string; onAction: () => void; icon?: ReactNode }`. Generic link-card contract — no Schedule-specific types leak into the signature, so any screen can mount a Person-layer handoff card with this component.
- **States:** none — fully controlled by the parent; always renders the same static row.
- **No trailing glyph (§4.1):** the action `Button` (Schedule's instance reads `"Edit"`) carries no trailing arrow/chevron even though `onAction` navigates the viewer to `/profile?tab=availability` — per §4.1 lexicon, a plain action gets no trailing glyph; only genuine disclosure/external-link actions take the defined glyphs.
- **Usage rules:** honest copy only (spec §2.c; ratify item 5) — the description must accurately describe where the data lives and how it gets here (e.g. Schedule's instance: `"Your typical week lives on your profile — leads pull it into this static's grid."`), never implying this card itself edits anything. Presentational — no store imports; `onAction` is the parent's `navigate()` call.

### 3.28 SegmentedToggle — F6c

- **Anatomy:** `div[role="group"]` (bordered pill container, `bg-surface-card`, `border-border-default`, `rounded-lg`, `p-0.5`, `gap-0.5`) wrapping one `Button` per option (`variant={active ? 'primary' : 'ghost'}`, `aria-pressed={active}`, optional `leftIcon`) — no raw `<button>`.
- **Props:** `{ options: SegmentedOption<T>[]; value: T; onChange: (value: T) => void; ariaLabel: string; size?: 'sm'|'md' }`. `SegmentedOption<T> = { value: T; label: string; icon?: ReactNode }`. `T extends string` — value-generic over the caller's own union. Default `size='sm'`.
- **States:** active segment (`primary` fill) | inactive segment (`ghost`, click calls `onChange` — a click on the already-active segment is a no-op).
- **a11y:** `ariaLabel` is required and must be meaning-bearing (not icon-only) per the component's own docstring; each segment is a real `Button` carrying `aria-pressed`.
- **Usage rules:** presentational (no store imports); one component drives Roster's Cards⇄Board (§2.4), Loot's Priority⇄History (§3.36), and `RecipientPicker`'s scope switch (§3.31) — do not fork a second segmented-toggle implementation for a new axis. Container uses `bg-surface-card` specifically (not `-elevated`/`-raised`) because the inactive (`ghost`) segment's `text-accent` needs ≥4.5:1 against whatever surface shows through its transparent background — `surface-card` is the only one of the three that clears AA in both themes; do not swap the container surface without re-checking that contrast.

### 3.29 GearBoard + GearBoardCell — F6c

- **Anatomy (GearBoard):** a `max-h-[70vh]` scrollable, sticky-header `<table>` (11 slot columns — weapon/head/body/hands/legs/feet/earring/necklace/bracelet/ring1/ring2 — plus a leading Player column and a trailing BiS-summary column), rows grouped into party-divider sections (Light Party 1 / Light Party 2 / Unassigned / Substitutes via `groupPlayersByLightParty(players, separateSubs=true)`); only `configured` players are shown (filtered before grouping); each player row = `PlayerIdentity` (`board-cell` variant) + one `GearBoardCell` per slot + a colored `obtained/TOTAL` BiS summary cell (`text-status-success` at 100%, `text-status-warning` under 50%, else `text-text-primary`). A player with zero BiS-target slots renders a colspan "No BiS imported — priority can't be calculated" warning row and a muted `—` summary cell.
- **Props (GearBoard):** `{ players: SnapshotPlayer[]; tierId?: string; canManage: boolean; actionsForPlayer: (player: SnapshotPlayer) => { onUpdate: (updates: Partial<SnapshotPlayer>) => void | Promise<void> }; priorities?: Map<string, Set<GearSlot>> }`.
- **Anatomy (GearBoardCell):** a 30×30px `rounded-md` cell, one of: muted `—` (no BiS target, non-interactive) · dashed-border `·` (needed) · dashed-border role-colored `●` (needed **and** flagged next-upgrade — the `need.up` state, see below) · a filled one-letter source code (`R`/`T`/`BT`/`C` from `BIS_SOURCE_NAMES`, tinted by `bg-gear-{source}/25`) when obtained · `A` on `bg-gear-augmented/30` when augmented.
- **Props (GearBoardCell):** `{ slot: GearSlotStatus; onCycle?: (slot: GearSlot) => void; disabled?: boolean; priority?: boolean; role?: 'tank'|'healer'|'melee'|'ranged'|'caster' }`. Default `disabled=false`, `priority=false`.
- **The `need.up` priority-highlight contract (F6d):** when a needed slot's `priority` prop is `true`, the cell renders the next-upgrade glyph (`●`, dashed border) in the player's `role` color (`color-mix(in srgb, var(--color-role-{role}) 60%, transparent)` border / `var(--color-role-{role})` glyph) instead of the plain need dot (`·`). `GearBoard` does **not** compute this map — the parent screen does (`Roster.tsx`, gated on `rosterView === 'board'`) via `computeNextUpgradePriorities` (`utils/nextUpgradePriority.ts`), whose correctness contract is **agreement with** the Loot queue's `FloorCard` pipeline (it reproduces that math so Board and Loot agree; it is not a shared invocation — `Roster.tsx` is its sole consumer). The ●-next-upgrade legend is the Board screen's own (`Roster.tsx`). In `GearBoard`/`GearBoardCell` the flag is purely presentational, threaded through the `priorities: Map<playerId, Set<GearSlot>>` prop. Omitting `priorities` renders every needed slot plain, so `need.up` is strictly additive and never required.
- **States:** no-BiS-target (muted `—`) | needed (plain `·`) | needed + `need.up` priority (role-colored `●`) | obtained (source-letter fill) | augmented (`A` fill) | disabled (cell still renders its state but is non-interactive, `tabIndex=-1`).
- **a11y:** each interactive cell is `role="checkbox" aria-checked={obtained} aria-disabled={disabled}`, `tabIndex 0` when interactive else `-1`, with `onClick`/`onKeyDown` (Space/Enter) handlers — never a raw `<button>`. `aria-label` states the BiS source's full name and/or state as applicable (e.g. `"{source} — needed"`, `"{source} — next upgrade priority"`, bare `"{source}"` when obtained non-augmented, `"Augmented"`).
- **Usage rules:** `GearBoardCell`'s obtained/augmented state is derived from the **same** `toGearState`/`requiresAugmentation` state machine as `GearStatusCircle` (§3.4) — it is a second *rendering* of that state machine (the dense gearsheet cell), not a duplicate state machine; do not add a third. The Board is the gear-**editing** surface: a click cycles obtained state via `getNextGearState` → `computeGearSlotUpdate` → `actionsForPlayer(player).onUpdate` (disabled whenever `canManage` is false). Board **always** groups by light party (`separateSubs=true`) — it does not read Roster Cards' `groupView`/`subsHidden` toggles, which are Cards-only. Party-divider rows are rendered fresh here, not by refining legacy `player/LightPartyHeader` (that component is typed `groupNumber: 1|2` with no Subs variant — reuse would have required editing legacy code).

### 3.30 RosterCard — F6c

- **Anatomy:** a `CardShell` (`as="div"`) wrapped in a positioning `div` that carries the role-colored 3px accent left edge and (when `reorderMode`) the drag-handle attributes/listeners. Header row: `PlayerIdentity` (or an inline rename `Input` when editing) + (tank-only) `TankRoleSelector` + `PositionSelector` + a `canEdit`-gated "change job" `IconButton` (`Repeat` icon) opening a `JobPicker` popover, plus a right-aligned iLvl readout and a kebab `IconButton` (`MoreVertical`). Body: a `ProgressBar` BiS-progress line + a read-only strip of `GearStatusCircle` pips (one per gear slot, `disabled`, no-op `onChange`). Footer: a Lodestone sync-status dot + label, and a right-aligned status CTA (`renderStatus`: Unclaimed+Assign · No BiS+Import · "BiS set" · "needs N").
- **Props:** `{ player: SnapshotPlayer; userRole: MemberRole | null | undefined; currentUserId: string | null; isAdminAccess: boolean; canManage: boolean; clipboardPlayer: SnapshotPlayer | null; reorderMode: boolean; dragHandle?: { attributes?: DragAttributes; listeners?: DragListeners }; actions: RosterCardActions; groupId?: string; tierId?: string; contentType?: ContentType; allPlayers?: SnapshotPlayer[]; isAdmin?: boolean; userHasClaimedPlayer?: boolean; onModalOpen?: () => void; onModalClose?: () => void }`. `groupId`/`tierId`/`contentType` default `''`/`''`/`'savage'` so the card renders standalone.
- **States:** name display ⇄ inline-edit (double-click to enter, Enter/blur commits, Escape reverts) | job-picker popover open/closed | pending job-change confirm (`Modal` + `RadioGroup`: keep-BiS vs unlink-BiS) | kebab menu / right-click context menu (both sourced from `useRosterCardActions`) | any-overlay-open (disables grid drag-and-drop via `onModalOpen`/`onModalClose`).
- **Usage rules:** NEW v2 code — does **not** modify or extend the legacy `PlayerCard`. The gear pip strip is read-only/display-only by design: gear **editing** is `GearBoard`'s job (§3.29), not this card's — hence the `disabled` `GearStatusCircle` with a no-op `onChange` rather than mirroring `PlayerCard.handleGearChange`. **Disclosed debt:** this component imports the legacy `player/PositionSelector` and `player/TankRoleSelector` for its inline position/tank-role edit affordances — these predate the redesign and have no v2-native replacement yet; they are a known carry-over, not an oversight, and should be revisited (or explicitly re-contracted as kept atoms) when Roster's remaining legacy imports are audited.

### 3.31 RecipientPicker — F6d

- **Anatomy:** a `Modal` (size `lg`) — title = `Package` icon + mode-specific label (`"Assign · {label}"` / `"Edit · {label}"` / `"Log a drop"`); context line (fight · slot · "raid drop"); item selectors (fight `Select` + slot `Select`, shown only when `mode !== 'assign'`); a `SegmentedToggle` (§3.28) for recipient scope; a search `Input`; a `role="radiogroup"` recipient list — each row `role="radio"` (rank badge when `entry.rank !== null` — `all`/`offspec` rows may omit it, role-ringed initials avatar, name + role dot, a `reason` string, a `NeedTag` `Tag`, a selected-state dot) using the `GearBoardCell` interaction pattern (click + Space/Enter, no raw `<input>`/`<label>`); a "Details" `LinkText` disclosure gating a week `NumberInput`, a method `RadioGroup` (non-assign only), a "Mark {slot} as acquired" `Checkbox`, a weapon-only "Extra loot" `Checkbox` (assign mode only), a character `Select` (non-edit only), and a Notes `TextArea` (non-assign only); footer = Cancel + submit `Button`.
- **Props:** a discriminated union on `mode`. Base: `{ isOpen: boolean; onClose: () => void; groupId: string; tierId: string; players: SnapshotPlayer[]; settings: StaticSettings; floors: string[]; lootLog: LootLogEntry[]; currentWeek: number; maxWeek: number; onSuccess?: () => void }`, plus exactly one of: `{ mode: 'assign'; item: DropItemContext; editEntry?: never }` | `{ mode: 'log'; item?: DropItemContext; editEntry?: never }` | `{ mode: 'edit'; editEntry: LootLogEntry; item?: never }`. `DropItemContext = { slot: GearSlot | 'ring'; floorName: string; floorNumber: FloorNumber; label: string }`. The union is deliberate — `mode: 'assign'` requires `item` at every call site (an optional `item` under `'assign'` previously let call sites implicitly default a drop context to nothing/`weapon`).
- **States:** `mode` = `'assign'` | `'log'` | `'edit'` (structurally different field sets, see Anatomy); scope = `'priority'` | `'all'` | `'offspec'`; selection = pinned-on-open with a derived `entries[0]` fallback in assign/log mode, but **no** fallback in edit mode (a scope flip that drops the current recipient from the recomputed list must not silently retarget an existing commitment — submit stays disabled until the user re-picks a visible row); saving (submit disabled + `loading`).
- **a11y:** recipient list is `role="radiogroup"`/`role="radio"` rows, `aria-checked`, `tabIndex=0`, Space/Enter activation — matches `GearBoardCell`'s accessible-span pattern, never a raw `<input type="radio">`.
- **Usage rules:** consolidates the legacy `QuickLogDropModal` + `AddLootEntryModal` into **one** surface that submits through the same `logLootAndUpdateGear`/`updateLootAndSyncGear` coordination utilities with the same payload shape — payload parity with the two legacy modals is the correctness contract, not a stylistic preference. Ranking/visibility come from `buildRecipientEntries` (`utils/recipientRanking`; `PickerScope`/`NeedTag` types live there). Edit mode diffs **only** the fields that changed (`weekNumber`/`floor`/`itemSlot`/`recipientPlayerId`/`method`/`notes`, plus a `weaponJob` backfill) — `isExtra` and `recipientCharacter*` are never diffed, matching the legacy editor exactly.

### 3.32 FloorCard — F6d

- **Anatomy:** a `rounded-lg` card. Header: floor-name `Tag` (`label`/`muted`) + "Floor N" + cleared/in-progress + a drops-meta string + (when collapsed) a "Show" `LinkText` + a pending-count or logged-count `Tag`. Body (hidden while collapsed): gear rows then material rows, each rendered by `FloorDropRow` (`kind: 'gear'|'material'`, `label`, `subLabel`, `slot`/`material`, `entries: PriorityRowEntry[]` (§3.33), `canEdit`, `onAssign`, `disableAssign` for a material with zero needers). An optional `footer` slot stays visible even while the body is collapsed (weapon priorities are tier-level, not week-scoped, so a cleared week shouldn't hide them).
- **Props:** `{ floorNumber: FloorNumber; floorName: string; players: SnapshotPlayer[]; settings: StaticSettings; lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; pageLedger: PageLedgerEntry[]; scopedWeek: number; currentWeek?: number; canEdit: boolean; onAssignGear: (item: { slot: GearSlot | 'ring'; label: string }) => void; onAssignMaterial: (material: MaterialType, suggested: SnapshotPlayer) => void; footer?: React.ReactNode }`. `currentWeek` defaults to `scopedWeek` when omitted.
- **States:** expanded (default when there's anything pending, or user clicked "Show") | auto-collapsed (`pendingCount === 0 && loggedCount > 0`, keeps a fully-logged floor out of the way).
- **Usage rules:** priority queues are derived via the **same** derivation as the legacy `LootPriorityPanel` (`getPriorityForItem`/`Ring`/`UpgradeMaterial`/`UniversalTomestone` → `enhancePriorityEntries`, using the legacy enhanced-scoring gate expression: `settings.enableEnhancedScoring === true && !isPriorityDisabled(settings) && lootLog.length > 0`) — zero new priority math introduced. The enhanced-scoring drought/fair-share signal is always computed against the **real** current week (`currentWeek ?? scopedWeek`), never the scoped viewing week, so browsing history doesn't distort the fairness signal; only the logged/pending status chip itself reflects `scopedWeek`.

### 3.33 PriorityRow — shared `ui/`, F6d

- **Anatomy:** `ul[aria-label="Priority queue"]` of up to `maxVisible` chips (`li`, role-ringed 22px initials avatar + name + `#rank`), the first (top-ranked) chip accent-bordered/tinted, the rest neutral (`border-border-subtle`/`bg-surface-interactive`); a trailing `"+N eligible"` text chip when `entries.length > maxVisible`.
- **Props:** `{ entries: PriorityRowEntry[]; maxVisible?: number; emptyLabel?: string }`. `PriorityRowEntry = { playerId: string; name: string; role: string; rank: number }`. Defaults: `maxVisible=3`, `emptyLabel='no one needs this'`.
- **States:** empty (`entries.length === 0` → renders `emptyLabel` as plain muted text, no list) | populated, top chip highlighted | populated with overflow tail.
- **a11y:** the initials avatar is `aria-hidden` (decorative — the name is adjacent visible text); role color is a **border ring**, never a filled background, matching `PlayerIdentity`'s fallback-avatar treatment (a filled circle + white text fails AA for several role colors, e.g. healer/ranged/caster).
- **Usage rules:** shared `ui/`, purely presentational — no store imports. Currently consumed by `FloorCard`'s `FloorDropRow` (§3.32); Home is a documented future consumer, not yet wired.

### 3.34 FairnessSummary — F6d

- **Anatomy:** a responsive 4-card stat strip (`grid`, 1 col → `sm:grid-cols-2` → `lg:grid-cols-4`), each card an inline (non-exported) `StatCard` (label / big value / optional value-color class / detail line): **Drops this tier**, **Most / fewest**, **Distribution**, **This week**.
- **Props:** `{ players: SnapshotPlayer[]; settings: StaticSettings; lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; pageLedger: PageLedgerEntry[]; currentWeek: number; floors: string[] }`.
- **States:** distribution `even` (`text-status-success`, "within the ±2 band") vs `uneven` (`text-status-warning`, "over the ±2 band"); most/fewest render `'—'` when the tier has no drops yet.
- **Usage rules:** purely presentational — rolls up `computeTierFairness` (`utils/lootFairness`) over slices Loot's screen already holds; no local state, no store imports. `StatCard` is a private inline component, not a separate contract entry.

### 3.35 WeekScopeControl — F6d

- **Anatomy:** a `Dropdown` (`Button` trigger, `variant="secondary" size="sm" trailing="chevron"`, label `"This week (Week N)"` when `scopedWeek === currentWeek` else `"Week N"`) opening a `DropdownContent` list of every week `maxWeek…1` (descending), each item showing the week label + a UTC-pinned date range + colored data-type dots (`loot`→accent, `books`→`membership-lead`, `mats`→`status-warning`, from `weekDataTypes`); when `canEdit`, a separator plus "Start next week" and "Revert week" (disabled at `currentWeek <= 1`) items, each opening a `ConfirmModal`.
- **Props:** `{ clock: WeekClock; scopedWeek: number; onScopedWeekChange: (week: number) => void; canEdit: boolean }`.
- **States:** dropdown closed/open; `pendingMutation`: `null` | `'start-next'` | `'revert'` (drives which `ConfirmModal` is open); mutation in flight → toast success/failure on settle.
- **Usage rules:** this is the **single mutation host** for the shared `WeekClock` — `startNextWeek`/`revertWeek` live here and nowhere else. `WeekNavigatorStrip` (§3.24) reads the same clock for its own stepper UI but never mutates it (see that entry's "one clock, one mutation host" note) — do not add a second path that calls `startNextWeek`/`revertWeek`. Dates are UTC-pinned (`toLocaleDateString('en-US', { timeZone: 'UTC', ... })`) so the shown range never shifts a day from the mid-day UTC anchor — the same convention `WeekGroupHeader` (§3.36) reuses.

### 3.36 LootHistoryTable + WeekGroupHeader — F6d

- **Anatomy (LootHistoryTable):** merges + filters the loot and material logs (`buildHistoryItems`/`filterHistoryItems`), groups the result by week (descending, first-seen order), and renders one card per week (`rounded-lg border bg-surface-card`) — each headed by a `WeekGroupHeader` and followed by one `LootEntryRow` per item. Empty state: a muted "No entries match — log a drop from the Priority view." line.
- **Props (LootHistoryTable):** `{ lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[]; players: SnapshotPlayer[]; floors: string[]; filters: HistoryFilterState; currentWeek: number; rangeOfWeek: (week: number) => WeekRange | null; canEdit: boolean; onEdit: (entry: LootLogEntry) => void; onCopyLink: (item: HistoryItem) => void; onDelete: (item: HistoryItem) => void }`.
- **Anatomy (WeekGroupHeader):** a header row — a `"WEEK N"` pill (accent-tinted `text-accent-hover` when `isCurrent`, else neutral `surface-elevated`/`text-text-secondary`) + a UTC-formatted date range (when `range` is supplied) + a right-aligned `"{count} drop(s)"` line.
- **Props (WeekGroupHeader):** `{ week: number; isCurrent: boolean; range: { start: Date; end: Date } | null; count: number }`.
- **States:** deep-link highlight — a `?entry=&entryType=` URL param, validated against the **unfiltered** logs (an id not present in the current logs is treated as absent, never throws), scrolls the matching row into view and pulses it, then self-clears the params after 2.5s (legacy parity, `SectionedLogView.tsx:628-680`) | no-groups empty state | normal grouped rendering.
- **a11y / Usage rules:** `WeekGroupHeader` is purely presentational — no store access, props only. `WeekGroupHeader`'s UTC-pinned date formatting reuses the exact convention `WeekScopeControl` (§3.35) established — don't reintroduce local-time formatting for week ranges anywhere in Loot. The deep-link effect derives its highlight state from the URL directly rather than mirroring it into component state, so there is nothing to desync.

---

## 4. Iconography & motion

Icons: Lucide, stroke `1.5–2.5px` on dark (default 2px), sizes xs12/sm16/md20/lg24/xl32 — kept. Job icons: the FFXIV set, sizes xs–lg — kept. **⌘K affordance fix (validation finding):** show platform-correct modifier (`⌘K` on mac, `Ctrl K` on Windows — most of the audience) or fall back to a search icon + "Search"; never render a bare glyph that breaks without the font. Motion: not yet specified — flagged as a v3.1 gap (transitions, the toggle's orb slide, popover enter/exit need durations/easing tokens).

### 4.1 Glyph lexicon (one glyph = one meaning) — LOCKED

**Governing rule:** every decorative glyph in the UI must carry exactly one meaning from this table, used only and always for that meaning. A glyph not in this table must be removed or added here first (with rationale). This is the source of truth; §3.1's trailing-element rules are a derived subset.

| Glyph | The one meaning | Notes |
|---|---|---|
| magnifier `🔍` | **search** | the only search affordance; never decorative |
| diagonal up-right arrow `↗` | **leaves the app / external link** | carries its meaning icon-only — no accompanying "External" label required; never used for in-app navigation |
| chevron `›` / `⌄` | **disclosure** — expand/collapse, or opens a menu/popover in place | used on Button trailing-element when a popover opens; used on collapsed sections |
| caret (small filled triangle `▾`) | **dropdown / sort direction** | indicates a select input or a sortable column; distinct from chevron by being filled and smaller |
| kebab `⋮` (vertical 3 dots) | **overflow menu** (vertical/column-oriented layouts) | never used in a horizontal row context |
| meatball `⋯` (horizontal 3 dots) | **overflow menu** (horizontal/row-oriented layouts) | the horizontal sibling of kebab |
| drag handle `⠿` | **reorder / draggable** | the only affordance indicating a draggable item |

**The decorative trailing `→` is removed.** The mockups' "Apply →", "Enter →", "Assign →" patterns are corrected per this lexicon: a plain action gets no trailing glyph. Only genuine external-link (`↗`) or disclosure (`›`) actions get their defined glyph. See §3.1 for Button trailing-element rules.

---

## 5. Theming

Dark is base. `tokens.light.json` overrides the **semantic** tier only (already drafted from the v2 light values). Any new theme (e.g. high-contrast for accessibility) is a semantic-tier override — components and primitives never change. This is the entire payoff of the tiered model.

---

## 6. Governance (illegal UI is unrepresentable)

Kept and elevated to the contract — this is the system's best feature and most teams lack it:

1. **No raw color** in component code — only `--component-*`/`--semantic-*` vars. (lint: `no-inline-color`)
2. **12px readable floor (`text-xs`); 9px is the hard floor for badge counts only.** (lint: `no-tiny-text`)
3. **Shared interactions use the shared component** — one Button, one Select, one recipient picker. (review rule)
4. **Constrained primitives** — Tag/Tabs/NavRow enforce their semantics by type; illegal combinations don't compile.
5. **Tokens are generated, not hand-copied** — CSS/Tailwind/Figma all build from `tokens.json` in CI; a hand-edited variable that diverges from the JSON fails the build.
6. **`pnpm check:design-system`** is the gate for all of the above.

---

## 7. Open gaps this surfaced (for the validation pass)

Writing the contract exposed real holes — these become validation agenda items. Items marked ✅ are now locked in this doc.

1. ✅ **Trailing-arrow buttons** — §3.1 forbids decorative arrows; §4.1 lexicon is the source of truth. Audit every button in mockups remains a task for the F5 validation pass.
2. ✅ **Gear cell duplication** — resolved in substance, not by the mechanism originally proposed: `GearBoardCell` (F6c, §3.29) replaced the mockups' ad-hoc pips; it derives state from the **same** `toGearState`/`requiresAugmentation` utilities as `GearStatusCircle` (§3.4) rather than rendering `GearStatusCircle` itself — visual unification is superseded by the dense gearsheet-cell (`.gcell`) design, which needed its own compact rendering that `GearStatusCircle`'s circle treatment doesn't fit. One state machine, two renderers, by design.
3. ✅ **Recipient picker** — resolved in substance, not by the mechanism originally proposed: `RecipientPicker` (F6d, §3.31) consolidated the two forked modals (`QuickLogDropModal` + `AddLootEntryModal`) on `SegmentedToggle` (§3.28) + `RadioGroup`/the `GearBoardCell` radio-row pattern, rather than as a `PopoverSelect` (§3.6) specialization — the one-surface, payload-parity goal from this item is achieved; the mechanism differs from what was originally sketched.
4. ✅ **⌘K affordance** — platform-aware label (`⌘K` mac / `Ctrl K` other) in `CommandPalette` §3.10. Font-safe `<kbd>` element.
5. **Motion tokens** — undefined; durations/easing needed for toggle, popover, tab transitions, and the rail pill indicator.
6. ✅ **Context rail** — fully specified in §3.9 (width, surface, corner ownership, item states, a11y) and **built F6a** as `AppRail`. Remaining gap: motion (pill enter/exit), deferred to v3.1.
7. **New components** (§3.8) — ✅ F6a delivered: `AppRail` (§3.9), `Spine` (§3.13), `CommandPalette` (§3.10), `SkipLink` (§3.11), `NotificationBell` (§3.12), `SettingsGear` (§3.14), `StaticPicker` (§3.15). ✅ F6b delivered: `CardShell` (§3.16), `ProgressBar`+`ProgressBarLegend` (§3.17–3.18), `PlayerIdentity` (§3.19), `EmptyStateInvite` (§3.20), `TwoRegionDashboard` (§3.21), `AttentionRow` (§3.22), `SessionRsvpCard` (§3.23). Remaining proposals: availability heatmap, match-score listing (Finder).
8. **Density** — no compact/comfortable density tokens; data-dense Board may want a compact mode. Flagged.
9. **Focus-visible spec** — focus-ring token exists; the exact ring (width/offset) isn't specified per component.

---

## 8. Files

- **`tokens.json`** — W3C tokens, 3 tiers, the source of truth for values. Generates CSS/Tailwind/Figma.
- **`tokens.light.json`** — semantic-tier light overrides.
- **`tokens.generated.css`** — example generator output (160 vars), proving the round-trip.
- **`DESIGN_SYSTEM.md`** — this contract (atoms described + structure + component contracts + governance).
- *(next)* a **styleguide page rebuilt to render FROM `tokens.json`**, so the reference and the source can never drift.

> **Review checklist:** Do the 3 token tiers match how you think about changes (rebrand/re-theme/retune)? Is the trailing-arrow rule (§3.1) right? Any atom you want changed now that it's tiered (the v2 page hinted a few should update for the sidebar layout — which?)? Confirm the retired vocabulary (§2.3). Then I'll rebuild the styleguide to render from tokens and resume the mockup→validation pass with these contracts as the bar.
