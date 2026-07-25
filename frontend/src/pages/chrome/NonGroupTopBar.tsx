/**
 * NonGroupTopBar — the v2 top bar for every non-group v2-chromed route
 * (Stage-1 T4; matrix rows H2/H3, H7–H13, H15/G1, RC4).
 *
 * ONE file, TWO responsive rows, because they share the auth slot and the same
 * matrix rows:
 *
 *   desktop (≥sm)  [Page identity]────────[Discord][GitHub][☾] │ [🔔][⚙] [auth]
 *   mobile  (<sm)  [logo]────────────────────────────[🔔][⚙][avatar / auth]
 *
 * Dispositions this bar implements (see
 * `design/redesign/specs/stage1-chrome-parity-matrix.md`):
 *   • H2/H3 — "Player Hub" / "Static Finder" are the page-identity words the
 *     matrix names for those routes; the rail carries the nav entries.
 *   • H8/H9 — Discord + GitHub KEPT on desktop; on mobile they are re-homed
 *     into the v2 `UserMenu` (M2, `sm:hidden` items) for authed users. A GUEST
 *     has no user menu, so the mobile guest row carries the links itself —
 *     otherwise mobile guests would lose an affordance legacy gives them
 *     (`Header.tsx:372/383` has no `sm:` gate).
 *   • H10 — ThemeToggle on desktop; on mobile it lives in the user menu
 *     (identical split to legacy), except on the guest row (see above).
 *   • H12/H13 — the auth slot gates on `!useAuthHydrated() || isLoading` and
 *     renders the exact `Header.tsx:407-408` pulse skeleton, so a cold load
 *     never flashes `LoginButton` for a frame. Guests CAN resolve to v2
 *     (`useResolvedShell` has no user check), so the guest branch is mandatory.
 *   • H15/G1 — desktop account settings are re-homed here as `SettingsGear`;
 *     Layout's v2 branch drops `SettingsDockToggle`.
 *   • RC4 (director) — the guest branch gates `NotificationBell` AND
 *     `SettingsGear` OFF, not just the auth slot: V1 gates both on `user`
 *     (`Header.tsx:331`; `SettingsDockToggle`/`GlobalSettingsPanel` return null
 *     for guests), so a guest bell/gear would be a NEW dead affordance.
 *
 * Sticky `top-0 z-40` with an `h-14` row — the same container shape as the
 * group `TopBar` (`components/layout/TopBar.tsx:110-114`), so the two bars are
 * visually consistent and slot into the documented z-stack identically.
 *
 * Lives in `pages/chrome/` (boundary-exempt) precisely so it may compose shell
 * (`NotificationBell`/`SettingsGear`) with person (`UserMenu`/`LoginButton`) —
 * the same placement ruling that put `TierBreadcrumb` and `AppChrome` in pages/.
 */
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore, useAuthHydrated } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { NotificationBell } from '../../components/layout/NotificationBell';
import { SettingsGear } from '../../components/layout/SettingsGear';
import { LoginButton, UserMenu } from '../../components/auth';
import { DiscordIcon, GitHubIcon, ThemeToggle } from '../../components/ui';
import { Tooltip } from '../../components/primitives';
import { DISCORD_INVITE_URL, GITHUB_REPO_URL } from '../../config';

/**
 * Page identity for the desktop row. The `/profile` and `/discover` words are
 * fixed by matrix rows H2/H3 (the ContextSwitcher segment labels those routes
 * inherit); the rest name the route class. `/` never reaches this component —
 * Layout excludes it from the v2 chrome branch.
 */
function pageIdentity(pathname: string): string {
  if (pathname === '/profile') return 'Player Hub';
  // /profile/:shareCode is PublicProfile — a public share target, not the hub.
  if (pathname.startsWith('/profile/')) return 'Player Profile';
  if (pathname === '/discover') return 'Static Finder';
  if (pathname === '/dashboard') return 'Dashboard';
  if (pathname === '/docs' || pathname.startsWith('/docs/')) return 'Docs';
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'Admin';
  // The `*` catch-all (G3) and anything else: the app's own name.
  return 'FFXIV Raid Planner';
}

const EXTERNAL_LINK_CLASSES =
  'flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-lg text-text-muted hover:bg-surface-interactive transition-colors flex-shrink-0';

const LOGO_LINK_CLASSES =
  'flex items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

/** Discord + GitHub, mirroring `Header.tsx:372-395` (same target/rel/labels). */
function ExternalLinks() {
  return (
    <div className="flex items-center gap-0 sm:gap-1">
      <Tooltip content="Join our Discord community">
        <a
          href={DISCORD_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Join our Discord community"
          className={`${EXTERNAL_LINK_CLASSES} hover:text-discord`}
        >
          <DiscordIcon className="w-4 h-4 sm:w-5 sm:h-5" />
        </a>
      </Tooltip>
      <Tooltip content="View source on GitHub">
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source on GitHub"
          className={`${EXTERNAL_LINK_CLASSES} hover:text-text-primary`}
        >
          <GitHubIcon className="w-4 h-4 sm:w-5 sm:h-5" />
        </a>
      </Tooltip>
    </div>
  );
}

/** H13: the exact `Header.tsx:407-408` pre-hydration placeholder. */
function AuthSkeleton() {
  return <div data-testid="auth-skeleton" className="w-8 h-8 rounded-full bg-surface-interactive animate-pulse" />;
}

export function NonGroupTopBar() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isHydrated = useAuthHydrated();
  const openCenter = useNotificationStore((s) => s.openCenter);

  // H13 — identical gate to Header.tsx:51-55. `UserMenu` returning null for a
  // falsy user is NOT sufficient: it would flash LoginButton for a frame.
  const authLoading = !isHydrated || isLoading;
  const identity = pageIdentity(location.pathname);

  // M1: the mobile row's logo is the home affordance while the rail is hidden —
  // same target + accessible name pairing the rail logo uses.
  const logoHref = user ? '/profile' : '/';
  const logoLabel = user ? 'Player Hub — home' : 'FFXIV Raid Planner — home';

  return (
    <header
      data-testid="non-group-topbar"
      className="sticky top-0 z-40 border-b border-border-default"
      style={{ background: 'var(--color-surface-nav, var(--color-surface-raised))' }}
    >
      {/* ── Desktop row (≥sm) — the "slim TopBar" of matrix §1 ─────────────── */}
      {/* Only ONE row is ever visible (the classes are mutually exclusive), but
          both are in the DOM — the testids let tests address a row instead of
          disambiguating duplicate accessible names that a real browser never
          exposes at the same time (`hidden` = display:none = out of the a11y
          tree). */}
      <div data-testid="non-group-topbar-desktop" className="hidden sm:flex items-center gap-2 px-3 sm:px-4 h-14 min-w-0">
        <span className="text-sm font-medium text-text-primary truncate">{identity}</span>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5 sm:gap-1">
          <ExternalLinks />
          <ThemeToggle />
          {/* RC4: bell + gear are authed-only, exactly as V1 gates them. */}
          {user && (
            <>
              <NotificationBell onOpen={openCenter} />
              <span className="w-px h-4 bg-border-subtle flex-shrink-0" aria-hidden />
              <SettingsGear />
            </>
          )}
          {/* Auth slot. Authed desktop renders NOTHING here — the UserMenu
              lives in the AppRail footer (H11), and a second one would be a
              double menu (the P4 problem, one row up). */}
          {authLoading ? <AuthSkeleton /> : !user ? <LoginButton className="text-sm px-3 py-1.5" /> : null}
        </div>
      </div>

      {/* ── Mobile row (<sm) — the rail is `hidden sm:flex`, so this row is the
             only chrome a phone gets ──────────────────────────────────────── */}
      <div data-testid="non-group-topbar-mobile" className="flex sm:hidden items-center gap-1 px-3 h-14 min-w-0">
        <Link to={logoHref} aria-label={logoLabel} className={LOGO_LINK_CLASSES}>
          <img src="/logo.svg" alt="" className="w-8 h-8" />
        </Link>

        <div className="flex-1" />

        {user ? (
          <>
            <NotificationBell onOpen={openCenter} />
            <SettingsGear />
          </>
        ) : (
          <>
            {/* Guest mobile has no user menu to hold the M2 links or the theme
                item, so the row carries them (RC4's guest-row contents). */}
            <ExternalLinks />
            <ThemeToggle />
          </>
        )}

        {authLoading ? <AuthSkeleton /> : user ? <UserMenu /> : <LoginButton className="text-sm px-3 py-1.5" />}
      </div>
    </header>
  );
}
