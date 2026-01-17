/**
 * Admin Dashboard Page
 *
 * Shows all static groups in the system for admin troubleshooting.
 * Only accessible to users with isAdmin=true.
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api, ApiError } from '../services/api';
import { Eye, ChevronUp, ChevronDown, ChevronsUpDown, ArrowLeft, Search } from 'lucide-react';
import { toast } from '../stores/toastStore';
import { Input, ErrorMessage } from '../components/ui';
import { Button, Tooltip } from '../components/primitives';
import type { AdminStaticGroupListItem, AdminStaticGroupListResponse, MemberInfo, LinkedPlayerInfo, MemberRole, Membership } from '../types';

// Extended member info with role for View As modal
interface ViewAsMemberInfo extends MemberInfo {
  role?: MemberRole;
  isLinkedPlayer?: boolean;
}

// Sortable columns
type SortField = 'name' | 'owner' | 'memberCount' | 'tierCount' | 'isPublic' | 'createdAt';
type SortDirection = 'asc' | 'desc';

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

interface SortableHeaderProps {
  field: SortField;
  label: string;
  currentField: SortField;
  currentDirection: SortDirection;
  onSort: (field: SortField) => void;
  align?: 'left' | 'center';
}

function SortableHeader({ field, label, currentField, currentDirection, onSort, align = 'left' }: SortableHeaderProps) {
  const isActive = currentField === field;
  const justifyClass = align === 'center' ? 'justify-center' : '';

  return (
    <th
      className="group text-left px-4 py-3 text-sm font-medium text-text-secondary cursor-pointer hover:text-text-primary select-none"
      onClick={() => onSort(field)}
      aria-sort={isActive ? (currentDirection === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <span className={`flex items-center gap-1 ${justifyClass}`}>
        {label}
        {isActive ? (
          // Active column: always show direction indicator
          <span className="text-accent">
            {currentDirection === 'asc' ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </span>
        ) : (
          // Inactive column: show neutral icon on hover
          <span className="opacity-0 group-hover:opacity-50 transition-opacity">
            <ChevronsUpDown className="w-4 h-4" />
          </span>
        )}
      </span>
    </th>
  );
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();

  const [groups, setGroups] = useState<AdminStaticGroupListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search and pagination - initialized from URL params
  const [search, setSearchState] = useState(() => searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('q') || '');
  const [page, setPageState] = useState(() => {
    const urlPage = searchParams.get('page');
    return urlPage ? Math.max(0, parseInt(urlPage, 10)) : 0;
  });
  const limit = 20;

  // Copy state for feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Sorting state - initialized from URL params
  const [sortField, setSortFieldState] = useState<SortField>(() => {
    const urlSort = searchParams.get('sort');
    if (['name', 'owner', 'memberCount', 'tierCount', 'isPublic', 'createdAt'].includes(urlSort || '')) {
      return urlSort as SortField;
    }
    return 'name';
  });
  const [sortDirection, setSortDirectionState] = useState<SortDirection>(() => {
    const urlDir = searchParams.get('dir');
    return urlDir === 'desc' ? 'desc' : 'asc';
  });

  // Sync state when URL params change externally (e.g., browser back/forward)
  useEffect(() => {
    const urlSearch = searchParams.get('q') || '';
    if (urlSearch !== search) {
      setSearchState(urlSearch);
      setDebouncedSearch(urlSearch);
    }

    const urlPageParam = searchParams.get('page');
    const urlPage = urlPageParam ? Math.max(0, parseInt(urlPageParam, 10) || 0) : 0;
    if (urlPage !== page) {
      setPageState(urlPage);
    }

    const urlSort = searchParams.get('sort');
    if (urlSort && ['name', 'owner', 'memberCount', 'tierCount', 'isPublic', 'createdAt'].includes(urlSort)) {
      if (urlSort !== sortField) {
        setSortFieldState(urlSort as SortField);
      }
    }

    const urlDir = searchParams.get('dir');
    const nextSortDirection: SortDirection = urlDir === 'desc' ? 'desc' : 'asc';
    if (nextSortDirection !== sortDirection) {
      setSortDirectionState(nextSortDirection);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: Intentionally excluding state vars to prevent loops - we only want to sync FROM URL

  // Helper to update URL params
  const updateUrlParams = useCallback((updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // Wrapper to set search and sync URL (debounced via existing effect)
  const setSearch = useCallback((value: string) => {
    setSearchState(value);
  }, []);

  // Wrapper to set page and sync URL
  const setPage = useCallback((pageOrFn: number | ((prev: number) => number)) => {
    setPageState(prev => {
      const newPage = typeof pageOrFn === 'function' ? pageOrFn(prev) : pageOrFn;
      // Update URL - omit if default (0)
      updateUrlParams({ page: newPage > 0 ? String(newPage) : null });
      return newPage;
    });
  }, [updateUrlParams]);

  // View As modal state
  const [viewAsGroup, setViewAsGroup] = useState<AdminStaticGroupListItem | null>(null);
  const [viewAsMembers, setViewAsMembers] = useState<ViewAsMemberInfo[]>([]);
  const [viewAsMembersLoading, setViewAsMembersLoading] = useState(false);

  // Fetch members and linked players for View As modal
  const fetchMembers = useCallback(async (groupId: string) => {
    if (!isAuthenticated) return;
    setViewAsMembersLoading(true);
    try {
      // Use api wrapper for automatic token refresh on 401
      const [members, linkedPlayers] = await Promise.all([
        api.get<Membership[]>(`/api/static-groups/${groupId}/members`).catch((error) => {
          console.error(`Failed to fetch members for group ${groupId}:`, error);
          return [] as Membership[];
        }),
        api.get<LinkedPlayerInfo[]>(`/api/static-groups/${groupId}/linked-players`).catch((error) => {
          console.error(`Failed to fetch linked players for group ${groupId}:`, error);
          return [] as LinkedPlayerInfo[];
        }),
      ]);

      const allUsers: ViewAsMemberInfo[] = [];
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

      setViewAsMembers(allUsers);
    } catch (error) {
      console.error('Failed to fetch members:', error);
      setViewAsMembers([]);
    } finally {
      setViewAsMembersLoading(false);
    }
  }, [isAuthenticated]);

  // Open View As modal for a group
  const handleOpenViewAs = useCallback((group: AdminStaticGroupListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setViewAsGroup(group);
    fetchMembers(group.id);
  }, [fetchMembers]);

  // Handle View As selection
  const handleViewAs = useCallback((userId: string) => {
    if (!viewAsGroup) return;
    navigate(`/group/${viewAsGroup.shareCode}?adminMode=true&viewAs=${userId}`);
    setViewAsGroup(null);
  }, [viewAsGroup, navigate]);

  // Handle column sort - resets to first page and triggers server-side sort
  const handleSort = useCallback((field: SortField) => {
    let newDirection: SortDirection = 'asc';
    if (sortField === field) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    }

    setSortFieldState(field);
    setSortDirectionState(newDirection);
    setPageState(0);

    // Update URL - omit defaults
    updateUrlParams({
      sort: field === 'name' ? null : field,
      dir: newDirection === 'asc' ? null : newDirection,
      page: null, // Reset to first page
    });
  }, [sortField, sortDirection, updateUrlParams]);

  // Debounce search input and update URL
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPageState(0); // Reset to first page on search

      // Update URL with debounced search - omit if empty
      updateUrlParams({
        q: search || null,
        page: null, // Reset to first page
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, updateUrlParams]);

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
        sort_by: sortField,
        sort_order: sortDirection,
      });
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      // Use api wrapper for automatic token refresh on 401
      const data = await api.get<AdminStaticGroupListResponse>(
        `/api/static-groups/admin/all?${params}`
      );

      setGroups(data.items);
      setTotal(data.total);
    } catch (err) {
      // Check for specific error status using ApiError type
      if (err instanceof ApiError && err.status === 403) {
        setError('Admin access required');
      } else {
        setError('Failed to fetch groups');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, page, debouncedSearch, sortField, sortDirection]);

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
      toast.error('Failed to copy to clipboard');
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
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display text-status-warning">Admin Dashboard</h1>
          <p className="text-text-muted mt-1">
            View and manage all static groups ({total} total)
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Statics
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Input
            value={search}
            onChange={setSearch}
            placeholder="Search by group name or owner..."
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <ErrorMessage
          message={error}
          onRetry={fetchGroups}
          onDismiss={() => setError(null)}
          retrying={isLoading}
          className="mb-6"
        />
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
                  <SortableHeader field="name" label="Name" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <SortableHeader field="owner" label="Owner" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <SortableHeader field="memberCount" label="Members" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" />
                  <SortableHeader field="tierCount" label="Tiers" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" />
                  <SortableHeader field="isPublic" label="Visibility" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} align="center" />
                  <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Code</th>
                  <SortableHeader field="createdAt" label="Created" currentField={sortField} currentDirection={sortDirection} onSort={handleSort} />
                  <th className="text-center px-4 py-3 text-sm font-medium text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {groups.map((group) => (
                  <tr
                    key={group.id}
                    onClick={() => navigate(`/group/${group.shareCode}?adminMode=true`)}
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
                        <Tooltip
                          content={
                            <div>
                              <div className="font-medium">Copy Share Code</div>
                              <div className="text-text-secondary text-xs mt-0.5">
                                Hold <kbd className="px-1 py-0.5 bg-surface-base rounded border border-border-default">Shift</kbd> for full URL
                              </div>
                            </div>
                          }
                        >
                          {/* design-system-ignore: Inline icon button in table cell */}
                          <button
                            onClick={(e) => handleCopyCode(group.shareCode, e)}
                            className="p-1 rounded hover:bg-surface-elevated transition-colors"
                            aria-label="Copy share code"
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
                        </Tooltip>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-muted text-sm">
                      {new Date(group.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Tooltip
                        content={
                          <div>
                            <div className="font-medium">View As Member</div>
                            <div className="text-text-secondary text-xs mt-0.5">
                              Impersonate a member to see their view
                            </div>
                          </div>
                        }
                      >
                        {/* design-system-ignore: Inline icon button in table cell */}
                        <button
                          onClick={(e) => handleOpenViewAs(group, e)}
                          className="p-1.5 rounded hover:bg-surface-elevated transition-colors text-text-muted hover:text-status-warning"
                          aria-label="View as member"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </Tooltip>
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
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Eye className="w-5 h-5 text-status-warning" />
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
                      {/* Role badge */}
                      {member.role ? (
                        <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${ROLE_COLORS[member.role]}`}>
                          {ROLE_LABELS[member.role]}
                        </span>
                      ) : member.isLinkedPlayer ? (
                        <span className="text-xs px-2 py-0.5 rounded border flex-shrink-0 bg-membership-linked/20 text-membership-linked border-membership-linked/30">
                          Linked
                        </span>
                      ) : null}
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
