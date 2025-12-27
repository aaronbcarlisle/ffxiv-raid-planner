/**
 * Group View Page
 *
 * Shows a static group with its tier snapshots and roster.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
import { useAuthStore } from '../stores/authStore';
import { getTierById, RAID_TIERS } from '../gamedata';
import type { MemberRole, TierSnapshot } from '../types';

// Role badge colors
const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  lead: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  member: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export function GroupView() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { currentGroup, isLoading: groupLoading, error: groupError, fetchGroupByShareCode } = useStaticGroupStore();
  const { tiers, currentTier, isLoading: tierLoading, error: tierError, fetchTiers, fetchTier, createTier } = useTierStore();

  const [showCreateTierModal, setShowCreateTierModal] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<string>('');

  // Fetch group on mount
  useEffect(() => {
    if (shareCode) {
      fetchGroupByShareCode(shareCode);
    }
  }, [shareCode, fetchGroupByShareCode]);

  // Fetch tiers when group is loaded
  useEffect(() => {
    if (currentGroup?.id) {
      fetchTiers(currentGroup.id);
    }
  }, [currentGroup?.id, fetchTiers]);

  // Load active tier or first tier
  useEffect(() => {
    if (currentGroup?.id && tiers.length > 0 && !currentTier) {
      const activeTier = tiers.find(t => t.isActive) || tiers[0];
      if (activeTier) {
        fetchTier(currentGroup.id, activeTier.tierId);
      }
    }
  }, [currentGroup?.id, tiers, currentTier, fetchTier]);

  const handleCreateTier = async () => {
    if (!currentGroup?.id || !selectedTierId) return;

    try {
      await createTier(currentGroup.id, selectedTierId);
      setShowCreateTierModal(false);
      setSelectedTierId('');
    } catch {
      // Error handled in store
    }
  };

  const handleTierChange = (tierId: string) => {
    if (currentGroup?.id) {
      fetchTier(currentGroup.id, tierId);
    }
  };

  const isLoading = groupLoading || tierLoading;
  const error = groupError || tierError;
  const userRole = currentGroup?.userRole;
  const canEdit = userRole === 'owner' || userRole === 'lead';

  // Get tier info for display
  const tierInfo = currentTier ? getTierById(currentTier.tierId) : null;

  // Available tiers for creation (filter out existing)
  const existingTierIds = tiers.map(t => t.tierId);
  const availableTiers = RAID_TIERS.filter(t => !existingTierIds.includes(t.id));

  if (isLoading && !currentGroup) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <h2 className="text-xl font-display text-red-400 mb-2">Error</h2>
          <p className="text-text-secondary mb-4">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-accent hover:bg-accent/80 text-bg-primary font-medium rounded"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!currentGroup) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-display text-accent mb-2">Group Not Found</h2>
          <p className="text-text-muted">The static group you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[120rem] mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display text-accent">{currentGroup.name}</h1>
            {userRole && (
              <span className={`text-xs px-2 py-0.5 rounded border ${ROLE_COLORS[userRole]}`}>
                {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
              </span>
            )}
          </div>
          <p className="text-text-muted text-sm mt-1">
            Code: <span className="font-mono text-accent">{currentGroup.shareCode}</span>
            {currentGroup.isPublic ? ' (Public)' : ' (Private)'}
          </p>
        </div>

        {/* Tier selector */}
        <div className="flex items-center gap-3">
          {tiers.length > 0 && (
            <select
              value={currentTier?.tierId || ''}
              onChange={(e) => handleTierChange(e.target.value)}
              className="bg-bg-card border border-white/10 rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
            >
              {tiers.map((tier) => {
                const info = getTierById(tier.tierId);
                return (
                  <option key={tier.tierId} value={tier.tierId}>
                    {info?.name || tier.tierId} {tier.isActive && '(Active)'}
                  </option>
                );
              })}
            </select>
          )}

          {canEdit && availableTiers.length > 0 && (
            <button
              onClick={() => setShowCreateTierModal(true)}
              className="bg-accent/20 text-accent px-3 py-2 rounded font-medium hover:bg-accent/30 text-sm"
            >
              + New Tier
            </button>
          )}
        </div>
      </div>

      {/* Tier info banner */}
      {tierInfo && (
        <div className="bg-bg-card border border-white/10 rounded-lg px-4 py-3 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-display text-lg text-accent">{tierInfo.name}</span>
              <span className="text-text-muted ml-2">({tierInfo.shortName})</span>
            </div>
            <div className="text-sm text-text-secondary">
              {currentTier?.players?.filter(p => p.configured).length || 0} / {currentTier?.players?.length || 0} players configured
            </div>
          </div>
        </div>
      )}

      {/* No tiers state */}
      {tiers.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-bg-card rounded-lg border border-white/10">
          <h2 className="text-xl font-display text-accent mb-2">No Raid Tiers</h2>
          <p className="text-text-muted mb-6">
            Create your first tier snapshot to start tracking gear progress.
          </p>
          {canEdit && (
            <button
              onClick={() => setShowCreateTierModal(true)}
              className="bg-accent text-bg-primary px-6 py-2 rounded font-medium hover:bg-accent-bright"
            >
              Create First Tier
            </button>
          )}
        </div>
      )}

      {/* Players grid */}
      {currentTier?.players && currentTier.players.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {currentTier.players.map((player) => (
            <div
              key={player.id}
              className="bg-bg-card border border-white/10 rounded-lg p-4 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {player.position && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-text-muted">
                      {player.position}
                    </span>
                  )}
                  <span className="font-medium text-text-primary">
                    {player.configured ? player.name : `(${player.templateRole || 'Empty'})`}
                  </span>
                </div>
                {player.isSubstitute && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                    SUB
                  </span>
                )}
              </div>

              {player.configured && (
                <>
                  <div className="text-sm text-text-secondary mb-2">
                    {player.job || 'No job'} • {player.role || 'No role'}
                  </div>

                  {/* Gear progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-text-muted mb-1">
                      <span>Gear Progress</span>
                      <span>
                        {player.gear.filter(g => g.hasItem).length}/{player.gear.length}
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{
                          width: `${(player.gear.filter(g => g.hasItem).length / player.gear.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </>
              )}

              {!player.configured && (
                <div className="text-sm text-text-muted italic">
                  Slot not configured
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Tier Modal */}
      {showCreateTierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bg-card rounded-lg border border-white/10 p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-display text-accent mb-4">Create New Tier</h2>

            <div className="mb-4">
              <label className="block text-sm text-text-secondary mb-2">
                Select Raid Tier
              </label>
              <select
                value={selectedTierId}
                onChange={(e) => setSelectedTierId(e.target.value)}
                className="w-full bg-bg-primary border border-white/10 rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Choose a tier...</option>
                {availableTiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name} ({tier.shortName})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateTierModal(false);
                  setSelectedTierId('');
                }}
                className="px-4 py-2 text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTier}
                disabled={!selectedTierId}
                className="bg-accent text-bg-primary px-4 py-2 rounded font-medium hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
