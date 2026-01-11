/**
 * Dashboard Page
 *
 * Shows user's static groups with ability to create new ones.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Copy, Settings, Trash2, LayoutGrid, List } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { toast } from '../stores/toastStore';
import { ContextMenu, Select, Input, Label, Checkbox, Modal, Spinner, StaticGridSkeleton, StaticListSkeleton, ErrorMessage } from '../components/ui';
import { Button, IconButton } from '../components/primitives';
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

// Role badge colors - using semantic membership tokens
const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-membership-owner/20 text-membership-owner border-membership-owner/30',
  lead: 'bg-membership-lead/20 text-membership-lead border-membership-lead/30',
  member: 'bg-membership-member/20 text-membership-member border-membership-member/30',
  viewer: 'bg-membership-viewer/20 text-membership-viewer border-membership-viewer/30',
};

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
};

// Linked badge (for groups where user is linked to a player but not a member)
const LINKED_BADGE_COLOR = 'bg-membership-linked/20 text-membership-linked border-membership-linked/30';

export function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { groups, isLoading, isCreating, error, fetchGroups, createGroup, duplicateGroup, deleteGroup, clearError } = useStaticGroupStore();

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

    const groupName = selectedGroup.name;
    setIsDeleting(true);
    try {
      await deleteGroup(selectedGroup.id);
      toast.success(`${groupName} deleted successfully`);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      setSelectedGroup(null);
    } catch {
      toast.error(`Failed to delete ${groupName}`);
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
        label: 'Open Static',
        icon: <FolderOpen className="w-4 h-4" />,
        onClick: handleEditStatic,
      },
      {
        label: 'Duplicate Static',
        icon: <Copy className="w-4 h-4" />,
        onClick: handleDuplicateStatic,
      },
      ...(isOwner ? [{
        label: 'Settings',
        icon: <Settings className="w-4 h-4" />,
        onClick: handleOpenSettings,
      }] : []),
      ...(isOwner ? [{
        label: 'Delete Static',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: handleDeleteStatic,
        danger: true,
      }] : []),
    ];
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading authentication" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display text-accent">My Statics</h1>
          <p className="text-text-muted mt-1">Manage your raid groups</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sort mode dropdown */}
          {groups.length > 0 && (
            <Select
              value={sortMode}
              onChange={(val) => setSortMode(val as DashboardSort)}
              options={Object.entries(SORT_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              className="w-36"
            />
          )}
          {/* View mode toggle */}
          {groups.length > 0 && (
            <div className="flex bg-surface-raised rounded-md border border-border-default">
              <IconButton
                icon={<LayoutGrid className="w-4 h-4" />}
                onClick={() => setViewMode('grid')}
                variant={viewMode === 'grid' ? 'primary' : 'ghost'}
                size="sm"
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                className={`rounded-r-none ${viewMode === 'grid' ? 'bg-accent/20' : ''}`}
              />
              <IconButton
                icon={<List className="w-4 h-4" />}
                onClick={() => setViewMode('list')}
                variant={viewMode === 'list' ? 'primary' : 'ghost'}
                size="sm"
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
                className={`rounded-l-none border-l border-border-default ${viewMode === 'list' ? 'bg-accent/20' : ''}`}
              />
            </div>
          )}
          <Button onClick={() => setShowCreateModal(true)}>
            Create Static
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <ErrorMessage
          message={error}
          onRetry={fetchGroups}
          onDismiss={clearError}
          retrying={isLoading}
          className="mb-6"
        />
      )}

      {/* Loading */}
      {isLoading ? (
        viewMode === 'grid' ? (
          <StaticGridSkeleton count={6} />
        ) : (
          <StaticListSkeleton count={6} />
        )
      ) : groups.length === 0 ? (
        /* Empty state with onboarding guidance */
        <div className="bg-surface-card rounded-lg border border-border-default p-8">
          <div className="text-center mb-8">
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
            <h2 className="text-xl font-display text-accent mb-2">Welcome to FFXIV Raid Planner</h2>
            <p className="text-text-muted max-w-md mx-auto">
              Track your static's gear progress, manage loot distribution, and coordinate Best-in-Slot (BiS) builds.
            </p>
          </div>

          {/* Getting started steps */}
          <div className="grid gap-4 sm:grid-cols-3 mb-8 max-w-3xl mx-auto">
            <div className="bg-surface-raised rounded-lg p-4 border border-border-subtle">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent text-sm font-bold">1</span>
                <h3 className="font-medium text-text-primary">Create a Static</h3>
              </div>
              <p className="text-sm text-text-muted">
                Set up your raid group with a name. Share the code to let members join.
              </p>
            </div>
            <div className="bg-surface-raised rounded-lg p-4 border border-border-subtle">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent text-sm font-bold">2</span>
                <h3 className="font-medium text-text-primary">Add Players</h3>
              </div>
              <p className="text-sm text-text-muted">
                Add your 8 raiders with their jobs. Assign positions for G1/G2 organization.
              </p>
            </div>
            <div className="bg-surface-raised rounded-lg p-4 border border-border-subtle">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent text-sm font-bold">3</span>
                <h3 className="font-medium text-text-primary">Import BiS</h3>
              </div>
              <p className="text-sm text-text-muted">
                Link XIVGear or Etro sets to track each player's best-in-slot gear goals.
              </p>
            </div>
          </div>

          <div className="text-center">
            <Button onClick={() => setShowCreateModal(true)}>
              Create Your First Static
            </Button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* Groups grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedGroups.map((group) => (
            <div
              key={group.id}
              onClick={() => navigate(`/group/${group.shareCode}`)}
              onContextMenu={(e) => handleContextMenu(e, group)}
              className="block bg-surface-card rounded-lg border border-border-default p-4 hover:border-accent/50 transition-colors group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-display text-lg text-accent group-hover:text-accent-bright transition-colors">
                  {group.name}
                </h3>
                {group.source === 'linked' ? (
                  <span className={`text-xs px-2 py-0.5 rounded border ${LINKED_BADGE_COLOR}`}>
                    Linked
                  </span>
                ) : group.userRole ? (
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${ROLE_COLORS[group.userRole]}`}
                  >
                    {ROLE_LABELS[group.userRole]}
                  </span>
                ) : null}
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

              <div className="mt-3 pt-3 border-t border-border-subtle text-xs text-text-muted flex items-center justify-between">
                <span>
                  Code: <span className="font-mono text-accent">{group.shareCode}</span>
                </span>
                <button
                  onClick={(e) => handleCopyCode(group.shareCode, e)}
                  className="p-1 rounded hover:bg-surface-interactive transition-colors"
                  title="Copy code (hold Shift for full URL)"
                  aria-label="Copy share code"
                >
                  {copiedCode === group.shareCode ? (
                    <svg className="w-3.5 h-3.5 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-text-muted hover:text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
        <div className="bg-surface-card rounded-lg border border-border-default divide-y divide-border-subtle">
          {sortedGroups.map((group) => (
            <div
              key={group.id}
              onClick={() => navigate(`/group/${group.shareCode}`)}
              onContextMenu={(e) => handleContextMenu(e, group)}
              className="flex items-center justify-between p-4 hover:bg-surface-interactive transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <h3 className="font-display text-lg text-accent group-hover:text-accent-bright transition-colors truncate">
                  {group.name}
                </h3>
                {group.source === 'linked' ? (
                  <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${LINKED_BADGE_COLOR}`}>
                    Linked
                  </span>
                ) : group.userRole ? (
                  <span
                    className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${ROLE_COLORS[group.userRole]}`}
                  >
                    {ROLE_LABELS[group.userRole]}
                  </span>
                ) : null}
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
                    className="p-1 rounded hover:bg-surface-elevated transition-colors"
                    title="Copy code (hold Shift for full URL)"
                    aria-label="Copy share code"
                  >
                    {copiedCode === group.shareCode ? (
                      <svg className="w-4 h-4 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-text-muted hover:text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setNewGroupName('');
            setNewGroupPublic(false);
          }}
          title="Create Static Group"
        >
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                value={newGroupName}
                onChange={setNewGroupName}
                placeholder="e.g., Girliepops, Hardcore Raiders"
                autoFocus
              />
            </div>

            <div>
              <Checkbox
                checked={newGroupPublic}
                onChange={setNewGroupPublic}
                label="Make this group public (anyone with the link can view)"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewGroupName('');
                  setNewGroupPublic(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newGroupName.trim()}
                loading={isCreating}
              >
                Create
              </Button>
            </div>
          </form>
        </Modal>
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
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setDeleteConfirmText('');
          }}
          title="Delete Static"
        >
          <div className="space-y-4">
            <div className="p-3 bg-status-error/10 border border-status-error/30 rounded">
              <p className="text-status-error font-medium mb-2">Delete this static?</p>
              <p className="text-text-secondary text-sm">
                This will permanently delete <strong className="text-text-primary">{selectedGroup.name}</strong> and all its tier snapshots.
                This action cannot be undone.
              </p>
            </div>

            <div>
              <Label htmlFor="deleteConfirm">
                Type <span className="font-mono text-text-primary">{selectedGroup.name}</span> to confirm
              </Label>
              <Input
                id="deleteConfirm"
                value={deleteConfirmText}
                onChange={setDeleteConfirmText}
                placeholder={selectedGroup.name}
                error={deleteConfirmText !== '' && deleteConfirmText !== selectedGroup.name ? 'Name does not match' : undefined}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmDelete}
                disabled={deleteConfirmText !== selectedGroup.name}
                loading={isDeleting}
              >
                Delete Static
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
