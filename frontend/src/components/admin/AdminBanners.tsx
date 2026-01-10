/**
 * AdminBanners Component
 *
 * Displays admin access and "View As" indicators at the top of GroupView.
 * Shows when admin is viewing a static they're not a member of,
 * or when admin is impersonating another user.
 */

import { ShieldAlert, Eye } from 'lucide-react';

interface ViewAsUser {
  userId: string;
  displayName?: string;
  discordUsername?: string;
  role?: string;
}

export interface AdminBannersProps {
  isAdminAccess: boolean;
  viewAsUser: ViewAsUser | null;
  onExitViewAs: () => void;
}

export function AdminBanners({
  isAdminAccess,
  viewAsUser,
  onExitViewAs,
}: AdminBannersProps) {
  return (
    <>
      {/* Admin viewing indicator - shows when admin is viewing a static they're not a member of */}
      {isAdminAccess && (
        <div className="mb-3 p-3 bg-status-warning/10 border border-status-warning/30 rounded-lg">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-status-warning" />
            <span className="text-sm text-status-warning">
              <span className="font-medium">Admin Access:</span>{' '}
              You're viewing this static as an administrator. You have owner-level permissions but are not a member.
            </span>
          </div>
        </div>
      )}

      {/* View As indicator - shows when admin is viewing as another user */}
      {viewAsUser && (
        <div className="mb-3 p-3 bg-membership-lead/10 border border-membership-lead/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-membership-lead" />
              <span className="text-sm text-membership-lead">
                <span className="font-medium">Viewing as:</span>{' '}
                {viewAsUser.displayName || viewAsUser.discordUsername}
                <span className="ml-1 text-membership-lead/70">
                  ({viewAsUser.role || 'no membership'})
                </span>
              </span>
            </div>
            <button
              onClick={onExitViewAs}
              className="text-sm text-membership-lead hover:text-membership-lead/80 px-3 py-1 rounded bg-membership-lead/20 hover:bg-membership-lead/30 transition-colors"
            >
              Exit View As
            </button>
          </div>
        </div>
      )}
    </>
  );
}
