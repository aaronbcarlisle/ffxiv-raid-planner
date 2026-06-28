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
- **Required by type:** `aria-label: string` and `icon: ReactNode` are mandatory props — an unlabeled icon button cannot be constructed. This is the canonical home for icon-only actions; a `Button` must carry a visible text label (see §3.1).
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

### 3.4 GearStatusCircle (kept — the gear atom)

Target-style indicator. **Raid slots: 2-state** (missing ⇄ complete). **Tome slots: 3-state** (missing → have → augmented). Sizes sm/md/lg. Special states: disabled, no-BiS-set. This is the canonical gear cell — the Roster **Board** uses it; the Cards gear strip is a compact derivative of the same states. *(Validation note: the mockups' ad-hoc gear pips should be replaced with this component.)*

### 3.5 Toggle (Recessed-Orb), Number Input (Capsule), Week Stepper

Kept as-is from v2 — premium, already standardized. Toggle: dark sphere inset, teal track on / dark off. Number input: teal +/- on capsule sides, recessed value center. Week Stepper: dot-stepper, current week as expanded pill, status dots for weeks with data. **The Week Stepper is the canonical control for the "week" clock** in the top bar and Schedule.

### 3.6 PopoverSelect & the unified recipient picker

PopoverSelect (badge-style, the documented `bg-{color}` selected / `bg-{color}/20` suggested / grayed-out-when-not-eligible standard) is the atom. **The Loot recipient picker is a PopoverSelect specialization** — same selected/suggested/grayed grammar, plus the reason string + scope tabs (By priority / All members / Off-spec). *(Validation note: formalize the recipient picker as one component so the two old forked modals collapse into it.)*

### 3.7 Inputs, Select, Searchable Select, Checkbox

Kept from v2: text input (default/error/disabled, sizes, with-icon, input-group), Select, SearchableSelect (filterable, categorized with colored sticky headers), checkbox. All consume `component.input.*` tokens. **Surface note:** inputs map to `surface-interactive` (`#1e1e26`); `surface-elevated` (`#121218`) is for popovers/elevated cards (value unchanged; documented role moved).

### 3.8 New components the redesign introduces (to be formalized here)

These appear in the mockups and must become real, tokenized components: **top bar**, **spine tab-bar**, **⌘K command palette** (overlay), **availability heatmap**, **RSVP row**, **match-score listing** (Finder), **attention-list row** (Home). Each gets a contract entry as it's built; until then they're *proposals*, not yet canon. The context rail is specified in §3.9 below (no longer a proposal — locked).

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
4. **⌘K affordance** — platform-correct, font-safe (§4).
5. **Motion tokens** — undefined; durations/easing needed for toggle, popover, tab transitions, and the rail pill indicator.
6. ✅ **Context rail** — fully specified in §3.9 (width, surface, corner ownership, item states, a11y). Remaining gap: component-tier tokens (`nav.*`) and motion, scoped to F3.
7. **New components** (§3.8) — top bar, spine, palette, heatmap, RSVP row, match listing, attention row — none are tokenized yet. *(Rail moved to §3.9.)*
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
