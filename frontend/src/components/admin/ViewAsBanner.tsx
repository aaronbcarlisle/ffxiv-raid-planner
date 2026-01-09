/**
 * ViewAs Banner - Shows when admin is viewing as another user
 *
 * Displays prominently at the top of the page to remind the admin
 * they're seeing the view from another user's perspective.
 */

import { useViewAsStore } from '../../stores/viewAsStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, X } from 'lucide-react';

// Role badge colors (matching other components)
const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-teal-500/30 text-teal-300 border-teal-500/50',
  lead: 'bg-purple-500/30 text-purple-300 border-purple-500/50',
  member: 'bg-blue-500/30 text-blue-300 border-blue-500/50',
  viewer: 'bg-zinc-500/30 text-zinc-300 border-zinc-500/50',
};

export function ViewAsBanner() {
  const { viewAsUser, stopViewAs } = useViewAsStore();
  const navigate = useNavigate();
  const location = useLocation();

  if (!viewAsUser) {
    return null;
  }

  const handleExitViewAs = () => {
    // Remove viewAs param from URL
    const params = new URLSearchParams(location.search);
    params.delete('viewAs');
    const newSearch = params.toString();
    const newPath = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
    navigate(newPath, { replace: true });

    // Clear the viewAs state
    stopViewAs();
  };

  const displayName = viewAsUser.displayName || viewAsUser.discordUsername;
  const roleLabel = viewAsUser.role
    ? viewAsUser.role.charAt(0).toUpperCase() + viewAsUser.role.slice(1)
    : 'Not a member';
  const roleColor = viewAsUser.role ? ROLE_COLORS[viewAsUser.role] : 'bg-red-500/30 text-red-300 border-red-500/50';

  return (
    <div className="bg-amber-500/20 border-b border-amber-500/30">
      <div className="max-w-[120rem] mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="w-4 h-4 text-amber-400" />
          <span className="text-amber-200 text-sm">
            Viewing as{' '}
            <span className="font-medium text-amber-100">
              {displayName}
            </span>
          </span>

          {/* Role badge */}
          <span className={`text-xs px-2 py-0.5 rounded border ${roleColor}`}>
            {roleLabel}
          </span>

          {/* Linked player info */}
          {viewAsUser.isLinkedPlayer && viewAsUser.linkedPlayerName && (
            <span className="text-xs text-amber-300/70">
              (linked to {viewAsUser.linkedPlayerName})
            </span>
          )}
        </div>

        <button
          onClick={handleExitViewAs}
          className="flex items-center gap-1.5 px-3 py-1 text-sm text-amber-200 hover:text-amber-100 hover:bg-amber-500/20 rounded transition-colors"
        >
          <X className="w-4 h-4" />
          Exit View As
        </button>
      </div>
    </div>
  );
}
