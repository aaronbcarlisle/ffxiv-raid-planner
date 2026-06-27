/* eslint-disable design-system/no-raw-button */
/**
 * ContextSwitcher
 *
 * A segmented control in the header that swaps between the two peer contexts —
 * the Player Hub and a Static — instead of relying on back-links. The active
 * context is highlighted; the Static segment carries a ▾ that opens the list
 * of the user's statics (and a link to the dashboard).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { User, Shield, ChevronDown, Users, Calendar } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { TRANSIENT_NAV_PARAMS, prefRememberTabs } from '../../lib/navPreferences';
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

const SELECTED_STATIC_KEY = 'context-selected-static';

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
  const rememberStaticTab = useAuthStore((s) => prefRememberTabs(s.user));
  const [open, setOpen] = useState(false);

  // The "selected static" the Static segment points at. Off-route (Player Hub /
  // Static Finder) the ▾ dropdown only updates this selection — you click the
  // static name to navigate. But when you're already IN the Static view,
  // selecting a different static navigates immediately (you're switching the
  // view you're looking at). The selection is retained across context switches
  // and reloads, so the segment never resets to the first static.
  const [selectedCode, setSelectedCode] = useState<string | null>(() => {
    try { return localStorage.getItem(SELECTED_STATIC_KEY); } catch { return null; }
  });

  // Entering a static route makes it the selection (route is authoritative).
  // Render-time sync — React's recommended pattern for deriving state from a
  // changing prop; avoids the extra commit (and lint) of a setState effect.
  const [syncedGroupCode, setSyncedGroupCode] = useState<string | null>(currentGroup?.shareCode ?? null);
  if (currentGroup?.shareCode && currentGroup.shareCode !== syncedGroupCode) {
    setSyncedGroupCode(currentGroup.shareCode);
    setSelectedCode(currentGroup.shareCode);
  }

  // Persist the selection (no setState here — lint-safe).
  useEffect(() => {
    if (selectedCode) {
      try { localStorage.setItem(SELECTED_STATIC_KEY, selectedCode); } catch { /* ignore */ }
    }
  }, [selectedCode]);

  useEffect(() => {
    if (open && isMember) onFetchGroups();
  }, [open, isMember, onFetchGroups]);

  const onHub = location.pathname.startsWith('/profile');
  const onFinder = location.pathname.startsWith('/discover');
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

  // Picking a static from the dropdown: always update the selection; navigate
  // immediately only when already in the Static view (switch the view you're on).
  // Off-route (Hub/Finder) it defers — you click the static name to navigate.
  const selectStatic = useCallback((shareCode: string) => {
    setSelectedCode(shareCode);
    setOpen(false);
    if (onStatic) navigate(buildStaticHref(shareCode));
  }, [onStatic, navigate, buildStaticHref]);

  // The static the "Static" segment points to: the selected static (from the
  // dropdown / retained), else the active group, else the first of the user's
  // statics — so the segment keeps working from Player Hub / Static Finder.
  const targetStatic = useMemo<Pick<StaticGroup, 'shareCode' | 'name'> | null>(() => {
    const code = selectedCode ?? currentGroup?.shareCode ?? groups[0]?.shareCode ?? null;
    if (!code) return null;
    if (currentGroup && currentGroup.shareCode === code) {
      return { shareCode: currentGroup.shareCode, name: currentGroup.name };
    }
    const g = groups.find((x) => x.shareCode === code);
    if (g) return { shareCode: g.shareCode, name: g.name };
    // Selection points to a static not in the loaded list yet — fall back.
    if (currentGroup) return { shareCode: currentGroup.shareCode, name: currentGroup.name };
    return groups.length > 0 ? { shareCode: groups[0].shareCode, name: groups[0].name } : null;
  }, [selectedCode, currentGroup, groups]);

  const segRole = useMemo<MemberRole | undefined>(() => {
    if (!targetStatic) return undefined;
    if (currentGroup && currentGroup.shareCode === targetStatic.shareCode) return userRole;
    return groups.find((g) => g.shareCode === targetStatic.shareCode)?.userRole ?? undefined;
  }, [targetStatic, currentGroup, userRole, groups]);

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

      {/* Static Finder segment */}
      <Tooltip content="Static Finder — browse and join open statics">
        <Link to="/discover" className={`${segBase} ${onFinder ? segActive : segIdle} flex-shrink-0`} aria-current={onFinder ? 'page' : undefined}>
          <Users className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Static Finder</span>
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
                        <div key={group.id}>
                          <DropdownItem onSelect={() => selectStatic(group.shareCode)}>
                            <div className="flex items-center gap-2 min-w-0 max-w-full overflow-hidden">
                              <span className="font-medium truncate min-w-0 max-w-[180px] block">{group.name}</span>
                              {group.userRole && (
                                <span className={`text-xs px-1.5 py-0.5 rounded border ${ROLE_COLORS[group.userRole]}`}>
                                  {ROLE_LABELS[group.userRole]}
                                </span>
                              )}
                            </div>
                          </DropdownItem>
                          {/* Per-static Schedule shortcut (lifted from the Player Hub StaticShortcut) */}
                          <DropdownItem href={`/group/${group.shareCode}?tab=schedule`} icon={<Calendar className="w-4 h-4" />} className="pl-8 text-xs">
                            Schedule
                          </DropdownItem>
                        </div>
                      ))
                  )}
                </div>
                <DropdownSeparator />
                <DropdownItem icon={<Users className="w-4 h-4" />} onSelect={() => navigate('/profile?tab=statics')}>
                  Go to My Statics
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
          )}
        </div>
      ) : (
        // No statics yet → muted placeholder (Static Finder segment handles discovery)
        <span className={`${segBase} ${segIdle} opacity-60 cursor-default`} title="No statics yet">
          <Shield className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">No static</span>
        </span>
      )}
    </div>
  );
}
