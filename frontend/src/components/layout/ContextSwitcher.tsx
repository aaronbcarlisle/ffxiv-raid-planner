/* eslint-disable design-system/no-raw-button */
/**
 * ContextSwitcher
 *
 * A segmented control in the header that swaps between the two peer contexts —
 * the Player Hub and a Static — instead of relying on back-links. The active
 * context is highlighted; the Static segment carries a ▾ that opens the list
 * of the user's statics (and a link to the dashboard).
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { User, Shield, ChevronDown, Users } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { TRANSIENT_NAV_PARAMS, prefRememberStaticTab } from '../../lib/navPreferences';
import type { StaticGroup, StaticGroupListItem, MemberRole } from '../../types';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  Tooltip,
} from '../primitives';

const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-membership-owner/20 text-membership-owner border-membership-owner/30',
  lead: 'bg-membership-lead/20 text-membership-lead border-membership-lead/30',
  member: 'bg-membership-member/20 text-membership-member border-membership-member/30',
  viewer: 'bg-membership-viewer/20 text-membership-viewer border-membership-viewer/30',
};
const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner', lead: 'Lead', member: 'Member', viewer: 'Viewer',
};
const ROLE_LABELS_SHORT: Record<MemberRole, string> = {
  owner: 'O', lead: 'L', member: 'M', viewer: 'V',
};

interface ContextSwitcherProps {
  /** The active static on a /group route, if any */
  currentGroup: StaticGroup | null;
  groups: StaticGroupListItem[];
  onFetchGroups: () => void;
  isMember: boolean;
  userRole?: MemberRole;
  /** Expand to fill width on mobile (used in the mobile second row) */
  fullWidthMobile?: boolean;
}

const segBase =
  'flex items-center gap-1.5 h-8 px-2.5 rounded-md text-sm font-medium transition-colors min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50';
const segActive = 'bg-accent/15 text-accent';
const segIdle = 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]';

export function ContextSwitcher({
  currentGroup,
  groups,
  onFetchGroups,
  isMember,
  userRole,
  fullWidthMobile,
}: ContextSwitcherProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rememberStaticTab = useAuthStore((s) => prefRememberStaticTab(s.user));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && isMember) onFetchGroups();
  }, [open, isMember, onFetchGroups]);

  const onHub = location.pathname.startsWith('/profile');
  const onStatic = location.pathname.startsWith('/group/');

  // Build the URL to a static, honoring the "remember tab per static" preference:
  //  • ON  → restore that static's last saved tab + sub-tabs (per-static memory).
  //  • OFF → carry the current tab + sub-tabs across (stay on the same view),
  //          dropping `tier` so the target picks its own active tier.
  const buildStaticHref = useCallback((shareCode: string) => {
    const base = `/group/${shareCode}`;
    if (rememberStaticTab) {
      try {
        const saved = localStorage.getItem(`static-nav-${shareCode}`);
        if (saved) {
          const p = new URLSearchParams(saved);
          TRANSIENT_NAV_PARAMS.forEach((k) => p.delete(k));
          const s = p.toString();
          return s ? `${base}?${s}` : base;
        }
      } catch { /* ignore */ }
      return base;
    }
    // Stay-on-current: only meaningful when already viewing a static.
    if (onStatic) {
      const p = new URLSearchParams(searchParams);
      [...TRANSIENT_NAV_PARAMS, 'tier'].forEach((k) => p.delete(k));
      const s = p.toString();
      return s ? `${base}?${s}` : base;
    }
    return base;
  }, [rememberStaticTab, onStatic, searchParams]);

  // The static the "Static" segment points to: the active group, else the first
  // of the user's statics (so the segment still works from the Player Hub).
  const targetStatic =
    currentGroup ??
    (groups.length > 0
      ? ({ shareCode: groups[0].shareCode, name: groups[0].name } as Pick<StaticGroup, 'shareCode' | 'name'>)
      : null);
  const segRole = currentGroup ? userRole : groups[0]?.userRole ?? undefined;

  return (
    <div
      className={`flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-card border border-border-subtle ${fullWidthMobile ? 'w-full' : ''}`}
    >
      {/* Player Hub segment */}
      <Tooltip content="Player Hub — character, jobs, gear & applications">
        <Link to="/profile" className={`${segBase} ${onHub ? segActive : segIdle} flex-shrink-0`} aria-current={onHub ? 'page' : undefined}>
          <User className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Player Hub</span>
        </Link>
      </Tooltip>

      <span className="w-px h-4 bg-border-subtle flex-shrink-0" aria-hidden />

      {/* Static segment */}
      {targetStatic ? (
        <div className={`flex items-center min-w-0 ${fullWidthMobile ? 'flex-1' : ''}`}>
          {/* Label: navigates to the target static */}
          <Tooltip content={targetStatic.name}>
            <Link
              to={buildStaticHref(targetStatic.shareCode)}
              className={`${segBase} ${onStatic ? segActive : segIdle} ${fullWidthMobile ? 'flex-1' : 'max-w-[200px] md:max-w-[280px] lg:max-w-[360px]'}`}
              aria-current={onStatic ? 'page' : undefined}
            >
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span className="truncate font-display">{targetStatic.name}</span>
              {segRole && (
                <span className={`text-[10px] px-1 py-0.5 rounded border flex-shrink-0 ${ROLE_COLORS[segRole]}`}>
                  <span className="sm:hidden">{ROLE_LABELS_SHORT[segRole]}</span>
                  <span className="hidden sm:inline">{ROLE_LABELS[segRole]}</span>
                </span>
              )}
            </Link>
          </Tooltip>
          {/* ▾ opens the statics list */}
          {isMember && (
            <Dropdown open={open} onOpenChange={setOpen}>
              <DropdownTrigger>
                <button
                  type="button"
                  className={`flex items-center justify-center h-8 w-7 rounded-md flex-shrink-0 ${segIdle}`}
                  aria-label="Switch static"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
              </DropdownTrigger>
              <DropdownContent align="start" className="w-72 max-w-[calc(100vw-2rem)] overflow-hidden">
                <div className="max-h-64 overflow-y-auto overflow-x-hidden">
                  {groups.filter((g) => g.shareCode !== targetStatic.shareCode).length === 0 ? (
                    <div className="px-4 py-3 text-text-muted text-sm">No other statics</div>
                  ) : (
                    groups
                      .filter((g) => g.shareCode !== targetStatic.shareCode)
                      .map((group) => (
                        <DropdownItem key={group.id} onSelect={() => navigate(buildStaticHref(group.shareCode))}>
                          <div className="flex items-center gap-2 min-w-0 max-w-full overflow-hidden">
                            <span className="font-medium truncate min-w-0 max-w-[180px] block">{group.name}</span>
                            {group.userRole && (
                              <span className={`text-xs px-1.5 py-0.5 rounded border ${ROLE_COLORS[group.userRole]}`}>
                                {ROLE_LABELS[group.userRole]}
                              </span>
                            )}
                          </div>
                        </DropdownItem>
                      ))
                  )}
                </div>
                <DropdownSeparator />
                <DropdownItem icon={<Users className="w-4 h-4" />} onSelect={() => navigate('/discover')}>
                  Find a static
                </DropdownItem>
                <DropdownItem icon={<Shield className="w-4 h-4" />} onSelect={() => navigate('/dashboard')}>
                  Go to Dashboard
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
          )}
        </div>
      ) : (
        // No statics yet → invite the user to find one
        <Link to="/discover" className={`${segBase} ${onStatic ? segActive : segIdle}`}>
          <Users className="w-4 h-4 flex-shrink-0" />
          <span>Find a static</span>
        </Link>
      )}
    </div>
  );
}
