/**
 * StaticPicker (F6a, Task 9) — v2 conformant static switcher.
 *
 * The v2 TopBar's left-most element. Adapted from `ContextSwitcher`'s Static
 * segment (the ▾ statics list + selection logic), but WITHOUT the Player Hub /
 * Static Finder segments (those are the rail's job now) and built from design-
 * system primitives only: an `IconButton` trigger (no raw `<button>`), a
 * `text-xs` role badge (no `text-[10px]`), and SPA `useNavigate` that preserves
 * the `?shell=v2` gate (no full reload).
 *
 * `ContextSwitcher` is intentionally NOT edited — it still renders in the legacy
 * route and must stay byte-for-byte. This is the new, conformant peer.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Shield, ChevronDown, Users } from 'lucide-react';
import type { StaticGroup, StaticGroupListItem, MemberRole } from '../../types';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  IconButton,
  Tooltip,
} from '../primitives';

// Semantic membership tokens (same set ContextSwitcher uses — zero hardcoded color).
const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-membership-owner/20 text-membership-owner border-membership-owner/30',
  lead: 'bg-membership-lead/20 text-membership-lead border-membership-lead/30',
  member: 'bg-membership-member/20 text-membership-member border-membership-member/30',
  viewer: 'bg-membership-viewer/20 text-membership-viewer border-membership-viewer/30',
};
const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner', lead: 'Lead', member: 'Member', viewer: 'Viewer',
};

interface StaticPickerProps {
  /** The active static on a /group route, if any. */
  currentGroup: StaticGroup | null;
  /** The user's statics (for the switch list). */
  groups: StaticGroupListItem[];
  /** Lazily refresh the statics list when the switch menu opens. */
  onFetchGroups: () => void;
  /** Whether to show the switch (▾) trigger — true when the user has statics. */
  isMember: boolean;
  /** Role of the active static (for the badge). */
  userRole?: MemberRole;
}

export function StaticPicker({
  currentGroup,
  groups,
  onFetchGroups,
  isMember,
  userRole,
}: StaticPickerProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onStatic = location.pathname.startsWith('/group/');

  // Refresh the list when the switch menu opens (parity with ContextSwitcher).
  useEffect(() => {
    if (open && isMember) onFetchGroups();
  }, [open, isMember, onFetchGroups]);

  // The static the picker points at: the active group, else the first of the
  // user's statics (so the picker stays meaningful off-route too).
  const targetStatic = useMemo<Pick<StaticGroup, 'shareCode' | 'name'> | null>(() => {
    if (currentGroup) return { shareCode: currentGroup.shareCode, name: currentGroup.name };
    return groups.length > 0 ? { shareCode: groups[0].shareCode, name: groups[0].name } : null;
  }, [currentGroup, groups]);

  const segRole = useMemo<MemberRole | undefined>(() => {
    if (!targetStatic) return undefined;
    if (currentGroup && currentGroup.shareCode === targetStatic.shareCode) return userRole;
    return groups.find((g) => g.shareCode === targetStatic.shareCode)?.userRole ?? undefined;
  }, [targetStatic, currentGroup, userRole, groups]);

  // Selecting another static navigates immediately ONLY when already viewing a
  // static (you're switching the view you're on). The ?shell=v2 gate is
  // preserved so the SPA navigation stays in the v2 shell (no full reload).
  const selectStatic = useCallback((shareCode: string) => {
    setOpen(false);
    if (onStatic) navigate(`/group/${shareCode}?shell=v2`);
  }, [onStatic, navigate]);

  if (!targetStatic) {
    return (
      <span className="flex items-center gap-1.5 text-text-secondary text-sm" title="No statics yet">
        <Shield className="w-4 h-4 flex-shrink-0" aria-hidden />
        <span>No static</span>
      </span>
    );
  }

  const otherStatics = groups.filter((g) => g.shareCode !== targetStatic.shareCode);

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Shield className="w-4 h-4 flex-shrink-0 text-text-muted" aria-hidden />
      <span className="truncate font-display text-sm text-text-primary max-w-[180px] md:max-w-[280px]">
        {targetStatic.name}
      </span>
      {segRole && (
        <span className={`text-xs px-1 py-0.5 rounded border flex-shrink-0 ${ROLE_COLORS[segRole]}`}>
          {ROLE_LABELS[segRole]}
        </span>
      )}
      {isMember && (
        <Dropdown open={open} onOpenChange={setOpen}>
          <Tooltip content="Switch static">
            <DropdownTrigger asChild>
              <IconButton
                aria-label="Switch static"
                icon={<ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />}
                variant="ghost"
                size="sm"
              />
            </DropdownTrigger>
          </Tooltip>
          <DropdownContent align="start" className="w-72 max-w-[calc(100vw-2rem)] overflow-hidden">
            <div className="max-h-64 overflow-y-auto overflow-x-hidden">
              {otherStatics.length === 0 ? (
                <div className="px-4 py-3 text-text-muted text-sm">No other statics</div>
              ) : (
                otherStatics.map((group) => (
                  <DropdownItem key={group.id} onSelect={() => selectStatic(group.shareCode)}>
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
            <DropdownItem icon={<Users className="w-4 h-4" />} onSelect={() => navigate('/profile?tab=statics')}>
              Go to My Statics
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      )}
    </div>
  );
}
