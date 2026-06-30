# F6a — Shell (design spec)

> **Phase:** F6a, the first slice of F6 (build Ring 0). **Branch:** `redesign/f6a-shell` off `redesign/foundation` (`5195d45`). **Status:** spec. Internal/structural — no `CURRENT_VERSION` bump.
> **Authority:** `PRODUCT_MODEL.md` (two-layer model, the spine), `REDESIGN_SPEC.md` §3/§5 (nav surfaces), `DESIGN_SYSTEM.md` §2.1/§2.3/§2.4/§3.8/§3.9/§4 (layout, vocab, rail LOCKED, glyph lexicon), `specs/f5-screen-components-map.md` (shell-chrome element set + catalog: CommandPalette #8, NotificationBell #9, WeekStepper #25, SkipLink #27).

## 1. What F6a is

F6a builds the redesigned **app shell** — the 72px Person-layer **rail**, the **top bar**, the 4-tab **spine** (Home · Roster · Loot · Schedule), the **⌘K** command palette (affordance + navigate-only), and the **skip link** — and mounts it at a **parallel `/v2` route gated by `?shell=v2`**. The live `GroupView` is left untouched. The new shell shares `useGroupViewState()` for all tab/URL semantics and renders the **existing** tab bodies (via a one-time extraction) until F6b–F6e replace each screen.

F6a builds **shell structure + navigation + affordances**. It does **not** build the redesigned Home/Roster/Loot/Schedule content, ⌘K action commands, full week semantics, or the notification content model — those land in their owning slices.

## 2. Locked decisions (this slice)

1. **Spine = 4 tabs** (Home · Roster · Loot · Schedule). Schedule is a tab, not woven into Home.
2. **Coexistence = parallel `/v2` route** (`?shell=v2`); old `GroupView` byte-for-byte unchanged. F6a extracts GroupView's 7 inline tab bodies into importable components.
3. **⌘K = affordance + navigate-only palette**, absorbing `KeyboardShortcutsHelp`; action commands deferred to later slices.
4. **Week clock = top bar owns it**, minimal in F6a; full week semantics built in F6d (Loot), its first real consumer. The spine "WEEK N" pill is at most a read-only mirror (resolves F5's `filler? — confirm`).
5. **Settings = one top-bar gear** (no rail-bottom settings); follows F5's top-bar-only tag over the mockup's dual placement ("Settings is one place," §2.1).
6. **Guardrail (locked, not a choice):** the spine is **in-surface `?tab=` view-switching, never routing** (§2.4); only rail items are true routes. Spine uses `Tabs`; rail uses `NavRow`/`LinkText`. The two must not be conflated.

## 3. Architecture — the `/v2` route + coexistence

- **Mount point (decided):** keep the existing group route (`frontend/src/App.tsx` ~`:164`, inside the `Layout` outlet) and branch on a **`?shell=v2` query param** read from the URL — when present, render the new shell; otherwise render the legacy `GroupView`. This is the lightest gate (no new route tree, coexists with the existing `?tab=` param). No feature-flag infra exists today (only `import.meta.env` + `VITE_*` in `config.ts`), and none is needed: nothing ships to users until `foundation → main`, so an always-available `?shell=v2` gate is sufficient (no `VITE_` flag, no `/v2/...` path).
- **Shared semantics:** the v2 shell calls the **same** `useGroupViewState()` (`frontend/src/hooks/useGroupViewState.ts`) for `pageMode`, the `?tab=` source of truth, deep-linking, and back/forward. No parallel tab-state.
- **Content area:** for any tab whose redesigned screen does not yet exist, the v2 shell renders the **extracted legacy tab body** (see §4). As each later slice lands, it swaps that one tab's content; the others keep rendering legacy bodies.
- **Rail is already reusable** (`AppRail` via `SidebarNav`) — the only real coupling to break is GroupView's shared local closure (§4).
- **End state (post-F6e):** when all five slices have merged and `/v2` reaches parity, flip it to the default route and delete the legacy `GroupView` chrome + the `?shell` gate.

## 4. Enabling refactor — extract GroupView's tab bodies

`GroupView.tsx` (~1455 lines) is monolithic at the component level but **JSX-partitioned per tab**: each tab body is a `{pageMode === 'x' && (<Component .../>)}` conditional in one `<AnimatePresence>` (~`:1205–1490`), sharing GroupView's local closure (`playerActions`, `currentTier`, many `useGroupViewState` values, the memoized `rosterDndArea` ~`:840–918`).

**Task:** extract the 7 tab blocks into importable tab-content components the v2 shell can render. 4 of 7 are near-trivial single-child delegations (`StaticHomeTab`, `GoalsPage`, `MorePage`, `PluginPage`); **Roster and Gear carry the prop weight** (`rosterDndArea` moves with Roster). The legacy `GroupView` continues to render these same components, so its behavior is unchanged.

**Hard constraints during extraction:**
- **Preserve the legacy `?tab=` alias table** — `pageModeFromTabParam` (`useGroupViewState.ts` ~`:30–41`) normalizes legacy values (`home→overview`, `players→roster`, `loot/priority/weapon/log/history/summary→gear`, etc.). The 4-tab spine must keep these aliases resolving so existing shared/bookmarked URLs work.
- **Fix the `goToTestStatic` selector bug here.** It lives in GroupView's roster substitutes-toggle (`aria-label` "Show substitutes with main roster" matches `/Roster/i` in strict mode — `e2e/helpers/auth.ts`). Roster is the heaviest extraction and exactly where the bug lives — disambiguate the selector/aria-label as part of the extraction rather than carrying it forward.
- **Keep the legacy route byte-for-byte equivalent** — extraction is a pure move; `GroupView` renders the extracted components in place with no behavior change.

## 5. Component inventory (build/refine in F6a)

| Component | Type | Current path | Scope in F6a |
|---|---|---|---|
| **Rail** (`AppRail`) | refine → rebuild | `components/layout/AppRail.tsx` (+ retire `SidebarNav.tsx`) | Lock to fixed **72px icon-only** Person-layer rail (§3.9): drop collapse/width animation (56↔208px) + identity-header block; item set → Person-layer (logo · Player Hub · Static Finder · divider · static-avatar items · user-avatar footer); tokenize hardcoded `rgba(20,184,166,…)` → `nav.*`; `aria-label` → "Primary navigation"; add `focus-visible` ring. Net-new `RailNavItem` **avatar variant** (44px static initials, accent border). |
| **Top bar** | refine | `components/layout/Header.tsx` (423 lines) | Realize §3.8 top bar: `[static picker][track picker][spacer][⌘K][bell][gear][theme]`; remove logo (→ rail) + Discord/GitHub primary links; `max-w-[160rem]` → `size.container.*`; **replace the untyped `HEADER_EVENTS` window-event bus with props/context** (remove dead listeners). |
| **Static + Track pickers** | refine | `components/layout/ContextSwitcher.tsx` (264 lines) + `static-group/TierSelector.tsx` | ContextSwitcher → **static segment only** (Player Hub/Finder move to rail); merge `TierSelector` as inline Track picker; fix raw `<button>` (`ContextSwitcher.tsx:212-218`). |
| **Spine** (4-tab) | rebuild (currently dead) | `components/layout/TabNavigation.tsx` (only used by `pages/DesignSystem.tsx`) | §3.8 spine tab-bar: collapse to **Home · Roster · Loot · Schedule** (Overview→Home; retire Goals/Plugin/More from spine IA); full-width border-bottom on `surface-base`; active = text-accent + `::after` 2px underline, icon opaque active / muted inactive; **in-surface `?tab=` only**. Reconcile the two divergent label sets (`TabNavigation` vs `SidebarNav`) to canonical §2.3 vocabulary. |
| **⌘K CommandPalette** | new (minimal) | — | Affordance (platform-aware ⌘K/Ctrl+K per §4, magnifier-only search per §4.1) + overlay that **navigates** (tabs, switch static/track, open settings — all URL/`pageMode`-addressable) and **absorbs `KeyboardShortcutsHelp`**. Action commands deferred. |
| **SkipLink** | new | — | Visually-hidden-until-focus anchor; rail's **first focusable element**; targets `#main-content`. §3.9-mandated. |
| **WeekStepper** | new (minimal) | `components/history/WeekStepper.tsx` + `WeekSelector.tsx` | Establish top-bar home + minimal stepper (the "shell week clock," §2.1). Full week semantics → F6d. |
| **NotificationBell** | refine/consolidate | `components/auth/NotificationCenter.tsx` + `UserMenu.tsx` bell + `Header.tsx` join badge + `notificationStore` | Top-bar bell + unified unread badge (join-request count moves OFF the gear). **Structure only — defer the notification content model.** |
| **Settings gear** | refine/consolidate | `Header.tsx` mobile gear + `components/layout/SettingsDockToggle.tsx` | One always-visible top-bar `IconButton`; fix raw `<button>` (`SettingsDockToggle.tsx:31`). |
| **ThemeToggle** | existing | `components/ui/ThemeToggle.tsx` (clean) | Remove `hidden sm:flex` wrapper so always shown. |

## 6. Token & contract work (in-slice)

**Define `nav.*` component tokens** (named in §3.9/§7, absent from `frontend/tokens/tokens.json` — only rail-width/spine-active-border/spine-active-text/rail-bg exist):
- `nav.item-active-indicator` — pill **color** (→ `accent.default`) **and size** (3–4px width / pill height).
- `nav.item-bg-hover` (→ `surface.overlay`); `nav.item-icon-inactive` (→ `text.muted`), `nav.item-icon-active` (→ `accent.default`), `nav.item-icon-hover` (→ `text.primary`).
- `nav.item-focus-ring` (→ focus-ring token; a **ring, not a fill**); `nav.item-target-size` (44px); `nav.item-icon-size` (24px).
- **`surface.nav`** semantic alias → `surface.raised` + 1px right `border.default` (§3.9 names it; only `surface.raised` exists today).
- Spine hover/active-indicator tokens if the spine tab-bar is tokenized in this slice.

**Motion:** the motion *primitives* + four semantic roles already exist (`tokens.json`), so the "motion undefined" prose is stale. The real gap is the **rail-pill / rail-hover role** — add `semantic.motion.nav-pill` (+ rail-hover) composed from existing primitives.

**Light mode:** add `tokens.light.json` overrides for every new `nav.*` **color** token (only `nav.rail-bg` is overridden today).

**Contracts written this slice** (DESIGN_SYSTEM.md §3, Button-style): **CommandPalette** (minimal — depth deferred per §2.3), **SkipLink** (fully specified), **NotificationBell** (consolidation). Rail contract is already locked (§3.9) — F6a is its first build.

**Conformance:** fix token-debt that trips `check:design-system:strict` **during** the refine — hardcoded `rgba()` (AppRail, PageHeader), raw `<button>` (Header/AppRail/ContextSwitcher/SettingsDockToggle/TabNavigation), sub-12px `text-[10px]` (Header/ContextSwitcher).

## 7. Accessibility (§3.9 mandatory)

- Rail is a `<nav aria-label="Primary navigation">`; each item has a visually-hidden (`sr-only`) text label and a WAI-ARIA tooltip on hover **and** keyboard focus (dismiss on `Esc`).
- Minimum 44×44px touch target (24px icon centered); visible `focus-visible` ring distinct from hover.
- **Skip link** to `#main-content` is the rail's first focusable element.
- Spine tabs use proper `role="tablist"`/`tab` semantics (in-surface), distinct from the rail's nav semantics.

## 8. Out of scope (deferred to owning slices)

Redesigned Home/Roster/Loot/Schedule content (F6b–F6e); ⌘K **action** commands (grow per slice); full week-clock semantics (F6d); notification **content** model; the 27-component screen catalog (built with consuming screens); flipping `/v2` to default + deleting legacy chrome (after F6e).

## 9. Done criteria

- `?shell=v2` renders the new shell: 72px rail + top bar + 4-tab spine, all per §3.8/§3.9, light + dark.
- All 4 tabs render their (legacy) bodies via extracted components; **deep-links + back/forward work**; legacy `?tab=` aliases resolve.
- ⌘K opens, navigates, and shows the shortcuts reference; platform-correct, font-safe.
- `pnpm build` (`tsc -b && vite build`), `pnpm lint`, `pnpm check:design-system:strict`, `pnpm test` all green; new `nav.*` tokens pass `pnpm tokens:check`.
- **Legacy `/group/:shareCode` is byte-for-byte unchanged** (extraction is a pure move).
- Internal release note (`{ internal: true }`), no version bump.

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `goToTestStatic` / roster-toggle e2e bug lives in the heaviest extraction | Fix the selector/aria-label **as part of** Roster extraction; preserve any e2e test-ids. |
| `HEADER_EVENTS` untyped window-bus couples Header↔GroupView | Replace with props/context in the top-bar rebuild; verify no dead listeners / silent no-ops remain. |
| Legacy `?tab=` aliases broken by the 4-tab rename | Keep `pageModeFromTabParam`'s alias table intact; add a test asserting legacy values still resolve. |
| Token-debt trips `check:design-system:strict` | Fix `rgba()`/raw-`<button>`/sub-12px during the refine, not after. |
| Scope creep on NotificationBell (4 sources) + picker merge | Keep F6a to shell structure + navigation + affordances; defer notification content model and full week semantics to their slices. |
| Two shells to maintain until F6e | Accepted; the `/v2` gate isolates risk and each slice shrinks the legacy surface; delete legacy after parity. |

## 11. Key files

`frontend/src/App.tsx` (route mount ~`:164`) · `frontend/src/pages/GroupView.tsx` (tab switch ~`:1205–1490`, `rosterDndArea` ~`:840–918`) · `frontend/src/hooks/useGroupViewState.ts` (tab/URL state, alias table ~`:30–41`) · `frontend/src/components/layout/{AppRail,SidebarNav,Header,TabNavigation,ContextSwitcher,SettingsDockToggle}.tsx` · `frontend/src/components/ui/{ThemeToggle,KeyboardShortcutsHelp}.tsx` · `frontend/src/components/auth/NotificationCenter.tsx` · `frontend/tokens/{tokens,tokens.light}.json` · `design/redesign/DESIGN_SYSTEM.md` (§2.1/§2.3/§2.4/§3.8/§3.9/§4) · `design/redesign/specs/f5-screen-components-map.md` (shell-chrome element set).
