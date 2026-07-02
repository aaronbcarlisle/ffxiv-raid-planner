# Plan E — Polish Pass Batch 2 (catalog, overview nav, lodestone, player menu, availability)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eight independent polish/bug items: (1) catalog item banners, (2) Overview member-click highlights the player card, (3) Overview needed-gear tooltip + right-click, (4) Lodestone Sync fixes (search, Server dropdown, Search/URL tabs, gear sync, hide dev tip), (5) player-card menu reorganized into submenus, (6) Availability content-shift stabilization, (7) Availability clear/undo, (8) Availability floating hover tooltip with Alt-to-hide.

**Architecture:** Each section is self-contained and ships as its own commit/PR. Sections are ordered roughly easiest→hardest; no cross-section dependency except sections 6–8 all touch the two availability grids (`schedule/AvailabilityGrid.tsx`, `profile/PersonalAvailabilityEditor.tsx`) and should land in order 6 → 7 → 8 to avoid churn.

**Tech Stack:** React 19 + TS, Tailwind v4, Zustand, Radix primitives; FastAPI backend (lodestone); Vitest/@testing-library + pytest.

> **Line numbers below are from a point-in-time exploration — match on the code/strings, not the line numbers, and verify before editing.**

## Global Constraints

- NEVER add AI attribution to commits/PRs.
- Design system: use primitives/tokens; preserve existing `design-system-ignore` / eslint-disable comments in touched files; run `pnpm check:design-system`.
- "static" not "group" in user-facing copy.
- **Release/version — per `docs/superpowers/ROADMAP.md` (one coordinated rollout):** add release-note **entries** to `frontend/src/data/releaseNotes.ts` under the single rollout version **`2.0.0`** (bundle per section; public for user-facing with `description`/`pr`/`prTitle` + full ISO date; `internal: true` for non-visible). **Do NOT bump `CURRENT_VERSION`** — only the stack-base branch (Plan A) sets it. This supersedes any per-plan "bump `CURRENT_VERSION`" wording in the steps below.
- Pre-PR gate: `cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test`; backend changes also `cd backend && pytest tests/ -q`.

---

# Section 1 — Catalog item banners

**Diagnosis:** `CatalogItem` (`stores/collectionGoalStore.ts`) already has unused `iconUrl`/`imageUrl` fields (mapped from `icon_url`/`image_url` by `fromApiCatalogItem`). The Browse Catalog card is `components/collections/SourceFarmCard.tsx` (header ~lines 237–333). Banner asset pattern mirrors raid tiers: `public/images/raid-tiers/{id}.png` referenced as `/images/raid-tiers/...`. Curated fallback items live in `data/curatedCatalog.ts` (all set `imageUrl: null`).

## Task 1.1: Render a banner on `SourceFarmCard` when available

**Files:**
- Modify: `frontend/src/components/collections/SourceFarmCard.tsx`
- Modify: `frontend/src/utils/collectionSourceGrouping.ts` (surface a group-level `imageUrl`)
- Test: `frontend/src/components/collections/SourceFarmCard.test.tsx` (create if absent)

**Interfaces:**
- Produces: `SourceFarmGroup.imageUrl?: string | null` — first non-null reward `imageUrl`. `SourceFarmCard` renders a banner thumbnail when set, hidden on error.

- [ ] **Step 1: Aggregate `imageUrl` onto the group**

In `collectionSourceGrouping.ts`, add `imageUrl: string | null` to `SourceFarmGroup` and set it during grouping to the first reward's non-null `imageUrl` (`rewards.find(r => r.imageUrl)?.imageUrl ?? null`).

- [ ] **Step 2: Write the failing test**

```tsx
/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SourceFarmCard } from './SourceFarmCard';
// build a minimal SourceFarmGroup with imageUrl set; render and assert the banner img exists with that src.
it('renders a banner when the group has an imageUrl', () => {
  // ...construct group with imageUrl: '/images/catalog-rewards/ult-dmu.png'
  // render(<SourceFarmCard group={group} goalsByItemId={new Map()} ... />)
  const img = screen.getByRole('img', { hidden: true });
  expect(img).toHaveAttribute('src', '/images/catalog-rewards/ult-dmu.png');
});
```
(Mirror the prop shape `SourceFarmCard` actually requires — read its props first and construct the minimal group.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && pnpm test -- SourceFarmCard`
Expected: FAIL — no banner rendered.

- [ ] **Step 4: Add the banner to the card header**

In `SourceFarmCard.tsx`, just inside the header button's left panel (above the duty-name line), render when `group.imageUrl`:

```tsx
{group.imageUrl && (
  <div className="mb-2 -mt-1 overflow-hidden rounded-lg border border-border-subtle bg-surface-elevated">
    <img
      src={group.imageUrl}
      alt=""
      className="h-20 w-full object-cover"
      loading="lazy"
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  </div>
)}
```

(Match the `object-cover` + `onError`-hide pattern from `CreateSessionModal.tsx`. Keep it left-panel so the right token/dots column is unaffected.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && pnpm test -- SourceFarmCard`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/collections/SourceFarmCard.tsx frontend/src/utils/collectionSourceGrouping.ts frontend/src/components/collections/SourceFarmCard.test.tsx
git commit -m "feat(catalog): show a banner image on Browse Catalog cards when available"
```

## Task 1.2: Populate banners for curated catalog items + add assets

**Files:**
- Modify: `frontend/src/data/curatedCatalog.ts`
- Add: banner images under `frontend/public/images/catalog-rewards/`

- [ ] **Step 1: Add banner assets**

Place duty banners at `frontend/public/images/catalog-rewards/{sourceDutyKey}.png` (e.g. `ult-dmu.png` for Dancing Mad Ultimate). Use the `sourceDutyKey` already present in curated items as the filename. (Assets are provided/sourced separately; this step is the convention + file drop. If assets aren't ready, ship Task 1.1 alone — cards degrade gracefully with no banner.)

- [ ] **Step 2: Wire `imageUrl` in the curated factories**

In `curatedCatalog.ts`, set `imageUrl: \`/images/catalog-rewards/${sourceDutyKey}.png\`` in the item factory functions (where `sourceDutyKey` is known per item) so curated/offline items get banners too. Keep `null` where no asset exists.

- [ ] **Step 3: Verify + commit**

Run: `cd frontend && pnpm build`
```bash
git add frontend/src/data/curatedCatalog.ts frontend/public/images/catalog-rewards/
git commit -m "feat(catalog): banner assets + imageUrl for curated catalog items"
```

---

# Section 2 — Overview member click highlights the player card

**Diagnosis:** On Overview, `StaticHomeTab.tsx` member rows (`GroupHeroPanel` ~line 962, `RosterPresenceModule` ~line 1066) call `onNavigate('roster')`, which only switches tabs (`GroupView.tsx` ~1154). The working highlight path is `handleNavigateToPlayer` from `hooks/useViewNavigation.ts` (sets `pageMode('roster')` + `highlightedPlayerId` + `scrollIntoViewWhenReady` polling, auto-clears ~2500ms). `PlayerCard` applies the pulse via `isHighlighted` (~line 597).

## Task 2.1: Pass and use `onNavigateToPlayer` from Overview rows

**Files:**
- Modify: `frontend/src/pages/GroupView.tsx` (StaticHomeTab render ~1150)
- Modify: `frontend/src/components/static-group/StaticHomeTab.tsx` (props + the two row click handlers)

**Interfaces:**
- Consumes: `handleNavigateToPlayer(playerId: string)` from `useViewNavigation` (already constructed in GroupView for loot-entry navigation).
- Produces: `StaticHomeTab` gains `onNavigateToPlayer?: (playerId: string) => void`.

- [ ] **Step 1: Thread the prop**

In `GroupView.tsx`, pass `onNavigateToPlayer={handleNavigateToPlayer}` to `<StaticHomeTab>`. Add `onNavigateToPlayer?: (playerId: string) => void` to `StaticHomeTabProps`.

- [ ] **Step 2: Use it in the member rows**

In `StaticHomeTab.tsx`, in `GroupHeroPanel` and `RosterPresenceModule`, change the member row `onClick={() => onNavigate('roster')}` → `onClick={() => onNavigateToPlayer?.(p.id)}`. Keep a fallback to `onNavigate('roster')` if `onNavigateToPlayer` is undefined.

- [ ] **Step 3: Manual verification**

Run `./dev.ps1`. Overview → click a member: switches to Roster, the card scrolls into view and pulses (highlight clears after ~2.5s). Works for cards lower in the list (scroll-poll handles late mount).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/GroupView.tsx frontend/src/components/static-group/StaticHomeTab.tsx
git commit -m "fix(overview): clicking a member highlights and scrolls to their player card"
```

---

# Section 3 — Overview needed-gear tooltip + right-click

**Diagnosis:** Member rows render readiness text ("Ready / In prog. / Needs gear") via `playerGearReadiness(p)` (`StaticHomeTab.tsx` ~86–96). Slot completion is `isSlotComplete(status)` in `utils/calculations.ts` (~84–99). `ContextMenu` (`components/ui/ContextMenu.tsx`) and `Tooltip` (`components/primitives/Tooltip.tsx`) are reusable. `GearSlotStatus` carries `slot`/`hasItem`/`isAugmented`/`bisSource`.

## Task 3.1: `getNeededSlots` helper

**Files:**
- Modify: `frontend/src/utils/calculations.ts` (add helper near `isSlotComplete`)
- Test: `frontend/src/utils/calculations.test.ts` (add cases)

**Interfaces:**
- Produces: `getNeededSlots(player: SnapshotPlayer): { slots: GearSlot[]; count: number; summary: string }` — incomplete BiS slots, with a human label summary ("Head, Body, Ring 2" / "All gear ready").

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { getNeededSlots } from './calculations';
// build a SnapshotPlayer with a couple incomplete slots; assert count + summary text.
it('lists incomplete BiS slots with labels', () => {
  const player = /* ...gear with head incomplete, body complete... */;
  const r = getNeededSlots(player);
  expect(r.count).toBe(1);
  expect(r.summary).toContain('Head');
});
it('reports all ready when nothing is missing', () => {
  expect(getNeededSlots(/* all complete */).summary).toBe('All gear ready');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- calculations`
Expected: FAIL — `getNeededSlots` not exported.

- [ ] **Step 3: Implement**

```ts
const SLOT_LABELS: Record<GearSlot, string> = {
  weapon: 'Weapon', head: 'Head', body: 'Body', hands: 'Hands', legs: 'Legs',
  feet: 'Feet', earring: 'Earring', necklace: 'Necklace', bracelet: 'Bracelet',
  ring1: 'Ring 1', ring2: 'Ring 2',
};

export function getNeededSlots(player: SnapshotPlayer) {
  const slots = player.gear.filter(g => !isSlotComplete(g)).map(g => g.slot);
  const summary = slots.length === 0 ? 'All gear ready' : slots.map(s => SLOT_LABELS[s]).join(', ');
  return { slots, count: slots.length, summary };
}
```

- [ ] **Step 4: Run test to verify it passes** — `pnpm test -- calculations` → PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/calculations.ts frontend/src/utils/calculations.test.ts
git commit -m "feat(gear): getNeededSlots helper for needed-gear summaries"
```

## Task 3.2: Tooltip on the readiness text + right-click "needed gear" menu

**Files:**
- Modify: `frontend/src/components/static-group/StaticHomeTab.tsx`

- [ ] **Step 1: Wrap the readiness status text in a Tooltip**

For rows that are not fully ready, wrap the "In prog./Needs gear" text in `<Tooltip content={...}>` showing `getNeededSlots(p).summary` (e.g. "Still needs: Head, Body, Ring 2"). Skip the tooltip when `getNeededSlots(p).count === 0`.

- [ ] **Step 2: Add a right-click context menu on the row**

Add `onContextMenu` to the member row capturing `{x,y}` into local state, and render `<ContextMenu>` with items:
- "View needed gear" (header or disabled label showing the summary, `keepOpen`/disabled),
- "Go to player card" → `onNavigateToPlayer?.(p.id)` (reuses Section 2),
- "Copy needed slots" → `navigator.clipboard.writeText(getNeededSlots(p).summary)`.

Use the existing `ContextMenu` API (`x`, `y`, `items`, `onClose`) mirroring `PlayerCard`'s usage.

- [ ] **Step 3: Manual + commit**

Run `./dev.ps1`: hover the status → tooltip lists missing slots; right-click row → menu with the needed-gear summary + navigate/copy. 
```bash
git add frontend/src/components/static-group/StaticHomeTab.tsx
git commit -m "feat(overview): needed-gear tooltip and right-click menu on member rows"
```

---

# Section 4 — Lodestone Sync fixes

**Diagnosis (`components/player/LodestoneSearchModal.tsx`, `stores/lodestoneStore.ts`, `backend/app/routers/lodestone.py`):**
- Search: `GET /api/lodestone/search?name=&server=`. Live providers (Tomestone/XIVAPI) gate Tomestone on a non-empty `server`; failing live providers → 0 results + the red "Live character providers could not fetch" banner. Server is a free-text `<Input>` (~402–408) — typos/format break exact matching.
- Gear sync "unavailable": backend marks `identity_only=true` / `gear_available=false` when the provider returns no usable equipped gear; the modal then shows the amber "gear sync is unavailable" fallback.
- Dev tip "Local mock testing is off" shows when `!isProduction && !devStatus?.mockMode` (~386–393).
- Worlds data: `gamedata/worlds.ts` (`DC_NAMES`, `getWorldsForDC`) — same source `DiscoveryTab` uses.

## Task 4.1: Diagnose the live search + gear-sync failures (backend, no app code yet)

**Files:** Read `backend/app/routers/lodestone.py`; run the backend.

- [ ] **Step 1: Reproduce search against the live provider**

Start the backend. Hit the endpoint directly:
```bash
curl "http://localhost:8001/api/lodestone/search?name=Draaaron&server=Sargatanas"
curl "http://localhost:8001/api/lodestone/search?name=Draaaron"
```
Record the HTTP status + body for both (with and without `server`). Check backend logs (`.logs/`) for upstream errors (XIVAPI/Tomestone timeouts, 4xx/5xx, missing API token). Determine whether the failure is: (a) missing/expired provider API token/config, (b) provider endpoint/contract change, (c) `server` param required/mismatched, or (d) network egress blocked.

- [ ] **Step 2: Reproduce gear fetch**

```bash
curl "http://localhost:8001/api/lodestone/character/26213642"
```
Check whether `gear_available` is false because the provider returns no `GearSet.Gear`, vs an exception. Record the exact upstream behavior.

- [ ] **Step 3: Decide the fix path from evidence**

Write the finding at the top of the section's PR description. The fix is one of:
- **Config**: set/rotate the provider API token (e.g. `TOMESTONE_API_TOKEN`) and confirm `Settings` has the field (note: a stale extra `.env` key previously crashed startup — ensure the key is a real Settings field). Document the required env in `backend/.env.example`.
- **Provider contract**: update the request/response mapping in the provider fetch to the current upstream shape.
- **Param handling**: make `server` reliably forwarded/normalized (ties into Task 4.2's dropdown which guarantees a canonical world name).
Implement the identified fix with a backend test that exercises the search/gear path against a mocked provider response (mirror existing lodestone tests). Do not leave the bug as "unavailable" if it's our config/mapping.

- [ ] **Step 4: Commit (backend fix, if any)**

```bash
git add backend/app/routers/lodestone.py backend/.env.example backend/tests/
git commit -m "fix(lodestone): <root cause> so live search/gear fetch returns results"
```

## Task 4.2: Server field → DC-grouped World dropdown

**Files:**
- Modify: `frontend/src/components/player/LodestoneSearchModal.tsx`
- Modify: `frontend/src/stores/lodestoneStore.ts` (search already takes `server?`)

- [ ] **Step 1: Replace the free-text Server Input with two Selects**

Mirror `DiscoveryTab`: a Data Center `Select` (`DC_NAMES`) + a World `Select` (`getWorldsForDC(dc)`), the World value passed as `server`. Keep an "Any" option for searches that don't need a server (but encourage selecting one, since live providers match better with a canonical world). Import from `../../gamedata`.

- [ ] **Step 2: Pass the canonical world to search**

`searchCharacters(name, selectedWorld || undefined)` — the dropdown guarantees exact spelling/casing, removing the typo failure mode.

- [ ] **Step 3: Verify + commit**

Run `pnpm build`. Manual: pick DC → worlds populate → search returns results (assuming Task 4.1 fixed the provider).
```bash
git add frontend/src/components/player/LodestoneSearchModal.tsx
git commit -m "feat(lodestone): Server becomes a data-center/world dropdown"
```

## Task 4.3: Split the modal into "Search" and "Profile URL" tabs + hide the dev tip

**Files:**
- Modify: `frontend/src/components/player/LodestoneSearchModal.tsx`

- [ ] **Step 1: Add a two-tab switcher**

Add `const [method, setMethod] = useState<'search' | 'url'>('search')` and a segmented control (mirror `SettingsSubNav`/existing tab styling) at the top of the body: **Search character** | **Profile URL**.
- `search` tab: name + DC/World dropdowns + Search button + Search results list.
- `url` tab: the existing "Preview by URL/ID" input + button (moved out from under search).
- The "Linked character / Preview / Force refresh" row and the "Current equipped gear" preview column stay visible under both tabs (they're outcome panels, not method-specific).

- [ ] **Step 2: Hide the dev-only mock tip**

Remove (or gate behind an explicit `import.meta.env.DEV && false`) the `!isProduction && !devStatus?.mockMode` "Local mock testing is off" block (~386–393) so end users never see it. Keep the `devStatus?.mockMode` "mock is ON" banner (that one is informative when mock is actually active). Simplest: delete the off-state tip block.

- [ ] **Step 3: Verify + commit**

Run `pnpm build && pnpm test -- LodestoneSearchModal` (extend the existing test if present). Manual: tabs switch cleanly; URL flow only on the URL tab; no "Local mock testing is off" tip.
```bash
git add frontend/src/components/player/LodestoneSearchModal.tsx
git commit -m "feat(lodestone): Search/Profile-URL tabs and hide the dev mock tip"
```

> If Task 4.1 concludes the provider failure is external/un-fixable from our side, still ship 4.2 + 4.3 (UX wins) and make the failure banner clearer ("Lodestone provider is temporarily unavailable") rather than implying user error.

---

# Section 5 — Player-card menu reorganization (submenus)

**Diagnosis:** The flat 24-item menu is built in `PlayerCard.tsx` (~386–568) and rendered via `components/ui/ContextMenu.tsx` (flat-only; supports `sectionHeader`/`separator`, no nesting). The Radix `Dropdown` primitive (`components/primitives/Dropdown.tsx`) DOES support submenus (`DropdownSub`/`DropdownSubTrigger`/`DropdownSubContent`, used by `UserMenu`). The kebab also feeds a right-click `ContextMenu` at `{x,y}`.

**Decision:** Add **submenu support to the existing `ContextMenu`** rather than migrating the whole card to Radix — this keeps the right-click-at-coordinates behavior and the kebab both working, with the least churn. Group into a short top level + 3 submenus.

**Target structure (top level):**
- Update BiS ⭐ · Adjust Priority ⭐ · Mark as Sub/Main ⭐ · Copy Player ⭐
- ▸ **BiS & Gear** (Unlink BiS, BiS Target Sets, Lodestone Sync, Weapon Priorities, Edit Books, Reset Gear)
- ▸ **Clipboard** (Copy URL, Paste Player, Duplicate Player)
- ▸ **Manage** (Take/Release Ownership, Edit Flex roles, Assign User)
- ── separator ──
- Remove Player (danger)

## Task 5.1: Add submenu support to `ContextMenu`

**Files:**
- Modify: `frontend/src/components/ui/ContextMenu.tsx`
- Test: `frontend/src/components/ui/ContextMenu.test.tsx` (create if absent)

**Interfaces:**
- Produces: a new `ContextMenuItem` variant `{ submenu: string; items: ContextMenuItem[]; icon?; disabled? }` rendering a nested flyout (hover/click to open, chevron-right). Existing item/separator/sectionHeader variants unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu } from './ContextMenu';
it('opens a submenu and fires a nested item', () => {
  const onClick = vi.fn();
  render(<ContextMenu x={0} y={0} onClose={() => {}} items={[
    { submenu: 'BiS & Gear', items: [{ label: 'Reset Gear', onClick }] },
  ]} />);
  fireEvent.click(screen.getByText('BiS & Gear'));
  fireEvent.click(screen.getByText('Reset Gear'));
  expect(onClick).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails** — `pnpm test -- ContextMenu` → FAIL (no submenu support).

- [ ] **Step 3: Implement the submenu variant**

Add the `submenu` branch to the item renderer: a row with the label + a right chevron that, on hover/click, renders a nested positioned `ContextMenu`-style flyout to the right (flip left on viewport collision). Reuse the existing item rendering for the nested `items`. Keep keyboard support best-effort (Right/Left to enter/exit). Keep portal/positioning consistent with the current implementation.

- [ ] **Step 4: Run test to verify it passes** — PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/ContextMenu.tsx frontend/src/components/ui/ContextMenu.test.tsx
git commit -m "feat(ui): nested submenu support in ContextMenu"
```

## Task 5.2: Regroup the player-card menu

**Files:**
- Modify: `frontend/src/components/player/PlayerCard.tsx` (the `contextMenuItems` useMemo)

- [ ] **Step 1: Rebuild `contextMenuItems` into the target structure**

Keep every action + its existing permission gate, but nest per the target structure above using the new `submenu` variant. Frequently-used actions stay top-level; the rest go into BiS & Gear / Clipboard / Manage. Preserve `danger` on Remove Player and all `disabled`/`tooltip` gating. A submenu whose items are all gated out should not render (filter empties).

- [ ] **Step 2: Manual verification**

Run `./dev.ps1`. Open the ⋮ menu and right-click a card: short top-level list; submenus expand to the side; every action still works and respects role gating (member on own card, viewer read-only, etc.).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/player/PlayerCard.tsx
git commit -m "feat(player): reorganize the player-card menu into submenus"
```

---

# Section 6 — Availability content-shift stabilization

**Diagnosis (`schedule/AvailabilityGrid.tsx`, `schedule/availabilityUtils.ts`):**
- "Best raid windows" is a mode-conditional swap between two different-height components: `AvailabilityRecommendations` (this-week) vs `TemplateRecommendations` (typical-week) (~498–520). Switching unmounts/remounts → big vertical jump.
- Grid rows = `filterSlotsByPreset`: prime 16 / evening 16 / full 48 slots (+ dividers), so Full day ~3× height with no reserved space.
- `handlePresetChange('full')` calls `scrollIntoView({behavior:'smooth'})` on the 6 PM row (~364–374); no scroll back when leaving full → page stays scrolled.

## Task 6.1: Remove the auto-scroll on "Full day"

**Files:** Modify `frontend/src/components/schedule/AvailabilityGrid.tsx`

- [ ] **Step 1:** In `handlePresetChange`, delete the `if (next === 'full') { requestAnimationFrame(... scrollIntoView ...) }` block. Keep the preset set + localStorage write.
- [ ] **Step 2: Manual:** toggling Prime↔Evening↔Full no longer scrolls the page.
- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/schedule/AvailabilityGrid.tsx
git commit -m "fix(availability): stop auto-scrolling when switching to Full day"
```

## Task 6.2: Keep "Best raid windows" mounted across week modes

**Files:** Modify `frontend/src/components/schedule/AvailabilityGrid.tsx`

- [ ] **Step 1: Wrap the conditional recommendation panels in a min-height container**

Wrap the `mode === 'typical-week' ? <TemplateRecommendations/> : <AvailabilityRecommendations/>` in a stable wrapper with a reserved `min-h-[var(--rec-min-h)]` (or a Tailwind `min-h-[18rem]`) so the section below doesn't jump when the inner component swaps. Keep the section heading present in both modes. If `TemplateRecommendations` has an empty state ("No overlap found yet"), ensure it fills the reserved height rather than collapsing.

- [ ] **Step 2: Manual:** switching This week ↔ Typical week keeps the panel area the same height; content below stays put.
- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/schedule/AvailabilityGrid.tsx
git commit -m "fix(availability): reserve space for Best Raid Windows across week modes"
```

## Task 6.3: Contain the grid height so granularity changes don't reflow the page

**Files:** Modify `frontend/src/components/schedule/AvailabilityGrid.tsx` (and `profile/PersonalAvailabilityEditor.tsx` if it shares the symptom)

- [ ] **Step 1: Give the grid body a stable max-height + internal scroll**

Wrap the grid body (the rows container) with a `max-h-[60vh] overflow-y-auto` (tune the value) so Full day scrolls *within* the grid instead of growing the page. This makes Prime→Full a contained change, not a page reflow. Keep the day-header row sticky (`sticky top-0`) inside that scroll container so columns stay labeled.

- [ ] **Step 2: Manual:** Full day expands inside a scrollable grid; the surrounding page (legend, toggles) doesn't move; toggling back to Prime returns instantly with no page scroll.
- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/schedule/AvailabilityGrid.tsx frontend/src/components/profile/PersonalAvailabilityEditor.tsx
git commit -m "fix(availability): contain grid height so granularity toggles don't reflow the page"
```

---

## Task 6.4: Stop availability column cells shifting when the per-day counter appears

**Diagnosis:** Each day column header has a per-day selection **counter** badge (+ trash icon) that only renders once that day has selections. Its appearance changes the column header's width, which reflows the whole grid's column widths — cells visibly resize after the first selection (both `schedule/AvailabilityGrid.tsx` and `profile/PersonalAvailabilityEditor.tsx`, where the screenshot shows `Mon 9 🗑 / Tue 9 🗑 / …`).

**Files:** Modify `frontend/src/components/schedule/AvailabilityGrid.tsx` and `frontend/src/components/profile/PersonalAvailabilityEditor.tsx`

- [ ] **Step 1: Reserve the counter's space always**

Make the per-day header a fixed-width/grid layout so the counter+trash slot is **always reserved** whether or not there are selections — render the badge area at a constant width (e.g. a fixed `w-[...]` slot, or `visibility:hidden` placeholder with the same dimensions when count is 0) instead of conditionally adding the element. Ensure the columns use an equal-width track (`grid-cols-7` / fixed `flex-1 basis-0`) so a header change can't redistribute widths.

- [ ] **Step 2: Manual:** make a selection in one column → no column resizes; the counter appears in its reserved slot; clearing it leaves the layout unchanged.
- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/schedule/AvailabilityGrid.tsx frontend/src/components/profile/PersonalAvailabilityEditor.tsx
git commit -m "fix(availability): reserve the per-day counter slot so cells don't resize on selection"
```

---

# Section 7 — Availability clear/undo

**Diagnosis:** Neither grid has a clear/reset affordance; undoing means re-dragging each cell. Both grids: `schedule/AvailabilityGrid.tsx` and `profile/PersonalAvailabilityEditor.tsx`.

## Task 7.1: Clear controls on both grids

**Files:**
- Modify: `frontend/src/components/schedule/AvailabilityGrid.tsx`
- Modify: `frontend/src/components/profile/PersonalAvailabilityEditor.tsx`
- Modify: the relevant store(s) — `stores/availabilityStore.ts` and the personal availability state — to expose a clear action.

- [ ] **Step 1: Add store clear actions (write the failing test first)**

Add `clearDay(day)` and `clearAll()` (scoped to the active week/preset view as appropriate) to the availability state. Test (Vitest) that `clearAll()` empties the selection and `clearDay` empties only that day. Mirror the store's existing action/test patterns.

- [ ] **Step 2: Implement the actions** to satisfy the tests; ensure they mark state dirty/unsaved consistently with drag edits (so the existing Save flow persists the cleared state).

- [ ] **Step 3: Add UI affordances**

Near the "Drag to paint availability" toolbar, add a **Clear** control: a "Clear all" button (with the double-click-confirm pattern via `useDoubleClickConfirm`, since it's destructive) and a per-day clear (small ✕ on each day header — the Player Hub editor already shows per-day counts with a trash icon in the screenshot; wire that trash to `clearDay`). Both grids get a "Clear all" button.

- [ ] **Step 4: Manual + commit**

Run `./dev.ps1`: paint some cells, "Clear all" wipes them (after confirm); per-day ✕ clears one day; Save persists the cleared state.
```bash
git add frontend/src/components/schedule/AvailabilityGrid.tsx frontend/src/components/profile/PersonalAvailabilityEditor.tsx frontend/src/stores/availabilityStore.ts
git commit -m "feat(availability): clear-all and per-day clear on both availability grids"
```

---

# Section 8 — Availability floating hover tooltip (with Alt-to-hide)

**Diagnosis:** Hovering a populated slot replaces the bottom helper text ("Hover a populated slot to see who is available there") with the slot's detail, changing that element's size and shifting content (choppy). Desired: keep the bottom helper text stable; show a **floating tooltip anchored at the hovered cell** instead; **holding Alt** while hovering suppresses the floating tooltip.

## Task 8.1: Floating per-cell availability tooltip

**Files:**
- Modify: `frontend/src/components/schedule/AvailabilityGrid.tsx` (primary — it has the "who is available" detail)
- Modify: `frontend/src/components/profile/PersonalAvailabilityEditor.tsx` if it shares the bottom-detail pattern

**Interfaces:**
- A small floating panel positioned near the hovered cell (fixed/absolute at cursor or cell rect) showing the same content the bottom area used to swap in (e.g. "Thursday at 9:30 PM — 1 available · lloydcrescent"). The static bottom helper text stays unchanged.

- [ ] **Step 1: Keep the bottom helper text static**

Stop swapping the bottom "Hover a populated slot…" line with hovered-cell detail. Leave that line as a constant legend/hint.

- [ ] **Step 2: Add hovered-cell state + a floating panel**

On cell mouse-enter of a populated slot, capture the slot's data + the cell's bounding rect (or cursor `{x,y}`). Render a portaled floating panel (reuse `Tooltip` styling or a small absolutely-positioned card) near the cell with the availability detail. Clear on mouse-leave. Flip/clamp to viewport so it never clips off-screen. Throttle position updates with `requestAnimationFrame` for smoothness.

- [ ] **Step 3: Alt-to-hide**

Track Alt key state (keydown/keyup listeners, or read `e.altKey` on mouse-move). While Alt is held, suppress the floating panel (so users can inspect cells beneath it). Restore on Alt release.

- [ ] **Step 4: Manual verification**

Run `./dev.ps1`: hover a green (populated) cell → floating detail appears at the cell, bottom text doesn't move, no content shift. Move across cells → it follows smoothly. Hold Alt → floating panel hides; release → returns. Near the right/bottom edge it stays on-screen.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/schedule/AvailabilityGrid.tsx frontend/src/components/profile/PersonalAvailabilityEditor.tsx
git commit -m "feat(availability): floating per-cell hover tooltip with Alt-to-hide; stable bottom hint"
```

---

# Section 9 — Schedule sub-tab active-state reflow

**Diagnosis:** The Schedule sub-tabs (Sessions / Availability / Integrations) render as `<Button variant={isActive ? 'accent-subtle' : 'ghost'}>` (`schedule/ScheduleTab.tsx` ~460–476). The active vs inactive Button variants differ in box geometry (border width and/or font-weight), so the active tab's element changes size when selected → the whole tab row shifts/pops.

## Task 9.1: Equalize active/inactive tab geometry

**Files:**
- Modify: `frontend/src/components/schedule/ScheduleTab.tsx` (and/or `components/primitives/Button.tsx` variant definitions)

- [ ] **Step 1: Identify the geometry delta**

In `components/primitives/Button.tsx`, compare the `accent-subtle` and `ghost` variant classes. Find what differs in box size: a `border` present on one but not the other (1px reflow), different horizontal padding, or different `font-weight` (bold active vs normal inactive shifts text width). Record the exact delta.

- [ ] **Step 2: Make inactive reserve the same box**

Equalize so switching active doesn't change layout. Preferred approaches (pick per the delta found):
- If it's a **border**: give the inactive/ghost state a `border border-transparent` (same width, invisible) so both reserve 1px.
- If it's **font-weight**: use the same weight for both, or pre-reserve width (e.g. a `::after` ghost of the bold label, or set the label to the bold weight always and change only color/background for active).
- If it's **padding**: make padding identical across both variants.

Apply the fix at the tab usage site (e.g. add `className="border border-transparent"` to the inactive case) or in the Button variant definitions if it won't regress other Button users. Do NOT change other Button consumers' appearance — if editing the variant is risky, scope the fix to the ScheduleTab tab buttons via `className`.

- [ ] **Step 3: Manual verification**

Run `./dev.ps1` → Schedule. Click between Sessions / Availability / Integrations: the tab row and the labels/badges stay perfectly still — no pop or sub-pixel shift. Check the same pattern isn't duplicated elsewhere (the Recruitment/Goals sub-navs use `SettingsSubNav`; if they share the symptom, note as follow-up — out of scope here).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/schedule/ScheduleTab.tsx frontend/src/components/primitives/Button.tsx
git commit -m "fix(schedule): stop sub-tab row from shifting when switching active tab"
```

---

# Section 10 — Expanded-view tooltip mentions the collapse/expand-all behavior

**Diagnosis:** The Roster Members view-mode toggle is `components/ui/ViewModeToggle.tsx`. The "Expanded View" tooltip (~lines 44–54) currently reads *"Shows full gear table. Press V to toggle."* — it doesn't mention the newer behavior (re-clicking "Expanded" while already expanded toggles collapse-all / expand-all of the roster sections, wired via `expandAllSignal` in `GroupView.tsx` ~771–782).

## Task 10.1: Update the Expanded-view tooltip copy

**Files:**
- Modify: `frontend/src/components/ui/ViewModeToggle.tsx`

- [ ] **Step 1: Extend the tooltip description**

In the "Expanded View" tooltip content (~line 50–52), add a sentence about re-click behavior. Example:

```tsx
<div className="text-text-secondary text-xs mt-0.5">
  Shows full gear table. Press <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px]">V</kbd> to toggle.
  Click <span className="text-text-primary">Expanded</span> again to collapse or expand all groups.
</div>
```

Keep the `Compact View` tooltip unchanged. Verify the re-click behavior description matches the actual logic in `GroupView.tsx` (collapse-all if every section is expanded, otherwise expand-all).

- [ ] **Step 2: Verify + commit**

Run `cd frontend && pnpm build`. Hover the Expanded toggle → tooltip now explains the collapse/expand-all re-click.
```bash
git add frontend/src/components/ui/ViewModeToggle.tsx
git commit -m "docs(roster): mention collapse/expand-all in the Expanded view tooltip"
```

---

# Final — Release notes + full verification

**Files:** Modify `frontend/src/data/releaseNotes.ts`

- [ ] **Step 1: Add release entries**

Add public entries (or one grouped entry) covering: catalog banners, Overview member highlight, needed-gear tooltip/menu, Lodestone Sync improvements, player-card menu cleanup, the availability stability/clear/hover improvements, and the Schedule sub-tab reflow fix. Each with a `description`, `pr`, `prTitle`, full ISO date. Bump `CURRENT_VERSION`.

- [ ] **Step 2: Full gate**

```bash
cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test
cd ../backend && source venv/bin/activate && pytest tests/ -q   # if Section 4 backend touched
cd ../scripts && npm test
```
Expected: all pass.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/data/releaseNotes.ts
git commit -m "docs(release): polish pass batch 2"
```

---

## Self-review notes (already applied)

- **Sections are independent** and individually shippable; only 6→7→8 share the availability grids and should land in that order.
- **Bugs get diagnosis-first tasks** (Lodestone 4.1) rather than assuming a fix — the failure may be provider config/contract, which a plan can't pre-decide. UX wins (4.2/4.3) ship regardless.
- **Reuse over rebuild:** catalog uses the existing unused `imageUrl` field; overview highlight reuses `handleNavigateToPlayer`; needed-gear reuses `isSlotComplete`; server dropdown reuses `gamedata/worlds.ts`; menu submenus extend the existing `ContextMenu` (keeps right-click-at-coords) instead of a full Radix migration.
- **Availability fixes are layered:** stop the auto-scroll (6.1), reserve space (6.2), contain height (6.3) — each independently testable; clear/undo (7) and floating tooltip (8) are additive.
- **Both availability grids** (`schedule/AvailabilityGrid.tsx` + `profile/PersonalAvailabilityEditor.tsx`) are covered for clear/undo and the hover tooltip.
- **Line numbers are point-in-time** — every task says match on code/strings and verify.
```
