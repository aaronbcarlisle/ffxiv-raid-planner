# Plan D — Listing Builder Sub-Tabs (DiscoveryTab navigation redesign)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long single-scroll Listing builder (6 stacked sections + a non-sticky jump-nav) with sticky **sub-tabs** — one section visible at a time, completion dots per tab — while keeping the live preview + completion checklist always reachable. The Save footer and all save/validation logic are unchanged.

**Architecture:** `DiscoveryTab` already holds all six sections' state in the parent and serializes everything on Save. We add a `useUrlTabState('lsec', …)` section selector, render only the active `SectionBlock`, replace the scroll-jump nav (and its refs) with a sticky sub-nav carrying per-section completion dots, and make the preview/checklist a persistent collapsible drawer below `xl` (right column at `xl`, as today).

**Tech Stack:** React 19 + TS, Tailwind v4, `useUrlTabState`, Vitest/@testing-library.

> **Relationship to other plans:** independent of A/B/C, but touches `DiscoveryTab` which renders inside the (Plan C) role-aware Settings panel and (Plan B) docked panel. No ordering dependency; can land any time. Members never reach this (Recruitment is managers-only per Plan C), so no read-only work is needed here.

## Global Constraints

- NEVER add AI attribution to commits/PRs.
- Design system: this file already uses `/* eslint-disable design-system/no-raw-button */` + `design-system-ignore` for its chips/cards — preserve that pattern for the new nav buttons. Run `pnpm check:design-system`.
- "static" not "group" in user-facing copy.
- **Release/version — per `docs/superpowers/ROADMAP.md` (one coordinated rollout):** add release-note **entries** to `frontend/src/data/releaseNotes.ts` under the single rollout version **`2.0.0`** (public entry with `description`/`pr`/`prTitle` + full ISO date for user-facing; `internal: true` for non-visible). **Do NOT bump `CURRENT_VERSION`** — only the stack-base branch (Plan A) sets it. This supersedes any per-plan "bump `CURRENT_VERSION`" wording in the steps below.
- Pre-PR: `cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test`.
- Do not change save/validation (`handleSave`), the preview component, or the checklist logic — only how sections are navigated/presented.

---

## File Structure

- **Modify** `frontend/src/components/settings/DiscoveryTab.tsx` — section sub-tab state, sticky sub-nav with dots, render-active-only, responsive preview drawer; remove `refs`/`scrollTo`.
- **Modify** `frontend/src/components/settings/DiscoveryTab.test.tsx` — add nav tests.

---

## Task 1: Section sub-tab navigation + completion dots

**Files:**
- Modify: `frontend/src/components/settings/DiscoveryTab.tsx`
- Test: `frontend/src/components/settings/DiscoveryTab.test.tsx`

**Interfaces:**
- Consumes: `useUrlTabState` (`'lsec'` param, values `SECTION_IDS`, default `'status'`, `{ history: 'replace' }`).
- Produces: only the active section's `SectionBlock` is mounted; a sticky `SectionSubNav` with a filled dot per completed section.

- [ ] **Step 1: Write the failing test**

Extend `DiscoveryTab.test.tsx`. Mirror the existing mocks at the top of that file (`useStaticGroupStore`, `toast`, `authRequest`, and the `makeGroup` helper). Render inside a `MemoryRouter` (required by `useUrlTabState`).

```tsx
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiscoveryTab } from './DiscoveryTab';

function renderTab(group = makeGroup({ isPublic: true })) {
  return render(<MemoryRouter><DiscoveryTab group={group} onClose={() => {}} /></MemoryRouter>);
}

describe('DiscoveryTab section sub-tabs', () => {
  it('shows only the Status section by default (About fields hidden)', () => {
    renderTab();
    expect(screen.getByText('List in Static Finder')).toBeInTheDocument(); // Status section control
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument(); // About section hidden
  });

  it('switches to the About section when its sub-tab is clicked', () => {
    renderTab();
    fireEvent.click(screen.getByRole('tab', { name: /About/i }));
    expect(screen.getByPlaceholderText(/Tell recruits about your static/i)).toBeInTheDocument();
    expect(screen.queryByText('List in Static Finder')).not.toBeInTheDocument(); // Status now hidden
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- DiscoveryTab`
Expected: FAIL — today all sections render at once, so both assertions about hidden sections fail.

- [ ] **Step 3: Add the section selector + completion map**

Near the top of the component body (after state), add:

```tsx
import { useUrlTabState } from '../../hooks/useUrlTabState';
// ...
const [section, setSection] = useUrlTabState('lsec', SECTION_IDS, 'status', { history: 'replace' });
```

Add a per-section completion map derived from the same signals the checklist uses (place after the `checklist` array so the booleans are in scope):

```tsx
const sectionDone: Record<SectionId, boolean> = {
  status:     enabled && recruitmentStatus !== 'closed',
  about:      description.length > 0,
  schedule:   scheduleDays.length > 0 && !!scheduleStartTime,
  recruiting: recruitingRoles.length > 0,
  comms:      selectedLangs.length > 0 || !!communicationStyle.voiceRequirement,
  contact:    !!(contactMethod && contactValue),
};
```

- [ ] **Step 4: Replace the jump-nav with a sticky sub-nav (with dots)**

Replace the existing section-nav block (the `<div ... role="navigation">` mapping `SECTION_IDS` to scroll buttons, ~lines 951–963) with a sticky tablist. Delete the `refs` object and the `scrollTo` function (no longer used).

```tsx
{/* Section sub-nav — sticky, render-active-only, completion dots */}
<div
  role="tablist"
  aria-label="Listing sections"
  className="sticky top-0 z-10 -mx-1 px-1 py-1 flex gap-1 overflow-x-auto scrollbar-none bg-surface-raised/95 backdrop-blur supports-[backdrop-filter]:bg-surface-raised/80"
>
  {SECTION_IDS.map(id => {
    const active = section === id;
    return (
      /* design-system-ignore: settings section tab with active underline + completion dot */
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => setSection(id)}
        className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
          active
            ? 'bg-accent/15 text-accent border-accent/40'
            : 'bg-surface-elevated text-text-secondary border-border-default hover:text-text-primary hover:border-border-subtle'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            sectionDone[id] ? 'bg-status-success' : active ? 'bg-accent/50' : 'bg-border-default'
          }`}
          aria-hidden
        />
        {SECTION_LABELS[id]}
      </button>
    );
  })}
</div>
```

- [ ] **Step 5: Render only the active section**

Wrap each of the six `<SectionBlock ...>` renders so only the active one mounts. The `SectionBlock` `innerRef` prop is now unused — drop it from the component and the call sites (or leave the prop optional and stop passing it). Example:

```tsx
{section === 'status' && (
  <SectionBlock id="status" title="Status">
    {/* ...existing Status content unchanged... */}
  </SectionBlock>
)}
{section === 'about' && (
  <SectionBlock id="about" title="About">
    {/* ...existing About content unchanged... */}
  </SectionBlock>
)}
{/* ...schedule, recruiting, comms, contact the same way... */}
```

Update `SectionBlock`'s signature to drop `innerRef` (and the `ref={innerRef}` usage); keep `id`/`title`/`children`. The outer left column keeps `space-y-7` — with one section visible the spacing is now between the sticky nav and the section only.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && pnpm test -- DiscoveryTab`
Expected: PASS (existing tests + the 2 new ones).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/settings/DiscoveryTab.tsx frontend/src/components/settings/DiscoveryTab.test.tsx
git commit -m "feat(recruitment): Listing builder sections become sticky sub-tabs with completion dots"
```

---

## Task 2: Persistent, collapsible preview drawer below `xl`

**Files:**
- Modify: `frontend/src/components/settings/DiscoveryTab.tsx`

**Interfaces:**
- The `xl` right column (`ListingPreview` + `CompletionChecklist`) is unchanged. Below `xl`, the existing mobile toggle becomes a **persistent drawer pinned above the Save footer** so the live preview is always one tap away regardless of scroll position / active section.

- [ ] **Step 1: Move the `< xl` preview out of the scroll area into a pinned drawer**

Today the `xl:hidden` preview toggle (lines ~966–985) lives at the top of the scrolling left column, so it scrolls away. Relocate that toggle + its expandable content into a `flex-shrink-0` block placed **between** the scroll body (`</div>` closing the two-column grid, ~line 1269) and the Save footer (~line 1271), wrapped in `xl:hidden`:

```tsx
{/* Pinned preview drawer (below xl) — always reachable above the footer */}
<div className="xl:hidden flex-shrink-0 border-t border-border-default">
  {/* design-system-ignore */}
  <button
    type="button"
    onClick={() => setShowMobilePreview(v => !v)}
    className="w-full flex items-center justify-between px-4 py-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
  >
    <span className="flex items-center gap-1.5">
      <Eye className="w-3.5 h-3.5" />
      {showMobilePreview ? 'Hide Preview & Checklist' : 'View Preview & Checklist'}
    </span>
    {showMobilePreview ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
  </button>
  {showMobilePreview && (
    <div className="px-4 pb-3 space-y-3 max-h-[40vh] overflow-y-auto">
      <ListingPreview {...previewProps} />
      <CompletionChecklist items={checklist} enabled={enabled} />
    </div>
  )}
</div>
```

Remove the old in-scroll `xl:hidden` toggle block so the preview isn't rendered twice.

- [ ] **Step 2: Manual verification**

Run `./dev.ps1`. In the Recruitment → Listing tab: section sub-tabs switch instantly with no scroll; completion dots fill as fields are completed; the sticky nav stays put. Narrow the panel below `xl`: the "Preview & Checklist" drawer sits just above Cancel/Save and toggles open without losing your place. Wide (`xl`+): preview stays in the right column. Save still persists all sections regardless of which sub-tab is active.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/settings/DiscoveryTab.tsx
git commit -m "feat(recruitment): pin the Listing preview/checklist drawer above the footer below xl"
```

---

## Task 3: Pop-out the Listing builder to a wide modal

**Files:**
- Modify: `frontend/src/components/settings/DiscoveryTab.tsx`

**Interfaces:**
- An "Expand" toggle renders the **same** `DiscoveryTab` body inside a wide `Modal` when expanded, and inline (in the settings panel) when collapsed. State is preserved because it is the **same component instance** — only the wrapper changes.

- [ ] **Step 1: Add the expanded state + icons**

```tsx
import { Maximize2, Minimize2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
// ...in the component:
const [expanded, setExpanded] = useState(false);
```

- [ ] **Step 2: Extract the builder body into a variable**

Pull the existing returned JSX (the outer `<div className="flex flex-col flex-1 min-h-0">…</div>` containing the scroll body, the pinned drawer, and the sticky footer) into a `const builder = (…);`. Add the Expand toggle into the sticky section sub-nav row (Task 1) so it's always visible:

```tsx
{/* trailing expand toggle, inside the sticky tablist row, pushed right */}
<span className="ml-auto flex-shrink-0 pl-1">
  <IconButton
    icon={expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
    onClick={() => setExpanded(v => !v)}
    variant="ghost"
    size="sm"
    aria-label={expanded ? 'Collapse listing editor' : 'Expand listing editor'}
  />
</span>
```

(Make the tablist row `items-center` so the toggle aligns; the tabs keep `overflow-x-auto`, the toggle stays pinned right outside the scroll region — wrap tabs in their own `overflow-x-auto` span and keep the toggle as a sibling so it doesn't scroll away.)

- [ ] **Step 3: Swap the wrapper based on `expanded`**

```tsx
if (expanded) {
  return (
    <Modal
      isOpen
      onClose={() => setExpanded(false)}
      title={<span className="flex items-center gap-2"><Globe className="w-5 h-5" />Edit Listing</span>}
      size="xl"   // widest available; if a wider size is needed, add one to Modal's size map
    >
      <div className="h-[80vh] flex flex-col">{builder}</div>
    </Modal>
  );
}
return builder;
```

Notes:
- Confirm `Modal`'s `size` map in `components/ui/Modal.tsx`. If the largest size is still cramped for the two-column layout, add a `'5xl'`/`'6xl'` entry (e.g. `max-w-5xl`) rather than forcing width inline.
- In the modal, the two-column grid's `xl:` right preview column shows because the viewport is `xl`+ — the form + preview now sit comfortably side-by-side.
- **Close semantics:** the Modal's X/backdrop calls `setExpanded(false)` → returns to the in-panel view (edits preserved). The builder's footer **Cancel** still calls `onClose` (closes Settings) and **Save** still saves — unchanged. This is intentional: "collapse" ≠ "cancel".

- [ ] **Step 4: Add a test for pop-out state preservation**

```tsx
it('keeps the description when toggling expand on and off', () => {
  renderTab();
  fireEvent.click(screen.getByRole('tab', { name: /About/i }));
  const desc = screen.getByPlaceholderText(/Tell recruits about your static/i);
  fireEvent.change(desc, { target: { value: 'Chill reclear static' } });
  fireEvent.click(screen.getByLabelText(/expand listing editor/i));
  // still mounted in the modal with the same value
  expect(screen.getByDisplayValue('Chill reclear static')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/collapse listing editor/i));
  expect(screen.getByDisplayValue('Chill reclear static')).toBeInTheDocument();
});
```

- [ ] **Step 5: Run tests + manual check**

Run: `cd frontend && pnpm test -- DiscoveryTab`
Expected: PASS. Manual: click Expand → builder opens in a wide centered modal with form + preview side-by-side; edits made in the panel are present; collapse → back in the panel with edits intact; Save works from both.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/settings/DiscoveryTab.tsx frontend/src/components/settings/DiscoveryTab.test.tsx
git commit -m "feat(recruitment): pop the Listing builder out to a wide modal"
```

---

## Task 4: Release notes + verification

**Files:**
- Modify: `frontend/src/data/releaseNotes.ts`

- [ ] **Step 1: Add a public release entry + bump version**

`category: 'improvement'`, title "Easier Static Finder listing editor", description: "The listing builder now uses section tabs with completion dots instead of one long scrolling form, so jumping between Status, Schedule, Recruiting and the rest is instant — with the live preview always a tap away." Include `pr`, `prTitle`, full ISO date. Bump `CURRENT_VERSION`; match the entry version.

- [ ] **Step 2: Full gate**

```bash
cd frontend && pnpm build && pnpm lint && pnpm check:design-system && pnpm test
```
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/data/releaseNotes.ts
git commit -m "docs(release): Listing builder sub-tab navigation"
```

---

## Self-review notes (already applied)

- **Save untouched:** all six sections' state lives in the parent and `handleSave` serializes everything; rendering one section at a time does not drop data — only mounted inputs change, state persists.
- **Refs removed:** the `refs`/`scrollTo` scroll-jump mechanism is deleted; `SectionBlock.innerRef` is dropped.
- **Completion dots** reuse the same booleans as the `checklist` (single source of truth) so the dots and the checklist never disagree.
- **Preview preserved:** right column at `xl` unchanged; below `xl` it becomes a persistent pinned drawer (was a scroll-away toggle) so it's always reachable — directly addressing the "kept the live preview" requirement.
- **Default section:** `'status'` (the natural first step, and the omitted URL default to keep links clean).
- **Role scope:** Recruitment is managers-only (Plan C), so no read-only variant is needed in this builder.
- **Pop-out (Task 3):** scoped to the Listing builder only (the one two-column tab) — a single component instance whose wrapper swaps inline ⇄ Modal, so state is preserved without sync. Generalizing "expand any settings tab" is intentionally deferred (other tabs are single-column and don't need it).
```
