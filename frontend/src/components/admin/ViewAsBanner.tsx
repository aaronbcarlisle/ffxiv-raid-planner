/**
 * ViewAs Banner - Shows when admin is viewing as another user
 *
 * Displays prominently at the top of the page to remind the admin
 * they're seeing the view from another user's perspective.
 */

import { useViewAsStore } from '../../stores/viewAsStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, X } from 'lucide-react';

// Role badge colors - using semantic membership tokens
const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-membership-owner/30 text-membership-owner border-membership-owner/50',
  lead: 'bg-membership-lead/30 text-membership-lead border-membership-lead/50',
  member: 'bg-membership-member/30 text-membership-member border-membership-member/50',
  viewer: 'bg-membership-viewer/30 text-membership-viewer border-membership-viewer/50',
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
  const roleColor = viewAsUser.role ? ROLE_COLORS[viewAsUser.role] : 'bg-status-error/30 text-status-error border-status-error/50';

  return (
    <div className="bg-status-warning/20 border-b border-status-warning/30">
      <div className="max-w-[120rem] mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="w-4 h-4 text-status-warning" />
          <span className="text-status-warning text-sm">
            Viewing as{' '}
            <span className="font-medium text-status-warning">
              {displayName}
            </span>
          </span>

          {/* Role badge */}
          <span className={`text-xs px-2 py-0.5 rounded border ${roleColor}`}>
            {roleLabel}
          </span>

          {/* Linked player info */}
          {viewAsUser.isLinkedPlayer && viewAsUser.linkedPlayerName && (
            <span className="text-xs text-status-warning/70">
              (linked to {viewAsUser.linkedPlayerName})
            </span>
          )}
        </div>

        <button
          onClick={handleExitViewAs}
          className="flex items-center gap-1.5 px-3 py-1 text-sm text-status-warning hover:text-status-warning/80 hover:bg-status-warning/20 rounded transition-colors"
        >
          <X className="w-4 h-4" />
          Exit View As
        </button>
      </div>
    </div>
  );
}
