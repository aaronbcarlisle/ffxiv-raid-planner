# Plan B — Docked Settings Panel + Animated Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the static Settings panel dock to the right edge and push the header's right cluster left (instead of overlaying the header), so the gear icon stays visible and becomes a persistent open/close toggle with an animated gear → panel-close icon.

**Architecture:** Introduce a right-dock panel that renders below the header band and overlays only `<main>`. The global header sits above the panel in z-order and gains right padding equal to the panel width while open, sliding its right cluster (gear included) left of the panel edge. The settings open-state moves to a small shared signal so both the Header (gear icon) and the dock can read/toggle it.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, framer-motion, lucide-react (`Settings`, `PanelRightClose`), existing `header:settings` CustomEvent bus, Vitest + @testing-library/react.

> **Depends on Plan A only loosely** — Plan B touches the Header right cluster and the settings open flow. Land Plan A first to avoid churn in `Header.tsx`, but the two are functionally independent.

## Global Constraints

- Design system mandatory; use primitives/tokens; run `pnpm check:design-system`. Existing settings buttons use `/* eslint-disable design-system/no-raw-button */` — preserve.
- User-facing copy says "static", never "group".
- Mobile (`< sm`) is unchanged: on mobile the panel may remain a full overlay; the push/dock behavior is `sm:` and up.
- **Release/version — per `docs/superpowers/ROADMAP.md` (one coordinated rollout):** add release-note **entries** to `frontend/src/data/releaseNotes.ts` under the single rollout version **`2.0.0`** (public entry with `description`/`pr`/`prTitle` + full ISO date for user-facing; `internal: true` for non-visible). **Do NOT bump `CURRENT_VERSION`** — only the stack-base branch (Plan A) sets it. This supersedes any per-plan "bump `CURRENT_VERSION`" wording in the steps below.
- Pre-PR: `pnpm build` (tsc -b), `pnpm lint`, `pnpm check:design-system`, `pnpm test`.
- Preserve all existing `SettingsPanel` tabs/content and the `header:settings` / `header:open-settings-invitations` event contract.

---

## File Structure

- **Find current open-state owner first** (see Task 1) — the component that listens for `HEADER_EVENTS.SETTINGS` and renders `<SettingsPanel isOpen=...>` (likely `pages/GroupView.tsx`). This plan adds open/close *toggle* + dock layout there and in `Header.tsx`.
- **Create** `frontend/src/components/ui/RightDockPanel.tsx` — right-docked, header-aware panel container (does not cover the header band).
- **Create** `frontend/src/components/ui/RightDockPanel.test.tsx` — unit tests.
- **Create** `frontend/src/hooks/useSettingsPanel.ts` — tiny shared open-state + width signal (zustand or a context) so Header + dock owner agree.
- **Modify** `frontend/src/components/layout/Header.tsx` — gear becomes a toggle with animated icon, reads open-state, pads right cluster when open.
- **Modify** `frontend/src/pages/GroupView.tsx` (the settings owner) — render `SettingsPanel` inside `RightDockPanel`; toggle via shared signal; `Alt+G` toggles.
- **Modify** `frontend/src/components/settings/SettingsPanel.tsx` — accept rendering inside a dock (strip the `SlideOutPanel` chrome when docked, or add a `container` prop).
- **Modify** `frontend/src/data/releaseNotes.ts` — release note + version bump.

---

## Task 1: Locate the settings open-state owner (no code change)

**Files:**
- Read: `frontend/src/pages/GroupView.tsx`, `frontend/src/components/settings/SettingsPanel.tsx`

- [ ] **Step 1: Find who listens for the settings event and renders the panel**

Run: `cd frontend && grep -rn "HEADER_EVENTS.SETTINGS\|SettingsPanel\|header:settings\|setSettings" src`
Expected: identify the component holding `isOpen` for `SettingsPanel` (the "owner") and the `Alt+G` handler. Record the exact file + state variable names — later tasks modify them. If the owner is not `GroupView.tsx`, substitute the real path everywhere this plan says `GroupView.tsx`.

- [ ] **Step 2: Confirm the panel width**

Note the `SettingsPanel` `width="3xl"` → resolve the px/rem value from `SlideOutPanel`'s width map. Record it (call it `PANEL_WIDTH`, e.g. `480px`). Used for the header right-padding and dock width.

No commit (investigation only).

---

## Task 2: Shared settings-panel open signal

**Files:**
- Create: `frontend/src/hooks/useSettingsPanel.ts`
- Test: `frontend/src/hooks/useSettingsPanel.test.ts`

**Interfaces:**
- Produces: a zustand store hook `useSettingsPanel` with state `{ isOpen: boolean; initialTab?: string; open: (tab?: string) => void; close: () => void; toggle: (tab?: string) => void }`. Width is a module constant `SETTINGS_PANEL_WIDTH` (string, e.g. `'480px'`) exported alongside.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsPanel, SETTINGS_PANEL_WIDTH } from './useSettingsPanel';

describe('useSettingsPanel', () => {
  beforeEach(() => { useSettingsPanel.getState().close(); });

  it('opens and closes', () => {
    useSettingsPanel.getState().open('members');
    expect(useSettingsPanel.getState().isOpen).toBe(true);
    expect(useSettingsPanel.getState().initialTab).toBe('members');
    useSettingsPanel.getState().close();
    expect(useSettingsPanel.getState().isOpen).toBe(false);
  });

  it('toggle flips open state', () => {
    expect(useSettingsPanel.getState().isOpen).toBe(false);
    useSettingsPanel.getState().toggle();
    expect(useSettingsPanel.getState().isOpen).toBe(true);
    useSettingsPanel.getState().toggle();
    expect(useSettingsPanel.getState().isOpen).toBe(false);
  });

  it('exports a panel width', () => {
    expect(typeof SETTINGS_PANEL_WIDTH).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- useSettingsPanel`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store**

```ts
// frontend/src/hooks/useSettingsPanel.ts
import { create } from 'zustand';

export const SETTINGS_PANEL_WIDTH = '480px'; // matches SettingsPanel width="3xl"

interface SettingsPanelState {
  isOpen: boolean;
  initialTab?: string;
  open: (tab?: string) => void;
  close: () => void;
  toggle: (tab?: string) => void;
}

export const useSettingsPanel = create<SettingsPanelState>((set, get) => ({
  isOpen: false,
  initialTab: undefined,
  open: (tab) => set({ isOpen: true, initialTab: tab }),
  close: () => set({ isOpen: false }),
  toggle: (tab) => (get().isOpen ? set({ isOpen: false }) : set({ isOpen: true, initialTab: tab })),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test -- useSettingsPanel`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useSettingsPanel.ts frontend/src/hooks/useSettingsPanel.test.ts
git commit -m "feat(settings): shared open-state signal for the settings panel"
```

---

## Task 3: `RightDockPanel` container (header-aware, content-only overlay)

**Files:**
- Create: `frontend/src/components/ui/RightDockPanel.tsx`
- Test: `frontend/src/components/ui/RightDockPanel.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (width passed as prop).
- Produces: `RightDockPanel` props =
  `{ isOpen: boolean; onClose: () => void; width: string; title?: React.ReactNode; children: React.ReactNode }`.
  Renders a fixed right-edge column anchored below the header band (`top: var(--layout-chrome-header, 0)`), `z-30` (below the header's `z-40`), slides in/out with framer-motion, and an optional content-area backdrop (`z-20`, click → `onClose`). It must NOT cover the header.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RightDockPanel } from './RightDockPanel';

describe('RightDockPanel', () => {
  it('renders children when open', () => {
    render(<RightDockPanel isOpen onClose={vi.fn()} width="480px"><div>DOCK_BODY</div></RightDockPanel>);
    expect(screen.getByText('DOCK_BODY')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(<RightDockPanel isOpen={false} onClose={vi.fn()} width="480px"><div>DOCK_BODY</div></RightDockPanel>);
    expect(screen.queryByText('DOCK_BODY')).not.toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<RightDockPanel isOpen onClose={onClose} width="480px"><div>DOCK_BODY</div></RightDockPanel>);
    fireEvent.click(screen.getByTestId('rightdock-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- RightDockPanel`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the dock**

`--layout-chrome` exists in `index.css` (header + bottom-nav height). Use a header-height var for `top`; if a header-only var is absent, add `--layout-header-height` in `index.css` and reference it. Keep the panel below header z (header is `z-40`).

```tsx
// frontend/src/components/ui/RightDockPanel.tsx
import { AnimatePresence, motion } from 'framer-motion';

interface RightDockPanelProps {
  isOpen: boolean;
  onClose: () => void;
  width: string;
  title?: React.ReactNode;
  children: React.ReactNode;
}

export function RightDockPanel({ isOpen, onClose, width, title, children }: RightDockPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop over content only (below header z-40, below panel) */}
          <motion.div
            data-testid="rightdock-backdrop"
            className="fixed inset-x-0 bottom-0 z-20 bg-black/40"
            style={{ top: 'var(--layout-header-height, 56px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          {/* Docked panel */}
          <motion.aside
            role="dialog" aria-label="Static settings"
            className="fixed right-0 bottom-0 z-30 bg-surface-raised border-l border-border-default shadow-2xl flex flex-col"
            style={{ top: 'var(--layout-header-height, 56px)', width, maxWidth: '100vw' }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {title && (
              <div className="flex items-center justify-between px-4 h-12 border-b border-border-default flex-shrink-0">
                <div className="font-semibold text-text-primary">{title}</div>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Add `--layout-header-height` if missing**

Run: `cd frontend && grep -n "layout-header-height\|layout-chrome" src/index.css`
If `--layout-header-height` is absent, add it next to `--layout-chrome` with the header's height (match the `Header` `py-2` + content → measure; use the same value the sticky header occupies, e.g. `56px`). Keep `RightDockPanel`'s fallback in sync.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && pnpm test -- RightDockPanel`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/RightDockPanel.tsx frontend/src/components/ui/RightDockPanel.test.tsx frontend/src/index.css
git commit -m "feat(ui): add header-aware RightDockPanel"
```

---

## Task 4: Render SettingsPanel inside the dock; wire the shared signal + Alt+G toggle

**Files:**
- Modify: `frontend/src/pages/GroupView.tsx` (the settings owner from Task 1)
- Modify: `frontend/src/components/settings/SettingsPanel.tsx`

**Interfaces:**
- Consumes: `useSettingsPanel` + `SETTINGS_PANEL_WIDTH` (Task 2), `RightDockPanel` (Task 3).
- Produces: `SettingsPanel` gains an optional `container?: 'slideout' | 'dock'` prop (default `'slideout'`). When `'dock'`, it renders its tabs+content **without** the `SlideOutPanel` wrapper (the dock provides chrome), preserving all tab logic.

- [ ] **Step 1: Add the `container` prop to SettingsPanel**

In `SettingsPanel.tsx`, extract the inner tabs+content (everything currently inside `<SlideOutPanel>`) into a local `PanelBody` and branch:

```tsx
const body = (
  <div className="flex flex-col h-full">
    {/* existing tabs + content JSX, unchanged */}
  </div>
);
if (container === 'dock') return body;
return (
  <SlideOutPanel isOpen={isOpen} onClose={onClose} title={/* existing */} width="3xl">
    {body}
  </SlideOutPanel>
);
```

Add `container?: 'slideout' | 'dock'` to `SettingsPanelProps` (default `'slideout'`). Keep `isOpen`/`onClose` semantics; in dock mode `isOpen` is handled by the dock, but keep the prop for the slideout path. Adjust the inner height wrapper (currently `h-[calc(100%+2rem)] -m-4`) so dock mode fills the dock without the slideout's negative margins — use `h-full` in dock mode.

- [ ] **Step 2: Wire the owner (GroupView) to the dock + shared signal**

Replace the local `SettingsPanel` `isOpen` state with `useSettingsPanel`. The existing `HEADER_EVENTS.SETTINGS` listener calls `open(detail?.tab)`; `OPEN_SETTINGS_INVITATIONS` calls `open('recruitment')`. Render:

```tsx
import { RightDockPanel } from '../components/ui/RightDockPanel';
import { useSettingsPanel, SETTINGS_PANEL_WIDTH } from '../hooks/useSettingsPanel';
// ...
const { isOpen: settingsOpen, initialTab, close: closeSettings } = useSettingsPanel();
// ...
<RightDockPanel
  isOpen={settingsOpen && !!currentGroup && groupPermission.allowed}
  onClose={closeSettings}
  width={SETTINGS_PANEL_WIDTH}
  title={<span className="flex items-center gap-2"><Settings className="w-5 h-5" />Static Settings</span>}
>
  {currentGroup && (
    <SettingsPanel
      container="dock"
      isOpen={settingsOpen}
      onClose={closeSettings}
      group={currentGroup}
      players={players}
      tierId={currentTier?.tierId}
      isAdmin={isAdminAccess}
      initialTab={(initialTab as SettingsTab) ?? 'general'}
    />
  )}
</RightDockPanel>
```

Keep mobile behavior: below `sm`, you may keep using the old `SlideOutPanel` path (full overlay) — gate the dock with a `sm:`-only media check (`useDevice().isSmallScreen ? <SlideOutPanel-path> : <RightDockPanel-path>`), or render the dock at full width on mobile. Simplest: on `isSmallScreen`, render `SettingsPanel` in its original `SlideOutPanel` mode (`container="slideout"`).

- [ ] **Step 3: Make Alt+G toggle (open AND close)**

Find the `Alt+G` shortcut (in `useKeyboardShortcuts`/`useGlobalKeyboardShortcuts` or GroupView). Change its handler from `open()` to `useSettingsPanel.getState().toggle()` so the same key closes the panel.

- [ ] **Step 4: Manual verification**

Run `./dev.ps1`. On a static page as owner/lead: click gear → panel docks on the right, header stays visible and its right cluster shifts left of the panel (Task 5 supplies the padding — until then the gear may overlap; that's expected and fixed next). Press `Alt+G` → toggles closed. Backdrop click → closes. Switch to mobile width → old overlay behavior.

- [ ] **Step 5: Run gate + commit**

Run: `cd frontend && pnpm test && pnpm lint`
Expected: PASS.

```bash
git add frontend/src/pages/GroupView.tsx frontend/src/components/settings/SettingsPanel.tsx
git commit -m "feat(settings): dock the settings panel and toggle via shared signal + Alt+G"
```

---

## Task 5: Header — gear toggle, animated icon, push right cluster left when open

**Files:**
- Modify: `frontend/src/components/layout/Header.tsx`
- Test: `frontend/src/components/layout/Header.settings.test.tsx` (create)

**Interfaces:**
- Consumes: `useSettingsPanel` (Task 2).
- Produces: the gear icon button toggles `useSettingsPanel`; shows `Settings` when closed and `PanelRightClose` when open (crossfade); the header inner row gets right padding `= SETTINGS_PANEL_WIDTH` on `sm:` when open; `aria-expanded`/`aria-pressed` reflect state.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useSettingsPanel } from '../../hooks/useSettingsPanel';

// store mocks as in Header.avatar.test.tsx, with a group route + owner role so the gear shows
vi.mock('../auth', () => ({ UserMenu: () => <div>U</div>, LoginButton: () => <div>login</div> }));
vi.mock('../../stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u1', isAdmin: false }, isLoading: false }), useAuthHydrated: () => true }));
vi.mock('../../stores/staticGroupStore', () => ({ useStaticGroupStore: () => ({ currentGroup: { id: 'g1', name: 'S', userRole: 'owner' }, groups: [], fetchGroups: vi.fn() }) }));
vi.mock('../../stores/tierStore', () => ({ useTierStore: () => ({ tiers: [], currentTier: null }) }));
vi.mock('../../stores/viewAsStore', () => ({ useViewAsStore: () => ({ viewAsUser: null }) }));
vi.mock('../../stores/invitationStore', () => ({ useInvitationStore: () => ({ invitations: [], fetchInvitations: vi.fn() }) }));
vi.mock('../../stores/joinRequestStore', () => ({ useJoinRequestStore: Object.assign(() => 0, { getState: () => ({ fetchGroupRequests: vi.fn() }) }) }));

import { Header } from './Header';

describe('Header settings toggle', () => {
  it('toggles the settings panel open-state when the gear is clicked', () => {
    useSettingsPanel.getState().close();
    render(<MemoryRouter initialEntries={['/group/abc']}><Header /></MemoryRouter>);
    fireEvent.click(screen.getByLabelText(/static settings/i));
    expect(useSettingsPanel.getState().isOpen).toBe(true);
    fireEvent.click(screen.getByLabelText(/static settings/i));
    expect(useSettingsPanel.getState().isOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- Header.settings`
Expected: FAIL — gear currently dispatches a CustomEvent, doesn't flip `useSettingsPanel`.

- [ ] **Step 3: Rewire the gear to the shared toggle + animate icon**

Import `useSettingsPanel`, `SETTINGS_PANEL_WIDTH`, and `PanelRightClose` from lucide. Replace the gear `onClick` to call `toggle(pendingJoinRequests > 0 ? 'recruitment' : undefined)`. Swap the icon by open-state with a crossfade and reflect state:

```tsx
const { isOpen: settingsOpen, toggle: toggleSettings } = useSettingsPanel();
// ...icon button:
<IconButton
  icon={settingsOpen ? <PanelRightClose className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
  onClick={() => toggleSettings(pendingJoinRequests > 0 ? 'recruitment' : undefined)}
  variant="ghost"
  aria-label="Static settings"
  aria-expanded={settingsOpen}
  aria-pressed={settingsOpen}
/>
```

(For a true crossfade, wrap both icons in `AnimatePresence`/`motion.span` with opacity; the conditional swap above is the minimum and acceptable.)

- [ ] **Step 4: Pad the header right cluster when open**

Apply right padding to the header inner row on `sm:` when `settingsOpen`, so the right cluster slides left of the dock. Use an inline style keyed off the width constant (Tailwind can't read the runtime constant):

```tsx
<div
  className="max-w-[160rem] mx-auto px-2 sm:px-4 py-2 flex ..."
  style={settingsOpen ? { paddingRight: `calc(${SETTINGS_PANEL_WIDTH} + 1rem)` } : undefined}
>
```

Guard for mobile: only apply on `sm:`+ (the dock is overlay on mobile). Read `useDevice().isSmallScreen` and skip the padding when small. Add a `transition-[padding] duration-200` class so it animates with the panel.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && pnpm test -- Header.settings`
Expected: PASS.

- [ ] **Step 6: Manual verification**

Run `./dev.ps1`. Open settings via gear: header stays fully visible, right cluster (gear/links/theme) slides left of the panel, gear shows the panel-close glyph. Click gear again or `Alt+G` → closes, padding releases, icon reverts to gear. No header occlusion at the panel's left edge.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/layout/Header.tsx frontend/src/components/layout/Header.settings.test.tsx
git commit -m "feat(layout): gear toggles docked settings, animates, and pushes header right cluster"
```

---

## Task 6: Release notes + full verification

**Files:**
- Modify: `frontend/src/data/releaseNotes.ts`

- [ ] **Step 1: Add a public release entry and bump version**

Add a top entry, `category: 'improvement'`, title e.g. "Settings panel docks alongside the app", `description`: "Static settings now slide in from the right without covering the header — the gear icon stays put as an open/close toggle and animates to show the panel is open." Include `pr`, `prTitle`, full ISO date. Bump `CURRENT_VERSION` and match the entry version.

- [ ] **Step 2: Run the full gate**

Run:
```bash
cd frontend
pnpm build
pnpm lint
pnpm check:design-system
pnpm test
```
Expected: all pass.

- [ ] **Step 3: Scripts changelog test**

Run: `cd scripts && npm test`
Expected: PASS — version consistency.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/data/releaseNotes.ts
git commit -m "docs(release): docked settings panel + animated toggle"
```

---

## Self-review notes (already applied)

- **Spec coverage:** B1 (dock/push)→Tasks 3,4,5; B2 (toggle + animated icon + Alt+G)→Tasks 2,5 (icon) & 4 (Alt+G). Header-stays-visible→Task 5 padding.
- **Open-state ownership:** centralized in `useSettingsPanel` (Task 2) so Header and the dock owner never disagree — avoids the CustomEvent-only one-way open.
- **Mobile:** explicitly falls back to the existing `SlideOutPanel` overlay (Task 4 Step 2); push/padding gated to `sm:`+ (Task 5 Step 4).
- **Header z-order:** dock is `z-30`, header `z-40` (unchanged) → header renders above the panel, which is what keeps the gear clickable.
- **Width single-sourced:** `SETTINGS_PANEL_WIDTH` constant used by dock width AND header padding so they can't drift.
- **Task 1 is investigation** to confirm the real owner file before edits — substitute the path if it isn't `GroupView.tsx`.
```
