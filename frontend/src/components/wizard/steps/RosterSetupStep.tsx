/**
 * RosterSetupStep - Step 2 of setup wizard
 *
 * 8 player slots in a 2x4 grid (responsive: 1 column on mobile).
 * Allows partial completion (not all slots required).
 */

import { RosterSlot } from '../RosterSlot';
import type { WizardPlayer } from '../types';

interface RosterSetupStepProps {
  players: WizardPlayer[];
  tierId: string; // For BiS import context
  onPlayersChange: (players: WizardPlayer[]) => void;
}

export function RosterSetupStep({ players, tierId, onPlayersChange }: RosterSetupStepProps) {
  const handlePlayerUpdate = (index: number, updates: Partial<WizardPlayer>) => {
    const newPlayers = [...players];
    newPlayers[index] = { ...newPlayers[index], ...updates };
    onPlayersChange(newPlayers);
  };

  // Group players into pairs for 2-column layout
  const playerPairs = [
    [players[0], players[1]], // T1, T2
    [players[2], players[3]], // H1, H2
    [players[4], players[5]], // M1, M2
    [players[6], players[7]], // R1, R2
  ];

  return (
    <div className="space-y-6">
      {/* Info header */}
      <div className="bg-surface-elevated border border-border-default rounded-lg p-4">
        <p className="text-sm text-text-secondary">
          <strong className="text-text-primary">Optional:</strong> Fill in player names and jobs now, or add them later. BiS imports are also optional.
        </p>
      </div>

      {/* Roster grid - 2 columns on desktop, 1 on mobile */}
      <div className="space-y-4">
        {playerPairs.map((pair, pairIndex) => {
          const [player1, player2] = pair;
          const index1 = pairIndex * 2;
          const index2 = pairIndex * 2 + 1;

          return (
            <div key={pairIndex} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RosterSlot
                player={player1}
                tierId={tierId}
                onUpdate={(updates) => handlePlayerUpdate(index1, updates)}
              />
              <RosterSlot
                player={player2}
                tierId={tierId}
                onUpdate={(updates) => handlePlayerUpdate(index2, updates)}
              />
            </div>
          );
        })}
      </div>

      {/* Helpful tip */}
      <div className="text-xs text-text-muted text-center pt-2">
        <p>You can always add or edit players after creating the static</p>
      </div>
    </div>
  );
}
