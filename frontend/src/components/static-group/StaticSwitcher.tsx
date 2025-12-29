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
import { Badge } from '../primitives';

// Role badge variants
const ROLE_VARIANTS: Record<MemberRole, 'info' | 'caster' | 'tank' | 'default'> = {
  owner: 'info',
  lead: 'caster',
  member: 'tank',
  viewer: 'default',
};

interface StaticSwitcherProps {
  currentGroup: StaticGroup;
  groups: StaticGroupListItem[];
  onFetchGroups: () => void;
  isMember: boolean;
}

export function StaticSwitcher({
  currentGroup,
  groups,
  onFetchGroups,
  isMember,
}: StaticSwitcherProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch groups when dropdown opens
  useEffect(() => {
    if (isOpen && isMember) {
      onFetchGroups();
    }
  }, [isOpen, isMember, onFetchGroups]);

  // Non-member: show plain text (no dropdown)
  if (!isMember) {
    return (
      <span className="font-display text-lg text-text-primary px-2">
        {currentGroup.name}
      </span>
    );
  }

  return (
    <Dropdown open={isOpen} onOpenChange={setIsOpen}>
      <DropdownTrigger>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-interactive transition-colors border border-border-subtle">
          <span className="font-display text-lg text-accent max-w-[200px] truncate">
            {currentGroup.name}
          </span>
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

      <DropdownContent align="start" className="w-72">
        {/* Static list */}
        <div className="max-h-64 overflow-y-auto">
          {groups.length === 0 ? (
            <div className="px-4 py-3 text-text-muted text-sm">
              No statics found
            </div>
          ) : (
            groups.map((group) => {
              const isCurrent = group.id === currentGroup.id;
              return (
                <DropdownItem
                  key={group.id}
                  onSelect={() => navigate(`/group/${group.shareCode}`)}
                  className={isCurrent ? 'bg-active-bg text-accent' : ''}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate flex-1 min-w-0">{group.name}</span>
                    {group.userRole ? (
                      <Badge variant={ROLE_VARIANTS[group.userRole]} size="sm">
                        {group.userRole.charAt(0).toUpperCase() + group.userRole.slice(1)}
                      </Badge>
                    ) : group.source === 'linked' ? (
                      <Badge variant="warning" size="sm">
                        Linked
                      </Badge>
                    ) : null}
                  </div>
                </DropdownItem>
              );
            })
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
