/**
 * Group Header
 *
 * Displays static group info: name, role badge, settings button, and share code.
 */

import type { MemberRole } from '../../types';

// Role badge colors
const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  lead: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  member: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

interface GroupHeaderProps {
  name: string;
  shareCode: string;
  isPublic: boolean;
  userRole?: MemberRole;
  onSettingsClick?: () => void;
}

export function GroupHeader({
  name,
  shareCode,
  isPublic,
  userRole,
  onSettingsClick,
}: GroupHeaderProps) {
  const isOwner = userRole === 'owner';

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-display text-accent">{name}</h1>
        {userRole && (
          <span className={`text-xs px-2 py-0.5 rounded border ${ROLE_COLORS[userRole]}`}>
            {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
          </span>
        )}
        {/* Settings button (owner only) */}
        {isOwner && onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="p-1.5 rounded hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
            title="Static Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>
      <p className="text-text-muted text-sm mt-1">
        Code: <span className="font-mono text-accent">{shareCode}</span>
        {isPublic ? ' (Public)' : ' (Private)'}
      </p>
    </div>
  );
}
