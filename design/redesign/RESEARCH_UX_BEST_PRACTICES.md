# Modern UX/UI Design-System Best Practices for an FFXIV Raid-Planning Tool

## TL;DR
- **Navigation rail:** Your ~72px icon-only left rail is a legitimate, well-supported pattern — Material 3 documents the collapsed rail at exactly 72dp ("reducible to 56 dp and text labels are omitted"), and Discord's guild rail is a 72px container with 48px icons. The real defect is that it floats outside your token system: wire it in as a distinct **semantic surface tier**, give every item a required tooltip + accessible name, and use a filled-icon + active-indicator selected state. If you later add labels or nesting, jump to a 240–256px sidebar (Carbon's expanded UI Shell = 256px/16rem; Shopify Polaris default nav = 240px).
- **Icon lexicon + design-system structure:** "One icon = one meaning" is a direct application of Nielsen's Consistency & Standards heuristic (NN/g: "stick to the standard magnifying glass for search"). The three-tier W3C DTCG token model (primitive → semantic → component) reached its **first stable spec (2025.10) on October 28, 2025** and is now the industry consensus. Document components as contracts (anatomy, props, states, do/don't) like Polaris/Carbon/Primer, constrain APIs so illegal states can't compile, and enforce tokens via Stylelint/ESLint in CI.
- **Vocabulary:** Apply Nielsen's "Match between system and the real world." Collapse your overlapping "Goals / progression / content / raids" into one-concept-per-term, adopt the FFXIV community's stable lexicon (Savage, tier, prog, BiS, clear, farm, lockout) verbatim, and maintain a written glossary that bans synonyms and homonyms.

---

## Key Findings

1. **An icon-only rail at ~72px is standard, but it must be integrated into your surface hierarchy and must never rely on icons alone for meaning.** Material 3 specifies the collapsed navigation rail at 72dp (reducible to 56dp), holding 3–7 destinations, on the leading edge, with a filled icon + active indicator for the selected state and a text label/accessible name on every item.

2. **Whether the rail is the darkest surface or a raised one is a deliberate choice with two valid schools.** Discord makes its guild rail the *darkest*, most recessed tier. Material 3 and Atlassian instead treat persistent left navigation as a near-background surface differentiated by a divider/border or a slight tonal shift, reserving shadow elevation for transient overlays. For a dark, data-dense app, a tonal (not shadow) distinction plus a 1px border is cleanest.

3. **"One icon, one meaning" is documented usability canon and your instinct is correct.** NN/g's Consistency & Standards heuristic explicitly cites the magnifier = search convention; the external-link arrow, chevron (disclosure), kebab (vertical overflow), meatball (horizontal overflow), and hamburger (nav drawer) all have established meanings you can codify.

4. **The three-tier W3C DTCG token model is the settled consensus.** The Design Tokens Community Group announced the first stable spec (2025.10) on October 28, 2025; 20+ editor organizations and tools (Figma, Style Dictionary v4, Tokens Studio, Penpot, Sketch, Terrazzo) support it. Three tiers is the recommended ceiling, and components must never reference primitives directly.

5. **Leading systems document components as contracts, not screenshots.** Carbon, Polaris, Primer, Spectrum, and Material 3 all publish anatomy + variants/props + states + usage do/don't. Pair this with constrained, "illegal-states-unrepresentable" component APIs and CI linting to prevent raw hex and design drift.

6. **Your "Goals / progression / content / raids" conflation is a textbook synonym + homonym overload.** Nielsen's "Match between system and the real world," plus EightShapes' token-naming principle "avoid homonyms," prescribe a single controlled vocabulary. The FFXIV community already has a precise, stable lexicon you should adopt.

---

## Details

### Topic 1 — Navigation Rail vs. Sidebar

**(a) Rail vs. sidebar: when to use each, widths, collapse patterns**

The dividing line is labels and destination count:

- **Icon-only rail (~48–72px):** Best for a small, stable set of top-level destinations. Material 3 states verbatim: *"The navigation rail container is 72 dp wide by default. To adjust for dense layouts, the container width can be reduced to 56 dp and text labels are omitted,"* and it should hold *"three to no more than seven app destinations."* Material 2 allowed a 52dp compact rail (`Widget.MaterialComponents.NavigationRailView.Compact`). Discord's guild rail is a **72px container with 48px icons** (per BetterDiscord's theming docs and multiple icon-spec guides). Carbon's collapsed "rail" variant sits on the ~48px header mini-unit and reveals on hover/focus (the 48px figure is inferred from Carbon's mini-unit system rather than tabulated as a literal spec).
- **Labeled sidebar (~240–280px):** Use when you have more destinations, hierarchy/nesting, or user-generated items. Hard, officially-sourced numbers: **Carbon's expanded UI Shell side nav = 256px (16rem)** — Carbon offsets expanded content with `margin-left: 16rem; width: calc(100% - 16rem)`. **Shopify Polaris default navigation = 240px** — confirmed directly by Shopify (GitHub issue #3212: *"...much narrower (89px) than the default nav (240px)"*; the Polaris Frame is "opinionated on this component's width"). Adobe Spectrum's side nav default is `size-3000` (240px) and deliberately flexible. General industry guidance (UX Planet) recommends 240–300px expanded, 48–64px collapsed.
- **Collapsible/expandable:** Material 3's "expanded navigation rail" (the M3 Expressive replacement for the navigation drawer) animates from the collapsed rail and can be **standard** (pushes content) or **modal** (overlays content). The collapsed rail should **never be fully hidden**; the expanded state can be. Linear ships a collapsible icon+label sidebar (collapse via the `[` shortcut). Carbon's rail auto-collapses and expands on hover/focus.

Recommendation: keep the 72px icon-only rail for your handful of top-level destinations; if you later need labels/nesting, expand to a 240–256px panel rather than widening the rail.

**(b) Relationship to the top bar — elevation, surface, borders, "who owns the corner"**

There is no single rule, but two coherent models:
- **Rail-owns-the-corner (Discord/Slack model):** The persistent left element runs full height and is the darkest, most recessed surface; the top bar sits to its right and does not span the full width. Reads as "the rail is the app frame."
- **Top-bar-owns-the-corner (GitHub Primer model):** Primer's App Header is the topmost bar containing global navigation/actions and "is never fixed to the top of the viewport — it scrolls with the rest of the page," with the sidebar beneath it.

Material 3 and Atlassian both recommend distinguishing the rail from scrolling content with **a divider or a tonal surface-color change**, and using **shadow/elevation sparingly** — Atlassian reserves raised/overlay shadows for movable and floating UI and notes "shadows can be harder to see in dark mode, so dark mode elevations also rely on different surface colors." For your dark theme, prefer a tonal step + 1px border over a drop shadow. Pick one owner of the top-left corner and apply it consistently; for a data-dense tool where the rail is the primary spatial anchor, the rail-owns-corner model is cleaner.

**(c) Active/hover/focus conventions for rail items**

Material 3's documented convention: on selection the **icon becomes filled** (outlined when inactive), color shifts to a more prominent token, and an **active indicator** (a pill/shape behind the icon) appears and animates from center. Active and inactive icons must maintain **≥3:1 contrast** with the container. Hover and pressed states should be expressed as **surface-color changes** (Material's state-layer overlays; Atlassian's hovered/pressed elevation tokens), not motion, for small UI. Discord uses a pill/"blob" notch indicator on the left edge of the active server. Focus must have a visible focus ring distinct from hover for keyboard users.

**(d) Where the rail sits in the elevation system**

Material 3 has moved from numeric +1…+5 elevation overlays to **tone-based surface roles** (surface, surface-dim, surface-bright, surfaceContainerLowest…Highest). Two defensible placements:
- **Darkest/recessed (Discord):** rail = lowest/dimmest surface, content = brighter. Good when the rail is permanent chrome.
- **Raised tier:** rail slightly lighter than the page background, as a quiet container.

For a dark, teal-accented, data-dense tool, the recommended choice is to make the rail a **recessed surface** (equal to or one step darker than the app background) separated by a border, so the bright data tables in the content area are the visual focus. Reserve true shadow elevation for menus/popovers/dialogs only. Crucially: define the rail's fill as a **semantic surface token** (e.g., `color.surface.nav`) that references a primitive, not a raw hex.

**(e) Accessibility for icon-only navigation**

Non-negotiable for an icon-only rail:
- **Accessible name on every item:** Use a visually-hidden text label inside the control, or `aria-label`. NN/g: "Due to the absence of a standard usage for individual icons, text labels are necessary to communicate meaning and reduce ambiguity."
- **Tooltips:** Follow the WAI-ARIA tooltip pattern — tooltip appears on hover *and* keyboard focus, dismisses on Escape/blur, never contains interactive content, and is associated via `aria-describedby`. Per MDN and Sarah Higley, a tooltip *supplements* but does not *replace* the accessible name; for an icon button the text alternative should be the button's accessible name (`aria-label`/visually-hidden text), with the tooltip as redundant visual reinforcement. Avoid the native `title` attribute (inconsistently announced).
- **Landmarks & keyboard:** Wrap in `<nav>` with an `aria-label` (e.g., "Primary"); ensure logical tab order and a visible focus indicator; provide a skip link past the nav (Primer's documented pattern).
- **Touch targets:** ≥44×44px (Apple/WCAG 2.2) or 48×48dp (Material).

**Named-app reference table:**

| App / system | Rail width | Surface treatment | Labels |
|---|---|---|---|
| Material 3 (collapsed) | 72dp (56dp dense) | tonal + optional divider/elevation | label below icon |
| Discord guild rail | 72px container / 48px icons | darkest tier, recessed | icon-only + tooltips |
| Slack (2023 primary rail) | narrow (no px published) | recessed chrome | icon **+** label tabs (Home, DMs, Activity, Files, More) |
| Carbon UI Shell | ~48px rail → 256px (16rem) expanded | header-aligned, 4px selected border | reveal-on-hover |
| Polaris nav | 240px (Shopify-confirmed) | framed panel | labels |
| Linear sidebar | ~220–260px (not published) | recessed chrome, collapsible (`[`) | icon + label |
| Vercel dashboard | ~220–260px (not published) | recessed | icon + label |

### Topic 2 — Icon Semantics / Visual Lexicon

**(a) Established glyph conventions (with sources)**

| Glyph | Conventional meaning | Source |
|---|---|---|
| Magnifying glass | Search | NN/g Consistency & Standards (explicitly cited) |
| Diagonal up-right arrow (↗) | Opens external page / new tab/window | Material "open in new"; WCAG G200/G201; common `external-link` icon |
| Chevron (›/⌄) | Disclosure / expand-collapse / "more in this direction" | Material, common practice |
| Caret (small filled triangle) | Dropdown / sort direction (distinct from chevron) | Apple HIG (downward arrow = pop-up menu) |
| Hamburger (≡) | Navigation drawer / main menu | Wikipedia; Google: "navigation drawers provide access to destinations" |
| Kebab (⋮ vertical 3 dots) | Overflow menu (vertical layouts) | LogRocket; NN/g contextual menus |
| Meatball (⋯ horizontal 3 dots) | Overflow/context menu (horizontal layouts, rows) | LogRocket; NN/g |
| Bento/waffle (grid) | App launcher / switch apps | LogRocket |
| Drag handle (⠿ grip) | Reorder / draggable | common practice |
| Floppy disk | Save (still recognized but increasingly dated per NN/g, 2025) | NN/g |

**(b) "One icon = one meaning, one meaning = one icon"**

This is a direct corollary of **Nielsen's Heuristic #4, Consistency & Standards** — refined by Nielsen in 1994 from a factor analysis of 249 usability problems and unchanged since. NN/g states it operationally: *"stick to the standard magnifying glass for search, so that users will easily recognize it,"* and frames Jakob's Law: *"people spend most of their time using digital products other than yours… Failing to maintain consistency may increase the users' cognitive load."* NN/g's contextual-menu guidelines extend it: *"Contextual-menu icons should have a consistent function, behavior, and appearance across the product… reserve it for contextual menus only… Don't repurpose the icon for unrelated interactions."* NN/g's four icon quality criteria — findability, recognition, information scent, attractiveness — give you the test rubric. EightShapes' token-naming work supplies the parallel naming principle: "avoid homonyms."

**(c) When icon-only is acceptable vs. when a label is required**

NN/g's position: because individual icons lack standardized meaning, **text labels are necessary** to reduce ambiguity in most cases; icons are more salient/forgivable on small mobile screens than on dense desktop UIs. Practical rule:
- **Icon-only acceptable** for universally recognized actions (search, close, the kebab/meatball overflow) **and** when a tooltip + accessible name is always present (as in a nav rail).
- **Label required** for anything domain-specific, destructive, or ambiguous, and for primary navigation destinations whenever space allows. Material's nav components always carry a label as "another way for people to understand an icon's meaning."

**(d) Trailing-icon-in-button convention**

A trailing icon in a button signals *what happens next / where it goes* — codify these three as distinct, non-overlapping signals:
- **Trailing diagonal arrow (↗):** leaves the app / opens external or new tab. Per NN/g, WCAG G200/G201, and GOV.UK, this must be reinforced with words ("opens in new tab") for accessibility — an icon alone is insufficient because the new-window icon has "no standardised form." Use `rel="noopener"`.
- **Trailing right chevron/arrow (→):** forward progression / "continue" / navigates deeper within the app.
- **Trailing down caret (⌄):** reveals a menu/popup (Apple HIG: "a downward-pointing arrow that indicates the presence of a pop-up menu").

### Topic 3 — Modern Design-System Structure

**(a) W3C DTCG format + three-tier model**

The **Design Tokens Community Group announced its first stable spec — version 2025.10 — on October 28, 2025**: *"The Design Tokens Community Group today announced the first stable version of the Design Tokens Specification (2025.10)."* Tools can use the date as a compliance version number. As Mike Kamminga of Tokens Studio framed it, "The DTCG spec v1 gives the industry a stable foundation." Core format: each token has `$value`, `$type`, optional `$description`; aliases use curly-brace references (`{color.blue.500}`); composite types (e.g., `typography`) bundle related sub-values. The consensus tiering:
- **Tier 1 — primitive/global:** raw values, no semantics (`color.blue.500`, `space.4`). Changes rarely.
- **Tier 2 — semantic/alias:** purpose-named, references primitives (`color.action.primary`, `color.surface.nav`). Carries the brand/theme; this is where dark mode lives.
- **Tier 3 — component:** component-scoped, references semantics (`button.primary.background`, `rail.item.icon.active`).

Hard rules from practitioners: components **never** reference primitives directly; don't put raw pixels/hex in semantic tokens (reference a primitive); don't exceed ~3 tiers (4 max if you add a "pattern" tier); don't rename for cosmetic reasons — alias instead. Use **Figma Variable Modes** for theming (one file, multiple modes) rather than separate token files.

**(b) Tooling and single source of truth**

The mature pipeline: author tokens in **Tokens Studio** (Figma) → commit DTCG JSON to git → **Style Dictionary** (v4 has first-class DTCG support) transforms to platform outputs (CSS custom properties, Tailwind config, iOS/Android) in CI → Storybook preview on PR → publish as an npm package consumed by apps. Style Dictionary resolves alias chains at build time, outputting final values per platform. For your Tailwind 4 + Vite stack, generate `tokens.css` (CSS variables) from the DTCG file and map them into Tailwind's `@theme`. A useful modern addition: export a human-readable `tokens.md` so AI coding tools generate on-brand components.

**(c) Components as contracts — exemplars**

Document each component with: **anatomy** (labeled parts), **variants/props** (the controlled API), **states** (default/hover/focus/active/disabled/loading/error), **slots**, and **usage do/don't** + content guidelines. Exemplars to emulate:
- **Carbon** publishes explicit component templates (single-variant vs. multi-variant) and a contribution checklist; documents anatomy + accessibility + keyboard interactions.
- **Polaris** ships 60+ React components with usage guidelines, accessibility (WCAG 2.1 AA), content recommendations, and design tokens per component.
- **Primer (GitHub)** documents navigation patterns (NavList, TreeView, UnderlineNav vs. UnderlinePanels) with explicit "activating this changes the URL vs. changes content" contracts.
- **Spectrum (Adobe)** documents do/don't, RTL/bidi, WCAG keyboard behavior, and ties every visual attribute to a token.
- **Material 3** documents anatomy, states, and the active-indicator behavior precisely.

Brad Frost's Component Gallery is a good cross-system reference for comparing component APIs.

**(d) Making illegal states unrepresentable / constrained APIs**

Borrowed from typed functional programming (Yaron Minsky; Scott Wlaschin's F# work), the principle: design the component's prop types so invalid combinations **cannot be expressed/compiled.** Practical applications for your React 19 + TS components:
- Use **discriminated unions** instead of many independent booleans (e.g., a Button's `variant` as `'primary' | 'secondary' | 'destructive'`, never `isPrimary` + `isDestructive` that can both be true).
- Model "icon-only requires an accessible label" as a type: `{label: string} | {iconOnly: true; 'aria-label': string}`.
- Avoid optional-everything "anemic" prop bags; encode required relationships in the type. This shifts whole classes of misuse from runtime to compile time and makes the component self-documenting.

**(e) Governance and linting**

Enforce the system in CI, layered:
- **Stylelint** (CSS/Tailwind) + **ESLint** to ban raw hex and arbitrary spacing and require token usage. Atlassian ships exactly this: `@atlaskit/eslint-plugin-design-system` and `@atlaskit/stylelint-design-system`, with a token lifecycle (active → deprecated → deleted) and autofix migration.
- Dedicated token linters (e.g., `@lapidist/design-lint`, Rhythmguard for spacing scale) can flag a raw `<button>` where `<Button>` should be used, and autofix `padding: 16px` → `var(--spacing-4)`.
- **Staged enforcement:** editor feedback → pre-commit hook → **mandatory CI gate** (the one that can't be bypassed) → published-package checks. Start rules as warnings, then promote to errors.
- Add **accessibility checks in CI** (axe/Storybook a11y) and run audits to find hardcoded values and unused tokens. Establish a lightweight governance process for proposing/approving new tokens (the DTCG itself adopted a Contributor/Editor/Module-Lead/Chair model).

### Topic 4 — Vocabulary / Information Architecture

**(a) Match the user's mental model (Nielsen Heuristic #2)**

"The system should speak the users' language, with words, phrases, and concepts familiar to the user, rather than system-oriented terms." Your "Goals page" that is really "a selectable list of raid content to track progress on" is a system-oriented label that doesn't match how raiders talk. Raiders don't set "goals"; they pick **fights/tiers to prog and clear.** Rename to match.

**(b) Avoid synonym overload and homonym overload**

EightShapes (Nathan Curtis) codifies both failure modes: a **homonym** is one word meaning many things ("type" = typography or a category; "text" = typography or content); a **synonym** problem is many words for one concept. Principle: "strive for homogeneity within a class and heterogeneity between classes," and lead each concept with one **preferred term.** Your app has both diseases: "goals," "progression," "content," and "raids" are used as near-synonyms for the same object, while "content" is also a homonym (FFXIV "content" can mean any activity). Pick exactly one term per concept and ban the rest in UI copy.

**(c) Build and maintain a UI vocabulary/glossary**

Create a content-design lexicon: a table with **preferred term → definition → "don't use" synonyms → notes,** owned alongside the design system (as Polaris, Material, and Atlassian all publish content/voice guidance and a glossary). Enforce it in code review the same way you enforce tokens. Material maintains a formal foundations glossary; Polaris dedicates a whole Content section (actionable language, voice/tone, error messages).

**(d) FFXIV-community terminology to adopt**

The community lexicon is stable and precise — adopt it verbatim so your tool "speaks the user's language":
- **Tier:** a set of four Savage fights released at patch x.0/x.2/x.4 (current Dawntrail tiers: M1S–M4S, M5S–M8S, and the Heavyweight tier M9S–M12S).
- **Savage:** the current-patch 8-player gear-progression raid (the core endgame). **Normal raid:** story-mode version. **Ultimate:** prestige superbosses, no gear reward. **Extreme / Chaotic / Criterion:** other difficulty tracks.
- **Prog (progression):** learning/advancing through a fight's mechanics; tracked by "prog point" (e.g., "P2 prog," "enrage prog"). **Clear:** finishing the fight. **Farm/reclear:** repeated clears for loot. **Blind:** no guides.
- **BiS (best-in-slot):** the optimal gear set for a job this tier. **ilvl/item level. Tome/tomestone gear, crafted, augmented. Materia/meld.**
- **Loot/lockout:** weekly-locked Savage rewards; loot rules like "lot left and drop." **Book/page:** the weekly clear token when no chest drops.
- **Static:** a fixed group; **PF (Party Finder). Pull, wipe, lockout** (instance timer).

Concrete renaming recommendation: replace the conflated "Goals / progression / content / raids" with a clean hierarchy — a top-level destination called **"Raids"** (or "Content" only if you genuinely mean all duty types) that lists selectable **fights** grouped by **tier**; the act of tracking is **"Progress"/"Prog"** (a status on each fight), not a separate noun-page. Reserve "Goals" only if you introduce genuinely user-defined targets distinct from raid content.

---

## Recommendations

**Stage 1 — Lock the navigation-rail visual standard (this week).**
1. Define rail surface as a **semantic token** `color.surface.nav` referencing a primitive one tonal step darker than the app background; add a 1px `color.border.nav` divider; no drop shadow.
2. Set rail width to a `dimension` token = **72px** (icon target 24px, item box 48–56px, ≥44px touch target). Decide the top-left corner owner — recommend **rail-owns-corner** (full-height rail, top bar to its right).
3. Item states: inactive = outlined icon + muted token; active = filled icon + accent (teal) token + left-edge pill indicator; hover/pressed = surface overlay token; focus = visible ring. Verify ≥3:1 icon/container contrast and AA text contrast in dark mode.
4. Accessibility: wrap in `<nav aria-label="Primary">`, every item gets a visually-hidden label + WAI-ARIA tooltip (hover+focus, Esc to dismiss), add a skip link.

**Stage 2 — Publish the icon lexicon table (next).** Adopt the glyph table above as a canonical doc; assign exactly one meaning per glyph; codify the three trailing-icon signals (↗ external + new tab with "opens in new tab" text; → forward/continue; ⌄ menu). Add an ESLint/Storybook check or review checklist so an icon is never reused for a second meaning.

**Stage 3 — Formalize tokens + component contracts.** Confirm your tiering is primitive→semantic→component with no component→primitive references; generate `tokens.css` + Tailwind 4 `@theme` from your DTCG JSON via Style Dictionary; for each component write anatomy/props/states/do-don't; refactor props to discriminated unions so illegal states won't compile.

**Stage 4 — Turn on governance.** Add Stylelint + ESLint token rules (ban raw hex/arbitrary spacing), wire them into a mandatory CI gate (warnings → errors), add axe a11y checks, and stand up a lightweight token-change approval process.

**Stage 5 — Ship the vocabulary glossary + rename.** Build the preferred-term/definition/banned-synonyms table; execute the "Raids → tier → fight, Progress as status" rename; adopt FFXIV community terms verbatim; enforce in review.

**Thresholds that change these recommendations:**
- If top-level destinations exceed **7**, switch from the icon rail to a **240–256px labeled sidebar** (or an expandable rail).
- If you add **nesting/hierarchy or user-generated lists** in nav, you need labels → sidebar.
- If usability testing shows users miss rail destinations (low findability per NN/g), add **always-visible labels** (Material's label-below-icon at the wider rail).
- If you introduce genuinely user-set objectives, *then* a distinct "Goals" concept becomes legitimate.

## Caveats
- **Documented widths are uneven.** Only Carbon (256px expanded) and Polaris (240px, Shopify-confirmed) have hard, officially-sourced pixel widths. Discord's 72px/48px comes from reputable theming docs, not Discord itself. Slack, Linear, and Vercel do **not** publish fixed sidebar widths — the ~72px rail and ~220–260px sidebar figures are industry conventions/estimates, not quoted specs.
- **Material 3 is mid-transition.** The "M3 Expressive" update deprecates the navigation drawer in favor of the expanded rail and replaced numeric elevation overlays with tone-based surface roles; some Material 2 numbers (52dp compact rail, dp elevation values) reflect the older system.
- **DTCG modules beyond the core format** (color, typography, motion) and cross-file aliasing are still stabilizing; keep your primary token file simple and lean on tool extensions sparingly.
- **FFXIV patch specifics drift.** Tier names (Arcadion, Heavyweight) and current ilvl breakpoints are patch-specific (Dawntrail 7.x as of 2026); your tool should treat tier/fight data as content, not hardcoded values.
- **Tooltips are supplemental, never the sole label.** Touch devices and some screen readers won't surface tooltip text — the accessible name must live on the control itself.
- Several supporting figures (industry width ranges, the "70% of uninstalls" navigation stat) come from secondary blog sources rather than primary research; treat them as directional.