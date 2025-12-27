/**
 * Dashboard Page
 *
 * Shows user's static groups with ability to create new ones.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import type { MemberRole } from '../types';

// Role badge colors
const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  lead: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  member: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
};

export function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { groups, isLoading, isCreating, error, fetchGroups, createGroup } = useStaticGroupStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupPublic, setNewGroupPublic] = useState(false);

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
      const group = await createGroup(newGroupName.trim(), newGroupPublic);
      setShowCreateModal(false);
      setNewGroupName('');
      setNewGroupPublic(false);
      // Navigate to the new group
      navigate(`/group/${group.shareCode}`);
    } catch {
      // Error is handled in store
    }
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
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-accent text-bg-primary px-4 py-2 rounded font-medium hover:bg-accent-bright transition-colors"
        >
          Create Static
        </button>
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
      ) : (
        /* Groups grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              to={`/group/${group.shareCode}`}
              className="block bg-bg-card rounded-lg border border-white/10 p-4 hover:border-accent/50 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-display text-lg text-accent group-hover:text-accent-bright transition-colors">
                  {group.name}
                </h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded border ${ROLE_COLORS[group.userRole]}`}
                >
                  {ROLE_LABELS[group.userRole]}
                </span>
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
                  <span className="flex items-center gap-1 text-green-400">
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

              <div className="mt-3 pt-3 border-t border-white/5 text-xs text-text-muted">
                Code: <span className="font-mono text-accent">{group.shareCode}</span>
              </div>
            </Link>
          ))}
        </div>
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
    </div>
  );
}
