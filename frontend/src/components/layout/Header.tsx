import { Link, useLocation } from 'react-router-dom';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useAuthStore } from '../../stores/authStore';
import { LoginButton, UserMenu } from '../auth';

export function Header() {
  const location = useLocation();

  const { currentGroup } = useStaticGroupStore();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  // Determine current route context
  const isGroupRoute = location.pathname.startsWith('/group/');

  return (
    <header className="bg-bg-secondary border-b border-border-default">
      <div className="max-w-[120rem] mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: Logo only */}
        <Link to="/" className="font-display text-xl text-accent hover:text-accent-bright">
          FFXIV Raid Planner
        </Link>

        {/* Right: Navigation + Auth */}
        <nav className="flex items-center gap-3">
          {/* My Statics link when viewing a group */}
          {isGroupRoute && currentGroup && isAuthenticated && (
            <Link
              to="/dashboard"
              className="bg-accent/20 text-accent px-4 py-2 rounded font-medium hover:bg-accent/30"
            >
              My Statics
            </Link>
          )}

          {/* Auth: Login button or User menu */}
          <div className="border-l border-white/10 pl-3">
            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
            ) : isAuthenticated ? (
              <UserMenu />
            ) : (
              <LoginButton className="text-sm px-3 py-1.5" />
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
