import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useStaticStore } from '../stores/staticStore';
import { getCurrentTier, getTierById } from '../gamedata';
import { PlayerCard } from '../components/player/PlayerCard';
import { AddPlayerModal } from '../components/player/AddPlayerModal';
import { TeamSummary } from '../components/team/TeamSummary';
import { calculateTeamSummary, sortPlayersByRole } from '../utils/calculations';
import type { Player } from '../types';

export function StaticView() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const {
    currentStatic,
    isLoading,
    error,
    setStatic,
    setLoading,
    addPlayer,
    updatePlayer,
    removePlayer,
  } = useStaticStore();

  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);

  useEffect(() => {
    if (!shareCode) return;

    // TODO: Fetch static from API
    // For now, set mock data
    setLoading(true);

    const tier = getCurrentTier();
    setTimeout(() => {
      setStatic({
        id: '1',
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
        players: [],
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

  const teamSummary = useMemo(() => {
    if (!currentStatic) return null;
    return calculateTeamSummary(currentStatic.players);
  }, [currentStatic]);

  const tierInfo = currentStatic ? getTierById(currentStatic.tier) : null;

  const handleAddPlayer = (playerData: Omit<Player, 'id' | 'staticId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentStatic) return;

    const newPlayer: Player = {
      ...playerData,
      id: crypto.randomUUID(),
      staticId: currentStatic.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addPlayer(newPlayer);
  };

  const handleUpdatePlayer = (playerId: string, updates: Partial<Player>) => {
    updatePlayer(playerId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleRemovePlayer = (playerId: string) => {
    removePlayer(playerId);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl text-accent">{currentStatic.name}</h1>
          <p className="text-text-secondary">{tierInfo?.name ?? currentStatic.tier}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopyShareLink}
            className="bg-bg-secondary border border-border-default px-4 py-2 rounded font-medium text-text-secondary hover:text-text-primary hover:border-accent"
          >
            Copy Link
          </button>
          <button
            onClick={() => setIsAddPlayerOpen(true)}
            className="bg-accent text-bg-primary px-4 py-2 rounded font-medium hover:bg-accent-bright"
          >
            Add Player
          </button>
        </div>
      </div>

      {/* Players Grid */}
      {sortedPlayers.length === 0 ? (
        <div className="bg-bg-card border border-border-default rounded-lg p-8 text-center mb-8">
          <p className="text-text-secondary mb-4">No players added yet</p>
          <button
            onClick={() => setIsAddPlayerOpen(true)}
            className="bg-accent/20 text-accent px-4 py-2 rounded hover:bg-accent/30"
          >
            Add your first player
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {sortedPlayers.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              onUpdate={(updates) => handleUpdatePlayer(player.id, updates)}
              onRemove={() => handleRemovePlayer(player.id)}
            />
          ))}
        </div>
      )}

      {/* Team Summary */}
      {teamSummary && <TeamSummary summary={teamSummary} />}

      {/* Add Player Modal */}
      <AddPlayerModal
        isOpen={isAddPlayerOpen}
        onClose={() => setIsAddPlayerOpen(false)}
        onAdd={handleAddPlayer}
        existingPlayerCount={currentStatic.players.length}
      />
    </div>
  );
}
