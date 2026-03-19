import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore, useAuthHydrated } from '../stores/authStore';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useDevice } from '../hooks/useDevice';
import { LoginButton } from '../components/auth';
import { Input, Spinner } from '../components/ui';
import { Button, Tooltip } from '../components/primitives';
import { BookOpen, Users, Calculator, Sparkles, Swords, BarChart3, Layers } from 'lucide-react';
import { staggerContainer, staggerItem, instantVariants } from '../lib/motion';
import type { MemberRole } from '../types';

// Role badge colors - using semantic membership tokens
const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-membership-owner/20 text-membership-owner border-membership-owner/30',
  lead: 'bg-membership-lead/20 text-membership-lead border-membership-lead/30',
  member: 'bg-membership-member/20 text-membership-member border-membership-member/30',
  viewer: 'bg-membership-viewer/20 text-membership-viewer border-membership-viewer/30',
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
  const { user, isLoading } = useAuthStore();
  const isHydrated = useAuthHydrated();
  const { groups, fetchGroups } = useStaticGroupStore();

  // Show loading state until store is hydrated from localStorage
  const authLoading = !isHydrated || isLoading;
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
    if (user) {
      fetchGroups();
    }
  }, [user, fetchGroups]);

  // Get recent statics from user's groups based on localStorage access history
  const recentStatics = useMemo(() => {
    if (!user || groups.length === 0) return [];

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
  }, [user, groups]);

  const handleViewStatic = (e: React.FormEvent) => {
    e.preventDefault();
    if (shareCode.trim()) {
      navigate(`/group/${shareCode.trim()}`);
    }
  };

  const { prefersReducedMotion } = useDevice();
  const itemVariants = prefersReducedMotion ? instantVariants : staggerItem;
  const containerVariants = prefersReducedMotion ? instantVariants : staggerContainer;

  return (
    <div className="text-center py-16 px-4 sm:px-6">
      {/* Hero section with atmospheric gradient */}
      <motion.div
        className="relative"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Background gradient */}
        <div
          className="absolute inset-0 -top-16 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center top, rgba(20,184,166,0.08) 0%, transparent 60%)',
          }}
          aria-hidden="true"
        />

        {/* Hero Logo */}
        <motion.div className="mb-6 relative" variants={itemVariants}>
          <img
            src="/logo-hero.svg"
            alt="FFXIV Raid Planner"
            className="w-32 h-32 mx-auto glow-teal"
          />
        </motion.div>

        <motion.h1
          className="font-display text-4xl sm:text-5xl text-accent mb-4"
          variants={itemVariants}
        >
          FFXIV Raid Planner
        </motion.h1>
        <motion.p
          className="text-text-secondary text-lg mb-8 max-w-2xl mx-auto"
          variants={itemVariants}
        >
          Gear tracking & loot planning for your static
        </motion.p>

        {/* Primary CTA */}
        <motion.div className="mb-8" variants={itemVariants}>
          {authLoading ? (
            <Spinner size="xl" className="mx-auto" label="Checking authentication" />
          ) : user ? (
            <Link
              to="/dashboard"
              className="inline-block bg-accent text-accent-contrast px-8 py-4 text-lg rounded-lg font-medium hover:bg-accent-hover transition-colors"
            >
              Go to My Statics
            </Link>
          ) : (
            <div className="flex justify-center">
              <LoginButton className="bg-accent text-accent-contrast px-8 py-4 text-lg rounded-lg font-medium hover:bg-accent-hover transition-colors" />
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Divider */}
      <div className="flex items-center gap-4 max-w-md mx-auto mb-8">
        <div className="flex-1 border-t border-border-default" />
        <span className="text-text-muted text-sm">or view a public static</span>
        <div className="flex-1 border-t border-border-default" />
      </div>

      {/* Share code input */}
      <form onSubmit={handleViewStatic} className="flex items-center gap-2 justify-center mb-16">
        <Input
          value={shareCode}
          onChange={(val) => setShareCode(val.toUpperCase())}
          placeholder="Enter share code..."
          maxLength={8}
          className="w-48 text-center font-mono uppercase"
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={!shareCode.trim()}
        >
          View
        </Button>
      </form>

      {/* Content section - different for logged in vs logged out users */}
      {user && recentStatics.length > 0 ? (
        /* Recent Statics for logged-in users */
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-xl text-text-primary mb-4 text-left">
            Recent Statics
          </h2>
          <div className="grid md:grid-cols-3 gap-6 stagger-children">
            {recentStatics.map((group) => (
              <Link
                key={group.id}
                to={`/group/${group.shareCode}`}
                className="card-interactive p-6 text-left group"
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
                    <span className="text-xs px-2 py-0.5 rounded border flex-shrink-0 ml-2 bg-membership-linked/20 text-membership-linked border-membership-linked/30">
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
                  <Tooltip
                    content={
                      <div>
                        <div className="font-medium">Copy Share Code</div>
                        <div className="text-text-secondary text-xs mt-0.5">
                          Hold <kbd className="px-1 py-0.5 bg-surface-base rounded border border-border-default">Shift</kbd> for full URL
                        </div>
                      </div>
                    }
                  >
                    {/* design-system-ignore: Inline icon button for compact list */}
                    <button
                      onClick={(e) => handleCopyCode(group.shareCode, e)}
                      className="p-1 rounded hover:bg-surface-interactive transition-colors"
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
                  </Tooltip>
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
          <div className="grid md:grid-cols-3 gap-6 text-left max-w-4xl mx-auto stagger-children">
            <div className="card-interactive p-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                <Swords className="w-5 h-5 text-accent" />
              </div>
              <h3 className="font-display text-lg text-accent mb-2">Gear Tracking</h3>
              <p className="text-text-secondary text-sm">
                Track BiS progress for your entire static. See who needs what at a glance.
              </p>
            </div>
            <div className="card-interactive p-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                <Calculator className="w-5 h-5 text-accent" />
              </div>
              <h3 className="font-display text-lg text-accent mb-2">Loot Priority</h3>
              <p className="text-text-secondary text-sm">
                Smart loot suggestions based on need, role priority, and past distributions.
              </p>
            </div>
            <div className="card-interactive p-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                <BarChart3 className="w-5 h-5 text-accent" />
              </div>
              <h3 className="font-display text-lg text-accent mb-2">Team Summary</h3>
              <p className="text-text-secondary text-sm">
                See total materials needed, books required, and estimated weeks to BiS.
              </p>
            </div>
          </div>

          {/* Multi-tier feature highlight */}
          <div className="mt-12 max-w-2xl mx-auto card-interactive border-glow p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5 text-accent" />
              </div>
              <div className="text-left">
                <h3 className="font-display text-lg text-accent mb-2">Multi-Tier Support</h3>
                <p className="text-text-secondary text-sm mb-4">
                  Keep your roster across raid tiers. Roll over from M1S-M4S to M5S-M8S without losing your setup.
                  Switch between tiers anytime to view historical progress.
                </p>
                {/* Tier timeline visualization */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-surface-elevated text-role-melee font-medium">M1S-M4S</span>
                  <div className="w-6 h-px bg-border-default" />
                  <span className="px-2 py-1 rounded bg-surface-elevated text-role-tank font-medium">M5S-M8S</span>
                  <div className="w-6 h-px bg-border-default" />
                  <span className="px-2 py-1 rounded bg-accent/20 text-accent font-medium border border-accent/30">M9S-M12S</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Documentation Section - only show for logged-in users */}
      {user && (
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-6">
            <BookOpen className="w-5 h-5 text-accent" />
            <h2 className="font-display text-xl text-text-primary">Documentation</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Link
              to="/docs/quick-start"
              className="group card-interactive p-5 text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Users className="w-4 h-4 text-accent" />
                </div>
                <h3 className="font-medium text-text-primary group-hover:text-accent transition-colors">
                  Quick Start
                </h3>
              </div>
              <p className="text-sm text-text-muted">
                Get your static set up in 5 minutes
              </p>
            </Link>
            <Link
              to="/docs/understanding-priority"
              className="group card-interactive p-5 text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Calculator className="w-4 h-4 text-accent" />
                </div>
                <h3 className="font-medium text-text-primary group-hover:text-accent transition-colors">
                  Understanding Priority
                </h3>
              </div>
              <p className="text-sm text-text-muted">
                How loot distribution works
              </p>
            </Link>
            <Link
              to="/docs/how-to"
              className="group card-interactive p-5 text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Sparkles className="w-4 h-4 text-accent" />
                </div>
                <h3 className="font-medium text-text-primary group-hover:text-accent transition-colors">
                  How-To Guides
                </h3>
              </div>
              <p className="text-sm text-text-muted">
                Step-by-step guides for common tasks
              </p>
            </Link>
          </div>
          <div className="mt-4 text-center">
            <Link
              to="/docs"
              className="text-sm text-accent hover:text-accent-bright transition-colors"
            >
              View all documentation →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
