/**
 * AdminBanners Component
 *
 * Displays admin access indicator at the top of GroupView.
 * Shows when admin is viewing a static via Admin Dashboard (adminMode=true).
 *
 * Note: "View As" banner is handled globally by ViewAsBanner in Layout.
 */

import { ShieldAlert, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface AdminBannersProps {
  isAdminAccess: boolean;
  /** Callback triggered when exiting admin mode - used to refresh group data */
  onExitAdminMode?: () => void;
}

export function AdminBanners({ isAdminAccess, onExitAdminMode }: AdminBannersProps) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAdminAccess) {
    return null;
  }

  const handleExitAdminMode = () => {
    // Remove adminMode param from URL
    const params = new URLSearchParams(location.search);
    params.delete('adminMode');
    params.delete('viewAs'); // Also clear viewAs if present
    const newSearch = params.toString();
    const newPath = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
    navigate(newPath, { replace: true });

    // Trigger group refetch to get correct permissions without admin elevation
    onExitAdminMode?.();
  };

  return (
    <div className="mb-3 p-3 bg-status-warning/10 border border-status-warning/30 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-status-warning" />
          <span className="text-sm text-status-warning">
            <span className="font-medium">Admin Mode:</span>{' '}
            You have owner-level permissions for this static.
          </span>
        </div>
        <button
          onClick={handleExitAdminMode}
          className="flex items-center gap-1.5 px-3 py-1 text-sm text-status-warning hover:text-status-warning/80 hover:bg-status-warning/20 rounded transition-colors"
        >
          <X className="w-4 h-4" />
          Exit Admin Mode
        </button>
      </div>
    </div>
  );
}
