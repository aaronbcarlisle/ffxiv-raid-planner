/**
 * AppChrome — the single v2 chrome host (Stage-1 T3).
 *
 * Owns the app-level v2 chrome: `V2ChromeContext` provider, the AppRail
 * (Person-layer entries with REAL `isActive`, M1 logo link, G5 empty-state
 * rail, footer UserMenu), the host-owned TopBar/Spine slot containers
 * (see `chromeSlots.ts` for the portal mechanism and the RC1/RC2 rationale),
 * and the page's single `<main id="main-content">` (SkipLink target).
 *
 * Mounted ONLY by Layout's v2 branch — since T4 that branch covers EVERY
 * v2-resolved route except `/`. On `/group/*` the route supplies the TopBar and
 * Spine through the portal slots; everywhere else the host renders
 * `NonGroupTopBar` itself. Route-scoped group internals (CommandPalette,
 * GroupActionModals, cold group/tier fetches, tab memory) stay in NewShell,
 * which portals its TopBar/Spine into the slot containers.
 *
 * Lives in `pages/` (boundary-exempt) because it composes shell (`AppRail`)
 * with person (`UserMenu`) — the same placement ruling that put
 * `TierBreadcrumb` in pages/.
 *
 * RC3: the `<main>` reproduces Layout's legacy main behavior for the content
 * area — `pt-1 pb-3 md:py-2` padding + `scrollbar-gutter: stable` +
 * overflow-y-auto flex column — so hosted bodies keep their padding. The
 * accepted (screenshotted) delta vs. the pre-hoist layout is that the rail and
 * top bar now sit OUTSIDE the padded scroller instead of inside it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, matchPath, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Home, Globe } from 'lucide-react';
import { AppRail } from '../../components/layout/AppRail';
import { UserMenu } from '../../components/auth';
import { V2ChromeContext } from '../../lib/chromeContext';
import { ChromeSlotNodesContext, type ChromeSlotNodes } from './chromeSlots';
import { NonGroupTopBar } from './NonGroupTopBar';
import { buildStaticNavHref, prefRememberTabs } from '../../lib/navPreferences';
import { useAuthStore } from '../../stores/authStore';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import type { RailEntry } from '../../components/layout/railTypes';

/** Derive two-letter initials from a static name. (Moved from NewShell.) */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const LOGO_LINK_CLASSES =
  'flex items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export interface AppChromeProps {
  children: React.ReactNode;
}

export function AppChrome({ children }: AppChromeProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const user = useAuthStore((s) => s.user);
  const rememberStaticTab = useAuthStore((s) => prefRememberTabs(s.user));
  const groups = useStaticGroupStore((s) => s.groups);
  const fetchGroups = useStaticGroupStore((s) => s.fetchGroups);

  // On a group route: which static is active (drives avatar isActive, the §1
  // host contract below, and the empty top-bar placeholder while the lazy
  // NewShell chunk loads).
  const groupMatch = matchPath('/group/:shareCode', location.pathname);
  const activeShareCode = groupMatch?.params.shareCode ?? null;
  const onGroupRoute = groupMatch !== null;

  // Fetch the groups list on cold v2 load so the AppRail avatars are populated.
  // Guarded: skips if groups are already loaded (warm store from prior navigation),
  // AND gated on auth — `fetchGroups()` hits the auth-required GET /api/static-groups
  // ("my statics" list), which 401s for a logged-out guest and writes into the
  // shared staticGroupStore.error, surfacing a false "Not authenticated" error
  // Modal (ShellContentStates) over an otherwise-correct read-only guest view of
  // a public static. Legacy never eagerly fetches this for anyone — its
  // Header/TopBar chrome only calls it lazily, when the static-switcher dropdown
  // opens AND the viewer is a member (StaticPicker.tsx:76). A guest has no "my
  // statics" list to fetch, so skip it entirely for them. This mirrors the
  // `fetchGroups` call the legacy GroupView chrome triggers via its own mount
  // effect; NewShell previously skipped it because it only fetched the current
  // group. (Fix 2, PR #163; moved here from NewShell in Stage-1 T3.)
  //
  // T4 scope decision (plan §3, director E-table): now that the coverage flip
  // mounts AppChrome on every v2 route, this is also a cold fetch on e.g.
  // `/profile`, where Profile.tsx fires its OWN unconditional `fetchGroups()`
  // (Profile.tsx:186 — no length guard at all). RESOLVED AS "accept +
  // document", the plan's second option: on a cold `/profile` a v2 user issues
  // ONE extra idempotent GET /api/static-groups; every warm navigation issues
  // none from here (the length guard holds). The rejected alternative — an
  // in-flight guard inside `staticGroupStore.fetchGroups` — would change the
  // behavior of a store the LEGACY shell also runs on, for a request-count win
  // that no user can perceive; Stage 1's hard constraint is zero legacy impact.
  useEffect(() => {
    if (user && groups.length === 0) {
      fetchGroups();
    }
    // Run once on mount (plus the null->authed transition via `user`) only —
    // adding `groups.length` would re-fetch on every static navigation when the
    // list clears momentarily. `user` is included so a guest who logs in while
    // on the page still gets their groups fetched; the store's `user` reference
    // is stable once set (no refetch-loop risk).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchGroups, user]);

  // ── Rail entries (real isActive — the host sees every route) ──────────────
  const railEntries = useMemo<RailEntry[]>(() => {
    const entries: RailEntry[] = [];
    // Player Hub requires auth (Profile redirects unauthed; the legacy
    // ContextSwitcher is `user &&`-gated too) — guests get Static Finder only.
    if (user) {
      entries.push({
        kind: 'icon',
        id: 'player-hub',
        label: 'Player Hub',
        icon: Home,
        isActive: location.pathname === '/profile',
        onSelect: () => navigate('/profile'),
      });
    }
    entries.push({
      kind: 'icon',
      id: 'static-finder',
      label: 'Static Finder',
      icon: Globe,
      isActive: location.pathname === '/discover',
      onSelect: () => navigate('/discover'),
    });
    // G5: no dangling divider for a zero-statics account (every brand-new
    // user's first screen) — the divider and avatars render only when the
    // statics list is non-empty.
    if (groups.length > 0) {
      entries.push({ kind: 'divider', id: 'div-statics' });
      for (const g of groups) {
        entries.push({
          kind: 'avatar',
          id: `static-${g.id}`,
          label: g.name,
          initials: getInitials(g.name),
          isActive: g.shareCode === activeShareCode,
          onSelect: () => {
            // §1 host contract: `currentParams` is passed ONLY when already on
            // `/group/*` (ContextSwitcher.tsx:116 semantics — its `onStatic`
            // gate). NewShell's old unconditional pass was safe only because
            // it mounted solely on group routes; the host mounts everywhere
            // after T4, where an unconditional pass would leak foreign params
            // (e.g. `/profile?tab=jobs-gear` → `/group/CODE?tab=jobs-gear`)
            // for `tabPersistence: 'reset'` users.
            navigate(buildStaticNavHref(g.shareCode, {
              remember: rememberStaticTab,
              currentParams: onGroupRoute ? searchParams : undefined,
            }));
          },
        });
      }
    }
    return entries;
  }, [user, groups, activeShareCode, onGroupRoute, location.pathname, navigate, rememberStaticTab, searchParams]);

  // M1 logo link: authed → /profile, guest → / (home). The accessible name
  // lives on the link and matches its target; the img is decorative (alt="")
  // so the link name isn't polluted. The authed name is "Player Hub — home",
  // NOT bare "Player Hub" (PR-2 director nit): the rail's Player Hub entry
  // already owns that name, and two same-named controls in one nav is an a11y
  // ambiguity. The "— home" suffix parallels the guest form.
  const logoLink = user ? (
    <Link to="/profile" aria-label="Player Hub — home" className={LOGO_LINK_CLASSES}>
      <img src="/logo.svg" alt="" className="w-8 h-8" />
    </Link>
  ) : (
    <Link to="/" aria-label="FFXIV Raid Planner — home" className={LOGO_LINK_CLASSES}>
      <img src="/logo.svg" alt="" className="w-8 h-8" />
    </Link>
  );

  // ── Portal slot nodes (see chromeSlots.ts) ─────────────────────────────────
  // Callback refs write state exactly once per container mount/unmount — never
  // per render (RC2: no per-render ancestor setState). The context value's
  // identity changes only when a node changes, so slot consumers don't
  // re-render on unrelated host renders.
  const [topBarEl, setTopBarEl] = useState<HTMLElement | null>(null);
  const [spineEl, setSpineEl] = useState<HTMLElement | null>(null);
  const topBarSlotRef = useCallback((node: HTMLDivElement | null) => setTopBarEl(node), []);
  const spineSlotRef = useCallback((node: HTMLDivElement | null) => setSpineEl(node), []);
  const slotNodes = useMemo<ChromeSlotNodes>(
    () => ({ topBar: topBarEl, spine: spineEl }),
    [topBarEl, spineEl],
  );

  return (
    <V2ChromeContext.Provider value={true}>
      <ChromeSlotNodesContext.Provider value={slotNodes}>
        <div className="flex min-h-0 flex-1">
          <AppRail
            logo={logoLink}
            entries={railEntries}
            // Footer UserMenu is authed-only (G5/guest rail — legacy shows
            // LoginButton in the Header instead; the v2 guest auth affordance
            // lands with the T4 top bar).
            footer={user ? <UserMenu variant="rail" collapsed /> : undefined}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top bar. On `/group/*` this is the host-owned portal container
                that NewShell fills — an empty h-14 placeholder bar while its
                lazy chunk loads (no layout shift, no wrong-affordance flash;
                the `empty:` styles drop the moment the portal fills it).
                Everywhere else (T4) the host renders the NonGroupTopBar
                directly: no route supplies one, so there is nothing to wait
                for and no placeholder to hold. */}
            {onGroupRoute ? (
              <div
                ref={topBarSlotRef}
                data-testid="chrome-topbar-slot"
                className="shrink-0 empty:h-14 empty:border-b empty:border-border-default"
              />
            ) : (
              <NonGroupTopBar />
            )}
            {/* Spine slot — group routes only (nothing else supplies a spine,
                and an always-mounted container would publish a portal target
                that no route fills). */}
            {onGroupRoute && (
              <div ref={spineSlotRef} data-testid="chrome-spine-slot" className="shrink-0" />
            )}
            {/* RC3: reproduces Layout's legacy <main> for the content area —
                same padding + scrollbar-gutter + overflow behavior (see
                Layout.tsx's legacy branch for the original rationale). This is
                the page's single #main-content (SkipLink target). */}
            <main
              id="main-content"
              className="w-full pt-1 pb-3 md:py-2 flex-1 min-h-0 min-w-0 flex flex-col overflow-y-auto overflow-x-hidden"
              style={{ scrollbarGutter: 'stable' }}
            >
              {children}
            </main>
          </div>
        </div>
      </ChromeSlotNodesContext.Provider>
    </V2ChromeContext.Provider>
  );
}
