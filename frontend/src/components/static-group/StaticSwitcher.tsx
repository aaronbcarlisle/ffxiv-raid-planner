/**
 * Static Switcher
 *
 * Dropdown for quickly switching between static groups.
 * Migrated to Radix DropdownMenu for accessibility.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StaticGroup, StaticGroupListItem, MemberRole } from '../../types';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from '../primitives';
import { Tooltip } from '../primitives';

// Role badge colors using semantic membership tokens
const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-membership-owner/20 text-membership-owner border-membership-owner/30',
  lead: 'bg-membership-lead/20 text-membership-lead border-membership-lead/30',
  member: 'bg-membership-member/20 text-membership-member border-membership-member/30',
  viewer: 'bg-membership-viewer/20 text-membership-viewer border-membership-viewer/30',
};

// Full and abbreviated role labels
const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
};

const ROLE_LABELS_SHORT: Record<MemberRole, string> = {
  owner: 'O',
  lead: 'L',
  member: 'M',
  viewer: 'V',
};

interface StaticSwitcherProps {
  currentGroup: StaticGroup;
  groups: StaticGroupListItem[];
  onFetchGroups: () => void;
  isMember: boolean;
  /** Current user's role in this static */
  userRole?: MemberRole;
  /** Whether to expand to fill available width on mobile */
  fullWidthMobile?: boolean;
}

export function StaticSwitcher({
  currentGroup,
  groups,
  onFetchGroups,
  isMember,
  userRole,
  fullWidthMobile,
}: StaticSwitcherProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch groups when dropdown opens
  useEffect(() => {
    if (isOpen && isMember) {
      onFetchGroups();
    }
  }, [isOpen, isMember, onFetchGroups]);

  // Non-member: show plain text (no dropdown) with tooltip
  if (!isMember) {
    return (
      <Tooltip
        content={
          <div>
            <div className="font-medium">Current Static</div>
            <div className="text-text-secondary text-xs mt-0.5">
              Join as a member to switch between statics
            </div>
          </div>
        }
      >
        <span className={`font-display text-base sm:text-lg text-text-primary px-2 cursor-help truncate inline-block ${fullWidthMobile ? 'flex-1 max-w-none sm:max-w-[200px] sm:flex-initial' : 'max-w-[120px] sm:max-w-[200px]'}`}>
          {currentGroup.name}
        </span>
      </Tooltip>
    );
  }

  return (
    <Dropdown open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip
        disabled={isOpen}
        content={
          <div>
            <div className="flex items-center gap-2 font-medium">
              Switch Static
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">⌘/Ctrl</kbd>
                <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">[</kbd>
                <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">]</kbd>
              </span>
            </div>
            <div className="text-text-secondary text-xs mt-0.5">
              Click to switch or use shortcuts to cycle
            </div>
          </div>
        }
      >
        <span className={fullWidthMobile ? 'flex-1 sm:flex-initial sm:inline-flex' : 'inline-flex'}>
          <DropdownTrigger>
            {/* Radix DropdownMenu requires native button as trigger */}
            <button // design-system-ignore
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-interactive transition-colors border border-border-subtle focus:outline-none ${fullWidthMobile ? 'w-full sm:w-auto' : ''}`}
            >
              <span className={`font-display text-base sm:text-lg text-accent truncate ${fullWidthMobile ? 'flex-1 text-left sm:flex-initial sm:max-w-[200px]' : 'max-w-[140px] sm:max-w-[200px]'}`}>
                {currentGroup.name}
              </span>
              {userRole && (
                <span className={`text-xs px-1.5 py-0.5 rounded border ${ROLE_COLORS[userRole]}`}>
                  <span className="sm:hidden">{ROLE_LABELS_SHORT[userRole]}</span>
                  <span className="hidden sm:inline">{ROLE_LABELS[userRole]}</span>
                </span>
              )}
              <svg
                className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </DropdownTrigger>
        </span>
      </Tooltip>

      <DropdownContent align="start" className="w-72 overflow-hidden">
        {/* Static list */}
        <div className="max-h-64 overflow-y-auto overflow-x-hidden">
          {groups.length === 0 ? (
            <div className="px-4 py-3 text-text-muted text-sm">
              No statics found
            </div>
          ) : (
            groups
              .filter((group) => group.id !== currentGroup.id) // Exclude current group from list
              .map((group) => (
                <DropdownItem
                  key={group.id}
                  onSelect={() => navigate(`/group/${group.shareCode}`)}
                >
                  <div className="flex items-center gap-2 min-w-0 max-w-full overflow-hidden">
                    <Tooltip content={group.name}>
                      <span className="font-medium truncate min-w-0 max-w-[180px] block">
                        {group.name}
                      </span>
                    </Tooltip>
                    {group.userRole ? (
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${ROLE_COLORS[group.userRole]}`}>
                        {ROLE_LABELS[group.userRole]}
                      </span>
                    ) : group.source === 'linked' ? (
                      <span className="text-xs px-1.5 py-0.5 rounded border bg-membership-linked/20 text-membership-linked border-membership-linked/30">
                        Linked
                      </span>
                    ) : null}
                  </div>
                </DropdownItem>
              ))
          )}
        </div>

        <DropdownSeparator />

        {/* Dashboard link */}
        <DropdownItem
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          }
          onSelect={() => navigate('/dashboard')}
        >
          Go to Dashboard
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
