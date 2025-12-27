import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStaticStore } from '../../stores/staticStore';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useTierStore } from '../../stores/tierStore';
import { useAuthStore } from '../../stores/authStore';
import { getTierById } from '../../gamedata';
import { Toast } from '../ui';
import { LoginButton, UserMenu } from '../auth';

export function Header() {
  const location = useLocation();

  // Legacy system (for backward compat)
  const { currentStatic, addPlayerSlot } = useStaticStore();

  // New system
  const { currentGroup } = useStaticGroupStore();
  const { currentTier } = useTierStore();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  const [showToast, setShowToast] = useState(false);

  // Determine which system is active based on route
  const isLegacyRoute = location.pathname.startsWith('/static/');
  const isGroupRoute = location.pathname.startsWith('/group/');
  const isOnDashboard = location.pathname === '/dashboard';

  // Get tier info for display
  const legacyTierInfo = currentStatic ? getTierById(currentStatic.tier) : null;
  const groupTierInfo = currentTier ? getTierById(currentTier.tierId) : null;

  const handleShareLegacy = () => {
    if (!currentStatic) return;
    navigator.clipboard.writeText(
      `${window.location.origin}/static/${currentStatic.shareCode}`
    );
    setShowToast(true);
  };

  // Breadcrumb display
  const getBreadcrumb = () => {
    if (isLegacyRoute && currentStatic) {
      return <span className="text-text-muted">/ {currentStatic.name}</span>;
    }
    if (isGroupRoute && currentGroup) {
      return <span className="text-text-muted">/ {currentGroup.name}</span>;
    }
    if (isOnDashboard) {
      return <span className="text-text-muted">/ My Statics</span>;
    }
    return null;
  };

  // Center display (group/static name + tier)
  const getCenterDisplay = () => {
    // New system: group + tier
    if (isGroupRoute && currentGroup) {
      return (
        <div className="absolute left-1/2 -translate-x-1/2 text-center hidden md:block">
          <span className="font-display text-2xl text-accent">{currentGroup.name}</span>
          {currentTier && groupTierInfo && (
            <>
              <span className="text-text-muted mx-2">|</span>
              <span className="text-text-secondary">{groupTierInfo.name}</span>
            </>
          )}
        </div>
      );
    }

    // Legacy system: static + tier
    if (isLegacyRoute && currentStatic) {
      return (
        <div className="absolute left-1/2 -translate-x-1/2 text-center hidden md:block">
          <span className="font-display text-2xl text-accent">{currentStatic.name}</span>
          <span className="text-text-muted mx-2">|</span>
          <span className="text-text-secondary">{legacyTierInfo?.name ?? currentStatic.tier}</span>
        </div>
      );
    }

    return null;
  };

  // Right side actions
  const getActions = () => {
    // New system: My Statics link for easy navigation back to dashboard
    if (isGroupRoute && currentGroup && isAuthenticated) {
      return (
        <Link
          to="/dashboard"
          className="bg-accent/20 text-accent px-4 py-2 rounded font-medium hover:bg-accent/30"
        >
          My Statics
        </Link>
      );
    }

    // Legacy system: Share + Add Player
    if (isLegacyRoute && currentStatic) {
      return (
        <>
          <button
            className="bg-accent/20 text-accent px-4 py-2 rounded font-medium hover:bg-accent/30"
            onClick={handleShareLegacy}
          >
            Share
          </button>
          <button
            onClick={addPlayerSlot}
            className="bg-accent text-bg-primary px-4 py-2 rounded font-medium hover:bg-accent-bright"
          >
            Add Player
          </button>
        </>
      );
    }

    // Not viewing a static/group - no actions needed
    return null;
  };

  return (
    <>
      <header className="bg-bg-secondary border-b border-border-default">
        <div className="max-w-[120rem] mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left: Logo + breadcrumb */}
          <div className="flex items-center gap-2">
            <Link to="/" className="font-display text-xl text-accent hover:text-accent-bright">
              FFXIV Raid Planner
            </Link>
            {getBreadcrumb()}
          </div>

          {/* Center: Static/Group name + tier */}
          {getCenterDisplay()}

          {/* Right: Actions */}
          <nav className="flex items-center gap-3">
            {getActions()}

            {/* Auth: Login button or User menu */}
            <div className="ml-2 border-l border-white/10 pl-3">
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

      <Toast
        message="Link copied to clipboard!"
        isVisible={showToast}
        onHide={() => setShowToast(false)}
      />
    </>
  );
}
