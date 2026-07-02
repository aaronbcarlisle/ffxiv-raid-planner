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

**Built in F6b (contracted §3.16–3.23):** `CardShell` (§3.16); `ProgressBar` (§3.17) + `ProgressBarLegend` (§3.18); `PlayerIdentity` (§3.19, `inline` variant — `board-cell`/`rsvp-row` reserved F6c/e); `EmptyStateInvite` (§3.20); `TwoRegionDashboard` (§3.21); `AttentionRow` (§3.22); `SessionRsvpCard` (§3.23, `next` variant — `later` reserved F6e). Ring-0 `home/` compositions (`Home`, `WeeklyLootSummaryCard`, `RosterReadinessCard`, `RoleBisCard`, `StaticActivityFeed`, `TrackCard`) are screen-specific, not design-system atoms — not contracted here.

**Still proposals (not yet contracted):** **availability heatmap**, **match-score listing** (Finder). Each gets a contract entry as it's built.

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
- **Variants:** `'inline'` — avatar + name + meta row. **BUILT F6b.** `'board-cell'` — compact cell for Roster Board. **RESERVED F6c — do not implement yet.** `'rsvp-row'` — RSVP roster row inside `SessionRsvpCard`. **RESERVED F6e — do not implement yet.** Reserved variants render `null` with a DEV console warning.
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

### 3.23 SessionRsvpCard — F6b

- **Anatomy (next variant):** `CardShell` ("Next session" + countdown `Tag` variant `label` tone `accent` in `headerRight`) wrapping: day/time line (`font-display text-lg font-semibold`) + timezone line (`text-xs text-text-tertiary` — session tz + optional viewer tz when they differ); RSVP avatar stack (one `SafeAvatar` per `rsvp`, ring colored by RSVP **status** via `STATUS_TOKEN`); `"N in · M tentative"` count line; 3-button RSVP strip (I'm in / Tentative / Can't make it).
- **Props:** `{ session: ScheduleSession; currentUserRsvp?: RsvpStatus; onRsvp?: (status: RsvpStatus) => void; variant?: 'next'|'later'; viewerTimezone?: string }`.
- **Variants:** `'next'` — prominent next-session card (accent header). **BUILT F6b.** `'later'` — neutral border, ghost RSVP buttons (Schedule list view). **RESERVED F6e — API-reserved, not yet implemented.** Currently renders identically to `'next'`; F6e differentiates the two.
- **Avatar-ring color decision (deliberate):** `ScheduleRsvp` carries no member `role` field. Rings are colored by RSVP **status** via status tokens (`available → var(--color-status-success)`, `tentative → var(--color-status-warning)`, `unavailable → var(--color-status-error)`). If a role field is later added to `ScheduleRsvp`, switch to `var(--color-role-*)`. Role-coloring is explicitly deferred, not forgotten.
- **a11y:** RSVP buttons are real `Button`s; the active RSVP has `aria-pressed={true}`. Avatar ring status is conveyed by the `title` attribute (`"Name — status"`) — not by color alone.
- **Usage rules:** presentational — no store imports. Parent (Home) wires `onRsvp` to `scheduleStore`'s RSVP mutation. No session → parent renders `EmptyStateInvite` instead of this card.

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
2. **Gear cell duplication** — mockups use ad-hoc pips; must unify on GearStatusCircle (§3.4).
3. **Recipient picker** — must be formalized as one PopoverSelect specialization (§3.6) to kill the forked modals.
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
