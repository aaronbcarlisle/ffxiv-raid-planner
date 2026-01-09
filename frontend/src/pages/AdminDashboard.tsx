/**
 * Admin Dashboard Page
 *
 * Shows all static groups in the system for admin troubleshooting.
 * Only accessible to users with isAdmin=true.
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { API_BASE_URL } from '../config';
import { Eye } from 'lucide-react';
import type { AdminStaticGroupListItem, AdminStaticGroupListResponse, MemberInfo } from '../types';

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading, accessToken } = useAuthStore();

  const [groups, setGroups] = useState<AdminStaticGroupListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search and pagination
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  // Copy state for feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // View As modal state
  const [viewAsGroup, setViewAsGroup] = useState<AdminStaticGroupListItem | null>(null);
  const [viewAsMembers, setViewAsMembers] = useState<MemberInfo[]>([]);
  const [viewAsMembersLoading, setViewAsMembersLoading] = useState(false);

  // Fetch members for View As modal
  const fetchMembers = useCallback(async (groupId: string) => {
    if (!accessToken) return;
    setViewAsMembersLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/static-groups/${groupId}/members`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setViewAsMembers(data.map((m: { user: MemberInfo }) => m.user).filter(Boolean));
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setViewAsMembersLoading(false);
    }
  }, [accessToken]);

  // Open View As modal for a group
  const handleOpenViewAs = useCallback((group: AdminStaticGroupListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setViewAsGroup(group);
    fetchMembers(group.id);
  }, [fetchMembers]);

  // Handle View As selection
  const handleViewAs = useCallback((userId: string) => {
    if (!viewAsGroup) return;
    navigate(`/group/${viewAsGroup.shareCode}?viewAs=${userId}`);
    setViewAsGroup(null);
  }, [viewAsGroup, navigate]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/static-groups/admin/all?${params}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          setError('Admin access required');
        } else {
          setError('Failed to fetch groups');
        }
        return;
      }

      const data: AdminStaticGroupListResponse = await response.json();
      setGroups(data.items);
      setTotal(data.total);
    } catch {
      setError('Failed to fetch groups');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, page, debouncedSearch]);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        navigate('/');
      } else if (user && !user.isAdmin) {
        navigate('/dashboard');
      }
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  // Fetch groups when params change
  useEffect(() => {
    if (isAuthenticated && user?.isAdmin) {
      fetchGroups();
    }
  }, [isAuthenticated, user, fetchGroups]);

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
      // Fallback
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

  const totalPages = Math.ceil(total / limit);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user?.isAdmin) {
    return null; // Will redirect
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display text-amber-400">Admin Dashboard</h1>
          <p className="text-text-muted mt-1">
            View and manage all static groups ({total} total)
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to My Statics
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by group name or owner..."
            className="w-full bg-surface-elevated border border-border-default rounded-lg px-4 py-2 pl-10 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
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
        <div className="text-center py-12 bg-surface-card rounded-lg border border-border-default">
          <p className="text-text-muted">
            {debouncedSearch ? 'No groups match your search' : 'No static groups found'}
          </p>
        </div>
      ) : (
        <>
          {/* Groups table */}
          <div className="bg-surface-card rounded-lg border border-border-default overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-elevated">
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Owner</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-text-secondary">Members</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-text-secondary">Tiers</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-text-secondary">Visibility</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Code</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Created</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {groups.map((group) => (
                  <tr
                    key={group.id}
                    onClick={() => navigate(`/group/${group.shareCode}`)}
                    className="hover:bg-surface-interactive transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-accent hover:text-accent-bright">
                        {group.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {group.owner?.avatarUrl ? (
                          <img
                            src={group.owner.avatarUrl}
                            alt=""
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-surface-elevated flex items-center justify-center text-xs text-text-muted">
                            ?
                          </div>
                        )}
                        <span className="text-text-secondary text-sm">
                          {group.owner?.displayName || group.owner?.discordUsername || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-text-secondary">
                      {group.memberCount}
                    </td>
                    <td className="px-4 py-3 text-center text-text-secondary">
                      {group.tierCount}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {group.isPublic ? (
                        <span className="text-teal-400 text-sm">Public</span>
                      ) : (
                        <span className="text-text-muted text-sm">Private</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-accent text-sm">{group.shareCode}</span>
                        <button
                          onClick={(e) => handleCopyCode(group.shareCode, e)}
                          className="p-1 rounded hover:bg-surface-elevated transition-colors"
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
                    </td>
                    <td className="px-4 py-3 text-text-muted text-sm">
                      {new Date(group.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => handleOpenViewAs(group, e)}
                        className="p-1.5 rounded hover:bg-surface-elevated transition-colors text-text-muted hover:text-amber-400"
                        title="View as member"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-text-muted">
                Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 rounded border border-border-default text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-interactive transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 rounded border border-border-default text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-interactive transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* View As Modal */}
      {viewAsGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setViewAsGroup(null)}
          />
          <div className="relative bg-surface-card border border-border-default rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-4 border-b border-border-subtle">
              <h3 className="text-lg font-semibold text-text-primary">
                View As Member
              </h3>
              <p className="text-sm text-text-muted mt-1">
                Select a member to view "{viewAsGroup.name}" from their perspective
              </p>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto">
              {viewAsMembersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : viewAsMembers.length === 0 ? (
                <p className="text-text-muted text-center py-8">
                  No members found
                </p>
              ) : (
                <div className="space-y-2">
                  {viewAsMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleViewAs(member.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-interactive transition-colors text-left"
                    >
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-sm text-text-muted">
                          ?
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-primary truncate">
                          {member.displayName || member.discordUsername}
                        </p>
                        {member.displayName && (
                          <p className="text-xs text-text-muted truncate">
                            @{member.discordUsername}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border-subtle flex justify-end">
              <button
                onClick={() => setViewAsGroup(null)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
