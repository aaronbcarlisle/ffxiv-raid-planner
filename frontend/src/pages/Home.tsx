import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { LoginButton } from '../components/auth';
import type { MemberRole } from '../types';

// Role badge colors
const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  lead: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  member: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

// Get recently accessed share codes from localStorage
function getRecentStaticCodes(): string[] {
  try {
    const saved = localStorage.getItem('recent-statics');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthStore();
  const { groups, fetchGroups } = useStaticGroupStore();
  const [shareCode, setShareCode] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Copy share code (or full URL if shift is held)
  const handleCopyCode = useCallback(async (code: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const textToCopy = e.shiftKey
      ? `${window.location.origin}/group/${code}`
      : code;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  }, []);

  // Fetch user's groups when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchGroups();
    }
  }, [isAuthenticated, fetchGroups]);

  // Get recent statics from user's groups based on localStorage access history
  const recentStatics = useMemo(() => {
    if (!isAuthenticated || groups.length === 0) return [];

    const recentCodes = getRecentStaticCodes();
    const groupsByCode = new Map(groups.map(g => [g.shareCode, g]));

    // Get groups that match recent codes, in order of recency
    const recent = recentCodes
      .filter(code => groupsByCode.has(code))
      .map(code => groupsByCode.get(code)!)
      .slice(0, 3);

    // If not enough recent, fill with most recent from groups list
    if (recent.length < 3) {
      const recentSet = new Set(recent.map(g => g.shareCode));
      const remaining = groups
        .filter(g => !recentSet.has(g.shareCode))
        .slice(0, 3 - recent.length);
      return [...recent, ...remaining];
    }

    return recent;
  }, [isAuthenticated, groups]);

  const handleViewStatic = (e: React.FormEvent) => {
    e.preventDefault();
    if (shareCode.trim()) {
      navigate(`/group/${shareCode.trim()}`);
    }
  };

  return (
    <div className="text-center py-16">
      {/* Hero Logo */}
      <div className="mb-6">
        <img
          src="/logo-hero.svg"
          alt="FFXIV Raid Planner"
          className="w-24 h-24 mx-auto"
        />
      </div>

      <h1 className="font-display text-4xl text-accent mb-4">
        FFXIV Raid Planner
      </h1>
      <p className="text-text-secondary text-lg mb-8 max-w-2xl mx-auto">
        Gear tracking & loot planning for your static
      </p>

      {/* Primary CTA */}
      <div className="mb-8">
        {isLoading ? (
          <div className="w-10 h-10 mx-auto border-2 border-accent border-t-transparent rounded-full animate-spin" />
        ) : isAuthenticated ? (
          <Link
            to="/dashboard"
            className="inline-block bg-accent text-bg-primary px-8 py-4 rounded-lg font-medium text-lg hover:bg-accent-bright transition-colors"
          >
            Go to My Statics
          </Link>
        ) : (
          <div className="flex justify-center">
            <LoginButton className="bg-accent text-bg-primary px-8 py-4 rounded-lg font-medium text-lg hover:bg-accent-bright transition-colors" />
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 max-w-md mx-auto mb-8">
        <div className="flex-1 border-t border-white/10" />
        <span className="text-text-muted text-sm">or view a public static</span>
        <div className="flex-1 border-t border-white/10" />
      </div>

      {/* Share code input */}
      <form onSubmit={handleViewStatic} className="flex items-center gap-2 justify-center mb-16">
        <input
          type="text"
          value={shareCode}
          onChange={(e) => setShareCode(e.target.value.toUpperCase())}
          placeholder="Enter share code..."
          maxLength={8}
          className="bg-bg-secondary border border-border-default rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none w-48 text-center font-mono uppercase"
        />
        <button
          type="submit"
          disabled={!shareCode.trim()}
          className="bg-bg-secondary border border-border-default px-6 py-3 rounded-lg text-text-primary hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          View
        </button>
      </form>

      {/* Content section - different for logged in vs logged out users */}
      {isAuthenticated && recentStatics.length > 0 ? (
        /* Recent Statics for logged-in users */
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-xl text-text-primary mb-4 text-left">
            Recent Statics
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {recentStatics.map((group) => (
              <Link
                key={group.id}
                to={`/group/${group.shareCode}`}
                className="bg-bg-card p-6 rounded-lg border border-border-default hover:border-accent/50 transition-colors text-left group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-display text-lg text-accent group-hover:text-accent-bright transition-colors truncate">
                    {group.name}
                  </h3>
                  {group.userRole ? (
                    <span
                      className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ml-2 ${ROLE_COLORS[group.userRole]}`}
                    >
                      {group.userRole.charAt(0).toUpperCase() + group.userRole.slice(1)}
                    </span>
                  ) : group.source === 'linked' ? (
                    <span className="text-xs px-2 py-0.5 rounded border flex-shrink-0 ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30">
                      Linked
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between text-sm text-text-muted">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                      {group.memberCount}
                    </span>
                    <span className="font-mono text-xs text-accent">{group.shareCode}</span>
                  </div>
                  <button
                    onClick={(e) => handleCopyCode(group.shareCode, e)}
                    className="p-1 rounded hover:bg-bg-hover transition-colors"
                    title="Copy code (hold Shift for full URL)"
                  >
                    {copiedCode === group.shareCode ? (
                      <svg className="w-3.5 h-3.5 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-text-muted hover:text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </Link>
            ))}
          </div>
          {groups.length > 3 && (
            <div className="mt-4 text-center">
              <Link
                to="/dashboard"
                className="text-sm text-accent hover:text-accent-bright transition-colors"
              >
                View all {groups.length} statics →
              </Link>
            </div>
          )}
        </div>
      ) : (
        /* Feature cards for non-logged-in users */
        <>
          <div className="grid md:grid-cols-3 gap-6 text-left max-w-4xl mx-auto">
            <div className="bg-bg-card p-6 rounded-lg border border-border-default">
              <h3 className="font-display text-lg text-accent mb-2">Gear Tracking</h3>
              <p className="text-text-secondary text-sm">
                Track BiS progress for your entire static. See who needs what at a glance.
              </p>
            </div>
            <div className="bg-bg-card p-6 rounded-lg border border-border-default">
              <h3 className="font-display text-lg text-accent mb-2">Loot Priority</h3>
              <p className="text-text-secondary text-sm">
                Smart loot suggestions based on need, role priority, and past distributions.
              </p>
            </div>
            <div className="bg-bg-card p-6 rounded-lg border border-border-default">
              <h3 className="font-display text-lg text-accent mb-2">Team Summary</h3>
              <p className="text-text-secondary text-sm">
                See total materials needed, books required, and estimated weeks to BiS.
              </p>
            </div>
          </div>

          {/* Multi-tier feature highlight */}
          <div className="mt-12 max-w-2xl mx-auto bg-bg-card p-6 rounded-lg border border-accent/20">
            <h3 className="font-display text-lg text-accent mb-2">Multi-Tier Support</h3>
            <p className="text-text-secondary text-sm">
              Keep your roster across raid tiers. Roll over from M1S-M4S to M5S-M8S without losing your setup.
              Switch between tiers anytime to view historical progress.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
