/**
 * Dashboard Page
 *
 * Shows user's static groups with ability to create new ones.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { ContextMenu } from '../components/ui';
import { GroupSettingsModal } from '../components/static-group';
import type { MemberRole, StaticGroup, StaticGroupListItem } from '../types';

// Sort options
type DashboardSort = 'recent' | 'updated' | 'alphabetical';

const SORT_LABELS: Record<DashboardSort, string> = {
  recent: 'Most Recent',
  updated: 'Last Updated',
  alphabetical: 'Alphabetical',
};

// Get recently accessed share codes from localStorage
function getRecentStaticCodes(): string[] {
  try {
    const saved = localStorage.getItem('recent-statics');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// Role badge colors
const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  lead: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  member: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
};

// Linked badge (for groups where user is linked to a player but not a member)
const LINKED_BADGE_COLOR = 'bg-amber-500/20 text-amber-400 border-amber-500/30';

export function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { groups, isLoading, isCreating, error, fetchGroups, createGroup, duplicateGroup, deleteGroup } = useStaticGroupStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupPublic, setNewGroupPublic] = useState(false);

  // View mode state (grid or list) - persisted to localStorage
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('dashboard-view-mode');
    return saved === 'list' ? 'list' : 'grid';
  });

  // Sort mode state - persisted to localStorage
  const [sortMode, setSortMode] = useState<DashboardSort>(() => {
    const saved = localStorage.getItem('dashboard-sort-mode');
    return (saved as DashboardSort) || 'recent';
  });

  // Persist view mode to localStorage
  useEffect(() => {
    localStorage.setItem('dashboard-view-mode', viewMode);
  }, [viewMode]);

  // Persist sort mode to localStorage
  useEffect(() => {
    localStorage.setItem('dashboard-sort-mode', sortMode);
  }, [sortMode]);

  // Sort groups based on current sort mode
  const sortedGroups = useMemo(() => {
    if (sortMode === 'alphabetical') {
      return [...groups].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortMode === 'updated') {
      return [...groups].sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
    // 'recent' - use localStorage access order
    const recentCodes = getRecentStaticCodes();
    return [...groups].sort((a, b) => {
      const aIndex = recentCodes.indexOf(a.shareCode);
      const bIndex = recentCodes.indexOf(b.shareCode);
      // Not in recent list = sort to end
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [groups, sortMode]);

  // Copy state for feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<StaticGroupListItem | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Copy share code (or full URL if shift is held)
  const handleCopyCode = useCallback(async (shareCode: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = e.shiftKey
      ? `${window.location.origin}/group/${shareCode}`
      : shareCode;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedCode(shareCode);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedCode(shareCode);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Fetch groups on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchGroups();
    }
  }, [isAuthenticated, fetchGroups]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      await createGroup(newGroupName.trim(), newGroupPublic);
      setShowCreateModal(false);
      setNewGroupName('');
      setNewGroupPublic(false);
      // Refresh groups list (group view will be added in Phase 4.3)
      await fetchGroups();
    } catch {
      // Error is handled in store
    }
  };

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, group: StaticGroupListItem) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedGroup(group);
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleEditStatic = useCallback(() => {
    if (selectedGroup) {
      navigate(`/group/${selectedGroup.shareCode}`);
    }
  }, [selectedGroup, navigate]);

  const handleDuplicateStatic = useCallback(async () => {
    if (selectedGroup) {
      try {
        await duplicateGroup(selectedGroup.id, `${selectedGroup.name} (Copy)`);
      } catch {
        // Error handled in store
      }
    }
  }, [selectedGroup, duplicateGroup]);

  const handleOpenSettings = useCallback(() => {
    if (selectedGroup) {
      setShowSettingsModal(true);
    }
  }, [selectedGroup]);

  const handleDeleteStatic = useCallback(() => {
    if (selectedGroup) {
      setShowDeleteConfirm(true);
    }
  }, [selectedGroup]);

  const handleConfirmDelete = async () => {
    if (!selectedGroup || deleteConfirmText !== selectedGroup.name) return;

    setIsDeleting(true);
    try {
      await deleteGroup(selectedGroup.id);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      setSelectedGroup(null);
    } catch {
      // Error handled in store
    } finally {
      setIsDeleting(false);
    }
  };

  // Build context menu items
  const getContextMenuItems = () => {
    if (!selectedGroup) return [];

    const isOwner = selectedGroup.userRole === 'owner';

    return [
      {
        label: 'Edit Static',
        onClick: handleEditStatic,
      },
      {
        label: 'Duplicate Static',
        onClick: handleDuplicateStatic,
      },
      ...(isOwner ? [{
        label: 'Settings',
        onClick: handleOpenSettings,
      }] : []),
      ...(isOwner ? [{
        label: 'Delete Static',
        onClick: handleDeleteStatic,
        danger: true,
      }] : []),
    ];
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display text-accent">My Statics</h1>
          <p className="text-text-muted mt-1">Manage your raid groups</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sort mode dropdown */}
          {groups.length > 0 && (
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as DashboardSort)}
              className="bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
            >
              {(Object.entries(SORT_LABELS) as [DashboardSort, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
          {/* View mode toggle */}
          {groups.length > 0 && (
            <div className="flex bg-bg-secondary rounded-md border border-border-default">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 rounded-l-md text-sm font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
                title="Grid view"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <rect x="1" y="1" width="6" height="6" rx="1" />
                  <rect x="9" y="1" width="6" height="6" rx="1" />
                  <rect x="1" y="9" width="6" height="6" rx="1" />
                  <rect x="9" y="9" width="6" height="6" rx="1" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 rounded-r-md text-sm font-medium transition-colors border-l border-border-default ${
                  viewMode === 'list'
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
                title="List view"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <rect x="1" y="1" width="14" height="4" rx="1" />
                  <rect x="1" y="7" width="14" height="4" rx="1" />
                  <rect x="1" y="13" width="14" height="2" rx="0.5" opacity="0.6" />
                </svg>
              </button>
            </div>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-accent text-bg-primary px-4 py-2 rounded font-medium hover:bg-accent-bright transition-colors"
          >
            Create Static
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        /* Empty state */
        <div className="text-center py-12 bg-bg-card rounded-lg border border-white/10">
          <div className="w-16 h-16 mx-auto mb-4 bg-accent/10 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-display text-accent mb-2">No Statics Yet</h2>
          <p className="text-text-muted mb-6">
            Create your first static group to start tracking gear progress.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-accent text-bg-primary px-6 py-2 rounded font-medium hover:bg-accent-bright transition-colors"
          >
            Create Your First Static
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Groups grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedGroups.map((group) => (
            <div
              key={group.id}
              onClick={() => navigate(`/group/${group.shareCode}`)}
              onContextMenu={(e) => handleContextMenu(e, group)}
              className="block bg-bg-card rounded-lg border border-white/10 p-4 hover:border-accent/50 transition-colors group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-display text-lg text-accent group-hover:text-accent-bright transition-colors">
                  {group.name}
                </h3>
                {group.source === 'linked' ? (
                  <span className={`text-xs px-2 py-0.5 rounded border ${LINKED_BADGE_COLOR}`}>
                    Linked
                  </span>
                ) : (
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${ROLE_COLORS[group.userRole]}`}
                  >
                    {ROLE_LABELS[group.userRole]}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-text-muted">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                </span>

                {group.isPublic ? (
                  <span className="flex items-center gap-1 text-teal-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Public
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    Private
                  </span>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-white/5 text-xs text-text-muted flex items-center justify-between">
                <span>
                  Code: <span className="font-mono text-accent">{group.shareCode}</span>
                </span>
                <button
                  onClick={(e) => handleCopyCode(group.shareCode, e)}
                  className="p-1 rounded hover:bg-bg-hover transition-colors"
                  title="Copy code (hold Shift for full URL)"
                >
                  {copiedCode === group.shareCode ? (
                    <svg className="w-3.5 h-3.5 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-text-muted hover:text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Groups list */
        <div className="bg-bg-card rounded-lg border border-white/10 divide-y divide-white/5">
          {sortedGroups.map((group) => (
            <div
              key={group.id}
              onClick={() => navigate(`/group/${group.shareCode}`)}
              onContextMenu={(e) => handleContextMenu(e, group)}
              className="flex items-center justify-between p-4 hover:bg-bg-hover transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <h3 className="font-display text-lg text-accent group-hover:text-accent-bright transition-colors truncate">
                  {group.name}
                </h3>
                {group.source === 'linked' ? (
                  <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${LINKED_BADGE_COLOR}`}>
                    Linked
                  </span>
                ) : (
                  <span
                    className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${ROLE_COLORS[group.userRole]}`}
                  >
                    {ROLE_LABELS[group.userRole]}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-6 text-sm text-text-muted flex-shrink-0">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  {group.memberCount}
                </span>

                {group.isPublic ? (
                  <span className="flex items-center gap-1 text-teal-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Public
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    Private
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <span className="font-mono text-accent">{group.shareCode}</span>
                  <button
                    onClick={(e) => handleCopyCode(group.shareCode, e)}
                    className="p-1 rounded hover:bg-bg-elevated transition-colors"
                    title="Copy code (hold Shift for full URL)"
                  >
                    {copiedCode === group.shareCode ? (
                      <svg className="w-4 h-4 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-text-muted hover:text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>

                <span className="text-text-muted text-xs">
                  {new Date(group.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={handleCloseContextMenu}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bg-card rounded-lg border border-white/10 p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-display text-accent mb-4">Create Static Group</h2>

            <form onSubmit={handleCreateGroup}>
              <div className="mb-4">
                <label htmlFor="groupName" className="block text-sm text-text-secondary mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  id="groupName"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., Girliepops, Hardcore Raiders"
                  className="w-full bg-bg-primary border border-white/10 rounded px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                  autoFocus
                />
              </div>

              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newGroupPublic}
                    onChange={(e) => setNewGroupPublic(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-bg-primary text-accent focus:ring-accent focus:ring-offset-0"
                  />
                  <span className="text-sm text-text-secondary">
                    Make this group public (anyone with the link can view)
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewGroupName('');
                    setNewGroupPublic(false);
                  }}
                  className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newGroupName.trim() || isCreating}
                  className="bg-accent text-bg-primary px-4 py-2 rounded font-medium hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && selectedGroup && (
        <GroupSettingsModal
          group={selectedGroup as StaticGroup}
          onClose={() => {
            setShowSettingsModal(false);
            fetchGroups(); // Refresh list in case name/visibility changed
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bg-card rounded-lg border border-white/10 p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-display text-red-400 mb-4">Delete Static</h2>

            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
              <p className="text-red-400 font-medium mb-2">Delete this static?</p>
              <p className="text-text-secondary text-sm">
                This will permanently delete <strong className="text-text-primary">{selectedGroup.name}</strong> and all its tier snapshots.
                This action cannot be undone.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-text-secondary mb-1">
                Type <span className="font-mono text-text-primary">{selectedGroup.name}</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full bg-bg-primary border border-red-500/30 rounded px-3 py-2 text-text-primary focus:outline-none focus:border-red-500"
                placeholder={selectedGroup.name}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteConfirmText !== selectedGroup.name || isDeleting}
                className="bg-red-500 text-white px-4 py-2 rounded font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete Static'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
