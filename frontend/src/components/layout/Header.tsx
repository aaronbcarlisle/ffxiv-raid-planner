import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStaticStore } from '../../stores/staticStore';
import { useAuthStore } from '../../stores/authStore';
import { getTierById } from '../../gamedata';
import { Toast } from '../ui';
import { LoginButton, UserMenu } from '../auth';

export function Header() {
  const { currentStatic, addPlayerSlot } = useStaticStore();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [showToast, setShowToast] = useState(false);

  const tierInfo = currentStatic ? getTierById(currentStatic.tier) : null;

  const handleShare = () => {
    if (!currentStatic) return;
    navigator.clipboard.writeText(
      `${window.location.origin}/static/${currentStatic.shareCode}`
    );
    setShowToast(true);
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
            {currentStatic && (
              <span className="text-text-muted">/ {currentStatic.name}</span>
            )}
          </div>

          {/* Center: Static name + tier (only when viewing a static) */}
          {currentStatic && (
            <div className="absolute left-1/2 -translate-x-1/2 text-center hidden md:block">
              <span className="font-display text-2xl text-accent">{currentStatic.name}</span>
              <span className="text-text-muted mx-2">|</span>
              <span className="text-text-secondary">{tierInfo?.name ?? currentStatic.tier}</span>
            </div>
          )}

          {/* Right: Actions */}
          <nav className="flex items-center gap-3">
            {currentStatic ? (
              <>
                <button
                  className="bg-accent/20 text-accent px-4 py-2 rounded font-medium hover:bg-accent/30"
                  onClick={handleShare}
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
            ) : (
              <Link
                to="/create"
                className="bg-accent text-bg-primary px-4 py-2 rounded font-medium hover:bg-accent-bright"
              >
                Create Static
              </Link>
            )}

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
