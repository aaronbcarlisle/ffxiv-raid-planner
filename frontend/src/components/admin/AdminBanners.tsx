/**
 * AdminBanners Component
 *
 * Displays admin access indicator at the top of GroupView.
 * Shows when admin is viewing a static they're not a member of.
 *
 * Note: "View As" banner is handled globally by ViewAsBanner in Layout.
 */

import { ShieldAlert } from 'lucide-react';

export interface AdminBannersProps {
  isAdminAccess: boolean;
}

export function AdminBanners({ isAdminAccess }: AdminBannersProps) {
  if (!isAdminAccess) {
    return null;
  }

  return (
    <div className="mb-3 p-3 bg-status-warning/10 border border-status-warning/30 rounded-lg">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-status-warning" />
        <span className="text-sm text-status-warning">
          <span className="font-medium">Admin Access:</span>{' '}
          You're viewing this static as an administrator. You have owner-level permissions but are not a member.
        </span>
      </div>
    </div>
  );
}
