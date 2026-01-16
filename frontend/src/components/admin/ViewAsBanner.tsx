/**
 * ViewAs Banner - Shows when admin is viewing as another user
 *
 * Displays prominently at the top of the page to remind the admin
 * they're seeing the view from another user's perspective.
 */

import { useViewAsStore } from '../../stores/viewAsStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, X, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Tooltip } from '../primitives/Tooltip';
import type { MemberInfo, LinkedPlayerInfo, MemberRole, Membership } from '../../types';

// Extended member info with role for user swapping
interface SwapUserInfo extends MemberInfo {
  role?: MemberRole;
  isLinkedPlayer?: boolean;
}

// Role badge colors - using semantic membership tokens
const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-membership-owner/30 text-membership-owner border-membership-owner/50',
  lead: 'bg-membership-lead/30 text-membership-lead border-membership-lead/50',
  member: 'bg-membership-member/30 text-membership-member border-membership-member/50',
  viewer: 'bg-membership-viewer/30 text-membership-viewer border-membership-viewer/50',
};

export function ViewAsBanner() {
  const { viewAsUser, stopViewAs, startViewAs } = useViewAsStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [availableUsers, setAvailableUsers] = useState<SwapUserInfo[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch available users when component mounts or groupId changes
  // MUST be called before any early returns (Rules of Hooks)
  useEffect(() => {
    const fetchUsers = async () => {
      if (!viewAsUser?.groupId) return;

      setIsLoadingUsers(true);
      try {
        // Use api wrapper for automatic token refresh on 401
        const [members, linkedPlayers] = await Promise.all([
          api.get<Membership[]>(`/api/static-groups/${viewAsUser.groupId}/members`).catch((error) => {
            console.error('Failed to fetch group members for ViewAsBanner:', error);
            return [] as Membership[];
          }),
          api.get<LinkedPlayerInfo[]>(`/api/static-groups/${viewAsUser.groupId}/linked-players`).catch((error) => {
            console.error('Failed to fetch linked players for ViewAsBanner:', error);
            return [] as LinkedPlayerInfo[];
          }),
        ]);

        const allUsers: SwapUserInfo[] = [];
        const seenIds = new Set<string>();

        // Add group members (with role information)
        for (const m of members) {
          if (m.user && !seenIds.has(m.user.id)) {
            allUsers.push({
              ...m.user,
              role: m.role,
              isLinkedPlayer: false,
            });
            seenIds.add(m.user.id);
          }
        }

        // Add linked players (users who have player cards but aren't members)
        for (const lp of linkedPlayers) {
          if (lp.user && !seenIds.has(lp.user.id)) {
            allUsers.push({
              ...lp.user,
              role: undefined,
              isLinkedPlayer: true,
            });
            seenIds.add(lp.user.id);
          }
        }

        setAvailableUsers(allUsers);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [viewAsUser?.groupId]);

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

  const handleSwitchUser = async (newUserId: string) => {
    if (newUserId === viewAsUser.userId) {
      setShowDropdown(false);
      return;
    }

    // Update URL with new viewAs param
    const params = new URLSearchParams(location.search);
    params.set('viewAs', newUserId);
    const newPath = `${location.pathname}?${params.toString()}`;
    navigate(newPath, { replace: true });

    // Update viewAs state
    await startViewAs(viewAsUser.groupId, newUserId);
    setShowDropdown(false);
  };

  const displayName = viewAsUser.displayName || viewAsUser.discordUsername;
  const roleLabel = viewAsUser.role
    ? viewAsUser.role.charAt(0).toUpperCase() + viewAsUser.role.slice(1)
    : 'Not a member';
  const roleColor = viewAsUser.role ? ROLE_COLORS[viewAsUser.role] : 'bg-status-error/30 text-status-error border-status-error/50';

  return (
    <div className="bg-status-warning/20 border-b border-status-warning/30">
      <div className="max-w-[160rem] mx-auto px-4 py-2 flex items-center justify-between">
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

          {/* User swap dropdown */}
          <div className="relative">
            <Tooltip content="Switch to another user">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-status-warning hover:bg-status-warning/20 rounded transition-colors border border-status-warning/30"
              >
                <ChevronDown className="w-3 h-3" />
                Switch User
              </button>
            </Tooltip>

            {showDropdown && (
              <>
                {/* Backdrop to close dropdown */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDropdown(false)}
                />

                {/* Dropdown menu */}
                <div className="absolute left-0 top-full mt-1 w-64 bg-surface-overlay border border-border-default rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  {isLoadingUsers ? (
                    <div className="p-4 text-center text-text-muted text-sm">
                      Loading users...
                    </div>
                  ) : availableUsers.length === 0 ? (
                    <div className="p-4 text-center text-text-muted text-sm">
                      No other users available
                    </div>
                  ) : (
                    <div className="p-1">
                      {availableUsers.map((user) => {
                        const isCurrentUser = user.id === viewAsUser.userId;
                        const userRoleColor = user.role ? ROLE_COLORS[user.role] : 'bg-membership-linked/20 text-membership-linked border-membership-linked/30';
                        const userRoleLabel = user.role
                          ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
                          : 'Linked';

                        return (
                          <button
                            key={user.id}
                            onClick={() => handleSwitchUser(user.id)}
                            className={`w-full flex items-center gap-2 p-2 rounded text-left transition-colors ${
                              isCurrentUser
                                ? 'bg-status-warning/20 cursor-default'
                                : 'hover:bg-surface-interactive'
                            }`}
                            disabled={isCurrentUser}
                          >
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt=""
                                className="w-6 h-6 rounded-full flex-shrink-0"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-surface-elevated flex items-center justify-center text-xs text-text-muted flex-shrink-0">
                                ?
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-text-primary truncate">
                                {user.displayName || user.discordUsername}
                                {isCurrentUser && (
                                  <span className="ml-1 text-status-warning">(current)</span>
                                )}
                              </p>
                            </div>
                            <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${userRoleColor}`}>
                              {userRoleLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
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
