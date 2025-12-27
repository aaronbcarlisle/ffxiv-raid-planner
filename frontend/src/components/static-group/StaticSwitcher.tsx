/**
 * Static Switcher
 *
 * Dropdown for quickly switching between static groups.
 * Shows current static name with chevron, lists all user's statics on click.
 */

import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { StaticGroup, StaticGroupListItem, MemberRole } from '../../types';

// Role badge colors
const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-yellow-500/20 text-yellow-400',
  lead: 'bg-purple-500/20 text-purple-400',
  member: 'bg-blue-500/20 text-blue-400',
  viewer: 'bg-gray-500/20 text-gray-400',
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
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch groups when dropdown opens
  useEffect(() => {
    if (isOpen && isMember) {
      onFetchGroups();
    }
  }, [isOpen, isMember, onFetchGroups]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleSelectGroup = (shareCode: string) => {
    setIsOpen(false);
    navigate(`/group/${shareCode}`);
  };

  // Non-member: show plain text (no dropdown)
  if (!isMember) {
    return (
      <span className="font-display text-lg text-text-primary px-2">
        {currentGroup.name}
      </span>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-card hover:bg-bg-hover transition-colors border border-border-subtle"
      >
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

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-bg-elevated border border-border-subtle rounded-lg shadow-xl z-50 overflow-hidden">
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
                  <button
                    key={group.id}
                    onClick={() => handleSelectGroup(group.shareCode)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                      isCurrent
                        ? 'bg-accent/10 text-accent'
                        : 'hover:bg-bg-hover text-text-primary'
                    }`}
                  >
                    <span className="truncate font-medium">{group.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${ROLE_COLORS[group.userRole]}`}>
                      {group.userRole.charAt(0).toUpperCase() + group.userRole.slice(1)}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Dashboard link */}
          <div className="border-t border-border-subtle">
            <Link
              to="/dashboard"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm">Go to Dashboard</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
