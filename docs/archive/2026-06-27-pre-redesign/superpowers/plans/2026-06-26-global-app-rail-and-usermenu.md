# Plan A — Global App Rail + User-Menu Relocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the two duplicated sidebars into one shared `AppRail` shell, move the user menu into the rail's bottom (opening upward), add a Static Finder header segment, and turn the Plugin footer into a nav item.

**Architecture:** Extract the chrome shared by `SidebarNav` and Player Hub's `ProfileSidebarNav` into `components/layout/AppRail.tsx` (identity header + caller-supplied nav items + pinned `UserMenu` footer). Each context renders `AppRail` with its own items. The Header hides its desktop avatar exactly when the rail is present (`user || isGroupRoute`); mobile and signed-out-home behavior is untouched.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, framer-motion (`motion`/`LayoutGroup`), Radix dropdown primitives, Vitest + @testing-library/react.

## Global Constraints

- Design system mandatory: no raw `<button>/<input>/<select>`; use primitives from `components/primitives` and `components/ui`. Sidebar nav buttons already carry `/* eslint-disable design-system/no-raw-button */` + `design-system-ignore` comments — preserve that pattern. Run `pnpm check:design-system`.
- Semantic color tokens only (`text-accent`, `text-text-secondary`, etc.). No hardcoded hex except the existing rail gradient/active-state styles being moved verbatim.
- User-facing copy says "static", never "group".
- Mobile (`< sm`) is unchanged: rail stays `hidden sm:flex`; header keeps the mobile user menu; bottom nav untouched.
- **Release/version — stack base, per `docs/superpowers/ROADMAP.md`:** Plan A is the FIRST overhaul branch in the stack, so it **sets `CURRENT_VERSION` to the rollout version `2.0.0`** and adds the first public entry (`description`/`pr`/`prTitle`, full ISO 8601 date). Every later plan adds entries under `2.0.0` **without re-bumping**.
- Pre-PR: `pnpm build` (runs `tsc -b`, stricter than `tsc --noEmit`), `pnpm lint`, `pnpm check:design-system`, `pnpm test`.
- Rail collapse widths/keys behavior stays identical except where this plan explicitly unifies them.

---

## File Structure

- **Create** `frontend/src/components/layout/AppRail.tsx` — shared rail shell (identity header, nav list, collapse, user-menu footer).
- **Create** `frontend/src/components/layout/AppRail.test.tsx` — unit tests.
- **Create** `frontend/src/components/layout/railTypes.ts` — `RailNavItem` type shared by callers.
- **Modify** `frontend/src/components/layout/SidebarNav.tsx` — become a thin caller of `AppRail` (static items + Plugin nav item).
- **Modify** `frontend/src/pages/Profile.tsx` — replace inline `ProfileSidebarNav` body with an `AppRail` caller.
- **Modify** `frontend/src/components/layout/ContextSwitcher.tsx` — add Static Finder segment; drop redundant dropdown item.
- **Modify** `frontend/src/components/layout/ContextSwitcher.test.tsx` (create if absent) — segment tests.
- **Modify** `frontend/src/components/layout/Header.tsx` — remove Globe link; hide desktop avatar when rail present.
- **Modify** `frontend/src/components/auth/UserMenu.tsx` — support `side="top"` placement + a rail-footer trigger variant.
- **Modify** `frontend/src/data/releaseNotes.ts` — release note + version bump.

---

## Task 1: `RailNavItem` type + `AppRail` shell with identity header and nav list

**Files:**
- Create: `frontend/src/components/layout/railTypes.ts`
- Create: `frontend/src/components/layout/AppRail.tsx`
- Test: `frontend/src/components/layout/AppRail.test.tsx`

**Interfaces:**
- Produces: `RailNavItem` =
  `{ id: string; label: string; description: string; shortcut?: string; icon: React.FC<{ size?: number; className?: string }>; isActive: boolean; onSelect: () => void }`
- Produces: `AppRail` props =
  `{ context: string; identity: { icon: React.FC<{ size?: number; className?: string }>; label: string }; items: RailNavItem[]; collapseKey: string; footer?: React.ReactNode }`
- The active-state visuals reuse `layoutId={`sidebar-${context}-active-bg`}` / `...-active-bar` and `LayoutGroup id={`sidebar-${context}-nav`}` so two rails on different routes never collide.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Shield } from 'lucide-react';
import { AppRail } from './AppRail';
import type { RailNavItem } from './railTypes';

function makeItems(onSelect = vi.fn()): RailNavItem[] {
  return [
    { id: 'overview', label: 'Overview', description: 'd', icon: Shield, isActive: true, onSelect },
    { id: 'roster', label: 'Roster', description: 'd', icon: Shield, isActive: false, onSelect },
  ];
}

describe('AppRail', () => {
  it('renders identity label and all nav items', () => {
    render(
      <AppRail context="static" identity={{ icon: Shield, label: 'My Static' }}
        items={makeItems()} collapseKey="test-rail-collapsed" />
    );
    expect(screen.getByText('My Static')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Roster')).toBeInTheDocument();
  });

  it('calls onSelect when a nav item is clicked', () => {
    const onSelect = vi.fn();
    render(
      <AppRail context="static" identity={{ icon: Shield, label: 'My Static' }}
        items={makeItems(onSelect)} collapseKey="test-rail-collapsed" />
    );
    fireEvent.click(screen.getByText('Roster'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders the footer node', () => {
    render(
      <AppRail context="static" identity={{ icon: Shield, label: 'My Static' }}
        items={makeItems()} collapseKey="test-rail-collapsed"
        footer={<div>FOOTER</div>} />
    );
    expect(screen.getByText('FOOTER')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- AppRail`
Expected: FAIL — `Cannot find module './AppRail'`.

- [ ] **Step 3: Create the type file**

```ts
// frontend/src/components/layout/railTypes.ts
import type React from 'react';

export interface RailNavItem {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  icon: React.FC<{ size?: number; className?: string }>;
  isActive: boolean;
  onSelect: () => void;
}
```

- [ ] **Step 4: Implement `AppRail`**

Port the markup verbatim from `SidebarNav.tsx` (identity header + collapse toggle + nav list with `LayoutGroup`/`motion` active bg+bar + tooltips), parameterising context, identity, items, collapseKey, and footer. Keep `hidden sm:flex`, the gradient `style`, widths 208/56, and the localStorage collapse pattern.

```tsx
/* eslint-disable design-system/no-raw-button */
// frontend/src/components/layout/AppRail.tsx
import { useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip } from '../primitives';
import type { RailNavItem } from './railTypes';

interface AppRailProps {
  context: string;
  identity: { icon: React.FC<{ size?: number; className?: string }>; label: string };
  items: RailNavItem[];
  collapseKey: string;
  footer?: React.ReactNode;
}

export function AppRail({ context, identity, items, collapseKey, footer }: AppRailProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(collapseKey) === 'true'; } catch { return false; }
  });
  const toggle = () => setCollapsed(prev => {
    const next = !prev;
    try { localStorage.setItem(collapseKey, String(next)); } catch { /* ignore */ }
    return next;
  });

  const IdentityIcon = identity.icon;

  return (
    <motion.nav
      aria-label="Application navigation"
      className="hidden sm:flex flex-col flex-shrink-0 border-r border-border-subtle overflow-x-hidden overflow-y-auto"
      style={{
        background: 'linear-gradient(180deg, #0c0c14 0%, #090910 60%, #07070e 100%)',
        width: collapsed ? 56 : 208,
        minWidth: collapsed ? 56 : 208,
      }}
      variants={{ expanded: { width: 208, minWidth: 208 }, collapsed: { width: 56, minWidth: 56 } }}
      animate={collapsed ? 'collapsed' : 'expanded'}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Identity header + collapse toggle */}
      <div className="flex items-center h-12 border-b border-border-subtle flex-shrink-0" style={{ background: 'rgba(20,184,166,0.045)' }}>
        {collapsed ? (
          <button type="button" onClick={toggle} aria-label="Expand sidebar"
            className="w-full h-full flex items-center justify-center text-text-muted hover:text-accent transition-colors">
            <ChevronRight size={14} />
          </button>
        ) : (
          <>
            <div className="flex items-center flex-1 min-w-0 px-3 gap-2.5">
              <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(20,184,166,0.18)', boxShadow: '0 0 0 1px rgba(20,184,166,0.2)' }}>
                <IdentityIcon size={12} className="text-accent" />
              </div>
              <span className="text-xs font-semibold text-accent truncate font-display tracking-wide leading-none" title={identity.label}>
                {identity.label}
              </span>
            </div>
            <button type="button" onClick={toggle} aria-label="Collapse sidebar"
              className="flex-shrink-0 px-2.5 h-full flex items-center text-text-muted hover:text-accent transition-colors border-l border-border-subtle">
              <ChevronLeft size={13} />
            </button>
          </>
        )}
      </div>

      {/* Nav items */}
      <LayoutGroup id={`sidebar-${context}-nav`}>
        <div className="flex flex-col py-2 flex-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id}>
                <Tooltip
                  content={
                    <div className="max-w-[200px]">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-text-primary text-sm">{item.label}</span>
                        {item.shortcut && (
                          <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border-subtle bg-surface-base text-text-muted font-mono leading-none flex-shrink-0">
                            {item.shortcut}
                          </kbd>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">{item.description}</p>
                    </div>
                  }
                  side="right" sideOffset={collapsed ? 12 : 16} delayDuration={collapsed ? 200 : 700}
                >
                  {/* design-system-ignore: Sidebar nav requires custom active state styling */}
                  <button
                    onClick={item.onSelect}
                    aria-current={item.isActive ? 'page' : undefined}
                    className={`relative flex items-center w-full py-2.5 text-sm font-medium text-left transition-colors duration-150 select-none ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} ${item.isActive ? 'text-accent' : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.035]'}`}
                  >
                    {item.isActive && (
                      <motion.span layoutId={`sidebar-${context}-active-bg`} className="absolute inset-0 pointer-events-none"
                        style={{ background: 'rgba(20,184,166,0.09)', boxShadow: 'inset 0 0 32px rgba(20,184,166,0.1)' }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }} />
                    )}
                    {item.isActive && (
                      <motion.span layoutId={`sidebar-${context}-active-bar`} className="absolute inset-y-0 left-0 w-[2.5px] rounded-r pointer-events-none"
                        style={{ background: 'linear-gradient(180deg, rgba(20,184,166,0.3) 0%, var(--color-accent) 50%, rgba(20,184,166,0.3) 100%)', boxShadow: '0 0 8px 2px rgba(20,184,166,0.35)' }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }} />
                    )}
                    <Icon size={15} className="flex-shrink-0 relative z-10" />
                    {!collapsed && <span className="leading-none relative z-10 whitespace-nowrap">{item.label}</span>}
                  </button>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </LayoutGroup>

      {/* Footer (user menu) */}
      {footer && <div className="border-t border-border-subtle flex-shrink-0">{footer}</div>}
    </motion.nav>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && pnpm test -- AppRail`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/railTypes.ts frontend/src/components/layout/AppRail.tsx frontend/src/components/layout/AppRail.test.tsx
git commit -m "feat(layout): add shared AppRail shell"
```

---

## Task 2: User-menu rail-footer variant (upward open)

**Files:**
- Modify: `frontend/src/components/auth/UserMenu.tsx`
- Test: `frontend/src/components/auth/UserMenu.railfooter.test.tsx` (create)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `UserMenu` accepts `variant?: 'header' | 'rail'` (default `'header'`) and `collapsed?: boolean`. `variant='rail'` renders a full-width trigger (avatar + name + chevron when `!collapsed`, avatar only when `collapsed`) and opens the dropdown with `side="top"`.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserMenu } from './UserMenu';

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'u1', discordId: '123456789', discordUsername: 'tester', displayName: 'Tester', isAdmin: false, activityDisplayMode: 'named' },
    logout: vi.fn(), updatePreferences: vi.fn(),
  }),
}));
vi.mock('../../stores/notificationStore', () => ({
  useNotificationStore: () => ({ unreadCount: 0, fetchNotifications: vi.fn() }),
}));

describe('UserMenu rail variant', () => {
  it('shows the display name when rail variant is expanded', () => {
    render(<MemoryRouter><UserMenu variant="rail" collapsed={false} /></MemoryRouter>);
    expect(screen.getByText('Tester')).toBeInTheDocument();
  });

  it('hides the display name when rail variant is collapsed', () => {
    render(<MemoryRouter><UserMenu variant="rail" collapsed /></MemoryRouter>);
    expect(screen.queryByText('Tester')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- UserMenu.railfooter`
Expected: FAIL — `variant`/`collapsed` not honored (name renders in both, or prop type error).

- [ ] **Step 3: Add the variant**

In `UserMenu.tsx`: extend props to `{ className?: string; variant?: 'header' | 'rail'; collapsed?: boolean }`. Keep the existing header trigger for `variant='header'`. For `variant='rail'`, render a full-width trigger button (avatar + name + chevron, name/chevron gated on `!collapsed`) and pass `side="top"` to `DropdownContent`. Keep all existing menu items and modals identical.

```tsx
export function UserMenu({ className = '', variant = 'header', collapsed = false }: UserMenuProps) {
  // ...existing hooks/state unchanged...
  const isRail = variant === 'rail';
  return (
    <>
    <Dropdown>
      <DropdownTrigger>
        {/* design-system-ignore - Radix DropdownTrigger requires native button with asChild */}
        {/* a11y-exception: avatar border provides focus indicator */}
        <button
          className={isRail
            ? `flex items-center gap-2.5 w-full py-2.5 ${collapsed ? 'justify-center px-0' : 'px-3'} hover:bg-white/[0.035] transition-colors ${className}`
            : `flex items-center gap-2 p-1 rounded-full hover:bg-surface-interactive transition-colors focus:outline-none ${className}`}
          aria-label={`User menu for ${displayName}`}
        >
          <span className="relative">
            <img src={avatarUrl} alt={displayName} className="w-8 h-8 rounded-full border-2 border-accent/50" />
            {totalBadge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-status-error text-[9px] font-bold text-white flex items-center justify-center leading-none">
                {totalBadge > 9 ? '9+' : totalBadge}
              </span>
            )}
          </span>
          {isRail && !collapsed && (
            <span className="flex-1 min-w-0 text-left">
              <span className="block text-sm font-medium text-text-primary truncate">{displayName}</span>
            </span>
          )}
          {(!isRail || !collapsed) && (
            <svg className="w-4 h-4 text-text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRail ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
            </svg>
          )}
        </button>
      </DropdownTrigger>
      <DropdownContent align={isRail ? 'start' : 'end'} side={isRail ? 'top' : 'bottom'} className="w-48">
        {/* ...existing menu items unchanged... */}
      </DropdownContent>
    </Dropdown>
    {/* ...existing modals unchanged... */}
    </>
  );
}
```

Confirm `DropdownContent` forwards a `side` prop to Radix `DropdownMenu.Content` (it wraps `@radix-ui/react-dropdown-menu`). If it does not, add `side` passthrough in `components/primitives` Dropdown content wrapper.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm test -- UserMenu`
Expected: PASS (new tests + existing `UserMenuThemeToggle` test still green).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/auth/UserMenu.tsx frontend/src/components/auth/UserMenu.railfooter.test.tsx
git commit -m "feat(auth): add rail-footer UserMenu variant that opens upward"
```

---

## Task 3: Refactor static `SidebarNav` onto `AppRail` + Plugin nav item + user-menu footer

**Files:**
- Modify: `frontend/src/components/layout/SidebarNav.tsx`
- Test: `frontend/src/components/layout/SidebarNav.test.tsx` (create)

**Interfaces:**
- Consumes: `AppRail` (Task 1), `RailNavItem` (Task 1), `UserMenu` rail variant (Task 2).
- Produces: `SidebarNav` keeps its existing props `{ activeTab: PageMode; onTabChange: (tab: PageMode) => void; staticName?: string }` — callers in `GroupView` are unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SidebarNav } from './SidebarNav';

vi.mock('../../services/analytics', () => ({ analytics: { track: vi.fn() } }));
vi.mock('../auth', () => ({ UserMenu: () => <div>USER_MENU</div> }));

describe('SidebarNav', () => {
  it('renders a Plugin nav item immediately before More', () => {
    render(<MemoryRouter><SidebarNav activeTab="overview" onTabChange={vi.fn()} staticName="X" /></MemoryRouter>);
    const labels = screen.getAllByText(/Overview|Schedule|Roster|Goals & Farms|Gear & Sync|Plugin|More/).map(n => n.textContent);
    expect(labels).toContain('Plugin');
    expect(labels.indexOf('Plugin')).toBeLessThan(labels.indexOf('More'));
  });

  it('renders the user menu in the footer', () => {
    render(<MemoryRouter><SidebarNav activeTab="overview" onTabChange={vi.fn()} staticName="X" /></MemoryRouter>);
    expect(screen.getByText('USER_MENU')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- SidebarNav`
Expected: FAIL — no Plugin item / no footer user menu (current file has a Plugin footer button, not a nav item, and no user menu).

- [ ] **Step 3: Rewrite `SidebarNav` as an `AppRail` caller**

Replace the whole component body. Map `NAV_ITEMS` (add a `plugin` entry just before `more`) to `RailNavItem[]`, render `AppRail` with `context="static"`, identity `{ icon: Shield, label: staticName ?? 'Static' }`, `collapseKey="sidebar-collapsed"`, and `footer={<UserMenu variant="rail" collapsed={collapsed} />}`. Keep the `analytics.track` call inside each item's `onSelect`.

```tsx
import { LayoutDashboard, Calendar, Users, Trophy, Shield, MoreHorizontal, PlugZap } from 'lucide-react';
import type { PageMode } from '../../types';
import { analytics } from '../../services/analytics';
import { UserMenu } from '../auth';
import { AppRail } from './AppRail';
import type { RailNavItem } from './railTypes';

interface SidebarNavProps {
  activeTab: PageMode;
  onTabChange: (tab: PageMode) => void;
  staticName?: string;
}

const NAV_DEFS: Array<{ id: PageMode; label: string; description: string; shortcut?: string; icon: RailNavItem['icon'] }> = [
  { id: 'overview', label: 'Overview',      description: 'Static overview, next raid, and pending applications', shortcut: '`', icon: LayoutDashboard },
  { id: 'schedule', label: 'Schedule',      description: 'Upcoming sessions, availability, and Discord sync',    shortcut: '1', icon: Calendar },
  { id: 'roster',   label: 'Roster',        description: 'Member list, roles, and join requests',                shortcut: '2', icon: Users },
  { id: 'goals',    label: 'Goals & Farms', description: 'Farm goals, mount drops, and clear tracking',          shortcut: '3', icon: Trophy },
  { id: 'gear',     label: 'Gear & Sync',   description: 'BiS sets, gear sync, and loot history',                shortcut: '4', icon: Shield },
  { id: 'more',     label: 'More',          description: 'Integrations, settings, and tools',                                   icon: MoreHorizontal },
];

// Note: AppRail doesn't render the `more` divider. Keep "Plugin" + "More" grouped at the end
// by inserting Plugin directly before More in the item list.
export function SidebarNav({ activeTab, onTabChange, staticName }: SidebarNavProps) {
  const [collapsed] = [false]; // AppRail owns collapse internally; this is only for footer sizing.
  // The footer needs to know collapsed state — read it from AppRail by lifting collapse.
  // Simpler: keep collapse inside AppRail and pass a render-prop footer. See Step 3b.
  const select = (id: PageMode) => { analytics.track('navigation', 'sidebar_switch', { tab: id }); onTabChange(id); };
  const items: RailNavItem[] = [
    ...NAV_DEFS.filter(d => d.id !== 'more').map(d => ({ ...d, isActive: activeTab === d.id, onSelect: () => select(d.id) })),
    { id: 'plugin' as PageMode, label: 'Plugin', description: 'Dalamud plugin: sync gear and character data', icon: PlugZap, isActive: false, onSelect: () => { analytics.track('navigation', 'sidebar_plugin'); onTabChange('more'); } },
    { id: 'more', label: 'More', description: 'Integrations, settings, and tools', icon: MoreHorizontal, isActive: activeTab === 'more', onSelect: () => select('more') },
  ];
  return (
    <AppRail context="static" identity={{ icon: Shield, label: staticName ?? 'Static' }}
      collapseKey="sidebar-collapsed" items={items}
      footer={<UserMenu variant="rail" collapsed={collapsed} />} />
  );
}
```

- [ ] **Step 3b: Make the footer collapse-aware via a render-prop footer**

The footer needs the live `collapsed` state that `AppRail` owns. Change `AppRail`'s `footer` prop to also accept a render function `((collapsed: boolean) => React.ReactNode)`, and have `AppRail` call it with its internal `collapsed`. Update Task 1's `footer` type to `React.ReactNode | ((collapsed: boolean) => React.ReactNode)` and in the footer render: `typeof footer === 'function' ? footer(collapsed) : footer`. Then in `SidebarNav` pass `footer={(collapsed) => <UserMenu variant="rail" collapsed={collapsed} />}` and delete the placeholder `const [collapsed] = [false]` line.

```tsx
// AppRail.tsx footer render:
{footer && (
  <div className="border-t border-border-subtle flex-shrink-0">
    {typeof footer === 'function' ? footer(collapsed) : footer}
  </div>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm test -- SidebarNav AppRail`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/SidebarNav.tsx frontend/src/components/layout/SidebarNav.test.tsx frontend/src/components/layout/AppRail.tsx
git commit -m "refactor(layout): SidebarNav uses AppRail; Plugin becomes a nav item; user menu in footer"
```

---

## Task 4: Refactor Player Hub `ProfileSidebarNav` onto `AppRail`

**Files:**
- Modify: `frontend/src/pages/Profile.tsx` (replace `ProfileSidebarNav` body ~lines 60–259)

**Interfaces:**
- Consumes: `AppRail` (Task 1), `UserMenu` rail variant (Task 2).
- Produces: `ProfileSidebarNav` keeps its existing props `{ activeTab: ProfileTab; onTabChange; characterName? }` so the `Profile` render at ~line 520 is unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
// add to a new frontend/src/pages/Profile.rail.test.tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileSidebarNav } from './Profile';

vi.mock('../auth', () => ({ UserMenu: () => <div>USER_MENU</div> }));

describe('ProfileSidebarNav', () => {
  it('renders Player Hub items and the user-menu footer', () => {
    render(<MemoryRouter><ProfileSidebarNav activeTab="overview" onTabChange={vi.fn()} characterName="Hero" /></MemoryRouter>);
    expect(screen.getByText('Jobs & Gear')).toBeInTheDocument();
    expect(screen.getByText('USER_MENU')).toBeInTheDocument();
  });
});
```

Export `ProfileSidebarNav` from `Profile.tsx` (add `export` to the function) so the test can import it.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- Profile.rail`
Expected: FAIL — `ProfileSidebarNav` not exported / no `USER_MENU` footer.

- [ ] **Step 3: Rewrite `ProfileSidebarNav` as an `AppRail` caller**

Keep `PROFILE_NAV_ITEMS`. Map to `RailNavItem[]` (all `isActive: activeTab === id`, `onSelect: () => onTabChange(id)`). Render `AppRail` with `context="profile"`, identity `{ icon: User, label: characterName ?? 'Player Hub' }`, `collapseKey="profile-sidebar-collapsed"`, `footer={(collapsed) => <UserMenu variant="rail" collapsed={collapsed} />}`. Delete the inline identity/collapse/footer markup and the Plugin footer button (Player Hub keeps plugin via its "Sync & Gear" item).

```tsx
import { AppRail } from '../components/layout/AppRail';
import type { RailNavItem } from '../components/layout/railTypes';
import { UserMenu } from '../components/auth';
import { User } from 'lucide-react';

export function ProfileSidebarNav({ activeTab, onTabChange, characterName }: {
  activeTab: ProfileTab; onTabChange: (tab: ProfileTab) => void; characterName?: string;
}) {
  const items: RailNavItem[] = PROFILE_NAV_ITEMS.map(d => ({
    ...d, isActive: activeTab === d.id, onSelect: () => onTabChange(d.id),
  }));
  return (
    <AppRail context="profile" identity={{ icon: User, label: characterName ?? 'Player Hub' }}
      collapseKey="profile-sidebar-collapsed" items={items}
      footer={(collapsed) => <UserMenu variant="rail" collapsed={collapsed} />} />
  );
}
```

Remove now-unused imports in `Profile.tsx` (`motion`, `LayoutGroup`, `ChevronLeft/Right`, `PlugZap`, `Tooltip` if unused elsewhere). Run lint to confirm.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm test -- Profile.rail`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Profile.tsx frontend/src/pages/Profile.rail.test.tsx
git commit -m "refactor(profile): Player Hub rail uses AppRail with user-menu footer"
```

---

## Task 5: ContextSwitcher — add Static Finder segment, drop redundant items

**Files:**
- Modify: `frontend/src/components/layout/ContextSwitcher.tsx`
- Test: `frontend/src/components/layout/ContextSwitcher.test.tsx` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: ContextSwitcher renders three segments: Player Hub (`/profile`), Static Finder (`/discover`), Static (`/group/...` with ▾). Static Finder is `aria-current` on `/discover`.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContextSwitcher } from './ContextSwitcher';

function renderAt(path: string, props = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ContextSwitcher currentGroup={null} groups={[]} onFetchGroups={vi.fn()} isMember={false} {...props} />
    </MemoryRouter>
  );
}

describe('ContextSwitcher', () => {
  it('renders a Static Finder segment linking to /discover', () => {
    renderAt('/profile');
    const finder = screen.getByText('Static Finder').closest('a');
    expect(finder).toHaveAttribute('href', '/discover');
  });

  it('marks Static Finder active on /discover', () => {
    renderAt('/discover');
    expect(screen.getByText('Static Finder').closest('a')).toHaveAttribute('aria-current', 'page');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- ContextSwitcher`
Expected: FAIL — no "Static Finder" text (current fallback says "Find a static" only when no statics).

- [ ] **Step 3: Add the permanent Static Finder segment**

Insert a Static Finder segment between the Player Hub segment and the Static segment. Compute `onFinder = location.pathname.startsWith('/discover')`. Use the existing `segBase/segActive/segIdle` classes and a `Users` icon. Remove the old no-statics fallback link that rendered "Find a static" (the Static segment now shows muted/disabled when `targetStatic` is null), and remove the "Find a static" `DropdownItem` from the Static dropdown.

```tsx
{/* Static Finder segment */}
<span className="w-px h-4 bg-border-subtle flex-shrink-0" aria-hidden />
<Tooltip content="Static Finder — browse and join open statics">
  <Link to="/discover" className={`${segBase} ${onFinder ? segActive : segIdle} flex-shrink-0`} aria-current={onFinder ? 'page' : undefined}>
    <Users className="w-4 h-4 flex-shrink-0" />
    <span className="hidden sm:inline">Static Finder</span>
  </Link>
</Tooltip>
<span className="w-px h-4 bg-border-subtle flex-shrink-0" aria-hidden />

{/* Static segment */}
{targetStatic ? (
  /* ...existing static segment, minus the "Find a static" DropdownItem... */
) : (
  <span className={`${segBase} ${segIdle} opacity-60 cursor-default`} title="No statics yet">
    <Shield className="w-4 h-4 flex-shrink-0" />
    <span className="hidden sm:inline">No static</span>
  </span>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm test -- ContextSwitcher`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/ContextSwitcher.tsx frontend/src/components/layout/ContextSwitcher.test.tsx
git commit -m "feat(layout): add Static Finder segment to ContextSwitcher"
```

---

## Task 6: Header — remove Globe link, hide desktop avatar when rail present

**Files:**
- Modify: `frontend/src/components/layout/Header.tsx`
- Test: `frontend/src/components/layout/Header.avatar.test.tsx` (create)

**Interfaces:**
- Consumes: the rail-present condition `railPresent = !!user || isGroupRoute` (both already derived in Header).
- Produces: header right cluster no longer renders the Globe "Find a static" link; the `UserMenu` renders only when `!railPresent` OR on mobile (`sm:hidden` wrapper).

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../auth', () => ({ UserMenu: () => <div data-testid="header-usermenu">U</div>, LoginButton: () => <div>login</div> }));
// minimal store mocks: signed-in user, not a group route
vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1', isAdmin: false }, isLoading: false }),
  useAuthHydrated: () => true,
}));
vi.mock('../../stores/staticGroupStore', () => ({ useStaticGroupStore: () => ({ currentGroup: null, groups: [], fetchGroups: vi.fn() }) }));
vi.mock('../../stores/tierStore', () => ({ useTierStore: () => ({ tiers: [], currentTier: null }) }));
vi.mock('../../stores/viewAsStore', () => ({ useViewAsStore: () => ({ viewAsUser: null }) }));
vi.mock('../../stores/invitationStore', () => ({ useInvitationStore: () => ({ invitations: [], fetchInvitations: vi.fn() }) }));
vi.mock('../../stores/joinRequestStore', () => ({ useJoinRequestStore: Object.assign(() => 0, { getState: () => ({ fetchGroupRequests: vi.fn() }) }) }));

import { Header } from './Header';

describe('Header avatar gating', () => {
  it('renders the desktop avatar wrapper as sm:hidden when the rail is present (signed in)', () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><Header /></MemoryRouter>);
    const menu = screen.getByTestId('header-usermenu');
    // wrapper is hidden on desktop when rail present
    expect(menu.closest('[data-rail-present="true"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- Header.avatar`
Expected: FAIL — no `data-rail-present` wrapper yet.

- [ ] **Step 3: Implement gating + remove Globe**

Add `const railPresent = !!user || isGroupRoute;`. Wrap the auth `UserMenu` so it is hidden on desktop when `railPresent`:

```tsx
) : user ? (
  <span
    data-rail-present={railPresent ? 'true' : 'false'}
    className={railPresent ? 'sm:hidden' : ''}
  >
    <UserMenu />
  </span>
) : (
  <LoginButton className="text-sm px-3 py-1.5" />
)}
```

Delete the Globe `Link` to `/discover` from the external-links cluster (Static Finder now lives in `ContextSwitcher`). Keep Discord, GitHub, ThemeToggle as-is.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm test -- Header.avatar`
Expected: PASS.

- [ ] **Step 5: Manual check**

Run `./dev.ps1` (or `./dev.sh`). Verify: signed-in dashboard/profile/group → no avatar in header on desktop, avatar in rail footer (opens upward, no clip). Resize < sm → avatar back in header, no rail. Signed-out home → no rail, login button in header.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/Header.tsx frontend/src/components/layout/Header.avatar.test.tsx
git commit -m "feat(layout): hide header avatar when rail present; remove redundant Globe link"
```

---

## Task 7: Release notes + full verification

**Files:**
- Modify: `frontend/src/data/releaseNotes.ts`

- [ ] **Step 1: Add a public release entry and bump version**

Add a new entry at the top of the releases array with `category: 'improvement'`, a `title`, a `description` ("The account menu now lives at the bottom of the left navigation rail, the rail is consistent across the app, and Static Finder is a first-class navigation tab."), `pr: <PR number>`, `prTitle`, and a full ISO 8601 date. Bump `CURRENT_VERSION` to the new version string and make the entry's version match.

- [ ] **Step 2: Run the full gate**

Run:
```bash
cd frontend
pnpm build      # tsc -b + vite build (stricter than tsc --noEmit)
pnpm lint
pnpm check:design-system
pnpm test
```
Expected: all pass. Fix any design-system flags by using tokens/primitives.

- [ ] **Step 3: Run scripts changelog test (version consistency)**

Run: `cd scripts && npm test`
Expected: PASS — `CURRENT_VERSION` equals the latest non-internal release version.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/data/releaseNotes.ts
git commit -m "docs(release): global rail + user-menu relocation"
```

---

## Self-review notes (already applied)

- **Spec coverage:** A1→Tasks 1,3,4; A2→Tasks 2,6; A3→Task 5; A4→Task 3. Mobile/gate handled in Task 6. Plugin-above-More in Task 3.
- **Collapse-state to footer:** resolved via the render-prop footer in Task 3b (don't leave the `[false]` placeholder).
- **Radix `side` passthrough:** Task 2 Step 3 flags verifying `DropdownContent` forwards `side`; add passthrough if missing.
- **Discover rail items:** intentionally deferred — Discover keeps header-only nav for now; not required for this plan.
