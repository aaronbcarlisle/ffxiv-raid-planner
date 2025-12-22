import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useStaticStore, createTemplatePlayers } from '../stores/staticStore';
import { getCurrentTier, getTierById } from '../gamedata';
import { PlayerCard } from '../components/player/PlayerCard';
import { EmptySlotCard } from '../components/player/EmptySlotCard';
import { InlinePlayerEdit } from '../components/player/InlinePlayerEdit';
import { FloorSelector, SummaryPanel } from '../components/loot';
import { calculateTeamSummary, sortPlayersByRole } from '../utils/calculations';
import type { Player } from '../types';

export function StaticView() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const {
    currentStatic,
    isLoading,
    error,
    selectedFloor,
    editingPlayerId,
    setStatic,
    setLoading,
    updatePlayer,
    removePlayer,
    configurePlayer,
    addPlayerSlot,
    setSelectedFloor,
    setEditingPlayerId,
  } = useStaticStore();

  useEffect(() => {
    if (!shareCode) return;

    // TODO: Fetch static from API
    // For now, set mock data with template players
    setLoading(true);

    const tier = getCurrentTier();
    const staticId = '1';
    setTimeout(() => {
      setStatic({
        id: staticId,
        name: 'Demo Static',
        tier: tier.id,
        shareCode: shareCode,
        settings: {
          displayOrder: ['tank', 'healer', 'melee', 'ranged', 'caster'],
          lootPriority: ['melee', 'ranged', 'caster', 'tank', 'healer'],
          timezone: 'America/New_York',
          autoSync: false,
          syncFrequency: 'weekly',
        },
        players: createTemplatePlayers(staticId),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setLoading(false);
    }, 300);
  }, [shareCode, setStatic, setLoading]);

  // Calculate sorted players and team summary
  const sortedPlayers = useMemo(() => {
    if (!currentStatic) return [];
    return sortPlayersByRole(currentStatic.players, currentStatic.settings.displayOrder);
  }, [currentStatic]);

  // Only count configured players for team summary
  const configuredPlayers = useMemo(() => {
    return sortedPlayers.filter((p) => p.configured);
  }, [sortedPlayers]);

  const teamSummary = useMemo(() => {
    if (!currentStatic || configuredPlayers.length === 0) return null;
    return calculateTeamSummary(configuredPlayers);
  }, [currentStatic, configuredPlayers]);

  const tierInfo = currentStatic ? getTierById(currentStatic.tier) : null;

  const handleUpdatePlayer = (playerId: string, updates: Partial<Player>) => {
    updatePlayer(playerId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleRemovePlayer = (playerId: string) => {
    removePlayer(playerId);
  };

  const handleConfigurePlayer = (playerId: string, name: string, job: string, role: string) => {
    configurePlayer(playerId, name, job, role);
  };

  const handleCopyShareLink = () => {
    if (!currentStatic) return;
    const url = `${window.location.origin}/static/${currentStatic.shareCode}`;
    navigator.clipboard.writeText(url);
    // TODO: Show toast notification
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-text-secondary">Loading static...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-status-error">{error}</div>
      </div>
    );
  }

  if (!currentStatic) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-text-secondary">Static not found</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="font-display text-3xl text-accent">{currentStatic.name}</h1>
          <p className="text-text-secondary">{tierInfo?.name ?? currentStatic.tier}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyShareLink}
            className="bg-bg-secondary border border-border-default px-4 py-2 rounded font-medium text-text-secondary hover:text-text-primary hover:border-accent"
          >
            Copy Link
          </button>
          <button
            onClick={addPlayerSlot}
            className="bg-accent text-bg-primary px-4 py-2 rounded font-medium hover:bg-accent-bright"
          >
            Add Player
          </button>
        </div>
      </div>

      {/* Floor Selector */}
      {tierInfo && (
        <div className="mb-6">
          <FloorSelector
            floors={tierInfo.floors}
            selectedFloor={selectedFloor}
            onFloorChange={setSelectedFloor}
          />
        </div>
      )}

      {/* Players Grid - Always show template slots */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        {sortedPlayers.map((player) => {
          // If editing this player, show inline edit form
          if (editingPlayerId === player.id) {
            return (
              <InlinePlayerEdit
                key={player.id}
                player={player}
                onSave={(name, job, role) => handleConfigurePlayer(player.id, name, job, role)}
                onCancel={() => setEditingPlayerId(null)}
              />
            );
          }

          // If player is configured, show player card
          if (player.configured) {
            return (
              <PlayerCard
                key={player.id}
                player={player}
                settings={currentStatic.settings}
                onUpdate={(updates) => handleUpdatePlayer(player.id, updates)}
                onRemove={() => handleRemovePlayer(player.id)}
              />
            );
          }

          // Otherwise show empty slot - all unconfigured slots can be removed
          return (
            <EmptySlotCard
              key={player.id}
              onStartEdit={() => setEditingPlayerId(player.id)}
              onRemove={() => handleRemovePlayer(player.id)}
            />
          );
        })}
      </div>

      {/* Summary Panel (Loot Priority + Team Stats) - only show when we have configured players */}
      {teamSummary && tierInfo && (
        <SummaryPanel
          players={configuredPlayers}
          settings={currentStatic.settings}
          selectedFloor={selectedFloor}
          floorName={tierInfo.floors[selectedFloor - 1]}
          teamSummary={teamSummary}
        />
      )}
    </div>
  );
}
